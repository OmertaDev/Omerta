import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { reconcileStoredSeasonCrowns } from '../tools/rc1-season-crown-journal.js';
import { WORLD_RESOURCE_TABLES, reconcileWorldResources } from '../tools/rc1-world-resource-observer.js';

const season = await fs.readFile(new URL('../src/season.js', import.meta.url), 'utf8');
for (const text of ['UPDATE season_records SET crowned = true WHERE season=$1 AND NOT crowned',
  'UPDATE account_persistent SET season_crowns = season_crowns + 1 WHERE account_id=$1',
  'SELECT id FROM characters WHERE account_id=$1 AND alive LIMIT 1',
  "'season_crown', JSON.stringify({ season, standing: claim.champion_standing })"])
  assert(season.includes(text), 'Stored crown source contract changed; review observer');
for (const [file, text] of [['../src/server.js', 'SET delivered=true WHERE character_id=$1 AND NOT delivered'],
  ['../src/push.js', 'AND NOT pushed RETURNING id, type, payload']])
  assert((await fs.readFile(new URL(file, import.meta.url), 'utf8')).includes(text), 'Notification metadata source contract changed');

const empty = () => ({ format: 1, tables: Object.fromEntries(WORLD_RESOURCE_TABLES.map(table => [table, []])) });
function fixture(standing = null) {
  const before = empty();
  before.tables.characters.push({ id: 'player-character', account_id: 'player-account', alive: true, cash: '500', bank: '0', ammo: 25, cb: 0 });
  before.tables.account_persistent.push({ account_id: 'player-account', season_crowns: 2, prestige: 10, omr: '0', staked: '0', unbonding: '0' });
  before.tables.season_records.push({ season: 739, mod_id: 'dead_quiet', champion_account: 'player-account', champion_name: 'Player',
    champion_standing: standing, crowned: false, family_gang: null, family_name: null, family_tag: null, family_districts: null, at: '2026-09-24T00:00:00.000Z' });
  const after = structuredClone(before); after.tables.season_records[0].crowned = true; after.tables.account_persistent[0].season_crowns++;
  after.tables.notifications.push({ id: 'notice-a', character_id: 'player-character', type: 'season_crown',
    payload: JSON.stringify({ season: 739, standing }), delivered: false, pushed: false, created_at: '2026-09-24T00:00:00.000Z' });
  return { before, after };
}
for (const standing of [null, 0, 17.5]) {
  const { before, after } = fixture(standing), journal = reconcileStoredSeasonCrowns(before, after);
  assert.equal(journal.unsupported.length, 0); assert.equal(journal.checks.length, 1); assert.equal(journal.checks[0].expectedDelta, '1');
  assert.equal(journal.movements[0].standing, standing); assert.equal(journal.movements[0].currencyGrant, false);
  const integrated = reconcileWorldResources(before, after);
  assert.equal(integrated.unsupported.length, 0); assert.equal(integrated.seasonCrowns.movements.length, 1);
  assert.equal(reconcileStoredSeasonCrowns(after, after).checks.length, 0, 'Exact replay cannot reuse the saved intent or notice');
}
const rejected = [], unsupported = [];
const reject = (label, mutate) => { const pair = fixture(); mutate(pair); assert.throws(() => reconcileStoredSeasonCrowns(pair.before, pair.after), undefined, label); rejected.push(label); };
const unknown = (label, mutate) => { const pair = fixture(); mutate(pair); const result = reconcileStoredSeasonCrowns(pair.before, pair.after);
  assert.equal(result.checks.length, 0, label); assert.equal(result.movements.length, 0, label); assert(result.unsupported.length, label); unsupported.push(label); };
reject('no saved intent', p => { p.before.tables.season_records = []; p.after.tables.season_records = []; });
reject('claim latch missing', p => { p.after.tables.season_records[0].crowned = false; });
reject('used claim latch', p => { p.before.tables.season_records[0].crowned = true; });
reject('latch reversed', p => { p.before = structuredClone(p.after); p.after.tables.season_records[0].crowned = false; });
reject('changed historical intent', p => { p.after.tables.season_records[0].champion_name = 'Changed'; });
reject('deleted historical intent', p => { p.after.tables.season_records = []; });
reject('duplicate saved season', p => { p.before.tables.season_records.push(structuredClone(p.before.tables.season_records[0])); });
reject('missing +1', p => { p.after.tables.account_persistent[0].season_crowns = 2; });
reject('duplicate +1', p => { p.after.tables.account_persistent[0].season_crowns = 4; });
reject('inexact crown count', p => { p.after.tables.account_persistent[0].season_crowns = 3.5; });
reject('foreign account credit', p => { p.after.tables.account_persistent[0].season_crowns = 2; const other = { ...p.before.tables.account_persistent[0], account_id: 'foreign' };
  p.before.tables.account_persistent.push(other); p.after.tables.account_persistent.push({ ...other, season_crowns: 3 }); });
