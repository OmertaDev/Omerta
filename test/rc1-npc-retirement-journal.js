// Deterministic observer controls. The separate retained PostgreSQL witness is
// the native execution proof; this file does not execute a world or qualify it.
import assert from 'node:assert/strict';
import { CAR_MELT_SOURCE_PINS } from '../tools/rc1-car-melt-provenance.js';
import { NPC_CAR_SOURCE_PINS } from '../tools/rc1-npc-car-acquisition.js';
import { verifyNpcRetirement } from '../tools/rc1-npc-retirement-journal.js';
import { WORLD_RESOURCE_TABLES, reconcileWorldResources } from '../tools/rc1-world-resource-observer.js';
import { classifyEconomyBoundary, loanRefundCustodyFromJournal } from '../tools/rc1-world-economy-metrics.js';

const at = Date.parse('2026-09-26T12:00:00Z'), iso = new Date(at).toISOString(), copy = structuredClone;
const traceBytes = provenance => { provenance.bytes = provenance.queries.reduce((n, query) => n + Buffer.byteLength(JSON.stringify(query)), 0); };
function fixture() {
  const before = { format: 1, tables: Object.fromEntries(WORLD_RESOURCE_TABLES.map(table => [table, []])) };
  const person = { id: 'npc', account_id: 'account', alive: true, is_npc: true, cash: '854', bank: '0', ammo: 25, cb: 0 };
  before.tables.characters = [person];
  before.tables.loans = [{ id: 'loan', lender_character: 'npc', borrower_character: null, status: 'open', principal: '5000' }];
  before.tables.market_listings = [{ id: 'order', seller_character: 'npc', kind: 'order', status: 'live', qty: 3, price: '257', filled_qty: 0, bidder: null }];
  before.tables.cars = [{ id: 'car', character_id: 'npc', model_id: 'volara', rarity: 'common', listed: false, pledged: false, minted_onchain: false }];
  before.tables.character_cargo = [{ character_id: 'npc', good_id: 'coffee', qty: 1 }];
  const after = copy(before);
  after.tables.characters[0] = { ...person, alive: false, cash: '0' };
  after.tables.loans[0].status = 'cancelled'; after.tables.market_listings[0].status = 'cancelled'; after.tables.market_listings[0].qty = 0;
  after.tables.cars = []; after.tables.character_cargo = [];
  after.tables.transactions = [['loan-refund', 5000, 'loan:refund'], ['order-refund', 771, 'market:refund'], ['burn', -6625, 'npc:retire']]
    .map(([id, amount, reason]) => ({ id, character_id: 'npc', account_id: null, currency: 'cash', amount: String(amount), reason, counterparty: null, at: iso }));
  after.tables.rng_audit = [{ id: 'car-audit', character_id: 'npc', action: 'npc:car', roll: '0', outcome: 'retire', at: iso }];
  const event = { sequence: 20, clientId: 7, transactionId: 4, outcome: 'COMMITTED', command: 'COMMIT', context: { authority: 'original-worker', logicalAt: at } };
  const queries = [];
  const q = (sql, parameters = [], rowCount = 0, rows = []) => queries.push({ sql, parameters, command: sql.split(' ')[0], rowCount, rows, logicalAt: at });
  const ledger = (id, amount, reason) => q('INSERT INTO transactions (id, character_id, currency, amount, reason) VALUES ($1,$2,$3,$4,$5)', [id, 'npc', 'cash', amount, reason], 1);
  const del = sql => q(sql, ['npc']);
  q('BEGIN', [], null);
  q('SELECT id, account_id, cash, bank FROM characters WHERE id=$1 AND alive AND is_npc FOR UPDATE', ['npc'], 1, [{ id: 'npc', account_id: 'account', cash: '854', bank: '0' }]);
  q("SELECT id, principal FROM loans WHERE lender_character=$1 AND status='open' FOR UPDATE", ['npc'], 1, [{ id: 'loan', principal: '5000' }]);
  q("UPDATE loans SET status='cancelled' WHERE id=$1", ['loan'], 1); ledger('loan-refund', 5000, 'loan:refund');
  q("SELECT id, qty, price FROM market_listings WHERE seller_character=$1 AND kind='order' AND status='live' FOR UPDATE", ['npc'], 1, [{ id: 'order', qty: 3, price: '257' }]);
  q("UPDATE market_listings SET qty=0, status='cancelled' WHERE id=$1", ['order'], 1); ledger('order-refund', 771, 'market:refund');
  q('UPDATE characters SET cash = cash + $2 WHERE id=$1', ['npc', 5771], 1);
  q("SELECT id, borrower_character, collateral_car, collateral_omr FROM loans WHERE lender_character=$1 AND status='active' FOR UPDATE", ['npc']);
  del('DELETE FROM contact_calls WHERE npc_character=$1'); q('DELETE FROM contacts WHERE owner_account=$1 OR contact_account=$1', ['account']);
  ledger('burn', -6625, 'npc:retire');
  q('SELECT id FROM cars WHERE character_id=$1', ['npc'], 1, [{ id: 'car' }]); q('DELETE FROM cars WHERE id=$1', ['car'], 1);
  q('INSERT INTO rng_audit (id, character_id, action, roll, outcome) VALUES ($1,$2,$3,0,$4)', ['car-audit', 'npc', 'npc:car', 'retire'], 1);
  for (const table of ['boats', 'businesses', 'fighters']) del(`DELETE FROM ${table} WHERE character_id=$1`);
  q('SELECT holder_char, callout_char FROM boxing_title WHERE id=1 FOR UPDATE', [], 1, [{ holder_char: null, callout_char: null }]);
  del('DELETE FROM racers WHERE character_id=$1'); q('DELETE FROM character_cargo WHERE character_id=$1', ['npc'], 1);
  q('SELECT gang_id FROM gang_members WHERE character_id=$1', ['npc']);
  for (const table of ['crew_heist_members', 'world_raid_members']) del(`DELETE FROM ${table} WHERE character_id=$1`);
  q('UPDATE characters SET guarded_by=NULL, guarded_until=NULL WHERE guarded_by=$1', ['npc']);
  for (const table of ['wiretaps', 'wire_watches', 'wire_informants']) del(`DELETE FROM ${table} WHERE watcher_character=$1 OR target_character=$1`);
  del('DELETE FROM family_aggro WHERE target_character=$1'); del('DELETE FROM searches WHERE hunter=$1 OR target=$1');
  q('UPDATE characters SET aha_stage=0, aha_rival=NULL, aha_rival_name=NULL WHERE aha_rival=$1', ['npc']);
  q('DELETE FROM secrets WHERE holder_character=$1 OR target_account=$2', ['npc', 'account']);
  del('DELETE FROM npc_hits WHERE payer=$1 OR target=$1'); del('DELETE FROM masteries WHERE character_id=$1');
  q('UPDATE characters SET alive=false, cash=0, bank=0 WHERE id=$1', ['npc'], 1);
  q('UPDATE population_state SET day=$1, retired = CASE WHEN day=$1 THEN retired + 1 ELSE 1 END WHERE id=1', [Math.floor(at / 86400000)], 1); q('COMMIT', [], null);
  const provenance = { format: 1, sourcePins: CAR_MELT_SOURCE_PINS, boundary: copy(event), queries, unsupported: null,
    extensions: { npcCarAcquisition: { format: 1, sourcePins: NPC_CAR_SOURCE_PINS } } };
  traceBytes(provenance); return { before, after, event, provenance };
}
const verify = f => verifyNpcRetirement(f.before, f.after, f.provenance, f.event);
let f = fixture(), result = verify(f);
assert.equal(result.carSinks.length, 1); assert.equal(result.movements.length, 4); assert.equal(result.usedReceipts.size, 3);
let journal = reconcileWorldResources(f.before, f.after, { identity: f.event, carMeltProvenance: f.provenance });
assert.deepEqual(journal.unsupported, []);
const economy = classifyEconomyBoundary({ before: f.before, after: f.after, journal });
assert.deepEqual(economy.missingCoverage, []);
assert.deepEqual(economy.flows.map(row => [row.resource, row.type, row.amount]), [['cash', 'custody', '5000'], ['cash', 'custody', '771'],
  ['cash', 'destroyed', '6625'], ['cargo:["coffee"]', 'destroyed', '1'], ['car:["volara","common"]', 'destroyed', '1']]);
