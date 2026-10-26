// Pure caller/profile protocol checks over actual private helper functions; no PG import or connection.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parse } from 'acorn';
import { types as utilTypes } from 'node:util';
const nativeArraySpecies = Object.freeze(Object.getOwnPropertyDescriptor(Array, Symbol.species));

export async function assertUxNativeDirectorGuards() {
 const source = fs.readFileSync('tools/ux-release-phase2-native-catalog.js', 'utf8');
 const nodes = parse(source, { ecmaVersion: 'latest', sourceType: 'module' }).body.map(node => node.type === 'ExportNamedDeclaration' ? node.declaration : node);
 const functionText = name => { const node = nodes.find(node => node?.type === 'FunctionDeclaration' && node.id.name === name); assert(node); return source.slice(node.start, node.end); };
 const declarations = ['UX_NATIVE_TABLES', 'names', 'tableOf', 'uxRows', 'freeze'].map(name => {
  const node = nodes.find(node => node?.type === 'VariableDeclaration' && node.declarations.some(row => row.id.name === name)); assert(node); return source.slice(node.start, node.end);
 }).join('\n');
 const { projection, tables } = new Function('assert', 'utilTypes', 'nativeArraySpecies', declarations + '\n' + functionText('uxNativeProjection') + '\nreturn { projection: uxNativeProjection, tables: UX_NATIVE_TABLES };')(assert, utilTypes, nativeArraySpecies);
 const directorSchema = 'director_migration_' + 'a'.repeat(16), phase2Schema = 'p2_definitions_' + 'b'.repeat(32);
 const local = 'postgresql://pilot_runner@127.0.0.1:35439/omerta_check';
 const ci = 'postgresql://postgres:pgcheck@127.0.0.1:5432/omerta_check';
 const director = () => ({ argv: ['node', '/workspace/test/director-migration.js', '--postgres'], env: { COORDINATION_TEST_DATABASE_URL: local }, endpoint: local, profile: 'director', includeNotNull: false, settings: { schema: directorSchema, database: 'omerta_check', role: 'pilot_runner' } });
 const invoke = async fixture => {
  const check = new Function('assert', 'process', 'return (' + functionText('assertNativeCaller') + ')')(assert, { argv: fixture.argv, env: fixture.env });
  await check({ query: async sql => { assert.equal(sql, 'SELECT current_schema() AS schema,current_database() AS database,current_user AS role'); return { rows: [fixture.settings] }; } }, fixture.endpoint, fixture.profile, fixture.includeNotNull);
 };
 await invoke(director());
 const ciDirector = director(); ciDirector.endpoint = ci; ciDirector.env.COORDINATION_TEST_DATABASE_URL = ci; ciDirector.settings.role = 'postgres'; await invoke(ciDirector);
 const fallback = director(); delete fallback.env.COORDINATION_TEST_DATABASE_URL; fallback.env.WORLD_KERNEL_TEST_DATABASE_URL = local; await invoke(fallback);
 for (const [profile, flag, child] of [['phase2', '--definitions', 'upgrade'], ['fresh', '--lots', 'lots']]) {
  await invoke({ argv: ['node', '/workspace/test/phase2-postgres.js', flag], env: { P2_TEST_CHILD: child, P2_TEST_SCHEMA: phase2Schema }, endpoint: local, profile, includeNotNull: true, settings: { schema: phase2Schema, database: 'omerta_check', role: 'pilot_runner' } });
 }
 let refusals = 0;
 const reject = async run => { await assert.rejects(run, error => error?.code === 'ERR_ASSERTION'); refusals++; };
 for (const mutate of [
  fixture => fixture.argv.pop(), fixture => fixture.argv[2] = '--other', fixture => fixture.argv.push('--postgres'),
  fixture => fixture.argv.push('--extra'), fixture => fixture.argv[1] = '/workspace/test/unknown.js',
  fixture => fixture.profile = 'phase2', fixture => fixture.profile = 'fresh', fixture => fixture.includeNotNull = true,
  fixture => delete fixture.env.COORDINATION_TEST_DATABASE_URL,
  fixture => fixture.env.COORDINATION_TEST_DATABASE_URL = local.replace('omerta_check', 'omerta_query'),
  fixture => { fixture.env.COORDINATION_TEST_DATABASE_URL = local.replace('omerta_check', 'omerta_query'); fixture.env.WORLD_KERNEL_TEST_DATABASE_URL = local; },
  fixture => fixture.settings.schema = phase2Schema,
  fixture => fixture.settings.schema = 'director_migration_' + 'a'.repeat(15),
  fixture => fixture.settings.schema = 'director_migration_' + 'a'.repeat(17),
  fixture => fixture.settings.role = 'other', fixture => fixture.settings.database = 'other',
  fixture => fixture.endpoint = local.replace('127.0.0.1', 'remote.example'),
  fixture => fixture.endpoint = local.replace('35439', '55439'),
  fixture => fixture.endpoint = local.replace('pilot_runner', 'postgres'),
  fixture => fixture.endpoint = local.replace('omerta_check', 'production'),
  fixture => fixture.endpoint += '?options=search_path%3Dpublic', fixture => fixture.endpoint += '#other'
 ]) { const fixture = director(); mutate(fixture); await reject(() => invoke(fixture)); }
 for (const mutate of [fixture => fixture.includeNotNull = false, fixture => fixture.profile = 'director', fixture => fixture.env.P2_TEST_CHILD = 'lots', fixture => fixture.env.P2_TEST_SCHEMA = directorSchema, fixture => fixture.argv[2] = '--lots']) {
  const fixture = { argv: ['node', '/workspace/test/phase2-postgres.js', '--definitions'], env: { P2_TEST_CHILD: 'upgrade', P2_TEST_SCHEMA: phase2Schema }, endpoint: local, profile: 'phase2', includeNotNull: true, settings: { schema: phase2Schema, database: 'omerta_check', role: 'pilot_runner' } }; mutate(fixture); await reject(() => invoke(fixture));
 }
 const metadata = {
  relations: tables.map(name => ({ name, kind: 'r' })),
  columns: tables.map(table_name => ({ table_name, column_name: 'id', type: 'text', not_null: true })),
  constraints: tables.flatMap(table_name => [{ table_name, name: table_name + '_pkey', type: 'p', definition: 'PRIMARY KEY (id)' }, { table_name, name: table_name + '_id_not_null', type: 'n', definition: 'NOT NULL id' }]),
  indexes: tables.map(table_name => ({ table_name, name: table_name + '_pkey', definition: 'CREATE UNIQUE INDEX' }))
 };
 const guarded = projection(metadata), structural = metadata.constraints.filter(row => row.type !== 'n').map(({ table_name, name, definition }) => ({ table_name, name, definition })), all = metadata.constraints.map(({ table_name, name, definition }) => ({ table_name, name, definition }));
 const baseline = [{ table_name: 'accounts', name: 'accounts_pkey', definition: 'PRIMARY KEY (id)' }];
 assert.deepEqual(guarded.projectConstraints([...baseline, ...structural], false), baseline);
 assert.deepEqual(guarded.projectConstraints([...baseline, ...all], true), baseline);
 assert.deepEqual(guarded.projectConstraints([...baseline, ...all]), baseline);
 assert.throws(() => guarded.projectConstraints([...baseline, ...all], false)); refusals++;
 assert.throws(() => guarded.projectConstraints([...baseline, ...structural], true)); refusals++;
 for (const mutate of [rows => rows.splice(0, 1), rows => rows.push({ ...rows[0] }), rows => rows[0].definition += '__altered', rows => rows[0].name += '__renamed']) {
  const rows = structuredClone(structural); mutate(rows); assert.throws(() => guarded.projectConstraints([...baseline, ...rows], false)); refusals++;
 }
 for (const mutate of [value => value.constraints.splice(1, 1), value => value.columns[0].not_null = false, value => value.indexes.splice(0, 1), value => value.relations[0].kind = 'v']) {
  const changed = structuredClone(metadata); mutate(changed); assert.throws(() => guarded.projectMetadata(changed)); refusals++;
 }
 metadata.constraints[0].definition = 'tampered retained input';
 assert.throws(() => guarded.projectMetadata(metadata)); refusals++;
 console.log(JSON.stringify({ phase: 'UX_NATIVE_DIRECTOR_PROFILE_GUARDS', nativeExecution: false, postgresImportsOrConnections: 0, refusals, exactExistingCallerProfiles: ['phase2', 'fresh', 'director'], fullMetadataNotNullChecksRetained: true, priorNativeResultsTransferred: false }));
 await assertUxNativeAttestationGuards();
 await assertUxFrozenProjectionGuards();
}

