// Explicit maintainer tool. The emitted envelope reconstructs source bytes only;
// it does not inherit historical runtime, native, migration or release clearance.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const revision = 'aaab91ff6bec4c8a0ec53e0ef88682b317a7a182';
const predecessor = '9f39df80598d38507c9f6b4ea2414312eb8e7700';
const bindingRevision = 'c94bb20cf84de303a34730f4723cff17192d6923';
const bindingRevisionTree = 'e0f65c75eab02d2cbdc69d1da13047217d6651ce';
const bindingSuccessorRevision = '66b4c6008e6b9c192ae20006c59bc591be82a27a';
const bindingSuccessorTree = '38d87c3be5fdd4890ab5a9cdc7309a4332b50a14';
const repairRevision = 'a477313e15ae0eaaa5fd120a9375ac92bf369128';
const repairRevisionTree = '861f98b3fd695c34d462886cea03f3503541b70b';
const repairPredecessor = '8e9b7408faceb6d6d69badff386c15e92cd02f69';
const repairPredecessorTree = '880f124eab908eddae4b2e30406a7e491649cb2e';
const repairSuccessorRevision = 'faa56bd0e27b6866fb9a7a11ae5d71e70ac68012';
const repairSuccessorRevisionTree = '25d3dd4137cb8bc37ec24841d89a54d2696bafce';
const repairSuccessorPredecessor = 'd8650c6b0990a3eeb1697492fa50a6f7e4364fa0';
const repairSuccessorPredecessorTree = '3f7835b6d46de2fed6b0aaa0bbcdda026384d6f0';
const releaseRepairRevision = 'ca63f69180ae63f3aa91d2994f5ca8a09dcfec0f';
const releaseRepairRevisionTree = '0838a860f1b5daccb87092f22fc6e01442a81038';
const releaseRepairPredecessor = 'aa4f7afb9bcc8fc31a84e1eb7bb1ac8fdde44d03';
const releaseRepairPredecessorTree = '750e5b9c18df1b7f61b4bfaf865de8ff2ec52e25';
const directorFixtureRevision = '5b3935106be36705186be940f61b50e334fd98ba';
const directorFixtureRevisionTree = 'a47cd6c1d2e8f70ba6822b8dbf6b93f36941d73d';
const directorFixturePredecessor = 'ee8518fc930515b3d2d19a50f236107ae34cb956';
const directorFixturePredecessorTree = 'b3e9dc7c9f30c82cbac6030c9c96b134a3ac2e3b';
const phase2TimeoutRevision = '363a0b6b772111e6e07d05ea8bd55147a3f37528';
const phase2TimeoutRevisionTree = 'e1b87d1c63ae423e7664e313db6436bc93410831';
const phase2TimeoutPredecessor = '34cd8d8d49d2e0aba0f587995f9d7e2a6508cf27';
const phase2TimeoutPredecessorTree = 'dc6184dc54aba8d77b43b5e6b19f1fff1d0bef8a';
const lf = text => text.replaceAll('\r\n', '\n');
const git = (...args) => lf(execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  stdio: ['ignore', 'pipe', 'pipe'] }));
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');

assert.equal(process.argv[2], '--write', 'Use --write only for the fixed reviewed economy-hardening candidate');
execFileSync('git', ['merge-base', '--is-ancestor', predecessor, revision]);
execFileSync('git', ['merge-base', '--is-ancestor', revision, bindingRevision]);
execFileSync('git', ['merge-base', '--is-ancestor', bindingRevision, bindingSuccessorRevision]);
execFileSync('git', ['merge-base', '--is-ancestor', bindingSuccessorRevision, repairPredecessor]);
execFileSync('git', ['merge-base', '--is-ancestor', repairPredecessor, repairRevision]);
execFileSync('git', ['merge-base', '--is-ancestor', repairRevision, repairSuccessorPredecessor]);
execFileSync('git', ['merge-base', '--is-ancestor', repairSuccessorPredecessor, repairSuccessorRevision]);
execFileSync('git', ['merge-base', '--is-ancestor', repairSuccessorRevision, releaseRepairPredecessor]);
execFileSync('git', ['merge-base', '--is-ancestor', releaseRepairPredecessor, releaseRepairRevision]);
execFileSync('git', ['merge-base', '--is-ancestor', releaseRepairRevision, directorFixturePredecessor]);
execFileSync('git', ['merge-base', '--is-ancestor', directorFixturePredecessor, directorFixtureRevision]);
execFileSync('git', ['merge-base', '--is-ancestor', directorFixtureRevision, phase2TimeoutPredecessor]);
execFileSync('git', ['merge-base', '--is-ancestor', phase2TimeoutPredecessor, phase2TimeoutRevision]);
execFileSync('git', ['merge-base', '--is-ancestor', phase2TimeoutRevision, 'HEAD']);
assert.equal(git('rev-parse', `${bindingRevision}^{tree}`).trim(), bindingRevisionTree,
  'Frozen economy binding revision tree changed');
assert.equal(git('rev-parse', `${bindingSuccessorRevision}^{tree}`).trim(), bindingSuccessorTree,
  'Frozen economy binding successor revision tree changed');
assert.equal(git('rev-parse', `${repairRevision}^{tree}`).trim(), repairRevisionTree,
  'Frozen economy qualification repair revision tree changed');
assert.equal(git('rev-parse', `${repairPredecessor}^{tree}`).trim(), repairPredecessorTree,
  'Frozen economy qualification repair predecessor tree changed');
assert.equal(git('rev-parse', `${repairSuccessorRevision}^{tree}`).trim(), repairSuccessorRevisionTree,
  'Frozen economy repair successor revision tree changed');
assert.equal(git('rev-parse', `${repairSuccessorPredecessor}^{tree}`).trim(), repairSuccessorPredecessorTree,
  'Frozen economy repair successor predecessor tree changed');
assert.equal(git('rev-parse', `${releaseRepairRevision}^{tree}`).trim(), releaseRepairRevisionTree,
  'Frozen economy release repair revision tree changed');
assert.equal(git('rev-parse', `${releaseRepairPredecessor}^{tree}`).trim(), releaseRepairPredecessorTree,
  'Frozen economy release repair predecessor tree changed');
assert.equal(git('rev-parse', `${directorFixtureRevision}^{tree}`).trim(), directorFixtureRevisionTree,
  'Frozen economy director fixture revision tree changed');
assert.equal(git('rev-parse', `${directorFixturePredecessor}^{tree}`).trim(), directorFixturePredecessorTree,
  'Frozen economy director fixture predecessor tree changed');
