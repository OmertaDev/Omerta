import assert from 'node:assert/strict';
import { makeDb } from '../src/db.js';
import * as M from '../src/coverage-mutual.js';
import * as E from '../src/equipmentinsurance.js';
import { coverageMutualAccounting } from '../src/coverage-mutual-invariants.js';
import { mutualFixture } from './coverage-mutual-fixture.js';
assert(!process.env.DATABASE_URL && process.argv.length === 2, 'This bounded adversarial fixture owns independent memory databases');

const pool = await makeDb();
try {
  const f = await mutualFixture(pool), policies = await f.offers(), terms = f.openBody(policies);
  for (const body of [null, [], {}, { ...terms, consent: false }, { ...terms, consent: 'true' }, { ...terms, extra: 1 },
    { ...terms, contributionCash: 0 }, { ...terms, contributionCash: 1001 }, { ...terms, contributionCash: 1.5 },
    { ...terms, deductibleCash: 0 }, { ...terms, deductibleCash: 101 }, { ...terms, creatorPolicyId: terms.partnerPolicyId }])
    assert.throws(() => M.coverageMutualTerms('open', body));
  await assert.rejects(M.openCoverageMutual(pool, 'insurer', terms, 'unscoped'));
  const beforeExpiry = await f.snapshot();
  await assert.rejects(f.tx(async c => {
    const query = c.query; let inserted = false, observed = false;
    c.query = async function(...args) {
      const result = await query.apply(this, args);
      if (args[0].startsWith('INSERT INTO coverage_mutual_requests')) inserted = true;
      if (inserted && args[0] === 'SELECT clock_timestamp() AS at') { observed = true; return { rows: [{ at: new Date(Date.now() + 600000) }] }; }
      return result;
    };
    try { await M.openCoverageMutual(c, 'insurer', terms, 'post-ack-expiration'); }
    finally { c.query = query; assert(observed, 'Expiry must be observed after the genuine ACK insert'); }
  }), /invitation_expired/);
  assert.deepEqual(await f.snapshot(), beforeExpiry, 'Fresh post-ACK expiry rolls back actual capital and source ACK');
  const opened = await f.open(policies);
  await assert.rejects(f.open(policies), /funded_position_limit/);
  const thirdOffer = await f.tx(c => E.createEquipmentInsurance(c, 'maintainer', { coverageSeconds: 3600, maximumCash: 100, offerSeconds: 3600, premiumCash: 10, published: true }, 'unsigned-second-inviter-policy'));
  const unsigned = await f.tx(c => M.openCoverageMutual(c, 'maintainer', { ...terms, creatorPolicyId: thirdOffer.offerId }, 'unsigned-second-inviter'));
  assert.deepEqual(await M.coverageMutualDeathCounterparts(pool, 'partner-actor'), [], 'Multiple unsigned invitations create no recipient obligation or death counterpart');
  assert.deepEqual(await M.coverageMutualDeathCounterparts(pool, 'insurer-actor'), [], 'A sole funded pending creator needs no unconsenting recipient lock to recover');
  const contribution = (await pool.query("SELECT contribution_id FROM coverage_mutual_positions WHERE original_character='insurer-actor'")).rows[0].contribution_id;
  const original = Number((await pool.query('SELECT amount FROM transactions WHERE id=$1', [contribution])).rows[0].amount);
  await pool.query('UPDATE transactions SET amount=$2 WHERE id=$1', [contribution, original + 1]);
  assert((await coverageMutualAccounting(pool)).issues.length);
  const tampered = await f.snapshot(); await assert.rejects(f.join(opened), /mutual_history/); assert.deepEqual(await f.snapshot(), tampered);
  await pool.query('UPDATE transactions SET amount=$2 WHERE id=$1', [contribution, original]); await f.books();
  const request = (await pool.query("SELECT account_id,request_key,receipt FROM coverage_mutual_requests WHERE action='open'")).rows[0];
  await pool.query('UPDATE coverage_mutual_requests SET receipt=$3 WHERE account_id=$1 AND request_key=$2',
    [request.account_id, request.request_key, { pool: { ...request.receipt.pool, reserveCash: 999 } }]);
  assert((await coverageMutualAccounting(pool)).issues.some(x => x.reason === 'mutual_open_receipt'));
  const badAck = await f.snapshot(); await assert.rejects(f.join(opened), /mutual_history/); assert.deepEqual(await f.snapshot(), badAck);
  await pool.query('UPDATE coverage_mutual_requests SET receipt=$3 WHERE account_id=$1 AND request_key=$2', [request.account_id, request.request_key, request.receipt]);
  await f.join(opened);
  assert.deepEqual(await M.coverageMutualDeathCounterparts(pool, 'partner-actor'), ['insurer-actor']);
  assert.deepEqual(await M.coverageMutualDeathCounterparts(pool, 'insurer-actor'), ['partner-actor']);
  const beforeSecondConsent = await f.snapshot();
  await assert.rejects(f.tx(c => M.joinCoverageMutual(c, 'partner', f.joinBody(unsigned), 'no-second-funded-obligation')), /funded_position_limit/);
  assert.deepEqual(await f.snapshot(), beforeSecondConsent);
  await f.tx(c => M.closeCoverageMutual(c, 'maintainer', f.closeBody(unsigned), 'unsigned-own-capital-recovery'));
  await f.actualLoss(policies.a.offerId);
  const canonical = (await pool.query('SELECT payout_id FROM equipment_insurance_claims WHERE policy_id=$1', [policies.a.offerId])).rows[0].payout_id;
  const gross = Number((await pool.query('SELECT amount FROM transactions WHERE id=$1', [canonical])).rows[0].amount);
  await pool.query('UPDATE transactions SET amount=$2 WHERE id=$1', [canonical, gross + 1]);
  const wrongGross = await f.snapshot();
  await assert.rejects(f.tx(c => M.claimCoverageMutual(c, 'insurer', f.claimBody(opened, policies.a.offerId), 'tampered-gross')), /canonical_equipment_claim/);
  assert.deepEqual(await f.snapshot(), wrongGross); await pool.query('UPDATE transactions SET amount=$2 WHERE id=$1', [canonical, gross]);
  await f.tx(c => M.claimCoverageMutual(c, 'insurer', f.claimBody(opened, policies.a.offerId), 'verified-once'));
  const once = await f.snapshot(); const duplicate = await f.tx(c => M.claimCoverageMutual(c, 'insurer', f.claimBody(opened, policies.a.offerId), 'verified-different-key'));
  assert.equal(duplicate.claim.alreadyPaid, true); const after = await f.snapshot();
  for (const table of Object.keys(once).filter(x => x !== 'coverage_mutual_requests')) assert.deepEqual(after[table], once[table]);
  await assert.rejects(f.tx(c => M.closeCoverageMutual(c, 'insurer', f.closeBody(opened), 'estate:forged')), /request_key/);
  await assert.rejects(f.tx(c => M.recoverCoverageMutualsAtEstateStart(c, { id: 'insurer-actor', account_id: 'insurer', alive: true },
    { estateResolutionScope: {}, rentalDeathScope: {} })), /estate|scope/i);
  await f.books();
} finally { await pool.end(); }

