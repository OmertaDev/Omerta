// Pure controls only; no mocked backend result is native qualification.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {questingNativeQuestProjection, assertQuestingPhase2SourceInputs,
  createCommerceReleasePhase2MigrationCatalog, verifyCommerceNativeBranches,
  verifyCommerceReleasePhase2CausalNegatives} from '../tools/questing-ux-release-phase2-native-catalog.js';
import {QUESTING_CATALOG_COLUMNS as columns, QUESTING_CATALOG_TABLES as tables}
  from '../tools/questing-enterprise-catalog.js';
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const git=(...args)=>execFileSync('git',['--no-replace-objects',...args],{maxBuffer:64*1024*1024});
const protectedFile="tools/ux-release-phase2-native-catalog.js";
const successorFile="tools/questing-ux-release-phase2-native-catalog.js";
const copyPin=Object.freeze({
  "bytes": 52073,
  "sha256": "ded65ea0c23d32584899ef6bbf5b49d37971cc62c206f8190e8ce019ec650eb4",
  "engineCharacters": 33242,
  "engineSha256": "2ac048b9ba583355dfa6170f0fdce8d59ff5e7526b3fcc59d3c72a960919923a",
  "bridgeSha256": "3f2c15f1629371042c212fa74314efbaff2118821aea80e35b2fe8390c990d74",
  "protectedSha256": "b90d784c72f4e9167be1df50171360dab04f361152e4a54cda96362de24cb331"
});
const substitutions=Object.freeze([
  [
    "export async function readCommerceReleasePhase2Metadata(pool)",
    "async function readArchivedComparisonMetadata(pool)"
  ],
  [
    "export async function createCommerceReleasePhase2MigrationCatalog(pool, endpoint, input, options)",
    "async function createArchivedComparisonCatalog(pool, endpoint, input, options)"
  ],
  [
    "export async function verifyCommerceNativeBranches(pool, endpoint)",
    "async function verifyArchivedComparisonBranches(pool, endpoint)"
  ],
  [
    "integratedSchemaSources(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'))",
    "integratedSchemaSources(archived582ComparisonSource())"
  ]
].map(Object.freeze));
const protectedBytes=git('show','17fdf85fdd21fd3767463df8ba47614f7d1f6432:'+protectedFile);
const protectedSource=protectedBytes.toString('utf8');
assert(Buffer.from(protectedSource).equals(protectedBytes));
assert.equal(sha(protectedBytes),copyPin.protectedSha256);
assert(git('show','HEAD:'+protectedFile).equals(protectedBytes),'Protected old native helper remains exact');
assert.equal(git('ls-tree','HEAD','--',protectedFile).toString('utf8'),
  git('ls-tree','17fdf85fdd21fd3767463df8ba47614f7d1f6432','--',protectedFile).toString('utf8'),
  'Protected old native source keeps its exact original mode and Git identity');
