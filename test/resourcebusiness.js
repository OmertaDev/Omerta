import assert from 'node:assert/strict';
import { commandDatabase, addPlayer, postgres } from './lib/player-command-support.js';
import { resourceTransaction, lockResourceTreasury, moveResourceMoney } from '../src/resourcebook.js';
import { businessSnapshot } from '../src/resourcebusiness.js';

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
  console.log(`resourcebusiness PASS (${postgres ? 'PostgreSQL' : 'memory'}) read-only private bounded receipts and unknown-cost coverage`);
} finally { await database.cleanup(pool); }
