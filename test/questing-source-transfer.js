// Source-comparison proof only: no reconstructed source is loaded or executed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { QUESTING_SOURCE as source, qualifyQuestingSource,
  questingHistoricalInput, questingHistoricalEntry } from '../tools/questing-source-transfer.js';

const files = [
  ".github/workflows/ci.yml",
  "package.json",
  "public/index.html",
  "schema.sql",
  "src/agentgateway.js",
  "src/clues.js",
  "src/content/compiler.js",
  "src/content/runtime.js",
  "src/explore.js",
  "src/game.js",
  "src/gateway/context.js",
  "src/routes/content.js",
  "src/server.js",
  "src/ux-workspace.js",
  "test/age-eligibility-source-compatibility.js",
  "test/businessdesk-combined-native-provenance.js",
  "test/businessdesk-combined-source-compatibility.js",
  "test/businessdesk-native-provenance.js",
  "test/businessdesk-noir-source-compatibility.js",
  "test/classic-interface-source-compatibility.js",
  "test/commerce-release-phase2-migration-catalog.js",
  "test/commerce-source-compatibility.js",
  "test/content-api.js",
  "test/continuous-city-source-compatibility.js",
  "test/contract-release-source-compatibility.js",
  "test/deed-allocation-source-compatibility.js",
  "test/economy-deed-merge-source-compatibility.js",
  "test/economy-hardening-source-compatibility.js",
  "test/economy-monitor-source-compatibility.js",
  "test/enterprise-current-source-compatibility.js",
  "test/enterprise-release-phase2-migration-catalog.js",
  "test/gates.js",
  "test/native-eth-source-transfer.js",
  "test/noir-ui-source-compatibility.js",
  "test/sale-source-compatibility.js",
  "test/ux-source-compatibility.js",
  "test/wiki-media-source-transfer.js",
  "tools/commerce-current-enterprise-source-compatibility.js",
  "tools/rc1-world-qualification.js"
];
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], {
  encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024,
});
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
assert.equal(source.status, 'SEALED');
assert.equal(source.phase, 'EXACT_QUESTING_SOURCE_COMPARISON_ONLY');
assert.equal(source.revision, 'adc97a15eb3feb8c6d2501e475b21dff1cd7524f');
assert.equal(source.predecessor, '17fdf85fdd21fd3767463df8ba47614f7d1f6432');
assert.deepEqual(Object.keys(source.files), files);
assert(Object.isFrozen(source) && Object.isFrozen(source.files));
for (const [revision, tree] of [[source.revision, source.tree], [source.predecessor, source.predecessorTree]])
  assert.equal(git('rev-parse', `${revision}^{tree}`).trim(), tree);
