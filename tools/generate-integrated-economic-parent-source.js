// Generate the two comparison profiles only from an immutable authored integration.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { BUSINESS_DESK_COMBINED_SOURCE_FILES } from './businessdesk-combined-source-transfer.js';
import { DEED_ALLOCATION_SOURCE_DOMAINS } from './deed-allocation-source-data.js';
import { economicTermsPin } from './current-economic-terms-source-data.js';
import { combinedEconomicDeedSource } from './combined-economic-deed-source-data.js';

const revision = process.argv[2];
assert.deepEqual(process.argv.slice(2), [revision, '--write']);
assert.match(revision, /^[a-f0-9]{40}$/);
const parents = {
  economic: '3cf03ab3ebec43983b59ee07849594ed34f3dcae',
  main: '68a4d92d810ee17c192abb8a8c2a3fcbf87c4c52',
};
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { encoding:'utf8', windowsHide:true, maxBuffer:64*1024*1024 });
const sha = text => createHash('sha256').update(text).digest('hex');
assert.equal(git('rev-parse', 'HEAD').trim(), revision);
assert.equal(git('status', '--porcelain'), '', 'Require a clean authored source commit');
for (const parent of Object.values(parents)) git('merge-base', '--is-ancestor', parent, revision);
const tree = git('rev-parse', revision + '^{tree}').trim();
const economicFiles = new Set([economicTermsPin.files, combinedEconomicDeedSource.files, combinedEconomicDeedSource.noirFiles,
  combinedEconomicDeedSource.economicFiles, combinedEconomicDeedSource.fixtureFiles].flatMap(Object.keys));
const mainFiles = new Set([...BUSINESS_DESK_COMBINED_SOURCE_FILES, ...Object.keys(DEED_ALLOCATION_SOURCE_DOMAINS), ...economicFiles]);
const scopes = {economic:economicFiles, main:mainFiles};
function record(rev, file) {
  const entry = git('ls-tree', rev, '--', file).trim();
  const match = entry.match(/^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/);
  assert(match && match[3] === file, 'Expected a regular Git source: ' + file);
  const text = git('show', rev + ':' + file);
  assert(!/[\r\0\ufeff]/.test(text), 'Canonical UTF-8 Git source: ' + file);
  const bytes = Buffer.byteLength(text);
  assert.equal(createHash('sha1').update('blob ' + bytes + '\0').update(text).digest('hex'), match[2]);
  return {text, pin:{mode:match[1], blob:match[2], sha256:sha(text), bytes}};
}
function inverses(file, current, target, parent) {
  const lines = text => [0, ...Array.from(text.matchAll(/\n/g), match => match.index + 1)];
  const a = lines(target), b = lines(current), rows = [];
  const diff = git('diff','--no-ext-diff','--no-textconv','--no-renames','--unified=0',parent,revision,'--',file);
  for (const h of diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)) {
    const ac = Number(h[2] ?? 1), bc = Number(h[4] ?? 1);
    const ai = Number(h[1]) - (ac ? 1 : 0), bi = Number(h[3]) - (bc ? 1 : 0);
    const old = target.slice(a[ai], a[ai + ac]), next = current.slice(b[bi], b[bi + bc]);
    let start = 0, end = 0;
    while (start < Math.min(old.length,next.length) && old[start] === next[start]) start++;
    while (end < Math.min(old.length,next.length) - start && old.at(-1-end) === next.at(-1-end)) end++;
    rows.push({at:b[bi]+start, current:next.slice(start,next.length-end), baseline:old.slice(start,old.length-end)});
  }
  let restored = current;
  for (const h of rows.toReversed()) {
    assert.equal(restored.slice(h.at,h.at+h.current.length),h.current);
    restored = restored.slice(0,h.at) + h.baseline + restored.slice(h.at+h.current.length);
  }
  assert.equal(restored,target,'Reconstruct entire reviewed parent: '+file);
  return rows;
}
const files = {};
for (const [profile, parent] of Object.entries(parents)) {
  const changed = git('diff','--name-only','--diff-filter=M','-z',parent,revision).split('\0').filter(file => scopes[profile].has(file));
  for (const file of changed) {
    const here = record(revision,file), prior = record(parent,file);
    assert.equal(here.pin.mode,prior.pin.mode);
    files[file] ??= {current:here.pin, parents:{}};
    files[file].parents[profile] = {pin:prior.pin, inverses:inverses(file,here.text,prior.text,parent)};
  }
}
const data = {revision,tree,parents,files};
const digest = sha(JSON.stringify(data));
writeFileSync(new URL('./integrated-economic-parent-data.js', import.meta.url),
  '// Generated comparison-only Git records. Native checks use physical bytes.\n'
  + 'export const integratedEconomicSource = ' + JSON.stringify(data,null,2) + ';\n'
  + "export const integratedEconomicSourceDigest = '" + digest + "';\n");
console.log(revision, Object.keys(files).length + ' exact comparison records', digest);
