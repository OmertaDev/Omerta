// Whole actual Git/index/physical source admission precedes a source-only comparison.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { QUEST_QUALITY_SOURCE as source, qualifyQuestQualitySource,
  questQualityHistoricalInput, questQualityHistoricalEntry, questQualitySourceDataBytes } from '../tools/quest-quality-source-transfer.js';
import { ageRemovalHistoricalRecord } from '../tools/age-removal-source-transfer.js';

const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
const sha = text => createHash('sha256').update(text).digest('hex');
const blob = text => createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
assert.equal(source.status, 'SEALED'); assert.equal(source.phase, 'EXACT_QUEST_QUALITY_SOURCE_COMPARISON_ONLY');
assert.equal(source.predecessor, '8720db9cb45f973a70a30b45dccc4c20f15012f2');
for (const [revision, tree] of [[source.revision, source.tree], [source.predecessor, source.predecessorTree]]) assert.equal(git('rev-parse', revision + '^{tree}').trim(), tree);
git('merge-base', '--is-ancestor', source.predecessor, source.revision); git('merge-base', '--is-ancestor', source.revision, 'HEAD');
const scope = file => file === 'SPEC.md' || file === 'MARKETING-POSTS.md' || file === 'package.json' || file === 'schema.sql'
  || /^\.github\/workflows\/[^/]+\.ya?ml$/.test(file) || /^(?:src|test|tools|public|content\/packs)\//.test(file);
// SITE independently seals the combined postimage after this data; native admission binds both.
const excluded = new Set(['tools/quest-quality-source-data.js', 'tools/site-basics-source-data.js', 'tools/enterprise-native-questing-inputs.js']);
const changed = kind => git('diff', '--name-only', '--diff-filter=' + kind, '-z', source.predecessor, source.revision).split('\0').filter(file => scope(file) && !excluded.has(file));
assert.deepEqual(Object.keys(source.files), changed('M'));
assert.deepEqual(Object.keys(source.additions), changed('A').filter(file => /\.(?:js|json|html|css|sql)$/.test(file)));
assert.equal(fs.readFileSync(new URL('../tools/quest-quality-source-data.js', import.meta.url), 'utf8').replaceAll('\r\n', '\n'), questQualitySourceDataBytes(source));
function actual(file, pin) {
  const committed = git('show', 'HEAD:' + file), authored = git('show', source.revision + ':' + file);
  const stat = fs.lstatSync(file), physical = fs.readFileSync(file); assert(stat.isFile() && !stat.isSymbolicLink());
  const actualEntry = git('ls-tree', 'HEAD', '--', file).trim();
  const match = actualEntry.match(/^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/);
  assert(match && match[3] === file, 'Actual regular Git source qualifies first');
  assert.equal(blob(committed), match[2], 'Complete actual source bytes equal the raw HEAD blob');
  const index = git('ls-files', '--stage', '--', file).trim();
  assert.equal(index, match[1] + ' ' + match[2] + ' 0\t' + file);
  assert(physical.equals(Buffer.from(committed)) || physical.equals(Buffer.from(committed.replaceAll('\n', '\r\n'))));
  const historical = ageRemovalHistoricalRecord(file, { head: { mode: match[1], blob: match[2] }, index,
    committed: Buffer.from(committed), physical, regular: stat.isFile(), symbolic: stat.isSymbolicLink() });
  const text = historical.committed.toString('utf8'), raw = historical.physical;
  assert.equal(text, authored, 'Independently admitted current source reconstructs the unchanged quality source: ' + file);
  assert.equal(sha(text), pin.sha256); assert.equal(blob(text), pin.blob); assert.equal(Buffer.byteLength(text), pin.bytes);
  const entry = pin.mode + ' blob ' + pin.blob + '\t' + file;
  assert.deepEqual(historical.head, { mode: pin.mode, blob: pin.blob });
  assert.equal(historical.index, pin.mode + ' ' + pin.blob + ' 0\t' + file);
  return { text, raw, entry };
}
let positives = 0, refusals = 0, inverseControls = 0;
for (const [file, row] of Object.entries(source.files)) {
  const { text, raw, entry } = actual(file, row.current), baseline = git('show', source.predecessor + ':' + file);
  assert.equal(sha(baseline), row.baseline.sha256);
  for (const input of [text, text.replaceAll('\n', '\r\n'), Buffer.from(text), raw]) {
    const proof = qualifyQuestQualitySource(file, input);
    assert.equal(proof.baselineText, baseline);
    assert.deepEqual([proof.sourceOnly, proof.runtime, proof.native, proof.financial, proof.activation, proof.deployment, proof.priorResultsTransferred],
      [true, false, false, false, false, false, false]);
    assert.equal(String(questQualityHistoricalInput(file, input)), baseline);
    assert.equal(Buffer.isBuffer(questQualityHistoricalInput(file, input)), Buffer.isBuffer(input)); positives++;
  }
  assert.equal(questQualityHistoricalEntry(file, entry, 'tree'), row.baseline.mode + ' blob ' + row.baseline.blob + '\t' + file);
  for (const input of [text + '\n// arbitrary edit\n', text.slice(1), '\ufeff' + text, text + '\0', text.replace(/\S/, '?'),
    text.replace('\n', '\r\n'), text.replace('\n', '\r'), null]) {
    assert.throws(() => qualifyQuestQualitySource(file, input)); assert.strictEqual(questQualityHistoricalInput(file, input), input); refusals++;
  }
  for (const inverse of row.inverses) {
    const partial = text.slice(0, inverse.at) + inverse.baseline + text.slice(inverse.at + inverse.current.length);
    assert.throws(() => qualifyQuestQualitySource(file, partial)); inverseControls++;
  }
  assert.throws(() => qualifyQuestQualitySource(file, text, { native: true })); refusals++;
}
for (const [file, pin] of Object.entries(source.additions)) {
  const { raw } = actual(file, pin);
  assert.equal(git('ls-tree', source.predecessor, '--', file).trim(), '');
  assert.throws(() => qualifyQuestQualitySource(file, raw));
  assert.strictEqual(questQualityHistoricalInput(file, raw), raw); refusals++;
}
for (const file of ['../src/server.js', 'src\\server.js', '__proto__', 'constructor', 'src/unapproved.js']) {
  assert.throws(() => qualifyQuestQualitySource(file, 'unapproved source\n')); refusals++;
}
assert.throws(() => git('grep', '-n', 'quest-quality-source-transfer', '--', 'src'), error => error.status === 1);
console.log(JSON.stringify({ phase: source.phase, authoredRevision: source.revision, domains: Object.keys(source.files).length,
  actualAdditions: Object.keys(source.additions).length, positives, refusals, inverseControls,
  sourceOnly: true, nativeExecution: false, priorResultsTransferred: false }));
