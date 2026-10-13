import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildServer } from '../src/server.js';
import { withTwoCharacters } from '../src/game.js';
import { runEstate } from '../src/social/estate.js';
import { hasContact } from '../src/contacts.js';
import { readPlayerIntel } from '../src/playerintel.js';
import { NEIGHBORHOOD_QUEST_GRAPH_ID, NEIGHBORHOOD_INITIATION_PACKAGE } from '../src/content/neighborhood-initiation.js';

assert(!process.env.DATABASE_URL, 'City presence HTTP fixtures require disposable pg-mem.');
const app = await buildServer();
async function actor(name, kind = 'player') {
  const guest = await app.inject({ method: 'POST', url: '/v1/auth/guest', payload: { birthDate: '1990-01-01' } });
  assert.equal(guest.statusCode, 200);
  const headers = { authorization: 'Bearer ' + guest.json().token };
  const created = await app.inject({ method: 'POST', url: '/v1/character', headers, payload: { name } });
  assert.equal(created.statusCode, 200, created.body);
  const id = (await app.pool.query('SELECT id FROM characters WHERE name=$1 AND alive', [name])).rows[0].id;
  await app.pool.query("UPDATE characters SET loc='docks',is_npc=$2 WHERE id=$1", [id, kind === 'npc']);
  if (kind === 'agent') await app.pool.query('UPDATE account_persistent SET agent_flag=true WHERE account_id=(SELECT account_id FROM characters WHERE id=$1)', [id]);
  return { id, headers };
}
try {
  const me = await actor('City Viewer'), npc = await actor('City Resident', 'npc'), agent = await actor('City Machine', 'agent'), human = await actor('City Human');
  for (const url of ['/v1/city/presence', '/v1/city/intel']) assert.equal((await app.inject({ url })).statusCode, 401);
  const page = await app.inject({ url: '/v1/city/presence?limit=40', headers: me.headers });
  assert.equal(page.statusCode, 200, page.body); assert.equal(page.headers['cache-control'], 'private, no-store');
  const presence = page.json();
  for (const [target, kind] of [[npc,'npc'], [agent,'agent'], [human,'player']]) assert.equal(presence.actors.find(a => a.id === target.id).kind, kind);
  for (const target of [agent, human]) {
    const card = presence.actors.find(a => a.id === target.id);
    for (const field of ['name', 'level', 'gangTag', 'online', 'lastSeenDistrict', 'observedAt', 'source', 'sourceName']) assert.equal(card[field], null);
  }
  assert.equal(presence.actors.find(a => a.id === npc.id).name, 'City Resident', 'Public resident lore remains visible.');
  const action = presence.actors.find(a => a.id === npc.id).actions[0];
  const headers = { ...me.headers, 'Idempotency-Key': crypto.randomUUID() };
  const fields = 'id,cash,bank,respect,health,energy,nerve,heat,muscle,cunning,speed,train_at';
  const before = (await app.pool.query(`SELECT ${fields} FROM characters ORDER BY id`)).rows;
  const meAccount = (await app.pool.query('SELECT account_id FROM characters WHERE id=$1', [me.id])).rows[0].account_id;
  const npcAccount = (await app.pool.query('SELECT account_id FROM characters WHERE id=$1', [npc.id])).rows[0].account_id;
  assert.equal(await readPlayerIntel(app.pool, meAccount, npc.id), null);
  assert.equal(await hasContact(app.pool, meAccount, npcAccount), false);
  const first = await app.inject({ method: action.method, url: action.path, headers, payload: action.body });
  assert.equal(first.statusCode, 200, first.body); assert.equal(first.json().journal.length, 1);
  assert.equal(first.json().objectives[0].status, 'available');
  assert.equal(first.headers['cache-control'], 'private, no-store');
  const sighting = await readPlayerIntel(app.pool, meAccount, npc.id);
  assert.equal(sighting.name, 'City Resident'); assert.equal(sighting.loc, 'docks'); assert.equal(sighting.source, 'city_encounter');
  assert.equal(new Date(sighting.observedAt).toISOString(), first.json().intel.collectedAt);
  assert.equal(await readPlayerIntel(app.pool, npcAccount, me.id), null, 'The source does not receive a reciprocal note.');
  assert.equal(await hasContact(app.pool, meAccount, npcAccount), false);
  assert.equal(await hasContact(app.pool, npcAccount, meAccount), false);
  const replay = await app.inject({ method: action.method, url: action.path, headers, payload: action.body });
  assert.equal(replay.statusCode, 200); assert.equal(replay.body, first.body);
  assert.equal(replay.headers['x-idempotent-replay'], 'true');
  assert.equal(replay.headers['cache-control'], 'private, no-store');
  assert.deepEqual(await readPlayerIntel(app.pool, meAccount, npc.id), sighting, 'A receipt replay never refreshes the notebook.');
  await app.pool.query("UPDATE characters SET loc='canal' WHERE id=$1", [npc.id]);
  const notebook = (await app.inject({ url: '/v1/streets', headers: me.headers })).json().streets.find(row => row.id === npc.id);
  assert.equal(notebook.loc, 'docks', 'An observed source moving away does not refresh the stored sighting.');
  assert.deepEqual(await readPlayerIntel(app.pool, meAccount, npc.id), sighting);
  await app.pool.query("UPDATE characters SET loc='docks' WHERE id=$1", [npc.id]);
  const changed = await app.inject({ method: 'POST', url: '/v1/city/encounters/' + human.id, headers, payload: action.body });
  assert.equal(changed.statusCode, 422, changed.body);
  const extra = await app.inject({ method: 'POST', url: action.path, headers: { ...me.headers, 'Idempotency-Key': crypto.randomUUID() }, payload: { ...action.body, kind: 'npc' } });
  assert.equal(extra.statusCode, 400);
  const missingKey = await app.inject({ method: 'POST', url: action.path, headers: me.headers, payload: action.body });
  assert.equal(missingKey.statusCode, 400);
  const humanAction = presence.actors.find(a => a.id === human.id).actions[0];
  await app.pool.query("UPDATE characters SET loc='canal' WHERE id=$1", [human.id]);
  const denied = await app.inject({ method: humanAction.method, url: humanAction.path,
    headers: { ...me.headers, 'Idempotency-Key': crypto.randomUUID() }, payload: humanAction.body });
  assert.equal(denied.statusCode, 400); assert.equal(denied.json().error, 'city_actor_unavailable');
  assert.equal(await readPlayerIntel(app.pool, meAccount, human.id), null, 'A distant actor supplies no new notebook knowledge.');
  await app.pool.query("UPDATE characters SET loc='docks' WHERE id=$1", [human.id]);
  const originalBoard = (await app.inject({ url: '/v1/city/intel', headers: me.headers })).json();
  assert(!JSON.stringify(originalBoard).includes('cross-check') && !JSON.stringify(originalBoard).includes('three-perspectives'));
  const questPath = '/v1/worldgraph/mysteries/' + encodeURIComponent(NEIGHBORHOOD_QUEST_GRAPH_ID);
  assert.equal((await app.inject({ method: 'POST', url: questPath + '/start', headers: { ...me.headers, 'Idempotency-Key': crypto.randomUUID() } })).statusCode, 200);
  for (const url of ['/v1/worldgraph/mysteries/city-intel/nodes/meet-new-face/complete', questPath + '/nodes/city-intel:npc/complete']) {
    const bypass = await app.inject({ method: 'POST', url, headers: { ...me.headers, 'Idempotency-Key': crypto.randomUUID() }, payload: { interactionId: 'city_encounter' } });
    assert(bypass.statusCode >= 400, 'Generic mystery completion cannot produce encounter intel.');
  }
  const firstStep = NEIGHBORHOOD_INITIATION_PACKAGE.nodes.find(n => n.id === 'mystery:neighborhood-fixer');
  const ordinaryDialogue = await app.inject({ method: 'POST', url: questPath + '/nodes/' + encodeURIComponent(firstStep.id) + '/complete',
    headers: { ...me.headers, 'Idempotency-Key': crypto.randomUUID() }, payload: { interactionId: firstStep.conditions[0].interactionId } });
  assert.equal(ordinaryDialogue.statusCode, 200, ordinaryDialogue.body);
  assert.deepEqual((await app.inject({ url: '/v1/city/intel', headers: me.headers })).json(), originalBoard);
  assert.deepEqual((await app.inject({ url: '/v1/city/intel', headers: human.headers })).json().journal, []);
  assert.deepEqual((await app.pool.query(`SELECT ${fields} FROM characters ORDER BY id`)).rows, before);
  const privateReader = await actor('Notebook HTTP Reader'), privateSource = await actor('Notebook Old Name');
  const privateAccount = app.jwt.verify(privateReader.headers.authorization.slice(7)).sub;
  const sourceAccount = app.jwt.verify(privateSource.headers.authorization.slice(7)).sub;
  const readRoster = async owner => {
    const reply = await app.inject({ url: '/v1/city/presence?limit=40', headers: owner.headers });
    assert.equal(reply.statusCode, 200, reply.body); assert.equal(reply.headers['cache-control'], 'private, no-store');
    return reply.json();
  };
  const unknown = (await readRoster(privateReader)).actors.find(row => row.id === privateSource.id);
  assert.equal(unknown.name, null); assert.equal(unknown.level, null);
  assert.equal(await readPlayerIntel(app.pool, privateAccount, privateSource.id), null, 'A presence GET creates no notebook knowledge.');
  const privateAction = unknown.actions[0], privateHeaders = { ...privateReader.headers, 'Idempotency-Key': crypto.randomUUID() };
  const privateReceipt = await app.inject({ method: privateAction.method, url: privateAction.path, headers: privateHeaders, payload: privateAction.body });
  assert.equal(privateReceipt.statusCode, 200, privateReceipt.body);
  const privateBody = privateReceipt.json(), learned = await readPlayerIntel(app.pool, privateAccount, privateSource.id);
  assert.equal(privateBody.encounteredActor.name, 'Notebook Old Name');
  assert.equal(privateBody.encounteredActor.observedAt, privateBody.intel.collectedAt);
  assert.equal(privateBody.encounteredActor.source, 'city_encounter');
  assert.deepEqual(privateBody.encounteredActor, privateBody.intel.source);
  await app.pool.query('UPDATE characters SET name=$2,respect=200000 WHERE id=$1', [privateSource.id, 'Notebook New Name']);
  const staleFacts = (await readRoster(privateReader)).actors.find(row => row.id === privateSource.id);
  assert.equal(staleFacts.name, 'Notebook Old Name'); assert.equal(staleFacts.level, privateBody.encounteredActor.level);
  assert.equal(staleFacts.observedAt, privateBody.intel.collectedAt); assert.equal(staleFacts.lastSeenDistrict, 'docks');
  assert.equal(staleFacts.online, null); assert.equal(staleFacts.gangTag, null);
  assert.deepEqual(await readPlayerIntel(app.pool, privateAccount, privateSource.id), learned);
  const otherOwner = (await readRoster(agent)).actors.find(row => row.id === privateSource.id);
  assert.equal(otherOwner.name, null); assert.equal(otherOwner.level, null); assert.equal(otherOwner.observedAt, null);
  await new Promise(resolve => setTimeout(resolve, 2));
  const updatedReceipt = await app.inject({ method: privateAction.method, url: privateAction.path,
    headers: { ...privateReader.headers, 'Idempotency-Key': crypto.randomUUID() }, payload: privateAction.body });
  assert.equal(updatedReceipt.statusCode, 200, updatedReceipt.body);
  assert.equal(updatedReceipt.json().encounteredActor.name, 'Notebook New Name');
  const updatedKnowledge = await readPlayerIntel(app.pool, privateAccount, privateSource.id);
  const historicalPrivate = await app.inject({ method: privateAction.method, url: privateAction.path, headers: privateHeaders, payload: privateAction.body });
  assert.equal(historicalPrivate.body, privateReceipt.body); assert.equal(historicalPrivate.headers['x-idempotent-replay'], 'true');
  assert.deepEqual(await readPlayerIntel(app.pool, privateAccount, privateSource.id), updatedKnowledge, 'HTTP replay cannot regress newer learned facts.');
  assert.equal(await readPlayerIntel(app.pool, sourceAccount, privateReader.id), null, 'The source learns no reciprocal identity.');
  assert.equal(await hasContact(app.pool, privateAccount, sourceAccount), false);
  assert.equal(await hasContact(app.pool, sourceAccount, privateAccount), false);
  const discovery = (await app.inject({ url: '/v1/discovery', headers: me.headers })).json();
  const discoveryIds = [...discovery.looking, ...discovery.peers, ...discovery.newcomers].map(a => a.id);
  assert(!discoveryIds.includes(npc.id) && !discoveryIds.includes(agent.id), 'Human-only Discovery remains unchanged.');
  const spec = (await app.inject({ url: '/openapi.json' })).json();
  const encounterSpec = spec.paths['/v1/city/encounters/{actorId}'].post;
  assert(encounterSpec.security?.length);
  assert.equal(encounterSpec.requestBody.content['application/json'].schema.additionalProperties, false);
  assert(encounterSpec.parameters.some(p => p.name === 'Idempotency-Key' && p.required));
  const originalGeneration = presence.viewer.generation;
  await app.pool.query('UPDATE characters SET generation=generation+1 WHERE id=$1', [me.id]);
  const stale = await app.inject({ method: 'POST', url: action.path, headers: { ...me.headers, 'Idempotency-Key': crypto.randomUUID() }, payload: action.body });
  assert.equal(stale.statusCode, 400); assert.equal(stale.json().error, 'city_identity_changed');
  const successor = (await app.inject({ url: '/v1/city/intel', headers: me.headers })).json();
  assert.equal(successor.viewer.generation, originalGeneration + 1); assert.deepEqual(successor.journal, []);
  // Existing HTTP replay is an immutable historical receipt, explicitly stamped with old viewer.
  const historical = await app.inject({ method: action.method, url: action.path, headers, payload: action.body });
  assert.equal(historical.body, first.body); assert.equal(historical.json().viewer.generation, originalGeneration);
  assert.deepEqual((await app.inject({ url: '/v1/city/intel', headers: me.headers })).json().journal, []);
  const collect = async (owner, target) => {
    const roster = await app.inject({ url: '/v1/city/presence?limit=40', headers: owner.headers });
    assert.equal(roster.statusCode, 200, roster.body);
    const issued = roster.json().actors.find(a => a.id === target.id).actions[0];
    const boundHeaders = { ...owner.headers, 'Idempotency-Key': crypto.randomUUID() };
    const response = await app.inject({ method: issued.method, url: issued.path, headers: boundHeaders, payload: issued.body });
    assert.equal(response.statusCode, 200, response.body);
    return { issued, headers: boundHeaders, response };
  };
  const doomedReceipt = await collect(me, npc), witnessReceipt = await collect(human, me);
  await collect(agent, me); // The executor knows the target before the controlled covert estate proof.
  const witnessBoard = (await app.inject({ url: '/v1/city/intel', headers: human.headers })).body;
  await app.pool.query('UPDATE characters SET last_accrued_at=$1 WHERE id IN ($2,$3)', [new Date(Date.now() + 86400000), me.id, agent.id]);
  const executorAccount = app.jwt.verify(agent.headers.authorization.slice(7)).sub;
  const estate = await withTwoCharacters(app.pool, executorAccount, me.id,
    (_ch, victim, client, h) => runEstate(client, h, victim, 'City HTTP lifecycle proof'), { meet: false });
  assert.equal(Number((await app.pool.query('SELECT COUNT(*) AS count FROM city_intel_progress WHERE character_id=$1', [me.id])).rows[0].count), 0);
  for (const recorded of [doomedReceipt, witnessReceipt]) {
    const replayed = await app.inject({ method: recorded.issued.method, url: recorded.issued.path, headers: recorded.headers, payload: recorded.issued.body });
    assert.equal(replayed.statusCode, 200, replayed.body); assert.equal(replayed.body, recorded.response.body);
    assert.equal(replayed.headers['x-idempotent-replay'], 'true');
  }
  assert.equal((await app.inject({ url: '/v1/city/intel', headers: human.headers })).body, witnessBoard, 'Another player retains the exact card about the deceased source.');
  const heirBoard = (await app.inject({ url: '/v1/city/intel', headers: me.headers })).json();
  assert.equal(heirBoard.viewer.characterId, estate.heirId); assert.equal(heirBoard.progress.totalEncounters, 0); assert.deepEqual(heirBoard.objectives, []);
  const oldFresh = await app.inject({ method: doomedReceipt.issued.method, url: doomedReceipt.issued.path,
    headers: { ...me.headers, 'Idempotency-Key': crypto.randomUUID() }, payload: doomedReceipt.issued.body });
  assert.equal(oldFresh.statusCode, 400); assert.equal(oldFresh.json().error, 'city_identity_changed');
  const heirReceipt = await collect(me, npc);
  const heirReplay = await app.inject({ method: heirReceipt.issued.method, url: heirReceipt.issued.path, headers: heirReceipt.headers, payload: heirReceipt.issued.body });
  assert.equal(heirReplay.body, heirReceipt.response.body);
  assert.equal((await app.inject({ url: '/v1/city/intel', headers: me.headers })).json().progress.totalEncounters, 1, 'Only one new heir encounter grants intel.');
  console.log('city-presence-api PASS: authenticated DTOs, exact HTTP replay/body binding, generic bypass denial, private generation state, OpenAPI, neutral resources');
  console.log('city-presence-api lifecycle PASS: actual estate, owner wipe, other-source cards, immutable historical HTTP receipts and one fresh heir grant');
} finally { await app.close(); }
