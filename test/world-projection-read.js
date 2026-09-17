// Composable read-only views use one MVCC snapshot, never an executable knowledge proof.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { newDb, DataType } from 'pg-mem';
import { dbCaps, registerPgMemCompatibility } from '../src/db.js';
import { withItemRead, withItemTransaction, assertItemRead } from '../src/items.js';
import { createCoordinationKnowledge, assertKnowledgeSnapshot, snapshotRequirementMatches, assertKnowledgeProof } from '../src/coordination/knowledge.js';
import { createCoordinationService } from '../src/coordination/runtime.js';
import { COORDINATION_KNOWLEDGE_PILOT } from '../src/coordination/pilot.js';
import { coordinationGraphs } from '../src/coordination/graph.js';
import { loadGraphPackages } from '../src/worldgraph.js';
import { createWorldKernel } from '../src/world-kernel.js';
import { createWorldKernelQuery } from '../src/world-kernel-query.js';

const postgres = process.argv.includes('--postgres');
let pool, cleanup;
if (postgres) {
  assert(process.env.WORLD_KERNEL_TEST_DATABASE_URL, 'Explicit isolated PostgreSQL endpoint required');
  const endpoint = new URL(process.env.WORLD_KERNEL_TEST_DATABASE_URL);
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname));
  const { Pool } = await import('pg'), base = new Pool({ connectionString: endpoint.toString() });
  const namespace = `projection_read_${crypto.randomBytes(8).toString('hex')}`;
  await base.query(`CREATE SCHEMA ${namespace}`);
  pool = new Pool({ connectionString: endpoint.toString(), options: `-c search_path=${namespace} -c lock_timeout=5000 -c statement_timeout=10000` });
  cleanup = async () => { await pool.end(); await base.query(`DROP SCHEMA ${namespace} CASCADE`); await base.end(); };
  dbCaps.skipLocked = true;
} else {
  const mem = newDb({ noAstCoverageCheck: true }); registerPgMemCompatibility(mem, DataType);
  const { Pool } = mem.adapters.createPg(); pool = new Pool(); cleanup = () => pool.end(); dbCaps.skipLocked = false;
}
const key = () => crypto.randomUUID(), boss = 'read-boss', donor = 'read-donor', stranger = 'read-stranger';
const characterId = (accountId) => `${accountId}-ch`;
const graph = coordinationGraphs(COORDINATION_KNOWLEDGE_PILOT)[0];
const requirement = { contentHash: graph.contentHash, ...graph.nodes.find((node) => node.id === 'docks-source').claim };
const unmet = { ...requirement, value: { type: 'text', value: 'An unlearned value' } };
const knowledge = createCoordinationKnowledge({ enabled: true, sharingEnabled: true });
const coordination = createCoordinationService({ pool, registry: COORDINATION_KNOWLEDGE_PILOT,
  enabled: true, knowledgeEnabled: true, sharingEnabled: true });
const registry = loadGraphPackages([{ id: 'read-fixture', version: 1, dependsOn: [], nodes: [
  { id: 'item:read-key', type: 'item_template', version: 1, visibility: 'public' },
  { id: 'mat:read-metal', type: 'material', version: 1, visibility: 'public' },
] }]);
const objects = [['facility:hidden', [requirement], ['open']], ['facility:public', [unmet], ['closed', 'open']]]
  .map(([id, requirements, publicStates]) => ({ id, type: 'facility', title: 'Read workshop', locationId: 'docks',
    states: ['closed', 'open'], initialState: 'closed', publicStates, knowledge: requirements,
    actions: [{ id: 'open', from: 'closed', to: 'open', itemTemplateId: 'item:read-key',
      materials: [{ templateId: 'mat:read-metal', quantity: 2 }] }] }));
