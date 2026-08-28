import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { getAddress, keccak256, stringToHex, toBytes } from 'viem';

import { makeDb } from '../src/db.js';
import { fetchRwaHealthProvider, parseRwaHealthProviderBody } from '../src/rwahealth.js';
import { requireFreshRwaHealth, rwaHealthBoard, rwaHealthDetail } from '../src/rwahealthread.js';
import { enterRwaHealthReview } from '../src/rwahealthreview.js';
import { sweepRwaHealth } from '../src/rwahealthsweep.js';
import {
  __setStockTokenRegistryV2Reader, computeStockAssetVersionKey, syncFinalizedStockCatalogV2,
} from '../src/stockcatalogv2.js';

const REGISTRY = getAddress(`0x${'9'.repeat(40)}`);
const TOKEN = getAddress(`0x${'4'.repeat(40)}`);
const PROVIDER_ID = `0x${'a'.repeat(64)}`;
const PROVIDER_ID_HASH = keccak256(stringToHex(PROVIDER_ID));
const HASH = (digit) => `0x${digit.repeat(64)}`;
const catalogAsset = {
  chainId: '4663', ticker: 'AAPL', tickerHash: keccak256(toBytes('AAPL')),
  name: 'Apple Token', tokenAddress: TOKEN, tokenDecimals: 18,
  robinhoodAssetIdHash: PROVIDER_ID_HASH, registryIndex: '0', active: true,
  registeredAt: '1787680000', activatedAt: '1787690000', deactivatedAt: '0',
};
catalogAsset.assetVersionKey = computeStockAssetVersionKey(catalogAsset);

const prior = {
  rpc: process.env.CHAIN_RPC_URL,
  registry: process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS,
  start: process.env.STOCK_TOKEN_REGISTRY_V2_START_BLOCK,
};
process.env.CHAIN_RPC_URL = 'https://configured-rpc.invalid';
process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS = REGISTRY;
process.env.STOCK_TOKEN_REGISTRY_V2_START_BLOCK = '1';

const observation = () => ({
  source: 'robinhood_chain_registry_v2', finality: 'finalized', chainId: '4663',
  registryAddress: REGISTRY, catalogVersion: '1', finalizedBlockNumber: '100',
  finalizedBlockHash: HASH('f'), observedAt: '1787700000', assets: [catalogAsset],
  activeHeads: {
    tickerHash: [{ dimensionValue: catalogAsset.tickerHash, assetVersionKey: catalogAsset.assetVersionKey }],
    tokenAddress: [{ dimensionValue: TOKEN, assetVersionKey: catalogAsset.assetVersionKey }],
    robinhoodAssetIdHash: [{
      dimensionValue: PROVIDER_ID_HASH, assetVersionKey: catalogAsset.assetVersionKey,
    }],
  },
});

function providerBody(overrides = {}) {
  return Buffer.from(JSON.stringify({ assets: [{
    id: PROVIDER_ID, tokenSymbol: 'AAPL',
    deployments: [{ chainId: 4663, contractAddress: TOKEN }],
    status: 'ASSET_STATUS_ACTIVE',
    tradingCapabilities: { fractionalTradability: 'tradable' },
    tokenDecimals: 18, ...overrides,
  }] }));
}

const fetchBody = (body) => async () => new Response(body, {
  status: 200,
  headers: { 'content-type': 'application/json', 'content-length': String(body.length) },
});

