// Current resident freight purchase: exact quote, shared stock, cash sink/tax and owned cargo.
import assert from 'node:assert/strict';
import { isDeepStrictEqual as equal } from 'node:util';
import { GOODS, POPULATION, priceBlock } from '../src/rules.js';
import { goodsBuyQuote } from '../src/goodsquote.js';
import { GOODS_MARKET } from '../src/goodsmarket.js';
import { exactSum, negate } from './rc1-resource-journal.js';

const cargoKey = row => JSON.stringify([row.character_id, row.good_id]);
const liquidityKey = row => JSON.stringify([row.good_id, row.district]);
const omit = (row, fields) => Object.fromEntries(Object.entries(row).filter(([name]) => !fields.includes(name)));
export function reconcileNpcCargo(before, after, { identity, receipts }) {
  const result = { usedReceipts: new Set(), cargoKeys: new Set(), liquidityKeys: new Set(), checks: [], movements: [] };
  const purchases = receipts.filter(row => row.currency === 'cash' && row.reason.startsWith('goods:buy:'));
  if (!purchases.length || identity?.context?.authority !== 'original-worker'
      || !before.tables.character_cargo || !after.tables.character_cargo
      || !before.tables.goods_market_liquidity || !after.tables.goods_market_liquidity) return result;
  // Compound purchases remain explicit unknowns rather than borrowing lineage.
  if (purchases.length !== 1 || receipts.length !== 1) return result;
  assert.equal(identity.outcome, 'COMMITTED', 'NPC freight must commit atomically');
  const receipt = purchases[0], goodId = receipt.reason.slice('goods:buy:'.length);
  assert(GOODS.some(good => good.id === goodId), 'NPC freight references unknown good');
  const prior = before.tables.characters.find(row => row.id === receipt.character_id);
  const next = after.tables.characters.find(row => row.id === receipt.character_id);
  assert(prior?.alive && prior.is_npc && next, 'NPC freight has no living resident owner');
  assert.equal(receipt.account_id, null); assert.equal(receipt.counterparty, null);
  assert(equal(omit(prior, ['cash']), omit(next, ['cash'])), 'NPC freight changed another owner field');
  assert(!before.tables.character_cargo.some(row => row.character_id === prior.id), 'NPC freight owner already has cargo');
  const logicalAt = identity.context.logicalAt;
  assert(Number.isSafeInteger(logicalAt), 'NPC freight lacks logical price time');
  assert.equal(Date.parse(receipt.at), logicalAt, 'NPC freight receipt price time differs');
  const cash = Number(prior.cash), block = priceBlock(logicalAt);
  assert(Number.isSafeInteger(cash) && cash >= 0 && Number.isSafeInteger(block) && block >= 0,
    'NPC freight exceeds exact price range');
  const spendable = Math.floor(cash * (1 - POPULATION.BEHAVIOUR.KEEP_FLOOR));
  const budget = Math.min(spendable, Math.floor(cash * POPULATION.MARKS.GOODS_BPS / 10000));
  let qty = POPULATION.MARKS.GOODS_MAX_UNITS;
  while (qty > 0 && goodsBuyQuote(goodId, prior.loc, qty, {}, block).total > budget) qty--;
  assert(Number.isSafeInteger(qty) && qty >= 1, 'NPC freight lacks affordable quantity');
  const quote = goodsBuyQuote(goodId, prior.loc, qty, {}, block);
  const { unit, subtotal, fee, tax, total: debit } = quote;
  assert([unit, subtotal, fee, tax, debit].every(Number.isSafeInteger) && unit > 0 && debit <= budget,
    'NPC freight quote exceeds exact price range');
  assert.equal(exactSum([receipt.amount]), String(-debit), 'NPC freight debit differs from canonical price');
  assert.equal(exactSum([next.cash, negate(prior.cash)]), String(-debit), 'NPC freight cash does not conserve');
  const expected = { character_id: prior.id, good_id: goodId, qty };
  const cargo = after.tables.character_cargo.filter(row => row.character_id === prior.id);
  assert.equal(cargo.length, 1, 'NPC freight cargo missing/duplicated');
  assert.deepEqual(cargo[0], expected, 'NPC freight owner/good/quantity differs');
  assert.deepEqual(after.tables.character_cargo.filter(row => row.character_id !== prior.id), before.tables.character_cargo, 'NPC freight changed another owner cargo');
  const bucketKey = JSON.stringify([goodId, prior.loc]);
  const priorBuckets = before.tables.goods_market_liquidity.filter(row => liquidityKey(row) === bucketKey);
  const finalBuckets = after.tables.goods_market_liquidity.filter(row => liquidityKey(row) === bucketKey);
  assert(priorBuckets.length <= 1, 'NPC freight prior liquidity bucket duplicated');
  assert.equal(finalBuckets.length, 1, 'NPC freight liquidity bucket missing/duplicated');
  const priorBucket = priorBuckets[0];
  if (priorBucket) {
    assert([priorBucket.price_block, priorBucket.bought, priorBucket.sold]
      .every(value => Number.isSafeInteger(Number(value)) && Number(value) >= 0), 'NPC freight prior liquidity is invalid');
    assert(Number(priorBucket.price_block) <= block, 'NPC freight consumed an expired quote after a newer liquidity block');
  }
  const sameBlock = priorBucket && Number(priorBucket.price_block) === block;
  const expectedBucket = { good_id: goodId, district: prior.loc, price_block: block,
    bought: (sameBlock ? Number(priorBucket.bought) : 0) + qty, sold: sameBlock ? Number(priorBucket.sold) : 0 };
  assert(expectedBucket.bought <= GOODS_MARKET.STOCK_PER_BLOCK, 'NPC freight exceeded shared shop stock');
  assert.deepEqual(finalBuckets[0], expectedBucket, 'NPC freight liquidity quantity/block differs');
  assert.deepEqual(after.tables.goods_market_liquidity.filter(row => liquidityKey(row) !== bucketKey),
    before.tables.goods_market_liquidity.filter(row => liquidityKey(row) !== bucketKey),
    'NPC freight changed another liquidity bucket');
  const oldTax = before.tables.street_tax, newTax = after.tables.street_tax;
  assert.equal(oldTax.length, 1); assert.equal(newTax.length, 1); assert.equal(oldTax[0].id, 1);
  assert(equal(omit(oldTax[0], ['pool']), omit(newTax[0], ['pool'])), 'NPC freight changed another tax field');
  assert.equal(exactSum([newTax[0].pool, negate(oldTax[0].pool)]), String(tax), 'NPC freight tax does not conserve');
  result.usedReceipts.add(receipt.id); result.cargoKeys.add(cargoKey(expected)); result.liquidityKeys.add(bucketKey);
  result.checks.push({ kind: 'NPC-freight-conservation', owner: prior.id, resource: 'cash', debit: String(debit), tax: String(tax), sink: String(subtotal + fee), drift: '0', receiptId: receipt.id },
    { kind: 'NPC-freight-liquidity', owner: `${prior.loc}:${goodId}`, resource: 'goods-stock', before: sameBlock ? String(priorBucket.bought) : '0',
      after: String(expectedBucket.bought), expectedDelta: String(qty), drift: '0', receiptId: receipt.id });
  result.movements.push({ kind: 'NPC-freight-purchase', owner: prior.id, goodId, qty, unit, subtotal, fee, tax, debit,
    district: prior.loc, priceBlock: block, receiptId: receipt.id });
  return result;
}
