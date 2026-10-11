import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { isDeepStrictEqual } from 'node:util';
import { GameError, trunkCap } from './game.js';
import { loanOwed, loanVig } from './rules.js';
import * as Loans from './loans.js';
import * as Delivery from './delivery.js';
import { deliveryFinanceTerms, deliveryFinanceQuote } from './deliveryfinanceterms.js';

const scopes = new AsyncLocalStorage();
const fail = message => { throw new GameError('delivery_finance', message); };
const key = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const iso = value => value == null ? null : new Date(value).toISOString();
const intake = () => { if (process.env.DEPOT_PILOT !== 'on') fail('New delivery advances are not open.'); };
async function permitted(client, action, row, supplier, fn) {
  const context = { active: true, client, action, requestId: row.id, loanId: row.loan_id, commitmentId: row.commitment_id, supplierId: supplier.id };
  try { return await scopes.run(context, fn); } finally { context.active = false; }
}
const can = (client, action, row, ch) => {
  const scope = scopes.getStore();
  return scope?.active === true && scope.client === client && scope.action === action && scope.requestId === row.id
    && scope.loanId === row.loan_id && scope.commitmentId === row.commitment_id && scope.supplierId === ch.id;
};
function view(row, loan = null) {
  return { id: row.id, commitmentId: row.commitment_id, orderId: row.order_id, supplierId: row.supplier_character,
    requestedLenderId: row.requested_lender_character, buyerId: row.buyer_character, terms: row.terms, quote: row.quote,
    state: ['offered', 'active'].includes(row.state) && (!loan || !['open', 'active'].includes(loan.status))
      ? 'closed' : row.state,
    loanId: row.loan_id, currentLenderId: loan?.lender_character || null, loanStatus: loan?.status || null,
    createdAt: iso(row.created_at), fundedAt: iso(row.funded_at), acceptedAt: iso(row.accepted_at), settledAt: iso(row.settled_at),
    settlement: row.settlement, gameCashOnly: true, quoteIsBacking: false };
}
async function hintByRequest(client, id) {
  if (!key(id)) fail('Choose a valid advance request.');
  const row = (await client.query('SELECT * FROM delivery_loan_requests WHERE id=$1', [id])).rows[0];
  if (!row) fail('No delivery advance request.'); return row;
}
// The outer wrapper owns sorted character/account locks. Every financial path
// takes existing loan -> order -> commitment -> request BEFORE street_tax.
async function lockContext(client, hint) {
  const loan = hint.loan_id ? (await client.query('SELECT * FROM loans WHERE id=$1 FOR UPDATE', [hint.loan_id])).rows[0] : null;
  const order = (await client.query('SELECT * FROM market_listings WHERE id=$1 FOR UPDATE', [hint.order_id])).rows[0];
  const commitment = (await client.query('SELECT * FROM delivery_commitments WHERE id=$1 FOR UPDATE', [hint.commitment_id])).rows[0];
  const row = (await client.query('SELECT * FROM delivery_loan_requests WHERE id=$1 FOR UPDATE', [hint.id])).rows[0];
  if (!row || row.commitment_id !== hint.commitment_id || row.order_id !== hint.order_id || row.loan_id !== hint.loan_id) fail('Advance context changed; refresh.');
  return { row, order, commitment, loan };
}
async function closedDebt(client, context) {
  const { row, loan } = context;
  if (row.loan_id && (!loan || !['open', 'active'].includes(loan.status)) && ['offered', 'active'].includes(row.state)) {
    await client.query("UPDATE delivery_loan_requests SET state='closed' WHERE id=$1", [row.id]); row.state = 'closed';
  }
}
function roles(row, supplier, lender, { current = false, loan = null } = {}) {
  if (!supplier?.alive || !lender?.alive || supplier.is_npc || lender.is_npc || supplier.id !== row.supplier_character
      || (current ? loan?.lender_character !== lender.id : row.requested_lender_character !== lender.id)
      || supplier.id === lender.id || supplier.account_id === lender.account_id) fail('Use the original supplier and authorized current creditor.');
}
async function quoteContext(client, supplier, lender, commitment, order, owned, acct) {
  const buyer = (await client.query('SELECT * FROM characters WHERE id=$1', [commitment?.buyer_character || ''])).rows[0];
  return { supplier, lender, buyer, commitment, order, owned, acct };
}
async function strictQuote(client, body, supplier, lender, commitment, order, owned, acct) {
  const q = deliveryFinanceQuote(body, await quoteContext(client, supplier, lender, commitment, order, owned, acct));
  if (!q.eligible) fail('Advance admission refused: ' + q.reason); return q;
}
// Capital is already in canonical loan escrow or debt. Do not falsify lender
// pocket cash to reuse origination admission after an actual funded offer.
function contract(row, c, order, supplier, owned, acct, { settlement = false } = {}) {
  const q = row.quote, now = Date.now(), qty = Number(c?.quantity), remaining = Number(c?.remaining);
  const deadline = new Date(c?.deadline).getTime(), spent = Number(c?.spent), budget = Number(c?.spend_limit);
  if (!c || !order || c.id !== row.commitment_id || c.order_id !== row.order_id || c.depot_id !== order.depot_id
      || c.supplier_character !== supplier.id || c.buyer_character !== row.buyer_character || order.seller_character !== row.buyer_character
      || c.status !== 'accepted' || c.good_id !== 'gin' || order.kind !== 'order' || order.status !== 'live' || order.good_id !== c.good_id
      || c.district !== q.districtId || order.district !== c.district || Number(c.unit_price) !== q.unitPrice || Number(order.price) !== q.unitPrice
      || qty !== q.quantity || remaining !== qty || Number(c.take_bps) !== q.takeBps || iso(c.deadline) !== q.deadline
      || !Number.isFinite(deadline) || deadline <= now || new Date(order.expires_at).getTime() < deadline || Number(order.qty) < remaining
      || !Number.isFinite(spent) || spent < 0 || spent > budget || (!settlement && spent !== 0) || budget < row.terms.principal)
    fail('The original untouched funded delivery terms are no longer valid.');
  const capacity = trunkCap({ owned, acct }), other = Object.entries(owned.cargo || {}).filter(([g]) => g !== 'gin').reduce((sum, [,n]) => sum + Number(n), 0);
  if (!Number.isFinite(other) || other < 0 || qty + other > capacity) fail('The whole financed delivery must still fit in the actual trunk.');
  const net = qty * q.unitPrice - Math.ceil(qty * q.unitPrice * q.takeBps / 10000);
  if (net !== q.fullSettlementNet || net < loanOwed(row.terms.principal, row.terms.rate)) fail('Actual fixed settlement cannot cover this whole debt.');
}
function loanTerms(row, loan, supplier, lender, status) {
  if (!loan || loan.status !== status || loan.lender_character !== lender.id || Number(loan.principal) !== row.terms.principal
      || Number(loan.rate) !== row.terms.rate || Number(loan.hours) !== row.terms.hours || Number(loan.collateral_min) !== 0
      || Number(loan.collateral_omr) !== 0 || loan.collateral_car
      || (status === 'open' ? loan.offered_to !== supplier.id : loan.borrower_character !== supplier.id)) fail('Canonical loan consent or current ownership changed.');
}
export async function requestDeliveryAdvance(supplier, lender, body, requestKey, client, h) {
  let terms; try { terms = deliveryFinanceTerms(body); } catch { fail('Provide exact advance terms.'); }
  if (typeof requestKey !== 'string' || !/^[\x21-\x7e]{1,200}$/.test(requestKey)) fail('Provide a bounded request identity.');
  const previous = (await client.query('SELECT * FROM delivery_loan_requests WHERE supplier_character=$1 AND request_key=$2', [supplier.id, requestKey])).rows[0];
  if (previous) {
    if (previous.requested_lender_character !== lender.id || !isDeepStrictEqual(previous.terms, terms)) fail('This request identity already has different terms.');
    const ctx = await lockContext(client, previous); await closedDebt(client, ctx); return { ok: true, request: view(ctx.row, ctx.loan) };
  }
  intake();
  const pre = (await client.query('SELECT order_id FROM delivery_commitments WHERE id=$1 AND supplier_character=$2', [terms.commitmentId, supplier.id])).rows[0];
  if (!pre) fail('No delivery commitment of yours.');
  const existing = (await client.query("SELECT * FROM delivery_loan_requests WHERE commitment_id=$1 AND state IN ('requested','offered','active')", [terms.commitmentId])).rows[0];
  if (existing) {
    const ctx = await lockContext(client, existing); await closedDebt(client, ctx);
    if (['requested', 'offered', 'active'].includes(ctx.row.state)) fail('This commitment already has a live advance request.');
  }
  const order = (await client.query('SELECT * FROM market_listings WHERE id=$1 FOR UPDATE', [pre.order_id])).rows[0];
  const c = (await client.query('SELECT * FROM delivery_commitments WHERE id=$1 FOR UPDATE', [terms.commitmentId])).rows[0];
  const count = (await client.query("SELECT id FROM delivery_loan_requests WHERE supplier_character=$1 AND state IN ('requested','offered') LIMIT 3", [supplier.id])).rows.length;
  if (count >= 3) fail('Resolve one of your own three pending advance requests.');
  const quote = await strictQuote(client, terms, supplier, lender, c, order, h.owned, h.acct), id = crypto.randomUUID();
  await client.query("INSERT INTO delivery_loan_requests(id,commitment_id,order_id,supplier_character,requested_lender_character,buyer_character,request_key,terms,quote,created_at,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'requested')",
    [id, c.id, order.id, supplier.id, lender.id, c.buyer_character, requestKey, terms, quote, new Date()]);
  return { ok: true, request: view((await client.query('SELECT * FROM delivery_loan_requests WHERE id=$1', [id])).rows[0]) };
}
export async function offerDeliveryAdvance(lender, supplier, requestId, client, h) {
  const ctx = await lockContext(client, await hintByRequest(client, requestId)); await closedDebt(client, ctx);
  const { row, commitment: c, order, loan } = ctx; roles(row, supplier, lender);
  if (row.loan_id) return { ok: true, request: view(row, loan) };
  intake(); if (row.state !== 'requested') fail('Only an outstanding supplier request can be funded.');
  const q = await strictQuote(client, row.terms, supplier, lender, c, order, h.victimOwned, h.victimAcct);
  if (!isDeepStrictEqual(q, row.quote)) fail('Refresh changed admission or carrying terms before funding.');
  const result = await Loans.offerLoan(lender, { amount: row.terms.principal, rate: row.terms.rate, hours: row.terms.hours,
    to: supplier.id, collateral: 0, collateralOmr: 0 }, client, h);
  await client.query("UPDATE delivery_loan_requests SET state='offered',loan_id=$2,funded_at=$3 WHERE id=$1", [row.id, result.id, new Date()]);
  return { ok: true, request: view((await client.query('SELECT * FROM delivery_loan_requests WHERE id=$1', [row.id])).rows[0],
    (await client.query('SELECT * FROM loans WHERE id=$1', [result.id])).rows[0]) };
}
export async function takeDeliveryAdvance(supplier, lender, requestId, client, h) {
  const ctx = await lockContext(client, await hintByRequest(client, requestId)); await closedDebt(client, ctx);
  const { row, commitment: c, order, loan } = ctx;
  roles(row, supplier, lender, { current: true, loan });
  if (row.state === 'active' || row.state === 'settled') return { ok: true, request: view(row, loan) };
  if (row.state !== 'offered') fail('Only its actual funded loan offer can be accepted.');
  contract(row, c, order, supplier, h.owned, h.acct); loanTerms(row, loan, supplier, lender, 'open');
  const result = await permitted(client, 'take', row, supplier, async () => {
    await assertDeliveryFinanceLoanTake(client, supplier, row.loan_id);
    return Loans.takeLoan(supplier, row.loan_id, null, client, h);
  });
  await client.query("UPDATE delivery_loan_requests SET state='active',accepted_at=$2 WHERE id=$1", [row.id, new Date()]);
  return { ok: true, loan: result, request: view((await client.query('SELECT * FROM delivery_loan_requests WHERE id=$1', [row.id])).rows[0],
    (await client.query('SELECT * FROM loans WHERE id=$1', [row.loan_id])).rows[0]) };
}
export async function deliverFinancedCommitment(supplier, currentLender, commitmentId, qty, client, h) {
  if (!key(commitmentId)) fail('Choose a valid commitment.');
  const hint = (await client.query("SELECT * FROM delivery_loan_requests WHERE supplier_character=$1 AND (commitment_id||'')=$2 AND state IN ('active','settled') ORDER BY created_at DESC,id LIMIT 1", [supplier.id, commitmentId])).rows.find(row => row.supplier_character === supplier.id && row.commitment_id === commitmentId && ['active','settled'].includes(row.state));
  if (!hint) fail('No financed delivery of yours.');
  const ctx = await lockContext(client, hint); await closedDebt(client, ctx);
  const { row, commitment: c, order, loan } = ctx;
  if (row.supplier_character !== supplier.id) fail('No financed delivery of yours.');
  if (row.state === 'settled') return { ok: true, request: view(row, loan), ...row.settlement };
  roles(row, supplier, currentLender, { current: true, loan });
  if (row.state !== 'active') fail('Canonical terminal debt released this encumbrance; use ordinary delivery.');
  contract(row, c, order, supplier, h.owned, h.acct, { settlement: true }); loanTerms(row, loan, supplier, currentLender, 'active');
  const full = Number(c.remaining), owed = loanOwed(loan.principal, loan.rate);
  if (!Number.isSafeInteger(qty) || qty !== full || Number(h.owned.cargo.gin || 0) < full) fail('Settle the full committed cargo you actually hold.');
  const settlement = await permitted(client, 'settle', row, supplier, async () => {
    await assertDeliveryFinanceDelivery(client, supplier, commitmentId);
    const delivery = await Delivery.deliverCommitment(supplier, commitmentId, qty, client, h);
    if (delivery.delivered !== full || !Number.isFinite(delivery.earned) || delivery.earned < owed) fail('Only this actual full delivery credit can repay the debt.');
    const repayment = await Loans.repayLoan(supplier, currentLender, row.loan_id, client, h);
    if (repayment.paid !== owed || repayment.paid > delivery.earned) fail('Repayment exceeded the actual delivery credit.');
    return { delivery, repayment };
  });
  await client.query("UPDATE delivery_loan_requests SET state='settled',settled_at=$2,settlement=$3 WHERE id=$1", [row.id, new Date(), settlement]);
  return { ok: true, request: view((await client.query('SELECT * FROM delivery_loan_requests WHERE id=$1', [row.id])).rows[0],
    (await client.query('SELECT * FROM loans WHERE id=$1', [row.loan_id])).rows[0]), ...settlement };
}
export async function cancelRequestedDeliveryAdvance(supplier, requestId, client) {
  const ctx = await lockContext(client, await hintByRequest(client, requestId)); await closedDebt(client, ctx);
  const { row, loan } = ctx;
  if (row.supplier_character !== supplier.id) fail('No advance request of yours.');
  if (row.state === 'cancelled' || row.state === 'closed') return { ok: true, request: view(row, loan) };
  if (row.state !== 'requested') fail('Funded offers use canonical lender cancellation/recovery.');
  await client.query("UPDATE delivery_loan_requests SET state='cancelled' WHERE id=$1", [row.id]); row.state = 'cancelled';
  return { ok: true, request: view(row) };
}
export async function deliveryFinanceBoard(client, accountId) {
  const rows = (await client.query(`SELECT r.* FROM delivery_loan_requests r JOIN characters s ON s.id=r.supplier_character
    JOIN characters o ON o.id=r.requested_lender_character LEFT JOIN loans l ON l.id=r.loan_id
    LEFT JOIN characters c ON c.id=l.lender_character WHERE s.account_id=$1 OR o.account_id=$1 OR c.account_id=$1
    ORDER BY r.created_at DESC,r.id LIMIT 100`, [accountId])).rows;
  const result = [];
  for (const row of rows) {
    const loan = row.loan_id ? (await client.query('SELECT * FROM loans WHERE id=$1', [row.loan_id])).rows[0] : null;
    result.push(view(row, loan));
  }
  return result;
}
export async function assertDeliveryFinanceLoanTake(client, ch, loanId) {
  const row = (await client.query('SELECT * FROM delivery_loan_requests WHERE loan_id=$1', [loanId])).rows[0];
  if (!row) return;
  const loan = (await client.query('SELECT * FROM loans WHERE id=$1', [loanId])).rows[0];
  if (!loan || !['open','active'].includes(loan.status)) {
    if (['offered','active'].includes(row.state)) await client.query("UPDATE delivery_loan_requests SET state='closed' WHERE id=$1", [row.id]);
    return;
  }
  if (!can(client, 'take', row, ch)) fail('Accept this bound offer through its fully validated delivery advance.');
}
export async function assertDeliveryFinanceDelivery(client, ch, commitmentId) {
  const row = (await client.query("SELECT * FROM delivery_loan_requests WHERE commitment_id=$1 AND state='active'", [commitmentId])).rows[0];
  if (!row) return;
  const loan = (await client.query('SELECT * FROM loans WHERE id=$1', [row.loan_id])).rows[0];
  if (!loan || loan.status !== 'active') { await client.query("UPDATE delivery_loan_requests SET state='closed' WHERE id=$1", [row.id]); return; }
  if (!can(client, 'settle', row, ch)) fail('Deliver this active financed commitment through its atomic full settlement.');
}
