// Exact source reconstruction only. No application, database, network or native execution.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as O from '../tools/businessdesk-source-transfer.js';

assert.deepEqual(process.argv.slice(2), [], 'Bare source-only entrypoint required.');
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], {
  encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
});
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
const inverseHunks = diff => {
  const rows = []; let hunk = null;
  for (const line of diff.split('\n')) {
    if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; rows.push(hunk); }
    else if (hunk && /^[ +\-]/.test(line)) {
      if (line[0] !== '-') hunk.current += `${line.slice(1)}\n`;
      if (line[0] !== '+') hunk.baseline += `${line.slice(1)}\n`;
    }
  }
  return rows;
};
const files = [".github/workflows/ci.yml","package.json","public/index.html","src/server.js","test/deed-allocation-source-compatibility.js","test/gates.js","tools/deed-allocation-source-transfer.js","tools/enterprise-native-ux-seal.js","tools/enterprise-native-ux.js"];
const phase = 'exact-business-control-desk-source-transfer-only; no historical runtime, native, migration, financial, activation or deployment clearance';
assert.equal(O.BUSINESS_DESK_REVISION, 'ed1bf2ff973b6c6c5f0fdfd6c011e414cc60aa23');
assert.equal(O.BUSINESS_DESK_PREDECESSOR, 'a343fe067f7a1d244d761d8f4da7b3aea337809f');
assert.equal(O.BUSINESS_DESK_TREE, '4e8bd2c8d5fc0fa3c7a530f81f56f925925ae7ea');
assert.equal(O.BUSINESS_DESK_PREDECESSOR_TREE, 'a2e8d4c21d701a6f013c29ecfa18d0976918e7ed');
assert.equal(O.BUSINESS_DESK_PHASE, phase);
assert.deepEqual(Object.keys(O.BUSINESS_DESK_DOMAINS), files);
assert(Object.isFrozen(O.BUSINESS_DESK_DOMAINS));
assert.equal(git('rev-parse', `${O.BUSINESS_DESK_REVISION}^{tree}`).trim(), O.BUSINESS_DESK_TREE);
assert.equal(git('rev-parse', `${O.BUSINESS_DESK_PREDECESSOR}^{tree}`).trim(), O.BUSINESS_DESK_PREDECESSOR_TREE);
git('merge-base', '--is-ancestor', O.BUSINESS_DESK_PREDECESSOR, O.BUSINESS_DESK_REVISION);
git('merge-base', '--is-ancestor', O.BUSINESS_DESK_REVISION, 'HEAD');

