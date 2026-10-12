import crypto from 'node:crypto';
import { GameError } from './game.js';
import { LOAN, loanOwed, jailed, safeHoused } from './rules.js';
import * as Loans from './loans.js';

// Company branding and bounded consent around canonical game-cash loan escrow/debt.
// No customer deposits, monetary bucket, guarantee or external financial rail.
export const COMPANY_BANK_PORTFOLIO = Object.freeze({ maxBorrowers: 3, maxContexts: 64, maxPrincipal: 100000, maxExposure: 300000, maxLifetimeBudget: 1000000, cadenceSeconds: 60 });
const fail = reason => { const error = new GameError('company_bank_portfolio', `Company game-cash portfolio refused: ${reason}.`); error.reason = reason; throw error; };
const id = value => { if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) fail('terms'); return value; };
const integer = (value, min, max) => { if (!Number.isSafeInteger(value) || value < min || value > max) fail('terms'); return value; };
const exact = (body, fields) => { if (!body || Array.isArray(body) || typeof body !== 'object' || Object.keys(body).sort().join(',') !== fields.sort().join(',')) fail('terms'); };
const stable = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const time = value => { if (value === null || value === undefined) fail('clock'); const ms = new Date(value).getTime(); if (!Number.isFinite(ms)) fail('clock'); return ms; };
const actor = ch => { if (!ch?.alive || ch.is_npc) fail('actor'); return id(ch.account_id); };
const requestKey = key => { if (typeof key !== 'string' || !/^[\x21-\x7e]{1,200}$/.test(key)) fail('terms'); return key; };
export function companyBankPortfolioPolicyTerms(body) {
  if (body?.enabled === false) {
    exact(body, ['expectedRevision', 'enabled']);
    return { expectedRevision: integer(body.expectedRevision, 1, 2147483646), enabled: false };
  }
  exact(body, ['expectedRevision', 'enabled', 'consent', 'borrowerIds', 'principal', 'rateBps', 'termHours', 'cashReserve', 'maxExposure', 'lifetimeBudget', 'expiresInSeconds']);
  if (body.enabled !== true || body.consent !== true || !Array.isArray(body.borrowerIds) || body.borrowerIds.length < 1 || body.borrowerIds.length > 3) fail('consent');
  const borrowerIds = body.borrowerIds.map(id);
  if (new Set(borrowerIds).size !== borrowerIds.length) fail('terms');
  const principal = integer(body.principal, LOAN.MIN, Math.min(LOAN.MAX, 100000));
  return { expectedRevision: integer(body.expectedRevision, 0, 2147483646), enabled: true, consent: true, borrowerIds,
    principal, rateBps: integer(body.rateBps, 1, Math.floor(LOAN.RATE_MAX * 10000)), termHours: integer(body.termHours, LOAN.TERM_MIN_H, LOAN.TERM_MAX_H),
    cashReserve: integer(body.cashReserve, 1000, 10000000), maxExposure: integer(body.maxExposure, principal, 300000),
    lifetimeBudget: integer(body.lifetimeBudget, principal, 1000000), expiresInSeconds: integer(body.expiresInSeconds, 60, 604800) };
}
async function replay(client, account, key, identity) {
  const row = (await client.query('SELECT identity,receipt FROM company_bank_portfolio_receipts WHERE account_id=$1 AND request_key=$2', [account, key])).rows[0];
  if (!row) return null; if (stable(row.identity) !== stable(identity)) fail('request_conflict');
  return { ...row.receipt, replayed: true };
}
async function receipt(client, account, key, identity, value) {
  await client.query('INSERT INTO company_bank_portfolio_receipts(account_id,request_key,identity,receipt) VALUES($1,$2,$3,$4)', [account, key, identity, value]);
  return value;
}
async function relatedLoans(client, account, lock = false) {
  const rows = (await client.query("SELECT l.* FROM loans l LEFT JOIN characters lender ON lender.id=l.lender_character LEFT JOIN characters borrower ON borrower.id=l.borrower_character WHERE (lender.account_id=$1 OR borrower.account_id=$1) AND l.status IN ('open','active') ORDER BY l.id LIMIT 65", [account])).rows;
  if (rows.length > 64) fail('context_limit');
  if (!lock) return rows;
  const locked = [];
  for (const row of rows) {
    const fresh = (await client.query('SELECT * FROM loans WHERE id=$1 FOR UPDATE', [row.id])).rows[0];
    if (fresh) locked.push(fresh);
  }
  // Reclassify ownership/status only after canonical row locks have settled.
  const characters = (await client.query('SELECT id FROM characters WHERE account_id=$1', [account])).rows.map(c => c.id);
  return locked.filter(l => ['open', 'active'].includes(l.status) && (characters.includes(l.lender_character) || characters.includes(l.borrower_character)));
}
async function exposure(client, account, loans) {
  const ids = new Set((await client.query('SELECT id FROM characters WHERE account_id=$1', [account])).rows.map(c => c.id));
  let openEscrow = 0, activePrincipal = 0, borrowerDebt = 0;
  for (const loan of loans) {
    const principal = Number(loan.principal);
    if (!Number.isSafeInteger(principal) || principal <= 0) fail('source_amount');
    if (ids.has(loan.lender_character)) {
      if (loan.status === 'open') openEscrow += principal;
      else if (loan.status === 'active') activePrincipal += principal;
    }
    if (ids.has(loan.borrower_character) && loan.status === 'active') borrowerDebt += loanOwed(principal, Number(loan.rate));
  }
  const totalPrincipal = openEscrow + activePrincipal;
  if (![openEscrow, activePrincipal, borrowerDebt, totalPrincipal].every(Number.isSafeInteger)) fail('source_amount');
  return { openEscrow, activePrincipal, totalPrincipal, borrowerDebt };
}
async function observe(client, account, loans) {
  const ownerIds = new Set((await client.query('SELECT id FROM characters WHERE account_id=$1', [account])).rows.map(c => c.id));
  for (const loan of loans.filter(l => ownerIds.has(l.lender_character))) {
    if ((await client.query('SELECT loan_id FROM company_bank_portfolio_loans WHERE account_id=$1 AND loan_id=$2', [account, loan.id])).rows.length) continue;
    const advance = (await client.query('SELECT id FROM delivery_loan_requests WHERE loan_id=$1', [loan.id])).rows[0];
    await client.query('INSERT INTO company_bank_portfolio_loans(account_id,loan_id,original_lender,principal,origin,finance_request_id) VALUES($1,$2,$3,$4,$5,$6)', [account, loan.id, loan.lender_character, Number(loan.principal), 'existing', advance?.id || null]);
  }
}
function policyView(row) {
  return { accountId: row.account_id, ownerCharacterId: row.owner_character, enabled: row.enabled, revision: row.revision, terms: row.terms,
    lifetimeSpent: Number(row.lifetime_spent), expiresAt: new Date(row.expires_at).toISOString(), nextRunAt: new Date(row.next_run_at).toISOString(), currency: 'game_cash' };
}
// ownerSession is trusted route/operator context, never accepted from JSON request terms.
export async function setCompanyBankPortfolioPolicy(ch, body, key, client, { ownerSession = false } = {}) {
  if (ownerSession !== true) fail('owner_authority');
  const account = actor(ch), terms = companyBankPortfolioPolicyTerms(body), identity = { action: 'policy', terms }; requestKey(key);
  const saved = await replay(client, account, key, identity); if (saved) return saved;
  if (!(await client.query('SELECT account_id FROM agent_company_profiles WHERE account_id=$1', [account])).rows.length) fail('company');
  const loans = await relatedLoans(client, account, true);
  const row = (await client.query('SELECT * FROM company_bank_portfolios WHERE account_id=$1 FOR UPDATE', [account])).rows[0];
  if (Number(row?.revision || 0) !== terms.expectedRevision) fail('revision');
  const now = (await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
  if (!terms.enabled) {
    await client.query('UPDATE company_bank_portfolios SET enabled=false,revision=$2 WHERE account_id=$1', [account, terms.expectedRevision + 1]);
    return receipt(client, account, key, identity, { ok: true, policy: policyView({ ...row, enabled: false, revision: terms.expectedRevision + 1 }), funded: 0 });
  }
  for (const borrowerId of terms.borrowerIds) {
    const borrower = (await client.query('SELECT id,account_id,alive,is_npc FROM characters WHERE id=$1', [borrowerId])).rows[0];
    if (!borrower?.alive || borrower.is_npc || borrower.account_id === account) fail('borrower');
  }
  const risk = await exposure(client, account, loans), spent = Number(row?.lifetime_spent || 0);
  if (risk.totalPrincipal > terms.maxExposure || spent > terms.lifetimeBudget) fail('committed_exposure');
  const next = { account_id: account, owner_character: ch.id, enabled: true, revision: terms.expectedRevision + 1, terms, lifetime_spent: spent, expires_at: new Date(time(now) + terms.expiresInSeconds * 1000), next_run_at: now };
  if (row) await client.query('UPDATE company_bank_portfolios SET owner_character=$2,enabled=true,revision=$3,terms=$4,expires_at=$5,next_run_at=$6 WHERE account_id=$1', [account, ch.id, next.revision, terms, next.expires_at, now]);
  else await client.query('INSERT INTO company_bank_portfolios(account_id,owner_character,revision,terms,expires_at,next_run_at) VALUES($1,$2,$3,$4,$5,$6)', [account, ch.id, next.revision, terms, next.expires_at, now]);
  await observe(client, account, loans);
  return receipt(client, account, key, identity, { ok: true, policy: policyView(next), exposure: risk, funded: 0 });
}
export async function runCompanyBankPortfolio(ch, body, key, client, h) {
  const account = actor(ch); exact(body, ['expectedRevision']);
  const terms = { expectedRevision: integer(body.expectedRevision, 1, 2147483646) }, identity = { action: 'run', terms }; requestKey(key);
  const saved = await replay(client, account, key, identity); if (saved) return saved;
  const loans = await relatedLoans(client, account, true);
  const row = (await client.query('SELECT * FROM company_bank_portfolios WHERE account_id=$1 FOR UPDATE', [account])).rows[0];
  if (!row || row.owner_character !== ch.id || !row.enabled) fail('consent');
  if (row.revision !== terms.expectedRevision) fail('revision');
  const now = (await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
  if (time(now) >= time(row.expires_at)) fail('expired');
  if (time(now) < time(row.next_run_at)) fail('cadence');
  if (jailed(ch) || safeHoused(ch)) fail('status');
  const policy = companyBankPortfolioPolicyTerms(row.terms), risk = await exposure(client, account, loans), principal = policy.principal;
  const cash = Number(ch.cash), spent = Number(row.lifetime_spent);
  if (!Number.isFinite(cash) || cash < 0 || cash > Number.MAX_SAFE_INTEGER || !Number.isSafeInteger(spent) || cash - principal < policy.cashReserve + risk.borrowerDebt) fail('reserve');
  if (risk.totalPrincipal + principal > policy.maxExposure) fail('exposure');
  if (spent + principal > policy.lifetimeBudget) fail('lifetime_budget');
  let target = null;
  for (const borrowerId of policy.borrowerIds) {
    const borrower = (await client.query('SELECT * FROM characters WHERE id=$1', [borrowerId])).rows[0];
    if (!borrower?.alive || borrower.is_npc || borrower.account_id === account || borrower.welsher || jailed(borrower)) continue;
    const active = (await client.query("SELECT id FROM loans WHERE borrower_character=$1 AND status='active' LIMIT 2", [borrowerId])).rows.length;
    if (active >= LOAN.MAX_ACTIVE || loans.some(l => (l.offered_to === borrowerId && l.status === 'open') || (l.borrower_character === borrowerId && l.status === 'active'))) continue;
    target = borrower; break;
  }
  if (!target) return receipt(client, account, key, identity, { ok: true, idle: true, reason: 'no_current_eligible_directed_borrower', funded: 0, exposure: risk });
  await observe(client, account, loans);
  const canonical = await Loans.offerLoan(ch, { amount: principal, rate: policy.rateBps / 10000, hours: policy.termHours, to: target.id, collateral: 0, collateralOmr: 0 }, client, h);
  const loan = (await client.query('SELECT * FROM loans WHERE id=$1', [canonical.id])).rows[0];
  if (!loan || loan.lender_character !== ch.id || loan.offered_to !== target.id || loan.status !== 'open' || Number(loan.principal) !== principal) fail('canonical_offer');
  await client.query("INSERT INTO company_bank_portfolio_loans(account_id,loan_id,original_lender,principal,origin) VALUES($1,$2,$3,$4,'portfolio')", [account, canonical.id, ch.id, principal]);
  await client.query('UPDATE company_bank_portfolios SET lifetime_spent=$2,next_run_at=$3 WHERE account_id=$1', [account, spent + principal, new Date(time(now) + 60000)]);
  return receipt(client, account, key, identity, { ok: true, funded: principal, loanId: canonical.id, borrowerId: target.id, canonical, lifetimeSpent: spent + principal,
    exposure: { ...risk, openEscrow: risk.openEscrow + principal, totalPrincipal: risk.totalPrincipal + principal }, currency: 'game_cash' });
}
export async function companyBankPortfolioBoard(client, account) {
  id(account);
  const row = (await client.query('SELECT * FROM company_bank_portfolios WHERE account_id=$1', [account])).rows[0];
  const company = (await client.query('SELECT name FROM agent_company_profiles WHERE account_id=$1', [account])).rows[0];
  const current = await relatedLoans(client, account), risk = await exposure(client, account, current);
  const owners = new Set((await client.query('SELECT id FROM characters WHERE account_id=$1', [account])).rows.map(c => c.id));
  const history = (await client.query('SELECT * FROM company_bank_portfolio_loans WHERE account_id=$1 ORDER BY created_at DESC,loan_id LIMIT 100', [account])).rows;
  const loans = [];
  for (const binding of history) {
    const source = (await client.query('SELECT * FROM loans WHERE id=$1', [binding.loan_id])).rows[0];
    loans.push({ loanId: binding.loan_id, origin: binding.origin, financeRequestId: binding.finance_request_id, originalLenderId: binding.original_lender, principal: Number(binding.principal),
      canonicalStatus: source?.status || 'missing', currentAccountOwned: !!source && owners.has(source.lender_character), currentLenderId: source?.lender_character || null,
      borrowerId: source?.borrower_character || source?.offered_to || null, dueAt: source?.due_at ? new Date(source.due_at).toISOString() : null });
  }
  return { companyName: company?.name || null, policy: row ? policyView(row) : null, exposure: risk, loans, currentLoans: current.map(l => ({ id: l.id, lenderId: l.lender_character, borrowerId: l.borrower_character || l.offered_to, principal: Number(l.principal), status: l.status })),
    currency: 'game_cash', estimates: 'Principal exposure and existing repayment terms are descriptive; they do not guarantee creditworthiness, recovery or profit.' };
}
export async function companyBankPortfolioDueCandidates(client, limit = 20) {
  integer(limit, 1, 100);
  return (await client.query('SELECT account_id,owner_character,revision,next_run_at FROM company_bank_portfolios WHERE enabled=true AND expires_at>clock_timestamp() AND next_run_at<=clock_timestamp() ORDER BY next_run_at,account_id LIMIT $1', [limit])).rows;
}
export async function runCompanyBankPortfolioDue(ch, client, h) {
  const account = actor(ch);
  const row = (await client.query('SELECT revision,next_run_at FROM company_bank_portfolios WHERE account_id=$1', [account])).rows[0];
  if (!row) return { ok: true, idle: true, funded: 0 };
  const key = `bank:auto:${crypto.createHash('sha256').update(stable({ account, revision: row.revision, nextRunAt: new Date(row.next_run_at).toISOString() })).digest('hex')}`;
  return runCompanyBankPortfolio(ch, { expectedRevision: row.revision }, key, client, h);
}
export async function closeCompanyBankPortfoliosAtDeath(client, characterId) {
  await client.query('UPDATE company_bank_portfolios SET enabled=false WHERE owner_character=$1 AND enabled=true', [id(characterId)]);
}