async function preparedDb(registryObservation = observation()) {
  const pool = await makeDb();
  __setStockTokenRegistryV2Reader(async () => registryObservation);
  await syncFinalizedStockCatalogV2(pool);
  await pool.query(`INSERT INTO stock_catalog_getter_checkpoint_v2
    (consumer_key,chain_id,contract_address,start_block_number,last_applied_block_number,
     last_applied_block_hash,last_observation_hash,finalized_horizon_number,
     finalized_horizon_hash,caught_up,verified_at,ready_verified_at)
    VALUES ('stock_catalog_getter_v2',4663,$1,1,100,$2,$3,100,$2,true,now(),now())`,
  [REGISTRY, HASH('f'), HASH('e')]);
  const checkpoint = (await pool.query(
    `SELECT chain_id::text AS chain_id,lower(contract_address) AS contract_address,
            start_block_number::text AS start_block_number
       FROM stock_catalog_getter_checkpoint_v2 WHERE consumer_key='stock_catalog_getter_v2'`,
  )).rows[0];
  assert.deepEqual(checkpoint, {
    chain_id: '4663', contract_address: REGISTRY.toLowerCase(), start_block_number: '1',
  });
  return pool;
}

function crashOnceBeforeFirstPage(pool) {
  let crashed = false;
  let fetches = 0;
  return {
    get crashed() { return crashed; },
    get fetches() { return fetches; },
    noteFetch() { fetches += 1; },
    query: (...args) => pool.query(...args),
    async connect() {
      const client = await pool.connect();
      return {
        async query(sql, params) {
          if (!crashed && /^SELECT \* FROM rwa_health_pages_v2/m.test(String(sql))) {
            crashed = true;
            throw new Error('injected crash before first page');
          }
          return client.query(sql, params);
        },
        release: () => client.release(),
      };
    },
  };
}

