// Bind the sale-page readers and required release fixture correction to an authored commit.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { SALE_SOURCE_FILES, SALE_SOURCE_PREDECESSOR } from './sale-source-compatibility.js';
const revision = process.argv[2], targetRevision = SALE_SOURCE_PREDECESSOR;
assert.equal(process.argv.length, 3, 'Usage: node tools/sale-source-seal.js <40-character authored commit>');
assert.match(revision || '', /^[a-f0-9]{40}$/); assert.notEqual(revision, targetRevision);
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
git('merge-base', '--is-ancestor', targetRevision, revision);
const record = (rev, file) => {
  const match = git('ls-tree', rev, '--', file).trim().match(/^(100644) blob ([a-f0-9]{40})\t(.+)$/);
  assert(match && match[3] === file, 'Actual committed regular sale input: ' + file);
  return { mode: match[1], blob: match[2] };
};
const files = SALE_SOURCE_FILES.map(file => {
  const current = git('show', revision + ':' + file), target = git('show', targetRevision + ':' + file);
  assert(!current.includes('\r') && !target.includes('\r'), 'Canonical Git source uses LF');
  assert(current.endsWith('\n') && target.endsWith('\n'), 'Complete newline-terminated source required');
  const inverses = []; let hunk;
  for (const line of git('diff', '--no-ext-diff', '--unified=3', targetRevision, revision, '--', file).split('\n')) {
    if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; inverses.push(hunk); }
    else if (hunk && /^[ +\-]/.test(line)) { if (line[0] !== '-') hunk.current += line.slice(1) + '\n'; if (line[0] !== '+') hunk.baseline += line.slice(1) + '\n'; }
  }
  assert(inverses.length, 'Only changed sale readers belong in this source envelope: ' + file);
  let restored = current;
  for (const inverse of inverses) { assert.equal(restored.split(inverse.current).length, 2); restored = restored.replace(inverse.current, () => inverse.baseline); }
  assert.equal(restored, target, 'Whole immutable predecessor must be restored');
  const authored = record(revision, file), predecessor = record(targetRevision, file);
  return { file, mode: authored.mode, targetMode: predecessor.mode, currentBlob: authored.blob, currentSha256: sha(current), currentRawSha256: { lf: sha(current), crlf: sha(current.replaceAll('\n', '\r\n')) }, currentBytes: Buffer.byteLength(current), targetBlob: predecessor.blob, targetSha256: sha(target), targetBytes: Buffer.byteLength(target), inverses };
});
const pin = { version: 1, status: 'SEALED', phase: 'EXACT_SALE_PAGE_SOURCE_ONLY', revision, tree: git('rev-parse', revision + '^{tree}').trim(), targetRevision, targetTree: git('rev-parse', targetRevision + '^{tree}').trim(), contextLines: 3, files };
fs.writeFileSync(new URL('./sale-source-data.js', import.meta.url), '// Exact authored sale-page successor. Source-only; no runtime/native/deployment clearance.\nconst freeze = value => { if (value && typeof value === \'object\') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };\nexport const SALE_SOURCE = freeze(' + JSON.stringify(pin, null, 2) + ');\nexport const SALE_SOURCE_SHA256 = ' + JSON.stringify(sha(JSON.stringify(pin))) + ';\n');
console.log(JSON.stringify({ revision, targetRevision, files: files.length, inverseHunks: files.reduce((sum, row) => sum + row.inverses.length, 0), sourceOnly: true, native: false, runtime: false }));
