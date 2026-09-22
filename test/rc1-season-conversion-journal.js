import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DUELS, levelOf, recapTitleOf } from '../src/rules.js';
import { reconcileSeasonConversions } from '../tools/rc1-season-conversion-journal.js';
import { WORLD_RESOURCE_TABLES, reconcileWorldResources } from '../tools/rc1-world-resource-observer.js';
import { verifyArtifactIndex } from '../tools/rc1-native-proof.js';
import { readVerifiedHistoryLines } from '../tools/rc1-native-history-reader.js';
import { captureDuelSelection, DUEL_SELECTION_SQL } from '../tools/rc1-duel-selection-provenance.js';
import { sha256 } from '../tools/rc1-native-proof.js';

const worker = await fs.readFile(new URL('../src/worker.js', import.meta.url), 'utf8');
for (const source of ['const seasonLevel = levelOf(Number(ch.respect));', 'const legacy = Math.floor(seasonLevel / 2);',
  'recapTitleOf(seasonLevel)', "'season_convert', JSON.stringify({ season: current, legacy })"])
  assert(worker.includes(source), 'Canonical season conversion source changed; review classifier');
const empty = () => ({ format: 1, tables: Object.fromEntries(WORLD_RESOURCE_TABLES.map(table => [table, []])) });
function fixture(respect = '1440') {
  const before = empty();
  before.tables.characters.push({ id: 'character-a', account_id: 'account-a', alive: true, season: 739, respect, season_kills: 3,
    duel_elo: 1200, health: '81', cash: '500', bank: '0', ammo: 25, cb: 0 });
  before.tables.account_persistent.push({ account_id: 'account-a', prestige: 10, season_sunk: '7', duel_titles: 0, omr: '0', staked: '0', unbonding: '0' });
  const after = structuredClone(before), level = levelOf(Number(respect)), legacy = Math.floor(level / 2), at = '2026-09-24T00:00:00.000Z';
  Object.assign(after.tables.characters[0], { respect: '0', season_kills: 0, duel_elo: DUELS.ELO_START, season: 740 });
  Object.assign(after.tables.account_persistent[0], { prestige: 10 + legacy, season_sunk: '0' });
  after.tables.telemetry.push({ id: 'receipt-a', account_id: 'account-a', event: 'season_convert', props: JSON.stringify({ season: 740, legacy }), at });
  after.tables.season_recaps.push({ account_id: 'account-a', season: 739, level, kills: 3, prestige_gained: legacy, title: recapTitleOf(level), at });
  return { before, after, legacy };
}
const positive = fixture(), journal = reconcileSeasonConversions(positive.before, positive.after);
assert.equal(journal.checks.length, 1); assert.equal(journal.checks[0].expectedDelta, '6'); assert.equal(journal.movements[0].economicGrant, true);
assert.equal(journal.unsupported.length, 0);
const integrated = reconcileWorldResources(positive.before, positive.after);
assert.equal(integrated.unsupported.length, 0); assert(integrated.checks.some(row => row.resource === 'prestige' && row.after === '16'));
const zero = fixture('0'), status = reconcileSeasonConversions(zero.before, zero.after);
assert.equal(status.checks.length, 0); assert.equal(status.movements[0].kind, 'season-status-only'); assert.equal(status.movements[0].economicGrant, false);
assert.deepEqual(reconcileSeasonConversions(positive.after, positive.after), { checks: [], movements: [], unsupported: [] }, 'Exact repeated state cannot reuse a receipt');

const rejected = [], unknown = [];
const reject = (name, mutate) => { const f = fixture(); mutate(f); assert.throws(() => reconcileSeasonConversions(f.before, f.after), undefined, name); rejected.push(name); };
const unsupported = (name, mutate) => { const f = fixture(); mutate(f); const r = reconcileSeasonConversions(f.before, f.after);
  assert.equal(r.checks.length, 0, name); assert.equal(r.movements.length, 0, name); assert(r.unsupported.length, name); unknown.push(name); };
