// PHASE 2A SCALE — four isolated 10k-node builds under a 768 MiB heap and 30-second wall.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIMIT_MS = 30_000;
const deterministicFields = [
  'fixture', 'profile', 'compilerVersion', 'packageCount', 'nodeCount', 'edgeCount',
  'componentCount', 'sccCount', 'maximumSccSize', 'maximumWitnessIds', 'bundleHash',
  'witnessBytes',
  'rootNodeCount', 'catalogNodeCount', 'effectiveNodeCount', 'effectivePackageCount',
  'dependencyCount',
  'irHash', 'dependencyLockHash', 'publicManifestHash', 'knowledgeManifestHash',
  'reportHashes', 'reportBytes', 'sealedBundleBytes', 'totalOutputBytes',
];

function runFixture(fixture) {
  const started = Date.now();
  const run = spawnSync(
    process.execPath,
    ['--max-old-space-size=768', 'tools/content-scale.js', fixture],
    { cwd: ROOT, encoding: 'utf8', timeout: LIMIT_MS, maxBuffer: 8 * 1024 * 1024 },
  );
  const wallMs = Date.now() - started;
  assert.notEqual(run.error?.code, 'ETIMEDOUT', `${fixture} exceeded ${LIMIT_MS} ms`);
  assert.equal(run.status, 0, `${fixture}:\n${run.stdout}\n${run.stderr}`);
  assert(wallMs <= LIMIT_MS, `${fixture} took ${wallMs} ms`);
  const summary = JSON.parse(run.stdout);
  assert.equal(summary.nodeCount, fixture === 'aggregate' ? 7_000 : 10_000);
  assert(summary.elapsedMs <= LIMIT_MS);
  assert(summary.peakRssKilobytes >= 0);
  assert(summary.peakRssKilobytes <= 768 * 1024);
  assert.equal(summary.peakHeapUsedBytes, null);
  assert(summary.endHeapUsedBytes > 0);
  assert(summary.endRssBytes > 0);
  assert(Object.values(summary.reportBytes).every((bytes) => bytes <= 8 * 1024 * 1024));
  assert(summary.maximumWitnessIds <= 128);
  assert(summary.totalOutputBytes <= 8 * 1024 * 1024);
  assert(summary.summaryOutputBytes <= 8 * 1024 * 1024);
  return summary;
}

for (const fixture of ['linear', 'branching']) {
  const first = runFixture(fixture);
  const second = runFixture(fixture);
  assert.deepEqual(
    Object.fromEntries(deterministicFields.map((field) => [field, first[field]])),
    Object.fromEntries(deterministicFields.map((field) => [field, second[field]])),
  );
  console.log(`✓ ${fixture} 10k-node builds are iterative, bounded, and deterministic`);
  console.log(JSON.stringify({ fixture, first, second }));
}

{
  const first = runFixture('aggregate');
  const second = runFixture('aggregate');
  assert.equal(first.rootNodeCount, 7_000);
  assert.equal(first.catalogNodeCount, 3_000);
  assert.equal(first.effectiveNodeCount, 10_000);
  assert.equal(first.effectivePackageCount, 2);
  assert.equal(first.dependencyCount, 1);
  assert.deepEqual(
    Object.fromEntries(deterministicFields.map((field) => [field, first[field]])),
    Object.fromEntries(deterministicFields.map((field) => [field, second[field]])),
  );
  console.log('✓ aggregate catalog-plus-root 10k-node builds are bounded and deterministic');
  console.log(JSON.stringify({ fixture: 'aggregate', first, second }));
}

console.log('phase2 scale tests passed');
