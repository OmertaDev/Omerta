// Pure caller/profile protocol checks over actual private helper functions; no PG import or connection.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parse } from 'acorn';

export async function assertUxNativeDirectorGuards() {
 const source = fs.readFileSync('tools/ux-release-phase2-native-catalog.js', 'utf8');
 const nodes = parse(source, { ecmaVersion: 'latest', sourceType: 'module' }).body.map(node => node.type === 'ExportNamedDeclaration' ? node.declaration : node);
 const functionText = name => { const node = nodes.find(node => node?.type === 'FunctionDeclaration' && node.id.name === name); assert(node); return source.slice(node.start, node.end); };
 const declarations = ['UX_NATIVE_TABLES', 'names', 'tableOf', 'uxRows', 'freeze'].map(name => {
  const node = nodes.find(node => node?.type === 'VariableDeclaration' && node.declarations.some(row => row.id.name === name)); assert(node); return source.slice(node.start, node.end);
 }).join('\n');
 const { projection, tables } = new Function('assert', declarations + '\n' + functionText('uxNativeProjection') + '\nreturn { projection: uxNativeProjection, tables: UX_NATIVE_TABLES };')(assert);
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
 const create = (source, probe) => new Function('assert', 'original', 'catalogQueries', 'catalogFields', declarations + '\n' +
  ['uxNativeProjection', 'assertUxNativeSecurity', 'projectedCaller'].map(name => text(source, name)).join('\n') +
  '\nreturn { caller: projectedCaller, security: assertUxNativeSecurity, tables: UX_NATIVE_TABLES };')(assert, { readCommerceReleasePhase2Metadata: async pool => { if (probe) await probe(pool); return reader(pool); } }, queries, full);
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
