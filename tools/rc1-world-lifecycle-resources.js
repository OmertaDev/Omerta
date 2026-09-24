// Read-only custody classification. Route authorization and random combat outcomes
// remain the responsibility of the canonical command/native proofs.
import assert from 'node:assert/strict';
import { isDeepStrictEqual as equal } from 'node:util';
import { LAW, M3 } from '../src/rules.js';
import { exactSum, negate } from './rc1-resource-journal.js';

const rows = (state, table) => state.tables[table];
const value = amount => exactSum([amount]);
const omit = (row, fields) => Object.fromEntries(Object.entries(row).filter(([key]) => !fields.includes(key)));
const delta = (a, b) => exactSum([b, negate(a)]);
const index = values => new Map(values.map(row => [row.character_id, row]));
const contextOf = identity => identity?.context || identity || {};
const integer = amount => { const result = value(amount); assert(/^\d+$/.test(result), 'Nonnegative integer resource required'); return BigInt(result); };

export function reconcileMembershipResources(before, after, { identity = null, receipts = [] } = {}) {
  const result = { memberIds: new Set(), familyFields: new Map(), movements: [] };
  const a = index(rows(before, 'gang_members')), b = index(rows(after, 'gang_members'));
  const changed = [...new Set([...a.keys(), ...b.keys()])].filter(id => !equal(a.get(id), b.get(id)));
  if (!changed.length) return result;
  const context = contextOf(identity), route = context.path || context.url;
  if (context.method !== 'POST' || !route || receipts.length) return result;
  if (changed.some(id => a.has(id) && !rows(after, 'gangs').some(row => row.id === a.get(id).gang_id))) return result;
  const family = id => {
    const old = rows(before, 'gangs').find(row => row.id === id), next = rows(after, 'gangs').find(row => row.id === id);
    assert(old && next, 'Membership custody requires a surviving Family');
    assert(equal(omit(old, ['npc_flag']), omit(next, ['npc_flag'])), 'Membership changed Family resource fields');
    return [old, next];
  };
  const owner = id => {
    const old = rows(before, 'characters').find(row => row.id === id), next = rows(after, 'characters').find(row => row.id === id);
    assert(old?.alive && next?.alive && old.account_id === next.account_id, 'Membership lacks the same living owner');
    for (const field of ['cash', 'bank', 'bank_intransit', 'ammo', 'cb']) assert.equal(value(old[field] || 0), value(next[field] || 0), 'Membership changed personal custody: ' + field);
    return old;
  };
  const joined = route.match(/^\/v1\/gangs\/([^/]+)\/join$/);
  if (joined) {
    assert.equal(changed.length, 1, 'Compound membership join');
    const id = changed[0], next = b.get(id); assert(!a.has(id) && next, 'Join must add one member');
    assert.equal(next.gang_id, joined[1]); assert.equal(next.role, 'soldier');
    assert.equal(next.post, null); assert.equal(next.post_at, null);
    assert.deepEqual(Object.keys(next).sort(), ['character_id', 'gang_id', 'joined_at', 'post', 'post_at', 'role']);
    assert.equal(Date.parse(next.joined_at), context.logicalAt, 'Join timestamp lacks the observed boundary');
    const person = owner(id); if (context.accountId) assert.equal(context.accountId, person.account_id);
    const [old, final] = family(next.gang_id); assert(equal(old, final), 'Join changed Family metadata');
    assert([...a.values()].filter(row => row.gang_id === next.gang_id).length < M3.GANG_MAX_MEMBERS);
    result.memberIds.add(id); result.movements.push({ kind: 'family-join', familyId: next.gang_id, characterId: id, economicGrant: false });
  } else if (route === '/v1/gangs/promote') {
    assert.equal(changed.length, 1, 'Compound promotion');
    const id = changed[0], old = a.get(id), next = b.get(id);
    assert(old && next && old.role !== 'boss' && ['soldier', 'capo', 'underboss'].includes(next.role));
    assert(equal(omit(old, ['role']), omit(next, ['role'])), 'Promotion changed non-role membership fields');
    owner(id); const [prior, final] = family(old.gang_id); assert(equal(prior, final));
    assert.equal([...b.values()].filter(row => row.gang_id === old.gang_id && row.role === 'boss').length, 1);
    assert([...b.values()].filter(row => row.gang_id === old.gang_id && row.role === 'underboss').length <= 1);
    result.memberIds.add(id); result.movements.push({ kind: 'family-role', familyId: old.gang_id, characterId: id, from: old.role, to: next.role, economicGrant: false });
  } else if (route === '/v1/gangs/leave' || route === '/v1/gangs/kick') {
    const removed = changed.filter(id => a.has(id) && !b.has(id)); assert.equal(removed.length, 1, 'Departure must remove one member');
    const id = removed[0], departed = a.get(id), person = owner(id), [oldFamily, nextFamily] = family(departed.gang_id);
    if (route.endsWith('/leave') && context.accountId) assert.equal(context.accountId, person.account_id);
    if (route.endsWith('/kick')) assert.notEqual(departed.role, 'boss');
    const remaining = [...a.values()].filter(row => row.gang_id === departed.gang_id && row.character_id !== id);
    assert(remaining.length, 'Dissolution is not a zero-resource membership transition');
    const promotions = changed.filter(other => other !== id);
    if (departed.role === 'boss') {
      const rank = role => role === 'underboss' ? 0 : role === 'capo' ? 1 : 2;
      remaining.sort((x, y) => rank(x.role) - rank(y.role) || x.character_id.localeCompare(y.character_id));
      assert.deepEqual(promotions, [remaining[0].character_id], 'Departure selected the wrong successor');
      const successor = a.get(promotions[0]), next = b.get(promotions[0]); owner(promotions[0]);
      assert(equal(next, { ...successor, role: 'boss' }), 'Succession changed unrelated membership fields');
      const character = rows(before, 'characters').find(row => row.id === successor.character_id);
      assert.equal(nextFamily.npc_flag, character.is_npc ?? oldFamily.npc_flag);
      result.familyFields.set(oldFamily.id, new Set(['npc_flag']));
    } else { assert.equal(promotions.length, 0); assert(equal(oldFamily, nextFamily)); }
    for (const changedId of changed) result.memberIds.add(changedId);
    result.movements.push({ kind: 'family-departure', familyId: departed.gang_id, characterId: id, successor: promotions[0] || null, economicGrant: false });
  }
  return result;
}

