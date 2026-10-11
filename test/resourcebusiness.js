import assert from 'node:assert/strict';
import { commandDatabase, addPlayer, postgres } from './lib/player-command-support.js';
import { resourceTransaction, lockResourceTreasury, moveResourceMoney } from '../src/resourcebook.js';
import { businessSnapshot } from '../src/resourcebusiness.js';
import { resourceEarnings } from '../src/resourceearnings.js';
import Fastify from 'fastify';
import { register as registerResources } from '../src/routes/resources.js';

const database = await commandDatabase('resourcebusiness'); const pool = database.pool;
const account = 'business-seller', buyer = 'business-buyer';
const counts = async () => {
  const result = {};
  for (const table of ['resource_treasuries','resource_ledger','resource_jobs','resource_calls','resource_bounties'])
    result[table] = Number((await pool.query(`SELECT COUNT(*) AS count FROM ${table}`)).rows[0].count);
  return result;
};
try {
  const empty = await businessSnapshot(pool, account);
  assert.equal(empty.treasury, null); assert.equal(empty.mode, 'shadow');
  assert.equal((await counts()).resource_treasuries, 0);
  for (const id of [account, buyer]) {
    await addPlayer(pool, id);
    await resourceTransaction(pool, async client => { await lockResourceTreasury(client, id); await moveResourceMoney(client, id, 1000000, 0, 'capital', `seed:${id}`); });
  }
  await pool.query('INSERT INTO resource_jobs(id,buyer_account,seller_account,request_key,service_revision,price_usd_micros,input,state,expires_at,report) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
    ['business-job', buyer, account, 'job-request', 1, 100000, { question: 'PRIVATE_QUESTION' }, 'accepted', new Date(Date.now() + 3600000), { text: 'PRIVATE_REPORT' }]);
  await resourceTransaction(pool, async client => { await lockResourceTreasury(client, account); await moveResourceMoney(client, account, 70000, 0, 'customer_revenue', 'job_revenue:business-job'); });
  for (const [id, status, cost] of [['settled', 'succeeded', 50], ['unknown', 'unknown', null]]) {
    await pool.query('INSERT INTO resource_calls(id,account_id,request_key,request_hash,provider_id,config,max_output_tokens,cap_usd_micros,cost_usd_micros,policy_revision,purpose,status,simulated,output) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',
      [id, account, id, 'hash', 'test-provider', {}, 10, 100, cost, 1, { kind: 'paid_market_analysis', jobId: 'business-job' }, status, true, 'PRIVATE_OUTPUT']);
  }
  await pool.query("UPDATE resource_jobs SET call_id='settled',submitted_at=$2 WHERE id=$1", ['business-job', new Date()]);
    await addPlayer(pool, 'business-other-seller');
  await resourceTransaction(pool, async client => { await lockResourceTreasury(client, 'business-other-seller'); });
  for (let index = 0; index < 101; index++) {
    const id = 'already-bid-' + index;
    await pool.query('INSERT INTO resource_bounties(id,buyer_account,request_key,question,budget_usd_micros,lifetime_seconds,expires_at,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [id,buyer,id,'PRIVATE_BOUNTY',10000,3600,new Date(Date.now()+3600000),new Date(Date.now()-60000)]);
    await pool.query('INSERT INTO resource_labor_bids(id,bounty_id,seller_account,price_usd_micros,delivery_seconds,service_revision) VALUES($1,$2,$3,$4,$5,$6)', [id,id,account,10000,3600,1]);
  }
  for (const [id,owner] of [['eligible-work',buyer],['self-work',account],['expired-work',buyer]]) {
    await pool.query('INSERT INTO resource_bounties(id,buyer_account,request_key,question,budget_usd_micros,lifetime_seconds,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7)', [id,owner,id,'PRIVATE_BOUNTY',10000,3600,new Date(Date.now()+(id==='expired-work'?-1000:3600000))]);
  }
  await pool.query('INSERT INTO resource_labor_bids(id,bounty_id,seller_account,price_usd_micros,delivery_seconds,service_revision) VALUES($1,$2,$3,$4,$5,$6)', ['rival-bid','eligible-work','business-other-seller',10000,3600,1]);
  const before = await counts();
  const queries = []; const connect = pool.connect;
  pool.connect = async (...args) => {
    const client = await connect.apply(pool, args); const query = client.query, release = client.release;
    client.query = function (...values) { queries.push(values[0]); return query.apply(this, values); };
    client.release = function (...values) { this.query = query; this.release = release; return release.apply(this, values); };
    return client;
  };
  let snapshot;
  try { snapshot = await businessSnapshot(pool, account); } finally { pool.connect = connect; }
  assert(queries.every(sql => /^\s*(SELECT|BEGIN|COMMIT|ROLLBACK)\b/i.test(sql)), 'Observer cannot execute mutation SQL');
  assert(queries.every(sql => !/SELECT\s+\*|\b(report|question|prompt|output|input)\b/i.test(sql)), 'Private raw data is never loaded');
  assert.deepEqual(await counts(), before);
  assert.deepEqual(snapshot.bounties.map(b=>b.id), ['eligible-work'], 'Existing own bids, self-owned and expired bounties are filtered before the bounded page; rival bids remain eligible');
  assert.equal(snapshot.coverage.bountiesTruncated, false, 'Excluded bids do not consume opportunity coverage');
  assert.equal(snapshot.totals.settledCustomerRevenueUsdMicros, 70000);
  assert.equal(snapshot.jobs[0].settledRevenueUsdMicros, 70000, 'Earned ledger receipt differs from advertised job price');
  assert.equal(snapshot.totals.settledPaidComputeCostsUsdMicros, 50);
  assert.equal(snapshot.totals.heldPaidComputeUsdMicros, 100);
  assert.equal(snapshot.jobs[0].unresolvedCalls, 1);
  assert.equal(snapshot.providerOutcomes[0].acceptedJobs, 1);
  assert.equal(snapshot.providerOutcomes[0].onTimeJobs, 1);
  assert.equal(snapshot.coverage.unknownCosts, true);
  assert.equal(snapshot.profitabilityKnown, false);
  assert.equal(snapshot.causalEffect, null);
  assert(!JSON.stringify(snapshot).includes('PRIVATE_'));
  assert.equal((await businessSnapshot(pool, buyer)).jobs.length, 0);
  for (let index = 0; index < 101; index++) {
    await pool.query('INSERT INTO resource_jobs(id,buyer_account,seller_account,request_key,service_revision,price_usd_micros,input,state,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [`history-${index}`, buyer, account, `history-${index}`, 1, 10000, { question: 'PRIVATE_HISTORY' }, 'refunded', new Date()]);
    await pool.query('INSERT INTO resource_calls(id,account_id,request_key,request_hash,provider_id,config,max_output_tokens,cap_usd_micros,cost_usd_micros,policy_revision,purpose,status,simulated) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
      [`history-call-${index}`, account, `history-call-${index}`, 'hash', 'test-provider', {}, 10, 100, 1, 1, { kind: 'paid_market_analysis', jobId: `history-${index}` }, 'succeeded', true]);
  }
  const bounded = await businessSnapshot(pool, account);
  assert.equal(bounded.jobs.length, 100); assert.equal(bounded.calls.length, 100);
  assert.equal(bounded.coverage.jobsTotal, 102); assert.equal(bounded.coverage.callsTotal, 103);
  assert.equal(bounded.coverage.jobsTruncated, true); assert.equal(bounded.coverage.callsTruncated, true);
  assert.equal(bounded.totals.settledPaidComputeCostsUsdMicros, 151, 'Global costs retain receipts beyond the bounded detail window');
  assert.equal(bounded.commitments.pendingAwardBids, 0);
  await pool.query('INSERT INTO resource_services(account_id,revision,enabled,price_usd_micros) VALUES($1,1,true,100000)', [account]);
  await pool.query('INSERT INTO resource_services(account_id,revision,enabled,price_usd_micros) VALUES($1,1,true,100000)', [buyer]);
  for (let index = 0; index < 106; index++) {
    const id = `commitment-${index}`;
    await pool.query('INSERT INTO resource_bounties(id,buyer_account,request_key,question,budget_usd_micros,lifetime_seconds,state,expires_at) VALUES($1,$2,$3,$4,100000,3600,$5,$6)',
      [id, buyer, id, 'PRIVATE_COMMITMENT_QUESTION', index === 102 ? 'awarded' : index === 103 ? 'cancelled' : 'open', new Date(Date.now() + (index === 101 ? -3600000 : 3600000))]);
    await pool.query('INSERT INTO resource_labor_bids(id,bounty_id,seller_account,price_usd_micros,delivery_seconds,service_revision) VALUES($1,$2,$3,100000,3600,$4)',
      [`bid-${id}`, id, index === 104 ? buyer : account, index === 105 ? 2 : 1]);
  }
  const commitmentQueries = [];
  const readPool = { connect: async () => {
    const client = await pool.connect();
    return { query: async (sql, values) => { commitmentQueries.push(sql); return client.query(sql, values); }, release: () => client.release() };
  } };
  const beforeCommitments = await counts();
  const committed = await businessSnapshot(readPool, account);
  assert.equal(committed.commitments.pendingAwardBids, 202, 'Count includes both existing and new commitments beyond the 100-entry detail window');
  assert.deepEqual(await counts(), beforeCommitments);
  const countSql = commitmentQueries.find(sql => /COUNT\(bid.id\).*resource_labor_bids/.test(sql));
  assert(countSql && !/LIMIT|question|report|output|resource_compute_policies|resource_ledger/i.test(countSql));
  assert(commitmentQueries.every(sql => /^(SELECT|BEGIN|COMMIT|ROLLBACK)\b/.test(sql)));
  assert(!JSON.stringify(committed.commitments).includes('PRIVATE_'));
  assert.equal((await businessSnapshot(pool, buyer)).commitments.pendingAwardBids, 0, 'Own-buyer bid is excluded and another seller is isolated');
  await pool.query('UPDATE resource_services SET revision=2 WHERE account_id=$1', [account]);
  assert.equal((await businessSnapshot(pool, account)).commitments.pendingAwardBids, 1, 'Only current service revision can be awarded');
  await pool.query('UPDATE resource_services SET enabled=false WHERE account_id=$1', [account]);
  assert.equal((await businessSnapshot(pool, account)).commitments.pendingAwardBids, 0);
  await pool.query('UPDATE resource_services SET enabled=true,revision=1 WHERE account_id=$1', [account]);
  if (postgres) {
    const writer = await pool.connect(); await writer.query('BEGIN');
    await writer.query('SELECT account_id FROM resource_treasuries WHERE account_id=$1 FOR UPDATE', [account]);
    const originalConnect = pool.connect; let mark;
    const reached = new Promise(resolve => { mark = resolve; });
    pool.connect = async (...args) => {
      const client = await originalConnect.apply(pool, args), query = client.query, release = client.release;
      client.query = function (...values) { if (/FROM resource_treasuries.*FOR UPDATE/.test(values[0])) mark(); return query.apply(this, values); };
      client.release = function (...values) { this.query = query; this.release = release; return release.apply(this, values); };
      return client;
    };
    try {
      const pending = businessSnapshot(pool, account); await reached;
      await new Promise(resolve => setTimeout(resolve, 25));
      const releasedAt = Date.now(); await writer.query('COMMIT');
      assert(Date.parse((await pending).asOf) >= releasedAt, 'Snapshot time must follow the contended treasury lock');
    } finally { pool.connect = originalConnect; await writer.query('ROLLBACK'); writer.release(); }
  }
  const earningsQueries = [];
  const earningsPool = { connect: async () => {
    const client = await pool.connect();
    return { query: async (sql, values) => { earningsQueries.push(sql); return client.query(sql, values); }, release: () => client.release() };
  } };
  const earningsBefore = await counts();
  const missing = await resourceEarnings(earningsPool, 'no-earnings-account');
  assert.equal(missing.mode, null); assert.deepEqual(missing.receipts, []);
  for (const query of [{ limit: 101 }, { limit: 0 }, { limit: '1.0' }, { limit: [] }, { afterJobId: '' }, { accountId: buyer }]) {
    const beforeQueries = earningsQueries.length;
    await assert.rejects(resourceEarnings(earningsPool, account, query));
    assert.equal(earningsQueries.length, beforeQueries, 'Malformed query rejected before SQL');
  }
  const tampered = await resourceEarnings(earningsPool, account);
  assert.equal(tampered.matchedPageRevenueUsdMicros, 0);
  assert.equal(tampered.totals.acceptedJobCount, 1);
  assert.equal(tampered.totals.recordedCustomerRevenueUsdMicros, 70000);
  assert.equal(tampered.totals.simulatedPaidComputeCostsUsdMicros, 151);
  assert.equal(tampered.totals.settledPaidComputeCostsUsdMicros, 0);
  assert.equal(tampered.receipts[0].fulfillment, 'compute');
  assert(tampered.receipts[0].issues.includes('credit_mismatch'));
  assert(tampered.receipts[0].issues.includes('debit_missing'));
  await pool.query('UPDATE resource_jobs SET call_id=NULL WHERE id=$1', ['business-job']);
  assert.equal((await resourceEarnings(earningsPool, account)).receipts[0].fulfillment, 'compute', 'Legacy accepted work without a compute receipt retains its contracted compute fulfillment');
  await pool.query("UPDATE resource_ledger SET available_delta=100000 WHERE account_id=$1 AND event_key='job_revenue:business-job'", [account]);
  await resourceTransaction(pool, async client => {
    await lockResourceTreasury(client, buyer);
    await moveResourceMoney(client, buyer, -100000, 100000, 'reserve', 'earnings-reserve');
    await moveResourceMoney(client, buyer, 0, -100000, 'job_payment', 'job_payment:business-job');
  });
  const balanced = await resourceEarnings(earningsPool, account);
  assert.equal(balanced.matchedPageRevenueUsdMicros, 100000);
  assert.equal(balanced.withdrawalsSupported, false); assert.equal(balanced.withdrawableUsdMicros, 0);
  assert.equal(balanced.fundingProvenanceVerified, false); assert.equal(balanced.profitabilityKnown, false);
  assert.equal(balanced.outsideCostsComplete, false);
  await pool.query('UPDATE resource_treasuries SET frozen=true WHERE account_id=$1', [buyer]);
  assert.equal((await resourceEarnings(earningsPool, account)).matchedPageRevenueUsdMicros, 100000, 'Recovery is current observation, not historical accounting authority');
  assert.equal((await resourceEarnings(earningsPool, buyer)).receipts.length, 0, 'Buyer cannot read seller statement');
  assert(earningsQueries.every(sql => /^\s*(SELECT|BEGIN|COMMIT|ROLLBACK)\b/i.test(sql)));
  assert(earningsQueries.every(sql => !/SELECT\s+\*|\b(report|question|prompt|output|available_usd_micros|reserved_usd_micros)\b/i.test(sql)));
  assert(earningsQueries.filter(sql => /\binput\b/.test(sql)).every(sql => sql.includes("COALESCE(input->>'fulfillment','compute') AS fulfillment")), 'Only contracted fulfillment scalar is read, never raw inputs');
  assert(!JSON.stringify(balanced).includes('PRIVATE_'));
  assert.deepEqual(await counts(), { ...earningsBefore, resource_ledger: earningsBefore.resource_ledger + 2 });
  await resourceTransaction(pool, async client => {
    await lockResourceTreasury(client, account);
    await moveResourceMoney(client, account, 10000, 0, 'customer_revenue', 'job_revenue:orphan');
  });
  const orphan = await resourceEarnings(earningsPool, account);
  assert.equal(orphan.totals.recordedCustomerRevenueUsdMicros, 110000);
  assert.equal(orphan.matchedPageRevenueUsdMicros, 100000, 'Orphan ledger income appears only as recorded total');
  await pool.query("UPDATE resource_treasuries SET mode='live' WHERE account_id=$1", [account]);
  assert.equal((await resourceEarnings(earningsPool, account)).mode, 'live', 'Observation reports stored environment without activating rails');
  await pool.query("UPDATE resource_treasuries SET mode='test' WHERE account_id=$1", [account]);
  if (postgres) {
    const writer = await pool.connect(); await writer.query('BEGIN');
    await writer.query('SELECT account_id FROM resource_treasuries WHERE account_id=$1 FOR UPDATE', [account]);
    let reachedLock;
    const reached = new Promise(resolve => { reachedLock = resolve; });
    const lockedPool = { connect: async () => {
      const client = await pool.connect();
      return { query: (sql, values) => { if (/FROM resource_treasuries.*FOR UPDATE/.test(sql)) reachedLock(); return client.query(sql, values); }, release: () => client.release() };
    } };
    let completed = false;
    const pending = resourceEarnings(lockedPool, account).then(value => { completed = true; return value; });
    try {
      await reached; await new Promise(resolve => setTimeout(resolve, 25));
      assert.equal(completed, false, 'Earnings waits for seller accounting lock');
      const releasedAt = Date.now(); await writer.query('COMMIT');
      assert(Date.parse((await pending).asOf) >= releasedAt);
    } finally { await writer.query('ROLLBACK'); writer.release(); }
  }
  for (let index = 0; index < 101; index++) {
    const id = `earnings-${String(index).padStart(3, '0')}`;
    await pool.query('INSERT INTO resource_jobs(id,buyer_account,seller_account,request_key,service_revision,price_usd_micros,input,state,expires_at) VALUES($1,$2,$3,$4,1,10000,$5,$6,$7)',
      [id, buyer, account, id, { question: 'PRIVATE_EARNINGS', fulfillment: 'authored' }, 'accepted', new Date()]);
  }
  const firstPage = await resourceEarnings(earningsPool, account, { limit: '100' });
  assert.equal(firstPage.receipts.length, 100); assert.equal(firstPage.pagination.hasMore, true);
  assert.equal(firstPage.totals.acceptedJobCount, 102);
  const secondPage = await resourceEarnings(earningsPool, account, { limit: 100, afterJobId: firstPage.pagination.nextAfterJobId });
  assert.equal(secondPage.receipts.length, 2); assert.equal(secondPage.pagination.hasMore, false);
  assert(secondPage.receipts.every(row => row.fulfillment === 'authored'));
  assert.equal(secondPage.pagination.nextAfterJobId, null);
  assert(!secondPage.receipts.some(row => firstPage.receipts.some(first => first.jobId === row.jobId)));
  const app = Fastify();
  app.setErrorHandler((error, req, reply) => reply.code(error.code?.startsWith('resource_') ? 400 : 500).send({ error: error.code }));
  registerResources(app, { pool, auth: async (req, reply) => {
    if (!req.headers.authorization) return reply.code(401).send({ error: 'unauthorized' });
    req.user = { sub: req.headers.authorization === 'buyer' ? buyer : account, agent: req.headers.authorization === 'delegate' };
  }, modAuth: async () => {} });
  try {
    assert.equal((await app.inject({ url: '/v1/resources/earnings' })).statusCode, 401);
    const delegate = await app.inject({ url: '/v1/resources/earnings?limit=1', headers: { authorization: 'delegate' } });
    assert.equal(delegate.statusCode, 200); assert.equal(delegate.json().accountId, account); assert.equal(delegate.json().receipts.length, 1);
    const privateBuyer = await app.inject({ url: '/v1/resources/earnings', headers: { authorization: 'buyer' } });
    assert.equal(privateBuyer.json().receipts.length, 0);
    for (const parameters of ['limit=101', 'afterJobId=', `accountId=${buyer}`]) {
      const rejected = await app.inject({ url: `/v1/resources/earnings?${parameters}`, headers: { authorization: 'delegate' } });
      assert.equal(rejected.statusCode, 400);
    }
  } finally { await app.close(); }
  console.log(`resourcebusiness PASS (${postgres ? 'PostgreSQL' : 'memory'}) read-only private bounded receipts and earnings reconciliation`);
} finally { await database.cleanup(pool); }
