import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EventEmitter } from 'node:events';
import { newDb } from 'pg-mem';
import { createEventGateway } from '../src/gateway/events.js';

const mem = newDb({ noAstCoverageCheck: true });
const { Pool } = mem.adapters.createPg();
const pool = new Pool();
const schema = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
// Use production subscription DDL with minimal authority fixtures; there is no
// network or live database access in this suite.
const subscriptionSchema = schema.match(/CREATE TABLE IF NOT EXISTS agent_gateway_subscriptions\s*\([\s\S]*?\n\);/)?.[0];
assert(subscriptionSchema, 'Production event subscription migration must exist');
await pool.query(`
  CREATE TABLE accounts (id TEXT PRIMARY KEY, status TEXT DEFAULT 'active');
  CREATE TABLE agent_gateway_connections (id TEXT PRIMARY KEY);
  CREATE TABLE characters (id TEXT PRIMARY KEY,account_id TEXT,alive BOOLEAN DEFAULT true);
  CREATE TABLE notifications (id TEXT PRIMARY KEY,character_id TEXT,type TEXT,payload TEXT,
    created_at TIMESTAMPTZ,delivered BOOLEAN DEFAULT false);
  CREATE TABLE crews (id TEXT PRIMARY KEY,leader_account TEXT);
  CREATE TABLE crew_members (crew_id TEXT,account_id TEXT PRIMARY KEY);
  CREATE TABLE coordination_instances (id TEXT PRIMARY KEY,owner_account_id TEXT);
  CREATE TABLE coordination_events (id TEXT PRIMARY KEY,event_type TEXT,instance_id TEXT,
    revision INT,payload_json TEXT,occurred_at TIMESTAMPTZ);
  CREATE TABLE event_results (id TEXT PRIMARY KEY,kind TEXT,headline TEXT,winner_name TEXT,
    detail TEXT,resolved_at TIMESTAMPTZ);
  ${subscriptionSchema}
`);
const bus = new EventEmitter();
const scopes = ['omerta.player.read', 'omerta.social.read', 'omerta.mysteries.read',
  'omerta.coordination.read', 'omerta.world.read', 'omerta.economy.read'];
const connections = new Map([
  ['ca', { accountId: 'a', connectionId: 'ca', scopes: [...scopes] }],
  ['ca2', { accountId: 'a', connectionId: 'ca2', scopes: [...scopes] }],
  ['cb', { accountId: 'b', connectionId: 'cb', scopes: [...scopes] }],
]);
const authorize = async (principal) => {
  const fresh = connections.get(principal.connectionId);
  if (!fresh || fresh.revoked) throw Object.assign(Error('revoked'), { code: 'agent_connection_revoked' });
  const account = (await pool.query('SELECT status FROM accounts WHERE id=$1', [fresh.accountId])).rows[0];
  if (account?.status !== 'active') throw Object.assign(Error('banned'), { code: 'agent_account_unavailable' });
  return { ...fresh, scopes: [...fresh.scopes] };
};
const a = { connectionId: 'ca' }, a2 = { connectionId: 'ca2' }, b = { connectionId: 'cb' };
const views = new Map([['ia', { id: 'ia', nodes: [{ id: 'discovered' }], historical: false }]]);
const coordination = { async get(accountId, id) {
  assert.equal(accountId, 'a', 'No foreign instance projection');
  return views.get(id);
} };
const gateway = () => createEventGateway({ pool, bus, authorize, coordination });
let api = gateway();
const denied = (promise, code) => assert.rejects(promise, (error) => error.code === code);
const at = (second) => `2026-09-21T12:00:${String(second).padStart(2, '0')}.000Z`;
const notify = (id, character, type, payload = {}, second = 1) => pool.query(
  'INSERT INTO notifications (id,character_id,type,payload,created_at) VALUES ($1,$2,$3,$4,$5)',
  [id, character, type, JSON.stringify(payload), at(second)]);
