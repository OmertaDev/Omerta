import { quoteCompute } from './resourceproviders.js';

const PROPOSAL_NAMES = Object.freeze({ bid: 'Bid for funded work', service_price: 'Review service price', customer_follow_up: 'Review customer follow-up', prioritize_delivery: 'Prioritize awarded delivery', hold: 'Hold new work' });
const MAX = Number.MAX_SAFE_INTEGER;
const bounded = (value, name, min = 0, max = MAX) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`Invalid business ${name}`);
  return value;
};
const id = value => typeof value === 'string' && /^[a-zA-Z0-9:_.-]{1,128}$/.test(value);
const items = (value, max = 100) => {
  if (!Array.isArray(value) || value.length > max) throw new Error('Invalid business snapshot list');
  return value;
};
const amount = value => bounded(value ?? 0, 'amount');
const DEFAULTS = Object.freeze({ providerId: null, maxOutputTokens: 256, targetMarginBps: 2500,
  minimumMarginUsdMicros: 10000, operatingCostPerJobUsdMicros: 0, paymentFeeBps: 0, maxActiveJobs: 3, minimumReserveUsdMicros: 0,
  maxProposals: 5, minimumRenewalAcceptedJobs: 2, workSecondsPerJob: 300, planningHorizonSeconds: 3600 });
