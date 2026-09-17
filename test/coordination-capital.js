// Cash escrow uses authentic operation mutation roots. Explicit PostgreSQL mode
// creates one disposable schema and never reads the game's DATABASE_URL.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { newDb, DataType } from 'pg-mem';
import { dbCaps, registerPgMemCompatibility } from '../src/db.js';
import { withItemMutation, withItemTransaction } from '../src/items.js';
import { depositCapital, refundCapital, settleCapital } from '../src/coordination/capital.js';

const postgres = process.argv.includes('--postgres');
let pool, cleanup;
if (postgres) {
  assert(process.env.COORDINATION_TEST_DATABASE_URL, 'Explicit COORDINATION_TEST_DATABASE_URL required');
  const endpoint = new URL(process.env.COORDINATION_TEST_DATABASE_URL);
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname), 'Only isolated loopback PostgreSQL is allowed');
  const { Pool } = await import('pg');
  const base = new Pool({ connectionString: endpoint.toString() });
  const namespace = `coordination_capital_${crypto.randomBytes(8).toString('hex')}`;
  await base.query(`CREATE SCHEMA ${namespace}`);
  pool = new Pool({ connectionString: endpoint.toString(),
    options: `-c search_path=${namespace} -c lock_timeout=8000 -c statement_timeout=12000` });
  cleanup = async () => { await pool.end(); await base.query(`DROP SCHEMA ${namespace} CASCADE`); await base.end(); };
  dbCaps.skipLocked = true;
} else {
  const mem = newDb({ noAstCoverageCheck: true });
  registerPgMemCompatibility(mem, DataType);
  const { Pool } = mem.adapters.createPg(); pool = new Pool(); cleanup = () => pool.end(); dbCaps.skipLocked = false;
}

const key = () => crypto.randomUUID();
const OPERATION = 'capital-operation', A = 'capital-a', B = 'capital-b', DEAD = 'capital-dead';
const owner = (accountId) => ({ scope: 'account', id: accountId });
const character = (accountId) => `${accountId}-ch`;
const request = (requirementId, amount = 100, accountId = A, roleId = 'financier') =>
  ({ operationId: OPERATION, roleId, requirementId, characterId: character(accountId), amount });
const refundRequest = ({ operationId, roleId, requirementId }) => ({ operationId, roleId, requirementId });
const snapshot = async () => Object.fromEntries(await Promise.all([
  'characters', 'world_operation_capital', 'transactions', 'item_mutation_guards', 'item_events',
].map(async (table) => [table, (await pool.query(`SELECT * FROM ${table}`)).rows
  .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))])));
const cash = async (id) => Number((await pool.query('SELECT cash FROM characters WHERE id=$1', [id])).rows[0].cash);

// This trusted caller models the coordinator's documented lock order: all original/current
// characters, then operation, then the opaque declared operation_action mutation root.
async function mutate(accountId, logical, action, options = {}) {
  const selected = options.pool ?? pool;
  return withItemTransaction(selected, async (client) => {
    const deposits = (await client.query('SELECT character_id FROM world_operation_capital WHERE operation_id=$1', [OPERATION])).rows;
    const current = (await client.query('SELECT id FROM characters WHERE alive=true')).rows;
    const ids = [...new Set([...deposits.map((row) => row.character_id), ...current.map((row) => row.id),
      ...(logical.characterId ? [logical.characterId] : [])])].sort();
    for (const id of ids) await client.query('SELECT id FROM characters WHERE id=$1 FOR UPDATE', [id]);
    await client.query('SELECT id FROM world_operations WHERE id=$1 FOR UPDATE', [OPERATION]);
    return withItemMutation(client, options.owner ?? owner(accountId), options.kind ?? 'operation_action', options.key ?? key(),
      { ...logical, itemAuthority: { operations: options.operations ?? [OPERATION], destinations: [] } },
      (mutation) => action(client, mutation));
  });
}
const deposit = (accountId, input, options) => mutate(accountId, { action: 'deposit', ...input },
  (client, mutation) => depositCapital(client, input, mutation), options);
