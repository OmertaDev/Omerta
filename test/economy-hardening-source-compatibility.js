import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  ECONOMY_HARDENING_SOURCE_REVISION, ECONOMY_HARDENING_SOURCE_TREE,
  ECONOMY_HARDENING_SOURCE_PREDECESSOR, ECONOMY_HARDENING_SOURCE_PREDECESSOR_TREE,
  ECONOMY_HARDENING_SOURCE_PHASE, ECONOMY_HARDENING_SOURCE_DOMAINS, ECONOMY_HARDENING_BINDING_DOMAINS,
  ECONOMY_HARDENING_BINDING_SUCCESSOR_REVISION, ECONOMY_HARDENING_BINDING_SUCCESSOR_TREE,
  ECONOMY_HARDENING_BINDING_SUCCESSOR_PREDECESSOR, ECONOMY_HARDENING_BINDING_SUCCESSOR_PREDECESSOR_TREE,
  ECONOMY_HARDENING_BINDING_SUCCESSOR_PHASE, ECONOMY_HARDENING_BINDING_SUCCESSOR_DOMAINS,
  ECONOMY_HARDENING_REPAIR_REVISION, ECONOMY_HARDENING_REPAIR_TREE,
  ECONOMY_HARDENING_REPAIR_PREDECESSOR, ECONOMY_HARDENING_REPAIR_PREDECESSOR_TREE,
  ECONOMY_HARDENING_REPAIR_PHASE, ECONOMY_HARDENING_REPAIR_DOMAINS,
  ECONOMY_HARDENING_REPAIR_SUCCESSOR_REVISION, ECONOMY_HARDENING_REPAIR_SUCCESSOR_TREE,
  ECONOMY_HARDENING_REPAIR_SUCCESSOR_PREDECESSOR, ECONOMY_HARDENING_REPAIR_SUCCESSOR_PREDECESSOR_TREE,
  ECONOMY_HARDENING_REPAIR_SUCCESSOR_PHASE, ECONOMY_HARDENING_REPAIR_SUCCESSOR_DOMAINS,
  ECONOMY_HARDENING_RELEASE_REPAIR_REVISION, ECONOMY_HARDENING_RELEASE_REPAIR_TREE,
  ECONOMY_HARDENING_RELEASE_REPAIR_PREDECESSOR, ECONOMY_HARDENING_RELEASE_REPAIR_PREDECESSOR_TREE,
  ECONOMY_HARDENING_RELEASE_REPAIR_PHASE, ECONOMY_HARDENING_RELEASE_REPAIR_DOMAINS,
  ECONOMY_HARDENING_DIRECTOR_FIXTURE_REVISION, ECONOMY_HARDENING_DIRECTOR_FIXTURE_TREE,
  ECONOMY_HARDENING_DIRECTOR_FIXTURE_PREDECESSOR, ECONOMY_HARDENING_DIRECTOR_FIXTURE_PREDECESSOR_TREE,
  ECONOMY_HARDENING_DIRECTOR_FIXTURE_PHASE, ECONOMY_HARDENING_DIRECTOR_FIXTURE_DOMAINS,
  assertEconomyHardeningSourceTransfer, assertEconomyHardeningBindingTransfer,
  assertEconomyHardeningBindingSuccessorTransfer, assertEconomyHardeningRepairTransfer,
  assertEconomyHardeningRepairSuccessorTransfer, assertEconomyHardeningReleaseRepairTransfer,
  assertEconomyHardeningDirectorFixtureTransfer,
  economyHardeningSourceBaseline,
} from '../tools/economy-hardening-source-transfer.js';

