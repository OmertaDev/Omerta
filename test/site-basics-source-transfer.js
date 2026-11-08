// Actual website Git/index/physical identities qualify before any historical comparison.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { questQualityHistoricalInput, questQualityHistoricalEntry } from '../tools/quest-quality-source-transfer.js';
import { SITE_BASICS_SOURCE as source, qualifySiteBasicsSource,
  siteBasicsHistoricalInput, siteBasicsHistoricalEntry, siteBasicsSourceDataBytes } from '../tools/site-basics-source-transfer.js';

const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], {
  encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024,
});
const sha = input => createHash('sha256').update(input).digest('hex');
assert.equal(source.status, 'SEALED');
assert.equal(source.phase, 'EXACT_SITE_BASICS_SOURCE_COMPARISON_ONLY');
assert.equal(source.predecessor, 'd763d0623b69aa223eab9fae01beb7aec6cdce75');
for (const [revision, tree] of [[source.revision, source.tree], [source.predecessor, source.predecessorTree]])
  assert.equal(git('rev-parse', revision + '^{tree}').trim(), tree);
git('merge-base', '--is-ancestor', source.predecessor, source.revision);
git('merge-base', '--is-ancestor', source.revision, 'HEAD');
const scope = file => file === 'SPEC.md' || file === 'MARKETING-POSTS.md' || file === 'package.json' || file === 'schema.sql'
  || file === '.github/workflows/ci.yml' || /^(?:src|test|tools|public)\//.test(file);
const excluded = new Set(['tools/site-basics-source-data.js', 'tools/enterprise-native-questing-inputs.js']);
const changed = kind => git('diff', '--name-only', '--diff-filter=' + kind, '-z', source.predecessor, source.revision)
  .split('\0').filter(file => scope(file) && !excluded.has(file));
assert.deepEqual(Object.keys(source.files), changed('M'), 'Every modified website comparison domain is independently pinned');
assert.deepEqual(Object.keys(source.additions), changed('A').filter(file => /\.(?:js|json|html|css|sql)$/.test(file)),
  'All new text inputs are admitted as actual additions without historical qualification');
assert.equal(fs.readFileSync(new URL('../tools/site-basics-source-data.js', import.meta.url), 'utf8').replaceAll('\r\n', '\n'),
  siteBasicsSourceDataBytes(source), 'The only self-reference is complete generated data without executable additions');
let positives = 0, refusals = 0;
function actual(file, pin) {
  const committed = git('show', 'HEAD:' + file), authored = git('show', source.revision + ':' + file);
  const stat = fs.lstatSync(file), physical = fs.readFileSync(file);
  assert(stat.isFile() && !stat.isSymbolicLink());
  assert(physical.equals(Buffer.from(committed)) || physical.equals(Buffer.from(committed.replaceAll('\n', '\r\n'))),
    'Actual whole committed and physical source qualify before historical comparison: ' + file);
  const actualBlob = createHash('sha1').update('blob ' + Buffer.byteLength(committed) + '\0').update(committed).digest('hex');
  assert.equal(git('ls-tree', 'HEAD', '--', file).trim(), pin.mode + ' blob ' + actualBlob + '\t' + file);
  assert.equal(git('ls-files', '--stage', '--', file).trim(), pin.mode + ' ' + actualBlob + ' 0\t' + file);
  const text = questQualityHistoricalInput(file, committed), raw = questQualityHistoricalInput(file, physical);
  assert.equal(text, authored, 'Whole authored source remains the actual committed source: ' + file);
  assert.equal(sha(text), pin.sha256); assert.equal(Buffer.byteLength(text), pin.bytes);
  const entry = pin.mode + ' blob ' + pin.blob + '\t' + file;
  assert.equal(questQualityHistoricalEntry(file, git('ls-tree', 'HEAD', '--', file).trim(), 'tree'), entry);
  assert.equal(questQualityHistoricalEntry(file, git('ls-files', '--stage', '--', file).trim(), 'index'), pin.mode + ' ' + pin.blob + ' 0\t' + file);
  assert(raw.equals(Buffer.from(text)) || raw.equals(Buffer.from(text.replaceAll('\n', '\r\n'))),
    'Complete physical UTF-8 source is uniformly LF/CRLF: ' + file);
  return { text, raw, entry };
}
for (const [file, row] of Object.entries(source.files)) {
  const { text, raw, entry } = actual(file, row.current);
  const baseline = git('show', source.predecessor + ':' + file);
  assert.equal(sha(baseline), row.baseline.sha256);
  for (const input of [text, text.replaceAll('\n', '\r\n'), Buffer.from(text), raw]) {
    const proof = qualifySiteBasicsSource(file, input);
    assert.equal(proof.baselineText, baseline);
    assert.deepEqual([proof.sourceOnly, proof.runtime, proof.native, proof.financial, proof.activation,
      proof.deployment, proof.priorResultsTransferred], [true, false, false, false, false, false, false]);
    assert.equal(String(siteBasicsHistoricalInput(file, input)), baseline);
    assert.equal(Buffer.isBuffer(siteBasicsHistoricalInput(file, input)), Buffer.isBuffer(input)); positives++;
  }
  assert.equal(siteBasicsHistoricalEntry(file, entry, 'tree'), row.baseline.mode + ' blob ' + row.baseline.blob + '\t' + file);
  for (const input of [text + '\n// arbitrary edit\n', text.slice(1), '\ufeff' + text, text + '\0',
    text.replace(/\S/, '?'), text.replace('\n', '\r\n'), text.replace('\n', '\r'), null]) {
    assert.throws(() => qualifySiteBasicsSource(file, input));
    assert.strictEqual(siteBasicsHistoricalInput(file, input), input); refusals++;
  }
  for (const inverse of row.inverses) {
    const modified = text.slice(0, inverse.at) + inverse.baseline + text.slice(inverse.at + inverse.current.length);
    assert.throws(() => qualifySiteBasicsSource(file, modified)); refusals++;
  }
}
for (const [file, pin] of Object.entries(source.additions)) {
  const { raw } = actual(file, pin);
  assert.equal(git('ls-tree', source.predecessor, '--', file).trim(), '', 'A new file has no historical admission');
  assert.throws(() => qualifySiteBasicsSource(file, raw));
  assert.strictEqual(siteBasicsHistoricalInput(file, raw), raw); refusals++;
}
for (const file of ['../src/server.js', 'src\\server.js', '__proto__', 'constructor', 'src/unapproved.js']) {
  const raw = 'unapproved source\n'; assert.throws(() => qualifySiteBasicsSource(file, raw));
  assert.strictEqual(siteBasicsHistoricalInput(file, raw), raw); refusals++;
}
assert.throws(() => git('grep', '-n', 'site-basics-source-transfer', '--', 'src'), error => error.status === 1);
console.log(JSON.stringify({ phase: source.phase, authoredRevision: source.revision, positives, refusals,
  sourceOnly: true, runtime: false, native: false, financial: false, deployment: false, priorResultsTransferred: false }));
