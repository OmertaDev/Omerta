import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { GENESIS_RELEASE_SCOPE_FILES, GENESIS_RELEASE_ARTIFACTS } from '../../../src/genesisrelease.js';
import { loadReviewedArtifact } from '../../../tools/liquidity-deployment-plan.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const RAW = 'output/genesis-bootstrap-20260909';
const REVIEW = 'omerta-contracts/audits/2026-09-09-genesis-bootstrap';
const FINAL_FORK = '.audit/genesis-fork-rehearsal/2026-09-09T07-23-05-323Z';
const TARGET = 'output/genesis-bootstrap-final-20260909';
const hash = data => createHash('sha256').update(data).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const forward = value => value.replaceAll('\\', '/');
const read = relative => fs.readFileSync(path.join(ROOT, relative));
const parse = relative => JSON.parse(read(relative).toString('utf8').replace(/^\uFEFF/, ''));
function walk(relative) {
  return fs.readdirSync(path.join(ROOT, relative), { withFileTypes: true }).flatMap(entry => {
    assert(!entry.isSymbolicLink(), `No symlinks in evidence: ${entry.name}`);
    const name = `${relative}/${entry.name}`;
    return entry.isDirectory() ? walk(name) : [name];
  }).sort();
}
function record(relative, bytes = read(relative)) { return { path: relative, bytes: bytes.length, sha256: hash(bytes) }; }
function write(relative, value) {
  const target = path.join(ROOT, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, value, { flag: 'wx' });
}
function copy(source, destination) { write(destination, read(source)); }
function verify() {
  const manifest = parse(`${TARGET}/package-manifest.json`);
  for (const entry of manifest.files) {
    const actual = record(`${TARGET}/${entry.path}`);
    assert.equal(actual.bytes, entry.bytes, entry.path);
    assert.equal(actual.sha256, entry.sha256, entry.path);
  }
  const expected = [...manifest.files.map(entry => entry.path), 'package-manifest.json'].sort();
  const actual = walk(TARGET).map(file => file.slice(TARGET.length + 1)).sort();
  assert.deepEqual(actual, expected, 'Unexpected or missing package entries');
  console.log(json({ verified: true, files: manifest.files.length,
    packageManifestSha256: hash(read(`${TARGET}/package-manifest.json`)), packageTreeSha256: manifest.packageTreeSha256 }));
}
if (process.argv.includes('--verify')) { verify(); process.exit(0); }
assert.equal(process.argv.length, 2, 'Use no arguments to capture, or --verify to verify');
assert(!fs.existsSync(path.join(ROOT, TARGET)), 'Refusing to overwrite an existing evidence package');

const required = ['oracle-bootstrap-retest', 'liquidity-solidity-regression', 'v4keeper-final',
  'v4keeper-postgres-final', 'chain-final', 'watcher', 'preflight', 'docs-final', 'genesiskeeper',
  'liquiditykeeper', 'genesiscca-tests', 'genesisrelease-tests', 'review-keeper-final-proof', 'fork-5'];
for (const name of required) assert.equal(read(`${RAW}/${name}.exit.txt`).toString('utf8').replace(/^\uFEFF/, '').trim(), '0', name);
assert.equal(read(`${RAW}/oracle-before-bootstrap.exit.txt`).toString('utf8').replace(/^\uFEFF/, '').trim(), '1');
const fork = parse(`${FINAL_FORK}/evidence.json`);
assert.equal(fork.ok, true);
for (const name of ['upstreamReadOnly', 'mutationTargetLoopback', 'forkBlockHashVerifiedBeforeMutations', 'codeSizeLimitEnabled', 'postgresAdvisoryLocksEnabled']) assert.equal(fork.safety[name], true, name);
assert.equal(fork.safety.productionTransactionsBroadcast, 0);
assert.equal(fork.safety.productionKeysRead, 0);
assert.equal(fork.genesis.lifecycleResults.length, 5);
assert(fork.genesis.lifecycleResults.every(result => result.state === 'settled'));
for (const line of read(`${FINAL_FORK}/SHA256SUMS`).toString('utf8').trim().split(/\r?\n/)) {
  const [digest, file] = line.split(/\s+/); assert.equal(hash(read(`${FINAL_FORK}/${file}`)), digest, file);
}
const triage = parse(`${RAW}/static/oracle-static-triage.json`);
assert.equal(triage.rawDiagnostics, 118);
assert.equal(triage.unassignedDiagnostics, 0);
const sourcePaths = new Set([...GENESIS_RELEASE_SCOPE_FILES, 'SPEC.md', 'test/chain.js',
  `${REVIEW}/report.md`, `${REVIEW}/capture-evidence.mjs`,
  'output/mainnet-preparation-20260909/SETUP-WALKTHROUGH.md', 'output/mainnet-preparation-20260909/public-addresses.json',
  'output/mainnet-preparation-20260909/liquidity-input.draft.json']);
