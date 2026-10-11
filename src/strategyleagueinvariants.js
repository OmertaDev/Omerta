import crypto from 'node:crypto';
import { canonicalBytes } from './content/canonical.js';
import { DISTRICTS, priceBlock } from './rules.js';
import { intelForecastOutcome } from './intelforecasts.js';

// Cohorts bind immutable consent and a common prospective observation; no cash bucket.
export async function strategyLeagueFaults(pool) {
  const leagues = (await pool.query('SELECT * FROM strategy_leagues')).rows;
  const entries = (await pool.query('SELECT * FROM strategy_league_entries')).rows;
  const versions = new Map((await pool.query('SELECT * FROM strategy_versions')).rows.map(r => [r.id,r]));
  const licenses = new Map((await pool.query('SELECT * FROM strategy_licenses')).rows.map(r => [r.id,r]));
  const actors = new Map((await pool.query('SELECT id,account_id FROM characters')).rows.map(r => [r.id,r.account_id]));
  const byLeague = new Map(leagues.map(r => [r.id,r])), memberships = new Set(), active = new Set();
  const ms = value => value == null ? NaN : new Date(value).getTime();
  const digest = value => crypto.createHash('sha256').update(canonicalBytes(value)).digest('hex');
  let faults = 0;
  for (const e of entries) {
    const l = byLeague.get(e.league_id), v = versions.get(e.version_id), license = licenses.get(e.license_id);
    const identity = e.league_id + ':' + e.account_id;
    if (memberships.has(identity)) faults++; memberships.add(identity);
    if (!l || !v || actors.get(e.character_id) !== e.account_id) { faults++; continue; }
    const r = e.rule, fields = r && typeof r === 'object' && !Array.isArray(r) ? Object.keys(r).sort().join(',') : '';
    if (fields !== 'districtId,kind,minimumStock,triggerStock' || r.kind !== 'gin_availability_v1'
      || r.districtId !== l.district_id || r.minimumStock !== Number(l.minimum_stock)
      || !Number.isSafeInteger(r.triggerStock) || r.triggerStock < 1 || r.triggerStock > 40
      || digest(r) !== e.rule_hash || e.rule_hash !== v.rule_hash || digest(v.rule) !== e.rule_hash) faults++;
    if (e.license_id ? !license || license.version_id !== e.version_id || license.buyer_account !== e.account_id
      || ms(license.purchased_at) > ms(e.joined_at) : v.seller_account !== e.account_id) faults++;
    if (!Number.isFinite(ms(e.joined_at)) || ms(e.joined_at) < ms(l.created_at)
      || ms(e.joined_at) >= ms(l.enrollment_expires_at)
      || l.observed_at && ms(e.joined_at) > ms(l.observed_at)) faults++;
    if (l.observation && e.predicts_available !== (l.observation.stock >= r?.triggerStock)) faults++;
    if (!l.observation && e.predicts_available !== null) faults++;
    if (l.state !== 'resolved' && e.outcome !== null) faults++;
    if (l.state === 'resolved' && l.result_kind === 'unknown' && e.outcome !== 'unknown') faults++;
    if (l.state === 'resolved' && l.result_kind === 'graded') {
      if (!Number.isFinite(ms(l.target_at)) || !Number.isFinite(ms(l.observed_at))) { faults++; continue; }
      const outcome = intelForecastOutcome({ districtId:l.district_id, minimumStock:Number(l.minimum_stock),
        targetAt:new Date(l.target_at).toISOString(), reportedAt:new Date(l.observed_at).toISOString(),
        observation:l.observation, predictsAvailable:e.predicts_available }, l.sample, ms(l.resolved_at));
      if (outcome === 'unknown' || outcome !== e.outcome) faults++;
    }
  }
  for (const l of leagues) {
    const rows = entries.filter(e => e.league_id === l.id);
    if (actors.get(l.creator_character) !== l.creator_account || !DISTRICTS.some(d => d.id === l.district_id)
      || ms(l.enrollment_expires_at) !== ms(l.created_at) + 600000 || rows.length > 20) faults++;
    if (l.state !== 'resolved') { if (active.has(l.creator_account)) faults++; active.add(l.creator_account); }
    if (l.observation && (rows.length < 2 || ms(l.observed_at) >= ms(l.enrollment_expires_at)
      || ms(l.target_at) !== ms(l.observed_at) + 300000 || priceBlock(ms(l.observed_at)) !== Number(l.price_block)
      || priceBlock(ms(l.target_at)) !== Number(l.price_block) || ms(l.observation.observedAt) !== ms(l.observed_at))) faults++;
    if (l.result_kind === 'graded' && (!l.sample || ms(l.sample_started_at) < ms(l.target_at)
      || ms(l.resolved_at) < ms(l.sample_started_at) || ms(l.resolved_at) > ms(l.target_at) + 30000
      || ms(l.sample.observedAt) !== ms(l.resolved_at))) faults++;
  }
  return faults;
}
