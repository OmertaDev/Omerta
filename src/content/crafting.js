// Authored crafting and supply-chain adapter. Every inventory lot is account-owned and pinned to
// one exact bundle hash; sources are globally finite and recipes consume only same-hash lots FIFO.
import crypto from 'node:crypto';
import { GameError } from '../game.js';
import { seasonIdxOf } from '../rules.js';
import { validateCraftingContentPack } from './compiler.js';
import { assertNodeGates, blockedGates } from './runtime.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const fail = (code, message, data) => { throw new GameError(code, message, data); };
const parseJson = (value, fallback = {}) => {
  try { return typeof value === 'string' ? JSON.parse(value) : (value ?? fallback); }
  catch { return fallback; }
};

function craftingGraphOf(bundle) {
  validateCraftingContentPack(bundle);
  const included = new Set(bundle.crafting.nodeIds);
  const nodeById = new Map(bundle.nodes
    .filter((node) => included.has(node.id)).map((node) => [node.id, node]));
  const edges = bundle.edges
    .filter((edge) => included.has(edge.from) && included.has(edge.to))
    .sort((a, b) => `${a.from}\0${a.type}\0${a.to}`.localeCompare(`${b.from}\0${b.type}\0${b.to}`));
  const outgoing = new Map();
  for (const edge of edges) {
    const list = outgoing.get(edge.from) || [];
    list.push(edge);
    outgoing.set(edge.from, list);
  }
  return { bundle, crafting: bundle.crafting, nodeById, edges, outgoing };
}

export async function loadBundle(client, namespace, version, contentHash) {
  const row = (await client.query(
    `SELECT bundle_json FROM content_bundles
      WHERE namespace=$1 AND version=$2 AND content_hash=$3`,
    [namespace, version, contentHash],
  )).rows[0];
  if (!row) fail('content_inactive', 'The pinned authored workshop is unavailable.');
  const bundle = parseJson(row.bundle_json, null);
  if (!bundle) fail('content_inactive', 'The pinned authored workshop cannot be read.');
  try { return validateCraftingContentPack(bundle); }
  catch (error) { fail('unsupported_content_feature', error.message); }
}

export async function loadActiveBundle(client, namespace) {
  const active = (await client.query(
    'SELECT version, content_hash FROM content_activations WHERE namespace=$1', [namespace],
  )).rows[0];
  if (!active) fail('content_inactive', 'That authored workshop is not active.');
  return loadBundle(client, namespace, Number(active.version), active.content_hash);
}

const epochKeyOf = (budget) => {
  if (budget.payload.epoch === 'season') return `season:${seasonIdxOf()}`;
  const days = Math.floor(Date.now() / DAY_MS);
  if (budget.payload.epoch === 'week') return `week:${Math.floor(days / 7)}`;
  return `day:${days}`;
};
const outputEdges = (graph, actionId) => (graph.outgoing.get(actionId) || [])
  .filter((edge) => edge.type === 'PRODUCES')
  .sort((a, b) => a.to.localeCompare(b.to));
const inputEdges = (graph, recipeId) => (graph.outgoing.get(recipeId) || [])
  .filter((edge) => edge.type === 'CONSUMES')
  .sort((a, b) => a.to.localeCompare(b.to));
const facilityEdges = (graph, actionId) => (graph.outgoing.get(actionId) || [])
  .filter((edge) => edge.type === 'REQUIRES' && graph.nodeById.get(edge.to)?.type === 'facility')
  .sort((a, b) => a.to.localeCompare(b.to));
const toolEdges = (graph, actionId) => (graph.outgoing.get(actionId) || [])
  .filter((edge) => edge.type === 'USES_TOOL')
  .sort((a, b) => a.to.localeCompare(b.to));
const trainingEdge = (graph, jobId) => (graph.outgoing.get(jobId) || [])
  .find((edge) => edge.type === 'TRAINS');
const safeItems = (graph, edges) => edges.map((edge) => ({
  itemId: edge.to,
  title: graph.nodeById.get(edge.to)?.payload?.title || edge.to,
  quantity: Number(edge.quantity),
}));
const skillLevelOf = (track, xp) => track.payload.thresholds
  .filter((threshold) => Number(xp) >= Number(threshold)).length;
const skillProjection = (track, xp) => {
  const level = skillLevelOf(track, xp);
  return {
    id: track.id, title: track.payload.title, xp: Number(xp), level,
    maxLevel: track.payload.thresholds.length,
    nextLevelXp: track.payload.thresholds[level] ?? null,
  };
};

function facilityProjection(ch, graph, facility) {
  const location = graph.nodeById.get(facility.payload.locationId);
  const publicLocation = {
    id: location.id, districtId: location.payload.districtId,
    title: location.payload.title || location.id,
  };
  return {
    id: facility.id, title: facility.payload.title,
    kind: facility.payload.facilityKind, location: publicLocation,
    available: ch.loc === publicLocation.districtId,
  };
}

const facilityRequirements = (ch, graph, actionId) => facilityEdges(graph, actionId)
  .map((edge) => facilityProjection(ch, graph, graph.nodeById.get(edge.to)));

const facilityBlocks = (requirements) => requirements.filter((facility) => !facility.available)
  .map((facility) => ({
    kind: 'facility_location', label: facility.title, passed: false,
    facilityId: facility.id, location: facility.location,
  }));

async function currentToolStates(client, accountId, bundle) {
  const rows = (await client.query(
    `SELECT * FROM content_tool_states
      WHERE account_id=$1 AND namespace=$2 AND content_hash=$3`,
    [accountId, bundle.namespace, bundle.contentHash],
  )).rows;
  return new Map(rows.map((row) => [row.tool_id, row]));
}

function toolRequirementProjection(graph, edge, toolStates) {
  const tool = graph.nodeById.get(edge.to);
  const state = toolStates.get(tool.id);
  const remaining = Number(state?.durability_remaining || 0);
  return {
    id: tool.id, title: tool.payload.title, itemId: tool.payload.itemId,
    owned: !!state, durabilityCost: Number(tool.payload.durabilityCost),
    durabilityRemaining: remaining, maxDurability: Number(tool.payload.maxDurability),
    usable: !!state && remaining >= Number(tool.payload.durabilityCost),
  };
}

const toolRequirements = (graph, actionId, toolStates) => toolEdges(graph, actionId)
  .map((edge) => toolRequirementProjection(graph, edge, toolStates));

