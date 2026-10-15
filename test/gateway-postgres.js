// Explicit opt-in, loopback-only PostgreSQL evidence. Never uses DATABASE_URL.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { Pool } from 'pg';
import { dbCaps } from '../src/db.js';
import { canonical, createGatewaySecurity, SCOPES } from '../src/gateway/security.js';
import { createAgentGateway } from '../src/gateway/service.js';
import { createEventGateway } from '../src/gateway/events.js';
import { CAPABILITIES } from '../src/gateway/capabilities.js';

const reviewedFiles = ['schema.sql', 'src/db.js', 'src/gateway/security.js', 'src/gateway/service.js',
  'src/gateway/events.js', 'src/gateway/actions.js', 'src/gateway/capabilities.js', 'test/gateway-postgres.js'];
const sourceHashes = () => Object.fromEntries(reviewedFiles.map((file) => [file,
  crypto.createHash('sha256').update(fs.readFileSync(new URL('../' + file, import.meta.url))).digest('hex')]));
const startHashes = sourceHashes();
assert(process.env.GATEWAY_TEST_DATABASE_URL, 'Explicit GATEWAY_TEST_DATABASE_URL is required');
const endpoint = new URL(process.env.GATEWAY_TEST_DATABASE_URL);
assert(['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname), 'Only an isolated loopback PostgreSQL server is allowed');
const namespace = 'gateway_test_' + crypto.randomBytes(8).toString('hex');
const base = new Pool({ connectionString: endpoint.toString() });
await base.query(`CREATE SCHEMA ${namespace}`);
const pool = new Pool({ connectionString: endpoint.toString(), options: `-c search_path=${namespace}`, max: 20 });
const otherPool = new Pool({ connectionString: endpoint.toString(), options: `-c search_path=${namespace}`, max: 20 });
const priorCaps = { ...dbCaps };
Object.assign(dbCaps, { skipLocked: true, indexedTextArrayAny: true, timestampText: true });
const reject = (promise, code) => assert.rejects(promise, (error) => error.code === code);
let clock = Date.now();
const security = createGatewaySecurity({ pool, now: () => clock });
const otherSecurity = createGatewaySecurity({ pool: otherPool, now: () => clock });
const newPlayer = async (id) => {
  await pool.query('INSERT INTO accounts(id,auth_provider,auth_subject) VALUES ($1,$2,$3)', [id, 'gateway-test', id]);
  await pool.query('INSERT INTO characters(id,account_id,name,season) VALUES ($1,$2,$3,1)', ['ch-' + id, id, id]);
};
const connection = async (accountId, creator = security, expiresInSeconds = 300) => {
  const created = await creator.create(accountId, { provider: 'test', label: 'isolated proof', scopes: [...SCOPES], expiresInSeconds });
  const principal = await creator.authenticate('Bearer ' + created.token);
  return { ...created, principal };
};
const log = (name) => console.log('PASS ' + name);
try {
  const version = (await base.query('SHOW server_version')).rows[0].server_version;
  console.log(`PostgreSQL ${version}; Node ${process.version}; isolated schema ${namespace}; UTC ${new Date().toISOString()}`);
  const schema = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
  await pool.query(schema);
  await pool.query(schema);
  log('full production schema and additive reapplication');

  await newPlayer('rate');
  const r1 = await connection('rate'), r2 = await connection('rate', otherSecurity);
  const results = await Promise.allSettled(Array.from({ length: 65 }, (_, index) =>
    (index % 2 ? security : otherSecurity).rateLimit(index % 2 ? r1.principal : r2.principal)));
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 60);
  assert.equal(results.filter((result) => result.status === 'rejected' && result.reason.code === 'rate_limited').length, 5);
  assert.equal((await pool.query("SELECT used FROM agent_gateway_rate_buckets WHERE account_id='rate'")).rows[0].used, 60);
  log('exactly 60 of 65 concurrent calls across connections and security instances');
  clock += 60_000;
  await Promise.all([security.rateLimit(r1.principal), otherSecurity.rateLimit(r2.principal)]);
  assert.equal((await pool.query("SELECT used FROM agent_gateway_rate_buckets WHERE account_id='rate'")).rows[0].used, 2);
  log('shared rate window rollover');

  await newPlayer('auth');
  const revocable = await connection('auth');
  await otherSecurity.revoke('auth', revocable.connection.id);
  await reject(security.revalidate(revocable.principal), 'invalid_token');
  const loggedOut = await connection('auth');
  await pool.query("UPDATE accounts SET token_version=token_version+1 WHERE id='auth'");
  await reject(otherSecurity.revalidate(loggedOut.principal), 'invalid_token');
  const banned = await connection('auth');
  await pool.query("UPDATE accounts SET status='banned' WHERE id='auth'");
  await reject(otherSecurity.revalidate(banned.principal), 'invalid_token');
  await pool.query("UPDATE accounts SET status='active' WHERE id='auth'");
  const expired = await connection('auth');
  const timeBeforeExpiry = clock; clock += 300_001;
  await reject(security.revalidate(expired.principal), 'invalid_token');
  clock = timeBeforeExpiry;
  log('connection revocation, account logout, ban and exact expiry revalidation');

  await newPlayer('subscriptions');
  const subscriber = await connection('subscriptions');
  const coordination = { get: async () => ({ nodes: [] }) };
  const events = createEventGateway({ pool, authorize: security.revalidate, coordination });
  const otherEvents = createEventGateway({ pool: otherPool, authorize: otherSecurity.revalidate, coordination });
  const eventTopics = (await events.catalog(subscriber.principal)).topics.map((entry) => entry.topic);
  const combinations = Array.from({ length: 25 }, (_, index) => eventTopics.filter((_, bit) => (index + 1) & (1 << bit)));
  const subscribed = await Promise.allSettled(combinations.map((topics, index) =>
    (index % 2 ? events : otherEvents).subscribe(subscriber.principal, { topics })));
  assert.equal(subscribed.filter((result) => result.status === 'fulfilled').length, 20);
  assert.equal(subscribed.filter((result) => result.status === 'rejected' && result.reason.code === 'event_subscription_limit').length, 5);
  assert.equal((await events.subscriptions(subscriber.principal)).subscriptions.length, 20);
  const first = subscribed.find((result) => result.status === 'fulfilled').value;
  assert.equal((await otherEvents.subscribe(subscriber.principal, { topics: first.topics })).id, first.id);
  log('concurrent subscription cap and cross-instance idempotent registration');

  await newPlayer('cursor');
  const owner = await connection('cursor');
  const cursorEvents = createEventGateway({ pool, authorize: security.revalidate });
  const subscription = await cursorEvents.subscribe(owner.principal, { topics: ['mystery.clue.discovered'] });
  for (const [id, timestamp] of [['z-earliest', '2026-09-21T12:00:00.000001Z'],
    ['a-middle', '2026-09-21T12:00:00.000002Z'], ['b-last', '2026-09-21T12:00:00.000002Z']]) {
    await pool.query('INSERT INTO notifications(id,character_id,type,payload,created_at) VALUES ($1,$2,$3,$4,$5)',
      [id, 'ch-cursor', 'clue_found', '{"private":"secret"}', timestamp]);
  }
  let page = await cursorEvents.read(owner.principal, { subscriptionId: subscription.id, limit: 1 });
  assert.equal(page.events[0].id, 'notifications:z-earliest');
  const decoded = JSON.parse(Buffer.from(page.nextCursor, 'base64url').toString('utf8'));
  assert.equal(decoded.positions.notifications.at, '2026-09-21T12:00:00.000001Z');
  const restarted = createEventGateway({ pool: otherPool, authorize: otherSecurity.revalidate });
  page = await restarted.read(owner.principal, { subscriptionId: subscription.id, after: page.nextCursor, limit: 1 });
  assert.equal(page.events[0].id, 'notifications:a-middle');
  page = await restarted.read(owner.principal, { subscriptionId: subscription.id, after: page.nextCursor, limit: 1 });
  assert.equal(page.events[0].id, 'notifications:b-last');
  page = await restarted.read(owner.principal, { subscriptionId: subscription.id, after: page.nextCursor, limit: 1 });
  assert.equal(page.events.length, 0);
  const together = await restarted.read(owner.principal, { subscriptionId: subscription.id, limit: 10 });
  assert.deepEqual(together.events.map((event) => event.id), ['notifications:z-earliest', 'notifications:a-middle', 'notifications:b-last']);
  log('microsecond timestamp order, equal-timestamp ties, and persisted cursor replay across instances');

  await newPlayer('prepare');
  const preparing = await connection('prepare', security, 1800);
  let previewRevision = 1, dispatches = 0, crashNext = false, failBeforeCommit = false, receiptReads = 0;
  await pool.query(`CREATE TABLE gateway_test_effects (command_key TEXT PRIMARY KEY,
    account_id TEXT NOT NULL, target_url TEXT NOT NULL, body_json TEXT NOT NULL, effect_count INT NOT NULL)`);
  const context = { prepare: async () => ({ available: true, revision: previewRevision }) };
  const dispatch = async ({ idempotencyKey, authorization, accountId, url, body }) => {
    assert.equal(authorization, 'player-only-authority');
    dispatches++;
    if (failBeforeCommit) { failBeforeCommit = false; throw Error('simulated disconnect before game commit'); }
    await pool.query('INSERT INTO gateway_test_effects VALUES ($1,$2,$3,$4,1) ON CONFLICT(command_key) DO NOTHING',
      [idempotencyKey, accountId, url, canonical(body)]);
    if (crashNext) { crashNext = false; throw Error('simulated lost response after durable game commit'); }
    return { statusCode: 200 };
  };
  const resolveReceipt = async ({ idempotencyKey, accountId, url, body }) => {
    receiptReads++;
    const row = (await otherPool.query(`SELECT command_key FROM gateway_test_effects
      WHERE command_key=$1 AND account_id=$2 AND target_url=$3 AND body_json=$4`,
    [idempotencyKey, accountId, url, canonical(body)])).rows[0];
    return row ? { statusCode: 200 } : null;
  };
  const factory = (database, verifier) => createAgentGateway({ pool: database, security: verifier, context,
    capabilities: CAPABILITIES, dispatch, resolveReceipt, now: () => clock });
  const service = factory(pool, security), otherService = factory(otherPool, otherSecurity);
  const args = { recipeId: 'public-recipe' };
  const preparations = await Promise.all(Array.from({ length: 8 }, (_, index) =>
    (index % 2 ? service : otherService).execute(preparing.principal, 'prepare_crafting_operation', args, { requestId: 'same-request' })));
  assert.equal(new Set(preparations.map((result) => result.data.id)).size, 1);
  assert.equal(dispatches, 0, 'Concurrent agent preparation never executes game authority');
  await reject(service.execute(preparing.principal, 'prepare_crafting_operation', { recipeId: 'different' },
    { requestId: 'same-request' }), 'request_id_reused');
  log('concurrent preparation replay and changed-argument refusal');
  const id = preparations[0].data.id;
  const review = await service.preparation('prepare', id);
  crashNext = true;
  await assert.rejects(service.confirm('prepare', id, { nonce: review.nonce, digest: review.digest }, 'player-only-authority'),
    /simulated lost response/);
  assert.equal((await service.preparation('prepare', id)).state, 'executing');
  previewRevision = 2; // The committed action changed readiness; retry must recover its receipt.
  clock += 600_001; // Expired consent permits recovering an existing receipt, never a new effect.
  const replayed = await factory(otherPool, otherSecurity).confirm('prepare', id,
    { nonce: review.nonce, digest: review.digest }, 'player-only-authority');
  assert.equal(replayed.state, 'completed');
  assert.equal(dispatches, 1, 'Receipt recovery must not dispatch a game action');
  assert.equal((await pool.query('SELECT sum(effect_count) AS total FROM gateway_test_effects')).rows[0].total, '1');
  await service.confirm('prepare', id, { nonce: review.nonce, digest: review.digest }, 'player-only-authority');
  assert.equal(dispatches, 1, 'Completed confirmation replay never redispatches');
  log('expired executing preparation recovers a committed durable receipt across instances without redispatch');

  const missing = await service.execute(preparing.principal, 'prepare_crafting_operation', args, { requestId: 'no-committed-receipt' });
  const missingReview = await service.preparation('prepare', missing.data.id);
  failBeforeCommit = true;
  await assert.rejects(service.confirm('prepare', missing.data.id,
    { nonce: missingReview.nonce, digest: missingReview.digest }, 'player-only-authority'), /before game commit/);
  clock += 600_001;
  const beforeMissingRetry = dispatches;
  await reject(otherService.confirm('prepare', missing.data.id,
    { nonce: missingReview.nonce, digest: missingReview.digest }, 'player-only-authority'), 'preparation_expired');
  assert.equal(dispatches, beforeMissingRetry);
  log('expired executing preparation without a committed receipt cannot issue a new command');

  const revokedWork = await service.execute(preparing.principal, 'prepare_crafting_operation', args, { requestId: 'revoked-recovery' });
  const revokedReview = await service.preparation('prepare', revokedWork.data.id);
  crashNext = true;
  await assert.rejects(service.confirm('prepare', revokedWork.data.id,
    { nonce: revokedReview.nonce, digest: revokedReview.digest }, 'player-only-authority'), /simulated lost response/);
  await otherSecurity.revoke('prepare', preparing.connection.id);
  const beforeRevokedRead = receiptReads;
  await reject(otherService.confirm('prepare', revokedWork.data.id,
    { nonce: revokedReview.nonce, digest: revokedReview.digest }, 'player-only-authority'), 'invalid_token');
  assert.equal(receiptReads, beforeRevokedRead, 'Revoked connection cannot read the committed receipt');
  log('revocation still blocks recovery of an executing preparation with a valid receipt');
  assert.deepEqual(sourceHashes(), startHashes, 'Reviewed source must remain unchanged during the run');
  console.log('Source SHA256: ' + JSON.stringify(startHashes));
  console.log('gateway PostgreSQL regression passed');
} finally {
  Object.assign(dbCaps, priorCaps);
  await otherPool.end(); await pool.end();
  await base.query(`DROP SCHEMA ${namespace} CASCADE`); await base.end();
}
