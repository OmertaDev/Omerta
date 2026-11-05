// Qualify actual redesigned bytes independently of the historical readers they preserve.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { NOIR_UI_SOURCE, NOIR_UI_SOURCE_FILES, assertNoirUiSourceTransfer,
  noirUiHistoricalInput } from '../tools/noir-ui-source-transfer.js';
import { combinedEconomicDeedPin, combinedNoirUiInput } from '../tools/combined-economic-deed-source-transfer.js';

const revision = '42d9df7628a30653ff7c8bac203b7bd317dee597';
const predecessor = 'fe887350a661901983282183fb21e9d1d330f04f';
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], {
  encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024,
});
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const lf = text => text.replaceAll('\r\n', '\n');
assert.equal(NOIR_UI_SOURCE.revision, revision);
assert.equal(combinedEconomicDeedPin.noirSource, revision);
assert.deepEqual(Object.keys(combinedEconomicDeedPin.noirFiles), ['package.json', 'public/index.html', 'test/ux-community-browser.js']);
assert.equal(NOIR_UI_SOURCE.predecessor, predecessor);
assert.equal(NOIR_UI_SOURCE.tree, git('rev-parse', revision + '^{tree}').trim());
assert.equal(NOIR_UI_SOURCE.predecessorTree, git('rev-parse', predecessor + '^{tree}').trim());
assert.equal(git('rev-parse', revision + '^').trim(), predecessor);
git('merge-base', '--is-ancestor', revision, 'HEAD');
assert.deepEqual(git('diff', '--name-only', predecessor, revision).trim().split('\n').sort(),
  [...NOIR_UI_SOURCE_FILES].sort());

let positives = 0, refusals = 0;
for (const file of NOIR_UI_SOURCE_FILES) {
  const committed = git('show', `${revision}:${file}`);
  const physical = fs.readFileSync(file, 'utf8');
  const actual = git('show', `HEAD:${file}`);
  assert(physical === actual || physical === actual.replaceAll('\n', '\r\n'), 'Complete checked-out UI source: ' + file);
  assert.equal(lf(combinedNoirUiInput(file, physical)), committed, 'Reviewed integrated UI reconstructs its original Noir source: ' + file);
  const combined = combinedEconomicDeedPin.noirFiles[file];
  if (combined) {
    assert.equal(actual, git('show', `${combinedEconomicDeedPin.source}:${file}`));
    assert.equal(sha(actual), combined.current.sha256);
    assert.equal(sha(committed), combined.baseline.sha256);
    assert.equal(combinedNoirUiInput(file, actual.replaceAll('\n', '\r\n')), committed);
    assert.deepEqual(combinedNoirUiInput(file, Buffer.from(actual)), Buffer.from(committed));
    for (const changed of [actual.slice(1), actual + '\n', actual + '\0', actual.replace('\n', '\r\n'),
      ...combined.inverses.map(h => actual.slice(0, h.at) + h.baseline + actual.slice(h.at + h.current.length))]) {
      assert.equal(combinedNoirUiInput(file, changed), changed);
      if (changed !== committed) assert.equal(noirUiHistoricalInput(file, changed), changed);
    }
  }
  const pin = NOIR_UI_SOURCE.files.find(row => row.file === file);
  assert.equal(sha(committed), pin.currentSha256);
  assert.equal(pin.currentBlob, git('rev-parse', `${revision}:${file}`).trim());
  for (const source of [committed, committed.replaceAll('\n', '\r\n')]) {
    const proof = assertNoirUiSourceTransfer(file, source);
    assert.equal(proof.sourceOnly, true); assert.equal(proof.runtime, false); assert.equal(proof.native, false);
    if (!pin.predecessorAbsent) {
      const baseline = git('show', `${predecessor}:${file}`);
      assert.equal(proof.baselineText, baseline);
      assert.equal(noirUiHistoricalInput(file, source), baseline);
      assert.deepEqual(noirUiHistoricalInput(file, Buffer.from(source)), Buffer.from(baseline));
    } else {
      assert.equal(file, 'test/ux-shell-browser.js');
      assert.equal(proof.baselineText, null);
      assert.equal(noirUiHistoricalInput(file, source), source);
    }
    positives++;
  }
  const mutations = [committed + '\n// unreviewed successor\n', committed.slice(1),
    committed.replace('\n', '\r\n'), '\ufeff' + committed, committed + '\0'];
  if (pin.inverses.length) {
    const hunk = pin.inverses[0].current;
    mutations.push(committed.replace(hunk, hunk + '\n'), committed + hunk);
  }
  for (const changed of mutations) {
    assert.throws(() => assertNoirUiSourceTransfer(file, changed));
    assert.equal(noirUiHistoricalInput(file, changed), changed, 'Unknown bytes gain no historical authority');
    refusals++;
  }
  assert.throws(() => assertNoirUiSourceTransfer(file, committed, { ...NOIR_UI_SOURCE }));
  refusals++;
}
assert.throws(() => assertNoirUiSourceTransfer('src/server.js', 'unreviewed'));
assert.equal(noirUiHistoricalInput('src/server.js', 'unreviewed'), 'unreviewed');
assert.throws(() => noirUiHistoricalInput('public/index.html', Buffer.from([0xff])));
assert.equal(git('diff', '--name-only', predecessor, revision, '--', 'src', 'schema.sql', 'render.yaml', 'package-lock.json'), '',
  'No runtime backend, schema, deployment settings, or dependency changes');
console.log(`Noir UI source qualification PASS: ${positives} exact LF/CRLF sources, ${refusals} refusals; historical source only`);
