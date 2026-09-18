// Selected mysteries compose with the same authenticated, read-only player snapshot.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { newDb, DataType } from 'pg-mem';
import { dbCaps, registerPgMemCompatibility } from '../src/db.js';
import { withItemRead, withItemTransaction } from '../src/items.js';
import { createWorldProjection } from '../src/world-projection.js';
import { createWorldKernelQuery } from '../src/world-kernel-query.js';
import { createWorldKernel } from '../src/world-kernel.js';
import { createCraftingContext } from '../src/crafting.js';
import { createCoordinationKnowledge } from '../src/coordination/knowledge.js';
import { createCoordinationService } from '../src/coordination/runtime.js';
import { createFamilyOperations } from '../src/coordination/operations.js';
import { coordinationGraphs } from '../src/coordination/graph.js';
import { COORDINATION_KNOWLEDGE_PILOT } from '../src/coordination/pilot.js';
import { COORDINATION_OPERATION_PILOT } from '../src/content/coordination-operation-pilot.js';
import { WORLD_KERNEL_OBJECTS, WORLD_KERNEL_REGISTRY, WORLD_KERNEL_RECIPE } from '../src/content/world-kernel-pilot.js';
import { loadAndValidateGraphPackages } from '../src/worldgraph-validate.js';
import { createMysteryContext, startMystery, discoverNode, mysteryBoard, planMysterySnapshot } from '../src/mysteries.js';

