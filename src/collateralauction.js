import crypto from 'node:crypto';
import * as G from './game.js';
import * as I from './items.js';
import * as C from './collaterallending.js';
import * as Loans from './loans.js';
import { dbCaps } from './db.js';
import { loanOwed, jailed, safeHoused } from './rules.js';
import { collateralPledgeQuoteHash, collectCollateralLendingPledgeIssues } from './collaterallending-invariants.js';
import { collateralPledgeSource } from './collaterallending-schema.js';
import { COLLATERAL_AUCTION as LIMIT, auctionStable as stable, auctionHash as hash, auctionDate as date,
  collateralAuctionTermsSource as agreementSource, collateralAuctionBidSource as bidSource } from './collateralauction-schema.js';
import { collectCollateralAuctionIssues } from './collateralauction-invariants.js';

const results = new WeakMap(), repayments = new WeakMap(), disposals = new WeakMap(), activeRepayments = new WeakMap();
const fail = reason => { throw new G.GameError('collateral_auction', reason); };
const id = value => { if (typeof value !== 'string' || !/^[!-~]{1,128}$/.test(value)) fail('identity'); return value; };
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const object = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const json = value => typeof value === 'string' ? JSON.parse(value) : value;
const clock = async client => new Date((await client.query('SELECT clock_timestamp() AS now')).rows[0].now);
const title = account => ({ scope: 'account', id: account });
export function collateralAuctionTerms(action, body) {
  const keys = action === 'prepare' ? ['loanId', 'itemId', 'quoteHash', 'reserve', 'auctionSeconds', 'consent']
    : action === 'approve' ? ['agreementId', 'sourceHash', 'consent']
      : action === 'open' ? ['agreementId', 'pledgeId', 'sourceHash', 'consent']
        : action === 'bid' ? ['auctionId', 'sourceHash', 'amount', 'consent']
          : action === 'settle' ? ['auctionId', 'sourceHash', 'winningBidId', 'consent']
            : ['auctionId', 'sourceHash', 'consent'];
  if (!['prepare', 'approve', 'open', 'bid', 'settle', 'refund', 'cancel'].includes(action) || !object(body, keys)
    || body.consent !== true || !digest(body[action === 'prepare' ? 'quoteHash' : 'sourceHash'])) fail('terms');
  for (const key of keys.filter(key => /Id$/.test(key))) id(body[key]);
  if (action === 'prepare' && (!Number.isSafeInteger(body.reserve) || body.reserve < 5000 || body.reserve > LIMIT.maximumBidCash
    || !Number.isInteger(body.auctionSeconds) || body.auctionSeconds < LIMIT.minimumSeconds || body.auctionSeconds > LIMIT.maximumSeconds)) fail('terms');
  if (action === 'bid' && (!Number.isSafeInteger(body.amount) || body.amount < 5000 || body.amount > LIMIT.maximumBidCash)) fail('terms');
  return Object.fromEntries(keys.map(key => [key, body[key]]));
}
async function person(client, character, account, requireActive = true) {
  const row = (await client.query('SELECT id,account_id,alive,is_npc FROM characters WHERE id=$1', [character])).rows[0];
  if (!row?.alive || row.is_npc || row.account_id !== account) fail('original');
  const current = (await client.query('SELECT id FROM characters WHERE account_id=$1 AND alive=true ORDER BY id LIMIT 2', [account])).rows;
  if (current.length !== 1 || current[0].id !== character || (requireActive
    && (await client.query('SELECT status FROM accounts WHERE id=$1', [account])).rows[0]?.status !== 'active')) fail('original');
  return row;
}
async function agreement(client, agreementId, lock = true) {
  const row = (await client.query('SELECT * FROM collateral_auction_agreements WHERE id=$1' + (lock ? ' FOR UPDATE' : ''), [agreementId])).rows[0];
  if (!row || row.source_hash !== hash(agreementSource(row))) fail('agreement_source');
  await verifyConsent(client, row, false);
  if (row.approved_at) await verifyConsent(client, row, true);
  return row;
}
async function verifyConsent(client, row, approve) {
  const key = approve ? row.approve_key : row.prepare_key;
  if (!approve && key !== 'collateral-auction:' + row.id + ':prepare') fail('original_consent');
  if (approve) {
    const requests = (await client.query("SELECT run_id FROM collateral_auction_requests WHERE agreement_id=$1 AND action='approve' ORDER BY run_id LIMIT 2", [row.id])).rows;
    if (requests.length !== 1 || key !== 'collateral-auction:' + requests[0].run_id + ':approve') fail('original_consent');
  }
  const guard = (await client.query('SELECT * FROM item_mutation_guards WHERE idempotency_key=$1', [key])).rows[0];
  const owner = approve ? row.lender_account : row.borrower_account;
  const request = approve ? { agreementId: row.id, sourceHash: row.source_hash, consent: true, approvedAt: date(row.approved_at) }
    : { loanId: row.loan_id, itemId: row.item_id, quoteHash: row.quote_hash, reserve: Number(row.reserve_cash), auctionSeconds: Number(row.auction_seconds), consent: true };
  const expected = { ok: true, agreementId: row.id, sourceHash: row.source_hash, approved: approve };
  const requestHash = crypto.createHash('sha256').update(JSON.stringify({ kind: 'operation_action', owner: title(owner), request })).digest('hex');
  if (!guard?.completed_at || guard.envelope_version !== 1 || guard.owner_scope !== 'account' || guard.owner_id !== owner
    || guard.mutation_kind !== 'operation_action' || guard.request_hash !== requestHash || stable(json(guard.result_json)) !== stable(expected)) fail('original_consent');
}
async function pledge(client, row, pledgeId, audit = true) {
  const p = (await client.query('SELECT * FROM collateral_lending_pledges WHERE id=$1 FOR UPDATE', [pledgeId])).rows[0];
  if (!p || p.source_hash !== hash(collateralPledgeSource(p)) || !row.approved_at || p.loan_id !== row.loan_id || p.item_id !== row.item_id || p.borrower_account !== row.borrower_account
    || p.borrower_character !== row.borrower_character || p.original_lender_account !== row.lender_account
    || p.original_lender_character !== row.lender_character || collateralPledgeQuoteHash(p) !== row.quote_hash
    || loanOwed(p.principal, p.rate) !== Number(row.owed) || Number(row.reserve_cash) < loanOwed(p.principal, p.rate)) fail('pledge_source');
  const take = (await client.query('SELECT at FROM transactions WHERE id=$1', [p.take_journal])).rows[0];
  if (!take || +new Date(take.at) < +new Date(row.prepared_at) || +new Date(take.at) < +new Date(row.approved_at)
    || +new Date(p.created_at) < +new Date(row.approved_at)) fail('retroactive_terms');
  if (audit && (await collectCollateralLendingPledgeIssues(client, p.id)).length) fail('pledge_books');
  return p;
}
async function loan(client, row, p, holder, borrower, active = true) {
  const debt = (await client.query('SELECT * FROM loans WHERE id=$1 FOR UPDATE', [row.loan_id])).rows[0];
  if (!debt || (active && debt.status !== 'active') || debt.borrower_character !== borrower.id || debt.offered_to !== borrower.id
    || debt.lender_character !== holder.id || borrower.id !== row.borrower_character || borrower.account_id !== row.borrower_account
    || holder.account_id === borrower.account_id || loanOwed(debt.principal, debt.rate) !== Number(row.owed)
    || Number(debt.principal) !== Number(p.principal) || Number(debt.rate) !== Number(p.rate) || Number(debt.hours) !== Number(p.hours)
    || date(debt.due_at) !== date(p.due_at) || date(debt.offered_at) !== date(row.offered_at)
    || debt.collateral_car || Number(debt.collateral_min) || Number(debt.collateral_omr)) fail('current_debt');
  await person(client, borrower.id, borrower.account_id); await person(client, holder.id, holder.account_id);
  return debt;
}
async function context(client, auctionId, recovery = false) {
  const hint = (await client.query('SELECT agreement_id,pledge_id FROM collateral_auctions WHERE id=$1', [auctionId])).rows[0];
  if (!hint) fail('auction');
  const a = await agreement(client, hint.agreement_id), p = await pledge(client, a, hint.pledge_id, !recovery);
  const auction = (await client.query('SELECT * FROM collateral_auctions WHERE id=$1 FOR UPDATE', [auctionId])).rows[0];
  if (!auction || auction.agreement_id !== a.id || auction.pledge_id !== p.id || auction.pledge_hash !== p.source_hash
    || +new Date(auction.opened_at) < +new Date(p.due_at)
    || +new Date(auction.closes_at) !== +new Date(auction.opened_at) + Number(a.auction_seconds) * 1000
    || +new Date(auction.settle_until) !== +new Date(auction.closes_at) + 3600000) fail('auction_source');
  await verifyOpen(client, a, auction);
  return { a, p, auction };
}
async function verifyOpen(client, a, auction) {
  const original = (await client.query('SELECT account_id FROM characters WHERE id=$1', [auction.opened_by])).rows[0];
  const key = 'collateral-auction:' + auction.id + ':open';
  const body = { agreementId: a.id, pledgeId: auction.pledge_id, sourceHash: a.source_hash, consent: true,
    openedAt: date(auction.opened_at), closesAt: date(auction.closes_at), settleUntil: date(auction.settle_until), pledgeHash: auction.pledge_hash };
  const expected = { ok: true, auctionId: auction.id, agreementId: a.id, sourceHash: a.source_hash, closesAt: date(auction.closes_at),
    settleUntil: date(auction.settle_until), reserve: Number(a.reserve_cash), ranking: LIMIT.ranking };
  const guard = (await client.query('SELECT * FROM item_mutation_guards WHERE idempotency_key=$1', [key])).rows[0];
  const requestHash = crypto.createHash('sha256').update(JSON.stringify({ kind: 'operation_action', owner: title(original?.account_id), request: body })).digest('hex');
  if (!original || auction.open_key !== key || !guard?.completed_at || guard.owner_scope !== 'account' || guard.owner_id !== original.account_id
    || guard.mutation_kind !== 'operation_action' || guard.envelope_version !== 1 || guard.request_hash !== requestHash || stable(json(guard.result_json)) !== stable(expected)) fail('auction_open_witness');
}
async function bidRows(client, auctionId) {
  const rows = (await client.query('SELECT * FROM collateral_auction_bids WHERE auction_id=$1 ORDER BY amount DESC,id LIMIT 3 FOR UPDATE', [auctionId])).rows;
  if (rows.length > LIMIT.maximumBids) fail('bid_limit');
  for (const row of rows) {
    const journal = (await client.query('SELECT * FROM transactions WHERE id=$1', [row.debit_journal])).rows[0];
    if (row.source_hash !== hash(bidSource(row)) || row.mutation_key !== 'collateral-auction:' + row.id + ':bid'
      || journal?.character_id !== row.bidder_character || journal.currency !== 'cash'
      || journal.reason !== 'collateral-auction:bid' || Number(journal.amount) !== -Number(row.amount)
      || journal.counterparty !== auctionId || journal.account_id !== null) fail('bid_source');
  }
  return rows;
}
async function refundBids(client, auctionId, actors, rentalScope, subject = actors[0]?.id) {
  const R = await import('./equipmentrentals.js');
  const locked = await R.assertEquipmentRentalDeathScope(client, id(subject), rentalScope), receipts = [];
  for (const bid of await bidRows(client, auctionId)) {
    if (bid.state !== 'held') continue;
    if (!locked.ids.has(bid.bidder_character)) fail('refund_prelock');
    await person(client, bid.bidder_character, bid.bidder_account, false);
    const mutable = actors.find(actor => actor.id === bid.bidder_character);
    if (mutable) mutable.cash = Number(mutable.cash) + Number(bid.amount);
    else if ((await client.query('UPDATE characters SET cash=cash+$2 WHERE id=$1 AND alive=true', [bid.bidder_character, Number(bid.amount)])).rowCount !== 1) fail('refund_original');
    const credit = await G.ledger(client, { characterId: bid.bidder_character, currency: 'cash', amount: Number(bid.amount), reason: 'collateral-auction:refund', counterparty: auctionId });
    if ((await client.query("UPDATE collateral_auction_bids SET state='refunded',refund_journal=$2,resolved_at=$3 WHERE id=$1 AND state='held'", [bid.id, credit, await clock(client)])).rowCount !== 1) fail('refund_changed');
    receipts.push({ originalCharacter: bid.bidder_character, refundedCash: Number(bid.amount), bidId: bid.id, auctionId, journalId: credit });
  }
  return receipts;
}
async function prior(client, account, key, identity) {
  const row = (await client.query('SELECT body_hash,receipt FROM collateral_auction_requests WHERE account_id=$1 AND request_key=$2', [account, key])).rows[0];
  if (!row) return null;
  if (row.body_hash !== identity) fail('request_conflict');
  if (!row.receipt) fail('in_progress'); return json(row.receipt);
}
async function record(client, actor, action, terms, key, run, value, a, auction, people) {
  await client.query('INSERT INTO collateral_auction_requests(account_id,request_key,action,body_hash,body_json,run_id,original_character,agreement_id,auction_id,receipt) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
    [actor.account_id, key, action, hash([action, terms]), terms, run, actor.id, a?.id || null, auction?.id || null, value]);
  results.set(value, { client, transaction: I.itemTransactionIdentity(client), actor: actor.id, account: actor.account_id, key, action, terms, run,
    agreementId: a?.id, auctionId: auction?.id, people: people.map(p => ({ id: p.id, cash: Number(p.cash), account: p.account_id })), collateral: null, done: false });
  return value;
}
async function perform(client, actor, other, h, action, terms, key) {
  I.assertItemTransaction(client);
  try {
    const old = await prior(client, actor.account_id, key, hash([action, terms])); if (old) return old;
    await person(client, actor.id, actor.account_id);
    const run = crypto.randomUUID(), now = await clock(client);
    let a, auction, value, collateral = null;
    if (action === 'prepare') {
      const source = await C.collateralLendingAuctionOfferWitness(client, actor.account_id,
        { loanId: terms.loanId, itemId: terms.itemId }, [actor, other]);
      if (source.sourceHash !== terms.quoteHash || Number(terms.reserve) < source.owed) fail('quote_source');
      a = { id: run, loan_id: terms.loanId, item_id: terms.itemId, quote_hash: terms.quoteHash,
        borrower_account: actor.account_id, borrower_character: actor.id, lender_account: other.account_id, lender_character: other.id,
        principal: source.principal, owed: source.owed, reserve_cash: terms.reserve, auction_seconds: terms.auctionSeconds,
        offered_at: source.offeredAt, prepared_at: now, prepare_key: 'collateral-auction:' + run + ':prepare' };
      a.source_hash = hash(agreementSource(a));
      value = { ok: true, agreementId: a.id, sourceHash: a.source_hash, approved: false };
      await I.withItemMutation(client, title(actor.account_id), 'operation_action', a.prepare_key, terms, async () => {
        const columns = Object.keys(a); await client.query('INSERT INTO collateral_auction_agreements(' + columns.join(',') + ') VALUES(' + columns.map((_, i) => '$' + (i + 1)).join(',') + ')', columns.map(k => a[k])); return value;
      });
    } else if (action === 'approve') {
      a = await agreement(client, terms.agreementId);
      if (a.lender_character !== actor.id || a.lender_account !== actor.account_id || a.borrower_character !== other.id || a.source_hash !== terms.sourceHash || a.approved_at) fail('original_lender');
      const source = await C.collateralLendingAuctionOfferWitness(client, other.account_id,
        { loanId: a.loan_id, itemId: a.item_id }, [other, actor]);
      if (source.sourceHash !== a.quote_hash || source.owed !== Number(a.owed)) fail('quote_source');
      value = { ok: true, agreementId: a.id, sourceHash: a.source_hash, approved: true };
      await I.withItemMutation(client, title(actor.account_id), 'operation_action', 'collateral-auction:' + run + ':approve',
        { ...terms, approvedAt: date(now) }, async () => {
        await client.query('UPDATE collateral_auction_agreements SET approved_at=$2,approve_key=$3 WHERE id=$1 AND approved_at IS NULL', [a.id, now, 'collateral-auction:' + run + ':approve']); return value;
      });
    } else if (action === 'open') {
      a = await agreement(client, terms.agreementId); const p = await pledge(client, a, terms.pledgeId);
      const debt = await loan(client, a, p, actor, other);
      if (terms.sourceHash !== a.source_hash || p.state !== 'held' || +now < +new Date(debt.due_at)) fail('not_defaulted');
      if ((await collateralAuctionCounterparts(client, actor.id)).length || (await collateralAuctionCounterparts(client, other.id)).length) fail('auction_capacity');
      auction = { id: run, agreement_id: a.id, pledge_id: p.id, pledge_hash: p.source_hash, opened_at: now,
        closes_at: new Date(+now + Number(a.auction_seconds) * 1000), settle_until: new Date(+now + Number(a.auction_seconds) * 1000 + LIMIT.settlementWindowSeconds * 1000),
        opened_by: actor.id, open_key: 'collateral-auction:' + run + ':open', state: 'open' };
      value = { ok: true, auctionId: auction.id, agreementId: a.id, sourceHash: a.source_hash, closesAt: date(auction.closes_at),
        settleUntil: date(auction.settle_until), reserve: Number(a.reserve_cash), ranking: LIMIT.ranking };
      await I.withItemMutation(client, title(actor.account_id), 'operation_action', auction.open_key,
        { ...terms, openedAt: date(auction.opened_at), closesAt: date(auction.closes_at), settleUntil: date(auction.settle_until), pledgeHash: auction.pledge_hash }, async () => {
          const columns = Object.keys(auction); await client.query('INSERT INTO collateral_auctions(' + columns.join(',') + ') VALUES(' + columns.map((_, i) => '$' + (i + 1)).join(',') + ')', columns.map(k => auction[k])); return value;
        });
    } else {
      const ctx = await context(client, terms.auctionId, ['refund', 'cancel'].includes(action)); ({ a, auction } = ctx);
      if (terms.sourceHash !== a.source_hash) fail('source_hash');
      const bids = await bidRows(client, auction.id);
      if (action === 'bid') {
        if (jailed(actor)) throw new G.GameError('jailed', 'No bidding collateral cash from lockup.');
        if (safeHoused(actor)) throw new G.GameError('safe', 'No parking collateral bids from a safehouse.');
        const holder = (await client.query('SELECT lender_character FROM loans WHERE id=$1', [a.loan_id])).rows[0]?.lender_character;
        if (auction.state !== 'open' || +now >= +new Date(auction.closes_at) || other.id !== a.borrower_character
          || actor.account_id === a.borrower_account || actor.id === holder || actor.account_id === a.lender_account
          || Number(terms.amount) < Number(a.reserve_cash) || Number(actor.cash) < terms.amount || bids.length >= LIMIT.maximumBids
          || bids.some(b => b.bidder_account === actor.account_id)
          || (await collateralAuctionCounterparts(client, actor.id)).length
          || (await client.query("SELECT id FROM collateral_auction_bids WHERE bidder_character=$1 AND state='held'", [actor.id])).rows.length) fail('bid');
        const debt = (await client.query('SELECT * FROM loans WHERE id=$1 FOR UPDATE', [a.loan_id])).rows[0];
        if (!debt || debt.status !== 'active' || ctx.p.state !== 'held' || debt.borrower_character !== other.id || loanOwed(debt.principal, debt.rate) !== Number(a.owed)) fail('current_debt');
        actor.cash = Number(actor.cash) - terms.amount;
        const debit = await h.ledger(client, { characterId: actor.id, currency: 'cash', amount: -terms.amount, reason: 'collateral-auction:bid', counterparty: auction.id });
        const bid = { id: run, auction_id: auction.id, agreement_hash: a.source_hash, bidder_account: actor.account_id,
          bidder_character: actor.id, amount: terms.amount, debit_journal: debit, created_at: now,
          mutation_key: 'collateral-auction:' + run + ':bid', state: 'held' };
        bid.source_hash = hash(bidSource(bid));
        value = { ok: true, auctionId: auction.id, bidId: bid.id, sourceHash: a.source_hash, escrowedCash: terms.amount };
        await I.withItemMutation(client, title(actor.account_id), 'operation_action', bid.mutation_key,
          { ...terms, originalCharacter: actor.id, debitJournal: debit }, async () => {
            const columns = Object.keys(bid); await client.query('INSERT INTO collateral_auction_bids(' + columns.join(',') + ') VALUES(' + columns.map((_, i) => '$' + (i + 1)).join(',') + ')', columns.map(k => bid[k])); return value;
          });
      } else if (action === 'settle') {
        const debt = await loan(client, a, ctx.p, actor, other);
        if (auction.state !== 'open' || +now < +new Date(auction.closes_at) || +now >= +new Date(auction.settle_until)
          || +now < +new Date(debt.due_at) || ctx.p.state !== 'held') fail('sealed');
        const heldBids = bids.filter(b => b.state === 'held'), winner = heldBids[0];
        if (!winner || winner.id !== terms.winningBidId || Number(winner.amount) < loanOwed(debt.principal, debt.rate)
          || winner.bidder_character === actor.id || winner.bidder_account === other.account_id || winner.agreement_hash !== a.source_hash) fail('winner_changed');
        await person(client, winner.bidder_character, winner.bidder_account);
        other.cash = Number(other.cash) + Number(winner.amount);
        const proceeds = await h.ledger(client, { characterId: other.id, currency: 'cash', amount: Number(winner.amount), reason: 'collateral-auction:proceeds', counterparty: auction.id });
        await client.query("UPDATE collateral_auction_bids SET state='spent',resolved_at=$2 WHERE id=$1 AND state='held'", [winner.id, now]);
        const token = Object.freeze({});
        repayments.set(token, { client, transaction: I.itemTransactionIdentity(client), active: true, used: false,
          borrower: other, holder: actor, h, pledgeId: ctx.p.id, pledgeHash: ctx.p.source_hash, agreement: a, auction, winner,
          repaymentKey: 'collateral-auction-repay-' + auction.id });
        activeRepayments.set(client, { transaction: I.itemTransactionIdentity(client), loanId: a.loan_id, auctionId: auction.id });
        try { collateral = await C.repayCollateralLendingForAuction(client, token); }
        finally { const proof = repayments.get(token); if (proof) proof.active = false; repayments.delete(token); activeRepayments.delete(client); }
        const saleKey = 'collateral-auction:' + auction.id + ':sale';
        await I.withItemMutation(client, title(a.borrower_account), 'operation_action', saleKey,
          { auctionId: auction.id, agreementHash: a.source_hash, winningBidId: winner.id, itemId: ctx.p.item_id,
            itemAuthority: { destinations: [title(winner.bidder_account)] } }, mutation =>
            I.transferItem(client, title(a.borrower_account), title(winner.bidder_account), ctx.p.item_id,
              'original consensual default auction after actual loan repayment', mutation));
        const events = (await client.query("SELECT id FROM item_events WHERE item_id=$1 AND idempotency_key=$2 AND event_kind='transferred'", [ctx.p.item_id, saleKey])).rows;
        if (events.length !== 1) fail('sale_event');
        await client.query("UPDATE collateral_auctions SET state='settled',winning_bid=$2,proceeds_journal=$3,sale_event=$4,release_request=$5,settled_at=$6,closed_at=$6,close_reason='ordinary_repaid' WHERE id=$1 AND state='open'",
          [auction.id, winner.id, proceeds, events[0].id, 'collateral-auction-repay-' + auction.id, now]);
        disposals.set(collateral, { client, transaction: I.itemTransactionIdentity(client), auctionId: auction.id, pledgeId: ctx.p.id,
          itemId: ctx.p.item_id, borrowerAccount: a.borrower_account, winningAccount: winner.bidder_account,
          winningCharacter: winner.bidder_character, saleEvent: events[0].id });
        const refunds = await refundBids(client, auction.id, [actor, other], h.rentalDeathScope);
        const released = (await client.query('SELECT release_event FROM collateral_lending_pledges WHERE id=$1', [ctx.p.id])).rows[0];
        value = { ok: true, auctionId: auction.id, winningBidId: winner.id, itemId: ctx.p.item_id, paid: Number(winner.amount),
          debtPaid: loanOwed(debt.principal, debt.rate), borrowerSurplus: Number(winner.amount) - loanOwed(debt.principal, debt.rate),
          saleEvent: events[0].id, releaseEvent: released.release_event, refundedBids: refunds.map(r => r.bidId) };
      } else if (action === 'cancel') {
        const ownBid = bids.some(b => b.state === 'held' && b.bidder_character === actor.id && b.bidder_account === actor.account_id);
        if (actor.id !== a.borrower_character && actor.id !== (await client.query('SELECT lender_character FROM loans WHERE id=$1', [a.loan_id])).rows[0]?.lender_character
          && !(ownBid && +now >= +new Date(auction.settle_until))) fail('party');
        if (auction.state !== 'open' || (+now < +new Date(auction.closes_at) && bids.some(b => b.state === 'held'))) fail('committed');
        if (+now >= +new Date(auction.closes_at) && +now < +new Date(auction.settle_until) && bids.some(b => b.state === 'held')) {
          const debt = (await client.query('SELECT status,lender_character FROM loans WHERE id=$1', [a.loan_id])).rows[0];
          if (debt?.status === 'active' && bids.some(b => b.state === 'held' && b.bidder_character !== debt.lender_character)) fail('eligible_winner');
        }
        await client.query("UPDATE collateral_auctions SET state='cancelled',closed_at=$2,close_reason='cancelled' WHERE id=$1 AND state='open'", [auction.id, now]);
        const refunds = await refundBids(client, auction.id, [actor, other].filter(Boolean), h.rentalDeathScope);
        value = { ok: true, auctionId: auction.id, cancelled: true, refundedBids: refunds.map(r => r.bidId) };
      } else {
        const bid = bids.find(b => b.bidder_character === actor.id && b.bidder_account === actor.account_id);
        if (!bid || bid.state !== 'held' || auction.winning_bid === bid.id || (auction.state === 'open' && +now < +new Date(auction.settle_until))) fail('refund');
        if (auction.state === 'open') await client.query("UPDATE collateral_auctions SET state='cancelled',closed_at=$2,close_reason='settlement_expired' WHERE id=$1 AND state='open'", [auction.id, now]);
        actor.cash = Number(actor.cash) + Number(bid.amount);
        const credit = await h.ledger(client, { characterId: actor.id, currency: 'cash', amount: Number(bid.amount), reason: 'collateral-auction:refund', counterparty: auction.id });
        await client.query("UPDATE collateral_auction_bids SET state='refunded',refund_journal=$2,resolved_at=$3 WHERE id=$1 AND state='held'", [bid.id, credit, now]);
        const refunds = await refundBids(client, auction.id, [actor, other].filter(Boolean), h.rentalDeathScope);
        value = { ok: true, auctionId: auction.id, bidId: bid.id, refundedCash: Number(bid.amount), refundedBids: refunds.map(r => r.bidId) };
      }
    }
    const result = await record(client, actor, action, terms, key, run, value, a, auction, [actor, ...(other ? [other] : [])]);
    results.get(result).collateral = collateral;
    return result;
  } catch (error) { I.poisonItemTransaction(client, error); throw error; }
}

