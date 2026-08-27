// FINALIZED STOCK TOKEN REGISTRY V2 MIRROR.
//
// The Safe-owned registry is authority. Robinhood HTTP data is discovery evidence only. A complete
// finalized registry observation is validated and hashed before a transaction begins, then replaces
// only the current observed state while retaining every immutable historical version.
import {
  createPublicClient, encodeAbiParameters, encodeFunctionData, getAddress, http, keccak256, numberToHex,
  toBytes,
} from 'viem';
import {
  commitFinalizedObservation, finalizedInboxIdentity, observeFinalized,
} from './finalizedobservation.js';

export const ROBINHOOD_CHAIN_ID_V2 = '4663';
const FINALITY = 'finalized';
const SOURCE = 'robinhood_chain_registry_v2';
const ACTIVATION_TTL_SECONDS = 604800n;
const MAX_TIMESTAMP_SECONDS = 253402300799n;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ZERO_HASH = `0x${'00'.repeat(32)}`;
const DIMENSIONS = ['tickerHash', 'tokenAddress', 'robinhoodAssetIdHash'];
const REGISTRY_OBSERVATION_LIMITS = Object.freeze({
  maxBlockSpan: 10_000n,
  maxLogs: 2_000,
  maxBytes: 2_000_000,
});
const REGISTRY_EVENT_TOPICS = Object.freeze([
  'AssetVersionRegistered(bytes32,bytes32,address,bytes32,string,string,uint8,uint64)',
  'AssetVersionActivated(bytes32,bytes32,bytes32,uint64,uint64,uint256)',
  'AssetVersionDeactivated(bytes32,bytes32,uint64,uint256)',
  'BallotPublished(uint256,bytes32,address,uint8,bytes32,uint256,uint256,uint64,uint64)',
  'PublisherSet(address)',
].map((signature) => keccak256(toBytes(signature))).sort());
const GETTER_CONSUMER_KEY = 'stock_catalog_getter_v2';

const REGISTRY_ABI = [{
  type: 'function', name: 'activateVersion', stateMutability: 'nonpayable', inputs: [{
    name: 'activation', type: 'tuple', components: [
      { name: 'token', type: 'address' }, { name: 'robinhoodAssetIdHash', type: 'bytes32' },
      { name: 'ticker', type: 'string' }, { name: 'name', type: 'string' },
      { name: 'tokenDecimals', type: 'uint8' }, { name: 'evidenceHash', type: 'bytes32' },
      { name: 'reviewId', type: 'bytes32' }, { name: 'approvedAt', type: 'uint64' },
      { name: 'validUntil', type: 'uint64' },
    ],
  }], outputs: [{ name: 'versionKey', type: 'bytes32' }],
}, {
  type: 'function', name: 'deactivateVersion', stateMutability: 'nonpayable', inputs: [
    { name: 'versionKey', type: 'bytes32' }, { name: 'reasonHash', type: 'bytes32' },
  ], outputs: [],
}, {
  type: 'function', name: 'catalogVersion', stateMutability: 'view', inputs: [],
  outputs: [{ name: '', type: 'uint256' }],
}, {
  type: 'function', name: 'versionCount', stateMutability: 'view', inputs: [],
  outputs: [{ name: '', type: 'uint256' }],
}, {
  type: 'function', name: 'versionKeyAt', stateMutability: 'view',
  inputs: [{ name: 'index', type: 'uint256' }], outputs: [{ name: '', type: 'bytes32' }],
}, {
  type: 'function', name: 'getVersion', stateMutability: 'view',
  inputs: [{ name: 'versionKey', type: 'bytes32' }], outputs: [{ name: '', type: 'tuple', components: [
    { name: 'chainId', type: 'uint256' }, { name: 'tickerHash', type: 'bytes32' },
    { name: 'token', type: 'address' }, { name: 'robinhoodAssetIdHash', type: 'bytes32' },
    { name: 'ticker', type: 'string' }, { name: 'name', type: 'string' },
    { name: 'tokenDecimals', type: 'uint8' }, { name: 'active', type: 'bool' },
    { name: 'registeredAt', type: 'uint64' }, { name: 'activatedAt', type: 'uint64' },
    { name: 'deactivatedAt', type: 'uint64' },
  ] }],
}, {
  type: 'function', name: 'activeVersionForTickerHash', stateMutability: 'view',
  inputs: [{ name: 'tickerHash', type: 'bytes32' }], outputs: [{ name: '', type: 'bytes32' }],
}, {
  type: 'function', name: 'activeVersionForToken', stateMutability: 'view',
  inputs: [{ name: 'token', type: 'address' }], outputs: [{ name: '', type: 'bytes32' }],
}, {
  type: 'function', name: 'activeVersionForProviderIdHash', stateMutability: 'view',
  inputs: [{ name: 'providerIdHash', type: 'bytes32' }], outputs: [{ name: '', type: 'bytes32' }],
}];

const SNAPSHOT_ASSET_ARRAY = {
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

function canonicalUint(value, bits, field) {
  let raw;
  if (typeof value === 'bigint') raw = value.toString();
  else if (typeof value === 'string') raw = value;
  else throw new Error(`invalid ${field}: canonical decimal string or BigInt required`);
  if (!/^(?:0|[1-9][0-9]*)$/.test(raw)) throw new Error(`invalid ${field}: noncanonical decimal`);
  const parsed = BigInt(raw);
  if (parsed >= 1n << BigInt(bits)) throw new Error(`invalid ${field}: uint${bits} overflow`);
  return raw;
}

function canonicalTimestamp(value, field, { required = false } = {}) {
  const raw = canonicalUint(value, 64, field);
  const parsed = BigInt(raw);
  if ((required && parsed === 0n) || parsed > MAX_TIMESTAMP_SECONDS) {
    throw new Error(`invalid ${field}: timestamp outside supported range`);
  }
  return raw;
}

function canonicalHash(value, field, { nonzero = false } = {}) {
  const raw = String(value ?? '');
  if (!/^0x[0-9a-f]{64}$/.test(raw)) throw new Error(`invalid ${field}`);
  if (nonzero && raw === ZERO_HASH) throw new Error(`zero ${field}`);
  return raw;
}

function canonicalAddress(value, field, { nonzero = true } = {}) {
  let normalized;
  try { normalized = getAddress(String(value ?? '')); }
  catch { throw new Error(`invalid ${field}`); }
  if (nonzero && normalized.toLowerCase() === ZERO_ADDRESS) throw new Error(`zero ${field}`);
  return normalized;
}

function stockTokenRegistryV2ProductionConfig() {
  const rawRpc = process.env.CHAIN_RPC_URL;
  if (typeof rawRpc !== 'string') return null;
  const trimmedRpc = rawRpc.trim();
  if (!trimmedRpc) return null;
  let parsedRpc;
  try { parsedRpc = new URL(trimmedRpc); }
  catch { return null; }
  if (!['http:', 'https:'].includes(parsedRpc.protocol) || !parsedRpc.hostname) return null;
  let registryAddress;
  let startBlock;
  try {
    registryAddress = canonicalAddress(
      String(process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS ?? '').trim(),
      'configured registry address',
    );
    startBlock = canonicalUint(
      String(process.env.STOCK_TOKEN_REGISTRY_V2_START_BLOCK ?? '').trim(),
      256,
      'configured registry start block',
    );
  } catch {
    return null;
  }
  return { rpc: parsedRpc.toString(), registryAddress, startBlock };
}

function normalizedTicker(value, { requireCanonical = false } = {}) {
  const raw = String(value ?? '').trim();
  const ticker = raw.toUpperCase();
  if (!/^[A-Z0-9._-]{1,24}$/.test(ticker) || (requireCanonical && raw !== ticker)) {
    throw new Error('invalid ticker');
  }
  return ticker;
}

function tokenDecimals(value) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 255) {
    throw new Error('invalid token decimals');
  }
  return value;
}

