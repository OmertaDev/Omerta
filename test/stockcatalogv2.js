import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import {
  decodeFunctionData, encodeAbiParameters, getAddress, keccak256, toBytes,
} from 'viem';
import { makeDb } from '../src/db.js';
import {
  INITIAL_RWA_APPROVAL_COUNT, parseRobinhoodStockTokenAssets,
  parseRobinhoodStockTokenQuotes, selectInitialTopVolumeAssets,
} from '../src/stockcatalog.js';
import {
  __setStockTokenRegistryV2Reader,
  approvedStockTokenCatalogV2,
  buildStockTokenActivationV2,
  buildStockTokenDeactivationV2,
  computeStockAssetVersionKey,
  syncFinalizedStockCatalogV2,
} from '../src/stockcatalogv2.js';
import * as stockCatalogV2 from '../src/stockcatalogv2.js';
import { runStockCatalogV2Cli } from '../tools/robinhood-stock-catalog-v2.js';

const CHAIN_ID = '4663';
const REGISTRY = '0x9999999999999999999999999999999999999999';
const MAX_TIMESTAMP_SECONDS = '253402300799';
const ZERO_HASH = `0x${'00'.repeat(32)}`;
const hash = (byte) => `0x${byte.repeat(64)}`;
const address = (byte) => getAddress(`0x${byte.repeat(40)}`);
const tickerHash = (ticker) => keccak256(toBytes(ticker));
const independentKey = ({ chainId, ticker, tokenAddress, robinhoodAssetIdHash }) => keccak256(
  encodeAbiParameters(
    [{ type: 'uint256' }, { type: 'bytes32' }, { type: 'address' }, { type: 'bytes32' }],
    [BigInt(chainId), tickerHash(ticker), getAddress(tokenAddress), robinhoodAssetIdHash],
  ),
);

// Literal hand-derived Solidity-compatible vector. The payload is deliberately checked in so a
// production mutation from abi.encode to packed encoding cannot make the test agree with itself.
const LITERAL_AAPL_TICKER_HASH = '0x3a54a9a690616fbc26cfc409bf11f89d51f1d57a4ab2791fb86026cee74ed2f3';
const LITERAL_AAPL_ABI_PAYLOAD = '0x'
  + '0000000000000000000000000000000000000000000000000000000000001237'
  + '3a54a9a690616fbc26cfc409bf11f89d51f1d57a4ab2791fb86026cee74ed2f3'
  + '0000000000000000000000001111111111111111111111111111111111111111'
  + '1111111111111111111111111111111111111111111111111111111111111111';
const LITERAL_AAPL_KEY = '0x2228c1f8f237298425d0dc9fbc297242f85dc4b35102c54cb6dc7ceb14d9a73b';
const LITERAL_DYNAMIC_SNAPSHOT_ABI_PAYLOAD = '0x0000000000000000000000000000000000000000000000000000000000001237000000000000000000000000999999999999999999999999999999999999999900000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000063dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd00000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000202228c1f8f237298425d0dc9fbc297242f85dc4b35102c54cb6dc7ceb14d9a73b00000000000000000000000000000000000000000000000000000000000012373a54a9a690616fbc26cfc409bf11f89d51f1d57a4ab2791fb86026cee74ed2f300000000000000000000000000000000000000000000000000000000000001a000000000000000000000000000000000000000000000000000000000000001e000000000000000000000000011111111111111111111111111111111111111110000000000000000000000000000000000000000000000000000000000000012111111111111111111111111111111111111111111111111111111111111111100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000006400000000000000000000000000000000000000000000000000000000000000c8000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000044141504c0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000114170706c652053746f636b20546f6b656e000000000000000000000000000000';
const LITERAL_DYNAMIC_SNAPSHOT_HASH = '0xd3087c62a1d921ec56bbb8f64f1ab41250d39635028a15544ee432ea89132b46';
assert.equal(tickerHash('AAPL'), LITERAL_AAPL_TICKER_HASH);
assert.equal(keccak256(LITERAL_AAPL_ABI_PAYLOAD), LITERAL_AAPL_KEY);
assert.equal(keccak256(LITERAL_DYNAMIC_SNAPSHOT_ABI_PAYLOAD), LITERAL_DYNAMIC_SNAPSHOT_HASH,
  'checked-in Solidity abi.encode fixture includes dynamic ticker/name offsets and tails');
assert.equal(computeStockAssetVersionKey({
  chainId: CHAIN_ID,
  ticker: 'aapl',
  tokenAddress: address('1'),
  robinhoodAssetIdHash: hash('1'),
}), LITERAL_AAPL_KEY, 'version keys use canonical abi.encode and uppercase normalization');

for (const [field, value] of [
  ['chainId', 4663], ['chainId', '04663'], ['chainId', '-1'], ['chainId', '1.0'],
  ['tokenAddress', '0x1234'], ['tokenAddress', '0x0000000000000000000000000000000000000000'],
  ['robinhoodAssetIdHash', '0x1234'], ['robinhoodAssetIdHash', ZERO_HASH],
  ['robinhoodAssetIdHash', `0x${'AA'.repeat(32)}`],
  ['ticker', ''], ['ticker', 'AAP/L'], ['ticker', 'ABCDEFGHIJKLMNOPQRSTUVWXY'],
]) {
  assert.throws(() => computeStockAssetVersionKey({
    chainId: CHAIN_ID, ticker: 'AAPL', tokenAddress: address('1'), robinhoodAssetIdHash: hash('1'),
    [field]: value,
  }), /invalid|zero/i, `malformed ${field} is rejected`);
}
for (const dimension of ['chainId', 'ticker', 'tokenAddress', 'robinhoodAssetIdHash']) {
  const changed = {
    chainId: CHAIN_ID, ticker: 'AAPL', tokenAddress: address('1'), robinhoodAssetIdHash: hash('1'),
    ...({
      chainId: { chainId: '4664' }, ticker: { ticker: 'TSLA' },
      tokenAddress: { tokenAddress: address('2') }, robinhoodAssetIdHash: { robinhoodAssetIdHash: hash('2') },
    }[dimension]),
  };
  assert.notEqual(computeStockAssetVersionKey(changed), LITERAL_AAPL_KEY,
    `version key binds the ${dimension} dimension independently`);
}

