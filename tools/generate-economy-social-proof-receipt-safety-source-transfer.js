// Explicit maintainer tool. Generation never runs from runtime, tests, or a source guard.
// The emitted envelope reconstructs exact predecessor source only; it grants no release clearance.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const revision = '95a581119a7dd7c43e843d6c5b51363b902c3b74';
const predecessor = '7f070a5b09bd24ada8e27f6f6450970fc93a9e1e';
const files = Object.freeze([
  'schema.sql',
  'src/accountdaily.js',
  'src/db.js',
  'src/growth.js',
  'test/gates.js',
  'test/growth.js',
  'test/sweeps.js',
  'tools/commerce-deed-release-phase2-native-catalog.js',
  'tools/economy-social-proof-receipt-source-transfer.js',
  'tools/generate-economy-social-proof-receipt-source-transfer.js',
]);
const lf = text => text.replaceAll('\r\n', '\n');
const git = (...args) => lf(execFileSync('git', ['--no-replace-objects', ...args], {
  encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024,
  stdio: ['ignore', 'pipe', 'pipe'],
}));
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1')
  .update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');

assert.equal(process.argv[2], '--write', 'Use --write only for the fixed reviewed social-receipt safety repair');
assert.equal(git('rev-parse', `${revision}^`).trim(), predecessor, 'Authored receipt-safety predecessor changed');
git('merge-base', '--is-ancestor', revision, 'HEAD');
assert.deepEqual(git('diff', '--name-only', predecessor, revision).trim().split('\n'), [...files],
  'Authored receipt-safety repair changed outside its closed source domains');

const domains = {};
for (const file of files) {
  const current = git('show', `${revision}:${file}`), baseline = git('show', `${predecessor}:${file}`);
  assert.notEqual(current, baseline, `Receipt-safety repair has no change: ${file}`);
  const inverses = []; let hunk = null;
  for (const line of git('diff', '--no-ext-diff', '--unified=3', predecessor, revision, '--', file).split('\n')) {
    if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; inverses.push(hunk); }
    else if (hunk && /^[ +\-]/.test(line)) {
      if (line[0] !== '-') hunk.current += `${line.slice(1)}\n`;
      if (line[0] !== '+') hunk.baseline += `${line.slice(1)}\n`;
    }
  }
  let reconstructed = current;
  for (const inverse of inverses) {
    assert(inverse.current.length, `Empty receipt-safety inverse context: ${file}`);
    assert.equal(reconstructed.split(inverse.current).length - 1, 1,
      `Receipt-safety inverse context must occur once: ${file}`);
    reconstructed = reconstructed.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(reconstructed, baseline, `Complete receipt-safety predecessor reconstruction: ${file}`);
  domains[file] = {
    mode: git('ls-tree', revision, '--', file).trim().split(/\s+/)[0],
    currentSha256: sha256(current), currentBlob: blob(current), currentBytes: Buffer.byteLength(current),
    baselineSha256: sha256(baseline), baselineBlob: blob(baseline), baselineBytes: Buffer.byteLength(baseline),
    contextLines: 3, inverses,
  };
}

const tree = git('rev-parse', `${revision}^{tree}`).trim();
const predecessorTree = git('rev-parse', `${predecessor}^{tree}`).trim();
const output = `// Generated exact source-only envelope for the social-proof receipt safety repair.
// Historical pins remain unchanged; unknown or non-exact bytes pass through.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

export const ECONOMY_SOCIAL_RECEIPT_SAFETY_REVISION = ${JSON.stringify(revision)};
export const ECONOMY_SOCIAL_RECEIPT_SAFETY_TREE = ${JSON.stringify(tree)};
export const ECONOMY_SOCIAL_RECEIPT_SAFETY_PREDECESSOR = ${JSON.stringify(predecessor)};
export const ECONOMY_SOCIAL_RECEIPT_SAFETY_PREDECESSOR_TREE = ${JSON.stringify(predecessorTree)};
export const ECONOMY_SOCIAL_RECEIPT_SAFETY_PHASE = 'exact-social-proof-receipt-safety-source-transfer-only; no historical runtime, native, migration, financial, activation or deployment clearance';
export const ECONOMY_SOCIAL_RECEIPT_SAFETY_DOMAINS = ${JSON.stringify(domains, null, 2)};
for (const pin of Object.values(ECONOMY_SOCIAL_RECEIPT_SAFETY_DOMAINS)) {
  for (const inverse of pin.inverses) Object.freeze(inverse);
  Object.freeze(pin.inverses); Object.freeze(pin);
}
Object.freeze(ECONOMY_SOCIAL_RECEIPT_SAFETY_DOMAINS);
const lf = text => text.replaceAll('\\r\\n', '\\n');
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\\0').update(text).digest('hex');
const uniform = text => typeof text === 'string' && (text === lf(text) || text === lf(text).replaceAll('\\n', '\\r\\n'));

export function assertEconomySocialReceiptSafetySourceTransfer(file, input) {
  assert(Object.hasOwn(ECONOMY_SOCIAL_RECEIPT_SAFETY_DOMAINS, file), 'Unknown receipt-safety repair source domain');
  assert(uniform(input), 'Uniform whole receipt-safety repair LF/CRLF source text required');
  const pin = ECONOMY_SOCIAL_RECEIPT_SAFETY_DOMAINS[file], text = lf(input);
  assert.equal(sha256(text), pin.currentSha256, 'Complete receipt-safety repair source drift: ' + file);
  assert.equal(blob(text), pin.currentBlob, 'Complete receipt-safety repair blob drift: ' + file);
  assert.equal(Buffer.byteLength(text), pin.currentBytes);
  let baselineText = text;
  for (const inverse of pin.inverses) {
    assert(inverse.current.length);
    assert.equal(baselineText.split(inverse.current).length - 1, 1,
      'Missing or duplicate receipt-safety repair inverse: ' + file);
    baselineText = baselineText.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(sha256(baselineText), pin.baselineSha256,
    'Complete receipt-safety repair predecessor source mismatch: ' + file);
  assert.equal(blob(baselineText), pin.baselineBlob,
    'Complete receipt-safety repair predecessor blob mismatch: ' + file);
  assert.equal(Buffer.byteLength(baselineText), pin.baselineBytes);
  return { file, baselineText, postimageSha256: pin.currentSha256,
    sourceRevision: ECONOMY_SOCIAL_RECEIPT_SAFETY_REVISION,
    predecessorRevision: ECONOMY_SOCIAL_RECEIPT_SAFETY_PREDECESSOR,
    inverseChunks: pin.inverses.length, phase: ECONOMY_SOCIAL_RECEIPT_SAFETY_PHASE,
    sourceOnly: true, runtime: false, native: false };
}

export function economySocialReceiptSafetyHistoricalInput(file, input) {
  if (!Object.hasOwn(ECONOMY_SOCIAL_RECEIPT_SAFETY_DOMAINS, file)) return input;
  const pin = ECONOMY_SOCIAL_RECEIPT_SAFETY_DOMAINS[file];
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'Lossless UTF-8 physical source only');
  if (!uniform(text) || sha256(lf(text)) !== pin.currentSha256) return input;
  const baseline = assertEconomySocialReceiptSafetySourceTransfer(file, text).baselineText;
  return buffer ? Buffer.from(baseline) : baseline;
}
`;
fs.writeFileSync(new URL('./economy-social-proof-receipt-safety-source-transfer.js', import.meta.url), output);
console.log(`Generated ${files.length} exact social-proof receipt safety source domains.`);