const artifacts = [];
for (const contract of GENESIS_RELEASE_ARTIFACTS) {
  const reviewed = loadReviewedArtifact(contract, { contractsRoot: path.join(ROOT, 'omerta-contracts') });
  for (const source of Object.keys(reviewed.evidence.sources)) {
    assert(!source.startsWith('../') && !path.isAbsolute(source));
    sourcePaths.add(`omerta-contracts/${source}`);
  }
  const artifact = `omerta-contracts/out/${contract}.sol/${contract}.json`;
  artifacts.push({ ...record(artifact), ...reviewed.evidence });
  copy(artifact, `${TARGET}/artifacts/${contract}.json`);
}
const sourceFiles = [...sourcePaths].sort().map(file => record(file));
for (const entry of sourceFiles) copy(entry.path, `${TARGET}/source/${entry.path}`);
const scope = {
  generatedAt: new Date().toISOString(), baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
  dirty: true, phase: 'source remediation and isolated fork rehearsal; no production deployment',
  sourceTreeSha256: hash(json(sourceFiles)), files: sourceFiles,
};
write(`${TARGET}/source-manifest.json`, json(scope));
write(`${TARGET}/artifact-manifest.json`, json({ compiler: 'Solidity 0.8.26; optimizer 800; Cancun; source-specific IR profile', artifacts }));
for (const file of walk(RAW)) copy(file, `${TARGET}/raw/${file.slice(RAW.length + 1)}`);
const forkDirectories = fs.readdirSync(path.join(ROOT, '.audit/genesis-fork-rehearsal'))
  .filter(name => name.startsWith('2026-09-09T07-'));
for (const directory of forkDirectories) for (const file of walk(`.audit/genesis-fork-rehearsal/${directory}`))
  copy(file, `${TARGET}/forks/${file.slice('.audit/genesis-fork-rehearsal/'.length)}`);
write(`${TARGET}/validation.json`, json({ finalFork: FINAL_FORK, finalForkEvidenceSha256: hash(read(`${FINAL_FORK}/evidence.json`)),
  forkBlock: fork.fork, passedExitMarkers: required, expectedBeforeFixExit: 1,
  tests: { oracle: 28, coupledLiquidity: 99, ccaRejectionCases: 46, startupChecks: 16, independentKeeperAssertions: 26 },
  staticTriageSha256: hash(read(`${RAW}/static/oracle-static-triage.json`)),
  publicConfiguration: 'draft; no private keys, funding, live configuration or activation applied',
  historicalReviewPackages: 'September 8 packages preserved unchanged; no newer claims attached to them',
}));
const payload = walk(TARGET).map(file => ({ ...record(file), path: file.slice(TARGET.length + 1) }));
write(`${TARGET}/package-manifest.json`, json({ generatedAt: new Date().toISOString(), packageTreeSha256: hash(json(payload)), files: payload }));
for (const name of ['source-manifest.json', 'artifact-manifest.json', 'validation.json']) copy(`${TARGET}/${name}`, `${REVIEW}/${name}`);
verify();