const toolBlocks = (requirements) => requirements.filter((tool) => !tool.usable).map((tool) => ({
  kind: tool.owned ? 'tool_broken' : 'tool_missing',
  label: tool.owned ? `${tool.title} needs repair` : `${tool.title} required`,
  passed: false, toolId: tool.id,
  current: tool.durabilityRemaining, required: tool.durabilityCost,
}));

async function currentSkillXp(client, accountId, bundle) {
  const rows = (await client.query(
    `SELECT skill_id, xp FROM content_skill_progress
      WHERE account_id=$1 AND namespace=$2 AND content_hash=$3`,
    [accountId, bundle.namespace, bundle.contentHash],
  )).rows;
  return new Map(rows.map((row) => [row.skill_id, Number(row.xp)]));
}

async function archivedSkills(client, accountId, bundle) {
  const rows = (await client.query(
    `SELECT version, content_hash, skill_id, xp
       FROM content_skill_progress
      WHERE account_id=$1 AND namespace=$2 AND content_hash<>$3 AND xp>0
      ORDER BY version, content_hash, skill_id`,
    [accountId, bundle.namespace, bundle.contentHash],
  )).rows;
  const bundles = new Map();
  const result = [];
  for (const row of rows) {
    if (!bundles.has(row.content_hash)) {
      bundles.set(row.content_hash, await loadBundle(
        client, bundle.namespace, Number(row.version), row.content_hash,
      ));
    }
    const old = bundles.get(row.content_hash);
    const track = old.nodes.find((node) => node.id === row.skill_id && node.type === 'skill_track');
    if (!track) continue;
    const state = skillProjection(track, Number(row.xp));
    result.push({
      version: Number(row.version), contentHash: row.content_hash,
      id: state.id, title: state.title, xp: state.xp, level: state.level, maxLevel: state.maxLevel,
    });
  }
  return result;
}

async function currentQuantities(client, accountId, bundle) {
  const rows = (await client.query(
    `SELECT item_id, SUM(quantity_remaining)::int AS qty
       FROM content_inventory_lots
      WHERE account_id=$1 AND namespace=$2 AND content_hash=$3
      GROUP BY item_id`,
    [accountId, bundle.namespace, bundle.contentHash],
  )).rows;
  return new Map(rows.map((row) => [row.item_id, Number(row.qty)]));
}

async function currentEscrowQuantities(client, accountId, bundle) {
  const rows = (await client.query(
    `SELECT offered_item_id AS item_id, SUM(offered_quantity)::int AS qty
       FROM content_exchange_listings
      WHERE seller_account=$1 AND namespace=$2 AND content_hash=$3 AND status='live'
      GROUP BY offered_item_id`,
    [accountId, bundle.namespace, bundle.contentHash],
  )).rows;
  return new Map(rows.map((row) => [row.item_id, Number(row.qty)]));
}

const quantitiesWithEscrow = (quantities, escrow) => {
  const total = new Map(quantities);
  for (const [itemId, qty] of escrow) {
    total.set(itemId, Number(total.get(itemId) || 0) + Number(qty));
  }
  return total;
};

async function allVersionQuantities(client, accountId, namespace) {
  const rows = (await client.query(
    `SELECT item_id, SUM(quantity_remaining)::int AS qty
       FROM content_inventory_lots
      WHERE account_id=$1 AND namespace=$2
      GROUP BY item_id`,
    [accountId, namespace],
  )).rows;
  const total = new Map(rows.map((row) => [row.item_id, Number(row.qty)]));
  const escrow = (await client.query(
    `SELECT offered_item_id AS item_id, SUM(offered_quantity)::int AS qty
       FROM content_exchange_listings
      WHERE seller_account=$1 AND namespace=$2 AND status='live'
      GROUP BY offered_item_id`,
    [accountId, namespace],
  )).rows;
  for (const row of escrow) {
    total.set(row.item_id, Number(total.get(row.item_id) || 0) + Number(row.qty));
  }
  return total;
}

async function archivedInventory(client, accountId, bundle) {
  const rows = (await client.query(
    `SELECT version, content_hash, item_id, SUM(quantity_remaining)::int AS qty
       FROM content_inventory_lots
      WHERE account_id=$1 AND namespace=$2 AND content_hash<>$3 AND quantity_remaining>0
      GROUP BY version, content_hash, item_id
      ORDER BY version, content_hash, item_id`,
    [accountId, bundle.namespace, bundle.contentHash],
  )).rows;
  const bundles = new Map();
  const result = [];
  for (const row of rows) {
    if (!bundles.has(row.content_hash)) {
      bundles.set(row.content_hash, await loadBundle(
        client, bundle.namespace, Number(row.version), row.content_hash,
      ));
    }
    const old = bundles.get(row.content_hash);
    const definition = old.nodes.find((node) => node.id === row.item_id && node.type === 'item_def');
    result.push({
      version: Number(row.version), contentHash: row.content_hash, itemId: row.item_id,
      title: definition?.payload?.title || row.item_id, quantity: Number(row.qty),
    });
  }
  return result;
}

async function archivedTools(client, accountId, bundle) {
  const rows = (await client.query(
    `SELECT version, content_hash, tool_id, item_id, max_durability, durability_remaining
       FROM content_tool_states
      WHERE account_id=$1 AND namespace=$2 AND content_hash<>$3
      ORDER BY version, content_hash, tool_id`,
    [accountId, bundle.namespace, bundle.contentHash],
  )).rows;
  const bundles = new Map();
  const result = [];
  for (const row of rows) {
    if (!bundles.has(row.content_hash)) {
      bundles.set(row.content_hash, await loadBundle(
        client, bundle.namespace, Number(row.version), row.content_hash,
      ));
    }
    const old = bundles.get(row.content_hash);
    const tool = old.nodes.find((node) => node.id === row.tool_id && node.type === 'tool');
    if (!tool) continue;
    result.push({
      version: Number(row.version), contentHash: row.content_hash,
      id: row.tool_id, title: tool.payload.title, itemId: row.item_id,
      durabilityRemaining: Number(row.durability_remaining),
      maxDurability: Number(row.max_durability),
      broken: Number(row.durability_remaining) < Number(tool.payload.durabilityCost),
    });
  }
  return result;
}

