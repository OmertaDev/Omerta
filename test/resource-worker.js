process.env.RESOURCE_ECONOMY = 'off';
process.env.RESOURCE_COMPUTE_ENABLED = 'off';
process.env.RESOURCE_PAYMENTS_MODE = 'test';
import assert from 'node:assert/strict';
import { commandDatabase, addPlayer } from './lib/player-command-support.js';
import { resourceTransaction, lockResourceTreasury, moveResourceMoney, resourceAccounting } from '../src/resourcebook.js';
import { resourceTick } from '../tools/resource-worker.js';

const database = await commandDatabase('resourceworker'); const pool = database.pool;
const accounts = ['worker-buyer-frozen', 'worker-buyer-due', 'worker-seller', 'worker-credit', 'worker-abandoned'];
const past = new Date(Date.now() - 86400000);
const originalError = console.error;
const heldLogs = [];
try {
  for (const account of accounts) {
    await addPlayer(pool, account);
    await resourceTransaction(pool, async client => {
      await lockResourceTreasury(client, account);
      await moveResourceMoney(client, account, 1000000, 0, 'capital', `seed:${account}`);
    });
  }
  await resourceTransaction(pool, async client => {
    await lockResourceTreasury(client, 'worker-credit');
    await moveResourceMoney(client, 'worker-credit', -2000, 2000, 'auction_reserve', 'seed:credit-reserve');
    await client.query('INSERT INTO resource_rounds(id,provider_id,config,max_output_tokens,capacity,reserve_usd_micros,commit_until,reveal_until,status,settlement) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      ['worker-round', 'test-model', {}, 100, 1, 2000, past, past, 'settled', {}]);
    await client.query('INSERT INTO resource_bids(id,round_id,account_id,commitment,maximum_usd_micros,bid_usd_micros,policy_revision,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      ['worker-bid', 'worker-round', 'worker-credit', '0'.repeat(64), 2000, 2000, 1, 'won']);
    await client.query('INSERT INTO resource_credits(id,account_id,bid_id,provider_id,config,max_output_tokens,price_usd_micros,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      ['worker-credit-id', 'worker-credit', 'worker-bid', 'test-model', {}, 100, 2000, past]);
  });
  await resourceTransaction(pool, async client => {
    await lockResourceTreasury(client, 'worker-abandoned');
    await moveResourceMoney(client, 'worker-abandoned', -5000, 5000, 'compute_reserve', 'seed:abandoned-reserve');
    await client.query('INSERT INTO resource_calls(id,account_id,request_key,request_hash,provider_id,config,max_output_tokens,cap_usd_micros,policy_revision,purpose,status,created_at,simulated) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
      ['worker-abandoned-call', 'worker-abandoned', 'worker-abandoned-request', 'test-only-hash', 'test-model', {}, 100, 5000, 1, { kind: 'reasoning' }, 'reserved', past, true]);
  });
  for (const [id, buyer, state, created] of [
    ['worker-frozen-job', 'worker-buyer-frozen', 'submitted', new Date(past.getTime() - 1000)],
    ['worker-due-job', 'worker-buyer-due', 'open', past]
  ]) await resourceTransaction(pool, async client => {
    await lockResourceTreasury(client, buyer);
    await moveResourceMoney(client, buyer, -100000, 100000, 'job_reserve', `seed:${id}`);
    await client.query('INSERT INTO resource_jobs(id,buyer_account,seller_account,request_key,service_revision,price_usd_micros,input,state,expires_at,accept_after,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      [id, buyer, 'worker-seller', id, 1, 100000, { question: 'Worker lifecycle fixture.' }, state, past, past, created]);
  });
  await pool.query('UPDATE resource_treasuries SET frozen=true WHERE account_id=$1', ['worker-buyer-frozen']);
  for (const account of accounts) assert.equal((await resourceAccounting(pool, account)).liabilityDriftUsdMicros, 0);
  console.error = (...values) => heldLogs.push(values);
  assert.equal((await resourceTick(pool)).inspectedJobs, 2);
  assert.equal((await pool.query('SELECT status FROM resource_credits WHERE id=$1', ['worker-credit-id'])).rows[0].status, 'refunded');
  assert.equal((await pool.query('SELECT state FROM resource_jobs WHERE id=$1', ['worker-frozen-job'])).rows[0].state, 'submitted');
  assert.equal((await pool.query('SELECT state FROM resource_jobs WHERE id=$1', ['worker-due-job'])).rows[0].state, 'refunded');
  assert.equal((await resourceAccounting(pool, 'worker-seller')).availableUsdMicros, 1000000, 'Frozen escrow cannot fund another account');
  assert.equal((await resourceAccounting(pool, 'worker-buyer-frozen')).reservedUsdMicros, 100000);
  assert.equal((await resourceAccounting(pool, 'worker-buyer-due')).reservedUsdMicros, 0);
  assert.equal((await resourceAccounting(pool, 'worker-credit')).availableUsdMicros, 1000000);
  const abandoned = (await pool.query('SELECT status,error_code,cost_usd_micros FROM resource_calls WHERE id=$1', ['worker-abandoned-call'])).rows[0];
  assert.equal(abandoned.status, 'failed'); assert.equal(abandoned.error_code, 'dispatch_expired'); assert.equal(Number(abandoned.cost_usd_micros), 0);
  assert.equal((await resourceAccounting(pool, 'worker-abandoned')).availableUsdMicros, 1000000);
  assert.equal((await resourceTick(pool)).inspectedJobs, 1);
  assert.equal((await resourceTick(pool)).inspectedJobs, 1);
  const creditPostings = (await pool.query('SELECT id FROM resource_ledger WHERE event_key=$1', ['credit:worker-credit-id:expiry'])).rows;
  assert.equal(creditPostings.length, 1, 'Repeated recovery cannot double refund a credit');
  const jobPostings = (await pool.query('SELECT id FROM resource_ledger WHERE event_key=$1', ['job_refund:worker-due-job'])).rows;
  assert.equal(jobPostings.length, 1, 'Repeated recovery cannot double refund a job');
  assert.equal((await pool.query('SELECT id FROM resource_ledger WHERE event_key=$1', ['call:worker-abandoned-call:refund'])).rows.length, 1, 'Abandoned pre-dispatch reservation refunds only once');
  assert.equal(heldLogs.length, 3, 'Each tick records the held investigation without aborting other work');
  await resourceTransaction(pool, async client => {
    await lockResourceTreasury(client, 'worker-buyer-frozen');
    await moveResourceMoney(client, 'worker-buyer-frozen', 1000000, 0, 'capital', 'seed:pagination-capital');
    for (let i = 0; i < 100; i++) {
      const id = `worker-held-${String(i).padStart(3, '0')}`;
      await moveResourceMoney(client, 'worker-buyer-frozen', -10000, 10000, 'job_reserve', `seed:${id}`);
      await client.query('INSERT INTO resource_jobs(id,buyer_account,seller_account,request_key,service_revision,price_usd_micros,input,state,expires_at,accept_after,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
        [id, 'worker-buyer-frozen', 'worker-seller', id, 1, 10000, { question: 'Held escrow.' }, 'submitted', past, past, new Date(past.getTime() - 10000)]);
    }
  });
  await resourceTransaction(pool, async client => {
    await lockResourceTreasury(client, 'worker-buyer-due');
    await moveResourceMoney(client, 'worker-buyer-due', -10000, 10000, 'job_reserve', 'seed:later-job');
    await client.query('INSERT INTO resource_jobs(id,buyer_account,seller_account,request_key,service_revision,price_usd_micros,input,state,expires_at,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      ['worker-later-job', 'worker-buyer-due', 'worker-seller', 'later-job', 1, 10000, { question: 'Later refund.' }, 'open', past, past]);
  });
  const firstPage = await resourceTick(pool);
  assert.equal(firstPage.inspectedJobs, 100);
  assert.equal((await pool.query('SELECT state FROM resource_jobs WHERE id=$1', ['worker-later-job'])).rows[0].state, 'open');
  const nextPage = await resourceTick(pool, { after: firstPage.nextCursor });
  assert.equal(nextPage.inspectedJobs, 2);
  assert.equal((await pool.query('SELECT state FROM resource_jobs WHERE id=$1', ['worker-later-job'])).rows[0].state, 'refunded', 'Held first page cannot starve a later refund');
  assert.equal((await resourceTick(pool, { after: nextPage.nextCursor })).nextCursor, null, 'End of sweep wraps its cursor');
  for (const account of accounts) {
    const accounting = await resourceAccounting(pool, account);
    assert.equal(accounting.ledgerDriftUsdMicros, 0); assert.equal(accounting.liabilityDriftUsdMicros, 0);
  }
  console.log('resource-worker: intake-off recovery, credit refunds, isolated frozen escrow, repeated ticks and liabilities passed');
} finally { console.error = originalError; await database.cleanup(pool); }
