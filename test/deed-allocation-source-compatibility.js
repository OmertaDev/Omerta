// Exact app-source proof only. Historical test text is reconstructed for comparison, never execution.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { DEED_ALLOCATION_SOURCE_PREDECESSOR, DEED_ALLOCATION_SOURCE_PREDECESSOR_TREE,
  DEED_ALLOCATION_SOURCE_PHASE, DEED_ALLOCATION_SOURCE_DOMAINS,
  assertDeedAllocationSourceTransfer, deedAllocationHistoricalInput } from '../tools/deed-allocation-source-transfer.js';
import { economyUxMergeCandidateHistoricalInput, economyUxMergeMainHistoricalInput }
  from '../tools/economy-ux-merge-source-compatibility.js';

const lf = text => text.replaceAll('\r\n', '\n');
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
const git = (...args) => lf(execFileSync('git', ['--no-replace-objects', ...args], {
  encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
}));
assert.deepEqual(process.argv.slice(2), [], 'Bare source-only entry point required');
assert.equal(DEED_ALLOCATION_SOURCE_PREDECESSOR, 'b35dd222054f0c5f3ca814f228dd7d9a46c58ae9');
assert.equal(git('rev-parse', `${DEED_ALLOCATION_SOURCE_PREDECESSOR}^{tree}`).trim(), DEED_ALLOCATION_SOURCE_PREDECESSOR_TREE);
git('merge-base', '--is-ancestor', DEED_ALLOCATION_SOURCE_PREDECESSOR, 'HEAD');
assert.equal(DEED_ALLOCATION_SOURCE_PHASE,
  'exact-deed-allocation-source-transfer-only; no historical runtime, native, migration, financial, genesis, activation or deployment clearance');
assert(Object.isFrozen(DEED_ALLOCATION_SOURCE_DOMAINS));
assert.deepEqual(Object.keys(DEED_ALLOCATION_SOURCE_DOMAINS), [
  'AGENTS.md', 'docs/WIKI.md', 'docs/character-deed-policy-2026-10-14.md', 'package.json',
  'public/index.html', 'public/sale.html', 'src/accrual.js', 'src/db.js', 'src/deedbuildings.js',
  'src/deeddiscovery.js', 'src/deeds.js', 'src/game.js', 'test/deed-discovery-ui.js', 'test/deeddiscovery.js',
  'test/economy-hardening-source-compatibility.js', 'tools/economy-ux-merge-source-compatibility.js',
], 'Only the closed reviewed Deed allocation domains receive a source alias');

