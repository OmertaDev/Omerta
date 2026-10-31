// Explicit maintainer tool. Never invoked by runtime, tests, or source guards.
// Its exact reconstruction grants source compatibility only, never release clearance.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const revision = process.argv[3];
const predecessor = 'a24df18ea1a0b57f25df942675dd9fef7415f275';
const files = Object.freeze([
  '.github/workflows/economy-hardening.yml', 'package.json', 'schema.sql',
  'src/economy-monitor.js', 'src/game.js', 'src/invariants.js', 'src/worker.js',
  'test/economy-composition-restart.js', 'test/economy-composition.js', 'test/economy-monitor.js',
]);
const additions = new Set(['src/economy-monitor.js', 'test/economy-composition-restart.js', 'test/economy-composition.js', 'test/economy-monitor.js']);
const lf = text => text.replaceAll('\r\n', '\n');
const git = (...args) => lf(execFileSync('git', ['--no-replace-objects', ...args], {
  encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024,
  stdio: ['ignore', 'pipe', 'pipe'],
}));
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1')
  .update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');

assert.equal(process.argv.length, 4, 'Usage: node tools/generate-economy-monitor-source-transfer.js --write <authored-commit>');
assert.equal(process.argv[2], '--write');
assert.match(revision || '', /^[a-f0-9]{40}$/);
assert.equal(git('rev-parse', `${revision}^`).trim(), predecessor, 'Authored economy monitor predecessor changed');
git('merge-base', '--is-ancestor', revision, 'HEAD');
assert.deepEqual(git('diff', '--name-only', predecessor, revision).trim().split('\n'), [...files],
  'Authored economy monitoring and composition change stays in its ten closed domains');
assert.deepEqual(git('diff', '--diff-filter=A', '--name-only', predecessor, revision).trim().split('\n'),
  [...additions], 'Only the four reviewed monitoring/composition sources are added');

const domains = {};
for (const file of files) {
  const current = git('show', `${revision}:${file}`);
  const predecessorAbsent = git('ls-tree', predecessor, '--', file).trim() === '';
  assert.equal(predecessorAbsent, additions.has(file), `Unexpected economy monitor addition state: ${file}`);
  const baseline = predecessorAbsent ? null : git('show', `${predecessor}:${file}`);
  if (!predecessorAbsent) assert.notEqual(current, baseline, `Economy monitor source did not change: ${file}`);
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
    assert(inverse.current.length, `Empty economy monitor inverse context: ${file}`);
    assert.equal(reconstructed.split(inverse.current).length - 1, 1,
      `Economy monitor inverse context occurs once: ${file}`);
    reconstructed = reconstructed.replace(inverse.current, () => inverse.baseline);
  }
  if (predecessorAbsent) assert.equal(inverses.length, 0);
  else assert.equal(reconstructed, baseline, `Complete economy monitor predecessor reconstruction: ${file}`);
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
const output = `// Generated exact source-only envelope for economy monitoring and composition tests.
// Historical pins remain unchanged; unknown or non-exact bytes pass through.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

export const ECONOMY_MONITOR_SOURCE_REVISION = ${JSON.stringify(revision)};
export const ECONOMY_MONITOR_SOURCE_TREE = ${JSON.stringify(tree)};
export const ECONOMY_MONITOR_SOURCE_PREDECESSOR = ${JSON.stringify(predecessor)};
export const ECONOMY_MONITOR_SOURCE_PREDECESSOR_TREE = ${JSON.stringify(predecessorTree)};
export const ECONOMY_MONITOR_SOURCE_PHASE = 'exact-economy-monitor-composition-source-transfer-only; no historical runtime, native, migration, financial, activation or deployment clearance';
export const ECONOMY_MONITOR_SOURCE_DOMAINS = ${JSON.stringify(domains, null, 2)};
for (const pin of Object.values(ECONOMY_MONITOR_SOURCE_DOMAINS)) {
  for (const inverse of pin.inverses) Object.freeze(inverse);
  Object.freeze(pin.inverses); Object.freeze(pin);
}
Object.freeze(ECONOMY_MONITOR_SOURCE_DOMAINS);
const lf = text => text.replaceAll('\\r\\n', '\\n');
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\\0').update(text).digest('hex');
const uniform = text => typeof text === 'string' && !text.startsWith('\\ufeff') && !text.includes('\\0')
  && (text === lf(text) || text === lf(text).replaceAll('\\n', '\\r\\n'));

export function assertEconomyMonitorSourceTransfer(file, input) {
  assert(Object.hasOwn(ECONOMY_MONITOR_SOURCE_DOMAINS, file), 'Unknown economy monitor source domain');
  assert(uniform(input), 'Uniform whole economy monitor LF/CRLF source text required');
  const pin = ECONOMY_MONITOR_SOURCE_DOMAINS[file], text = lf(input);
  assert.equal(sha256(text), pin.currentSha256, 'Complete economy monitor source drift: ' + file);
  assert.equal(blob(text), pin.currentBlob, 'Complete economy monitor blob drift: ' + file);
  assert.equal(Buffer.byteLength(text), pin.currentBytes);
  if (pin.predecessorAbsent) {
    assert.equal(pin.baselineSha256, null); assert.equal(pin.baselineBlob, null);
    assert.equal(pin.baselineBytes, null); assert.equal(pin.inverses.length, 0);
    return Object.freeze({ file, baselineText: null, predecessorAbsent: true, postimageSha256: pin.currentSha256,
      sourceRevision: ECONOMY_MONITOR_SOURCE_REVISION, predecessorRevision: ECONOMY_MONITOR_SOURCE_PREDECESSOR,
      inverseChunks: 0, phase: ECONOMY_MONITOR_SOURCE_PHASE, sourceOnly: true, runtime: false, native: false });
  }
  let baselineText = text;
  for (const inverse of pin.inverses) {
    assert(inverse.current.length);
    assert.equal(baselineText.split(inverse.current).length - 1, 1, 'Missing or duplicate economy monitor inverse: ' + file);
    baselineText = baselineText.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(sha256(baselineText), pin.baselineSha256, 'Complete economy monitor predecessor source mismatch: ' + file);
  assert.equal(blob(baselineText), pin.baselineBlob, 'Complete economy monitor predecessor blob mismatch: ' + file);
  assert.equal(Buffer.byteLength(baselineText), pin.baselineBytes);
  return Object.freeze({ file, baselineText, predecessorAbsent: false, postimageSha256: pin.currentSha256,
    sourceRevision: ECONOMY_MONITOR_SOURCE_REVISION, predecessorRevision: ECONOMY_MONITOR_SOURCE_PREDECESSOR,
    inverseChunks: pin.inverses.length, phase: ECONOMY_MONITOR_SOURCE_PHASE, sourceOnly: true, runtime: false, native: false });
}

export function economyMonitorHistoricalInput(file, input) {
  if (!Object.hasOwn(ECONOMY_MONITOR_SOURCE_DOMAINS, file)) return input;
  const pin = ECONOMY_MONITOR_SOURCE_DOMAINS[file];
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'Lossless UTF-8 physical source only; lossless UTF-8 required');
  if (!uniform(text) || sha256(lf(text)) !== pin.currentSha256 || pin.predecessorAbsent) return input;
  const baseline = assertEconomyMonitorSourceTransfer(file, text).baselineText;
  return buffer ? Buffer.from(baseline) : baseline;
}
`;
fs.writeFileSync(new URL('./economy-monitor-source-transfer.js', import.meta.url), output);
console.log(`Generated ${files.length} exact economy monitor/composition source domains at ${revision}.`);
