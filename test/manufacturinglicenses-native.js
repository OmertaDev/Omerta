import assert from 'node:assert/strict';
import { nativeFixture, observePool, observeCraftInsert, assertNativeCraftRollback } from './manufacturinglicenses-native-fixture.js';

const f = await nativeFixture();
const { app, pool, M, A, base, key, call, ok, action, ref, player, materials, productionSource, publish, rows, snapshot, readOnly, books } = f;
try {
  assert.equal((await call(null, 'GET', base)).statusCode, 401);
  const owner = await player(), buyer = await player(), other = await player();
  const source = await productionSource(owner);
  await materials(buyer);
  const offer = await publish(owner, buyer, source);
  assert.equal((await call(owner, 'POST', base + '/accept', { ...ref(offer), businessId: buyer.business, consent: true })).statusCode, 400);
  await action(buyer, 'accept', { ...ref(offer), businessId: buyer.business, consent: true }, 'native-accepted', true);
  const beforeCash = (await pool.query('SELECT id,cash FROM characters WHERE id=$1 OR id=$2 ORDER BY id', [owner.id, buyer.id])).rows;
  const paid = await action(buyer, 'run', ref(offer), 'native-paid-run', true);
  assert.equal(paid.royaltyPaid, 25);
  assert.equal(paid.completedRuns, 1);
  assert.equal(paid.production.totalCrafts, 1);
  const item = (await pool.query('SELECT template_id,owner_scope,owner_id,state FROM item_instances WHERE id=$1', [paid.production.outputItemId])).rows[0];
  assert.deepEqual(item, { template_id: 'item:precision_lock_tool', owner_scope: 'account', owner_id: buyer.account, state: 'active' });
  const afterCash = (await pool.query('SELECT id,cash FROM characters WHERE id=$1 OR id=$2 ORDER BY id', [owner.id, buyer.id])).rows;
  for (const character of beforeCash) assert.equal(Number(afterCash.find(row => row.id === character.id).cash) - Number(character.cash), character.id === owner.id ? 25 : -25);
  const royalty = (await pool.query(`SELECT id,character_id,currency,amount,reason FROM transactions
    WHERE counterparty=$1 AND reason IN ('manufacturing_license:pay','manufacturing_license:receive') ORDER BY reason`, [offer.licenseId])).rows;
  assert.equal(royalty.length, 2);
  assert.equal(new Set(royalty.map(row => row.id)).size, 2);
  assert.deepEqual(royalty.map(row => [row.character_id, row.currency, Number(row.amount), row.reason]), [
    [buyer.id, 'cash', -25, 'manufacturing_license:pay'], [owner.id, 'cash', 25, 'manufacturing_license:receive']
  ]);
  const replayBefore = await snapshot();
  assert.deepEqual(await action(buyer, 'run', ref(offer), 'native-paid-run', false), paid, 'Human and agent share the same original-account ACK');
  assert.equal((await snapshot()).stateSha256, replayBefore.stateSha256, 'Historical ACK performs no second production or royalty');
  const board = JSON.stringify(await ok(buyer, 'GET', base));
  assert(!board.includes(owner.account) && !board.includes(source.productionKey) && !board.includes('royaltyAudit'));
  const pristine = await rows();
  assert.deepEqual(await A.manufacturingLicenseAccounting(readOnly), { paidCash: 25, receivedCash: 25, royaltyNet: 0, verifiedRuns: 1, issues: [] });
  assert.deepEqual(await rows(), pristine, 'Read-only accounting does not repair source');

  async function tamper(table, field, idColumn, identity, value, reason) {
    const originalRow = (await pool.query('SELECT * FROM ' + table + ' WHERE ' + idColumn + '=$1', [identity])).rows;
    assert.equal(originalRow.length, 1);
    const original = originalRow[0][field];
    const encode = data => data && typeof data === 'object' ? JSON.stringify(data) : data;
    await pool.query('UPDATE ' + table + ' SET ' + field + '=$2 WHERE ' + idColumn + '=$1', [identity, encode(value)]);
    try {
      const corrupt = await rows();
      const issues = await A.collectManufacturingLicenseIssues(readOnly);
      assert(issues.some(issue => issue.reason === reason), JSON.stringify(issues));
      assert.deepEqual(await rows(), corrupt, 'Native oracle must refuse without writing');
    } finally { await pool.query('UPDATE ' + table + ' SET ' + field + '=$2 WHERE ' + idColumn + '=$1', [identity, encode(original)]); }
    assert.deepEqual(await rows(), pristine);
  }
  const request = (await pool.query('SELECT * FROM manufacturing_license_requests WHERE account_id=$1 AND request_key=$2', [buyer.account, 'native-paid-run'])).rows[0];
  const receipt = request.receipt;
  assert(receipt.royaltyAudit && typeof receipt.royaltyAudit.productionKey === 'string');
  await tamper('manufacturing_licenses', 'source_hash', 'id', offer.licenseId, '0'.repeat(64), 'license_source');
  await tamper('manufacturing_license_requests', 'body_hash', 'request_key', 'native-paid-run', '0'.repeat(64), 'run_source');
  await tamper('transactions', 'amount', 'id', receipt.royaltyAudit.payTransactionId, -24, 'royalty_witness');
  const wrong = structuredClone(receipt);
  wrong.royaltyAudit.receiveTransactionId = wrong.royaltyAudit.payTransactionId;
  await tamper('manufacturing_license_requests', 'receipt', 'request_key', 'native-paid-run', wrong, 'royalty_witness');
  const production = (await pool.query('SELECT * FROM company_production_receipts WHERE account_id=$1 AND request_key=$2', [buyer.account, receipt.royaltyAudit.productionKey])).rows[0];
  await tamper('company_production_receipts', 'body_hash', 'run_id', production.run_id, '0'.repeat(64), 'production_source');
  const creation = (await pool.query("SELECT id FROM item_events WHERE item_id=$1 AND event_kind='created'", [paid.production.outputItemId])).rows;
  assert.equal(creation.length, 1);
  await tamper('item_events', 'to_owner_id', 'id', creation[0].id, owner.account, 'output_witness');

  await materials(other);
  const second = await publish(owner, other, source, { feeCash: 30 });
  await action(other, 'accept', { ...ref(second), businessId: other.business, consent: true });
  const beforeFault = await snapshot(), attempts = [];
  let delivered = 0;
  const fault = observePool(pool, async (client, sql, parameters, result) => {
    observeCraftInsert(attempts, sql, parameters, result);
    if (!sql?.startsWith('UPDATE manufacturing_licenses SET completed_runs=')) return;
    delivered++;
    assert.equal((await client.query('SELECT completed_runs FROM manufacturing_licenses WHERE id=$1', [second.licenseId])).rows[0].completed_runs, 1);
    const legs = (await client.query(`SELECT amount FROM transactions WHERE counterparty=$1
      AND reason IN ('manufacturing_license:pay','manufacturing_license:receive') ORDER BY reason`, [second.licenseId])).rows;
    assert.deepEqual(legs.map(row => Number(row.amount)), [-30, 30], 'Actual paired royalty was written before the fault');
    assert.equal((await client.query('SELECT COUNT(*)::int n FROM company_production_receipts WHERE account_id=$1', [other.account])).rows[0].n, 2,
      'Actual material recipe and licensed F01 receipt exist before the fault');
    throw Object.assign(Error('actual native post-output royalty fault'), { code: 'license_native_after_write' });
  });
  await assert.rejects(M.manufacturingLicenseAction(fault, other.account, 'run', ref(second), 'native-fault-run'), error => error.code === 'license_native_after_write');
  assert.equal(delivered, 1);
  assertNativeCraftRollback(beforeFault, await snapshot(), attempts);
  const retried = await action(other, 'run', ref(second), 'native-fault-run');
  assert.equal(retried.royaltyPaid, 30);
  const afterRetry = await snapshot();
  assert.deepEqual(await action(other, 'run', ref(second), 'native-fault-run'), retried);
  assert.equal((await snapshot()).stateSha256, afterRetry.stateSha256);
  await books();
  console.log('Manufacturing license native core PASS: actual prior F01 source and licensed UID, agent/human original consent, 25 paired royalty, read-only oracle and six causal source refusals, full native post-output rollback with exactly three observed item-event allocator attempts, original-key retry earns once. Backend ' + f.backend.version);
} finally { await app.close(); }
