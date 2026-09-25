// Read-only, bounded lineage proof. No balancing adjustments or new economy authority.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { exactDecimal } from './rc1-resource-journal.js';
export const OMR_SCALE = 1000000n;
export function omrUnits(value) {
  const { coefficient, scale } = exactDecimal(value);
  if (scale <= 6) return coefficient * 10n ** BigInt(6 - scale);
  const divisor = 10n ** BigInt(scale - 6);
  assert.equal(coefficient % divisor, 0n, `OMR has sub-atomic precision: ${value}`);
  return coefficient / divisor;
}
export const omrText = value => { const n = BigInt(value), sign = n < 0n ? '-' : '', digits = (n < 0n ? -n : n).toString().padStart(7, '0');
  return `${sign}${digits.slice(0, -6)}.${digits.slice(-6)}`; };
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const omrRequestHash = ({ method = 'POST', url, payload }) => crypto.createHash('sha256')
  .update(`${method}\n${url}\n${JSON.stringify(payload ?? null)}`).digest('hex');
export const OMR_TABLES = ['account_persistent', 'characters', 'transactions', 'idempotency', 'desk_inventory', 'family_yield_pool',
  'exchange_pool', 'loans', 'amm_pool', 'street_tax', 'gangs', 'stake_pool', 'dev_fund', 'rwa_dividend_pool', 'rwa_family_dividend_pool', 'auctions', 'auction_consignments'];