const relatedPool = await makeDb();
try {
  const f = await mutualFixture(relatedPool), policies = await f.offers();
  const related = await f.tx(c => E.createEquipmentInsurance(c, 'maintainer', { coverageSeconds: 3600, maximumCash: 100, offerSeconds: 3600, premiumCash: 10, published: true }, 'related-maintainer-offer'));
  const opened = await f.tx(c => M.openCoverageMutual(c, 'insurer', { ...f.openBody(policies), partnerCharacterId: 'maintainer-actor', partnerPolicyId: related.offerId }, 'related-open'));
  await f.tx(c => M.joinCoverageMutual(c, 'maintainer', f.joinBody(opened), 'related-join'));
  await f.actualLoss(policies.a.offerId);
  const before = await f.snapshot();
  await assert.rejects(f.tx(c => M.claimCoverageMutual(c, 'insurer', f.claimBody(opened, policies.a.offerId), 'related-provider-excluded')), /no_net_loss/);
  assert.deepEqual(await f.snapshot(), before);
  await f.tx(c => E.closeEquipmentInsurance(c, 'maintainer', related.offerId, 'related-source-resolved'));
  const closed = await f.tx(c => M.closeCoverageMutual(c, 'maintainer', f.closeBody(opened), 'related-capital-recovery'));
  assert.equal(closed.refunds.reduce((n, r) => n + r.amount, 0), 200); assert.equal(closed.settled.length, 0); await f.books();
} finally { await relatedPool.end(); }
console.log('Coverage mutual adversarial memory PASS: closed consent/terms, real post-ACK expiration rollback, source/receipt tampering, genuine canonical payout tampering, duplicate exact-once benefit, forged estate refusal, and actual related maintenance exclusion with full original capital recovery.');
