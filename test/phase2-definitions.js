import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
import { canonicalBytes, hashFrame, HASH_DOMAINS } from '../src/content/canonical.js';
import { baseLibrary, compileFixture, database, snapshotPhase2, materialSource, deferred, forwardPool } from './lib/phase2-definition-fixtures.js';

const empty = compileFixture();
const one = compileFixture(baseLibrary({ definitions: [{ id: 'note', definitionVersion: 1, kind: 'concept' }] }));
const { storeSealedBundle } = await import('../src/content/artifacts.js');
const { registerItemDefinitions, definitionByHash } = await import('../src/itemdefinitions.js');
const { withPhase2Transaction, withPhase2Read, registerPhase2Undo, assertPhase2Client } = await import('../src/content/phase2-transactions.js');
const { verifyIncomingArtifact, verifiedArtifactData, verifyStoredArtifactRow } = await import('../src/content/artifact-storage.js');
const { pool } = await database();
const rejects = (promise, code) => assert.rejects(promise, (error) => error.code === code);
if (process.argv.includes('--poison-child')) {
  await rejects(withPhase2Transaction(pool, async (client) => {
    registerPhase2Undo(client, async () => { throw Object.assign(Error('private SQL must stay private'), { code: 'undo_failed' }); });
    throw Object.assign(Error('private bytes must stay private'), { code: 'original_failed' });
  }), 'content_registry_recovery_required');
  await rejects(withPhase2Read(pool, () => 1), 'content_registry_recovery_required');
  await rejects(storeSealedBundle(pool, empty.request), 'content_registry_recovery_required');
  await pool.end();
  console.log('poison recovery refuses subsequent reads and writes');
  process.exit(0);
}
try {
  const start = await snapshotPhase2(pool);
  for (const identity of [{}, { ...empty.identity, extra: 1 }, [],
    { ...empty.identity, packageVersion: '1' }, { ...empty.identity, bundleHash: 'x' },
    Object.defineProperty({ ...empty.identity }, 'packageId', { get() { throw Error('must not read'); } })]) {
    await rejects(storeSealedBundle(pool, { ...empty.request, expectedIdentity: identity }), 'bad_content_request');
    assert.deepEqual(await snapshotPhase2(pool), start);
  }
  for (const version of [0, -1, 1.5, -0, '1', 9007199254740992]) {
    const noSql = forwardPool(pool);
    await rejects(storeSealedBundle(noSql, { ...empty.request,
      expectedIdentity: { ...empty.identity, packageVersion: version } }), 'bad_content_request');
    assert.equal(noSql.statements.length, 0);
  }
  for (const request of [{ ...empty.request, source: {} }, [],
    Object.defineProperty({ ...empty.request }, 'operatorId', { get() { throw Error('getter ran'); } })]) {
    const noSql = forwardPool(pool);
    await rejects(storeSealedBundle(noSql, request), 'bad_content_request');
    assert.equal(noSql.statements.length, 0);
  }
  for (const operatorId of ['', ' leading', 'trailing ', 'a'.repeat(201), 'new\nline']) {
    const noSql = forwardPool(pool);
    await rejects(storeSealedBundle(noSql, { ...empty.request, operatorId }), 'bad_content_request');
    assert.equal(noSql.statements.length, 0);
  }
  await rejects(storeSealedBundle(pool, { ...empty.request, canonicalBytes: Buffer.concat([empty.bytes, Buffer.from(' ')]) }), 'content_artifact_mismatch');
  await rejects(storeSealedBundle(pool, { ...empty.request,
    expectedIdentity: { ...empty.identity, bundleHash: '0'.repeat(64) } }), 'content_hash_mismatch');
  await rejects(storeSealedBundle(pool, { ...empty.request,
    expectedIdentity: { ...empty.identity, packageId: 'omerta.other' } }), 'content_artifact_conflict');
  assert.deepEqual(await snapshotPhase2(pool), start);
  const storedEmpty = await storeSealedBundle(pool, empty.request);
  assert.equal(storedEmpty.definitionCount, 0);
  assert.equal(storedEmpty.replayed, false);
  assert.equal((await pool.query('SELECT * FROM content_bundle_activations')).rows[0].activation_revision, 0);
  assert.equal((await pool.query('SELECT * FROM item_definition_versions')).rows.length, 0);
  assert.deepEqual(await registerItemDefinitions(pool, { bundleHash: storedEmpty.bundleHash }), {
    bundleHash: storedEmpty.bundleHash, definitionCount: 0, replayed: true,
  });
  const r1 = compileFixture(baseLibrary({ version: 2, definitions: [{ id: 'note', definitionVersion: 1, kind: 'concept' }] }));
  const first = await storeSealedBundle(pool, r1.request);
  assert.equal(first.definitionCount, 1);
  assert.equal(first.replayed, false);
  const beforeReplay = await snapshotPhase2(pool);
  assert.equal((await storeSealedBundle(pool, { ...r1.request, operatorId: 'different operator' })).replayed, true);
  assert.deepEqual(await snapshotPhase2(pool), beforeReplay);
  assert.deepEqual(await registerItemDefinitions(pool, { bundleHash: first.bundleHash }), {
    bundleHash: first.bundleHash, definitionCount: 1, replayed: true,
  });
  const hash = r1.bundle.hashes.definitionHashById['omerta.phase2.registry::note'];
  assert.deepEqual(await definitionByHash(pool, hash), { logicalItemId: 'omerta.phase2.registry::note',
    definitionVersion: 1, definitionHash: hash, packageId: 'omerta.phase2.registry',
    kind: 'concept', tradePolicyHash: null });
  await rejects(definitionByHash(pool, '0'.repeat(64)), 'definition_not_found');
  await rejects(storeSealedBundle(pool, one.request), 'content_bundle_version_conflict');
  await rejects(storeSealedBundle(pool, { ...r1.request,
    expectedIdentity: { ...r1.identity, packageVersion: 10 } }), 'content_artifact_conflict');
  assert.deepEqual(await snapshotPhase2(pool), beforeReplay);
  const r3 = compileFixture(baseLibrary({ version: 4, definitions: [{ id: 'note', definitionVersion: 3, kind: 'concept' }] }));
  const r2 = compileFixture(baseLibrary({ version: 3, definitions: [{ id: 'note', definitionVersion: 1, kind: 'concept' }] }));
  await storeSealedBundle(pool, r3.request);
  await storeSealedBundle(pool, r2.request);
  assert.equal((await pool.query('SELECT * FROM item_definition_versions')).rows.length, 2);
  assert.equal((await pool.query('SELECT * FROM content_bundle_item_definitions')).rows.length, 3);
  const beforeConflict = await snapshotPhase2(pool);
  const lower = compileFixture(baseLibrary({ version: 5, definitions: [{ id: 'note', definitionVersion: 2, kind: 'concept' }] }));
  await rejects(storeSealedBundle(pool, lower.request), 'item_definition_conflict');
  assert.deepEqual(await snapshotPhase2(pool), beforeConflict);
  await pool.query('DELETE FROM content_bundle_item_definitions WHERE bundle_hash=$1', [r1.identity.bundleHash]);
  const corrupt = await snapshotPhase2(pool);
  await rejects(registerItemDefinitions(pool, { bundleHash: r1.identity.bundleHash }), 'content_registry_corrupt');
  await rejects(storeSealedBundle(pool, r1.request), 'content_registry_corrupt');
  assert.deepEqual(await snapshotPhase2(pool), corrupt);
  console.log('phase2-definitions: admission, atomic registration, replay, versions and no-repair pass');
} finally { await pool.end(); }

