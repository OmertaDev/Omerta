import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  ECONOMY_HARDENING_SOURCE_REVISION, ECONOMY_HARDENING_SOURCE_TREE,
  ECONOMY_HARDENING_SOURCE_PREDECESSOR, ECONOMY_HARDENING_SOURCE_PREDECESSOR_TREE,
  ECONOMY_HARDENING_SOURCE_PHASE, ECONOMY_HARDENING_SOURCE_DOMAINS, ECONOMY_HARDENING_BINDING_DOMAINS,
  assertEconomyHardeningSourceTransfer, assertEconomyHardeningBindingTransfer, economyHardeningSourceBaseline,
} from '../tools/economy-hardening-source-transfer.js';

const expectedRevision = '913731168052c928bae5451f56f4c15007eda89e';
const expectedPredecessor = '048d92fcbffea75da161f4ac65f0076f5a4e3e70';
const files = [
  '.github/workflows/ci.yml',
  'public/index.html', 'schema.sql', 'src/accrual.js', 'src/boxing.js', 'src/db.js', 'src/economy.js', 'src/explore.js', 'src/game.js',
  'src/goodsquote.js', 'src/invariants.js', 'src/kitchen.js', 'src/market.js', 'src/rules.tail.js', 'src/server.js',
  'src/pen.js', 'src/population.js', 'src/races.js', 'src/social/estate.js', 'src/stable.js',
  'test/gates.js', 'test/growth.js', 'test/phase2-postgres.js',
  'tools/arena.js', 'tools/commerce-deed-release-phase2-native-catalog.js',
];
const bindingFiles = [
  'package.json', 'public/index.html', 'schema.sql', 'src/db.js', 'src/game.js', 'src/rules.tail.js', 'src/server.js', 'test/growth.js',
  'test/commerce-release-phase2-migration-catalog.js',
  'test/continuous-city-source-compatibility.js', 'test/enterprise-release-phase2-migration-catalog.js',
  'test/lib/rc1-historical-source-fixture.js',
  'tools/commerce-current-enterprise-source-compatibility.js', 'tools/commerce-deed-release-phase2-native-catalog.js',
  'tools/deed-quest-source-transfer.js', 'tools/enterprise-deed-release-phase2-migration-catalog.js',
  'tools/player-intel-source-compatibility.js', 'tools/rc1-company-operator-source-compatibility.js',
  'tools/rc1-deed-source-compatibility.js', 'tools/rc1-invoice-source-compatibility.js',
  'tools/rc1-world-qualification.js',
];
const lf = text => text.replaceAll('\r\n', '\n');
const git = (...args) => lf(execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  stdio: ['ignore', 'pipe', 'pipe'] }));
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
const inverseHunks = (file, base = expectedPredecessor, tip = expectedRevision) => {
  const inverses = []; let hunk = null;
  const args = ['diff', '--no-ext-diff', '--unified=3', base]; if (tip) args.push(tip); args.push('--', file);
  for (const line of git(...args).split('\n')) {
    if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; inverses.push(hunk); }
    else if (hunk && /^[ +\-]/.test(line)) {
      if (line[0] !== '-') hunk.current += line.slice(1) + '\n';
      if (line[0] !== '+') hunk.baseline += line.slice(1) + '\n';
    }
  }
  return inverses;
};

assert.equal(ECONOMY_HARDENING_SOURCE_REVISION, expectedRevision);
assert.equal(ECONOMY_HARDENING_SOURCE_PREDECESSOR, expectedPredecessor);
execFileSync('git', ['merge-base', '--is-ancestor', expectedPredecessor, expectedRevision]);
assert.equal(git('rev-parse', `${expectedRevision}^{tree}`).trim(), ECONOMY_HARDENING_SOURCE_TREE);
assert.equal(git('rev-parse', `${expectedPredecessor}^{tree}`).trim(), ECONOMY_HARDENING_SOURCE_PREDECESSOR_TREE);
assert.match(ECONOMY_HARDENING_SOURCE_PHASE, /exact-source-transfer-only/);
assert.deepEqual(Object.keys(ECONOMY_HARDENING_SOURCE_DOMAINS), files);
assert(Object.isFrozen(ECONOMY_HARDENING_SOURCE_DOMAINS));
assert.deepEqual(Object.keys(ECONOMY_HARDENING_BINDING_DOMAINS), bindingFiles);
assert(Object.isFrozen(ECONOMY_HARDENING_BINDING_DOMAINS));

