#!/usr/bin/env node
// Prepare unsigned StockTokenRegistryV2 Safe calls. Robinhood HTTP is discovery input only; this
// tool has no wallet and no send path. Deactivation by immutable key is deliberately fully offline.
import { pathToFileURL } from 'node:url';
import { keccak256, toBytes } from 'viem';
import {
  INITIAL_RWA_APPROVAL_COUNT, INITIAL_RWA_VOLUME_METRIC, parseRobinhoodStockTokenAssets,
  parseRobinhoodStockTokenQuotes, selectInitialTopVolumeAssets,
} from '../src/stockcatalog.js';
import {
  buildStockTokenActivationV2, buildStockTokenDeactivationV2,
} from '../src/stockcatalogv2.js';

const ASSET_ENDPOINT = 'https://api.robinhood.com/rhj/assets';
const PRICE_ENDPOINT = 'https://api.robinhood.com/rhj/prices';

function option(argv, name) {
  const exact = argv.indexOf(`--${name}`);
  if (exact >= 0) return argv[exact + 1] ?? null;
  const prefix = argv.find((argument) => argument.startsWith(`--${name}=`));
  return prefix ? prefix.slice(name.length + 3) : null;
}

function listOption(argv, name) {
  return (option(argv, name) || '').split(',').map((value) => value.trim()).filter(Boolean);
}

function unique(values, label, { uppercase = false } = {}) {
  const comparison = values.map((value) => value.toLowerCase());
  if (new Set(comparison).size !== comparison.length) throw new Error(`duplicate ${label} selection`);
  return uppercase ? values.map((value) => value.toUpperCase()) : values;
}

async function fetchJson(fetchFn, endpoint, label) {
  const response = await fetchFn(endpoint, { headers: { accept: 'application/json' } });
  if (!response?.ok) throw new Error(`${label} returned HTTP ${response?.status ?? 'unknown'}`);
  return response.json();
}

export function runStockCatalogV2Cli({
  argv = process.argv.slice(2), env = process.env, fetchFn = globalThis.fetch,
} = {}) {
  const deactivateKeys = unique(listOption(argv, 'deactivate-key'), 'deactivation key');
  const activateTickers = unique(listOption(argv, 'activate'), 'activation ticker', { uppercase: true });
  const initialTopVolume = argv.includes('--initial-top-volume');
  if (initialTopVolume && activateTickers.length) {
    throw new Error('--initial-top-volume cannot be combined with --activate');
  }
  if (deactivateKeys.length && (activateTickers.length || initialTopVolume)) {
    throw new Error('--deactivate-key cannot be combined with an activation mode');
  }
  const registryAddress = option(argv, 'registry') || env.STOCK_TOKEN_REGISTRY_V2_ADDRESS;

  // This branch intentionally precedes every fetch. An immutable-key deactivation does not need,
  // and must never accidentally depend on, Robinhood HTTP availability.
  if (deactivateKeys.length) {
    if (!registryAddress) throw new Error('--registry or STOCK_TOKEN_REGISTRY_V2_ADDRESS is required');
    const reasonHash = option(argv, 'reason-hash');
    if (!reasonHash) throw new Error('--reason-hash is required for deactivation');
    return {
      mode: 'safe-deactivation-proposal', authoritative: false, sendsTransactions: false,
      chainId: '4663', registryAddress,
      transactions: deactivateKeys.map((assetVersionKey) => buildStockTokenDeactivationV2({
        assetVersionKey, registryAddress, reasonHash,
      })),
    };
  }

  if (typeof fetchFn !== 'function') throw new Error('fetch is unavailable');
  const execution = async () => {
    const assetPayload = await fetchJson(fetchFn, ASSET_ENDPOINT, 'Robinhood asset registry');
    const assets = parseRobinhoodStockTokenAssets(assetPayload);
    if (!activateTickers.length && !initialTopVolume) {
      return {
        mode: 'discovery', authoritative: false, sendsTransactions: false,
        source: ASSET_ENDPOINT, chainId: '4663', count: assets.length, assets,
      };
    }
    if (!registryAddress) throw new Error('--registry or STOCK_TOKEN_REGISTRY_V2_ADDRESS is required');
    const evidenceHash = option(argv, 'evidence-hash');
    const reviewId = option(argv, 'review-id');
    const approvedAt = option(argv, 'approved-at');
    if (!evidenceHash || !reviewId || !approvedAt) {
      throw new Error('--evidence-hash, --review-id, and --approved-at are required for activation');
    }
    let selected;
    let ranking = null;
    if (initialTopVolume) {
      const pricePayload = await fetchJson(fetchFn, PRICE_ENDPOINT, 'Robinhood bulk price feed');
      const quotes = parseRobinhoodStockTokenQuotes(pricePayload);
      const ranked = selectInitialTopVolumeAssets({ assets, quotes });
      selected = ranked;
      ranking = {
        metric: INITIAL_RWA_VOLUME_METRIC, count: INITIAL_RWA_APPROVAL_COUNT,
        assets: ranked.map(({ rank, ticker, name, tokenAddress, dailyTradingVolume,
          quoteBid, quoteAsk, quoteGeneratedAt }) => ({
          rank, ticker, name, tokenAddress, dailyTradingVolume, quoteBid, quoteAsk, quoteGeneratedAt,
        })),
      };
    } else {
      selected = activateTickers.map((ticker) => {
        const asset = assets.find((candidate) => candidate.ticker === ticker);
        if (!asset) throw new Error(`Robinhood asset not found for ${ticker}`);
        if (!asset.active || !asset.fractionalTradable) {
          throw new Error(`${ticker} is not active and fractional-tradable in the Robinhood feed`);
        }
        return asset;
      });
    }
    const transactions = selected.map((asset) => buildStockTokenActivationV2({
      asset: {
        chainId: String(asset.chainId), ticker: asset.ticker, name: asset.name,
        tokenAddress: asset.tokenAddress, tokenDecimals: asset.tokenDecimals,
        robinhoodAssetIdHash: keccak256(toBytes(asset.providerAssetId)),
      },
      registryAddress, evidenceHash, reviewId, approvedAt,
    }));
    return {
      mode: initialTopVolume ? 'initial-top-volume-safe-proposal' : 'safe-activation-proposal',
      authoritative: false, sendsTransactions: false, oneTimeBootstrap: initialTopVolume,
      continuousRotation: false, sources: { assets: ASSET_ENDPOINT, prices: initialTopVolume ? PRICE_ENDPOINT : null },
      chainId: '4663', registryAddress, selectedTickers: selected.map((asset) => asset.ticker),
      ranking, transactions,
    };
  };
  return execution();
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    process.stdout.write(`${JSON.stringify({
      tool: 'robinhood-stock-catalog-v2', sendsTransactions: false,
      modes: ['--activate TICKER[,TICKER]', '--initial-top-volume', '--deactivate-key 0xKEY[,0xKEY]'],
      activationRequired: ['--registry', '--evidence-hash', '--review-id', '--approved-at'],
      deactivationRequired: ['--registry', '--reason-hash'],
    }, null, 2)}\n`);
  } else {
    Promise.resolve().then(() => runStockCatalogV2Cli()).then((result) => {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    }).catch((error) => {
      process.stderr.write(`${JSON.stringify({ error: 'stock_catalog_v2', message: error?.message || String(error) })}\n`);
      process.exitCode = 1;
    });
  }
}
