// Shared domain facts use existing authority and one transaction-scoped proof.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { newDb, DataType } from 'pg-mem';
import { dbCaps, registerPgMemCompatibility } from '../src/db.js';
import { withItemTransaction, withItemRead, createItem, consumeItem } from '../src/items.js';
import { createWorldPrerequisites, prerequisiteMatches, prerequisiteReceipt } from '../src/world-prerequisites.js';
import { normalizeWorldPrerequisite } from '../src/world-knowledge.js';
import { createMysteryContext, mysteryDefinitionHash, startMystery, completeNode, discoverNode, commitChoice, mysteryBoard } from '../src/mysteries.js';
import { createCoordinationRegistry, coordinationGraphs } from '../src/coordination/graph.js';
import { createCoordinationService } from '../src/coordination/runtime.js';
import { createCoordinationKnowledge, knowledgeProofMatches } from '../src/coordination/knowledge.js';
import { compileWorldObjects, createWorldKernel } from '../src/world-kernel.js';
import { createFamilyOperations } from '../src/coordination/operations.js';
import { COORDINATION_OPERATION_PILOT } from '../src/content/coordination-operation-pilot.js';
import { COORDINATION_KNOWLEDGE_PILOT } from '../src/coordination/pilot.js';
import { WORLD_KERNEL_OBJECTS, WORLD_KERNEL_REGISTRY } from '../src/content/world-kernel-pilot.js';
import { PHASE1_WORLD_GRAPH_PACKAGES } from '../src/content/phase1.js';
import { loadAndValidateGraphPackages } from '../src/worldgraph-validate.js';

const postgres = process.argv.includes('--postgres');
let pool, cleanup;
if (postgres) {
  assert(process.env.COORDINATION_TEST_DATABASE_URL, 'Explicit COORDINATION_TEST_DATABASE_URL required');
  const endpoint = new URL(process.env.COORDINATION_TEST_DATABASE_URL);
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname));
  const { Pool } = await import('pg');
  const base = new Pool({ connectionString: endpoint.toString() });
  const namespace = `world_prerequisites_${crypto.randomBytes(8).toString('hex')}`;
  await base.query(`CREATE SCHEMA ${namespace}`);
  pool = new Pool({ connectionString: endpoint.toString(), options: `-c search_path=${namespace} -c lock_timeout=8000 -c statement_timeout=15000` });
  cleanup = async () => { await pool.end(); await base.query(`DROP SCHEMA ${namespace} CASCADE`); await base.end(); };
  dbCaps.skipLocked = true;
} else {
  const mem = newDb({ noAstCoverageCheck: true }); registerPgMemCompatibility(mem, DataType);
  const { Pool } = mem.adapters.createPg(); pool = new Pool(); cleanup = () => pool.end(); dbCaps.skipLocked = false;
}
const key = () => crypto.randomUUID(), owner = (id) => ({ scope: 'account', id });
const tx = (fn) => withItemTransaction(pool, fn), read = (fn) => withItemRead(pool, fn);
const subject = (accountId, name = 'actor', characterId = `${accountId}-ch`) => ({ key: name, accountId, characterId });
const social = (relation, name) => ({ adapter: 'social', requirement: { relation, ...(name ? { subject: name } : {}) } });
const tool = { adapter: 'item_ownership', requirement: { templateId: 'item:precision_lock_tool', provenance: 'crafted' } };
const pkg = { id: 'prerequisite-fixture', version: 1, dependsOn: ['core-materials', 'automotive-salvage'], nodes: [
  { id: 'm:prerequisite-start', type: 'mystery_step', visibility: 'public' },
  { id: 'm:prerequisite-hidden', type: 'mystery_step', visibility: 'hidden', requires: ['m:prerequisite-start'],
    conditions: [tool, social('crew_member'), { adapter: 'explicit_interaction', value: 'inspect-private-tool' }] },
  { id: 'm:prerequisite-choice', type: 'choice', visibility: 'hidden', requires: ['m:prerequisite-hidden'],
    options: [{ id: 'left', excludes: ['m:prerequisite-right'] }, { id: 'right', excludes: ['m:prerequisite-left'] }] },
  { id: 'm:prerequisite-left', type: 'mystery_step', visibility: 'hidden', requires: ['m:prerequisite-choice'] },
  { id: 'm:prerequisite-right', type: 'mystery_step', visibility: 'hidden', requires: ['m:prerequisite-choice'] },
] };
const registry = loadAndValidateGraphPackages([...PHASE1_WORLD_GRAPH_PACKAGES, pkg]);
const pin = mysteryDefinitionHash(registry, pkg.id);
const ownState = { adapter: 'mystery_state', requirement: { graphId: pkg.id, graphVersion: 1, definitionHash: pin,
  nodeId: 'm:prerequisite-start', ownerScope: 'current_character', state: 'completed' } };
