import assert from 'node:assert/strict';
import { SEASON_JOURNAL_TABLES, SEASON_MS, reconcileSeason } from '../tools/rc1-season-journal.js';
import { levelOf, recapTitleOf, seasonModOf } from '../src/rules.js';
const at = 740 * SEASON_MS;
const before = { ...Object.fromEntries(SEASON_JOURNAL_TABLES.map(table => [table, []])),
  characters: [{ id: 'person', account_id: 'owner', alive: true, season: 739, respect: '1000', season_kills: 2, duel_elo: 1100, duel_limit: 10, cash: '500' }],
  account_persistent: [{ account_id: 'owner', prestige: '7', season_crowns: 0, duel_titles: 0, season_sunk: 4 }],
  gangs: [{ id: 'family', season: 739, season_tribute: '12000', season_wars: 3, treasury: '0' }] };
const after = structuredClone(before), level = levelOf(1000), legacy = Math.floor(level / 2);
Object.assign(after.characters[0], { season: 740, respect: '0', season_kills: 0, duel_elo: 1000 });
Object.assign(after.account_persistent[0], { prestige: String(7 + legacy), season_crowns: 1, duel_titles: 1, season_sunk: 0 });
Object.assign(after.gangs[0], { season: 740, season_tribute: '0', season_wars: '0' });
after.season_records.push({ season: 739, mod_id: seasonModOf(739).id, champion_account: 'owner', champion_name: 'Person', champion_standing: 100, crowned: true });
after.season_recaps.push({ account_id: 'owner', season: 739, level, kills: 2, prestige_gained: legacy, title: recapTitleOf(level) });
after.notifications.push({ id: 'crown', character_id: 'person', type: 'season_crown', payload: JSON.stringify({ season: 739, standing: 100 }) },
  { id: 'duel', character_id: 'person', type: 'duel_champion', payload: JSON.stringify({ season: 740, elo: 1100 }) });
after.telemetry.push({ id: 'conversion', account_id: 'owner', event: 'season_convert', props: JSON.stringify({ season: 740, legacy }) });
const journal = reconcileSeason(before, after, { logicalAt: at }); assert.equal(journal.prestigeEquations[0].created, String(legacy));
assert.equal(journal.unsupported.length, 1); assert.equal(journal.currencyMovementsClassified, false);
for (const [label, mutate] of [
  ['missing recap', state => { state.season_recaps = []; }],
  ['wrong recap owner', state => { state.season_recaps[0].account_id = 'stranger'; }],
  ['duplicate recap', state => { state.season_recaps.push({ ...state.season_recaps[0] }); }],
  ['missing crown', state => { state.account_persistent[0].season_crowns = 0; }],
  ['duplicate crown', state => { state.account_persistent[0].season_crowns = 2; }],
  ['wrong prestige', state => { state.account_persistent[0].prestige = '12.000000001'; }],
  ['missing notification', state => { state.notifications = state.notifications.filter(row => row.type !== 'season_crown'); }],
  ['wrong notification owner', state => { state.notifications[0].character_id = 'stranger'; }],
  ['duplicate notification', state => { state.notifications.push({ ...state.notifications[0], id: 'extra' }); }],
  ['wrong reset', state => { state.characters[0].respect = '1'; }],
  ['wrong telemetry', state => { state.telemetry[0].account_id = 'stranger'; }],
]) { const broken = structuredClone(after); mutate(broken); assert.throws(() => reconcileSeason(before, broken, { logicalAt: at }), undefined, label); }
const rewritten = structuredClone(after); rewritten.season_records[0].champion_name = 'Other';
assert.throws(() => reconcileSeason(after, rewritten, { logicalAt: at }), /Stored standings rewritten/);
assert.throws(() => reconcileSeason(before, after, { logicalAt: at - 1 }), /Future\/unclosed/);
const unknown = structuredClone(after); unknown.characters[0].cash = '501';
assert(reconcileSeason(before, unknown, { logicalAt: at }).unsupported.some(row => row.table === 'characters' && row.reason === 'unclassified-row-change'));
assert.equal(reconcileSeason(after, after, { logicalAt: at }).prestigeEquations[0].created, '0');
console.log('PASS: seasonal status/prestige lineage, original boundary, missing/rewritten/duplicate/wrong-owner controls and unknown cash preservation');