export function computeStockAssetVersionKey({ chainId, ticker, tokenAddress, robinhoodAssetIdHash }) {
  const canonicalChainId = canonicalUint(chainId, 256, 'chainId');
  const canonicalTicker = normalizedTicker(ticker);
  const token = canonicalAddress(tokenAddress, 'token address');
  const providerHash = canonicalHash(robinhoodAssetIdHash, 'robinhood asset id hash', { nonzero: true });
  return keccak256(encodeAbiParameters(
    [{ type: 'uint256' }, { type: 'bytes32' }, { type: 'address' }, { type: 'bytes32' }],
    [BigInt(canonicalChainId), keccak256(toBytes(canonicalTicker)), token, providerHash],
  ));
}

export function buildStockTokenActivationV2({
  asset, registryAddress, evidenceHash, reviewId, approvedAt,
}) {
  if (!asset || typeof asset !== 'object') throw new Error('invalid asset');
  const chainId = canonicalUint(asset.chainId, 256, 'chainId');
  if (chainId !== ROBINHOOD_CHAIN_ID_V2) throw new Error(`invalid chainId: expected ${ROBINHOOD_CHAIN_ID_V2}`);
  const ticker = normalizedTicker(asset.ticker);
  const name = String(asset.name ?? '').trim();
  if (!name) throw new Error('invalid asset name');
  const tokenAddress = canonicalAddress(asset.tokenAddress ?? asset.token, 'token address');
  const decimals = tokenDecimals(asset.tokenDecimals);
  const providerHash = canonicalHash(asset.robinhoodAssetIdHash, 'robinhood asset id hash', { nonzero: true });
  const evidence = canonicalHash(evidenceHash, 'evidence hash', { nonzero: true });
  const review = canonicalHash(reviewId, 'review id', { nonzero: true });
  const approved = canonicalUint(approvedAt, 64, 'approvedAt');
  const validUntilValue = BigInt(approved) + ACTIVATION_TTL_SECONDS;
  if (validUntilValue >= 1n << 64n) throw new Error('invalid approvedAt: activation TTL uint64 overflow');
  const validUntil = validUntilValue.toString();
  const to = canonicalAddress(registryAddress, 'registry address');
  const activation = {
    token: tokenAddress, robinhoodAssetIdHash: providerHash, ticker, name,
    tokenDecimals: decimals, evidenceHash: evidence, reviewId: review,
    approvedAt: BigInt(approved), validUntil: validUntilValue,
  };
  const assetVersionKey = computeStockAssetVersionKey({
    chainId, ticker, tokenAddress, robinhoodAssetIdHash: providerHash,
  });
  return {
    to, value: '0', operation: 0,
    data: encodeFunctionData({ abi: REGISTRY_ABI, functionName: 'activateVersion', args: [activation] }),
    assetVersionKey, chainId, ticker, name, tokenAddress, tokenDecimals: decimals,
    robinhoodAssetIdHash: providerHash, evidenceHash: evidence, reviewId: review,
    approvedAt: approved, validUntil,
  };
}

export function buildStockTokenDeactivationV2({ assetVersionKey, registryAddress, reasonHash }) {
  const versionKey = canonicalHash(assetVersionKey, 'asset version key', { nonzero: true });
  const reason = canonicalHash(reasonHash, 'reason hash', { nonzero: true });
  const to = canonicalAddress(registryAddress, 'registry address');
  return {
    to, value: '0', operation: 0,
    data: encodeFunctionData({ abi: REGISTRY_ABI, functionName: 'deactivateVersion', args: [versionKey, reason] }),
    assetVersionKey: versionKey, reasonHash: reason,
  };
}

function normalizeAsset(raw, expectedIndex) {
  if (!raw || typeof raw !== 'object') throw new Error(`invalid asset at registry index ${expectedIndex}`);
  const chainId = canonicalUint(raw.chainId, 256, `asset chainId at registry index ${expectedIndex}`);
  if (chainId !== ROBINHOOD_CHAIN_ID_V2) throw new Error(`wrong asset chain at registry index ${expectedIndex}`);
  const registryIndex = canonicalUint(raw.registryIndex, 256, `registry index ${expectedIndex}`);
  if (BigInt(registryIndex) !== BigInt(expectedIndex)) throw new Error('registry indexes must be contiguous and ordered');
  const ticker = normalizedTicker(raw.ticker, { requireCanonical: true });
  const expectedTickerHash = keccak256(toBytes(ticker));
  const suppliedTickerHash = canonicalHash(raw.tickerHash, `ticker hash for ${ticker}`);
  if (suppliedTickerHash !== expectedTickerHash) throw new Error(`ticker hash mismatch for ${ticker}`);
  const name = String(raw.name ?? '').trim();
  if (!name) throw new Error(`invalid name for ${ticker}`);
  const tokenAddress = canonicalAddress(raw.tokenAddress ?? raw.token, `token address for ${ticker}`);
  const decimals = tokenDecimals(raw.tokenDecimals);
  const providerHash = canonicalHash(raw.robinhoodAssetIdHash, `provider hash for ${ticker}`, { nonzero: true });
  const assetVersionKey = canonicalHash(raw.assetVersionKey, `asset version key for ${ticker}`, { nonzero: true });
  const recomputedKey = computeStockAssetVersionKey({ chainId, ticker, tokenAddress, robinhoodAssetIdHash: providerHash });
  if (assetVersionKey !== recomputedKey) throw new Error(`asset version key mismatch for ${ticker}`);
  if (typeof raw.active !== 'boolean') throw new Error(`invalid active flag for ${ticker}`);
  const registeredAt = canonicalTimestamp(raw.registeredAt, `registered timestamp for ${ticker}`, { required: true });
  const activatedAt = canonicalTimestamp(raw.activatedAt, `activated timestamp for ${ticker}`, { required: true });
  const deactivatedAt = canonicalTimestamp(raw.deactivatedAt, `deactivated timestamp for ${ticker}`);
  if (BigInt(registeredAt) > BigInt(activatedAt)
    || (raw.active && deactivatedAt !== '0')
    || (!raw.active && (deactivatedAt === '0' || BigInt(deactivatedAt) < BigInt(activatedAt)))) {
    throw new Error(`invalid lifecycle timestamps for ${ticker}`);
  }
  return {
    assetVersionKey, chainId, tickerHash: suppliedTickerHash, ticker, name, tokenAddress,
    tokenDecimals: decimals, robinhoodAssetIdHash: providerHash, registryIndex,
    active: raw.active, registeredAt, activatedAt, deactivatedAt,
  };
}

