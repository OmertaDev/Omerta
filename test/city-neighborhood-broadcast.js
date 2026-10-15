// Follow the actual issued HTTP actions through both finite endings and replay their rewards.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { NEIGHBORHOOD_BROADCAST_PACKAGE } from '../src/content/neighborhood-broadcast.js';

const postgres = process.argv.includes('--postgres');
let admin, namespace, app;
for (const key of ['JWT_SECRET', 'MOD_KEY', 'MARKET_SEED']) process.env[key] = crypto.randomBytes(32).toString('hex');
Object.assign(process.env, { SOCIAL_VERIFY_MODE: 'off', RATE_LIMIT: 'off', INVITE_MODE: 'off',
  POPULATION_OFF: 'on', CORE_PROGRESSION: 'off' });
const graph = NEIGHBORHOOD_BROADCAST_PACKAGE.id;
const root = id => '/v1/worldgraph/mysteries/' + encodeURIComponent(id);
assert(Object.isFrozen(NEIGHBORHOOD_BROADCAST_PACKAGE.nodes[1].options[0].effects));

try {
  if (postgres) {
    const address = process.env.CITY_DISTRICT_ARCS_TEST_DATABASE_URL;
    assert(address, 'Native proof requires an explicit isolated CITY_DISTRICT_ARCS_TEST_DATABASE_URL.');
    const endpoint = new URL(address);
    assert(['postgres:', 'postgresql:'].includes(endpoint.protocol));
    assert(['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname));
    assert(!endpoint.search && !endpoint.hash);
    assert(/^\/(?:omerta_query|omerta_check|city_district_arcs_[a-z0-9_]+)$/.test(endpoint.pathname));
    const { Pool } = await import('pg');
    admin = new Pool({ connectionString: endpoint.toString() });
    namespace = 'city_broadcast_' + crypto.randomBytes(8).toString('hex');
    await admin.query(`CREATE SCHEMA ${namespace}`);
    endpoint.searchParams.set('options', `-c search_path=${namespace}`);
    process.env.DATABASE_URL = endpoint.toString();
  } else assert(!process.env.DATABASE_URL, 'Memory proof requires disposable pg-mem.');
  const { buildServer } = await import('./server-fixture.js');
  app = await buildServer();
  if (postgres) assert.equal((await app.pool.query('SELECT current_schema() AS schema')).rows[0].schema, namespace);
  const call = (actor, method, url, body, key = crypto.randomUUID()) => app.inject({ method, url,
    ...(body !== undefined ? { payload: body } : {}), headers: { ...(actor?.headers || {}),
      ...(method === 'POST' ? { 'idempotency-key': key } : {}) } });
  const ok = async request => {
    const response = await request; assert.equal(response.statusCode, 200, response.body); return response.json();
  };
  const denied = async request => {
    const response = await request; assert(response.statusCode >= 400, response.body); return response.json();
  };
  const board = (actor, id = graph) => ok(call(actor, 'GET', root(id)));
  const act = (actor, action, key) => ok(call(actor, action.method, action.path, action.body, key));
  const actionFor = async (actor, id, nodeId, optionId) => {
    const node = (await board(actor, id)).nodes.find(candidate => candidate.id === nodeId);
    assert(node, 'The server must first reveal ' + nodeId);
    const action = node.uiActions.find(candidate => !optionId || candidate.body.optionId === optionId);
    assert(action?.available, 'The server must issue an eligible action for ' + nodeId);
    return action;
  };
  const start = async (actor, id) => {
    const catalogue = await ok(call(actor, 'GET', '/v1/worldgraph/mysteries'));
    const offer = catalogue.mysteries.find(entry => entry.graphId === id);
    assert(offer?.cityQuest);
    return act(actor, offer.actions.find(action => action.path.endsWith('/start')));
  };
  const explore = async (actor, id) => {
    const action = (await board(actor, id)).uiActions.find(candidate => candidate.path.endsWith('/explore'));
    assert(action?.available); return { action, result: await act(actor, action) };
  };
  const actor = async name => {
    const guest = await ok(call(null, 'POST', '/v1/auth/guest', { birthDate: '1990-01-01' }));
    const account = app.jwt.verify(guest.token).sub, headers = { authorization: 'Bearer ' + guest.token };
    await ok(call({ headers }, 'POST', '/v1/character', { name }));
    const row = (await app.pool.query('SELECT id FROM characters WHERE account_id=$1 AND alive', [account])).rows[0];
    await app.pool.query('UPDATE characters SET last_accrued_at=$2 WHERE id=$1', [row.id, new Date(Date.now() + 86400000)]);
    return { ...row, account, headers };
  };
  const items = async owner => (await ok(call(owner, 'GET', '/v1/worldgraph/inventory'))).currentCharacterItems;
  const economy = async owner => ({
    character: (await app.pool.query('SELECT cash,bank,heat,ammo,respect FROM characters WHERE id=$1', [owner.id])).rows[0],
    account: (await app.pool.query('SELECT omr FROM account_persistent WHERE account_id=$1', [owner.account])).rows[0],
    ledger: Number((await app.pool.query('SELECT COUNT(*) n FROM transactions WHERE character_id=$1 OR account_id=$2',
      [owner.id, owner.account])).rows[0].n),
  });
  const paths = [
    { id: 'live', interaction: 'restore-transmitter', ending: 'broadcast-live', item: 'item:neighborhood_brass_dial',
      reward: 'reward:broadcast-neighborhood-voice', venue: 'workshop', preview: 'Brass Dial' },
    { id: 'archive', interaction: 'recover-recording', ending: 'play-first-reel', item: 'item:neighborhood_first_reel',
      reward: 'reward:broadcast-lost-voice', venue: 'stories', preview: 'First Reel' },
  ];
  const outsider = await actor('Broadcast Outsider');
  for (const route of paths) {
    const owner = await actor('Broadcast ' + route.id), before = await economy(owner);
    await start(owner, graph);
    const initial = await board(owner), intro = initial.nodes.find(node => node.id === 'mystery:broadcast-static');
    assert.equal(intro.uiActions[0].available, false, 'Opening a journal does not bypass the Notebook prerequisite.');
    assert(intro.blockedBy.some(blocker => blocker.adapter === 'item_ownership'));
    assert.match(intro.description, /Complete A Name Worth Remembering/);
    assert.equal((await denied(call(owner, 'POST', intro.uiActions[0].path, intro.uiActions[0].body))).error, 'item_unavailable');
    assert(!JSON.stringify(initial).includes(route.item), 'Hidden reward identifiers are not exposed before the branch.');

    // Earn the actual prerequisite through the unchanged newcomer case, never a fabricated inventory row.
    const first = 'neighborhood-initiation';
    await start(owner, first);
    await act(owner, await actionFor(owner, first, 'mystery:neighborhood-fixer'));
    await act(owner, await actionFor(owner, first, 'choice:neighborhood-approach', 'listen'));
    await act(owner, await actionFor(owner, first, 'mystery:neighborhood-listen'));
    await explore(owner, first);
    await act(owner, await actionFor(owner, first, 'mystery:neighborhood-newsroom'));
    assert((await items(owner)).some(item => item.templateId === 'item:neighborhood_notebook'));
    const firstAction = await actionFor(owner, graph, intro.id);
    const firstKey = crypto.randomUUID(), firstResult = await act(owner, firstAction, firstKey);
    assert.deepEqual(await act(owner, firstAction, firstKey), firstResult);
    assert.equal((await denied(call(owner, 'POST', firstAction.path,
      { ...firstAction.body, interactionId: 'tampered' }, firstKey))).error, 'idempotency_key_reuse');
    const choice = await actionFor(owner, graph, 'choice:broadcast-repair', route.id);
    assert(choice.id.startsWith(graph + ':choose:'));
    assert.match(choice.consequence, /permanent/);
    assert(choice.label.includes(route.preview), 'The chosen keepsake is previewed before commitment.');
    await act(owner, choice);
    const other = paths.find(path => path !== route);
    assert.equal((await denied(call(owner, 'POST', choice.path, { ...choice.body, optionId: other.id }))).error, 'choice_committed');
    let current = await board(owner);
    assert.deepEqual(current.choices, [{ nodeId: 'choice:broadcast-repair', choiceId: route.id }]);
    assert(!current.nodes.some(node => node.id === 'mystery:broadcast-' + other.id));
    const contribution = await actionFor(owner, graph, 'mystery:broadcast-' + route.id);
    assert.equal(current.nodes.find(node => node.id === 'mystery:broadcast-' + route.id).venueId, route.venue);
    await denied(call(outsider, 'POST', contribution.path, contribution.body));
    await denied(call(owner, 'POST', root(graph) + '/nodes/' + encodeURIComponent('mystery:broadcast-' + route.id + '-finale') + '/complete',
      { interactionId: graph + ':' + route.ending }));
    assert.equal((await items(owner)).filter(item => item.templateId === route.item).length, 0);
    await act(owner, contribution);
    current = await board(owner);
    assert(current.nodes.some(node => node.id === 'evidence:broadcast-' + route.id && node.status === 'completed'));
    const lead = current.uiActions.find(action => action.path.endsWith('/explore'));
    assert(lead?.available);
    const leadKey = crypto.randomUUID(), revealed = await act(owner, lead, leadKey);
    assert.deepEqual(await act(owner, lead, leadKey), revealed, 'Lead discovery replay cannot reveal another branch.');
    const finish = await actionFor(owner, graph, 'mystery:broadcast-' + route.id + '-finale');
    const finishKey = crypto.randomUUID(), result = await act(owner, finish, finishKey);
    const replay = await call(owner, 'POST', finish.path, finish.body, finishKey);
    assert.equal(replay.statusCode, 200, replay.body);
    assert.deepEqual(replay.json(), result); assert.equal(replay.headers['x-idempotent-replay'], 'true');
    await denied(call(owner, 'POST', finish.path, finish.body));
    current = await board(owner);
    assert.equal(current.status, 'completed');
    assert.equal(current.progress.completed, 4);
    assert.equal(current.progress.total, 4, 'Only the selected route counts toward the completed objective total.');
    assert(current.nodes.some(node => node.id === route.reward && node.status === 'completed'));
    const earned = await items(owner);
    assert.equal(earned.filter(item => item.templateId === route.item).length, 1, 'The chosen keepsake is awarded exactly once.');
    assert.equal(earned.filter(item => item.templateId === other.item).length, 0, 'The unchosen keepsake cannot be claimed.');
    assert.equal((await items(outsider)).length, 0, 'Another player receives no reward from guessed action URLs.');
    assert.deepEqual(await economy(owner), before, 'Both complete cases preserve cash, OMR, heat, respect and ledger totals.');
    const resumed = await ok(call(owner, 'POST', root(graph) + '/start', {}));
    assert.equal(resumed.instanceId, current.instanceId);
    assert.equal(resumed.status, 'completed', 'Restarting a completed case preserves its one-time ending.');
  }
  console.log('city-neighborhood-broadcast: both issued-action journeys, Notebook eligibility, hidden branches, permanent choices, exact replay, once-only keepsakes and economy neutrality pass' + (postgres ? ' (PostgreSQL)' : ' (pg-mem)'));
} finally {
  if (app) await app.close();
  if (admin) {
    if (namespace) await admin.query(`DROP SCHEMA ${namespace} CASCADE`);
    await admin.end();
  }
}