// A forwarding wrapper pauses only transport, leaving every database side effect real.
{
  const { pool } = await database();
  try {
    const ready = deferred(), release = deferred();
    const delayed = forwardPool(pool, { acquire: async () => { ready.resolve(); await release.promise; } });
    const bytes = Buffer.concat([Buffer.from('prefix'), one.bytes, Buffer.from('suffix')]);
    const view = bytes.subarray(6, bytes.length - 6);
    const request = { canonicalBytes: view, expectedIdentity: { ...one.identity }, operatorId: 'original operator' };
    const storing = storeSealedBundle(delayed, request);
    await ready.promise;
    view.fill(120); request.expectedIdentity.packageId = 'changed'; request.operatorId = 'changed';
    release.resolve();
    await storing;
    const row = (await pool.query('SELECT * FROM content_bundle_artifacts')).rows[0];
    assert(Buffer.from(row.canonical_bytes).equals(one.bytes));
    assert.equal(row.registered_by, 'original operator');
    assert.equal(view[0], 120); // No caller memory restoration/writeback.
    for (const input of [new Uint8Array(new SharedArrayBuffer(8)), new Uint8Array(new ArrayBuffer(8, { maxByteLength: 16 })),
      Object.defineProperty(new Uint8Array(8), 'byteLength', { get() { throw Error('getter'); } }),
      new (class extends Uint8Array { get byteLength() { throw Error('inherited getter'); } })(8)]) {
      const noSql = forwardPool(pool);
      await rejects(storeSealedBundle(noSql, { ...empty.request, canonicalBytes: input }), 'bad_content_request');
      assert.equal(noSql.statements.length, 0);
    }
    const detached = new Uint8Array(8);
    structuredClone(detached.buffer, { transfer: [detached.buffer] });
    await rejects(storeSealedBundle(pool, { ...empty.request, canonicalBytes: detached }), 'bad_content_request');
    const noSql = forwardPool(pool);
    await rejects(storeSealedBundle(noSql, { ...empty.request, canonicalBytes: Buffer.alloc(67108865) }), 'content_input_limit');
    assert.equal(noSql.statements.length, 0);
  } finally { await pool.end(); }
}