function normalizeHeads(rawHeads, assets) {
  if (!rawHeads || typeof rawHeads !== 'object'
    || DIMENSIONS.some((dimension) => !Array.isArray(rawHeads[dimension]))) {
    throw new Error('complete active head proof is required');
  }
  const expected = Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, new Map()]));
  for (const asset of assets.filter((candidate) => candidate.active)) {
    for (const dimension of DIMENSIONS) {
      const value = asset[dimension];
      if (expected[dimension].has(value)) throw new Error(`active ${dimension} conflict`);
      expected[dimension].set(value, asset.assetVersionKey);
    }
  }
  const normalized = {};
  for (const dimension of DIMENSIONS) {
    const seen = new Map();
    normalized[dimension] = rawHeads[dimension].map((entry) => {
      if (!entry || typeof entry !== 'object') throw new Error(`invalid ${dimension} head`);
      const dimensionValue = dimension === 'tokenAddress'
        ? canonicalAddress(entry.dimensionValue, `${dimension} head`)
        : canonicalHash(entry.dimensionValue, `${dimension} head`);
      const assetVersionKey = canonicalHash(entry.assetVersionKey, `${dimension} head key`, { nonzero: true });
      const comparisonValue = dimension === 'tokenAddress' ? dimensionValue.toLowerCase() : dimensionValue;
      if (seen.has(comparisonValue)) throw new Error(`duplicate ${dimension} head`);
      seen.set(comparisonValue, assetVersionKey);
      return { dimensionValue, assetVersionKey };
    });
    if (seen.size !== expected[dimension].size) throw new Error(`incomplete ${dimension} head proof`);
    for (const [value, key] of expected[dimension]) {
      const comparisonValue = dimension === 'tokenAddress' ? value.toLowerCase() : value;
      if (seen.get(comparisonValue) !== key) throw new Error(`conflicting ${dimension} head proof`);
    }
  }
  return normalized;
}

function validateObservation(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('invalid registry observation');
  if (raw.source !== SOURCE) throw new Error(`invalid registry source: expected ${SOURCE}`);
  if (raw.finality !== FINALITY) throw new Error('registry observation must be finalized');
  const chainId = canonicalUint(raw.chainId, 256, 'chainId');
  if (chainId !== ROBINHOOD_CHAIN_ID_V2) throw new Error(`wrong registry chain: expected ${ROBINHOOD_CHAIN_ID_V2}`);
  const registryAddress = canonicalAddress(raw.registryAddress, 'registry address');
  const productionConfig = stockTokenRegistryV2ProductionConfig();
  if (productionConfig && productionConfig.registryAddress !== registryAddress) {
    throw new Error('registry address conflicts with STOCK_TOKEN_REGISTRY_V2_ADDRESS');
  }
  const catalogVersion = canonicalUint(raw.catalogVersion, 256, 'catalog version');
  const finalizedBlockNumber = canonicalUint(raw.finalizedBlockNumber, 256, 'finalized block number');
  const finalizedBlockHash = canonicalHash(raw.finalizedBlockHash, 'finalized block hash', { nonzero: true });
  const observedAt = canonicalTimestamp(raw.observedAt, 'observed timestamp', { required: true });
  if (!Array.isArray(raw.assets)) throw new Error('complete historical asset array is required');
  const assets = raw.assets.map((asset, index) => normalizeAsset(asset, index));
  if ((assets.length === 0 && catalogVersion !== '0')
    || (assets.length > 0 && (catalogVersion === '0' || BigInt(catalogVersion) < BigInt(assets.length)))) {
    throw new Error('catalog version is inconsistent with complete history/version count');
  }
  const keys = new Set();
  for (const asset of assets) {
    if (keys.has(asset.assetVersionKey)) throw new Error(`duplicate asset version key ${asset.assetVersionKey}`);
    keys.add(asset.assetVersionKey);
  }
  const activeHeads = normalizeHeads(raw.activeHeads, assets);
  const snapshotHash = keccak256(encodeAbiParameters([
    { type: 'uint256' }, { type: 'address' }, { type: 'uint256' }, { type: 'uint256' },
    { type: 'bytes32' }, SNAPSHOT_ASSET_ARRAY,
  ], [BigInt(chainId), registryAddress, BigInt(catalogVersion), BigInt(finalizedBlockNumber),
    finalizedBlockHash, assets.map((asset) => ({
      ...asset, chainId: BigInt(asset.chainId), registryIndex: BigInt(asset.registryIndex),
      registeredAt: BigInt(asset.registeredAt), activatedAt: BigInt(asset.activatedAt),
      deactivatedAt: BigInt(asset.deactivatedAt),
    }))]));
  return {
    source: SOURCE, finality: FINALITY, chainId, registryAddress, catalogVersion,
    finalizedBlockNumber, finalizedBlockHash, observedAt, activeHeads, assets, snapshotHash,
  };
}

let _registryReaderV2 = readStockTokenRegistryV2Onchain;
const defaultRegistryV2ClientFactory = (rpc) => createPublicClient({ transport: http(rpc) });
let _registryV2ClientFactory = defaultRegistryV2ClientFactory;
export function __setStockTokenRegistryV2Reader(fn) {
  _registryReaderV2 = fn || readStockTokenRegistryV2Onchain;
}

export function __setStockTokenRegistryV2ClientFactory(fn) {
  _registryV2ClientFactory = fn || defaultRegistryV2ClientFactory;
}

export const stockTokenRegistryV2ReaderConfigured = () => _registryReaderV2 !== readStockTokenRegistryV2Onchain
  || stockTokenRegistryV2ProductionConfig() !== null;

const epochTimestampSql = (parameter) => `CASE WHEN ${parameter}='0' THEN NULL ELSE
  TIMESTAMPTZ '1970-01-01T00:00:00Z' + ((${parameter} || ' seconds')::interval) END`;

function sameAddress(left, right) {
  return String(left).toLowerCase() === String(right).toLowerCase();
}

function storedTimestamp(value) {
  return value == null ? '0' : String(value);
}

