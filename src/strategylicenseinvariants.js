import crypto from 'node:crypto';
import { canonicalBytes } from './content/canonical.js';
import { DISTRICTS, priceBlock } from './rules.js';
import { intelForecastOutcome } from './intelforecasts.js';

// Fees are immediate paired game-cash transfers. Neither a license nor a score
// represents escrow, external backing, profit, or authority to operate its buyer.
export async function strategyLicenseFaults(pool) {
  const versions = (await pool.query('SELECT * FROM strategy_versions')).rows;
  const licenses = (await pool.query('SELECT * FROM strategy_licenses')).rows;
  const actors = new Map((await pool.query('SELECT id,account_id FROM characters')).rows.map(c => [c.id,c.account_id]));
  const ledger = (await pool.query("SELECT * FROM transactions WHERE reason LIKE 'strategy:%'")).rows;
  const byVersion = new Map(versions.map(v => [v.id,v])), byLicense = new Map(licenses.map(l => [l.id,l]));
  let faults = 0;
  for (const row of ledger) {
    const match = /^strategy:(buy|sell):(.+)$/.exec(row.reason);
    if (!match || !byLicense.has(match[2]) || row.currency !== 'cash' || !row.character_id || !Number.isFinite(Number(row.amount))) faults++;
  }
  for (const v of versions) {
    const r = v.rule, at = new Date(v.reported_at).getTime(), target = new Date(v.target_at).getTime(), fee = Number(v.fee_cash);
    if (!r || typeof r !== 'object' || Array.isArray(r)
      || Object.keys(r).sort().join(',') !== 'districtId,kind,minimumStock,triggerStock'
      || r.kind !== 'gin_availability_v1' || !DISTRICTS.some(d => d.id === r.districtId)
      || ![r.minimumStock,r.triggerStock].every(n => Number.isSafeInteger(n) && n >= 1 && n <= 40)) { faults++; continue; }
    if (actors.get(v.seller_character) !== v.seller_account || !Number.isSafeInteger(fee) || fee < 50 || fee > 5000
      || crypto.createHash('sha256').update(canonicalBytes(r)).digest('hex') !== v.rule_hash
      || !Number.isFinite(at) || target !== at + 300000 || priceBlock(at) !== Number(v.price_block) || priceBlock(target) !== Number(v.price_block)
      || new Date(v.created_at).getTime() !== at || v.observation?.districtId !== r.districtId
      || v.observation?.block !== Number(v.price_block) || new Date(v.observation?.observedAt).getTime() !== at
      || !Number.isFinite(v.observation?.stock) || v.observation.stock < 0
      || v.predicts_available !== (v.observation?.stock >= r.triggerStock)) faults++;
    if (v.outcome == null) {
      if (v.sample || v.sample_started_at || v.resolved_at) faults++;
    } else if (!['correct','incorrect','unknown'].includes(v.outcome) || !v.resolved_at) faults++;
    else if (v.outcome === 'unknown') {
      if (v.sample || v.sample_started_at) faults++;
    } else {
      const started = new Date(v.sample_started_at).getTime(), resolved = new Date(v.resolved_at).getTime();
      if (!v.sample || !Number.isFinite(started) || started < target || started > target + 30000 || resolved < started || resolved > target + 30000
        || new Date(v.sample?.observedAt).getTime() !== resolved || v.sample?.block !== Number(v.price_block)) faults++;
      try {
        if (intelForecastOutcome({districtId:r.districtId,minimumStock:r.minimumStock,targetAt:new Date(v.target_at).toISOString(),reportedAt:new Date(v.reported_at).toISOString(),
          predictsAvailable:v.predicts_available,observation:v.observation},v.sample,resolved) !== v.outcome) faults++;
      } catch { faults++; }
    }
  }
  for (const l of licenses) {
    const v = byVersion.get(l.version_id), fee = Number(l.fee_cash), rows = ledger.filter(r => r.reason === `strategy:buy:${l.id}` || r.reason === `strategy:sell:${l.id}`);
    if (!v || actors.get(l.buyer_character) !== l.buyer_account || actors.get(l.seller_paid_character) !== v?.seller_account
      || l.seller_paid_character !== v?.seller_character || l.buyer_account === v?.seller_account || fee !== Number(v?.fee_cash)
      || rows.length !== 2 || rows.filter(r => r.reason === `strategy:buy:${l.id}` && r.character_id === l.buyer_character && Number(r.amount) === -fee).length !== 1
      || rows.filter(r => r.reason === `strategy:sell:${l.id}` && r.character_id === l.seller_paid_character && Number(r.amount) === fee).length !== 1) faults++;
  }
  return faults;
}
