// Explicit maintainer operation only. Tests never regenerate historical comparison evidence.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { BUSINESS_DESK_COMBINED_PROFILES, BUSINESS_DESK_COMBINED_SOURCE_FILES,
  BUSINESS_DESK_COMBINED_EXCLUDED_FILES, BUSINESS_DESK_COMBINED_PHASE,
  businessDeskCombinedReaderFiles } from './businessdesk-combined-source-transfer.js';

const revision = process.argv[2];
assert.match(revision || '', /^[a-f0-9]{40}$/, 'Explicit full authored revision required');
assert.deepEqual(process.argv.slice(2), [revision, '--write'], 'Usage: node tools/generate-businessdesk-combined-source.js <clean-current-full-authored-sha> --write');
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { cwd: root, windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
const text = (...args) => git(...args).toString('utf8');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const blob = value => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(value)}\0`).update(value).digest('hex');
assert.equal(text('rev-parse', 'HEAD').trim(), revision, 'Only the current authored commit may be bound');
assert.equal(text('status', '--porcelain', '--untracked-files=normal'), '', 'Require a clean authored checkout before binding');
assert.equal(path.resolve(text('rev-parse', '--show-toplevel').trim()), root, 'Generator belongs to this explicit checkout');
for (const profile of Object.values(BUSINESS_DESK_COMBINED_PROFILES)) {
  assert.equal(text('rev-parse', `${profile.revision}^{tree}`).trim(), profile.tree, 'Frozen parent tree drift');
  git('merge-base', '--is-ancestor', profile.revision, revision);
}
const record = (rev, file) => {
  const line = text('ls-tree', '-z', rev, '--', file);
  if (!line) return null;
  const match = line.match(/^(100644|100755) blob ([a-f0-9]{40})\t([^\0]+)\0$/);
  assert(match && match[3] === file, 'Regular committed comparison input required: ' + file);
  const raw = git('show', `${rev}:${file}`), content = raw.toString('utf8');
  assert(Buffer.from(content).equals(raw), 'Lossless actual Git source required: ' + file);
  assert(!content.includes('\r') && !content.includes('\ufeff') && !content.includes('\0'), 'Canonical authored LF source required: ' + file);
  assert.equal(blob(raw), match[2]);
  return { content, pin: { mode: match[1], blob: match[2], sha256: sha(raw), bytes: raw.length,
    rawSha256: { lf: sha(raw), crlf: sha(content.replaceAll('\n', '\r\n')) } } };
};
const inverses = diff => {
  const rows = []; let hunk, prior;
  for (const line of diff.split('\n')) {
    if (line.startsWith('@@ ')) { hunk = { current: '', target: '' }; rows.push(hunk); }
    else if (hunk && line.startsWith('\\ No newline at end of file')) {
      if (prior !== '-') hunk.current = hunk.current.slice(0, -1);
      if (prior !== '+') hunk.target = hunk.target.slice(0, -1);
    } else if (hunk && /^[ +\-]/.test(line)) {
      prior = line[0];
      if (prior !== '-') hunk.current += line.slice(1) + '\n';
      if (prior !== '+') hunk.target += line.slice(1) + '\n';
    }
  }
  return rows;
};
const readers = Object.fromEntries(Object.keys(BUSINESS_DESK_COMBINED_PROFILES).map(profile => [profile, new Set(businessDeskCombinedReaderFiles(profile))]));
const files = [];
for (const file of BUSINESS_DESK_COMBINED_SOURCE_FILES) {
  assert(!BUSINESS_DESK_COMBINED_EXCLUDED_FILES.includes(file), 'Never project current or archived native metadata');
  const current = record(revision, file); assert(current, 'Preserve every bounded current reader input: ' + file);
  const parents = {};
  for (const [profile, parent] of Object.entries(BUSINESS_DESK_COMBINED_PROFILES)) {
    if (!readers[profile].has(file)) continue;
    const target = record(parent.revision, file);
    if (!target || (target.pin.mode === current.pin.mode && target.pin.blob === current.pin.blob)) continue;
    const hunks = inverses(text('diff', '--no-ext-diff', '--no-renames', '--unified=8', parent.revision, revision, '--', file));
    let restored = current.content, end = -1;
    for (const hunk of hunks) {
      assert(hunk.current.length && current.content.split(hunk.current).length === 2, 'Unique complete context-eight inverse required: ' + file);
      const at = current.content.indexOf(hunk.current); assert(at >= end, 'Ordered nonoverlapping inverse required: ' + file); end = at + hunk.current.length;
      assert.equal(restored.split(hunk.current).length, 2); restored = restored.replace(hunk.current, () => hunk.target);
    }
    assert.equal(restored, target.content, 'Complete actual parent reconstruction required: ' + file);
    parents[profile] = { ...target.pin, inverses: hunks };
  }
  if (Object.keys(parents).length) files.push({ file, current: current.pin, parents });
}
assert(files.length > 0, 'An integration with changed comparison inputs is required');
const value = { version: 1, status: 'SEALED', phase: BUSINESS_DESK_COMBINED_PHASE,
  sourceRevision: revision, sourceTree: text('rev-parse', `${revision}^{tree}`).trim(), contextLines: 8,
  profiles: BUSINESS_DESK_COMBINED_PROFILES, files, sourceOnly: true, runtime: false, native: false };
const hash = sha(JSON.stringify(value));
const output = '// Generated exact comparison views only; no runtime, native or release-result transfer.\n'
  + "const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };\n"
  + `export const BUSINESS_DESK_COMBINED_SOURCE = freeze(${JSON.stringify(value, null, 2)});\n`
  + `export const BUSINESS_DESK_COMBINED_SOURCE_SHA256 = '${hash}';\n`;
fs.writeFileSync(new URL('./businessdesk-combined-source-data.js', import.meta.url), output);
console.log(JSON.stringify({ phase: value.phase, sourceRevision: revision, sourceTree: value.sourceTree,
  files: files.length, profileEdges: files.reduce((sum, row) => sum + Object.keys(row.parents).length, 0),
  inverseHunks: files.reduce((sum, row) => sum + Object.values(row.parents).reduce((total, parent) => total + parent.inverses.length, 0), 0),
  definitionSha256: hash, onlyWritten: 'tools/businessdesk-combined-source-data.js', sourceOnly: true, runtime: false, native: false }));
