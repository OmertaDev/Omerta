// THE BELLINI RESTORATION SCHOOL — production contract for authored work orders and skill tracks.
// Jobs are server-timed, exact-hash transformations; XP is account-owned, inert, and version-pinned.
process.env.MOD_KEY = 'test-mod-key';

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildServer } from '../src/server.js';
import { compileContentPack, validateCraftingContentPack } from '../src/content/compiler.js';

const NAMESPACE = 'omerta.workshop.bellini-lockbox';
const PLATE_SOURCE = 'foundry-plate-salvage';
const BINDING_SOURCE = 'archive-binding-salvage';
const PLATE_JOB = 'true-ledger-plate';
const BINDING_JOB = 'stitch-fireproof-binding';
const RECIPE = 'restore-bellini-lockbox';
const SKILL = 'bellini-restoration-skill';
const PLATE = 'ledger-plate';
const BINDING = 'charred-binding';
const TRUED = 'trued-ledger-plate';
const REINFORCED = 'reinforced-binding';
const LOCKBOX = 'bellini-lockbox';

const source = JSON.parse(await readFile(
  new URL('../content/packs/bellini-lockbox-v2/pack.json', import.meta.url),
  'utf8',
));
const bundle = compileContentPack(source);
assert.equal(validateCraftingContentPack(bundle), bundle,
  'the production apprenticeship belongs to the strict crafting capability');

