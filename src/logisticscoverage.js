import crypto from 'node:crypto';
import { GameError } from './game.js';
import { logisticsCoverageTerms, logisticsCoverageBenefit } from './logisticscoverageterms.js';

// Caller holds the canonical sorted character/account locks. Asset order is
// depot -> lease -> policy; recovery never discovers or locks another character.
const fail = (reason, message = 'Coverage authority or evidence changed.') => { const error = new GameError('logistics_coverage', `${reason}: ${message}`); error.reason = reason; throw error; };
const intake = () => { if (process.env.DEPOT_PILOT !== 'on') fail('pilot_disabled'); };
const id = value => { if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) fail('coverage_terms'); return value; };
const whole = (value, min, max) => { if (!Number.isSafeInteger(value) || value < min || value > max) fail('coverage_terms'); return value; };
const cash = value => { if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+(?:\.\d+)?$/.test(value))) fail('coverage_cash'); const n = Number(value); if (!Number.isFinite(n) || n < 0 || n > Number.MAX_SAFE_INTEGER) fail('coverage_cash'); return n; };
const person = ch => { if (!ch?.alive || ch.is_npc || !ch.account_id) fail('coverage_party'); id(ch.id); id(ch.account_id); };
const clock = async client => new Date((await client.query('SELECT clock_timestamp() AS at')).rows[0].at);
function offerTerms(body) {
  if (!body || Object.keys(body).sort().join(',') !== 'cashPerUnit,coveredUnits,expiresAt,leaseId,premiumCash') fail('coverage_terms');
  const result = { leaseId: id(body.leaseId), coveredUnits: whole(body.coveredUnits, 1, 10), cashPerUnit: whole(body.cashPerUnit, 1, 100000),
    premiumCash: whole(body.premiumCash, 0, body.coveredUnits * body.cashPerUnit), expiresAt: body.expiresAt };
  if (typeof result.expiresAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(result.expiresAt)
      || !Number.isFinite(Date.parse(result.expiresAt)) || new Date(result.expiresAt).toISOString() !== result.expiresAt) fail('coverage_terms');
  return result;
}
async function assets(client, leaseId, depotId = null) {
  const hint = (await client.query('SELECT depot_id FROM business_warehouse_leases WHERE id=$1', [id(leaseId)])).rows[0];
  if (!hint || (depotId && hint.depot_id !== depotId)) fail('coverage_lease');
  const depot = (await client.query('SELECT * FROM business_depots WHERE id=$1 FOR UPDATE', [hint.depot_id])).rows[0];
  const lease = (await client.query('SELECT * FROM business_warehouse_leases WHERE id=$1 FOR UPDATE', [leaseId])).rows[0];
  if (!depot || !lease || lease.depot_id !== depot.id) fail('coverage_lease');
  return { depot, lease };
}
async function policyLocked(client, policyId) {
  const hint = (await client.query('SELECT lease_id,depot_id FROM logistics_coverage_policies WHERE id=$1', [id(policyId)])).rows[0];
  if (!hint) fail('coverage_policy');
  const locked = await assets(client, hint.lease_id, hint.depot_id);
  const policy = (await client.query('SELECT * FROM logistics_coverage_policies WHERE id=$1 FOR UPDATE', [policyId])).rows[0];
  if (!policy || policy.lease_id !== locked.lease.id || policy.depot_id !== locked.depot.id) fail('coverage_policy');
  return { ...locked, policy };
}
async function money(ch, amount, reason, client, h) {
  const next = cash(ch.cash) + amount; cash(next);
  await h.ledger(client, { characterId: ch.id, currency: 'cash', amount, reason });
  ch.cash = next;
}
const view = row => ({ id: row.id, state: row.state, leaseId: row.lease_id, insurerCharacterId: row.insurer_character,
  tenantCharacterId: row.tenant_character, offer: row.offer, offerExpiresAt: new Date(row.offer_expires_at).toISOString(),
  coverageExpiresAt: new Date(row.coverage_expires_at).toISOString(), maxBenefitCash: Number(row.max_benefit_cash),
  premiumCash: Number(row.premium_cash), escrowCash: Number(row.escrow_cash), benefitCash: Number(row.benefit_cash),
  refundedCash: Number(row.refunded_cash), receipt: row.receipt });

