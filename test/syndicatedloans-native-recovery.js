import assert from 'node:assert/strict';
import { nativeFixture, observedPool } from './syndicatedloans-native-fixture.js';
const f = await nativeFixture();
async function fault(label, start, intercept, execute, expected = new RegExp(label)) {
  let baseline, events = 0, observed = false;
  const database = observedPool(f.pool, async (client, sql, values, result) => {
    if (/INSERT INTO item_events\b/.test(sql)) events++;
    if (baseline) { try { if (await intercept(client, sql, values, result)) observed = true; }
      catch (error) { if (error.actualBoundary) observed = true; throw error; } }
  }, async (_client, sql, values) => { if (!baseline && start(sql, values)) baseline = await f.snapshot(label + '-admission'); });
  await assert.rejects(execute(database), expected);
  assert(baseline && observed, label + ' must observe the actual causal boundary'); assert.equal(events, 0);
  f.same(baseline, await f.snapshot(label + '-undone')); await f.books();
}
const hold = () => { let enter, release; return { entered: new Promise(resolve => enter = resolve), enter: () => enter(),
  wait: new Promise(resolve => release = resolve), release: () => release() }; };
try {
  await fault('proposal-request', sql => sql.startsWith('INSERT INTO syndicated_loan_facilities'), async (_c, sql) => {
    if (sql.startsWith('INSERT INTO syndicated_loan_requests')) { throw Object.assign(Error('proposal-request'), { actualBoundary: true }); }
  }, database => f.propose({ key: 'failed-original-proposal' }, database));
  const p = await f.propose();
  await fault('funded-request', sql => sql.startsWith('INSERT INTO loans'), async (client, sql, values) => {
    if (sql.startsWith('INSERT INTO syndicated_loan_requests') && values?.[6] === 'fund') {
      assert.equal((await client.query('SELECT * FROM loans')).rows.length, 1);
      assert.equal(Number((await client.query("SELECT amount FROM transactions WHERE reason='loan:offer'")).rows[0].amount), -5000);
      throw Object.assign(Error('funded-request'), { actualBoundary: true });
    }
  }, database => f.action('lenderA', 'fund', p, 'failed-real-fund', database));
  await f.action('lenderA', 'fund', p); await f.action('lenderB', 'fund', p);
  let takeWrites = 0;
  await fault('second-real-take', sql => sql.startsWith('UPDATE loans SET borrower_character'), async (client, sql) => {
    if (sql.startsWith('UPDATE loans SET borrower_character') && ++takeWrites === 2) {
      assert.equal((await client.query("SELECT id FROM loans WHERE status='active' AND borrower_character=$1", [f.players.borrower.id])).rows.length, 2);
      throw Object.assign(Error('second-real-take'), { actualBoundary: true });
    }
  }, database => f.action('borrower', 'take', p, 'failed-real-take', database));
  await f.action('borrower', 'take', p);
  for (const kind of ['repay-request', 'corrupt-receipt', 'third-account-ACK']) {
    let request = false; const accounts = new Set(), beforeCash = await f.balance('borrower'), due = 2 * f.Rules.loanOwed(5000, 0.1);
    await fault(kind, sql => sql.startsWith('UPDATE characters SET honor='), async (client, sql, values) => {
      if (sql.startsWith('INSERT INTO syndicated_loan_requests') && values?.[6] === 'repay') {
        request = true;
        assert.equal((await client.query("SELECT id FROM loans WHERE status='repaid'")).rows.length, 2);
        if (kind === 'repay-request') throw Object.assign(Error(kind), { actualBoundary: true });
        if (kind === 'corrupt-receipt') {
          const forged = typeof values[3] === 'string' ? JSON.parse(values[3]) : structuredClone(values[3]); forged.facility.state = 'active';
          await client.query('UPDATE syndicated_loan_requests SET receipt=$3 WHERE account_id=$1 AND key_hash=$2', [values[0], values[1], forged]);
          return true;
        }
      }
      if (request && kind === 'third-account-ACK' && sql.startsWith('UPDATE account_persistent SET ')
          && ['borrower', 'lenderA', 'lenderB'].includes(values?.[0])) {
        accounts.add(values[0]); if (accounts.size === 3) {
          assert.equal(Number((await client.query('SELECT cash FROM characters WHERE id=$1', [f.players.borrower.id])).rows[0].cash), beforeCash - due);
          throw Object.assign(Error(kind), { actualBoundary: true });
        }
      }
      return false;
    }, database => f.action('borrower', 'repay', p, 'failed-' + kind, database), kind === 'corrupt-receipt' ? /completed_source/ : new RegExp(kind));
  }
  await f.action('borrower', 'repay', p);

  const first = await f.propose(); await f.action('lenderA', 'fund', first); await f.action('lenderB', 'fund', first);
  const firstLeg = (await f.pool.query('SELECT loan_id FROM syndicated_loan_legs WHERE facility_id=$1 AND lender_account=$2', [first.facility.id, 'lenderA'])).rows[0].loan_id;
  const taking = hold(); let firstWrites = 0;
  const takePool = observedPool(f.pool, async (_c, sql) => { if (sql.startsWith('UPDATE loans SET borrower_character') && ++firstWrites === 2) { taking.enter(); await taking.wait; } });
  const take = f.action('borrower', 'take', first, 'held-take-first', takePool); await taking.entered;
  const cancellation = f.single('lenderA', (ch, c, h) => f.Loans.cancelLoan(ch, firstLeg, c, h)).then(value => ({ value }), error => ({ error }));
  let takeFirstWaiters; try { takeFirstWaiters = await f.waitForLock(); } finally { taking.release(); }
  await take; assert.equal((await cancellation).error?.code, 'taken');
  await f.action('borrower', 'repay', first);

  const second = await f.propose(); await f.action('lenderA', 'fund', second); await f.action('lenderB', 'fund', second);
  const secondLegs = (await f.pool.query('SELECT * FROM syndicated_loan_legs WHERE facility_id=$1 ORDER BY lender_account', [second.facility.id])).rows;
  const cancelling = hold(); let held = false;
  const cancelPool = observedPool(f.pool, async (_c, sql) => { if (!held && sql.startsWith("UPDATE loans SET status='cancelled'")) { held = true; cancelling.enter(); await cancelling.wait; } });
  const cancelFirst = f.single('lenderA', (ch, c, h) => f.Loans.cancelLoan(ch, secondLegs.find(row => row.lender_account === 'lenderA').loan_id, c, h), cancelPool);
  await cancelling.entered;
  const refusedTake = f.action('borrower', 'take', second, 'take-after-held-cancel').then(value => ({ value }), error => ({ error }));
  let cancelFirstWaiters; try { cancelFirstWaiters = await f.waitForLock(); } finally { cancelling.release(); }
  await cancelFirst; assert((await refusedTake).error, 'Actual cancellation must invalidate the pending canonical take');
  await f.single('lenderB', (ch, c, h) => f.Loans.cancelLoan(ch, secondLegs.find(row => row.lender_account === 'lenderB').loan_id, c, h));
  await f.books(); await f.snapshot('final-real-ordinary-interlocks');
  f.proof('actual-lock-waiters', { takeFirstWaiters, cancelFirstWaiters, ordinaryMaxActive: f.Rules.LOAN.MAX_ACTIVE, fabricatedActors: 0, itemEventsAtFaults: 0 });
  console.log('PASS native N22 real proposal/fund/second take/request/corrupt receipt/third account ACK full-world undo and both actual ordinary cancellation lock orderings');
} finally { await f.close(); }
