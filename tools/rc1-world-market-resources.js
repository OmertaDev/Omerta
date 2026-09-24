// Exact public goods/market custody equations. Aggregate requests are observations,
// not an invented sequence of independent commits or price/eligibility decisions.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual as equal } from 'node:util';
import { BLACK_MARKET, GOODS } from '../src/rules.js';
import { exactSum, negate, sha256 } from './rc1-resource-journal.js';
import { actorValueHash } from './rc1-native-actor-replay.js';

const rows = (state, table) => state.tables[table];
const amount = n => exactSum([n]);
const integer = n => { const text = amount(n); assert(/^\d+$/.test(text)); const v = BigInt(text); assert(v <= BigInt(Number.MAX_SAFE_INTEGER)); return v; };
const omit = (row, fields) => Object.fromEntries(Object.entries(row).filter(([field]) => !fields.includes(field)));
const cargoKey = (owner, good) => JSON.stringify([owner, good]);
const marketRoute = path => path === '/v1/goods/buy' || /^\/v1\/market(?:\/order|\/[^/]+\/(?:buy|fill|claim|cancel))?$/.test(path);
const stateHash = ({ boundary, ...state }) => sha256(state);
const sourcePins = {
  'src/market.js': 'ac65c72a32ce85e1e6cb5804a5c76c15e5d8f611ffab84122d6ddade1611fb40',
  'src/economy.js': 'f563ee157adf73627e0c457be43a262151aa9ae92132aa6468ef9b63b285e835',
};
let sourcesChecked = false;
function commands(before, after, identity, evidence) {
  const context = identity?.context || identity || {};
  if (identity?.outcome !== 'QUIESCENT_AGGREGATE') {
    if (identity?.outcome !== 'COMMITTED' || context.method !== 'POST' || !marketRoute(context.path || '')) return [];
    return [{ accountId: context.accountId, request: { method: context.method, path: context.path, body: context.body || {} }, logicalAt: context.logicalAt }];
  }
  if (!evidence || !context.requests?.every(row => row.method === 'POST' && marketRoute(row.path))) return [];
  assert.equal(actorValueHash(identity), actorValueHash(evidence.identity));
  const root = identity.traceRoot, { sha256: rootHash, ...descriptor } = root;
  assert([1, 2].includes(root.format)); assert.equal(rootHash, actorValueHash(descriptor));
  assert.equal(root.beforeHash, stateHash(before)); assert.equal(root.afterHash, stateHash(after));
  assert.equal(root.beforeHash, stateHash(evidence.before)); assert.equal(root.afterHash, stateHash(evidence.after));
  assert.equal(root.requestsSha256, actorValueHash(evidence.requests)); assert.equal(root.requestsSha256, identity.requestsSha256);
  assert.equal(root.outcomesSha256, actorValueHash(evidence.outcomes)); assert.equal(root.traceSha256, actorValueHash(evidence.trace));
  assert.equal(evidence.requests.length, identity.requestCount); assert.equal(evidence.outcomes.length, identity.requestCount);
  assert.equal(context.requests.length, identity.requestCount);
  const result = [], seen = new Set();
  for (const [index, item] of evidence.requests.entries()) {
    assert.deepEqual(context.requests[index], { requestIndex: index, accountId: item.accountId, method: item.request.method,
      path: item.request.path, idempotencyKey: item.request.idempotencyKey || null });
    const outcome = evidence.outcomes[index];
    if (outcome.status !== 'fulfilled' || outcome.value.status !== 200 || outcome.value.replayed) continue;
    assert.equal(outcome.value.replayed, false); assert.equal(outcome.value.body.ok, true);
    assert(!seen.has(item.request.idempotencyKey), 'Duplicate fresh market success'); seen.add(item.request.idempotencyKey);
    result.push({ ...item, logicalAt: context.logicalAt, response: outcome.value.body });
  }
  return result;
}

