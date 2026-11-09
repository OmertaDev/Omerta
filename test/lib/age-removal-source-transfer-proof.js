// Whole current source qualifies before the immutable historical comparison is reconstructed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { AGE_REMOVAL_SOURCE as source, ageRemovalSourceDataBytes, qualifyAgeRemovalSource,
  ageRemovalHistoricalInput, ageRemovalHistoricalEntry, ageRemovalHistoricalRecord } from '../../tools/age-removal-source-transfer.js';

const predecessor = '35913ec1b448275b227019ede2a2ef8047be55aa';
const metadata = 'tools/age-removal-source-data.js';
// These closed generated domains retain their independent mandatory checks and
// obtain no historical source comparison from this proof.
const generated = new Set([metadata, 'tools/enterprise-native-questing-inputs.js',
  'knowledge/generated/documents.md', 'knowledge/generated/github-history.md',
  'knowledge/generated/graph-summary.md', 'knowledge/generated/graph.json',
  'knowledge/generated/graph.mmd', 'knowledge/generated/inventory.md',
  'knowledge/generated/modules.md', 'knowledge/generated/routes.md',
  'docs/questing-workgraph.json',
  'docs/quest-quality-workgraph.json',
  'output/quest-quality-verification/quality-mw8vf9xg-quest-quality-content.log',
  'output/quest-quality-verification/quality-mw8vfgz6-quest-quality-rules.log',
  'output/quest-quality-verification/quality-mw8vfhcd-quest-quality-studio.log',
  'output/quest-quality-verification/quality-mw8vfif6-quest-quality-runtime.log',
  'output/quest-quality-verification/quality-mw8vfmcd-quest-quality-api.log',
  'output/quest-quality-verification/quality-mw8vfpu0-quest-quality-browser.log',
  'output/quest-quality-verification/quality-mw8vg4l8-quest-quality-postgres.log',
  'output/quest-quality-verification/quality-mw8vgahb-quest-quality-stateful.log',
  'output/quest-quality-verification/quality-mw8vgb95-quest-quality-social.log',
  'output/quest-quality-verification/quality-mw8vgevf-quest-quality-spoilers.log',
  'output/quest-quality-verification/quality-mw8vghub-quest-quality-study.log',
  'output/questing-verification/quest-mw8vef9e-quest-saga.log',
  'output/questing-verification/quest-mw8veko0-content-narrative-security.log',
  'output/questing-verification/quest-mw8velju-quest-specialist.log',
  'output/questing-verification/quest-mw8veqlj-clue-puzzles.log',
  'output/questing-verification/quest-mw8veuzj-clue-puzzles-browser.log',
  'output/questing-verification/quest-mw8vf1am-content-narrative.log',
  'output/questing-verification/quest-mw8vf4r5-quest-experience-browser.log',
  'output/questing-verification/quest-mw8vfj0s-content-api.log',
  'output/questing-verification/quest-mw8vfk8n-quest-saga-social.log',
  'output/questing-verification/quest-mw8vfoh3-content-casework.log',
  'output/questing-verification/quest-mw8vfry3-quest-workshop.log',
  // Retained UI evidence is historical only; combined execution is verified afresh.
  "output/quest-quality-verification/quality-mw8t5267-quest-quality-content.log",
  "output/quest-quality-verification/quality-mw8t59jg-quest-quality-rules.log",
  "output/quest-quality-verification/quality-mw8t59yz-quest-quality-studio.log",
  "output/quest-quality-verification/quality-mw8t5b1g-quest-quality-runtime.log",
  "output/quest-quality-verification/quality-mw8t5ewy-quest-quality-api.log",
  "output/quest-quality-verification/quality-mw8t5i9u-quest-quality-browser.log",
  "output/quest-quality-verification/quality-mw8t5xh4-quest-quality-postgres.log",
  "output/quest-quality-verification/quality-mw8t63je-quest-quality-stateful.log",
  "output/quest-quality-verification/quality-mw8t64dc-quest-quality-social.log",
  "output/quest-quality-verification/quality-mw8t68am-quest-quality-spoilers.log",
  "output/quest-quality-verification/quality-mw8t6bdw-quest-quality-study.log",
  "output/questing-verification/quest-mw8t3sas-quest-saga.log",
  "output/questing-verification/quest-mw8t3y65-content-narrative-security.log",
  "output/questing-verification/quest-mw8t3z9b-quest-specialist.log",
  "output/questing-verification/quest-mw8t44wz-clue-puzzles.log",
  "output/questing-verification/quest-mw8t49lu-clue-puzzles-browser.log",
  "output/questing-verification/quest-mw8t4gez-content-narrative.log",
  "output/questing-verification/quest-mw8t4k51-quest-experience-browser.log",
  "output/questing-verification/quest-mw8t4yze-content-api.log",
  "output/questing-verification/quest-mw8t507p-quest-saga-social.log",
  "output/questing-verification/quest-mw8t54fa-content-casework.log",
  "output/questing-verification/quest-mw8t587k-quest-workshop.log",
  // Fresh combined-source executions; results remain independently verified.
  "output/questing-verification/quest-mw94kkne-quest-saga.log",
  "output/questing-verification/quest-mw94kqf9-content-narrative-security.log",
  "output/questing-verification/quest-mw94kre8-quest-specialist.log",
  "output/questing-verification/quest-mw94kx86-clue-puzzles.log",
  "output/questing-verification/quest-mw94l2gh-clue-puzzles-browser.log",
  "output/questing-verification/quest-mw94l9yw-content-narrative.log",
  "output/questing-verification/quest-mw94ldtx-quest-experience-browser.log",
  "output/questing-verification/quest-mw94lul9-content-api.log",
  "output/questing-verification/quest-mw94lw0f-quest-saga-social.log",
  "output/questing-verification/quest-mw94m13d-content-casework.log",
  "output/questing-verification/quest-mw94m4xu-quest-workshop.log",
  "output/quest-quality-verification/quality-mw94kwb4-quest-quality-content.log",
  "output/quest-quality-verification/quality-mw94l3nq-quest-quality-rules.log",
  "output/quest-quality-verification/quality-mw94l42g-quest-quality-studio.log",
  "output/quest-quality-verification/quality-mw94l51q-quest-quality-runtime.log",
  "output/quest-quality-verification/quality-mw94l9co-quest-quality-api.log",
  "output/quest-quality-verification/quality-mw94lcx8-quest-quality-browser.log",
  "output/quest-quality-verification/quality-mw94luls-quest-quality-postgres.log",
  "output/quest-quality-verification/quality-mw94m217-quest-quality-stateful.log",
  "output/quest-quality-verification/quality-mw94m33l-quest-quality-social.log",
  "output/quest-quality-verification/quality-mw94m79t-quest-quality-spoilers.log",
  "output/quest-quality-verification/quality-mw94mag6-quest-quality-study.log",
  // Re-executed after the quest disclosure race repair; no inherited runtime results.
  "output/questing-verification/quest-mw95fvn8-quest-saga.log",
  "output/questing-verification/quest-mw95g1vy-content-narrative-security.log",
  "output/questing-verification/quest-mw95g2ym-quest-specialist.log",
  "output/questing-verification/quest-mw95g8gp-clue-puzzles.log",
  "output/questing-verification/quest-mw95gd8w-clue-puzzles-browser.log",
  "output/questing-verification/quest-mw95gkbe-content-narrative.log",
  "output/questing-verification/quest-mw95go95-quest-experience-browser.log",
  "output/questing-verification/quest-mw95h4c7-content-api.log",
  "output/questing-verification/quest-mw95h5mq-quest-saga-social.log",
  "output/questing-verification/quest-mw95h9vw-content-casework.log",
  "output/questing-verification/quest-mw95hdcd-quest-workshop.log",
  "output/quest-quality-verification/quality-mw95fwdp-quest-quality-content.log",
  "output/quest-quality-verification/quality-mw95g3m2-quest-quality-rules.log",
  "output/quest-quality-verification/quality-mw95g3zd-quest-quality-studio.log",
  "output/quest-quality-verification/quality-mw95g4wk-quest-quality-runtime.log",
  "output/quest-quality-verification/quality-mw95g8q0-quest-quality-api.log",
  "output/quest-quality-verification/quality-mw95gc3d-quest-quality-browser.log",
  "output/quest-quality-verification/quality-mw95grhg-quest-quality-postgres.log",
  "output/quest-quality-verification/quality-mw95gyfv-quest-quality-stateful.log",
  "output/quest-quality-verification/quality-mw95gzjg-quest-quality-social.log",
  "output/quest-quality-verification/quality-mw95h410-quest-quality-spoilers.log",
  "output/quest-quality-verification/quality-mw95h79m-quest-quality-study.log",
]);
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], {
  encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024,
});
const sha = input => createHash('sha256').update(input).digest('hex');
const blob = input => createHash('sha1').update('blob ' + Buffer.byteLength(input) + '\0').update(input).digest('hex');
assert.equal(source.status, 'SEALED'); assert.equal(source.predecessor, predecessor);
assert.equal(source.phase, 'EXACT_AGE_REMOVAL_SOURCE_COMPARISON_ONLY');
for (const [revision, tree] of [[source.revision, source.tree], [source.predecessor, source.predecessorTree]])
  assert.equal(git('rev-parse', revision + '^{tree}').trim(), tree);
