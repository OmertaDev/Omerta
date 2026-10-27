// Explicit maintainer tool. Generation never runs from runtime, tests, or a source guard.
// The emitted envelope reconstructs exact predecessor source only; it grants no release clearance.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const revision = '3d1e7efade73521910494dcfdb66590e70b95140';
const predecessor = '62bee23255516ba3e5b05a6b27e8a0475e3a7895';
const files = Object.freeze([
  '.github/workflows/economy-hardening.yml',
  'BALANCE.md',
  'docs/WIKI.md',
  'package-lock.json',
  'package.json',
  'public/wiki.html',
  'render.yaml',
  'schema.sql',
  'src/db.js',
  'src/growth.js',
  'src/rules.tail.js',
  'src/verify.js',
  'test/city-home-migration.js',
  'test/db-boot-lock-postgres.js',
  'test/gates.js',
  'test/growth.js',
  'test/levers.js',
  'test/migrate.js',
  'test/social-receipt-postgres.js',
  'test/worldgraph-api.js',
  'tools/pgquery.js',
  'tools/ux-release-phase2-native-catalog.js',
]);
const additions = new Set(['test/db-boot-lock-postgres.js', 'test/social-receipt-postgres.js']);
const lf = text => text.replaceAll('\r\n', '\n');
const git = (...args) => lf(execFileSync('git', ['--no-replace-objects', ...args], {
  encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024,
  stdio: ['ignore', 'pipe', 'pipe'],
}));
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1')
  .update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');

assert.equal(process.argv[2], '--write', 'Use --write only for the fixed reviewed social-proof cutover repair');
assert.equal(git('rev-parse', `${revision}^`).trim(), predecessor, 'Authored cutover-repair predecessor changed');
git('merge-base', '--is-ancestor', revision, 'HEAD');
assert.deepEqual(git('diff', '--name-only', predecessor, revision).trim().split('\n'), [...files],
  'Authored cutover repair changed outside its closed source domains');
assert.deepEqual(git('diff', '--diff-filter=A', '--name-only', predecessor, revision).trim().split('\n'),
  [...additions], 'Authored cutover repair additions changed');

const domains = {};
for (const file of files) {
  const current = git('show', `${revision}:${file}`);
  const predecessorEntry = git('ls-tree', predecessor, '--', file).trim();
  const predecessorAbsent = predecessorEntry === '';
  assert.equal(predecessorAbsent, additions.has(file), `Unexpected cutover source addition state: ${file}`);
  const baseline = predecessorAbsent ? null : git('show', `${predecessor}:${file}`);
  if (!predecessorAbsent) assert.notEqual(current, baseline, `Cutover repair has no change: ${file}`);
  const inverses = []; let hunk = null;
  if (!predecessorAbsent) {
    for (const line of git('diff', '--no-ext-diff', '--unified=3', predecessor, revision, '--', file).split('\n')) {
      if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; inverses.push(hunk); }
      else if (hunk && /^[ +\-]/.test(line)) {
        if (line[0] !== '-') hunk.current += `${line.slice(1)}\n`;
        if (line[0] !== '+') hunk.baseline += `${line.slice(1)}\n`;
      }
    }
  }
  let reconstructed = current;
  for (const inverse of inverses) {
    assert(inverse.current.length, `Empty cutover-repair inverse context: ${file}`);
    assert.equal(reconstructed.split(inverse.current).length - 1, 1,
      `Cutover-repair inverse context must occur once: ${file}`);
    reconstructed = reconstructed.replace(inverse.current, () => inverse.baseline);
  }
  if (predecessorAbsent) assert.equal(inverses.length, 0, `Added cutover source has inverse hunks: ${file}`);
  else assert.equal(reconstructed, baseline, `Complete cutover-repair predecessor reconstruction: ${file}`);
  domains[file] = {
    predecessorAbsent,
    mode: git('ls-tree', revision, '--', file).trim().split(/\s+/)[0],
    currentSha256: sha256(current), currentBlob: blob(current), currentBytes: Buffer.byteLength(current),
    baselineSha256: predecessorAbsent ? null : sha256(baseline),
    baselineBlob: predecessorAbsent ? null : blob(baseline),
    baselineBytes: predecessorAbsent ? null : Buffer.byteLength(baseline),
    contextLines: 3, inverses,
  };
}

