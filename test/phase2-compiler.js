// PHASE 2A CANONICAL COMPILER — framed identities, closed data, exact locks, and one validator.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalBytes, frame, hashFrame } from '../src/content/canonical.js';
import {
  ContentCompileError,
  compileContentCorpus,
  validateCompiledBundle,
  verifyStoredBundleBytes,
} from '../src/content/corpus.js';
import { discoverContentPackages } from '../src/content/discovery.js';
import { parseAuthoredJson } from '../src/content/json-source.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = path.join(ROOT, 'test', 'fixtures', 'phase2', 'compiler');
const COMPILER_VERSION = 'phase2a.1';
const temporaryRoots = [];

function temporaryRoot(prefix = 'omerta-phase2-compiler-') {
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

function discovered(root, options = {}) {
  return discoverContentPackages({ rootDir: root, ...options });
}

function compileRoot(root, options = {}) {
  return compileContentCorpus({
    packages: discovered(root, options.discovery),
    compilerVersion: COMPILER_VERSION,
    dependencyCatalog: options.dependencyCatalog ?? { bundles: [] },
    overlayProvider: options.overlayProvider,
  });
}

function errorCode(run) {
  const line = run.stderr.trim().split('\t').at(-1);
  try { return JSON.parse(line).error; }
  catch { return null; }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function baseLibrary(overrides = {}) {
  return {
    packageId: 'omerta.phase2.test',
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

function compileOne(source, options = {}) {
  const root = temporaryRoot();
  writePackage(root, 'package', source);
  return compileRoot(root, options).bundles[0];
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

function rejectsCode(run, code) {
  assert.throws(run, (error) => {
    assert(error instanceof ContentCompileError || typeof error?.code === 'string');
    assert.equal(error.code, code, error.stack);
    assert.equal(String(error.message).split(/\r?\n/).length, 1);
    assert(String(error.message).length <= 4_096);
    return true;
  });
}

function assertCompilerBoundaryParity(source, expectedCode) {
  const root = temporaryRoot();
  writePackage(root, 'bad', source);
  assert.throws(() => compileRoot(root), (error) => error?.code === expectedCode);
  for (const command of ['check-corpus', 'build-corpus']) {
    const args = ['tools/content.js', command, root];
    if (command === 'build-corpus') args.push(path.join(root, 'out.bundle'));
    const run = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
    assert.equal(run.status, 1, `${run.stdout}\n${run.stderr}`);
    assert.equal(errorCode(run), expectedCode, run.stderr);
  }
}

try {
  assert.equal(canonicalBytes({ z: 1, a: ['x', true, null] }).toString(), '{"a":["x",true,null],"z":1}');
  assert.deepEqual(canonicalBytes({ a: 1, b: 2 }), canonicalBytes({ b: 2, a: 1 }));
  assert.notDeepEqual(canonicalBytes([1, 2]), canonicalBytes([2, 1]));
  assert.equal(canonicalBytes({ bomb: '💣' }).byteLength, Buffer.byteLength('{"bomb":"💣"}'));
  assert.equal(
    frame('omerta:definition:v1', [['value', 'é']]).toString('hex'),
    '4f4d4552544100000000146f6d657274613a646566696e6974696f6e3a7631000000010000000576616c7565040000000000000002c3a9',
  );
  const visual = '1';
  const typedHashes = [visual, Buffer.from(visual), 1, [visual], { value: visual }, null]
    .map((value) => hashFrame('omerta:source:v1', [['value', value]]));
  assert.equal(new Set(typedHashes).size, typedHashes.length);
  assert.match(typedHashes[0], /^[a-f0-9]{64}$/);
  for (const invalid of [1.5, -0, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1,
    undefined, 1n, Symbol('x'), () => {}, new Date(), new Uint8Array([1])]) {
    assert.throws(() => canonicalBytes(invalid));
  }
  const cyclic = {}; cyclic.self = cyclic;
  assert.throws(() => canonicalBytes(cyclic), /cyclic/);
  const accessor = {};
  Object.defineProperty(accessor, 'value', { enumerable: true, get() { throw new Error('must not run'); } });
  assert.throws(() => canonicalBytes(accessor), /data property/);
  assert.throws(() => frame('omerta:not-a-domain:v1', []), /domain/);
  console.log('✓ canonical bytes and seven-domain typed frames are deterministic and collision-resistant');

  const coreRoot = temporaryRoot();
  fs.cpSync(path.join(FIXTURES, 'valid-core'), path.join(coreRoot, 'core'), { recursive: true });
  const coreResult = compileRoot(coreRoot);
  assert.deepEqual(Object.keys(coreResult), ['bundles', 'publicManifests', 'lock', 'reports', 'knowledgeManifest']);
  const core = coreResult.bundles[0];
  const qualified = 'omerta.phase2.core::mat.ferrous-scrap';
  const coreDefinitionHash = core.hashes.definitionHashById[qualified];
  assert.match(coreDefinitionHash, /^[a-f0-9]{64}$/);
  assert.equal(core.ir.nodes.find((node) => node.id === qualified).ordinal, 0);
  assert.equal(validateCompiledBundle(core, { authorityProfile: 'production' }), core);
  assert.equal(Object.hasOwn(core.canonicalHashInputs.definitionById[qualified], 'definitionHash'), false);
  assert.equal(Object.hasOwn(core.canonicalHashInputs.source, 'sourceHash'), false);
  assert.equal(Object.hasOwn(core.canonicalHashInputs.secretOverlay, 'secretOverlayHash'), false);
  assert.equal(Object.hasOwn(core.canonicalHashInputs.dependencyLock, 'dependencyLockHash'), false);
  assert.equal(Object.hasOwn(core.canonicalHashInputs.ir, 'irHash'), false);
  assert.equal(Object.hasOwn(core.canonicalHashInputs.bundle, 'bundleHash'), false);
  assert.equal(Object.hasOwn(core.canonicalHashInputs.publicManifest, 'publicManifestHash'), false);
  for (const domain of ['definition', 'source', 'secretOverlay', 'dependencyLock', 'ir', 'bundle', 'publicManifest']) {
    assert.match(core.hashDomains[domain], /^omerta:[a-z-]+:v1$/);
  }
  assert.equal(new Set(Object.values(core.hashDomains)).size, 7);
  assert(!JSON.stringify(core.publicManifest).includes('secretOverlay'));
  assert(!JSON.stringify(core.publicManifest).includes(core.manifestPath ?? '__no_path__'));
  console.log('✓ package-local identities qualify, ordinals stabilize, and every hash excludes itself');

  const reorderedSource = parseAuthoredJson(fs.readFileSync(path.join(FIXTURES, 'valid-core', 'pack.json')));
  reorderedSource.definitions.reverse();
  reorderedSource.nodes.reverse();
  reorderedSource.edges.reverse();
  reorderedSource.exports.reverse();
  const reordered = compileOne({
    imports: reorderedSource.imports,
    dependencies: reorderedSource.dependencies,
    exports: reorderedSource.exports,
    edges: reorderedSource.edges,
    nodes: reorderedSource.nodes,
    definitions: reorderedSource.definitions,
    metadata: { title: reorderedSource.metadata.title },
    profile: reorderedSource.profile,
    kind: reorderedSource.kind,
    version: reorderedSource.version,
    packageId: reorderedSource.packageId,
  });
  assert.deepEqual(reordered.hashes, core.hashes);
  assert.deepEqual(reordered.ir, core.ir);

  const changedSource = clone(reorderedSource);
  changedSource.definitions[0].metadata.title = 'Changed semantic title';
  const changed = compileOne(changedSource);
  assert.notEqual(changed.hashes.definitionHashById[qualified], coreDefinitionHash);
  assert.notEqual(changed.hashes.irHash, core.hashes.irHash);
  assert.notEqual(changed.hashes.bundleHash, core.hashes.bundleHash);
  console.log('✓ author ordering is invariant and semantic definition changes propagate without hash recursion');

  const consumer = baseLibrary({
    packageId: 'omerta.phase2.consumer',
    kind: 'experience',
    entrypoint: 'experience.start',
    nodes: [
      { id: 'experience.start', kind: 'experience', refs: [qualified], adapter: { kind: 'observe', args: {} }, public: true },
      { id: 'experience.end', kind: 'terminal', refs: [], public: true },
    ],
    edges: [{ from: 'experience.start', to: 'experience.end', kind: 'requires' }],
    dependencies: [{ packageId: 'omerta.phase2.core', version: 1, bundleHash: core.hashes.bundleHash }],
    imports: [{ id: qualified, definitionHash: coreDefinitionHash, dependencyBundleHash: core.hashes.bundleHash }],
  });
  const consumerBundle = compileOne(consumer, { dependencyCatalog: trustedCatalog(core) });
  assert.deepEqual(consumerBundle.lock.imports, [{
    id: qualified,
    definitionHash: coreDefinitionHash,
    dependencyBundleHash: core.hashes.bundleHash,
  }]);
  assert(consumerBundle.ir.imports.some((entry) => entry.id === qualified));
  assert(!JSON.stringify(consumerBundle.ir).includes('latest'));
  {
    const importHashTamper = clone(consumerBundle);
    importHashTamper.lock.imports[0].definitionHash = '0'.repeat(64);
    rejectsCode(
      () => validateCompiledBundle(importHashTamper, { authorityProfile: 'production' }),
      'content_artifact_mismatch',
    );
  }

  const changedCoreSource = parseAuthoredJson(fs.readFileSync(path.join(FIXTURES, 'valid-core', 'pack.json')));
  changedCoreSource.definitions[0].metadata.title = 'Ferrous scrap revision';
  const changedCore = compileOne(changedCoreSource);
  const changedCoreDefinitionHash = changedCore.hashes.definitionHashById[qualified];
  const changedConsumer = compileOne({
    ...consumer,
    dependencies: [{
      packageId: 'omerta.phase2.core', version: 1, bundleHash: changedCore.hashes.bundleHash,
    }],
    imports: [{
      id: qualified,
      definitionHash: changedCoreDefinitionHash,
      dependencyBundleHash: changedCore.hashes.bundleHash,
    }],
  }, { dependencyCatalog: trustedCatalog(changedCore) });
  assert.notEqual(changedConsumer.hashes.dependencyLockHash, consumerBundle.hashes.dependencyLockHash);
  assert.notEqual(changedConsumer.hashes.irHash, consumerBundle.hashes.irHash);
  assert.notEqual(changedConsumer.hashes.bundleHash, consumerBundle.hashes.bundleHash);
  console.log('✓ imports resolve only through exact offline definition and dependency bundle hashes');

  rejectsCode(() => compileOne(baseLibrary({ definitions: [
    { id: 'same', definitionVersion: 1, kind: 'concept' },
    { id: 'same', definitionVersion: 1, kind: 'concept' },
  ] })), 'content_identity_conflict');
  rejectsCode(() => compileOne({ ...consumer, dependencies: [], imports: consumer.imports }), 'content_dependency_unresolved');
  rejectsCode(() => compileOne({ ...consumer, imports: [{ ...consumer.imports[0], definitionHash: '0'.repeat(64) }] }, {
    dependencyCatalog: trustedCatalog(core),
  }), 'content_dependency_drift');
  rejectsCode(() => compileOne({ ...consumer, dependencies: [{ packageId: 'omerta.phase2.core', version: 1 }], imports: [] }), 'content_dependency_unresolved');
  rejectsCode(() => compileOne({ ...consumer, imports: [consumer.imports[0], consumer.imports[0]] }, {
    dependencyCatalog: trustedCatalog(core),
  }), 'content_dependency_unresolved');

  {
    const root = temporaryRoot();
    const exact = 'a'.repeat(64);
    writePackage(root, 'a', baseLibrary({
      packageId: 'omerta.phase2.cycle.a',
      dependencies: [{ packageId: 'omerta.phase2.cycle.b', version: 1, bundleHash: exact }],
    }));
    writePackage(root, 'b', baseLibrary({
      packageId: 'omerta.phase2.cycle.b',
      dependencies: [{ packageId: 'omerta.phase2.cycle.a', version: 1, bundleHash: exact }],
    }));
    rejectsCode(() => compileRoot(root), 'content_dependency_cycle');
  }
  {
    const root = temporaryRoot();
    const exact = 'b'.repeat(64);
    for (let index = 0; index < 129; index += 1) {
      writePackage(root, `p${String(index).padStart(3, '0')}`, baseLibrary({
        packageId: `omerta.phase2.longcycle${index}`,
        dependencies: [{
          packageId: `omerta.phase2.longcycle${(index + 1) % 129}`,
          version: 1,
          bundleHash: exact,
        }],
      }));
    }
    assert.throws(() => compileRoot(root), (error) => {
      assert.equal(error?.code, 'content_dependency_cycle');
      assert.equal(error.details.witness.length, 128);
      assert.equal(error.details.total, 129);
      assert.equal(error.details.truncated, true);
      assert(String(error.message).length <= 4_096);
      return true;
    });
  }
  console.log('✓ duplicate identities, floating/drifted imports, and package cycles fail with stable codes');

  const tamperCases = [
    ['profile', (bundle) => { bundle.package.profile = 'legacy_runtime'; }],
    ['authority', (bundle) => { bundle.package.authorityProfile = 'fixture'; }],
    ['authored kind', (bundle) => { bundle.package.authoredKind = 'experience'; }],
    ['source summary', (bundle) => { bundle.sourceSummary.bytes += 1; }],
    ['unknown hash field', (bundle) => { bundle.hashes.operatorTimestamp = '2026-09-04'; }],
    ['definition preimage index', (bundle) => {
      delete bundle.canonicalHashInputs.definitionById[qualified];
      delete bundle.hashes.definitionHashById[qualified];
    }],
    ['ordinal', (bundle) => { bundle.ir.nodes[0].ordinal = 99; bundle.canonicalHashInputs.ir.nodes[0].ordinal = 99; }],
    ['IR', (bundle) => { bundle.ir.nodes[0].kind = 'unknown'; bundle.canonicalHashInputs.ir.nodes[0].kind = 'unknown'; }],
    ['report', (bundle) => { bundle.reports.validation.counts.nodes += 1; }],
    ['public-private', (bundle) => { bundle.publicManifest.secretOverlayHash = '0'.repeat(64); }],
    ...['sourceHash', 'secretOverlayHash', 'dependencyLockHash', 'irHash', 'bundleHash', 'publicManifestHash']
      .map((hash) => [`hash ${hash}`, (bundle) => { bundle.hashes[hash] = '0'.repeat(64); }]),
  ];
  for (const [name, mutate] of tamperCases) {
    const candidate = clone(core);
    mutate(candidate);
    assert.throws(
      () => validateCompiledBundle(candidate, { authorityProfile: 'production' }),
      (error) => ['content_hash_mismatch', 'content_artifact_mismatch', 'content_profile_invalid', 'content_input_limit', 'unsupported_content_feature']
        .includes(error?.code),
      name,
    );
  }
  {
    const sourceIrDrift = clone(core);
    sourceIrDrift.canonicalHashInputs.source.files[0].source.nodes.unshift({
      id: 'phantom', kind: 'step', refs: [], public: false,
    });
    sourceIrDrift.sourceSummary.bytes = canonicalBytes(sourceIrDrift.canonicalHashInputs.source).byteLength;
    sourceIrDrift.hashes.sourceHash = hashFrame('omerta:source:v1', [
      ['canonicalPublicAuthoredInputs', sourceIrDrift.canonicalHashInputs.source],
    ]);
    sourceIrDrift.lock.root.sourceHash = sourceIrDrift.hashes.sourceHash;
    sourceIrDrift.canonicalHashInputs.dependencyLock.root.sourceHash = sourceIrDrift.hashes.sourceHash;
    sourceIrDrift.hashes.dependencyLockHash = hashFrame('omerta:dependency-lock:v1', [
      ['canonicalResolvedDependencyClosure', sourceIrDrift.canonicalHashInputs.dependencyLock],
    ]);
    sourceIrDrift.canonicalHashInputs.bundle.sourceHash = sourceIrDrift.hashes.sourceHash;
    sourceIrDrift.canonicalHashInputs.bundle.dependencyLockHash = sourceIrDrift.hashes.dependencyLockHash;
    sourceIrDrift.hashes.bundleHash = hashFrame('omerta:bundle:v1', [
      ['formatVersion', sourceIrDrift.canonicalHashInputs.bundle.formatVersion],
      ['compilerVersion', sourceIrDrift.canonicalHashInputs.bundle.compilerVersion],
      ['profile', sourceIrDrift.canonicalHashInputs.bundle.profile],
      ['packageId', sourceIrDrift.canonicalHashInputs.bundle.packageId],
      ['packageVersion', sourceIrDrift.canonicalHashInputs.bundle.packageVersion],
      ['sourceHash', sourceIrDrift.canonicalHashInputs.bundle.sourceHash],
      ['secretOverlayHash', sourceIrDrift.canonicalHashInputs.bundle.secretOverlayHash],
      ['dependencyLockHash', sourceIrDrift.canonicalHashInputs.bundle.dependencyLockHash],
      ['irHash', sourceIrDrift.canonicalHashInputs.bundle.irHash],
    ]);
    rejectsCode(
      () => validateCompiledBundle(sourceIrDrift, { authorityProfile: 'production' }),
      'content_artifact_mismatch',
    );
  }
  {
    const omrTamper = clone(core);
    omrTamper.ir.nodes[0].semantic.currency = 'OMR';
    omrTamper.canonicalHashInputs.ir.nodes[0].semantic.currency = 'OMR';
    rejectsCode(() => validateCompiledBundle(omrTamper, { authorityProfile: 'production' }), 'content_omr_forbidden');
    const adapterTamper = clone(core);
    const graphNode = adapterTamper.ir.nodes.find((node) => node.nodeClass === 'graph');
    graphNode.adapter = { kind: 'runtime_import', args: { modulePath: './payload.js' } };
    adapterTamper.canonicalHashInputs.ir.nodes.find((node) => node.id === graphNode.id).adapter = graphNode.adapter;
    rejectsCode(() => validateCompiledBundle(adapterTamper, { authorityProfile: 'production' }), 'content_schema_invalid');
  }
  const storedBytes = canonicalBytes(core);
  const [coreExpectedHashes, coreVerificationOptions] = trustedVerification(core);
  assert.equal(
    verifyStoredBundleBytes(storedBytes, coreExpectedHashes, coreVerificationOptions).hashes.bundleHash,
    core.hashes.bundleHash,
  );
  rejectsCode(
    () => verifyStoredBundleBytes(
      Buffer.concat([Buffer.from(' '), storedBytes]),
      coreExpectedHashes,
      coreVerificationOptions,
    ),
    'content_artifact_mismatch',
  );
  rejectsCode(
    () => verifyStoredBundleBytes(storedBytes, {
      ...coreExpectedHashes,
      bundleHash: '0'.repeat(64),
    }, coreVerificationOptions),
    'content_hash_mismatch',
  );
  console.log('✓ direct and stored-byte validation independently reject tampering and noncanonical artifacts');

  {
    const absentOverlay = compileOne(baseLibrary({ packageId: 'omerta.phase2.overlay' }));
    const emptyOverlay = compileOne(baseLibrary({ packageId: 'omerta.phase2.overlay' }), {
      overlayProvider: () => Buffer.alloc(0),
    });
    assert.notEqual(absentOverlay.hashes.secretOverlayHash, emptyOverlay.hashes.secretOverlayHash);
    assert.notEqual(absentOverlay.hashes.bundleHash, emptyOverlay.hashes.bundleHash);

    const dependencySource = baseLibrary({ packageId: 'z.phase2.overlay-dependency' });
    const dependencyBundle = compileOne(dependencySource);
    const root = temporaryRoot();
    writePackage(root, 'z-dependency', dependencySource);
    writePackage(root, 'a-consumer', baseLibrary({
      packageId: 'a.phase2.overlay-consumer',
      dependencies: [{
        packageId: dependencyBundle.package.id,
        version: dependencyBundle.package.version,
        bundleHash: dependencyBundle.hashes.bundleHash,
      }],
    }));
    const calls = [];
    compileRoot(root, { overlayProvider: ({ packageId }) => { calls.push(packageId); } });
    assert.deepEqual(calls, ['a.phase2.overlay-consumer', 'z.phase2.overlay-dependency']);
  }
  console.log('✓ overlays are snapshotted in canonical package order and absent/empty bytes are distinct');

  const executableFields = [
    ['javascript', 'function () { return 1; }'],
    ['typescript', 'const x: number = 1'],
    ['functionText', 'return 1'],
    ['sql', 'SELECT * FROM accounts'],
    ['databaseTable', 'accounts'],
    ['shell', 'rm -rf /tmp/example'],
    ['bytecode', '0061736d'],
    ['wasm', 'AGFzbQ=='],
    ['modulePath', './runtime.js'],
    ['dynamicImport', 'import("./runtime.js")'],
    ['url', 'https://example.invalid/data'],
    ['runtimeImport', 'node:fs'],
    ['environment', 'production'],
    ['env', 'SECRET'],
    ['expression', 'owner.balance + 1'],
    ['template', '${owner.id}'],
    ['regex', '/.*/'],
    ['markup', '<script>alert(1)</script>'],
    ['seed', 'chosen-seed'],
    ['timestamp', '2026-09-04T00:00:00Z'],
    ['itemId', 'server-item'],
    ['eventId', 'server-event'],
    ['accountId', 'server-account'],
    ['ownerId', 'server-owner'],
    ['idempotencyKey', 'chosen-key'],
    ['files', ['extra.json']],
  ];
  for (const [field, value] of executableFields) {
    rejectsCode(() => compileOne(baseLibrary({ [field]: value })), 'content_schema_invalid');
  }
  assert.doesNotThrow(() => compileOne(baseLibrary({ metadata: {
    title: 'A function, SELECT, and https rumor in plain prose',
    summary: 'Nothing here is executable.',
  } })));
  rejectsCode(() => compileOne(baseLibrary({ metadata: { title: '<b>unsafe</b>' } })), 'content_schema_invalid');
  rejectsCode(() => compileOne(baseLibrary({ kind: 'fixture' })), 'content_profile_invalid');
  rejectsCode(() => compileOne(baseLibrary({ profile: 'legacy_runtime' })), 'content_profile_invalid');
  rejectsCode(() => compileOne(baseLibrary({ packageId: `a${'b'.repeat(128)}` })), 'content_schema_invalid');
  rejectsCode(() => compileOne(baseLibrary({ imports: [{
    id: `${`a${'b'.repeat(128)}`}::definition`,
    definitionHash: '0'.repeat(64),
    dependencyBundleHash: '1'.repeat(64),
  }] })), 'content_schema_invalid');
  rejectsCode(() => compileOne(baseLibrary({ currency: 'OMR' })), 'content_omr_forbidden');
  rejectsCode(() => compileOne(baseLibrary({ nodes: [{
    id: 'effect', kind: 'step', refs: [], adapter: { kind: 'omr_reward', args: {} },
  }] })), 'content_omr_forbidden');
  rejectsCode(() => compileOne(baseLibrary({ nodes: [{
    id: 'unknown', kind: 'step', refs: [], adapter: { kind: 'unknown_adapter', args: {} },
  }] })), 'content_schema_invalid');
  rejectsCode(() => compileOne(baseLibrary({ nodes: [{
    id: 'unknown-arg', kind: 'step', refs: [], adapter: { kind: 'observe', args: { callback: 'run' } },
  }] })), 'content_schema_invalid');
  rejectsCode(() => compileOne(baseLibrary({ nodes: [{
    id: 'cash', kind: 'step', refs: [], adapter: { kind: 'cash_transfer', args: { ledgerReason: 'phase2_test' } },
  }] })), 'content_cash_policy');
  rejectsCode(() => compileOne(baseLibrary({ nodes: [{
    id: 'cash', kind: 'step', refs: [], adapter: {
      kind: 'cash_transfer', args: { ledgerReason: 'phase2_test' },
      cash: { classification: 'transfer', grossCashEmission: 0, netCashDelta: 1 },
    },
  }] })), 'content_cash_policy');
  console.log('✓ the closed profile rejects the complete executable/authority/OMR/cash attack vocabulary');

  {
    const parityRoot = temporaryRoot();
    const raw = fs.readFileSync(path.join(FIXTURES, 'malicious-duplicate', 'pack.json'));
    writePackage(parityRoot, 'bad', raw.toString('utf8'));
    assert.throws(() => parseAuthoredJson(raw), (error) => error?.code === 'json_duplicate_key');
    assert.throws(() => compileRoot(parityRoot), (error) => error?.code === 'json_duplicate_key');
    for (const command of ['check-corpus', 'build-corpus']) {
      const args = ['tools/content.js', command, parityRoot];
      if (command === 'build-corpus') args.push(path.join(parityRoot, 'out.bundle'));
      const run = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
      assert.equal(run.status, 1, `${run.stdout}\n${run.stderr}`);
      assert.equal(errorCode(run), 'json_duplicate_key', run.stderr);
    }
  }
  console.log('✓ parser, direct discovery/compile, check-corpus, and build-corpus preserve one raw error code');

  assertCompilerBoundaryParity(JSON.stringify(baseLibrary({
    javascript: 'function payload() { return 1; }',
  })), 'content_schema_invalid');
  assertCompilerBoundaryParity(JSON.stringify(baseLibrary({
    currency: 'OMR',
  })), 'content_omr_forbidden');
  assertCompilerBoundaryParity(JSON.stringify(baseLibrary({
    kind: 'fixture',
  })), 'content_profile_invalid');
  assertCompilerBoundaryParity(JSON.stringify(baseLibrary({
    nodes: [{ id: 'cash', kind: 'step', adapter: { kind: 'cash_transfer', args: { ledgerReason: 'test' } } }],
  })), 'content_cash_policy');
  assertCompilerBoundaryParity(
    '{"packageId":"omerta.phase2.poison","version":1,"kind":"library","profile":"phase2_economy","definitions":[],"nodes":[],"edges":[],"exports":[],"dependencies":[],"imports":[],"__proto__":{}}',
    'json_dangerous_key',
  );
  assertCompilerBoundaryParity(JSON.stringify(baseLibrary({
    oversizedCollection: Array.from({ length: 100_001 }, () => 0),
  })), 'json_array_limit');
  assertCompilerBoundaryParity(`${'['.repeat(65)}0${']'.repeat(65)}`, 'json_depth_limit');
  assertCompilerBoundaryParity(JSON.stringify(baseLibrary({
    oversizedString: 'x'.repeat((64 * 1024) + 1),
  })), 'json_string_limit');
  console.log('✓ schema, profile, OMR, cash, and prototype failures retain direct/check/build parity');

  {
    const buildRoot = temporaryRoot();
    fs.cpSync(path.join(FIXTURES, 'valid-core'), path.join(buildRoot, 'core'), { recursive: true });
    const direct = compileRoot(buildRoot).bundles[0];
    const outputPath = path.join(buildRoot, 'sealed-corpus');
    const check = spawnSync(process.execPath, ['tools/content.js', 'check-corpus', buildRoot], {
      cwd: ROOT, encoding: 'utf8',
    });
    const build = spawnSync(process.execPath, ['tools/content.js', 'build-corpus', buildRoot, outputPath], {
      cwd: ROOT, encoding: 'utf8',
    });
    assert.equal(check.status, 0, check.stderr);
    assert.equal(build.status, 0, build.stderr);
    assert.deepEqual(JSON.parse(check.stdout).bundleHashes, [direct.hashes.bundleHash]);
    assert.deepEqual(JSON.parse(build.stdout).bundleHashes, [direct.hashes.bundleHash]);
    const index = JSON.parse(fs.readFileSync(path.join(outputPath, 'corpus.index.json'), 'utf8'));
    assert.equal(index.bundles.length, 1);
    const [expectedHashes, verificationOptions] = trustedVerification(direct);
    const verified = verifyStoredBundleBytes(
      fs.readFileSync(path.join(outputPath, index.bundles[0].file)),
      expectedHashes,
      verificationOptions,
    );
    assert.equal(verified.hashes.bundleHash, direct.hashes.bundleHash);
  }
  console.log('✓ build-corpus writes the exact immutable bytes accepted by stored-artifact verification');

  {
    const fixtureRoot = temporaryRoot();
    writePackage(fixtureRoot, 'scale', baseLibrary({ packageId: 'omerta.phase2.fixture.trusted' }));
    const descriptor = discovered(fixtureRoot, { fixtureRoots: [fixtureRoot] })[0];
    const fixtureBundle = compileContentCorpus({
      packages: [descriptor], compilerVersion: COMPILER_VERSION, dependencyCatalog: { bundles: [] },
    }).bundles[0];
    assert.equal(fixtureBundle.package.kind, 'fixture');
    assert.equal(fixtureBundle.package.activatable, false);
    rejectsCode(() => compileOne(baseLibrary({
      packageId: 'omerta.phase2.production-fixture-import',
      dependencies: [{
        packageId: fixtureBundle.package.id,
        version: fixtureBundle.package.version,
        bundleHash: fixtureBundle.hashes.bundleHash,
      }],
    }), { dependencyCatalog: trustedCatalog(fixtureBundle) }), 'content_profile_invalid');
    assert.throws(() => compileContentCorpus({
      packages: [{ ...descriptor, authorityProfile: 'fixture' }],
      compilerVersion: COMPILER_VERSION,
      dependencyCatalog: { bundles: [] },
    }), /not issued by content discovery/);
    assert.throws(() => compileContentCorpus({
      packages: Array(2_049).fill(descriptor),
      compilerVersion: COMPILER_VERSION,
      dependencyCatalog: { bundles: [] },
    }), (error) => error?.code === 'content_input_limit');

    const corpusBytesRoot = temporaryRoot();
    writePackage(corpusBytesRoot, 'large', baseLibrary({
      packageId: 'omerta.phase2.fixture.corpus-bytes',
      metadata: { summary: 'x'.repeat(34_000) },
    }));
    const corpusBytesDescriptor = discovered(corpusBytesRoot, {
      fixtureRoots: [corpusBytesRoot],
    })[0];
    assert.throws(() => compileContentCorpus({
      packages: Array(2_048).fill(corpusBytesDescriptor),
      compilerVersion: COMPILER_VERSION,
      dependencyCatalog: { bundles: [] },
    }), (error) => error?.code === 'content_input_limit'
      && error?.details?.limitKind === 'corpusBytes');
  }
  console.log('✓ only walker provenance grants non-activatable fixture authority and corpus limits stay server-owned');

  {
    const referenceBomb = Array.from({ length: 257 }, (_, index) => `ref.${index}`);
    rejectsCode(() => compileOne(baseLibrary({
      nodes: [
        { id: 'root', kind: 'step', refs: referenceBomb },
        ...referenceBomb.map((id) => ({ id, kind: 'step', refs: [] })),
      ],
    })), 'content_input_limit');

    const componentNodes = Array.from({ length: 257 }, (_, index) => ({ id: `n.${index}`, kind: 'step', refs: [] }));
    const componentEdges = componentNodes.map((node, index) => ({
      from: node.id, to: componentNodes[(index + 1) % componentNodes.length].id, kind: 'requires',
    }));
    rejectsCode(() => compileOne(baseLibrary({ nodes: componentNodes, edges: componentEdges })), 'content_input_limit');

    const hugeReport = clone(core);
    hugeReport.reports.validation.padding = 'x'.repeat((8 * 1024 * 1024) + 1);
    rejectsCode(() => validateCompiledBundle(hugeReport, { authorityProfile: 'production' }), 'content_input_limit');

    const hugeOverlay = clone(core);
    hugeOverlay.secretOverlay = {
      state: 'present', bytesBase64: Buffer.alloc((1024 * 1024) + 1).toString('base64'),
    };
    hugeOverlay.canonicalHashInputs.secretOverlay = hugeOverlay.secretOverlay;
    rejectsCode(() => validateCompiledBundle(hugeOverlay, { authorityProfile: 'production' }), 'content_input_limit');

    const tooManyEdges = clone(core);
    tooManyEdges.ir.edges = Array(100_001).fill(tooManyEdges.ir.edges[0]);
    tooManyEdges.canonicalHashInputs.ir.edges = tooManyEdges.ir.edges;
    rejectsCode(() => validateCompiledBundle(tooManyEdges, { authorityProfile: 'production' }), 'content_input_limit');

    const tooManyNodes = clone(core);
    tooManyNodes.ir.nodes = Array(20_001).fill(tooManyNodes.ir.nodes[0]);
    tooManyNodes.canonicalHashInputs.ir.nodes = tooManyNodes.ir.nodes;
    rejectsCode(() => validateCompiledBundle(tooManyNodes, { authorityProfile: 'production' }), 'content_input_limit');

    const largeRoot = temporaryRoot();
    writePackage(largeRoot, 'large', baseLibrary({
      padding: Array.from({ length: 18 }, () => 'x'.repeat(60_000)),
    }));
    const issuedLarge = discovered(largeRoot, { limits: { maxManifestBytes: 2 * 1024 * 1024 } });
    assert.throws(() => compileContentCorpus({
      packages: issuedLarge, compilerVersion: COMPILER_VERSION, dependencyCatalog: { bundles: [] },
    }), (error) => error?.code === 'json_byte_limit');
  }
  console.log('✓ semantic reference/component/edge/report limits fire before unbounded validation work');
} finally {
  for (const root of temporaryRoots) {
    const resolved = path.resolve(root);
    assert(resolved.startsWith(path.resolve(os.tmpdir())), `refusing to remove non-temporary path ${resolved}`);
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

console.log('phase2 compiler tests passed');
