import assert from 'node:assert/strict';
import { fixture, observedPool } from './collaterallending-fixture.js';

const f = await fixture({ nativeOnly: true });
try {
  const lender = await f.player(), borrower = await f.player(), trader = await f.player();
  const item = await f.makeTool(borrower), loan = await f.offer(lender, borrower), quote = await f.quote(borrower, loan, item);
  const pledgeKey = f.key('pledge'), pledged = await f.pledge(borrower, loan, item, quote, pledgeKey);
  assert.equal(pledged.loan.principal, 5000); assert.equal(pledged.loan.owed, 5250);
  assert.equal(pledged.pledge.state, 'held');
  assert.deepEqual(await f.pledge(borrower, loan, item, quote, pledgeKey), pledged);
  const custody = (await f.pool.query('SELECT * FROM operation_escrow WHERE item_id=$1', [item])).rows[0];
  assert.equal(custody.operation_id, pledged.pledge.pledgeId); assert.equal(custody.depositor_id, borrower.account);
  assert.equal(Number((await f.pool.query('SELECT cash FROM characters WHERE id=$1', [borrower.id])).rows[0].cash), 105000);
  await f.books();
  // Actual UID custody blocks the existing transfer, consume and use leaves; no new lock owner type.
  for (const mutation of [
    client => f.I.transferItem(client, { scope: 'account', id: borrower.account }, { scope: 'account', id: trader.account }, item, 'negative pledged transfer', f.key('transfer')),
    client => f.I.consumeItem(client, { scope: 'account', id: borrower.account }, item, 'negative pledged consume', f.key('consume')),
    async client => (await import('../src/itemdurability.js')).assertEquipmentUsable(client, { itemId: item, owner: { scope: 'account', id: borrower.account } })
  ]) await assert.rejects(f.tx(mutation), error => ['item_unavailable', 'item_durability'].includes(error.code));
  const Consignments = await import('../src/consignments.js'), Rentals = await import('../src/equipmentrentals.js');
  await assert.rejects(f.tx(client => Consignments.createConsignment(client, borrower.account,
    { itemId: item, hostAccountId: trader.account, price: 100, hostFeeBps: 1000, lifetimeSeconds: 600, consent: true }, f.key('pledged-sale'))), error => error.code === 'item_durability');
  assert.equal(typeof Rentals.createEquipmentRentalOffer, 'function');
  await assert.rejects(f.tx(client => Rentals.createEquipmentRentalOffer(client, borrower.account,
    { itemId: item, rentCash: 100, depositCash: 0, durationSeconds: 60, offerSeconds: 600, published: true }, f.key('pledged-rental'))), error => error.code === 'item_durability');
  await assert.rejects(f.quote(borrower, loan, item));
  const secondTool = await f.makeTool(borrower), secondLoan = await f.offer(lender, borrower);
  const secondQuote = await f.quote(borrower, secondLoan, secondTool);
  await assert.rejects(f.pledge(borrower, secondLoan, secondTool, secondQuote), /pledge_capacity|active_loan/);
  const ref = f.ref(pledged);
  await assert.rejects(f.C.collateralLendingAction(f.pool, borrower.account, 'release', ref, f.key('premature')), /debt_not_terminal/);
  // Raw deletion or terminal corruption while the original borrower lives never supplies a receipt.
  for (const sql of ["DELETE FROM loans WHERE id=$1", "UPDATE loans SET status='repaid' WHERE id=$1"]) {
    await assert.rejects(f.tx(async client => {
      await client.query(sql, [loan.id]);
      await f.A.verifyCollateralLendingTerminal(client, (await client.query('SELECT * FROM collateral_lending_pledges WHERE id=$1', [ref.pledgeId])).rows[0]);
    }), /terminal_source/);
  }
  // The real paper market changes the cash claim's holder, never the original tool's title.
  await f.ok(lender, 'POST', '/v1/loans/' + loan.id + '/sell', { price: 5000 });
  const staleHintPool = Object.create(f.pool); staleHintPool.connect = f.pool.connect.bind(f.pool);
  let traded = false;
  staleHintPool.query = async (...args) => {
    const result = await f.pool.query(...args);
    if (!traded && args[0] === 'SELECT l.lender_character FROM collateral_lending_pledges p JOIN loans l ON l.id=p.loan_id WHERE p.id=$1') {
      traded = true; await f.ok(trader, 'POST', '/v1/loans/' + loan.id + '/buy', {});
    }
    return result;
  };
  await assert.rejects(f.C.collateralLendingAction(staleHintPool, borrower.account, 'repay', ref, f.key('stale-holder')), /loan_holder_changed/);
  assert(traded, 'Causal holder drift uses the actual canonical paper purchase');
  assert.equal((await f.pool.query('SELECT lender_character FROM loans WHERE id=$1', [loan.id])).rows[0].lender_character, trader.id);
  const oldHolder = Number((await f.pool.query('SELECT cash FROM characters WHERE id=$1', [lender.id])).rows[0].cash);
  const paid = await f.C.collateralLendingAction(f.pool, borrower.account, 'repay', ref, f.key('repay'));
  assert.equal(paid.loan.paid, 5250); assert.equal(paid.loan.toLender, 4987); assert.equal(paid.loan.vig, 263);
  assert.equal(paid.pledge.state, 'released');
  assert.equal(Number((await f.pool.query('SELECT cash FROM characters WHERE id=$1', [lender.id])).rows[0].cash), oldHolder);
  const terminal = (await f.pool.query('SELECT * FROM collateral_lending_terminals WHERE pledge_id=$1', [ref.pledgeId])).rows[0];
  assert.equal(terminal.holder_character, trader.id); assert.equal(terminal.kind, 'repaid');
  assert.equal((await f.pool.query('SELECT owner_id,state FROM item_instances WHERE id=$1', [item])).rows[0].owner_id, borrower.account);
  assert.equal((await f.pool.query('SELECT item_id FROM operation_escrow WHERE item_id=$1', [item])).rows.length, 0);
  await f.books();
  for (const [sql, values] of [
    ['UPDATE transactions SET amount=amount-1 WHERE id=$1', [terminal.pay_journal]],
    ['UPDATE collateral_lending_terminals SET holder_character=$2 WHERE pledge_id=$1', [ref.pledgeId, lender.id]],
    ['UPDATE collateral_lending_pledges SET initial_condition=initial_condition-1 WHERE id=$1', [ref.pledgeId]],
    ["UPDATE item_mutation_guards SET request_hash=$2 WHERE idempotency_key=$1", [terminal.mutation_key, '0'.repeat(64)]]
  ]) await assert.rejects(f.tx(async client => {
    await client.query(sql, values);
    assert((await f.A.collectCollateralLendingIssues(client)).length, 'Actual source oracle must reject changed canonical evidence');
    throw Error('rollback-deliberate-collateral-oracle-probe');
  }), /rollback-deliberate-collateral-oracle-probe/);
  await f.books();
  // Ordinary canonical repayment also issues a genuine terminal receipt; original borrower then releases.
  const thirdTool = await f.makeTool(borrower), thirdLoan = await f.offer(lender, borrower);
  const third = await f.pledge(borrower, thirdLoan, thirdTool, await f.quote(borrower, thirdLoan, thirdTool));
  await f.pool.query("UPDATE accounts SET status='banned' WHERE id=$1", [lender.account]);
  await f.ok(borrower, 'POST', '/v1/loans/' + thirdLoan.id + '/repay', {});
  await f.pool.query("UPDATE accounts SET status='active' WHERE id=$1", [lender.account]);
  assert.equal((await f.pool.query('SELECT state FROM collateral_lending_pledges WHERE id=$1', [third.pledge.pledgeId])).rows[0].state, 'held');
  const released = await f.C.collateralLendingAction(f.pool, borrower.account, 'release', f.ref(third), f.key('ordinary-release'));
  assert.equal(released.pledge.state, 'released'); await f.books();
  // Fault after the real native ACK. Baseline begins at mutation admission, after ordinary G phase 1.
  const fourthTool = await f.makeTool(borrower), fourthLoan = await f.offer(lender, borrower), fourthQuote = await f.quote(borrower, fourthLoan, fourthTool);
  let admitted, fired = false;
  const observed = observedPool(f.pool, async (_client, sql) => {
    if (sql.startsWith('INSERT INTO collateral_lending_requests(')) admitted = await f.snapshot();
    if (!fired && sql.startsWith('UPDATE collateral_lending_requests SET receipt=')) { fired = true; throw Error('native-collateral-after-ack'); }
  });
  await assert.rejects(f.C.collateralLendingAction(observed, borrower.account, 'pledge',
    { loanId: fourthLoan.id, itemId: fourthTool, sourceHash: fourthQuote.sourceHash, consent: true }, f.key('rollback')), /native-collateral-after-ack/);
  assert(fired && admitted); const after = await f.snapshot();
  assert.deepEqual(after.tables, admitted.tables, 'Actual native admitted write set rolls back in every canonical table');
  const previousSequences = new Map(admitted.sequences.map(row => [row.sequencename, row.last_value]));
  const changed = after.sequences.filter(row => row.last_value !== previousSequences.get(row.sequencename));
  assert.deepEqual(changed.map(row => row.sequencename), ['item_events_sequence_seq']);
  assert.equal(Number(changed[0].last_value) - Number(previousSequences.get('item_events_sequence_seq')), 1);
  for (const fault of ['receipt', 'persisted-cash']) {
    let baseline, ack = false, corrupted = false;
    const causal = observedPool(f.pool, async (client, sql, values) => {
      if (sql.startsWith('INSERT INTO collateral_lending_requests(')) baseline = await f.snapshot();
      if (sql.startsWith('UPDATE collateral_lending_requests SET receipt=')) {
        ack = true;
        if (fault === 'receipt') {
          const counterfeit = structuredClone(values[3]); counterfeit.pledge.sourceHash = '0'.repeat(64);
          await client.query('UPDATE collateral_lending_requests SET receipt=$2 WHERE run_id=$1', [values[2], counterfeit]); corrupted = true;
        }
      }
      if (fault === 'persisted-cash' && ack && !corrupted && sql.startsWith('UPDATE characters SET ') && values?.[0] === borrower.id) {
        await client.query('UPDATE characters SET cash=cash+1 WHERE id=$1', [borrower.id]); corrupted = true;
      }
    });
    await assert.rejects(f.C.collateralLendingAction(causal, borrower.account, 'pledge',
      { loanId: fourthLoan.id, itemId: fourthTool, sourceHash: fourthQuote.sourceHash, consent: true }, f.key('causal-' + fault)),
      fault === 'receipt' ? /receipt_source/ : /persisted_cash/);
    assert(corrupted && baseline, 'Deliberate negative evidence corruption occurred after the actual native ACK');
    const undone = await f.snapshot(); assert.deepEqual(undone.tables, baseline.tables);
    const prior = new Map(baseline.sequences.map(row => [row.sequencename, row.last_value]));
    const advanced = undone.sequences.filter(row => row.last_value !== prior.get(row.sequencename));
    assert.deepEqual(advanced.map(row => row.sequencename), ['item_events_sequence_seq']);
    assert.equal(Number(advanced[0].last_value) - Number(prior.get('item_events_sequence_seq')), 1);
  }
  await f.books();
  console.log('PASS native actual funded cash loan, paired journals/vig, UID exclusion, paper-holder repayment, ordinary terminal release, admitted native rollback and causal post-ACK receipt/persisted-cash refusal');
} finally { await f.app.close(); }