reject('foreign-receipt-account', f => { f.after.tables.telemetry[0].account_id = 'foreign'; });
reject('foreign-recap-account', f => { f.after.tables.season_recaps[0].account_id = 'foreign'; });
reject('changed-character-custody', f => { f.after.tables.characters[0].account_id = 'foreign'; });
reject('no-prior-owner', f => { f.before.tables.characters = []; });
reject('dead-character', f => { f.before.tables.characters[0].alive = false; });
reject('already-current-character', f => { f.before.tables.characters[0].season = 740; });
reject('missing-receipt', f => { f.after.tables.telemetry = []; });
reject('duplicate-receipt-id', f => { f.after.tables.telemetry.push(structuredClone(f.after.tables.telemetry[0])); });
reject('duplicate-receipt-distinct-id', f => { f.after.tables.telemetry.push({ ...f.after.tables.telemetry[0], id: 'receipt-b' }); });
reject('old-receipt-reuse', f => { f.before.tables.telemetry.push(structuredClone(f.after.tables.telemetry[0])); });
reject('wrong-event', f => { f.after.tables.telemetry[0].event = 'unrelated'; });
reject('wrong-receipt-legacy', f => { f.after.tables.telemetry[0].props = '{"season":740,"legacy":7}'; });
reject('unexpected-receipt-field', f => { f.after.tables.telemetry[0].props = '{"season":740,"legacy":6,"other":1}'; });
reject('wrong-receipt-season', f => { f.after.tables.telemetry[0].props = '{"season":741,"legacy":6}'; });
reject('wrong-recap-season', f => { f.after.tables.season_recaps[0].season = 738; });
reject('wrong-recap-level', f => { f.after.tables.season_recaps[0].level++; });
reject('wrong-recap-kills', f => { f.after.tables.season_recaps[0].kills++; });
reject('wrong-recap-grant', f => { f.after.tables.season_recaps[0].prestige_gained++; });
reject('wrong-recap-title', f => { f.after.tables.season_recaps[0].title = 'A Boss'; });
reject('new-recap-field', f => { f.after.tables.season_recaps[0].unclassified = 1; });
reject('wrong-recap-time', f => { f.after.tables.season_recaps[0].at = '2026-09-24T00:00:01.000Z'; });
reject('wrong-respect-reset', f => { f.after.tables.characters[0].respect = '1'; });
reject('wrong-kill-reset', f => { f.after.tables.characters[0].season_kills = 1; });
reject('wrong-elo-reset', f => { f.after.tables.characters[0].duel_elo = 1; });
reject('wrong-season-marker', f => { f.after.tables.characters[0].season = 741; });
reject('wrong-prestige-delta', f => { f.after.tables.account_persistent[0].prestige++; });
reject('wrong-season-spend-reset', f => { f.after.tables.account_persistent[0].season_sunk = '1'; });
reject('balanced-wrong-owner-prestige', f => { f.after.tables.account_persistent[0].prestige = 10;
  const foreign = { ...f.before.tables.account_persistent[0], account_id: 'foreign' };
  f.before.tables.account_persistent.push(foreign); f.after.tables.account_persistent.push({ ...foreign, prestige: 16 }); });
reject('duplicate-recap', f => { f.after.tables.season_recaps.push(structuredClone(f.after.tables.season_recaps[0])); });
reject('old-recap-rewrite', f => { f.before = structuredClone(f.after); f.after.tables.season_recaps[0].level++; });
reject('old-recap-delete', f => { f.before = structuredClone(f.after); f.after.tables.season_recaps = []; });
reject('old-receipt-edit', f => { f.before = structuredClone(f.after); f.after.tables.telemetry[0].props = '{}'; });
unsupported('duel-title-compound', f => { f.after.tables.account_persistent[0].duel_titles++; });
const title = fixture(), champion = '00000000-0000-4000-8000-000000000001';
const titleAt = Date.parse('2026-09-24T00:00:00.000Z');
for (const snapshot of [title.before, title.after]) Object.assign(snapshot.tables.characters[0], { id: champion, duel_limit: 100 });
title.after.tables.account_persistent[0].duel_titles++;
title.after.tables.notifications.push({ id: 'duel-notice', character_id: champion, type: 'duel_champion',
  payload: JSON.stringify({ season: 740, elo: 1200 }), delivered: false, pushed: false, created_at: new Date(titleAt).toISOString() });
const selectionIdentity = { sequence: 10, context: { authority: 'original-worker', logicalAt: titleAt },
  command: 'SELECT', outcome: 'AUTOCOMMITTED', sqlSha256: sha256(DUEL_SELECTION_SQL) };
