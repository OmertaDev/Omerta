import crypto from 'node:crypto';
import { GameError } from './game.js';
import { guardDelegatedControl } from './operatingpolicy.js';

const fail = reason => { throw new GameError('game_employment', reason); };
const id = value => { if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) fail('terms'); return value; };
const person = ch => { if (!ch?.alive || ch.is_npc || !ch.account_id) fail('party'); };
const clock = async client => +new Date((await client.query('SELECT clock_timestamp() AS at')).rows[0].at);
export function employmentTerms(body) {
  if (!body || Object.keys(body).sort().join(',') !== 'acceptAgents,acceptHumans,depotId,expiresAt,slots,wageCash'
      || typeof body.acceptAgents !== 'boolean' || typeof body.acceptHumans !== 'boolean'
      || !(body.acceptAgents || body.acceptHumans) || !Number.isSafeInteger(body.slots) || body.slots < 1 || body.slots > 5
      || !Number.isSafeInteger(body.wageCash) || body.wageCash < 1 || body.wageCash > 100000
      || typeof body.expiresAt !== 'string' || !Number.isFinite(Date.parse(body.expiresAt))
      || new Date(body.expiresAt).toISOString() !== body.expiresAt) fail('terms');
  return { depotId: id(body.depotId), slots: body.slots, wageCash: body.wageCash,
    acceptHumans: body.acceptHumans, acceptAgents: body.acceptAgents, expiresAt: body.expiresAt };
}
async function money(ch, amount, client, h, reason) {
  const next = Number(ch.cash) + amount;
  if (!Number.isFinite(next) || next < 0 || next > Number.MAX_SAFE_INTEGER) fail('cash');
  await h.ledger(client, { characterId: ch.id, currency: 'cash', amount, reason }); ch.cash = next;
}
async function replay(ch, action, key, terms, client) {
  if (typeof key !== 'string' || !key.length || key.length > 200) fail('request_key');
  const row = (await client.query('SELECT * FROM game_employment_requests WHERE account_id=$1 AND action=$2 AND request_key=$3', [ch.account_id, action, key])).rows[0];
  if (!row) return null;
  const canonical = value => JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))));
  if (canonical(row.terms) !== canonical(terms)) fail('request_conflict');
  return { ...row.receipt, replayed: true };
}
async function receipt(ch, action, key, terms, result, client) {
  await client.query('INSERT INTO game_employment_requests(account_id,action,request_key,terms,receipt) VALUES($1,$2,$3,$4,$5)', [ch.account_id, action, key, terms, result]); return result;
}
// Caller owns canonical sorted character/account locks. Leaves: depot -> order ->
// delivery commitment -> employment -> assignment. No helper locks characters.
async function locked(client, employmentId, commitmentId = null) {
  const hint = (await client.query('SELECT depot_id FROM game_employment_jobs WHERE id=$1', [id(employmentId)])).rows[0];
  if (!hint) fail('job');
  const depot = (await client.query('SELECT * FROM business_depots WHERE id=$1 FOR UPDATE', [hint.depot_id])).rows[0];
  let commitment;
  if (commitmentId) {
    const pre = (await client.query('SELECT order_id FROM delivery_commitments WHERE id=$1', [id(commitmentId)])).rows[0];
    if (!pre) fail('delivery');
    await client.query('SELECT id FROM market_listings WHERE id=$1 FOR UPDATE', [pre.order_id]);
    commitment = (await client.query('SELECT * FROM delivery_commitments WHERE id=$1 FOR UPDATE', [commitmentId])).rows[0];
  }
  const job = (await client.query('SELECT * FROM game_employment_jobs WHERE id=$1 FOR UPDATE', [employmentId])).rows[0];
  if (!job || !depot || job.depot_id !== depot.id) fail('job');
  return { depot, job, commitment };
}
function current(ch, depot, job) {
  person(ch);
  if (ch.id !== job.employer_character || ch.account_id !== job.employer_account
      || depot.owner_character !== ch.id || depot.status !== 'open') fail('employer');
}
export async function createEmployment(ch, body, key, client, h, { agent = false } = {}) {
  const terms = employmentTerms(body), prior = await replay(ch, 'create', key, terms, client); if (prior) return prior;
  person(ch); if (process.env.DEPOT_PILOT !== 'on') fail('disabled');
  await guardDelegatedControl(client, terms.depotId, agent);
  const depot = (await client.query('SELECT * FROM business_depots WHERE id=$1 FOR UPDATE', [terms.depotId])).rows[0];
  const company = (await client.query('SELECT revision FROM agent_company_profiles WHERE account_id=$1', [ch.account_id])).rows[0];
  const now = await clock(client), end = Date.parse(terms.expiresAt);
  if (!company || !depot || depot.owner_character !== ch.id || depot.status !== 'open' || end-now < 60000 || end-now > 21600000) fail('company');
  const active = (await client.query("SELECT id FROM game_employment_jobs WHERE employer_account=$1 AND state='open'", [ch.account_id])).rows;
  if (active.length >= 3) fail('limit');
  const jobId = crypto.randomUUID(), total = terms.slots * terms.wageCash;
  await money(ch, -total, client, h, `employment:reserve:${jobId}`);
  await client.query('INSERT INTO game_employment_jobs(id,depot_id,employer_character,employer_account,terms,total_cash,escrow_cash,expires_at) VALUES($1,$2,$3,$4,$5,$6,$6,$7)', [jobId, depot.id, ch.id, ch.account_id, terms, total, terms.expiresAt]);
  return receipt(ch, 'create', key, terms, { ok: true, employmentId: jobId, reservedCash: total }, client);
}
export async function acceptEmployment(ch, employer, body, key, client, _h, { agent = false } = {}) {
  if (!body || Object.keys(body).sort().join(',') !== 'commitmentId,consent,employmentId' || body.consent !== true) fail('terms');
  const terms = { employmentId: id(body.employmentId), commitmentId: id(body.commitmentId), consent: true, agent };
  const prior = await replay(ch, 'accept', key, terms, client); if (prior) return prior;
  const { depot, job, commitment: c } = await locked(client, terms.employmentId, terms.commitmentId);
  person(ch); current(employer, depot, job); const now = await clock(client);
  if (ch.account_id === employer.account_id || job.state !== 'open' || now >= +new Date(job.expires_at)
      || !(agent ? job.terms.acceptAgents : job.terms.acceptHumans) || !c || c.status !== 'accepted'
      || Number(c.remaining) !== Number(c.quantity) || c.supplier_character !== ch.id || c.buyer_character !== employer.id
      || c.depot_id !== depot.id || +new Date(c.deadline) > +new Date(job.expires_at) || +new Date(c.deadline) <= now) fail('eligibility');
  const count = (await client.query('SELECT id FROM game_employment_assignments WHERE employment_id=$1', [job.id])).rows.length;
  if (count >= job.terms.slots) fail('slots');
  const assignmentId = crypto.randomUUID();
  await client.query('INSERT INTO game_employment_assignments(id,employment_id,commitment_id,worker_character,worker_account,worker_kind) VALUES($1,$2,$3,$4,$5,$6)', [assignmentId, job.id, c.id, ch.id, ch.account_id, agent ? 'agent' : 'human']);
  return receipt(ch, 'accept', key, terms, { ok: true, employmentId: job.id, assignmentId, commitmentId: c.id, wageCash: job.terms.wageCash }, client);
}
export async function claimEmployment(ch, employer, employmentId, commitmentId, key, client, h) {
  const terms = { employmentId: id(employmentId), commitmentId: id(commitmentId) };
  const prior = await replay(ch, 'claim', key, terms, client); if (prior) return prior;
  const { depot, job, commitment: c } = await locked(client, employmentId, commitmentId);
  person(ch); current(employer, depot, job); const now = await clock(client);
  const a = (await client.query('SELECT * FROM game_employment_assignments WHERE employment_id=$1 AND commitment_id=$2 FOR UPDATE', [job.id, c.id])).rows[0];
  if (!a || a.worker_character !== ch.id || a.worker_account !== ch.account_id || a.state !== 'assigned'
      || job.state !== 'open' || now >= +new Date(job.expires_at) || c.status !== 'delivered' || Number(c.remaining) !== 0
      || c.supplier_character !== ch.id || c.buyer_character !== employer.id || c.depot_id !== depot.id) fail('evidence');
  const wage = job.terms.wageCash; if (Number(job.escrow_cash) < wage) fail('insolvent');
  await client.query("UPDATE game_employment_assignments SET state='paid',paid_at=clock_timestamp() WHERE id=$1", [a.id]);
  await client.query('UPDATE game_employment_jobs SET escrow_cash=escrow_cash-$2,paid_cash=paid_cash+$2 WHERE id=$1', [job.id, wage]);
  await money(ch, wage, client, h, `employment:wage:${a.id}`);
  return receipt(ch, 'claim', key, terms, { ok: true, employmentId: job.id, commitmentId: c.id, wageCash: wage }, client);
}
// A living original employer can recover expired/unused reserve. Original-account
// receipts remain replayable by successors; unused street wealth burns at death.
export async function closeEmployment(ch, employmentId, key, client, h) {
  const terms = { employmentId: id(employmentId) }, prior = await replay(ch, 'close', key, terms, client); if (prior) return prior;
  const { job } = await locked(client, employmentId); person(ch);
  if (job.employer_account !== ch.account_id || job.employer_character !== ch.id) fail('owner');
  const now = await clock(client);
  const assignments = (await client.query("SELECT id FROM game_employment_assignments WHERE employment_id=$1 AND state='assigned'", [job.id])).rows;
  const original = (await client.query('SELECT alive FROM characters WHERE id=$1', [job.employer_character])).rows[0];
  if (assignments.length && now < +new Date(job.expires_at) && original?.alive) fail('active_assignments');
  const refund = Number(job.escrow_cash);
  await client.query("UPDATE game_employment_jobs SET state='closed',escrow_cash=0,refunded_cash=refunded_cash+$2 WHERE id=$1", [job.id, refund]);
  await money(ch, refund, client, h, `employment:refund:${job.id}`);
  return receipt(ch, 'close', key, terms, { ok: true, employmentId: job.id, refundedCash: refund }, client);
}
export async function ownEmploymentBoard(client, accountId) {
  return (await client.query(`SELECT j.* FROM game_employment_jobs j WHERE employer_account=$1 OR j.id IN
    (SELECT employment_id FROM game_employment_assignments WHERE worker_account=$1)
    ORDER BY j.expires_at,j.id LIMIT 100`, [id(accountId)])).rows;
}
export async function publicEmploymentOffers(client) {
  const rows = (await client.query(`SELECT j.id,j.depot_id,j.terms FROM game_employment_jobs j
    JOIN business_depots d ON d.id=j.depot_id JOIN characters c ON c.id=j.employer_character
    JOIN agent_company_profiles p ON p.account_id=j.employer_account
    WHERE j.state='open' AND j.expires_at>clock_timestamp() AND c.alive AND d.status='open'
    AND d.owner_character=c.id AND c.account_id=j.employer_account AND p.published
    ORDER BY j.expires_at,j.id LIMIT 50`)).rows;
  const offers = [];
  for (const row of rows) {
    const used = (await client.query('SELECT id FROM game_employment_assignments WHERE employment_id=$1', [row.id])).rows.length;
    if (used < row.terms.slots) offers.push(row);
  }
  return offers;
}
export const employmentConservationQuery = 'SELECT COALESCE(SUM(escrow_cash),0) AS employment_cash FROM game_employment_jobs';