const refund = (accountId, input, options) => mutate(accountId, { action: 'refund', ...input },
  (client, mutation) => refundCapital(client, input, mutation), options);
const settle = (accountId, disposition, options) => mutate(accountId, { action: 'settle', operationId: OPERATION, disposition },
  (client, mutation) => settleCapital(client, OPERATION, disposition, mutation), options);
async function refused(action, code, label = code) {
  const before = await snapshot();
  await assert.rejects(action, { code }, label);
  assert.deepEqual(await snapshot(), before, `${label}: no cash, escrow, ledger or mutation residue`);
}
async function conserved() {
  const rows = (await pool.query('SELECT amount,state FROM world_operation_capital WHERE operation_id=$1', [OPERATION])).rows;
  const held = rows.filter(({ state }) => state === 'held').reduce((sum, row) => sum + Number(row.amount), 0);
  const entries = (await pool.query("SELECT * FROM transactions WHERE counterparty=$1 AND reason LIKE 'coordination:capital:%'", [OPERATION])).rows;
  const sum = (reason) => entries.filter((row) => row.reason === `coordination:capital:${reason}`).reduce((n, row) => n + Number(row.amount), 0);
  assert.equal(held, -sum('deposit') - sum('refund') + sum('spend') + sum('forfeit'), 'Held cash reconciles exactly to signed capital history');
  for (const entry of entries) {
    assert.equal(entry.currency, 'cash');
    assert(['deposit', 'refund', 'spend', 'forfeit'].some((reason) => entry.reason === `coordination:capital:${reason}`));
    if (['coordination:capital:spend', 'coordination:capital:forfeit'].includes(entry.reason)) {
      assert.equal(entry.character_id, null); assert.equal(entry.account_id, null); assert(Number(entry.amount) < 0);
    } else {
      assert(entry.character_id); assert(entry.account_id);
      assert.equal(Number(entry.amount) > 0, entry.reason.endsWith(':refund'));
    }
  }
}
function faultPool(match, timing = 'after') {
  let fired = false;
  return { query: (...args) => pool.query(...args), async connect() {
    const client = await pool.connect();
    return { release: (...args) => client.release(...args), async query(sql, params) {
      const inject = !fired && match.test(sql);
      if (inject) fired = true;
      if (inject && timing === 'before') throw Object.assign(Error('injected capital failure'), { code: 'capital_injected_failure' });
      const result = await client.query(sql, params);
      if (inject && timing === 'after') throw Object.assign(Error('injected capital failure'), { code: 'capital_injected_failure' });
      return result;
    } };
  } };
}