export async function snapshotOmr(pool) {
  const client = await pool.connect();
  try { await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); const state = {};
    for (const table of OMR_TABLES) state[table] = (await client.query(`SELECT * FROM ${table}`)).rows.map(row => JSON.parse(JSON.stringify(row)))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    await client.query('COMMIT'); return state;
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
const index = (rows, key, label) => { const result = new Map(); for (const row of rows) { const id = key(row); assert(!result.has(id), `Duplicate ${label}: ${id}`); result.set(id, row); } return result; };
const rowKey = row => row.id;
const receiptKey = row => `${row.account_id}/${row.key}`;
function addedImmutable(before, after, key, label) {
  const old = index(before, key, label), now = index(after, key, label);
  for (const [id, row] of old) assert.deepEqual(now.get(id), row, `Missing/rewritten ${label}: ${id}`);
  return after.filter(row => !old.has(key(row)));
}
export function omrBuckets(state) {
  const buckets = [];
  const add = (table, field, predicate = () => true) => { for (const row of state[table].filter(predicate))
    buckets.push({ key: `${table}/${row.account_id ?? row.id}/${field}`, table, owner: row.account_id ?? row.id, field, amount: omrText(omrUnits(row[field])) }); };
  for (const field of ['omr', 'staked', 'unbonding']) add('account_persistent', field);
  for (const [table, field] of [['amm_pool', 'omr_reserve'], ['street_tax', 'fund'], ['gangs', 'omr_reserve'], ['stake_pool', 'balance'],
    ['dev_fund', 'omr'], ['rwa_dividend_pool', 'pool'], ['rwa_family_dividend_pool', 'pool'], ['family_yield_pool', 'balance'], ['desk_inventory', 'balance']]) add(table, field);
  add('loans', 'collateral_omr', row => row.status === 'active');
  for (const table of ['auctions', 'auction_consignments']) add(table, 'current_bid', row => row.status === 'live');
  return buckets;
}
export const omrStateHash = state => hash({ buckets: omrBuckets(state), transactions: state.transactions, idempotency: state.idempotency,
  loans: state.loans, desk: state.desk_inventory, yield: state.family_yield_pool });
export const OMR_UNSUPPORTED = ['Privileged desk auction sales/buybacks and provider/chain backing', 'OMR mint/emission/drop/mission and external withdrawal',
  'Family tribute/distribution/war/estate, taxes, auction escrow and other OMR sinks', 'Loan default/seizure/death/paper-sale dispositions',
  'Stake commitment/loot and historic reward claims', 'Unrelated cash/material/status transitions and arbitrary per-commit HTTP receipt timing'];

export function reconcileOmr(before, after, { commands = [], logicalAt, allowUnsupported = false } = {}) {
  const receipts = addedImmutable(before.transactions, after.transactions, rowKey, 'transaction');
  const durable = addedImmutable(before.idempotency, after.idempotency, receiptKey, 'durable request receipt');
  const accounts = index(before.account_persistent, row => row.account_id, 'account'), currentAccounts = index(after.account_persistent, row => row.account_id, 'account');
  assert.deepEqual([...accounts.keys()].sort(), [...currentAccounts.keys()].sort(), 'Account creation/removal outside journal scope');
  const characters = index(before.characters, rowKey, 'character');
  const oldBuckets = index(omrBuckets(before), row => row.key, 'bucket'), newBuckets = index(omrBuckets(after), row => row.key, 'bucket');
  const expected = new Map(), lineage = [], checks = [], unknown = [];
  const move = (from, to, value, authority) => { assert(value > 0n, 'Positive movement required');
    expected.set(from, (expected.get(from) || 0n) - value); expected.set(to, (expected.get(to) || 0n) + value);
    lineage.push({ from, to, units: String(value), omr: omrText(value), authority }); };
  const account = (id, field = 'omr') => { assert(accounts.has(id), `Unknown owner: ${id}`); return `account_persistent/${id}/${field}`; };
  const newRequests = new Map();
  const storedRequests = index(after.idempotency, receiptKey, 'request receipt');
  for (const command of commands.filter(row => row.status === 200 && row.key)) {
    const stored = storedRequests.get(`${command.accountId}/${command.key}`);
    assert(stored && stored.status === 200 && stored.body_hash === omrRequestHash(command), 'Successful invocation lacks exact durable owner/route/body receipt');
  }
  for (const row of durable) {
    assert.equal(row.status, 200, 'Only completed successful request receipts classify movements');
    const matching = commands.filter(command => command.accountId === row.account_id && command.key === row.key && omrRequestHash(command) === row.body_hash);
    assert(matching.length, `Receipt missing observed route/body/owner binding: ${receiptKey(row)}`);
    const first = matching[0]; assert(matching.every(command => omrRequestHash(command) === omrRequestHash(first)));
    newRequests.set(receiptKey(row), { command: first, row, response: JSON.parse(row.response) });
  }
  // Canonical lazy release occurs before the caller's action, and has no ledger.
  // Authorize only an observed, non-replayed successful character invocation.
  for (const [id, prior] of accounts) {
    const touches = commands.filter(command => command.accountId === id && command.status === 200 && !command.replayed);
    if (omrUnits(prior.unbonding) > 0n && prior.unbond_at && Number.isFinite(logicalAt) && logicalAt >= Date.parse(prior.unbond_at) && touches.length) {
      assert.equal(currentAccounts.get(id).unbond_at, null, 'Due canonical unbond release did not clear deadline');
      move(account(id, 'unbonding'), account(id), omrUnits(prior.unbonding), [{ rule: 'src/accrual.js original due principal release',
        accountId: id, originalDeadline: prior.unbond_at, logicalAt, invocationHashes: touches.map(omrRequestHash) }]);
    }
  }
  for (const { command, row, response } of newRequests.values()) {
    const authority = [{ table: 'idempotency', accountId: row.account_id, key: row.key, bodyHash: row.body_hash, responseHash: hash(response) }];
    const id = row.account_id, prior = accounts.get(id); assert(prior);
    if (command.url === '/v1/stake') {
      const { coefficient, scale } = exactDecimal(command.payload.amount);
      const requested = scale > 6 ? coefficient / 10n ** BigInt(scale - 6) : coefficient * 10n ** BigInt(6 - scale);
      const available = omrUnits(prior.omr) + (expected.get(account(id)) || 0n), amount = requested < available ? requested : available;
      assert.equal(omrUnits(response.staked), amount, 'Stake floor/min rule disagrees with durable response');
      move(account(id), account(id, 'staked'), amount, authority);
    } else if (command.url === '/v1/unstake') {
      const amount = omrUnits(prior.staked); assert.equal(omrUnits(response.unbonding), amount);
      assert.equal(response.rewards, 0); assert.equal(response.unbondSeconds, 21600);
      assert.equal(Date.parse(currentAccounts.get(id).unbond_at), logicalAt + 21600000, 'Original six-hour deadline changed');
      move(account(id, 'staked'), account(id, 'unbonding'), amount, authority);
    }
  }
  const supported = new Set(['vanity:name', 'window:burn', 'yield:window', 'loan:pledge', 'loan:pledge:return', 'desk:recycle']);
  const omr = receipts.filter(row => row.currency === 'omr'), used = new Set();
  const recycle = omr.filter(row => row.reason === 'desk:recycle');
  for (const row of omr.filter(row => ['vanity:name', 'window:burn'].includes(row.reason))) {
    const value = -omrUnits(row.amount); assert(value > 0n); assert.equal(row.character_id, null);
    const matches = recycle.filter(other => !used.has(other.id) && other.counterparty === row.reason && omrUnits(other.amount) === value);
    assert([...newRequests.values()].some(({ command }) => command.accountId === row.account_id
      && command.url === (row.reason === 'vanity:name' ? '/v1/vanity/name' : '/v1/window/redeem')), 'Sink receipt lacks canonical request owner');
    assert(matches.length, `Missing exact desk recycle for ${row.id}`); const paired = matches[0]; used.add(paired.id);
    assert.equal(paired.account_id, null); assert.equal(paired.character_id, null);
    move(account(row.account_id), 'desk_inventory/1/balance', value, [{ table: 'transactions', id: row.id }, { table: 'transactions', id: paired.id,
      pairing: 'exact reason/amount multiset within declared completed boundary; no fabricated unique cross-receipt link' }]);
  }
  assert.equal(used.size, recycle.length, 'Orphan/duplicate desk recycle receipt');
  for (const row of omr.filter(row => row.reason === 'yield:window')) {
    assert.equal(row.character_id, null); move(account(row.account_id), 'family_yield_pool/1/balance', -omrUnits(row.amount), [{ table: 'transactions', id: row.id }]);
  }
  const loans = index(before.loans, rowKey, 'loan'), finalLoans = index(after.loans, rowKey, 'loan'), loanReceipts = new Set();
  for (const [id, loan] of finalLoans) {
    const prior = loans.get(id); if (!prior) { assert.equal(loan.status, 'open'); continue; }
    if (prior.status !== 'open') assert.equal(loan.borrower_character, prior.borrower_character, 'Loan borrower rewritten');
    for (const field of ['lender_character', 'principal', 'rate', 'hours', 'collateral_omr']) assert.deepEqual(loan[field], prior[field], `Loan authority changed: ${id}/${field}`);
    if (prior.status === loan.status) continue;
    if (omrUnits(loan.collateral_omr) === 0n) continue;
    const pledge = prior.status === 'open' && loan.status === 'active', returned = prior.status === 'active' && loan.status === 'repaid';
    if (!pledge && !returned) { unknown.push({ kind: 'loan-terminal', id, from: prior.status, to: loan.status }); continue; }
    const owner = characters.get(loan.borrower_character)?.account_id; assert(owner, 'Missing loan borrower owner');
    const request = [...newRequests.values()].find(({ command }) => command.accountId === owner && command.url === `/v1/loans/${id}/${pledge ? 'take' : 'repay'}`);
    assert(request, 'Loan transition lacks canonical borrower request receipt');
    const reason = pledge ? 'loan:pledge' : 'loan:pledge:return', value = omrUnits(loan.collateral_omr);
    assert.equal(omrUnits(request.response[pledge ? 'pledgedOmr' : 'pledgeReturned']), value);
    const matches = omr.filter(row => !loanReceipts.has(row.id) && row.reason === reason && row.account_id === owner
      && row.counterparty === loan.lender_character && omrUnits(row.amount) === (pledge ? -value : value));
    assert.equal(matches.length, 1, 'Loan custody requires exact owner/amount/counterparty receipt'); const receipt = matches[0]; loanReceipts.add(receipt.id);
    const from = account(owner), to = `loans/${id}/collateral_omr`;
    move(pledge ? from : to, pledge ? to : from, value, [{ table: 'loans', id, beforeStatus: prior.status, afterStatus: loan.status }, { table: 'transactions', id: receipt.id }]);
  }
  for (const id of loans.keys()) assert(finalLoans.has(id), `Deleted loan authority: ${id}`);
  assert.equal(loanReceipts.size, omr.filter(row => row.reason.startsWith('loan:')).length, 'Orphan loan OMR receipt');
  for (const row of omr) if (!supported.has(row.reason)) unknown.push({ kind: 'unsupported-omr-receipt', id: row.id, reason: row.reason });
  for (const { command, row, response } of newRequests.values()) if (command.url === '/v1/window/redeem') {
    const amount = omrUnits(command.payload.amount), cut = (amount * 500n + 5000n) / 10000n, recycled = amount - cut;
    assert.equal(omrUnits(response.spent), amount); assert.equal(omrUnits(response.familyCut), cut); assert.equal(omrUnits(response.burned), recycled);
    assert.equal(BigInt(response.cash), amount * 500n / OMR_SCALE, 'Window cash rounding disagrees');
    const payouts = receipts.filter(tx => tx.currency === 'cash' && tx.reason === 'window:payout' && characters.get(tx.character_id)?.account_id === row.account_id);
    assert.equal(payouts.length, 1); assert.equal(omrUnits(payouts[0].amount), omrUnits(response.cash));
    const cashBefore = characters.get(payouts[0].character_id), cashAfter = after.characters.find(character => character.id === payouts[0].character_id);
    assert.equal(omrUnits(cashAfter.cash) - omrUnits(cashBefore.cash), omrUnits(response.cash), 'Exact window cash recipient parity');
    for (const [reason, value] of [['window:burn', recycled], ['yield:window', cut]]) {
      const matches = omr.filter(tx => tx.account_id === row.account_id && tx.reason === reason);
      assert.equal(matches.length, 1); assert.equal(omrUnits(matches[0].amount), -value);
    }
    checks.push({ kind: 'window-remainder-and-cash-floor', accountId: row.account_id, units: String(amount), familyUnits: String(cut), recycledUnits: String(recycled), cash: String(response.cash) });
  }
  const equations = [];
  for (const key of [...new Set([...oldBuckets.keys(), ...newBuckets.keys(), ...expected.keys()])].sort()) {
    const previous = omrUnits(oldBuckets.get(key)?.amount || 0), current = omrUnits(newBuckets.get(key)?.amount || 0), delta = expected.get(key) || 0n;
    assert(current >= 0n, `Negative custody: ${key}`);
    const drift = current - previous - delta;
    if (drift !== 0n) unknown.push({ kind: 'unexplained-owner-movement', key, beforeUnits: String(previous), afterUnits: String(current), explainedUnits: String(delta), driftUnits: String(drift) });
    equations.push({ key, beforeUnits: String(previous), afterUnits: String(current), explainedUnits: String(delta), driftUnits: String(drift) });
  }
  const exactField = (table, field, expectedDelta) => { const old = before[table].find(row => Number(row.id) === 1), now = after[table].find(row => Number(row.id) === 1);
    assert.equal(omrUnits(now[field]) - omrUnits(old[field]), expectedDelta, `${table}.${field} receipt parity`); };
  exactField('desk_inventory', 'lifetime_in', recycle.reduce((sum, row) => sum + omrUnits(row.amount), 0n));
  exactField('family_yield_pool', 'lifetime_funded', omr.filter(row => row.reason === 'yield:window').reduce((sum, row) => sum - omrUnits(row.amount), 0n));
  const cashPaid = receipts.filter(row => row.currency === 'cash' && row.reason === 'window:payout').reduce((sum, row) => sum + omrUnits(row.amount), 0n);
  exactField('exchange_pool', 'balance', -cashPaid); exactField('exchange_pool', 'lifetime_paid', cashPaid);
  for (const [table, fields] of [['desk_inventory', ['lifetime_sold', 'lifetime_bought']], ['family_yield_pool', ['lifetime_paid']]])
    for (const field of fields) exactField(table, field, 0n);
  for (const [id, prior] of accounts) assert.equal(omrUnits(currentAccounts.get(id).rewards), omrUnits(prior.rewards), 'Historic reward liability is not an additional supply bucket or supported mint');
  if (!allowUnsupported) assert.equal(unknown.length, 0, `Unclassified OMR movement: ${JSON.stringify(unknown)}`);
  return { version: 1, scope: 'Exact bounded per-owner OMR custody lineage; not all OMR/game resources', logicalAt, beforeHash: hash(before), afterHash: hash(after),
    lineage, equations, checks, unknown, unsupported: OMR_UNSUPPORTED, atomicDecimals: 6, rewardsDoubleCounted: false, fullResourceCoverage: false };
}
