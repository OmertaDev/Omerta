import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GOODS, POPULATION, goodPriceOf, priceBlock } from '../src/rules.js';
import { reconcileNpcCargo } from '../tools/rc1-npc-cargo-journal.js';
import { WORLD_RESOURCE_TABLES, reconcileWorldResources } from '../tools/rc1-world-resource-observer.js';

const source = fs.readFileSync(new URL('../src/population.js', import.meta.url), 'utf8');
for (const statement of ['const spendable = (cash) => Math.floor(Number(cash) * (1 - POPULATION.BEHAVIOUR.KEEP_FLOOR));',
  'const qty = Math.min(POPULATION.MARKS.GOODS_MAX_UNITS, Math.floor(budget / (unit * 1.02)));',
  'const cost = unit * qty, fee = Math.ceil(cost * 0.01), tax = Math.ceil(cost * 0.01);',
  "'INSERT INTO character_cargo (character_id, good_id, qty) VALUES ($1,$2,$3)'",
]) assert(source.includes(statement), 'NPC freight source changed; review classifier');
const logicalAt = Date.parse('2026-09-24T05:00:00.000Z');
const identity = { outcome: 'COMMITTED', context: { authority: 'original-worker', logicalAt } };
const before = { format: 1, tables: Object.fromEntries(WORLD_RESOURCE_TABLES.map(table => [table, []])) };
before.tables.characters = [{ id: 'resident', account_id: 'account', alive: true, is_npc: true, loc: 'docks', cash: '50000', bank: '0', ammo: 25, cb: 0 }];
before.tables.street_tax = [{ id: 1, pool: '12', fund: '0' }];
const after = structuredClone(before), goodId = GOODS[0].id, cash = 50000;
const unit = Math.round(goodPriceOf(goodId, 'docks', priceBlock(logicalAt)));
const budget = Math.min(Math.floor(cash * (1 - POPULATION.BEHAVIOUR.KEEP_FLOOR)), Math.floor(cash * POPULATION.MARKS.GOODS_BPS / 10000));
const qty = Math.min(POPULATION.MARKS.GOODS_MAX_UNITS, Math.floor(budget / (unit * 1.02)));
const cost = unit * qty, tax = Math.ceil(cost * .01), debit = cost + tax * 2;
const receipt = { id: 'freight-receipt', account_id: null, counterparty: null, character_id: 'resident', currency: 'cash', amount: String(-debit), reason: `goods:buy:${goodId}`, at: new Date(logicalAt).toISOString() };
after.tables.characters[0].cash = String(cash - debit);
after.tables.street_tax[0].pool = String(12 + tax);
after.tables.transactions = [receipt];
after.tables.character_cargo = [{ character_id: 'resident', good_id: goodId, qty }];
const classify = value => reconcileNpcCargo(before, value, { identity, receipts: value.tables.transactions });
assert.equal(classify(after).movements.length, 1);
const journal = reconcileWorldResources(before, after, { identity });
assert.equal(journal.unsupported.length, 0);
for (const mutate of [
  s => { s.tables.character_cargo[0].character_id = 'other'; },
  s => { s.tables.character_cargo[0].good_id = GOODS[1].id; },
  s => { s.tables.character_cargo[0].qty++; },
  s => { s.tables.character_cargo = []; },
  s => { s.tables.street_tax[0].pool = String(13 + tax); },
  s => { s.tables.characters[0].cash = String(cash - debit + 1); },
  s => { s.tables.transactions[0].amount = String(-debit + 1); },
  s => { s.tables.transactions[0].character_id = 'other'; },
  s => { s.tables.transactions[0].at = new Date(logicalAt + 1).toISOString(); },
]) { const value = structuredClone(after); mutate(value); assert.throws(() => classify(value)); }
const double = structuredClone(after); double.tables.transactions.push({ ...receipt, id: 'second' });
assert.equal(classify(double).usedReceipts.size, 0, 'Compound receipts must remain unknown');
const legacy = structuredClone(before); delete legacy.tables.character_cargo;
assert.equal(reconcileNpcCargo(legacy, after, { identity, receipts: [receipt] }).usedReceipts.size, 0, 'Missing cargo instrumentation cannot qualify');
console.log('PASS: exact resident freight cash/tax/cargo conservation and missing instrumentation/corruption controls');
