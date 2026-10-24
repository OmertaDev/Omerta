import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GOODS, POPULATION, goodPriceOf, priceBlock } from '../src/rules.js';
import { goodsBuyQuote } from '../src/goodsquote.js';
import { reconcileNpcCargo } from '../tools/rc1-npc-cargo-journal.js';
import { WORLD_RESOURCE_TABLES, reconcileWorldResources } from '../tools/rc1-world-resource-observer.js';

const source = fs.readFileSync(new URL('../src/population.js', import.meta.url), 'utf8');
for (const statement of [
  'const spendable = (cash) => Math.floor(Number(cash) * (1 - POPULATION.BEHAVIOUR.KEEP_FLOOR));',
  'let qty = POPULATION.MARKS.GOODS_MAX_UNITS;',
  'while (qty > 0 && goodsBuyQuote(good.id, r.loc, qty, {}, block).total > budget) qty--;',
  'const quote = goodsBuyQuote(good.id, r.loc, qty, {}, block);',
  "await consumeGoodsLiquidity(client, good.id, r.loc, 'buy', qty, block);",
  "await client.query('UPDATE characters SET cash = cash - $2 WHERE id=$1', [r.id, quote.total]);",
  "await client.query('UPDATE street_tax SET pool = pool + $1 WHERE id=1', [quote.tax]);",
  "await client.query('INSERT INTO character_cargo (character_id, good_id, qty) VALUES ($1,$2,$3)',",
]) assert(source.includes(statement), 'NPC freight source changed; review classifier');

const logicalAt = Date.parse('2026-09-24T05:00:00.000Z');
const block = priceBlock(logicalAt), goodId = GOODS[0].id;
const identity = { outcome: 'COMMITTED', context: { authority: 'original-worker', logicalAt } };
const budgetOf = cash => Math.min(Math.floor(cash * (1 - POPULATION.BEHAVIOUR.KEEP_FLOOR)),
  Math.floor(cash * POPULATION.MARKS.GOODS_BPS / 10000));
const quantityOf = cash => {
  const budget = budgetOf(cash);
  let qty = POPULATION.MARKS.GOODS_MAX_UNITS;
  while (qty > 0 && goodsBuyQuote(goodId, 'docks', qty, {}, block).total > budget) qty--;
  return qty;
};
const empty = () => ({ format: 1, tables: Object.fromEntries(WORLD_RESOURCE_TABLES.map(table => [table, []])) });

function fixture({ cash = 5000, priorLiquidity = { good_id: goodId, district: 'docks', price_block: block, bought: 7, sold: 11 } } = {}) {
  const before = empty();
  before.tables.characters = [{ id: 'resident', account_id: 'account', alive: true, is_npc: true, loc: 'docks', cash: String(cash), bank: '0', ammo: 25, cb: 0 }];
  before.tables.street_tax = [{ id: 1, pool: '12', fund: '0' }];
  before.tables.character_cargo = [{ character_id: 'other', good_id: GOODS[1].id, qty: 2 }];
  before.tables.goods_market_liquidity = [
    ...(priorLiquidity ? [priorLiquidity] : []),
    { good_id: GOODS[1].id, district: 'foundry', price_block: block, bought: 3, sold: 4 },
  ];
  const qty = quantityOf(cash);
  assert(qty >= 1, 'Fixture cash must fund resident freight');
  const quote = goodsBuyQuote(goodId, 'docks', qty, {}, block);
  const receipt = { id: 'freight-receipt', account_id: null, counterparty: null, character_id: 'resident', currency: 'cash',
    amount: String(-quote.total), reason: `goods:buy:${goodId}`, at: new Date(logicalAt).toISOString() };
  const after = structuredClone(before);
  after.tables.characters[0].cash = String(cash - quote.total);
  after.tables.street_tax[0].pool = String(12 + quote.tax);
  after.tables.transactions = [receipt];
  after.tables.character_cargo.push({ character_id: 'resident', good_id: goodId, qty });
  const sameBlock = priorLiquidity && priorLiquidity.price_block === block;
  const nextLiquidity = { good_id: goodId, district: 'docks', price_block: block,
    bought: (sameBlock ? priorLiquidity.bought : 0) + qty, sold: sameBlock ? priorLiquidity.sold : 0 };
  const existing = after.tables.goods_market_liquidity.findIndex(row => row.good_id === goodId && row.district === 'docks');
  if (existing < 0) after.tables.goods_market_liquidity.unshift(nextLiquidity);
  else after.tables.goods_market_liquidity[existing] = nextLiquidity;
  return { before, after, cash, qty, quote, receipt, priorLiquidity };
}

const classify = (test, value = test.after) => reconcileNpcCargo(test.before, value,
  { identity, receipts: value.tables.transactions });
const primary = fixture();
const classified = classify(primary);
assert.equal(classified.movements.length, 1);
assert.deepEqual(classified.movements[0], { kind: 'NPC-freight-purchase', owner: 'resident', goodId,
  qty: primary.qty, unit: primary.quote.unit, subtotal: primary.quote.subtotal, fee: primary.quote.fee,
  tax: primary.quote.tax, debit: primary.quote.total, district: 'docks', priceBlock: block, receiptId: primary.receipt.id });
assert.equal(classified.liquidityKeys.size, 1);
const journal = reconcileWorldResources(primary.before, primary.after, { identity });
assert.equal(journal.unsupported.length, 0);
assert(journal.checks.some(row => row.kind === 'NPC-freight-liquidity' && row.expectedDelta === String(primary.qty)));

