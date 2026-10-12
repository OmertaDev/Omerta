import crypto from 'node:crypto';
import { GameError } from './game.js';
import { loanOwed, loanVig } from './rules.js';

export const COMMERCIAL_REPUTATION = Object.freeze({ sourceLimit: 100, proofLimit: 500, minimumCounterparties: 3,
  categories: ['deliveries', 'paidWork', 'closedStorage', 'repaidLoans', 'workflows'] });
const fail = reason => { throw new GameError('commercial_reputation', reason); };
const person = ch => { if (!ch?.alive || ch.is_npc || !ch.account_id) fail('character'); };
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const one = async (client, sql, values) => (await client.query(sql, values)).rows[0] || null;
const originalAccount = async (client, character) => (await one(client, 'SELECT account_id FROM characters WHERE id=$1', [character]))?.account_id;
const independent = (account, other) => !!other && other !== account;
async function deliveryProof(client, row, account) {
  const supplier = await originalAccount(client, row.supplier_character), buyer = await originalAccount(client, row.buyer_character);
  const order = await one(client, 'SELECT * FROM market_listings WHERE id=$1', [row.order_id]);
  const valid = supplier === account && independent(account, buyer) && row.status === 'delivered' && Number(row.remaining) === 0
    && Number(row.quantity) > 0 && order?.kind === 'order' && order.seller_character === row.buyer_character
    && order.depot_id === row.depot_id && order.good_id === row.good_id && Number(order.price) === Number(row.unit_price);
  return { valid, counterparties: valid ? [buyer] : [], identity: [row.id, row.supplier_character, row.buyer_character, row.order_id, row.quantity, row.status, row.remaining] };
}
async function workProof(client, row, account) {
  const job = await one(client, 'SELECT * FROM game_employment_jobs WHERE id=$1', [row.employment_id]);
  const commitment = await one(client, 'SELECT * FROM delivery_commitments WHERE id=$1', [row.commitment_id]);
  const employer = job && await originalAccount(client, job.employer_character);
  const delivery = commitment && await deliveryProof(client, commitment, account);
  const wage = Number(job?.terms?.wageCash);
  const payments = (await client.query("SELECT id,amount FROM transactions WHERE character_id=$1 AND currency='cash' AND reason=$2 ORDER BY id LIMIT 2", [row.worker_character, `employment:wage:${row.id}`])).rows;
  const valid = row.worker_account === account && await originalAccount(client, row.worker_character) === account
    && independent(account, employer) && job?.employer_account === employer && row.state === 'paid' && !!row.paid_at
    && delivery?.valid && commitment.buyer_character === job.employer_character && commitment.depot_id === job.depot_id
    && wage > 0 && Number(job.paid_cash) >= wage && payments.length === 1 && Number(payments[0].amount) === wage;
  return { valid, counterparties: valid ? [employer] : [], identity: [row.id, row.worker_account, row.state, row.paid_at, payments.map(p => p.id), commitment?.status] };
}
async function storageProof(client, row, account) {
  const landlord = await originalAccount(client, row.landlord_character), tenant = await originalAccount(client, row.tenant_character);
  const depot = await one(client, 'SELECT owner_character FROM business_depots WHERE id=$1', [row.depot_id]);
  const rent = (await client.query("SELECT id,cash_delta,customer_character FROM business_depot_journal WHERE lease_id=$1 AND depot_id=$2 AND reason='warehouse_rent' ORDER BY id LIMIT 2", [row.id, row.depot_id])).rows;
  const valid = landlord === account && independent(account, tenant) && depot?.owner_character === row.landlord_character
    && row.status === 'closed' && Number(row.held_qty) === 0 && Number(row.fee_cash) > 0
    && Number(row.fee_cash) === Number(row.units) * Number(row.cash_per_unit_day)
    && rent.length === 1 && rent[0].customer_character === row.tenant_character && Number(rent[0].cash_delta) === Number(row.fee_cash);
  return { valid, counterparties: valid ? [tenant] : [], identity: [row.id, row.landlord_character, row.tenant_character, row.status, rent.map(p => p.id)] };
}
async function loanProof(client, row, account, used = new Set()) {
  const lender = await originalAccount(client, row.lender_character), borrower = await originalAccount(client, row.borrower_character);
  const owed = loanOwed(row.principal, row.rate), net = owed - loanVig(owed);
  const settlement = async (character, counterparty, amount) => (await client.query("SELECT t.id FROM transactions t LEFT JOIN commercial_reputation_settlements p ON p.transaction_id=t.id WHERE t.character_id=$1 AND t.counterparty=$2 AND t.currency='cash' AND t.reason='loan:repay' AND t.amount=$3 AND t.at>=$4 AND (p.transaction_id IS NULL OR (p.source_id=$5 AND p.account_id=$6)) ORDER BY t.id LIMIT 100", [character, counterparty, amount, row.offered_at, row.id, account])).rows.find(p => !used.has(p.id));
  const payment = await settlement(row.lender_character, row.borrower_character, net);
  const debit = await settlement(row.borrower_character, row.lender_character, -owed);
  const valid = lender === account && independent(account, borrower) && row.status === 'repaid' && Number(row.principal) > 0 && net > 0 && !!payment && !!debit;
  if (valid) { used.add(payment.id); used.add(debit.id); }
  return { valid, counterparties: valid ? [borrower] : [], settlementIds: valid ? [payment.id, debit.id] : [], identity: [row.id, row.lender_character, row.borrower_character, row.status, payment?.id, debit?.id] };
}
async function workflowProof(client, row, account) {
  const invalid = { valid: false, counterparties: [], identity: [row.id, row.status, row.completed_stages] };
  if (row.account_id !== account || await originalAccount(client, row.original_character) !== account || row.status !== 'completed' || Number(row.completed_stages) !== 3) return invalid;
  const proofs = (await client.query('SELECT * FROM company_workflow_proofs WHERE workflow_id=$1 ORDER BY source_id LIMIT 6', [row.id])).rows;
  if (proofs.length !== 5 || proofs.filter(p => p.stage === 'procurement').length !== 1 || proofs.filter(p => p.stage === 'custody').length !== 3 || proofs.filter(p => p.stage === 'delivery').length !== 1) return invalid;
  const c = await one(client, 'SELECT * FROM delivery_commitments WHERE id=$1', [row.commitment_id]);
  const lease = await one(client, 'SELECT * FROM business_warehouse_leases WHERE id=$1', [row.lease_id]);
  const f = await one(client, 'SELECT * FROM delivery_loan_requests WHERE id=$1', [row.terms.financeRequestId]);
  const loan = f?.loan_id && await one(client, 'SELECT * FROM loans WHERE id=$1', [f.loan_id]);
  const delivered = c && await deliveryProof(client, c, account);
  if (!delivered?.valid || c.supplier_character !== row.original_character || Number(c.quantity) !== Number(row.quantity)
      || !lease || lease.tenant_character !== row.original_character || !['active', 'closed'].includes(lease.status) || Number(lease.held_qty) !== 0
      || !f || f.supplier_character !== row.original_character || f.buyer_character !== c.buyer_character || f.order_id !== c.order_id || f.commitment_id !== c.id
      || f.state !== 'settled' || loan?.status !== 'repaid' || f.settlement?.delivery?.delivered !== Number(row.quantity)
      || loan.borrower_character !== row.original_character || loan.lender_character !== f.requested_lender_character
      || f.settlement?.delivery?.gross !== Number(c.quantity) * Number(c.unit_price)
      || f.settlement?.delivery?.earned !== Number(c.quantity) * Number(c.unit_price) - Math.ceil(Number(c.quantity) * Number(c.unit_price) * Number(c.take_bps) / 10000)
      || f.settlement?.repayment?.paid !== loanOwed(loan.principal, loan.rate)) return invalid;
  const other = [await originalAccount(client, lease.landlord_character), await originalAccount(client, loan.lender_character), ...delivered.counterparties];
  if (other.some(value => !independent(account, value))) return invalid;
  if (!(await loanProof(client, loan, other[1])).valid) return invalid;
  const ownDepot = await one(client, 'SELECT owner_character FROM business_depots WHERE id=$1', [row.depot_id]);
  if (ownDepot?.owner_character !== row.original_character) return invalid;
  const journals = [];
  for (const p of proofs.filter(p => p.source_type === 'depot_journal')) {
    const j = await one(client, 'SELECT * FROM business_depot_journal WHERE id=$1', [p.source_id]);
    if (!j || j.customer_character !== row.original_character) return invalid;
    journals.push(j);
  }
  const sale = journals.find(j => j.reason === 'sale'), deposit = journals.find(j => j.reason === 'warehouse_deposit'), withdrawal = journals.find(j => j.reason === 'warehouse_withdraw'), rent = journals.find(j => j.reason === 'warehouse_rent');
  if (!sale || sale.depot_id !== row.terms.procurementDepotId || -Number(sale.stock_delta) !== Number(row.quantity) || Number(sale.cash_delta) <= 0
      || !deposit || !withdrawal || !rent || [deposit, withdrawal, rent].some(j => j.lease_id !== lease.id || j.depot_id !== lease.depot_id)
      || Number(deposit.lease_stock_delta) !== Number(row.quantity) || Number(deposit.lease_stock_after) !== Number(row.quantity) || Number(withdrawal.lease_stock_delta) !== -Number(row.quantity)
      || Number(withdrawal.lease_sequence) !== Number(deposit.lease_sequence) + 1 || Number(withdrawal.lease_stock_after) !== 0
      || Number(rent.cash_delta) !== Number(lease.fee_cash) || proofs.find(p => p.stage === 'delivery').source_id !== f.id) return invalid;
  const floor = +new Date(row.created_at), ceiling = +new Date(row.deadline), settled = +new Date(f.settled_at);
  if (![floor, ceiling, settled, ...[sale, deposit, withdrawal].map(j => +new Date(j.created_at))].every(Number.isFinite)
      || +new Date(sale.created_at) < floor || +new Date(deposit.created_at) < +new Date(sale.created_at)
      || +new Date(withdrawal.created_at) < +new Date(deposit.created_at) || settled < +new Date(withdrawal.created_at) || settled > ceiling) return invalid;
  return { valid: true, counterparties: [...new Set(other)], identity: [row.id, row.status, proofs.map(p => [p.source_type, p.source_id]), c.status, f.state, loan.status] };
}