function outputCapBlocks(graph, edges, quantities, allOwned) {
  const blocked = [];
  for (const edge of edges) {
    const item = graph.nodeById.get(edge.to);
    const exactHashCap = item.payload.stackable || item.payload.category === 'authored_tool';
    const owned = Number((exactHashCap ? quantities : allOwned).get(edge.to) || 0);
    if (owned + Number(edge.quantity) > item.payload.maxOwned) {
      blocked.push({
        kind: 'inventory_cap', label: `${item.payload.title} ownership limit`, passed: false,
        itemId: item.id, current: owned, required: item.payload.maxOwned,
      });
    }
  }
  return blocked;
}

function contentSkillBlocks(graph, payload, skillXp) {
  if (payload.skillTrackId === undefined) return [];
  const track = graph.nodeById.get(payload.skillTrackId);
  const current = skillLevelOf(track, Number(skillXp.get(track.id) || 0));
  if (current >= payload.minSkillLevel) return [];
  return [{
    kind: 'skill_level', label: `${track.payload.title} skill level`, passed: false,
    skillId: track.id, current, required: payload.minSkillLevel,
  }];
}

async function activeWorkOrder(client, accountId, namespace, { lock = false } = {}) {
  const row = (await client.query(
    `SELECT * FROM content_work_order_runs
      WHERE account_id=$1 AND namespace=$2 AND status='active'
      ORDER BY started_at, id LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    [accountId, namespace],
  )).rows[0];
  return row || null;
}

function workOrderProjection(row, graph, ch, toolStates) {
  const job = graph.nodeById.get(row.job_id);
  const track = graph.nodeById.get(row.skill_id);
  const readyAt = new Date(row.ready_at);
  const secondsRemaining = Math.max(0, Math.ceil((readyAt.getTime() - Date.now()) / 1000));
  return {
    id: row.id, jobId: row.job_id, title: job?.payload?.title || row.job_id,
    version: Number(row.version), contentHash: row.content_hash,
    status: secondsRemaining === 0 ? 'ready' : 'working', ready: secondsRemaining === 0,
    durationSeconds: Number(job?.payload?.durationSeconds || 0),
    startedAt: new Date(row.started_at).toISOString(), readyAt: readyAt.toISOString(), secondsRemaining,
    inputs: parseJson(row.inputs_json, []), outputs: parseJson(row.outputs_json, []),
    facilities: facilityRequirements(ch, graph, row.job_id),
    tools: toolRequirements(graph, row.job_id, toolStates),
    skill: {
      id: row.skill_id, title: track?.payload?.title || row.skill_id,
      xpReward: Number(row.skill_xp),
    },
    action: {
      method: 'POST',
      path: `/v1/content/${encodeURIComponent(graph.bundle.namespace)}/jobs/${encodeURIComponent(row.job_id)}/collect`,
      body: { expectedContentHash: row.content_hash },
    },
  };
}

async function projectedActiveWorkOrder(ch, client, namespace) {
  const row = await activeWorkOrder(client, ch.account_id, namespace);
  if (!row) return null;
  const bundle = await loadBundle(client, namespace, Number(row.version), row.content_hash);
  const graph = craftingGraphOf(bundle);
  const tools = await currentToolStates(client, ch.account_id, bundle);
  return workOrderProjection(row, graph, ch, tools);
}

async function sourceProjection(ch, client, h, graph, source, quantities, exactOwned, allOwned) {
  const budget = graph.nodeById.get(source.payload.budgetId);
  const epochKey = epochKeyOf(budget);
  const epoch = (await client.query(
    `SELECT units_issued FROM content_source_epochs
      WHERE namespace=$1 AND content_hash=$2 AND source_id=$3 AND epoch_key=$4`,
    [graph.bundle.namespace, graph.bundle.contentHash, source.id, epochKey],
  )).rows[0];
  const claimed = !!(await client.query(
    `SELECT 1 FROM content_source_claims
      WHERE account_id=$1 AND namespace=$2 AND content_hash=$3 AND source_id=$4 AND epoch_key=$5`,
    [ch.account_id, graph.bundle.namespace, graph.bundle.contentHash, source.id, epochKey],
  )).rows[0];
  const outputs = outputEdges(graph, source.id);
  const units = outputs.reduce((sum, edge) => sum + Number(edge.quantity), 0);
  const issued = Number(epoch?.units_issued || 0);
  const remaining = Math.max(0, Number(budget.payload.maxUnitsPerEpoch) - issued);
  const blockedBy = [
    ...blockedGates(ch, h, source.payload.gates, graph),
    ...(claimed ? [{
      kind: 'source_claim', label: 'Source already claimed this epoch', passed: false,
      current: 1, required: 1,
    }] : []),
    ...(remaining < units ? [{
      kind: 'source_exhausted', label: 'Citywide source exhausted', passed: false,
      current: remaining, required: units,
    }] : []),
    ...outputCapBlocks(graph, outputs, exactOwned, allOwned),
  ];
  return {
    id: source.id, title: source.payload.title, epoch: budget.payload.epoch, epochKey,
    globalRemaining: remaining, claimed, eligible: blockedBy.length === 0, blockedBy,
    outputs: safeItems(graph, outputs),
    action: {
      method: 'POST',
      path: `/v1/content/${encodeURIComponent(graph.bundle.namespace)}/sources/${encodeURIComponent(source.id)}/collect`,
      body: { expectedContentHash: graph.bundle.contentHash },
    },
  };
}

function recipeProjection(ch, h, graph, recipe, quantities, exactOwned, allOwned, skillXp, toolStates) {
  const inputs = inputEdges(graph, recipe.id);
  const outputs = outputEdges(graph, recipe.id);
  const missing = safeItems(graph, inputs).map((item) => ({
    ...item, required: item.quantity, owned: Number(quantities.get(item.itemId) || 0),
  })).filter((item) => item.owned < item.required)
    .map(({ quantity: _quantity, ...item }) => item);
  const blockedBy = [
    ...blockedGates(ch, h, recipe.payload.gates, graph),
    ...facilityBlocks(facilityRequirements(ch, graph, recipe.id)),
    ...toolBlocks(toolRequirements(graph, recipe.id, toolStates)),
    ...contentSkillBlocks(graph, recipe.payload, skillXp),
    ...(missing.length ? [{
      kind: 'materials', label: 'Missing authored materials', passed: false,
      current: missing.map((item) => ({ itemId: item.itemId, owned: item.owned })),
      required: missing.map((item) => ({ itemId: item.itemId, quantity: item.required })),
    }] : []),
    ...outputCapBlocks(graph, outputs, exactOwned, allOwned),
  ];
  return {
    id: recipe.id, title: recipe.payload.title, craftable: blockedBy.length === 0, blockedBy,
    inputs: safeItems(graph, inputs), outputs: safeItems(graph, outputs), missing,
    facilities: facilityRequirements(ch, graph, recipe.id),
    tools: toolRequirements(graph, recipe.id, toolStates),
    action: {
      method: 'POST',
      path: `/v1/content/${encodeURIComponent(graph.bundle.namespace)}/recipes/${encodeURIComponent(recipe.id)}/craft`,
      body: { expectedContentHash: graph.bundle.contentHash },
    },
  };
}

function workOrderDefinitionProjection(
  ch, h, graph, job, quantities, exactOwned, allOwned, skillXp, activeRun, toolStates,
) {
  const inputs = inputEdges(graph, job.id);
  const outputs = outputEdges(graph, job.id);
  const train = trainingEdge(graph, job.id);
  const track = graph.nodeById.get(train.to);
  const currentSkillLevel = skillLevelOf(track, Number(skillXp.get(track.id) || 0));
  const missing = safeItems(graph, inputs).map((item) => ({
    ...item, required: item.quantity, owned: Number(quantities.get(item.itemId) || 0),
  })).filter((item) => item.owned < item.required)
    .map(({ quantity: _quantity, ...item }) => item);
  const blockedBy = [
    ...blockedGates(ch, h, job.payload.gates, graph),
    ...facilityBlocks(facilityRequirements(ch, graph, job.id)),
    ...toolBlocks(toolRequirements(graph, job.id, toolStates)),
    ...contentSkillBlocks(graph, job.payload, skillXp),
    ...(activeRun ? [{
      kind: 'job_active', label: 'Another authored work order is active', passed: false,
      current: activeRun.jobId, required: 'none',
    }] : []),
    ...(missing.length ? [{
      kind: 'materials', label: 'Missing authored materials', passed: false,
      current: missing.map((item) => ({ itemId: item.itemId, owned: item.owned })),
      required: missing.map((item) => ({ itemId: item.itemId, quantity: item.required })),
    }] : []),
    ...outputCapBlocks(graph, outputs, exactOwned, allOwned),
  ];
  return {
    id: job.id, title: job.payload.title, durationSeconds: job.payload.durationSeconds,
    startable: blockedBy.length === 0, blockedBy,
    inputs: safeItems(graph, inputs), outputs: safeItems(graph, outputs), missing,
    facilities: facilityRequirements(ch, graph, job.id),
    tools: toolRequirements(graph, job.id, toolStates),
    skill: {
      id: track.id, title: track.payload.title, xpReward: Number(train.quantity),
      minLevel: job.payload.minSkillLevel, currentLevel: currentSkillLevel,
    },
    action: {
      method: 'POST',
      path: `/v1/content/${encodeURIComponent(graph.bundle.namespace)}/jobs/${encodeURIComponent(job.id)}/start`,
      body: { expectedContentHash: graph.bundle.contentHash },
    },
  };
}

function toolDefinitionProjection(ch, graph, tool, quantities, toolStates) {
  const state = toolStates.get(tool.id);
  const inputs = inputEdges(graph, tool.id);
  const missing = safeItems(graph, inputs).map((item) => ({
    ...item, required: item.quantity, owned: Number(quantities.get(item.itemId) || 0),
  })).filter((item) => item.owned < item.required)
    .map(({ quantity: _quantity, ...item }) => item);
  const facilities = facilityRequirements(ch, graph, tool.id);
  const durabilityRemaining = Number(state?.durability_remaining || 0);
  const maxDurability = Number(tool.payload.maxDurability);
  const blockedBy = [
    ...(!state ? [{
      kind: 'tool_missing', label: `${tool.payload.title} is not assembled`, passed: false,
      toolId: tool.id, current: 0, required: 1,
    }] : []),
    ...(state && durabilityRemaining >= maxDurability ? [{
      kind: 'tool_full', label: `${tool.payload.title} is already fully repaired`, passed: false,
      toolId: tool.id, current: durabilityRemaining, required: maxDurability,
    }] : []),
    ...facilityBlocks(facilities),
    ...(missing.length ? [{
      kind: 'materials', label: 'Missing authored repair materials', passed: false,
      current: missing.map((item) => ({ itemId: item.itemId, owned: item.owned })),
      required: missing.map((item) => ({ itemId: item.itemId, quantity: item.required })),
    }] : []),
  ];
  return {
    id: tool.id, title: tool.payload.title, itemId: tool.payload.itemId,
    owned: !!state, durabilityRemaining, maxDurability,
    durabilityCost: Number(tool.payload.durabilityCost),
    broken: !!state && durabilityRemaining < Number(tool.payload.durabilityCost),
    repairable: blockedBy.length === 0, blockedBy,
    repairInputs: safeItems(graph, inputs), missing, facilities,
    action: {
      method: 'POST',
      path: `/v1/content/${encodeURIComponent(graph.bundle.namespace)}/tools/${encodeURIComponent(tool.id)}/repair`,
      body: { expectedContentHash: graph.bundle.contentHash },
    },
  };
}

export async function projectWorkshop(ch, client, h, bundle) {
  const graph = craftingGraphOf(bundle);
  const quantities = await currentQuantities(client, ch.account_id, bundle);
  const escrow = await currentEscrowQuantities(client, ch.account_id, bundle);
  const exactOwned = quantitiesWithEscrow(quantities, escrow);
  const allOwned = await allVersionQuantities(client, ch.account_id, bundle.namespace);
  const skillXp = await currentSkillXp(client, ch.account_id, bundle);
  const toolStates = await currentToolStates(client, ch.account_id, bundle);
  const activeJob = await projectedActiveWorkOrder(ch, client, bundle.namespace);
  const itemNodes = graph.crafting.nodeIds.map((id) => graph.nodeById.get(id))
    .filter((node) => node.type === 'item_def')
    .sort((a, b) => a.id.localeCompare(b.id));
  const sources = [];
  for (const id of graph.crafting.sourceIds) {
    sources.push(await sourceProjection(
      ch, client, h, graph, graph.nodeById.get(id), quantities, exactOwned, allOwned,
    ));
  }
  return {
    namespace: bundle.namespace, version: Number(bundle.version), contentHash: bundle.contentHash,
    title: graph.crafting.title,
    inventory: itemNodes.map((item) => ({
      id: item.id, title: item.payload.title, category: item.payload.category,
      stackable: item.payload.stackable, maxOwned: item.payload.maxOwned,
      quantity: Number(quantities.get(item.id) || 0),
      escrowed: Number(escrow.get(item.id) || 0), tradeable: item.payload.tradeable,
      ownedAcrossVersions: Number(allOwned.get(item.id) || 0),
    })),
    archivedInventory: await archivedInventory(client, ch.account_id, bundle),
    skills: (graph.crafting.skillTrackIds ?? []).map((id) => skillProjection(
      graph.nodeById.get(id), Number(skillXp.get(id) || 0),
    )),
    archivedSkills: await archivedSkills(client, ch.account_id, bundle),
    facilities: (graph.crafting.facilityIds ?? []).map((id) => facilityProjection(
      ch, graph, graph.nodeById.get(id),
    )),
    tools: (graph.crafting.toolIds ?? []).map((id) => toolDefinitionProjection(
      ch, graph, graph.nodeById.get(id), quantities, toolStates,
    )),
    archivedTools: await archivedTools(client, ch.account_id, bundle),
    activeJob,
    sources,
    recipes: graph.crafting.recipeIds.map((id) => recipeProjection(
      ch, h, graph, graph.nodeById.get(id), quantities, exactOwned, allOwned, skillXp, toolStates,
    )),
    jobs: (graph.crafting.jobIds ?? []).map((id) => workOrderDefinitionProjection(
      ch, h, graph, graph.nodeById.get(id), quantities, exactOwned, allOwned,
      skillXp, activeJob, toolStates,
    )),
  };
}

export async function craftingBoard(ch, client, h) {
  const activations = (await client.query(
    'SELECT namespace, version, content_hash FROM content_activations ORDER BY namespace',
  )).rows;
  const workshops = [];
  for (const active of activations) {
    const row = (await client.query(
      `SELECT bundle_json FROM content_bundles
        WHERE namespace=$1 AND version=$2 AND content_hash=$3`,
      [active.namespace, Number(active.version), active.content_hash],
    )).rows[0];
    const bundle = parseJson(row?.bundle_json, null);
    if (!bundle?.crafting) continue;
    workshops.push(await projectWorkshop(ch, client, h, validateCraftingContentPack(bundle)));
  }
  return workshops;
}

async function activeGraph(ch, namespace, expectedContentHash, client, h) {
  const bundle = await loadActiveBundle(client, namespace);
  if (bundle.contentHash !== expectedContentHash) {
    fail('stale_content', 'The active authored workshop changed; refresh before acting.', {
      workshop: await projectWorkshop(ch, client, h, bundle),
    });
  }
  return craftingGraphOf(bundle);
}

async function assertContentSkill(client, ch, graph, payload) {
  if (payload.skillTrackId === undefined) return;
  const track = graph.nodeById.get(payload.skillTrackId);
  const xp = await currentSkillXp(client, ch.account_id, graph.bundle);
  const current = skillLevelOf(track, Number(xp.get(track.id) || 0));
  if (current < payload.minSkillLevel) {
    fail('skill_level', `${track.payload.title} level ${payload.minSkillLevel} is required.`, {
      blockedBy: [{
        kind: 'skill_level', label: `${track.payload.title} skill level`, passed: false,
        skillId: track.id, current, required: payload.minSkillLevel,
      }],
    });
  }
}

async function ownedAcrossVersions(client, accountId, namespace, itemId) {
  const row = (await client.query(
    `SELECT COALESCE(SUM(quantity_remaining),0)::int AS qty
       FROM content_inventory_lots WHERE account_id=$1 AND namespace=$2 AND item_id=$3`,
    [accountId, namespace, itemId],
  )).rows[0];
  const escrow = (await client.query(
    `SELECT COALESCE(SUM(offered_quantity),0)::int AS qty
       FROM content_exchange_listings
      WHERE seller_account=$1 AND namespace=$2 AND offered_item_id=$3 AND status='live'`,
    [accountId, namespace, itemId],
  )).rows[0];
  return Number(row?.qty || 0) + Number(escrow?.qty || 0);
}

async function assertOutputCapacity(client, ch, graph, edges) {
  const current = await currentQuantities(client, ch.account_id, graph.bundle);
  const exactOwned = quantitiesWithEscrow(
    current, await currentEscrowQuantities(client, ch.account_id, graph.bundle),
  );
  for (const edge of edges) {
    const item = graph.nodeById.get(edge.to);
    const owned = item.payload.stackable || item.payload.category === 'authored_tool'
      ? Number(exactOwned.get(edge.to) || 0)
      : await ownedAcrossVersions(client, ch.account_id, graph.bundle.namespace, edge.to);
    if (owned + Number(edge.quantity) > item.payload.maxOwned) {
      fail('owned_limit', `You already hold the authored limit for ${item.payload.title}.`, {
        itemId: item.id, owned, maxOwned: item.payload.maxOwned,
      });
    }
  }
}

function assertFacilities(ch, graph, actionId) {
  const blocked = facilityBlocks(facilityRequirements(ch, graph, actionId));
  if (!blocked.length) return;
  const first = blocked[0];
  fail('wrong_location', `Travel to ${first.location.title} to use ${first.label}.`, {
    facilityId: first.facilityId, location: first.location, blockedBy: blocked,
  });
}

async function consumeToolWear(client, ch, graph, actionId, authorityId) {
  const edges = toolEdges(graph, actionId);
  const checked = [];
  for (const edge of edges) {
    const tool = graph.nodeById.get(edge.to);
    const row = (await client.query(
      `SELECT * FROM content_tool_states
        WHERE account_id=$1 AND namespace=$2 AND content_hash=$3 AND tool_id=$4
        FOR UPDATE`,
      [ch.account_id, graph.bundle.namespace, graph.bundle.contentHash, tool.id],
    )).rows[0];
    if (!row) {
      fail('tool_missing', `${tool.payload.title} must be assembled for that work.`, {
        blockedBy: [{
          kind: 'tool_missing', label: `${tool.payload.title} required`, passed: false,
          toolId: tool.id, current: 0, required: Number(tool.payload.durabilityCost),
        }],
      });
    }
    const before = Number(row.durability_remaining);
    const cost = Number(tool.payload.durabilityCost);
    if (before < cost) {
      fail('tool_broken', `${tool.payload.title} must be repaired for that work.`, {
        blockedBy: [{
          kind: 'tool_broken', label: `${tool.payload.title} needs repair`, passed: false,
          toolId: tool.id, current: before, required: cost,
        }],
      });
    }
    checked.push({ tool, row, before, after: before - cost });
  }
  for (const entry of checked) {
    await client.query(
      `UPDATE content_tool_states
          SET durability_remaining=$5, updated_at=now()
        WHERE account_id=$1 AND namespace=$2 AND content_hash=$3 AND tool_id=$4`,
      [ch.account_id, graph.bundle.namespace, graph.bundle.contentHash,
        entry.tool.id, entry.after],
    );
    await client.query(
      `INSERT INTO content_tool_events
         (id, account_id, namespace, version, content_hash, tool_id, item_id,
          event_kind, action_id, durability_before, durability_after)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'use',$8,$9,$10)`,
      [crypto.randomUUID(), ch.account_id, graph.bundle.namespace, graph.bundle.version,
        graph.bundle.contentHash, entry.tool.id, entry.tool.payload.itemId,
        authorityId, entry.before, entry.after],
    );
  }
}

export async function insertContentLot(client, {
  accountId, namespace, version, contentHash, itemId, quantity, acquiredVia, authorityId,
}) {
  await client.query(
    `INSERT INTO content_inventory_lots
       (id, account_id, namespace, version, content_hash, item_id,
        quantity_initial, quantity_remaining, acquired_via, authority_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9)`,
    [crypto.randomUUID(), accountId, namespace, version, contentHash, itemId,
      Number(quantity), acquiredVia, authorityId],
  );
}

async function insertLots(client, ch, graph, edges, acquiredVia, authorityId) {
  for (const edge of edges) {
    await insertContentLot(client, {
      accountId: ch.account_id, namespace: graph.bundle.namespace, version: graph.bundle.version,
      contentHash: graph.bundle.contentHash, itemId: edge.to, quantity: Number(edge.quantity),
      acquiredVia, authorityId,
    });
  }
}

async function acquireOutputTools(client, ch, graph, edges, authorityId) {
  for (const edge of edges) {
    const toolId = (graph.crafting.toolIds ?? []).find((id) => (
      graph.nodeById.get(id).payload.itemId === edge.to
    ));
    if (!toolId) continue;
    const tool = graph.nodeById.get(toolId);
    const max = Number(tool.payload.maxDurability);
    await client.query(
      `INSERT INTO content_tool_states
         (account_id, namespace, version, content_hash, tool_id, item_id,
          max_durability, durability_remaining)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$7)`,
      [ch.account_id, graph.bundle.namespace, graph.bundle.version, graph.bundle.contentHash,
        tool.id, tool.payload.itemId, max],
    );
    await client.query(
      `INSERT INTO content_tool_events
         (id, account_id, namespace, version, content_hash, tool_id, item_id,
          event_kind, action_id, durability_before, durability_after)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'acquire',$8,0,$9)`,
      [crypto.randomUUID(), ch.account_id, graph.bundle.namespace, graph.bundle.version,
        graph.bundle.contentHash, tool.id, tool.payload.itemId, authorityId, max],
    );
  }
}

export async function collectContentSource(ch, namespace, sourceId, opts, client, h) {
  const graph = await activeGraph(ch, namespace, String(opts?.expectedContentHash || ''), client, h);
  if (!graph.crafting.sourceIds.includes(sourceId)) fail('bad_source', 'That source is not executable.');
  const source = graph.nodeById.get(sourceId);
  assertNodeGates(ch, h, source, graph);
  const budget = graph.nodeById.get(source.payload.budgetId);
  const epochKey = epochKeyOf(budget);
  const claimed = (await client.query(
    `SELECT 1 FROM content_source_claims
      WHERE account_id=$1 AND namespace=$2 AND content_hash=$3 AND source_id=$4 AND epoch_key=$5`,
    [ch.account_id, graph.bundle.namespace, graph.bundle.contentHash, source.id, epochKey],
  )).rows[0];
  if (claimed) fail('already_collected', 'You already worked that source this epoch.');
  const outputs = outputEdges(graph, source.id);
  await assertOutputCapacity(client, ch, graph, outputs);
  const units = outputs.reduce((sum, edge) => sum + Number(edge.quantity), 0);
  await client.query(
    `INSERT INTO content_source_epochs
       (namespace, version, content_hash, source_id, epoch_key, units_issued)
     VALUES ($1,$2,$3,$4,$5,0) ON CONFLICT DO NOTHING`,
    [graph.bundle.namespace, graph.bundle.version, graph.bundle.contentHash, source.id, epochKey],
  );
  const epoch = (await client.query(
    `SELECT units_issued FROM content_source_epochs
      WHERE namespace=$1 AND content_hash=$2 AND source_id=$3 AND epoch_key=$4 FOR UPDATE`,
    [graph.bundle.namespace, graph.bundle.contentHash, source.id, epochKey],
  )).rows[0];
  if (Number(epoch.units_issued) + units > Number(budget.payload.maxUnitsPerEpoch)) {
    fail('source_exhausted', 'That authored source is exhausted for this epoch.');
  }
  const receiptId = crypto.randomUUID();
  const safeOutputs = safeItems(graph, outputs);
  await client.query(
    `INSERT INTO content_source_claims
       (account_id, namespace, version, content_hash, source_id, epoch_key, receipt_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [ch.account_id, graph.bundle.namespace, graph.bundle.version, graph.bundle.contentHash,
      source.id, epochKey, receiptId],
  );
  await client.query(
    `UPDATE content_source_epochs SET units_issued=units_issued+$5, updated_at=now()
      WHERE namespace=$1 AND content_hash=$2 AND source_id=$3 AND epoch_key=$4`,
    [graph.bundle.namespace, graph.bundle.contentHash, source.id, epochKey, units],
  );
  await insertLots(client, ch, graph, outputs, 'source', source.id);
  await client.query(
    `INSERT INTO content_supply_receipts
       (id, account_id, namespace, version, content_hash, action_kind, action_id,
        epoch_key, inputs_json, outputs_json)
     VALUES ($1,$2,$3,$4,$5,'source',$6,$7,'[]',$8)`,
    [receiptId, ch.account_id, graph.bundle.namespace, graph.bundle.version,
      graph.bundle.contentHash, source.id, epochKey, JSON.stringify(safeOutputs)],
  );
  return {
    ok: true,
    receipt: {
      id: receiptId, kind: 'source', actionId: source.id, epochKey,
      inputs: [], outputs: safeOutputs,
    },
    workshop: await projectWorkshop(ch, client, h, graph.bundle),
  };
}

