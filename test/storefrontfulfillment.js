import assert from 'node:assert/strict';
import { chooseStorefrontPurchase } from '../src/storefrontfulfillment.js';

const row = (id, stock = 10, unitPrice = 50) => ({ id, ownerCharacterId: 'seller', district: 'docks', good: 'gin', stock, unitPrice });
const input = { businesses: [row('b')], characterId: 'buyer', district: 'docks', good: 'gin',
  maxQuantity: 10, cargoSpace: 8, cash: 1500, reserveCash: 1000, maxSpend: 500, maxUnitPrice: 100 };
const choose = (overrides = {}) => chooseStorefrontPurchase({ ...input, ...overrides });
assert.deepEqual(choose(), { depotId: 'b', quantity: 8, unitPrice: 50, totalCash: 400 });
assert.equal(choose({ cash: 999 }), null);
assert.equal(choose({ maxSpend: 49 }), null);
assert.equal(choose({ cargoSpace: 0 }), null);
assert.equal(choose({ businesses: [{ ...row('own'), ownerCharacterId: 'buyer' }] }), null);
assert.equal(choose({ businesses: [{ ...row('other'), district: 'uptown' }] }), null);
assert.equal(choose({ businesses: [{ ...row('other'), good: 'silk' }] }), null);
assert.equal(choose({ businesses: [row('expensive', 10, 101)] }), null);
assert.equal(choose({ businesses: [row('free', 10, 0)] }), null);
for (const invalid of [-1, 0.5, NaN, Infinity, '8', Number.MAX_SAFE_INTEGER + 1]) {
  for (const key of ['maxQuantity', 'cargoSpace', 'cash', 'reserveCash', 'maxSpend', 'maxUnitPrice'])
    assert.equal(choose({ [key]: invalid }), null, key);
  assert.equal(choose({ businesses: [row('invalid', invalid)] }), null);
  assert.equal(choose({ businesses: [row('invalid', 10, invalid)] }), null);
}
assert.equal(choose({ businesses: Array.from({ length: 101 }, (_, i) => row(String(i))) }), null);
assert.equal(choose({ businesses: [null, {}, { ...row('missing'), ownerCharacterId: undefined }] }), null);
assert.equal(choose({ businesses: [row('z', 8, 60), row('b', 8, 50), row('a', 8, 50)] }).depotId, 'a');
assert.equal(choose({ businesses: [row('cheap', 2, 50), row('more', 8, 60)] }).depotId, 'more');
const maximum = choose({ businesses: [row('huge', Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)],
  maxQuantity: Number.MAX_SAFE_INTEGER, cargoSpace: Number.MAX_SAFE_INTEGER, cash: Number.MAX_SAFE_INTEGER,
  reserveCash: 0, maxSpend: Number.MAX_SAFE_INTEGER, maxUnitPrice: Number.MAX_SAFE_INTEGER });
assert.equal(maximum.quantity, 1);
assert.equal(maximum.totalCash, Number.MAX_SAFE_INTEGER);

let seed = 0x51f0a7;
const random = (max) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max; };
for (let trial = 0; trial < 2000; trial++) {
  const sample = { ...input, cash: random(20000), reserveCash: random(3000), maxSpend: random(10000),
    cargoSpace: random(41), maxQuantity: random(41), maxUnitPrice: 500,
    businesses: Array.from({ length: 5 }, (_, i) => row(String(i), random(41), random(700))) };
  const result = chooseStorefrontPurchase(sample);
  assert.deepEqual(chooseStorefrontPurchase({ ...sample, businesses: [...sample.businesses].reverse() }), result);
  if (!result) continue;
  const selected = sample.businesses.find((r) => r.id === result.depotId);
  assert.ok(result.quantity > 0 && result.quantity <= Math.min(selected.stock, sample.cargoSpace, sample.maxQuantity));
  assert.equal(result.totalCash, result.quantity * selected.unitPrice);
  assert.ok(result.totalCash <= sample.maxSpend && sample.cash - result.totalCash >= sample.reserveCash);
  assert.ok(result.unitPrice <= sample.maxUnitPrice);
  const feasible = sample.businesses.filter((r) => r.unitPrice > 0 && r.unitPrice <= sample.maxUnitPrice)
    .map((r) => ({ depotId: r.id, quantity: Math.min(r.stock, sample.cargoSpace, sample.maxQuantity,
      Math.floor(Math.min(sample.maxSpend, Math.max(0, sample.cash - sample.reserveCash)) / r.unitPrice)), unitPrice: r.unitPrice }))
    .filter((r) => r.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity || a.unitPrice - b.unitPrice || (a.depotId < b.depotId ? -1 : 1));
  assert.equal(result.depotId, feasible[0].depotId);
}
const before = structuredClone(input);
chooseStorefrontPurchase(input);
assert.deepEqual(input, before, 'selection cannot mutate owner inventory or budgets');
console.log('storefront procurement selection passed (2,000 seeded trials, seed 0x51f0a7)');
