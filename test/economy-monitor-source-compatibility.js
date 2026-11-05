// Exact source/control proofs only. Runtime and native tests execute physical current bytes.
import { businessDeskCombinedHistoricalInput } from '../tools/businessdesk-combined-source-transfer.js';
import { integratedEconomicSource } from '../tools/integrated-economic-parent-source.js';
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
import { economyUxMergeCandidateHistoricalInput, economyUxMergeMainHistoricalInput,
  ECONOMY_MONITOR_WORKER_SOURCE as workerPin, assertEconomyMonitorWorkerSource,
  economyMonitorWorkerHistoricalInput, ECONOMY_MONITOR_READER_SOURCE as readerPin,
  assertEconomyMonitorReaderSource, economyMonitorReaderHistoricalInput,
  ECONOMY_MONITOR_RELEASE_SOURCES as releasePins, assertEconomyMonitorReleaseSource,
  economyMonitorReleaseHistoricalInput }
  from '../tools/economy-ux-merge-source-compatibility.js';
import { economyDeedMergeHistoricalInput } from '../tools/economy-deed-merge-source-compatibility.js';

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
function readMonitorSource(file) {
  const entry = git('ls-tree', 'HEAD', '--', file).trim();
  assert.match(entry, /^(100644|100755) blob [a-f0-9]{40}\t/);
  assert.equal(entry, git('ls-tree', integratedEconomicSource.revision, '--', file).trim(),
    'Monitor source must match the reviewed integration: ' + file);
  assert.equal(git('ls-files', '--stage', '--', file).trim(), entry.replace(' blob ', ' ').replace('\t', ' 0\t'));
  const committed = git('show', 'HEAD:' + file), raw = fs.readFileSync(file);
  const actual = raw.toString('utf8'), stat = fs.lstatSync(file);
  assert(stat.isFile() && !stat.isSymbolicLink() && Buffer.from(actual).equals(raw));
  assert(actual === committed || actual === committed.replaceAll('\n', '\r\n'), 'Whole actual physical LF/CRLF source qualifies before projection');
  return economyDeedMergeHistoricalInput(file, businessDeskCombinedHistoricalInput(file, actual, 'monitor'), 'monitor');
}
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
  const physical = readMonitorSource(file).replaceAll('\r\n', '\n');
  assert.equal(economyMonitorReleaseHistoricalInput(file,
    economyMonitorWorkerHistoricalInput(file, economyMonitorReaderHistoricalInput(file, physical))), current,
    'Physical current monitoring/composition source remains exact after the named successors: ' + file);
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
assert.deepEqual(Object.keys(releasePins), ['.github/workflows/economy-hardening.yml', 'test/gates.js', 'test/economy-composition.js',
  'tools/ux-release-phase2-native-catalog.js', 'tools/pgquery.js']);
