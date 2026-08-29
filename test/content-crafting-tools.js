// BELLINI PRESS ROOM — production contract for exact-hash durable tools and location facilities.
// Tool power stays confined to authored crafting; wear happens at action start and repairs consume
// only compiler-pinned, same-hash materials.
process.env.MOD_KEY = 'test-mod-key';

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildServer } from '../src/server.js';
import { compileContentPack, validateCraftingContentPack } from '../src/content/compiler.js';

const NAMESPACE = 'omerta.workshop.bellini-lockbox';
const FACILITY = 'old-foundry-workbench';
const TOOL = 'bellini-restoration-press';
const TOOL_ITEM = 'restoration-press-item';
const PLATE_SOURCE = 'foundry-plate-salvage';
const BINDING_SOURCE = 'archive-binding-salvage';
const PLATE_JOB = 'true-ledger-plate';
const BINDING_JOB = 'stitch-fireproof-binding';
const ASSEMBLE = 'assemble-restoration-press';
const RESTORE = 'restore-bellini-lockbox';
const PLATE = 'ledger-plate';
const LOCKBOX = 'bellini-lockbox';

const source = JSON.parse(await readFile(
  new URL('../content/packs/bellini-lockbox-v3/pack.json', import.meta.url),
  'utf8',
));
const bundle = compileContentPack(source);
assert.equal(validateCraftingContentPack(bundle), bundle,
  'Bellini v3 belongs to the strict authored durable-tool capability');

const malformed = (label, change, pattern) => {
  const copy = structuredClone(source);
  change(copy);
  assert.throws(() => validateCraftingContentPack(compileContentPack(copy)), pattern, label);
};
malformed('tool kinds are closed', (pack) => {
  pack.nodes.find((node) => node.id === TOOL).payload.toolKind = 'global_power';
}, /account_durable/);
malformed('tool durability is compiler bounded', (pack) => {
  pack.nodes.find((node) => node.id === TOOL).payload.durabilityCost = 4;
}, /bounded account_durable wear/);
malformed('tool items cannot become tradeable', (pack) => {
  pack.nodes.find((node) => node.id === TOOL_ITEM).payload.tradeable = true;
}, /tradeable false|non-tradeable authored_tool/);
malformed('tool items expose only authored-crafting power', (pack) => {
  pack.nodes.find((node) => node.id === TOOL_ITEM).payload.gameplayPower = 'combat';
}, /unsupported gameplayPower/);
malformed('facilities are location workbenches only', (pack) => {
  pack.nodes.find((node) => node.id === FACILITY).payload.facilityKind = 'organization_armory';
}, /location_workbench/);
malformed('tool wear cannot be caller-authored per edge', (pack) => {
  pack.edges.find((edge) => edge.from === BINDING_JOB && edge.type === 'USES_TOOL').quantity = 2;
}, /cannot override durability cost/);
malformed('tool actions must require the tool facility', (pack) => {
  pack.edges = pack.edges.filter((edge) => !(edge.from === BINDING_JOB
    && edge.type === 'REQUIRES' && edge.to === FACILITY));
}, /must require tool .* facility/);
malformed('tool repair materials need authored supply', (pack) => {
  const orphan = structuredClone(pack.nodes.find((node) => node.id === PLATE));
  orphan.id = 'orphan-repair-stock';
  orphan.payload.title = 'Orphan Repair Stock';
  pack.nodes.push(orphan);
  pack.crafting.nodeIds.push(orphan.id);
  pack.edges.find((edge) => edge.from === TOOL && edge.type === 'CONSUMES').to = orphan.id;
}, /repair input orphan-repair-stock has no producer/);

