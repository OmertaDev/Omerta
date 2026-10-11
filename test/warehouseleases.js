import assert from 'node:assert/strict';
import { WAREHOUSE, warehouseLeaseTerms, warehouseLeaseFee, warehouseReservedFromRows, warehouseReservedUnits, warehouseOffers } from '../src/warehouseleases.js';

const now = new Date('2026-10-11T12:00:00Z');
const lease = changes => ({ units: 10, held_qty: 3, status: 'active', expires_at: new Date(now.getTime() + 1), ...changes });
assert.equal(WAREHOUSE.termMs, 24 * 60 * 60 * 1000);
assert.equal(WAREHOUSE.maxClaims, 2);
assert.equal(WAREHOUSE.maxUnits, 10);
assert.deepEqual(warehouseLeaseTerms({ units: 10, expectedOfferRevision: 1, maxTotalCash: 1000000 }), { units: 10, expectedOfferRevision: 1, maxTotalCash: 1000000 });
for (const changes of [{ units: 0 }, { units: 11 }, { units: 1.5 }, { units: '2' }, { expectedOfferRevision: 0 }, { expectedOfferRevision: Infinity }, { maxTotalCash: 0 }, { maxTotalCash: 1000001 }])
  assert.throws(() => warehouseLeaseTerms({ units: 1, expectedOfferRevision: 1, maxTotalCash: 10, ...changes }), error => error.code === 'warehouse_terms');
assert.equal(warehouseLeaseFee(10, 100000), 1000000);
assert.equal(warehouseLeaseFee(1, 1), 1);
for (const [units, price] of [[0, 1], [11, 1], [1, 0], [1, 100001], [1, 1.5]]) assert.throws(() => warehouseLeaseFee(units, price));
assert.equal(warehouseReservedFromRows([lease()], now), 10, 'live service reserves contracted units without double-counting held cargo');
assert.equal(warehouseReservedFromRows([lease({ expires_at: now })], now), 3, 'exact expiry boundary retains only held units');
assert.equal(warehouseReservedFromRows([lease({ expires_at: new Date(now.getTime() - 1) })], now), 3);
assert.equal(warehouseReservedFromRows([lease({ status: 'landlord_closed' })], now), 3, 'landlord death keeps retrieval capacity without live service');
assert.equal(warehouseReservedFromRows([lease({ status: 'closed', held_qty: 0 }), lease({ status: 'tenant_dead', held_qty: 0 })], now), 0);
assert.equal(warehouseReservedFromRows([], now), 0, 'old depots retain no-lease capacity');
for (const changes of [{ held_qty: 11 }, { held_qty: -1 }, { units: 11 }, { status: 'unknown' }, { status: 'tenant_dead' }, { status: 'closed' }, { expires_at: 'invalid' }]) assert.throws(() => warehouseReservedFromRows([lease(changes)], now));
assert.throws(() => warehouseReservedFromRows([], 'invalid'));
const calls = []; const client = { async query(sql, values) { calls.push({ sql, values }); return { rows: [lease(), lease({ status: 'landlord_closed', held_qty: 2 })] }; } };
assert.equal(await warehouseReservedUnits(client, 'depot', now), 12); assert.deepEqual(calls[0].values, ['depot']);
const previousPilot = process.env.DEPOT_PILOT; process.env.DEPOT_PILOT = 'off';
assert.deepEqual(await warehouseOffers({ query: () => assert.fail('disabled public offer read must not access storage') }), []);
if (previousPilot === undefined) delete process.env.DEPOT_PILOT; else process.env.DEPOT_PILOT = previousPilot;
// Deterministic lifecycle/custody arithmetic, seed 1947; no SQL atomicity claim.
let seed = 1947; const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
for (let i = 0; i < 500; i++) {
  const units = random() % 10 + 1, held = random() % (units + 1), price = random() % 100000 + 1;
  const active = lease({ units, held_qty: held });
  assert.equal(warehouseReservedFromRows([active], now), units);
  assert.equal(warehouseReservedFromRows([{ ...active, expires_at: now }], now), held);
  assert.equal(warehouseReservedFromRows([{ ...active, status: 'landlord_closed' }], now), held);
  assert.equal(warehouseReservedFromRows([{ ...active, status: 'tenant_dead', held_qty: 0 }], now), 0);
  const fee = warehouseLeaseFee(units, price); assert(Number.isSafeInteger(fee)); assert.equal(fee / units, price); assert(fee <= 1000000);
  let trunk = 20, stored = 0; const deposit = Math.min(units, random() % 11);
  trunk -= deposit; stored += deposit; assert.equal(trunk + stored, 20);
  const withdrawal = stored ? random() % (stored + 1) : 0; trunk += withdrawal; stored -= withdrawal;
  assert.equal(trunk + stored, 20); assert.equal(warehouseReservedFromRows([{ ...active, held_qty: stored, expires_at: now }], now), stored);
}
console.log('warehouseleases: PASS; bounds/24h/expiry/death reservations; seed1947 500 lifecycle/fee cases; native persistence and cargo/rent conservation not yet proven');

