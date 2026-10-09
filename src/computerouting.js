import { analyzeComputeExperiment } from './computeexperiment.js';
const TYPES = ['gameplay', 'market_analysis', 'business_planning'];
const id = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,127}$/.test(value);
const integer = (v, max) => Number.isSafeInteger(v) && v >= 0 && v <= max;
const fail = () => { throw new Error('Invalid shadow compute routing input'); };
function exact(v, keys) {
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).length !== keys.length || Object.keys(v).some(k => !keys.includes(k))) fail();
}
export function planShadowComputeRoutes(input) {
  exact(input, ['version', 'nowMs', 'availableBudgetUsdMicros', 'policies', 'evidence', 'tasks']);
  if (input.version !== 1 || !integer(input.nowMs, 8640000000000000) || !integer(input.availableBudgetUsdMicros, 100000000000000) || !Array.isArray(input.policies) || input.policies.length > 3 || !Array.isArray(input.evidence) || input.evidence.length > 3 || !Array.isArray(input.tasks) || input.tasks.length > 100) fail();
  const policies = new Map(), evidence = new Map();
  for (const p of input.policies) {
    exact(p, ['taskType', 'baselineModel', 'candidateModel', 'minimumPairs', 'minQualityGainBps', 'maxIncrementalCostUsdMicros', 'maxAdditionalLatencyMs', 'maxEvidenceAgeMs', 'maxTaskCostUsdMicros']);
    if (!TYPES.includes(p.taskType) || policies.has(p.taskType) || !id(p.baselineModel) || !id(p.candidateModel) || p.baselineModel === p.candidateModel || !integer(p.minimumPairs, 100) || p.minimumPairs < 5 || !integer(p.minQualityGainBps, 10000) || !integer(p.maxIncrementalCostUsdMicros, 1000000000000) || !integer(p.maxAdditionalLatencyMs, 86400000) || !integer(p.maxEvidenceAgeMs, 2592000000) || !integer(p.maxTaskCostUsdMicros, 1000000000000)) fail();
    policies.set(p.taskType, p);
  }
  for (const e of input.evidence) {
    exact(e, ['taskType', 'observedAtMs', 'dataset']);
    if (!TYPES.includes(e.taskType) || evidence.has(e.taskType) || !integer(e.observedAtMs, 8640000000000000)) fail();
    // Always reanalyze raw trials; a supplied recommendation is never trusted.
    const p = policies.get(e.taskType);
    if (!p) fail();
    const analysis = analyzeComputeExperiment(e.dataset, { minimumPairs: p.minimumPairs, minQualityGainBps: p.minQualityGainBps, maxIncrementalCostUsdMicros: p.maxIncrementalCostUsdMicros, maxAdditionalLatencyMs: p.maxAdditionalLatencyMs });
    evidence.set(e.taskType, { observedAtMs: e.observedAtMs, analysis });
  }
  const seen = new Set();
  const tasks = input.tasks.map(t => {
    exact(t, ['taskId', 'taskType', 'priority', 'baselineQuoteUsdMicros', 'candidateQuoteUsdMicros']);
    if (!id(t.taskId) || seen.has(t.taskId) || !TYPES.includes(t.taskType) || !integer(t.priority, 100) || [t.baselineQuoteUsdMicros, t.candidateQuoteUsdMicros].some(v => v !== null && !integer(v, 1000000000000))) fail();
    seen.add(t.taskId); return { ...t };
  }).sort((a, b) => b.priority - a.priority || (a.taskId < b.taskId ? -1 : a.taskId > b.taskId ? 1 : 0));
  let remaining = input.availableBudgetUsdMicros;
  const decisions = tasks.map(t => {
    const p = policies.get(t.taskType);
    const decision = { taskId: t.taskId, taskType: t.taskType, priority: t.priority, recommendedModel: null, proposedCostUsdMicros: 0, route: 'defer', reason: 'missing_policy' };
    if (!p) return decision;
    if (t.baselineQuoteUsdMicros === null) { decision.reason = 'baseline_quote_unknown'; return decision; }
    if (t.baselineQuoteUsdMicros > p.maxTaskCostUsdMicros) { decision.reason = 'baseline_task_cap'; return decision; }
    if (t.baselineQuoteUsdMicros > remaining) { decision.reason = 'baseline_budget_exhausted'; return decision; }
    remaining -= t.baselineQuoteUsdMicros;
    return { ...decision, recommendedModel: p.baselineModel, proposedCostUsdMicros: t.baselineQuoteUsdMicros, route: 'baseline', reason: 'missing_evidence' };
  });
  // Reserve routine work first; upgrades only consume the remainder of the shadow budget.
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i], d = decisions[i], p = policies.get(t.taskType), e = evidence.get(t.taskType);
    if (d.route !== 'baseline') continue;
    if (t.taskType !== 'market_analysis') { d.reason = 'task_rubric_unavailable'; continue; }
    if (!e) continue;
    if (e.observedAtMs > input.nowMs || input.nowMs - e.observedAtMs > p.maxEvidenceAgeMs) { d.reason = 'evidence_stale_or_future'; continue; }
    const a = e.analysis;
    if (a.baselineModel !== p.baselineModel || a.candidateModel !== p.candidateModel) { d.reason = 'evidence_model_mismatch'; continue; }
    if (a.recommendation !== 'review_candidate') { d.reason = 'evidence_gates_failed'; continue; }
    if (a.comparison.acceptanceUnobserved) { d.reason = 'acceptance_unobserved'; continue; }
    if (t.candidateQuoteUsdMicros === null) { d.reason = 'candidate_quote_unknown'; continue; }
    if (t.candidateQuoteUsdMicros > p.maxTaskCostUsdMicros) { d.reason = 'candidate_task_cap'; continue; }
    const extra = t.candidateQuoteUsdMicros - t.baselineQuoteUsdMicros;
    if (extra > p.maxIncrementalCostUsdMicros) { d.reason = 'candidate_incremental_cap'; continue; }
    if (extra > remaining) { d.reason = 'upgrade_budget_exhausted'; continue; }
    remaining -= extra;
    Object.assign(d, { route: 'candidate', reason: 'evidence_supported_shadow_route', recommendedModel: p.candidateModel, proposedCostUsdMicros: t.candidateQuoteUsdMicros });
  }
  return { version: 1, mode: 'shadow', decisions, proposedTotalCostUsdMicros: input.availableBudgetUsdMicros - remaining, remainingBudgetUsdMicros: remaining, eligibleToExecute: false, financialRequests: 0, independentlyVerified: false, policyChanged: false, riskFlags: ['operator_supplied_evidence_unverified', 'quotes_unverified', 'outside_costs_incomplete'], measurement: 'Offline routing proposals only; no provider calls, budget reservation, policy write or proven causal uplift.' };
}
