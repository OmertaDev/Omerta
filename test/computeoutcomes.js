import assert from 'node:assert/strict';
import { reconcileShadowComputeOutcomes } from '../src/computerouting.js';
const fixture=()=>({version:1,routingInput:{version:1,nowMs:0,availableBudgetUsdMicros:100,policies:[{taskType:'gameplay',baselineModel:'baseline',candidateModel:'candidate',minimumPairs:5,minQualityGainBps:500,maxIncrementalCostUsdMicros:10,maxAdditionalLatencyMs:100,maxEvidenceAgeMs:1000,maxTaskCostUsdMicros:100}],evidence:[],tasks:[{taskId:'a',taskType:'gameplay',priority:1,baselineQuoteUsdMicros:50,candidateQuoteUsdMicros:60},{taskId:'b',taskType:'gameplay',priority:0,baselineQuoteUsdMicros:50,candidateQuoteUsdMicros:60}]},observations:['a','b'].map(taskId=>({taskId,model:'baseline',status:'succeeded',costUsdMicros:50,latencyMs:100,accepted:true}))});
const run=mutate=>{const x=fixture();mutate?.(x);return reconcileShadowComputeOutcomes(x);};
const x=fixture(),before=JSON.stringify(x),good=reconcileShadowComputeOutcomes(x);assert.equal(JSON.stringify(x),before);assert.equal(good.recommendation,'review_recorded_outcomes');assert.equal(good.summary.observedCostDeltaUsdMicros,0);assert.equal(good.eligibleToExecute,false);assert.equal(good.financialRequests,0);assert.equal(good.policyChanged,false);assert.equal(good.causalEffect,null);assert.equal(good.profitabilityKnown,false);
assert.deepEqual(run(v=>v.observations.reverse()),good);
const absent=run(v=>v.observations.pop());assert.equal(absent.summary.missingOutcomes,1);assert.equal(absent.summary.observedCostDeltaUsdMicros,null);assert.equal(absent.recommendation,'hold_for_more_evidence');
const failed=run(v=>Object.assign(v.observations[0],{status:'failed',accepted:null,costUsdMicros:70}));assert.equal(failed.summary.observedKnownCostUsdMicros,120);assert.equal(failed.summary.budgetExceeded,true);assert.equal(failed.summary.unsuccessfulOutcomes,1);assert.equal(failed.summary.observedCostDeltaUsdMicros,null);
const unknown=run(v=>Object.assign(v.observations[0],{status:'unknown',accepted:null,costUsdMicros:null,latencyMs:null}));assert.equal(unknown.summary.unknownCosts,1);assert.equal(unknown.summary.observedKnownCostUsdMicros,50);
assert.equal(run(v=>v.observations[0].model='other').summary.mismatchedModels,1);
assert.equal(run(v=>v.routingInput.availableBudgetUsdMicros=50).summary.unexpectedExecutions,1);
assert.equal(run(v=>v.observations[0].accepted=null).summary.acceptanceUnobserved,1);
assert.equal(run(v=>v.observations[0].accepted=false).summary.rejectedOutcomes,1);
assert.equal(run(v=>v.observations[0].costUsdMicros=51).summary.taskCostOverruns,1);
assert.equal(run(v=>v.observations=[]).recommendation,'hold_for_more_evidence');
for(const mutate of [v=>v.observations.push(v.observations[0]),v=>v.observations[0].taskId='unplanned',v=>v.observations[0].report='private',v=>v.observations[0].costUsdMicros=-1,v=>v.observations[0].latencyMs=Infinity,v=>v.observations[0].costUsdMicros=null,v=>v.observations[0].status='failed',v=>v.routingInput={recommendation:'candidate'},v=>v.execute=true])assert.throws(()=>run(mutate));
for(let cost=0;cost<=200;cost++){const a=run(v=>v.observations.forEach(o=>o.costUsdMicros=cost));assert.equal(a.summary.observedKnownCostUsdMicros,cost*2);assert.equal(a.summary.observedCostDeltaUsdMicros,cost*2-100);assert.equal(a.summary.budgetExceeded,cost>50);}
console.log('computeoutcomes PASS: raw-plan binding, privacy, failed/unknown costs, coverage, mismatch and 201 reconciliation invariants');
