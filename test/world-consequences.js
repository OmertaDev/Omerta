// Real canonical mutations feed history; fixtures provide equipment and social setup only.
import assert from 'node:assert/strict';
import { commandDatabase, addPlayer, characterId, key, postgres } from './lib/player-command-support.js';
import { withItemRead } from '../src/items.js';
import { withCharacter } from '../src/game.js';
import { leaveCrew, CREW_FIRST_CHARACTER_LOCKS } from '../src/crew.js';
import { loadGraphPackages } from '../src/worldgraph.js';
import { createWorldKernel } from '../src/world-kernel.js';
import { createCoordinationKnowledge } from '../src/coordination/knowledge.js';
import { createCoordinationService } from '../src/coordination/runtime.js';
import { coordinationGraphs } from '../src/coordination/graph.js';
import { COORDINATION_KNOWLEDGE_PILOT } from '../src/coordination/pilot.js';
import { createWorldConsequences, WORLD_CONSEQUENCE_LIMITS } from '../src/world-consequences.js';

const db = await commandDatabase('consequences'), pool = db.pool;
const boss = 'history-boss', stranger = 'history-stranger';
const graph = coordinationGraphs(COORDINATION_KNOWLEDGE_PILOT)[0];
const requirement = { contentHash: graph.contentHash, ...graph.nodes.find((node) => node.id === 'docks-source').claim };
const knowledge = createCoordinationKnowledge({ enabled: true, sharingEnabled: true });
const coordination = createCoordinationService({ pool, registry: COORDINATION_KNOWLEDGE_PILOT,
  enabled: true, knowledgeEnabled: true, sharingEnabled: true });
const registry = loadGraphPackages([{ id: 'history-fixture', version: 1, dependsOn: [], nodes: [
  { id: 'item:history-key', type: 'item_template', version: 1, visibility: 'public' },
] }]);
const objects = [{ id: 'facility:history', type: 'facility', title: 'Canal workshop', locationId: 'docks',
  states: ['sealed', 'examined', 'open'], initialState: 'sealed', publicStates: ['open'], knowledge: [requirement],
  actions: [['examine', 'sealed', 'examined'], ['reseal', 'examined', 'sealed'], ['open', 'examined', 'open'], ['close', 'open', 'sealed']]
    .map(([id, from, to]) => ({ id, from, to, itemTemplateId: 'item:history-key', materials: [] })) }];
