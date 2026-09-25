// Exact resource disposition, not reconstruction of gameplay quotes. Skills,
// territory pricing and decree eligibility remain native command-proof scope.
import assert from 'node:assert/strict';
import { isDeepStrictEqual as equal } from 'node:util';
import { BLACK_MARKET, GOODS, M3 } from '../src/rules.js';
import { exactSum, negate } from './rc1-resource-journal.js';
const rows = (state, table) => state.tables[table];
const value = amount => exactSum([amount]);
const integer = amount => { const n = value(amount); assert(/^\d+$/.test(n)); const result = BigInt(n); assert(result <= BigInt(Number.MAX_SAFE_INTEGER)); return result; };
const delta = (a, b) => exactSum([b, negate(a)]);
const omit = (row, fields) => Object.fromEntries(Object.entries(row).filter(([key]) => !fields.includes(key)));
const indexed = (values, key = row => row.id) => { const result = new Map(values.map(row => [key(row), row])); assert.equal(result.size, values.length); return result; };
const changed = (a, b) => [...new Set([...a.keys(), ...b.keys()])].filter(id => !equal(a.get(id), b.get(id)));
const resultOf = () => ({ usedReceipts: new Set(), listingIds: new Set(), districtFields: new Map(), bidDistricts: new Set(), familyFields: new Map(), checks: [], movements: [] });

