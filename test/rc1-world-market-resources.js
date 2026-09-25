import assert from 'node:assert/strict';
import { reconcileMarketResources, reconcileMarketResourceChanges } from '../tools/rc1-world-market-resources.js';
import { actorValueHash } from '../tools/rc1-native-actor-replay.js';
import { sha256 } from '../tools/rc1-resource-journal.js';

const at = '2026-09-23T23:00:00.000Z', logicalAt = Date.parse(at), clone = structuredClone;
const person = id => ({ id, account_id: 'account-' + id, alive: true, loc: 'docks', cash: '1000', bank: '0', bank_intransit: '0' });
const state = () => ({ format: 1, tables: { characters: ['a', 'b', 'c', 'd'].map(person), market_listings: [], character_cargo: [], transactions: [], street_tax: [{ id: 1, pool: '0', fund: '0' }] } });
const listing = (id, kind = 'good', owner = 'a') => ({ id, seller_character: owner, kind, car_id: null, good_id: 'gin', qty: 1, district: 'docks',
  price: '50', buy_now: null, bid: null, bidder: null, status: 'live', created_at: at, expires_at: '2026-09-24T00:00:00.000Z', reserve: null, filled_qty: 0 });
const cargo = (owner, qty) => ({ character_id: owner, good_id: 'gin', qty });
const receipt = (id, owner, value, reason) => ({ id, character_id: owner, account_id: null, currency: 'cash', amount: String(value), reason, counterparty: null, at });
const identity = (owner, path, body = {}) => ({ outcome: 'COMMITTED', command: 'COMMIT', context: { accountId: 'account-' + owner, method: 'POST', path, body, logicalAt } });
const cases = [], controls = [];
function run(name, before, after, event, kind) {
  const result = reconcileMarketResources(before, after, { identity: event, receipts: after.tables.transactions });
  assert.equal(result.movements.length, 1); assert.equal(result.movements[0].kind, kind);
  const item = { name, before, after, identity: event }; cases.push(item); return item;
}
function corrupt(item, name, edit) {
  const copy = clone(item); edit(copy.before, copy.after, copy.identity);
  assert.throws(() => reconcileMarketResources(copy.before, copy.after, { identity: copy.identity, receipts: copy.after.tables.transactions }), undefined, name); controls.push(name);
}
const purchaseBefore = state(), purchaseAfter = clone(purchaseBefore);
purchaseAfter.tables.character_cargo = [cargo('a', 2)]; purchaseAfter.tables.characters[0].cash = '796'; purchaseAfter.tables.street_tax[0].pool = '2';
purchaseAfter.tables.transactions = [receipt('purchase', 'a', -204, 'goods:buy:gin')];
const purchase = run('purchase', purchaseBefore, purchaseAfter, identity('a', '/v1/goods/buy', { goodId: 'gin', qty: 2 }), 'goods-purchase');
corrupt(purchase, 'purchase-extra-goods', (_, b) => { b.tables.character_cargo[0].qty = 3; });
corrupt(purchase, 'purchase-diverted-tax', (_, b) => { b.tables.street_tax[0].pool = '1'; });
corrupt(purchase, 'purchase-wrong-cash', (_, b) => { b.tables.characters[0].cash = '797'; });
const postBefore = state(); postBefore.tables.character_cargo = [cargo('a', 2)]; const postAfter = clone(postBefore);
postAfter.tables.character_cargo[0].qty = 1; postAfter.tables.characters[0].cash = '990'; postAfter.tables.market_listings = [listing('sale')];
postAfter.tables.transactions = [receipt('fee', 'a', -10, 'market:list')];
const post = run('post', postBefore, postAfter, identity('a', '/v1/market', { goodId: 'gin', qty: 1, price: 50 }), 'market-good-post');
corrupt(post, 'post-did-not-escrow-cargo', (_, b) => { b.tables.character_cargo[0].qty = 2; });
corrupt(post, 'post-diverted-fee', (_, b) => { b.tables.transactions[0].counterparty = 'b'; });
corrupt(post, 'post-hidden-price', (_, b) => { b.tables.market_listings[0].price = '51'; });
const takeBefore = state(); takeBefore.tables.market_listings = [listing('sale')]; const takeAfter = clone(takeBefore);
Object.assign(takeAfter.tables.market_listings[0], { qty: 0, status: 'sold' }); takeAfter.tables.character_cargo = [cargo('b', 1)];
takeAfter.tables.characters[0].cash = '1049'; takeAfter.tables.characters[1].cash = '950';
takeAfter.tables.transactions = [receipt('bid', 'b', -50, 'market:bid'), receipt('sale', 'a', 49, 'market:sale'), receipt('take', null, -1, 'market:take')];
const take = run('take', takeBefore, takeAfter, identity('b', '/v1/market/sale/buy', { qty: 1 }), 'market-good-take');
corrupt(take, 'take-wrong-winner', (_, b) => { b.tables.character_cargo[0].character_id = 'd'; });
corrupt(take, 'take-wrong-seller', (_, b) => { b.tables.transactions[1].character_id = 'd'; });
corrupt(take, 'take-missing-house-leg', (_, b) => { b.tables.transactions.pop(); });
const fillBefore = state(); fillBefore.tables.market_listings = [listing('order', 'order')]; fillBefore.tables.character_cargo = [cargo('b', 1)];
const fillAfter = clone(fillBefore); Object.assign(fillAfter.tables.market_listings[0], { qty: 0, filled_qty: 1 }); fillAfter.tables.character_cargo = [];
fillAfter.tables.characters[1].cash = '1049'; fillAfter.tables.transactions = [receipt('fill', 'b', 49, 'market:fill'), receipt('take', null, -1, 'market:take')];
const fill = run('fill', fillBefore, fillAfter, identity('b', '/v1/market/order/fill', { qty: 1 }), 'market-order-fill');
corrupt(fill, 'fill-lost-warehouse-cargo', (_, b) => { b.tables.market_listings[0].filled_qty = 0; });
corrupt(fill, 'fill-unfunded-extra-unit', (_, b) => { b.tables.market_listings[0].filled_qty = 2; });
corrupt(fill, 'fill-moved-owner', (_, b) => { b.tables.market_listings[0].seller_character = 'd'; });
const claimBefore = clone(fillAfter); claimBefore.tables.transactions = []; const claimAfter = clone(claimBefore);
Object.assign(claimAfter.tables.market_listings[0], { filled_qty: 0, status: 'sold' }); claimAfter.tables.character_cargo = [cargo('a', 1)];
const claim = run('claim', claimBefore, claimAfter, identity('a', '/v1/market/order/claim'), 'market-order-claim');
corrupt(claim, 'claim-to-wrong-owner', (_, b) => { b.tables.character_cargo[0].character_id = 'b'; });
corrupt(claim, 'claim-leaves-warehouse-copy', (_, b) => { b.tables.market_listings[0].filled_qty = 1; });
const returnBefore = state(); returnBefore.tables.market_listings = [listing('sale')]; const returnAfter = clone(returnBefore);
returnAfter.tables.market_listings[0].status = 'cancelled'; returnAfter.tables.character_cargo = [cargo('a', 1)];
const returned = run('return', returnBefore, returnAfter, identity('a', '/v1/market/sale/cancel'), 'market-good-return');
corrupt(returned, 'return-duplicate-unit', (_, b) => { b.tables.character_cargo[0].qty = 2; });
const refundBefore = state(); refundBefore.tables.market_listings = [{ ...listing('order', 'order'), qty: 2 }]; const refundAfter = clone(refundBefore);
Object.assign(refundAfter.tables.market_listings[0], { qty: 0, status: 'cancelled' }); refundAfter.tables.characters[0].cash = '1100';
refundAfter.tables.transactions = [receipt('refund', 'a', 100, 'market:refund')];
const refund = run('refund', refundBefore, refundAfter, identity('a', '/v1/market/order/cancel'), 'market-order-refund');
corrupt(refund, 'refund-too-much', (_, b) => { b.tables.transactions[0].amount = '101'; b.tables.characters[0].cash = '1101'; });
corrupt(refund, 'refund-bank-diversion', (_, b) => { b.tables.characters[0].cash = '1000'; b.tables.characters[0].bank = '100'; });

