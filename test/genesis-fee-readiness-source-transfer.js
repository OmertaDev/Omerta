import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { nativeEthHistoricalInput } from '../tools/native-eth-source-transfer.js';
import { CONTRACT_RELEASE_SOURCE_DATA } from '../tools/contract-release-source-data.js';
import { contractReleaseFeeInput } from '../tools/contract-release-source-transfer.js';
import { QUESTING_SOURCE, qualifyQuestingSource, questingHistoricalInput,
  questingHistoricalEntry } from '../tools/questing-source-transfer.js';
import { SITE_BASICS_SOURCE, qualifySiteBasicsSource } from '../tools/site-basics-source-transfer.js';
import { ageRemovalHistoricalRecord } from '../tools/age-removal-source-transfer.js';
import {
  GENESIS_FEE_READINESS_BASE_REVISION, GENESIS_FEE_READINESS_REVIEWED_REVISION,
  GENESIS_FEE_READINESS_DOMAINS, GENESIS_FEE_READINESS_SOURCE_TRANSFER,
  assertGenesisFeeReadinessSourceTransfer, qualifyGenesisFeeReadinessSource,
  genesisFeeReadinessSourceBaseline,
} from '../tools/genesis-fee-readiness-source-transfer.js';
import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';
import { hasCommerceCurrentEnterpriseSource, commerceOverCurrentEnterpriseSourceBaseline } from '../tools/commerce-current-enterprise-source-compatibility.js';
import { hasEnterpriseOverRootSource, enterpriseOverRootSourceBaseline } from '../tools/enterprise-current-source-compatibility.js';
import { WORLD_RECOVERY_REVIEW, verifyWorldRecoverySources } from '../tools/rc1-world-qualification.js';

