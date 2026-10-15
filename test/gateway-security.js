// Executable delegation, scope, replay and confirmation boundary regressions.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { makeDb } from '../src/db.js';
import { createGatewaySecurity, DEFAULT_SCOPES, SCOPES, object } from '../src/gateway/security.js';
import { createAgentGateway } from '../src/gateway/service.js';

assert(!process.env.DATABASE_URL, 'Use isolated memory mode for this suite.');
const pool = await makeDb();
const accountId = crypto.randomUUID(), otherId = crypto.randomUUID();
for (const id of [accountId, otherId]) await pool.query(
  'INSERT INTO accounts (id,auth_provider,auth_subject) VALUES ($1,$2,$3)', [id, 'gateway-test', id]);
let clock = Date.now();
const security = createGatewaySecurity({ pool, now: () => clock });
const grant = (scopes = DEFAULT_SCOPES, provider = 'muse', account = accountId) =>
  security.create(account, { provider, label: 'Consigliere test', scopes });
const auth = (value, provider) => security.authenticate('Bearer ' + value.token, provider);
const rejects = (fn, code) => assert.rejects(fn, (error) => error.code === code);
try {
  const basic = await grant();
  assert.match(basic.token, /^ogw_[A-Za-z0-9_-]{43}$/);
  assert(!basic.connection.scopes.includes('omerta.actions.commit'));
  assert(!JSON.stringify(await security.list(accountId)).includes(basic.token));
  const stored = (await pool.query('SELECT token_hash FROM agent_gateway_connections WHERE id=$1', [basic.connection.id])).rows[0];
  assert.equal(stored.token_hash.length, 64);
  assert.notEqual(stored.token_hash, basic.token);
  assert.equal((await auth(basic)).accountId, accountId);
  await rejects(() => auth(basic, 'claude'), 'provider_mismatch');
  await rejects(() => security.authenticate('Bearer full-player-jwt'), 'invalid_token');
  for (const scopes of [['admin'], ['omerta.player.read', 'omerta.player.read'], [], '*', [true]])
    await rejects(() => grant(scopes), 'invalid_arguments');
  await rejects(() => security.create(accountId, { provider: 'muse', label: 'Test', scopes: DEFAULT_SCOPES, accountId: otherId }), 'invalid_arguments');
  await rejects(() => security.create(accountId, { provider: 'muse', label: 'Test', scopes: DEFAULT_SCOPES, expiresInSeconds: '300' }), 'invalid_arguments');
  assert.equal((await security.revoke(otherId, basic.connection.id)).revoked, false);
  assert.equal((await auth(basic)).accountId, accountId);
  await security.revoke(accountId, basic.connection.id);
  await rejects(() => auth(basic), 'invalid_token');
  const expired = await grant(); clock += 86400 * 1000 + 1;
  await rejects(() => auth(expired), 'invalid_token');
  const versioned = await grant();
  await pool.query('UPDATE accounts SET token_version=token_version+1 WHERE id=$1', [accountId]);
  await rejects(() => auth(versioned), 'invalid_token');
  const banned = await grant();
  await pool.query("UPDATE accounts SET status='banned' WHERE id=$1", [accountId]);
  await rejects(() => auth(banned), 'invalid_token');
  await pool.query("UPDATE accounts SET status='active' WHERE id=$1", [accountId]);

  let previewVersion = 1, reads = 0, executions = 0, crash = false, throttleRace = false;
  const receipts = new Map();
  const capabilities = [
    { name: 'get_player_context', actionClass: 'READ', scopes: ['omerta.player.read'], inputSchema: object() },
    { name: 'prepare_crafting_operation', actionClass: 'PREPARE', scopes: ['omerta.actions.prepare'],
      inputSchema: object({ recipeId: { type: 'string', minLength: 1, maxLength: 80 } }, ['recipeId']) },
  ];
  const service = createAgentGateway({ pool, security, capabilities, now: () => clock,
    resolveReceipt: async ({ idempotencyKey }) => receipts.get(idempotencyKey) || null,
    context: {
      execute: async () => ({ currentRead: ++reads }),
      prepare: async () => ({ recipe: 'fixture', quantity: 1, cost: previewVersion }),
    },
    dispatch: async ({ idempotencyKey, authorization, url, body }) => {
      assert.equal(authorization, 'Bearer player-only');
      assert.match(url, /^\/v1\/worldgraph\/recipes\//);
      assert.deepEqual(body, {});
      if (!receipts.has(idempotencyKey)) { executions++; receipts.set(idempotencyKey, { statusCode: 200 }); }
      if (throttleRace) {
        throttleRace = false;
        // A concurrent request got a pre-execution 429 while this request committed.
        await pool.query("UPDATE agent_gateway_preparations SET state='pending' WHERE id=$1", [idempotencyKey.slice('gateway-'.length)]);
      }
      if (crash) { crash = false; throw new Error('response lost after authoritative commit'); }
      return receipts.get(idempotencyKey);
    },
  });
  const full = await grant(SCOPES), principal = await auth(full);
  const basic2 = await grant(), readPrincipal = await auth(basic2);
  const call = (name, args, requestId, p = principal) => service.execute(p, name, args, { requestId });
  await rejects(() => call('prepare_crafting_operation', { recipeId: 'fixture' }, 'no-scope', readPrincipal), 'insufficient_scope');
  await rejects(() => call('get_player_context', { owner: otherId }, 'owner-spoof'), 'invalid_arguments');
  await rejects(() => call('nonexistent', {}, 'unknown'), 'unknown_capability');
  const read = await call('get_player_context', {}, 'read-1');
  assert.equal(read.data.currentRead, 1);
  assert.equal((await call('get_player_context', {}, 'read-1')).data.currentRead, 2, 'read retries refresh current visibility');
  await rejects(() => call('prepare_crafting_operation', { recipeId: 'fixture' }, 'read-1'), 'request_id_reused');
  const prepared = await call('prepare_crafting_operation', { recipeId: 'fixture' }, 'prep-1');
  assert.equal(executions, 0, 'agent cannot execute even with all scopes');
  assert(!Object.hasOwn(prepared.data, 'nonce'));
  const human = await service.preparation(accountId, prepared.data.id);
  await rejects(() => service.preparation(otherId, human.id), 'preparation_unavailable');
  await rejects(() => service.confirm(accountId, human.id, { nonce: 'x'.repeat(43), digest: human.digest }, 'Bearer player-only'), 'confirmation_mismatch');
  const confirm = (proposal) => service.confirm(accountId, proposal.id, { nonce: proposal.nonce, digest: proposal.digest }, 'Bearer player-only');
  previewVersion++;
  await rejects(() => confirm(human), 'stale_preparation');
  assert.equal(executions, 0);
  previewVersion--;
  const confirmed = await confirm(human);
  assert.equal(confirmed.state, 'completed');
  assert.equal(executions, 1);
  assert.equal((await confirm(human)).state, 'completed');
  assert.equal(executions, 1, 'completed confirmations do not dispatch again');
  const recover = await call('prepare_crafting_operation', { recipeId: 'fixture' }, 'prep-recover');
  const recoveryHuman = await service.preparation(accountId, recover.data.id);
  crash = true;
  await assert.rejects(() => confirm(recoveryHuman), /response lost/);
  previewVersion++; // The game action itself can change readiness; recovering its receipt must still work.
  assert.equal((await confirm(recoveryHuman)).state, 'completed');
  assert.equal(executions, 2);
  const concurrent = await call('prepare_crafting_operation', { recipeId: 'fixture' }, 'prep-concurrent');
  const concurrentHuman = await service.preparation(accountId, concurrent.data.id);
  await Promise.all(Array.from({ length: 6 }, () => confirm(concurrentHuman)));
  assert.equal(executions, 3, 'one authoritative idempotency key across concurrent confirmations');
  const racing = await call('prepare_crafting_operation', { recipeId: 'fixture' }, 'prep-throttle-race');
  const racingHuman = await service.preparation(accountId, racing.data.id);
  throttleRace = true;
  assert.equal((await confirm(racingHuman)).state, 'completed', 'committed success dominates a concurrent throttle reset');
  await pool.query("UPDATE agent_gateway_preparations SET state='pending' WHERE id=$1", [racingHuman.id]);
  previewVersion++;
  assert.equal((await confirm(racingHuman)).state, 'completed', 'a committed receipt recovers even after a stale sibling reset');
  assert.equal(executions, 4);
  const revokedProposal = await call('prepare_crafting_operation', { recipeId: 'fixture' }, 'prep-revoke');
  const revokedHuman = await service.preparation(accountId, revokedProposal.data.id);
  await security.revoke(accountId, full.connection.id);
  await rejects(() => confirm(revokedHuman), 'invalid_token');
  const activity = await service.activity(accountId);
  assert(activity.activity.some((entry) => entry.result === 'insufficient_scope'));
  assert(activity.activity.some((entry) => entry.confirmationState === 'completed'));
  assert(!JSON.stringify(activity).includes(full.token));

  clock += 60000;
  const limited = await auth(await grant());
  const attempts = await Promise.allSettled(Array.from({ length: 65 }, () => security.rateLimit(limited)));
  assert.equal(attempts.filter((entry) => entry.status === 'fulfilled').length, 60);
  assert(attempts.filter((entry) => entry.status === 'rejected').every((entry) => entry.reason.code === 'rate_limited'));
  const alternate = await auth(await grant());
  await rejects(() => security.rateLimit(alternate), 'rate_limited');
  clock += 60000;
  await security.rateLimit(alternate);
  console.log('gateway security: delegation, strict scopes, revocation, bounded account rate, replay, stale confirmation and crash recovery passed');
} finally { await pool.end(); }