const app = await buildServer();
const pool = app.pool;
const call = async (method, url, { token, body, mod = false } = {}) => {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (mod) headers['x-mod-key'] = 'test-mod-key';
  const response = await app.inject({ method, url, headers, payload: body });
  return { code: response.statusCode, body: response.json() };
};
const makePlayer = async (name) => {
  let response = await call('POST', '/v1/auth/guest');
  assert.equal(response.code, 200);
  const token = response.body.token;
  response = await call('POST', '/v1/character', { token, body: { name } });
  assert.equal(response.code, 200);
  const me = await call('GET', '/v1/me', { token });
  const id = me.body.character.id;
  const accountId = (await pool.query(
    'SELECT account_id FROM characters WHERE id=$1', [id],
  )).rows[0].account_id;
  return { token, id, accountId };
};
const moveToFoundry = (player) => pool.query(
  "UPDATE characters SET loc='foundry' WHERE id=$1", [player.id],
);
const mutate = (player, suffix, contentHash = bundle.contentHash, body = null) => call(
  'POST', `/v1/content/${encodeURIComponent(NAMESPACE)}/${suffix}`,
  { token: player.token, body: body || { expectedContentHash: contentHash } },
);
const collectSource = (player, sourceId, contentHash = bundle.contentHash) => mutate(
  player, `sources/${sourceId}/collect`, contentHash,
);
const craft = (player, recipeId, contentHash = bundle.contentHash, body = null) => mutate(
  player, `recipes/${recipeId}/craft`, contentHash, body,
);
const startJob = (player, jobId, contentHash = bundle.contentHash) => mutate(
  player, `jobs/${jobId}/start`, contentHash,
);
const finishJob = (player, jobId, contentHash = bundle.contentHash) => mutate(
  player, `jobs/${jobId}/collect`, contentHash,
);
const repair = (player, contentHash = bundle.contentHash, body = null) => mutate(
  player, `tools/${TOOL}/repair`, contentHash, body,
);
const makeReady = (runId) => pool.query(
  "UPDATE content_work_order_runs SET ready_at=now()-interval '1 second' WHERE id=$1", [runId],
);
const runJob = async (player, jobId, contentHash = bundle.contentHash) => {
  const started = await startJob(player, jobId, contentHash);
  assert.equal(started.code, 200, JSON.stringify(started.body));
  await makeReady(started.body.run.id);
  const finished = await finishJob(player, jobId, contentHash);
  assert.equal(finished.code, 200, JSON.stringify(finished.body));
  return finished;
};
const workshopOf = (response) => response.body.crafting.find((entry) => entry.namespace === NAMESPACE);
const toolState = async (accountId, contentHash = bundle.contentHash) => (await pool.query(
  `SELECT * FROM content_tool_states
    WHERE account_id=$1 AND namespace=$2 AND content_hash=$3 AND tool_id=$4`,
  [accountId, NAMESPACE, contentHash, TOOL],
)).rows[0];
const quantities = async (accountId, contentHash = bundle.contentHash) => Object.fromEntries(
  (await pool.query(
    `SELECT item_id, SUM(quantity_remaining)::int AS qty
       FROM content_inventory_lots
      WHERE account_id=$1 AND namespace=$2 AND content_hash=$3
      GROUP BY item_id ORDER BY item_id`,
    [accountId, NAMESPACE, contentHash],
  )).rows.map((row) => [row.item_id, Number(row.qty)]),
);
const economy = async (player) => {
  const character = (await pool.query(
    'SELECT cash, cb, ammo FROM characters WHERE id=$1', [player.id],
  )).rows[0];
  const account = (await pool.query(
    'SELECT omr FROM account_persistent WHERE account_id=$1', [player.accountId],
  )).rows[0];
  const transactions = (await pool.query(
    'SELECT COUNT(*) AS n FROM transactions WHERE character_id=$1', [player.id],
  )).rows[0];
  return {
    cash: Number(character.cash), cb: Number(character.cb), ammo: Number(character.ammo),
    omr: Number(account.omr), transactions: Number(transactions.n),
  };
};

