// Explicit maintainer command for one reviewed UI commit. Never run by tests, guards or runtime.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { NOIR_UI_SOURCE_FILES, NOIR_UI_SOURCE_PREDECESSOR } from './noir-ui-source-transfer.js';

// Set only to the reviewed authored UI commit, after its complete source is committed.
const revision = '42d9df7628a30653ff7c8bac203b7bd317dee597';
const predecessor = NOIR_UI_SOURCE_PREDECESSOR;
const predecessorTree = '52d4304d3f5bef427a45af85dffacaef6f7c6bd1';
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], {
  encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
});
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
const record = (ref, file) => {
  const match = git('ls-tree', ref, '--', file).trim().match(/^(100644|100755) blob ([a-f0-9]{40})\t/);
  if (!match) return null;
  const raw = execFileSync('git', ['--no-replace-objects', 'show', `${ref}:${file}`], { maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  const text = raw.toString('utf8');
  assert(Buffer.from(text).equals(raw), `Lossless committed UTF-8 required: ${file}`);
  assert(!text.includes('\r') && !text.includes('\0') && !text.includes('\ufeff'), `Canonical committed LF source required: ${file}`);
  assert.equal(blob(text), match[2]);
  return { mode: match[1], blob: match[2], text, sha256: sha(text), bytes: Buffer.byteLength(text) };
};
const inverseHunks = diff => {
  const rows = []; let hunk;
  for (const line of diff.split('\n')) {
    if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; rows.push(hunk); }
    else if (hunk && /^[ +\-]/.test(line)) {
      if (line[0] !== '-') hunk.current += `${line.slice(1)}\n`;
      if (line[0] !== '+') hunk.baseline += `${line.slice(1)}\n`;
    }
  }
  return rows;
};

assert.deepEqual(process.argv.slice(2), ['--write'], 'Use --write only for the fixed reviewed noir UI commit');
assert.equal(typeof revision, 'string', 'The reviewed noir UI commit has not been supplied');
assert.match(revision, /^[a-f0-9]{40}$/);
assert.equal(git('rev-parse', `${predecessor}^{tree}`).trim(), predecessorTree);
assert.equal(git('rev-parse', `${revision}^`).trim(), predecessor, 'Authored noir UI predecessor changed');
git('merge-base', '--is-ancestor', revision, 'HEAD');
assert.deepEqual(git('diff', '--no-ext-diff', '--name-only', predecessor, revision).trim().split('\n').sort(),
  [...NOIR_UI_SOURCE_FILES].sort(), 'Reviewed UI commit changed outside its exact fourteen source domains');
const files = NOIR_UI_SOURCE_FILES.map(file => {
  const current = record(revision, file), baseline = record(predecessor, file);
  assert(current, `Committed regular noir UI file required: ${file}`);
  const common = { file, mode: current.mode, currentBlob: current.blob, currentSha256: current.sha256,
    currentBytes: current.bytes, currentRawSha256: { lf: current.sha256, crlf: sha(current.text.replaceAll('\n', '\r\n')) } };
  if (!baseline) {
    assert.equal(file, 'test/ux-shell-browser.js', 'Only the new shell regression may be added');
    return { ...common, predecessorAbsent: true, inverses: [] };
  }
  assert.equal(current.mode, baseline.mode, `File mode unchanged: ${file}`);
  assert.notEqual(current.blob, baseline.blob, `Reviewed UI domain has no change: ${file}`);
  const inverses = inverseHunks(git('diff', '--no-ext-diff', '--unified=3', predecessor, revision, '--', file));
  assert(inverses.length > 0);
  let restored = current.text, end = -1;
  for (const inverse of inverses) {
    assert(inverse.current.length); assert.equal(current.text.split(inverse.current).length, 2, `Unique inverse context: ${file}`);
    const at = current.text.indexOf(inverse.current); assert(at >= end); end = at + inverse.current.length;
    assert.equal(restored.split(inverse.current).length, 2);
    restored = restored.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(restored, baseline.text, `Complete UI predecessor reconstruction: ${file}`);
  return { ...common, predecessorAbsent: false, predecessorMode: baseline.mode,
    predecessorBlob: baseline.blob, predecessorSha256: baseline.sha256, predecessorBytes: baseline.bytes, inverses };
});
const data = { version: 1, status: 'SEALED', phase: 'EXACT_NOIR_UI_SOURCE_ONLY', revision,
  tree: git('rev-parse', `${revision}^{tree}`).trim(), predecessor, predecessorTree, contextLines: 3, files };
const digest = sha(JSON.stringify(data));
const output = '// Generated finite noir UI source-only envelope. No historical runtime/native/deployment clearance.\n'
  + 'const freeze = value => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };\n'
  + `export const NOIR_UI_SOURCE = freeze(${JSON.stringify(data, null, 2)});\n`
  + `export const NOIR_UI_SOURCE_SHA256 = ${JSON.stringify(digest)};\n`;
const destination = new URL('./noir-ui-source-data.js', import.meta.url), temporary = new URL('./noir-ui-source-data.js.tmp', import.meta.url);
fs.writeFileSync(temporary, output); fs.renameSync(temporary, destination);
console.log(JSON.stringify({ phase: data.phase, revision, predecessor, files: files.length, digest, runtime: false, native: false }));
