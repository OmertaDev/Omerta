// Read-only scoped observer. Canonical ledgers remain the resource authorities.
import assert from 'node:assert/strict';
import { DESK, DESK_RECYCLE_REASON, CONSTANTS, M3, M8, levelOf, dayOf } from '../src/rules.js';
import { checkinQuoteOf } from '../src/game.js';
import { exactSum, negate, sha256 } from './rc1-resource-journal.js';
import { reconcileCarResources } from './rc1-car-journal.js';
import { reconcileSeasonConversions } from './rc1-season-conversion-journal.js';
import { reconcileNpcFamilyFormation } from './rc1-npc-family-journal.js';
import { reconcileStoredSeasonCrowns } from './rc1-season-crown-journal.js';
import { reconcileNpcBoats } from './rc1-npc-boat-journal.js';
import { reconcileWorkerTransitions } from './rc1-world-worker-transitions.js';
import { reconcileNpcCargo } from './rc1-npc-cargo-journal.js';

export const WORLD_RESOURCE_TABLES = Object.freeze([
  'characters', 'account_persistent', 'transactions', 'gangs', 'gang_members', 'amm_pool', 'street_tax', 'stake_pool', 'dev_fund',
  'rwa_dividend_pool', 'rwa_family_dividend_pool', 'family_yield_pool', 'exchange_pool', 'desk_inventory', 'loans', 'auctions', 'auction_consignments',
  'item_stacks', 'item_instances', 'item_lots', 'item_events', 'item_mutation_inputs', 'item_mutation_outputs', 'item_mutation_guards',
  'operation_escrow', 'world_operation_capital', 'world_operation_events', 'world_operation_commitments',
  'cars', 'boats', 'character_cargo', 'account_gear', 'market_listings', 'listings', 'bounties', 'commission_proposals', 'favors',
  'loan_house', 'convoy_insurance', 'poker_tournaments', 'poker_entries', 'grand_prix', 'grand_prix_entries',
  'stakes_races', 'stakes_entries', 'districts', 'district_bids', 'shipment_days', 'shipment_takes', 'bespoke_pieces', 'bespoke_serials',
  'campaign_progress', 'drop_allocations', 'chain_reserve', 'vouchers', 'rng_audit', 'telemetry', 'season_records', 'season_recaps', 'notifications',
]);
const json = (value) => JSON.stringify(value);
const tuple = (...parts) => json(parts);
const sorted = (rows) => {
  // Snapshot rows are already plain JSON. Retain the existing comparator and
  // stable tie order, but serialize each row only once within this call.
  const ordered = rows.map(row => ({ row, key: json(row) })).sort((a, b) => a.key.localeCompare(b.key));
  for (let index = 0; index < rows.length; index++) rows[index] = ordered[index].row;
  return rows;
};
const columnsCache = new WeakMap();
const selectionsCache = new WeakMap();
const rows = (state, table) => { assert(Array.isArray(state.tables[table]), `Missing observed table ${table}`); return state.tables[table]; };
const stable = ({ boundary, ...value }) => value;
export const worldResourceHash = (state) => sha256(stable(state));
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
  : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${json(key)}:${canonical(value[key])}`).join(',')}}` : json(value);
const rowBytes = values => values.map(canonical).sort();
const multiset = values => { const counts = new Map(); for (const value of values) counts.set(value, (counts.get(value) || 0) + 1); return counts; };

// Restricted evidence, never an actor projection or a public coverage summary.
// Removed/added row multisets preserve every field and duplicate. They make no
// unsupported guess about which identity or owner a changed row represents.
export function resourceTableChanges(before, after) {
  const tables = [];
  for (const table of WORLD_RESOURCE_TABLES) {
    const prior = rowBytes(rows(before, table)), final = rowBytes(rows(after, table));
    if (json(prior) === json(final)) continue;
    const a = multiset(prior), b = multiset(final), beforeRows = [], afterRows = [];
    for (const key of new Set([...a.keys(), ...b.keys()])) {
      for (let i = b.get(key) || 0; i < (a.get(key) || 0); i++) beforeRows.push(JSON.parse(key));
      for (let i = a.get(key) || 0; i < (b.get(key) || 0); i++) afterRows.push(JSON.parse(key));
    }
    tables.push({ table, beforeHash: sha256(prior), afterHash: sha256(final), beforeCount: prior.length, afterCount: final.length,
      unchangedCount: prior.length - beforeRows.length, beforeRows, afterRows });
  }
  return { format: 1, classification: 'RESTRICTED_RESOURCE_EVIDENCE', beforeHash: worldResourceHash(before),
    afterHash: worldResourceHash(after), tables, statement: 'Exact observed row changes only; unsupported lineage remains unsupported' };
}

export function verifyResourceTableChanges(before, after, changes) {
  assert.equal(changes.classification, 'RESTRICTED_RESOURCE_EVIDENCE');
  assert.equal(changes.beforeHash, worldResourceHash(before)); assert.equal(changes.afterHash, worldResourceHash(after));
  const changed = indexed(changes.tables, r => r.table, 'changed tables');
  for (const table of WORLD_RESOURCE_TABLES) {
    const prior = rowBytes(rows(before, table)), final = rowBytes(rows(after, table)), delta = changed.get(table);
    if (!delta) { assert.deepEqual(final, prior, `Missing changed table ${table}`); continue; }
    assert.equal(delta.beforeHash, sha256(prior)); assert.equal(delta.afterHash, sha256(final));
    assert.equal(delta.beforeCount, prior.length); assert.equal(delta.afterCount, final.length);
    assert.equal(delta.unchangedCount, prior.length - delta.beforeRows.length);
    const reconstructed = multiset(prior);
    for (const removed of rowBytes(delta.beforeRows)) {
      assert((reconstructed.get(removed) || 0) > 0, `Missing exact before row for ${table}`);
      reconstructed.set(removed, reconstructed.get(removed) - 1);
    }
    for (const added of rowBytes(delta.afterRows)) reconstructed.set(added, (reconstructed.get(added) || 0) + 1);
    assert.deepEqual([...reconstructed].flatMap(([row, count]) => Array(count).fill(row)).sort(), final,
      `Changed rows cannot reconstruct ${table}; owner/custody/value detail was lost`);
  }
  assert([...changed.keys()].every(table => WORLD_RESOURCE_TABLES.includes(table)), 'Unobserved table in diagnostics');
  return true;
}

