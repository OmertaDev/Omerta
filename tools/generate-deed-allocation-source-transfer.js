// Explicit maintainer command for a frozen, reviewed app-only Deed allocation candidate.
// This generator is never imported by a test, source guard or game runtime.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const predecessor = 'b35dd222054f0c5f3ca814f228dd7d9a46c58ae9';
const files = Object.freeze([
  'AGENTS.md', 'docs/WIKI.md', 'docs/character-deed-policy-2026-10-14.md', 'package.json',
  'public/index.html', 'public/sale.html', 'src/accrual.js', 'src/db.js', 'src/deedbuildings.js',
  'src/deeddiscovery.js', 'src/deeds.js', 'src/game.js', 'test/deed-discovery-ui.js', 'test/deeddiscovery.js',
  'test/economy-hardening-source-compatibility.js', 'tools/economy-ux-merge-source-compatibility.js',
  'tools/pgquery.js',
  'tools/commerce-current-native-guard.js', 'test/commerce-current-native-guard.js',
  'tools/enterprise-native-ux.js', 'tools/enterprise-native-ux-seal.js',
  'tools/enterprise-native.js', 'test/lib/enterprise-ux-native-guard.js',
]);
const lf = text => text.replaceAll('\r\n', '\n');
const git = (...args) => lf(execFileSync('git', ['--no-replace-objects', ...args], {
  encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
}));
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');

assert.deepEqual(process.argv.slice(2), ['--write'], 'Use --write only after freezing the reviewed Deed allocation app candidate');
git('merge-base', '--is-ancestor', predecessor, 'HEAD');
const domains = {};
for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8'), current = lf(raw), baseline = git('show', `${predecessor}:${file}`);
  assert(!current.includes('\r') && (raw === current || raw === current.replaceAll('\n', '\r\n')), 'Uniform candidate source required: ' + file);
  assert.notEqual(current, baseline, 'Closed Deed allocation domain has no change: ' + file);
  const baselineMode = git('ls-tree', predecessor, '--', file).trim().split(/\s+/)[0];
  const currentMode = git('ls-files', '--stage', '--', file).trim().split(/\s+/)[0];
  assert.equal(currentMode, baselineMode, 'Deed allocation source mode changed: ' + file);
  assert.equal(currentMode, '100644', 'Ordinary nonexecutable app source required: ' + file);
  const inverses = []; let hunk = null;
  for (const line of git('diff', '--no-ext-diff', '--unified=3', predecessor, '--', file).split('\n')) {
    if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; inverses.push(hunk); }
    else if (hunk && /^[ +\-]/.test(line)) {
      if (line[0] !== '-') hunk.current += line.slice(1) + '\n';
      if (line[0] !== '+') hunk.baseline += line.slice(1) + '\n';
    }
  }
  let reconstructed = current, end = -1;
  assert(inverses.length > 0, 'Changed candidate requires actual Git inverse hunks');
  for (const inverse of inverses) {
    assert(inverse.current.length);
    assert.equal(current.split(inverse.current).length, 2, 'Whole inverse context must occur exactly once: ' + file);
    const offset = current.indexOf(inverse.current);
    assert(offset >= end, 'Inverse contexts must be ordered and nonoverlapping');
    end = offset + inverse.current.length;
    assert.equal(reconstructed.split(inverse.current).length, 2);
    reconstructed = reconstructed.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(reconstructed, baseline, 'Complete retained predecessor reconstruction: ' + file);
  // Retain the exact candidate blob for independent Git diff/cat-file checks without changing refs or the index.
  const retained = execFileSync('git', ['--no-replace-objects', 'hash-object', '-w', '--stdin'], {
    input: current, encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
  assert.equal(retained, blob(current));
  domains[file] = { currentMode, baselineMode, currentSha256: sha256(current), currentBlob: retained,
    currentBytes: Buffer.byteLength(current), currentRawSha256: { lf: sha256(current), crlf: sha256(current.replaceAll('\n', '\r\n')) },
    baselineSha256: sha256(baseline), baselineBlob: blob(baseline), baselineBytes: Buffer.byteLength(baseline),
    contextLines: 3, inverses };
}
const existingData = new URL('./deed-allocation-source-data.js', import.meta.url);
if (fs.existsSync(existingData)) {
  const previous = (await import(existingData.href)).DEED_ALLOCATION_SOURCE_DOMAINS;
  for (const [file, pin] of Object.entries(previous))
    assert.deepEqual(domains[file], pin, 'An existing frozen Deed allocation source binding cannot be refreshed: ' + file);
}
const output = `// Generated exact Deed allocation source-only envelope. No dynamic pin discovery or release clearance.
export const DEED_ALLOCATION_SOURCE_PREDECESSOR = ${JSON.stringify(predecessor)};
export const DEED_ALLOCATION_SOURCE_PREDECESSOR_TREE = ${JSON.stringify(git('rev-parse', `${predecessor}^{tree}`).trim())};
export const DEED_ALLOCATION_SOURCE_PHASE = 'exact-deed-allocation-source-transfer-only; no historical runtime, native, migration, financial, genesis, activation or deployment clearance';
export const DEED_ALLOCATION_SOURCE_DOMAINS = ${JSON.stringify(domains, null, 2)};
for (const pin of Object.values(DEED_ALLOCATION_SOURCE_DOMAINS)) {
  for (const inverse of pin.inverses) Object.freeze(inverse);
  Object.freeze(pin.inverses); Object.freeze(pin.currentRawSha256); Object.freeze(pin);
}
Object.freeze(DEED_ALLOCATION_SOURCE_DOMAINS);
`;
const destination = new URL('./deed-allocation-source-data.js', import.meta.url);
const temporary = new URL('./deed-allocation-source-data.js.tmp', import.meta.url);
fs.writeFileSync(temporary, output);
fs.renameSync(temporary, destination);
console.log(`Generated ${files.length} frozen app-only Deed allocation domains against ${predecessor}; historical pins unchanged.`);