const definitions = {
  deliveries: { table: 'delivery_commitments', role: 'supplier_character', validate: deliveryProof },
  paidWork: { table: 'game_employment_assignments', role: 'worker_character', validate: workProof },
  closedStorage: { table: 'business_warehouse_leases', role: 'landlord_character', validate: storageProof },
  repaidLoans: { table: 'loans', role: 'lender_character', validate: loanProof },
  workflows: { table: 'company_workflows', role: 'original_character', validate: workflowProof },
};
async function evidence(client, account) {
  const result = [], usedSettlements = new Set();
  for (const category of COMMERCIAL_REPUTATION.categories) {
    const def = definitions[category];
    // Table and role identifiers are fixed module constants, never caller input.
    const rows = (await client.query(`SELECT s.* FROM ${def.table} s JOIN characters c ON c.id=s.${def.role} WHERE c.account_id=$1 ORDER BY s.id LIMIT 100`, [account])).rows;
    for (const row of rows) {
      if ((category === 'paidWork' && row.worker_account !== account) || (category === 'workflows' && row.account_id !== account)) continue;
      const proof = await def.validate(client, row, account, usedSettlements);
      result.push({ category, sourceId: row.id, originalCharacter: row[def.role], ...proof, evidenceHash: digest(proof.identity) });
    }
  }
  return result;
}
async function recordEvidence(client, account, records) {
  const recorded = (await client.query('SELECT * FROM commercial_reputation_proofs WHERE account_id=$1 ORDER BY category,source_id LIMIT 500', [account])).rows;
  let full = false;
  for (const record of records.filter(r => r.valid)) {
    const existing = await one(client, 'SELECT * FROM commercial_reputation_proofs WHERE category=$1 AND source_id=$2', [record.category, record.sourceId]);
    if (existing) {
      if (existing.account_id !== account || existing.original_character !== record.originalCharacter) fail('proof_identity');
      continue;
    }
    if (recorded.length >= COMMERCIAL_REPUTATION.proofLimit) { full = true; continue; }
    await client.query('INSERT INTO commercial_reputation_proofs(category,source_id,account_id,original_character,evidence_hash) VALUES($1,$2,$3,$4,$5)', [record.category, record.sourceId, account, record.originalCharacter, record.evidenceHash]);
    for (const transaction of record.settlementIds || []) await client.query('INSERT INTO commercial_reputation_settlements(transaction_id,source_id,account_id) VALUES($1,$2,$3)', [transaction, record.sourceId, account]);
    recorded.push(record);
  }
  return full;
}