const activationAbi = [{
  type: 'function', name: 'activateVersion', stateMutability: 'nonpayable',
  inputs: [{ name: 'activation', type: 'tuple', components: [
    { name: 'token', type: 'address' }, { name: 'robinhoodAssetIdHash', type: 'bytes32' },
    { name: 'ticker', type: 'string' }, { name: 'name', type: 'string' },
    { name: 'tokenDecimals', type: 'uint8' }, { name: 'evidenceHash', type: 'bytes32' },
    { name: 'reviewId', type: 'bytes32' }, { name: 'approvedAt', type: 'uint64' },
    { name: 'validUntil', type: 'uint64' },
  ] }], outputs: [{ name: 'versionKey', type: 'bytes32' }],
}];
const activationAsset = {
  chainId: CHAIN_ID, ticker: 'aapl', name: 'Apple Stock Token', tokenAddress: address('1'),
  tokenDecimals: 18, robinhoodAssetIdHash: hash('1'),
};
const activation = buildStockTokenActivationV2({
  asset: activationAsset, registryAddress: REGISTRY, evidenceHash: hash('a'),
  reviewId: hash('b'), approvedAt: '18446744073708946815',
});
assert.deepEqual({ to: activation.to, value: activation.value, operation: activation.operation },
  { to: REGISTRY, value: '0', operation: 0 });
assert.equal(activation.assetVersionKey, LITERAL_AAPL_KEY);
assert.equal(activation.approvedAt, '18446744073708946815');
assert.equal(activation.validUntil, '18446744073709551615', 'activation TTL is exactly 604800 seconds');
const decodedActivation = decodeFunctionData({ abi: activationAbi, data: activation.data });
assert.equal(decodedActivation.functionName, 'activateVersion');
assert.deepEqual(decodedActivation.args[0], {
  token: address('1'), robinhoodAssetIdHash: hash('1'), ticker: 'AAPL', name: 'Apple Stock Token',
  tokenDecimals: 18, evidenceHash: hash('a'), reviewId: hash('b'),
  approvedAt: 18446744073708946815n, validUntil: 18446744073709551615n,
});
for (const [field, value] of [
  ['approvedAt', 10], ['approvedAt', '01'], ['approvedAt', '18446744073709551616'],
  ['evidenceHash', ZERO_HASH], ['reviewId', '0x1234'], ['registryAddress', address('0')],
]) {
  assert.throws(() => buildStockTokenActivationV2({
    asset: activationAsset, registryAddress: REGISTRY, evidenceHash: hash('a'), reviewId: hash('b'),
    approvedAt: '1000', [field]: value,
  }), /invalid|zero|overflow/i, `activation rejects malformed ${field}`);
}
for (const decimals of [-1, 1.5, 256, '18']) {
  assert.throws(() => buildStockTokenActivationV2({
    asset: { ...activationAsset, tokenDecimals: decimals }, registryAddress: REGISTRY,
    evidenceHash: hash('a'), reviewId: hash('b'), approvedAt: '1000',
  }), /decimals/i, `token decimals reject ${String(decimals)}`);
}
const deactivation = buildStockTokenDeactivationV2({
  assetVersionKey: LITERAL_AAPL_KEY, registryAddress: REGISTRY, reasonHash: hash('c'),
});
const decodedDeactivation = decodeFunctionData({
  abi: [{ type: 'function', name: 'deactivateVersion', stateMutability: 'nonpayable', inputs: [
    { name: 'versionKey', type: 'bytes32' }, { name: 'reasonHash', type: 'bytes32' },
  ], outputs: [] }], data: deactivation.data,
});
assert.deepEqual(decodedDeactivation.args, [LITERAL_AAPL_KEY, hash('c')]);

const makeAsset = ({ ticker, tokenByte, providerByte, registryIndex, active, name = `${ticker} Token`,
  registeredAt = '1787680000', activatedAt = '1787690000', deactivatedAt = '0' }) => {
  const tokenAddress = address(tokenByte);
  const robinhoodAssetIdHash = hash(providerByte);
  const asset = {
    chainId: CHAIN_ID, ticker, tickerHash: tickerHash(ticker), name, tokenAddress, tokenDecimals: 18,
    robinhoodAssetIdHash, registryIndex: String(registryIndex), active,
    registeredAt, activatedAt, deactivatedAt,
  };
  return { ...asset, assetVersionKey: independentKey(asset) };
};
const baseAssets = [
  makeAsset({ ticker: 'AAPL', tokenByte: '1', providerByte: '1', registryIndex: 0, active: false,
    deactivatedAt: '1787695000' }),
  makeAsset({ ticker: 'AAPL', tokenByte: '2', providerByte: '2', registryIndex: 1, active: true }),
  makeAsset({ ticker: 'NVDA', tokenByte: '3', providerByte: '3', registryIndex: 2, active: true }),
  makeAsset({ ticker: 'OLDT', tokenByte: '3', providerByte: '4', registryIndex: 3, active: false,
    deactivatedAt: '1787695001' }),
  makeAsset({ ticker: 'OLDP', tokenByte: '4', providerByte: '3', registryIndex: 4, active: false,
    deactivatedAt: '1787695002' }),
];
const exactHeads = (assets) => ({
  tickerHash: assets.filter((a) => a.active).map((a) => ({
    dimensionValue: a.tickerHash, assetVersionKey: a.assetVersionKey,
  })),
  tokenAddress: assets.filter((a) => a.active).map((a) => ({
    dimensionValue: a.tokenAddress, assetVersionKey: a.assetVersionKey,
  })),
  robinhoodAssetIdHash: assets.filter((a) => a.active).map((a) => ({
    dimensionValue: a.robinhoodAssetIdHash, assetVersionKey: a.assetVersionKey,
  })),
});
const observation = ({ assets = baseAssets, ...overrides } = {}) => ({
  source: 'robinhood_chain_registry_v2', finality: 'finalized', chainId: CHAIN_ID,
  registryAddress: REGISTRY, catalogVersion: '12', finalizedBlockNumber: '123456',
  finalizedBlockHash: hash('f'), observedAt: '1787700000', activeHeads: exactHeads(assets), assets,
  ...overrides,
});

// Snapshot hash test uses a uint256 value above Number.MAX_SAFE_INTEGER. Both the returned hash and
// the SQL parameters must retain the exact decimal text, catching any Number coercion mutation.
const snapshotTuple = {
  type: 'tuple[]', components: [
    { name: 'assetVersionKey', type: 'bytes32' }, { name: 'chainId', type: 'uint256' },
    { name: 'tickerHash', type: 'bytes32' }, { name: 'ticker', type: 'string' },
    { name: 'name', type: 'string' }, { name: 'tokenAddress', type: 'address' },
    { name: 'tokenDecimals', type: 'uint8' }, { name: 'robinhoodAssetIdHash', type: 'bytes32' },
    { name: 'registryIndex', type: 'uint256' }, { name: 'active', type: 'bool' },
    { name: 'registeredAt', type: 'uint64' }, { name: 'activatedAt', type: 'uint64' },
    { name: 'deactivatedAt', type: 'uint64' },
  ],
};
const independentSnapshotHash = (o) => keccak256(encodeAbiParameters([
  { type: 'uint256' }, { type: 'address' }, { type: 'uint256' }, { type: 'uint256' },
  { type: 'bytes32' }, snapshotTuple,
], [BigInt(o.chainId), getAddress(o.registryAddress), BigInt(o.catalogVersion),
  BigInt(o.finalizedBlockNumber), o.finalizedBlockHash,
  o.assets.map((a) => ({ ...a, chainId: BigInt(a.chainId), registryIndex: BigInt(a.registryIndex),
    registeredAt: BigInt(a.registeredAt), activatedAt: BigInt(a.activatedAt),
    deactivatedAt: BigInt(a.deactivatedAt) }))]));
