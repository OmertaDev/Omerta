import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PHASE1_WORLD_GRAPH_PACKAGES } from '../../src/content/phase1.js';

// Called by the existing district-arcs memory AND owned-schema native command.
export async function firstErrandProof(app) {
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(PHASE1_WORLD_GRAPH_PACKAGES.slice(0, 20))).digest('hex'),
    '351ec95b2762275f5a4ac4a3c18d65f62559a5ba3478245b5198cf5b2bb6599d', 'All 20 previously admitted packages remain exact.');
  const graph = 'first-errand-case-v2', base = '/v1/worldgraph/mysteries/' + graph;
  const request = (actor, method, url, body, key = crypto.randomUUID()) => app.inject({ method, url,
    ...(body !== undefined ? { payload: body } : {}), headers: { ...(actor?.headers || {}), ...(method === 'POST' ? { 'idempotency-key': key } : {}) } });
  const ok = async response => { const reply = await response; assert.equal(reply.statusCode, 200, reply.body); return reply.json(); };
  const create = async name => {
    const guest = await ok(request(null, 'POST', '/v1/auth/guest', { birthDate: '1990-01-01' }));
    const headers = { authorization: 'Bearer ' + guest.token }, account = app.jwt.verify(guest.token).sub;
    await ok(request({ headers }, 'POST', '/v1/character', { name }));
    const row = (await app.pool.query('SELECT id,generation,loc,cash,bank,heat,respect FROM characters WHERE account_id=$1 AND alive', [account])).rows[0];
    await app.pool.query('UPDATE characters SET last_accrued_at=$2 WHERE id=$1', [row.id, new Date(Date.now() + 86400000)]);
    return { ...row, account, headers };
  };
  const board = actor => ok(request(actor, 'GET', base));
  const balance = async actor => (await app.pool.query('SELECT cash,bank,heat,respect FROM characters WHERE id=$1', [actor.id])).rows[0];
  const send = (actor, action, key) => ok(request(actor, action.method, action.path, action.body, key));
  const lead = async (actor, nodeId) => {
    for (let attempt = 0; attempt < 14; attempt++) {
      const current = await board(actor), node = current.nodes.find(node => node.id === nodeId);
      if (node) return node;
      const explore = current.uiActions.find(action => action.path.endsWith('/explore') && action.available);
      assert(explore, 'The admitted case exposes a real route to ' + nodeId); await send(actor, explore);
    }
    assert.fail('Bounded discovery did not reach ' + nodeId);
  };
  const outsider = await create('Case Private Reader');
  for (const explanation of ['copied-date', 'missed-boat']) {
    const actor = await create('Case ' + explanation), before = await balance(actor);
    const index = await ok(request(actor, 'GET', '/v1/worldgraph/mysteries'));
    const entry = index.mysteries.find(row => row.graphId === graph);
    assert.equal(entry.version, 2); assert.equal(entry.title, 'Parcel 47');
    assert(!JSON.stringify(entry).includes('wrong departure date'), 'The public offer does not supply the answer.');
    await send(actor, entry.actions[0]);
    let current = await board(actor);
    assert(!current.nodes.some(node => node.type === 'evidence'), 'Unread records do not leak their acquired evidence.');
    const premature = await request(actor, 'POST', base + '/choices/choice%3Afirst-errand-explanation',
      { interactionId: graph + ':compare', optionId: explanation });
    assert(premature.statusCode >= 400, premature.body);
    await send(actor, current.nodes.find(node => node.id === 'mystery:first-errand-meet').uiActions[0]);
    const receipt = await lead(actor, 'mystery:first-errand-receipt'), receiptAction = receipt.uiActions[0];
    const noInteraction = await request(actor, 'POST', receiptAction.path, {});
    assert(noInteraction.statusCode >= 400, noInteraction.body);
    const spoof = await request(actor, 'POST', receiptAction.path, { ...receiptAction.body, characterId: outsider.id });
    assert.equal(spoof.statusCode, 400);
    const firstKey = crypto.randomUUID(), first = await send(actor, receiptAction, firstKey);
    assert.deepEqual(await send(actor, receiptAction, firstKey), first);
    current = await board(actor);
    assert.equal(current.nodes.filter(node => node.type === 'evidence' && node.status === 'completed').length, 1);
    assert(!current.nodes.some(node => node.id === 'choice:first-errand-explanation'), 'One record alone cannot disclose the comparison.');
    const loading = await lead(actor, 'mystery:first-errand-book'); await send(actor, loading.uiActions[0]);
    const comparison = await lead(actor, 'choice:first-errand-explanation');
    current = await board(actor);
    const facts = current.nodes.filter(node => node.type === 'evidence' && node.status === 'completed');
    assert.equal(facts.length, 2); assert(facts.every(node => /14 October/.test(node.description)));
    const choice = comparison.uiActions.find(action => action.body.optionId === explanation), key = crypto.randomUUID();
    assert(choice.available); const result = await send(actor, choice, key);
    assert.deepEqual(await send(actor, choice, key), result);
    const changed = await request(actor, 'POST', choice.path, { ...choice.body, optionId: explanation === 'copied-date' ? 'missed-boat' : 'copied-date' }, key);
    assert(changed.statusCode >= 400, changed.body);
    const refused = await request(actor, 'POST', choice.path, { ...choice.body, optionId: explanation === 'copied-date' ? 'missed-boat' : 'copied-date' });
    assert(refused.statusCode >= 400, refused.body);
    const follow = await lead(actor, explanation === 'copied-date' ? 'mystery:first-errand-side-door' : 'mystery:first-errand-public-desk');
    assert(follow.uiActions[0].available, 'The chosen account opens its concrete follow-up.');
    const items = (await ok(request(actor, 'GET', '/v1/worldgraph/inventory'))).currentCharacterItems;
    assert.equal(items.filter(item => item.templateId === 'item:first_errand_counterfoil').length, explanation === 'copied-date' ? 1 : 0);
    const wrong = await request(actor, 'POST', base + '/nodes/' + encodeURIComponent(explanation === 'copied-date' ? 'mystery:first-errand-public-desk' : 'mystery:first-errand-side-door') + '/complete',
      { interactionId: graph + ':' + (explanation === 'copied-date' ? 'public-desk' : 'side-door') });
    assert(wrong.statusCode >= 400, wrong.body);
    await send(actor, follow.uiActions[0]);
    const conclusion = await lead(actor, 'mystery:first-errand-report'); await send(actor, conclusion.uiActions[0]);
    assert.equal((await board(actor)).status, 'completed');
    assert.deepEqual(await balance(actor), before, 'The case awards no currency, heat, respect or core stat changes.');
    const privateIndex = await ok(request(outsider, 'GET', '/v1/worldgraph/mysteries'));
    assert.equal(privateIndex.mysteries.find(row => row.graphId === graph).started, false);
    assert((await request(outsider, 'GET', base)).statusCode >= 400);
    assert((await request(outsider, 'POST', receiptAction.path, receiptAction.body)).statusCode >= 400);
    assert.deepEqual(await send(actor, receiptAction, firstKey), first, 'Historical exact replay does not rewrite the completed case.');
    assert.equal((await board(actor)).status, 'completed');
  }
  console.log('first-errand-case PASS: both real evidence branches, authored clue payoff, immutable original definitions, closed owner/interaction authority, private unread facts, permanent choices, exact replay and no economic grant');
}