const expectedRevision = 'aaab91ff6bec4c8a0ec53e0ef88682b317a7a182';
const expectedPredecessor = '9f39df80598d38507c9f6b4ea2414312eb8e7700';
const files = [
  '.github/workflows/ci.yml',
  'public/index.html', 'schema.sql', 'src/accrual.js', 'src/agentreferrals.js', 'src/auth.js', 'src/boxing.js', 'src/db.js',
  'src/economy.js', 'src/explore.js', 'src/game.js', 'src/goodsquote.js', 'src/invariants.js', 'src/kitchen.js', 'src/market.js',
  'src/routes/gateway.js', 'src/routes/rwa.js', 'src/rules.tail.js', 'src/server.js',
  'src/pen.js', 'src/population.js', 'src/preflight.js', 'src/races.js', 'src/social/estate.js', 'src/stable.js',
  'test/gates.js', 'test/growth.js', 'test/phase2-postgres.js', 'test/rc1-native-world-workload.js',
  'tools/arena.js', 'tools/commerce-deed-release-phase2-native-catalog.js',
  'test/commerce-release-phase2-migration-catalog.js',
  'test/continuous-city-source-compatibility.js', 'test/enterprise-release-phase2-migration-catalog.js',
  'test/lib/rc1-historical-source-fixture.js',
  'tools/commerce-current-enterprise-source-compatibility.js',
  'tools/deed-quest-source-transfer.js', 'tools/enterprise-deed-release-phase2-migration-catalog.js',
  'tools/player-intel-source-compatibility.js', 'tools/rc1-company-operator-source-compatibility.js',
  'tools/rc1-deed-source-compatibility.js', 'tools/rc1-invoice-source-compatibility.js',
  'tools/rc1-npc-cargo-journal.js', 'tools/rc1-player-car-provenance.js',
  'tools/rc1-world-market-resources.js', 'tools/rc1-world-qualification.js', 'tools/rc1-world-resource-observer.js',
];
const bindingFiles = [
  'package.json', 'test/lib/rc1-historical-source-fixture.js',
];
const successorFiles = ['test/lib/rc1-historical-source-fixture.js'];
const repairFiles = [
  'tools/commerce-deed-release-phase2-native-catalog.js',
  'src/game.js', 'src/growth.js', 'src/verify.js',
  'test/growth.js', 'test/hardening.js', 'test/sweeps.js',
];
const repairSuccessorFiles = [
  'schema.sql',
  'src/db.js', 'src/growth.js', 'src/rules.tail.js', 'src/server.js', 'src/socialproof.js', 'src/verify.js', 'src/wire.js',
  'test/growth.js', 'test/sweeps.js',
];
const releaseRepairFiles = [
  'schema.sql',
  'tools/commerce-deed-release-phase2-native-catalog.js',
  'tools/pgcheck.js',
];
const directorFixtureFiles = ['test/director-migration.js'];
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
assert.equal(ECONOMY_HARDENING_BINDING_SUCCESSOR_REVISION, '66b4c6008e6b9c192ae20006c59bc591be82a27a');
assert.equal(ECONOMY_HARDENING_BINDING_SUCCESSOR_PREDECESSOR, 'c94bb20cf84de303a34730f4723cff17192d6923');
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_HARDENING_BINDING_SUCCESSOR_PREDECESSOR,
  ECONOMY_HARDENING_BINDING_SUCCESSOR_REVISION]);
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_HARDENING_BINDING_SUCCESSOR_REVISION, 'HEAD']);
assert.equal(git('rev-parse', `${ECONOMY_HARDENING_BINDING_SUCCESSOR_REVISION}^{tree}`).trim(),
  ECONOMY_HARDENING_BINDING_SUCCESSOR_TREE);
assert.equal(git('rev-parse', `${ECONOMY_HARDENING_BINDING_SUCCESSOR_PREDECESSOR}^{tree}`).trim(),
  ECONOMY_HARDENING_BINDING_SUCCESSOR_PREDECESSOR_TREE);
assert.match(ECONOMY_HARDENING_BINDING_SUCCESSOR_PHASE, /exact-authored-binding-successor-source-transfer-only/);
assert.equal(ECONOMY_HARDENING_REPAIR_REVISION, 'a477313e15ae0eaaa5fd120a9375ac92bf369128');
assert.equal(ECONOMY_HARDENING_REPAIR_PREDECESSOR, '8e9b7408faceb6d6d69badff386c15e92cd02f69');
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_HARDENING_BINDING_SUCCESSOR_REVISION,
  ECONOMY_HARDENING_REPAIR_PREDECESSOR]);
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_HARDENING_REPAIR_PREDECESSOR,
  ECONOMY_HARDENING_REPAIR_REVISION]);
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_HARDENING_REPAIR_REVISION, 'HEAD']);
assert.equal(git('rev-parse', `${ECONOMY_HARDENING_REPAIR_REVISION}^{tree}`).trim(), ECONOMY_HARDENING_REPAIR_TREE);
assert.equal(git('rev-parse', `${ECONOMY_HARDENING_REPAIR_PREDECESSOR}^{tree}`).trim(),
  ECONOMY_HARDENING_REPAIR_PREDECESSOR_TREE);
assert.match(ECONOMY_HARDENING_REPAIR_PHASE, /exact-economy-qualification-repair-source-transfer-only/);
assert.equal(ECONOMY_HARDENING_REPAIR_SUCCESSOR_REVISION, 'faa56bd0e27b6866fb9a7a11ae5d71e70ac68012');
assert.equal(ECONOMY_HARDENING_REPAIR_SUCCESSOR_PREDECESSOR, 'd8650c6b0990a3eeb1697492fa50a6f7e4364fa0');
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_HARDENING_REPAIR_REVISION,
  ECONOMY_HARDENING_REPAIR_SUCCESSOR_PREDECESSOR]);
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_HARDENING_REPAIR_SUCCESSOR_PREDECESSOR,
  ECONOMY_HARDENING_REPAIR_SUCCESSOR_REVISION]);
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_HARDENING_REPAIR_SUCCESSOR_REVISION, 'HEAD']);
assert.equal(git('rev-parse', `${ECONOMY_HARDENING_REPAIR_SUCCESSOR_REVISION}^{tree}`).trim(),
  ECONOMY_HARDENING_REPAIR_SUCCESSOR_TREE);
