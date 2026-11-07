import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { NATIVE_ETH_SOURCE_TRANSFER as manifest, NATIVE_ETH_SOURCE_FILES,
  NATIVE_ETH_PREDECESSOR_REVISION, NATIVE_ETH_PREDECESSOR_TREE,
  assertNativeEthSourceTransfer, nativeEthHistoricalInput } from '../tools/native-eth-source-transfer.js';
import { GENESIS_FEE_READINESS_DOMAINS, assertGenesisFeeReadinessSourceTransfer } from '../tools/genesis-fee-readiness-source-transfer.js';
import { MARKET_FEE_COPY_DOMAINS, assertMarketFeeCopySourceTransfer } from '../tools/market-fee-copy-source-transfer.js';
import { questingHistoricalInput, questingHistoricalEntry } from '../tools/questing-source-transfer.js';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const lf = text => text.replaceAll('\r\n', '\n');
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
assert.equal(manifest.predecessorRevision, NATIVE_ETH_PREDECESSOR_REVISION);
assert.equal(manifest.predecessorTree, NATIVE_ETH_PREDECESSOR_TREE);
assert.equal(git('rev-parse', `${NATIVE_ETH_PREDECESSOR_REVISION}^{tree}`).trim(), NATIVE_ETH_PREDECESSOR_TREE);
assert.equal(manifest.sourceOnly, true); assert.equal(manifest.runtime, false); assert.equal(manifest.native, false);
assert(Object.isFrozen(manifest) && Object.isFrozen(manifest.files));
assert(Object.keys(manifest.files).length > 0, 'Explicit authored source pins must be generated before this test');
let positives = 0, refusals = 0;
for (const [file, pin] of Object.entries(manifest.files)) {
  assert(NATIVE_ETH_SOURCE_FILES.includes(file), 'Only closed historical domains may be projected');
  assert(Object.isFrozen(pin));
  // This is a historical text proof, not actual-current native admission. Qualify
  // complete actual HEAD/index/physical source before the exact successor view.
  const entry = git('ls-tree', 'HEAD', '--', file).trim();
  const match = entry.match(/^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/);
  assert(match && match[3] === file, 'Actual committed regular-file identity required');
  assert.equal(git('ls-files', '--stage', '--', file).trim(), `${match[1]} ${match[2]} 0\t${file}`);
  const committed = execFileSync('git', ['--no-replace-objects', 'show', 'HEAD:' + file],
    { windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
  const committedText = committed.toString('utf8'), raw = fs.readFileSync(file), stat = fs.lstatSync(file);
  assert(stat.isFile() && !stat.isSymbolicLink() && Buffer.from(committedText).equals(committed));
  assert.equal(blob(committed), match[2], 'Actual committed whole blob qualifies first');
  assert(!committedText.includes('\r'), 'Committed source must remain canonical LF');
  assert(raw.equals(committed) || raw.equals(Buffer.from(committedText.replaceAll('\n', '\r\n'))),
    'Complete actual physical LF/CRLF source qualifies before comparison: ' + file);
  const physical = String(questingHistoricalInput(file, raw)), current = lf(physical);
  assert.equal(questingHistoricalEntry(file, entry, 'tree'), `${match[1]} blob ${blob(current)}\t${file}`);
  const previous = git('show', `${NATIVE_ETH_PREDECESSOR_REVISION}:${file}`);
  assert.notEqual(current, previous, 'Unchanged files do not need a new postimage bridge');
  assert.equal(sha(current), pin.currentSha256); assert.equal(blob(current), pin.currentBlob);
  assert.equal(Buffer.byteLength(current), pin.currentBytes);
  assert.equal(sha(previous), pin.baselineSha256); assert.equal(blob(previous), pin.baselineBlob);
  assert.equal(Buffer.byteLength(previous), pin.baselineBytes);
  if (manifest.sourceRevision !== 'WORKTREE_PROPOSAL') {
    const authored = git('show', `${manifest.sourceRevision}:${file}`);
    assert.equal(lf(authored), current, 'Physical source must match the authored commit');
    assert.equal(sha(authored), pin.authoredSha256); assert.equal(blob(authored), pin.authoredBlob);
    assert.equal(Buffer.byteLength(authored), pin.authoredBytes);
  }
  const oldGuard = Object.hasOwn(GENESIS_FEE_READINESS_DOMAINS, file) ? assertGenesisFeeReadinessSourceTransfer
    : Object.hasOwn(MARKET_FEE_COPY_DOMAINS, file) ? assertMarketFeeCopySourceTransfer : null;
  for (const input of [current, current.replaceAll('\n', '\r\n'), Buffer.from(current),
    Buffer.from(current.replaceAll('\n', '\r\n')), physical, Buffer.from(physical)]) {
    const proof = assertNativeEthSourceTransfer(file, input);
    assert.equal(proof.baselineText, previous);
    assert.equal(proof.sourceRevision, manifest.sourceRevision);
    assert.equal(proof.sourceOnly, true); assert.equal(proof.runtime, false); assert.equal(proof.native, false);
    const projected = nativeEthHistoricalInput(file, input);
    assert.equal(Buffer.isBuffer(projected), Buffer.isBuffer(input));
    assert.equal(String(projected), previous);
    if (oldGuard) assert.deepEqual(oldGuard(file, input), oldGuard(file, previous),
      'Existing historical controls must still inspect exact predecessor bytes');
    positives++;
  }
  const mixed = [0, 1, 2, 3].map(index => {
    const lines = current.split('\n'); return lines.map((line, i) => line + (i === lines.length - 1 ? '' : i === index ? '\r\n' : '\n')).join('');
  }).find(text => sha(text) !== pin.exactWorkingEncoding?.sha256);
  assert(mixed && mixed !== current, 'An unpinned mixed encoding must be exercised');
  const mutants = [current + '\n// unrelated source edit\n', current.slice(1), '\ufeff' + current,
    current + '\0', current.replace('\n', '\r'), mixed,
    current.replace(/\S/, '?'), previous];
  for (const changed of mutants) for (const input of [changed, Buffer.from(changed)]) {
    assert.throws(() => assertNativeEthSourceTransfer(file, input));
    assert.strictEqual(nativeEthHistoricalInput(file, input), input, 'Unknown bytes must retain identity for the old rejecting guard');
    if (oldGuard && changed !== previous) assert.throws(() => oldGuard(file, input), 'Mutants cannot inherit historical qualification');
    refusals++;
  }
  for (const input of [null, undefined, 42, {}, [], Buffer.from([0xff, 0xfe, 0])]) {
    assert.throws(() => assertNativeEthSourceTransfer(file, input));
    assert.strictEqual(nativeEthHistoricalInput(file, input), input); refusals++;
  }
}
for (const file of ['__proto__', 'constructor', 'toString', 'src/unknown.js', './src/genesisauction.js',
  'src/../src/genesisauction.js', '/src/genesisauction.js']) {
  const input = Buffer.from('unknown\nsource\n');
  assert.throws(() => assertNativeEthSourceTransfer(file, input));
  assert.strictEqual(nativeEthHistoricalInput(file, input), input); refusals++;
}
console.log(`Native ETH historical source transfer PASS: ${Object.keys(manifest.files).length} exact postimages, ${positives} positives, ${refusals} refusals; sourceOnly=true; runtime=false; native=false; ${manifest.sourceRevision}`);