try {
  const healthyPool = await preparedDb();
  try {
    const fetched = await fetchRwaHealthProvider(fetchBody(providerBody()));
    assert.equal(parseRwaHealthProviderBody(fetched.body).assets.length, 1);
    const result = await sweepRwaHealth(healthyPool, { fetchFn: fetchBody(providerBody()) });
    assert.deepEqual({ status: result.status, activeVersionCount: result.activeVersionCount, pageCount: result.pageCount },
      { status: 'complete', activeVersionCount: 1, pageCount: 1 });
    assert.equal((await healthyPool.query(
      "SELECT count(*)::int AS n FROM rwa_health_evaluations_v2 WHERE status='applied'",
    )).rows[0].n, 1);
    const evaluation = (await healthyPool.query(`SELECT evaluation_kind,provider_record,
      supported_chain,ticker_identity,token_identity,token_decimals_result,
      provider_active,fractional_tradable FROM rwa_health_evaluations_v2`)).rows[0];
    assert.deepEqual(evaluation, {
      evaluation_kind: 'healthy', provider_record: 0, supported_chain: 0,
      ticker_identity: 0, token_identity: 0, token_decimals_result: 0,
      provider_active: 0, fractional_tradable: 0,
    });
    const current = (await healthyPool.query(
      'SELECT * FROM rwa_health_current_v2 WHERE asset_version_key=$1', [catalogAsset.assetVersionKey],
    )).rows[0];
    assert.equal(current.latest_evaluation_kind, 'healthy');
    assert.equal(current.current_episode_id, null);
    assert.equal((await healthyPool.query(
      'SELECT count(*)::int AS n FROM rwa_health_private_provider_evidence_v2',
    )).rows[0].n, 0);
    assert.equal(new Date(current.next_due_at).getTime() - new Date(current.last_observed_at).getTime(),
      300_000);
    const board = await rwaHealthBoard(healthyPool);
    assert.equal(board.items.length, 1);
    assert.equal(board.items[0].state, 'healthy');
    assert(Object.isFrozen(board) && Object.isFrozen(board.items[0]));
    const detail = await rwaHealthDetail(healthyPool, catalogAsset.assetVersionKey);
    assert.equal(detail.evaluationId, current.last_evaluation_id);
    const client = await healthyPool.connect();
    try {
      await client.query('BEGIN');
      const receipt = await requireFreshRwaHealth(client, catalogAsset.assetVersionKey, {
        expectedEvaluationId: current.last_evaluation_id, purpose: 'purchase_broadcast',
        expectedEpisodeGeneration: null, expectedStateSequence: String(current.state_sequence),
        expectedEpisodeEventId: null, expectedMaterialEvidenceHash: null,
      });
      assert.equal(receipt.ok, true);
      assert.equal(receipt.evaluationId, current.last_evaluation_id);
      await client.query('ROLLBACK');
    } finally { client.release(); }
  } finally { await healthyPool.end(); }

  const adversePool = await preparedDb();
  try {
    const result = await sweepRwaHealth(adversePool, {
      fetchFn: fetchBody(providerBody({ status: 'ASSET_STATUS_INACTIVE' })),
    });
    assert.equal(result.status, 'complete');
    const privateEvidence = (await adversePool.query(`SELECT b.provider_commitment,
      p.raw_body_hash,p.byte_count,p.body_bytes FROM rwa_health_batches_v2 b
      JOIN rwa_health_private_provider_evidence_v2 p ON p.batch_id=b.batch_id`)).rows[0];
    assert.equal(privateEvidence.raw_body_hash, privateEvidence.provider_commitment);
    assert.equal(Number(privateEvidence.byte_count), privateEvidence.body_bytes.length);
    assert.equal(keccak256(new Uint8Array(privateEvidence.body_bytes)), privateEvidence.raw_body_hash);
    const current = (await adversePool.query(
      'SELECT * FROM rwa_health_current_v2 WHERE asset_version_key=$1', [catalogAsset.assetVersionKey],
    )).rows[0];
    assert.equal(current.current_severity, 'operational_quarantine');
    assert.equal(String(current.current_episode_generation), '1');
    const review = await enterRwaHealthReview(
      adversePool, catalogAsset.assetVersionKey, 'reviewer-main',
      crypto.createHash('sha256').update('transport-one').digest('hex'), {
        state: 'health_unknown', ruleCode: 'reviewer_verification_unknown',
        reasonHash: HASH('6'), evidenceHash: HASH('7'),
      },
    );
    assert.equal(review.outcome, 'evidence_only');
    const replay = await enterRwaHealthReview(
      adversePool, catalogAsset.assetVersionKey, 'reviewer-main',
      crypto.createHash('sha256').update('transport-two').digest('hex'), {
        state: 'health_unknown', ruleCode: 'reviewer_verification_unknown',
        reasonHash: HASH('6'), evidenceHash: HASH('7'),
      },
    );
    assert.equal(replay.replay, true);
    assert.equal(replay.reviewerActionId, review.reviewerActionId);
  } finally { await adversePool.end(); }

  const failurePool = await preparedDb();
  try {
    const result = await sweepRwaHealth(failurePool, {
      fetchFn: async () => { throw new Error('closed test failure'); },
    });
    assert.equal(result.status, 'complete');
    const current = (await failurePool.query(
      'SELECT current_severity FROM rwa_health_current_v2 WHERE asset_version_key=$1',
      [catalogAsset.assetVersionKey],
    )).rows[0];
    assert.equal(current.current_severity, 'health_unknown');
    assert.equal((await failurePool.query(
      'SELECT failure_code FROM rwa_health_batches_v2',
    )).rows[0].failure_code, 'provider_http');
    assert.equal((await failurePool.query(
      'SELECT last_error_code FROM rwa_health_runtime_v2',
    )).rows[0].last_error_code, 'health_provider_http');
    assert.equal((await failurePool.query(
      'SELECT count(*)::int AS n FROM rwa_health_private_provider_evidence_v2',
    )).rows[0].n, 0);
  } finally { await failurePool.end(); }

  const resumePool = await preparedDb();
  try {
    const crashing = crashOnceBeforeFirstPage(resumePool);
    const body = providerBody();
    await assert.rejects(() => sweepRwaHealth(crashing, {
      fetchFn: async (...args) => {
        crashing.noteFetch();
        return fetchBody(body)(...args);
      },
    }), /injected crash/);
    assert.equal(crashing.fetches, 1);
    assert.equal(crashing.crashed, true);
    assert.deepEqual((await resumePool.query(`SELECT status,applied_page_count,
      applied_item_count FROM rwa_health_batches_v2`)).rows[0], {
      status: 'pending', applied_page_count: 0, applied_item_count: 0,
    });
    assert.equal((await resumePool.query(
      "SELECT count(*)::int AS n FROM rwa_health_pages_v2 WHERE status='planned'",
    )).rows[0].n, 1);
    assert.equal((await resumePool.query(
      "SELECT count(*)::int AS n FROM rwa_health_evaluations_v2 WHERE status='planned'",
    )).rows[0].n, 1);
    let resumedFetches = 0;
    const resumed = await sweepRwaHealth(resumePool, {
      fetchFn: async () => { resumedFetches += 1; throw new Error('resume must not fetch'); },
    });
    assert.equal(resumedFetches, 0);
    assert.equal(resumed.status, 'complete');
    const replay = await sweepRwaHealth(resumePool, { fetchFn: fetchBody(body) });
    assert.equal(replay.batchId, resumed.batchId);
    assert.equal((await resumePool.query(
      'SELECT state_sequence::int AS sequence FROM rwa_health_current_v2',
    )).rows[0].sequence, 1);
    assert.equal((await resumePool.query(
      'SELECT count(*)::int AS n FROM rwa_health_batches_v2',
    )).rows[0].n, 1);
  } finally { await resumePool.end(); }

  const retainedPool = await preparedDb();
  try {
    await enterRwaHealthReview(
      retainedPool, catalogAsset.assetVersionKey, 'reviewer-retention',
      crypto.createHash('sha256').update('retention-entry').digest('hex'), {
        state: 'health_unknown', ruleCode: 'reviewer_verification_unknown',
        reasonHash: HASH('8'), evidenceHash: HASH('9'),
      },
    );
    const crashing = crashOnceBeforeFirstPage(retainedPool);
    await assert.rejects(() => sweepRwaHealth(crashing, {
      fetchFn: fetchBody(providerBody()),
    }), /injected crash/);
    assert.equal((await retainedPool.query(
      'SELECT count(*)::int AS n FROM rwa_health_private_provider_evidence_v2',
    )).rows[0].n, 1);
    await retainedPool.query('DELETE FROM rwa_health_private_provider_evidence_v2');
    await assert.rejects(() => sweepRwaHealth(retainedPool, {
      fetchFn: async () => { throw new Error('resume must not fetch'); },
    }), (error) => error?.code === 'health_evidence_conflict');
  } finally { await retainedPool.end(); }

  const empty = observation();
  empty.catalogVersion = '0';
  empty.assets = [];
  empty.activeHeads = { tickerHash: [], tokenAddress: [], robinhoodAssetIdHash: [] };
  const emptyPool = await preparedDb(empty);
  try {
    const result = await sweepRwaHealth(emptyPool, {
      fetchFn: fetchBody(Buffer.from('{"assets":[]}')),
    });
    assert.deepEqual({ status: result.status, activeVersionCount: result.activeVersionCount,
      pageCount: result.pageCount }, { status: 'complete', activeVersionCount: 0, pageCount: 0 });
    for (const table of ['rwa_health_pages_v2', 'rwa_health_evaluations_v2', 'rwa_health_current_v2']) {
      assert.equal((await emptyPool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n, 0);
    }
  } finally { await emptyPool.end(); }

  console.log('✅ RWA health H1 integration: healthy/action wall, sticky quarantine, source failure, crash resume/replay/evidence, zero-active');
} finally {
  __setStockTokenRegistryV2Reader(null);
  if (prior.rpc === undefined) delete process.env.CHAIN_RPC_URL; else process.env.CHAIN_RPC_URL = prior.rpc;
  if (prior.registry === undefined) delete process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS;
  else process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS = prior.registry;
  if (prior.start === undefined) delete process.env.STOCK_TOKEN_REGISTRY_V2_START_BLOCK;
  else process.env.STOCK_TOKEN_REGISTRY_V2_START_BLOCK = prior.start;
}
