import { resourceTransaction, resourceError } from './resourcebook.js';
import { providerCatalog } from './resourceproviders.js';

const time = value => value ? new Date(value).toISOString() : null;
const number = value => { const result = Number(value || 0); if (!Number.isSafeInteger(result) || result < 0) throw resourceError('metrics', 'Business metrics exceed exact integer bounds.'); return result; };
export async function businessSnapshot(pool, account) {
  return resourceTransaction(pool, async client => {
    // Existing treasury lock serializes resource writes without creating an unfunded treasury.
    const treasury = (await client.query('SELECT available_usd_micros,reserved_usd_micros,frozen,mode FROM resource_treasuries WHERE account_id=$1 FOR UPDATE', [account])).rows[0];
    const asOf = new Date();
    const policy = (await client.query('SELECT enabled,revision,providers,max_per_call,max_per_day,minimum_reserve,allow_stored_responses,expires_at FROM resource_compute_policies WHERE account_id=$1', [account])).rows[0];
    const service = (await client.query('SELECT enabled,revision,price_usd_micros FROM resource_services WHERE account_id=$1', [account])).rows[0];
    const states = (await client.query('SELECT state,COUNT(*) AS count FROM resource_jobs WHERE seller_account=$1 GROUP BY state', [account])).rows;
    const jobs = (await client.query('SELECT j.id,j.buyer_account,j.state,j.price_usd_micros,j.created_at,j.expires_at,j.submitted_at,b.id AS bounty_id FROM resource_jobs j LEFT JOIN resource_bounties b ON b.job_id=j.id WHERE j.seller_account=$1 ORDER BY j.created_at DESC,j.id LIMIT 100', [account])).rows;
    const callTotals = (await client.query("SELECT status,simulated,COUNT(*) AS count,SUM(cost_usd_micros) AS cost,SUM(cap_usd_micros) AS cap FROM resource_calls WHERE account_id=$1 AND purpose->>'kind'='paid_market_analysis' GROUP BY status,simulated", [account])).rows;
    const calls = (await client.query("SELECT id,provider_id,purpose->>'jobId' AS job_id,status,cost_usd_micros,simulated,created_at FROM resource_calls WHERE account_id=$1 AND purpose->>'kind'='paid_market_analysis' ORDER BY created_at DESC,id LIMIT 100", [account])).rows;
    const totalRevenue = (await client.query("SELECT SUM(available_delta) AS revenue FROM resource_ledger WHERE account_id=$1 AND kind='customer_revenue'", [account])).rows[0];
    const customers = (await client.query("SELECT buyer_account,COUNT(*) AS count FROM resource_jobs WHERE seller_account=$1 AND state='accepted' GROUP BY buyer_account ORDER BY count DESC,buyer_account LIMIT 101", [account])).rows;
    const providers = (await client.query("SELECT provider_id,status,COUNT(*) AS count,SUM(cost_usd_micros) AS cost FROM resource_calls WHERE account_id=$1 AND purpose->>'kind'='paid_market_analysis' GROUP BY provider_id,status ORDER BY provider_id,status LIMIT 166", [account])).rows;
    const bounties = (await client.query("SELECT id,buyer_account,budget_usd_micros,expires_at FROM resource_bounties WHERE state='open' AND expires_at > $1 ORDER BY created_at,id LIMIT 101", [asOf])).rows;
    const day = new Date(asOf); day.setUTCHours(0, 0, 0, 0);
    const daily = (await client.query('SELECT SUM(authorized_usd_micros) AS amount FROM resource_ledger WHERE account_id=$1 AND created_at >= $2', [account, day])).rows[0];
    const jobViews = [];
    for (const job of jobs) {
      const revenue = (await client.query("SELECT SUM(available_delta) AS revenue FROM resource_ledger WHERE account_id=$1 AND kind='customer_revenue' AND event_key=$2", [account, `job_revenue:${job.id}`])).rows[0];
      const costs = (await client.query("SELECT status,COUNT(*) AS count,SUM(cost_usd_micros) AS cost,SUM(cap_usd_micros) AS cap FROM resource_calls WHERE account_id=$1 AND purpose->>'kind'='paid_market_analysis' AND purpose->>'jobId'=$2 GROUP BY status", [account, job.id])).rows;
      jobViews.push({ id: job.id, originBountyId: job.bounty_id || null, buyerAccountId: job.buyer_account, state: job.state, priceUsdMicros: number(job.price_usd_micros),
        createdAt: time(job.created_at), expiresAt: time(job.expires_at), submittedAt: time(job.submitted_at),
        settledRevenueUsdMicros: number(revenue?.revenue), settledComputeCostsUsdMicros: costs.filter(row => row.status === 'succeeded').reduce((sum, row) => sum + number(row.cost), 0),
        heldComputeUsdMicros: costs.filter(row => ['reserved','sending','unknown'].includes(row.status)).reduce((sum, row) => sum + number(row.cap), 0),
        unresolvedCalls: costs.filter(row => ['reserved','sending','unknown'].includes(row.status)).reduce((sum, row) => sum + number(row.count), 0) });
    }
    const jobsTotal = states.reduce((sum, row) => sum + number(row.count), 0);
    const callsTotal = callTotals.reduce((sum, row) => sum + number(row.count), 0);
    const activeJobs = states.filter(row => ['open','claimed','submitted','disputed'].includes(row.state)).reduce((sum, row) => sum + number(row.count), 0);
    const unresolvedPaidCalls = callTotals.filter(row => ['reserved','sending','unknown'].includes(row.status)).reduce((sum, row) => sum + number(row.count), 0);
    const providerViews = new Map();
    for (const row of providers) {
      if (!providerViews.has(row.provider_id)) providerViews.set(row.provider_id, { providerId: row.provider_id, settledCallCount: 0, failedCallCount: 0, unknownCallCount: 0, costUsdMicros: 0, causalEffect: null });
      const view = providerViews.get(row.provider_id);
      if (row.status === 'succeeded') { view.settledCallCount += number(row.count); view.costUsdMicros += number(row.cost); }
      if (row.status === 'failed') view.failedCallCount += number(row.count);
      if (['reserved','sending','unknown'].includes(row.status)) view.unknownCallCount += number(row.count);
    }
    const outcomes = (await client.query('SELECT c.provider_id,j.state,COUNT(*) AS count FROM resource_jobs j JOIN resource_calls c ON j.call_id=c.id WHERE j.seller_account=$1 AND c.account_id=$1 GROUP BY c.provider_id,j.state ORDER BY c.provider_id,j.state LIMIT 199', [account])).rows;
    const onTime = (await client.query('SELECT c.provider_id,COUNT(*) AS count FROM resource_jobs j JOIN resource_calls c ON j.call_id=c.id WHERE j.seller_account=$1 AND c.account_id=$1 AND j.submitted_at <= j.expires_at GROUP BY c.provider_id ORDER BY c.provider_id LIMIT 33', [account])).rows;
    for (const view of providerViews.values()) {
      view.acceptedJobs = outcomes.filter(row => row.provider_id === view.providerId && row.state === 'accepted').reduce((sum, row) => sum + number(row.count), 0);
      view.disputedJobs = outcomes.filter(row => row.provider_id === view.providerId && row.state === 'disputed').reduce((sum, row) => sum + number(row.count), 0);
      view.onTimeJobs = number(onTime.find(row => row.provider_id === view.providerId)?.count);
    }
    return { version: 1, asOf: asOf.toISOString(), accountId: account, mode: 'shadow', resourceMode: treasury?.mode || null,
      treasury: treasury ? { availableUsdMicros: number(treasury.available_usd_micros), reservedUsdMicros: number(treasury.reserved_usd_micros), frozen: treasury.frozen } : null,
      policy: policy ? { enabled: policy.enabled, allowStoredResponses: policy.allow_stored_responses, revision: number(policy.revision), providers: policy.providers,
        dailyAuthorizedUsdMicros: number(daily?.amount), maxPerCallUsdMicros: number(policy.max_per_call), maxPerDayUsdMicros: number(policy.max_per_day), minimumReserveUsdMicros: number(policy.minimum_reserve), expiresAt: time(policy.expires_at) } : null,
      service: service ? { enabled: service.enabled, revision: number(service.revision), priceUsdMicros: number(service.price_usd_micros) } : null,
      capacity: { activeJobs, remainingCapacity: Math.max(0, 3 - activeJobs) },
      totals: { jobsByState: Object.fromEntries(states.map(row => [row.state, number(row.count)])),
        settledCustomerRevenueUsdMicros: number(totalRevenue?.revenue),
        settledPaidComputeCostsUsdMicros: callTotals.filter(row => row.status === 'succeeded').reduce((sum, row) => sum + number(row.cost), 0),
        heldPaidComputeUsdMicros: callTotals.filter(row => ['reserved','sending','unknown'].includes(row.status)).reduce((sum, row) => sum + number(row.cap), 0),
        unresolvedPaidCalls, simulatedPaidCalls: callTotals.filter(row => row.simulated).reduce((sum, row) => sum + number(row.count), 0), outsideCostsComplete: false },
      bounties: bounties.slice(0, 100).map(row => ({ id: row.id, buyerAccountId: row.buyer_account, budgetUsdMicros: number(row.budget_usd_micros), expiresAt: time(row.expires_at) })),
      jobs: jobViews, calls: calls.map(row => ({ id: row.id, providerId: row.provider_id, jobId: row.job_id || null,
        status: row.status, costUsdMicros: number(row.cost_usd_micros), simulated: row.simulated, createdAt: time(row.created_at) })),
      customers: customers.slice(0, 100).map(row => ({ buyerAccountId: row.buyer_account, acceptedJobs: number(row.count) })),
      providerOutcomes: [...providerViews.values()].slice(0, 32),
      catalog: providerCatalog(), coverage: { jobsTotal, callsTotal, jobsTruncated: jobsTotal > jobs.length, callsTruncated: callsTotal > calls.length,
        customersTruncated: customers.length > 100, bountiesTruncated: bounties.length > 100, providerOutcomesTruncated: providerViews.size > 32 || providers.length === 166, unknownCosts: unresolvedPaidCalls > 0 },
      causalEffect: null, profitabilityKnown: false, measurement: 'Observed settled resource receipts. Test capital and simulation are not external earnings; hosting, payment fees and unresolved costs are incomplete.' };
  });
}
