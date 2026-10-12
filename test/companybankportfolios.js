import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as Portfolio from '../src/companybankportfolios.js';
import { runCompanyBankPortfolioInvariants } from '../src/companybankportfolioinvariants.js';
import * as Loans from '../src/loans.js';
import * as G from '../src/game.js';
import Fastify from 'fastify';
import { register } from '../src/routes/companybankportfolios.js';

assert(!process.env.DATABASE_URL, 'Refuse ambient database endpoints');
const native = process.argv.includes('--postgres'); let pool;
if (native) {
  const url = new URL(process.env.COMPANY_BANK_PORTFOLIO_TEST_DATABASE_URL || 'http://missing');
  assert.equal(url.protocol, 'postgresql:'); assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '35439'); assert.equal(url.username, 'pilot_runner'); assert.equal(url.password, '');
  assert(/^\/company_bank_portfolio_[a-z0-9_]+$/.test(url.pathname)); assert(!url.search && !url.hash);
  const { default: pg } = await import('pg'); pool = new pg.Pool({ connectionString: url.href });
  const c = await pool.connect(); await c.query('BEGIN READ ONLY'); assert.equal((await c.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length, 0);
  console.log((await c.query('SELECT version(),current_user,current_database()')).rows[0]); assert.match((await c.query('SELECT version()')).rows[0].version, /PostgreSQL 18\.4/);
  await c.query('ROLLBACK'); c.release();
} else {
  const { newDb, DataType } = await import('pg-mem'); const { registerPgMemCompatibility } = await import('../src/db.js');
  const mem = newDb(); registerPgMemCompatibility(mem, DataType); pool = new (mem.adapters.createPg().Pool)();
}
await pool.query(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
const blank = async () => {}, helper = () => ({ ledger: G.ledger, notify: blank, track: blank, owned: { cars: [], cargo: {}, skills: new Set() }, acct: { omr: 0 }, theirAcct: { omr: 0 }, theirOwned: { cars: [] } });
let serial = 0;
async function fixture(cash = 30000) {
  const prefix = `bank${++serial}`, actors = [];
  for (let n = 0; n < 4; n++) {
    const account = `${prefix}_a${n}`, id = `${prefix}_c${n}`;
    await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'guest',$1)", [account]);
    await pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [account]);
    await pool.query('INSERT INTO characters(id,account_id,name,season,cash) VALUES($1,$2,$1,1,$3)', [id, account, cash]);
    actors.push((await pool.query('SELECT * FROM characters WHERE id=$1', [id])).rows[0]);
  }
  const [owner, borrower, other, foreign] = actors;
  await pool.query("INSERT INTO agent_company_profiles(account_id,revision,name,published) VALUES($1,1,'Company Cash Book',false)", [owner.account_id]);
  const terms = { expectedRevision: 0, enabled: true, consent: true, borrowerIds: [borrower.id, other.id], principal: 5000, rateBps: 500, termHours: 1, cashReserve: 1000, maxExposure: 10000, lifetimeBudget: 10000, expiresInSeconds: 3600 };
  return { prefix, owner, borrower, other, foreign, terms };
}
async function tx(actor, fn, peers = []) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const id of [...new Set([actor.id, ...peers.map(p => p.id)])].sort()) await client.query('SELECT id FROM characters WHERE id=$1 FOR UPDATE', [id]);
    const fresh = (await client.query('SELECT * FROM characters WHERE id=$1', [actor.id])).rows[0];
    await client.query('SELECT account_id FROM account_persistent WHERE account_id=$1 FOR UPDATE', [actor.account_id]);
    const others = [];
    for (const peer of peers) others.push((await client.query('SELECT * FROM characters WHERE id=$1', [peer.id])).rows[0]);
    const result = await fn(fresh, client, helper(), others);
    for (const ch of [fresh, ...others]) await client.query('UPDATE characters SET cash=$2,bank=$3,welsher=$4,hosp_until=$5,wanted_until=$6 WHERE id=$1', [ch.id, ch.cash, ch.bank, ch.welsher, ch.hosp_until, ch.wanted_until]);
    await client.query('COMMIT'); return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
