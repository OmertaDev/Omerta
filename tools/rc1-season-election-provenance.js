// Test-only, read-only provenance around the original exported election.
// Cold zero-standing elections only; no replacement ranking or cache policy.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import { AsyncLocalStorage } from 'node:async_hooks';
import { fileURLToPath } from 'node:url';
import { canonicalJson, sha256 } from './rc1-native-proof.js';
import { QUERY_ORDER_SCOPE } from './rc1-native-query-order.js';
import { DISTRICTS, levelOf, seasonModOf } from '../src/rules.js';

export const ELECTION_SOURCE_PINS = Object.freeze({
  'src/season.js': '20898d156c93a84e8f969e79339e5af00f75ddce9aadc1ebd5ae50bd49c20907',
  'src/standing.js': 'e86fdd2ee3a24a01f37c28714bc79466edfe31a1b1d39d3af6a35c7f899b164b',
  'src/memo.js': 'c96b4ab21d5bd2e73a093a86bea85c4fb483427bcd441ae1f7845d35c0feab62',
  'src/rules.js': 'c22a72398a46a4f0076a64692dd31ddb2555ed94e9afa0da538f3f3a773f7c24',
});
const copy = value => JSON.parse(JSON.stringify(value));
const candidateTables = ['accounts', 'account_persistent', 'characters', 'districts', 'gangs'];
const order = values => [...values].sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b)));
const standingQuery = QUERY_ORDER_SCOPE.queries.find(row => row.id === 'standing-population').originalSql;
const columns = [...standingQuery.matchAll(/COALESCE\(a\.([a-z_]+),0\) AS \1/g)].map(match => match[1]);
const lookupQuery = 'SELECT account_id FROM characters WHERE name=$1 AND alive LIMIT 1';
const districtQuery = 'SELECT id, holder_gang FROM districts WHERE holder_gang IS NOT NULL';
const insertQuery = `INSERT INTO season_records (season, mod_id, champion_account, champion_name, champion_standing,
                                 family_gang, family_name, family_tag, family_districts)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (season) DO NOTHING`;
export const ELECTION_SQL = Object.freeze({ standing: standingQuery, lookup: lookupQuery, districts: districtQuery, insert: insertQuery });

export function assertElectionSources(root = new URL('../', import.meta.url)) {
  for (const [file, expected] of Object.entries(ELECTION_SOURCE_PINS))
    assert.equal(sha256(fs.readFileSync(new URL(file, root), 'utf8').replaceAll('\r\n', '\n')), expected, `Election source changed: ${file}`);
}

export async function snapshotElectionCandidates(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const tables = {}, fields = {};
    for (const table of candidateTables) {
      const result = await client.query(`SELECT * FROM "${table}"`);
      tables[table] = order(copy(result.rows)); fields[table] = result.fields.map(field => ({ name: field.name, type: field.dataTypeID }));
    }
    await client.query('COMMIT'); return { format: 1, tables, fields };
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { client.release(); }
}