export async function consumeContentLots(client, {
  accountId, namespace, contentHash, itemId, quantity,
}) {
  let remaining = Number(quantity);
  const consumed = [];
  const rows = (await client.query(
    `SELECT id, quantity_remaining FROM content_inventory_lots
      WHERE account_id=$1 AND namespace=$2 AND content_hash=$3 AND item_id=$4
        AND quantity_remaining>0
      ORDER BY created_at, id FOR UPDATE`,
    [accountId, namespace, contentHash, itemId],
  )).rows;
  for (const row of rows) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, Number(row.quantity_remaining));
    const left = Number(row.quantity_remaining) - take;
    await client.query(
      `UPDATE content_inventory_lots
          SET quantity_remaining=$2, exhausted_at=CASE WHEN $2=0 THEN now() ELSE NULL END
        WHERE id=$1`,
      [row.id, left],
    );
    consumed.push({ lotId: row.id, quantity: take });
    remaining -= take;
  }
  if (remaining > 0) fail('materials', 'The authored material inventory changed; refresh and try again.');
  return consumed;
}

async function consumeLots(client, ch, graph, edge) {
  return consumeContentLots(client, {
    accountId: ch.account_id, namespace: graph.bundle.namespace,
    contentHash: graph.bundle.contentHash, itemId: edge.to, quantity: Number(edge.quantity),
  });
}

