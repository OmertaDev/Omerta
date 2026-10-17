import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { BASE_WORK_TEST_GATE_SOURCE, BASE_WORK_TEST_GATE_PREDECESSOR, BASE_WORK_TEST_GATE_PHASE,
  BASE_WORK_TEST_GATE_DOMAINS, assertBaseWorkHistoricalTestGateTransfer,
  baseWorkHistoricalTestGateBaseline } from './lib/base-work-test-gate-source-compatibility.js';
import { BASE_WORK_HISTORICAL_SOURCE, BASE_WORK_HISTORICAL_PREDECESSOR, BASE_WORK_HISTORICAL_DOMAINS,
  baseWorkHistoricalSourceBaseline } from './lib/base-work-source-compatibility.js';
import { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';
import { marketOverDeedSourceBaseline, deedOverMarketSourceBaseline } from '../tools/deed-market-source-compatibility.js';
import { DEED_QUEST_SOURCE_DOMAINS, assertDeedQuestSourceTransfer, deedQuestSourceBaseline } from '../tools/deed-quest-source-transfer.js';
import { MARKET_OPERATIONS_SOURCE_REVISION, assertMarketOperationsSourceTransfer, marketOperationsSourceBaseline } from '../tools/market-operations-source-compatibility.js';
import { NEXT_LAYER_SOURCE_REVISION, assertNextLayerSourceTransfer } from '../tools/next-layer-source-compatibility.js';

import { WALLET_COMPUTE_PACKAGE_SOURCE, WALLET_COMPUTE_PACKAGE_PREDECESSOR, WALLET_COMPUTE_PACKAGE_PHASE,
  WALLET_COMPUTE_PACKAGE_DOMAINS, assertWalletComputePackageSourceTransfer, walletComputePackageSourceBaseline } from './lib/wallet-compute-package-source-compatibility.js';
import { assertBaseWorkHistoricalSourceTransfer } from './lib/base-work-source-compatibility.js';

const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
assert.equal(BASE_WORK_TEST_GATE_SOURCE, 'a144a8ee803ba7557b3bb0b15f7091d2f9c19280');
assert.equal(BASE_WORK_TEST_GATE_PREDECESSOR, '8fe7faf28007107611bd98f3728d1e00d984e5d4');
assert.equal(BASE_WORK_HISTORICAL_SOURCE, '8fe7faf28007107611bd98f3728d1e00d984e5d4');
assert.equal(BASE_WORK_HISTORICAL_PREDECESSOR, '2b7875977b6285d35abea7e35240b11ed7e2e52d');
assert.deepEqual(Object.keys(BASE_WORK_HISTORICAL_DOMAINS), ['package.json', 'src/server.js']);
assert.deepEqual(Object.keys(BASE_WORK_TEST_GATE_DOMAINS), ['test/gates.js']);
assert.match(BASE_WORK_TEST_GATE_PHASE, /TEST Gate comparison only; no runtime, native, current-source capture/);
const file = 'test/gates.js', pin = BASE_WORK_TEST_GATE_DOMAINS[file];
assert(Object.isFrozen(BASE_WORK_TEST_GATE_DOMAINS) && Object.isFrozen(pin) && Object.isFrozen(pin.inverses));
for (const inverse of pin.inverses) assert(Object.isFrozen(inverse));
const current = git('show', BASE_WORK_TEST_GATE_SOURCE + ':' + file);
const prior = git('show', BASE_WORK_TEST_GATE_PREDECESSOR + ':' + file);
for (const [ref, prefix] of [[BASE_WORK_TEST_GATE_SOURCE, 'source'], [BASE_WORK_TEST_GATE_PREDECESSOR, 'baseline']]) {
  const tree = git('ls-tree', ref, '--', file), match = /^(\d+) blob ([a-f0-9]{40})\t/.exec(tree);
  assert(match); assert.equal(match[1], pin[prefix + 'Mode']); assert.equal(match[2], pin[prefix + 'Blob']);
  assert.equal(hash(git('show', ref + ':' + file)), pin[prefix + 'Sha256']);
}
const actualInverses = []; let hunk;
for (const line of git('diff', '--no-ext-diff', '--no-color', '--unified=3', BASE_WORK_TEST_GATE_PREDECESSOR + ':' + file,
  BASE_WORK_TEST_GATE_SOURCE + ':' + file).split('\n')) {
  if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; actualInverses.push(hunk); }
  else if (hunk && /^[ +\-]/.test(line)) { if (line[0] !== '-') hunk.current += line.slice(1) + '\n'; if (line[0] !== '+') hunk.baseline += line.slice(1) + '\n'; }
}
assert.deepEqual(actualInverses, pin.inverses); assert.equal(pin.inverses.length, 1);
let positives = 0, refusals = 0;
for (const input of [current, current.replaceAll('\n', '\r\n'), Buffer.from(current), Buffer.from(current.replaceAll('\n', '\r\n'))]) {
  const result = baseWorkHistoricalTestGateBaseline(file, input);
  assert.equal(String(result), prior); assert.equal(Buffer.isBuffer(result), Buffer.isBuffer(input));
  const proof = assertBaseWorkHistoricalTestGateTransfer(file, input);
  assert.equal(proof.sourceRevision, BASE_WORK_TEST_GATE_SOURCE); assert.equal(proof.predecessorRevision, BASE_WORK_TEST_GATE_PREDECESSOR);
  assert.equal(proof.baselineText, prior); assert.equal(proof.inverseChunks, 1); assert.equal(proof.phase, BASE_WORK_TEST_GATE_PHASE); positives++;
}
const reject = (domain, input) => {
  assert.strictEqual(baseWorkHistoricalTestGateBaseline(domain, input), input);
  assert.throws(() => assertBaseWorkHistoricalTestGateTransfer(domain, input)); refusals++;
};
for (const inverse of pin.inverses) {
  for (const input of [current.replace(inverse.current, ''), current.replace(inverse.current, () => inverse.current.repeat(2)),
    current.replace(inverse.current, () => inverse.baseline), current.replace(inverse.current, () => inverse.current.replace(/\S/, '?'))]) reject(file, input);
}
for (const input of [prior, current + '\n// unsupported TEST change\n', current.slice(1), '\ufeff' + current,
  current.replace('\n', '\r\n'), current.replace('\n', '\r'), current + '\r', current + '\0',
  Buffer.concat([Buffer.from(current), Buffer.from([255])]), null, {}, 1]) reject(file, input);