export async function collateralAuctionAvailability() {
  const R = await import('./equipmentrentals.js'), Estate = await import('./social/estate.js'), Books = await import('./invariants.js');
  const entries = [[G.getCollateralAuctionFinalizer, finalizeCollateralAuction], [R.getCollateralAuctionCounterparts, collateralAuctionCounterparts],
    [Estate.getCollateralAuctionEstateStart, recoverCollateralAuctionsAtEstateStart], [Books.getCollateralAuctionBookCollector, collectCollateralAuctionIssues],
    [C.getCollateralAuctionOfferWitness, C.collateralLendingAuctionOfferWitness], [C.getCollateralAuctionRepayer, C.repayCollateralLendingForAuction],
    [Loans.getCollateralAuctionRecoveryVerifier, Loans.assertCollateralAuctionRecoveryProof]];
  let ready = true;
  for (const [getter, expected] of entries) if (typeof getter !== 'function' || typeof expected !== 'function' || await getter() !== expected) ready = false;
  return { available: ready && dbCaps.skipLocked === true && (await C.collateralLendingAvailability()).available,
    nativeOnly: true, financialActivation: false, currency: 'game_cash', cryptoAvailable: false };
}
export async function collateralAuctionAction(pool, account, action, body, key) {
  id(account); id(key); const terms = collateralAuctionTerms(action, body), identity = hash([action, terms]);
  const old = await I.withItemRead(pool, client => prior(client, account, key, identity)); if (old) return old;
  if (!(await collateralAuctionAvailability()).available) throw Object.assign(new G.GameError('collateral_auction_unavailable', 'Canonical native loan, title, preactor, estate and books integration required.'), { statusCode: 503 });
  let target;
  if (action === 'prepare') target = (await pool.query('SELECT lender_character FROM loans WHERE id=$1', [terms.loanId])).rows[0]?.lender_character;
  else if (action === 'approve' || action === 'open') target = (await pool.query('SELECT borrower_character FROM collateral_auction_agreements WHERE id=$1', [terms.agreementId])).rows[0]?.borrower_character;
  else {
    const row = (await pool.query('SELECT g.borrower_character,g.borrower_account,l.lender_character FROM collateral_auctions a JOIN collateral_auction_agreements g ON g.id=a.agreement_id LEFT JOIN loans l ON l.id=g.loan_id WHERE a.id=$1', [terms.auctionId])).rows[0];
    target = row?.borrower_account === account ? row.lender_character : row?.borrower_character;
  }
  const result = await G.withTwoCharacters(pool, account, id(target),
    (actor, other, client, h) => perform(client, actor, other, h, action, terms, key), { meet: false });
  const { character, ...receipt } = result; return receipt;
}
/** Consume-once delegation is minted only by the paid, source-checked actual settlement leaf. */
export async function assertCollateralAuctionRepayment(client, token) {
  I.assertItemTransaction(client); I.assertItemTransactionHealthy(client);
  const proof = token && repayments.get(token);
  if (!proof?.active || proof.used || proof.client !== client || proof.transaction !== I.itemTransactionIdentity(client)) fail('repayment_authority');
  const ctx = await context(client, proof.auction.id), debt = await loan(client, ctx.a, ctx.p, proof.holder, proof.borrower);
  const winner = (await bidRows(client, ctx.auction.id)).find(b => b.id === proof.winner.id);
  if (ctx.auction.state !== 'open' || winner?.state !== 'spent' || Number(winner.amount) < loanOwed(debt.principal, debt.rate)
    || +await clock(client) < +new Date(debt.due_at) || ctx.a.source_hash !== proof.agreement.source_hash) fail('repayment_authority');
  proof.used = true; return proof;
}
export async function assertCollateralAuctionDisposal(client, collateralResult, pledgeRow) {
  I.assertItemTransaction(client); const proof = collateralResult && disposals.get(collateralResult);
  if (!proof || proof.client !== client || proof.transaction !== I.itemTransactionIdentity(client)
    || proof.pledgeId !== pledgeRow.id || proof.itemId !== pledgeRow.item_id || proof.borrowerAccount !== pledgeRow.borrower_account) fail('disposal_authority');
  const a = (await client.query('SELECT state,sale_event,winning_bid FROM collateral_auctions WHERE id=$1', [proof.auctionId])).rows[0];
  const event = (await client.query('SELECT * FROM item_events WHERE id=$1', [proof.saleEvent])).rows[0];
  const item = (await client.query('SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1', [proof.itemId])).rows[0];
  await person(client, proof.winningCharacter, proof.winningAccount);
  if (a?.state !== 'settled' || a.sale_event !== proof.saleEvent || event?.item_id !== proof.itemId || event.event_kind !== 'transferred'
    || event.from_owner_scope !== 'account' || event.from_owner_id !== proof.borrowerAccount || event.to_owner_scope !== 'account' || event.to_owner_id !== proof.winningAccount
    || item?.owner_scope !== 'account' || item.owner_id !== proof.winningAccount || item.state !== 'active'
    || (await client.query('SELECT item_id FROM operation_escrow WHERE item_id=$1', [proof.itemId])).rows.length) fail('sale_custody');
  return true;
}
/** Only the actual canonical Loans paper/terminal leaves can mint a recovery token. */
export async function recoverCollateralAuctionFromLoan(client, token) {
  I.assertItemTransaction(client);
  try {
    if (typeof Loans.getCollateralAuctionRecoveryVerifier !== 'function'
      || await Loans.getCollateralAuctionRecoveryVerifier() !== Loans.assertCollateralAuctionRecoveryProof) fail('loan_recovery_integration');
    const proof = await Loans.assertCollateralAuctionRecoveryProof(client, token);
    if (!['paper', 'terminal'].includes(proof.kind) || !proof.receipt || !proof.actor || !proof.other) fail('loan_recovery_source');
    const active = activeRepayments.get(client);
    if (proof.kind === 'terminal' && active?.transaction === I.itemTransactionIdentity(client) && active.loanId === proof.loanId) return;
    const rows = (await client.query(`SELECT a.id FROM collateral_auctions a JOIN collateral_auction_agreements g ON g.id=a.agreement_id
      WHERE g.loan_id=$1 AND (a.state='open' OR a.id IN (SELECT auction_id FROM collateral_auction_bids WHERE state='held')) ORDER BY a.id LIMIT 2`, [proof.loanId])).rows;
    if (rows.length > 1) fail('recovery_capacity');
    if (!rows.length) return;
    const ctx = await context(client, rows[0].id, true), debt = (await client.query('SELECT * FROM loans WHERE id=$1 FOR UPDATE', [proof.loanId])).rows[0];
    if (proof.kind === 'paper') {
      if (debt?.status !== 'active' || debt.lender_character !== proof.actor.id || debt.borrower_character !== ctx.a.borrower_character
        || proof.other.id === proof.actor.id || proof.actor.id === ctx.a.borrower_character) fail('paper_source');
    } else {
      const terminal = await (await import('./collaterallending-invariants.js')).verifyCollateralLendingTerminal(client, ctx.p);
      if (!debt || !['repaid', 'collected'].includes(debt.status) || terminal.kind !== debt.status
        || terminal.holder_character !== debt.lender_character) fail('terminal_source');
    }
    await client.query("UPDATE collateral_auctions SET state='cancelled',closed_at=$2,close_reason=$3 WHERE id=$1 AND state='open'", [ctx.auction.id, await clock(client), proof.kind === 'paper' ? 'claim_transferred' : 'ordinary_terminal']);
    // A paper buyer may already hold another unrelated auction. While this claim has changed
    // hands but its refunds are still being resolved, validate the original seller root; its
    // genuine preactor scope already contains every funded original of this cancelled auction.
    await refundBids(client, ctx.auction.id, [proof.actor, proof.other], proof.rentalScope,
      proof.kind === 'paper' ? proof.other.id : proof.actor.id);
    results.set(proof.receipt, { recovery: true, client, transaction: I.itemTransactionIdentity(client), done: false,
      people: [proof.actor, proof.other].map(p => ({ id: p.id, cash: Number(p.cash) })) });
  } catch (error) { I.poisonItemTransaction(client, error); throw error; }
}
export async function finalizeCollateralAuction(client, result) {
  const scope = result && (results.get(result) || results.get(result.loan)); if (!scope) return;
  try {
    I.assertItemTransaction(client); I.assertItemTransactionHealthy(client);
    if (scope.done || scope.client !== client || scope.transaction !== I.itemTransactionIdentity(client)) fail('finalization');
    if (scope.recovery) {
      for (const p of scope.people) {
        if (Number((await client.query('SELECT cash FROM characters WHERE id=$1', [p.id])).rows[0]?.cash) !== p.cash) fail('recovery_persistence');
      }
      if ((await collectCollateralAuctionIssues(client)).length) fail('recovery_books');
      scope.done = true; return;
    }
    const request = (await client.query('SELECT * FROM collateral_auction_requests WHERE account_id=$1 AND request_key=$2', [scope.account, scope.key])).rows[0];
    if (!request || request.original_character !== scope.actor || request.action !== scope.action || request.run_id !== scope.run
      || request.body_hash !== hash([scope.action, scope.terms]) || stable(json(request.body_json)) !== stable(scope.terms) || stable(json(request.receipt)) !== stable(result)) fail('receipt_source');
    for (const p of scope.people) {
      await person(client, p.id, p.account, p.id === scope.actor || !['refund', 'cancel'].includes(scope.action));
      if (Number((await client.query('SELECT cash FROM characters WHERE id=$1', [p.id])).rows[0]?.cash) !== p.cash) fail('cash_persistence');
    }
    if (scope.collateral) await C.finalizeCollateralLendingAction(client, scope.collateral);
    if ((await collectCollateralAuctionIssues(client)).length) fail('auction_books');
    scope.done = true;
  } catch (error) { I.poisonItemTransaction(client, error); throw error; }
}