const malformed = (label, change, pattern) => {
  const copy = structuredClone(source);
  change(copy);
  assert.throws(() => validateCraftingContentPack(compileContentPack(copy)), pattern, label);
};
malformed('work order kinds are closed', (pack) => {
  pack.nodes.find((node) => node.id === PLATE_JOB).payload.jobKind = 'arbitrary_effect';
}, /account_work_order/);
malformed('work order duration is bounded', (pack) => {
  pack.nodes.find((node) => node.id === PLATE_JOB).payload.durationSeconds = 0;
}, /durationSeconds/);
malformed('skill thresholds are strictly increasing', (pack) => {
  pack.nodes.find((node) => node.id === SKILL).payload.thresholds = [10, 10];
}, /thresholds/);
malformed('every work order has one skill reward edge', (pack) => {
  pack.edges = pack.edges.filter((edge) => !(edge.from === PLATE_JOB && edge.type === 'TRAINS'));
}, /must train exactly one skill track/);
malformed('work order XP is a bounded positive integer', (pack) => {
  pack.edges.find((edge) => edge.from === PLATE_JOB && edge.type === 'TRAINS').quantity = 0;
}, /positive skill XP/);
malformed('work order outputs stay inert stackable workpieces', (pack) => {
  pack.nodes.find((node) => node.id === TRUED).payload.stackable = false;
  pack.nodes.find((node) => node.id === TRUED).payload.maxOwned = 1;
}, /stackable authored workpieces/);
malformed('work order inputs require authored supply', (pack) => {
  pack.edges.find((edge) => edge.from === PLATE_SOURCE
    && edge.type === 'PRODUCES' && edge.to === PLATE).to = BINDING;
}, /work order true-ledger-plate input ledger-plate has no producer/);
malformed('work order outputs require a downstream use or sink', (pack) => {
  pack.edges = pack.edges.filter((edge) => !(edge.from === RECIPE
    && edge.type === 'CONSUMES' && edge.to === TRUED));
}, /work order true-ledger-plate output trued-ledger-plate has no use or sink/);
malformed('recipe skill gates reference an authored track', (pack) => {
  pack.nodes.find((node) => node.id === RECIPE).payload.skillTrackId = 'missing-track';
}, /references missing node|profile references missing node/);

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
const collectSource = (player, sourceId, contentHash = bundle.contentHash) => call(
  'POST', `/v1/content/${encodeURIComponent(NAMESPACE)}/sources/${sourceId}/collect`,
  { token: player.token, body: { expectedContentHash: contentHash } },
);
const startJob = (player, jobId, contentHash = bundle.contentHash, body = null) => call(
  'POST', `/v1/content/${encodeURIComponent(NAMESPACE)}/jobs/${jobId}/start`,
  { token: player.token, body: body || { expectedContentHash: contentHash } },
);
const finishJob = (player, jobId, contentHash = bundle.contentHash) => call(
  'POST', `/v1/content/${encodeURIComponent(NAMESPACE)}/jobs/${jobId}/collect`,
  { token: player.token, body: { expectedContentHash: contentHash } },
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
  for (const path of [
    '/v1/content/{namespace}/jobs/{jobId}/start',
    '/v1/content/{namespace}/jobs/{jobId}/collect',
  ]) {
    const operation = response.body.paths[path]?.post;
    assert(operation, `${path} is machine-discoverable`);
    assert.deepEqual(operation.security, [{ bearerAuth: [] }]);
    const schema = operation.requestBody.content['application/json'].schema;
    assert.deepEqual(schema.required, ['expectedContentHash']);
    assert.equal(schema.additionalProperties, false);
  }

  response = await call('POST', '/v1/mod/content/activate', {
    mod: true, body: { bundle, expectedHash: bundle.contentHash },
  });
  assert.equal(response.code, 200);

  const maker = await makePlayer('Foundry Apprentice');
  const baseline = await economy(maker);
  response = await call('GET', '/v1/content', { token: maker.token });
  let workshop = workshopOf(response);
  assert.equal(workshop.title, 'The Bellini Restoration School');
  assert.deepEqual(workshop.skills, [{
    id: SKILL, title: 'Bellini Restoration', xp: 0, level: 0, maxLevel: 3, nextLevelXp: 10,
  }]);
  assert.equal(workshop.jobs.length, 2);
  assert.equal(workshop.activeJob, null);
  assert(workshop.jobs.every((job) => !job.startable));

  response = await startJob(maker, PLATE_JOB);
  assert.equal(response.code, 400);
  assert.equal(response.body.error, 'wrong_location');
  await moveToFoundry(maker);
  assert.equal((await collectSource(maker, PLATE_SOURCE)).code, 200);
  assert.equal((await collectSource(maker, BINDING_SOURCE)).code, 200);

  response = await startJob(maker, BINDING_JOB);
  assert.equal(response.code, 400);
  assert.equal(response.body.error, 'skill_level');

  response = await startJob(maker, PLATE_JOB, bundle.contentHash, {
    expectedContentHash: bundle.contentHash, durationSeconds: 0, skillXp: 999,
  });
  assert.equal(response.code, 400);
  assert.equal(response.body.error, 'bad_request', 'clients cannot nominate duration or skill XP');

  response = await startJob(maker, PLATE_JOB);
  assert.equal(response.code, 200);
  const firstRun = response.body.run;
  assert.equal(firstRun.jobId, PLATE_JOB);
  assert.equal(firstRun.skill.xpReward, 10);
  assert.equal(firstRun.durationSeconds, 300);
  assert.equal(firstRun.ready, false);
  assert.equal((await quantities(maker.accountId))[PLATE], 2,
    'job inputs are consumed atomically when the clock starts');

  response = await startJob(maker, PLATE_JOB);
  assert.equal(response.code, 400);
  assert.equal(response.body.error, 'job_active', 'one account runs one job per authored workshop');
  response = await finishJob(maker, PLATE_JOB);
  assert.equal(response.code, 400);
  assert.equal(response.body.error, 'job_running');
  assert.equal(response.body.readyAt, firstRun.readyAt);

  await makeReady(firstRun.id);
  response = await finishJob(maker, PLATE_JOB);
  assert.equal(response.code, 200);
  assert.equal(response.body.receipt.kind, 'job');
  assert.deepEqual(response.body.receipt.outputs,
    [{ itemId: TRUED, title: 'Trued Ledger Plate', quantity: 1 }]);
  assert.deepEqual(response.body.receipt.skill,
    { id: SKILL, title: 'Bellini Restoration', xpAwarded: 10, xp: 10, level: 1, maxLevel: 3 });
  response = await finishJob(maker, PLATE_JOB);
  assert.equal(response.code, 400);
  assert.equal(response.body.error, 'no_job');

  await runJob(maker, BINDING_JOB);
  await runJob(maker, PLATE_JOB);
  await runJob(maker, PLATE_JOB);
  await runJob(maker, BINDING_JOB);
  response = await call('GET', '/v1/content', { token: maker.token });
  workshop = workshopOf(response);
  assert.deepEqual(workshop.skills, [{
    id: SKILL, title: 'Bellini Restoration', xp: 60, level: 3, maxLevel: 3, nextLevelXp: null,
  }]);
  assert.equal(workshop.recipes[0].craftable, true,
    'the authored recipe opens after the compiler-defined skill level and materials are satisfied');

  response = await call(
    'POST', `/v1/content/${encodeURIComponent(NAMESPACE)}/recipes/${RECIPE}/craft`,
    { token: maker.token, body: { expectedContentHash: bundle.contentHash } },
  );
  assert.equal(response.code, 200);
  assert.equal((await quantities(maker.accountId))[LOCKBOX], 1);
  assert.deepEqual(await economy(maker), baseline,
    'work orders, authored XP, and the finished keepsake move no cash, crates, ammo, OMR, or ledger value');

  const pinned = await makePlayer('Version Apprentice');
  await moveToFoundry(pinned);
  assert.equal((await collectSource(pinned, PLATE_SOURCE)).code, 200);
  response = await startJob(pinned, PLATE_JOB);
  assert.equal(response.code, 200);
  const pinnedRun = response.body.run;

  const sourceV3 = structuredClone(source);
  sourceV3.version = 3;
  sourceV3.crafting.title = 'The Bellini Restoration School — Third Ledger';
  const bundleV3 = compileContentPack(sourceV3);
  response = await call('POST', '/v1/mod/content/activate', {
    mod: true, body: { bundle: bundleV3, expectedHash: bundleV3.contentHash },
  });
  assert.equal(response.code, 200);

  response = await call('GET', '/v1/content', { token: pinned.token });
  workshop = workshopOf(response);
  assert.equal(workshop.contentHash, bundleV3.contentHash);
  assert.equal(workshop.activeJob.contentHash, bundle.contentHash,
    'an in-flight job retains the exact immutable authority that started it');
  assert.equal(workshop.activeJob.action.body.expectedContentHash, bundle.contentHash);

  response = await finishJob(pinned, PLATE_JOB, bundleV3.contentHash);
  assert.equal(response.code, 409);
  assert.equal(response.body.error, 'stale_content');
  assert.equal(response.body.workshop.contentHash, bundleV3.contentHash);
  await makeReady(pinnedRun.id);
  response = await finishJob(pinned, PLATE_JOB, bundle.contentHash);
  assert.equal(response.code, 200,
    'the pinned old-hash run remains collectible after an operator promotes a new version');
  assert.equal(response.body.workshop.contentHash, bundleV3.contentHash,
    'completion returns the current workshop while the receipt identifies the pinned run');
  assert.equal(response.body.receipt.contentHash, bundle.contentHash);
  assert.deepEqual(await quantities(pinned.accountId, bundle.contentHash), {
    [PLATE]: 2, [TRUED]: 1,
  });
  assert.deepEqual(await quantities(pinned.accountId, bundleV3.contentHash), {});

  response = await call('GET', '/v1/content', { token: pinned.token });
  workshop = workshopOf(response);
  assert.deepEqual(workshop.skills, [{
    id: SKILL, title: 'Bellini Restoration', xp: 0, level: 0, maxLevel: 3, nextLevelXp: 10,
  }]);
  assert.deepEqual(workshop.archivedSkills, [{
    version: 2, contentHash: bundle.contentHash, id: SKILL,
    title: 'Bellini Restoration', xp: 10, level: 1, maxLevel: 3,
  }], 'old exact-hash skill progress remains durable and visible without unlocking the new version');

  const runs = (await pool.query(
    `SELECT status, content_hash, job_id, skill_xp, inputs_json, outputs_json
       FROM content_work_order_runs ORDER BY started_at, id`,
  )).rows;
  assert.equal(runs.length, 6);
  assert(runs.every((run) => run.status === 'collected'));
  assert(runs.every((run) => Number(run.skill_xp) > 0));
  assert(runs.every((run) => Array.isArray(JSON.parse(run.inputs_json))
    && Array.isArray(JSON.parse(run.outputs_json))));
  const workpieceLots = (await pool.query(
    `SELECT acquired_via, authority_id FROM content_inventory_lots
      WHERE namespace=$1 AND item_id IN ($2,$3)`,
    [NAMESPACE, TRUED, REINFORCED],
  )).rows;
  assert(workpieceLots.length > 0);
  assert(workpieceLots.every((lot) => lot.acquired_via === 'work_order'),
    'workpieces keep their honest work-order provenance rather than masquerading as recipe output');
} finally {
  await app.close();
}

console.log('✅ authored work orders and exact-hash skill progression contract passed');
