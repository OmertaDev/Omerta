import { resourceTransaction, resourceError, resourceKey } from './resourcebook.js';
import { reconcileEarningReceipts } from './earningreceipts.js';

const exact = value => {
  const result = Number(value || 0);
  if (!Number.isSafeInteger(result)) throw resourceError('metrics', 'Earnings exceed exact integer bounds.');
  return result;
};
export async function resourceEarnings(pool, accountId, query = {}) {
  if (!query || typeof query !== 'object' || Array.isArray(query)
      || Object.keys(query).some(key => !['limit', 'afterJobId'].includes(key)))
    throw resourceError('terms', 'Use only limit and afterJobId for earnings pagination.');
  const limit = query.limit === undefined ? 50 : Number(query.limit);
  if ((typeof query.limit !== 'undefined' && !['string', 'number'].includes(typeof query.limit))
      || (typeof query.limit === 'string' && !/^[1-9][0-9]{0,2}$/.test(query.limit))
      || !Number.isInteger(limit) || limit < 1 || limit > 100)
    throw resourceError('terms', 'Earnings limit must be an integer from 1 to 100.');
  const afterJobId = query.afterJobId === undefined ? null : resourceKey(query.afterJobId);
  return resourceTransaction(pool, async client => {
    // Lock only the existing seller treasury; this observation never creates funding.
    const treasury = (await client.query('SELECT mode FROM resource_treasuries WHERE account_id=$1 FOR UPDATE', [accountId])).rows[0];
    const asOf = new Date().toISOString();
    const jobs = (await client.query(`SELECT id,buyer_account,seller_account,state,price_usd_micros,COALESCE(input->>'fulfillment','compute') AS fulfillment FROM resource_jobs
      WHERE seller_account=$1 AND state='accepted' AND ($2::text IS NULL OR id>$2) ORDER BY id LIMIT $3`, [accountId, afterJobId, limit + 1])).rows;
    const rows = [];
    for (const job of jobs.slice(0, limit)) {
      const ledger = (await client.query(`SELECT account_id,event_key,kind,available_delta,reserved_delta FROM resource_ledger
        WHERE (account_id=$1 AND event_key=$2) OR (account_id=$3 AND event_key=$4)`,
      [accountId, `job_revenue:${job.id}`, job.buyer_account, `job_payment:${job.id}`])).rows;
      const buyer = (await client.query('SELECT frozen FROM resource_treasuries WHERE account_id=$1', [job.buyer_account])).rows[0];
      const edge = entry => entry ? { accountId: entry.account_id, eventKey: entry.event_key, kind: entry.kind,
        availableDelta: exact(entry.available_delta), reservedDelta: exact(entry.reserved_delta) } : null;
      rows.push({ id: job.id, buyerAccountId: job.buyer_account, sellerAccountId: job.seller_account,
        state: job.state, priceUsdMicros: exact(job.price_usd_micros), fulfillment: job.fulfillment,
        credit: edge(ledger.find(row => row.account_id === accountId)),
        debit: edge(ledger.find(row => row.account_id === job.buyer_account)), buyerFrozen: buyer?.frozen ?? null });
    }
    const accepted = (await client.query("SELECT COUNT(*) AS count FROM resource_jobs WHERE seller_account=$1 AND state='accepted'", [accountId])).rows[0];
    const revenue = (await client.query("SELECT SUM(available_delta) AS revenue FROM resource_ledger WHERE account_id=$1 AND kind='customer_revenue'", [accountId])).rows[0];
    const costs = (await client.query("SELECT status,simulated,SUM(cost_usd_micros) AS cost,SUM(cap_usd_micros) AS cap FROM resource_calls WHERE account_id=$1 AND purpose->>'kind'='paid_market_analysis' GROUP BY status,simulated", [accountId])).rows;
    return { version: 1, asOf, accountId, mode: treasury?.mode || null, ...reconcileEarningReceipts({ accountId, mode: treasury?.mode || null, rows }),
      totals: { acceptedJobCount: exact(accepted?.count), recordedCustomerRevenueUsdMicros: exact(revenue?.revenue),
        settledPaidComputeCostsUsdMicros: exact(costs.filter(row => row.status === 'succeeded' && !row.simulated).reduce((sum, row) => sum + exact(row.cost), 0)),
        simulatedPaidComputeCostsUsdMicros: exact(costs.filter(row => row.status === 'succeeded' && row.simulated).reduce((sum, row) => sum + exact(row.cost), 0)),
        heldPaidComputeUsdMicros: exact(costs.filter(row => ['reserved','sending','unknown'].includes(row.status)).reduce((sum, row) => sum + exact(row.cap), 0)) },
      pagination: { limit, hasMore: jobs.length > limit, nextAfterJobId: jobs.length > limit ? rows.at(-1).id : null },
      measurement: 'Private read observation of a bounded receipt page. Global recorded totals are not reconciliation of all history; buyer recovery status can change. Test capital and simulation do not establish external earnings. No payout authority.' };
  });
}
