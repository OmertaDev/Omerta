import assert from 'node:assert/strict';
import { setTimeout as pause } from 'node:timers/promises';
import { baseLibrary, compileFixture, database, snapshotPhase2, deferred, forwardPool, schema,
  activationRequest as request } from './lib/phase2-definition-fixtures.js';
import { withPhase2Transaction, withPhase2Read, registerPhase2Undo } from '../src/content/phase2-transactions.js';
import * as artifacts from '../src/content/artifacts.js';
import * as definitions from '../src/itemdefinitions.js';

// Missing trusted admission must fail before any SQL, rather than accepting caller authority.
let policies;
try { policies = await import('../src/content/activation-policy.js'); } catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}
assert.equal(typeof policies?.createActivationPolicy, 'function', 'trusted activation policy factory is required');
assert.equal(typeof artifacts.activateStoredBundle, 'function', 'stored activation entry is required');
const { createActivationPolicy, activationPolicySnapshot, assertActivationHistory } = policies;
const { storeSealedBundle, activateStoredBundle } = artifacts;
const { activeDefinition, definitionByHash } = definitions;
const rejects = (promise, code) => assert.rejects(promise, (error) => error.code === code);
const namespace = 'omerta.phase2.registry';
const concept = (id) => ({ id, definitionVersion: 1, kind: 'concept' });
const a = compileFixture(baseLibrary({ definitions: [concept('kept'), concept('removed')] }));
const b = compileFixture(baseLibrary({ version: 2, definitions: [concept('kept'), concept('added')] }));
const c = compileFixture(baseLibrary({ version: 3 }));
const foreign = compileFixture(baseLibrary({ packageId: 'omerta.phase2.other', definitions: [concept('elsewhere')] }));
const policy = createActivationPolicy({ environment: 'test', allowedProfiles: ['phase2_economy'] });
async function prepared() {
  const db = await database();
  for (const artifact of [a, b, c, foreign]) await storeSealedBundle(db.pool, artifact.request);
  return db;
}

// A missing brand check or mutable configuration copy would authorize these lookalikes.
{
  for (const config of [{}, [], { environment: 'test', allowedProfiles: ['unknown'] },
    { environment: 'test', allowedProfiles: ['phase2_economy', 'phase2_economy'] },
    { environment: 'test', allowedProfiles: 'phase2_economy' },
    ...['', 'Test', ' test', 'test\n', 'x'.repeat(65)].map((environment) => ({ environment, allowedProfiles: [] })),
    { environment: 'test', allowedProfiles: [], extra: true },
    Object.defineProperty({ environment: 'test', allowedProfiles: [] }, 'environment', { get() { throw Error('getter'); } })]) {
    assert.throws(() => createActivationPolicy(config), (error) => error.code === 'content_activation_policy_invalid');
  }
  const profiles = ['phase2_economy'];
  const copied = createActivationPolicy({ environment: 'test', allowedProfiles: profiles });
  profiles.length = 0;
  assert.deepEqual(activationPolicySnapshot(copied), { environment: 'test', allowedProfiles: ['phase2_economy'] });
  assert(Object.isFrozen(activationPolicySnapshot(copied).allowedProfiles));
  const { pool } = await prepared();
  try {
    const before = await snapshotPhase2(pool);
    for (const invalid of [{}, { environment: 'test', allowedProfiles: ['phase2_economy'] },
      JSON.parse(JSON.stringify(policy)), Object.freeze({ ...policy }), { ...policy, trusted: true }, null]) {
      await rejects(activateStoredBundle(pool, request(a), invalid), 'content_activation_policy_invalid');
    }
    await rejects(activateStoredBundle(pool, request(a), createActivationPolicy({ environment: 'test', allowedProfiles: [] })), 'content_activation_policy_denied');
    for (const bad of [{ ...request(a), environment: 'production' }, { ...request(a), profile: 'phase2_economy' },
      { ...request(a), expectedRevision: 1, expectedPreviousBundleHash: null },
      { ...request(a), expectedRevision: 0, expectedPreviousBundleHash: a.identity.bundleHash },
      ...[-0, -1, 1.5, '1', Number.MAX_SAFE_INTEGER + 1].map((expectedRevision) => ({ ...request(a), expectedRevision })),
      { ...request(a), namespace: foreign.identity.packageId }, { ...request(a), operatorId: 'bad\noperator' }]) {
      await rejects(activateStoredBundle(pool, bad, policy), 'bad_content_request');
    }
    assert.deepEqual(await snapshotPhase2(pool), before);
    const first = await activateStoredBundle(pool, request(a), copied);
    assert.equal(first.activationRevision, 1);
    assert.equal(a.bundle.package.activatable, false);
    assert.equal((await pool.query('SELECT * FROM content_activations')).rows.length, 0);
    assert.equal((await pool.query('SELECT * FROM content_bundles')).rows.length, 0);
  } finally { await pool.end(); }
  const fixture = compileFixture(baseLibrary(), { fixture: true });
  const { pool: fixturePool } = await database();
  try {
    await storeSealedBundle(fixturePool, fixture.request);
    const before = await snapshotPhase2(fixturePool);
    await rejects(activateStoredBundle(fixturePool, request(fixture), policy), 'content_activation_policy_denied');
    assert.deepEqual(await snapshotPhase2(fixturePool), before);
  } finally { await fixturePool.end(); }
  console.log('phase2-activation: trusted policy, immutable admission, fixture refusal and legacy separation pass');
}