export function reconcileMarketResources(before, after, { identity = null, receipts = [], quiescentGroupEvidence = null } = {}) {
  const result = { usedReceipts: new Set(), listingIds: new Set(), cargoKeys: new Set(), checks: [], movements: [] };
  const selected = commands(before, after, identity, quiescentGroupEvidence); if (!selected.length) return result;
  if (!sourcesChecked) {
    for (const [file, pin] of Object.entries(sourcePins)) assert.equal(sha256(readFileSync(new URL('../' + file, import.meta.url), 'utf8').replaceAll('\r\n', '\n')), pin, 'Market resource source changed: ' + file);
    sourcesChecked = true;
  }
  const old = new Map(rows(before, 'market_listings').map(row => [row.id, row])), final = new Map(rows(after, 'market_listings').map(row => [row.id, row]));
  const cargoDelta = new Map(), owners = new Set(); let tax = 0n;
  const cargo = (owner, good, change) => { const key = cargoKey(owner, good); cargoDelta.set(key, (cargoDelta.get(key) || 0n) + change); };
  const use = (reason, owner, expected) => {
    const matches = receipts.filter(row => !result.usedReceipts.has(row.id) && row.currency === 'cash' && row.reason === reason
      && row.character_id === owner && row.account_id === null && row.counterparty === null && amount(row.amount) === String(expected)).sort((a, b) => a.id.localeCompare(b.id));
    assert(matches.length > 0, 'Missing exact market receipt: ' + reason); const receipt = matches[0]; result.usedReceipts.add(receipt.id); return receipt;
  };
  const feeFor = (owner, gross) => {
    const matches = receipts.filter(row => !result.usedReceipts.has(row.id) && row.currency === 'cash' && row.reason === 'market:list' && row.character_id === owner);
    assert.equal(matches.length, 1, 'Ambiguous owner listing fee'); const fee = integer(negate(matches[0].amount));
    const maximum = BigInt(Math.max(BLACK_MARKET.LIST_FEE_MIN, Math.ceil(Number(gross) * BLACK_MARKET.LIST_FEE_BPS / 10000)));
    assert(fee >= BigInt(BLACK_MARKET.LIST_FEE_MIN) && fee <= maximum); return { fee, receipt: use('market:list', owner, -fee) };
  };
  const unchanged = (a, b, fields) => { assert(a && b); assert(equal(omit(a, fields), omit(b, fields)), 'Market changed unrelated listing fields'); };
  const add = (movement, command) => {
    for (const id of movement.receiptIds) assert.equal(Date.parse(receipts.find(row => row.id === id).at), command.logicalAt);
    result.movements.push({ ...movement, receiptBinding: identity.outcome === 'QUIESCENT_AGGREGATE' ? 'aggregate-exact-multiset' : 'native-committed-boundary', quoteReconstructed: false });
  };
  for (const command of selected) {
    const { request, logicalAt } = command; assert(Number.isSafeInteger(logicalAt));
    const deltaOnly = before.format === 'retained-native-row-changes';
    const people = rows(before, 'characters').filter(row => row.account_id === command.accountId && (row.alive || deltaOnly && row.identityOnly));
    assert.equal(people.length, 1); const person = people[0], next = rows(after, 'characters').find(row => row.id === person.id);
    assert(next && (next.alive || deltaOnly && next.identityOnly) && next.account_id === person.account_id); const owner = person.id;
    if (request.path === '/v1/market/order') continue; // Existing exact order-funding classifier owns this branch.
    if (request.path === '/v1/goods/buy') {
      const good = request.body.goodId; assert(GOODS.some(row => row.id === good));
      const purchased = receipts.filter(row => row.character_id === owner && row.currency === 'cash' && row.reason === 'goods:buy:' + good);
      if (!purchased.length) continue; assert.equal(purchased.length, 1);
      const qty = integer(Math.max(1, Math.floor(Number(request.body.qty) || 0))), spent = integer(negate(purchased[0].amount));
      const paidTax = (spent + 101n) / 102n, cost = spent - paidTax * 2n;
      assert(qty > 0n && cost > 0n && cost % qty === 0n && (cost + 99n) / 100n === paidTax);
      const receipt = use('goods:buy:' + good, owner, -spent); cargo(owner, good, qty); owners.add(owner); tax += paidTax;
      add({ kind: 'goods-purchase', owner, goodId: good, quantity: String(qty), spent: String(spent), cashDestroyed: String(spent - paidTax), cashToStreetTax: String(paidTax), receiptIds: [receipt.id] }, command); continue;
    }
    if (request.path === '/v1/market') {
      const candidates = [...final.values()].filter(row => !old.has(row.id) && row.seller_character === owner && row.kind === 'good');
      if (!candidates.length) continue; assert.equal(candidates.length, 1); const [listing] = candidates;
      const qty = integer(listing.qty), price = integer(listing.price); assert(qty > 0n && price > 0n);
      assert.equal(listing.good_id, request.body.goodId); assert.equal(Number(qty), Math.floor(Number(request.body.qty))); assert.equal(Number(price), Math.floor(Number(request.body.price)));
      assert.equal(listing.status, 'live'); assert.equal(listing.filled_qty, 0); assert.equal(listing.district, person.loc);
      for (const field of ['car_id', 'bidder', 'bid', 'buy_now', 'reserve']) assert.equal(listing[field], null);
      assert.equal(Date.parse(listing.created_at), logicalAt); assert(Date.parse(listing.expires_at) > logicalAt);
      const { fee, receipt } = feeFor(owner, qty * price); cargo(owner, listing.good_id, -qty); owners.add(owner); result.listingIds.add(listing.id);
      add({ kind: 'market-good-post', listingId: listing.id, owner, goodId: listing.good_id, quantity: String(qty), feeBurned: String(fee), receiptIds: [receipt.id] }, command); continue;
    }
    const match = /^\/v1\/market\/([^/]+)\/(buy|fill|claim|cancel)$/.exec(request.path); assert(match);
    const a = old.get(match[1]), b = final.get(match[1]); if (!a || equal(a, b)) continue;
    if (!['good', 'order'].includes(a.kind)) continue;
    assert(b && !result.listingIds.has(a.id), 'Compound mutation of one listing is outside this bounded market classifier');
    assert(GOODS.some(row => row.id === a.good_id)); assert.equal(a.bidder, null);
    const action = match[2], price = integer(a.price); assert(price > 0n);
    if (action === 'buy' || action === 'fill') {
      assert.equal(a.status, 'live'); assert(Date.parse(a.expires_at) > logicalAt); assert.notEqual(a.seller_character, owner); assert.equal(a.district, person.loc);
      const qty = integer(a.qty) - integer(b.qty); assert(qty > 0n);
      if (request.body.qty != null) assert(qty <= integer(Math.max(1, Math.floor(Number(request.body.qty)))));
      const gross = qty * price, take = (gross * BigInt(BLACK_MARKET.TAKE_BPS) + 9999n) / 10000n, street = take / 2n, net = gross - take;
      const receiptIds = [];
      if (action === 'buy') {
        assert.equal(a.kind, 'good'); unchanged(a, b, ['qty', 'status']); assert.equal(b.status, b.qty === 0 ? 'sold' : 'live');
        const seller = rows(before, 'characters').find(row => row.id === a.seller_character), finalSeller = rows(after, 'characters').find(row => row.id === a.seller_character);
        assert(seller?.alive && finalSeller?.alive && seller.account_id === finalSeller.account_id);
        receiptIds.push(use('market:bid', owner, -gross).id, use('market:sale', a.seller_character, net).id); owners.add(a.seller_character); cargo(owner, a.good_id, qty);
      } else {
        assert.equal(a.kind, 'order'); unchanged(a, b, ['qty', 'filled_qty']); assert.equal(integer(b.filled_qty) - integer(a.filled_qty), qty);
        receiptIds.push(use('market:fill', owner, net).id); cargo(owner, a.good_id, -qty);
      }
      receiptIds.push(use('market:take', null, -take).id); tax += street; owners.add(owner);
      add({ kind: action === 'buy' ? 'market-good-take' : 'market-order-fill', listingId: a.id, owner, counterparty: a.seller_character, goodId: a.good_id,
        quantity: String(qty), gross: String(gross), netToSeller: String(net), cashToStreetTax: String(street), cashDestroyed: String(take - street), receiptIds }, command);
    } else if (action === 'claim') {
      assert.equal(a.kind, 'order'); assert.equal(a.seller_character, owner); if (!person.identityOnly) assert.equal(a.district, person.loc);
      unchanged(a, b, ['filled_qty', 'status']); const qty = integer(a.filled_qty) - integer(b.filled_qty); assert(qty > 0n);
      assert.equal(b.status, a.status === 'live' && a.qty === 0 && b.filled_qty === 0 ? 'sold' : a.status); cargo(owner, a.good_id, qty);
      add({ kind: 'market-order-claim', listingId: a.id, owner, goodId: a.good_id, quantity: String(qty), receiptIds: [] }, command);
    } else {
      assert.equal(a.seller_character, owner); assert(['live', 'expired'].includes(a.status)); assert.equal(b.status, 'cancelled');
      if (a.kind === 'good') {
        unchanged(a, b, ['status']); const qty = integer(a.qty); assert(qty > 0n); cargo(owner, a.good_id, qty);
        add({ kind: 'market-good-return', listingId: a.id, owner, goodId: a.good_id, quantity: String(qty), receiptIds: [] }, command);
      } else {
        unchanged(a, b, ['qty', 'status']); assert.equal(b.qty, 0); const refund = a.status === 'live' ? integer(a.qty) * price : 0n;
        const receiptIds = refund ? [use('market:refund', owner, refund).id] : []; owners.add(owner);
        add({ kind: 'market-order-refund', listingId: a.id, owner, amount: String(refund), retainedFilledQuantity: b.filled_qty, receiptIds }, command);
      }
    }
    result.listingIds.add(a.id);
  }
  if (!result.movements.length) return result;
  for (const [key, expected] of cargoDelta) {
    const [owner, good] = JSON.parse(key), quantity = state => {
      const found = rows(state, 'character_cargo').filter(row => row.character_id === owner && row.good_id === good); assert(found.length <= 1);
      return found.length ? integer(found[0].qty) : 0n;
    };
    assert.equal(quantity(after) - quantity(before), expected, 'Market cargo contribution does not match aggregate endpoints'); result.cargoKeys.add(key);
  }
  for (const owner of owners) {
    const a = rows(before, 'characters').find(row => row.id === owner), b = rows(after, 'characters').find(row => row.id === owner);
    for (const field of ['bank', 'bank_intransit']) assert.equal(amount(a[field] || 0), amount(b[field] || 0));
    assert.equal(exactSum([b.cash, negate(a.cash)]), exactSum(receipts.filter(row => row.character_id === owner && row.currency === 'cash').map(row => row.amount)), 'Market pocket/receipt net differs');
  }
  const aTax = rows(before, 'street_tax'), bTax = rows(after, 'street_tax');
  if (before.format === 'retained-native-row-changes' && !aTax.length && !bTax.length) assert.equal(tax, 0n, 'Unchanged native tax table cannot contain a tax contribution');
  else {
    assert.equal(aTax.length, 1); assert.equal(bTax.length, 1); assert(equal(omit(aTax[0], ['pool']), omit(bTax[0], ['pool'])));
    assert.equal(exactSum([bTax[0].pool, negate(aTax[0].pool)]), String(tax), 'Market aggregate shared tax differs');
  }
  result.checks.push({ kind: 'market-custody-equations', resource: 'cash-and-goods', drift: '0', authority: [
    ...[...result.usedReceipts].map(id => ({ table: 'transactions', id })), ...[...result.listingIds].map(id => ({ table: 'market_listings', id }))],
    listingIds: [...result.listingIds], cargoKeys: [...result.cargoKeys], streetTaxIncrease: String(tax), internalCommitOrder: false });
  return result;
}

