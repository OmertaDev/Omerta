import assert from 'node:assert/strict';
import { commandDatabase, addPlayer, postgres } from './lib/player-command-support.js';
import { resourceTransaction, lockResourceTreasury } from '../src/resourcebook.js';
import { resourceOutcomes } from '../src/resourceoutcomes.js';
import { validateResourceOutcomeRecord } from '../src/resourceoutcomeobserver.js';
import Fastify from 'fastify';
import { register as registerResources } from '../src/routes/resources.js';

const database = await commandDatabase('resourceoutcomes'); const pool = database.pool;
const account = 'outcome-seller', buyer = 'outcome-buyer', other = 'outcome-other';
const job = async (id, seller = account, state = 'accepted') => pool.query('INSERT INTO resource_jobs(id,buyer_account,seller_account,request_key,service_revision,price_usd_micros,input,state,expires_at,report) VALUES($1,$2,$3,$4,1,10000,$5,$6,$7,$8)',
  [id, buyer, seller, id, { question: 'PRIVATE_INPUT' }, state, new Date(), { text: 'PRIVATE_REPORT' }]);
const call = async (id, jobId, owner = account, status = 'succeeded', cost = 3, providerCost = 2, kind = 'paid_market_analysis') => pool.query('INSERT INTO resource_calls(id,account_id,request_key,request_hash,provider_id,config,max_output_tokens,cap_usd_micros,cost_usd_micros,provider_cost_usd_micros,policy_revision,purpose,status,simulated,output,provider_request_id) VALUES($1,$2,$3,$4,$5,$6,10,100,$7,$8,1,$9,$10,true,$11,$12)',
  [id, owner, id, 'hash', 'fixture-provider', { model: 'configured-fixture', secret: 'PRIVATE_CONFIG' }, cost, providerCost,
    { kind, jobId, prompt: 'PRIVATE_PURPOSE' }, status, 'PRIVATE_OUTPUT', 'PRIVATE_RECEIPT_' + id]);
