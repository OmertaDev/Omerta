// Read-only evidence for the original worker's one-character season transaction.
// A recap is status; only a positive, receipt-bound prestige delta is a grant.
import assert from 'node:assert/strict';
import { DUELS, levelOf, recapTitleOf } from '../src/rules.js';
import { exactSum } from './rc1-resource-journal.js';
import { verifyDuelAward } from './rc1-duel-selection-provenance.js';

const rows = (state, table) => { assert(Array.isArray(state.tables[table]), `Missing season evidence table ${table}`); return state.tables[table]; };
const recapKey = row => JSON.stringify([row.account_id, row.season]);
const index = (values, key, label) => {
  const result = new Map();
  for (const row of values) { const id = key(row); assert(!result.has(id), `Duplicate season ${label}: ${id}`); result.set(id, row); }
  return result;
};
const changed = (a, b) => JSON.stringify(a) !== JSON.stringify(b);
const zeroOf = value => typeof value === 'string' ? '0' : 0;
const timestamp = value => { const at = Date.parse(value); assert(Number.isFinite(at), 'Invalid season receipt timestamp'); return at; };

export function reconcileSeasonConversions(before, after, { identity = null, duelSelection = null } = {}) {
  const checks = [], movements = [], unsupported = [];
  const result = { checks, movements, unsupported };
  const oldRecaps = index(rows(before, 'season_recaps'), recapKey, 'recap identity');
  const newRecaps = index(rows(after, 'season_recaps'), recapKey, 'recap identity');
  for (const [key, row] of oldRecaps) assert.deepEqual(newRecaps.get(key), row, 'Immutable season recap changed or disappeared');
  const added = [...newRecaps.values()].filter(row => !oldRecaps.has(recapKey(row)));
  const oldTelemetry = index(rows(before, 'telemetry'), row => row.id, 'telemetry identity');
  const newTelemetry = index(rows(after, 'telemetry'), row => row.id, 'telemetry identity');
  // Retention may remove old telemetry in a separate canonical prune. A retained
  // ID may never be edited/reused; conversion scope below permits no pruning.
  for (const [id, row] of oldTelemetry) if (row.event === 'season_convert' && newTelemetry.has(id))
    assert.deepEqual(newTelemetry.get(id), row, 'Immutable season conversion receipt changed');
  const receipts = [...newTelemetry.values()].filter(row => !oldTelemetry.has(row.id) && row.event === 'season_convert');
  if (!added.length && !receipts.length) return result;
  const incomplete = detail => { unsupported.push({ kind: 'season-conversion-compound', table: 'season_recaps', detail }); return result; };
  if (added.length !== 1) return incomplete('Only one fresh account/season recap per original character transaction is classified; existing recap, multiple conversion or unmatched receipt remains unsupported');
  const recap = added[0];
  assert.equal(receipts.length, 1, 'Fresh season recap requires exactly one unused conversion receipt');
  const receipt = receipts[0];
  assert.equal(receipt.account_id, recap.account_id, 'Season receipt/recap owner mismatch');
  assert.equal(receipt.event, 'season_convert');
  assert.equal(typeof receipt.props, 'string', 'Season conversion payload must retain original JSON text');
  const payload = JSON.parse(receipt.props), current = payload.season;
  assert(Number.isSafeInteger(current) && current > 0, 'Invalid season conversion target');
  assert.equal(recap.season, current - 1, 'Recap is not for the just-closed season');
  assert.deepEqual(Object.keys(recap).sort(), ['account_id', 'season', 'level', 'kills', 'prestige_gained', 'title', 'at'].sort(), 'Unclassified recap fields');
  assert.equal(timestamp(recap.at), timestamp(receipt.at), 'Season recap/receipt transaction timestamps differ');

  const priorPeople = index(rows(before, 'characters'), row => row.id, 'character identity');
  const finalPeople = index(rows(after, 'characters'), row => row.id, 'character identity');
  const candidates = [...priorPeople.values()].filter(row => row.account_id === recap.account_id && row.alive && row.season < current);
  assert(candidates.length > 0, 'Season receipt has no eligible prior character owner');
  if (candidates.length !== 1) return incomplete('Account receipt cannot uniquely identify multiple eligible living characters');
  const prior = candidates[0], final = finalPeople.get(prior.id);
  assert(final && final.account_id === prior.account_id, 'Season character custody changed');
  assert(Number.isFinite(Number(prior.respect)), 'Invalid prior respect');
  const level = levelOf(Number(prior.respect)), legacy = Math.floor(level / 2);
  assert(Number.isSafeInteger(level) && Number.isSafeInteger(legacy), 'Season conversion exceeds exact integer range');
  assert.deepEqual(payload, { season: current, legacy }, 'Season conversion receipt differs from canonical inputs');
  assert.equal(receipt.props, JSON.stringify({ season: current, legacy }), 'Season receipt payload differs from original writer');
  assert.equal(recap.level, level, 'Recap level differs from canonical respect curve');
  assert.equal(recap.kills, Number(prior.season_kills || 0), 'Recap kills differ from prior character');
  assert.equal(recap.prestige_gained, legacy, 'Recap prestige differs from canonical level conversion');
  assert.equal(recap.title, recapTitleOf(level), 'Recap title differs from canonical title band');
  assert.equal(final.respect, zeroOf(prior.respect), 'Season respect was not reset');
  assert.equal(final.season_kills, 0, 'Season kills were not reset');
  assert.equal(final.duel_elo, DUELS.ELO_START, 'Season Elo differs from canonical reset');
  assert.equal(final.season, current, 'Season target marker differs');

  const priorAccounts = index(rows(before, 'account_persistent'), row => row.account_id, 'account identity');
  const finalAccounts = index(rows(after, 'account_persistent'), row => row.account_id, 'account identity');
  const account = priorAccounts.get(prior.account_id), nextAccount = finalAccounts.get(prior.account_id);
  assert(account && nextAccount, 'Season conversion account is absent');
  assert(Number.isSafeInteger(account.prestige) && Number.isSafeInteger(nextAccount.prestige), 'Prestige must remain exact integers');
  assert.equal(exactSum([nextAccount.prestige, -account.prestige, -legacy]), '0', 'Season prestige credited to wrong owner or wrong amount');
  assert.equal(nextAccount.season_sunk, zeroOf(account.season_sunk), 'Season prestige-spend counter was not reset');
  // These additional account/character effects are real but not attributable by
  // this receipt. Keep their boundary unclassified rather than dropping fields.
  let duelNotice = null;
  if (!Object.is(account.duel_titles, nextAccount.duel_titles)) {
    if (!duelSelection) return incomplete('Duel-title award needs its separate champion/notification authority');
    duelNotice = verifyDuelAward(before, after, prior, nextAccount, account, current, identity, duelSelection);
  }
  if (changed(final, { ...prior, respect: zeroOf(prior.respect), season_kills: 0, duel_elo: DUELS.ELO_START, season: current })
      || changed(nextAccount, { ...account, prestige: account.prestige + legacy, season_sunk: zeroOf(account.season_sunk), ...(duelNotice ? { duel_titles: account.duel_titles + 1 } : {}) }))
    return incomplete('Additional same-owner character/account fields changed outside the exact conversion projection');
  for (const [a, b, owner] of [[priorPeople, finalPeople, prior.id], [priorAccounts, finalAccounts, prior.account_id]]) {
    if (a.size !== b.size || [...a].some(([id, row]) => id !== owner && changed(row, b.get(id))))
      return incomplete('Other character/account custody changed at the conversion boundary');
  }
  if (oldTelemetry.size + 1 !== newTelemetry.size || [...oldTelemetry].some(([id, row]) => changed(row, newTelemetry.get(id))))
    return incomplete('Other telemetry creation/pruning/change overlaps the conversion receipt');
  // All other observed tables must be unchanged: no balancing an unrelated
  // currency movement or a second authority against this conversion receipt.
  for (const table of new Set([...Object.keys(before.tables), ...Object.keys(after.tables)])) {
    if (['characters', 'account_persistent', 'telemetry', 'season_recaps', ...(duelNotice ? ['notifications'] : [])].includes(table)) continue;
    if (changed(before.tables[table], after.tables[table])) return incomplete(`Other observed table changed: ${table}`);
  }
  const authority = [{ table: 'telemetry', id: receipt.id }, { table: 'season_recaps', accountId: recap.account_id, season: recap.season },
    { rule: 'src/worker.js runSeasonRollover; levelOf, floor(level/2), recapTitleOf, DUELS.ELO_START' }];
  if (legacy > 0) checks.push({ kind: 'season-exact-prestige-source', resource: 'prestige', owner: `account:${prior.account_id}`,
    before: String(account.prestige), after: String(nextAccount.prestige), expectedDelta: String(legacy), drift: '0', authority });
  if (duelNotice) movements.push({ kind: 'season-duel-title', accountId: prior.account_id, characterId: prior.id, notificationId: duelNotice,
    selectionSequence: duelSelection.boundary.sequence, sourceSha256: duelSelection.sourceSha256, economicGrant: false });
  movements.push({ kind: legacy > 0 ? 'season-prestige-conversion' : 'season-status-only', characterId: prior.id, accountId: prior.account_id,
    priorSeason: prior.season, currentSeason: current, closedSeason: recap.season, priorRespect: prior.respect, level, priorKills: prior.season_kills,
    prestigeGained: legacy, title: recap.title, priorSeasonSunk: account.season_sunk, economicGrant: legacy > 0, authority });
  return result;
}
