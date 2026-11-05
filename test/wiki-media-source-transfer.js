// Exact source-only evidence for the already-authored wiki/media release. No native/runtime admission.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { WIKI_MEDIA_SOURCE, WIKI_MEDIA_SOURCE_SHA256, assertWikiMediaSourceTransfer,
  wikiMediaHistoricalInput, WIKI_MEDIA_MERGE_SOURCE, WIKI_MEDIA_MERGE_SOURCE_SHA256,
  assertWikiMediaMergeSourceTransfer, wikiMediaMergeHistoricalInput,
  WIKI_MEDIA_NOIR_MERGE_SOURCE, WIKI_MEDIA_NOIR_MERGE_SOURCE_SHA256,
  assertWikiMediaNoirMergeSourceTransfer, wikiMediaNoirMergeHistoricalInput } from '../tools/wiki-media-source-transfer.js';

assert.deepEqual(process.argv.slice(2), [], 'Source-only proof has no native/runtime flags');
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
const files = ["docs/WIKI.md","package.json","public/index.html","public/ux-feedback.js","public/wiki.html","src/server.js","test/ux-feedback.js"];
assert.equal(WIKI_MEDIA_SOURCE.revision, '37ff08fae831f2756b5be373b74fa5f4b14445c0');
assert.equal(WIKI_MEDIA_SOURCE.predecessorRevision, 'f4474d358e8c9feddcd01deaadf77c1a67ace9cb');
assert.equal(hash(JSON.stringify(WIKI_MEDIA_SOURCE)), WIKI_MEDIA_SOURCE_SHA256);
assert.deepEqual(Object.keys(WIKI_MEDIA_SOURCE.files), files);
assert.deepEqual(git('diff', '--diff-filter=M', '--name-only', WIKI_MEDIA_SOURCE.predecessorRevision,
  WIKI_MEDIA_SOURCE.revision).trim().split('\n'), files, 'Exact modified predecessor text scope; added public assets are not historical source domains');
for (const [revision, tree] of [[WIKI_MEDIA_SOURCE.revision, WIKI_MEDIA_SOURCE.tree],
  [WIKI_MEDIA_SOURCE.predecessorRevision, WIKI_MEDIA_SOURCE.predecessorTree]])
  assert.equal(git('rev-parse', revision + '^{tree}').trim(), tree);
execFileSync('git', ['--no-replace-objects', 'merge-base', '--is-ancestor', WIKI_MEDIA_SOURCE.predecessorRevision, WIKI_MEDIA_SOURCE.revision]);

function actualInverses(diff) {
  const hunks = []; let current, priorKind;
  for (const line of diff.split('\n')) {
    if (line.startsWith('@@ ')) { current = { current: '', baseline: '' }; hunks.push(current); continue; }
    if (!current) continue;
    if (line.startsWith('\\ No newline at end of file')) {
      if (priorKind !== '-') current.current = current.current.slice(0, -1);
      if (priorKind !== '+') current.baseline = current.baseline.slice(0, -1);
    } else if ([' ', '+', '-'].includes(line[0])) {
      priorKind = line[0];
      if (priorKind !== '-') current.current += line.slice(1) + '\n';
      if (priorKind !== '+') current.baseline += line.slice(1) + '\n';
    }
  }
  return hunks;
}

