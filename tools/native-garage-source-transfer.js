// Exact native garage successor comparison only. Runtime/native execution uses actual source.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { NATIVE_GARAGE_SOURCE, NATIVE_GARAGE_SOURCE_SHA256 } from './native-garage-source-data.js';

export { NATIVE_GARAGE_SOURCE };
export const NATIVE_GARAGE_PREDECESSOR = '9cf7ced8beedd0950018a14bbab71b08b71a3d5b';
export const NATIVE_GARAGE_GENERATED_FILES = Object.freeze([
  'tools/native-garage-source-data.js',
  'knowledge/generated/graph.json', 'knowledge/generated/graph-summary.md',
  'knowledge/generated/github-history.md', 'knowledge/generated/inventory.md',
  'knowledge/generated/modules.md', 'knowledge/generated/routes.md', 'knowledge/generated/documents.md',
]);
export const NATIVE_GARAGE_SCOPE = Object.freeze([
  ".github/workflows/ci.yml",
  "SPEC.md",
  "docs/quest-quality-workgraph.json",
  "docs/questing-workgraph.json",
  "docs/reviews/2026-11-15-native-garage-ui/LOCAL-REVIEW.md",
  "docs/reviews/2026-11-15-native-garage-ui/MANIFEST.json",
  "docs/reviews/2026-11-15-native-garage-ui/MANIFEST.sha256",
  "docs/reviews/2026-11-15-native-garage-ui/REVIEW.md",
  "docs/reviews/2026-11-15-native-garage-ui/evidence/checks-summary.json",
  "docs/reviews/2026-11-15-native-garage-ui/evidence/client.log",
  "docs/reviews/2026-11-15-native-garage-ui/evidence/current-copy.log",
  "docs/reviews/2026-11-15-native-garage-ui/evidence/desktop.png",
  "docs/reviews/2026-11-15-native-garage-ui/evidence/gates.log",
  "docs/reviews/2026-11-15-native-garage-ui/evidence/mobile.png",
  "docs/reviews/2026-11-15-native-garage-ui/evidence/nativegarage-browser.log",
  "docs/reviews/2026-11-15-native-garage-ui/evidence/nativegarage-client.log",
  "docs/reviews/2026-11-15-native-garage-ui/evidence/nativegarage.log",
  "docs/reviews/2026-11-15-native-garage-ui/evidence/original-source-pins.json",
  "docs/reviews/2026-11-15-native-garage-ui/evidence/preflight.log",
  "docs/reviews/2026-11-15-native-garage-ui/evidence/real-chain-browser.exit",
  "docs/reviews/2026-11-15-native-garage-ui/evidence/real-chain-browser.json",
  "docs/reviews/2026-11-15-native-garage-ui/evidence/real-chain-browser.log",
  "docs/reviews/2026-11-15-native-garage-ui/evidence/routes.log",
  "docs/reviews/2026-11-15-native-garage-ui/evidence/security-xss.png",
  "docs/reviews/2026-11-15-native-garage-ui/evidence/site-basics.log",
  "docs/reviews/2026-11-15-native-garage-ui/evidence/source-pins.json",
  "docs/reviews/2026-11-15-native-garage-ui/evidence/sql-scope.json",
  "docs/reviews/2026-11-15-native-garage-ui/evidence/worldgraph.log",
  "public/index.html",
  "public/nativegarage-client.js",
  "public/nativegarage.css",
  "public/nativegarage.js",
  "public/noir-shell.js",
  "public/strategy-command.js",
  "public/ux-identity.js",
  "public/ux-navigation.js",
  "public/ux-progression.js",
  "src/game.js",
  "src/nativegarage.js",
  "src/server.js",
  "test/gates.js",
  "test/grand-strategy-source-transfer.js",
  "test/native-garage-enterprise-source.js",
  "test/native-garage-source-transfer.js",
  "test/nativegarage-browser.js",
  "test/nativegarage-client.js",
  "test/nativegarage.js",
  "test/task-puzzle-native-integration-guard.js",
  "tools/enterprise-native-questing.js",
  "tools/grand-strategy-source-transfer.js",
  "tools/native-garage-enterprise-source.js",
  "tools/native-garage-source-seal.js",
  "tools/native-garage-source-transfer.js"
]);
const source = NATIVE_GARAGE_SOURCE;
const sha = value => createHash('sha256').update(value).digest('hex');
const blob = value => createHash('sha1').update('blob ' + Buffer.byteLength(value) + '\0').update(value).digest('hex');
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], {
  encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024,
});
const modified = file => typeof file === 'string' && Object.hasOwn(source.files || {}, file);
const pinFor = file => source.files?.[file]?.current || source.additions?.[file];
const entry = (file, pin, kind) => kind === 'tree' ? pin.mode + ' blob ' + pin.blob + '\t' + file
  : pin.mode + ' ' + pin.blob + ' 0\t' + file;
