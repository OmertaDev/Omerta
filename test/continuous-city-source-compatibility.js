import { parse as parseCatalogueSource } from 'acorn';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Exact complete GUI and fixture-reader source proofs; no native/runtime admission.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { CONTINUOUS_CITY_SOURCE_REVISION, CONTINUOUS_CITY_SOURCE_PREDECESSOR, CONTINUOUS_CITY_SOURCE_DOMAINS,
  CONTINUOUS_CITY_FIXTURE_DOMAINS, qualifyContinuousCitySource, qualifyContinuousCityFixtureSource,
  continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';
import { CONTINUOUS_CITY_FIXTURE_PREDECESSOR } from '../tools/continuous-city-fixture-source-data.js';
import { hasEnterpriseOverRootSource, enterpriseOverRootSourceBaseline } from '../tools/enterprise-current-source-compatibility.js';
assert.deepEqual(process.argv.slice(2), [], 'Source-only proof has no native or retained modes');
const git = (...args) => execFileSync('git', ['-c', 'core.safecrlf=false', ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
const lf = text => text.replaceAll('\r\n', '\n');
function hunks(diff) {
  const result = []; let current;
  for (const line of diff.split('\n')) {
    if (line.startsWith('@@')) { if (current) result.push(current); current = { current: '', baseline: '' }; }
    else if (current && line.startsWith(' ')) { current.current += line.slice(1) + '\n'; current.baseline += line.slice(1) + '\n'; }
    else if (current && line.startsWith('+')) current.current += line.slice(1) + '\n';
    else if (current && line.startsWith('-')) current.baseline += line.slice(1) + '\n';
    else if (current && line.startsWith('\\ No newline')) assert.fail('Unexpected non-newline source hunk');
  }
  if (current) result.push(current); return result;
}
let positives = 0, refusals = 0, inverseHunks = 0, additions = 0;
function verify(file, pin, actual, baseline, qualify, diff) {
  assert.equal(hash(actual), pin.currentSha256); assert.equal(blob(actual), pin.currentBlob);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.currentRawSha256) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));
  for (const input of [actual, actual.replaceAll('\n', '\r\n')]) {
    const proof = qualify(file, input);
    assert.equal(proof.sourceOnly, true); assert.equal(proof.native, false);
    assert.equal(proof.predecessorAbsent, baseline === null); assert.equal(proof.baselineText, baseline);
    assert.equal(hash(input), pin.currentRawSha256[input.includes('\r\n') ? 'crlf' : 'lf']); positives++;
  }
  for (const input of [actual + '\n// unknown\n', '\n// unknown\n' + actual, actual.slice(1), '\ufeff' + actual,
    actual + '\0', actual.replace('\n', '\r\n'), actual.replace('\n', '\r'), Buffer.from(actual), null]) {
    assert.throws(() => qualify(file, input)); refusals++;
  }
  for (const inverse of pin.inverses) {
    for (const input of [actual.replace(inverse.current, ''), actual.replace(inverse.current, () => inverse.current + inverse.current), actual.replace(inverse.current, () => inverse.baseline)]) {
      assert.throws(() => qualify(file, input)); refusals++;
    }
    inverseHunks++;
  }
  if (baseline === null) {
    assert.equal(pin.baselineMode, null); assert.equal(pin.baselineBlob, null); assert.equal(pin.baselineSha256, null);
    assert.deepEqual(pin.inverses, []); assert.throws(() => continuousCityHistoricalInput(file, actual)); refusals++; additions++;
  } else {
    assert.equal(pin.baselineMode, '100644'); assert.equal(hash(baseline), pin.baselineSha256); assert.equal(blob(baseline), pin.baselineBlob);
    assert.deepEqual(pin.inverses, hunks(diff), 'Inverses must be actual complete Git diff contexts: ' + file);
    assert.throws(() => qualify(file, baseline)); refusals++;
    assert.throws(() => continuousCityHistoricalInput(file, baseline)); refusals++;
    assert.throws(() => continuousCityHistoricalInput(file, Buffer.concat([Buffer.from(actual), Buffer.from([0xff])])), /lossless UTF-8/); refusals++;
    assert.equal(continuousCityHistoricalInput(file, actual), baseline);
    assert.deepEqual(continuousCityHistoricalInput(file, Buffer.from(actual)), Buffer.from(baseline)); positives += 2;
    for (const input of [actual + '\n// physical mutation\n', '\ufeff' + actual, actual + '\0', actual.replace('\n', '\r\n')]) {
      assert.throws(() => continuousCityHistoricalInput(file, input)); refusals++;
    }
  }
}
assert.equal(Object.keys(CONTINUOUS_CITY_SOURCE_DOMAINS).length, 16);
for (const [file, pin] of Object.entries(CONTINUOUS_CITY_SOURCE_DOMAINS)) {
  const current = git('show', CONTINUOUS_CITY_SOURCE_REVISION + ':' + file);
  assert.equal(lf(fs.readFileSync(file, 'utf8')), current, 'Actual GUI source must remain exactly frozen: ' + file);
  assert.equal(git('ls-tree', CONTINUOUS_CITY_SOURCE_REVISION, '--', file).split(' ')[0], pin.currentMode);
  const priorTree = git('ls-tree', CONTINUOUS_CITY_SOURCE_PREDECESSOR, '--', file);
  assert.equal(priorTree === '', pin.predecessorAbsent);
  if (!pin.predecessorAbsent) assert.equal(priorTree.split(' ')[0], pin.baselineMode);
  const baseline = pin.predecessorAbsent ? null : git('show', CONTINUOUS_CITY_SOURCE_PREDECESSOR + ':' + file);
  verify(file, pin, current, baseline, qualifyContinuousCitySource,
    git('diff', '--no-ext-diff', '--unified=3', CONTINUOUS_CITY_SOURCE_PREDECESSOR, CONTINUOUS_CITY_SOURCE_REVISION, '--', file));
  if (hasEnterpriseOverRootSource(file)) { assert.throws(() => enterpriseOverRootSourceBaseline(file, current)); refusals++; }
}
assert.equal(additions, 5);
assert.equal(Object.keys(CONTINUOUS_CITY_FIXTURE_DOMAINS).length, 36);
for (const [file, pin] of Object.entries(CONTINUOUS_CITY_FIXTURE_DOMAINS)) {
  assert(file.startsWith('test/'), 'Reader proofs cannot admit production source');
  assert(!Object.hasOwn(CONTINUOUS_CITY_SOURCE_DOMAINS, file), 'GUI and reader domains stay disjoint');
  const actual = lf(fs.readFileSync(file, 'utf8')), baseline = git('show', CONTINUOUS_CITY_FIXTURE_PREDECESSOR + ':' + file);
  assert.equal(git('ls-files', '--stage', '--', file).split(' ')[0], pin.currentMode);
  assert.equal(git('ls-tree', CONTINUOUS_CITY_FIXTURE_PREDECESSOR, '--', file).split(' ')[0], pin.baselineMode);
  verify(file, pin, actual, baseline, qualifyContinuousCityFixtureSource,
    git('diff', '--no-ext-diff', '--unified=3', CONTINUOUS_CITY_FIXTURE_PREDECESSOR, '--', file));
  if (hasEnterpriseOverRootSource(file)) { assert.throws(() => enterpriseOverRootSourceBaseline(file, actual)); refusals++; }
}
for (const file of ['__proto__', 'constructor', 'toString', '../package.json', 'src/unknown.js', 'schema.sql.extra']) {
  for (const fn of [qualifyContinuousCitySource, qualifyContinuousCityFixtureSource]) { assert.throws(() => fn(file, 'unknown')); refusals++; }
  const raw = Buffer.from('unknown\r\nbytes\n'); assert.equal(continuousCityHistoricalInput(file, raw), raw);
}
// TEST-only catalogue normalization. Only the separately sealed initializer may vary; no native admission.
const COMBINED_NATIVE_REFERENCE = Object.freeze({"revision":"b8b9d514625d9dd9031bcc4dde05c32258c3898a","file":"tools/enterprise-native-inputs.js","mode":"100644","blob":"658d7d9c7df1233276b889b4161ce9eb1886f516","sha256":"e5f6e872591ec45678dbd0bf8305e4773487a38b8fef17baf68efac7baa8d6c7","bytes":390940});
const LEGACY_NATIVE_REFERENCE = Object.freeze({"revision":"3fd8f15280c5d14b4580d90706df2e93d42437a3","file":"tools/enterprise-native-inputs.js","mode":"100644","blob":"c73580084370d27d4776beb3d301d1c8d6a7514a","sha256":"0b48fd7ba46c4b39f1dec0b61148236fa6f2b174a13518e6ce21d66267075447","bytes":390371});
const COMBINED_NATIVE_APPEND = Object.freeze({"bytes":569,"sha256":"b5fb5478b4bb4ff1ec574bd70a0adac42521e4a35cc959e0e50e762a384021ea"});
const COMBINED_NATIVE_SUPPORT_PINS = Object.freeze([{"revision":"b8b9d514625d9dd9031bcc4dde05c32258c3898a","file":"tools/enterprise-native.js","mode":"100644","blob":"a629f9e2bda53c08d668e83a622b22f3b3386e7b","sha256":"92fa3291e176aaeacd243c4e67dfe2727b1164ce9af3f7100831cab29d5032b0","bytes":38912},{"revision":"b8b9d514625d9dd9031bcc4dde05c32258c3898a","file":"tools/enterprise-native-continuous-city-inputs.js","mode":"100644","blob":"f54c85b7fdf7c9e45c6543dbbecbc2fd6094b8ad","sha256":"cd27e2ee872445bd04d370b8ea80e0cb6f9c3db9ee1450ff65312ea2ac18e13a","bytes":16048}].map(Object.freeze));
function catalogueLF(input) {
  assert.equal(typeof input, 'string', 'Catalogue source must be complete text');
  const text = lf(input);
  assert(!text.includes('\r') && !text.includes('\0') && !text.startsWith('\ufeff')
    && (input === text || input === text.replaceAll('\n', '\r\n')), 'Uniform whole catalogue LF/CRLF only');
  assert(Buffer.byteLength(text) <= COMBINED_NATIVE_REFERENCE.bytes + 1024 * 1024, 'Bounded catalogue initializer');
  return text;
}
function combinedCatalogueInitializer(source) {
  const tree = parseCatalogueSource(source, {ecmaVersion:'latest', sourceType:'module'}), matches = [];
  for (const statement of tree.body) if (statement.type === 'ExportNamedDeclaration'
      && statement.declaration?.type === 'VariableDeclaration') {
    for (const declaration of statement.declaration.declarations) if (declaration.id.type === 'Identifier'
        && declaration.id.name === 'ENTERPRISE_NATIVE_COMMERCE_GUI_INPUTS') matches.push(declaration.init);
  }
  assert.equal(matches.length, 1, 'Exactly one known combined catalogue initializer');
  return matches[0];
}
function decodeCombinedCatalogueLiteral(root) {
  let count = 0;
  function decode(node, depth) {
    assert(node && depth <= 64 && ++count <= 50000, 'Bounded closed catalogue literal');
    if (node.type === 'Literal') {
      assert(node.value === null || ['string','boolean'].includes(typeof node.value)
        || (typeof node.value === 'number' && Number.isFinite(node.value)), 'JSON literal only');
      return node.value;
    }
    if (node.type === 'ArrayExpression') {
      assert(node.elements.every(Boolean), 'No holes in catalogue arrays');
      return Object.freeze(node.elements.map(value => decode(value, depth + 1)));
    }
    if (node.type === 'ObjectExpression') {
      const result = {};
      for (const property of node.properties) {
        assert(property.type === 'Property' && property.kind === 'init' && !property.computed
          && !property.method && !property.shorthand, 'Closed catalogue properties only');
        const key = property.key.type === 'Identifier' ? property.key.name : property.key.value;
        assert(typeof key === 'string' && !['__proto__','constructor','prototype'].includes(key)
          && !Object.hasOwn(result, key), 'Unique safe catalogue property');
        result[key] = decode(property.value, depth + 1);
      }
      return Object.freeze(result);
    }
    assert(node.type === 'CallExpression' && !node.optional && node.arguments.length === 1
      && node.callee.type === 'MemberExpression' && !node.callee.computed && !node.callee.optional
      && node.callee.object.type === 'Identifier' && node.callee.object.name === 'Object'
      && node.callee.property.type === 'Identifier' && node.callee.property.name === 'freeze',
      'Only Object.freeze of closed literal data; no evaluation');
    return decode(node.arguments[0], depth + 1);
  }
  return decode(root, 0);
}
function inspectCombinedCatalogueText(input, reference) {
  const text = catalogueLF(input), known = catalogueLF(reference);
  assert.equal(hash(known), COMBINED_NATIVE_REFERENCE.sha256);
  assert.equal(blob(known), COMBINED_NATIVE_REFERENCE.blob);
  const expected = combinedCatalogueInitializer(known), current = combinedCatalogueInitializer(text);
  const normalizedText = text.slice(0, current.start) + known.slice(expected.start, expected.end) + text.slice(current.end);
  assert.equal(normalizedText, known, 'All original five C exports and static combined append stay byte-exact');
  const manifest = decodeCombinedCatalogueLiteral(current);
  assert(manifest && ['UNSEALED','SEALED'].includes(manifest.status), 'Known catalogue state only');
  if (manifest.status === 'UNSEALED') assert.equal(text, known, 'UNSEALED initializer must remain the exact reviewed B form');
  return {normalizedText, manifest};
}
function readPinnedCatalogueReference(pin) {
  assert.equal(git('ls-tree', pin.revision, '--', pin.file).trim(), pin.mode + ' blob ' + pin.blob + '\t' + pin.file);
  const text = catalogueLF(git('show', pin.revision + ':' + pin.file));
  assert.equal(Buffer.byteLength(text), pin.bytes); assert.equal(hash(text), pin.sha256); assert.equal(blob(text), pin.blob);
  return text;
}
function assertCurrentCatalogueSupport(pin) {
  const directory = fs.lstatSync('tools'), physical = fs.lstatSync(pin.file);
  assert(directory.isDirectory() && !directory.isSymbolicLink(), 'Pinned support directory must be ordinary and not redirected');
  assert(physical.isFile() && !physical.isSymbolicLink(), 'Pinned support must be an ordinary non-symlink file');
  readPinnedCatalogueReference(pin);
  const text = catalogueLF(fs.readFileSync(pin.file, 'utf8'));
  assert.equal(git('ls-files', '--stage', '--', pin.file), pin.mode + ' ' + pin.blob + ' 0\t' + pin.file + '\n');
  assert.equal(Buffer.byteLength(text), pin.bytes); assert.equal(hash(text), pin.sha256); assert.equal(blob(text), pin.blob);
}
async function normalizeCombinedCatalogueForLegacyProof(input) {
  const reference = readPinnedCatalogueReference(COMBINED_NATIVE_REFERENCE);
  const inspected = inspectCombinedCatalogueText(input, reference), current = catalogueLF(input);
  assert.equal(git('ls-files', '--stage', '--', COMBINED_NATIVE_REFERENCE.file),
    '100644 ' + blob(current) + ' 0\t' + COMBINED_NATIVE_REFERENCE.file + '\n', 'Regular exact current catalogue index/body required');
  if (inspected.manifest.status === 'SEALED') {
    for (const pin of COMBINED_NATIVE_SUPPORT_PINS) assertCurrentCatalogueSupport(pin);
    assert.notEqual(path.resolve(process.argv[1] || '').toLowerCase(),
      fileURLToPath(new URL('../tools/enterprise-native.js', import.meta.url)).toLowerCase(), 'Pure validator import cannot invoke the native CLI');
    const {assertEnterpriseCombinedInputDefinition} = await import('../tools/enterprise-native.js');
    assertEnterpriseCombinedInputDefinition(inspected.manifest);
  }
  const legacy = readPinnedCatalogueReference(LEGACY_NATIVE_REFERENCE), append = reference.slice(legacy.length);
  assert.equal(reference.slice(0, legacy.length), legacy);
  assert.equal(Buffer.byteLength(append), COMBINED_NATIVE_APPEND.bytes); assert.equal(hash(append), COMBINED_NATIVE_APPEND.sha256);
  assert(inspected.normalizedText.endsWith(append), 'Exact known reviewed append only');
  const normalized = inspected.normalizedText.slice(0, inspected.normalizedText.length - append.length);
  assert.equal(normalized, legacy, 'Whole actual catalogue reconstructs the immutable A definition');
  return normalized;
}
for (const file of ['tools/enterprise-current-source-compatibility.js', 'tools/enterprise-current-source-data.js', 'tools/enterprise-native-inputs.js']) {
  assert.equal(lf(file === 'tools/enterprise-native-inputs.js' ? await normalizeCombinedCatalogueForLegacyProof(fs.readFileSync(file, 'utf8')) : fs.readFileSync(file, 'utf8')), git('show', CONTINUOUS_CITY_SOURCE_REVISION + ':' + file), 'Predecessor guard/data is immutable: ' + file);
}
console.log(JSON.stringify({ phase: 'CONTINUOUS_CITY_EXACT_SOURCE_ONLY', source: CONTINUOUS_CITY_SOURCE_REVISION,
  predecessor: CONTINUOUS_CITY_SOURCE_PREDECESSOR, sourceFiles: 16, addedFiles: additions, fixtureReaders: 36,
  positives, refusals, inverseHunks, native: false, postgres: false, release: false }));
