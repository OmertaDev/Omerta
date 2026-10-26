import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

// Update sourceRevision only after the bridge implementation is committed. The merge and both
// reviewed parents are immutable anchors; this generator never discovers or trusts moving refs.
const sourceRevision = 'c16a43b0b951b8c7f37aa5a66109785f271e1888';
const mergeRevision = '3f8c9a910e0097cb0ff93063693944a414204258';
const candidateParentRevision = 'bfb23d1bba7f503f36498c4d82de78aa73256386';
const mainParentRevision = '442409ae3f70677c0bd475d99f018bec29849e5b';
const files = Object.freeze([
  '.github/workflows/ci.yml',
  '.github/workflows/economy-hardening.yml',
  'package.json',
  'public/index.html',
  'schema.sql',
  'src/accrual.js',
  'src/actioncooldown.js',
  'src/db.js',
  'src/economy.js',
  'src/game.js',
  'src/growth.js',
  'src/kitchen.js',
  'src/payroll.js',
  'src/rules.tail.js',
  'src/server.js',
  'src/socialproof.js',
  'src/ux-tactics.js',
  'src/verify.js',
  'tools/economy-hardening-source-transfer.js',
  'tools/economy-readiness-merge-source-compatibility.js',
  'tools/economy-release-tail-source-transfer.js',
  'tools/enterprise-native.js',
  'tools/enterprise-native-ux-seal.js',
  'tools/sim.js',
  'test/action-cooldowns.js',
  'test/agent-referral-cash.js',
  'test/classic-interface-source-compatibility.js',
  'test/client.js',
  'test/commerce-release-phase2-migration-catalog.js',
  'test/crew-wage-postgres.js',
  'test/director-migration.js',
  'test/economy-balance.js',
  'test/economy-hardening-source-compatibility.js',
  'test/enterprise-native-guard.js',
  'test/enterprise-release-phase2-migration-catalog.js',
  'test/gates.js',
  'test/growth.js',
  'test/levers.js',
  'test/lib/enterprise-ux-native-guard.js',
  'test/migrate.js',
  'test/payroll.js',
  'test/phase2-postgres.js',
  'test/ux-postgres-rls.js',
  'test/ux-tactics-browser.js',
  'test/ux-tactics.js',
]);
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], {
  encoding: 'utf8', maxBuffer: 128 * 1024 * 1024,
});
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
const tree = revision => git('rev-parse', `${revision}^{tree}`).trim();
const content = (revision, file) => git('show', `${revision}:${file}`);
const record = (revision, file) => {
  const match = git('ls-tree', revision, '--', file).trim().match(/^(100644|100755) blob ([a-f0-9]{40})\t/);
  assert(match, `Committed regular file required: ${revision}:${file}`);
  const text = content(revision, file);
  assert(!text.includes('\r') && !text.startsWith('\ufeff') && !text.includes('\0'), `Canonical LF UTF-8 source: ${file}`);
  assert.equal(blob(text), match[2]);
  return { mode: match[1], blob: match[2], sha256: sha(text), bytes: Buffer.byteLength(text), text };
};
const inverseHunks = diff => {
  const rows = []; let hunk = null;
  for (const line of diff.split('\n')) {
    if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; rows.push(hunk); }
    else if (hunk && /^[ +\-]/.test(line)) {
      if (line[0] !== '-') hunk.current += `${line.slice(1)}\n`;
      if (line[0] !== '+') hunk.baseline += `${line.slice(1)}\n`;
    }
  }
  return rows;
};
const target = (file, current, revision) => {
  if (!git('ls-tree', revision, '--', file).trim()) {
    assert(git('diff', '--no-ext-diff', '--name-only', revision, sourceRevision, '--', file).trim() === file,
      `Absent parent must differ: ${revision}:${file}`);
    return { absent: true };
  }
  const baseline = record(revision, file);
  const inverses = inverseHunks(git('diff', '--no-ext-diff', '--unified=3', revision, sourceRevision, '--', file));
  let restored = current.text; let end = -1;
  for (const inverse of inverses) {
    assert(inverse.current.length, `Nonempty inverse: ${file}`);
    assert.equal(current.text.split(inverse.current).length, 2, `Unique current hunk: ${revision}:${file}`);
    const at = current.text.indexOf(inverse.current); assert(at >= end, `Ordered hunks: ${revision}:${file}`); end = at + inverse.current.length;
    assert.equal(restored.split(inverse.current).length, 2, `Applicable inverse: ${revision}:${file}`);
    restored = restored.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(restored, baseline.text, `Exact parent reconstruction: ${revision}:${file}`);
  return { absent: false, mode: baseline.mode, blob: baseline.blob, sha256: baseline.sha256, bytes: baseline.bytes, inverses };
};

assert.equal(git('rev-parse', `${mergeRevision}^1`).trim(), candidateParentRevision);
assert.equal(git('rev-parse', `${mergeRevision}^2`).trim(), mainParentRevision);
git('merge-base', '--is-ancestor', mergeRevision, sourceRevision);
const rows = files.map(file => {
  const current = record(sourceRevision, file);
  const candidate = target(file, current, candidateParentRevision);
  const main = target(file, current, mainParentRevision);
  assert(candidate.absent || main.absent || current.sha256 !== candidate.sha256 || current.sha256 !== main.sha256,
    `At least one parent differs: ${file}`);
  return {
    file, mode: current.mode, currentBlob: current.blob, currentSha256: current.sha256,
    currentBytes: current.bytes, candidate, main,
  };
});
const data = {
  version: 1, status: 'SEALED', phase: 'EXACT_ECONOMY_UX_MERGE_SOURCE_ONLY', contextLines: 3,
  sourceRevision, sourceTree: tree(sourceRevision), mergeRevision, mergeTree: tree(mergeRevision),
  candidateParentRevision, candidateParentTree: tree(candidateParentRevision),
  mainParentRevision, mainParentTree: tree(mainParentRevision), files: rows,
};
const digest = sha(JSON.stringify(data));
const output = `// Generated exact source-only bridge from the integrated economy+UX source to both reviewed parents.\n`
  + `const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};\n`
  + `export const ECONOMY_UX_MERGE_SOURCE=freeze(${JSON.stringify(data, null, 2)});\n`
  + `export const ECONOMY_UX_MERGE_SOURCE_SHA256=${JSON.stringify(digest)};\n`;
fs.writeFileSync(new URL('./economy-ux-merge-source-data.js', import.meta.url), output);
console.log(JSON.stringify({ sourceRevision, mergeRevision, candidateParentRevision, mainParentRevision, files: rows.length, digest }));