// Each row is hand specified; stale ABA observations must never match older history.
{
  const { pool } = await prepared();
  try {
    await activateStoredBundle(pool, request(foreign), policy);
    const foreignBefore = await activeDefinition(pool, 'omerta.phase2.other::elsewhere');
    const steps = [
      [a, 0, null, 1, false], [a, 1, a, 1, true], [a, 0, null, 1, true],
      [b, 1, a, 2, false], [b, 1, a, 2, true], [b, 0, null, 2, 'conflict'],
      [a, 2, b, 3, false], [a, 0, null, 3, 'conflict'], [a, 1, a, 3, 'conflict'],
      [a, 2, b, 3, true], [b, 3, b, 3, 'conflict'], [c, 3, a, 4, false],
    ];
    let last;
    for (const [target, expected, previous, revision, replayed] of steps) {
      const before = await snapshotPhase2(pool);
      if (replayed === 'conflict') {
        await rejects(activateStoredBundle(pool, request(target, expected, previous), policy), 'content_activation_conflict');
        assert.deepEqual(await snapshotPhase2(pool), before);
      } else {
        const result = await activateStoredBundle(pool, request(target, expected, previous, replayed ? 'retry operator' : 'activation operator'), policy);
        assert.equal(result.activationRevision, revision);
        assert.equal(result.replayed, replayed);
        assert.match(result.eventId, /^[1-9][0-9]*$/);
        assert.equal(result.bundleHash, target.identity.bundleHash);
        assert.equal(result.dependencyLockHash, target.identity.dependencyLockHash);
        if (replayed) { assert.equal(result.eventId, last.eventId); assert.deepEqual(await snapshotPhase2(pool), before); }
        last = result;
      }
      const events = (await pool.query('SELECT * FROM content_activation_events WHERE namespace=$1 ORDER BY activation_revision', [namespace])).rows;
      assert.equal(events.length, revision);
      const event = events.at(-1);
      assert.equal(event.bundle_hash, last.bundleHash);
      assert.equal(event.operator_id, 'activation operator');
      assert.equal(event.policy_snapshot_json, '{"allowedProfiles":["phase2_economy"],"environment":"test"}');
      const selectedTarget = [a, b, a, c][revision - 1];
      assert.equal(event.report_hashes_json, JSON.stringify({ economy: selectedTarget.bundle.hashes.reportHashByName.economy,
        validation: selectedTarget.bundle.hashes.reportHashByName.validation }));
      assert.equal(event.previous_bundle_hash, revision === 1 ? null : [a, b, a][revision - 2].identity.bundleHash);
      assert.equal(event.previous_dependency_lock_hash, revision === 1 ? null : [a, b, a][revision - 2].identity.dependencyLockHash);
      assert.equal(Number(event.bundle_version), selectedTarget.identity.packageVersion);
      assert.equal(event.compiler_version, 'phase2a.1');
      assert.equal(event.ir_version, 1);
      assert.equal(event.profile, 'phase2_economy');
      const pointer = (await pool.query('SELECT * FROM content_bundle_activations WHERE namespace=$1', [namespace])).rows[0];
      assert.equal(Number(pointer.activation_revision), revision);
      assert.equal(String(pointer.last_event_id), last.eventId);
      assert.equal(pointer.bundle_hash, last.bundleHash);
      const selected = (await pool.query('SELECT * FROM item_definition_activations WHERE package_id=$1 ORDER BY logical_item_id', [namespace])).rows;
      assert.deepEqual(selected.map((row) => row.logical_item_id), revision === 4 ? [] :
        (revision === 2 ? ['omerta.phase2.registry::added', 'omerta.phase2.registry::kept'] : ['omerta.phase2.registry::kept', 'omerta.phase2.registry::removed']));
      for (const row of selected) {
        assert.equal(String(row.event_id), last.eventId);
        const value = await activeDefinition(pool, row.logical_item_id);
        assert.equal(value.activationRevision, revision);
        assert.equal(value.eventId, last.eventId);
        assert.equal(value.bundleHash, last.bundleHash);
        assert(Object.isFrozen(value));
      }
      assert.deepEqual(await activeDefinition(pool, 'omerta.phase2.other::elsewhere'), foreignBefore);
      assertActivationHistory(event, { namespace, bundle_hash: selectedTarget.identity.bundleHash,
        dependency_lock_hash: selectedTarget.identity.dependencyLockHash, bundle_version: selectedTarget.identity.packageVersion,
        compiler_version: 'phase2a.1', ir_version: 1, profile: 'phase2_economy', authority_profile: 'production',
        report_hashes_json: event.report_hashes_json });
    }
    assert.equal(await activeDefinition(pool, 'omerta.phase2.registry::kept'), null);
    const intrinsic = await definitionByHash(pool, a.expectedDefinitions[1].definitionHash);
    assert.equal(intrinsic.logicalItemId, 'omerta.phase2.registry::removed');
    assert.equal(Object.hasOwn(intrinsic, 'bundleHash'), false);
  } finally { await pool.end(); }
  console.log('phase2-activation: exact CAS table, ABA, audit history and complete namespace replacement pass');
}

