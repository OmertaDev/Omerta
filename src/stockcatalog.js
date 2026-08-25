// THE APPROVED ROBINHOOD STOCK TOKEN CATALOG.
//
// Robinhood's HTTP asset API is discovery, not game authority. An operator synchronizer compares
// active chain-4663 deployments from that API with this Safe-owned on-chain registry; only the Safe
// can approve/deactivate an OMERTÀ candidate. This module mirrors that registry into Postgres so a
// family vote never holds character/family locks across an RPC call. A failed sync leaves the last
// known approved snapshot untouched.
import { TICKER_BALLOT } from './rules.js';
import { encodeFunctionData, getAddress, keccak256, toBytes } from 'viem';

const ROBINHOOD_CHAIN_ID = 4663;
const ROBINHOOD_ACTIVE = 'ASSET_STATUS_ACTIVE';
const ROBINHOOD_TRADABLE = 'TRADING_STATUS_TRADABLE';
const ROBINHOOD_DOCUMENTED_TRADABLE = 'tradable';
export const INITIAL_RWA_APPROVAL_COUNT = 15;
export const INITIAL_RWA_VOLUME_METRIC = 'underlying_daily_share_volume';
const INITIAL_RWA_MAX_QUOTE_AGE_MS = 5 * 60 * 1000;

const REGISTRY_WRITE_ABI = [{
  type: 'function', name: 'upsertAsset', stateMutability: 'nonpayable',
  inputs: [
    { name: 'assetKey', type: 'bytes32' },
    { name: 'token', type: 'address' },
    { name: 'robinhoodAssetIdHash', type: 'bytes32' },
    { name: 'ticker', type: 'string' },
    { name: 'name', type: 'string' },
    { name: 'active', type: 'bool' },
  ],
  outputs: [],
}, {
  type: 'function', name: 'setAssetActive', stateMutability: 'nonpayable',
  inputs: [{ name: 'assetKey', type: 'bytes32' }, { name: 'active', type: 'bool' }],
  outputs: [],
}];

let _registryReader = readStockTokenRegistryOnchain;
export function __setStockTokenRegistryReader(fn) {
  _registryReader = fn || readStockTokenRegistryOnchain;
}
export const stockTokenCatalogReady = () =>
  _registryReader !== readStockTokenRegistryOnchain
  || !!(process.env.CHAIN_RPC_URL && process.env.STOCK_TOKEN_REGISTRY_ADDRESS);

const normalizeAsset = (a) => ({
  assetKey: String(a.assetKey),
  robinhoodAssetIdHash: String(a.robinhoodAssetIdHash),
  ticker: String(a.ticker || '').trim().toUpperCase(),
  name: String(a.name || '').trim(),
  tokenAddress: String(a.tokenAddress || a.token || ''),
  active: !!a.active,
});

// Parse Robinhood's public discovery feed without granting it authority. These observations become
// candidates only; buildStockTokenRegistrySafeTransactions still requires an operator-selected list,
// and the Safe must execute the resulting calls before families can see or vote for an asset.
export function parseRobinhoodStockTokenAssets(payload, { chainId = ROBINHOOD_CHAIN_ID } = {}) {
  if (!payload || !Array.isArray(payload.assets)) throw new Error('invalid Robinhood Stock Token asset payload');
  const out = [];
  for (const raw of payload.assets) {
    const deployment = Array.isArray(raw?.deployments)
      ? raw.deployments.find((d) => Number(d?.chainId) === Number(chainId))
      : null;
    if (!deployment) continue;
    const ticker = String(raw.tokenSymbol || '').trim().toUpperCase();
    const providerAssetId = String(raw.id || '');
    if (!/^[A-Z0-9._-]{1,24}$/.test(ticker)
      || !/^0x[0-9a-f]{64}$/i.test(providerAssetId)
      || !/^0x[0-9a-f]{40}$/i.test(String(deployment.contractAddress || ''))
      || !String(raw.tokenName || '').trim()) {
      throw new Error(`invalid Robinhood Stock Token asset ${ticker || providerAssetId || '(unknown)'}`);
    }
    out.push({
      providerAssetId,
      ticker,
      name: String(raw.tokenName).trim(),
      tokenAddress: getAddress(deployment.contractAddress),
      chainId: Number(deployment.chainId),
      networkName: String(deployment.networkName || ''),
      status: String(raw.status || ''),
      active: raw.status === ROBINHOOD_ACTIVE,
      fractionalTradable: raw?.tradingCapabilities?.market?.fractional === ROBINHOOD_TRADABLE
        || raw?.tradingCapabilities?.fractionalTradability === ROBINHOOD_DOCUMENTED_TRADABLE,
      wholeTradable: raw?.tradingCapabilities?.market?.whole === ROBINHOOD_TRADABLE
        || raw?.tradingCapabilities?.wholeShareTradability === ROBINHOOD_DOCUMENTED_TRADABLE,
      tokenDecimals: Number(raw.tokenDecimals),
      isin: raw.isin ? String(raw.isin) : null,
    });
  }
  return out.sort((a, b) => a.ticker.localeCompare(b.ticker));
}