assert.equal(git('rev-parse', `${phase2TimeoutRevision}^{tree}`).trim(), phase2TimeoutRevisionTree,
  'Frozen economy Phase 2 timeout revision tree changed');
assert.equal(git('rev-parse', `${phase2TimeoutPredecessor}^{tree}`).trim(), phase2TimeoutPredecessorTree,
  'Frozen economy Phase 2 timeout predecessor tree changed');
// Closed physical-source readers reached by the current Commerce and RC1 chains.
// Other candidate files are tested as current gameplay and are not historical source namespaces.
const files = Object.freeze([
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
]);

const domains = {};
for (const file of files) {
  const current = git('show', `${revision}:${file}`), baseline = git('show', `${predecessor}:${file}`);
  assert.notEqual(current, baseline, `Closed candidate domain has no change: ${file}`);
  const inverses = []; let hunk = null;
  for (const line of git('diff', '--no-ext-diff', '--unified=3', predecessor, revision, '--', file).split('\n')) {
    if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; inverses.push(hunk); }
    else if (hunk && /^[ +\-]/.test(line)) {
      if (line[0] !== '-') hunk.current += line.slice(1) + '\n';
      if (line[0] !== '+') hunk.baseline += line.slice(1) + '\n';
    }
  }
  let reconstructed = current;
  for (const inverse of inverses) {
    assert(inverse.current.length, `Empty current inverse context: ${file}`);
    assert.equal(reconstructed.split(inverse.current).length - 1, 1, `Inverse context must occur once: ${file}`);
    reconstructed = reconstructed.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(reconstructed, baseline, `Complete predecessor reconstruction: ${file}`);
  domains[file] = {
    mode: git('ls-tree', revision, '--', file).trim().split(/\s+/)[0],
    currentSha256: hash(current), currentBlob: blob(current), baselineSha256: hash(baseline), baselineBlob: blob(baseline),
    contextLines: 3, inverses,
  };
}

// Source-only adapters added after the authored gameplay revision. Their exact
// postimages reconstruct that revision before any older frozen reader executes.
const bindingFiles = Object.freeze([
  'package.json', 'test/lib/rc1-historical-source-fixture.js',
]);
const bindingDomains = {};
for (const file of bindingFiles) {
  const current = git('show', `${bindingRevision}:${file}`), baseline = git('show', `${revision}:${file}`);
  assert.notEqual(current, baseline, `Binding postimage has no change: ${file}`);
  const inverses = []; let hunk = null;
  for (const line of git('diff', '--no-ext-diff', '--unified=3', revision, bindingRevision, '--', file).split('\n')) {
    if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; inverses.push(hunk); }
    else if (hunk && /^[ +\-]/.test(line)) {
      if (line[0] !== '-') hunk.current += line.slice(1) + '\n';
      if (line[0] !== '+') hunk.baseline += line.slice(1) + '\n';
    }
  }
  let reconstructed = current;
  for (const inverse of inverses) {
    assert(inverse.current.length, `Empty binding inverse context: ${file}`);
    assert.equal(reconstructed.split(inverse.current).length - 1, 1, `Binding inverse context must occur once: ${file}`);
    reconstructed = reconstructed.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(reconstructed, baseline, `Complete authored-source reconstruction: ${file}`);
  bindingDomains[file] = {
    mode: git('ls-tree', bindingRevision, '--', file).trim().split(/\s+/)[0],
    currentSha256: hash(current), currentBlob: blob(current), baselineSha256: hash(baseline), baselineBlob: blob(baseline),
    contextLines: 3, inverses,
  };
}

// A later reviewed fixture execution change is a separate outer hop. Keeping it
// separate prevents regeneration from rewriting or collapsing the frozen binding.
const bindingSuccessorFiles = Object.freeze(['test/lib/rc1-historical-source-fixture.js']);
const bindingSuccessorDomains = {};
for (const file of bindingSuccessorFiles) {
  const raw = fs.readFileSync(file, 'utf8'), current = lf(raw);
  const authored = git('show', `${bindingSuccessorRevision}:${file}`), baseline = git('show', `${bindingRevision}:${file}`);
  assert(raw === current || raw === current.replaceAll('\n', '\r\n'), `Mixed binding successor line endings: ${file}`);
  assert.equal(current, authored, `Binding successor physical source differs from the reviewed commit: ${file}`);
  assert.notEqual(current, baseline, `Binding successor postimage has no change: ${file}`);
  const inverses = []; let hunk = null;
  for (const line of git('diff', '--no-ext-diff', '--unified=3', bindingRevision, bindingSuccessorRevision, '--', file).split('\n')) {
    if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; inverses.push(hunk); }
    else if (hunk && /^[ +\-]/.test(line)) {
      if (line[0] !== '-') hunk.current += line.slice(1) + '\n';
      if (line[0] !== '+') hunk.baseline += line.slice(1) + '\n';
    }
  }
  let reconstructed = current;
  for (const inverse of inverses) {
    assert(inverse.current.length, `Empty binding successor inverse context: ${file}`);
    assert.equal(reconstructed.split(inverse.current).length - 1, 1, `Binding successor inverse context must occur once: ${file}`);
    reconstructed = reconstructed.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(reconstructed, baseline, `Complete binding predecessor reconstruction: ${file}`);
  bindingSuccessorDomains[file] = {
    mode: git('ls-tree', bindingSuccessorRevision, '--', file).trim().split(/\s+/)[0],
    currentSha256: hash(current), currentBlob: blob(current), baselineSha256: hash(baseline), baselineBlob: blob(baseline),
    contextLines: 3, inverses,
  };
}
for (const file of bindingFiles.filter(file => !bindingSuccessorFiles.includes(file))) {
  const raw = fs.readFileSync(file, 'utf8'), current = lf(raw);
  assert(raw === current || raw === current.replaceAll('\n', '\r\n'), `Mixed binding line endings: ${file}`);
  assert.equal(current, git('show', `${bindingRevision}:${file}`),
    `Unsealed physical binding successor requires its own reviewed outer hop: ${file}`);
}