const oldEntry=git('ls-tree','HEAD','--',protectedFile).toString('utf8').trim().match(/^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/);
assert(oldEntry&&oldEntry[3]===protectedFile);
assert.equal(git('ls-files','--stage','--',protectedFile).toString('utf8').trim(),oldEntry[1]+' '+oldEntry[2]+' 0\t'+protectedFile);
const oldRaw=fs.readFileSync(protectedFile),oldStat=fs.lstatSync(protectedFile);
assert(oldStat.isFile()&&!oldStat.isSymbolicLink());
assert(oldRaw.equals(protectedBytes)||oldRaw.equals(Buffer.from(protectedSource.replaceAll('\n','\r\n'))));
const successor=fs.readFileSync(successorFile,'utf8').replaceAll('\r\n','\n');
const raw=fs.readFileSync('schema.sql','utf8');
const baseline={relations:[{name:'accounts',kind:'r',persistence:'p'}],columns:[],constraints:[],indexes:[]};
function fixture(version) {
  const metadata = structuredClone(baseline), primary = { quest_workshop_mysteries: ['id'], quest_workshop_plays: ['mystery_id', 'account_id'], quest_reading_room: ['account_id', 'day_ordinal'] };
  const constraint = (table, name, type, cols, definition) => ({ table_name: table, name, type, validated: true, deferrable: false, deferred: false,
    definition, match_type: ' ', update_action: ' ', delete_action: ' ',
    referenced_schema: null, referenced_table: null, columns: cols, referenced_columns: [],
    no_inherit: type === 'p' || type === 'f', is_local: true, inheritance_count: 0 });
  for (const table of tables) {
    metadata.relations.push({ name: table, kind: 'r', persistence: 'p' });
    for (const [i, [name, type, required, value]] of columns[table].entries()) {
      metadata.columns.push({ table_name: table, column_name: name, ordinal: i + 1, type, typmod: -1, default_expression: value,
        not_null: required, identity: '', generated: '', collation_schema: type === 'text' ? 'pg_catalog' : null, collation_name: type === 'text' ? 'default' : null });
      if (version === 18 && required) metadata.constraints.push(constraint(table, `${table}_${name}_not_null`, 'n', [name], `NOT NULL ${name}`));
    }
    metadata.constraints.push(constraint(table, `${table}_pkey`, 'p', primary[table], `PRIMARY KEY (${primary[table].join(', ')})`));
  }
  for (const [table, column, target] of [['quest_workshop_mysteries', 'author_account_id', 'accounts'], ['quest_workshop_plays', 'mystery_id', 'quest_workshop_mysteries'],
    ['quest_workshop_plays', 'account_id', 'accounts'], ['quest_reading_room', 'account_id', 'accounts']]) {
    metadata.constraints.push({ ...constraint(table, `${table}_${column}_fkey`, 'f', [column], `FOREIGN KEY (${column}) REFERENCES ${target}(id)`), match_type: 's', update_action: 'a', delete_action: 'a',
      referenced_schema: '$self', referenced_table: target, referenced_columns: ['id'] });
  }
  metadata.constraints.push(constraint('quest_workshop_mysteries', 'quest_workshop_mysteries_status_check', 'c', ['status'],
    "CHECK (status = ANY (ARRAY['draft'::text, 'published'::text]))"),
  constraint('quest_workshop_plays', 'quest_workshop_plays_stars_check', 'c', ['stars'], 'CHECK (stars >= 1 AND stars <= 5)'));
  for (const [name, table, cols, unique] of [
    ...tables.map(table => [`${table}_pkey`, table, primary[table], true]),
    ['ix_quest_workshop_author', 'quest_workshop_mysteries', ['author_account_id'], false],
    ['ix_quest_workshop_published', 'quest_workshop_mysteries', ['status', 'published_at'], false],
  ]) metadata.indexes.push({ table_name: table, name, definition: `CREATE ${unique ? 'UNIQUE ' : ''}INDEX ${name} ON $self.${table} USING btree (${cols.join(', ')})`,
    unique, primary: name.endsWith('_pkey'), valid: true, ready: true, live: true, nulls_not_distinct: false, predicate: null });
  return metadata;
}

function canonicalCopy(input) {
  assert.equal(typeof input, 'string');
  const text = input.replaceAll('\r\n', '\n');
  assert(!text.includes('\r') && (input === text || input === text.replaceAll('\n', '\r\n')));
  return text;
}
function qualifyCopy(input) {
  const text = canonicalCopy(input);
  assert.equal(Buffer.byteLength(text), copyPin.bytes);
  assert.equal(sha(text), copyPin.sha256);
  const copied = text.slice(0, copyPin.engineCharacters), bridge = text.slice(copyPin.engineCharacters);
  assert.equal(sha(copied), copyPin.engineSha256);
  assert.equal(sha(bridge), copyPin.bridgeSha256);
  let restored = copied;
  for (const [original, current] of substitutions.toReversed()) {
    assert.equal(restored.split(current).length, 2, 'Each finite copied-engine bridge is unique');
    restored = restored.replace(current, original);
  }
  assert.equal(restored, protectedSource, 'The entire protected old engine is exact after four finite substitutions');
  return true;
}
assert(qualifyCopy(successor));
assert(qualifyCopy(successor.replaceAll('\n', '\r\n')));
let copyRefusals = 0;
const changedByte = value => value.replace(/\S/, character => character === '?' ? '!' : '?');
for (const bad of [successor + '\n', successor.slice(1), '\ufeff' + successor,
  successor.replace('\n', '\r\n'), changedByte(successor),
  successor.slice(0, copyPin.engineCharacters) + changedByte(successor.slice(copyPin.engineCharacters)),
  successor.replace('Integrated economy and UX source parents', 'Unknown archived source parents'),
  successor.replace('Same-client native quest fields requalify', 'Unknown native quest fields'),
  successor.replace('catalogQueries.length, 5', 'catalogQueries.length, 4')]) {
  assert.notEqual(bad, successor); assert.throws(() => qualifyCopy(bad)); copyRefusals++;
}
for (const [original, current] of substitutions) {
  assert.throws(() => qualifyCopy(successor.replace(current, original))); copyRefusals++;
}
let metadataRefusals = 0, constraintRefusals = 0, profiles = 0;
const mutate = value => typeof value === 'boolean' ? !value : typeof value === 'number' ? value + 1
  : Array.isArray(value) ? [...value, '__unknown__'] : value === null ? '__unknown__' : value + '__unknown__';
