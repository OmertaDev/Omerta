import { GameError } from './game.js';
import { DEED_UPGRADES, BROKERS, ACTIVITY, activityQualifies, deedRenown, dayOf } from './rules.js';
import { spendOmr } from './vanity.js';

// Ownership follows the same observed-owner / extractor fallback as delivery.
export async function rewardDeeds(client) {
  const deeds = (await client.query('SELECT * FROM street_deeds')).rows;
  const wallets = (await client.query('SELECT account_id, wallet_address, reward_wallet_since_day FROM account_persistent WHERE wallet_address IS NOT NULL')).rows;
  const byWallet = new Map(wallets.map(w => [String(w.wallet_address).toLowerCase(), w.account_id]));
  const walletDays = new Map(wallets.map(w => [String(w.wallet_address).toLowerCase(), Number(w.reward_wallet_since_day || 0)]));
  return deeds.map(d => ({ ...d, walletOwnershipDay: d.onchain_token_id && d.onchain_owner ? walletDays.get(String(d.onchain_owner).toLowerCase()) || 0 : 0, rewardAccount: d.onchain_token_id
    ? (d.onchain_owner ? byWallet.get(String(d.onchain_owner).toLowerCase()) || null : d.extracted_by_account || null)
    : d.account_id }));
}
export async function upgradeWeights(client, fromDay) {
  const events = (await client.query('SELECT deed_name, level, bonus_bps, effective_from_day FROM deed_upgrades')).rows;
  const byName = new Map();
  for (const e of events) if (Number(e.effective_from_day) <= fromDay)
    byName.set(e.deed_name, Math.max(byName.get(e.deed_name) || 0, Number(e.bonus_bps)));
  const out = new Map();
  for (const d of await rewardDeeds(client)) {
    if (!d.rewardAccount) continue;
    const ownershipDay = Math.max(d.walletOwnershipDay, d.ownership_since_day == null ? Math.floor(new Date(d.claimed_at).getTime() / 86400000) : Number(d.ownership_since_day));
    const bps = ownershipDay <= fromDay ? byName.get(d.name) || 0 : 0;
    out.set(d.rewardAccount, Math.max(out.get(d.rewardAccount) || 0, bps));
  }
  return out;
}
export async function upgradeBoard(client, accountId, { deedName, fromDay = dayOf() - BROKERS.EPOCH_DAYS + 1 } = {}) {
  const owned = (await rewardDeeds(client)).filter(d => d.rewardAccount === accountId);
  const d = deedName ? owned.find(d => d.name === deedName) : owned.sort((a,b) => new Date(b.extracted_at || b.claimed_at) - new Date(a.extracted_at || a.claimed_at))[0];
  const events = d ? (await client.query('SELECT level, bonus_bps, effective_from_day FROM deed_upgrades WHERE deed_name=$1 ORDER BY level DESC', [d.name])).rows : [];
  const level = Number(events[0]?.level || 0);
  const ownershipDay = d ? Math.max(d.walletOwnershipDay, d.ownership_since_day == null ? Math.floor(new Date(d.claimed_at).getTime() / 86400000) : Number(d.ownership_since_day)) : Infinity;
  const effectiveBonusBps = ownershipDay > fromDay ? 0 : Math.max(0, ...events.filter(e => Number(e.effective_from_day) <= fromDay).map(e => Number(e.bonus_bps)));
  const activity = (await client.query('SELECT tag, SUM(n) AS n FROM activity_log WHERE account_id=$1 AND day >= $2 AND day <= $3 GROUP BY tag', [accountId, dayOf() - BROKERS.EPOCH_DAYS + 1, dayOf()])).rows;
  const gains = Object.fromEntries(activity.map(r => [r.tag, Number(r.n)]));
  const a = (await client.query('SELECT agent_flag, npc_flag, omr FROM account_persistent WHERE account_id=$1', [accountId])).rows[0] || {};
  const activityQualified = !(ACTIVITY.EXCLUDE_AGENTS && a.agent_flag) && !(ACTIVITY.EXCLUDE_NPC && a.npc_flag) && activityQualifies(gains);
  const history = d ? (await client.query('SELECT kind FROM street_deed_history WHERE account_id=$1', [d.account_id])).rows : [];
  const nextTier = DEED_UPGRADES[level] || null;
  const blocked = !d ? 'not_deed_owner' : d.sale_price != null ? 'deed_listed' : !activityQualified ? 'not_enough_play' : nextTier && deedRenown(history) < nextTier.minRenown ? 'not_enough_renown' : nextTier && Number(a.omr || 0) < nextTier.costOmr ? 'insufficient_omr' : null;
  return { deedName: d?.name || null, level, maxLevel: 5, bonusBps: Number(events[0]?.bonus_bps || 0), effectiveBonusBps,
    effectiveFromDay: events[0] ? Number(events[0].effective_from_day) : null,
    next: nextTier ? { ...nextTier, eligible: !blocked, blocked } : null,
    activityQualified, account: { omr: Number(a.omr || 0) }, canUpgrade: !!nextTier && !blocked };
}
export async function upgradeDeed(ch, body, client, h) {
  if (typeof body?.deedName !== 'string' || !body.deedName) throw new GameError('deed_name', 'Identify the deed before spending.');
  if (!Number.isInteger(body?.expectedLevel) || body.expectedLevel < 0 || body.expectedLevel > 4)
    throw new GameError('expected_level', 'Send the current deed upgrade level before spending.');
  const initial = await upgradeBoard(client, ch.account_id, { deedName: body?.deedName });
  if (!initial.deedName) throw new GameError('not_deed_owner', 'Only the current deed owner can upgrade it.');
  await client.query('SELECT name FROM street_deeds WHERE name=$1 FOR UPDATE', [initial.deedName]);
  const board = await upgradeBoard(client, ch.account_id, { deedName: initial.deedName });
  if (board.level !== body.expectedLevel) throw new GameError('stale_upgrade', 'The deed level changed. Refresh before upgrading.');
  if (!board.canUpgrade) throw new GameError(board.next?.blocked || 'max_upgrade', 'Meet the deed ownership, renown and seven-day gameplay requirements before upgrading.');
  const t = board.next;
  await spendOmr(client, h, t.costOmr, 'deed:upgrade');
  const effectiveFromDay = dayOf() + 1;
  await client.query('INSERT INTO deed_upgrades (deed_name, level, bonus_bps, cost_omr, account_id, effective_from_day) VALUES ($1,$2,$3,$4,$5,$6)',
    [board.deedName, t.level, t.bonusBps, t.costOmr, ch.account_id, effectiveFromDay]);
  return { ok: true, deedName: board.deedName, level: t.level, costOmr: t.costOmr, bonusBps: t.bonusBps, effectiveFromDay };
}