// Economy qualification repairs made after the complete candidate are a final exact
// outer hop. They reconstruct the pre-repair candidate before the authored envelope.
const repairFiles = Object.freeze([
  'tools/commerce-deed-release-phase2-native-catalog.js',
  'src/game.js', 'src/growth.js', 'src/verify.js',
  'test/growth.js', 'test/hardening.js', 'test/sweeps.js',
]);
const repairDomains = {};
for (const file of repairFiles) {
  const current = git('show', `${repairRevision}:${file}`), baseline = git('show', `${repairPredecessor}:${file}`);
  assert.notEqual(current, baseline, `Qualification repair postimage has no change: ${file}`);
  const inverses = []; let hunk = null;
  for (const line of git('diff', '--no-ext-diff', '--unified=3', repairPredecessor, repairRevision, '--', file).split('\n')) {
    if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; inverses.push(hunk); }
    else if (hunk && /^[ +\-]/.test(line)) {
      if (line[0] !== '-') hunk.current += line.slice(1) + '\n';
      if (line[0] !== '+') hunk.baseline += line.slice(1) + '\n';
    }
  }
  let reconstructed = current;
  for (const inverse of inverses) {
    assert(inverse.current.length, `Empty qualification repair inverse context: ${file}`);
    assert.equal(reconstructed.split(inverse.current).length - 1, 1, `Qualification repair inverse context must occur once: ${file}`);
    reconstructed = reconstructed.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(reconstructed, baseline, `Complete qualification repair predecessor reconstruction: ${file}`);
  repairDomains[file] = {
    mode: git('ls-tree', repairRevision, '--', file).trim().split(/\s+/)[0],
    currentSha256: hash(current), currentBlob: blob(current), baselineSha256: hash(baseline), baselineBlob: blob(baseline),
    contextLines: 3, inverses,
  };
}

// Release qualification repairs remain a separate exact outer hop. This keeps every
// historical source pin immutable while reconstructing the last qualified candidate.
const releaseRepairFiles = Object.freeze([
  'schema.sql',
  'tools/commerce-deed-release-phase2-native-catalog.js',
  'tools/pgcheck.js',
]);
assert.deepEqual(git('diff', '--name-only', releaseRepairPredecessor, releaseRepairRevision).trim().split('\n'),
  releaseRepairFiles, 'Release repair revision changed outside its closed source domains');