for (const version of [16, 18]) for (const [profile, includeNotNull, ordinal] of [['fresh', true, 6], ['phase2', true, 9], ['director', false, 9]]) {
  const reference = fixture(version), projection = questingNativeQuestProjection(reference, version, includeNotNull);
  assert.equal(projection.sourceOnly, true); assert.equal(projection.nativeAdmission, false);
  assert.equal(projection.priorResultsTransferred, false);
  const live = structuredClone(reference);
  const retainedColumn = { table_name: 'store_payments', column_name: 'revenue_split', ordinal, type: 'jsonb' };
  live.columns.unshift(retainedColumn);
  const projected = projection.projectMetadata(live);
  assert.deepEqual(projected, { ...structuredClone(baseline), columns: [retainedColumn] },
    'Retained profile ordinals and existing runtime rows are preserved for the old oracle');
  assert.strictEqual(projected.columns[0], retainedColumn);
  for (const field of ['relations', 'columns', 'constraints', 'indexes']) {
    const indexes = reference[field].map((row, index) => ({ row, index })).filter(({row}) =>
      tables.includes(field === 'relations' ? row.name : row.table_name));
    for (const {row, index} of indexes) {
      const changes = [
        values => values.splice(index, 1), values => values.push({...row}),
        values => { values[index] = {...row, unknown: true}; },
        ...Object.keys(row).map(key => values => { values[index] = {...row, [key]: mutate(row[key])}; }),
      ];
      for (const change of changes) {
        const bad = structuredClone(reference); change(bad[field]);
        assert.throws(() => projection.projectMetadata(bad)); metadataRefusals++;
      }
    }
  }
  const retainedConstraint = { table_name: 'store_payments', name: 'retained', definition: 'CHECK (true)' };
  const questConstraints = reference.constraints.filter(row => includeNotNull || row.type !== 'n')
    .map(({table_name, name, definition}) => ({table_name, name, definition}));
  const constraints = [retainedConstraint, ...questConstraints];
  assert.deepEqual(projection.projectConstraints(constraints), [retainedConstraint]);
  for (let index = 1; index < constraints.length; index++) {
    for (const change of [
      values => values.splice(index, 1), values => values.push({...values[index]}),
      values => { values[index].definition += '__unknown__'; },
      values => { values[index].name += '__unknown__'; },
      values => { values[index].table_name = '__unknown_quest_table__'; },
      values => { values[index].unknown = true; },
    ]) { const bad = structuredClone(constraints); change(bad); assert.throws(() => projection.projectConstraints(bad)); constraintRefusals++; }
  }
  profiles++;
}
for (const input of [null, {}, {relations: [], columns: [], constraints: [], indexes: []}]) {
  assert.throws(() => questingNativeQuestProjection(input, 18, true)); metadataRefusals++;
}
let nativeAttempts = 0, admissionRefusals = 0;
const forbidden = { query() { nativeAttempts++; throw Error('No native query in this pure guard'); },
  connect() { nativeAttempts++; throw Error('No native connection in this pure guard'); } };
for (const call of [
  () => assertQuestingPhase2SourceInputs(), () => assertQuestingPhase2SourceInputs({}),
  () => createCommerceReleasePhase2MigrationCatalog(), () => createCommerceReleasePhase2MigrationCatalog(forbidden, 'https://outside.test', raw, {}),
  () => createCommerceReleasePhase2MigrationCatalog(forbidden, 'postgres://postgres:pgcheck@127.0.0.1:5432/omerta_check', raw, {includeNotNull:true, legacyProfile:'phase2'}),
  () => verifyCommerceNativeBranches(), () => verifyCommerceNativeBranches(forbidden, 'postgres://postgres:pgcheck@127.0.0.1:5432/omerta_check'),
  () => verifyCommerceReleasePhase2CausalNegatives(), () => verifyCommerceReleasePhase2CausalNegatives(forbidden, {}, [], () => {}),
]) { await assert.rejects(async () => call()); admissionRefusals++; }
assert.equal(nativeAttempts, 0);
console.log(JSON.stringify({phase:'QUESTING_PHASE2_DIRECTOR_NATIVE_GUARDS', protectedEngineExact:true,
  finiteSubstitutions:substitutions.length, copyRefusals, profiles, metadataRefusals, constraintRefusals,
  admissionRefusals, nativeAttempts, nativeExecution:false, historicalResultsTransferred:false}));
