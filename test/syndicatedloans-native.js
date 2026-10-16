import assert from 'node:assert/strict';
import { nativeFixture } from './syndicatedloans-native-fixture.js';
const f = await nativeFixture();
try {
  assert.equal((await f.http(null)).statusCode, 401);
  const proposalKey = 'native-original-proposal', body = f.proposalBody(), p = await f.ok('borrower', 'propose', body, proposalKey, true);
  assert.equal((await f.pool.query('SELECT * FROM syndicated_loan_members')).rows.length, 1);
  assert.equal(await f.balance('borrower'), 100000);
  const beforeReplay = await f.snapshot('before-authenticated-http-replay');
  const replay = await f.http('borrower', 'propose', body, proposalKey, false);
  assert.equal(replay.statusCode, 200); assert.equal(replay.headers['x-idempotent-replay'], 'true'); assert.deepEqual(replay.json(), p);
  f.same(beforeReplay, await f.snapshot('after-authenticated-http-replay'));
  const beforeReceipt = await f.snapshot('before-readonly-request-replay');
  const receipt = await f.S.replaySyndicatedLoanRequest(f.pool, 'borrower', 'propose', body, proposalKey);
  assert.equal(receipt.replayed, true); assert.deepEqual(receipt.facility, p.facility);
  f.same(beforeReceipt, await f.snapshot('after-readonly-request-replay'));
  assert.equal((await f.ok('lenderA')).facilities.length, 1); assert.equal((await f.ok('foreign')).facilities.length, 0);
  assert.equal((await f.http('foreign', 'fund', f.current(p), 'foreign-fund')).statusCode, 400);
  assert.equal((await f.http('borrower', 'take', { ...f.current(p), capability: {} }, 'injected-authority')).statusCode, 400);
  const funded = await Promise.all(['lenderA', 'lenderB'].map((account, i) => f.ok(account, 'fund', f.current(p), 'native-fund-' + account, Boolean(i))));
  assert.equal(await f.balance('lenderA'), 95000); assert.equal(await f.balance('lenderB'), 95000); assert.equal(await f.balance('borrower'), 100000);
  const legs = (await f.pool.query('SELECT * FROM syndicated_loan_legs WHERE facility_id=$1 ORDER BY lender_account', [p.facility.id])).rows;
  assert.equal(legs.length, 2);
  for (const leg of legs) {
    const source = (await f.pool.query('SELECT * FROM loans WHERE id=$1', [leg.loan_id])).rows[0];
    const tx = (await f.pool.query('SELECT * FROM transactions WHERE id=$1', [leg.fund_transaction])).rows[0];
    assert.equal(Number(source.principal), 5000); assert.equal(source.offered_to, f.players.borrower.id); assert.equal(source.status, 'open');
    assert.equal(Number(source.collateral_omr), 0); assert.equal(Number(tx.amount), -5000); assert.equal(tx.reason, 'loan:offer');
    assert.equal(tx.character_id, leg.lender_character); assert.equal(tx.currency, 'cash');
  }
  const A = legs[0].loan_id;
  await assert.rejects(f.single('borrower', (ch, c, h) => f.Loans.takeLoan(ch, A, null, c, h)), /enrolled_scope_required/);
  const taken = await f.ok('borrower', 'take', f.current(p), 'native-take', false);
  assert.equal(taken.facility.state, 'active'); assert.equal(await f.balance('borrower'), 110000);
  assert.equal((await f.pool.query("SELECT * FROM loans WHERE borrower_character=$1 AND status='active'", [f.players.borrower.id])).rows.length, 2);
  await assert.rejects(f.single('borrower', (ch, c, h) => f.Loans.takeHouseLoan(ch, 5000, c, h)), e => e.code === 'maxed');
  const outside = await f.single('foreign', (ch, c, h) => f.Loans.offerLoan(ch, { amount: 5000, rate: 0.1, hours: 1,
    to: f.players.borrower.id, collateral: 0, collateralOmr: 0 }, c, h));
  await assert.rejects(f.single('borrower', (ch, c, h) => f.Loans.takeLoan(ch, outside.id, null, c, h)), e => e.code === 'maxed');
  await assert.rejects(f.single('lenderA', (ch, c, h) => f.Loans.cancelLoan(ch, A, c, h)), e => e.code === 'taken');
  await assert.rejects(f.pair('borrower', 'lenderA', (ch, lender, c, h) => f.Loans.repayLoan(ch, lender, A, c, h)), /enrolled_scope_required/);
  await assert.rejects(f.single('lenderA', (ch, c, h) => f.Loans.sellPaper(ch, A, { price: 5000 }, c, h)), /enrolled_scope_required/);
  await assert.rejects(f.single('lenderA', (ch, c, h) => f.Loans.unsellPaper(ch, A, c, h)), /enrolled_scope_required/);
  await assert.rejects(f.pair('foreign', 'lenderA', (ch, lender, c, h) => f.Loans.buyPaper(ch, lender, A, c, h)), /enrolled_scope_required/);
  await assert.rejects(f.pair('lenderA', 'borrower', (ch, borrower, c, h) => f.Loans.collectLoan(ch, borrower, A, c, h)), e => e.code === 'not_due');
  const owed = f.Rules.loanOwed(5000, 0.1), net = owed - f.Rules.loanVig(owed);
  const repays = await Promise.all(['native-repay-one', 'native-repay-two'].map((key, i) => f.http('borrower', 'repay', f.current(p), key, Boolean(i))));
  assert.equal(repays.filter(row => row.statusCode === 200).length, 1); assert.equal(repays.filter(row => row.statusCode === 400).length, 1);
  assert.equal(await f.balance('borrower'), 110000 - 2 * owed); assert.equal(await f.balance('lenderA'), 95000 + net); assert.equal(await f.balance('lenderB'), 95000 + net);
  assert.equal((await f.pool.query('SELECT * FROM syndicated_loan_members')).rows.length, 0);
  await f.single('foreign', (ch, c, h) => f.Loans.cancelLoan(ch, outside.id, c, h)); await f.books();
  const beforeScope = await f.snapshot('before-forged-private-roots');
  for (const fn of [c => f.R.prelockEquipmentRentalDeathActors(c, [f.players.borrower.id, f.players.lenderA.id, f.players.lenderB.id]),
    c => f.R.prelockSyndicatedLoanActors(c, 'borrower', 'take', f.current(p), 'forged', Object.freeze({})),
    c => f.S.executeSyndicatedLoanAction(c, 'borrower', 'take', f.current(p), 'forged', Object.freeze({}))])
    await assert.rejects(f.I.withItemTransaction(f.pool, fn), /death_scope|canonical_root/);
  f.same(beforeScope, await f.snapshot('after-forged-private-roots'));

  const Depot = await import('../src/depot.js'), V = await import('../src/customervaults.js');
  const depot = await f.single('lenderA', (ch, c, h) => Depot.openDepot(ch, { salePrice: 300, bidPrice: 100, targetStock: 8, reorderAt: 0, restockBudget: 5000 }, c, h));
  await f.single('lenderA', async (ch, c, h) => Depot.fundDepot(ch, depot.id, Number(ch.cash) - 4999, c, h));
  assert.equal(await f.balance('lenderA'), 4999);
  const vault = async (account, verb, payload, key) => f.app.inject({ method: 'POST', url: '/v1/company/vaults/' + verb, payload,
    headers: { authorization: 'Bearer ' + f.tokens[account].agent, 'idempotency-key': key } });
  const opened = await vault('lenderA', 'open', { depotId: depot.id, feeCash: 0, lifetimeSeconds: 3600, consent: true }, 'native-service');
  assert.equal(opened.statusCode, 200, opened.body); const service = opened.json().service;
  const deposit = await vault('customer', 'deposit', { serviceId: service.id, sourceHash: service.sourceHash, principal: 20000, maxFeeCash: 0, consent: true }, 'native-principal');
  assert.equal(deposit.statusCode, 200, deposit.body); const position = deposit.json().position;
  const stored = (await f.pool.query('SELECT * FROM customer_vault_positions WHERE id=$1', [position.id])).rows[0];
  assert.equal(Number(stored.remaining), 20000); assert.equal(await f.balance('lenderA'), 4999);
  const unsupported = await f.propose(), beforeUnfunded = await f.snapshot('before-principal-not-capital');
  await assert.rejects(f.action('lenderA', 'fund', unsupported), e => e.code === 'cash');
  const afterUnfunded = await f.snapshot('after-principal-not-capital');
  for (const table of ['customer_vault_positions', 'customer_vault_services', 'syndicated_loan_legs', 'loans', 'transactions'])
    assert.deepEqual(afterUnfunded.tables[table], beforeUnfunded.tables[table], table);
  assert.deepEqual((await f.pool.query('SELECT * FROM customer_vault_positions WHERE id=$1', [position.id])).rows[0], stored);
  assert.equal(await f.balance('lenderA'), 4999);
  const returned = await vault('customer', 'withdraw', { positionId: position.id, sourceHash: position.sourceHash, consent: true }, 'native-original-withdraw');
  assert.equal(returned.statusCode, 200, returned.body); assert.equal(await f.balance('customer'), 100000);
  await f.action('borrower', 'cancel', unsupported); assert.deepEqual((await V.customerVaultAccounting(f.pool)).issues, []);
  await f.books(); await f.snapshot('final-native-core');
  f.proof('outcomes', { funded, taken, repayments: repays.map(row => ({ status: row.statusCode, body: row.json() })),
    ordinaryMaxActive: f.Rules.LOAN.MAX_ACTIVE, principalIsCapital: false, defaultOneHourElapsed: false, financialActivation: false });
  console.log('PASS native N22 real two-lender own-cash facility, actual human/agent DTO replay, once-only equal repay/vig, all7 ordinary guards/MAX_ACTIVE1/private roots and segregated N21 principal; financialOFF');
} finally { await f.close(); }
