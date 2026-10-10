import { resourceTransaction, resourceError } from './resourcebook.js';

const LIMITS = { jobs: 100, attemptsPerJob: 100, attemptsTotal: 1000 };
const time = value => value ? new Date(value).toISOString() : null;
const number = value => {
  const result = Number(value || 0);
  if (!Number.isSafeInteger(result) || result < 0) throw resourceError('metrics', 'Outcome metrics exceed exact integer bounds.');
  return result;
};
const nullable = value => value === null || value === undefined ? null : number(value);
const attempt = (row, taskId) => ({ taskId, attemptId: row.id, providerId: row.provider_id,
  configuredModel: row.configured_model || null, status: row.status,
  recordedChargeUsdMicros: nullable(row.cost_usd_micros), recordedProviderCostUsdMicros: nullable(row.provider_cost_usd_micros),
  simulated: row.simulated, latencyMs: null, createdAt: time(row.created_at), settledAt: time(row.settled_at) });
function totals(rows) {
  const result = { attemptsTotal: 0, recordedChargeUsdMicros: 0, recordedProviderCostUsdMicros: 0,
    unresolvedAttempts: 0, unknownChargeAttempts: 0, unknownProviderCostAttempts: 0 };
  for (const row of rows) {
    result.attemptsTotal += number(row.count);
    result.recordedChargeUsdMicros += number(row.charge);
    result.recordedProviderCostUsdMicros += number(row.provider_cost);
    result.unknownChargeAttempts += number(row.count) - number(row.known_charge);
    result.unknownProviderCostAttempts += number(row.count) - number(row.known_provider_cost);
    if (['reserved', 'sending', 'unknown'].includes(row.status)) result.unresolvedAttempts += number(row.count);
  }
  for (const value of Object.values(result)) number(value);
  return result;
}

export async function resourceOutcomes(pool, account) {
  return resourceTransaction(pool, async client => {
    const treasury = (await client.query('SELECT mode FROM resource_treasuries WHERE account_id=$1 FOR UPDATE', [account])).rows[0];
    const asOf = new Date().toISOString();
    const jobCount = number((await client.query('SELECT COUNT(*) AS count FROM resource_jobs WHERE seller_account=$1', [account])).rows[0].count);
    const jobs = (await client.query('SELECT id,state,call_id FROM resource_jobs WHERE seller_account=$1 ORDER BY created_at DESC,id LIMIT 100', [account])).rows;
    const globalRows = (await client.query("SELECT c.status,COUNT(*) AS count,COUNT(c.cost_usd_micros) AS known_charge,COUNT(c.provider_cost_usd_micros) AS known_provider_cost,SUM(c.cost_usd_micros) AS charge,SUM(c.provider_cost_usd_micros) AS provider_cost FROM resource_calls c JOIN resource_jobs j ON c.purpose->>'jobId'=j.id WHERE j.seller_account=$1 AND c.account_id=$1 AND c.purpose->>'kind'='paid_market_analysis' GROUP BY c.status", [account])).rows;
    const globalTotals = totals(globalRows);
    const views = []; let returned = 0;
    for (const job of jobs) {
      const aggregate = (await client.query("SELECT status,COUNT(*) AS count,COUNT(cost_usd_micros) AS known_charge,COUNT(provider_cost_usd_micros) AS known_provider_cost,SUM(cost_usd_micros) AS charge,SUM(provider_cost_usd_micros) AS provider_cost FROM resource_calls WHERE account_id=$1 AND purpose->>'kind'='paid_market_analysis' AND purpose->>'jobId'=$2 GROUP BY status", [account, job.id])).rows;
      const jobTotals = totals(aggregate);
      const rows = returned < LIMITS.attemptsTotal ? (await client.query("SELECT id,provider_id,config->>'model' AS configured_model,status,cost_usd_micros,provider_cost_usd_micros,simulated,created_at,settled_at FROM resource_calls WHERE account_id=$1 AND purpose->>'kind'='paid_market_analysis' AND purpose->>'jobId'=$2 ORDER BY created_at DESC,id LIMIT $3", [account, job.id, Math.min(LIMITS.attemptsPerJob, LIMITS.attemptsTotal - returned)])).rows : [];
      const selected = job.call_id ? (await client.query("SELECT id,provider_id,config->>'model' AS configured_model,status,cost_usd_micros,provider_cost_usd_micros,simulated,created_at,settled_at FROM resource_calls WHERE id=$1 AND account_id=$2 AND purpose->>'kind'='paid_market_analysis' AND purpose->>'jobId'=$3", [job.call_id, account, job.id])).rows[0] : null;
      returned += rows.length;
      views.push({ taskId: job.id, state: job.state, accepted: job.state === 'accepted' ? true : job.state === 'disputed' ? false : null,
        selectedAttemptId: selected?.id || null,
        selectedAttempt: selected ? attempt(selected, job.id) : null,
        attempts: rows.map(row => attempt(row, job.id)),
        totals: jobTotals, coverage: { attemptsTotal: jobTotals.attemptsTotal, attemptsReturned: rows.length, attemptsTruncated: jobTotals.attemptsTotal > rows.length } });
    }
    const result = { version: 1, accountId: account, asOf, mode: 'observe', resourceMode: treasury?.mode || null,
      jobs: views, totals: { jobsTotal: jobCount, ...globalTotals },
      coverage: { jobsTotal: jobCount, jobsReturned: jobs.length, jobsTruncated: jobCount > jobs.length,
        attemptsTotal: globalTotals.attemptsTotal, attemptsReturned: returned, attemptsTruncated: globalTotals.attemptsTotal > returned },
      limits: { ...LIMITS }, causalEffect: null,
      measurement: 'Recorded resource receipts and job states; latency and blinded quality scores were not collected.' };
    if (Buffer.byteLength(JSON.stringify(result)) > 1048576) throw resourceError('metrics', 'Outcome detail exceeds the response limit.');
    return result;
  });
}