for (const mutate of [
  s => { s.tables.character_cargo[1].character_id = 'other'; },
  s => { s.tables.character_cargo[1].good_id = GOODS[1].id; },
  s => { s.tables.character_cargo[1].qty++; },
  s => { s.tables.character_cargo.pop(); },
  s => { s.tables.street_tax[0].pool = String(13 + primary.quote.tax); },
  s => { s.tables.characters[0].cash = String(primary.cash - primary.quote.total + 1); },
  s => { s.tables.transactions[0].amount = String(-primary.quote.total + 1); },
  s => { s.tables.transactions[0].character_id = 'other'; },
  s => { s.tables.transactions[0].at = new Date(logicalAt + 1).toISOString(); },
  s => { s.tables.goods_market_liquidity[0].good_id = GOODS[1].id; },
  s => { s.tables.goods_market_liquidity[0].district = 'foundry'; },
  s => { s.tables.goods_market_liquidity[0].price_block++; },
  s => { s.tables.goods_market_liquidity[0].bought++; },
  s => { s.tables.goods_market_liquidity[0].sold++; },
  s => { s.tables.goods_market_liquidity.shift(); },
  s => { s.tables.goods_market_liquidity.push({ ...s.tables.goods_market_liquidity[0] }); },
  s => { s.tables.goods_market_liquidity[1].bought++; },
]) {
  const value = structuredClone(primary.after); mutate(value); assert.throws(() => classify(primary, value));
}

const rewriteQuantity = (test, qty) => {
  const value = structuredClone(test.after), quote = goodsBuyQuote(goodId, 'docks', qty, {}, block);
  value.tables.characters[0].cash = String(test.cash - quote.total);
  value.tables.street_tax[0].pool = String(12 + quote.tax);
  value.tables.transactions[0].amount = String(-quote.total);
  value.tables.character_cargo.find(row => row.character_id === 'resident').qty = qty;
  const bucket = value.tables.goods_market_liquidity.find(row => row.good_id === goodId && row.district === 'docks');
  bucket.bought = (test.priorLiquidity?.price_block === block ? test.priorLiquidity.bought : 0) + qty;
  bucket.sold = test.priorLiquidity?.price_block === block ? test.priorLiquidity.sold : 0;
  return value;
};
assert(primary.qty > 1);
assert.throws(() => classify(primary, rewriteQuantity(primary, primary.qty - 1)),
  'An internally balanced underfilled purchase must not impersonate the runtime maximum quantity');
assert.throws(() => classify(primary, rewriteQuantity(primary, primary.qty + 1)),
  'An internally balanced purchase above the runtime budget must not qualify');

for (const valid of [
  fixture({ priorLiquidity: null }),
  fixture({ priorLiquidity: { good_id: goodId, district: 'docks', price_block: block - 1, bought: 499, sold: 498 } }),
]) {
  assert.equal(classify(valid).movements.length, 1, 'New and refreshed liquidity buckets follow current settlement semantics');
  assert.equal(reconcileWorldResources(valid.before, valid.after, { identity }).unsupported.length, 0);
}
for (const impossible of [
  fixture({ priorLiquidity: { good_id: goodId, district: 'docks', price_block: block, bought: 499, sold: 0 } }),
  fixture({ priorLiquidity: { good_id: goodId, district: 'docks', price_block: block + 1, bought: 0, sold: 0 } }),
]) assert.throws(() => classify(impossible), 'Exhausted or future liquidity cannot produce committed resident freight');

const rounding = fixture({ cash: 2430 });
const staleApproximation = Math.min(POPULATION.MARKS.GOODS_MAX_UNITS,
  Math.floor(budgetOf(rounding.cash) / (Math.round(goodPriceOf(goodId, 'docks', block)) * 1.02)));
assert.equal(rounding.qty, 1); assert.equal(staleApproximation, 2);
assert.equal(classify(rounding).movements[0].qty, 1,
  'Exact independently rounded quote terms, not the stale 1.02 approximation, set resident quantity');

const double = structuredClone(primary.after); double.tables.transactions.push({ ...primary.receipt, id: 'second' });
assert.equal(classify(primary, double).usedReceipts.size, 0, 'Compound receipts must remain unknown');
for (const missing of ['character_cargo', 'goods_market_liquidity']) {
  const legacy = structuredClone(primary.before); delete legacy.tables[missing];
  assert.equal(reconcileNpcCargo(legacy, primary.after, { identity, receipts: [primary.receipt] }).usedReceipts.size, 0,
    `Missing ${missing} instrumentation cannot qualify`);
}
for (const side of ['bought', 'sold']) {
  const liquidityOnly = structuredClone(primary.before);
  liquidityOnly.tables.goods_market_liquidity[0][side]++;
  const boundaryIdentity = side === 'sold' ? { outcome: 'COMMITTED', command: 'COMMIT', context: {
    accountId: 'account', method: 'POST', path: '/v1/goods/sell', body: { goodId, qty: 1 }, logicalAt,
  } } : identity;
  const unknown = reconcileWorldResources(primary.before, liquidityOnly, { identity: boundaryIdentity });
  if (side === 'sold') assert.equal(unknown.marketResources.movements.length, 0,
    'The public sell route must remain outside the bounded buy classifier');
  assert(unknown.unsupported.some(row => row.table === 'goods_market_liquidity'),
    `Unreceipted shared ${side} liquidity movement must remain explicit unsupported evidence`);
}

console.log('PASS: current quote/quantity, shared liquidity, resident cash/tax/cargo conservation and adversarial controls');