async function assertUxNativeAttestationGuards() {
 const helper = 'tools/ux-release-phase2-native-catalog.js';
 const uniform = source => {
  assert.equal(typeof source, 'string'); const lf = source.replaceAll('\r\n', '\n');
  assert(!lf.includes('\r') && (source === lf || source === lf.replaceAll('\n', '\r\n')), 'Only complete uniform LF or CRLF source');
  return lf;
 };
 const current = uniform(fs.readFileSync(helper, 'utf8'));
 const currentCrlf = current.replaceAll('\n', '\r\n');
 const before = uniform(execFileSync('git', ['--no-replace-objects', 'show', 'c9c3ae5e414138206b2aaa4a243a222b781f674c:' + helper], { encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024 }));
 assert.equal(uniform(current), current); assert.equal(uniform(currentCrlf), current);
 assert.throws(() => uniform(current.replace('\n', '\r\n')));
 assert.throws(() => uniform(current.replace('\n', '\r')));
 const syntax = source => parse(source, { ecmaVersion: 'latest', sourceType: 'module' }).body.map(node => node.type === 'ExportNamedDeclaration' ? node.declaration : node);
 const text = (source, name) => { source = uniform(source); const node = syntax(source).find(node => node?.type === 'FunctionDeclaration' && node.id.name === name); assert(node); return source.slice(node.start, node.end); };
 const returned = source => { const body = text(source, 'projectedCaller'), node = syntax(body)[0].body.body.findLast(node => node.type === 'ReturnStatement'); return body.slice(node.start, node.end); };
 assert.equal(returned(current), returned(before), 'The actual returned native query proxy stays byte-identical');
 for (const name of ['assertNativeCaller', 'readCommerceReleasePhase2Metadata', 'assertUxNativeSecurity']) assert.equal(text(current, name), text(before, name));
 const original = fs.readFileSync('tools/commerce-deed-release-phase2-native-catalog.js', 'utf8');
 const readerText = text(original, 'readCommerceReleasePhase2Metadata'), reader = new Function('assert', 'return (' + readerText + ')')(assert);
 const queries = [];
 const visit = node => {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'CallExpression' && node.callee?.object?.name === 'pool' && node.callee?.property?.name === 'query') {
   const argument = node.arguments[0]; assert(argument.type === 'Literal' || argument.type === 'TemplateLiteral' && argument.expressions.length === 0);
   queries.push(argument.type === 'Literal' ? argument.value : argument.quasis[0].value.cooked);
  }
  for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') visit(value);
 };
 visit(parse(readerText, { ecmaVersion: 'latest' })); assert.equal(queries.length, 5);
 const fields = ['relations', 'constraints', 'columns', 'indexes'], full = new Map(queries.slice(1).map((sql, index) => [sql, fields[index]]));
 const narrowed = new Map(queries.slice(1, 4).map((sql, index) => {
  const where = 'WHERE n.nspname=current_schema()'; assert.equal(sql.split(where).length, 2);
  return [sql.replace(where, where + ' AND ' + (index === 0 ? 'c' : 't') + '.relname IN ($1,$2,$3,$4,$5,$6,$7)'), fields[index]];
 }));
 const declarations = ['UX_NATIVE_TABLES', 'names', 'tableOf', 'uxRows', 'freeze'].map(name => {
  const node = syntax(current).find(node => node?.type === 'VariableDeclaration' && node.declarations.some(row => row.id.name === name)); assert(node); return current.slice(node.start, node.end);
 }).join('\n');
 const create = (source, probe) => new Function('assert', 'original', 'catalogQueries', 'catalogFields', 'utilTypes', 'nativeArraySpecies', declarations + '\n' +
  ['uxNativeProjection', 'assertUxNativeSecurity', 'projectedCaller'].map(name => text(source, name)).join('\n') +
  '\nreturn { caller: projectedCaller, security: assertUxNativeSecurity, tables: UX_NATIVE_TABLES };')(assert, { readCommerceReleasePhase2Metadata: async pool => { if (probe) await probe(pool); return reader(pool); } }, queries, full, utilTypes, nativeArraySpecies);
 const actual = create(current), tables = actual.tables, names = new Set(tables), schema = 'p2_definitions_' + 'b'.repeat(32);
 const ux = {
  relations: tables.map(name => ({ name, kind: 'r' })),
  columns: tables.map(table_name => ({ table_name, column_name: 'id', type: 'text', not_null: true })),
  constraints: tables.flatMap(table_name => [{ table_name, name: table_name + '_pkey', type: 'p', definition: 'PRIMARY KEY (id)' }, { table_name, name: table_name + '_id_not_null', type: 'n', definition: 'NOT NULL id' }]),
  indexes: tables.map(table_name => ({ table_name, name: table_name + '_pkey', definition: 'CREATE UNIQUE INDEX ' + table_name + '_pkey ON $self.' + table_name + ' USING btree (id)', unique: true }))
 };
 const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }; freeze(ux);
 const security = tables.map(name => ({ name, enabled: true, forced: false, denied: true, public_revoked: true }));
 let securitySql; await actual.security({ query: async sql => { securitySql = sql; return { rows: structuredClone(security) }; } });
 const baseline = { relations: [], columns: [], constraints: [], indexes: [] };
 for (let index = 0; index < 100; index++) {
  const name = 'base_' + index;
  baseline.relations.push({ name, kind: 'r' }); baseline.columns.push({ table_name: name, column_name: 'id', type: 'text', not_null: true });
  baseline.constraints.push({ table_name: name, name: name + '_pkey', type: 'p', definition: 'PRIMARY KEY (id)' });
  baseline.indexes.push({ table_name: name, name: name + '_pkey', definition: 'CREATE UNIQUE INDEX ' + name + '_pkey ON $self.' + name + ' USING btree (id)', unique: true });
 }
 const fixture = () => {
  const state = { context: { schema, database: 'omerta_check', role: 'postgres' }, metadata: Object.fromEntries(fields.map(field => [field, structuredClone([...baseline[field], ...ux[field]])])), security: structuredClone(security), calls: [], rows: 0, before: null, other: { rows: [{ unchanged: true }] } };
  const pool = { query: async (sql, values) => {
   const field = full.get(sql) || narrowed.get(sql), kind = sql === queries[0] ? 'context' : sql === securitySql ? 'security' : field;
   if (state.before) await state.before(kind, field);
   state.calls.push({ sql, values });
   if (kind === 'context') return { rows: [structuredClone(state.context)] };
   if (kind === 'security') { assert.deepEqual(values, tables); return { rows: structuredClone(state.security) }; }
   if (!field) return state.other;
   let rows = structuredClone(state.metadata[field]);
   if (narrowed.has(sql)) { assert.deepEqual(values, tables); rows = rows.filter(row => names.has(field === 'relations' ? row.name : row.table_name)); }
   else assert.equal(values, undefined, 'Full context/index/native SQL retains its original bindings');
   if (field === 'indexes') rows = rows.map(row => ({ ...row, definition: row.definition.replaceAll(' ON $self.', ' ON ' + state.context.schema + '.') }));
   state.rows += rows.length; return { rows };
  }, connect() { assert.equal(this, pool); return state; } };
  return { pool, state };
 };
 const counts = [];
 for (const source of [before, current, currentCrlf]) {
  const fixtureState = fixture(), proxy = await create(source).caller(fixtureState.pool, ux);
  assert.equal(fixtureState.state.calls.length, 7, 'Every initial context/four-field/RLS checkpoint remains');
  counts.push(fixtureState.state.rows);
  const count = fixtureState.state.calls.length; assert.deepEqual(await reader(proxy), baseline);
  assert.equal(fixtureState.state.calls.length - count, 15, 'The context-triggered complete attestation and all four per-query RLS checks remain');
  assert.equal(proxy.connect(), fixtureState.state);
 }
 assert.deepEqual(counts, [435, 135, 135], 'Only three 100-row baseline result sets are omitted, identically for uniform LF/CRLF');
 let refusals = 0;
 const bothReject = async prepare => {
  for (const source of [before, current, currentCrlf]) {
   const fresh = fixture(), proxy = await create(source).caller(fresh.pool, ux); prepare(fresh.state);
   await assert.rejects(() => proxy.query(queries[0]), error => error?.code === 'ERR_ASSERTION'); refusals++;
  }
 };
 for (const field of fields) for (const mutate of [rows => rows.splice(100, 1), rows => rows.push({ ...rows[100] }), rows => { const key = field === 'relations' ? 'kind' : field === 'columns' ? 'type' : field === 'constraints' ? 'definition' : 'unique'; rows[100][key] = typeof rows[100][key] === 'boolean' ? !rows[100][key] : rows[100][key] + '__changed'; }]) {
  await bothReject(state => { let pending = true; state.before = (kind, currentField) => { if (pending && currentField === field) { pending = false; mutate(state.metadata[field]); } }; });
 }
 for (const property of ['enabled', 'forced', 'denied', 'public_revoked']) await bothReject(state => { state.before = kind => { if (kind === 'security') state.security[0][property] = !security[0][property]; }; });
 await bothReject(state => { let pending = true; const prior = state.metadata.columns[100].type; state.before = kind => {
  if (kind === 'context' && pending) { pending = false; state.metadata.columns[100].type = 'transient alteration'; }
  if (kind === 'security') state.metadata.columns[100].type = prior;
 }; });
 await bothReject(state => { state.before = (kind, field) => { if (field === 'indexes') state.context.schema = 'p2_definitions_' + 'c'.repeat(32); }; });
 await bothReject(state => { state.metadata.indexes[0].definition = 'CREATE INDEX bad ON wrong_schema.base_0 (id)'; });
 await bothReject(state => { state.metadata.indexes[0].definition = "CREATE INDEX bad ON $self.base_0 ((' ON $self.base_0'::text))"; });
 const probed = fixture(), values = ['same'];
 await create(current, async scoped => {
  assert.deepEqual(Object.keys(scoped), ['query'], 'The reduced reader is private and query-only');
  for (const sql of ['SELECT 1', queries[1] + ' ']) {
   const count = probed.state.calls.length; assert.equal(await scoped.query(sql, values), probed.state.other);
   assert.equal(probed.state.calls.length, count + 1); assert.equal(probed.state.calls.at(-1).sql, sql); assert.equal(probed.state.calls.at(-1).values, values);
  }
 }).caller(probed.pool, ux);
 assert.equal(probed.state.calls.filter(call => call.sql === queries[4]).length, 1, 'The complete original index SQL remains unfiltered');
 console.log(JSON.stringify({ phase: 'UX_PRIVATE_THREE_QUERY_ATTESTATION_GUARDS', nativeExecution: false, postgresImportsOrConnections: 0, refusals, acceptedPhysicalEndings: ['LF', 'CRLF'], rejectedMixedAndBareCr: 2, initialQueriesBeforeAndAfter: 7, subsequentReadQueriesBeforeAndAfter: 15, fixtureReturnedMetadataRowsBefore: counts[0], fixtureReturnedMetadataRowsAfter: counts[1], fixtureReturnedMetadataRowsAfterCrlf: counts[2], fullIndexContextAndNativeQueriesUnchanged: true, validCatalogPredicateScopeOnly: true, performanceSecondsClaim: false, priorNativeResultsTransferred: false }));
}