// Every potentially successful INSERT is followed by a injected transport failure, including
// both newly inserted intrinsic rows and each membership. No sequence rollback assumption.
{
  const two = compileFixture(baseLibrary({ definitions: [
    { id: 'a', definitionVersion: 1, kind: 'concept' }, { id: 'b', definitionVersion: 1, kind: 'concept' },
  ] }));
  for (let failAt = 1; failAt <= 6; failAt++) {
    const { pool } = await database();
    try {
      const before = await snapshotPhase2(pool);
      let writes = 0;
      const failing = forwardPool(pool, { after: async (sql) => {
        if (sql.startsWith('INSERT') && ++writes === failAt) throw Error('injected write acknowledgement loss');
      } });
      await rejects(storeSealedBundle(failing, two.request), 'internal');
      assert.deepEqual(await snapshotPhase2(pool), before);
      await storeSealedBundle(pool, two.request);
    } finally { await pool.end(); }
  }
  const { pool } = await database();
  try {
    await storeSealedBundle(pool, one.request);
    const reused = compileFixture(baseLibrary({ version: 2, definitions: [
      { id: 'note', definitionVersion: 1, kind: 'concept' }, { id: 'z', definitionVersion: 1, kind: 'concept' },
    ] }));
    for (let failAt = 1; failAt <= 4; failAt++) {
      const before = await snapshotPhase2(pool);
      let writes = 0;
      const failing = forwardPool(pool, { after: async (sql) => {
        if (sql.startsWith('INSERT') && ++writes === failAt) throw Error('reused write failed');
      } });
      await rejects(storeSealedBundle(failing, reused.request), 'internal');
      assert.deepEqual(await snapshotPhase2(pool), before);
    }
  } finally { await pool.end(); }
}

