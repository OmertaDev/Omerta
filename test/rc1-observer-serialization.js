// Exact equality controls for two local evidence-serialization optimizations.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { canonicalJson } from '../tools/rc1-native-proof.js';
import { readVerifiedHistoryLines } from '../tools/rc1-native-history-reader.js';
import { snapshotWorldResources, WORLD_RESOURCE_TABLES, worldResourceHash } from '../tools/rc1-world-resource-observer.js';

const observerSource = await fs.readFile(new URL('../tools/rc1-world-resource-observer.js', import.meta.url), 'utf8');
const sortStart = observerSource.indexOf('const sorted = '), sortEnd = observerSource.indexOf('\nconst columnsCache', sortStart);
assert(sortStart >= 0 && sortEnd > sortStart, 'Original observer sort site must be identifiable');
const sortSource = observerSource.slice(sortStart, sortEnd);
const legacySortSource = 'const sorted = (rows) => rows.sort((a, b) => json(a).localeCompare(json(b)));';
const makeSort = (source, json = JSON.stringify) => vm.runInNewContext(`${source}\nsorted;`, { json });
const oldSort = makeSort(legacySortSource), newSort = makeSort(sortSource);
const worldSource = await fs.readFile(new URL('./rc1-native-world-workload.js', import.meta.url), 'utf8');
const journalStart = worldSource.indexOf('      const serializedJournal = canonicalJson({ event, journal });');
const journalEnd = worldSource.indexOf('\n      resourceSummary.boundaries++;', journalStart);
assert(journalStart >= 0 && journalEnd > journalStart, 'Actual journal serialization site must be identifiable');
const journalSource = worldSource.slice(journalStart, journalEnd);
const legacyJournalSource = 'resourceStream.update(`${canonicalJson({ event, journal })}\\n`);\n'
  + 'resourceCost.serializedJournalBytes += Buffer.byteLength(canonicalJson({ event, journal }));';
const makeJournal = source => vm.runInNewContext(`(canonicalJson, resourceStream, resourceCost, event, journal) => { ${source} }`, { Buffer });
const oldJournal = makeJournal(legacyJournalSource), newJournal = makeJournal(journalSource);
let rowCases = 0, journalCases = 0;
function compareSort(input) {
  const left = input.slice(), right = input.slice();
  assert.equal(oldSort(left), left); assert.equal(newSort(right), right, 'Preserve in-place return identity');
  assert.equal(JSON.stringify(right), JSON.stringify(left), 'Exact sorted row bytes differ');
  assert.equal(right.length, input.length);
  for (let index = 0; index < left.length; index++) assert.equal(right[index], left[index], 'Stable tie/duplicate identity changed');
  rowCases++;
}
function compareJournal(event, journal) {
  const result = run => {
    let calls = 0; const hash = crypto.createHash('sha256'), cost = { serializedJournalBytes: 0 };
    run(value => { calls++; return canonicalJson(value); }, hash, cost, event, journal);
    return { hash: hash.digest('hex'), bytes: cost.serializedJournalBytes, calls };
  };
  const old = result(oldJournal), current = result(newJournal);
  assert.equal(current.hash, old.hash); assert.equal(current.bytes, old.bytes);
  assert.equal(old.calls, 2); assert.equal(current.calls, 1); journalCases++;
}

const repeated = { amount: '900719925474099312345678.123456789', owner: 'José 雨' };
const sameBytes = { amount: repeated.amount, owner: repeated.owner };
const numericAndDates = [repeated, sameBytes, repeated,
  { amount: '-0.000000000000000001', when: new Date('2026-09-23T23:00:00.000Z'), optional: null },
  { amount: '0', when: new Date('2026-09-24T01:00:00.000Z'), nested: ['2', '10', '001', '1.00'] },
  { amount: '900719925474099312345678.123456790', owner: 'e\u0301' },
  { amount: '900719925474099312345678.123456790', owner: '\u00e9' },
  { b: 'same', a: 'keys' }, { a: 'keys', b: 'same' }];
for (const input of [[], [repeated], numericAndDates, numericAndDates.toReversed(), numericAndDates.slice(3).concat(numericAndDates.slice(0, 3))]) compareSort(input);
assert.equal(JSON.stringify({ owner: 'e\u0301' }).localeCompare(JSON.stringify({ owner: '\u00e9' })), 0, 'Host must exercise a distinct-byte locale tie');
compareSort([{ owner: 'e\u0301' }, { owner: '\u00e9' }, { owner: 'e\u0301' }]);
let rowSerializations = 0;
makeSort(sortSource, value => { rowSerializations++; return JSON.stringify(value); })(numericAndDates.slice());
assert.equal(rowSerializations, numericAndDates.length, 'Only one local sort key per row');
const mutable = [{ amount: '2' }, { amount: '1' }]; compareSort(mutable); mutable[0].amount = '0'; compareSort(mutable);
const event = { outcome: 'COMMITTED', transaction: 1 }, journal = { amount: repeated.amount, date: new Date('2026-09-24T00:00:00.000Z'), checks: [] };
compareJournal(event, journal); journal.amount = '-0.000000000000000001'; compareJournal(event, journal);
for (const value of [undefined, NaN, Infinity, () => 1, Symbol('unsupported')]) {
  for (const run of [oldJournal, newJournal]) assert.throws(() => run(canonicalJson, crypto.createHash('sha256'), { serializedJournalBytes: 0 }, event, { value }));
}