try {
  for (const id of ['a', 'b']) {
    await pool.query('INSERT INTO accounts(id) VALUES ($1)', [id]);
    await pool.query('INSERT INTO characters(id,account_id) VALUES ($1,$2)', [`ch-${id}`, id]);
  }
  for (const id of connections.keys()) await pool.query('INSERT INTO agent_gateway_connections(id) VALUES ($1)', [id]);
  await pool.query("INSERT INTO crews VALUES ('crew-a','a'); INSERT INTO crew_members VALUES ('crew-a','a')");
  await notify('n-a-1', 'ch-a', 'clue_found', { riddle: 'discovered riddle', salt: 'never disclose', answer: 'hidden' });
  await notify('n-a-2', 'ch-a', 'crew_request', { crewId: 'crew-a', from: 'Player', privateMemberIds: ['secret'] });
  await notify('n-b', 'ch-b', 'clue_found', { answer: 'foreign secret' });
  await notify('n-unsupported', 'ch-a', 'secret_family_report', { privateData: 'never disclose' });
  await notify('n-economy', 'ch-a', 'market_sold', { net: 900, privateData: 'never disclose' }, 3);
  await pool.query("INSERT INTO coordination_instances VALUES ('ia','a'),('ib','b')");
  for (const [id, instance, node] of [['c-visible', 'ia', 'discovered'], ['c-hidden', 'ia', 'hidden'], ['c-foreign', 'ib', 'foreign']]) {
    await pool.query('INSERT INTO coordination_events VALUES ($1,$2,$3,1,$4,$5)',
      [id, 'coordination.node.discovered', instance, JSON.stringify({ nodeId: node, knowledgeEvidence: ['private receipt'] }), at(2)]);
  }
  await pool.query('INSERT INTO event_results VALUES ($1,$2,$3,$4,$5,$6)',
    ['w-one', 'boxing', 'Title fight settled', 'Winner', '{"secret":"internal detail"}', at(4)]);
  const topics = ['crew.request.created', 'mystery.clue.discovered', 'coordination.node.discovered', 'world.event.resolved'];
  const subscription = await api.subscribe(a, { topics });
  assert.equal((await api.subscribe(a, { topics: [...topics].reverse() })).id, subscription.id, 'Duplicate registration is stable');
  api = gateway();
  assert.equal((await api.subscriptions(a)).subscriptions[0].id, subscription.id, 'Subscriptions survive gateway recreation');
  await denied(api.read(b, { subscriptionId: subscription.id }), 'event_subscription_unavailable');
  await denied(api.read(a2, { subscriptionId: subscription.id }), 'event_subscription_unavailable');
  let page = await api.read(a, { subscriptionId: subscription.id, limit: 1 });
  assert.equal(page.events.length, 1);
  const events = [...page.events];
  for (let i = 0; i < 10 && page.hasMore; i++) {
    page = await api.read(a, { subscriptionId: subscription.id, after: page.nextCursor, limit: 1 });
    events.push(...page.events);
  }
  assert.deepEqual(events.map((event) => event.topic), [
    'mystery.clue.discovered', 'crew.request.created', 'coordination.node.discovered', 'world.event.resolved',
  ]);
  assert.equal(new Set(events.map((event) => event.id)).size, 4, 'Timestamp ties paginate without repeats');
  const output = JSON.stringify(events);
  for (const secret of ['never disclose', 'foreign', 'hidden', 'private receipt', 'privateMemberIds', 'internal detail']) {
    assert(!output.includes(secret), `No secret ${secret}`);
  }
  assert.equal((await pool.query('SELECT delivered FROM notifications WHERE id=$1', ['n-a-1'])).rows[0].delivered, false,
    'Agent reads never consume the player inbox');
  await denied(api.read(a, { subscriptionId: subscription.id, after: 'not-a-cursor' }), 'invalid_event_cursor');
  await denied(api.read(a, { subscriptionId: subscription.id, limit: 101 }), 'invalid_event_limit');
  await denied(api.subscribe(a, { topics: ['operation.ready'] }), 'unsupported_event_topic');
  connections.get('ca').scopes = ['omerta.player.read'];
  await denied(api.read(a, { subscriptionId: subscription.id }), 'agent_scope_required');
  const catalog = await api.catalog(a);
  assert.deepEqual(catalog.topics.map((topic) => topic.topic), ['player.notification']);
  assert(catalog.unavailable.some((topic) => topic.topic === 'operation.ready'));
  connections.get('ca').scopes = [...scopes];
  await pool.query("DELETE FROM crew_members WHERE account_id='a'");
  assert(!(await api.read(a, { subscriptionId: subscription.id })).events.some((event) => event.topic === 'crew.request.created'),
    'Historical crew notification is hidden after membership changes');
  await pool.query("INSERT INTO crew_members VALUES ('crew-a','a')");
  const delivered = [], closes = [];
  const stream = await api.stream(a, { subscriptionId: subscription.id, after: page.nextCursor,
    onEvent: (event) => delivered.push(event), onClose: (reason) => closes.push(reason) });
  assert.equal(bus.listenerCount('me:ch-a'), 1);
  bus.emit('me:ch-a', { type: 'clue_found', payload: { answer: 'uncommitted or rolled-back content' } });
  await stream.poll();
  assert.equal(delivered.length, 0, 'Uncommitted emitter payloads are never delivered');
  await notify('n-live', 'ch-a', 'clue_found', {}, 5);
  await stream.poll();
  assert.equal(delivered.length, 1, 'Committed durable event is delivered');
  connections.get('ca').revoked = true;
  await notify('n-revoked', 'ch-a', 'clue_found', {}, 6);
  await stream.poll();
  assert.equal(stream.closed, true);
  assert.equal(delivered.length, 1, 'Revocation prevents further delivery');
  assert.equal(bus.listenerCount('me:ch-a'), 0);
  assert.equal(bus.listenerCount('streets'), 0);
  connections.get('ca').revoked = false;
  const pressure = await api.stream(a, { subscriptionId: subscription.id, onEvent: () => false });
  assert.equal(pressure.closed, true, 'Slow consumers close without unbounded buffering');
  const live = [];
  for (let i = 0; i < 4; i++) live.push(await api.stream(a, { subscriptionId: subscription.id, after: page.nextCursor, onEvent: () => true }));
  await denied(api.stream(a, { subscriptionId: subscription.id, onEvent: () => true }), 'event_stream_limit');
  for (const item of live) item.close();
  await pool.query("UPDATE accounts SET status='banned' WHERE id='a'");
  await denied(api.read(a, { subscriptionId: subscription.id }), 'agent_account_unavailable');
  await pool.query("UPDATE accounts SET status='active' WHERE id='a'");
  await api.unsubscribe(a, subscription.id);
  await denied(api.read(a, { subscriptionId: subscription.id }), 'event_subscription_unavailable');
  assert.deepEqual((await api.subscriptions(a)).subscriptions, []);
  console.log('gateway events: durable subscriptions, scoped replay, discovery isolation, membership changes, revocation and bounded streams passed');
} finally { await pool.end(); }
