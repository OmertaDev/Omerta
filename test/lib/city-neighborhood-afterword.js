// Real issued actions prove lasting prior-choice consequences without enabling new authority.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { cityAfterwordFixture, afterwordGraph as graph, mysteryRoot } from './city-afterword-fixture.js';
import { caseStory } from '../../src/ux-story.js';
export async function runCityNeighborhoodAfterwordProof() {
  const fixture = await cityAfterwordFixture();
  const { app, call, ok, denied, board, act, actionFor, start, explore, actor, finishBroadcast, economy } = fixture;
  const path = node => mysteryRoot(graph) + '/nodes/' + encodeURIComponent(node) + '/complete';
  try {
    const outsider = await actor('Afterword Outsider');
    await start(outsider);
    assert.deepEqual((await board(outsider)).nodes, [], 'An unfinished player receives neither future NPC account.');
    assert(!(await board(outsider)).uiActions.some(action => action.path.endsWith('/explore')),
      'The real UI issues no invitation before an ending is earned.');
    for (const branch of ['live', 'archive']) {
      const owner = await actor('Afterword ' + branch), other = branch === 'live' ? 'archive' : 'live';
      const ending = await finishBroadcast(owner, branch, { complete: false });
      await start(owner);
      assert.deepEqual((await board(owner)).nodes, [], 'A committed choice without the completed ending grants no follow-up.');
      await denied(call(owner, 'POST', path(`mystery:afterword-${branch}-invitation`), { interactionId: `${graph}:${branch}-invitation` }));
      await act(owner, ending);
      const before = await economy(owner);
      await explore(owner);
      let current = await board(owner);
      assert.equal(current.graph.id, graph);
      assert.equal(current.nodes.length, 1);
      assert.equal(current.nodes[0].id, `mystery:afterword-${branch}-invitation`);
      assert.equal(current.nodes[0].venueId, 'fixer', 'The invitation appears at the real City fixer.');
      assert(!JSON.stringify(current).includes(`afterword-${other}`), 'An unchosen future branch is not projected.');
      assert(!JSON.stringify(caseStory(current)).includes(`afterword-${other}`), 'Optional story reading has the same redaction.');
      const entry = await actionFor(owner, graph, current.nodes[0].id);
      await denied(call(outsider, 'POST', entry.path, entry.body));
      await denied(call(owner, 'POST', path(`mystery:afterword-${other}-invitation`), { interactionId: `${graph}:${other}-invitation` }));
      await denied(call(owner, 'POST', path(`mystery:afterword-${branch}-finale`), { interactionId: `${graph}:${branch}-finale` }));
      await act(owner, entry);
      await explore(owner);
      const workNode = `mystery:afterword-${branch}-work`;
      current = await board(owner);
      assert.equal(current.nodes.find(node => node.id === workNode).venueId, branch === 'live' ? 'workshop' : 'stories');
      const resumed = await ok(call(owner, 'POST', mysteryRoot(graph) + '/start', {}));
      assert.equal(resumed.instanceId, current.instanceId, 'Reload/resume preserves the actual committed invitation.');
      assert.deepEqual((await board(owner)).nodes, current.nodes, 'Reading again does not reroll the prior consequence.');
      await act(owner, await actionFor(owner, graph, workNode));
      await explore(owner);
      const finale = await actionFor(owner, graph, `mystery:afterword-${branch}-finale`), key = crypto.randomUUID();
      const result = await act(owner, finale, key);
      assert.deepEqual(await act(owner, finale, key), result, 'Exact-key finale recovery awards no second status.');
      await denied(call(owner, 'POST', finale.path, finale.body));
      current = await board(owner);
      assert.equal(current.status, 'completed');
      assert(current.nodes.some(node => node.id === `reward:afterword-${branch}` && node.status === 'completed'));
      assert(!JSON.stringify(current).includes(`afterword-${other}`));
      const story = caseStory(current);
      assert.equal(story.epilogue?.branch, branch); assert.equal(story.letters.length, 1);
      assert(story.cast.some(person => person.name === (branch === 'live' ? 'Ada Ferri' : 'Elena Serra')));
      assert.deepEqual(await economy(owner), before, 'The consequence changes story opportunities, never currency, stats or item ownership.');
      const missingFinale = structuredClone(current);
      missingFinale.nodes = missingFinale.nodes.filter(node => node.id !== `mystery:afterword-${branch}-finale`);
      assert.equal(caseStory(missingFinale).epilogue, null, 'A label alone cannot invent the lasting conclusion.');
      const death = await app.inject({ method: 'POST', url: '/v1/mod/kill', payload: { characterId: owner.id }, headers: { 'x-mod-key': 'afterword-disposable-actor-proof' } });
      assert.equal(death.statusCode, 200, death.body);
      const heir = (await ok(call(owner, 'GET', '/v1/me'))).character;
      assert.notEqual(heir.id, owner.id);
      await start(owner);
      assert.deepEqual((await board(owner)).nodes, [], 'A new character does not inherit a predecessor’s branch keepsake or follow-up.');
      await denied(call(owner, 'POST', entry.path, entry.body));
    }
    console.log('city-neighborhood-afterword: both prior endings open distinct real NPC paths; unfinished/foreign/heir/other-branch denial, hidden prose, durable resume, exact replay and economy neutrality PASS');
  } finally { await app.close(); }
}