const tree = git('rev-parse', `${revision}^{tree}`).trim();
const predecessorTree = git('rev-parse', `${predecessor}^{tree}`).trim();
const output = `// Generated exact source-only envelope for the social-proof production cutover repair.
// Historical pins remain unchanged; unknown or non-exact bytes pass through.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

export const ECONOMY_SOCIAL_PROOF_CUTOVER_REVISION = ${JSON.stringify(revision)};
export const ECONOMY_SOCIAL_PROOF_CUTOVER_TREE = ${JSON.stringify(tree)};
export const ECONOMY_SOCIAL_PROOF_CUTOVER_PREDECESSOR = ${JSON.stringify(predecessor)};
export const ECONOMY_SOCIAL_PROOF_CUTOVER_PREDECESSOR_TREE = ${JSON.stringify(predecessorTree)};
export const ECONOMY_SOCIAL_PROOF_CUTOVER_PHASE = 'exact-social-proof-production-cutover-source-transfer-only; no historical runtime, native, migration, financial, activation or deployment clearance';
export const ECONOMY_SOCIAL_PROOF_CUTOVER_DOMAINS = ${JSON.stringify(domains, null, 2)};
for (const pin of Object.values(ECONOMY_SOCIAL_PROOF_CUTOVER_DOMAINS)) {
  for (const inverse of pin.inverses) Object.freeze(inverse);
  Object.freeze(pin.inverses); Object.freeze(pin);
}
Object.freeze(ECONOMY_SOCIAL_PROOF_CUTOVER_DOMAINS);
const lf = text => text.replaceAll('\\r\\n', '\\n');
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\\0').update(text).digest('hex');
const uniform = text => typeof text === 'string' && (text === lf(text) || text === lf(text).replaceAll('\\n', '\\r\\n'));

export function assertEconomySocialProofCutoverSourceTransfer(file, input) {
  assert(Object.hasOwn(ECONOMY_SOCIAL_PROOF_CUTOVER_DOMAINS, file), 'Unknown social-proof cutover source domain');
  assert(uniform(input), 'Uniform whole social-proof cutover LF/CRLF source text required');
  const pin = ECONOMY_SOCIAL_PROOF_CUTOVER_DOMAINS[file], text = lf(input);
  assert.equal(sha256(text), pin.currentSha256, 'Complete social-proof cutover source drift: ' + file);
  assert.equal(blob(text), pin.currentBlob, 'Complete social-proof cutover blob drift: ' + file);
  assert.equal(Buffer.byteLength(text), pin.currentBytes);
  if (pin.predecessorAbsent) {
    assert.equal(pin.baselineSha256, null); assert.equal(pin.baselineBlob, null);
    assert.equal(pin.baselineBytes, null); assert.equal(pin.inverses.length, 0);
    return { file, baselineText: null, predecessorAbsent: true, postimageSha256: pin.currentSha256,
      sourceRevision: ECONOMY_SOCIAL_PROOF_CUTOVER_REVISION,
      predecessorRevision: ECONOMY_SOCIAL_PROOF_CUTOVER_PREDECESSOR,
      inverseChunks: 0, phase: ECONOMY_SOCIAL_PROOF_CUTOVER_PHASE,
      sourceOnly: true, runtime: false, native: false };
  }
  let baselineText = text;
  for (const inverse of pin.inverses) {
    assert(inverse.current.length);
    assert.equal(baselineText.split(inverse.current).length - 1, 1,
      'Missing or duplicate social-proof cutover inverse: ' + file);
    baselineText = baselineText.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(sha256(baselineText), pin.baselineSha256,
    'Complete social-proof cutover predecessor source mismatch: ' + file);
  assert.equal(blob(baselineText), pin.baselineBlob,
    'Complete social-proof cutover predecessor blob mismatch: ' + file);
  assert.equal(Buffer.byteLength(baselineText), pin.baselineBytes);
  return { file, baselineText, predecessorAbsent: false, postimageSha256: pin.currentSha256,
    sourceRevision: ECONOMY_SOCIAL_PROOF_CUTOVER_REVISION,
    predecessorRevision: ECONOMY_SOCIAL_PROOF_CUTOVER_PREDECESSOR,
    inverseChunks: pin.inverses.length, phase: ECONOMY_SOCIAL_PROOF_CUTOVER_PHASE,
    sourceOnly: true, runtime: false, native: false };
}

export function economySocialProofCutoverHistoricalInput(file, input) {
  if (!Object.hasOwn(ECONOMY_SOCIAL_PROOF_CUTOVER_DOMAINS, file)) return input;
  const pin = ECONOMY_SOCIAL_PROOF_CUTOVER_DOMAINS[file];
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input),
    'Lossless UTF-8 physical source only; lossless UTF-8 required');
  if (!uniform(text) || sha256(lf(text)) !== pin.currentSha256 || pin.predecessorAbsent) return input;
  const baseline = assertEconomySocialProofCutoverSourceTransfer(file, text).baselineText;
  return buffer ? Buffer.from(baseline) : baseline;
}
`;
fs.writeFileSync(new URL('./economy-social-proof-cutover-source-transfer.js', import.meta.url), output);
console.log(`Generated ${files.length} exact social-proof production-cutover source domains.`);