export function normalizeBusinessPolicy(input = {}) {
  if (!input || Array.isArray(input) || typeof input !== 'object'
      || Object.keys(input).some(key => !Object.hasOwn(DEFAULTS, key))) throw new Error('Invalid business policy');
  const policy = { ...DEFAULTS, ...input };
  if (policy.providerId !== null && !id(policy.providerId)) throw new Error('Invalid business provider');
  bounded(policy.maxOutputTokens, 'output limit', 1, 16384);
  bounded(policy.targetMarginBps, 'target margin', 0, 9000);
  bounded(policy.minimumMarginUsdMicros, 'minimum margin', 0, 1000000000);
  bounded(policy.operatingCostPerJobUsdMicros, 'operating estimate', 0, 1000000000);
  bounded(policy.paymentFeeBps, 'payment fee estimate', 0, 3000);
  if (policy.targetMarginBps + policy.paymentFeeBps >= 10000) throw new Error('Business margin and fee estimates must leave positive cost coverage');
  bounded(policy.maxActiveJobs, 'capacity', 0, 3);
  bounded(policy.minimumReserveUsdMicros, 'reserve', 0, 1000000000000);
  bounded(policy.maxProposals, 'proposal limit', 1, 10);
  bounded(policy.minimumRenewalAcceptedJobs, 'renewal threshold', 1, 100);
  bounded(policy.workSecondsPerJob, 'work duration estimate', 60, 3600);
  bounded(policy.planningHorizonSeconds, 'planning horizon', 60, 86400);
  return policy;
}
function estimatePaymentFee(price, bps) { return Number((BigInt(price) * BigInt(bps) + 99999999n) / 100000000n * 10000n); }
function workSchedule(jobs, active, now, policy) {
  const visibleActive = jobs.filter(job => ['open','claimed','submitted','disputed'].includes(job.state)).length;
  const pending = jobs.filter(job => ['open','claimed'].includes(job.state)).sort((a,b) => Date.parse(a.expiresAt)-Date.parse(b.expiresAt) || a.id.localeCompare(b.id));
  let seconds = 0; const commitments = []; let deadlineRisk = false;
  for (const job of pending) {
    const deadline = Date.parse(job.expiresAt);
    if (!Number.isFinite(deadline) || deadline <= now) { deadlineRisk = true; continue; }
    const start = seconds; seconds += policy.workSecondsPerJob;
    const feasible = now + seconds * 1000 <= deadline;
    if (!feasible) deadlineRisk = true;
    commitments.push({jobId:job.id,plannedStartAt:new Date(now+start*1000).toISOString(),plannedFinishAt:new Date(now+seconds*1000).toISOString(),estimatedSeconds:policy.workSecondsPerJob,feasibleByDeadline:feasible});
  }
  return {commitments,reservedWorkSeconds:seconds,remainingWorkSeconds:Math.max(0,policy.planningHorizonSeconds-seconds),deadlineRisk,activeDetailsIncomplete:visibleActive<active,assumption:'Sequential work using operator duration estimates; not a delivery guarantee'};
}
function metrics(totals = {}) {
  return { settledCustomerRevenueUsdMicros: amount(totals.settledCustomerRevenueUsdMicros),
    settledPaidComputeCostsUsdMicros: amount(totals.settledPaidComputeCostsUsdMicros),
    heldPaidComputeUsdMicros: amount(totals.heldPaidComputeUsdMicros),
    unresolvedPaidCalls: amount(totals.unresolvedPaidCalls), simulatedPaidCalls: amount(totals.simulatedPaidCalls) };
}
export function evaluateBusiness(snapshot, input = {}) {
  const policy = normalizeBusinessPolicy(input);
  if (!snapshot || !id(snapshot.accountId) || snapshot.version !== 1 || snapshot.mode !== 'shadow'
      || !Number.isFinite(Date.parse(snapshot.asOf))) throw new Error('Invalid business snapshot');
  const now = Date.parse(snapshot.asOf), totals = metrics(snapshot.totals);
  const jobs = items(snapshot.jobs), bounties = items(snapshot.bounties), customers = items(snapshot.customers);
  const catalog = items(snapshot.catalog, 32), outcomes = items(snapshot.providerOutcomes, 32);
  const active = amount(snapshot.capacity?.activeJobs);
  const slots = Math.max(0, policy.maxActiveJobs - active);
  const jobEconomics = jobs.map(job => {
    if (!id(job.id) || !['open','claimed','submitted','accepted','disputed','refunded'].includes(job.state)) throw new Error('Invalid business job');
    const revenue = amount(job.settledRevenueUsdMicros), cost = amount(job.settledComputeCostsUsdMicros);
    return { jobId: job.id, state: job.state, settledRevenueUsdMicros: revenue,
      settledComputeCostsUsdMicros: cost, heldComputeUsdMicros: amount(job.heldComputeUsdMicros),
      unresolvedCalls: amount(job.unresolvedCalls), knownContributionUsdMicros: revenue - cost,
      netProfitKnown: false };
  });
  const schedule = workSchedule(jobs, active, now, policy);
  const riskFlags = ['outside_costs_incomplete'];
  if (policy.operatingCostPerJobUsdMicros || policy.paymentFeeBps) riskFlags.push('operator_cost_estimates_unreconciled');
  if (snapshot.resourceMode !== 'live' || totals.simulatedPaidCalls) riskFlags.push('simulation_or_unfunded_data');
  if (totals.unresolvedPaidCalls) riskFlags.push('unresolved_compute_costs');
  if (Object.values(snapshot.coverage || {}).some(value => value === true)) riskFlags.push('incomplete_detail_coverage');
  const entry = catalog.find(row => row.id === policy.providerId);
  let quote = null;
  if (entry && policy.maxOutputTokens <= entry.maxOutputTokens) {
    try { quote = quoteCompute(entry, { inputTokens: entry.maxInputTokens, maxOutputTokens: policy.maxOutputTokens }); }
    catch { riskFlags.push('invalid_compute_quote'); }
  }
  if (quote === null) riskFlags.push('compute_quote_unavailable');
  const knownCostBasis = Math.max(0, ...jobEconomics.map(job => job.settledComputeCostsUsdMicros));
  const costBasis = quote === null ? null : Math.max(quote, knownCostBasis);
  let suggestedPrice = null;
  if (costBasis !== null) {
    const roundingReserve = policy.paymentFeeBps ? 10000n : 0n;
    const cost = BigInt(costBasis) + BigInt(policy.operatingCostPerJobUsdMicros) + roundingReserve;
    const denominator = BigInt(10000 - policy.targetMarginBps - policy.paymentFeeBps);
    const marginPrice = (cost * 10000n + denominator - 1n) / denominator;
    const feeDenominator = BigInt(10000 - policy.paymentFeeBps);
    const floor = ((cost + BigInt(policy.minimumMarginUsdMicros)) * 10000n + feeDenominator - 1n) / feeDenominator;
    const cents = ((marginPrice > floor ? marginPrice : floor) + 9999n) / 10000n * 10000n;
    if (cents >= 10000n && cents <= 1000000000n) suggestedPrice = Number(cents);
    else riskFlags.push('price_outside_market_limit');
  }
  const proposals = [];
  const propose = value => { if (proposals.length >= policy.maxProposals) return false; proposals.push({ ...value, kindName: PROPOSAL_NAMES[value.kind], mode: 'shadow', eligibleToExecute: false }); return true; };
  for (const job of jobs.filter(job => ['open','claimed'].includes(job.state)
    && Number.isFinite(Date.parse(job.expiresAt)) && Date.parse(job.expiresAt) > now && Date.parse(job.expiresAt) <= now + 3600000)
    .sort((a,b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt))) {
    propose({ kind: 'prioritize_delivery', jobId: job.id, reason: 'awarded_job_deadline', requiresOwnerApproval: false });
  }
  if (jobs.some(job => ['open','claimed'].includes(job.state) && Date.parse(job.expiresAt) <= now)) riskFlags.push('expired_jobs_need_recovery');
  const authority = snapshot.policy;
  let available = amount(snapshot.treasury?.availableUsdMicros);
  const reserve = Math.max(policy.minimumReserveUsdMicros, amount(authority?.minimumReserveUsdMicros));
  let daily = authority ? Math.max(0, amount(authority.maxPerDayUsdMicros) - amount(authority.dailyAuthorizedUsdMicros)) : 0;
  const authorityValid = authority?.enabled === true && Number.isFinite(Date.parse(authority.expiresAt))
    && Date.parse(authority.expiresAt) > now && Array.isArray(authority.providers) && authority.providers.includes(policy.providerId)
    && !(entry?.storeResponses && authority.allowStoredResponses !== true);
  if (snapshot.treasury?.frozen) riskFlags.push('treasury_frozen');
  if (!authorityValid) riskFlags.push('owner_authority_unavailable');
  if (!slots) riskFlags.push('capacity_full');
  if (schedule.deadlineRisk) riskFlags.push('awarded_work_deadline_risk');
  if (schedule.activeDetailsIncomplete) riskFlags.push('active_work_details_incomplete');
  if (schedule.remainingWorkSeconds < policy.workSecondsPerJob) riskFlags.push('work_time_capacity_full');
  if (quote !== null && quote > available - reserve) riskFlags.push('compute_funds_insufficient');
  if (quote !== null && quote > daily) riskFlags.push('daily_compute_budget_insufficient');
  const canBid = suggestedPrice !== null && snapshot.service?.enabled === true && id(policy.providerId)
    && Number.isSafeInteger(snapshot.service.revision) && snapshot.service.revision >= 1 && snapshot.service.revision <= 2147483647
    && snapshot.treasury?.frozen === false && authorityValid && quote <= amount(authority?.maxPerCallUsdMicros)
    && totals.unresolvedPaidCalls === 0 && !riskFlags.includes('incomplete_detail_coverage')
    && !schedule.deadlineRisk && !schedule.activeDetailsIncomplete;
  const price = suggestedPrice === null ? null : Math.max(suggestedPrice, amount(snapshot.service?.priceUsdMicros));
  let allocated = 0; let plannedSeconds = schedule.reservedWorkSeconds;
  for (const bounty of [...bounties].sort((a,b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt))) {
    if (!canBid || allocated >= slots || quote > available - reserve || quote > daily
        || plannedSeconds + policy.workSecondsPerJob > policy.planningHorizonSeconds
        || now + (plannedSeconds + policy.workSecondsPerJob)*1000 > Date.parse(authority.expiresAt)) break;
    if (!id(bounty.id) || bounty.buyerAccountId === snapshot.accountId || amount(bounty.budgetUsdMicros) < price
        || !Number.isFinite(Date.parse(bounty.expiresAt)) || Date.parse(bounty.expiresAt) < now + 60000) continue;
    const plannedStartAt = new Date(now+plannedSeconds*1000).toISOString();
    const plannedFinishAt = new Date(now+(plannedSeconds+policy.workSecondsPerJob)*1000).toISOString();
    if (!propose({ kind: 'bid', bountyId: bounty.id, priceUsdMicros: price, expectedServiceRevision: snapshot.service.revision, providerId: policy.providerId, maxOutputTokens: policy.maxOutputTokens, computeReserveUsdMicros: quote,
      expectedKnownMarginUsdMicros: price - quote, estimatedPaymentFeeUsdMicros: estimatePaymentFee(price, policy.paymentFeeBps),
      estimatedContributionUsdMicros: price - costBasis - policy.operatingCostPerJobUsdMicros - estimatePaymentFee(price, policy.paymentFeeBps), deliverySeconds: Math.max(3600,plannedSeconds+policy.workSecondsPerJob), plannedStartAt, plannedFinishAt, estimatedWorkSeconds:policy.workSecondsPerJob, reason: 'funded_capacity_and_target_margin', requiresOwnerApproval: true })) break;
    allocated++; plannedSeconds += policy.workSecondsPerJob; available -= quote; daily -= quote;
  }
  if (suggestedPrice !== null && snapshot.service?.enabled === true && suggestedPrice !== snapshot.service.priceUsdMicros) {
    propose({ kind: 'service_price', priceUsdMicros: suggestedPrice, expectedServiceRevision: snapshot.service.revision, reason: 'conservative_cost_and_margin', requiresOwnerApproval: true });
  }
  for (const customer of customers) {
    if (id(customer.buyerAccountId) && amount(customer.acceptedJobs) >= policy.minimumRenewalAcceptedJobs && slots > allocated)
      propose({ kind: 'customer_follow_up', buyerAccountId: customer.buyerAccountId, acceptedJobs: customer.acceptedJobs,
        reason: 'repeat_accepted_work', requiresOwnerApproval: true });
  }
  if (!proposals.length) propose({ kind: 'hold', reason: quote === null ? 'compute_quote_unavailable' : 'no_safe_work_capacity', requiresOwnerApproval: false });
  const providerOutcomes = outcomes.filter(row => id(row.providerId)).map(row => ({ providerId: row.providerId,
    settledCallCount: amount(row.settledCallCount), failedCallCount: amount(row.failedCallCount), unknownCallCount: amount(row.unknownCallCount),
    costUsdMicros: amount(row.costUsdMicros), acceptedJobs: amount(row.acceptedJobs), disputedJobs: amount(row.disputedJobs), onTimeJobs: amount(row.onTimeJobs), causalEffect: null }));
  return { version: 1, mode: 'shadow', asOf: snapshot.asOf, accountId: snapshot.accountId, policy, baseline: { accountId: snapshot.accountId, resourceMode: snapshot.resourceMode ?? null, totals, servicePriceUsdMicros: snapshot.service ? amount(snapshot.service.priceUsdMicros) : null, customers: customers.filter(c => id(c.buyerAccountId)).map(c => ({buyerAccountId:c.buyerAccountId,acceptedJobs:amount(c.acceptedJobs)})) }, jobEconomics,
    pricing: { knownCostBasisUsdMicros: knownCostBasis, planningComputeCostUsdMicros: costBasis, conservativeQuoteUsdMicros: quote, suggestedPriceUsdMicros: suggestedPrice, estimatedOperatingCostUsdMicros: policy.operatingCostPerJobUsdMicros,
      estimatedPaymentFeeUsdMicros: suggestedPrice === null ? null : estimatePaymentFee(suggestedPrice, policy.paymentFeeBps),
      feeRoundingReserveUsdMicros: policy.paymentFeeBps ? 10000 : 0, basis: 'Operator estimates, not reconciled bills' },
    proposals, capacity: { activeJobs: active, reservedSlots: active, availableSlots: slots, proposedWorkSlots: allocated },
    scheduling: { ...schedule, planningHorizonSeconds:policy.planningHorizonSeconds, proposedWorkSeconds:allocated*policy.workSecondsPerJob, remainingAfterProposalsSeconds:Math.max(0,policy.planningHorizonSeconds-plannedSeconds) },
    computeValue: { providerOutcomes, causalEffect: null, measurement: 'Descriptive outcomes; stronger models require controlled comparison.' },
    riskFlags, outsideCostsComplete: false, profitabilityKnown: false };
}
export function compareBusiness(previous, snapshot) {
  if (!previous || previous.mode !== 'shadow' || !Number.isFinite(Date.parse(previous.asOf))
      || !snapshot || snapshot.mode !== 'shadow' || previous.baseline?.accountId !== snapshot.accountId
      || previous.baseline?.resourceMode !== (snapshot.resourceMode ?? null) || !Number.isFinite(Date.parse(snapshot.asOf)) || Date.parse(snapshot.asOf) < Date.parse(previous.asOf))
    throw new Error('Invalid business comparison');
  const before = metrics(previous.baseline?.totals), after = metrics(snapshot.totals);
  const delta = Object.fromEntries(Object.keys(after).map(key => [key, after[key] - before[key]]));
  const jobs = items(snapshot.jobs);
  const outcomes = items(previous.proposals, 10).map(proposal => {
    if (!Object.hasOwn(PROPOSAL_NAMES, proposal.kind)) throw new Error('Invalid business proposal');
    const related = proposal.kind === 'prioritize_delivery' ? jobs.find(job => job.id === proposal.jobId)
      : proposal.kind === 'bid' ? jobs.find(job => job.originBountyId === proposal.bountyId) : null;
    if (related && (!id(related.id) || !['open','claimed','submitted','accepted','disputed','refunded'].includes(related.state))) throw new Error('Invalid business outcome');
    const priorCustomer = previous.baseline.customers?.find(c=>c.buyerAccountId===proposal.buyerAccountId);
    const currentCustomer = items(snapshot.customers).find(c=>c.buyerAccountId===proposal.buyerAccountId);
    return { kind: proposal.kind, kindName: PROPOSAL_NAMES[proposal.kind], ...(related ? { jobId: related.id, observedState: related.state, observedPriceUsdMicros:amount(related.priceUsdMicros),
        settledRevenueUsdMicros:amount(related.settledRevenueUsdMicros), settledComputeCostsUsdMicros:amount(related.settledComputeCostsUsdMicros), unresolvedCalls:amount(related.unresolvedCalls) } : ['bid','prioritize_delivery'].includes(proposal.kind) ? { observedState:'not_observed_in_detail_window' } : {}),
      ...(proposal.kind === 'bid' && id(proposal.bountyId) ? {bountyId:proposal.bountyId} : {}),
      ...(proposal.kind === 'service_price' ? {priceMatchesProposal:snapshot.service?.priceUsdMicros === proposal.priceUsdMicros} : {}),
      ...(proposal.kind === 'customer_follow_up' ? {observedRepeatAcceptedJobs: currentCustomer && priorCustomer ? amount(currentCustomer.acceptedJobs) - amount(priorCustomer.acceptedJobs) : null} : {}),
      executedByObserver: false, causalEffect: null, attribution: 'No shadow action was executed; changes came from other actors.' };
  });
  return { mode: 'shadow', from: previous.asOf, to: snapshot.asOf, observedDelta: delta, outcomes,
    outsideCostsComplete: false, profitabilityKnown: false, causalEffect: null };
}
