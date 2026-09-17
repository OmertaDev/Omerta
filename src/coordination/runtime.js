// Coordination Phase 0: private, value-neutral runs. Existing item/content/economy
// runtimes retain their own authority; this service cannot invoke their mutations.
import crypto from 'node:crypto';
import { GameError } from '../game.js';
import { levelOf } from '../rules.js';
import { canonicalBytes } from '../content/canonical.js';
import { withPhase2Read, withPhase2Transaction, registerPhase2Undo } from '../content/phase2-transactions.js';
import { compileCoordinationGraph, coordinationGraph, coordinationGraphs, evaluateRule } from './graph.js';
import { createCoordinationKnowledge } from './knowledge.js';
import { createWorldPrerequisites, prerequisiteMatches, prerequisiteReceipt } from '../world-prerequisites.js';
import { worldPrerequisiteKey } from '../world-knowledge.js';

const fail = (code) => { throw new GameError(code, 'The coordination request could not complete.'); };
const hash = (value) => crypto.createHash('sha256').update(canonicalBytes(value)).digest('hex');
const parse = (value) => typeof value === 'string' ? JSON.parse(value) : value;
const iso = (value) => new Date(value).toISOString();
const TYPES = new Set(['coordination.created', 'coordination.node.discovered',
  'coordination.node.completed', 'coordination.completed', 'coordination.cancelled']);

function textId(value) {
  if (typeof value !== 'string' || !/^[\x21-\x7e]{1,200}$/.test(value)) {
    fail('bad_coordination_request');
  }
  return value;
}
function body(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).length !== fields.length
      || fields.some((field) => !Object.hasOwn(value, field))) fail('bad_coordination_request');
  if (fields.includes('expectedRevision')
      && (!Number.isSafeInteger(value.expectedRevision) || value.expectedRevision < 0)) fail('bad_coordination_request');
  if (fields.includes('expectedContentHash') && (typeof value.expectedContentHash !== 'string'
      || !/^[a-f0-9]{64}$/.test(value.expectedContentHash))) fail('bad_coordination_request');
  if (fields.includes('actionId')) textId(value.actionId);
  return value;
}

// Match the existing street lock order. The account lock also serializes command
// keys and new runs for the same account; every actor predicate comes from SQL.
async function actor(client, accountId, lock = false) {
  textId(accountId);
  let ch = (await client.query(
    `SELECT id, account_id, respect, loc, alive FROM characters
      WHERE account_id=$1 AND alive=true${lock ? ' FOR UPDATE' : ''}`, [accountId],
  )).rows[0] || null;
  // READ COMMITTED can wait on a dying street and then return no row: the heir
  // inserted by that transaction was not in the first statement's snapshot.
  if (lock && !ch) ch = (await client.query(
    'SELECT id, account_id, respect, loc, alive FROM characters WHERE account_id=$1 AND alive=true FOR UPDATE',
    [accountId],
  )).rows[0] || null;
  const account = (await client.query(
    `SELECT id, status FROM accounts WHERE id=$1${lock ? ' FOR UPDATE' : ''}`, [accountId],
  )).rows[0];
  if (!account || account.status !== 'active') fail('coordination_unavailable');
  return ch;
}

