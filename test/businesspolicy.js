import assert from 'node:assert/strict';
import { normalizeBusinessPolicy, evaluateBusiness, compareBusiness } from '../src/businesspolicy.js';
const at = '2026-10-09T12:00:00.000Z';
const entry = { id: 'cheap', provider: 'openai', model: 'fixture-model', inputUsdMicrosPerMillion: 1000000,
  outputUsdMicrosPerMillion: 2000000, maxInputTokens: 10000, maxOutputTokens: 1000, storeResponses: false };
const snapshot = () => ({ version: 1, mode: 'shadow', accountId: 'seller', resourceMode: 'test', asOf: at,
  treasury: { availableUsdMicros: 100000, reservedUsdMicros: 0, frozen: false },
  policy: { enabled: true, providers: ['cheap'], maxPerCallUsdMicros: 100000, maxPerDayUsdMicros: 100000,
    dailyAuthorizedUsdMicros: 0, minimumReserveUsdMicros: 5000, expiresAt: '2026-10-10T12:00:00.000Z' },
  service: { enabled: true, revision: 1, priceUsdMicros: 20000 }, capacity: { activeJobs: 0 }, commitments: { pendingAwardBids: 0 },
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
const priority = snapshot();priority.capacity.activeJobs=1;priority.jobs=[{id:'urgent',state:'claimed',expiresAt:'2026-10-09T12:05:01.000Z',settledRevenueUsdMicros:0,settledComputeCostsUsdMicros:12000}];
const prioritised=evaluateBusiness(priority,{...policy,maxProposals:1});
assert.equal(prioritised.proposals[0].kind,'prioritize_delivery');assert.equal(prioritised.capacity.proposedWorkSlots,0,'Dropped proposals cannot occupy phantom slots');
assert.deepEqual(evaluateBusiness(snapshot(),policy),evaluateBusiness(snapshot(),{...policy,duty:'general'}),'Default duty preserves general planning');
const salesOnly=evaluateBusiness(priority,{...policy,duty:'sales',maxProposals:1});
assert.equal(salesOnly.proposals[0].kind,'bid','Out-of-duty delivery priority cannot consume the sales proposal quota');
assert.equal(salesOnly.capacity.proposedWorkSlots,1);
assert(salesOnly.proposals.every(proposal=>proposal.duty==='sales'));
assert.equal(salesOnly.deliveryBudget.protectedComputeUsdMicros,12000,'Duty filters preserve awarded-work protection');
const fulfillmentOnly=evaluateBusiness(priority,{...policy,duty:'fulfillment',maxProposals:1});
assert.equal(fulfillmentOnly.proposals[0].kind,'prioritize_delivery');
assert.equal(fulfillmentOnly.proposals[0].duty,'fulfillment');
assert.equal(fulfillmentOnly.capacity.proposedWorkSlots,0,'Filtered bids never consume phantom work slots');
const fulfillmentIdle=evaluateBusiness(snapshot(),{...policy,duty:'fulfillment'});
assert.deepEqual(fulfillmentIdle.proposals.map(proposal=>proposal.kind),['hold']);
assert.equal(fulfillmentIdle.proposals[0].reason,'no_awarded_delivery_priority');
assert.equal(fulfillmentIdle.proposals[0].duty,'fulfillment');
assert(fulfillmentOnly.proposals.every(proposal=>!['bid','service_price','customer_follow_up'].includes(proposal.kind)));
for(const duty of ['procurement','owner',true,null,[],{}])assert.throws(()=>normalizeBusinessPolicy({...policy,duty}),/duty/);
const frozenSales=structuredClone(priority);frozenSales.treasury.frozen=true;
assert.equal(evaluateBusiness(frozenSales,{...policy,duty:'sales'}).capacity.proposedWorkSlots,0,'Duty selection grants no authority');
assert.equal(JSON.stringify(original),encoded,'Duty filtering does not mutate data or permissions');
const expired=snapshot();expired.jobs=[{id:'expired',state:'claimed',expiresAt:at}];
assert(!evaluateBusiness(expired,policy).proposals.some(p=>p.kind==='prioritize_delivery'));
assert(evaluateBusiness(expired,policy).riskFlags.includes('expired_jobs_need_recovery'));
const pending = (count = 1) => {
 const s=snapshot();s.capacity.activeJobs=count;
 s.jobs=Array.from({length:count},(_,i)=>({id:`pending-${i}`,state:i%2?'open':'claimed',expiresAt:'2026-10-09T14:00:00.000Z',settledComputeCostsUsdMicros:12000}));
 return s;
};
const deliveryCash=pending();deliveryCash.treasury.availableUsdMicros=27000;
const cashProtection=evaluateBusiness(deliveryCash,policy);
assert.equal(cashProtection.deliveryBudget.protectedComputeUsdMicros,12000);
assert.equal(cashProtection.deliveryBudget.pendingJobs,1);
assert.equal(cashProtection.deliveryBudget.cashCovered,true);
assert.equal(cashProtection.capacity.proposedWorkSlots,0,'Existing awarded delivery is protected before new work');
assert(cashProtection.riskFlags.includes('compute_funds_insufficient'));
deliveryCash.treasury.availableUsdMicros=29000;
assert.equal(evaluateBusiness(deliveryCash,policy).capacity.proposedWorkSlots,1,'Exact cash boundary funds one new bid after delivery and reserve');
const deliveryDay=pending();deliveryDay.policy.maxPerDayUsdMicros=23999;
assert.equal(evaluateBusiness(deliveryDay,policy).capacity.proposedWorkSlots,0);
deliveryDay.policy.maxPerDayUsdMicros=24000;
assert.equal(evaluateBusiness(deliveryDay,policy).capacity.proposedWorkSlots,1,'Daily authorization protects delivery before new work');
const multipleDelivery=pending(2);multipleDelivery.treasury.availableUsdMicros=40999;
assert.equal(evaluateBusiness(multipleDelivery,policy).deliveryBudget.protectedComputeUsdMicros,24000);
assert.equal(evaluateBusiness(multipleDelivery,policy).capacity.proposedWorkSlots,0);
multipleDelivery.treasury.availableUsdMicros=41000;
assert.equal(evaluateBusiness(multipleDelivery,policy).capacity.proposedWorkSlots,1);
for(const deadline of [at,'2026-10-09T11:59:59.000Z','invalid',null]){
 const s=pending();s.jobs[0].expiresAt=deadline;
 const held=evaluateBusiness(s,policy);
 assert.equal(held.capacity.proposedWorkSlots,0,'Expired or invalid awarded deadline must hold new bids');
 assert.equal(held.deliveryBudget.protectedComputeUsdMicros,null,'Unsafe deadline cannot fabricate obligation affordability');
 assert(held.riskFlags.some(flag=>['expired_jobs_need_recovery','invalid_delivery_deadline'].includes(flag)));
}
const unknownDelivery=pending();unknownDelivery.catalog=[];
assert.deepEqual(evaluateBusiness(unknownDelivery,policy).deliveryBudget,{pendingJobs:1,protectedComputeUsdMicros:null,cashCovered:null,dailyBudgetCovered:null});
const incompleteDelivery=pending();incompleteDelivery.coverage.jobsTruncated=true;
assert.equal(evaluateBusiness(incompleteDelivery,policy).deliveryBudget.protectedComputeUsdMicros,null);
const missingActive=pending();missingActive.jobs=[];
const missingActiveView=evaluateBusiness(missingActive,policy);
assert.equal(missingActiveView.capacity.proposedWorkSlots,0);
assert(missingActiveView.riskFlags.includes('active_job_detail_mismatch'));
assert.equal(missingActiveView.deliveryBudget.protectedComputeUsdMicros,null);
const inconsistentActive=pending();inconsistentActive.capacity.activeJobs=0;
assert.equal(evaluateBusiness(inconsistentActive,policy).capacity.proposedWorkSlots,0);
const duplicateDelivery=pending(2);duplicateDelivery.jobs[1].id=duplicateDelivery.jobs[0].id;
assert.throws(()=>evaluateBusiness(duplicateDelivery,policy),/duplicate/);
const underfundedDelivery=pending();underfundedDelivery.treasury.availableUsdMicros=16999;underfundedDelivery.policy.maxPerDayUsdMicros=11999;
const heldDelivery=evaluateBusiness(underfundedDelivery,policy);
assert.equal(heldDelivery.deliveryBudget.cashCovered,false);assert.equal(heldDelivery.deliveryBudget.dailyBudgetCovered,false);
assert(heldDelivery.riskFlags.includes('awarded_delivery_funds_insufficient'));assert(heldDelivery.riskFlags.includes('awarded_delivery_daily_budget_insufficient'));
for(const state of ['submitted','accepted','disputed','refunded']){
 const s=pending();s.jobs[0].state=state;s.capacity.activeJobs=['submitted','disputed'].includes(state)?1:0;
 assert.equal(evaluateBusiness(s,policy).deliveryBudget.protectedComputeUsdMicros,0,'Delivery protection excludes terminal and submitted work');
}
assert.equal(JSON.stringify(original),encoded,'Delivery budgeting preserves snapshot and owner authority');
const pendingBid=snapshot();pendingBid.commitments.pendingAwardBids=1;pendingBid.treasury.availableUsdMicros=28999;
const pendingBidView=evaluateBusiness(pendingBid,policy);
assert.equal(pendingBidView.capacity.proposedWorkSlots,0);
assert.equal(pendingBidView.capacity.pendingAwardSlots,1);
assert.equal(pendingBidView.capacity.availableSlots,2);
assert.equal(pendingBidView.capacity.reservedSlots,0,'Potential awards do not become active jobs');
assert.deepEqual(pendingBidView.bidCommitmentBudget,{pendingAwardBids:1,protectedComputeUsdMicros:12000,cashCovered:true,dailyBudgetCovered:true});
pendingBid.treasury.availableUsdMicros=29000;
assert.equal(evaluateBusiness(pendingBid,policy).capacity.proposedWorkSlots,1,'Exact funds boundary protects pending award before one new bid');
pendingBid.policy.maxPerDayUsdMicros=23999;
assert.equal(evaluateBusiness(pendingBid,policy).capacity.proposedWorkSlots,0);
pendingBid.policy.maxPerDayUsdMicros=24000;
assert.equal(evaluateBusiness(pendingBid,policy).capacity.proposedWorkSlots,1);
const fullPending=snapshot();fullPending.commitments.pendingAwardBids=3;
const fullPendingView=evaluateBusiness(fullPending,policy);
assert.equal(fullPendingView.capacity.availableSlots,0);assert.equal(fullPendingView.capacity.proposedWorkSlots,0);
assert.equal(evaluateBusiness(fullPending,{...policy,duty:'sales'}).capacity.proposedWorkSlots,0,'Sales planning preserves pending-award capacity protection');
assert.equal(fullPendingView.bidCommitmentBudget.protectedComputeUsdMicros,36000);
const manyPending=snapshot();manyPending.commitments.pendingAwardBids=101;
assert.equal(evaluateBusiness(manyPending,policy).bidCommitmentBudget.protectedComputeUsdMicros,1212000,
 'Complete pending count protects commitments beyond any 100-row detail window');
const underfundedBid=snapshot();underfundedBid.commitments.pendingAwardBids=1;
underfundedBid.treasury.availableUsdMicros=16999;underfundedBid.policy.maxPerDayUsdMicros=11999;
const underfundedBidView=evaluateBusiness(underfundedBid,policy);
assert.equal(underfundedBidView.bidCommitmentBudget.cashCovered,false);
assert.equal(underfundedBidView.bidCommitmentBudget.dailyBudgetCovered,false);
assert(underfundedBidView.riskFlags.includes('pending_bid_funds_insufficient'));
assert(underfundedBidView.riskFlags.includes('pending_bid_daily_budget_insufficient'));
const bothPending=pending();bothPending.commitments.pendingAwardBids=1;bothPending.treasury.availableUsdMicros=41000;
const bothPendingView=evaluateBusiness(bothPending,policy);
assert.equal(bothPendingView.deliveryBudget.protectedComputeUsdMicros,12000);
assert.equal(bothPendingView.bidCommitmentBudget.protectedComputeUsdMicros,12000);
assert.equal(bothPendingView.capacity.availableSlots,1);assert.equal(bothPendingView.capacity.proposedWorkSlots,1);
bothPending.treasury.availableUsdMicros=40999;
assert.equal(evaluateBusiness(bothPending,policy).capacity.proposedWorkSlots,0);
const missingCommitments=snapshot();delete missingCommitments.commitments;
const missingCommitmentsView=evaluateBusiness(missingCommitments,policy);
assert.deepEqual(missingCommitmentsView.bidCommitmentBudget,{pendingAwardBids:null,protectedComputeUsdMicros:null,cashCovered:null,dailyBudgetCovered:null});
assert.equal(missingCommitmentsView.capacity.pendingAwardSlots,null);
assert.equal(missingCommitmentsView.capacity.proposedWorkSlots,0);
assert(missingCommitmentsView.riskFlags.includes('pending_bid_commitments_unknown'));
assert.equal(evaluateBusiness(missingCommitments,{...policy,duty:'sales'}).capacity.proposedWorkSlots,0,'Missing obligations remain a hold for sales planning');
const overflowingCommitments=snapshot();overflowingCommitments.commitments.pendingAwardBids=Number.MAX_SAFE_INTEGER;
const overflowingView=evaluateBusiness(overflowingCommitments,policy);
assert.equal(overflowingView.bidCommitmentBudget.protectedComputeUsdMicros,null);
assert.equal(overflowingView.capacity.proposedWorkSlots,0);
assert(overflowingView.riskFlags.includes('pending_bid_budget_outside_exact_bounds'));
for(const count of [-1,1.5,Infinity,Number.MAX_SAFE_INTEGER+1,'1',true]){
 const s=snapshot();s.commitments.pendingAwardBids=count;assert.throws(()=>evaluateBusiness(s,policy),/pending award/);
}
const unknownBidQuote=snapshot();unknownBidQuote.commitments.pendingAwardBids=1;unknownBidQuote.catalog=[];
assert.equal(evaluateBusiness(unknownBidQuote,policy).bidCommitmentBudget.protectedComputeUsdMicros,null);
const unknownBidCosts=snapshot();unknownBidCosts.commitments.pendingAwardBids=1;unknownBidCosts.totals.unresolvedPaidCalls=1;
assert.equal(evaluateBusiness(unknownBidCosts,policy).bidCommitmentBudget.protectedComputeUsdMicros,null);
const retained=evaluateBusiness(snapshot(),{...policy,maxActiveJobs:1});
assert(retained.proposals.some(p=>p.kind==='bid'));
const repeat=snapshot();repeat.bounties=[];
const repeatEvaluation=evaluateBusiness(repeat,policy);
const missingCustomer={...repeat,asOf:'2026-10-09T13:00:00.000Z',customers:[],coverage:{customersTruncated:true}};
assert.equal(compareBusiness(repeatEvaluation,missingCustomer).outcomes.find(o=>o.kind==='customer_follow_up').observedRepeatAcceptedJobs,null,'Missing customer window cannot imply lost accepted work');
assert(evaluateBusiness(repeat,policy).proposals.some(p=>p.kind==='customer_follow_up'&&p.requiresOwnerApproval));
const later=snapshot();later.asOf='2026-10-09T13:00:00.000Z';later.totals.settledCustomerRevenueUsdMicros=40000;
const comparison=compareBusiness(result,later);assert.equal(comparison.observedDelta.settledCustomerRevenueUsdMicros,30000);
assert.equal(comparison.originatingDuty,'general');
const salesComparison=compareBusiness(salesOnly,later);
assert.equal(salesComparison.originatingDuty,'sales');
assert.equal(salesComparison.observedDelta.settledCustomerRevenueUsdMicros,30000,'Comparisons retain recorded receipts rather than infer duty economics');
assert(salesComparison.outcomes.every(outcome=>outcome.duty==='sales'&&outcome.causalEffect===null));
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
const defaults=normalizeBusinessPolicy();
assert.equal(defaults.workSecondsPerJob,300);assert.equal(defaults.planningHorizonSeconds,3600);
for(const workSecondsPerJob of [59,3601,1.5,Infinity,null,'300',true])assert.throws(()=>normalizeBusinessPolicy({workSecondsPerJob}));
for(const planningHorizonSeconds of [59,86401,1.5,Infinity,null,'3600',true])assert.throws(()=>normalizeBusinessPolicy({planningHorizonSeconds}));
for(const seconds of [60,3600])assert.equal(normalizeBusinessPolicy({workSecondsPerJob:seconds}).workSecondsPerJob,seconds);
for(const seconds of [60,86400])assert.equal(normalizeBusinessPolicy({planningHorizonSeconds:seconds}).planningHorizonSeconds,seconds);
for(const jobs of [[],pending(2).jobs]){
 const s=snapshot();s.asOf='+275760-09-13T00:00:00.000Z';s.jobs=jobs;s.capacity.activeJobs=jobs.length;
 assert.throws(()=>evaluateBusiness(s,policy),/snapshot.*time range/,'Parseable dates must leave representable scheduling time');
}
const timePlan=evaluateBusiness(snapshot(),{...policy,workSecondsPerJob:600,planningHorizonSeconds:1200});
assert.equal(timePlan.capacity.proposedWorkSlots,2,'All proposals share the same time budget');
assert.equal(timePlan.scheduling.proposedWorkSeconds,1200);
assert.equal(timePlan.scheduling.remainingAfterProposalsSeconds,0);
const times=timePlan.proposals.filter(p=>p.kind==='bid');
assert.equal(times[0].plannedStartAt,at);assert.equal(times[0].plannedFinishAt,times[1].plannedStartAt);
assert(times.every(p=>p.estimatedWorkSeconds===600&&p.deliverySeconds===3600&&p.requiresOwnerApproval&&p.eligibleToExecute===false));
const commitments=pending(2);
commitments.jobs=[{id:'later',state:'claimed',expiresAt:'2026-10-09T13:00:00Z'},{id:'earlier',state:'open',expiresAt:'2026-10-09T12:20:01Z'}];
const workload=evaluateBusiness(commitments,{...policy,workSecondsPerJob:600,planningHorizonSeconds:1800});
assert.deepEqual(workload.scheduling.commitments.map(j=>j.jobId),['earlier','later']);
assert(workload.scheduling.commitments.every(j=>j.feasibleByDeadline));
assert.equal(workload.scheduling.reservedWorkSeconds,1200);
assert.equal(workload.capacity.proposedWorkSlots,1);
assert.equal(workload.proposals.find(p=>p.kind==='bid').plannedStartAt,'2026-10-09T12:20:00.000Z');
const tied=pending(2);tied.jobs.reverse();
assert.deepEqual(evaluateBusiness(tied,policy).scheduling.commitments.map(j=>j.jobId),['pending-0','pending-1'],'Equal deadlines use stable job IDs');
for(const expiresAt of [at,'invalid',null,'2026-10-09T12:05:00Z','2026-10-09T12:04:59Z']){
 const s=pending();s.jobs[0].expiresAt=expiresAt;
 const planned=evaluateBusiness(s,policy);
 assert(planned.riskFlags.includes('awarded_work_deadline_risk'));
 assert.equal(planned.capacity.proposedWorkSlots,0,'Invalid, expired and exact-finish deadlines hold bids');
 assert.equal(planned.scheduling.commitments.length,1,'Unsafe awarded work remains visible');
 assert.equal(planned.scheduling.commitments[0].feasibleByDeadline,false);
 assert.equal(planned.scheduling.reservedWorkSeconds,300,'Unsafe awarded work still reserves estimated time');
}
const jointlyLate=pending(2);jointlyLate.jobs.forEach(job=>{job.expiresAt='2026-10-09T12:09:00Z';});
const jointlyLatePlan=evaluateBusiness(jointlyLate,policy);
assert.deepEqual(jointlyLatePlan.scheduling.commitments.map(job=>job.feasibleByDeadline),[true,false]);
assert.equal(jointlyLatePlan.capacity.proposedWorkSlots,0,'Individually feasible deadlines cannot share the same execution time');
for(const s of [missingActive,inconsistentActive]){
 const planned=evaluateBusiness(s,policy);
 assert(planned.scheduling.activeDetailsIncomplete);assert(planned.riskFlags.includes('active_work_details_incomplete'));
 assert.equal(planned.capacity.proposedWorkSlots,0);
}
for(const state of ['submitted','disputed','accepted','refunded']){
 const s=pending();s.jobs[0].state=state;s.capacity.activeJobs=['submitted','disputed'].includes(state)?1:0;
 const planned=evaluateBusiness(s,policy);
 assert.equal(planned.scheduling.reservedWorkSeconds,0,'Submitted and terminal jobs do not execute twice');
 assert.equal(planned.capacity.proposedWorkSlots,3-s.capacity.activeJobs);
}
const pendingTime=snapshot();pendingTime.commitments.pendingAwardBids=1;
const pendingTimePlan=evaluateBusiness(pendingTime,{...policy,workSecondsPerJob:600,planningHorizonSeconds:1200});
assert.equal(pendingTimePlan.scheduling.pendingAwardWorkSeconds,600);
assert.equal(pendingTimePlan.capacity.proposedWorkSlots,1,'Potential awards protect time as well as slots and funds');
assert.equal(pendingTimePlan.proposals.find(p=>p.kind==='bid').plannedStartAt,'2026-10-09T12:10:00.000Z');
const bothTime=pending();bothTime.commitments.pendingAwardBids=1;
const bothTimePlan=evaluateBusiness(bothTime,{...policy,workSecondsPerJob:600,planningHorizonSeconds:1800});
assert.equal(bothTimePlan.capacity.proposedWorkSlots,1);
assert.equal(bothTimePlan.proposals.find(p=>p.kind==='bid').plannedStartAt,'2026-10-09T12:20:00.000Z');
for(const s of [missingCommitments,overflowingCommitments]){
 const planned=evaluateBusiness(s,policy);
 assert.equal(planned.scheduling.pendingAwardWorkSeconds,null);
 assert.equal(planned.scheduling.remainingWorkSeconds,null);
 assert.equal(planned.scheduling.remainingAfterProposalsSeconds,null,'Unknown time cannot imply unused capacity');
 assert.equal(planned.capacity.proposedWorkSlots,0);
}
assert(evaluateBusiness(overflowingCommitments,policy).riskFlags.includes('pending_bid_work_outside_exact_bounds'));
const noTime=evaluateBusiness(snapshot(),{...policy,workSecondsPerJob:600,planningHorizonSeconds:599});
assert.equal(noTime.capacity.proposedWorkSlots,0);assert(noTime.riskFlags.includes('work_time_capacity_full'));
const beyondHorizon=evaluateBusiness(pending(2),{...policy,workSecondsPerJob:600,planningHorizonSeconds:600});
assert.equal(beyondHorizon.scheduling.reservedWorkSeconds,1200);assert.equal(beyondHorizon.scheduling.remainingWorkSeconds,0);
for(const expiresAt of ['2026-10-09T12:04:59Z','2026-10-09T12:05:00Z']){
 const s=snapshot();s.policy.expiresAt=expiresAt;
 const planned=evaluateBusiness(s,policy);
 assert.equal(planned.capacity.proposedWorkSlots,0,'Work must finish strictly before current authority expires');
 assert(planned.riskFlags.includes('owner_authority_window_insufficient'));
 assert(!planned.riskFlags.includes('work_time_capacity_full'),'Authority expiry is distinct from the planning horizon');
}
const exactAuthority=snapshot();exactAuthority.policy.expiresAt='2026-10-09T12:05:00.001Z';
assert.equal(evaluateBusiness(exactAuthority,policy).capacity.proposedWorkSlots,1);
const longPlan=evaluateBusiness(snapshot(),{...policy,workSecondsPerJob:3600,planningHorizonSeconds:10800});
assert.deepEqual(longPlan.proposals.filter(p=>p.kind==='bid').map(p=>p.deliverySeconds),[3601,7201,10801],
 'A proposed delivery deadline must leave time to submit strictly before expiry');
assert.equal(evaluateBusiness(priority,{...policy,maxProposals:1}).scheduling.proposedWorkSeconds,0,'A capped proposal reserves no phantom time');
assert.equal(evaluateBusiness(priority,{...policy,duty:'fulfillment'}).scheduling.proposedWorkSeconds,0,'Out-of-duty bids reserve no phantom time');
const salesTime=evaluateBusiness(priority,{...policy,duty:'sales',maxProposals:1});
assert.equal(salesTime.scheduling.proposedWorkSeconds,300);assert.equal(salesTime.scheduling.reservedWorkSeconds,300);
assert.equal(JSON.stringify(original),encoded,'Scheduling never mutates the snapshot or owner authority');
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
 const duration=60+next()%3541,horizon=60+next()%86341,s=pending(next()%3);
 s.commitments.pendingAwardBids=next()%(4-s.capacity.activeJobs);
 const planned=evaluateBusiness(s,{...policy,workSecondsPerJob:duration,planningHorizonSeconds:horizon});
 assert.equal(planned.scheduling.proposedWorkSeconds,planned.capacity.proposedWorkSlots*duration);
 const bids=planned.proposals.filter(p=>p.kind==='bid');
 let finish=Date.parse(at)+(planned.scheduling.reservedWorkSeconds+planned.scheduling.pendingAwardWorkSeconds)*1000;
 for(const bid of bids){
  assert.equal(Date.parse(bid.plannedStartAt),finish);finish=Date.parse(bid.plannedFinishAt);
  assert.equal(finish-Date.parse(bid.plannedStartAt),duration*1000);
  assert(finish<=Date.parse(at)+horizon*1000);assert(finish<Date.parse(s.policy.expiresAt));
  assert.equal(bid.eligibleToExecute,false);assert(bid.requiresOwnerApproval);
 }
 assert.equal(planned.scheduling.remainingAfterProposalsSeconds,Math.max(0,horizon-(finish-Date.parse(at))/1000));
}
console.log('businesspolicy PASS: shadow-only proposals, exact margins, protected commitments, deadlines and 400 pricing / 200 scheduling trials seed1947');
