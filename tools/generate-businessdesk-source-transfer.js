// Explicit maintainer tool. Generation never runs from runtime, tests, or a source guard.
// The emitted envelope reconstructs exact predecessor source only; it grants no release clearance.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const revision = 'd52232e223bf26355160ad511a711a1f1bc916c1';
const predecessor = 'b35dd222054f0c5f3ca814f228dd7d9a46c58ae9';
const files = Object.freeze(['.github/workflows/ci.yml', 'package.json', 'public/index.html', 'src/server.js']);
const lf = text => text.replaceAll('\r\n', '\n');
const git = (...args) => lf(execFileSync('git', ['--no-replace-objects', ...args], {
  encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024,
  stdio: ['ignore', 'pipe', 'pipe'],
}));
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1')
  .update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');

assert.equal(process.argv[2], '--write',
  'Use --write only for the fixed reviewed business control desk');
git('merge-base', '--is-ancestor', predecessor, revision);
git('merge-base', '--is-ancestor', revision, 'HEAD');
assert.deepEqual(git('diff', '--name-only', predecessor, revision).trim().split('\n'), ['.github/workflows/ci.yml', 'package.json', 'public/business-control-desk.css', 'public/business-control-desk.js', 'public/index.html', 'src/businessdesk.js', 'src/routes/businessdesk.js', 'src/server.js', 'test/business-control-desk-browser.js', 'test/business-control-desk-loop.js', 'test/businessdesk-api.js', 'test/businessdesk.js', 'test/lib/business-control-desk-fixture.js', 'tools/enterprise-native-ux.js'],
  'Authored business desk changed outside its closed source domains');

const domains = {};
for (const file of files) {
  const current = git('show', `${revision}:${file}`), baseline = git('show', `${predecessor}:${file}`);
  assert.notEqual(current, baseline, `Bank-interest hardening has no change: ${file}`);
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
    assert(inverse.current.length, `Empty business desk inverse context: ${file}`);
    assert.equal(reconstructed.split(inverse.current).length - 1, 1,
      `Bank-interest hardening inverse context must occur once: ${file}`);
    reconstructed = reconstructed.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(reconstructed, baseline, `Complete bank-interest predecessor reconstruction: ${file}`);
  domains[file] = {
    mode: git('ls-tree', revision, '--', file).trim().split(/\s+/)[0],
    currentSha256: sha256(current), currentBlob: blob(current), currentBytes: Buffer.byteLength(current),
    baselineSha256: sha256(baseline), baselineBlob: blob(baseline), baselineBytes: Buffer.byteLength(baseline),
    contextLines: 3, inverses,
  };
}

const tree = git('rev-parse', `${revision}^{tree}`).trim();
const predecessorTree = git('rev-parse', `${predecessor}^{tree}`).trim();
const output = `// Generated exact source-only envelope for business control desk.
// Historical pins remain unchanged; unknown or non-exact bytes pass through.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

export const BUSINESS_DESK_REVISION = ${JSON.stringify(revision)};
export const BUSINESS_DESK_TREE = ${JSON.stringify(tree)};
export const BUSINESS_DESK_PREDECESSOR = ${JSON.stringify(predecessor)};
export const BUSINESS_DESK_PREDECESSOR_TREE = ${JSON.stringify(predecessorTree)};
export const BUSINESS_DESK_PHASE = 'exact-business-control-desk-source-transfer-only; no historical runtime, native, migration, financial, activation or deployment clearance';
export const BUSINESS_DESK_DOMAINS = ${JSON.stringify(domains, null, 2)};
for (const pin of Object.values(BUSINESS_DESK_DOMAINS)) {
  for (const inverse of pin.inverses) Object.freeze(inverse);
  Object.freeze(pin.inverses); Object.freeze(pin);
}
Object.freeze(BUSINESS_DESK_DOMAINS);
const lf = text => text.replaceAll('\\r\\n', '\\n');
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\\0').update(text).digest('hex');
const uniform = text => typeof text === 'string' && (text === lf(text) || text === lf(text).replaceAll('\\n', '\\r\\n'));

export function assertBusinessDeskSourceTransfer(file, input) {
  assert(Object.hasOwn(BUSINESS_DESK_DOMAINS, file),
    'Unknown business desk source domain');
  assert(uniform(input), 'Uniform whole business desk LF/CRLF source text required');
  const pin = BUSINESS_DESK_DOMAINS[file], text = lf(input);
  assert.equal(sha256(text), pin.currentSha256, 'Complete business desk source drift: ' + file);
  assert.equal(blob(text), pin.currentBlob, 'Complete business desk blob drift: ' + file);
  assert.equal(Buffer.byteLength(text), pin.currentBytes);
  let baselineText = text;
  for (const inverse of pin.inverses) {
    assert(inverse.current.length);
    assert.equal(baselineText.split(inverse.current).length - 1, 1,
      'Missing or duplicate business desk inverse: ' + file);
    baselineText = baselineText.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(sha256(baselineText), pin.baselineSha256,
    'Complete business desk predecessor source mismatch: ' + file);
  assert.equal(blob(baselineText), pin.baselineBlob,
    'Complete business desk predecessor blob mismatch: ' + file);
  assert.equal(Buffer.byteLength(baselineText), pin.baselineBytes);
  return Object.freeze({ file, baselineText, postimageSha256: pin.currentSha256,
    sourceRevision: BUSINESS_DESK_REVISION,
    predecessorRevision: BUSINESS_DESK_PREDECESSOR,
    inverseChunks: pin.inverses.length, phase: BUSINESS_DESK_PHASE,
    sourceOnly: true, runtime: false, native: false });
}

export function businessDeskHistoricalInput(file, input) {
  if (!Object.hasOwn(BUSINESS_DESK_DOMAINS, file)) return input;
  const pin = BUSINESS_DESK_DOMAINS[file];
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'Lossless UTF-8 physical source only');
  if (!uniform(text) || sha256(lf(text)) !== pin.currentSha256) return input;
  const baseline = assertBusinessDeskSourceTransfer(file, text).baselineText;
  return buffer ? Buffer.from(baseline) : baseline;
}
`;
fs.writeFileSync(new URL('./businessdesk-source-transfer.js', import.meta.url), output);
console.log(`Generated ${files.length} exact business desk source domains.`);
