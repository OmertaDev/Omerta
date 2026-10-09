import assert from 'node:assert/strict';
import { normalizeBusinessPolicy, evaluateBusiness, compareBusiness } from '../src/businesspolicy.js';
const at = '2026-10-09T12:00:00.000Z';
const entry = { id: 'cheap', provider: 'openai', model: 'fixture-model', inputUsdMicrosPerMillion: 1000000,
  outputUsdMicrosPerMillion: 2000000, maxInputTokens: 10000, maxOutputTokens: 1000, storeResponses: false };
const snapshot = () => ({ version: 1, mode: 'shadow', accountId: 'seller', resourceMode: 'test', asOf: at,
  treasury: { availableUsdMicros: 100000, reservedUsdMicros: 0, frozen: false },
  policy: { enabled: true, providers: ['cheap'], maxPerCallUsdMicros: 100000, maxPerDayUsdMicros: 100000,
    dailyAuthorizedUsdMicros: 0, minimumReserveUsdMicros: 5000, expiresAt: '2026-10-10T12:00:00.000Z' },
  service: { enabled: true, revision: 1, priceUsdMicros: 20000 }, capacity: { activeJobs: 0 },
  totals: { settledCustomerRevenueUsdMicros: 10000, settledPaidComputeCostsUsdMicros: 5000,
    heldPaidComputeUsdMicros: 0, unresolvedPaidCalls: 0, simulatedPaidCalls: 1 },
  jobs: [], calls: [], customers: [{ buyerAccountId: 'repeat-buyer', acceptedJobs: 2 }],
  bounties: ['a','b','c'].map(id => ({ id, buyerAccountId: 'buyer', budgetUsdMicros: 100000, expiresAt: '2026-10-09T14:00:00.000Z' })),
  catalog: [entry], coverage: {}, providerOutcomes: [{providerId:'cheap',settledCallCount:2,costUsdMicros:5000,acceptedJobs:1,causalEffect:null}],
  question: 'private-question', report: 'private-report', token: 'private-token' });