const hugeObservation = observation({
  catalogVersion: '900719925474099312345', finalizedBlockNumber: '900719925474099399999',
});
const sqlParams = [];
const fakeClient = {
  async query(sql, params = []) {
    sqlParams.push(...params);
    if (/SELECT .*stock_catalog_sync_state_v2/i.test(sql)) return { rows: [] };
    if (/SELECT .*stock_asset_versions_v2/i.test(sql)) return { rows: [] };
    return { rows: [], rowCount: 1 };
  },
  release() {},
};
const literalSnapshotAsset = makeAsset({
  ticker: 'AAPL', tokenByte: '1', providerByte: '1', registryIndex: 0, active: true,
  name: 'Apple Stock Token', registeredAt: '100', activatedAt: '200',
});
const literalSnapshotObservation = observation({
  assets: [literalSnapshotAsset], catalogVersion: '1', finalizedBlockNumber: '99',
  finalizedBlockHash: hash('d'), observedAt: '300',
});
__setStockTokenRegistryV2Reader(async () => literalSnapshotObservation);
const literalSnapshotSync = await syncFinalizedStockCatalogV2({ connect: async () => fakeClient });
assert.equal(literalSnapshotSync.snapshotHash, LITERAL_DYNAMIC_SNAPSHOT_HASH,
  'production snapshot v1 matches the literal Solidity dynamic-string ABI fixture');
const maxTimestampAsset = makeAsset({
  ticker: 'MAXT', tokenByte: '6', providerByte: '6', registryIndex: 0, active: true,
  registeredAt: MAX_TIMESTAMP_SECONDS, activatedAt: MAX_TIMESTAMP_SECONDS,
});
__setStockTokenRegistryV2Reader(async () => observation({
  assets: [maxTimestampAsset], catalogVersion: '1', observedAt: MAX_TIMESTAMP_SECONDS,
}));
await syncFinalizedStockCatalogV2({ connect: async () => fakeClient });
__setStockTokenRegistryV2Reader(async () => hugeObservation);
const hugeSync = await syncFinalizedStockCatalogV2({ connect: async () => fakeClient });
assert.equal(hugeSync.snapshotHash, independentSnapshotHash(hugeObservation),
  'snapshotHash v1 is canonical ABI encoding, not packed encoding');
assert(sqlParams.includes(hugeObservation.catalogVersion));
assert(sqlParams.includes(hugeObservation.finalizedBlockNumber));
assert(!sqlParams.some((v) => typeof v === 'number' && v > 255),
  'uint256/block/timestamp SQL parameters are never JavaScript Numbers');

const pool = await makeDb();
assert.deepEqual((await pool.query('SELECT id FROM stock_catalog_sync_lock_v2')).rows, [{ id: 1 }],
  'the permanent first-sync lock row is seeded by schema DDL');
__setStockTokenRegistryV2Reader(async () => observation());
assert.equal(stockCatalogV2.stockTokenRegistryV2ReaderConfigured(), true,
  'an injected finalized reader activates the test seam');
const firstSync = await syncFinalizedStockCatalogV2(pool);
assert.deepEqual({ synced: firstSync.synced, replayed: firstSync.replayed,
  entries: firstSync.entries, active: firstSync.active },
{ synced: true, replayed: false, entries: 5, active: 2 });
assert.equal(firstSync.snapshotHash, independentSnapshotHash(observation()));
const state = (await pool.query('SELECT * FROM stock_catalog_sync_state_v2 WHERE id=1')).rows[0];
assert.equal(String(state.catalog_version), '12');
assert.equal(String(state.finalized_block_number), '123456');
assert.equal(state.snapshot_hash, firstSync.snapshotHash);
const storedRows = (await pool.query(
  'SELECT * FROM stock_asset_versions_v2 ORDER BY registry_index')).rows;
assert.equal(storedRows.length, 5, 'complete history, including inactive shared dimensions, is retained');
assert.equal(storedRows.filter((r) => r.active).length, 2);
const heads = (await pool.query(
  'SELECT dimension_type, dimension_value, asset_version_key FROM stock_asset_active_heads_v2 ORDER BY dimension_type, dimension_value')).rows;
assert.equal(heads.length, 6, 'all three exact reverse-head dimensions are rebuilt');
for (const active of baseAssets.filter((a) => a.active)) {
  assert(heads.some((h) => h.dimension_type === 'tickerHash'
    && h.dimension_value === active.tickerHash && h.asset_version_key === active.assetVersionKey));
  assert(heads.some((h) => h.dimension_type === 'tokenAddress'
    && h.dimension_value.toLowerCase() === active.tokenAddress.toLowerCase()
    && h.asset_version_key === active.assetVersionKey));
  assert(heads.some((h) => h.dimension_type === 'robinhoodAssetIdHash'
    && h.dimension_value === active.robinhoodAssetIdHash && h.asset_version_key === active.assetVersionKey));
}
assert.equal((await pool.query('SELECT * FROM stock_catalog_sync_runs_v2')).rows[0].sync_id,
  firstSync.snapshotHash, 'sync_id is exactly snapshotHash');
assert.equal((await pool.query('SELECT COUNT(*)::INT AS count FROM stock_catalog_evidence_v2')).rows[0].count, 0,
  'getter snapshots do not fabricate activation evidence');

let catalog = await approvedStockTokenCatalogV2(pool);
assert.deepEqual(catalog.assets.map((a) => a.assetVersionKey), baseAssets.map((a) => a.assetVersionKey),
  'public history remains in registry order');
assert.deepEqual(catalog.activeAssets.map((a) => a.ticker), ['AAPL', 'NVDA']);
assert.equal(catalog.voteable, true);
assert.equal(catalog.stale, false);
assert.equal(catalog.catalogVersion, '12');

const retryQueries = [];
const retryPool = {
  async connect() {
    const client = await pool.connect();
    return {
      ...client,
      query: async (sql, params) => { retryQueries.push(sql); return client.query(sql, params); },
      release: () => client.release(),
    };
  },
};
const retry = await syncFinalizedStockCatalogV2(retryPool);
assert.equal(retry.replayed, true);
assert(!retryQueries.some((sql) => /^\s*(?:INSERT|UPDATE|DELETE)/i.test(sql)),
  'an exact snapshot retry is a true write-free no-op');
assert.equal((await pool.query('SELECT COUNT(*)::INT AS count FROM stock_catalog_sync_runs_v2')).rows[0].count, 1);

