// Run from the repository root after verification finishes.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const directory = 'docs/release/evidence/security';
const sourcePaths = ['package.json', 'package-lock.json', 'schema.sql', 'src/db.js', 'src/server.js', 'src/auth.js',
  'src/routes/commands.js', 'src/player-commands.js', 'src/routes/coordination.js', 'src/coordination/knowledge.js',
  'src/world-knowledge.js', 'src/command-diagnostics.js', 'omerta-contracts/src/VoucherClaim.sol',
  'omerta-contracts/foundry.toml', 'test/rc1-command-redteam.js', 'test/rc1-observability.js',
  'test/rc1-passive-projection.js', 'src/projection-events.js', 'public/index.html'];
const digestFile = (file) => ({ path: file.replaceAll('\\', '/'), bytes: fs.statSync(file).size,
  sha256: hash(fs.readFileSync(file)) });
function list(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '.git') return [];
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? list(file) : [file];
  });
}
const dependencies = ['forge-std', 'openzeppelin-contracts', 'v4-core', 'v4-periphery', 'permit2'].map((name) => {
  const root = `omerta-contracts/lib/${name}`;
  const files = list(root).filter((file) => file.endsWith('.sol')).sort().map(digestFile);
  return { name, solidityFiles: files.length, sourceTreeSha256: hash(JSON.stringify(files)), files };
});
const artifacts = [];
if (fs.existsSync('omerta-contracts/out')) for (const file of list('omerta-contracts/out').filter((p) => p.endsWith('.json'))) {
  const artifact = JSON.parse(fs.readFileSync(file, 'utf8'));
  let metadata = artifact.metadata;
  if (typeof metadata === 'string') metadata = JSON.parse(metadata);
  const target = Object.entries(metadata?.settings?.compilationTarget || {}).find(([source]) => source.startsWith('src/'));
  if (!target || !artifact.bytecode?.object) continue;
  const init = artifact.bytecode.object.replace(/^0x/, ''), runtime = artifact.deployedBytecode?.object?.replace(/^0x/, '') || '';
  artifacts.push({ path: file.replaceAll('\\', '/'), source: target[0], contract: target[1],
    compiler: metadata.compiler, compilerSettings: metadata.settings,
    initBytecodeBytes: init.length / 2, runtimeBytecodeBytes: runtime.length / 2,
    initObjectSha256: hash(init), runtimeObjectSha256: hash(runtime),
    initBytecodeSha256: /^[a-f0-9]*$/i.test(init) ? hash(Buffer.from(init, 'hex')) : null,
    runtimeBytecodeSha256: /^[a-f0-9]*$/i.test(runtime) ? hash(Buffer.from(runtime, 'hex')) : null });
}
const candidate = '21d0589a8b1f15cbb712e574becd507b813e4b0c';
const changedPaths = (revision, paths) => execFileSync('git', ['diff', '--name-only', revision, '--', ...paths],
  { encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean);
const output = { generatedAt: new Date().toISOString(), baseCommit: '626e61b9ab2b14a9dc45566983b70cdc65692839',
  releaseCandidateCommit: candidate,
  worktreeHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  candidateReviewedSourceDifferences: changedPaths(candidate, [...sourcePaths, 'omerta-contracts/src', 'omerta-contracts/test']),
  frozenContractSourceDifferences: changedPaths('626e61b9ab2b14a9dc45566983b70cdc65692839',
    ['omerta-contracts/src', 'omerta-contracts/test', 'omerta-contracts/foundry.toml']),
  phase: 'local RC1 verification; uncommitted gate repairs identified by source hashes',
  sources: sourcePaths.map(digestFile), dependencies, artifacts,
  evidence: list(directory).filter((file) => !file.endsWith('source-and-evidence-hashes.json')).sort().map(digestFile) };
fs.writeFileSync(`${directory}/source-and-evidence-hashes.json`, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ sources: output.sources.length, dependencies: dependencies.length,
  artifacts: artifacts.length, evidence: output.evidence.length }));