const context = (accountId, extra = {}) => createMysteryContext({ registry, accountId, prerequisitesEnabled: true, ...extra });
const worlds = compileWorldObjects(WORLD_KERNEL_REGISTRY, WORLD_KERNEL_OBJECTS), world = worlds[0];
const facts = createWorldPrerequisites({ enabled: true, worldDefinitions: worlds, knowledgeEnabled: true, sharingEnabled: true });
const closed = createWorldPrerequisites({ worldDefinitions: worlds });
const worldFact = (state, controller) => ({ adapter: 'world_state', requirement: { objectId: world.id,
  definitionHash: world.contentHash, state, ...(controller ? { controller } : {}) } });
const request = (requirements, extra = {}) => ({ subjects: [subject('alice')],
  groups: [{ subjectKey: 'actor', requirements }], asOf: Date.now(), ...extra });
const matches = async (requirements, service = facts, extra = {}) => read(async (client) => {
  const token = await service.readSnapshot(client, request(requirements, extra));
  return requirements.map((requirement) => prerequisiteMatches(client, token, { subjectKey: 'actor', requirement, mode: 'read' }));
});
const act = (fn, nodeId, options = {}) => tx((client) => fn(client, context('alice'), { scope: 'character', id: 'alice-ch' },
  pkg.id, nodeId, { idempotencyKey: key(), ...options }));