const postgres = process.argv.includes('--postgres');
let pool, cleanup;
if (postgres) {
  assert(process.env.WORLD_KERNEL_TEST_DATABASE_URL, 'Explicit loopback PostgreSQL endpoint required');
  const endpoint = new URL(process.env.WORLD_KERNEL_TEST_DATABASE_URL);
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname));
  const { Pool } = await import('pg'), base = new Pool({ connectionString: endpoint.toString() });
  const namespace = `projection_mysteries_${crypto.randomBytes(8).toString('hex')}`;
  await base.query(`CREATE SCHEMA ${namespace}`);
  pool = new Pool({ connectionString: endpoint.toString(), options: `-c search_path=${namespace} -c lock_timeout=5000 -c statement_timeout=15000` });
  cleanup = async () => { await pool.end(); await base.query(`DROP SCHEMA ${namespace} CASCADE`); await base.end(); };
  dbCaps.skipLocked = true;
} else {
  const mem = newDb({ noAstCoverageCheck: true }); registerPgMemCompatibility(mem, DataType);
  const { Pool } = mem.adapters.createPg(); pool = new Pool(); cleanup = () => pool.end(); dbCaps.skipLocked = false;
}
const key = () => crypto.randomUUID(), ch = (id) => `${id}-ch`, owner = (id) => ({ scope: 'character', id: ch(id) });
const graph = coordinationGraphs(COORDINATION_KNOWLEDGE_PILOT)[0], secret = WORLD_KERNEL_OBJECTS[0].knowledge[0];
const graphId = 'projection-case-fixture', hidden = 'm:projection-private', clue = 'The reverse stamp predates the missing entry.';
const registry = loadAndValidateGraphPackages([...WORLD_KERNEL_REGISTRY.byPackage.values(), {
  id: graphId, version: 1, dependsOn: [], nodes: [
    { id: 'm:projection-public', type: 'mystery_step', visibility: 'public', metadata: { title: 'A Public Lead', description: 'Compare the surviving accounts.' } },
    { id: hidden, type: 'mystery_step', visibility: 'hidden', metadata: { title: 'The Private Stamp', description: clue },
      conditions: [{ adapter: 'knowledge', requirement: secret }, { adapter: 'explicit_interaction', value: 'read-private-stamp' }] },
  ],
}]);
const policy = { enabled: true, knowledgeEnabled: true, sharingEnabled: true };
const mysteryContext = (accountId, now = Date.now()) => createMysteryContext({ registry, accountId, now, ...policy, prerequisitesEnabled: true });
const commands = createCoordinationService({ pool, registry: COORDINATION_KNOWLEDGE_PILOT, ...policy });
function services(selectedPool = pool) {
  const kernel = createWorldKernel({ pool: selectedPool, registry, objects: WORLD_KERNEL_OBJECTS, ...policy });
  const knowledge = createCoordinationKnowledge({ enabled: true, sharingEnabled: true });
  const query = createWorldKernelQuery({ pool: selectedPool, registry, knowledge });
  const crafting = createCraftingContext({ registry, ...policy });
  const operations = createFamilyOperations({ pool: selectedPool, registry, kernel, definitions: COORDINATION_OPERATION_PILOT, ...policy });
  return { knowledge, operations, projection: createWorldProjection({ pool: selectedPool, query, kernel, knowledge, crafting,
    familyOperations: operations, recipeIds: [WORLD_KERNEL_RECIPE], mysteries: { registry, graphIds: [graphId],
      knowledgeEnabled: true, sharingEnabled: true, worldDefinitions: kernel.definitions } }) };
}
const { projection, operations, knowledge } = services();
const selected = { mysteryGraphId: graphId };
async function player(id, living = true) {
  await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [id]);
  await pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [id]);
  if (living) await pool.query("INSERT INTO characters(id,account_id,name,season,loc,respect,cash) VALUES($1,$2,$2,1,'docks',10000,100000)", [ch(id), id]);
}
const start = (id) => withItemTransaction(pool, (client) => startMystery(client, mysteryContext(id), owner(id), graphId));
const noSecret = (value) => {
  for (const text of [hidden, clue, secret.contentHash, secret.value.value, 'read-private-stamp']) assert(!JSON.stringify(value).includes(text), text);
};
function observedPool(trace, pause) {
  return { async query(sql, params) {
    trace.push({ sql: String(sql), params }); const result = await pool.query(sql, params);
    if (pause) await pause(String(sql), params); return result;
  }, async connect() {
    const client = await pool.connect();
    return { release: () => client.release(), async query(sql, params) {
      trace.push({ sql: String(sql), params }); const result = await client.query(sql, params);
      if (pause) await pause(String(sql), params); return result;
    } };
  } };
}
try {
  await pool.query(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  for (const id of ['case-author', 'case-reader', 'case-outsider']) await player(id);
  await player('case-empty', false);
  const fresh = await projection.snapshot('case-reader', selected);
  assert.deepEqual(fresh.cases, { catalog: [{ graphId, title: 'A Public Lead', status: 'available', started: false, canStart: true }], selected: null });
  const empty = await projection.snapshot('case-empty', selected);
  assert.equal(empty.cases.selected, null); assert.equal(empty.cases.catalog[0].canStart, false);
  for (const id of ['missing', 'automotive-salvage']) await assert.rejects(projection.snapshot('case-reader', { mysteryGraphId: id }), { code: 'projection_unavailable' });
  await start('case-reader'); await start('case-outsider');
  let view = await projection.snapshot('case-reader', selected); noSecret(view);
  assert.equal(view.cases.selected.owner.id, ch('case-reader'));
  assert.equal(view.cases.selected.nodes[0].description, 'Compare the surviving accounts.');
  assert.equal(view.cases.catalog[0].canStart, false);

  let run = (await commands.create('case-author', graph.id, { expectedContentHash: graph.contentHash }, key())).instance;
  run = (await commands.act('case-author', run.id, { expectedRevision: run.revision,
    actionId: run.actions.find((entry) => entry.kind === 'complete' && entry.nodeId === 'briefing').id }, key())).instance;
  await commands.act('case-author', run.id, { expectedRevision: run.revision, actionId: run.actions.find((entry) => entry.kind === 'discover').id }, key());
  const claimId = (await commands.knowledgeBoard('case-author')).claims[0].id;
  const share = async () => {
    const target = (await commands.knowledgeTargets('case-author', { characterName: 'case-reader' })).targets.find((entry) => entry.kind === 'account');
    const claim = (await commands.knowledgeGet('case-author', claimId)).claim;
    await commands.shareKnowledge('case-author', claimId, { targetId: target.id, expectedAclRevision: claim.aclRevision }, key());
  };
  const revoke = async () => {
    const claim = (await commands.knowledgeGet('case-author', claimId)).claim;
    await commands.revokeKnowledge('case-author', claimId, { grantId: claim.grants[0].id, expectedAclRevision: claim.aclRevision }, key());
  };
  await share();
  await pool.query("INSERT INTO gangs(id,name,tag) VALUES('case-family','Case Family','CASE')");
  await pool.query("INSERT INTO crews(id,name,leader_account) VALUES('case-crew','Case Crew','case-author')");
  for (const [accountId, role] of [['case-author', 'boss'], ['case-reader', 'soldier']]) {
    await pool.query("INSERT INTO gang_members(gang_id,character_id,role) VALUES('case-family',$1,$2)", [ch(accountId), role]);
    await pool.query("INSERT INTO crew_members(crew_id,account_id,name) VALUES('case-crew',$1,$1)", [accountId]);
  }
  const operation = await operations.create('case-author', { definitionId: COORDINATION_OPERATION_PILOT[0].id }, key());
  await operations.command('case-author', operation.operationId, 'publish', {}, key());
  await operations.command('case-reader', operation.operationId, 'join', { roleId: 'researcher' }, key());
  selected.operationId = operation.operationId;
  const trace = [];
  view = await services(observedPool(trace)).projection.snapshot('case-reader', selected);
  assert.equal(view.operations.selected.id, operation.operationId);
  assert(view.cases.selected.actions.some((action) => action.nodeId === hidden && action.kind === 'discover'));
  assert(!JSON.stringify(view.cases.selected.nodes).includes(clue), 'Eligible discovery does not disclose hidden clue prose');
  assert.equal(trace.filter((entry) => entry.sql === 'SELECT * FROM coordination_claims WHERE id=$1' && entry.params[0] === claimId).length, 1,
    'Operation, recipe, world and selected mystery authenticate their shared source only once');
  assert(!trace.some((entry) => /FOR UPDATE|FOR SHARE|^\s*(INSERT|UPDATE|DELETE)\b/i.test(entry.sql)));
  if (postgres) assert.equal(trace.filter((entry) => /BEGIN ISOLATION LEVEL REPEATABLE READ, READ ONLY/.test(entry.sql)).length, 1);
  noSecret(await projection.snapshot('case-outsider', { mysteryGraphId: graphId }));
  const standalone = await mysteryBoard(pool, mysteryContext('case-reader', view.asOf), owner('case-reader'), graphId);
  assert.deepEqual(view.cases.selected, standalone, 'Composed and standalone boards retain identical visibility and actions');
  let escaped;
  await withItemRead(pool, async (client) => {
    const plan = await planMysterySnapshot(client, mysteryContext('case-reader'), owner('case-reader'), graphId);
    escaped = plan;
    const wrongViewer = await knowledge.readSnapshot(client, { viewer: { accountId: 'case-outsider' }, groups: plan.groups });
    await assert.rejects(plan.render(wrongViewer), { code: 'bad_knowledge_snapshot' });
  });
  await assert.rejects(escaped.render({}), (error) => ['item_read_required', 'content_transaction_required'].includes(error.code));
  if (postgres) {
    let entered, release, paused = false;
    const ready = new Promise((resolve) => { entered = resolve; }), hold = new Promise((resolve) => { release = resolve; });
    const reading = services(observedPool([], async (sql) => {
      if (!paused && sql === 'SELECT * FROM coordination_claims WHERE id=$1') { paused = true; entered(); await hold; }
    })).projection.snapshot('case-reader', selected);
    await ready;
    try { await revoke(); } finally { release(); }
    assert((await reading).cases.selected.actions.some((action) => action.nodeId === hidden), 'Concurrent revocation cannot split an existing MVCC view');
  } else await revoke();
  view = await projection.snapshot('case-reader', selected); noSecret(view.cases.selected);
  assert(!view.worldObjects.length); assert(view.recipes[0].missing.includes('knowledge'));
  await share();
  await withItemTransaction(pool, (client) => discoverNode(client, mysteryContext('case-reader'), owner('case-reader'), graphId, hidden,
    { idempotencyKey: key(), interactionId: 'read-private-stamp' }));
  view = await projection.snapshot('case-reader', selected);
  assert.equal(view.cases.selected.nodes.find((node) => node.id === hidden).description, clue);
  await revoke();
  view = await projection.snapshot('case-reader', selected);
  assert(view.cases.selected.nodes.some((node) => node.id === hidden), 'Past discovery persists while current completion eligibility disappears');
  assert(!view.cases.selected.actions.some((action) => action.nodeId === hidden));
  await pool.query("UPDATE characters SET alive=false WHERE id=$1", [ch('case-reader')]);
  await pool.query("INSERT INTO characters(id,account_id,name,season,loc) VALUES('case-heir','case-reader','Case Heir',1,'docks')");
  view = await projection.snapshot('case-reader', { mysteryGraphId: graphId });
  assert.equal(view.cases.selected, null); assert.equal(view.cases.catalog[0].started, false); noSecret(view.cases);
  console.log(`world-projection-mysteries ${postgres ? 'PostgreSQL' : 'pg-mem'}: composition, privacy, eligibility, scope and current-character isolation PASS`);
} finally { await cleanup(); }
