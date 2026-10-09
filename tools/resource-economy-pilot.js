import { businessSnapshot } from '../src/resourcebusiness.js';
import { evaluateBusiness, compareBusiness } from '../src/businesspolicy.js';
import { createResourceBounty, bidResourceBounty, awardResourceBounty } from '../src/resourcelabor.js';
// Isolated, deterministic settlement exercise. No real payments or inference.
process.env.RESOURCE_ECONOMY = 'on';
process.env.RESOURCE_COMPUTE_ENABLED = 'on';
process.env.RESOURCE_PAYMENTS_MODE = 'test';
process.env.RESOURCE_STRIPE_WEBHOOK_SECRET = 'isolated-pilot-only-not-a-live-secret';
process.env.PUBLIC_URL = 'https://www.omerta.fun';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { commandDatabase, addPlayer } from '../test/lib/player-command-support.js';
import * as Providers from '../src/resourceproviders.js';
import { setResourcePolicy, resourceAccounting } from '../src/resourcebook.js';
import { createResourceFunding, settleResourcePayment } from '../src/resourcepayments.js';
import { setResourceService, claimResourceJob, workResourceJob, acceptResourceJob } from '../src/resourcework.js';

const database = await commandDatabase('resourcepilot'); const pool = database.pool;
const entry = { id: 'pilot-compute', provider: 'openai', model: 'deterministic-test-model', storeResponses: false,
  inputUsdMicrosPerMillion: 100000, outputUsdMicrosPerMillion: 200000, maxInputTokens: 16000, maxOutputTokens: 500 };