assert(economy.flows.every(row => !row.reward), 'Escrow returns are not rewards');
assert.equal(reconcileWorldResources(f.before, f.after, { identity: f.event }).unsupported.length, 5, 'No witness means no lineage upgrade');
for (const mutate of [
  f => f.provenance.sourcePins = {}, f => f.event.transactionId++, f => f.provenance.queries[1].logicalAt++,
  f => f.provenance.queries.splice(4, 1), f => f.provenance.queries.splice(-1, 0, copy(f.provenance.queries[8])),
  f => f.provenance.queries.find(q => q.sql === 'DELETE FROM cars WHERE id=$1').parameters[0] = 'other',
  f => f.after.tables.transactions[0].amount = '5001', f => f.after.tables.transactions.push(copy(f.after.tables.transactions[0])),
  f => f.before.tables.transactions.push(copy(f.after.tables.transactions[0])),
  f => f.after.tables.loans[0].principal = '4999', f => f.after.tables.market_listings[0].filled_qty = 1,
  f => f.after.tables.characters[0].ammo++, f => f.after.tables.character_cargo.push({ character_id: 'other', good_id: 'coffee', qty: 1 }),
]) { f = fixture(); mutate(f); traceBytes(f.provenance); assert.throws(() => verify(f)); }
f = fixture(); f.provenance.unsupported = 'bounded-trace-overflow'; assert.equal(verify(f), null);
f = fixture(); f.before.tables.loans.push({ id: 'active', lender_character: 'npc', status: 'active' }); assert.equal(verify(f), null);
f = fixture(); f.provenance.queries.find(q => q.sql.startsWith('DELETE FROM contacts ')).rowCount = 1; traceBytes(f.provenance);
assert.equal(verify(f), null, 'A different auxiliary cleanup branch remains unsupported');
f = fixture(); journal = reconcileWorldResources(f.before, f.after, { identity: f.event, carMeltProvenance: f.provenance });
journal.npcRetirement.movements[2].amount = '6626';
assert.throws(() => classifyEconomyBoundary({ before: f.before, after: f.after, journal }), /metric receipt differs/);

