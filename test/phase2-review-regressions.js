// PHASE 2A REVIEW REGRESSIONS — quality/security and spec-review closure.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalBytes, compareCanonicalText, hashFrame } from '../src/content/canonical.js';
import * as corpusModule from '../src/content/corpus.js';
import { safeDiagnostic } from '../src/content/diagnostics.js';
import { discoverContentPackages } from '../src/content/discovery.js';
import * as economyProfile from '../src/content/economy-profile.js';

const {
  ECONOMY_ADAPTER_REGISTRY,
  ECONOMY_ADAPTER_REGISTRY_VERSION,
} = economyProfile;
const {
  ContentCompileError,
  compileContentCorpus,
  sealedBundleBytes,
  validateCompiledBundle,
  verifyStoredBundleBytes,
} = corpusModule;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMPILER_VERSION = 'phase2a.1';
const PACKAGE_SOURCE_LIMIT = 1024 * 1024;
const SERVER_VALUE_LIMIT = 1_000_000;
const temporaryRoots = [];
const failures = [];
let reviewCaseCount = 0;

function temporaryRoot(prefix = 'omerta-phase2-review-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}

function writePackage(root, directory, source) {
  const packageDir = path.join(root, directory);
  fs.mkdirSync(packageDir, { recursive: true });
  fs.writeFileSync(
    path.join(packageDir, 'pack.json'),
    typeof source === 'string' ? source : JSON.stringify(source),
    'utf8',
  );
}

function baseLibrary(overrides = {}) {
  return {
    packageId: 'omerta.phase2.review',
    version: 1,
    kind: 'library',
    profile: 'phase2_economy',
    definitions: [],
    nodes: [],
    edges: [],
    exports: [],
    dependencies: [],
    imports: [],
    ...overrides,
  };
}

function materialDefinition(overrides = {}) {
  return {
    id: 'material',
    definitionVersion: 1,
    kind: 'material',
    family: 'review_material',
    tags: ['review_material'],
    rarity: 'common',
    stackable: true,
    tradePolicy: { mode: 'closed', transferable: false },
    ownerScopes: ['account'],
    qualityMode: 'none',
    maximumLotQuantity: 1,
    conservationClass: 'consumable',
    ...overrides,
  };
}

function discovered(root, fixture = false) {
  return discoverContentPackages({
    rootDir: root,
    ...(fixture ? { fixtureRoots: [root] } : {}),
  });
}

function compileRoot(root, options = {}) {
  return compileContentCorpus({
    packages: discovered(root, options.fixture),
    compilerVersion: COMPILER_VERSION,
    dependencyCatalog: options.dependencyCatalog ?? { bundles: [] },
    overlayProvider: options.overlayProvider,
  });
}

function compileOne(source, options = {}) {
  const root = temporaryRoot();
  writePackage(root, 'package', source);
  return compileRoot(root, options).bundles[0];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function trustedCatalog(...bundles) {
  return {
    bundles: bundles.map((bundle) => ({
      bundle,
      authorityProfile: bundle.package.authorityProfile,
      expectedHashes: {
        bundleHash: bundle.hashes.bundleHash,
        dependencyLockHash: bundle.hashes.dependencyLockHash,
      },
    })),
  };
}

function trustedVerification(bundle, dependencyCatalog = { bundles: [] }) {
  return [{
    bundleHash: bundle.hashes.bundleHash,
    dependencyLockHash: bundle.hashes.dependencyLockHash,
  }, {
    authorityProfile: bundle.package.authorityProfile,
    dependencyCatalog,
  }];
}

function reportHashes(reports) {
  return Object.fromEntries(Object.entries(reports).map(([name, report]) => [
    name,
    crypto.createHash('sha256').update(canonicalBytes(report)).digest('hex'),
  ]));
}

function rehashBundle(bundle) {
  bundle.sourceSummary = {
    files: 1,
    bytes: canonicalBytes(bundle.canonicalHashInputs.source).byteLength,
  };
  bundle.hashes.sourceHash = hashFrame('omerta:source:v1', [
    ['canonicalPublicAuthoredInputs', bundle.canonicalHashInputs.source],
  ]);
  bundle.lock.root.sourceHash = bundle.hashes.sourceHash;
  bundle.canonicalHashInputs.dependencyLock = clone(bundle.lock);
  bundle.hashes.secretOverlayHash = hashFrame('omerta:secret-overlay:v1', [
    ['canonicalPrivateOverlay', bundle.canonicalHashInputs.secretOverlay],
  ]);
  bundle.hashes.dependencyLockHash = hashFrame('omerta:dependency-lock:v1', [
    ['canonicalResolvedDependencyClosure', bundle.canonicalHashInputs.dependencyLock],
  ]);
  bundle.hashes.irHash = hashFrame('omerta:compiled-ir:v1', [
    ['canonicalCompiledIR', bundle.canonicalHashInputs.ir],
  ]);
  bundle.hashes.publicManifestHash = hashFrame('omerta:public-manifest:v1', [
    ['canonicalSafePublicManifest', bundle.canonicalHashInputs.publicManifest],
  ]);
  if (bundle.publicManifest) {
    bundle.publicManifest.publicManifestHash = bundle.hashes.publicManifestHash;
  }
  bundle.hashes.reportHashByName = reportHashes(bundle.reports);
  bundle.canonicalHashInputs.bundle = {
    formatVersion: bundle.formatVersion,
    compilerVersion: bundle.compilerVersion,
    profile: bundle.package.profile,
    packageId: bundle.package.id,
    packageVersion: bundle.package.version,
    sourceHash: bundle.hashes.sourceHash,
    secretOverlayHash: bundle.hashes.secretOverlayHash,
    dependencyLockHash: bundle.hashes.dependencyLockHash,
    irHash: bundle.hashes.irHash,
  };
  bundle.hashes.bundleHash = hashFrame('omerta:bundle:v1', [
    ['formatVersion', bundle.canonicalHashInputs.bundle.formatVersion],
    ['compilerVersion', bundle.canonicalHashInputs.bundle.compilerVersion],
    ['profile', bundle.canonicalHashInputs.bundle.profile],
    ['packageId', bundle.canonicalHashInputs.bundle.packageId],
    ['packageVersion', bundle.canonicalHashInputs.bundle.packageVersion],
    ['sourceHash', bundle.canonicalHashInputs.bundle.sourceHash],
    ['secretOverlayHash', bundle.canonicalHashInputs.bundle.secretOverlayHash],
    ['dependencyLockHash', bundle.canonicalHashInputs.bundle.dependencyLockHash],
    ['irHash', bundle.canonicalHashInputs.bundle.irHash],
  ]);
  return bundle;
}

function rejectsCode(operation, code) {
  assert.throws(operation, (error) => {
    assert.equal(error?.code, code, error?.stack);
    return true;
  });
}

function cliError(run) {
  const line = run.stderr.trim().split('\t').at(-1);
  try { return JSON.parse(line); }
  catch { return null; }
}

function reviewCase(name, operation) {
  reviewCaseCount += 1;
  try {
    operation();
    console.log(`✓ ${name}`);
  } catch (error) {
    failures.push(new Error(name, { cause: error }));
  }
}

function dependencySources() {
  const cSource = baseLibrary({
    packageId: 'omerta.phase2.dep.c',
    definitions: [{ id: 'definition', definitionVersion: 1, kind: 'concept' }],
    exports: ['definition'],
  });
  const c = compileOne(cSource);
  const bSource = baseLibrary({
    packageId: 'omerta.phase2.dep.b',
    dependencies: [{ packageId: c.package.id, version: c.package.version, bundleHash: c.hashes.bundleHash }],
  });
  const b = compileOne(bSource, { dependencyCatalog: trustedCatalog(c) });
  const aSource = baseLibrary({
    packageId: 'omerta.phase2.dep.a',
    dependencies: [{ packageId: b.package.id, version: b.package.version, bundleHash: b.hashes.bundleHash }],
  });
  return { aSource, bSource, cSource, b, c };
}

function padEmbeddedAuthoredSource(bundle, targetBytes) {
  const sourceNodes = bundle.canonicalHashInputs.source.files[0].source.nodes;
  const irById = new Map(bundle.ir.nodes.map((node) => [node.id, node]));
  const hashIrById = new Map(bundle.canonicalHashInputs.ir.nodes.map((node) => [node.id, node]));
  for (const sourceNode of sourceNodes) {
    sourceNode.metadata = { summary: '' };
    const qualified = `${bundle.package.id}::${sourceNode.id}`;
    irById.get(qualified).metadata = { summary: '' };
    hashIrById.get(qualified).metadata = { summary: '' };
  }
  const embeddedSource = bundle.canonicalHashInputs.source.files[0].source;
  let remaining = targetBytes - canonicalBytes(embeddedSource).byteLength;
  assert(remaining >= 0, 'padding base exceeds requested boundary');
  for (const sourceNode of sourceNodes) {
    if (remaining === 0) break;
    const count = Math.min(60_000, remaining);
    const text = 'x'.repeat(count);
    sourceNode.metadata.summary = text;
    const qualified = `${bundle.package.id}::${sourceNode.id}`;
    irById.get(qualified).metadata.summary = text;
    hashIrById.get(qualified).metadata.summary = text;
    remaining -= count;
  }
  assert.equal(remaining, 0, 'insufficient bounded metadata slots for exact source-byte target');
  assert.equal(canonicalBytes(embeddedSource).byteLength, targetBytes);
  return rehashBundle(bundle);
}

try {
  reviewCase('I1/I2 overlays reject every non-empty payload while absent and empty remain distinct', () => {
    const source = baseLibrary({ packageId: 'omerta.phase2.overlay.review' });
    const absent = compileOne(source);
    const empty = compileOne(source, { overlayProvider: () => Buffer.alloc(0) });
    assert.notEqual(absent.hashes.secretOverlayHash, empty.hashes.secretOverlayHash);
    for (const payload of [
      '{"currency":"OMR","javascript":"function pwn(){}"}',
      '{"a":1,"a":2}',
      '{"__proto__":{}}',
      '{"url":"https://example.invalid","modulePath":"./runtime.js"}',
      '{"environment":"production","seed":"author","timestamp":"now"}',
      '<script>alert(1)</script>',
      'x'.repeat(49_152),
      'x'.repeat(49_153),
      'x'.repeat(1024 * 1024),
    ]) {
      rejectsCode(() => compileOne(source, { overlayProvider: () => Buffer.from(payload) }), 'content_profile_invalid');
    }
    const forged = clone(empty);
    forged.secretOverlay = {
      state: 'present', bytesBase64: Buffer.from('{"currency":"wrappedOMR"}').toString('base64'),
    };
    forged.canonicalHashInputs.secretOverlay = clone(forged.secretOverlay);
    rehashBundle(forged);
    rejectsCode(() => validateCompiledBundle(forged, { authorityProfile: 'production' }), 'content_profile_invalid');
    const [expected, options] = trustedVerification(forged);
    rejectsCode(() => verifyStoredBundleBytes(canonicalBytes(forged), expected, options), 'content_profile_invalid');
    for (const valid of [absent, empty]) {
      const bytes = sealedBundleBytes(valid, { authorityProfile: 'production' });
      const [trustedExpected, trustedOptions] = trustedVerification(valid);
      assert.equal(
        verifyStoredBundleBytes(bytes, trustedExpected, trustedOptions).hashes.bundleHash,
        valid.hashes.bundleHash,
      );
    }
  });

  reviewCase('I5/spec-I2 adapter registry pins versions, pairings, bounded value, and report authority', () => {
    rejectsCode(() => compileOne(baseLibrary({ nodes: [{
      id: 'wrong', kind: 'terminal', refs: [],
      adapter: { kind: 'inventory_source', args: {
        definitionId: 'wrong', maxUnitsPerEpoch: 1, epoch: 'day',
      } },
    }] })), 'content_schema_invalid');
    rejectsCode(() => compileOne(baseLibrary({
      definitions: [{ id: 'material', definitionVersion: 1, kind: 'concept' }],
      nodes: [{
        id: 'create', kind: 'source', refs: ['material'],
        adapter: { kind: 'inventory_create', args: {
          definitionId: 'material', quantity: Number.MAX_SAFE_INTEGER,
        } },
      }],
    })), 'content_input_limit');
    const valueBundle = compileOne(baseLibrary({
      packageId: 'omerta.phase2.adapter.review',
      definitions: [{ id: 'material', definitionVersion: 1, kind: 'concept' }],
      nodes: [{
        id: 'source', kind: 'source', refs: ['material'],
        adapter: { kind: 'inventory_source', args: {
          definitionId: 'material', maxUnitsPerEpoch: 1, epoch: 'day',
        } },
      }],
      edges: [{ from: 'source', to: 'material', kind: 'produces', quantity: 1 }],
    }));
    assert.equal(valueBundle.ir.adapterRegistryVersion, 1);
    assert.equal(valueBundle.ir.nodes.find((node) => node.adapter).adapter.adapterVersion, 1);
    assert.equal(valueBundle.lock.adapterRegistry.registryVersion, 1);
    assert.deepEqual(valueBundle.reports.economy.sources, ['omerta.phase2.adapter.review::source']);
    assert.equal(valueBundle.reports.economy.valueAuthority.creates, 1);
    const versionTamper = clone(valueBundle);
    versionTamper.ir.nodes.find((node) => node.adapter).adapter.adapterVersion = 2;
    versionTamper.canonicalHashInputs.ir.nodes.find((node) => node.adapter).adapter.adapterVersion = 2;
    rehashBundle(versionTamper);
    rejectsCode(() => validateCompiledBundle(versionTamper, { authorityProfile: 'production' }), 'content_schema_invalid');
    assert.equal(ECONOMY_ADAPTER_REGISTRY_VERSION, 1);
    assert(Object.isFrozen(ECONOMY_ADAPTER_REGISTRY));
    for (const descriptor of Object.values(ECONOMY_ADAPTER_REGISTRY)) {
      for (const field of [
        'adapterVersion', 'profiles', 'authorityProfiles', 'nodeKinds', 'transactionClass',
        'lockClasses', 'replayPolicy', 'visibilityPolicy', 'valueClass', 'reportClass', 'args', 'cash',
      ]) {
        assert(Object.hasOwn(descriptor, field), `adapter descriptor missing ${field}`);
      }
    }
    const registryLockTamper = clone(valueBundle);
    registryLockTamper.lock.adapterRegistry.adapters[0].adapterVersion = 2;
    registryLockTamper.canonicalHashInputs.dependencyLock = clone(registryLockTamper.lock);
    rehashBundle(registryLockTamper);
    rejectsCode(
      () => validateCompiledBundle(registryLockTamper, { authorityProfile: 'production' }),
      'content_artifact_mismatch',
    );
  });

  reviewCase('I6/spec-I3 separator-insensitive OMR aliases reject semantic fields and reports derive zero', () => {
    const aliases = ['OMR', '$OMR', 'omr_token', 'omrtoken', 'omerta-token', 'omertaToken', 'wrappedOMR'];
    for (const [index, alias] of aliases.entries()) {
      rejectsCode(() => compileOne(baseLibrary({
        packageId: `omerta.phase2.alias${index}`,
        definitions: [{
          id: `definition${index}`,
          definitionVersion: 1,
          kind: 'material',
          family: alias,
          tags: ['ordinary'],
          rarity: 'common',
          stackable: true,
          tradePolicy: { mode: 'closed', transferable: false },
          ownerScopes: ['account'],
          qualityMode: 'none',
          maximumLotQuantity: 1,
          conservationClass: 'finite',
        }],
      })), 'content_omr_forbidden');
      rejectsCode(() => compileOne(baseLibrary({
        packageId: `omerta.phase2.tagalias${index}`,
        metadata: { tags: [alias] },
      })), 'content_omr_forbidden');
    }
    rejectsCode(() => compileOne(baseLibrary({
      packageId: 'omerta.phase2.omrtoken.review',
    })), 'content_omr_forbidden');
    const prose = compileOne(baseLibrary({
      packageId: 'omerta.phase2.prose.review',
      metadata: {
        title: 'The wrapped OMR rumor',
        summary: 'A story can mention omerta-token without granting authority.',
      },
    }));
    assert.deepEqual(prose.reports.economy.omrAuthority, { references: 0, movement: 0 });
  });

  reviewCase('spec-I4 package kinds enforce one primary experience and activation closure', () => {
    const library = compileOne(baseLibrary({ packageId: 'omerta.phase2.library.review' }));
    assert.equal(library.package.activatable, false);
    rejectsCode(() => compileOne(baseLibrary({ nodes: [{
      id: 'primary', kind: 'experience', refs: [],
    }] })), 'content_profile_invalid');
    rejectsCode(() => compileOne(baseLibrary({
      kind: 'experience',
      entrypoint: 'terminal',
      nodes: [{ id: 'terminal', kind: 'terminal', refs: [] }],
    })), 'content_profile_invalid');
    rejectsCode(() => compileOne(baseLibrary({
      kind: 'experience',
      entrypoint: 'first',
      nodes: [
        { id: 'first', kind: 'experience', refs: [] },
        { id: 'second', kind: 'experience', refs: [] },
      ],
    })), 'content_profile_invalid');
    const valid = compileOne(baseLibrary({
      packageId: 'omerta.phase2.experience.review',
      kind: 'experience',
      entrypoint: 'primary',
      nodes: [
        { id: 'primary', kind: 'experience', refs: [] },
        { id: 'terminal', kind: 'terminal', refs: [] },
      ],
    }));
    assert.equal(valid.package.activatable, true);
    const flagTamper = clone(library);
    flagTamper.package.activatable = true;
    rejectsCode(() => validateCompiledBundle(flagTamper, { authorityProfile: 'production' }), 'content_profile_invalid');
    const fixtureRoot = temporaryRoot();
    writePackage(fixtureRoot, 'fixture', {
      ...baseLibrary({ packageId: 'omerta.phase2.fixture-experience.review' }),
      kind: 'experience',
      entrypoint: 'primary',
      nodes: [{ id: 'primary', kind: 'experience', refs: [] }],
    });
    const fixture = compileRoot(fixtureRoot, { fixture: true }).bundles[0];
    assert.equal(fixture.package.authoredKind, 'experience');
    assert.equal(fixture.package.activatable, false);
  });

  reviewCase('re-review I1 exports are exact owned definitions across direct, CLI, and stored paths', () => {
    const libraryGraphExport = baseLibrary({
      packageId: 'omerta.phase2.graph-export.library',
      nodes: [{ id: 'step', kind: 'step' }],
      exports: ['step'],
    });
    rejectsCode(() => compileOne(libraryGraphExport), 'content_dependency_unresolved');

    const experienceGraphExport = baseLibrary({
      packageId: 'omerta.phase2.graph-export.experience',
      kind: 'experience',
      entrypoint: 'primary',
      nodes: [
        { id: 'primary', kind: 'experience' },
        { id: 'visible-step', kind: 'step' },
      ],
      exports: ['visible-step'],
    });
    rejectsCode(() => compileOne(experienceGraphExport), 'content_dependency_unresolved');

    const exportedDefinitionSource = baseLibrary({
      packageId: 'omerta.phase2.definition-export.review',
      definitions: [{ id: 'contract', definitionVersion: 3, kind: 'concept' }],
      nodes: [{ id: 'private-step', kind: 'step' }],
      exports: ['contract'],
    });
    const exportedDefinition = compileOne(exportedDefinitionSource);
    const exportedId = 'omerta.phase2.definition-export.review::contract';
    const definitionNode = exportedDefinition.ir.nodes.find((node) => node.id === exportedId);
    assert.equal(definitionNode.nodeClass, 'definition');
    assert.equal(definitionNode.definitionVersion, 3);
    assert.equal(
      exportedDefinition.hashes.definitionHashById[exportedId],
      definitionNode.definitionHash,
    );
    assert.deepEqual(exportedDefinition.publicManifest.exports, [exportedId]);
    assert.deepEqual(exportedDefinition.publicManifest.nodes.map((node) => node.id), [exportedId]);
    const explicitGraphVisibility = compileOne({
      ...exportedDefinitionSource,
      packageId: 'omerta.phase2.public-graph.review',
      nodes: [{ id: 'public-step', kind: 'step', public: true }],
    });
    assert.deepEqual(explicitGraphVisibility.publicManifest.exports, [
      'omerta.phase2.public-graph.review::contract',
    ]);
    assert.deepEqual(explicitGraphVisibility.publicManifest.nodes.map((node) => node.id), [
      'omerta.phase2.public-graph.review::contract',
      'omerta.phase2.public-graph.review::public-step',
    ]);

    const consumerSource = baseLibrary({
      packageId: 'omerta.phase2.definition-import.review',
      dependencies: [{
        packageId: exportedDefinition.package.id,
        version: exportedDefinition.package.version,
        bundleHash: exportedDefinition.hashes.bundleHash,
      }],
      imports: [{
        id: exportedId,
        definitionHash: definitionNode.definitionHash,
        dependencyBundleHash: exportedDefinition.hashes.bundleHash,
      }],
    });
    const consumer = compileOne(consumerSource, { dependencyCatalog: trustedCatalog(exportedDefinition) });
    assert.equal(consumer.ir.imports[0].definitionHash, definitionNode.definitionHash);
    rejectsCode(() => compileOne({
      ...consumerSource,
      packageId: 'omerta.phase2.definition-reexport.review',
      exports: [exportedId],
    }, { dependencyCatalog: trustedCatalog(exportedDefinition) }), 'content_dependency_unresolved');

    const storedSource = baseLibrary({
      packageId: 'omerta.phase2.stored-export.review',
      definitions: [{ id: 'contract', definitionVersion: 1, kind: 'concept' }],
      nodes: [{ id: 'step', kind: 'step' }],
      exports: ['contract'],
    });
    const storedTamper = clone(compileOne(storedSource));
    const storedGraphId = `${storedTamper.package.id}::step`;
    storedTamper.canonicalHashInputs.source.files[0].source.exports = ['step'];
    storedTamper.ir.exports = [storedGraphId];
    storedTamper.canonicalHashInputs.ir.exports = [storedGraphId];
    storedTamper.canonicalHashInputs.publicManifest.exports = [storedGraphId];
    storedTamper.canonicalHashInputs.publicManifest.nodes = [{
      id: storedGraphId,
      kind: 'step',
      ordinal: storedTamper.ir.nodes.find((node) => node.id === storedGraphId).ordinal,
    }];
    storedTamper.publicManifest = {
      ...clone(storedTamper.canonicalHashInputs.publicManifest),
      publicManifestHash: '',
    };
    rehashBundle(storedTamper);
    rejectsCode(
      () => validateCompiledBundle(storedTamper, { authorityProfile: 'production' }),
      'content_dependency_unresolved',
    );
    const missingVersion = clone(exportedDefinition);
    delete missingVersion.ir.nodes.find((node) => node.id === exportedId).definitionVersion;
    delete missingVersion.canonicalHashInputs.ir.nodes.find((node) => node.id === exportedId).definitionVersion;
    delete missingVersion.canonicalHashInputs.source.files[0].source.definitions[0].definitionVersion;
    rehashBundle(missingVersion);
    rejectsCode(
      () => validateCompiledBundle(missingVersion, { authorityProfile: 'production' }),
      'content_schema_invalid',
    );
    const missingHashOwnership = clone(exportedDefinition);
    delete missingHashOwnership.hashes.definitionHashById[exportedId];
    delete missingHashOwnership.canonicalHashInputs.definitionById[exportedId];
    rejectsCode(
      () => validateCompiledBundle(missingHashOwnership, { authorityProfile: 'production' }),
      'content_hash_mismatch',
    );

    const checkRoot = temporaryRoot();
    writePackage(checkRoot, 'invalid-library', libraryGraphExport);
    const check = spawnSync(process.execPath, ['tools/content.js', 'check-corpus', checkRoot], {
      cwd: ROOT, encoding: 'utf8',
    });
    assert.equal(check.status, 1);
    assert.equal(cliError(check)?.error, 'content_dependency_unresolved');
    const buildRoot = temporaryRoot();
    writePackage(buildRoot, 'invalid-experience', experienceGraphExport);
    const build = spawnSync(process.execPath, [
      'tools/content.js', 'build-corpus', buildRoot, path.join(temporaryRoot(), 'output'),
    ], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(build.status, 1);
    assert.equal(cliError(build)?.error, 'content_dependency_unresolved');
  });

  reviewCase('re-review M1 adapter registry is independently OMR-safe and prototype-closed', () => {
    assert.equal(Object.getPrototypeOf(ECONOMY_ADAPTER_REGISTRY), null);
    assert.equal(typeof economyProfile.validateEconomyAdapterRegistry, 'function');
    assert.deepEqual(
      economyProfile.validateEconomyAdapterRegistry(ECONOMY_ADAPTER_REGISTRY),
      { references: 0, movement: 0 },
    );
    const syntheticRegistry = Object.assign(
      Object.create(null),
      clone(ECONOMY_ADAPTER_REGISTRY),
    );
    syntheticRegistry.observe.lockClasses = ['wrapped-omr'];
    rejectsCode(
      () => economyProfile.validateEconomyAdapterRegistry(syntheticRegistry),
      'content_omr_forbidden',
    );

    for (const hostileKind of ['constructor', '__proto__', 'toString']) {
      rejectsCode(() => compileOne(baseLibrary({
        packageId: `omerta.phase2.hostile.${hostileKind.toLowerCase().replaceAll('_', '-')}`,
        nodes: [{
          id: 'node', kind: 'step',
          adapter: { kind: hostileKind, args: {} },
        }],
      })), 'content_schema_invalid');
    }
    rejectsCode(
      () => economyProfile.compileEconomyAdapter({ kind: 'constructor', args: {} }),
      'content_schema_invalid',
    );
    rejectsCode(
      () => economyProfile.economyAdapterRegistryLock([{ adapter: { kind: '__proto__' } }]),
      'content_schema_invalid',
    );
    const storedHostile = clone(compileOne(baseLibrary({
      packageId: 'omerta.phase2.hostile.stored',
      nodes: [{ id: 'node', kind: 'step', adapter: { kind: 'observe', args: {} } }],
    })));
    storedHostile.canonicalHashInputs.source.files[0].source.nodes[0].adapter.kind = 'constructor';
    storedHostile.ir.nodes[0].adapter.kind = 'constructor';
    storedHostile.canonicalHashInputs.ir.nodes[0].adapter.kind = 'constructor';
    rehashBundle(storedHostile);
    rejectsCode(
      () => validateCompiledBundle(storedHostile, { authorityProfile: 'production' }),
      'content_schema_invalid',
    );
    for (const [command, hostileKind] of [['check-corpus', 'constructor'], ['build-corpus', '__proto__']]) {
      const root = temporaryRoot();
      writePackage(root, 'hostile', baseLibrary({
        packageId: `omerta.phase2.hostile.cli-${command}`,
        nodes: [{ id: 'node', kind: 'step', adapter: { kind: hostileKind, args: {} } }],
      }));
      const args = ['tools/content.js', command, root];
      if (command === 'build-corpus') args.push(path.join(temporaryRoot(), 'output'));
      const run = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
      assert.equal(run.status, 1);
      assert.equal(cliError(run)?.error, 'content_schema_invalid');
    }
    Object.prototype.polluted_adapter = ECONOMY_ADAPTER_REGISTRY.observe;
    try {
      rejectsCode(() => compileOne(baseLibrary({
        packageId: 'omerta.phase2.hostile.polluted',
        nodes: [{
          id: 'node', kind: 'step',
          adapter: { kind: 'polluted_adapter', args: {} },
        }],
      })), 'content_schema_invalid');
    } finally {
      delete Object.prototype.polluted_adapter;
    }
  });

  reviewCase('quality value declarations, quantities, and derived report paths are closed', () => {
    for (const kind of ['source', 'sink', 'use', 'recipe']) {
      rejectsCode(() => compileOne(baseLibrary({
        packageId: `omerta.phase2.adapterless.${kind}`,
        nodes: [{ id: kind, kind }],
      })), 'content_schema_invalid');
    }

    const boundedDefinition = materialDefinition({ maximumLotQuantity: SERVER_VALUE_LIMIT });
    assert.equal(compileOne(baseLibrary({
      packageId: 'omerta.phase2.max-lot.exact',
      definitions: [boundedDefinition],
    })).ir.nodes[0].semantic.maximumLotQuantity, SERVER_VALUE_LIMIT);
    for (const maximumLotQuantity of [SERVER_VALUE_LIMIT + 1, Number.MAX_SAFE_INTEGER]) {
      rejectsCode(() => compileOne(baseLibrary({
        packageId: `omerta.phase2.max-lot.over${maximumLotQuantity}`,
        definitions: [materialDefinition({ maximumLotQuantity })],
      })), 'content_input_limit');
    }

    const edgeSource = baseLibrary({
      packageId: 'omerta.phase2.edge-quantity.review',
      nodes: [{ id: 'from', kind: 'step' }, { id: 'to', kind: 'step' }],
      edges: [{ from: 'from', to: 'to', kind: 'requires', quantity: SERVER_VALUE_LIMIT }],
    });
    assert.equal(compileOne(edgeSource).ir.edges[0].quantity, SERVER_VALUE_LIMIT);
    rejectsCode(() => compileOne({
      ...edgeSource,
      packageId: 'omerta.phase2.edge-quantity.over',
      edges: [{ ...edgeSource.edges[0], quantity: SERVER_VALUE_LIMIT + 1 }],
    }), 'content_input_limit');

    const missingEdgeSource = baseLibrary({
      packageId: 'omerta.phase2.value-edge.missing',
      definitions: [materialDefinition()],
      nodes: [{
        id: 'source', kind: 'source', refs: ['material'],
        adapter: { kind: 'inventory_source', args: {
          definitionId: 'material', maxUnitsPerEpoch: 2, epoch: 'day',
        } },
      }],
    });
    rejectsCode(() => compileOne(missingEdgeSource), 'content_schema_invalid');
    rejectsCode(() => compileOne({
      ...missingEdgeSource,
      packageId: 'omerta.phase2.value-edge.missing-ref',
      nodes: [{ ...missingEdgeSource.nodes[0], refs: [] }],
      edges: [{ from: 'source', to: 'material', kind: 'produces', quantity: 1 }],
    }), 'content_schema_invalid');
    const mismatchedQuantitySource = {
      ...missingEdgeSource,
      packageId: 'omerta.phase2.value-edge.quantity-mismatch',
      nodes: [{
        id: 'source', kind: 'source', refs: ['material'],
        adapter: { kind: 'inventory_source', args: {
          definitionId: 'material', maxUnitsPerEpoch: 1, epoch: 'day',
        } },
      }],
      edges: [{ from: 'source', to: 'material', kind: 'produces', quantity: 2 }],
    };
    rejectsCode(() => compileOne(mismatchedQuantitySource), 'content_schema_invalid');
    rejectsCode(() => compileOne(baseLibrary({
      packageId: 'omerta.phase2.value-edge.unclassified',
      definitions: [materialDefinition()],
      nodes: [{ id: 'step', kind: 'step', refs: ['material'] }],
      edges: [{ from: 'step', to: 'material', kind: 'produces', quantity: 1 }],
    })), 'content_schema_invalid');

    for (const [command, source] of [
      ['check-corpus', missingEdgeSource],
      ['build-corpus', {
        ...edgeSource,
        packageId: 'omerta.phase2.edge-quantity.cli-over',
        edges: [{ ...edgeSource.edges[0], quantity: SERVER_VALUE_LIMIT + 1 }],
      }],
    ]) {
      const root = temporaryRoot();
      writePackage(root, 'invalid', source);
      const args = ['tools/content.js', command, root];
      if (command === 'build-corpus') args.push(path.join(temporaryRoot(), 'output'));
      const run = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
      assert.equal(run.status, 1);
      assert.equal(
        cliError(run)?.error,
        command === 'check-corpus' ? 'content_schema_invalid' : 'content_input_limit',
      );
    }
    const edgeStoredTamper = clone(compileOne(edgeSource));
    edgeStoredTamper.canonicalHashInputs.source.files[0].source.edges[0].quantity = SERVER_VALUE_LIMIT + 1;
    edgeStoredTamper.ir.edges[0].quantity = SERVER_VALUE_LIMIT + 1;
    edgeStoredTamper.canonicalHashInputs.ir.edges[0].quantity = SERVER_VALUE_LIMIT + 1;
    rehashBundle(edgeStoredTamper);
    rejectsCode(
      () => validateCompiledBundle(edgeStoredTamper, { authorityProfile: 'production' }),
      'content_input_limit',
    );

    const valueBundle = compileOne(baseLibrary({
      packageId: 'omerta.phase2.value-path.review',
      definitions: [materialDefinition()],
      nodes: [
        {
          id: 'source', kind: 'source', refs: ['material'],
          adapter: { kind: 'inventory_source', args: {
            definitionId: 'material', maxUnitsPerEpoch: 10, epoch: 'day',
          } },
        },
        {
          id: 'sink', kind: 'sink', refs: ['material'],
          adapter: { kind: 'inventory_sink', args: { definitionId: 'material', quantity: 1 } },
        },
      ],
      edges: [
        { from: 'source', to: 'material', kind: 'produces', quantity: 1 },
        { from: 'material', to: 'sink', kind: 'sinks', quantity: 1 },
      ],
    }));
    assert.deepEqual(
      valueBundle.reports.economy.valuePaths.map((entry) => ({
        nodeId: entry.nodeId,
        valueClass: entry.valueClass,
        definitionId: entry.args.definitionId,
      })),
      [
        {
          nodeId: 'omerta.phase2.value-path.review::sink',
          valueClass: 'destroy',
          definitionId: 'omerta.phase2.value-path.review::material',
        },
        {
          nodeId: 'omerta.phase2.value-path.review::source',
          valueClass: 'create',
          definitionId: 'omerta.phase2.value-path.review::material',
        },
      ],
    );
    assert.equal(valueBundle.reports.economy.valueAuthority.paths, 2);
    assert.deepEqual(valueBundle.reports.economy.orphans, []);
    assert.deepEqual(valueBundle.reports.economy.errors, [{
      code: 'economy_missing_use',
      definitionId: 'omerta.phase2.value-path.review::material',
    }]);
    assert.deepEqual(valueBundle.reports.economy.adapterRegistry.omrAuthority, {
      references: 0, movement: 0,
    });
    const reportTamper = clone(valueBundle);
    reportTamper.reports.economy.valuePaths = [];
    reportTamper.hashes.reportHashByName = reportHashes(reportTamper.reports);
    rejectsCode(
      () => validateCompiledBundle(reportTamper, { authorityProfile: 'production' }),
      'content_hash_mismatch',
    );
    const storedMismatch = clone(valueBundle);
    const storedSinkEdge = storedMismatch.ir.edges.find((edge) => edge.kind === 'sinks');
    storedSinkEdge.quantity = 2;
    storedMismatch.canonicalHashInputs.ir.edges.find((edge) => edge.kind === 'sinks').quantity = 2;
    storedMismatch.canonicalHashInputs.source.files[0].source.edges
      .find((edge) => edge.kind === 'sinks').quantity = 2;
    rehashBundle(storedMismatch);
    rejectsCode(
      () => validateCompiledBundle(storedMismatch, { authorityProfile: 'production' }),
      'content_schema_invalid',
    );
    const orphanBundle = compileOne(baseLibrary({
      packageId: 'omerta.phase2.orphan.review',
      definitions: [materialDefinition()],
    }));
    assert.deepEqual(orphanBundle.reports.economy.orphans, [
      'omerta.phase2.orphan.review::material',
    ]);
  });

  reviewCase('I3/spec-I5 dependencies prove direct imports and complete transitive closure', () => {
    const { aSource, bSource, cSource, b, c } = dependencySources();
    rejectsCode(
      () => compileOne(aSource, { dependencyCatalog: trustedCatalog(b) }),
      'content_dependency_unresolved',
    );
    const a = compileOne(aSource, { dependencyCatalog: trustedCatalog(b, c) });
    assert.deepEqual(a.lock.directDependencies, [aSource.dependencies[0]]);
    assert.deepEqual(a.lock.dependencies.map((entry) => entry.packageId), [
      'omerta.phase2.dep.b', 'omerta.phase2.dep.c',
    ]);

    const consumer = compileOne(baseLibrary({
      packageId: 'omerta.phase2.import.review',
      dependencies: [{ packageId: c.package.id, version: c.package.version, bundleHash: c.hashes.bundleHash }],
      imports: [{
        id: 'omerta.phase2.dep.c::definition',
        definitionHash: c.hashes.definitionHashById['omerta.phase2.dep.c::definition'],
        dependencyBundleHash: c.hashes.bundleHash,
      }],
    }), { dependencyCatalog: trustedCatalog(c) });
    const missing = clone(consumer);
    missing.canonicalHashInputs.source.files[0].source.dependencies = [];
    missing.lock.directDependencies = [];
    missing.lock.dependencies = [];
    missing.canonicalHashInputs.dependencyLock = clone(missing.lock);
    rehashBundle(missing);
    rejectsCode(() => validateCompiledBundle(missing, { authorityProfile: 'production' }), 'content_dependency_unresolved');
    const [expected, options] = trustedVerification(missing);
    rejectsCode(() => verifyStoredBundleBytes(canonicalBytes(missing), expected, options), 'content_dependency_unresolved');

    const changedC = compileOne({
      ...cSource,
      definitions: [{ id: 'definition', definitionVersion: 1, kind: 'concept', metadata: { title: 'changed' } }],
    });
    rejectsCode(() => compileOne(baseLibrary({
      packageId: 'omerta.phase2.ambiguous.review',
    }), { dependencyCatalog: trustedCatalog(c, changedC) }), 'content_dependency_drift');

    const ambiguousClosure = clone(a);
    ambiguousClosure.lock.dependencies.splice(1, 0, {
      ...ambiguousClosure.lock.dependencies[0],
      version: ambiguousClosure.lock.dependencies[0].version + 1,
    });
    ambiguousClosure.canonicalHashInputs.dependencyLock = clone(ambiguousClosure.lock);
    rehashBundle(ambiguousClosure);
    rejectsCode(
      () => validateCompiledBundle(ambiguousClosure, { authorityProfile: 'production' }),
      'content_dependency_drift',
    );

    const root = temporaryRoot();
    writePackage(root, 'c', cSource);
    writePackage(root, 'b', bSource);
    writePackage(root, 'a', aSource);
    const result = compileRoot(root);
    assert.equal(result.bundles.length, 3);
    assert.deepEqual(
      result.bundles.find((bundle) => bundle.package.id === a.package.id).lock.dependencies,
      a.lock.dependencies,
    );
  });

  reviewCase('I4 stored validation separately bounds authored source and compiler-owned envelope bytes', () => {
    for (const fixture of [false, true]) {
      const source = baseLibrary({
        packageId: `omerta.phase2.source-bound.${fixture ? 'fixture' : 'production'}`,
        nodes: Array.from({ length: 100 }, (_, index) => ({ id: `node${index}`, kind: 'step' })),
      });
      const exact = fixture
        ? (() => {
          const root = temporaryRoot();
          writePackage(root, 'package', source);
          return compileRoot(root, { fixture: true }).bundles[0];
        })()
        : compileOne(source);
      padEmbeddedAuthoredSource(exact, PACKAGE_SOURCE_LIMIT);
      assert.equal(
        canonicalBytes(exact.canonicalHashInputs.source.files[0].source).byteLength,
        PACKAGE_SOURCE_LIMIT,
      );
      assert(canonicalBytes(exact.canonicalHashInputs.source).byteLength > PACKAGE_SOURCE_LIMIT,
        'compiler-owned source envelope must retain its distinct workspace allowance');
      assert.equal(validateCompiledBundle(exact, { authorityProfile: exact.package.authorityProfile }), exact);
      const [expected, options] = trustedVerification(exact);
      assert.equal(verifyStoredBundleBytes(canonicalBytes(exact), expected, options).hashes.bundleHash, exact.hashes.bundleHash);

      const over = clone(exact);
      const sourceNode = over.canonicalHashInputs.source.files[0].source.nodes[0];
      sourceNode.metadata.summary += 'x';
      const qualified = `${over.package.id}::${sourceNode.id}`;
      over.ir.nodes.find((node) => node.id === qualified).metadata.summary += 'x';
      over.canonicalHashInputs.ir.nodes.find((node) => node.id === qualified).metadata.summary += 'x';
      rehashBundle(over);
      assert.equal(
        canonicalBytes(over.canonicalHashInputs.source.files[0].source).byteLength,
        PACKAGE_SOURCE_LIMIT + 1,
      );
      assert.throws(
        () => validateCompiledBundle(over, { authorityProfile: over.package.authorityProfile }),
        (error) => {
          assert.equal(error?.code, 'content_input_limit');
          assert.deepEqual(error.details, {
            limitKind: 'sourceBytes', expected: PACKAGE_SOURCE_LIMIT, actual: PACKAGE_SOURCE_LIMIT + 1,
          });
          return true;
        },
      );
      const [overExpected, overOptions] = trustedVerification(over);
      assert.throws(
        () => verifyStoredBundleBytes(canonicalBytes(over), overExpected, overOptions),
        (error) => {
          assert.equal(error?.code, 'content_input_limit');
          assert.deepEqual(error.details, {
            limitKind: 'sourceBytes', expected: PACKAGE_SOURCE_LIMIT, actual: PACKAGE_SOURCE_LIMIT + 1,
          });
          return true;
        },
      );

      const invalidAfterLimit = clone(over);
      const invalidSourceNode = invalidAfterLimit.canonicalHashInputs.source.files[0].source.nodes[0];
      const invalidQualifiedId = `${invalidAfterLimit.package.id}::${invalidSourceNode.id}`;
      invalidSourceNode.kind = 'unknown';
      invalidAfterLimit.ir.nodes.find((node) => node.id === invalidQualifiedId).kind = 'unknown';
      invalidAfterLimit.canonicalHashInputs.ir.nodes
        .find((node) => node.id === invalidQualifiedId).kind = 'unknown';
      rehashBundle(invalidAfterLimit);
      rejectsCode(
        () => validateCompiledBundle(invalidAfterLimit, {
          authorityProfile: invalidAfterLimit.package.authorityProfile,
        }),
        'content_input_limit',
      );
      const [invalidExpected, invalidOptions] = trustedVerification(invalidAfterLimit);
      rejectsCode(
        () => verifyStoredBundleBytes(canonicalBytes(invalidAfterLimit), invalidExpected, invalidOptions),
        'content_input_limit',
      );
    }
  });

  reviewCase('I4b canonical author source does not over-qualify local adapter definition IDs', () => {
    const longPrefix = 'omerta.phase2.adapter-source-limit.review.';
    const packageId = `${longPrefix}${'x'.repeat(90 - Buffer.byteLength(longPrefix, 'utf8'))}`;
    const sourceNodeMaterial = materialDefinition({ conservationClass: 'consumable' });
    // Hand-calibrated maximum whose per-node bounded metadata slots fit the 1 MiB source boundary.
    const sourceNodeCount = 3389;
    const sourceFromNodeCount = (count) => {
      const sourceNodeIds = Array.from({ length: count }, (_, index) => `node${String(index).padStart(4, '0')}`);
      const sourceNodes = sourceNodeIds.map((id) => ({
        id,
        kind: 'source',
        refs: ['material'],
        adapter: {
          kind: 'inventory_source',
          args: { definitionId: 'material', maxUnitsPerEpoch: 1, epoch: 'day' },
        },
      }));
      const edges = [
        { from: 'primary', to: sourceNodeIds[0], kind: 'requires' },
        { from: 'primary', to: 'use', kind: 'requires' },
        { from: sourceNodeIds[0], to: 'use', kind: 'requires' },
        { from: 'use', to: 'sink', kind: 'requires' },
        { from: 'use', to: 'material', kind: 'consumes', quantity: 1 },
        { from: 'material', to: 'sink', kind: 'sinks', quantity: 1 },
      ];
      for (let sourceIndex = 0; sourceIndex < count; sourceIndex += 1) {
        if (sourceIndex > 0) {
          edges.push({
            from: sourceNodeIds[sourceIndex - 1],
            to: sourceNodeIds[sourceIndex],
            kind: 'requires',
          });
        }
        edges.push({
          from: sourceNodeIds[sourceIndex],
          to: 'material',
          kind: 'produces',
          quantity: 1,
        });
      }
      return baseLibrary({
        packageId,
        kind: 'experience',
        definitions: [sourceNodeMaterial],
        entrypoint: 'primary',
        nodes: [
          { id: 'primary', kind: 'experience', refs: [] },
          {
            id: 'use', kind: 'use', refs: ['material'],
            adapter: { kind: 'inventory_consume', args: { definitionId: 'material', quantity: 1 } },
          },
          {
            id: 'sink', kind: 'sink', refs: ['material'],
            adapter: { kind: 'inventory_sink', args: { definitionId: 'material', quantity: 1 } },
          },
          ...sourceNodes,
        ],
        edges,
      });
    };
    const source = sourceFromNodeCount(sourceNodeCount);
    const boundarySource = padEmbeddedAuthoredSource(clone(compileOne(source)), PACKAGE_SOURCE_LIMIT);
    assert.equal(
      canonicalBytes(boundarySource.canonicalHashInputs.source.files[0].source).byteLength,
      PACKAGE_SOURCE_LIMIT,
    );
    assert.equal(
      boundarySource.canonicalHashInputs.source.files[0].source.nodes
        .filter((node) => node.kind === 'source').every((node) => node.adapter?.args?.definitionId === 'material'),
      true,
    );
    const [boundaryExpected, boundaryOptions] = trustedVerification(boundarySource);
    assert.equal(
      verifyStoredBundleBytes(canonicalBytes(boundarySource), boundaryExpected, boundaryOptions).hashes.bundleHash,
      boundarySource.hashes.bundleHash,
    );
    const over = clone(boundarySource);
    const overSourceNode = over.canonicalHashInputs.source.files[0].source.nodes
      .find((node) => node.kind === 'source');
    const overQualifiedNodeId = `${over.package.id}::${overSourceNode.id}`;
    const overSourceNodeSummary = (overSourceNode.metadata?.summary ?? '');
    overSourceNode.metadata = { ...(overSourceNode.metadata ?? {}), summary: `${overSourceNodeSummary}x` };
    over.ir.nodes.find((node) => node.id === overQualifiedNodeId).metadata = {
      ...(over.ir.nodes.find((node) => node.id === overQualifiedNodeId).metadata ?? {}),
      summary: `${over.ir.nodes.find((node) => node.id === overQualifiedNodeId).metadata?.summary ?? ''}x`,
    };
    over.canonicalHashInputs.ir.nodes
      .find((node) => node.id === overQualifiedNodeId).metadata = {
      ...(over.canonicalHashInputs.ir.nodes.find((node) => node.id === overQualifiedNodeId).metadata ?? {}),
      summary: `${over.canonicalHashInputs.ir.nodes.find((node) => node.id === overQualifiedNodeId).metadata?.summary ?? ''}x`,
    };
    rehashBundle(over);
    assert.equal(
      canonicalBytes(over.canonicalHashInputs.source.files[0].source).byteLength,
      PACKAGE_SOURCE_LIMIT + 1,
    );
    assert.throws(
      () => validateCompiledBundle(over, { authorityProfile: over.package.authorityProfile }),
      (error) => {
        assert.equal(error?.code, 'content_input_limit');
        assert.deepEqual(error.details, {
          limitKind: 'sourceBytes', expected: PACKAGE_SOURCE_LIMIT, actual: PACKAGE_SOURCE_LIMIT + 1,
        });
        return true;
      },
    );

    const importedSource = materialDefinition({ id: 'foreign', conservationClass: 'consumable' });
    const dependency = compileOne(baseLibrary({
      packageId: `${packageId}.dependency`,
      definitions: [importedSource],
      exports: ['foreign'],
    }));
    const imported = compileOne(baseLibrary({
      packageId: `${packageId}.imports`,
      definitions: [materialDefinition({ id: 'local-definition', conservationClass: 'consumable' })],
      dependencies: [{
        packageId: dependency.package.id,
        version: dependency.package.version,
        bundleHash: dependency.hashes.bundleHash,
      }],
      imports: [{
        id: `${dependency.package.id}::foreign`,
        definitionHash: dependency.hashes.definitionHashById[`${dependency.package.id}::foreign`],
        dependencyBundleHash: dependency.hashes.bundleHash,
      }],
      nodes: [
        {
          id: 'local', kind: 'source', refs: ['local-definition'],
          adapter: {
            kind: 'inventory_source',
            args: { definitionId: 'local-definition', maxUnitsPerEpoch: 1, epoch: 'day' },
          },
        },
        {
          id: 'imported',
          kind: 'source',
          refs: ['local', `${dependency.package.id}::foreign`],
          adapter: {
            kind: 'inventory_source',
            args: {
              definitionId: `${dependency.package.id}::foreign`,
              maxUnitsPerEpoch: 1,
              epoch: 'day',
            },
          },
        },
      ],
      edges: [
        { from: 'local', to: 'local-definition', kind: 'produces', quantity: 1 },
        { from: 'imported', to: `${dependency.package.id}::foreign`, kind: 'produces', quantity: 1 },
        { from: 'imported', to: 'local', kind: 'requires' },
      ],
    }), { dependencyCatalog: trustedCatalog(dependency) });
    const importedCanonical = imported.canonicalHashInputs.source.files[0].source;
    assert.equal(
      importedCanonical.nodes.find((entry) => entry.id === 'local').adapter?.args?.definitionId,
      'local-definition',
    );
    assert.equal(
      importedCanonical.nodes.find((entry) => entry.id === 'imported').adapter?.args?.definitionId,
      `${dependency.package.id}::foreign`,
    );
  });

  reviewCase('re-review R-I3 every effective-corpus aggregate accepts exact limit and rejects plus one', () => {
    assert.equal(typeof corpusModule.validateEffectiveCorpusBudget, 'function');
    const limits = economyProfile.PHASE2_LIMITS;
    const cases = [
      ['packages', 'maxPackages', 'effectivePackages'],
      ['canonicalInputBytes', 'maxCorpusBytes', 'effectiveCanonicalInputBytes'],
      ['canonicalOutputBytes', 'maxCatalogBytes', 'effectiveCanonicalOutputBytes'],
      ['nodes', 'maxCatalogNodes', 'effectiveNodes'],
      ['edges', 'maxCatalogEdges', 'effectiveEdges'],
      ['references', 'maxCatalogReferences', 'effectiveReferences'],
    ];
    for (const [field, limitField, limitKind] of cases) {
      const exact = {
        packages: 0,
        canonicalInputBytes: 0,
        canonicalOutputBytes: 0,
        nodes: 0,
        edges: 0,
        references: 0,
        [field]: limits[limitField],
      };
      assert.deepEqual(corpusModule.validateEffectiveCorpusBudget(exact), exact);
      rejectsCode(
        () => corpusModule.validateEffectiveCorpusBudget({
          ...exact,
          [field]: limits[limitField] + 1,
        }),
        'content_input_limit',
      );
      try {
        corpusModule.validateEffectiveCorpusBudget({ ...exact, [field]: limits[limitField] + 1 });
      } catch (error) {
        assert.equal(error.details.limitKind, limitKind);
      }
    }
    const combined = corpusModule.validateEffectiveCorpusBudget({
      packages: 3,
      canonicalInputBytes: 11,
      canonicalOutputBytes: 13,
      nodes: 17,
      edges: 19,
      references: 23,
    });
    assert.deepEqual(combined, {
      packages: 3,
      canonicalInputBytes: 11,
      canonicalOutputBytes: 13,
      nodes: 17,
      edges: 19,
      references: 23,
    });
  });

  reviewCase('re-review R-I3 catalog accounting stops on the first byte-budget crossing', () => {
    const large = compileOne(baseLibrary({
      packageId: 'omerta.phase2.catalog-budget.review',
      metadata: { summary: 'x'.repeat(60_000) },
    }));
    const record = trustedCatalog(large).bundles[0];
    const artifactBytes = canonicalBytes(record.bundle).byteLength;
    const crossing = Math.floor(economyProfile.PHASE2_LIMITS.maxCatalogBytes / artifactBytes) + 1;
    const recordCount = crossing + 7;
    assert(recordCount < economyProfile.PHASE2_LIMITS.maxCatalogBundles);
    const touched = new Set();
    const bundles = Array.from({ length: recordCount }, (_, index) => new Proxy(record, {
      get(target, property, receiver) {
        if (property === 'bundle') touched.add(index);
        return Reflect.get(target, property, receiver);
      },
    }));
    rejectsCode(() => compileContentCorpus({
      packages: [],
      compilerVersion: COMPILER_VERSION,
      dependencyCatalog: { bundles },
    }), 'content_input_limit');
    assert.equal(touched.size, crossing, 'catalog processing must stop at the first exceeded total');
  });

  reviewCase('I8/M2 build-corpus emits/reopens transitive bundles and conflicts have stable code', () => {
    const { aSource, bSource, cSource } = dependencySources();
    const root = temporaryRoot();
    writePackage(root, 'c', cSource);
    writePackage(root, 'b', bSource);
    writePackage(root, 'a', aSource);
    const output = path.join(temporaryRoot(), 'corpus-output');
    const build = spawnSync(process.execPath, ['tools/content.js', 'build-corpus', root, output], {
      cwd: ROOT, encoding: 'utf8',
    });
    assert.equal(build.status, 0, build.stderr);
    const summary = JSON.parse(build.stdout);
    assert.equal(summary.packageCount, 3);
    const index = JSON.parse(fs.readFileSync(path.join(output, 'corpus.index.json'), 'utf8'));
    assert.equal(index.bundles.length, 3);
    const bundleByHash = new Map(index.bundles.map((entry) => {
      const bundle = JSON.parse(fs.readFileSync(path.join(output, entry.file), 'utf8'));
      return [entry.bundleHash, bundle];
    }));
    for (const entry of index.bundles) {
      const bytes = fs.readFileSync(path.join(output, entry.file));
      const storedBundle = bundleByHash.get(entry.bundleHash);
      const catalogBundles = storedBundle.lock.dependencies.map((dependency) => (
        trustedCatalog(bundleByHash.get(dependency.bundleHash)).bundles[0]
      ));
      assert.equal(verifyStoredBundleBytes(bytes, {
        bundleHash: entry.bundleHash,
        dependencyLockHash: entry.dependencyLockHash,
      }, {
        authorityProfile: entry.authorityProfile,
        dependencyCatalog: { bundles: catalogBundles },
      }).hashes.bundleHash, entry.bundleHash);
    }
    const replay = spawnSync(process.execPath, ['tools/content.js', 'build-corpus', root, output], {
      cwd: ROOT, encoding: 'utf8',
    });
    assert.equal(replay.status, 0, replay.stderr);
    fs.appendFileSync(path.join(output, index.bundles[0].file), ' ');
    const conflict = spawnSync(process.execPath, ['tools/content.js', 'build-corpus', root, output], {
      cwd: ROOT, encoding: 'utf8',
    });
    assert.equal(conflict.status, 1);
    assert.equal(cliError(conflict)?.error, 'content_artifact_mismatch');
    assert(Buffer.byteLength(cliError(conflict).message, 'utf8') <= 4_096);
  });

  reviewCase('re-review M2 immutable corpus path types fail with one bounded stable code', () => {
    const sourceRoot = temporaryRoot();
    writePackage(sourceRoot, 'package', baseLibrary({
      packageId: 'omerta.phase2.artifact-type.review',
    }));
    const runBuild = (output) => spawnSync(
      process.execPath,
      ['tools/content.js', 'build-corpus', sourceRoot, output],
      { cwd: ROOT, encoding: 'utf8' },
    );
    const assertArtifactMismatch = (run, forbiddenPaths = []) => {
      assert.equal(run.status, 1);
      const error = cliError(run);
      assert.equal(error?.error, 'content_artifact_mismatch');
      assert(Buffer.byteLength(error.message, 'utf8') <= 4_096);
      for (const forbiddenPath of forbiddenPaths) {
        assert(!run.stderr.includes(path.resolve(forbiddenPath)), 'diagnostic disclosed an absolute path');
      }
    };

    for (const targetKind of ['bundle', 'index']) {
      const output = path.join(temporaryRoot(), `${targetKind}-output`);
      const first = runBuild(output);
      assert.equal(first.status, 0, first.stderr);
      const index = JSON.parse(fs.readFileSync(path.join(output, 'corpus.index.json'), 'utf8'));
      const targetName = targetKind === 'bundle' ? index.bundles[0].file : 'corpus.index.json';
      const targetPath = path.join(output, targetName);
      fs.rmSync(targetPath);
      fs.mkdirSync(targetPath);
      assertArtifactMismatch(runBuild(output), [output]);
    }

    const symlinkOutput = path.join(temporaryRoot(), 'symlink-output');
    const first = runBuild(symlinkOutput);
    assert.equal(first.status, 0, first.stderr);
    const index = JSON.parse(fs.readFileSync(path.join(symlinkOutput, 'corpus.index.json'), 'utf8'));
    const artifactPath = path.join(symlinkOutput, index.bundles[0].file);
    const preservedBytes = fs.readFileSync(artifactPath);
    const symlinkTarget = path.join(temporaryRoot(), 'symlink-target.bundle.json');
    fs.writeFileSync(symlinkTarget, preservedBytes);
    fs.rmSync(artifactPath);
    try {
      fs.symlinkSync(symlinkTarget, artifactPath, 'file');
      assertArtifactMismatch(runBuild(symlinkOutput), [symlinkOutput, symlinkTarget]);
    } catch (error) {
      if (!['EPERM', 'EACCES', 'ENOSYS'].includes(error?.code)) throw error;
    }

    const wrongTypeOutput = path.join(temporaryRoot(), 'not-a-directory');
    fs.writeFileSync(wrongTypeOutput, 'private output root name');
    assertArtifactMismatch(runBuild(wrongTypeOutput), [wrongTypeOutput]);

    for (const linkedRoot of [true, false]) {
      const container = temporaryRoot();
      const outside = temporaryRoot();
      const link = path.join(container, 'linked-output');
      try {
        fs.symlinkSync(outside, link, 'junction');
      } catch (error) {
        if (['EPERM', 'EACCES', 'ENOSYS'].includes(error?.code)) continue;
        throw error;
      }
      const output = linkedRoot ? link : path.join(link, 'nested-output');
      assertArtifactMismatch(runBuild(output), [container, outside, output]);
      assert.deepEqual(fs.readdirSync(outside), [], 'linked target must remain untouched');
    }
  });

  reviewCase('re-review R-M1 staged publication survives an injected interrupted write', () => {
    const output = path.join(temporaryRoot(), 'atomic-output');
    const script = `
      import fs from 'node:fs';
      import { publishImmutableCorpus } from './tools/content-artifacts.js';
      const outputPath = ${JSON.stringify(output)};
      const outputs = [
        { name: 'a.bundle.json', bytes: Buffer.from('bundle') },
        { name: 'corpus.index.json', bytes: Buffer.from('index') },
      ];
      let failed = false;
      try {
        publishImmutableCorpus({
          outputPath,
          outputs,
          hooks: {
            writeStage({ descriptor, bytes }) {
              fs.writeSync(descriptor, bytes.subarray(0, 2));
              throw new Error('injected mid-write interruption');
            },
          },
        });
      } catch (error) {
        failed = true;
      }
      if (!failed) throw new Error('injected interruption was not observed');
      if (fs.existsSync(outputPath + '/a.bundle.json')
          || fs.existsSync(outputPath + '/corpus.index.json')) {
        throw new Error('partial staged bytes became visible');
      }
      publishImmutableCorpus({ outputPath, outputs });
      const names = fs.readdirSync(outputPath).sort();
      if (JSON.stringify(names) !== JSON.stringify(['a.bundle.json', 'corpus.index.json'])) {
        throw new Error('retry left partial or staging files: ' + JSON.stringify(names));
      }
      if (fs.readFileSync(outputPath + '/a.bundle.json', 'utf8') !== 'bundle'
          || fs.readFileSync(outputPath + '/corpus.index.json', 'utf8') !== 'index') {
        throw new Error('retry did not publish complete exact bytes');
      }
    `;
    const run = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  });

  reviewCase('third-review economy reports prove lifecycle closure and block orphan or cyclic activation', () => {
    const orphan = compileOne(baseLibrary({
      packageId: 'omerta.phase2.lifecycle-orphan.review',
      definitions: [materialDefinition({ conservationClass: 'renewable' })],
    }));
    const orphanId = 'omerta.phase2.lifecycle-orphan.review::material';
    assert.deepEqual(orphan.reports.economy.orphans, [orphanId]);
    assert.deepEqual(orphan.reports.economy.errors, [
      { code: 'economy_orphan_definition', definitionId: orphanId },
      { code: 'economy_missing_source', definitionId: orphanId },
      { code: 'economy_missing_use', definitionId: orphanId },
      { code: 'economy_missing_sink', definitionId: orphanId },
    ]);
    assert.deepEqual(orphan.reports.economy.conservation, {
      analyzed: true,
      checkedDefinitions: 1,
      completeDefinitions: 0,
      positiveCycles: 0,
      positiveCycleWitnesses: [],
    });
    const [orphanExpected, orphanOptions] = trustedVerification(orphan);
    const reopenedOrphan = verifyStoredBundleBytes(
      canonicalBytes(orphan), orphanExpected, orphanOptions,
    );
    assert.deepEqual(reopenedOrphan.reports.economy, orphan.reports.economy);

    const orphanExperience = baseLibrary({
      packageId: 'omerta.phase2.lifecycle-orphan-experience.review',
      kind: 'experience',
      entrypoint: 'primary',
      definitions: [materialDefinition({ conservationClass: 'renewable' })],
      nodes: [{ id: 'primary', kind: 'experience', refs: [] }],
    });
    assert.throws(() => compileOne(orphanExperience), (error) => {
      assert.equal(error?.code, 'content_profile_invalid');
      assert.deepEqual(error?.details?.economyErrors, [
        'economy_orphan_definition',
        'economy_missing_source',
        'economy_missing_use',
        'economy_missing_sink',
      ]);
      return true;
    });
    const cliRoot = temporaryRoot();
    writePackage(cliRoot, 'orphan', orphanExperience);
    const cliOutput = path.join(temporaryRoot(), 'output');
    for (const command of ['check-corpus', 'build-corpus']) {
      const args = ['tools/content.js', command, cliRoot];
      if (command === 'build-corpus') args.push(cliOutput);
      const cli = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
      assert.equal(cli.status, 1);
      assert.equal(cliError(cli)?.error, 'content_profile_invalid');
    }
    assert.equal(fs.existsSync(path.join(cliOutput, 'corpus.index.json')), false);

    const lifecycleNodes = [
      {
        id: 'source', kind: 'source', refs: ['material'],
        adapter: { kind: 'inventory_source', args: {
          definitionId: 'material', maxUnitsPerEpoch: 2, epoch: 'day',
        } },
      },
      {
        id: 'use', kind: 'use', refs: ['material'],
        adapter: { kind: 'inventory_consume', args: { definitionId: 'material', quantity: 1 } },
      },
      {
        id: 'sink', kind: 'sink', refs: ['material'],
        adapter: { kind: 'inventory_sink', args: { definitionId: 'material', quantity: 1 } },
      },
    ];
    const lifecycleValueEdges = [
      { from: 'source', to: 'material', kind: 'produces', quantity: 1 },
      { from: 'use', to: 'material', kind: 'consumes', quantity: 1 },
      { from: 'material', to: 'sink', kind: 'sinks', quantity: 1 },
    ];
    const lifecyclePartials = [
      {
        packageId: 'omerta.phase2.lifecycle-missing-source.review',
        nodes: lifecycleNodes.filter((node) => node.id !== 'source'),
        edges: [
          ...lifecycleValueEdges.filter((edge) => edge.from !== 'source'),
          { from: 'use', to: 'sink', kind: 'requires' },
        ],
        error: 'economy_missing_source',
      },
      {
        packageId: 'omerta.phase2.lifecycle-missing-sink.review',
        nodes: lifecycleNodes.filter((node) => node.id !== 'sink'),
        edges: [
          ...lifecycleValueEdges.filter((edge) => edge.to !== 'sink'),
          { from: 'source', to: 'use', kind: 'requires' },
        ],
        error: 'economy_missing_sink',
      },
    ];
    for (const partial of lifecyclePartials) {
      const partialBundle = compileOne(baseLibrary({
        packageId: partial.packageId,
        definitions: [materialDefinition({ conservationClass: 'renewable' })],
        nodes: partial.nodes,
        edges: partial.edges,
      }));
      assert.deepEqual(partialBundle.reports.economy.errors, [{
        code: partial.error,
        definitionId: `${partial.packageId}::material`,
      }]);
    }
    const disconnected = compileOne(baseLibrary({
      packageId: 'omerta.phase2.lifecycle-disconnected.review',
      definitions: [materialDefinition({ conservationClass: 'renewable' })],
      nodes: lifecycleNodes,
      edges: lifecycleValueEdges,
    }));
    assert.deepEqual(disconnected.reports.economy.errors, [
      {
        code: 'economy_unreachable_use',
        definitionId: 'omerta.phase2.lifecycle-disconnected.review::material',
      },
      {
        code: 'economy_unreachable_sink',
        definitionId: 'omerta.phase2.lifecycle-disconnected.review::material',
      },
    ]);
    rejectsCode(() => compileOne(baseLibrary({
      packageId: 'omerta.phase2.lifecycle-disconnected-active.review',
      kind: 'experience',
      entrypoint: 'primary',
      definitions: [materialDefinition({ conservationClass: 'renewable' })],
      nodes: [{ id: 'primary', kind: 'experience', refs: [] }, ...lifecycleNodes],
      edges: lifecycleValueEdges,
    })), 'content_profile_invalid');

    const complete = compileOne(baseLibrary({
      packageId: 'omerta.phase2.lifecycle-complete.review',
      kind: 'experience',
      entrypoint: 'primary',
      definitions: [materialDefinition({ conservationClass: 'renewable' })],
      nodes: [
        { id: 'primary', kind: 'experience', refs: [] },
        ...lifecycleNodes,
      ],
      edges: [
        ...lifecycleValueEdges,
        { from: 'primary', to: 'source', kind: 'requires' },
        { from: 'source', to: 'use', kind: 'requires' },
        { from: 'use', to: 'sink', kind: 'requires' },
      ],
    }));
    assert.deepEqual(complete.reports.economy.errors, []);
    assert.deepEqual(complete.reports.economy.orphans, []);
    assert.deepEqual(complete.reports.economy.conservation, {
      analyzed: true,
      checkedDefinitions: 1,
      completeDefinitions: 1,
      positiveCycles: 0,
      positiveCycleWitnesses: [],
    });
    const [lifecycle] = complete.reports.economy.definitionLifecycle;
    assert.deepEqual({
      definitionId: lifecycle.definitionId,
      definitionKind: lifecycle.definitionKind,
      definitionKindName: lifecycle.definitionKindName,
      conservationClass: lifecycle.conservationClass,
      sources: lifecycle.sources,
      uses: lifecycle.uses,
      sinks: lifecycle.sinks,
      sourceToUse: lifecycle.sourceToUse,
      useToSink: lifecycle.useToSink,
      complete: lifecycle.complete,
    }, {
      definitionId: 'omerta.phase2.lifecycle-complete.review::material',
      definitionKind: 'material',
      definitionKindName: 'material',
      conservationClass: 'renewable',
      sources: ['omerta.phase2.lifecycle-complete.review::source'],
      uses: ['omerta.phase2.lifecycle-complete.review::use'],
      sinks: ['omerta.phase2.lifecycle-complete.review::sink'],
      sourceToUse: true,
      useToSink: true,
      complete: true,
    });
    assert.equal(lifecycle.sourceAuthorities[0].args.epoch, 'day');
    assert.equal(lifecycle.sourceAuthorities[0].args.maxUnitsPerEpoch, 2);
    assert.equal(lifecycle.sourceAuthorities[0].edgeQuantity, 1);
    assert.deepEqual(lifecycle.conservationEquation, {
      createdEdgeUnits: 1,
      consumedEdgeUnits: 1,
      destroyedEdgeUnits: 1,
      boundedDurableUses: 0,
    });
    assert.deepEqual(lifecycle.ownerScopes, ['account']);
    assert.deepEqual(lifecycle.tradePolicy, { mode: 'closed', transferable: false });
    assert.equal(lifecycle.qualityMode, 'none');
    const [completeExpected, completeOptions] = trustedVerification(complete);
    const reopenedComplete = verifyStoredBundleBytes(
      canonicalBytes(complete), completeExpected, completeOptions,
    );
    assert.deepEqual(reopenedComplete.reports.economy, complete.reports.economy);

    const zeroCostRecipe = baseLibrary({
      packageId: 'omerta.phase2.zero-cost-recipe.review',
      definitions: [materialDefinition({ conservationClass: 'renewable' })],
      nodes: [{
        id: 'recipe', kind: 'recipe', refs: ['material'],
        adapter: { kind: 'inventory_create', args: { definitionId: 'material', quantity: 1 } },
      }],
      edges: [
        { from: 'recipe', to: 'material', kind: 'produces', quantity: 1 },
        { from: 'material', to: 'recipe', kind: 'requires' },
      ],
    });
    rejectsCode(() => compileOne(zeroCostRecipe), 'content_schema_invalid');

    const cyclic = compileOne(baseLibrary({
      packageId: 'omerta.phase2.positive-cycle.review',
      definitions: [materialDefinition({ conservationClass: 'renewable' })],
      nodes: [{
        id: 'source', kind: 'source', refs: ['material'],
        adapter: { kind: 'inventory_source', args: {
          definitionId: 'material', maxUnitsPerEpoch: 1, epoch: 'day',
        } },
      }],
      edges: [
        { from: 'source', to: 'material', kind: 'produces', quantity: 1 },
        { from: 'source', to: 'source', kind: 'requires' },
      ],
    }));
    assert.equal(cyclic.reports.economy.conservation.positiveCycles, 1);
    assert.deepEqual(cyclic.reports.economy.conservation.positiveCycleWitnesses, [[
      'omerta.phase2.positive-cycle.review::source',
    ]]);
    assert(cyclic.reports.economy.errors.some((entry) => entry.code === 'economy_positive_cycle'));
    rejectsCode(() => compileOne(baseLibrary({
      packageId: 'omerta.phase2.positive-cycle-active.review',
      kind: 'experience',
      entrypoint: 'primary',
      definitions: [materialDefinition({ conservationClass: 'renewable' })],
      nodes: [
        { id: 'primary', kind: 'experience', refs: [] },
        {
          id: 'source', kind: 'source', refs: ['material'],
          adapter: { kind: 'inventory_source', args: {
            definitionId: 'material', maxUnitsPerEpoch: 1, epoch: 'day',
          } },
        },
      ],
      edges: [
        { from: 'source', to: 'material', kind: 'produces', quantity: 1 },
        { from: 'source', to: 'source', kind: 'requires' },
      ],
    })), 'content_profile_invalid');
  });

  reviewCase('final-review economy proof spans entrypoints, imports, issuance, and operational deltas', () => {
    const renewableDefinition = materialDefinition({ conservationClass: 'renewable' });
    const recurringNodes = [
      {
        id: 'source', kind: 'source', refs: ['material'],
        adapter: { kind: 'inventory_source', args: {
          definitionId: 'material', maxUnitsPerEpoch: 2, epoch: 'day',
        } },
      },
      {
        id: 'use', kind: 'use', refs: ['material'],
        adapter: { kind: 'inventory_consume', args: { definitionId: 'material', quantity: 1 } },
      },
      {
        id: 'sink', kind: 'sink', refs: ['material'],
        adapter: { kind: 'inventory_sink', args: { definitionId: 'material', quantity: 1 } },
      },
    ];
    const recurringValueEdges = [
      { from: 'source', to: 'material', kind: 'produces', quantity: 1 },
      { from: 'use', to: 'material', kind: 'consumes', quantity: 1 },
      { from: 'material', to: 'sink', kind: 'sinks', quantity: 1 },
    ];

    const disconnectedEntry = baseLibrary({
      packageId: 'omerta.phase2.entry-disconnected.final-review',
      kind: 'experience',
      entrypoint: 'primary',
      definitions: [renewableDefinition],
      nodes: [{ id: 'primary', kind: 'experience', refs: [] }, ...recurringNodes],
      edges: [
        ...recurringValueEdges,
        { from: 'source', to: 'use', kind: 'requires' },
        { from: 'use', to: 'sink', kind: 'requires' },
      ],
    });
    assert.throws(() => compileOne(disconnectedEntry), (error) => {
      assert.equal(error?.code, 'content_profile_invalid');
      assert(error?.details?.economyErrors.includes('economy_entry_unreachable'));
      return true;
    });

    const positiveOperationalCycle = baseLibrary({
      packageId: 'omerta.phase2.operational-positive.final-review',
      kind: 'experience',
      entrypoint: 'primary',
      definitions: [renewableDefinition],
      nodes: [
        { id: 'primary', kind: 'experience', refs: [] },
        {
          id: 'source', kind: 'source', refs: ['material'],
          adapter: { kind: 'inventory_source', args: {
            definitionId: 'material', maxUnitsPerEpoch: 2, epoch: 'day',
          } },
        },
        {
          id: 'use', kind: 'use', refs: ['material'],
          adapter: { kind: 'inventory_consume', args: { definitionId: 'material', quantity: 1 } },
        },
        {
          id: 'sink', kind: 'sink', refs: ['material'],
          adapter: { kind: 'inventory_sink', args: { definitionId: 'material', quantity: 1 } },
        },
      ],
      edges: [
        { from: 'primary', to: 'source', kind: 'requires' },
        { from: 'source', to: 'material', kind: 'produces', quantity: 2 },
        { from: 'use', to: 'material', kind: 'consumes', quantity: 1 },
        { from: 'material', to: 'sink', kind: 'sinks', quantity: 1 },
        { from: 'source', to: 'use', kind: 'requires' },
        { from: 'use', to: 'source', kind: 'requires' },
        { from: 'use', to: 'sink', kind: 'optional' },
      ],
    });
    assert.throws(() => compileOne(positiveOperationalCycle), (error) => {
      assert.equal(error?.code, 'content_profile_invalid');
      assert(error?.details?.economyErrors.includes('economy_positive_cycle'));
      return true;
    });

    const finiteRecurring = baseLibrary({
      packageId: 'omerta.phase2.finite-recurring.final-review',
      kind: 'experience',
      entrypoint: 'primary',
      definitions: [materialDefinition({ conservationClass: 'finite' })],
      nodes: [{ id: 'primary', kind: 'experience', refs: [] }, ...recurringNodes],
      edges: [
        ...recurringValueEdges,
        { from: 'primary', to: 'source', kind: 'requires' },
        { from: 'source', to: 'use', kind: 'requires' },
        { from: 'use', to: 'sink', kind: 'requires' },
      ],
    });
    assert.throws(() => compileOne(finiteRecurring), (error) => {
      assert.equal(error?.code, 'content_profile_invalid');
      assert(error?.details?.economyErrors.includes('economy_finite_recurring_source'));
      return true;
    });

    for (const conservationClass of ['finite', 'durable']) {
      const packageId = `omerta.phase2.${conservationClass}-bounded.final-review`;
      const bounded = compileOne(baseLibrary({
        packageId,
        kind: 'experience',
        entrypoint: 'primary',
        definitions: [materialDefinition({ conservationClass })],
        nodes: [
          { id: 'primary', kind: 'experience', refs: [] },
          {
            id: 'source', kind: 'source', refs: ['material'],
            adapter: { kind: 'inventory_create', args: { definitionId: 'material', quantity: 1 } },
          },
          {
            id: 'display', kind: 'use', refs: ['material'],
            adapter: { kind: 'inventory_durable_use', args: {
              definitionId: 'material', maximumConcurrentUses: 1,
            } },
          },
        ],
        edges: [
          { from: 'primary', to: 'source', kind: 'requires' },
          { from: 'source', to: 'material', kind: 'produces', quantity: 1 },
          { from: 'source', to: 'display', kind: 'requires' },
          { from: 'display', to: 'material', kind: 'requires' },
        ],
      }));
      assert.deepEqual(bounded.reports.economy.errors, []);
      const lifecycle = bounded.reports.economy.definitionLifecycle[0];
      assert.equal(lifecycle.entryReachable, true);
      assert.equal(lifecycle.sourceAuthorities[0].issuancePolicy, 'one_time_per_owner_scope');
      assert.equal(lifecycle.sourceAuthorities[0].sourceCapId, `${packageId}::source`);
      assert.equal(lifecycle.useAuthorities[0].usagePolicy, 'bounded_durable');
      assert.equal(lifecycle.useAuthorities[0].args.maximumConcurrentUses, 1);
      const [expected, options] = trustedVerification(bounded);
      assert.deepEqual(
        verifyStoredBundleBytes(canonicalBytes(bounded), expected, options).reports.economy,
        bounded.reports.economy,
      );
    }

    const definitionLibrarySource = baseLibrary({
      packageId: 'omerta.phase2.composable-import-source.spec-final',
      definitions: [materialDefinition({ conservationClass: 'renewable' })],
      exports: ['material'],
    });
    const definitionLibrary = compileOne(definitionLibrarySource);
    const importedDefinitionId = `${definitionLibrary.package.id}::material`;
    const importedDefinitionHash = definitionLibrary.hashes.definitionHashById[importedDefinitionId];
    const importedRootSource = ({
      dependency = definitionLibrary,
      definitionId = importedDefinitionId,
      definitionHash = importedDefinitionHash,
      kind = 'experience',
      packageId = 'omerta.phase2.composable-import-root.spec-final',
      sourceAdapter = 'inventory_source',
    } = {}) => baseLibrary({
      packageId,
      kind,
      ...(kind === 'experience' ? { entrypoint: 'primary' } : {}),
      dependencies: [{
        packageId: dependency.package.id,
        version: dependency.package.version,
        bundleHash: dependency.hashes.bundleHash,
      }],
      imports: [{
        id: definitionId,
        definitionHash,
        dependencyBundleHash: dependency.hashes.bundleHash,
      }],
      nodes: [
        ...(kind === 'experience' ? [{ id: 'primary', kind: 'experience', refs: [] }] : []),
        {
          id: 'source', kind: 'source', refs: [definitionId],
          adapter: sourceAdapter === 'inventory_source'
            ? { kind: sourceAdapter, args: {
              definitionId, maxUnitsPerEpoch: 1, epoch: 'day',
            } }
            : { kind: sourceAdapter, args: { definitionId, quantity: 1 } },
        },
        {
          id: 'use', kind: 'use', refs: [definitionId],
          adapter: { kind: 'inventory_consume', args: {
            definitionId, quantity: 1,
          } },
        },
        {
          id: 'sink', kind: 'sink', refs: [definitionId],
          adapter: { kind: 'inventory_sink', args: {
            definitionId, quantity: 1,
          } },
        },
      ],
      edges: [
        ...(kind === 'experience' ? [{ from: 'primary', to: 'source', kind: 'requires' }] : []),
        { from: 'source', to: definitionId, kind: 'produces', quantity: 1 },
        { from: 'use', to: definitionId, kind: 'consumes', quantity: 1 },
        { from: definitionId, to: 'sink', kind: 'sinks', quantity: 1 },
        { from: 'source', to: 'use', kind: 'requires' },
        { from: 'use', to: 'sink', kind: 'requires' },
      ],
    });
    const completeConsumer = compileOne(importedRootSource(), {
      dependencyCatalog: trustedCatalog(definitionLibrary),
    });
    assert.deepEqual(completeConsumer.reports.economy.errors, [],
      'a consumer-complete lifecycle must repair package-local definition-library gaps');
    assert.equal(completeConsumer.reports.economy.definitionLifecycle[0].complete, true);
    const [completeExpected, completeOptions] = trustedVerification(
      completeConsumer,
      trustedCatalog(definitionLibrary),
    );
    assert.deepEqual(
      verifyStoredBundleBytes(canonicalBytes(completeConsumer), completeExpected, completeOptions)
        .reports.economy,
      completeConsumer.reports.economy,
    );

    const invalidDependencySource = baseLibrary({
      packageId: 'omerta.phase2.intrinsic-invalid-import-source.spec-final',
      definitions: [materialDefinition({ conservationClass: 'finite' })],
      exports: ['material'],
      nodes: [{
        id: 'recurring-source', kind: 'source', refs: ['material'],
        adapter: { kind: 'inventory_source', args: {
          definitionId: 'material', maxUnitsPerEpoch: 1, epoch: 'day',
        } },
      }],
      edges: [{ from: 'recurring-source', to: 'material', kind: 'produces', quantity: 1 }],
    });
    const invalidDependency = compileOne(invalidDependencySource);
    const invalidDefinitionId = `${invalidDependency.package.id}::material`;
    const invalidDefinitionHash = invalidDependency.hashes.definitionHashById[invalidDefinitionId];
    const invalidConsumerSource = importedRootSource({
      dependency: invalidDependency,
      definitionId: invalidDefinitionId,
      definitionHash: invalidDefinitionHash,
      packageId: 'omerta.phase2.intrinsic-invalid-import-root.spec-final',
      sourceAdapter: 'inventory_create',
    });
    assert.throws(
      () => compileOne(invalidConsumerSource, { dependencyCatalog: trustedCatalog(invalidDependency) }),
      (error) => {
        assert.equal(error?.code, 'content_profile_invalid');
        assert(error?.details?.economyErrors.includes('economy_dependency_error'));
        return true;
      },
    );
    const importingLibrary = compileOne(importedRootSource({
      dependency: invalidDependency,
      definitionId: invalidDefinitionId,
      definitionHash: invalidDefinitionHash,
      kind: 'library',
      packageId: 'omerta.phase2.intrinsic-invalid-import-library-root.spec-final',
      sourceAdapter: 'inventory_create',
    }), { dependencyCatalog: trustedCatalog(invalidDependency) });
    assert(importingLibrary.reports.economy.errors.some((entry) => (
      entry.code === 'economy_dependency_error'
        && entry.definitionId === invalidDefinitionId
        && entry.dependencyBundleHash === invalidDependency.hashes.bundleHash
        && entry.dependencyErrorCode === 'economy_finite_recurring_source'
    )));
    const [importExpected, importOptions] = trustedVerification(
      importingLibrary,
      trustedCatalog(invalidDependency),
    );
    assert.deepEqual(
      verifyStoredBundleBytes(canonicalBytes(importingLibrary), importExpected, importOptions)
        .reports.economy,
      importingLibrary.reports.economy,
    );

    const positiveCliRoot = temporaryRoot();
    writePackage(positiveCliRoot, 'dependency', definitionLibrarySource);
    writePackage(positiveCliRoot, 'root', importedRootSource());
    const positiveCliOutput = path.join(temporaryRoot(), 'complete-import-output');
    for (const command of ['check-corpus', 'build-corpus']) {
      const args = ['tools/content.js', command, positiveCliRoot];
      if (command === 'build-corpus') args.push(positiveCliOutput);
      const run = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
      assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
    }
    assert(fs.existsSync(path.join(positiveCliOutput, 'corpus.index.json')));

    const cliRoot = temporaryRoot();
    writePackage(cliRoot, 'dependency', invalidDependencySource);
    writePackage(cliRoot, 'root', invalidConsumerSource);
    const cliOutput = path.join(temporaryRoot(), 'invalid-import-output');
    for (const command of ['check-corpus', 'build-corpus']) {
      const args = ['tools/content.js', command, cliRoot];
      if (command === 'build-corpus') args.push(cliOutput);
      const run = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
      assert.equal(run.status, 1);
      assert.equal(cliError(run)?.error, 'content_profile_invalid');
    }
    assert.equal(fs.existsSync(path.join(cliOutput, 'corpus.index.json')), false);
  });

  reviewCase('definitive-review profitable subcycles cannot hide behind an optional same-SCC sink', () => {
    const packageSource = ({
      kind = 'experience',
      packageId = 'omerta.phase2.optional-sink-subcycle.definitive-review',
      balanced = false,
    } = {}) => baseLibrary({
      packageId,
      kind,
      ...(kind === 'experience' ? { entrypoint: 'primary' } : {}),
      definitions: [materialDefinition({ conservationClass: 'renewable' })],
      nodes: [
        ...(kind === 'experience' ? [{ id: 'primary', kind: 'experience', refs: [] }] : []),
        {
          id: 'source', kind: 'source', refs: ['material'],
          adapter: { kind: 'inventory_source', args: {
            definitionId: 'material', maxUnitsPerEpoch: 2, epoch: 'day',
          } },
        },
        {
          id: 'use', kind: 'use', refs: ['material'],
          adapter: { kind: 'inventory_consume', args: { definitionId: 'material', quantity: 1 } },
        },
        {
          id: 'sink', kind: 'sink', refs: ['material'],
          adapter: { kind: 'inventory_sink', args: { definitionId: 'material', quantity: 1 } },
        },
      ],
      edges: [
        ...(kind === 'experience' ? [{ from: 'primary', to: 'source', kind: 'requires' }] : []),
        { from: 'source', to: 'material', kind: 'produces', quantity: 2 },
        { from: 'use', to: 'material', kind: 'consumes', quantity: 1 },
        { from: 'material', to: 'sink', kind: 'sinks', quantity: 1 },
        { from: 'source', to: 'use', kind: 'requires' },
        ...(balanced
          ? [
              { from: 'use', to: 'sink', kind: 'requires' },
              { from: 'sink', to: 'source', kind: 'requires' },
            ]
          : [
              { from: 'use', to: 'source', kind: 'requires' },
              { from: 'use', to: 'sink', kind: 'optional' },
              { from: 'sink', to: 'source', kind: 'optional' },
            ]),
      ],
    });

    assert.throws(() => compileOne(packageSource()), (error) => {
      assert.equal(error?.code, 'content_profile_invalid');
      assert(error?.details?.economyErrors.includes('economy_positive_cycle'));
      return true;
    });

    const library = compileOne(packageSource({
      kind: 'library',
      packageId: 'omerta.phase2.optional-sink-subcycle-library.definitive-review',
    }));
    assert.equal(library.reports.economy.conservation.positiveCycles, 1);
    const [cycle] = library.reports.economy.conversionCycles;
    assert.equal(cycle.modeledDeltas.quantity, 1);
    assert(cycle.witness.includes(`${library.package.id}::source`));
    assert(cycle.witness.includes(`${library.package.id}::use`));
    assert(!cycle.witness.includes(`${library.package.id}::sink`),
      'optional sink must not be charged to the profitable source/use subcycle');
    const [expected, options] = trustedVerification(library);
    assert.deepEqual(
      verifyStoredBundleBytes(canonicalBytes(library), expected, options).reports.economy,
      library.reports.economy,
    );

    const balanced = compileOne(packageSource({
      packageId: 'omerta.phase2.mandatory-balanced-cycle.definitive-review',
      balanced: true,
    }));
    assert.deepEqual(balanced.reports.economy.errors, []);
    assert.equal(balanced.reports.economy.conservation.positiveCycles, 0);

    const cliRoot = temporaryRoot();
    writePackage(cliRoot, 'package', packageSource());
    const cliOutput = path.join(temporaryRoot(), 'optional-sink-subcycle-output');
    for (const command of ['check-corpus', 'build-corpus']) {
      const args = ['tools/content.js', command, cliRoot];
      if (command === 'build-corpus') args.push(cliOutput);
      const run = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
      assert.equal(run.status, 1);
      assert.equal(cliError(run)?.error, 'content_profile_invalid');
    }
    assert.equal(fs.existsSync(path.join(cliOutput, 'corpus.index.json')), false);
  });

  reviewCase('third-review artifact publication rejects hard links and staged-file swaps', () => {
    const sourceRoot = temporaryRoot();
    writePackage(sourceRoot, 'package', baseLibrary({
      packageId: 'omerta.phase2.artifact-race.review',
    }));
    const runBuild = (output) => spawnSync(
      process.execPath,
      ['tools/content.js', 'build-corpus', sourceRoot, output],
      { cwd: ROOT, encoding: 'utf8' },
    );
    for (const targetKind of ['bundle', 'index']) {
      const output = path.join(temporaryRoot(), `${targetKind}-hardlink-output`);
      const first = runBuild(output);
      assert.equal(first.status, 0, first.stderr);
      const index = JSON.parse(fs.readFileSync(path.join(output, 'corpus.index.json'), 'utf8'));
      const targetName = targetKind === 'bundle' ? index.bundles[0].file : 'corpus.index.json';
      const targetPath = path.join(output, targetName);
      const outsideLink = path.join(temporaryRoot(), `${targetKind}.hardlink`);
      fs.linkSync(targetPath, outsideLink);
      const rejected = runBuild(output);
      assert.equal(rejected.status, 1);
      assert.equal(cliError(rejected)?.error, 'content_artifact_mismatch');
      assert(!rejected.stderr.includes(path.resolve(output)));
      assert(!rejected.stderr.includes(path.resolve(outsideLink)));
    }

    const raceOutput = path.join(temporaryRoot(), 'staging-race-output');
    const script = `
      import fs from 'node:fs';
      import { publishImmutableCorpus } from './tools/content-artifacts.js';
      const outputPath = ${JSON.stringify(raceOutput)};
      const outputs = [
        { name: 'a.bundle.json', bytes: Buffer.from('trusted-bundle') },
        { name: 'corpus.index.json', bytes: Buffer.from('trusted-index') },
      ];
      let observedStage;
      let swapSucceeded = false;
      let blockedByOpenHandle = false;
      let publicationError;
      try {
        publishImmutableCorpus({
          outputPath,
          outputs,
          hooks: {
            afterStage({ name, stagingName }) {
              if (name !== 'a.bundle.json') return;
              observedStage = stagingName;
              if (!/^\\.a\\.bundle\\.json\\.staging-[a-f0-9]{32}$/.test(stagingName)) {
                throw new Error('staging filename is predictable');
              }
              const target = outputPath + '/' + stagingName;
              try {
                fs.unlinkSync(target);
                fs.writeFileSync(target, 'forged-bundle');
                swapSucceeded = true;
              } catch (error) {
                if (!['EPERM', 'EACCES', 'EBUSY'].includes(error?.code)) throw error;
                blockedByOpenHandle = true;
              }
            },
          },
        });
      } catch (error) {
        publicationError = error;
      }
      if (!observedStage) throw new Error('publisher did not expose a stage to the attack hook');
      if (swapSucceeded) {
        if (publicationError?.code !== 'content_artifact_mismatch') {
          throw new Error('successful staged swap did not fail with stable mismatch');
        }
        if (fs.existsSync(outputPath + '/a.bundle.json')
            || fs.existsSync(outputPath + '/corpus.index.json')) {
          throw new Error('forged bytes or index became visible');
        }
        publishImmutableCorpus({ outputPath, outputs });
      } else {
        if (!blockedByOpenHandle || publicationError) {
          throw publicationError ?? new Error('staged swap was neither blocked nor detected');
        }
      }
      const names = fs.readdirSync(outputPath).sort();
      if (JSON.stringify(names) !== JSON.stringify(['a.bundle.json', 'corpus.index.json'])) {
        throw new Error('secure retry left staging debris: ' + JSON.stringify(names));
      }
      if (fs.readFileSync(outputPath + '/a.bundle.json', 'utf8') !== 'trusted-bundle'
          || fs.readFileSync(outputPath + '/corpus.index.json', 'utf8') !== 'trusted-index') {
        throw new Error('published bytes do not match their trusted inputs');
      }
    `;
    const race = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    assert.equal(race.status, 0, `${race.stdout}\n${race.stderr}`);

    const attackRoot = temporaryRoot();
    const attackScript = `
      import fs from 'node:fs';
      import path from 'node:path';
      import { publishImmutableCorpus } from './tools/content-artifacts.js';
      const root = ${JSON.stringify(attackRoot)};
      const outputs = [
        { name: 'a.bundle.json', bytes: Buffer.from('trusted-bundle') },
        { name: 'corpus.index.json', bytes: Buffer.from('trusted-index') },
      ];
      const expectMismatch = (outputPath, hooks) => {
        let error;
        try { publishImmutableCorpus({ outputPath, outputs, hooks }); }
        catch (caught) { error = caught; }
        if (error?.code !== 'content_artifact_mismatch') {
          throw error ?? new Error('artifact attack unexpectedly succeeded');
        }
        if (fs.existsSync(path.join(outputPath, 'corpus.index.json'))) {
          throw new Error('index became visible after an artifact attack');
        }
      };

      const shortOutput = path.join(root, 'short');
      expectMismatch(shortOutput, {
        writeStage({ descriptor, bytes }) { fs.writeSync(descriptor, bytes.subarray(0, 2)); },
      });
      publishImmutableCorpus({ outputPath: shortOutput, outputs });

      const linkedStageOutput = path.join(root, 'linked-stage');
      const sibling = path.join(root, 'stage-sibling');
      expectMismatch(linkedStageOutput, {
        afterStage({ name, stagingName }) {
          if (name === 'a.bundle.json') fs.linkSync(path.join(linkedStageOutput, stagingName), sibling);
        },
      });
      fs.unlinkSync(sibling);
      publishImmutableCorpus({ outputPath: linkedStageOutput, outputs });

      const destinationRaceOutput = path.join(root, 'destination-race');
      expectMismatch(destinationRaceOutput, {
        beforePublish({ name }) {
          if (name === 'a.bundle.json') {
            fs.writeFileSync(path.join(destinationRaceOutput, name), 'forged-destination');
          }
        },
      });
      if (fs.readFileSync(path.join(destinationRaceOutput, 'a.bundle.json'), 'utf8')
          !== 'forged-destination') {
        throw new Error('publisher removed an attacker-owned destination');
      }
      fs.unlinkSync(path.join(destinationRaceOutput, 'a.bundle.json'));
      publishImmutableCorpus({ outputPath: destinationRaceOutput, outputs });

      const sparseOutput = path.join(root, 'sparse');
      fs.mkdirSync(sparseOutput);
      const sparse = fs.openSync(path.join(sparseOutput, 'a.bundle.json'), 'wx');
      fs.ftruncateSync(sparse, 128 * 1024 * 1024);
      fs.closeSync(sparse);
      expectMismatch(sparseOutput);
      fs.unlinkSync(path.join(sparseOutput, 'a.bundle.json'));
      publishImmutableCorpus({ outputPath: sparseOutput, outputs });

      for (const outputPath of [shortOutput, linkedStageOutput, destinationRaceOutput, sparseOutput]) {
        const names = fs.readdirSync(outputPath).sort();
        if (JSON.stringify(names) !== JSON.stringify(['a.bundle.json', 'corpus.index.json'])) {
          throw new Error('secure retry left staging debris at ' + path.basename(outputPath));
        }
        if (fs.readFileSync(path.join(outputPath, 'a.bundle.json'), 'utf8') !== 'trusted-bundle') {
          throw new Error('secure retry published non-requested bytes');
        }
      }
    `;
    const attacks = spawnSync(process.execPath, ['--input-type=module', '--eval', attackScript], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    assert.equal(attacks.status, 0, `${attacks.stdout}\n${attacks.stderr}`);

    const collisionOutput = path.join(temporaryRoot(), 'collision-output');
    const collisionScript = `
      import { spawn } from 'node:child_process';
      import fs from 'node:fs';
      const outputPath = ${JSON.stringify(collisionOutput)};
      const worker = ${JSON.stringify(`
        import { publishImmutableCorpus } from './tools/content-artifacts.js';
        const outputPath = ${JSON.stringify(collisionOutput)};
        publishImmutableCorpus({ outputPath, outputs: [
          { name: 'a.bundle.json', bytes: Buffer.from('trusted-bundle') },
          { name: 'corpus.index.json', bytes: Buffer.from('trusted-index') },
        ] });
      `)};
      const run = () => new Promise((resolve) => {
        const child = spawn(process.execPath, ['--input-type=module', '--eval', worker], {
          cwd: ${JSON.stringify(ROOT)}, stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stderr = '';
        child.stderr.on('data', (chunk) => { stderr += chunk; });
        child.on('exit', (code) => resolve({ code, stderr }));
      });
      const results = await Promise.all([run(), run()]);
      if (!results.some((result) => result.code === 0)
          || results.some((result) => result.code !== 0 && !result.stderr.includes('content_artifact_mismatch'))) {
        throw new Error('concurrent publication had an unsafe outcome: ' + JSON.stringify(results));
      }
      if (fs.readFileSync(outputPath + '/a.bundle.json', 'utf8') !== 'trusted-bundle'
          || fs.readFileSync(outputPath + '/corpus.index.json', 'utf8') !== 'trusted-index') {
        throw new Error('concurrent publication changed requested bytes');
      }
      const names = fs.readdirSync(outputPath).sort();
      if (JSON.stringify(names) !== JSON.stringify(['a.bundle.json', 'corpus.index.json'])) {
        throw new Error('concurrent publication left staging debris: ' + JSON.stringify(names));
      }
    `;
    const collision = spawnSync(process.execPath, ['--input-type=module', '--eval', collisionScript], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    assert.equal(collision.status, 0, `${collision.stdout}\n${collision.stderr}`);
  });

  reviewCase('final-review post-verification link substitution is removed by exact inode and retries cleanly', () => {
    const output = path.join(temporaryRoot(), 'post-verify-link-race');
    const script = `
      import fs from 'node:fs';
      import path from 'node:path';
      import { publishImmutableCorpus } from './tools/content-artifacts.js';
      const outputPath = ${JSON.stringify(output)};
      const outputs = [
        { name: 'a.bundle.json', bytes: Buffer.from('trusted-bundle') },
        { name: 'corpus.index.json', bytes: Buffer.from('trusted-index') },
      ];
      let linkHookCalled = false;
      let error;
      try {
        publishImmutableCorpus({
          outputPath,
          outputs,
          hooks: {
            linkStage({ artifactPath }) {
              linkHookCalled = true;
              fs.writeFileSync(artifactPath, 'forged-after-final-verification');
            },
          },
        });
      } catch (caught) {
        error = caught;
      }
      if (!linkHookCalled) throw new Error('post-verification link seam was not exercised');
      if (error?.code !== 'content_artifact_mismatch') {
        throw error ?? new Error('post-verification substitution unexpectedly succeeded');
      }
      const remaining = fs.existsSync(outputPath) ? fs.readdirSync(outputPath).sort() : [];
      if (remaining.length !== 0) {
        throw new Error('failed publication left final/index/stage debris: ' + JSON.stringify(remaining));
      }
      publishImmutableCorpus({ outputPath, outputs });
      const names = fs.readdirSync(outputPath).sort();
      if (JSON.stringify(names) !== JSON.stringify(['a.bundle.json', 'corpus.index.json'])) {
        throw new Error('clean retry produced the wrong output set: ' + JSON.stringify(names));
      }
      if (fs.readFileSync(path.join(outputPath, 'a.bundle.json'), 'utf8') !== 'trusted-bundle'
          || fs.readFileSync(path.join(outputPath, 'corpus.index.json'), 'utf8') !== 'trusted-index') {
        throw new Error('clean retry did not publish exact requested bytes');
      }
    `;
    const run = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  });

  reviewCase('final-review publisher rejects count and byte budgets before cloning any view', () => {
    const output = path.join(temporaryRoot(), 'publisher-preclone-bounds');
    const script = `
      import { publishImmutableCorpus } from './tools/content-artifacts.js';
      const outputPath = ${JSON.stringify(output)};
      const expectPrecloneMismatch = (outputs, protectedViews = []) => {
        const originalFrom = Buffer.from;
        let cloned = false;
        Buffer.from = function guardedFrom(value, ...rest) {
          if (protectedViews.includes(value)) {
            cloned = true;
            throw new Error('oversized view was cloned before rejection');
          }
          return originalFrom.call(this, value, ...rest);
        };
        let error;
        try { publishImmutableCorpus({ outputPath, outputs }); }
        catch (caught) { error = caught; }
        finally { Buffer.from = originalFrom; }
        if (cloned) throw new Error('publisher cloned before enforcing its resource budget');
        if (error?.code !== 'content_artifact_mismatch') {
          throw error ?? new Error('publisher resource overflow unexpectedly succeeded');
        }
      };

      let countEntryRead = false;
      const tooMany = new Array(2_050);
      Object.defineProperty(tooMany, 0, {
        get() { countEntryRead = true; throw new Error('output count checked too late'); },
      });
      expectPrecloneMismatch(tooMany);
      if (countEntryRead) throw new Error('publisher inspected an output before rejecting its count');

      const oversized = new Uint8Array((64 * 1024 * 1024) + 1);
      expectPrecloneMismatch([{ name: 'too-large.bundle.json', bytes: oversized }], [oversized]);

      const aggregateA = new Uint8Array(33 * 1024 * 1024);
      const aggregateB = new Uint8Array(33 * 1024 * 1024);
      expectPrecloneMismatch([
        { name: 'a.bundle.json', bytes: aggregateA },
        { name: 'b.bundle.json', bytes: aggregateB },
      ], [aggregateA, aggregateB]);
    `;
    const run = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    });
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  });

  reviewCase('definitive-review publisher admission is accessor and resizable-view race safe', () => {
    const output = path.join(temporaryRoot(), 'publisher-resizable-admission');
    const script = `
      import fs from 'node:fs';
      import path from 'node:path';
      import { publishImmutableCorpus } from './tools/content-artifacts.js';
      const outputPath = ${JSON.stringify(output)};
      if (typeof ArrayBuffer.prototype.resize !== 'function') {
        throw new Error('ResizableArrayBuffer support is required by this regression');
      }
      const maximum = (64 * 1024 * 1024) + 1;
      const expectAccessorMismatch = (name, attack) => {
        const firstBuffer = new ArrayBuffer(1, { maxByteLength: maximum });
        const firstView = new Uint8Array(firstBuffer);
        firstView[0] = 7;
        let accessorCalled = false;
        let clonedFirst = false;
        const later = { name: 'later.bundle.json' };
        Object.defineProperty(later, 'bytes', {
          enumerable: true,
          get() {
            accessorCalled = true;
            attack(firstBuffer, firstView);
            return new Uint8Array([9]);
          },
        });
        const originalFrom = Buffer.from;
        Buffer.from = function guardedFrom(value, ...rest) {
          if (value === firstView) clonedFirst = true;
          return originalFrom.call(this, value, ...rest);
        };
        let error;
        try {
          publishImmutableCorpus({
            outputPath: path.join(outputPath, name),
            outputs: [
              { name: 'first.bundle.json', bytes: firstView },
              later,
              { name: 'corpus.index.json', bytes: new Uint8Array([1]) },
            ],
          });
        } catch (caught) {
          error = caught;
        } finally {
          Buffer.from = originalFrom;
        }
        if (error?.code !== 'content_artifact_mismatch') {
          throw error ?? new Error(name + ' accessor attack unexpectedly published');
        }
        if (accessorCalled || clonedFirst) {
          throw new Error(name + ' invoked hostile access or cloned an admitted mutable view');
        }
        if (fs.existsSync(path.join(outputPath, name))) {
          throw new Error(name + ' created filesystem state before safe admission');
        }
      };

      expectAccessorMismatch('resize', (buffer) => buffer.resize(maximum));
      expectAccessorMismatch('detach', (buffer) => structuredClone(buffer, { transfer: [buffer] }));
      expectAccessorMismatch('mutate', (_buffer, view) => { view[0] = 255; });
    `;
    const run = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    });
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  });

  reviewCase('definitive-review exact linked-stage crash residue completes without foreign deletion', () => {
    const lockCrashOutput = path.join(temporaryRoot(), 'lock-stage-crash-residue');
    const lockCrashScript = `
      import { publishImmutableCorpus } from './tools/content-artifacts.js';
      publishImmutableCorpus({
        outputPath: ${JSON.stringify(lockCrashOutput)},
        outputs: [
          { name: 'a.bundle.json', bytes: Buffer.from('trusted-bundle') },
          { name: 'corpus.index.json', bytes: Buffer.from('trusted-index') },
        ],
        hooks: { afterLockStageCreate() { process.exit(79); } },
      });
    `;
    const crashed = spawnSync(process.execPath, ['--input-type=module', '--eval', lockCrashScript], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    assert.equal(crashed.status, 79, `${crashed.stdout}\n${crashed.stderr}`);
    assert(!fs.existsSync(path.join(lockCrashOutput, 'a.bundle.json'))
      && !fs.existsSync(path.join(lockCrashOutput, 'corpus.index.json')),
    'a crash before lock publication must not expose an artifact or index');

    const output = path.join(temporaryRoot(), 'linked-stage-crash-residue');
    const script = `
      import fs from 'node:fs';
      import path from 'node:path';
      import { publishImmutableCorpus } from './tools/content-artifacts.js';
      const lockCrashOutput = ${JSON.stringify(lockCrashOutput)};
      const outputs = [
        { name: 'a.bundle.json', bytes: Buffer.from('trusted-bundle') },
        { name: 'corpus.index.json', bytes: Buffer.from('trusted-index') },
      ];
      publishImmutableCorpus({ outputPath: lockCrashOutput, outputs });
      const lockCrashNames = fs.readdirSync(lockCrashOutput).sort();
      if (JSON.stringify(lockCrashNames) !== JSON.stringify(['a.bundle.json', 'corpus.index.json'])) {
        throw new Error('lock crash retry left stage/lock debris: ' + JSON.stringify(lockCrashNames));
      }
      const outputPath = ${JSON.stringify(output)};
      fs.mkdirSync(outputPath);
      const finalPath = path.join(outputPath, 'a.bundle.json');
      const stagePath = path.join(outputPath, '.a.bundle.json.staging-' + 'a'.repeat(32));
      fs.writeFileSync(finalPath, 'trusted-bundle');
      fs.linkSync(finalPath, stagePath);
      const originalIdentity = fs.statSync(finalPath, { bigint: true });
      publishImmutableCorpus({ outputPath, outputs });
      publishImmutableCorpus({ outputPath, outputs });
      const finalIdentity = fs.statSync(finalPath, { bigint: true });
      if (originalIdentity.dev !== finalIdentity.dev || originalIdentity.ino !== finalIdentity.ino) {
        throw new Error('recovery replaced or deleted the verified final inode');
      }
      if (Number(finalIdentity.nlink) !== 1) {
        throw new Error('recovery did not reduce the exact verified link set');
      }
      const names = fs.readdirSync(outputPath).sort();
      if (JSON.stringify(names) !== JSON.stringify(['a.bundle.json', 'corpus.index.json'])) {
        throw new Error('crash recovery left stage/lock debris: ' + JSON.stringify(names));
      }
      if (fs.readFileSync(finalPath, 'utf8') !== 'trusted-bundle'
          || fs.readFileSync(path.join(outputPath, 'corpus.index.json'), 'utf8') !== 'trusted-index') {
        throw new Error('crash recovery changed the requested bytes');
      }
    `;
    const run = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  });

  reviewCase('definitive-review output names reject portable aliases and Windows-equivalent names before filesystem access', () => {
    const root = temporaryRoot();
    const script = `
      import fs from 'node:fs';
      import path from 'node:path';
      import { publishImmutableCorpus } from './tools/content-artifacts.js';
      const root = ${JSON.stringify(root)};
      const cases = [
        ['case-fold', ['A.bundle.json', 'a.bundle.json']],
        ['unicode-nfc', ['\u00e9.bundle.json', 'e\u0301.bundle.json']],
        ['trailing-dot', ['artifact.bundle.json.']],
        ['trailing-space', ['artifact.bundle.json ']],
        ['dos-device', ['CON.bundle.json']],
        ['dos-device-case', ['lPt9.archive']],
        ['alternate-data-stream', ['artifact.bundle.json:stream']],
      ];
      for (const [label, names] of cases) {
        const outputPath = path.join(root, label);
        let error;
        try {
          publishImmutableCorpus({ outputPath, outputs: [
            ...names.map((name, index) => ({ name, bytes: new Uint8Array([index + 1]) })),
            { name: 'corpus.index.json', bytes: new Uint8Array([3]) },
          ] });
        } catch (caught) {
          error = caught;
        }
        if (error?.code !== 'content_artifact_mismatch') {
          throw error ?? new Error(label + ' aliases unexpectedly published');
        }
        if (error.message.includes(path.resolve(outputPath))) {
          throw new Error(label + ' error disclosed the absolute output path');
        }
        if (fs.existsSync(outputPath)) {
          throw new Error(label + ' reached the filesystem before alias rejection');
        }
      }
    `;
    const run = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  });

  reviewCase('third-review real high-duplication roots reserve canonical output before graph work', () => {
    const duplicatedDefinitionSource = (index) => {
      const definitions = Array.from({ length: 15 }, (_, definitionIndex) => ({
        id: `definition-${definitionIndex}`,
        definitionVersion: 1,
        kind: 'concept',
        metadata: { summary: 'x'.repeat(60_000) },
      }));
      return baseLibrary({
        packageId: `omerta.phase2.output-bound-${String(index).padStart(2, '0')}`,
        definitions,
        exports: definitions.map((definition) => definition.id),
      });
    };

    const one = compileOne(duplicatedDefinitionSource(0));
    assert(canonicalBytes(one).byteLength > 5 * 1024 * 1024,
      'fixture must exercise repeated exported metadata, not a synthetic counter');

    const root = temporaryRoot();
    for (let index = 0; index < 13; index += 1) {
      writePackage(root, `package-${String(index).padStart(2, '0')}`, duplicatedDefinitionSource(index));
    }
    let overlayCalls = 0;
    assert.throws(() => compileRoot(root, {
      overlayProvider() {
        overlayCalls += 1;
        return undefined;
      },
    }), (error) => {
      assert.equal(error?.code, 'content_input_limit');
      assert.equal(error?.details?.limitKind, 'effectiveCanonicalOutputBytes');
      assert.equal(error?.details?.expected, 64 * 1024 * 1024);
      assert(error?.details?.actual > error?.details?.expected);
      return true;
    });
    assert.equal(overlayCalls, 0,
      'conservative output reservation must reject before overlay, graph, or bundle work');
  });

  reviewCase('definitive-review imported semantic snapshots are reserved before callbacks and build', () => {
    const definitions = Array.from({ length: 15 }, (_, index) => ({
      id: `definition-${index}`,
      definitionVersion: 1,
      kind: 'concept',
      metadata: { summary: 'i'.repeat(60_000) },
    }));
    const dependencySource = baseLibrary({
      packageId: 'omerta.phase2.import-reservation-dependency.definitive-review',
      definitions,
      exports: definitions.map((definition) => definition.id),
    });
    const dependency = compileOne(dependencySource);
    const dependencyBytes = canonicalBytes(dependency).byteLength;
    assert(dependencyBytes > 5 * 1024 * 1024 && dependencyBytes < 6 * 1024 * 1024,
      `dependency fixture must stay near the reviewed 5.42 MiB shape, got ${dependencyBytes}`);
    const importingSource = (index = 0) => baseLibrary({
      packageId: `omerta.phase2.import-reservation-root-${String(index).padStart(2, '0')}`,
      dependencies: [{
        packageId: dependency.package.id,
        version: dependency.package.version,
        bundleHash: dependency.hashes.bundleHash,
      }],
      imports: definitions.map((definition) => {
        const id = `${dependency.package.id}::${definition.id}`;
        return {
          id,
          definitionHash: dependency.hashes.definitionHashById[id],
          dependencyBundleHash: dependency.hashes.bundleHash,
        };
      }),
    });
    let overlayCalls = 0;
    const imported = compileOne(importingSource(), {
      dependencyCatalog: trustedCatalog(dependency),
      overlayProvider() {
        overlayCalls += 1;
        return undefined;
      },
    });
    assert.equal(overlayCalls, 1);
    assert(canonicalBytes(imported).byteLength > 1024 * 1024,
      'import fixture must materially amplify the tiny root source');
    const [expected, options] = trustedVerification(imported, trustedCatalog(dependency));
    assert.equal(
      verifyStoredBundleBytes(canonicalBytes(imported), expected, options).hashes.bundleHash,
      imported.hashes.bundleHash,
    );

    const crossingRoot = temporaryRoot();
    for (let index = 0; index < 12; index += 1) {
      writePackage(crossingRoot, `root-${String(index).padStart(2, '0')}`, importingSource(index));
    }
    let crossingOverlayCalls = 0;
    assert.throws(() => compileRoot(crossingRoot, {
      dependencyCatalog: trustedCatalog(dependency),
      overlayProvider() {
        crossingOverlayCalls += 1;
        return undefined;
      },
    }), (error) => {
      assert.equal(error?.code, 'content_input_limit');
      assert.equal(error?.details?.limitKind, 'effectiveCanonicalOutputBytes');
      return true;
    });
    assert.equal(crossingOverlayCalls, 0,
      'import amplification must cross the effective budget before overlay/build callbacks');

    const cliRoot = temporaryRoot();
    writePackage(cliRoot, 'dependency', dependencySource);
    writePackage(cliRoot, 'root', importingSource());
    const cliOutput = path.join(temporaryRoot(), 'import-reservation-output');
    const check = spawnSync(process.execPath, ['tools/content.js', 'check-corpus', cliRoot], {
      cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    });
    assert.equal(check.status, 0, check.stderr);
    const build = spawnSync(
      process.execPath,
      ['tools/content.js', 'build-corpus', cliRoot, cliOutput],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
    );
    assert.equal(build.status, 0, build.stderr);
    const index = JSON.parse(fs.readFileSync(path.join(cliOutput, 'corpus.index.json'), 'utf8'));
    assert.equal(index.bundles.length, 2);
    const rootEntry = index.bundles.find((entry) => entry.packageId === importingSource().packageId);
    const dependencyEntry = index.bundles.find((entry) => entry.packageId === dependency.package.id);
    const dependencyArtifact = JSON.parse(
      fs.readFileSync(path.join(cliOutput, dependencyEntry.file), 'utf8'),
    );
    const reopened = verifyStoredBundleBytes(
      fs.readFileSync(path.join(cliOutput, rootEntry.file)),
      { bundleHash: rootEntry.bundleHash, dependencyLockHash: rootEntry.dependencyLockHash },
      {
        authorityProfile: rootEntry.authorityProfile,
        dependencyCatalog: trustedCatalog(dependencyArtifact),
      },
    );
    assert.equal(reopened.hashes.bundleHash, rootEntry.bundleHash);
  });

  reviewCase('definitive-spec shared same-corpus imports reserve actual bounded semantics without artificial report ceilings', () => {
    const dependencySource = baseLibrary({
      packageId: 'omerta.phase2.shared-small-library.spec-final',
      definitions: [{ id: 'shared', definitionVersion: 1, kind: 'concept' }],
      exports: ['shared'],
    });
    const dependency = compileOne(dependencySource);
    const importedId = `${dependency.package.id}::shared`;
    const consumerSource = (index) => baseLibrary({
      packageId: `omerta.phase2.shared-small-consumer-${index}.spec-final`,
      dependencies: [{
        packageId: dependency.package.id,
        version: dependency.package.version,
        bundleHash: dependency.hashes.bundleHash,
      }],
      imports: [{
        id: importedId,
        definitionHash: dependency.hashes.definitionHashById[importedId],
        dependencyBundleHash: dependency.hashes.bundleHash,
      }],
    });
    const root = temporaryRoot();
    writePackage(root, 'dependency', dependencySource);
    for (let index = 0; index < 4; index += 1) {
      writePackage(root, `consumer-${index}`, consumerSource(index));
    }
    let overlayCalls = 0;
    const corpus = compileRoot(root, {
      overlayProvider() {
        overlayCalls += 1;
        return undefined;
      },
    });
    assert.equal(corpus.bundles.length, 5);
    assert.equal(overlayCalls, 5);
    assert(canonicalBytes(corpus.bundles).byteLength < 1024 * 1024,
      'small shared dependency corpus must remain far below the 64 MiB retained limit');

    const output = path.join(temporaryRoot(), 'shared-import-output');
    const check = spawnSync(process.execPath, ['tools/content.js', 'check-corpus', root], {
      cwd: ROOT, encoding: 'utf8',
    });
    const build = spawnSync(process.execPath, ['tools/content.js', 'build-corpus', root, output], {
      cwd: ROOT, encoding: 'utf8',
    });
    assert.equal(check.status, 0, `${check.stdout}\n${check.stderr}`);
    assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);
    const index = JSON.parse(fs.readFileSync(path.join(output, 'corpus.index.json'), 'utf8'));
    assert.equal(index.bundles.length, 5);
    const built = new Map(index.bundles.map((entry) => [entry.packageId, JSON.parse(
      fs.readFileSync(path.join(output, entry.file), 'utf8'),
    )]));
    for (const entry of index.bundles) {
      const storedBundle = built.get(entry.packageId);
      const catalog = trustedCatalog(...storedBundle.lock.dependencies.map((dependencyRecord) => (
        built.get(dependencyRecord.packageId)
      )));
      assert.equal(
        verifyStoredBundleBytes(
          fs.readFileSync(path.join(output, entry.file)),
          { bundleHash: entry.bundleHash, dependencyLockHash: entry.dependencyLockHash },
          { authorityProfile: entry.authorityProfile, dependencyCatalog: catalog },
        ).hashes.bundleHash,
        entry.bundleHash,
      );
    }
  });

  reviewCase('definitive-spec exact raw authored-byte limit succeeds and plus one stops before overlay work', () => {
    const exactSource = {
      packageId: 'omerta.phase2.raw-byte-boundary.spec-final',
      version: 1,
      kind: 'library',
      profile: 'phase2_economy',
      nodes: Array.from({ length: 18 }, (_, index) => ({
        id: `padding-${index}`,
        kind: 'step',
        metadata: { summary: '' },
      })),
    };
    let remaining = PACKAGE_SOURCE_LIMIT - Buffer.byteLength(JSON.stringify(exactSource), 'utf8');
    assert(remaining > 0);
    for (const node of exactSource.nodes) {
      const amount = Math.min(60_000, remaining);
      node.metadata.summary = 'x'.repeat(amount);
      remaining -= amount;
    }
    assert.equal(remaining, 0, 'padding fields must cover the exact raw-byte boundary');
    const exactRaw = JSON.stringify(exactSource);
    assert.equal(Buffer.byteLength(exactRaw, 'utf8'), PACKAGE_SOURCE_LIMIT);

    const exactRoot = temporaryRoot();
    writePackage(exactRoot, 'package', exactRaw);
    let exactOverlayCalls = 0;
    const exact = compileRoot(exactRoot, {
      overlayProvider() {
        exactOverlayCalls += 1;
        return undefined;
      },
    }).bundles[0];
    assert.equal(exactOverlayCalls, 1);
    assert(canonicalBytes(exact.canonicalHashInputs.source).byteLength > PACKAGE_SOURCE_LIMIT,
      'compiler-owned canonical envelope must be accounted separately from raw authored bytes');
    const [expected, options] = trustedVerification(exact);
    assert.equal(
      verifyStoredBundleBytes(canonicalBytes(exact), expected, options).hashes.bundleHash,
      exact.hashes.bundleHash,
    );

    const overRoot = temporaryRoot();
    writePackage(overRoot, 'package', `${exactRaw} `);
    let overOverlayCalls = 0;
    assert.throws(() => compileRoot(overRoot, {
      overlayProvider() {
        overOverlayCalls += 1;
        return undefined;
      },
    }), (error) => {
      assert.equal(error?.code, 'content_manifest_byte_limit');
      return true;
    });
    assert.equal(overOverlayCalls, 0);
  });

  reviewCase('definitive-spec public manifests bind safe dependency import and export identities', () => {
    const dependencySource = (suffix, definitionVersion) => baseLibrary({
      packageId: `omerta.phase2.public-dependency-${suffix}.spec-final`,
      definitions: [{
        id: 'definition',
        definitionVersion,
        kind: 'concept',
        metadata: { title: `Public definition ${suffix}` },
      }],
      exports: ['definition'],
    });
    const dependencyA = compileOne(dependencySource('a', 7));
    const dependencyB = compileOne(dependencySource('b', 3));
    const dependencies = [dependencyB, dependencyA];
    const imports = dependencies.map((dependency) => {
      const id = `${dependency.package.id}::definition`;
      return {
        id,
        definitionHash: dependency.hashes.definitionHashById[id],
        dependencyBundleHash: dependency.hashes.bundleHash,
      };
    });
    const rootSource = baseLibrary({
      packageId: 'omerta.phase2.public-import-root.spec-final',
      dependencies: dependencies.map((dependency) => ({
        packageId: dependency.package.id,
        version: dependency.package.version,
        bundleHash: dependency.hashes.bundleHash,
      })),
      imports,
    });
    const corpus = compileContentCorpus({
      packages: (() => {
        const root = temporaryRoot();
        writePackage(root, 'package', rootSource);
        return discovered(root);
      })(),
      compilerVersion: COMPILER_VERSION,
      dependencyCatalog: trustedCatalog(dependencyA, dependencyB),
    });
    const rootBundle = corpus.bundles[0];
    const manifest = rootBundle.publicManifest;
    assert.deepEqual(manifest.dependencies, [...rootBundle.lock.directDependencies]);
    assert.deepEqual(manifest.imports.map((entry) => entry.id), [
      `${dependencyA.package.id}::definition`,
      `${dependencyB.package.id}::definition`,
    ]);
    for (const imported of manifest.imports) {
      const dependency = imported.ownerPackageId === dependencyA.package.id
        ? dependencyA : dependencyB;
      assert.deepEqual(imported, {
        id: `${dependency.package.id}::definition`,
        kind: 'concept',
        definitionVersion: dependency === dependencyA ? 7 : 3,
        definitionHash: dependency.hashes.definitionHashById[`${dependency.package.id}::definition`],
        ownerPackageId: dependency.package.id,
        ownerPackageVersion: dependency.package.version,
        dependencyBundleHash: dependency.hashes.bundleHash,
      });
    }
    const exported = dependencyA.publicManifest.exportedDefinitions[0];
    assert.deepEqual(exported, {
      id: `${dependencyA.package.id}::definition`,
      kind: 'concept',
      definitionVersion: 7,
      definitionHash: dependencyA.hashes.definitionHashById[`${dependencyA.package.id}::definition`],
      ownerPackageId: dependencyA.package.id,
      ownerPackageVersion: dependencyA.package.version,
      profile: dependencyA.package.profile,
    });
    assert.deepEqual(
      dependencyA.publicManifest.nodes.find((node) => node.id === exported.id),
      { ...exported, ordinal: 0, metadata: { title: 'Public definition a' } },
    );
    assert(corpus.lock.packages.every((entry) => (
      typeof entry.publicManifestHash === 'string' && entry.publicManifestHash.length === 64
    )), 'corpus attestation must bind each non-self-referential manifest to its exact bundle');
    const serializedManifest = JSON.stringify(manifest);
    for (const forbidden of [
      'secretOverlay', 'secretOverlayHash', 'manifestPath', 'operator', 'server', 'timestamp',
    ]) assert(!serializedManifest.includes(forbidden), `public manifest leaked ${forbidden}`);

    const [expected, options] = trustedVerification(
      rootBundle,
      trustedCatalog(dependencyA, dependencyB),
    );
    assert.equal(
      verifyStoredBundleBytes(canonicalBytes(rootBundle), expected, options)
        .hashes.publicManifestHash,
      rootBundle.hashes.publicManifestHash,
    );
    const tampered = clone(rootBundle);
    tampered.canonicalHashInputs.publicManifest.imports[0].definitionHash = '0'.repeat(64);
    tampered.publicManifest = {
      ...clone(tampered.canonicalHashInputs.publicManifest),
      publicManifestHash: '',
    };
    rehashBundle(tampered);
    rejectsCode(
      () => validateCompiledBundle(tampered, { authorityProfile: 'production' }),
      'content_hash_mismatch',
    );

    const buildRoot = temporaryRoot();
    writePackage(buildRoot, 'dependency-a', dependencySource('a', 7));
    writePackage(buildRoot, 'dependency-b', dependencySource('b', 3));
    writePackage(buildRoot, 'root', rootSource);
    const output = path.join(temporaryRoot(), 'public-manifest-output');
    const check = spawnSync(process.execPath, ['tools/content.js', 'check-corpus', buildRoot], {
      cwd: ROOT, encoding: 'utf8',
    });
    const build = spawnSync(process.execPath, ['tools/content.js', 'build-corpus', buildRoot, output], {
      cwd: ROOT, encoding: 'utf8',
    });
    assert.equal(check.status, 0, `${check.stdout}\n${check.stderr}`);
    assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);
    const index = JSON.parse(fs.readFileSync(path.join(output, 'corpus.index.json'), 'utf8'));
    for (const entry of index.bundles) {
      const directBundle = [rootBundle, dependencyA, dependencyB]
        .find((bundle) => bundle.package.id === entry.packageId);
      assert.equal(entry.bundleHash, directBundle.hashes.bundleHash);
      assert.equal(entry.publicManifestHash, directBundle.hashes.publicManifestHash);
    }
  });

  reviewCase('final-review public node ordinals are dense and independent of omitted private topology', () => {
    const packageId = 'omerta.phase2.public-ordinal-privacy.final';
    const publicNodes = [
      { id: 'z-public', kind: 'step', public: true, metadata: { title: 'Public z' } },
      { id: 'zz-public', kind: 'step', public: true, metadata: { title: 'Public zz' } },
    ];
    const privateNodes = [
      { id: 'a-hidden', kind: 'step', metadata: { title: 'Private a' } },
      { id: 'm-hidden', kind: 'step', metadata: { title: 'Private m' } },
    ];
    const withoutPrivate = compileOne(baseLibrary({ packageId, nodes: publicNodes }));
    const withPrivate = compileOne(baseLibrary({
      packageId,
      nodes: [privateNodes[1], ...publicNodes, privateNodes[0]],
    }));
    const reorderedPrivate = compileOne(baseLibrary({
      packageId,
      nodes: [privateNodes[0], publicNodes[1], privateNodes[1], publicNodes[0]],
    }));
    const expectedProjection = [
      {
        id: `${packageId}::z-public`, ordinal: 0, kind: 'step',
        metadata: { title: 'Public z' },
      },
      {
        id: `${packageId}::zz-public`, ordinal: 1, kind: 'step',
        metadata: { title: 'Public zz' },
      },
    ];
    assert.deepEqual(withoutPrivate.publicManifest.nodes, expectedProjection);
    assert.deepEqual(withPrivate.publicManifest.nodes, expectedProjection);
    assert.deepEqual(reorderedPrivate.publicManifest.nodes, expectedProjection);
    assert.equal(withPrivate.ir.nodes.find((node) => node.id.endsWith('::z-public')).ordinal, 2,
      'the sealed IR must retain its private bundle-local ordinal');
    assert.equal(withPrivate.hashes.publicManifestHash, withoutPrivate.hashes.publicManifestHash);
    assert.equal(reorderedPrivate.hashes.publicManifestHash, withoutPrivate.hashes.publicManifestHash);
    assert.notEqual(withPrivate.hashes.sourceHash, withoutPrivate.hashes.sourceHash);
    assert.notEqual(withPrivate.hashes.irHash, withoutPrivate.hashes.irHash);
    assert.notEqual(withPrivate.hashes.bundleHash, withoutPrivate.hashes.bundleHash);

    for (const bundle of [withoutPrivate, withPrivate, reorderedPrivate]) {
      assert.equal(
        validateCompiledBundle(bundle, { authorityProfile: 'production' }),
        bundle,
      );
      const [expected, options] = trustedVerification(bundle);
      assert.equal(
        verifyStoredBundleBytes(canonicalBytes(bundle), expected, options)
          .hashes.publicManifestHash,
        withoutPrivate.hashes.publicManifestHash,
      );
    }

    const leakedOrdinal = clone(withPrivate);
    for (const projected of leakedOrdinal.canonicalHashInputs.publicManifest.nodes) {
      projected.ordinal = leakedOrdinal.ir.nodes.find((node) => node.id === projected.id).ordinal;
    }
    leakedOrdinal.publicManifest = {
      ...clone(leakedOrdinal.canonicalHashInputs.publicManifest),
      publicManifestHash: '',
    };
    rehashBundle(leakedOrdinal);
    rejectsCode(
      () => validateCompiledBundle(leakedOrdinal, { authorityProfile: 'production' }),
      'content_hash_mismatch',
    );
    const [leakedExpected, leakedOptions] = trustedVerification(leakedOrdinal);
    rejectsCode(
      () => verifyStoredBundleBytes(canonicalBytes(leakedOrdinal), leakedExpected, leakedOptions),
      'content_hash_mismatch',
    );
  });

  reviewCase('third-review lock identity commits to complete used adapter capabilities', () => {
    const bundle = compileOne(baseLibrary({
      packageId: 'omerta.phase2.capability-commitment.review',
      definitions: [materialDefinition()],
      nodes: [{
        id: 'source', kind: 'source', refs: ['material'],
        adapter: { kind: 'inventory_source', args: {
          definitionId: 'material', maxUnitsPerEpoch: 2, epoch: 'day',
        } },
      }],
      edges: [{ from: 'source', to: 'material', kind: 'produces', quantity: 1 }],
    }));
    const capability = bundle.lock.adapterRegistry.adapters[0];
    assert.deepEqual(Object.keys(capability).sort(), [
      'adapterVersion', 'args', 'authorityProfiles', 'cash', 'kind', 'lockClasses',
      'nodeKinds', 'profiles', 'replayPolicy', 'reportClass', 'transactionClass',
      'issuancePolicy', 'sourceCapIdentity', 'usagePolicy', 'valueClass',
      'visibilityPolicy',
    ].sort());
    assert.deepEqual(capability, {
      kind: 'inventory_source',
      adapterVersion: 1,
      profiles: ['phase2_economy'],
      authorityProfiles: ['fixture', 'production'],
      nodeKinds: ['source'],
      transactionClass: 'inventory_write',
      lockClasses: ['content_inventory'],
      replayPolicy: 'idempotency_key',
      visibilityPolicy: 'server_projection',
      valueClass: 'create',
      reportClass: 'source',
      issuancePolicy: 'periodic_per_owner_scope',
      sourceCapIdentity: 'bundle_node_owner_scope_epoch',
      usagePolicy: 'none',
      args: {
        definitionId: { type: 'definitionId' },
        epoch: { type: 'enum', values: ['day', 'season', 'week'] },
        maxUnitsPerEpoch: { type: 'positiveInteger', maximum: SERVER_VALUE_LIMIT },
      },
      cash: null,
    });
    assert.equal(
      crypto.createHash('sha256').update(canonicalBytes(bundle.lock.adapterRegistry)).digest('hex'),
      'b2c7a2706ed8fdba5be621125cc09049b657226f7c22e282fac9a96acb52db8d',
      'used registry capability commitment changed without an intentional golden update',
    );
    const completeRegistryLock = economyProfile.economyAdapterRegistryLock(
      Object.keys(ECONOMY_ADAPTER_REGISTRY).map((kind) => ({ adapter: { kind } })),
    );
    assert.equal(
      crypto.createHash('sha256').update(canonicalBytes(completeRegistryLock)).digest('hex'),
      '452b7b618ae8325ddd39e7c155dc61f8b2dc0ac69f1c6168f19ca27d785f3bbe',
      'registry version 1 full capability set changed without an intentional golden update',
    );

    const semanticMutations = [
      (entry) => { entry.profiles = ['phase3_mystery']; },
      (entry) => { entry.authorityProfiles = ['fixture']; },
      (entry) => { entry.nodeKinds = ['recipe']; },
      (entry) => { entry.transactionClass = 'none'; },
      (entry) => { entry.lockClasses = ['character_ledger']; },
      (entry) => { entry.replayPolicy = 'none'; },
      (entry) => { entry.visibilityPolicy = 'private_projection'; },
      (entry) => { entry.valueClass = 'destroy'; },
      (entry) => { entry.reportClass = 'sink'; },
      (entry) => { entry.issuancePolicy = 'one_time_per_owner_scope'; },
      (entry) => { entry.sourceCapIdentity = 'bundle_node_owner_scope'; },
      (entry) => { entry.usagePolicy = 'consuming'; },
      (entry) => { entry.args.maxUnitsPerEpoch.maximum -= 1; },
      (entry) => { entry.cash = 'transfer'; },
    ];
    for (const mutate of semanticMutations) {
      const semanticDrift = clone(bundle);
      mutate(semanticDrift.lock.adapterRegistry.adapters[0]);
      mutate(semanticDrift.ir.adapterRegistry.adapters[0]);
      semanticDrift.canonicalHashInputs.dependencyLock = clone(semanticDrift.lock);
      semanticDrift.canonicalHashInputs.ir = clone(semanticDrift.ir);
      rehashBundle(semanticDrift);
      assert.notEqual(semanticDrift.hashes.dependencyLockHash, bundle.hashes.dependencyLockHash);
      assert.notEqual(semanticDrift.hashes.irHash, bundle.hashes.irHash);
      assert.notEqual(semanticDrift.hashes.bundleHash, bundle.hashes.bundleHash);
      rejectsCode(
        () => validateCompiledBundle(semanticDrift, { authorityProfile: 'production' }),
        'content_artifact_mismatch',
      );
    }

    for (const mutate of [
      (descriptor) => { descriptor.lockClasses = ['character_ledger']; },
      (descriptor) => { descriptor.replayPolicy = 'none'; },
      (descriptor) => { descriptor.visibilityPolicy = 'declared'; },
    ]) {
      const registry = clone(ECONOMY_ADAPTER_REGISTRY);
      mutate(registry.inventory_source);
      rejectsCode(() => economyProfile.validateEconomyAdapterRegistry(registry), 'content_schema_invalid');
    }
  });

  reviewCase('M1 canonical ordering rejects lone surrogates and diagnostics are UTF-8-byte bounded', () => {
    assert.throws(() => canonicalBytes('\ud800'));
    assert.throws(() => canonicalBytes({ '\ud800': 1, '\ud801': 2 }));
    assert.throws(() => compareCanonicalText('\ud800', '\ud801'));
    const composedA = { 'é': 1, 'é': 2 };
    const composedB = { 'é': 2, 'é': 1 };
    assert.deepEqual(canonicalBytes(composedA), canonicalBytes(composedB));
    assert.notEqual(canonicalBytes('é').toString(), canonicalBytes('é').toString());

    assert.equal(Buffer.byteLength(safeDiagnostic('a'.repeat(4_096)), 'utf8'), 4_096);
    assert.equal(Buffer.byteLength(safeDiagnostic('a'.repeat(4_097)), 'utf8'), 4_096);
    for (const character of ['é', '€', '💣']) {
      assert(Buffer.byteLength(safeDiagnostic(character.repeat(4_096)), 'utf8') <= 4_096);
    }
    assert.equal(safeDiagnostic('\u202e'), '\\u202e');

    const diagnostic = new ContentCompileError(
      'content_schema_invalid',
      'compile',
      `${'💣'.repeat(2_000)}\u202e`,
      { path: `$.${'💣'.repeat(1_000)}\u202e` },
    );
    assert(Buffer.byteLength(diagnostic.message, 'utf8') <= 4_096);
    assert(Buffer.byteLength(diagnostic.path, 'utf8') <= 512);
    assert.equal(diagnostic.message.split(/\r?\n/u).length, 1);
    assert(!diagnostic.message.includes('\u202e'));

    const cliRoot = temporaryRoot();
    writePackage(cliRoot, 'bad', JSON.stringify(baseLibrary({ ['💣'.repeat(2_000)]: true })));
    const run = spawnSync(process.execPath, ['tools/content.js', 'check-corpus', cliRoot], {
      cwd: ROOT, encoding: 'utf8',
    });
    assert.equal(run.status, 1);
    assert.equal(run.stderr.trim().split(/\r?\n/u).length, 1);
    assert(Buffer.byteLength(cliError(run).message, 'utf8') <= 4_096);
  });

  reviewCase('M3 stored and catalog verification require trusted authority and exact identity', () => {
    const bundle = compileOne(baseLibrary({ packageId: 'omerta.phase2.trust.review' }));
    const bytes = canonicalBytes(bundle);
    assert.throws(() => verifyStoredBundleBytes(bytes), /expected.*bundle|trusted.*identity/i);
    assert.throws(() => verifyStoredBundleBytes(bytes, {
      bundleHash: bundle.hashes.bundleHash,
      dependencyLockHash: bundle.hashes.dependencyLockHash,
    }), /authority/i);
    assert.throws(() => sealedBundleBytes(bundle), /authority/i);
    const [expected, options] = trustedVerification(bundle);
    assert.equal(verifyStoredBundleBytes(bytes, expected, options).hashes.bundleHash, bundle.hashes.bundleHash);
    assert.equal(
      sealedBundleBytes(bundle, { authorityProfile: 'production' }).toString(),
      bytes.toString(),
    );
    const root = temporaryRoot();
    writePackage(root, 'root', baseLibrary({ packageId: 'omerta.phase2.untrusted-catalog.review' }));
    rejectsCode(() => compileRoot(root, { dependencyCatalog: { bundles: [bundle] } }), 'content_profile_invalid');
  });
} finally {
  for (const root of temporaryRoots) {
    const resolved = path.resolve(root);
    assert(resolved.startsWith(path.resolve(os.tmpdir())), `refusing to remove non-temporary path ${resolved}`);
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

if (failures.length > 0) {
  throw new AggregateError(
    failures,
    `Task 2 review regressions failed (${failures.length}/${reviewCaseCount}; ${reviewCaseCount} groups executed)`,
  );
}

console.log(`phase2 review regressions passed (${reviewCaseCount}/${reviewCaseCount} groups)`);
