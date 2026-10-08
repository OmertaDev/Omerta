import { pathToFileURL } from 'node:url';
import { makeDb } from '../src/db.js';
import { sweepResourceCompute } from '../src/resourcecompute.js';
import { expireResourceJob } from '../src/resourcework.js';

// Recovery continues when intake is disabled. Never resend unknown inference.
export async function resourceTick(pool) {
  await sweepResourceCompute(pool);
  const due = (await pool.query("SELECT id FROM resource_jobs WHERE (state IN ('open','claimed') AND expires_at<=now()) OR (state='submitted' AND accept_after<=now()) ORDER BY created_at LIMIT 100")).rows;
  for (const job of due) {
    try { await expireResourceJob(pool, job.id); }
    catch (error) {
      if (error.code !== 'resource_frozen') throw error;
      console.error('Resource escrow held for payment investigation:', job.id);
    }
  }
  return { inspectedJobs: due.length };
}
export async function runResourceWorker() {
  const pool = await makeDb();
  let stopped = false;
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { stopped = true; });
  try {
    while (!stopped) {
      try { await resourceTick(pool); }
      catch (error) { console.error('Resource recovery tick failed:', error.code || error.name); }
      for (let seconds = 0; seconds < 30 && !stopped; seconds++) await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } finally { await pool.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await runResourceWorker();
