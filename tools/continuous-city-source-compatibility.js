// Exact source-only historical fixture bridge. Never used for runtime/native admission.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { xAuthSourceBaseline } from './x-auth-source-compatibility.js';
import { CONTINUOUS_CITY_SOURCE_REVISION, CONTINUOUS_CITY_SOURCE_PREDECESSOR, CONTINUOUS_CITY_SOURCE_DOMAINS } from './continuous-city-source-data.js';
import { CONTINUOUS_CITY_FIXTURE_DOMAINS } from './continuous-city-fixture-source-data.js';
export { CONTINUOUS_CITY_SOURCE_REVISION, CONTINUOUS_CITY_SOURCE_PREDECESSOR, CONTINUOUS_CITY_SOURCE_DOMAINS, CONTINUOUS_CITY_FIXTURE_DOMAINS };
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
function uniform(input) {
  assert.equal(typeof input, 'string', 'Continuous city source must be text');
  assert(!input.includes('\0') && !input.startsWith('\ufeff'), 'Continuous city source has no binary/BOM alias');
  const text = input.replaceAll('\r\n', '\n');
  assert(!text.includes('\r') && (input === text || input === text.replaceAll('\n', '\r\n')), 'Mixed or bare-CR continuous city source endings');
  return text;
}
function prove(file, input, domains) {
  assert(Object.hasOwn(domains, file), 'Unknown continuous city source domain');
  const pin = domains[file], text = uniform(input);
  assert.equal(hash(input), pin.currentRawSha256[input.includes('\r\n') ? 'crlf' : 'lf'], 'Complete continuous city raw source drift: ' + file);
  assert.equal(hash(text), pin.currentSha256, 'Complete continuous city source drift: ' + file);
  assert.equal(blob(text), pin.currentBlob, 'Complete continuous city Git blob drift: ' + file);
  assert.equal(pin.currentMode, '100644', 'Continuous city source mode changed');
  if (pin.predecessorAbsent) {
    assert.equal(pin.baselineSha256, null); assert.equal(pin.baselineBlob, null);
    assert.equal(pin.baselineMode, null); assert.equal(pin.inverses.length, 0);
    return Object.freeze({ sourceOnly: true, native: false, predecessorAbsent: true, baselineText: null });
  }
  assert.equal(pin.baselineMode, '100644', 'Continuous city predecessor mode changed');
  let baselineText = text;
  for (const inverse of pin.inverses) {
    assert(inverse.current && baselineText.split(inverse.current).length === 2, 'Exact continuous city inverse occurs once: ' + file);
    baselineText = baselineText.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(hash(baselineText), pin.baselineSha256, 'Complete continuous city predecessor drift: ' + file);
  assert.equal(blob(baselineText), pin.baselineBlob, 'Complete continuous city predecessor Git blob drift: ' + file);
  return Object.freeze({ sourceOnly: true, native: false, predecessorAbsent: false, baselineText });
}
export function qualifyContinuousCitySource(file, input) { return prove(file, input, CONTINUOUS_CITY_SOURCE_DOMAINS); }
export function qualifyContinuousCityFixtureSource(file, input) { return prove(file, input, CONTINUOUS_CITY_FIXTURE_DOMAINS); }
// Apply only at explicitly adapted physical fixture reads. Unknown paths stay raw for their existing guards.
export function continuousCityHistoricalInput(file, input) {
  const domains = Object.hasOwn(CONTINUOUS_CITY_FIXTURE_DOMAINS, file) ? CONTINUOUS_CITY_FIXTURE_DOMAINS : CONTINUOUS_CITY_SOURCE_DOMAINS;
  if (!Object.hasOwn(domains, file)) return input;
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text, 'utf8').equals(input), 'Continuous city physical input must be lossless UTF-8');
  const proof = prove(file, xAuthSourceBaseline(file, text), domains);
  assert(!proof.predecessorAbsent, 'New continuous city source has no historical fixture: ' + file);
  return buffer ? Buffer.from(proof.baselineText) : proof.baselineText;
}
