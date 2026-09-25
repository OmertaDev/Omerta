// Synthetic fixtures exercise validation only; none are release execution proof.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { REQUIRED_PROOFS, CANONICAL_GATE_REGISTRY, evidencePath, indexEvidence, verifyIndex, qualify, sha256,
  validateSourceManifest, validateGateRegistry, validateExecutionRecord, validateGateResult } from '../tools/rc1-qualification.mjs';
import { freeze, runGate, gateWorkingDirectory } from '../tools/rc1-evidence.mjs';

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'omerta-rc1-capture-test-'));
const previousDirectory = process.cwd();
let assertions = 0;
const check = (fn) => { fn(); assertions++; };
const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); };
try {
  process.chdir(fixture);
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '--quiet');
  fs.mkdirSync('src'); fs.writeFileSync('src/fixture.js', '// synthetic capture test\n');
  fs.writeFileSync('src/binary.bin', Buffer.from([0, 10, 13, 255]));
  fs.writeFileSync('schema.sql', '-- synthetic\n'); fs.writeFileSync('package-lock.json', '{}\n');
  fs.writeFileSync('.gitignore', 'evidence/\nlinks/\n'); write('configuration.json', { test: 'synthetic-only' });
  const registry = { gates: [
    { id: 'pass', command: ['node', '-e', 'console.log("synthetic capture only")'], timeoutMs: 10000, scope: 'regression', coverageExclusions: ['Not a full release proof'] },
    { id: 'fail', command: ['node', '-e', 'process.exit(7)'], timeoutMs: 10000 },
    { id: 'timeout', command: ['node', '-e', 'setInterval(()=>{}, 1000)'], timeoutMs: 200 },
    { id: 'mutation', command: ['node', '-e', 'require("fs").appendFileSync("src/fixture.js", "// changed")'], timeoutMs: 10000 },
  ] };
  write(CANONICAL_GATE_REGISTRY, registry); git('add', '.');
  git('-c', 'user.name=RC1 Synthetic Test', '-c', 'user.email=rc1-test@example.invalid', 'commit', '--quiet', '-m', 'Synthetic fixture');
  const predecessor = git('rev-parse', 'HEAD');
  const manifest = freeze({ output: 'evidence', configuration: 'configuration.json', predecessor, registry: CANONICAL_GATE_REGISTRY });
  check(() => assert.equal(manifest.source, predecessor)); check(() => validateSourceManifest(manifest));
  const root = path.join(fixture, 'evidence'); indexEvidence(root);
  check(() => assert.equal(qualify(root).open.length, REQUIRED_PROOFS.length));
  check(() => assert.equal(qualify(root).state, 'NOT RELEASE READY')); check(() => assert.equal(verifyIndex(root).size, 3));
  fs.appendFileSync(path.join(root, 'configuration.json'), ' ');
  check(() => assert.throws(() => verifyIndex(root), /mismatch/));
  check(() => assert.equal(qualify(root).open[0].id, 'evidence-integrity'));
  fs.copyFileSync('configuration.json', path.join(root, 'configuration.json'));
  for (const name of ['../run.json', '/run.json', 'C:/run.json', 'proofs/../run.json', 'proofs\\run.json']) {
    check(() => assert.throws(() => evidencePath(root, name), /Invalid evidence path/));
  }
  fs.mkdirSync('links'); fs.copyFileSync(path.join(root, 'SHA256SUMS.json'), 'links/outside-index.json');
  fs.unlinkSync(path.join(root, 'SHA256SUMS.json'));
  fs.symlinkSync(path.resolve('links'), path.join(root, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
  check(() => assert.throws(() => evidencePath(root, 'escape/outside-index.json'), /escapes/)); fs.unlinkSync(path.join(root, 'escape'));
  let indexLink = false;
  try { fs.symlinkSync(path.resolve('links/outside-index.json'), path.join(root, 'SHA256SUMS.json'), 'file'); indexLink = true; }
  catch (error) { if (!['EPERM', 'EACCES'].includes(error.code)) throw error; }
  if (indexLink) { check(() => assert.throws(() => verifyIndex(root), /escapes/)); fs.unlinkSync(path.join(root, 'SHA256SUMS.json')); }
  indexEvidence(root);
  for (const change of [{ source: 'a'.repeat(40) }, { tree: 'b'.repeat(40) }, { sourceFiles: [] },
    { sourceFiles: [{ path: '../elsewhere', blob: 'a'.repeat(40), gitSha256: 'a'.repeat(64), sha256: 'a'.repeat(64) }] },
    { sourceFiles: manifest.sourceFiles.slice(1) },
    { sourceFiles: manifest.sourceFiles.map((entry, i) => i ? entry : { ...entry, blob: 'b'.repeat(40) }) },
    { sourceFiles: manifest.sourceFiles.map((entry, i) => i ? entry : { ...entry, sha256: 'b'.repeat(64) }) }]) {
    check(() => assert.throws(() => validateSourceManifest({ ...manifest, ...change })));
  }
  const lineEndings = structuredClone(manifest), textFile = lineEndings.sourceFiles.find((file) => file.path === 'src/fixture.js');
  textFile.sha256 = sha256(fs.readFileSync(textFile.path, 'utf8').replaceAll('\r\n', '\n').replaceAll('\n', '\r\n'));
  check(() => validateSourceManifest(lineEndings));
  for (const change of [{ gates: registry.gates.slice(0, 1) }, { gates: [] },
    { gates: registry.gates.map((gate, i) => i ? gate : { ...gate, command: ['node', '-e', ''] }) },
    { gates: registry.gates.map((gate, i) => i ? gate : { ...gate, timeoutMs: 1 }) },
    { gates: registry.gates.map((gate, i) => i ? gate : { ...gate, cwd: '../outside' }) }]) {
    check(() => assert.throws(() => validateGateRegistry(manifest.source, change), /canonical inventory/));
  }
  check(() => assert.throws(() => gateWorkingDirectory({ cwd: os.tmpdir() }), /inside source/));
  check(() => assert.throws(() => gateWorkingDirectory({ cwd: '../outside' }), /inside source/));
  fs.symlinkSync(os.tmpdir(), 'links/outside', process.platform === 'win32' ? 'junction' : 'dir');
  check(() => assert.throws(() => gateWorkingDirectory({ cwd: 'links/outside' }), /escapes/)); fs.unlinkSync('links/outside');
  const proof = { id: 'serial-replay', source: manifest.source, configurationSha256: manifest.configurationSha256,
    status: 'PASS', scope: 'full', coverageExclusions: [], owner: 'synthetic-test', reviewedBy: 'synthetic-test',
    artifacts: ['configuration.json'], measurements: { executed: true, assertionsPassed: true } };
  const serial = (value) => { write(path.join(root, 'proofs/serial-replay.json'), value); indexEvidence(root); return qualify(root).open.some((entry) => entry.id === 'serial-replay'); };
  check(() => assert.equal(serial(proof), true, 'Configuration bytes are not execution evidence'));
  const record = { format: 1, proofId: 'serial-replay', source: manifest.source, configurationSha256: manifest.configurationSha256,
    status: 'PASS', scope: 'full', coverageExclusions: [], kind: 'native', database: 'postgresql', command: ['node', 'test-only'],
    assertions: [{ id: 'test-only', status: 'PASS' }], startedAt: '2026-01-01T00:00:00Z', endedAt: '2026-01-01T00:00:01Z',
    exitCode: 0, timedOut: false, signal: null, launchError: null };
  write(path.join(root, 'runs/serial-replay/one.json'), { ...record, synthetic: true });
  check(() => assert.equal(serial({ ...proof, artifacts: ['runs/serial-replay/one.json'] }), true));
  for (const change of [{ source: 'a'.repeat(40) }, { configurationSha256: 'd'.repeat(64) }, { kind: 'model' },
    { database: 'pg-mem' }, { assertions: [] }, { assertions: [{ id: 'failure', status: 'FAIL' }] }, { command: [] },
    { exitCode: 1 }, { timedOut: true }, { launchError: 'failed' }, { signal: 'SIGTERM' }, { synthetic: true },
    { status: 'BLOCKED' }, { scope: 'fixture' }, { coverageExclusions: ['missing'] }]) {
    check(() => assert.throws(() => validateExecutionRecord({ ...record, ...change }, 'serial-replay', manifest)));
  }
  write(path.join(root, 'gate-registry.json'), { gates: registry.gates.slice(0, 1) });
  write(path.join(root, 'candidate.json'), { ...manifest, gateRegistrySha256: sha256(fs.readFileSync(path.join(root, 'gate-registry.json'))) });
  indexEvidence(root); check(() => assert.equal(qualify(root).open[0].id, 'candidate', 'Rehashing shortened inventory cannot qualify'));
  write(path.join(root, 'candidate.json'), manifest); write(path.join(root, 'gate-registry.json'), registry);
  const passed = await runGate(root, 'pass'); check(() => assert.equal(passed.status, 'PASS'));
  indexEvidence(root); const index = verifyIndex(root);
  check(() => validateGateResult(passed, registry.gates[0], manifest, root, index));
  for (const change of [{ id: 'different' }, { source: 'a'.repeat(40) }, { timedOut: true }, { launchError: 'failed' },
    { signal: 'SIGTERM' }, { sourceUnchanged: false }, { sourceError: 'changed' }, { cwd: '../outside' },
    { scope: 'full' }, { coverageExclusions: [] }, { log: 'configuration.json' }, { logSha256: 'a'.repeat(64) }]) {
    check(() => assert.throws(() => validateGateResult({ ...passed, ...change }, registry.gates[0], manifest, root, index)));
  }
  const failed = await runGate(root, 'fail'); check(() => assert.equal(failed.exitCode, 7)); check(() => assert.equal(failed.status, 'FAIL'));
  const timeout = await runGate(root, 'timeout'); check(() => assert.equal(timeout.timedOut, true)); check(() => assert.equal(timeout.status, 'FAIL'));
  const mutation = await runGate(root, 'mutation'); check(() => assert.equal(mutation.exitCode, 0));
  check(() => assert.equal(mutation.sourceUnchanged, false)); check(() => assert.equal(mutation.status, 'FAIL'));
  await assert.rejects(() => runGate(root, 'pass'), /Source checkout changed/);
  check(() => assert.throws(() => freeze({ output: root, configuration: 'configuration.json', predecessor, registry: CANONICAL_GATE_REGISTRY }), /never overwrite/));
  console.log(`rc1-qualification: ${assertions} source/blob/registry/path/artifact/result controls plus child capture, failure, timeout and mutation checks passed`);
} finally {
  process.chdir(previousDirectory);
  fs.rmSync(fixture, { recursive: true }); // uniquely-created temporary repository only
}
