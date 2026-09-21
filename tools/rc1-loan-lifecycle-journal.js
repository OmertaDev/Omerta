// Test-only exact journal for the declared loan/Wanted lifecycle boundaries.
import assert from 'node:assert/strict';
import { equation, exactSum, negate, sha256 } from './rc1-resource-journal.js';

export const LOAN_PROOF_TABLES = ['characters', 'account_persistent', 'transactions', 'loans', 'cars',
  'bounties', 'bounty_contributors', 'street_tax', 'loan_house', 'exchange_pool'];
const stable = ({ boundary, ...state }) => state;
export const loanStateHash = state => sha256(stable(state));
const byId = rows => new Map(rows.map(row => [row.id, row]));
const net = (rows, reason) => exactSum(rows.filter(row => row.reason === reason).map(row => row.amount));
const held = state => exactSum(state.loans.filter(row => row.status === 'open').map(row => row.principal));
const bounties = state => exactSum(state.bounties.map(row => row.amount));
const personal = state => exactSum(state.characters.flatMap(row => [row.cash, row.bank]));
const total = state => exactSum([personal(state), held(state), bounties(state), state.street_tax[0].pool,
  state.loan_house[0].pool, state.exchange_pool[0].balance]);
const reasons = new Set(['loan:offer', 'loan:take', 'loan:refund', 'loan:repay', 'loan:vig', 'loan:house:vig',
  'loan:square', 'bounty:wanted', 'bounty:wanted:refund']);