const refundJournal = () => ({ identity: { outcome: 'COMMITTED', context: { authority: 'original-worker', logicalAt: at } }, unsupported: [],
  receipts: [{ id: 'refund', character_id: 'lender', account_id: null, counterparty: null, currency: 'cash', amount: '5000', reason: 'loan:refund', at: iso }],
  checks: [['character:lender', '20', '5020', '5000'], ['open-loan-escrow', '9000', '4000', '-5000']].map(([owner, before, after, expectedDelta]) =>
    ({ kind: 'receipt-parity', resource: 'cash', owner, before, after, expected: after, expectedDelta, drift: '0', authority: [{ table: 'transactions', id: 'refund' }] })) });
assert.equal(loanRefundCustodyFromJournal(refundJournal()).amount, '5000');
for (const i of [0, 1]) { const j = refundJournal(); j.checks.splice(i, 1); assert.equal(loanRefundCustodyFromJournal(j), null); }
for (const mutate of [j => j.checks[0].authority[0].id = 'other', j => j.checks[1].after = '0',
  j => j.checks[1].expectedDelta = '-4999', j => j.receipts[0].at = new Date(at + 1).toISOString()]) {
  const j = refundJournal(); mutate(j); assert.throws(() => loanRefundCustodyFromJournal(j));
}
const duplicate = refundJournal(); duplicate.receipts.push(copy(duplicate.receipts[0])); assert.equal(loanRefundCustodyFromJournal(duplicate), null);
console.log('PASS_SCOPED: exact retirement trace/state/receipt joins, five prior unknowns, no double-counted economic flows, altered/stale/compound controls, and paired worker loan-refund endpoints');