let positives = 0, refusals = 0;
for (const file of files) {
  const row = WIKI_MEDIA_SOURCE.files[file];
  const current = git('show', WIKI_MEDIA_SOURCE.revision + ':' + file);
  const baseline = git('show', WIKI_MEDIA_SOURCE.predecessorRevision + ':' + file);
  assert(!current.includes('\r') && !baseline.includes('\r'), 'Actual authored text is LF');
  assert(Object.isFrozen(row) && Object.isFrozen(row.inverses)
    && row.inverses.every(Object.isFrozen), 'Literal evidence stays immutable');
  for (const [revision, text, pin] of [[WIKI_MEDIA_SOURCE.revision, current, row.current],
    [WIKI_MEDIA_SOURCE.predecessorRevision, baseline, row.baseline]]) {
    assert.equal(git('ls-tree', revision, '--', file).trim(), pin.mode + ' blob ' + pin.lf.blob + '\t' + file);
    for (const [variant, raw] of [['lf', text], ['crlf', text.replaceAll('\n', '\r\n')]]) {
      assert.equal(hash(raw), pin[variant].sha256);
      assert.equal(blob(raw), pin[variant].blob);
      assert.equal(Buffer.byteLength(raw), pin[variant].bytes);
    }
  }
  assert.deepEqual(row.inverses, actualInverses(git('diff', '--no-ext-diff', '--no-renames',
    '--unified=3', WIKI_MEDIA_SOURCE.predecessorRevision, WIKI_MEDIA_SOURCE.revision, '--', file)), 'Hunks are the actual authored Git diff');
  for (const input of [current, current.replaceAll('\n', '\r\n')]) {
    const proof = assertWikiMediaSourceTransfer(file, input);
    assert.equal(proof.baselineText, baseline);
    assert.equal(wikiMediaHistoricalInput(file, input), baseline);
    assert.deepEqual(wikiMediaHistoricalInput(file, Buffer.from(input)), Buffer.from(baseline));
    assert.equal(proof.sourceOnly, true);
    for (const phase of ['native', 'runtime', 'migration', 'financial', 'activation', 'deployment']) assert.equal(proof[phase], false);
    positives++;
  }
  const changed = [current + '\n// arbitrary successor\n', current.slice(1), '\ufeff' + current,
    current + '\0', current.replace('\n', '\r\n'), current.replace('\n', '\r'), baseline];
  for (const inverse of row.inverses) changed.push(current.replace(inverse.current, ''),
    current.replace(inverse.current, () => inverse.current + inverse.current));
  if (row.inverses.length > 1) {
    const [first, second] = row.inverses;
    changed.push(current.replace(first.current, '\u0001').replace(second.current, first.current).replace('\u0001', second.current));
  }
  for (const input of changed) {
    assert.throws(() => assertWikiMediaSourceTransfer(file, input));
    assert.equal(wikiMediaHistoricalInput(file, input), input, 'Unknown or predecessor bytes remain raw for the original guard');
    refusals++;
  }
  const invalidUtf8 = Buffer.concat([Buffer.from(current), Buffer.from([0xff])]);
  assert.throws(() => wikiMediaHistoricalInput(file, invalidUtf8), /Lossless UTF-8/);
  assert.throws(() => assertWikiMediaSourceTransfer(file, current, Object.freeze({ ...WIKI_MEDIA_SOURCE })));
  refusals += 2;
}
for (const file of ['../src/server.js', '__proto__', 'constructor', 'src/unknown.js']) {
  assert.throws(() => assertWikiMediaSourceTransfer(file, 'unknown'));
  assert.equal(wikiMediaHistoricalInput(file, 'unknown'), 'unknown'); refusals++;
}