assert.equal(git('rev-parse', `${ECONOMY_HARDENING_REPAIR_SUCCESSOR_PREDECESSOR}^{tree}`).trim(),
  ECONOMY_HARDENING_REPAIR_SUCCESSOR_PREDECESSOR_TREE);
assert.match(ECONOMY_HARDENING_REPAIR_SUCCESSOR_PHASE, /exact-economy-repair-successor-source-transfer-only/);
assert.equal(ECONOMY_HARDENING_RELEASE_REPAIR_REVISION, 'ca63f69180ae63f3aa91d2994f5ca8a09dcfec0f');
assert.equal(ECONOMY_HARDENING_RELEASE_REPAIR_PREDECESSOR, 'aa4f7afb9bcc8fc31a84e1eb7bb1ac8fdde44d03');
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_HARDENING_REPAIR_SUCCESSOR_REVISION,
  ECONOMY_HARDENING_RELEASE_REPAIR_PREDECESSOR]);
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_HARDENING_RELEASE_REPAIR_PREDECESSOR,
  ECONOMY_HARDENING_RELEASE_REPAIR_REVISION]);
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_HARDENING_RELEASE_REPAIR_REVISION,
  ECONOMY_HARDENING_DIRECTOR_FIXTURE_PREDECESSOR]);
assert.equal(git('rev-parse', `${ECONOMY_HARDENING_RELEASE_REPAIR_REVISION}^{tree}`).trim(),
  ECONOMY_HARDENING_RELEASE_REPAIR_TREE);
assert.equal(git('rev-parse', `${ECONOMY_HARDENING_RELEASE_REPAIR_PREDECESSOR}^{tree}`).trim(),
  ECONOMY_HARDENING_RELEASE_REPAIR_PREDECESSOR_TREE);
assert.match(ECONOMY_HARDENING_RELEASE_REPAIR_PHASE, /exact-economy-release-repair-source-transfer-only/);
assert.equal(ECONOMY_HARDENING_DIRECTOR_FIXTURE_REVISION, '5b3935106be36705186be940f61b50e334fd98ba');
assert.equal(ECONOMY_HARDENING_DIRECTOR_FIXTURE_PREDECESSOR, 'ee8518fc930515b3d2d19a50f236107ae34cb956');
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_HARDENING_DIRECTOR_FIXTURE_PREDECESSOR,
  ECONOMY_HARDENING_DIRECTOR_FIXTURE_REVISION]);
execFileSync('git', ['merge-base', '--is-ancestor', ECONOMY_HARDENING_DIRECTOR_FIXTURE_REVISION, 'HEAD']);
assert.equal(git('rev-parse', `${ECONOMY_HARDENING_DIRECTOR_FIXTURE_REVISION}^{tree}`).trim(),
  ECONOMY_HARDENING_DIRECTOR_FIXTURE_TREE);
assert.equal(git('rev-parse', `${ECONOMY_HARDENING_DIRECTOR_FIXTURE_PREDECESSOR}^{tree}`).trim(),
  ECONOMY_HARDENING_DIRECTOR_FIXTURE_PREDECESSOR_TREE);
assert.match(ECONOMY_HARDENING_DIRECTOR_FIXTURE_PHASE, /exact-economy-director-fixture-source-transfer-only/);
assert.deepEqual(Object.keys(ECONOMY_HARDENING_SOURCE_DOMAINS), files);
assert(Object.isFrozen(ECONOMY_HARDENING_SOURCE_DOMAINS));
assert.deepEqual(Object.keys(ECONOMY_HARDENING_BINDING_DOMAINS), bindingFiles);
assert(Object.isFrozen(ECONOMY_HARDENING_BINDING_DOMAINS));
assert.deepEqual(Object.keys(ECONOMY_HARDENING_BINDING_SUCCESSOR_DOMAINS), successorFiles);
assert(Object.isFrozen(ECONOMY_HARDENING_BINDING_SUCCESSOR_DOMAINS));
assert.deepEqual(Object.keys(ECONOMY_HARDENING_REPAIR_DOMAINS), repairFiles);
assert(Object.isFrozen(ECONOMY_HARDENING_REPAIR_DOMAINS));
assert.deepEqual(Object.keys(ECONOMY_HARDENING_REPAIR_SUCCESSOR_DOMAINS), repairSuccessorFiles);
assert(Object.isFrozen(ECONOMY_HARDENING_REPAIR_SUCCESSOR_DOMAINS));
assert.deepEqual(Object.keys(ECONOMY_HARDENING_RELEASE_REPAIR_DOMAINS), releaseRepairFiles);
assert(Object.isFrozen(ECONOMY_HARDENING_RELEASE_REPAIR_DOMAINS));
assert.deepEqual(Object.keys(ECONOMY_HARDENING_DIRECTOR_FIXTURE_DOMAINS), directorFixtureFiles);
assert(Object.isFrozen(ECONOMY_HARDENING_DIRECTOR_FIXTURE_DOMAINS));