const flags = Object.freeze({ sourceOnly: true, runtime: false, native: false, migration: false,
  financial: false, activation: false, deployment: false, priorResultsTransferred: false });
function canonical(input) {
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'Lossless UTF-8 source required; lossless UTF-8 required');
  if (typeof text !== 'string' || /[\0\ufeff]/.test(text)) return null;
  const lf = text.replaceAll('\r\n', '\n');
  if (lf.includes('\r') || (text !== lf && text !== lf.replaceAll('\n', '\r\n'))) return null;
  return { buffer, lf };
}
function fingerprint(input, pin) {
  assert.equal(Buffer.byteLength(input), pin.bytes, 'Whole native successor source length');
  assert.equal(sha(input), pin.sha256, 'Whole native successor SHA256');
  assert.equal(blob(input), pin.blob, 'Whole native successor Git blob');
}
function definition() {
  assert.equal(source.status, 'SEALED', 'Native garage successor must be explicitly sealed');
  assert.equal(source.phase, 'EXACT_NATIVE_GARAGE_SOURCE_COMPARISON_ONLY');
  assert.equal(source.predecessor, NATIVE_GARAGE_PREDECESSOR);
  assert.equal(sha(JSON.stringify(source)), NATIVE_GARAGE_SOURCE_SHA256);
  assert(Object.isFrozen(source) && Object.isFrozen(source.files) && Object.isFrozen(source.additions));
}
export function nativeGarageSourceDataBytes(value) {
  return '// Exact native garage historical comparison only; no execution or deployment results transferred.\n'
    + 'const freeze = value => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };\n'
    + 'export const NATIVE_GARAGE_SOURCE = freeze(' + JSON.stringify(value, null, 2) + ');\n'
    + "export const NATIVE_GARAGE_SOURCE_SHA256 = '" + sha(JSON.stringify(value)) + "';\n";
}
export function nativeGarageActual(file) {
  definition();
  const pin = pinFor(file); assert(pin, 'Only a finite reviewed native garage domain');
  const head = git('ls-tree', 'HEAD', '--', file).trim(), index = git('ls-files', '--stage', '--', file).trim();
  assert.equal(head, entry(file, pin, 'tree'), 'Genuine current HEAD must equal reviewed native successor');
  assert.equal(index, entry(file, pin, 'index'), 'Genuine stage-zero index must equal reviewed native successor');
  const stat = fs.lstatSync(file);
  assert(stat.isFile() && !stat.isSymbolicLink(), 'Regular physical reviewed native source required');
  // Historical fixtures project path reads; descriptors retain genuine current physical bytes.
  const descriptor = fs.openSync(file, 'r');
  let physical;
  try { physical = fs.readFileSync(descriptor); } finally { fs.closeSync(descriptor); }
  const committed = execFileSync('git', ['--no-replace-objects', 'show', 'HEAD:' + file], {
    windowsHide: true, maxBuffer: 64 * 1024 * 1024,
  });
  fingerprint(committed, pin);
  if (modified(file) || pin.text) {
    const current = canonical(committed); assert(current && !committed.includes(13), 'Canonical committed LF UTF-8 source');
    assert(physical.equals(committed) || physical.equals(Buffer.from(current.lf.replaceAll('\n', '\r\n'))),
      'Physical source must equal whole current HEAD in LF or uniform CRLF');
  } else assert(physical.equals(committed), 'Binary native source must equal whole HEAD');
  return { head: { mode: pin.mode, blob: pin.blob }, index, committed, physical,
    regular: true, symbolic: false };
}
function baseline(file, input) {
  const current = canonical(input); assert(current, 'Uniform complete LF/CRLF source required');
  const row = source.files[file]; fingerprint(current.lf, row.current);
  let restored = current.lf, end = restored.length;
  for (const inverse of row.inverses.toReversed()) {
    assert(Number.isSafeInteger(inverse.at) && inverse.at >= 0 && inverse.at + inverse.current.length <= end);
    assert.equal(restored.slice(inverse.at, inverse.at + inverse.current.length), inverse.current);
    restored = restored.slice(0, inverse.at) + inverse.baseline + restored.slice(inverse.at + inverse.current.length);
    end = inverse.at;
  }
  fingerprint(restored, row.baseline); return { current, restored };
}
export function qualifyNativeGarageSource(file, input) {
  assert.equal(arguments.length, 2); definition(); assert(modified(file), 'Only exact modified native source has a historical view');
  const proof = baseline(file, input); nativeGarageActual(file);
  return Object.freeze({ file, baselineText: proof.restored, sourceRevision: source.revision,
    predecessorRevision: source.predecessor, ...flags });
}
export function nativeGarageHistoricalInput(file, input) {
  if (!modified(file)) return input;
  const current = canonical(input);
  if (!current || sha(current.lf) !== source.files[file].current.sha256) return input;
  const proof = qualifyNativeGarageSource(file, input);
  return current.buffer ? Buffer.from(proof.baselineText) : proof.baselineText;
}
export function nativeGarageHistoricalEntry(file, input, kind) {
  assert(kind === 'tree' || kind === 'index');
  if (!modified(file)) return input;
  const row = source.files[file], expected = entry(file, row.current, kind);
  if (input !== expected && input !== expected + '\n') return input;
  nativeGarageActual(file);
  return entry(file, row.baseline, kind) + (input.endsWith('\n') ? '\n' : '');
}
export function nativeGarageHistoricalRecord(file, actual) {
  assert.equal(arguments.length, 2);
  if (!modified(file)) return actual;
  definition();
  assert.deepEqual(Object.keys(actual || {}).sort(), ['head', 'index', 'committed', 'physical', 'regular', 'symbolic'].sort());
  assert(actual.head && Object.getPrototypeOf(actual.head) === Object.prototype);
  assert.deepEqual(Object.keys(actual.head).sort(), ['blob', 'mode']);
  assert(Buffer.isBuffer(actual.committed) && Buffer.isBuffer(actual.physical));
  assert.equal(actual.regular, true); assert.equal(actual.symbolic, false);
  const row = source.files[file], genuine = nativeGarageActual(file);
  // Earlier historical records receive no new qualification; downstream exact qualifiers own them.
  if (actual.head.mode !== row.current.mode || actual.head.blob !== row.current.blob) return actual;
  assert.equal(actual.index, genuine.index, 'Supplied stage-zero index must equal genuine current source');
  assert(actual.committed.equals(genuine.committed), 'Supplied committed source must equal genuine current source');
  assert(actual.physical.equals(genuine.committed)
    || actual.physical.equals(Buffer.from(genuine.committed.toString('utf8').replaceAll('\n', '\r\n'))),
  'Supplied physical source must equal whole genuine HEAD in LF or uniform CRLF');
  const before = Buffer.from(baseline(file, actual.committed).restored);
  return { head: { mode: row.baseline.mode, blob: row.baseline.blob }, index: entry(file, row.baseline, 'index'),
    committed: before, physical: before, regular: true, symbolic: false };
}
export function assertNativeGarageCurrentSource() {
  assert.equal(arguments.length, 0); definition();
  for (const [revision, tree] of [[source.revision, source.tree], [source.predecessor, source.predecessorTree]])
    assert.equal(git('rev-parse', revision + '^{tree}').trim(), tree, 'Genuine sealed source tree');
  git('merge-base', '--is-ancestor', source.predecessor, source.revision);
  git('merge-base', '--is-ancestor', source.revision, 'HEAD');
  const excluded = new Set(NATIVE_GARAGE_GENERATED_FILES);
  const changes = kind => git('diff', '--name-only', '--no-renames', '--diff-filter=' + kind,
    '-z', source.predecessor, source.revision).split('\0').filter(file => file && !excluded.has(file));
  assert.deepEqual(Object.keys(source.files), changes('M'), 'Every modified native source has an exact pin');
  assert.deepEqual(Object.keys(source.additions), changes('A'), 'Every added native source has an exact pin');
  assert.deepEqual(changes('DRTCUXB'), [], 'No deletion, replacement, rename or unknown type change');
  assert.deepEqual([...Object.keys(source.files), ...Object.keys(source.additions)].sort(), NATIVE_GARAGE_SCOPE,
    'Exactly the finite reviewed native release and proof domains');
  const after = git('diff', '--name-only', '--no-renames', '-z', source.revision, 'HEAD').split('\0').filter(Boolean);
  assert(after.every(file => excluded.has(file)), 'Only fixed independently generated domains may follow the native source candidate');
  for (const file of NATIVE_GARAGE_SCOPE) nativeGarageActual(file);
  const metadata = 'tools/native-garage-source-data.js', rendered = nativeGarageSourceDataBytes(source);
  assert.equal(fs.readFileSync(metadata, 'utf8').replaceAll('\r\n', '\n'), rendered,
    'Exact generated self-reference contains only data');
  const metadataPin = { mode: '100644', blob: blob(rendered) };
  assert.equal(git('ls-tree', 'HEAD', '--', metadata).trim(), entry(metadata, metadataPin, 'tree'), 'Sealed metadata HEAD must equal exact rendered data');
  assert.equal(git('ls-files', '--stage', '--', metadata).trim(), entry(metadata, metadataPin, 'index'), 'Sealed metadata index must equal exact rendered data');
  return source;
}
