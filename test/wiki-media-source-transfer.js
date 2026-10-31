// Exact source-only evidence for the already-authored wiki/media release. No native/runtime admission.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { WIKI_MEDIA_SOURCE, WIKI_MEDIA_SOURCE_SHA256, assertWikiMediaSourceTransfer,
  wikiMediaHistoricalInput } from '../tools/wiki-media-source-transfer.js';

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
  let current = fs.readFileSync(new URL('../' + item.file, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
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
