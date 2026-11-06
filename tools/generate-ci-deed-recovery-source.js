// Bind only the explicit CI/Deed source-only comparison successor from immutable Git.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
const revision = process.argv[2];
assert.deepEqual(process.argv.slice(2), [revision, '--write']); assert.match(revision ?? '', /^[a-f0-9]{40}$/);
const predecessor = '0ce6ab96a34e6061232980ad60bfdbc94cf98fdb';
export const CI_DEED_RECOVERY_DOMAINS = Object.freeze([
  '.github/workflows/ci.yml', 'package.json', 'public/index.html', 'test/deed-discovery-ui.js', 'test/gates.js',
  'test/businessdesk-combined-source-compatibility.js', 'test/businessdesk-noir-source-compatibility.js',
  'test/businessdesk-native-provenance.js',
  'test/economy-deed-merge-source-compatibility.js', 'test/wiki-media-source-transfer.js',
  'test/deed-allocation-source-compatibility.js', 'test/economy-monitor-source-compatibility.js',
  'tools/integrated-economic-parent-source.js', 'tools/combined-economic-deed-source-transfer.js',
  'tools/enterprise-native-ux.js',
  'tools/economy-ux-merge-source-compatibility.js',
]);
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
const sha = text => createHash('sha256').update(text).digest('hex');
git('merge-base', '--is-ancestor', predecessor, revision); git('merge-base', '--is-ancestor', revision, 'HEAD');
function record(ref, file) {
  const line = git('ls-tree', ref, '--', file).trim(), match = line.match(/^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/);
  assert(match && match[3] === file); const text = git('show', ref + ':' + file);
  assert(!/[\r\0\ufeff]/.test(text), 'Canonical complete Git UTF-8');
  const bytes = Buffer.byteLength(text); assert.equal(createHash('sha1').update('blob ' + bytes + '\0').update(text).digest('hex'), match[2]);
  return { text, pin: { mode: match[1], blob: match[2], sha256: sha(text), bytes } };
}
const offsets = text => [0, ...Array.from(text.matchAll(/\n/g), match => match.index + 1)];
const files = {};
for (const file of CI_DEED_RECOVERY_DOMAINS) {
  const current = record(revision, file), baseline = record(predecessor, file);
  assert.equal(current.pin.mode, baseline.pin.mode);
  if (current.pin.blob === baseline.pin.blob) continue;
  const a = offsets(baseline.text), b = offsets(current.text), inverses = [];
  const diff = git('diff', '--no-ext-diff', '--no-textconv', '--no-renames', '--unified=0', predecessor, revision, '--', file);
  for (const h of diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)) {
    const ac = Number(h[2] ?? 1), bc = Number(h[4] ?? 1), ai = Number(h[1]) - (ac ? 1 : 0), bi = Number(h[3]) - (bc ? 1 : 0);
    const old = baseline.text.slice(a[ai], a[ai + ac]), next = current.text.slice(b[bi], b[bi + bc]);
    let start = 0, end = 0; while (start < Math.min(old.length, next.length) && old[start] === next[start]) start++;
    while (end < Math.min(old.length, next.length) - start && old.at(-1-end) === next.at(-1-end)) end++;
    inverses.push({ at: b[bi] + start, current: next.slice(start, next.length - end), baseline: old.slice(start, old.length - end) });
  }
  let restored = current.text;
  for (const h of inverses.toReversed()) { assert.equal(restored.slice(h.at, h.at + h.current.length), h.current); restored = restored.slice(0, h.at) + h.baseline + restored.slice(h.at + h.current.length); }
  assert.equal(restored, baseline.text); files[file] = { current: current.pin, baseline: baseline.pin, inverses };
}
assert(Object.keys(files).length >= 4);
const data = { status: 'SEALED', phase: 'EXACT_CI_DEED_RECOVERY_COMPARISON_ONLY', revision,
  tree: git('rev-parse', revision + '^{tree}').trim(), predecessor,
  predecessorTree: git('rev-parse', predecessor + '^{tree}').trim(), files };
const digest = sha(JSON.stringify(data));
fs.writeFileSync(new URL('./ci-deed-recovery-source-data.js', import.meta.url),
  '// Generated from immutable authored Git objects; no runtime or native admission.\nexport const recoverySource = ' + JSON.stringify(data, null, 2) + ';\n');
const helper = new URL('./ci-deed-recovery-source-transfer.js', import.meta.url), code = fs.readFileSync(helper, 'utf8');
assert.equal((code.match(/const expectedDigest = '[^']+';/g) ?? []).length, 1);
fs.writeFileSync(helper, code.replace(/const expectedDigest = '[^']+';/, "const expectedDigest = '" + digest + "';"));
console.log(JSON.stringify({ revision, domains: Object.keys(files), digest, sourceOnly: true, native: false, runtime: false }));