// Admission must not reread mutable request fields after asynchronous pool acquisition.
{
  const { pool } = await prepared();
  try {
    const entered = deferred(), release = deferred();
    const delayed = forwardPool(pool, { acquire: async () => { entered.resolve(); await release.promise; } });
    const input = request(a);
    const pending = activateStoredBundle(delayed, input, policy);
    await entered.promise;
    Object.assign(input, request(b, 50, b, 'mutated operator'));
    release.resolve();
    const result = await pending;
    assert.equal(result.bundleHash, a.identity.bundleHash);
    assert.equal(result.activationRevision, 1);
    const event = (await pool.query('SELECT * FROM content_activation_events')).rows[0];
    assert.equal(event.operator_id, 'activation operator');
  } finally { await pool.end(); }
}

// A failed deletion can leave the prior rows untouched; compensation must not insert duplicates.
{
  const { pool } = await prepared();
  try {
    await activateStoredBundle(pool, request(a), policy);
    const before = await snapshotPhase2(pool);
    let failed = false;
    const failing = forwardPool(pool, { before: async (sql) => {
      if (!failed && sql.startsWith('DELETE FROM item_definition_activations')) {
        failed = true; throw Object.assign(Error('statement aborted before deletion'), { code: '40001' });
      }
    } });
    await rejects(activateStoredBundle(failing, request(b, 1, a), policy), 'contention');
    assert.deepEqual(await snapshotPhase2(pool), before);
    assert.equal((await activateStoredBundle(pool, request(b, 1, a), policy)).activationRevision, 2);
  } finally { await pool.end(); }
}

