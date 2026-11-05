// Closed source controls only; fixtures never qualify current runtime or native execution.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { CONTRACT_RELEASE_SOURCE_DATA as data } from '../tools/contract-release-source-data.js';
import { assertContractReleaseSourceDefinition, assertContractReleaseSourceTransfer,
  contractReleaseDeskInput, contractReleaseFeeInput, CONTRACT_RELEASE_MIN_CONTEXT_LINES,
  CONTRACT_RELEASE_MAX_CONTEXT_LINES } from '../tools/contract-release-source-transfer.js';
import { contractReleaseSourceDataBytes, resolveContractReleasePrototypeOutput,
  deriveContractReleaseReviewedSource, deriveContractReleaseInverseHunks, CONTRACT_RELEASE_MOBILE_ORIGIN, CONTRACT_RELEASE_ETH_ORIGIN,
  contractReleaseReviewedOrigins, deriveContractReleaseApprovedSource,
  assertContractReleaseApprovedSource } from '../tools/generate-contract-release-source-transfer.js';
import { businessDeskHistoricalInput } from '../tools/businessdesk-source-transfer.js';
import { assertDeedAllocationSourceTransfer } from '../tools/deed-allocation-source-transfer.js';
import { assertMarketFeeCopySourceTransfer } from '../tools/market-fee-copy-source-transfer.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const blob = value => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(value) + '\0').update(value).digest('hex');
const lf = value => value.replaceAll('\r\n', '\n');
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], {
  cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024,
});
const gitInverses = (before, after, contextLines = 3) => {
  const result = []; let hunk;
  for (const line of lf(git('diff', '--no-ext-diff', '--unified=' + contextLines, before, after)).split('\n')) {
    if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; result.push(hunk); }
    else if (hunk && /^[ +\-]/.test(line)) {
      if (line[0] !== '-') hunk.current += line.slice(1) + '\n';
      if (line[0] !== '+') hunk.baseline += line.slice(1) + '\n';
    }
  }
  return result;
};
const assertMeasuredInverses = (target, currentPin) => assert.deepEqual(target.inverses,
  gitInverses(target.pin.blob, currentPin.blob, target.contextLines),
  'Only complete independently measured Git inverse hunks at the declared context width');
const fields = (file, text, raw = false) => ({ file, mode: '100644', blob: blob(text), sha256: sha(text),
  bytes: Buffer.byteLength(text), ...(raw ? { rawSha256: { lf: sha(text), crlf: sha(text.replaceAll('\n', '\r\n')) } } : {}) });
const history = ['tools/enterprise-native-ux-b35-inputs.js', 'tools/enterprise-native-ux-inputs.js',
  'tools/businessdesk-deed-native-inputs.js', 'tools/enterprise-native-deed-inputs.js'];
const fixtureFile = 'docs/closed-source-fixture.md', current = 'alpha\ncurrent delta\nomega\n';
const desk = 'alpha\noriginal Desk\nomega\n', fee = 'alpha\nreviewed fee\nomega\n';
const fixture = {
  version: 1, status: 'BOUND', phase: 'EXACT_CONTRACT_RELEASE_SOURCE_ONLY',
  reviewedContractRevision: 'd70c17d2cd9eb613e8695caf8c6dfc0b60a64a9e',
  reviewedUiRevision: 'f3b1fe4768fe2a6ef18dba5edb45bfdb090a04b7',
  baseRevision: '1'.repeat(40), baseTree: '2'.repeat(40), sourceRevision: '3'.repeat(40), sourceTree: '4'.repeat(40),
  historicalManifests: Object.fromEntries(history.map(file => [file, { file, mode: '100644', blob: 'a'.repeat(40), sha256: 'b'.repeat(64) }])),
  nativeChanges: {}, approvedAdditions: {},
  sourceViews: { [fixtureFile]: { current: fields(fixtureFile, current, true), targets: {
    desk: { revision: '1'.repeat(40), pin: fields(fixtureFile, desk), contextLines: 3, inverses: [{ current, baseline: desk }] },
    fee: { revision: 'd70c17d2cd9eb613e8695caf8c6dfc0b60a64a9e', pin: fields(fixtureFile, fee), contextLines: 3, inverses: [{ current, baseline: fee }] },
  } } },
};
const helperText = fs.readFileSync(path.join(root, 'tools/contract-release-source-transfer.js'), 'utf8');
const directories = [];
let positives = 0, refusals = 0, malformedDefinitions = 0, provisionalCompositions = 0, expandedContextRegressions = 0, mobileOriginCompositions = 0;
const tempModule = async (value, mutate = '') => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'omerta-contract-source-controls-'));
  directories.push(directory);
  fs.writeFileSync(path.join(directory, 'package.json'), '{"type":"module"}\n');
  fs.writeFileSync(path.join(directory, 'contract-release-source-transfer.js'), helperText);
  const source = "import crypto from 'node:crypto';\nconst value = " + JSON.stringify(value) + ';\n' + mutate + '\n'
    + "const freeze = v => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };\n"
    + 'export const CONTRACT_RELEASE_SOURCE_DATA = freeze(value);\n'
    + "export const CONTRACT_RELEASE_SOURCE_DATA_SHA256 = crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');\n";
  fs.writeFileSync(path.join(directory, 'contract-release-source-data.js'), source);
  return import(pathToFileURL(path.join(directory, 'contract-release-source-transfer.js')).href);
};
const refused = operation => { assert.throws(operation); refusals++; };

