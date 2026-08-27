// AGENT REFERRAL CASH — the agent recruiter gets a separate, budgeted payout profile while the
// human-eligible recruit keeps the ordinary recruit-side qualification reward.
//
// Break caught: restoring the old blanket agent exclusion, using the human multiplier/milestone
// profile, paying without a reserve, or paying the same causal milestone twice fails this suite.
process.env.STANDING_CACHE_MS = '0';

import assert from 'node:assert';
import { buildServer } from '../src/server.js';
import { maybeQualifyReferral } from '../src/game.js';
import { runLedgerInvariants } from '../src/invariants.js';
import { M4 } from '../src/rules.js';

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

  // Same-origin clusters are held before the recruiter receives value; qualification and the
  // recruit-side reward still commit, so review policy cannot be gamed with retries.
  const clustered = await mk('Clustered Witness', 'Agent Recruiter');
  await pool.query(
    'UPDATE account_persistent SET minted=true, checkins_lifetime=3 WHERE account_id=$1',
    [clustered.accountId],
  );
  await pool.query('UPDATE characters SET respect=1000, lc_crime=40, cash=30000 WHERE id=$1', [clustered.id]);
  await pool.query('UPDATE accounts SET created_ip=$1 WHERE id=$2', ['198.51.100.10', clustered.accountId]);
  const beforeCluster = Number((await meOf(recruiter.token)).cash);
  const clusteredResult = await maybeQualifyReferral(pool, clustered.accountId);
  assert.equal(clusteredResult.agentCash, 0, 'same-origin review hold moves no agent cash');
  assert.equal(Number((await meOf(recruiter.token)).cash), beforeCluster);
  const clusterClaim = (await pool.query(
    'SELECT state, hold_reason FROM agent_referral_claims WHERE recruit_account=$1 AND milestone=$2',
    [clustered.accountId, 'qualified_activation'],
  )).rows[0];
  assert.deepEqual(
    { state: clusterClaim.state, reason: clusterClaim.hold_reason },
    { state: 'held', reason: 'review_same_ip' },
  );

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
    { paid: 1, held: 3, earnedCash: 4000 },
    'the agent can measure paid and held acquisition outcomes',
  );
  assert.equal(capo.cash.budget.configured, true);
  assert.equal(capo.cash.budget.available, false, 'the exhausted claim cap is visible before more recruiting work');
  assert(capo.cash.excluded.includes('raw_signup') && capo.cash.excluded.includes('agent_recruits'));

  console.log('✓ qualified agents receive bounded referral cash; exhausted/reviewed claims hold and agent recruits stay excluded');
} finally {
  await app.close();
}
