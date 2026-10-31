import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
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
const current = lf(fs.readFileSync(file, 'utf8'));
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
  const text = lf(fs.readFileSync(path, 'utf8'));
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
    ? commerceOverCurrentEnterpriseSourceBaseline(file, fs.readFileSync(file, 'utf8'))
    : continuousCityHistoricalInput(file, fs.readFileSync(file, 'utf8'))))
  : continuousCityHistoricalInput(file, fs.readFileSync(file, 'utf8'));
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