export async function startContentWorkOrder(ch, namespace, jobId, opts, client, h) {
  const graph = await activeGraph(ch, namespace, String(opts?.expectedContentHash || ''), client, h);
  if (!(graph.crafting.jobIds ?? []).includes(jobId)) fail('bad_job', 'That work order is not executable.');
  const job = graph.nodeById.get(jobId);
  assertNodeGates(ch, h, job, graph);
  assertFacilities(ch, graph, job.id);
  await assertContentSkill(client, ch, graph, job.payload);
  const active = await activeWorkOrder(client, ch.account_id, namespace, { lock: true });
  if (active) {
    fail('job_active', 'This workshop already has work under way.', {
      runId: active.id, jobId: active.job_id, readyAt: new Date(active.ready_at).toISOString(),
    });
  }
  const inputs = inputEdges(graph, job.id);
  const outputs = outputEdges(graph, job.id);
  const train = trainingEdge(graph, job.id);
  const quantities = await currentQuantities(client, ch.account_id, graph.bundle);
  const missing = safeItems(graph, inputs).map((item) => ({
    itemId: item.itemId, title: item.title, required: item.quantity,
    owned: Number(quantities.get(item.itemId) || 0),
  })).filter((item) => item.owned < item.required);
  if (missing.length) fail('materials', 'You do not hold the exact-hash materials for that work order.', { missing });
  await assertOutputCapacity(client, ch, graph, outputs);
  const id = crypto.randomUUID();
  await consumeToolWear(client, ch, graph, job.id, id);
  for (const edge of inputs) await consumeLots(client, ch, graph, edge);
  const startedAt = new Date();
  const readyAt = new Date(startedAt.getTime() + Number(job.payload.durationSeconds) * 1000);
  const safeInputs = safeItems(graph, inputs);
  const safeOutputs = safeItems(graph, outputs);
  const row = (await client.query(
    `INSERT INTO content_work_order_runs
       (id, account_id, namespace, version, content_hash, job_id, skill_id, skill_xp,
        inputs_json, outputs_json, started_at, ready_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [id, ch.account_id, graph.bundle.namespace, graph.bundle.version, graph.bundle.contentHash,
      job.id, train.to, Number(train.quantity), JSON.stringify(safeInputs), JSON.stringify(safeOutputs),
      startedAt, readyAt],
  )).rows[0];
  return {
    ok: true,
    run: workOrderProjection(
      row, graph, ch, await currentToolStates(client, ch.account_id, graph.bundle),
    ),
    workshop: await projectWorkshop(ch, client, h, graph.bundle),
  };
}

export async function finishContentWorkOrder(ch, namespace, jobId, opts, client, h) {
  const run = await activeWorkOrder(client, ch.account_id, namespace, { lock: true });
  if (!run || run.job_id !== jobId) fail('no_job', 'No matching authored work order is active.');
  const expectedContentHash = String(opts?.expectedContentHash || '');
  if (run.content_hash !== expectedContentHash) {
    const activeBundle = await loadActiveBundle(client, namespace);
    fail('stale_content', 'The work order is pinned to a different authored content hash.', {
      workshop: await projectWorkshop(ch, client, h, activeBundle),
    });
  }
  const bundle = await loadBundle(client, namespace, Number(run.version), run.content_hash);
  const graph = craftingGraphOf(bundle);
  if (!(graph.crafting.jobIds ?? []).includes(jobId)) {
    fail('unsupported_content_feature', 'The pinned work order is unavailable in its immutable bundle.');
  }
  const readyAt = new Date(run.ready_at);
  if (readyAt.getTime() > Date.now()) {
    fail('job_running', 'That authored work order is still under way.', {
      readyAt: readyAt.toISOString(),
      secondsRemaining: Math.max(1, Math.ceil((readyAt.getTime() - Date.now()) / 1000)),
    });
  }
  const job = graph.nodeById.get(jobId);
  const outputs = outputEdges(graph, job.id);
  await assertOutputCapacity(client, ch, graph, outputs);
  await insertLots(client, ch, graph, outputs, 'work_order', job.id);
  const track = graph.nodeById.get(run.skill_id);
  const progress = (await client.query(
    `SELECT xp FROM content_skill_progress
      WHERE account_id=$1 AND namespace=$2 AND content_hash=$3 AND skill_id=$4 FOR UPDATE`,
    [ch.account_id, namespace, run.content_hash, run.skill_id],
  )).rows[0];
  const beforeXp = Number(progress?.xp || 0);
  const maxXp = Number(track.payload.thresholds.at(-1));
  const afterXp = Math.min(maxXp, beforeXp + Number(run.skill_xp));
  await client.query(
    `INSERT INTO content_skill_progress
       (account_id, namespace, version, content_hash, skill_id, xp)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (account_id, namespace, content_hash, skill_id)
     DO UPDATE SET xp=$6, updated_at=now()`,
    [ch.account_id, namespace, Number(run.version), run.content_hash, run.skill_id, afterXp],
  );
  await client.query(
    `UPDATE content_work_order_runs
        SET status='collected', collected_at=now()
      WHERE id=$1`,
    [run.id],
  );
  const currentBundle = await loadActiveBundle(client, namespace);
  const state = skillProjection(track, afterXp);
  return {
    ok: true,
    receipt: {
      id: run.id, kind: 'job', actionId: job.id, contentHash: run.content_hash,
      inputs: parseJson(run.inputs_json, []), outputs: parseJson(run.outputs_json, []),
      skill: {
        id: state.id, title: state.title, xpAwarded: afterXp - beforeXp,
        xp: state.xp, level: state.level, maxLevel: state.maxLevel,
      },
    },
    workshop: await projectWorkshop(ch, client, h, currentBundle),
  };
}

export async function craftContentRecipe(ch, namespace, recipeId, opts, client, h) {
  const graph = await activeGraph(ch, namespace, String(opts?.expectedContentHash || ''), client, h);
  if (!graph.crafting.recipeIds.includes(recipeId)) fail('bad_recipe', 'That recipe is not executable.');
  const recipe = graph.nodeById.get(recipeId);
  assertNodeGates(ch, h, recipe, graph);
  assertFacilities(ch, graph, recipe.id);
  await assertContentSkill(client, ch, graph, recipe.payload);
  const inputs = inputEdges(graph, recipe.id);
  const outputs = outputEdges(graph, recipe.id);
  await assertOutputCapacity(client, ch, graph, outputs);
  const quantities = await currentQuantities(client, ch.account_id, graph.bundle);
  const missing = safeItems(graph, inputs).map((item) => ({
    itemId: item.itemId, title: item.title, required: item.quantity,
    owned: Number(quantities.get(item.itemId) || 0),
  })).filter((item) => item.owned < item.required);
  if (missing.length) fail('materials', 'You do not hold the exact-hash materials for that recipe.', { missing });
  const receiptId = crypto.randomUUID();
  await consumeToolWear(client, ch, graph, recipe.id, receiptId);
  for (const edge of inputs) await consumeLots(client, ch, graph, edge);
  await insertLots(client, ch, graph, outputs, 'recipe', recipe.id);
  await acquireOutputTools(client, ch, graph, outputs, receiptId);
  const safeInputs = safeItems(graph, inputs);
  const safeOutputs = safeItems(graph, outputs);
  await client.query(
    `INSERT INTO content_supply_receipts
       (id, account_id, namespace, version, content_hash, action_kind, action_id,
        inputs_json, outputs_json)
     VALUES ($1,$2,$3,$4,$5,'recipe',$6,$7,$8)`,
    [receiptId, ch.account_id, graph.bundle.namespace, graph.bundle.version,
      graph.bundle.contentHash, recipe.id, JSON.stringify(safeInputs), JSON.stringify(safeOutputs)],
  );
  return {
    ok: true,
    receipt: {
      id: receiptId, kind: 'recipe', actionId: recipe.id,
      inputs: safeInputs, outputs: safeOutputs,
    },
    workshop: await projectWorkshop(ch, client, h, graph.bundle),
  };
}

export async function repairContentTool(ch, namespace, toolId, opts, client, h) {
  const graph = await activeGraph(ch, namespace, String(opts?.expectedContentHash || ''), client, h);
  if (!(graph.crafting.toolIds ?? []).includes(toolId)) fail('bad_tool', 'That authored tool is not repairable.');
  const tool = graph.nodeById.get(toolId);
  assertFacilities(ch, graph, tool.id);
  const state = (await client.query(
    `SELECT * FROM content_tool_states
      WHERE account_id=$1 AND namespace=$2 AND content_hash=$3 AND tool_id=$4
      FOR UPDATE`,
    [ch.account_id, graph.bundle.namespace, graph.bundle.contentHash, tool.id],
  )).rows[0];
  if (!state) fail('tool_missing', `${tool.payload.title} has not been assembled for this workshop version.`);
  const before = Number(state.durability_remaining);
  const max = Number(state.max_durability);
  if (before >= max) fail('tool_full', `${tool.payload.title} is already fully repaired.`);
  const inputs = inputEdges(graph, tool.id);
  const quantities = await currentQuantities(client, ch.account_id, graph.bundle);
  const missing = safeItems(graph, inputs).map((item) => ({
    itemId: item.itemId, title: item.title, required: item.quantity,
    owned: Number(quantities.get(item.itemId) || 0),
  })).filter((item) => item.owned < item.required);
  if (missing.length) fail('materials', 'You do not hold the exact-hash materials for that repair.', { missing });
  const receiptId = crypto.randomUUID();
  for (const edge of inputs) await consumeLots(client, ch, graph, edge);
  await client.query(
    `UPDATE content_tool_states
        SET durability_remaining=$5, updated_at=now()
      WHERE account_id=$1 AND namespace=$2 AND content_hash=$3 AND tool_id=$4`,
    [ch.account_id, graph.bundle.namespace, graph.bundle.contentHash, tool.id, max],
  );
  await client.query(
    `INSERT INTO content_tool_events
       (id, account_id, namespace, version, content_hash, tool_id, item_id,
        event_kind, action_id, durability_before, durability_after)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'repair',$8,$9,$10)`,
    [crypto.randomUUID(), ch.account_id, graph.bundle.namespace, graph.bundle.version,
      graph.bundle.contentHash, tool.id, tool.payload.itemId, receiptId, before, max],
  );
  const safeInputs = safeItems(graph, inputs);
  return {
    ok: true,
    receipt: {
      id: receiptId, kind: 'tool_repair', actionId: tool.id,
      contentHash: graph.bundle.contentHash, inputs: safeInputs,
      tool: {
        id: tool.id, title: tool.payload.title, itemId: tool.payload.itemId,
        durabilityBefore: before, durabilityAfter: max, maxDurability: max,
      },
    },
    workshop: await projectWorkshop(ch, client, h, graph.bundle),
  };
}
