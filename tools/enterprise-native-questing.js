// Fresh actual-current enterprise admission and execution; immutable earlier qualifiers remain intact.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  ENTERPRISE_NATIVE_PROOFS, assertEnterpriseInventory, assertEnterpriseNativeMode,
  assertEnterpriseNativeTrackedBytes, assertEnterpriseBackend, enterpriseChildEnv,
  assertEnterpriseResults, assertEnterpriseCleanup, assertEnterpriseDirectoryEntries,
} from './enterprise-native.js';
import { ENTERPRISE_NATIVE_BINARY_FILES, ENTERPRISE_NATIVE_DIRECTORY_MEMBERSHIPS } from './enterprise-native-inputs.js';
import { enterpriseUxImports, enterpriseUxMetadataBytes } from './enterprise-native-ux.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as predecessor, ENTERPRISE_NATIVE_UX_INPUTS_SHA256 as predecessorHash } from './enterprise-native-contract-release-inputs.js';
import { QUESTING_ENTERPRISE_NATIVE_INPUTS as declaration, QUESTING_ENTERPRISE_NATIVE_INPUTS_SHA256 as declarationHash } from './enterprise-native-questing-inputs.js';

export const QUESTING_NATIVE_METADATA = 'tools/enterprise-native-questing-inputs.js';
export const QUESTING_NATIVE_PREDECESSOR_METADATA = 'tools/enterprise-native-contract-release-inputs.js';
export { declaration as QUESTING_ENTERPRISE_NATIVE_INPUTS };
export const QUESTING_NATIVE_SUPPORT = Object.freeze([
  'tools/enterprise-native-questing.js', 'tools/enterprise-native-questing-seal.js',
  'test/enterprise-native-questing-guard.js', QUESTING_NATIVE_PREDECESSOR_METADATA,
  'tools/questing-enterprise-catalog.js', 'test/questing-enterprise-catalog-guard.js',
  'tools/questing-ux-release-phase2-native-catalog.js',
  'test/questing-ux-release-phase2-native-catalog-guard.js',
  'test/lib/questing-ux-native-reader-source-compatibility.js',
  'test/lib/questing-ux-director-reader-source-compatibility.js',
  'test/lib/questing-ux-enterprise-reader-source-compatibility.js',
  'src/casinorakeback.js',
  'public/ux-quests.js', 'public/ux-quests.css', 'public/ux-clues.js', 'public/ux-clues.css',
  ...['early-obituary', 'family-dinner', 'missing-name', 'three-witnesses', 'quiet-wedding',
    'morning-after', 'inherited-file', 'archive-service', 'sixth-envelope', 'rival-accord']
    .map(id => `content/packs/quest-${id}/pack.json`),
]);
const catalogProof = ENTERPRISE_NATIVE_PROOFS.find(row => row[0] === 'enterprise-release-phase2-migration-catalog');
export const QUESTING_ENTERPRISE_EXECUTION = Object.freeze([catalogProof, ...ENTERPRISE_NATIVE_PROOFS.filter(row => row !== catalogProof)]);
export function assertQuestingExecutionOrder(order = QUESTING_ENTERPRISE_EXECUTION) {
  assertEnterpriseInventory(ENTERPRISE_NATIVE_PROOFS);
  assert.ok(Array.isArray(order) && Object.isFrozen(order)); assert.equal(order.length, 16);
  assert.equal(new Set(order).size, 16); assert.strictEqual(order[0], catalogProof);
  const remaining = ENTERPRISE_NATIVE_PROOFS.filter(row => row !== catalogProof);
  for (let i = 0; i < remaining.length; i++) assert.strictEqual(order[i + 1], remaining[i], 'Same canonical tuple identities and remaining order');
  return order;
}
export function canonicalQuestingResults(rows) {
  assert.ok(Array.isArray(rows)); assert.equal(rows.length, 16, 'No missing case receipt may be synthesized');
  const positions = new Map(ENTERPRISE_NATIVE_PROOFS.map(([name], i) => [name, i]));
  assert.equal(new Set(rows.map(row => row?.file)).size, 16);
  for (const row of rows) { assert.ok(row && positions.has(row.file)); assert.equal(row.state, 'passed'); }
  return [...rows].sort((left, right) => positions.get(left.file) - positions.get(right.file));
}
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const blob = bytes => crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const git = (...args) => execFileSync('git', ['--no-optional-locks', '--no-replace-objects', ...args], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024, windowsHide: true });
const textGit = (...args) => git(...args).toString('utf8').trim();
const fields = (value, keys) => assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), 'Closed actual-current native record');
const canonicalPath = file => typeof file === 'string' && !/[\\:\0\r\n]/.test(file)
  && !path.posix.isAbsolute(file) && file.split('/').every(part => part && !['.', '..', '.git'].includes(part));
