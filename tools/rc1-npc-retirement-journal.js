// Read-only classification of the retained original-worker retirement trace.
// Active loans, Family membership, boats and nonempty auxiliary cleanup remain
// outside this narrow observed branch. No receipt or native row is rewritten.
import assert from 'node:assert/strict';
import { canonicalJson, sha256 } from './rc1-native-proof.js';
import { exactSum } from './rc1-resource-journal.js';
import { CAR_MELT_SOURCE_PINS } from './rc1-car-melt-provenance.js';
import { NPC_CAR_SOURCE_PINS, assertNpcCarSources } from './rc1-npc-car-acquisition.js';

const sameRows = (a, b) => assert.deepEqual(a.map(canonicalJson).sort(), b.map(canonicalJson).sort(), 'Retirement state differs from executed disposition');
const integer = value => { const n = Number(value); assert(Number.isSafeInteger(n) && n >= 0, 'Unsupported retirement quantity'); return n; };
const LOCK = 'SELECT id, account_id, cash, bank FROM characters WHERE id=$1 AND alive AND is_npc FOR UPDATE';
const LEDGER = 'INSERT INTO transactions (id, character_id, currency, amount, reason) VALUES ($1,$2,$3,$4,$5)';

export function verifyNpcRetirement(before, after, provenance, identity) {
  if (!provenance || provenance.unsupported || provenance.queries?.[1]?.sql !== LOCK) return null;
  if (!provenance.extensions?.npcCarAcquisition) return null;
  assertNpcCarSources();
  assert.deepEqual(provenance.sourcePins, CAR_MELT_SOURCE_PINS);
  assert.deepEqual(provenance.extensions.npcCarAcquisition.sourcePins, NPC_CAR_SOURCE_PINS);
  assert.equal(provenance.format, 1); assert.deepEqual(provenance.boundary, identity, 'Retirement boundary identity differs');
  assert.equal(identity.outcome, 'COMMITTED'); assert.equal(identity.command, 'COMMIT');
  assert.equal(identity.context.authority, 'original-worker');
  const at = identity.context.logicalAt, queries = provenance.queries;
  assert(Number.isSafeInteger(at)); assert(queries.every(query => query.logicalAt === at), 'Retirement crossed clocks');
  assert.equal(provenance.bytes, queries.reduce((n, query) => n + Buffer.byteLength(JSON.stringify(query)), 0), 'Retirement trace bytes differ');
  let offset = 0;
  const take = (sql, parameters, command, rowCount) => {
    const query = queries[offset++]; assert(query, 'Incomplete retirement trace');
    assert.equal(query.sql, sql, 'Unexpected retirement SQL'); assert.deepEqual(query.parameters, parameters);
    assert.equal(query.command, command); assert.equal(query.rowCount, rowCount);
    if (command !== 'SELECT') assert.deepEqual(query.rows, []);
    return query;
  };
  const tables = before.tables, final = after.tables, owner = queries[1].parameters[0];
  const person = tables.characters.find(row => row.id === owner), next = final.characters.find(row => row.id === owner);
  assert(person?.alive && person.is_npc && next && next.account_id === person.account_id, 'Retirement lacks the original resident');
  const offers = tables.loans.filter(row => row.lender_character === owner && row.status === 'open');
  const orders = tables.market_listings.filter(row => row.seller_character === owner && row.kind === 'order' && row.status === 'live');
  const cars = tables.cars.filter(row => row.character_id === owner), cargo = tables.character_cargo.filter(row => row.character_id === owner);
  if (![person.cash, person.bank, ...offers.map(row => row.principal), ...orders.flatMap(row => [row.qty, row.price]), ...cargo.map(row => row.qty)]
    .every(value => Number.isSafeInteger(Number(value)) && Number(value) >= 0)) return null;
  if (tables.loans.some(row => row.lender_character === owner && row.status === 'active')
    || tables.gang_members.some(row => row.character_id === owner) || tables.boats.some(row => row.character_id === owner)
    || orders.some(row => Number(row.filled_qty) !== 0 || row.bidder !== null)
    || cars.some(row => row.pledged || row.listed || row.minted_onchain)) return null;
  // This branch's auxiliary deletions were empty in the retained native case.
  // Do not claim a different cleanup branch merely from the retirement label.
  const activeRead = queries.find(query => query.sql.includes("status='active' FOR UPDATE"));
  if (!activeRead || activeRead.rows.length) return null;
  if (queries.some(query => query.rowCount > 0 && (query.command === 'DELETE' && !/^DELETE FROM (cars WHERE id=\$1|character_cargo WHERE character_id=\$1)$/.test(query.sql)
    || query.command === 'UPDATE' && (query.sql.startsWith('UPDATE characters SET guarded_by=') || query.sql.startsWith('UPDATE characters SET aha_stage='))))) return null;
  const allowedChangedTables = new Set(['characters', 'transactions', 'loans', 'market_listings', 'cars', 'character_cargo', 'rng_audit']);
  for (const table of Object.keys(tables)) if (!allowedChangedTables.has(table)) sameRows(tables[table], final[table]);
  take('BEGIN', [], 'BEGIN', null);
  assert.deepEqual(take(LOCK, [owner], 'SELECT', 1).rows, [{ id: owner, account_id: person.account_id, cash: person.cash, bank: person.bank }]);
  const receiptRows = [], auditRows = [], movements = [], checks = [];
  const ledger = (amount, reason) => {
    const query = queries[offset], id = query?.parameters[0];
    take(LEDGER, [id, owner, 'cash', amount, reason], 'INSERT', 1);
    assert(!tables.transactions.some(row => row.id === id));
    const matches = final.transactions.filter(row => row.id === id); assert.equal(matches.length, 1);
    const row = matches[0];
    assert.deepEqual([row.character_id, row.account_id, row.currency, Number(row.amount), row.reason, row.counterparty],
      [owner, null, 'cash', amount, reason, null], 'Retirement ledger differs');
    assert.equal(Date.parse(row.at), at); receiptRows.push(row); return id;
  };
  const selectedOffers = take("SELECT id, principal FROM loans WHERE lender_character=$1 AND status='open' FOR UPDATE", [owner], 'SELECT', offers.length).rows;
  sameRows(selectedOffers, offers.map(({ id, principal }) => ({ id, principal })));
  let reclaimed = 0;
  for (const row of selectedOffers) {
    const amount = integer(row.principal); assert(amount > 0);
    take("UPDATE loans SET status='cancelled' WHERE id=$1", [row.id], 'UPDATE', 1);
    movements.push({ kind: 'npc-retirement-escrow-return', owner, escrow: 'loan', loanId: row.id, amount: String(amount), receiptIds: [ledger(amount, 'loan:refund')] });
    reclaimed += amount;
  }
  const selectedOrders = take("SELECT id, qty, price FROM market_listings WHERE seller_character=$1 AND kind='order' AND status='live' FOR UPDATE", [owner], 'SELECT', orders.length).rows;
  sameRows(selectedOrders, orders.map(({ id, qty, price }) => ({ id, qty, price })));
  for (const row of selectedOrders) {
    const amount = integer(row.qty) * integer(row.price); assert(Number.isSafeInteger(amount));
    take("UPDATE market_listings SET qty=0, status='cancelled' WHERE id=$1", [row.id], 'UPDATE', 1);
    if (amount > 0) {
      movements.push({ kind: 'npc-retirement-escrow-return', owner, escrow: 'market-order', listingId: row.id, amount: String(amount), receiptIds: [ledger(amount, 'market:refund')] });
      reclaimed += amount;
    }
  }
  assert(Number.isSafeInteger(reclaimed));
  if (reclaimed > 0) take('UPDATE characters SET cash = cash + $2 WHERE id=$1', [owner, reclaimed], 'UPDATE', 1);
  assert.deepEqual(take("SELECT id, borrower_character, collateral_car, collateral_omr FROM loans WHERE lender_character=$1 AND status='active' FOR UPDATE", [owner], 'SELECT', 0).rows, []);
  const emptyDelete = (sql, parameters = [owner]) => take(sql, parameters, 'DELETE', 0);
  emptyDelete('DELETE FROM contact_calls WHERE npc_character=$1');
  emptyDelete('DELETE FROM contacts WHERE owner_account=$1 OR contact_account=$1', [person.account_id]);
  const held = integer(person.cash) + integer(person.bank) + reclaimed; assert(Number.isSafeInteger(held));
  if (held > 0) movements.push({ kind: 'npc-retirement-cash-sink', owner, amount: String(held), receiptIds: [ledger(-held, 'npc:retire')] });
  const selectedCars = take('SELECT id FROM cars WHERE character_id=$1', [owner], 'SELECT', cars.length).rows;
  sameRows(selectedCars, cars.map(({ id }) => ({ id })));
  const carSinks = [];
  for (const { id: carId } of selectedCars) {
    take('DELETE FROM cars WHERE id=$1', [carId], 'DELETE', 1);
    const id = queries[offset]?.parameters[0];
    take('INSERT INTO rng_audit (id, character_id, action, roll, outcome) VALUES ($1,$2,$3,0,$4)', [id, owner, 'npc:car', 'retire'], 'INSERT', 1);
    assert(!tables.rng_audit.some(row => row.id === id));
    const matches = final.rng_audit.filter(row => row.id === id); assert.equal(matches.length, 1);
    const audit = matches[0];
    assert.deepEqual([audit.character_id, audit.action, Number(audit.roll), audit.outcome, Date.parse(audit.at)], [owner, 'npc:car', 0, 'retire', at]);
    auditRows.push(audit); carSinks.push({ kind: 'exact-npc-retirement-car-sink', owner, carId, auditId: id, receiptIds: [] });
  }
  for (const table of ['boats', 'businesses', 'fighters']) emptyDelete(`DELETE FROM ${table} WHERE character_id=$1`);
  const boxing = take('SELECT holder_char, callout_char FROM boxing_title WHERE id=1 FOR UPDATE', [], 'SELECT', 1).rows;
  if (boxing.length !== 1 || boxing[0].holder_char === owner || boxing[0].callout_char === owner) return null;
  emptyDelete('DELETE FROM racers WHERE character_id=$1');
  take('DELETE FROM character_cargo WHERE character_id=$1', [owner], 'DELETE', cargo.length);
  for (const row of cargo) movements.push({ kind: 'npc-retirement-cargo-sink', owner, goodId: row.good_id, quantity: String(integer(row.qty)), receiptIds: [] });
  assert.deepEqual(take('SELECT gang_id FROM gang_members WHERE character_id=$1', [owner], 'SELECT', 0).rows, []);
  for (const table of ['crew_heist_members', 'world_raid_members']) emptyDelete(`DELETE FROM ${table} WHERE character_id=$1`);
  take('UPDATE characters SET guarded_by=NULL, guarded_until=NULL WHERE guarded_by=$1', [owner], 'UPDATE', 0);
  for (const table of ['wiretaps', 'wire_watches', 'wire_informants']) emptyDelete(`DELETE FROM ${table} WHERE watcher_character=$1 OR target_character=$1`);
  emptyDelete('DELETE FROM family_aggro WHERE target_character=$1');
  emptyDelete('DELETE FROM searches WHERE hunter=$1 OR target=$1');
  take('UPDATE characters SET aha_stage=0, aha_rival=NULL, aha_rival_name=NULL WHERE aha_rival=$1', [owner], 'UPDATE', 0);
  emptyDelete('DELETE FROM secrets WHERE holder_character=$1 OR target_account=$2', [owner, person.account_id]);
  emptyDelete('DELETE FROM npc_hits WHERE payer=$1 OR target=$1');
  emptyDelete('DELETE FROM masteries WHERE character_id=$1');
  take('UPDATE characters SET alive=false, cash=0, bank=0 WHERE id=$1', [owner], 'UPDATE', 1);
  take('UPDATE population_state SET day=$1, retired = CASE WHEN day=$1 THEN retired + 1 ELSE 1 END WHERE id=1', [Math.floor(at / 86400000)], 'UPDATE', 1);
  take('COMMIT', [], 'COMMIT', null); assert.equal(offset, queries.length, 'Compound retirement transaction');
  assert.deepEqual(next, { ...person, alive: false, cash: '0', bank: '0' });
  const offerIds = new Set(offers.map(row => row.id)), listingIds = new Set(orders.map(row => row.id));
  sameRows(final.characters, tables.characters.map(row => row.id === owner ? next : row));
  sameRows(final.loans, tables.loans.map(row => offerIds.has(row.id) ? { ...row, status: 'cancelled' } : row));
  sameRows(final.market_listings, tables.market_listings.map(row => listingIds.has(row.id) ? { ...row, qty: 0, status: 'cancelled' } : row));
  sameRows(final.cars, tables.cars.filter(row => row.character_id !== owner));
  sameRows(final.character_cargo, tables.character_cargo.filter(row => row.character_id !== owner));
  sameRows(final.transactions, [...tables.transactions, ...receiptRows]); sameRows(final.rng_audit, [...tables.rng_audit, ...auditRows]);
  assert.equal(exactSum([person.cash, person.bank, ...receiptRows.map(row => row.amount)]), '0', 'Retirement cash does not close');
  const authority = receiptRows.map(row => ({ table: 'transactions', id: row.id }));
  checks.push({ kind: 'npc-retirement-escrow-and-wallet', resource: 'cash', owner, reclaimed: String(reclaimed), destroyed: String(held), drift: '0', authority });
  for (const row of cargo) checks.push({ kind: 'npc-retirement-cargo-sink', resource: 'cargo:' + row.good_id, owner,
    before: String(row.qty), after: '0', destroyed: String(row.qty), drift: '0', authority: [{ source: 'src/population.js retireResident', characterId: owner }] });
  return { owner, carSinks, movements, checks, usedReceipts: new Set(receiptRows.map(row => row.id)), listingIds,
    cargoKeys: new Set(cargo.map(row => JSON.stringify([owner, row.good_id]))),
    provenanceSha256: sha256(canonicalJson(provenance)), sourcePins: NPC_CAR_SOURCE_PINS };
}
