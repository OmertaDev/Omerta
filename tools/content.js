#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { bundleSummary, compileContentPack } from '../src/content/compiler.js';
import {
  canonicalClone,
  ContentCompileError,
  compileContentCorpus,
  sealedBundleBytes,
} from '../src/content/corpus.js';
import { canonicalBytes, compareCanonicalText } from '../src/content/canonical.js';
import { ContentDiscoveryError, discoverContentPackages } from '../src/content/discovery.js';
import { safeDiagnostic } from '../src/content/diagnostics.js';
import { parseAuthoredJson } from '../src/content/json-source.js';
import { publishImmutableCorpus } from './content-artifacts.js';

const [, , command, sourceArg, outputArg] = process.argv;
try {
  if (!['check', 'build', 'check-corpus', 'build-corpus'].includes(command)
      || !sourceArg
      || (['build', 'build-corpus'].includes(command) && !outputArg)) {
    throw new Error(
      'usage: node tools/content.js <check pack.json | build pack.json bundle.json | check-corpus root | build-corpus root output-directory>',
    );
  }
  const sourcePath = path.resolve(sourceArg);
  if (['check-corpus', 'build-corpus'].includes(command)) {
    const packages = discoverContentPackages({ rootDir: sourcePath })
      .filter(({ authorityProfile }) => authorityProfile === 'production');
    if (packages.length === 0) {
      throw new ContentDiscoveryError(
        'content_empty_corpus',
        'production corpus contains no manifests',
      );
    }
    const legacyPackages = [];
    const canonicalPackages = [];
    for (const entry of packages) {
      const source = parseAuthoredJson(entry.source);
      if (source?.schemaVersion === 1) legacyPackages.push(source);
      else canonicalPackages.push(entry);
    }
    for (const source of legacyPackages) compileContentPack(source);
    const corpus = canonicalPackages.length === 0 ? null : compileContentCorpus({
      packages: canonicalPackages,
      compilerVersion: 'phase2a.1',
      dependencyCatalog: { bundles: [] },
    });
    if (command === 'build-corpus') {
      if (legacyPackages.length > 0 || !corpus || corpus.bundles.length === 0) {
        throw new ContentCompileError(
          'content_profile_invalid',
          'build',
          'build-corpus requires canonical Phase 2 packages and no legacy packages',
        );
      }
      const outputPath = path.resolve(outputArg);
      const artifacts = corpus.bundles.map((bundle) => {
        const file = `${bundle.hashes.bundleHash}.bundle.json`;
        return {
          file,
          bytes: sealedBundleBytes(bundle, { authorityProfile: bundle.package.authorityProfile }),
          index: {
            packageId: bundle.package.id,
            packageVersion: bundle.package.version,
            authorityProfile: bundle.package.authorityProfile,
            bundleHash: bundle.hashes.bundleHash,
            dependencyLockHash: bundle.hashes.dependencyLockHash,
            publicManifestHash: bundle.hashes.publicManifestHash,
            file,
          },
        };
      });
      artifacts.sort((left, right) => compareCanonicalText(left.index.packageId, right.index.packageId));
      const indexBytes = canonicalBytes({
        artifactType: 'omerta.compiled-content-corpus-index',
        formatVersion: 1,
        compilerVersion: corpus.lock.compilerVersion,
        bundles: artifacts.map((artifact) => canonicalClone(artifact.index)),
      });
      const outputs = [
        ...artifacts.map((artifact) => ({ name: artifact.file, bytes: artifact.bytes })),
        { name: 'corpus.index.json', bytes: indexBytes },
      ];
      publishImmutableCorpus({ outputPath, outputs });
    }
    const summary = { ok: true, command, packageCount: packages.length };
    if (corpus) {
      summary.bundleHashes = corpus.bundles.map((bundle) => bundle.hashes.bundleHash);
      summary.legacyPackageCount = legacyPackages.length;
    }
    process.stdout.write(`${JSON.stringify(summary)}\n`);
  } else {
    const bundle = compileContentPack(parseAuthoredJson(fs.readFileSync(sourcePath)));
    if (command === 'build') {
      const outputPath = path.resolve(outputArg);
      const bytes = `${JSON.stringify(bundle, null, 2)}\n`;
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      if (fs.existsSync(outputPath)) {
        const existing = fs.readFileSync(outputPath, 'utf8');
        if (existing !== bytes) throw new Error(`refusing to overwrite immutable bundle ${outputPath}`);
      } else {
        fs.writeFileSync(outputPath, bytes, { encoding: 'utf8', flag: 'wx' });
      }
    }
    process.stdout.write(`${JSON.stringify({ ...bundleSummary(bundle), command })}\n`);
  }
} catch (error) {
  if (['check-corpus', 'build-corpus'].includes(command)) {
    const message = safeDiagnostic(error?.message ?? error);
    process.stderr.write(`content: ${message}\t${JSON.stringify({
      ok: false,
      error: error?.code ?? 'content_internal',
      message,
    })}\n`);
  } else {
    process.stderr.write(`content: ${safeDiagnostic(error.message)}\n`);
  }
  process.exitCode = 1;
}