const releaseRepairDomains = {};
for (const file of releaseRepairFiles) {
  const raw = fs.readFileSync(file, 'utf8'), current = lf(raw);
  const reviewed = git('show', `${releaseRepairRevision}:${file}`);
  const baseline = git('show', `${releaseRepairPredecessor}:${file}`);
  assert(raw === current || raw === current.replaceAll('\n', '\r\n'), `Mixed release repair line endings: ${file}`);
  assert.equal(current, reviewed, `Release repair physical source differs from the reviewed commit: ${file}`);
  assert.notEqual(current, baseline, `Release repair postimage has no change: ${file}`);
  const inverses = []; let hunk = null;
  for (const line of git('diff', '--no-ext-diff', '--unified=3', releaseRepairPredecessor,
    releaseRepairRevision, '--', file).split('\n')) {
    if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; inverses.push(hunk); }
    else if (hunk && /^[ +\-]/.test(line)) {
      if (line[0] !== '-') hunk.current += line.slice(1) + '\n';
      if (line[0] !== '+') hunk.baseline += line.slice(1) + '\n';
    }
  }
  let reconstructed = current;
  for (const inverse of inverses) {
    assert(inverse.current.length, `Empty release repair inverse context: ${file}`);
    assert.equal(reconstructed.split(inverse.current).length - 1, 1,
      `Release repair inverse context must occur once: ${file}`);
    reconstructed = reconstructed.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(reconstructed, baseline, `Complete release repair predecessor reconstruction: ${file}`);
  releaseRepairDomains[file] = {
    mode: git('ls-tree', releaseRepairRevision, '--', file).trim().split(/\s+/)[0],
    currentSha256: hash(current), currentBlob: blob(current), baselineSha256: hash(baseline), baselineBlob: blob(baseline),
    contextLines: 3, inverses,
  };
}
const releaseRepairBaseline = (file, input) => {
  const pin = releaseRepairDomains[file];
  if (!pin) return input;
  assert.equal(hash(input), pin.currentSha256, `Complete release repair source drift: ${file}`);
  assert.equal(blob(input), pin.currentBlob, `Complete release repair blob drift: ${file}`);
  let baseline = input;
  for (const inverse of pin.inverses) {
    assert.equal(baseline.split(inverse.current).length - 1, 1,
      `Missing or duplicate release repair inverse: ${file}`);
    baseline = baseline.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(hash(baseline), pin.baselineSha256, `Complete release repair predecessor source mismatch: ${file}`);
  assert.equal(blob(baseline), pin.baselineBlob, `Complete release repair predecessor blob mismatch: ${file}`);
  return baseline;
};

// The current runtime compatibility fixture is a distinct newest source hop.
// It reconstructs the prior sealed tree before any frozen Commerce reader runs.
const directorFixtureFiles = Object.freeze(['test/director-migration.js']);
assert.deepEqual(git('diff', '--name-only', directorFixturePredecessor, directorFixtureRevision).trim().split('\n'),
  directorFixtureFiles, 'Director fixture revision changed outside its closed source domain');
const directorFixtureDomains = {};
for (const file of directorFixtureFiles) {
  const raw = fs.readFileSync(file, 'utf8'), current = lf(raw);
  const reviewed = git('show', `${directorFixtureRevision}:${file}`);
  const baseline = git('show', `${directorFixturePredecessor}:${file}`);
  assert(raw === current || raw === current.replaceAll('\n', '\r\n'), `Mixed director fixture line endings: ${file}`);
  assert.equal(current, reviewed, `Director fixture physical source differs from the reviewed commit: ${file}`);
  assert.notEqual(current, baseline, `Director fixture postimage has no change: ${file}`);
  const inverses = []; let hunk = null;
  for (const line of git('diff', '--no-ext-diff', '--unified=3', directorFixturePredecessor,
    directorFixtureRevision, '--', file).split('\n')) {
    if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; inverses.push(hunk); }
    else if (hunk && /^[ +\-]/.test(line)) {
      if (line[0] !== '-') hunk.current += line.slice(1) + '\n';
      if (line[0] !== '+') hunk.baseline += line.slice(1) + '\n';
    }
  }
  let reconstructed = current;
  for (const inverse of inverses) {
    assert(inverse.current.length, `Empty director fixture inverse context: ${file}`);
    assert.equal(reconstructed.split(inverse.current).length - 1, 1,
      `Director fixture inverse context must occur once: ${file}`);
    reconstructed = reconstructed.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(reconstructed, baseline, `Complete director fixture predecessor reconstruction: ${file}`);
  directorFixtureDomains[file] = {
    mode: git('ls-tree', directorFixtureRevision, '--', file).trim().split(/\s+/)[0],
    currentSha256: hash(current), currentBlob: blob(current), baselineSha256: hash(baseline), baselineBlob: blob(baseline),
    contextLines: 3, inverses,
  };
}

// The measured Phase 2 upgrade timeout is the newest source hop. It reconstructs
// the prior sealed tree before any frozen economy source reader runs.
const phase2TimeoutFiles = Object.freeze(['test/phase2-postgres.js']);
assert.deepEqual(git('diff', '--name-only', phase2TimeoutPredecessor, phase2TimeoutRevision).trim().split('\n'),
  phase2TimeoutFiles, 'Phase 2 timeout revision changed outside its closed source domain');
const phase2TimeoutDomains = {};
for (const file of phase2TimeoutFiles) {
  const raw = fs.readFileSync(file, 'utf8'), current = lf(raw);
  const reviewed = git('show', `${phase2TimeoutRevision}:${file}`);
  const baseline = git('show', `${phase2TimeoutPredecessor}:${file}`);
  assert(raw === current || raw === current.replaceAll('\n', '\r\n'), `Mixed Phase 2 timeout line endings: ${file}`);
  assert.equal(current, reviewed, `Phase 2 timeout physical source differs from the reviewed commit: ${file}`);
  assert.notEqual(current, baseline, `Phase 2 timeout postimage has no change: ${file}`);
  const inverses = []; let hunk = null;
  for (const line of git('diff', '--no-ext-diff', '--unified=3', phase2TimeoutPredecessor,
    phase2TimeoutRevision, '--', file).split('\n')) {
    if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; inverses.push(hunk); }
    else if (hunk && /^[ +\-]/.test(line)) {
      if (line[0] !== '-') hunk.current += line.slice(1) + '\n';
      if (line[0] !== '+') hunk.baseline += line.slice(1) + '\n';
    }
  }
  let reconstructed = current;
  for (const inverse of inverses) {
    assert(inverse.current.length, `Empty Phase 2 timeout inverse context: ${file}`);
    assert.equal(reconstructed.split(inverse.current).length - 1, 1,
      `Phase 2 timeout inverse context must occur once: ${file}`);
    reconstructed = reconstructed.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(reconstructed, baseline, `Complete Phase 2 timeout predecessor reconstruction: ${file}`);
  phase2TimeoutDomains[file] = {
    mode: git('ls-tree', phase2TimeoutRevision, '--', file).trim().split(/\s+/)[0],
    currentSha256: hash(current), currentBlob: blob(current), baselineSha256: hash(baseline), baselineBlob: blob(baseline),
    contextLines: 3, inverses,
  };
}

// Later economy correctness repairs are a distinct outer hop so every earlier
// authored, binding and repair pin remains immutable. A newly added source has
// no historical predecessor and is attested without inventing predecessor text.
const repairSuccessorFiles = Object.freeze([
  'schema.sql',
  'src/db.js', 'src/growth.js', 'src/rules.tail.js', 'src/server.js', 'src/socialproof.js', 'src/verify.js', 'src/wire.js',
  'test/growth.js', 'test/sweeps.js',
]);
assert.deepEqual(git('diff', '--name-only', repairSuccessorPredecessor, repairSuccessorRevision).trim().split('\n'),
  repairSuccessorFiles, 'Repair successor revision changed outside its closed source domains');
const repairSuccessorDomains = {};
for (const file of repairSuccessorFiles) {
  const raw = fs.readFileSync(file, 'utf8'), physical = lf(raw);
  const current = releaseRepairBaseline(file, physical);
  const reviewed = git('show', `${repairSuccessorRevision}:${file}`);
  const predecessorEntry = git('ls-tree', repairSuccessorPredecessor, '--', file).trim();
  const predecessorAbsent = predecessorEntry === '';
  const baseline = predecessorAbsent ? null : git('show', `${repairSuccessorPredecessor}:${file}`);
  assert.equal(predecessorAbsent, file === 'src/socialproof.js', `Unexpected repair successor addition state: ${file}`);
  assert(raw === physical || raw === physical.replaceAll('\n', '\r\n'), `Mixed repair successor line endings: ${file}`);
  assert.equal(current, reviewed, `Repair successor physical source differs from the reviewed commit: ${file}`);
  if (!predecessorAbsent) assert.notEqual(current, baseline, `Repair successor postimage has no change: ${file}`);
  const inverses = []; let hunk = null;
  if (!predecessorAbsent) {
    for (const line of git('diff', '--no-ext-diff', '--unified=3', repairSuccessorPredecessor,
      repairSuccessorRevision, '--', file).split('\n')) {
      if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; inverses.push(hunk); }
      else if (hunk && /^[ +\-]/.test(line)) {
        if (line[0] !== '-') hunk.current += line.slice(1) + '\n';
        if (line[0] !== '+') hunk.baseline += line.slice(1) + '\n';
      }
    }
  }
  let reconstructed = current;
  for (const inverse of inverses) {
    assert(inverse.current.length, `Empty repair successor inverse context: ${file}`);
    assert.equal(reconstructed.split(inverse.current).length - 1, 1,
      `Repair successor inverse context must occur once: ${file}`);
    reconstructed = reconstructed.replace(inverse.current, () => inverse.baseline);
  }
  if (predecessorAbsent) assert.equal(inverses.length, 0, `Repair successor addition has inverse hunks: ${file}`);
  else assert.equal(reconstructed, baseline, `Complete repair successor predecessor reconstruction: ${file}`);
  repairSuccessorDomains[file] = {
    predecessorAbsent,
    mode: git('ls-tree', repairSuccessorRevision, '--', file).trim().split(/\s+/)[0],
    currentSha256: hash(current), currentBlob: blob(current),
    baselineSha256: predecessorAbsent ? null : hash(baseline),
    baselineBlob: predecessorAbsent ? null : blob(baseline),
    contextLines: 3, inverses,
  };
}
for (const file of repairFiles.filter(file => repairSuccessorFiles.includes(file))) {
  assert.equal(git('show', `${repairSuccessorPredecessor}:${file}`), git('show', `${repairRevision}:${file}`),
    `Repair successor predecessor does not compose with frozen repair: ${file}`);
}
for (const file of repairFiles.filter(file => !repairSuccessorFiles.includes(file))) {
  const raw = fs.readFileSync(file, 'utf8'), physical = lf(raw);
  const current = releaseRepairBaseline(file, physical);
  assert(raw === physical || raw === physical.replaceAll('\n', '\r\n'), `Mixed qualification repair line endings: ${file}`);
  assert.equal(current, git('show', `${repairRevision}:${file}`),
    `Unsealed physical qualification repair successor requires its own reviewed outer hop: ${file}`);
}