const normalizeUnsignedDecimal = (value, field, ticker) => {
  const raw = String(value ?? '').trim();
  if (!/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(raw)) {
    throw new Error(`invalid ${field} for Robinhood Stock Token quote ${ticker || '(unknown)'}`);
  }
  const [whole, fraction = ''] = raw.split('.');
  const trimmedFraction = fraction.replace(/0+$/, '');
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
};

const compareUnsignedDecimals = (left, right) => {
  const [leftWhole, leftFraction = ''] = left.split('.');
  const [rightWhole, rightFraction = ''] = right.split('.');
  if (leftWhole.length !== rightWhole.length) return leftWhole.length > rightWhole.length ? 1 : -1;
  if (leftWhole !== rightWhole) return leftWhole > rightWhole ? 1 : -1;
  const width = Math.max(leftFraction.length, rightFraction.length);
  const paddedLeft = leftFraction.padEnd(width, '0');
  const paddedRight = rightFraction.padEnd(width, '0');
  return paddedLeft === paddedRight ? 0 : (paddedLeft > paddedRight ? 1 : -1);
};

// Parse Robinhood's bulk price feed. dailyTradingVolume is documented as the underlying security's
// daily share volume. It is deliberately named as such below so it cannot be mistaken for Stock
// Token DEX volume or the separate mint/burn volume fields present in the live response.
export function parseRobinhoodStockTokenQuotes(payload, { chainId = ROBINHOOD_CHAIN_ID } = {}) {
  if (!payload || !Array.isArray(payload.quotes)) throw new Error('invalid Robinhood Stock Token price payload');
  const out = [];
  const seen = new Set();
  for (const raw of payload.quotes) {
    const deployment = Array.isArray(raw?.deployments)
      ? raw.deployments.find((d) => Number(d?.chainId) === Number(chainId))
      : null;
    if (!deployment) continue;
    const ticker = String(raw.tokenSymbol || '').trim().toUpperCase();
    const generatedAt = String(raw.generatedAt || '');
    const generatedAtMs = Date.parse(generatedAt);
    if (!/^[A-Z0-9._-]{1,24}$/.test(ticker)
      || !/^0x[0-9a-f]{40}$/i.test(String(deployment.contractAddress || ''))
      || !Number.isFinite(generatedAtMs)
      || typeof raw.isTradingHalt !== 'boolean') {
      throw new Error(`invalid Robinhood Stock Token quote ${ticker || '(unknown)'}`);
    }
    if (seen.has(ticker)) throw new Error(`duplicate Robinhood Stock Token quote ${ticker}`);
    seen.add(ticker);
    out.push({
      ticker,
      tokenAddress: getAddress(deployment.contractAddress),
      chainId: Number(deployment.chainId),
      bid: normalizeUnsignedDecimal(raw.bid, 'bid', ticker),
      ask: normalizeUnsignedDecimal(raw.ask, 'ask', ticker),
      dailyTradingVolume: normalizeUnsignedDecimal(raw.dailyTradingVolume, 'dailyTradingVolume', ticker),
      isTradingHalt: raw.isTradingHalt === true,
      generatedAt,
      generatedAtMs,
    });
  }
  return out.sort((a, b) => a.ticker.localeCompare(b.ticker));
}

