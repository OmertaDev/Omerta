import assert from 'node:assert/strict';
import { nativeFixture, observePool, observeCraftInsert, assertNativeCraftRollback } from './manufacturinglicenses-native-fixture.js';

const f = await nativeFixture();
const { app, pool, M, A, base, call, ok, action, ref, player, materials, productionSource, publish, snapshot, readOnly, books } = f;
const acquisitionBase = '/v1/company/acquisitions';
const quote = (seller, buyer) => call(seller, 'POST', acquisitionBase + '/quote', { depotId: seller.business, buyerCharacter: buyer.id });
async function purchaser() {
  const person = await player();
  await ok(person, 'POST', '/v1/depot/' + person.business + '/close', {});
  return person;
}
async function sell(seller, buyer) {
  const quoted = await ok(seller, 'POST', acquisitionBase + '/quote', { depotId: seller.business, buyerCharacter: buyer.id });
  const offered = await ok(seller, 'POST', acquisitionBase, { depotId: seller.business, buyerCharacter: buyer.id,
    price: 10000, sourceHash: quoted.sourceHash, expiresInSeconds: 600, consent: true });
  await ok(buyer, 'POST', acquisitionBase + '/' + offered.acquisition.id + '/accept',
    { consent: true, maxPrice: 10000, termsHash: offered.acquisition.termsHash });
  const executed = await ok(seller, 'POST', acquisitionBase + '/' + offered.acquisition.id + '/execute', { termsHash: offered.acquisition.termsHash });
  assert.equal(executed.acquisition.ownershipTransferred, true);
  assert.equal((await pool.query('SELECT owner_character FROM business_depots WHERE id=$1', [seller.business])).rows[0].owner_character, buyer.id);
  const legs = (await pool.query(`SELECT character_id,currency,amount,reason FROM transactions
    WHERE counterparty=$1 AND reason IN ('company_acquisition:pay','company_acquisition:receive') ORDER BY reason`, [offered.acquisition.id])).rows;
  assert.deepEqual(legs.map(row => [row.character_id, row.currency, Number(row.amount), row.reason]), [
    [buyer.id, 'cash', -10000, 'company_acquisition:pay'], [seller.id, 'cash', 10000, 'company_acquisition:receive']
  ], 'Actual title acquisition retains its real 10000 paired cash settlement');
  return executed;
}
try {
  const ttlOwner = await player(), historicalBuyer = await player(), ttlBuyer = await player();
  const ttlSource = await productionSource(ttlOwner);
  await materials(historicalBuyer);
  const historic = await publish(ttlOwner, historicalBuyer, ttlSource);
  await action(historicalBuyer, 'accept', { ...ref(historic), businessId: historicalBuyer.business, consent: true });
  const historicPaid = await action(historicalBuyer, 'run', ref(historic), 'native-historical-paid-before-expiry');
  await materials(ttlBuyer);
  const expires = await publish(ttlOwner, ttlBuyer, ttlSource, { lifetimeSeconds: 60, feeCash: 35 });
  await action(ttlBuyer, 'accept', { ...ref(expires), businessId: ttlBuyer.business, consent: true });
  const beforeExpiry = await snapshot(), attempts = [];
  let held = 0;
  const delayed = observePool(pool, async (client, sql, parameters, result) => {
    observeCraftInsert(attempts, sql, parameters, result);
    if (!sql?.startsWith('INSERT INTO manufacturing_license_requests(') || parameters?.[1] !== 'native-final-ack-expiry') return;
    held++;
    const written = (await client.query('SELECT receipt FROM manufacturing_license_requests WHERE account_id=$1 AND request_key=$2', [ttlBuyer.account, 'native-final-ack-expiry'])).rows[0];
    assert.equal(written.receipt.royaltyPaid, 35);
    assert.equal((await client.query('SELECT completed_runs FROM manufacturing_licenses WHERE id=$1', [expires.licenseId])).rows[0].completed_runs, 1);
    const output = (await client.query('SELECT template_id,owner_scope,owner_id FROM item_instances WHERE id=$1', [written.receipt.production.outputItemId])).rows[0];
    assert.deepEqual(output, { template_id: 'item:precision_lock_tool', owner_scope: 'account', owner_id: ttlBuyer.account });
    const legs = (await client.query(`SELECT amount FROM transactions WHERE counterparty=$1
      AND reason IN ('manufacturing_license:pay','manufacturing_license:receive') ORDER BY reason`, [expires.licenseId])).rows;
    assert.deepEqual(legs.map(row => Number(row.amount)), [-35, 35]);
    const observed = +new Date((await client.query('SELECT clock_timestamp() AS now')).rows[0].now);
    assert(observed < Date.parse(expires.expiresAt), 'Actual completed ACK is visible before the real deadline');
    console.log('Native manufacturing final-ACK real deadline wait milliseconds', Date.parse(expires.expiresAt) - observed);
    while (Date.now() < Date.parse(expires.expiresAt) + 100) {
      await new Promise(resolve => setTimeout(resolve, Math.min(10000, Date.parse(expires.expiresAt) + 100 - Date.now())));
    }
  });
  await assert.rejects(M.manufacturingLicenseAction(delayed, ttlBuyer.account, 'run', ref(expires), 'native-final-ack-expiry'),
    error => error.code === 'manufacturing_license' && error.message === 'expired');
  assert.equal(held, 1, 'Exactly one actual completed-ACK response crosses the genuine deadline');
  assertNativeCraftRollback(beforeExpiry, await snapshot(), attempts);
  const afterExpiry = await snapshot();
  await assert.rejects(M.manufacturingLicenseAction(pool, ttlBuyer.account, 'run', ref(expires), 'native-final-ack-expiry'), error => error.code === 'manufacturing_license');
  assert.deepEqual(await action(historicalBuyer, 'run', ref(historic), 'native-historical-paid-before-expiry'), historicPaid);
  assert.equal((await snapshot()).stateSha256, afterExpiry.stateSha256, 'Expired retry and old paid ACK execute no new craft or cash');
  assert.deepEqual(await A.collectManufacturingLicenseIssues(readOnly), []);

  const owner = await player(), buyer = await player(), nextOwner = await purchaser(), nextBuyer = await purchaser();
  const source = await productionSource(owner), offered = await publish(owner, buyer, source);
  await materials(buyer);
  assert.equal((await quote(owner, nextOwner)).json().message, 'manufacturing_license_obligation');
  assert.equal((await quote(buyer, nextBuyer)).statusCode, 200, 'An unsolicited named offer never grants a target-business veto');
  await action(buyer, 'accept', { ...ref(offered), businessId: buyer.business, consent: true });
  assert.equal((await quote(buyer, nextBuyer)).json().message, 'manufacturing_license_obligation');
  const paid = await action(buyer, 'run', ref(offered), 'native-acquisition-paid-run');
  assert.equal(paid.royaltyPaid, 25);
  await action(buyer, 'cancel', ref(offered), 'native-acquisition-original-release');
  const history = (await pool.query('SELECT * FROM manufacturing_licenses ORDER BY id')).rows;
  const receipts = (await pool.query('SELECT * FROM manufacturing_license_requests ORDER BY account_id,request_key')).rows;
  const royalty = (await pool.query("SELECT * FROM transactions WHERE reason IN ('manufacturing_license:pay','manufacturing_license:receive') ORDER BY id")).rows;
  await sell(owner, nextOwner);
  await sell(buyer, nextBuyer);
  assert.deepEqual((await pool.query('SELECT * FROM manufacturing_licenses ORDER BY id')).rows, history);
  assert.deepEqual((await pool.query('SELECT * FROM manufacturing_license_requests ORDER BY account_id,request_key')).rows, receipts);
  assert.deepEqual((await pool.query("SELECT * FROM transactions WHERE reason IN ('manufacturing_license:pay','manufacturing_license:receive') ORDER BY id")).rows, royalty);
  assert.deepEqual(await action(buyer, 'run', ref(offered), 'native-acquisition-paid-run'), paid);
  assert.deepEqual(await A.collectManufacturingLicenseIssues(readOnly), [], 'Paid titles change without rewriting original consent or royalty witnesses');
  assert.equal((await call(nextBuyer, 'POST', base + '/run', ref(offered))).statusCode, 400, 'Buying a Depot inherits no manufacturing license authority');
  assert.equal((await call(buyer, 'POST', base + '/run', ref(offered))).statusCode, 400);

  nextOwner.business = owner.business;
  await ok(nextOwner, 'POST', '/v1/depot/' + owner.business + '/fund', { amount: 1000 });
  const other = await purchaser();
  const terms = { depotId: owner.business, steps: [{ kind: 'configure', config: { salePrice: 1100, bidPrice: 500,
    targetStock: 2, reorderAt: 0, restockBudget: 2000 } }], maxWithdrawalCash: 0, reserveCash: 1000 };
  await ok(nextOwner, 'POST', '/v1/company/restructuring/quote', terms);
  for (const column of ['licensor_business', 'licensee_business']) {
    const table = 'unknown_native_manufacturing_' + column;
    await pool.query('CREATE TABLE ' + table + '(id TEXT PRIMARY KEY,' + column + ' TEXT)');
    try {
      assert.equal((await quote(nextOwner, other)).json().message, 'unsupported_schema');
      assert.equal((await call(nextOwner, 'POST', '/v1/company/restructuring/quote', terms)).json().message, 'unsupported_schema');
    } finally { await pool.query('DROP TABLE ' + table); }
  }
  await books();
  console.log('Manufacturing license native acquisition PASS: actual final-ACK real60s expiry/full native rollback with exact three allocator attempts, historical paid ACK unchanged, original live obligations and unsolicited-target boundary, two paid 10000 title transfers with immutable source/royalty history, no inherited consent, F15/F16 unknown exact-column sources refuse. Backend ' + f.backend.version);
} finally { await app.close(); }