assert(Object.isFrozen(releasePins));
for (const [pin, qualify, historical] of [
  [workerPin, assertEconomyMonitorWorkerSource, economyMonitorWorkerHistoricalInput],
  [readerPin, assertEconomyMonitorReaderSource, economyMonitorReaderHistoricalInput],
  ...Object.values(releasePins).map(pin => [pin, assertEconomyMonitorReleaseSource, economyMonitorReleaseHistoricalInput]),
]) {
  const { file } = pin, physical = readMonitorSource(file).replaceAll('\r\n', '\n');
  const baseline = git('show', `${pin.predecessorRevision}:${file}`);
  const priorReleaseSource = ['test/gates.js', 'tools/ux-release-phase2-native-catalog.js', 'tools/pgquery.js'].includes(file);
  assert.equal(pin.predecessorRevision, priorReleaseSource ? '6fdc897851ef23e8c2cf691733ad944a7663242a' : revision);
  assert.equal(git('show', `${pin.sourceRevision}:${file}`), physical);
  git('merge-base', '--is-ancestor', pin.sourceRevision, 'HEAD');
  const authoredFiles = {
    '9a5c784034a9f543cd32e27fd0b73a23e332ee5b': ['.github/workflows/economy-hardening.yml', 'test/gates.js'],
    '5d364a6aa6ff1f5e90a56b056ccc7974c8e4a1f0': ['test/lib/ux-native-director-guard.js', 'test/vig.js', 'tools/pgquery.js', 'tools/ux-release-phase2-native-catalog.js'],
    '29d6861f44bf281182ea55880d4262aaa4cfb8d1': ['test/economy-monitor-source-compatibility.js', 'tools/economy-ux-merge-source-compatibility.js', 'tools/pgquery.js'],
  }[pin.sourceRevision] || [file];
  assert.deepEqual(git('diff', '--name-only', `${pin.sourceRevision}^`, pin.sourceRevision).trim().split('\n'), authoredFiles);
  assert.equal(hash(physical), pin.currentSha256); assert.equal(blob(physical), pin.currentBlob);
  assert.equal(Buffer.byteLength(physical), pin.currentBytes); assert(Object.isFrozen(pin));
  if (pin.inverses) {
    assert.equal(pin.contextLines, 3);
    assert(Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));
    assert.deepEqual(pin.inverses, inverseHunks(git('diff', '--no-ext-diff', '--unified=3',
      pin.predecessorRevision, pin.sourceRevision, '--', file)));
  }
  for (const current of [physical, physical.replaceAll('\n', '\r\n')]) {
    const restored = qualify(file, current);
    assert(Object.isFrozen(restored)); assert.equal(restored.baselineText, baseline);
    assert.deepEqual([restored.sourceOnly, restored.runtime, restored.native], [true, false, false]);
    assert.equal(historical(file, current), baseline);
    assert.deepEqual(historical(file, Buffer.from(current)), Buffer.from(baseline));
    for (const helper of [economyUxMergeCandidateHistoricalInput, economyUxMergeMainHistoricalInput])
      assert.equal(helper(file, current), helper(file, baseline));
    positives += 5;
  }
  const replacement = pin.inverses?.[0]?.current || pin.current;
  for (const current of [physical + '\n// drift\n', physical.slice(1), '\ufeff' + physical, physical + '\0',
    physical.replace('\n', '\r\n'), physical.replace('\n', '\r'), physical.replace(replacement, ''),
    physical.replace(replacement, replacement + replacement), baseline, null]) {
    assert.throws(() => qualify(file, current));
    assert.equal(historical(file, current), current); refusals++;
  }
  for (const inverse of pin.inverses || []) for (const changed of [
    physical.replace(inverse.current, ''), physical.replace(inverse.current, inverse.current + inverse.current),
    physical.replace(inverse.current, inverse.baseline),
    physical.replace(inverse.current, inverse.current.replace(/\S/, char => char === '?' ? '!' : '?')),
  ]) {
    assert.throws(() => qualify(file, changed)); assert.equal(historical(file, changed), changed); refusals++;
  }
  assert.throws(() => historical(file, Buffer.from([0xc3, 0x28]))); refusals++;
  for (const unknown of ['__proto__', 'constructor', 'toString', '../src/worker.js', 'src/unknown.js']) {
    assert.throws(() => qualify(unknown, physical));
    assert.equal(historical(unknown, physical), physical); refusals++;
  }
}

// Run the physical current scheduler and shared safe() body with controlled jobs/timers. This is a
// current worker control proof, with no database, payouts, or historical runtime result transferred.
const worker = fs.readFileSync('src/worker.js', 'utf8').replaceAll('\r\n', '\n');
const safeStart = worker.indexOf('  let currentJob = null;');
const safeEnd = worker.indexOf('  // How many consecutive ticks', safeStart);
const timerStart = worker.indexOf('  let economyTicking = false;');
const timerEnd = worker.indexOf('  void guardedEconomyTick();', timerStart) + '  void guardedEconomyTick();'.length;
assert(safeStart >= 0 && safeEnd > safeStart && timerStart >= 0 && timerEnd > timerStart);
const events = [], logs = [], errors = []; let interval, calls = 0, rejectFirst;
const tick = new Function('runEconomyMonitor', 'pool', 'alertDrift', 'setInterval', 'console',
  worker.slice(safeStart, safeEnd) + '\n' + worker.slice(timerStart, timerEnd) + '\nreturn guardedEconomyTick;')(
  async () => {
    calls++; events.push('run');
    if (calls === 1) return new Promise((_, reject) => { rejectFirst = reject; });
    return { ok: true, sample: calls };
  }, {}, () => {}, (callback, period) => { assert.equal(period, 5 * 60 * 1000); interval = callback; events.push('registered'); },
  { log: (...args) => logs.push(args), error: (...args) => errors.push(args) });
