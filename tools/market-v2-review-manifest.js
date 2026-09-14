#!/usr/bin/env node
// Pin the exact candidate and retained evidence. This is an inventory, never an automatic clearance.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { keccak256, toHex } from 'viem';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contracts = path.join(root, 'omerta-contracts');
const output = path.join(root, 'output', 'market-v2-review');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const files = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const rel = p => path.relative(root, p).replaceAll('\\', '/');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const sources = files(path.join(contracts, 'src', 'market-v2')).filter(p => p.endsWith('.sol'));
const selected = [...sources, ...files(path.join(contracts, 'test', 'market-v2')),
  ...files(path.join(contracts, 'docs', 'market-v2')), path.join(contracts, 'foundry.toml'),
  ...['src/marketv2keeper.js', 'src/marketv2solver.js', 'tools/market-v2-keeper.js', 'tools/market-v2-solver.js',
    'tools/market-v2-deployment-plan.js', 'tools/market-v2-review-manifest.js', 'tools/market-v2-static-triage.js', 'test/marketv2keeper.js',
    'test/marketv2solver.js', 'test/market-v2-deployment-plan.js'].map(p => path.join(root, p))];
const artifacts = [];
for (const source of sources) {
  const name = path.basename(source, '.sol');
  const artifactPath = path.join(contracts, 'out', `${name}.sol`, `${name}.json`);
  const bytes = fs.readFileSync(artifactPath); const a = JSON.parse(bytes);
  const runtime = a.deployedBytecode.object; const creation = a.bytecode.object;
  const metadata = typeof a.metadata === 'string' ? JSON.parse(a.metadata) : a.metadata;
  const sourceKey = `src/market-v2/${name}.sol`;
  if (metadata.sources[sourceKey].keccak256 !== keccak256(toHex(fs.readFileSync(source)))) throw new Error(`stale artifact: ${name}`);
  const runtimeBytes = (runtime.length - 2) / 2;
  if (runtimeBytes > 24576 || (creation.length - 2) / 2 > 49152) throw new Error(`template size limit: ${name}`);
  artifacts.push({ contract: name, file: rel(artifactPath), sha256: digest(bytes), compiler: metadata.compiler.version,
    settings: metadata.settings, creationTemplateBytes: (creation.length - 2) / 2, runtimeTemplateBytes: runtimeBytes,
    runtimeTemplateKeccak256: keccak256(runtime), immutableReferences: a.deployedBytecode.immutableReferences,
    note: 'Template hash is not a deployed-instance runtime hash. Constructor arguments and actual runtime must be verified at release.' });
}
const evidence = fs.readdirSync(output, { withFileTypes: true }).filter(e => e.isFile()
  && !['source-manifest.json', 'source-manifest.sha256'].includes(e.name))
  .map(e => ({ file: rel(path.join(output, e.name)), sha256: digest(fs.readFileSync(path.join(output, e.name))) }));
const manifest = { schemaVersion: 1, createdAt: new Date().toISOString(), releasePhase: 'local implementation candidate; no live deployment',
  sourceCommit: git('rev-parse', 'HEAD'), dirtyStatus: git('status', '--short'),
  files: [...new Set(selected)].map(p => ({ file: rel(p), sha256: digest(fs.readFileSync(p)) })),
  dependencies: Object.fromEntries(['v4-core', 'v4-periphery', 'openzeppelin-contracts', 'forge-std'].map(name => {
    try { return [name, git('-C', path.join(contracts, 'lib', name), 'rev-parse', 'HEAD')]; }
    catch { return [name, 'git revision unavailable; source artifact metadata contains imported hashes']; }
  })), artifacts, evidence,
  excluded: ['production deployment/configuration and transaction broadcast', 'economic calibration or guaranteed market returns',
    'production game route, signer and indexer activation', 'legacy withdrawal, RWA and token issuance release clearance'],
};
const body = JSON.stringify(manifest, null, 2) + '\n';
fs.writeFileSync(path.join(output, 'source-manifest.json'), body);
fs.writeFileSync(path.join(output, 'source-manifest.sha256'), digest(body) + '\n');
console.log(JSON.stringify({ sourceCommit: manifest.sourceCommit, files: manifest.files.length, artifacts: artifacts.length,
  evidence: evidence.length, manifestSha256: digest(body), largestRuntime: artifacts.reduce((a, b) => a.runtimeTemplateBytes > b.runtimeTemplateBytes ? a : b).contract }));
