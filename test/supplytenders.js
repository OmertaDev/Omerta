process.env.RATE_LIMIT = 'off';
process.env.JWT_SECRET = 'test-only-supply-tender-local-identity-secret-2026';
process.env.SOCIAL_VERIFY_MODE = 'off';
process.env.MOD_KEY = 'supply-tenders-local-test-mod-secret-2026';
process.env.DEPOT_PILOT = 'on';
process.env.DELIVERY_CONTRACTS = 'on';
const postgres = process.argv.includes('--postgres');
if (postgres) {
  const url = new URL(process.env.SUPPLY_TENDER_TEST_DATABASE_URL || 'http://missing');
  if (url.protocol !== 'postgresql:' || url.hostname !== '127.0.0.1' || !url.pathname.startsWith('/supply_tenders_'))
    throw new Error('Use an isolated local supply_tenders_ PostgreSQL database.');
  process.env.DATABASE_URL = url.href;
}
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildServer } from '../src/server.js';
import { ledger, withCharacter, withTwoCharacters } from '../src/game.js';
import { acceptDelivery, expireCommitment } from '../src/delivery.js';
import { reservedQuantity } from '../src/deliverybook.js';
import { publishSupplyTender, offerSupplyTender, awardSupplyTender, withdrawSupplyOffer, cancelSupplyTender, supplyTenderBoard } from '../src/supplytenders.js';