let positives = 0, refusals = 0, hunks = 0;
for (const file of files) {
  const pin = ECONOMY_HARDENING_SOURCE_DOMAINS[file];
  const current = git('show', `${expectedRevision}:${file}`), baseline = git('show', `${expectedPredecessor}:${file}`);
  const physical = lf(fs.readFileSync(file, 'utf8'));
  const releaseRepaired = releaseRepairFiles.includes(file)
    ? assertEconomyHardeningReleaseRepairTransfer(file, physical).baselineText : physical;
  const repairSuccessorAuthored = repairSuccessorFiles.includes(file)
    ? assertEconomyHardeningRepairSuccessorTransfer(file, releaseRepaired).baselineText : releaseRepaired;
  const repairedAuthored = repairFiles.includes(file)
    ? assertEconomyHardeningRepairTransfer(file, repairSuccessorAuthored).baselineText : repairSuccessorAuthored;
  const successorAuthored = successorFiles.includes(file)
    ? assertEconomyHardeningBindingSuccessorTransfer(file, repairedAuthored).baselineText : repairedAuthored;
  const authored = bindingFiles.includes(file)
    ? assertEconomyHardeningBindingTransfer(file, successorAuthored).baselineText : successorAuthored;
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
  if (bindingFiles.includes(file) || repairFiles.includes(file)) {
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
for (const file of repairFiles) {
  const pin = ECONOMY_HARDENING_REPAIR_DOMAINS[file];
  const current = git('show', `${ECONOMY_HARDENING_REPAIR_REVISION}:${file}`);
  const baseline = git('show', `${ECONOMY_HARDENING_REPAIR_PREDECESSOR}:${file}`);
  const historical = files.includes(file) ? git('show', `${expectedPredecessor}:${file}`) : baseline;
  const outerPhysical = lf(fs.readFileSync(file, 'utf8'));
  const releaseRepaired = releaseRepairFiles.includes(file)
    ? assertEconomyHardeningReleaseRepairTransfer(file, outerPhysical).baselineText : outerPhysical;
  const physical = repairSuccessorFiles.includes(file)
    ? assertEconomyHardeningRepairSuccessorTransfer(file, releaseRepaired).baselineText : releaseRepaired;
  assert.equal(physical, current, 'Physical qualification repair source must remain exact: ' + file);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));
  assert.deepEqual(Object.keys(pin).sort(),
    ['mode', 'currentSha256', 'currentBlob', 'baselineSha256', 'baselineBlob', 'contextLines', 'inverses'].sort());
  assert.equal(pin.contextLines, 3);
  assert.equal(hash(current), pin.currentSha256); assert.equal(blob(current), pin.currentBlob);
  assert.equal(hash(baseline), pin.baselineSha256); assert.equal(blob(baseline), pin.baselineBlob);
  assert.equal(git('rev-parse', `${ECONOMY_HARDENING_REPAIR_REVISION}:${file}`).trim(), pin.currentBlob);
  assert.equal(git('rev-parse', `${ECONOMY_HARDENING_REPAIR_PREDECESSOR}:${file}`).trim(), pin.baselineBlob);
  assert.equal(git('ls-tree', ECONOMY_HARDENING_REPAIR_REVISION, '--', file).trim().split(/\s+/)[0], pin.mode);
  assert.deepEqual(pin.inverses, inverseHunks(file, ECONOMY_HARDENING_REPAIR_PREDECESSOR,
    ECONOMY_HARDENING_REPAIR_REVISION));
  for (const input of [current, current.replaceAll('\n', '\r\n')]) {
    const transfer = assertEconomyHardeningRepairTransfer(file, input);
    assert.equal(transfer.baselineText, baseline); assert.equal(transfer.sourceOnly, true);
    assert.equal(transfer.sourceRevision, ECONOMY_HARDENING_REPAIR_REVISION);
    assert.equal(transfer.predecessorRevision, ECONOMY_HARDENING_REPAIR_PREDECESSOR);
    assert.equal(economyHardeningSourceBaseline(file, input), historical); positives++;
  }
  assert.equal(economyHardeningSourceBaseline(file, baseline), historical); positives++;
  for (const changed of [current + '\n// drift\n', current.slice(1), '\ufeff' + current, current + '\0',
    current.replace('\n', '\r\n'), current.replace('\n', '\r'), Buffer.from(current), null]) {
    assert.throws(() => assertEconomyHardeningRepairTransfer(file, changed));
    assert.equal(economyHardeningSourceBaseline(file, changed), changed); refusals++;
  }
  for (const inverse of pin.inverses) {
    assert.equal(current.split(inverse.current).length - 1, 1, 'Unique complete qualification repair inverse required: ' + file);
    const changedInputs = [current.replace(inverse.current, ''),
      current.replace(inverse.current, () => inverse.current + inverse.current)];
    // With a one-hunk repair, applying that hunk's baseline is the exact known predecessor. The
    // permissive composer must continue through older layers instead of treating it as source drift.
    if (pin.inverses.length > 1) changedInputs.push(current.replace(inverse.current, () => inverse.baseline));
    changedInputs.push(current.replace(inverse.current, () => inverse.current.replace(/\S/, '?')));
    for (const changed of changedInputs) {
      assert.throws(() => assertEconomyHardeningRepairTransfer(file, changed));
      assert.equal(economyHardeningSourceBaseline(file, changed), changed); refusals++;
    }
    hunks++;
  }
}
for (const file of repairSuccessorFiles) {
  const pin = ECONOMY_HARDENING_REPAIR_SUCCESSOR_DOMAINS[file];
  const current = git('show', `${ECONOMY_HARDENING_REPAIR_SUCCESSOR_REVISION}:${file}`);
  const predecessorEntry = git('ls-tree', ECONOMY_HARDENING_REPAIR_SUCCESSOR_PREDECESSOR, '--', file).trim();
  const predecessorAbsent = predecessorEntry === '';
  const baseline = predecessorAbsent ? null
    : git('show', `${ECONOMY_HARDENING_REPAIR_SUCCESSOR_PREDECESSOR}:${file}`);
  const historical = predecessorAbsent ? current
    : files.includes(file) ? git('show', `${expectedPredecessor}:${file}`)
      : repairFiles.includes(file) ? git('show', `${ECONOMY_HARDENING_REPAIR_PREDECESSOR}:${file}`) : baseline;
  const outerPhysical = lf(fs.readFileSync(file, 'utf8'));
  const physical = releaseRepairFiles.includes(file)
    ? assertEconomyHardeningReleaseRepairTransfer(file, outerPhysical).baselineText : outerPhysical;
  assert.equal(physical, current, 'Physical repair successor source must remain exact: ' + file);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));
  assert.deepEqual(Object.keys(pin).sort(),
    ['predecessorAbsent', 'mode', 'currentSha256', 'currentBlob', 'baselineSha256', 'baselineBlob',
      'contextLines', 'inverses'].sort());
  assert.equal(pin.contextLines, 3); assert.equal(pin.predecessorAbsent, predecessorAbsent);
  assert.equal(hash(current), pin.currentSha256); assert.equal(blob(current), pin.currentBlob);
  assert.equal(git('rev-parse', `${ECONOMY_HARDENING_REPAIR_SUCCESSOR_REVISION}:${file}`).trim(), pin.currentBlob);
  assert.equal(git('ls-tree', ECONOMY_HARDENING_REPAIR_SUCCESSOR_REVISION, '--', file).trim().split(/\s+/)[0], pin.mode);
  if (predecessorAbsent) {
    assert.equal(file, 'src/socialproof.js');
    assert.equal(pin.baselineSha256, null); assert.equal(pin.baselineBlob, null); assert.deepEqual(pin.inverses, []);
    assert.throws(() => git('show', `${ECONOMY_HARDENING_REPAIR_SUCCESSOR_PREDECESSOR}:${file}`));
  } else {
    assert.equal(hash(baseline), pin.baselineSha256); assert.equal(blob(baseline), pin.baselineBlob);
    assert.equal(git('rev-parse', `${ECONOMY_HARDENING_REPAIR_SUCCESSOR_PREDECESSOR}:${file}`).trim(), pin.baselineBlob);
    assert.deepEqual(pin.inverses, inverseHunks(file, ECONOMY_HARDENING_REPAIR_SUCCESSOR_PREDECESSOR,
      ECONOMY_HARDENING_REPAIR_SUCCESSOR_REVISION));
  }
  for (const input of [current, current.replaceAll('\n', '\r\n')]) {
    const transfer = assertEconomyHardeningRepairSuccessorTransfer(file, input);
    assert.equal(transfer.baselineText, baseline); assert.equal(transfer.predecessorAbsent, predecessorAbsent);
    assert.equal(transfer.sourceOnly, true);
    assert.equal(transfer.sourceRevision, ECONOMY_HARDENING_REPAIR_SUCCESSOR_REVISION);
    assert.equal(transfer.predecessorRevision, ECONOMY_HARDENING_REPAIR_SUCCESSOR_PREDECESSOR);
    assert.equal(economyHardeningSourceBaseline(file, input), predecessorAbsent ? input : historical); positives++;
  }
  if (!predecessorAbsent) {
    assert.equal(economyHardeningSourceBaseline(file, baseline), historical); positives++;
  }
  for (const changed of [current + '\n// drift\n', current.slice(1), '\ufeff' + current, current + '\0',
    current.replace('\n', '\r\n'), current.replace('\n', '\r'), Buffer.from(current), null]) {
    assert.throws(() => assertEconomyHardeningRepairSuccessorTransfer(file, changed));
    assert.equal(economyHardeningSourceBaseline(file, changed), changed); refusals++;
  }
  for (const inverse of pin.inverses) {
    assert.equal(current.split(inverse.current).length - 1, 1,
      'Unique complete repair successor inverse required: ' + file);
    const changedInputs = [current.replace(inverse.current, ''),
      current.replace(inverse.current, () => inverse.current + inverse.current)];
    if (pin.inverses.length > 1) changedInputs.push(current.replace(inverse.current, () => inverse.baseline));
    changedInputs.push(current.replace(inverse.current, () => inverse.current.replace(/\S/, '?')));
    for (const changed of changedInputs) {
      assert.throws(() => assertEconomyHardeningRepairSuccessorTransfer(file, changed));
      assert.equal(economyHardeningSourceBaseline(file, changed), changed); refusals++;
    }
    hunks++;
  }
}
for (const file of releaseRepairFiles) {
  const pin = ECONOMY_HARDENING_RELEASE_REPAIR_DOMAINS[file];
  const current = git('show', `${ECONOMY_HARDENING_RELEASE_REPAIR_REVISION}:${file}`);
  const baseline = git('show', `${ECONOMY_HARDENING_RELEASE_REPAIR_PREDECESSOR}:${file}`);
  const historical = files.includes(file) ? git('show', `${expectedPredecessor}:${file}`) : baseline;
  const physical = lf(fs.readFileSync(file, 'utf8'));
  assert.equal(physical, current, 'Physical release repair source must remain exact: ' + file);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));
  assert.deepEqual(Object.keys(pin).sort(),
    ['mode', 'currentSha256', 'currentBlob', 'baselineSha256', 'baselineBlob', 'contextLines', 'inverses'].sort());
  assert.equal(pin.contextLines, 3);
  assert.equal(hash(current), pin.currentSha256); assert.equal(blob(current), pin.currentBlob);
  assert.equal(hash(baseline), pin.baselineSha256); assert.equal(blob(baseline), pin.baselineBlob);
  assert.equal(git('rev-parse', `${ECONOMY_HARDENING_RELEASE_REPAIR_REVISION}:${file}`).trim(), pin.currentBlob);
  assert.equal(git('rev-parse', `${ECONOMY_HARDENING_RELEASE_REPAIR_PREDECESSOR}:${file}`).trim(), pin.baselineBlob);
  assert.equal(git('ls-tree', ECONOMY_HARDENING_RELEASE_REPAIR_REVISION, '--', file).trim().split(/\s+/)[0], pin.mode);
  assert.deepEqual(pin.inverses, inverseHunks(file, ECONOMY_HARDENING_RELEASE_REPAIR_PREDECESSOR,
    ECONOMY_HARDENING_RELEASE_REPAIR_REVISION));
  for (const input of [current, current.replaceAll('\n', '\r\n')]) {
    const transfer = assertEconomyHardeningReleaseRepairTransfer(file, input);
    assert.equal(transfer.baselineText, baseline); assert.equal(transfer.sourceOnly, true);
    assert.equal(transfer.sourceRevision, ECONOMY_HARDENING_RELEASE_REPAIR_REVISION);
    assert.equal(transfer.predecessorRevision, ECONOMY_HARDENING_RELEASE_REPAIR_PREDECESSOR);
    assert.equal(economyHardeningSourceBaseline(file, input), historical); positives++;
  }
  assert.equal(economyHardeningSourceBaseline(file, baseline), historical); positives++;
  for (const changed of [current + '\n// drift\n', current.slice(1), '\ufeff' + current, current + '\0',
    current.replace('\n', '\r\n'), current.replace('\n', '\r'), Buffer.from(current), null]) {
    assert.throws(() => assertEconomyHardeningReleaseRepairTransfer(file, changed));
    assert.equal(economyHardeningSourceBaseline(file, changed), changed); refusals++;
  }
  for (const inverse of pin.inverses) {
    assert.equal(current.split(inverse.current).length - 1, 1,
      'Unique complete release repair inverse required: ' + file);
    const changedInputs = [current.replace(inverse.current, ''),
      current.replace(inverse.current, () => inverse.current + inverse.current)];
    if (pin.inverses.length > 1) changedInputs.push(current.replace(inverse.current, () => inverse.baseline));
    changedInputs.push(current.replace(inverse.current, () => inverse.current.replace(/\S/, '?')));
    for (const changed of changedInputs) {
      assert.throws(() => assertEconomyHardeningReleaseRepairTransfer(file, changed));
      assert.equal(economyHardeningSourceBaseline(file, changed), changed); refusals++;
    }
    hunks++;
  }
}
for (const file of directorFixtureFiles) {
  const pin = ECONOMY_HARDENING_DIRECTOR_FIXTURE_DOMAINS[file];
  const current = git('show', `${ECONOMY_HARDENING_DIRECTOR_FIXTURE_REVISION}:${file}`);
  const baseline = git('show', `${ECONOMY_HARDENING_DIRECTOR_FIXTURE_PREDECESSOR}:${file}`);
  const physical = lf(fs.readFileSync(file, 'utf8'));
  assert.equal(physical, current, 'Physical director fixture source must remain exact: ' + file);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));
  assert.deepEqual(Object.keys(pin).sort(),
    ['mode', 'currentSha256', 'currentBlob', 'baselineSha256', 'baselineBlob', 'contextLines', 'inverses'].sort());
  assert.equal(pin.contextLines, 3);
  assert.equal(hash(current), pin.currentSha256); assert.equal(blob(current), pin.currentBlob);
  assert.equal(hash(baseline), pin.baselineSha256); assert.equal(blob(baseline), pin.baselineBlob);
  assert.equal(git('rev-parse', `${ECONOMY_HARDENING_DIRECTOR_FIXTURE_REVISION}:${file}`).trim(), pin.currentBlob);
  assert.equal(git('rev-parse', `${ECONOMY_HARDENING_DIRECTOR_FIXTURE_PREDECESSOR}:${file}`).trim(), pin.baselineBlob);
  assert.equal(git('ls-tree', ECONOMY_HARDENING_DIRECTOR_FIXTURE_REVISION, '--', file).trim().split(/\s+/)[0], pin.mode);
  assert.deepEqual(pin.inverses, inverseHunks(file, ECONOMY_HARDENING_DIRECTOR_FIXTURE_PREDECESSOR,
    ECONOMY_HARDENING_DIRECTOR_FIXTURE_REVISION));
  for (const input of [current, current.replaceAll('\n', '\r\n')]) {
    const transfer = assertEconomyHardeningDirectorFixtureTransfer(file, input);
    assert.equal(transfer.baselineText, baseline); assert.equal(transfer.sourceOnly, true);
    assert.equal(transfer.sourceRevision, ECONOMY_HARDENING_DIRECTOR_FIXTURE_REVISION);
    assert.equal(transfer.predecessorRevision, ECONOMY_HARDENING_DIRECTOR_FIXTURE_PREDECESSOR);
    assert.equal(economyHardeningSourceBaseline(file, input), baseline); positives++;
  }
  assert.equal(economyHardeningSourceBaseline(file, baseline), baseline); positives++;
  for (const changed of [current + '\n// drift\n', current.slice(1), '\ufeff' + current, current + '\0',
    current.replace('\n', '\r\n'), current.replace('\n', '\r'), Buffer.from(current), null]) {
    assert.throws(() => assertEconomyHardeningDirectorFixtureTransfer(file, changed));
    assert.equal(economyHardeningSourceBaseline(file, changed), changed); refusals++;
  }
  for (const inverse of pin.inverses) {
    assert.equal(current.split(inverse.current).length - 1, 1,
      'Unique complete director fixture inverse required: ' + file);
    const changedInputs = [current.replace(inverse.current, ''),
      current.replace(inverse.current, () => inverse.current + inverse.current)];
    if (pin.inverses.length > 1) changedInputs.push(current.replace(inverse.current, () => inverse.baseline));
    changedInputs.push(current.replace(inverse.current, () => inverse.current.replace(/\S/, '?')));
    for (const changed of changedInputs) {
      assert.throws(() => assertEconomyHardeningDirectorFixtureTransfer(file, changed));
      assert.equal(economyHardeningSourceBaseline(file, changed), changed); refusals++;
    }
    hunks++;
  }
}
for (const file of bindingFiles) {
  const pin = ECONOMY_HARDENING_BINDING_DOMAINS[file], physical = lf(fs.readFileSync(file, 'utf8'));
  const current = successorFiles.includes(file)
    ? assertEconomyHardeningBindingSuccessorTransfer(file, physical).baselineText : physical;
  const baseline = git('show', `${expectedRevision}:${file}`);
  const historical = files.includes(file) ? git('show', `${expectedPredecessor}:${file}`) : baseline;
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));
  assert.equal(hash(current), pin.currentSha256); assert.equal(blob(current), pin.currentBlob);
  assert.equal(hash(baseline), pin.baselineSha256); assert.equal(blob(baseline), pin.baselineBlob);
  assert.equal(git('rev-parse', `${expectedRevision}:${file}`).trim(), pin.baselineBlob);
  assert.equal(git('ls-tree', expectedRevision, '--', file).trim().split(/\s+/)[0], pin.mode);
  const bindingTip = successorFiles.includes(file)
    ? ECONOMY_HARDENING_BINDING_SUCCESSOR_PREDECESSOR : null;
  assert.deepEqual(pin.inverses, inverseHunks(file, expectedRevision, bindingTip));
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
for (const file of successorFiles) {
  const pin = ECONOMY_HARDENING_BINDING_SUCCESSOR_DOMAINS[file];
  const current = git('show', `${ECONOMY_HARDENING_BINDING_SUCCESSOR_REVISION}:${file}`);
  const baseline = git('show', `${ECONOMY_HARDENING_BINDING_SUCCESSOR_PREDECESSOR}:${file}`);
  const physical = lf(fs.readFileSync(file, 'utf8'));
  assert.equal(physical, current, 'Physical successor source must remain exact: ' + file);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));
  assert.deepEqual(Object.keys(pin).sort(),
    ['mode', 'currentSha256', 'currentBlob', 'baselineSha256', 'baselineBlob', 'contextLines', 'inverses'].sort());
  assert.equal(pin.contextLines, 3);
  assert.equal(hash(current), pin.currentSha256); assert.equal(blob(current), pin.currentBlob);
  assert.equal(hash(baseline), pin.baselineSha256); assert.equal(blob(baseline), pin.baselineBlob);
  assert.equal(git('rev-parse', `${ECONOMY_HARDENING_BINDING_SUCCESSOR_REVISION}:${file}`).trim(), pin.currentBlob);
  assert.equal(git('rev-parse', `${ECONOMY_HARDENING_BINDING_SUCCESSOR_PREDECESSOR}:${file}`).trim(), pin.baselineBlob);
  assert.equal(git('ls-tree', ECONOMY_HARDENING_BINDING_SUCCESSOR_REVISION, '--', file).trim().split(/\s+/)[0], pin.mode);
  assert.deepEqual(pin.inverses, inverseHunks(file, ECONOMY_HARDENING_BINDING_SUCCESSOR_PREDECESSOR,
    ECONOMY_HARDENING_BINDING_SUCCESSOR_REVISION));
  for (const input of [current, current.replaceAll('\n', '\r\n')]) {
    const transfer = assertEconomyHardeningBindingSuccessorTransfer(file, input);
    assert.equal(transfer.baselineText, baseline); assert.equal(transfer.sourceOnly, true);
    assert.equal(transfer.sourceRevision, ECONOMY_HARDENING_BINDING_SUCCESSOR_REVISION);
    assert.equal(transfer.predecessorRevision, ECONOMY_HARDENING_BINDING_SUCCESSOR_PREDECESSOR);
    positives++;
  }
  for (const changed of [current + '\n// drift\n', current.slice(1), '\ufeff' + current, current + '\0',
    current.replace('\n', '\r\n'), current.replace('\n', '\r'), Buffer.from(current), null]) {
    assert.throws(() => assertEconomyHardeningBindingSuccessorTransfer(file, changed));
    assert.equal(economyHardeningSourceBaseline(file, changed), changed); refusals++;
  }
  for (const inverse of pin.inverses) {
    assert.equal(current.split(inverse.current).length - 1, 1, 'Unique complete successor inverse required: ' + file);
    for (const changed of [current.replace(inverse.current, ''),
      current.replace(inverse.current, () => inverse.current + inverse.current),
      current.replace(inverse.current, () => inverse.baseline),
      current.replace(inverse.current, () => inverse.current.replace(/\S/, '?'))]) {
      assert.throws(() => assertEconomyHardeningBindingSuccessorTransfer(file, changed));
      assert.equal(economyHardeningSourceBaseline(file, changed), changed); refusals++;
    }
    hunks++;
  }
}
for (const file of ['__proto__', 'src/unknown.js', 'schema.sql.extra']) {
  const text = 'unknown\r\nbytes\n';
  assert.throws(() => assertEconomyHardeningSourceTransfer(file, text));
  assert.throws(() => assertEconomyHardeningBindingSuccessorTransfer(file, text));
  assert.throws(() => assertEconomyHardeningRepairTransfer(file, text));
  assert.throws(() => assertEconomyHardeningRepairSuccessorTransfer(file, text));
  assert.throws(() => assertEconomyHardeningReleaseRepairTransfer(file, text));
  assert.throws(() => assertEconomyHardeningDirectorFixtureTransfer(file, text));
  assert.equal(economyHardeningSourceBaseline(file, text), text); refusals++;
}
assert.equal(positives, 217, 'positive control count drifted');
assert.equal(refusals, 679, 'refusal control count drifted');
assert.equal(hunks, 322, 'inverse-hunk control count drifted');
console.log(`Economy-hardening exact source transfer PASS: ${positives} positives, ${refusals} refusals, ${hunks} inverse hunks; historical pins unchanged`);