export function reconcileLifecycleCash(before, after, { identity = null, receipts = [] } = {}) {
  const result = { usedReceipts: new Set(), bankOwners: new Set(), checks: [], movements: [] };
  const person = (state, id) => { const matches = rows(state, 'characters').filter(row => row.id === id); assert.equal(matches.length, 1); return matches[0]; };
  const context = contextOf(identity);
  const claim = row => { assert(!result.usedReceipts.has(row.id), 'Receipt reused'); result.usedReceipts.add(row.id); };
  for (const incoming of receipts.filter(row => row.currency === 'cash' && row.reason === 'jump:steal')) {
    assert(incoming.character_id && incoming.counterparty && incoming.character_id !== incoming.counterparty && incoming.account_id === null);
    const amount = integer(incoming.amount); assert(amount > 0n && amount <= BigInt(M3.JUMP_STEAL_CAP));
    const matching = receipts.filter(row => row.currency === 'cash' && row.reason === 'jump:stolen'
      && row.character_id === incoming.counterparty && row.counterparty === incoming.character_id && row.account_id === null
      && value(row.amount) === String(-amount) && row.at === incoming.at);
    assert.equal(matching.length, 1, 'Jump transfer lacks one exact reciprocal receipt');
    for (const id of [incoming.character_id, incoming.counterparty]) {
      const old = person(before, id), next = person(after, id); assert(old.alive && next.alive && old.account_id === next.account_id);
      assert.equal(value(old.bank), value(next.bank), 'Jump diverted bank custody');
      const owned = receipts.filter(row => row.currency === 'cash' && row.character_id === id);
      assert.equal(owned.length, 1, 'Compound jump cash boundary');
      assert.equal(delta(old.cash, next.cash), value(owned[0].amount), 'Jump pocket endpoint differs');
    }
    claim(incoming); claim(matching[0]);
    result.movements.push({ kind: 'jump-cash-transfer', source: incoming.counterparty, destination: incoming.character_id, amount: String(amount), receiptIds: [incoming.id, matching[0].id] });
  }
  if (receipts.some(row => row.currency === 'cash' && row.reason === 'jump:steal'))
    for (const row of receipts.filter(row => row.currency === 'cash' && row.reason === 'jump:stolen')) assert(result.usedReceipts.has(row.id), 'Orphan jump debit');
  const pleas = receipts.filter(row => row.currency === 'cash' && row.reason === 'law:plea');
  if (pleas.length) {
    assert.equal(pleas.length, 1, 'Compound plea receipts'); assert.equal(receipts.length, 1, 'Compound plea boundary');
    const receipt = pleas[0], old = person(before, receipt.character_id), next = person(after, receipt.character_id);
    assert(old.alive && next.alive && old.account_id === next.account_id && old.indicted_at);
    assert.equal(receipt.account_id, null); assert.equal(receipt.counterparty, null);
    const want = Math.floor((Number(old.cash) + Number(old.bank)) * LAW.PLEA_FORFEIT_RATE);
    const pocket = Math.min(want, Math.floor(Number(old.cash))), bank = Math.min(want - pocket, Math.floor(Number(old.bank))), total = pocket + bank;
    assert(Number.isSafeInteger(total) && total > 0);
    assert.equal(value(receipt.amount), String(-total));
    assert.equal(delta(old.cash, next.cash), String(-pocket)); assert.equal(delta(old.bank, next.bank), String(-bank));
    assert.equal(value(next.bank_intransit || 0), value(Math.min(Number(old.bank_intransit || 0), Number(next.bank))));
    assert.equal(next.indicted_at, null); assert.equal(value(next.heat_exposure), '0'); assert.equal(next.jury_bought, false);
    assert.equal(Date.parse(next.jail_until), Date.parse(receipt.at) + LAW.PLEA_JAIL_S * 1000);
    if (context.logicalAt != null) assert.equal(Date.parse(receipt.at), context.logicalAt);
    const tax = rows(before, 'street_tax'), nextTax = rows(after, 'street_tax'); assert.equal(tax.length, 1); assert.equal(nextTax.length, 1);
    assert(equal(omit(tax[0], ['pool']), omit(nextTax[0], ['pool'])));
    assert.equal(delta(tax[0].pool, nextTax[0].pool), String(total), 'Plea funds failed to reach confiscation pool');
    claim(receipt); result.bankOwners.add(old.id);
    result.movements.push({ kind: 'law-plea-transfer', source: old.id, destination: 'street_tax.pool', amount: String(total), receiptIds: [receipt.id] });
  }
  for (const movement of result.movements) result.checks.push({ kind: movement.kind, resource: 'cash', drift: '0', authority: movement.receiptIds.map(id => ({ table: 'transactions', id })) });
  return result;
}

