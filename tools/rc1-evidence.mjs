// Capture commands from an immutable checkout. Writes only to a new run directory.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { REQUIRED_PROOFS, sha256, evidencePath, sourceInventory, validateSourceManifest, validateGateRegistry } from './rc1-qualification.mjs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim();
const json = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
export const sourceState = () => ({ source: git('rev-parse', 'HEAD'), tree: git('rev-parse', 'HEAD^{tree}'),
  status: git('status', '--porcelain', '--untracked-files=all') });

export function gateWorkingDirectory(gate) {
  const root = fs.realpathSync(git('rev-parse', '--show-toplevel'));
  const relative = gate.cwd || '.';
  assert(typeof relative === 'string' && !path.isAbsolute(relative) && !/^[a-z]:/i.test(relative)
    && !relative.replaceAll('\\', '/').split('/').includes('..'), 'Gate cwd must stay inside source');
  const directory = fs.realpathSync(path.resolve(root, relative));
  assert(directory === root || directory.startsWith(root + path.sep), 'Gate cwd escapes frozen source');
  assert(fs.statSync(directory).isDirectory(), 'Gate cwd must be a directory');
  return directory;
}

export function freeze({ output, configuration, predecessor, registry, scenarioManifest }) {
  assert(!fs.existsSync(output), 'Use a new evidence directory; never overwrite a prior run');
  const state = sourceState();
  assert.equal(state.status, '', 'Commit source before recording exact-revision evidence');
  assert.match(predecessor, /^[a-f0-9]{40}$/);
  assert.equal(git('rev-parse', `${predecessor}^{commit}`), predecessor);
  const configurationBytes = fs.readFileSync(configuration);
  const config = JSON.parse(configurationBytes);
  // Values belong in operator-managed secret stores, never in a public release package.
  const inspect = (object) => {
    for (const [key, value] of Object.entries(object || {})) {
      assert(!/password|private.?key|access.?token|jwt.?secret|api.?key|database.?url/i.test(key), `Secret-bearing field prohibited: ${key}`);
      if (value && typeof value === 'object') inspect(value);
    }
  };
  inspect(config);
  assert.equal(fs.realpathSync(process.cwd()), fs.realpathSync(git('rev-parse', '--show-toplevel')), 'Freeze from the repository root');
  const inventory = sourceInventory(state.source);
  const sourceFiles = inventory.files.map(({ path: file, blob, gitSha256, accepted }) => {
    const actual = sha256(fs.readFileSync(evidencePath(process.cwd(), file)));
    assert(accepted.includes(actual), `Checkout bytes differ from Git source: ${file}`);
    return { path: file, blob, gitSha256, sha256: actual };
  });
  const gates = json(registry);
  validateGateRegistry(state.source, gates);
  for (const gate of gates.gates) gateWorkingDirectory(gate);
  assert.deepEqual(sourceState(), state, 'Source moved while freezing');
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'configuration.json'), configurationBytes, { flag: 'wx' });
  const gateBytes = fs.readFileSync(registry);
  fs.writeFileSync(path.join(output, 'gate-registry.json'), gateBytes, { flag: 'wx' });
  let scenarioManifestSha256 = null;
  if (scenarioManifest) {
    const bytes = fs.readFileSync(scenarioManifest);
    fs.writeFileSync(path.join(output, 'scenario-manifest.json'), bytes, { flag: 'wx' });
    scenarioManifestSha256 = sha256(bytes);
  }
  const manifest = { format: 1, ...state, cleanTree: true, predecessor, frozenAt: new Date().toISOString(),
    configurationSha256: sha256(configurationBytes), gateRegistrySha256: sha256(gateBytes), scenarioManifestSha256,
    requiredProofs: REQUIRED_PROOFS, sourceFiles,
    runtime: { node: process.version, platform: process.platform, arch: process.arch,
      cpus: os.availableParallelism(), totalMemoryBytes: os.totalmem() },
    hashEncoding: 'SHA256 of actual checkout bytes; Git tree and source SHA recorded separately',
    packageLockSha256: sha256(fs.readFileSync('package-lock.json')),
    schemaSha256: sha256(fs.readFileSync('schema.sql')) };
  write(path.join(output, 'candidate.json'), manifest);
  return manifest;
}

function assertFrozen(manifest) {
  const state = sourceState();
  assert.equal(state.source, manifest.source, 'Source revision moved during evidence capture');
  assert.equal(state.status, '', 'Source checkout changed during evidence capture');
  validateSourceManifest(manifest);
  for (const file of manifest.sourceFiles) assert.equal(sha256(fs.readFileSync(evidencePath(process.cwd(), file.path))), file.sha256, `Source changed: ${file.path}`);
}