function serializedSyncPool(innerPool) {
  let lockTail = Promise.resolve();
  const clients = [];
  return {
    clients,
    async connect() {
      const inner = await innerPool.connect();
      const record = { locked: false, queries: [] };
      clients.push(record);
      let releaseLock = null;
      return {
        async query(sql, params) {
          record.queries.push(sql);
          if (/SELECT id FROM stock_catalog_sync_lock_v2 WHERE id=1 FOR UPDATE/i.test(sql)) {
            let release;
            const previous = lockTail;
            lockTail = new Promise((resolve) => { release = resolve; });
            await previous;
            releaseLock = release;
            record.locked = true;
          }
          if (/FROM stock_catalog_sync_state_v2 WHERE id=1 FOR UPDATE/i.test(sql) && !record.locked) {
            throw new Error('sync state read occurred before permanent lock acquisition');
          }
          try { return await inner.query(sql, params); }
          finally {
            if (/^(?:COMMIT|ROLLBACK)$/i.test(sql) && releaseLock) {
              const unlock = releaseLock; releaseLock = null; record.locked = false; unlock();
            }
          }
        },
        release: () => inner.release(),
      };
    },
  };
}

const equalFirstPool = await makeDb();
const equalSerialized = serializedSyncPool(equalFirstPool);
let equalReads = 0;
__setStockTokenRegistryV2Reader(async () => { equalReads++; return observation(); });
const equalFirstResults = await Promise.all([
  syncFinalizedStockCatalogV2(equalSerialized), syncFinalizedStockCatalogV2(equalSerialized),
]);
assert.equal(equalReads, 2);
assert.deepEqual(equalFirstResults.map((result) => [result.synced, result.replayed]).sort(),
  [[false, true], [true, false]], 'equal concurrent first sync serializes to one commit and one exact retry');
assert(equalSerialized.clients.every((client) => client.queries.findIndex((sql) => /sync_lock_v2/i.test(sql))
  < client.queries.findIndex((sql) => /sync_state_v2 WHERE id=1 FOR UPDATE/i.test(sql))));

const conflictingFirstPool = await makeDb();
const conflictingSerialized = serializedSyncPool(conflictingFirstPool);
let conflictingReads = 0;
__setStockTokenRegistryV2Reader(async () => {
  conflictingReads++;
  return conflictingReads === 1 ? observation() : observation({ catalogVersion: '13' });
});
const conflictingFirstResults = await Promise.allSettled([
  syncFinalizedStockCatalogV2(conflictingSerialized), syncFinalizedStockCatalogV2(conflictingSerialized),
]);
assert.equal(conflictingFirstResults.filter((result) => result.status === 'fulfilled').length, 1);
assert.equal(conflictingFirstResults.filter((result) => result.status === 'rejected').length, 1,
  'conflicting concurrent first snapshots cannot both commit');
assert.match(conflictingFirstResults.find((result) => result.status === 'rejected').reason.message,
  /same finalized block|catalog version|conflict/i);
await equalFirstPool.end?.();
await conflictingFirstPool.end?.();
__setStockTokenRegistryV2Reader(async () => observation());

function finalizedReaderClient({ postReadHash = hash('d') } = {}) {
  const one = makeAsset({ ticker: 'AAPL', tokenByte: '1', providerByte: '1', registryIndex: 0, active: true,
    registeredAt: '100', activatedAt: '200' });
  const blockCalls = [];
  const contractCalls = [];
  return {
    one, blockCalls, contractCalls,
    async getChainId() { return 4663; },
    async getBlock(request) {
      blockCalls.push(request);
      if (request.blockTag === 'finalized') {
        return { number: 99n, hash: hash('d'), timestamp: 300n };
      }
      assert.deepEqual(request, { blockNumber: 99n });
      return { number: 99n, hash: postReadHash, timestamp: 300n };
    },
    async readContract(request) {
      contractCalls.push(request);
      switch (request.functionName) {
        case 'catalogVersion': return 1n;
        case 'versionCount': return 1n;
        case 'versionKeyAt': return one.assetVersionKey;
        case 'getVersion': return {
          chainId: 4663n, tickerHash: one.tickerHash, token: one.tokenAddress,
          robinhoodAssetIdHash: one.robinhoodAssetIdHash, ticker: one.ticker, name: one.name,
          tokenDecimals: one.tokenDecimals, active: true, registeredAt: 100n,
          activatedAt: 200n, deactivatedAt: 0n,
        };
        case 'activeVersionForTickerHash':
        case 'activeVersionForToken':
        case 'activeVersionForProviderIdHash': return one.assetVersionKey;
        default: throw new Error(`unexpected registry getter ${request.functionName}`);
      }
    },
  };
}

const readerEnvironment = {
  rpc: process.env.CHAIN_RPC_URL, registry: process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS,
};
process.env.CHAIN_RPC_URL = 'https://hostile-rpc.invalid';
process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS = REGISTRY;
const stableReaderClient = finalizedReaderClient();
stockCatalogV2.__setStockTokenRegistryV2ClientFactory(() => stableReaderClient);
__setStockTokenRegistryV2Reader(null);
const readerPool = await makeDb();
await syncFinalizedStockCatalogV2(readerPool);
assert.deepEqual(stableReaderClient.blockCalls,
  [{ blockTag: 'finalized' }, { blockNumber: 99n }],
  'reader rechecks finalized block N after every registry getter');
assert.equal(stableReaderClient.contractCalls.length, 7);
assert(stableReaderClient.contractCalls.every((call) => call.blockNumber === 99n),
  'every registry getter is pinned to the one finalized block number');

const driftingReaderClient = finalizedReaderClient({ postReadHash: hash('e') });
stockCatalogV2.__setStockTokenRegistryV2ClientFactory(() => driftingReaderClient);
__setStockTokenRegistryV2Reader(null);
let driftConnects = 0;
await assert.rejects(() => syncFinalizedStockCatalogV2({
  connect: async () => { driftConnects++; return readerPool.connect(); },
}), /finalized block.*hash|changed during registry read|reorg/i);
assert.equal(driftConnects, 0, 'same-height finalized hash drift rejects before database work');
stockCatalogV2.__setStockTokenRegistryV2ClientFactory(null);
if (readerEnvironment.rpc === undefined) delete process.env.CHAIN_RPC_URL;
else process.env.CHAIN_RPC_URL = readerEnvironment.rpc;
if (readerEnvironment.registry === undefined) delete process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS;
else process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS = readerEnvironment.registry;
await readerPool.end?.();
__setStockTokenRegistryV2Reader(async () => observation());

