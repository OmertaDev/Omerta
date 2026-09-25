import assert from 'node:assert/strict';
import { reconcileCarResources } from '../tools/rc1-car-journal.js';

const empty = () => ({ tables: Object.fromEntries(['cars', 'characters', 'rng_audit', 'transactions', 'item_events',
  'item_mutation_guards', 'market_listings'].map(table => [table, []])) });
const car = { id: 'car-a', character_id: 'owner-a', model_id: 'junker', trim_id: 'stock', dmg: 3, rarity: 'common',
  listed: false, pledged: false, minted_onchain: false, pink_slip: false, race_limit: null, plate: null, tune: 0, nos: 0 };
const before = empty(), after = empty();
before.tables.characters = after.tables.characters = [{ id: 'owner-a', account_id: 'account-a', is_npc: true, alive: true }];
after.tables.cars = [car];
after.tables.rng_audit = [{ id: 'grant', character_id: 'owner-a', action: 'npc:car', outcome: 'grant', roll: '0' },
  { id: 'rarity', character_id: 'owner-a', action: 'rarity:car', outcome: 'common', roll: '0' }];
const partial = reconcileCarResources(before, after);
assert.equal(partial.checks.length, 1); assert.equal(partial.fullyClassifiedChanges, 0);
assert.equal(partial.unsupported[0].kind, 'car-acquisition-identity-provenance');
const wrongOwner = structuredClone(after); wrongOwner.tables.cars[0].character_id = 'owner-b';
assert.throws(() => reconcileCarResources(before, wrongOwner), /cardinality/);
const duplicate = structuredClone(after); duplicate.tables.rng_audit.push({ ...duplicate.tables.rng_audit[0], id: 'extra-grant' });
assert.throws(() => reconcileCarResources(before, duplicate), /cardinality/);
const missing = structuredClone(after); missing.tables.rng_audit = [];
assert.equal(reconcileCarResources(before, missing).unsupported[0].kind, 'car-disposition-unclassified');
const changedModel = structuredClone(after); changedModel.tables.cars[0].model_id = 'unbound-model';
assert.equal(reconcileCarResources(before, changedModel).fullyClassifiedChanges, 0, 'Owner/count receipt cannot prove a model it never records');
const changedAudit = structuredClone(after); changedAudit.tables.rng_audit[0].outcome = 'retire';
assert.throws(() => reconcileCarResources(after, changedAudit), /Immutable rng_audit/);

const listed = structuredClone(after); listed.tables.cars[0].listed = true;
listed.tables.market_listings = [{ id: 'listing', kind: 'car', car_id: 'car-a', seller_character: 'owner-a', status: 'live', bid: null, bidder: null }];
assert.equal(reconcileCarResources(after, listed).lineage[0].kind, 'market-lock');
assert.equal(reconcileCarResources(after, listed).unsupported.length, 0);
const badCustody = structuredClone(listed); badCustody.tables.cars[0].dmg++;
assert.throws(() => reconcileCarResources(after, badCustody), /unrelated car fields/);
const badSeller = structuredClone(listed); badSeller.tables.market_listings[0].seller_character = 'owner-b';
assert.throws(() => reconcileCarResources(after, badSeller), /seller/);
const cancelled = structuredClone(listed); cancelled.tables.cars[0].listed = false; cancelled.tables.market_listings[0].status = 'cancelled';
assert.equal(reconcileCarResources(listed, cancelled).lineage[0].kind, 'market-cancel-release');
const rewrittenListing = structuredClone(cancelled); rewrittenListing.tables.market_listings[0].car_id = 'another-car';
assert.throws(() => reconcileCarResources(listed, rewrittenListing), /identity rewritten/);
const theft = structuredClone(after); theft.tables.cars[0].character_id = 'owner-b';
assert.equal(reconcileCarResources(after, theft).unsupported[0].kind, 'car-disposition-unclassified');
const duplicateCar = structuredClone(after); duplicateCar.tables.cars.push({ ...car });
assert.throws(() => reconcileCarResources(before, duplicateCar), /Duplicate cars/);
console.log('PASS: bounded car custody, owner/count parity, immutable audits and explicit unsupported identity provenance');