const file = 'src/genesisauction.js', pin = GENESIS_FEE_READINESS_DOMAINS[file];
const lf = text => text.replaceAll('\r\n', '\n');
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const git = (...args) => lf(execFileSync('git', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
const current = lf(nativeEthHistoricalInput(file, fs.readFileSync(file, 'utf8')));
const baseline = git('show', `${GENESIS_FEE_READINESS_BASE_REVISION}:${file}`);
const pinned = git('show', `${GENESIS_FEE_READINESS_REVIEWED_REVISION}:${file}`);
const gitBlob = text => execFileSync('git', ['hash-object', '--stdin'], { input: text, encoding: 'utf8' }).trim();
assert.equal(current, pinned, 'Full genesis source must match the recorded source revision');
assert.equal(sha(current), pin.currentSha256); assert.equal(gitBlob(current), pin.currentBlob);
assert.equal(sha(baseline), pin.baselineSha256); assert.equal(gitBlob(baseline), pin.baselineBlob);
assert.equal(Buffer.byteLength(current), pin.currentBytes);
assert.equal(Buffer.byteLength(baseline), pin.baselineBytes);
assert.equal(pin.inverses.length, 4);

// Compare every inverse with Git's exact source diff, including unchanged context.
const diff = git('diff', '--no-ext-diff', '--unified=3', GENESIS_FEE_READINESS_BASE_REVISION,
  GENESIS_FEE_READINESS_REVIEWED_REVISION, '--', file);
const parseHunks = diff => {
  const hunks = []; let hunk;
  for (const line of diff.split('\n')) {
    if (line.startsWith('@@')) { if (hunk) hunks.push(hunk); hunk = { current: '', baseline: '' }; continue; }
    if (!hunk || line.startsWith('\\')) continue;
    if (line.startsWith(' ')) { hunk.current += line.slice(1) + '\n'; hunk.baseline += line.slice(1) + '\n'; }
    else if (line.startsWith('+')) hunk.current += line.slice(1) + '\n';
    else if (line.startsWith('-')) hunk.baseline += line.slice(1) + '\n';
  }
  if (hunk) hunks.push(hunk);
  return hunks;
};
const hunks = parseHunks(diff);
assert.deepEqual(pin.inverses, hunks, 'Only the four complete reviewed Git hunks may be inverted');
let positive = 0, negative = 0;
for (const input of [current, current.replaceAll('\n', '\r\n'), Buffer.from(current), Buffer.from(current.replaceAll('\n', '\r\n')), fs.readFileSync(file, 'utf8')]) {
  const proof = assertGenesisFeeReadinessSourceTransfer(file, input);
  assert.equal(proof.baselineText, baseline);
  assert.equal(proof.sourceRevision, GENESIS_FEE_READINESS_REVIEWED_REVISION);
  assert.equal(proof.inverseChunks, 4);
  assert.equal(proof.sourceOnly, true); assert.equal(proof.runtime, false); assert.equal(proof.native, false);
  assert.equal(genesisFeeReadinessSourceBaseline(file, input), baseline);
  assert.equal(qualifyGenesisFeeReadinessSource(file, input).baselineText, baseline);
  positive++;
}
for (const input of [baseline, baseline.replaceAll('\n', '\r\n'), Buffer.from(baseline)]) {
  const proof = qualifyGenesisFeeReadinessSource(file, input);
  assert.equal(proof.baselineText, baseline);
  assert.equal(proof.sourceRevision, GENESIS_FEE_READINESS_BASE_REVISION);
  assert.equal(proof.inverseChunks, 0);
  assert.throws(() => assertGenesisFeeReadinessSourceTransfer(file, input), 'The predecessor must not masquerade as the current reviewed source');
  assert.equal(genesisFeeReadinessSourceBaseline(file, input), input);
  positive++; negative++;
}

const reject = changed => {
  assert.notEqual(changed, current);
  assert.throws(() => assertGenesisFeeReadinessSourceTransfer(file, changed));
  assert.throws(() => qualifyGenesisFeeReadinessSource(file, changed));
  assert.equal(genesisFeeReadinessSourceBaseline(file, changed), changed, 'Unknown bytes must stay with the rejecting original guard');
  negative++;
};
const mutations = [
  current + '\n// unreviewed source edit\n', '\uFEFF' + current, current + '\0',
  current.replace('bid_owner', 'any_owner'),
  current.replace('if (!ctx.bid || !ctx.bid.ownedByAccount)', 'if (!ctx.bid)'),
  current.replace("['bid', 'exitBid', 'claimBid']", "['bid', 'exitBid', 'claimBid', 'sweepCurrency']"),
  current.replace('maxAge > 120', 'maxAge > 120000'),
  current.replace("await unchanged(ctx); return projection(ctx);", 'return projection(ctx);'),
  current.replace('BigInt(s.blockNumberish) < BigInt(s.endBlock)', 'BigInt(s.blockNumberish) > BigInt(s.endBlock)'),
  current.replace('baseTradeBps: 350', 'baseTradeBps: 500'),
  current.replace("read('btcRewards', 'safe')", "read('coordinator', 'safe')"),
  current.replace('!same(vaultSafe, manifest.policy.familySafe)', 'false'),
];
for (const inverse of pin.inverses) {
  mutations.push(current.replace(inverse.current, ''), current + inverse.current,
    current.replace(inverse.current, () => inverse.baseline));
}
for (const changed of mutations) { reject(changed); reject(changed.replaceAll('\n', '\r\n')); }
reject(current.replace('\n', '\r\n'));
reject(Buffer.from([0xff, 0xfe, 0x00]));
for (const unknown of ['src/server.js', 'src/worker.js', 'toString']) {
  assert.throws(() => assertGenesisFeeReadinessSourceTransfer(unknown, current));
  assert.throws(() => qualifyGenesisFeeReadinessSource(unknown, current));
  assert.equal(genesisFeeReadinessSourceBaseline(unknown, current), current);
  negative++;
}
for (const invalid of [null, undefined, 1, {}, []]) {
  assert.throws(() => assertGenesisFeeReadinessSourceTransfer(file, invalid));
  assert.throws(() => qualifyGenesisFeeReadinessSource(file, invalid));
  negative++;
}

for (const [path, domain] of Object.entries(GENESIS_FEE_READINESS_DOMAINS).filter(([path]) => path !== file)) {
  const text = lf(nativeEthHistoricalInput(path, fs.readFileSync(path, 'utf8')));
  const previous = git('show', `${GENESIS_FEE_READINESS_BASE_REVISION}:${path}`);
  assert.equal(text, git('show', `${GENESIS_FEE_READINESS_REVIEWED_REVISION}:${path}`));
  assert.equal(sha(text), domain.currentSha256); assert.equal(gitBlob(text), domain.currentBlob);
  assert.equal(sha(previous), domain.baselineSha256); assert.equal(gitBlob(previous), domain.baselineBlob);
  assert.equal(Buffer.byteLength(text), domain.currentBytes); assert.equal(Buffer.byteLength(previous), domain.baselineBytes);
  assert.deepEqual(domain.inverses, parseHunks(git('diff', '--no-ext-diff', '--unified=3',
    GENESIS_FEE_READINESS_BASE_REVISION, GENESIS_FEE_READINESS_REVIEWED_REVISION, '--', path)));
  for (const input of [text, text.replaceAll('\n', '\r\n'), Buffer.from(text), fs.readFileSync(path, 'utf8')]) {
    const proof = assertGenesisFeeReadinessSourceTransfer(path, input);
    assert.equal(proof.baselineText, previous); assert.equal(proof.sourceOnly, true);
    assert.equal(proof.runtime, false); assert.equal(proof.native, false);
    assert.equal(genesisFeeReadinessSourceBaseline(path, input), previous);
    assert.equal(qualifyGenesisFeeReadinessSource(path, input).baselineText, previous);
    positive++;
  }
  assert.equal(qualifyGenesisFeeReadinessSource(path, previous).baselineText, previous);
  assert.throws(() => assertGenesisFeeReadinessSourceTransfer(path, previous), 'Complete rollback cannot be current-source evidence');
  positive++; negative++;
  const changedInputs = [text + '\n// extra source edit\n', '\uFEFF' + text, text.replace('\n', '\r\n')];
  for (const inverse of domain.inverses) changedInputs.push(text.replace(inverse.current, ''), text + inverse.current,
    text.replace(inverse.current, () => inverse.baseline));
  for (const changed of changedInputs) {
    assert.notEqual(changed, text);
    assert.throws(() => assertGenesisFeeReadinessSourceTransfer(path, changed));
    assert.throws(() => qualifyGenesisFeeReadinessSource(path, changed));
    assert.equal(genesisFeeReadinessSourceBaseline(path, changed), changed);
    negative++;
  }
}

// Preserve the existing frozen recovery review and its complete source-pin inventory.
assert.equal(WORLD_RECOVERY_REVIEW.sourceFiles[file], '7fe75323e9ce4e3e5047d653b858f440db13ffc4b4ad7f9f58f8b88988f9b39e');
assert.equal(GENESIS_FEE_READINESS_SOURCE_TRANSFER.phase, 'exact source transfer only; no runtime, native, financial or deployment qualification');
const reader = file => hasEnterpriseOverRootSource(file)
  ? enterpriseOverRootSourceBaseline(file, String(hasCommerceCurrentEnterpriseSource(file)
    ? commerceOverCurrentEnterpriseSourceBaseline(file, nativeEthHistoricalInput(file, fs.readFileSync(file, 'utf8')))
    : continuousCityHistoricalInput(file, nativeEthHistoricalInput(file, fs.readFileSync(file, 'utf8')))))
  : continuousCityHistoricalInput(file, nativeEthHistoricalInput(file, fs.readFileSync(file, 'utf8')));
const actual = await verifyWorldRecoverySources({ readFile: reader, sourceRevision: GENESIS_FEE_READINESS_REVIEWED_REVISION });
const prior = await verifyWorldRecoverySources({ readFile: path => Object.hasOwn(GENESIS_FEE_READINESS_DOMAINS, path)
  ? git('show', `${GENESIS_FEE_READINESS_BASE_REVISION}:${path}`) : reader(path), sourceRevision: GENESIS_FEE_READINESS_REVIEWED_REVISION });
assert.deepEqual(actual, prior, 'Exact inversion must preserve every prior recovery metadata field and source pin');
for (const changed of [mutations[0], mutations[4], mutations[9]]) {
  await assert.rejects(verifyWorldRecoverySources({ readFile: path => path === file ? changed : reader(path), sourceRevision: GENESIS_FEE_READINESS_REVIEWED_REVISION }), /Recovery rule source changed: src\/genesisauction.js/);
  negative++;
}
for (const path of Object.keys(GENESIS_FEE_READINESS_DOMAINS).filter(path => path !== file)) {
  await assert.rejects(verifyWorldRecoverySources({ readFile: file => file === path
    ? lf(fs.readFileSync(path, 'utf8')) + '\n// unreviewed edit\n' : reader(file), sourceRevision: GENESIS_FEE_READINESS_REVIEWED_REVISION }), /Recovery rule source changed:/);
  negative++;
}
console.log(`genesis-fee-readiness-source-transfer: PASS three complete sources, twenty exact Git hunks, SHA256/blob/bytes, ${positive} positive and ${negative} negative controls; unchanged historical recovery metadata; source-only scope`);

// The cold historical fixture reads one public source as text; it never executes that client.
// Keep its complete predecessor body sealed while exercising the exact reader-only delta.
{
  const { GENESIS_HISTORICAL_READER_BINDING: binding, GENESIS_HISTORICAL_READER_BINDING_SHA256,
    assertGenesisHistoricalReaderSourceTransfer, genesisHistoricalReaderHistoricalInput } = await import('../tools/genesis-historical-reader-source-transfer.js');
  const { economyHardeningSourceBaseline } = await import('../tools/economy-hardening-source-transfer.js');
  const fixture = binding.file;
  const actualEntry = git('ls-tree', 'HEAD', '--', fixture).trim();
  const actual = actualEntry.match(/^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/);
  assert(actual && actual[3] === fixture, 'Regular actual fixture source qualifies first');
  const actualIndex = git('ls-files', '--stage', '--', fixture).trim();
  assert.equal(actualIndex,
    actual[1] + ' ' + actual[2] + ' 0\t' + fixture, 'Actual fixture index qualifies before historical comparison');
  const head = git('show', 'HEAD:' + fixture);
  assert.equal(gitBlob(head), actual[2], 'Complete actual fixture Git bytes qualify first');
  const stat = fs.lstatSync(fixture); assert(stat.isFile() && !stat.isSymbolicLink());
  const raw = fs.readFileSync(fixture), physical = raw.toString('utf8');
  assert(Buffer.from(physical).equals(raw), 'Lossless actual fixture UTF-8 required');
  assert(physical === head || physical === head.replaceAll('\n', '\r\n'),
    'Whole actual fixture LF/CRLF bytes qualify before projection');
  const historical = ageRemovalHistoricalRecord(fixture, { head: { mode: actual[1], blob: actual[2] }, index: actualIndex,
    committed: Buffer.from(head), physical: raw, regular: stat.isFile(), symbolic: stat.isSymbolicLink() });
  assert.deepEqual({ mode: historical.head.mode, blob: historical.head.blob, sha256: sha(historical.committed), bytes: historical.committed.length },
    SITE_BASICS_SOURCE.files[fixture].current, 'Independently admitted current fixture reconstructs its unchanged site pin');
  function fixtureComparison(file, input, tree, index) {
    assert.equal(arguments.length, 4, 'Only the closed fixture byte/tree/index comparison is accepted');
    assert.equal(file, fixture, 'Only the exact Genesis historical fixture comparison');
    assert(Buffer.isBuffer(input), 'Complete physical fixture Buffer required');
    const actualTree = typeof tree === 'string' && tree.match(/^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/);
    assert(actualTree && actualTree[0] === tree && actualTree[3] === file, 'Complete current fixture tree identity required');
    const historical = ageRemovalHistoricalRecord(file, { head: { mode: actualTree[1], blob: actualTree[2] }, index,
      committed: Buffer.from(lf(input.toString('utf8'))), physical: input, regular: stat.isFile(), symbolic: stat.isSymbolicLink() });
    tree = historical.head.mode + ' blob ' + historical.head.blob + '\t' + file;
    index = historical.index;
    const currentPin = SITE_BASICS_SOURCE.files[file].current;
    assert.equal(tree, currentPin.mode + ' blob ' + currentPin.blob + '\t' + file, 'Only the exact current site tree is admitted');
    assert.equal(index, currentPin.mode + ' ' + currentPin.blob + ' 0\t' + file, 'Only the exact current site index is admitted');
    const siteProof = qualifySiteBasicsSource(file, historical.committed);
    assert.deepEqual([siteProof.sourceOnly, siteProof.runtime, siteProof.native, siteProof.financial, siteProof.activation,
      siteProof.deployment, siteProof.priorResultsTransferred], [true, false, false, false, false, false, false]);
    const siteText = siteProof.baselineText;
    assert.deepEqual({ mode: SITE_BASICS_SOURCE.files[file].baseline.mode, blob: gitBlob(siteText), sha256: sha(siteText), bytes: Buffer.byteLength(siteText) },
      QUESTING_SOURCE.files[file].current, 'The exact site predecessor remains the unchanged complete questing pin');
    const proof = qualifyQuestingSource(file, Buffer.from(siteText));
    assert.deepEqual([proof.sourceOnly, proof.runtime, proof.native, proof.financial, proof.activation,
      proof.deployment, proof.priorResultsTransferred], [true, false, false, false, false, false, false]);
    const source = questingHistoricalInput(file, Buffer.from(siteText)), text = source.toString('utf8');
    assert(Buffer.isBuffer(source) && Buffer.from(text).equals(source));
    assert.equal(text, proof.baselineText);
    const comparisonTree = questingHistoricalEntry(file, tree, 'tree');
    const comparisonIndex = questingHistoricalEntry(file, index, 'index');
    const pin = { file, mode: QUESTING_SOURCE.files[file].baseline.mode, blob: gitBlob(text), sha256: sha(text),
      bytes: Buffer.byteLength(text), rawSha256: { lf: sha(text), crlf: sha(text.replaceAll('\n', '\r\n')) } };
    assert.equal(comparisonTree, pin.mode + ' blob ' + pin.blob + '\t' + file);
    assert.equal(comparisonIndex, pin.mode + ' ' + pin.blob + ' 0\t' + file);
    return Object.freeze({ source, pin, proof, siteProof });
  }
  const comparison = fixtureComparison(fixture, raw, actualEntry, actualIndex);
  assert.equal(CONTRACT_RELEASE_SOURCE_DATA.status, 'BOUND');
  const rootView = CONTRACT_RELEASE_SOURCE_DATA.sourceViews[fixture];
  assert(rootView?.targets.fee, 'An explicit Root D70 fixture comparison target is required');
  assert.deepEqual(rootView.current, comparison.pin,
    'The exact questing predecessor comparison retains the frozen Root source identity');
  const target = rootView.targets.fee;
  assert.equal(target.revision, CONTRACT_RELEASE_SOURCE_DATA.reviewedContractRevision);
  assert.equal(target.revision, 'd70c17d2cd9eb613e8695caf8c6dfc0b60a64a9e');
  assert.deepEqual(target.pin, { file: fixture, mode: binding.mode, blob: binding.currentBlob,
    sha256: binding.currentSha256, bytes: binding.currentBytes });
  const frozen = git('show', target.revision + ':' + fixture);
  assert.equal(git('ls-tree', target.revision, '--', fixture).trim(),
    binding.mode + ' blob ' + binding.currentBlob + '\t' + fixture);
  assert.equal(sha(frozen), binding.currentSha256); assert.equal(gitBlob(frozen), binding.currentBlob);
  assert.equal(Buffer.byteLength(frozen), binding.currentBytes);
  const projected = contractReleaseFeeInput(fixture, comparison.source);
  assert(Buffer.isBuffer(projected), 'The comparison-only view preserves Buffer type');
  const projectedText = projected.toString('utf8');
  assert(Buffer.from(projectedText).equals(projected), 'Lossless frozen fixture comparison source');
  assert(projectedText === frozen || projectedText === frozen.replaceAll('\n', '\r\n'),
    'The complete frozen fixture frame follows actual source admission and exact Root comparison');
  const text = lf(projectedText);
  const previous = git('show', `${binding.baselineRevision}:${fixture}`);
  assert.equal(binding.baselineRevision, '009ba651c4b7746351ee3522e3bb9552514bfcb6');
  assert.equal(git('rev-parse', `${binding.baselineRevision}^{tree}`).trim(), binding.baselineTree);
  git('merge-base', '--is-ancestor', binding.baselineRevision, 'HEAD');
  assert.equal(sha(JSON.stringify(binding)), GENESIS_HISTORICAL_READER_BINDING_SHA256);
  assert.equal(sha(text), binding.currentSha256); assert.equal(gitBlob(text), binding.currentBlob);
  assert.equal(sha(previous), binding.baselineSha256); assert.equal(gitBlob(previous), binding.baselineBlob);
  assert.deepEqual(binding.inverses, parseHunks(git('diff', '--no-ext-diff', '--unified=3', binding.baselineBlob, binding.currentBlob)));
  assert.equal(binding.inverses.length, 3);
  assert.equal(WORLD_RECOVERY_REVIEW.sourceFiles['public/genesis-deploy-client.js'], '3c8e2e19ddab7df96c77bb332bda35161e1be242913481b6504539f183d1d2ad');
  let readerPositive = 0, readerNegative = 0;
  for (const supplied of [text, text.replaceAll('\n', '\r\n'), Buffer.from(text), Buffer.from(text.replaceAll('\n', '\r\n'))]) {
    const proof = assertGenesisHistoricalReaderSourceTransfer(fixture, supplied);
    assert.equal(proof.baselineText, previous); assert.equal(proof.sourceOnly, true);
    assert.equal(proof.runtime, false); assert.equal(proof.native, false);
    const projected = genesisHistoricalReaderHistoricalInput(fixture, supplied);
    assert.equal(Buffer.isBuffer(projected), Buffer.isBuffer(supplied));
    assert.equal(String(projected), previous);
    assert.equal(economyHardeningSourceBaseline(fixture, String(supplied)), economyHardeningSourceBaseline(fixture, previous),
      'Every unchanged outer historical guard must still inspect the complete frozen fixture body');
    readerPositive++;
  }
  assert.equal(genesisHistoricalReaderHistoricalInput(fixture, previous), previous); readerPositive++;
  assert.throws(() => assertGenesisHistoricalReaderSourceTransfer(fixture, previous)); readerNegative++;
  const changed = [text + '\n// future unrelated source edit\n', text.slice(1), '\ufeff' + text, text + '\0',
    text.replace('\n', '\r\n'), text.replace('\n', '\r'),
    text.replace('fs.readFileSync = fixtureRead', 'fs.readFileSync = originalRead'),
    text.replace("if (file === 'public/genesis-deploy-client.js')", "if (file.startsWith('public/'))")];
  for (const inverse of binding.inverses) changed.push(text.replace(inverse.current, ''), text + inverse.current,
    text.replace(inverse.current, () => inverse.baseline));
  for (const supplied of changed) {
    assert.notEqual(supplied, text);
    assert.throws(() => assertGenesisHistoricalReaderSourceTransfer(fixture, supplied));
    assert.equal(genesisHistoricalReaderHistoricalInput(fixture, supplied), supplied, 'Changed reader source must reach the original rejecting guards');
    readerNegative++;
  }
  for (const unrelated of ['public/genesis-deploy-client.js', 'test/lib/other.js', './' + fixture, 'test/lib/../lib/rc1-historical-source-fixture.js']) {
    assert.throws(() => assertGenesisHistoricalReaderSourceTransfer(unrelated, text));
    assert.equal(genesisHistoricalReaderHistoricalInput(unrelated, text), text); readerNegative++;
  }
  for (const invalid of [null, undefined, 42, {}]) {
    assert.throws(() => assertGenesisHistoricalReaderSourceTransfer(fixture, invalid));
    assert.equal(genesisHistoricalReaderHistoricalInput(fixture, invalid), invalid); readerNegative++;
  }
  const invalidUtf8 = Buffer.from([0xff, 0xfe]);
  assert.throws(() => assertGenesisHistoricalReaderSourceTransfer(fixture, invalidUtf8));
  assert.throws(() => genesisHistoricalReaderHistoricalInput(fixture, invalidUtf8)); readerNegative++;
  assert.equal(readerPositive, 5); assert.equal(readerNegative, 27);
  console.log(`genesis historical reader: PASS three exact Git hunks, complete predecessor and outer-guard parity, ${readerPositive} positive and ${readerNegative} negative controls; source inspection only`);
  let currentPositives = 0, currentRefusals = 0;
  for (const supplied of [Buffer.from(head), Buffer.from(head.replaceAll('\n', '\r\n'))]) {
    const view = fixtureComparison(fixture, supplied, actualEntry, actualIndex);
    assert.deepEqual(view.pin, rootView.current);
    assert.equal(view.source.toString('utf8'), comparison.source.toString('utf8'));
    currentPositives++;
  }
  for (const supplied of [Buffer.from(head + '\n// unrelated fixture edit\n'), Buffer.from(head.slice(1)),
    Buffer.from('\ufeff' + head), Buffer.from(head + '\0'), Buffer.from(head.replace('\n', '\r\n')),
    Buffer.from(head.replace('\n', '\r')), Buffer.from(head.replace(/\S/, '?')), Buffer.from([255]),
    comparison.source, historical.committed, head, null]) {
    assert.throws(() => fixtureComparison(fixture, supplied, actualEntry, actualIndex)); currentRefusals++;
  }
  for (const kind of ['tree', 'index']) {
    const entry = kind === 'tree' ? actualEntry : actualIndex;
    for (const changed of [entry.replace(actual[2], '0'.repeat(40)), entry.replace(actual[1], '100755'),
      entry.replace(actual[1], '120000'), entry + '\n', entry.replace(fixture, 'test/lib/other.js'), ' ' + entry]) {
      assert.throws(() => fixtureComparison(fixture, raw, kind === 'tree' ? changed : actualEntry,
        kind === 'index' ? changed : actualIndex)); currentRefusals++;
    }
  }
  for (const file of ['src/server.js', './' + fixture, 'test/lib/../lib/rc1-historical-source-fixture.js', '__proto__']) {
    assert.throws(() => fixtureComparison(file, raw, actualEntry, actualIndex)); currentRefusals++;
  }
  assert.throws(() => fixtureComparison(fixture, raw, actualEntry)); currentRefusals++;
  assert.throws(() => fixtureComparison(fixture, raw, actualEntry, actualIndex, {})); currentRefusals++;
  assert.throws(() => { comparison.proof.native = true; }, TypeError); currentRefusals++;
  assert.equal(currentPositives, 2); assert.equal(currentRefusals, 31);
  let siteRefusals = 0;
  const questCurrent = QUESTING_SOURCE.files[fixture].current;
  const oldTree = questCurrent.mode + ' blob ' + questCurrent.blob + '\t' + fixture;
  const oldIndex = questCurrent.mode + ' ' + questCurrent.blob + ' 0\t' + fixture;
  const oldInput = Buffer.from(comparison.siteProof.baselineText);
  for (const [input, tree, index] of [
    [oldInput, oldTree, oldIndex], [oldInput, actualEntry, actualIndex],
    [raw, oldTree, actualIndex], [raw, actualEntry, oldIndex], [raw, oldTree, oldIndex],
    [comparison.source, comparison.pin.mode + ' blob ' + comparison.pin.blob + '\t' + fixture,
      comparison.pin.mode + ' ' + comparison.pin.blob + ' 0\t' + fixture],
  ]) { assert.throws(() => fixtureComparison(fixture, input, tree, index)); siteRefusals++; }
  // Internally consistent forged records must not turn unknown bytes into admitted current source.
  for (const changed of [head + '\n// unreviewed current fixture\n', head.replace(/\S/, '?')]) {
    assert.notEqual(changed, head); const changedBlob = gitBlob(changed);
    assert.throws(() => fixtureComparison(fixture, Buffer.from(changed), actual[1] + ' blob ' + changedBlob + '\t' + fixture,
      actual[1] + ' ' + changedBlob + ' 0\t' + fixture)); siteRefusals++;
  }
  assert.throws(() => { comparison.siteProof.native = true; }, TypeError); siteRefusals++;
  assert.equal(siteRefusals, 9);
  console.log(JSON.stringify({ phase: 'GENESIS_QUESTING_FIXTURE_COMPARISON_CONTROLS', currentPositives,
    currentRefusals, siteRefusals, sourceOnly: true, runtime: false, native: false, projectedSourceExecuted: false }));
}
