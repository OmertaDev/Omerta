// Qualify actual redesigned bytes independently of the historical readers they preserve.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { contractReleaseDeskInput } from '../tools/contract-release-source-transfer.js';
import { businessDeskNoirHistoricalInput } from '../tools/businessdesk-noir-source-transfer.js';
import { NOIR_UI_SOURCE, NOIR_UI_SOURCE_FILES, assertNoirUiSourceTransfer,
  noirUiHistoricalInput } from '../tools/noir-ui-source-transfer.js';

const revision = '42d9df7628a30653ff7c8bac203b7bd317dee597';
const predecessor = 'fe887350a661901983282183fb21e9d1d330f04f';
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], {
  encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024,
});
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const lf = text => text.replaceAll('\r\n', '\n');
assert.equal(NOIR_UI_SOURCE.revision, revision);
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
  const physical = businessDeskNoirHistoricalInput(file, contractReleaseDeskInput(file, fs.readFileSync(file, 'utf8')), 'noir');
  assert.equal(lf(physical), committed, 'Actual UI source matches reviewed revision: ' + file);
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
