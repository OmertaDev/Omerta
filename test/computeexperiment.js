import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {planComputeExperiment,analyzeComputeExperiment} from '../src/computeexperiment.js';
const input={baselineModel:'baseline-fixture-v1',candidateModel:'candidate-fixture-v1',seed:1947,tasks:Array.from({length:10},(_,i)=>({taskId:'task_'+i,inputHash:crypto.createHash('sha256').update('task_'+i).digest('hex')}))};
const plan=planComputeExperiment(input);
assert.deepEqual(plan,planComputeExperiment({...input,tasks:[...input.tasks].reverse()}),'Plan is independent of input order');
const records=()=>plan.assignments.flatMap(pair=>['baseline','candidate'].map(condition=>({pairId:pair.pairId,condition,model:plan[condition+'Model'],order:pair[condition+'Order'],graderId:'blind-grader',graderBlind:true,status:'succeeded',costUsdMicros:condition==='baseline'?100:200,latencyMs:condition==='baseline'?1000:1500,scores:{accuracy:condition==='baseline'?7000:8000,evidence:7000,relevance:7000,uncertainty:7000},accepted:null})));
const dataset=()=>({version:1,plan:structuredClone(plan),trials:records()});
const before=dataset(),copy=JSON.stringify(before);const result=analyzeComputeExperiment(before,{minQualityGainBps:400});
assert.equal(JSON.stringify(before),copy,'Analysis never changes results');assert.equal(result.matchedPairs,10);
assert.equal(result.comparison.meanQualityGainBps,400);assert.equal(result.comparison.meanIncrementalCostUsdMicros,100);
assert.equal(result.recommendation,'review_candidate');assert.equal(result.eligibleToExecute,false);assert.equal(result.financialRequests,0);assert.equal(result.causalEffect,null);assert.equal(result.independentlyVerified,false);assert.equal(result.profitabilityKnown,false);
assert(result.riskFlags.includes('customer_acceptance_unobserved'));
assert.deepEqual(analyzeComputeExperiment({...before,trials:[...before.trials].reverse()},{minQualityGainBps:400}),result,'Trial ordering does not bias matches');
assert.equal(analyzeComputeExperiment(before).recommendation,'hold_for_more_evidence');
const missing=dataset();missing.trials.pop();const missingResult=analyzeComputeExperiment(missing,{minQualityGainBps:0});assert.equal(missingResult.incompletePairs,1);assert.equal(missingResult.recommendation,'hold_for_more_evidence');
const failed=dataset();Object.assign(failed.trials[1],{status:'failed',scores:null,accepted:null});const failResult=analyzeComputeExperiment(failed,{minQualityGainBps:0});assert.equal(failResult.conditionTotals.candidate.failed,1);assert.equal(failResult.conditionTotals.candidate.knownCostUsdMicros,2000);assert.equal(failResult.recommendation,'hold_for_more_evidence','Failed paid calls cannot be hidden by successful pairs');
const unknown=dataset();Object.assign(unknown.trials[1],{status:'unknown',scores:null,costUsdMicros:null,latencyMs:null});assert.equal(analyzeComputeExperiment(unknown).conditionTotals.candidate.unknownCosts,1);
const unblind=dataset();unblind.trials[0].graderBlind=false;assert.equal(analyzeComputeExperiment(unblind,{minQualityGainBps:0}).recommendation,'hold_for_more_evidence');
const acceptance=dataset();for(const r of acceptance.trials)r.accepted=r.condition==='baseline';const badAcceptance=analyzeComputeExperiment(acceptance,{minQualityGainBps:0});assert.equal(badAcceptance.comparison.pairedAcceptanceDelta,-10);assert.equal(badAcceptance.recommendation,'hold_for_more_evidence');
assert.equal(analyzeComputeExperiment(before,{minQualityGainBps:0,maxIncrementalCostUsdMicros:99}).recommendation,'hold_for_more_evidence');
assert.equal(analyzeComputeExperiment(before,{minQualityGainBps:0,maxAdditionalLatencyMs:499}).recommendation,'hold_for_more_evidence');
for(const mutate of [
 d=>{d.trials.push(d.trials[0]);}, d=>{d.trials[0].order=1-d.trials[0].order;},d=>{d.trials[0].model='another';},
 d=>{d.trials[1].graderId='different';},d=>{d.trials[0].scores.accuracy=10001;},d=>{d.trials[0].costUsdMicros=-1;},
 d=>{d.trials[0].report='PRIVATE_REPORT';},d=>{d.plan.assignments[0].inputHash='a'.repeat(64);},d=>{d.trials[0].latencyMs=Infinity;},
]){const d=dataset();mutate(d);assert.throws(()=>analyzeComputeExperiment(d));}
assert.throws(()=>planComputeExperiment({...input,tasks:[input.tasks[0],{...input.tasks[0],taskId:'alias'}]}),'Repeated input hashes are not independent tasks');
assert.throws(()=>planComputeExperiment({...input,candidateModel:input.baselineModel}));
assert.throws(()=>analyzeComputeExperiment(before,{execute:true}));
const precise=dataset();for(const r of precise.trials)r.scores={accuracy:0,evidence:0,relevance:0,uncertainty:r.condition==='candidate'?1:0};
assert.equal(analyzeComputeExperiment(precise,{minQualityGainBps:1}).recommendation,'hold_for_more_evidence','Fractional score displays never round across threshold');
for(let seed=0;seed<100;seed++){
 const p=planComputeExperiment({...input,seed});assert.deepEqual(p,planComputeExperiment({...input,seed}));
 assert(p.assignments.every(a=>a.baselineOrder+a.candidateOrder===1));
 assert.equal(new Set(p.assignments.map(a=>a.pairId)).size,p.tasks.length);
}
console.log('computeexperiment PASS: reproducible matched plans, exact rubric thresholds, failure/unknown/cost/latency/acceptance gates, duplicate/privacy rejection and100seed plans');
