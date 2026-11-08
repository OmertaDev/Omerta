// Seal only whole committed sources against the production predecessor; never grants execution.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { questQualitySourceDataBytes } from './quest-quality-source-transfer.js';

const predecessor = '7c63a604dc0d2b8a39bc9eb845c4dcb97aa707e9';
const excluded = new Set(['tools/quest-quality-source-data.js', 'tools/enterprise-native-questing-inputs.js']);
const git = (...args) => execFileSync('git', ['--no-optional-locks', '--no-replace-objects', ...args], {
  encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024,
});
const sha = text => createHash('sha256').update(text).digest('hex');
const regular = (revision, file) => {
  const match = git('ls-tree', revision, '--', file).trim().match(/^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/);
  assert(match && match[3] === file, 'Regular committed source required: ' + file);
  const text = git('show', revision + ':' + file);
  assert(!/[\r\0\ufeff]/.test(text), 'Committed whole UTF-8 LF text only: ' + file);
  return { text, pin: { mode: match[1], blob: match[2], sha256: sha(text), bytes: Buffer.byteLength(text) } };
};
const scope = file => file === 'SPEC.md' || file === 'MARKETING-POSTS.md' || file === 'package.json' || file === 'schema.sql'
  || file === '.github/workflows/ci.yml' || /^(?:src|test|tools|public|content\/packs)\//.test(file);
function inverses(current, diff) {
  const rows = []; let row;
  const starts = [0]; for (let at = 0; at < current.length; at++) if (current[at] === '\n') starts.push(at + 1);
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
assert.equal(process.argv.length, 3, 'Usage: node tools/quest-quality-source-seal.js <clean-authored-commit>');
const revision = process.argv[2]; assert.match(revision || '', /^[a-f0-9]{40}$/);
assert.equal(git('rev-parse', 'HEAD').trim(), revision);
assert.equal(git('status', '--porcelain', '--untracked-files=all').trim(), '', 'Commit all reviewed quest quality source before sealing');
git('merge-base', '--is-ancestor', predecessor, revision);
const changed = git('diff', '--name-only', '--diff-filter=M', '-z', predecessor, revision).split('\0').filter(file => scope(file) && !excluded.has(file));
const added = git('diff', '--name-only', '--diff-filter=A', '-z', predecessor, revision).split('\0')
  .filter(file => scope(file) && !excluded.has(file) && /\.(?:js|json|html|css|sql)$/.test(file));
const value = { status: 'SEALED', phase: 'EXACT_QUEST_QUALITY_SOURCE_COMPARISON_ONLY', revision,
  tree: git('rev-parse', revision + '^{tree}').trim(), predecessor,
  predecessorTree: git('rev-parse', predecessor + '^{tree}').trim(), files: {}, additions: {} };
for (const file of changed) {
  const before = regular(predecessor, file), after = regular(revision, file);
  const rows = inverses(after.text, git('diff', '--no-ext-diff', '--unified=3', predecessor, revision, '--', file));
  let restored = after.text;
  for (const row of rows.toReversed()) {
    assert.equal(restored.slice(row.at, row.at + row.current.length), row.current, file);
    restored = restored.slice(0, row.at) + row.baseline + restored.slice(row.at + row.current.length);
  }
  assert.equal(restored, before.text, 'Whole predecessor inverse: ' + file);
  value.files[file] = { current: after.pin, baseline: before.pin, inverses: rows };
}
for (const file of added) value.additions[file] = regular(revision, file).pin;
fs.writeFileSync(new URL('./quest-quality-source-data.js', import.meta.url), questQualitySourceDataBytes(value));
console.log(JSON.stringify({ authoredRevision: revision, comparisonDomains: changed.length, additions: added.length,
  sourceOnly: true, nativeExecution: false, priorResultsTransferred: false }));