try {
  await pool.query(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  for (const accountId of [A, B, DEAD]) {
    await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [accountId]);
    await pool.query('INSERT INTO characters(id,account_id,name,season,cash) VALUES($1,$2,$2,1,500.25)', [character(accountId), accountId]);
  }
  await pool.query(`INSERT INTO world_operations(id,graph_id,graph_version,operation_node_id,crew_id,opened_by_account_id)
    VALUES($1,'capital-fixture',1,'operation:capital','capital-crew',$2)`, [OPERATION, A]);
  const input = request('entry-capital'), refundInput = refundRequest(input);
  await assert.rejects(depositCapital(pool, input, {}), { code: 'item_transaction_required' });
  await refused(() => mutate(A, input, (client) => depositCapital(client, input, {})), 'item_transaction_required', 'Forged root token');
  await refused(() => deposit(A, input, { operations: [] }), 'item_mutation_authority', 'Undeclared operation');
  await refused(() => deposit(A, input, { kind: 'craft' }), 'item_mutation_authority', 'Wrong root kind');
  await refused(() => refund(A, refundInput, { operations: [] }), 'item_mutation_authority', 'Undeclared refund operation');
  await refused(() => settle(A, 'spend', { operations: [] }), 'item_mutation_authority', 'Undeclared settlement operation');
  await refused(() => deposit(A, { ...input, characterId: character(B) }), 'capital_unavailable', 'Foreign character');
  await refused(() => deposit(A, request('too-expensive', 501)), 'capital_cash', 'Insufficient gameplay cash');
  for (const invalid of [0, -1, 0.5, 1000001, Number.MAX_SAFE_INTEGER, '100']) {
    await refused(() => deposit(A, { ...input, amount: invalid }), 'bad_capital_request');
  }
  await refused(() => deposit(A, { ...input, currency: 'omr' }), 'bad_capital_request', 'No alternate currency authority');
  await refused(() => settle(A, 'transfer'), 'bad_capital_request');

  const duplicateKey = key();
  const concurrent = await Promise.all([deposit(A, input, { key: duplicateKey }), deposit(A, input, { key: duplicateKey })]);
  assert.deepEqual(concurrent[0], concurrent[1]);
  assert.equal(concurrent[0].state, 'held'); assert.equal(concurrent[0].accountId, A);
  assert.equal(await cash(character(A)), 400.25, 'Concurrent identical commands debit once and retain fractional cash');
  assert.equal((await pool.query("SELECT id FROM transactions WHERE reason='coordination:capital:deposit'")).rows.length, 1);
  const committed = await snapshot();
  assert.deepEqual(await deposit(A, input, { key: duplicateKey }), concurrent[0]);
  assert.deepEqual(await snapshot(), committed);
  await refused(() => deposit(A, { ...input, amount: 101 }, { key: duplicateKey }), 'idempotency_conflict');
  await refused(() => deposit(A, input), 'capital_held', 'Another command cannot debit an already-held slot');
  await conserved();

  // A trusted coordinator owner can refund another depositor; the stored character is
  // the only recipient, never the current mutation owner or a client-selected account.
  const refundKey = key(), withdrawn = await refund(B, refundInput, { key: refundKey });
  assert.equal(withdrawn.state, 'refunded'); assert.equal(withdrawn.accountId, A);
  assert.equal(await cash(character(A)), 500.25); assert.equal(await cash(character(B)), 500.25);
  assert.deepEqual(await refund(B, refundInput, { key: refundKey }), withdrawn);
  assert.equal(await refund(B, refundInput), null);
  assert.equal(await refund(B, { ...refundInput, requirementId: 'never-deposited' }), null);
  await conserved();

  const reassigned = { ...input, characterId: character(B), amount: 75 };
  assert.equal((await deposit(B, reassigned)).accountId, B, 'Closed slot may be re-funded by a replacement role owner');
  await refund(A, refundInput);
  assert.equal(await cash(character(A)), 500.25); assert.equal(await cash(character(B)), 500.25);
  await conserved();

  const competing = request('competing-keys', 40);
  const race = await Promise.allSettled([deposit(A, competing), deposit(A, competing)]);
  assert.equal(race.filter(({ status }) => status === 'fulfilled').length, 1);
  assert.equal(race.find(({ status }) => status === 'rejected').reason.code, 'capital_held');
  assert.equal(await cash(character(A)), 460.25);
  await refund(B, refundRequest(competing)); await conserved();
  console.log('coordination-capital: root authority, cash bounds, duplicate commands, refund and role replacement pass');

  // Force errors after each substantive write, including the real ledger INSERT.
  for (const [index, pattern, timing] of [
    [0, /^UPDATE characters SET cash=cash-/, 'after'],
    [1, /^INSERT INTO world_operation_capital/, 'after'],
    [2, /^INSERT INTO transactions /, 'before'],
    [3, /^INSERT INTO transactions /, 'after'],
  ]) {
    const failing = request(`rollback-${index}`), retryKey = key();
    await refused(() => deposit(A, failing, { key: retryKey, pool: faultPool(pattern, timing) }), 'capital_injected_failure');
    assert.equal((await deposit(A, failing, { key: retryKey })).state, 'held');
    await refund(B, refundRequest(failing)); await conserved();
  }
  await refused(() => deposit(B, reassigned, { pool: faultPool(/^UPDATE world_operation_capital SET account_id=/) }),
    'capital_injected_failure', 'Closed-row re-deposit rollback restores exact prior row');

  const refundFailure = request('refund-rollback');
  await deposit(A, refundFailure);
  await refused(() => refund(B, refundRequest(refundFailure), { pool: faultPool(/^INSERT INTO transactions /) }),
    'capital_injected_failure', 'Refund audit failure restores cash and held escrow');
  await refused(() => mutate(B, { action: 'caught-failure' }, async (client, mutation) => {
    try { await refundCapital(client, refundRequest(refundFailure), mutation); } catch { /* hostile integration catches leaf error */ }
    return { incorrectlyCommitted: true };
  }, { pool: faultPool(/^INSERT INTO transactions /) }), 'capital_injected_failure', 'Caught helper failure still poisons the root');
  await refund(B, refundRequest(refundFailure)); await conserved();

  const overflow = request('refund-overflow');
  await deposit(A, overflow);
  await pool.query('UPDATE characters SET cash=$2 WHERE id=$1', [character(A), Number.MAX_SAFE_INTEGER - 50]);
  await refused(() => refund(B, refundRequest(overflow)), 'capital_overflow');
  await pool.query('UPDATE characters SET cash=400.25 WHERE id=$1', [character(A)]);
  await refund(B, refundRequest(overflow)); await conserved();
  console.log('coordination-capital: cash/escrow/ledger rollback, caught-error poisoning and overflow refusal pass');

  await deposit(A, request('z-second', 60, A, 'z-last'));
  await deposit(B, request('a-first', 70, B, 'a-first'));
  const beforeSpendCash = [await cash(character(A)), await cash(character(B))];
  await refused(() => settle(A, 'spend', { pool: faultPool(/^INSERT INTO transactions /) }), 'capital_injected_failure', 'Spend rollback restores held capital');
  const spendKey = key(), spent = await settle(A, 'spend', { key: spendKey });
  assert.deepEqual(spent.map(({ roleId }) => roleId), ['a-first', 'z-last']);
  assert(spent.every(({ state }) => state === 'spent'));
  assert.deepEqual([await cash(character(A)), await cash(character(B))], beforeSpendCash, 'Spending escrow does not debit characters again');
  assert.deepEqual(await settle(A, 'spend', { key: spendKey }), spent);
  assert.deepEqual(await settle(A, 'spend'), []); await conserved();

  const deadInput = request('death', 80, DEAD);
  await deposit(DEAD, deadInput);
  await pool.query('UPDATE characters SET alive=false WHERE id=$1', [character(DEAD)]);
  await pool.query('INSERT INTO characters(id,account_id,name,season,cash) VALUES($1,$2,$3,1,91)',
    ['capital-heir', DEAD, 'Capital Heir']);
  const deadCash = await cash(character(DEAD));
  await refused(() => deposit(DEAD, request('dead-deposit', 1, DEAD)), 'capital_unavailable');
  await refused(() => refund(B, refundRequest(deadInput), { pool: faultPool(/^INSERT INTO transactions /) }),
    'capital_injected_failure', 'Forfeiture audit failure restores held capital');
  const forfeited = await refund(B, refundRequest(deadInput));
  assert.equal(forfeited.state, 'forfeited');
  assert.equal(await cash(character(DEAD)), deadCash); assert.equal(await cash('capital-heir'), 91, 'An heir never receives dead-character capital');
  await conserved();

  await deposit(A, request('refund-all-a', 20, A, 'a'));
  await deposit(B, request('refund-all-b', 30, B, 'b'));
  const refunds = await settle(A, 'refund');
  assert.deepEqual(refunds.map(({ state }) => state), ['refunded', 'refunded']);
  await conserved();
  assert.equal((await pool.query("SELECT id FROM transactions WHERE currency<>'cash'")).rows.length, 0);
  console.log(`coordination-capital: deterministic settlement, death forfeiture and signed cash reconciliation pass (${postgres ? 'postgres' : 'pg-mem'})`);
} finally {
  await cleanup();
}
