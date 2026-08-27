import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import {
  __setStockTokenRegistryV2ClientFactory,
  __setStockTokenRegistryV2Reader,
  approvedStockTokenCatalogV2,
  finalizedStockCatalogForBallotV2,
  syncFinalizedStockCatalogV2,
} from '../src/stockcatalogv2.js';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL is required; this real-PostgreSQL lane refuses pg-mem and implicit databases');
}
const parsedDatabase = new URL(testDatabaseUrl);
if (!['postgres:', 'postgresql:'].includes(parsedDatabase.protocol) || !parsedDatabase.pathname.slice(1)) {
  throw new Error('TEST_DATABASE_URL must be an explicit PostgreSQL database URL');
}

const CHAIN_ID = '4663';
const REGISTRY = '0x1234567890AbcdEF1234567890aBcdef12345678';
const CONSUMER_KEY = 'stock_catalog_getter_v2';
const VERSION_KEY = '0x2228c1f8f237298425d0dc9fbc297242f85dc4b35102c54cb6dc7ceb14d9a73b';
const TICKER_HASH = '0x3a54a9a690616fbc26cfc409bf11f89d51f1d57a4ab2791fb86026cee74ed2f3';
const PROVIDER_HASH = `0x${'1'.repeat(64)}`;
const TOKEN = `0x${'1'.repeat(40)}`;
const TOPIC0 = '0x65658f8aa9175ffb1216ab53e854c0826a5301f4f8a5d1c131df7717e0007663';
const hash = (char) => `0x${char.repeat(64)}`;
const blockHash = (number) => `0x${BigInt(number).toString(16).padStart(64, '0')}`;

const schemaName = `stock_catalog_v2_${randomUUID().replaceAll('-', '')}`;
assert.match(schemaName, /^stock_catalog_v2_[a-f0-9]{32}$/);
const quotedSchema = `"${schemaName}"`;
const adminPool = new Pool({ connectionString: testDatabaseUrl, max: 4 });
let pool;

class RegistryClient {
  constructor({ finalized = 99n, catalogVersion = 1n, logs = [], barrier = null, trace = [] } = {}) {
    this.finalized = finalized;
    this.catalogVersion = catalogVersion;
    this.logs = logs;
    this.barrier = barrier;
    this.trace = trace;
  }

  async getChainId() {
    this.trace.push('rpc:getChainId');
    if (this.barrier) await this.barrier();
    return 4663;
  }

  async getBlock(request) {
    const number = request.blockTag === 'finalized' ? this.finalized : BigInt(request.blockNumber);
    this.trace.push(request.blockTag === 'finalized'
      ? 'rpc:getBlock:finalized' : `rpc:getBlock:${number}`);
    return { number, hash: blockHash(number), timestamp: 300n };
  }

  async request({ method, params }) {
    assert.equal(method, 'eth_getLogs');
    assert.equal(params.length, 1);
    this.trace.push('rpc:getLogs');
    return this.logs;
  }

  async readContract({ functionName, blockNumber }) {
    this.trace.push(`rpc:read:${functionName}@${blockNumber}`);
    switch (functionName) {
      case 'catalogVersion': return this.catalogVersion;
      case 'versionCount': return 1n;
      case 'versionKeyAt': return VERSION_KEY;
      case 'getVersion': return {
        chainId: 4663n,
        tickerHash: TICKER_HASH,
        token: TOKEN,
        robinhoodAssetIdHash: PROVIDER_HASH,
        ticker: 'AAPL',
        name: 'Apple Stock Token',
        tokenDecimals: 18,
        active: true,
        registeredAt: 100n,
        activatedAt: 200n,
        deactivatedAt: 0n,
      };
      case 'activeVersionForTickerHash':
      case 'activeVersionForToken':
      case 'activeVersionForProviderIdHash': return VERSION_KEY;
      default: throw new Error(`unexpected registry getter ${functionName}`);
    }
  }
}

function twoPartyBarrier() {
  let arrivals = 0;
  let release;
  const ready = new Promise((resolve) => { release = resolve; });
  return async () => {
    arrivals += 1;
    if (arrivals === 2) release();
    await ready;
  };
}

function configure({ startBlock = 97n, clients }) {
  process.env.CHAIN_RPC_URL = 'https://task5-postgres.invalid/rpc';
  process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS = REGISTRY;
  process.env.STOCK_TOKEN_REGISTRY_V2_START_BLOCK = startBlock.toString();
  let index = 0;
  __setStockTokenRegistryV2Reader(null);
  __setStockTokenRegistryV2ClientFactory(() => {
    const client = clients[Math.min(index, clients.length - 1)];
    index += 1;
    return client;
  });
}

