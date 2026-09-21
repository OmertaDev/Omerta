// Read-only journal for complete original seasonal job boundaries. Not a mutation authority.
import assert from 'node:assert/strict';
import { levelOf, recapTitleOf, seasonModOf, DUELS } from '../src/rules.js';
import { equation, exactSum } from './rc1-resource-journal.js';
import { canonicalJson, sha256 } from './rc1-native-proof.js';

export const SEASON_JOURNAL_TABLES = ['characters', 'account_persistent', 'season_records', 'season_recaps',
  'notifications', 'telemetry', 'gangs', 'transactions'];
export const SEASON_MS = 28 * 86400000;
const key = (table, row) => table === 'account_persistent' ? row.account_id : table === 'season_records' ? String(row.season)
  : table === 'season_recaps' ? JSON.stringify([row.account_id, row.season]) : row.id;
function indexed(table, rows) {
  const result = new Map(rows.map(row => [key(table, row), row])); assert.equal(result.size, rows.length, `Duplicate ${table} identity`); return result;
}
const without = (row, fields) => Object.fromEntries(Object.entries(row).filter(([field]) => !fields.includes(field)));
export const seasonStateHash = state => sha256(canonicalJson(without(state, ['boundary'])));

// Explicit sufficient table projection: all columns in these eight tables, exact native NUMERIC.
export async function readSeasonRows(client) {
  const columns = (await client.query(`SELECT table_name,column_name,data_type FROM information_schema.columns
    WHERE table_schema=current_schema() AND table_name=ANY($1::text[]) ORDER BY table_name,ordinal_position`, [SEASON_JOURNAL_TABLES])).rows;
  const state = {};
  for (const table of SEASON_JOURNAL_TABLES) {
    const select = columns.filter(row => row.table_name === table).map(row => {
      assert(/^[a-z_][a-z_0-9]*$/.test(row.column_name));
      return `"${row.column_name}"${['numeric', 'decimal', 'bigint'].includes(row.data_type) ? '::text' : ''} AS "${row.column_name}"`;
    }).join(','); assert(select, `Missing ${table}`);
    state[table] = JSON.parse(JSON.stringify((await client.query(`SELECT ${select} FROM "${table}"`)).rows))
      .sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b)));
  }
  state.boundary = (await client.query('SELECT pg_current_snapshot()::text AS snapshot')).rows[0]; return state;
}
export async function snapshotSeasonState(pool) {
  const client = await pool.connect();
  try { await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); const state = await readSeasonRows(client); await client.query('COMMIT'); return state; }
  catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export function reconcileSeason(before, after, { logicalAt, authority = 'original-season-rollover' } = {}) {
  assert.equal(authority, 'original-season-rollover', 'Season journal requires a complete canonical seasonal job');
  assert(Number.isSafeInteger(logicalAt)); const current = Math.floor(logicalAt / SEASON_MS);
  const old = {}, next = {}, added = {}, consumed = new Map(), allowed = new Map(), unsupported = [], checks = [], prestige = [];
  for (const table of SEASON_JOURNAL_TABLES) {
    assert(Array.isArray(before[table]) && Array.isArray(after[table]), `Missing ${table}`);
    old[table] = indexed(table, before[table]); next[table] = indexed(table, after[table]);
    added[table] = after[table].filter(row => !old[table].has(key(table, row)));
  }
  const identity = (table, row) => `${table}:${key(table, row)}`;
  const consume = (table, row) => consumed.set(identity(table, row), true);
  const permit = (table, row, fields) => allowed.set(identity(table, row), fields);
  const inspect = (name, details = {}) => checks.push({ name, ...details, ok: true });
  const crowns = new Map(), legacies = new Map(), titles = new Map();
  const add = (map, account, value) => map.set(account, exactSum([map.get(account) || '0', String(value)]));
  const notice = (type, character, payload) => {
    const matches = added.notifications.filter(row => row.type === type && row.character_id === character && canonicalJson(JSON.parse(row.payload)) === canonicalJson(payload));
    assert.equal(matches.length, 1, `Missing/duplicate/wrong-owner ${type} notification`); consume('notifications', matches[0]);
  };
  for (const [id, prior] of old.season_records) {
    const row = next.season_records.get(id); assert(row, 'Stored standings removed');
    assert.deepEqual(without(row, ['crowned']), without(prior, ['crowned']), 'Stored standings rewritten');
    assert(!(prior.crowned && !row.crowned), 'Crown latch reversed');
  }
  for (const row of after.season_records) {
    const prior = old.season_records.get(key('season_records', row));
    assert(Number.isInteger(row.season) && row.season < current, 'Future/unclosed season record');
    if (!prior) {
      assert.equal(row.season, current - 1, 'New standings outside current rollover');
      assert.equal(row.mod_id, seasonModOf(row.season).id, 'Wrong seasonal modifier');
      consume('season_records', row);
      unsupported.push({ reason: 'initial-standing-selection-not-independently-recomputed', season: row.season,
        detail: 'First stored standings are canonical award intent; cached City Standing ranking and Family election are not re-derived by this journal.' });
    } else permit('season_records', row, ['crowned']);
    if (row.crowned && !prior?.crowned) {
      if (row.champion_account) {
        assert(next.account_persistent.has(row.champion_account), 'Crown account missing'); add(crowns, row.champion_account, 1);
        const living = after.characters.filter(character => character.account_id === row.champion_account && character.alive);
        assert(living.length <= 1, 'Ambiguous living crown owner');
        if (living.length) notice('season_crown', living[0].id, { season: row.season, standing: row.champion_standing });
      }
      inspect('atomic stored crown claim and notification', { season: row.season, account: row.champion_account });
    }
  }
  for (const [id, row] of old.season_recaps) assert.deepEqual(next.season_recaps.get(id), row, 'Immutable recap removed/rewritten');
  const eligible = before.characters.filter(row => row.alive && row.season < current);
  const duel = eligible.filter(row => row.duel_limit !== null && row.duel_limit !== undefined)
    .sort((a, b) => Number(b.duel_elo) - Number(a.duel_elo) || String(a.id).localeCompare(String(b.id)))[0];
  for (const [id, row] of next.characters) {
    const prior = old.characters.get(id); if (!prior || row.season === prior.season) continue;
    assert(prior.alive && row.alive && prior.account_id === row.account_id, 'Season conversion owner/life changed');
    assert(prior.season < current && row.season === current, 'Character season changed outside original boundary');
    const level = levelOf(Number(prior.respect)), legacy = Math.floor(level / 2);
    const recap = added.season_recaps.filter(r => r.account_id === row.account_id && r.season === current - 1);
    assert.equal(recap.length, 1, 'Missing/duplicate/wrong-owner conversion recap');
    assert.equal(recap[0].level, level); assert.equal(recap[0].kills, Number(prior.season_kills || 0));
    assert.equal(recap[0].prestige_gained, legacy); assert.equal(recap[0].title, recapTitleOf(level)); consume('season_recaps', recap[0]);
    assert.equal(exactSum([row.respect]), '0'); assert.equal(row.season_kills, 0); assert.equal(row.duel_elo, DUELS.ELO_START);
    add(legacies, row.account_id, legacy); permit('characters', row, ['season', 'respect', 'season_kills', 'duel_elo']);
    const telemetry = added.telemetry.filter(r => r.account_id === row.account_id && r.event === 'season_convert'
      && canonicalJson(JSON.parse(r.props)) === canonicalJson({ season: current, legacy }));
    assert.equal(telemetry.length, 1, 'Missing/duplicate/wrong-owner conversion telemetry'); consume('telemetry', telemetry[0]);
    if (duel?.id === id) { add(titles, row.account_id, 1); notice('duel_champion', id, { season: current, elo: Number(prior.duel_elo) }); }
    inspect('original level formula, recap and seasonal resets', { character: id, account: row.account_id, level, legacy, closedSeason: current - 1 });
  }
  for (const row of added.season_recaps) assert(consumed.has(identity('season_recaps', row)), 'Unlinked conversion recap');
  for (const [account, row] of next.account_persistent) {
    const prior = old.account_persistent.get(account); if (!prior) { unsupported.push({ reason: 'new-account-status-unclassified', account }); continue; }
    for (const [field, values] of [['season_crowns', crowns], ['duel_titles', titles]]) {
      assert.equal(exactSum([prior[field], values.get(account) || '0']), exactSum([row[field]]), `Unexplained/duplicate/wrong-owner ${field}`);
      inspect(`exact nonmonetary ${field}`, { account, before: prior[field], after: row[field] });
    }
    prestige.push(equation({ resource: 'prestige-units', owner: `account:${account}`, before: prior.prestige, after: row.prestige,
      created: legacies.get(account) || '0', authority: [{ rule: 'floor(levelOf(original respect)/2)', account, season: current - 1 }] }));
    if (legacies.has(account)) assert.equal(exactSum([row.season_sunk]), '0', 'Season prestige-spend marker not reset');
    else assert.equal(row.season_sunk, prior.season_sunk, 'Unlinked seasonal spend-marker reset');
    permit('account_persistent', row, ['season_crowns', 'duel_titles', 'prestige', 'season_sunk']);
  }
  for (const row of after.gangs) {
    const prior = old.gangs.get(row.id); if (!prior || row.season === prior.season) continue;
    assert(prior.season < current && row.season === current, 'Family season changed outside original boundary');
    assert.equal(exactSum([row.season_tribute]), '0'); assert.equal(row.season_wars, 0);
    permit('gangs', row, ['season', 'season_tribute', 'season_wars']); inspect('Family seasonal markers reset', { family: row.id, season: current });
  }
  // Seasonal-type rows cannot be disguised as unrelated additions after losing their owner link.
  for (const row of added.notifications.filter(r => ['season_crown', 'duel_champion'].includes(r.type)))
    assert(consumed.has(identity('notifications', row)), 'Unlinked/duplicate seasonal notification');
  for (const row of added.telemetry.filter(r => r.event === 'season_convert'))
    assert(consumed.has(identity('telemetry', row)), 'Unlinked/duplicate conversion telemetry');
  for (const table of SEASON_JOURNAL_TABLES) {
    for (const [id, prior] of old[table]) {
      const row = next[table].get(id), fields = row ? allowed.get(identity(table, row)) || [] : [];
      if (!row || canonicalJson(without(prior, fields)) !== canonicalJson(without(row, fields)))
        unsupported.push({ reason: 'unclassified-row-change', table, identity: id, before: prior, after: row || null, excludedClassifiedFields: fields });
    }
    for (const row of added[table]) if (!consumed.has(identity(table, row)))
      unsupported.push({ reason: 'unclassified-row-addition', table, identity: key(table, row), after: row });
  }
  return { beforeHash: seasonStateHash(before), afterHash: seasonStateHash(after), logicalAt, currentSeason: current,
    checks, prestigeEquations: prestige, unsupported, status: 'PASS_SCOPED_SEASONAL_STATUS',
    currencyMovementsClassified: false, qualifyingFullResourcePass: false };
}
