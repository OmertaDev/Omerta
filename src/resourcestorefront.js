import { resourceTransaction, resourceError, resourceEnabled } from './resourcebook.js';

export async function resourceStorefront(pool, sellerAccount) {
  return resourceTransaction(pool, async client => {
    // Service publication and job changes acquire this same existing account lock.
    // This read never creates a treasury or exposes its balance or policy.
    await client.query('SELECT account_id FROM resource_treasuries WHERE account_id=$1 FOR UPDATE', [sellerAccount]);
    const service = (await client.query('SELECT revision,price_usd_micros FROM resource_services WHERE account_id=$1 AND enabled=true', [sellerAccount])).rows[0];
    if (!service) throw resourceError('not_found', 'This storefront is not published.');
    const states = (await client.query('SELECT state,COUNT(*) AS count FROM resource_jobs WHERE seller_account=$1 GROUP BY state', [sellerAccount])).rows;
    const count = state => Number(states.find(row => row.state === state)?.count || 0);
    const activeJobs = ['open','claimed','submitted','disputed'].reduce((sum, state) => sum + count(state), 0);
    return { sellerAccountId: sellerAccount, service: { kind: 'market_analysis', revision: Number(service.revision), priceUsdMicros: Number(service.price_usd_micros) },
      capacity: { activeJobs, maxActiveJobs: 3, remainingCapacity: Math.max(0, 3 - activeJobs) },
      reputation: { acceptedJobs: count('accepted'), disputedJobs: count('disputed'), causalEffect: null,
        measurement: 'Observed accepted and currently disputed jobs; not a causal quality score.' },
      intakeEnabled: resourceEnabled() };
  });
}