const kernel = createWorldKernel({ pool, registry, objects, enabled: true, knowledgeEnabled: true, sharingEnabled: true });
const policies = [{ objectId: objects[0].id, publicDelaySeconds: 3600 }];
const history = createWorldConsequences({ definitions: kernel.definitions, policies });
const now = Date.now() + 86400000;
let revision = 0, queries = [];
async function mutate(actionId, time = now - 7200000 + revision * 1000) {
  const itemId = key();
  await pool.query("INSERT INTO item_instances(id,template_id,owner_scope,owner_id) VALUES($1,'item:history-key','account',$2)", [itemId, boss]);
  const receipt = await kernel.execute(boss, { objectId: objects[0].id, actionId, itemId, expectedRevision: revision }, key());
  revision = receipt.revision;
  await pool.query('UPDATE world_kernel_events SET occurred_at=$2 WHERE id=$1', [receipt.eventId, new Date(time)]);
  return receipt;
}
async function read(accountId, asOf = now, service = history) {
  return withItemRead(pool, async (client) => {
    const knowledgeSnapshot = await knowledge.readSnapshot(client, { viewer: { accountId, characterId: characterId(accountId) },
      groups: [{ accountId, characterId: characterId(accountId), requirements: [requirement] }], limit: 50 });
    const world = await kernel.readSnapshot(client, accountId, { knowledgeSnapshot, asOf });
    const query = client.query.bind(client);
    client.query = async (sql, values) => { queries.push(sql); return query(sql, values); };
    try {
      return await service.readSnapshot(client, { accountId, characterId: characterId(accountId), locationId: 'docks',
        worldObjects: world.objects, knowledge, knowledgeSnapshot, asOf });
    } finally { client.query = query; }
  });
}
try {
  await addPlayer(pool, boss); await addPlayer(pool, stranger);
  await pool.query("INSERT INTO gangs(id,name,tag) VALUES('history-family','History Family','HIST')");
  await pool.query("INSERT INTO gang_members(gang_id,character_id,role) VALUES('history-family',$1,'boss')", [characterId(boss)]);
  await pool.query("INSERT INTO crews(id,name,leader_account) VALUES('history-crew','History Crew',$1)", [boss]);
  await pool.query("INSERT INTO crew_members(crew_id,account_id,name) VALUES('history-crew',$1,$1)", [boss]);
  let discovery = (await coordination.create(boss, graph.id, { expectedContentHash: graph.contentHash }, key())).instance;
  discovery = (await coordination.act(boss, discovery.id, { expectedRevision: discovery.revision, actionId: discovery.actions[0].id }, key())).instance;
  await coordination.act(boss, discovery.id, { expectedRevision: discovery.revision,
    actionId: discovery.actions.find((entry) => entry.kind === 'discover').id }, key());

  assert.deepEqual(await read(stranger), { entries: [], truncated: false });
  const privateEvent = await mutate('examine');
  assert.deepEqual(await read(stranger), { entries: [], truncated: false }, 'Hidden consequence is indistinguishable from absence');
  const informed = await read(boss);
  assert.equal(informed.entries[0].id, privateEvent.eventId);
  assert.equal(informed.entries[0].informationLayer, 'DISCOVERED_INTELLIGENCE');
  assert.equal(informed.entries[0].cause, 'You helped bring about this change.');
  const firstPublic = await mutate('open');
  let outsider = await read(stranger);
  assert.deepEqual(outsider.entries.map((entry) => entry.id), [firstPublic.eventId]);
  assert.equal(outsider.entries[0].cause, null);
  assert.equal(outsider.entries[0].remainsActive, true);
  assert.equal(outsider.entries[0].informationLayer, 'LOCAL_RUMOR');
  for (const forbidden of [privateEvent.eventId, 'examined', 'sealed', 'history-boss', 'history-family', 'history-crew',
    'revision', 'mutation_id', 'definition_hash', 'actor_character_id', requirement.contentHash]) {
    assert(!JSON.stringify(outsider).includes(forbidden), forbidden);
  }

  // More than a complete history page of private changes cannot crowd out a public event.
  await mutate('close');
  for (let i = 0; i < 14; i++) { await mutate('examine'); await mutate('reseal'); }
  await mutate('examine');
  const recentPublic = await mutate('open', now - 1000);
  outsider = await read(stranger);
  assert.deepEqual(outsider.entries.map((entry) => entry.id), [firstPublic.eventId]);
  assert.equal(outsider.truncated, false, 'Private history length never changes public truncation');
  assert((await read(boss)).entries.some((entry) => entry.id === recentPublic.eventId), 'Genuine knowledge sees the consequence before public aftermath');
  const published = await read(stranger, now + 3600000);
  assert.deepEqual(published.entries.map((entry) => entry.id), [recentPublic.eventId, firstPublic.eventId]);
  assert.equal(published.entries[1].remainsActive, true, 'Known current state, not hidden revision history, determines active wording');
  assert.equal((await read(boss)).entries.length, WORLD_CONSEQUENCE_LIMITS.cards);
  assert((await read(boss)).truncated);
  await pool.query("INSERT INTO crew_members(crew_id,account_id,name) VALUES('history-crew',$1,$1)", [stranger]);
  const claim = (await coordination.knowledgeBoard(boss)).claims.find((entry) => entry.owned);
  const target = (await coordination.knowledgeTargets(boss)).targets.find((entry) => entry.kind === 'crew');
  await coordination.shareKnowledge(boss, claim.id, { targetId: target.id, expectedAclRevision: claim.aclRevision }, key());
  assert((await read(stranger)).entries.some((entry) => entry.id === recentPublic.eventId), 'A real current Crew knowledge grant authorizes early history');
  const crewView = await read(stranger);
  assert(crewView.entries.some((entry) => entry.description.includes('examined')), 'Shared evidence authorizes private historical states');
  assert(crewView.entries.every((entry) => entry.cause === null), 'Knowing state never identifies another historical actor');
  await withCharacter(pool, stranger, (character, client, hooks) => leaveCrew(character, client, hooks), CREW_FIRST_CHARACTER_LOCKS);
  assert.deepEqual(await read(stranger), outsider, 'Crew departure removes private history and delayed aftermath on the next snapshot');
  assert.deepEqual(await read(stranger, now + 3600000, createWorldConsequences({ definitions: kernel.definitions, policies })), published,
    'Recreated readers project the same persisted history');
  assert(queries.every((sql) => /WHERE object_id=\$1 AND next_state=\$2 AND definition_hash=\$3 AND occurred_at<=\$4/.test(sql)
    && /ORDER BY occurred_at DESC,revision DESC LIMIT 25/.test(sql)), 'Every history read uses the indexed bounded visibility window');
  const manyObjects = Array.from({ length: 50 }, (_, index) => ({ id: `facility:history-budget-${index}`, type: 'facility',
    title: 'Public workshop', locationId: 'docks', states: ['open', 'closed'], initialState: 'open',
    publicStates: ['open', 'closed'], knowledge: [], actions: [] }));
  const manyKernel = createWorldKernel({ pool, registry, objects: manyObjects, enabled: true });
  const manyHistory = createWorldConsequences({ definitions: manyKernel.definitions });
  await withItemRead(pool, async (client) => {
    const knowledgeSnapshot = await knowledge.readSnapshot(client, { viewer: { accountId: stranger, characterId: characterId(stranger) }, groups: [], limit: 50 });
    const world = await manyKernel.readSnapshot(client, stranger, { knowledgeSnapshot, asOf: now });
    let count = 0;
    const query = client.query.bind(client);
    client.query = async (sql, values) => { count++; return query(sql, values); };
    try {
      const bounded = await manyHistory.readSnapshot(client, { accountId: stranger, characterId: characterId(stranger),
        locationId: 'docks', worldObjects: world.objects, knowledge, knowledgeSnapshot, asOf: now });
      assert.equal(count, WORLD_CONSEQUENCE_LIMITS.queries);
      assert.deepEqual(bounded, { entries: [], truncated: true }, 'Only publicly known windows contribute to the history budget');
    } finally { client.query = query; }
  });
  for (const policy of [[{ objectId: 'missing', publicDelaySeconds: 1 }], [{ ...policies[0], publicDelaySeconds: -1 }],
    [{ ...policies[0], publicDelaySeconds: 604801 }], [{ ...policies[0], actor: 'hidden' }], [policies[0], policies[0]]]) {
    assert.throws(() => createWorldConsequences({ definitions: kernel.definitions, policies: policy }), { code: 'bad_consequence_policy' });
  }
  const ledger = (await pool.query('SELECT count(*) n FROM world_kernel_events')).rows[0].n;
  await read(boss); await read(stranger);
  assert.equal((await pool.query('SELECT count(*) n FROM world_kernel_events')).rows[0].n, ledger, 'History never mutates canonical events');
  if (postgres) {
    assert((await pool.query("SELECT indexname FROM pg_indexes WHERE schemaname=current_schema() AND indexname='ix_world_kernel_event_visibility'")).rows.length);
  }
  console.log(`world-consequences ${postgres ? 'PostgreSQL' : 'memory'}: canonical history, private-state/actor redaction, delayed aftermath, bounds and restart PASS`);
} finally { await db.cleanup(pool); }