// Exercise every potentially successful write, including the first-use placeholder and every
// selected row. The database executes each statement before its acknowledgement is interrupted.
for (const prior of [false, true]) {
  for (let failAt = 1; failAt <= (prior ? 5 : 6); failAt++) {
    const { pool } = await prepared();
    try {
      if (prior) await activateStoredBundle(pool, request(a), policy);
      else await pool.query('DELETE FROM content_bundle_activations WHERE namespace=$1', [namespace]);
      const before = await snapshotPhase2(pool);
      let writes = 0;
      const failing = forwardPool(pool, { after: async (sql) => {
        if (/^(INSERT|DELETE|UPDATE) /.test(sql) && ++writes === failAt) throw Error('write acknowledgement lost');
      } });
      const input = prior ? request(b, 1, a) : request(a);
      await rejects(activateStoredBundle(failing, input, policy), 'internal');
      assert.deepEqual(await snapshotPhase2(pool), before, `restore six tables after write ${failAt}, prior=${prior}`);
      const recovered = await activateStoredBundle(pool, input, policy);
      assert.equal(recovered.activationRevision, prior ? 2 : 1);
      assert.equal(recovered.replayed, false);
    } finally { await pool.end(); }
  }
}
console.log('phase2-activation: all eleven post-write recovery points and pre-delete abort restore exact six-table snapshots');

// COMMIT transport loss is unknown, not an abort: current predecessor CAS must recover one event.
{
  const { pool } = await prepared();
  try {
    let lost = false;
    const transport = forwardPool(pool, { after: async (sql) => {
      if (sql === 'COMMIT' && !lost) { lost = true; throw Error('COMMIT acknowledgement lost'); }
    } });
    await rejects(activateStoredBundle(transport, request(a), policy), 'content_commit_unknown');
    const committed = await snapshotPhase2(pool);
    const replay = await activateStoredBundle(pool, request(a), policy);
    assert.equal(replay.replayed, true);
    assert.equal(replay.eventId, String(committed.content_activation_events[0].id));
    assert.deepEqual(await snapshotPhase2(pool), committed);
    await rejects(activateStoredBundle(pool, request(a), createActivationPolicy({ environment: 'new_policy', allowedProfiles: [] })), 'content_activation_policy_denied');
    assert.deepEqual(await snapshotPhase2(pool), committed);
    let aborted = false;
    const precommit = forwardPool(pool, { before: async (sql) => {
      if (sql === 'COMMIT' && !aborted) { aborted = true; throw Object.assign(Error('confirmed abort'), { code: '40001' }); }
    } });
    await rejects(activateStoredBundle(precommit, request(b, 1, a), policy), 'contention');
    assert.deepEqual(await snapshotPhase2(pool), committed);
    assert.equal((await activateStoredBundle(pool, request(b, 1, a), policy)).replayed, false);
    await rejects(activateStoredBundle({ query: pool.query.bind(pool) }, request(a), policy), 'content_transaction_required');
    let retained;
    await withPhase2Transaction(forwardPool(pool), async (client) => {
      retained = client;
      await rejects(activateStoredBundle(pool, request(a), policy), 'content_transaction_nested');
    });
    await rejects(activateStoredBundle(retained, request(a), policy), 'content_transaction_required');
    await rejects(activateStoredBundle(pool, { ...request(a), selectionContext: Object.freeze({}) }, policy), 'bad_content_request');
  } finally { await pool.end(); }
}

// Both ordering directions hold the whole callback gate across distinct pool aliases.
for (const readKind of ['active', 'snapshot']) {
  const read = (q) => readKind === 'active' ? activeDefinition(q, 'omerta.phase2.registry::kept') : snapshotPhase2(q);
  const { pool } = await prepared();
  try {
    await activateStoredBundle(pool, request(a), policy);
    const entered = deferred(), release = deferred();
    const writer = forwardPool(pool, { after: async (sql) => {
      if (sql.startsWith('DELETE FROM item_definition_activations')) { entered.resolve(); await release.promise; }
    } });
    const writing = activateStoredBundle(writer, request(b, 1, a), policy);
    await entered.promise;
    const reader = forwardPool(pool);
    const reading = read(reader);
    await pause(20);
    assert.equal(reader.statements.length, 0, 'reader must not enter the unfinished writer');
    release.resolve();
    await writing;
    const observed = await reading;
    if (readKind === 'active') assert.equal(observed.activationRevision, 2);
    else assert.equal(observed.content_activation_events.filter((event) => event.namespace === namespace).length, 2);

    const readerEntered = deferred(), readerRelease = deferred();
    let first = true;
    const pausedReader = forwardPool(pool, { after: async (sql) => {
      if (sql.startsWith('SELECT') && first) { first = false; readerEntered.resolve(); await readerRelease.promise; }
    } });
    const earlierReading = read(pausedReader);
    await readerEntered.promise;
    const laterWriter = forwardPool(pool);
    const laterWriting = activateStoredBundle(laterWriter, request(a, 2, b), policy);
    await pause(20);
    assert.equal(laterWriter.statements.length, 0, 'writer must wait for the complete earlier read callback');
    readerRelease.resolve();
    const earlier = await earlierReading;
    if (readKind === 'active') assert.equal(earlier.activationRevision, 2);
    else assert.equal(earlier.content_activation_events.filter((event) => event.namespace === namespace).length, 2);
    await laterWriting;
    assert.equal((await activeDefinition(pool, 'omerta.phase2.registry::kept')).activationRevision, 3);
  } finally { await pool.end(); }
}
console.log('phase2-activation: COMMIT recovery, current-policy denial and coherent cross-alias read/write orderings pass');