export function createSeasonElectionProbe({ snapshot, maximumBytes = 8388608, maximumQueries = 64 } = {}) {
  assert.equal(typeof snapshot, 'function');
  for (const value of [maximumBytes, maximumQueries]) assert(Number.isSafeInteger(value) && value > 0);
  const scope = new AsyncLocalStorage(), transformations = [], excluded = [];
  let busy = false, sequence = 0, snapshotting = false, restored = false, installed = false;
  const bounded = trace => assert(Buffer.byteLength(canonicalJson(trace)) <= maximumBytes, 'Election provenance byte bound exceeded');
  async function capture() {
    assert(!snapshotting); snapshotting = true;
    try { return await snapshot(); } finally { snapshotting = false; }
  }
  const api = {
    transformations,
    async run(pool, season, work) {
      assert(installed && !restored); assert(!busy, 'Concurrent election provenance is unsupported');
      assert(transformations.some(row => row.file === 'src/standing.js'), 'Imported/uninstrumented standing cache is unsupported');
      busy = true;
      try {
        const trace = { format: 1, id: ++sequence, sourcePins: ELECTION_SOURCE_PINS, season, logicalAt: Date.now(),
          before: await capture(), queries: [], scores: [], tops: [] }; bounded(trace);
        return await scope.run(trace, async () => {
          const query = async (sql, parameters) => {
            assert(!snapshotting, 'Native query overlaps election evidence snapshot');
            assert.equal(typeof sql, 'string', 'Election query-config objects are not classified');
            assert(trace.queries.length < maximumQueries, 'Election query bound exceeded');
            const entry = { sql, parameters: copy(parameters ?? []), status: 'RUNNING' };
            trace.queries.push(entry); bounded(trace);
            try {
              const result = await pool.query(sql, parameters);
              Object.assign(entry, { status: 'RETURNED', command: result.command, rowCount: result.rowCount,
                rows: copy(result.rows), fields: result.fields.map(field => ({ name: field.name, type: field.dataTypeID })) });
              bounded(trace); return result;
            } catch (error) { entry.status = 'THREW'; entry.code = error.code || error.name; throw error; }
          };
          const delegated = new Proxy(pool, { get(target, key) {
            if (key === 'query') return query;
            const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
          } });
          return work(delegated);
        });
      } finally { busy = false; }
    },
    scored(input, output) { const trace = scope.getStore(); if (trace) { trace.scores.push({ input: copy(input), output: copy(output) }); bounded(trace); } return output; },
    top(value) { const trace = scope.getStore(); if (trace) { trace.tops.push(copy(value)); bounded(trace); } },
    async boundary(event) {
      const trace = scope.getStore(); if (!trace) return null;
      const last = trace.queries.at(-1);
      if (last?.sql !== insertQuery || last.status !== 'RUNNING' || event.command !== 'INSERT' || event.outcome !== 'AUTOCOMMITTED') return null;
      assert.equal(event.sqlSha256, sha256(insertQuery), 'Election insertion boundary query differs');
      const witness = { ...copy(trace), after: await capture(), boundary: copy(event),
        scope: 'Original cold zero-standing election at its autocommitted INSERT; no concurrent writer, warm cache, shared-flight or nonzero/Family ranking qualification' };
      bounded(witness); return witness;
    },
    diagnostic() { return { busy, snapshotting, installed, restored, captures: sequence, exclusions: excluded, limits: { maximumBytes, maximumQueries }, transformations }; },
    install({ root = new URL('../', import.meta.url) } = {}) {
      assert(!installed && !globalThis.__rc1Election); assertElectionSources(root); installed = true; globalThis.__rc1Election = api;
      const files = new Map(['src/standing.js', 'src/season.js'].map(file => [fileURLToPath(new URL(file, root)).toLowerCase(), file]));
      const hook = registerHooks({ load(url, context, nextLoad) {
        const result = nextLoad(url, context); if (!url.startsWith('file:')) return result;
        const file = files.get(fileURLToPath(url).toLowerCase()); if (!file) return result;
        const raw = typeof result.source === 'string' ? result.source : Buffer.from(result.source).toString('utf8');
        const original = raw.replaceAll('\r\n', '\n'); assert.equal(sha256(original), ELECTION_SOURCE_PINS[file]);
        let source = original; const edits = [];
        const replace = (from, to) => { assert.equal(source.split(from).length - 1, 1, 'Election observation site changed');
          source = source.replace(from, to); edits.push({ original: from, replacement: to }); };
        if (file === 'src/standing.js') {
          replace('return rows.map((r) => {', 'const result = rows.map((r) => {');
          replace('}).sort((a, b) => b.standing - a.standing);', '}).sort((a, b) => b.standing - a.standing);\n  return globalThis.__rc1Election.scored(rows, result);');
        } else {
          replace('export async function recordReckoning(pool, season) {', 'async function __rc1OriginalRecordReckoning(pool, season) {');
          replace('const top = (await cityStanding(pool, 1))[0] || null;', 'const top = (await cityStanding(pool, 1))[0] || null;\n  globalThis.__rc1Election.top(top);');
          const suffix = '\nexport async function recordReckoning(pool, season) {\n  return globalThis.__rc1Election.run(pool, season, observed => __rc1OriginalRecordReckoning(observed, season));\n}\n';
          source += suffix; edits.push({ original: '<module suffix>', replacement: suffix });
        }
        transformations.push({ file, originalSource: raw, originalSourceSha256: sha256(raw), transformedSource: source, transformedSourceSha256: sha256(source), edits });
        return { ...result, source };
      } });
      return { restore() { assert(!busy); hook.deregister(); delete globalThis.__rc1Election; restored = true; } };
    },
  };
  return api;
}