function wrapPool(base, { trace = null, failAfter = null, counts = null, interleave = null } = {}) {
  let failed = false;
  return {
    query: (...args) => base.query(...args),
    async connect() {
      if (trace) trace.push('db:connect');
      const client = await base.connect();
      return {
        async query(statement, params) {
          const sql = String(statement).replace(/\s+/g, ' ').trim();
          if (trace) trace.push(`db:${sql.split(' ')[0]}`);
          if (counts) {
            if (/UPDATE stock_catalog_getter_checkpoint_v2/i.test(sql)) counts.checkpointUpdates += 1;
            if (/INSERT INTO stock_catalog_getter_inbox_v2/i.test(sql)) counts.inboxInserts += 1;
          }
          const result = await client.query(statement, params);
          if (interleave) await interleave(sql, result);
          if (!failed && failAfter?.test(sql)) {
            failed = true;
            throw new Error(`injected real-PG failure after ${failAfter}`);
          }
          return result;
        },
        release: () => client.release(),
      };
    },
  };
}

async function resetDomain() {
  await pool.query(`TRUNCATE TABLE
    stock_catalog_getter_inbox_v2,
    stock_catalog_getter_checkpoint_v2,
    stock_asset_active_heads_v2,
    stock_asset_versions_v2,
    stock_catalog_sync_runs_v2,
    stock_catalog_sync_state_v2,
    stock_catalog_evidence_v2`);
}

async function counts() {
  const row = (await pool.query(`SELECT
    (SELECT COUNT(*)::INT FROM stock_catalog_getter_inbox_v2) AS inbox,
    (SELECT COUNT(*)::INT FROM stock_catalog_getter_checkpoint_v2) AS checkpoint,
    (SELECT COUNT(*)::INT FROM stock_asset_versions_v2) AS versions,
    (SELECT COUNT(*)::INT FROM stock_asset_active_heads_v2) AS heads,
    (SELECT COUNT(*)::INT FROM stock_catalog_sync_state_v2) AS state`)).rows[0];
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)]));
}

async function deadlocks() {
  return BigInt((await pool.query(
    'SELECT deadlocks::TEXT AS deadlocks FROM pg_stat_database WHERE datname=current_database()',
  )).rows[0].deadlocks);
}

