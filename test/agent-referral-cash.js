// AGENT REFERRAL CASH — the agent recruiter gets a separate, budgeted payout profile while the
// human-eligible recruit keeps the ordinary recruit-side qualification reward.
//
// Break caught: restoring the old blanket agent exclusion, using the human multiplier/milestone
// profile, paying without a reserve, or paying the same causal milestone twice fails this suite.
process.env.STANDING_CACHE_MS = '0';

import assert from 'node:assert';
import { buildServer } from './server-fixture.js';
import { maybeGrandReferral, maybeQualifyReferral, maybeSparkReferral } from '../src/game.js';
import { migrateReferralOriginHolds } from '../src/db.js';
import { runLedgerInvariants } from '../src/invariants.js';
import { CREW, M4 } from '../src/rules.js';
import { sweepCapoLicense } from '../src/growth.js';

const app = await buildServer();
const pool = app.pool;

const call = async (method, url, { token, body } = {}) => {
  const res = await app.inject({
    method,
    url,
    payload: body,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  return { code: res.statusCode, body: res.json() };
};
const meOf = async (token) => (await call('GET', '/v1/me', { token })).body.character;
const mk = async (name, referralCode) => {
  const { body: { token } } = await call('POST', '/v1/auth/guest');
  const created = await call('POST', '/v1/character', { token, body: { name, referralCode } });
  assert.equal(created.code, 200, `created ${name}`);
  const character = await meOf(token);
  const accountId = (await pool.query('SELECT account_id FROM characters WHERE id=$1', [character.id])).rows[0].account_id;
  return { token, id: character.id, accountId };
};

try {
  // NPCs are public, named characters but never referrers. Both attribution surfaces reject them,
  // and payout revalidation blocks a legacy/manually-corrupted edge before either cash leg.
  await pool.query("INSERT INTO accounts (id, auth_provider, auth_subject) VALUES ('npc-referral-account','npc','npc:referral')");
  await pool.query("INSERT INTO account_persistent (account_id, npc_flag) VALUES ('npc-referral-account',true)");
  await pool.query("INSERT INTO characters (id, account_id, name, season, is_npc) VALUES ('npc-referral-char','npc-referral-account','Public Resident',1,true)");
  const npcAtCreate = await mk('NPC At Create', 'Public Resident');
  assert.equal((await pool.query('SELECT referred_by FROM account_persistent WHERE account_id=$1', [npcAtCreate.accountId])).rows[0].referred_by,
    null, 'character creation refuses an NPC referral code');
  const npcLate = await mk('NPC Late Claim');
  const lateRefusal = await call('POST', '/v1/referral/claim', { token: npcLate.token, body: { code: 'Public Resident' } });
  assert.equal(lateRefusal.code, 400, 'late attribution refuses an NPC referral code');
  assert.equal((await pool.query('SELECT referred_by FROM account_persistent WHERE account_id=$1', [npcLate.accountId])).rows[0].referred_by,
    null, 'NPC late claim cannot persist attribution');
  await pool.query("UPDATE account_persistent SET referred_by='npc-referral-account', minted=true, checkins_lifetime=3 WHERE account_id=$1", [npcLate.accountId]);
  await pool.query("INSERT INTO referrals (recruit_account, recruiter_account) VALUES ($1,'npc-referral-account')", [npcLate.accountId]);
  await pool.query('UPDATE characters SET respect=1000, lc_crime=40, cash=30000 WHERE id=$1', [npcLate.id]);
  const npcRecruitCash = Number((await meOf(npcLate.token)).cash);
  assert.equal(await maybeSparkReferral(pool, npcLate.accountId), null, 'payout defense rejects an NPC spark recruiter');
  assert.equal(await maybeQualifyReferral(pool, npcLate.accountId), null, 'payout defense rejects an NPC full recruiter');
  assert.equal(Number((await meOf(npcLate.token)).cash), npcRecruitCash, 'NPC attribution mints no recruit-side cash');

  // Human referral cash is unavailable to free guest identities, even after every play gate is
  // seeded. Once the recruit becomes permanent, a same-origin pair is terminally latched without
  // cash, recruiter progress, milestone credit, or the qualified respect multiplier.
  const humanSponsor = await mk('Human Sponsor');
  const freeRecruit = await mk('Free Guest Recruit', 'Human Sponsor');
  await pool.query('UPDATE accounts SET created_ip=$1 WHERE id=$2', ['198.51.100.30', humanSponsor.accountId]);
  await pool.query('UPDATE accounts SET created_ip=$1 WHERE id=$2', ['203.0.113.30', freeRecruit.accountId]);
  await pool.query('UPDATE account_persistent SET checkins_lifetime=3 WHERE account_id=$1', [freeRecruit.accountId]);
  await pool.query('UPDATE characters SET respect=1000, lc_crime=40, cash=30000 WHERE id=$1', [freeRecruit.id]);
  const humanSponsorCash = Number((await meOf(humanSponsor.token)).cash);
  const freeRecruitCash = Number((await meOf(freeRecruit.token)).cash);
  assert.equal(await maybeSparkReferral(pool, freeRecruit.accountId), null,
    'an unminted guest cannot open the early referral cash faucet');
  assert.equal(await maybeQualifyReferral(pool, freeRecruit.accountId), null,
    'an unminted guest cannot open full referral cash or benefits');
  assert.deepEqual(
    (await pool.query('SELECT ref_spark, ref_paid FROM account_persistent WHERE account_id=$1', [freeRecruit.accountId])).rows[0],
    { ref_spark: false, ref_paid: false },
    'the paid identity gate waits without consuming either one-time latch',
  );

  await pool.query('UPDATE account_persistent SET minted=true WHERE account_id=$1', [freeRecruit.accountId]);
  await pool.query('UPDATE accounts SET created_ip=$1 WHERE id=$2', ['198.51.100.30', freeRecruit.accountId]);
  assert.deepEqual(await maybeSparkReferral(pool, freeRecruit.accountId),
    { sparked: false, blocked: 'same_ip' }, 'same-origin spark is terminally blocked before value moves');
  assert.equal(await maybeQualifyReferral(pool, freeRecruit.accountId), null,
    'the durable hold closes the full path after the spark path detects the pair');
  assert.equal(await maybeSparkReferral(pool, freeRecruit.accountId), null, 'blocked spark replay is a no-op');
  assert.equal(await maybeQualifyReferral(pool, freeRecruit.accountId), null, 'blocked qualification replay is a no-op');
  assert.equal(Number((await meOf(humanSponsor.token)).cash), humanSponsorCash, 'same-origin sponsor receives no cash');
  assert.equal(Number((await meOf(freeRecruit.token)).cash), freeRecruitCash, 'same-origin recruit receives no cash');
  assert.deepEqual(
    (await pool.query('SELECT ref_spark, ref_paid, referral_same_ip_hold FROM account_persistent WHERE account_id=$1', [freeRecruit.accountId])).rows[0],
    { ref_spark: false, ref_paid: false, referral_same_ip_hold: true },
    'review state closes retries without falsifying either paid latch',
  );
  assert.equal(Number((await pool.query(
    "SELECT COUNT(*) n FROM transactions WHERE (character_id=$1 OR character_id=$2) AND reason LIKE 'referral:%'",
    [humanSponsor.id, freeRecruit.id],
  )).rows[0].n), 0, 'same-origin refusal writes no referral cash ledger rows');
  assert.equal(Number((await pool.query('SELECT recruits FROM account_persistent WHERE account_id=$1', [humanSponsor.accountId])).rows[0].recruits),
    0, 'same-origin refusal cannot advance recruiter milestones');
  assert.equal((await pool.query('SELECT qualified_at FROM referrals WHERE recruit_account=$1', [freeRecruit.accountId])).rows[0].qualified_at,
    null, 'same-origin refusal cannot enable the live respect multiplier');
  assert.equal(Number((await pool.query(
    "SELECT COUNT(*) n FROM telemetry WHERE account_id=$1 AND event='referral_same_ip_flag'",
    [freeRecruit.accountId],
  )).rows[0].n), 1, 'the first detector retains one review event and later paths become no-ops');

  const fullHeld = await mk('Full Gate Held', 'Human Sponsor');
  await pool.query(
    'UPDATE account_persistent SET minted=true, checkins_lifetime=3 WHERE account_id=$1',
    [fullHeld.accountId],
  );
  await pool.query('UPDATE characters SET respect=1000, lc_crime=40, cash=30000 WHERE id=$1', [fullHeld.id]);
  await pool.query('UPDATE accounts SET created_ip=$1 WHERE id=$2', ['198.51.100.30', fullHeld.accountId]);
  assert.deepEqual(await maybeQualifyReferral(pool, fullHeld.accountId),
    { qualified: false, blocked: 'same_ip' }, 'the full path independently installs the same no-value hold');
  assert.deepEqual(
    (await pool.query('SELECT ref_spark, ref_paid, referral_same_ip_hold FROM account_persistent WHERE account_id=$1', [fullHeld.accountId])).rows[0],
    { ref_spark: false, ref_paid: false, referral_same_ip_hold: true },
    'full-path refusal also preserves paid-latch truth');
  await pool.query('UPDATE account_persistent SET agent_flag=true WHERE account_id=$1', [humanSponsor.accountId]);
  await sweepCapoLicense(pool);
  assert.equal(Number((await pool.query(
    'SELECT capo_recruits FROM account_persistent WHERE account_id=$1', [humanSponsor.accountId])).rows[0].capo_recruits),
  0, 'a held human edge cannot later unlock agent rate or wire perks');

  // Startup reconciliation canonicalizes stored spellings but only trusted signup provenance may
  // install a same-origin hold. Legacy/untrusted rows stay unclassified and unpaid (fail closed)
  // until trusted provenance or an explicit review clearance is supplied. FALSE survives every
  // repeat pass so support can clear a verified shared household.
  const untrustedSponsor = await mk('Untrusted Sponsor');
  const untrustedRecruit = await mk('Untrusted Recruit', 'Untrusted Sponsor');
  await pool.query(
    'UPDATE accounts SET created_ip=$1, created_ip_authority=NULL WHERE id IN ($2,$3)',
    ['192.0.2.43', untrustedSponsor.accountId, untrustedRecruit.accountId],
  );
  const legacySponsor = await mk('Legacy Sponsor');
  const legacyRecruit = await mk('Legacy Mapped Recruit', 'Legacy Sponsor');
  await pool.query('UPDATE accounts SET created_ip=$1 WHERE id=$2', ['192.0.2.44', legacySponsor.accountId]);
  await pool.query('UPDATE accounts SET created_ip=$1 WHERE id=$2', ['::ffff:192.0.2.44', legacyRecruit.accountId]);
  const repaired = await migrateReferralOriginHolds(pool);
  assert(repaired.normalized >= 1 && repaired.held >= 1, 'repeatable migration repairs mapped legacy provenance');
  assert.equal((await pool.query(
    'SELECT referral_same_ip_hold FROM account_persistent WHERE account_id=$1',
    [untrustedRecruit.accountId],
  )).rows[0].referral_same_ip_hold, null, 'untrusted legacy provenance cannot create an automatic hold');
  await pool.query(
    'UPDATE account_persistent SET minted=true, checkins_lifetime=3 WHERE account_id=$1',
    [untrustedRecruit.accountId],
  );
  await pool.query('UPDATE characters SET respect=1000, lc_crime=40, cash=30000 WHERE id=$1', [untrustedRecruit.id]);
  assert.deepEqual(await maybeSparkReferral(pool, untrustedRecruit.accountId),
    { sparked: false, blocked: 'origin_unverified' }, 'untrusted provenance denies the early payout');
  assert.deepEqual(await maybeQualifyReferral(pool, untrustedRecruit.accountId),
    { qualified: false, blocked: 'origin_unverified' }, 'untrusted provenance denies the full payout');
  assert.deepEqual((await pool.query(
    'SELECT ref_spark, ref_paid, referral_same_ip_hold FROM account_persistent WHERE account_id=$1',
    [untrustedRecruit.accountId])).rows[0],
  { ref_spark: false, ref_paid: false, referral_same_ip_hold: null },
  'provenance quarantine moves no value and consumes no one-time latch');
  await pool.query('UPDATE account_persistent SET referral_same_ip_hold=false WHERE account_id=$1',
    [untrustedRecruit.accountId]);
  assert.deepEqual(await maybeSparkReferral(pool, untrustedRecruit.accountId), { sparked: true },
    'an explicit review clearance releases an untrusted edge for the spark path');
  assert.deepEqual(await maybeQualifyReferral(pool, untrustedRecruit.accountId),
    { qualified: true, bringOne: false },
  'the same explicit clearance remains eligible at full qualification');
  assert.deepEqual(
    (await pool.query(
      `SELECT a.created_ip, p.referral_same_ip_hold FROM accounts a
       JOIN account_persistent p ON p.account_id=a.id WHERE a.id=$1`, [legacyRecruit.accountId])).rows[0],
    { created_ip: '192.0.2.44', referral_same_ip_hold: true },
    'IPv4 and mapped IPv6 compare as the same origin');
  await pool.query('UPDATE account_persistent SET referral_same_ip_hold=false WHERE account_id=$1', [legacyRecruit.accountId]);
  await migrateReferralOriginHolds(pool);
  assert.equal((await pool.query(
    'SELECT referral_same_ip_hold FROM account_persistent WHERE account_id=$1', [legacyRecruit.accountId])).rows[0].referral_same_ip_hold,
  false, 'manual shared-household clearance survives repeat reconciliation');

  const paidHistorySponsor = await mk('Paid History Sponsor');
  const paidHistoryRecruit = await mk('Paid History Recruit', 'Paid History Sponsor');
  await pool.query('UPDATE accounts SET created_ip_authority=NULL WHERE id IN ($1,$2)',
    [paidHistorySponsor.accountId, paidHistoryRecruit.accountId]);
  await pool.query('UPDATE account_persistent SET ref_paid=true WHERE account_id=$1', [paidHistoryRecruit.accountId]);
  await pool.query('UPDATE referrals SET qualified_at=now() WHERE recruit_account=$1', [paidHistoryRecruit.accountId]);
  await migrateReferralOriginHolds(pool);
  assert.deepEqual((await pool.query(
    'SELECT ref_paid, referral_same_ip_hold FROM account_persistent WHERE account_id=$1',
    [paidHistoryRecruit.accountId])).rows[0],
  { ref_paid: true, referral_same_ip_hold: null },
  'the provenance repair leaves paid historical eligibility and its latch untouched');

  // A historical edge that is later held cannot feed either the live respect multiplier or the
  // profile's qualified totals, even if older code already stamped ref_paid/qualified_at.
  const bonusSponsor = await mk('Bonus Sponsor');
  const bonusRecruit = await mk('Held Bonus Recruit', 'Bonus Sponsor');
  await pool.query('UPDATE characters SET respect=2500 WHERE id=$1', [bonusRecruit.id]);
  await pool.query('UPDATE account_persistent SET ref_paid=true, referral_same_ip_hold=true WHERE account_id=$1', [bonusRecruit.accountId]);
  await pool.query('UPDATE referrals SET qualified_at=now() WHERE recruit_account=$1', [bonusRecruit.accountId]);
  assert.equal((await meOf(bonusSponsor.token)).crewBonusPct, 0,
    'held historical qualification contributes no live respect multiplier');
  const heldProfile = (await call('GET', '/v1/profile', { token: bonusSponsor.token })).body;
  const heldCard = heldProfile.recruits.find((entry) => entry.name === 'Held Bonus Recruit');
  assert(heldCard?.held && !heldCard.qualified && heldProfile.crewBonusPct === 0,
    'profile exposes the hold and excludes it from qualification and crew bonus');
  await pool.query('UPDATE account_persistent SET referral_same_ip_hold=false WHERE account_id=$1', [bonusRecruit.accountId]);
  assert((await meOf(bonusSponsor.token)).crewBonusPct > 0,
    'explicit clearance restores the already-qualified respect benefit');

  // Tier two re-checks both value-bearing links under lock. Either held middle or held bottom must
  // keep the finder's-fee latch and ledger untouched; clearing both permits exactly one payment.
  const grand = await mk('Hold Grand');
  const middle = await mk('Hold Middle', 'Hold Grand');
  const bottom = await mk('Hold Bottom', 'Hold Middle');
  await pool.query('UPDATE account_persistent SET ref_paid=true, referral_same_ip_hold=true WHERE account_id=$1', [middle.accountId]);
  await pool.query('UPDATE account_persistent SET ref_paid=true, referral_same_ip_hold=false WHERE account_id=$1', [bottom.accountId]);
  await pool.query('UPDATE referrals SET qualified_at=now() WHERE recruit_account IN ($1,$2)', [middle.accountId, bottom.accountId]);
  const grandBefore = Number((await meOf(grand.token)).cash);
  assert.equal(await maybeGrandReferral(pool, bottom.accountId), null, 'held middle link blocks tier-two cash');
  await pool.query('UPDATE account_persistent SET referral_same_ip_hold=false WHERE account_id=$1', [middle.accountId]);
  await pool.query('UPDATE account_persistent SET referral_same_ip_hold=true WHERE account_id=$1', [bottom.accountId]);
  assert.equal(await maybeGrandReferral(pool, bottom.accountId), null, 'held bottom link blocks tier-two cash');
  assert.equal(Number((await meOf(grand.token)).cash), grandBefore, 'neither held position moves cash');
  assert.equal((await pool.query('SELECT ref_l2_paid FROM account_persistent WHERE account_id=$1', [bottom.accountId])).rows[0].ref_l2_paid,
    false, 'held tier-two attempts do not consume the paid latch');
  await pool.query('UPDATE account_persistent SET referral_same_ip_hold=false WHERE account_id=$1', [bottom.accountId]);
  assert.deepEqual(await maybeGrandReferral(pool, bottom.accountId), { tier2: true, amt: M4.REF_TIER2_CASH },
    'cleared eligible chain pays once');
  assert.equal(await maybeGrandReferral(pool, bottom.accountId), null, 'tier-two payment remains idempotent');

  // Capo eligibility runs before the full referral gate. Screen trusted signup origins here so a
  // minted, levelled, active same-origin alt cannot unlock rate or wire perks without review.
  const capoOriginAgent = await mk('Capo Origin Agent');
  await pool.query('UPDATE account_persistent SET agent_flag=true WHERE account_id=$1', [capoOriginAgent.accountId]);
  await pool.query('UPDATE accounts SET created_ip=$1 WHERE id=$2', ['198.51.100.70', capoOriginAgent.accountId]);
  const seedCapoRecruit = async (name, ip, { npc = false } = {}) => {
    const candidate = await mk(name, 'Capo Origin Agent');
    await pool.query('UPDATE account_persistent SET minted=true, npc_flag=$2 WHERE account_id=$1',
      [candidate.accountId, npc]);
    await pool.query('UPDATE characters SET respect=600, is_npc=$2 WHERE id=$1', [candidate.id, npc]);
    await pool.query('UPDATE accounts SET created_ip=$1 WHERE id=$2', [ip, candidate.accountId]);
    await pool.query('INSERT INTO telemetry (id, account_id, event) VALUES ($1,$2,$3)',
      [globalThis.crypto.randomUUID(), candidate.accountId, 'checkin']);
    return candidate;
  };
  const sameOriginCapo = await seedCapoRecruit('Capo Same Origin', '198.51.100.70');
  await sweepCapoLicense(pool);
  assert.equal(Number((await pool.query(
    'SELECT capo_recruits FROM account_persistent WHERE account_id=$1',
    [capoOriginAgent.accountId],
  )).rows[0].capo_recruits), 0,
  'a trusted same-origin recruit cannot earn Capo credit before referral qualification detects it');

  await pool.query('UPDATE account_persistent SET referral_same_ip_hold=false WHERE account_id=$1',
    [sameOriginCapo.accountId]);
  await sweepCapoLicense(pool);
  assert.equal(Number((await pool.query(
    'SELECT capo_recruits FROM account_persistent WHERE account_id=$1',
    [capoOriginAgent.accountId],
  )).rows[0].capo_recruits), 1, 'explicit shared-household clearance permits Capo credit');

  await seedCapoRecruit('Capo Distinct Origin', '203.0.113.71');
  await sweepCapoLicense(pool);
  assert.equal(Number((await pool.query(
    'SELECT capo_recruits FROM account_persistent WHERE account_id=$1',
    [capoOriginAgent.accountId],
  )).rows[0].capo_recruits), 2, 'a trusted distinct-origin human recruit earns Capo credit');

  const untrustedCapo = await seedCapoRecruit('Capo Untrusted Origin', '203.0.113.73');
  await pool.query('UPDATE accounts SET created_ip_authority=NULL WHERE id=$1', [untrustedCapo.accountId]);
  await sweepCapoLicense(pool);
  assert.equal(Number((await pool.query(
    'SELECT capo_recruits FROM account_persistent WHERE account_id=$1',
    [capoOriginAgent.accountId],
  )).rows[0].capo_recruits), 2, 'an untrusted legacy edge cannot unlock Capo value');

  const paidLegacyCapo = await seedCapoRecruit('Capo Paid Legacy', '203.0.113.74');
  await pool.query('UPDATE accounts SET created_ip_authority=NULL WHERE id=$1', [paidLegacyCapo.accountId]);
  await pool.query('UPDATE account_persistent SET ref_paid=true WHERE account_id=$1', [paidLegacyCapo.accountId]);
  await sweepCapoLicense(pool);
  assert.equal(Number((await pool.query(
    'SELECT capo_recruits FROM account_persistent WHERE account_id=$1',
    [capoOriginAgent.accountId],
  )).rows[0].capo_recruits), 3, 'paid legacy history keeps its existing Capo eligibility');

  await pool.query("UPDATE accounts SET created_ip_authority='direct_socket_v1' WHERE id=$1", [untrustedCapo.accountId]);
  await sweepCapoLicense(pool);
  assert.equal(Number((await pool.query(
    'SELECT capo_recruits FROM account_persistent WHERE account_id=$1',
    [capoOriginAgent.accountId],
  )).rows[0].capo_recruits), 4, 'trusted distinct provenance releases Capo credit');

  await seedCapoRecruit('Capo NPC Recruit', '203.0.113.72', { npc: true });
  await sweepCapoLicense(pool);
  assert.equal(Number((await pool.query(
    'SELECT capo_recruits FROM account_persistent WHERE account_id=$1',
    [capoOriginAgent.accountId],
  )).rows[0].capo_recruits), 4, 'a minted, levelled, retained NPC never earns Capo credit');

  const recruiter = await mk('Agent Recruiter');
  await pool.query('UPDATE account_persistent SET agent_flag=true WHERE account_id=$1', [recruiter.accountId]);
  const recruit = await mk('Human Witness', 'Agent Recruiter');
  await pool.query(
    'UPDATE account_persistent SET minted=true, checkins_lifetime=3 WHERE account_id=$1',
    [recruit.accountId],
  );
  await pool.query(
    'UPDATE characters SET respect=1000, lc_crime=40, cash=30000 WHERE id=$1',
    [recruit.id],
  );
  // A same-origin pair is review-held in the agent profile. Use distinct fixture IPs to exercise the
  // paid path; the hold behavior gets its own mutation guard below.
  await pool.query('UPDATE accounts SET created_ip=$1 WHERE id=$2', ['198.51.100.10', recruiter.accountId]);
  await pool.query('UPDATE accounts SET created_ip=$1 WHERE id=$2', ['203.0.113.20', recruit.accountId]);
  await pool.query(
    `INSERT INTO agent_acquisition_budgets
       (id, campaign_id, epoch_key, liability_cap, reserved, paid, qualified_cash,
        retained_cash, max_recruits, qualified_claims_paid, retained_claims_paid, active, expires_at)
     VALUES ($1,$2,$3,$4,$5,0,$6,$7,$8,0,0,true,now() + interval '30 days')`,
    ['test-budget', 'organic', 'test-epoch', 24000, 24000, 4000, 8000, 2],
  );

  const recruiterCashBefore = Number((await meOf(recruiter.token)).cash);
  const recruitCashBefore = Number((await meOf(recruit.token)).cash);
  const qualified = await maybeQualifyReferral(pool, recruit.accountId);
  assert.deepEqual(
    qualified,
    { qualified: true, bringOne: false, recruiterProfile: 'agent', agentCash: 4000 },
    'the result identifies the separately budgeted agent profile',
  );
  assert.equal(
    Number((await meOf(recruiter.token)).cash),
    recruiterCashBefore + 4000,
    'the agent receives the budgeted amount, not the human recruiter profile',
  );
  assert.equal(
    Number((await meOf(recruit.token)).cash),
    recruitCashBefore + M4.REF_RECRUIT_CASH,
    'the recruited human retains the ordinary recruit-side qualification reward',
  );

  const claim = (await pool.query(
    'SELECT * FROM agent_referral_claims WHERE recruit_account=$1 AND milestone=$2',
    [recruit.accountId, 'qualified_activation'],
  )).rows[0];
  assert(claim, 'the direct recruiter/recruit milestone has a durable claim');
  assert.equal(claim.recruiter_account, recruiter.accountId);
  assert.equal(claim.state, 'paid');
  assert.equal(Number(claim.amount), 4000);
  assert.equal(claim.qualifier_version, 'agent_human_v1');
  assert.equal(
    Number((await pool.query('SELECT paid FROM agent_acquisition_budgets WHERE id=$1', ['test-budget'])).rows[0].paid),
    4000,
    'paid liability is consumed from the explicit campaign/epoch reserve',
  );
  assert.equal(
    Number((await pool.query(
      "SELECT COUNT(*) n FROM transactions WHERE character_id=$1 AND reason='referral:agent_qualified'",
      [recruiter.id],
    )).rows[0].n),
    1,
    'the agent payout has its own closed ledger reason',
  );

  assert.equal(await maybeQualifyReferral(pool, recruit.accountId), null, 'the milestone is idempotent');
  assert.equal(
    Number((await pool.query(
      'SELECT COUNT(*) n FROM agent_referral_claims WHERE recruit_account=$1 AND milestone=$2',
      [recruit.accountId, 'qualified_activation'],
    )).rows[0].n),
    1,
    'one recruit cannot create a duplicate agent claim',
  );

  // Budget exhaustion cannot take the human recruit's ordinary reward, and cannot fall through to
  // the much larger human recruiter/milestone profile.
  await pool.query('UPDATE agent_acquisition_budgets SET max_recruits=1 WHERE id=$1', ['test-budget']);
  const overflow = await mk('Budget Witness', 'Agent Recruiter');
  await pool.query(
    'UPDATE account_persistent SET minted=true, checkins_lifetime=3 WHERE account_id=$1',
    [overflow.accountId],
  );
  await pool.query('UPDATE characters SET respect=1000, lc_crime=40, cash=30000 WHERE id=$1', [overflow.id]);
  await pool.query('UPDATE accounts SET created_ip=$1 WHERE id=$2', ['203.0.113.21', overflow.accountId]);
  const agentBeforeOverflow = Number((await meOf(recruiter.token)).cash);
  const overflowBefore = Number((await meOf(overflow.token)).cash);
  assert.deepEqual(
    await maybeQualifyReferral(pool, overflow.accountId),
    { qualified: true, bringOne: false, recruiterProfile: 'agent', agentCash: 0 },
    'qualification survives a spent budget without inventing agent cash',
  );
  assert.equal(Number((await meOf(recruiter.token)).cash), agentBeforeOverflow, 'spent budget pays the agent nothing');
  assert.equal(Number((await meOf(overflow.token)).cash), overflowBefore + M4.REF_RECRUIT_CASH,
    'budget exhaustion does not confiscate the human recruit reward');
  const overflowClaim = (await pool.query(
    'SELECT state, hold_reason, amount FROM agent_referral_claims WHERE recruit_account=$1 AND milestone=$2',
    [overflow.accountId, 'qualified_activation'],
  )).rows[0];
  assert.equal(overflowClaim.state, 'held');
  assert.equal(overflowClaim.hold_reason, 'budget_exhausted');
  assert.equal(Number(overflowClaim.amount), 0);

  // A manually provisioned row cannot bypass the compiler's full-liability rule: the reserve has
  // to cover both configured milestones for every admitted recruit, not merely today's first claim.
  await pool.query('UPDATE agent_acquisition_budgets SET active=false WHERE id=$1', ['test-budget']);
  await pool.query(
    `INSERT INTO agent_acquisition_budgets
       (id, campaign_id, epoch_key, liability_cap, reserved, paid, qualified_cash,
        retained_cash, max_recruits, qualified_claims_paid, retained_claims_paid, active, expires_at)
     VALUES ($1,$2,$3,$4,$5,0,$6,$7,$8,0,0,true,now() + interval '30 days')`,
    ['invalid-budget', 'organic', 'bad-epoch', 4000, 4000, 4000, 8000, 1],
  );
  const invalidBudgetRecruit = await mk('Invalid Budget Witness', 'Agent Recruiter');
  await pool.query(
    'UPDATE account_persistent SET minted=true, checkins_lifetime=3 WHERE account_id=$1',
    [invalidBudgetRecruit.accountId],
  );
  await pool.query(
    'UPDATE characters SET respect=1000, lc_crime=40, cash=30000 WHERE id=$1',
    [invalidBudgetRecruit.id],
  );
  await pool.query('UPDATE accounts SET created_ip=$1 WHERE id=$2', ['203.0.113.22', invalidBudgetRecruit.accountId]);
  const invalidBudgetResult = await maybeQualifyReferral(pool, invalidBudgetRecruit.accountId);
  assert.equal(invalidBudgetResult.agentCash, 0, 'an under-reserved budget cannot pay its first milestone');
  assert.equal((await pool.query(
    'SELECT hold_reason FROM agent_referral_claims WHERE recruit_account=$1 AND milestone=$2',
    [invalidBudgetRecruit.accountId, 'qualified_activation'],
  )).rows[0].hold_reason, 'budget_invalid');
  // Repair the fixture so the global invariant below proves the post-test state is internally valid.
  await pool.query(
    'UPDATE agent_acquisition_budgets SET liability_cap=12000, reserved=12000 WHERE id=$1',
    ['invalid-budget'],
  );
  await pool.query('UPDATE agent_acquisition_budgets SET active=false WHERE id=$1', ['invalid-budget']);
  await pool.query('UPDATE agent_acquisition_budgets SET active=true WHERE id=$1', ['test-budget']);

  // A disclosed agent recruit can never masquerade as the human-eligible side of the graph.
  const botRecruit = await mk('Agent Recruit', 'Agent Recruiter');
  await pool.query(
    'UPDATE account_persistent SET agent_flag=true, minted=true, checkins_lifetime=3 WHERE account_id=$1',
    [botRecruit.accountId],
  );
  await pool.query('UPDATE characters SET respect=1000, lc_crime=40, cash=30000 WHERE id=$1', [botRecruit.id]);
  assert.equal(await maybeQualifyReferral(pool, botRecruit.accountId), null, 'agent recruits remain ineligible');
  assert.equal(Number((await pool.query(
    'SELECT COUNT(*) n FROM agent_referral_claims WHERE recruit_account=$1',
    [botRecruit.accountId],
  )).rows[0].n), 0, 'an agent recruit creates no cash claim');

  // Same-origin clusters are held before any referral value moves. The fixture shares a crew so the
  // Bring One path is armed too; concurrent/repeated attempts must still create one review record and
  // zero cash, progress, latches, crew bonus or Capo credit. Explicit clearance then settles once.
  const clustered = await mk('Clustered Witness', 'Agent Recruiter');
  await pool.query(
    'UPDATE account_persistent SET minted=true, checkins_lifetime=3 WHERE account_id=$1',
    [clustered.accountId],
  );
  await pool.query('UPDATE characters SET respect=1000, lc_crime=40, cash=30000 WHERE id=$1', [clustered.id]);
  await pool.query('UPDATE accounts SET created_ip=$1 WHERE id=$2', ['198.51.100.10', clustered.accountId]);
  await pool.query("INSERT INTO crews (id,name,leader_account) VALUES ('cluster-crew','Cluster Crew',$1)", [recruiter.accountId]);
  await pool.query(
    "INSERT INTO crew_members (crew_id,account_id,name) VALUES ('cluster-crew',$1,'Agent Recruiter'),('cluster-crew',$2,'Clustered Witness')",
    [recruiter.accountId, clustered.accountId],
  );
  await pool.query("INSERT INTO gangs (id,name,tag) VALUES ('cluster-family','Cluster Family','CLST')");
  await pool.query("INSERT INTO gang_members (gang_id,character_id) VALUES ('cluster-family',$1)", [recruiter.id]);
  const beforeClusterRecruiter = Number((await meOf(recruiter.token)).cash);
  const beforeClusterRecruit = Number((await meOf(clustered.token)).cash);
  const beforeClusterRecruits = Number((await pool.query(
    'SELECT recruits FROM account_persistent WHERE account_id=$1', [recruiter.accountId],
  )).rows[0].recruits);
  const beforeFamily = (await pool.query(
    "SELECT weekly_week, weekly_progress, weekly_done FROM gangs WHERE id='cluster-family'",
  )).rows[0];
  const beforeClusterLedgers = Number((await pool.query(
    `SELECT COUNT(*) n FROM transactions
      WHERE (character_id=$1 OR character_id=$2)
        AND reason IN ('referral:agent_qualified','referral:recruit','crew:bringone')`,
    [recruiter.id, clustered.id],
  )).rows[0].n);
  const clusteredResults = await Promise.all([
    maybeQualifyReferral(pool, clustered.accountId),
    maybeQualifyReferral(pool, clustered.accountId),
  ]);
  assert(clusteredResults.some((result) => result?.blocked === 'same_ip'),
    'one concurrent attempt installs the same-origin hold');
  assert(clusteredResults.every((result) => result === null || result?.blocked === 'same_ip'),
    'concurrent same-origin attempts return no qualified result');
  assert.equal(Number((await meOf(recruiter.token)).cash), beforeClusterRecruiter,
    'same-origin review hold moves no agent cash');
  assert.equal(Number((await meOf(clustered.token)).cash), beforeClusterRecruit,
    'same-origin review hold moves no recruit or Bring One cash');
  const clusterClaim = (await pool.query(
    'SELECT state, hold_reason FROM agent_referral_claims WHERE recruit_account=$1 AND milestone=$2',
    [clustered.accountId, 'qualified_activation'],
  )).rows[0];
  assert.deepEqual(
    { state: clusterClaim.state, reason: clusterClaim.hold_reason },
    { state: 'held', reason: 'review_same_ip' },
  );
  assert.deepEqual((await pool.query(
    'SELECT ref_paid, referral_same_ip_hold FROM account_persistent WHERE account_id=$1',
    [clustered.accountId],
  )).rows[0], { ref_paid: false, referral_same_ip_hold: true },
  'same-origin review keeps qualification false and the dedicated hold true');
  assert.equal((await pool.query(
    'SELECT qualified_at FROM referrals WHERE recruit_account=$1', [clustered.accountId],
  )).rows[0].qualified_at, null, 'same-origin review cannot enable the live crew multiplier');
  assert.equal(Number((await pool.query(
    'SELECT recruits FROM account_persistent WHERE account_id=$1', [recruiter.accountId],
  )).rows[0].recruits), beforeClusterRecruits, 'same-origin review cannot advance recruiter progress');
  assert.deepEqual((await pool.query(
    "SELECT weekly_week, weekly_progress, weekly_done FROM gangs WHERE id='cluster-family'",
  )).rows[0], beforeFamily, 'same-origin review cannot advance family weekly progress');
  assert.equal(Number((await pool.query(
    `SELECT COUNT(*) n FROM transactions
      WHERE (character_id=$1 OR character_id=$2)
        AND reason IN ('referral:agent_qualified','referral:recruit','crew:bringone')`,
    [recruiter.id, clustered.id],
  )).rows[0].n), beforeClusterLedgers, 'same-origin review writes no referral or Bring One ledger rows');
  assert.equal(Number((await pool.query(
    "SELECT COUNT(*) n FROM agent_referral_claims WHERE recruit_account=$1 AND milestone='qualified_activation'",
    [clustered.accountId],
  )).rows[0].n), 1, 'concurrent review retries retain exactly one held claim');
  await pool.query(
    'UPDATE account_persistent SET minted=false WHERE referred_by=$1 AND account_id<>$2',
    [recruiter.accountId, clustered.accountId],
  );
  await sweepCapoLicense(pool);
  assert.equal(Number((await pool.query(
    'SELECT capo_recruits FROM account_persistent WHERE account_id=$1', [recruiter.accountId])).rows[0].capo_recruits),
  0, 'a same-origin agent review hold cannot unlock Capo rate or wire perks');

  await pool.query('UPDATE agent_acquisition_budgets SET max_recruits=2 WHERE id=$1', ['test-budget']);
  await pool.query('UPDATE account_persistent SET referral_same_ip_hold=false WHERE account_id=$1', [clustered.accountId]);
  assert.deepEqual(await maybeQualifyReferral(pool, clustered.accountId),
    { qualified: true, bringOne: true, recruiterProfile: 'agent', agentCash: 4000 },
    'explicit household clearance releases the held agent claim and qualification atomically');
  assert.equal(await maybeQualifyReferral(pool, clustered.accountId), null,
    'cleared qualification remains exactly once');
  assert.equal(Number((await meOf(recruiter.token)).cash), beforeClusterRecruiter + 4000,
    'clearance pays the budgeted agent leg exactly once');
  assert.equal(Number((await meOf(clustered.token)).cash),
    beforeClusterRecruit + M4.REF_RECRUIT_CASH + CREW.BRING_ONE.RECRUIT_CASH,
    'clearance pays the recruit and Bring One legs exactly once');
  assert.deepEqual((await pool.query(
    "SELECT state, hold_reason, amount FROM agent_referral_claims WHERE recruit_account=$1 AND milestone='qualified_activation'",
    [clustered.accountId],
  )).rows[0], { state: 'paid', hold_reason: null, amount: 4000 },
  'clearance replaces the review hold with one paid campaign claim');
  await sweepCapoLicense(pool);
  assert.equal(Number((await pool.query(
    'SELECT capo_recruits FROM account_persistent WHERE account_id=$1', [recruiter.accountId])).rows[0].capo_recruits),
  1, 'the explicitly cleared qualified edge can unlock Capo credit');

  const invariantChecks = (await runLedgerInvariants(pool, { alert: false })).checks;
  assert.equal(
    invariantChecks.find((check) => check.name === 'agent acquisition budget accounting')?.ok,
    true,
    'budget paid/claims/reserve/max liability reconcile',
  );
  assert.equal(
    invariantChecks.find((check) => check.name === 'agent referral claim ledger')?.ok,
    true,
    'paid claims reconcile to their dedicated ledger rows',
  );

  const capo = (await call('GET', '/v1/capo', { token: recruiter.token })).body;
  assert.equal(capo.cash.eligible, true, 'the agent-facing Capo board promotes cash eligibility');
  assert.equal(capo.cash.profile, 'agent_human_v1');
  assert.equal(capo.cash.directOnly, true);
  assert.equal(capo.cash.qualifiedCash, 4000, 'the board discloses the active campaign amount');
  assert.deepEqual(
    capo.cash.claims,
    { paid: 2, held: 2, earnedCash: 8000 },
    'the agent can measure paid and held acquisition outcomes',
  );
  assert.equal(capo.cash.budget.configured, true);
  assert.equal(capo.cash.budget.available, false, 'the exhausted claim cap is visible before more recruiting work');
  assert(capo.cash.excluded.includes('raw_signup') && capo.cash.excluded.includes('agent_recruits'));

  console.log('✓ qualified agents receive bounded referral cash; exhausted/reviewed claims hold and agent recruits stay excluded');
} finally {
  await app.close();
}
