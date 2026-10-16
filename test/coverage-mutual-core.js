import assert from 'node:assert/strict';
import { prepareCoverageMutualDatabase } from './coverage-mutual-native-env.js';
const native = await prepareCoverageMutualDatabase();
const { makeDb } = await import('../src/db.js'), Mutual = await import('../src/coverage-mutual.js'), E = await import('../src/equipmentinsurance.js');
const { mutualFixture } = await import('./coverage-mutual-fixture.js'), { coverageMutualAccounting } = await import('../src/coverage-mutual-invariants.js');
const pool = await makeDb();
try {
  const f = await mutualFixture(pool);
  // Actual early acceptance changes the second source before its mutual consent.
  const stale = await f.offers(), pending = await f.open(stale), beforePartner = await f.cash('partner');
  await f.tx(c => E.acceptEquipmentInsurance(c, 'insured', { consent: true, itemId: f.itemId, maximumCash: 100,
    offerId: stale.b.offerId, premiumCash: 10 }, 'early-real-partner-policy-accept'));
  const beforeFailedJoin = await f.snapshot(); await assert.rejects(f.join(pending), /policy_not_prospective/);
  assert.deepEqual(await f.snapshot(), beforeFailedJoin); assert.equal(await f.cash('partner'), beforePartner + 10);
  const recovered = await f.tx(c => Mutual.closeCoverageMutual(c, 'insurer', f.closeBody(pending), 'pending-original-capital-recovery'));
  assert.equal(recovered.refunds.length, 1); assert.equal(recovered.refunds[0].amount, 100);
  await f.tx(c => E.closeEquipmentInsurance(c, 'insured', stale.b.offerId, 'close-early-covered-policy'));
  await f.tx(c => E.closeEquipmentInsurance(c, 'insurer', stale.a.offerId, 'close-stale-own-offer')); await f.books();

  const policies = await f.offers(), opened = await f.open(policies);
  const wrong = { ...f.joinBody(opened), contributionCash: 99 };
  await assert.rejects(f.tx(c => Mutual.joinCoverageMutual(c, 'partner', wrong, 'wrong-contribution')), /join_consent/);
  await assert.rejects(f.tx(c => Mutual.claimCoverageMutual(c, 'insurer', f.claimBody(opened, policies.a.offerId), 'unactivated-claim')), /pool_state/);
  if (native) {
    const joined = await Promise.allSettled([f.join(opened), f.join(opened)]);
    assert.equal(joined.filter(x => x.status === 'fulfilled').length, 1);
    assert.equal(joined.filter(x => x.status === 'rejected' && /join_consent/.test(x.reason.message)).length, 1);
    assert.equal(Number((await pool.query('SELECT reserve_cash FROM coverage_mutual_pools WHERE id=$1', [opened.pool.id])).rows[0].reserve_cash), 200);
  } else await f.join(opened);
  await f.books();
  const live = await f.snapshot(); await assert.rejects(f.tx(c => Mutual.closeCoverageMutual(c, 'partner', f.closeBody(opened), 'live-risk-close')), /live_underwriting_obligation/);
  assert.deepEqual(await f.snapshot(), live);
  await assert.rejects(f.tx(c => Mutual.claimCoverageMutual(c, 'insurer', f.claimBody(opened, policies.a.offerId), 'no-synthetic-loss')), /no_net_loss/);
  const actual = await f.actualLoss(policies.a.offerId); await f.books();
  const beforeFault = await f.snapshot();
  await assert.rejects(f.tx(async c => {
    const query = c.query; let hit = false;
    c.query = async function(...args) { const result = await query.apply(this, args);
      if (typeof args[0] === 'string' && args[0].startsWith('INSERT INTO coverage_mutual_requests') && args[1][2] === 'claim') { hit = true; throw Error('actual mutual ACK failure'); } return result; };
    try { await Mutual.claimCoverageMutual(c, 'insurer', f.claimBody(opened, policies.a.offerId), 'actual-after-ACK-rollback'); }
    catch (error) { if (!hit) throw new Error('Failure before actual mutual ACK insert', { cause: error }); throw error; }
    finally { c.query = query; }
  }), /actual mutual ACK failure/);
  assert.deepEqual(await f.snapshot(), beforeFault, 'Whole canonical sources, cash and all mutual rows undo after actual ACK');
  const body = f.claimBody(opened, policies.a.offerId);
  const results = native ? await Promise.all(['actual-mutual-claim','actual-concurrent-mutual-claim'].map(key => f.tx(c => Mutual.claimCoverageMutual(c, 'insurer', body, key))))
    : [await f.tx(c => Mutual.claimCoverageMutual(c, 'insurer', body, 'actual-mutual-claim'))];
  const paid = results[0]; if (native) assert.equal(results.filter(x => x.claim.alreadyPaid === true).length, 1);
  assert.equal(paid.claim.grossPayoutCash, 80); assert.equal(paid.claim.premiumCash, 10); assert.equal(paid.claim.deductibleCash, 5); assert.equal(paid.claim.payoutCash, 65);
  assert((await f.tx(c => Mutual.claimCoverageMutual(c, 'insurer', body, 'actual-mutual-claim'))).replayed);
  assert.equal((await pool.query('SELECT * FROM coverage_mutual_claims')).rows.length, 1); await f.books();
  await assert.rejects(f.tx(c => Mutual.claimCoverageMutual(c, 'partner', body, 'wrong-member-claim')), /member_policy/);
  await f.tx(c => E.closeEquipmentInsurance(c, 'partner', policies.b.offerId, 'partner-own-canonical-offer-close'));
  const closed = await f.tx(c => Mutual.closeCoverageMutual(c, 'partner', f.closeBody(opened), 'actual-mutual-close'));
  assert.equal(closed.refunds.reduce((n, r) => n + r.amount, 0), 135); assert.deepEqual(closed.refunds.map(r => r.amount), [68, 67]);
  assert.equal((await coverageMutualAccounting(pool)).reserve, 0); await f.books();
  assert.equal((await Mutual.coverageMutualBoard(pool, 'unrelated')).pools.length, 0);
  await assert.rejects(f.tx(c => Mutual.openCoverageMutual(c, 'insurer', f.openBody(policies), 'no-retroactive-known-claim')), /policy_not_prospective/);
  console.log('Coverage mutual '+(native?'native':'memory')+' PASS: both actual offered sources rechecked at second consent, own pending100 recovered, real UID/wear/two-steel repair/80gross-10premium-5deductible=65 benefit, whole postACK undo, exactly-once claim, live-risk refusal and135 original-capital refunds.');
} finally { await pool.end(); }