const response = async (client, policyId, extra = {}) => ({ ok: true, policy: view((await client.query('SELECT * FROM logistics_coverage_policies WHERE id=$1', [policyId])).rows[0]), ...extra });

export async function offerCoverage(insurer, originalTenant, strictOffer, requestKey, client, _h) {
  intake(); person(insurer); person(originalTenant);
  if (insurer.account_id === originalTenant.account_id) fail('coverage_party');
  const offer = offerTerms(strictOffer);
  if (typeof requestKey !== 'string' || requestKey.length < 1 || requestKey.length > 200) fail('coverage_terms');
  const { depot, lease } = await assets(client, offer.leaseId);
  const prior = (await client.query('SELECT * FROM logistics_coverage_policies WHERE insurer_character=$1 AND request_key=$2 FOR UPDATE', [insurer.id, requestKey])).rows[0];
  if (prior) {
    if (prior.tenant_character !== originalTenant.id || JSON.stringify(offerTerms(prior.offer)) !== JSON.stringify(offer)) fail('coverage_request_conflict');
    return response(client, prior.id, { replayed: true });
  }
  const now = await clock(client), end = Date.parse(offer.expiresAt);
  if (lease.tenant_character !== originalTenant.id || lease.status !== 'active' || lease.good_id !== 'gin'
      || Number(lease.held_qty) < offer.coveredUnits || depot.status !== 'open' || end <= +now
      || end > +new Date(lease.expires_at) || end - +now > 86400000) fail('coverage_lease');
  const own = (await client.query("SELECT id FROM logistics_coverage_policies WHERE insurer_character=$1 AND state='offered' AND offer_expires_at>$2", [insurer.id, now])).rows;
  if (own.length >= 3) fail('coverage_offer_limit');
  const policyId = crypto.randomUUID(), max = offer.coveredUnits * offer.cashPerUnit;
  await client.query(`INSERT INTO logistics_coverage_policies(id,lease_id,depot_id,insurer_character,tenant_character,insurer_account,tenant_account,request_key,offer,max_benefit_cash,premium_cash,created_at,offer_expires_at,coverage_expires_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
  [policyId, lease.id, depot.id, insurer.id, originalTenant.id, insurer.account_id, originalTenant.account_id, requestKey, offer, max, offer.premiumCash, now, new Date(Math.min(+now + 300000, end)), new Date(end)]);
  return response(client, policyId);
}
export async function acceptCoverage(originalTenant, originalInsurer, offerId, client, h) {
  person(originalTenant);
  const { depot, lease, policy } = await policyLocked(client, offerId);
  if (policy.tenant_account !== originalTenant.account_id) fail('coverage_party');
  // Stored acceptance is an account receipt, not another funded action. The
  // original insurer may be dead, and recovery must not acquire a peer lock.
  if (policy.accepted_at) return response(client, policy.id, { replayed: true });
  intake(); person(originalInsurer);
  if (policy.tenant_character !== originalTenant.id || policy.insurer_character !== originalInsurer.id
      || policy.tenant_account !== originalTenant.account_id || policy.insurer_account !== originalInsurer.account_id
      || originalTenant.account_id === originalInsurer.account_id) fail('coverage_party');
  const now = await clock(client);
  if (policy.state !== 'offered' || +now >= +new Date(policy.offer_expires_at) || depot.status !== 'open') fail('coverage_offer_expired');
  const max = Number(policy.max_benefit_cash), premium = Number(policy.premium_cash);
  // Reserve must exist BEFORE any premium credit. Fractional pre-existing cash is valid.
  if (cash(originalInsurer.cash) < max || cash(originalTenant.cash) < premium) fail('coverage_cash');
  const accepted = (await client.query('SELECT id FROM logistics_coverage_policies WHERE lease_id=$1 AND accepted_at IS NOT NULL', [lease.id])).rows;
  if (accepted.length) fail('coverage_lease_covered');
  const sequence = Number((await client.query('SELECT MAX(lease_sequence) AS sequence FROM business_depot_journal WHERE lease_id=$1', [lease.id])).rows[0].sequence);
  let terms;
  try { terms = logisticsCoverageTerms({ ...policy.offer, depotId: depot.id, tenantCharacterId: originalTenant.id,
    tenantAccountId: originalTenant.account_id, enrollmentSequence: sequence, enrolledAt: now.toISOString() }, lease, { encumberedCash: max }); }
  catch { fail('coverage_terms'); }
  await money(originalInsurer, -max, `coverage:reserve:${policy.id}`, client, h);
  if (premium) {
    await money(originalTenant, -premium, `coverage:premium:${policy.id}`, client, h);
    await money(originalInsurer, premium, `coverage:premium:${policy.id}`, client, h);
  }
  const result = await client.query("UPDATE logistics_coverage_policies SET state='active',terms=$2,escrow_cash=$3,accepted_at=$4 WHERE id=$1 AND state='offered'", [policy.id, terms, max, now]);
  if (result.rowCount !== 1) fail('coverage_changed');
  return response(client, policy.id);
}
export async function cancelCoverage(currentInsurer, offerId, client, _h) {
  person(currentInsurer); const { policy } = await policyLocked(client, offerId);
  if (policy.insurer_account !== currentInsurer.account_id) fail('coverage_party');
  if (policy.state === 'cancelled') return response(client, policy.id, { replayed: true });
  if (policy.state !== 'offered') fail('coverage_active');
  await client.query("UPDATE logistics_coverage_policies SET state='cancelled' WHERE id=$1 AND state='offered'", [policy.id]);
  return response(client, policy.id);
}
async function classify(client, policy, lease) {
  if (policy.event_id) return { kind: 'covered', benefit: Number(policy.benefit_cash) };
  const rows = (await client.query("SELECT * FROM business_depot_journal WHERE lease_id=$1 AND reason='warehouse_tenant_death' ORDER BY lease_sequence,id", [lease.id])).rows;
  if (!rows.length) return { kind: lease.status === 'tenant_dead' ? 'unknown' : 'none' };
  if (rows.length !== 1) return { kind: 'unknown' };
  const journal = rows[0], at = journal.event_at && +new Date(journal.event_at);
  if (!at || !Number.isFinite(at) || !Number.isSafeInteger(journal.lease_sequence)
      || journal.lease_sequence <= policy.terms.enrollmentSequence) return { kind: 'unknown' };
  // First validate the canonical receipt even when its authoritative event clock
  // falls outside coverage. Invalid evidence cannot be laundered into a refund.
  const zero = value => value === 0 || (typeof value === 'string' && /^0(?:\.0+)?$/.test(value));
  if (lease.status !== 'tenant_dead' || lease.held_qty !== 0 || lease.tenant_character !== policy.tenant_character
      || lease.good_id !== 'gin' || !Number.isSafeInteger(lease.units) || lease.units < 1 || lease.units > 10
      || journal.depot_id !== policy.depot_id
      || journal.customer_character !== policy.tenant_character || journal.lease_stock_after !== 0
      || !Number.isSafeInteger(journal.lease_stock_delta) || journal.lease_stock_delta >= 0
      || journal.lease_stock_delta < -Number(lease.units)
      || ![journal.cash_delta, journal.stock_delta, journal.cost_delta, journal.expense].every(zero)
      || journal.order_id !== null || journal.policy_id !== null || journal.warehouse_rent_lease_id !== null) return { kind: 'unknown' };
  if (at < Date.parse(policy.terms.enrolledAt)) return { kind: 'unknown' };
  if (at >= Date.parse(policy.terms.expiresAt)) return { kind: 'none' };
  let benefit;
  try { benefit = logisticsCoverageBenefit(policy.terms, lease, journal, { encumberedCash: Number(policy.max_benefit_cash) }); }
  catch { return { kind: 'unknown' }; }
  const result = await client.query("UPDATE logistics_coverage_policies SET state='claimable',event_id=$2,event_evidence=$3,benefit_cash=$4 WHERE id=$1 AND state='active' AND event_id IS NULL", [policy.id, journal.id, journal, benefit.benefitCash]);
  if (result.rowCount !== 1) fail('coverage_changed');
  policy.state = 'claimable'; policy.event_id = journal.id; policy.event_evidence = journal; policy.benefit_cash = benefit.benefitCash;
  return { kind: 'covered', benefit: benefit.benefitCash };
}
export async function claimCoverage(currentBeneficiary, policyId, client, h) {
  person(currentBeneficiary); const { policy, lease } = await policyLocked(client, policyId);
  if (policy.tenant_account !== currentBeneficiary.account_id) fail('coverage_party');
  // Receipt belongs to the original account, so a later living successor replays it.
  if (policy.receipt) return response(client, policy.id, { ...policy.receipt, replayed: true });
  if (!policy.accepted_at || !['active', 'claimable'].includes(policy.state)) fail('coverage_no_event');
  const result = await classify(client, policy, lease);
  if (result.kind === 'unknown') fail('coverage_unknown');
  if (result.kind !== 'covered') fail('coverage_no_event');
  if (Number(policy.escrow_cash) < result.benefit) fail('coverage_insolvent');
  const receipt = { policyId: policy.id, journalId: policy.event_id, benefitCash: result.benefit, beneficiaryAccountId: policy.tenant_account };
  const now = await clock(client);
  const updated = await client.query("UPDATE logistics_coverage_policies SET state='paid',escrow_cash=$2,receipt=$3,paid_at=$4 WHERE id=$1 AND state='claimable' AND receipt IS NULL", [policy.id, Number(policy.escrow_cash) - result.benefit, receipt, now]);
  if (updated.rowCount !== 1) fail('coverage_changed');
  await money(currentBeneficiary, result.benefit, `coverage:claim:${policy.id}`, client, h);
  return response(client, policy.id, receipt);
}
export async function refundCoverage(currentInsurerSuccessor, policyId, client, h) {
  person(currentInsurerSuccessor); const { policy, lease } = await policyLocked(client, policyId);
  if (policy.insurer_account !== currentInsurerSuccessor.account_id) fail('coverage_party');
  if (!policy.accepted_at) fail('coverage_unfunded');
  if (!Number(policy.escrow_cash)) return response(client, policy.id, { policyId, refundedCash: Number(policy.refunded_cash), replayed: true });
  const result = await classify(client, policy, lease);
  if (result.kind === 'unknown') fail('coverage_unknown', 'Canonical burn evidence is unknown; all reserve remains held.');
  const now = await clock(client);
  if (result.kind === 'none' && +now < +new Date(policy.coverage_expires_at)) fail('coverage_active');
  const owed = policy.state === 'paid' ? 0 : result.kind === 'covered' ? result.benefit : 0;
  const refund = Number(policy.escrow_cash) - owed;
  if (refund < 0) fail('coverage_insolvent');
  if (!refund) return response(client, policy.id, { policyId, heldCash: owed, refundedCash: Number(policy.refunded_cash) });
  const state = result.kind === 'covered' ? policy.state : 'expired';
  const updated = await client.query('UPDATE logistics_coverage_policies SET state=$2,escrow_cash=$3,refunded_cash=$4 WHERE id=$1 AND escrow_cash=$5', [policy.id, state, owed, Number(policy.refunded_cash) + refund, Number(policy.escrow_cash)]);
  if (updated.rowCount !== 1) fail('coverage_changed');
  await money(currentInsurerSuccessor, refund, `coverage:refund:${policy.id}`, client, h);
  return response(client, policy.id, { policyId, refundCash: refund, heldCash: owed, refundedCash: Number(policy.refunded_cash) + refund });
}
export async function coverageBoard(client, accountId) {
  const rows = (await client.query('SELECT * FROM logistics_coverage_policies WHERE insurer_account=$1 OR tenant_account=$1 ORDER BY created_at,id LIMIT 100', [id(accountId)])).rows;
  return rows.map(view);
}