function storedAssetMatches(row, asset) {
  return String(row.asset_version_key).toLowerCase() === asset.assetVersionKey
    && String(row.chain_id) === asset.chainId
    && String(row.ticker_hash).toLowerCase() === asset.tickerHash
    && String(row.ticker) === asset.ticker
    && String(row.name) === asset.name
    && sameAddress(row.token_address, asset.tokenAddress)
    && Number(row.token_decimals) === asset.tokenDecimals
    && String(row.robinhood_asset_id_hash).toLowerCase() === asset.robinhoodAssetIdHash
    && String(row.registry_index) === asset.registryIndex
    && row.active === asset.active
    && storedTimestamp(row.registered_at_seconds) === asset.registeredAt
    && storedTimestamp(row.activated_at_seconds) === asset.activatedAt
    && storedTimestamp(row.deactivated_at_seconds) === asset.deactivatedAt;
}

async function applyStockCatalogDomainV2(client, observed, finalizedObservation = null) {
    const state = (await client.query(
      `SELECT chain_id, registry_address, catalog_version, finalized_block_number,
              finalized_block_hash, snapshot_hash, synced_at
         FROM stock_catalog_sync_state_v2 WHERE id=1 FOR UPDATE`)).rows[0];
    if (state) {
      if (String(state.snapshot_hash).toLowerCase() === observed.snapshotHash) {
        return {
          synced: false, replayed: true, entries: observed.assets.length,
          active: observed.assets.filter((asset) => asset.active).length,
          snapshotHash: observed.snapshotHash,
        };
      }
      if (String(state.chain_id) !== observed.chainId || !sameAddress(state.registry_address, observed.registryAddress)) {
        throw new Error('registry identity conflict with last-known-good state');
      }
      const previousCatalog = BigInt(String(state.catalog_version));
      const previousBlock = BigInt(String(state.finalized_block_number));
      const nextCatalog = BigInt(observed.catalogVersion);
      const nextBlock = BigInt(observed.finalizedBlockNumber);
      if (nextCatalog < previousCatalog) throw new Error('catalog version regression');
      if (nextBlock < previousBlock) throw new Error('finalized block regression');
      if (nextBlock === previousBlock) throw new Error('same finalized block has a conflicting snapshot');
      if (nextCatalog === previousCatalog) {
        const storedAssets = (await client.query(
          `SELECT asset_version_key, chain_id, ticker_hash, ticker, name, token_address,
                  token_decimals, robinhood_asset_id_hash, registry_index, active,
                  EXTRACT(EPOCH FROM registered_at)::NUMERIC(78,0) AS registered_at_seconds,
                  EXTRACT(EPOCH FROM activated_at)::NUMERIC(78,0) AS activated_at_seconds,
                  EXTRACT(EPOCH FROM deactivated_at)::NUMERIC(78,0) AS deactivated_at_seconds
             FROM stock_asset_versions_v2 ORDER BY registry_index FOR UPDATE`)).rows;
        if (storedAssets.length !== observed.assets.length
          || storedAssets.some((row, index) => !storedAssetMatches(row, observed.assets[index]))) {
          throw new Error('same catalog version requires unchanged catalog history and lifecycle state');
        }
        const storedHeads = (await client.query(
          `SELECT dimension_type, dimension_value, asset_version_key
             FROM stock_asset_active_heads_v2 ORDER BY dimension_type, dimension_value FOR UPDATE`)).rows;
        const observedHeads = DIMENSIONS.flatMap((dimension) => observed.activeHeads[dimension]
          .map((head) => ({ dimension, ...head })))
          .sort((left, right) => left.dimension.localeCompare(right.dimension)
            || left.dimensionValue.toLowerCase().localeCompare(right.dimensionValue.toLowerCase()));
        if (storedHeads.length !== observedHeads.length || storedHeads.some((row, index) => {
          const expected = observedHeads[index];
          return row.dimension_type !== expected.dimension
            || String(row.dimension_value).toLowerCase() !== expected.dimensionValue.toLowerCase()
            || String(row.asset_version_key).toLowerCase() !== expected.assetVersionKey;
        })) throw new Error('same catalog version requires unchanged active heads');
      }
    }

    const historicalPrefix = (await client.query(
      `SELECT asset_version_key, registry_index
         FROM stock_asset_versions_v2 ORDER BY registry_index FOR UPDATE`)).rows;
    if (historicalPrefix.length > observed.assets.length) {
      throw new Error('complete historical snapshot cannot omit registered asset versions');
    }
    for (let index = 0; index < historicalPrefix.length; index++) {
      const existing = historicalPrefix[index];
      const current = observed.assets[index];
      if (String(existing.registry_index) !== current.registryIndex
        || String(existing.asset_version_key).toLowerCase() !== current.assetVersionKey) {
        throw new Error('immutable historical registry order drift');
      }
    }

    for (const asset of observed.assets) {
      const existing = (await client.query(
        `SELECT asset_version_key, chain_id, ticker_hash, ticker, name, token_address,
                token_decimals, robinhood_asset_id_hash, registry_index,
                ((registered_at IS NULL AND $2='0') OR registered_at=${epochTimestampSql('$2')}) AS registered_at_matches
           FROM stock_asset_versions_v2 WHERE asset_version_key=$1 FOR UPDATE`,
        [asset.assetVersionKey, asset.registeredAt])).rows[0];
      if (existing && (
        String(existing.chain_id) !== asset.chainId
        || String(existing.ticker_hash).toLowerCase() !== asset.tickerHash
        || String(existing.ticker) !== asset.ticker
        || String(existing.name) !== asset.name
        || !sameAddress(existing.token_address, asset.tokenAddress)
        || Number(existing.token_decimals) !== asset.tokenDecimals
        || String(existing.robinhood_asset_id_hash).toLowerCase() !== asset.robinhoodAssetIdHash
        || String(existing.registry_index) !== asset.registryIndex
        || existing.registered_at_matches !== true
      )) throw new Error(`immutable asset version drift for ${asset.assetVersionKey}`);

      await client.query(
        `INSERT INTO stock_asset_versions_v2
           (asset_version_key, chain_id, ticker_hash, ticker, name, token_address, token_decimals,
            robinhood_asset_id_hash, registry_index, active, registered_at, activated_at,
            deactivated_at, last_catalog_version, synced_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,${epochTimestampSql('$11')},
                 ${epochTimestampSql('$12')},${epochTimestampSql('$13')},$14,now())
         ON CONFLICT (asset_version_key) DO UPDATE SET
           active=EXCLUDED.active, activated_at=EXCLUDED.activated_at,
           deactivated_at=EXCLUDED.deactivated_at,
           last_catalog_version=EXCLUDED.last_catalog_version, synced_at=EXCLUDED.synced_at`,
        [asset.assetVersionKey, asset.chainId, asset.tickerHash, asset.ticker, asset.name,
          asset.tokenAddress, asset.tokenDecimals, asset.robinhoodAssetIdHash, asset.registryIndex,
          asset.active, asset.registeredAt, asset.activatedAt, asset.deactivatedAt, observed.catalogVersion]);
    }

    await client.query('DELETE FROM stock_asset_active_heads_v2');
    for (const dimension of DIMENSIONS) {
      for (const head of observed.activeHeads[dimension]) {
        await client.query(
          `INSERT INTO stock_asset_active_heads_v2
             (dimension_type, dimension_value, asset_version_key) VALUES ($1,$2,$3)`,
          [dimension, head.dimensionValue, head.assetVersionKey]);
      }
    }
    await client.query(
      `INSERT INTO stock_catalog_sync_runs_v2
         (sync_id, chain_id, registry_address, catalog_version, finalized_block_number,
          finalized_block_hash, snapshot_hash, observation_hash,finalized_horizon_number,
          finalized_horizon_hash,caught_up,asset_count,observed_at,synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,${epochTimestampSql('$13')},now())`,
      [observed.snapshotHash, observed.chainId, observed.registryAddress, observed.catalogVersion,
        observed.finalizedBlockNumber, observed.finalizedBlockHash, observed.snapshotHash,
        finalizedObservation?.observationHash ?? null,
        finalizedObservation?.finalizedHorizonNumber ?? null,
        finalizedObservation?.finalizedHorizonHash ?? null,
        finalizedObservation?.caughtUp === true,
        observed.assets.length, observed.observedAt]);
    // The singleton is deliberately last: it is the commit marker for the complete history/head/run set.
    await client.query(
      `INSERT INTO stock_catalog_sync_state_v2
         (id, chain_id, registry_address, catalog_version, finalized_block_number,
          finalized_block_hash, snapshot_hash, synced_at)
       VALUES (1,$1,$2,$3,$4,$5,$6,now())
       ON CONFLICT (id) DO UPDATE SET chain_id=EXCLUDED.chain_id,
         registry_address=EXCLUDED.registry_address, catalog_version=EXCLUDED.catalog_version,
         finalized_block_number=EXCLUDED.finalized_block_number,
         finalized_block_hash=EXCLUDED.finalized_block_hash, snapshot_hash=EXCLUDED.snapshot_hash,
         synced_at=EXCLUDED.synced_at`,
      [observed.chainId, observed.registryAddress, observed.catalogVersion,
        observed.finalizedBlockNumber, observed.finalizedBlockHash, observed.snapshotHash]);
    return {
      synced: true, replayed: false, entries: observed.assets.length,
      active: observed.assets.filter((asset) => asset.active).length,
      snapshotHash: observed.snapshotHash,
    };
}

