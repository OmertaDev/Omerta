// Bind only the exact suites parent120-to150 workflow change to a committed source checkpoint.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { UX_SOURCE } from './ux-source-data.js';
const revision = process.argv[2], targetRevision = 'c727d652c11780c699164bca321c872abdb8852a', file = '.github/workflows/ci.yml';
assert.equal(process.argv.length, 3); assert.match(revision || '', /^[a-f0-9]{40}$/); assert.notEqual(revision, targetRevision);
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
git('merge-base', '--is-ancestor', targetRevision, revision);
const before = '    timeout-minutes: 120\n    steps:\n      # The knowledge-plane gate inventories the full Git lineage (800+ commits) and\n', after = before.replace('120', '150');
const current = git('show', revision + ':' + file), target = git('show', targetRevision + ':' + file);
assert(!current.includes('\r') && !target.includes('\r')); assert(current.endsWith('\n') && target.endsWith('\n'));
assert.equal(target.split(before).length, 2); assert.equal(current, target.replace(before, after));
const prior = UX_SOURCE.files.find(row => row.file === file); assert.equal(sha(target), prior.currentSha256);
const record = rev => { const found = git('ls-tree', rev, '--', file).trim().match(/^(100644) blob ([a-f0-9]{40})\t(.+)$/); assert(found && found[3] === file); return { mode: found[1], blob: found[2] }; };
const inverses = []; let hunk;
for (const line of git('diff', '--no-ext-diff', '--unified=3', targetRevision, revision, '--', file).split('\n')) {
  if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; inverses.push(hunk); }
  else if (hunk && /^[ +\-]/.test(line)) { if (line[0] !== '-') hunk.current += line.slice(1) + '\n'; if (line[0] !== '+') hunk.baseline += line.slice(1) + '\n'; }
}
assert.equal(inverses.length, 1); assert.equal(current.split(inverses[0].current).length, 2); assert.equal(current.replace(inverses[0].current, () => inverses[0].baseline), target);
const authored = record(revision), predecessor = record(targetRevision); assert.equal(predecessor.blob, prior.currentBlob); assert.equal(authored.mode, predecessor.mode);
const row = { file, mode: authored.mode, targetMode: predecessor.mode, currentBlob: authored.blob, currentSha256: sha(current), currentRawSha256: { lf: sha(current), crlf: sha(current.replaceAll('\n', '\r\n')) }, currentBytes: Buffer.byteLength(current), targetBlob: predecessor.blob, targetSha256: sha(target), targetBytes: Buffer.byteLength(target), inverses };
const pin = { version: 1, status: 'SEALED', phase: 'EXACT_UX_WORKFLOW_PARENT_BOUND_SOURCE_ONLY', revision, tree: git('rev-parse', revision + '^{tree}').trim(), targetRevision, targetTree: git('rev-parse', targetRevision + '^{tree}').trim(), contextLines: 3, files: [row] };
fs.writeFileSync(new URL('./ux-workflow-bound-source-data.js', import.meta.url), '// Exact workflow-parent bound source envelope; source-only, no native/runtime/deployment clearance.\nconst freeze = value => { if (value && typeof value === \'object\') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };\nexport const UX_WORKFLOW_BOUND_SOURCE = freeze(' + JSON.stringify(pin, null, 2) + ');\nexport const UX_WORKFLOW_BOUND_SOURCE_SHA256 = ' + JSON.stringify(sha(JSON.stringify(pin))) + ';\n');
console.log(JSON.stringify({ revision, targetRevision, files: 1, inverseHunks: 1, sourceOnly: true, parentBoundMinutes: 150, guardRevisionStamp: revision }));
