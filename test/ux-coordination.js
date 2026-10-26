import assert from 'node:assert/strict';
import { buildServer } from './server-fixture.js';
import { register, coordinationBoard } from '../src/ux-coordination.js';
import { GameError } from '../src/game.js';

if (process.env.DATABASE_URL) throw new Error('Crew planning tests require disposable pg-mem.');
const app = await buildServer(), pool = app.pool;
if (!app.hasRoute({ method: 'POST', url: '/v1/ux/crew-workspace' })) register(app, { pool, auth: async (req) => { await req.jwtVerify(); } });
const call = async (method, url, token, body, key) => {
  const reply = await app.inject({ method, url, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(key ? { 'idempotency-key': key } : {}) }, payload: body });
  return { code: reply.statusCode, body: reply.json() };
};
const create = async (name) => {
  const { body: { token } } = await call('POST', '/v1/auth/guest');
  assert.equal((await call('POST', '/v1/character', token, { name })).code, 200);
  const ch = (await pool.query('SELECT * FROM characters WHERE name=$1', [name])).rows[0]; return { token, ch };
};
const route = '/v1/ux/crew-workspace';
try {
  const leader = await create('Planner Boss'), mate = await create('Planner Mate'), stranger = await create('Planner Stranger');
  for (const method of ['GET', 'POST']) {
    assert.equal(app.hasRoute({ method, url: route }), true, `${method} crew workspace is registered`);
    assert.equal(app.hasRoute({ method, url: '/v1/ux/coordination' }), false, 'Retired UX URI has no alias');
    assert.equal((await call(method, '/v1/ux/coordination', leader.token, method === 'POST' ? { type: 'readiness', value: 'ready' } : undefined)).code, 404);
  }
  const joined = new Date(Date.now() - 3600000);
  await pool.query("INSERT INTO crews(id,name,leader_account) VALUES ('ux-plan-crew','Planning Crew',$1),('ux-plan-other','Other Crew',$2)", [leader.ch.account_id, stranger.ch.account_id]);
  await pool.query("INSERT INTO crew_members(crew_id,account_id,name,joined_at) VALUES ('ux-plan-crew',$1,$2,$5),('ux-plan-crew',$3,$4,$5)", [leader.ch.account_id, leader.ch.name, mate.ch.account_id, mate.ch.name, joined]);
  await pool.query("INSERT INTO world_operations(id,graph_id,graph_version,operation_node_id,crew_id,opened_by_account_id) VALUES ('ux-plan-operation','belladonna-demo',1,'operation:belladonna-lockbox','ux-plan-crew',$1)", [leader.ch.account_id]);
  await pool.query("INSERT INTO world_operation_roles(operation_id,role_id,account_id,character_id) VALUES ('ux-plan-operation','investigator',$1,$2)", [leader.ch.account_id, leader.ch.id]);
  for (const node of ['operation:belladonna-investigate', 'evidence:belladonna-cipher-fragment', 'operation:belladonna-drive']) await pool.query("INSERT INTO world_operation_node_state(operation_id,node_id,state,completed_at) VALUES ('ux-plan-operation',$1,'completed',now())", [node]);
  const txBefore = Number((await pool.query('SELECT COUNT(*) n FROM transactions')).rows[0].n);
  const balances = (await pool.query('SELECT id,cash,bank FROM characters ORDER BY id')).rows;
  assert.equal((await call('GET', route)).code, 401);
  assert.equal((await call('POST', route, undefined, { type: 'readiness', value: 'ready' })).code, 401);
  const queries = [], connect = pool.connect;
  let absent;
  pool.connect = async (...args) => {
    const client = await connect.apply(pool, args);
    return new Proxy(client, { get(target, name) {
      if (name === 'query') return (sql, ...values) => { queries.push(String(sql)); return target.query(sql, ...values); };
      const value = Reflect.get(target, name); return typeof value === 'function' ? value.bind(target) : value;
    } });
  };
  try { absent = await call('GET', route, stranger.token); }
  finally { pool.connect = connect; }
  assert.equal(absent.code, 200);
  assert.equal(absent.body.available, false); assert.equal(absent.body.reason, 'no_crew'); assert.equal(absent.body.crew, null);
  assert.match(absent.body.message, /Join a crew/); assert(Number.isFinite(Date.parse(absent.body.serverTime)));
  for (const field of ['members', 'notes', 'operations', 'signals']) assert.deepEqual(absent.body[field], []);
  assert(queries.some((sql) => /SELECT crew_id FROM crew_members/.test(sql)), 'the membership check actually executes');
  assert.deepEqual(queries.filter((sql) => /\b(?:ux_crew_notes|ux_crew_signals|world_operations|characters|crews)\b/i.test(sql)), [], 'no private rows are read without membership');
  assert.deepEqual(queries.filter((sql) => /\b(?:INSERT|UPDATE|DELETE)\b/i.test(sql)), [], 'the unavailable read performs no writes');
  const deniedWrite = await call('POST', route, stranger.token, { type: 'readiness', value: 'ready' });
  assert.equal(deniedWrite.code, 400); assert.equal(deniedWrite.body.error, 'no_crew');
  for (const failure of [new GameError('crew_changed', 'Current crew changed.'), new Error('Unexpected query failure')]) {
    const failingPool = { connect: async () => ({ query: async (sql) => { if (/SELECT crew_id/.test(sql)) throw failure; return { rows: [] }; }, release() {} }) };
    await assert.rejects(() => coordinationBoard(failingPool, 'unavailable-test'), (error) => error === failure, 'all other errors remain refusals');
  }
  let current = await call('GET', route, mate.token);
  assert.equal(current.code, 200);
  assert.equal(current.body.operations[0].roles.find((r) => r.roleId === 'investigator').filled, true);
  assert.equal(current.body.operations[0].roles.find((r) => r.roleId === 'driver').filled, false);
  assert.ok(current.body.operations[0].summary.awaitedSteps.length > 0);
  assert.doesNotMatch(JSON.stringify(current.body), /cipher-fragment|fourth petal|privateEvidence/);
  for (const body of [
    { type: 'readiness', value: 'ready', accountId: leader.ch.account_id },
    { type: 'pledge', what: 'supplies', quantity: 1.5 },
    { type: 'presence', message: 'working', minutes: 999 },
    { type: 'poll', title: 'choose', options: ['same', 'SAME'], minutes: 30 },
    { type: 'toString' }, { type: 'plan', title: 'x'.repeat(101) },
    { type: 'availability', title: 'when', slots: ['tomorrow', 'later'], timezone: 'America/New_York' },
    { type: 'vote', noteId: 'missing', option: 0 },
  ]) assert.equal((await call('POST', route, mate.token, body)).code, 400, JSON.stringify(body));
  assert.equal((await call('GET', route + '?accountId=x', mate.token)).code, 400);
  current = await call('POST', route, mate.token, { type: 'plan', title: 'Canal plan', nextStep: 'Claim the driver role' }, 'planner-retry');
  const noteId = current.body.notes.find((n) => n.data.title === 'Canal plan').id;
  assert.equal(current.body.notes.find((n) => n.id === noteId).kindName, 'Plan', 'the planning discriminator is accompanied by its human display name');
  assert.equal(current.code, 200, 'ordinary members can create plans');
  assert.equal((await call('POST', route, mate.token, { type: 'plan', title: 'Canal plan', nextStep: 'Claim the driver role' }, 'planner-retry')).body.notes.filter((n) => n.id === noteId).length, 1);
  assert.match((await call('POST', route, mate.token, { type: 'plan', title: 'Different payload' }, 'planner-retry')).body.error, /^(planning|idempotency)_key_reuse$/);
  await call('POST', route, mate.token, { type: 'readiness', value: 'ready', operationId: 'ux-plan-operation', note: 'I have read my issued step' });
  await call('POST', route, mate.token, { type: 'pledge', what: 'lockpicks', quantity: 2, operationId: 'ux-plan-operation' });
  await call('POST', route, mate.token, { type: 'presence', message: 'Working the canal plan', minutes: 10 });
  current = await call('POST', route, mate.token, { type: 'poll', title: 'Which approach?', options: ['Quiet', 'Standard'], minutes: 30 });
  const pollId = current.body.notes.find((n) => n.kind === 'poll').id;
  assert.equal(current.body.notes.find((n) => n.id === pollId).kindName, 'Planning poll');
  await call('POST', route, mate.token, { type: 'vote', noteId: pollId, option: 0 });
  current = await call('POST', route, mate.token, { type: 'vote', noteId: pollId, option: 1 });
  assert.deepEqual(current.body.notes.find((n) => n.id === pollId).votes, [0, 1], 'changing your vote never double counts the account');
  current = await call('POST', route, leader.token, { type: 'vote', noteId: pollId, option: 0 });
  assert.deepEqual(current.body.notes.find((n) => n.id === pollId).votes, [1, 1]);
  const slots = [1, 2].map((n) => new Date(Date.now() + n * 3600000).toISOString());
  current = await call('POST', route, mate.token, { type: 'availability', title: 'When to meet?', slots, timezone: 'America/New_York' });
  assert.deepEqual(current.body.notes.find((n) => n.kind === 'availability').data.slots, slots);
  assert.equal((await call('POST', route, mate.token, { type: 'clue', operationId: 'ux-plan-operation', nodeId: 'evidence:belladonna-cipher-fragment' })).body.error, 'clue_not_shared');
  const sharedLead = await call('POST', route, mate.token, { type: 'clue', operationId: 'ux-plan-operation', nodeId: 'operation:belladonna-drive' });
  assert.equal(sharedLead.code, 200, `completed public leads can be deliberately referenced: ${JSON.stringify(sharedLead.body)}`);
  assert.equal((await call('POST', route, mate.token, { type: 'handoff', operationId: 'ux-plan-operation', targetCharacterId: stranger.ch.id, note: '' })).body.error, 'handoff_target');
  current = await call('POST', route, mate.token, { type: 'handoff', operationId: 'ux-plan-operation', targetCharacterId: leader.ch.id, note: 'Next step is in the shared board.' });
  assert.equal(current.code, 200);
  assert.doesNotMatch(JSON.stringify(current.body), /cipher-fragment|fourth petal|privateEvidence/);
  assert.equal((await call('POST', route, mate.token, { type: 'debrief', operationId: 'ux-plan-operation' })).body.error, 'operation_open');
  await pool.query("UPDATE world_operations SET status='canceled',canceled_at=now(),close_reason='canceled' WHERE id='ux-plan-operation'");
  current = await call('POST', route, mate.token, { type: 'debrief', operationId: 'ux-plan-operation' });
  assert.equal(current.body.notes.find((n) => n.kind === 'debrief').data.status, 'canceled');
  const bossNote = await call('POST', route, leader.token, { type: 'help', title: 'Need another driver', details: 'Read the public roleboard.', nextStep: 'Claim the available driver role in the journal.' });
  const bossNoteId = bossNote.body.notes.find((n) => n.kind === 'help').id;
  assert.equal((await call('POST', route, mate.token, { type: 'close', noteId: bossNoteId })).body.error, 'not_planning_author');
  assert.equal((await call('POST', route, mate.token, { type: 'close', noteId })).code, 200);
  assert.equal((await call('POST', route, leader.token, { type: 'remove', noteId })).code, 200, 'leader moderation does not restrict ordinary creation');
  await pool.query("UPDATE ux_crew_signals SET expires_at=$1 WHERE kind='presence'", [new Date(Date.now() - 1000)]);
  assert.equal((await call('GET', route, leader.token)).body.signals.some((s) => s.kind === 'presence'), false);
  const pollData = (await pool.query('SELECT data_json FROM ux_crew_notes WHERE id=$1', [pollId])).rows[0];
  await pool.query('UPDATE ux_crew_notes SET data_json=$2 WHERE id=$1', [pollId, JSON.stringify({ ...JSON.parse(pollData.data_json), closesAt: new Date(Date.now() - 1000).toISOString() })]);
  assert.equal((await call('POST', route, mate.token, { type: 'vote', noteId: pollId, option: 0 })).body.error, 'poll_closed');
  await pool.query("UPDATE crew_members SET crew_id='ux-plan-other',joined_at=now() WHERE account_id=$1", [mate.ch.account_id]);
  current = await call('GET', route, mate.token);
  assert.equal(current.body.notes.length, 0, 'former crew entries are unreadable after changing crew');
  assert.equal((await call('POST', route, mate.token, { type: 'vote', noteId: pollId, option: 1 })).body.error, 'planning_unavailable');
  assert.equal((await call('POST', route, mate.token, { type: 'readiness', value: 'ready', operationId: 'ux-plan-operation' })).body.error, 'planning_unavailable');
  assert.equal((await call('GET', route, leader.token)).body.signals.some((s) => s.name === mate.ch.name), false, 'departed members do not remain ready or pledged');
  await pool.query("UPDATE crew_members SET crew_id='ux-plan-crew',joined_at=$2 WHERE account_id=$1", [mate.ch.account_id, new Date(Date.now() + 1000)]);
  current = await call('GET', route, mate.token);
  assert.equal(current.body.notes.length, 0, 'join-time visibility excludes earlier crew planning');
  assert.equal(current.body.operations.length, 0, 'join-time visibility excludes earlier operations');
  assert.equal(current.body.signals.length, 0, 'previous membership signals cannot revive on rejoin');
  assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM transactions')).rows[0].n), txBefore, 'planning moves no funds');
  assert.deepEqual((await pool.query('SELECT id,cash,bank FROM characters ORDER BY id')).rows, balances, 'planning never changes balances');
  assert.equal(Number((await pool.query("SELECT COUNT(*) n FROM world_operation_roles WHERE operation_id='ux-plan-operation'")).rows[0].n), 1, 'planning grants no role assignments');
  console.log('ux-coordination: PASS (strict requests, real safe roleboard, privacy, votes, TTL, ownership, membership epochs, no economic/role authority)');
} finally { await app.close(); }
