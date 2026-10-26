// Independent immutable UX successor proof; existing historical pins and refusals stay strict.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { UX_SOURCE, UX_SOURCE_FILES, qualifyUxSource, uxHistoricalInput, UX_WORKFLOW_BOUND_SOURCE, UX_WORKFLOW_BOUND_FILE, qualifyUxWorkflowBoundSource, uxWorkflowBoundHistoricalInput } from '../tools/ux-source-compatibility.js';
import { ACTION_READINESS_SOURCE, qualifyActionReadinessSource } from '../tools/action-readiness-source-compatibility.js';
import { REBUILD_INTERFACE_SOURCE, qualifyRebuildInterfaceSource } from '../tools/classic-interface-source-compatibility.js';
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const pin = UX_SOURCE;
assert.equal(pin.status, 'SEALED');
assert.equal(pin.targetRevision, 'c6247976ff71e8d4c103ebd1498c2d373217d077');
assert.equal(pin.revision, '940df6a1efbe4ddcd8301cd138d5643dbe48a0bc');
assert.deepEqual(UX_SOURCE_FILES, ['.github/workflows/ci.yml', 'package.json', 'public/index.html', 'schema.sql', 'src/economy.js', 'src/server.js', 'test/gates.js', 'test/migrate.js']);
for (const [revision, tree] of [[pin.revision, pin.tree], [pin.targetRevision, pin.targetTree]]) assert.equal(git('rev-parse', revision + '^{tree}').trim(), tree);
git('merge-base', '--is-ancestor', pin.targetRevision, pin.revision); git('merge-base', '--is-ancestor', pin.revision, 'HEAD');
const inverseHunks = diff => {
  const rows = []; let hunk;
  for (const line of diff.split('\n')) {
    if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; rows.push(hunk); }
    else if (hunk && /^[ +\-]/.test(line)) { if (line[0] !== '-') hunk.current += line.slice(1) + '\n'; if (line[0] !== '+') hunk.baseline += line.slice(1) + '\n'; }
  }
  return rows;
};
let positives = 0, refusals = 0, inverseCount = 0;
for (const row of pin.files) {
  const current = git('show', pin.revision + ':' + row.file), target = git('show', pin.targetRevision + ':' + row.file), physical = uxWorkflowBoundHistoricalInput(row.file, fs.readFileSync(row.file, 'utf8')), stat = fs.lstatSync(row.file);
  assert(stat.isFile() && !stat.isSymbolicLink(), 'Physical guarded source is a regular file');
  assert.equal(uxWorkflowBoundHistoricalInput(row.file, git('show', 'HEAD:' + row.file)), current, 'Actual current committed source must retain the authored UX checkpoint after the exact workflow-parent forward layer');
  assert(physical === current || physical === current.replaceAll('\n', '\r\n'), 'Actual physical source must retain the complete UX checkpoint');
  for (const [revision, mode, expectedBlob] of [[pin.revision, row.mode, row.currentBlob], [pin.targetRevision, row.targetMode, row.targetBlob]])
    assert.equal(git('ls-tree', revision, '--', row.file).trim(), mode + ' blob ' + expectedBlob + '\t' + row.file);
  assert.deepEqual(row.inverses, inverseHunks(git('diff', '--no-ext-diff', '--unified=3', pin.targetRevision, pin.revision, '--', row.file)), 'Only real immutable Git inverse hunks');
  for (const input of [physical, current, current.replaceAll('\n', '\r\n')]) {
    const proof = qualifyUxSource(row.file, input);
    assert.equal(proof.baselineText, target); assert.equal(proof.sourceRevision, pin.revision); assert.equal(proof.targetRevision, pin.targetRevision);
    assert.deepEqual([proof.sourceOnly, proof.native, proof.runtime], [true, false, false]);
    assert.equal(uxHistoricalInput(row.file, input), target); positives++;
  }
  assert.deepEqual(uxHistoricalInput(row.file, Buffer.from(current)), Buffer.from(target)); positives++;
  const reject = input => { assert.notEqual(input, current, 'A rejection probe must change its source'); assert.throws(() => qualifyUxSource(row.file, input)); refusals++; };
  for (const input of [current + '\n', current.slice(1), '\ufeff' + current, current + '\0', current.replace(/\S/, '?'), current.replace('\n', '\r\n'), current.replace('\n', '\r'), Buffer.from(current), null]) reject(input);
  for (const inverse of row.inverses) {
    for (const input of [current.replace(inverse.current, ''), current.replace(inverse.current, () => inverse.current + inverse.current), current.replace(inverse.current, () => inverse.baseline), current.replace(inverse.current, () => inverse.current.replace(/\S/, '?'))]) reject(input);
    inverseCount++;
  }
  if (row.inverses.length > 1) { const [left, right] = row.inverses, marker = '\u0001UX_HUNK_SWAP\u0001'; assert(!current.includes(marker)); reject(current.replace(left.current, () => marker).replace(right.current, () => left.current).replace(marker, () => right.current)); }
  for (const input of [current + '\n// arbitrary future source\n', current.slice(1), target]) assert.equal(uxHistoricalInput(row.file, input), input, 'Unknown or predecessor bytes receive no UX inverse');
  assert.throws(() => qualifyUxSource(row.file, current, Object.freeze({ ...pin }))); refusals++;
  assert.throws(() => uxHistoricalInput(row.file, Buffer.concat([Buffer.from(current), Buffer.from([0xff])])), /lossless UTF-8/); refusals++;
  assert.equal(sha(current), row.currentSha256);
  // New bytes never acquire the older successor's direct qualification.
  if (ACTION_READINESS_SOURCE.files.some(record => record.file === row.file)) { assert.throws(() => qualifyActionReadinessSource(row.file, current)); refusals++; }
  if (REBUILD_INTERFACE_SOURCE.files.some(record => record.file === row.file)) { assert.throws(() => qualifyRebuildInterfaceSource(row.file, current)); refusals++; }
}
for (const file of ['../schema.sql', '__proto__', 'constructor', 'src/unknown.js']) { assert.throws(() => qualifyUxSource(file, 'x')); assert.equal(uxHistoricalInput(file, 'x'), 'x'); refusals++; }

