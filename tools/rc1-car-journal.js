// Read-only, serial-boundary car evidence. This module never grants an item or
// turns a receipt that lacks a car ID into exact acquisition/destruction lineage.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { rollRarity } from '../src/rules.js';
import { exactSum } from './rc1-resource-journal.js';
import { verifySoloCarMelt } from './rc1-car-melt-provenance.js';
import { verifyNpcCarAcquisition } from './rc1-npc-car-acquisition.js';

const rows = (state, table) => { assert(Array.isArray(state.tables[table]), `Missing car evidence table ${table}`); return state.tables[table]; };
const index = (values, key, label) => {
  const result = new Map();
  for (const row of values) { const id = key(row); assert(!result.has(id), `Duplicate ${label} identity: ${id}`); result.set(id, row); }
  return result;
};
const byId = (state, table) => index(rows(state, table), row => row.id, table);
const changedFields = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(key => JSON.stringify(a[key]) !== JSON.stringify(b[key])).sort();
function appended(before, after, table) {
  const a = byId(before, table), b = byId(after, table);
  for (const [id, row] of a) assert.deepEqual(b.get(id), row, `Immutable ${table} receipt changed: ${id}`);
  return [...b.values()].filter(row => !a.has(row.id));
}
const reference = (table, values) => values.map(row => ({ table, id: row.id ?? row.idempotency_key }));

// Exact normalized envelope emitted by the current canonical basic salvage
// recipe. Only this recipe/version is classified. A differing request digest is
// rejected rather than guessing at a new recipe's authority or output formula.
export const BASIC_CAR_SALVAGE = Object.freeze({
  packageId: 'automotive-salvage', packageVersion: 1, recipeId: 'recipe:car_salvage_basic', recipeVersion: 1,
  consumes: [{ assetType: 'car', quantity: 1 }],
  produces: [{ templateId: 'mat:scrap_steel', quantity: 6, quality: 'standard' },
    { templateId: 'mat:wire', quantity: 2, quality: 'standard' },
    { templateId: 'mat:salvage_parts', quantity: 2, quality: 'standard' }],
  conditions: [{ adapter: 'location', value: 'foundry' }, { adapter: 'owns_car', selector: { kind: 'carType', value: 'junker' } }],
  cashCost: 0,
});
export function basicCarSalvageRequestHash(accountId, carId) {
  return crypto.createHash('sha256').update(JSON.stringify({ kind: 'salvage_car', owner: { scope: 'account', id: accountId },
    request: { ...BASIC_CAR_SALVAGE, carId } })).digest('hex');
}