const policy = { providerId: 'cheap', maxOutputTokens: 1000, maxProposals: 10 };
const original = snapshot(), encoded = JSON.stringify(original);
const result = evaluateBusiness(original, policy);
assert.equal(JSON.stringify(original), encoded, 'Evaluation never mutates its input');
assert.equal(result.mode, 'shadow');assert(result.proposals.every(p => p.eligibleToExecute === false));
assert.equal(result.pricing.conservativeQuoteUsdMicros, 12000);assert.equal(result.pricing.suggestedPriceUsdMicros, 30000);
assert.equal(result.proposals.filter(p => p.kind === 'bid').length, 3);assert.equal(result.capacity.proposedWorkSlots, 3);
assert.equal(result.computeValue.causalEffect, null);assert.equal(result.profitabilityKnown, false);
assert(!JSON.stringify(result).includes('private-'));
for (const mutate of [
 s => { s.treasury.frozen = true; }, s => { s.treasury.availableUsdMicros = 16999; },
 s => { s.policy.dailyAuthorizedUsdMicros = 99000; }, s => { s.policy.enabled = false; },
 s => { s.policy.expiresAt = at; }, s => { s.policy.providers = []; },
 s => { s.capacity.activeJobs = 3; }, s => { s.totals.unresolvedPaidCalls = 1; },
 s => { s.coverage.jobsTruncated = true; }, s => { s.catalog[0] = {...entry,storeResponses:true}; },
]) {const s=snapshot();mutate(s);assert.equal(evaluateBusiness(s,policy).proposals.filter(p=>p.kind==='bid').length,0);}
const one = snapshot();one.treasury.availableUsdMicros=17000;
assert.equal(evaluateBusiness(one,policy).proposals.filter(p=>p.kind==='bid').length,1,'Quote reserves allocate across all proposals');
const day = snapshot();day.policy.maxPerDayUsdMicros=12000;
assert.equal(evaluateBusiness(day,policy).capacity.proposedWorkSlots,1);
const priority = snapshot();priority.capacity.activeJobs=1;priority.jobs=[{id:'urgent',state:'claimed',expiresAt:'2026-10-09T12:05:00.000Z',settledRevenueUsdMicros:0,settledComputeCostsUsdMicros:12000}];
const prioritised=evaluateBusiness(priority,{...policy,maxProposals:1});
assert.equal(prioritised.proposals[0].kind,'prioritize_delivery');assert.equal(prioritised.capacity.proposedWorkSlots,0,'Dropped proposals cannot occupy phantom slots');
const expired=snapshot();expired.jobs=[{id:'expired',state:'claimed',expiresAt:at}];
assert(!evaluateBusiness(expired,policy).proposals.some(p=>p.kind==='prioritize_delivery'));
assert(evaluateBusiness(expired,policy).riskFlags.includes('expired_jobs_need_recovery'));
const retained=evaluateBusiness(snapshot(),{...policy,maxActiveJobs:1});
assert(retained.proposals.some(p=>p.kind==='bid'));
const repeat=snapshot();repeat.bounties=[];
const repeatEvaluation=evaluateBusiness(repeat,policy);
const missingCustomer={...repeat,asOf:'2026-10-09T13:00:00.000Z',customers:[],coverage:{customersTruncated:true}};
assert.equal(compareBusiness(repeatEvaluation,missingCustomer).outcomes.find(o=>o.kind==='customer_follow_up').observedRepeatAcceptedJobs,null,'Missing customer window cannot imply lost accepted work');
assert(evaluateBusiness(repeat,policy).proposals.some(p=>p.kind==='customer_follow_up'&&p.requiresOwnerApproval));
const later=snapshot();later.asOf='2026-10-09T13:00:00.000Z';later.totals.settledCustomerRevenueUsdMicros=40000;
const comparison=compareBusiness(result,later);assert.equal(comparison.observedDelta.settledCustomerRevenueUsdMicros,30000);
later.jobs=[{id:'accepted-job',originBountyId:'a',state:'accepted',priceUsdMicros:30000,settledRevenueUsdMicros:30000,settledComputeCostsUsdMicros:10000}];
assert(compareBusiness(result,later).outcomes.some(o=>o.bountyId==='a'&&o.observedState==='accepted'));
assert.equal(comparison.causalEffect,null);assert(comparison.outcomes.every(o=>o.executedByObserver===false));
assert.throws(()=>compareBusiness(result,{...later,accountId:'another'}));
assert.throws(()=>compareBusiness(result,{...later,resourceMode:'live'}));
assert.throws(()=>compareBusiness(result,{...later,asOf:'2020-01-01'}));
assert.throws(()=>normalizeBusinessPolicy({execute:true}));assert.throws(()=>normalizeBusinessPolicy({targetMarginBps:10000}));
assert.throws(()=>evaluateBusiness({...snapshot(),totals:{settledCustomerRevenueUsdMicros:Infinity}},policy));
assert.throws(()=>evaluateBusiness({...snapshot(),bounties:Array(101).fill({})},policy));
const feeAware=snapshot();feeAware.bounties.forEach(b=>{b.budgetUsdMicros=1000000;});
const feePlan=evaluateBusiness(feeAware,{...policy,operatingCostPerJobUsdMicros:300000,paymentFeeBps:290});
assert.equal(feePlan.pricing.suggestedPriceUsdMicros,450000);
assert.equal(feePlan.pricing.estimatedPaymentFeeUsdMicros,20000);
assert(feePlan.riskFlags.includes('operator_cost_estimates_unreconciled'));
assert.equal(feePlan.profitabilityKnown,false);assert.equal(feePlan.outsideCostsComplete,false);
assert.equal(feePlan.proposals.find(p=>p.kind==='bid').computeReserveUsdMicros,12000,'Estimated external costs never become treasury reservations');
assert.equal(feePlan.proposals.find(p=>p.kind==='bid').estimatedContributionUsdMicros,118000);
assert.throws(()=>normalizeBusinessPolicy({paymentFeeBps:-1}));assert.throws(()=>normalizeBusinessPolicy({paymentFeeBps:3001}));
assert.throws(()=>normalizeBusinessPolicy({operatingCostPerJobUsdMicros:1.5}));
assert.throws(()=>normalizeBusinessPolicy({targetMarginBps:9000,paymentFeeBps:1000}));
assert.equal(evaluateBusiness(snapshot(),{...policy,operatingCostPerJobUsdMicros:1000000000}).pricing.suggestedPriceUsdMicros,null,'Impossible prices are not proposed');
const timed=snapshot();
const timePlan=evaluateBusiness(timed,{...policy,workSecondsPerJob:600,planningHorizonSeconds:1200});
assert.equal(timePlan.capacity.proposedWorkSlots,2,'All proposals share the same time budget');
assert.equal(timePlan.scheduling.proposedWorkSeconds,1200);
assert.equal(timePlan.scheduling.remainingAfterProposalsSeconds,0);
const times=timePlan.proposals.filter(p=>p.kind==='bid');
assert.equal(times[0].plannedFinishAt,times[1].plannedStartAt,'Proposals do not overlap');
const commitments=snapshot();commitments.capacity.activeJobs=2;
commitments.jobs=[{id:'later',state:'claimed',expiresAt:'2026-10-09T13:00:00Z'},{id:'earlier',state:'open',expiresAt:'2026-10-09T12:20:00Z'}];
const workload=evaluateBusiness(commitments,{...policy,workSecondsPerJob:600,planningHorizonSeconds:1800});
assert.deepEqual(workload.scheduling.commitments.map(j=>j.jobId),['earlier','later']);
assert.equal(workload.scheduling.reservedWorkSeconds,1200);
assert.equal(workload.capacity.proposedWorkSlots,1);
assert.equal(workload.proposals.find(p=>p.kind==='bid').plannedStartAt,'2026-10-09T12:20:00.000Z');
const impossible=snapshot();impossible.capacity.activeJobs=1;impossible.jobs=[{id:'late',state:'claimed',expiresAt:'2026-10-09T12:01:00Z'}];
assert(evaluateBusiness(impossible,policy).riskFlags.includes('awarded_work_deadline_risk'));
assert(!evaluateBusiness(impossible,policy).proposals.some(p=>p.kind==='bid'));
const missing=snapshot();missing.capacity.activeJobs=1;
assert(evaluateBusiness(missing,policy).riskFlags.includes('active_work_details_incomplete'));
assert(!evaluateBusiness(missing,policy).proposals.some(p=>p.kind==='bid'));
const reviewOnly=snapshot();reviewOnly.capacity.activeJobs=1;reviewOnly.jobs=[{id:'review',state:'submitted',expiresAt:'2026-10-09T13:00:00Z'}];
assert.equal(evaluateBusiness(reviewOnly,policy).scheduling.reservedWorkSeconds,0,'Submitted work holds a slot but does not require another work execution');
const shortAuthority=snapshot();shortAuthority.policy.expiresAt='2026-10-09T12:02:00Z';
assert(!evaluateBusiness(shortAuthority,policy).proposals.some(p=>p.kind==='bid'),'Work must fit current authority window');
assert.throws(()=>normalizeBusinessPolicy({workSecondsPerJob:59}));assert.throws(()=>normalizeBusinessPolicy({planningHorizonSeconds:86401}));
assert.throws(()=>normalizeBusinessPolicy({workSecondsPerJob:1.5}));
let state=1947;const next=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state;};
for(let i=0;i<200;i++){
 const s=snapshot();s.catalog=[{...entry,inputUsdMicrosPerMillion:next()%100000000,outputUsdMicrosPerMillion:next()%100000000}];
 const bps=next()%9001,min=next()%1000000;const evaluated=evaluateBusiness(s,{...policy,targetMarginBps:bps,minimumMarginUsdMicros:min});
 const price=evaluated.pricing.suggestedPriceUsdMicros,cost=evaluated.pricing.conservativeQuoteUsdMicros;
 if(price!==null){assert.equal(price%10000,0);assert(BigInt(price)*BigInt(10000-bps)>=BigInt(cost)*10000n);assert(price-cost>=min);}
 assert(evaluated.capacity.proposedWorkSlots<=3);
}
for(let i=0;i<200;i++){
 const fee=next()%3001,margin=next()%(10000-fee),operating=next()%1000000;
 const evaluated=evaluateBusiness(snapshot(),{...policy,targetMarginBps:Math.min(margin,9000),paymentFeeBps:fee,operatingCostPerJobUsdMicros:operating});
 const price=evaluated.pricing.suggestedPriceUsdMicros,cost=evaluated.pricing.planningComputeCostUsdMicros;
 if(price!==null){const roundedFee=(BigInt(price)*BigInt(fee)+99999999n)/100000000n*10000n;const profit=BigInt(price)-BigInt(cost)-BigInt(operating)-roundedFee;assert(profit*10000n>=BigInt(price)*BigInt(Math.min(margin,9000)));assert(profit>=10000n);assert.equal(price%10000,0);}
}
for(let i=0;i<200;i++){
 const duration=60+next()%3541,horizon=60+next()%86341;
 const planned=evaluateBusiness(snapshot(),{...policy,workSecondsPerJob:duration,planningHorizonSeconds:horizon});
 assert(planned.scheduling.proposedWorkSeconds<=horizon);
 assert.equal(planned.scheduling.proposedWorkSeconds,planned.capacity.proposedWorkSlots*duration);
 const bidPlans=planned.proposals.filter(p=>p.kind==='bid');
 for(let n=0;n<bidPlans.length;n++){assert(Date.parse(bidPlans[n].plannedFinishAt)-Date.parse(at)<=horizon*1000);if(n)assert(Date.parse(bidPlans[n].plannedStartAt)>=Date.parse(bidPlans[n-1].plannedFinishAt));assert(bidPlans[n].eligibleToExecute===false);}
}
console.log('businesspolicy PASS: shadow-only proposals, exact margins, shared capacity/funds/daily reserves, unknowns, retention, comparison and 400 pricing and 200 scheduling trials seed1947');