function getterCheckpointFromRow(row) {
  if (!row) return null;
  return {
    chainId: String(row.chain_id),
    contractAddress: canonicalAddress(row.contract_address, 'getter checkpoint registry address'),
    startBlock: String(row.start_block_number),
    lastAppliedBlockNumber: row.last_applied_block_number == null
      ? null : String(row.last_applied_block_number),
    lastAppliedBlockHash: row.last_applied_block_hash == null
      ? null : String(row.last_applied_block_hash).toLowerCase(),
    lastObservationHash: row.last_observation_hash == null
      ? null : String(row.last_observation_hash).toLowerCase(),
  };
}

async function readStockCatalogGetterCheckpoint(pool, config) {
  if (!pool || typeof pool.query !== 'function') return null;
  const row = (await pool.query(
    `SELECT chain_id,contract_address,start_block_number,last_applied_block_number,
            last_applied_block_hash,last_observation_hash
       FROM stock_catalog_getter_checkpoint_v2 WHERE consumer_key=$1`,
    [GETTER_CONSUMER_KEY],
  )).rows[0];
  if (!row) return null;
  const checkpoint = getterCheckpointFromRow(row);
  if (checkpoint.chainId !== ROBINHOOD_CHAIN_ID_V2
      || checkpoint.contractAddress !== config.registryAddress
      || checkpoint.startBlock !== config.startBlock) {
    throw new Error('stock catalog getter checkpoint identity conflicts with production configuration');
  }
  if (checkpoint.lastAppliedBlockNumber == null) return null;
  return checkpoint;
}

function task2ObservationFromFinalizedEvidence(evidence) {
  return {
    ...evidence.getters,
    assets: evidence.getters.assets.map((asset) => ({
      ...asset,
      tokenDecimals: Number(asset.tokenDecimals),
    })),
  };
}

async function markStockCatalogObservationV2(client, observed, {
  observationHash, finalizedHorizonNumber, finalizedHorizonHash, caughtUp,
}) {
  await client.query(
    `UPDATE stock_catalog_sync_state_v2
        SET observation_hash=$1,finalized_horizon_number=$2,finalized_horizon_hash=$3,
            caught_up=$4,verified_at=now(),
            ready_verified_at=CASE WHEN $4 THEN now() ELSE ready_verified_at END
      WHERE id=1`,
    [observationHash, finalizedHorizonNumber, finalizedHorizonHash, caughtUp],
  );
  return observed;
}

function sameInboxRow(row, expected) {
  return row.consumer_key === expected.consumerKey
    && String(row.chain_id) === expected.chainId
    && sameAddress(row.contract_address, expected.contractAddress)
    && String(row.block_number) === expected.blockNumber
    && String(row.block_hash).toLowerCase() === expected.blockHash
    && String(row.transaction_hash).toLowerCase() === expected.transactionHash
    && String(row.transaction_index) === expected.transactionIndex
    && String(row.log_index) === expected.logIndex
    && String(row.topic0).toLowerCase() === expected.topic0
    && row.topics_json === expected.topicsJson
    && row.data_hex === expected.dataHex
    && String(row.observation_hash).toLowerCase() === expected.observationHash;
}

