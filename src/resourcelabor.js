import crypto from 'node:crypto';
import { resourceTransaction, lockResourceTreasury, lockResourceTreasuries, moveResourceMoney,
  authorizeResourceSpend, resourceInt, resourceKey, resourceIntake, resourceError, resourceAccounting } from './resourcebook.js';
import { createResourceJob, resourceJobView } from './resourcework.js';

const providerId = 'service:market-analysis';
const live = row => row.state === 'open' && new Date(row.expires_at).getTime() > Date.now();
const bountyView = (row, account) => ({ id: row.id, buyerAccountId: row.buyer_account,
  kind: 'market_analysis', budgetUsdMicros: Number(row.budget_usd_micros), state: row.state,
  expiresAt: new Date(row.expires_at).toISOString(), createdAt: new Date(row.created_at).toISOString(),
  acceptanceCriteria: ['market_analysis_report', 'settled_compute_receipt', 'buyer_acceptance_or_24h_dispute_window'],
  ...(live(row) || row.buyer_account === account ? { question: row.question } : {}),
  ...(row.buyer_account === account ? { jobId: row.job_id || null } : {}) });
const bidView = row => ({ id: row.id, bountyId: row.bounty_id, sellerAccountId: row.seller_account,
  priceUsdMicros: Number(row.price_usd_micros), deliverySeconds: Number(row.delivery_seconds),
  serviceRevision: Number(row.service_revision) });
