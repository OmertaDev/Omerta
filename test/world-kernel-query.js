// Bounded authoritative neighborhood + knowledge revocation proof. Optional real PostgreSQL
// mode uses a fresh loopback-only schema, never DATABASE_URL or an existing schema.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { newDb, DataType } from 'pg-mem';
import pg from 'pg';
import { dbCaps, registerPgMemCompatibility } from '../src/db.js';
import { createItem, grantStack, transferItem, withItemTransaction } from '../src/items.js';
import { createCoordinationKnowledge } from '../src/coordination/knowledge.js';
import { createCoordinationService } from '../src/coordination/runtime.js';
import { coordinationGraphs } from '../src/coordination/graph.js';
import { COORDINATION_KNOWLEDGE_PILOT } from '../src/coordination/pilot.js';
import { createWorldKernelQuery, worldRef } from '../src/world-kernel-query.js';
import { loadGraphPackages } from '../src/worldgraph.js';
import { weekOf, crewObjectiveOf } from '../src/rules.js';

let pool, admin, namespace;
const explicitDatabase = process.env.WORLD_KERNEL_QUERY_TEST_DATABASE_URL;
if (explicitDatabase) {
  const endpoint = new URL(explicitDatabase);
  assert(['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname), 'Only isolated loopback PostgreSQL is allowed');
  namespace = `world_kernel_query_test_${crypto.randomBytes(8).toString('hex')}`;
  admin = new pg.Pool({ connectionString: endpoint.toString() });
  await admin.query(`CREATE SCHEMA ${namespace}`);
  pool = new pg.Pool({ connectionString: endpoint.toString(), max: 8,
    options: `-c search_path=${namespace} -c lock_timeout=5000 -c statement_timeout=20000` });
  dbCaps.skipLocked = true;
} else {
  const mem = newDb({ noAstCoverageCheck: true });
  registerPgMemCompatibility(mem, DataType);
  const { Pool } = mem.adapters.createPg(); pool = new Pool();
  dbCaps.skipLocked = false;
}
const key = () => crypto.randomUUID();
const knowledge = createCoordinationKnowledge({ enabled: true, sharingEnabled: true });
const graph = coordinationGraphs(COORDINATION_KNOWLEDGE_PILOT)[0];
const api = createCoordinationService({ pool, registry: COORDINATION_KNOWLEDGE_PILOT,
  enabled: true, knowledgeEnabled: true, sharingEnabled: true });
const query = createWorldKernelQuery({ pool, knowledge });
const registry = loadGraphPackages([{ id: 'query-definitions', version: 1, dependsOn: [], nodes: [
  { id: 'mat:public-metal', type: 'material', version: 1, visibility: 'public' },
  { id: 'item:public-tool', type: 'item_template', version: 1, visibility: 'public' },
  { id: 'recipe:public-tool', type: 'recipe', version: 1, visibility: 'public',
    requires: ['mat:public-metal', 'mat:private-metal'],
    consumes: [{ templateId: 'mat:public-metal', quantity: 2 }, { templateId: 'mat:private-metal', quantity: 1 }],
    produces: [{ templateId: 'item:public-tool', quantity: 1 }] },
  { id: 'mat:private-metal', type: 'material', version: 1, visibility: 'hidden', metadata: { title: 'Secret material' } },
] }]);
const owns = (id) => ({ scope: 'account', id });
const mutate = (action) => withItemTransaction(pool, action);
const reject = (value, code) => assert.rejects(value, (error) => error.code === code, code);
const has = (view, type, id) => view.nodes.some((node) => node.ref === worldRef(type, id));
const affiliated = (view) => view.relationships.some((edge) => edge.type === 'affiliation');
async function player(id, name, loc = 'docks') {
  await pool.query('INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,$2,$1)', [id, 'test']);
  await pool.query('INSERT INTO characters(id,account_id,name,season,loc) VALUES($1,$2,$3,1,$4)', [`${id}-ch`, id, name, loc]);
}
async function discover(accountId) {
  let instance = (await api.create(accountId, graph.id, { expectedContentHash: graph.contentHash }, key())).instance;
  instance = (await api.act(accountId, instance.id,
    { expectedRevision: instance.revision, actionId: instance.actions[0].id }, key())).instance;
  const action = instance.actions.find((candidate) => candidate.kind === 'discover');
  await api.act(accountId, instance.id, { expectedRevision: instance.revision, actionId: action.id }, key());
  return (await api.knowledgeBoard(accountId)).claims.find((claim) => claim.owned);
}
function closedGraph(view) {
  const refs = new Set(view.nodes.map((node) => node.ref));
  assert.equal(refs.size, view.nodes.length);
  assert.equal(new Set(view.relationships.map((edge) => edge.ref)).size, view.relationships.length);
  for (const edge of view.relationships) assert(refs.has(edge.from) && refs.has(edge.to), 'Every edge has visible endpoints');
}

try {
  await pool.query(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  await player('query-a', 'Query Reader'); await player('query-b', 'Private Discoverer', 'foundry');
  await player('query-c', 'Solo Member');
  await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES('query-no-street','test','query-no-street')");
  await pool.query("INSERT INTO gangs(id,name,tag) VALUES('query-family','Query Family','QRY')");
  await pool.query("INSERT INTO crews(id,name,leader_account) VALUES('query-crew','Query Crew','query-b')");
  for (const id of ['query-a', 'query-b']) {
    await pool.query("INSERT INTO crew_members(crew_id,account_id,name) VALUES('query-crew',$1,$1)", [id]);
    await pool.query("INSERT INTO gang_members(gang_id,character_id) VALUES('query-family',$1)", [`${id}-ch`]);
  }
  await pool.query("UPDATE districts SET holder_gang='query-family' WHERE id='docks'");
  const ownItem = await mutate((client) => createItem(client, owns('query-a'), 'item:query-tool', 'crafted', key()));
  const foreignItem = await mutate((client) => createItem(client, owns('query-b'), 'item:secret-tool', 'crafted', key()));
  const transferred = await mutate((client) => createItem(client, owns('query-b'), 'item:passed-tool', 'crafted', key()));
  await mutate((client) => transferItem(client, owns('query-b'), owns('query-a'), transferred.id, 'secret-source-reason', key()));
  await mutate((client) => grantStack(client, owns('query-a'), 'mat:query-scrap', 3, 'standard', 'fixture', key()));
  await mutate((client) => grantStack(client, owns('query-a'), 'mat:public-metal', 2, 'standard', 'fixture', key()));
  await mutate((client) => grantStack(client, owns('query-b'), 'mat:secret-scrap', 8, 'standard', 'fixture', key()));
  await pool.query("INSERT INTO characters(id,account_id,name,season,alive) VALUES('query-old-street','query-a','Old Reader',1,false)");
  for (const [id, scope, ownerId, authority] of [
    ['query-own-mystery', 'account', 'query-a', 'query-a'],
    ['query-historical-mystery', 'character', 'query-old-street', 'query-a'],
    ['query-private-mystery', 'account', 'query-b', 'query-b'],
    ['query-mismatched-mystery', 'account', 'query-b', 'query-a'],
  ]) await pool.query(`INSERT INTO mystery_instances(id,owner_scope,owner_id,authority_account_id,graph_id,graph_version)
    VALUES($1,$2,$3,$4,$1,1)`, [id, scope, ownerId, authority]);
  for (const [id, crew, opener] of [
    ['query-crew-operation', 'query-crew', 'query-b'],
    ['query-opener-operation', 'private-crew', 'query-a'],
    ['query-private-operation', 'private-crew', 'query-b'],
  ]) await pool.query(`INSERT INTO world_operations(id,graph_id,graph_version,operation_node_id,crew_id,opened_by_account_id)
    VALUES($1,$1,1,$1,$2,$3)`, [id, crew, opener]);
  const oldItem = await mutate((client) => createItem(client, { scope: 'character', id: 'query-old-street' }, 'item:old', 'imported', key()));
  const ownClaim = await discover('query-a'), foreignClaim = await discover('query-b');

  let view = await query.snapshot('query-a');
  closedGraph(view);
  assert.equal(view.root, worldRef('player', 'query-a'));
  assert(has(view, 'item', ownItem.id)); assert(has(view, 'item', transferred.id));
  assert(!has(view, 'item', foreignItem.id)); assert(!has(view, 'item', oldItem.id));
  assert(has(view, 'knowledge', ownClaim.id)); assert(!has(view, 'knowledge', foreignClaim.id));
  assert(has(view, 'character', 'query-a-ch')); assert(has(view, 'crew', 'query-crew'));
  assert(has(view, 'family', 'query-family')); assert(has(view, 'territory', 'docks'));
  assert(affiliated(view));
  assert.deepEqual(view.relationships.find((edge) => edge.type === 'affiliation').derived, 'all_living_members');
  assert.equal(view.relationships.find((edge) => edge.type === 'affiliation').authority, false);
  assert(view.relationships.some((edge) => edge.type === 'control'));
  assert(has(view, 'mystery', 'query-own-mystery')); assert(has(view, 'mystery', 'query-historical-mystery'));
  assert(!has(view, 'mystery', 'query-private-mystery')); assert(!has(view, 'mystery', 'query-mismatched-mystery'));
  assert(has(view, 'operation', 'query-crew-operation')); assert(has(view, 'operation', 'query-opener-operation'));
  assert(!has(view, 'operation', 'query-private-operation'));
  for (const secret of ['query-b', 'Private Discoverer', 'query-old-street', 'secret-source-reason', foreignItem.id,
    foreignClaim.id, 'mat:secret-scrap', 'item:secret-tool']) assert(!JSON.stringify(view).includes(secret), `No leak: ${secret}`);
  assert(view.relationships.some((edge) => edge.type === 'provenance' && edge.from === worldRef('item', ownItem.id)));
  assert.equal(worldRef('item', 'a:b'), 'item:a%3Ab');
  assert.notEqual(worldRef('item', 'a:b'), worldRef('item', 'a%3Ab'));
  const withDefinitions = await createWorldKernelQuery({ pool, registry }).snapshot('query-a');
  closedGraph(withDefinitions);
  assert(has(withDefinitions, 'material', 'mat:public-metal'));
  assert.equal(withDefinitions.nodes.filter((node) => node.id === 'mat:public-metal').length, 1,
    'Registry material and runtime resource share one definition identity');
  assert(has(withDefinitions, 'recipe', 'recipe:public-tool'));
  assert(withDefinitions.relationships.some((edge) => edge.type === 'prerequisite'));
  assert(withDefinitions.relationships.some((edge) => edge.type === 'consumed_by' && edge.quantity === 2));
  assert(withDefinitions.relationships.some((edge) => edge.type === 'produced_by'));
  assert(!JSON.stringify(withDefinitions).includes('mat:private-metal'));
  assert(!JSON.stringify(withDefinitions).includes('Secret material'));
  assert.equal(worldRef('facility', 'place:one'), 'facility:place%3Aone');
  await reject(query.snapshot('query-a', { accountId: 'query-b' }), 'bad_world_query');
  for (const limit of [0, -1, 51, 1.5, Infinity]) await reject(query.snapshot('query-a', { limit }), 'bad_world_query');
  await reject(query.snapshot('missing-account'), 'world_query_unavailable');
  await pool.query("UPDATE accounts SET status='banned' WHERE id='query-c'");
  await reject(query.snapshot('query-c'), 'world_query_unavailable');
  await pool.query("UPDATE accounts SET status='active' WHERE id='query-c'");
  const noStreet = await query.snapshot('query-no-street');
  assert.equal(noStreet.nodes.length, 1, 'An active account needs no living character to query its account graph');

  // A crew leader's family never overrides an unaffiliated/mixed member.
  await pool.query("DELETE FROM gang_members WHERE character_id='query-a-ch'");
  assert(!affiliated(await query.snapshot('query-a')));
  await pool.query("INSERT INTO gang_members(gang_id,character_id) VALUES('query-family','query-a-ch')");
  await pool.query("INSERT INTO crew_members(crew_id,account_id,name) VALUES('query-crew','query-c','Solo Member')");
  assert(!affiliated(await query.snapshot('query-a')), 'A living familyless member blocks derived affiliation');
  await pool.query("UPDATE characters SET alive=false WHERE id='query-c-ch'");
  assert(affiliated(await query.snapshot('query-a')), 'Dead streets are not current family affiliation authority');

  const target = (await api.knowledgeTargets('query-b')).targets.find((entry) => entry.kind === 'crew');
  assert(target);
  const share = await api.shareKnowledge('query-b', foreignClaim.id, { targetId: target.id, expectedAclRevision: 0 }, key());
  view = await query.snapshot('query-a');
  assert(has(view, 'knowledge', foreignClaim.id));
  assert(view.relationships.some((edge) => edge.type === 'visibility' && edge.to === worldRef('knowledge', foreignClaim.id)));
  assert(!JSON.stringify(view).includes('query-b'), 'Shared knowledge never exposes discoverer identity');
  const bounded = await query.snapshot('query-a', { limit: 1 });
  closedGraph(bounded); assert.equal(bounded.truncated.items, true); assert.equal(bounded.truncated.knowledge, true);
  assert.equal(bounded.nodes.filter((node) => node.type === 'item').length, 1);
  assert.equal(bounded.nodes.filter((node) => node.type === 'knowledge').length, 1);
  const firstOwnedId = [ownItem.id, transferred.id].sort()[0];
  assert(has(bounded, 'item', firstOwnedId), 'The item batch uses stable ID ordering');
  const provenance = bounded.relationships.filter((edge) => edge.type === 'provenance');
  assert.equal(provenance.length, 1, 'The first visible item retains its provenance');
  assert(provenance.every((edge) => edge.from === worldRef('item', firstOwnedId)),
    'Provenance cannot escape the first-limit item batch');
  await pool.query("DELETE FROM crew_members WHERE account_id='query-a'");
  view = await query.snapshot('query-a');
  assert(!has(view, 'crew', 'query-crew')); assert(!has(view, 'knowledge', foreignClaim.id), 'Leaving the crew immediately removes shared visibility');
  assert(!has(view, 'operation', 'query-crew-operation'), 'Unassigned nonopener loses current-crew operation access');
  assert(has(view, 'operation', 'query-opener-operation'), 'Exact historical opener keeps its operation reference');
  assert(has(view, 'family', 'query-family'), 'Crew membership never substitutes for character family membership');
  await pool.query("INSERT INTO crew_members(crew_id,account_id,name) VALUES('query-crew','query-a','Query Reader')");
  await api.revokeKnowledge('query-b', foreignClaim.id,
    { grantId: share.claim.grants[0].id, expectedAclRevision: 1 }, key());
  assert(!has(await query.snapshot('query-a'), 'knowledge', foreignClaim.id), 'Revoked claim never reappears from a cached graph');

  // Repeated queries reproduce identities without inserting independent graph authority.
  const before = Number((await pool.query('SELECT count(*) AS n FROM item_mutation_guards')).rows[0].n);
  const first = await query.snapshot('query-a'), second = await query.snapshot('query-a');
  assert.deepEqual(second, first);
  assert.equal(Number((await pool.query('SELECT count(*) AS n FROM item_mutation_guards')).rows[0].n), before);

  // Diplomacy retains its existing public-board boundary: own-Family pact/war facts,
  // public coalition target/count, and only one's own coalition membership identity.
  for (const id of ['ally-one', 'ally-two', 'pending', 'expired', 'rival', 'secret-member', 'outside']) {
    await pool.query('INSERT INTO gangs(id,name,tag) VALUES($1,$1,$2)', [`query-${id}`, `Q${id}`]);
  }
  const future = new Date(Date.now() + 3600_000), past = new Date(Date.now() - 3600_000);
  for (const [other, accepted, until] of [
    ['query-ally-one', true, future], ['query-ally-two', true, future],
    ['query-pending', false, future], ['query-expired', true, past],
  ]) {
    const pair = ['query-family', other].sort();
    await pool.query('INSERT INTO gang_relations(gang_a,gang_b,accepted,until,proposed_by) VALUES($1,$2,$3,$4,$1)',
      [...pair, accepted, until]);
  }
  await pool.query(`INSERT INTO gang_relations(gang_a,gang_b,accepted,until,proposed_by)
    VALUES('query-outside','query-secret-member',true,$1,'query-outside')`, [future]);
  await pool.query("UPDATE gangs SET war_with='query-rival',war_until=$1 WHERE id='query-family'", [future]);
  for (const [id, expires] of [['query-public-a', future], ['query-public-b', future], ['query-public-empty', future], ['query-expired-coalition', past]]) {
    await pool.query(`INSERT INTO coalitions(id,target_gang,formed_by,expires_at)
      VALUES($1,'query-rival','query-secret-member',$2)`, [id, expires]);
  }
  for (const [coalition, member] of [['query-public-a', 'query-family'], ['query-public-a', 'query-secret-member'],
    ['query-public-b', 'query-outside']]) {
    await pool.query('INSERT INTO coalition_members(coalition_id,gang_id) VALUES($1,$2)', [coalition, member]);
  }
  const week = weekOf();
  for (const [crew, objectiveWeek, progress] of [['query-crew', week, 80], ['query-crew', week - 1, 999], ['private-crew', week, 777]]) {
    await pool.query(`INSERT INTO crew_objectives(crew_id,week,kind,target,progress,done)
      VALUES($1,$2,'crimes',100,$3,false)`, [crew, objectiveWeek, progress]);
  }
  for (const [account, n, claimed] of [['query-a', 3, false], ['query-b', 77, true]]) {
    await pool.query(`INSERT INTO crew_objective_progress(crew_id,week,account_id,n,claimed)
      VALUES('query-crew',$1,$2,$3,$4)`, [week, account, n, claimed]);
  }
  const objectiveId = JSON.stringify(['query-crew', week]);
  const diplomatic = await query.snapshot('query-a'); closedGraph(diplomatic);
  const alliances = diplomatic.relationships.filter((edge) => edge.type === 'alliance');
  assert.equal(alliances.length, 2);
  assert(alliances.every((edge) => edge.kind === 'pact' && edge.from === worldRef('family', 'query-family')));
  for (const hidden of ['query-pending', 'query-expired', 'query-secret-member', 'query-outside']) {
    assert(!has(diplomatic, 'family', hidden), `Diplomacy may not expose ${hidden}`);
  }
  assert(!has(diplomatic, 'coalition', 'query-expired-coalition'));
  const publicCoalition = diplomatic.nodes.find((node) => node.ref === worldRef('coalition', 'query-public-a'));
  assert.equal(publicCoalition.members, 2); assert.equal(publicCoalition.armed, true);
  const emptyCoalition = diplomatic.nodes.find((node) => node.ref === worldRef('coalition', 'query-public-empty'));
  assert.equal(emptyCoalition.members, 0); assert.equal(emptyCoalition.armed, false);
  assert(diplomatic.relationships.some((edge) => edge.type === 'membership'
    && edge.from === worldRef('family', 'query-family') && edge.to === publicCoalition.ref));
  assert(diplomatic.relationships.some((edge) => edge.type === 'rivalry' && edge.kind === 'war'
    && edge.from === worldRef('family', 'query-family') && edge.to === worldRef('family', 'query-rival')));
  assert(diplomatic.relationships.some((edge) => edge.type === 'rivalry' && edge.kind === 'coalition'
    && edge.from === publicCoalition.ref && edge.to === worldRef('family', 'query-rival')));
  const objective = diplomatic.nodes.find((node) => node.ref === worldRef('objective', objectiveId));
  assert.deepEqual({ kind: objective.kind, target: objective.target, progress: objective.progress,
    done: objective.done, mine: objective.mine, claimed: objective.claimed },
  { kind: 'crimes', target: 100, progress: 80, done: false, mine: 3, claimed: false });
  assert(!has(diplomatic, 'objective', JSON.stringify(['query-crew', week - 1])));
  assert(!has(diplomatic, 'objective', JSON.stringify(['private-crew', week])));
  assert(!JSON.stringify(diplomatic).includes('query-b'), 'Other member contributions/identities remain private');
  const smallDiplomacy = await query.snapshot('query-a', { limit: 1 }); closedGraph(smallDiplomacy);
  assert.equal(smallDiplomacy.truncated.alliances, true); assert.equal(smallDiplomacy.truncated.coalitions, true);
  assert.equal(smallDiplomacy.nodes.filter((node) => node.type === 'coalition').length, 1);
  assert.equal(smallDiplomacy.relationships.filter((edge) => edge.type === 'alliance').length, 1);
  let roundTrips = 0;
  const measuredQuery = createWorldKernelQuery({ pool: { async connect() {
    const client = await pool.connect();
    return { query: (...args) => { roundTrips++; return client.query(...args); }, release: () => client.release() };
  } } });
  await measuredQuery.snapshot('query-a', { limit: 1 }); const oneCoalitionTrips = roundTrips;
  roundTrips = 0; await measuredQuery.snapshot('query-a', { limit: 3 });
  assert.equal(roundTrips, oneCoalitionTrips, 'Coalition/identity reads use a fixed query count as the visible batch grows');
  const outsider = await query.snapshot('query-no-street'); closedGraph(outsider);
  assert(has(outsider, 'coalition', 'query-public-a'), 'Existing diplomacy board makes active coalitions public');
  assert(!outsider.nodes.some((node) => node.type === 'objective'));
  assert(!outsider.relationships.some((edge) => edge.type === 'alliance' || edge.kind === 'war' || edge.type === 'membership'),
    'A nonmember sees no private Family pact, war or coalition membership');
  await pool.query("DELETE FROM coalition_members WHERE coalition_id='query-public-a' AND gang_id='query-family'");
  await pool.query("UPDATE gangs SET war_until=$1 WHERE id='query-family'", [past]);
  const afterExpiry = await query.snapshot('query-a');
  assert(!afterExpiry.relationships.some((edge) => edge.kind === 'war'), 'Expired war is not a live rivalry');
  assert(!afterExpiry.relationships.some((edge) => edge.type === 'membership' && edge.to === publicCoalition.ref),
    'Leaving a coalition removes membership without hiding its public board');
  assert.equal(afterExpiry.nodes.find((node) => node.ref === publicCoalition.ref).armed, false);
  await pool.query("DELETE FROM crew_members WHERE account_id='query-a'");
  assert(!has(await query.snapshot('query-a'), 'objective', objectiveId), 'Leaving a crew revokes objective visibility');
  await pool.query("INSERT INTO crew_members(crew_id,account_id,name) VALUES('query-crew','query-a','Query Reader')");
  await pool.query("DELETE FROM crew_objectives WHERE crew_id='query-crew' AND week=$1", [week]);
  const fallback = (await query.snapshot('query-a')).nodes.find((node) => node.ref === worldRef('objective', objectiveId));
  const drawn = crewObjectiveOf('query-crew', week, 3);
  assert.equal(fallback.kind, drawn.kind); assert.equal(fallback.target, drawn.target); assert.equal(fallback.progress, 0);
  assert.equal((await pool.query("SELECT 1 FROM crew_objectives WHERE crew_id='query-crew' AND week=$1", [week])).rows.length, 0,
    'Querying a not-yet-materialized objective uses existing draw semantics without persisting a duplicate');

  // Family operations have a different read authority from legacy Crew operations.
  // A later Crew join must not disclose the previous Family's operation references.
  for (const id of ['owner', 'new-crewmate', 'family-reader', 'former-promiser', 'role-holder']) {
    await player(`boundary-${id}`, `Boundary ${id}`);
  }
  for (const id of ['one', 'two']) await pool.query('INSERT INTO gangs(id,name,tag) VALUES($1,$1,$2)',
    [`boundary-family-${id}`, `B${id}`]);
  for (const [account, familyId] of [['owner', 'one'], ['new-crewmate', 'two'], ['family-reader', 'one'],
    ['former-promiser', 'two'], ['role-holder', 'two']]) {
    await pool.query('INSERT INTO gang_members(gang_id,character_id) VALUES($1,$2)',
      [`boundary-family-${familyId}`, `boundary-${account}-ch`]);
  }
  for (const [crewId, leader] of [['recorded', 'owner'], ['other', 'family-reader']]) {
    await pool.query('INSERT INTO crews(id,name,leader_account) VALUES($1,$1,$2)',
      [`boundary-crew-${crewId}`, `boundary-${leader}`]);
  }
  for (const [account, crewId] of [['owner', 'recorded'], ['new-crewmate', 'recorded'], ['family-reader', 'other']]) {
    await pool.query('INSERT INTO crew_members(crew_id,account_id,name) VALUES($1,$2,$2)',
      [`boundary-crew-${crewId}`, `boundary-${account}`]);
  }
  const familyOperations = ['boundary-family-operation-a', 'boundary-family-operation-b'];
  for (const operationId of familyOperations) await pool.query(`INSERT INTO world_operations
    (id,graph_id,graph_version,operation_node_id,crew_id,opened_by_account_id,status,coordination_mode,
      family_id,run_key,coordination_definition_hash,coordination_definition_json,expires_at,resolution_seed)
    VALUES($1,'boundary-family-private-graph',1,$1,'boundary-crew-recorded','boundary-owner','recruiting','family',
      'boundary-family-one',$1,$2,'{}',$3,'boundary-seed')`, [operationId, 'a'.repeat(64), future]);
  await pool.query(`INSERT INTO world_operations(id,graph_id,graph_version,operation_node_id,crew_id,opened_by_account_id)
    VALUES('boundary-legacy-operation','boundary-legacy-graph',1,'boundary-legacy-objective','boundary-crew-recorded','boundary-owner')`);
  await pool.query(`INSERT INTO world_operation_roles(operation_id,role_id,account_id,character_id)
    VALUES($1,'historical-role','boundary-role-holder','boundary-role-holder-ch')`, [familyOperations[0]]);
  await pool.query(`INSERT INTO world_operation_commitments(operation_id,role_id,requirement_id,account_id,
    character_id,kind,quantity,state) VALUES($1,'former-role','presence','boundary-former-promiser',
    'boundary-former-promiser-ch','participation',1,'withdrawn')`, [familyOperations[0]]);
  const crewOnly = await query.snapshot('boundary-new-crewmate', { limit: 1 }); closedGraph(crewOnly);
  assert(has(crewOnly, 'operation', 'boundary-legacy-operation'), 'Legacy Crew visibility remains available');
  for (const hidden of [...familyOperations, 'boundary-family-private-graph']) {
    assert(!JSON.stringify(crewOnly).includes(hidden), `A new Crew member must not infer ${hidden}`);
  }
  assert.equal(crewOnly.truncated.operations, false, 'Hidden Family operations do not consume page slots or expose their count');
  const familyOnly = await query.snapshot('boundary-family-reader'); closedGraph(familyOnly);
  assert(familyOperations.every((operationId) => has(familyOnly, 'operation', operationId)),
    'Current Family members see their Family operations from another Crew');
  assert(!has(familyOnly, 'operation', 'boundary-legacy-operation'));
  assert.equal((await query.snapshot('boundary-family-reader', { limit: 1 })).truncated.operations, true);
  for (const actor of ['former-promiser', 'role-holder']) {
    const historical = await query.snapshot(`boundary-${actor}`); closedGraph(historical);
    assert(has(historical, 'operation', familyOperations[0]), 'Historical participation retains its authorized reference');
    assert(!has(historical, 'operation', familyOperations[1]));
    assert(!has(historical, 'operation', 'boundary-legacy-operation'));
  }
  await pool.query("DELETE FROM gang_members WHERE character_id='boundary-family-reader-ch'");
  assert(!has(await query.snapshot('boundary-family-reader'), 'operation', familyOperations[0]),
    'Leaving the Family removes a membership-only reference immediately');
  await pool.query("DELETE FROM gang_members WHERE character_id='boundary-owner-ch'");
  await pool.query("DELETE FROM crew_members WHERE account_id='boundary-owner'");
  const originalOpener = await query.snapshot('boundary-owner');
  assert(familyOperations.every((operationId) => has(originalOpener, 'operation', operationId)));
  assert(has(originalOpener, 'operation', 'boundary-legacy-operation'), 'Opener history survives both social memberships');
  await pool.query("UPDATE characters SET alive=false WHERE id='boundary-former-promiser-ch'");
  assert(has(await query.snapshot('boundary-former-promiser'), 'operation', familyOperations[0]),
    'A historical promiser needs no current character to retain its own operation reference');
  console.log('world-kernel-query: Family operation visibility matches current Family/opener/role/historical promise; legacy Crew policy retained');
  console.log(`world-kernel-query: authoritative refs, bounded graph, affiliation and knowledge visibility passed (${explicitDatabase ? 'PostgreSQL' : 'pg-mem'})`);
} finally {
  await pool.end();
  if (admin) { await admin.query(`DROP SCHEMA ${namespace} CASCADE`); await admin.end(); }
}