function stockCatalogGetterAdapter(observed) {
  let applied = false;
  return Object.freeze({
    async lockAndReadCheckpoint(client, evidence) {
      // This permanent row is first in every mirror transaction, including bootstrap. It also makes
      // whole-table reverse-head replacement a single deterministic critical section.
      await client.query('SELECT id FROM stock_catalog_sync_lock_v2 WHERE id=1 FOR UPDATE');
      let row = (await client.query(
        `SELECT chain_id,contract_address,start_block_number,last_applied_block_number,
                last_applied_block_hash,last_observation_hash
           FROM stock_catalog_getter_checkpoint_v2
          WHERE consumer_key=$1 FOR UPDATE`,
        [GETTER_CONSUMER_KEY],
      )).rows[0];
      if (!row) {
        await client.query(
          `INSERT INTO stock_catalog_getter_checkpoint_v2
             (consumer_key,chain_id,contract_address,start_block_number,caught_up)
           VALUES ($1,$2,$3,$4,false)`,
          [GETTER_CONSUMER_KEY, evidence.identity.chainId,
            evidence.identity.contractAddress, evidence.identity.startBlock],
        );
        row = (await client.query(
          `SELECT chain_id,contract_address,start_block_number,last_applied_block_number,
                  last_applied_block_hash,last_observation_hash
             FROM stock_catalog_getter_checkpoint_v2
            WHERE consumer_key=$1 FOR UPDATE`,
          [GETTER_CONSUMER_KEY],
        )).rows[0];
      }
      return getterCheckpointFromRow(row);
    },

    async insertOrVerifyInbox(client, evidence) {
      for (const log of evidence.logs) {
        const expected = {
          consumerKey: GETTER_CONSUMER_KEY,
          chainId: evidence.identity.chainId,
          contractAddress: evidence.identity.contractAddress,
          blockNumber: log.blockNumber,
          blockHash: log.blockHash,
          transactionHash: log.transactionHash,
          transactionIndex: log.transactionIndex,
          logIndex: log.logIndex,
          topic0: log.topics[0],
          topicsJson: JSON.stringify(log.topics),
          dataHex: log.data,
          observationHash: evidence.evidenceHash,
        };
        const inboxId = finalizedInboxIdentity({
          chainId: expected.chainId,
          contractAddress: expected.contractAddress,
          blockHash: expected.blockHash,
          transactionHash: expected.transactionHash,
          logIndex: expected.logIndex,
        });
        const existing = (await client.query(
          `SELECT consumer_key,chain_id,contract_address,block_number,block_hash,
                  transaction_hash,transaction_index,log_index,topic0,topics_json,data_hex,
                  observation_hash
             FROM stock_catalog_getter_inbox_v2 WHERE inbox_id=$1`,
          [inboxId],
        )).rows[0];
        if (existing) {
          if (!sameInboxRow(existing, expected)) {
            throw new Error(`conflicting finalized registry inbox identity ${inboxId}`);
          }
          continue;
        }
        await client.query(
          `INSERT INTO stock_catalog_getter_inbox_v2
             (inbox_id,consumer_key,chain_id,contract_address,block_number,block_hash,
              transaction_hash,transaction_index,log_index,topic0,topics_json,data_hex,
              observation_hash)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [inboxId, expected.consumerKey, expected.chainId, expected.contractAddress,
            expected.blockNumber, expected.blockHash, expected.transactionHash,
            expected.transactionIndex, expected.logIndex, expected.topic0, expected.topicsJson,
            expected.dataHex, expected.observationHash],
        );
      }
    },

    async applyDomainState(client, evidence) {
      await applyStockCatalogDomainV2(client, observed, {
        observationHash: evidence.evidenceHash,
        finalizedHorizonNumber: evidence.finalizedHorizon.blockNumber,
        finalizedHorizonHash: evidence.finalizedHorizon.blockHash,
        caughtUp: evidence.caughtUp,
      });
      await markStockCatalogObservationV2(client, observed, {
        observationHash: evidence.evidenceHash,
        finalizedHorizonNumber: evidence.finalizedHorizon.blockNumber,
        finalizedHorizonHash: evidence.finalizedHorizon.blockHash,
        caughtUp: evidence.caughtUp,
      });
      applied = true;
    },

    async advanceCheckpoint(client, evidence) {
      await client.query(
        `UPDATE stock_catalog_getter_checkpoint_v2
            SET last_applied_block_number=$2,last_applied_block_hash=$3,last_observation_hash=$4,
                finalized_horizon_number=$5,finalized_horizon_hash=$6,caught_up=$7,
                verified_at=now(),
                ready_verified_at=CASE WHEN $7 THEN now() ELSE ready_verified_at END
          WHERE consumer_key=$1`,
        [GETTER_CONSUMER_KEY, evidence.head.blockNumber, evidence.head.blockHash,
          evidence.evidenceHash, evidence.finalizedHorizon.blockNumber,
          evidence.finalizedHorizon.blockHash, evidence.caughtUp],
      );
    },

    async readCommittedResult() {
      return {
        synced: applied,
        replayed: !applied,
        entries: observed.assets.length,
        active: observed.assets.filter((asset) => asset.active).length,
        snapshotHash: observed.snapshotHash,
      };
    },
  });
}

async function syncInjectedStockCatalogV2(pool, observed) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM stock_catalog_sync_lock_v2 WHERE id=1 FOR UPDATE');
    const result = await applyStockCatalogDomainV2(client, observed);
    if (!result.replayed) {
      await markStockCatalogObservationV2(client, observed, {
        observationHash: observed.snapshotHash,
        finalizedHorizonNumber: observed.finalizedBlockNumber,
        finalizedHorizonHash: observed.finalizedBlockHash,
        caughtUp: true,
      });
    }
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function syncFinalizedStockCatalogV2(pool) {
  // RPC and complete structural validation happen before commitFinalizedObservation checks out its
  // transaction client. Injected readers retain the Task 2 observation seam and transaction behavior.
  if (_registryReaderV2 !== readStockTokenRegistryV2Onchain) {
    return syncInjectedStockCatalogV2(pool, validateObservation(await _registryReaderV2()));
  }
  const evidence = await readStockTokenRegistryV2Onchain(pool);
  const observed = validateObservation(task2ObservationFromFinalizedEvidence(evidence));
  return commitFinalizedObservation(pool, evidence, stockCatalogGetterAdapter(observed));
}

const isoTimestamp = (value) => value == null ? null
  : (value instanceof Date ? value.toISOString() : new Date(value).toISOString());

function publicAsset(row) {
  return {
    assetVersionKey: row.asset_version_key,
    chainId: String(row.chain_id),
    tickerHash: String(row.ticker_hash).toLowerCase(),
    ticker: String(row.ticker),
    name: row.name,
    tokenAddress: getAddress(row.token_address),
    tokenDecimals: Number(row.token_decimals),
    robinhoodAssetIdHash: String(row.robinhood_asset_id_hash).toLowerCase(),
    registryIndex: String(row.registry_index),
    active: row.active === true,
    registeredAt: isoTimestamp(row.registered_at),
    activatedAt: isoTimestamp(row.activated_at),
    deactivatedAt: isoTimestamp(row.deactivated_at),
    lastCatalogVersion: String(row.last_catalog_version),
    syncedAt: isoTimestamp(row.synced_at),
  };
}

const unavailableBallotCatalog = (reason, config) => ({
  available: false,
  reason,
  source: 'registry_unavailable',
  finality: null,
  chainId: ROBINHOOD_CHAIN_ID_V2,
  registryAddress: config?.registryAddress ?? ZERO_ADDRESS,
  catalogVersion: '0',
  snapshotHash: ZERO_HASH,
  syncedAt: null,
  activeAssets: [],
});

// Transaction-scoped Task 5 catalog seam. Unlike approvedStockTokenCatalogV2(), this helper never
// connects, begins, commits, or releases: the caller supplies the checked-out query client so the
// ballot day, immutable candidates, and catalog evidence share one transaction and one DB wall time.
export async function finalizedStockCatalogForBallotV2(
  client, { canonicalClose, observedEpochSeconds } = {},
) {
  if (!client || typeof client.query !== 'function') throw new Error('a checked-out query client is required');
  const config = stockTokenRegistryV2ProductionConfig();
  if (!config) return unavailableBallotCatalog('configuration', null);
  const close = new Date(canonicalClose);
  const observedEpoch = typeof observedEpochSeconds === 'string' ? observedEpochSeconds : '';
  if (!Number.isFinite(close.getTime()) || !/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(observedEpoch)) {
    throw new Error('canonical ballot close and exact observed DB epoch are required');
  }
  const state = (await client.query(
    `SELECT chain_id,registry_address,catalog_version::text AS catalog_version,
            snapshot_hash,synced_at,ready_verified_at,caught_up,
            (NOT caught_up OR ready_verified_at IS NULL
             OR $1::numeric > EXTRACT(EPOCH FROM ready_verified_at) + 600) AS mirror_stale,
            EXISTS (
              SELECT 1 FROM stock_catalog_getter_checkpoint_v2 c
               WHERE c.consumer_key=$2 AND c.chain_id::text=$3
                 AND lower(c.contract_address)=lower($4)
                 AND c.start_block_number::text=$5
            ) AS getter_identity_matches
       FROM stock_catalog_sync_state_v2 WHERE id=1 /* ticker_ballot_v2_catalog_state */`,
    [observedEpoch, GETTER_CONSUMER_KEY, ROBINHOOD_CHAIN_ID_V2,
      config.registryAddress, config.startBlock],
  )).rows[0];
  if (!state) return unavailableBallotCatalog('unsynchronized', config);
  if (String(state.chain_id) !== ROBINHOOD_CHAIN_ID_V2
      || !sameAddress(state.registry_address, config.registryAddress)
      || state.getter_identity_matches !== true) {
    return unavailableBallotCatalog('identity', config);
  }
  if (state.mirror_stale !== false) return unavailableBallotCatalog('stale', config);
  let catalogVersion;
  let snapshotHash;
  try {
    catalogVersion = canonicalUint(String(state.catalog_version), 256, 'catalog version');
    snapshotHash = canonicalHash(state.snapshot_hash, 'catalog snapshot hash', { nonzero: true });
  } catch {
    return unavailableBallotCatalog('malformed', config);
  }
  const rows = (await client.query(
    `SELECT a.asset_version_key,a.chain_id,a.ticker_hash,a.ticker,a.name,a.token_address,
            a.token_decimals,a.robinhood_asset_id_hash,a.registry_index::text AS registry_index,
            a.active,a.registered_at,a.activated_at,a.deactivated_at,
            a.last_catalog_version::text AS last_catalog_version,a.synced_at
       FROM stock_asset_versions_v2 a
       JOIN stock_asset_active_heads_v2 ht
         ON ht.dimension_type='tickerHash' AND ht.dimension_value=a.ticker_hash
        AND ht.asset_version_key=a.asset_version_key
       JOIN stock_asset_active_heads_v2 ha
         ON ha.dimension_type='tokenAddress' AND lower(ha.dimension_value)=lower(a.token_address)
        AND ha.asset_version_key=a.asset_version_key
       JOIN stock_asset_active_heads_v2 hp
         ON hp.dimension_type='robinhoodAssetIdHash'
        AND hp.dimension_value=a.robinhood_asset_id_hash
        AND hp.asset_version_key=a.asset_version_key
      WHERE a.active AND a.chain_id=4663 AND a.activated_at IS NOT NULL AND a.activated_at < $1
      ORDER BY a.registry_index ASC,a.asset_version_key ASC
      /* ticker_ballot_v2_current_heads */`,
    [close],
  )).rows;
  // A caller-owned transaction may intentionally be READ COMMITTED (the player mutation wrapper is).
  // Re-read the immutable catalog identity after the active-head statement so a concurrent atomic
  // mirror replacement can never combine old evidence with new rows. Catalog versions are monotonic;
  // equality on version + snapshot + identity brackets the middle statement into one coherent view.
  const confirmed = (await client.query(
    `SELECT chain_id,registry_address,catalog_version::text AS catalog_version,
            snapshot_hash,
            (NOT caught_up OR ready_verified_at IS NULL
             OR $1::numeric > EXTRACT(EPOCH FROM ready_verified_at) + 600) AS mirror_stale,
            EXISTS (
              SELECT 1 FROM stock_catalog_getter_checkpoint_v2 c
               WHERE c.consumer_key=$2 AND c.chain_id::text=$3
                 AND lower(c.contract_address)=lower($4)
                 AND c.start_block_number::text=$5
            ) AS getter_identity_matches
       FROM stock_catalog_sync_state_v2 WHERE id=1 /* ticker_ballot_v2_catalog_confirm */`,
    [observedEpoch, GETTER_CONSUMER_KEY, ROBINHOOD_CHAIN_ID_V2,
      config.registryAddress, config.startBlock],
  )).rows[0];
  if (!confirmed
      || String(confirmed.chain_id) !== ROBINHOOD_CHAIN_ID_V2
      || !sameAddress(confirmed.registry_address, config.registryAddress)
      || String(confirmed.catalog_version) !== catalogVersion
      || String(confirmed.snapshot_hash).toLowerCase() !== snapshotHash
      || confirmed.mirror_stale !== false
      || confirmed.getter_identity_matches !== true) {
    return unavailableBallotCatalog('changed', config);
  }
  const activeAssets = [];
  try {
    for (const row of rows) activeAssets.push(publicAsset(row));
  } catch {
    return unavailableBallotCatalog('malformed', config);
  }
  return {
    available: true,
    reason: null,
    source: SOURCE,
    finality: FINALITY,
    chainId: ROBINHOOD_CHAIN_ID_V2,
    registryAddress: config.registryAddress,
    catalogVersion,
    snapshotHash,
    syncedAt: isoTimestamp(state.synced_at),
    activeAssets,
  };
}

export async function approvedStockTokenCatalogV2(db, { expectedGetterIdentity = null } = {}) {
  const client = await db.connect();
  let state;
  let rows = [];
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    state = (await client.query(
      `SELECT chain_id, registry_address, catalog_version, finalized_block_number,
              finalized_block_hash, snapshot_hash, synced_at,ready_verified_at,caught_up,
              (NOT caught_up OR ready_verified_at IS NULL
               OR now() > ready_verified_at + interval '600 seconds') AS mirror_stale,
              CASE WHEN $1::text IS NULL THEN true ELSE EXISTS (
                SELECT 1 FROM stock_catalog_getter_checkpoint_v2 c
                 WHERE c.consumer_key=$2 AND c.chain_id::text=$3
                   AND lower(c.contract_address)=lower($4)
                   AND c.start_block_number::text=$1
              ) END AS getter_identity_matches
         FROM stock_catalog_sync_state_v2 WHERE id=1`,
      [expectedGetterIdentity?.startBlock ?? null, GETTER_CONSUMER_KEY,
        expectedGetterIdentity?.chainId ?? ROBINHOOD_CHAIN_ID_V2,
        expectedGetterIdentity?.registryAddress ?? ZERO_ADDRESS])).rows[0];
    if (state) rows = (await client.query(
      `SELECT asset_version_key, chain_id, ticker_hash, ticker, name, token_address,
              token_decimals, robinhood_asset_id_hash, registry_index, active, registered_at,
              activated_at, deactivated_at, last_catalog_version, synced_at
         FROM stock_asset_versions_v2 ORDER BY registry_index`)).rows;
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
  if (!state) {
    return {
      source: 'registry_unavailable', finality: null, chainId: ROBINHOOD_CHAIN_ID_V2,
      registryAddress: process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS || null,
      catalogVersion: null, finalizedBlockNumber: null, finalizedBlockHash: null,
      snapshotHash: null, syncedAt: null, assets: [], activeAssets: [], voteable: false, stale: true,
    };
  }
  const assets = rows.map(publicAsset);
  const syncedAt = isoTimestamp(state.synced_at);
  const stale = !syncedAt || state.mirror_stale !== false
    || (expectedGetterIdentity != null && state.getter_identity_matches !== true);
  const activeAssets = stale ? [] : assets.filter((asset) => asset.active);
  return {
    source: SOURCE, finality: FINALITY, chainId: String(state.chain_id),
    registryAddress: getAddress(state.registry_address), catalogVersion: String(state.catalog_version),
    finalizedBlockNumber: String(state.finalized_block_number),
    finalizedBlockHash: String(state.finalized_block_hash).toLowerCase(),
    snapshotHash: String(state.snapshot_hash).toLowerCase(), syncedAt,
    assets, activeAssets, voteable: !stale && activeAssets.length > 0, stale,
  };
}

export async function stockTokenCatalogV2Ready(db) {
  const config = stockTokenRegistryV2ProductionConfig();
  if (!config) return false;
  const catalog = await approvedStockTokenCatalogV2(db, { expectedGetterIdentity: {
    chainId: ROBINHOOD_CHAIN_ID_V2,
    registryAddress: config.registryAddress,
    startBlock: config.startBlock,
  } });
  return catalog.voteable && sameAddress(catalog.registryAddress, config.registryAddress);
}

function rawRpcQuantity(value, field) {
  if (typeof value === 'bigint') return value;
  if (typeof value !== 'string' || !/^0x(?:0|[1-9a-f][0-9a-f]*)$/.test(value)) {
    throw new Error(`malformed ${field} RPC quantity`);
  }
  return BigInt(value);
}

function makeStockTokenRegistryV2ObservationClient(client) {
  return Object.freeze({
    finalizedObservationRawTopics: true,
    getChainId: (request) => client.getChainId(request),
    getBlock: (request) => client.getBlock(request),
    readContract: (request) => client.readContract(request),
    getLogs: async ({ address, fromBlock, toBlock, topics }) => {
      const logs = await client.request({
        method: 'eth_getLogs',
        params: [{
          address,
          fromBlock: numberToHex(fromBlock),
          toBlock: numberToHex(toBlock),
          topics,
        }],
      });
      if (!Array.isArray(logs)) return logs;
      return logs.map((log) => ({
        ...log,
        blockNumber: rawRpcQuantity(log.blockNumber, 'log block number'),
        transactionIndex: rawRpcQuantity(log.transactionIndex, 'log transaction index'),
        logIndex: rawRpcQuantity(log.logIndex, 'log index'),
      }));
    },
  });
}

async function readStockTokenRegistryV2AtBlock({ readContract }, head, { registryAddress }) {
  const read = (functionName, args = []) => readContract({
    abi: REGISTRY_ABI, functionName, args,
  });
  const catalogVersion = await read('catalogVersion');
  const count = await read('versionCount');
  const assets = [];
  for (let index = 0n; index < count; index++) {
    const assetVersionKey = await read('versionKeyAt', [index]);
    const version = await read('getVersion', [assetVersionKey]);
    assets.push({
      assetVersionKey, chainId: version.chainId.toString(), tickerHash: version.tickerHash,
      ticker: version.ticker, name: version.name, tokenAddress: version.token,
      tokenDecimals: version.tokenDecimals.toString(), robinhoodAssetIdHash: version.robinhoodAssetIdHash,
      registryIndex: index.toString(), active: version.active,
      registeredAt: version.registeredAt.toString(), activatedAt: version.activatedAt.toString(),
      deactivatedAt: version.deactivatedAt.toString(),
    });
  }
  const getterFor = {
    tickerHash: 'activeVersionForTickerHash', tokenAddress: 'activeVersionForToken',
    robinhoodAssetIdHash: 'activeVersionForProviderIdHash',
  };
  const activeHeads = Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, []]));
  for (const dimension of DIMENSIONS) {
    const uniqueValues = [...new Set(assets.map((asset) => asset[dimension].toLowerCase()))];
    for (const normalizedValue of uniqueValues) {
      const sourceValue = assets.find((asset) => asset[dimension].toLowerCase() === normalizedValue)[dimension];
      const activeHead = await read(getterFor[dimension], [sourceValue]);
      if (String(activeHead).toLowerCase() !== ZERO_HASH) {
        activeHeads[dimension].push({ dimensionValue: sourceValue, assetVersionKey: activeHead });
      }
    }
  }
  return {
    source: SOURCE,
    finality: FINALITY,
    chainId: ROBINHOOD_CHAIN_ID_V2,
    registryAddress,
    catalogVersion: catalogVersion.toString(),
    finalizedBlockNumber: head.blockNumber,
    finalizedBlockHash: head.blockHash,
    observedAt: head.timestamp,
    activeHeads,
    assets,
  };
}

async function readStockTokenRegistryV2Onchain(pool) {
  const config = stockTokenRegistryV2ProductionConfig();
  if (!config) throw new Error('stock token registry v2 unconfigured');
  const checkpoint = await readStockCatalogGetterCheckpoint(pool, config);
  const client = makeStockTokenRegistryV2ObservationClient(_registryV2ClientFactory(config.rpc));
  return observeFinalized({
    client,
    identity: {
      chainId: ROBINHOOD_CHAIN_ID_V2,
      contractAddress: config.registryAddress,
      startBlock: config.startBlock,
    },
    checkpoint,
    topics: REGISTRY_EVENT_TOPICS,
    limits: REGISTRY_OBSERVATION_LIMITS,
    readGetters: (facade, head) => readStockTokenRegistryV2AtBlock(facade, head, config),
  });
}