export function reconcileCarResources(before, after, { carMeltProvenance = null, carAcquisitionProvenance = null } = {}) {
  const prior = byId(before, 'cars'), final = byId(after, 'cars');
  const people = byId(before, 'characters'), nextPeople = byId(after, 'characters');
  const audits = appended(before, after, 'rng_audit'), receipts = appended(before, after, 'transactions');
  const events = appended(before, after, 'item_events');
  const oldGuards = index(rows(before, 'item_mutation_guards'), row => row.idempotency_key, 'guard');
  const guards = index(rows(after, 'item_mutation_guards'), row => row.idempotency_key, 'guard');
  for (const [id, guard] of oldGuards) if (guard.completed_at && guard.result_json)
    assert.deepEqual(guards.get(id), guard, `Completed car mutation guard changed: ${id}`);
  const added = [...final.values()].filter(row => !prior.has(row.id));
  const removed = [...prior.values()].filter(row => !final.has(row.id));
  const changes = [...prior.values()].filter(row => final.has(row.id) && changedFields(row, final.get(row.id)).length);
  const checks = [], lineage = [], unsupported = [], claimed = new Set(), used = new Set();
  const use = (table, values) => { for (const row of values) {
    const id = `${table}:${row.id ?? row.idempotency_key}`;
    assert(!used.has(id), `Car receipt reused: ${id}`); used.add(id);
  } };
  const claim = car => { assert(!claimed.has(car.id), `Car disposition reused: ${car.id}`); claimed.add(car.id); };
  const parity = (kind, owner, beforeCount, afterCount, delta, authority) => {
    const drift = exactSum([afterCount, -beforeCount, -delta]);
    assert.equal(drift, '0', `Car ${kind} count mismatch for ${owner}`);
    checks.push({ kind, resource: 'cars', owner, before: String(beforeCount), after: String(afterCount), expectedDelta: String(delta), drift, authority });
  };
  const incomplete = (kind, owner, carIds, authority, detail) => unsupported.push({ kind, table: 'cars', owner, carIds, authority, detail });

  for (const guard of guards.values()) {
    if (guard.mutation_kind !== 'salvage_car' || !guard.completed_at || !guard.result_json || oldGuards.get(guard.idempotency_key)?.completed_at) continue;
    const result = JSON.parse(guard.result_json);
    if (result.recipe?.recipeId !== BASIC_CAR_SALVAGE.recipeId || guard.envelope_version !== 1) {
      incomplete('car-salvage-definition-unclassified', guard.owner_id, [], reference('item_mutation_guards', [guard]), 'Only the exact version-one basic salvage envelope is supported'); continue;
    }
    assert.equal(guard.owner_scope, 'account'); assert.equal(result.ok, true); assert.equal(result.kind, 'salvage_car');
    assert.deepEqual(result.recipe, Object.fromEntries(['packageId', 'packageVersion', 'recipeId', 'recipeVersion'].map(key => [key, BASIC_CAR_SALVAGE[key]])));
    const car = prior.get(result.car?.id);
    assert(car && !final.has(car.id), 'Salvage receipt must consume its exact prior car');
    assert.equal(people.get(car.character_id)?.account_id, guard.owner_id, 'Salvage car owner differs from guard account');
    assert.equal(people.get(car.character_id)?.loc, 'foundry'); assert.equal(car.model_id, 'junker');
    assert.equal(guard.request_hash, basicCarSalvageRequestHash(guard.owner_id, car.id), 'Salvage request digest does not bind this exact car and recipe');
    assert.deepEqual(result.car, { id: car.id, modelId: car.model_id, trimId: car.trim_id, damage: Number(car.dmg || 0) });
    assert.deepEqual(result.inputs, [{ assetType: 'car', quantity: 1, id: car.id }]); assert.equal(result.cashCost, 0);
    for (const field of ['listed', 'pledged', 'minted_onchain', 'pink_slip']) assert.equal(car[field], false, `Salvage consumed reserved car: ${field}`);
    assert.equal(car.race_limit, null);
    const outputEvents = events.filter(event => event.idempotency_key === guard.idempotency_key);
    assert.equal(outputEvents.length, BASIC_CAR_SALVAGE.produces.length, 'Salvage output event cardinality differs');
    assert.equal(result.outputs.length, BASIC_CAR_SALVAGE.produces.length, 'Salvage output result cardinality differs');
    for (const expected of BASIC_CAR_SALVAGE.produces) {
      const matching = outputEvents.filter(event => event.template_id === expected.templateId && event.quality === expected.quality);
      assert.equal(matching.length, 1, 'Salvage output event is missing or duplicated');
      const event = matching[0], output = result.outputs.filter(row => row.templateId === expected.templateId && row.quality === expected.quality);
      assert.equal(output.length, 1); assert.equal(event.event_kind, 'stack_granted');
      assert.equal(event.to_owner_scope, 'account'); assert.equal(event.to_owner_id, guard.owner_id);
      assert.equal(Number(event.quantity_delta), expected.quantity);
      assert.equal(exactSum([event.quantity_before, event.quantity_delta]), exactSum([event.quantity_after]));
      assert.deepEqual(output[0], { owner: { scope: 'account', id: guard.owner_id }, templateId: expected.templateId,
        quality: expected.quality, qty: Number(event.quantity_after), delta: expected.quantity });
    }
    use('item_mutation_guards', [guard]); use('item_events', outputEvents); claim(car);
    const authority = [...reference('item_mutation_guards', [guard]), ...reference('item_events', outputEvents)];
    parity('car-exact-salvage-sink', car.character_id, 1, 0, -1, authority);
    lineage.push({ kind: 'exact-salvage-sink', carId: car.id, owner: car.character_id, accountId: guard.owner_id, authority });
  }

  const oldListings = byId(before, 'market_listings'), newListings = byId(after, 'market_listings');
  for (const listing of newListings.values()) {
    const old = oldListings.get(listing.id);
    if (listing.kind !== 'car') continue;
    if (old) for (const field of ['kind', 'car_id', 'seller_character']) assert.equal(listing[field], old[field], `Car listing identity rewritten: ${field}`);
    const locked = !old && listing.status === 'live';
    const released = old && ['live', 'expired'].includes(old.status) && listing.status === 'cancelled' && !old.bidder && Number(old.bid || 0) === 0;
    if (!locked && !released) continue;
    const a = prior.get(listing.car_id), b = final.get(listing.car_id);
    // A listing already expired and released before cancellation has no new car disposition.
    if (released && a && b && !a.listed && !b.listed) continue;
    assert(a && b, 'Car custody listing lacks the exact persistent car');
    assert.equal(a.character_id, listing.seller_character, 'Listing seller does not own the car');
    assert.equal(b.character_id, a.character_id, 'Listing custody changed car ownership');
    assert.equal(a.listed, !locked); assert.equal(b.listed, locked);
    assert.deepEqual(changedFields(a, b), ['listed'], 'Listing custody changed unrelated car fields');
    assert.equal(a.pledged, false); assert.equal(a.minted_onchain, false);
    if (released) { assert.equal(listing.bid, null); assert.equal(listing.bidder, null); }
    claim(a); use('market_listings', [listing]);
    const authority = reference('market_listings', [listing]);
    parity('car-exact-market-custody', a.character_id, 1, 1, 0, authority);
    lineage.push({ kind: locked ? 'market-lock' : 'market-cancel-release', carId: a.id, owner: a.character_id, authority });
  }

  const acquisition = verifyNpcCarAcquisition(before, after, carAcquisitionProvenance);
  if (acquisition) {
    const car = final.get(acquisition.carId), grant = audits.find(r => r.id === acquisition.grantId), rarity = audits.find(r => r.id === acquisition.rarityId);
    assert(car && grant && rarity, 'Exact NPC acquisition lacks its fresh car/receipts');
    claim(car); use('rng_audit', [grant, rarity]);
    const authority = reference('rng_audit', [grant, rarity]);
    parity('car-exact-npc-spawn-source', acquisition.owner, 0, 1, 1, authority);
    lineage.push({ ...acquisition, authority });
  }
  const sourceAudits = audits.filter(row => !used.has('rng_audit:' + row.id)
    && (row.action === 'gta' && row.outcome === 'success' || row.action === 'npc:car' && row.outcome === 'grant'));
  for (const owner of new Set(sourceAudits.map(row => row.character_id))) {
    const matches = sourceAudits.filter(row => row.character_id === owner), cars = added.filter(row => row.character_id === owner && !claimed.has(row.id));
    assert.equal(cars.length, matches.length, `Car grant/boost receipt cardinality differs for ${owner}`);
    assert(nextPeople.has(owner), 'Car source owner is missing');
    if (matches.some(row => row.action === 'npc:car')) assert.equal(nextPeople.get(owner).is_npc, true, 'Resident car grant has non-resident owner');
    const rarity = audits.filter(row => row.character_id === owner && row.action === 'rarity:car' && !used.has('rng_audit:' + row.id));
    assert.equal(rarity.length, cars.length, 'Car rarity receipt cardinality differs');
    for (const receipt of rarity) assert.equal(rollRarity(Number(receipt.roll)), receipt.outcome, 'Car rarity roll/outcome mismatch');
    assert.deepEqual(cars.map(row => row.rarity).sort(), rarity.map(row => row.outcome).sort(), 'Car rarity differs from native audit');
    for (const car of cars) {
      for (const field of ['listed', 'pledged', 'minted_onchain', 'pink_slip']) assert.equal(car[field], false, `New car has unauthorized custody: ${field}`);
      assert.equal(car.race_limit, null); assert.equal(car.plate, null); assert.equal(car.tune, 0); assert.equal(car.nos, 0); claim(car);
    }
    use('rng_audit', [...matches, ...rarity]); const authority = reference('rng_audit', [...matches, ...rarity]);
    parity('car-owner-source-count', owner, 0, cars.length, matches.length, authority);
    lineage.push({ kind: 'owner-source-count-only', owner, observedCarIds: cars.map(row => row.id), authority });
    incomplete('car-acquisition-identity-provenance', owner, cars.map(row => row.id), authority,
      'Receipt binds owner/count/rarity, not car ID, selected model/trim/damage or limited-run allocation; full acquisition lineage remains unsupported');
  }
  const melt = verifySoloCarMelt(before, after, carMeltProvenance);
  if (melt) {
    const car = prior.get(melt.carId), receipt = receipts.find(row => row.id === melt.receiptId);
    assert(car && receipt, 'Exact melt lacks fresh car/receipt');
    claim(car); use('transactions', [receipt]);
    const authority = reference('transactions', [receipt]);
    parity('car-exact-solo-melt-sink', melt.owner, 1, 0, -1, authority);
    lineage.push({ ...melt, authority });
  }
  const sinks = [...audits.filter(row => row.action === 'npc:car' && row.outcome === 'retire').map(row => ({ table: 'rng_audit', row })),
    ...receipts.filter(row => row.currency === 'ammo' && row.reason === 'melt' && row.character_id && !used.has('transactions:' + row.id)).map(row => ({ table: 'transactions', row }))];
  for (const owner of new Set(sinks.map(entry => entry.row.character_id))) {
    const matches = sinks.filter(entry => entry.row.character_id === owner), cars = removed.filter(row => row.character_id === owner && !claimed.has(row.id));
    assert.equal(cars.length, matches.length, `Car melt/retirement receipt cardinality differs for ${owner}`);
    if (matches.some(entry => entry.table === 'rng_audit')) {
      assert.equal(people.get(owner)?.is_npc, true); assert.equal(nextPeople.get(owner)?.alive, false, 'Resident car retirement lacks retired owner');
    }
    for (const entry of matches) { if (entry.table === 'transactions') assert(Number(entry.row.amount) > 0, 'Melt receipt must yield positive ammo'); use(entry.table, [entry.row]); }
    cars.forEach(claim); const authority = matches.flatMap(entry => reference(entry.table, [entry.row]));
    parity('car-owner-sink-count', owner, cars.length, 0, -matches.length, authority);
    lineage.push({ kind: 'owner-sink-count-only', owner, observedCarIds: cars.map(row => row.id), authority });
    incomplete('car-sink-identity-yield-provenance', owner, cars.map(row => row.id), authority,
      'Receipt omits car ID; melt skill/ladder/tithe inputs and exact compound yield are not fully bound. Full sink lineage remains unsupported');
  }
  for (const car of [...added, ...removed, ...changes]) if (!claimed.has(car.id))
    incomplete('car-disposition-unclassified', car.character_id, [car.id], [],
      `No supported identity-bound authority for ${!prior.has(car.id) ? 'creation' : !final.has(car.id) ? 'destruction' : changedFields(car, final.get(car.id)).join(',')}`);
  return { format: 1, checks, lineage, unsupported, fullyClassifiedChanges: lineage.filter(row => !row.kind.endsWith('count-only')).length,
    scope: 'Serial isolated boundary only. Exact basic salvage, market list/cancel custody, source-pinned neutral solo melt and default worker NPC-spawn car; other audit parity is explicitly partial.' };
}