// Read and write callbacks share one gate across aliases in both interleaving directions.
{
  const { pool } = await database();
  try {
    const entered = deferred(), release = deferred();
    const writer = forwardPool(pool, { after: async (sql) => {
      if (sql.startsWith('INSERT INTO content_bundle_artifacts')) { entered.resolve(); await release.promise; throw Error('rollback'); }
    } });
    const before = await snapshotPhase2(pool);
    const writing = storeSealedBundle(writer, one.request);
    const rejected = rejects(writing, 'internal');
    await entered.promise;
    let readDone = false;
    const reading = snapshotPhase2(forwardPool(pool)).then((snapshot) => { readDone = true; return snapshot; });
    await pause(30); assert.equal(readDone, false);
    release.resolve(); await rejected;
    assert.deepEqual(await reading, before);
    const firstRead = deferred(), finishRead = deferred();
    const reader = withPhase2Read(forwardPool(pool), async (q) => {
      assert.equal((await q.query('SELECT * FROM content_bundle_artifacts')).rows.length, 0);
      firstRead.resolve(); await finishRead.promise;
      assert.equal((await q.query('SELECT * FROM content_bundle_artifacts')).rows.length, 0);
      await pause(20);
    });
    await firstRead.promise;
    let writeDone = false;
    const nextWriter = storeSealedBundle(new Proxy(pool, {}), one.request).then(() => { writeDone = true; });
    await pause(30); assert.equal(writeDone, false);
    finishRead.resolve(); await reader; await nextWriter;
    assert.equal(writeDone, true);
    await withPhase2Transaction(pool, async (client) => {
      assertPhase2Client(client);
      assert.equal(await withPhase2Read(client, async () => 42), 42);
      await rejects(storeSealedBundle(pool, one.request), 'content_transaction_nested');
      assert.throws(() => assertPhase2Client({ query: client.query.bind(client) }), (e) => e.code === 'content_transaction_required');
    });
    await rejects(storeSealedBundle({ query: pool.query.bind(pool) }, one.request), 'content_transaction_required');
    const beforeErrors = await snapshotPhase2(pool);
    for (const [code, expected] of [['40001', 'contention'], ['40P01', 'contention'], ['55P03', 'contention'],
      ['57014', 'contention'], ['23505', 'content_registry_corrupt'], ['23503', 'content_registry_corrupt'],
      ['23514', 'content_registry_corrupt'], ['23502', 'content_registry_corrupt'], ['25P02', 'content_registry_corrupt']]) {
      await rejects(withPhase2Transaction(pool, async () => { throw Object.assign(Error('synthetic'), { code }); }), expected);
      assert.deepEqual(await snapshotPhase2(pool), beforeErrors);
    }
  } finally { await pool.end(); }
  const child = spawnSync(process.execPath, [new URL(import.meta.url).pathname.replace(/^\/(?:([A-Z]):)/, '$1:'), '--poison-child'], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  assert.match(child.stdout, /poison recovery refuses/);
}

// Optional concept columns retain omission independently, including false and explicit empty arrays.
{
  const cases = [{ family: 'notes' }, { tags: [] }, { tags: ['record'] }, { rarity: 'rare' }, { stackable: false },
    { tradePolicy: { mode: 'closed', transferable: false } }, { ownerScopes: [] }, { ownerScopes: ['account', 'project'] },
    { qualityMode: 'fixed' }, { maximumLotQuantity: 1000000 }, { conservationClass: 'finite' },
    { metadata: { title: 'Note' } }, { stackable: false, tags: [], metadata: { title: 'Note' } }];
  const { pool } = await database();
  try {
    for (const [index, fields] of cases.entries()) {
      const fixture = compileFixture(baseLibrary({ packageId: `omerta.optional.case${index}`, definitions: [
        { id: 'note', definitionVersion: 1, kind: 'concept', ...fields },
      ] }));
      await storeSealedBundle(pool, fixture.request);
      const hash = Object.values(fixture.bundle.hashes.definitionHashById)[0];
      const value = await definitionByHash(pool, hash);
      assert.deepEqual(value, { logicalItemId: `omerta.optional.case${index}::note`, definitionVersion: 1,
        definitionHash: hash, packageId: `omerta.optional.case${index}`, kind: 'concept', ...fields,
        tradePolicyHash: fields.tradePolicy ? hash : null });
      assert(Object.isFrozen(value));
      if (value.tags) assert(Object.isFrozen(value.tags));
      const row = (await pool.query('SELECT * FROM item_definition_versions WHERE definition_hash=$1', [hash])).rows[0];
      assert.equal(row.tags_json, fields.tags ? JSON.stringify(fields.tags) : null);
      assert.equal(row.owner_scopes_json, fields.ownerScopes ? JSON.stringify(fields.ownerScopes) : null);
      assert.equal(row.stackable, fields.stackable ?? null);
    }
    const material = compileFixture(materialSource());
    assert.equal((await storeSealedBundle(pool, material.request)).definitionCount, 1);
    assert.deepEqual(await definitionByHash(pool, material.expectedDefinitions[0].definitionHash), material.expectedDefinitions[0]);
    let vocabularyIndex = 0;
    for (const [field, values] of Object.entries({ rarity: ['common', 'uncommon', 'rare', 'specialty'],
      qualityMode: ['none', 'fixed', 'inherited', 'bounded'],
      conservationClass: ['renewable', 'finite', 'durable', 'consumable'],
      tradePolicy: ['closed', 'ordinary', 'restricted'] })) {
      for (const member of values) {
        const value = field === 'tradePolicy' ? { mode: member, transferable: false } : member;
        const fixture = compileFixture(baseLibrary({ packageId: `omerta.vocabulary.case${vocabularyIndex++}`,
          definitions: [{ id: 'note', definitionVersion: 1, kind: 'concept', [field]: value }] }));
        await storeSealedBundle(pool, fixture.request);
        assert.deepEqual((await definitionByHash(pool, fixture.expectedDefinitions[0].definitionHash))[field], value);
      }
      const invalid = field === 'tradePolicy' ? { mode: 'invalid', transferable: false } : 'invalid';
      assert.throws(() => compileFixture(baseLibrary({ definitions: [
        { id: 'note', definitionVersion: 1, kind: 'concept', [field]: invalid }],
      })), (error) => error.code === 'content_schema_invalid');
    }
    const fixture = compileFixture(baseLibrary({ packageId: 'omerta.fixture.registry' }), { fixture: true });
    assert.equal((await storeSealedBundle(pool, fixture.request)).authorityProfile, 'fixture');
    for (const version of [2147483648, 9007199254740991]) {
      const large = compileFixture(baseLibrary({ packageId: `omerta.large.v${version}`, version,
        definitions: [{ id: 'note', definitionVersion: version, kind: 'concept' }] }));
      assert.equal((await storeSealedBundle(pool, large.request)).bundleVersion, version);
      assert.equal((await definitionByHash(pool, Object.values(large.bundle.hashes.definitionHashById)[0])).definitionVersion, version);
    }
  } finally { await pool.end(); }
  for (const field of ['family', 'tags', 'rarity', 'stackable', 'tradePolicy', 'ownerScopes', 'qualityMode', 'maximumLotQuantity', 'conservationClass']) {
    const source = materialSource(); delete source.definitions[0][field];
    assert.throws(() => compileFixture(source), (error) => error.code === 'content_schema_invalid');
  }
  for (const version of [0, -1, 1.5, -0, '1', 9007199254740992]) {
    assert.throws(() => compileFixture(baseLibrary({ version })), (error) => typeof error.code === 'string');
    assert.throws(() => compileFixture(baseLibrary({ definitions: [{ id: 'note', definitionVersion: version, kind: 'concept' }] })), (error) => typeof error.code === 'string');
  }
  assert.throws(() => compileFixture(materialSource({ maximumLotQuantity: 1000001 })), (error) => error.code === 'content_input_limit');
}
console.log('phase2-definitions: snapshots, every-write compensation, interleavings, recovery and optional matrix pass');

// Exact stored dependency closure (chain and shared diamond), independent of live source roots.
{
  const dep = (fixture) => ({ packageId: fixture.identity.packageId, version: fixture.identity.packageVersion,
    bundleHash: fixture.identity.bundleHash });
  const d = compileFixture(baseLibrary({ packageId: 'omerta.dag.d', definitions: [
    { id: 'note', definitionVersion: 1, kind: 'concept' }], exports: ['note'] }));
  const b = compileFixture(baseLibrary({ packageId: 'omerta.dag.b', dependencies: [dep(d)], imports: [{
    id: 'omerta.dag.d::note', definitionHash: Object.values(d.bundle.hashes.definitionHashById)[0],
    dependencyBundleHash: d.identity.bundleHash,
  }] }), { dependencies: [d] });
  const c = compileFixture(baseLibrary({ packageId: 'omerta.dag.c', dependencies: [dep(d)] }), { dependencies: [d] });
  const root = compileFixture(baseLibrary({ packageId: 'omerta.dag.root', dependencies: [dep(b), dep(c)] }), { dependencies: [b, c, d] });
  const { pool } = await database();
  try {
    await storeSealedBundle(pool, d.request);
    assert.equal((await storeSealedBundle(pool, b.request)).definitionCount, 0);
    await storeSealedBundle(pool, c.request);
    await storeSealedBundle(pool, one.request); // Unrelated registration must never enter root's catalog.
    const counts = new Map();
    const traced = forwardPool(pool, { before: async (sql, values) => {
      if (sql === 'SELECT * FROM content_bundle_artifacts WHERE bundle_hash=$1') {
        counts.set(values[0], (counts.get(values[0]) ?? 0) + 1);
      }
    } });
    assert.equal((await storeSealedBundle(traced, root.request)).definitionCount, 0);
    assert.deepEqual([...counts.keys()].sort(), [root.identity.bundleHash, b.identity.bundleHash, c.identity.bundleHash, d.identity.bundleHash].sort());
    assert.deepEqual([...counts.values()], [1, 1, 1, 1]);
    const beforeReplay = await snapshotPhase2(pool);
    counts.clear();
    assert.equal((await storeSealedBundle(traced, { ...root.request, operatorId: 'dag replay operator' })).replayed, true);
    for (const dependency of [b, c, d]) {
      assert.equal(counts.get(dependency.identity.bundleHash), 1, 'exact replay must fetch each dependency hash once');
    }
    assert.equal(counts.get(root.identity.bundleHash), 1, 'exact replay must read the stored root once');
    assert.equal(counts.size, 4, 'exact replay must not fetch an unrelated artifact');
    assert.deepEqual(await snapshotPhase2(pool), beforeReplay);
    for (const [column, value] of [['canonical_bytes', Buffer.from('{}')], ['report_hashes_json', '{}'],
      ['registered_by', 'invalid\noperator'], ['registered_at', 'not-a-timestamp']]) {
      const corruptRoot = forwardPool(pool, { after: async (sql, values, result) => {
        if (sql === 'SELECT * FROM content_bundle_artifacts WHERE bundle_hash=$1' && values[0] === root.identity.bundleHash) {
          result.rows[0] = { ...result.rows[0], [column]: value };
        }
      } });
      await rejects(storeSealedBundle(corruptRoot, root.request), 'content_registry_corrupt');
      assert.deepEqual(await snapshotPhase2(pool), beforeReplay);
    }
    assert.equal((await pool.query('SELECT * FROM content_bundle_item_definitions WHERE bundle_hash=$1', [b.identity.bundleHash])).rows.length, 0);
    for (const [column, value] of [['canonical_bytes', Buffer.from('{}')], ['authority_profile', 'fixture'],
      ['bundle_version', 99], ['dependency_lock_hash', '0'.repeat(64)]]) {
      // Simulate drift while preserving real lookup and all compiler verification.
      const corrupted = forwardPool(pool, { after: async (sql, values, result) => {
        if (sql === 'SELECT * FROM content_bundle_artifacts WHERE bundle_hash=$1' && values[0] === d.identity.bundleHash) {
          result.rows[0] = { ...result.rows[0], [column]: value };
        }
      } });
      await rejects(storeSealedBundle(corrupted, root.request), 'content_dependency_drift');
    }
    const missing = forwardPool(pool, { after: async (sql, values, result) => {
      if (sql === 'SELECT * FROM content_bundle_artifacts WHERE bundle_hash=$1' && values[0] === d.identity.bundleHash) result.rows = [];
    } });
    await rejects(storeSealedBundle(missing, root.request), 'content_dependency_unresolved');
    const invalid = structuredClone(root.bundle);
    invalid.lock.dependencies = Array(2048).fill(dep(d));
    const bounded = forwardPool(pool);
    await rejects(storeSealedBundle(bounded, { ...root.request, canonicalBytes: canonicalBytes(invalid) }), 'content_input_limit');
    assert.equal(bounded.statements.filter((sql) => sql === 'SELECT * FROM content_bundle_artifacts WHERE bundle_hash=$1').length, 0);
    const directOverflow = structuredClone(root.bundle);
    directOverflow.lock.directDependencies = Array(2048).fill(dep(d));
    const boundedDirect = forwardPool(pool);
    await rejects(storeSealedBundle(boundedDirect, { ...root.request, canonicalBytes: canonicalBytes(directOverflow) }), 'content_input_limit');
    assert.equal(boundedDirect.statements.filter((sql) => sql === 'SELECT * FROM content_bundle_artifacts WHERE bundle_hash=$1').length, 0);
    const tooMany = structuredClone(root.bundle);
    tooMany.ir.nodes = Array(60000).fill({ refs: [] });
    const oversizedDependency = structuredClone(d.bundle);
    oversizedDependency.ir.nodes = Array(60000).fill({ refs: [] });
    const overBudget = forwardPool(pool, { after: async (sql, values, result) => {
      if (sql === 'SELECT * FROM content_bundle_artifacts WHERE bundle_hash=$1' && values[0] === d.identity.bundleHash) {
        result.rows[0] = { ...result.rows[0], canonical_bytes: canonicalBytes(oversizedDependency) };
      }
    } });
    await rejects(storeSealedBundle(overBudget, { ...root.request, canonicalBytes: canonicalBytes(tooMany) }), 'content_input_limit');
    const importDrift = structuredClone(b.bundle);
    importDrift.lock.imports[0].definitionHash = '0'.repeat(64);
    await assert.rejects(storeSealedBundle(pool, { ...b.request, canonicalBytes: canonicalBytes(importDrift) }),
      (error) => error.code === 'content_artifact_mismatch');
    await pool.query('DELETE FROM content_bundle_item_definitions WHERE bundle_hash=$1', [d.identity.bundleHash]);
    await pool.query('DELETE FROM content_bundle_artifacts WHERE bundle_hash=$1', [d.identity.bundleHash]);
    const afterDeletion = await snapshotPhase2(pool);
    await rejects(storeSealedBundle(pool, root.request), 'content_dependency_unresolved');
    assert.deepEqual(await snapshotPhase2(pool), afterDeletion);
  } finally { await pool.end(); }
}

// Malformed dependency arrays cannot hide neighboring resources or enqueue further reads.
{
  const dependencies = Array.from({ length: 6 }, (_, index) => compileFixture(baseLibrary({
    packageId: `omerta.budget.d${index}`,
  })));
  const hint = ({ identity }) => ({ packageId: identity.packageId, version: identity.packageVersion,
    bundleHash: identity.bundleHash });
  const root = compileFixture(baseLibrary({ packageId: 'omerta.budget.root',
    dependencies: dependencies.map(hint) }), { dependencies });
  const { pool } = await database();
  try {
    for (const dependency of dependencies) await storeSealedBundle(pool, dependency.request);
    await storeSealedBundle(pool, one.request); // Valid added hint, outside the root's closure.
    const before = await snapshotPhase2(pool);
    for (const malformed of ['nodes', 'edges']) {
      for (const value of [null, undefined]) {
        const parsed = structuredClone(dependencies[0].bundle);
        parsed.ir.nodes = [{ refs: ['neighbor'] }]; parsed.ir.edges = [{}];
        if (value === undefined) delete parsed.ir[malformed];
        else parsed.ir[malformed] = value;
        parsed.lock.dependencies = [hint(one)];
        const fetched = [];
        const corrupted = forwardPool(pool, { after: async (sql, values, result) => {
          if (sql !== 'SELECT * FROM content_bundle_artifacts WHERE bundle_hash=$1') return;
          fetched.push(values[0]);
          if (values[0] === dependencies[0].identity.bundleHash) {
            result.rows[0] = { ...result.rows[0], canonical_bytes: canonicalBytes(parsed) };
          }
        } });
        await rejects(storeSealedBundle(corrupted, root.request), 'content_dependency_drift');
        assert.deepEqual(fetched, [dependencies[0].identity.bundleHash],
          `${malformed} corruption must refuse before retaining the row or fetching another dependency`);
        assert.deepEqual(await snapshotPhase2(pool), before);
      }
    }
    // Each individual array stays within the parser's 100,000-item bound. Combined dimensions
    // cross their published ceiling before compiler validation of these intentionally corrupt IRs.
    for (const dimension of ['nodes', 'references', 'edges']) {
      const parsedRoot = structuredClone(root.bundle);
      if (dimension === 'nodes') parsedRoot.ir.nodes = Array(60000).fill(null);
      if (dimension === 'references') parsedRoot.ir.nodes = Array(6000).fill({ refs: Array(100).fill('r') });
      if (dimension === 'edges') parsedRoot.ir.edges = Array(100000).fill(null);
      const fetched = [];
      const corrupted = forwardPool(pool, { after: async (sql, values, result) => {
        if (sql !== 'SELECT * FROM content_bundle_artifacts WHERE bundle_hash=$1') return;
        fetched.push(values[0]);
        const parsed = structuredClone(dependencies.find((dep) => dep.identity.bundleHash === values[0]).bundle);
        if (dimension === 'nodes') { parsed.ir.nodes = Array(60000).fill(null); delete parsed.ir.edges; }
        if (dimension === 'references') {
          parsed.ir.nodes = Array(5000).fill({ refs: Array(100).fill('r') }); delete parsed.ir.edges;
        }
        if (dimension === 'edges') {
          parsed.ir.edges = Array(100000).fill(null);
          if (fetched.length === 5) delete parsed.ir.nodes;
        }
        parsed.lock.dependencies = [hint(one)];
        result.rows[0] = { ...result.rows[0], canonical_bytes: canonicalBytes(parsed) };
      } });
      await rejects(storeSealedBundle(corrupted, { ...root.request, canonicalBytes: canonicalBytes(parsedRoot) }), 'content_input_limit');
      assert.deepEqual(fetched, dependencies.slice(0, dimension === 'edges' ? 5 : 1).map((dep) => dep.identity.bundleHash));
      assert.deepEqual(await snapshotPhase2(pool), before);
    }
    // Below the budgets, malformed incoming-root arrays keep the compiler's original error code.
    for (const malformed of ['nodes', 'edges']) {
      const parsed = structuredClone(empty.bundle); delete parsed.ir[malformed];
      await rejects(storeSealedBundle(pool, { ...empty.request, canonicalBytes: canonicalBytes(parsed) }), 'unsupported_content_feature');
      assert.deepEqual(await snapshotPhase2(pool), before);
    }
  } finally { await pool.end(); }
}
console.log('phase2-definitions: malformed dependency admission, independent resource ceilings and root verifier codes pass');

// Stored bytes/projection drift must never be repaired, including the intrinsic lookup path.
for (const [table, column, value] of [
  ['content_bundle_artifacts', 'canonical_bytes', Buffer.from('{}')],
  ['content_bundle_artifacts', 'report_hashes_json', '{}'],
  ['content_bundle_artifacts', 'definition_count', 0],
  ['item_definition_versions', 'canonical_definition_bytes', Buffer.from('{}')],
  ['item_definition_versions', 'family', 'changed'],
  ['content_bundle_item_definitions', 'ordinal', 2],
]) {
  const { pool } = await database();
  try {
    await storeSealedBundle(pool, one.request);
    await pool.query(`UPDATE ${table} SET ${column}=$1`, [value]);
    const before = await snapshotPhase2(pool);
    await rejects(storeSealedBundle(pool, one.request), 'content_registry_corrupt');
    await rejects(registerItemDefinitions(pool, { bundleHash: one.identity.bundleHash }), 'content_registry_corrupt');
    if (table === 'item_definition_versions') await rejects(definitionByHash(pool,
      Object.values(one.bundle.hashes.definitionHashById)[0]), 'content_registry_corrupt');
    assert.deepEqual(await snapshotPhase2(pool), before);
  } finally { await pool.end(); }
}
{
  const { pool } = await database();
  try {
    // A self-consistent but noncanonical semantic preimage is corrupt, never safe output.
    await storeSealedBundle(pool, one.request);
    const hash = Object.values(one.bundle.hashes.definitionHashById)[0];
    const input = structuredClone(one.bundle.canonicalHashInputs.definitionById['omerta.phase2.registry::note']);
    input.canonicalImmutableDefinition.metadata = { hiddenSecret: 'private' };
    const actualHash = hashFrame(HASH_DOMAINS.definition, [
      ['definitionFormatVersion', 1], ['packageQualifiedLogicalId', input.packageQualifiedLogicalId],
      ['definitionVersion', 1], ['canonicalImmutableDefinition', input.canonicalImmutableDefinition],
    ]);
    await pool.query('DELETE FROM content_bundle_item_definitions');
    await pool.query('UPDATE item_definition_versions SET definition_hash=$1,metadata_json=$2,canonical_definition_bytes=$3 WHERE definition_hash=$4',
      [actualHash, canonicalBytes(input.canonicalImmutableDefinition.metadata).toString(), canonicalBytes(input), hash]);
    await rejects(definitionByHash(pool, actualHash), 'content_registry_corrupt');
  } finally { await pool.end(); }
}
console.log('phase2-definitions: exact dependency DAGs, resource ceilings, corruption and intrinsic safe projection pass');

{
  const { pool } = await database();
  try {
    const ambiguous = forwardPool(pool, { after: async (sql) => { if (sql === 'COMMIT') throw Error('lost COMMIT acknowledgement'); } });
    await rejects(storeSealedBundle(ambiguous, one.request), 'content_commit_unknown');
    const committed = await snapshotPhase2(pool);
    assert.equal(committed.content_bundle_artifacts.length, 1);
    assert.equal((await storeSealedBundle(pool, { ...one.request, operatorId: 'retry operator' })).replayed, true);
    assert.deepEqual(await snapshotPhase2(pool), committed);
    const canceledCommit = forwardPool(pool, { before: async (sql) => {
      if (sql === 'COMMIT') throw Object.assign(Error('serialization failed'), { code: '40001' });
    } });
    const next = compileFixture(baseLibrary({ packageId: 'omerta.commit.cancelled' }));
    await rejects(storeSealedBundle(canceledCommit, next.request), 'contention');
    assert.deepEqual(await snapshotPhase2(pool), committed);
    const unknownRollback = forwardPool(pool, { before: async (sql) => { if (sql === 'ROLLBACK') throw Error('lost connection'); } });
    await rejects(withPhase2Transaction(unknownRollback, async () => { throw Error('statement failed'); }), 'content_commit_unknown');
    assert.deepEqual(await snapshotPhase2(pool), committed);
    await assert.rejects(withPhase2Transaction(pool, async () => { throw Error('SECRET_ARTIFACT_BYTES SELECT credentials FROM private'); }),
      (error) => !/SECRET_ARTIFACT_BYTES|SELECT credentials/.test(String(error)));
    const changed = compileFixture(baseLibrary({ version: 2, definitions: [
      { id: 'note', definitionVersion: 1, kind: 'concept', family: 'changed' },
    ] }));
    await rejects(storeSealedBundle(pool, changed.request), 'item_definition_conflict');
    assert.deepEqual(await snapshotPhase2(pool), committed);
    const foreign = compileFixture(baseLibrary({ packageId: 'omerta.foreign', definitions: [
      { id: 'extra', definitionVersion: 1, kind: 'concept' },
    ] }));
    await storeSealedBundle(pool, foreign.request);
    await pool.query('INSERT INTO content_bundle_item_definitions (bundle_hash,logical_item_id,definition_hash,ordinal) VALUES ($1,$2,$3,$4)',
      [one.identity.bundleHash, 'omerta.foreign::extra', Object.values(foreign.bundle.hashes.definitionHashById)[0], 1]);
    const corrupt = await snapshotPhase2(pool);
    await rejects(storeSealedBundle(pool, one.request), 'content_registry_corrupt');
    await rejects(registerItemDefinitions(pool, { bundleHash: one.identity.bundleHash }), 'content_registry_corrupt');
    assert.deepEqual(await snapshotPhase2(pool), corrupt);
  } finally { await pool.end(); }
}
console.log('phase2-definitions: ambiguous commit replay, unconfirmed rollback and extraneous membership pass');

{
  const { pool } = await database();
  const raw = await pool.connect();
  const statements = [];
  const reusedClient = { query: (...args) => { statements.push(args[0]); return raw.query(...args); }, release() {} };
  const reusedPool = { connect: async () => reusedClient };
  try {
    await storeSealedBundle(pool, one.request);
    const storedRow = (await raw.query('SELECT * FROM content_bundle_artifacts WHERE bundle_hash=$1', [one.identity.bundleHash])).rows[0];
    const token = await withPhase2Transaction(reusedPool, async (client) => {
      const artifact = await verifyIncomingArtifact(client, one.bytes, one.identity);
      assert.equal(verifiedArtifactData(client, artifact).row.definition_count, 1);
      verifyStoredArtifactRow(client, artifact, storedRow);
      return artifact;
    });
    const retiredResult = await withPhase2Transaction(reusedPool, async (client) => {
      try { verifiedArtifactData(client, token); return 'incorrectly accepted retired token'; }
      catch (error) { return error.code; }
    });
    assert.equal(retiredResult, 'content_transaction_required');
    const retiredComparison = await withPhase2Transaction(reusedPool, async (client) => {
      try { verifyStoredArtifactRow(client, token, storedRow); return 'incorrectly compared retired token'; }
      catch (error) { return error.code; }
    });
    assert.equal(retiredComparison, 'content_transaction_required');
    assert.equal(statements.filter((sql) => /^(?:INSERT|UPDATE|DELETE)\b/i.test(sql)).length, 0);
  } finally { raw.release(); await pool.end(); }
}