const kernel = createWorldKernel({ pool, registry, objects, enabled: true, knowledgeEnabled: true, sharingEnabled: true });
const query = createWorldKernelQuery({ pool, registry });
const input = (accountId, requirements = [requirement, unmet]) => ({ accountId, characterId: characterId(accountId), requirements });
const predicate = (accountId, expected = requirement) => ({ accountId, characterId: characterId(accountId), requirement: expected });
const plan = (accountId = boss, groups = [input(accountId)]) => ({ viewer: { accountId }, groups, limit: 1 });
const reject = (promise, code) => assert.rejects(promise, { code });
const trace = [];
function observedPool(overflow = false) {
  const observedQuery = (client) => async (sql, params) => {
    trace.push({ sql, params });
    if (overflow && /SELECT c.id FROM coordination_claims/.test(sql)) {
      return { rows: Array.from({ length: 257 }, (_, index) => ({ id: `overflow-${index}` })) };
    }
    return client.query(sql, params);
  };
  return { query: observedQuery(pool), async connect() {
    const client = await pool.connect();
    return { release: () => client.release(), query: observedQuery(client) };
  } };
}
async function discover(accountId) {
  let instance = (await coordination.create(accountId, graph.id, { expectedContentHash: graph.contentHash }, key())).instance;
  instance = (await coordination.act(accountId, instance.id,
    { expectedRevision: instance.revision, actionId: instance.actions[0].id }, key())).instance;
  const action = instance.actions.find((candidate) => candidate.kind === 'discover');
  await coordination.act(accountId, instance.id, { expectedRevision: instance.revision, actionId: action.id }, key());
  return (await coordination.knowledgeBoard(accountId)).claims.find((claim) => claim.owned);
}
try {
  await pool.query(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  for (const account of [boss, donor, stranger, 'read-characterless']) {
    await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [account]);
    if (account !== 'read-characterless') await pool.query("INSERT INTO characters(id,account_id,name,season,loc) VALUES($1,$2,$2,1,'docks')",
      [characterId(account), account]);
  }
  await pool.query("INSERT INTO gangs(id,name,tag) VALUES('read-family','Read Family','READ')");
  await pool.query("INSERT INTO gang_members(gang_id,character_id,role) VALUES('read-family',$1,'boss')", [characterId(boss)]);
  await pool.query("INSERT INTO crews(id,name,leader_account) VALUES('read-crew','Read Crew',$1)", [boss]);
  await pool.query("INSERT INTO crew_members(crew_id,account_id,name) VALUES('read-crew',$1,$1)", [boss]);
  // Deliberately put the usable key outside the first inventory card.
  for (const [id, template] of [['000-visible-junk', 'item:irrelevant'], ['zzz-usable-key', 'item:read-key']]) {
    await pool.query("INSERT INTO item_instances(id,template_id,owner_scope,owner_id) VALUES($1,$2,'account',$3)", [id, template, boss]);
  }
  await pool.query("INSERT INTO item_stacks(owner_scope,owner_id,template_id,quality,quantity) VALUES('account',$1,'mat:read-metal','standard',2)", [boss]);
  const ownClaim = await discover(boss), privateClaim = await discover(donor);
  const beforeGuards = Number((await pool.query('SELECT count(*) n FROM item_mutation_guards')).rows[0].n);
  let saved, savedClient;
  await withItemRead(observedPool(), async (client) => {
    assertItemRead(client); savedClient = client;
    if (postgres) {
      assert.equal((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
      assert.equal((await client.query('SHOW transaction_isolation')).rows[0].transaction_isolation, 'repeatable read');
    }
    saved = await knowledge.readSnapshot(client, plan(boss, [input(boss), input(donor, [requirement])]));
    assertKnowledgeSnapshot(client, saved, boss);
    assert(snapshotRequirementMatches(client, saved, predicate(boss)));
    assert(snapshotRequirementMatches(client, saved, predicate(donor)), 'Another participant proves its own fact without sharing the fact to the viewer');
    assert(!snapshotRequirementMatches(client, saved, predicate(boss, unmet)));
    assert.deepEqual(saved.board.claims.map((claim) => claim.id), [ownClaim.id]);
    assert(!JSON.stringify(saved).includes(privateClaim.id)); assert(!JSON.stringify(saved).includes(donor));
    assert(Object.isFrozen(saved.board.claims[0].value));
    assert.throws(() => { saved.board.claims[0].value.value = 'mutated'; }, TypeError);
    assert.throws(() => assertKnowledgeSnapshot(client, { ...saved }, boss), { code: 'bad_knowledge_snapshot' });
    assert.throws(() => assertKnowledgeSnapshot(client, saved, stranger), { code: 'bad_knowledge_snapshot' });
    assert.throws(() => snapshotRequirementMatches(client, saved, predicate(stranger)), { code: 'knowledge_snapshot_scope' });
    assert.throws(() => snapshotRequirementMatches(client, saved, { ...predicate(boss), sharingEnabled: false }), { code: 'bad_knowledge_snapshot' });
    assert.throws(() => assertKnowledgeProof(client, saved), { code: 'bad_knowledge_proof' });
    const asOf = Date.now();
    const neighborhood = await query.readSnapshot(client, boss, { knowledgeSnapshot: saved, asOf, limit: 1 });
    const inventory = neighborhood.nodes.filter((node) => node.type === 'item');
    assert.deepEqual(inventory.map((item) => item.id), ['000-visible-junk']);
    const physical = await kernel.readSnapshot(client, boss, { knowledgeSnapshot: saved, asOf });
    const hidden = physical.objects.find((object) => object.id === 'facility:hidden');
    assert.equal(hidden.actions[0].canAttempt, true); assert.equal(hidden.actions[0].itemId, 'zzz-usable-key');
    const publiclySeen = physical.objects.find((object) => object.id === 'facility:public');
    assert.deepEqual(publiclySeen.actions[0].missing, ['knowledge']);
    for (const secret of [requirement.contentHash, requirement.domain, requirement.proposition, requirement.sourceRoot, ownClaim.id,
      'unlearned', 'item:read-key', 'mat:read-metal']) assert(!JSON.stringify(physical).includes(secret), `Object cards leaked ${secret}`);
    await reject(query.readSnapshot(client, stranger, { knowledgeSnapshot: saved, asOf }), 'bad_knowledge_snapshot');
    await reject(kernel.readSnapshot(client, boss, { knowledgeSnapshot: { ...saved }, asOf }), 'bad_knowledge_snapshot');
  });
  assert.throws(() => assertKnowledgeSnapshot(savedClient, saved, boss), { code: 'item_read_required' });
  await withItemRead(pool, async (client) => {
    assert.throws(() => assertKnowledgeSnapshot(client, saved, boss), { code: 'bad_knowledge_snapshot' });
  });
  await withItemTransaction(pool, async (client) => {
    await reject(knowledge.readSnapshot(client, plan()), 'item_read_required');
  });
  assert.equal(trace.filter(({ sql }) => /^BEGIN/.test(sql)).length, postgres ? 1 : 0);
  assert(!trace.some(({ sql }) => /\bFOR (?:UPDATE|SHARE)\b|^(?:INSERT|UPDATE|DELETE)\b/.test(sql)), 'Read adapters issue no row locks or writes');
  assert.equal(trace.filter(({ sql }) => sql === 'SELECT * FROM coordination_claims WHERE id=$1').length, 2, 'Each selected claim is fetched once across board and every actor predicate');
  assert.equal(trace.filter(({ sql }) => sql === 'SELECT * FROM coordination_events WHERE id=$1').length, 2, 'Claim authenticity is computed once, not once per projected card');
  assert.equal(Number((await pool.query('SELECT count(*) n FROM item_mutation_guards')).rows[0].n), beforeGuards);
  await withItemRead(pool, async (client) => {
    await reject(knowledge.readSnapshot(client, { ...plan(), viewer: { accountId: boss, characterId: characterId(donor) } }), 'knowledge_unavailable');
    await reject(knowledge.readSnapshot(client, plan(boss, [input(boss, Array(65).fill(requirement))])), 'bad_knowledge_requirement');
    await reject(knowledge.readSnapshot(client, plan(boss, Array.from({ length: 9 }, (_, i) => input(`unrelated-${i}`, [])))), 'bad_knowledge_requirement');
    const empty = await knowledge.readSnapshot(client, { viewer: { accountId: 'read-characterless' }, groups: [] });
    assert.deepEqual(empty.board.claims, []);
    assert.deepEqual(await kernel.readSnapshot(client, 'read-characterless', { knowledgeSnapshot: empty, asOf: Date.now() }), { objects: [], truncated: false });
    const unknowing = await knowledge.readSnapshot(client, plan(stranger));
    const seen = await kernel.readSnapshot(client, stranger, { knowledgeSnapshot: unknowing, asOf: Date.now() });
    assert.deepEqual(seen.objects.map((object) => object.id), ['facility:public']);
    assert(seen.objects[0].actions[0].missing.includes('family_authority'));
  });
  await reject(withItemRead(observedPool(true), (client) => knowledge.readSnapshot(client, plan())), 'knowledge_snapshot_limit');
  const target = (await coordination.knowledgeTargets(donor, { characterName: stranger })).targets.find((entry) => entry.kind === 'account');
  const shared = await coordination.shareKnowledge(donor, privateClaim.id, { targetId: target.id, expectedAclRevision: 0 }, key());
  const revoke = () => coordination.revokeKnowledge(donor, privateClaim.id, { grantId: shared.claim.grants[0].id, expectedAclRevision: 1 }, key());
  if (postgres) {
    let startRevoke;
    // Register the writer outside the read's AsyncLocalStorage transaction scope.
    const revoking = new Promise((resolve) => { startRevoke = resolve; }).then(revoke);
    revoking.catch(() => {});
    try {
      await withItemRead(pool, async (client) => {
        const old = await knowledge.readSnapshot(client, plan(stranger));
        assert(snapshotRequirementMatches(client, old, predicate(stranger)));
        startRevoke(); await revoking; // Must not wait for a projection row lock.
        const coherent = await knowledge.readSnapshot(client, plan(stranger));
        assert(snapshotRequirementMatches(client, coherent, predicate(stranger)), 'A concurrent revoke cannot split one MVCC snapshot');
      });
    } finally { startRevoke(); await revoking; }
  }
  else await revoke();
  await withItemRead(pool, async (client) => {
    const fresh = await knowledge.readSnapshot(client, plan(stranger));
    assert(!snapshotRequirementMatches(client, fresh, predicate(stranger)));
    assert.equal(fresh.board.claims.length, 0, 'The next snapshot observes committed revocation');
  });
  const originalValue = (await pool.query('SELECT value_json FROM coordination_claims WHERE id=$1', [ownClaim.id])).rows[0].value_json;
  await pool.query('UPDATE coordination_claims SET value_json=$2 WHERE id=$1', [ownClaim.id, JSON.stringify(unmet.value)]);
  try { await reject(withItemRead(pool, (client) => knowledge.readSnapshot(client, plan())), 'knowledge_corrupt'); }
  finally { await pool.query('UPDATE coordination_claims SET value_json=$2 WHERE id=$1', [ownClaim.id, originalValue]); }
  console.log(`world-projection-read: branded scoped facts, one authentic union, no row locks/writes, private views and actual custody passed (${postgres ? 'PostgreSQL' : 'pg-mem'})`);
} finally { await cleanup(); }
