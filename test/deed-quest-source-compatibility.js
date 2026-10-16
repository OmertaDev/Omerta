// New exact source evidence composes with historical guards; it never revises their pins.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { DEED_QUEST_SOURCE_PREDECESSOR, DEED_QUEST_SOURCE_PHASE, DEED_QUEST_SOURCE_DOMAINS,
  assertDeedQuestSourceTransfer, deedQuestSourceBaseline } from '../tools/deed-quest-source-transfer.js';
import { nextFiveSourceBaseline } from '../tools/next-five-source-compatibility.js';
import { fourthBatchMigrationSchema } from '../tools/rc1-fourth-batch-source-compatibility.js';
import { fifthBatchMigrationSchema } from '../tools/rc1-fifth-batch-source-compatibility.js';

const lf = text => text.replaceAll('\r\n', '\n');
const git = (...args) => lf(execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  stdio: ['ignore', 'pipe', 'pipe'] }));
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
assert.equal(DEED_QUEST_SOURCE_PREDECESSOR, '2c8eaacf104e8555d5140136b5ed19027ecd4766');
assert.equal(DEED_QUEST_SOURCE_PHASE, 'exact-source-transfer-only; no historical runtime, native, migration, financial, genesis or deployment clearance');
assert.deepEqual(Object.keys(DEED_QUEST_SOURCE_DOMAINS), ['package.json', 'schema.sql', 'src/agentgateway.js',
  'src/content/phase1.js', 'src/content/phase1-policy.js', 'src/content/city-quest-presentation.js', 'src/db.js', 'src/deeds.js', 'src/explore.js', 'tools/release-source-transfer.js',
  'test/gates.js', '.github/workflows/ci.yml']);
let hunks = 0, negatives = 0;
for (const [file, pin] of Object.entries(DEED_QUEST_SOURCE_DOMAINS)) {
  const raw = fs.readFileSync(file, 'utf8'), current = lf(raw);
  assert(raw === current || raw === current.replaceAll('\n', '\r\n'), 'Working candidate has uniform line endings');
  const predecessor = git('show', `${DEED_QUEST_SOURCE_PREDECESSOR}:${file}`);
  assert.equal(hash(current), pin.currentSha256);
  assert.equal(blob(current), pin.currentBlob);
  assert.equal(hash(predecessor), pin.baselineSha256);
  assert.equal(blob(predecessor), pin.baselineBlob);
  assert.equal(predecessor, git('cat-file', 'blob', pin.baselineBlob));
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses));
  const actual = []; let hunk = null;
  for (const line of git('diff', '--no-ext-diff', '--unified=3', DEED_QUEST_SOURCE_PREDECESSOR, '--', file).split('\n')) {
    if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; actual.push(hunk); }
    else if (hunk && /^[ +\-]/.test(line)) {
      if (line[0] !== '-') hunk.current += line.slice(1) + '\n';
      if (line[0] !== '+') hunk.baseline += line.slice(1) + '\n';
    }
  }
  assert.deepEqual(pin.inverses, actual, 'Only complete, actual Git inverse contexts are admitted');
  for (const input of [current, current.replaceAll('\n', '\r\n')]) {
    const proof = assertDeedQuestSourceTransfer(file, input);
    assert.equal(proof.baselineText, predecessor);
    assert.equal(proof.sourceOnly, true);
    assert.equal(proof.predecessorRevision, DEED_QUEST_SOURCE_PREDECESSOR);
    assert.equal(proof.phase, DEED_QUEST_SOURCE_PHASE);
    assert.equal(proof.inverseChunks, pin.inverses.length);
    assert.equal(deedQuestSourceBaseline(file, input), predecessor);
    assert.equal(nextFiveSourceBaseline(file, input), nextFiveSourceBaseline(file, predecessor),
      'The additive envelope retains the same historical source reconstruction');
  }
  const reject = input => {
    assert.notEqual(input, current);
    assert.throws(() => assertDeedQuestSourceTransfer(file, input));
    assert.equal(deedQuestSourceBaseline(file, input), input, 'Unknown bytes keep their original rejecting form');
    if (input !== predecessor)
      assert.equal(nextFiveSourceBaseline(file, input), input, 'No partial candidate receives historical source authority');
    negatives++;
  };
  for (const input of [current + '\n// unreviewed drift\n', current.slice(1), '\ufeff' + current,
    current.replace(/\S/, '?'), current.replace('\n', '\r\n')]) reject(input);
  for (const inverse of pin.inverses) {
    assert(Object.isFrozen(inverse));
    reject(current.replace(inverse.current, ''));
    reject(current.replace(inverse.current, () => inverse.current + inverse.current));
    reject(current.replace(inverse.current, () => inverse.baseline));
    reject(current.replace(inverse.current, () => inverse.current.replace(/\S/, '?')));
    const lines = inverse.current.trimEnd().split('\n');
    if (lines.length > 1) reject(current.replace(inverse.current, () => lines.reverse().join('\n') + '\n'));
    hunks++;
  }
  if (pin.inverses.length > 1) {
    const [a, b] = pin.inverses;
    reject(current.replace(a.current, '@@property-test@@').replace(b.current, a.current).replace('@@property-test@@', b.current));
  }
}
for (const file of ['__proto__', 'src/unknown.js', 'schema.sql.extra', 'knowledge/generated/graph.json']) {
  const input = 'unknown\r\nbytes\n';
  assert.throws(() => assertDeedQuestSourceTransfer(file, input));
  assert.equal(deedQuestSourceBaseline(file, input), input);
  negatives++;
}
const schema = fs.readFileSync('schema.sql', 'utf8');
assert.equal(fourthBatchMigrationSchema(schema), schema, 'Source reconstruction grants no historical native admission');
assert.equal(fifthBatchMigrationSchema(schema), schema, 'Source reconstruction grants no historical autonomy migration admission');
// The integration adds one outer exact-hash alias, leaving all historical literal pins intact.
const nextFive = lf(fs.readFileSync('tools/next-five-source-compatibility.js', 'utf8'))
  .replace("import { deedQuestSourceBaseline } from './deed-quest-source-transfer.js';\n", '')
  .replace(' input=deedQuestSourceBaseline(file,input);\n', '');