assert.deepEqual(events, ['registered', 'run'], 'The initial monitor runs only after its interval is registered');
assert.equal(tick, interval);
await interval(); assert.equal(calls, 1, 'A pending monitor cannot overlap itself');
rejectFirst(new Error('synthetic monitor database outage'));
await new Promise(resolve => setImmediate(resolve));
assert.equal(errors.length, 1); assert.equal(errors[0][0], 'worker: economy monitor failed');
assert.equal(logs.length, 0, 'A safe() null result never logs a clean monitoring sample');
await interval(); assert.equal(calls, 2, 'Failure releases the guard for the next scheduled monitor');
assert.equal(logs.length, 1); assert.equal(logs[0][0], '[economy monitor]');
assert.deepEqual(JSON.parse(logs[0][1]), { ok: true, sample: 2 });
console.log(JSON.stringify({ phase: 'CURRENT_ECONOMY_MONITOR_WORKER_CONTROL', sourceRevision: workerPin.sourceRevision,
  registerFirst: true, nonOverlap: true, failureContained: true, nextSampleRecovered: true,
  falseCleanSampleLogs: 0, postgresImportsOrConnections: 0, priorNativeResultsTransferred: false }));

for (const file of ['__proto__', 'constructor', 'toString', '../schema.sql', 'src/unknown.js']) {
  const text = 'unknown\r\nbytes\n', invalidUtf8 = Buffer.from([0xff]);
  assert.throws(() => assertEconomyMonitorSourceTransfer(file, text));
  assert.equal(economyMonitorHistoricalInput(file, text), text);
  assert.strictEqual(economyMonitorHistoricalInput(file, invalidUtf8), invalidUtf8); refusals++;
}
const previousPackage = JSON.parse(git('show', `${predecessor}:package.json`));
const currentPackage = JSON.parse(readMonitorSource('package.json'));
assert.equal(currentPackage.scripts['test:economy-security'],
  'node test/economy-monitor.js && node test/economy-composition.js');
delete currentPackage.scripts['test:economy-security'];
assert.deepEqual(currentPackage, previousPackage, 'Every prior package field and test script remains unchanged');
const workflow = fs.readFileSync('.github/workflows/economy-hardening.yml', 'utf8');
const previousWorkflow = git('show', `${predecessor}:.github/workflows/economy-hardening.yml`);
const commands = source => [...source.matchAll(/\bnode (test\/[\w./-]+\.js)(?: --postgres)?/g)].map(match => match[0]);
const addedCommands = new Set(['node test/economy-monitor.js', 'node test/economy-composition.js',
  'node test/economy-monitor.js --postgres', 'node test/economy-composition.js --postgres',
  'node test/age-eligibility-source-compatibility.js', 'node test/economy-monitor-source-compatibility.js']);
const currentCommands = commands(workflow);
for (const command of addedCommands)
  assert.equal(currentCommands.filter(value => value === command).length, 1, 'Each new economy proof is invoked once per CI lane');
assert.deepEqual(currentCommands.filter(command => !addedCommands.has(command)), commands(previousWorkflow),
  'All previous economy CI proof invocations and modes remain in their original order');
assert(workflow.includes("postgres: ['16', '18.4']") && workflow.includes('image: postgres:${{ matrix.postgres }}'),
  'Both native PostgreSQL versions execute the complete economy proof roster');
console.log(JSON.stringify({ phase, revision, files: files.length, positives, refusals, inverseHunks: hunks,
  sourceOnly: true, native: false, runtime: false }));
