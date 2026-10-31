import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { buildServer } from '../src/server.js';
import { register, storyClock, caseStory, storyCrossover } from '../src/ux-story.js';

assert(!process.env.DATABASE_URL, 'Story proof uses disposable pg-mem.');
process.env.INVITE_MODE = 'off'; process.env.RATE_LIMIT = 'off'; process.env.MOD_KEY = 'story-disposable-succession';
for (const [hour, lighting] of [[0, 'night'], [5, 'dawn'], [8, 'day'], [18, 'dusk'], [21, 'night']]) {
  const clock = storyClock(Date.UTC(2026, 9, 25, hour)); assert.equal(clock.hour, hour); assert.equal(clock.lighting, lighting);
}
assert.equal(storyCrossover([]), null);
const app = await buildServer();
if (!app.hasRoute({ method: 'GET', url: '/v1/ux/story' })) register(app, { pool: app.pool, auth: async req => req.jwtVerify() });
try {
  const call = async (method, url, player, payload, status = 200) => {
    const response = await app.inject({ method, url, payload, headers: { ...(player ? { authorization: 'Bearer ' + player.token } : {}), ...(method === 'POST' ? { 'idempotency-key': randomUUID() } : {}) } });
    assert.equal(response.statusCode, status, `${method} ${url}: ${response.body}`); return response.json();
  };
  await call('GET', '/v1/ux/story', null, undefined, 401);
  const players = [];
  for (const name of ['Story Listener', 'Story Questioner']) {
    const guest = await call('POST', '/v1/auth/guest', null, { birthDate: '1990-01-01' });
    const player = { token: guest.token, accountId: app.jwt.verify(guest.token).sub };
    await call('POST', '/v1/character', player, { name });
    player.characterId = (await app.pool.query('SELECT id FROM characters WHERE account_id=$1 AND alive', [player.accountId])).rows[0].id; players.push(player);
  }
  const [alice, bob] = players;
  const fresh = await call('GET', '/v1/ux/story', alice);
  assert.deepEqual(fresh.cast, []); assert.deepEqual(fresh.cases, []); assert.equal(fresh.crossover, null);
  assert.equal(typeof fresh.clock.serverTime, 'string'); assert.ok(fresh.clock.hour >= 0 && fresh.clock.hour < 24);
  await call('POST', '/v1/worldgraph/mysteries/neighborhood-initiation/start', alice, {});
  await call('GET', '/v1/ux/story/neighborhood-initiation', bob, undefined, 404);
  await call('GET', '/v1/ux/story/not-a-case', alice, undefined, 404);
  const beginning = await call('GET', '/v1/ux/story/neighborhood-initiation', alice);
  assert.ok(beginning.opening.text); assert.ok(beginning.cast.every(person => person.resident));
  assert.deepEqual(beginning.cast.map(person => person.name), ['Nico Bellini']);
  assert.equal(beginning.epilogue, null); assert.deepEqual(beginning.letters, []); assert.deepEqual(beginning.documents, []);
  assert.ok(!JSON.stringify(beginning).includes('mystery:neighborhood-listen'), 'no variants, portraits or documents from an unrevealed branch');
  const approachVariant = beginning.variants.find(variant => variant.nodeId === 'choice:neighborhood-approach');
  assert.ok(approachVariant.actionTerms.every(term => /permanent/.test(term.consequence)), 'expressive prose preserves the exact issued permanent-choice consequence');
  const finishNeighborhood = async (player, branch, started = false) => {
    if (!started) await call('POST', '/v1/worldgraph/mysteries/neighborhood-initiation/start', player, {});
    await call('POST', '/v1/worldgraph/mysteries/neighborhood-initiation/nodes/mystery%3Aneighborhood-fixer/complete', player, { interactionId: 'meet_neighborhood_fixer' });
    await call('POST', '/v1/worldgraph/mysteries/neighborhood-initiation/choices/choice%3Aneighborhood-approach', player, { interactionId: 'choose_neighborhood_approach', optionId: branch });
    const selected = await call('GET', '/v1/ux/story/neighborhood-initiation', player);
    assert.equal(selected.epilogue, null); assert.deepEqual(selected.letters, []);
    assert.ok(selected.cast.some(person => person.name === 'Ada Ferri'));
    assert.ok(!selected.variants.some(variant => variant.nodeId === `mystery:neighborhood-${branch === 'listen' ? 'ask' : 'listen'}`));
    await call('POST', `/v1/worldgraph/mysteries/neighborhood-initiation/nodes/mystery%3Aneighborhood-${branch}/complete`, player,
      { interactionId: branch === 'listen' ? 'inspect_neighborhood_watch' : 'inspect_neighborhood_delivery' });
    await call('POST', '/v1/worldgraph/mysteries/neighborhood-initiation/explore', player, {});
    const evidence = await call('GET', '/v1/ux/story/neighborhood-initiation', player);
    assert.equal(evidence.documents.length, 1); assert.ok(evidence.documents[0].text); assert.equal(evidence.epilogue, null);
    await call('POST', '/v1/worldgraph/mysteries/neighborhood-initiation/nodes/mystery%3Aneighborhood-newsroom/complete', player, { interactionId: 'publish_neighborhood_note' });
    return call('GET', '/v1/ux/story/neighborhood-initiation', player);
  };
  const listener = await finishNeighborhood(alice, 'listen', true), questioner = await finishNeighborhood(bob, 'ask');
  assert.equal(listener.epilogue.branch, 'listen'); assert.match(listener.epilogue.text, /clock/); assert.ok(!listener.epilogue.text.includes('old workshop entrance'));
  assert.equal(questioner.epilogue.branch, 'ask'); assert.match(questioner.epilogue.text, /old workshop entrance/); assert.ok(!questioner.epilogue.text.includes('stuck hand'));
  assert.equal(listener.letters.length, 1); assert.equal(listener.letters[0].from, 'Elena Serra'); assert.notEqual(listener.letters[0].text, questioner.letters[0].text);
  assert.equal((await call('GET', '/v1/ux/story', alice)).crossover, null, 'one actual completed case never unlocks the crossover');
  await app.pool.query('UPDATE characters SET respect=100000, loc=$1 WHERE id=$2', ['docks', alice.characterId]);
  await call('POST', '/v1/worldgraph/mysteries/property-investigation/start', alice, {});
  const propertyStep = async (suffix, interactionId, district) => {
    await app.pool.query('UPDATE characters SET loc=$1 WHERE id=$2', [district, alice.characterId]);
    await call('POST', '/v1/worldgraph/mysteries/property-investigation/nodes/' + encodeURIComponent('mystery:property-' + suffix) + '/complete', alice, { interactionId });
  };
  await propertyStep('briefing', 'property_briefing', 'docks');
  await propertyStep('ledger', 'property_inspect_ledger', 'docks');
  await call('POST', '/v1/worldgraph/mysteries/property-investigation/choices/choice%3Aproperty-approach', alice, { interactionId: 'property_choose_approach', optionId: 'witness' });
  await propertyStep('witness', 'property_interview_witness', 'neon');
  const multiple = await call('GET', '/v1/ux/story/property-investigation', alice);
  assert.equal(multiple.documents.length, 2); assert.ok(multiple.documents.every(document => document.text));
  assert.ok(!JSON.stringify(multiple).includes('evidence:property-records'), 'the competing unrevealed occupancy branch has no document or expressive variant');
  assert.equal(multiple.epilogue, null); assert.deepEqual(multiple.letters, []);
  await propertyStep('address', 'property_verify_address', 'neon');
  await propertyStep('survey', 'property_inspect_survey', 'foundry');
  await propertyStep('boundary', 'property_compare_boundary', 'foundry');
  await propertyStep('reconcile', 'property_reconcile_registry', 'docks');
  await propertyStep('verify-title', 'property_verify_title', 'docks');
  const verified = await call('GET', '/v1/ux/story/property-investigation', alice);
  assert.equal(verified.epilogue.branch, 'witness'); assert.match(verified.epilogue.text, /Mara/); assert.match(verified.epilogue.text, /separate action/);
  assert.match(verified.variants.find(node => node.nodeId === 'mystery:property-verify-title').text, /once you reach Level 25/);
  const propertyBoard = await call('GET', '/v1/worldgraph/mysteries/property-investigation', alice);
  assert.match(propertyBoard.nodes.find(node => node.id === 'mystery:property-verify-title').dialogue,
    /Gameplay property claims unlock at Level 25\./);
  assert.equal(verified.letters[0].from, 'Irene Bell');
  const overview = await call('GET', '/v1/ux/story', alice);
  assert.deepEqual(overview.crossover.prerequisites, [listener.instanceId, verified.instanceId]);
  assert.ok(overview.cast.some(person => person.name === 'Enzo Ferri')); assert.ok(overview.cast.every(person => person.resident));
  assert.equal((await call('GET', '/v1/ux/story', bob)).crossover, null);
  await call('GET', '/v1/ux/story/property-investigation', bob, undefined, 404);
  await app.pool.query('UPDATE characters SET loc=$1 WHERE id=$2', ['foundry', bob.characterId]);
  await call('POST', '/v1/worldgraph/mysteries/belladonna-demo/start', bob, {});
  const publicBelladonna = await call('GET', '/v1/ux/story/belladonna-demo', bob);
  assert.ok(!JSON.stringify(publicBelladonna).includes('belladonna-cipher-fragment'));
  assert.ok(!JSON.stringify(publicBelladonna).includes('fourth petal marks the false hinge'), 'role-private evidence never becomes document text, prose, cast or an epilogue');
  // The presentation route uses the same guarded reader as the actual case board; it grants nothing.
  const snapshot = async () => ({
    character: (await app.pool.query('SELECT cash,bank,respect,muscle,cunning,speed,ammo,loc,title,honor FROM characters WHERE id=$1', [alice.characterId])).rows,
    transactions: (await app.pool.query('SELECT id,amount,currency,reason FROM transactions WHERE character_id=$1', [alice.characterId])).rows,
    instances: (await app.pool.query('SELECT * FROM mystery_instances WHERE owner_id=$1', [alice.characterId])).rows,
    items: (await app.pool.query('SELECT * FROM item_instances WHERE owner_id=$1', [alice.characterId])).rows,
  });
  const before = await snapshot();
  await call('GET', '/v1/ux/story', alice); await call('GET', '/v1/ux/story/property-investigation', alice);
  assert.deepEqual(await snapshot(), before, 'story reads grant no currency, rewards, case progress, ownership or persistent gameplay stats');
  const raw = await call('GET', '/v1/worldgraph/mysteries/property-investigation', alice);
  raw.status = 'active'; assert.equal(caseStory(raw).epilogue, null, 'a terminal evidence set without actual completion gives no epilogue');
  raw.status = 'completed'; raw.nodes = raw.nodes.filter(node => node.id !== 'mystery:property-verify-title');
  assert.equal(caseStory(raw).epilogue, null, 'a completed label without the confirmed final step cannot fabricate a letter');
  const death = await app.inject({ method: 'POST', url: '/v1/mod/kill', payload: { characterId: bob.characterId }, headers: { 'x-mod-key': 'story-disposable-succession' } });
  assert.equal(death.statusCode, 200, death.body);
  const heir = (await call('GET', '/v1/me', bob)).character;
  assert.notEqual(heir.id, bob.characterId);
  const heirStories = await call('GET', '/v1/ux/story', bob);
  assert.deepEqual(heirStories.cases, []); assert.deepEqual(heirStories.cast, []); assert.equal(heirStories.crossover, null);
  await call('GET', '/v1/ux/story/neighborhood-initiation', bob, undefined, 404);
  console.log('Story API proof passed: authorized resident cast, revealed-only documents and variants, distinct real-choice epilogues, milestone letters, two-case crossover, server clock and no gameplay writes.');
} finally { await app.close(); }

// Keep the new real-choice continuation in the established UX CI entry point.
const { runCityNeighborhoodAfterwordProof } = await import('./lib/city-neighborhood-afterword.js');
await runCityNeighborhoodAfterwordProof();
