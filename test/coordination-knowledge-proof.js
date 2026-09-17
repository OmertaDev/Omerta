// A collective resolution authenticates every actor's complete evidence union once.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { newDb, DataType } from 'pg-mem';
import { dbCaps, registerPgMemCompatibility } from '../src/db.js';
import { withItemTransaction } from '../src/items.js';
import { createCoordinationKnowledge, knowledgeProofMatches } from '../src/coordination/knowledge.js';
import { createCoordinationService } from '../src/coordination/runtime.js';
import { coordinationGraphs } from '../src/coordination/graph.js';
import { COORDINATION_KNOWLEDGE_PILOT } from '../src/coordination/pilot.js';

const postgres = process.argv.includes('--postgres');
let pool, cleanup;
if (postgres) {
  assert(process.env.COORDINATION_TEST_DATABASE_URL, 'Explicit isolated PostgreSQL endpoint required');
  const endpoint = new URL(process.env.COORDINATION_TEST_DATABASE_URL);
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname));
  const { Pool } = await import('pg'), base = new Pool({ connectionString: endpoint.toString() });
  const namespace = `knowledge_proof_${crypto.randomBytes(8).toString('hex')}`;
  await base.query(`CREATE SCHEMA ${namespace}`);
  pool = new Pool({ connectionString: endpoint.toString(), options: `-c search_path=${namespace} -c lock_timeout=5000` });
  cleanup = async () => { await pool.end(); await base.query(`DROP SCHEMA ${namespace} CASCADE`); await base.end(); };
  dbCaps.skipLocked = true;
} else {
  const mem = newDb({ noAstCoverageCheck: true }); registerPgMemCompatibility(mem, DataType);
  const { Pool } = mem.adapters.createPg(); pool = new Pool(); cleanup = () => pool.end(); dbCaps.skipLocked = false;
}
const key = () => crypto.randomUUID();
const graph = coordinationGraphs(COORDINATION_KNOWLEDGE_PILOT)[0];
const requirement = { contentHash: graph.contentHash, ...graph.nodes.find(({ id }) => id === 'docks-source').claim };
const knowledge = createCoordinationKnowledge({ enabled: true, sharingEnabled: true });
const api = createCoordinationService({ pool, registry: COORDINATION_KNOWLEDGE_PILOT,
  enabled: true, knowledgeEnabled: true, sharingEnabled: true });