try {
  let response = await call('GET', '/openapi.json');
  assert.equal(response.code, 200);
  const operation = response.body.paths['/v1/content/{namespace}/tools/{toolId}/repair']?.post;
  assert(operation, 'the tool repair route is machine-discoverable');
  assert.deepEqual(operation.security, [{ bearerAuth: [] }]);
  assert.deepEqual(operation.requestBody.content['application/json'].schema.required,
    ['expectedContentHash']);
  assert.equal(operation.requestBody.content['application/json'].schema.additionalProperties, false);

  response = await call('POST', '/v1/mod/content/activate', {
    mod: true, body: { bundle, expectedHash: bundle.contentHash },
  });
  assert.equal(response.code, 200, JSON.stringify(response.body));

  const maker = await makePlayer('Press Room Maker');
  const baseline = await economy(maker);
  response = await call('GET', '/v1/content', { token: maker.token });
  let workshop = workshopOf(response);
  assert.deepEqual(workshop.facilities, [{
    id: FACILITY, title: 'Old Foundry Restoration Bench', kind: 'location_workbench',
    location: { id: 'old-foundry-bench', districtId: 'foundry', title: 'The Old Foundry Bench' },
    available: false,
  }]);
  assert.equal(workshop.tools[0].owned, false);
  assert.equal(workshop.tools[0].repairable, false);
  assert(workshop.tools[0].blockedBy.some((gate) => gate.kind === 'tool_missing'));
  assert(workshop.jobs.find((job) => job.id === PLATE_JOB).blockedBy
    .some((gate) => gate.kind === 'facility_location'));

  response = await startJob(maker, PLATE_JOB);
  assert.equal(response.code, 400);
  assert.equal(response.body.error, 'wrong_location');
  assert.equal(response.body.facilityId, FACILITY);
  await moveToFoundry(maker);
  assert.equal((await collectSource(maker, PLATE_SOURCE)).code, 200);
  assert.equal((await collectSource(maker, BINDING_SOURCE)).code, 200);

  await runJob(maker, PLATE_JOB);
  response = await startJob(maker, BINDING_JOB);
  assert.equal(response.code, 400);
  assert.equal(response.body.error, 'tool_missing');

  response = await craft(maker, ASSEMBLE);
  assert.equal(response.code, 200, JSON.stringify(response.body));
  assert.equal((await quantities(maker.accountId))[TOOL_ITEM], 1);
  let state = await toolState(maker.accountId);
  assert.equal(Number(state.durability_remaining), 3);
  assert.equal(Number(state.max_durability), 3);

  response = await repair(maker);
  assert.equal(response.code, 400);
  assert.equal(response.body.error, 'tool_full');

  response = await startJob(maker, BINDING_JOB);
  assert.equal(response.code, 200, JSON.stringify(response.body));
  state = await toolState(maker.accountId);
  assert.equal(Number(state.durability_remaining), 2,
    'the press wears when the timed job starts');
  response = await finishJob(maker, BINDING_JOB);
  assert.equal(response.code, 400);
  assert.equal(response.body.error, 'job_running');
  assert.equal(Number((await toolState(maker.accountId)).durability_remaining), 2,
    'an early collection cannot spend tool wear twice');
  const active = (await pool.query(
    `SELECT id FROM content_work_order_runs
      WHERE account_id=$1 AND namespace=$2 AND status='active'`,
    [maker.accountId, NAMESPACE],
  )).rows[0];
  await makeReady(active.id);
  assert.equal((await finishJob(maker, BINDING_JOB)).code, 200);
  assert.equal(Number((await toolState(maker.accountId)).durability_remaining), 2,
    'job completion grants output and XP without another wear event');

  await runJob(maker, PLATE_JOB);
  await runJob(maker, PLATE_JOB);
  await runJob(maker, PLATE_JOB);
  await runJob(maker, BINDING_JOB);
  assert.equal(Number((await toolState(maker.accountId)).durability_remaining), 1);

  response = await craft(maker, RESTORE);
  assert.equal(response.code, 200, JSON.stringify(response.body));
  assert.equal((await quantities(maker.accountId))[LOCKBOX], 1);
  state = await toolState(maker.accountId);
  assert.equal(Number(state.durability_remaining), 0,
    'the instant final craft consumes its compiler-pinned wear atomically');
  response = await call('GET', '/v1/content', { token: maker.token });
  workshop = workshopOf(response);
  assert.equal(workshop.tools[0].broken, true);
  assert(workshop.recipes.find((recipe) => recipe.id === RESTORE).blockedBy
    .some((gate) => gate.kind === 'tool_broken'));

  response = await repair(maker, bundle.contentHash, {
    expectedContentHash: bundle.contentHash, durability: 999, materialId: PLATE,
  });
  assert.equal(response.code, 400);
  assert.equal(response.body.error, 'bad_request',
    'the caller cannot nominate durability or repair materials');
  response = await repair(maker);
  assert.equal(response.code, 200, JSON.stringify(response.body));
  assert.equal(response.body.receipt.kind, 'tool_repair');
  assert.deepEqual(response.body.receipt.inputs,
    [{ itemId: PLATE, title: 'Ledger Plate', quantity: 1 }]);
  assert.deepEqual(response.body.receipt.tool, {
    id: TOOL, title: 'Bellini Restoration Press', itemId: TOOL_ITEM,
    durabilityBefore: 0, durabilityAfter: 3, maxDurability: 3,
  });
  assert.equal(Number((await toolState(maker.accountId)).durability_remaining), 3);

  const events = (await pool.query(
    `SELECT event_kind, durability_before, durability_after, action_id
       FROM content_tool_events
      WHERE account_id=$1 AND namespace=$2 AND content_hash=$3
      ORDER BY created_at, id`,
    [maker.accountId, NAMESPACE, bundle.contentHash],
  )).rows;
  assert.deepEqual(events.map((event) => [
    event.event_kind, Number(event.durability_before), Number(event.durability_after),
  ]), [
    ['acquire', 0, 3], ['use', 3, 2], ['use', 2, 1], ['use', 1, 0], ['repair', 0, 3],
  ]);
  assert(events.every((event) => typeof event.action_id === 'string' && event.action_id.length > 0));
  assert.deepEqual(await economy(maker), baseline,
    'tools, facility use, wear, repair, authored XP, and keepsakes move no cash, crates, ammo, OMR, or ledger value');

  const sourceV4 = structuredClone(source);
  sourceV4.version = 4;
  sourceV4.crafting.title = 'The Bellini Restoration School — Fourth Press';
  const bundleV4 = compileContentPack(sourceV4);
  response = await call('POST', '/v1/mod/content/activate', {
    mod: true, body: { bundle: bundleV4, expectedHash: bundleV4.contentHash },
  });
  assert.equal(response.code, 200, JSON.stringify(response.body));
  response = await call('GET', '/v1/content', { token: maker.token });
  workshop = workshopOf(response);
  assert.equal(workshop.contentHash, bundleV4.contentHash);
  assert.equal(workshop.tools[0].owned, false,
    'an old exact-hash tool cannot unlock a promoted workshop version');
  assert.deepEqual(workshop.archivedTools, [{
    version: 3, contentHash: bundle.contentHash, id: TOOL,
    title: 'Bellini Restoration Press', itemId: TOOL_ITEM,
    durabilityRemaining: 3, maxDurability: 3, broken: false,
  }]);
  const currentToolItem = workshop.inventory.find((item) => item.id === TOOL_ITEM);
  assert.equal(currentToolItem.quantity, 0);
  assert.equal(currentToolItem.ownedAcrossVersions, 1);

  assert.equal((await collectSource(maker, PLATE_SOURCE, bundleV4.contentHash)).code, 200);
  assert.equal((await collectSource(maker, BINDING_SOURCE, bundleV4.contentHash)).code, 200);
  await runJob(maker, PLATE_JOB, bundleV4.contentHash);
  response = await craft(maker, ASSEMBLE, bundleV4.contentHash);
  assert.equal(response.code, 200, JSON.stringify(response.body));
  state = await toolState(maker.accountId, bundleV4.contentHash);
  assert.equal(Number(state.durability_remaining), 3,
    'the same logical non-stackable tool may be reacquired under a new exact hash');
  assert.deepEqual(await economy(maker), baseline);
} finally {
  await app.close();
}

console.log('✅ exact-hash authored durable tools and location facilities contract passed');