const grant = (f, terms = f.terms, key = 'policy') => tx(f.owner, (ch, c) => Portfolio.setCompanyBankPortfolioPolicy(ch, terms, key, c, { ownerSession: true }));
const run = (f, key = 'run', rev = 1) => tx(f.owner, (ch, c, h) => Portfolio.runCompanyBankPortfolio(ch, { expectedRevision: rev }, key, c, h));
const cash = async ch => Number((await pool.query('SELECT cash FROM characters WHERE id=$1', [ch.id])).rows[0].cash);
const count = async table => Number((await pool.query(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0].n);
const due = f => pool.query('UPDATE company_bank_portfolios SET next_run_at=clock_timestamp() WHERE account_id=$1', [f.owner.account_id]);
try {
  const f = await fixture();
  await assert.rejects(tx(f.owner, (ch, c) => Portfolio.setCompanyBankPortfolioPolicy(ch, f.terms, 'untrusted', c)), e => e.reason === 'owner_authority');
  const policy = await grant(f); assert.equal(policy.policy.revision, 1); assert.equal((await grant(f)).replayed, true);
  const first = await run(f); assert.equal(first.funded, 5000); assert.equal(first.borrowerId, f.borrower.id); assert.equal(await cash(f.owner), 25000);
  const rows = await count('transactions'); assert.equal((await run(f)).replayed, true); assert.equal(await count('transactions'), rows); assert.equal(await cash(f.owner), 25000);
  await assert.rejects(run(f, 'run', 2), e => e.reason === 'request_conflict');
  await assert.rejects(run(f, 'fast'), e => e.reason === 'cadence');
  await tx(f.borrower, (ch, c, h) => Loans.takeLoan(ch, first.loanId, null, c, h));
  const board = await Portfolio.companyBankPortfolioBoard(pool, f.owner.account_id);
  assert.equal(board.companyName, 'Company Cash Book'); assert.equal(board.exposure.activePrincipal, 5000); assert.equal(board.loans[0].canonicalStatus, 'active');
  await due(f); const second = await run(f, 'second'); assert.equal(second.borrowerId, f.other.id); assert.equal(second.funded, 5000);
  await tx(f.owner, (ch, c, h) => Loans.cancelLoan(ch, second.loanId, c, h));
  await tx(f.borrower, (ch, c, h, peers) => Loans.repayLoan(ch, peers[0], first.loanId, c, h), [f.owner]);
  await due(f); await assert.rejects(run(f, 'budget'), e => e.reason === 'lifetime_budget');
  assert.equal((await Portfolio.companyBankPortfolioBoard(pool, f.owner.account_id)).policy.lifetimeSpent, 10000);
  await assert.rejects(grant(f, { ...f.terms, expectedRevision: 1, lifetimeBudget: 5000 }, 'reset'), e => e.reason === 'committed_exposure');
  const reserve = await fixture(5999); await grant(reserve);
  await assert.rejects(run(reserve), e => e.reason === 'reserve'); assert.equal(await cash(reserve.owner), 5999);
  const debtReserve = await fixture(5999);
  const debtOffer = await tx(debtReserve.foreign, (ch, c, h) => Loans.offerLoan(ch, { amount: 5000, rate: 0.05, hours: 1, to: debtReserve.owner.id }, c, h));
  await tx(debtReserve.owner, (ch, c, h) => Loans.takeLoan(ch, debtOffer.id, null, c, h)); await grant(debtReserve);
  await assert.rejects(run(debtReserve), e => e.reason === 'reserve'); assert.equal(await cash(debtReserve.owner), 10999, 'Borrowed game cash cannot evade committed debt reserve');
  const existing = await fixture();
  const manual = await tx(existing.owner, (ch, c, h) => Loans.offerLoan(ch, { amount: 5000, rate: 0.05, hours: 1, to: existing.borrower.id }, c, h));
  const foreign = await tx(existing.foreign, (ch, c, h) => Loans.offerLoan(ch, { amount: 5000, rate: 0.05, hours: 1, to: existing.owner.id }, c, h));
  await tx(existing.owner, (ch, c, h) => Loans.takeLoan(ch, foreign.id, null, c, h));
  await grant(existing);
  const owned = await Portfolio.companyBankPortfolioBoard(pool, existing.owner.account_id);
  assert.equal(owned.exposure.openEscrow, 5000); assert.equal(owned.exposure.borrowerDebt, 5250); assert(owned.loans.some(l => l.loanId === manual.id)); assert(!owned.loans.some(l => l.loanId === foreign.id));
  assert.equal((await run(existing)).borrowerId, existing.other.id, 'Existing directed escrow prevents duplicate financing of borrower');
  await assert.rejects(tx(existing.owner, (ch, c, h) => Portfolio.runCompanyBankPortfolio(ch, { expectedRevision: 1, loanId: foreign.id }, 'bindforeign', c, h)), e => e.reason === 'terms');
  await due(existing); await assert.rejects(run(existing, 'alreadyexposed'), e => e.reason === 'exposure');
  const automatic = await fixture(); await grant(automatic);
  assert.equal((await tx(automatic.owner, (ch, c, h) => Portfolio.runCompanyBankPortfolioDue(ch, c, h))).funded, 5000);
  await assert.rejects(Portfolio.companyBankPortfolioDueCandidates(pool, 101), e => e.reason === 'terms');
  const defaulted = await fixture(); await grant(defaulted); const bad = await run(defaulted);
  await tx(defaulted.borrower, (ch, c, h) => Loans.takeLoan(ch, bad.loanId, null, c, h));
  await pool.query('UPDATE loans SET due_at=$2 WHERE id=$1', [bad.loanId, new Date(Date.now() - 1000)]);
  await pool.query('UPDATE characters SET cash=0 WHERE id=$1', [defaulted.borrower.id]);
  const collected = await tx(defaulted.owner, (ch, c, h, peers) => Loans.collectLoan(ch, peers[0], bad.loanId, c, h), [defaulted.borrower]);
  assert.equal(collected.seized, 0); assert.equal((await Portfolio.companyBankPortfolioBoard(pool, defaulted.owner.account_id)).loans[0].canonicalStatus, 'collected');
  await due(defaulted); assert.equal((await run(defaulted, 'afterdefault')).borrowerId, defaulted.other.id);
  const death = await fixture(); await grant(death); const inherited = await run(death);
  await tx(death.borrower, (ch, c, h) => Loans.takeLoan(ch, inherited.loanId, null, c, h));
  const heir = { ...death.owner, id: `${death.prefix}_heir`, generation: 2 };
  await tx(death.owner, async (ch, c, h) => { await Loans.voidLoansAtDeath(c, ch.id, h, null, 0, heir.id); await Portfolio.closeCompanyBankPortfoliosAtDeath(c, ch.id); await c.query('UPDATE characters SET alive=false WHERE id=$1', [ch.id]); await c.query('INSERT INTO characters(id,account_id,name,season,generation,cash) VALUES($1,$2,$1,1,2,30000)', [heir.id, heir.account_id]); });
  assert.equal((await pool.query('SELECT lender_character FROM loans WHERE id=$1', [inherited.loanId])).rows[0].lender_character, heir.id);
  assert.equal((await tx(heir, (ch, c, h) => Portfolio.runCompanyBankPortfolio(ch, { expectedRevision: 1 }, 'run', c, h))).replayed, true);
  await assert.rejects(tx(heir, (ch, c, h) => Portfolio.runCompanyBankPortfolio(ch, { expectedRevision: 1 }, 'newkey', c, h)), e => e.reason === 'consent');
  const heirBoard = await Portfolio.companyBankPortfolioBoard(pool, heir.account_id); assert.equal(heirBoard.loans[0].loanId, inherited.loanId); assert.equal(heirBoard.loans[0].currentLenderId, heir.id); assert.equal(heirBoard.exposure.activePrincipal, 5000);
  await tx(heir, (ch, c) => Portfolio.setCompanyBankPortfolioPolicy(ch, { ...death.terms, expectedRevision: 1 }, 'heirconsent', c, { ownerSession: true }));
  assert.equal((await Portfolio.companyBankPortfolioBoard(pool, heir.account_id)).policy.lifetimeSpent, 5000);
  const http = await fixture();
  // Test real route/domain wrappers with a bounded test-auth adapter. Shared JWT wiring is coordinator scope.
  const app = Fastify();
  const auth = async (req, reply) => {
    const match = /^Bearer (human|agent):([A-Za-z0-9_-]+)$/.exec(req.headers.authorization || '');
    if (!match) return reply.code(401).send({ error: 'auth' }); req.user = { sub: match[2], agent: match[1] === 'agent' };
  };
  app.setErrorHandler((error, req, reply) => reply.code(error.code === 'owner_authority' ? 403 : 400).send({ code: error.code, reason: error.reason, message: error.message }));
  register(app, { pool, auth });
  const humanHeaders = { authorization: `Bearer human:${http.owner.account_id}`, 'idempotency-key': 'httpgrant' }, agentHeaders = { authorization: `Bearer agent:${http.owner.account_id}`, 'idempotency-key': 'httprun' };
  assert.equal((await app.inject({ method: 'GET', url: '/v1/company/bank' })).statusCode, 401);
  assert.equal((await app.inject({ method: 'POST', url: '/v1/company/bank/policy', headers: agentHeaders, payload: http.terms })).statusCode, 403);
  const httpGrant = await app.inject({ method: 'POST', url: '/v1/company/bank/policy', headers: humanHeaders, payload: http.terms }); assert.equal(httpGrant.statusCode, 200, httpGrant.body);
  const httpRun = await app.inject({ method: 'POST', url: '/v1/company/bank/run', headers: agentHeaders, payload: { expectedRevision: 1 } }); assert.equal(httpRun.statusCode, 200, httpRun.body); assert.equal(httpRun.json().funded, 5000);
  const httpReplay = await app.inject({ method: 'POST', url: '/v1/company/bank/run', headers: { ...humanHeaders, 'idempotency-key': 'httprun' }, payload: { expectedRevision: 1 } }); assert.equal(httpReplay.statusCode, 200, httpReplay.body); assert.equal(httpReplay.json().replayed, true);
  const httpBoard = await app.inject({ method: 'GET', url: '/v1/company/bank', headers: agentHeaders }); assert.equal(httpBoard.statusCode, 200, httpBoard.body); assert.equal(httpBoard.json().exposure.openEscrow, 5000);
  await app.close();
  if (native) {
    const boundary = await fixture(); await grant(boundary, { ...boundary.terms, lifetimeBudget: 5000 });
    const raced = await Promise.allSettled([run(boundary, 'firstbudget'), run(boundary, 'secondbudget')]);
    assert.equal(raced.filter(r => r.status === 'fulfilled' && r.value.funded === 5000).length, 1);
    assert.equal(raced.filter(r => r.status === 'rejected' && ['cadence', 'lifetime_budget'].includes(r.reason.reason)).length, 1);
    assert.equal(await cash(boundary.owner), 25000); assert.equal((await Portfolio.companyBankPortfolioBoard(pool, boundary.owner.account_id)).policy.lifetimeSpent, 5000);
    const concurrent = await fixture(); await grant(concurrent);
    const [a, b] = await Promise.all([run(concurrent, 'same'), run(concurrent, 'same')]); assert.equal(a.loanId, b.loanId); assert.equal([a, b].filter(r => r.replayed).length, 1); assert.equal(await cash(concurrent.owner), 25000);
    await due(concurrent); await pool.query('UPDATE company_bank_portfolios SET terms=$2 WHERE account_id=$1', [concurrent.owner.account_id, { ...concurrent.terms, lifetimeBudget: 5000 }]);
    const budgets = await Promise.allSettled([run(concurrent, 'budgeta'), run(concurrent, 'budgetb')]); assert(budgets.every(r => r.status === 'rejected' && r.reason.reason === 'lifetime_budget')); assert.equal(await cash(concurrent.owner), 25000);
    const rollback = await fixture(); await grant(rollback); const beforeLoans = await count('loans'), beforeReceipts = await count('company_bank_portfolio_receipts'), beforeLedger = await count('transactions');
    await assert.rejects(tx(rollback.owner, async (ch, c, h) => { await Portfolio.runCompanyBankPortfolio(ch, { expectedRevision: 1 }, 'rolledback', c, h); throw new Error('forced rollback'); }), /forced rollback/);
    assert.equal(await cash(rollback.owner), 30000); assert.equal(await count('loans'), beforeLoans); assert.equal(await count('company_bank_portfolio_receipts'), beforeReceipts); assert.equal(await count('transactions'), beforeLedger);
    const delayed = await fixture(); const oldLoan = await tx(delayed.owner, (ch, c, h) => Loans.offerLoan(ch, { amount: 5000, rate: 0.05, hours: 1, to: delayed.borrower.id }, c, h)); await grant(delayed);
    const blocker = await pool.connect(); await blocker.query('BEGIN'); await blocker.query('SELECT id FROM loans WHERE id=$1 FOR UPDATE', [oldLoan.id]);
    const waiting = run(delayed, 'waiting'); await pool.query('UPDATE company_bank_portfolios SET expires_at=clock_timestamp() WHERE account_id=$1', [delayed.owner.account_id]);
    await blocker.query('COMMIT'); blocker.release(); await assert.rejects(waiting, e => e.reason === 'expired'); assert.equal(await cash(delayed.owner), 25000);
  }
  assert.equal((await runCompanyBankPortfolioInvariants(pool)).ok, true);
  let seed = 1947;
  for (let n = 0; n < 300; n++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const rateBps = seed % 5000 + 1; assert.equal(Portfolio.companyBankPortfolioPolicyTerms({ ...f.terms, rateBps }).rateBps, rateBps); assert.throws(() => Portfolio.companyBankPortfolioPolicyTerms({ ...f.terms, rateBps: rateBps + 5000 })); }
  for (const change of [{ consent: false }, { borrowerIds: [f.borrower.id, f.borrower.id] }, { principal: 4999 }, { principal: 100001 }, { url: 'https://example.com' }, { termHours: 73 }, { rateBps: '500' }]) assert.throws(() => Portfolio.companyBankPortfolioPolicyTerms({ ...f.terms, ...change }));
  console.log(`companybankportfolios: PASS ${native ? 'PostgreSQL18.4 concurrency/budget/rollback/source-lock-expiry' : 'memory'}; canonical offer/take/repay/cancel/default/death; sticky budget; escrow+debt reserves; foreign-source exclusion; heir authority/replay; seed1947 300 bounds`);
} finally { await pool.end(); }