/** Closed, source-defined derived counterparts; callers never nominate additional actors. */
export async function collateralAuctionCounterparts(client, characterId) {
  id(characterId);
  const rows = (await client.query(`SELECT a.id,g.borrower_character,l.lender_character FROM collateral_auctions a
    JOIN collateral_auction_agreements g ON g.id=a.agreement_id JOIN collateral_lending_pledges p ON p.id=a.pledge_id
    LEFT JOIN loans l ON l.id=g.loan_id WHERE (a.state='open' OR a.id IN (SELECT auction_id FROM collateral_auction_bids WHERE state='held'))
    AND (g.borrower_character=$1 OR l.lender_character=$1 OR a.id IN (SELECT auction_id FROM collateral_auction_bids WHERE bidder_character=$1 AND state='held'))
    ORDER BY a.id LIMIT 2`, [characterId])).rows;
  if (rows.length > 1) fail('counterpart_capacity');
  const ids = new Set();
  for (const row of rows) {
    const ctx = await contextRead(client, row.id);
    if (!ctx) fail('counterpart_source');
    ids.add(row.borrower_character); if (row.lender_character && row.lender_character !== 'HOUSE') ids.add(row.lender_character);
    const bidders = (await client.query("SELECT bidder_character FROM collateral_auction_bids WHERE auction_id=$1 AND state='held' ORDER BY id LIMIT 3", [row.id])).rows;
    if (bidders.length > LIMIT.maximumBids) fail('counterpart_capacity'); for (const bidder of bidders) ids.add(bidder.bidder_character);
  }
  ids.delete(characterId); if (ids.size > 3) fail('counterpart_capacity'); return [...ids].sort();
}
async function contextRead(client, auctionId) {
  const row = (await client.query('SELECT g.*,a.pledge_hash,a.pledge_id FROM collateral_auctions a JOIN collateral_auction_agreements g ON g.id=a.agreement_id WHERE a.id=$1', [auctionId])).rows[0];
  const p = row && (await client.query('SELECT * FROM collateral_lending_pledges WHERE id=$1', [row.pledge_id])).rows[0];
  if (!row?.approved_at || row.source_hash !== hash(agreementSource(row)) || !p || p.source_hash !== hash(collateralPledgeSource(p))
    || row.pledge_hash !== p.source_hash || p.loan_id !== row.loan_id || p.item_id !== row.item_id || p.borrower_character !== row.borrower_character
    || p.borrower_account !== row.borrower_account || p.original_lender_character !== row.lender_character || p.original_lender_account !== row.lender_account
    || collateralPledgeQuoteHash(p) !== row.quote_hash || +new Date(row.approved_at) > +new Date(p.created_at)) return null;
  await verifyConsent(client, row, false); await verifyConsent(client, row, true);
  await verifyOpen(client, row, (await client.query('SELECT * FROM collateral_auctions WHERE id=$1', [auctionId])).rows[0]);
  return row;
}
export async function recoverCollateralAuctionsAtEstateStart(client, victimId, rentalScope, estateScope) {
  I.assertItemTransaction(client);
  try {
    const R = await import('./equipmentrentals.js'), Estate = await import('./social/estate.js');
    const locked = await R.assertEquipmentRentalDeathScope(client, victimId, rentalScope);
    await Estate.assertEstateResolutionScope(client, victimId, estateScope);
    const victim = (await client.query('SELECT account_id,alive FROM characters WHERE id=$1', [victimId])).rows[0]; if (!victim?.alive) fail('estate_phase');
    const counterpartIds = await collateralAuctionCounterparts(client, victimId);
    const ids = [victimId, ...counterpartIds];
    const auctions = (await client.query(`SELECT a.id FROM collateral_auctions a JOIN collateral_auction_agreements g ON g.id=a.agreement_id
      LEFT JOIN loans l ON l.id=g.loan_id WHERE (a.state='open' OR a.id IN (SELECT auction_id FROM collateral_auction_bids WHERE state='held')) AND (g.borrower_character=$1 OR l.lender_character=$1
      OR a.id IN (SELECT auction_id FROM collateral_auction_bids WHERE bidder_character=$1 AND state='held')) ORDER BY a.id LIMIT 2${dbCaps.skipLocked ? ' FOR UPDATE OF a' : ' FOR UPDATE'}`, [victimId])).rows;
    if (auctions.length > 1) fail('estate_capacity'); const receipts = [];
    for (const row of auctions) {
      const ctx = await context(client, row.id, true);
      // Characters were source-resolved and sorted before any loan/auction row.
      // Lock only a genuine existing debt, then validate its current holder;
      // nullable outer-join metadata never supplies loan or refund authority.
      const debt = (await client.query('SELECT * FROM loans WHERE id=$1 FOR UPDATE', [ctx.a.loan_id])).rows[0];
      if (!debt || debt.status !== 'active' || debt.borrower_character !== ctx.a.borrower_character || debt.offered_to !== ctx.a.borrower_character
        || !locked.ids.has(debt.lender_character) || !locked.ids.has(debt.borrower_character) || debt.lender_character === 'HOUSE'
        || Number(debt.principal) !== Number(ctx.p.principal) || Number(debt.rate) !== Number(ctx.p.rate) || Number(debt.hours) !== Number(ctx.p.hours)
        || date(debt.due_at) !== date(ctx.p.due_at) || date(debt.offered_at) !== date(ctx.p.offered_at)
        || debt.collateral_car || Number(debt.collateral_min) || Number(debt.collateral_omr)) fail('estate_debt_source');
      const holder = (await client.query('SELECT account_id FROM characters WHERE id=$1', [debt.lender_character])).rows[0];
      if (!holder) fail('estate_debt_source');
      await person(client, debt.lender_character, holder.account_id, false);
      await person(client, ctx.a.borrower_character, ctx.a.borrower_account, false);
      await client.query("UPDATE collateral_auctions SET state='cancelled',closed_at=$2,close_reason='original_death' WHERE id=$1 AND state='open'", [row.id, await clock(client)]);
      for (const bid of await bidRows(client, row.id)) if (bid.state === 'held' && !ids.includes(bid.bidder_character)) fail('estate_counterpart_changed');
      receipts.push(...await refundBids(client, ctx.auction.id, [], rentalScope, victimId));
    }
    return receipts;
  } catch (error) { I.poisonItemTransaction(client, error); throw error; }
}
export async function collateralAuctionBoard(pool, account) {
  id(account);
  return I.withItemRead(pool, async client => {
    const agreements = (await client.query('SELECT * FROM collateral_auction_agreements WHERE borrower_account=$1 OR lender_account=$1 ORDER BY prepared_at DESC,id LIMIT 25', [account])).rows;
    const auctions = (await client.query(`SELECT a.*,g.source_hash,g.reserve_cash,g.item_id FROM collateral_auctions a
      JOIN collateral_auction_agreements g ON g.id=a.agreement_id WHERE a.state='open' OR g.borrower_account=$1 OR g.lender_account=$1
      OR a.id IN (SELECT auction_id FROM collateral_auction_bids WHERE bidder_account=$1) ORDER BY a.opened_at DESC,a.id LIMIT 25`, [account])).rows;
    const now = await clock(client), publicAuctions = [];
    for (const row of auctions) {
      const sealed = +now < +new Date(row.closes_at), bids = (await client.query('SELECT id,bidder_account,amount,state FROM collateral_auction_bids WHERE auction_id=$1 ORDER BY amount DESC,id LIMIT 2', [row.id])).rows;
      publicAuctions.push({ auctionId: row.id, itemId: row.item_id, sourceHash: row.source_hash, state: row.state,
        reserve: Number(row.reserve_cash), closesAt: date(row.closes_at), settleUntil: date(row.settle_until), sealed, bids: bids.filter(b => !sealed || b.bidder_account === account)
          .map(b => ({ bidId: b.id, amount: Number(b.amount), state: b.state, mine: b.bidder_account === account })) });
    }
    return { agreements: agreements.map(a => ({ agreementId: a.id, sourceHash: a.source_hash, loanId: a.loan_id, itemId: a.item_id,
      approved: !!a.approved_at, reserve: Number(a.reserve_cash), auctionSeconds: Number(a.auction_seconds) })), auctions: publicAuctions, limits: LIMIT };
  });
}