const legacyNames = predecessor.files.map(row => row.file);
const legacyPins = new Map(predecessor.files.map(row => [row.file, row]));
const binary = new Set(ENTERPRISE_NATIVE_BINARY_FILES);
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const protectedInput = file => /^tools\/[^/]*native[^/]*\.js$/.test(file)
  || /^test\/lib\/[^/]*native[^/]*\.js$/.test(file) || file === 'test/enterprise-native-guard.js';

export function questingNativeMetadataBytes(value) {
  return Buffer.from('// Actual-current native admission only; historical results never grant execution.\n'
    + "const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };\n"
    + `export const QUESTING_ENTERPRISE_NATIVE_INPUTS = freeze(${JSON.stringify(value, null, 2)});\n`
    + `export const QUESTING_ENTERPRISE_NATIVE_INPUTS_SHA256 = ${JSON.stringify(sha(JSON.stringify(value)))};\n`);
}
function pin(row) {
  assert.ok(row && Object.isFrozen(row)); fields(row, ['file', 'mode', 'blob', 'sha256']);
  assert.ok(canonicalPath(row.file)); assert.ok(['100644', '100755'].includes(row.mode));
  assert.match(row.blob, /^[a-f0-9]{40}$/); assert.match(row.sha256, /^[a-f0-9]{64}$/);
}
export function assertQuestingNativeDefinition(value) {
  fields(value, ['version', 'status', 'phase', 'authoredRevision', 'predecessorDefinitionSha256', 'proofInventorySha256', 'files', 'replacements', 'additions']);
  assert.ok(Object.isFrozen(value)); assert.equal(value.version, 1); assert.equal(value.status, 'SEALED', 'Actual-current native inputs remain UNSEALED');
  assert.equal(value.phase, 'ACTUAL_CURRENT_QUESTING_ENTERPRISE_NATIVE_INPUTS'); assert.match(value.authoredRevision, /^[a-f0-9]{40}$/);
  assert.equal(sha(JSON.stringify(predecessor)), predecessorHash, 'Immutable predecessor definition');
  assert.equal(value.predecessorDefinitionSha256, predecessorHash);
  assertEnterpriseInventory(ENTERPRISE_NATIVE_PROOFS);
  assert.equal(value.proofInventorySha256, sha(JSON.stringify(ENTERPRISE_NATIVE_PROOFS)), 'The same complete sixteen native proofs are mandatory');
  assert.ok(Object.isFrozen(value.files) && Object.isFrozen(value.replacements) && Object.isFrozen(value.additions));
  value.files.forEach(pin); assert.equal(new Set(value.files.map(row => row.file)).size, value.files.length);
  assert.deepEqual(value.files.slice(0, legacyNames.length).map(row => row.file), legacyNames, 'Complete predecessor inventory retained in order');
  assert.ok(!value.files.some(row => row.file === QUESTING_NATIVE_METADATA), 'Exactly one separately verified metadata self-reference');
  const current = new Map(value.files.map(row => [row.file, row]));
  for (const file of QUESTING_NATIVE_SUPPORT) assert.ok(current.has(file), `Required actual-current native support: ${file}`);
  for (const before of predecessor.files) if (protectedInput(before.file)) {
    assert.deepEqual(current.get(before.file), before, `Immutable historical helper/manifest: ${before.file}`);
  }
  const predecessorMetadata = current.get(QUESTING_NATIVE_PREDECESSOR_METADATA);
  assert.equal(predecessorMetadata.sha256, sha(enterpriseUxMetadataBytes(predecessor)), 'Predecessor metadata is an exact ordinary input');
  const changed = predecessor.files.filter(before => !same(before, current.get(before.file)))
    .map(before => ({ file: before.file, before, after: current.get(before.file) }));
  value.replacements.forEach(row => { assert.ok(Object.isFrozen(row)); fields(row, ['file', 'before', 'after']); pin(row.before); pin(row.after); });
  assert.deepEqual(value.replacements, changed, 'Every actual changed predecessor input has its exact before/after pin');
  const additions = value.files.slice(legacyNames.length);
  assert.deepEqual(additions.map(row => row.file), additions.map(row => row.file).sort(), 'Native additions have a closed deterministic order');
  assert.deepEqual(value.additions, additions);
  return value;
}
export function assertQuestingEnterpriseTrackedInput(file, current, authored, bytes, actualDeclaration = declaration) {
  assert.strictEqual(actualDeclaration, declaration, 'Caller cannot substitute an actual-current native declaration');
  assertQuestingNativeDefinition(declaration);
  assert.equal(sha(JSON.stringify(declaration)), declarationHash, 'Exact sealed actual-current declaration');
  const expected = declaration.files.find(row => row.file === file);
  assert.ok(expected, `No undeclared actual-current native input: ${file}`);
  assert.ok(Buffer.isBuffer(bytes) && current && authored);
  assert.equal(current.type, 'blob'); assert.equal(authored.type, 'blob');
  assert.equal(current.mode, expected.mode); assert.equal(authored.mode, expected.mode);
  assert.equal(current.blob, expected.blob, 'Actual HEAD input differs from its new native pin');
  assert.equal(authored.blob, expected.blob, 'Native pin does not identify the actual authored input');
  assert.equal(sha(bytes), expected.sha256, 'Actual native bytes differ from the new declaration');
  assert.equal(blob(bytes), expected.blob, 'Actual native Git bytes differ');
  return Object.freeze({ current: expected, predecessor: legacyPins.get(file) || null,
    predecessorRevision: predecessor.authoredRevision, authoredRevision: declaration.authoredRevision,
    nativeAdmission: false, priorResultsTransferred: false });
}
export function questingNativeClosure(read) {
  const reached = new Set([...legacyNames, ...QUESTING_NATIVE_SUPPORT]), queue = [...reached];
  for (let index = 0; index < queue.length; index++) {
    const file = queue[index]; assert.ok(canonicalPath(file));
    if (file === QUESTING_NATIVE_METADATA) continue;
    const bytes = read(file); assert.ok(Buffer.isBuffer(bytes));
    if (!/\.(?:js|mjs|cjs)$/.test(file)) continue;
    assert.ok(Buffer.from(bytes.toString('utf8')).equals(bytes), `Lossless JavaScript source: ${file}`);
    for (const dependency of enterpriseUxImports(file, bytes.toString('utf8'))) {
      if (dependency === QUESTING_NATIVE_METADATA || reached.has(dependency)) continue;
      reached.add(dependency); queue.push(dependency);
    }
  }
  reached.delete(QUESTING_NATIVE_METADATA);
  return [...legacyNames, ...[...reached].filter(file => !legacyPins.has(file)).sort()];
}
function tree(revision) {
  return git('ls-tree', '-r', '-z', revision).toString('utf8').split('\0').filter(Boolean).map(line => {
    const at = line.indexOf('\t'), [mode, type, object] = line.slice(0, at).split(' ');
    return { file: line.slice(at + 1), mode, type, blob: object, line };
  });
}
function actualReader(records) {
  const byName = new Map(records.map(row => [row.file, row])), cache = new Map();
  return file => {
    if (cache.has(file)) return cache.get(file);
    assert.ok(canonicalPath(file)); const row = byName.get(file);
    assert.ok(row && row.type === 'blob' && ['100644', '100755'].includes(row.mode), `Regular committed input required: ${file}`);
    const full = path.join(ROOT, file), stat = fs.lstatSync(full);
    assert.ok(stat.isFile() && !stat.isSymbolicLink(), `Physical regular input: ${file}`);
    const raw = fs.readFileSync(full); assert.equal(stat.size, raw.length);
    const canonical = blob(raw) === row.blob ? raw : Buffer.from(raw.toString('utf8').replaceAll('\r\n', '\n'));
    assertEnterpriseNativeTrackedBytes(raw, canonical, binary.has(file));
    assert.equal(blob(canonical), row.blob, `Physical input equals actual Git bytes: ${file}`);
    const result = { canonical, raw, pin: Object.freeze({ file, mode: row.mode, blob: row.blob, sha256: sha(canonical) }) };
    cache.set(file, result); return result;
  };
}
function cleanRevision() {
  const revision = textGit('rev-parse', 'HEAD'); assert.match(revision, /^[a-f0-9]{40}$/);
  assert.equal(textGit('status', '--porcelain', '--untracked-files=all'), '', 'Clean exact committed source required');
  return revision;
}
function directories() {
  return ENTERPRISE_NATIVE_DIRECTORY_MEMBERSHIPS.map(row => ({ directory: row.directory,
    eligibleNames: assertEnterpriseDirectoryEntries(row.directory, fs.readdirSync(path.join(ROOT, row.directory))) }));
}
export function buildQuestingNativeDefinition(revision) {
  assert.equal(cleanRevision(), revision, 'Seal only the exact current authored commit');
  git('merge-base', '--is-ancestor', predecessor.authoredRevision, revision);
  const records = tree(revision), read = actualReader(records);
  assert.ok(records.some(row => row.file === QUESTING_NATIVE_METADATA), 'Commit the initial UNSEALED declaration before generation');
  const files = questingNativeClosure(file => read(file).canonical).map(file => read(file).pin);
  const current = new Map(files.map(row => [row.file, row]));
  const value = freeze({ version: 1, status: 'SEALED', phase: 'ACTUAL_CURRENT_QUESTING_ENTERPRISE_NATIVE_INPUTS', authoredRevision: revision,
    predecessorDefinitionSha256: predecessorHash, proofInventorySha256: sha(JSON.stringify(ENTERPRISE_NATIVE_PROOFS)), files,
    replacements: predecessor.files.filter(before => !same(before, current.get(before.file))).map(before => ({ file: before.file, before, after: current.get(before.file) })),
    additions: files.slice(legacyNames.length) });
  assertQuestingNativeDefinition(value); directories(); assert.equal(cleanRevision(), revision); return value;
}
export function captureQuestingEnterpriseSource() {
  assertQuestingNativeDefinition(declaration);
  assert.equal(sha(JSON.stringify(declaration)), declarationHash, 'Only the exact imported sealed native declaration');
  const revision = cleanRevision(); git('merge-base', '--is-ancestor', declaration.authoredRevision, revision);
  const records = tree(revision), current = new Map(records.map(row => [row.file, row]));
  const authored = new Map(tree(declaration.authoredRevision).map(row => [row.file, row]));
  const read = actualReader(records), files = {};
  assert.deepEqual(questingNativeClosure(file => read(file).canonical), declaration.files.map(row => row.file), 'Complete actual current import/asset closure');
  for (const expected of declaration.files) {
    const actual = read(expected.file); assert.deepEqual(actual.pin, expected);
    const original = authored.get(expected.file);
    assertQuestingEnterpriseTrackedInput(expected.file, current.get(expected.file), original, actual.canonical);
    files[expected.file] = { sha256: sha(actual.raw), gitSha256: expected.sha256, blob: expected.blob, binary: binary.has(expected.file), bytes: actual.raw.length };
  }
  const metadata = read(QUESTING_NATIVE_METADATA), originalMetadata = authored.get(QUESTING_NATIVE_METADATA);
  assert.ok(originalMetadata && originalMetadata.type === 'blob'); assert.equal(metadata.pin.mode, originalMetadata.mode);
  assert.ok(metadata.canonical.equals(questingNativeMetadataBytes(declaration)), 'The only self-reference is exact generated data, never executable additions');
  files[QUESTING_NATIVE_METADATA] = { sha256: sha(metadata.raw), gitSha256: metadata.pin.sha256, blob: current.get(QUESTING_NATIVE_METADATA).blob, binary: false, bytes: metadata.raw.length };
  const source = { revision, authoredRevision: declaration.authoredRevision, predecessorRevision: predecessor.authoredRevision,
    declarationSha256: declarationHash, fullGitTreeSha256: sha(JSON.stringify(records.map(row => row.line).sort())),
    priorNativeResultsTransferred: false, directoryMemberships: directories(), files };
  assertQuestingEnterpriseStable(source); return source;
}
export function assertQuestingEnterpriseStable(source) {
  assert.equal(cleanRevision(), source.revision);
  for (const [file, expected] of Object.entries(source.files)) {
    const stat = fs.lstatSync(path.join(ROOT, file)); assert.ok(stat.isFile() && !stat.isSymbolicLink());
    const raw = fs.readFileSync(path.join(ROOT, file)); assert.equal(stat.size, expected.bytes); assert.equal(sha(raw), expected.sha256, `Physical native input changed: ${file}`);
  }
  assert.deepEqual(directories(), source.directoryMemberships);
}
async function backend(client) {
  return (await client.query('SELECT current_user AS role,current_database() AS database,current_setting(\'server_version\') AS version,current_setting(\'data_directory\') AS directory')).rows[0];
}
async function freshZero(pg, profile, port, url) {
  const reader = new pg.Client({ connectionString: url }), receipt = { port, at: new Date().toISOString(), readerClosed: false, complete: false };
  try {
    await reader.connect(); await reader.query('BEGIN READ ONLY'); receipt.identity = await backend(reader); assertEnterpriseBackend(receipt.identity, profile, port);
    receipt.activeNonAdminDatabaseClientSessions = (await reader.query("SELECT datname,pid,state FROM pg_stat_activity WHERE datname IS NOT NULL AND datname<>'postgres' AND backend_type='client backend' ORDER BY datname,pid")).rows;
    assert.deepEqual(receipt.activeNonAdminDatabaseClientSessions, []); await reader.query('ROLLBACK');
  } catch (error) { receipt.failure = { code: error.code || 'fresh_zero_failed', message: error.message }; }
  finally { try { await reader.end(); receipt.readerClosed = true; } catch (error) { receipt.readerCloseFailure = { message: error.message }; } }
  receipt.complete = !receipt.failure && receipt.readerClosed; return receipt;
}
async function freshDatabase(pg, url, role, database) {
  const reader = new pg.Client({ connectionString: url }), receipt = { database, clientClosed: false, complete: false };
  try {
    await reader.connect(); receipt.identity = (await reader.query('SELECT current_user AS role,current_database() AS database')).rows[0];
    assert.equal(receipt.identity.role, role); assert.equal(receipt.identity.database, database);
    for (const [key, sql] of Object.entries({
      publicRelations: "SELECT c.relname,c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,c.relkind",
      userSchemas: "SELECT nspname FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname NOT IN ('information_schema','public') ORDER BY nspname",
      publicTypes: "SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' ORDER BY t.typname",
      publicProcedures: "SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY p.proname",
    })) { receipt[key] = (await reader.query(sql)).rows; assert.deepEqual(receipt[key], []); }
  } catch (error) { receipt.failure = { code: error.code || 'fresh_database_failed', message: error.message }; }
  finally { try { await reader.end(); receipt.clientClosed = true; } catch (error) { receipt.clientCloseFailure = { message: error.message }; } }
  receipt.complete = !receipt.failure && receipt.clientClosed; return receipt;
}
export async function runQuestingEnterpriseNative() {
  const profile = assertEnterpriseNativeMode(process.argv, process.env);
  for (const key of Object.keys(process.env)) assert.ok(!/^INVENTORY_BOND_MANIFEST_(?:PATH|SHA256)$/i.test(key), `Ambient native manifest forbidden: ${key}`);
  const source = captureQuestingEnterpriseSource(), ports = profile === 'local' ? [35439, 35449] : [5432];
  const urls = profile === 'local' ? { 35439: process.env.ENTERPRISE_NATIVE_ADMIN39_DATABASE_URL, 35449: process.env.ENTERPRISE_NATIVE_ADMIN49_DATABASE_URL }
    : { 5432: process.env.ENTERPRISE_NATIVE_CI_ADMIN_DATABASE_URL };
  const folder = path.join(ROOT, `output/enterprise-native-questing-${source.revision.slice(0, 8)}-${crypto.randomBytes(4).toString('hex')}`);
  fs.mkdirSync(folder, { recursive: true });
  const result = { source, profile, ports, node: process.version, financialActivation: 'off', complete: false,
    status: 'RUNNING_FULL_SIXTEEN_NATIVE', startedAt: new Date().toISOString(), allocations: [], backend: {}, results: [], caseZeros: [], cleanup: { adminsClosed: false, freshZeros: [], complete: false } };
  const save = () => fs.writeFileSync(path.join(folder, 'results.json'), JSON.stringify(result, null, 2) + '\n'); save();
  const { default: pg } = await import('pg'); const admins = new Map(); let failure = null;
  try {
    for (const port of ports) {
      const admin = new pg.Client({ connectionString: urls[port] }); admins.set(port, admin); await admin.connect();
      result.backend[port] = await backend(admin); assertEnterpriseBackend(result.backend[port], profile, port);
      const zero = await freshZero(pg, profile, port, urls[port]); result.caseZeros.push(zero); save(); assert.ok(zero.complete, 'Initial strict fresh zero');
    }
    for (const row of assertQuestingExecutionOrder()) {
      assertQuestingEnterpriseStable(source);
      const [name, , prefix, localPort, timeout] = row, port = profile === 'local' ? localPort : 5432;
      const admin = admins.get(port), database = prefix + crypto.randomBytes(6).toString('hex'); assert.match(database, /^[a-z0-9_]{1,63}$/);
      assert.equal((await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database])).rows.length, 0); await admin.query(`CREATE DATABASE ${database}`);
      const allocation = { file: name, database, port }; result.allocations.push(allocation); save();
      allocation.owner = (await admin.query('SELECT pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname=$1', [database])).rows[0].owner;
      const role = profile === 'local' ? 'pilot_runner' : 'postgres'; assert.equal(allocation.owner, role);
      const endpoint = new URL(urls[port]); endpoint.pathname = '/' + database;
      allocation.fresh = await freshDatabase(pg, endpoint.href, role, database); save(); assert.ok(allocation.fresh.complete, 'Fresh owned database namespace');
      const logFile = path.join(folder, name + '.log'), log = fs.createWriteStream(logFile), started = Date.now(); let error = null;
      console.log(JSON.stringify({ file: name, state: 'started', source: source.revision, port, sourceSha256: source.files[`test/${name}.js`].sha256 }));
      const status = await new Promise(resolve => {
        const child = spawn(process.execPath, [`test/${name}.js`, '--postgres'], { cwd: ROOT, env: enterpriseChildEnv(process.env, row, profile, database), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout });
        child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
        child.once('error', cause => { error = cause.code || 'spawn_error'; }); child.once('close', (code, signal) => resolve({ code, signal }));
      });
      await new Promise(resolve => log.end(resolve));
      const proof = { file: name, database, port, sourceSha256: source.files[`test/${name}.js`].sha256, ...status, error,
        durationMs: Date.now() - started, state: status.code === 0 && status.signal === null && error === null ? 'passed' : 'failed', logSha256: sha(fs.readFileSync(logFile)) };
      result.results.push(proof); save();
      if (proof.state === 'failed') {
        const output = fs.readFileSync(logFile);
        console.error(JSON.stringify({ file: name, state: 'failed', logTail: output.subarray(Math.max(0, output.length - 8192)).toString('utf8') }));
      }
      assertQuestingEnterpriseStable(source);
      for (const used of ports) { const zero = await freshZero(pg, profile, used, urls[used]); result.caseZeros.push(zero); save(); assert.ok(zero.complete, 'Post-child strict fresh zero'); }
      assert.equal(proof.state, 'passed', `Failure retained; no partial qualification: ${name}`); console.log(JSON.stringify({ file: name, state: 'passed' }));
    }
    result.results = canonicalQuestingResults(result.results); save();
    assertQuestingEnterpriseStable(source); assertEnterpriseResults(result.results, source, profile);
  } catch (error) { failure = error; result.failure = { code: error.code || 'qualification_failed', message: error.message }; save(); }
  finally {
    const endings = await Promise.allSettled([...admins.values()].map(client => client.end()));
    result.cleanup.adminEndings = endings.map(row => row.status === 'fulfilled' ? { closed: true } : { closed: false, error: String(row.reason) });
    result.cleanup.adminsClosed = endings.every(row => row.status === 'fulfilled'); save();
    for (const port of ports) { result.cleanup.freshZeros.push(await freshZero(pg, profile, port, urls[port])); save(); }
    result.cleanup.complete = result.cleanup.adminsClosed && result.cleanup.freshZeros.length === ports.length && result.cleanup.freshZeros.every(row => row.complete && row.readerClosed && row.activeNonAdminDatabaseClientSessions.length === 0);
    if (!result.cleanup.complete) failure ||= new Error('Strict final zero/admin/reader closure failed'); save();
  }
  if (failure) { result.status = 'FAIL_RETAINED_NO_NATIVE_COMPLETION'; result.finishedAt = new Date().toISOString(); save(); throw failure; }
  assertQuestingEnterpriseStable(source); assertEnterpriseResults(result.results, source, profile); assertEnterpriseCleanup(result.cleanup, profile);
  result.complete = true; result.status = 'PASS_FULL_SIXTEEN_NATIVE_STRICT_FRESH_ZERO'; result.finishedAt = new Date().toISOString(); save();
  console.log(JSON.stringify({ folder, source: source.revision, complete: true, cases: 16, strictFreshZeroPorts: ports, financialActivation: 'off' }));
  return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runQuestingEnterpriseNative();
