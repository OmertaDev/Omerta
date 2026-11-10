// Pure controls only; no mocked backend result is native qualification.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ageRemovalHistoricalInput } from '../tools/age-removal-source-transfer.js';
import './task-puzzle-native-integration-guard.js';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {questingNativeQuestProjection, questingNativeCatalogProjection, assertQuestingPhase2SourceInputs,
  createCommerceReleasePhase2MigrationCatalog, verifyCommerceNativeBranches,
  verifyCommerceReleasePhase2CausalNegatives} from '../tools/questing-ux-release-phase2-native-catalog.js';
import {QUESTING_CATALOG_COLUMNS as columns, QUESTING_CATALOG_TABLES as tables}
  from '../tools/questing-enterprise-catalog.js';
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const git=(...args)=>execFileSync('git',['--no-replace-objects',...args],{maxBuffer:64*1024*1024});
const protectedFile="tools/ux-release-phase2-native-catalog.js";
const successorFile="tools/questing-ux-release-phase2-native-catalog.js";
const copyPin=Object.freeze({
  "bytes": 54498,
  "sha256": "65cd8de2870f545c34ed2e869d2cbc1b892a0cdb23feee594e593ed247b40d63",
  "engineCharacters": 33242,
  "engineSha256": "2ac048b9ba583355dfa6170f0fdce8d59ff5e7526b3fcc59d3c72a960919923a",
  "bridgeSha256": "7a630e127495b5c8c8d83fd887b96c134b3d5eefd7aa797be22d4a9cd0ce3916",
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
const successor=ageRemovalHistoricalInput(successorFile,fs.readFileSync(successorFile,'utf8')).replaceAll('\r\n','\n');
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
let casinoProfiles = 0, casinoRefusals = 0;
for (const version of [16,18]) for (const profile of ['fresh','phase2','director']) {
  const business=['id','character_id','kind','tier','last_collect_at','launder_used','launder_at','scrutiny','scrutiny_at','shakedown_at','inside_at','rake_cursor','upkeep_at','acquired_at','spec','spec_at','takeover_cd_until'];
  const volume=['id','total','profit','distributed','jackpot'];
  const oldColumns=[['businesses',business],['den_volume',volume]].flatMap(([table,names])=>names.map((column_name,i)=>({table_name:table,column_name,ordinal:i+1})));
  const ordered=profile==='fresh'?[business.toSpliced(12,0,'rake_index_cursor'),volume.toSpliced(4,0,'rake_index','rake_checkpoint_volume','rake_legacy_owners')]
    :[[...business,'rake_index_cursor'],[...volume,'rake_index','rake_checkpoint_volume','rake_legacy_owners']];
  const specs={rake_index_cursor:['text',false,null],rake_index:['text',true,"'0'::text"],rake_checkpoint_volume:['numeric',false,null],rake_legacy_owners:['integer',true,'0']};
  const live=fixture(version), includeNotNull=profile!=='director';
  live.columns.unshift(...[['businesses',ordered[0]],['den_volume',ordered[1]]].flatMap(([table,names])=>names.map((name,i)=>{
    const row={table_name:table,column_name:name,ordinal:i+1};if(!specs[name])return row;
    const[type,not_null,default_expression]=specs[name];return{...row,type,not_null,default_expression,typmod:-1,identity:'',generated:'',collation_schema:type==='text'?'pg_catalog':null,collation_name:type==='text'?'default':null};
  })));
  if(version===18)live.constraints.unshift(...['rake_index','rake_legacy_owners'].map(name=>({table_name:'den_volume',name:'den_volume_'+name+'_not_null',type:'n',validated:true,deferrable:false,deferred:false,definition:'NOT NULL '+name,match_type:' ',update_action:' ',delete_action:' ',referenced_schema:null,referenced_table:null,columns:[name],referenced_columns:[]})));
  const projection=questingNativeCatalogProjection(live,version,includeNotNull,profile);
  assert.deepEqual(projection.projectMetadata(live),{...structuredClone(baseline),columns:oldColumns});casinoProfiles++;
  const constraints=live.constraints.filter(row=>includeNotNull||row.type!=='n').map(({table_name,name,definition})=>({table_name,name,definition}));
  assert.deepEqual(projection.projectConstraints(constraints),[]);
  const reject=change=>{const bad=structuredClone(live);change(bad);assert.throws(()=>projection.projectMetadata(bad));casinoRefusals++;};
  for(const[index,row]of live.columns.entries())if(specs[row.column_name]){
    reject(value=>value.columns.splice(index,1));reject(value=>value.columns.push({...row}));
    for(const key of Object.keys(row))reject(value=>{value.columns[index][key]=mutate(row[key]);});
  }
  reject(value=>value.columns.splice(value.columns.findIndex(row=>row.column_name==='rake_cursor'),1));
  reject(value=>{value.columns.find(row=>row.column_name==='upkeep_at').ordinal++;});
  reject(value=>value.columns.push({table_name:'den_volume',column_name:'rake_unknown',ordinal:9}));
  reject(value=>{value.columns.find(row=>row.column_name==='rake_index_cursor').ordinal=15;});
  reject(value=>{value.columns.find(row=>row.column_name==='rake_index').ordinal=profile==='fresh'?6:5;});
  for(const[index,row]of constraints.entries())if(row.table_name==='den_volume'){
    const bad=structuredClone(constraints);bad[index].definition+=' changed';assert.throws(()=>projection.projectConstraints(bad));casinoRefusals++;
  }
}
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
  admissionRefusals, casinoProfiles, casinoRefusals, nativeAttempts, nativeExecution:false, historicalResultsTransferred:false}));