// Retained proofs sometimes store exact changed rows instead of another complete
// snapshot. Evaluate only those resource equations; accountInventory supplies
// immutable ID/account joins, never invented balances or historical locations.
// The caller verifies the containing native artifact/history/index bindings.
export function reconcileMarketResourceChanges(changes, { identity, accountInventory }) {
  assert.equal(changes.classification, 'RESTRICTED_RESOURCE_EVIDENCE'); assert.equal(identity.outcome, 'COMMITTED');
  assert.match(changes.beforeHash, /^[a-f0-9]{64}$/); assert.match(changes.afterHash, /^[a-f0-9]{64}$/);
  assert.equal(new Set(changes.tables.map(row => row.table)).size, changes.tables.length);
  const names = ['characters', 'market_listings', 'character_cargo', 'transactions', 'street_tax'];
  const project = side => {
    const tables = Object.fromEntries(names.map(table => [table, structuredClone(changes.tables.find(row => row.table === table)?.[side + 'Rows'] || [])]));
    for (const { id, account_id } of accountInventory) if (!tables.characters.some(row => row.id === id)) tables.characters.push({ id, account_id, identityOnly: true });
    return { format: 'retained-native-row-changes', tables };
  };
  const before = project('before'), after = project('after');
  assert.equal(before.tables.transactions.length, 0, 'Retained append-only receipts cannot be removed');
  const result = reconcileMarketResources(before, after, { identity, receipts: after.tables.transactions });
  return { ...result, stateScope: 'Exact retained native changed rows and immutable character/account identity joins; no full snapshot reconstruction',
    beforeHash: changes.beforeHash, afterHash: changes.afterHash, identityInventorySha256: actorValueHash(accountInventory.map(({ id, account_id }) => ({ id, account_id }))) };
}
