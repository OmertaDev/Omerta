// Source comparisons only. Both sides must have the complete reviewed Git identity.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { integratedEconomicSource, integratedEconomicSourceDigest } from './integrated-economic-parent-data.js';
import { ciDeedRecoveryHistoricalInput } from './ci-deed-recovery-source-transfer.js';

export { integratedEconomicSource };
const sha = text => createHash('sha256').update(text).digest('hex');
function freeze(object) {
  for (const child of Object.values(object)) if (child && typeof child === 'object') freeze(child);
  return Object.freeze(object);
}
freeze(integratedEconomicSource);
if (integratedEconomicSource.revision)
  assert.equal(sha(JSON.stringify(integratedEconomicSource)), integratedEconomicSourceDigest, 'Integration source definition drift');

function check(text, pin) {
  assert.equal(Buffer.byteLength(text), pin.bytes);
  assert.equal(sha(text), pin.sha256);
  assert.equal(createHash('sha1').update('blob ' + pin.bytes + '\0').update(text).digest('hex'), pin.blob);
}

export function integratedEconomicParentInput(file, input, profile) {
  assert(profile === 'main' || profile === 'economic', 'Explicit reviewed source comparison parent required');
  const table = integratedEconomicSource.files;
  if (typeof file !== 'string' || !Object.hasOwn(table, file)) return input;
  const row = table[file], target = row.parents[profile];
  if (!target) return input;
  input = ciDeedRecoveryHistoricalInput(file, input);
  const bytes = Buffer.isBuffer(input), text = bytes ? input.toString('utf8') : input;
  if (bytes) assert(Buffer.from(text).equals(input), 'Lossless UTF-8 physical source only; lossless UTF-8 required');
  if (typeof text !== 'string') return input;
  const lf = text.replaceAll('\r\n', '\n');
  if (lf.includes('\r') || (lf !== text && lf.replaceAll('\n', '\r\n') !== text) || sha(lf) !== row.current.sha256) return input;
  check(lf, row.current);
  let restored = lf;
  for (const hunk of target.inverses.toReversed()) {
    assert.equal(restored.slice(hunk.at, hunk.at + hunk.current.length), hunk.current);
    restored = restored.slice(0, hunk.at) + hunk.baseline + restored.slice(hunk.at + hunk.current.length);
  }
  check(restored, target.pin);
  return bytes ? Buffer.from(restored) : restored;
}