reject('second owner also credited', p => { const other = { ...p.before.tables.account_persistent[0], account_id: 'foreign' };
  p.before.tables.account_persistent.push(other); p.after.tables.account_persistent.push({ ...other, season_crowns: 3 }); });
reject('character custody changed', p => { p.after.tables.characters[0].account_id = 'foreign'; });
reject('missing notice', p => { p.after.tables.notifications = []; });
reject('duplicate notice identity', p => { p.after.tables.notifications.push(structuredClone(p.after.tables.notifications[0])); });
reject('two different notices', p => { p.after.tables.notifications.push({ ...p.after.tables.notifications[0], id: 'notice-b' }); });
reject('reused notice', p => { p.before.tables.notifications = structuredClone(p.after.tables.notifications); });
reject('prior notice for same season', p => { const old = { ...p.after.tables.notifications[0], id: 'old-notice' };
  p.before.tables.notifications.push(old); p.after.tables.notifications.push(structuredClone(old)); });
reject('foreign notice owner', p => { p.before.tables.characters.push({ ...p.before.tables.characters[0], id: 'other', account_id: 'other' });
  p.after.tables.characters.push(structuredClone(p.before.tables.characters[1])); p.after.tables.notifications[0].character_id = 'other'; });
reject('wrong notice season', p => { p.after.tables.notifications[0].payload = '{"season":740,"standing":null}'; });
reject('wrong notice standing', p => { p.after.tables.notifications[0].payload = '{"season":739,"standing":1}'; });
reject('extra payload field', p => { p.after.tables.notifications[0].payload = '{"season":739,"standing":null,"grant":1}'; });
reject('altered JSON spelling', p => { p.after.tables.notifications[0].payload = '{ "season":739,"standing":null}'; });
reject('notice predates intent', p => { p.after.tables.notifications[0].created_at = '2026-09-23T00:00:00.000Z'; });
reject('new notice already delivered', p => { p.after.tables.notifications[0].delivered = true; });
reject('new notice already pushed', p => { p.after.tables.notifications[0].pushed = true; });
reject('unknown notification field', p => { p.after.tables.notifications[0].other = 1; });
reject('malformed payload', p => { p.after.tables.notifications[0].payload = 'bad'; });
reject('historical notice edited', p => { p.before = structuredClone(p.after); p.after.tables.notifications[0].payload = '{}'; });
reject('historical notice removed', p => { p.before = structuredClone(p.after); p.after.tables.notifications = []; });
reject('delivery flag reversed', p => { p.before = structuredClone(p.after); p.before.tables.notifications[0].delivered = true; });
reject('push flag reversed', p => { p.before = structuredClone(p.after); p.before.tables.notifications[0].pushed = true; });
reject('new owner manufactured with crowns', p => { p.before = empty(); p.after = empty(); p.after.tables.account_persistent.push({ account_id: 'new', season_crowns: 1 }); });
unknown('initial winner insertion', p => { p.before.tables.season_records = []; });
unknown('empty winner', p => { p.before.tables.season_records[0].champion_account = null; p.after.tables.season_records[0].champion_account = null; });
unknown('no living winner notification branch', p => { p.before.tables.characters[0].alive = false; p.after.tables.characters[0].alive = false; });
unknown('multiple living winner characters', p => { const other = { ...p.before.tables.characters[0], id: 'other' }; p.before.tables.characters.push(other); p.after.tables.characters.push(structuredClone(other)); });
unknown('other account field changed', p => { p.after.tables.account_persistent[0].prestige++; });
unknown('other table changed', p => { p.after.tables.telemetry.push({ id: 'other' }); });
unknown('other notification overlaps', p => { p.after.tables.notifications.push({ ...p.after.tables.notifications[0], id: 'other', type: 'other' }); });
unknown('crown owner removal', p => { p.after = structuredClone(p.before); p.after.tables.account_persistent = []; });
const normal = fixture().before, notice = { ...fixture().after.tables.notifications[0], type: 'ordinary_message', payload: '{"message":"status"}' };
const inserted = structuredClone(normal); inserted.tables.notifications.push(notice);
assert.equal(reconcileWorldResources(normal, inserted).unsupported.length, 0, 'Nonresource notice is explicit metadata, not an unexplained grant');
const acknowledged = structuredClone(inserted); Object.assign(acknowledged.tables.notifications[0], { delivered: true, pushed: true });
const metadata = reconcileStoredSeasonCrowns(inserted, acknowledged);
assert.equal(metadata.checks.length, 0); assert.equal(metadata.notificationMetadata.acknowledgements.length, 1);
console.log(JSON.stringify({ status: 'PASS_SCOPED_CONTROLS', positiveCrownChecks: 3, rejected: rejected.length, explicitUnsupported: unsupported.length,
  scope: 'Stored award and notice only; normal notification metadata is not delivery/authorization proof; no initial election proof' }));