for (const domain of ['__proto__', 'constructor', './test/gates.js', 'test/gates.js.extra', 'package.json', 'src/server.js', 'tools/rc1-native-proof.js']) reject(domain, current);
for (const domain of ['package.json', 'src/server.js']) {
  const bytes = git('show', BASE_WORK_HISTORICAL_SOURCE + ':' + domain);
  reject(domain, bytes); assert.strictEqual(baseWorkHistoricalTestGateBaseline(domain, bytes), bytes);
  assert.equal(baseWorkHistoricalSourceBaseline(domain, bytes), git('show', BASE_WORK_HISTORICAL_PREDECESSOR + ':' + domain)); positives++;
}
assert.strictEqual(baseWorkHistoricalSourceBaseline(file, current), current);
assert.strictEqual(baseWorkHistoricalSourceBaseline(file, prior), prior);
const base = input => baseWorkHistoricalSourceBaseline(file, baseWorkHistoricalTestGateBaseline(file, input));
const city = input => cityActivitySourceBaseline(file, base(input));
const chains = [
  { blob: DEED_QUEST_SOURCE_DOMAINS[file].currentBlob, compose: input => marketOverDeedSourceBaseline(file, city(input)), assert: assertDeedQuestSourceTransfer },
  { revision: MARKET_OPERATIONS_SOURCE_REVISION, compose: input => deedOverMarketSourceBaseline(file, city(input)), assert: assertMarketOperationsSourceTransfer },
  { revision: NEXT_LAYER_SOURCE_REVISION, compose: input => marketOperationsSourceBaseline(file, deedQuestSourceBaseline(file, deedOverMarketSourceBaseline(file, city(input)))), assert: assertNextLayerSourceTransfer },
];
for (const chain of chains) {
  const value = chain.compose(current); assert.equal(value, chain.blob ? git('cat-file', 'blob', chain.blob) : git('show', chain.revision + ':' + file)); chain.assert(file, value); positives++;
  for (const changed of [current + '\n// unknown\n', current.slice(1), '\ufeff' + current]) {
    assert.equal(chain.compose(changed), changed); assert.throws(() => chain.assert(file, chain.compose(changed))); refusals++;
  }
}
// The wallet package is a separate exact TEST namespace, composed only before the old comparison.
assert.equal(WALLET_COMPUTE_PACKAGE_SOURCE, 'aaf468ae83d5cd6879d27131ec0512a8bcd81688');
assert.equal(WALLET_COMPUTE_PACKAGE_PREDECESSOR, BASE_WORK_HISTORICAL_SOURCE);
assert.match(WALLET_COMPUTE_PACKAGE_PHASE, /TEST package comparison only; no runtime, native, current-source capture/);
assert.deepEqual(Object.keys(WALLET_COMPUTE_PACKAGE_DOMAINS), ['package.json']);
const packageFile = 'package.json', packagePin = WALLET_COMPUTE_PACKAGE_DOMAINS[packageFile];
assert(Object.isFrozen(WALLET_COMPUTE_PACKAGE_DOMAINS) && Object.isFrozen(packagePin) && Object.isFrozen(packagePin.inverses));
for (const inverse of packagePin.inverses) assert(Object.isFrozen(inverse));
const packageCurrent = git('show', WALLET_COMPUTE_PACKAGE_SOURCE + ':' + packageFile);
const packagePrior = git('show', WALLET_COMPUTE_PACKAGE_PREDECESSOR + ':' + packageFile);
assert.equal(packageCurrent, git('show', '402e8a24388a7f5a20a61b4443643f89411df54b:' + packageFile));
for (const [ref, prefix] of [[WALLET_COMPUTE_PACKAGE_SOURCE, 'source'], [WALLET_COMPUTE_PACKAGE_PREDECESSOR, 'baseline']]) {
  const tree = git('ls-tree', ref, '--', packageFile), match = /^(\d+) blob ([a-f0-9]{40})\t/.exec(tree);
  assert(match); assert.equal(match[1], packagePin[prefix + 'Mode']); assert.equal(match[2], packagePin[prefix + 'Blob']);
  assert.equal(hash(git('show', ref + ':' + packageFile)), packagePin[prefix + 'Sha256']);
}
const packageInverses = []; let packageHunk;
for (const line of git('diff', '--no-ext-diff', '--no-textconv', '--no-color', '--unified=3', WALLET_COMPUTE_PACKAGE_PREDECESSOR + ':' + packageFile, WALLET_COMPUTE_PACKAGE_SOURCE + ':' + packageFile).split('\n')) {
  if (line.startsWith('@@')) { packageHunk = {current: '', baseline: ''}; packageInverses.push(packageHunk); }
  else if (packageHunk && /^[ +\-]/.test(line)) { if (line[0] !== '-') packageHunk.current += line.slice(1) + '\n'; if (line[0] !== '+') packageHunk.baseline += line.slice(1) + '\n'; }
  assert(!line.startsWith('\\ No newline'));
}
assert.deepEqual(packageInverses, packagePin.inverses); assert.equal(packagePin.contextLines, 3);
for (const input of [packageCurrent, packageCurrent.replaceAll('\n', '\r\n'), Buffer.from(packageCurrent), Buffer.from(packageCurrent.replaceAll('\n', '\r\n'))]) {
  const proof = assertWalletComputePackageSourceTransfer(packageFile, input);
  assert.equal(proof.baselineText, packagePrior); assert.equal(proof.sourceRevision, WALLET_COMPUTE_PACKAGE_SOURCE);
  assert.equal(proof.predecessorRevision, WALLET_COMPUTE_PACKAGE_PREDECESSOR); assert.equal(proof.sourceOnly, true); assert.equal(proof.nativeAdmission, false);
  assert.equal(String(walletComputePackageSourceBaseline(packageFile, input)), packagePrior);
  assert.equal(Buffer.isBuffer(walletComputePackageSourceBaseline(packageFile, input)), Buffer.isBuffer(input));
  assert.equal(String(baseWorkHistoricalSourceBaseline(packageFile, input)), git('show', BASE_WORK_HISTORICAL_PREDECESSOR + ':' + packageFile));
  assert.throws(() => assertBaseWorkHistoricalSourceTransfer(packageFile, input)); positives++;
}
const rejectPackage = (domain, input) => {
  assert.strictEqual(walletComputePackageSourceBaseline(domain, input), input);
  assert.throws(() => assertWalletComputePackageSourceTransfer(domain, input)); refusals++;
};
for (const inverse of packagePin.inverses) for (const input of [packageCurrent.replace(inverse.current, ''), packageCurrent.replace(inverse.current, () => inverse.current.repeat(2)), packageCurrent.replace(inverse.current, () => inverse.baseline), packageCurrent.replace(inverse.current, () => inverse.current.replace(/\S/, '?'))]) rejectPackage(packageFile, input);
for (const input of [packagePrior, packageCurrent + '\n// unknown package edit\n', packageCurrent.slice(1), '\ufeff' + packageCurrent, packageCurrent.replace('\n', '\r\n'), packageCurrent.replace('\n', '\r'), packageCurrent + '\0', Buffer.concat([Buffer.from(packageCurrent), Buffer.from([255])]), null, {}, 1]) rejectPackage(packageFile, input);
for (const domain of ['__proto__', 'constructor', './package.json', 'package.json.extra', 'src/server.js', 'test/gates.js', 'tools/rc1-native-proof.js']) rejectPackage(domain, packageCurrent);
for (const changed of [packageCurrent + '\n// unknown\n', packageCurrent.slice(1), '\ufeff' + packageCurrent]) {
  assert.strictEqual(baseWorkHistoricalSourceBaseline(packageFile, changed), changed);
  assert.throws(() => assertBaseWorkHistoricalSourceTransfer(packageFile, changed)); refusals++;
}
const packageCity = input => cityActivitySourceBaseline(packageFile, baseWorkHistoricalSourceBaseline(packageFile, baseWorkHistoricalTestGateBaseline(packageFile, input)));
const packageChains = [
  {blob: DEED_QUEST_SOURCE_DOMAINS[packageFile].currentBlob, compose: input => marketOverDeedSourceBaseline(packageFile, packageCity(input)), assert: assertDeedQuestSourceTransfer},
  {revision: MARKET_OPERATIONS_SOURCE_REVISION, compose: input => deedOverMarketSourceBaseline(packageFile, packageCity(input)), assert: assertMarketOperationsSourceTransfer},
  {revision: NEXT_LAYER_SOURCE_REVISION, compose: input => marketOperationsSourceBaseline(packageFile, deedQuestSourceBaseline(packageFile, deedOverMarketSourceBaseline(packageFile, packageCity(input)))), assert: assertNextLayerSourceTransfer},
];
for (const chain of packageChains) {
  const value = chain.compose(packageCurrent); assert.equal(value, chain.blob ? git('cat-file', 'blob', chain.blob) : git('show', chain.revision + ':' + packageFile)); chain.assert(packageFile, value); positives++;
  for (const changed of [packageCurrent + '\n// unknown\n', packageCurrent.slice(1), '\ufeff' + packageCurrent]) {assert.strictEqual(chain.compose(changed), changed); assert.throws(() => chain.assert(packageFile, chain.compose(changed))); refusals++;}
}

console.log(`base-work-test-gate-source-compatibility PASS: ${positives} exact TEST/runtime-domain composition controls; ${refusals} unknown/partial/context/type/domain refusals; no executable or native-source authority`);