const beforeFailure = JSON.stringify(await approvedStockTokenCatalogV2(pool));
for (const [label, mutate, message] of [
  ['wrong source', (o) => { o.source = 'legacy'; }, /source/],
  ['non-finalized observation', (o) => { o.finality = 'latest'; }, /finalized/],
  ['wrong chain', (o) => { o.chainId = '1'; }, /chain/i],
  ['malformed registry address', (o) => { o.registryAddress = '0x1234'; }, /registry address/i],
  ['noncanonical catalog version', (o) => { o.catalogVersion = '012'; }, /catalog/i],
  ['malformed block number', (o) => { o.finalizedBlockNumber = 123456; }, /block/i],
  ['malformed block hash', (o) => { o.finalizedBlockHash = '0x12'; }, /block/i],
  ['malformed observed timestamp', (o) => { o.observedAt = '01'; }, /observed/i],
  ['zero observed timestamp', (o) => { o.observedAt = '0'; }, /observed/i],
  ['unrepresentable observed timestamp', (o) => { o.observedAt = '18446744073709551615'; }, /observed|range/i],
  ['registry-index gap', (o) => { o.assets[2].registryIndex = '3'; }, /registry.*index|contiguous/i],
  ['duplicate registry index', (o) => { o.assets[2].registryIndex = '1'; }, /registry.*index|contiguous/i],
  ['duplicate registry key', (o) => { o.assets[2] = { ...o.assets[2], assetVersionKey: o.assets[1].assetVersionKey }; }, /key/i],
  ['independent key recomputation', (o) => { o.assets[1].tokenAddress = address('9'); }, /key/i],
  ['malformed asset chain', (o) => { o.assets[1].chainId = 4663; }, /asset chain/i],
  ['malformed token address', (o) => { o.assets[1].tokenAddress = '0x1234'; }, /token address/i],
  ['noncanonical provider hash', (o) => { o.assets[1].robinhoodAssetIdHash = `0x${'AA'.repeat(32)}`; }, /provider hash/i],
  ['ticker-hash recomputation', (o) => { o.assets[1].tickerHash = hash('9'); }, /ticker.*hash/i],
  ['malformed ticker', (o) => { o.assets[1].ticker = 'aapl'; }, /ticker/i],
  ['malformed decimals', (o) => { o.assets[1].tokenDecimals = 256; }, /decimals/i],
  ['non-number decimals', (o) => { o.assets[1].tokenDecimals = '18'; }, /decimals/i],
  ['non-boolean active flag', (o) => { o.assets[1].active = 1; }, /active/i],
  ['malformed lifecycle timestamp', (o) => { o.assets[1].registeredAt = '01'; }, /registered/i],
  ['zero registered timestamp', (o) => { o.assets[1].registeredAt = '0'; }, /registered|lifecycle/i],
  ['zero activated timestamp', (o) => { o.assets[1].activatedAt = '0'; }, /activated|lifecycle/i],
  ['unrepresentable lifecycle timestamp', (o) => { o.assets[1].activatedAt = '18446744073709551615'; }, /activated|range/i],
  ['activation before registration', (o) => { o.assets[1].registeredAt = '1787690001'; }, /registered|lifecycle/i],
  ['inactive missing deactivation', (o) => { o.assets[0].deactivatedAt = '0'; }, /deactivated|lifecycle/i],
  ['deactivation before activation', (o) => { o.assets[0].deactivatedAt = '1787689999'; }, /deactivated|lifecycle/i],
  ['missing reverse head proof', (o) => { o.activeHeads.tickerHash.pop(); }, /head/i],
  ['extra reverse head proof', (o) => { o.activeHeads.tickerHash.push({
    dimensionValue: hash('9'), assetVersionKey: o.assets[0].assetVersionKey,
  }); }, /head/i],
  ['conflicting reverse head proof', (o) => { o.activeHeads.tokenAddress[0].assetVersionKey = o.assets[2].assetVersionKey; }, /head/i],
  ['duplicate active dimension', (o) => {
    const replacement = makeAsset({ ticker: 'NVDA', tokenByte: '5', providerByte: '5', registryIndex: 1, active: true });
    o.assets[1] = replacement; o.activeHeads = exactHeads(o.assets);
  }, /active.*ticker|conflict/i],
]) {
  const bad = structuredClone(observation()); mutate(bad);
  let connects = 0;
  __setStockTokenRegistryV2Reader(async () => bad);
  await assert.rejects(() => syncFinalizedStockCatalogV2({
    connect: async () => { connects++; return pool.connect(); },
  }), message, label);
  assert.equal(connects, 0, `${label} is rejected before BEGIN`);
  assert.equal(JSON.stringify(await approvedStockTokenCatalogV2(pool)), beforeFailure,
    `${label} preserves the last-known-good catalog`);
}
for (const [label, bad] of [
  ['nonempty history at catalog version zero', observation({ catalogVersion: '0' })],
  ['empty history at nonzero catalog version', observation({ assets: [], catalogVersion: '1' })],
  ['catalog version below history count', observation({ catalogVersion: '4' })],
]) {
  let connects = 0;
  __setStockTokenRegistryV2Reader(async () => bad);
  await assert.rejects(() => syncFinalizedStockCatalogV2({
    connect: async () => { connects++; return pool.connect(); },
  }), /catalog version|history|version count/i, label);
  assert.equal(connects, 0, `${label} is rejected before BEGIN`);
}
assert(BigInt(MAX_TIMESTAMP_SECONDS) < (1n << 64n));

__setStockTokenRegistryV2Reader(async () => { throw new Error('rpc unavailable'); });
await assert.rejects(() => syncFinalizedStockCatalogV2(pool), /rpc unavailable/);
assert.equal(JSON.stringify(await approvedStockTokenCatalogV2(pool)), beforeFailure,
  'a reader failure never clears last-known-good state');

for (const [label, bad] of [
  ['catalog regression', observation({ catalogVersion: '11', finalizedBlockNumber: '123457', finalizedBlockHash: hash('e') })],
  ['block regression', observation({ catalogVersion: '13', finalizedBlockNumber: '123455', finalizedBlockHash: hash('e') })],
  ['same-height hash conflict', observation({ catalogVersion: '13', finalizedBlockHash: hash('e') })],
]) {
  __setStockTokenRegistryV2Reader(async () => bad);
  await assert.rejects(() => syncFinalizedStockCatalogV2(pool), /regress|same finalized block|monotonic|conflict/i, label);
  assert.equal(JSON.stringify(await approvedStockTokenCatalogV2(pool)), beforeFailure);
}

const truncatedHistory = observation({
  assets: baseAssets.slice(0, 4), catalogVersion: '13', finalizedBlockNumber: '123457',
  finalizedBlockHash: hash('e'),
});
__setStockTokenRegistryV2Reader(async () => truncatedHistory);
await assert.rejects(() => syncFinalizedStockCatalogV2(pool), /complete historical snapshot|omit/i,
  'a tail-truncated but otherwise contiguous observation cannot delete inactive history');
assert.equal(JSON.stringify(await approvedStockTokenCatalogV2(pool)), beforeFailure);

// Immutable identity drift reaches the transaction comparison but rolls back without changing LKG.
const immutableDrift = observation({ catalogVersion: '13', finalizedBlockNumber: '123457',
  finalizedBlockHash: hash('e'), assets: baseAssets.map((a, i) => i === 0 ? { ...a, name: 'Rewritten Apple' } : a) });
