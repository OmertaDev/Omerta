process.env.RESOURCE_ECONOMY = 'on';
process.env.RESOURCE_PAYMENTS_MODE = 'test';
import assert from 'node:assert/strict';
import { commandDatabase, addPlayer, postgres } from './lib/player-command-support.js';
import { resourceTransaction, lockResourceTreasury, moveResourceMoney, setResourcePolicy, resourceAccounting } from '../src/resourcebook.js';
import { setResourceService, createResourceJob } from '../src/resourcework.js';
import { createResourceBounty, bidResourceBounty, awardResourceBounty, cancelResourceBounty, expireResourceBounty,
  resourceLaborBoard, resourceLaborReputation, renewResourceJob } from '../src/resourcelabor.js';

const database = await commandDatabase('resourcelabor'); const pool = database.pool;
const buyer = 'labor-buyer', seller = 'labor-seller', other = 'labor-other';
const fails = code => error => error.code === `resource_${code}`;
const terms = { requestId: 'first', question: 'Analyze public goods prices.', budgetUsdMicros: 100000, expiresInSeconds: 3600 };
const bidTerms = { priceUsdMicros: 70000, deliverySeconds: 3600, expectedServiceRevision: 1 };
try {
  for (const account of [buyer, seller, other]) {
    await addPlayer(pool, account);
    await resourceTransaction(pool, async client => {
      await lockResourceTreasury(client, account);
      await moveResourceMoney(client, account, 10000000, 0, 'capital', `seed:${account}`);
    });
  }
  await setResourcePolicy(pool, buyer, { expectedRevision: 0, enabled: true, providers: ['service:market-analysis'], allowStoredResponses: false,
    maxPerCallUsdMicros: 100000, maxPerDayUsdMicros: 1000000, minimumReserveUsdMicros: 10000, expiresInSeconds: 3600 });
  await setResourceService(pool, seller, { expectedRevision: 0, enabled: true, kind: 'market_analysis', priceUsdMicros: 100000 });
  const bounty = (await createResourceBounty(pool, buyer, terms)).bounty;
  assert.equal((await createResourceBounty(pool, buyer, terms)).bounty.id, bounty.id);
  await assert.rejects(createResourceBounty(pool, buyer, { ...terms, question: 'changed' }), fails('replay'));
  await assert.rejects(createResourceBounty(pool, other, terms), fails('authority'));
  const held = await resourceAccounting(pool, buyer);
  assert.equal(held.reservedUsdMicros, 100000); assert.equal(held.liabilityDriftUsdMicros, 0);
  const bid = (await bidResourceBounty(pool, seller, bounty.id, bidTerms)).bid;
  assert.equal((await bidResourceBounty(pool, seller, bounty.id, bidTerms)).bid.id, bid.id);
  await assert.rejects(bidResourceBounty(pool, seller, bounty.id, { ...bidTerms, priceUsdMicros: 60000 }), fails('replay'));
  await assert.rejects(bidResourceBounty(pool, buyer, bounty.id, bidTerms), fails('bounty'));
  assert.equal((await resourceLaborBoard(pool, other)).receivedBids.length, 0);
  assert.equal((await resourceLaborBoard(pool, buyer)).receivedBids.length, 1);
  await assert.rejects(awardResourceBounty(pool, other, bounty.id, { bidId: bid.id }), fails('bounty'));
  await pool.query('UPDATE resource_treasuries SET frozen=true WHERE account_id=$1', [buyer]);
  await assert.rejects(awardResourceBounty(pool, buyer, bounty.id, { bidId: bid.id }), fails('frozen'));
  await pool.query('UPDATE resource_treasuries SET frozen=false WHERE account_id=$1', [buyer]);
  await pool.query('UPDATE resource_treasuries SET frozen=true WHERE account_id=$1', [seller]);
  await assert.rejects(awardResourceBounty(pool, buyer, bounty.id, { bidId: bid.id }), fails('frozen'));
  await pool.query('UPDATE resource_treasuries SET frozen=false WHERE account_id=$1', [seller]);
  await pool.query('UPDATE resource_compute_policies SET minimum_reserve=9990000 WHERE account_id=$1', [buyer]);
  await assert.rejects(awardResourceBounty(pool, buyer, bounty.id, { bidId: bid.id }), fails('budget'));
  await pool.query('UPDATE resource_compute_policies SET minimum_reserve=10000 WHERE account_id=$1', [buyer]);
  const job = (await awardResourceBounty(pool, buyer, bounty.id, { bidId: bid.id })).job;
  assert.equal(job.priceUsdMicros, 70000); assert.equal(job.question, terms.question);
  assert.equal((await awardResourceBounty(pool, buyer, bounty.id, { bidId: bid.id })).job.id, job.id);
  const after = await resourceAccounting(pool, buyer);
  assert.equal(after.reservedUsdMicros, 70000); assert.equal(after.availableUsdMicros, 9930000);
  assert.equal(after.ledgerDriftUsdMicros, 0); assert.equal(after.liabilityDriftUsdMicros, 0);
  const authority = (await pool.query('SELECT authorized_usd_micros FROM resource_ledger WHERE account_id=$1', [buyer])).rows;
  assert.equal(authority.reduce((sum, row) => sum + Number(row.authorized_usd_micros), 0), 100000, 'Award does not double-charge daily authority');
  const cancellation = (await createResourceBounty(pool, buyer, { ...terms, requestId: 'cancel' })).bounty;
  await pool.query('UPDATE resource_treasuries SET frozen=true WHERE account_id=$1', [buyer]);
  assert.equal((await cancelResourceBounty(pool, buyer, cancellation.id)).bounty.state, 'cancelled');
  await cancelResourceBounty(pool, buyer, cancellation.id);
  const afterRefund = (await pool.query('SELECT authorized_usd_micros FROM resource_ledger WHERE account_id=$1', [buyer])).rows;
  assert.equal(afterRefund.reduce((sum, row) => sum + Number(row.authorized_usd_micros), 0), 200000, 'Refund does not replenish daily authority');
  await pool.query('UPDATE resource_treasuries SET frozen=false WHERE account_id=$1', [buyer]);
  const expiration = (await createResourceBounty(pool, buyer, { ...terms, requestId: 'expire' })).bounty;
  assert.equal((await expireResourceBounty(pool, expiration.id)).bounty.state, 'open');
  await pool.query('UPDATE resource_bounties SET expires_at=$2 WHERE id=$1', [expiration.id, new Date(Date.now() - 1000)]);
  assert.equal((await expireResourceBounty(pool, expiration.id)).bounty.state, 'expired');
  await assert.rejects(bidResourceBounty(pool, seller, expiration.id, bidTerms), fails('state'));
  assert.equal((await resourceAccounting(pool, buyer)).liabilityDriftUsdMicros, 0);
  assert.equal((await resourceLaborReputation(pool, seller)).acceptedJobs, 0);
  await assert.rejects(renewResourceJob(pool, buyer, job.id, { requestId: 'renew', expectedServiceRevision: 1 }), fails('job'));
  // Seed an accepted receipt to isolate renewal authorization from the separately tested work broker.
  await pool.query("UPDATE resource_jobs SET state='accepted' WHERE id=$1", [job.id]);
  const renewed = (await renewResourceJob(pool, buyer, job.id, { requestId: 'renew', expectedServiceRevision: 1 })).job;
  assert.equal(renewed.question, terms.question); assert.equal(renewed.priceUsdMicros, 100000);
  assert.equal((await renewResourceJob(pool, buyer, job.id, { requestId: 'renew', expectedServiceRevision: 1 })).job.id, renewed.id);
  assert.equal((await resourceLaborReputation(pool, seller)).acceptedJobs, 1);
  // An unfinalized settled compute receipt still reduces measured service contribution.
  await pool.query('INSERT INTO resource_calls(id,account_id,request_key,request_hash,provider_id,config,max_output_tokens,cap_usd_micros,cost_usd_micros,provider_cost_usd_micros,policy_revision,purpose,status,simulated) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',
    ['labor-cost-call', seller, 'labor-cost-request', 'hash', 'test-provider', {}, 10, 100, 50, 50, 1, { kind: 'paid_market_analysis', jobId: renewed.id }, 'succeeded', true]);
  await pool.query('INSERT INTO resource_calls(id,account_id,request_key,request_hash,provider_id,config,max_output_tokens,cap_usd_micros,policy_revision,purpose,status,simulated) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
    ['labor-unknown-call', seller, 'labor-unknown-request', 'hash', 'test-provider', {}, 10, 100, 1, { kind: 'paid_market_analysis', jobId: renewed.id }, 'unknown', true]);
  await pool.query("UPDATE resource_jobs SET state='disputed' WHERE id=$1", [renewed.id]);
  const reputation = await resourceLaborReputation(pool, seller);
  assert.equal(reputation.settledReportComputeCostsUsdMicros, 50); assert.equal(reputation.unresolvedPaidCalls, 1);
  assert.equal(reputation.disputedJobs, 1); assert.equal(reputation.contributionUsdMicros, 69950);
  const direct = (await createResourceJob(pool, buyer, { requestId: 'direct-capacity', sellerAccountId: seller, expectedServiceRevision: 1, question: 'Capacity test' })).job;
  assert.equal((await renewResourceJob(pool, buyer, job.id, { requestId: 'renew', expectedServiceRevision: 1 })).job.id, renewed.id);
  const third = (await createResourceJob(pool, buyer, { requestId: 'third-capacity', sellerAccountId: seller, expectedServiceRevision: 1, question: 'Third test' })).job;
  await assert.rejects(createResourceJob(pool, buyer, { requestId: 'fourth-capacity', sellerAccountId: seller, expectedServiceRevision: 1, question: 'Fourth test' }), fails('capacity'));
  await assert.rejects(renewResourceJob(pool, buyer, job.id, { requestId: 'renew-full', expectedServiceRevision: 1 }), fails('capacity'));
  assert.equal((await createResourceJob(pool, buyer, { requestId: 'direct-capacity', sellerAccountId: seller, expectedServiceRevision: 1, question: 'Capacity test' })).job.id, direct.id);
  await pool.query("UPDATE resource_jobs SET state='accepted' WHERE id=$1", [third.id]);
  if (postgres) {
    const parallel = (await createResourceBounty(pool, buyer, { ...terms, requestId: 'parallel' })).bounty;
    const offer = (await bidResourceBounty(pool, seller, parallel.id, bidTerms)).bid;
    const results = await Promise.all(Array.from({ length: 4 }, () => awardResourceBounty(pool, buyer, parallel.id, { bidId: offer.id })));
    assert.equal(new Set(results.map(result => result.job.id)).size, 1);
    assert.equal((await pool.query('SELECT id FROM resource_jobs WHERE request_key=$1', [`bounty_${parallel.id}`])).rows.length, 1);
    // Restore exact treasury liabilities before the race assertions; earlier reputation fixtures are observational only.
    await pool.query("UPDATE resource_jobs SET state='open' WHERE id=$1", [job.id]);
    await pool.query("UPDATE resource_jobs SET state='open' WHERE id=$1", [third.id]);
    await pool.query("DELETE FROM resource_calls WHERE id IN ('labor-cost-call','labor-unknown-call')");
    await pool.query("UPDATE resource_jobs SET state='accepted' WHERE id=$1", [direct.id]);
    await resourceTransaction(pool, async client => {
      await lockResourceTreasury(client, buyer);
      await moveResourceMoney(client, buyer, 0, -100000, 'job_payment', 'fixture-direct-settle');
    });
    // Use another seller so capacity is independent of prior service fixtures.
    await setResourceService(pool, other, { expectedRevision: 0, enabled: true, kind: 'market_analysis', priceUsdMicros: 100000 });
    for (const mode of ['cancel', 'expire']) {
      const race = (await createResourceBounty(pool, buyer, { ...terms, requestId: `race-${mode}` })).bounty;
      const raceBid = (await bidResourceBounty(pool, other, race.id, bidTerms)).bid;
      if (mode === 'expire') await pool.query('UPDATE resource_bounties SET expires_at=$2 WHERE id=$1', [race.id, new Date(Date.now() - 1000)]);
      await Promise.allSettled([awardResourceBounty(pool, buyer, race.id, { bidId: raceBid.id }),
        mode === 'cancel' ? cancelResourceBounty(pool, buyer, race.id) : expireResourceBounty(pool, race.id)]);
      const state = (await pool.query('SELECT state FROM resource_bounties WHERE id=$1', [race.id])).rows[0].state;
      assert(['awarded', mode === 'cancel' ? 'cancelled' : 'expired'].includes(state));
      const created = (await pool.query('SELECT id FROM resource_jobs WHERE request_key=$1', [`bounty_${race.id}`])).rows.length;
      assert.equal(created, state === 'awarded' ? 1 : 0);
      assert.equal((await resourceAccounting(pool, buyer)).liabilityDriftUsdMicros, 0);
      assert.equal((await resourceAccounting(pool, buyer)).ledgerDriftUsdMicros, 0);
    }
  }
  console.log(`resourcelabor PASS (${postgres ? 'PostgreSQL' : 'memory'}) funded award, refunds, privacy, authority, renewal and immutable replay`);
} finally { await database.cleanup(pool); }
