// Exact pure historical-fixture reader projection; the public runtime is unchanged.
// Postimage bytes are pinned here; the current native manifest separately binds its authored commit.
// This grants no runtime, native, financial, genesis or deployment qualification.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

export const GENESIS_HISTORICAL_READER_BINDING = {
  "file": "test/lib/rc1-historical-source-fixture.js",
  "mode": "100644",
  "baselineRevision": "009ba651c4b7746351ee3522e3bb9552514bfcb6",
  "baselineTree": "afac613fe989745811042cdda3e735bb37705c0c",
  "currentSha256": "45948e148264e1941ff1d91c5b5a3dc27bbbc880cd6c1108f9cfcd966fd234c7",
  "currentBlob": "2619c5cdfd7dc5eb4c36cf311593d98141d83df3",
  "currentBytes": 45295,
  "baselineSha256": "0c7d1202e9b1eb86ec144451cdf28e81ebc8784648c0ab27aa43513d1625d989",
  "baselineBlob": "0773ce2a68874504490d6301f896c2b908f14656",
  "baselineBytes": 44705,
  "contextLines": 3,
  "inverses": [
    {
      "current": "// Closed pure-control fixtures. Historical source execution never admits the current release.\nimport {enterpriseOverRootSourceBaseline,ENTERPRISE_OVER_ROOT_SOURCE_DOMAINS,ENTERPRISE_OVER_ROOT_IDENTITY_SOURCES} from '../../tools/enterprise-current-source-compatibility.js';\nimport { economyReleaseSource } from '../../tools/economy-release-composition.js';\nimport { releaseSourceBaseline } from '../../tools/release-source-transfer.js';\nimport { fourthBatchSourceBaseline } from '../../tools/rc1-fourth-batch-source-compatibility.js';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\n",
      "baseline": "// Closed pure-control fixtures. Historical source execution never admits the current release.\nimport {enterpriseOverRootSourceBaseline,ENTERPRISE_OVER_ROOT_SOURCE_DOMAINS,ENTERPRISE_OVER_ROOT_IDENTITY_SOURCES} from '../../tools/enterprise-current-source-compatibility.js';\nimport { economyReleaseSource } from '../../tools/economy-release-composition.js';\nimport { fourthBatchSourceBaseline } from '../../tools/rc1-fourth-batch-source-compatibility.js';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\n"
    },
    {
      "current": "}\nfunction fixtureRead(candidate, options) {\n  const file = relative(candidate);\n  if (file === 'public/genesis-deploy-client.js') {\n    // Inspect this exact current public source through its closed predecessor projections only.\n    const raw = originalRead(candidate, 'utf8');\n    const text = releaseSourceBaseline(file, economyHardeningSourceBaseline(file, raw));\n    const bytes = Buffer.from(text);\n    const encoding = typeof options === 'string' ? options : options?.encoding;\n    return encoding ? bytes.toString(encoding) : bytes;\n  }\n  if (!file?.startsWith('src/') && !file?.startsWith('data/') && file !== 'schema.sql') return originalRead(candidate, options);\n  const bytes = historical(file);\n  const encoding = typeof options === 'string' ? options : options?.encoding;\n",
      "baseline": "}\nfunction fixtureRead(candidate, options) {\n  const file = relative(candidate);\n  if (!file?.startsWith('src/') && !file?.startsWith('data/') && file !== 'schema.sql') return originalRead(candidate, options);\n  const bytes = historical(file);\n  const encoding = typeof options === 'string' ? options : options?.encoding;\n"
    },
    {
      "current": "  fs.readFileSync = fixtureRead;\n  fs.promises.readFile = async (candidate, options) => {\n    const file = relative(candidate);\n    return file?.startsWith('src/') || file?.startsWith('data/') || file === 'schema.sql' || file === 'public/genesis-deploy-client.js' ? fixtureRead(candidate, options) : originalPromiseRead(candidate, options);\n  };\n  syncBuiltinESMExports();\n  try {\n",
      "baseline": "  fs.readFileSync = fixtureRead;\n  fs.promises.readFile = async (candidate, options) => {\n    const file = relative(candidate);\n    return file?.startsWith('src/') || file?.startsWith('data/') || file === 'schema.sql' ? fixtureRead(candidate, options) : originalPromiseRead(candidate, options);\n  };\n  syncBuiltinESMExports();\n  try {\n"
    }
  ]
};
export const GENESIS_HISTORICAL_READER_BINDING_SHA256 = '39139963a632b69632b5424b0fd31876ae7bf5645e80cfa4445cb4e0af6cc464';
for (const inverse of GENESIS_HISTORICAL_READER_BINDING.inverses) Object.freeze(inverse);
Object.freeze(GENESIS_HISTORICAL_READER_BINDING.inverses); Object.freeze(GENESIS_HISTORICAL_READER_BINDING);
const lf = text => text.replaceAll('\r\n', '\n');
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
const uniform = text => typeof text === 'string' && !lf(text).includes('\r')
  && (text === lf(text) || text === lf(text).replaceAll('\n', '\r\n'));

export function assertGenesisHistoricalReaderSourceTransfer(file, input) {
  const pin = GENESIS_HISTORICAL_READER_BINDING;
  assert.equal(file, pin.file, 'Closed historical genesis reader source domain');
  assert.equal(sha(JSON.stringify(pin)), GENESIS_HISTORICAL_READER_BINDING_SHA256);
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'Lossless UTF-8 source required');
  assert(uniform(text), 'Uniform whole LF/CRLF source required');
  assert(!text.includes('\ufeff') && !text.includes('\0'), 'No BOM or NUL source');
  const current = lf(text);
  assert.equal(sha(current), pin.currentSha256, 'Complete historical genesis reader source drift');
  assert.equal(blob(current), pin.currentBlob); assert.equal(Buffer.byteLength(current), pin.currentBytes);
  let baselineText = current, previousEnd = -1;
  assert.equal(pin.inverses.length, 3);
  for (const inverse of pin.inverses) {
    assert(inverse.current.length > 0);
    assert.equal(current.split(inverse.current).length - 1, 1, 'Unique complete reader inverse required');
    const at = current.indexOf(inverse.current); assert(at >= previousEnd); previousEnd = at + inverse.current.length;
    assert.equal(baselineText.split(inverse.current).length - 1, 1);
    baselineText = baselineText.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(sha(baselineText), pin.baselineSha256, 'Complete historical genesis reader predecessor drift');
  assert.equal(blob(baselineText), pin.baselineBlob); assert.equal(Buffer.byteLength(baselineText), pin.baselineBytes);
  return Object.freeze({ file, baselineText, baselineRevision: pin.baselineRevision,
    actualSha256: pin.currentSha256, baselineSha256: pin.baselineSha256, inverseChunks: 3,
    phase: 'exact historical fixture source inspection only', sourceOnly: true, runtime: false, native: false });
}

export function genesisHistoricalReaderHistoricalInput(file, input) {
  if (file !== GENESIS_HISTORICAL_READER_BINDING.file) return input;
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'Lossless UTF-8 source required');
  if (!uniform(text) || sha(lf(text)) !== GENESIS_HISTORICAL_READER_BINDING.currentSha256) return input;
  const baseline = assertGenesisHistoricalReaderSourceTransfer(file, text).baselineText;
  return buffer ? Buffer.from(baseline) : baseline;
}
