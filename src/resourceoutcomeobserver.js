import { isDeepStrictEqual } from 'node:util';
import { reconcileShadowComputeOutcomes } from './computerouting.js';
const exact = (v, keys) => { if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).length !== keys.length || Object.keys(v).some(k => !keys.includes(k))) throw new Error('Invalid outcome record'); };
const identifier = v => typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,127}$/.test(v);
const number = v => Number.isSafeInteger(v) && v >= 0;
const date = v => v === null || typeof v === 'string' && v.length <= 32 && Number.isFinite(Date.parse(v));
const totalKeys = ['attemptsTotal','recordedChargeUsdMicros','recordedProviderCostUsdMicros','unresolvedAttempts','unknownChargeAttempts','unknownProviderCostAttempts'];
function totals(v, global = false) { exact(v, global ? ['jobsTotal', ...totalKeys] : totalKeys); if (!Object.values(v).every(number) || v.unresolvedAttempts > v.attemptsTotal || v.unknownChargeAttempts > v.attemptsTotal || v.unknownProviderCostAttempts > v.attemptsTotal) throw new Error('Invalid outcome totals'); }
function attempt(v, taskId) {
  exact(v,['taskId','attemptId','providerId','configuredModel','status','recordedChargeUsdMicros','recordedProviderCostUsdMicros','simulated','latencyMs','createdAt','settledAt']);
  if (v.taskId !== taskId || !identifier(v.attemptId) || !identifier(v.providerId) || v.configuredModel !== null && !identifier(v.configuredModel) || !['reserved','sending','succeeded','failed','unknown'].includes(v.status) || [v.recordedChargeUsdMicros,v.recordedProviderCostUsdMicros].some(n => n !== null && (!number(n) || n > 1000000000000)) || typeof v.simulated !== 'boolean' || v.latencyMs !== null || !date(v.createdAt) || !date(v.settledAt)) throw new Error('Invalid outcome attempt');
}
export function validateResourceOutcomeRecord(feed, accountId) {
  exact(feed,['version','accountId','asOf','mode','resourceMode','jobs','totals','coverage','limits','causalEffect','measurement']);
  if (feed.version !== 1 || feed.mode !== 'observe' || !identifier(accountId) || feed.accountId !== accountId || !date(feed.asOf) || feed.asOf === null || ![null,'test','live'].includes(feed.resourceMode) || feed.causalEffect !== null || typeof feed.measurement !== 'string' || feed.measurement.length > 256 || !Array.isArray(feed.jobs) || feed.jobs.length > 100) throw new Error('Invalid outcome feed');
  exact(feed.limits,['jobs','attemptsPerJob','attemptsTotal']);
  if (feed.limits.jobs !== 100 || feed.limits.attemptsPerJob !== 100 || feed.limits.attemptsTotal !== 1000) throw new Error('Invalid outcome limits');
  totals(feed.totals,true);
  exact(feed.coverage,['jobsTotal','jobsReturned','jobsTruncated','attemptsTotal','attemptsReturned','attemptsTruncated']);
  let details=0; const seen=new Set(), attemptOwners=new Map();
  for (const job of feed.jobs) {
    exact(job,['taskId','state','accepted','selectedAttemptId','selectedAttempt','attempts','totals','coverage']);
    if (!identifier(job.taskId) || seen.has(job.taskId) || !['open','claimed','submitted','accepted','disputed','refunded'].includes(job.state) || job.accepted !== (job.state==='accepted'?true:job.state==='disputed'?false:null) || !Array.isArray(job.attempts) || job.attempts.length > 100) throw new Error('Invalid outcome job');
    seen.add(job.taskId); totals(job.totals); exact(job.coverage,['attemptsTotal','attemptsReturned','attemptsTruncated']);
    const ids=new Set();for (const row of job.attempts) { attempt(row,job.taskId);if(ids.has(row.attemptId))throw new Error('Duplicate outcome attempt');ids.add(row.attemptId);if(attemptOwners.has(row.attemptId)&&attemptOwners.get(row.attemptId)!==job.taskId)throw new Error('Cross-task attempt');attemptOwners.set(row.attemptId,job.taskId); }
    if (job.selectedAttempt === null) { if(job.selectedAttemptId !== null)throw new Error('Invalid selected outcome'); }
    else { attempt(job.selectedAttempt,job.taskId);if(job.selectedAttemptId!==job.selectedAttempt.attemptId||job.totals.attemptsTotal===0)throw new Error('Invalid selected outcome');const detail=job.attempts.find(a=>a.attemptId===job.selectedAttemptId);if(!job.coverage.attemptsTruncated&&!detail)throw new Error('Selected attempt missing from full coverage');if(detail&&!isDeepStrictEqual(detail,job.selectedAttempt))throw new Error('Conflicting selected outcome');if(attemptOwners.has(job.selectedAttemptId)&&attemptOwners.get(job.selectedAttemptId)!==job.taskId)throw new Error('Cross-task selected attempt');attemptOwners.set(job.selectedAttemptId,job.taskId); }
    if (job.coverage.attemptsTotal!==job.totals.attemptsTotal || job.coverage.attemptsReturned!==job.attempts.length || job.coverage.attemptsTruncated!==(job.totals.attemptsTotal>job.attempts.length) || job.totals.attemptsTotal<job.attempts.length) throw new Error('Invalid outcome coverage');
    if(!job.coverage.attemptsTruncated) {
      const actual={attemptsTotal:job.attempts.length,recordedChargeUsdMicros:0,recordedProviderCostUsdMicros:0,unresolvedAttempts:0,unknownChargeAttempts:0,unknownProviderCostAttempts:0};
      for(const a of job.attempts){if(a.recordedChargeUsdMicros===null)actual.unknownChargeAttempts++;else actual.recordedChargeUsdMicros+=a.recordedChargeUsdMicros;if(a.recordedProviderCostUsdMicros===null)actual.unknownProviderCostAttempts++;else actual.recordedProviderCostUsdMicros+=a.recordedProviderCostUsdMicros;if(['reserved','sending','unknown'].includes(a.status))actual.unresolvedAttempts++;}
      if(!isDeepStrictEqual(actual,job.totals))throw new Error('Conflicting outcome totals');
    }
    details+=job.attempts.length;
  }
  const c=feed.coverage;
  if(details>1000 || c.jobsTotal!==feed.totals.jobsTotal || c.jobsReturned!==feed.jobs.length || c.jobsTotal<c.jobsReturned || c.jobsTruncated!==(c.jobsTotal>c.jobsReturned) || c.attemptsTotal!==feed.totals.attemptsTotal || c.attemptsReturned!==details || c.attemptsTotal<details || c.attemptsTruncated!==(c.attemptsTotal>details)) throw new Error('Invalid feed coverage');
  if(!c.jobsTruncated){for(const key of totalKeys){const sum=feed.jobs.reduce((n,j)=>n+j.totals[key],0);if(!number(sum)||sum!==feed.totals[key])throw new Error('Conflicting feed totals');}}
  return feed;
}
export function reconcileResourceOutcomeRecord(feed, routingInput, accountId) {
  validateResourceOutcomeRecord(feed,accountId);
  const observations=[];const taskIds=new Set(routingInput.tasks?.map(t=>t.taskId));
  for (const job of feed.jobs) {
    const selected=job.selectedAttempt;
    if (!taskIds.has(job.taskId) || !selected?.configuredModel) continue;
    const complete=job.totals.unresolvedAttempts===0 && job.totals.unknownChargeAttempts===0;
    observations.push({taskId:job.taskId,model:selected.configuredModel,status:complete&&selected.status==='succeeded'?'succeeded':selected.status==='failed'&&complete?'failed':'unknown',costUsdMicros:complete?job.totals.recordedChargeUsdMicros:null,latencyMs:null,accepted:complete&&selected.status==='succeeded'?job.accepted:null});
  }
  return { source:{accountId:feed.accountId,asOf:feed.asOf,resourceMode:feed.resourceMode,coverage:feed.coverage,totals:feed.totals,recordedModelIdentityOnly:true,independentlyVerified:false},reconciliation:reconcileShadowComputeOutcomes({version:1,routingInput,observations}),financialRequests:0,measurement:'Recorded job and attempt data; measured latency is unavailable, so routing promotion remains held. Live and simulated records remain labelled.' };
}
