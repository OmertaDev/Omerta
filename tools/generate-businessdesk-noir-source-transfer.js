// Explicit maintainer binding for one authored combined revision. Never invoked by tests/runtime.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { BUSINESS_DESK_NOIR_SOURCE_FILES, BUSINESS_DESK_NOIR_REVISION, BUSINESS_DESK_NOIR_TREE,
  BUSINESS_DESK_NOIR_BUSINESS_REVISION, BUSINESS_DESK_NOIR_BUSINESS_TREE } from './businessdesk-noir-source-transfer.js';

const revision = process.argv[2];
assert.equal(process.argv.length, 4, 'Usage: node tools/generate-businessdesk-noir-source-transfer.js <authored-full-SHA> --write');
assert.equal(process.argv[3], '--write'); assert.match(revision || '', /^[a-f0-9]{40}$/);
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
const text = (...args) => git(...args).toString('utf8');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const blob = bytes => crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
assert.equal(text('rev-parse', 'HEAD').trim(), revision, 'Bind only the current exact authored revision');
assert.equal(text('status', '--porcelain', '--untracked-files=no').trim(), '', 'Commit all authored source before binding');
for (const [target, tree] of [[BUSINESS_DESK_NOIR_REVISION, BUSINESS_DESK_NOIR_TREE], [BUSINESS_DESK_NOIR_BUSINESS_REVISION, BUSINESS_DESK_NOIR_BUSINESS_TREE]]) {
  assert.equal(text('rev-parse', `${target}^{tree}`).trim(), tree, 'Fixed Desk/Noir target tree');
  git('merge-base', '--is-ancestor', target, revision);
}
const record = (rev, file) => {
  const line = text('ls-tree', '-z', rev, '--', file), match = line.match(/^(100644) blob ([a-f0-9]{40})\t([^\0]+)\0$/);
  assert(match && match[3] === file, 'Committed regular Desk/Noir source required: ' + file);
  const bytes = git('show', `${rev}:${file}`), source = bytes.toString('utf8');
  assert(Buffer.from(source).equals(bytes), 'Lossless committed UTF-8 source');
  assert(!source.includes('\r') && !source.includes('\0') && !source.includes('\ufeff'), 'Canonical committed LF source');
  assert.equal(blob(bytes), match[2]);
  return { mode: match[1], blob: match[2], sha256: sha(bytes), bytes: bytes.length, text: source };
};
const inverses = diff => {
  const result = []; let hunk;
  for (const line of diff.split('\n')) {
    if (line.startsWith('@@')) { hunk = { current: '', target: '' }; result.push(hunk); }
    else if (hunk && /^[ +\-]/.test(line)) {
      if (line[0] !== '-') hunk.current += line.slice(1) + '\n';
      if (line[0] !== '+') hunk.target += line.slice(1) + '\n';
    }
  }
  return result;
};
const files = BUSINESS_DESK_NOIR_SOURCE_FILES.map((file, index) => {
  const targetKind = index < 4 ? 'noir' : 'business';
  const targetRevision = index < 4 ? BUSINESS_DESK_NOIR_REVISION : BUSINESS_DESK_NOIR_BUSINESS_REVISION;
  const current = record(revision, file), target = record(targetRevision, file);
  assert.equal(current.mode, target.mode); assert.notEqual(current.blob, target.blob, 'Every integration source domain must change');
  const contexts = inverses(text('diff', '--no-ext-diff', '--unified=3', targetRevision, revision, '--', file));
  assert(contexts.length > 0); let restored = current.text, end = -1;
  for (const inverse of contexts) {
    assert(inverse.current.length); assert.equal(current.text.split(inverse.current).length, 2, 'Unique committed inverse context');
    const offset = current.text.indexOf(inverse.current); assert(offset >= end, 'Ordered nonoverlapping committed inverses');
    end = offset + inverse.current.length;
    assert.equal(restored.split(inverse.current).length, 2);
    restored = restored.replace(inverse.current, () => inverse.target);
  }
  assert.equal(restored, target.text, 'Complete exact target reconstruction: ' + file);
  return { file, targetKind, targetRevision, mode: current.mode, currentBlob: current.blob,
    currentSha256: current.sha256, currentBytes: current.bytes,
    currentRawSha256: { lf: current.sha256, crlf: sha(Buffer.from(current.text.replaceAll('\n', '\r\n'))) },
    targetMode: target.mode, targetBlob: target.blob, targetSha256: target.sha256, targetBytes: target.bytes, inverses: contexts };
});
const data = { version: 1, status: 'SEALED', phase: 'EXACT_BUSINESS_DESK_NOIR_SOURCE_ONLY', revision,
  tree: text('rev-parse', `${revision}^{tree}`).trim(), contextLines: 3, files };
const digest = sha(Buffer.from(JSON.stringify(data)));
const output = '// Exact combined Desk/Noir source-only catalog. No runtime/native/deployment admission.\n'
  + "const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };\n"
  + `export const BUSINESS_DESK_NOIR_SOURCE = freeze(${JSON.stringify(data, null, 2)});\n`
  + `export const BUSINESS_DESK_NOIR_SOURCE_SHA256 = ${JSON.stringify(digest)};\n`;
const destination = new URL('./businessdesk-noir-source-data.js', import.meta.url);
const temporary = new URL('./businessdesk-noir-source-data.js.tmp', import.meta.url);
fs.writeFileSync(temporary, output, { flag: 'wx' }); fs.renameSync(temporary, destination);
console.log(JSON.stringify({ phase: data.phase, revision, files: files.length, digest, sourceOnly: true, runtime: false, native: false }));
