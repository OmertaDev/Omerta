// Explicit maintainer invocation on a clean reviewed candidate only. No prior results are transferred.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { NATIVE_GARAGE_PREDECESSOR as predecessor, NATIVE_GARAGE_SCOPE,
  NATIVE_GARAGE_GENERATED_FILES, nativeGarageSourceDataBytes } from './native-garage-source-transfer.js';
const metadata = 'tools/native-garage-source-data.js';
const excluded = new Set(NATIVE_GARAGE_GENERATED_FILES);
const allowed = new Set(NATIVE_GARAGE_SCOPE);
const git = (...args) => execFileSync('git', ['--no-optional-locks', '--no-replace-objects', ...args], {
  encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024,
});
const sha = input => createHash('sha256').update(input).digest('hex');
function regular(revision, file) {
  const row = git('ls-tree', revision, '--', file).trim().match(/^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/);
  assert(row && row[3] === file, 'Regular committed reviewed source required: ' + file);
  const raw = execFileSync('git', ['--no-replace-objects', 'show', revision + ':' + file], {
    windowsHide: true, maxBuffer: 64 * 1024 * 1024,
  });
  return { raw, pin: { mode: row[1], blob: row[2], sha256: sha(raw), bytes: raw.length } };
}
function text(raw) {
  const value = raw.toString('utf8');
  assert(Buffer.from(value).equals(raw) && !/[\r\0\ufeff]/.test(value) && value.endsWith('\n'),
    'Whole canonical LF UTF-8 source with a final newline');
  return value;
}
function inverses(current, diff) {
  const rows = [], starts = [0]; let row;
  for (let at = 0; at < current.length; at++) if (current[at] === '\n') starts.push(at + 1);
  for (const line of diff.split('\n')) {
    const match = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (match) { row = { at: starts[Number(match[1]) - 1] ?? 0, current: '', baseline: '' }; rows.push(row); }
    else if (row && /^[ +\-]/.test(line)) {
      if (line[0] !== '-') row.current += line.slice(1) + '\n';
      if (line[0] !== '+') row.baseline += line.slice(1) + '\n';
    }
  }
  assert(rows.length); return rows;
}
assert.equal(process.argv.length, 3, 'Usage: node tools/native-garage-source-seal.js <clean-reviewed-candidate>');
const revision = process.argv[2]; assert.match(revision || '', /^[a-f0-9]{40}$/);
assert.equal(git('rev-parse', 'HEAD').trim(), revision);
assert.equal(git('status', '--porcelain', '--untracked-files=all').trim(), '', 'Commit every reviewed candidate input before sealing');
git('merge-base', '--is-ancestor', predecessor, revision);
const changes = git('diff', '--name-status', '--no-renames', predecessor, revision).trim().split('\n')
  .filter(Boolean).map(line => line.split('\t')).filter(([, file]) => !excluded.has(file));
assert.deepEqual(changes.map(([, file]) => file).sort(),
  NATIVE_GARAGE_SCOPE.filter(file => file !== metadata), 'The candidate contains exactly the finite reviewed release and proof domains');
assert(changes.every(([status, file]) => ['M', 'A'].includes(status) && allowed.has(file)), 'No unknown changes, deletion, rename or type replacement');
const value = { status: 'SEALED', phase: 'EXACT_NATIVE_GARAGE_SOURCE_COMPARISON_ONLY', revision,
  tree: git('rev-parse', revision + '^{tree}').trim(), predecessor,
  predecessorTree: git('rev-parse', predecessor + '^{tree}').trim(), files: {}, additions: {} };
for (const [status, file] of changes) {
  const after = regular(revision, file);
  if (status === 'A') {
    const isText = /\.(?:js|json|html|css|md|log|sha256|exit)$/.test(file);
    if (isText) text(after.raw);
    value.additions[file] = { ...after.pin, text: isText }; continue;
  }
  const before = regular(predecessor, file), current = text(after.raw), baseline = text(before.raw);
  const rows = inverses(current, git('diff', '--no-ext-diff', '--unified=3', predecessor, revision, '--', file));
  let restored = current;
  for (const row of rows.toReversed()) {
    assert.equal(restored.slice(row.at, row.at + row.current.length), row.current, file);
    restored = restored.slice(0, row.at) + row.baseline + restored.slice(row.at + row.current.length);
  }
  assert.equal(restored, baseline, 'Complete independently authored predecessor reconstruction: ' + file);
  value.files[file] = { current: after.pin, baseline: before.pin, inverses: rows };
}
fs.writeFileSync(metadata, nativeGarageSourceDataBytes(value));
console.log(JSON.stringify({ authoredRevision: revision, modified: Object.keys(value.files).length,
  additions: Object.keys(value.additions).length, sourceOnly: true, runtime: false, native: false,
  financial: false, deployment: false, priorResultsTransferred: false }));
