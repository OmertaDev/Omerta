// New exact source evidence composes with historical guards; it never revises their pins.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {marketOverDeedSourceBaseline} from '../tools/deed-market-source-compatibility.js';
import {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';
import {hasCommerceEnterpriseSource,commerceOverEnterpriseSourceBaseline} from '../tools/commerce-enterprise-source-compatibility.js';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';
import { DEED_QUEST_SOURCE_PREDECESSOR, DEED_QUEST_SOURCE_PHASE, DEED_QUEST_SOURCE_DOMAINS,
  assertDeedQuestSourceTransfer, deedQuestSourceBaseline } from '../tools/deed-quest-source-transfer.js';
import { nextFiveSourceBaseline } from '../tools/next-five-source-compatibility.js';
import { fourthBatchMigrationSchema } from '../tools/rc1-fourth-batch-source-compatibility.js';
import { fifthBatchMigrationSchema } from '../tools/rc1-fifth-batch-source-compatibility.js';
import { nextLayerMigrationPredecessor } from '../tools/next-layer-release-phase2-migration-catalog.js';

const lf = text => text.replaceAll('\r\n', '\n');
const git = (...args) => lf(execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  stdio: ['ignore', 'pipe', 'pipe'] }));
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
const retainedDeedRelease = '3aaeaa97a102babf7f56dece03860964814fe313';
const retainedDeedSource = file => git('show', retainedDeedRelease+':'+file);
assert.equal(DEED_QUEST_SOURCE_PREDECESSOR, '2c8eaacf104e8555d5140136b5ed19027ecd4766');
assert.equal(DEED_QUEST_SOURCE_PHASE, 'exact-source-transfer-only; no historical runtime, native, migration, financial, genesis or deployment clearance');
assert.deepEqual(Object.keys(DEED_QUEST_SOURCE_DOMAINS), ['package.json', 'schema.sql', 'src/agentgateway.js',
  'src/content/phase1.js', 'src/content/phase1-policy.js', 'src/content/city-quest-presentation.js', 'src/db.js', 'src/deeds.js', 'src/explore.js', 'tools/release-source-transfer.js',
  'test/gates.js', '.github/workflows/ci.yml', 'test/phase2-postgres.js']);