// Corrupt database fixtures omit only FK enforcement, so real exact joins must detect every
// missing relation. Production schema is untouched; this models administrator-level corruption.
for (const corruption of ['membership', 'version', 'event', 'pointer', 'foreign', 'selection']) {
  const { pool } = await database({ schemaText: schema.replace(/^  CONSTRAINT p2_.* FOREIGN KEY .*\r?\n/gm, '') });
  try {
    for (const artifact of [a, b]) await storeSealedBundle(pool, artifact.request);
    await activateStoredBundle(pool, request(a), policy);
    if (corruption === 'membership') await pool.query('DELETE FROM content_bundle_item_definitions WHERE bundle_hash=$1', [a.identity.bundleHash]);
    if (corruption === 'version') await pool.query('DELETE FROM item_definition_versions WHERE definition_hash=$1', [a.expectedDefinitions[0].definitionHash]);
    if (corruption === 'event') await pool.query('DELETE FROM content_activation_events');
    if (corruption === 'pointer') await pool.query('DELETE FROM content_bundle_activations WHERE namespace=$1', [namespace]);
    if (corruption === 'foreign') await pool.query('UPDATE item_definition_activations SET package_id=$1', ['omerta.foreign']);
    if (corruption === 'selection') await pool.query('UPDATE item_definition_activations SET activation_revision=2');
    await rejects(activeDefinition(pool, 'omerta.phase2.registry::kept'), 'definition_inactive');
    const before = await snapshotPhase2(pool);
    await rejects(activateStoredBundle(pool, request(b, 1, a), policy), 'content_registry_corrupt');
    assert.deepEqual(await snapshotPhase2(pool), before);
  } finally { await pool.end(); }
}

// Public selected reads must resolve every mutable join in one statement. Its immutable read
// may follow, and caller-owned callbacks reuse the same active context without deadlock.
{
  const { pool } = await prepared();
  try {
    await activateStoredBundle(pool, request(a), policy);
    const traced = forwardPool(pool);
    await withPhase2Read(traced, (client) => activeDefinition(client, 'omerta.phase2.registry::kept'));
    assert.equal(traced.statements.filter((sql) => sql.includes('item_definition_activations')).length, 1);
    const joined = traced.statements.find((sql) => sql.includes('item_definition_activations'));
    for (const table of ['item_definition_versions', 'content_bundle_item_definitions', 'content_activation_events', 'content_bundle_activations']) assert(joined.includes(table));
    const event = (await pool.query('SELECT * FROM content_activation_events')).rows[0];
    const row = (await pool.query('SELECT * FROM content_bundle_artifacts WHERE bundle_hash=$1', [a.identity.bundleHash])).rows[0];
    for (const change of [
      { policy_snapshot_json: '{"environment":"test","allowedProfiles":["phase2_economy"]}' },
      { policy_snapshot_json: '{"allowedProfiles":[],"environment":"test"}' },
      { policy_snapshot_json: '{"allowedProfiles":["phase2_economy"],"environment":"test","extra":true}' },
      { report_hashes_json: '{}' }, { bundle_version: 99 }, { dependency_lock_hash: '0'.repeat(64) },
    ]) assert.throws(() => assertActivationHistory({ ...event, ...change }, row), (error) => error.code === 'content_registry_corrupt');
    assertActivationHistory(event, row); // A historical snapshot validates without acquiring the live brand.
    await rejects(activateStoredBundle(pool, request(a), JSON.parse(event.policy_snapshot_json)), 'content_activation_policy_invalid');
  } finally { await pool.end(); }
}
console.log('phase2-activation: corrupt selections fail closed, one exact join and canonical historical evidence pass');