const duelSelection = captureDuelSelection(selectionIdentity, title.before, title.before);
const awardIdentity = { ...selectionIdentity, sequence: 20, command: 'COMMIT', outcome: 'COMMITTED' };
const titleProof = reconcileSeasonConversions(title.before, title.after, { identity: awardIdentity, duelSelection });
assert.equal(titleProof.unsupported.length, 0);
assert(titleProof.movements.some(row => row.kind === 'season-duel-title'));
for (const mutate of [
  f => { f.after.tables.account_persistent[0].duel_titles++; },
  f => { f.after.tables.notifications[0].character_id = 'another-owner'; },
  f => { f.after.tables.notifications[0].payload = JSON.stringify({ season: 740, elo: 1201 }); },
  f => { f.after.tables.notifications = []; },
]) { const f = structuredClone(title); mutate(f); assert.throws(() => reconcileSeasonConversions(f.before, f.after, { identity: awardIdentity, duelSelection })); }
for (const mutate of [
  w => { w.selected = 'another-winner'; },
  w => { w.boundary.sequence = 21; },
  w => { w.boundary.context.logicalAt--; },
  w => { w.candidates[0].duel_elo++; },
]) { const w = structuredClone(duelSelection); mutate(w); assert.throws(() => reconcileSeasonConversions(title.before, title.after, { identity: awardIdentity, duelSelection: w })); }
unsupported('other-character-field', f => { f.after.tables.characters[0].health = '100'; });
unsupported('other-account-field', f => { f.after.tables.account_persistent[0].omr = '10'; });
unsupported('other-authority-table', f => { f.after.tables.transactions.push({ id: 'compound' }); });
unsupported('ambiguous-living-character', f => { const person = { ...f.before.tables.characters[0], id: 'character-b' };
  f.before.tables.characters.push(person); f.after.tables.characters.push(structuredClone(person)); });
unsupported('second-telemetry-authority', f => { f.after.tables.telemetry.push({ ...f.after.tables.telemetry[0], id: 'other', event: 'other' }); });
unsupported('existing-recap-conversion', f => { f.before.tables.season_recaps = structuredClone(f.after.tables.season_recaps); });

const retained = process.argv.find(value => value.startsWith('--retained='))?.slice(11);
let retainedProjections = null;
if (retained) {
  const manifest = JSON.parse(await fs.readFile(path.join(retained, 'run.json'), 'utf8')); await verifyArtifactIndex(retained, manifest);
  const count = { originalSource: manifest.source.revision, recapBoundaries: 0, positiveProjections: 0, positivePrestige: 0,
    zeroGainStatusRows: 0, projectedCorruptionsRejected: 0,
    scope: 'Exact retained changed-row projections only; unchanged rows and full-world uniqueness require the fresh original-worker run.' };
  for await (const line of readVerifiedHistoryLines(retained, manifest)) {
    const row = JSON.parse(line);
    if (row.kind !== 'resource-commit-boundary' || !row.journal.unsupported.some(item => item.table === 'season_recaps')) continue;
    count.recapBoundaries++;
    const artifact = JSON.parse(await fs.readFile(path.join(retained, row.journal.restrictedChangesArtifact), 'utf8'));
    const recap = artifact.restrictedChanges.tables.find(table => table.table === 'season_recaps').afterRows[0];
    if (recap.prestige_gained === 0) { count.zeroGainStatusRows++; continue; }
    const before = empty(), after = empty();
    for (const table of artifact.restrictedChanges.tables) {
      before.tables[table.table] = structuredClone(table.beforeRows); after.tables[table.table] = structuredClone(table.afterRows);
    }
    const result = reconcileSeasonConversions(before, after); assert.equal(result.unsupported.length, 0); assert.equal(result.checks.length, 1);
    assert.equal(result.movements[0].prestigeGained, recap.prestige_gained); count.positiveProjections++; count.positivePrestige += recap.prestige_gained;
    for (const mutate of [a => { a.tables.account_persistent[0].prestige++; }, a => { a.tables.telemetry[0].account_id = 'foreign'; },
      a => { a.tables.telemetry.push({ ...a.tables.telemetry[0], id: 'duplicate' }); }, a => { a.tables.characters[0].respect = '1'; }]) {
      const corrupted = structuredClone(after); mutate(corrupted); assert.throws(() => reconcileSeasonConversions(before, corrupted)); count.projectedCorruptionsRejected++;
    }
  }
  assert.equal(count.positiveProjections, 4); assert.equal(count.positivePrestige, 24); assert.equal(count.zeroGainStatusRows, 25); retainedProjections = count;
}
console.log(JSON.stringify({ status: 'PASS_SCOPED_CONTROLS', rejected: rejected.length, explicitUnsupported: unknown.length,
  positivePrestige: 6, zeroGainEconomicChecks: status.checks.length, retainedProjections }));
