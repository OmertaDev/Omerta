import { CONTRACT_RELEASE_SOURCE_DATA } from '../tools/contract-release-source-data.js';
import { contractReleaseDeskInput } from '../tools/contract-release-source-transfer.js';
// Raw current-source qualification and finite historical comparisons only. No native/runtime execution.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { BUSINESS_DESK_COMBINED_SOURCE as source, BUSINESS_DESK_COMBINED_SOURCE_SHA256 as sourceSha,
  BUSINESS_DESK_COMBINED_PROFILES as profiles, BUSINESS_DESK_COMBINED_READER_FILES as readers,
  BUSINESS_DESK_COMBINED_EXTRA_READERS as extraReaders, BUSINESS_DESK_COMBINED_SOURCE_FILES as files,
  BUSINESS_DESK_COMBINED_EXCLUDED_FILES as excluded, BUSINESS_DESK_COMBINED_PHASE as phase,
  businessDeskCombinedReaderFiles, assertBusinessDeskCombinedSourceTransfer,
  businessDeskCombinedHistoricalInput } from '../tools/businessdesk-combined-source-transfer.js';
import { BUSINESS_DESK_NOIR_SOURCE as deskNoirSource, businessDeskNoirHistoricalInput } from '../tools/businessdesk-noir-source-transfer.js';
import { BUSINESS_DESK_DOMAINS, businessDeskHistoricalInput } from '../tools/businessdesk-source-transfer.js';
import { ECONOMY_DEED_MERGE_FILES, economyDeedMergeHistoricalInput } from '../tools/economy-deed-merge-source-compatibility.js';
import { NOIR_UI_SOURCE_FILES, noirUiHistoricalInput } from '../tools/noir-ui-source-transfer.js';
import { WIKI_MEDIA_NOIR_MERGE_SOURCE as wikiNoirSource, wikiMediaNoirMergeHistoricalInput } from '../tools/wiki-media-source-transfer.js';

