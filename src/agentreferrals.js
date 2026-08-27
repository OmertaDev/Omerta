// Agent recruiter cash is intentionally separate from the human referral profile. This module is
// called only inside maybeQualifyReferral's existing sorted two-party transaction and moves no
// character cash itself: it atomically authorizes one amount from an explicit campaign/epoch budget
// and records the unique causal claim. The caller writes the matching character ledger row.

export const AGENT_REFERRAL_QUALIFIER_VERSION = 'agent_human_v1';
export const AGENT_QUALIFIED_MILESTONE = 'qualified_activation';

async function recordHeld(client, {
  recruiterAccountId,
  recruitAccountId,
  campaignId,
  budgetId = null,
  reason,
}) {
  await client.query(
    `INSERT INTO agent_referral_claims
       (recruit_account, milestone, recruiter_account, campaign_id, budget_id,
        qualifier_version, amount, state, hold_reason)
     VALUES ($1,$2,$3,$4,$5,$6,0,'held',$7)
     ON CONFLICT (recruit_account, milestone) DO NOTHING`,
    [recruitAccountId, AGENT_QUALIFIED_MILESTONE, recruiterAccountId, campaignId,
      budgetId, AGENT_REFERRAL_QUALIFIER_VERSION, reason],
  );
  return { amount: 0, state: 'held', holdReason: reason };
}

export async function claimQualifiedAgentReferral(client, {
  recruiterAccountId,
  recruitAccountId,
  campaignId = 'organic',
  reviewHold = false,
}) {
  const existing = (await client.query(
    'SELECT amount, state, hold_reason FROM agent_referral_claims WHERE recruit_account=$1 AND milestone=$2',
    [recruitAccountId, AGENT_QUALIFIED_MILESTONE],
  )).rows[0];
  if (existing) {
    return { amount: 0, state: existing.state, holdReason: existing.hold_reason || null, duplicate: true };
  }

  if (reviewHold) {
    return recordHeld(client, {
      recruiterAccountId,
      recruitAccountId,
      campaignId,
      reason: 'review_same_ip',
    });
  }

  const candidateIds = (await client.query(
    `SELECT id FROM agent_acquisition_budgets
      WHERE campaign_id=$1 AND active=true
        AND (expires_at IS NULL OR expires_at > now())
      ORDER BY created_at, id`,
    [campaignId],
  )).rows.map((row) => row.id);

  let lastBudgetId = null;
  let sawInvalidBudget = false;
  for (const budgetId of candidateIds) {
    const budget = (await client.query(
      'SELECT * FROM agent_acquisition_budgets WHERE id=$1 FOR UPDATE',
      [budgetId],
    )).rows[0];
    lastBudgetId = budgetId;
    if (!budget || !budget.active || (budget.expires_at && new Date(budget.expires_at) <= new Date())) continue;
    const amount = Number(budget.qualified_cash);
    const retainedAmount = Number(budget.retained_cash);
    const paid = Number(budget.paid);
    const reserved = Number(budget.reserved);
    const liabilityCap = Number(budget.liability_cap);
    const reserve = Math.min(reserved, liabilityCap);
    const maxRecruits = Number(budget.max_recruits);
    const claimsPaid = Number(budget.qualified_claims_paid);
    const retainedClaimsPaid = Number(budget.retained_claims_paid);
    const validBudget = [amount, retainedAmount, paid, reserved, liabilityCap,
      maxRecruits, claimsPaid, retainedClaimsPaid].every(Number.isSafeInteger)
      && amount > 0 && retainedAmount >= 0 && paid >= 0
      && reserved > 0 && reserved <= liabilityCap && paid <= reserved
      && maxRecruits > 0 && claimsPaid >= 0 && retainedClaimsPaid >= 0
      && claimsPaid <= maxRecruits && retainedClaimsPaid <= maxRecruits
      && (amount + retainedAmount) * maxRecruits <= reserved;
    if (!validBudget) { sawInvalidBudget = true; continue; }
    if (paid + amount > reserve || claimsPaid >= maxRecruits) continue;

    await client.query(
      `INSERT INTO agent_referral_claims
         (recruit_account, milestone, recruiter_account, campaign_id, budget_id,
          qualifier_version, amount, state, paid_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'paid',now())`,
      [recruitAccountId, AGENT_QUALIFIED_MILESTONE, recruiterAccountId, campaignId,
        budget.id, AGENT_REFERRAL_QUALIFIER_VERSION, amount],
    );
    await client.query(
      `UPDATE agent_acquisition_budgets
          SET paid=paid+$2, qualified_claims_paid=qualified_claims_paid+1
        WHERE id=$1`,
      [budget.id, amount],
    );
    return { amount, state: 'paid', budgetId: budget.id };
  }

  return recordHeld(client, {
    recruiterAccountId,
    recruitAccountId,
    campaignId,
    budgetId: lastBudgetId,
    reason: sawInvalidBudget ? 'budget_invalid'
      : candidateIds.length ? 'budget_exhausted' : 'budget_unavailable',
  });
}