let positives = 0, refusals = 0, inverseCount = 0;
const refused = (file, input) => {
  assert.throws(() => O.assertBusinessDeskSourceTransfer(file, input), error => error?.code === 'ERR_ASSERTION');
  refusals++;
};
for (const file of files) {
  const pin = O.BUSINESS_DESK_DOMAINS[file];
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));
  assert.equal(pin.mode, '100644'); assert.equal(pin.baselineMode, '100644'); assert.equal(pin.contextLines, 3); assert(pin.inverses.length > 0);
  const current = git('show', `${O.BUSINESS_DESK_REVISION}:${file}`);
  const baseline = git('show', `${O.BUSINESS_DESK_PREDECESSOR}:${file}`);
  assert.equal(git('ls-tree', O.BUSINESS_DESK_REVISION, '--', file).trim(), `${pin.mode} blob ${pin.currentBlob}\t${file}`);
  assert.equal(git('ls-tree', O.BUSINESS_DESK_PREDECESSOR, '--', file).trim(), `${pin.baselineMode} blob ${pin.baselineBlob}\t${file}`);
  assert.equal(current, git('show', pin.currentBlob)); assert.equal(baseline, git('show', pin.baselineBlob));
  assert.equal(sha(current), pin.currentSha256); assert.equal(blob(current), pin.currentBlob); assert.equal(Buffer.byteLength(current), pin.currentBytes);
  assert.equal(sha(baseline), pin.baselineSha256); assert.equal(blob(baseline), pin.baselineBlob); assert.equal(Buffer.byteLength(baseline), pin.baselineBytes);
  assert(current.endsWith('\n') && current.indexOf('\n') !== current.lastIndexOf('\n'));
  assert.deepEqual(pin.inverses, inverseHunks(git('diff', '--no-ext-diff', '--unified=3', O.BUSINESS_DESK_PREDECESSOR, O.BUSINESS_DESK_REVISION, '--', file)));
  let reconstructed = current;
  for (const inverse of pin.inverses) {
    assert(inverse.current.length); assert.equal(reconstructed.split(inverse.current).length - 1, 1);
    reconstructed = reconstructed.replace(inverse.current, () => inverse.baseline);
    for (const changed of [current.replace(inverse.current, ''), current.replace(inverse.current, () => inverse.current + inverse.current),
      current.replace(inverse.current, () => inverse.baseline), current.replace(inverse.current, () => inverse.current.replace(/\S/, '?'))]) refused(file, changed);
    assert.throws(() => { inverse.current = 'unreviewed'; }, TypeError); inverseCount++;
  }
  assert.equal(reconstructed, baseline, 'Every exact actual Git hunk reconstructs the complete predecessor.');
  for (const input of [current, current.replaceAll('\n', '\r\n')]) {
    const proof = O.assertBusinessDeskSourceTransfer(file, input);
    assert(Object.isFrozen(proof));
    assert.deepEqual(Object.keys(proof).sort(), ['file', 'baselineText', 'postimageSha256', 'sourceRevision', 'predecessorRevision', 'inverseChunks', 'phase', 'sourceOnly', 'runtime', 'native'].sort());
    assert.equal(proof.file, file); assert.equal(proof.baselineText, baseline); assert.equal(proof.postimageSha256, pin.currentSha256);
    assert.equal(proof.sourceRevision, O.BUSINESS_DESK_REVISION); assert.equal(proof.predecessorRevision, O.BUSINESS_DESK_PREDECESSOR);
    assert.equal(proof.inverseChunks, pin.inverses.length); assert.equal(proof.phase, phase);
    assert.deepEqual([proof.sourceOnly, proof.runtime, proof.native], [true, false, false]);
    assert.equal(O.businessDeskHistoricalInput(file, input), baseline);
    assert.deepEqual(O.businessDeskHistoricalInput(file, Buffer.from(input)), Buffer.from(baseline));
    positives += 3;
  }
  const altered = [baseline, current + '\n', current.slice(0, -1), current.slice(1), '\ufeff' + current,
    current + '\0', current.replace(/\S/, '?'), current.replace('\n', '\r\n'), current.replace('\n', '\r'),
    current + '// unknown future source\n'];
  for (const changed of altered) {
    refused(file, changed);
    assert.equal(O.businessDeskHistoricalInput(file, changed), changed, 'The historical input helper must leave unqualified bytes untouched.');
    const bytes = Buffer.from(changed); assert.strictEqual(O.businessDeskHistoricalInput(file, bytes), bytes);
  }
  for (const changed of [Buffer.from(current), null, undefined, 7, {}]) refused(file, changed);
  const invalidUtf8 = Buffer.concat([Buffer.from(current), Buffer.from([0xff])]);
  assert.throws(() => O.businessDeskHistoricalInput(file, invalidUtf8), /Lossless UTF-8/); refusals++;
  assert.throws(() => { pin.currentSha256 = '0'.repeat(64); }, TypeError);
  assert.throws(() => { pin.inverses.push({ current: 'unreviewed', baseline: '' }); }, TypeError);
}
for (const file of ['__proto__', 'constructor', 'toString', '../src/server.js', 'unknown', null, undefined, {}, [], 7, Symbol('domain')]) {
  for (const input of ['unreviewed', Buffer.from([0xff, 0, 13]), null, {}]) {
    refused(file, input); assert.strictEqual(O.businessDeskHistoricalInput(file, input), input);
  }
}
const hook = 'tools/deed-allocation-source-transfer.js';
const authoredHook = git('show', `${O.BUSINESS_DESK_REVISION}:${hook}`);
const preservedHook = authoredHook
  .replace("import { businessDeskHistoricalInput } from './businessdesk-source-transfer.js';\n", '')
  .replace("  if (typeof file !== 'string') return input;\n  input = businessDeskHistoricalInput(file, input);\n  if (!Object.hasOwn(DEED_ALLOCATION_SOURCE_DOMAINS, file)) return input;",
    "  if (typeof file !== 'string' || !Object.hasOwn(DEED_ALLOCATION_SOURCE_DOMAINS, file)) return input;");
assert.notEqual(preservedHook, authoredHook);
assert.equal(preservedHook, git('show', `${O.BUSINESS_DESK_PREDECESSOR}:${hook}`),
  'Only the exact Business source hook is added; every original Deed qualifier and predicate is preserved.');
assert.throws(() => { O.BUSINESS_DESK_REVISION = '0'.repeat(40); }, TypeError);
assert.throws(() => { O.BUSINESS_DESK_DOMAINS.unreviewed = {}; }, TypeError);
console.log(JSON.stringify({ phase, source: O.BUSINESS_DESK_REVISION, predecessor: O.BUSINESS_DESK_PREDECESSOR,
  files: files.length, inverseHunks: inverseCount, positives, refusals, sourceOnly: true, runtime: false, native: false }));