try {
  const empty = await resourceOutcomes(pool, account);
  validateResourceOutcomeRecord(empty, account);
  assert.equal(empty.resourceMode, null); assert.equal(empty.jobs.length, 0);
  assert.equal(Number((await pool.query('SELECT COUNT(*) AS count FROM resource_treasuries')).rows[0].count), 0);
  for (const id of [account, buyer, other]) {
    await addPlayer(pool, id);
    await resourceTransaction(pool, client => lockResourceTreasury(client, id));
  }
  await job('primary'); await job('foreign', other); await job('refunded', account, 'refunded');
  await call('selected', 'primary'); await call('unknown', 'primary', account, 'unknown', null, null);
  await call('failed', 'primary', account, 'failed', 0, 0);
  await call('foreign-owner', 'primary', other);
  await call('foreign-job', 'foreign');
  await call('wrong-purpose', 'primary', account, 'succeeded', 3, 2, 'game_decision');
  await pool.query('UPDATE resource_jobs SET call_id=$2 WHERE id=$1', ['primary', 'selected']);
  await pool.query('UPDATE resource_jobs SET call_id=$2 WHERE id=$1', ['refunded', 'foreign-owner']);
  const beforeCalls = Number((await pool.query('SELECT COUNT(*) AS count FROM resource_calls')).rows[0].count);
  const queries = []; const connect = pool.connect;
  pool.connect = async (...args) => {
    const client = await connect.apply(pool, args); const query = client.query, release = client.release;
    client.query = function (...values) { queries.push(values[0]); return query.apply(this, values); };
    client.release = function (...values) { this.query = query; this.release = release; return release.apply(this, values); };
    return client;
  };
  let feed;
  try { feed = await resourceOutcomes(pool, account); } finally { pool.connect = connect; }
  assert(queries.every(sql => /^\s*(SELECT|BEGIN|COMMIT|ROLLBACK)\b/i.test(sql)), 'Feed executes no mutation SQL');
  assert(queries.every(sql => !/SELECT\s+\*|\b(input|report|output|provider_request_id)\b/i.test(sql)), 'Raw private columns never loaded');
  assert.equal(Number((await pool.query('SELECT COUNT(*) AS count FROM resource_calls')).rows[0].count), beforeCalls);
  assert.equal(feed.totals.attemptsTotal, 3, 'Global accounting binds both call owner and job seller');
  assert.equal(feed.totals.recordedChargeUsdMicros, 3); assert.equal(feed.totals.recordedProviderCostUsdMicros, 2);
  assert.equal(feed.totals.unknownChargeAttempts, 1); assert.equal(feed.totals.unknownProviderCostAttempts, 1);
  const primary = feed.jobs.find(row => row.taskId === 'primary');
  assert.equal(primary.accepted, true); assert.equal(primary.selectedAttemptId, 'selected');
  assert.equal(primary.selectedAttempt.configuredModel, 'configured-fixture');
  assert.equal(primary.selectedAttempt.latencyMs, null);
  assert.equal(primary.attempts.find(row => row.attemptId === 'unknown').recordedChargeUsdMicros, null);
  assert.equal(primary.attempts.find(row => row.attemptId === 'failed').recordedProviderCostUsdMicros, 0);
  assert.equal(feed.jobs.find(row => row.taskId === 'refunded').accepted, null, 'Refund is not an inferred rejection');
  assert.equal(feed.jobs.find(row => row.taskId === 'refunded').selectedAttempt, null, 'Selected calls must belong to seller and exact job');
  for (const invalidSelected of ['wrong-purpose', 'foreign-job']) {
    await pool.query('UPDATE resource_jobs SET call_id=$2 WHERE id=$1', ['refunded', invalidSelected]);
    assert.equal((await resourceOutcomes(pool, account)).jobs.find(row => row.taskId === 'refunded').selectedAttempt, null,
      'Selection must use paid work purpose and bind the exact owned job');
  }
  await pool.query("UPDATE resource_jobs SET state='disputed' WHERE id='refunded'");
  assert.equal((await resourceOutcomes(pool, account)).jobs.find(row => row.taskId === 'refunded').accepted, false);
  await pool.query("UPDATE resource_jobs SET state='refunded' WHERE id='refunded'");
  assert(!JSON.stringify(feed).includes('PRIVATE_'));
  assert.equal((await resourceOutcomes(pool, buyer)).jobs.length, 0);
  const app = Fastify();
  const balancesBefore = (await pool.query('SELECT account_id,available_usd_micros,reserved_usd_micros FROM resource_treasuries ORDER BY account_id')).rows;
  registerResources(app, { pool, auth: async (request, reply) => {
    const identities = { 'Bearer fixture-seller': account, 'Bearer fixture-buyer': buyer, 'Bearer fixture-agent': account };
    const sub = identities[request.headers.authorization];
    if (!sub) return reply.code(401).send({ error: 'unauthorized' });
    request.user = { sub, agent: request.headers.authorization === 'Bearer fixture-agent' };
  }, modAuth: async (_request, reply) => reply.code(403).send({ error: 'forbidden' }) });
  try {
    assert.equal((await app.inject({ method: 'GET', url: '/v1/resources/outcomes' })).statusCode, 401);
    assert.equal((await app.inject({ method: 'GET', url: '/v1/resources/outcomes', headers: { authorization: 'Bearer invalid' } })).statusCode, 401);
    for (const authorization of ['Bearer fixture-seller', 'Bearer fixture-agent']) {
      const response = await app.inject({ method: 'GET', url: `/v1/resources/outcomes?accountId=${other}&account=${buyer}`, headers: { authorization } });
      assert.equal(response.statusCode, 200);
      const body = response.json(); assert.equal(body.accountId, account);
      assert.equal(body.jobs.some(row => row.taskId === 'foreign'), false);
      assert.equal(body.totals.attemptsTotal, 3);
      assert(!response.body.includes('PRIVATE_'));
    }
    const buyerResponse = await app.inject({ method: 'GET', url: `/v1/resources/outcomes?accountId=${account}`, headers: { authorization: 'Bearer fixture-buyer' } });
    assert.equal(buyerResponse.statusCode, 200); assert.equal(buyerResponse.json().accountId, buyer);
    assert.equal(buyerResponse.json().jobs.length, 0);
    assert.deepEqual((await pool.query('SELECT account_id,available_usd_micros,reserved_usd_micros FROM resource_treasuries ORDER BY account_id')).rows, balancesBefore);
    assert.equal(Number((await pool.query('SELECT COUNT(*) AS count FROM resource_calls')).rows[0].count), beforeCalls);
  } finally { await app.close(); }
  for (let index = 0; index < 101; index++) await call(`history-${index}`, 'primary');
  const bounded = await resourceOutcomes(pool, account);
  validateResourceOutcomeRecord(bounded, account); const boundedJob = bounded.jobs.find(row => row.taskId === 'primary');
  assert.equal(boundedJob.attempts.length, 100); assert.equal(boundedJob.totals.attemptsTotal, 104);
  assert.equal(boundedJob.totals.recordedChargeUsdMicros, 306); assert.equal(boundedJob.coverage.attemptsTruncated, true);
  assert.equal(boundedJob.selectedAttempt.attemptId, 'selected', 'Selected projection remains available outside recent attempt page');
  for (let index = 0; index < 101; index++) { await job(`job-history-${index}`); await call(`job-call-${index}`, `job-history-${index}`); }
  const truncated = await resourceOutcomes(pool, account);
  validateResourceOutcomeRecord(truncated, account);
  assert.equal(truncated.jobs.length, 100); assert.equal(truncated.coverage.jobsTotal, 103);
  assert.equal(truncated.coverage.jobsTruncated, true); assert.equal(truncated.totals.attemptsTotal, 205);
  assert.equal(truncated.totals.recordedChargeUsdMicros, 609, 'Full totals survive job detail truncation');
  assert(Buffer.byteLength(JSON.stringify(truncated)) <= 1048576);
  for (let index = 0; index < 10; index++) {
    const id = `many-attempt-job-${index}`; await job(id);
    for (let attempt = 0; attempt < 101; attempt++) await call(`many-${index}-${attempt}`, id);
  }
  const globalBounded = await resourceOutcomes(pool, account);
  validateResourceOutcomeRecord(globalBounded, account);
  assert.equal(globalBounded.coverage.attemptsReturned, 1000);
  assert.equal(globalBounded.coverage.attemptsTotal, 1215);
  assert.equal(globalBounded.totals.recordedChargeUsdMicros, 3639);
  assert(globalBounded.jobs.every(row => row.attempts.length <= 100));
  assert.equal(globalBounded.coverage.attemptsTruncated, true);
  assert(Buffer.byteLength(JSON.stringify(globalBounded)) <= 1048576);
  console.log(`resourceoutcomes PASS (${postgres ? 'PostgreSQL' : 'memory'}) private read-only attempts, selected binding, full totals and detail coverage`);
} finally { await database.cleanup(pool); }
