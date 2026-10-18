import assert from 'node:assert/strict';
import { nativeFixture, observedPool } from './syndicatedloans-native-fixture.js';
const scenario = process.env.SYNDICATED_LOAN_NATIVE_ESTATE;
assert(['borrower-open', 'lender-open', 'borrower-active', 'lender-active'].includes(scenario), 'Closed original estate scenario required');
const f = await nativeFixture();
try {
  const { runEstate } = await import('../src/social/estate.js'), p = await f.propose({ key: 'estate-proposal' });
  await f.action('lenderA', 'fund', p, 'original-fund-A'); await f.action('lenderB', 'fund', p, 'original-fund-B');
  if (scenario.endsWith('active')) await f.action('borrower', 'take', p, 'original-take');
  const victim = scenario.startsWith('borrower') ? 'borrower' : 'lenderA';
  const otherCash = Object.fromEntries(await Promise.all(['borrower', 'lenderA', 'lenderB'].filter(account => account !== victim)
    .map(async account => [account, await f.balance(account)])));
  const beforeForgery = await f.snapshot('before-estate-scope-forgery');
  await assert.rejects(f.I.withItemTransaction(f.pool, client => f.S.retireSyndicatedLoansAtDeath(client, f.players[victim].id,
    { estateResolutionScope: {} })), error => error.code === 'estate_scope');
  f.same(beforeForgery, await f.snapshot('after-estate-scope-forgery'));
  assert.equal((await f.pool.query('SELECT * FROM street_deeds WHERE account_id=$1', [victim])).rows.length, 0);
  let baseline, estateDone = false, faulted = false, events = 0; const accounts = new Set();
  const database = observedPool(f.pool, async (_client, sql, values) => {
    if (/INSERT INTO item_events\b/.test(sql)) events++;
    if (estateDone && sql.startsWith('UPDATE account_persistent SET ') && ['foreign', victim].includes(values?.[0])) {
      accounts.add(values[0]); if (accounts.size === 2) { faulted = true; throw Error('N22-after-final-estate-account-ACKs'); }
    }
  });
  await assert.rejects(f.pair('foreign', victim, async (ch, target, client, h) => {
    baseline = await f.snapshot('genuine-estate-admission');
    const result = await runEstate(client, h, target, 'N22 native late estate fault', { killerCh: ch, loot: true });
    estateDone = true; return result;
  }, database), /N22-after-final-estate-account-ACKs/);
  assert(estateDone && faulted); assert.equal(events, 0); f.same(baseline, await f.snapshot('genuine-estate-undone')); await f.books();
  const estate = await f.pair('foreign', victim, (ch, target, client, h) => runEstate(client, h, target, 'N22 native actual original estate', { killerCh: ch, loot: true }));
  assert(estate.heirId); assert.equal((await f.pool.query('SELECT state FROM syndicated_loan_facilities WHERE id=$1', [p.facility.id])).rows[0].state, 'retired');
  assert.equal((await f.pool.query('SELECT * FROM syndicated_loan_members')).rows.length, 0);
  for (const [account, cash] of Object.entries(otherCash)) assert.equal(await f.balance(account), cash, 'Metadata retirement adds no counterpart cash authority');
  assert.equal((await f.action('lenderA', 'fund', p, 'original-fund-A')).replayed, true);
  await assert.rejects(f.action(victim, 'take', p, 'heir-cannot-execute-old-facility'), error => ['syndicated_loan', 'no_target', 'equipment_rental'].includes(error.code));
  const loans = (await f.pool.query('SELECT * FROM loans ORDER BY id')).rows;
  if (scenario === 'borrower-open') {
    assert.equal(loans.length, 2);
    for (const account of ['lenderA', 'lenderB']) {
      await f.single(account, (ch, c, h) => f.Loans.cancelLoan(ch, loans.find(row => row.lender_character === ch.id).id, c, h));
      assert.equal(await f.balance(account), 100000);
    }
  }
  if (scenario === 'lender-open') {
    assert.equal(loans.length, 1); assert.equal(loans[0].lender_character, f.players.lenderB.id); assert.equal(loans[0].status, 'open');
    assert.equal((await f.pool.query("SELECT amount FROM transactions WHERE reason='loan:death' AND counterparty=$1", [f.players.lenderA.id])).rows.length, 1);
    await f.single('lenderB', (ch, c, h) => f.Loans.cancelLoan(ch, loans[0].id, c, h)); assert.equal(await f.balance('lenderB'), 100000);
  }
  if (scenario === 'borrower-active') assert.equal(loans.length, 0);
  if (scenario === 'lender-active') {
    assert.equal(loans.length, 2); const inherited = loans.find(row => row.lender_character === estate.heirId); assert(inherited);
    assert.equal(inherited.borrower_character, f.players.borrower.id); const before = await f.balance(estate.heirId);
    const due = f.Rules.loanOwed(5000, 0.1), net = due - f.Rules.loanVig(due);
    await f.pair('borrower', estate.heirId, (ch, lender, client, h) => f.Loans.repayLoan(ch, lender, inherited.id, client, h));
    assert.equal(await f.balance(estate.heirId), before + net);
    await f.pair('borrower', 'lenderB', (ch, lender, client, h) => f.Loans.repayLoan(ch, lender, loans.find(row => row.lender_character === lender.id).id, client, h));
  }
  await f.books(); await f.snapshot('final-original-estate-recovery');
  f.proof('estate-outcomes', { scenario, estate, originalOtherCash: otherCash, itemEventsAtFault: events,
    ordinaryHeirRepayment: scenario === 'lender-active', defaultOneHourElapsed: false, financialActivation: false });
  console.log('PASS native N22 ' + scenario + ': actual final Game estate ACK full-world/sequence undo, genuine death rules, original refunds/history, real current-heir claim and no new paired authority');
} finally { await f.close(); }
