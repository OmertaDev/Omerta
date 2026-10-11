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
