process.env.RATE_LIMIT = 'off';
process.env.JWT_SECRET = 'supply-tender-local-test-secret';
process.env.SOCIAL_VERIFY_MODE = 'off';
process.env.DEPOT_PILOT = 'on';
process.env.DELIVERY_CONTRACTS = 'on';
process.env.MOD_KEY = 'supply-tenders-local-test-mod-secret-2026';
if (process.argv.includes('--postgres')) {
  const url = new URL(process.env.SUPPLY_TENDER_TEST_DATABASE_URL || 'http://missing');
  if (url.protocol !== 'postgresql:' || url.hostname !== '127.0.0.1' || !url.pathname.startsWith('/supply_tenders_'))
    throw new Error('Use an isolated local supply_tenders_ PostgreSQL database.');
  process.env.DATABASE_URL = url.href;
  process.env.MARKET_SEED ||= 'supply-tenders-local-test-market-seed';
}
import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';
import { ledger } from '../src/game.js';
const app = await buildServer();
let seq = 0;
const call = async (method, url, p, body, key = `tender-api-${++seq}`) => {
  const r = await app.inject({ method, url, payload: body,
    headers: { ...(p ? { authorization: `Bearer ${p.token}` } : {}), 'idempotency-key': key } });
  return { code: r.statusCode, body: r.json() };
};
const create = async name => {
  const ownerToken = (await call('POST', '/v1/auth/guest')).body.token;
  const p = { ownerToken, token: (await call('POST', '/v1/auth/agent-key', { token: ownerToken })).body.token };
  assert.equal((await call('POST', '/v1/character', p, { name })).code, 200);
  const ch = (await call('GET', '/v1/me', p)).body.character;
  p.id = ch.id;
  await app.pool.query('UPDATE characters SET cash=50000 WHERE id=$1', [p.id]);
  await ledger(app.pool, { characterId: p.id, currency: 'cash', amount: 50000 - ch.cash, reason: 'crime:tender-fixture' });
  return p;
};
try {
  const buyer = await create('Tender API Buyer'), supplier = await create('Tender API Supplier'), rival = await create('Tender API Rival');
  const human = { ...buyer, token: buyer.ownerToken };
  const config = { salePrice: 2000, bidPrice: 123, targetStock: 4, reorderAt: 0, restockBudget: 3000 };
  const depot = (await call('POST', '/v1/depot', buyer, config)).body.id;
  assert.equal((await call('POST', `/v1/depot/${depot}/fund`, buyer, { amount: 6000 })).code, 200);
  const order = (await call('POST', `/v1/depot/${depot}/restock`, human)).body.id;
  const terms = { qty: 3, unitPrice: 123, offersCloseAt: new Date(Date.now() + 600000).toISOString() };
  assert.equal((await call('GET', '/v1/supply-tenders')).code, 401);
  const published = await call('POST', `/v1/depot/${depot}/orders/${order}/tender`, buyer, terms);
  assert.equal(published.code, 200, JSON.stringify(published.body));
  const id = published.body.tender.id;
  const offerTerms = { qty: 3, unitPrice: 123, maxProcurementCash: 1000,
    acceptUntil: new Date(Date.now() + 300000).toISOString(), deliverBy: new Date(Date.now() + 900000).toISOString() };
  const offered = await call('POST', `/v1/supply-tenders/${id}/offers`, supplier, offerTerms, 'tender-offer-retry');
  assert.equal(offered.code, 200, JSON.stringify(offered.body));
  assert.deepEqual(await call('POST', `/v1/supply-tenders/${id}/offers`, supplier, offerTerms, 'tender-offer-retry'), offered);
  assert.equal(offered.body.offer.supplierId, supplier.id, 'signed-in supplier is the only source of consent');
  const offerId = offered.body.offer.id;
  const rivalBoard = (await call('GET', '/v1/supply-tenders', rival)).body.tenders.find(t => t.id === id);
  assert.equal('offers' in rivalBoard, false);
  assert.equal(rivalBoard.ownOffer, null, 'rival cannot see private offer terms');
  assert.equal((await call('GET', '/v1/supply-tenders', supplier)).body.tenders.find(t => t.id === id).ownOffer.id, offerId);
  assert.equal((await call('GET', '/v1/supply-tenders', buyer)).body.tenders.find(t => t.id === id).offers[0].id, offerId);
  assert.equal((await call('POST', `/v1/supply-tenders/${id}/offers/${offerId}/award`, rival)).body.error, 'supply_tender');
  const before = (await app.pool.query('SELECT qty,filled_qty FROM market_listings WHERE id=$1', [order])).rows[0];
  const awarded = await call('POST', `/v1/supply-tenders/${id}/offers/${offerId}/award`, buyer, undefined, 'tender-award-retry');
  assert.equal(awarded.code, 200, JSON.stringify(awarded.body));
  assert.deepEqual(await call('POST', `/v1/supply-tenders/${id}/offers/${offerId}/award`, buyer, undefined, 'tender-award-retry'), awarded);
  const commitment = (await app.pool.query('SELECT * FROM delivery_commitments WHERE id=$1', [awarded.body.commitmentId])).rows[0];
  assert.equal(commitment.supplier_character, supplier.id);
  assert.equal(commitment.buyer_character, buyer.id);
  assert.equal(new Date(commitment.deadline).toISOString(), offerTerms.deliverBy);
  assert.equal(Number(commitment.spend_limit), 1000);
  assert.deepEqual((await app.pool.query('SELECT qty,filled_qty FROM market_listings WHERE id=$1', [order])).rows[0], before,
    'award reserves quantity without moving the already funded order');
  assert.equal((await call('POST', `/v1/supply-tenders/${id}/cancel`, buyer)).body.error, 'supply_tender');
  console.log('supply tender API: authentication, signed supplier consent, private boards, buyer-only award, exact retry and canonical reservation passed');
} finally { await app.close(); }
