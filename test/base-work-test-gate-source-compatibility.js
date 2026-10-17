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
console.log(`base-work-test-gate-source-compatibility PASS: ${positives} exact TEST/runtime-domain composition controls; ${refusals} unknown/partial/context/type/domain refusals; no executable or native-source authority`);
