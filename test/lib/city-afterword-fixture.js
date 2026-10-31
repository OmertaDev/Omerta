import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildServer } from '../server-fixture.js';

export const afterwordGraph = 'neighborhood-afterword';
export const mysteryRoot = graph => '/v1/worldgraph/mysteries/' + encodeURIComponent(graph);

export async function cityAfterwordFixture() {
  assert(!process.env.DATABASE_URL, 'Afterword proof requires disposable pg-mem.');
  Object.assign(process.env, { INVITE_MODE: 'off', RATE_LIMIT: 'off', POPULATION_OFF: 'on', CORE_PROGRESSION: 'off',
    MOD_KEY: 'afterword-disposable-actor-proof' });
  const app = await buildServer();
  const call = (actor, method, url, payload, key = crypto.randomUUID()) => app.inject({ method, url,
    ...(payload !== undefined ? { payload } : {}), headers: { ...(actor?.headers || {}),
      ...(method === 'POST' ? { 'idempotency-key': key } : {}) } });
  const ok = async request => { const reply = await request; assert.equal(reply.statusCode, 200, reply.body); return reply.json(); };
  const denied = async request => { const reply = await request; assert(reply.statusCode >= 400, reply.body); return reply.json(); };
  const board = (actor, graph = afterwordGraph) => ok(call(actor, 'GET', mysteryRoot(graph)));
  const act = (actor, action, key) => ok(call(actor, action.method, action.path, action.body, key));
  const actionFor = async (actor, graph, nodeId, optionId) => {
    const found = (await board(actor, graph)).nodes.find(node => node.id === nodeId);
    assert(found, 'The server must reveal ' + nodeId);
    const action = found.uiActions.find(entry => !optionId || entry.body.optionId === optionId);
    assert(action?.available, 'The server must issue an eligible action for ' + nodeId);
    return action;
  };
  const start = async (actor, graph = afterwordGraph) => {
    const index = await ok(call(actor, 'GET', '/v1/worldgraph/mysteries'));
    const offer = index.mysteries.find(entry => entry.graphId === graph);
    assert(offer?.cityQuest, 'New content must be in the real City catalogue.');
    return act(actor, offer.actions.find(action => action.path.endsWith('/start')));
  };
  const explore = async (actor, graph = afterwordGraph) => {
    const action = (await board(actor, graph)).uiActions.find(entry => entry.path.endsWith('/explore'));
    assert(action?.available); return act(actor, action);
  };
  const actor = async name => {
    const guest = await ok(call(null, 'POST', '/v1/auth/guest', { birthDate: '1990-01-01' }));
    const account = app.jwt.verify(guest.token).sub, headers = { authorization: 'Bearer ' + guest.token };
    await ok(call({ headers }, 'POST', '/v1/character', { name }));
    const character = (await app.pool.query('SELECT id,generation FROM characters WHERE account_id=$1 AND alive', [account])).rows[0];
    await app.pool.query("UPDATE characters SET loc='docks',last_accrued_at=$2 WHERE id=$1", [character.id, new Date(Date.now() + 86400000)]);
    return { account, token: guest.token, headers, ...character };
  };
  const finishBroadcast = async (owner, branch, { complete = true } = {}) => {
    const first = 'neighborhood-initiation';
    await start(owner, first);
    await act(owner, await actionFor(owner, first, 'mystery:neighborhood-fixer'));
    await act(owner, await actionFor(owner, first, 'choice:neighborhood-approach', 'listen'));
    await act(owner, await actionFor(owner, first, 'mystery:neighborhood-listen'));
    await explore(owner, first);
    await act(owner, await actionFor(owner, first, 'mystery:neighborhood-newsroom'));
    const graph = 'neighborhood-broadcast';
    await start(owner, graph);
    await act(owner, await actionFor(owner, graph, 'mystery:broadcast-static'));
    await act(owner, await actionFor(owner, graph, 'choice:broadcast-repair', branch));
    await act(owner, await actionFor(owner, graph, 'mystery:broadcast-' + branch));
    await explore(owner, graph);
    const ending = await actionFor(owner, graph, `mystery:broadcast-${branch}-finale`);
    if (complete) await act(owner, ending);
    return ending;
  };
  const economy = async owner => ({
    character: (await app.pool.query('SELECT cash,bank,heat,ammo,respect FROM characters WHERE id=$1', [owner.id])).rows,
    account: (await app.pool.query('SELECT omr FROM account_persistent WHERE account_id=$1', [owner.account])).rows,
    ledger: (await app.pool.query('SELECT id,amount,currency,reason FROM transactions WHERE character_id=$1 OR account_id=$2', [owner.id, owner.account])).rows,
    items: (await app.pool.query('SELECT id,template_id,state,owner_scope,owner_id FROM item_instances WHERE owner_scope=$1 AND owner_id=$2 ORDER BY id', ['character', owner.id])).rows,
  });
  return { app, call, ok, denied, board, act, actionFor, start, explore, actor, finishBroadcast, economy };
}
