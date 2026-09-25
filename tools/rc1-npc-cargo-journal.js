// Existing resident freight purchase: exact cash sink/tax and owned cargo.
import assert from 'node:assert/strict';
import { isDeepStrictEqual as equal } from 'node:util';
import { GOODS, POPULATION, goodPriceOf, priceBlock } from '../src/rules.js';
import { exactSum, negate } from './rc1-resource-journal.js';

const key = row => JSON.stringify([row.character_id, row.good_id]);
const omit = (row, fields) => Object.fromEntries(Object.entries(row).filter(([name]) => !fields.includes(name)));
export function reconcileNpcCargo(before, after, { identity, receipts }) {
  const result = { usedReceipts: new Set(), cargoKeys: new Set(), checks: [], movements: [] };
  const purchases = receipts.filter(row => row.currency === 'cash' && row.reason.startsWith('goods:buy:'));
  if (!purchases.length || identity?.context?.authority !== 'original-worker'
      || !before.tables.character_cargo || !after.tables.character_cargo) return result;
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
  const cash = Number(prior.cash), unit = Math.round(goodPriceOf(goodId, prior.loc, priceBlock(logicalAt)));
  assert(Number.isSafeInteger(cash) && cash >= 0 && Number.isSafeInteger(unit) && unit > 0, 'NPC freight exceeds exact price range');
  const spendable = Math.floor(cash * (1 - POPULATION.BEHAVIOUR.KEEP_FLOOR));
  const budget = Math.min(spendable, Math.floor(cash * POPULATION.MARKS.GOODS_BPS / 10000));
  const qty = Math.min(POPULATION.MARKS.GOODS_MAX_UNITS, Math.floor(budget / (unit * 1.02)));
  assert(Number.isSafeInteger(qty) && qty >= 1, 'NPC freight lacks affordable quantity');
  const cost = unit * qty, fee = Math.ceil(cost * .01), tax = Math.ceil(cost * .01), debit = cost + fee + tax;
  assert(Number.isSafeInteger(debit));
  assert.equal(exactSum([receipt.amount]), String(-debit), 'NPC freight debit differs from canonical price');
  assert.equal(exactSum([next.cash, negate(prior.cash)]), String(-debit), 'NPC freight cash does not conserve');
  const expected = { character_id: prior.id, good_id: goodId, qty };
  const cargo = after.tables.character_cargo.filter(row => row.character_id === prior.id);
  assert.equal(cargo.length, 1, 'NPC freight cargo missing/duplicated');
  assert.deepEqual(cargo[0], expected, 'NPC freight owner/good/quantity differs');
  assert.deepEqual(after.tables.character_cargo.filter(row => row.character_id !== prior.id), before.tables.character_cargo, 'NPC freight changed another owner cargo');
  const oldTax = before.tables.street_tax, newTax = after.tables.street_tax;
  assert.equal(oldTax.length, 1); assert.equal(newTax.length, 1); assert.equal(oldTax[0].id, 1);
  assert(equal(omit(oldTax[0], ['pool']), omit(newTax[0], ['pool'])), 'NPC freight changed another tax field');
  assert.equal(exactSum([newTax[0].pool, negate(oldTax[0].pool)]), String(tax), 'NPC freight tax does not conserve');
  result.usedReceipts.add(receipt.id); result.cargoKeys.add(key(expected));
  result.checks.push({ kind: 'NPC-freight-conservation', owner: prior.id, resource: 'cash', debit: String(debit), tax: String(tax), sink: String(cost + fee), drift: '0', receiptId: receipt.id });
  result.movements.push({ kind: 'NPC-freight-purchase', owner: prior.id, goodId, qty, unit, receiptId: receipt.id });
  return result;
}
