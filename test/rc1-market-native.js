// Scoped ordinary-entry market workload; concurrent boundaries are quiescent aggregates.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { AsyncLocalStorage } from 'node:async_hooks';
import pg from 'pg';
import { createMarketPolicy, MARKET_POLICY_CONTRACT } from '../tools/rc1-market-policy.js';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex, sha256 } from '../tools/rc1-native-proof.js';
import { installSerialRuntime } from '../tools/rc1-native-determinism.js';
import { createWorkerSchedule, installWorkerInstrumentation, bootOriginalWorker, WORKER_SOURCE_PINS } from '../tools/rc1-native-worker.js';

assert(process.argv.includes('--postgres'), 'Explicit PostgreSQL required');
const output = process.env.RC1_MARKET_OUTPUT, controlUrl = process.env.COORDINATION_TEST_DATABASE_URL;
assert(output && controlUrl, 'Fresh restricted output and local control database required');
const source = await sourceIdentity();
const database = planOwnedWorldDatabase({ controlUrl, runId: 'market-native', sourceRevision: source.revision });
for (const key of ['SEARCH_MS', 'SHOOT_CD_MS', 'SEASON_MOD', 'SEASON_PHASE', 'CHAIN_RPC_URL', 'LIQUIDITY_RPC_URL',
  'LIQUIDITY_RPC_FALLBACK_URL', 'INVARIANT_WEBHOOK_URL', 'CITY_WIRE_WEBHOOK_URL'])
  assert(!process.env[key], 'Undeclared external or timing override: ' + key);
const epoch = Date.parse('2026-09-20T12:00:00.000Z'), NativeDate = Date;
const expectedDormant = [{ label: 'RWA health', code: 'health_registry_unavailable' }];
const configuration = { scenario: 'scoped-market-shared-sale-custody-expiry', policy: MARKET_POLICY_CONTRACT,
  sourcePins: WORKER_SOURCE_PINS, database: database.descriptor, epoch: new Date(epoch).toISOString(), expectedDormant,
  entry: 'Three ordinary guest/character entries with original birth resources. No SQL fixtures, grants or progression. Seller buys one gin through ordinary goods endpoint.',
  schedule: 'Recorded phases: post sale; two concurrent takers plus exact duplicate; post/fill/claim order; cancel goods; cancel/refund order; expire another order after original one-hour TTL, then another original hourly sweep.',
  concurrency: 'Three in-flight HTTP requests against one actual listing. Native SQL dispatch/ack and transaction-local identities are retained with request context. Acknowledgment order is not a PostgreSQL total commit order. Resource snapshots bound the whole quiescent concurrent group, never pretend to isolate overlapping commits.',
  clocks: 'Shared application/SQL logical clock, every original due local worker callback; no TTL edits or wall-time equivalence.',
  excludedIntegrations: ['unconfigured chain watcher', 'disabled liquidity automation', 'unavailable external RWA registry', 'population spawning disabled'],
  exclusions: ['100-inflight burst/12-hour soak', 'all market/auction branches', 'full resource taxonomy', 'per-commit isolation of concurrent writes',
    'PostgreSQL total commit order', 'same-seed fresh-world replay', '90-day/225-run matrix', 'production and real participants'] };
Object.assign(process.env, { DATABASE_URL: database.url, CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on', COORDINATION_ENGINE: 'on',
  COORDINATION_KNOWLEDGE: 'on', COORDINATION_KNOWLEDGE_SHARING: 'on', COORDINATION_OPERATIONS: 'on', COORDINATION_ACCOUNT_IDS: '',
  LIVING_WORLD_DIRECTOR: 'LIVE', DIRECTOR_ACCOUNT_IDS: '', RATE_LIMIT: 'off', INVITE_MODE: 'off', POPULATION_OFF: 'on',
  SOCIAL_VERIFY_MODE: 'off', LIQUIDITY_AUTOMATION_ENABLED: 'off',
  JWT_SECRET: crypto.randomBytes(32).toString('hex'), MARKET_SEED: crypto.randomBytes(32).toString('hex'), MOD_KEY: crypto.randomBytes(32).toString('hex') });