export async function snapshotLoanResources(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const columns = (await client.query(`SELECT table_name,column_name,data_type FROM information_schema.columns
      WHERE table_schema=current_schema() AND table_name=ANY($1::text[]) ORDER BY table_name,ordinal_position`, [LOAN_PROOF_TABLES])).rows;
    const state = {};
    for (const table of LOAN_PROOF_TABLES) {
      const selection = columns.filter(row => row.table_name === table).map(row => {
        assert(/^[a-z_][a-z_0-9]*$/.test(row.column_name));
        return `"${row.column_name}"${['numeric', 'decimal', 'bigint'].includes(row.data_type) ? '::text' : ''} AS "${row.column_name}"`;
      }).join(',');
      assert(selection, `Missing ${table}`);
      state[table] = JSON.parse(JSON.stringify((await client.query(`SELECT ${selection} FROM "${table}"`)).rows))
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    }
    state.boundary = (await client.query('SELECT pg_current_snapshot()::text AS snapshot')).rows[0];
    await client.query('COMMIT'); return state;
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export function reconcileLoanLifecycle(before, after, { label, result } = {}) {
  for (const table of LOAN_PROOF_TABLES) assert(Array.isArray(before[table]) && Array.isArray(after[table]), `Missing ${table}`);
  const oldReceipts = byId(before.transactions), finalReceipts = byId(after.transactions);
  assert.equal(oldReceipts.size, before.transactions.length); assert.equal(finalReceipts.size, after.transactions.length);
  for (const [id, row] of oldReceipts) assert.deepEqual(finalReceipts.get(id), row, 'Immutable transaction removed/changed');
  const receipts = after.transactions.filter(row => !oldReceipts.has(row.id));
  for (const row of receipts) assert(row.currency === 'cash' && reasons.has(row.reason), `Unclassified receipt ${row.currency}:${row.reason}`);
  const equations = [], authority = receipts.length ? receipts.map(row => ({ table: 'transactions', id: row.id }))
    : [{ canonicalRule: label === 'buyback' ? 'worker.runBuyback result and exchange.carveExchange' : 'No resource change without a canonical disposition' }];
  const check = (owner, prior, final, delta = '0') => equations.push(equation({ resource: 'cash', owner, before: prior, after: final,
    transferredIn: String(delta).startsWith('-') ? '0' : delta,
    transferredOut: String(delta).startsWith('-') ? negate(delta) : '0', authority }));
  const priorCharacters = byId(before.characters); assert.equal(after.characters.length, before.characters.length, 'Birth/death outside scoped lifecycle');
  for (const row of after.characters) {
    const prior = priorCharacters.get(row.id); assert(prior);
    check(`character:${row.id}`, exactSum([prior.cash, prior.bank]), exactSum([row.cash, row.bank]),
      exactSum(receipts.filter(r => r.character_id === row.id).map(r => r.amount)));
    for (const field of ['ammo', 'cb', 'alive']) assert.equal(row[field], prior[field], `Unclassified ${field} movement`);
  }
  for (const row of after.account_persistent) {
    const prior = before.account_persistent.find(r => r.account_id === row.account_id); assert(prior);
    for (const field of ['omr', 'staked', 'unbonding', 'rewards']) assert.equal(row[field], prior[field], `Unclassified ${field} custody`);
  }
  assert.equal(after.account_persistent.length, before.account_persistent.length);
  check('open-loan-escrow', held(before), held(after), negate(exactSum(['loan:offer', 'loan:take', 'loan:refund'].map(r => net(receipts, r)))));
  check('Wanted-bounty-escrow', bounties(before), bounties(after), negate(exactSum(['bounty:wanted', 'bounty:wanted:refund'].map(r => net(receipts, r)))));
  for (const state of [before, after]) {
    for (const row of state.bounty_contributors) assert.equal(row.contributor, 'HOUSE', 'Non-HOUSE bounty outside this scope');
    for (const pot of state.bounties) assert.equal(exactSum([pot.amount]), exactSum(state.bounty_contributors
      .filter(r => r.target_character === pot.target_character && r.kind === pot.kind).map(r => r.amount)), 'Bounty contributor custody mismatch');
    for (const row of state.bounty_contributors) assert(state.bounties.some(pot => pot.target_character === row.target_character && pot.kind === row.kind), 'Orphan bounty share');
  }
  const toWindow = label === 'buyback' ? result?.toWindow || 0 : 0;
  check('street-tax-pool', before.street_tax[0].pool, after.street_tax[0].pool,
    exactSum([net(receipts, 'bounty:wanted'), net(receipts, 'bounty:wanted:refund'), negate(net(receipts, 'loan:square')),
      negate(net(receipts, 'loan:vig')), negate(toWindow)]));
  check('loan-house-pool', before.loan_house[0].pool, after.loan_house[0].pool, net(receipts, 'loan:house:vig'));
  check('redemption-window', before.exchange_pool[0].balance, after.exchange_pool[0].balance, toWindow);
  check('total-declared-cash-custody', total(before), total(after));
  const oldLoans = byId(before.loans), newLoans = byId(after.loans), oldCars = byId(before.cars), newCars = byId(after.cars), carMoves = [];
  assert.equal(oldCars.size, before.cars.length); assert.equal(newCars.size, after.cars.length); assert.equal(newCars.size, oldCars.size);
  const expectedCars = new Map([...oldCars].map(([id, row]) => [id, { ...row }]));
  for (const [id, loan] of newLoans) {
    const prior = oldLoans.get(id);
    if (prior) {
      for (const field of ['id', 'lender_character', 'principal', 'rate', 'hours', 'offered_at', 'offered_to', 'collateral_min', 'collateral_omr'])
        assert.equal(loan[field], prior[field], `Loan identity/terms rewritten: ${field}`);
      if (prior.due_at) assert.equal(loan.due_at, prior.due_at, 'Canonical deadline rewritten');
    }
    assert.equal(exactSum([loan.collateral_omr]), '0', 'OMR collateral not exercised in this case group');
    if (!loan.collateral_car || prior?.status === loan.status) continue;
    const car = expectedCars.get(loan.collateral_car); assert(car, 'Collateral car missing');
    if (prior?.status === 'open' && loan.status === 'active') { assert.equal(car.character_id, loan.borrower_character); car.pledged = true; }
    else if (prior?.status === 'active' && loan.status === 'repaid') car.pledged = false;
    else if (prior?.status === 'active' && loan.status === 'collected') {
      assert.equal(label, 'loan sweep', 'Unclassified collection authority');
      assert.equal(car.character_id, prior.borrower_character); assert(car.pledged);
      Object.assign(car, { character_id: loan.lender_character, pledged: false, race_limit: null, pink_slip: false, nos: 0 });
      carMoves.push({ car: loan.collateral_car, loan: id, from: prior.borrower_character, to: loan.lender_character,
        authority: 'Original sweepLoans grace-forfeit; unchanged due_at plus original GRACE_MS' });
    } else assert.fail('Unclassified collateral disposition');
  }
  for (const id of oldLoans.keys()) assert(newLoans.has(id), 'Loan deletion outside lifecycle scope');
  for (const [id, row] of expectedCars) assert.deepEqual(newCars.get(id), row, 'Unexplained car owner/custody mutation');
  return { label, beforeHash: loanStateHash(before), afterHash: loanStateHash(after), receipts, equations, carMoves,
    status: 'PASS_SCOPED_LOAN_CUSTODY', qualifyingFullResourcePass: false,
    exclusions: ['Other worker resource transitions', 'OMR loan collateral in this case group', 'Complete car mint/transfer/burn taxonomy'] };
}
