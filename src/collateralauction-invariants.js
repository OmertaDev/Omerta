import crypto from 'node:crypto';
import { loanOwed } from './rules.js';
import { collateralPledgeQuoteHash, verifyCollateralLendingTerminal } from './collaterallending-invariants.js';
import { auctionStable as stable, auctionHash as hash, auctionDate as date,
  collateralAuctionTermsSource as agreementSource, collateralAuctionBidSource as bidSource } from './collateralauction-schema.js';

const fail = reason => { throw Object.assign(Error(reason), { code: 'collateral_auction_invariant' }); };
const json = value => { try { return typeof value === 'string' ? JSON.parse(value) : value; } catch { fail('json_source'); } };
const mutationHash = (account, request) => crypto.createHash('sha256').update(JSON.stringify({ kind: 'operation_action', owner: { scope: 'account', id: account }, request })).digest('hex');
async function guard(client, account, key, body, result) {
  const row = (await client.query('SELECT * FROM item_mutation_guards WHERE idempotency_key=$1', [key])).rows[0];
  if (!row?.completed_at || row.envelope_version !== 1 || row.mutation_kind !== 'operation_action' || row.owner_scope !== 'account'
    || row.owner_id !== account || row.request_hash !== mutationHash(account, body) || stable(json(row.result_json)) !== stable(result)) fail('original_guard');
}
async function journal(client, journalId, character, amount, reason, counterparty) {
  const row = (await client.query('SELECT * FROM transactions WHERE id=$1', [journalId])).rows[0];
  if (!row || row.currency !== 'cash' || row.character_id !== character || row.account_id !== null
    || Number(row.amount) !== amount || row.reason !== reason || row.counterparty !== counterparty) fail('cash_journal');
  return row;
}
export async function collectCollateralAuctionIssues(client) {
  const issues = [], agreements = (await client.query('SELECT * FROM collateral_auction_agreements ORDER BY id')).rows,
    auctions = (await client.query('SELECT * FROM collateral_auctions ORDER BY id')).rows,
    bids = (await client.query('SELECT * FROM collateral_auction_bids ORDER BY amount DESC,id')).rows,
    requests = (await client.query('SELECT * FROM collateral_auction_requests ORDER BY account_id,request_key')).rows;
  for (const a of agreements) {
    try {
      if (a.source_hash !== hash(agreementSource(a)) || a.prepare_key !== 'collateral-auction:' + a.id + ':prepare'
        || a.borrower_account === a.lender_account || a.borrower_character === a.lender_character
        || Number(a.reserve_cash) < Number(a.owed)) fail('agreement_source');
      for (const [character, account] of [[a.borrower_character, a.borrower_account], [a.lender_character, a.lender_account]]) {
        if ((await client.query('SELECT account_id FROM characters WHERE id=$1', [character])).rows[0]?.account_id !== account) fail('original_identity');
      }
      const prepared = requests.filter(r => r.agreement_id === a.id && r.action === 'prepare');
      if (prepared.length !== 1 || prepared[0].run_id !== a.id || prepared[0].account_id !== a.borrower_account || prepared[0].original_character !== a.borrower_character) fail('prepare_request');
      await guard(client, a.borrower_account, a.prepare_key,
        { loanId: a.loan_id, itemId: a.item_id, quoteHash: a.quote_hash, reserve: Number(a.reserve_cash), auctionSeconds: Number(a.auction_seconds), consent: true },
        { ok: true, agreementId: a.id, sourceHash: a.source_hash, approved: false });
      const approvals = requests.filter(r => r.agreement_id === a.id && r.action === 'approve');
      if (a.approved_at) {
        if (+new Date(a.approved_at) < +new Date(a.prepared_at) || approvals.length !== 1 || approvals[0].account_id !== a.lender_account
          || approvals[0].original_character !== a.lender_character || a.approve_key !== 'collateral-auction:' + approvals[0].run_id + ':approve') fail('approve_request');
        await guard(client, a.lender_account, a.approve_key, { agreementId: a.id, sourceHash: a.source_hash, consent: true, approvedAt: date(a.approved_at) },
          { ok: true, agreementId: a.id, sourceHash: a.source_hash, approved: true });
      } else if (approvals.length || a.approve_key) fail('approve_request');
    } catch (error) { if (error.code !== 'collateral_auction_invariant') throw error; issues.push({ id: a.id, reason: error.message }); }
  }
  for (const auction of auctions) {
    try {
      const a = agreements.find(row => row.id === auction.agreement_id), p = (await client.query('SELECT * FROM collateral_lending_pledges WHERE id=$1', [auction.pledge_id])).rows[0];
      const take = p && (await client.query('SELECT at FROM transactions WHERE id=$1', [p.take_journal])).rows[0];
      if (!a?.approved_at || !p || auction.pledge_hash !== p.source_hash || p.loan_id !== a.loan_id || p.item_id !== a.item_id
        || p.borrower_account !== a.borrower_account || p.borrower_character !== a.borrower_character
        || p.original_lender_account !== a.lender_account || p.original_lender_character !== a.lender_character
        || collateralPledgeQuoteHash(p) !== a.quote_hash || loanOwed(p.principal, p.rate) !== Number(a.owed)
        || !take || +new Date(take.at) < +new Date(a.approved_at) || +new Date(p.created_at) < +new Date(a.approved_at)
        || +new Date(auction.opened_at) < +new Date(p.due_at)
        || +new Date(auction.closes_at) !== +new Date(auction.opened_at) + Number(a.auction_seconds) * 1000
        || +new Date(auction.settle_until) !== +new Date(auction.closes_at) + 3600000) fail('auction_source');
      const own = bids.filter(row => row.auction_id === auction.id);
      if (own.length > 2 || own.some(b => b.agreement_hash !== a.source_hash || Number(b.amount) < Number(a.reserve_cash)
        || b.bidder_account === a.borrower_account || b.bidder_account === a.lender_account || +new Date(b.created_at) < +new Date(auction.opened_at)
        || +new Date(b.created_at) >= +new Date(auction.closes_at))) fail('auction_bids');
      const opens = requests.filter(r => r.auction_id === auction.id && r.action === 'open');
      if (opens.length !== 1 || opens[0].run_id !== auction.id || opens[0].original_character !== auction.opened_by
        || auction.open_key !== 'collateral-auction:' + auction.id + ':open') fail('open_request');
      await guard(client, opens[0].account_id, auction.open_key,
        { agreementId: a.id, pledgeId: p.id, sourceHash: a.source_hash, consent: true, openedAt: date(auction.opened_at), closesAt: date(auction.closes_at), settleUntil: date(auction.settle_until), pledgeHash: p.source_hash },
        { ok: true, auctionId: auction.id, agreementId: a.id, sourceHash: a.source_hash, closesAt: date(auction.closes_at), settleUntil: date(auction.settle_until), reserve: Number(a.reserve_cash), ranking: 'highest_cash_then_server_bid_id' });
      const proceeds = (await client.query("SELECT id,amount FROM transactions WHERE reason='collateral-auction:proceeds' AND counterparty=$1", [auction.id])).rows;
      if (auction.state === 'settled') {
        const winner = own[0];
        if (!winner || winner.id !== auction.winning_bid || winner.state !== 'spent' || own.some(b => b.id !== winner.id && b.state !== 'refunded')
          || proceeds.length !== 1 || proceeds[0].id !== auction.proceeds_journal || Number(proceeds[0].amount) !== Number(winner.amount)
          || +new Date(auction.settled_at) < +new Date(auction.closes_at) || +new Date(auction.settled_at) >= +new Date(auction.settle_until)
          || date(auction.closed_at) !== date(auction.settled_at) || p.state !== 'released' || p.release_kind !== 'repaid') fail('settled_source');
        await journal(client, auction.proceeds_journal, a.borrower_character, Number(winner.amount), 'collateral-auction:proceeds', auction.id);
        const terminal = await verifyCollateralLendingTerminal(client, p);
        if (terminal.kind !== 'repaid' || Number(terminal.paid_cash) !== Number(a.owed)) fail('settlement_debt');
        const request = (await client.query('SELECT * FROM collateral_lending_requests WHERE account_id=$1 AND request_key=$2', [a.borrower_account, auction.release_request])).rows[0];
        if (!request || request.action !== 'repay' || request.pledge_id !== p.id || auction.release_request !== 'collateral-auction-repay-' + auction.id) fail('release_source');
        const event = (await client.query('SELECT * FROM item_events WHERE id=$1', [auction.sale_event])).rows[0];
        if (!event || event.item_id !== p.item_id || event.event_kind !== 'transferred' || event.provenance_kind !== 'transferred'
          || event.from_owner_scope !== 'account' || event.from_owner_id !== a.borrower_account || event.to_owner_scope !== 'account' || event.to_owner_id !== winner.bidder_account
          || event.idempotency_key !== 'collateral-auction:' + auction.id + ':sale') fail('sale_source');
        const sale = (await client.query('SELECT result_json FROM item_mutation_guards WHERE idempotency_key=$1', [event.idempotency_key])).rows[0];
        await guard(client, a.borrower_account, event.idempotency_key,
          { auctionId: auction.id, agreementHash: a.source_hash, winningBidId: winner.id, itemId: p.item_id }, json(sale?.result_json));
        const result = json(sale.result_json);
        if (result?.id !== p.item_id || result.owner?.scope !== 'account' || result.owner.id !== winner.bidder_account || result.state !== 'active') fail('sale_guard');
      } else if (auction.state === 'cancelled') {
        if (!auction.closed_at || own.some(b => b.state !== 'refunded') || proceeds.length || auction.winning_bid || auction.sale_event || auction.proceeds_journal) fail('cancelled_source');
      } else if (auction.state !== 'open' || auction.closed_at || proceeds.length || own.some(b => b.state !== 'held')) fail('open_source');
    } catch (error) { if (!['collateral_auction_invariant', 'collateral_lending_invariant'].includes(error.code)) throw error; issues.push({ id: auction.id, reason: error.message }); }
  }
  for (const bid of bids) {
    try {
      const auction = auctions.find(row => row.id === bid.auction_id), a = agreements.find(row => row.id === auction?.agreement_id);
      if (!auction || !a || bid.source_hash !== hash(bidSource(bid)) || bid.agreement_hash !== a.source_hash
        || bid.mutation_key !== 'collateral-auction:' + bid.id + ':bid') fail('bid_source');
      const request = requests.filter(r => r.action === 'bid' && r.run_id === bid.id);
      if (request.length !== 1 || request[0].original_character !== bid.bidder_character || request[0].account_id !== bid.bidder_account) fail('bid_request');
      const debit = await journal(client, bid.debit_journal, bid.bidder_character, -Number(bid.amount), 'collateral-auction:bid', auction.id);
      if (+new Date(debit.at) > +new Date(bid.created_at)) fail('bid_clock');
      await guard(client, bid.bidder_account, bid.mutation_key,
        { auctionId: auction.id, sourceHash: a.source_hash, amount: Number(bid.amount), consent: true, originalCharacter: bid.bidder_character, debitJournal: bid.debit_journal },
        { ok: true, auctionId: auction.id, bidId: bid.id, sourceHash: a.source_hash, escrowedCash: Number(bid.amount) });
      if (bid.state === 'refunded') {
        await journal(client, bid.refund_journal, bid.bidder_character, Number(bid.amount), 'collateral-auction:refund', auction.id);
        if (!bid.resolved_at || +new Date(bid.resolved_at) < +new Date(bid.created_at)) fail('refund_source');
      } else if (bid.state === 'spent') {
        if (auction.state !== 'settled' || auction.winning_bid !== bid.id || !bid.resolved_at || bid.refund_journal) fail('spent_source');
      } else if (bid.state !== 'held' || auction.state !== 'open' || bid.resolved_at || bid.refund_journal) fail('held_source');
    } catch (error) { if (error.code !== 'collateral_auction_invariant') throw error; issues.push({ id: bid.id, reason: error.message }); }
  }
  for (const request of requests) {
    const body = json(request.body_json), receipt = json(request.receipt);
    if (!receipt?.ok || request.body_hash !== hash([request.action, body]) || body?.consent !== true
      || !agreements.some(a => a.id === request.agreement_id) || !['prepare', 'approve', 'open', 'bid', 'settle', 'refund', 'cancel'].includes(request.action)) issues.push({ id: request.run_id, reason: 'request_source' });
  }
  const expected = bids.reduce((sum, b) => sum + (b.state === 'held' ? Number(b.amount) : 0), 0);
  const journals = (await client.query("SELECT reason,amount FROM transactions WHERE currency='cash' AND reason IN ('collateral-auction:bid','collateral-auction:refund','collateral-auction:proceeds')")).rows;
  const drift = expected + journals.reduce((sum, row) => sum + Number(row.amount), 0);
  if (drift !== 0) issues.push({ id: 'cash', reason: 'escrow_conservation', drift });
  return issues;
}