const proof = await createProofRecorder({ directory: output, source, configuration, runId: 'market-native', seed: 'rc1-alpha',
  scenarioId: configuration.scenario, population: 3 });
const runtime = installSerialRuntime('rc1-alpha', configuration.epoch); let at = epoch;
runtime.bindClock(() => at);
const controller = createWorkerSchedule({ start: epoch, setClock: (value) => { at = value; }, expectedDormant });
const contexts = new AsyncLocalStorage(), clients = new WeakMap(), sqlTrace = [];
let nextClient = 0, nextTransaction = 0, traceSequence = 0;
const observationalTrace = {
  wrapQuery(client, query) {
    if (!clients.has(client)) clients.set(client, { id: ++nextClient, transaction: null });
    const state = clients.get(client);
    return async (sql, values) => {
      const text = typeof sql === 'string' ? sql : sql.text;
      const begin = /^\s*(BEGIN|START\s+TRANSACTION)\b/i.test(text), end = /^\s*(COMMIT|ROLLBACK)\s*;?\s*$/i.test(text);
      const mutation = /^\s*(INSERT|UPDATE|DELETE)\b/i.test(text);
      if (begin) state.transaction = ++nextTransaction;
      const observed = begin || end || mutation;
      const entry = { clientId: state.id, transactionLocalId: state.transaction, context: contexts.getStore() || { authority: 'worker-or-bootstrap' },
        sqlSha256: sha256(text), logicalAt: at };
      if (observed) sqlTrace.push({ sequence: ++traceSequence, phase: 'DISPATCH', ...entry, wallAt: new NativeDate().toISOString() });
      try {
        const result = await query(sql, values);
        if (observed) sqlTrace.push({ sequence: ++traceSequence, phase: 'ACKNOWLEDGED', ...entry,
          command: Array.isArray(result) ? 'MULTI_RESULT' : result.command || null,
          rowCount: Array.isArray(result) ? null : result.rowCount ?? null, wallAt: new NativeDate().toISOString() });
        return result;
      } catch (error) {
        if (observed) sqlTrace.push({ sequence: ++traceSequence, phase: 'THREW', ...entry, code: error.code || error.name });
        throw error;
      } finally { if (end) state.transaction = null; }
    };
  },
};
const namespace = 'rc1_worker_market_' + process.pid + '_' + Math.floor(performance.now());
const base = new pg.Pool({ connectionString: database.url });
const seam = installWorkerInstrumentation(controller, { namespace, commitObserver: observationalTrace });
const originalConsole = { log: console.log, warn: console.warn, error: console.error };
let app, result, resourceSequence = 0, invariantBoundaries = 0;
const resourceSummaries = [], unsupported = [], tokens = new Map(), actors = [], policies = new Map();
try {
  for (const level of ['log', 'warn', 'error']) console[level] = (...args) => controller.log(level, args);
  await proof.record({ kind: 'database-created', ...await database.create() });
  await base.query('CREATE SCHEMA ' + namespace);
  const bootstrap = new controller.Pool({ connectionString: database.url, options: '', max: 20 }); await seam.clock.initialize(bootstrap);
  const [{ buildServer }, { runLedgerInvariants }, observer] = await Promise.all([
    import('../src/server.js'), import('../src/invariants.js'), import('../tools/rc1-world-resource-observer.js')]);
  app = await buildServer(); const pool = app.pool;
  const resources = () => contexts.run({ authority: 'resource-observer' }, () => observer.snapshotWorldResources(pool));
  const snapshot = (label) => contexts.run({ authority: 'full-state-observer', label }, () => proof.snapshot(pool, label));
  async function reconcile(before, after, identity) {
    let journal;
    try { journal = observer.reconcileWorldResources(before, after, { identity, includeRestrictedChanges: true }); }
    catch (error) { await proof.artifact('resource-failure-' + resourceSequence++ + '.json', { identity, before, after, message: error.message }); throw error; }
    const label = 'resource-' + resourceSequence++; await proof.artifact(label + '.json', journal);
    unsupported.push(...journal.unsupported.map((entry) => ({ boundary: label, ...entry })));
    resourceSummaries.push({ label, identity, checks: journal.checks.length, status: journal.status, unsupported: journal.unsupported.length });
    await proof.record({ kind: 'resource-boundary', ...resourceSummaries.at(-1) });
  }
  async function invariants(label) {
    const report = await contexts.run({ authority: 'invariant-observer', label }, () => runLedgerInvariants(pool, { alert: false }));
    assert(report.ok, JSON.stringify(report)); invariantBoundaries++;
    await proof.record({ kind: 'canonical-invariants', label, checks: report.checks }); return report.checks.length;
  }
  async function raw(accountId, method, path, body, key, label) {
    const identity = { accountId, method, path, label, logicalAt: at,
      ...(body === undefined ? {} : { body }), ...(key === undefined ? {} : { key }) };
    return contexts.run({ authority: 'ordinary-http', accountId, label, key: key || null }, () => proof.invoke('ordinary-http', identity, async () => {
      const response = await app.inject({ method, url: path, headers: { ...(accountId ? { authorization: 'Bearer ' + tokens.get(accountId) } : {}),
        ...(key ? { 'idempotency-key': key } : {}) }, ...(body === undefined ? {} : { payload: body }) });
      return { status: response.statusCode, replayed: response.headers['x-idempotent-replay'] === 'true', body: response.json() };
    }));
  }
  async function invoke(accountId, method, path, body, key, label = path) {
    const before = await resources(), response = await raw(accountId, method, path, body, key, label);
    await reconcile(before, await resources(), { label, accountId, method, path });
    assert.equal(response.status, 200, JSON.stringify(response)); if (method !== 'GET') await invariants(label); return response;
  }
  for (let i = 0; i < 3; i++) {
    const secret = crypto.randomBytes(32).toString('base64url');
    await proof.artifact('entry-' + i + '-credential.json', { bootstrapSecret: secret });
    const guest = await invoke(null, 'POST', '/v1/auth/guest', { bootstrapSecret: secret }, undefined, 'guest-' + i);
    const accountId = app.jwt.verify(guest.body.token).sub; tokens.set(accountId, guest.body.token);
    await proof.artifact('entry-' + i + '-session.json', { accountId, token: guest.body.token });
    const created = await invoke(accountId, 'POST', '/v1/character', { name: 'Market Entry ' + i }, 'entry-character-' + i);
    actors.push({ accountId, characterId: created.body.id }); policies.set(accountId, createMarketPolicy({ accountId, seed: 'rc1-alpha' }));
  }
  const [seller, buyerA, buyerB] = actors;
  const publicRules = (await invoke(seller.accountId, 'GET', '/v1/rules')).body;
  const view = async (actor) => ({ accountId: app.jwt.verify(tokens.get(actor.accountId)).sub, rules: publicRules,
    session: (await invoke(actor.accountId, 'GET', '/v1/session')).body,
    me: (await invoke(actor.accountId, 'GET', '/v1/me')).body,
    market: (await invoke(actor.accountId, 'GET', '/v1/market')).body });
  async function choose(actor, phase, label) {
    const policy = policies.get(actor.accountId), projection = await view(actor);
    const decision = policy.choose(projection, { logicalAt: at, phase }); assert.equal(decision.kind, 'command');
    await proof.record({ kind: 'policy-choice', label, actor: actor.accountId, decision });
    await proof.artifact(label + '-pending.json', policy.checkpoint());
    const restored = createMarketPolicy({ accountId: actor.accountId, seed: 'rc1-alpha' }).restore(policy.checkpoint());
    assert.deepEqual(restored.choose(projection, { logicalAt: at, phase }), decision); policies.set(actor.accountId, restored); return decision;
  }
  function settle(actor, decision, response) {
    assert([200, 400, 409].includes(response.status), JSON.stringify(response));
    assert.notEqual(response.status, 409, 'Retry in-flight duplicate before settling, without changing its identity');
    policies.get(actor.accountId).settle({ idempotencyKey: decision.request.idempotencyKey, status: response.status === 200 ? 'COMPLETED' : 'DENIED',
      replayed: response.replayed, response: response.body });
  }
  async function act(actor, phase, label) {
    const decision = await choose(actor, phase, label), r = decision.request;
    const response = await invoke(actor.accountId, r.method, r.path, r.body, r.idempotencyKey, label);
    settle(actor, decision, response); return { decision, response };
  }
  async function goodsState(label) {
    const cargo = (await pool.query('SELECT character_id,good_id,qty FROM character_cargo ORDER BY character_id,good_id')).rows;
    const listings = (await pool.query('SELECT * FROM market_listings ORDER BY id')).rows;
    const total = cargo.reduce((sum, row) => sum + Number(row.qty), 0)
      + listings.reduce((sum, row) => sum + (row.kind === 'good' && ['live', 'expired'].includes(row.status) ? Number(row.qty) : 0)
        + (row.kind === 'order' ? Number(row.filled_qty) : 0), 0);
    await proof.artifact(label + '-goods.json', { cargo, listings, total, semantics: 'Actual cargo plus goods escrow plus delivered warehouse goods; wanted units are not assets.' });
    assert.equal(total, 1, 'Physical goods must never duplicate or disappear in this bounded market exercise'); return { cargo, listings, total };
  }
  await invoke(seller.accountId, 'POST', '/v1/goods/buy', { goodId: 'gin', qty: 1 }, 'initial-goods');
  const invariantChecks = await invariants('baseline');
  await proof.record({ kind: 'measured-initialization', ordinaryEntrants: 3, fixtureWritesAfterThisRecord: false, directFixtureWrites: 0 });
  await snapshot('initial'); await goodsState('initial');
  const posted = await act(seller, 'post', 'post-sale'); assert.equal(posted.decision.type, 'market.post-good');
  const saleId = posted.response.body.id; await goodsState('sale-posted');
  const choiceA = await choose(buyerA, 'take', 'take-a'), choiceB = await choose(buyerB, 'take', 'take-b');
  assert.equal(choiceA.stableId, saleId); assert.equal(choiceB.stableId, saleId);
  const beforeRace = await resources(); await snapshot('before-race');
  const launch = (actor, decision, label) => raw(actor.accountId, decision.request.method, decision.request.path,
    decision.request.body, decision.request.idempotencyKey, label);
  const responses = await Promise.all([launch(buyerA, choiceA, 'concurrent-a'), launch(buyerB, choiceB, 'concurrent-b'),
    launch(buyerA, choiceA, 'concurrent-a-duplicate')]);
  await reconcile(beforeRace, await resources(), { authority: 'quiescent-concurrent-group', requests: 3, sharedListing: saleId });
  await invariants('concurrent-group'); await snapshot('after-race'); await goodsState('after-race');
  await proof.artifact('concurrent-responses.json', { responses, traceSemantics: configuration.concurrency });
  const completed = [];
  for (const [actor, decision, indices] of [[buyerA, choiceA, [0, 2]], [buyerB, choiceB, [1]]]) {
    const matching = indices.map((i) => responses[i]); let response = matching.find((r) => r.status === 200 && !r.replayed)
      || matching.find((r) => r.status === 400 && !r.replayed);
    if (!response) response = await launch(actor, decision, 'resolve-same-identity-' + actor.accountId);
    settle(actor, decision, response); completed.push({ actor, decision, response });
  }
  const winners = completed.filter((entry) => entry.response.status === 200); assert.equal(winners.length, 1);
  const winner = winners[0], loser = completed.find((entry) => entry.response.status !== 200);
  assert(loser && loser.response.body.error); assert.equal(winner.response.body.qty, 1);
  const ownerRows = (await pool.query('SELECT id,cash FROM characters WHERE id=ANY($1::text[])', [[buyerA.characterId, buyerB.characterId]])).rows;
  assert.equal(Number(ownerRows.find((row) => row.id === winner.actor.characterId).cash), 450);
  assert.equal(Number(ownerRows.find((row) => row.id === loser.actor.characterId).cash), 500);
  const beforeDuplicate = await snapshot('before-known-duplicate');
  const exact = await launch(winner.actor, winner.decision, 'known-winner-replay');
  assert.equal(exact.replayed, true); assert.deepEqual(exact.body, winner.response.body); settle(winner.actor, winner.decision, exact);
  const afterDuplicate = await snapshot('after-known-duplicate'); assert.equal(afterDuplicate.stateSha256, beforeDuplicate.stateSha256);
  const order = await act(seller, 'post', 'post-filled-order'); assert.equal(order.decision.type, 'market.post-order'); assert.equal(order.response.body.good, 'gin');
  const fill = await act(winner.actor, 'take', 'fill-order'); assert.equal(fill.decision.type, 'market.fill'); assert.equal(fill.response.body.delivered, 1);
  await goodsState('warehouse');
  const claim = await act(seller, 'claim', 'claim-warehouse'); assert.equal(claim.response.body.claimed, 1); await goodsState('claimed');
  await act(seller, 'post', 'post-cancelled-goods'); const cancelledGoods = await act(seller, 'cancel', 'cancel-goods');
  assert.equal(cancelledGoods.response.body.cancelled, cancelledGoods.decision.stableId); await goodsState('goods-returned');
  const cancellable = await act(loser.actor, 'post', 'post-cancelled-order'); assert.equal(cancellable.response.body.escrow, 50);
  const refunded = await act(loser.actor, 'cancel', 'cancel-order'); assert.equal(refunded.response.body.refunded, 50);
  const cancelBeforeRetry = await snapshot('cancel-retry-before');
  const cancelRetry = await launch(loser.actor, refunded.decision, 'cancel-exact-replay');
  assert(cancelRetry.replayed); assert.deepEqual(cancelRetry.body, refunded.response.body); settle(loser.actor, refunded.decision, cancelRetry);
  assert.equal((await snapshot('cancel-retry-after')).stateSha256, cancelBeforeRetry.stateSha256);
  const expires = await act(loser.actor, 'post', 'post-expiring-order'); assert.equal(expires.response.body.expiresSeconds, 3600);
  const expiryId = expires.response.body.id;
  const observedBeforeBoot = await resources(); await bootOriginalWorker(controller);
  await reconcile(observedBeforeBoot, await resources(), { authority: 'original-worker-boot' }); await invariants('worker-boot');
  let prior = await resources(), firstRefundCash = null;
  await controller.advanceTo(epoch + 2 * 3600000, async (logicalAt, label) => {
    const after = await resources(); await reconcile(prior, after, { authority: 'original-worker-callback', label, logicalAt }); prior = after;
    await invariants('worker:' + label);
    if (label === 'guardedTick') {
      const row = (await pool.query('SELECT status,qty,expires_at FROM market_listings WHERE id=$1', [expiryId])).rows[0];
      assert.equal(new Date(row.expires_at).getTime(), epoch + 3600000); assert.equal(row.status, 'expired'); assert.equal(Number(row.qty), 0);
      const cash = Number((await pool.query('SELECT cash FROM characters WHERE id=$1', [loser.actor.characterId])).rows[0].cash);
      if (firstRefundCash === null) firstRefundCash = cash; else assert.equal(cash, firstRefundCash, 'Repeated expiry must not repeat its refund');
      await snapshot('expiry-hour-' + (logicalAt - epoch) / 3600000); await goodsState('expiry-hour-' + (logicalAt - epoch) / 3600000);
    }
  });
  assert.equal(firstRefundCash, 480);
  const refunds = (await pool.query("SELECT * FROM transactions WHERE character_id=$1 AND reason='market:refund'", [loser.actor.characterId])).rows;
  assert.equal(refunds.length, 2); assert.equal(refunds.reduce((sum, row) => sum + Number(row.amount), 0), 100);
  await proof.artifact('refunds.json', { refunds, cancelledOrder: cancellable.response.body.id, expiredOrder: expiryId });
  const trace = controller.diagnostic(); assert.equal(trace.failures.length, 0);
  const timerCounts = Object.fromEntries(['directorTick', 'guardedTick', 'guardedSeasonTick', 'health-boundary'].map((label) =>
    [label, trace.events.filter((entry) => entry.kind === 'timer.fire' && entry.label === label).length]));
  assert.deepEqual(timerCounts, { directorTick: 24, guardedTick: 2, guardedSeasonTick: 2, 'health-boundary': 24 });
  await invariants('final'); const final = await snapshot('final'); await goodsState('final');
  await proof.artifact('worker-schedule.json', trace); await proof.artifact('sql-dispatch-ack-trace.json', { semantics: configuration.concurrency, events: sqlTrace });
  await proof.artifact('random-tape.json', { draws: runtime.tape });
  await proof.artifact('resource-summary.json', { resourceSummaries, unsupported, qualifyingFullResourcePass: false });
  await proof.artifact('policy-checkpoints.json', [...policies].map(([accountId, policy]) => ({ accountId, checkpoint: policy.checkpoint() })));
  for (const line of (await fs.readFile(output + '/history.jsonl', 'utf8')).trim().split('\n')) JSON.parse(line);
  result = { status: 'PASS_SCOPED', ordinaryEntrants: 3, directFixtureWrites: 0, maximumInFlight: 3,
    concurrentWinners: 1, concurrentDenials: 1, exactCompletedRetries: 2, originalExpirySeconds: 3600, observedLogicalHours: 2,
    goodsConserved: 1, actualCancelRefund: 50, actualExpiryRefund: 50, duplicateExpiryRefund: 0, timerCounts,
    invariantChecks, invariantBoundaries, resourceBoundaries: resourceSummaries.length, unsupportedResourceClassifications: unsupported.length,
    policies: [...policies].map(([accountId, policy]) => ({ accountId, summary: policy.summary() })),
    nativeCommitAcknowledgments: sqlTrace.filter((row) => row.phase === 'ACKNOWLEDGED' && row.command === 'COMMIT').length,
    postgresTotalCommitOrder: false, qualifyingFullResourcePass: false, finalStateSha256: final.stateSha256, matrixQualifying: false, exclusions: configuration.exclusions };
} catch (error) {
  result = { status: 'FAIL', message: error.message, stack: error.stack, logicalAt: at }; process.exitCode = 1;
  await proof.record({ kind: 'first-failure', ...result });
  await proof.artifact('failure-worker-schedule.json', controller.diagnostic());
  await proof.artifact('failure-sql-trace.json', { events: sqlTrace });
  await proof.artifact('failure-resource-summary.json', { resourceSummaries, unsupported });
  if (app) await proof.snapshot(app.pool, 'failure');
} finally {
  for (const level of ['log', 'warn', 'error']) console[level] = originalConsole[level];
  for (const close of [async () => { if (app) await app.close(); }, () => controller.close(), () => base.end(),
    async () => proof.record({ kind: 'database-cleanup', ...await database.close() })]) {
    try { await close(); } catch (error) { result.status = 'FAIL'; result.cleanupFailure = error.message; process.exitCode = 1;
      await proof.record({ kind: 'cleanup-failure', message: error.message }); }
  }
  seam.restore(); runtime.restore(); const record = await proof.finish(result); await verifyArtifactIndex(output, record);
}
console.log(JSON.stringify(result));
