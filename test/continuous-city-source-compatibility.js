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
const COMBINED_NATIVE_SUPPORT_PINS = Object.freeze([{"revision":"bfc3baf69d030771dceb59fec9c44ca9652660c3","file":"tools/enterprise-native.js","mode":"100644","blob":"fb7186cd9be309169d067ee344b5d7babb57e882","sha256":"f3e1a5a0505b2aec9a9f3639d4be6cffcd71b067bb22f6637eb34bd8d35c65f5","bytes":43727},{"revision":"59dbb6d99312fa44dba1fbec5bdf24948740e0dc","file":"tools/enterprise-native-continuous-city-inputs.js","mode":"100644","blob":"1af546bd54ac00f7dbc5db4d2c6e77ddefe1cf95","sha256":"804f29d96f31767fb3447dc61ed01ca243d9770357923ded125493bb19e71f58","bytes":16048}].map(Object.freeze));
const COMBINED_NATIVE_AUTHORED_REFERENCE = Object.freeze({"revision":"df51cd2cbb91faf194be311fc1636c008df9e4c5","file":"tools/enterprise-native-inputs.js","mode":"100644","blob":"046825803c0d26deb5b8ee35d4474072ce7bace1","sha256":"3a706e8c7140703fb0d39af668cf06372ffc36e985d6df3456cd21963dbba9ad","bytes":407020});
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
// The authored catalogue is an immutable earlier seal. Only this TEST proof maps it to the fixed legacy reference.
// Actual current source capture still reads its complete bytes and requires the current native validator.
function authoredCombinedCatalogueLegacyProof() {
  assert.equal(CONTINUOUS_CITY_SOURCE_REVISION, COMBINED_NATIVE_AUTHORED_REFERENCE.revision,
    'One explicitly pinned authored source catalogue only');
  const authored = readPinnedCatalogueReference(COMBINED_NATIVE_AUTHORED_REFERENCE);
  assert.equal(git('show', CONTINUOUS_CITY_SOURCE_REVISION + ':' + COMBINED_NATIVE_AUTHORED_REFERENCE.file), authored);
  const reference = readPinnedCatalogueReference(COMBINED_NATIVE_REFERENCE);
  assert.equal(inspectCombinedCatalogueText(authored, reference).normalizedText, reference,
    'Whole authored catalogue differs from the fixed reference only in its closed initializer');
  return readPinnedCatalogueReference(LEGACY_NATIVE_REFERENCE);
}
for (const file of ['tools/enterprise-current-source-compatibility.js', 'tools/enterprise-current-source-data.js', 'tools/enterprise-native-inputs.js']) {
  assert.equal(lf(file === 'tools/enterprise-native-inputs.js' ? await normalizeCombinedCatalogueForLegacyProof(fs.readFileSync(file, 'utf8')) : fs.readFileSync(file, 'utf8')),
    file === 'tools/enterprise-native-inputs.js'
      ? authoredCombinedCatalogueLegacyProof()
      : git('show', CONTINUOUS_CITY_SOURCE_REVISION + ':' + file), 'Predecessor guard/data is immutable: ' + file);
}
console.log(JSON.stringify({ phase: 'CONTINUOUS_CITY_EXACT_SOURCE_ONLY', source: CONTINUOUS_CITY_SOURCE_REVISION,
  predecessor: CONTINUOUS_CITY_SOURCE_PREDECESSOR, sourceFiles: 16, addedFiles: additions, fixtureReaders: 36,
  positives, refusals, inverseHunks, native: false, postgres: false, release: false }));