export function reconcileOrderResources(before, after, { identity = null, receipts = [] } = {}) {
  const result = resultOf(), context = identity?.context || identity || {};
  const old = indexed(rows(before, 'market_listings')), next = indexed(rows(after, 'market_listings'));
  const changes = changed(old, next), people = indexed(rows(before, 'characters')), finalPeople = indexed(rows(after, 'characters'));
  const use = (predicate, label) => {
    const found = receipts.filter(row => !result.usedReceipts.has(row.id) && predicate(row));
    assert.equal(found.length, 1, 'Missing/ambiguous order receipt: ' + label); result.usedReceipts.add(found[0].id); return found[0];
  };
  const cash = (row, reason, owner, amount, counterparty = null) => row.currency === 'cash' && row.reason === reason && row.character_id === owner
    && row.account_id === null && row.counterparty === counterparty && value(row.amount) === amount;
  if (changes.length === 1 && !old.has(changes[0]) && context.method === 'POST' && (context.path || context.url) === '/v1/market/order') {
    const order = next.get(changes[0]), person = people.get(order.seller_character), final = finalPeople.get(order.seller_character);
    if (order.kind !== 'order' || !person || person.is_npc || receipts.length !== 2) return result;
    assert(person.alive && final?.alive && final.account_id === person.account_id);
    if (context.accountId) assert.equal(context.accountId, person.account_id);
    assert.equal(order.status, 'live'); assert.equal(order.filled_qty, 0); assert.equal(order.district, person.loc);
    assert(GOODS.some(row => row.id === order.good_id));
    for (const field of ['car_id', 'bidder', 'bid', 'buy_now', 'reserve']) assert.equal(order[field], null);
    assert.deepEqual(Object.keys(order).sort(), ['id','seller_character','kind','car_id','good_id','qty','district','price','buy_now','bid','bidder','status','created_at','expires_at','reserve','filled_qty'].sort());
    const qty = integer(order.qty), unit = integer(order.price), held = qty * unit;
    assert(qty > 0n && qty <= BigInt(BLACK_MARKET.ORDER_MAX_QTY) && unit > 0n && held <= BigInt(Number.MAX_SAFE_INTEGER) && held >= BigInt(BLACK_MARKET.MIN_PRICE));
    assert.equal(Date.parse(order.created_at), context.logicalAt); assert(Date.parse(order.expires_at) > context.logicalAt);
    const request = context.body || context.payload;
    if (request) { assert.equal(order.good_id, request.goodId); assert.equal(Number(qty), Math.floor(Number(request.qty))); assert.equal(Number(unit), Math.floor(Number(request.price))); }
    const principal = use(row => cash(row, 'market:order', person.id, String(-held)), 'principal');
    const fees = receipts.filter(row => row.reason === 'market:list'); assert.equal(fees.length, 1);
    const fee = integer(negate(fees[0].amount));
    assert(fee >= BigInt(BLACK_MARKET.LIST_FEE_MIN) && fee <= BigInt(Math.max(BLACK_MARKET.LIST_FEE_MIN, Math.ceil(Number(held) * BLACK_MARKET.LIST_FEE_BPS / 10000))), 'Listing fee outside authored discount bounds');
    const feeReceipt = use(row => cash(row, 'market:list', person.id, String(-fee)), 'fee');
    assert(integer(person.cash) >= held + fee); integer(final.cash);
    assert.equal(receipts.length, 2, 'Compound order placement receipts');
    for (const row of [principal, feeReceipt]) assert.equal(Date.parse(row.at), context.logicalAt);
    assert.equal(delta(person.cash, final.cash), String(-held - fee));
    for (const field of ['bank', 'bank_intransit', 'ammo', 'cb']) assert.equal(value(person[field] || 0), value(final[field] || 0));
    result.listingIds.add(order.id);
    result.movements.push({ kind: 'player-order-funding', listingId: order.id, owner: person.id, held: String(held), feeBurned: String(fee), receiptIds: [principal.id, feeReceipt.id], quoteReconstructed: false });
  }

  // One isolated unfilled buy order at a player fire death, with a zero-bank
  // pocket leg. Matching receipt multisets prove custody, not their commit order.
  const victims = [...people.values()].filter(row => row.alive && finalPeople.get(row.id)?.alive === false);
  if (victims.length === 1 && changes.length === 1 && old.has(changes[0]) && !next.has(changes[0])) {
    const [victim] = victims, order = old.get(changes[0]);
    if (order.kind !== 'order' || order.status !== 'live' || order.seller_character !== victim.id || order.filled_qty !== 0
      || value(victim.bank) !== '0' || value(victim.bank_intransit || 0) !== '0') return result;
    const debits = receipts.filter(row => row.currency === 'cash' && row.reason === 'whack:loot' && row.character_id === victim.id);
    if (debits.length !== 1) return result;
    const [debit] = debits, killer = people.get(debit.counterparty), finalKiller = finalPeople.get(debit.counterparty);
    if (receipts.filter(row => row.currency === 'cash' && row.reason === 'whack:loot' && row.character_id === killer?.id).length !== 2) return result;
    assert(killer?.alive && finalKiller?.alive && !killer.is_npc && killer.id !== victim.id && killer.account_id === finalKiller.account_id);
    const pocketLoot = integer(negate(debit.amount)), principal = integer(order.qty) * integer(order.price);
    assert(pocketLoot > 0n && pocketLoot <= integer(victim.cash) / 2n && principal > 0n);
    use(row => cash(row, 'whack:loot', victim.id, String(-pocketLoot), killer.id), 'pocket debit');
    const escrowDebit = receipts.filter(row => row.currency === 'cash' && row.reason === 'market:loot');
    assert.equal(escrowDebit.length, 1); const escrowLoot = integer(negate(escrowDebit[0].amount));
    assert(escrowLoot > 0n && escrowLoot <= principal / 2n);
    use(row => cash(row, 'market:loot', null, String(-escrowLoot), victim.id), 'escrow debit');
    use(row => cash(row, 'market:death', null, String(-(principal - escrowLoot)), victim.id), 'escrow burn');
    const credits = receipts.filter(row => row.currency === 'cash' && row.reason === 'whack:loot' && row.character_id === killer.id);
    assert.equal(credits.length, 2, 'Death needs pocket and escrow credits');
    assert.deepEqual(credits.map(row => value(row.amount)).sort(), [String(pocketLoot), String(escrowLoot)].sort(), 'Death cash credits do not match source multiset');
    for (const credit of credits) { assert.equal(credit.counterparty, victim.id); assert.equal(credit.account_id, null); result.usedReceipts.add(credit.id); }
    assert.equal(delta(killer.cash, finalKiller.cash), String(pocketLoot + escrowLoot));
    assert.equal(value(killer.bank), value(finalKiller.bank));
    const corpse = finalPeople.get(victim.id); assert.equal(value(corpse.cash), '0'); assert.equal(value(corpse.bank), '0');
    const estate = receipts.filter(row => row.currency === 'cash' && row.reason === 'death:estate' && row.character_id === victim.id);
    assert.equal(estate.length, 1); assert.equal(value(estate[0].amount), String(-(integer(victim.cash) - pocketLoot)));
    const fire = receipts.filter(row => row.reason === 'fire' && row.currency === 'ammo' && row.character_id === killer.id);
    assert.equal(fire.length, 1); assert(Number(fire[0].amount) < 0);
    for (const row of receipts.filter(row => result.usedReceipts.has(row.id))) assert.equal(row.at, debit.at, 'Death receipt crossed boundary time');
    result.listingIds.add(order.id);
    result.movements.push({ kind: 'player-death-order-and-pocket', listingId: order.id, source: victim.id, destination: killer.id,
      escrowLoot: String(escrowLoot), escrowBurn: String(principal - escrowLoot), pocketLoot: String(pocketLoot),
      receiptIds: [...result.usedReceipts], quoteReconstructed: false });
  }
  for (const movement of result.movements) result.checks.push({ kind: movement.kind, resource: 'cash', drift: '0', authority: movement.receiptIds.map(id => ({ table: 'transactions', id })) });
  return result;
}