try {
  await adminPool.query(`CREATE SCHEMA ${quotedSchema}`);
  pool = new Pool({
    connectionString: testDatabaseUrl,
    max: 8,
    options: `-c search_path=${schemaName},public -c statement_timeout=8000 -c lock_timeout=3000`,
  });
  const schemaSql = await readFile(new URL('../schema.sql', import.meta.url), 'utf8');
  await pool.query(schemaSql);

  // RPC evidence is fully assembled before the coordinator checks out its transaction client.
  await resetDomain();
  const order = [];
  configure({ clients: [new RegistryClient({ trace: order })] });
  await syncFinalizedStockCatalogV2(wrapPool(pool, { trace: order }));
  assert(order.lastIndexOf('rpc:getBlock:99') < order.indexOf('db:connect'),
    `RPC must finish before transaction checkout: ${order.join(' -> ')}`);

  // Two first workers observe the same empty base. One applies; the other is an exact immutable replay.
  await resetDomain();
  const beforeDeadlocks = await deadlocks();
  const barrier = twoPartyBarrier();
  const operationCounts = { checkpointUpdates: 0, inboxInserts: 0 };
  configure({ clients: [
    new RegistryClient({ barrier }),
    new RegistryClient({ barrier }),
  ] });
  const bootstrapResults = await Promise.all([
    syncFinalizedStockCatalogV2(wrapPool(pool, { counts: operationCounts })),
    syncFinalizedStockCatalogV2(wrapPool(pool, { counts: operationCounts })),
  ]);
  assert.equal(bootstrapResults.filter((result) => result.synced).length, 1);
  assert.equal(bootstrapResults.filter((result) => result.replayed).length, 1);
  assert.equal(operationCounts.checkpointUpdates, 1,
    'exact replay advances neither checkpoint nor ready verification');
  assert.equal(await deadlocks(), beforeDeadlocks, 'deterministic bootstrap lock order adds no deadlock');
  assert.deepEqual(await counts(), { inbox: 0, checkpoint: 1, versions: 1, heads: 3, state: 1 });

  // Same-base alternatives cannot both commit.
  await resetDomain();
  const alternativesBarrier = twoPartyBarrier();
  configure({ clients: [
    new RegistryClient({ catalogVersion: 1n, barrier: alternativesBarrier }),
    new RegistryClient({ catalogVersion: 2n, barrier: alternativesBarrier }),
  ] });
  const alternatives = await Promise.allSettled([
    syncFinalizedStockCatalogV2(pool),
    syncFinalizedStockCatalogV2(pool),
  ]);
  assert.equal(alternatives.filter((result) => result.status === 'fulfilled').length, 1);
  const rejectedAlternative = alternatives.find((result) => result.status === 'rejected');
  assert.equal(rejectedAlternative.reason.code, 'fo_checkpoint_advanced');
  assert.deepEqual(await counts(), { inbox: 0, checkpoint: 1, versions: 1, heads: 3, state: 1 });

  // Every atomic stage rolls back the inbox, domain state, and applied checkpoint together.
  const rawLog = (number = 99n, overrides = {}) => ({
    removed: false,
    address: REGISTRY,
    blockNumber: `0x${number.toString(16)}`,
    blockHash: blockHash(number),
    transactionHash: hash('a'),
    transactionIndex: '0x2',
    logIndex: '0x3',
    topics: [TOPIC0, hash('b')],
    data: '0x1234',
    ...overrides,
  });
  for (const stage of [
    /INSERT INTO stock_catalog_getter_inbox_v2/i,
    /INSERT INTO stock_asset_versions_v2/i,
    /UPDATE stock_catalog_sync_state_v2/i,
    /UPDATE stock_catalog_getter_checkpoint_v2/i,
  ]) {
    await resetDomain();
    configure({ clients: [new RegistryClient({ logs: [rawLog()] })] });
    await assert.rejects(() => syncFinalizedStockCatalogV2(wrapPool(pool, { failAfter: stage })),
      /consumer|injected real-PG failure/i);
    assert.deepEqual(await counts(), { inbox: 0, checkpoint: 0, versions: 0, heads: 0, state: 0 },
      `rollback after ${stage} leaves no partial consumer state`);
  }

  // A duplicate five-part inbox identity must match every stored byte.
  await resetDomain();
  configure({ clients: [new RegistryClient({ logs: [rawLog()] })] });
  await syncFinalizedStockCatalogV2(pool);
  await pool.query("UPDATE stock_catalog_getter_inbox_v2 SET data_hex='0x9999'");
  await pool.query(`UPDATE stock_catalog_getter_checkpoint_v2 SET
    last_applied_block_number=NULL,last_applied_block_hash=NULL,last_observation_hash=NULL,
    finalized_horizon_number=NULL,finalized_horizon_hash=NULL,caught_up=false,
    verified_at=NULL,ready_verified_at=NULL`);
  configure({ clients: [new RegistryClient({ logs: [rawLog()] })] });
  await assert.rejects(() => syncFinalizedStockCatalogV2(pool), (error) =>
    error?.code === 'consumer_failed'
      && /conflicting finalized registry inbox/i.test(error.cause?.message ?? ''));
  assert.equal((await pool.query('SELECT data_hex FROM stock_catalog_getter_inbox_v2')).rows[0].data_hex, '0x9999');

  // PostgreSQL NUMERIC and the raw adapter retain exact values beyond Number.MAX_SAFE_INTEGER.
  await resetDomain();
  const huge = 9007199254740993n;
  const hugeTxIndex = 9007199254740995n;
  const hugeLogIndex = 9007199254740997n;
  configure({
    startBlock: huge,
    clients: [new RegistryClient({
      finalized: huge,
      logs: [rawLog(huge, {
        transactionIndex: `0x${hugeTxIndex.toString(16)}`,
        logIndex: `0x${hugeLogIndex.toString(16)}`,
      })],
    })],
  });
  await syncFinalizedStockCatalogV2(pool);
  const hugeCheckpoint = (await pool.query(
    'SELECT last_applied_block_number::TEXT AS value FROM stock_catalog_getter_checkpoint_v2',
  )).rows[0].value;
  const hugeInbox = (await pool.query(
    `SELECT block_number::TEXT AS block_number,transaction_index::TEXT AS transaction_index,
            log_index::TEXT AS log_index FROM stock_catalog_getter_inbox_v2`,
  )).rows[0];
  assert.equal(hugeCheckpoint, huge.toString());
  assert.deepEqual(hugeInbox, {
    block_number: huge.toString(),
    transaction_index: hugeTxIndex.toString(),
    log_index: hugeLogIndex.toString(),
  });

  // Bounded progress is applied but unready; its caught-up successor establishes ready freshness.
  await resetDomain();
  configure({ clients: [new RegistryClient({ finalized: 20_000n })] });
  await syncFinalizedStockCatalogV2(pool);
  let checkpoint = (await pool.query(
    `SELECT last_applied_block_number::TEXT AS applied,caught_up,ready_verified_at
       FROM stock_catalog_getter_checkpoint_v2`,
  )).rows[0];
  assert.deepEqual({ applied: checkpoint.applied, caughtUp: checkpoint.caught_up, ready: checkpoint.ready_verified_at },
    { applied: '10096', caughtUp: false, ready: null });
  assert.equal((await approvedStockTokenCatalogV2(pool)).voteable, false);
  configure({ clients: [new RegistryClient({ finalized: 20_000n })] });
  await syncFinalizedStockCatalogV2(pool);
  checkpoint = (await pool.query(
    `SELECT last_applied_block_number::TEXT AS applied,caught_up,ready_verified_at
       FROM stock_catalog_getter_checkpoint_v2`,
  )).rows[0];
  assert.equal(checkpoint.applied, '20000');
  assert.equal(checkpoint.caught_up, true);
  assert(checkpoint.ready_verified_at instanceof Date);
  assert.equal((await approvedStockTokenCatalogV2(pool)).voteable, true);

  // The transaction-scoped public seam proves PostgreSQL's exact 600-second microsecond boundary.
  const fixedReady = '2026-08-27T00:00:00.000000Z';
  await pool.query('UPDATE stock_catalog_sync_state_v2 SET ready_verified_at=$1,caught_up=true', [fixedReady]);
  const clockClient = await pool.connect();
  try {
    const atBoundary = await finalizedStockCatalogForBallotV2(clockClient, {
      canonicalClose: '2026-08-28T00:00:00.000Z',
      observedEpochSeconds: '1787789400.000000',
    });
    const firstMicrosecondPast = await finalizedStockCatalogForBallotV2(clockClient, {
      canonicalClose: '2026-08-28T00:00:00.000Z',
      observedEpochSeconds: '1787789400.000001',
    });
    assert.equal(atBoundary.available, true, 'exactly 600 PostgreSQL seconds remains fresh');
    assert.equal(firstMicrosecondPast.available, false);
    assert.equal(firstMicrosecondPast.reason, 'stale');
  } finally {
    clockClient.release();
  }

  // A concurrent commit between state/history reads cannot split a repeatable-read public snapshot.
  await resetDomain();
  configure({ clients: [new RegistryClient({ catalogVersion: 1n })] });
  await syncFinalizedStockCatalogV2(pool);
  let releaseWriter;
  const writerDone = new Promise((resolve) => { releaseWriter = resolve; });
  let writerStarted = false;
  const interleavedPool = wrapPool(pool, {
    interleave: async (sql) => {
      if (!writerStarted && /FROM stock_catalog_sync_state_v2 WHERE id=1$/i.test(sql)) {
        writerStarted = true;
        configure({ clients: [new RegistryClient({ finalized: 100n, catalogVersion: 2n })] });
        syncFinalizedStockCatalogV2(pool).then(releaseWriter, releaseWriter);
        await writerDone;
      }
    },
  });
  const coherent = await approvedStockTokenCatalogV2(interleavedPool);
  assert.equal(coherent.catalogVersion, '1');
  assert.deepEqual(coherent.assets.map((asset) => asset.lastCatalogVersion), ['1']);
  assert.equal((await approvedStockTokenCatalogV2(pool)).catalogVersion, '2');

  console.log('✅ stock catalog v2 real PostgreSQL: FO order, MVCC, rollback, replay, BigInt, readiness');
} finally {
  __setStockTokenRegistryV2Reader(null);
  __setStockTokenRegistryV2ClientFactory(null);
  delete process.env.CHAIN_RPC_URL;
  delete process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS;
  delete process.env.STOCK_TOKEN_REGISTRY_V2_START_BLOCK;
  if (pool) await pool.end().catch(() => {});
  // The target is a generated, validated, task-specific schema in the explicitly supplied test DB.
  await adminPool.query(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`).catch(() => {});
  await adminPool.end().catch(() => {});
}