// Additive pure reader conservation controls. No source is evaluated or substituted into runtime.
const readerCopyPins = Object.freeze([
  {
    "original": "test/lib/ux-native-reader-source-compatibility.js",
    "target": "test/lib/questing-ux-native-reader-source-compatibility.js",
    "exportName": "questingNativeReaderView",
    "files": [
      "test/phase2-postgres.js",
      "tools/enterprise-native.js",
      "test/enterprise-native-guard.js"
    ],
    "oldSha256": "f433b7807bd56b3ebb6d0bcf761c40f601e9f05062abff14276349ddd7f736c2",
    "bytes": 23341,
    "sha256": "edc637f8492814d77a2433604e3be99d614225c22e0ab4e62030135d23905fc9",
    "prefixCharacters": 1966,
    "prefixSha256": "a16dd1e9643d443bfe0fd089293fb40c8bbe5fd310ccdfd1733df434df752676",
    "edits": [
      [
        "  const actualEntry = entry, actualRaw = raw, combined = BUSINESS_DESK_COMBINED_SOURCE.files.find(row => row.file === file && row.parents.wiki);\n  assert.equal(git('ls-files', '--stage', '--', file).trim(), entry.replace(' blob ', ' ').replace('\\t', ' 0\\t'),\n    'The actual index qualifies before the source-only parent view');\n",
        "  assert.equal(git('ls-files', '--stage', '--', file).trim(), entry.replace(' blob ', ' ').replace('\\t', ' 0\\t'),\n    'The actual index qualifies before the source-only parent view');\n  const questView = questingNativeReaderView(file, raw, entry);\n  raw = questView.input; entry = questView.entry;\n  const actualEntry = entry, actualRaw = raw, combined = BUSINESS_DESK_COMBINED_SOURCE.files.find(row => row.file === file && row.parents.wiki);\n"
      ],
      [
        "businessDeskCombinedHistoricalInput(row.file, rawPhysical, 'wiki')",
        "businessDeskCombinedHistoricalInput(row.file, questingNativeReaderView(row.file, rawPhysical, actualEntry).input, 'wiki')"
      ],
      [
        "businessDeskCombinedHistoricalInput(row.file, checkedOut, 'wiki')",
        "businessDeskCombinedHistoricalInput(row.file, questingNativeReaderView(row.file, checkedOut, actualEntry).input, 'wiki')"
      ],
      [
        "businessDeskCombinedHistoricalInput(file, rawPhysical, 'wiki')",
        "businessDeskCombinedHistoricalInput(file, questingNativeReaderView(file, rawPhysical, actualEntry).input, 'wiki')"
      ],
      [
        "businessDeskCombinedHistoricalInput(file, checkedOut, 'wiki')",
        "businessDeskCombinedHistoricalInput(file, questingNativeReaderView(file, checkedOut, actualEntry).input, 'wiki')"
      ]
    ],
    "oldEntry": "100644 blob 0a09ea5c6fd3e9a8d01d398e7183cb87a5e3a133\ttest/lib/ux-native-reader-source-compatibility.js"
  },
  {
    "original": "test/lib/ux-director-reader-source-compatibility.js",
    "target": "test/lib/questing-ux-director-reader-source-compatibility.js",
    "exportName": "questingDirectorReaderView",
    "files": [
      "test/director-migration.js"
    ],
    "oldSha256": "93863ba374e6df23371cb84c41ab39009110f420f8441d5bcb639df7a6f32225",
    "bytes": 10237,
    "sha256": "603696309eae395a64ba601ea8e8db07ba48ae0a828a77aa3c7aed21853efeb1",
    "prefixCharacters": 3168,
    "prefixSha256": "e6da6cb6bc475ab8e92e42f8cb337181fd651ffe0188ff633976d13c701ff687",
    "edits": [
      [
        "for (const row of pin.files) {\n  const current =",
        "for (const row of pin.files) {\n  const questReader = admittedQuestingDirectorReader(row.file);\n  const current ="
      ],
      [
        "economyUxMergeMainHistoricalInput(row.file, fs.readFileSync(row.file, 'utf8'))",
        "economyUxMergeMainHistoricalInput(row.file, questReader.physical.input)"
      ],
      [
        "economyUxMergeMainHistoricalInput(row.file, git('show', 'HEAD:' + row.file))",
        "economyUxMergeMainHistoricalInput(row.file, questReader.head.input)"
      ],
      [
        "  const mergeRow = ECONOMY_UX_MERGE_SOURCE.files.find(item => item.file === row.file); assert(mergeRow);\n",
        "  const mergeRow = ECONOMY_UX_MERGE_SOURCE.files.find(item => item.file === row.file); assert(mergeRow);\n  assert.equal(questReader.head.entry, git('ls-tree', QUESTING_SOURCE.predecessor, '--', row.file).trim(), 'The independently admitted quest predecessor retains its exact Git source entry');\n"
      ]
    ],
    "oldEntry": "100644 blob 6415830c9bbd1f50608f496530f87f1eba3ca28e\ttest/lib/ux-director-reader-source-compatibility.js"
  },
  {
    "original": "test/lib/ux-enterprise-reader-source-compatibility.js",
    "target": "test/lib/questing-ux-enterprise-reader-source-compatibility.js",
    "exportName": "questingEnterpriseReaderView",
    "files": [
      "test/enterprise-release-phase2-migration-catalog.js"
    ],
    "oldSha256": "d7b9ef827c33f5291228da4aee1f7959bab4b5ced35513e02c3697fb8d186319",
    "bytes": 9936,
    "sha256": "29e10bd68ffc4a04004e46bcb51011cce8256e921488f2ce272b2a951bd91978",
    "prefixCharacters": 3578,
    "prefixSha256": "4a35c639dad611939f7d323ca037f6c9e9331689f034cacc56487bec89c86cc0",
    "edits": [
      [
        "for (const row of pin.files) {\n  const current =",
        "for (const row of pin.files) {\n  const questReader = admittedQuestingEnterpriseReader(row.file);\n  const current ="
      ],
      [
        "economyUxMergeMainHistoricalInput(row.file, fs.readFileSync(row.file, 'utf8'))",
        "economyUxMergeMainHistoricalInput(row.file, questReader.physical.input)"
      ],
      [
        "economyUxMergeMainHistoricalInput(row.file, git('show', 'HEAD:' + row.file))",
        "economyUxMergeMainHistoricalInput(row.file, questReader.head.input)"
      ],
      [
        "  const mergeRow = ECONOMY_UX_MERGE_SOURCE.files.find(item => item.file === row.file); assert(mergeRow);\n",
        "  const mergeRow = ECONOMY_UX_MERGE_SOURCE.files.find(item => item.file === row.file); assert(mergeRow);\n  assert.equal(questReader.head.entry, git('ls-tree', QUESTING_SOURCE.predecessor, '--', row.file).trim(), 'The independently admitted quest predecessor retains its exact Git source entry');\n"
      ]
    ],
    "oldEntry": "100644 blob 3382a3fd52c0f84d2c8a2da7606ffa1aae0cd4d1\ttest/lib/ux-enterprise-reader-source-compatibility.js"
  }
].map(record => Object.freeze({ ...record,
  files: Object.freeze(record.files), edits: Object.freeze(record.edits.map(Object.freeze)) })));