export function reconcileTurfFunding(before, after, { receipts = [] } = {}) {
  const result = resultOf(), stakes = receipts.filter(row => row.currency === 'cash' && row.reason === 'turf:claim');
  const seizures = receipts.filter(row => row.currency === 'cash' && /^turf:seize:[^:]+$/.test(row.reason));
  if (!stakes.length && !seizures.length) return result;
  if ((stakes.length && seizures.length) || seizures.length > 1 || receipts.length !== stakes.length + seizures.length) return result;
  const families = indexed(rows(before, 'gangs')), finalFamilies = indexed(rows(after, 'gangs'));
  const districts = indexed(rows(before, 'districts')), finalDistricts = indexed(rows(after, 'districts'));
  const key = row => row.district_id + '/' + row.gang_id;
  const bids = indexed(rows(before, 'district_bids'), key), finalBids = indexed(rows(after, 'district_bids'), key);
  const changedBids = changed(bids, finalBids), treasury = new Map();
  const pay = receipt => {
    assert.equal(receipt.character_id, null); assert.equal(receipt.account_id, null);
    const old = families.get(receipt.counterparty), next = finalFamilies.get(receipt.counterparty); assert(old && next);
    assert.equal(old.charter, null); assert.equal(next.charter, null);
    const amount = integer(negate(receipt.amount)); assert(amount > 0n);
    assert(!treasury.has(old.id), 'Multiple funding receipts for one Family need finer boundaries'); treasury.set(old.id, String(-amount));
    result.usedReceipts.add(receipt.id); return amount;
  };
  if (seizures.length) {
    const [receipt] = seizures, id = receipt.reason.slice('turf:seize:'.length), old = districts.get(id), next = finalDistricts.get(id);
    if (!old || !next || old.holder_gang || old.npc_holder || old.contest_until) return result;
    const amount = pay(receipt); assert.equal(changedBids.length, 0);
    assert.equal(next.holder_gang, receipt.counterparty); assert.equal(next.npc_holder, null); assert.equal(next.watch_hour, null);
    assert.equal(value(next.garrison), String(M3.SEIZE_BASE)); assert.equal(next.seized_at, receipt.at);
    const fields = ['holder_gang', 'npc_holder', 'watch_hour', 'garrison', 'seized_at'];
    assert(equal(omit(old, fields), omit(next, fields))); assert.deepEqual(changed(districts, finalDistricts), [id]);
    result.districtFields.set(id, new Set(fields));
    result.movements.push({ kind: 'unoccupied-turf-cash-sink', districtId: id, familyId: receipt.counterparty, burned: String(amount), receiptIds: [receipt.id], quoteReconstructed: false });
  } else {
    const affected = changedBids.map(id => finalBids.get(id));
    if (affected.some(row => !row) || new Set(affected.map(row => row.district_id)).size !== 1) return result;
    assert.equal(affected.length, stakes.length); const districtId = affected[0].district_id;
    const old = districts.get(districtId), next = finalDistricts.get(districtId); assert(old?.holder_gang && next);
    assert(equal(omit(old, ['contest_until']), omit(next, ['contest_until'])));
    const at = new Set(stakes.map(row => row.at)); assert.equal(at.size, 1); const openedAt = Date.parse([...at][0]);
    assert(Number.isFinite(openedAt) && Date.parse(next.contest_until) > openedAt);
    if (old.contest_until) assert.equal(next.contest_until, old.contest_until, 'Stake changed an open contest deadline');
    for (const bid of affected) {
      const prior = bids.get(key(bid)), amount = delta(prior?.amount || 0, bid.amount); assert(integer(amount) > 0n);
      assert.deepEqual(Object.keys(bid).sort(), ['amount','at','district_id','gang_id']); assert.equal(Date.parse(bid.at), openedAt);
      const matches = stakes.filter(row => row.counterparty === bid.gang_id && value(row.amount) === negate(amount));
      assert.equal(matches.length, 1, 'Turf escrow owner/amount lacks exact funding receipt'); const [receipt] = matches; pay(receipt);
      result.movements.push({ kind: 'turf-stake-funding', districtId, familyId: bid.gang_id, amount, before: value(prior?.amount || 0), after: value(bid.amount), receiptIds: [receipt.id], quoteReconstructed: false });
    }
    assert(changed(districts, finalDistricts).every(id => id === districtId));
    result.bidDistricts.add(districtId); result.districtFields.set(districtId, new Set(['contest_until']));
  }
  for (const id of new Set([...families.keys(), ...finalFamilies.keys()])) {
    const old = families.get(id), next = finalFamilies.get(id); assert(old && next);
    integer(old.treasury); integer(next.treasury);
    assert(equal(omit(old, ['treasury']), omit(next, ['treasury'])), 'Turf funding changed another Family field');
    assert.equal(delta(old.treasury, next.treasury), treasury.get(id) || '0', 'Turf funding treasury endpoint differs');
    if (treasury.has(id)) result.familyFields.set(id, new Set(['treasury']));
  }
  for (const movement of result.movements) result.checks.push({ kind: movement.kind, resource: 'cash', drift: '0', authority: movement.receiptIds.map(id => ({ table: 'transactions', id })) });
  return result;
}
