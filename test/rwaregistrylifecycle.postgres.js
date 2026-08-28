import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';

const databaseUrl = process.env.RWA_REGISTRY_LIFECYCLE_TEST_DATABASE_URL;
if (!databaseUrl) {
  assert.notEqual(process.env.CI, 'true',
    'RWA_REGISTRY_LIFECYCLE_TEST_DATABASE_URL is required when the real-PostgreSQL CN-6A lane runs in CI');
  console.log('SKIP RWA Registry lifecycle real PostgreSQL: RWA_REGISTRY_LIFECYCLE_TEST_DATABASE_URL is not set');
  process.exitCode = 0;
} else {
  const parsed = new URL(databaseUrl);
  assert(['postgres:', 'postgresql:'].includes(parsed.protocol) && parsed.pathname.slice(1),
    'RWA_REGISTRY_LIFECYCLE_TEST_DATABASE_URL must name an explicit PostgreSQL database');

  const lifecycle = await import('../src/rwaregistrylifecycle.js');
  const expectedExports = Object.freeze([
    'applyFinalizedRwaActivationEvents',
    'applyFinalizedRwaBallotEvents',
    'compareFinalizedRwaActivationV2',
    'readFinalizedRwaLifecycleHeadV2',
    'requireFinalizedRwaActivationV2',
    'syncFinalizedRwaRegistryLifecycle',
  ]);
  assert.deepEqual(Object.keys(lifecycle).filter((name) => !name.startsWith('__')).sort(), expectedExports,
    'CN-6A RED: production module must expose only the six frozen surfaces');
  for (const name of expectedExports) {
    assert.equal(typeof lifecycle[name], 'function', `CN-6A RED: ${name} export is absent`);
  }

  const {
    applyFinalizedRwaActivationEvents,
    readFinalizedRwaLifecycleHeadV2,
  } = lifecycle;
  const schemaName = `rwa_registry_lifecycle_cn6a_${randomUUID().replaceAll('-', '')}`;
  assert.match(schemaName, /^rwa_registry_lifecycle_cn6a_[a-f0-9]{32}$/);
  const quotedSchema = `"${schemaName}"`;
  const admin = new Pool({ connectionString: databaseUrl, max: 2 });
  let pool;

  const h = (digit) => `0x${digit.repeat(64)}`;
  const address = (digit) => `0x${digit.repeat(40)}`;
  const consumerKey = 'rwa_registry_lifecycle_v2';
  const keyA = h('1');
  const keyB = h('2');
  const keyC = h('3');

  async function assertBlocked(promise, message) {
    const pending = Symbol('pending');
    const result = await Promise.race([
      promise.then(() => 'settled', () => 'settled'),
      new Promise((resolve) => setTimeout(() => resolve(pending), 150)),
    ]);
    assert.equal(result, pending, message);
  }

  async function rollback(client) {
    await client.query('ROLLBACK').catch(() => {});
  }

  async function lockTask5AndLifecycle(client, lifecycleMode = 'UPDATE') {
    assert(['SHARE', 'UPDATE'].includes(lifecycleMode));
    await client.query('SELECT id FROM stock_catalog_sync_lock_v2 WHERE id=1 FOR SHARE');
    await client.query(`SELECT id FROM rwa_registry_lifecycle_lock_v2 WHERE id=1 FOR ${lifecycleMode}`);
    await client.query(`SELECT consumer_key FROM rwa_registry_lifecycle_checkpoint_v2
      WHERE consumer_key=$1 FOR ${lifecycleMode}`, [consumerKey]);
    await client.query(`SELECT id FROM rwa_registry_lifecycle_runtime_v2
      WHERE id=1 FOR ${lifecycleMode}`);
  }

  function registered(assetVersionKey, digit, order = {}) {
    return Object.freeze({
      kind: 'AssetVersionRegistered',
      blockNumber: order.blockNumber ?? '100',
      blockHash: order.blockHash ?? h('a'),
      blockTimestamp: order.blockTimestamp ?? '1000',
      transactionHash: order.transactionHash ?? h('b'),
      transactionIndex: order.transactionIndex ?? '0',
      logIndex: order.logIndex ?? '0',
      assetVersionKey,
      tickerHash: h(digit),
      tokenAddress: address(digit),
      robinhoodAssetIdHash: h(digit === 'f' ? 'e' : String(Number.parseInt(digit, 16) + 1).toString(16)),
      ticker: `T${digit.toUpperCase()}`,
      name: `Token ${digit.toUpperCase()}`,
      tokenDecimals: 18,
      registeredAt: order.blockTimestamp ?? '1000',
    });
  }

  function statementRecorder(client, statements) {
    return {
      query(sql, params) {
        statements.push(String(sql).replace(/\s+/g, ' ').trim());
        return client.query(sql, params);
      },
    };
  }

  function firstStatement(statements, pattern, description) {
    const index = statements.findIndex((sql) => pattern.test(sql));
    assert.notEqual(index, -1, `CN-6A RED: missing ${description}`);
    return index;
  }

  async function tableJson(table, where, values = []) {
    const result = await pool.query(`SELECT to_jsonb(row_value) AS value FROM (
      SELECT * FROM ${table} WHERE ${where}
    ) AS row_value`, values);
    assert.equal(result.rowCount, 1, `expected one ${table} fixture row`);
    return result.rows[0].value;
  }

  try {
    await admin.query(`CREATE SCHEMA ${quotedSchema}`);
    pool = new Pool({
      connectionString: databaseUrl,
      max: 14,
      options: `-c search_path=${schemaName},public -c statement_timeout=250000 -c lock_timeout=5000`,
    });
    await pool.query(await readFile(new URL('../schema.sql', import.meta.url), 'utf8'));

    const expectedTables = Object.freeze([
      'rwa_registry_activation_instances_v2',
      'rwa_registry_asset_lifecycle_current_v2',
      'rwa_registry_ballot_events_v2',
      'rwa_registry_lifecycle_attempts_v2',
      'rwa_registry_lifecycle_checkpoint_v2',
      'rwa_registry_lifecycle_event_results_v2',
      'rwa_registry_lifecycle_inbox_v2',
      'rwa_registry_lifecycle_lock_v2',
      'rwa_registry_lifecycle_runtime_v2',
      'rwa_registry_publisher_current_v2',
      'rwa_registry_publisher_history_v2',
    ]);
    const actualTables = (await pool.query(`SELECT tablename FROM pg_tables
      WHERE schemaname=current_schema() AND tablename LIKE 'rwa_registry_%'`)).rows
      .map((row) => row.tablename);
    for (const table of expectedTables) {
      assert(actualTables.includes(table), `CN-6A RED: missing ${table}`);
    }

    const controlRows = await Promise.all([
      pool.query('SELECT id FROM rwa_registry_lifecycle_lock_v2 WHERE id=1'),
      pool.query(`SELECT consumer_key FROM rwa_registry_lifecycle_checkpoint_v2
        WHERE consumer_key=$1`, [consumerKey]),
      pool.query('SELECT id FROM rwa_registry_lifecycle_runtime_v2 WHERE id=1'),
    ]);
    for (const row of controlRows) assert.equal(row.rowCount, 1, 'CN-6A control row must be seeded once');

    const constraintRows = (await pool.query(`SELECT c.relname AS table_name,
        con.contype,pg_get_constraintdef(con.oid) AS definition
      FROM pg_constraint con
      JOIN pg_class c ON c.oid=con.conrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname=current_schema() AND c.relname=ANY($1::text[])
      ORDER BY c.relname,con.conname`, [expectedTables])).rows;
    const constraintsFor = (table) => constraintRows
      .filter((row) => row.table_name === table)
      .map((row) => `${row.contype}:${row.definition}`.toLowerCase());
    const requireConstraint = (table, pattern, message) => {
      assert(constraintsFor(table).some((definition) => pattern.test(definition)),
        `CN-6A RED: ${message}`);
    };

    requireConstraint('rwa_registry_lifecycle_lock_v2', /^p:primary key \(id\)$/,
      'lifecycle singleton needs an id primary key');
    requireConstraint('rwa_registry_lifecycle_lock_v2', /^c:check .*id.*=.*1/,
      'lifecycle singleton must reject every id except 1');
    requireConstraint('rwa_registry_lifecycle_checkpoint_v2',
      /^p:primary key \(consumer_key\)$/,
      'checkpoint identity must be unique by frozen consumer key');
    requireConstraint('rwa_registry_lifecycle_inbox_v2',
      /^(?:p|u):.*chain_id.*contract_address.*block_hash.*transaction_hash.*log_index/,
      'inbox needs the five-part immutable FO log identity');
    requireConstraint('rwa_registry_activation_instances_v2',
      /^(?:p|u):.*chain_id.*registry_address.*asset_version_key.*activation_generation/,
      'activation generations must be unique inside one chain and Registry');
    requireConstraint('rwa_registry_lifecycle_attempts_v2', /^p:primary key \(attempt_id\)$/,
      'attempt IDs must be unique');
    for (const status of ['started', 'succeeded', 'failed', 'superseded']) {
      requireConstraint('rwa_registry_lifecycle_attempts_v2',
        new RegExp(`^c:check .*${status}`), `attempt status constraint must include ${status}`);
    }
    requireConstraint('rwa_registry_lifecycle_runtime_v2', /^c:check .*id.*=.*1/,
      'runtime must be a singleton');
    requireConstraint('rwa_registry_lifecycle_runtime_v2',
      /^c:check .*sync_in_progress.*attempt_id/,
      'runtime must constrain in-progress state to an attempt identity');

    await assert.rejects(
      () => pool.query('INSERT INTO rwa_registry_lifecycle_lock_v2 (id) VALUES (2)'),
      /check constraint|violates/i,
      'lifecycle singleton accepted id 2',
    );
    await assert.rejects(
      () => pool.query(`INSERT INTO rwa_registry_lifecycle_attempts_v2
        (attempt_id,status,started_at) VALUES ('invalid-attempt','unknown',clock_timestamp())`),
      /check constraint|violates/i,
      'attempt table accepted an open-ended status',
    );

    const seed = await pool.connect();
    try {
      await seed.query('BEGIN');
      await applyFinalizedRwaActivationEvents(seed, Object.freeze([
        registered(keyA, '4', { logIndex: '0' }),
        registered(keyB, '6', { logIndex: '1' }),
      ]));
      await seed.query('COMMIT');
    } finally {
      await rollback(seed);
      seed.release();
    }
    assert.equal((await pool.query(`SELECT COUNT(*) AS count
      FROM rwa_registry_asset_lifecycle_current_v2 WHERE asset_version_key=ANY($1::text[])`,
    [[keyA, keyB]])).rows[0].count, '2', 'registration fixtures must create two domain rows');

    // The Task-5 share precedes every CN control and domain lock. A Registry writer and
    // contenders at each downstream row must wait until that exact lock chain commits.
    const chainHolder = await pool.connect();
    const registryWriter = await pool.connect();
    const singletonContender = await pool.connect();
    const checkpointContender = await pool.connect();
    const runtimeContender = await pool.connect();
    const domainContender = await pool.connect();
    try {
      await chainHolder.query('BEGIN');
      await lockTask5AndLifecycle(chainHolder);
      const heldKeys = (await chainHolder.query(`SELECT asset_version_key
        FROM rwa_registry_asset_lifecycle_current_v2
        WHERE asset_version_key=ANY($1::text[])
        ORDER BY asset_version_key FOR UPDATE`, [[keyB, keyA]])).rows
        .map((row) => row.asset_version_key);
      assert.deepEqual(heldKeys, [keyA, keyB], 'domain locks must be acquired in stable key order');

      for (const client of [registryWriter, singletonContender, checkpointContender,
        runtimeContender, domainContender]) await client.query('BEGIN');
      const waits = [
        [registryWriter.query('SELECT id FROM stock_catalog_sync_lock_v2 WHERE id=1 FOR UPDATE'),
          'Task-5 writer did not wait behind the CN-6A share lock'],
        [singletonContender.query('SELECT id FROM rwa_registry_lifecycle_lock_v2 WHERE id=1 FOR SHARE'),
          'lifecycle singleton was not held through the apply transaction'],
        [checkpointContender.query(`SELECT consumer_key FROM rwa_registry_lifecycle_checkpoint_v2
          WHERE consumer_key=$1 FOR SHARE`, [consumerKey]),
        'checkpoint was not held through the apply transaction'],
        [runtimeContender.query('SELECT id FROM rwa_registry_lifecycle_runtime_v2 WHERE id=1 FOR SHARE'),
          'runtime row was not held through the apply transaction'],
        [domainContender.query(`SELECT asset_version_key
          FROM rwa_registry_asset_lifecycle_current_v2 WHERE asset_version_key=$1 FOR UPDATE`, [keyA]),
        'domain row was not held through the apply transaction'],
      ];
      for (const [promise, message] of waits) await assertBlocked(promise, message);
      await chainHolder.query('COMMIT');
      await Promise.all(waits.map(([promise]) => promise));
      for (const client of [registryWriter, singletonContender, checkpointContender,
        runtimeContender, domainContender]) await client.query('ROLLBACK');
    } finally {
      for (const client of [chainHolder, registryWriter, singletonContender,
        checkpointContender, runtimeContender, domainContender]) {
        await rollback(client);
        client.release();
      }
    }

    // Reverse direction: CN-6A cannot pass an active Task-5 Registry writer.
    const upstreamWriter = await pool.connect();
    const lifecycleReader = await pool.connect();
    try {
      await upstreamWriter.query('BEGIN');
      await upstreamWriter.query('SELECT id FROM stock_catalog_sync_lock_v2 WHERE id=1 FOR UPDATE');
      await lifecycleReader.query('BEGIN');
      const share = lifecycleReader.query(
        'SELECT id FROM stock_catalog_sync_lock_v2 WHERE id=1 FOR SHARE');
      await assertBlocked(share, 'CN-6A passed an active Task-5 Registry writer');
      await upstreamWriter.query('COMMIT');
      await share;
      await lifecycleReader.query('ROLLBACK');
    } finally {
      await rollback(upstreamWriter);
      await rollback(lifecycleReader);
      upstreamWriter.release();
      lifecycleReader.release();
    }

    // The production readiness seam must use the caller-owned client and hold all three
    // CN control rows FOR SHARE even when the initialized consumer is not yet ready.
    const readiness = await pool.connect();
    const startWriter = await pool.connect();
    try {
      const issued = [];
      const recordingClient = statementRecorder(readiness, issued);
      await recordingClient.query('BEGIN');
      await recordingClient.query('SELECT id FROM stock_catalog_sync_lock_v2 WHERE id=1 FOR SHARE');
      await assert.rejects(() => readFinalizedRwaLifecycleHeadV2(recordingClient),
        (error) => typeof error?.code === 'string' && error.code.startsWith('rwa_lifecycle_'),
        'an unready lifecycle head must fail closed');

      const task5 = firstStatement(issued,
        /stock_catalog_sync_lock_v2 .*FOR SHARE/i, 'Task-5 Registry share lock');
      const singleton = firstStatement(issued,
        /rwa_registry_lifecycle_lock_v2 .*FOR SHARE/i, 'lifecycle singleton FOR SHARE');
      const checkpoint = firstStatement(issued,
        /rwa_registry_lifecycle_checkpoint_v2 .*FOR SHARE/i, 'checkpoint FOR SHARE');
      const runtime = firstStatement(issued,
        /rwa_registry_lifecycle_runtime_v2 .*FOR SHARE/i, 'runtime FOR SHARE');
      assert(task5 < singleton && singleton < checkpoint && checkpoint < runtime,
        'CN-6A readiness lock order must be Task-5 -> singleton -> checkpoint -> runtime');

      await startWriter.query('BEGIN');
      const startLock = startWriter.query(
        'SELECT id FROM rwa_registry_lifecycle_lock_v2 WHERE id=1 FOR UPDATE');
      await assertBlocked(startLock,
        'attempt start/takeover FOR UPDATE did not wait behind readiness FOR SHARE');
      await readiness.query('ROLLBACK');
      await startLock;
      await startWriter.query('ROLLBACK');
    } finally {
      await rollback(readiness);
      await rollback(startWriter);
      readiness.release();
      startWriter.release();
    }

    await pool.query(`INSERT INTO rwa_registry_lifecycle_attempts_v2
      (attempt_id,status,started_at) VALUES ('attempt-old','started',clock_timestamp())`);
    await pool.query(`UPDATE rwa_registry_lifecycle_runtime_v2 SET
      sync_in_progress=true,attempt_id='attempt-old',
      last_attempt_at=clock_timestamp()-INTERVAL '300 seconds',ready_verified_at=NULL
      WHERE id=1`);

    // An old worker applying or recording failure owns the same write locks, so takeover
    // cannot interleave. Once takeover wins, both old attempt CAS paths are inert.
    const oldWriter = await pool.connect();
    const takeover = await pool.connect();
    try {
      await oldWriter.query('BEGIN');
      await lockTask5AndLifecycle(oldWriter);
      assert.equal((await oldWriter.query(
        'SELECT attempt_id FROM rwa_registry_lifecycle_runtime_v2 WHERE id=1')).rows[0].attempt_id,
      'attempt-old');

      await takeover.query('BEGIN');
      await takeover.query('SELECT id FROM stock_catalog_sync_lock_v2 WHERE id=1 FOR SHARE');
      const takeoverLock = takeover.query(
        'SELECT id FROM rwa_registry_lifecycle_lock_v2 WHERE id=1 FOR UPDATE');
      await assertBlocked(takeoverLock, 'takeover interleaved with old apply/failure writer');
      await oldWriter.query('ROLLBACK');
      await takeoverLock;
      await takeover.query(`SELECT consumer_key FROM rwa_registry_lifecycle_checkpoint_v2
        WHERE consumer_key=$1 FOR UPDATE`, [consumerKey]);
      await takeover.query('SELECT id FROM rwa_registry_lifecycle_runtime_v2 WHERE id=1 FOR UPDATE');
      await takeover.query(`UPDATE rwa_registry_lifecycle_attempts_v2
        SET status='superseded' WHERE attempt_id='attempt-old' AND status='started'`);
      await takeover.query(`INSERT INTO rwa_registry_lifecycle_attempts_v2
        (attempt_id,status,started_at) VALUES ('attempt-new','started',clock_timestamp())`);
      const takeoverResult = await takeover.query(`UPDATE rwa_registry_lifecycle_runtime_v2 SET
        attempt_id='attempt-new',sync_in_progress=true,last_attempt_at=clock_timestamp(),
        ready_verified_at=NULL WHERE id=1 AND attempt_id='attempt-old' RETURNING id`);
      assert.equal(takeoverResult.rowCount, 1, 'fresh takeover CAS did not install its attempt');
      await takeover.query('COMMIT');
    } finally {
      await rollback(oldWriter);
      await rollback(takeover);
      oldWriter.release();
      takeover.release();
    }

    for (const seam of ['success', 'failure']) {
      const stale = await pool.connect();
      try {
        await stale.query('BEGIN');
        await lockTask5AndLifecycle(stale);
        const domainBefore = await tableJson('rwa_registry_asset_lifecycle_current_v2',
          'asset_version_key=$1', [keyA]);
        const cas = await stale.query(`UPDATE rwa_registry_lifecycle_runtime_v2
          SET ready_verified_at=NULL
          WHERE id=1 AND sync_in_progress=true AND attempt_id='attempt-old'
          RETURNING id`);
        assert.equal(cas.rowCount, 0, `old-attempt ${seam} CAS mutated the winning runtime`);
        const domainAfter = await tableJson('rwa_registry_asset_lifecycle_current_v2',
          'asset_version_key=$1', [keyA]);
        assert.deepEqual(domainAfter, domainBefore,
          `old-attempt ${seam} path reached domain mutation after losing CAS`);
        await stale.query('ROLLBACK');
      } finally {
        await rollback(stale);
        stale.release();
      }
    }
    assert.equal((await pool.query(
      'SELECT attempt_id FROM rwa_registry_lifecycle_runtime_v2 WHERE id=1')).rows[0].attempt_id,
    'attempt-new', 'old attempt replaced the takeover winner');

    // A simulated process crash rolls back reducer, runtime, and checkpoint state as one unit.
    const checkpointBefore = await tableJson('rwa_registry_lifecycle_checkpoint_v2',
      'consumer_key=$1', [consumerKey]);
    const runtimeBefore = await tableJson('rwa_registry_lifecycle_runtime_v2', 'id=1');
    const crash = await pool.connect();
    try {
      await crash.query('BEGIN');
      await lockTask5AndLifecycle(crash);
      await applyFinalizedRwaActivationEvents(crash, Object.freeze([
        registered(keyC, '8', {
          blockNumber: '101', blockHash: h('c'), blockTimestamp: '1001',
          transactionHash: h('d'), logIndex: '0',
        }),
      ]));
      await crash.query(`UPDATE rwa_registry_lifecycle_runtime_v2
        SET ready_verified_at=NULL WHERE id=1 AND attempt_id='attempt-new'`);
      await crash.query(`UPDATE rwa_registry_lifecycle_checkpoint_v2
        SET caught_up=false WHERE consumer_key=$1`, [consumerKey]);
      assert.equal((await crash.query(`SELECT COUNT(*) AS count
        FROM rwa_registry_asset_lifecycle_current_v2 WHERE asset_version_key=$1`, [keyC])).rows[0].count,
      '1', 'crash fixture did not reach the domain seam');
      await crash.query('ROLLBACK');
    } finally {
      await rollback(crash);
      crash.release();
    }
    assert.equal((await pool.query(`SELECT COUNT(*) AS count
      FROM rwa_registry_asset_lifecycle_current_v2 WHERE asset_version_key=$1`, [keyC])).rows[0].count,
    '0', 'crashed reducer domain row survived rollback');
    assert.deepEqual(await tableJson('rwa_registry_lifecycle_checkpoint_v2',
      'consumer_key=$1', [consumerKey]), checkpointBefore, 'checkpoint survived crash rollback');
    assert.deepEqual(await tableJson('rwa_registry_lifecycle_runtime_v2', 'id=1'), runtimeBefore,
      'runtime survived crash rollback');

    // Reversed caller input still locks multiple assets by the same ascending key order.
    const sortedFirst = await pool.connect();
    const sortedSecond = await pool.connect();
    try {
      await sortedFirst.query('BEGIN');
      await sortedSecond.query('BEGIN');
      const firstRows = (await sortedFirst.query(`SELECT asset_version_key
        FROM rwa_registry_asset_lifecycle_current_v2
        WHERE asset_version_key=ANY($1::text[])
        ORDER BY asset_version_key FOR UPDATE`, [[keyB, keyA]])).rows
        .map((row) => row.asset_version_key);
      assert.deepEqual(firstRows, [keyA, keyB]);
      const secondLock = sortedSecond.query(`SELECT asset_version_key
        FROM rwa_registry_asset_lifecycle_current_v2
        WHERE asset_version_key=ANY($1::text[])
        ORDER BY asset_version_key FOR UPDATE`, [[keyA, keyB]]);
      await assertBlocked(secondLock, 'second multi-asset writer did not wait on the stable first key');
      await sortedFirst.query('COMMIT');
      assert.deepEqual((await secondLock).rows.map((row) => row.asset_version_key), [keyA, keyB]);
      await sortedSecond.query('ROLLBACK');
    } finally {
      await rollback(sortedFirst);
      await rollback(sortedSecond);
      sortedFirst.release();
      sortedSecond.release();
    }

    console.log('PASS RWA Registry lifecycle real PostgreSQL: lock order, readiness/takeover, CAS, constraints, rollback, sorted domain locks');
  } finally {
    if (pool) await pool.end().catch(() => {});
    await admin.query(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`).catch(() => {});
    await admin.end().catch(() => {});
  }
}