export function reconcileOrderExpiry(before, after, { identity = null, receipts = [] } = {}) {
  const result = { listingIds: new Set(), usedReceipts: new Set(), checks: [], movements: [] };
  const context = contextOf(identity);
  if (context.authority !== 'original-worker' || !Number.isSafeInteger(context.logicalAt)) return result;
  const old = new Map(rows(before, 'market_listings').map(row => [row.id, row]));
  const final = new Map(rows(after, 'market_listings').map(row => [row.id, row]));
  const changed = [...new Set([...old.keys(), ...final.keys()])].filter(id => !equal(old.get(id), final.get(id)));
  if (changed.length !== 1) return result;
  const id = changed[0], a = old.get(id), b = final.get(id);
  if (a?.kind !== 'order' || a.status !== 'live' || b?.status !== 'expired') return result;
  assert.equal(identity.outcome, 'COMMITTED'); assert.equal(identity.command, 'COMMIT');
  assert.equal(b.qty, 0); assert(equal(omit(a, ['qty', 'status']), omit(b, ['qty', 'status'])), 'Expiry rewrote another order field');
  assert(Date.parse(a.expires_at) <= context.logicalAt, 'Order refunded before its deadline');
  const held = integer(a.qty) * integer(a.price); assert(held > 0n, 'Zero remaining order is outside this refund subset');
  const people = rows(before, 'characters').filter(row => row.id === a.seller_character);
  const nextPeople = rows(after, 'characters').filter(row => row.id === a.seller_character);
  assert.equal(people.length, 1); assert.equal(nextPeople.length, 1);
  const [person] = people, [next] = nextPeople; assert(person.alive && next.alive, 'Dead owner is outside living order refund scope');
  assert(equal(omit(person, ['cash']), omit(next, ['cash'])), 'Expiry changed another owner field');
  assert.equal(delta(person.cash, next.cash), String(held), 'Order escrow did not reach the living owner pocket');
  assert.equal(receipts.length, 1, 'Compound expiry receipt boundary');
  const [receipt] = receipts;
  assert.equal(receipt.reason, 'market:refund'); assert.equal(receipt.currency, 'cash'); assert.equal(receipt.character_id, person.id);
  assert.equal(receipt.account_id, null); assert.equal(receipt.counterparty, null); assert.equal(value(receipt.amount), String(held));
  assert.equal(Date.parse(receipt.at), context.logicalAt);
  for (const table of Object.keys(before.tables)) {
    if (['transactions', 'market_listings', 'notifications'].includes(table)) continue;
    const aRows = table === 'characters' ? rows(before, table).filter(row => row.id !== person.id) : rows(before, table);
    const bRows = table === 'characters' ? rows(after, table).filter(row => row.id !== person.id) : rows(after, table);
    assert(equal(aRows, bRows), 'Expiry compound resource change: ' + table);
  }
  result.listingIds.add(id); result.usedReceipts.add(receipt.id);
  result.movements.push({ kind: 'market-order-expiry-refund', listingId: id, owner: person.id, amount: String(held), receiptId: receipt.id, retainedFilledQuantity: b.filled_qty });
  result.checks.push({ kind: 'market-order-expiry-refund', resource: 'cash', owner: person.id, escrowBefore: String(held), escrowAfter: '0', personalDelta: String(held), drift: '0', authority: [{ table: 'market_listings', id }, { table: 'transactions', id: receipt.id }] });
  return result;
}