// Reverse exactly the three reader-only call-site edits; all historical guards remain byte exact.
const wiring = [
  {
    "file": "tools/economy-ux-merge-source-compatibility.js",
    "imports": "import { wikiMediaHistoricalInput } from './wiki-media-source-transfer.js';\nimport { age21HistoricalInput } from './age21-source-transfer.js';\n",
    "calls": [
      "economyUxMergeCandidateHistoricalInput",
      "economyUxMergeMainHistoricalInput"
    ]
  },
  {
    "file": "tools/economy-social-proof-cutover-source-transfer.js",
    "imports": "import { wikiMediaHistoricalInput } from './wiki-media-source-transfer.js';\nimport { age21HistoricalInput } from './age21-source-transfer.js';\n",
    "calls": [
      "economySocialProofCutoverHistoricalInput"
    ]
  },
  {
    "file": "test/economy-hardening-source-compatibility.js",
    "imports": "import { wikiMediaHistoricalInput } from '../tools/wiki-media-source-transfer.js';\nimport { age21HistoricalInput } from '../tools/age21-source-transfer.js';\n",
    "replace": {
      "before": "  const physical = lf(fs.readFileSync(file, 'utf8'));\n  assert.equal(physical, current, 'Physical social-proof cutover source must remain exact: ' + file);",
      "after": "  const physical = lf(age21HistoricalInput(file, wikiMediaHistoricalInput(file, fs.readFileSync(file, 'utf8'))));\n  assert.equal(physical, current, 'Physical social-proof cutover source must remain exact: ' + file);"
    }
  }
];
for (const item of wiring) {
  let current = wikiMediaMergeHistoricalInput(item.file,
    fs.readFileSync(new URL('../' + item.file, import.meta.url), 'utf8'), 'wiki').replaceAll('\r\n', '\n');
  assert.equal(current.split(item.imports).length, 2);
  current = current.replace(item.imports, '');
  for (const name of item.calls || []) {
    const anchor = 'export function ' + name + '(file, input) {\n';
    const after = anchor + "  input = age21HistoricalInput(file, wikiMediaHistoricalInput(file, input));\n";
    assert.equal(current.split(after).length, 2);
    current = current.replace(after, anchor);
  }
  if (item.replace) { assert.equal(current.split(item.replace.after).length, 2); current = current.replace(item.replace.after, item.replace.before); }
  assert.equal(current, git('show', WIKI_MEDIA_SOURCE.predecessorRevision + ':' + item.file),
    'Complete old reader/test differs only at the reviewed source-only call-sites');
}
console.log(JSON.stringify({ phase: 'PASS_EXACT_WIKI_MEDIA_SOURCE_ONLY', files: files.length,
  positives, refusals, nativeAdmission: false, runtimeAdmission: false }));

// A separate exact merge relation preserves both immutable parent source histories.
const merge = WIKI_MEDIA_MERGE_SOURCE;
assert.equal(merge.status, 'SEALED'); assert.equal(hash(JSON.stringify(merge)), WIKI_MEDIA_MERGE_SOURCE_SHA256);
assert.equal(merge.version, 1);
assert.equal(merge.phase, 'exact-dual-parent-wiki-merge-source-only; no native, runtime, financial or deployment clearance');
assert.equal(merge.revision, '9c78948fc3f081250c1f1755ca06f8334a7ad0a3');
assert.equal(merge.mergeRevision, '51cf345fc5501e7bc0ef4fe0c8cdf83e19795771');
assert.equal(merge.parents.main.revision, 'fe887350a661901983282183fb21e9d1d330f04f');
assert.equal(merge.parents.wiki.revision, '6607bf3105c7fa019611d85c1994d7576d4708b2');
assert.equal(git('rev-parse', merge.mergeRevision + '^1').trim(), merge.parents.wiki.revision);
assert.equal(git('rev-parse', merge.mergeRevision + '^2').trim(), merge.parents.main.revision);
for (const record of [{ revision: merge.revision, tree: merge.tree },
  { revision: merge.mergeRevision, tree: merge.mergeTree }, ...Object.values(merge.parents)])
  assert.equal(git('rev-parse', record.revision + '^{tree}').trim(), record.tree);
git('merge-base', '--is-ancestor', merge.mergeRevision, merge.revision);
git('merge-base', '--is-ancestor', merge.revision, 'HEAD');
const excluded = new Set(['tools/wiki-media-source-data.js', 'tools/enterprise-native-deed-inputs.js']);
const changedMergeFiles = git('diff', '--diff-filter=M', '--name-only', merge.parents.main.revision, merge.revision)
  .trim().split('\n').filter(file => file && !file.startsWith('knowledge/generated/') && !excluded.has(file));