// Stored dependencies pin exact immutable versions, regardless of another namespace's selection.
// compileFixture removes its temporary source tree before returning; no source path remains.
{
  const dependency = compileFixture(baseLibrary({ packageId: 'omerta.pinned.dep', exports: ['note'], definitions: [concept('note')] }));
  const newer = compileFixture(baseLibrary({ packageId: 'omerta.pinned.dep', version: 2, definitions: [
    { ...concept('note'), definitionVersion: 2, metadata: { title: 'New semantics' } }], exports: ['note'] }));
  const target = compileFixture(baseLibrary({ packageId: 'omerta.pinned.experience', kind: 'experience',
    entrypoint: 'start', nodes: [{ id: 'start', kind: 'experience', refs: ['omerta.pinned.dep::note'], adapter: { kind: 'observe', args: {} }, public: true },
      { id: 'end', kind: 'terminal', refs: [], public: true }], edges: [{ from: 'start', to: 'end', kind: 'requires' }],
    dependencies: [{ packageId: dependency.identity.packageId, version: 1, bundleHash: dependency.identity.bundleHash }],
    imports: [{ id: 'omerta.pinned.dep::note', definitionHash: dependency.expectedDefinitions[0].definitionHash,
      dependencyBundleHash: dependency.identity.bundleHash }] }), { dependencies: [dependency] });
  const { pool } = await database();
  try {
    for (const artifact of [dependency, newer, target]) await storeSealedBundle(pool, artifact.request);
    await activateStoredBundle(pool, request(newer), policy);
    const result = await activateStoredBundle(pool, request(target), policy);
    assert.equal(result.dependencyLockHash, target.identity.dependencyLockHash);
    assert.equal((await activeDefinition(pool, 'omerta.pinned.dep::note')).definitionVersion, 2);
    assert.equal((await definitionByHash(pool, dependency.expectedDefinitions[0].definitionHash)).definitionVersion, 1);
    const before = await snapshotPhase2(pool);
    for (const kind of ['missing', 'corrupt']) {
      const corrupted = forwardPool(pool, { after: async (sql, values, response) => {
        if (sql === 'SELECT * FROM content_bundle_artifacts WHERE bundle_hash=$1' && values[0] === dependency.identity.bundleHash) {
          if (kind === 'missing') response.rows = [];
          else response.rows[0] = { ...response.rows[0], canonical_bytes: Buffer.from('{}') };
        }
      } });
      await rejects(activateStoredBundle(corrupted, request(target), policy), kind === 'missing' ? 'content_dependency_unresolved' : 'content_dependency_drift');
      assert.deepEqual(await snapshotPhase2(pool), before);
    }
    let dependencyReads = 0;
    const replayTrace = forwardPool(pool, { before: async (sql, values) => {
      if (sql === 'SELECT * FROM content_bundle_artifacts WHERE bundle_hash=$1' && values[0] === dependency.identity.bundleHash) dependencyReads++;
    } });
    assert.equal((await activateStoredBundle(replayTrace, request(target), policy)).replayed, true);
    assert.equal(dependencyReads, 1, 'same-target replay must reuse its callback-bound verified closure');
  } finally { await pool.end(); }
}

// A boundary fixture presents the coherent maximum revision without inserting trillions of
// historical events. A different target must refuse before DML, while exact replay remains valid.
{
  const { pool } = await prepared();
  try {
    await activateStoredBundle(pool, request(a), policy);
    const before = await snapshotPhase2(pool);
    const maximum = forwardPool(pool, { after: async (sql, _values, response) => {
      if (sql.startsWith('SELECT') && (sql.includes('content_bundle_activations')
          || sql.includes('content_activation_events') || sql.includes('item_definition_activations'))) {
        response.rows = response.rows.map((row) => ({ ...row, activation_revision: String(Number.MAX_SAFE_INTEGER) }));
      }
    } });
    await rejects(activateStoredBundle(maximum, request(b, Number.MAX_SAFE_INTEGER, a), policy), 'content_activation_conflict');
    assert.equal(maximum.statements.filter((sql) => /^(INSERT|UPDATE|DELETE) /.test(sql)).length, 0);
    const replay = await activateStoredBundle(maximum, request(a, Number.MAX_SAFE_INTEGER, a), policy);
    assert.equal(replay.activationRevision, Number.MAX_SAFE_INTEGER);
    assert.equal(replay.replayed, true);
    assert.deepEqual(await snapshotPhase2(pool), before);
  } finally { await pool.end(); }
}
console.log('phase2-activation: production experiences, exact pinned dependencies and safe revision ceiling pass');

