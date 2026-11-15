// Exact successor comparison only. Runtime and native execution use current source.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { CRIME_MINIGAME_SOURCE as source, CRIME_MINIGAME_SOURCE_SHA256 } from './crime-minigame-source-data.js';

export { source as CRIME_MINIGAME_SOURCE };
export const CRIME_MINIGAME_PREDECESSOR = '9cf7ced8beedd0950018a14bbab71b08b71a3d5b';
export const CRIME_MINIGAME_GENERATED_FILES = Object.freeze([
  'tools/crime-minigame-source-data.js',
  'knowledge/generated/graph.json', 'knowledge/generated/graph-summary.md',
  'knowledge/generated/github-history.md', 'knowledge/generated/inventory.md',
  'knowledge/generated/modules.md', 'knowledge/generated/routes.md', 'knowledge/generated/documents.md',
  'tools/enterprise-native-questing-inputs.js', 'docs/questing-workgraph.json', 'docs/quest-quality-workgraph.json',
]);
const flags = Object.freeze({ sourceOnly: true, runtime: false, native: false, migration: false,
  financial: false, activation: false, deployment: false, priorResultsTransferred: false });
const sha = (input) => createHash('sha256').update(input).digest('hex');
const blob = (input) => createHash('sha1').update('blob ' + Buffer.byteLength(input) + '\0').update(input).digest('hex');
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], {
  encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024,
});
const known = (file) => typeof file === 'string' && Object.hasOwn(source.files || {}, file);
const owned = (file) => known(file) || typeof file === 'string' && Object.hasOwn(source.additions || {}, file);
const entry = (file, pin, kind) => kind === 'tree' ? `${pin.mode} blob ${pin.blob}\t${file}` : `${pin.mode} ${pin.blob} 0\t${file}`;
function canonical(input) {
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'Lossless UTF-8 source required; lossless UTF-8 required');
  if (typeof text !== 'string' || /[\0\ufeff]/.test(text)) return null;
  const lf = text.replaceAll('\r\n', '\n');
  if (lf.includes('\r') || text !== lf && text !== lf.replaceAll('\n', '\r\n')) return null;
  return { buffer, lf };
}
function fingerprint(input, pin) {
  assert.equal(Buffer.byteLength(input), pin.bytes, 'Whole crime-minigame source length');
  assert.equal(sha(input), pin.sha256, 'Whole crime-minigame source SHA256');
  assert.equal(blob(input), pin.blob, 'Whole crime-minigame Git blob');
}
function definition() {
  assert.equal(source.status, 'SEALED', 'Crime-minigame successor must be explicitly sealed');
  assert.equal(source.phase, 'EXACT_CRIME_MINIGAME_SOURCE_COMPARISON_ONLY');
  assert.equal(source.predecessor, CRIME_MINIGAME_PREDECESSOR);
  assert.equal(sha(JSON.stringify(source)), CRIME_MINIGAME_SOURCE_SHA256);
  assert(Object.isFrozen(source) && Object.isFrozen(source.files) && Object.isFrozen(source.additions));
}
export function crimeMinigameSourceDataBytes(value) {
  return '// Exact crime-minigame historical comparison only; no execution or deployment results transferred.\n'
    + 'const freeze = value => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };\n'
    + `export const CRIME_MINIGAME_SOURCE = freeze(${JSON.stringify(value, null, 2)});\n`
    + `export const CRIME_MINIGAME_SOURCE_SHA256 = '${sha(JSON.stringify(value))}';\n`;
}
export function qualifyCrimeMinigameRelease() {
  definition();
  for (const [revision, tree] of [[source.revision, source.tree], [source.predecessor, source.predecessorTree]])
    assert.equal(git('rev-parse', `${revision}^{tree}`).trim(), tree);
  git('merge-base', '--is-ancestor', source.predecessor, source.revision);
  git('merge-base', '--is-ancestor', source.revision, 'HEAD');
  const excluded = new Set(CRIME_MINIGAME_GENERATED_FILES);
  const changed = (kind) => git('diff', '--no-renames', '--name-only', '--diff-filter=' + kind,
    '-z', source.predecessor, source.revision).split('\0').filter((file) => file && !excluded.has(file));
  assert.deepEqual(Object.keys(source.files), changed('M'), 'Every modified successor domain has an exact inverse');
  assert.deepEqual(Object.keys(source.additions), changed('A'), 'Every successor addition has an exact full-source pin');
  assert.deepEqual(changed('DRTCUXB'), [], 'No unreviewed deletion, rename, type change or conflict');
  assert(git('diff', '--no-renames', '--name-only', '-z', source.revision, 'HEAD').split('\0')
    .filter(Boolean).every((file) => excluded.has(file)), 'No authored changes may follow the fixed successor candidate');
  assert.equal(fs.readFileSync('tools/crime-minigame-source-data.js', 'utf8').replaceAll('\r\n', '\n'),
    crimeMinigameSourceDataBytes(source), 'The generated self-reference is exact data only');
  return Object.freeze({ files: Object.freeze([...Object.keys(source.files), ...Object.keys(source.additions)]), ...flags });
}
export function crimeMinigameActual(file) {
  definition(); assert(owned(file), 'Only explicitly pinned crime-minigame source domains');
  const pin = source.files[file]?.current || source.additions[file];
  const head = git('ls-tree', 'HEAD', '--', file).trim(), index = git('ls-files', '--stage', '--', file).trim();
  assert.equal(head, entry(file, pin, 'tree'), 'Genuine current HEAD must equal the reviewed minigame successor');
  assert.equal(index, entry(file, pin, 'index'), 'Genuine stage-zero index must equal the reviewed minigame successor');
  const stat = fs.lstatSync(file), physical = fs.readFileSync(file);
  assert(stat.isFile() && !stat.isSymbolicLink(), 'Regular physical reviewed source required');
  const committed = execFileSync('git', ['--no-replace-objects', 'show', 'HEAD:' + file], { windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  fingerprint(committed, pin);
  const current = canonical(committed);
  assert(current && !committed.includes(13), 'Canonical committed LF UTF-8 source');
  assert(physical.equals(committed) || physical.equals(Buffer.from(current.lf.replaceAll('\n', '\r\n'))),
    'Physical source must equal whole current HEAD in LF or uniform CRLF');
  return { head: { mode: pin.mode, blob: pin.blob }, index, committed, physical,
    regular: stat.isFile(), symbolic: stat.isSymbolicLink() };
}
export function qualifyCrimeMinigameSource(file, input) {
  assert.equal(arguments.length, 2); definition(); assert(known(file), 'No predecessor reconstruction for added or unknown source');
  const current = canonical(input); assert(current, 'Uniform complete LF/CRLF source required');
  const row = source.files[file]; fingerprint(current.lf, row.current);
  let baselineText = current.lf, end = baselineText.length;
  for (const inverse of row.inverses.toReversed()) {
    assert(Number.isSafeInteger(inverse.at) && inverse.at >= 0 && inverse.at + inverse.current.length <= end,
      'Exact ordered nonoverlapping successor inverse contexts');
    assert.equal(baselineText.slice(inverse.at, inverse.at + inverse.current.length), inverse.current);
    baselineText = baselineText.slice(0, inverse.at) + inverse.baseline + baselineText.slice(inverse.at + inverse.current.length);
    end = inverse.at;
  }
  fingerprint(baselineText, row.baseline);
  crimeMinigameActual(file);
  return Object.freeze({ file, baselineText, sourceRevision: source.revision, predecessorRevision: source.predecessor, ...flags });
}
// Unknown, older and malformed inputs remain raw for the original strict readers.
export function crimeMinigameHistoricalInput(file, input) {
  if (!known(file)) return input;
  const current = canonical(input);
  if (!current || sha(current.lf) !== source.files[file].current.sha256) return input;
  const baseline = qualifyCrimeMinigameSource(file, input).baselineText;
  return current.buffer ? Buffer.from(baseline) : baseline;
}
export function crimeMinigameHistoricalEntry(file, input, kind) {
  assert(kind === 'tree' || kind === 'index');
  if (!known(file)) return input;
  const expected = entry(file, source.files[file].current, kind);
  if (input !== expected && input !== expected + '\n') return input;
  crimeMinigameActual(file);
  return entry(file, source.files[file].baseline, kind) + (input.endsWith('\n') ? '\n' : '');
}
export function crimeMinigameHistoricalRecord(file, actual) {
  assert.equal(arguments.length, 2);
  if (!known(file)) return actual;
  definition();
  const row = source.files[file], genuine = crimeMinigameActual(file);
  const baseline = Buffer.from(qualifyCrimeMinigameSource(file, genuine.committed).baselineText);
  const prior = { head: { mode: row.baseline.mode, blob: row.baseline.blob }, index: entry(file, row.baseline, 'index'),
    committed: baseline, physical: baseline, regular: true, symbolic: false };
  assert.deepEqual(Object.keys(actual || {}).sort(), Object.keys(genuine).sort(), 'Complete genuine source tuple only');
  if (actual?.head?.blob === row.baseline.blob) {
    const physical = canonical(actual.physical);
    assert(physical && physical.lf === baseline.toString('utf8'), 'A historical physical tuple remains whole and exact');
    assert.deepEqual({ ...actual, physical: baseline }, prior, 'A historical tuple acquires no new authority');
    return actual;
  }
  // Earlier namespaces remain the responsibility of their unchanged strict
  // qualifiers, after the actual current source has independently qualified.
  if (actual?.head?.blob !== row.current.blob) return actual;
  const physical = canonical(actual.physical);
  assert(physical && physical.lf === genuine.committed.toString('utf8'), 'Supplied physical source must equal whole current HEAD');
  assert.deepEqual({ ...actual, physical: genuine.physical }, genuine, 'Only the genuine complete current source tuple qualifies');
  return prior;
}