async function discover(pool, id) {
  resourceKey(id);
  const row = (await pool.query('SELECT * FROM resource_bounties WHERE id=$1', [id])).rows[0];
  if (!row) throw resourceError('bounty', 'This bounty does not exist.');
  return row;
}
export async function createResourceBounty(pool, buyer, body) {
  resourceIntake();
  const requestId = resourceKey(body?.requestId);
  resourceInt(body.budgetUsdMicros, 'bounty budget', 10000, 1000000000);
  resourceInt(body.expiresInSeconds, 'bounty lifetime', 60, 604800);
  if (body.budgetUsdMicros % 10000 || typeof body.question !== 'string' || !body.question.trim() || body.question.length > 2000)
    throw resourceError('terms', 'Use exact cents and a market question of at most 2000 characters.');
  return resourceTransaction(pool, async client => {
    await lockResourceTreasury(client, buyer);
    const prior = (await client.query('SELECT * FROM resource_bounties WHERE buyer_account=$1 AND request_key=$2 FOR UPDATE', [buyer, requestId])).rows[0];
    if (prior) {
      if (prior.question !== body.question || Number(prior.budget_usd_micros) !== body.budgetUsdMicros || Number(prior.lifetime_seconds) !== body.expiresInSeconds)
        throw resourceError('replay', 'This bounty identity has different terms.');
      return { resourceAction: 'bounty', bounty: bountyView(prior, buyer) };
    }
    await authorizeResourceSpend(client, buyer, { providerId, amountUsdMicros: body.budgetUsdMicros });
    const id = crypto.randomUUID();
    await moveResourceMoney(client, buyer, -body.budgetUsdMicros, body.budgetUsdMicros, 'bounty_reserve', `bounty_reserve:${id}`, body.budgetUsdMicros);
    await client.query('INSERT INTO resource_bounties(id,buyer_account,request_key,question,budget_usd_micros,lifetime_seconds,state,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      [id, buyer, requestId, body.question, body.budgetUsdMicros, body.expiresInSeconds, 'open', new Date(Date.now() + body.expiresInSeconds * 1000)]);
    return { resourceAction: 'bounty', bounty: bountyView(await discover(client, id), buyer) };
  });
}
export async function resourceLaborBoard(pool, account) {
  const rows = (await pool.query("SELECT * FROM resource_bounties WHERE state='open' AND expires_at > $1 ORDER BY created_at,id LIMIT 100", [new Date()])).rows;
  const own = (await pool.query('SELECT * FROM resource_bounties WHERE buyer_account=$1 ORDER BY created_at DESC,id LIMIT 100', [account])).rows;
  const bids = (await pool.query('SELECT * FROM resource_labor_bids WHERE seller_account=$1 ORDER BY created_at DESC,id LIMIT 100', [account])).rows;
  const buyerBids = [];
  for (const row of own) {
    if (buyerBids.length >= 1000) break;
    const entries = (await pool.query('SELECT * FROM resource_labor_bids WHERE bounty_id=$1 ORDER BY price_usd_micros,id LIMIT 100', [row.id])).rows;
    buyerBids.push(...entries.slice(0, 1000 - buyerBids.length).map(bidView));
  }
  const service = (await pool.query('SELECT * FROM resource_services WHERE account_id=$1', [account])).rows[0];
  const active = Number((await pool.query("SELECT COUNT(*) AS count FROM resource_jobs WHERE seller_account=$1 AND state IN ('open','claimed','submitted','disputed')", [account])).rows[0].count);
  const accounting = await resourceAccounting(pool, account);
  const policy = (await pool.query('SELECT minimum_reserve FROM resource_compute_policies WHERE account_id=$1', [account])).rows[0];
  return { availableUsdMicros: accounting.availableUsdMicros, minimumReserveUsdMicros: Number(policy?.minimum_reserve || 0), bounties: rows.map(row => bountyView(row, account)), ownBounties: own.map(row => bountyView(row, account)), bids: bids.map(bidView), receivedBids: buyerBids,
    ownService: service ? { enabled: service.enabled, revision: Number(service.revision), priceUsdMicros: Number(service.price_usd_micros), kind: 'market_analysis' } : null,
    sellerActiveJobs: active, remainingCapacity: Math.max(0, 3 - active) };
}
async function checkCapacity(client, seller) {
  const rows = (await client.query("SELECT id FROM resource_jobs WHERE seller_account=$1 AND state IN ('open','claimed','submitted','disputed') LIMIT 3", [seller])).rows;
  if (rows.length >= 3) throw resourceError('capacity', 'This seller already has three active jobs.');
}
export async function bidResourceBounty(pool, seller, id, body) {
  resourceIntake();
  resourceInt(body?.priceUsdMicros, 'bid price', 10000, 1000000000);
  resourceInt(body.deliverySeconds, 'delivery time', 60, 604800);
  resourceInt(body.expectedServiceRevision, 'service revision', 1, 2147483647);
  if (body.priceUsdMicros % 10000) throw resourceError('terms', 'Bid price must be exact cents.');
  const found = await discover(pool, id);
  if (found.buyer_account === seller) throw resourceError('bounty', 'A buyer cannot bid on its own bounty.');
  return resourceTransaction(pool, async client => {
    await lockResourceTreasuries(client, [found.buyer_account, seller]);
    const row = (await client.query('SELECT * FROM resource_bounties WHERE id=$1 FOR UPDATE', [id])).rows[0];
    const prior = (await client.query('SELECT * FROM resource_labor_bids WHERE bounty_id=$1 AND seller_account=$2 FOR UPDATE', [id, seller])).rows[0];
    if (prior) {
      if (Number(prior.price_usd_micros) !== body.priceUsdMicros || Number(prior.delivery_seconds) !== body.deliverySeconds || Number(prior.service_revision) !== body.expectedServiceRevision)
        throw resourceError('replay', 'This immutable bid already has different terms.');
      return { resourceAction: 'labor_bid', bid: bidView(prior) };
    }
    const service = (await client.query('SELECT * FROM resource_services WHERE account_id=$1 FOR UPDATE', [seller])).rows[0];
    if (!live(row) || body.priceUsdMicros > Number(row.budget_usd_micros)) throw resourceError('state', 'This bounty cannot accept this bid.');
    if (!service?.enabled || Number(service.revision) !== body.expectedServiceRevision) throw resourceError('revision', 'Refresh the enabled seller service.');
    await checkCapacity(client, seller);
    const count = (await client.query('SELECT id FROM resource_labor_bids WHERE bounty_id=$1 LIMIT 100', [id])).rows.length;
    if (count >= 100) throw resourceError('capacity', 'This bounty has reached its bid limit.');
    const bidId = crypto.randomUUID();
    await client.query('INSERT INTO resource_labor_bids(id,bounty_id,seller_account,price_usd_micros,delivery_seconds,service_revision) VALUES($1,$2,$3,$4,$5,$6)',
      [bidId, id, seller, body.priceUsdMicros, body.deliverySeconds, body.expectedServiceRevision]);
    return { resourceAction: 'labor_bid', bid: bidView((await client.query('SELECT * FROM resource_labor_bids WHERE id=$1', [bidId])).rows[0]) };
  });
}
export async function awardResourceBounty(pool, buyer, id, body) {
  resourceIntake(); resourceKey(body?.bidId);
  const found = await discover(pool, id);
  if (found.buyer_account !== buyer) throw resourceError('bounty', 'Only the buyer can award this bounty.');
  const selected = (await pool.query('SELECT * FROM resource_labor_bids WHERE id=$1 AND bounty_id=$2', [body.bidId, id])).rows[0];
  if (!selected) throw resourceError('bid', 'Select a bid on this bounty.');
  return resourceTransaction(pool, async client => {
    await lockResourceTreasuries(client, [buyer, selected.seller_account]);
    const row = (await client.query('SELECT * FROM resource_bounties WHERE id=$1 FOR UPDATE', [id])).rows[0];
    const bid = (await client.query('SELECT * FROM resource_labor_bids WHERE id=$1 FOR UPDATE', [body.bidId])).rows[0];
    if (row.state === 'awarded') {
      if (row.awarded_bid_id !== bid.id) throw resourceError('replay', 'This bounty was awarded to another bid.');
      return { resourceAction: 'award', job: resourceJobView((await client.query('SELECT * FROM resource_jobs WHERE id=$1', [row.job_id])).rows[0], buyer) };
    }
    if (!live(row)) throw resourceError('state', 'This bounty cannot be awarded.');
    // Revalidate authority without charging the already reserved budget twice.
    const treasury = (await client.query('SELECT frozen FROM resource_treasuries WHERE account_id=$1', [buyer])).rows[0];
    const policy = (await client.query('SELECT * FROM resource_compute_policies WHERE account_id=$1 FOR UPDATE', [buyer])).rows[0];
    if (treasury?.frozen) throw resourceError('frozen', 'Payment recovery has frozen this bounty.');
    const sellerTreasury = (await client.query('SELECT frozen FROM resource_treasuries WHERE account_id=$1', [bid.seller_account])).rows[0];
    if (sellerTreasury?.frozen) throw resourceError('frozen', 'Payment recovery has frozen this seller.');
    if (!policy?.enabled || new Date(policy.expires_at).getTime() <= Date.now() || !policy.providers.includes(providerId) || Number(bid.price_usd_micros) > Number(policy.max_per_call))
      throw resourceError('authority', 'Award requires current buyer authority.');
    const service = (await client.query('SELECT * FROM resource_services WHERE account_id=$1 FOR UPDATE', [bid.seller_account])).rows[0];
    if (!service?.enabled || Number(service.revision) !== Number(bid.service_revision)) throw resourceError('revision', 'The bid seller service has changed.');
    await checkCapacity(client, bid.seller_account);
    const jobId = crypto.randomUUID(), difference = Number(row.budget_usd_micros) - Number(bid.price_usd_micros);
    const balance = (await client.query('SELECT available_usd_micros FROM resource_treasuries WHERE account_id=$1', [buyer])).rows[0];
    if (Number(balance.available_usd_micros) + difference < Number(policy.minimum_reserve)) throw resourceError('budget', 'Award would violate the current minimum reserve.');
    await moveResourceMoney(client, buyer, difference, -difference, 'bounty_change', `bounty_change:${id}`);
    await client.query('INSERT INTO resource_jobs(id,buyer_account,seller_account,request_key,service_revision,price_usd_micros,input,state,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [jobId, buyer, bid.seller_account, `bounty_${id}`, bid.service_revision, bid.price_usd_micros, { question: row.question }, 'open', new Date(Date.now() + Number(bid.delivery_seconds) * 1000)]);
    await client.query("UPDATE resource_bounties SET state='awarded',job_id=$2,awarded_bid_id=$3 WHERE id=$1", [id, jobId, bid.id]);
    return { resourceAction: 'award', job: resourceJobView((await client.query('SELECT * FROM resource_jobs WHERE id=$1', [jobId])).rows[0], buyer) };
  });
}
async function closeBounty(pool, id, buyer, expired) {
  const found = await discover(pool, id);
  if (!expired && found.buyer_account !== buyer) throw resourceError('bounty', 'Only the buyer can cancel this bounty.');
  return resourceTransaction(pool, async client => {
    await lockResourceTreasury(client, found.buyer_account);
    const row = (await client.query('SELECT * FROM resource_bounties WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (row.state === 'open' && (!expired || new Date(row.expires_at).getTime() <= Date.now())) {
      const amount = Number(row.budget_usd_micros);
      await moveResourceMoney(client, row.buyer_account, amount, -amount, 'bounty_refund', `bounty_refund:${id}`);
      await client.query('UPDATE resource_bounties SET state=$2 WHERE id=$1', [id, expired ? 'expired' : 'cancelled']);
    }
    return { resourceAction: expired ? 'bounty_expire' : 'bounty_cancel', bounty: bountyView(await discover(client, id), found.buyer_account) };
  });
}
export const cancelResourceBounty = (pool, buyer, id) => closeBounty(pool, id, buyer, false);
export const expireResourceBounty = (pool, id) => closeBounty(pool, id, null, true);
export async function resourceLaborReputation(pool, seller) {
  resourceKey(seller);
  const rows = (await pool.query('SELECT id,state,price_usd_micros,report,expires_at,submitted_at FROM resource_jobs WHERE seller_account=$1', [seller])).rows;
  const accepted = rows.filter(row => row.state === 'accepted');
  const revenue = accepted.reduce((n, row) => n + BigInt(row.price_usd_micros), 0n);
  const jobs = new Set(rows.map(row => row.id));
  const calls = (await pool.query('SELECT purpose,cost_usd_micros,status FROM resource_calls WHERE account_id=$1', [seller])).rows
    .filter(row => row.purpose?.kind === 'paid_market_analysis' && jobs.has(row.purpose.jobId));
  const costs = calls.filter(row => row.status === 'succeeded').reduce((n, row) => n + BigInt(row.cost_usd_micros || 0), 0n);
  return { sellerAccountId: seller, acceptedJobs: accepted.length, disputedJobs: rows.filter(row => row.state === 'disputed' || row.report?.resolution).length,
    submittedOnTime: rows.filter(row => row.submitted_at && new Date(row.submitted_at) <= new Date(row.expires_at)).length,
    customerRevenueUsdMicros: Number(revenue), settledReportComputeCostsUsdMicros: Number(costs),
    contributionUsdMicros: Number(revenue - costs), unresolvedPaidCalls: calls.filter(row => ['reserved','sending','unknown'].includes(row.status)).length,
    outsideCostsComplete: false, measurement: 'Observed service outcomes; not a causal quality score or net profit.' };
}
export async function renewResourceJob(pool, buyer, id, body) {
  resourceIntake();
  const previous = (await pool.query('SELECT * FROM resource_jobs WHERE id=$1', [resourceKey(id)])).rows[0];
  if (!previous || previous.buyer_account !== buyer || previous.state !== 'accepted') throw resourceError('job', 'Only the buyer may renew an accepted service job.');
  return createResourceJob(pool, buyer, { requestId: body?.requestId, sellerAccountId: previous.seller_account,
    expectedServiceRevision: body?.expectedServiceRevision, question: previous.input.question, fulfillment: previous.input.fulfillment || 'compute' });
}
