// Authors a finite source-only record from one real immutable fix commit. Never a native capture.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { UX_DIRECTOR_READER_SOURCE_FILES } from './ux-director-reader-source-compatibility.js';
assert.equal(process.argv.length, 3, 'Pass the full authored fix commit');
const revision = process.argv[2], targetRevision = '8b6c4f73e691e9ab6518f1539da464d1af17026f';
assert.match(revision, /^[a-f0-9]{40}$/); assert.notEqual(revision, targetRevision);
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
git('merge-base', '--is-ancestor', targetRevision, revision);
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const blob = value => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(value) + '\0').update(value).digest('hex');
function source(rev, file) {
  const line = git('ls-tree', rev, '--', file).trim(), match = /^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/.exec(line); assert(match && match[3] === file);
  const text = git('show', rev + ':' + file); assert(!/[\r\ufeff\0]/.test(text), 'Canonical LF UTF-8 source only'); assert.equal(blob(text), match[2]);
  return { text, mode: match[1], blob: match[2] };
}
function inverseHunks(diff) {
  const rows = []; let hunk;
  for (const line of diff.split('\n')) {
    if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; rows.push(hunk); }
    else if (hunk && /^[ +\-]/.test(line)) { if (line[0] !== '-') hunk.current += line.slice(1) + '\n'; if (line[0] !== '+') hunk.baseline += line.slice(1) + '\n'; }
    else assert(!line.startsWith('\\ No newline'), 'Complete newline-terminated sources only');
  }
  return rows;
}
const files = UX_DIRECTOR_READER_SOURCE_FILES.map(file => {
  const current = source(revision, file), target = source(targetRevision, file);
  const originalImport = "from '../tools/commerce-deed-release-phase2-native-catalog.js';", currentImport = "from '../tools/ux-release-phase2-native-catalog.js';";
  assert.equal(target.text, source('c6247976ff71e8d4c103ebd1498c2d373217d077', file).text, 'The complete original Director test is preserved');
  assert.equal(target.text.split(originalImport).length, 2);
  assert.equal(current.text, target.text.replace(originalImport, currentImport), 'Only the exact Director import may change');
  assert.equal(current.mode, target.mode);
  assert.notEqual(current.text, target.text, 'Every declared reader source must actually change');
  const inverses = inverseHunks(git('diff', '--no-ext-diff', '--unified=3', targetRevision, revision, '--', file));
  assert.equal(inverses.length, 1);
  let restored = current.text, end = -1;
  for (const inverse of inverses) { assert(inverse.current.length); assert.equal(current.text.split(inverse.current).length, 2); const at = current.text.indexOf(inverse.current); assert(at >= end); end = at + inverse.current.length; assert.equal(restored.split(inverse.current).length, 2); restored = restored.replace(inverse.current, () => inverse.baseline); }
  assert.equal(restored, target.text);
  return { file, mode: current.mode, targetMode: target.mode, currentBlob: current.blob, currentSha256: sha(current.text), currentRawSha256: { lf: sha(current.text), crlf: sha(current.text.replaceAll('\n', '\r\n')) }, currentBytes: Buffer.byteLength(current.text), targetBlob: target.blob, targetSha256: sha(target.text), targetBytes: Buffer.byteLength(target.text), inverses };
});
const pin = { version: 1, status: 'SEALED', phase: 'EXACT_UX_DIRECTOR_READER_SOURCE_ONLY', revision, tree: git('rev-parse', revision + '^{tree}').trim(), targetRevision, targetTree: git('rev-parse', targetRevision + '^{tree}').trim(), contextLines: 3, files };
const freeze = "const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };\n";
const proofPath = new URL('../test/lib/ux-director-reader-source-compatibility.js', import.meta.url), proof = fs.readFileSync(proofPath, 'utf8');
const unsealedProofPin = "const AUTHORED_DIRECTOR_READER_FIX = 'UNSEALED';", sealedProofPin = "const AUTHORED_DIRECTOR_READER_FIX = '" + revision + "';";
assert(proof.includes(unsealedProofPin) || proof.includes(sealedProofPin), 'Independent source proof is already pinned to a different fix');
fs.writeFileSync(new URL('./ux-director-reader-source-data.js', import.meta.url), '// Exact immutable Director reader successor. Source-only; no native or runtime admission.\n' + freeze + 'export const UX_DIRECTOR_READER_SOURCE = freeze(' + JSON.stringify(pin, null, 2) + ');\nexport const UX_DIRECTOR_READER_SOURCE_SHA256 = ' + JSON.stringify(sha(JSON.stringify(pin))) + ';\n');
if (proof.includes(unsealedProofPin)) fs.writeFileSync(proofPath, proof.replace(unsealedProofPin, sealedProofPin));
console.log(JSON.stringify({ sourceOnly: true, revision, predecessor: targetRevision, files: files.length, inverseHunks: files.reduce((total, row) => total + row.inverses.length, 0), native: false, runtime: false }));
