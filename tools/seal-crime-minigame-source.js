// Seal only the generated comparison data after committing the authored candidate.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { CRIME_MINIGAME_PREDECESSOR, CRIME_MINIGAME_GENERATED_FILES,
  crimeMinigameSourceDataBytes } from './crime-minigame-source-compatibility.js';

assert.equal(process.argv.length, 3, 'Supply the fixed committed authored candidate revision');
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], {
  encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024,
});
const revision = git('rev-parse', process.argv[2]).trim(), predecessor = git('rev-parse', CRIME_MINIGAME_PREDECESSOR).trim();
assert.equal(git('rev-parse', 'HEAD').trim(), revision, 'Seal the exact current authored candidate');
git('merge-base', '--is-ancestor', predecessor, revision);
const excluded = new Set(CRIME_MINIGAME_GENERATED_FILES);
const changed = (kind) => git('diff', '--no-renames', '--name-only', '--diff-filter=' + kind,
  '-z', predecessor, revision).split('\0').filter((file) => file && !excluded.has(file));
assert.deepEqual(changed('DRTCUXB'), [], 'A minigame source candidate cannot delete or rename existing domains');
const sha = (input) => createHash('sha256').update(input).digest('hex');
const read = (ref, file) => git('show', `${ref}:${file}`);
const pin = (ref, file, text) => {
  const record = git('ls-tree', ref, '--', file).trim().match(/^(100644|100755) blob ([a-f0-9]{40})\t/);
  assert(record, 'Regular committed source only: ' + file);
  assert(!/[\r\0\ufeff]/.test(text), 'Canonical committed LF UTF-8 source only: ' + file);
  return { mode: record[1], blob: record[2], bytes: Buffer.byteLength(text), sha256: sha(text) };
};
const files = {}, additions = {};
for (const file of changed('M')) {
  const before = read(predecessor, file), current = read(revision, file);
  const beforeLines = before.match(/[^\n]*\n|[^\n]+$/g) || [], currentLines = current.match(/[^\n]*\n|[^\n]+$/g) || [];
  const patch = git('diff', '--no-ext-diff', '--no-renames', '--unified=0', predecessor, revision, '--', file);
  const inverses = [...patch.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)].map((match) => {
    const oldCount = Number(match[2] ?? 1), newCount = Number(match[4] ?? 1);
    const oldStart = Number(match[1]) - (oldCount ? 1 : 0), newStart = Number(match[3]) - (newCount ? 1 : 0);
    return { at: currentLines.slice(0, newStart).join('').length,
      current: currentLines.slice(newStart, newStart + newCount).join(''), baseline: beforeLines.slice(oldStart, oldStart + oldCount).join('') };
  });
  assert(inverses.length, 'Every modified source requires exact inverse hunks: ' + file);
  let restored = current;
  for (const inverse of inverses.toReversed()) {
    assert.equal(restored.slice(inverse.at, inverse.at + inverse.current.length), inverse.current);
    restored = restored.slice(0, inverse.at) + inverse.baseline + restored.slice(inverse.at + inverse.current.length);
  }
  assert.equal(restored, before, 'Every whole successor must reconstruct its genuine predecessor: ' + file);
  files[file] = { current: pin(revision, file, current), baseline: pin(predecessor, file, before), inverses };
}
for (const file of changed('A')) additions[file] = pin(revision, file, read(revision, file));
const data = { status: 'SEALED', phase: 'EXACT_CRIME_MINIGAME_SOURCE_COMPARISON_ONLY', revision,
  tree: git('rev-parse', `${revision}^{tree}`).trim(), predecessor, predecessorTree: git('rev-parse', `${predecessor}^{tree}`).trim(), files, additions };
fs.writeFileSync('tools/crime-minigame-source-data.js', crimeMinigameSourceDataBytes(data));
console.log(`Sealed exact source-only comparison for ${Object.keys(files).length} modified domains and ${Object.keys(additions).length} additions at ${revision}.`);
