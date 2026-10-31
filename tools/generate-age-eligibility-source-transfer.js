// Explicit maintainer tool. Generation never runs from runtime, tests, or a source guard.
// The emitted envelope reconstructs exact predecessor source only; it grants no release clearance.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const revision = '837f0e45558be03d65b8a4584018c20ff7f69dbc';
const predecessor = 'a24df18ea1a0b57f25df942675dd9fef7415f275';
const files = Object.freeze(['docs/legal-security-setup.md', 'omerta-mcp/README.md', 'src/age.js',
  'src/legal.js', 'src/server.js', 'test/age.js', 'test/legal-security.js']);
const lf = text => text.replaceAll('\r\n', '\n');
const git = (...args) => lf(execFileSync('git', ['--no-replace-objects', ...args], {
  encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024,
  stdio: ['ignore', 'pipe', 'pipe'],
}));
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1')
  .update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');

assert.equal(process.argv[2], '--write',
  'Use --write only for the fixed reviewed age-eligibility policy update');
assert.equal(git('rev-parse', `${revision}^`).trim(), predecessor,
  'Authored age-eligibility hardening predecessor changed');
git('merge-base', '--is-ancestor', revision, 'HEAD');
assert.deepEqual(git('diff', '--name-only', predecessor, revision).trim().split('\n'), [...files],
  'Authored age-eligibility hardening changed outside its closed source domains');

const domains = {};
for (const file of files) {
  const current = git('show', `${revision}:${file}`), baseline = git('show', `${predecessor}:${file}`);
  assert.notEqual(current, baseline, `Age-eligibility hardening has no change: ${file}`);
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
    assert(inverse.current.length, `Empty age-eligibility hardening inverse context: ${file}`);
    assert.equal(reconstructed.split(inverse.current).length - 1, 1,
      `Age-eligibility hardening inverse context must occur once: ${file}`);
    reconstructed = reconstructed.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(reconstructed, baseline, `Complete age-eligibility predecessor reconstruction: ${file}`);
  domains[file] = {
    mode: git('ls-tree', revision, '--', file).trim().split(/\s+/)[0],
    currentSha256: sha256(current), currentBlob: blob(current), currentBytes: Buffer.byteLength(current),
    baselineSha256: sha256(baseline), baselineBlob: blob(baseline), baselineBytes: Buffer.byteLength(baseline),
    contextLines: 3, inverses,
  };
}

const tree = git('rev-parse', `${revision}^{tree}`).trim();
const predecessorTree = git('rev-parse', `${predecessor}^{tree}`).trim();
const output = `// Generated exact source-only envelope for age-eligibility policy update.
// Historical pins remain unchanged; unknown or non-exact bytes pass through.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

export const AGE_ELIGIBILITY_SOURCE_REVISION = ${JSON.stringify(revision)};
export const AGE_ELIGIBILITY_SOURCE_TREE = ${JSON.stringify(tree)};
export const AGE_ELIGIBILITY_SOURCE_PREDECESSOR = ${JSON.stringify(predecessor)};
export const AGE_ELIGIBILITY_SOURCE_PREDECESSOR_TREE = ${JSON.stringify(predecessorTree)};
export const AGE_ELIGIBILITY_SOURCE_PHASE = 'exact-age-eligibility-policy-update-source-transfer-only; no historical runtime, native, migration, financial, activation or deployment clearance';
export const AGE_ELIGIBILITY_SOURCE_DOMAINS = ${JSON.stringify(domains, null, 2)};
for (const pin of Object.values(AGE_ELIGIBILITY_SOURCE_DOMAINS)) {
  for (const inverse of pin.inverses) Object.freeze(inverse);
  Object.freeze(pin.inverses); Object.freeze(pin);
}
Object.freeze(AGE_ELIGIBILITY_SOURCE_DOMAINS);
const lf = text => text.replaceAll('\\r\\n', '\\n');
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\\0').update(text).digest('hex');
const uniform = text => typeof text === 'string' && (text === lf(text) || text === lf(text).replaceAll('\\n', '\\r\\n'));

export function assertAgeEligibilitySourceTransfer(file, input) {
  assert(Object.hasOwn(AGE_ELIGIBILITY_SOURCE_DOMAINS, file),
    'Unknown age-eligibility hardening source domain');
  assert(uniform(input), 'Uniform whole age-eligibility hardening LF/CRLF source text required');
  const pin = AGE_ELIGIBILITY_SOURCE_DOMAINS[file], text = lf(input);
  assert.equal(sha256(text), pin.currentSha256, 'Complete age-eligibility hardening source drift: ' + file);
  assert.equal(blob(text), pin.currentBlob, 'Complete age-eligibility hardening blob drift: ' + file);
  assert.equal(Buffer.byteLength(text), pin.currentBytes);
  let baselineText = text;
  for (const inverse of pin.inverses) {
    assert(inverse.current.length);
    assert.equal(baselineText.split(inverse.current).length - 1, 1,
      'Missing or duplicate age-eligibility hardening inverse: ' + file);
    baselineText = baselineText.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(sha256(baselineText), pin.baselineSha256,
    'Complete age-eligibility hardening predecessor source mismatch: ' + file);
  assert.equal(blob(baselineText), pin.baselineBlob,
    'Complete age-eligibility hardening predecessor blob mismatch: ' + file);
  assert.equal(Buffer.byteLength(baselineText), pin.baselineBytes);
  return Object.freeze({ file, baselineText, postimageSha256: pin.currentSha256,
    sourceRevision: AGE_ELIGIBILITY_SOURCE_REVISION,
    predecessorRevision: AGE_ELIGIBILITY_SOURCE_PREDECESSOR,
    inverseChunks: pin.inverses.length, phase: AGE_ELIGIBILITY_SOURCE_PHASE,
    sourceOnly: true, runtime: false, native: false });
}

export function ageEligibilityHistoricalInput(file, input) {
  if (!Object.hasOwn(AGE_ELIGIBILITY_SOURCE_DOMAINS, file)) return input;
  const pin = AGE_ELIGIBILITY_SOURCE_DOMAINS[file];
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'Lossless UTF-8 physical source only');
  if (!uniform(text) || sha256(lf(text)) !== pin.currentSha256) return input;
  const baseline = assertAgeEligibilitySourceTransfer(file, text).baselineText;
  return buffer ? Buffer.from(baseline) : baseline;
}
`;
fs.writeFileSync(new URL('./age-eligibility-source-transfer.js', import.meta.url), output);
console.log(`Generated ${files.length} exact age-eligibility hardening source domains.`);