// Produce the one-time launch selection. This function never grants authority: its output must be
// converted to calls and executed by the registry Safe. Re-running it does not rotate the catalog.
export function selectInitialTopVolumeAssets({
  assets,
  quotes,
  limit = INITIAL_RWA_APPROVAL_COUNT,
  now = Date.now(),
  maxQuoteAgeMs = INITIAL_RWA_MAX_QUOTE_AGE_MS,
}) {
  if (!Array.isArray(assets) || !Array.isArray(quotes)) throw new Error('assets and quotes are required');
  if (!Number.isInteger(limit) || limit < 1) throw new Error('initial approval limit must be a positive integer');
  if (!Number.isFinite(Number(now)) || !Number.isFinite(maxQuoteAgeMs) || maxQuoteAgeMs < 0) {
    throw new Error('invalid quote freshness policy');
  }

  const quoteByTicker = new Map();
  for (const quote of quotes) {
    if (quoteByTicker.has(quote.ticker)) throw new Error(`duplicate quote for ${quote.ticker}`);
    quoteByTicker.set(quote.ticker, quote);
  }
  const seenAssets = new Set();
  const eligible = [];
  for (const asset of assets) {
    if (seenAssets.has(asset.ticker)) throw new Error(`duplicate asset for ${asset.ticker}`);
    seenAssets.add(asset.ticker);
    const quote = quoteByTicker.get(asset.ticker);
    if (!asset.active || !asset.fractionalTradable || !quote || quote.isTradingHalt) continue;
    if (String(asset.tokenAddress).toLowerCase() !== String(quote.tokenAddress).toLowerCase()) continue;
    if (Math.abs(Number(now) - quote.generatedAtMs) > maxQuoteAgeMs) continue;
    if (compareUnsignedDecimals(quote.dailyTradingVolume, '0') <= 0
      || compareUnsignedDecimals(quote.bid, '0') <= 0
      || compareUnsignedDecimals(quote.ask, '0') <= 0) continue;
    eligible.push({
      ...asset,
      dailyTradingVolume: quote.dailyTradingVolume,
      quoteBid: quote.bid,
      quoteAsk: quote.ask,
      quoteGeneratedAt: quote.generatedAt,
      volumeMetric: INITIAL_RWA_VOLUME_METRIC,
    });
  }
  eligible.sort((a, b) => compareUnsignedDecimals(b.dailyTradingVolume, a.dailyTradingVolume)
    || a.ticker.localeCompare(b.ticker));
  if (eligible.length < limit) throw new Error(`only ${eligible.length} assets qualify for the top ${limit}`);
  return eligible.slice(0, limit).map((asset, index) => ({ ...asset, rank: index + 1 }));
}

// Emit Safe Transaction Builder-compatible call fields, not a transaction. Deliberately requires an
// explicit selection: a provider listing is evidence about identity/address, not OMERTÀ approval.
export function buildStockTokenRegistrySafeTransactions({ assets, tickers, registryAddress }) {
  if (!Array.isArray(assets) || !Array.isArray(tickers) || !tickers.length)
    throw new Error('an explicit non-empty ticker selection is required');
  const to = getAddress(registryAddress);
  const selected = [...new Set(tickers.map((t) => String(t).trim().toUpperCase()))];
  if (selected.length !== tickers.length) throw new Error('duplicate ticker in registry proposal');
  return selected.map((ticker) => {
    const asset = assets.find((a) => a.ticker === ticker);
    if (!asset?.active || !asset?.fractionalTradable)
      throw new Error(`${ticker} is not active and fractional-tradable in the Robinhood feed`);
    const assetKey = keccak256(toBytes(ticker));
    const robinhoodAssetIdHash = keccak256(toBytes(asset.providerAssetId));
    const args = [assetKey, getAddress(asset.tokenAddress), robinhoodAssetIdHash,
      ticker, asset.name, true];
    return {
      to,
      value: '0',
      operation: 0,
      data: encodeFunctionData({ abi: REGISTRY_WRITE_ABI, functionName: 'upsertAsset', args }),
      assetKey,
      robinhoodAssetIdHash,
      ticker,
      name: asset.name,
      tokenAddress: getAddress(asset.tokenAddress),
      providerAssetId: asset.providerAssetId,
    };
  });
}