async function assertUxFrozenProjectionGuards() {
 const baseline = 'c727d652c11780c699164bca321c872abdb8852a', helper = 'tools/ux-release-phase2-native-catalog.js';
 const source=fs.readFileSync(helper,'utf8').replaceAll('\r\n','\n');
 const before=execFileSync('git',['--no-replace-objects','show',baseline+':'+helper],{encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024});
 const syntax=text=>parse(text,{ecmaVersion:'latest',sourceType:'module'}).body.map(node=>node.type==='ExportNamedDeclaration'?node.declaration:node);
 const originalNode=syntax(before).find(node=>node?.type==='FunctionDeclaration'&&node.id.name==='uxNativeProjection');
 const currentNode=syntax(source).find(node=>node?.type==='FunctionDeclaration'&&node.id.name==='uxNativeProjection');
 assert(originalNode && currentNode);
 const original=before.slice(originalNode.start,originalNode.end), proposed=source.slice(currentNode.start,currentNode.end);
 assert.equal(proposed.slice(proposed.indexOf('  const constraints =')),original.slice(original.indexOf('  const constraints =')),'Original constraint projection remains byte-identical');
 const declarations=['UX_NATIVE_TABLES','names','fields','tableOf','uxRows','freeze'].map(name=>{
  const node=syntax(source).find(node=>node?.type==='VariableDeclaration'&&node.declarations.some(row=>row.id.name===name));assert(node);return source.slice(node.start,node.end);
 });
 // names and fields share one declaration in actual source.
 const environment=[...new Set(declarations)].join('\n');
 const nativeArraySpecies=Object.freeze(Object.getOwnPropertyDescriptor(Array,Symbol.species));
 const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
 const factories=[original,proposed].map(text=>(reference,checks=[])=>{
  const observed=Object.assign((...args)=>assert(...args),assert);
  observed.deepEqual=(actual,expected,message)=>{if(message?.startsWith('Exact independently compiled UX '))checks.push(message);return assert.deepEqual(actual,expected,message);};
  return new Function('assert','utilTypes','nativeArraySpecies',environment+'\n'+text+'\nreturn uxNativeProjection;')(observed,utilTypes,nativeArraySpecies)(reference);
 });
 const tables=['ux_community_documents','ux_community_entries','ux_community_portrait_consents','ux_crew_notes','ux_crew_signals','ux_mentor_subjects','ux_workspaces'];
 const fields=['relations','columns','constraints','indexes'];
 const ux=freeze({relations:tables.map(name=>({name,kind:'r',persistence:'p'})),columns:tables.flatMap(table_name=>Array.from({length:8},(_,index)=>({table_name,column_name:'column_'+index,ordinal:index+1,type:'text',not_null:true}))),constraints:tables.flatMap(table_name=>Array.from({length:9},(_,index)=>({table_name,name:table_name+'_constraint_'+index,type:index?'n':'p',definition:index?'NOT NULL column_'+index:'PRIMARY KEY (column_0)',columns:['column_'+index],referenced_columns:[]}))),indexes:tables.map(table_name=>({table_name,name:table_name+'_pkey',definition:'CREATE UNIQUE INDEX '+table_name+'_pkey ON $self.'+table_name+' (column_0)',unique:true}))});
 const make=(counts=[3,4,5,3])=>Object.fromEntries(fields.map((field,at)=>{
  const baseline=Array.from({length:counts[at]},(_,index)=>field==='relations'
   ?{name:'base_'+index,kind:'r',persistence:'p'}
   :{table_name:'base_'+index,name:'base_'+index+'_'+field,type:'text',definition:'native baseline '+index});
  return [field,[...baseline,...structuredClone(ux[field])]];
 }));
 let guards=0;
 const equalRun=(build,inspect=()=>{})=>{
  const results=[];
  for(let index=0;index<2;index++){
   const checks=[],fixture=build(index),projection=factories[index](fixture.reference||ux,checks);
   results.push(inspect(projection,fixture,checks,index));
  }
  assert.deepEqual(results[1],results[0]);guards++;
 };
 equalRun(()=>({metadata:make()}),(projection,fixture)=>projection.projectMetadata(fixture.metadata));
 equalRun(()=>({metadata:freeze(make())}),(projection,fixture,checks,index)=>{
  const first=projection.projectMetadata(fixture.metadata),second=projection.projectMetadata(fixture.metadata);
  assert.equal(checks.length,index?4:8);for(const field of fields){assert.notEqual(first[field],second[field]);first[field].push({poison:true});first[field].length=0;}
  return projection.projectMetadata(fixture.metadata);
 });
 for(const field of fields)equalRun(()=>({metadata:make()}),(projection,fixture)=>{
  projection.projectMetadata(fixture.metadata);const row=fixture.metadata[field].find(row=>(row.name||row.table_name).startsWith('ux_'));
  // relation identity differs from other row identities.
  const selected=fixture.metadata[field].find(row=>tables.includes(field==='relations'?row.name:row.table_name));
  selected[field==='relations'?'kind':field==='columns'?'type':field==='constraints'?'definition':'unique']='changed';
  assert.throws(()=>projection.projectMetadata(fixture.metadata));return 'refused';
 });
 for(const field of fields)equalRun(()=>({metadata:freeze(make())}),(projection,fixture)=>{
  projection.projectMetadata(fixture.metadata);const changed={...fixture.metadata,[field]:fixture.metadata[field].slice()};
  const at=changed[field].findIndex(row=>tables.includes(field==='relations'?row.name:row.table_name));changed[field].splice(at,1);
  assert.throws(()=>projection.projectMetadata(changed));return 'refused';
 });
 equalRun(()=>{const metadata=make(),events=[];const target=metadata.columns;metadata.columns=new Proxy(target,{get(object,key,receiver){events.push(String(key));return Reflect.get(object,key,receiver);}});return{metadata,events};},(projection,fixture)=>{projection.projectMetadata(fixture.metadata);projection.projectMetadata(fixture.metadata);return fixture.events;});
 equalRun(()=>{const metadata=make(),events=[];const at=metadata.constraints.findIndex(row=>tables.includes(row.table_name));metadata.constraints[at]=new Proxy(metadata.constraints[at],{get(object,key,receiver){events.push(String(key));return Reflect.get(object,key,receiver);}});return{metadata,events};},(projection,fixture)=>{projection.projectMetadata(fixture.metadata);projection.projectMetadata(fixture.metadata);return fixture.events;});
 equalRun(()=>{const metadata=make(),events=[];const target=freeze(metadata.columns);metadata.columns=new Proxy(target,{get(object,key,receiver){events.push(String(key));return Reflect.get(object,key,receiver);}});return{metadata,events};},(projection,fixture)=>{projection.projectMetadata(fixture.metadata);projection.projectMetadata(fixture.metadata);return fixture.events;});
 equalRun(()=>{const metadata=make(),events=[];const at=metadata.constraints.findIndex(row=>tables.includes(row.table_name));const target=freeze(metadata.constraints[at]);metadata.constraints[at]=new Proxy(target,{get(object,key,receiver){events.push(String(key));return Reflect.get(object,key,receiver);}});Object.freeze(metadata.constraints);return{metadata,events};},(projection,fixture)=>{projection.projectMetadata(fixture.metadata);projection.projectMetadata(fixture.metadata);return fixture.events;});
 equalRun(()=>{const metadata=make(),events=[];for(const field of fields){const rows=freeze(metadata[field]);Object.defineProperty(metadata,field,{get(){events.push(field);return rows;},enumerable:true});}return{metadata,events};},(projection,fixture)=>{projection.projectMetadata(fixture.metadata);projection.projectMetadata(fixture.metadata);assert.deepEqual(fixture.events,[...fields,...fields,...fields,...fields]);return fixture.events;});
 equalRun(()=>{const metadata=make(),events=[],valid=freeze(metadata.relations),other=[{name:'other',kind:'r'}];let reads=0;Object.defineProperty(metadata,'relations',{get(){events.push(++reads);return reads===1?valid:other;}});return{metadata,events};},(projection,fixture)=>({result:projection.projectMetadata(fixture.metadata),events:fixture.events}));
 equalRun(()=>{const metadata=make(),events=[];const row=metadata.columns.find(row=>tables.includes(row.table_name));const identity=row.table_name;Object.defineProperty(row,'table_name',{get(){events.push('identity');return identity;},enumerable:true});Object.freeze(row);Object.freeze(metadata.columns);return{metadata,events};},(projection,fixture,checks,index)=>{projection.projectMetadata(fixture.metadata);projection.projectMetadata(fixture.metadata);assert.equal(checks.filter(item=>item.endsWith(' columns')).length,2);return fixture.events;});
 equalRun(()=>{const metadata=make(),reference=structuredClone(ux),at=metadata.columns.findIndex(row=>tables.includes(row.table_name));const nested={value:1};metadata.columns[at]={...metadata.columns[at],nested};reference.columns[0]={...reference.columns[0],nested:{value:1}};Object.freeze(metadata.columns[at]);Object.freeze(metadata.columns);return{metadata,reference,nested};},(projection,fixture)=>{projection.projectMetadata(fixture.metadata);fixture.nested.value=2;assert.throws(()=>projection.projectMetadata(fixture.metadata));return 'refused';});
 for(const extra of [()=>new Date(1),()=>new Map([['key',1]]),()=>new Set([1]),()=>new RegExp('x'),()=>new WeakMap(),()=>new WeakSet(),()=>Promise.resolve(1),()=>new Uint8Array(0),()=>new DataView(new ArrayBuffer(1)),()=>Object(1),()=>new WeakRef({}),()=>{const map=new Map();Object.setPrototypeOf(map,Object.prototype);return map;}]){
  equalRun(()=>{const metadata=make();metadata.columns[0].extra=extra();freeze(metadata);return{metadata};},(projection,fixture,checks)=>{projection.projectMetadata(fixture.metadata);projection.projectMetadata(fixture.metadata);assert.equal(checks.filter(item=>item.endsWith(' columns')).length,2);return 'not cached';});
 }
 equalRun(()=>{const metadata=make();const row=metadata.columns[0];delete row.table_name;Object.setPrototypeOf(row,{table_name:'base_0'});freeze(metadata);return{metadata};},(projection,fixture,checks)=>{projection.projectMetadata(fixture.metadata);projection.projectMetadata(fixture.metadata);assert.equal(checks.filter(item=>item.endsWith(' columns')).length,2);return 'not cached';});
 equalRun(()=>{const metadata=make();metadata.columns=freeze(metadata.relations);return{metadata};},(projection,fixture)=>{assert.throws(()=>projection.projectMetadata(fixture.metadata));return 'alias refused';});
 equalRun(()=>{const metadata=make();delete metadata.columns[0];freeze(metadata);return{metadata};},(projection,fixture,checks)=>{projection.projectMetadata(fixture.metadata);projection.projectMetadata(fixture.metadata);assert.equal(checks.filter(item=>item.endsWith(' columns')).length,2);return 'sparse fallback';});
 equalRun(()=>{const metadata=make(),events=[];metadata.columns[0].extra={get hidden(){events.push('unexpected getter');return 1;}};Object.freeze(metadata.columns[0].extra);Object.freeze(metadata.columns[0]);Object.freeze(metadata.columns);return{metadata,events};},(projection,fixture,checks)=>{projection.projectMetadata(fixture.metadata);projection.projectMetadata(fixture.metadata);assert.equal(checks.filter(item=>item.endsWith(' columns')).length,2);assert.deepEqual(fixture.events,[]);return 'nested accessor not invoked';});
 equalRun(()=>{const metadata=freeze(make());return{metadata};},(projection,fixture)=>{projection.projectMetadata(fixture.metadata);const prior=Object.getOwnPropertyDescriptor(Array.prototype,'filter');let calls=0;Object.defineProperty(Array.prototype,'filter',{...prior,value:function(callback,thisArg){calls++;return prior.value.call(this,callback,thisArg);}});try{projection.projectMetadata(fixture.metadata);assert.equal(calls,8);}finally{Object.defineProperty(Array.prototype,'filter',prior);}return 'changed intrinsic falls back';});
 for(const includeNotNull of [true,false])equalRun(()=>({rows:ux.constraints.filter(row=>includeNotNull||row.type!=='n').map(({table_name,name,definition})=>({table_name,name,definition}))}),(projection,fixture)=>projection.projectConstraints(fixture.rows,includeNotNull));
 for(const timing of ['before construction','after caching'])for(const kind of ['getter','proxy getter','data descriptor']){
  const results=[];
  for(let implementation=0;implementation<2;implementation++){
   const metadata=freeze(make()),checks=[];let calls=0,projection;
   const descriptor=kind==='data descriptor'?{value:Array,writable:true,enumerable:false,configurable:true}
    :{...nativeArraySpecies,get:kind==='getter'?function(){calls++;return Array;}:new Proxy(nativeArraySpecies.get,{apply(target,thisArg,args){calls++;return Reflect.apply(target,thisArg,args);}})};
   if(timing==='after caching'){projection=factories[implementation](ux,checks);projection.projectMetadata(metadata);}
   Object.defineProperty(Array,Symbol.species,descriptor);
   try{
    if(!projection)projection=factories[implementation](ux,checks);
    const first=projection.projectMetadata(metadata);
    if(timing==='before construction')projection.projectMetadata(metadata);
    assert.equal(checks.length,8,'Changed species must use all original field checks');
    results.push({first,calls});
   }finally{Object.defineProperty(Array,Symbol.species,nativeArraySpecies);}
  }
  assert.deepEqual(results[1],results[0]);guards++;
 }
 console.log(JSON.stringify({phase:'UX_FROZEN_PROJECTION_CACHE_GUARDS',baseline,comparisons:guards,oldAndNewBehaviorsMatch:true,twoPhaseRereads:true,freshOutputSlices:true,mutableInputsFullyChecked:true,changedSpeciesBeforeAndAfterCachingRefused:true,nativeExecution:false,postgresImportsOrConnections:0,priorNativeResultsTransferred:false}));
}