// Namespace punctuation is literal ownership, never a wildcard over another namespace.
{
  const exact = compileFixture(baseLibrary({ packageId: 'omerta.under_score', definitions: [concept('note')] }));
  const neighbor = compileFixture(baseLibrary({ packageId: 'omerta.underxscore', definitions: [concept('note')] }));
  const { pool } = await database();
  try {
    for (const artifact of [exact, neighbor]) await storeSealedBundle(pool, artifact.request);
    await activateStoredBundle(pool, request(neighbor), policy);
    assert.equal((await activateStoredBundle(pool, request(exact), policy)).activationRevision, 1);
    assert.equal((await activeDefinition(pool, 'omerta.underxscore::note')).activationRevision, 1);
  } finally { await pool.end(); }
}

// Q1: once the mutable join has succeeded, an immutable SELECT failure is still operational.
// A blanket content-refusal catch would hide retryable SQLSTATE and transport failures.
{
  const { pool } = await prepared();
  try {
    await activateStoredBundle(pool, request(a), policy);
    const before = await snapshotPhase2(pool);
    for (const mode of ['pool read', 'owned mutation']) {
      for (const [code, expected] of [['40001', 'contention'], ['40P01', 'contention'],
        ['55P03', 'contention'], ['ECONNRESET', 'internal'], ['absent', 'definition_inactive'],
        ['corrupt', 'definition_inactive']]) {
        let joined = false, injected = false, releases = 0;
        const failing = forwardPool(pool, { after: async (sql, _values, response) => {
          if (sql.startsWith('SELECT s.*')) {
            assert.equal(response.rows[0].joined_version, a.expectedDefinitions[0].definitionHash);
            assert(response.rows[0].joined_member && response.rows[0].joined_event && response.rows[0].joined_pointer);
            joined = true;
          }
          if (sql === 'SELECT * FROM item_definition_versions WHERE definition_hash=$1') {
            assert(joined, 'failure must occur after the real complete joined selection succeeds');
            injected = true;
            if (code === 'absent') response.rows = [];
            else if (code === 'corrupt') response.rows[0] = { ...response.rows[0], canonical_definition_bytes: Buffer.from('{}') };
            else throw Object.assign(Error('private database failure'), { code });
          }
        } });
        const connect = failing.connect.bind(failing);
        failing.connect = async () => {
          const client = await connect();
          const release = client.release.bind(client);
          client.release = (...args) => { release(...args); releases++; };
          return client;
        };
        const reading = mode === 'pool read'
          ? activeDefinition(failing, 'omerta.phase2.registry::kept')
          : withPhase2Transaction(failing, async (client) => {
            registerPhase2Undo(client, () => client.query('UPDATE content_bundle_activations SET activated_by=$2 WHERE namespace=$1',
              [namespace, 'activation operator']));
            await client.query('UPDATE content_bundle_activations SET activated_by=$2 WHERE namespace=$1', [namespace, 'temporary audit value']);
            return activeDefinition(client, 'omerta.phase2.registry::kept');
          });
        await rejects(reading, expected);
        assert(injected);
        assert.equal(failing.statements.includes('COMMIT'), false);
        assert.equal(failing.statements.includes('ROLLBACK'), mode === 'owned mutation');
        assert.equal(releases, mode === 'owned mutation' ? 1 : 0, 'owned client is released before rejection');
        assert.deepEqual(await snapshotPhase2(pool), before, `${mode}/${code} preserves all six tables`);
        assert.equal((await activeDefinition(pool, 'omerta.phase2.registry::kept')).activationRevision, 1,
          'the whole-callback gate and selected state remain usable after rejection');
      }
    }
  } finally { await pool.end(); }
}
console.log('phase2-activation: immutable-read operational failures preserve boundary mapping and cleanup; intrinsic refusals remain inactive');
