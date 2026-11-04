// Maintainer-only exact Git source/provenance generation. This grants no native admission/results.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { ECONOMY_DEED_MERGE_FILES, ECONOMY_DEED_MERGE_PROFILES,
  ECONOMY_DEED_MERGE_NATIVE_REVIEW_FILES } from './economy-deed-merge-source-compatibility.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as previous,
  ENTERPRISE_NATIVE_UX_INPUTS_SHA256 as previousDefinitionSha256 } from './enterprise-native-ux-b35-inputs.js';
const output = 'tools/economy-deed-merge-source-data.js';
const previousPath = 'tools/enterprise-native-ux-b35-inputs.js';
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args],
  { encoding: 'utf8', windowsHide: true, maxBuffer: 256 * 1024 * 1024 });
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const blob = bytes => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(bytes) + '\0').update(bytes).digest('hex');
assert.deepEqual(process.argv.slice(2).length, 2); assert.equal(process.argv[2], '--authored');
const authored = process.argv[3]; assert.match(authored, /^[a-f0-9]{40}$/);
assert.equal(git('rev-parse', 'HEAD').trim(), authored, 'Generate only from the complete current authored commit');
const dirty = git('diff', '--name-only', 'HEAD').trim().split('\n').filter(Boolean);
assert(dirty.every(file => file === output), 'Commit all source and hook changes before generating');
for (const file of [output, 'tools/economy-deed-merge-source-compatibility.js',
  'tools/generate-economy-deed-merge-source.js', 'test/economy-deed-merge-source-compatibility.js'])
  assert(git('ls-tree', authored, '--', file).trim(), 'Every new engine/proof path must already be authored: ' + file);