// Exercise actual domain writes using the repository memory database and real journals.
// This deliberately does not claim PostgreSQL locks, rollback, concurrency, or estate orchestration.
process.env.DEPOT_PILOT = 'on'; process.env.RATE_LIMIT = 'off'; process.env.JWT_SECRET = 'warehouse-module-local-test-secret'; process.env.SOCIAL_VERIFY_MODE = 'off';
const { buildServer } = await import('../src/server.js');
const G = await import('../src/game.js');
const D = await import('../src/depot.js');
const W = await import('../src/warehouseleases.js');
const app = await buildServer();
async function player(name) {
  const guest = await app.inject({ method: 'POST', url: '/v1/auth/guest' });
  const token = guest.json().token;
  const response = await app.inject({ method: 'POST', url: '/v1/character', headers: { authorization: `Bearer ${token}`, 'idempotency-key': name }, payload: { name } });
  assert.equal(response.statusCode, 200);
  const account = { id: JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub };
  const ch = (await app.pool.query('SELECT * FROM characters WHERE account_id=$1', [account.id])).rows[0];
  await app.pool.query('UPDATE characters SET cash=100000 WHERE id=$1', [ch.id]);
  return { accountId: account.id, id: ch.id };
}

try {
  const owner = await player('Warehouse Owner'), tenant = await player('Warehouse Tenant'), other = await player('Warehouse Other');
  const opened = await G.withCharacter(app.pool, owner.accountId, (ch, client, h) => D.openDepot(ch, { salePrice: 2000, bidPrice: 500, targetStock: 4, reorderAt: 0, restockBudget: 3000 }, client, h));
  await G.withCharacter(app.pool, owner.accountId, (ch, client) => W.configureWarehouseOffer(ch, opened.id, { expectedRevision: 0, enabled: true, slots: 20, cashPerUnitDay: 25 }, client));
  const rent = () => G.withTwoCharacters(app.pool, tenant.accountId, owner.id, (ch, landlord, client, h) => W.leaseWarehouse(ch, landlord, opened.id, { units: 10, expectedOfferRevision: 1, maxTotalCash: 250 }, client, h));
  const before = Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1', [tenant.id])).rows[0].cash);
  const rented = await rent(), id = rented.lease.id;
  assert.equal(new Date(rented.lease.expiresAt) - new Date(rented.lease.createdAt), 86400000);
  assert.equal(Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1', [tenant.id])).rows[0].cash), before - 250);
  assert.equal(Number((await app.pool.query('SELECT treasury FROM business_depots WHERE id=$1', [opened.id])).rows[0].treasury), 250);
  const rentJournal = (await app.pool.query("SELECT * FROM business_depot_journal WHERE reason='warehouse_rent'", [])).rows;
  assert.equal(rentJournal.length, 1); assert.equal(Number(rentJournal[0].cash_delta), 250); assert.equal(rentJournal[0].lease_id, id);
  const rentLedger = (await app.pool.query("SELECT * FROM transactions WHERE reason='warehouse:rent'", [])).rows;
  assert.equal(rentLedger.length, 1); assert.equal(rentLedger[0].character_id, tenant.id); assert.equal(Number(rentLedger[0].amount), -250);
  await assert.rejects(rent(), e => e.code === 'warehouse_claims');
  await app.pool.query("INSERT INTO character_cargo(character_id,good_id,qty) VALUES($1,'gin',10)", [tenant.id]);
  const move = (who, fn, qty) => G.withCharacter(app.pool, who.accountId, (ch, client, h) => fn(ch, id, qty, client, h));
  await assert.rejects(move(other, W.depositWarehouseCargo, 1), e => e.code === 'not_yours');
  await move(tenant, W.depositWarehouseCargo, 10);
  assert.equal(Number((await app.pool.query('SELECT held_qty FROM business_warehouse_leases WHERE id=$1', [id])).rows[0].held_qty), 10);
  assert.equal((await app.pool.query("SELECT qty FROM character_cargo WHERE character_id=$1 AND good_id='gin'", [tenant.id])).rows.length, 0);
  await move(tenant, W.withdrawWarehouseCargo, 4);
  assert.equal(Number((await app.pool.query("SELECT qty FROM character_cargo WHERE character_id=$1 AND good_id='gin'", [tenant.id])).rows[0].qty), 4);
  await G.withCharacter(app.pool, owner.accountId, (ch, client) => W.closeWarehouseClaimsAtDeath(client, ch.id));
  await app.pool.query("UPDATE business_depots SET status='closed' WHERE id=$1", [opened.id]);
  await assert.rejects(move(tenant, W.depositWarehouseCargo, 1), e => e.code === 'warehouse_expired');
  await move(tenant, W.withdrawWarehouseCargo, 6);
  assert.equal(Number((await app.pool.query("SELECT qty FROM character_cargo WHERE character_id=$1 AND good_id='gin'", [tenant.id])).rows[0].qty), 10, 'closed landlord location preserves real tenant cargo retrieval');
  const journal = (await app.pool.query('SELECT lease_id,lease_stock_delta,lease_stock_after,stock_delta,cost_delta FROM business_depot_journal')).rows.filter(r => r.lease_id === id);
  assert.deepEqual(journal.map(r => Number(r.lease_stock_delta)).sort((a,b) => a-b), [-6,-4,0,10]);
  assert.equal(journal.reduce((n, r) => n + Number(r.lease_stock_delta), 0), 0); assert(journal.every(r => !Number(r.stock_delta) && !Number(r.cost_delta)));
  await G.withCharacter(app.pool, tenant.accountId, (ch, client) => W.closeWarehouseLease(ch, id, client));
  assert.equal((await W.warehouseLeaseBoard(app.pool, { id: tenant.id })).length, 0);
  const secondDepot = await G.withCharacter(app.pool, other.accountId, (ch, client, h) => D.openDepot(ch, { salePrice: 2000, bidPrice: 500, targetStock: 4, reorderAt: 0, restockBudget: 3000 }, client, h));
  await G.withCharacter(app.pool, other.accountId, (ch, client) => W.configureWarehouseOffer(ch, secondDepot.id, { expectedRevision: 0, enabled: true, slots: 10, cashPerUnitDay: 1 }, client));
  const second = await G.withTwoCharacters(app.pool, tenant.accountId, other.id, (ch, landlord, client, h) => W.leaseWarehouse(ch, landlord, secondDepot.id, { units: 5, expectedOfferRevision: 1, maxTotalCash: 5 }, client, h));
  await G.withCharacter(app.pool, tenant.accountId, (ch, client, h) => W.depositWarehouseCargo(ch, second.lease.id, 4, client, h));
  await G.withCharacter(app.pool, tenant.accountId, (ch, client) => W.closeWarehouseClaimsAtDeath(client, ch.id));
  const scattered = (await app.pool.query('SELECT status,held_qty FROM business_warehouse_leases WHERE id=$1', [second.lease.id])).rows[0];
  assert.equal(scattered.status, 'tenant_dead'); assert.equal(Number(scattered.held_qty), 0);
  assert.equal(Number((await app.pool.query("SELECT qty FROM character_cargo WHERE character_id=$1 AND good_id='gin'", [tenant.id])).rows[0].qty), 6, 'tenant death scatter never teleports leased cargo into trunk');
  const scatterJournal = (await app.pool.query('SELECT reason,lease_id,lease_stock_delta,lease_stock_after FROM business_depot_journal')).rows.filter(r => r.lease_id === second.lease.id);
  assert.equal(scatterJournal.reduce((n, r) => n + Number(r.lease_stock_delta), 0), 0);
  assert(scatterJournal.some(r => r.reason === 'warehouse_tenant_death' && Number(r.lease_stock_delta) === -4 && Number(r.lease_stock_after) === 0));
  assert.equal((await W.warehouseLeaseBoard(app.pool, { id: tenant.id })).length, 0);
  console.log('warehouseleases actual memory domain: rent ledger/treasury + cargo/journal conservation, independent ownership, fixed term, duplicate claim rejection, landlord-closed retrieval PASS; native proof pending');
} finally { await app.close(); if (previousPilot === undefined) delete process.env.DEPOT_PILOT; else process.env.DEPOT_PILOT = previousPilot; }