process.env.RESOURCE_COMPUTE_CATALOG = JSON.stringify([entry]);
let calls = 0;
const adapter = {
  providerCatalog: () => [entry], quoteCompute: Providers.quoteCompute,
  executeCompute: async (_entry, request) => {
    calls++; assert(request.prompt.includes('Public market snapshot')); assert.equal(request.maxOutputTokens, 500);
    return { providerRequestId: `resp_${request.requestId.replaceAll('-', '')}`, output: 'The public board currently shows no offers. No external price or profitability conclusion can be inferred.',
      inputTokens: 200, outputTokens: 100, costUsdMicros: Providers.quoteCompute(entry, { inputTokens: 200, maxOutputTokens: 100 }) };
  },
  createPaymentSession: async ({ id, amountUsdMicros }) => ({ sessionId: `cs_test_${id.replaceAll('-', '')}`,
    url: `https://checkout.stripe.com/c/pay/${id}`, amountUsdMicros }),
  verifyPaymentWebhook: Providers.verifyPaymentWebhook
};
async function fund(account, amount) {
  const { payment } = await createResourceFunding(pool, account, { requestId: `capital_${account}`, amountUsdMicros: amount }, { adapter });
  const event = { id: `evt_${payment.id.replaceAll('-', '')}`, type: 'checkout.session.completed', livemode: false,
    data: { object: { id: `cs_test_${payment.id.replaceAll('-', '')}`, payment_intent: `pi_test_${payment.id.replaceAll('-', '')}`,
      client_reference_id: payment.id, metadata: { resourcePaymentId: payment.id }, amount_total: amount / 10000,
      currency: 'usd', payment_status: 'paid', livemode: false } } };
  const raw = Buffer.from(JSON.stringify(event)), timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmacSignature(raw, timestamp);
  await settleResourcePayment(pool, raw, signature, { adapter });
  await settleResourcePayment(pool, raw, signature, { adapter }); // duplicate delivers zero new money
}
function createHmacSignature(raw, timestamp) {
  return `t=${timestamp},v1=${crypto.createHmac('sha256', process.env.RESOURCE_STRIPE_WEBHOOK_SECRET).update(`${timestamp}.`).update(raw).digest('hex')}`;
}
try {
  const buyers = ['pilot-buyer-a', 'pilot-buyer-b'], sellers = ['pilot-seller-a', 'pilot-seller-b'];
  for (const account of [...buyers, ...sellers]) {
    await addPlayer(pool, account);
    await fund(account, buyers.includes(account) ? 2000000 : 100000);
    await setResourcePolicy(pool, account, { expectedRevision: 0, enabled: true,
      providers: buyers.includes(account) ? ['service:market-analysis'] : [entry.id], allowStoredResponses: false,
      maxPerCallUsdMicros: 100000, maxPerDayUsdMicros: 1000000, minimumReserveUsdMicros: 10000, expiresInSeconds: 3600 });
  }
  for (const seller of sellers) await setResourceService(pool, seller, { enabled: true, kind: 'market_analysis', expectedRevision: 0, priceUsdMicros: 100000 });
  let jobs = 0; const shadowComparisons = [];
  for (let round = 0; round < 3; round++) for (let i = 0; i < buyers.length; i++) {
    const buyer = buyers[i], seller = sellers[(i + round) % sellers.length];
    const { bounty } = await createResourceBounty(pool, buyer, { requestId: `job_${round}_${i}`, budgetUsdMicros: 100000, expiresInSeconds: 3600, question: 'Summarize the available public market listings and uncertainty.' });
    const beforeShadow = evaluateBusiness(await businessSnapshot(pool, seller), { providerId: entry.id, maxOutputTokens: 500 });
    const { bid } = await bidResourceBounty(pool, seller, bounty.id, { priceUsdMicros: 100000, deliverySeconds: 3600, expectedServiceRevision: 1 });
    const created = await awardResourceBounty(pool, buyer, bounty.id, { bidId: bid.id });
    await claimResourceJob(pool, seller, created.job.id);
    const report = await workResourceJob(pool, seller, created.job.id, { providerId: entry.id, maxOutputTokens: 500 }, { adapter });
    assert.equal(report.job.state, 'submitted');
    await acceptResourceJob(pool, buyer, created.job.id); await acceptResourceJob(pool, buyer, created.job.id);
    const afterShadow = await businessSnapshot(pool, seller);
    const comparison = compareBusiness(beforeShadow, afterShadow);
    assert.equal(comparison.observedDelta.settledCustomerRevenueUsdMicros, 100000);
    assert(comparison.observedDelta.settledPaidComputeCostsUsdMicros > 0);
    assert.equal(comparison.causalEffect, null);
    assert(comparison.outcomes.some(outcome=>outcome.bountyId===bounty.id && outcome.observedState==='accepted'));
    shadowComparisons.push(comparison);
    jobs++;
  }
  const accounts = await Promise.all([...buyers, ...sellers].map(async account => ({ account, ...await resourceAccounting(pool, account) })));
  const initial = 4200000, cost = accounts.reduce((n, account) => n + account.operatingCostsUsdMicros, 0)
    - buyers.length * 3 * 100000; // purchases transfer between participants; only provider spend exits
  const remaining = accounts.reduce((n, account) => n + account.availableUsdMicros + account.reservedUsdMicros, 0);
  assert.equal(remaining, initial - cost);
  assert.equal(accounts.reduce((n, account) => n + account.ledgerDriftUsdMicros, 0), 0);
  assert.equal(accounts.reduce((n, account) => n + account.liabilityDriftUsdMicros, 0), 0);
  assert.equal(accounts.reduce((n, account) => n + account.reservedUsdMicros, 0), 0);
  assert.equal(calls, jobs);
  console.log(JSON.stringify({ mode: 'test', deterministicProviders: true, syntheticCustomerDemand: true,
    realExternalRevenueUsdMicros: 0, profitabilityProven: false, shadowFinancialRequests: 0, shadowComparisons, bountiesAwarded: jobs, jobsAccepted: jobs, providerCalls: calls,
    testCapitalUsdMicros: initial, simulatedProviderCostsUsdMicros: cost, remainingTestFundsUsdMicros: remaining,
    conservationDriftUsdMicros: 0, accounts }, null, 2));
} finally { await database.cleanup(pool); }