const trees = new Map();
const tree = revision => {
  if (!trees.has(revision)) trees.set(revision, new Map(git('ls-tree', '-r', '-z', revision).split('\0').filter(Boolean).map(line => {
    const at = line.indexOf('\t'), [mode, type, oid] = line.slice(0, at).split(' ');
    return [line.slice(at + 1), { mode, type, blob: oid }];
  })));
  return trees.get(revision);
};
const contents = new Map();
const bytes = (revision, file) => {
  const entry = tree(revision).get(file); assert(entry?.type === 'blob', 'Exact Git blob required: ' + file);
  if (!contents.has(entry.blob)) contents.set(entry.blob, execFileSync('git', ['--no-replace-objects', 'cat-file', 'blob', entry.blob],
    { windowsHide: true, maxBuffer: 32 * 1024 * 1024 }));
  return contents.get(entry.blob);
};
const nativePin = (revision, file) => {
  const entry = tree(revision).get(file); assert(['100644', '100755'].includes(entry?.mode));
  return { file, mode: entry.mode, blob: entry.blob, sha256: sha(bytes(revision, file)) };
};
const text = (revision, file) => {
  const raw = bytes(revision, file), value = raw.toString('utf8'); assert(Buffer.from(value).equals(raw));
  assert(!value.includes('\r') && !value.includes('\0') && !value.includes('\ufeff'), 'Canonical immutable Git source required');
  return value;
};
const sourcePin = (revision, file) => {
  const value = text(revision, file), entry = tree(revision).get(file);
  return { mode: entry.mode, sha256: sha(value), blob: blob(value), bytes: Buffer.byteLength(value) };
};
const inverseHunks = (file, prior) => {
  const inverses = []; let hunk;
  for (const line of git('diff', '--no-ext-diff', '--unified=3', prior, authored, '--', file).split('\n')) {
    if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; inverses.push(hunk); }
    else if (hunk && /^[ +\-]/.test(line)) {
      if (line[0] !== '-') hunk.current += line.slice(1) + '\n';
      if (line[0] !== '+') hunk.baseline += line.slice(1) + '\n';
    }
  }
  let restored = text(authored, file), end = -1;
  const current = restored;
  for (const inverse of inverses) {
    assert(inverse.current.length); assert.equal(current.split(inverse.current).length, 2);
    const at = current.indexOf(inverse.current); assert(at >= end); end = at + inverse.current.length;
    assert.equal(restored.split(inverse.current).length, 2); restored = restored.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(restored, text(prior, file)); return inverses;
};
const profiles = Object.fromEntries(Object.entries(ECONOMY_DEED_MERGE_PROFILES).map(([name, revision]) => {
  git('merge-base', '--is-ancestor', revision, authored);
  return [name, { revision, tree: git('rev-parse', revision + '^{tree}').trim() }];
}));
const source = { version: 1, status: 'SEALED', phase: 'EXACT_ECONOMY_DEED_MERGE_SOURCE_ONLY',
  sourceRevision: authored, sourceTree: git('rev-parse', authored + '^{tree}').trim(), profiles,
  files: ECONOMY_DEED_MERGE_FILES.map(file => {
    const value = text(authored, file);
    assert.equal(fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n'), value, 'Physical source differs from authored Git');
    const stat = fs.lstatSync(file); assert(stat.isFile() && !stat.isSymbolicLink());
    return { file, current: { ...sourcePin(authored, file), rawSha256: { lf: sha(value), crlf: sha(value.replaceAll('\n', '\r\n')) } },
      parents: Object.fromEntries(Object.entries(profiles).map(([profile, { revision }]) =>
        [profile, { ...sourcePin(revision, file), inverses: inverseHunks(file, revision) }])) };
  }), sourceOnly: true, runtime: false, native: false };
assert.equal(previous.status, 'SEALED'); assert.equal(sha(JSON.stringify(previous)), previousDefinitionSha256);
const review = new Set();
for (const { revision } of Object.values(profiles)) for (const pin of previous.files) {
  const entry = tree(revision).get(pin.file); assert(entry, 'Existing predecessor input removed by a parent: ' + pin.file);
  if (entry.mode !== pin.mode || entry.blob !== pin.blob) review.add(pin.file);
}
assert.deepEqual([...review].sort(), ECONOMY_DEED_MERGE_NATIVE_REVIEW_FILES,
  'Changed existing-native review scope must remain the two immutable parent scopes');
// Read predecessor objects in one bounded Git batch rather than thousands of helper processes.
const previousObjects = [...new Set(previous.files.map(pin => pin.blob))];
const batch = execFileSync('git', ['--no-replace-objects', 'cat-file', '--batch'],
  { input: previousObjects.join('\n') + '\n', windowsHide: true, maxBuffer: 256 * 1024 * 1024 });
let offset = 0;
for (const oid of previousObjects) {
  const end = batch.indexOf(10, offset); assert(end >= 0);
  const [got, type, count] = batch.subarray(offset, end).toString('ascii').split(' ');
  assert.equal(got, oid); assert.equal(type, 'blob'); const length = Number(count); assert(Number.isSafeInteger(length) && length >= 0);
  const value = batch.subarray(end + 1, end + 1 + length); assert.equal(value.length, length); assert.equal(batch[end + 1 + length], 10);
  contents.set(oid, value); offset = end + 2 + length;
}
assert.equal(offset, batch.length);
const provenanceRows = [];
for (const predecessor of previous.files) {
  assert.deepEqual(nativePin(previous.authoredRevision, predecessor.file), predecessor, 'Exact immutable predecessor Git pin required');
  const entry = tree(authored).get(predecessor.file); assert(entry, 'Existing native input cannot disappear');
  const current = entry.mode === predecessor.mode && entry.blob === predecessor.blob ? predecessor : nativePin(authored, predecessor.file);
  if (JSON.stringify(current) === JSON.stringify(predecessor)) continue;
  assert(ECONOMY_DEED_MERGE_NATIVE_REVIEW_FILES.includes(predecessor.file), 'Unreviewed changed existing native input: ' + predecessor.file);
  provenanceRows.push({ file: predecessor.file, current, predecessor });
}
// Definition ordering is bytewise, independent of host locale.
provenanceRows.sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
const provenance = { version: 1, status: 'SEALED', phase: 'EXACT_ECONOMY_DEED_MERGE_SOURCE_PROVENANCE_ONLY',
  sourceRevision: authored, sourceTree: source.sourceTree, predecessorRevision: previous.authoredRevision,
  predecessorDefinitionSha256: previousDefinitionSha256, predecessorMetadataSha256: sha(bytes(authored, previousPath)),
  reviewedFiles: [...ECONOMY_DEED_MERGE_NATIVE_REVIEW_FILES], files: provenanceRows,
  sourceOnly: true, nativeAdmission: false, priorResultsTransferred: false };
assert.equal(bytes(authored, previousPath).compare(bytes('b35dd222054f0c5f3ca814f228dd7d9a46c58ae9', 'tools/enterprise-native-ux-inputs.js')), 0,
  'The archived native manifest must remain the exact ordinary B35 Git input');
const preamble = '// Generated exact integration source/provenance only. No historical execution or native admission.\n'
  + 'const freeze = value => { if (value && typeof value === \'object\') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };\n';
fs.writeFileSync(output, preamble
  + 'export const ECONOMY_DEED_MERGE_SOURCE = freeze(' + JSON.stringify(source, null, 2) + ');\n'
  + 'export const ECONOMY_DEED_MERGE_SOURCE_SHA256 = ' + JSON.stringify(sha(JSON.stringify(source))) + ';\n'
  + 'export const ECONOMY_DEED_MERGE_NATIVE_PROVENANCE = freeze(' + JSON.stringify(provenance, null, 2) + ');\n'
  + 'export const ECONOMY_DEED_MERGE_NATIVE_PROVENANCE_SHA256 = ' + JSON.stringify(sha(JSON.stringify(provenance))) + ';\n');
console.log(JSON.stringify({ phase: 'EXACT_ECONOMY_DEED_MERGE_SOURCE_ONLY', sourceRevision: authored,
  profiles: Object.keys(profiles), files: source.files.length, provenanceFiles: provenanceRows.length,
  reviewedExistingNativeFiles: review.size, sourceOnly: true, nativeAdmission: false, priorResultsTransferred: false }));
