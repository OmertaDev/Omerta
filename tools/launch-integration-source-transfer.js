// Finite source binding only; historical runtime, native and financial results never transfer.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { LAUNCH_INTEGRATION_SOURCE as source, LAUNCH_INTEGRATION_SOURCE_SHA256 } from './launch-integration-source-data.js';
import { NATIVE_GARAGE_SOURCE } from './native-garage-source-data.js';
import { CRIME_MINIGAME_SOURCE } from './crime-minigame-source-data.js';

export { source as LAUNCH_INTEGRATION_SOURCE };
export const LAUNCH_INTEGRATION_PREDECESSOR = '83baa47c51c00ec16ac982aa751ee0c1cb6e00c7';
export const LAUNCH_INTEGRATION_REVIEWED_REVISION = '5c662b9c1f42785af9765fb81be3aff4803fbcd6';
export const LAUNCH_INTEGRATION_REVIEWED_PRODUCT_PATHS = Object.freeze([
  'package.json', 'public/index.html', 'public/ux-navigation.css', 'src/preflight.js',
]);
export const LAUNCH_INTEGRATION_AUTHORED_PATHS = Object.freeze([
  'test/grand-strategy-source-transfer.js', 'test/launch-integration-source-transfer.js',
  'test/crime-minigame-source-transfer.js', 'test/native-garage-source-transfer.js',
  'test/launch-enterprise-source-transfer.js', 'tools/enterprise-native-questing.js',
  'tools/launch-enterprise-source-data.js', 'tools/native-garage-enterprise-source.js',
  'tools/crime-minigame-source-compatibility.js', 'tools/launch-integration-source-data.js',
  'tools/launch-integration-source-transfer.js', 'tools/native-garage-source-transfer.js',
]);
const generated = Object.freeze([
  'knowledge/generated/graph.json', 'knowledge/generated/graph-summary.md',
  'knowledge/generated/github-history.md', 'knowledge/generated/inventory.md',
  'knowledge/generated/modules.md', 'knowledge/generated/routes.md', 'knowledge/generated/documents.md',
  'knowledge/generated/graph.mmd', 'knowledge/generated/schema.md',
]);
const metadata = 'tools/launch-integration-source-data.js';
const projectedPaths = Object.freeze([...LAUNCH_INTEGRATION_REVIEWED_PRODUCT_PATHS,
  'test/grand-strategy-source-transfer.js', 'test/crime-minigame-source-transfer.js',
  'test/native-garage-source-transfer.js', 'tools/crime-minigame-source-compatibility.js',
  'tools/native-garage-source-transfer.js', 'tools/enterprise-native-questing.js',
  'tools/native-garage-enterprise-source.js'].sort());
const addedPaths = Object.freeze(['test/launch-enterprise-source-transfer.js', 'test/launch-integration-source-transfer.js',
  'tools/launch-enterprise-source-data.js', 'tools/launch-integration-source-transfer.js']);
const predecessorCache = new Map();
const oldSeals = Object.freeze(['tools/age-removal-source-data.js', 'tools/ui-trim-source-data.js',
  'tools/grand-strategy-source-data.js', 'tools/native-garage-source-data.js', 'tools/crime-minigame-source-data.js']);
const postPaths = new Set([...LAUNCH_INTEGRATION_AUTHORED_PATHS, ...generated]);
const readActualPhysical = fs.readFileSync.bind(fs);
const sha = value => createHash('sha256').update(value).digest('hex');
const blob = value => createHash('sha1').update('blob ' + Buffer.byteLength(value) + '\0').update(value).digest('hex');
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
const entry = (file, pin, kind) => kind === 'tree' ? pin.mode + ' blob ' + pin.blob + '\t' + file : pin.mode + ' ' + pin.blob + ' 0\t' + file;
const flags = Object.freeze({ sourceOnly: true, runtime: false, native: false, migration: false,
  financial: false, activation: false, deployment: false, priorResultsTransferred: false });