git('merge-base', '--is-ancestor', predecessor, source.revision);
git('merge-base', '--is-ancestor', source.revision, 'HEAD');
const changed = status => git('diff', '--name-only', '--no-renames', '--diff-filter=' + status,
  '-z', predecessor, source.revision).split('\0').filter(file => file && !generated.has(file));
assert.deepEqual(Object.keys(source.files), changed('M'), 'Every reviewed modification is independently pinned');
assert.deepEqual(Object.keys(source.additions), changed('A'), 'Every new helper is independently pinned');
assert.deepEqual(changed('DRTCUXB'), [], 'No historical file deletion or type replacement');
assert.equal(fs.readFileSync(metadata, 'utf8').replaceAll('\r\n', '\n'), ageRemovalSourceDataBytes(source),
  'The only self-reference is exact generated data');
for (const file of generated) assert(!Object.hasOwn(source.files, file) && !Object.hasOwn(source.additions, file),
  'Generated metadata cannot inherit a historical source proof');
function actual(file, pin) {
  const committed = Buffer.from(git('show', 'HEAD:' + file));
  const authored = Buffer.from(git('show', source.revision + ':' + file));
  const stat = fs.lstatSync(file), physical = fs.readFileSync(file);
  const headEntry = git('ls-tree', 'HEAD', '--', file).trim();
  const index = git('ls-files', '--stage', '--', file).trim();
  assert(headEntry === `${pin.mode} blob ${pin.blob}\t${file}` && index === `${pin.mode} ${pin.blob} 0\t${file}`,
    'Complete current HEAD and stage-zero identities: ' + file);
  assert(committed.equals(authored), 'Actual source remains the exact reviewed authored source: ' + file);
  assert.equal(sha(committed), pin.sha256); assert.equal(blob(committed), pin.blob); assert.equal(committed.length, pin.bytes);
  assert(stat.isFile() && !stat.isSymbolicLink());
  assert(physical.equals(committed) || physical.equals(Buffer.from(committed.toString('utf8').replaceAll('\n', '\r\n'))),
    'Whole actual physical source remains uniform LF or CRLF: ' + file);
  return { head: { mode: pin.mode, blob: pin.blob }, index, committed, physical,
    regular: stat.isFile(), symbolic: stat.isSymbolicLink() };
}
let positives = 0, refusals = 0;
for (const [file, row] of Object.entries(source.files)) {
  const current = actual(file, row.current), text = current.committed.toString('utf8');
  const baseline = git('show', predecessor + ':' + file);
  assert.equal(sha(baseline), row.baseline.sha256); assert.equal(blob(baseline), row.baseline.blob);
  assert.equal(Buffer.byteLength(baseline), row.baseline.bytes);
  for (const input of [text, text.replaceAll('\n', '\r\n'), Buffer.from(text), current.physical]) {
    const proof = qualifyAgeRemovalSource(file, input);
    assert.equal(proof.baselineText, baseline);
    assert.deepEqual([proof.sourceOnly, proof.runtime, proof.native, proof.migration, proof.financial,
      proof.activation, proof.deployment, proof.priorResultsTransferred], [true, false, false, false, false, false, false, false]);
    assert.equal(String(ageRemovalHistoricalInput(file, input)), baseline);
    assert.equal(Buffer.isBuffer(ageRemovalHistoricalInput(file, input)), Buffer.isBuffer(input)); positives++;
  }
  const historical = ageRemovalHistoricalRecord(file, current);
  assert.equal(historical.committed.toString('utf8'), baseline);
  assert.deepEqual(historical.head, { mode: row.baseline.mode, blob: row.baseline.blob }); positives++;
  for (const kind of ['tree', 'index']) {
    const format = pin => kind === 'tree' ? `${pin.mode} blob ${pin.blob}\t${file}` : `${pin.mode} ${pin.blob} 0\t${file}`;
    for (const suffix of ['', '\n']) assert.equal(ageRemovalHistoricalEntry(file, format(row.current) + suffix, kind), format(row.baseline) + suffix);
    for (const changed of [' ' + format(row.current), format(row.current) + '\n\n', format(row.current).replace(row.current.blob, '0'.repeat(40))])
      assert.equal(ageRemovalHistoricalEntry(file, changed, kind), changed);
  }
  for (const changed of [text + '\n// unreviewed change\n', text.slice(1), '\ufeff' + text, text + '\0',
    text.replace('\n', '\r\n'), text.replace('\n', '\r'), null]) {
    assert.throws(() => qualifyAgeRemovalSource(file, changed));
    assert.strictEqual(ageRemovalHistoricalInput(file, changed), changed); refusals++;
  }
  for (const patch of [{ index: current.index.replace(row.current.blob, '0'.repeat(40)) },
    { head: { ...current.head, mode: '120000' } }, { regular: false }, { symbolic: true },
    { physical: Buffer.concat([current.physical, Buffer.from('x')]) }, { committed: Buffer.from(baseline) }]) {
    assert.throws(() => ageRemovalHistoricalRecord(file, { ...current, ...patch })); refusals++;
  }
  for (const inverse of row.inverses) {
    const changed = text.slice(0, inverse.at) + inverse.baseline + text.slice(inverse.at + inverse.current.length);
    assert.throws(() => qualifyAgeRemovalSource(file, changed));
    assert.equal(ageRemovalHistoricalInput(file, changed), changed); refusals++;
  }
  const invalidUtf8 = Buffer.from([0xff]);
  for (const reader of [qualifyAgeRemovalSource, ageRemovalHistoricalInput]) {
    assert.throws(() => reader(file, invalidUtf8), error => error.code === 'ERR_ASSERTION'
      && /Lossless UTF-8/.test(error.message) && /lossless UTF-8/.test(error.message)); refusals++;
  }
}
for (const [file, pin] of Object.entries(source.additions)) {
  const current = actual(file, pin);
  assert.equal(git('ls-tree', predecessor, '--', file).trim(), '');
  assert.throws(() => qualifyAgeRemovalSource(file, current.committed));
  assert.strictEqual(ageRemovalHistoricalInput(file, current.committed), current.committed); positives++;
}
for (const file of ['__proto__', 'constructor', 'src/unknown.js']) {
  const input = Buffer.from([0xff]); assert.strictEqual(ageRemovalHistoricalInput(file, input), input);
  assert.throws(() => qualifyAgeRemovalSource(file, 'unknown source')); refusals++;
}
assert.throws(() => git('grep', '-n', 'age-removal-source-', '--', 'src'), error => error.status === 1,
  'Actual runtime does not load historical age-removal views');
console.log(JSON.stringify({ phase: source.phase, authoredRevision: source.revision, positives, refusals,
  sourceOnly: true, runtime: false, native: false, deployment: false, priorResultsTransferred: false }));