const app = await buildServer();
let seq = 0;
const fixtureSuffix = crypto.randomUUID().slice(0, 6);
const call = async (method, url, player, body) => {
  const response = await app.inject({ method, url, payload: body, headers: {
    ...(player ? { authorization: `Bearer ${player.token}` } : {}), 'idempotency-key': `tender-fixture-${++seq}` } });
  assert.equal(response.statusCode, 200, response.body);
  return response.json();
};
const actor = async name => {
  const token = (await call('POST', '/v1/auth/guest')).token, player = { token };
  await call('POST', '/v1/character', player, { name: `${name.slice(0, 20)} ${fixtureSuffix}` });
  const ch = (await call('GET', '/v1/me', player)).character;
  player.id = ch.id;
  player.accountId = (await app.pool.query('SELECT account_id FROM characters WHERE id=$1', [ch.id])).rows[0].account_id;
  await app.pool.query('UPDATE characters SET cash=50000,bank=0 WHERE id=$1', [ch.id]);
  await ledger(app.pool, { characterId: ch.id, currency: 'cash', amount: 50000 - ch.cash - ch.bank, reason: 'crime:tender-fixture' });
  return player;
};
const fundedOrder = async buyer => {
  const depotId = (await call('POST', '/v1/depot', buyer, { salePrice: 1000, bidPrice: 100, targetStock: 4, reorderAt: 0, restockBudget: 2000 })).id;
  await call('POST', `/v1/depot/${depotId}/fund`, buyer, { amount: 6000 });
  return { depotId, orderId: (await call('POST', `/v1/depot/${depotId}/restock`, buyer)).id };
};
const buyerCall = (buyer, fn) => withCharacter(app.pool, buyer.accountId, (ch, client) => fn(ch, client));
const supplierCall = (supplier, buyer, fn) => withTwoCharacters(app.pool, supplier.accountId, buyer.id, (s, b, client) => fn(s, b, client), { meet: false });
const awardCall = (buyer, supplier, fn) => withTwoCharacters(app.pool, buyer.accountId, supplier.id, (b, s, client) => fn(b, s, client), { meet: false });
const snapshot = async () => ({
  cash: (await app.pool.query('SELECT id,cash FROM characters ORDER BY id')).rows,
  depots: (await app.pool.query('SELECT id,treasury,stock,stock_cost FROM business_depots ORDER BY id')).rows,
  orders: (await app.pool.query('SELECT id,qty,filled_qty,price,status FROM market_listings ORDER BY id')).rows,
  cashTransactions: Number((await app.pool.query("SELECT COUNT(*) n FROM transactions WHERE currency='cash'")).rows[0].n),
});
const refused = async (operation, before) => {
  await assert.rejects(operation, error => ['supply_tender', 'delivery_limit'].includes(error.code));
  assert.deepEqual(await snapshot(), before, 'rejected metadata/award must not move existing cash or inventory');
};
try {
  const buyer = await actor('Tender Buyer'), a = await actor('Tender Supplier A'), b = await actor('Tender Supplier B');
  const capacityBuyer = await actor('Tender Capacity Buyer');
  const { depotId, orderId } = await fundedOrder(buyer);
  const capacityOrder = await fundedOrder(capacityBuyer);
  const now = Date.now(), publish = { qty: 4, unitPrice: 100, offersCloseAt: new Date(now + 300000).toISOString() };
  const offer = { qty: 4, unitPrice: 100, maxProcurementCash: 1000,
    acceptUntil: new Date(now + 240000).toISOString(), deliverBy: new Date(now + 900000).toISOString() };
  const economy = await snapshot();
  const tender = (await buyerCall(buyer, (ch, client) => publishSupplyTender(ch, depotId, orderId, publish, client))).tender;
  assert.equal(tender.offersReserveQuantity, false);
  assert.equal((await buyerCall(buyer, (ch, client) => publishSupplyTender(ch, depotId, orderId, publish, client))).tender.id, tender.id);
  await refused(buyerCall(buyer, (ch, client) => publishSupplyTender(ch, depotId, orderId, { ...publish, unitPrice: 99 }, client)), economy);
  await refused(buyerCall(a, (ch, client) => publishSupplyTender(ch, depotId, orderId, publish, client)), economy);
  const offeredA = (await supplierCall(a, buyer, (s, owner, client) => offerSupplyTender(s, owner, tender.id, offer, client))).offer;
  const offeredB = (await supplierCall(b, buyer, (s, owner, client) => offerSupplyTender(s, owner, tender.id, offer, client))).offer;
  const buyerBoard = await supplyTenderBoard(app.pool, buyer), aBoard = await supplyTenderBoard(app.pool, a);
  assert.equal(buyerBoard.tenders[0].offers.length, 2);
  assert.equal(buyerBoard.tenders[0].offersTruncated, false);
  assert.equal(aBoard.tenders[0].ownOffer.id, offeredA.id);
  assert.ok(!Object.hasOwn(aBoard.tenders[0], 'offers'), 'supplier never reads rival consent/caps');
  assert.ok(!JSON.stringify(aBoard).includes(offeredB.id));
  assert.equal(buyerBoard.offersLimit, 100);
  assert.deepEqual(await snapshot(), economy, 'boards cannot move or reserve money');
  assert.equal(await reservedQuantity(app.pool, orderId), 0, 'offers reserve no escrow rights');
  assert.deepEqual(await snapshot(), economy, 'publication and competing consent move no cash');
  assert.equal((await supplierCall(a, buyer, (s, owner, client) => offerSupplyTender(s, owner, tender.id, offer, client))).offer.id, offeredA.id);
  for (const changes of [{ qty: 3 }, { unitPrice: 101 }, { maxProcurementCash: 999 },
    { acceptUntil: new Date(now + 230000).toISOString() }, { deliverBy: new Date(now + 890000).toISOString() }])
    await refused(supplierCall(a, buyer, (s, owner, client) => offerSupplyTender(s, owner, tender.id, { ...offer, ...changes }, client)), economy);
  const withdrawn = (await supplierCall(b, buyer, (s, _owner, client) => withdrawSupplyOffer(s, tender.id, client))).offer;
  assert.equal(withdrawn.status, 'withdrawn');
  assert.equal((await supplierCall(b, buyer, (s, owner, client) => offerSupplyTender(s, owner, tender.id, offer, client))).offer.status, 'withdrawn', 'retry cannot revive withdrawn consent');
  // These are read fixtures, not authenticated consents and never award inputs.
  const boardFixtures = [];
  for (let i = 0; i < 102; i++) {
    const id = `board-${fixtureSuffix}-${i}`; boardFixtures.push(id);
    await app.pool.query('INSERT INTO characters (id,account_id,name,season,cash,alive) VALUES ($1,$1,$2,1,0,$3)', [id, id, i !== 101]);
    await app.pool.query('INSERT INTO supply_tender_offers (id,tender_id,supplier_character,qty,unit_price,spend_limit,accept_until,delivery_deadline) VALUES ($1,$2,$1,4,100,1,$3,$4)',
      [id, tender.id, new Date(offer.acceptUntil), new Date(now + 700000)]);
  }
  const bounded = (await supplyTenderBoard(app.pool, buyer)).tenders[0];
  assert.equal(bounded.offers.length, 100);
  assert.equal(bounded.offersTruncated, true);
  assert.ok(!bounded.offers.some(item => item.supplierId === boardFixtures[101]), 'dead supplier consent is not advertised');
  const privateBounded = (await supplyTenderBoard(app.pool, a)).tenders[0];
  assert.equal(privateBounded.ownOffer.id, offeredA.id, 'own offer survives crowded buyer sampling');
  assert.ok(!Object.hasOwn(privateBounded, 'offers') && !Object.hasOwn(privateBounded, 'offersTruncated'));
  for (const id of boardFixtures) {
    await app.pool.query('DELETE FROM supply_tender_offers WHERE id=$1', [id]);
    await app.pool.query('DELETE FROM characters WHERE id=$1', [id]);
  }
  await refused(awardCall(buyer, b, (owner, s, client) => awardSupplyTender(owner, s, tender.id, offeredB.id, client)), economy);
  await refused(awardCall(buyer, b, (owner, s, client) => awardSupplyTender(owner, s, tender.id, offeredA.id, client)), economy);
  await app.pool.query('UPDATE supply_tender_offers SET accept_until=$2 WHERE id=$1', [offeredA.id, new Date(now - 1)]);
  await refused(awardCall(buyer, a, (owner, s, client) => awardSupplyTender(owner, s, tender.id, offeredA.id, client)), economy);
  await app.pool.query('UPDATE supply_tender_offers SET accept_until=$2 WHERE id=$1', [offeredA.id, new Date(offer.acceptUntil)]);
  const exposure = [];
  for (let i = 0; i < 2; i++) exposure.push((await withCharacter(app.pool, a.accountId, (ch, client) =>
    acceptDelivery(ch, capacityOrder.orderId, { qty: 1, unitPrice: 100, maxProcurementCash: 1, deadlineSeconds: 120 }, client))).id);
  await refused(awardCall(buyer, a, (owner, s, client) => awardSupplyTender(owner, s, tender.id, offeredA.id, client)), economy);
  assert.equal((await app.pool.query('SELECT status FROM supply_tenders WHERE id=$1', [tender.id])).rows[0].status, 'open');
  for (const id of exposure) {
    await app.pool.query('UPDATE delivery_commitments SET deadline=$2 WHERE id=$1', [id, new Date(now - 1)]);
    await withCharacter(app.pool, a.accountId, (ch, client) => expireCommitment(ch, id, client));
  }
  const award = await awardCall(buyer, a, (owner, s, client) => awardSupplyTender(owner, s, tender.id, offeredA.id, client));
  assert.equal(award.tender.status, 'awarded');
  assert.equal(award.offer.status, 'accepted');
  assert.equal((await supplyTenderBoard(app.pool, a)).tenders.length, 0, 'awarded tender is not advertised as available');
  assert.equal(await reservedQuantity(app.pool, orderId), 4, 'one native commitment partitions existing escrow');
  assert.deepEqual(await snapshot(), economy, 'award itself adds no cash debit, fee or escrow');
  const stored = (await app.pool.query('SELECT * FROM delivery_commitments WHERE id=$1', [award.commitmentId])).rows[0];
  assert.equal(new Date(stored.deadline).toISOString(), offer.deliverBy, 'exact authenticated supplier promise survives award');
  assert.equal(Number(stored.spend_limit), 1000);
  assert.equal((await awardCall(buyer, a, (owner, s, client) => awardSupplyTender(owner, s, tender.id, offeredA.id, client))).commitmentId, award.commitmentId);
  assert.equal(Number((await app.pool.query('SELECT COUNT(*) n FROM delivery_commitments WHERE order_id=$1', [orderId])).rows[0].n), 1);
  await refused(buyerCall(buyer, (owner, client) => cancelSupplyTender(owner, tender.id, client)), economy);
  await refused(supplierCall(a, buyer, (s, _owner, client) => withdrawSupplyOffer(s, tender.id, client)), economy);

  // Expire the native promise; tender metadata never creates or repeats refunds.
  await app.pool.query('UPDATE delivery_commitments SET deadline=$2 WHERE id=$1', [award.commitmentId, new Date(now - 1)]);
  await withCharacter(app.pool, a.accountId, (ch, client) => expireCommitment(ch, award.commitmentId, client));
  assert.deepEqual(await snapshot(), economy);
  const second = (await buyerCall(buyer, (owner, client) => publishSupplyTender(owner, depotId, orderId,
    { ...publish, offersCloseAt: new Date(now + 360000).toISOString() }, client))).tender;
  const secondOffer = (await supplierCall(b, buyer, (s, owner, client) => offerSupplyTender(s, owner, second.id, offer, client))).offer;
  await withCharacter(app.pool, a.accountId, (ch, client) => acceptDelivery(ch, orderId,
    { qty: 1, unitPrice: 100, maxProcurementCash: 1, deadlineSeconds: 120 }, client));
  await refused(awardCall(buyer, b, (owner, s, client) => awardSupplyTender(owner, s, second.id, secondOffer.id, client)), economy);
  await buyerCall(buyer, (owner, client) => cancelSupplyTender(owner, second.id, client));
  assert.deepEqual(await snapshot(), economy);
  assert.equal((await buyerCall(buyer, (owner, client) => cancelSupplyTender(owner, second.id, client))).tender.status, 'cancelled');
  if (postgres) {
    const third = (await buyerCall(buyer, (owner, client) => publishSupplyTender(owner, depotId, orderId,
      { qty: 3, unitPrice: 100, offersCloseAt: new Date(now + 420000).toISOString() }, client))).tender;
    const terms = { ...offer, qty: 3 };
    const a3 = (await supplierCall(a, buyer, (s, owner, client) => offerSupplyTender(s, owner, third.id, terms, client))).offer;
    const b3 = (await supplierCall(b, buyer, (s, owner, client) => offerSupplyTender(s, owner, third.id, terms, client))).offer;
    const competing = await Promise.allSettled([
      awardCall(buyer, a, (owner, s, client) => awardSupplyTender(owner, s, third.id, a3.id, client)),
      awardCall(buyer, b, (owner, s, client) => awardSupplyTender(owner, s, third.id, b3.id, client)),
    ]);
    assert.equal(competing.filter(result => result.status === 'fulfilled').length, 1, 'only one competing offer creates a native commitment');
    assert.equal(competing.filter(result => result.status === 'rejected' && result.reason.code === 'supply_tender').length, 1);
    assert.equal(await reservedQuantity(app.pool, orderId), 4, 'award partitions only the remaining three existing units');
    assert.deepEqual(await snapshot(), economy);
  }
  console.log('Supply tenders: authenticated terms, competing immutable offers, native deadline/reservation, replay, stale quantity and no duplicate cash passed.');
} finally { await app.close(); }
