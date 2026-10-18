import assert from 'node:assert/strict';
import { fixture, observedPool } from './collateralauction-fixture.js';
const f = await fixture({ nativeOnly: true });
try {
  const lender = await f.player(), borrower = await f.player(), outsider = await f.player();
  const item = await f.makeTool(borrower), offer = await f.offer(lender, borrower), quote = await f.quote(borrower, offer, item);
  const body = { loanId: offer.id, itemId: item, quoteHash: quote.sourceHash, reserve: 6000, auctionSeconds: 60, consent: true };
  const action = (actor, kind, terms, key = f.key(kind), pool = f.pool) => f.Auction.collateralAuctionAction(pool, actor.account, kind, terms, key);
  const prepareKey = f.key('prepare'), prepared = await action(borrower, 'prepare', body, prepareKey);
  assert.deepEqual(await action(borrower, 'prepare', body, prepareKey), prepared);
  assert.deepEqual(await f.Auction.collateralAuctionCounterparts(f.pool, borrower.id), [], 'Unsigned terms add no counterpart or reservation');
  const ref = { agreementId: prepared.agreementId, sourceHash: prepared.sourceHash, consent: true };
  await assert.rejects(action(outsider, 'approve', ref), /original_lender/);
  const approved = await action(lender, 'approve', ref); assert.equal(approved.approved, true);
  assert.deepEqual(await f.Auction.collateralAuctionCounterparts(f.pool, lender.id), [], 'Approved pre-take terms add no counterpart');
  const pledged = await f.pledge(borrower, offer, item, quote);
  const open = { ...ref, pledgeId: pledged.pledge.pledgeId };
  await assert.rejects(action(lender, 'open', open), /not_defaulted/, 'A genuine one-hour debt is not yet in default');
  assert.equal((await f.pool.query('SELECT id FROM collateral_auctions')).rows.length, 0);
  assert.equal((await f.pool.query('SELECT state FROM collateral_lending_pledges WHERE id=$1', [pledged.pledge.pledgeId])).rows[0].state, 'held');
  await f.books();
  // Taking without prior second signature cannot be repaired into a retroactive default sale right.
  const lateLender = await f.player(), lateBorrower = await f.player(), lateItem = await f.makeTool(lateBorrower), lateOffer = await f.offer(lateLender, lateBorrower);
  const lateQuote = await f.quote(lateBorrower, lateOffer, lateItem);
  const unsigned = await action(lateBorrower, 'prepare', { ...body, loanId: lateOffer.id, itemId: lateItem, quoteHash: lateQuote.sourceHash });
  await f.pledge(lateBorrower, lateOffer, lateItem, lateQuote);
  await assert.rejects(action(lateLender, 'approve', { agreementId: unsigned.agreementId, sourceHash: unsigned.sourceHash, consent: true }), /directed_offer/);
  await f.books();
  // Refuse altered original consent and source; the genuine native transaction undoes every write.
  await assert.rejects(f.tx(async client => {
    await client.query('UPDATE collateral_auction_agreements SET reserve_cash=reserve_cash+1 WHERE id=$1', [prepared.agreementId]);
    assert((await f.AA.collectCollateralAuctionIssues(client)).length); throw Error('rollback-N24-original-source-probe');
  }), /rollback-N24-original-source-probe/);
  await f.books();
  const failLender = await f.player(), failBorrower = await f.player(), failItem = await f.makeTool(failBorrower), failOffer = await f.offer(failLender, failBorrower);
  const failQuote = await f.quote(failBorrower, failOffer, failItem);
  let baseline, fired = false;
  const observed = observedPool(f.pool, async (_client, sql) => {
    if (!baseline && sql === 'SELECT clock_timestamp() AS now') baseline = await f.snapshot();
    if (!fired && sql.startsWith('INSERT INTO collateral_auction_requests(')) { fired = true; throw Error('N24-native-after-ack'); }
  });
  await assert.rejects(action(failBorrower, 'prepare', { ...body, loanId: failOffer.id, itemId: failItem, quoteHash: failQuote.sourceHash }, f.key('rollback'), observed), /N24-native-after-ack/);
  assert(fired && baseline); assert.deepEqual(await f.snapshot(), baseline, 'Whole native database undoes the actual late ACK failure');
  await f.books();
  // Ordinary N23 repayment remains authoritative and returns only its original escrow depositor.
  await f.C.collateralLendingAction(f.pool, borrower.account, 'repay', f.ref(pledged), f.key('ordinary-repay'));
  assert.equal((await f.pool.query('SELECT owner_id FROM item_instances WHERE id=$1', [item])).rows[0].owner_id, borrower.account);
  await f.books();
  console.log('PASS N24 native original pre-take two-party consent, unsigned zero-grief, genuine ordinary one-hour non-default refusal, no retrofit, whole-database late-ACK undo and ordinary N23 repayment');
} finally { await f.app.close(); }