// Reader-only integration is independently reversible to the complete unchanged main tests/helpers.
const readerEdits = {
  'tools/action-readiness-source-compatibility.js': [
    ["import {uxHistoricalInput} from './ux-source-compatibility.js';\n", ''],
    ["export function actionReadinessHistoricalInput(file,input){\n input=uxHistoricalInput(file,input);", "export function actionReadinessHistoricalInput(file,input){"],
  ],
  'test/classic-interface-source-compatibility.js': [
    ["import {uxHistoricalInput} from '../tools/ux-source-compatibility.js';\n", ''],
    ["const physical=uxHistoricalInput(row.file,fs.readFileSync(row.file,'utf8')),stat=fs.lstatSync(row.file);", "const physical=fs.readFileSync(row.file,'utf8'),stat=fs.lstatSync(row.file);"],
    ["assert.equal(uxHistoricalInput(row.file,git('show','HEAD:'+row.file)),current,'Current committed successor source remains exact');", "assert.equal(git('show','HEAD:'+row.file),current,'Current committed successor source remains exact');"],
  ],
  'test/commerce-release-phase2-migration-catalog.js': [
    ["import {uxHistoricalInput} from '../tools/ux-source-compatibility.js';\n", ''],
    ["commerceDefaultSchema(uxHistoricalInput('schema.sql',uniformRead('../schema.sql')))", "commerceDefaultSchema(uniformRead('../schema.sql'))"],
    ["function commerceDefaultFingerprint(file,input,expected){input=uxHistoricalInput(file,input);", "function commerceDefaultFingerprint(file,input,expected){"],
  ],
  'test/enterprise-release-phase2-migration-catalog.js': [
    ["import {execFileSync} from 'node:child_process';\nimport {uxHistoricalInput} from '../tools/ux-source-compatibility.js';\n\n", "import {execFileSync} from 'node:child_process';\n\n"],
    ["const dispatchSchema=uxHistoricalInput('schema.sql',fs.readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));", "const dispatchSchema=fs.readFileSync(new URL('../schema.sql',import.meta.url),'utf8');"],
    ["const actualSchema=uxHistoricalInput('schema.sql',fs.readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));", "const actualSchema=fs.readFileSync(new URL('../schema.sql',import.meta.url),'utf8');"],
  ],
};
for (const [file, edits] of Object.entries(readerEdits)) {
  let restored = fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
  for (const [current, baseline] of edits) { assert.equal(restored.split(current).length, 2, 'Unique reader-only integration edit: ' + file); restored = restored.replace(current, () => baseline); }
  assert.equal(restored, git('show', pin.targetRevision + ':' + file), 'Every prior binding, assertion and refusal is preserved verbatim: ' + file);
}
console.log(JSON.stringify({ phase: pin.phase, source: pin.revision, predecessor: pin.targetRevision, files: pin.files.length, inverseHunks: inverseCount, positives, refusals, readerOnlyEdits: Object.values(readerEdits).reduce((total, edits) => total + edits.length, 0), runtime: false, native: false }));
await import('./lib/ux-native-reader-source-compatibility.js');
await import('./lib/ux-enterprise-reader-source-compatibility.js');
await import('./lib/ux-director-reader-source-compatibility.js');