export async function snapshotWorldResources(pool, { transport = 'batch' } = {}) {
  assert(['batch', 'sequential'].includes(transport), 'Unknown resource observation transport');
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    let columns = columnsCache.get(pool);
    if (!columns) {
      columns = (await client.query(`SELECT table_name,column_name,data_type FROM information_schema.columns
        WHERE table_schema=current_schema() AND table_name=ANY($1::text[]) ORDER BY table_name,ordinal_position`, [WORLD_RESOURCE_TABLES])).rows;
      for (const table of WORLD_RESOURCE_TABLES) assert(columns.some(c => c.table_name === table), `Required resource table missing: ${table}`);
      columnsCache.set(pool, columns);
    }
    let selections = selectionsCache.get(pool);
    if (!selections) {
      selections = WORLD_RESOURCE_TABLES.map(table => {
        const selection = columns.filter(c => c.table_name === table).map(c => {
          assert(/^[a-z_][a-z_0-9]*$/.test(c.column_name));
          return `"${c.column_name}"${['numeric', 'decimal', 'bigint'].includes(c.data_type) ? '::text' : ''} AS "${c.column_name}"`;
        }).join(',');
        return `SELECT ${selection} FROM "${table}"`;
      });
      selectionsCache.set(pool, selections);
    }
    // This is the separate, READ ONLY diagnostic connection. Batch the exact
    // unchanged SELECT statements to remove 54 network round trips; preserve all
    // tables, fields, result sets and the same repeatable-read snapshot. No game
    // SQL is batched and no commit-observer boundary is skipped.
    const results = transport === 'batch' ? await client.query(selections.join(';')) : [];
    if (transport === 'sequential') for (const sql of selections) results.push(await client.query(sql));
    assert(Array.isArray(results) && results.length === WORLD_RESOURCE_TABLES.length,
      'Resource observer requires every native SELECT result');
    const tables = {};
    for (const [index, table] of WORLD_RESOURCE_TABLES.entries()) {
      assert.equal(results[index].command, 'SELECT');
      assert.deepEqual(results[index].fields.map(field => field.name),
        columns.filter(column => column.table_name === table).map(column => column.column_name),
        `Resource result columns differ: ${table}`);
      // JSON roundtrip normalizes pg Date objects, never NUMERIC (explicitly text).
      tables[table] = sorted(JSON.parse(json(results[index].rows)));
    }
    const boundary = (await client.query('SELECT pg_current_snapshot()::text AS snapshot')).rows[0];
    await client.query('COMMIT'); return { format: 1, tables, boundary };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

function indexed(values, key, label) {
  const result = new Map();
  for (const row of values) { const id = key(row); assert(!result.has(id), `${label}: duplicate identity ${id}`); result.set(id, row); }
  return result;
}
function appendOnly(before, after, table, key = row => row.id) {
  const prior = indexed(rows(before, table), key, table), final = indexed(rows(after, table), key, table);
  for (const [id, row] of prior) assert.deepEqual(final.get(id), row, `Immutable ${table} receipt removed or rewritten: ${id}`);
  return [...final].filter(([id]) => !prior.has(id)).map(([, row]) => row);
}
const net = (receipts, predicate) => exactSum(receipts.filter(predicate).map(row => row.amount));
function parity(checks, { resource, owner, before, after, expectedDelta = '0', authority, kind = 'receipt-parity' }) {
  const expected = exactSum([before, expectedDelta]), drift = exactSum([after, negate(expected)]);
  const check = { kind, resource, owner, before: exactSum([before]), after: exactSum([after]), expectedDelta: exactSum([expectedDelta]), expected, drift, authority };
  checks.push(check); assert.equal(drift, '0', `Unexplained ${resource} movement for ${owner}: ${json(check)}`);
}
const reference = (table, entries) => entries.map(row => ({ table, id: row.id ?? tuple(row.mutation_id, row.input_ordinal ?? row.output_ordinal) }));

export function omrBuckets(state) {
  const result = [];
  const add = (table, field, predicate = () => true) => {
    for (const row of rows(state, table).filter(predicate)) result.push({ table, owner: row.account_id ?? row.id, field, amount: exactSum([row[field]]) });
  };
  // rewards is a claim on the funded pool, not an additional supply bucket.
  for (const field of ['omr', 'staked', 'unbonding']) add('account_persistent', field);
  for (const [table, field] of [['amm_pool', 'omr_reserve'], ['street_tax', 'fund'], ['gangs', 'omr_reserve'],
    ['stake_pool', 'balance'], ['dev_fund', 'omr'], ['rwa_dividend_pool', 'pool'], ['rwa_family_dividend_pool', 'pool'],
    ['family_yield_pool', 'balance'], ['desk_inventory', 'balance']]) add(table, field);
  add('loans', 'collateral_omr', row => row.status === 'active');
  for (const table of ['auctions', 'auction_consignments']) add(table, 'current_bid', row => row.status === 'live');
  return result;
}
const matches = (reason, pattern) => pattern.endsWith('%') ? reason.startsWith(pattern.slice(0, -1)) : reason === pattern;
const reasonClasses = [
  ['cash', /^crime:/, 'crime cash receipt'], ['cash', /^npc:seed$/, 'resident birth cash source'],
  ['cash', /^loan:(offer|take|refund|repay|death|loot|paper|collect|vig|house:)/, 'loan custody receipt'],
  ['cash', /^coordination:capital:(deposit|refund|spend|forfeit)$/, 'operation capital receipt'],
  ['cash', /^(campaign:|craft:hardening$|death:(estate|legacy)$|travel$)/, 'focused native cash receipt'],
  ['ammo', /^(melt|craft:ammo|death:|fire$|jump$)/, 'ammo receipt'], ['cb', /^(crime:|craft:|death:|cook:)/, 'contraband receipt'],
  ['omr', /^(loan:|desk:|gang:tribute$|vanity:|rarity:upgrade$|death:duty$|yield:|stake:|swap:|auction:|withdraw:omr$|drop:claim$)/, 'OMR custody or supply receipt'],
];

// The original exchange moves rounds into/out of listings WITHOUT an ammo
// ledger entry. Count the seller's live escrow, then attribute a sale only from
// fresh, one-use reciprocal cash receipts and the exact consumed lot. This is
// custody/receipt lineage, not a claim to reconstruct an HTTP request identity.
function reconcileAmmoEscrow(before, after, receipts, checks, unsupported) {
  const old = indexed(rows(before, 'listings'), row => row.id, 'listings');
  const current = indexed(rows(after, 'listings'), row => row.id, 'listings');
  const priorPeople = indexed(rows(before, 'characters'), row => row.id, 'characters');
  const people = indexed(rows(after, 'characters'), row => row.id, 'characters');
  const personal = new Map(), ownership = new Map(), usedReceipts = new Set(), movements = [];
  const bump = (map, owner, amount) => map.set(owner, exactSum([map.get(owner) || '0', String(amount)]));
  const integer = (value, label) => { const text = exactSum([value]); assert(/^\d+$/.test(text), `Ammo escrow ${label} must be a nonnegative integer`); return BigInt(text); };
  const validate = (lot, roster) => {
    assert.equal(lot.item_id, 'ammo', 'Ammo escrow item identity changed');
    assert(roster.has(lot.seller_character), 'Ammo escrow has an unobserved owner');
    assert(integer(lot.qty, 'quantity') > 0n); assert(integer(lot.unit_price, 'price') > 0n);
  };
  for (const lot of old.values()) if (lot.item_kind === 'ammo') validate(lot, priorPeople);
  for (const lot of current.values()) if (lot.item_kind === 'ammo') validate(lot, people);
  for (const [id, lot] of old) if (current.has(id) && (lot.item_kind === 'ammo' || current.get(id).item_kind === 'ammo'))
    assert.deepEqual(current.get(id), lot, 'Live ammo escrow rewritten');
  const changed = [...current.values()].filter(lot => !old.has(lot.id)).map(lot => ({ lot, added: true }))
    .concat([...old.values()].filter(lot => !current.has(lot.id)).map(lot => ({ lot, added: false })));
  let totalTax = 0n;
  for (const { lot, added } of changed.filter(row => row.lot.item_kind === 'ammo')) {
    const seller = lot.seller_character, qty = integer(lot.qty, 'quantity');
    assert(priorPeople.get(seller)?.alive && people.get(seller)?.alive,
      'Ammo escrow death/birth disposition remains unsupported');
    if (added) {
      bump(personal, seller, -qty);
      movements.push({ kind: 'ammo-list', listingId: lot.id, seller, quantity: String(qty), authority: [{ table: 'listings', id: lot.id, state: 'after' }] });
      continue;
    }
    const total = qty * integer(lot.unit_price, 'price');
    assert(total <= BigInt(Number.MAX_SAFE_INTEGER), 'Ammo escrow price outside verified safe-integer purchase scope');
    const fee = (total + 99n) / 100n, tax = fee, net = total > fee + tax ? total - fee - tax : 0n;
    const sales = receipts.filter(row => row.reason === 'exchange:sale' && row.currency === 'cash' && row.character_id === seller
      && exactSum([row.amount]) === String(net));
    if (!sales.length) {
      // A pull preserves the same owner's personal+escrow quantity. A missing
      // sale receipt cannot hide delivery to a different owner: both parity
      // equations below still have to hold for every character.
      bump(personal, seller, qty);
      movements.push({ kind: 'ammo-cancel', listingId: lot.id, seller, quantity: String(qty), authority: [{ table: 'listings', id: lot.id, state: 'before' }] });
      continue;
    }
    assert.equal(sales.length, 1, 'Ambiguous/duplicate ammo sale receipts'); const sale = sales[0], buyer = sale.counterparty;
    assert(buyer !== seller && priorPeople.get(buyer)?.alive && people.get(buyer)?.alive, 'Ammo buyer must be a different observed living owner');
    const buys = receipts.filter(row => row.reason === 'exchange:buy' && row.currency === 'cash' && row.character_id === buyer
      && row.counterparty === seller && exactSum([row.amount]) === String(-total));
    assert.equal(buys.length, 1, 'Missing/duplicate exact ammo buy receipt'); const buy = buys[0];
    assert.equal(sale.account_id, null); assert.equal(buy.account_id, null);
    assert(!usedReceipts.has(sale.id) && !usedReceipts.has(buy.id), 'Ammo trade receipt reused for another lot');
    usedReceipts.add(sale.id); usedReceipts.add(buy.id);
    bump(personal, buyer, qty); bump(ownership, buyer, qty); bump(ownership, seller, -qty);
    const poolTax = tax < total - net ? tax : total - net; totalTax += poolTax;
    movements.push({ kind: 'ammo-buy', listingId: lot.id, seller, buyer, quantity: String(qty), gross: String(total), net: String(net),
      tax: String(poolTax), sink: String(total - net - poolTax), authority: [{ table: 'listings', id: lot.id, state: 'before' }, ...reference('transactions', [buy, sale])] });
  }
  // A receipt cannot be spent again on an unchanged/deleted lot. If another
  // kind of lot was consumed, leave those cash receipts to the unknown inventory;
  // do not pretend this ammo-only classifier attributed the other trade.
  if (!changed.some(row => !row.added && row.lot.item_kind !== 'ammo'))
    for (const receipt of receipts.filter(row => ['exchange:buy', 'exchange:sale'].includes(row.reason)))
      assert(usedReceipts.has(receipt.id), 'Exchange receipt lacks one-use consumed ammo escrow');
  const held = (listings, owner) => exactSum([...listings.values()].filter(lot => lot.item_kind === 'ammo' && lot.seller_character === owner).map(lot => lot.qty));
  for (const [id, person] of people) {
    const prior = priorPeople.get(id), ammoReceipts = receipts.filter(row => row.character_id === id && row.currency === 'ammo');
    parity(checks, { kind: 'personal-and-owned-ammo-escrow', resource: 'ammo', owner: `character-and-ammo-escrow:${id}`,
      before: exactSum([prior?.ammo || '0', held(old, id)]), after: exactSum([person.ammo, held(current, id)]),
      expectedDelta: exactSum([prior ? '0' : '25', ...ammoReceipts.map(row => row.amount), ownership.get(id) || '0']),
      authority: [...reference('transactions', ammoReceipts), ...movements.filter(row => row.seller === id || row.buyer === id).flatMap(row => row.authority),
        ...(!prior ? [{ rule: 'Canonical character default ammo25' }] : [])] });
  }
  if (movements.some(row => row.kind === 'ammo-buy')) {
    if (receipts.filter(row => row.currency === 'cash').every(row => usedReceipts.has(row.id))) {
      parity(checks, { kind: 'ammo-market-house-tax', resource: 'cash', owner: 'street-tax-ammo-market',
        before: rows(before, 'street_tax').find(row => row.id === 1)?.pool ?? '0', after: rows(after, 'street_tax').find(row => row.id === 1)?.pool ?? '0',
        expectedDelta: String(totalTax), authority: reference('transactions', receipts.filter(row => usedReceipts.has(row.id))) });
    } else unsupported.push({ kind: 'ammo-market-compound-tax', detail: 'Ammo buyer/seller custody checked; unrelated cash receipts prevent complete shared tax attribution' });
  }
  return { personal, usedReceipts, movements,
    otherListingChanges: changed.some(row => row.lot.item_kind !== 'ammo') || [...old].some(([id, lot]) => current.has(id) && lot.item_kind !== 'ammo' && json(lot) !== json(current.get(id))) };
}

// Three bounded ordinary routes. A recognized word alone never authorizes a
// value: check-in needs its original quote/latches, ammo needs the reciprocal
// cash/rounds pair, and banking needs exact pocket/vault/transit disposition.
function reconcilePressureCash(before, after, receipts, checks, unsupported) {
  const priorPeople = indexed(rows(before, 'characters'), row => row.id, 'characters');
  const people = indexed(rows(after, 'characters'), row => row.id, 'characters');
  const accounts = indexed(rows(before, 'account_persistent'), row => row.account_id, 'accounts');
  const finalAccounts = indexed(rows(after, 'account_persistent'), row => row.account_id, 'accounts');
  const selected = receipts.filter(row => row.reason === 'checkin' || row.reason === 'ammo:buy' || row.reason.startsWith('bank:deposit:'));
  const usedReceipts = new Set(), movements = [], deposits = new Map(), touched = new Set();
  const claim = row => { assert(!usedReceipts.has(row.id), 'Pressure cash receipt reused'); usedReceipts.add(row.id); };
  for (const id of new Set(selected.map(row => row.character_id))) {
    const prior = priorPeople.get(id), person = people.get(id);
    assert(prior?.alive && person?.alive && prior.account_id === person.account_id, 'Pressure receipt requires stable living owner');
    const own = selected.filter(row => row.character_id === id); touched.add(id);
    for (const row of own) { assert.equal(row.account_id, null); assert.equal(row.counterparty, null); }
    const checkins = own.filter(row => row.reason === 'checkin');
    if (checkins.length) {
      assert.equal(checkins.length, 1, 'Duplicate check-in receipt'); const receipt = checkins[0]; assert.equal(receipt.currency, 'cash');
      const at = Date.parse(receipt.at); assert(Number.isSafeInteger(at), 'Check-in requires stored receipt time');
      const today = dayOf(at), quote = checkinQuoteOf(prior, today); assert.equal(quote.done, false, 'Stale check-in receipt');
      assert.equal(exactSum([receipt.amount]), String(quote.pay), 'Check-in receipt differs from original level/streak quote');
      assert.equal(person.checkin_day, today); assert.equal(person.streak, quote.streak);
      assert.equal(exactSum([person.respect]), exactSum([prior.respect]), 'Check-in plus progression requires separate lineage');
      const oldAccount = accounts.get(prior.account_id), account = finalAccounts.get(prior.account_id); assert(oldAccount && account);
      assert.equal(exactSum([account.checkins_lifetime, negate(oldAccount.checkins_lifetime)]), '1', 'Check-in lifetime count lacks owner linkage');
      claim(receipt); movements.push({ kind: 'checkin', characterId: id, accountId: prior.account_id, day: today,
        priorStreak: prior.streak, streak: quote.streak, cashCreated: String(quote.pay), authority: reference('transactions', [receipt]) });
    }
    const ammo = own.filter(row => row.reason === 'ammo:buy');
    if (ammo.length) {
      assert.equal(ammo.length, 2, 'Armory requires one cash and one ammo receipt');
      const cash = ammo.find(row => row.currency === 'cash'), rounds = ammo.find(row => row.currency === 'ammo'); assert(cash && rounds);
      assert.equal(exactSum([cash.amount]), '-2000', 'Armory cash price must be the authored2000');
      assert.equal(exactSum([rounds.amount]), '50', 'Armory delivery must be the authored50 rounds');
      assert.equal(cash.at, rounds.at, 'Armory reciprocal receipts must share the transaction timestamp');
      claim(cash); claim(rounds); movements.push({ kind: 'armory-ammo', characterId: id, cashDestroyed: '2000', ammoCreated: '50', authority: reference('transactions', ammo) });
    }
    const banking = own.filter(row => row.reason.startsWith('bank:deposit:'));
    if (banking.length) {
      assert.equal(banking.length, 1, 'Duplicate/compound bank deposit receipts'); const receipt = banking[0];
      assert.equal(receipt.currency, 'cash'); assert.equal(exactSum([receipt.amount]), '0', 'Bank deposit cannot create or destroy cash');
      const match = /^bank:deposit:([1-9]\d*)$/.exec(receipt.reason); assert(match, 'Invalid bank deposit marker amount');
      const amount = match[1]; assert(BigInt(amount) <= BigInt(Number.MAX_SAFE_INTEGER), 'Bank deposit outside verified safe-integer scope');
      const at = Date.parse(person.bank_intransit_at), receiptAt = Date.parse(receipt.at); assert(Number.isSafeInteger(at) && Number.isSafeInteger(receiptAt));
      assert(at >= receiptAt, 'Bank transit reset predates its receipt transaction');
      assert(!(prior.safe_until && Date.parse(prior.safe_until) > at), 'Bank deposit while safehoused');
      const cleared = prior.bank_intransit_at && at - Date.parse(prior.bank_intransit_at) >= CONSTANTS.BANK_CLEAR_MS;
      parity(checks, { kind: 'bank-deposit-transit', resource: 'cash-in-transit-marker', owner: `character:${id}`,
        before: cleared ? '0' : prior.bank_intransit || '0', after: person.bank_intransit, expectedDelta: amount, authority: reference('transactions', [receipt]) });
      deposits.set(id, amount); claim(receipt); movements.push({ kind: 'bank-deposit', characterId: id, amount, clearedPriorTransit: !!cleared,
        transitAt: person.bank_intransit_at, authority: reference('transactions', [receipt]), requestBinding: 'Embedded marker and custody checked; HTTP amount requires the separately retained command' });
    }
  }
  for (const id of touched) {
    const prior = priorPeople.get(id), person = people.get(id), ownCash = receipts.filter(row => row.character_id === id && row.currency === 'cash');
    // Accrual records interest separately. Its amount is NOT authorized here;
    // it remains an unsupported reason even while its bank destination is kept.
    const interest = ownCash.filter(row => row.reason === 'bank:interest'), pocket = ownCash.filter(row => row.reason !== 'bank:interest');
    parity(checks, { kind: 'pressure-pocket-disposition', resource: 'cash', owner: `pocket:${id}`, before: prior.cash, after: person.cash,
      expectedDelta: exactSum([...pocket.map(row => row.amount), negate(deposits.get(id) || '0')]), authority: reference('transactions', ownCash) });
    parity(checks, { kind: 'pressure-vault-disposition', resource: 'cash', owner: `bank:${id}`, before: prior.bank, after: person.bank,
      expectedDelta: exactSum([deposits.get(id) || '0', ...interest.map(row => row.amount)]), authority: reference('transactions', ownCash) });
  }
  for (const [id, person] of people) {
    const prior = priorPeople.get(id); if (!prior || exactSum([person.bank, negate(prior.bank)]) === '0' || touched.has(id)) continue;
    const freshCash = receipts.filter(row => row.character_id === id && row.currency === 'cash');
    assert(freshCash.length, 'Pocket/vault movement lacks a fresh owner receipt; old zero-valued deposit cannot be reused');
    unsupported.push({ kind: 'bank-vault-lineage', characterId: id, detail: 'Bank changed outside the bounded deposit classifier; total personal cash parity alone does not prove its disposition' });
  }
  if (movements.length) {
    if (receipts.filter(row => row.currency === 'cash').every(row => usedReceipts.has(row.id))) {
      for (const [table, fields] of [['street_tax', ['pool']], ['exchange_pool', ['balance', 'lifetime_funded', 'lifetime_paid']]])
        for (const field of fields) {
          const prior = rows(before, table).find(row => row.id === 1), final = rows(after, table).find(row => row.id === 1);
          assert(prior && final, `Pressure cash requires the observed ${table} singleton`);
          parity(checks, { kind: 'pressure-no-pool-diversion', resource: 'cash', owner: `${table}/${field}`, before: prior[field], after: final[field],
            authority: reference('transactions', selected) });
        }
    } else unsupported.push({ kind: 'pressure-cash-compound-pools', detail: 'Known ordinary receipt dispositions checked; other cash receipts prevent complete pool attribution' });
  }
  return { usedReceipts, movements };
}

// Ordinary Family entry only. Transaction rows prove custody, not the HTTP body:
// the focused native proof separately binds requests to durable idempotency rows.
// There is no personal ammo-tribute route. An ordinary entry boundary must leave
// every Family ammo bank unchanged; car-melt and other funding stay unclassified.
function reconcileFamilyEntry(before, after, receipts, checks, unsupported, npcFamilyProvenance, identity) {
  const old = indexed(rows(before, 'gangs'), row => row.id, 'Family');
  const current = indexed(rows(after, 'gangs'), row => row.id, 'Family');
  const oldMembers = indexed(rows(before, 'gang_members'), row => row.character_id, 'Family member');
  const members = indexed(rows(after, 'gang_members'), row => row.character_id, 'Family member');
  const oldPeople = indexed(rows(before, 'characters'), row => row.id, 'character');
  const people = indexed(rows(after, 'characters'), row => row.id, 'character');
  const accounts = indexed(rows(before, 'account_persistent'), row => row.account_id, 'account');
  const finalAccounts = indexed(rows(after, 'account_persistent'), row => row.account_id, 'account');
  const selected = receipts.filter(row => row.reason === 'gang:found' && row.currency === 'cash'
    || row.reason === 'gang:tribute' && ['cash', 'omr'].includes(row.currency));
  const usedReceipts = new Set(), movements = [], familyFields = new Map(), founded = new Set(), founderMembers = new Set(), omrKeys = new Set();
  const result = { usedReceipts, movements, familyFields, founded, founderMembers, omrKeys };
  if (!selected.length) return result;
  // runFamilies reuses createGang, then sets NPC war-pool standing in the same
  // transaction. Do not apply player-only defaults or classify that standing.
  const npcFound = selected.filter(receipt => receipt.reason === 'gang:found' && (
    oldPeople.get(receipt.character_id)?.is_npc === true || people.get(receipt.character_id)?.is_npc === true
    || current.get(members.get(receipt.character_id)?.gang_id)?.npc_flag === true));
  if (npcFound.length) {
    const founders = new Set(), families = new Set();
    for (const receipt of npcFound) {
      const prior = oldPeople.get(receipt.character_id), person = people.get(receipt.character_id);
      assert(prior?.alive && person?.alive && prior.account_id && prior.account_id === person.account_id, 'NPC formation requires stable living owner');
      assert.equal(prior.is_npc, true); assert.equal(person.is_npc, true);
      assert.equal(accounts.get(prior.account_id)?.npc_flag, true); assert.equal(finalAccounts.get(prior.account_id)?.npc_flag, true);
      assert.equal(receipt.account_id, null); assert.equal(receipt.counterparty, null);
      assert.equal(exactSum([receipt.amount]), String(-M3.GANG_FOUND_COST), 'Wrong NPC Family formation sink');
      assert(levelOf(Number(prior.respect)) >= M3.GANG_FOUND_LEVEL, 'NPC founder lacks original eligibility');
      assert(!oldMembers.has(prior.id), 'NPC founder already had a Family');
      const member = members.get(prior.id), family = current.get(member?.gang_id);
      assert(member?.role === 'boss' && family && !old.has(family.id), 'NPC formation lacks new Family/boss linkage');
      assert.equal(family.npc_flag, true); assert(!founders.has(prior.id) && !families.has(family.id), 'Duplicate NPC formation receipt');
      assert.equal([...members.values()].filter(row => row.gang_id === family.id).length, 1, 'NPC formation has unrelated membership changes');
      for (const field of ['treasury', 'ammo_bank', 'omr_reserve']) assert.equal(exactSum([family[field]]), '0', `NPC formation created unexplained ${field}`);
      assert.equal(exactSum([person.bank]), exactSum([prior.bank]), 'NPC formation diverted pocket cash through bank custody');
      parity(checks, { resource: 'cash-pocket', owner: prior.id, before: prior.cash, after: person.cash,
        expectedDelta: net(receipts, row => row.character_id === prior.id && row.currency === 'cash'),
        authority: reference('transactions', receipts.filter(row => row.character_id === prior.id && row.currency === 'cash')), kind: 'NPC-formation-cash-parity-only' });
      founders.add(prior.id); families.add(family.id);
    }
    if (npcFamilyProvenance && !npcFamilyProvenance.unsupportedShape) {
      const bound = reconcileNpcFamilyFormation(before, after, receipts, npcFamilyProvenance, identity);
      usedReceipts.add(receipts[0].id); movements.push(bound.movement); founded.add(bound.familyId);
      familyFields.set(bound.familyId, bound.fields); founderMembers.add(bound.characterId);
      const member = members.get(bound.characterId);
      if (Object.keys(member).some(field => !bound.memberFields.has(field))) unsupported.push({ kind: 'observed-table-change', table: 'gang_members', detail: 'Additional NPC founder membership fields remain unsupported' });
      return result;
    }
    unsupported.push({ kind: 'family-npc-formation', familyIds: [...families],
      detail: 'Original NPC formation fee/owner cash checked; NPC Family fields, war_pool creation/standing and compound lineage remain unclassified' });
    return result;
  }
  // Lazy war settlement, weekly rewards and seasonal resets can ride along a
  // tribute. Their additional custody/standing is not attributed by this subset.
  const compound = [...old].some(([id, row]) => !current.has(id) || ['war_with', 'war_until', 'weekly_week', 'weekly_progress', 'weekly_done', 'season']
    .some(field => json(row[field]) !== json(current.get(id)[field])))
    || receipts.some(row => !selected.includes(row));
  if (compound) { unsupported.push({ kind: 'family-entry-compound', detail: 'Ordinary entry receipt overlaps other Family/OMR or seasonal/weekly/war transitions; custody attribution remains incomplete' }); return result; }
  const deltas = new Map(), accountDeltas = new Map();
  const bump = (id, field, amount) => { const fields = deltas.get(id) || {}; fields[field] = exactSum([fields[field] || '0', amount]); deltas.set(id, fields); };
  const stablePerson = id => { const a = oldPeople.get(id), b = people.get(id);
    assert(a?.alive && b?.alive && a.account_id && a.account_id === b.account_id, 'Family entry requires a stable living owner');
    assert(accounts.has(a.account_id) && finalAccounts.has(a.account_id), 'Family entry account is not observed'); return a; };
  const memberOf = id => { const a = oldMembers.get(id); assert(a && old.has(a.gang_id), 'Family tribute lacks original membership');
    assert.deepEqual(members.get(id), a, 'Family tribute membership changed'); return a.gang_id; };
  for (const receipt of selected) {
    assert(/^-[1-9]\d*$/.test(exactSum([receipt.amount])), 'Family entry amount must be a negative whole unit');
    const amount = negate(receipt.amount); assert(BigInt(amount) <= BigInt(Number.MAX_SAFE_INTEGER), 'Family entry exceeds authored safe-integer scope');
    let character, familyId, kind;
    if (receipt.reason === 'gang:found') {
      assert.equal(receipt.account_id, null); assert.equal(receipt.counterparty, null);
      character = stablePerson(receipt.character_id); assert(!oldMembers.has(character.id), 'Founder already had a Family');
      assert(levelOf(Number(character.respect)) >= M3.GANG_FOUND_LEVEL, 'Founder lacks original level eligibility');
      assert.equal(amount, String(M3.GANG_FOUND_COST), 'Wrong Family formation sink');
      const membership = members.get(character.id); assert(membership?.role === 'boss', 'Founder lacks boss membership');
      familyId = membership.gang_id; assert(current.has(familyId) && !old.has(familyId) && !founded.has(familyId), 'Formation must create one distinct Family');
      const family = current.get(familyId); assert.equal(family.npc_flag, false);
      assert.equal(family.season, Math.floor(dayOf(Date.parse(receipt.at)) / 28), 'Family season differs from original receipt time');
      for (const field of ['treasury', 'ammo_bank', 'omr_reserve', 'lifetime_tribute', 'season_tribute']) assert.equal(exactSum([family[field]]), '0', `Nonzero newly founded ${field}`);
      const defaults = { seal: 0, foundation: 0, wars_won: 0, territory_earned: '0', season_wars: '0', weekly_progress: '0', weekly_done: false,
        war_score_us: 0, war_score_them: 0, rwa_invested: '0', sov_points: '0', war_pool: '0', monument_built: '0',
        color: null, weekly_week: null, war_with: null, war_until: null, dividend_at: null, dynasty_name: null, oathbreaker_until: null,
        war_pool_at: null, npc_aggro_until: null, held_by_gang: null, held_since: null, tribute_at: null, charter: null, charter_at: null };
      for (const [field, value] of Object.entries(defaults)) if (Object.hasOwn(family, field))
        assert.equal(typeof value === 'string' && value === '0' ? exactSum([family[field]]) : family[field], value, `Unexpected formation field ${field}`);
      assert(typeof family.name === 'string' && family.name.length >= 3 && family.name.length <= 24 && /^[\w .,'&-]+$/.test(family.name));
      assert(/^[A-Z0-9]{2,4}$/.test(family.tag));
      assert.equal(Date.parse(family.created_at), Date.parse(receipt.at), 'Formation time differs from its transaction');
      assert.equal(Date.parse(membership.joined_at), Date.parse(receipt.at), 'Founder membership time differs from its transaction');
      familyFields.set(familyId, new Set(['id', 'name', 'tag', 'npc_flag', 'season', 'created_at', 'treasury', 'ammo_bank', 'omr_reserve',
        'lifetime_tribute', 'season_tribute', ...Object.keys(defaults)]));
      assert.equal([...members.values()].filter(row => row.gang_id === familyId).length, 1, 'Ordinary formation includes unexpected members');
      assert.equal(membership.post ?? null, null); assert.equal(membership.post_at ?? null, null);
      if (Object.keys(membership).some(field => !['gang_id', 'character_id', 'role', 'joined_at', 'post', 'post_at'].includes(field)))
        unsupported.push({ kind: 'observed-table-change', table: 'gang_members', detail: 'New founder membership contains fields outside the declared projection' });
      founded.add(familyId); founderMembers.add(character.id); kind = 'family-formation-sink';
    } else {
      assert(BigInt(amount) >= BigInt(receipt.currency === 'cash' ? M3.TRIBUTE_MIN : M8.TRIBUTE_OMR_MIN), 'Family tribute below authored minimum');
      if (receipt.currency === 'cash') { assert.equal(receipt.account_id, null); character = stablePerson(receipt.character_id); }
      else { assert.equal(receipt.character_id, null); const owners = [...oldPeople.values()].filter(row => row.alive && row.account_id === receipt.account_id);
        assert.equal(owners.length, 1, 'OMR tribute has no unique living account owner'); character = stablePerson(owners[0].id);
        accountDeltas.set(character.account_id, exactSum([accountDeltas.get(character.account_id) || '0', receipt.amount])); }
      familyId = memberOf(character.id); assert.equal(receipt.counterparty, familyId, 'Tribute credited a different Family');
      const field = receipt.currency === 'cash' ? 'treasury' : 'omr_reserve'; bump(familyId, field, amount);
      if (receipt.currency === 'cash') for (const standing of ['lifetime_tribute', 'season_tribute']) bump(familyId, standing, amount);
      kind = `family-${receipt.currency}-tribute`;
    }
    usedReceipts.add(receipt.id);
    movements.push({ kind, characterId: character.id, accountId: character.account_id, familyId, currency: receipt.currency, amount,
      disposition: kind === 'family-formation-sink' ? 'cash-destroyed' : 'personal-to-Family-custody', authority: reference('transactions', [receipt]) });
  }
  for (const id of new Set(movements.filter(row => row.currency === 'cash').map(row => row.characterId))) {
    const prior = oldPeople.get(id), person = people.get(id);
    if (receipts.some(row => row.character_id === id && row.currency === 'cash' && (row.reason.startsWith('bank:') || row.reason === 'interest')))
      unsupported.push({ kind: 'family-entry-pocket-compound', characterId: id, detail: 'Additional bank action prevents isolated pocket attribution' });
    else {
      assert.equal(exactSum([person.bank]), exactSum([prior.bank]), 'Family entry diverted value through bank custody');
      parity(checks, { resource: 'cash-pocket', owner: id, before: prior.cash, after: person.cash,
        expectedDelta: net(receipts, row => row.character_id === id && row.currency === 'cash'), authority: reference('transactions', receipts.filter(row => row.character_id === id && row.currency === 'cash')) });
    }
  }
  for (const [id, family] of current) {
    const prior = old.get(id); if (!prior) { assert(founded.has(id), 'Unattributed Family added during ordinary entry'); continue; }
    const fields = new Set();
    for (const field of ['treasury', 'ammo_bank', 'omr_reserve', 'lifetime_tribute', 'season_tribute']) {
      parity(checks, { resource: `Family.${field}`, owner: id, before: prior[field], after: family[field], expectedDelta: deltas.get(id)?.[field] || '0',
        authority: movements.filter(row => row.familyId === id).flatMap(row => row.authority), kind: 'Family-entry-custody' }); fields.add(field);
    }
    familyFields.set(id, fields); omrKeys.add(tuple('gangs', id, 'omr_reserve'));
  }
  if (accountDeltas.size) {
    assert.deepEqual([...accounts.keys()].sort(), [...finalAccounts.keys()].sort(), 'Account set changed during ordinary OMR tribute');
    for (const [id, account] of accounts) {
      parity(checks, { resource: 'omr', owner: `account:${id}`, before: account.omr, after: finalAccounts.get(id).omr,
        expectedDelta: accountDeltas.get(id) || '0', authority: movements.filter(row => row.accountId === id && row.currency === 'omr').flatMap(row => row.authority) });
      omrKeys.add(tuple('account_persistent', id, 'omr'));
    }
  }
  return result;
}

// Voluntary, living-member terminal custody subset. Nonmonetary territorial,
// governance and estate cleanup is not inferred from the destruction receipts.
// OMR returns to the desk; cash and rounds really leave in-game custody.
function reconcileFamilyDissolution(before, after, receipts, checks, unsupported) {
  const old = indexed(rows(before, 'gangs'), row => row.id, 'Family');
  const current = indexed(rows(after, 'gangs'), row => row.id, 'Family');
  const removed = [...old.values()].filter(row => !current.has(row.id));
  const disposal = receipts.filter(row => row.reason === 'gang:dissolved');
  const recycled = receipts.filter(row => row.currency === 'omr' && row.reason === 'desk:recycle' && row.counterparty === 'gang:dissolved');
  const usedReceipts = new Set(), dissolved = new Set(), omrKeys = new Set(), movements = [];
  const result = { usedReceipts, dissolved, omrKeys, movements };
  if (!removed.length && !disposal.length && !recycled.length) return result;
  assert(removed.length > 0 || !disposal.length && !recycled.length, 'Orphan Family dissolution receipt without deleted custody');
  const priorPeople = indexed(rows(before, 'characters'), row => row.id, 'character');
  const people = indexed(rows(after, 'characters'), row => row.id, 'character');
  const members = rows(before, 'gang_members').filter(row => removed.some(family => family.id === row.gang_id));
  if (removed.length !== 1 || receipts.some(row => !disposal.includes(row) && !recycled.includes(row))
      || members.some(row => !priorPeople.get(row.character_id)?.alive || !people.get(row.character_id)?.alive)) {
    unsupported.push({ kind: 'family-dissolution-compound', detail: 'Multiple Family deletions, other receipts or death overlap; this living-member terminal custody subset does not attribute the compound boundary' });
    return result;
  }
  const family = removed[0]; assert(members.length > 0, 'Dissolved Family lacks original owners');
  assert(!rows(after, 'gang_members').some(row => row.gang_id === family.id), 'Dissolved Family retains membership');
  for (const member of members) assert.equal(people.get(member.character_id).account_id, priorPeople.get(member.character_id).account_id, 'Dissolution changed member account ownership');
  const disposition = [];
  for (const [currency, field] of [['cash', 'treasury'], ['ammo', 'ammo_bank'], ['omr', 'omr_reserve']]) {
    const amount = exactSum([family[field]]); assert(!amount.startsWith('-'), 'Negative Family custody before dissolution');
    if (currency === 'ammo') assert(/^\d+$/.test(amount), 'Family ammo must be integral');
    const matching = disposal.filter(row => row.currency === currency && row.counterparty === family.id);
    assert.equal(matching.length, amount === '0' ? 0 : 1, `Missing/duplicate Family ${currency} disposition receipt`);
    if (amount === '0') continue;
    const receipt = matching[0]; assert.equal(receipt.character_id, null); assert.equal(receipt.account_id, null);
    assert.equal(exactSum([receipt.amount]), negate(amount), `Wrong exact Family ${currency} disposition`); usedReceipts.add(receipt.id);
    parity(checks, { resource: `Family.${field}`, owner: family.id, before: amount, after: '0', expectedDelta: receipt.amount,
      authority: reference('transactions', [receipt]), kind: 'Family-terminal-custody' });
    disposition.push({ currency, amount, kind: currency === 'omr' ? 'reserve-to-desk' : 'destroyed', authority: reference('transactions', [receipt]) });
  }
  const reserve = exactSum([family.omr_reserve]);
  assert.equal(recycled.length, reserve === '0' ? 0 : 1, 'Missing/duplicate exact dissolution recycle receipt');
  if (reserve !== '0') {
    const credit = recycled[0], debit = disposal.find(row => row.currency === 'omr');
    assert.equal(credit.character_id, null); assert.equal(credit.account_id, null); assert.equal(exactSum([credit.amount]), reserve, 'Wrong dissolution recycle amount');
    assert.equal(credit.at, debit.at, 'Dissolution recycle receipt belongs to another transaction time'); usedReceipts.add(credit.id);
    const a = rows(before, 'desk_inventory'), b = rows(after, 'desk_inventory');
    assert.equal(a.length, 1); assert.equal(b.length, 1); assert.equal(a[0].id, 1); assert.equal(b[0].id, 1);
    for (const field of ['balance', 'lifetime_in']) parity(checks, { resource: `desk.${field}`, owner: 'desk:1', before: a[0][field], after: b[0][field],
      expectedDelta: reserve, authority: reference('transactions', [debit, credit]), kind: 'Family-dissolution-recycle' });
    for (const field of new Set([...Object.keys(a[0]), ...Object.keys(b[0])])) if (!['balance', 'lifetime_in'].includes(field))
      assert.deepEqual(b[0][field], a[0][field], `Unattributed desk field in dissolution: ${field}`);
    disposition.find(row => row.currency === 'omr').authority.push(...reference('transactions', [credit]));
  } else assert.deepEqual(rows(after, 'desk_inventory'), rows(before, 'desk_inventory'), 'Zero-reserve dissolution changed desk custody/books');
  assert.equal(usedReceipts.size, receipts.length, 'Unattributed Family disposal receipt');
  const key = row => tuple(row.table, row.owner, row.field), a = indexed(omrBuckets(before), key, 'OMR bucket'), b = indexed(omrBuckets(after), key, 'OMR bucket');
  for (const bucket of new Set([...a.keys(), ...b.keys()])) {
    const expectedDelta = bucket === tuple('gangs', family.id, 'omr_reserve') ? negate(reserve)
      : bucket === tuple('desk_inventory', 1, 'balance') ? reserve : '0';
    parity(checks, { resource: 'omr', owner: bucket, before: a.get(bucket)?.amount ?? '0', after: b.get(bucket)?.amount ?? '0', expectedDelta,
      authority: reference('transactions', receipts.filter(row => row.currency === 'omr')), kind: 'Family-terminal-owner-custody' });
    omrKeys.add(bucket);
  }
  for (const [id, prior] of old) if (id !== family.id) {
    assert(current.has(id)); for (const field of ['treasury', 'ammo_bank', 'omr_reserve']) parity(checks, { resource: `Family.${field}`, owner: id,
      before: prior[field], after: current.get(id)[field], authority: [], kind: 'Family-terminal-unrelated-custody' });
  }
  dissolved.add(family.id); movements.push({ kind: 'family-dissolution', familyId: family.id,
    originalMembers: members.map(row => ({ characterId: row.character_id, accountId: priorPeople.get(row.character_id).account_id, role: row.role })),
    disposition, authority: reference('transactions', receipts) });
  return result;
}

// One completed, unchartered live-bidder contest. The ledger omits district IDs,
// so multiple or reopening contests cannot be assigned an invented receipt FK.
function reconcileTurfTerminal(before, after, receipts, checks, unsupported) {
  const key = row => tuple(row.district_id, row.gang_id), old = indexed(rows(before, 'district_bids'), key, 'district bid');
  const current = indexed(rows(after, 'district_bids'), key, 'district bid');
  const removed = [...old].filter(([id]) => !current.has(id)).map(([, row]) => row);
  const selected = receipts.filter(row => ['turf:claim:refund', 'turf:claim:burn'].includes(row.reason));
  const usedReceipts = new Set(), districtFields = new Map(), settledDistricts = new Set(), treasuryOwners = new Set(), movements = [];
  const result = { usedReceipts, districtFields, settledDistricts, treasuryOwners, movements };
  if (!removed.length && !selected.length) return result;
  assert(removed.length, 'Orphan turf terminal receipt without consumed escrow');
  const ids = new Set(removed.map(row => row.district_id));
  const families = indexed(rows(before, 'gangs'), row => row.id, 'Family'), finalFamilies = indexed(rows(after, 'gangs'), row => row.id, 'Family');
  const compound = ids.size !== 1 || [...current].some(([id, row]) => !old.has(id) || json(old.get(id)) !== json(row))
    || receipts.some(row => row.currency === 'cash' && !selected.includes(row))
    || removed.some(row => !families.has(row.gang_id) || !finalFamilies.has(row.gang_id) || families.get(row.gang_id).charter !== null || finalFamilies.get(row.gang_id).charter !== null);
  if (compound) { unsupported.push({ kind: 'turf-terminal-compound', detail: 'Multiple/new/changed contests, other cash receipts, charter or dissolved-bidder overlap remains unclassified' }); return result; }
  const districtId = [...ids][0], prior = rows(before, 'districts').find(row => row.id === districtId), final = rows(after, 'districts').find(row => row.id === districtId);
  assert(prior && final, 'Unobserved settled district');
  if (!prior.holder_gang || !families.has(prior.holder_gang)) {
    unsupported.push({ kind: 'turf-terminal-compound', detail: 'Unowned/dissolved incumbent remains outside this live-incumbent contest subset' }); return result;
  }
  assert(!rows(after, 'district_bids').some(row => row.district_id === districtId), 'Terminal retained part of its escrow');
  const integer = value => { const text = exactSum([value]); assert(/^\d+$/.test(text) && BigInt(text) <= BigInt(Number.MAX_SAFE_INTEGER), 'Turf amount outside authored positive safe-integer scope'); return BigInt(text); };
  for (const bid of removed) assert(integer(bid.amount) > 0n, 'Nonpositive turf escrow');
  const ordered = [...removed].sort((a, b) => integer(a.amount) === integer(b.amount)
    ? a.gang_id === prior.holder_gang ? -1 : b.gang_id === prior.holder_gang ? 1 : a.gang_id.localeCompare(b.gang_id)
    : integer(a.amount) > integer(b.amount) ? -1 : 1);
  const winner = ordered[0], winningAmount = integer(winner.amount), oldGarrison = integer(prior.garrison), refunds = new Map();
  assert.equal(final.holder_gang, winner.gang_id, 'Wrong turf winner'); assert.equal(final.contest_until, null, 'Turf deadline latch not closed');
  assert.equal(exactSum([final.garrison]), String(winningAmount > oldGarrison ? winningAmount : oldGarrison), 'Wrong nonmonetary garrison');
  const deadline = Date.parse(prior.contest_until); assert(Number.isFinite(deadline), 'Terminal lacks original contest deadline');
  const timestamps = new Set(selected.map(row => row.at)); assert.equal(timestamps.size, 1, 'Turf terminal receipts span ambiguous transaction times');
  const settledAt = Date.parse([...timestamps][0]); assert(Number.isFinite(settledAt) && settledAt >= deadline, 'Turf settled before its original deadline');
  const claim = (bid, reason, amount) => {
    const matching = selected.filter(row => !usedReceipts.has(row.id) && row.currency === 'cash' && row.reason === reason && row.counterparty === bid.gang_id);
    assert.equal(matching.length, 1, `Missing/duplicate ${reason} receipt for exact escrow owner`); const row = matching[0];
    assert.equal(row.character_id, null); assert.equal(row.account_id, null); assert.equal(exactSum([row.amount]), amount, 'Incorrect exact turf disposition amount');
    usedReceipts.add(row.id); return row;
  };
  for (const bid of removed) {
    const amount = integer(bid.amount), won = bid.gang_id === winner.gang_id;
    const refund = won ? 0n : amount * BigInt(10000 - M3.CONTEST_LOSS_BPS) / 10000n, burn = amount - refund, authority = [];
    if (refund) authority.push(...reference('transactions', [claim(bid, 'turf:claim:refund', String(refund))]));
    authority.push(...reference('transactions', [claim(bid, 'turf:claim:burn', String(-burn))])); refunds.set(bid.gang_id, String(refund));
    parity(checks, { resource: 'district-cash-escrow', owner: key(bid), before: bid.amount, after: '0', expectedDelta: String(-refund - burn),
      authority, kind: 'turf-terminal-owner-custody' });
    movements.push({ kind: 'turf-contest-terminal', districtId, familyId: bid.gang_id, staked: String(amount), refunded: String(refund), burned: String(burn), won, authority });
  }
  assert.equal(usedReceipts.size, selected.length, 'Orphan/extra turf terminal receipt');
  for (const [id, family] of families) {
    assert(finalFamilies.has(id), 'Family disappeared during isolated turf terminal');
    parity(checks, { resource: 'Family.treasury', owner: id, before: family.treasury, after: finalFamilies.get(id).treasury, expectedDelta: refunds.get(id) || '0',
      authority: movements.filter(row => row.familyId === id).flatMap(row => row.authority), kind: 'turf-terminal-refund' }); treasuryOwners.add(id);
  }
  const fields = new Set(['holder_gang', 'garrison', 'contest_until']);
  if (winner.gang_id !== prior.holder_gang) {
    assert.equal(final.npc_holder, null); assert.equal(final.watch_hour, null); assert.equal(Date.parse(final.seized_at), settledAt, 'Turf seizure stamp differs from settlement');
    for (const field of ['npc_holder', 'watch_hour', 'seized_at']) fields.add(field);
  }
  districtFields.set(districtId, fields); settledDistricts.add(districtId); return result;
}

export function reconcileWorldResources(before, after, { identity = null, includeRestrictedChanges = false, carMeltProvenance = null, carAcquisitionProvenance = null, npcFamilyProvenance = null, seasonElectionProvenance = null, npcBoatProvenance = null, duelSelection = null } = {}) {
  assert.equal(before.format, 1); assert.equal(after.format, 1);
  const checks = [], unsupported = [];
  const receipts = appendOnly(before, after, 'transactions');
  const events = appendOnly(before, after, 'item_events');
  const inputs = appendOnly(before, after, 'item_mutation_inputs', r => tuple(r.mutation_id, r.input_ordinal));
  const outputs = appendOnly(before, after, 'item_mutation_outputs', r => tuple(r.mutation_id, r.output_ordinal));
  appendOnly(before, after, 'world_operation_events');
  const priorGuards = rows(before, 'item_mutation_guards').filter(r => r.completed_at && r.result_json);
  const finalGuards = indexed(rows(after, 'item_mutation_guards'), r => r.idempotency_key, 'guards');
  for (const guard of priorGuards) assert.deepEqual(finalGuards.get(guard.idempotency_key), guard, 'Completed mutation guard rewritten');
  for (const event of events) {
    const guard = finalGuards.get(event.idempotency_key);
    assert(guard?.completed_at && guard.result_json, `Item event lacks completed mutation guard: ${event.id}`);
    if (event.mutation_id) {
      assert.equal(guard.mutation_id, event.mutation_id, 'Event mutation identity mismatch');
      const creation = ['lot_granted', 'lot_split_output', 'unique_granted', 'migration_origin'].includes(event.event_kind);
      const linked = (creation ? outputs : inputs).filter(r => r.event_id === event.id);
      assert.equal(linked.length, 1, 'Normalized event must have exactly one matching input/output');
      assert.equal(linked[0][creation ? 'output_ordinal' : 'input_ordinal'], event.event_ordinal, 'Mutation ordinal mismatch');
    }
  }
  const ammoEscrow = reconcileAmmoEscrow(before, after, receipts, checks, unsupported);
  const pressureCash = reconcilePressureCash(before, after, receipts, checks, unsupported);
  const familyEntry = reconcileFamilyEntry(before, after, receipts, checks, unsupported, npcFamilyProvenance, identity);
  const familyDissolution = reconcileFamilyDissolution(before, after, receipts, checks, unsupported);
  const turfTerminal = reconcileTurfTerminal(before, after, receipts, checks, unsupported);
  const workerTransitions = reconcileWorkerTransitions(before, after, { identity, receipts });
  checks.push(...workerTransitions.checks);
  const npcCargo = reconcileNpcCargo(before, after, { identity, receipts });
  checks.push(...npcCargo.checks);
  for (const receipt of receipts) if (!npcCargo.usedReceipts.has(receipt.id) && !ammoEscrow.usedReceipts.has(receipt.id) && !pressureCash.usedReceipts.has(receipt.id) && !familyEntry.usedReceipts.has(receipt.id) && !familyDissolution.usedReceipts.has(receipt.id) && !turfTerminal.usedReceipts.has(receipt.id) && !reasonClasses.some(([currency, pattern]) => currency === receipt.currency && pattern.test(receipt.reason)))
    unsupported.push({ kind: 'receipt-reason', currency: receipt.currency, reason: receipt.reason, receiptId: receipt.id });

  const priorPeople = indexed(rows(before, 'characters'), r => r.id, 'characters'), finalPeople = indexed(rows(after, 'characters'), r => r.id, 'characters');
  for (const id of priorPeople.keys()) assert(finalPeople.has(id), `Character row deleted without supported birth/retirement lineage: ${id}`);
  for (const [id, person] of finalPeople) {
    const prior = priorPeople.get(id);
    for (const currency of ['cash', 'ammo', 'cb']) {
      const matched = receipts.filter(r => r.character_id === id && r.currency === currency);
      const birth = prior ? '0' : currency === 'cash' ? '500' : currency === 'ammo' ? '25' : '0';
      parity(checks, { resource: currency, owner: `character:${id}`,
        before: prior ? currency === 'cash' ? exactSum([prior.cash, prior.bank]) : prior[currency] : '0',
        after: currency === 'cash' ? exactSum([person.cash, person.bank]) : person[currency],
        expectedDelta: exactSum([birth, ...matched.map(r => r.amount), currency === 'ammo' ? ammoEscrow.personal.get(id) || '0' : '0']),
        authority: [...reference('transactions', matched), ...(currency === 'ammo' ? ammoEscrow.movements.filter(r => r.seller === id || r.buyer === id).flatMap(r => r.authority) : []),
          ...(!prior ? [{ rule: 'Canonical character defaults: cash500/ammo25/cb0' }] : [])] });
    }
  }
  for (const receipt of receipts.filter(r => r.character_id && ['cash', 'ammo', 'cb'].includes(r.currency)))
    assert(finalPeople.has(receipt.character_id), `Personal receipt references an unobserved character: ${receipt.id}`);

  const omrBefore = omrBuckets(before), omrAfter = omrBuckets(after), omrReceipts = receipts.filter(r => r.currency === 'omr');
  const mint = r => r.reason.startsWith('mission:') || r.reason.startsWith('emission:') || ['prize:omr', 'desk:buyback', 'yield:buyback', 'drop:claim'].includes(r.reason);
  const burn = r => [...DESK.SINK_REASONS, DESK_RECYCLE_REASON].some(pattern => matches(r.reason, pattern));
  parity(checks, { resource: 'omr', owner: 'all-canonical-in-game-buckets', before: exactSum(omrBefore.map(r => r.amount)),
    after: exactSum(omrAfter.map(r => r.amount)), expectedDelta: exactSum([net(omrReceipts, mint), net(omrReceipts, burn)]),
    authority: reference('transactions', omrReceipts), kind: 'exact-supply-parity' });
  // Preserve every bucket delta even where source/destination lineage is not implemented yet.
  const bucketKey = r => tuple(r.table, r.owner, r.field), oldBuckets = indexed(omrBefore, bucketKey, 'OMR bucket'), newBuckets = indexed(omrAfter, bucketKey, 'OMR bucket');
  const omrMovements = [...new Set([...oldBuckets.keys(), ...newBuckets.keys()])].map(key => ({ key,
    before: oldBuckets.get(key)?.amount ?? '0', after: newBuckets.get(key)?.amount ?? '0' }))
    .filter(r => exactSum([r.after, negate(r.before)]) !== '0');
  const unknownOmr = omrMovements.filter(row => !familyEntry.omrKeys.has(row.key) && !familyDissolution.omrKeys.has(row.key));
  if (unknownOmr.length) unsupported.push({ kind: 'omr-owner-lineage', detail: 'Aggregate exact supply checked; remaining per-owner transfers lack complete attribution', buckets: unknownOmr.map(r => r.key) });

  const stackKey = r => tuple(r.owner_scope, r.owner_id, r.template_id, r.quality);
  const oldStacks = indexed(rows(before, 'item_stacks'), stackKey, 'stacks'), newStacks = indexed(rows(after, 'item_stacks'), stackKey, 'stacks');
  const stackEvents = events.filter(e => ['stack_granted', 'stack_consumed'].includes(e.event_kind));
  const eventStackKey = e => tuple(e.event_kind === 'stack_granted' ? e.to_owner_scope : e.from_owner_scope,
    e.event_kind === 'stack_granted' ? e.to_owner_id : e.from_owner_id, e.template_id, e.quality);
  for (const key of new Set([...oldStacks.keys(), ...newStacks.keys(), ...stackEvents.map(eventStackKey)])) {
    const matched = stackEvents.filter(e => eventStackKey(e) === key).sort((a,b) => BigInt(a.sequence) < BigInt(b.sequence) ? -1 : 1);
    let quantity = oldStacks.get(key)?.quantity ?? 0;
    for (const event of matched) {
      assert.equal(exactSum([event.quantity_before]), exactSum([quantity]), 'Stack event prior quantity mismatch');
      assert.equal(exactSum([event.quantity_before, event.quantity_delta]), exactSum([event.quantity_after]), 'Stack event internal quantity mismatch');
      quantity = event.quantity_after;
    }
    parity(checks, { resource: 'stack', owner: key, before: oldStacks.get(key)?.quantity ?? 0, after: newStacks.get(key)?.quantity ?? 0,
      expectedDelta: exactSum(matched.map(e => e.quantity_delta)), authority: reference('item_events', matched) });
  }

  const eventById = indexed(rows(after, 'item_events'), r => r.id, 'item events');
  for (const input of inputs) {
    const event = eventById.get(input.event_id); assert(event, 'Input lacks immutable event');
    assert.equal(input.mutation_id, event.mutation_id); assert.equal(input.definition_hash, event.definition_hash);
    assert.equal(input.snapshot_json, event.snapshot_json); assert.equal(input.lot_id, event.lot_id); assert.equal(input.item_id, event.item_id);
    assert.equal(exactSum([input.quantity_before, negate(input.removed_quantity)]), exactSum([input.quantity_after]), 'Input internal quantity mismatch');
  }
  for (const output of outputs) {
    const event = eventById.get(output.event_id); assert(event, 'Output lacks immutable event');
    assert.equal(output.mutation_id, event.mutation_id); assert.equal(output.definition_hash, event.definition_hash);
    assert.equal(output.snapshot_json, event.snapshot_json); assert.equal(output.lot_id, event.lot_id); assert.equal(output.item_id, event.item_id);
    assert.equal(exactSum([output.quantity]), event.event_branch === 'observation' ? '0' : exactSum([event.quantity_after]), 'Output quantity mismatch');
  }
  for (const [table, field, idField] of [['item_lots', 'remaining_quantity', 'lot_id'], ['item_instances', null, 'id']]) {
    const old = indexed(rows(before, table), r => r[idField], table), next = indexed(rows(after, table), r => r[idField], table);
    for (const id of new Set([...old.keys(), ...next.keys()])) {
      assert(next.has(id), `Audited item disappeared: ${table}/${id}`);
      const prior = old.get(id), final = next.get(id), quantity = r => !r ? 0 : field ? r[field] : r.state === 'consumed' ? 0 : 1;
      const matched = events.filter(e => field ? e.lot_id === id : e.item_id === id).sort((a,b) => BigInt(a.sequence) < BigInt(b.sequence) ? -1 : 1);
      let current = quantity(prior), owner = prior ? tuple(prior.owner_scope, prior.owner_id) : null;
      for (const event of matched) {
        if (event.event_branch === 'observation') { assert(prior, 'Observation cannot create an item'); continue; }
        const created = ['created', 'lot_granted', 'lot_split_output', 'unique_granted'].includes(event.event_kind);
        const consumed = ['consumed', 'unique_consumed'].includes(event.event_kind);
        const beforeQuantity = event.quantity_before ?? (created ? 0 : 1), afterQuantity = event.quantity_after ?? (consumed ? 0 : 1);
        assert.equal(exactSum([beforeQuantity]), exactSum([current]), 'Item event prior quantity mismatch');
        if (event.from_owner_scope) assert.equal(tuple(event.from_owner_scope, event.from_owner_id), owner, 'Item event owner mismatch');
        if (event.to_owner_scope) owner = tuple(event.to_owner_scope, event.to_owner_id);
        current = afterQuantity;
        if (event.quantity_delta != null) assert.equal(exactSum([beforeQuantity, event.quantity_delta]), exactSum([afterQuantity]), 'Item event internal quantity mismatch');
      }
      assert.equal(exactSum([current]), exactSum([quantity(final)]), 'Item final quantity lacks event lineage');
      assert.equal(owner, tuple(final.owner_scope, final.owner_id), 'Item final owner lacks event lineage');
      if (!matched.length) assert.deepEqual(final, prior, 'Item state changed without an event');
      checks.push({ kind: 'event-quantity-owner-parity', resource: table, owner: id, before: exactSum([quantity(prior)]), after: exactSum([quantity(final)]), drift: '0', authority: reference('item_events', matched) });
    }
  }

  const held = (state, id) => exactSum(rows(state, 'world_operation_capital').filter(r => r.operation_id === id && r.state === 'held').map(r => r.amount));
  const oldCapital = indexed(rows(before, 'world_operation_capital'), r => tuple(r.operation_id, r.role_id, r.requirement_id), 'operation capital');
  const newCapital = indexed(rows(after, 'world_operation_capital'), r => tuple(r.operation_id, r.role_id, r.requirement_id), 'operation capital');
  for (const [key, prior] of oldCapital) {
    const final = newCapital.get(key); assert(final, 'Capital disposition row removed');
    if (prior.state === 'held' && ['account_id', 'character_id', 'amount'].some(field => final[field] !== prior[field])) {
      const closed = receipts.some(r => r.currency === 'cash' && r.counterparty === prior.operation_id
        && ['coordination:capital:refund', 'coordination:capital:spend', 'coordination:capital:forfeit'].includes(r.reason)
        && exactSum([String(r.amount).startsWith('-') ? negate(r.amount) : r.amount]) === exactSum([prior.amount]));
      const reopened = receipts.some(r => r.currency === 'cash' && r.counterparty === final.operation_id
        && r.reason === 'coordination:capital:deposit' && r.character_id === final.character_id
        && exactSum([negate(r.amount)]) === exactSum([final.amount]));
      assert(closed && reopened, 'Held capital owner/amount rewritten without a disposition');
      // Multiple commits in one job can close then refill a role. These receipts
      // prevent accepting an unexplained rewrite; exact role attribution remains
      // explicitly unsupported until operation revision events are replayed.
    }
  }
  for (const id of new Set([...rows(before, 'world_operation_capital'), ...rows(after, 'world_operation_capital')].map(r => r.operation_id))) {
    const matched = receipts.filter(r => r.currency === 'cash' && r.counterparty === id && r.reason.startsWith('coordination:capital:'));
    const term = reason => net(matched, r => r.reason === `coordination:capital:${reason}`);
    parity(checks, { resource: 'cash', owner: `operation:${id}`, before: held(before, id), after: held(after, id),
      expectedDelta: exactSum([negate(term('deposit')), negate(term('refund')), term('spend'), term('forfeit')]), authority: reference('transactions', matched) });
  }
  if (json(rows(before, 'world_operation_capital')) !== json(rows(after, 'world_operation_capital')))
    unsupported.push({ kind: 'capital-role-lineage', detail: 'Exact personal and per-operation held cash checked; full role/revision event linkage remains to be integrated' });
  const loanHeld = state => exactSum(rows(state, 'loans').filter(r => r.status === 'open').map(r => r.principal));
  parity(checks, { resource: 'cash', owner: 'open-loan-escrow', before: loanHeld(before), after: loanHeld(after),
    expectedDelta: exactSum([negate(net(receipts, r => r.currency === 'cash' && ['loan:offer', 'loan:take', 'loan:refund'].includes(r.reason))),
      net(receipts, r => r.currency === 'cash' && ['loan:death', 'loan:loot'].includes(r.reason))]),
    authority: reference('transactions', receipts.filter(r => r.reason.startsWith('loan:'))) });
  const cars = reconcileCarResources(before, after, { carMeltProvenance, carAcquisitionProvenance });
  checks.push(...cars.checks); unsupported.push(...cars.unsupported);
  const seasonConversions = reconcileSeasonConversions(before, after, { identity, duelSelection });
  checks.push(...seasonConversions.checks); unsupported.push(...seasonConversions.unsupported);
  const seasonCrowns = reconcileStoredSeasonCrowns(before, after, { seasonElectionProvenance, identity });
  checks.push(...seasonCrowns.checks); unsupported.push(...seasonCrowns.unsupported);
  const boats = reconcileNpcBoats(before, after, { identity, npcBoatProvenance });
  checks.push(...boats.checks); unsupported.push(...boats.unsupported);
  const remainingCargo = state => rows(state, 'character_cargo').filter(row => !npcCargo.cargoKeys.has(tuple(row.character_id, row.good_id)));
  if (json(remainingCargo(before)) !== json(remainingCargo(after)))
    unsupported.push({ kind: 'observed-table-change', table: 'character_cargo', detail: 'Cargo movement outside exact resident purchase remains unclassified' });
  const observedOnly = ['account_gear', 'market_listings', 'exchange_pool', 'bounties', 'commission_proposals', 'favors',
    'loan_house', 'convoy_insurance', 'poker_tournaments', 'poker_entries', 'grand_prix', 'grand_prix_entries', 'stakes_races',
    'stakes_entries', 'shipment_days', 'shipment_takes', 'bespoke_pieces', 'bespoke_serials', 'campaign_progress',
    'drop_allocations', 'chain_reserve', 'vouchers', 'operation_escrow'];
  for (const table of observedOnly) if (!(table === 'exchange_pool' && workerTransitions.exchange) && json(rows(before, table)) !== json(rows(after, table)))
    unsupported.push({ kind: 'observed-table-change', table, detail: 'Change observed; complete resource disposition classifier is not implemented' });
  if (ammoEscrow.otherListingChanges) unsupported.push({ kind: 'observed-table-change', table: 'listings', detail: 'Non-ammo escrow lineage remains unsupported' });
  const unknownBids = state => rows(state, 'district_bids').filter(row => !turfTerminal.settledDistricts.has(row.district_id));
  if (json(unknownBids(before)) !== json(unknownBids(after))) unsupported.push({ kind: 'observed-table-change', table: 'district_bids', detail: 'Stake/raise and remaining escrow changes are not classified by the terminal subset' });
  const oldDistricts = indexed(rows(before, 'districts'), row => row.id, 'district'), newDistricts = indexed(rows(after, 'districts'), row => row.id, 'district');
  if ([...new Set([...oldDistricts.keys(), ...newDistricts.keys()])].some(id => {
    const a = oldDistricts.get(id), b = newDistricts.get(id); if (!a || !b) return true;
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].some(field => !turfTerminal.districtFields.get(id)?.has(field) && json(a[field]) !== json(b[field]));
  })) unsupported.push({ kind: 'observed-table-change', table: 'districts', detail: 'Unclassified district fields retained, including setup/seizure/war/dissolution and other contests' });
  const oldFamilies = indexed(rows(before, 'gangs'), row => row.id, 'Family'), newFamilies = indexed(rows(after, 'gangs'), row => row.id, 'Family');
  const remainingFamilyChanges = [...new Set([...oldFamilies.keys(), ...newFamilies.keys()])].filter(id => {
    if (familyDissolution.dissolved.has(id)) return false;
    if (familyEntry.founded.has(id)) return Object.keys(newFamilies.get(id)).some(field => !familyEntry.familyFields.get(id)?.has(field));
    const a = oldFamilies.get(id), b = newFamilies.get(id); if (!a || !b) return true;
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].some(field => !workerTransitions.familyFields.get(id)?.has(field) && !familyEntry.familyFields.get(id)?.has(field)
      && !(field === 'treasury' && turfTerminal.treasuryOwners.has(id)) && json(a[field]) !== json(b[field]));
  });
  if (remainingFamilyChanges.length) unsupported.push({ kind: 'family-lineage', familyIds: remainingFamilyChanges,
    detail: 'Remaining Family rows/fields retained; war, turf, dissolution, weekly/seasonal and other lineage remain unsupported' });
  const unmatchedMembers = state => rows(state, 'gang_members').filter(row => !familyEntry.founderMembers.has(row.character_id) && !familyDissolution.dissolved.has(row.gang_id));
  if (json(unmatchedMembers(before)) !== json(unmatchedMembers(after))) unsupported.push({ kind: 'observed-table-change', table: 'gang_members',
    detail: 'Membership/role change outside exact formation remains unclassified' });
  const restrictedChanges = unsupported.length ? resourceTableChanges(before, after) : null;
  if (restrictedChanges) verifyResourceTableChanges(before, after, restrictedChanges);
  return { format: 1, identity, beforeHash: worldResourceHash(before), afterHash: worldResourceHash(after), receipts,
    itemEvents: events, mutationInputs: inputs, mutationOutputs: outputs, checks, cars, workerTransitions: { movements: workerTransitions.movements }, npcCargo: { movements: npcCargo.movements },
    boats: { movements: boats.movements, scope: 'One source-pinned default original worker NPC dinghy grant with exact owner/asset and recorded random inputs. No authored boat grant receipt exists. Retirement, sale, estate, NFT and compound dispositions remain unsupported.' },
    seasonCrowns: { movements: seasonCrowns.movements, elections: seasonCrowns.elections, notificationMetadata: seasonCrowns.notificationMetadata,
      scope: 'One stored winner, one-way claim, exact account +1 and fresh living-owner notice. Initial winner selection, empty/ambiguous owner and compound awards remain unsupported. Other notifications are metadata, never reward authority.' }, seasonConversions: { movements: seasonConversions.movements,
      scope: 'One fresh recap bound to its unique season_convert receipt and living character/account, exact canonical resets and positive prestige only. Zero-gain recaps are status-only. Crown, duel-title, existing-recap and compound transitions remain unsupported.' }, turfTerminal: { movements: turfTerminal.movements,
      scope: 'One unchartered contest with live bidders: exact consumed escrow, winner full burn, loser floored refund/remainder burn, treasury and garrison. Original worker authority is separately verified in native evidence. Stakes, charter/dissolved/multiple-contest and territory side effects remain unqualified.' }, familyDissolution: { movements: familyDissolution.movements,
      scope: 'One voluntary living-member Family terminal: cash/ammo destroyed, exact OMR reserve recycled to desk plus lifetime input. Request authorization is independently bound in native proof. Estate/death, territorial/war/governance cleanup, multiple-Family and other compound terminals remain unqualified.' }, familyEntry: { movements: familyEntry.movements,
      scope: 'Ordinary formation cash sink and exact cash/OMR member tribute with original membership and per-Family custody. Ammo banks remain unchanged; no personal ammo-tribute route exists. HTTP body authorization is separately verified in the focused native proof.' }, pressureCash: { movements: pressureCash.movements,
      scope: 'Original check-in quote/latches, fixed reciprocal armory purchase, exact pocket/vault/transit deposit. Request binding and unrelated accrued rewards remain outside this classifier.' }, ammoEscrow: { movements: ammoEscrow.movements,
      scope: 'Exact personal plus owned live ammo escrow; list/pull custody and fresh reciprocal purchase receipts. HTTP request binding and other escrow terminals are not reconstructed.' },
    omrBuckets: { before: omrBefore, after: omrAfter, movements: omrMovements },
    unsupported, restrictedChangesSha256: restrictedChanges ? sha256(restrictedChanges) : null,
    ...(includeRestrictedChanges && restrictedChanges ? { restrictedChanges } : {}),
    status: unsupported.length ? 'PASS_PARITY_WITH_UNSUPPORTED_LINEAGE' : 'PASS_SCOPED_PARITY', qualifyingFullResourcePass: false,
    coverageMissing: ['Complete cash creation/destruction/transfer taxonomy', 'Every OMR per-owner transfer lineage and real-chain backing',
      'Full lot definitions, mutation provenance and custody semantics (retain canonical invariant checks)',
      'Legacy inventory and remaining escrow/Family/season/contract lineage', 'Per-commit proxy integration, overlapping transactions and compound abort traces'] };
}

export function createWorldResourceObserver({ pool, record = async () => {}, requireSupportedReasons = false }) {
  let active = false;
  return { snapshot: () => snapshotWorldResources(pool),
    async observe(identity, work) {
      assert(!active, 'Resource observations must be isolated; overlapping/nested before-after scopes misattribute commits'); active = true;
      let before, after, value, actionError, journal;
      try {
        before = await snapshotWorldResources(pool);
        try { value = await work(); } catch (error) { actionError = error; }
        after = await snapshotWorldResources(pool); journal = reconcileWorldResources(before, after, { identity });
        await record({ kind: 'world-resource-boundary', journal, actionOutcome: actionError ? 'THREW' : 'RETURNED',
          ...(actionError ? { actionError: { code: actionError.code, message: actionError.message } } : {}) });
        if (requireSupportedReasons) assert.equal(journal.unsupported.length, 0, 'Unsupported resource transition encountered');
        if (actionError) throw actionError;
        return value;
      } catch (error) {
        await record({ kind: 'world-resource-failure', identity, before, after, journal, error: { code: error.code, message: error.message, stack: error.stack } });
        throw error;
      } finally { active = false; }
    },
  };
}