assert.deepEqual(Object.keys(merge.files), changedMergeFiles, 'Only the finite actual modified main-source scope is admitted');
let mergePositives = 0, mergeRefusals = 0, mergeHunks = 0;
for (const [file, row] of Object.entries(merge.files)) {
  const current = git('show', merge.revision + ':' + file);
  assert.equal(wikiMediaNoirMergeHistoricalInput(file, fs.readFileSync(file, 'utf8'), 'wiki').replaceAll('\r\n', '\n'), current,
    'Actual physical merge source remains exact after the separately qualified integration: ' + file);
  assert(Object.isFrozen(row) && Object.isFrozen(row.current));
  const checkRecord = (revision, record, text) => {
    assert.equal(git('ls-tree', revision, '--', file).trim(), record.mode + ' blob ' + record.lf.blob + '\t' + file);
    for (const [variant, value] of [['lf', text], ['crlf', text.replaceAll('\n', '\r\n')]]) {
      assert.equal(hash(value), record[variant].sha256); assert.equal(blob(value), record[variant].blob);
      assert.equal(Buffer.byteLength(value), record[variant].bytes);
    }
  };
  checkRecord(merge.revision, row.current, current);
  for (const target of ['main', 'wiki']) {
    const parent = row[target], revision = merge.parents[target].revision;
    if (parent.absent) {
      assert.equal(git('ls-tree', revision, '--', file), '');
      assert.throws(() => assertWikiMediaMergeSourceTransfer(file, current, target)); mergeRefusals++; continue;
    }
    const baseline = git('show', revision + ':' + file); checkRecord(revision, parent, baseline);
    assert(Object.isFrozen(parent) && Object.isFrozen(parent.inverses) && parent.inverses.every(Object.isFrozen));
    assert.deepEqual(parent.inverses, actualInverses(git('diff', '--no-ext-diff', '--no-renames',
      '--unified=' + merge.contextLines, revision, merge.revision, '--', file)));
    for (const input of [current, current.replaceAll('\n', '\r\n')]) {
      const proof = assertWikiMediaMergeSourceTransfer(file, input, target);
      assert.equal(proof.baselineText, baseline); assert.equal(proof.predecessorRevision, revision);
      assert.equal(wikiMediaMergeHistoricalInput(file, input, target), baseline);
      assert.deepEqual(wikiMediaMergeHistoricalInput(file, Buffer.from(input), target), Buffer.from(baseline));
      assert.equal(proof.sourceOnly, true);
      for (const phase of ['native', 'runtime', 'migration', 'financial', 'activation', 'deployment']) assert.equal(proof[phase], false);
      mergePositives++;
    }
    for (const inverse of parent.inverses) {
      for (const value of [current.replace(inverse.current, ''), current.replace(inverse.current, () => inverse.current + inverse.current),
        current.replace(inverse.current, () => inverse.current.replace(/\S/, '?'))]) {
        assert.throws(() => assertWikiMediaMergeSourceTransfer(file, value, target)); mergeRefusals++;
      }
      mergeHunks++;
    }
    if (parent.inverses.length > 1) {
      const [a, b] = parent.inverses, marker = '\u0001MERGE_SWAP\u0001';
      assert(!current.includes(marker));
      const swapped = current.replace(a.current, () => marker).replace(b.current, () => a.current).replace(marker, () => b.current);
      assert.throws(() => assertWikiMediaMergeSourceTransfer(file, swapped, target)); mergeRefusals++;
    }
  }
  for (const value of [current + '\n// unknown successor\n', current.slice(1), '\ufeff' + current,
    current + '\0', current.replace('\n', '\r\n'), current.replace('\n', '\r'), null]) {
    assert.throws(() => assertWikiMediaMergeSourceTransfer(file, value));
    assert.equal(wikiMediaMergeHistoricalInput(file, value), value, 'Unknown merged bytes stay unchanged'); mergeRefusals++;
  }
  assert.throws(() => wikiMediaMergeHistoricalInput(file, Buffer.concat([Buffer.from(current), Buffer.from([255])])), /Lossless UTF-8/);
  assert.throws(() => assertWikiMediaMergeSourceTransfer(file, current, 'foreign'));
  assert.throws(() => assertWikiMediaMergeSourceTransfer(file, current, 'main', Object.freeze({ ...merge })));
  mergeRefusals += 3;
}
for (const file of ['../src/server.js', '__proto__', 'constructor', 'unknown']) {
  assert.throws(() => assertWikiMediaMergeSourceTransfer(file, 'unknown'));
  assert.equal(wikiMediaMergeHistoricalInput(file, 'unknown'), 'unknown'); mergeRefusals++;
}
console.log(JSON.stringify({ phase: 'PASS_EXACT_DUAL_PARENT_WIKI_MERGE_SOURCE_ONLY', files: Object.keys(merge.files).length,
  positives: mergePositives, refusals: mergeRefusals, hunks: mergeHunks, nativeAdmission: false, runtimeAdmission: false }));