function verifiedDefinition(row) {
  let graph;
  try { graph = compileCoordinationGraph(parse(row.definition_json)); }
  catch { fail('coordination_corrupt'); }
  if (graph.id !== row.graph_id || graph.version !== Number(row.graph_version)
      || graph.contentHash !== row.content_hash) fail('coordination_corrupt');
  return graph;
}
async function loadDefinition(client, instance) {
  const row = (await client.query(
    'SELECT * FROM coordination_definitions WHERE graph_id=$1 AND graph_version=$2',
    [instance.graph_id, instance.graph_version],
  )).rows[0];
  if (!row || row.content_hash !== instance.content_hash) fail('coordination_corrupt');
  return verifiedDefinition(row);
}
async function persistDefinition(client, graph) {
  const prior = (await client.query(
    'SELECT * FROM coordination_definitions WHERE graph_id=$1 AND graph_version=$2', [graph.id, graph.version],
  )).rows[0];
  if (!prior) {
    const { contentHash, ...source } = graph;
    await client.query(
      `INSERT INTO coordination_definitions (graph_id, graph_version, content_hash, definition_json)
       VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      [graph.id, graph.version, contentHash, JSON.stringify(source)],
    );
    registerPhase2Undo(client, () => client.query(
      'DELETE FROM coordination_definitions WHERE graph_id=$1 AND graph_version=$2', [graph.id, graph.version],
    ));
  }
  const row = prior || (await client.query(
    'SELECT * FROM coordination_definitions WHERE graph_id=$1 AND graph_version=$2', [graph.id, graph.version],
  )).rows[0];
  if (verifiedDefinition(row).contentHash !== graph.contentHash) fail('coordination_version_conflict');
}

function stateOf(instance, graph) {
  let state;
  try { state = parse(instance.state_json); } catch { fail('coordination_corrupt'); }
  const ids = new Set(graph.nodes.map((node) => node.id));
  if (!state || Object.keys(state).sort().join(',') !== 'completed,discovered'
      || !['completed', 'discovered'].every((key) => Array.isArray(state[key])
        && new Set(state[key]).size === state[key].length && state[key].every((id) => ids.has(id)))
      || state.completed.some((id) => !state.discovered.includes(id))) fail('coordination_corrupt');
  return state;
}
function ruleState(instance, state, ch, now, evidence) {
  return { completed: new Set(state.completed), level: ch ? levelOf(Number(ch.respect)) : null,
    district: ch?.loc ?? null,
    contentHash: instance.content_hash, evidence,
    elapsedSeconds: Math.max(0, Math.floor((now - new Date(instance.created_at).getTime()) / 1000)) };
}
function actionsFor(instance, graph, state, ch, now, enabled, evidence = new Map(), admitted = new Set()) {
  if (!enabled || !ch || ch.id !== instance.owner_character_id || instance.status !== 'active') return [];
  const context = ruleState(instance, state, ch, now, evidence);
  const actions = [];
  for (const node of graph.nodes) {
    if (state.completed.includes(node.id)) continue;
    if (node.admission?.length && !admitted.has(node.id)) continue;
    const discovered = state.discovered.includes(node.id);
    let kind;
    if (node.visibility === 'hidden' && !discovered) {
      if (evaluateRule(node.discover, context)) kind = 'discover';
    } else if ((discovered || evaluateRule(node.discover, context)) && evaluateRule(node.requires, context)) {
      kind = 'complete';
    }
    if (kind) actions.push({ node, kind, id: `coord_${hash([
      'omerta:coordination:action:v1', instance.id, Number(instance.revision), instance.content_hash, kind, node.id,
    ])}` });
  }
  return actions;
}
function project(instance, graph, ch, now, enabled, evidence = new Map(), admitted = new Set()) {
  const state = stateOf(instance, graph);
  const actions = actionsFor(instance, graph, state, ch, now, enabled, evidence, admitted);
  const nodes = graph.nodes.filter((node) => node.visibility === 'public' || state.discovered.includes(node.id))
    .map((node) => ({ id: node.id, title: node.title, ...(node.description ? { description: node.description } : {}),
      status: state.completed.includes(node.id) ? 'completed'
        : actions.some((action) => action.node.id === node.id && action.kind === 'complete') ? 'available' : 'blocked' }));
  return { id: instance.id, graphId: graph.id, graphVersion: graph.version, contentHash: graph.contentHash,
    title: graph.title, status: instance.status, revision: Number(instance.revision),
    createdAt: iso(instance.created_at), updatedAt: iso(instance.updated_at),
    historical: !ch || ch.id !== instance.owner_character_id,
    nodes, actions: actions.map(({ id, kind, node }) => ({ id, kind,
      label: kind === 'discover' ? 'Follow a lead' : `Complete: ${node.title}`,
      ...(kind === 'complete' ? { nodeId: node.id } : {}) })),
    canCancel: instance.status === 'active', directOnly: true };
}
async function ownedInstance(client, accountId, id, lock = false) {
  textId(id);
  const row = (await client.query(
    `SELECT * FROM coordination_instances WHERE id=$1 AND owner_account_id=$2${lock ? ' FOR UPDATE' : ''}`,
    [id, accountId],
  )).rows[0];
  if (!row) fail('coordination_unavailable');
  return row;
}
async function event(client, instance, accountId, commandId, type, payload, ordinal, now, actorCharacterId = instance.owner_character_id) {
  if (!TYPES.has(type)) fail('coordination_corrupt');
  const id = crypto.randomUUID();
  await client.query(
    `INSERT INTO coordination_events
       (id, event_type, event_version, instance_id, revision, ordinal, content_hash,
        actor_account_id, actor_character_id, correlation_id, payload_json, occurred_at)
     VALUES ($1,$2,1,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [id, type, instance.id, instance.revision, ordinal, instance.content_hash, accountId,
      actorCharacterId, commandId, JSON.stringify(payload), new Date(now)],
  );
  registerPhase2Undo(client, () => client.query('DELETE FROM coordination_events WHERE id=$1', [id]));
  return id;
}
async function saveInstance(client, prior, next) {
  const changed = await client.query(
    `UPDATE coordination_instances SET state_json=$2, status=$3, revision=$4, updated_at=$5
     WHERE id=$1 AND revision=$6`,
    [next.id, next.state_json, next.status, next.revision, next.updated_at, prior.revision],
  );
  if (changed.rowCount !== 1) fail('stale_coordination');
  registerPhase2Undo(client, () => client.query(
    'UPDATE coordination_instances SET state_json=$2, status=$3, revision=$4, updated_at=$5 WHERE id=$1',
    [prior.id, prior.state_json, prior.status, prior.revision, prior.updated_at],
  ));
}

export function createCoordinationService({ pool, registry, enabled = false, accountIds = [],
  knowledgeEnabled = false, sharingEnabled = false, prerequisitesEnabled = false }) {
  coordinationGraphs(registry); // Reject forged registries at the trusted construction boundary.
  if ([enabled, knowledgeEnabled, sharingEnabled, prerequisitesEnabled].some((value) => typeof value !== 'boolean')
      || !Array.isArray(accountIds) || accountIds.some((id) => textId(id) !== id)) {
    throw new TypeError('Invalid coordination rollout policy');
  }
  const cohort = new Set(accountIds);
  const allowed = (id) => enabled && (!cohort.size || cohort.has(id));
  const knowledgeAllowed = (id) => allowed(id) && knowledgeEnabled;
  const graphAllowed = (id, graph) => allowed(id) && (graph.schemaVersion === 1 || knowledgeAllowed(id));
  const knowledge = createCoordinationKnowledge({ enabled: enabled && knowledgeEnabled,
    sharingEnabled: enabled && knowledgeEnabled && sharingEnabled, accountIds });
  const prerequisites = createWorldPrerequisites({ enabled: enabled && prerequisitesEnabled, accountIds });
  const admissions = new WeakMap();
  const requireEnabled = (id) => { if (!allowed(id)) fail('coordination_disabled'); };
  // Knowledge holds caller membership leaves after the actor lock, then claim
  // authority; it never acquires organization or foreign-character locks later.
  // Reads use that same order until projection completes, without value writes.
  const read = (accountId, action) => withPhase2Transaction(pool, async (client) => {
    const crewId = await knowledge.prelock(client, accountId);
    const ch = await actor(client, accountId, true);
    const ctx = await knowledge.context(client, { accountId, character: ch, crewId, lock: true });
    return action(client, ch, ctx);
  });
  const evidenceFor = (client, ctx, graph) => graph.schemaVersion === 2 && knowledgeAllowed(ctx.accountId)
    ? knowledge.resolveGates(client, ctx, graph) : new Map();
  async function admissionFor(client, ctx, graph, ch, now) {
    if (!ch || !graph.nodes.some((node) => node.admission?.length)) return { proof: null, admitted: new Set() };
    if (admissions.has(ctx)) {
      const cached = admissions.get(ctx);
      if (cached.hash !== graph.contentHash) fail('coordination_corrupt');
      return cached;
    }
    const requirements = [...new Map(graph.nodes.flatMap((node) => (node.admission || []).map((p) => [worldPrerequisiteKey(p), p]))).values()];
    const proof = await prerequisites.prepare(client, { subjects: [{ key: 'actor', accountId: ctx.accountId, characterId: ch.id }],
      groups: [{ subjectKey: 'actor', requirements }], asOf: now });
    const admitted = new Set(graph.nodes.filter((node) => (node.admission || []).every((requirement) =>
      prerequisiteMatches(client, proof, { subjectKey: 'actor', requirement, mode: 'write' }))).map((node) => node.id));
    const result = { hash: graph.contentHash, proof, admitted }; admissions.set(ctx, result); return result;
  }
  async function projectCurrent(client, instance, graph, ch, now, ctx, accountId) {
    const evidence = await evidenceFor(client, ctx, graph);
    const admission = await admissionFor(client, ctx, graph, ch, now);
    return project(instance, graph, ch, now, graphAllowed(accountId, graph), evidence, admission.admitted);
  }
  const getInstance = (accountId, id) => read(accountId, async (client, ch, ctx) => {
    const instance = await ownedInstance(client, accountId, id);
    return projectCurrent(client, instance, await loadDefinition(client, instance), ch, Date.now(), ctx, accountId);
  });
  async function command(accountId, key, request, action, raw = false) {
    textId(key);
    const fingerprint = hash(['omerta:coordination:command:v1', request]);
    return withPhase2Transaction(pool, async (client) => {
      const crewId = await knowledge.prelock(client, accountId);
      const ch = await actor(client, accountId, true);
      const prior = (await client.query(
        'SELECT * FROM coordination_commands WHERE account_id=$1 AND command_key=$2', [accountId, key],
      )).rows[0];
      if (prior) {
        if (prior.fingerprint !== fingerprint) fail('coordination_key_reuse');
        // This is a receipt of an already committed transition, not fresh action authority.
        return { ...parse(prior.response_json), replayed: true };
      }
      const ctx = await knowledge.context(client, { accountId, character: ch, crewId, lock: true });
      const commandId = crypto.randomUUID();
      const result = await action(client, ch, commandId, Date.now(), ctx);
      const response = { ...(raw ? result : { instance: result }), replayed: false };
      await client.query(
        `INSERT INTO coordination_commands (account_id, command_key, command_id, fingerprint, response_json)
         VALUES ($1,$2,$3,$4,$5)`, [accountId, key, commandId, fingerprint, JSON.stringify(response)],
      );
      registerPhase2Undo(client, () => client.query(
        'DELETE FROM coordination_commands WHERE account_id=$1 AND command_key=$2', [accountId, key],
      ));
      return response;
    });
  }
  return Object.freeze({
    async catalog(accountId) {
      const summary = await read(accountId, async (client, ch) => {
        const rows = (await client.query(
          'SELECT id FROM coordination_instances WHERE owner_account_id=$1 ORDER BY created_at DESC, id LIMIT 20', [accountId],
        )).rows;
        return { enabled: allowed(accountId), directOnly: true,
          graphs: allowed(accountId) && ch ? coordinationGraphs(registry).filter((graph) => graphAllowed(accountId, graph)).map(({ id, version, title, contentHash }) =>
            ({ id, version, title, contentHash })) : [], ids: rows.map((row) => row.id) };
      });
      // Each instance is its own short authority snapshot. Holding claim batches
      // across different graph projections could reverse a knowledge-board lock
      // order. Actions revalidate their instance and live evidence when executed.
      const instances = [];
      for (const id of summary.ids) instances.push(await getInstance(accountId, id));
      const { ids: _ids, ...catalog } = summary;
      return { ...catalog, instances };
    },
    async get(accountId, id) {
      return getInstance(accountId, id);
    },
    async create(accountId, graphId, input, key) {
      textId(graphId); body(input, ['expectedContentHash']);
      return command(accountId, key, { kind: 'create', graphId, ...input }, async (client, ch, commandId, now, ctx) => {
        requireEnabled(accountId);
        if (!ch) fail('coordination_unavailable');
        const graph = coordinationGraph(registry, graphId);
        if (!graph) fail('coordination_unavailable');
        if (!graphAllowed(accountId, graph)) fail('coordination_disabled');
        if (input.expectedContentHash !== graph.contentHash) fail('stale_coordination_content');
        const prior = (await client.query(
          'SELECT * FROM coordination_instances WHERE owner_character_id=$1 AND graph_id=$2', [ch.id, graphId],
        )).rows[0];
        if (prior) return projectCurrent(client, prior, await loadDefinition(client, prior), ch, now, ctx, accountId);
        await persistDefinition(client, graph);
        const instance = { id: crypto.randomUUID(), graph_id: graph.id, graph_version: graph.version,
          content_hash: graph.contentHash, owner_account_id: accountId, owner_character_id: ch.id,
          state_json: JSON.stringify({ discovered: [], completed: [] }), status: 'active', revision: 0,
          created_at: new Date(now), updated_at: new Date(now) };
        await client.query(
          `INSERT INTO coordination_instances
             (id, graph_id, graph_version, content_hash, owner_account_id, owner_character_id,
              state_json, status, revision, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, Object.values(instance),
        );
        registerPhase2Undo(client, () => client.query('DELETE FROM coordination_instances WHERE id=$1', [instance.id]));
        await event(client, instance, accountId, commandId, 'coordination.created', {}, 0, now);
        return projectCurrent(client, instance, graph, ch, now, ctx, accountId);
      });
    },
    async act(accountId, id, input, key) {
      textId(id); body(input, ['expectedRevision', 'actionId']);
      return command(accountId, key, { kind: 'act', id, ...input }, async (client, ch, commandId, now, ctx) => {
        const instance = await ownedInstance(client, accountId, id, true);
        requireEnabled(accountId);
        if (!ch || ch.id !== instance.owner_character_id || instance.status !== 'active') fail('coordination_unavailable');
        if (Number(instance.revision) !== input.expectedRevision) fail('stale_coordination');
        const graph = await loadDefinition(client, instance);
        if (!graphAllowed(accountId, graph)) fail('coordination_disabled');
        const state = stateOf(instance, graph);
        const evidence = await evidenceFor(client, ctx, graph);
        const admission = await admissionFor(client, ctx, graph, ch, now);
        const action = actionsFor(instance, graph, state, ch, now, true, evidence, admission.admitted).find((candidate) => candidate.id === input.actionId);
        if (!action) fail('coordination_action_unavailable');
        if (!state.discovered.includes(action.node.id)) state.discovered.push(action.node.id);
        if (action.kind === 'complete') state.completed.push(action.node.id);
        state.discovered.sort(); state.completed.sort();
        const complete = action.kind === 'complete' && action.node.kind === 'terminal';
        const next = { ...instance, state_json: JSON.stringify(state), revision: Number(instance.revision) + 1,
          status: complete ? 'completed' : 'active', updated_at: new Date(now) };
        await saveInstance(client, instance, next);
        const sourceEventId = await event(client, next, accountId, commandId,
          action.kind === 'discover' ? 'coordination.node.discovered' : 'coordination.node.completed',
          { nodeId: action.node.id, ...(action.node.admission?.length ? { prerequisiteAdmission: prerequisiteReceipt(client, admission.proof,
            { subjectKey: 'actor', requirements: action.node.admission }) } : {}), ...(graph.schemaVersion === 2 ? { knowledgeEvidence: [...evidence.entries()]
            .filter(([, proof]) => proof.satisfied).map(([ruleKey, proof]) => ({ ruleKey, receiptIds: proof.receiptIds })) } : {}) }, 0, now);
        if (action.kind === 'discover' && action.node.claim) await knowledge.issueClaim(client, ctx,
          { instanceId: next.id, nodeId: action.node.id, sourceEventId, commandId, now });
        if (complete) await event(client, next, accountId, commandId, 'coordination.completed', {}, 1, now);
        // The resolver reuses this context's locked candidate set, including only
        // this transaction's own new claim; it never expands to concurrent grants.
        return projectCurrent(client, next, graph, ch, now, ctx, accountId);
      });
    },
    async cancel(accountId, id, input, key) {
      textId(id); body(input, ['expectedRevision']);
      return command(accountId, key, { kind: 'cancel', id, ...input }, async (client, ch, commandId, now, ctx) => {
        const instance = await ownedInstance(client, accountId, id, true);
        if (Number(instance.revision) !== input.expectedRevision) fail('stale_coordination');
        if (instance.status !== 'active') fail('coordination_unavailable');
        const graph = await loadDefinition(client, instance);
        const next = { ...instance, revision: Number(instance.revision) + 1, status: 'cancelled', updated_at: new Date(now) };
        await saveInstance(client, instance, next);
        await event(client, next, accountId, commandId, 'coordination.cancelled', {}, 0, now, ch?.id ?? null);
        return projectCurrent(client, next, graph, ch, now, ctx, accountId);
      });
    },
    knowledgeBoard(accountId, input = {}) {
      return read(accountId, (client, _ch, ctx) => knowledge.board(client, ctx, input));
    },
    knowledgeGet(accountId, claimId) {
      textId(claimId);
      return read(accountId, (client, _ch, ctx) => knowledge.get(client, ctx, claimId));
    },
    knowledgeTargets(accountId, input = {}) {
      return read(accountId, (client, _ch, ctx) => knowledge.targets(client, ctx, input));
    },
    shareKnowledge(accountId, claimId, input, key) {
      textId(claimId); body(input, ['targetId', 'expectedAclRevision']);
      return command(accountId, key, { kind: 'knowledge.share', claimId, ...input },
        (client, _ch, commandId, now, ctx) => knowledge.share(client, ctx, { claimId, ...input, commandId, now }), true);
    },
    revokeKnowledge(accountId, claimId, input, key) {
      textId(claimId); body(input, ['grantId', 'expectedAclRevision']);
      return command(accountId, key, { kind: 'knowledge.revoke', claimId, ...input },
        (client, _ch, commandId, now, ctx) => knowledge.revoke(client, ctx, { claimId, ...input, commandId, now }), true);
    },
    linkKnowledge(accountId, input, key) {
      body(input, ['fromClaimId', 'toClaimId', 'relation']);
      return command(accountId, key, { kind: 'knowledge.link', ...input },
        (client, _ch, commandId, now, ctx) => knowledge.link(client, ctx, { ...input, commandId, now }), true);
    },
    archiveKnowledge(accountId, input, key) {
      body(input, ['claimId']);
      return command(accountId, key, { kind: 'knowledge.archive', ...input },
        (client, _ch, commandId, now, ctx) => knowledge.archive(client, ctx, { ...input, commandId, now }), true);
    },
    knowledgeArchive(accountId, input = {}) {
      return read(accountId, (client, _ch, ctx) => knowledge.archiveBoard(client, ctx, input));
    },
    rebuildKnowledge(accountId, input, key) {
      body(input, []);
      return command(accountId, key, { kind: 'knowledge.rebuild' },
        (client, _ch, commandId, now, ctx) => knowledge.rebuild(client, ctx, { commandId, now }), true);
    },
    async metrics() {
      return withPhase2Read(pool, async (client) => ({ schemaVersion: 1,
        knowledge: {
          claims: Number((await client.query('SELECT count(*) AS total FROM coordination_claims')).rows[0].total),
          activeGrants: Number((await client.query('SELECT count(*) AS total FROM coordination_claim_grants WHERE active=true')).rows[0].total),
          links: Number((await client.query('SELECT count(*) AS total FROM coordination_claim_links')).rows[0].total),
          archiveEntries: Number((await client.query('SELECT count(*) AS total FROM coordination_archive_entries')).rows[0].total),
        },
        events: (await client.query(
          'SELECT event_type, count(*) AS total FROM coordination_events GROUP BY event_type ORDER BY event_type',
        )).rows.map((row) => ({ type: row.event_type, total: Number(row.total) })),
        instances: (await client.query(
          'SELECT status, count(*) AS total FROM coordination_instances GROUP BY status ORDER BY status',
        )).rows.map((row) => ({ status: row.status, total: Number(row.total) })) }));
    },
  });
}