const modified = file => typeof file === 'string' && Object.hasOwn(source.files || {}, file);
const pinFor = file => source.files?.[file]?.current || source.additions?.[file];
function canonical(input) {
  const buffer = Buffer.isBuffer(input), text = buffer ? Buffer.prototype.toString.call(input, 'utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'Lossless UTF-8 source required');
  if (typeof text !== 'string' || /[\0\ufeff]/.test(text)) return null;
  const lf = text.replaceAll('\r\n', '\n');
  if (lf.includes('\r') || (text !== lf && text !== lf.replaceAll('\n', '\r\n'))) return null;
  return { buffer, lf };
}
function fingerprint(bytes, pin) {
  assert.equal(Buffer.byteLength(bytes), pin.bytes, 'Whole integration source length');
  assert.equal(sha(bytes), pin.sha256, 'Whole integration source SHA256');
  assert.equal(blob(bytes), pin.blob, 'Whole integration source Git blob');
}
function genuine(file, pin) {
  const head = git('ls-tree', 'HEAD', '--', file).trim(), index = git('ls-files', '--stage', '--', file).trim();
  assert.equal(head, entry(file, pin, 'tree'), 'Genuine current HEAD must equal exact integration source');
  assert.equal(index, entry(file, pin, 'index'), 'Genuine stage-zero index must equal exact integration source');
  const stat = fs.lstatSync(file); assert(stat.isFile() && !stat.isSymbolicLink(), 'Regular non-symbolic physical source required');
  const descriptor = fs.openSync(file, 'r'); let physical;
  try { physical = readActualPhysical(descriptor); } finally { fs.closeSync(descriptor); }
  const committed = execFileSync('git', ['--no-replace-objects', 'show', 'HEAD:' + file], { windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  fingerprint(committed, pin); const current = canonical(committed);
  assert(current && !committed.includes(13), 'Canonical committed LF UTF-8 source');
  assert(physical.equals(committed) || physical.equals(Buffer.from(current.lf.replaceAll('\n', '\r\n'))), 'Physical source must equal whole genuine HEAD in LF or uniform CRLF');
  return { head: { mode: pin.mode, blob: pin.blob }, index, committed, physical, regular: true, symbolic: false };
}
export function launchIntegrationSourceDataBytes(value) {
  return '// Exact launch integration source binding only; no runtime or release results transfer.\n'
    + 'const freeze = value => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };\n'
    + 'export const LAUNCH_INTEGRATION_SOURCE = freeze(' + JSON.stringify(value, null, 2) + ');\n'
    + "export const LAUNCH_INTEGRATION_SOURCE_SHA256 = '" + sha(JSON.stringify(value)) + "';\n";
}
function definition() {
  assert.equal(source.status, 'SEALED', 'Unsealed integration source never qualifies');
  assert.equal(source.phase, 'EXACT_LAUNCH_INTEGRATION_SOURCE_BINDING_ONLY');
  assert.equal(source.predecessor, LAUNCH_INTEGRATION_PREDECESSOR);
  assert.equal(source.revision, LAUNCH_INTEGRATION_REVIEWED_REVISION);
  assert.equal(sha(JSON.stringify(source)), LAUNCH_INTEGRATION_SOURCE_SHA256);
  assert(Object.isFrozen(source) && Object.isFrozen(source.files) && Object.isFrozen(source.additions));
  assert.deepEqual(Object.keys(source.files).sort(), projectedPaths, 'Exactly eleven reviewed predecessor projection domains');
  assert.deepEqual(Object.keys(source.additions).sort(), addedPaths, 'Exactly four new qualification helper/test domains');
  const rendered = launchIntegrationSourceDataBytes(source);
  genuine(metadata, { mode: '100644', blob: blob(rendered), sha256: sha(rendered), bytes: Buffer.byteLength(rendered) });
}
function predecessorBytes(file) {
  const row = source.files[file];
  if (!row) {
    assert(Object.hasOwn(source.additions, file), 'Only finite reviewed source domains');
    assert.equal(git('ls-tree', source.predecessor, '--', file).trim(), '', 'New source domain must be absent at the fixed predecessor');
    return null;
  }
  const key = file + '\0' + JSON.stringify(row.baseline);
  // Git objects at the fixed predecessor are immutable; no current/index/physical admission is cached.
  if (!predecessorCache.has(key)) {
    assert.equal(git('ls-tree', source.predecessor, '--', file).trim(), entry(file, row.baseline, 'tree'), 'Baseline must equal the actual fixed predecessor mode/blob');
    const before = execFileSync('git', ['--no-replace-objects', 'show', source.predecessor + ':' + file], { windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
    fingerprint(before, row.baseline);predecessorCache.set(key, before);
  }
  return predecessorCache.get(key);
}
export function assertLaunchIntegrationPostCandidatePaths(paths) {
  assert(Array.isArray(paths) && paths.every(file => typeof file === 'string'));
  assert.equal(new Set(paths).size, paths.length, 'Duplicate postcandidate path');
  assert(paths.every(file => postPaths.has(file)), 'Only fixed independently generated domains or the exact sealed integration helper/test paths may follow the reviewed anchor');
}
function checkDirtySourcePaths(dirty) {
  for (const file of dirty) {
    if (generated.includes(file)) continue;
    const pin = pinFor(file);
    if (pin) { genuine(file, pin); continue; }
    if (file === metadata) {
      const rendered = launchIntegrationSourceDataBytes(source);
      genuine(file, { mode: '100644', blob: blob(rendered), sha256: sha(rendered), bytes: Buffer.byteLength(rendered) });
      continue;
    }
    assert(false, 'Physical source/index contains unreviewed integration or disjoint changes');
  }
}
function context() {
  // Reject unknown descendants before touching physical metadata in Git-only rejection fixtures.
  // Passing this literal-path fence grants nothing; all real source admission follows below.
  assertLaunchIntegrationPostCandidatePaths(git('diff', '--name-only', '--no-renames', '-z', LAUNCH_INTEGRATION_REVIEWED_REVISION, 'HEAD').split('\0').filter(Boolean));
  definition();
  for (const [revision, tree] of [[source.predecessor, source.predecessorTree], [source.revision, source.tree]])
    assert.equal(git('rev-parse', revision + '^{tree}').trim(), tree, 'Exact reviewed source tree binding');
  git('merge-base', '--is-ancestor', source.predecessor, source.revision);git('merge-base', '--is-ancestor', source.revision, 'HEAD');
  assertLaunchIntegrationPostCandidatePaths(git('diff', '--name-only', '--no-renames', '-z', source.revision, 'HEAD').split('\0').filter(Boolean));
  const dirty = [...git('diff', '--name-only', '-z').split('\0'), ...git('diff', '--cached', '--name-only', '-z').split('\0'), ...git('ls-files', '--others', '--exclude-standard', '-z').split('\0')].filter(Boolean);
  checkDirtySourcePaths(dirty);
}
export function assertLaunchIntegrationCurrentSource() {
  assert.equal(arguments.length, 0); context();
  const changed = git('diff', '--name-only', '--no-renames', '-z', source.predecessor, source.revision).split('\0').filter(Boolean);
  assert.deepEqual(changed, Object.keys(source.candidateEntries), 'Finite integration source path set, not blanket HEAD approval');
  for (const [file, pin] of Object.entries(source.candidateEntries))
    assert.equal(git('ls-tree', source.revision, '--', file).trim(), pin === null ? '' : entry(file, pin, 'tree'), 'Exact integration candidate path/blob/mode binding');
  for (const file of oldSeals) {
    const before = execFileSync('git', ['--no-replace-objects', 'show', source.predecessor + ':' + file], { windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
    genuine(file, { mode: '100644', blob: blob(before), sha256: sha(before), bytes: before.length });
  }
  const protectedFiles = [...new Set([...Object.keys(NATIVE_GARAGE_SOURCE.files), ...Object.keys(NATIVE_GARAGE_SOURCE.additions), ...Object.keys(CRIME_MINIGAME_SOURCE.files), ...Object.keys(CRIME_MINIGAME_SOURCE.additions)])].sort();
  assert.deepEqual(source.protectedFiles, protectedFiles, 'Exactly the existing native/crime protected union');
  const changedProtected = changed.filter(file => protectedFiles.includes(file));
  assert.deepEqual(source.reviewedProtectedChanges, changedProtected, 'Only explicitly reviewed protected integration inputs');
  assert.deepEqual(source.reviewedProductChanges, LAUNCH_INTEGRATION_REVIEWED_PRODUCT_PATHS);
  for (const file of LAUNCH_INTEGRATION_REVIEWED_PRODUCT_PATHS) {
    assert(modified(file), 'Reviewed product source must have an exact inverse');
    assert.equal(entry(file, source.files[file].current, 'tree'), git('ls-tree', source.revision, '--', file).trim(), 'Product source is bound to the reviewed anchor');
  }
  for (const file of changedProtected) {
    assert(modified(file), 'Protected integration change must have an exact inverse');
    assert.equal(entry(file, source.files[file].current, 'tree'), git('ls-tree', source.revision, '--', file).trim(), 'Reviewed product bytes remain anchored');
  }
  for (const file of [...Object.keys(source.files), ...Object.keys(source.additions)]) launchIntegrationActual(file);
  return Object.freeze({ sourceRevision: source.revision, predecessorRevision: source.predecessor, files: Object.freeze([...Object.keys(source.files), ...Object.keys(source.additions)]), treePinsAreSecurityReview: false, ...flags });
}
export function launchIntegrationActual(file) {
  context(); const pin = pinFor(file); assert(pin, 'Only finite exact reviewed integration source domains');predecessorBytes(file);return genuine(file, pin);
}
function baseline(file, input) {
  const current = canonical(input); assert(current, 'Uniform complete LF/CRLF source required'); const row = source.files[file]; fingerprint(current.lf, row.current);
  let restored = current.lf, end = restored.length;
  for (const inverse of row.inverses.toReversed()) {
    assert(Number.isSafeInteger(inverse.at) && inverse.at >= 0 && inverse.at + inverse.current.length <= end, 'Exact nonoverlapping integration inverse');
    assert.equal(restored.slice(inverse.at, inverse.at + inverse.current.length), inverse.current);
    restored = restored.slice(0, inverse.at) + inverse.baseline + restored.slice(inverse.at + inverse.current.length); end = inverse.at;
  }
  fingerprint(restored, row.baseline);assert(Buffer.from(restored).equals(predecessorBytes(file)), 'Projection must reconstruct the actual fixed predecessor bytes');return restored;
}
export function qualifyLaunchIntegrationSource(file, input) {
  assert.equal(arguments.length, 2); assert(modified(file), 'Only exact modified integration source has a predecessor'); launchIntegrationActual(file);
  return Object.freeze({ file, baselineText: baseline(file, input), sourceRevision: source.revision, predecessorRevision: source.predecessor, ...flags });
}
export function launchIntegrationHistoricalInput(file, input) {
  if (!modified(file)) return input; launchIntegrationActual(file); const current = canonical(input);
  if (!current || sha(current.lf) !== source.files[file].current.sha256) return input;
  const restored = baseline(file, input); return current.buffer ? Buffer.from(restored) : restored;
}
export function launchIntegrationHistoricalEntry(file, input, kind) {
  assert(kind === 'tree' || kind === 'index'); if (!modified(file)) return input; launchIntegrationActual(file);
  const expected = entry(file, source.files[file].current, kind); if (input !== expected && input !== expected + '\n') return input;
  return entry(file, source.files[file].baseline, kind) + (input.endsWith('\n') ? '\n' : '');
}
export function launchIntegrationHistoricalRecord(file, actual) {
  assert.equal(arguments.length, 2); if (!modified(file)) return actual; const genuineRecord = launchIntegrationActual(file), row = source.files[file];
  assert.deepEqual(Object.keys(actual || {}).sort(), ['head', 'index', 'committed', 'physical', 'regular', 'symbolic'].sort(), 'Complete genuine source tuple only');
  assert(actual.head && Object.getPrototypeOf(actual.head) === Object.prototype);assert.deepEqual(Object.keys(actual.head).sort(), ['blob', 'mode']);
  assert(Buffer.isBuffer(actual.committed) && Buffer.isBuffer(actual.physical));assert.equal(actual.regular, true);assert.equal(actual.symbolic, false);
  const restored = Buffer.from(baseline(file, genuineRecord.committed)), prior = { head: { mode: row.baseline.mode, blob: row.baseline.blob }, index: entry(file, row.baseline, 'index'), committed: restored, physical: restored, regular: true, symbolic: false };
  if (actual.head.blob === row.baseline.blob) { const physical = canonical(actual.physical);assert(physical && physical.lf === restored.toString('utf8'));assert.deepEqual({ ...actual, physical: restored }, prior, 'Historical tuple stays exact and receives no new authority');return actual; }
  if (actual.head.blob !== row.current.blob) return actual;
  assert.deepEqual(actual.head, genuineRecord.head);assert.equal(actual.index, genuineRecord.index, 'Supplied index must equal genuine stage-zero source');assert(actual.committed.equals(genuineRecord.committed), 'Supplied committed source must equal genuine HEAD');
  const physical = canonical(actual.physical);assert(physical && physical.lf === genuineRecord.committed.toString('utf8'), 'Supplied physical source must equal genuine HEAD');return prior;
}