git('merge-base', '--is-ancestor', source.predecessor, source.revision);
git('merge-base', '--is-ancestor', source.revision, 'HEAD');
const changed = git('diff', '--name-only', '--diff-filter=M', '-z', source.predecessor, source.revision)
  .split('\0').filter(file => file === 'package.json' || file === 'schema.sql'
    || (/^(?:src|test|tools|public)\//.test(file) && /\.(?:[cm]?js|[cm]?ts|jsx|tsx|json|html|css|sql|sh|ps1)$/.test(file))
    || /^\.github\/workflows\/[^/]+\.ya?ml$/.test(file));
assert.deepEqual(changed, files, 'Every changed comparison domain is pinned independently');
let positives = 0, refusals = 0, hunks = 0;
for (const [file, row] of Object.entries(source.files)) {
  assert(Object.isFrozen(row) && Object.isFrozen(row.current) && Object.isFrozen(row.baseline)
    && Object.isFrozen(row.inverses) && row.inverses.every(Object.isFrozen));
  const current = git('show', `${source.revision}:${file}`), baseline = git('show', `${source.predecessor}:${file}`);
  for (const [revision, text, pin] of [[source.revision, current, row.current], [source.predecessor, baseline, row.baseline]]) {
    assert.equal(git('ls-tree', revision, '--', file).trim(), `${pin.mode} blob ${pin.blob}\t${file}`);
    assert.equal(sha(text), pin.sha256); assert.equal(blob(text), pin.blob);
    assert.equal(Buffer.byteLength(text), pin.bytes);
  }
  // Actual physical and stage-zero bytes qualify against actual HEAD first.
  const committed = git('show', `HEAD:${file}`), raw = fs.readFileSync(file), stat = fs.lstatSync(file);
  const entry = git('ls-tree', 'HEAD', '--', file).trim(), index = git('ls-files', '--stage', '--', file).trim();
  assert(stat.isFile() && !stat.isSymbolicLink());
  assert.equal(committed, current, 'The scoped physical source must still be exactly the approved questing source');
  assert.equal(entry, `${row.current.mode} blob ${blob(committed)}\t${file}`);
  assert.equal(index, `${row.current.mode} ${blob(committed)} 0\t${file}`);
  assert(raw.equals(Buffer.from(committed)) || raw.equals(Buffer.from(committed.replaceAll('\n', '\r\n'))),
    'Actual physical source must be complete uniform LF or CRLF: ' + file);
  for (const input of [current, current.replaceAll('\n', '\r\n'), Buffer.from(current), raw]) {
    const proof = qualifyQuestingSource(file, input);
    assert.equal(proof.baselineText, baseline);
    assert.deepEqual([proof.sourceOnly, proof.runtime, proof.native, proof.financial, proof.activation,
      proof.deployment, proof.priorResultsTransferred], [true, false, false, false, false, false, false]);
    assert.equal(String(questingHistoricalInput(file, input)), baseline);
    assert.equal(Buffer.isBuffer(questingHistoricalInput(file, input)), Buffer.isBuffer(input)); positives++;
  }
  for (const kind of ['tree', 'index']) {
    const actual = kind === 'tree' ? entry : index;
    const expected = kind === 'tree' ? `${row.baseline.mode} blob ${row.baseline.blob}\t${file}`
      : `${row.baseline.mode} ${row.baseline.blob} 0\t${file}`;
    assert.equal(questingHistoricalEntry(file, actual, kind), expected);
    assert.equal(questingHistoricalEntry(file, actual + '\n', kind), expected + '\n'); positives += 2;
    for (const mutation of [actual.replace(row.current.blob, '0'.repeat(40)), ' ' + actual,
      actual + '\n\n', actual + '\r\n', actual.replace(row.current.mode, '120000'), actual.replace(file, 'src/unapproved.js')]) {
      assert.throws(() => questingHistoricalEntry(file, mutation, kind)); refusals++;
    }
  }
  const byteMutation = Buffer.from(current);
  let mutationAt = Math.floor(byteMutation.length / 2);
  while (byteMutation[mutationAt] < 32 || byteMutation[mutationAt] > 126) mutationAt = (mutationAt + 1) % byteMutation.length;
  byteMutation[mutationAt] = byteMutation[mutationAt] === 63 ? 33 : 63;
  for (const mutation of [current + '\n// unrelated broad source edit\n', current.slice(1), '\ufeff' + current,
    current + '\0', current.replace(/\S/, '?'), current.replace('\n', '\r\n'), current.replace('\n', '\r'),
    byteMutation, baseline, null]) {
    assert.throws(() => qualifyQuestingSource(file, mutation));
    assert.strictEqual(questingHistoricalInput(file, mutation), mutation); refusals++;
  }
  const invalidUtf8 = Buffer.from([0xc3, 0x28]);
  assert.throws(() => qualifyQuestingSource(file, invalidUtf8));
  assert.throws(() => questingHistoricalInput(file, invalidUtf8)); refusals++;
  for (const inverse of row.inverses) {
    assert.equal(current.slice(inverse.at, inverse.at + inverse.current.length), inverse.current);
    for (const replacement of [inverse.baseline, '', inverse.current + inverse.current,
      inverse.current.replace(/\S/, character => character === '?' ? '!' : '?')]) {
      const partial = current.slice(0, inverse.at) + replacement + current.slice(inverse.at + inverse.current.length);
      assert.notEqual(partial, current, 'Each inverse refusal must actually mutate the whole source');
      assert.throws(() => qualifyQuestingSource(file, partial));
      assert.strictEqual(questingHistoricalInput(file, partial), partial); refusals++;
    }
    hunks++;
  }
  assert.throws(() => qualifyQuestingSource(file, current, { sourceOnly: false })); refusals++;
}
for (const file of ['src/questing.js', 'src/quest-workshop.js', '../src/server.js', 'src\\server.js',
  'omerta.quest.anything', '__proto__', 'constructor', '.github/workflows/economy-hardening.yml']) {
  const input = 'unapproved namespace source\n', entry = '100644 blob ' + 'a'.repeat(40) + '\t' + file;
  assert.throws(() => qualifyQuestingSource(file, input));
  assert.strictEqual(questingHistoricalInput(file, input), input);
  assert.strictEqual(questingHistoricalEntry(file, entry, 'tree'), entry); refusals++;
}
for (const file of ['src/economy.js', 'src/questing.js', 'tools/questing-source-transfer.js']) {
  const raw = fs.readFileSync(file);
  assert.throws(() => qualifyQuestingSource(file, raw), 'Unchanged and newly added files cannot inherit prior qualification');
  assert.strictEqual(questingHistoricalInput(file, raw), raw); refusals++;
}
// This new envelope is absent from production code; it cannot cause runtime or
// native tests to execute reconstructed predecessor implementations.
assert.throws(() => git('grep', '-n', 'questing-source-transfer', '--', 'src'),
  error => error.status === 1, 'No game source imports this comparison-only envelope');
assert.equal(hunks, 196);
console.log(`Questing exact source-only successor PASS: ${positives} positives, ${refusals} refusals, ${hunks} inverse hunks; no runtime/native/economic/deployment results transferred`);

// Pure helper-module controls exercise the private success-only cache without
// modifying repository source, index, declarations, or any runtime evidence.
const helperText = fs.readFileSync(new URL('../tools/questing-source-transfer.js', import.meta.url), 'utf8');
const cacheFile = 'src/server.js', cacheCurrent = git('show', `${source.revision}:${cacheFile}`);
const cacheBaseline = git('show', `${source.predecessor}:${cacheFile}`);
let cacheRefusals = 0;
const cacheRefused = (operation, expected) => { assert.throws(operation, expected); cacheRefusals++; };
const invalidStatus = helperText.replace('"status": "SEALED"', '"status": "UNBOUND"');
const invalidDigest = helperText.replace(/const expectedDigest = '([a-f0-9]{64})';/, (_match, digest) =>
  `const expectedDigest = '${digest[0] === '0' ? '1' : '0'}${digest.slice(1)}';`);
for (const text of [invalidStatus, invalidDigest]) {
  assert.notEqual(text, helperText, 'The isolated binding control must actually change the module');
  const guard = await import('data:text/javascript;base64,' + Buffer.from(text).toString('base64'));
  for (let attempt = 0; attempt < 2; attempt++) {
    cacheRefused(() => guard.qualifyQuestingSource(cacheFile, cacheCurrent), { code: 'ERR_ASSERTION' });
  }
}
assert.equal(qualifyQuestingSource(cacheFile, cacheCurrent).baselineText, cacheBaseline);
cacheRefused(() => { source.status = 'UNBOUND'; }, TypeError);
cacheRefused(() => { source.files[cacheFile].current.sha256 = '0'.repeat(64); }, TypeError);
cacheRefused(() => qualifyQuestingSource(cacheFile, cacheCurrent + '\n'), { code: 'ERR_ASSERTION' });
cacheRefused(() => qualifyQuestingSource('src/game.js', cacheCurrent), { code: 'ERR_ASSERTION' });
cacheRefused(() => qualifyQuestingSource('omerta.quest.unreviewed', cacheCurrent), { code: 'ERR_ASSERTION' });
assert.equal(cacheRefusals, 9);
console.log(JSON.stringify({ phase: 'QUESTING_DEFINITION_CACHE_CONTROLS', positiveWarmups: 1,
  additionalRefusals: cacheRefusals, failedFirstAndSecondBindingCalls: 4,
  sourceOnly: true, runtime: false, native: false }));
