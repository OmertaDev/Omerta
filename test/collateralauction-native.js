import assert from 'node:assert/strict';
import { fixture, observedPool } from './collateralauction-fixture.js';
const f = await fixture({ nativeOnly: true });
try {
  const { runEstate } = await import('../src/social/estate.js');
  const start = await f.pool.query('SELECT clock_timestamp() AS now');
  const sets = [], observer = await f.player();
  const action = (person, action, body, key = f.key(action), pool = f.pool) => f.Auction.collateralAuctionAction(pool, person.account, action, body, key);
  const api = (person, action, body, agent = false) => f.ok(person, 'POST', '/v1/loans/equipment/auctions/' + action, body, f.key(action), agent);
  for (const label of ['sale', 'ordinary-terminal', 'paper', 'borrower-estate', 'bidder-estate', 'holder-estate', 'paper-distinct-roots', 'buyer-existing-auction']) {
    const lender = await f.player(), borrower = await f.player(), bidders = [await f.player(), await f.player()];
    const item = await f.makeTool(borrower), offered = await f.offer(lender, borrower), q = await f.quote(borrower, offered, item);
    const prepared = await api(borrower, 'prepare', { loanId: offered.id, itemId: item, quoteHash: q.sourceHash, reserve: 6000, auctionSeconds: 60, consent: true }, true);
    const ref = { agreementId: prepared.agreementId, sourceHash: prepared.sourceHash, consent: true };
    await api(lender, 'approve', ref);
    const pledged = await f.pledge(borrower, offered, item, q);
    const open = { ...ref, pledgeId: pledged.pledge.pledgeId };
    await assert.rejects(action(lender, 'open', open), /not_defaulted/);
    const debt = (await f.pool.query('SELECT * FROM loans WHERE id=$1', [offered.id])).rows[0];
    sets.push({ label, lender, borrower, bidders, item, offered, pledged, ref, open, dueAt: debt.due_at });
  }
  await f.books();
  const lastDue = Math.max(...sets.map(s => +new Date(s.dueAt)));
  console.log('N24_PRIMED ' + JSON.stringify({ startedAt: start.rows[0].now, loans: sets.map(s => ({ label: s.label, loanId: s.offered.id,
    pledgeId: s.pledged.pledge.pledgeId, itemId: s.item, dueAt: s.dueAt })), dueAt: new Date(lastDue).toISOString(),
    termHours: 1, artificialDueWrites: 0, financialActivation: false }));
  // A real hour is part of this proof. No date/clock replacement, backdating or shorter loan term.
  async function waitUntil(target) {
    for (;;) {
      const now = +new Date((await f.pool.query('SELECT clock_timestamp() AS now')).rows[0].now), left = target - now;
      if (left <= 0) return now;
      await new Promise(resolve => setTimeout(resolve, Math.min(59000, left + 25)));
    }
  }
  const observedDue = await waitUntil(lastDue);
  assert(observedDue >= lastDue);
  for (const s of sets) {
    s.auction = await api(s.lender, 'open', s.open, true);
    s.bidRef = { auctionId: s.auction.auctionId, sourceHash: s.ref.sourceHash, consent: true };
    s.bids = [];
    for (let i = 0; i < s.bidders.length; i++) s.bids.push(await api(s.bidders[i], 'bid', { ...s.bidRef, amount: i ? 6500 : 7000 }, !!i));
    const own = await f.ok(s.bidders[0], 'GET', '/v1/loans/equipment/auctions');
    const view = own.auctions.find(a => a.auctionId === s.auction.auctionId);
    assert.equal(view.sealed, true); assert.equal(view.bids.length, 1); assert.equal(view.bids[0].amount, 7000);
    await assert.rejects(action(s.bidders[0], 'refund', s.bidRef), /refund/, 'A live sealed bid does not allow early cash recovery');
    await f.books();
  }
  await waitUntil(Math.max(...sets.map(s => +new Date(s.auction.closesAt))));
  const sale = sets[0], settleBody = { ...sale.bidRef, winningBidId: sale.bids[0].bidId };
  let baseline, fired = false;
  const observed = observedPool(f.pool, async (_client, sql) => {
    if (!baseline && sql === 'SELECT clock_timestamp() AS now') baseline = await f.snapshot();
    if (!fired && sql.startsWith("UPDATE collateral_auctions SET state='settled'")) { fired = true; throw Error('N24-native-after-real-sale-ack'); }
  });
  await assert.rejects(action(sale.lender, 'settle', settleBody, f.key('late-rollback'), observed), /N24-native-after-real-sale-ack/);
  assert(fired && baseline); const undone = await f.snapshot();
  assert.deepEqual(undone.tables, baseline.tables, 'Actual money/debt/release/title writes undo in every canonical table after late ACK');
  const beforeSequences = new Map(baseline.sequences.map(row => [row.sequencename, row.last_value]));
  const advanced = undone.sequences.filter(row => row.last_value !== beforeSequences.get(row.sequencename));
  assert.deepEqual(advanced.map(row => row.sequencename), ['item_events_sequence_seq']);
  assert.equal(Number(advanced[0].last_value) - Number(beforeSequences.get('item_events_sequence_seq')), 2,
    'The existing nontransactional allocator retains exactly the attempted release and sale event allocations');
  await f.books();
  const keys = [f.key('winner-one'), f.key('winner-two')];
  const outcomes = await Promise.allSettled(keys.map(key => action(sale.lender, 'settle', settleBody, key)));
  assert.equal(outcomes.filter(row => row.status === 'fulfilled').length, 1, 'Exactly one concurrent settlement wins');
  const winnerIndex = outcomes.findIndex(row => row.status === 'fulfilled'), receipt = outcomes[winnerIndex].value;
  assert.deepEqual(await action(sale.lender, 'settle', settleBody, keys[winnerIndex]), receipt);
  assert.equal(receipt.paid, 7000); assert.equal(receipt.debtPaid, 5250); assert.equal(receipt.borrowerSurplus, 1750);
  assert.equal(receipt.refundedBids.length, 1); assert(receipt.releaseEvent && receipt.saleEvent);
  assert.equal((await f.pool.query('SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1', [sale.item])).rows[0].owner_id, sale.bidders[0].account);
  assert.equal((await f.pool.query('SELECT status FROM loans WHERE id=$1', [sale.offered.id])).rows[0].status, 'repaid');
  assert.equal(Number((await f.pool.query('SELECT cash FROM characters WHERE id=$1', [sale.borrower.id])).rows[0].cash), 106750);
  assert.equal(Number((await f.pool.query('SELECT cash FROM characters WHERE id=$1', [sale.bidders[1].id])).rows[0].cash), 100000);
  await f.books();
  // Ordinary repayment cancels/refunds; its own canonical release remains necessary.
  const terminal = sets[1];
  await f.ok(terminal.borrower, 'POST', '/v1/loans/' + terminal.offered.id + '/repay', {});
  assert.equal((await f.pool.query('SELECT state FROM collateral_auctions WHERE id=$1', [terminal.auction.auctionId])).rows[0].state, 'cancelled');
  await f.C.collateralLendingAction(f.pool, terminal.borrower.account, 'release', f.ref(terminal.pledged), f.key('ordinary-release'));
  await f.books();
  // The first bidder buys the actual paper, exercising the real G actor refund mirror.
  const paper = sets[2], buyer = paper.bidders[0];
  await f.ok(paper.lender, 'POST', '/v1/loans/' + paper.offered.id + '/sell', { price: 5000 });
  await f.ok(buyer, 'POST', '/v1/loans/' + paper.offered.id + '/buy', {});
  assert.equal(Number((await f.pool.query('SELECT cash FROM characters WHERE id=$1', [buyer.id])).rows[0].cash), 95000);
  assert.equal((await f.pool.query('SELECT lender_character FROM loans WHERE id=$1', [paper.offered.id])).rows[0].lender_character, buyer.id);
  assert.equal((await f.pool.query('SELECT state FROM collateral_auctions WHERE id=$1', [paper.auction.auctionId])).rows[0].state, 'cancelled');
  assert.equal((await f.pool.query('SELECT state FROM collateral_lending_pledges WHERE id=$1', [paper.pledged.pledge.pledgeId])).rows[0].state, 'held');
  await f.C.collateralLendingAction(f.pool, paper.borrower.account, 'repay', f.ref(paper.pledged), f.key('new-paper-holder-repay'));
  await f.books();
  for (const [s, role] of [[sets[3], 'borrower'], [sets[4], 'bidder'], [sets[5], 'holder']]) {
    const victim = role === 'borrower' ? s.borrower : role === 'holder' ? s.lender : s.bidders[0];
    await f.G.withTwoCharacters(f.pool, observer.account, victim.id, (_actor, original, client, h) =>
      runEstate(client, h, original, 'N24 genuine original ' + role + ' estate'), { meet: false });
    assert.equal((await f.pool.query('SELECT state FROM collateral_auctions WHERE id=$1', [s.auction.auctionId])).rows[0].state, 'cancelled');
    assert.equal((await f.pool.query("SELECT id FROM collateral_auction_bids WHERE auction_id=$1 AND state='held'", [s.auction.auctionId])).rows.length, 0);
    if (role === 'borrower') {
      assert.equal((await f.pool.query('SELECT state FROM collateral_lending_pledges WHERE id=$1', [s.pledged.pledge.pledgeId])).rows[0].state, 'estate_released');
      assert.equal((await f.pool.query('SELECT owner_id FROM item_instances WHERE id=$1', [s.item])).rows[0].owner_id, s.borrower.account);
    } else if (role === 'bidder') {
      assert.equal(Number((await f.pool.query('SELECT cash FROM characters WHERE id=$1', [victim.id])).rows[0].cash), 0, 'Original refund enters normal estate cash; no new heir grant');
      await f.C.collateralLendingAction(f.pool, s.borrower.account, 'repay', f.ref(s.pledged), f.key('post-bidder-death-repay'));
    } else {
      const heir = (await f.pool.query('SELECT id FROM characters WHERE account_id=$1 AND alive=true', [s.lender.account])).rows[0];
      assert.notEqual(heir.id, s.lender.id); assert.equal((await f.pool.query('SELECT lender_character FROM loans WHERE id=$1', [s.offered.id])).rows[0].lender_character, heir.id);
      await f.C.collateralLendingAction(f.pool, s.borrower.account, 'repay', f.ref(s.pledged), f.key('actual-heir-repay'));
    }
    await f.books();
  }
  // Both actual paper-purchase roots have different live auction relationships. The full
  // source-defined union is locked; cancellation never becomes an ordinary ownership cap.
  const otherPaper = sets[6], existingBuyer = sets[7].lender;
  await f.ok(otherPaper.lender, 'POST', '/v1/loans/' + otherPaper.offered.id + '/sell', { price: 5000 });
  await f.ok(existingBuyer, 'POST', '/v1/loans/' + otherPaper.offered.id + '/buy', {});
  assert.equal((await f.pool.query('SELECT lender_character FROM loans WHERE id=$1', [otherPaper.offered.id])).rows[0].lender_character, existingBuyer.id);
  assert.equal((await f.pool.query('SELECT state FROM collateral_auctions WHERE id=$1', [otherPaper.auction.auctionId])).rows[0].state, 'cancelled');
  assert.equal((await f.pool.query('SELECT state FROM collateral_auctions WHERE id=$1', [sets[7].auction.auctionId])).rows[0].state, 'open');
  await f.C.collateralLendingAction(f.pool, otherPaper.borrower.account, 'repay', f.ref(otherPaper.pledged), f.key('other-existing-holder-repay'));
  await f.ok(sets[7].borrower, 'POST', '/v1/loans/' + sets[7].offered.id + '/repay', {});
  await f.C.collateralLendingAction(f.pool, sets[7].borrower.account, 'release', f.ref(sets[7].pledged), f.key('existing-holder-original-release'));
  await f.books();
  for (const s of sets) for (const b of s.bidders) assert.deepEqual(await f.Auction.collateralAuctionCounterparts(f.pool, b.id), []);
  // A completed historical sale and its exact receipt survive normal recipient estate rules.
  await f.G.withTwoCharacters(f.pool, observer.account, sale.bidders[0].id, (_actor, original, client, h) =>
    runEstate(client, h, original, 'N24 completed auction recipient estate'), { meet: false });
  await f.books(); const historical = await f.snapshot();
  assert.deepEqual(await action(sale.lender, 'settle', settleBody, keys[winnerIndex]), receipt);
  assert.deepEqual(await f.snapshot(), historical, 'Old-source replay cannot resurrect a recipient, claim or UID');
  console.log('PASS N24 naturally elapsed ordinary one-hour defaults; sealed real funded bids; exact debt/proceeds/UID accounting; late ACK all-table undo with exact attempted allocator advance; concurrent single winner; original replay; ordinary terminal and paper refund mirrors; genuine borrower/bidder/holder estates; no resurrection; all canonical books');
} finally { await f.app.close(); }