const revisionTree = git('rev-parse', `${revision}^{tree}`).trim();
const predecessorTree = git('rev-parse', `${predecessor}^{tree}`).trim();
const output = `// Generated exact source-only envelope for the economy-hardening candidate. Never imported by game runtime.
// Historical pins remain unchanged; unknown or non-exact bytes pass through.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
export const ECONOMY_HARDENING_SOURCE_REVISION = ${JSON.stringify(revision)};
export const ECONOMY_HARDENING_SOURCE_TREE = ${JSON.stringify(revisionTree)};
export const ECONOMY_HARDENING_SOURCE_PREDECESSOR = ${JSON.stringify(predecessor)};
export const ECONOMY_HARDENING_SOURCE_PREDECESSOR_TREE = ${JSON.stringify(predecessorTree)};
export const ECONOMY_HARDENING_SOURCE_PHASE = 'exact-source-transfer-only; no historical runtime, native, migration, financial, genesis or deployment clearance';
export const ECONOMY_HARDENING_SOURCE_DOMAINS = ${JSON.stringify(domains, null, 2)};
export const ECONOMY_HARDENING_BINDING_DOMAINS = ${JSON.stringify(bindingDomains, null, 2)};
export const ECONOMY_HARDENING_BINDING_SUCCESSOR_REVISION = ${JSON.stringify(bindingSuccessorRevision)};
export const ECONOMY_HARDENING_BINDING_SUCCESSOR_TREE = ${JSON.stringify(bindingSuccessorTree)};
export const ECONOMY_HARDENING_BINDING_SUCCESSOR_PREDECESSOR = ${JSON.stringify(bindingRevision)};
export const ECONOMY_HARDENING_BINDING_SUCCESSOR_PREDECESSOR_TREE = ${JSON.stringify(bindingRevisionTree)};
export const ECONOMY_HARDENING_BINDING_SUCCESSOR_PHASE = 'exact-authored-binding-successor-source-transfer-only; no historical runtime, native, migration, financial, genesis or deployment clearance';
export const ECONOMY_HARDENING_BINDING_SUCCESSOR_DOMAINS = ${JSON.stringify(bindingSuccessorDomains, null, 2)};
export const ECONOMY_HARDENING_REPAIR_REVISION = ${JSON.stringify(repairRevision)};
export const ECONOMY_HARDENING_REPAIR_TREE = ${JSON.stringify(repairRevisionTree)};
export const ECONOMY_HARDENING_REPAIR_PREDECESSOR = ${JSON.stringify(repairPredecessor)};
export const ECONOMY_HARDENING_REPAIR_PREDECESSOR_TREE = ${JSON.stringify(repairPredecessorTree)};
export const ECONOMY_HARDENING_REPAIR_PHASE = 'exact-economy-qualification-repair-source-transfer-only; no historical runtime, native, migration, financial, activation or deployment clearance';
export const ECONOMY_HARDENING_REPAIR_DOMAINS = ${JSON.stringify(repairDomains, null, 2)};
export const ECONOMY_HARDENING_REPAIR_SUCCESSOR_REVISION = ${JSON.stringify(repairSuccessorRevision)};
export const ECONOMY_HARDENING_REPAIR_SUCCESSOR_TREE = ${JSON.stringify(repairSuccessorRevisionTree)};
export const ECONOMY_HARDENING_REPAIR_SUCCESSOR_PREDECESSOR = ${JSON.stringify(repairSuccessorPredecessor)};
export const ECONOMY_HARDENING_REPAIR_SUCCESSOR_PREDECESSOR_TREE = ${JSON.stringify(repairSuccessorPredecessorTree)};
export const ECONOMY_HARDENING_REPAIR_SUCCESSOR_PHASE = 'exact-economy-repair-successor-source-transfer-only; no historical runtime, native, migration, financial, activation or deployment clearance';
export const ECONOMY_HARDENING_REPAIR_SUCCESSOR_DOMAINS = ${JSON.stringify(repairSuccessorDomains, null, 2)};
export const ECONOMY_HARDENING_RELEASE_REPAIR_REVISION = ${JSON.stringify(releaseRepairRevision)};
export const ECONOMY_HARDENING_RELEASE_REPAIR_TREE = ${JSON.stringify(releaseRepairRevisionTree)};
export const ECONOMY_HARDENING_RELEASE_REPAIR_PREDECESSOR = ${JSON.stringify(releaseRepairPredecessor)};
export const ECONOMY_HARDENING_RELEASE_REPAIR_PREDECESSOR_TREE = ${JSON.stringify(releaseRepairPredecessorTree)};
export const ECONOMY_HARDENING_RELEASE_REPAIR_PHASE = 'exact-economy-release-repair-source-transfer-only; no historical runtime, native, migration, financial, activation or deployment clearance';
export const ECONOMY_HARDENING_RELEASE_REPAIR_DOMAINS = ${JSON.stringify(releaseRepairDomains, null, 2)};
export const ECONOMY_HARDENING_DIRECTOR_FIXTURE_REVISION = ${JSON.stringify(directorFixtureRevision)};
export const ECONOMY_HARDENING_DIRECTOR_FIXTURE_TREE = ${JSON.stringify(directorFixtureRevisionTree)};
export const ECONOMY_HARDENING_DIRECTOR_FIXTURE_PREDECESSOR = ${JSON.stringify(directorFixturePredecessor)};
export const ECONOMY_HARDENING_DIRECTOR_FIXTURE_PREDECESSOR_TREE = ${JSON.stringify(directorFixturePredecessorTree)};
export const ECONOMY_HARDENING_DIRECTOR_FIXTURE_PHASE = 'exact-economy-director-fixture-source-transfer-only; no historical runtime, native, migration, financial, activation or deployment clearance';
export const ECONOMY_HARDENING_DIRECTOR_FIXTURE_DOMAINS = ${JSON.stringify(directorFixtureDomains, null, 2)};
export const ECONOMY_HARDENING_PHASE2_TIMEOUT_REVISION = ${JSON.stringify(phase2TimeoutRevision)};
export const ECONOMY_HARDENING_PHASE2_TIMEOUT_TREE = ${JSON.stringify(phase2TimeoutRevisionTree)};
export const ECONOMY_HARDENING_PHASE2_TIMEOUT_PREDECESSOR = ${JSON.stringify(phase2TimeoutPredecessor)};
export const ECONOMY_HARDENING_PHASE2_TIMEOUT_PREDECESSOR_TREE = ${JSON.stringify(phase2TimeoutPredecessorTree)};
export const ECONOMY_HARDENING_PHASE2_TIMEOUT_PHASE = 'exact-economy-phase2-upgrade-timeout-source-transfer-only; no historical runtime, native, migration, financial, activation or deployment clearance';
export const ECONOMY_HARDENING_PHASE2_TIMEOUT_DOMAINS = ${JSON.stringify(phase2TimeoutDomains, null, 2)};
for (const pin of [...Object.values(ECONOMY_HARDENING_SOURCE_DOMAINS), ...Object.values(ECONOMY_HARDENING_BINDING_DOMAINS),
  ...Object.values(ECONOMY_HARDENING_BINDING_SUCCESSOR_DOMAINS), ...Object.values(ECONOMY_HARDENING_REPAIR_DOMAINS),
  ...Object.values(ECONOMY_HARDENING_REPAIR_SUCCESSOR_DOMAINS), ...Object.values(ECONOMY_HARDENING_RELEASE_REPAIR_DOMAINS),
  ...Object.values(ECONOMY_HARDENING_DIRECTOR_FIXTURE_DOMAINS), ...Object.values(ECONOMY_HARDENING_PHASE2_TIMEOUT_DOMAINS)]) {
  for (const inverse of pin.inverses) Object.freeze(inverse);
  Object.freeze(pin.inverses); Object.freeze(pin);
}
Object.freeze(ECONOMY_HARDENING_SOURCE_DOMAINS);
Object.freeze(ECONOMY_HARDENING_BINDING_DOMAINS);
Object.freeze(ECONOMY_HARDENING_BINDING_SUCCESSOR_DOMAINS);
Object.freeze(ECONOMY_HARDENING_REPAIR_DOMAINS);
Object.freeze(ECONOMY_HARDENING_REPAIR_SUCCESSOR_DOMAINS);
Object.freeze(ECONOMY_HARDENING_RELEASE_REPAIR_DOMAINS);
Object.freeze(ECONOMY_HARDENING_DIRECTOR_FIXTURE_DOMAINS);
Object.freeze(ECONOMY_HARDENING_PHASE2_TIMEOUT_DOMAINS);
const lf = text => text.replaceAll('\\r\\n', '\\n');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\\0').update(text).digest('hex');
const uniform = text => typeof text === 'string' && !text.includes('\\0') && !text.startsWith('\\ufeff')
  && !lf(text).includes('\\r') && (text === lf(text) || text === lf(text).replaceAll('\\n', '\\r\\n'));
export function assertEconomyHardeningSourceTransfer(file, input) {
  assert(Object.hasOwn(ECONOMY_HARDENING_SOURCE_DOMAINS, file), 'Unknown economy-hardening source domain');
  assert(uniform(input), 'Uniform whole economy-hardening LF/CRLF source text required');
  const pin = ECONOMY_HARDENING_SOURCE_DOMAINS[file], text = lf(input);
  assert.equal(hash(text), pin.currentSha256, 'Complete economy-hardening current source drift: ' + file);
  assert.equal(blob(text), pin.currentBlob, 'Complete economy-hardening current blob drift: ' + file);
  let baselineText = text;
  for (const inverse of pin.inverses) {
    assert(inverse.current.length);
    assert.equal(baselineText.split(inverse.current).length - 1, 1, 'Missing or duplicate economy-hardening inverse: ' + file);
    baselineText = baselineText.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(hash(baselineText), pin.baselineSha256, 'Complete economy-hardening predecessor source mismatch: ' + file);
  assert.equal(blob(baselineText), pin.baselineBlob, 'Complete economy-hardening predecessor blob mismatch: ' + file);
  return { file, baselineText, candidateSha256: pin.currentSha256, sourceRevision: ECONOMY_HARDENING_SOURCE_REVISION,
    predecessorRevision: ECONOMY_HARDENING_SOURCE_PREDECESSOR, inverseChunks: pin.inverses.length,
    phase: ECONOMY_HARDENING_SOURCE_PHASE, sourceOnly: true };
}
export function assertEconomyHardeningBindingTransfer(file, input) {
  assert(Object.hasOwn(ECONOMY_HARDENING_BINDING_DOMAINS, file), 'Unknown economy-hardening binding domain');
  assert(uniform(input), 'Uniform whole economy-hardening binding LF/CRLF source text required');
  const pin = ECONOMY_HARDENING_BINDING_DOMAINS[file], text = lf(input);
  assert.equal(hash(text), pin.currentSha256, 'Complete economy-hardening binding source drift: ' + file);
  assert.equal(blob(text), pin.currentBlob, 'Complete economy-hardening binding blob drift: ' + file);
  let baselineText = text;
  for (const inverse of pin.inverses) {
    assert(inverse.current.length);
    assert.equal(baselineText.split(inverse.current).length - 1, 1, 'Missing or duplicate economy-hardening binding inverse: ' + file);
    baselineText = baselineText.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(hash(baselineText), pin.baselineSha256, 'Complete economy-hardening authored binding source mismatch: ' + file);
  assert.equal(blob(baselineText), pin.baselineBlob, 'Complete economy-hardening authored binding blob mismatch: ' + file);
  return { file, baselineText, postimageSha256: pin.currentSha256, predecessorRevision: ECONOMY_HARDENING_SOURCE_REVISION,
    inverseChunks: pin.inverses.length, phase: ECONOMY_HARDENING_SOURCE_PHASE, sourceOnly: true };
}
export function assertEconomyHardeningBindingSuccessorTransfer(file, input) {
  assert(Object.hasOwn(ECONOMY_HARDENING_BINDING_SUCCESSOR_DOMAINS, file), 'Unknown economy-hardening binding successor domain');
  assert(uniform(input), 'Uniform whole economy-hardening binding successor LF/CRLF source text required');
  const pin = ECONOMY_HARDENING_BINDING_SUCCESSOR_DOMAINS[file], text = lf(input);
  assert.equal(hash(text), pin.currentSha256, 'Complete economy-hardening binding successor source drift: ' + file);
  assert.equal(blob(text), pin.currentBlob, 'Complete economy-hardening binding successor blob drift: ' + file);
  let baselineText = text;
  for (const inverse of pin.inverses) {
    assert(inverse.current.length);
    assert.equal(baselineText.split(inverse.current).length - 1, 1, 'Missing or duplicate economy-hardening binding successor inverse: ' + file);
    baselineText = baselineText.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(hash(baselineText), pin.baselineSha256, 'Complete economy-hardening binding successor predecessor source mismatch: ' + file);
  assert.equal(blob(baselineText), pin.baselineBlob, 'Complete economy-hardening binding successor predecessor blob mismatch: ' + file);
  return { file, baselineText, postimageSha256: pin.currentSha256,
    sourceRevision: ECONOMY_HARDENING_BINDING_SUCCESSOR_REVISION,
    predecessorRevision: ECONOMY_HARDENING_BINDING_SUCCESSOR_PREDECESSOR,
    inverseChunks: pin.inverses.length, phase: ECONOMY_HARDENING_BINDING_SUCCESSOR_PHASE, sourceOnly: true };
}
export function assertEconomyHardeningRepairTransfer(file, input) {
  assert(Object.hasOwn(ECONOMY_HARDENING_REPAIR_DOMAINS, file), 'Unknown economy-hardening qualification repair domain');
  assert(uniform(input), 'Uniform whole economy-hardening qualification repair LF/CRLF source text required');
  const pin = ECONOMY_HARDENING_REPAIR_DOMAINS[file], text = lf(input);
  assert.equal(hash(text), pin.currentSha256, 'Complete economy-hardening qualification repair source drift: ' + file);
  assert.equal(blob(text), pin.currentBlob, 'Complete economy-hardening qualification repair blob drift: ' + file);
  let baselineText = text;
  for (const inverse of pin.inverses) {
    assert(inverse.current.length);
    assert.equal(baselineText.split(inverse.current).length - 1, 1, 'Missing or duplicate economy-hardening qualification repair inverse: ' + file);
    baselineText = baselineText.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(hash(baselineText), pin.baselineSha256, 'Complete economy-hardening qualification repair predecessor source mismatch: ' + file);
  assert.equal(blob(baselineText), pin.baselineBlob, 'Complete economy-hardening qualification repair predecessor blob mismatch: ' + file);
  return { file, baselineText, postimageSha256: pin.currentSha256, sourceRevision: ECONOMY_HARDENING_REPAIR_REVISION,
    predecessorRevision: ECONOMY_HARDENING_REPAIR_PREDECESSOR, inverseChunks: pin.inverses.length,
    phase: ECONOMY_HARDENING_REPAIR_PHASE, sourceOnly: true };
}
export function assertEconomyHardeningRepairSuccessorTransfer(file, input) {
  assert(Object.hasOwn(ECONOMY_HARDENING_REPAIR_SUCCESSOR_DOMAINS, file), 'Unknown economy-hardening repair successor domain');
  assert(uniform(input), 'Uniform whole economy-hardening repair successor LF/CRLF source text required');
  const pin = ECONOMY_HARDENING_REPAIR_SUCCESSOR_DOMAINS[file], text = lf(input);
  assert.equal(hash(text), pin.currentSha256, 'Complete economy-hardening repair successor source drift: ' + file);
  assert.equal(blob(text), pin.currentBlob, 'Complete economy-hardening repair successor blob drift: ' + file);
  if (pin.predecessorAbsent) {
    assert.equal(pin.baselineSha256, null); assert.equal(pin.baselineBlob, null); assert.equal(pin.inverses.length, 0);
    return { file, baselineText: null, predecessorAbsent: true, postimageSha256: pin.currentSha256,
      sourceRevision: ECONOMY_HARDENING_REPAIR_SUCCESSOR_REVISION,
      predecessorRevision: ECONOMY_HARDENING_REPAIR_SUCCESSOR_PREDECESSOR,
      inverseChunks: 0, phase: ECONOMY_HARDENING_REPAIR_SUCCESSOR_PHASE, sourceOnly: true };
  }
  let baselineText = text;
  for (const inverse of pin.inverses) {
    assert(inverse.current.length);
    assert.equal(baselineText.split(inverse.current).length - 1, 1,
      'Missing or duplicate economy-hardening repair successor inverse: ' + file);
    baselineText = baselineText.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(hash(baselineText), pin.baselineSha256,
    'Complete economy-hardening repair successor predecessor source mismatch: ' + file);
  assert.equal(blob(baselineText), pin.baselineBlob,
    'Complete economy-hardening repair successor predecessor blob mismatch: ' + file);
  return { file, baselineText, predecessorAbsent: false, postimageSha256: pin.currentSha256,
    sourceRevision: ECONOMY_HARDENING_REPAIR_SUCCESSOR_REVISION,
    predecessorRevision: ECONOMY_HARDENING_REPAIR_SUCCESSOR_PREDECESSOR,
    inverseChunks: pin.inverses.length, phase: ECONOMY_HARDENING_REPAIR_SUCCESSOR_PHASE, sourceOnly: true };
}
export function assertEconomyHardeningReleaseRepairTransfer(file, input) {
  assert(Object.hasOwn(ECONOMY_HARDENING_RELEASE_REPAIR_DOMAINS, file), 'Unknown economy-hardening release repair domain');
  assert(uniform(input), 'Uniform whole economy-hardening release repair LF/CRLF source text required');
  const pin = ECONOMY_HARDENING_RELEASE_REPAIR_DOMAINS[file], text = lf(input);
  assert.equal(hash(text), pin.currentSha256, 'Complete economy-hardening release repair source drift: ' + file);
  assert.equal(blob(text), pin.currentBlob, 'Complete economy-hardening release repair blob drift: ' + file);
  let baselineText = text;
  for (const inverse of pin.inverses) {
    assert(inverse.current.length);
    assert.equal(baselineText.split(inverse.current).length - 1, 1,
      'Missing or duplicate economy-hardening release repair inverse: ' + file);
    baselineText = baselineText.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(hash(baselineText), pin.baselineSha256,
    'Complete economy-hardening release repair predecessor source mismatch: ' + file);
  assert.equal(blob(baselineText), pin.baselineBlob,
    'Complete economy-hardening release repair predecessor blob mismatch: ' + file);
  return { file, baselineText, postimageSha256: pin.currentSha256,
    sourceRevision: ECONOMY_HARDENING_RELEASE_REPAIR_REVISION,
    predecessorRevision: ECONOMY_HARDENING_RELEASE_REPAIR_PREDECESSOR,
    inverseChunks: pin.inverses.length, phase: ECONOMY_HARDENING_RELEASE_REPAIR_PHASE, sourceOnly: true };
}
export function assertEconomyHardeningDirectorFixtureTransfer(file, input) {
  assert(Object.hasOwn(ECONOMY_HARDENING_DIRECTOR_FIXTURE_DOMAINS, file), 'Unknown economy-hardening director fixture domain');
  assert(uniform(input), 'Uniform whole economy-hardening director fixture LF/CRLF source text required');
  const pin = ECONOMY_HARDENING_DIRECTOR_FIXTURE_DOMAINS[file], text = lf(input);
  assert.equal(hash(text), pin.currentSha256, 'Complete economy-hardening director fixture source drift: ' + file);
  assert.equal(blob(text), pin.currentBlob, 'Complete economy-hardening director fixture blob drift: ' + file);
  let baselineText = text;
  for (const inverse of pin.inverses) {
    assert(inverse.current.length);
    assert.equal(baselineText.split(inverse.current).length - 1, 1,
      'Missing or duplicate economy-hardening director fixture inverse: ' + file);
    baselineText = baselineText.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(hash(baselineText), pin.baselineSha256,
    'Complete economy-hardening director fixture predecessor source mismatch: ' + file);
  assert.equal(blob(baselineText), pin.baselineBlob,
    'Complete economy-hardening director fixture predecessor blob mismatch: ' + file);
  return { file, baselineText, postimageSha256: pin.currentSha256,
    sourceRevision: ECONOMY_HARDENING_DIRECTOR_FIXTURE_REVISION,
    predecessorRevision: ECONOMY_HARDENING_DIRECTOR_FIXTURE_PREDECESSOR,
    inverseChunks: pin.inverses.length, phase: ECONOMY_HARDENING_DIRECTOR_FIXTURE_PHASE, sourceOnly: true };
}
export function assertEconomyHardeningPhase2TimeoutTransfer(file, input) {
  assert(Object.hasOwn(ECONOMY_HARDENING_PHASE2_TIMEOUT_DOMAINS, file), 'Unknown economy-hardening Phase 2 timeout domain');
  assert(uniform(input), 'Uniform whole economy-hardening Phase 2 timeout LF/CRLF source text required');
  const pin = ECONOMY_HARDENING_PHASE2_TIMEOUT_DOMAINS[file], text = lf(input);
  assert.equal(hash(text), pin.currentSha256, 'Complete economy-hardening Phase 2 timeout source drift: ' + file);
  assert.equal(blob(text), pin.currentBlob, 'Complete economy-hardening Phase 2 timeout blob drift: ' + file);
  let baselineText = text;
  for (const inverse of pin.inverses) {
    assert(inverse.current.length);
    assert.equal(baselineText.split(inverse.current).length - 1, 1,
      'Missing or duplicate economy-hardening Phase 2 timeout inverse: ' + file);
    baselineText = baselineText.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(hash(baselineText), pin.baselineSha256,
    'Complete economy-hardening Phase 2 timeout predecessor source mismatch: ' + file);
  assert.equal(blob(baselineText), pin.baselineBlob,
    'Complete economy-hardening Phase 2 timeout predecessor blob mismatch: ' + file);
  return { file, baselineText, postimageSha256: pin.currentSha256,
    sourceRevision: ECONOMY_HARDENING_PHASE2_TIMEOUT_REVISION,
    predecessorRevision: ECONOMY_HARDENING_PHASE2_TIMEOUT_PREDECESSOR,
    inverseChunks: pin.inverses.length, phase: ECONOMY_HARDENING_PHASE2_TIMEOUT_PHASE, sourceOnly: true };
}
export function economyHardeningSourceBaseline(file, input) {
  if (!uniform(input)) return input;
  let text = input;
  if (Object.hasOwn(ECONOMY_HARDENING_PHASE2_TIMEOUT_DOMAINS, file)
      && hash(lf(text)) === ECONOMY_HARDENING_PHASE2_TIMEOUT_DOMAINS[file].currentSha256)
    text = assertEconomyHardeningPhase2TimeoutTransfer(file, text).baselineText;
  if (Object.hasOwn(ECONOMY_HARDENING_DIRECTOR_FIXTURE_DOMAINS, file)
      && hash(lf(text)) === ECONOMY_HARDENING_DIRECTOR_FIXTURE_DOMAINS[file].currentSha256)
    text = assertEconomyHardeningDirectorFixtureTransfer(file, text).baselineText;
  if (Object.hasOwn(ECONOMY_HARDENING_RELEASE_REPAIR_DOMAINS, file)
      && hash(lf(text)) === ECONOMY_HARDENING_RELEASE_REPAIR_DOMAINS[file].currentSha256)
    text = assertEconomyHardeningReleaseRepairTransfer(file, text).baselineText;
  if (Object.hasOwn(ECONOMY_HARDENING_REPAIR_SUCCESSOR_DOMAINS, file)
      && hash(lf(text)) === ECONOMY_HARDENING_REPAIR_SUCCESSOR_DOMAINS[file].currentSha256) {
    const transfer = assertEconomyHardeningRepairSuccessorTransfer(file, text);
    if (!transfer.predecessorAbsent) text = transfer.baselineText;
  }
  if (Object.hasOwn(ECONOMY_HARDENING_REPAIR_DOMAINS, file)
      && hash(lf(text)) === ECONOMY_HARDENING_REPAIR_DOMAINS[file].currentSha256)
    text = assertEconomyHardeningRepairTransfer(file, text).baselineText;
  if (Object.hasOwn(ECONOMY_HARDENING_BINDING_SUCCESSOR_DOMAINS, file)
      && hash(lf(text)) === ECONOMY_HARDENING_BINDING_SUCCESSOR_DOMAINS[file].currentSha256)
    text = assertEconomyHardeningBindingSuccessorTransfer(file, text).baselineText;
  if (Object.hasOwn(ECONOMY_HARDENING_BINDING_DOMAINS, file)
      && hash(lf(text)) === ECONOMY_HARDENING_BINDING_DOMAINS[file].currentSha256)
    text = assertEconomyHardeningBindingTransfer(file, text).baselineText;
  if (Object.hasOwn(ECONOMY_HARDENING_SOURCE_DOMAINS, file)
      && hash(lf(text)) === ECONOMY_HARDENING_SOURCE_DOMAINS[file].currentSha256)
    text = assertEconomyHardeningSourceTransfer(file, text).baselineText;
  return text;
}
`;
fs.writeFileSync(new URL('./economy-hardening-source-transfer.js', import.meta.url), output);
console.log(`Generated ${files.length} authored, ${bindingFiles.length} binding, ${bindingSuccessorFiles.length} binding successor, ${repairFiles.length} repair, ${repairSuccessorFiles.length} repair successor, ${releaseRepairFiles.length} release repair, ${directorFixtureFiles.length} director fixture, and ${phase2TimeoutFiles.length} Phase 2 timeout source domains; historical pins remain unchanged.`);