// A third closed namespace qualifies the later noir/wiki integration without editing either history.
const noirMerge = WIKI_MEDIA_NOIR_MERGE_SOURCE;
const noirMergeFiles = [
  "MARKETING-POSTS.md",
  "SPEC.md",
  "docs/WIKI.md",
  "package.json",
  "public/index.html",
  "public/omerta-ui.css",
  "public/ux-feedback.js",
  "public/ux-navigation.js",
  "public/ux-tactics.js",
  "public/ux-world.js",
  "public/wiki.html",
  "src/server.js",
  "test/classic-interface-browser.js",
  "test/client.js",
  "test/decision-guide-client.js",
  "test/deed-allocation-source-compatibility.js",
  "test/economy-hardening-source-compatibility.js",
  "test/lib/enterprise-ux-native-guard.js",
  "test/lib/ux-journeys.js",
  "test/lib/ux-native-reader-source-compatibility.js",
  "test/noir-ui-source-compatibility.js",
  "test/sale-source-compatibility.js",
  "test/ux-community-browser.js",
  "test/ux-expanded-browser.js",
  "test/ux-experience-browser.js",
  "test/ux-feedback.js",
  "test/ux-personality-browser.js",
  "test/ux-story-browser.js",
  "test/vig.js",
  "test/wiki-media-source-transfer.js",
  "tools/deed-allocation-source-transfer.js",
  "tools/economy-social-proof-cutover-source-transfer.js",
  "tools/economy-ux-merge-source-compatibility.js",
  "tools/enterprise-native-ux-seal.js",
  "tools/enterprise-native-ux.js",
  "tools/mobile.js",
  "tools/noir-ui-source-transfer.js",
  "tools/public-ui.js",
  "tools/wiki-media-source-transfer.js"
];
assert.equal(noirMerge.version, 1);
assert.equal(noirMerge.status, 'SEALED');
assert.equal(noirMerge.contextLines, 8);
assert.equal(noirMerge.phase, 'exact-dual-parent-noir-wiki-merge-source-only; no native, runtime, financial or deployment clearance');
assert.equal(noirMerge.mergeRevision, 'db1906a6e30705c062b66de201ed498e00309fa6');
assert.equal(noirMerge.parents.wiki.revision, 'a5e2ea70eb59aa1397eff8cfb8063ed43405d164');
assert.equal(noirMerge.parents.main.revision, 'a87217d664d52eb119683ed305c564ee3cf9deb0');
assert.equal(hash(JSON.stringify(noirMerge)), WIKI_MEDIA_NOIR_MERGE_SOURCE_SHA256);
assert(Object.isFrozen(noirMerge) && Object.isFrozen(noirMerge.files) && Object.isFrozen(noirMerge.parents));
assert.deepEqual(Object.keys(noirMerge.files), noirMergeFiles, 'Only the literal reviewed noir/wiki domains');
assert.equal(git('rev-parse', noirMerge.mergeRevision + '^1').trim(), noirMerge.parents.wiki.revision);
assert.equal(git('rev-parse', noirMerge.mergeRevision + '^2').trim(), noirMerge.parents.main.revision);
for (const record of [{ revision: noirMerge.revision, tree: noirMerge.tree },
  { revision: noirMerge.mergeRevision, tree: noirMerge.mergeTree }, ...Object.values(noirMerge.parents)])
  assert.equal(git('rev-parse', record.revision + '^{tree}').trim(), record.tree);