export async function setCommercialReputation(ch, body, client) {
  person(ch);
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).sort().join(',') !== 'expectedRevision,published'
      || typeof body.published !== 'boolean' || !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0 || body.expectedRevision >= 2147483647) fail('terms');
  const prior = await one(client, 'SELECT * FROM commercial_reputation_publications WHERE account_id=$1 FOR UPDATE', [ch.account_id]);
  if (Number(prior?.revision || 0) !== body.expectedRevision) fail('revision');
  if (body.published) {
    const company = await one(client, 'SELECT published FROM agent_company_profiles WHERE account_id=$1', [ch.account_id]);
    if (!company?.published) fail('company_not_published');
    await recordEvidence(client, ch.account_id, await evidence(client, ch.account_id));
  }
  const revision = body.expectedRevision + 1;
  if (prior) await client.query('UPDATE commercial_reputation_publications SET published=$2,revision=$3 WHERE account_id=$1', [ch.account_id, body.published, revision]);
  else await client.query('INSERT INTO commercial_reputation_publications(account_id,published,revision) VALUES($1,$2,$3)', [ch.account_id, body.published, revision]);
  return { ok: true, published: body.published, revision };
}
export async function refreshCommercialReputation(ch, client) {
  person(ch);
  await client.query('SELECT account_id FROM commercial_reputation_publications WHERE account_id=$1 FOR UPDATE', [ch.account_id]);
  const records = await evidence(client, ch.account_id), proofLimitReached = await recordEvidence(client, ch.account_id, records);
  return { ok: true, sourceWindowPerCategory: 100, proofLimitReached, evidence: records.map(r => ({ category: r.category, sourceId: r.sourceId, eligible: r.valid, evidenceHash: r.evidenceHash })) };
}
export async function ownCommercialReputation(ch, client) {
  person(ch);
  const publication = await one(client, 'SELECT published,revision FROM commercial_reputation_publications WHERE account_id=$1', [ch.account_id]);
  const records = await evidence(client, ch.account_id);
  return { ok: true, publication: publication ? { published: publication.published, revision: Number(publication.revision) } : { published: false, revision: 0 },
    sourceWindowPerCategory: 100, evidence: records.map(r => ({ category: r.category, sourceId: r.sourceId, eligible: r.valid })) };
}
const band = count => count < 3 ? null : count < 10 ? '3–9' : count < 25 ? '10–24' : count < 50 ? '25–49' : '50–100';
export async function publicCommercialReputation(client, account) {
  if (typeof account !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(account)) fail('account');
  const company = await one(client, 'SELECT name,published FROM agent_company_profiles WHERE account_id=$1', [account]);
  const publication = await one(client, 'SELECT published FROM commercial_reputation_publications WHERE account_id=$1', [account]);
  if (!company?.published || !publication?.published) return { available: false };
  const records = await evidence(client, account);
  const registered = (await client.query('SELECT category,source_id,original_character FROM commercial_reputation_proofs WHERE account_id=$1 ORDER BY category,source_id LIMIT 500', [account])).rows;
  const categories = {};
  for (const category of COMMERCIAL_REPUTATION.categories) {
    const valid = records.filter(r => r.category === category && r.valid && registered.some(p => p.category === category && p.source_id === r.sourceId && p.original_character === r.originalCharacter));
    categories[category] = new Set(valid.flatMap(r => r.counterparties)).size >= 3 ? band(valid.length) : null;
  }
  // Recheck both visibility grants after the potentially lengthy source traversal.
  const currentCompany = await one(client, 'SELECT name,published FROM agent_company_profiles WHERE account_id=$1', [account]);
  const currentPublication = await one(client, 'SELECT published FROM commercial_reputation_publications WHERE account_id=$1', [account]);
  if (!currentCompany?.published || !currentPublication?.published) return { available: false };
  return { available: true, companyName: currentCompany.name, categories, sourceWindowPerCategory: 100,
    proofLimit: 500, minimumIndependentAccounts: 3, scope: 'Separate coarse game engagement counts; categories may overlap. No Sybil, creditworthiness or profit claim.' };
}