// The witness is supplied only by the trusted test recorder, never by a player.
// Membership and all values come from complete native snapshots/returned rows.
export function verifyColdSeasonElection(before, after, witness) {
  if (!witness) return null;
  assertElectionSources(); assert.equal(witness.format, 1); assert.deepEqual(witness.sourcePins, ELECTION_SOURCE_PINS);
  assert.equal(witness.boundary.command, 'INSERT'); assert.equal(witness.boundary.outcome, 'AUTOCOMMITTED');
  assert.equal(witness.boundary.sqlSha256, sha256(insertQuery));
  assert.deepEqual(witness.before, witness.after, 'Election candidate state changed during the selected read sequence');
  const required = { accounts: ['id', 'status'], account_persistent: ['account_id', 'agent_flag', 'npc_flag', ...columns],
    characters: ['id', 'account_id', 'name', 'respect', 'alive'], districts: ['id', 'holder_gang'], gangs: ['id'] };
  for (const table of candidateTables) {
    assert(Array.isArray(witness.before.tables[table]), 'Missing complete candidate table');
    const fields = witness.before.fields[table]; assert(Array.isArray(fields), 'Missing candidate field metadata');
    const names = fields.map(field => field.name); assert.equal(new Set(names).size, names.length, 'Duplicate candidate field');
    for (const field of required[table]) assert(names.includes(field), 'Missing candidate eligibility field: ' + table + '.' + field);
    for (const row of witness.before.tables[table]) assert.deepEqual(Object.keys(row).sort(), [...names].sort(), 'Candidate row lost complete column data');
  }
  for (const table of candidateTables.filter(table => table !== 'accounts')) {
    assert.deepEqual(order(before.tables[table]), order(witness.before.tables[table]), 'Candidate input disagrees with before resource state');
    assert.deepEqual(order(after.tables[table]), order(witness.after.tables[table]), 'Candidate input disagrees with after resource state');
  }
  if (witness.scores.length !== 1) return { unsupported: 'Cold computation was not observed: cache-hit/shared-flight/imported-state or repeated computation' };
  const { input, output } = witness.scores[0], tables = witness.before.tables;
  assert.equal(witness.tops.length, 1, 'Missing/duplicate original cityStanding result');
  const q = witness.queries;
  if (q.length !== 4 || q.some((entry, index) => entry.sql !== [standingQuery, lookupQuery, districtQuery, insertQuery][index]))
    return { unsupported: 'Unclassified empty, Family, repeated or compound election query trace' };
  assert(q.slice(0, -1).every(entry => entry.status === 'RETURNED' && entry.command === 'SELECT'));
  assert.equal(q.at(-1).status, 'RUNNING'); assert.deepEqual(q[0].parameters, []); assert.deepEqual(q[2].parameters, []);
  assert.deepEqual(q[0].fields.map(field => field.name), ['account_id', ...columns, 'name', 'respect'], 'Original standing result columns differ');
  for (const field of q[0].fields) {
    const table = ['name', 'respect'].includes(field.name) ? 'characters' : 'account_persistent';
    assert.equal(field.type, witness.before.fields[table].find(value => value.name === field.name)?.type, 'Standing result type differs from native source column');
  }
  for (const entry of q.slice(0, -1)) assert.equal(entry.rowCount, entry.rows.length, 'Native result cardinality differs');
  assert.deepEqual(input, q[0].rows, 'Original scorer input order differs from actual returned native rows');
  const accounts = new Map(), persistent = new Map();
  for (const row of tables.accounts) { assert(!accounts.has(row.id), 'Duplicate account'); accounts.set(row.id, row); }
  for (const row of tables.account_persistent) { assert(!persistent.has(row.account_id), 'Duplicate persistent account'); persistent.set(row.account_id, row); }
  const expected = [];
  for (const ch of tables.characters) {
    const account = accounts.get(ch.account_id), legend = persistent.get(ch.account_id);
    if (!ch.alive || !account || !legend || legend.agent_flag !== false || legend.npc_flag !== false || account.status === null || account.status === 'banned') continue;
    const row = { account_id: ch.account_id };
    for (const col of columns) {
      const field = q[0].fields.find(field => field.name === col); assert(field, 'Missing standing column type');
      row[col] = legend[col] ?? ([20, 1700].includes(field.type) ? '0' : 0);
    }
    expected.push({ ...row, name: ch.name, respect: ch.respect });
  }
  assert.deepEqual(order(input), order(expected), 'Actual standing input membership/value/multiplicity differs from complete eligible population');
  if (input.some(row => columns.some(col => Number(row[col]) !== 0))) return { unsupported: 'Nonzero scoring needs a separate provenance verifier' };
  if (!input.length) return { unsupported: 'Empty election is outside the positive-owner subset' };
  const pillars = { blood: 0, empire: 0, power: 0, legit: 0, hustle: 0, honor: 0 };
  assert.deepEqual(output, input.map(row => ({ accountId: row.account_id, name: row.name, level: levelOf(Number(row.respect)), standing: 0, pillars })),
    'Original all-zero scorer changed tied input order or result');
  const top = { rank: 1, name: output[0].name, level: output[0].level, standing: 0, title: 'Nobody Yet', pillars };
  assert.deepEqual(witness.tops[0], top, 'Selected original board result differs from actual ranking');
  assert.deepEqual(q[1].parameters, [top.name]);
  const livingNames = tables.characters.filter(row => row.alive && row.name === top.name);
  if (livingNames.length !== 1) return { unsupported: 'Ambiguous living-name account lookup requires its own native subset witness' };
  assert.deepEqual(q[1].rows, [{ account_id: livingNames[0].account_id }]);
  assert.equal(livingNames[0].account_id, output[0].accountId, 'Name lookup selected another account');
  const held = tables.districts.filter(row => row.holder_gang !== null).map(row => ({ id: row.id, holder_gang: row.holder_gang }));
  assert.deepEqual(order(q[2].rows), order(held), 'Held district query omitted/altered native rows');
  if (held.some(row => DISTRICTS.some(core => core.id === row.id))) return { unsupported: 'Core Family election remains outside this cold individual subset' };
  const parameters = [witness.season, seasonModOf(witness.season).id, output[0].accountId, top.name, null, null, null, null, null];
  assert.deepEqual(q[3].parameters, parameters, 'Saved selection parameters differ from actual original reads');
  const prior = new Map(before.tables.season_records.map(row => [row.season, row]));
  const added = after.tables.season_records.filter(row => !prior.has(row.season));
  assert.equal(added.length, 1, 'Election witness must bind one new stored record'); const record = added[0];
  assert.equal(record.season, witness.season); assert.equal(record.crowned, false);
  for (const [index, field] of ['season', 'mod_id', 'champion_account', 'champion_name', 'champion_standing', 'family_gang', 'family_name', 'family_tag', 'family_districts'].entries())
    assert.deepEqual(record[field], parameters[index], 'Inserted record does not match original selection: ' + field);
  assert(Number.isFinite(Date.parse(record.at)) && Date.parse(record.at) >= witness.logicalAt, 'Inserted record predates selection');
  for (const table of Object.keys(before.tables)) if (table !== 'season_records')
    assert.deepEqual(before.tables[table], after.tables[table], 'Initial election overlapped another resource change');
  return { season: witness.season, accountId: output[0].accountId, characterId: livingNames[0].id,
    tiedCandidates: input.length, standing: 0, crownDelta: 0, currencyGrant: false, provenanceId: witness.id,
    sourcePins: ELECTION_SOURCE_PINS, candidateStateSha256: sha256(canonicalJson(witness.before)),
    returnedOrderSha256: sha256(canonicalJson(input)), selectedResultSha256: sha256(canonicalJson(witness.tops[0])) };
}