assert.deepEqual(process.argv.slice(2), [], 'Bare complete source-only proof; no regeneration or skip flags.');
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], {
  windowsHide: true, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
});
const text = (...args) => git(...args).toString('utf8');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const blob = value => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(value)}\0`).update(value).digest('hex');
const lf = value => value.replaceAll('\r\n', '\n');
const sortedUnion = (...values) => [...new Set(values.flat())].sort();
// Parse only the literal archived JSON definition, never execute an old module.
const literal = (revision, file, name) => {
  const code = text('show', `${revision}:${file}`), declaration = code.indexOf(`export const ${name} =`);
  assert(declaration >= 0, 'Actual frozen source namespace required: ' + name);
  const start = code.indexOf('{', declaration); let depth = 0, quoted = false, escaped = false;
  for (let index = start; index < code.length; index++) {
    const character = code[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quoted = false;
    } else if (character === '"') quoted = true;
    else if (character === '{') depth++;
    else if (character === '}' && --depth === 0) return JSON.parse(code.slice(start, index + 1));
  }
  assert.fail('Complete frozen literal definition required: ' + name);
};
assert.equal(phase, 'EXACT_MONITOR_WIKI_DESK_SOURCE_ONLY');
assert.equal(source.status, 'SEALED', 'Bind the complete clean authored source before executing this proof.');
assert.equal(source.phase, phase); assert.equal(source.version, 1); assert.equal(source.contextLines, 8);
assert.equal(source.sourceOnly, true); assert.equal(source.runtime, false); assert.equal(source.native, false);
assert.equal(sha(JSON.stringify(source)), sourceSha);
assert(Object.isFrozen(source) && Object.isFrozen(source.files) && Object.isFrozen(source.profiles));
assert.deepEqual(Object.keys(profiles), ['desk', 'monitor', 'wiki']); assert.deepEqual(source.profiles, profiles);
assert.equal(text('rev-parse', `${source.sourceRevision}^{tree}`).trim(), source.sourceTree);
git('merge-base', '--is-ancestor', source.sourceRevision, 'HEAD');
for (const parent of Object.values(profiles)) {
  assert(Object.isFrozen(parent)); assert.match(parent.revision, /^[a-f0-9]{40}$/); assert.match(parent.tree, /^[a-f0-9]{40}$/);
  assert.equal(text('rev-parse', `${parent.revision}^{tree}`).trim(), parent.tree);
  git('merge-base', '--is-ancestor', parent.revision, source.sourceRevision);
}
const noirFiles = literal(profiles.desk.revision, 'tools/noir-ui-source-data.js', 'NOIR_UI_SOURCE').files.map(row => row.file);
const expectedReaders = {
  desk: sortedUnion(Object.keys(literal(profiles.desk.revision, 'tools/businessdesk-source-transfer.js', 'BUSINESS_DESK_DOMAINS')),
    literal(profiles.desk.revision, 'tools/businessdesk-noir-source-data.js', 'BUSINESS_DESK_NOIR_SOURCE').files.map(row => row.file), noirFiles),
  monitor: sortedUnion(Object.keys(literal(profiles.monitor.revision, 'tools/economy-monitor-source-transfer.js', 'ECONOMY_MONITOR_SOURCE_DOMAINS')),
    literal(profiles.monitor.revision, 'tools/economy-deed-merge-source-data.js', 'ECONOMY_DEED_MERGE_SOURCE').files.map(row => row.file), noirFiles),
  wiki: sortedUnion(...['WIKI_MEDIA_SOURCE', 'WIKI_MEDIA_MERGE_SOURCE', 'WIKI_MEDIA_NOIR_MERGE_SOURCE']
    .map(name => Object.keys(literal(profiles.wiki.revision, 'tools/wiki-media-source-data.js', name).files))),
};
assert.deepEqual(readers, expectedReaders, 'Reader domains are the exact closed unions of the frozen parent catalogs.');
assert.deepEqual(Object.values(readers).map(value => value.length), [22, 36, 39]);
assert.deepEqual(extraReaders, { desk: [], monitor: ['test/gates.js'], wiki: [] });
assert(text('show', `${profiles.monitor.revision}:tools/economy-ux-merge-source-compatibility.js`).includes("  'test/gates.js': Object.freeze({"),
  'The sole supplemental reader is the separately pinned Monitor release-roster proof.');
assert.deepEqual(files, sortedUnion(...Object.values(readers))); assert.equal(files.length, 55);
assert(Object.isFrozen(files) && Object.isFrozen(readers) && Object.values(readers).every(Object.isFrozen));
assert(Object.isFrozen(extraReaders) && Object.values(extraReaders).every(Object.isFrozen));
for (const file of excluded) assert(!files.includes(file), 'Mutable and archived native metadata are never historical projection domains.');
const record = (revision, file) => {
  const line = text('ls-tree', '-z', revision, '--', file);
  if (!line) return null;
  const match = line.match(/^(100644|100755) blob ([a-f0-9]{40})\t([^\0]+)\0$/);
  assert(match && match[3] === file, 'An actual regular committed source is required: ' + file);
  const raw = git('show', `${revision}:${file}`), content = raw.toString('utf8');
  assert(Buffer.from(content).equals(raw)); assert(!content.includes('\r') && !content.includes('\0') && !content.includes('\ufeff'));
  assert.equal(blob(raw), match[2]);
  return { raw, content, pin: { mode: match[1], blob: match[2], sha256: sha(raw), bytes: raw.length,
    rawSha256: { lf: sha(raw), crlf: sha(content.replaceAll('\n', '\r\n')) } } };
};
const currentInputs = new Map(), expectedRows = new Map();
for (const file of files) {
  const authored = record(source.sourceRevision, file), current = record('HEAD', file);
  assert(authored && current);
  assert.equal(text('ls-files', '--stage', '--', file).trim(), current.pin.mode + ' ' + current.pin.blob + ' 0\t' + file, 'Current index identity qualifies before any historical view.');
  const stat = fs.lstatSync(file); assert(stat.isFile() && !stat.isSymbolicLink(), 'Physical comparison source must be a regular file.');
  const actualPhysical = fs.readFileSync(file), crlf = Buffer.from(current.content.replaceAll('\n', '\r\n'));
  assert(actualPhysical.equals(current.raw) || actualPhysical.equals(crlf), 'Actual complete LF/CRLF physical bytes qualify before projection: ' + file);
  const outer = CONTRACT_RELEASE_SOURCE_DATA.sourceViews[file];
  if (outer?.targets.desk) {
    const { file: domain, ...expected } = outer.current; assert.equal(domain, file);
    assert.deepEqual(current.pin, expected, 'The exact current contract source identity qualifies before the historical view');
  } else assert.deepEqual(current.pin, authored.pin, 'Unchanged current source retains the exact combined-source identity');
  const physical = contractReleaseDeskInput(file, actualPhysical);
  assert(physical.equals(authored.raw) || physical.equals(Buffer.from(authored.content.replaceAll('\n', '\r\n'))), 'The separately qualified combined source remains complete and exact');
  const parents = {};
  for (const [profile, parent] of Object.entries(profiles)) {
    if (!businessDeskCombinedReaderFiles(profile).includes(file)) continue;
    const target = record(parent.revision, file);
    if (!target || (target.pin.mode === authored.pin.mode && target.pin.blob === authored.pin.blob)) continue;
    parents[profile] = target;
  }
  if (Object.keys(parents).length) expectedRows.set(file, { authored, physical, parents });
  currentInputs.set(file, { authored, physical });
}
assert.deepEqual(source.files.map(row => row.file), [...expectedRows.keys()], 'The top view includes only actual changed parent sources inside explicit reader profiles.');
const inverseHunks = diff => {
  const rows = []; let hunk, prior;
  for (const line of diff.split('\n')) {
    if (line.startsWith('@@ ')) { hunk = { current: '', target: '' }; rows.push(hunk); }
    else if (hunk && line.startsWith('\\ No newline at end of file')) {
      if (prior !== '-') hunk.current = hunk.current.slice(0, -1);
      if (prior !== '+') hunk.target = hunk.target.slice(0, -1);
    } else if (hunk && /^[ +\-]/.test(line)) {
      prior = line[0]; if (prior !== '-') hunk.current += line.slice(1) + '\n'; if (prior !== '+') hunk.target += line.slice(1) + '\n';
    }
  }
  return rows;
};
let positives = 0, refusals = 0, hunks = 0, edges = 0;
const counts = { desk: 0, monitor: 0, wiki: 0 };
const refused = (file, input, profile, pin = source) => {
  assert.throws(() => assertBusinessDeskCombinedSourceTransfer(file, input, profile, pin), error => error?.code === 'ERR_ASSERTION'); refusals++;
};
for (const row of source.files) {
  const { authored, physical, parents } = expectedRows.get(row.file), file = row.file, current = authored.content;
  assert(Object.isFrozen(row) && Object.isFrozen(row.current) && Object.isFrozen(row.current.rawSha256) && Object.isFrozen(row.parents));
  assert.deepEqual(row.current, authored.pin); assert.deepEqual(Object.keys(row.parents), Object.keys(parents));
  for (const [profile, target] of Object.entries(parents)) {
    const parent = row.parents[profile], { inverses, ...pin } = parent;
    assert.deepEqual(pin, target.pin); assert(Object.isFrozen(parent) && Object.isFrozen(parent.rawSha256) && Object.isFrozen(inverses) && inverses.every(Object.isFrozen));
    assert.deepEqual(inverses, inverseHunks(text('diff', '--no-ext-diff', '--no-renames', '--unified=8', profiles[profile].revision, source.sourceRevision, '--', file)));
    let restored = current, end = -1;
    for (const inverse of inverses) {
      assert(inverse.current.length); assert.equal(current.split(inverse.current).length, 2);
      const at = current.indexOf(inverse.current); assert(at >= end); end = at + inverse.current.length;
      assert.equal(restored.split(inverse.current).length, 2); restored = restored.replace(inverse.current, () => inverse.target);
      for (const changed of [current.replace(inverse.current, ''), current.replace(inverse.current, () => inverse.current + inverse.current),
        current.replace(inverse.current, () => inverse.target), current.replace(inverse.current, () => inverse.current.replace(/\S/, char => char === '?' ? '!' : '?'))]) {
        assert.notEqual(changed, current, 'Every adversarial case must actually alter the complete source');
        refused(file, changed, profile);
      }
      assert.throws(() => { inverse.current = 'unreviewed'; }, TypeError); hunks++;
    }
    assert.equal(restored, target.content, 'Ordered complete inverses reconstruct the exact full frozen parent source.');
    for (const input of [current, current.replaceAll('\n', '\r\n'), physical.toString('utf8')]) {
      const proof = assertBusinessDeskCombinedSourceTransfer(file, input, profile);
      assert(Object.isFrozen(proof)); assert.equal(proof.file, file); assert.equal(proof.targetText, target.content);
      assert.equal(proof.profile, profile); assert.equal(proof.parentRevision, profiles[profile].revision);
      assert.equal(proof.sourceRevision, source.sourceRevision); assert.equal(proof.sourceTree, source.sourceTree);
      assert.equal(proof.inverseChunks, inverses.length); assert.equal(proof.phase, phase);
      assert.deepEqual([proof.sourceOnly, proof.runtime, proof.native], [true, false, false]);
      assert.equal(businessDeskCombinedHistoricalInput(file, input, profile), target.content);
      assert.deepEqual(businessDeskCombinedHistoricalInput(file, Buffer.from(input), profile), target.raw); positives += 3;
    }
    const mutations = [current + '\n', current.slice(1), current.slice(0, -1), '\ufeff' + current, current + '\0', current + '\ud800',
      current.replace(/\S/, '?'), current.replace('\n', '\r\n'), current.replace('\n', '\r'), current + '// arbitrary future source\n'];
    if (target.content !== current) mutations.push(target.content);
    for (const changed of mutations) {
      refused(file, changed, profile); assert.strictEqual(businessDeskCombinedHistoricalInput(file, changed, profile), changed);
      const raw = Buffer.from(changed); assert.strictEqual(businessDeskCombinedHistoricalInput(file, raw, profile), raw);
    }
    for (const malformed of [Buffer.from(current), undefined, null, [], {}, 7]) refused(file, malformed, profile);
    for (const clone of [{ ...source }, JSON.parse(JSON.stringify(source)), Object.freeze({ ...source })]) refused(file, current, profile, clone);
    assert.throws(() => businessDeskCombinedHistoricalInput(file, Buffer.concat([authored.raw, Buffer.from([0xff])]), profile), /[Ll]ossless UTF-8/); refusals++;
    assert.throws(() => { parent.blob = '0'.repeat(40); }, TypeError); counts[profile]++; edges++;
  }
}
for (const [file, { authored }] of currentInputs) for (const profile of Object.keys(profiles)) {
  if (expectedRows.get(file)?.parents[profile]) continue;
  assert.strictEqual(businessDeskCombinedHistoricalInput(file, authored.raw, profile), authored.raw, 'Unchanged, absent or out-of-profile input gains no top-level alias.');
  refused(file, authored.content, profile);
}
for (const profile of Object.keys(profiles)) {
  assert(counts[profile] > 0, 'Every frozen parent receives actual independently qualified comparisons.');
  for (const unknown of ['__proto__', 'constructor', 'toString', '../src/server.js', 'public/business-control-desk.js', ...excluded, null, undefined, {}, [], 7, Symbol('domain')]) {
    for (const input of ['unreviewed\r\nbytes\n', Buffer.from([0xff, 0, 13]), null, {}]) {
      refused(unknown, input, profile); assert.strictEqual(businessDeskCombinedHistoricalInput(unknown, input, profile), input);
    }
  }
}
for (const invalid of [undefined, null, 'all', 'native', '__proto__', {}, [], 7, Symbol('profile')]) {
  assert.throws(() => businessDeskCombinedHistoricalInput('package.json', 'unreviewed', invalid));
  refused('package.json', 'unreviewed', invalid);
}
// Exercise the outer APIs with the actual bound C6 postimages, not cloned pins.
// Each example must have a real changed top-level parent, otherwise the former
// premature projection would be unobservable and the negative case vacuous.
const changedTopParent = (file, profile) => {
  const row = source.files.find(value => value.file === file);
  return !!row?.parents[profile] && row.current.blob !== row.parents[profile].blob;
};
assert.equal(deskNoirSource.files.find(row => row.file === 'package.json')?.targetKind, 'noir');
assert(!deskNoirSource.files.some(row => row.file === 'public/omerta-ui.css'));
assert(!Object.hasOwn(BUSINESS_DESK_DOMAINS, 'public/omerta-ui.css'));
assert(!NOIR_UI_SOURCE_FILES.includes('test/gates.js'));
assert(!Object.hasOwn(wikiNoirSource.files, 'test/gates.js'));
const economyOutside = ['test/gates.js', 'public/ux-feedback.js']
  .find(file => !ECONOMY_DEED_MERGE_FILES.includes(file) && changedTopParent(file, 'monitor'));
assert(economyOutside, 'One fixed reviewed Monitor example must remain outside the inner EC file profile and have an actual changed top parent');
const outerCases = [
  { file: 'package.json', profile: 'desk', name: 'Wrong valid Desk/Noir row kind',
    read: input => businessDeskNoirHistoricalInput('package.json', input, 'business') },
  { file: 'public/omerta-ui.css', profile: 'desk', name: 'Outside Desk/Noir row',
    read: input => businessDeskNoirHistoricalInput('public/omerta-ui.css', input, 'noir') },
  { file: 'public/omerta-ui.css', profile: 'desk', name: 'Outside original Business domain',
    read: input => businessDeskHistoricalInput('public/omerta-ui.css', input) },
  { file: economyOutside, profile: 'monitor', name: 'Outside current EC integration file profile',
    read: input => economyDeedMergeHistoricalInput(economyOutside, input, 'monitor') },
  { file: 'test/gates.js', profile: 'desk', name: 'Outside Noir and its existing Wiki extension',
    read: input => noirUiHistoricalInput('test/gates.js', input) },
];
for (const [file, target] of [
  ['test/wiki-media-source-transfer.js', 'main'], ['tools/wiki-media-source-transfer.js', 'main'],
  ['test/noir-ui-source-compatibility.js', 'wiki'], ['tools/noir-ui-source-transfer.js', 'wiki'],
]) {
  assert.equal(wikiNoirSource.files[file]?.[target]?.absent, true, 'The selected Wiki target is genuinely absent');
  outerCases.push({ file, profile: 'wiki', name: 'Absent original Wiki target: ' + target,
    read: input => wikiMediaNoirMergeHistoricalInput(file, input, target) });
}
let outerBoundaryControls = 0;
for (const boundary of outerCases) {
  const { file, profile } = boundary, actual = currentInputs.get(file)?.authored;
  assert(actual, 'The case uses an actual regular HEAD/index/physical-qualified C6 source');
  assert(changedTopParent(file, profile), 'A real changed parent is required for ' + boundary.name);
  assert.notEqual(assertBusinessDeskCombinedSourceTransfer(file, actual.content, profile).targetText, actual.content,
    'The top-level projection would actually change these bytes without the outer gate');
  for (const input of [actual.content, Buffer.from(actual.raw), actual.content.replaceAll('\n', '\r\n'),
    Buffer.from(actual.content.replaceAll('\n', '\r\n'))]) {
    const snapshot = Buffer.isBuffer(input) ? Buffer.from(input) : input;
    assert.strictEqual(boundary.read(input), input, boundary.name + ' preserves original C6 string/Buffer identity');
    assert.deepEqual(input, snapshot, 'A refusal never mutates the caller input');
    outerBoundaryControls++;
  }
}
assert.equal(outerCases.length, 9); assert.equal(outerBoundaryControls, 36);
assert.throws(() => { source.files.push({ file: 'unreviewed' }); }, TypeError);
assert.throws(() => { source.sourceRevision = '0'.repeat(40); }, TypeError);
console.log(JSON.stringify({ phase, sourceRevision: source.sourceRevision, sourceTree: source.sourceTree,
  boundedReaderFiles: files.length, changedFiles: source.files.length, profileEdges: edges, profiles: counts,
  positives, refusals, inverseHunks: hunks, outerBoundaryControls, sourceOnly: true, runtime: false, native: false,
  migration: false, financial: false, activation: false, deployment: false }));
