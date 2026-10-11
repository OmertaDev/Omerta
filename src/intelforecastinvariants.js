import { intelForecastOutcome } from './intelforecasts.js';

// Per-job reconciliation prevents compensating errors from hiding in the total.
export async function intelForecastAccounting(pool) {
  const jobs = (await pool.query('SELECT * FROM intel_forecast_jobs')).rows;
  const entries = (await pool.query("SELECT character_id,account_id,amount,reason,counterparty FROM transactions WHERE currency='cash' AND reason LIKE 'intel_job:%'")).rows;
  const known = new Set(jobs.map(job => job.id)), byJob = new Map();
  let invalid = 0, escrow = 0, expected = 0;
  for (const entry of entries) {
    if (!known.has(entry.counterparty)) invalid++;
    const list = byJob.get(entry.counterparty) || [];
    list.push(entry); byJob.set(entry.counterparty, list);
    const value = Number(entry.amount);
    if (entry.reason === 'intel_job:post') expected -= value;
    else if (['intel_job:pay','intel_job:refund'].includes(entry.reason)) expected -= value;
    else if (['intel_job:loot','intel_job:death'].includes(entry.reason)) expected += value;
    else invalid++;
  }
  for (const job of jobs) {
    const fee = Number(job.fee_cash), rows = byJob.get(job.id) || [];
    let bad = !Number.isInteger(fee) || fee < 50 || fee > 5000 || job.buyer_character === job.reporter_character;
    const of = reason => rows.filter(row => row.reason === `intel_job:${reason}`);
    const matches = (row, character, amount) => row?.character_id === character
      && row.account_id == null && Number(row.amount) === amount;
    const posted = of('post'), paid = of('pay'), refunded = of('refund'), looted = of('loot'), burned = of('death');
    if (posted.length !== 1 || !matches(posted[0], job.buyer_character, -fee)) bad = true;
    if (job.status === 'open') {
      escrow += fee;
      if (paid.length || refunded.length || looted.length || burned.length) bad = true;
    } else if (job.status === 'reported') {
      if (paid.length !== 1 || !matches(paid[0], job.reporter_character, fee)
          || refunded.length || looted.length || burned.length) bad = true;
    } else if (['cancelled','expired'].includes(job.status)) {
      if (refunded.length !== 1 || !matches(refunded[0], job.buyer_character, fee)
          || paid.length || looted.length || burned.length) bad = true;
    } else if (job.status === 'buyer_dead') {
      if (paid.length || refunded.length || looted.length > 1 || burned.length > 1
          || [...looted,...burned].some(row => row.character_id != null || row.account_id != null
            || !Number.isInteger(Number(row.amount)) || Number(row.amount) >= 0)
          || [...looted,...burned].reduce((total, row) => total - Number(row.amount), 0) !== fee) bad = true;
    } else bad = true;
    if (job.status === 'reported') {
      try {
        const targetAt = new Date(job.target_at).toISOString(), reportedAt = new Date(job.reported_at).toISOString();
        if (typeof job.predicts_available !== 'boolean' || job.observation?.observedAt !== reportedAt
            || job.observation?.districtId !== job.district_id || job.observation?.block !== job.price_block
            || Date.parse(reportedAt) > Date.parse(targetAt) - 60000) bad = true;
        if (job.outcome != null) {
          if (!['correct','incorrect','unknown'].includes(job.outcome) || job.resolved_at == null) bad = true;
          if (job.sample != null) {
            const started = new Date(job.sample_started_at).getTime(), sampled = Date.parse(job.sample.observedAt);
            if (started < Date.parse(targetAt) || started > sampled || sampled > Date.parse(targetAt) + 30000
                || job.outcome !== intelForecastOutcome({ districtId: job.district_id, minimumStock: Number(job.minimum_stock),
                  targetAt, reportedAt, predictsAvailable: job.predicts_available, observation: job.observation },
                job.sample, new Date(job.resolved_at).getTime())) bad = true;
          } else if (job.outcome !== 'unknown' || job.sample_started_at != null) bad = true;
        } else if (job.resolved_at != null || job.sample != null || job.sample_started_at != null) bad = true;
      } catch { bad = true; }
    } else if ([job.predicts_available,job.reported_at,job.observation,job.outcome,job.resolved_at,job.sample_started_at,job.sample]
      .some(value => value != null)) bad = true;
    if (bad) invalid++;
  }
  return { escrow, expected, invalid };
}