function qualifyPureReaderCopy(input, record) {
  assert(readerCopyPins.includes(record), 'Only the exact finite reader copy declarations');
  assert.equal(typeof input, 'string'); const lf = input.replaceAll('\r\n', '\n');
  assert(!lf.includes('\r') && (input === lf || input === lf.replaceAll('\n', '\r\n')));
  assert.equal(Buffer.byteLength(lf), record.bytes); assert.equal(sha(lf), record.sha256);
  const prefix = lf.slice(0, record.prefixCharacters); assert.equal(sha(prefix), record.prefixSha256);
  let restored = lf.slice(record.prefixCharacters);
  for (const [before, after] of record.edits.toReversed()) {
    assert.equal(restored.split(after).length, 2, 'Every source-only reader bridge has one exact context');
    restored = restored.replace(after, () => before);
  }
  const original = git('show', '17fdf85fdd21fd3767463df8ba47614f7d1f6432:' + record.original).toString('utf8');
  assert.equal(sha(original), record.oldSha256); assert.equal(restored, original, 'Every old assertion/refusal is preserved in exact complete source');
  return true;
}
let readerCopyRefusals = 0, readerViewRefusals = 0, readerViewPositives = 0, retainedReaderBridges = 0;
const { QUESTING_SOURCE: readerQuestSource } = await import('../tools/questing-source-transfer.js');
for (const record of readerCopyPins) {
  const oldCommitted = git('show', 'HEAD:' + record.original), oldPhysical = fs.readFileSync(record.original), oldText = oldCommitted.toString('utf8');
  assert.equal(git('ls-tree', 'HEAD', '--', record.original).toString('utf8').trim(), record.oldEntry, 'Protected old reader retains exact Git mode/blob');
  assert.equal(sha(oldCommitted), record.oldSha256); assert(Buffer.from(oldText).equals(oldCommitted));
  const stat = fs.lstatSync(record.original); assert(stat.isFile() && !stat.isSymbolicLink());
  assert(oldPhysical.equals(oldCommitted) || oldPhysical.equals(Buffer.from(oldText.replaceAll('\n','\r\n'))));
  const newStat = fs.lstatSync(record.target); assert(newStat.isFile() && !newStat.isSymbolicLink());
  const source = ageRemovalHistoricalInput(record.target, fs.readFileSync(record.target, 'utf8')).replaceAll('\r\n','\n');
  assert(qualifyPureReaderCopy(source, record));
  const crlfSource = source.replaceAll('\n','\r\n'); assert.notEqual(crlfSource, source); assert(qualifyPureReaderCopy(crlfSource, record));
  for (const bad of [source+'\n', source.slice(1), '\ufeff'+source, source.replace('\n','\r\n'),
    source.replace(/\S/,'?'), source.slice(0,record.prefixCharacters)+source.slice(record.prefixCharacters).replace(/\S/,'?')]) {
    assert.notEqual(bad, source); assert.throws(() => qualifyPureReaderCopy(bad, record)); readerCopyRefusals++;
  }
  for (const [before, after] of record.edits) { assert.throws(() => qualifyPureReaderCopy(source.replace(after,()=>before), record)); readerCopyRefusals++; retainedReaderBridges++; }
  assert.throws(() => qualifyPureReaderCopy(source, Object.freeze({...record}))); readerCopyRefusals++;
  const module = await import(new URL('../'+record.target, import.meta.url)), view = module[record.exportName]; assert.equal(typeof view, 'function');
  for (const file of record.files) {
    const text = git('show','HEAD:'+file).toString('utf8'), entry = git('ls-tree','HEAD','--',file).toString('utf8').trim();
    const tracked = Object.hasOwn(readerQuestSource.files,file);
    const expectedText = tracked ? git('show',readerQuestSource.predecessor+':'+file).toString('utf8') : text;
    const expectedEntry = tracked ? git('ls-tree',readerQuestSource.predecessor,'--',file).toString('utf8').trim() : entry;
    const crlf = text.replaceAll('\n','\r\n'); assert.notEqual(crlf,text);
    for (const input of [text,crlf,Buffer.from(text)]) {
      const result=view(file,input,entry); assert(Object.isFrozen(result));
      const viewedText=Buffer.isBuffer(result.input)?result.input.toString('utf8'):result.input;
      assert(Buffer.from(viewedText.replaceAll('\r\n','\n')).equals(Buffer.from(expectedText)), 'The complete reader view equals its exact declared source');
      if(!tracked)assert.strictEqual(result.input,input,'Unchanged readers preserve their original LF/CRLF input without an alias');
      assert.equal(result.entry,expectedEntry);
      assert.deepEqual([result.sourceOnly,result.runtime,result.native,result.financial,result.activation,result.deployment,result.priorResultsTransferred], [true,false,false,false,false,false,false]); readerViewPositives++;
    }
    for (const bad of [text+'\n',text.slice(1),'\ufeff'+text,text+'\0',text.replace('\n','\r\n'),Buffer.concat([Buffer.from(text),Buffer.from([255])]),null]) {
      assert.throws(()=>view(file,bad,entry));readerViewRefusals++;
    }
    for (const bad of [entry.replace(/blob [a-f0-9]{40}/,'blob '+'0'.repeat(40)),entry.replace(' blob ',' tree '),entry+'\n']) {
      assert.throws(()=>view(file,text,bad));readerViewRefusals++;
    }
    if(tracked){const otherMode=entry.startsWith('100644')?'100755':'100644';assert.throws(()=>view(file,text,otherMode+entry.slice(6)));readerViewRefusals++;}
    if(record.exportName==='questingEnterpriseReaderView'){
      // Even an internally consistent forged blob cannot gain the exact current-source view.
      for(const bad of [text+'\n',text.replace('casinoDdlCausal','unknownCasinoDdlCausal')]){
        assert.notEqual(bad,text);
        const digest=crypto.createHash('sha1').update('blob '+Buffer.byteLength(bad)+'\0').update(bad).digest('hex');
        const forged=entry.replace(/blob [a-f0-9]{40}/,'blob '+digest);
        assert.throws(()=>view(file,bad,forged));readerViewRefusals++;
      }
      const preimage=git('show',readerQuestSource.revision+':'+file).toString('utf8');
      assert.notEqual(preimage,text);assert.throws(()=>view(file,preimage,entry));readerViewRefusals++;
      const preimageEntry=git('ls-tree',readerQuestSource.revision,'--',file).toString('utf8').trim();
      assert.throws(()=>view(file,preimage,preimageEntry));readerViewRefusals++;
    }
    assert.throws(()=>view(file,text,entry,{}));readerViewRefusals++;
  }
  for(const file of ['../test/phase2-postgres.js','constructor','__proto__',null]){assert.throws(()=>view(file,'x','x'));readerViewRefusals++;}
}
console.log(JSON.stringify({phase:'QUESTING_PURE_READER_SUCCESSOR_GUARDS',readerCopies:readerCopyPins.length,
  retainedReaderBridges,readerCopyRefusals,readerViewPositives,readerViewRefusals,
  sourceOnly:true,runtime:false,native:false,nativeExecution:false,historicalResultsTransferred:false}));
