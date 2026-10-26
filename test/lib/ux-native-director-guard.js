// Pure caller/profile protocol checks over actual private helper functions; no PG import or connection.
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
 const director = () => ({ argv: ['node', '/workspace/test/director-migration.js'], env: { COORDINATION_TEST_DATABASE_URL: local }, endpoint: local, profile: 'director', includeNotNull: false, settings: { schema: directorSchema, database: 'omerta_check', role: 'pilot_runner' } });
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
}