// Separate sale and order-fill share identical anonymous take receipts. They
// reconcile as one multiset and retain one aggregate identity, without choosing
// an alleged native commit order or counting either transfer twice.
const aggregateBefore = clone(fillBefore); aggregateBefore.tables.market_listings.push(listing('sale', 'good', 'c'));
const aggregateAfter = clone(fillAfter); aggregateAfter.tables.market_listings.push({ ...listing('sale', 'good', 'c'), qty: 0, status: 'sold' });
aggregateAfter.tables.character_cargo.push(cargo('d', 1)); aggregateAfter.tables.characters[2].cash = '1049'; aggregateAfter.tables.characters[3].cash = '950';
aggregateAfter.tables.transactions.push(receipt('sale', 'c', 49, 'market:sale'), receipt('bid', 'd', -50, 'market:bid'), receipt('take-2', null, -1, 'market:take'));
const requests = [['b', 'order', 'fill'], ['d', 'sale', 'buy']].map(([owner, id, action], i) => ({ accountId: 'account-' + owner, request: { method: 'POST', path: '/v1/market/' + id + '/' + action, body: { qty: 1 }, idempotencyKey: 'key-' + i } }));
const outcomes = requests.map(() => ({ status: 'fulfilled', value: { status: 200, replayed: false, body: { ok: true } } }));
const root = { format: 1, kind: 'quiescent-resource-trace-root', groupId: 1, beforeHash: sha256(aggregateBefore), afterHash: sha256(aggregateAfter), requestsSha256: actorValueHash(requests), outcomesSha256: actorValueHash(outcomes), traceSha256: actorValueHash([]) };
const aggregateIdentity = { kind: 'resource-quiescent-aggregate', outcome: 'QUIESCENT_AGGREGATE', groupId: 1, requestCount: 2, requestsSha256: root.requestsSha256,
  context: { logicalAt, requests: requests.map((row, requestIndex) => ({ requestIndex, accountId: row.accountId, method: row.request.method, path: row.request.path, idempotencyKey: row.request.idempotencyKey })) }, traceRoot: { ...root, sha256: actorValueHash(root) } };