const actors = ['proof-a', 'proof-b', 'proof-reader'];
const character = (accountId) => ({ id: `${accountId}-ch`, account_id: accountId, alive: true });
const predicate = (accountId, input = requirement) => ({ accountId, characterId: `${accountId}-ch`, requirement: input });
const reject = (promise, code) => assert.rejects(promise, (error) => error.code === code, code);
const trace = [];
const tracedPool = (overflow = false) => ({ async connect() {
  const client = await pool.connect();
  return { async query(sql, params) {
    trace.push({ sql, params });
    if (overflow && /SELECT c.id FROM coordination_claims/.test(sql)) {
      return { rows: Array.from({ length: 257 }, (_, index) => ({ id: `overflow-${index}` })) };
    }
    return client.query(sql, params);
  }, release: () => client.release() };
} });
async function group(client, accountId, inputs = [requirement], service = knowledge) {
  return { context: await service.context(client, { accountId, character: character(accountId), lock: true }), requirements: inputs };
}
async function discover(accountId) {
  let instance = (await api.create(accountId, graph.id, { expectedContentHash: graph.contentHash }, key())).instance;
  instance = (await api.act(accountId, instance.id,
    { expectedRevision: instance.revision, actionId: instance.actions[0].id }, key())).instance;
  const action = instance.actions.find((candidate) => candidate.kind === 'discover');
  await api.act(accountId, instance.id, { expectedRevision: instance.revision, actionId: action.id }, key());
  return (await api.knowledgeBoard(accountId)).claims.find((claim) => claim.owned);
}
try {
  await pool.query(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  for (const account of actors) {
    await pool.query('INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,$2,$1)', [account, 'test']);
    await pool.query("INSERT INTO characters(id,account_id,name,season,loc) VALUES($1,$2,$2,1,'docks')", [`${account}-ch`, account]);
  }
  const claims = [await discover(actors[0]), await discover(actors[1])];
  // Visit actors in descending claim order so per-actor locking would demonstrably invert it.
  const actorOrder = actors.slice(0, 2).sort((a, b) => claims[actors.indexOf(b)].id.localeCompare(claims[actors.indexOf(a)].id));
  let savedProof;
  await withItemTransaction(tracedPool(), async (client) => {
    const groups = [];
    for (const account of actorOrder) groups.push(await group(client, account));
    const mutable = structuredClone(requirement); groups[0].requirements = [mutable];
    savedProof = await knowledge.prepareRequirementProof(client, groups);
    mutable.value.value = 'changed after preparation';
    assert(Object.isFrozen(savedProof)); assert.deepEqual(Object.keys(savedProof), []);
    const beforeChecks = trace.length;
    for (const account of actors.slice(0, 2)) assert(knowledgeProofMatches(client, savedProof, predicate(account)));
    assert(!knowledgeProofMatches(client, savedProof, predicate(actors[2])));
    assert(!knowledgeProofMatches(client, savedProof, { ...predicate(actors[0]), characterId: `${actors[1]}-ch` }));
    assert(!knowledgeProofMatches(client, savedProof, predicate(actorOrder[0], mutable)));
    assert(!knowledgeProofMatches(client, savedProof, { ...predicate(actors[0]), sharingEnabled: false }));
    assert.equal(trace.length, beforeChecks, 'Proof checks perform no SQL and cannot enlarge the locked union');
    assert.throws(() => knowledgeProofMatches(client, {}, predicate(actors[0])), (error) => error.code === 'bad_knowledge_proof');
    await reject(knowledge.prepareRequirementProof(client, groups), 'knowledge_proof_already_prepared');
  });
  const locks = trace.filter(({ sql }) => /SELECT \* FROM coordination_claims WHERE id=\$1 FOR UPDATE/.test(sql));
  assert.deepEqual(locks.map(({ params }) => params[0]), claims.map(({ id }) => id).sort());
  const firstLock = trace.findIndex(({ sql }) => /coordination_claims WHERE id=\$1 FOR UPDATE/.test(sql));
  assert(trace.slice(firstLock + 1).every(({ sql }) => !/SELECT c.id FROM coordination_claims/.test(sql)),
    'All candidate selection completes before any immutable claim lock');
  await withItemTransaction(pool, async (client) => {
    assert.throws(() => knowledgeProofMatches(client, savedProof, predicate(actors[0])), (error) => error.code === 'bad_knowledge_proof');
    const own = await group(client, actors[0]);
    await reject(knowledge.prepareRequirementProof(client, Array(9).fill(own)), 'bad_knowledge_requirement');
    await reject(knowledge.prepareRequirementProof(client, [{ ...own, requirements: Array(17).fill(requirement) }]), 'bad_knowledge_requirement');
    await reject(knowledge.prepareRequirementProof(client, Array(3).fill({ ...own, requirements: Array(11).fill(requirement) })), 'bad_knowledge_requirement');
    assert.deepEqual(await knowledge.matchesRequirements(client, own.context, [requirement]), [true], 'Phase1 boolean-array behavior is retained');
  });
  trace.length = 0;
  await withItemTransaction(tracedPool(true), async (client) => {
    const proof = await knowledge.prepareRequirementProof(client, [await group(client, actors[0])]);
    assert(!knowledgeProofMatches(client, proof, predicate(actors[0])));
  });
  assert(!trace.some(({ sql }) => /coordination_claims WHERE id=\$1 FOR UPDATE/.test(sql)),
    'An oversized candidate set fails closed before acquiring a partial lock batch');
  const disabled = createCoordinationKnowledge({ enabled: false });
  await withItemTransaction(pool, async (client) => {
    const proof = await disabled.prepareRequirementProof(client, [await group(client, actors[0], [requirement], disabled)]);
    assert(!knowledgeProofMatches(client, proof, predicate(actors[0])));
  });
  const target = (await api.knowledgeTargets(actors[0], { characterName: actors[2] })).targets.find((entry) => entry.kind === 'account');
  const shared = await api.shareKnowledge(actors[0], claims[0].id, { targetId: target.id, expectedAclRevision: 0 }, key());
  await withItemTransaction(pool, async (client) => {
    const proof = await knowledge.prepareRequirementProof(client, [await group(client, actors[2])]);
    assert(knowledgeProofMatches(client, proof, predicate(actors[2])));
  });
  await api.revokeKnowledge(actors[0], claims[0].id,
    { grantId: shared.claim.grants[0].id, expectedAclRevision: 1 }, key());
  await withItemTransaction(pool, async (client) => {
    const proof = await knowledge.prepareRequirementProof(client, [await group(client, actors[2])]);
    assert(!knowledgeProofMatches(client, proof, predicate(actors[2])), 'Revocation removes eligibility in the next transaction');
  });
  await pool.query("UPDATE coordination_claims SET discovery_receipt='forged' WHERE id=$1", [claims[0].id]);
  await reject(withItemTransaction(pool, async (client) => knowledge.prepareRequirementProof(client,
    [await group(client, actors[0])])), 'knowledge_corrupt');
  console.log(`coordination-knowledge-proof: global claim order, bounded authenticated actor predicates, transaction isolation and live ACLs passed (${postgres ? 'PostgreSQL' : 'pg-mem'})`);
} finally { await cleanup(); }
