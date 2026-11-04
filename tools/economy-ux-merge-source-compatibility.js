import { deedAllocationHistoricalInput } from './deed-allocation-source-transfer.js';
import { economyDeedMergeHistoricalInput } from './economy-deed-merge-source-compatibility.js';
// Exact source reconstruction only. Runtime and native checks always use physical current bytes.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { ECONOMY_UX_MERGE_SOURCE, ECONOMY_UX_MERGE_SOURCE_SHA256 } from './economy-ux-merge-source-data.js';
import { saleHistoricalInput } from './sale-source-compatibility.js';
import { assertEconomyMonitorSourceTransfer, economyMonitorHistoricalInput } from './economy-monitor-source-transfer.js';
import { ageEligibilityHistoricalInput } from './age-eligibility-source-transfer.js';
import { economyBankInterestHardeningHistoricalInput } from './economy-bank-interest-source-transfer.js';
import { economySocialProofCutoverHistoricalInput } from './economy-social-proof-cutover-source-transfer.js';
import { economySocialReceiptSafetyHistoricalInput } from './economy-social-proof-receipt-safety-source-transfer.js';
import { economySocialReceiptHistoricalInput } from './economy-social-proof-receipt-source-transfer.js';

export { ECONOMY_UX_MERGE_SOURCE };
export const ECONOMY_UX_MERGE_FILES = Object.freeze([
  '.github/workflows/ci.yml',
  '.github/workflows/economy-hardening.yml',
  'package.json',
  'public/index.html',
  'schema.sql',
  'src/accrual.js',
  'src/actioncooldown.js',
  'src/db.js',
  'src/economy.js',
  'src/game.js',
  'src/growth.js',
  'src/kitchen.js',
  'src/payroll.js',
  'src/rules.tail.js',
  'src/server.js',
  'src/socialproof.js',
  'src/ux-tactics.js',
  'src/verify.js',
  'tools/commerce-deed-release-phase2-native-catalog.js',
  'tools/economy-hardening-source-transfer.js',
  'tools/economy-readiness-merge-source-compatibility.js',
  'tools/economy-release-tail-source-transfer.js',
  'tools/enterprise-native.js',
  'tools/enterprise-native-ux-seal.js',
  'tools/sim.js',
  'test/action-cooldowns.js',
  'test/agent-referral-cash.js',
  'test/classic-interface-source-compatibility.js',
  'test/client.js',
  'test/commerce-release-phase2-migration-catalog.js',
  'test/crew-wage-postgres.js',
  'test/director-migration.js',
  'test/economy-balance.js',
  'test/economy-hardening-source-compatibility.js',
  'test/enterprise-native-guard.js',
  'test/enterprise-release-phase2-migration-catalog.js',
  'test/gates.js',
  'test/growth.js',
  'test/levers.js',
  'test/lib/enterprise-ux-native-guard.js',
  'test/lib/rc1-historical-source-fixture.js',
  'test/migrate.js',
  'test/payroll.js',
  'test/phase2-postgres.js',
  'test/ux-postgres-rls.js',
  'test/ux-tactics-browser.js',
  'test/ux-tactics.js',
]);
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
const normalize = input => {
  assert.equal(typeof input, 'string', 'Complete source text required');
  assert.equal(Buffer.from(input).toString('utf8'), input, 'Lossless UTF-8 only');
  assert(!input.startsWith('\ufeff') && !input.includes('\0'), 'No BOM or NUL');
  const text = input.replaceAll('\r\n', '\n');
  assert(!text.includes('\r') && (input === text || input === text.replaceAll('\n', '\r\n')), 'Uniform whole LF/CRLF only');
  return text;
};
// Exact successor admissions for safe()/null, the private constant, CI wiring and child listeners. The
// published monitor envelope remains unchanged: only these complete physical bytes reconstruct
// their 9000f2af sources, checked by the original frozen monitor transfer before chaining.
export const ECONOMY_MONITOR_WORKER_SOURCE = Object.freeze({
  file: 'src/worker.js', sourceRevision: 'fd9ba2014cf7ceb42a7b155bf94a208f9992cfea',
  predecessorRevision: '9000f2afaf4640e018b2d4026fb7b1ff984a8257',
  currentSha256: '8461ccc60c86ccadcda3c2820a9026f8eadacebdd201355f23b09e4b646f38f9',
  currentBlob: '6e0eb2656fb6c815908ddf722a4e8a89dc75f3d2', currentBytes: 87275,
  occurrences: 1,
  current: "      const summary = await safe('economy monitor', () => runEconomyMonitor(pool, { alert: alertDrift }));\n      if (summary) console.log('[economy monitor]', JSON.stringify(summary));\n",
  baseline: "      const summary = await runEconomyMonitor(pool, { alert: alertDrift });\n      console.log('[economy monitor]', JSON.stringify(summary));\n",
});
export const ECONOMY_MONITOR_READER_SOURCE = Object.freeze({
  file: 'src/economy-monitor.js', sourceRevision: '9da329e2be042a105b78c6df089c5c88a4f8ba1f',
  predecessorRevision: '9000f2afaf4640e018b2d4026fb7b1ff984a8257',
  currentSha256: '2f08e91725b6692a9c846f1528ca099e2ace7461ed29b6d14ae663f4a923095a',
  currentBlob: 'c8fad52af8b3f1ea1d2863bbb85edd2a5e09102a', currentBytes: 16574,
  current: 'COLUMNS', baseline: 'columns', occurrences: 3,
});
export const ECONOMY_MONITOR_RELEASE_SOURCES = Object.freeze({
  '.github/workflows/economy-hardening.yml': Object.freeze({
    file: '.github/workflows/economy-hardening.yml', sourceRevision: '9a5c784034a9f543cd32e27fd0b73a23e332ee5b',
    predecessorRevision: '9000f2afaf4640e018b2d4026fb7b1ff984a8257',
    currentSha256: '1551813fbb50fb14a3bd9690e5d0d62f09b1605ea4e582612cade095514a57ad',
    currentBlob: '18d9875f1112661aa57148d7f9c7704d4958bb93', currentBytes: 5425,
    current: '          node test/age-eligibility-source-compatibility.js &&\n          node test/economy-monitor-source-compatibility.js &&\n',
    baseline: '', occurrences: 1,
  }),
  'test/gates.js': Object.freeze({
    file: 'test/gates.js', sourceRevision: '9a5c784034a9f543cd32e27fd0b73a23e332ee5b',
    predecessorRevision: '6fdc897851ef23e8c2cf691733ad944a7663242a',
    currentSha256: 'a30914836d5d503aaf0114a5634e183dfec43a0a9c1c799692e2644612d581f8',
    currentBlob: 'a0a4551b721073b1eb33780e3702cd0b8fde6813', currentBytes: 461700,
    baselineSha256: '727b8cfba27ab2b1a69dedaa43aa5d289a09d91aeb27be5f66e87d744f1f4a12',
    baselineBlob: '238e7a38313f54fd09d82df4dedb9a574f04243d', baselineBytes: 461461,
    current: "    'test/economy-composition-restart.js': 'Fresh-process child probe executed by the required native economy-composition suite; it requires an owned disposable PostgreSQL schema and bounded synthetic stdin, so it cannot run standalone.',\n",
    baseline: '', occurrences: 1,
  }),
  'test/economy-composition.js': Object.freeze({
    file: 'test/economy-composition.js', sourceRevision: 'b5155c297f9ab4d097ca4cba1e3ef86babaa449e',
    predecessorRevision: '9000f2afaf4640e018b2d4026fb7b1ff984a8257',
    currentSha256: '20d42640e5f750f6abc35d7631024a132ad56f375e48b268827fb704c55b7022',
    currentBlob: '7f8426a3f112703709e08b8a1b2546c2d72a7896', currentBytes: 21633,
    current: "  const child = spawn(process.execPath, [fileURLToPath(new URL('./economy-composition-restart.js', import.meta.url))],\n    { env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });\n  const exited = new Promise((resolve, reject) => {\n    child.once('error', reject); child.once('close', resolve);\n  });\n  let stdout = '', stderr = '';\n  const timeout = setTimeout(() => child.kill(), 90_000); timeout.unref();\n  child.stdout.on('data', chunk => { stdout += chunk; });\n  child.stderr.on('data', chunk => { stderr += chunk; });\n  child.stdin.end(JSON.stringify({ ...probe, wall }));\n  try {\n    const exitCode = await exited;\n",
    baseline: "  const child = spawn(process.execPath, [fileURLToPath(new URL('./economy-composition-restart.js', import.meta.url))],\n    { env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });\n  let stdout = '', stderr = '';\n  const timeout = setTimeout(() => child.kill(), 90_000); timeout.unref();\n  child.stdout.on('data', chunk => { stdout += chunk; });\n  child.stderr.on('data', chunk => { stderr += chunk; });\n  child.stdin.end(JSON.stringify({ ...probe, wall }));\n  try {\n    const exitCode = await new Promise((resolve, reject) => {\n      child.once('error', reject); child.once('close', resolve);\n    });\n", occurrences: 1,
  }),
  "tools/ux-release-phase2-native-catalog.js": Object.freeze({
    "file": "tools/ux-release-phase2-native-catalog.js",
    "sourceRevision": "5d364a6aa6ff1f5e90a56b056ccc7974c8e4a1f0",
    "predecessorRevision": "6fdc897851ef23e8c2cf691733ad944a7663242a",
    "currentSha256": "fccef92e9a633a8edad3fe543a47bcd9e852d88cbb354b1f19330a0940d26e9a",
    "currentBlob": "03f00b1d21988ff978d8196c8429ef21ba8c5360",
    "currentBytes": 25797,
    "baselineSha256": "4c122b2439ef19868259a0b6dbc7cb29d4539c6098ef7e5289703c32d1687fd9",
    "baselineBlob": "38dc31de8b9d30cdfd359b6bf8f5cfa02ad1925e",
    "baselineBytes": 22713,
    "contextLines": 3,
    inverses: Object.freeze([
  {
    "current": "  ? row.table_name === socialBridgeTable && socialExtensionColumns.has(row.column_name)\n  : field === 'constraints' && row.table_name === socialBridgeTable && row.name === socialBridgeConstraint;\nconst socialBridgeRows = (metadata, field) => metadata[field].filter(row => isSocialBridgeRow(field, row));\nconst monitorIndexName = 'ix_tx_at_id';\nconst isMonitorIndexRow = (field, row) => field === 'indexes' && row.table_name === 'transactions' && row.name === monitorIndexName;\nconst monitorRows = (metadata, field) => metadata[field].filter(row => isMonitorIndexRow(field, row));\nconst freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };\n// Keep the original engine's exact predecessor order; insert the existing-table bridge at its exact\n// catalog anchors, then retain the reviewed UX append order. No collation normalization is introduced.\nconst merge = (base, socialBridge, ux, monitor) => {\n  const merged = Object.fromEntries(fields.map(field => [field, [...base[field]]]));\n  assert.equal(socialBridge.columns.length, 2); assert(socialBridge.constraints.length <= 1);\n  assert.deepEqual(socialBridge.columns.map(row => row.column_name),\n",
    "baseline": "  ? row.table_name === socialBridgeTable && socialExtensionColumns.has(row.column_name)\n  : field === 'constraints' && row.table_name === socialBridgeTable && row.name === socialBridgeConstraint;\nconst socialBridgeRows = (metadata, field) => metadata[field].filter(row => isSocialBridgeRow(field, row));\nconst freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };\n// Keep the original engine's exact predecessor order; insert the existing-table bridge at its exact\n// catalog anchors, then retain the reviewed UX append order. No collation normalization is introduced.\nconst merge = (base, socialBridge, ux) => {\n  const merged = Object.fromEntries(fields.map(field => [field, [...base[field]]]));\n  assert.equal(socialBridge.columns.length, 2); assert(socialBridge.constraints.length <= 1);\n  assert.deepEqual(socialBridge.columns.map(row => row.column_name),\n"
  },
  {
    "current": "    merged.constraints.splice(constraintAt, 0, ...socialBridge.constraints);\n  }\n  for (const field of fields) merged[field].push(...ux[field]);\n  const indexAt = merged.indexes.findIndex(row => row.table_name === 'transactions' && row.name === 'ix_tx_character');\n  assert(indexAt >= 0, 'The monitor index precedes the exact predecessor transaction index');\n  merged.indexes.splice(indexAt, 0, ...monitor.indexes);\n  return freeze(merged);\n};\n\n",
    "baseline": "    merged.constraints.splice(constraintAt, 0, ...socialBridge.constraints);\n  }\n  for (const field of fields) merged[field].push(...ux[field]);\n  return freeze(merged);\n};\n\n"
  },
  {
    "current": "  }\n  assert.equal(settings.role, address.username); assert.equal('/' + settings.database, address.pathname);\n}\nasync function projectedCaller(pool, ux, socialBridge, monitor) {\n  const uxProjection = uxNativeProjection(ux), socialBridgeProjection = socialLegacyBridgeProjection(socialBridge),\n    monitorProjection = monitorNativeProjection(monitor);\n  const projectMetadata = metadata => monitorProjection.projectMetadata(socialBridgeProjection.projectMetadata(uxProjection.projectMetadata(metadata)));\n  const context = (await pool.query(catalogQueries[0])).rows[0];\n  const verify = async () => { projectMetadata(await original.readCommerceReleasePhase2Metadata(pool)); await assertUxNativeSecurity(pool); };\n  await verify();\n",
    "baseline": "  }\n  assert.equal(settings.role, address.username); assert.equal('/' + settings.database, address.pathname);\n}\nasync function projectedCaller(pool, ux, socialBridge) {\n  const uxProjection = uxNativeProjection(ux), socialBridgeProjection = socialLegacyBridgeProjection(socialBridge);\n  const projectMetadata = metadata => socialBridgeProjection.projectMetadata(uxProjection.projectMetadata(metadata));\n  const context = (await pool.query(catalogQueries[0])).rows[0];\n  const verify = async () => { projectMetadata(await original.readCommerceReleasePhase2Metadata(pool)); await assertUxNativeSecurity(pool); };\n  await verify();\n"
  },
  {
    "current": "    assert.deepEqual(selected, ux[field], 'Every fresh projected SQL result retains the complete UX ' + field);\n    assert.deepEqual(socialBridgeRows({ [field]: result.rows }, field), socialBridge[field],\n      'Every fresh projected SQL result retains the exact social bridge ' + field);\n    const monitorSelected = monitorRows({ [field]: result.rows }, field).map(row => {\n      const prefix = ' ON ' + context.schema + '.'; assert.equal(row.definition.split(prefix).length, 2);\n      return { ...row, definition: row.definition.replace(prefix, ' ON $self.') };\n    });\n    assert.deepEqual(monitorSelected, monitor[field], 'Every fresh projected SQL result retains the exact monitor ' + field);\n    if (guarded) await assertUxNativeSecurity(pool);\n    return { ...result, rows: result.rows.filter(row => !names.has(tableOf(field, row)) && !isSocialBridgeRow(field, row) && !isMonitorIndexRow(field, row)) };\n  } });\n  return { ...wrap(pool, true), connect: async () => {\n    const client = await pool.connect();\n",
    "baseline": "    assert.deepEqual(selected, ux[field], 'Every fresh projected SQL result retains the complete UX ' + field);\n    assert.deepEqual(socialBridgeRows({ [field]: result.rows }, field), socialBridge[field],\n      'Every fresh projected SQL result retains the exact social bridge ' + field);\n    if (guarded) await assertUxNativeSecurity(pool);\n    return { ...result, rows: result.rows.filter(row => !names.has(tableOf(field, row)) && !isSocialBridgeRow(field, row)) };\n  } });\n  return { ...wrap(pool, true), connect: async () => {\n    const client = await pool.connect();\n"
  },
  {
    "current": "    const settings = (await client.query('SELECT current_schema() AS schema,current_database() AS database,current_user AS role')).rows[0];\n    const parent = (await pool.query('SELECT current_database() AS database,current_user AS role')).rows[0];\n    assert.equal(settings.schema, schema); assert.equal(settings.database, parent.database); assert.equal(settings.role, parent.role);\n    // Compile the monitor index independently of schema.sql and the migrated caller. Only this\n    // exact additive index is projected from the unchanged predecessor's complete catalog proof.\n    await client.query(socialBridgeDdl + '\\n' + uxDdl + '\\nCREATE TABLE transactions (at TIMESTAMPTZ, id TEXT);\\nCREATE INDEX ix_tx_at_id ON transactions (at, id);');\n    const reference = await original.readCommerceReleasePhase2Metadata(client);\n    assert.deepEqual(reference.relations.map(row => row.name), [socialBridgeTable, 'transactions', ...UX_NATIVE_TABLES],\n      'Independent immutable DDL creates exactly the social bridge, monitor fixture and seven UX tables');\n    const ux = Object.fromEntries(fields.map(field => [field, uxRows(reference, field)]));\n    assert.deepEqual(ux.relations.map(row => row.name), UX_NATIVE_TABLES, 'Independent immutable DDL creates exactly the seven UX tables');\n    const socialBridge = Object.fromEntries(fields.map(field => [field, socialBridgeRows(reference, field)]));\n",
    "baseline": "    const settings = (await client.query('SELECT current_schema() AS schema,current_database() AS database,current_user AS role')).rows[0];\n    const parent = (await pool.query('SELECT current_database() AS database,current_user AS role')).rows[0];\n    assert.equal(settings.schema, schema); assert.equal(settings.database, parent.database); assert.equal(settings.role, parent.role);\n    await client.query(socialBridgeDdl + '\\n' + uxDdl);\n    const reference = await original.readCommerceReleasePhase2Metadata(client);\n    assert.deepEqual(reference.relations.map(row => row.name), [socialBridgeTable, ...UX_NATIVE_TABLES],\n      'Independent immutable DDL creates exactly the social bridge fixture and seven UX tables');\n    const ux = Object.fromEntries(fields.map(field => [field, uxRows(reference, field)]));\n    assert.deepEqual(ux.relations.map(row => row.name), UX_NATIVE_TABLES, 'Independent immutable DDL creates exactly the seven UX tables');\n    const socialBridge = Object.fromEntries(fields.map(field => [field, socialBridgeRows(reference, field)]));\n"
  },
  {
    "current": "      referenced_schema: null, referenced_table: null, columns: [socialBridgeColumn], referenced_columns: [] }],\n    'PostgreSQL 18 exposes the exact generated social bridge NOT NULL catalog row');\n    assert.equal(socialBridge.relations.length + socialBridge.indexes.length, 0, 'The social bridge adds no relation or index');\n    const monitor = Object.fromEntries(fields.map(field => [field, monitorRows(reference, field)]));\n    assert.deepEqual(monitor.indexes, [{ table_name: 'transactions', name: monitorIndexName,\n      definition: 'CREATE INDEX ix_tx_at_id ON $self.transactions USING btree (at, id)',\n      unique: false, primary: false, valid: true, ready: true, live: true, nulls_not_distinct: false, predicate: null }],\n    'Independent fixed DDL compiles the exact complete monitor index catalog row');\n    return freeze({ ux, socialBridge, monitor });\n  } finally {\n    await client?.end();\n    if (created) {\n",
    "baseline": "      referenced_schema: null, referenced_table: null, columns: [socialBridgeColumn], referenced_columns: [] }],\n    'PostgreSQL 18 exposes the exact generated social bridge NOT NULL catalog row');\n    assert.equal(socialBridge.relations.length + socialBridge.indexes.length, 0, 'The social bridge adds no relation or index');\n    return freeze({ ux, socialBridge });\n  } finally {\n    await client?.end();\n    if (created) {\n"
  },
  {
    "current": "  };\n  return Object.freeze({ projectMetadata, projectConstraints });\n}\nexport function monitorNativeProjection(reference) {\n  reference = freeze(structuredClone(reference));\n  assert.equal(reference.relations.length + reference.columns.length + reference.constraints.length, 0);\n  assert.equal(reference.indexes.length, 1);\n  assert(isMonitorIndexRow('indexes', reference.indexes[0]));\n  const projectMetadata = metadata => {\n    for (const field of fields) assert.deepEqual(monitorRows(metadata, field), reference[field],\n      'Exact independently compiled monitor ' + field);\n    return Object.fromEntries(fields.map(field => [field, metadata[field].filter(row => !isMonitorIndexRow(field, row))]));\n  };\n  return Object.freeze({ projectMetadata });\n}\nfunction extendCatalog(prior, ux, socialBridge, monitor, branches = false) {\n  const uxProjection = uxNativeProjection(ux), socialBridgeProjection = socialLegacyBridgeProjection(socialBridge),\n    monitorProjection = monitorNativeProjection(monitor),\n    projectMetadata = metadata => monitorProjection.projectMetadata(socialBridgeProjection.projectMetadata(uxProjection.projectMetadata(metadata))),\n    base = branches ? prior.current : prior.reference, reference = merge(base, socialBridge, ux, monitor);\n  const verifyMetadata = metadata => (branches ? prior.verify : prior.verifyMetadata)(projectMetadata(metadata));\n  verifyMetadata(reference);\n  const causal = { socialBridge: 0, socialProofContract: 0, ux: 0, monitor: 0 };\n  assert.throws(() => { reference.columns.push({}); }, TypeError);\n  for (const [label, extension, makeProjection] of [\n    ['socialBridge', socialBridge, socialLegacyBridgeProjection], ['ux', ux, uxNativeProjection],\n    ['monitor', monitor, monitorNativeProjection],\n  ]) {\n    const field = fields.find(field => extension[field].length), key = Object.keys(extension[field][0])[0];\n    assert.throws(() => { extension[field][0][key] = 'tampered'; }, TypeError);\n    const retained = structuredClone(extension), independent = makeProjection(retained);\n    retained[field][0][key] = 'tampered';\n    const integrated = merge(base, label === 'socialBridge' ? retained : socialBridge,\n      label === 'ux' ? retained : ux, label === 'monitor' ? retained : monitor);\n    assert.throws(() => independent.projectMetadata(integrated), error => error?.code === 'ERR_ASSERTION'); causal[label]++;\n  }\n  verifyMetadata(reference);\n  for (const [label, extension] of [['socialBridge', socialBridge], ['ux', ux], ['monitor', monitor]]) {\n    for (const field of fields) for (const row of extension[field]) {\n      const causalLabel = label === 'socialBridge' && field === 'columns'\n        && row.column_name === socialProofContractColumn ? 'socialProofContract' : label;\n",
    "baseline": "  };\n  return Object.freeze({ projectMetadata, projectConstraints });\n}\nfunction extendCatalog(prior, ux, socialBridge, branches = false) {\n  const uxProjection = uxNativeProjection(ux), socialBridgeProjection = socialLegacyBridgeProjection(socialBridge),\n    projectMetadata = metadata => socialBridgeProjection.projectMetadata(uxProjection.projectMetadata(metadata)),\n    base = branches ? prior.current : prior.reference, reference = merge(base, socialBridge, ux);\n  const verifyMetadata = metadata => (branches ? prior.verify : prior.verifyMetadata)(projectMetadata(metadata));\n  verifyMetadata(reference);\n  const causal = { socialBridge: 0, socialProofContract: 0, ux: 0 };\n  assert.throws(() => { reference.columns.push({}); }, TypeError);\n  for (const [label, extension, makeProjection] of [\n    ['socialBridge', socialBridge, socialLegacyBridgeProjection], ['ux', ux, uxNativeProjection],\n  ]) {\n    assert.throws(() => { extension.columns[0].type = 'tampered'; }, TypeError);\n    const retained = structuredClone(extension), independent = makeProjection(retained);\n    retained.columns[0].type = 'tampered';\n    const integrated = label === 'socialBridge' ? merge(base, retained, ux) : merge(base, socialBridge, retained);\n    assert.throws(() => independent.projectMetadata(integrated), error => error?.code === 'ERR_ASSERTION'); causal[label]++;\n  }\n  verifyMetadata(reference);\n  for (const [label, extension] of [['socialBridge', socialBridge], ['ux', ux]]) {\n    for (const field of fields) for (const row of extension[field]) {\n      const causalLabel = label === 'socialBridge' && field === 'columns'\n        && row.column_name === socialProofContractColumn ? 'socialProofContract' : label;\n"
  },
  {
    "current": "    'Proof-contract missing, duplicate and every-field mutations are all refused');\n  const common = { ...prior, reference, verifyMetadata, socialBridgeReference: socialBridge,\n    socialBridgeCausal: causal.socialBridge, socialProofContractCausal: causal.socialProofContract,\n    uxReference: ux, uxSource: UX_SOURCE.revision, uxCausal: causal.ux,\n    monitorReference: monitor, monitorCausal: causal.monitor };\n  if (branches) return Object.freeze({ ...common, current: reference, verify: verifyMetadata });\n  return Object.freeze({ ...common, normalize: rows => prior.normalize(socialBridgeProjection.projectConstraints(\n    uxProjection.projectConstraints(rows, prior.includeNotNull), prior.includeNotNull)) });\n",
    "baseline": "    'Proof-contract missing, duplicate and every-field mutations are all refused');\n  const common = { ...prior, reference, verifyMetadata, socialBridgeReference: socialBridge,\n    socialBridgeCausal: causal.socialBridge, socialProofContractCausal: causal.socialProofContract,\n    uxReference: ux, uxSource: UX_SOURCE.revision, uxCausal: causal.ux };\n  if (branches) return Object.freeze({ ...common, current: reference, verify: verifyMetadata });\n  return Object.freeze({ ...common, normalize: rows => prior.normalize(socialBridgeProjection.projectConstraints(\n    uxProjection.projectConstraints(rows, prior.includeNotNull), prior.includeNotNull)) });\n"
  },
  {
    "current": "export async function createCommerceReleasePhase2MigrationCatalog(pool, endpoint, input, options) {\n  const { candidate } = integratedSchemaSources(input);\n  await assertNativeCaller(pool, endpoint, options?.legacyProfile, options?.includeNotNull);\n  const { ux, socialBridge, monitor } = await compileCurrentExtensionReference(pool, endpoint);\n  const prior = await original.createCommerceReleasePhase2MigrationCatalog(\n    await projectedCaller(pool, ux, socialBridge, monitor), endpoint, candidate, options);\n  return extendCatalog(prior, ux, socialBridge, monitor);\n}\nexport async function verifyCommerceNativeBranches(pool, endpoint) {\n  await assertNativeCaller(pool, endpoint, 'fresh', true);\n  const { candidate } = integratedSchemaSources(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));\n  const { ux, socialBridge, monitor } = await compileCurrentExtensionReference(pool, endpoint);\n  const prior = await original.verifyCommerceNativeBranches(\n    await projectedCaller(pool, ux, socialBridge, monitor), endpoint, candidate);\n  return extendCatalog(prior, ux, socialBridge, monitor, true);\n}\n",
    "baseline": "export async function createCommerceReleasePhase2MigrationCatalog(pool, endpoint, input, options) {\n  const { candidate } = integratedSchemaSources(input);\n  await assertNativeCaller(pool, endpoint, options?.legacyProfile, options?.includeNotNull);\n  const { ux, socialBridge } = await compileCurrentExtensionReference(pool, endpoint);\n  const prior = await original.createCommerceReleasePhase2MigrationCatalog(\n    await projectedCaller(pool, ux, socialBridge), endpoint, candidate, options);\n  return extendCatalog(prior, ux, socialBridge);\n}\nexport async function verifyCommerceNativeBranches(pool, endpoint) {\n  await assertNativeCaller(pool, endpoint, 'fresh', true);\n  const { candidate } = integratedSchemaSources(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));\n  const { ux, socialBridge } = await compileCurrentExtensionReference(pool, endpoint);\n  const prior = await original.verifyCommerceNativeBranches(\n    await projectedCaller(pool, ux, socialBridge), endpoint, candidate);\n  return extendCatalog(prior, ux, socialBridge, true);\n}\n"
  }
].map(Object.freeze)),
  }),
  "tools/pgquery.js": Object.freeze({
    "file": "tools/pgquery.js",
    "sourceRevision": "29d6861f44bf281182ea55880d4262aaa4cfb8d1",
    "predecessorRevision": "6fdc897851ef23e8c2cf691733ad944a7663242a",
    "currentSha256": "0676e31ece6b2412bef8b3a5f3e4e8cba35f149d822488dcf1cd0620a2bcead9",
    "currentBlob": "60d7d486af4104d12304ed3871ef7e3d391461d0",
    "currentBytes": 41576,
    "baselineSha256": "ed8d93ce2c634c861af924270ea77b26ab77d3e5e34a3d7cb24e84d06540d311",
    "baselineBlob": "db503b17b08439bcbd36aacc4deae0b8a1907c53",
    "baselineBytes": 35419,
    "contextLines": 3,
    inverses: Object.freeze([
  {
    "current": "  return variants;\n}\n\n// The monitor's private readRows dispatcher has exactly two closed callers; its daily SELECT\n// interpolates only one fixed column list. Pin the complete caller authority and scanner corpus,\n// then capture the actual exported monitor at both row-limit extremes and UTC boundaries. None of\n// these three statements needs an unchecked-query allowance: dates, sources and limits stay bound.\nasync function modelEconomyMonitorQueries(rows, dynamicSites) {\n  const rel = 'src/economy-monitor.js';\n  const sourcePin = '2f08e91725b6692a9c846f1528ca099e2ace7461ed29b6d14ae663f4a923095a';\n  const verifySource = raw => {\n    const lf = canonicalSql(raw);\n    if (lf.includes('\\r') || (raw !== lf && raw !== lf.replaceAll('\\n', '\\r\\n'))\n        || createHash('sha256').update(lf).digest('hex') !== sourcePin)\n      throw new Error('economy monitor source changed; review its complete closed SQL model');\n  };\n  const source = readFileSync(path.join(ROOT, rel), 'utf8');\n  verifySource(source);\n  let mutationRejected = false;\n  try { verifySource(source + ' '); }\n  catch (error) {\n    if (!error.message.includes('source changed')) throw error;\n    mutationRejected = true;\n  }\n  if (!mutationRejected) throw new Error('economy monitor SQL model accepted mutated source');\n\n  const checkpoint = \"SELECT props FROM telemetry WHERE event='economy_monitor' ORDER BY at DESC,id DESC LIMIT 1\";\n  const insert = 'INSERT INTO telemetry (id,event,props,at) VALUES ($1,$2,$3,$4)';\n  const dailyTemplate = `SELECT  FROM transactions t LEFT JOIN characters c ON c.id=t.character_id\n      WHERE t.at >= $1 AND t.at <= $2 AND t.currency=$3 AND t.reason=$4\n      ORDER BY t.at DESC,t.id DESC LIMIT $5`;\n  const expectedReadable = [[rel, checkpoint, []], [rel, dailyTemplate, ['COLUMNS']], [rel, insert, []]];\n  const monitorRows = rows.filter(row => row.rel === rel);\n  if (JSON.stringify(monitorRows.map(scannerSignature))\n      !== JSON.stringify(expectedReadable.map(([rel, sql, parts]) => scannerSignature({ rel, sql, parts }))))\n    throw new Error('economy monitor readable SQL call sites changed');\n  const helperSites = dynamicSites.filter(row => row.rel === rel);\n  if (helperSites.length !== 1 || helperSites[0].where !== rel + ':139')\n    throw new Error('economy monitor private SQL dispatcher changed');\n  const dailyRow = monitorRows[1], helper = helperSites[0];\n  const shapes = new Map(['recent', 'daily', 'bounds'].map(name => [name, new Set()]));\n  const { runEconomyMonitor } = await import('../src/economy-monitor.js');\n  for (const rowLimit of [1, 50000]) for (const instant of ['2026-10-31T23:59:59.999Z', '2026-11-01T00:00:00.000Z']) {\n    const now = new Date(instant), calls = [];\n    const client = { query: async (sql, params) => {\n      if (typeof sql !== 'string') throw new Error('economy monitor model captured non-string SQL');\n      calls.push(sql);\n      if (sql === checkpoint) {\n        if (params !== undefined) throw new Error('economy monitor checkpoint acquired unmodeled parameters');\n        return { rows: [] };\n      }\n      if (sql === insert) {\n        if (!Array.isArray(params) || params.length !== 4 || params[1] !== 'economy_monitor'\n            || +params[3] !== +now)\n          throw new Error('economy monitor summary INSERT changed its bound values');\n        return { rows: [] };\n      }\n      const kind = sql.includes('FROM transactions t')\n        ? (sql.includes('t.currency=$3 AND t.reason=$4') ? 'daily' : 'recent')\n        : sql.includes(\"event='economy_payout_bound'\") ? 'bounds' : null;\n      if (!kind) throw new Error('economy monitor model captured an unknown dispatcher query');\n      const count = kind === 'daily' ? 5 : 3;\n      const placeholders = [...sql.matchAll(/\\$(\\d+)/g)].map(match => Number(match[1]));\n      if (!Array.isArray(params) || params.length !== count || placeholders.length !== count\n          || placeholders.some((placeholder, index) => placeholder !== index + 1)\n          || !(params[0] instanceof Date) || +params[1] !== +now || params.at(-1) !== rowLimit + 1)\n        throw new Error('economy monitor model did not retain dates and limit as separate bound values');\n      if (kind === 'daily' && (!['cash', 'omr'].includes(params[2]) || typeof params[3] !== 'string'))\n        throw new Error('economy monitor daily source values are not bound');\n      shapes.get(kind).add(sql);\n      return { rows: [] };\n    } };\n    const summary = await runEconomyMonitor(client, { now, rowLimit, ledgerRowsWarn: 1000,\n      netCashWarn: 10000000, netOmrWarn: 1000 });\n    if (!summary.ok || calls.length !== summary.dailySources.length + 4\n        || calls[0] !== checkpoint || calls.at(-1) !== insert)\n      throw new Error('economy monitor model did not execute its complete closed query path');\n  }\n  if ([...shapes.values()].some(set => set.size !== 1))\n    throw new Error('economy monitor dates or row limits changed a closed SQL shape');\n  return { variants: new Map([[dailyRow, [...shapes.get('daily')]]]),\n    helper, helperSql: [...shapes.get('recent'), ...shapes.get('bounds')] };\n}\n\nlet modeledQueries;\nlet monitorModel;\ntry {\n  modeledQueries = await modelSocialReceiptQueries(readable);\n  monitorModel = await modelEconomyMonitorQueries(readable, unreadableSites);\n  for (const [site, sql] of monitorModel.variants) modeledQueries.set(site, sql);\n} catch (error) {\n  console.error('pgquery refused bounded runtime query model: ' + error.message);\n  process.exit(1);\n}\nlet modeledSites = 0, modeledVariants = 0;\n",
    "baseline": "  return variants;\n}\n\nlet modeledQueries;\ntry {\n  modeledQueries = await modelSocialReceiptQueries(readable);\n} catch (error) {\n  console.error('pgquery refused bounded social-receipt query model: ' + error.message);\n  process.exit(1);\n}\nlet modeledSites = 0, modeledVariants = 0;\n"
  },
  {
    "current": "  if (!DML.test(got.sql)) { skipped.push(got.where); continue; }\n  stmts.push({ where: got.where, sql: got.sql });\n}\nif (modeledSites !== 8 || modeledVariants !== 3012) {\n  console.error(`pgquery bounded interpolated models classified ${modeledSites} sites/${modeledVariants} variants (expected 8/3012)`);\n  process.exit(1);\n}\nconst monitorHelperIndex = unreadable.indexOf(monitorModel.helper.where);\nif (monitorHelperIndex < 0 || monitorModel.helperSql.length !== 2)\n  throw new Error('economy monitor modeled dispatcher is not in the unchecked corpus exactly once');\nunreadable.splice(monitorHelperIndex, 1);\nfor (let i = 0; i < monitorModel.helperSql.length; i++)\n  stmts.push({ where: `${monitorModel.helper.where} [closed dispatcher ${i + 1}/2]`, sql: monitorModel.helperSql[i] });\n\n// These four Commerce sites stay counted/listed as UNPREPARED. Whole-source pins close the\n// caller/column authority: a 23-column INSERT with bound values; the forward/undo UPDATE over\n",
    "baseline": "  if (!DML.test(got.sql)) { skipped.push(got.where); continue; }\n  stmts.push({ where: got.where, sql: got.sql });\n}\nif (modeledSites !== 7 || modeledVariants !== 3011) {\n  console.error(`pgquery bounded social-receipt model classified ${modeledSites} sites/${modeledVariants} variants (expected 7/3011)`);\n  process.exit(1);\n}\n\n// These four Commerce sites stay counted/listed as UNPREPARED. Whole-source pins close the\n// caller/column authority: a 23-column INSERT with bound values; the forward/undo UPDATE over\n"
  },
  {
    "current": "// ── 3. REPORT ────────────────────────────────────────────────────────────────────────────────────\nconsole.log(`\\npgquery — ${stmts.length} static/bounded statements prepared against real Postgres`);\nconsole.log(`  ${modeledVariants} generated variants from ${modeledSites} interpolated sites were materialized and prepared`);\nconsole.log('  2 closed SELECT shapes from the economy monitor non-literal dispatcher were captured and prepared');\nconsole.log(`  ${interpolated.length} interpolated (cannot be prepared — counted, never silently passed; PGQUERY_LIST=1 to list)`);\nconsole.log(`  ${skipped.length} non-DML (DDL / transaction control — not preparable by design)`);\nconsole.log(`  ${unreadable.length} call sites whose argument is not a literal (a variable or a helper)\\n`);\n",
    "baseline": "// ── 3. REPORT ────────────────────────────────────────────────────────────────────────────────────\nconsole.log(`\\npgquery — ${stmts.length} static/bounded statements prepared against real Postgres`);\nconsole.log(`  ${modeledVariants} generated variants from ${modeledSites} interpolated sites were materialized and prepared`);\nconsole.log(`  ${interpolated.length} interpolated (cannot be prepared — counted, never silently passed; PGQUERY_LIST=1 to list)`);\nconsole.log(`  ${skipped.length} non-DML (DDL / transaction control — not preparable by design)`);\nconsole.log(`  ${unreadable.length} call sites whose argument is not a literal (a variable or a helper)\\n`);\n"
  },
  {
    "current": "// bounded model above invokes their real runtime generators, materializes every admitted cardinality\n// and closed branch (3,011 statements), and PREPAREs each one. Exact scanner signatures and runtime\n// cap assertions fail closed on drift; the pre-R6 measured interpolated corpus therefore remains 172.\n// Economy monitoring adds one fixed-column interpolation and a two-caller private dispatcher. The\n// pinned runtime model above captures and PREPAREs all three shapes instead of consuming new\n// unchecked-query room. Its one non-literal dispatcher is removed only after that complete model\n// succeeds; the 44-site non-literal ceiling is unchanged.\nconst CEILING = { interpolated: 173, unreadable: 44 };\nconst overflow = [];\nif (interpolated.length > CEILING.interpolated)\n",
    "baseline": "// bounded model above invokes their real runtime generators, materializes every admitted cardinality\n// and closed branch (3,011 statements), and PREPAREs each one. Exact scanner signatures and runtime\n// cap assertions fail closed on drift; the pre-R6 measured interpolated corpus therefore remains 172.\nconst CEILING = { interpolated: 173, unreadable: 44 };\nconst overflow = [];\nif (interpolated.length > CEILING.interpolated)\n"
  }
].map(Object.freeze)),
  }),

});
function assertMonitorSuccessor(file, input, pin) {
  assert.equal(file, pin.file, 'Only the exact named economy-monitor successor');
  const current = normalize(input);
  assert.equal(sha(current), pin.currentSha256, 'Whole economy-monitor successor changed');
  assert.equal(blob(current), pin.currentBlob); assert.equal(Buffer.byteLength(current), pin.currentBytes);
  let baselineText = current;
  if (pin.inverses) {
    assert(Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));
    let end = -1;
    for (const inverse of pin.inverses) {
      assert.deepEqual(Object.keys(inverse).sort(), ['baseline', 'current']);
      assert(inverse.current.length && typeof inverse.baseline === 'string');
      assert.equal(current.split(inverse.current).length, 2, 'Unique complete release correction hunk');
      const at = current.indexOf(inverse.current); assert(at >= end, 'Ordered nonoverlapping release correction hunks');
      end = at + inverse.current.length;
      assert.equal(baselineText.split(inverse.current).length, 2);
      baselineText = baselineText.replace(inverse.current, () => inverse.baseline);
    }
  } else {
    assert.equal(current.split(pin.current).length, pin.occurrences + 1, 'Exact bounded economy-monitor successor replacements');
    baselineText = current.replaceAll(pin.current, () => pin.baseline);
  }
  if (pin.baselineSha256) {
    assert.equal(sha(baselineText), pin.baselineSha256); assert.equal(blob(baselineText), pin.baselineBlob);
    assert.equal(Buffer.byteLength(baselineText), pin.baselineBytes);
  } else assertEconomyMonitorSourceTransfer(file, baselineText);
  return Object.freeze({ file, baselineText, sourceRevision: pin.sourceRevision, predecessorRevision: pin.predecessorRevision,
    sourceOnly: true, native: false, runtime: false });
}
export function assertEconomyMonitorWorkerSource(file, input) {
  return assertMonitorSuccessor(file, input, ECONOMY_MONITOR_WORKER_SOURCE);
}
export function assertEconomyMonitorReaderSource(file, input) {
  return assertMonitorSuccessor(file, input, ECONOMY_MONITOR_READER_SOURCE);
}
function monitorSuccessorHistoricalInput(file, input, pin) {
  if (file !== pin.file) return input;
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'lossless UTF-8 physical successor source required');
  let current;
  try { current = normalize(text); } catch { return input; }
  if (sha(current) !== pin.currentSha256) return input;
  const restored = assertMonitorSuccessor(file, text, pin).baselineText;
  return buffer ? Buffer.from(restored) : restored;
}
export function economyMonitorWorkerHistoricalInput(file, input) {
  return monitorSuccessorHistoricalInput(file, input, ECONOMY_MONITOR_WORKER_SOURCE);
}
export function economyMonitorReaderHistoricalInput(file, input) {
  return monitorSuccessorHistoricalInput(file, input, ECONOMY_MONITOR_READER_SOURCE);
}
export function assertEconomyMonitorReleaseSource(file, input) {
  assert(Object.hasOwn(ECONOMY_MONITOR_RELEASE_SOURCES, file), 'Only the five exact economy-monitor CI/test/tool source domains');
  return assertMonitorSuccessor(file, input, ECONOMY_MONITOR_RELEASE_SOURCES[file]);
}
export function economyMonitorReleaseHistoricalInput(file, input) {
  if (!Object.hasOwn(ECONOMY_MONITOR_RELEASE_SOURCES, file)) return input;
  return monitorSuccessorHistoricalInput(file, input, ECONOMY_MONITOR_RELEASE_SOURCES[file]);
}
const assertPin = pin => {
  assert.equal(pin, ECONOMY_UX_MERGE_SOURCE, 'Only the exact frozen economy+UX merge binding');
  assert.equal(sha(JSON.stringify(pin)), ECONOMY_UX_MERGE_SOURCE_SHA256);
  assert.equal(pin.version, 1); assert.equal(pin.status, 'SEALED');
  assert.equal(pin.phase, 'EXACT_ECONOMY_UX_MERGE_SOURCE_ONLY'); assert.equal(pin.contextLines, 3);
  assert.deepEqual(pin.files.map(row => row.file), ECONOMY_UX_MERGE_FILES);
  for (const value of [pin.sourceRevision, pin.sourceTree, pin.mergeRevision, pin.mergeTree,
    pin.candidateParentRevision, pin.candidateParentTree, pin.mainParentRevision, pin.mainParentTree])
    assert.match(value, /^[a-f0-9]{40}$/);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.files) && pin.files.every(Object.isFrozen));
};
export function qualifyEconomyUxMergeSource(file, input, target, pin = ECONOMY_UX_MERGE_SOURCE) {
  assertPin(pin); assert(['candidate', 'main'].includes(target), 'Closed merge parent');
  const row = pin.files.find(item => item.file === file); assert(row, 'Unknown economy+UX merge source');
  const current = normalize(input), parent = row[target];
  assert(Object.isFrozen(parent));
  assert.equal(sha(current), row.currentSha256, `Whole integrated source changed: ${file}`);
  assert.equal(blob(current), row.currentBlob); assert.equal(Buffer.byteLength(current), row.currentBytes);
  if (parent.absent) return Object.freeze({
    baselineText: null, predecessorAbsent: true, sourceRevision: pin.sourceRevision,
    targetRevision: target === 'candidate' ? pin.candidateParentRevision : pin.mainParentRevision,
    target, sourceOnly: true, native: false, runtime: false,
  });
  assert.equal(parent.absent, false); assert(Object.isFrozen(parent.inverses) && parent.inverses.every(Object.isFrozen));
  let restored = current; let end = -1;
  for (const inverse of parent.inverses) {
    assert.deepEqual(Object.keys(inverse).sort(), ['baseline', 'current']);
    assert.equal(typeof inverse.current, 'string'); assert.equal(typeof inverse.baseline, 'string'); assert(inverse.current.length);
    assert.equal(current.split(inverse.current).length, 2, `Unique complete integrated hunk: ${file}`);
    const at = current.indexOf(inverse.current); assert(at >= end, `Ordered nonoverlapping integrated hunks: ${file}`); end = at + inverse.current.length;
    assert.equal(restored.split(inverse.current).length, 2); restored = restored.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(sha(restored), parent.sha256, `Complete ${target} parent changed: ${file}`);
  assert.equal(blob(restored), parent.blob); assert.equal(Buffer.byteLength(restored), parent.bytes);
  return Object.freeze({
    baselineText: restored, sourceRevision: pin.sourceRevision,
    targetRevision: target === 'candidate' ? pin.candidateParentRevision : pin.mainParentRevision,
    target, sourceOnly: true, native: false, runtime: false,
  });
}
function historicalInput(file, input, target) {
  const row = ECONOMY_UX_MERGE_SOURCE.files.find(item => item.file === file); if (!row) return input;
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'Lossless UTF-8 physical source only; lossless UTF-8 required');
  if (typeof text !== 'string' || sha(text.replaceAll('\r\n', '\n')) !== row.currentSha256) return input;
  if (row[target].absent) return input;
  const restored = qualifyEconomyUxMergeSource(file, text, target).baselineText;
  return buffer ? Buffer.from(restored) : restored;
}
export function economyUxMergeCandidateHistoricalInput(file, input) {
  input = economyDeedMergeHistoricalInput(file, input, 'monitor');
  input = deedAllocationHistoricalInput(file, input);
  input = ageEligibilityHistoricalInput(file, input);
  input = economyMonitorWorkerHistoricalInput(file, input);
  input = economyMonitorReaderHistoricalInput(file, input);
  input = economyMonitorReleaseHistoricalInput(file, input);
  input = economyMonitorHistoricalInput(file, input);
  input = economyBankInterestHardeningHistoricalInput(file, input);
  input = economySocialProofCutoverHistoricalInput(file, input);
  input = economySocialReceiptSafetyHistoricalInput(file, input);
  input = economySocialReceiptHistoricalInput(file, input);
  input = saleHistoricalInput(file, input);
  return historicalInput(file, input, 'candidate');
}
export function economyUxMergeMainHistoricalInput(file, input) {
  input = economyDeedMergeHistoricalInput(file, input, 'monitor');
  input = deedAllocationHistoricalInput(file, input);
  input = ageEligibilityHistoricalInput(file, input);
  input = economyMonitorWorkerHistoricalInput(file, input);
  input = economyMonitorReaderHistoricalInput(file, input);
  input = economyMonitorReleaseHistoricalInput(file, input);
  input = economyMonitorHistoricalInput(file, input);
  input = economyBankInterestHardeningHistoricalInput(file, input);
  input = economySocialProofCutoverHistoricalInput(file, input);
  input = economySocialReceiptSafetyHistoricalInput(file, input);
  input = economySocialReceiptHistoricalInput(file, input);
  input = saleHistoricalInput(file, input);
  return historicalInput(file, input, 'main');
}