let hunks = 0, negatives = 0;
for (const [file, pin] of Object.entries(DEED_QUEST_SOURCE_DOMAINS)) {
  const actualSource = fs.readFileSync(file, 'utf8');
  const enterprise = hasCommerceEnterpriseSource(file) ? commerceOverEnterpriseSourceBaseline(file, actualSource) : actualSource;
  const raw = marketOverDeedSourceBaseline(file, cityActivitySourceBaseline(file, (hasEnterpriseOverRootSource(file) ? enterpriseOverRootSourceBaseline(file, enterprise) : enterprise))), current = lf(raw);
  assert(raw === current || raw === current.replaceAll('\n', '\r\n'), 'Working candidate has uniform line endings');
  const predecessor = git('show', `${DEED_QUEST_SOURCE_PREDECESSOR}:${file}`);
  assert.equal(hash(current), pin.currentSha256);
  assert.equal(blob(current), pin.currentBlob);
  assert.equal(current, git('cat-file', 'blob', pin.currentBlob));
  assert.equal(hash(predecessor), pin.baselineSha256);
  assert.equal(blob(predecessor), pin.baselineBlob);
  assert.equal(predecessor, git('cat-file', 'blob', pin.baselineBlob));
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses));
  const actual = []; let hunk = null;
  for (const line of git('diff', '--no-ext-diff', '--unified=3', pin.baselineBlob, pin.currentBlob).split('\n')) {
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
// Retain the released Deed branch's complete preservation proofs separately. The new junction
// test verifies current combined raw/Git bytes; these old assertions never qualify the new tree.
const nextFive = retainedDeedSource('tools/next-five-source-compatibility.js')
  .replace("import { deedQuestSourceBaseline } from './deed-quest-source-transfer.js';\n", '')
  .replace(' input=deedQuestSourceBaseline(file,input);\n', '');
assert.equal(nextFive, git('show', `${DEED_QUEST_SOURCE_PREDECESSOR}:tools/next-five-source-compatibility.js`));
const releaseTool = retainedDeedSource('tools/release-source-transfer.js')
  .replace("import { deedQuestSourceBaseline } from './deed-quest-source-transfer.js';\n", '')
  .replace('  input = deedQuestSourceBaseline(file, input);\n', '');
assert.equal(releaseTool, git('show', `${DEED_QUEST_SOURCE_PREDECESSOR}:tools/release-source-transfer.js`));
for (const file of ['tools/economy-release-composition.js', 'tools/next-layer-source-compatibility.js', 'tools/rc1-source-pair.js',
  'tools/rc1-first-batch-source-compatibility.js', 'tools/rc1-second-batch-source-compatibility.js',
  'tools/rc1-third-batch-source-compatibility.js', 'tools/rc1-fourth-batch-source-compatibility.js',
  'tools/rc1-fifth-batch-source-compatibility.js'])
  assert.equal(retainedDeedSource(file), git('show', `${DEED_QUEST_SOURCE_PREDECESSOR}:${file}`),
    'Released Deed source assertions and pins remain byte-for-byte unchanged in their own revision');
// Inspect only the exact activity reader adapter; reconstructed test text is never executed.
const nextLayerActivityPin = Object.freeze({
  revision: 'e3211c2619b43a51b943626b35174cad3ab38e23',
  sha256: '71fbdfe52b0c1c1e4815d919e74bb86811595e61e0eaf36dcd432de2cb2aaa1d',
  blob: '840ae51c78eeed77a461c537cae6b86a3a48af21',
  predecessorRevision: 'f89df180aa54e71cb17431d5324d3d9344ca7de0',
  predecessorSha256: '6fb23142f7dae80c8e51c214e7e75dbe62b9a506837eab52e14c564a16b69a98',
  predecessorBlob: '8733aa2ed7a90a640474eedeaa179714af5bec78',
});
const nextLayerActivityCurrent = git('show', `${nextLayerActivityPin.revision}:test/next-layer-source-compatibility.js`);
const nextLayerActivityPredecessor = git('show', `${nextLayerActivityPin.predecessorRevision}:test/next-layer-source-compatibility.js`);
for (const [text, sha256, object] of [
  [nextLayerActivityCurrent, nextLayerActivityPin.sha256, nextLayerActivityPin.blob],
  [nextLayerActivityPredecessor, nextLayerActivityPin.predecessorSha256, nextLayerActivityPin.predecessorBlob],
]) {
  assert.equal(hash(text), sha256);
  assert.equal(blob(text), object);
  assert.equal(text, git('cat-file', 'blob', object));
}
const nextLayerActivityInverses = Object.freeze([
  Object.freeze(["import { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\n", '']),
  Object.freeze(["cityActivitySourceBaseline(file,fs.readFileSync(file,'utf8'))", "fs.readFileSync(file,'utf8')"]),
]);
const inspectNextLayerActivityReader = raw => {
  let text = lf(raw);
  assert(raw === text || raw === text.replaceAll('\n', '\r\n'), 'Activity reader inspection requires uniform line endings');
  assert.equal(hash(text), nextLayerActivityPin.sha256);
  assert.equal(blob(text), nextLayerActivityPin.blob);
  assert.equal(text, nextLayerActivityCurrent);
  for (const [current, previous] of nextLayerActivityInverses) {
    assert.equal(text.split(current).length - 1, 1, 'Exact activity reader inverse occurs once');
    text = text.replace(current, () => previous);
  }
  assert.equal(hash(text), nextLayerActivityPin.predecessorSha256);
  assert.equal(blob(text), nextLayerActivityPin.predecessorBlob);
  assert.equal(text, nextLayerActivityPredecessor);
  return text;
};
for (const raw of [nextLayerActivityCurrent, nextLayerActivityCurrent.replaceAll('\n', '\r\n')])
  assert.equal(inspectNextLayerActivityReader(raw), nextLayerActivityPredecessor);
const nextLayerActivityRefusals = [nextLayerActivityCurrent + '\n// unknown reader drift\n',
  nextLayerActivityCurrent.slice(1), '\ufeff' + nextLayerActivityCurrent,
  nextLayerActivityCurrent.replace(/\S/, '?'), nextLayerActivityCurrent.replace('\n', '\r\n'),
  nextLayerActivityCurrent.replace('\n', '\r'), nextLayerActivityPredecessor,
  nextLayerActivityCurrent.replace('assert.equal(NEXT_LAYER_SOURCE_REVISION', 'assert.notEqual(NEXT_LAYER_SOURCE_REVISION')];
for (const [current] of nextLayerActivityInverses)
  nextLayerActivityRefusals.push(nextLayerActivityCurrent.replace(current, ''),
    nextLayerActivityCurrent.replace(current, () => current + current),
    nextLayerActivityCurrent.replace(current, () => current.replace(/\S/, '?')));
for (const raw of nextLayerActivityRefusals) assert.throws(() => inspectNextLayerActivityReader(raw));
console.log(`Next-layer activity reader inspection PASS: 2 line-ending positives, ${nextLayerActivityRefusals.length} refusing controls; source text only`);
// The merged reader is inspected separately before the retained activity reader proof.
// These exact source bytes are compared only; reconstructed test text is never executed.
const nextLayerJointPin = Object.freeze({
  "revision": "3217dd945b5c5641ab0414630c58c1f97ef40ec1",
  "sha256": "93680640a6e868c89f14421d63b55b74dcd5a3442c1e22eccb165f7d63887463",
  "blob": "8878ffb12bde51589a0683761f714e50002bbc81",
  "rawSha256": {
    "lf": "93680640a6e868c89f14421d63b55b74dcd5a3442c1e22eccb165f7d63887463",
    "crlf": "58258a0f5a34b18dc4812ff34004a87313f0fdee34a10df79fa214500a5e3fdb"
  },
  "predecessorRevision": "e3211c2619b43a51b943626b35174cad3ab38e23",
  "predecessorSha256": "71fbdfe52b0c1c1e4815d919e74bb86811595e61e0eaf36dcd432de2cb2aaa1d",
  "predecessorBlob": "840ae51c78eeed77a461c537cae6b86a3a48af21"
});
const nextLayerJointInverses = Object.freeze([
  {
    "current": "import { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport {marketOperationsSourceBaseline} from '../tools/market-operations-source-compatibility.js';\nimport {deedOverMarketSourceBaseline} from '../tools/deed-market-source-compatibility.js';\n// Only the exact market-source inverse precedes this unchanged historical source proof. Native admission stays raw.\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport {deedQuestSourceBaseline} from '../tools/deed-quest-source-transfer.js';\n",
    "baseline": "import { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport {deedQuestSourceBaseline} from '../tools/deed-quest-source-transfer.js';\n"
  },
  {
    "current": "let negatives=0,hunks=0;\nfor(const[file,pin]of Object.entries(NEXT_LAYER_SOURCE_DOMAINS)){\n  const current=git('show',NEXT_LAYER_SOURCE_REVISION+':'+file),prior=git('show',NEXT_LAYER_SOURCE_PREDECESSOR+':'+file);\n  assert.equal(marketOperationsSourceBaseline(file,deedQuestSourceBaseline(file,deedOverMarketSourceBaseline(file,cityActivitySourceBaseline(file,fs.readFileSync(file,'utf8'))))).replaceAll('\\r\\n','\\n'),current,'Complete actual source is independently pinned');\n  assert.equal(git('rev-parse',NEXT_LAYER_SOURCE_REVISION+':'+file).trim(),pin.currentBlob);\n  assert.equal(git('rev-parse',NEXT_LAYER_SOURCE_PREDECESSOR+':'+file).trim(),pin.baselineBlob);\n  const actual=[];let chunk;\n",
    "baseline": "let negatives=0,hunks=0;\nfor(const[file,pin]of Object.entries(NEXT_LAYER_SOURCE_DOMAINS)){\n  const current=git('show',NEXT_LAYER_SOURCE_REVISION+':'+file),prior=git('show',NEXT_LAYER_SOURCE_PREDECESSOR+':'+file);\n  assert.equal(deedQuestSourceBaseline(file,cityActivitySourceBaseline(file,fs.readFileSync(file,'utf8'))).replaceAll('\\r\\n','\\n'),current,'Complete actual source is independently pinned');\n  assert.equal(git('rev-parse',NEXT_LAYER_SOURCE_REVISION+':'+file).trim(),pin.currentBlob);\n  assert.equal(git('rev-parse',NEXT_LAYER_SOURCE_PREDECESSOR+':'+file).trim(),pin.baselineBlob);\n  const actual=[];let chunk;\n"
  },
  {
    "current": "for(const file of['__proto__','src/unknown.js','schema.sql.extra','knowledge/generated/graph.json']){\n  const text='unknown\\r\\nbytes\\n';assert.throws(()=>assertNextLayerSourceTransfer(file,text));assert.equal(nextLayerSourceBaseline(file,text),text);negatives++;\n}\nconst file='test/lib/phase2-architecture-upgrade-catalog.json',current=JSON.parse(marketOperationsSourceBaseline(file,fs.readFileSync(file,'utf8')));\nconst prior=JSON.parse(git('show',NEXT_LAYER_SOURCE_PREDECESSOR+':'+file));\nassert.equal(prior.added.length,1243);assert.equal(current.added.length,1332);\nassert.deepEqual(current.added.slice(0,1243),prior.added);assert.deepEqual(current.removed,prior.removed);\n",
    "baseline": "for(const file of['__proto__','src/unknown.js','schema.sql.extra','knowledge/generated/graph.json']){\n  const text='unknown\\r\\nbytes\\n';assert.throws(()=>assertNextLayerSourceTransfer(file,text));assert.equal(nextLayerSourceBaseline(file,text),text);negatives++;\n}\nconst file='test/lib/phase2-architecture-upgrade-catalog.json',current=JSON.parse(fs.readFileSync(file,'utf8'));\nconst prior=JSON.parse(git('show',NEXT_LAYER_SOURCE_PREDECESSOR+':'+file));\nassert.equal(prior.added.length,1243);assert.equal(current.added.length,1332);\nassert.deepEqual(current.added.slice(0,1243),prior.added);assert.deepEqual(current.removed,prior.removed);\n"
  }
].map(inverse => Object.freeze(inverse)));
const nextLayerJointCurrent = git('show', nextLayerJointPin.revision + ':test/next-layer-source-compatibility.js');
const nextLayerJointPredecessor = git('show', nextLayerJointPin.predecessorRevision + ':test/next-layer-source-compatibility.js');
for (const [text, sha256, object] of [
  [nextLayerJointCurrent, nextLayerJointPin.sha256, nextLayerJointPin.blob],
  [nextLayerJointPredecessor, nextLayerJointPin.predecessorSha256, nextLayerJointPin.predecessorBlob],
]) {
  assert.equal(hash(text), sha256);
  assert.equal(blob(text), object);
  assert.equal(text, git('cat-file', 'blob', object));
}
assert.equal(nextLayerJointPredecessor, nextLayerActivityCurrent);
const actualNextLayerJointInverses = []; let jointHunk;
for (const line of git('diff', '--no-ext-diff', '--unified=3', nextLayerJointPin.predecessorBlob, nextLayerJointPin.blob).split('\n')) {
  if (line.startsWith('@@')) { jointHunk = { current: '', baseline: '' }; actualNextLayerJointInverses.push(jointHunk); }
  else if (jointHunk && /^[ +\-]/.test(line)) {
    if (line[0] !== '-') jointHunk.current += line.slice(1) + '\n';
    if (line[0] !== '+') jointHunk.baseline += line.slice(1) + '\n';
  }
}
assert.deepEqual(nextLayerJointInverses, actualNextLayerJointInverses);
const inspectNextLayerJointReader = raw => {
  let text = lf(raw);
  assert(raw === text || raw === text.replaceAll('\n', '\r\n'), 'Joint reader inspection requires uniform line endings');
  assert.equal(hash(text), nextLayerJointPin.sha256);
  assert.equal(blob(text), nextLayerJointPin.blob);
  assert.equal(hash(raw), nextLayerJointPin.rawSha256[raw.includes('\r\n') ? 'crlf' : 'lf']);
  assert.equal(text, nextLayerJointCurrent);
  for (const { current, baseline } of nextLayerJointInverses) {
    assert.equal(text.split(current).length - 1, 1, 'Exact joint reader inverse occurs once');
    text = text.replace(current, () => baseline);
  }
  assert.equal(hash(text), nextLayerJointPin.predecessorSha256);
  assert.equal(blob(text), nextLayerJointPin.predecessorBlob);
  assert.equal(text, nextLayerJointPredecessor);
  return text;
};
for (const raw of [nextLayerJointCurrent, nextLayerJointCurrent.replaceAll('\n', '\r\n')])
  assert.equal(inspectNextLayerJointReader(raw), nextLayerJointPredecessor);
const nextLayerJointRefusals = [nextLayerJointCurrent + '\n// unknown reader drift\n',
  nextLayerJointCurrent.slice(1), '\ufeff' + nextLayerJointCurrent,
  nextLayerJointCurrent.replace(/\S/, '?'), nextLayerJointCurrent.replace('\n', '\r\n'),
  nextLayerJointCurrent.replace('\n', '\r'), nextLayerJointPredecessor,
  nextLayerJointCurrent.replace('assert.equal(NEXT_LAYER_SOURCE_REVISION', 'assert.notEqual(NEXT_LAYER_SOURCE_REVISION')];
for (const { current, baseline } of nextLayerJointInverses)
  nextLayerJointRefusals.push(nextLayerJointCurrent.replace(current, ''),
    nextLayerJointCurrent.replace(current, () => current + current),
    nextLayerJointCurrent.replace(current, () => baseline),
    nextLayerJointCurrent.replace(current, () => current.replace(/\S/, '?')));
const [jointA, jointB] = nextLayerJointInverses;
nextLayerJointRefusals.push(nextLayerJointCurrent.replace(jointA.current, '@@joint-reader-reorder@@')
  .replace(jointB.current, () => jointA.current).replace('@@joint-reader-reorder@@', () => jointB.current));
for (const raw of nextLayerJointRefusals) assert.throws(() => inspectNextLayerJointReader(raw));
console.log('Next-layer joint reader inspection PASS: 2 line-ending positives, ' + nextLayerJointRefusals.length + ' refusing controls; source text only');
// Inspect the exact Enterprise TEST-reader additions before the unchanged joint/activity proofs.
// This reconstructs source text only and grants no native or historical runtime admission.
const nextLayerEnterprisePin = Object.freeze({
  "revision": "2f716bc9623016beeb0ca4d93d1d26dd472610c6",
  "file": "test/next-layer-source-compatibility.js",
  "mode": "100644",
  "blob": "cadb9c7e8f186e59833db870afdddfaeeb443d1e",
  "sha256": "463e8efccdeb49612b4356db36a6be0de013091e7cb1738991749a00f591b29b",
  "rawSha256": {
    "lf": "463e8efccdeb49612b4356db36a6be0de013091e7cb1738991749a00f591b29b",
    "crlf": "347ac35083dc21a069e08e6cfdb7d027508fb502fb10589a1ed3c8a47a979b7d"
  },
  "predecessorRevision": "3217dd945b5c5641ab0414630c58c1f97ef40ec1",
  "predecessorBlob": "8878ffb12bde51589a0683761f714e50002bbc81",
  "predecessorSha256": "93680640a6e868c89f14421d63b55b74dcd5a3442c1e22eccb165f7d63887463"
});
const nextLayerEnterpriseCurrent = git('show', nextLayerEnterprisePin.revision+':'+nextLayerEnterprisePin.file);
assert.equal(git('ls-tree', nextLayerEnterprisePin.revision, '--', nextLayerEnterprisePin.file),
  nextLayerEnterprisePin.mode+' blob '+nextLayerEnterprisePin.blob+'\t'+nextLayerEnterprisePin.file+'\n');
assert.equal(hash(nextLayerEnterpriseCurrent), nextLayerEnterprisePin.sha256);
assert.equal(blob(nextLayerEnterpriseCurrent), nextLayerEnterprisePin.blob);
const nextLayerEnterpriseInverses = [
  {
    "current": "import { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport {enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\nimport {marketOperationsSourceBaseline} from '../tools/market-operations-source-compatibility.js';\nimport {deedOverMarketSourceBaseline} from '../tools/deed-market-source-compatibility.js';\n// Only the exact market-source inverse precedes this unchanged historical source proof. Native admission stays raw.\n",
    "baseline": "import { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';\nimport {marketOperationsSourceBaseline} from '../tools/market-operations-source-compatibility.js';\nimport {deedOverMarketSourceBaseline} from '../tools/deed-market-source-compatibility.js';\n// Only the exact market-source inverse precedes this unchanged historical source proof. Native admission stays raw.\n"
  },
  {
    "current": "let negatives=0,hunks=0;\nfor(const[file,pin]of Object.entries(NEXT_LAYER_SOURCE_DOMAINS)){\n  const current=git('show',NEXT_LAYER_SOURCE_REVISION+':'+file),prior=git('show',NEXT_LAYER_SOURCE_PREDECESSOR+':'+file);\n  assert.equal(marketOperationsSourceBaseline(file,deedQuestSourceBaseline(file,deedOverMarketSourceBaseline(file,cityActivitySourceBaseline(file,enterpriseOverRootSourceBaseline(file,fs.readFileSync(file,'utf8')))))).replaceAll('\\r\\n','\\n'),current,'Complete actual source is independently pinned');\n  assert.equal(git('rev-parse',NEXT_LAYER_SOURCE_REVISION+':'+file).trim(),pin.currentBlob);\n  assert.equal(git('rev-parse',NEXT_LAYER_SOURCE_PREDECESSOR+':'+file).trim(),pin.baselineBlob);\n  const actual=[];let chunk;\n",
    "baseline": "let negatives=0,hunks=0;\nfor(const[file,pin]of Object.entries(NEXT_LAYER_SOURCE_DOMAINS)){\n  const current=git('show',NEXT_LAYER_SOURCE_REVISION+':'+file),prior=git('show',NEXT_LAYER_SOURCE_PREDECESSOR+':'+file);\n  assert.equal(marketOperationsSourceBaseline(file,deedQuestSourceBaseline(file,deedOverMarketSourceBaseline(file,cityActivitySourceBaseline(file,fs.readFileSync(file,'utf8'))))).replaceAll('\\r\\n','\\n'),current,'Complete actual source is independently pinned');\n  assert.equal(git('rev-parse',NEXT_LAYER_SOURCE_REVISION+':'+file).trim(),pin.currentBlob);\n  assert.equal(git('rev-parse',NEXT_LAYER_SOURCE_PREDECESSOR+':'+file).trim(),pin.baselineBlob);\n  const actual=[];let chunk;\n"
  },
  {
    "current": "for(const file of['__proto__','src/unknown.js','schema.sql.extra','knowledge/generated/graph.json']){\n  const text='unknown\\r\\nbytes\\n';assert.throws(()=>assertNextLayerSourceTransfer(file,text));assert.equal(nextLayerSourceBaseline(file,text),text);negatives++;\n}\nconst file='test/lib/phase2-architecture-upgrade-catalog.json',current=JSON.parse(marketOperationsSourceBaseline(file,enterpriseOverRootSourceBaseline(file,fs.readFileSync(file,'utf8'))));\nconst prior=JSON.parse(git('show',NEXT_LAYER_SOURCE_PREDECESSOR+':'+file));\nassert.equal(prior.added.length,1243);assert.equal(current.added.length,1332);\nassert.deepEqual(current.added.slice(0,1243),prior.added);assert.deepEqual(current.removed,prior.removed);\n",
    "baseline": "for(const file of['__proto__','src/unknown.js','schema.sql.extra','knowledge/generated/graph.json']){\n  const text='unknown\\r\\nbytes\\n';assert.throws(()=>assertNextLayerSourceTransfer(file,text));assert.equal(nextLayerSourceBaseline(file,text),text);negatives++;\n}\nconst file='test/lib/phase2-architecture-upgrade-catalog.json',current=JSON.parse(marketOperationsSourceBaseline(file,fs.readFileSync(file,'utf8')));\nconst prior=JSON.parse(git('show',NEXT_LAYER_SOURCE_PREDECESSOR+':'+file));\nassert.equal(prior.added.length,1243);assert.equal(current.added.length,1332);\nassert.deepEqual(current.added.slice(0,1243),prior.added);assert.deepEqual(current.removed,prior.removed);\n"
  }
];
const inspectNextLayerEnterpriseReader = raw => {
  assert.equal(typeof raw, 'string');
  let text = lf(raw);
  assert(!text.includes('\r') && (raw === text || raw === text.replaceAll('\n', '\r\n')),
    'Enterprise reader inspection requires uniform line endings');
  assert.equal(hash(text), nextLayerEnterprisePin.sha256);
  assert.equal(blob(text), nextLayerEnterprisePin.blob);
  assert.equal(hash(raw), nextLayerEnterprisePin.rawSha256[raw.includes('\r\n') ? 'crlf' : 'lf']);
  assert.equal(text, nextLayerEnterpriseCurrent);
  for (const {current, baseline} of nextLayerEnterpriseInverses) {
    assert.equal(text.split(current).length-1, 1, 'Exact Enterprise TEST reader inverse occurs once');
    text = text.replace(current, () => baseline);
  }
  assert.equal(hash(text), nextLayerEnterprisePin.predecessorSha256);
  assert.equal(blob(text), nextLayerEnterprisePin.predecessorBlob);
  assert.equal(text, nextLayerJointCurrent);
  return text;
};
for (const raw of [nextLayerEnterpriseCurrent, nextLayerEnterpriseCurrent.replaceAll('\n', '\r\n')])
  assert.equal(inspectNextLayerEnterpriseReader(raw), nextLayerJointCurrent);
const nextLayerEnterpriseRefusals = [nextLayerEnterpriseCurrent+'\n// unknown Enterprise reader drift\n',
  nextLayerEnterpriseCurrent.slice(1), '\ufeff'+nextLayerEnterpriseCurrent,
  nextLayerEnterpriseCurrent.replace(/\S/, '?'), nextLayerEnterpriseCurrent.replace('\n', '\r\n'),
  nextLayerEnterpriseCurrent.replace('\n', '\r'), nextLayerEnterpriseCurrent+'\0', nextLayerJointCurrent];
for (const {current, baseline} of nextLayerEnterpriseInverses)
  nextLayerEnterpriseRefusals.push(nextLayerEnterpriseCurrent.replace(current, ''),
    nextLayerEnterpriseCurrent.replace(current, () => current+current),
    nextLayerEnterpriseCurrent.replace(current, () => baseline),
    nextLayerEnterpriseCurrent.replace(current, () => current.replace(/\S/, '?')));
for (const raw of nextLayerEnterpriseRefusals) assert.throws(() => inspectNextLayerEnterpriseReader(raw));
console.log('Next-layer Enterprise reader inspection PASS: 2 line-ending positives, '+nextLayerEnterpriseRefusals.length+' refusing controls; source text only');
const nextLayerTest = inspectNextLayerActivityReader(inspectNextLayerJointReader(inspectNextLayerEnterpriseReader(fs.readFileSync('test/next-layer-source-compatibility.js', 'utf8'))))
  .replace("import {deedQuestSourceBaseline} from '../tools/deed-quest-source-transfer.js';\n", '')
  .replace("deedQuestSourceBaseline(file,fs.readFileSync(file,'utf8'))", "fs.readFileSync(file,'utf8')");
assert.equal(nextLayerTest, git('show', `${DEED_QUEST_SOURCE_PREDECESSOR}:test/next-layer-source-compatibility.js`),
  'Next-layer actual-source adapter preserves all original pins and rejecting controls');
let nativeTool = lf(fs.readFileSync('tools/next-layer-release-phase2-migration-catalog.js','utf8'));
const nativeInverses = [
  ["import { deedQuestSourceBaseline } from './deed-quest-source-transfer.js';\n", ''],
  ["import {createDeedDiscoveryMigrationCatalog, isDeedDiscoveryMigrationSource} from './deed-discovery-migration-catalog.js';\n", ''],
  ["import {migrateCityHomeStorage} from '../src/city-home-migration.js';\n", ''],
  ['async function compileReference(admin, endpoint, source, { runtimeReset = true, upgradeDdl = false, currentDeedHomeMigration = false } = {}) {',
    'async function compileReference(admin, endpoint, source, { runtimeReset = true, upgradeDdl = false } = {}) {'],
  ["    if (currentDeedHomeMigration) await migrateCityHomeStorage(client, {compatibility:'postgres'});\n", ''],
  ["  const actualRaw = fs.readFileSync(new URL('../src/db.js', import.meta.url), 'utf8');\n"
    + "  assert(actualRaw === actualRaw.replaceAll('\\r\\n', '\\n') || actualRaw === actualRaw.replaceAll('\\r\\n', '\\n').replaceAll('\\n', '\\r\\n'), 'Runtime reset source has uniform line endings');\n"
    + "  const actual = deedQuestSourceBaseline('src/db.js', actualRaw).replaceAll('\\r\\n', '\\n');\n",
    "  const actual = fs.readFileSync(new URL('../src/db.js', import.meta.url), 'utf8').replaceAll('\\r\\n', '\\n');\n"],
  ["export async function createCurrentDeedNativeCatalog(pool, endpoint, source, {profile, includeNotNull}) {\n"
    + "  return createDeedDiscoveryMigrationCatalog(pool, endpoint, source,\n"
    + "    {profile, includeNotNull, compileReference, readMetadata:readNextLayerReleasePhase2Metadata, legacySchema:nextLayerLegacySchema});\n}\n", ''],
  ["  const deedNative = isDeedDiscoveryMigrationSource(source)\n"
    + "    ? await createCurrentDeedNativeCatalog(pool, endpoint, source, {profile:legacyProfile, includeNotNull}) : null;\n"
    + "  const premainSource = nextLayerMigrationPredecessor(deedNative ? deedNative.predecessorSource : source), predecessorSource=nextLayerNativeHistoricalPredecessor(premainSource), sources = nextLayerMigrationSources();\n",
    "  const premainSource = nextLayerMigrationPredecessor(source), predecessorSource=nextLayerNativeHistoricalPredecessor(premainSource), sources = nextLayerMigrationSources();\n"],
  ['    if (deedNative) actual = deedNative.projectMetadata(actual);\n', ''],
  ['    if (deedNative) rows = deedNative.projectConstraints(rows);\n', ''],
  ['reference: deedNative ? deedNative.reference : current, addedColumns, addedConstraints, addedIndexes, deedNative,',
    'reference: current, addedColumns, addedConstraints, addedIndexes,'],
];
for (const [current, previous] of nativeInverses) {
  assert.equal(nativeTool.split(current).length-1,1,'Exact scoped native adapter occurs once');
  nativeTool=nativeTool.replace(current,()=>previous);
}
assert.equal(nativeTool,git('show',`${DEED_QUEST_SOURCE_PREDECESSOR}:tools/next-layer-release-phase2-migration-catalog.js`),
  'Removing only the two scoped current-Deed bridges restores every historical native byte and refusal');
const resetRuntime = git('show', 'b90bd95dee6e0fda851247cc660288f4bbf8fdc0:src/db.js');
const currentRuntime = lf(fs.readFileSync('src/db.js', 'utf8'));
const resetDdl = 'CREATE TABLE IF NOT EXISTS player_reset_migrations (\n    id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now()\n  )';
for (const raw of [currentRuntime, currentRuntime.replaceAll('\n', '\r\n')])
  assert.equal(deedQuestSourceBaseline('src/db.js', raw), resetRuntime,
    'Only the complete reviewed Deed runtime reconstructs the unchanged reset-DDL reference');
for (const source of [currentRuntime, resetRuntime])
  assert.equal(source.split('await q.query(`' + resetDdl + '`);').length - 1, 1,
    'The exact frozen runtime reset DDL remains unique');
assert.throws(() => nextLayerMigrationPredecessor(schema), error => error?.code === 'ERR_ASSERTION',
  'Current Deed schema still has no historical native admission');
console.log(`Retained property quest source envelope PASS after exact current junction: ${Object.keys(DEED_QUEST_SOURCE_DOMAINS).length} closed domains, ${hunks} exact inverse hunks, ${negatives} rejecting controls; no new native or release qualification`);