immutableDrift.activeHeads = exactHeads(immutableDrift.assets);
__setStockTokenRegistryV2Reader(async () => immutableDrift);
await assert.rejects(() => syncFinalizedStockCatalogV2(pool), /immutable/i);
assert.equal(JSON.stringify(await approvedStockTokenCatalogV2(pool)), beforeFailure);

// An injected mid-transaction write failure must roll back history, heads, run, and singleton state.
__setStockTokenRegistryV2Reader(async () => observation({
  catalogVersion: '13', finalizedBlockNumber: '123457', finalizedBlockHash: hash('e'),
}));
const failingPool = {
  async connect() {
    const transactionCalls = failingPool.transactionCalls;
    return {
      query: async (sql, params) => {
        transactionCalls.push(sql);
        if (/SELECT .*stock_catalog_sync_state_v2/is.test(sql)) return { rows: [{
          chain_id: state.chain_id, registry_address: state.registry_address,
          catalog_version: state.catalog_version, finalized_block_number: state.finalized_block_number,
          finalized_block_hash: state.finalized_block_hash, snapshot_hash: state.snapshot_hash,
        }] };
        if (/SELECT .*stock_asset_versions_v2/is.test(sql)) {
          if (!params?.length) return { rows: baseAssets.map((asset) => ({
            asset_version_key: asset.assetVersionKey, registry_index: asset.registryIndex,
          })) };
          const asset = baseAssets.find((candidate) => candidate.assetVersionKey === params[0]);
          return { rows: [{
            asset_version_key: asset.assetVersionKey, chain_id: asset.chainId,
            ticker_hash: asset.tickerHash, ticker: asset.ticker, name: asset.name,
            token_address: asset.tokenAddress, token_decimals: asset.tokenDecimals,
            robinhood_asset_id_hash: asset.robinhoodAssetIdHash,
            registry_index: asset.registryIndex, registered_at_matches: true,
          }] };
        }
        if (/INSERT INTO stock_asset_active_heads_v2/i.test(sql)) throw new Error('injected head write failure');
        return { rows: [], rowCount: 1 };
      },
      release() {},
    };
  },
  transactionCalls: [],
};
await assert.rejects(() => syncFinalizedStockCatalogV2(failingPool), /injected head write failure/);
assert(failingPool.transactionCalls.some((sql) => /^ROLLBACK$/i.test(sql)),
  'a mid-transaction write failure explicitly rolls back');
assert(!failingPool.transactionCalls.some((sql) => /INSERT INTO stock_catalog_sync_state_v2/i.test(sql)),
  'the singleton commit marker is never written after a partial failure');
assert.equal(JSON.stringify(await approvedStockTokenCatalogV2(pool)), beforeFailure,
  'any transactional failure preserves the full last-known-good snapshot');

// A later finalized block may refresh an unchanged catalogVersion, but it cannot smuggle a catalog
// transition. Mutations caught: accepting active/head/lifecycle/history changes without a version bump.
const sameVersionPool = await makeDb();
__setStockTokenRegistryV2Reader(async () => observation());
await syncFinalizedStockCatalogV2(sameVersionPool);
const metadataOnlyAdvance = observation({
  finalizedBlockNumber: '123457', finalizedBlockHash: hash('e'), observedAt: '1787700100',
});
__setStockTokenRegistryV2Reader(async () => metadataOnlyAdvance);
const metadataAdvanceResult = await syncFinalizedStockCatalogV2(sameVersionPool);
assert.equal(metadataAdvanceResult.synced, true, 'same-version identical catalog may advance finalized metadata');
const sameVersionLkg = JSON.stringify(await approvedStockTokenCatalogV2(sameVersionPool));
const deactivateWithoutVersion = baseAssets.map((asset, index) => index === 1
  ? { ...asset, active: false, deactivatedAt: '1787700200' } : asset);
const lifecycleWithoutVersion = baseAssets.map((asset, index) => index === 2
  ? { ...asset, activatedAt: '1787690001' } : asset);
const appendedWithoutVersion = baseAssets.concat(makeAsset({
  ticker: 'MSFT', tokenByte: '5', providerByte: '5', registryIndex: 5, active: false,
  deactivatedAt: '1787695003',
}));
for (const [label, assets] of [
  ['active/head mutation', deactivateWithoutVersion],
  ['lifecycle mutation', lifecycleWithoutVersion],
  ['appended history', appendedWithoutVersion],
  ['truncated history', baseAssets.slice(0, 4)],
]) {
  const bad = observation({
    assets, catalogVersion: '12', finalizedBlockNumber: '123458',
    finalizedBlockHash: hash('d'), observedAt: '1787700200',
  });
  __setStockTokenRegistryV2Reader(async () => bad);
  await assert.rejects(() => syncFinalizedStockCatalogV2(sameVersionPool),
    /catalog version|same-version|unchanged catalog|history/i, label);
  assert.equal(JSON.stringify(await approvedStockTokenCatalogV2(sameVersionPool)), sameVersionLkg,
    `${label} preserves the last-known-good same-version snapshot`);
}

const nextAssets = baseAssets.map((a, i) => ({
  ...a,
  active: i === 4,
  activatedAt: i === 4 ? '1787710000' : a.activatedAt,
  deactivatedAt: i === 4 ? '0' : ((i === 1 || i === 2) ? '1787710000' : a.deactivatedAt),
}));
const next = observation({ assets: nextAssets, catalogVersion: '13', finalizedBlockNumber: '123457',
  finalizedBlockHash: hash('e'), observedAt: '1787711000' });
__setStockTokenRegistryV2Reader(async () => next);
await syncFinalizedStockCatalogV2(pool);
catalog = await approvedStockTokenCatalogV2(pool);
assert.equal(catalog.assets.length, 5, 'later snapshots update observed state without deleting inactive history');
assert.deepEqual(catalog.activeAssets.map((a) => a.assetVersionKey), [nextAssets[4].assetVersionKey],
  'active heads are rebuilt exactly from the new finalized observation');
assert.equal((await pool.query('SELECT COUNT(*)::INT AS count FROM stock_asset_active_heads_v2')).rows[0].count, 3);

await pool.query("UPDATE stock_catalog_sync_state_v2 SET synced_at=now() - interval '601 seconds' WHERE id=1");
catalog = await approvedStockTokenCatalogV2(pool);
assert.equal(catalog.assets.length, 5, 'staleness retains auditable history');
assert.deepEqual(catalog.activeAssets, [], 'a critical mirror older than ten minutes exposes no voteable actives');
assert.equal(catalog.voteable, false);
assert.equal(catalog.stale, true);

