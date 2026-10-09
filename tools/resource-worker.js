import { expireResourceBounty } from '../src/resourcelabor.js';
import { pathToFileURL } from 'node:url';
import { makeDb } from '../src/db.js';
import { sweepResourceCompute } from '../src/resourcecompute.js';
import { expireResourceJob } from '../src/resourcework.js';

// Recovery continues when intake is disabled. Never resend unknown inference.
export async function resourceTick(pool, { after = null, afterBounties = null } = {}) {
  await sweepResourceCompute(pool);
  // Advance past held escrows rather than repeatedly selecting the first hundred.
  const due = after
    ? (await pool.query("SELECT id,created_at FROM resource_jobs WHERE ((state IN ('open','claimed') AND expires_at<=now()) OR (state='submitted' AND accept_after<=now())) AND (created_at>$1 OR (created_at=$1 AND id>$2)) ORDER BY created_at,id LIMIT 100", [after.createdAt, after.id])).rows
    : (await pool.query("SELECT id,created_at FROM resource_jobs WHERE (state IN ('open','claimed') AND expires_at<=now()) OR (state='submitted' AND accept_after<=now()) ORDER BY created_at,id LIMIT 100")).rows;
  for (const job of due) {
    try { await expireResourceJob(pool, job.id); }
    catch (error) {
      if (error.code !== 'resource_frozen') throw error;
      console.error('Resource escrow held for payment investigation:', job.id);
    }
  }
  const bounties = afterBounties
    ? (await pool.query("SELECT id,created_at FROM resource_bounties WHERE state='open' AND expires_at<=now() AND (created_at>$1 OR (created_at=$1 AND id>$2)) ORDER BY created_at,id LIMIT 100", [afterBounties.createdAt, afterBounties.id])).rows
    : (await pool.query("SELECT id,created_at FROM resource_bounties WHERE state='open' AND expires_at<=now() ORDER BY created_at,id LIMIT 100")).rows;
  for (const bounty of bounties) await expireResourceBounty(pool, bounty.id);
  const lastBounty = bounties.at(-1);
  const last = due.at(-1);
  return { inspectedBounties: bounties.length, nextBountyCursor: lastBounty ? { createdAt: lastBounty.created_at, id: lastBounty.id } : null, inspectedJobs: due.length, nextCursor: last ? { createdAt: last.created_at, id: last.id } : null };
}
export async function runResourceWorker() {
  const pool = await makeDb();
  let stopped = false;
  let after = null;
  let afterBounties = null;
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { stopped = true; });
  try {
    while (!stopped) {
      try { const tick = await resourceTick(pool, { after, afterBounties }); after = tick.nextCursor; afterBounties = tick.nextBountyCursor; }
      catch (error) { console.error('Resource recovery tick failed:', error.code || error.name); }
      for (let seconds = 0; seconds < 30 && !stopped; seconds++) await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } finally { await pool.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await runResourceWorker();