// Exercise the real snapshot function, including Date normalization and every
// result set/field assertion. This fixture is transport-only, not native proof.
const columns = WORLD_RESOURCE_TABLES.flatMap(table_name => ['amount', 'when', 'owner'].map(column_name => ({ table_name, column_name, data_type: column_name === 'amount' ? 'numeric' : 'text' })));
const rawRows = [{ amount: repeated.amount, when: new Date('2026-09-24T00:00:00.000Z'), owner: 'e\u0301' },
  { amount: '-0.000000001', when: new Date('2026-09-23T23:00:00.000Z'), owner: 'José' },
  { amount: repeated.amount, when: new Date('2026-09-24T00:00:00.000Z'), owner: '\u00e9' }];
let released = 0, batchCalls = 0;
const pool = { connect: async () => ({ release: () => released++, query: async sql => {
  if (sql.includes('information_schema.columns')) return { rows: columns };
  if (sql.startsWith('SELECT "')) { batchCalls++; assert.equal(sql.split(';').length, WORLD_RESOURCE_TABLES.length);
    assert(sql.includes('"amount"::text AS "amount"'));
    return WORLD_RESOURCE_TABLES.map(() => ({ command: 'SELECT', fields: ['amount', 'when', 'owner'].map(name => ({ name })), rows: structuredClone(rawRows) })); }
  if (sql.includes('pg_current_snapshot')) return { rows: [{ snapshot: '10:10:' }] };
  assert(['BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY', 'COMMIT'].includes(sql)); return {};
} }) };
const snapshot = await snapshotWorldResources(pool), expected = { format: 1, tables: {}, boundary: { snapshot: '10:10:' } };
for (const table of WORLD_RESOURCE_TABLES) expected.tables[table] = oldSort(JSON.parse(JSON.stringify(rawRows)));
assert.equal(JSON.stringify(snapshot), JSON.stringify(expected)); assert.equal(worldResourceHash(snapshot), worldResourceHash(expected));
assert.equal(released, 1); assert.equal(batchCalls, 1);
const corrupt = structuredClone(snapshot); corrupt.tables.characters[0].owner = 'foreign';
assert.notEqual(worldResourceHash(corrupt), worldResourceHash(snapshot));
const duplicate = structuredClone(snapshot); duplicate.tables.characters.push(duplicate.tables.characters[0]);
assert.notEqual(worldResourceHash(duplicate), worldResourceHash(snapshot));

const retained = process.argv.find(value => value.startsWith('--retained='))?.slice('--retained='.length);
const retainedResult = retained ? {} : null;
if (retained) {
  const run = JSON.parse(await fs.readFile(path.join(retained, 'run.json'), 'utf8'));
  const bootstrap = JSON.parse(await fs.readFile(path.join(retained, 'resource-worker-bootstrap.json'), 'utf8'));
  const oldHash = crypto.createHash('sha256'), newHash = crypto.createHash('sha256');
  const oldCost = { serializedJournalBytes: 0 }, newCost = { serializedJournalBytes: 0 }; let boundaries = 0;
  for (const state of [bootstrap.before, bootstrap.after]) for (const rows of Object.values(state.tables)) {
    compareSort(rows); compareSort(rows.toReversed());
  }
  for (const artifact of run.artifacts.filter(item => item.path.startsWith('restricted-resource-change-'))) {
    const change = JSON.parse(await fs.readFile(path.join(retained, artifact.path), 'utf8'));
    for (const table of change.restrictedChanges.tables) { compareSort(table.beforeRows); compareSort(table.afterRows.toReversed()); }
  }
  for await (const line of readVerifiedHistoryLines(retained, run)) {
    const row = JSON.parse(line); if (row.kind !== 'resource-commit-boundary') continue;
    compareJournal(row.event, row.journal); oldJournal(canonicalJson, oldHash, oldCost, row.event, row.journal);
    newJournal(canonicalJson, newHash, newCost, row.event, row.journal); boundaries++;
  }
  assert.equal(boundaries, run.result.resourceJournalCount); assert.deepEqual(newCost, oldCost);
  const hash = newHash.digest('hex'); assert.equal(hash, oldHash.digest('hex')); assert.equal(hash, run.result.resourceJournalSha256);
  Object.assign(retainedResult, { source: run.source.revision, boundaries, resourceJournalSha256: hash, serializedJournalBytes: newCost.serializedJournalBytes,
    statement: 'Verified archived artifact/chain bytes; exact old/new calculations on all retained journals and actual resource rows; no native run relabelled.' });
}
console.log(JSON.stringify({ status: 'PASS', rowCases, journalCases, actualSnapshotTables: WORLD_RESOURCE_TABLES.length,
  legacySourceRevision: '6368339e82965679c1d1aae91ecea657489a6414', retained: retainedResult }));
