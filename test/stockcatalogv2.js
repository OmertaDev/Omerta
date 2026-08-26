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
  stockTokenCatalogV2Ready,
  syncFinalizedStockCatalogV2,
} from '../src/stockcatalogv2.js';
import { runStockCatalogV2Cli } from '../tools/robinhood-stock-catalog-v2.js';

const CHAIN_ID = '4663';
const REGISTRY = '0x9999999999999999999999999999999999999999';
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
assert.equal(tickerHash('AAPL'), LITERAL_AAPL_TICKER_HASH);
assert.equal(keccak256(LITERAL_AAPL_ABI_PAYLOAD), LITERAL_AAPL_KEY);
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
  registeredAt = '1787680000', activatedAt = active ? '1787690000' : '0', deactivatedAt = '0' }) => {
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
__setStockTokenRegistryV2Reader(async () => hugeObservation);
const hugeSync = await syncFinalizedStockCatalogV2({ connect: async () => fakeClient });
assert.equal(hugeSync.snapshotHash, independentSnapshotHash(hugeObservation),
  'snapshotHash v1 is canonical ABI encoding, not packed encoding');
assert(sqlParams.includes(hugeObservation.catalogVersion));
assert(sqlParams.includes(hugeObservation.finalizedBlockNumber));
assert(!sqlParams.some((v) => typeof v === 'number' && v > 255),
  'uint256/block/timestamp SQL parameters are never JavaScript Numbers');

const pool = await makeDb();
__setStockTokenRegistryV2Reader(async () => observation());
assert.equal(stockTokenCatalogV2Ready(), true, 'an injected finalized reader activates the test seam');
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

const emptyPool = await makeDb();
const previousAddress = process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS;
process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS = REGISTRY;
__setStockTokenRegistryV2Reader(null);
assert.equal(stockTokenCatalogV2Ready(), false, 'a registry address without an RPC is not ready');
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
assert.doesNotMatch(cliSource, /privateKey|createWalletClient|sendTransaction|writeContract/,
  'the CLI has no wallet or transaction-send path');
const moduleSource = await readFile(new URL('../src/stockcatalogv2.js', import.meta.url), 'utf8');
assert.match(moduleSource, /encodeAbiParameters/, 'canonical ABI encoding is explicit');
assert.doesNotMatch(moduleSource, /encodePacked|encodePackedParameters/, 'packed encoding is forbidden');
assert.match(moduleSource, /getBlock\(\{ blockTag: FINALITY \}\)/,
  'the real reader obtains exactly one finalized block identity');
assert.match(moduleSource, /readContract\(\{[\s\S]*?functionName, args, blockNumber,[\s\S]*?\}\)/,
  'every registry getter is routed through the exact finalized block number');
assert.doesNotMatch(moduleSource, /confirmation|blockTag:\s*['"]latest['"]/i,
  'there is no confirmation-count or latest-block fallback');
assert.match(moduleSource, /pg_advisory_xact_lock[\s\S]*SELECT chain_id[\s\S]*FOR UPDATE/,
  'bootstrap and steady-state syncs serialize before comparing the singleton');
assert.match(moduleSource, /epochTimestampSql\('\$11'\)/,
  'reader uint64 seconds cross into timestamps through parameterized SQL');
const schema = await readFile(new URL('../schema.sql', import.meta.url), 'utf8');
for (const table of ['stock_catalog_sync_state_v2', 'stock_asset_versions_v2',
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
await pool.end?.();
console.log('✅ stock catalog v2: canonical keys/calldata, finalized complete mirror, atomic LKG, stale fail-closed, unsigned CLI');
