process.env.RESOURCE_ECONOMY = 'on';
process.env.RESOURCE_PAYMENTS_MODE = 'test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import Fastify from 'fastify';
import { register as registerResources } from '../src/routes/resources.js';
import { commandDatabase, addPlayer } from './lib/player-command-support.js';
import { resourceTransaction, lockResourceTreasury, moveResourceMoney, setResourcePolicy, resourceAccounting } from '../src/resourcebook.js';
import { setResourceService, resourceServiceBoard, createResourceJob, claimResourceJob, workResourceJob,
  acceptResourceJob, disputeResourceJob, adjudicateResourceJob, expireResourceJob, listResourceJobs, resourceJobView, submitResourceJob } from '../src/resourcework.js';
import { renewResourceJob } from '../src/resourcelabor.js';

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
  assert.equal(first.fulfillment, 'compute', 'Legacy orders still require compute receipts');
  await assert.rejects(submitResourceJob(pool, seller, first.id, { text: 'Unapproved authored fulfillment' }), error('fulfillment'));
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
  await setResourceService(pool, outsider, service);
  const authoredTerms = { sellerAccountId: outsider, expectedServiceRevision: 1, question: 'Provide a customer-approved authored analysis.', fulfillment: 'authored' };
  const authored = (await createResourceJob(pool, buyer, { ...authoredTerms, requestId: 'authored-first' })).job;
  assert.equal(authored.fulfillment, 'authored');
  await assert.rejects(createResourceJob(pool, buyer, { ...authoredTerms, requestId: 'authored-first', fulfillment: 'compute' }), error('replay'));
  await assert.rejects(createResourceJob(pool, buyer, { ...authoredTerms, requestId: 'invalid-mode', fulfillment: null }), error('terms'));
  await assert.rejects(submitResourceJob(pool, outsider, authored.id, { text: 'Not claimed' }), error('state'));
  await claimResourceJob(pool, outsider, authored.id);
  await assert.rejects(workResourceJob(pool, outsider, authored.id, computeTerms, { compute: () => { throw new Error('Must never dispatch'); } }), error('fulfillment'));
  await assert.rejects(submitResourceJob(pool, seller, authored.id, { text: 'Wrong seller' }), error('job'));
  for (const invalid of [{ text: ' ' }, { text: 'é'.repeat(32769) }, { text: 'Report', costUsdMicros: 0 }, { text: 'Report', providerId: 'fake' }, {}, []])
    await assert.rejects(submitResourceJob(pool, outsider, authored.id, invalid), error('terms'));
  const callsBeforeAuthored = Number((await pool.query('SELECT COUNT(*) AS count FROM resource_calls')).rows[0].count);
  const authoredReport = { text: 'Account-authored market analysis. Game cash is separate from external USD.' };
  const submittedAuthored = (await submitResourceJob(pool, outsider, authored.id, authoredReport)).job;
  assert.equal(submittedAuthored.report.source, 'account_authored'); assert.equal(submittedAuthored.report.costUsdMicros, null);
  assert.equal(submittedAuthored.callId, null); assert.match(submittedAuthored.report.sourceHash, /^[a-f0-9]{64}$/);
  assert.deepEqual((await submitResourceJob(pool, outsider, authored.id, authoredReport)).job.report, submittedAuthored.report);
  await assert.rejects(submitResourceJob(pool, outsider, authored.id, { text: 'Changed report' }), error('replay'));
  const revenueBeforeAuthored = (await resourceAccounting(pool, outsider)).availableUsdMicros;
  await acceptResourceJob(pool, buyer, authored.id);
  assert.equal((await resourceAccounting(pool, outsider)).availableUsdMicros, revenueBeforeAuthored + 100000);
  assert.equal((await submitResourceJob(pool, outsider, authored.id, authoredReport)).job.state, 'accepted');
  const renewedAuthored = (await renewResourceJob(pool, buyer, authored.id, { requestId: 'authored-renew', expectedServiceRevision: 1 })).job;
  assert.equal(renewedAuthored.fulfillment, 'authored', 'Explicit buyer renewal preserves fulfillment consent');
  await claimResourceJob(pool, outsider, renewedAuthored.id);
  await submitResourceJob(pool, outsider, renewedAuthored.id, authoredReport);
  await disputeResourceJob(pool, buyer, renewedAuthored.id);
  await adjudicateResourceJob(pool, renewedAuthored.id, { refund: true, reason: 'Return disputed authored deliverable escrow.' });
  const expiredAuthored = (await createResourceJob(pool, buyer, { ...authoredTerms, requestId: 'authored-expired' })).job;
  await claimResourceJob(pool, outsider, expiredAuthored.id);
  await pool.query('UPDATE resource_jobs SET expires_at=$2 WHERE id=$1', [expiredAuthored.id, new Date(Date.now() - 1000)]);
  await assert.rejects(submitResourceJob(pool, outsider, expiredAuthored.id, authoredReport), error('state'));
  await expireResourceJob(pool, expiredAuthored.id);
  const automaticAuthored = (await createResourceJob(pool, buyer, { ...authoredTerms, requestId: 'authored-automatic' })).job;
  await claimResourceJob(pool, outsider, automaticAuthored.id);
  await submitResourceJob(pool, outsider, automaticAuthored.id, { text: 'é'.repeat(32768) });
  await pool.query('UPDATE resource_jobs SET accept_after=$2 WHERE id=$1', [automaticAuthored.id, new Date(Date.now() - 1000)]);
  assert.equal((await expireResourceJob(pool, automaticAuthored.id)).job.state, 'accepted', 'Existing undisputed acceptance deadline settles authored escrow');
  assert.equal(Number((await pool.query('SELECT COUNT(*) AS count FROM resource_calls')).rows[0].count), callsBeforeAuthored);
  assert.equal((await resourceAccounting(pool, buyer)).liabilityDriftUsdMicros, 0);
  assert.equal((await resourceAccounting(pool, outsider)).ledgerDriftUsdMicros, 0);
  if (process.argv.includes('--postgres')) {
    const concurrentAuthored = (await createResourceJob(pool, buyer, { ...authoredTerms, requestId: 'authored-concurrent' })).job;
    await claimResourceJob(pool, outsider, concurrentAuthored.id);
    const duplicate = await Promise.all([submitResourceJob(pool, outsider, concurrentAuthored.id, authoredReport), submitResourceJob(pool, outsider, concurrentAuthored.id, authoredReport)]);
    assert.deepEqual(duplicate[0].job.report, duplicate[1].job.report);
    const beforeAccepted = (await resourceAccounting(pool, outsider)).availableUsdMicros;
    await Promise.all([submitResourceJob(pool, outsider, concurrentAuthored.id, authoredReport), acceptResourceJob(pool, buyer, concurrentAuthored.id)]);
    assert.equal((await resourceAccounting(pool, outsider)).availableUsdMicros, beforeAccepted + 100000);
  }
  await setResourceService(pool, outsider, { ...service, expectedRevision: 1, enabled: false });
  await addPlayer(pool, 'resource-uninvolved');
  const app = Fastify();
  const auth = async (req, reply) => {
    if (!req.headers['test-account']) return reply.code(401).send({ error: 'test_auth' });
    req.user = { sub: req.headers['test-account'], agent: req.headers['test-agent'] === 'true' };
  };
  const modAuth = async (_req, reply) => reply.code(401).send({ error: 'mod_auth' });
  app.setErrorHandler((failure, _req, reply) => reply.code(failure.code?.startsWith('resource_') ? 400 : failure.statusCode || 500).send({ error: failure.code }));
  registerResources(app, { pool, auth, modAuth });
  try {
    const submitUrl = `/v1/resources/jobs/${authored.id}/submit`;
    assert.equal((await app.inject({ method: 'POST', url: submitUrl, payload: authoredReport })).statusCode, 401);
    assert.equal((await app.inject({ method: 'POST', url: submitUrl, headers: { 'test-account': buyer }, payload: authoredReport })).json().error, 'resource_job');
    assert.equal((await app.inject({ method: 'POST', url: submitUrl, headers: { 'test-account': outsider }, payload: { ...authoredReport, costUsdMicros: 0 } })).json().error, 'resource_terms');
    for (const agent of ['false', 'true']) {
      const replay = await app.inject({ method: 'POST', url: submitUrl, headers: { 'test-account': outsider, 'test-agent': agent }, payload: authoredReport });
      assert.equal(replay.statusCode, 200);
      assert.equal(replay.json().job.state, 'accepted', 'Human and agent credentials share authored submission permissions');
    }
    assert.equal((await app.inject({ method: 'GET', url: '/v1/resources' })).statusCode, 401);
    assert.equal((await app.inject({ method: 'GET', url: '/v1/resources/jobs', headers: { 'test-account': 'resource-uninvolved' } })).json().jobs.length, 0);
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
  for (let index = 0; index < 105; index++) {
    const account = `discovery-${String(index).padStart(3, '0')}`;
    await addPlayer(pool, account);
    await resourceTransaction(pool, client => lockResourceTreasury(client, account));
    await pool.query('INSERT INTO resource_services(account_id,revision,enabled,price_usd_micros) VALUES($1,1,true,100000)', [account]);
    if (index < 3) for (let active = 0; active < 3; active++) {
      await pool.query('INSERT INTO resource_jobs(id,buyer_account,seller_account,request_key,service_revision,price_usd_micros,input,state,expires_at) VALUES($1,$2,$3,$4,1,100000,$5,$6,$7)',
        [`discovery-job-${index}-${active}`, buyer, account, `discovery-request-${index}-${active}`, { question: 'PRIVATE_DISCOVERY_QUESTION' }, ['open','claimed','disputed'][active], new Date(Date.now() + 3600000)]);
    }
  }
  const firstPage = await resourceServiceBoard(pool);
  assert.equal(firstPage.services.length, 100); assert.equal(firstPage.pagination.hasMore, true);
  assert.equal(firstPage.pagination.nextAfterAccountId, 'discovery-099');
  const lastPage = await resourceServiceBoard(pool, { afterAccountId: firstPage.pagination.nextAfterAccountId });
  assert.equal(lastPage.services.length, 5); assert.equal(lastPage.pagination.hasMore, false);
  assert.equal(lastPage.pagination.nextAfterAccountId, null);
  assert.equal(firstPage.services[0].capacity.remainingCapacity, 0);
  const available = await resourceServiceBoard(pool, { limit: '2', availableOnly: 'true' });
  assert.deepEqual(available.services.map(row => row.sellerAccountId), ['discovery-003','discovery-004']);
  await pool.query("UPDATE resource_jobs SET state='submitted' WHERE id='discovery-job-0-2'");
  assert.equal((await resourceServiceBoard(pool, { limit: 1, availableOnly: true })).services[0].sellerAccountId, 'discovery-003');
  await pool.query("UPDATE resource_jobs SET state='accepted' WHERE id='discovery-job-0-2'");
  assert.equal((await resourceServiceBoard(pool, { limit: 1, availableOnly: true })).services[0].sellerAccountId, 'discovery-000');
  await pool.query("UPDATE resource_jobs SET state='refunded' WHERE id='discovery-job-1-2'");
  assert.equal((await resourceServiceBoard(pool, { afterAccountId: 'discovery-000', limit: 1, availableOnly: true })).services[0].sellerAccountId, 'discovery-001');
  await pool.query("UPDATE resource_services SET enabled=false WHERE account_id='discovery-104'");
  assert.equal((await resourceServiceBoard(pool, { afterAccountId: 'discovery-103' })).services.length, 0);
  for (const filters of [{ limit: null }, { limit: 0 }, { limit: 101 }, { limit: '1e2' }, { limit: '2x' }, { limit: '01' }, { limit: '' }, { availableOnly: 'yes' }, { availableOnly: 1 }, { afterAccountId: '' }, { afterAccountId: 'x'.repeat(129) }, { afterAccountId: [] }, { unknown: true }])
    await assert.rejects(resourceServiceBoard(pool, filters), error('terms'));
  const discoveryQueries = [];
  const projection = await resourceServiceBoard({ query: async (sql, values) => { discoveryQueries.push(sql); return pool.query(sql, values); } }, { limit: 2 });
  assert.equal(discoveryQueries.length, 1); assert(/^SELECT/.test(discoveryQueries[0]));
  assert(!/\b(input|report|output|buyer_account|resource_treasuries|resource_calls)\b/i.test(discoveryQueries[0]));
  assert(!JSON.stringify(projection).includes('PRIVATE_DISCOVERY_QUESTION'));
  const discoveryApp = Fastify();
  registerResources(discoveryApp, { pool, auth: async () => {}, modAuth: async () => {} });
  try {
    const response = await discoveryApp.inject('/v1/resources/services?limit=2&availableOnly=true&afterAccountId=discovery-001');
    assert.equal(response.statusCode, 200); assert.equal(response.json().services[0].sellerAccountId, 'discovery-003');
  } finally { await discoveryApp.close(); }
  console.log('resourcework: owner service authority, escrow conservation, private jobs, receipt proofs, disputes, expiry and capacity-filtered keyset discovery checks passed');
} finally { await database.cleanup(pool); }