export function buildStockTokenRegistryDeactivationSafeTransactions({ tickers, registryAddress }) {
  if (!Array.isArray(tickers) || !tickers.length)
    throw new Error('an explicit non-empty deactivation list is required');
  const to = getAddress(registryAddress);
  const selected = [...new Set(tickers.map((t) => String(t).trim().toUpperCase()))];
  if (selected.length !== tickers.length) throw new Error('duplicate ticker in registry deactivation proposal');
  return selected.map((ticker) => {
    if (!/^[A-Z0-9._-]{1,24}$/.test(ticker)) throw new Error(`invalid ticker ${ticker || '(blank)'}`);
    const assetKey = keccak256(toBytes(ticker));
    return {
      to,
      value: '0',
      operation: 0,
      data: encodeFunctionData({ abi: REGISTRY_WRITE_ABI, functionName: 'setAssetActive', args: [assetKey, false] }),
      assetKey,
      ticker,
      active: false,
    };
  });
}

export async function approvedStockTokenCatalog(db) {
  const state = (await db.query(
    'SELECT chain_id, registry_address, synced_at FROM stock_token_catalog_state WHERE id=1')).rows[0];
  if (!state) {
    if (process.env.STOCK_TOKEN_REGISTRY_ADDRESS) {
      return {
        source: 'registry_unavailable',
        chainId: ROBINHOOD_CHAIN_ID,
        registryAddress: process.env.STOCK_TOKEN_REGISTRY_ADDRESS,
        syncedAt: null,
        tickers: [],
        defaultTicker: null,
        assets: [],
      };
    }
    return {
      source: 'launch_allowlist',
      chainId: null,
      registryAddress: null,
      syncedAt: null,
      tickers: [...TICKER_BALLOT.TICKERS],
      defaultTicker: TICKER_BALLOT.DEFAULT,
      assets: TICKER_BALLOT.TICKERS.map((ticker) => ({
        assetKey: null, robinhoodAssetIdHash: null, ticker, name: ticker,
        tokenAddress: null, active: true,
      })),
    };
  }

  const rows = (await db.query(
    `SELECT asset_key, robinhood_asset_id_hash, ticker, name, token_address, active, registry_index, synced_at
       FROM stock_token_catalog WHERE active=true ORDER BY ticker`)).rows;
  const assets = rows.map((r) => ({
    assetKey: r.asset_key,
    robinhoodAssetIdHash: r.robinhood_asset_id_hash,
    ticker: String(r.ticker).toUpperCase(),
    name: r.name,
    tokenAddress: r.token_address,
    active: true,
    registryIndex: Number(r.registry_index),
  }));
  const tickers = assets.map((a) => a.ticker);
  const defaultAsset = [...assets].sort((a, b) => a.registryIndex - b.registryIndex
    || a.ticker.localeCompare(b.ticker))[0];
  return {
    source: 'robinhood_chain_registry',
    chainId: Number(state.chain_id),
    registryAddress: state.registry_address,
    syncedAt: state.synced_at,
    tickers,
    defaultTicker: defaultAsset?.ticker || null,
    assets,
  };
}

export async function approvedStockTokenAddressMap(db) {
  const catalog = await approvedStockTokenCatalog(db);
  return Object.fromEntries(catalog.assets
    .filter((a) => a.active && a.tokenAddress)
    .map((a) => [a.ticker, a.tokenAddress]));
}