// Public metadata, history, and DB clock must come from one repeatable-read snapshot. The simulated
// concurrent commit occurs between the metadata and history statements; a split-pool read mixes them.
const DB_NOW = new Date('2026-08-26T18:00:00.000Z');
const readState = (catalogVersion, syncedAt) => ({
  chain_id: 4663, registry_address: REGISTRY, catalog_version: catalogVersion,
  finalized_block_number: catalogVersion === '12' ? '123456' : '123457',
  finalized_block_hash: catalogVersion === '12' ? hash('f') : hash('e'),
  snapshot_hash: catalogVersion === '12' ? firstSync.snapshotHash : hash('d'),
  synced_at: syncedAt, db_now: DB_NOW,
});
const oldReadRows = storedRows.map((row) => ({ ...row }));
const newReadRows = storedRows.map((row, index) => ({
  ...row, active: index === 4, last_catalog_version: 13,
}));
function coherentReadDb({ ageSeconds = 0, rows = oldReadRows, stateRow = undefined, interleave = false } = {}) {
  let liveGeneration = 'old';
  const oldState = stateRow === undefined
    ? readState('12', new Date(DB_NOW.getTime() - ageSeconds * 1000)) : stateRow;
  const newState = readState('13', DB_NOW);
  return {
    async connect() {
      let snapshotGeneration = null;
      return {
        async query(sql) {
          if (/^BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY$/i.test(sql)) {
            snapshotGeneration = liveGeneration;
            return { rows: [] };
          }
          if (/FROM stock_catalog_sync_state_v2/i.test(sql)) {
            const selected = snapshotGeneration === 'new' ? newState : oldState;
            if (interleave) liveGeneration = 'new';
            return { rows: selected ? [selected] : [] };
          }
          if (/FROM stock_asset_versions_v2/i.test(sql)) {
            return { rows: snapshotGeneration === 'new' ? newReadRows : rows };
          }
          if (/^(?:COMMIT|ROLLBACK)$/i.test(sql)) return { rows: [] };
          throw new Error(`unexpected coherent read SQL: ${sql}`);
        },
        release() {},
      };
    },
  };
}
const interleavedCatalog = await approvedStockTokenCatalogV2(coherentReadDb({ interleave: true }));
assert.equal(interleavedCatalog.catalogVersion, '12');
assert.deepEqual(interleavedCatalog.assets.map((asset) => asset.lastCatalogVersion),
  ['12', '12', '12', '12', '12'], 'public read is wholly old rather than old metadata plus new assets');

const exactlyFreshDb = coherentReadDb({ ageSeconds: 600 });
const exactlyFresh = await approvedStockTokenCatalogV2(exactlyFreshDb);
assert.equal(exactlyFresh.stale, false, 'exactly 600 database-clock seconds is fresh');
const strictlyStaleDb = coherentReadDb({ ageSeconds: 601 });
const strictlyStale = await approvedStockTokenCatalogV2(strictlyStaleDb);
assert.equal(strictlyStale.stale, true, 'strictly greater than 600 database-clock seconds is stale');

__setStockTokenRegistryV2Reader(async () => observation());
assert.equal(stockCatalogV2.stockTokenRegistryV2ReaderConfigured(), true,
  'worker configuration is a separate explicit predicate');
assert.equal(await stockCatalogV2.stockTokenCatalogV2Ready(exactlyFreshDb), true,
  'fresh configured synchronized nonempty catalog is ready');
assert.equal(await stockCatalogV2.stockTokenCatalogV2Ready(coherentReadDb({ ageSeconds: 601 })), false,
  'stale catalog is not ready');
assert.equal(await stockCatalogV2.stockTokenCatalogV2Ready(coherentReadDb({ rows: [],
  stateRow: readState('0', DB_NOW) })), false, 'empty catalog is not ready');
assert.equal(await stockCatalogV2.stockTokenCatalogV2Ready(coherentReadDb({ stateRow: null, rows: [] })), false,
  'unsynchronized catalog is not ready');
__setStockTokenRegistryV2Reader(null);
const savedRpc = process.env.CHAIN_RPC_URL;
const savedV2Registry = process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS;
delete process.env.CHAIN_RPC_URL;
delete process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS;
assert.equal(stockCatalogV2.stockTokenRegistryV2ReaderConfigured(), false);
assert.equal(await stockCatalogV2.stockTokenCatalogV2Ready(exactlyFreshDb), false,
  'database freshness cannot claim readiness when the sync reader is unconfigured');
if (savedRpc === undefined) delete process.env.CHAIN_RPC_URL; else process.env.CHAIN_RPC_URL = savedRpc;
if (savedV2Registry === undefined) delete process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS;
else process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS = savedV2Registry;

const emptyPool = await makeDb();
const previousAddress = process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS;
process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS = REGISTRY;
__setStockTokenRegistryV2Reader(null);
assert.equal(stockCatalogV2.stockTokenRegistryV2ReaderConfigured(), false,
  'a registry address without an RPC is not configured for sync');
const unsynced = await approvedStockTokenCatalogV2(emptyPool);
assert.deepEqual(unsynced.assets, []);
assert.deepEqual(unsynced.activeAssets, []);
assert.equal(unsynced.voteable, false);
assert.equal(unsynced.stale, true);
__setStockTokenRegistryV2Reader(async () => observation({
  assets: [], catalogVersion: '0', finalizedBlockNumber: '1', finalizedBlockHash: hash('d'),
}));
await syncFinalizedStockCatalogV2(emptyPool);
const syncedEmpty = await approvedStockTokenCatalogV2(emptyPool);
assert.deepEqual(syncedEmpty.assets, []);
assert.deepEqual(syncedEmpty.activeAssets, []);
assert.equal(syncedEmpty.voteable, false, 'a finalized deliberately empty catalog fails closed');
assert.equal(syncedEmpty.stale, false, 'empty and stale are independent fail-closed reasons');
if (previousAddress === undefined) delete process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS;
else process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS = previousAddress;

