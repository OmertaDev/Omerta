// Only the award from an already saved winner is classified. Ranking selection
// requires its own complete eligibility/ordering witness and remains unknown.
import assert from 'node:assert/strict';
import { exactSum } from './rc1-resource-journal.js';
import { verifyColdSeasonElection } from './rc1-season-election-provenance.js';

const rows = (state, table) => { assert(Array.isArray(state.tables[table]), `Missing crown evidence table ${table}`); return state.tables[table]; };
const index = (values, key, label) => {
  const result = new Map();
  for (const row of values) { const id = key(row); assert(!result.has(id), `Duplicate ${label}: ${id}`); result.set(id, row); }
  return result;
};
const omit = (row, names) => Object.fromEntries(Object.entries(row).filter(([key]) => !names.includes(key)));
const equal = (a, b) => { try { assert.deepEqual(a, b); return true; } catch { return false; } };
const at = value => { const stamp = Date.parse(value); assert(Number.isFinite(stamp), 'Invalid crown notification timestamp'); return stamp; };
const notificationFields = ['id', 'character_id', 'type', 'payload', 'delivered', 'created_at', 'pushed'].sort();

export function reconcileStoredSeasonCrowns(before, after, { seasonElectionProvenance = null, identity = null } = {}) {
  const checks = [], movements = [], unsupported = [];
  const metadata = { unchanged: 0, insertedNonCrown: [], acknowledgements: [],
    scope: 'Notification metadata only: original insert defaults and immutable content; monotone delivered/pushed flags. No request authorization, actual delivery or reward authority is inferred.' };
  const result = { checks, movements, unsupported, elections: [], notificationMetadata: metadata };
  const people = index(rows(before, 'characters'), row => row.id, 'crown character'), nextPeople = index(rows(after, 'characters'), row => row.id, 'crown character');
  const oldNotices = index(rows(before, 'notifications'), row => row.id, 'notification'), nextNotices = index(rows(after, 'notifications'), row => row.id, 'notification');
  const notices = [];
  for (const row of nextNotices.values()) {
    assert.deepEqual(Object.keys(row).sort(), notificationFields, 'Unclassified notification fields');
    for (const field of ['id', 'character_id', 'type', 'payload']) assert.equal(typeof row[field], 'string', `Invalid notification ${field}`);
    assert(row.id && row.character_id && row.type, 'Missing notification identity'); JSON.parse(row.payload); at(row.created_at);
    assert.equal(typeof row.delivered, 'boolean'); assert.equal(typeof row.pushed, 'boolean');
    const old = oldNotices.get(row.id);
    if (!old) {
      assert(nextPeople.has(row.character_id), 'Notification owner is absent');
      assert.equal(row.delivered, false, 'New notification bypassed original delivery default');
      assert.equal(row.pushed, false, 'New notification bypassed original push default');
      if (row.type === 'season_crown') notices.push(row);
      else metadata.insertedNonCrown.push({ id: row.id, characterId: row.character_id, type: row.type });
    } else {
      assert.deepEqual(omit(row, ['delivered', 'pushed']), omit(old, ['delivered', 'pushed']), 'Historical notification content/ownership changed');
      assert(!old.delivered || row.delivered, 'Notification delivery flag reversed'); assert(!old.pushed || row.pushed, 'Notification push flag reversed');
      if (old.delivered !== row.delivered || old.pushed !== row.pushed) metadata.acknowledgements.push({ id: row.id,
        before: { delivered: old.delivered, pushed: old.pushed }, after: { delivered: row.delivered, pushed: row.pushed },
        authority: 'src/server.js GET /v1/notifications; src/push.js sweepPush: monotone metadata flags only' });
      else metadata.unchanged++;
    }
  }
  for (const id of oldNotices.keys()) assert(nextNotices.has(id), 'Historical notification removed');

  const oldRecords = index(rows(before, 'season_records'), row => row.season, 'season intent'), newRecords = index(rows(after, 'season_records'), row => row.season, 'season intent');
  const claims = [], inserted = [];
  for (const [season, row] of newRecords) {
    assert(Number.isSafeInteger(season), 'Invalid saved season'); assert.equal(typeof row.crowned, 'boolean');
    const prior = oldRecords.get(season);
    if (!prior) { inserted.push(row); continue; }
    assert.deepEqual(omit(row, ['crowned']), omit(prior, ['crowned']), 'Saved season intent changed');
    assert(!prior.crowned || row.crowned, 'Saved crown latch reversed');
    if (!prior.crowned && row.crowned) claims.push({ prior, row });
  }
  for (const season of oldRecords.keys()) assert(newRecords.has(season), 'Saved season intent removed');
  if (inserted.length) {
    if (seasonElectionProvenance) assert.deepEqual(seasonElectionProvenance.boundary, identity, 'Election witness belongs to another native boundary');
    const election = verifyColdSeasonElection(before, after, seasonElectionProvenance);
    if (election && !election.unsupported) result.elections.push(election);
    else unsupported.push({ kind: 'season-standing-selection', table: 'season_records', seasons: inserted.map(row => row.season),
      detail: election?.unsupported || 'Initial winner/Family election remains unsupported: complete eligibility, cached ranking and native tied-row ordering are not reconstructed from saved intent.' });
  }
  const accounts = index(rows(before, 'account_persistent'), row => row.account_id, 'crown account');
  const nextAccounts = index(rows(after, 'account_persistent'), row => row.account_id, 'crown account');
  for (const [id, account] of nextAccounts) if (!accounts.has(id) && account.season_crowns !== undefined)
    assert.equal(account.season_crowns, 0, 'New account has crowns without an existing stored-award owner');
  for (const [id, account] of accounts) if (!nextAccounts.has(id) && account.season_crowns)
    unsupported.push({ kind: 'season-crown-owner-removal', table: 'account_persistent', accountId: id,
      detail: 'Crown-bearing account removed; no destruction/custody authority is classified' });
  const deltas = [...nextAccounts.values()].filter(row => accounts.has(row.account_id) && row.season_crowns !== accounts.get(row.account_id).season_crowns);
  if (!claims.length && !notices.length && !deltas.length) return result;
  const incomplete = detail => { unsupported.push({ kind: 'season-crown-compound', table: 'season_records', detail }); return result; };
  if (inserted.length || claims.length > 1) return incomplete('Only one previously saved intent may be claimed in this serial boundary; new intent or multiple claims remain unsupported');
  assert.equal(claims.length, 1, 'Crown delta/notification lacks one unused stored intent');
  const { prior, row } = claims[0];
  if (!prior.champion_account) return incomplete('Empty champion claim is outside the positive stored-award subset');
  const account = accounts.get(prior.champion_account), nextAccount = nextAccounts.get(prior.champion_account);
  assert(account && nextAccount, 'Saved champion account is absent');
  assert(Number.isSafeInteger(account.season_crowns) && Number.isSafeInteger(nextAccount.season_crowns), 'Crown count is not an exact integer');
  assert.equal(exactSum([nextAccount.season_crowns, -account.season_crowns]), '1', 'Saved crown was missing, duplicated or credited to another owner');
  assert.equal(deltas.length, 1, 'Other account crown count changed at this one-award boundary');
  assert.equal(deltas[0].account_id, prior.champion_account, 'Crown owner differs from saved intent');
  const living = [...people.values()].filter(person => person.account_id === prior.champion_account && person.alive);
  if (living.length !== 1) return incomplete('Absent or ambiguous living champion needs a separately declared notification branch');
  const character = living[0];
  assert.deepEqual(nextPeople.get(character.id), character, 'Crown changed its living character or ownership');
  assert.equal(notices.length, 1, 'Saved crown needs exactly one fresh canonical notice');
  const notice = notices[0];
  assert.equal(notice.character_id, character.id, 'Crown notification has wrong character owner');
  const payload = { season: prior.season, standing: prior.champion_standing };
  assert.deepEqual(JSON.parse(notice.payload), payload, 'Crown notification differs from saved intent');
  assert.equal(notice.payload, JSON.stringify(payload), 'Crown notification differs from original JSON writer');
  assert(at(notice.created_at) >= at(prior.at), 'Crown notice predates its saved intent');
  assert(![...oldNotices.values()].some(old => old.type === 'season_crown' && JSON.parse(old.payload).season === prior.season), 'Saved season intent already has a crown notice');
  if (!equal(nextAccount, { ...account, season_crowns: account.season_crowns + 1 })) return incomplete('Other champion account fields changed with the crown');
  if (accounts.size !== nextAccounts.size || [...accounts].some(([id, old]) => id !== account.account_id && !equal(old, nextAccounts.get(id))))
    return incomplete('Other account creation/change overlaps the crown');
  if (metadata.insertedNonCrown.length || metadata.acknowledgements.length) return incomplete('Other notification insertion/acknowledgement overlaps the crown');
  for (const table of new Set([...Object.keys(before.tables), ...Object.keys(after.tables)])) {
    if (['account_persistent', 'season_records', 'notifications'].includes(table)) continue;
    if (!equal(before.tables[table], after.tables[table])) return incomplete(`Other observed table changed with crown: ${table}`);
  }
  const authority = [{ table: 'season_records', season: prior.season, priorCrowned: false }, { table: 'notifications', id: notice.id },
    { rule: 'src/season.js recordReckoning: stored claim, account +1 and living-owner notification in one transaction' }];
  checks.push({ kind: 'season-exact-stored-crown', resource: 'season-crowns', owner: `account:${account.account_id}`,
    before: String(account.season_crowns), after: String(nextAccount.season_crowns), expectedDelta: '1', drift: '0', authority });
  movements.push({ season: prior.season, accountId: account.account_id, characterId: character.id, standing: prior.champion_standing,
    crownDelta: 1, currencyGrant: false, notificationId: notice.id, authority });
  return result;
}
