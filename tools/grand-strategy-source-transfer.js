// Finite grand-strategy successor comparison; never imported by runtime.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { GRAND_STRATEGY_SOURCE, GRAND_STRATEGY_SOURCE_SHA256 } from './grand-strategy-source-data.js';

export { GRAND_STRATEGY_SOURCE };
export const GRAND_STRATEGY_PREDECESSOR = '7d52e1f08dc9540b182553b70dedfce4fecfac22';
export const GRAND_STRATEGY_RELEASE_FILES = Object.freeze([
  "public/art/grand-strategy/city-atlas.mp4",
  "public/art/grand-strategy/city-atlas.webp",
  "public/art/grand-strategy/city-seal.webp",
  "public/art/grand-strategy/council-chamber.mp4",
  "public/art/grand-strategy/council-chamber.webp",
  "public/art/grand-strategy/district-brick.mp4",
  "public/art/grand-strategy/district-brick.webp",
  "public/art/grand-strategy/district-canal.mp4",
  "public/art/grand-strategy/district-canal.webp",
  "public/art/grand-strategy/district-cathedral.mp4",
  "public/art/grand-strategy/district-cathedral.webp",
  "public/art/grand-strategy/district-docks.mp4",
  "public/art/grand-strategy/district-docks.webp",
  "public/art/grand-strategy/district-foundry.mp4",
  "public/art/grand-strategy/district-foundry.webp",
  "public/art/grand-strategy/district-neon.mp4",
  "public/art/grand-strategy/district-neon.webp",
  "public/art/grand-strategy/motion/city-atlas-ambient.mp4",
  "public/art/grand-strategy/motion/city-atlas-cinematic-take2.mp4",
  "public/art/grand-strategy/motion/city-atlas-cinematic.mp4",
  "public/art/grand-strategy/motion/city-atlas-dawn.mp4",
  "public/art/grand-strategy/motion/city-atlas-h3.mp4",
  "public/art/grand-strategy/motion/city-atlas-mist.mp4",
  "public/art/grand-strategy/motion/city-atlas-night.mp4",
  "public/art/grand-strategy/motion/city-atlas-rain.mp4",
  "public/art/grand-strategy/motion/city-atlas-snow.mp4",
  "public/art/grand-strategy/motion/city-atlas-streetlife.mp4",
  "public/art/grand-strategy/motion/council-chamber-ambient.mp4",
  "public/art/grand-strategy/motion/council-chamber-cinematic.mp4",
  "public/art/grand-strategy/motion/council-chamber-dawn.mp4",
  "public/art/grand-strategy/motion/council-chamber-h3.mp4",
  "public/art/grand-strategy/motion/council-chamber-mist.mp4",
  "public/art/grand-strategy/motion/council-chamber-night.mp4",
  "public/art/grand-strategy/motion/council-chamber-rain.mp4",
  "public/art/grand-strategy/motion/council-chamber-snow.mp4",
  "public/art/grand-strategy/motion/council-chamber-streetlife.mp4",
  "public/art/grand-strategy/motion/district-brick-ambient.mp4",
  "public/art/grand-strategy/motion/district-brick-cinematic.mp4",
  "public/art/grand-strategy/motion/district-brick-dawn.mp4",
  "public/art/grand-strategy/motion/district-brick-h3.mp4",
  "public/art/grand-strategy/motion/district-brick-mist.mp4",
  "public/art/grand-strategy/motion/district-brick-night.mp4",
  "public/art/grand-strategy/motion/district-brick-rain.mp4",
  "public/art/grand-strategy/motion/district-brick-snow.mp4",
  "public/art/grand-strategy/motion/district-brick-streetlife.mp4",
  "public/art/grand-strategy/motion/district-canal-ambient.mp4",
  "public/art/grand-strategy/motion/district-canal-cinematic.mp4",
  "public/art/grand-strategy/motion/district-canal-dawn.mp4",
  "public/art/grand-strategy/motion/district-canal-h3.mp4",
  "public/art/grand-strategy/motion/district-canal-mist.mp4",
  "public/art/grand-strategy/motion/district-canal-night.mp4",
  "public/art/grand-strategy/motion/district-canal-rain.mp4",
  "public/art/grand-strategy/motion/district-canal-snow.mp4",
  "public/art/grand-strategy/motion/district-canal-streetlife.mp4",
  "public/art/grand-strategy/motion/district-cathedral-ambient.mp4",
  "public/art/grand-strategy/motion/district-cathedral-cinematic.mp4",
  "public/art/grand-strategy/motion/district-cathedral-dawn.mp4",
  "public/art/grand-strategy/motion/district-cathedral-h3.mp4",
  "public/art/grand-strategy/motion/district-cathedral-mist.mp4",
  "public/art/grand-strategy/motion/district-cathedral-night.mp4",
  "public/art/grand-strategy/motion/district-cathedral-rain.mp4",
  "public/art/grand-strategy/motion/district-cathedral-snow.mp4",
  "public/art/grand-strategy/motion/district-cathedral-streetlife.mp4",
  "public/art/grand-strategy/motion/district-docks-ambient.mp4",
  "public/art/grand-strategy/motion/district-docks-cinematic.mp4",
  "public/art/grand-strategy/motion/district-docks-dawn.mp4",
  "public/art/grand-strategy/motion/district-docks-h3.mp4",
  "public/art/grand-strategy/motion/district-docks-mist.mp4",
  "public/art/grand-strategy/motion/district-docks-night.mp4",
  "public/art/grand-strategy/motion/district-docks-rain.mp4",
  "public/art/grand-strategy/motion/district-docks-snow.mp4",
  "public/art/grand-strategy/motion/district-docks-streetlife.mp4",
  "public/art/grand-strategy/motion/district-foundry-ambient.mp4",
  "public/art/grand-strategy/motion/district-foundry-cinematic.mp4",
  "public/art/grand-strategy/motion/district-foundry-dawn.mp4",
  "public/art/grand-strategy/motion/district-foundry-h3.mp4",
  "public/art/grand-strategy/motion/district-foundry-mist.mp4",
  "public/art/grand-strategy/motion/district-foundry-night.mp4",
  "public/art/grand-strategy/motion/district-foundry-rain.mp4",
  "public/art/grand-strategy/motion/district-foundry-snow.mp4",
  "public/art/grand-strategy/motion/district-foundry-streetlife.mp4",
  "public/art/grand-strategy/motion/district-neon-ambient.mp4",
  "public/art/grand-strategy/motion/district-neon-cinematic.mp4",
  "public/art/grand-strategy/motion/district-neon-dawn.mp4",
  "public/art/grand-strategy/motion/district-neon-h3.mp4",
  "public/art/grand-strategy/motion/district-neon-mist.mp4",
  "public/art/grand-strategy/motion/district-neon-night.mp4",
  "public/art/grand-strategy/motion/district-neon-rain.mp4",
  "public/art/grand-strategy/motion/district-neon-snow.mp4",
  "public/art/grand-strategy/motion/district-neon-streetlife.mp4",
  "public/art/grand-strategy/scene-library.json",
  "public/index.html",
  "public/strategy-atmosphere.css",
  "public/strategy-atmosphere.js",
  "public/strategy-command.css",
  "public/strategy-command.js",
  "public/sw.js",
  "src/server.js",
  "test/strategy-command-browser.js"
]);

