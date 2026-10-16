import assert from 'node:assert/strict';
import { nativeFixture, observeItemAllocations, assertExactRollback } from './saleattribution-native-fixture.js';
const f = await nativeFixture();
try {
  const { sale, campaign, attribution } = await f.prepare();
  const terms = f.attributionRef(attribution), initial = await f.snapshot();
  await assert.rejects(f.act('buyer', 'buy', { ...terms, sourceHash: '0'.repeat(64) }, 'unknown-source'), /attribution_source/);
  assertExactRollback(initial, await f.snapshot(), []);
  await assert.rejects(f.act('buyer', 'buy', { ...terms, publisherAccountId: 'buyer' }, 'authority-override'), /terms/);
  assertExactRollback(initial, await f.snapshot(), []);
  const observed = [];
  for (const [label, match] of [
    ['canonical-consignment-ACK', sql => /UPDATE consignment_requests SET receipt=/.test(sql || '')],
    ['advertising-final-ACK', sql => /UPDATE sale_attribution_requests SET receipt=\$4/.test(sql || '')],
  ]) {
    const before = await f.snapshot(), events = []; let reached = false;
    await assert.rejects(f.tx(c => observeItemAllocations(c, events,
      () => f.Ads.saleAttributionAction(c, 'buyer', 'buy', terms, label),
      sql => { if (!match(sql)) return false; reached = true; return true; })), /N16 native final ACK fault/);
    assert.equal(reached, true, 'The actual canonical final ACK must be reached');
    assert.deepEqual(events.map(row => row.event_kind), ['released', 'transferred']);
    assert(events.every(row => row.item_id === sale.itemId));
    assertExactRollback(before, await f.snapshot(), events);
    observed.push({ label, events }); await f.books();
  }
  const bought = await f.act('buyer', 'buy', terms, 'native-purchase');
  assert.equal(bought.state, 'paid'); assert.equal(bought.sale.paid, 101);
  assert.equal(bought.sale.hostFee, 10); assert.equal(bought.commissionCash, 17);
  assert.equal((await f.pool.query('SELECT owner_id FROM item_instances WHERE id=$1', [sale.itemId])).rows[0].owner_id, 'buyer');
  const stable = await f.snapshot();
  assert.deepEqual(await f.act('buyer', 'buy', terms, 'native-purchase'), bought);
  assertExactRollback(stable, await f.snapshot(), []);
  await assert.rejects(f.act('buyer', 'buy', { ...terms, sourceHash: '0'.repeat(64) }, 'native-purchase'), /request_conflict/);
  assertExactRollback(stable, await f.snapshot(), []);
  const legs = (await f.pool.query("SELECT character_id,amount,reason FROM transactions WHERE counterparty=$1 AND reason LIKE 'consignment:%' ORDER BY reason", [sale.offer.consignmentId])).rows;
  assert.deepEqual(legs.map(row => [row.character_id, Number(row.amount), row.reason]), [
    ['host-actor', 10, 'consignment:host_fee'], ['owner-actor', 91, 'consignment:proceeds'], ['buyer-actor', -101, 'consignment:purchase'],
  ]);
  const reserve = (await f.pool.query('SELECT * FROM sale_attribution_campaigns WHERE id=$1', [campaign.campaignId])).rows[0];
  assert.equal(Number(reserve.paid_cash), 17); assert.equal(Number(reserve.refunded_cash), 0); assert.equal(Number(reserve.escrow_cash), 0);
  console.log(JSON.stringify({ proof: 'N16 actual native source/final-ACK rollback, canonical funded sale and exact ACK', observed, checks: await f.books() }));
} finally { await f.pool.end(); }
