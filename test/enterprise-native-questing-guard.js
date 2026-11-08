import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  assertQuestingNativeDefinition, captureQuestingEnterpriseSource, questingNativeMetadataBytes,
  assertQuestingEnterpriseTrackedInput,
  QUESTING_ENTERPRISE_EXECUTION, assertQuestingExecutionOrder, canonicalQuestingResults,
  QUESTING_NATIVE_METADATA, QUESTING_NATIVE_PREDECESSOR_METADATA, QUESTING_NATIVE_SUPPORT,
} from '../tools/enterprise-native-questing.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as predecessor, ENTERPRISE_NATIVE_UX_INPUTS_SHA256 as predecessorHash } from '../tools/enterprise-native-contract-release-inputs.js';
import { enterpriseUxMetadataBytes } from '../tools/enterprise-native-ux.js';
import { ENTERPRISE_NATIVE_PROOFS, assertEnterpriseNativeTrackedBytes, assertEnterpriseResults } from '../tools/enterprise-native.js';
import { QUESTING_ENTERPRISE_NATIVE_INPUTS as actual } from '../tools/enterprise-native-questing-inputs.js';

const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
assert.strictEqual(assertQuestingExecutionOrder(), QUESTING_ENTERPRISE_EXECUTION);
assert.equal(QUESTING_ENTERPRISE_EXECUTION[0][0], 'enterprise-release-phase2-migration-catalog');
let schedulingRefusals = 0;
for (const order of [
  QUESTING_ENTERPRISE_EXECUTION.slice(1), [...QUESTING_ENTERPRISE_EXECUTION, QUESTING_ENTERPRISE_EXECUTION[0]],
  QUESTING_ENTERPRISE_EXECUTION.map((row, i) => i === 1 ? QUESTING_ENTERPRISE_EXECUTION[0] : row),
  [...QUESTING_ENTERPRISE_EXECUTION].reverse(), [...ENTERPRISE_NATIVE_PROOFS],
  QUESTING_ENTERPRISE_EXECUTION.map((row, i) => i === 1 ? Object.freeze([...row]) : row),
]) { assert.throws(() => assertQuestingExecutionOrder(Object.freeze(order))); schedulingRefusals++; }
assert.throws(() => assertQuestingExecutionOrder([...QUESTING_ENTERPRISE_EXECUTION])); schedulingRefusals++;
const receiptSource = { revision: 'a'.repeat(40), files: Object.fromEntries(ENTERPRISE_NATIVE_PROOFS.map(([name]) => [`test/${name}.js`, { sha256: 'b'.repeat(64) }])) };
const chronological = QUESTING_ENTERPRISE_EXECUTION.map(([name, , prefix], i) => ({ file: name, database: prefix + (i + 1).toString(16).padStart(12, '0'), port: 5432,
  sourceSha256: 'b'.repeat(64), code: 0, signal: null, error: null, durationMs: 1, state: 'passed', logSha256: 'd'.repeat(64) }));
const canonical = canonicalQuestingResults(chronological);
assert.deepEqual(canonical.map(row => row.file), ENTERPRISE_NATIVE_PROOFS.map(([name]) => name));
for (const receipt of canonical) assert.strictEqual(receipt, chronological.find(row => row.file === receipt.file));
assert.equal(chronological[0].file, 'enterprise-release-phase2-migration-catalog', 'Chronological audit is not mutated');
assertEnterpriseResults(canonical, receiptSource, 'ci');
assert.throws(() => assertEnterpriseResults(chronological, receiptSource, 'ci')); schedulingRefusals++;
for (const receipts of [chronological.slice(1), [...chronological, chronological[0]],
  chronological.map((row, i) => i === 1 ? chronological[0] : row),
  chronological.map((row, i) => i === 1 ? { ...row, file: 'unreviewed-case' } : row),
  chronological.map((row, i) => i === 1 ? { ...row, state: 'failed' } : row)]) {
  assert.throws(() => canonicalQuestingResults(receipts)); schedulingRefusals++;
}
const legacy = new Set(predecessor.files.map(row => row.file));
const additions = QUESTING_NATIVE_SUPPORT.filter(file => !legacy.has(file)).sort().map(file => ({ file, mode: '100644', blob: 'a'.repeat(40),
  sha256: file === QUESTING_NATIVE_PREDECESSOR_METADATA ? sha(enterpriseUxMetadataBytes(predecessor)) : 'b'.repeat(64) }));
