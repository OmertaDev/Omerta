// Capture commands from an immutable checkout. Writes only to a new run directory.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { REQUIRED_PROOFS, sha256 } from './rc1-qualification.mjs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim();
const json = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
export const sourceState = () => ({ source: git('rev-parse', 'HEAD'), tree: git('rev-parse', 'HEAD^{tree}'),
  status: git('status', '--porcelain', '--untracked-files=all') });

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
  const files = git('ls-files').split('\n').filter((file) => /^(src\/|public\/|content\/|tools\/|test\/|\.github\/workflows\/|omerta-contracts\/(src\/|test\/|foundry.toml)|schema.sql$|package(-lock)?\.json$|render.yaml$)/.test(file));
  const sourceFiles = files.map((file) => ({ path: file, sha256: sha256(fs.readFileSync(file)) }));
  const gates = json(registry);
  assert(gates.gates?.length > 0);
  assert.equal(new Set(gates.gates.map((g) => g.id)).size, gates.gates.length);
  for (const gate of gates.gates) {
    assert(/^[a-z0-9-]+$/.test(gate.id));
    assert(Array.isArray(gate.command) && gate.command.length && gate.command.every((s) => typeof s === 'string'));
    assert(Number.isSafeInteger(gate.timeoutMs) && gate.timeoutMs > 0);
  }
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
  for (const file of manifest.sourceFiles) assert.equal(sha256(fs.readFileSync(file.path)), file.sha256, `Source changed: ${file.path}`);
}

export async function runGate(root, id) {
  assert(/^[a-z0-9-]+$/.test(id));
  const manifest = json(path.join(root, 'candidate.json'));
  assertFrozen(manifest);
  const registryBytes = fs.readFileSync(path.join(root, 'gate-registry.json'));
  assert.equal(sha256(registryBytes), manifest.gateRegistrySha256, 'Gate registry changed after freeze');
  assert.equal(sha256(fs.readFileSync(path.join(root, 'configuration.json'))), manifest.configurationSha256);
  const gate = JSON.parse(registryBytes).gates.find((entry) => entry.id === id);
  assert(gate, `Unregistered gate: ${id}`);
  const directory = path.join(root, 'gates', id);
  assert(!fs.existsSync(directory), 'Retain failed attempts; use a new freeze for a retest');
  fs.mkdirSync(directory, { recursive: true });
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
      const child = spawn(command, args, { cwd: gate.cwd ? path.resolve(gate.cwd) : process.cwd(),
        env: { ...process.env, CI: 'true' }, stdio: ['ignore', fd, fd], windowsHide: true });
      const timer = setTimeout(() => {
        timedOut = true;
        if (process.platform === 'win32') {
          // Scope termination to this newly spawned process tree, never a process-name sweep.
          if (child.pid) spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        } else child.kill('SIGKILL');
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
