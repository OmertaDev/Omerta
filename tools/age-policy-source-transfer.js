// Exact 21+ policy source projection only; actual runtime retains the current policy.
// Historical qualifiers stay unchanged. This grants no runtime, native or deployment clearance.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

export const AGE_POLICY_SERVER_BINDING = {
  "file": "src/server.js",
  "mode": "100644",
  "sourceRevision": "f4474d358e8c9feddcd01deaadf77c1a67ace9cb",
  "sourceChangeRevision": "837f0e45558be03d65b8a4584018c20ff7f69dbc",
  "sourceParentRevision": "a24df18ea1a0b57f25df942675dd9fef7415f275",
  "baselineRevision": "019be25da3396d143b09a5b7ded945334a1337c8",
  "currentSha256": "eae571fecd106622365194b2fd862f54635a9488ea9784d660defa292da28b5a",
  "currentBlob": "9ac86b5b025e3a40f0142f8adf855471e8a21e77",
  "currentBytes": 303757,
  "baselineSha256": "f0fba7a89de112aa2c85e61955cd2b36eb6387605f46696ef1290d442d14615e",
  "baselineBlob": "98be176eb2d676e3eaa1992da787c76cb15acb00",
  "baselineBytes": 303719,
  "contextLines": 3,
  "inverses": [
    {
      "current": "import crypto from 'node:crypto';\nimport { rescueQuote } from './rescue-quote.js';\nimport { clientIpContextForRequest } from './client-ip.js';\nimport { MINIMUM_AGE, eligibleBirthDate, ageCookie, ageStatus, requireAge } from './age.js';\nimport zlib from 'node:zlib';\nimport { makeDb } from './db.js';\nimport { createCityActivityRegistry, readCityActivityActor, cityOwnerActivityCategory } from './city-activity.js';\n",
      "baseline": "import crypto from 'node:crypto';\nimport { rescueQuote } from './rescue-quote.js';\nimport { clientIpContextForRequest } from './client-ip.js';\nimport { eligibleBirthDate, ageCookie, ageStatus, requireAge } from './age.js';\nimport zlib from 'node:zlib';\nimport { makeDb } from './db.js';\nimport { createCityActivityRegistry, readCityActivityActor, cityOwnerActivityCategory } from './city-activity.js';\n"
    },
    {
      "current": "  app.post('/v1/age-check', async (req, reply) => {\n    reply.header('Cache-Control', 'no-store');\n    const eligible = ageStatus(app, req) === false ? false : eligibleBirthDate(req.body?.birthDate);\n    const cookie = app.jwt.sign({ purpose: 'age-check', minimumAge: MINIMUM_AGE, eligible }, { expiresIn: '15m' });\n    reply.header('Set-Cookie', ageCookie(cookie));\n    if (!eligible) return reply.code(403).send({ error: 'age_ineligible', message: 'Account creation is unavailable. See /privacy for help.' });\n    return { ok: true };\n",
      "baseline": "  app.post('/v1/age-check', async (req, reply) => {\n    reply.header('Cache-Control', 'no-store');\n    const eligible = ageStatus(app, req) === false ? false : eligibleBirthDate(req.body?.birthDate);\n    const cookie = app.jwt.sign({ purpose: 'age-check', eligible }, { expiresIn: '15m' });\n    reply.header('Set-Cookie', ageCookie(cookie));\n    if (!eligible) return reply.code(403).send({ error: 'age_ineligible', message: 'Account creation is unavailable. See /privacy for help.' });\n    return { ok: true };\n"
    }
  ]
};
export const AGE_POLICY_SERVER_BINDING_SHA256 = '20f3eb86d3fbe82523544d32eb3bdf7cc7b7ea7259f37c95315d1206f994af33';
for (const inverse of AGE_POLICY_SERVER_BINDING.inverses) Object.freeze(inverse);
Object.freeze(AGE_POLICY_SERVER_BINDING.inverses); Object.freeze(AGE_POLICY_SERVER_BINDING);
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
const lf = text => text.replaceAll('\r\n', '\n');
const uniform = text => typeof text === 'string' && !lf(text).includes('\r')
  && (text === lf(text) || text === lf(text).replaceAll('\n', '\r\n'));

export function assertAgePolicyServerSourceTransfer(file, input) {
  const pin = AGE_POLICY_SERVER_BINDING;
  assert.equal(file, pin.file, 'Closed age-policy server source domain');
  assert.equal(sha(JSON.stringify(pin)), AGE_POLICY_SERVER_BINDING_SHA256);
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'Lossless UTF-8 source required');
  assert(uniform(text), 'Uniform whole LF/CRLF source required');
  assert(!text.includes('\ufeff') && !text.includes('\0'), 'No BOM or NUL source');
  const current = lf(text);
  assert.equal(sha(current), pin.currentSha256, 'Complete age-policy server source drift');
  assert.equal(blob(current), pin.currentBlob); assert.equal(Buffer.byteLength(current), pin.currentBytes);
  let baselineText = current, previousEnd = -1;
  assert.equal(pin.inverses.length, 2);
  for (const inverse of pin.inverses) {
    assert(inverse.current.length > 0);
    assert.equal(current.split(inverse.current).length - 1, 1, 'Unique complete age-policy inverse required');
    const at = current.indexOf(inverse.current); assert(at >= previousEnd); previousEnd = at + inverse.current.length;
    assert.equal(baselineText.split(inverse.current).length - 1, 1);
    baselineText = baselineText.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(sha(baselineText), pin.baselineSha256, 'Complete age-policy server preimage drift');
  assert.equal(blob(baselineText), pin.baselineBlob); assert.equal(Buffer.byteLength(baselineText), pin.baselineBytes);
  return Object.freeze({ file, baselineText, sourceRevision: pin.sourceRevision, baselineRevision: pin.baselineRevision,
    inverseChunks: 2, sourceOnly: true, runtime: false, native: false });
}

export function agePolicyServerHistoricalInput(file, input) {
  if (file !== AGE_POLICY_SERVER_BINDING.file) return input;
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'Lossless UTF-8 source required');
  if (!uniform(text) || sha(lf(text)) !== AGE_POLICY_SERVER_BINDING.currentSha256) return input;
  const baseline = assertAgePolicyServerSourceTransfer(file, text).baselineText;
  return buffer ? Buffer.from(baseline) : baseline;
}
