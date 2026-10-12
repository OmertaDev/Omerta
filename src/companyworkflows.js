import crypto from 'node:crypto';
import { GameError } from './game.js';

// Metadata only: canonical APIs retain all procurement, custody and spending authority.
export const COMPANY_WORKFLOW = Object.freeze({ stages: Object.freeze(['procurement', 'custody', 'delivery']), maxActive: 3, maxUnits: 10, maxSeconds: 21600 });
const fail = reason => { const error = new GameError('company_workflow', `Company workflow refused: ${reason}.`); error.reason = reason; throw error; };
const id = value => { if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) fail('terms'); return value; };
const exact = (body, keys) => { if (!body || Array.isArray(body) || typeof body !== 'object' || Object.keys(body).sort().join(',') !== keys.sort().join(',')) fail('terms'); };
const integer = (n, min, max) => { if (!Number.isSafeInteger(n) || n < min || n > max) fail('terms'); return n; };
const time = value => { if (value === null || value === undefined) fail('source_clock'); const n = new Date(value).getTime(); if (!Number.isFinite(n)) fail('source_clock'); return n; };
const stable = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
export function companyWorkflowTerms(body) {
  exact(body, ['depotId', 'procurementDepotId', 'leaseId', 'commitmentId', 'financeRequestId', 'qty', 'deadlineSeconds']);
  return { depotId: id(body.depotId), procurementDepotId: id(body.procurementDepotId), leaseId: id(body.leaseId), commitmentId: id(body.commitmentId), financeRequestId: id(body.financeRequestId), qty: integer(body.qty, 1, 10), deadlineSeconds: integer(body.deadlineSeconds, 60, 21600) };
}
function actionTerms(body, action) {
  if (action === 'cancel') { exact(body, []); return {}; }
  if (!COMPANY_WORKFLOW.stages.includes(body?.stage)) fail('terms');
  exact(body, body.stage === 'custody' ? ['stage', 'proofId', 'withdrawalProofId'] : ['stage', 'proofId']);
  return { stage: body.stage, proofId: id(body.proofId), ...(body.stage === 'custody' ? { withdrawalProofId: id(body.withdrawalProofId) } : {}) };
}
function actor(ch) { if (!ch?.alive || ch.is_npc) fail('actor'); return id(ch.account_id); }
function requestKey(key) { if (typeof key !== 'string' || !/^[\x21-\x7e]{1,200}$/.test(key)) fail('terms'); return key; }
async function replay(client, account, key, identity) {
  const row = (await client.query('SELECT identity,receipt FROM company_workflow_receipts WHERE account_id=$1 AND request_key=$2', [account, key])).rows[0];
  if (!row) return null;
  if (stable(row.identity) !== stable(identity)) fail('request_conflict');
  return { ...row.receipt, replayed: true };
}
async function save(client, account, key, identity, receipt) {
  await client.query('INSERT INTO company_workflow_receipts(account_id,request_key,identity,receipt) VALUES($1,$2,$3,$4)', [account, key, identity, receipt]);
  return receipt;
}
function view(row) { return { id: row.id, accountId: row.account_id, originalCharacterId: row.original_character, depotId: row.depot_id, status: row.status, nextStage: row.status === 'active' ? COMPANY_WORKFLOW.stages[row.completed_stages] || null : null, completedStages: row.completed_stages, quantity: row.quantity, deadline: new Date(row.deadline).toISOString() }; }
export async function companyWorkflowNextAction(client, row) {
  if (row.status !== 'active') return null;
  const stage = COMPANY_WORKFLOW.stages[row.completed_stages], terms = companyWorkflowTerms(row.terms);
  const advance = body => ({ kind: 'company_workflow_advance', method: 'POST', endpoint: '/v1/company/workflows/:id/advance', params: { id: row.id }, body });
  // Finite typed DTOs only. These describe canonical APIs; callers retain their normal spending authority.
  if (stage === 'procurement') {
    const sale = (await client.query("SELECT id FROM business_depot_journal WHERE depot_id=$1 AND customer_character=$2 AND reason='sale' AND stock_delta=$3 AND created_at>=$4 ORDER BY created_at,id LIMIT 1", [terms.procurementDepotId, row.original_character, -row.quantity, row.created_at])).rows[0];
    if (sale) return advance({ stage, proofId: sale.id });
    const c = (await client.query('SELECT * FROM delivery_commitments WHERE id=$1', [terms.commitmentId])).rows[0];
    const depot = (await client.query('SELECT * FROM business_depots WHERE id=$1', [terms.procurementDepotId])).rows[0];
    if (!c || !depot) return null;
    const maximum = Math.floor((Number(c.spend_limit) - Number(c.spent)) / row.quantity);
    if (!Number.isSafeInteger(maximum) || maximum < 50) return null;
    return { kind: 'delivery_depot_buy', method: 'POST', endpoint: '/v1/deliveries/:id/depot/:depotId/buy', params: { id: terms.commitmentId, depotId: terms.procurementDepotId }, body: { qty: row.quantity, maxUnitPrice: Math.min(maximum, Number(depot.sale_price)) } };
  }
  if (stage === 'custody') {
    const rows = (await client.query('SELECT id,reason,lease_sequence FROM business_depot_journal WHERE lease_id=$1 AND created_at>=$2 ORDER BY lease_sequence LIMIT 100', [terms.leaseId, row.created_at])).rows;
    const deposit = rows.find(p => p.reason === 'warehouse_deposit'), withdrawal = rows.find(p => p.reason === 'warehouse_withdraw' && Number(p.lease_sequence) === Number(deposit?.lease_sequence) + 1);
    if (deposit && withdrawal) return advance({ stage, proofId: deposit.id, withdrawalProofId: withdrawal.id });
    const lease = (await client.query('SELECT held_qty FROM business_warehouse_leases WHERE id=$1', [terms.leaseId])).rows[0];
    if (!lease) return null;
    return Number(lease.held_qty) === row.quantity
      ? { kind: 'warehouse_withdraw', method: 'POST', endpoint: '/v1/warehouse-leases/:id/withdraw', params: { id: terms.leaseId }, body: { qty: row.quantity } }
      : { kind: 'warehouse_deposit', method: 'POST', endpoint: '/v1/warehouse-leases/:id/deposit', params: { id: terms.leaseId }, body: { qty: row.quantity } };
  }
  const finance = (await client.query('SELECT state FROM delivery_loan_requests WHERE id=$1', [terms.financeRequestId])).rows[0];
  if (finance?.state === 'settled') return advance({ stage, proofId: terms.financeRequestId });
  return { kind: 'delivery_deliver', method: 'POST', endpoint: '/v1/deliveries/:id/deliver', params: { id: terms.commitmentId }, body: { qty: row.quantity } };
}
// Caller holds its canonical character lock. Preserve finance's loan→order→commitment→request order.
async function sources(client, terms) {
  const leaseHint = (await client.query('SELECT * FROM business_warehouse_leases WHERE id=$1', [terms.leaseId])).rows[0];
  const financeHint = (await client.query('SELECT * FROM delivery_loan_requests WHERE id=$1', [terms.financeRequestId])).rows[0];
  const commitmentHint = (await client.query('SELECT * FROM delivery_commitments WHERE id=$1', [terms.commitmentId])).rows[0];
  if (!leaseHint || !financeHint || !commitmentHint || !financeHint.loan_id) fail('source');
  const depots = new Map();
  for (const depotId of [...new Set([terms.depotId, terms.procurementDepotId, leaseHint.depot_id, commitmentHint.depot_id])].sort()) {
    depots.set(depotId, (await client.query('SELECT * FROM business_depots WHERE id=$1 FOR UPDATE', [depotId])).rows[0]);
  }
  const loan = (await client.query('SELECT * FROM loans WHERE id=$1 FOR UPDATE', [financeHint.loan_id])).rows[0];
  const order = (await client.query('SELECT * FROM market_listings WHERE id=$1 FOR UPDATE', [commitmentHint.order_id])).rows[0];
  const lease = (await client.query('SELECT * FROM business_warehouse_leases WHERE id=$1 FOR UPDATE', [terms.leaseId])).rows[0];
  const commitment = (await client.query('SELECT * FROM delivery_commitments WHERE id=$1 FOR UPDATE', [terms.commitmentId])).rows[0];
  const finance = (await client.query('SELECT * FROM delivery_loan_requests WHERE id=$1 FOR UPDATE', [terms.financeRequestId])).rows[0];
  if (lease?.depot_id !== leaseHint.depot_id || commitment?.depot_id !== commitmentHint.depot_id || commitment?.order_id !== commitmentHint.order_id || finance?.loan_id !== financeHint.loan_id) fail('source_changed');
  return { depots, loan, order, lease, commitment, finance };
}
function ownership(ctx, terms, owner) {
  const { depots, commitment: c, order, lease, finance, loan } = ctx;
  if (depots.get(terms.depotId)?.owner_character !== owner || c.supplier_character !== owner || lease.tenant_character !== owner || finance.supplier_character !== owner || loan?.borrower_character !== owner
      || finance.commitment_id !== c.id || finance.order_id !== c.order_id || finance.buyer_character !== c.buyer_character || order?.seller_character !== c.buyer_character || order.depot_id !== c.depot_id
      || c.good_id !== 'gin' || lease.good_id !== 'gin' || order.good_id !== 'gin' || Number(c.quantity) !== terms.qty || Number(c.unit_price) !== Number(order.price)
      || terms.procurementDepotId === terms.depotId || terms.procurementDepotId === c.depot_id || depots.get(terms.procurementDepotId)?.owner_character === owner) fail('source_owner');
}
export async function createCompanyWorkflow(ch, body, key, client) {
  const account = actor(ch), terms = companyWorkflowTerms(body), identity = { action: 'create', terms }; requestKey(key);
  const prior = await replay(client, account, key, identity); if (prior) return prior;
  if (!(await client.query('SELECT account_id FROM agent_company_profiles WHERE account_id=$1', [account])).rows.length) fail('company');
  const ctx = await sources(client, terms); ownership(ctx, terms, ch.id);
  const now = (await client.query('SELECT clock_timestamp() AS now')).rows[0].now, deadline = new Date(time(now) + terms.deadlineSeconds * 1000);
  if ([...ctx.depots.values()].some(d => !d || d.status !== 'open') || ctx.commitment.status !== 'accepted' || Number(ctx.commitment.remaining) !== terms.qty
      || ctx.finance.state !== 'active' || ctx.loan.status !== 'active' || ctx.order.kind !== 'order' || ctx.order.status !== 'live' || Number(ctx.order.qty) < terms.qty
      || ctx.lease.status !== 'active' || Number(ctx.lease.units) < terms.qty || Number(ctx.lease.held_qty) !== 0
      || [ctx.commitment.deadline, ctx.order.expires_at, ctx.lease.expires_at, ctx.loan.due_at].some(d => time(d) < time(deadline))) fail('source_not_active');
  const funding = (await client.query("SELECT cash_delta FROM business_depot_journal WHERE depot_id=$1 AND order_id=$2 AND reason='restock_escrow'", [ctx.order.depot_id, ctx.order.id])).rows;
  if (funding.length !== 1 || -Number(funding[0].cash_delta) < terms.qty * Number(ctx.order.price)) fail('funding');
  if ((await client.query("SELECT id FROM company_workflows WHERE account_id=$1 AND status='active' LIMIT 3", [account])).rows.length >= 3) fail('limit');
  if ((await client.query('SELECT id FROM company_workflows WHERE commitment_id=$1 OR lease_id=$2', [terms.commitmentId, terms.leaseId])).rows.length) fail('source_used');
  const row = { id: crypto.randomUUID(), account_id: account, original_character: ch.id, depot_id: terms.depotId, quantity: terms.qty, status: 'active', completed_stages: 0, deadline, created_at: now };
  await client.query('INSERT INTO company_workflows(id,account_id,original_character,depot_id,commitment_id,lease_id,terms,quantity,deadline,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [row.id, account, ch.id, terms.depotId, terms.commitmentId, terms.leaseId, terms, terms.qty, deadline, now]);
  return save(client, account, key, identity, { ok: true, workflow: view(row), paid: 0, nextAction: await companyWorkflowNextAction(client, { ...row, terms }) });
}
async function journal(client, proofId, workflowId) {
  const row = (await client.query('SELECT * FROM business_depot_journal WHERE id=$1', [proofId])).rows[0];
  // Preserve native sub-millisecond ordering rather than trusting Date truncation.
  if (row && !(await client.query('SELECT j.id FROM business_depot_journal j JOIN company_workflows w ON w.id=$2 WHERE j.id=$1 AND j.created_at>=w.created_at AND j.created_at<=w.deadline', [proofId, workflowId])).rows.length) fail('proof_clock');
  return row;
}
function dated(row, floor, deadline) { if (time(row.created_at) < floor || time(row.created_at) > time(deadline)) fail('proof_clock'); }
async function context(client, account, workflowId) {
  const hint = (await client.query('SELECT * FROM company_workflows WHERE id=$1 AND account_id=$2', [workflowId, account])).rows[0];
  if (!hint) fail('not_found');
  const ctx = await sources(client, companyWorkflowTerms(hint.terms));
  const row = (await client.query('SELECT * FROM company_workflows WHERE id=$1 AND account_id=$2 FOR UPDATE', [workflowId, account])).rows[0];
  if (!row || JSON.stringify(companyWorkflowTerms(row.terms)) !== JSON.stringify(companyWorkflowTerms(hint.terms))) fail('source_changed');
  ownership(ctx, row.terms, row.original_character);
  return { row, ctx };
}
async function consume(client, row, stage, proofIds, receipt) {
  for (const proofId of proofIds) {
    if ((await client.query('SELECT workflow_id FROM company_workflow_proofs WHERE source_type=$1 AND source_id=$2', [stage === 'delivery' ? 'finance' : 'depot_journal', proofId])).rows.length) fail('proof_used');
    await client.query('INSERT INTO company_workflow_proofs(workflow_id,stage,source_type,source_id,receipt) VALUES($1,$2,$3,$4,$5)', [row.id, stage, stage === 'delivery' ? 'finance' : 'depot_journal', proofId, receipt]);
  }
}
export async function advanceCompanyWorkflow(ch, workflowId, body, key, client, h) {
  const account = actor(ch), terms = actionTerms(body, 'advance'), identity = { action: 'advance', workflowId: id(workflowId), terms }; requestKey(key);
  const prior = await replay(client, account, key, identity); if (prior) return prior;
  const { row, ctx } = await context(client, account, workflowId);
  if (row.original_character !== ch.id) fail('original_owner');
  if (row.status !== 'active') fail('terminal');
  const now = (await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
  if (time(now) >= time(row.deadline) || !['accepted', 'delivered'].includes(ctx.commitment.status) || ['cancelled', 'closed'].includes(ctx.finance.state) || ['tenant_dead', 'landlord_closed'].includes(ctx.lease.status)
      || (ctx.finance.state === 'active' && ctx.loan.status !== 'active')
      || ctx.depots.get(row.depot_id)?.status !== 'open') {
    row.status = time(now) >= time(row.deadline) ? 'expired' : 'failed';
    await client.query('UPDATE company_workflows SET status=$2 WHERE id=$1', [row.id, row.status]);
    return save(client, account, key, identity, { ok: true, workflow: view(row), paid: 0 });
  }
  if (terms.stage !== COMPANY_WORKFLOW.stages[row.completed_stages]) fail('stage_order');
  const previous = (await client.query('SELECT receipt FROM company_workflow_proofs WHERE workflow_id=$1 ORDER BY created_at,source_id', [row.id])).rows.map(p => p.receipt);
  const floor = Math.max(time(row.created_at), ...previous.map(p => time(p.provenAt)));
  let receipt, proofIds = [terms.proofId];
  if (terms.stage === 'procurement') {
    const sale = await journal(client, terms.proofId, row.id);
    if (!sale) return save(client, account, key, identity, { ok: true, pending: true, workflow: view(row), paid: 0 });
    if (sale.reason !== 'sale' || sale.depot_id !== row.terms.procurementDepotId || sale.customer_character !== row.original_character || -Number(sale.stock_delta) !== row.quantity || Number(sale.cash_delta) <= 0 || Number(ctx.commitment.spent) < Number(sale.cash_delta)) fail('proof');
    dated(sale, floor, row.deadline);
    receipt = { provenAt: new Date(sale.created_at).toISOString(), canonicalCash: Number(sale.cash_delta), sourceId: sale.id };
  } else if (terms.stage === 'custody') {
    const deposit = await journal(client, terms.proofId, row.id), withdrawal = await journal(client, terms.withdrawalProofId, row.id);
    if (!deposit || !withdrawal) return save(client, account, key, identity, { ok: true, pending: true, workflow: view(row), paid: 0 });
    if (deposit.reason !== 'warehouse_deposit' || withdrawal.reason !== 'warehouse_withdraw' || deposit.lease_id !== row.lease_id || withdrawal.lease_id !== row.lease_id
        || deposit.depot_id !== ctx.lease.depot_id || withdrawal.depot_id !== ctx.lease.depot_id || deposit.customer_character !== row.original_character || withdrawal.customer_character !== row.original_character
        || Number(deposit.lease_stock_delta) !== row.quantity || Number(withdrawal.lease_stock_delta) !== -row.quantity || Number(deposit.lease_stock_after) !== row.quantity || Number(withdrawal.lease_stock_after) !== 0
        || Number(withdrawal.lease_sequence) !== Number(deposit.lease_sequence) + 1 || Number(ctx.lease.held_qty) !== 0) fail('proof');
    dated(deposit, floor, row.deadline); dated(withdrawal, time(deposit.created_at), row.deadline);
    const rent = (await client.query("SELECT * FROM business_depot_journal WHERE lease_id=$1 AND reason='warehouse_rent'", [row.lease_id])).rows;
    if (rent.length !== 1 || rent[0].customer_character !== row.original_character || Number(rent[0].cash_delta) !== Number(ctx.lease.fee_cash)) fail('rent_proof');
    proofIds.push(terms.withdrawalProofId, rent[0].id);
    receipt = { provenAt: new Date(withdrawal.created_at).toISOString(), canonicalCash: Number(rent[0].cash_delta), sourceId: deposit.id, withdrawalId: withdrawal.id, rentId: rent[0].id };
  } else {
    if (terms.proofId !== ctx.finance.id) fail('proof');
    if (ctx.finance.state !== 'settled' || ctx.commitment.status !== 'delivered' || Number(ctx.commitment.remaining) !== 0) return save(client, account, key, identity, { ok: true, pending: true, workflow: view(row), paid: 0 });
    const delivery = ctx.finance.settlement?.delivery, repayment = ctx.finance.settlement?.repayment;
    const gross = row.quantity * Number(ctx.commitment.unit_price), net = gross - Math.ceil(gross * Number(ctx.commitment.take_bps) / 10000);
    if (!delivery || delivery.delivered !== row.quantity || delivery.gross !== gross || delivery.earned !== net || !repayment || !Number.isFinite(repayment.paid) || repayment.paid <= 0 || repayment.paid > net || ctx.loan.status !== 'repaid') fail('settlement_proof');
    dated({ created_at: ctx.finance.settled_at }, floor, row.deadline);
    receipt = { provenAt: new Date(ctx.finance.settled_at).toISOString(), canonicalCash: delivery.earned, sourceId: ctx.finance.id, repaymentCash: repayment.paid };
  }
  await consume(client, row, terms.stage, proofIds, receipt);
  row.completed_stages += 1; if (row.completed_stages === 3) row.status = 'completed';
  await client.query('UPDATE company_workflows SET completed_stages=$2,status=$3 WHERE id=$1', [row.id, row.completed_stages, row.status]);
  return save(client, account, key, identity, { ok: true, workflow: view(row), stage: terms.stage, proof: receipt, paid: 0, nextAction: await companyWorkflowNextAction(client, row) });
}
export async function cancelCompanyWorkflow(ch, workflowId, body, key, client) {
  const account = actor(ch), terms = actionTerms(body, 'cancel'), identity = { action: 'cancel', workflowId: id(workflowId), terms }; requestKey(key);
  const prior = await replay(client, account, key, identity); if (prior) return prior;
  // Cancellation has no source mutation; heirs may close original-account metadata.
  const row = (await client.query('SELECT * FROM company_workflows WHERE id=$1 AND account_id=$2 FOR UPDATE', [workflowId, account])).rows[0];
  if (!row) fail('not_found');
  if (row.status === 'active') { row.status = 'cancelled'; await client.query("UPDATE company_workflows SET status='cancelled' WHERE id=$1", [row.id]); }
  return save(client, account, key, identity, { ok: true, workflow: view(row), paid: 0, recovery: 'Canonical escrow, debt and warehouse cargo remain recoverable through their existing APIs.' });
}
export async function companyWorkflowBoard(client, account) {
  const rows = (await client.query('SELECT * FROM company_workflows WHERE account_id=$1 ORDER BY created_at DESC,id LIMIT 100', [id(account)])).rows;
  const result = [];
  for (const row of rows) result.push({ ...view(row), nextAction: await companyWorkflowNextAction(client, row) });
  return result;
}
export async function companyWorkflowDueCandidates(client, limit = 20) {
  integer(limit, 1, 100);
  return (await client.query("SELECT id,account_id,original_character FROM company_workflows WHERE status='active' ORDER BY deadline,id LIMIT $1", [limit])).rows;
}
export async function advanceCompanyWorkflowDue(ch, workflowId, client, h) {
  const account = actor(ch);
  const row = (await client.query("SELECT * FROM company_workflows WHERE id=$1 AND account_id=$2 AND status='active'", [id(workflowId), account])).rows[0];
  if (!row) return { ok: true, pending: false };
  if (row.original_character !== ch.id) return { ok: true, pending: true, reason: 'original_owner' };
  const locked = await context(client, account, row.id);
  if (locked.row.status !== 'active') return { ok: true, pending: false, workflow: view(locked.row) };
  const now = (await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
  if (time(now) >= time(locked.row.deadline) || !['accepted', 'delivered'].includes(locked.ctx.commitment.status)
      || ['cancelled', 'closed'].includes(locked.ctx.finance.state) || ['tenant_dead', 'landlord_closed'].includes(locked.ctx.lease.status)
      || (locked.ctx.finance.state === 'active' && locked.ctx.loan.status !== 'active') || locked.ctx.depots.get(row.depot_id)?.status !== 'open') {
    const reason = time(now) >= time(locked.row.deadline) ? 'expired' : 'failed';
    await client.query('UPDATE company_workflows SET status=$2 WHERE id=$1', [row.id, reason]);
    return { ok: true, workflow: view({ ...locked.row, status: reason }), paid: 0 };
  }
  const stage = COMPANY_WORKFLOW.stages[row.completed_stages];
  let body;
  if (stage === 'procurement') {
    const sale = (await client.query("SELECT id FROM business_depot_journal WHERE depot_id=$1 AND customer_character=$2 AND reason='sale' AND stock_delta=$3 AND created_at>=$4 ORDER BY created_at,id LIMIT 1", [row.terms.procurementDepotId, row.original_character, -row.quantity, row.created_at])).rows[0];
    body = { stage, proofId: sale?.id || 'missing' };
  } else if (stage === 'custody') {
    const rows = (await client.query("SELECT id,reason,lease_sequence FROM business_depot_journal WHERE lease_id=$1 AND created_at>=$2 ORDER BY lease_sequence LIMIT 100", [row.lease_id, row.created_at])).rows;
    const deposit = rows.find(p => p.reason === 'warehouse_deposit'), withdrawal = rows.find(p => p.reason === 'warehouse_withdraw' && Number(p.lease_sequence) === Number(deposit?.lease_sequence) + 1);
    body = { stage, proofId: deposit?.id || 'missing', withdrawalProofId: withdrawal?.id || 'missing' };
  } else body = { stage, proofId: row.terms.financeRequestId };
  const key = `workflow:auto:${row.id}:${stage}:${crypto.createHash('sha256').update(stable(body)).digest('hex')}`;
  // Pending results must not become permanent replay barriers to a later actual proof.
  if (Object.values(body).includes('missing') && time(row.deadline) > Date.now()) return { ok: true, pending: true, workflow: view(row), nextAction: await companyWorkflowNextAction(client, row) };
  if (stage === 'delivery') {
    const finance = (await client.query('SELECT state FROM delivery_loan_requests WHERE id=$1', [body.proofId])).rows[0];
    if (finance?.state === 'active' && time(row.deadline) > Date.now()) return { ok: true, pending: true, workflow: view(row), nextAction: await companyWorkflowNextAction(client, row) };
  }
  return advanceCompanyWorkflow(ch, row.id, body, key, client, h);
}
// Estate caller has already locked the canonical dying character and source assets.
// Terminal metadata carries no custody, money, credentials or action authority to heirs.
export async function closeCompanyWorkflowsAtDeath(client, characterId) {
  await client.query("UPDATE company_workflows SET status='failed' WHERE original_character=$1 AND status='active'", [id(characterId)]);
}