try {
  assert.strictEqual(assertContractReleaseSourceDefinition(), data);
  assert.equal(lf(fs.readFileSync(path.join(root, 'tools/contract-release-source-data.js'), 'utf8')),
    contractReleaseSourceDataBytes(data).toString('utf8'), 'Data is the exact canonical declaration, not executable extra source');
  refused(() => assertContractReleaseSourceDefinition(structuredClone(data)));
  if (data.status === 'UNBOUND') {
    refused(() => assertContractReleaseSourceTransfer(fixtureFile, current));
    for (const input of [current, Buffer.from(current), null, Buffer.from([255])]) {
      assert.strictEqual(contractReleaseDeskInput(fixtureFile, input), input);
      assert.strictEqual(contractReleaseFeeInput(fixtureFile, input), input); positives++;
    }
  } else {
    assert.equal(git('rev-parse', data.sourceRevision + '^{tree}').trim(), data.sourceTree);
    assert.equal(git('rev-parse', data.baseRevision + '^{tree}').trim(), data.baseTree);
    git('merge-base', '--is-ancestor', data.sourceRevision, 'HEAD');
    for (const [file, row] of Object.entries(data.sourceViews)) {
      const filename = path.join(root, file), stat = fs.lstatSync(filename);
      assert(stat.isFile() && !stat.isSymbolicLink());
      assert.equal(git('ls-tree', 'HEAD', '--', file).trim(), row.current.mode + ' blob ' + row.current.blob + '\t' + file);
      const physical = fs.readFileSync(filename), text = lf(physical.toString('utf8'));
      for (const [view, target] of Object.entries(row.targets)) {
        const expected = lf(git('show', target.revision + ':' + file));
        assertMeasuredInverses(target, row.current);
        assert.equal(deriveContractReleaseInverseHunks({ pin: target.pin, bytes: Buffer.from(expected) },
          { pin: row.current, bytes: Buffer.from(text) }).contextLines, target.contextLines, 'Smallest valid bounded context width');
        for (const input of [physical, text, text.replaceAll('\n', '\r\n')]) {
          const proof = assertContractReleaseSourceTransfer(file, input, view);
          assert.equal(proof.baselineText, expected);
          assert.equal(proof.contextLines, target.contextLines);
          assert.deepEqual([proof.sourceOnly, proof.runtime, proof.native], [true, false, false]); positives++;
        }
        for (const changed of [text + '\n', text.slice(1), '\ufeff' + text, text + '\0', text.replace(/\S/, '?')])
          refused(() => assertContractReleaseSourceTransfer(file, changed, view));
      }
    }
  }

  const synthetic = await tempModule(fixture);
  assert.equal(synthetic.assertContractReleaseSourceDefinition().status, 'BOUND');
  for (const [view, expected] of [['desk', desk], ['fee', fee]]) {
    const project = view === 'desk' ? synthetic.contractReleaseDeskInput : synthetic.contractReleaseFeeInput;
    for (const input of [current, current.replaceAll('\n', '\r\n'), Buffer.from(current), Buffer.from(current.replaceAll('\n', '\r\n'))]) {
      const proof = synthetic.assertContractReleaseSourceTransfer(fixtureFile, input, view);
      assert.equal(proof.baselineText, expected);
      assert.equal(proof.contextLines, 3);
      assert.deepEqual([proof.sourceOnly, proof.runtime, proof.native], [true, false, false]);
      assert(Object.isFrozen(proof)); refused(() => { proof.native = true; });
      assert.deepEqual(project(fixtureFile, input), Buffer.isBuffer(input) ? Buffer.from(expected) : expected); positives++;
    }
    for (const changed of [current + '\n', current.slice(1), current.slice(0, -1), '\ufeff' + current,
      current + '\0', current.replace('\n', '\r\n'), current.replace('\n', '\r'), current.replace('delta', 'tampered')]) {
      refused(() => synthetic.assertContractReleaseSourceTransfer(fixtureFile, changed, view));
      assert.strictEqual(project(fixtureFile, changed), changed);
    }
    refused(() => synthetic.assertContractReleaseSourceTransfer(fixtureFile, Buffer.from([0xc3, 0x28]), view));
  }
  for (const file of ['__proto__', 'constructor', '../docs/closed-source-fixture.md', 'unknown', null, {}, 7]) {
    refused(() => synthetic.assertContractReleaseSourceTransfer(file, current));
    const invalid = Buffer.from([255]); assert.strictEqual(synthetic.contractReleaseDeskInput(file, invalid), invalid);
  }
  refused(() => synthetic.assertContractReleaseSourceTransfer(fixtureFile, current, 'runtime'));
  refused(() => synthetic.assertContractReleaseSourceTransfer(fixtureFile, current, 'desk', fixture));

  const first = 'a\nb\nc\nfirst delta\ne\nf\ng\n', second = 'h\ni\nj\nsecond delta\nl\nm\nn\n';
  const middle = Array.from({ length: 8 }, (_, index) => 'bridge' + index).join('\n') + '\n';
  const twoCurrent = first + middle + second, twoDesk = twoCurrent.replace('first delta', 'first prior').replace('second delta', 'second prior');
  const twoHunks = structuredClone(fixture);
  twoHunks.sourceViews[fixtureFile] = { current: fields(fixtureFile, twoCurrent, true), targets: {
    desk: { revision: fixture.baseRevision, pin: fields(fixtureFile, twoDesk), contextLines: 3, inverses: [
      { current: first, baseline: first.replace('first delta', 'first prior') },
      { current: second, baseline: second.replace('second delta', 'second prior') },
    ] },
  } };
  const multi = await tempModule(twoHunks);
  assert.equal(multi.assertContractReleaseSourceTransfer(fixtureFile, twoCurrent).baselineText, twoDesk); positives++;
  for (const mutate of [
    "value.sourceViews['" + fixtureFile + "'].targets.desk.inverses.reverse();",
    "value.sourceViews['" + fixtureFile + "'].targets.desk.inverses.push(value.sourceViews['" + fixtureFile + "'].targets.desk.inverses[0]);",
    "value.sourceViews['" + fixtureFile + "'].targets.desk.inverses.shift();",
    "value.sourceViews['" + fixtureFile + "'].targets.desk.inverses[0].current = " + JSON.stringify(twoCurrent) + ';',
    "value.sourceViews['" + fixtureFile + "'].targets.desk.inverses[0].current = value.sourceViews['" + fixtureFile + "'].targets.desk.inverses[0].current.replace('a\\n', 'A\\n');",
  ]) {
    const module = await tempModule(twoHunks, mutate);
    refused(() => module.assertContractReleaseSourceTransfer(fixtureFile, twoCurrent)); malformedDefinitions++;
  }

  // These are explicitly provisional Git fixtures, not accepted current-source bindings.
  const provisional = structuredClone(fixture);
  provisional.baseRevision = '5b2d2dc2048d0589a49edbb16c406e4ea9edc3fa';
  provisional.baseTree = git('rev-parse', provisional.baseRevision + '^{tree}').trim();
  provisional.sourceRevision = 'b4b567e9014b3cd900603af9a971f723f9352f75';
  provisional.sourceTree = git('rev-parse', provisional.sourceRevision + '^{tree}').trim();
  provisional.sourceViews = {};
  for (const file of ['docs/WIKI.md', 'public/index.html']) {
    const combined = lf(git('show', provisional.sourceRevision + ':' + file));
    const deskText = lf(git('show', provisional.baseRevision + ':' + file));
    const feeText = lf(git('show', provisional.reviewedContractRevision + ':' + file));
    provisional.sourceViews[file] = { current: fields(file, combined, true), targets: {
      desk: { revision: provisional.baseRevision, pin: fields(file, deskText), contextLines: 3, inverses: gitInverses(blob(deskText), blob(combined)) },
      fee: { revision: provisional.reviewedContractRevision, pin: fields(file, feeText), contextLines: 3, inverses: gitInverses(blob(feeText), blob(combined)) },
    } };
    for (const target of Object.values(provisional.sourceViews[file].targets)) {
      const derived = deriveContractReleaseInverseHunks({ pin: target.pin, bytes: Buffer.from(git('show', target.pin.blob)) },
        { pin: provisional.sourceViews[file].current, bytes: Buffer.from(combined) });
      assert.equal(derived.contextLines, 3, 'Unique U3 targets retain the default width');
      assert.deepEqual(derived.inverses, target.inverses); positives++;
    }
  }
  const composed = await tempModule(provisional);
  for (const file of Object.keys(provisional.sourceViews)) {
    const combined = lf(git('show', provisional.sourceRevision + ':' + file));
    const deskView = composed.contractReleaseDeskInput(file, combined);
    const feeView = composed.contractReleaseFeeInput(file, combined);
    const viaDesk = assertDeedAllocationSourceTransfer(file, businessDeskHistoricalInput(file, deskView)).baselineText;
    const viaFee = assertMarketFeeCopySourceTransfer(file, feeView).baselineText;
    const old = lf(git('show', 'b35dd222054f0c5f3ca814f228dd7d9a46c58ae9:' + file));
    assert.equal(viaDesk, old); assert.equal(viaFee, old); provisionalCompositions++; positives += 2;
  }

  // The actual repeated compiler metadata requires expansion; this remains an unaccepted source-only fixture.
  const expanded = structuredClone(fixture), artifactFile = 'public/genesis-deploy-artifact.js';
  expanded.baseRevision = '72dfd0f0174322721973de980292c3262c1707d0';
  expanded.baseTree = git('rev-parse', expanded.baseRevision + '^{tree}').trim();
  expanded.sourceRevision = '45f5418ed34614621a54fd49bf5cb8f5f8207cf6';
  expanded.sourceTree = git('rev-parse', expanded.sourceRevision + '^{tree}').trim();
  const artifactCurrent = git('show', expanded.sourceRevision + ':' + artifactFile);
  const artifactBefore = git('show', expanded.baseRevision + ':' + artifactFile);
  const artifactCurrentPin = fields(artifactFile, artifactCurrent, true), artifactBeforePin = fields(artifactFile, artifactBefore);
  const artifactHunks = deriveContractReleaseInverseHunks({ pin: artifactBeforePin, bytes: Buffer.from(artifactBefore) },
    { pin: artifactCurrentPin, bytes: Buffer.from(artifactCurrent) });
  assert.equal(artifactHunks.contextLines, 10); assert.equal(artifactHunks.inverses.length, 7);
  assert.equal(artifactBeforePin.sha256, 'cf28ec010278929120aa74e1b064a62ad17649b2815f5a2ba5c1476e1b8567af');
  for (let width = CONTRACT_RELEASE_MIN_CONTEXT_LINES; width < artifactHunks.contextLines; width++)
    assert(gitInverses(artifactBeforePin.blob, artifactCurrentPin.blob, width)
      .some(hunk => artifactCurrent.split(hunk.current).length !== 2), 'Every narrower width retains a repeated complete context');
  expanded.sourceViews = { [artifactFile]: { current: artifactCurrentPin, targets: {
    desk: { revision: expanded.baseRevision, pin: artifactBeforePin, ...artifactHunks },
  } } };
  const artifactTarget = expanded.sourceViews[artifactFile].targets.desk;
  assertMeasuredInverses(artifactTarget, artifactCurrentPin);
  refused(() => assertMeasuredInverses({ ...artifactTarget, contextLines: 3 }, artifactCurrentPin));
  const expandedModule = await tempModule(expanded);
  for (const input of [artifactCurrent, artifactCurrent.replaceAll('\n', '\r\n'), Buffer.from(artifactCurrent)]) {
    const proof = expandedModule.assertContractReleaseSourceTransfer(artifactFile, input);
    assert.equal(proof.baselineText, artifactBefore); assert.equal(proof.contextLines, 10);
    assert.deepEqual([proof.sourceOnly, proof.runtime, proof.native], [true, false, false]); positives++;
  }
  for (const changed of [artifactCurrent.replace('stateMutability', 'stateMutabilitY'), artifactCurrent + '\n'])
    refused(() => expandedModule.assertContractReleaseSourceTransfer(artifactFile, changed));
  const ambiguous = structuredClone(expanded);
  ambiguous.sourceViews[artifactFile].targets.desk.contextLines = 3;
  ambiguous.sourceViews[artifactFile].targets.desk.inverses = gitInverses(artifactBeforePin.blob, artifactCurrentPin.blob);
  const ambiguousModule = await tempModule(ambiguous);
  refused(() => ambiguousModule.assertContractReleaseSourceTransfer(artifactFile, artifactCurrent));
  for (const mutate of [
    "value.sourceViews['" + artifactFile + "'].targets.desk.inverses.reverse();",
    "value.sourceViews['" + artifactFile + "'].targets.desk.inverses.shift();",
    "value.sourceViews['" + artifactFile + "'].targets.desk.inverses.push(value.sourceViews['" + artifactFile + "'].targets.desk.inverses[0]);",
  ]) {
    const module = await tempModule(expanded, mutate);
    refused(() => module.assertContractReleaseSourceTransfer(artifactFile, artifactCurrent));
  }
  expandedContextRegressions++;

  const malformed = [
    "value.sourceViews['" + fixtureFile + "'].extra = true;",
    "value.sourceViews['" + fixtureFile + "'][Symbol('hidden')] = true;",
    "Object.setPrototypeOf(value.sourceViews['" + fixtureFile + "'], { inherited: true });",
    "Object.defineProperty(value.sourceViews['" + fixtureFile + "'].current, 'sha256', { enumerable: true, get() { return '" + sha(current) + "'; } });",
    "Object.defineProperty(value.sourceViews['" + fixtureFile + "'].current, 'file', { enumerable: false, value: '" + fixtureFile + "' });",
    "value.sourceViews['" + fixtureFile + "'].targets.desk.inverses.extra = true;",
    "delete value.sourceViews['" + fixtureFile + "'].targets.desk.inverses[0];",
    "value.sourceViews['" + fixtureFile + "'].current.mode = '120000';",
    "value.sourceViews['" + fixtureFile + "'].targets.desk.revision = '9'.repeat(40);",
    "delete value.sourceViews['" + fixtureFile + "'].targets.desk.contextLines;",
    "value.sourceViews['" + fixtureFile + "'].targets.desk.contextLines = 2;",
    "value.sourceViews['" + fixtureFile + "'].targets.desk.contextLines = 65;",
    "value.sourceViews['" + fixtureFile + "'].targets.desk.contextLines = 3.5;",
    "value.sourceViews['" + fixtureFile + "'].targets.desk.contextLines = '3';",
    "value.sourceViews['" + fixtureFile + "'].targets.desk.contextLines = NaN;",
    "value.sourceViews['" + fixtureFile + "'].targets.runtime = value.sourceViews['" + fixtureFile + "'].targets.desk;",
    "value.sourceViews['tools/contract-release-source-data.js'] = value.sourceViews['" + fixtureFile + "'];",
    "value.sourceViews['tools/enterprise-native-contract-release-inputs.js'] = value.sourceViews['" + fixtureFile + "'];",
    "value.sourceViews['tools/enterprise-native-deed-inputs.js'] = value.sourceViews['" + fixtureFile + "'];",
    "value.nativeChanges['tools/contract-release-source-data.js'] = { current: value.historicalManifests['tools/enterprise-native-deed-inputs.js'], predecessor: value.historicalManifests['tools/enterprise-native-ux-inputs.js'] };",
    "value.approvedAdditions['tools/enterprise-native-contract-release-inputs.js'] = value.historicalManifests['tools/enterprise-native-deed-inputs.js'];",
    "value.approvedAdditions['tools/enterprise-native-deed-inputs.js'] = value.historicalManifests['tools/enterprise-native-deed-inputs.js'];",
  ];
  for (const mutate of malformed) {
    const module = await tempModule(fixture, mutate);
    refused(() => module.assertContractReleaseSourceDefinition()); malformedDefinitions++;
  }
  for (const mutate of [
    "value.sourceViews['" + fixtureFile + "'].targets.desk.inverses[0].current = 'missing context\\n';",
    "value.sourceViews['" + fixtureFile + "'].targets.desk.inverses[0].baseline += 'unapproved\\n';",
  ]) {
    const module = await tempModule(fixture, mutate);
    refused(() => module.assertContractReleaseSourceTransfer(fixtureFile, current)); malformedDefinitions++;
  }
  const approvalDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'omerta-contract-source-controls-')); directories.push(approvalDirectory);
  const originalSource = 'a\nb\nc\nold fee\ne\nf\ng\nh\ni\nj\nold Desk\nl\n';
  const reviewedSource = originalSource.replace('old fee', 'reviewed fee');
  const acceptedSource = originalSource.replace('old Desk', 'accepted Desk');
  const sourceRecord = text => ({ pin: { file: fixtureFile, mode: '100644', blob: blob(text), sha256: sha(text) }, bytes: Buffer.from(text) });
  refused(() => deriveContractReleaseInverseHunks(sourceRecord(originalSource), sourceRecord(originalSource)));
  // Isolated loose objects exercise the finite cap without writing to repository objects or configuration.
  const objectsDirectory = path.join(approvalDirectory, 'objects'); fs.mkdirSync(objectsDirectory);
  const repeated = Array.from({ length: 150 }, (_, index) => 'repeated line ' + index).join('\n') + '\n';
  const capCurrent = 'one\n' + repeated + 'two\n' + repeated + 'three\n' + repeated + 'four\n';
  const capBefore = capCurrent.replace('repeated line 75\n', 'original line 75\n');
  const objectNames = [blob(capBefore), blob(capCurrent)], priorObjects = process.env.GIT_OBJECT_DIRECTORY;
  try {
    process.env.GIT_OBJECT_DIRECTORY = objectsDirectory;
    for (const text of [capBefore, capCurrent]) assert.equal(execFileSync('git', ['--no-replace-objects', 'hash-object', '-w', '--stdin'],
      { cwd: root, input: text, encoding: 'utf8', windowsHide: true }).trim(), blob(text));
    assert(gitInverses(blob(capBefore), blob(capCurrent), CONTRACT_RELEASE_MAX_CONTEXT_LINES)
      .every(hunk => capCurrent.split(hunk.current).length > 2), 'Complete contexts still repeat at the finite cap');
    assert.throws(() => deriveContractReleaseInverseHunks(sourceRecord(capBefore), sourceRecord(capCurrent)),
      /No unique ordered complete Git context within 3\.\.64/); refusals++;
  } finally {
    if (priorObjects === undefined) delete process.env.GIT_OBJECT_DIRECTORY; else process.env.GIT_OBJECT_DIRECTORY = priorObjects;
    for (const name of objectNames) fs.rmSync(path.join(objectsDirectory, name.slice(0, 2), name.slice(2)), { force: true });
    for (const prefix of new Set(objectNames.map(name => name.slice(0, 2)))) fs.rmdirSync(path.join(objectsDirectory, prefix));
    fs.rmdirSync(objectsDirectory);
  }
  assert.equal(deriveContractReleaseReviewedSource(sourceRecord(acceptedSource), sourceRecord(originalSource), sourceRecord(reviewedSource)).toString('utf8'),
    acceptedSource.replace('old fee', 'reviewed fee'), 'Independent reviewed edits retain all accepted base source'); positives++;
  assert.equal(deriveContractReleaseReviewedSource(null, null, sourceRecord(reviewedSource)).toString('utf8'), reviewedSource); positives++;
  assert.equal(deriveContractReleaseReviewedSource(sourceRecord(reviewedSource), sourceRecord(originalSource), sourceRecord(reviewedSource)).toString('utf8'), reviewedSource); positives++;
  refused(() => deriveContractReleaseReviewedSource(sourceRecord(originalSource.replace('old fee', 'conflicting fee')),
    sourceRecord(originalSource), sourceRecord(reviewedSource)));
  refused(() => deriveContractReleaseReviewedSource(null, sourceRecord(originalSource), sourceRecord(reviewedSource)));
  refused(() => deriveContractReleaseReviewedSource(sourceRecord(acceptedSource), null, sourceRecord(reviewedSource)));
  // Immutable origin fixtures preserve the exact C5 base and ordered contract-then-mobile approval.
  const mobileFiles = ['public/index.html', 'public/omerta-ui.css', 'tools/mobile.js', 'tools/public-ui.js'];
  const mobileRevision = '6c4d37842f4d7ebd7f96d5fee9935720f442007a', mobileBase = '4fc2f4100dbe0dca019cab2c4a13b18e5bee93e5';
  assert.deepEqual(CONTRACT_RELEASE_MOBILE_ORIGIN, { revision: mobileRevision, baseRevision: mobileBase, files: mobileFiles });
  assert(Object.isFrozen(CONTRACT_RELEASE_MOBILE_ORIGIN) && Object.isFrozen(CONTRACT_RELEASE_MOBILE_ORIGIN.files));
  refused(() => { CONTRACT_RELEASE_MOBILE_ORIGIN.files.push('src/server.js'); });
  const origins = contractReleaseReviewedOrigins('public/index.html');
  assert(Object.isFrozen(origins)); refused(() => { origins.reverse(); });
  assert.deepEqual(origins.map(({ revision, baseRevision }) => ({ revision, baseRevision })), [
    { revision: fixture.reviewedContractRevision, baseRevision: 'c4b626b631b04e594097fb6bb416c36fdfea00f3' },
    { revision: mobileRevision, baseRevision: mobileBase },
    { revision: CONTRACT_RELEASE_ETH_ORIGIN.revision, baseRevision: CONTRACT_RELEASE_ETH_ORIGIN.baseRevision },
  ]);
  assert.deepEqual(contractReleaseReviewedOrigins('test/ux-expanded-browser.js'), [
    { revision: fixture.reviewedUiRevision, baseRevision: fixture.reviewedContractRevision },
  ], 'The independent typography origin remains unchanged');
  const expectedMobileSha256 = {
    'public/index.html': '66fff9739ffabc3b1b0321c43b48973452230f0cca17acf1241fb71759562c0b',
    'public/omerta-ui.css': '4daa6519dfb0b6eaf327e6442a35af74fe7b6d127fdebd04f3a66924ad46841e',
    'tools/mobile.js': 'd8ab341221bca964f33614d76df1d3470d614b609482bbcf06da35e96050b8cb',
    'tools/public-ui.js': '3ca027b9fcc536903f71e0055ae7825ed87bbf102c7e2f332e771038ef4d82e3',
  };
  const originRecord = (file, bytes) => ({ pin: { file, mode: '100644', blob: blob(bytes), sha256: sha(bytes) }, bytes: Buffer.from(bytes) });
  const committedOriginRecord = (revision, file) => {
    const row = originRecord(file, Buffer.from(git('show', revision + ':' + file)));
    assert.equal(git('ls-tree', revision, '--', file).trim(), '100644 blob ' + row.pin.blob + '\t' + file); return row;
  };
  for (const file of mobileFiles) {
    const base = committedOriginRecord('de84c0f7b3dfb18b8cb44e9b3a4563ad890d0660', file);
    let mobileStage = base;
    for (const origin of contractReleaseReviewedOrigins(file).filter(row => row !== CONTRACT_RELEASE_ETH_ORIGIN)) {
      const bytes = deriveContractReleaseReviewedSource(mobileStage, committedOriginRecord(origin.baseRevision, file), committedOriginRecord(origin.revision, file));
      mobileStage = originRecord(file, bytes);
    }
    assert.equal(mobileStage.pin.sha256, expectedMobileSha256[file], 'Independent pre-ETH mobile composition fixture hash remains unchanged');
    const expected = deriveContractReleaseApprovedSource(file, base);
    assert.equal(expected.pin.mode, '100644');
    assert.deepEqual(assertContractReleaseApprovedSource(file, base, expected), expected); positives++;
    for (const bytes of [Buffer.concat([expected.bytes, Buffer.from('\n')]), expected.bytes.subarray(1),
      Buffer.from(expected.bytes.toString('utf8').replace(/\S/, '?'))])
      refused(() => assertContractReleaseApprovedSource(file, base, originRecord(file, bytes)));
    refused(() => assertContractReleaseApprovedSource(file, base, { ...expected, pin: { ...expected.pin, mode: '100755' } }));
    if (file !== 'public/index.html') assert.deepEqual(contractReleaseReviewedOrigins(file), [CONTRACT_RELEASE_MOBILE_ORIGIN]);
    mobileOriginCompositions++;
  }
  const indexBase = committedOriginRecord('de84c0f7b3dfb18b8cb44e9b3a4563ad890d0660', 'public/index.html');
  const contractOnlyIndex = deriveContractReleaseReviewedSource(indexBase,
    committedOriginRecord('c4b626b631b04e594097fb6bb416c36fdfea00f3', 'public/index.html'),
    committedOriginRecord(fixture.reviewedContractRevision, 'public/index.html'));
  const mobileOnlyIndex = deriveContractReleaseReviewedSource(indexBase,
    committedOriginRecord(mobileBase, 'public/index.html'), committedOriginRecord(mobileRevision, 'public/index.html'));
  for (const bytes of [contractOnlyIndex, mobileOnlyIndex])
    refused(() => assertContractReleaseApprovedSource('public/index.html', indexBase, originRecord('public/index.html', bytes)));
  assert.deepEqual(contractReleaseReviewedOrigins('src/server.js'), [CONTRACT_RELEASE_ETH_ORIGIN], 'Server ETH edits use a fixed origin, never integration approval');
  for (const file of ['src/server.js.extra', 'tools/mobile.js.extra', '../tools/mobile.js']) {
    assert.deepEqual(contractReleaseReviewedOrigins(file), []);
    refused(() => deriveContractReleaseApprovedSource(file, null));
  }
  // Exact ETH origin/postimage controls preserve all pre-ETH source pins and refusal checks.
  assert.deepEqual(CONTRACT_RELEASE_ETH_ORIGIN, { revision: '03d6a65a9f9ffaaca2573b15236592ade91de0ea', baseRevision: 'd70c17d2cd9eb613e8695caf8c6dfc0b60a64a9e', files: [".github/workflows/forge.yml","docs/WIKI.md","public/defi.html","public/eth-staking.js","public/fee-flows.html","public/genesis-deploy-artifact.js","public/genesis-deploy-client.js","public/index.html","public/wiki.html","src/data/market-v2-eth-abis.json","src/ethrewardsworker.js","src/ethstaking.js","src/genesisauction.js","src/marketv2abi.js","src/marketv2keeper.js","src/preflight.js","src/routes/ethstaking.js","src/server.js","src/worker.js","test/native-eth-source-transfer.js","tools/economy-hardening-source-transfer.js","tools/generate-native-eth-source-transfer.js","tools/genesis-auction-deployment-plan.js","tools/genesis-auction-preflight.js","tools/genesis-fee-readiness-source-transfer.js","tools/market-fee-copy-source-transfer.js","tools/market-v2-deployment-plan.js","tools/native-eth-source-transfer.js"] });
  assert(Object.isFrozen(CONTRACT_RELEASE_ETH_ORIGIN) && Object.isFrozen(CONTRACT_RELEASE_ETH_ORIGIN.files));
  refused(() => { CONTRACT_RELEASE_ETH_ORIGIN.files.push('src/unreviewed.js'); });
  const expectedEthSha256 = {
    ".github/workflows/forge.yml": "e97eb70c6e22fc816815f425afc1a5408e42aac7b98e0393f2f4ed3249eadfb4",
    "docs/WIKI.md": "36c3a44a1f85feb37763b873621d22349ff695625e4d7dc68d83bb81b2e41ba1",
    "public/defi.html": "bed20d7697d39a5d2ce600f136df8f1840bcc013465db504d397ce9967538d7e",
    "public/eth-staking.js": "1e06327f1195d33b44b0add5d1a31156aae94fca6b108e7890c17f7a34264733",
    "public/fee-flows.html": "1d97e7cc9422714b3e2fcb2400789b05281bec65d8c3baf9a5397e1df03a7091",
    "public/genesis-deploy-artifact.js": "357e7d0c50538e0662356d17e2eb2325fc00a73198905048c59a0d6574730920",
    "public/genesis-deploy-client.js": "e7ec082a630554358b4b6a70888e9bd1281b0de99735ab0e7950c8cdbb879ad8",
    "public/index.html": "af3101856f3b6fa0ba5c8be85c917f38cb8ded1220640c40941d2369c3b8d868",
    "public/wiki.html": "4a491d75fde3b1c687b904afd5f8d55f2a0ebec491f8b25909df8c0db8280068",
    "src/data/market-v2-eth-abis.json": "92486df4310b1357114f44b959ac015a3e74e0f0307eb675d1d61e9c44700d82",
    "src/ethrewardsworker.js": "715e53bb4fcff992947d19312b63e9c942131566a476f1325ff30ceb26f54df8",
    "src/ethstaking.js": "7740bb5c022a8f0f40dfe2a99063dfd998d076bf38d2716d7a3c057ef3e1d764",
    "src/genesisauction.js": "b29b7760a29cc3f7ddebbc615d21b38861fc8c3b70da6d957f6e77400a77e701",
    "src/marketv2abi.js": "21318015f11fddd27763ef447a557944c90273cf9cbb767d6af8f01a0ec80efe",
    "src/marketv2keeper.js": "b660b2552658acbc1722b4f74a00ca98c5d0ad84e59d284e3d5e3ee6d68c79f3",
    "src/preflight.js": "519547750876ef4af87309e46b28fd1069295d35ed3a6bf8da70038f46c59d93",
    "src/routes/ethstaking.js": "4430a71e2344506da9036f621a97d61b45c052ded250811ab5c26b346c82d9e8",
    "src/server.js": "794525ae2c5dc58f2eb4d470e29d32946e7c28b14764fe87d5ed1306f770ab59",
    "src/worker.js": "f1fb6fb9bd0330d807e5c93f61acdb7dc81813728a159bffe133ea909bb60438",
    "test/native-eth-source-transfer.js": "9475ba47d6a654aa55491de9d9ca50a721d089ed4e6095eb287566db3121b8d3",
    "tools/economy-hardening-source-transfer.js": "49feced87ed91a9bbf37ac1a144a35db330c49e99bf2cd6eacb3909feb13b68e",
    "tools/generate-native-eth-source-transfer.js": "8479ac64cb7fcd87160b462cdea41e8a75adf5df9fc5b57afdb97e0aecdb6199",
    "tools/genesis-auction-deployment-plan.js": "8795d16d31aa6a2120d2e87f47d1c1e60dd1bf418da3ab54086fc3fa0db35df1",
    "tools/genesis-auction-preflight.js": "9288a39bd2e1d85d47caa84b7af14fa513030682b246856b93c8098350561246",
    "tools/genesis-fee-readiness-source-transfer.js": "ee095fbd7dc2f1f5147581ef866294633ac831494d7af656d39020eb0ca6d591",
    "tools/market-fee-copy-source-transfer.js": "c68ab063466637512b4e437c36aa638c9c0fac438e532576ecf0e2a8affdaf9f",
    "tools/market-v2-deployment-plan.js": "9ff049e8cf56b6acceca5da1100964454183a4c21aa84f4f3d97383c56f5297a",
    "tools/native-eth-source-transfer.js": "73f00e4620cbfdf4ca3ed54ef36c2e952a7b5408fe1a99b0c1e0993dd775b1e5"
  };
  for (const file of CONTRACT_RELEASE_ETH_ORIGIN.files) {
    const baseRevision = 'de84c0f7b3dfb18b8cb44e9b3a4563ad890d0660';
    const base = git('ls-tree', baseRevision, '--', file).trim() ? committedOriginRecord(baseRevision, file) : null;
    const expected = deriveContractReleaseApprovedSource(file, base);
    assert.equal(expected.pin.sha256, expectedEthSha256[file], 'Independent immutable ETH composition postimage');
    assert.deepEqual(assertContractReleaseApprovedSource(file, base, expected), expected); positives++;
    for (const bytes of [Buffer.concat([expected.bytes, Buffer.from('unreviewed\n')]), expected.bytes.subarray(1), Buffer.from(expected.bytes.toString('utf8').replace(/\S/, '?'))])
      refused(() => assertContractReleaseApprovedSource(file, base, originRecord(file, bytes)));
    refused(() => assertContractReleaseApprovedSource(file, base, { ...expected, pin: { ...expected.pin, mode: '100755' } }));
  }
  const fixtureRepository = path.join(approvalDirectory, 'repository'), redirect = path.join(approvalDirectory, 'redirect');
  fs.mkdirSync(fixtureRepository);
  fs.symlinkSync(fixtureRepository, redirect, process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal(resolveContractReleasePrototypeOutput(path.join(approvalDirectory, 'external.json'), fixtureRepository),
    path.join(fs.realpathSync(approvalDirectory), 'external.json')); positives++;
  refused(() => resolveContractReleasePrototypeOutput(path.join(fixtureRepository, 'inside.json'), fixtureRepository));
  refused(() => resolveContractReleasePrototypeOutput(path.join(redirect, 'inside.json'), fixtureRepository));
  assert(!fs.existsSync(path.join(fixtureRepository, 'inside.json')));
  const approvalPath = path.join(approvalDirectory, 'integration.json'), outputPath = path.join(approvalDirectory, 'prototype.json');
  for (const file of [...new Set(['src/unapproved.js', ...mobileFiles, ...CONTRACT_RELEASE_ETH_ORIGIN.files])]) {
    fs.writeFileSync(approvalPath, JSON.stringify({ version: 1, sourceRevision: 'd70c17d2cd9eb613e8695caf8c6dfc0b60a64a9e',
      pins: { [file]: { file, mode: '100644', blob: 'a'.repeat(40), sha256: 'b'.repeat(64) } } }));
    const generator = spawnSync(process.execPath, [path.join(root, 'tools/generate-contract-release-source-transfer.js'),
      '--prototype', '--source=d70c17d2cd9eb613e8695caf8c6dfc0b60a64a9e', '--base=c4b626b631b04e594097fb6bb416c36fdfea00f3',
      '--integration-pins=' + approvalPath, '--output=' + outputPath], { cwd: root, encoding: 'utf8', windowsHide: true });
    assert.notEqual(generator.status, 0); assert(generator.stderr.includes('No unlisted integration approval'),
      'Fixed origins cannot be bypassed by an integration approval: ' + file);
    assert(!fs.existsSync(outputPath)); refusals++;
  }
  console.log(JSON.stringify({ phase: 'CONTRACT_RELEASE_SOURCE_CONTROLS', status: data.status,
    positives, refusals, malformedDefinitions, provisionalCompositions, expandedContextRegressions, mobileOriginCompositions,
    contextBounds: [CONTRACT_RELEASE_MIN_CONTEXT_LINES, CONTRACT_RELEASE_MAX_CONTEXT_LINES], currentBindingAccepted: data.status === 'BOUND',
    fixtureScope: 'Synthetic exact source-text controls; no native/runtime/financial qualification',
    runtime: false, native: false }));
} finally {
  for (const directory of directories) {
    assert(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
    assert(/^omerta-contract-source-controls-/.test(path.basename(directory)));
    for (const file of ['package.json', 'contract-release-source-transfer.js', 'contract-release-source-data.js', 'integration.json', 'prototype.json'])
      fs.rmSync(path.join(directory, file), { force: true });
    const redirect = path.join(directory, 'redirect'), fixtureRepository = path.join(directory, 'repository');
    if (fs.existsSync(redirect)) { assert(fs.lstatSync(redirect).isSymbolicLink()); fs.unlinkSync(redirect); }
    if (fs.existsSync(fixtureRepository)) fs.rmdirSync(fixtureRepository);
    fs.rmdirSync(directory);
  }
}