// Canonical runEstate calls under original character/account mutex, after
// depot/order/delivery processing. Reserve follows the street-wealth burn rule.
export async function voidEmploymentAtDeath(client, h, victim) {
  const jobs = (await client.query("SELECT * FROM game_employment_jobs WHERE employer_character=$1 AND employer_account=$2 AND state='open' ORDER BY id FOR UPDATE", [victim.id, victim.account_id])).rows;
  let burnedCash = 0;
  for (const job of jobs) {
    const burn = Number(job.escrow_cash);
    await client.query("UPDATE game_employment_jobs SET state='closed',escrow_cash=0,burned_cash=burned_cash+$2 WHERE id=$1", [job.id, burn]);
    if (burn) await h.ledger(client, { currency: 'cash', amount: -burn, reason: `death:employment:${job.id}`, counterparty: victim.id });
    burnedCash += burn;
  }
  return { burnedCash, closedJobs: jobs.length };
}

// Immutable account-scoped request receipts may replay after a peer's death.
// Routes call this before rediscovering the original employer character.
export async function replayEmploymentRequest(accountId, action, body, key, client, { agent = false } = {}) {
  let terms;
  if (action === 'accept') {
    if (!body || Object.keys(body).sort().join(',') !== 'commitmentId,consent,employmentId' || body.consent !== true) fail('terms');
    terms = { employmentId: id(body.employmentId), commitmentId: id(body.commitmentId), consent: true, agent };
  } else if (action === 'claim') {
    if (!body || Object.keys(body).sort().join(',') !== 'commitmentId,employmentId') fail('terms');
    terms = { employmentId: id(body.employmentId), commitmentId: id(body.commitmentId) };
  } else fail('terms');
  return replay({ account_id: id(accountId) }, action, key, terms, client);
}
