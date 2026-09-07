#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  compileContentCorpus,
  hashKnowledgeManifest,
  sealedBundleBytes,
  verifyStoredBundleBytes,
} from '../src/content/corpus.js';
import { canonicalBytes } from '../src/content/canonical.js';
import { discoverContentPackages } from '../src/content/discovery.js';

const fixture = process.argv[2];
if (!['linear', 'branching', 'aggregate'].includes(fixture)) {
  process.stderr.write('content-scale: fixture must be linear, branching, or aggregate\n');
  process.exit(1);
}

function fixtureSource(name, {
  nodeCount = 10_000,
  packageId = `omerta.phase2.scale.${name}`,
  dependencies = [],
} = {}) {
  const nodes = Array.from({ length: nodeCount }, (_, index) => ({
    id: `n${index}`,
    kind: 'step',
  }));
  const edges = [];
  if (name !== 'branching') {
    for (let index = 1; index < nodes.length; index += 1) {
      edges.push({ from: `n${index - 1}`, to: `n${index}`, kind: 'requires' });
    }
  } else {
    for (let index = 0; index < 256; index += 1) {
      edges.push({ from: `n${index}`, to: `n${(index + 1) % 256}`, kind: 'requires' });
    }
    for (let index = 256; index < nodes.length; index += 1) {
      edges.push({ from: `n${Math.floor((index - 1) / 3)}`, to: `n${index}`, kind: 'requires' });
    }
    for (let index = 5_000; index < 9_000; index += 1) {
      edges.push({ from: 'n0', to: `n${index}`, kind: 'optional' });
    }
  }
  return {
    packageId,
    version: 1,
    kind: 'library',
    profile: 'phase2_economy',
    definitions: [],
    nodes,
    edges,
    exports: [],
    dependencies,
    imports: [],
  };
}

const started = process.hrtime.bigint();
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'omerta-phase2-scale-'));
try {
  const writeFixture = (root, source) => {
    const packageDir = path.join(root, 'package');
    fs.mkdirSync(packageDir, { recursive: true });
    fs.writeFileSync(path.join(packageDir, 'pack.json'), JSON.stringify(source), 'utf8');
    return discoverContentPackages({ rootDir: root, fixtureRoots: [root] });
  };
  let dependencyCatalog = { bundles: [] };
  let catalogBundle = null;
  let packages;
  if (fixture === 'aggregate') {
    const catalogRoot = path.join(temporaryRoot, 'catalog');
    const catalogResult = compileContentCorpus({
      packages: writeFixture(catalogRoot, fixtureSource('aggregate-catalog', {
        nodeCount: 3_000,
        packageId: 'omerta.phase2.scale.aggregate-catalog',
      })),
      compilerVersion: 'phase2a.1',
      dependencyCatalog: { bundles: [] },
    });
    catalogBundle = catalogResult.bundles[0];
    dependencyCatalog = { bundles: [{
      bundle: catalogBundle,
      authorityProfile: 'fixture',
      expectedHashes: {
        bundleHash: catalogBundle.hashes.bundleHash,
        dependencyLockHash: catalogBundle.hashes.dependencyLockHash,
      },
    }] };
    const root = path.join(temporaryRoot, 'root');
    packages = writeFixture(root, fixtureSource('aggregate-root', {
      nodeCount: 7_000,
      packageId: 'omerta.phase2.scale.aggregate-root',
      dependencies: [{
        packageId: catalogBundle.package.id,
        version: catalogBundle.package.version,
        bundleHash: catalogBundle.hashes.bundleHash,
      }],
    }));
  } else {
    packages = writeFixture(temporaryRoot, fixtureSource(fixture));
  }
  const result = compileContentCorpus({
    packages,
    compilerVersion: 'phase2a.1',
    dependencyCatalog,
  });
  const bundle = result.bundles[0];
  const sealedBytes = sealedBundleBytes(bundle, { authorityProfile: 'fixture' });
  const reopened = verifyStoredBundleBytes(sealedBytes, {
    bundleHash: bundle.hashes.bundleHash,
    dependencyLockHash: bundle.hashes.dependencyLockHash,
  }, {
    authorityProfile: 'fixture',
    dependencyCatalog,
  });
  if (reopened.hashes.bundleHash !== bundle.hashes.bundleHash) {
    throw new Error('stored scale bundle identity changed on reopen');
  }
  const memory = process.memoryUsage();
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
  const reportBytes = Object.fromEntries(Object.entries(bundle.reports).map(([name, report]) => (
    [name, canonicalBytes(report).byteLength]
  )));
  const catalogSealedBytes = catalogBundle === null
    ? 0
    : sealedBundleBytes(catalogBundle, { authorityProfile: 'fixture' }).byteLength;
  const deterministicOutputBytes = catalogSealedBytes + sealedBytes.byteLength
    + Object.values(reportBytes).reduce((sum, bytes) => sum + bytes, 0)
    + canonicalBytes(bundle.publicManifest).byteLength
    + canonicalBytes(result.knowledgeManifest).byteLength;
  const summary = {
    fixture,
    profile: bundle.package.profile,
    compilerVersion: bundle.compilerVersion,
    packageCount: result.bundles.length,
    nodeCount: bundle.ir.nodes.length,
    rootNodeCount: bundle.ir.nodes.length,
    catalogNodeCount: catalogBundle?.ir.nodes.length ?? 0,
    effectiveNodeCount: bundle.ir.nodes.length + (catalogBundle?.ir.nodes.length ?? 0),
    effectivePackageCount: result.bundles.length + (catalogBundle === null ? 0 : 1),
    dependencyCount: bundle.lock.dependencies.length,
    edgeCount: bundle.ir.edges.length,
    componentCount: bundle.analysis.componentCount,
    sccCount: bundle.analysis.sccCount,
    maximumSccSize: bundle.analysis.maximumSccSize,
    maximumWitnessIds: bundle.analysis.maximumWitnessIds,
    witnessBytes: canonicalBytes(bundle.analysis.largestSccWitness).byteLength,
    bundleHash: bundle.hashes.bundleHash,
    irHash: bundle.hashes.irHash,
    dependencyLockHash: bundle.hashes.dependencyLockHash,
    publicManifestHash: bundle.hashes.publicManifestHash,
    knowledgeManifestHash: hashKnowledgeManifest(result.knowledgeManifest),
    reportHashes: bundle.hashes.reportHashByName,
    reportBytes,
    sealedBundleBytes: sealedBytes.byteLength,
    elapsedMs,
    peakRssKilobytes: process.resourceUsage().maxRSS,
    peakHeapUsedBytes: null,
    endHeapUsedBytes: memory.heapUsed,
    endRssBytes: memory.rss,
    totalOutputBytes: deterministicOutputBytes,
    summaryOutputBytes: 0,
  };
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const bytes = Buffer.byteLength(`${JSON.stringify(summary)}\n`, 'utf8');
    if (bytes === summary.summaryOutputBytes) break;
    summary.summaryOutputBytes = bytes;
  }
  process.stdout.write(`${JSON.stringify(summary)}\n`);
} finally {
  const resolved = path.resolve(temporaryRoot);
  if (!resolved.startsWith(path.resolve(os.tmpdir()))) {
    throw new Error(`refusing to remove non-temporary path ${resolved}`);
  }
  fs.rmSync(resolved, { recursive: true, force: true });
}
