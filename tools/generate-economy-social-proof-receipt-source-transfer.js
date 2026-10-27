// Explicit maintainer tool. Generation never runs from runtime, tests, or a source guard.
// The emitted envelope reconstructs exact predecessor source only; it grants no release clearance.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const revision = '5318589c8e8fd7fa64e6e714e6f69111fb0dca0a';
const predecessor = '011930200e9f4266d92b7a8f77646013d96b697b';
const files = Object.freeze(['src/db.js', 'src/growth.js', 'test/growth.js', 'test/sweeps.js']);
const lf = text => text.replaceAll('\r\n', '\n');
const git = (...args) => lf(execFileSync('git', ['--no-replace-objects', ...args], {
  encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024,
  stdio: ['ignore', 'pipe', 'pipe'],
}));
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1')
  .update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');

assert.equal(process.argv[2], '--write', 'Use --write only for the fixed reviewed social-receipt repair');
assert.equal(git('rev-parse', `${revision}^`).trim(), predecessor, 'Authored repair predecessor changed');
git('merge-base', '--is-ancestor', revision, 'HEAD');
assert.deepEqual(git('diff', '--name-only', predecessor, revision).trim().split('\n'), [...files],
  'Authored social-receipt repair changed outside its closed source domains');

const domains = {};
for (const file of files) {
  const current = git('show', `${revision}:${file}`), baseline = git('show', `${predecessor}:${file}`);
  assert.notEqual(current, baseline, `Social-receipt repair has no change: ${file}`);
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
    assert(inverse.current.length, `Empty social-receipt inverse context: ${file}`);
    assert.equal(reconstructed.split(inverse.current).length - 1, 1,
      `Social-receipt inverse context must occur once: ${file}`);
    reconstructed = reconstructed.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(reconstructed, baseline, `Complete social-receipt predecessor reconstruction: ${file}`);
  domains[file] = {
    mode: git('ls-tree', revision, '--', file).trim().split(/\s+/)[0],
    currentSha256: sha256(current), currentBlob: blob(current), currentBytes: Buffer.byteLength(current),
    baselineSha256: sha256(baseline), baselineBlob: blob(baseline), baselineBytes: Buffer.byteLength(baseline),
    contextLines: 3, inverses,
  };
}

const tree = git('rev-parse', `${revision}^{tree}`).trim();
const predecessorTree = git('rev-parse', `${predecessor}^{tree}`).trim();
const output = `// Generated exact source-only envelope for the social-proof receipt retention repair.
// Historical pins remain unchanged; unknown or non-exact bytes pass through.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

export const ECONOMY_SOCIAL_RECEIPT_REVISION = ${JSON.stringify(revision)};
export const ECONOMY_SOCIAL_RECEIPT_TREE = ${JSON.stringify(tree)};
export const ECONOMY_SOCIAL_RECEIPT_PREDECESSOR = ${JSON.stringify(predecessor)};
export const ECONOMY_SOCIAL_RECEIPT_PREDECESSOR_TREE = ${JSON.stringify(predecessorTree)};
export const ECONOMY_SOCIAL_RECEIPT_PHASE = 'exact-social-proof-receipt-retention-source-transfer-only; no historical runtime, native, migration, financial, activation or deployment clearance';
export const ECONOMY_SOCIAL_RECEIPT_DOMAINS = ${JSON.stringify(domains, null, 2)};
for (const pin of Object.values(ECONOMY_SOCIAL_RECEIPT_DOMAINS)) {
  for (const inverse of pin.inverses) Object.freeze(inverse);
  Object.freeze(pin.inverses); Object.freeze(pin);
}
Object.freeze(ECONOMY_SOCIAL_RECEIPT_DOMAINS);
const lf = text => text.replaceAll('\\r\\n', '\\n');
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\\0').update(text).digest('hex');
const uniform = text => typeof text === 'string' && (text === lf(text) || text === lf(text).replaceAll('\\n', '\\r\\n'));

export function assertEconomySocialReceiptSourceTransfer(file, input) {
  assert(Object.hasOwn(ECONOMY_SOCIAL_RECEIPT_DOMAINS, file), 'Unknown social-receipt repair source domain');
  assert(uniform(input), 'Uniform whole social-receipt repair LF/CRLF source text required');
  const pin = ECONOMY_SOCIAL_RECEIPT_DOMAINS[file], text = lf(input);
  assert.equal(sha256(text), pin.currentSha256, 'Complete social-receipt repair source drift: ' + file);
  assert.equal(blob(text), pin.currentBlob, 'Complete social-receipt repair blob drift: ' + file);
  assert.equal(Buffer.byteLength(text), pin.currentBytes);
  let baselineText = text;
  for (const inverse of pin.inverses) {
    assert(inverse.current.length);
    assert.equal(baselineText.split(inverse.current).length - 1, 1,
      'Missing or duplicate social-receipt repair inverse: ' + file);
    baselineText = baselineText.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(sha256(baselineText), pin.baselineSha256,
    'Complete social-receipt repair predecessor source mismatch: ' + file);
  assert.equal(blob(baselineText), pin.baselineBlob,
    'Complete social-receipt repair predecessor blob mismatch: ' + file);
  assert.equal(Buffer.byteLength(baselineText), pin.baselineBytes);
  return { file, baselineText, postimageSha256: pin.currentSha256,
    sourceRevision: ECONOMY_SOCIAL_RECEIPT_REVISION,
    predecessorRevision: ECONOMY_SOCIAL_RECEIPT_PREDECESSOR,
    inverseChunks: pin.inverses.length, phase: ECONOMY_SOCIAL_RECEIPT_PHASE,
    sourceOnly: true, runtime: false, native: false };
}

export function economySocialReceiptHistoricalInput(file, input) {
  const pin = ECONOMY_SOCIAL_RECEIPT_DOMAINS[file];
  if (!pin) return input;
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'Lossless UTF-8 physical source only');
  if (!uniform(text) || sha256(lf(text)) !== pin.currentSha256) return input;
  const baseline = assertEconomySocialReceiptSourceTransfer(file, text).baselineText;
  return buffer ? Buffer.from(baseline) : baseline;
}
`;
fs.writeFileSync(new URL('./economy-social-proof-receipt-source-transfer.js', import.meta.url), output);
console.log(`Generated ${files.length} exact social-proof receipt repair source domains.`);
