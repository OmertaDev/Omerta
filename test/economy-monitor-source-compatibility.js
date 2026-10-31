// Exact source/control proofs only. Runtime and native tests execute physical current bytes.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  ECONOMY_MONITOR_SOURCE_REVISION as revision, ECONOMY_MONITOR_SOURCE_TREE as tree,
  ECONOMY_MONITOR_SOURCE_PREDECESSOR as predecessor,
  ECONOMY_MONITOR_SOURCE_PREDECESSOR_TREE as predecessorTree,
  ECONOMY_MONITOR_SOURCE_PHASE as phase, ECONOMY_MONITOR_SOURCE_DOMAINS as domains,
  assertEconomyMonitorSourceTransfer, economyMonitorHistoricalInput,
} from '../tools/economy-monitor-source-transfer.js';
import { economyUxMergeCandidateHistoricalInput, economyUxMergeMainHistoricalInput }
  from '../tools/economy-ux-merge-source-compatibility.js';

const files = [
  '.github/workflows/economy-hardening.yml', 'package.json', 'schema.sql',
  'src/economy-monitor.js', 'src/game.js', 'src/invariants.js', 'src/worker.js',
  'test/economy-composition-restart.js', 'test/economy-composition.js', 'test/economy-monitor.js',
];
const additions = new Set(['src/economy-monitor.js', 'test/economy-composition-restart.js', 'test/economy-composition.js', 'test/economy-monitor.js']);
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], {
  encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024,
}).replaceAll('\r\n', '\n');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
const inverseHunks = diff => {
  const inverses = []; let hunk = null;
  for (const line of diff.split('\n')) {
    if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; inverses.push(hunk); }
    else if (hunk && /^[ +\-]/.test(line)) {
      if (line[0] !== '-') hunk.current += `${line.slice(1)}\n`;
      if (line[0] !== '+') hunk.baseline += `${line.slice(1)}\n`;
    }
  }
  return inverses;
};
assert.equal(predecessor, 'a24df18ea1a0b57f25df942675dd9fef7415f275');
assert.equal(git('rev-parse', `${revision}^`).trim(), predecessor);
assert.equal(git('rev-parse', `${revision}^{tree}`).trim(), tree);
assert.equal(git('rev-parse', `${predecessor}^{tree}`).trim(), predecessorTree);
git('merge-base', '--is-ancestor', revision, 'HEAD');
assert.equal(phase, 'exact-economy-monitor-composition-source-transfer-only; no historical runtime, native, migration, financial, activation or deployment clearance');
assert.deepEqual(Object.keys(domains), files);
assert.deepEqual(git('diff', '--name-only', predecessor, revision).trim().split('\n'), files);
assert.deepEqual(git('diff', '--diff-filter=A', '--name-only', predecessor, revision).trim().split('\n'), [...additions]);
assert(Object.isFrozen(domains));
let positives = 0, refusals = 0, hunks = 0;
for (const file of files) {
  const pin = domains[file], current = git('show', `${revision}:${file}`);
  const absent = additions.has(file), baseline = absent ? null : git('show', `${predecessor}:${file}`);
  const physical = fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
  assert.equal(physical, current, 'Physical current monitoring/composition source remains exact: ' + file);
  const stat = fs.lstatSync(file); assert(stat.isFile() && !stat.isSymbolicLink());
  assert.equal(pin.predecessorAbsent, absent);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));
  assert.deepEqual(Object.keys(pin).sort(), ['predecessorAbsent', 'mode', 'currentSha256', 'currentBlob',
    'currentBytes', 'baselineSha256', 'baselineBlob', 'baselineBytes', 'contextLines', 'inverses'].sort());
  assert.equal(pin.contextLines, 3);
  assert.equal(pin.currentSha256, hash(current)); assert.equal(pin.currentBlob, blob(current));
  assert.equal(pin.currentBytes, Buffer.byteLength(current));
  assert.equal(git('ls-tree', revision, '--', file).trim(), `${pin.mode} blob ${pin.currentBlob}\t${file}`);
  if (absent) {
    assert.equal(git('ls-tree', predecessor, '--', file), '');
    assert.equal(pin.baselineSha256, null); assert.equal(pin.baselineBlob, null); assert.equal(pin.baselineBytes, null);
    assert.deepEqual(pin.inverses, []);
  } else {
    assert.equal(pin.baselineSha256, hash(baseline)); assert.equal(pin.baselineBlob, blob(baseline));
    assert.equal(pin.baselineBytes, Buffer.byteLength(baseline));
    assert.deepEqual(pin.inverses, inverseHunks(git('diff', '--no-ext-diff', '--unified=3', predecessor, revision, '--', file)));
  }
  for (const input of [current, current.replaceAll('\n', '\r\n')]) {
    const transfer = assertEconomyMonitorSourceTransfer(file, input);
    assert(Object.isFrozen(transfer)); assert.equal(transfer.baselineText, baseline);
    assert.equal(transfer.predecessorAbsent, absent);
    assert.deepEqual([transfer.sourceOnly, transfer.runtime, transfer.native], [true, false, false]);
    assert.equal(economyMonitorHistoricalInput(file, input), absent ? input : baseline);
    for (const helper of [economyUxMergeCandidateHistoricalInput, economyUxMergeMainHistoricalInput])
      assert.equal(helper(file, input), absent ? input : helper(file, baseline));
    positives += 4;
  }
  const currentBuffer = Buffer.from(current);
  assert.deepEqual(economyMonitorHistoricalInput(file, currentBuffer), absent ? currentBuffer : Buffer.from(baseline));
  positives++;
  for (const changed of [current + '\n// drift\n', current.slice(1), '\ufeff' + current, current + '\0',
    current.replace('\n', '\r\n'), current.replace('\n', '\r'), null]) {
    assert.throws(() => assertEconomyMonitorSourceTransfer(file, changed));
    assert.equal(economyMonitorHistoricalInput(file, changed), changed);
    for (const helper of [economyUxMergeCandidateHistoricalInput, economyUxMergeMainHistoricalInput])
      assert.equal(helper(file, changed), changed);
    refusals++;
  }
  const invalidUtf8 = Buffer.from([0xc3, 0x28]);
  assert.throws(() => assertEconomyMonitorSourceTransfer(file, invalidUtf8));
  assert.throws(() => economyMonitorHistoricalInput(file, invalidUtf8)); refusals++;
  for (const inverse of pin.inverses) {
    for (const changed of [current.replace(inverse.current, ''),
      current.replace(inverse.current, () => inverse.current + inverse.current),
      current.replace(inverse.current, () => inverse.baseline),
      current.replace(inverse.current, () => inverse.current.replace(/\S/, '?'))]) {
      assert.throws(() => assertEconomyMonitorSourceTransfer(file, changed));
      assert.equal(economyMonitorHistoricalInput(file, changed), changed); refusals++;
    }
    hunks++;
  }
}
for (const file of ['__proto__', 'constructor', 'toString', '../schema.sql', 'src/unknown.js']) {
  const text = 'unknown\r\nbytes\n', invalidUtf8 = Buffer.from([0xff]);
  assert.throws(() => assertEconomyMonitorSourceTransfer(file, text));
  assert.equal(economyMonitorHistoricalInput(file, text), text);
  assert.strictEqual(economyMonitorHistoricalInput(file, invalidUtf8), invalidUtf8); refusals++;
}
const previousPackage = JSON.parse(git('show', `${predecessor}:package.json`));
const currentPackage = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert.equal(currentPackage.scripts['test:economy-security'],
  'node test/economy-monitor.js && node test/economy-composition.js');