/// Mirror one complete registry observation atomically. The RPC read happens BEFORE BEGIN, so a slow
/// or dead chain never holds DB locks and cannot partially deactivate the last-known-good catalog.
export async function syncApprovedStockTokenCatalog(pool) {
  const observed = (await _registryReader()).map((asset, registryIndex) => ({
    ...normalizeAsset(asset), registryIndex,
  }));
  for (const a of observed) {
    if (!/^0x[0-9a-f]{64}$/i.test(a.assetKey)
      || !/^0x[0-9a-f]{64}$/i.test(a.robinhoodAssetIdHash)
      || !/^[A-Z0-9._-]{1,24}$/.test(a.ticker)
      || !a.name
      || !/^0x[0-9a-f]{40}$/i.test(a.tokenAddress)) {
      throw new Error(`invalid StockTokenRegistry entry for ${a.ticker || '(blank ticker)'}`);
    }
  }

  const registryAddress = process.env.STOCK_TOKEN_REGISTRY_ADDRESS || 'test-seam';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE stock_token_catalog SET active=false');
    for (const a of observed) {
      const upd = await client.query(
        `UPDATE stock_token_catalog SET robinhood_asset_id_hash=$2, ticker=$3, name=$4,
           token_address=$5, active=$6, registry_index=$7, synced_at=now() WHERE asset_key=$1`,
        [a.assetKey, a.robinhoodAssetIdHash, a.ticker, a.name, a.tokenAddress, a.active, a.registryIndex]);
      if (!upd.rowCount) await client.query(
        `INSERT INTO stock_token_catalog
           (asset_key, robinhood_asset_id_hash, ticker, name, token_address, active, registry_index)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [a.assetKey, a.robinhoodAssetIdHash, a.ticker, a.name, a.tokenAddress, a.active, a.registryIndex]);
    }
    const state = await client.query(
      'UPDATE stock_token_catalog_state SET chain_id=$2, registry_address=$3, synced_at=now() WHERE id=$1',
      [1, ROBINHOOD_CHAIN_ID, registryAddress]);
    if (!state.rowCount) await client.query(
      'INSERT INTO stock_token_catalog_state (id, chain_id, registry_address) VALUES (1,$1,$2)',
      [ROBINHOOD_CHAIN_ID, registryAddress]);
    await client.query('COMMIT');
    return { synced: true, entries: observed.length, active: observed.filter((a) => a.active).length };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { client.release(); }
}

async function readStockTokenRegistryOnchain() {
  const rpc = process.env.CHAIN_RPC_URL;
  const registryAddress = process.env.STOCK_TOKEN_REGISTRY_ADDRESS;
  if (!rpc || !registryAddress) throw new Error('stock token registry unconfigured');
  const { createPublicClient, http } = await import('viem');
  const client = createPublicClient({ transport: http(rpc) });
  const liveChainId = Number(await client.getChainId());
  if (liveChainId !== ROBINHOOD_CHAIN_ID) {
    throw new Error(`stock token registry requires Robinhood Chain ${ROBINHOOD_CHAIN_ID}; RPC is ${liveChainId}`);
  }
  const address = getAddress(registryAddress);
  const countAbi = [{ type: 'function', name: 'assetCount', stateMutability: 'view', inputs: [],
    outputs: [{ type: 'uint256' }] }];
  const keyAbi = [{ type: 'function', name: 'assetKeyAt', stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }], outputs: [{ type: 'bytes32' }] }];
  const assetAbi = [{ type: 'function', name: 'getAsset', stateMutability: 'view',
    inputs: [{ name: 'assetKey', type: 'bytes32' }], outputs: [{ name: '', type: 'tuple', components: [
      { name: 'token', type: 'address' }, { name: 'robinhoodAssetIdHash', type: 'bytes32' },
      { name: 'ticker', type: 'string' }, { name: 'name', type: 'string' }, { name: 'active', type: 'bool' },
    ] }] }];
  const count = Number(await client.readContract({ address, abi: countAbi, functionName: 'assetCount' }));
  const out = [];
  for (let i = 0; i < count; i++) {
    const assetKey = await client.readContract({ address, abi: keyAbi, functionName: 'assetKeyAt', args: [BigInt(i)] });
    const asset = await client.readContract({ address, abi: assetAbi, functionName: 'getAsset', args: [assetKey] });
    out.push({ assetKey, robinhoodAssetIdHash: asset.robinhoodAssetIdHash, ticker: asset.ticker,
      name: asset.name, tokenAddress: asset.token, active: asset.active });
  }
  return out;
}
