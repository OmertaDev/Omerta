import assert from 'node:assert/strict';
import { commandDatabase, addPlayer, postgres } from './lib/player-command-support.js';
import { resourceTransaction, lockResourceTreasury } from '../src/resourcebook.js';
import { resourceStorefront } from '../src/resourcestorefront.js';

const database = await commandDatabase('resourcestorefront'); const pool = database.pool;
const seller = 'storefront-seller', buyer = 'private-buyer';
try {
  await assert.rejects(resourceStorefront(pool, seller), error => error.code === 'resource_not_found');
  assert.equal(Number((await pool.query('SELECT COUNT(*) AS count FROM resource_treasuries')).rows[0].count), 0);
  for (const account of [seller, buyer]) {
    await addPlayer(pool, account);
    await resourceTransaction(pool, async client => lockResourceTreasury(client, account));
  }
  await pool.query('INSERT INTO resource_services(account_id,revision,enabled,price_usd_micros) VALUES($1,$2,$3,$4)', [seller, 1, false, 100000]);
  await assert.rejects(resourceStorefront(pool, seller), error => error.code === 'resource_not_found');
  await pool.query('UPDATE resource_services SET enabled=true WHERE account_id=$1', [seller]);
  let index = 0;
  for (const state of ['accepted','accepted','disputed','open','claimed','submitted','refunded']) {
    index++;
    await pool.query('INSERT INTO resource_jobs(id,buyer_account,seller_account,request_key,service_revision,price_usd_micros,input,state,expires_at,report) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [`store-job-${index}`, buyer, seller, `store-request-${index}`, 1, 100000, { question: 'PRIVATE_QUESTION' }, state, new Date(), { text: 'PRIVATE_REPORT' }]);
  }
  const queries = [];
  const countedPool = { connect: async () => {
    const client = await pool.connect();
    return { query: async (sql, values) => { queries.push(sql); return client.query(sql, values); }, release: () => client.release() };
  } };
  const storefront = await resourceStorefront(countedPool, seller);
  assert.equal(storefront.service.priceUsdMicros, 100000);
  assert.equal(storefront.reputation.acceptedJobs, 2); assert.equal(storefront.reputation.disputedJobs, 1);
  assert.equal(storefront.capacity.activeJobs, 4); assert.equal(storefront.capacity.remainingCapacity, 0);
  assert.equal(storefront.reputation.causalEffect, null);
  const serialized = JSON.stringify(storefront);
  for (const secret of [buyer, 'PRIVATE_', 'treasury', 'revenue', 'question', 'report', 'calls']) assert(!serialized.includes(secret));
  assert(queries.every(sql => /^(SELECT|BEGIN|COMMIT|ROLLBACK)\b/.test(sql)), 'Snapshot makes no writes');
  assert(queries.every(sql => !/SELECT\s+\*|\b(input|report|output|buyer_account|available_usd_micros)\b/i.test(sql)), 'Snapshot does not load private fields');
  await pool.query('UPDATE resource_services SET enabled=false WHERE account_id=$1', [seller]);
  await assert.rejects(resourceStorefront(pool, seller), error => error.code === 'resource_not_found');
  console.log(`resourcestorefront PASS (${postgres ? 'PostgreSQL' : 'memory'}) publication privacy, capacity and read-only observations`);
} finally { await database.cleanup(pool); }
