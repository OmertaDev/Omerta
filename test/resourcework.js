process.env.RESOURCE_ECONOMY = 'on';
process.env.RESOURCE_PAYMENTS_MODE = 'test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import Fastify from 'fastify';
import { register as registerResources } from '../src/routes/resources.js';
import { commandDatabase, addPlayer } from './lib/player-command-support.js';
import { resourceTransaction, lockResourceTreasury, moveResourceMoney, setResourcePolicy, resourceAccounting } from '../src/resourcebook.js';
import { setResourceService, resourceServiceBoard, createResourceJob, claimResourceJob, workResourceJob,
  acceptResourceJob, disputeResourceJob, adjudicateResourceJob, expireResourceJob, listResourceJobs, resourceJobView } from '../src/resourcework.js';

const database = await commandDatabase('resourcework'); const pool = database.pool;
const error = code => value => value.code === `resource_${code}`;
const buyer = 'resource-buyer', seller = 'resource-seller', outsider = 'resource-outsider';
const service = { enabled: true, kind: 'market_analysis', expectedRevision: 0, priceUsdMicros: 100000 };
const terms = { sellerAccountId: seller, expectedServiceRevision: 1, question: 'Which public goods are available?' };
const computeTerms = { providerId: 'test-compute', maxOutputTokens: 50 };
async function create(key) { return (await createResourceJob(pool, buyer, { ...terms, requestId: key })).job; }
async function seedCall(account, request, status = 'succeeded', purpose = request.purpose, client = pool) {
  const id = crypto.randomUUID();
  await client.query('INSERT INTO resource_calls(id,account_id,request_key,request_hash,provider_id,config,max_output_tokens,cap_usd_micros,cost_usd_micros,provider_cost_usd_micros,policy_revision,purpose,output,status,simulated) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)',
    [id, account, request.requestId, 'test-only-hash', request.providerId, {}, request.maxOutputTokens, 100, 10, 10, 1, purpose, 'Public market analysis; uncertainty disclosed.', status, true]);
  return { resourceAction: 'compute', call: { id, status, purpose, costUsdMicros: 10 } };
}
const fakeCompute = async (_pool, account, body, options) => {
  return resourceTransaction(pool, async client => {
    await lockResourceTreasury(client, account);
    await options.beforeReserve(client);
    return seedCall(account, body, 'succeeded', body.purpose, client);
  });
};
try {
  for (const account of [buyer, seller, outsider]) {
    await addPlayer(pool, account);
    await resourceTransaction(pool, async client => {
      await lockResourceTreasury(client, account);
      await moveResourceMoney(client, account, 10000000, 0, 'capital', `test:${account}`);
    });
  }
  await setResourcePolicy(pool, buyer, { expectedRevision: 0, enabled: true, providers: ['service:market-analysis'],
    allowStoredResponses: false, maxPerCallUsdMicros: 100000, maxPerDayUsdMicros: 10000000,
    minimumReserveUsdMicros: 10000, expiresInSeconds: 3600 });
  assert.equal((await setResourceService(pool, seller, service)).service.revision, 1);
  assert.equal((await resourceServiceBoard(pool)).services.length, 1);
  await assert.rejects(setResourceService(pool, seller, service), error('revision'));
  await assert.rejects(setResourceService(pool, seller, { ...service, expectedRevision: 1, priceUsdMicros: 100001 }), error('service'));
  await assert.rejects(createResourceJob(pool, buyer, { ...terms, sellerAccountId: buyer, requestId: 'self' }), error('service'));
  await assert.rejects(createResourceJob(pool, outsider, { ...terms, requestId: 'no-authority' }), error('authority'));
  const first = await create('first');
  assert.equal(first.state, 'open'); assert.equal((await resourceAccounting(pool, buyer)).reservedUsdMicros, 100000);
  assert.equal((await create('first')).id, first.id);
  await assert.rejects(createResourceJob(pool, buyer, { ...terms, requestId: 'first', question: 'Different terms' }), error('replay'));
  await assert.rejects(claimResourceJob(pool, outsider, first.id), error('job'));
  await assert.rejects(acceptResourceJob(pool, buyer, first.id), error('state'));
  assert.throws(() => resourceJobView({ buyer_account: buyer, seller_account: seller }, outsider), error('job'));
  assert.equal((await listResourceJobs(pool, outsider)).jobs.length, 0);
  await claimResourceJob(pool, seller, first.id);
  const submitted = await workResourceJob(pool, seller, first.id, computeTerms, { compute: fakeCompute });
  assert.equal(submitted.job.state, 'submitted');
  assert.equal(submitted.job.report.source, 'public_market_board');
  assert.match(submitted.job.report.sourceHash, /^[a-f0-9]{64}$/);
  assert.equal((await workResourceJob(pool, seller, first.id, computeTerms, { compute: () => { throw new Error('Must not re-dispatch'); } })).job.state, 'submitted');
  await assert.rejects(workResourceJob(pool, seller, first.id, { ...computeTerms, maxOutputTokens: 51 }, { compute: fakeCompute }), error('replay'));
  assert.equal((await expireResourceJob(pool, first.id)).job.state, 'submitted', 'Cannot accept early');
  const buyerBefore = await resourceAccounting(pool, buyer), sellerBefore = await resourceAccounting(pool, seller);
  await acceptResourceJob(pool, buyer, first.id); await acceptResourceJob(pool, buyer, first.id);
  const buyerAfter = await resourceAccounting(pool, buyer), sellerAfter = await resourceAccounting(pool, seller);
  assert.equal(buyerAfter.reservedUsdMicros, buyerBefore.reservedUsdMicros - 100000);
  assert.equal(sellerAfter.availableUsdMicros, sellerBefore.availableUsdMicros + 100000);
  assert.equal(buyerAfter.availableUsdMicros + buyerAfter.reservedUsdMicros + sellerAfter.availableUsdMicros,
    buyerBefore.availableUsdMicros + buyerBefore.reservedUsdMicros + sellerBefore.availableUsdMicros);
  assert.equal(sellerAfter.customerRevenueUsdMicros, 100000);
  assert.equal(buyerAfter.ledgerDriftUsdMicros + sellerAfter.ledgerDriftUsdMicros, 0);

  const disputed = await create('disputed'); await claimResourceJob(pool, seller, disputed.id);
  await workResourceJob(pool, seller, disputed.id, computeTerms, { compute: fakeCompute });
  await disputeResourceJob(pool, buyer, disputed.id);
  assert.equal((await expireResourceJob(pool, disputed.id)).job.state, 'disputed');
  await assert.rejects(acceptResourceJob(pool, buyer, disputed.id), error('state'));
  const refund = { refund: true, reason: 'Verified report did not satisfy the agreed question.' };
  assert.equal((await adjudicateResourceJob(pool, disputed.id, refund)).job.state, 'refunded');
  await adjudicateResourceJob(pool, disputed.id, refund);
  await assert.rejects(adjudicateResourceJob(pool, disputed.id, { refund: false, reason: 'Different resolution' }), error('replay'));

  const timeout = await create('timeout');
  await pool.query('UPDATE resource_jobs SET expires_at=$2 WHERE id=$1', [timeout.id, new Date(Date.now() - 1000)]);
  assert.equal((await expireResourceJob(pool, timeout.id)).job.state, 'refunded');
  await expireResourceJob(pool, timeout.id);
  const pending = await create('pending'); await claimResourceJob(pool, seller, pending.id);
  const pendingOptions = { compute: async (_pool, account, request) => seedCall(account, request, 'unknown') };
  assert.equal((await workResourceJob(pool, seller, pending.id, computeTerms, pendingOptions)).pending, true);
  await pool.query('UPDATE resource_jobs SET expires_at=$2 WHERE id=$1', [pending.id, new Date(Date.now() - 1000)]);
  assert.equal((await expireResourceJob(pool, pending.id)).pending, true, 'Unknown provider outcome never releases escrow');
  await pool.query("UPDATE resource_calls SET status='succeeded' WHERE account_id=$1 AND request_key=$2", [seller, `work_${pending.id.replaceAll('-', '')}`]);
  const retry = { compute: async (_pool, account, request) => ({ call: (await pool.query('SELECT id,status FROM resource_calls WHERE account_id=$1 AND request_key=$2', [account, request.requestId])).rows[0] }) };
  assert.equal((await workResourceJob(pool, seller, pending.id, computeTerms, retry)).job.state, 'submitted', 'A recovered successful receipt can finish an expired job');
  await pool.query('UPDATE resource_jobs SET accept_after=$2 WHERE id=$1', [pending.id, new Date(Date.now() - 1000)]);
  await assert.rejects(disputeResourceJob(pool, buyer, pending.id), error('state'));
  assert.equal((await expireResourceJob(pool, pending.id)).job.state, 'accepted');

  const forged = await create('forged'); await claimResourceJob(pool, seller, forged.id);
  await assert.rejects(workResourceJob(pool, seller, forged.id, computeTerms, { compute: async (_pool, account, request) =>
    seedCall(account, request, 'succeeded', { kind: 'paid_market_analysis', jobId: 'someone-else' }) }), error('report'));
  assert.equal((await resourceAccounting(pool, buyer)).ledgerDriftUsdMicros, 0);
  assert.equal((await resourceAccounting(pool, seller)).ledgerDriftUsdMicros, 0);
  const raced = await create('expiry-before-compute'); await claimResourceJob(pool, seller, raced.id);
  await assert.rejects(workResourceJob(pool, seller, raced.id, computeTerms, { compute: async (_pool, account, request, options) => {
    await pool.query('UPDATE resource_jobs SET expires_at=$2 WHERE id=$1', [raced.id, new Date(Date.now() - 1000)]);
    await expireResourceJob(pool, raced.id);
    return fakeCompute(_pool, account, request, options);
  } }), error('state'));
  assert.equal((await pool.query('SELECT state FROM resource_jobs WHERE id=$1', [raced.id])).rows[0].state, 'refunded');
  assert.equal((await pool.query('SELECT id FROM resource_calls WHERE account_id=$1 AND request_key=$2', [seller, `work_${raced.id.replaceAll('-', '')}`])).rows.length, 0);
  const frozen = await create('frozen-escrow'); await claimResourceJob(pool, seller, frozen.id);
  await workResourceJob(pool, seller, frozen.id, computeTerms, { compute: fakeCompute });
  await pool.query('UPDATE resource_treasuries SET frozen=true WHERE account_id=$1', [buyer]);
  const sellerFrozenBefore = (await resourceAccounting(pool, seller)).availableUsdMicros;
  await assert.rejects(acceptResourceJob(pool, buyer, frozen.id), error('frozen'));
  await pool.query('UPDATE resource_jobs SET accept_after=$2 WHERE id=$1', [frozen.id, new Date(Date.now() - 1000)]);
  await assert.rejects(expireResourceJob(pool, frozen.id), error('frozen'));
  assert.equal((await resourceAccounting(pool, seller)).availableUsdMicros, sellerFrozenBefore);
  await pool.query('UPDATE resource_jobs SET accept_after=$2 WHERE id=$1', [frozen.id, new Date(Date.now() + 100000)]);
  await disputeResourceJob(pool, buyer, frozen.id);
  await assert.rejects(adjudicateResourceJob(pool, frozen.id, { refund: false, reason: 'Payout while frozen is forbidden.' }), error('frozen'));
  assert.equal((await adjudicateResourceJob(pool, frozen.id, { refund: true, reason: 'Return disputed escrow to frozen customer.' })).job.state, 'refunded');
  assert.equal((await pool.query('SELECT frozen FROM resource_treasuries WHERE account_id=$1', [buyer])).rows[0].frozen, true);
  await pool.query('UPDATE resource_treasuries SET frozen=false WHERE account_id=$1', [buyer]);
  if (process.argv.includes('--postgres')) {
    const concurrent = await create('concurrent-accept'); await claimResourceJob(pool, seller, concurrent.id);
    await workResourceJob(pool, seller, concurrent.id, computeTerms, { compute: fakeCompute });
    const beforeConcurrent = (await resourceAccounting(pool, seller)).availableUsdMicros;
    await Promise.all([acceptResourceJob(pool, buyer, concurrent.id), acceptResourceJob(pool, buyer, concurrent.id)]);
    assert.equal((await resourceAccounting(pool, seller)).availableUsdMicros, beforeConcurrent + 100000);
    const postings = (await pool.query('SELECT id FROM resource_ledger WHERE event_key=$1 OR event_key=$2',
      [`job_payment:${concurrent.id}`, `job_revenue:${concurrent.id}`])).rows;
    assert.equal(postings.length, 2, 'Concurrent accepts post exactly one balanced transfer');
  }
  const app = Fastify();
  const auth = async (req, reply) => {
    if (!req.headers['test-account']) return reply.code(401).send({ error: 'test_auth' });
    req.user = { sub: req.headers['test-account'], agent: req.headers['test-agent'] === 'true' };
  };
  const modAuth = async (_req, reply) => reply.code(401).send({ error: 'mod_auth' });
  app.setErrorHandler((failure, _req, reply) => reply.code(failure.code?.startsWith('resource_') ? 400 : failure.statusCode || 500).send({ error: failure.code }));
  registerResources(app, { pool, auth, modAuth });
  try {
    assert.equal((await app.inject({ method: 'GET', url: '/v1/resources' })).statusCode, 401);
    assert.equal((await app.inject({ method: 'GET', url: '/v1/resources/jobs', headers: { 'test-account': outsider } })).json().jobs.length, 0);
    for (const url of ['/v1/resources/policy', '/v1/resources/funding', '/v1/resources/service']) {
      const denied = await app.inject({ method: 'POST', url, headers: { 'test-account': seller, 'test-agent': 'true' }, payload: {} });
      assert.equal(denied.statusCode, 400); assert.equal(denied.json().error, 'resource_owner_authority');
    }
    const forgedPurpose = await app.inject({ method: 'POST', url: '/v1/resources/compute', headers: { 'test-account': seller }, payload: { purpose: { kind: 'paid_market_analysis' } } });
    assert.equal(forgedPurpose.json().error, 'resource_purpose');
    assert.equal((await app.inject({ method: 'POST', url: '/v1/mod/resources/jobs/none/adjudicate', payload: {} })).statusCode, 401);
    process.env.RESOURCE_STRIPE_WEBHOOK_SECRET = 'test-only-webhook-resourcework';
    const webhook = await app.inject({ method: 'POST', url: '/v1/resources/payments/webhook', headers: { 'content-type': 'application/json', 'stripe-signature': 'invalid' }, payload: '{"id":"evt_bad"}' });
    assert.equal(webhook.statusCode, 400); assert.equal(webhook.json().error, 'resource_invalid_webhook');
    const signedRaw = Buffer.from('{ "id": "evt_resourcework", "type": "test.ignored", "livemode": false, "data": {"object": {}} }\n');
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = `t=${timestamp},v1=${crypto.createHmac('sha256', process.env.RESOURCE_STRIPE_WEBHOOK_SECRET).update(`${timestamp}.`).update(signedRaw).digest('hex')}`;
    const validWebhook = await app.inject({ method: 'POST', url: '/v1/resources/payments/webhook', headers: { 'content-type': 'application/json', 'stripe-signature': signature }, payload: signedRaw });
    assert.equal(validWebhook.statusCode, 200); assert.equal(validWebhook.json().ignored, true, 'Signed whitespace-sensitive raw bytes survive the child parser');
    assert.equal((await app.inject({ method: 'POST', url: '/v1/resources/payments/webhook', headers: { 'content-type': 'application/json' }, payload: 'x'.repeat(65537) })).statusCode, 413);
    // An ordinary object endpoint remains parsed as JSON after child-parser registration.
    const ordinary = await app.inject({ method: 'POST', url: '/v1/resources/service', headers: { 'test-account': seller }, payload: { ...service, expectedRevision: 1, enabled: false } });
    assert.equal(ordinary.statusCode, 200); assert.equal(ordinary.json().service.enabled, false);
    const catalog = await app.inject({ method: 'GET', url: '/v1/resources/catalog' }); assert.equal(catalog.statusCode, 200);
  } finally { delete process.env.RESOURCE_STRIPE_WEBHOOK_SECRET; await app.close(); }
  console.log('resourcework: owner service authority, escrow conservation, private jobs, receipt proofs, disputes and expiry checks passed');
} finally { await database.cleanup(pool); }