const evidence = { identity: aggregateIdentity, before: aggregateBefore, after: aggregateAfter, requests, outcomes, trace: [] };
const aggregate = reconcileMarketResources(aggregateBefore, aggregateAfter, { identity: aggregateIdentity, receipts: aggregateAfter.tables.transactions, quiescentGroupEvidence: evidence });
assert.equal(aggregate.movements.length, 2); assert.equal(aggregate.usedReceipts.size, 5); assert(aggregate.movements.every(row => row.receiptBinding === 'aggregate-exact-multiset'));
assert.equal(aggregate.checks[0].internalCommitOrder, false); cases.push({ name: 'aggregate-sale-and-fill-shared-fee-multiset' });
const altered = clone(evidence); altered.outcomes[0].value.replayed = true;
assert.throws(() => reconcileMarketResources(aggregateBefore, aggregateAfter, { identity: aggregateIdentity, receipts: aggregateAfter.tables.transactions, quiescentGroupEvidence: altered })); controls.push('aggregate-response-hash-mismatch');

const changes = { classification: 'RESTRICTED_RESOURCE_EVIDENCE', beforeHash: sha256(claimBefore), afterHash: sha256(claimAfter), tables: ['market_listings', 'character_cargo'].map(table => ({ table, beforeRows: claimBefore.tables[table], afterRows: claimAfter.tables[table] })) };
const projection = reconcileMarketResourceChanges(changes, { identity: claim.identity, accountInventory: claimBefore.tables.characters.map(({ id, account_id }) => ({ id, account_id })) });
assert.equal(projection.movements.length, 1); assert(projection.stateScope.includes('no full snapshot')); cases.push({ name: 'retained-claim-delta-identity-only-join' });
console.log(JSON.stringify({ status: 'PASS_SCOPED', cases: cases.map(row => row.name), controls: controls.length, nativeEvidenceClaim: false }));
