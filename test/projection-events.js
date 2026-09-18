// Focused event-boundary proof. Optional native mode uses a disposable loopback schema.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import Fastify from 'fastify';
import { newDb } from 'pg-mem';
import { registerProjectionEvents, createProjectionEvents } from '../src/projection-events.js';
import { FURNACE_IDS } from '../src/content/furnace-ledger.js';

const native = process.argv.includes('--postgres');
let pool, cleanup;
if (native) {
  assert(process.env.COORDINATION_TEST_DATABASE_URL, 'Explicit COORDINATION_TEST_DATABASE_URL required');
  const endpoint = new URL(process.env.COORDINATION_TEST_DATABASE_URL);
  assert(['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname), 'Only isolated loopback PostgreSQL');
  const { Pool } = await import('pg');
  const admin = new Pool({ connectionString: endpoint.toString() });
  const schema = `projection_events_${crypto.randomBytes(8).toString('hex')}`;
  await admin.query(`CREATE SCHEMA ${schema}`);
  pool = new Pool({ connectionString: endpoint.toString(), options: `-c search_path=${schema} -c statement_timeout=8000` });
  cleanup = async () => { await pool.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); };
} else {
  const { Pool } = newDb().adapters.createPg(); pool = new Pool(); cleanup = () => pool.end();
}
const bus = new EventEmitter(), clients = new Map(), accountIds = ['owner', 'reader', 'family', 'outsider'];
const socket = () => ({ readyState: 1, messages: [], closes: [],
  send(value) { this.messages.push(JSON.parse(value)); }, close(code, reason) { this.closes.push({ code, reason }); } });
for (const id of [...accountIds, 'excluded']) clients.set(id, new Set([socket()]));
const messages = (id) => [...clients.get(id)][0].messages;
const reset = () => { for (const sockets of clients.values()) for (const s of sockets) { s.messages.length = 0; s.closes.length = 0; } };
const recipients = () => [...clients.keys()].filter((id) => messages(id).length).sort();
function hinted(expected) {
  assert.deepEqual(recipients(), [...expected].sort());
  for (const id of clients.keys()) for (const value of messages(id)) assert.deepEqual(value, { channel: 'projection', changed: true });
}
const app = Fastify();
app.decorate('jwt', { verify: (token) => { assert(clients.has(token)); return { sub: token }; } });
const events = registerProjectionEvents(app, { pool, bus, clients, enabled: true, accountIds,
  objects: [{ id: 'secret-object', publicStates: ['open'] }] });
const request = async (method, url, actor = 'owner', payload = {}) => {
  const response = await app.inject({ method, url, headers: { authorization: `Bearer ${actor}` }, payload });
  await events.settled(); return response;
};
try {
  await pool.query(`CREATE TABLE accounts(id TEXT PRIMARY KEY,status TEXT,token_version INT);
    CREATE TABLE characters(id TEXT PRIMARY KEY,account_id TEXT,alive BOOLEAN);
    CREATE TABLE crew_members(crew_id TEXT,account_id TEXT);
    CREATE TABLE gang_members(gang_id TEXT,character_id TEXT);
    CREATE TABLE coordination_claims(id TEXT PRIMARY KEY,owner_account_id TEXT);
    CREATE TABLE coordination_claim_grants(id TEXT PRIMARY KEY,claim_id TEXT,recipient_kind TEXT,recipient_id TEXT,active BOOLEAN);
    CREATE TABLE world_operations(id TEXT PRIMARY KEY,opened_by_account_id TEXT,family_id TEXT,crew_id TEXT,coordination_mode TEXT);
    CREATE TABLE world_operation_roles(operation_id TEXT,account_id TEXT);
    CREATE TABLE world_operation_commitments(operation_id TEXT,account_id TEXT);
    CREATE TABLE world_operation_events(id TEXT PRIMARY KEY,operation_id TEXT,revision INT);
    CREATE TABLE world_kernel_events(object_id TEXT,revision INT,actor_account_id TEXT,crew_id TEXT,family_id TEXT,next_state TEXT);`);
  for (const id of clients.keys()) {
    await pool.query("INSERT INTO accounts VALUES($1,'active',0)", [id]);
    await pool.query('INSERT INTO characters VALUES($1,$2,true)', [`${id}-ch`, id]);
  }
  for (const id of ['owner', 'reader']) await pool.query("INSERT INTO crew_members VALUES('crew-secret',$1)", [id]);
  for (const id of ['owner', 'reader', 'family']) await pool.query("INSERT INTO gang_members VALUES('family-secret',$1)", [`${id}-ch`]);
  await pool.query("INSERT INTO coordination_claims VALUES('private-claim','owner')");
  await pool.query("INSERT INTO coordination_claim_grants VALUES('crew-grant','private-claim','crew','crew-secret',false)");
  app.post('/v1/coordination/instances/:instanceId/act', async () => ({ secret: 'must-not-be-forwarded', accountId: 'outsider' }));
  app.post('/v1/coordination/knowledge/:claimId/share', async () => {
    await pool.query("UPDATE coordination_claim_grants SET active=true WHERE id='crew-grant'");
    return { claimId: 'private-claim', secret: 'source-proof', accountId: 'outsider' };
  });
  app.post('/v1/coordination/knowledge/:claimId/revoke', async () => {
    await pool.query("UPDATE coordination_claim_grants SET active=false WHERE id='crew-grant'"); return {};
  });
  app.post('/v1/crew/leave', async () => { await pool.query("DELETE FROM crew_members WHERE account_id='reader'"); return {}; });
  app.post('/v1/action', async (req, reply) => {
    if (req.body.fail) return reply.code(409).send({ error: 'refused' });
    if (req.body.replay) reply.header('x-idempotent-replay', 'true');
    return { ok: true };
  });
  app.post('/v1/coordination/instances/:instanceId/cancel', async (_req, reply) => reply.code(500).send({ error: 'rollback' }));

  await request('POST', '/v1/coordination/instances/private-run/act'); hinted(['owner']);
  reset(); await request('POST', '/v1/coordination/knowledge/private-claim/share'); hinted(['owner', 'reader']);
  reset(); await request('POST', '/v1/coordination/knowledge/private-claim/revoke', 'owner', { grantId: 'crew-grant' }); hinted(['owner', 'reader']);
  reset(); await request('POST', '/v1/coordination/instances/private-run/act'); hinted(['owner']);
  reset(); await request('POST', '/v1/action', 'owner', { fail: true }); hinted([]);
  await request('POST', '/v1/action', 'owner', { replay: true }); hinted([]);
  await request('POST', '/v1/coordination/instances/private-run/cancel'); hinted([]);
  await request('POST', '/v1/action'); hinted(['owner']); reset();
  bus.emit('crew:crew-secret', { type: 'crew_left', secret: 'precommit' }); await events.settled(); hinted([]);
  bus.emit('world:changed', { objectId: 'secret-object', revision: 1 }); await events.settled(); hinted([]);

  // A private forward is authorized at delivery, including the current street/token.
  const forwarded = [], closes = [];
  const forward = (overrides = {}) => events.forwardPrivate({ accountId: 'reader', characterId: 'reader-ch',
    tokenVersion: 0, kind: 'crew', groupId: 'crew-secret', event: { private: 'crew only' },
    send: (value) => forwarded.push(value), close: () => closes.push(true), ...overrides });
  await forward(); assert.equal(forwarded.length, 1);
  reset(); await request('POST', '/v1/crew/leave', 'reader'); hinted(['owner', 'reader', 'family']);
  assert.equal([...clients.get('reader')][0].closes[0].code, 4009);
  await forward(); assert.equal(forwarded.length, 1); assert.equal(closes.length, 1);
  await pool.query("INSERT INTO crew_members VALUES('crew-secret','reader')");
  await pool.query("UPDATE accounts SET token_version=1 WHERE id='reader'");
  await forward(); assert.equal(forwarded.length, 1);
  await pool.query("UPDATE accounts SET token_version=0,status='banned' WHERE id='reader'");
  await forward(); assert.equal(forwarded.length, 1);
  await pool.query("UPDATE accounts SET status='active' WHERE id='reader'");
  await pool.query("UPDATE characters SET alive=false WHERE id='reader-ch'");
  await pool.query("INSERT INTO characters VALUES('reader-heir','reader',true)");
  await forward(); assert.equal(forwarded.length, 1);
  await pool.query("DELETE FROM characters WHERE id='reader-heir'");
  await pool.query("UPDATE characters SET alive=true WHERE id='reader-ch'");
  await forward({ kind: 'family', groupId: 'other-family' }); assert.equal(forwarded.length, 1);
  const failedReads = createProjectionEvents({ pool: { query: async () => { throw Error('offline'); } }, bus, clients });
  await failedReads.forwardPrivate({ accountId: 'reader', send: () => assert.fail('DB failure must fail closed') }); await failedReads.close();

  // Hidden event ids never propagate. Only a durable public transition permits a
  // coarse hint to unrelated eligible viewers; excluded/banned viewers remain silent.
  reset(); await pool.query("INSERT INTO world_kernel_events VALUES('secret-object',1,'owner','crew-secret','family-secret','hidden')");
  bus.emit('world:changed', { objectId: 'secret-object', revision: 1 }); await events.settled(); hinted(['owner']);
  reset(); await pool.query("UPDATE accounts SET status='banned' WHERE id='family'");
  await pool.query("INSERT INTO world_kernel_events VALUES('secret-object',2,'owner','crew-secret','family-secret','open')");
  bus.emit('world:changed', { objectId: 'secret-object', revision: 2 }); await events.settled(); hinted(['owner', 'reader', 'outsider']);
  reset(); await pool.query("INSERT INTO world_operations VALUES('private-operation','owner','family-secret','crew-secret','family')");
  await pool.query("INSERT INTO world_operation_roles VALUES('private-operation','reader')");
  await pool.query("INSERT INTO crew_members VALUES('crew-secret','outsider')");
  bus.emit('coordination:changed', { operationId: 'private-operation', revision: 2 }); await events.settled(); hinted([]);
  await pool.query("INSERT INTO world_operation_events VALUES('event-private','private-operation',2)");
  bus.emit('coordination:changed', { operationId: 'private-operation', revision: 2 }); await events.settled(); hinted(['owner', 'reader']);
  reset(); await pool.query("INSERT INTO world_operation_commitments VALUES('private-operation','outsider')");
  bus.emit('coordination:changed', { operationId: 'private-operation', revision: 2 }); await events.settled(); hinted(['owner', 'reader', 'outsider']);

  if (native) {
    reset(); const transaction = await pool.connect();
    try {
      await transaction.query('BEGIN');
      await transaction.query("INSERT INTO world_kernel_events VALUES('secret-object',3,'owner','crew-secret','family-secret','open')");
      bus.emit('world:changed', { objectId: 'secret-object', revision: 3 }); await events.settled(); hinted([]);
      await transaction.query('ROLLBACK');
      bus.emit('world:changed', { objectId: 'secret-object', revision: 3 }); await events.settled(); hinted([]);
      await transaction.query('BEGIN');
      await transaction.query("INSERT INTO world_kernel_events VALUES('secret-object',3,'owner','crew-secret','family-secret','open')");
      await transaction.query('COMMIT');
      bus.emit('world:changed', { objectId: 'secret-object', revision: 3 }); await events.settled(); hinted(['owner', 'reader', 'outsider']);
    } finally { await transaction.query('ROLLBACK'); transaction.release(); }
  }
  assert.equal(bus.listenerCount('world:changed'), 1); assert.equal(bus.listenerCount('coordination:changed'), 1);
  await app.close(); assert.equal(bus.listenerCount('world:changed'), 0); assert.equal(bus.listenerCount('coordination:changed'), 0);
  reset(); bus.emit('world:changed', { objectId: 'secret-object', revision: 2 }); await events.settled(); hinted([]);
  // Default gateway composition must track admitted content, rather than only
  // the original pilot. A public Furnace consequence refreshes unrelated viewers;
  // its sealed state and disabled content never reveal timing to those viewers.
  const flags = ['CORE_PROGRESSION', 'WORLD_GRAPH_KERNEL', 'COORDINATION_ENGINE',
    'COORDINATION_KNOWLEDGE', 'COORDINATION_KNOWLEDGE_SHARING', 'COORDINATION_OPERATIONS'];
  const prior = Object.fromEntries(flags.map((flag) => [flag, process.env[flag]]));
  const progressionBus = new EventEmitter();
  let progressionEvents;
  try {
    for (const flag of flags) process.env[flag] = 'on';
    await pool.query('INSERT INTO world_kernel_events VALUES($1,1,$2,$3,$4,$5)',
      [FURNACE_IDS.object, 'owner', 'crew-secret', 'family-secret', 'sealed']);
    progressionEvents = createProjectionEvents({ pool, bus: progressionBus, clients, enabled: true, accountIds });
    progressionBus.emit('world:changed', { objectId: FURNACE_IDS.object, revision: 1 });
    await progressionEvents.settled(); hinted(['owner']);
    reset(); await pool.query('INSERT INTO world_kernel_events VALUES($1,2,$2,$3,$4,$5)',
      [FURNACE_IDS.object, 'owner', 'crew-secret', 'family-secret', 'preserved']);
    progressionBus.emit('world:changed', { objectId: FURNACE_IDS.object, revision: 2 });
    await progressionEvents.settled(); hinted(['owner', 'reader', 'outsider']);
    await progressionEvents.close();
    process.env.CORE_PROGRESSION = 'off';
    progressionEvents = createProjectionEvents({ pool, bus: progressionBus, clients, enabled: true, accountIds });
    reset(); progressionBus.emit('world:changed', { objectId: FURNACE_IDS.object, revision: 2 });
    await progressionEvents.settled(); hinted(['owner']);
  } finally {
    await progressionEvents?.close();
    for (const [flag, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[flag]; else process.env[flag] = value;
    }
  }
  console.log(`projection-events: private discovery, share/revoke, committed hints, cohort, current WS authority and cleanup pass (${native ? 'PostgreSQL' : 'pg-mem'})`);
} finally { await app.close(); await cleanup(); }
