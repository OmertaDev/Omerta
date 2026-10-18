import assert from 'node:assert/strict';
import { fixture } from './collaterallending-fixture.js';

const f = await fixture();
try {
  const lender = await f.player(), borrower = await f.player(), stranger = await f.player();
  const item = await f.makeTool(borrower), offered = await f.offer(lender, borrower);
  const loan = (await f.pool.query('SELECT * FROM loans WHERE id=$1', [offered.id])).rows[0];
  const before = await f.state(), quote = await f.quote(borrower, loan, item);
  assert.equal(quote.loanId, loan.id); assert.equal(quote.itemId, item);
  assert.equal(quote.principal, 5000); assert.equal(quote.owed, 5250);
  assert.equal(quote.collateralTitle, 'original_borrower_account'); assert.equal(quote.liquidationAvailable, false);
  assert.deepEqual(await f.state(), before, 'A quote reserves no cash, UID or loan authority');
  assert.deepEqual(await f.quote(borrower, loan, item), quote);
  await assert.rejects(f.quote(stranger, loan, item), /directed_offer/);
  await assert.rejects(f.quote(lender, loan, item), /directed_offer/);
  const other = await f.makeTool(stranger);
  await assert.rejects(f.quote(borrower, loan, other));
  for (const body of [{ loanId: loan.id, itemId: item, owner: stranger.account }, { loanId: loan.id },
    { loanId: loan.id, itemId: item, consent: true }]) await assert.rejects(f.C.collateralLendingQuote(f.pool, borrower.account, body), /terms/);
  const terms = { loanId: loan.id, itemId: item, sourceHash: quote.sourceHash, consent: true };
  for (const body of [{ ...terms, consent: false }, { ...terms, sourceHash: 'x'.repeat(64) }, { ...terms, loanAuthority: {} }]) {
    await assert.rejects(f.C.collateralLendingAction(f.pool, borrower.account, 'pledge', body, f.key('bad')), /terms/);
  }
  const availability = await f.C.collateralLendingAvailability();
  assert.equal(availability.cryptoAvailable, false); assert.equal(availability.nativeOnly, true);
  if (!f.native) {
    assert.equal(availability.available, false);
    const untouched = await f.state();
    for (const action of ['pledge', 'repay', 'release']) await assert.rejects(
      f.C.collateralLendingAction(f.pool, borrower.account, action, action === 'pledge' ? terms
        : { pledgeId: 'not-an-authority', sourceHash: quote.sourceHash, consent: true }, f.key(action)),
      error => error.code === 'collateral_lending_unavailable' && error.statusCode === 503);
    assert.deepEqual(await f.state(), untouched, 'Portable backend cannot originate a cash/custody mutation');
  }
  await f.tx(async client => {
    await f.C.finalizeCollateralLendingAction(client, { ok: true });
    await f.C.finalizeCollateralLendingAction(client, { ok: true, loan: { ok: true } });
  });
  await assert.rejects(f.tx(client => f.C.recordCollateralLendingTerminal(client, {})), /terminal_(?:integration_required|proof)/);
  await assert.rejects(f.tx(client => f.C.recoverCollateralLendingInEstate(client, borrower.id, {}, {})));
  assert.deepEqual((await f.C.collateralLendingBoard(f.pool, stranger.account)).pledges, []);
  assert.deepEqual(await f.A.collectCollateralLendingIssues(f.pool), []);
  console.log('PASS collateral lending actual directed quote, source/consent/original-owner refusals, no-reserve quote, native guard and forged private scopes');
} finally { await f.app.close(); }
