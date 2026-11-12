// Explicit maintainer generation only; never invoked by runtime or a source guard.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { uiTrimSourceDataBytes } from './ui-trim-source-transfer.js';

const predecessor = '42e7c7648d74bbdd1cd38da0f3f61a72a7abc831';
const metadata = 'tools/ui-trim-source-data.js';
// Only this newly generated comparison is self-referential. Historical data is never resealed.
const generated = new Set([metadata]);
const allowed = new Set([
  'package.json', 'public/index.html', 'public/noir-shell.js', 'public/noir-ui.css',
  'public/ux-social.js', 'public/ux-tools.js', 'public/ux-world.js',
  'test/ui-trim-browser.js', 'test/ux-expanded-browser.js', 'test/ux-social-browser.js', 'test/ux-tools-browser.js',
  'tools/age-removal-source-transfer.js', 'test/lib/age-removal-source-transfer-proof.js',
  'test/noir-ui-source-compatibility.js', 'test/ui-trim-source-transfer.js',
  'tools/ui-trim-source-transfer.js', 'tools/ui-trim-source-seal.js',
]);
const git = (...args) => execFileSync('git', ['--no-optional-locks', '--no-replace-objects', ...args], {
  encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024,
});
const sha = text => createHash('sha256').update(text).digest('hex');
function regular(revision, file) {
  const match = git('ls-tree', revision, '--', file).trim().match(/^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/);
  assert(match && match[3] === file, 'Regular committed source required: ' + file);
  const text = git('show', revision + ':' + file);
  assert(!/[\r\0\ufeff]/.test(text), 'Whole committed LF UTF-8 source required');
  return { text, pin: { mode: match[1], blob: match[2], sha256: sha(text), bytes: Buffer.byteLength(text) } };
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
assert.equal(process.argv.length, 3, 'Usage: node tools/ui-trim-source-seal.js <clean-reviewed-commit>');
const revision = process.argv[2]; assert.match(revision || '', /^[a-f0-9]{40}$/);
assert.equal(git('rev-parse', 'HEAD').trim(), revision);
assert.equal(git('status', '--porcelain', '--untracked-files=all').trim(), '', 'Commit all reviewed ui-trim source before sealing');
git('merge-base', '--is-ancestor', predecessor, revision);
const changed = git('diff', '--name-status', '--no-renames', predecessor, revision).trim().split('\n')
  .filter(Boolean).map(line => line.split('\t')).filter(([, file]) => !generated.has(file));
assert(changed.length && changed.every(([status, file]) => ['M', 'A'].includes(status) && allowed.has(file)),
  'Only the reviewed closed ui-trim source scope; no deletions or unrelated changes');
const value = { status: 'SEALED', phase: 'EXACT_UI_TRIM_SOURCE_COMPARISON_ONLY', revision,
  tree: git('rev-parse', revision + '^{tree}').trim(), predecessor,
  predecessorTree: git('rev-parse', predecessor + '^{tree}').trim(), files: {}, additions: {} };
for (const [status, file] of changed) {
  const after = regular(revision, file);
  if (status === 'A') { value.additions[file] = after.pin; continue; }
  const before = regular(predecessor, file), rows = inverses(after.text,
    git('diff', '--no-ext-diff', '--unified=3', predecessor, revision, '--', file));
  let restored = after.text;
  for (const row of rows.toReversed()) {
    assert.equal(restored.slice(row.at, row.at + row.current.length), row.current, file);
    restored = restored.slice(0, row.at) + row.baseline + restored.slice(row.at + row.current.length);
  }
  assert.equal(restored, before.text, 'Whole reviewed predecessor reconstruction: ' + file);
  value.files[file] = { current: after.pin, baseline: before.pin, inverses: rows };
}
fs.writeFileSync(new URL('./ui-trim-source-data.js', import.meta.url), uiTrimSourceDataBytes(value));
console.log(JSON.stringify({ authoredRevision: revision, comparisonDomains: Object.keys(value.files).length,
  additions: Object.keys(value.additions).length, sourceOnly: true, nativeExecution: false, priorResultsTransferred: false }));