export const GRAND_STRATEGY_PROOF_FILES = Object.freeze([
  'tools/grand-strategy-source-data.js', 'tools/grand-strategy-source-transfer.js',
  'tools/grand-strategy-source-seal.js', 'test/grand-strategy-source-transfer.js',
  'tools/ui-trim-source-transfer.js', 'test/ui-trim-source-transfer.js',
]);
export const GRAND_STRATEGY_GENERATED_FILES = Object.freeze([
  'tools/grand-strategy-source-data.js',
  'knowledge/generated/graph.json', 'knowledge/generated/graph-summary.md',
  'knowledge/generated/github-history.md', 'knowledge/generated/inventory.md',
  'tools/enterprise-native-questing-inputs.js',
  'docs/questing-workgraph.json', 'docs/quest-quality-workgraph.json',
]);
export const GRAND_STRATEGY_SCOPE = Object.freeze([...GRAND_STRATEGY_RELEASE_FILES, ...GRAND_STRATEGY_PROOF_FILES].sort());
const source = GRAND_STRATEGY_SOURCE;
const sha = input => createHash('sha256').update(input).digest('hex');
const blob = input => createHash('sha1').update('blob ' + Buffer.byteLength(input) + '\0').update(input).digest('hex');
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], {
  encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024,
});
const flags = Object.freeze({ sourceOnly: true, runtime: false, native: false, migration: false,
  financial: false, activation: false, deployment: false, priorResultsTransferred: false });