const board = () => mysteryBoard(pool, context('alice'), { scope: 'character', id: 'alice-ch' }, pkg.id);
async function player(id) {
  await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [id]);
  await pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [id]);
  await pool.query("INSERT INTO characters(id,account_id,name,season,loc,respect,cash) VALUES($1,$2,$2,1,'docks',10000,100000)", [`${id}-ch`, id]);
}
try {
  await pool.query(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  for (const id of ['alice', 'bob', 'outsider']) await player(id);
  await pool.query("INSERT INTO crews(id,name,leader_account) VALUES('crew-a','Crew A','alice'),('crew-b','Crew B','bob')");
  await pool.query("INSERT INTO crew_members(crew_id,account_id,name) VALUES('crew-a','alice','alice'),('crew-b','bob','bob')");
  await pool.query("INSERT INTO gangs(id,name,tag) VALUES('family-a','Family A','FAA')");
  await pool.query("INSERT INTO gang_members(gang_id,character_id,role) VALUES('family-a','alice-ch','boss'),('family-a','bob-ch','soldier')");
  assert.deepEqual(await matches([ownState, tool, worldFact('open')]), [false, false, false], 'Absent facts do not assume initial state');
  for (const bad of [ { adapter: 'social', requirement: { relation: 'crew_member', accountId: 'bob' } },
    { adapter: 'item_ownership', requirement: { ...tool.requirement, quantity: 2 } },
    { adapter: 'world_state', requirement: { ...worldFact('open').requirement, controller: 'family-a' } } ]) {
    assert.throws(() => normalizeWorldPrerequisite(bad), { code: 'bad_world_prerequisite' });
  }
  const actorOwner = { scope: 'character', id: 'alice-ch' };
  await tx((client) => startMystery(client, context('alice'), actorOwner, pkg.id));
  assert(!JSON.stringify(await board()).includes('inspect-private-tool'));
  await act(completeNode, 'm:prerequisite-start');
  assert.deepEqual(await matches([ownState]), [true]);
  const originalPin = (await pool.query("SELECT definition_hash FROM mystery_instances WHERE owner_id='alice-ch' AND graph_id=$1", [pkg.id])).rows[0].definition_hash;
  await pool.query("UPDATE mystery_instances SET definition_hash=NULL WHERE owner_id='alice-ch' AND graph_id=$1", [pkg.id]);
  assert.deepEqual(await matches([ownState]), [false], 'Legacy unpinned state cannot satisfy an exact prerequisite');
  await pool.query("UPDATE mystery_instances SET definition_hash=$2 WHERE owner_id='alice-ch' AND graph_id=$1", [pkg.id, originalPin]);
  assert.deepEqual(await matches([ownState], closed), [false], 'Default-off policy fails closed');
  const wrong = { adapter: 'mystery_state', requirement: { ...ownState.requirement, definitionHash: '0'.repeat(64) } };
  assert.deepEqual(await matches([wrong]), [false], 'Graph version alone cannot replace executable pin');
  const outsiderInput = { subjects: [subject('outsider')], groups: [{ subjectKey: 'actor', requirements: [ownState] }] };
  assert.deepEqual(await matches([ownState], facts, outsiderInput), [false], 'A foreign completed node grants no authority');
  const imported = await tx((client) => createItem(client, owner('alice'), tool.requirement.templateId, 'imported', key()));
  assert.deepEqual(await matches([tool]), [false], 'Same template without crafted provenance is insufficient');
  const crafted = await tx((client) => createItem(client, owner('alice'), tool.requirement.templateId, 'crafted', key()));
  assert.deepEqual(await matches([tool]), [true]);
  let action = (await board()).actions.find((entry) => entry.kind === 'discover');
  assert.deepEqual(action, { kind: 'discover', nodeId: 'm:prerequisite-hidden', interactionId: 'inspect-private-tool' });
  await pool.query("DELETE FROM crew_members WHERE account_id='alice'");
  assert(!(await board()).actions.some((entry) => entry.nodeId === action.nodeId));
  await assert.rejects(act(discoverNode, action.nodeId, { interactionId: action.interactionId }), { code: 'prerequisite_required' });
  await pool.query("INSERT INTO crew_members(crew_id,account_id,name) VALUES('crew-a','alice','alice')");
  await act(discoverNode, action.nodeId, { interactionId: action.interactionId });
  await act(completeNode, action.nodeId, { interactionId: action.interactionId });
  action = (await board()).actions.find((entry) => entry.kind === 'discover');
  assert.equal(action.nodeId, 'm:prerequisite-choice'); await act(discoverNode, action.nodeId);
  action = (await board()).actions.find((entry) => entry.kind === 'choice' && entry.optionId === 'left'); assert(action);
  await tx((client) => commitChoice(client, context('alice'), actorOwner, pkg.id, action.nodeId, action.optionId, { idempotencyKey: key() }));
  assert(!(await board()).actions.some((entry) => ['m:prerequisite-choice', 'm:prerequisite-right'].includes(entry.nodeId)));
  const legacyBoard = await mysteryBoard(pool, context('alice', { prerequisitesEnabled: false }), actorOwner, pkg.id);
  assert(!Object.hasOwn(legacyBoard, 'actions'), 'Legacy board shape is unchanged');

  const relations = [social('family_officer'), social('same_family', 'peer'), social('different_crew', 'peer'), social('same_crew', 'peer')];
  const pair = { subjects: [subject('alice'), subject('bob', 'peer')], groups: [{ subjectKey: 'actor', requirements: relations }] };
  assert.deepEqual(await matches(relations, facts, pair), [true, true, true, false]);
  await pool.query("DELETE FROM crew_members WHERE account_id='bob'");
  assert.deepEqual(await matches(relations, facts, pair), [true, true, false, false], 'A missing Crew is not a different Crew');
  await pool.query("INSERT INTO crew_members(crew_id,account_id,name) VALUES('crew-b','bob','bob')");
  await assert.rejects(matches([social('same_crew', 'unknown')]), { code: 'bad_world_prerequisite' });
  let escaped;
  await tx(async (client) => {
    escaped = await facts.prepare(client, request([ownState, tool]));
    assert(prerequisiteMatches(client, escaped, { subjectKey: 'actor', requirement: ownState, mode: 'write' }));
    assert.equal(prerequisiteReceipt(client, escaped, { subjectKey: 'actor', requirements: [ownState] }).characterId, 'alice-ch');
    assert.throws(() => prerequisiteMatches(client, {}, { subjectKey: 'actor', requirement: ownState, mode: 'write' }), { code: 'bad_prerequisite_proof' });
    await assert.rejects(facts.prepare(client, request([ownState])), { code: 'prerequisites_already_prepared' });
  });
  await tx(async (client) => assert.throws(() => prerequisiteMatches(client, escaped,
    { subjectKey: 'actor', requirement: ownState, mode: 'write' }), { code: 'bad_prerequisite_proof' }));
  await read(async (client) => {
    const token = await facts.readSnapshot(client, request([ownState]));
    assert.throws(() => prerequisiteMatches(client, token, { subjectKey: 'actor', requirement: ownState, mode: 'write' }), { code: 'bad_prerequisite_proof' });
  });

  const definition = structuredClone(COORDINATION_OPERATION_PILOT[0]); definition.admission = [ownState];
  const kernel = createWorldKernel({ pool, registry: WORLD_KERNEL_REGISTRY, objects: WORLD_KERNEL_OBJECTS, enabled: true, knowledgeEnabled: true, sharingEnabled: true });
  const family = createFamilyOperations({ pool, registry: WORLD_KERNEL_REGISTRY, kernel, definitions: [definition], enabled: true,
    knowledgeEnabled: true, sharingEnabled: true, prerequisitesEnabled: true });
  assert.equal((await family.catalog('alice')).operations.length, 1);
  assert.equal((await family.catalog('bob')).operations.length, 0, 'Secret definition is omitted before DTO construction');
  await pool.query("UPDATE gang_members SET role='underboss' WHERE character_id='bob-ch'");
  const before = Number((await pool.query('SELECT COUNT(*) AS n FROM world_operations')).rows[0].n);
  await assert.rejects(family.create('bob', { definitionId: definition.id }, key()), { code: 'coordination_operation_unavailable' });
  assert.equal(Number((await pool.query('SELECT COUNT(*) AS n FROM world_operations')).rows[0].n), before);
  const createKey = key(), receipt = await family.create('alice', { definitionId: definition.id }, createKey);
  const disabledFamily = createFamilyOperations({ pool, registry: WORLD_KERNEL_REGISTRY, kernel, definitions: [definition], enabled: true });
  assert.deepEqual(await disabledFamily.create('alice', { definitionId: definition.id }, createKey), receipt, 'Durable exact create replay precedes admission reevaluation');

  // A new coordination discovery authenticates a durable admission witness. Later
  // consumption cannot erase its source, and a forged witness cannot authenticate.
  const source = structuredClone(coordinationGraphs(COORDINATION_KNOWLEDGE_PILOT)[0]); delete source.contentHash;
  source.id = 'prerequisite-admission'; source.nodes.find((node) => node.id === 'docks-source').admission = [ownState, tool, social('crew_member')];
  const claimsRegistry = createCoordinationRegistry([source]), graph = coordinationGraphs(claimsRegistry)[0];
  const api = createCoordinationService({ pool, registry: claimsRegistry, enabled: true, knowledgeEnabled: true, sharingEnabled: true, prerequisitesEnabled: true });
  let run = (await api.create('alice', graph.id, { expectedContentHash: graph.contentHash }, key())).instance;
  const take = async (entry) => { assert(entry); run = (await api.act('alice', run.id, { expectedRevision: run.revision, actionId: entry.id }, key())).instance; };
  await take(run.actions.find((entry) => entry.kind === 'complete' && entry.nodeId === 'briefing'));
  await take(run.actions.find((entry) => entry.kind === 'discover'));
  const claim = (await api.knowledgeBoard('alice')).claims[0]; assert(claim);
  const claimSource = (await pool.query('SELECT source_event_id FROM coordination_claims WHERE id=$1', [claim.id])).rows[0];
  const sourceEvent = (await pool.query('SELECT payload_json FROM coordination_events WHERE id=$1', [claimSource.source_event_id])).rows[0];
  const tampered = JSON.parse(sourceEvent.payload_json); tampered.prerequisiteAdmission.characterId = 'outsider-ch';
  await pool.query('UPDATE coordination_events SET payload_json=$2 WHERE id=$1', [claimSource.source_event_id, JSON.stringify(tampered)]);
  await assert.rejects(api.knowledgeBoard('alice'), { code: 'knowledge_corrupt' }, 'A forged admission witness cannot authenticate');
  await pool.query('UPDATE coordination_events SET payload_json=$2 WHERE id=$1', [claimSource.source_event_id, sourceEvent.payload_json]);
  await tx((client) => consumeItem(client, owner('alice'), crafted.id, 'prerequisite fixture consumed', key()));
  assert.equal((await api.knowledgeBoard('alice')).claims.length, 1, 'Admission witness remains authentic after tool consumption');
  assert.deepEqual(await matches([tool]), [false]);
  const targets = (await api.knowledgeTargets('alice', { characterName: 'bob' })).targets;
  await api.shareKnowledge('alice', claim.id, { targetId: targets.find((entry) => entry.kind === 'account').id,
    expectedAclRevision: (await api.knowledgeGet('alice', claim.id)).claim.aclRevision }, key());
  const requirement = { contentHash: graph.contentHash, ...graph.nodes.find((node) => node.id === 'docks-source').claim };
  const hiddenSource = { ...WORLD_KERNEL_OBJECTS[0], id: 'facility:prerequisite-hidden', knowledge: [requirement] };
  const [hiddenWorld] = compileWorldObjects(WORLD_KERNEL_REGISTRY, [hiddenSource]);
  const hiddenFacts = createWorldPrerequisites({ enabled: true, worldDefinitions: [hiddenWorld], knowledgeEnabled: true, sharingEnabled: true });
  const hiddenPredicate = { adapter: 'world_state', requirement: { objectId: hiddenWorld.id, definitionHash: hiddenWorld.contentHash, state: 'sealed' } };
  await pool.query(`INSERT INTO world_kernel_objects(id,object_kind,location_id,definition_hash,state,controller_family_id)
    VALUES($1,'facility','foundry',$2,'sealed','family-a')`, [hiddenWorld.id, hiddenWorld.contentHash]);
  const knowledge = createCoordinationKnowledge({ enabled: true, sharingEnabled: true });
  const proveHidden = (after) => tx(async (client) => {
    const character = (await client.query("SELECT * FROM characters WHERE id='bob-ch' FOR UPDATE")).rows[0];
    const ctx = await knowledge.context(client, { accountId: 'bob', character, lock: true });
    const knowledgeProof = await knowledge.prepareRequirementProof(client, [{ context: ctx, requirements: [requirement] }]);
    const token = await hiddenFacts.prepare(client, { subjects: [subject('bob')], groups: [{ subjectKey: 'actor', requirements: [hiddenPredicate] }], asOf: Date.now(), knowledgeProof });
    const result = prerequisiteMatches(client, token, { subjectKey: 'actor', requirement: hiddenPredicate, mode: 'write' });
    if (after) await after(client, () => knowledgeProofMatches(client, knowledgeProof,
      { accountId: 'bob', characterId: 'bob-ch', requirement, sharingEnabled: true })); return result;
  });
  assert.equal(await proveHidden(), true);
  const revoke = async () => {
    const current = (await api.knowledgeGet('alice', claim.id)).claim;
    return api.revokeKnowledge('alice', claim.id, { grantId: current.grants[0].id, expectedAclRevision: current.aclRevision }, key());
  };
  if (postgres) {
    let entered, release;
    const ready = new Promise((resolve) => { entered = resolve; }), hold = new Promise((resolve) => { release = resolve; });
    const pending = proveHidden(async () => { entered(); await hold; }); await ready;
    const revocation = revoke();
    try {
      let blocked = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        blocked = (await pool.query("SELECT 1 FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND wait_event_type='Lock' AND query LIKE '%coordination_claims%'")).rows.length > 0;
        if (blocked) break; await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert(blocked, 'Revocation waits for the complete knowledge union before world facts are consumed');
    } finally { release(); }
    assert.equal(await pending, true); await revocation;
  } else await revoke();
  assert.equal(await proveHidden(), false, 'Next write observes current ACL revocation');
  if (postgres) {
    let entered, release;
    const ready = new Promise((resolve) => { entered = resolve; }), hold = new Promise((resolve) => { release = resolve; });
    const pending = proveHidden(async (_client, checkProof) => {
      assert.equal(checkProof(), false); entered(); await hold;
      assert.equal(checkProof(), false, 'A later grant cannot expand the already prepared candidate union');
    });
    await ready;
    try {
      const target = (await api.knowledgeTargets('alice', { characterName: 'bob' })).targets.find((entry) => entry.kind === 'account');
      await api.shareKnowledge('alice', claim.id, { targetId: target.id,
        expectedAclRevision: (await api.knowledgeGet('alice', claim.id)).claim.aclRevision }, key());
    } finally { release(); }
    assert.equal(await pending, false);
    assert.equal(await proveHidden(), true, 'The subsequent transaction can select the newly granted source');
    await revoke();
  }
  await pool.query("UPDATE world_kernel_objects SET state='open' WHERE id=$1", [hiddenWorld.id]);
  await pool.query(`INSERT INTO world_kernel_objects(id,object_kind,location_id,definition_hash,state,controller_family_id)
    VALUES($1,'facility','foundry',$2,'open','family-a')`, [world.id, world.contentHash]);
  assert.deepEqual(await matches([worldFact('open', 'current_family')]), [true]);
  const sql = [], observedPool = { query: (...args) => pool.query(...args), async connect() {
    const client = await pool.connect();
    return { release: () => client.release(), query(statement, ...args) {
      sql.push(String(statement)); return client.query(statement, ...args);
    } };
  } };
  {
    await withItemRead(observedPool, async (client) => {
      const token = await facts.readSnapshot(client, request([ownState, worldFact('open'), social('family_member')]));
      assert(prerequisiteMatches(client, token, { subjectKey: 'actor', requirement: ownState, mode: 'read' }));
    });
    assert(!sql.some((statement) => /FOR UPDATE|FOR SHARE|^\s*(INSERT|UPDATE|DELETE)\b/i.test(statement)), 'Projection facts never acquire command locks or write');
    if (postgres) assert.equal(sql.filter((statement) => /BEGIN ISOLATION LEVEL REPEATABLE READ, READ ONLY/.test(statement)).length, 1);
  }
  await pool.query("DELETE FROM gang_members WHERE character_id='alice-ch'");
  assert.deepEqual(await matches([worldFact('open', 'current_family')]), [false], 'Current control requires current Family membership');
  await pool.query("UPDATE characters SET alive=false WHERE id='alice-ch'");
  await pool.query("INSERT INTO characters(id,account_id,name,season,loc) VALUES('alice-heir','alice','Alice Heir',1,'docks')");
  assert.deepEqual(await matches([ownState]), [false], 'A dead original actor is not current');
  assert.deepEqual(await matches([ownState], facts, { subjects: [subject('alice', 'actor', 'alice-heir')] }), [false], 'An heir cannot inherit current-character deduction');
  assert.equal((await pool.query('SELECT state FROM item_instances WHERE id=$1', [imported.id])).rows[0].state, 'active');
  console.log(`world-prerequisites ${postgres ? 'PostgreSQL' : 'pg-mem'}: PASS`);
} finally { await cleanup(); }