// The V2 bootstrap deliberately reuses only the legacy pure RHJ parsing/ranking helpers. Duplicates
// remain rejected, top-15 ordering remains exact, and activation/deactivation output remains unsigned.
const rankNow = Date.parse('2026-08-25T03:30:00Z');
const rhjAssets = Array.from({ length: 16 }, (_, i) => ({
  id: `0x${String(i + 1).padStart(64, '0')}`, tokenSymbol: `T${String(i).padStart(2, '0')}`,
  tokenName: `Token ${i}`, tokenDecimals: 18, status: 'ASSET_STATUS_ACTIVE',
  deployments: [{ chainId: 4663, contractAddress: `0x${String(i + 1).padStart(40, '0')}` }],
  tradingCapabilities: { fractionalTradability: 'tradable' },
}));
const parsedAssets = parseRobinhoodStockTokenAssets({ assets: rhjAssets });
const parsedQuotes = parseRobinhoodStockTokenQuotes({ quotes: rhjAssets.map((a, i) => ({
  tokenSymbol: a.tokenSymbol, deployments: a.deployments, bid: '1', ask: '2',
  dailyTradingVolume: String(1000 - i), isTradingHalt: false, generatedAt: '2026-08-25T03:29:30Z',
})) });
const top = selectInitialTopVolumeAssets({ assets: parsedAssets, quotes: parsedQuotes, now: rankNow });
assert.equal(top.length, INITIAL_RWA_APPROVAL_COUNT);
assert.deepEqual(top.map((a) => a.ticker), parsedAssets.slice(0, 15).map((a) => a.ticker));
let fetches = 0;
const cliResult = await runStockCatalogV2Cli({
  argv: ['--activate', 'T00,T01', '--registry', REGISTRY, '--evidence-hash', hash('a'),
    '--review-id', hash('b'), '--approved-at', '1787700000'],
  env: {},
  fetchFn: async () => { fetches++; return { ok: true, json: async () => ({ assets: rhjAssets }) }; },
});
assert.equal(fetches, 1);
assert.equal(cliResult.sendsTransactions, false);
assert.equal(cliResult.transactions.length, 2);
assert.throws(() => runStockCatalogV2Cli({
  argv: ['--activate', 'T00,T00', '--registry', REGISTRY, '--evidence-hash', hash('a'),
    '--review-id', hash('b'), '--approved-at', '1787700000'], env: {}, fetchFn: async () => null,
}), /duplicate/i, 'duplicate activation selection is rejected before provider fetch');

const hostileEnv = {
  CHAIN_RPC_URL: 'https://attacker-rpc.invalid', PRIVATE_KEY: `0x${'42'.repeat(32)}`,
  MNEMONIC: 'hostile wallet seed must be ignored', WALLET_RPC_URL: 'https://wallet.invalid',
  STOCK_TOKEN_REGISTRY_V2_ADDRESS: REGISTRY,
};
const hostileFetches = [];
const hostileActivation = await runStockCatalogV2Cli({
  argv: ['--activate', 'T00', '--evidence-hash', hash('a'), '--review-id', hash('b'),
    '--approved-at', '1787700000'],
  env: hostileEnv,
  fetchFn: async (url, options) => {
    hostileFetches.push({ url, options });
    assert.equal(url, 'https://api.robinhood.com/rhj/assets');
    assert.equal(options?.method, undefined, 'RHJ intake is an ordinary GET');
    return { ok: true, json: async () => ({ assets: rhjAssets }) };
  },
});
assert.equal(hostileActivation.transactions.length, 1);
assert.deepEqual(hostileFetches.map(({ url }) => url), ['https://api.robinhood.com/rhj/assets'],
  'hostile wallet/RPC env cannot add RPC, send, or non-RHJ network work');
let hostileDeactivateFetches = 0;
const hostileDeactivation = await runStockCatalogV2Cli({
  argv: ['--deactivate-key', LITERAL_AAPL_KEY, '--reason-hash', hash('c')], env: hostileEnv,
  fetchFn: async () => { hostileDeactivateFetches++; throw new Error('network forbidden'); },
});
assert.equal(hostileDeactivation.transactions.length, 1);
assert.equal(hostileDeactivateFetches, 0, 'deactivation remains zero-network under hostile env');

const offline = execFileSync(process.execPath, [
  'tools/robinhood-stock-catalog-v2.js', '--deactivate-key', LITERAL_AAPL_KEY,
  '--registry', REGISTRY, '--reason-hash', hash('c'),
], { cwd: new URL('..', import.meta.url), encoding: 'utf8', env: { ...process.env } });
const offlineJson = JSON.parse(offline);
assert.equal(offlineJson.mode, 'safe-deactivation-proposal');
assert.equal(offlineJson.sendsTransactions, false);
assert.equal(offlineJson.transactions.length, 1,
  'deactivation-key mode completes offline and therefore cannot fetch RHJ');

const cliSource = await readFile(new URL('../tools/robinhood-stock-catalog-v2.js', import.meta.url), 'utf8');
const cliImports = [...cliSource.matchAll(/import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"];?/g)]
  .map((match) => match[1]);
assert.deepEqual(cliImports, ['node:url', 'viem', '../src/stockcatalog.js', '../src/stockcatalogv2.js'],
  'CLI import allowlist excludes wallet, RPC, filesystem, subprocess, and network clients');
assert.match(cliSource, /import \{ keccak256, toBytes \} from 'viem'/,
  'the only viem capabilities admitted are pure hashing/byte conversion');
assert.match(cliSource, /buildStockTokenActivationV2, buildStockTokenDeactivationV2/,
  'the only V2 module capabilities admitted are unsigned builders');
const moduleSource = await readFile(new URL('../src/stockcatalogv2.js', import.meta.url), 'utf8');
assert.match(moduleSource, /encodeAbiParameters/, 'canonical ABI encoding is explicit');
assert.doesNotMatch(moduleSource, /encodePacked|encodePackedParameters/, 'packed encoding is forbidden');
assert.match(moduleSource, /getBlock\(\{ blockTag: FINALITY \}\)/,
  'the real reader obtains exactly one finalized block identity');
assert.match(moduleSource, /readContract\(\{[\s\S]*?functionName, args, blockNumber,[\s\S]*?\}\)/,
  'every registry getter is routed through the exact finalized block number');
assert.doesNotMatch(moduleSource, /confirmation|blockTag:\s*['"]latest['"]/i,
  'there is no confirmation-count or latest-block fallback');
assert.match(moduleSource, /SELECT id FROM stock_catalog_sync_lock_v2 WHERE id=1 FOR UPDATE[\s\S]*SELECT chain_id[\s\S]*FOR UPDATE/,
  'bootstrap and steady-state syncs serialize before comparing the singleton');
assert.match(moduleSource, /epochTimestampSql\('\$11'\)/,
  'reader uint64 seconds cross into timestamps through parameterized SQL');
const schema = await readFile(new URL('../schema.sql', import.meta.url), 'utf8');
for (const table of ['stock_catalog_sync_lock_v2', 'stock_catalog_sync_state_v2', 'stock_asset_versions_v2',
  'stock_asset_active_heads_v2', 'stock_catalog_sync_runs_v2', 'stock_catalog_evidence_v2']) {
  assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`), `${table} is additive DDL`);
}
assert.match(schema, /catalog_version NUMERIC\(78,0\)/);
assert.match(schema, /finalized_block_number NUMERIC\(78,0\)/);
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
assert.match(packageJson.scripts.test, /node test\/stockcatalogv2\.js/);
assert.equal(packageJson.scripts['stock-catalog-v2'], 'node tools/robinhood-stock-catalog-v2.js');

__setStockTokenRegistryV2Reader(null);
await emptyPool.end?.();
await sameVersionPool.end?.();
await pool.end?.();
console.log('✅ stock catalog v2: canonical keys/calldata, finalized complete mirror, atomic LKG, stale fail-closed, unsigned CLI');