assert.equal(nextFive, git('show', `${DEED_QUEST_SOURCE_PREDECESSOR}:tools/next-five-source-compatibility.js`));
const releaseTool = lf(fs.readFileSync('tools/release-source-transfer.js', 'utf8'))
  .replace("import { deedQuestSourceBaseline } from './deed-quest-source-transfer.js';\n", '')
  .replace('  input = deedQuestSourceBaseline(file, input);\n', '');
assert.equal(releaseTool, git('show', `${DEED_QUEST_SOURCE_PREDECESSOR}:tools/release-source-transfer.js`));
for (const file of ['tools/economy-release-composition.js', 'tools/next-layer-source-compatibility.js', 'tools/rc1-source-pair.js',
  'tools/rc1-first-batch-source-compatibility.js', 'tools/rc1-second-batch-source-compatibility.js',
  'tools/rc1-third-batch-source-compatibility.js', 'tools/rc1-fourth-batch-source-compatibility.js',
  'tools/rc1-fifth-batch-source-compatibility.js'])
  assert.equal(lf(fs.readFileSync(file, 'utf8')), git('show', `${DEED_QUEST_SOURCE_PREDECESSOR}:${file}`),
    'Historical source assertions and pins remain byte-for-byte unchanged');
const nextLayerTest = lf(fs.readFileSync('test/next-layer-source-compatibility.js', 'utf8'))
  .replace("import {deedQuestSourceBaseline} from '../tools/deed-quest-source-transfer.js';\n", '')
  .replace("deedQuestSourceBaseline(file,fs.readFileSync(file,'utf8'))", "fs.readFileSync(file,'utf8')");
assert.equal(nextLayerTest, git('show', `${DEED_QUEST_SOURCE_PREDECESSOR}:test/next-layer-source-compatibility.js`),
  'Next-layer actual-source adapter preserves all original pins and rejecting controls');
console.log(`Property quest source envelope PASS: ${Object.keys(DEED_QUEST_SOURCE_DOMAINS).length} closed domains, ${hunks} exact inverse hunks, ${negatives} rejecting controls; source only`);