export async function runGate(root, id) {
  assert(/^[a-z0-9-]+$/.test(id));
  root = fs.realpathSync(root);
  const manifest = json(evidencePath(root, 'candidate.json'));
  assertFrozen(manifest);
  const registryBytes = fs.readFileSync(evidencePath(root, 'gate-registry.json'));
  assert.equal(sha256(registryBytes), manifest.gateRegistrySha256, 'Gate registry changed after freeze');
  assert.equal(sha256(fs.readFileSync(evidencePath(root, 'configuration.json'))), manifest.configurationSha256);
  const registry = validateGateRegistry(manifest.source, JSON.parse(registryBytes));
  const gate = registry.gates.find((entry) => entry.id === id);
  assert(gate, `Unregistered gate: ${id}`);
  const cwd = gateWorkingDirectory(gate);
  const gatesDirectory = path.join(root, 'gates');
  if (!fs.existsSync(gatesDirectory)) fs.mkdirSync(gatesDirectory);
  assert(fs.realpathSync(gatesDirectory).startsWith(root + path.sep), 'Gate output escapes evidence root');
  const directory = path.join(root, 'gates', id);
  assert(!fs.existsSync(directory), 'Retain failed attempts; use a new freeze for a retest');
  fs.mkdirSync(directory);
  const log = `gates/${id}/output.txt`;
  const fd = fs.openSync(path.join(root, log), 'wx');
  const startedAt = new Date().toISOString();
  const start = Date.now();
  let command = gate.command[0], args = gate.command.slice(1);
  if (command === 'node') command = process.execPath;
  if (command === 'npm') {
    // No shell interpolation, including on Windows where npm is a command shim.
    const npmCli = process.env.RC1_NPM_CLI || path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
    assert(fs.existsSync(npmCli), 'Set RC1_NPM_CLI to the installed npm-cli.js');
    command = process.execPath; args = [npmCli, ...args];
  }
  let timedOut = false, exitCode = null, signal = null, launchError = null;
  try {
    await new Promise((resolve) => {
      const child = spawn(command, args, { cwd,
        env: { ...process.env, CI: 'true' }, stdio: ['ignore', fd, fd], windowsHide: true,
        detached: process.platform !== 'win32' });
      const timer = setTimeout(() => {
        timedOut = true;
        if (process.platform === 'win32') {
          // Scope termination to this newly spawned process tree, never a process-name sweep.
          if (child.pid) spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        } else if (child.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already exited */ } }
      }, gate.timeoutMs);
      child.once('error', (error) => { launchError = error.message; });
      child.once('close', (code, killedBy) => { clearTimeout(timer); exitCode = code; signal = killedBy; resolve(); });
    });
  } finally { fs.closeSync(fd); }
  let sourceUnchanged = true, sourceError = null;
  try { assertFrozen(manifest); } catch (error) { sourceUnchanged = false; sourceError = error.message; }
  const result = { format: 1, id, source: manifest.source, configurationSha256: manifest.configurationSha256,
    command: gate.command, cwd: gate.cwd || '.', startedAt, endedAt: new Date().toISOString(), durationMs: Date.now() - start,
    node: process.version, platform: process.platform, exitCode, signal, timedOut, launchError, sourceUnchanged, sourceError,
    status: exitCode === 0 && !timedOut && !launchError && sourceUnchanged ? 'PASS' : 'FAIL',
    scope: gate.scope || 'regression', coverageExclusions: gate.coverageExclusions || [],
    log, logSha256: sha256(fs.readFileSync(path.join(root, log))) };
  write(path.join(directory, 'result.json'), result);
  return result;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const [mode, ...rest] = process.argv.slice(2);
  if (mode === 'freeze') {
    const options = Object.fromEntries(rest.map((s) => { const at = s.indexOf('='); assert(at > 2); return [s.slice(2, at), s.slice(at + 1)]; }));
    console.log(JSON.stringify({ source: freeze(options).source, output: options.output }));
  } else if (mode === 'run') {
    const result = await runGate(path.resolve(rest[0]), rest[1]);
    console.log(JSON.stringify(result));
    if (result.status !== 'PASS') process.exitCode = 1;
  } else throw new Error('Usage: rc1-evidence.mjs freeze --output=... --configuration=... --predecessor=<SHA> --registry=... [--scenarioManifest=...] | run <directory> <gate>');
}
