import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { getAddress, keccak256, stringToHex, toBytes } from 'viem';
import {
  __setStockTokenRegistryV2Reader,
  computeStockAssetVersionKey,
  syncFinalizedStockCatalogV2,
} from '../src/stockcatalogv2.js';

const databaseUrl = process.env.RWA_HEALTH_TEST_DATABASE_URL;
if (!databaseUrl) {
  assert.notEqual(process.env.CI, 'true',
    'RWA_HEALTH_TEST_DATABASE_URL is required when the real-PostgreSQL H1 lane runs in CI');
  console.log('SKIP rwa health real PostgreSQL: RWA_HEALTH_TEST_DATABASE_URL is not set');
  process.exitCode = 0;
} else {
  const parsed = new URL(databaseUrl);
  assert(['postgres:', 'postgresql:'].includes(parsed.protocol) && parsed.pathname.slice(1),
    'RWA_HEALTH_TEST_DATABASE_URL must name an explicit PostgreSQL database');

  const { dbCaps } = await import('../src/db.js');
  dbCaps.skipLocked = true;
  const { sweepRwaHealth } = await import('../src/rwahealthsweep.js');
  const { requireFreshRwaHealth } = await import('../src/rwahealthread.js');
  assert.equal(typeof sweepRwaHealth, 'function', 'H1 RED: sweepRwaHealth export is absent');
  assert.equal(typeof requireFreshRwaHealth, 'function', 'H1 RED: requireFreshRwaHealth export is absent');

  const schemaName = `rwa_health_h1_${randomUUID().replaceAll('-', '')}`;
  assert.match(schemaName, /^rwa_health_h1_[a-f0-9]{32}$/);
  const quotedSchema = `"${schemaName}"`;
  const admin = new Pool({ connectionString: databaseUrl, max: 2 });
  let pool;

  const h = (digit) => `0x${digit.repeat(64)}`;
  const address = (digit) => `0x${digit.repeat(40)}`;

  async function assertBlocked(promise, message) {
    const marker = Symbol('pending');
    const result = await Promise.race([
      promise.then(() => 'settled', () => 'settled'),
      new Promise((resolve) => setTimeout(() => resolve(marker), 150)),
    ]);
    assert.equal(result, marker, message);
  }

  function recordingPool(base, statements) {
    const record = (sql) => statements.push(String(sql).replace(/\s+/g, ' ').trim());
    return {
      query(sql, params) { record(sql); return base.query(sql, params); },
      async connect() {
        const client = await base.connect();
        return {
          query(sql, params) { record(sql); return client.query(sql, params); },
          release() { client.release(); },
        };
      },
    };
  }

  try {
    await admin.query(`CREATE SCHEMA ${quotedSchema}`);
    pool = new Pool({
      connectionString: databaseUrl,
      max: 12,
      options: `-c search_path=${schemaName},public -c statement_timeout=250000 -c lock_timeout=5000`,
    });
    await pool.query(await readFile(new URL('../schema.sql', import.meta.url), 'utf8'));

    const relations = (await pool.query(`SELECT tablename FROM pg_tables
      WHERE schemaname=current_schema() AND tablename LIKE 'rwa_health_%' ORDER BY tablename`)).rows
      .map((row) => row.tablename);
    for (const table of [
      'rwa_health_apply_lock_v2', 'rwa_health_runtime_v2', 'rwa_health_batches_v2',
      'rwa_health_private_provider_evidence_v2', 'rwa_health_pages_v2',
      'rwa_health_evaluations_v2', 'rwa_health_reviewer_actions_v2',
      'rwa_health_episodes_v2', 'rwa_health_episode_events_v2', 'rwa_health_current_v2',
    ]) assert(relations.includes(table), `H1 RED: missing ${table}`);

    // PostgreSQL must enforce Registry -> H1 lock order in both directions.
    const holder = await pool.connect();
    const writer = await pool.connect();
    try {
      await holder.query('BEGIN');
      await holder.query('SELECT id FROM stock_catalog_sync_lock_v2 WHERE id=1 FOR SHARE');
      await holder.query('SELECT id FROM rwa_health_apply_lock_v2 WHERE id=1 FOR UPDATE');
      await writer.query('BEGIN');
      const writerLock = writer.query('SELECT id FROM stock_catalog_sync_lock_v2 WHERE id=1 FOR UPDATE');
      await assertBlocked(writerLock, 'Registry writer must wait behind H1 share lock');
      await holder.query('COMMIT');
      await writerLock;
      await writer.query('ROLLBACK');

      await writer.query('BEGIN');
      await writer.query('SELECT id FROM stock_catalog_sync_lock_v2 WHERE id=1 FOR UPDATE');
      await holder.query('BEGIN');
      const healthShare = holder.query('SELECT id FROM stock_catalog_sync_lock_v2 WHERE id=1 FOR SHARE');
      await assertBlocked(healthShare, 'H1 must wait behind active Registry writer');
      await writer.query('COMMIT');
      await healthShare;
      await holder.query('ROLLBACK');
    } finally {
      await holder.query('ROLLBACK').catch(() => {});
      await writer.query('ROLLBACK').catch(() => {});
      holder.release();
      writer.release();
    }

    // The action seam must be client-scoped and reject malformed input before its first query.
    let queries = 0;
    const noQueryClient = { async query() { queries += 1; throw new Error('unexpected query'); } };
    await assert.rejects(
      () => requireFreshRwaHealth(noQueryClient, h('1'), {
        expectedEvaluationId: h('2'), purpose: 'ballot_publication',
        expectedEpisodeGeneration: null, expectedStateSequence: '1',
        expectedEpisodeEventId: null, expectedMaterialEvidenceHash: null, extra: true,
      }),
      (error) => error?.code === 'health_bad_input',
    );
    assert.equal(queries, 0, 'bad action shape reached the database');

    // Real PostgreSQL constraint smoke: private bytes cannot self-attest a different commitment.
    await pool.query(`INSERT INTO rwa_health_batches_v2
      (batch_id,chain_id,registry_address,catalog_version,catalog_snapshot_hash,active_set_hash,
       rule_set_hash,provider_endpoint_hash,provider_commitment,cycle_slot,source_state,failure_code,
       observed_at,fetch_completed_at,active_version_count,declared_page_count,status,completed_at)
      VALUES ($1,4663,$2,1,$3,$4,$5,$6,$7,1,'observed',NULL,now(),now(),0,0,'complete',now())`,
    [h('1'), address('1'), h('2'), h('3'), h('4'), h('5'), h('6')]);
    await assert.rejects(
      () => pool.query(`INSERT INTO rwa_health_private_provider_evidence_v2
        (batch_id,raw_body_hash,source_state,byte_count,body_bytes,captured_at,retain_until)
        VALUES ($1,$2,'observed',2,$3,now(),now()+interval '35 days')`, [h('1'), h('7'), Buffer.from('{}')]),
      /foreign key|violates/i,
      'private bytes with a substituted commitment must fail',
    );

    // A full implementation must sustain the frozen 2,048-version budget. The fixture deliberately
    // supplies a bounded, valid response; missing Registry setup/runner behavior is authoritative RED.
    const providerAssets = [];
    const catalogAssets = [];
    for (let index = 0; index < 2048; index += 1) {
      const id = `0x${index.toString(16).padStart(64, '0')}`;
      const ticker = `T${index}`;
      const tokenAddress = getAddress(`0x${(index + 1).toString(16).padStart(40, '0')}`);
      const robinhoodAssetIdHash = keccak256(stringToHex(id));
      const catalogAsset = {
        chainId: '4663', ticker, tickerHash: keccak256(toBytes(ticker)), name: `${ticker} Token`,
        tokenAddress, tokenDecimals: 18, robinhoodAssetIdHash, registryIndex: String(index), active: true,
        registeredAt: '1787680000', activatedAt: '1787690000', deactivatedAt: '0',
      };
      catalogAsset.assetVersionKey = computeStockAssetVersionKey(catalogAsset);
      catalogAssets.push(catalogAsset);
      providerAssets.push({
        id, tokenSymbol: ticker,
        deployments: [{ chainId: 4663, contractAddress: tokenAddress }],
        status: 'ASSET_STATUS_ACTIVE',
        tradingCapabilities: { fractionalTradability: 'tradable' }, tokenDecimals: 18,
      });
    }
    const heads = (field) => catalogAssets.map((asset) => ({
      dimensionValue: asset[field], assetVersionKey: asset.assetVersionKey,
    }));
    const registryAddress = getAddress(address('9'));
    process.env.CHAIN_RPC_URL = 'https://rwa-health-postgres.invalid/rpc';
    process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS = registryAddress;
    process.env.STOCK_TOKEN_REGISTRY_V2_START_BLOCK = '1';
    __setStockTokenRegistryV2Reader(async () => ({
      source: 'robinhood_chain_registry_v2', finality: 'finalized', chainId: '4663',
      registryAddress, catalogVersion: String(catalogAssets.length), finalizedBlockNumber: '100',
      finalizedBlockHash: h('f'), observedAt: '1787700000', assets: catalogAssets,
      activeHeads: {
        tickerHash: heads('tickerHash'), tokenAddress: heads('tokenAddress'),
        robinhoodAssetIdHash: heads('robinhoodAssetIdHash'),
      },
    }));
    await syncFinalizedStockCatalogV2(pool);
    await pool.query(`INSERT INTO stock_catalog_getter_checkpoint_v2
      (consumer_key,chain_id,contract_address,start_block_number,last_applied_block_number,
       last_applied_block_hash,last_observation_hash,finalized_horizon_number,
       finalized_horizon_hash,caught_up,verified_at,ready_verified_at)
      VALUES ('stock_catalog_getter_v2',4663,$1,1,100,$2,$3,100,$2,true,now(),now())`,
    [registryAddress, h('f'), h('e')]);

    const body = Buffer.from(JSON.stringify({ assets: providerAssets }));
    const fetchFn = async () => new Response(body, {
      status: 200,
      headers: { 'content-type': 'application/json', 'content-length': String(body.length) },
    });
    const started = process.hrtime.bigint();
    const productionSql = [];
    const result = await sweepRwaHealth(recordingPool(pool, productionSql), { fetchFn });
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
    assert(elapsedMs < 240_000, `2,048-version H1 sweep exceeded 240 seconds: ${elapsedMs}ms`);
    assert.equal(result?.status, 'complete', 'H1 RED: bounded sweep did not complete');
    assert.equal(Number(result?.activeVersionCount), 2048);
    assert.equal(Number(result?.pageCount), 8);
    const issued = productionSql.join('\n');
    assert.match(issued, /stock_catalog_sync_lock_v2 WHERE id=1 FOR SHARE/i);
    assert.match(issued, /rwa_health_apply_lock_v2 WHERE id=1 FOR UPDATE/i);
    assert.match(issued, /rwa_health_batches_v2[\s\S]*FOR UPDATE/i);
    assert.match(issued, /rwa_health_current_v2[\s\S]*FOR UPDATE/i);
    assert.match(issued, /date_trunc\('milliseconds',clock_timestamp\(\)\)/i);

    console.log('PASS rwa health real PostgreSQL: locks, constraints, input isolation, 2,048 budget');
  } finally {
    __setStockTokenRegistryV2Reader(null);
    delete process.env.CHAIN_RPC_URL;
    delete process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS;
    delete process.env.STOCK_TOKEN_REGISTRY_V2_START_BLOCK;
    dbCaps.skipLocked = false;
    if (pool) await pool.end().catch(() => {});
    await admin.query(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`).catch(() => {});
    await admin.end().catch(() => {});
  }
}
