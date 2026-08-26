// FINALIZED STOCK TOKEN REGISTRY V2 MIRROR.
//
// The Safe-owned registry is authority. Robinhood HTTP data is discovery evidence only. A complete
// finalized registry observation is validated and hashed before a transaction begins, then replaces
// only the current observed state while retaining every immutable historical version.
import {
  createPublicClient, encodeAbiParameters, encodeFunctionData, getAddress, http, keccak256, toBytes,
} from 'viem';

export const ROBINHOOD_CHAIN_ID_V2 = '4663';
const FINALITY = 'finalized';
const SOURCE = 'robinhood_chain_registry_v2';
const ACTIVATION_TTL_SECONDS = 604800n;
const MAX_MIRROR_AGE_MS = 10 * 60 * 1000;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ZERO_HASH = `0x${'00'.repeat(32)}`;
const DIMENSIONS = ['tickerHash', 'tokenAddress', 'robinhoodAssetIdHash'];

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
  const registeredAt = canonicalUint(raw.registeredAt, 64, `registered timestamp for ${ticker}`);
  const activatedAt = canonicalUint(raw.activatedAt, 64, `activated timestamp for ${ticker}`);
  const deactivatedAt = canonicalUint(raw.deactivatedAt, 64, `deactivated timestamp for ${ticker}`);
  if (raw.active && (activatedAt === '0' || deactivatedAt !== '0')) {
    throw new Error(`invalid active lifecycle timestamps for ${ticker}`);
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
  const configured = process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS;
  if (configured && canonicalAddress(configured, 'configured registry address') !== registryAddress) {
    throw new Error('registry address conflicts with STOCK_TOKEN_REGISTRY_V2_ADDRESS');
  }
  const catalogVersion = canonicalUint(raw.catalogVersion, 256, 'catalog version');
  const finalizedBlockNumber = canonicalUint(raw.finalizedBlockNumber, 256, 'finalized block number');
  const finalizedBlockHash = canonicalHash(raw.finalizedBlockHash, 'finalized block hash', { nonzero: true });
  const observedAt = canonicalUint(raw.observedAt, 64, 'observed timestamp');
  if (!Array.isArray(raw.assets)) throw new Error('complete historical asset array is required');
  const assets = raw.assets.map((asset, index) => normalizeAsset(asset, index));
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
export function __setStockTokenRegistryV2Reader(fn) {
  _registryReaderV2 = fn || readStockTokenRegistryV2Onchain;
}

export const stockTokenCatalogV2Ready = () => _registryReaderV2 !== readStockTokenRegistryV2Onchain
  || !!(process.env.CHAIN_RPC_URL && process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS);

const epochTimestampSql = (parameter) => `CASE WHEN ${parameter}='0' THEN NULL ELSE
  TIMESTAMPTZ '1970-01-01T00:00:00Z' + ((${parameter} || ' seconds')::interval) END`;

function sameAddress(left, right) {
  return String(left).toLowerCase() === String(right).toLowerCase();
}

export async function syncFinalizedStockCatalogV2(pool) {
  // RPC and complete structural validation happen before BEGIN. A malformed/partial observation can
  // therefore neither wait on nor mutate the database's last-known-good snapshot.
  const observed = validateObservation(await _registryReaderV2());
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // The singleton row supplies the steady-state lock. On the first-ever sync no row exists yet,
    // so real Postgres also takes one transaction-scoped namespace lock to serialize bootstrap.
    // pg-mem has no advisory-lock builtin and is single-process, hence the production-only call.
    if (process.env.DATABASE_URL) {
      await client.query('SELECT pg_advisory_xact_lock($1)', [46630002]);
    }
    const state = (await client.query(
      `SELECT chain_id, registry_address, catalog_version, finalized_block_number,
              finalized_block_hash, snapshot_hash, synced_at
         FROM stock_catalog_sync_state_v2 WHERE id=1 FOR UPDATE`)).rows[0];
    if (state) {
      if (String(state.snapshot_hash).toLowerCase() === observed.snapshotHash) {
        await client.query('COMMIT');
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
          finalized_block_hash, snapshot_hash, asset_count, observed_at, synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,${epochTimestampSql('$9')},now())`,
      [observed.snapshotHash, observed.chainId, observed.registryAddress, observed.catalogVersion,
        observed.finalizedBlockNumber, observed.finalizedBlockHash, observed.snapshotHash,
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
    await client.query('COMMIT');
    return {
      synced: true, replayed: false, entries: observed.assets.length,
      active: observed.assets.filter((asset) => asset.active).length,
      snapshotHash: observed.snapshotHash,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
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

export async function approvedStockTokenCatalogV2(db) {
  const state = (await db.query(
    `SELECT chain_id, registry_address, catalog_version, finalized_block_number,
            finalized_block_hash, snapshot_hash, synced_at
       FROM stock_catalog_sync_state_v2 WHERE id=1`)).rows[0];
  if (!state) {
    return {
      source: 'registry_unavailable', finality: null, chainId: ROBINHOOD_CHAIN_ID_V2,
      registryAddress: process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS || null,
      catalogVersion: null, finalizedBlockNumber: null, finalizedBlockHash: null,
      snapshotHash: null, syncedAt: null, assets: [], activeAssets: [], voteable: false, stale: true,
    };
  }
  const rows = (await db.query(
    `SELECT asset_version_key, chain_id, ticker_hash, ticker, name, token_address,
            token_decimals, robinhood_asset_id_hash, registry_index, active, registered_at,
            activated_at, deactivated_at, last_catalog_version, synced_at
       FROM stock_asset_versions_v2 ORDER BY registry_index`)).rows;
  const assets = rows.map(publicAsset);
  const syncedAt = isoTimestamp(state.synced_at);
  const stale = !syncedAt || Date.now() - new Date(syncedAt).getTime() > MAX_MIRROR_AGE_MS;
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

async function readStockTokenRegistryV2Onchain() {
  const rpc = process.env.CHAIN_RPC_URL;
  const configuredAddress = process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS;
  if (!rpc || !configuredAddress) throw new Error('stock token registry v2 unconfigured');
  const registryAddress = canonicalAddress(configuredAddress, 'registry address');
  const client = createPublicClient({ transport: http(rpc) });
  const liveChainId = String(await client.getChainId());
  if (liveChainId !== ROBINHOOD_CHAIN_ID_V2) {
    throw new Error(`stock token registry v2 requires Robinhood Chain ${ROBINHOOD_CHAIN_ID_V2}; RPC is ${liveChainId}`);
  }
  const finalizedBlock = await client.getBlock({ blockTag: FINALITY });
  if (finalizedBlock.number == null || !finalizedBlock.hash) throw new Error('finalized block identity unavailable');
  const blockNumber = finalizedBlock.number;
  const read = (functionName, args = []) => client.readContract({
    address: registryAddress, abi: REGISTRY_ABI, functionName, args, blockNumber,
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
      tokenDecimals: version.tokenDecimals, robinhoodAssetIdHash: version.robinhoodAssetIdHash,
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
      const head = await read(getterFor[dimension], [sourceValue]);
      if (String(head).toLowerCase() !== ZERO_HASH) {
        activeHeads[dimension].push({ dimensionValue: sourceValue, assetVersionKey: head });
      }
    }
  }
  return {
    source: SOURCE, finality: FINALITY, chainId: liveChainId, registryAddress,
    catalogVersion: catalogVersion.toString(), finalizedBlockNumber: blockNumber.toString(),
    finalizedBlockHash: finalizedBlock.hash, observedAt: finalizedBlock.timestamp.toString(),
    activeHeads, assets,
  };
}