let positives = 0, refusals = 0, hunks = 0;
for (const file of files) {
  const pin = ECONOMY_HARDENING_SOURCE_DOMAINS[file];
  const current = git('show', `${expectedRevision}:${file}`), baseline = git('show', `${expectedPredecessor}:${file}`);
  const physical = lf(fs.readFileSync(file, 'utf8'));
  const authored = bindingFiles.includes(file)
    ? assertEconomyHardeningBindingTransfer(file, physical).baselineText : physical;
  assert.equal(authored, current, `Physical source must reconstruct the authored candidate: ${file}`);
  assert.deepEqual(Object.keys(pin).sort(), ['mode', 'currentSha256', 'currentBlob', 'baselineSha256', 'baselineBlob', 'contextLines', 'inverses'].sort());
  assert.equal(pin.contextLines, 3); assert(Object.isFrozen(pin)); assert(Object.isFrozen(pin.inverses));
  assert(pin.inverses.length > 0 && pin.inverses.every(Object.isFrozen));
  assert.equal(hash(current), pin.currentSha256); assert.equal(blob(current), pin.currentBlob);
  assert.equal(hash(baseline), pin.baselineSha256); assert.equal(blob(baseline), pin.baselineBlob);
  assert.equal(git('rev-parse', `${expectedRevision}:${file}`).trim(), pin.currentBlob);
  assert.equal(git('rev-parse', `${expectedPredecessor}:${file}`).trim(), pin.baselineBlob);
  assert.equal(git('ls-tree', expectedRevision, '--', file).trim().split(/\s+/)[0], pin.mode);
  assert.deepEqual(pin.inverses, inverseHunks(file));
  const transfer = assertEconomyHardeningSourceTransfer(file, current);
  assert.equal(transfer.baselineText, baseline); assert.equal(transfer.sourceOnly, true);
  assert.equal(transfer.sourceRevision, expectedRevision); assert.equal(transfer.predecessorRevision, expectedPredecessor);
  assert.equal(economyHardeningSourceBaseline(file, current), baseline);
  assert.equal(economyHardeningSourceBaseline(file, current.replaceAll('\n', '\r\n')), baseline);
  assert.equal(economyHardeningSourceBaseline(file, baseline), baseline);
  if (bindingFiles.includes(file)) {
    assert.equal(economyHardeningSourceBaseline(file, physical), baseline);
    assert.equal(economyHardeningSourceBaseline(file, physical.replaceAll('\n', '\r\n')), baseline);
    positives += 2;
  }
  for (const changed of [current + '\n// drift\n', current.slice(1), '\ufeff' + current, current + '\0', Buffer.from(current)]) {
    assert.throws(() => assertEconomyHardeningSourceTransfer(file, changed));
    assert.equal(economyHardeningSourceBaseline(file, changed), changed); refusals++;
  }
  positives += 3; hunks += pin.inverses.length;
}
for (const file of bindingFiles) {
  const pin = ECONOMY_HARDENING_BINDING_DOMAINS[file], current = lf(fs.readFileSync(file, 'utf8'));
  const baseline = git('show', `${expectedRevision}:${file}`);
  const historical = files.includes(file) ? git('show', `${expectedPredecessor}:${file}`) : baseline;
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));
  assert.equal(hash(current), pin.currentSha256); assert.equal(blob(current), pin.currentBlob);
  assert.equal(hash(baseline), pin.baselineSha256); assert.equal(blob(baseline), pin.baselineBlob);
  assert.equal(git('rev-parse', `${expectedRevision}:${file}`).trim(), pin.baselineBlob);
  assert.equal(git('ls-tree', expectedRevision, '--', file).trim().split(/\s+/)[0], pin.mode);
  assert.deepEqual(pin.inverses, inverseHunks(file, expectedRevision, null));
  const transfer = assertEconomyHardeningBindingTransfer(file, current);
  assert.equal(transfer.baselineText, baseline); assert.equal(transfer.sourceOnly, true);
  assert.equal(economyHardeningSourceBaseline(file, current), historical);
  assert.equal(economyHardeningSourceBaseline(file, current.replaceAll('\n', '\r\n')), historical);
  for (const changed of [current + '\n// drift\n', current.slice(1), '\ufeff' + current, current + '\0', Buffer.from(current)]) {
    assert.throws(() => assertEconomyHardeningBindingTransfer(file, changed));
    assert.equal(economyHardeningSourceBaseline(file, changed), changed); refusals++;
  }
  positives += 2; hunks += pin.inverses.length;
}
for (const file of ['__proto__', 'src/unknown.js', 'schema.sql.extra']) {
  const text = 'unknown\r\nbytes\n';
  assert.throws(() => assertEconomyHardeningSourceTransfer(file, text));
  assert.equal(economyHardeningSourceBaseline(file, text), text); refusals++;
}
console.log(`Economy-hardening exact source transfer PASS: ${positives} positives, ${refusals} refusals, ${hunks} inverse hunks; historical pins unchanged`);