delete currentPackage.scripts['test:economy-security'];
assert.deepEqual(currentPackage, previousPackage, 'Every prior package field and test script remains unchanged');
const workflow = fs.readFileSync('.github/workflows/economy-hardening.yml', 'utf8');
const previousWorkflow = git('show', `${predecessor}:.github/workflows/economy-hardening.yml`);
const commands = source => [...source.matchAll(/\bnode (test\/[\w./-]+\.js)(?: --postgres)?/g)].map(match => match[0]);
const addedCommands = new Set(['node test/economy-monitor.js', 'node test/economy-composition.js',
  'node test/economy-monitor.js --postgres', 'node test/economy-composition.js --postgres']);
const currentCommands = commands(workflow);
for (const command of addedCommands)
  assert.equal(currentCommands.filter(value => value === command).length, 1, 'Each new economy proof is invoked once per CI lane');
assert.deepEqual(currentCommands.filter(command => !addedCommands.has(command)), commands(previousWorkflow),
  'All previous economy CI proof invocations and modes remain in their original order');
assert(workflow.includes("postgres: ['16', '18.4']") && workflow.includes('image: postgres:${{ matrix.postgres }}'),
  'Both native PostgreSQL versions execute the complete economy proof roster');
console.log(JSON.stringify({ phase, revision, files: files.length, positives, refusals, inverseHunks: hunks,
  sourceOnly: true, native: false, runtime: false }));
