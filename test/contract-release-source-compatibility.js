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
  contractReleaseDeskInput, contractReleaseFeeInput } from '../tools/contract-release-source-transfer.js';
import { contractReleaseSourceDataBytes, resolveContractReleasePrototypeOutput,
  deriveContractReleaseReviewedSource } from '../tools/generate-contract-release-source-transfer.js';
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
const gitInverses = (before, after) => {
  const result = []; let hunk;
  for (const line of lf(git('diff', '--no-ext-diff', '--unified=3', before, after)).split('\n')) {
    if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; result.push(hunk); }
    else if (hunk && /^[ +\-]/.test(line)) {
      if (line[0] !== '-') hunk.current += line.slice(1) + '\n';
      if (line[0] !== '+') hunk.baseline += line.slice(1) + '\n';
    }
  }
  return result;
};
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
    desk: { revision: '1'.repeat(40), pin: fields(fixtureFile, desk), inverses: [{ current, baseline: desk }] },
    fee: { revision: 'd70c17d2cd9eb613e8695caf8c6dfc0b60a64a9e', pin: fields(fixtureFile, fee), inverses: [{ current, baseline: fee }] },
  } } },
};
const helperText = fs.readFileSync(path.join(root, 'tools/contract-release-source-transfer.js'), 'utf8');
const directories = [];
let positives = 0, refusals = 0, malformedDefinitions = 0, provisionalCompositions = 0;
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
        assert.deepEqual(target.inverses, gitInverses(target.pin.blob, row.current.blob), 'Only complete independently measured Git U3 inverse hunks');
        for (const input of [physical, text, text.replaceAll('\n', '\r\n')]) {
          const proof = assertContractReleaseSourceTransfer(file, input, view);
          assert.equal(proof.baselineText, expected);
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
    desk: { revision: fixture.baseRevision, pin: fields(fixtureFile, twoDesk), inverses: [
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
      desk: { revision: provisional.baseRevision, pin: fields(file, deskText), inverses: gitInverses(blob(deskText), blob(combined)) },
      fee: { revision: provisional.reviewedContractRevision, pin: fields(file, feeText), inverses: gitInverses(blob(feeText), blob(combined)) },
    } };
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
  assert.equal(deriveContractReleaseReviewedSource(sourceRecord(acceptedSource), sourceRecord(originalSource), sourceRecord(reviewedSource)).toString('utf8'),
    acceptedSource.replace('old fee', 'reviewed fee'), 'Independent reviewed edits retain all accepted base source'); positives++;
  assert.equal(deriveContractReleaseReviewedSource(null, null, sourceRecord(reviewedSource)).toString('utf8'), reviewedSource); positives++;
  assert.equal(deriveContractReleaseReviewedSource(sourceRecord(reviewedSource), sourceRecord(originalSource), sourceRecord(reviewedSource)).toString('utf8'), reviewedSource); positives++;
  refused(() => deriveContractReleaseReviewedSource(sourceRecord(originalSource.replace('old fee', 'conflicting fee')),
    sourceRecord(originalSource), sourceRecord(reviewedSource)));
  refused(() => deriveContractReleaseReviewedSource(null, sourceRecord(originalSource), sourceRecord(reviewedSource)));
  refused(() => deriveContractReleaseReviewedSource(sourceRecord(acceptedSource), null, sourceRecord(reviewedSource)));
  const fixtureRepository = path.join(approvalDirectory, 'repository'), redirect = path.join(approvalDirectory, 'redirect');
  fs.mkdirSync(fixtureRepository);
  fs.symlinkSync(fixtureRepository, redirect, process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal(resolveContractReleasePrototypeOutput(path.join(approvalDirectory, 'external.json'), fixtureRepository),
    path.join(fs.realpathSync(approvalDirectory), 'external.json')); positives++;
  refused(() => resolveContractReleasePrototypeOutput(path.join(fixtureRepository, 'inside.json'), fixtureRepository));
  refused(() => resolveContractReleasePrototypeOutput(path.join(redirect, 'inside.json'), fixtureRepository));
  assert(!fs.existsSync(path.join(fixtureRepository, 'inside.json')));
  const approvalPath = path.join(approvalDirectory, 'integration.json'), outputPath = path.join(approvalDirectory, 'prototype.json');
  fs.writeFileSync(approvalPath, JSON.stringify({ version: 1, sourceRevision: 'd70c17d2cd9eb613e8695caf8c6dfc0b60a64a9e',
    pins: { 'src/unapproved.js': { file: 'src/unapproved.js', mode: '100644', blob: 'a'.repeat(40), sha256: 'b'.repeat(64) } } }));
  const generator = spawnSync(process.execPath, [path.join(root, 'tools/generate-contract-release-source-transfer.js'),
    '--prototype', '--source=d70c17d2cd9eb613e8695caf8c6dfc0b60a64a9e', '--base=c4b626b631b04e594097fb6bb416c36fdfea00f3',
    '--integration-pins=' + approvalPath, '--output=' + outputPath], { cwd: root, encoding: 'utf8', windowsHide: true });
  assert.notEqual(generator.status, 0); assert(generator.stderr.includes('No unlisted integration approval')); assert(!fs.existsSync(outputPath)); refusals++;
  console.log(JSON.stringify({ phase: 'CONTRACT_RELEASE_SOURCE_CONTROLS', status: data.status,
    positives, refusals, malformedDefinitions, provisionalCompositions, currentBindingAccepted: data.status === 'BOUND',
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