const known = file => typeof file === 'string' && Object.hasOwn(source.files || {}, file);
const entry = (file, pin, kind) => kind === 'tree' ? pin.mode + ' blob ' + pin.blob + '\t' + file
  : pin.mode + ' ' + pin.blob + ' 0\t' + file;
const shape = actual => {
  assert.deepEqual(Object.keys(actual || {}).sort(), ['head', 'index', 'committed', 'physical', 'regular', 'symbolic'].sort());
  assert(actual.head && Object.getPrototypeOf(actual.head) === Object.prototype);
  assert.deepEqual(Object.keys(actual.head).sort(), ['blob', 'mode']);
  assert(Buffer.isBuffer(actual.committed) && Buffer.isBuffer(actual.physical));
  assert.equal(actual.regular, true); assert.equal(actual.symbolic, false);
};
function canonical(input) {
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'Lossless UTF-8 source required; lossless UTF-8 required');
  if (typeof text !== 'string' || /[\0\ufeff]/.test(text)) return null;
  const lf = text.replaceAll('\r\n', '\n');
  if (lf.includes('\r') || (text !== lf && text !== lf.replaceAll('\n', '\r\n'))) return null;
  return { buffer, lf };
}
function fingerprint(input, pin) {
  assert.equal(Buffer.byteLength(input), pin.bytes, 'Whole successor source length');
  assert.equal(sha(input), pin.sha256, 'Whole successor SHA256');
  assert.equal(blob(input), pin.blob, 'Whole successor Git blob');
}
function definition() {
  assert.equal(source.status, 'SEALED', 'Grand-strategy successor must be explicitly sealed');
  assert.equal(source.phase, 'EXACT_GRAND_STRATEGY_SOURCE_COMPARISON_ONLY');
  assert.equal(source.predecessor, GRAND_STRATEGY_PREDECESSOR);
  assert.equal(sha(JSON.stringify(source)), GRAND_STRATEGY_SOURCE_SHA256);
  assert(Object.isFrozen(source) && Object.isFrozen(source.files) && Object.isFrozen(source.additions));
}
export function grandStrategySourceDataBytes(value) {
  return '// Exact grand-strategy historical comparison only; no execution or deployment results transferred.\n'
    + 'const freeze = value => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };\n'
    + 'export const GRAND_STRATEGY_SOURCE = freeze(' + JSON.stringify(value, null, 2) + ');\n'
    + "export const GRAND_STRATEGY_SOURCE_SHA256 = '" + sha(JSON.stringify(value)) + "';\n";
}
// Read genuine current identities; supplied records can never nominate their own authority.
export function grandStrategyActual(file) {
  definition();
  assert(typeof file === 'string' && (Object.hasOwn(source.files, file) || Object.hasOwn(source.additions, file)),
    'Only an explicitly owned reviewed source domain');
  const pin = source.files[file]?.current || source.additions[file];
  assert(pin, 'Only a finite reviewed successor domain');
  const headEntry = git('ls-tree', 'HEAD', '--', file).trim();
  const index = git('ls-files', '--stage', '--', file).trim();
  assert.equal(headEntry, entry(file, pin, 'tree'), 'Genuine current HEAD must equal reviewed successor');
  assert.equal(index, entry(file, pin, 'index'), 'Genuine stage-zero index must equal reviewed successor');
  const stat = fs.lstatSync(file), physical = fs.readFileSync(file);
  assert(stat.isFile() && !stat.isSymbolicLink(), 'Regular physical reviewed source required');
  const committed = execFileSync('git', ['--no-replace-objects', 'show', 'HEAD:' + file], {
    windowsHide: true, maxBuffer: 64 * 1024 * 1024,
  });
  fingerprint(committed, pin);
  if (source.files[file] || pin.text) {
    const current = canonical(committed);
    assert(current && !committed.includes(13), 'Canonical committed LF UTF-8 source');
    assert(physical.equals(committed) || physical.equals(Buffer.from(current.lf.replaceAll('\n', '\r\n'))),
      'Physical source must equal whole current HEAD in LF or uniform CRLF');
  } else assert(physical.equals(committed), 'Binary source is admitted only byte-for-byte');
  return { head: { mode: pin.mode, blob: pin.blob }, index, committed, physical,
    regular: stat.isFile(), symbolic: stat.isSymbolicLink() };
}
function baselineText(file, input) {
  const current = canonical(input); assert(current, 'Uniform complete LF/CRLF source required');
  const row = source.files[file]; fingerprint(current.lf, row.current);
  let restored = current.lf, end = restored.length;
  for (const inverse of row.inverses.toReversed()) {
    assert(Number.isSafeInteger(inverse.at) && inverse.at >= 0 && inverse.at + inverse.current.length <= end);
    assert.equal(restored.slice(inverse.at, inverse.at + inverse.current.length), inverse.current);
    restored = restored.slice(0, inverse.at) + inverse.baseline + restored.slice(inverse.at + inverse.current.length);
    end = inverse.at;
  }
  fingerprint(restored, row.baseline);
  return { current, restored };
}
export function qualifyGrandStrategySource(file, input) {
  assert.equal(arguments.length, 2); definition(); assert(known(file), 'No predecessor reconstruction for added or unknown source');
  const result = baselineText(file, input);
  grandStrategyActual(file);
  return Object.freeze({ file, baselineText: result.restored, sourceRevision: source.revision,
    predecessorRevision: source.predecessor, ...flags });
}
// Unknown input passes unchanged to the original refusing historical qualifier.
export function grandStrategyHistoricalInput(file, input) {
  if (!known(file)) return input;
  const current = canonical(input);
  if (!current || sha(current.lf) !== source.files[file].current.sha256) return input;
  const proof = qualifyGrandStrategySource(file, input);
  return current.buffer ? Buffer.from(proof.baselineText) : proof.baselineText;
}
export function grandStrategyHistoricalEntry(file, input, kind) {
  assert(kind === 'tree' || kind === 'index');
  if (!known(file)) return input;
  const row = source.files[file], expected = entry(file, row.current, kind);
  if (input !== expected && input !== expected + '\n') return input;
  grandStrategyActual(file);
  return entry(file, row.baseline, kind) + (input.endsWith('\n') ? '\n' : '');
}
export function grandStrategyHistoricalRecord(file, actual) {
  assert.equal(arguments.length, 2);
  if (!known(file)) return actual;
  definition(); shape(actual);
  const row = source.files[file];
  const genuine = grandStrategyActual(file);
  // An already historical tuple remains unchanged and receives no successor qualification.
  if (actual.head.mode === row.baseline.mode && actual.head.blob === row.baseline.blob
    && actual.index === entry(file, row.baseline, 'index') && sha(actual.committed) === row.baseline.sha256) {
    fingerprint(actual.committed, row.baseline);
    const prior = canonical(actual.committed); assert(prior && !actual.committed.includes(13));
    assert(actual.physical.equals(actual.committed) || actual.physical.equals(Buffer.from(prior.lf.replaceAll('\n', '\r\n'))));
    return actual;
  }
  assert.deepEqual(actual.head, genuine.head); assert.equal(actual.index, genuine.index);
  assert(actual.committed.equals(genuine.committed) && actual.physical.equals(genuine.physical),
    'The complete supplied tuple must equal genuine current Git/index/physical source');
  const before = Buffer.from(baselineText(file, actual.committed).restored);
  return { head: { mode: row.baseline.mode, blob: row.baseline.blob }, index: entry(file, row.baseline, 'index'),
    committed: before, physical: before, regular: true, symbolic: false };
}