const candidate = freeze({ version: 1, status: 'SEALED', phase: 'ACTUAL_CURRENT_QUESTING_ENTERPRISE_NATIVE_INPUTS', authoredRevision: 'c'.repeat(40),
  predecessorDefinitionSha256: predecessorHash, proofInventorySha256: sha(JSON.stringify(ENTERPRISE_NATIVE_PROOFS)),
  files: [...predecessor.files, ...additions], replacements: [], additions });
assertQuestingNativeDefinition(candidate);
let rejections = 0;
for (const change of [
  value => { value.status = 'UNSEALED'; }, value => { value.authoredRevision = null; },
  value => { value.priorNativeResultsTransferred = true; }, value => { value.proofInventorySha256 = '0'.repeat(64); },
  value => { value.predecessorDefinitionSha256 = '0'.repeat(64); }, value => { value.files.shift(); },
  value => { value.files.push(value.files[0]); }, value => { [value.files[0], value.files[1]] = [value.files[1], value.files[0]]; },
  value => { value.files.find(row => row.file === 'tools/enterprise-native.js').sha256 = '0'.repeat(64); },
  value => { value.files.find(row => row.file === QUESTING_NATIVE_PREDECESSOR_METADATA).sha256 = '0'.repeat(64); },
  value => { value.additions = []; }, value => { value.files.push({ file: QUESTING_NATIVE_METADATA, mode: '100644', blob: 'a'.repeat(40), sha256: 'b'.repeat(64) }); },
  value => {
    value.files = value.files.filter(row => row.file !== 'src/casinorakeback.js');
    value.additions = value.additions.filter(row => row.file !== 'src/casinorakeback.js');
  },
]) {
  const mutated = structuredClone(candidate); change(mutated);
  assert.throws(() => assertQuestingNativeDefinition(freeze(mutated))); rejections++;
}
for (const file of ['tools/businessdesk-native-provenance.js', 'tools/businessdesk-combined-native-provenance.js']) {
  const mutated = structuredClone(candidate), before = predecessor.files.find(row => row.file === file);
  assert.ok(before, `Historical native provenance fixture: ${file}`);
  const index = mutated.files.findIndex(row => row.file === file);
  const after = { ...mutated.files[index], blob: '0'.repeat(40), sha256: '0'.repeat(64) };
  mutated.files[index] = after;
  mutated.replacements = [{ file, before: structuredClone(before), after }];
  assert.throws(() => assertQuestingNativeDefinition(freeze(mutated)), /Immutable historical helper\/manifest/);
  rejections++;
}
assert.throws(() => assertQuestingNativeDefinition(structuredClone(candidate)), /frozen|false == true|truthy/i);
const rendered = questingNativeMetadataBytes(candidate).toString('utf8');
assert.ok(rendered.includes(sha(JSON.stringify(candidate)))); assert.ok(!rendered.includes('import('));
let actualArgumentRefusals = 0;
if (actual.status === 'UNSEALED') {
  assert.throws(() => captureQuestingEnterpriseSource(), /UNSEALED/);
  assert.throws(() => assertQuestingEnterpriseTrackedInput('package.json', {}, {}, Buffer.from('')), /UNSEALED/);
} else {
  assertQuestingNativeDefinition(actual);
  const row = actual.replacements[0]?.after;
  assert.ok(row, 'The authored release must contain a real changed input for argument tests.');
  const git = (...args) => execFileSync('git', ['--no-optional-locks', '--no-replace-objects', ...args], { maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  const record = (revision, file = row.file) => {
    const line = git('ls-tree', '-z', revision, '--', file).toString('utf8');
    const match = line.match(/^(100644|100755) blob ([a-f0-9]{40})\t([^\0]+)\0$/);
    assert.ok(match && match[3] === file); return { type: 'blob', mode: match[1], blob: match[2] };
  };
  const current = record('HEAD'), authored = record(actual.authoredRevision), bytes = git('show', `HEAD:${row.file}`);
  const physical = fs.readFileSync(row.file); assert.ok(fs.lstatSync(row.file).isFile() && !fs.lstatSync(row.file).isSymbolicLink());
  assertEnterpriseNativeTrackedBytes(physical, bytes, false);
  assert.strictEqual(assertQuestingEnterpriseTrackedInput(row.file, current, authored, bytes).current,
    actual.files.find(input => input.file === row.file));
  const otherMode = current.mode === '100644' ? '100755' : '100644';
  for (const [now, anchor, raw] of [
    [{ ...current, mode: otherMode }, authored, bytes], [current, { ...authored, mode: otherMode }, bytes],
    [{ ...current, blob: '0'.repeat(40) }, authored, bytes], [current, { ...authored, blob: '1'.repeat(40) }, bytes],
    [{ ...current, type: 'tree' }, authored, bytes], [current, authored, Buffer.concat([bytes, Buffer.from('\n')])],
    [current, authored, bytes.subarray(1)], [current, authored, bytes.toString('utf8')],
  ]) { assert.throws(() => assertQuestingEnterpriseTrackedInput(row.file, now, anchor, raw)); actualArgumentRefusals++; }
  assert.throws(() => assertQuestingEnterpriseTrackedInput(row.file, current, authored, bytes, Object.freeze({ ...actual })));
  assert.throws(() => assertQuestingEnterpriseTrackedInput('../outside.js', current, authored, bytes)); actualArgumentRefusals += 2;
  const companion = actual.files.find(input => input.file === 'src/casinorakeback.js');
  assert.ok(companion, 'The reviewed casino companion has its own exact current native pin.');
  const companionCurrent = record('HEAD', companion.file), companionAuthored = record(actual.authoredRevision, companion.file);
  const companionBytes = git('show', `HEAD:${companion.file}`), companionPhysical = fs.readFileSync(companion.file);
  assert.ok(fs.lstatSync(companion.file).isFile() && !fs.lstatSync(companion.file).isSymbolicLink());
  assertEnterpriseNativeTrackedBytes(companionPhysical, companionBytes, false);
  assert.strictEqual(assertQuestingEnterpriseTrackedInput(companion.file, companionCurrent, companionAuthored, companionBytes).current,
    companion, 'The full committed companion bytes and both Git identities qualify before execution.');
  for (const [now, anchor, raw] of [
    [{ ...companionCurrent, mode: companionCurrent.mode === '100644' ? '100755' : '100644' }, companionAuthored, companionBytes],
    [{ ...companionCurrent, blob: '0'.repeat(40) }, companionAuthored, companionBytes],
    [companionCurrent, { ...companionAuthored, blob: '1'.repeat(40) }, companionBytes],
    [companionCurrent, companionAuthored, Buffer.concat([companionBytes, Buffer.from('\n// altered companion\n')])],
  ]) { assert.throws(() => assertQuestingEnterpriseTrackedInput(companion.file, now, anchor, raw)); actualArgumentRefusals++; }
}
console.log(JSON.stringify({ phase: 'SOURCE_ONLY_ACTUAL_CURRENT_ENTERPRISE_GUARDS', syntheticDefinition: true,
  mutationRejections: rejections + 1, predecessorInputs: predecessor.files.length, mandatoryNativeCases: ENTERPRISE_NATIVE_PROOFS.length,
  actualArgumentRefusals, schedulingRefusals, nativeExecution: false, historicalResultsTransferred: false }));