// A distinct one-file forward layer; old eight-file pins and refusal predicates above stay exact.
{
  const next = UX_WORKFLOW_BOUND_SOURCE, file = UX_WORKFLOW_BOUND_FILE;
  assert.equal(next.status, 'SEALED');
  assert.equal(next.revision, 'WORKFLOW_AUTHORED_REVISION_TO_STAMP_AFTER_CHECKPOINT');
  assert.equal(next.targetRevision, 'c727d652c11780c699164bca321c872abdb8852a');
  assert.deepEqual(next.files.map(row => row.file), [file]);
  for (const [revision, tree] of [[next.revision, next.tree], [next.targetRevision, next.targetTree]]) assert.equal(git('rev-parse', revision + '^{tree}').trim(), tree);
  git('merge-base', '--is-ancestor', next.targetRevision, next.revision); git('merge-base', '--is-ancestor', next.revision, 'HEAD');
  const row = next.files[0], current = git('show', next.revision + ':' + file), prior = git('show', next.targetRevision + ':' + file), physical = fs.readFileSync(file, 'utf8');
  assert.equal(git('show', 'HEAD:' + file), current, 'Raw actual HEAD workflow is the complete new authored file');
  assert(physical === current || physical === current.replaceAll('\n', '\r\n'), 'Raw physical workflow is whole LF/CRLF authored source');
  assert(fs.lstatSync(file).isFile() && !fs.lstatSync(file).isSymbolicLink());
  for (const [revision, mode, expected] of [[next.revision, row.mode, row.currentBlob], [next.targetRevision, row.targetMode, row.targetBlob]]) assert.equal(git('ls-tree', revision, '--', file).trim(), mode + ' blob ' + expected + '\t' + file);
  assert.deepEqual(row.inverses, inverseHunks(git('diff', '--no-ext-diff', '--unified=3', next.targetRevision, next.revision, '--', file)));
  assert.equal(row.inverses.length, 1); assert.equal(row.mode, row.targetMode);
  assert.equal(prior, git('show', pin.revision + ':' + file), 'New forward predecessor retains the entire old UX authored workflow');
  let positives = 0, refusals = 0;
  for (const input of [physical, current, current.replaceAll('\n', '\r\n')]) {
    const proof = qualifyUxWorkflowBoundSource(file, input);
    assert.equal(proof.baselineText, prior); assert.deepEqual([proof.sourceOnly, proof.native, proof.runtime], [true, false, false]);
    assert.equal(uxWorkflowBoundHistoricalInput(file, input), prior);
    assert.equal(uxHistoricalInput(file, input), git('show', pin.targetRevision + ':' + file)); positives++;
    assert.throws(() => qualifyUxSource(file, input), 'New workflow bytes never receive old direct qualification'); refusals++;
  }
  assert.deepEqual(uxWorkflowBoundHistoricalInput(file, Buffer.from(current)), Buffer.from(prior)); positives++;
  const reject = input => { assert.notEqual(input, current); assert.throws(() => qualifyUxWorkflowBoundSource(file, input)); refusals++; };
  for (const input of [current + '\n', current.slice(1), '\ufeff' + current, current + '\0', current.replace(/\S/, '?'), current.replace('\n', '\r\n'), current.replace('\n', '\r'), Buffer.from(current), null, prior]) reject(input);
  for (const number of ['120', '149', '151', '180', '999', '$' + '{{ inputs.timeout }}']) reject(current.replace('    timeout-minutes: 150\n', '    timeout-minutes: ' + number + '\n'));
  const secondTimeout = current.indexOf('timeout-minutes:', current.indexOf('timeout-minutes:') + 1); assert(secondTimeout > 0);
  reject(current.slice(0, secondTimeout) + current.slice(secondTimeout).replace(/timeout-minutes: \d+/, 'timeout-minutes: 151'));
  const inverse = row.inverses[0];
  for (const input of [current.replace(inverse.current, ''), current.replace(inverse.current, () => inverse.current + inverse.current), current.replace(inverse.current, () => inverse.baseline), current.replace(inverse.current, () => inverse.current.replace(/\S/, '?'))]) reject(input);
  assert.throws(() => qualifyUxWorkflowBoundSource(file, current, Object.freeze({ ...next }))); refusals++;
  assert.throws(() => uxWorkflowBoundHistoricalInput(file, Buffer.concat([Buffer.from(current), Buffer.from([255])])), /lossless|Lossless/); refusals++;
  for (const unknown of ['../.github/workflows/ci.yml', '__proto__', 'schema.sql']) { assert.throws(() => qualifyUxWorkflowBoundSource(unknown, current)); assert.equal(uxWorkflowBoundHistoricalInput(unknown, current), current); refusals++; }
  for (const input of [prior, current + '\n# unknown future workflow\n', current.slice(1)]) assert.equal(uxWorkflowBoundHistoricalInput(file, input), input);
  let conservedModule = fs.readFileSync('tools/ux-source-compatibility.js', 'utf8').replaceAll('\r\n', '\n');
  conservedModule = conservedModule.replace("import { UX_WORKFLOW_BOUND_SOURCE, UX_WORKFLOW_BOUND_SOURCE_SHA256 } from './ux-workflow-bound-source-data.js';\n", '');
  const start = conservedModule.indexOf('export { UX_WORKFLOW_BOUND_SOURCE };'), end = conservedModule.indexOf('export function uxHistoricalInput(file, input) {', start);
  assert(start >= 0 && end > start); conservedModule = conservedModule.slice(0, start) + conservedModule.slice(end);
  conservedModule = conservedModule.replace('  input = uxWorkflowBoundHistoricalInput(file, input);\n', '');
  assert.equal(conservedModule, git('show', next.targetRevision + ':tools/ux-source-compatibility.js'), 'Removing only the new forward hook restores the complete predecessor shared module');
  console.log(JSON.stringify({ phase: next.phase, files: 1, inverseHunks: 1, positives, refusals, runtime: false, native: false }));
}