git('merge-base', '--is-ancestor', noirMerge.mergeRevision, noirMerge.revision);
git('merge-base', '--is-ancestor', noirMerge.revision, 'HEAD');
const noirExcluded = new Set(['tools/wiki-media-source-data.js', 'tools/enterprise-native-deed-inputs.js']);
const noirActualScope = [...new Set(Object.values(noirMerge.parents).flatMap(parent =>
  git('diff', '--diff-filter=M', '--name-only', parent.revision, noirMerge.revision).trim().split('\n')))]
  .filter(file => file && !file.startsWith('knowledge/generated/') && !file.startsWith('public/art/wiki-economy/')
    && !noirExcluded.has(file)).sort();
assert.deepEqual(noirMergeFiles, noirActualScope, 'Closed actual modified source union of both authored parents');
let noirPositives = 0, noirRefusals = 0, noirHunks = 0;
for (const [file, row] of Object.entries(noirMerge.files)) {
  const current = git('show', noirMerge.revision + ':' + file), physical = fs.readFileSync(file, 'utf8');
  assert(physical === current || physical === current.replaceAll('\n', '\r\n'), 'Actual whole LF/CRLF source remains authored: ' + file);
  assert.equal(git('ls-tree', 'HEAD', '--', file).trim(), row.current.mode + ' blob ' + row.current.lf.blob + '\t' + file,
    'Raw current HEAD mode/blob must qualify before any historical view');
  assert.equal(git('ls-files', '--stage', '--', file).trim(), row.current.mode + ' ' + row.current.lf.blob + ' 0\t' + file);
  assert(fs.lstatSync(file).isFile() && !fs.lstatSync(file).isSymbolicLink());
  assert(Object.isFrozen(row) && Object.isFrozen(row.current));
  const checkRecord = (revision, record, text) => {
    assert.equal(record.mode, '100644');
    assert.equal(git('ls-tree', revision, '--', file).trim(), record.mode + ' blob ' + record.lf.blob + '\t' + file);
    assert(!text.includes('\r') && !text.includes('\0') && !text.includes('\ufeff'));
    for (const [variant, value] of [['lf', text], ['crlf', text.replaceAll('\n', '\r\n')]]) {
      assert.equal(hash(value), record[variant].sha256); assert.equal(blob(value), record[variant].blob);
      assert.equal(Buffer.byteLength(value), record[variant].bytes);
    }
  };
  checkRecord(noirMerge.revision, row.current, current);
  for (const target of ['main', 'wiki']) {
    const parent = row[target], revision = noirMerge.parents[target].revision;
    assert(Object.isFrozen(parent));
    if (parent.absent) {
      assert.deepEqual(parent, { absent: true });
      assert.equal(git('ls-tree', revision, '--', file), '');
      assert.throws(() => assertWikiMediaNoirMergeSourceTransfer(file, current, target));
      assert.equal(wikiMediaNoirMergeHistoricalInput(file, current, target), current); noirRefusals++; continue;
    }
    const baseline = git('show', revision + ':' + file);
    checkRecord(revision, parent, baseline);
    assert(Object.isFrozen(parent.inverses) && parent.inverses.every(Object.isFrozen));
    assert.deepEqual(parent.inverses, actualInverses(git('diff', '--no-ext-diff', '--no-renames',
      '--unified=' + noirMerge.contextLines, revision, noirMerge.revision, '--', file)), 'Every inverse is the actual ordered Git hunk');
    for (const input of [current, current.replaceAll('\n', '\r\n')]) {
      const proof = assertWikiMediaNoirMergeSourceTransfer(file, input, target);
      assert.equal(proof.baselineText, baseline); assert.equal(proof.predecessorRevision, revision);
      assert.equal(proof.sourceRevision, noirMerge.revision); assert.equal(proof.inverseChunks, parent.inverses.length);
      assert.equal(wikiMediaNoirMergeHistoricalInput(file, input, target), baseline);
      assert.deepEqual(wikiMediaNoirMergeHistoricalInput(file, Buffer.from(input), target), Buffer.from(baseline));
      assert.equal(proof.sourceOnly, true);
      for (const phase of ['native', 'runtime', 'migration', 'financial', 'activation', 'deployment']) assert.equal(proof[phase], false);
      noirPositives++;
    }
    for (const inverse of parent.inverses) {
      for (const value of [current.replace(inverse.current, ''), current.replace(inverse.current, () => inverse.current + inverse.current),
        current.replace(inverse.current, () => inverse.current.replace(/\S/, '?'))]) {
        assert.throws(() => assertWikiMediaNoirMergeSourceTransfer(file, value, target));
        assert.equal(wikiMediaNoirMergeHistoricalInput(file, value, target), value, 'Changed context obtains no historical authority');
        noirRefusals++;
      }
      noirHunks++;
    }
    if (parent.inverses.length > 1) {
      const [first, second] = parent.inverses, marker = '\u0001NOIR_MERGE_SWAP\u0001';
      assert(!current.includes(marker));
      const swapped = current.replace(first.current, () => marker).replace(second.current, () => first.current).replace(marker, () => second.current);
      assert.throws(() => assertWikiMediaNoirMergeSourceTransfer(file, swapped, target));
      assert.equal(wikiMediaNoirMergeHistoricalInput(file, swapped, target), swapped); noirRefusals++;
    }
    if (baseline !== current) {
      assert.throws(() => assertWikiMediaNoirMergeSourceTransfer(file, baseline, target)); noirRefusals++;
    }
  }
  for (const value of [current + '\n// unreviewed integration successor\n', current.slice(1), '\ufeff' + current,
    current + '\0', current.replace('\n', '\r\n'), current.replace('\n', '\r'), null]) {
    assert.throws(() => assertWikiMediaNoirMergeSourceTransfer(file, value));
    assert.equal(wikiMediaNoirMergeHistoricalInput(file, value), value); noirRefusals++;
  }
  assert.throws(() => wikiMediaNoirMergeHistoricalInput(file, Buffer.concat([Buffer.from(current), Buffer.from([255])])), /Lossless UTF-8/);
  assert.throws(() => assertWikiMediaNoirMergeSourceTransfer(file, current, 'foreign'));
  assert.throws(() => assertWikiMediaNoirMergeSourceTransfer(file, current, 'main', Object.freeze({ ...noirMerge })));
  noirRefusals += 3;
}
for (const file of ['../src/server.js', '__proto__', 'constructor', 'unknown']) {
  assert.throws(() => assertWikiMediaNoirMergeSourceTransfer(file, 'unknown'));
  assert.equal(wikiMediaNoirMergeHistoricalInput(file, 'unknown'), 'unknown'); noirRefusals++;
}
console.log(JSON.stringify({ phase: 'PASS_EXACT_DUAL_PARENT_NOIR_WIKI_MERGE_SOURCE_ONLY', files: noirMergeFiles.length,
  positives: noirPositives, refusals: noirRefusals, hunks: noirHunks, nativeAdmission: false, runtimeAdmission: false }));