let positives = 0, refusals = 0, hunks = 0;
for (const [file, pin] of Object.entries(DEED_ALLOCATION_SOURCE_DOMAINS)) {
  const physical = fs.readFileSync(file, 'utf8'), current = lf(physical);
  const baseline = git('show', `${DEED_ALLOCATION_SOURCE_PREDECESSOR}:${file}`);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && Object.isFrozen(pin.currentRawSha256));
  assert.equal(pin.contextLines, 3); assert.equal(pin.currentMode, '100644'); assert.equal(pin.baselineMode, '100644');
  assert.equal(git('ls-tree', DEED_ALLOCATION_SOURCE_PREDECESSOR, '--', file).trim().split(/\s+/)[0], pin.baselineMode);
  assert.equal(git('ls-files', '--stage', '--', file).trim().split(/\s+/)[0], pin.currentMode);
  assert.equal(sha256(current), pin.currentSha256); assert.equal(blob(current), pin.currentBlob);
  assert.equal(current, git('cat-file', 'blob', pin.currentBlob));
  assert.equal(baseline, git('cat-file', 'blob', pin.baselineBlob));
  const actual = []; let hunk = null;
  for (const line of git('diff', '--no-ext-diff', '--unified=3', pin.baselineBlob, pin.currentBlob).split('\n')) {
    if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; actual.push(hunk); }
    else if (hunk && /^[ +\-]/.test(line)) {
      if (line[0] !== '-') hunk.current += line.slice(1) + '\n';
      if (line[0] !== '+') hunk.baseline += line.slice(1) + '\n';
    }
  }
  assert.deepEqual(pin.inverses, actual, 'Only complete actual Git inverse contexts are admitted');
  for (const raw of [physical, current, current.replaceAll('\n', '\r\n')]) {
    const proof = assertDeedAllocationSourceTransfer(file, raw);
    assert.equal(proof.baselineText, baseline); assert.equal(proof.sourceOnly, true);
    assert.equal(proof.runtime, false); assert.equal(proof.native, false);
    assert.equal(proof.inverseChunks, pin.inverses.length);
    assert.equal(deedAllocationHistoricalInput(file, raw), baseline);
    assert.deepEqual(deedAllocationHistoricalInput(file, Buffer.from(raw)), Buffer.from(baseline));
    for (const compose of [economyUxMergeCandidateHistoricalInput, economyUxMergeMainHistoricalInput])
      assert.deepEqual(compose(file, raw), compose(file, baseline), 'The new envelope preserves historical composition');
    positives++;
  }
  const reject = text => {
    assert.notEqual(text, current);
    assert.throws(() => assertDeedAllocationSourceTransfer(file, text));
    assert.equal(deedAllocationHistoricalInput(file, text), text, 'Unknown bytes retain their original rejecting form');
    assert.deepEqual(deedAllocationHistoricalInput(file, Buffer.from(text)), Buffer.from(text));
    refusals++;
  };
  for (const text of [current + '\n// unreviewed drift\n', current.slice(1), '\ufeff' + current,
    current.replace(/\S/, '?'), current.replace('\n', '\r\n'), current.replace('\n', '\r'), baseline]) reject(text);
  for (const inverse of pin.inverses) {
    assert(Object.isFrozen(inverse));
    reject(current.replace(inverse.current, ''));
    reject(current.replace(inverse.current, () => inverse.current + inverse.current));
    reject(current.replace(inverse.current, () => inverse.baseline));
    reject(current.replace(inverse.current, () => inverse.current.replace(/\S/, '?')));
    hunks++;
  }
  const invalid = Buffer.concat([Buffer.from(current), Buffer.from([0xff])]);
  assert.throws(() => deedAllocationHistoricalInput(file, invalid)); refusals++;
}
for (const file of ['__proto__', 'constructor', 'src/unknown.js', 'src/deedbenefits.js', 'schema.sql']) {
  const text = 'unknown\r\nbytes\n', invalid = Buffer.from([0xff]);
  assert.throws(() => assertDeedAllocationSourceTransfer(file, text));
  assert.equal(deedAllocationHistoricalInput(file, text), text);
  assert.strictEqual(deedAllocationHistoricalInput(file, invalid), invalid);
  refusals++;
}
for (const file of [null, { toString: () => 'package.json' }]) {
  const text = fs.readFileSync('package.json', 'utf8');
  assert.throws(() => assertDeedAllocationSourceTransfer(file, text));
  assert.equal(deedAllocationHistoricalInput(file, text), text); refusals++;
}
assert.equal(lf(fs.readFileSync('schema.sql', 'utf8')), git('show', `${DEED_ALLOCATION_SOURCE_PREDECESSOR}:schema.sql`),
  'Source transfer grants no schema/native migration alias');
for (const file of ['tools/deed-quest-source-transfer.js', 'tools/economy-hardening-source-transfer.js',
  'tools/next-five-source-compatibility.js', 'tools/release-source-transfer.js', 'tools/continuous-city-source-data.js'])
  assert.equal(lf(fs.readFileSync(file, 'utf8')), git('show', `${DEED_ALLOCATION_SOURCE_PREDECESSOR}:${file}`),
    'Historical literal source pins remain unchanged: ' + file);
console.log(`Deed allocation exact source compatibility PASS: ${positives} positives, ${refusals} refusals, ${hunks} complete Git inverse hunks; source only`);
