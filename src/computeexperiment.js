import { isDeepStrictEqual } from 'node:util';
const PROTOCOL = 'market-analysis-quality-v1';
const WEIGHTS = Object.freeze({accuracy:4000,evidence:2500,relevance:2000,uncertainty:1500});
const identity = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,127}$/.test(value);
const integer = (value,min,max) => Number.isSafeInteger(value) && value>=min && value<=max;
const fail = () => { throw new Error('Invalid offline compute experiment'); };
function exact(value,keys) { if (!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).length!==keys.length || Object.keys(value).some(k=>!keys.includes(k))) fail(); }
export function planComputeExperiment(input) {
  exact(input,['baselineModel','candidateModel','seed','tasks']);
  if (!identity(input.baselineModel)||!identity(input.candidateModel)||input.baselineModel===input.candidateModel||!integer(input.seed,0,4294967295)||!Array.isArray(input.tasks)||input.tasks.length>100) fail();
  const tasks=input.tasks.map(task=>{exact(task,['taskId','inputHash']);if(!identity(task.taskId)||typeof task.inputHash!=='string'||!/^[a-f0-9]{64}$/.test(task.inputHash))fail();return {taskId:task.taskId,inputHash:task.inputHash};}).sort((a,b)=>a.taskId<b.taskId?-1:a.taskId>b.taskId?1:0);
  if(new Set(tasks.map(t=>t.taskId)).size!==tasks.length||new Set(tasks.map(t=>t.inputHash)).size!==tasks.length)fail();
  let state=input.seed;
  const assignments=tasks.map((task,index)=>{state=(Math.imul(state,1664525)+1013904223)>>>0;const baselineOrder=state>>>31;return {pairId:`pair_${index+1}`,taskId:task.taskId,inputHash:task.inputHash,baselineOrder,candidateOrder:1-baselineOrder};});
  return {version:1,mode:'offline',protocol:PROTOCOL,seed:input.seed,baselineModel:input.baselineModel,candidateModel:input.candidateModel,tasks,assignments};
}
function policyOf(input={}) {
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['minimumPairs','minQualityGainBps','maxIncrementalCostUsdMicros','maxAdditionalLatencyMs'].includes(k)))fail();
  const p={minimumPairs:5,minQualityGainBps:500,maxIncrementalCostUsdMicros:10000,maxAdditionalLatencyMs:5000,...input};
  if(!integer(p.minimumPairs,1,100)||!integer(p.minQualityGainBps,0,10000)||!integer(p.maxIncrementalCostUsdMicros,0,1000000000000)||!integer(p.maxAdditionalLatencyMs,0,86400000))fail();
  return p;
}
function gradeUnits(scores) {exact(scores,Object.keys(WEIGHTS));if(Object.values(scores).some(v=>!integer(v,0,10000)))fail();return Number(Object.entries(WEIGHTS).reduce((sum,[key,weight])=>sum+BigInt(scores[key])*BigInt(weight),0n));}
export function analyzeComputeExperiment(dataset,input={}) {
  exact(dataset,['version','plan','trials']);if(dataset.version!==1||!Array.isArray(dataset.trials)||dataset.trials.length>200)fail();
  const plan=dataset.plan;
  exact(plan,['version','mode','protocol','seed','baselineModel','candidateModel','tasks','assignments']);
  const expected=planComputeExperiment({baselineModel:plan.baselineModel,candidateModel:plan.candidateModel,seed:plan.seed,tasks:plan.tasks});
  if(!isDeepStrictEqual(plan,expected))fail();
  const policy=policyOf(input),groups=new Map(plan.assignments.map(a=>[a.pairId,{assignment:a}]));
  const counts={baseline:{succeeded:0,failed:0,unknown:0,knownCostUsdMicros:0,unknownCosts:0},candidate:{succeeded:0,failed:0,unknown:0,knownCostUsdMicros:0,unknownCosts:0}};
  for(const row of dataset.trials){
    exact(row,['pairId','condition','model','order','graderId','graderBlind','status','costUsdMicros','latencyMs','scores','accepted']);
    const group=groups.get(row.pairId);
    if(!group||!['baseline','candidate'].includes(row.condition)||group[row.condition]||!identity(row.graderId)||typeof row.graderBlind!=='boolean'||!['succeeded','failed','unknown'].includes(row.status)||row.model!==plan[row.condition+'Model']||row.order!==group.assignment[row.condition+'Order'])fail();
    if(row.costUsdMicros!==null&&!integer(row.costUsdMicros,0,1000000000000)||row.latencyMs!==null&&!integer(row.latencyMs,0,86400000)||row.accepted!==null&&typeof row.accepted!=='boolean')fail();
    if(row.status==='succeeded'){gradeUnits(row.scores);if(row.costUsdMicros===null||row.latencyMs===null)fail();}
    else if(row.scores!==null||row.accepted!==null)fail();
    group[row.condition]=row;const c=counts[row.condition];c[row.status]++;if(row.costUsdMicros===null)c.unknownCosts++;else c.knownCostUsdMicros+=row.costUsdMicros;
  }
  const pairs=[];let qualityGainUnits=0,incompletePairs=0,unblindedPairs=0;const orderCounts={baselineFirst:0,candidateFirst:0};
  for(const [pairId,group] of groups){const a=group.baseline,b=group.candidate;
    if(!a||!b||a.status!=='succeeded'||b.status!=='succeeded'){incompletePairs++;continue;}
    if(a.graderId!==b.graderId)fail();
    const blind=a.graderBlind&&b.graderBlind;if(!blind)unblindedPairs++;
    orderCounts[group.assignment.baselineOrder===0?'baselineFirst':'candidateFirst']++;
    qualityGainUnits+=gradeUnits(b.scores)-gradeUnits(a.scores);
    pairs.push({pairId,taskId:group.assignment.taskId,inputHash:group.assignment.inputHash,baselineScoreBps:gradeUnits(a.scores)/10000,candidateScoreBps:gradeUnits(b.scores)/10000,qualityGainBps:(gradeUnits(b.scores)-gradeUnits(a.scores))/10000,incrementalCostUsdMicros:b.costUsdMicros-a.costUsdMicros,additionalLatencyMs:b.latencyMs-a.latencyMs,declaredBlindGrading:blind,baselineAccepted:a.accepted,candidateAccepted:b.accepted});
  }
  const sum=key=>pairs.reduce((s,p)=>s+p[key],0),mean=key=>pairs.length?sum(key)/pairs.length:null;
  const acceptancePairs=pairs.filter(p=>p.baselineAccepted!==null&&p.candidateAccepted!==null);
  const acceptanceDelta=acceptancePairs.reduce((total,p)=>total+Number(p.candidateAccepted)-Number(p.baselineAccepted),0);
  const flags=['operator_supplied_grades_unverified','outside_costs_incomplete'];
  if(pairs.length<policy.minimumPairs)flags.push('insufficient_matched_pairs');if(incompletePairs)flags.push('incomplete_or_failed_trials');if(unblindedPairs)flags.push('unblinded_grading');if(!orderCounts.baselineFirst||!orderCounts.candidateFirst)flags.push('assignment_order_not_balanced');
  if(acceptancePairs.length<pairs.length)flags.push('customer_acceptance_unobserved');
  if(acceptanceDelta<0)flags.push('candidate_acceptance_regressed');
  const evidenceReady=pairs.length>=policy.minimumPairs&&!incompletePairs&&!unblindedPairs&&orderCounts.baselineFirst>0&&orderCounts.candidateFirst>0;
  const thresholdsMet=evidenceReady&&acceptanceDelta>=0&&qualityGainUnits>=policy.minQualityGainBps*10000*pairs.length&&sum('incrementalCostUsdMicros')<=policy.maxIncrementalCostUsdMicros*pairs.length&&sum('additionalLatencyMs')<=policy.maxAdditionalLatencyMs*pairs.length;
  return {version:1,mode:'offline',protocol:PROTOCOL,rubricWeights:WEIGHTS,policy,baselineModel:plan.baselineModel,candidateModel:plan.candidateModel,plannedPairs:plan.assignments.length,matchedPairs:pairs.length,incompletePairs,orderCounts,conditionTotals:counts,pairs,
    comparison:{meanQualityGainBps:pairs.length?qualityGainUnits/(10000*pairs.length):null,meanIncrementalCostUsdMicros:mean('incrementalCostUsdMicros'),meanAdditionalLatencyMs:mean('additionalLatencyMs'),baselineAccepted:pairs.filter(p=>p.baselineAccepted===true).length,candidateAccepted:pairs.filter(p=>p.candidateAccepted===true).length,acceptanceComparablePairs:acceptancePairs.length,pairedAcceptanceDelta:acceptanceDelta,acceptanceUnobserved:pairs.filter(p=>p.baselineAccepted===null||p.candidateAccepted===null).length},
    recommendation:thresholdsMet?'review_candidate':'hold_for_more_evidence',eligibleToExecute:false,financialRequests:0,independentlyVerified:false,causalEffect:null,profitabilityKnown:false,riskFlags:flags,measurement:'Matched offline comparisons of operator-supplied results; no provider calls, model-policy change or proven causal uplift.'};
}
