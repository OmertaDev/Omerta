#!/usr/bin/env node
// Read Robinhood's official Stock Token asset and price APIs, then emit unsigned Safe calldata for
// OMERTÀ's on-chain allowlist either from an explicit reviewed list or the one-time initial top-15
// volume policy. This tool never holds a private key, never submits a transaction, and never makes
// the provider API an authority over family voting.
import {
  parseRobinhoodStockTokenAssets, buildStockTokenRegistrySafeTransactions,
  buildStockTokenRegistryDeactivationSafeTransactions, parseRobinhoodStockTokenQuotes,
  selectInitialTopVolumeAssets, INITIAL_RWA_APPROVAL_COUNT, INITIAL_RWA_VOLUME_METRIC,
} from '../src/stockcatalog.js';

const ASSET_ENDPOINT = 'https://api.robinhood.com/rhj/assets';
const PRICE_ENDPOINT = 'https://api.robinhood.com/rhj/prices';

function option(name) {
  const exact = process.argv.indexOf(`--${name}`);
  if (exact >= 0) return process.argv[exact + 1];
  const prefix = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return prefix ? prefix.slice(name.length + 3) : null;
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`Robinhood Stock Token catalog intake

Discovery only (no privileged calls):
  node tools/robinhood-stock-catalog.js

Create the one-time initial top-15 underlying-volume Safe proposal:
  node tools/robinhood-stock-catalog.js --initial-top-volume --registry 0x...

Create unsigned Safe registry calls for an explicitly reviewed subset:
  node tools/robinhood-stock-catalog.js --tickers AAPL,SPY,TSLA --registry 0x...

Create unsigned Safe deactivation calls for removed/suspended policy entries:
  node tools/robinhood-stock-catalog.js --deactivate TSLA --registry 0x...

The registry can also come from STOCK_TOKEN_REGISTRY_ADDRESS. Robinhood's dailyTradingVolume is the
underlying security's daily share volume, not Stock Token DEX volume. The initial mode is a one-time
snapshot and does not rotate the approved catalog. Output is JSON on stdout; the tool never sends a
transaction. Review provider identity, canonical address, status, trading capability, legal/product
policy, liquidity/oracle support, and exposure caps before importing the calls into Safe.`);
  process.exit(0);
}

try {
  const rawTickers = option('tickers');
  const rawDeactivate = option('deactivate');
  const initialTopVolume = process.argv.includes('--initial-top-volume');
  if (initialTopVolume && (rawTickers || rawDeactivate)) {
    throw new Error('--initial-top-volume cannot be combined with --tickers or --deactivate');
  }
  const fetchJson = async (endpoint, label) => {
    const response = await fetch(endpoint, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`);
    return response.json();
  };
  const [assetPayload, pricePayload] = await Promise.all([
    fetchJson(ASSET_ENDPOINT, 'Robinhood asset registry'),
    initialTopVolume ? fetchJson(PRICE_ENDPOINT, 'Robinhood bulk price feed') : Promise.resolve(null),
  ]);
  const fetchedAt = new Date();
  const assets = parseRobinhoodStockTokenAssets(assetPayload);
  if (!rawTickers && !rawDeactivate && !initialTopVolume) {
    console.log(JSON.stringify({
      mode: 'discovery',
      authoritative: false,
      source: ASSET_ENDPOINT,
      chainId: 4663,
      fetchedAt: fetchedAt.toISOString(),
      count: assets.length,
      activeFractionalTradable: assets.filter((a) => a.active && a.fractionalTradable).length,
      assets,
      next: 'Re-run with --initial-top-volume and --registry for the launch bootstrap, or --tickers for a reviewed subset.',
    }, null, 2));
  } else {
    const quotes = pricePayload ? parseRobinhoodStockTokenQuotes(pricePayload) : [];
    const rankedAssets = initialTopVolume
      ? selectInitialTopVolumeAssets({ assets, quotes, now: fetchedAt.getTime() })
      : [];
    const tickers = initialTopVolume
      ? rankedAssets.map((asset) => asset.ticker)
      : (rawTickers || '').split(',').map((t) => t.trim()).filter(Boolean);
    const deactivate = (rawDeactivate || '').split(',').map((t) => t.trim()).filter(Boolean);
    const registryAddress = option('registry') || process.env.STOCK_TOKEN_REGISTRY_ADDRESS;
    if (!registryAddress) throw new Error('--registry or STOCK_TOKEN_REGISTRY_ADDRESS is required for a Safe proposal');
    const overlap = tickers.map((t) => t.toUpperCase()).filter((t) => deactivate.map((x) => x.toUpperCase()).includes(t));
    if (overlap.length) throw new Error(`cannot activate and deactivate the same ticker: ${overlap.join(', ')}`);
    const transactions = [
      ...(tickers.length ? buildStockTokenRegistrySafeTransactions({ assets, tickers, registryAddress }) : []),
      ...(deactivate.length ? buildStockTokenRegistryDeactivationSafeTransactions({ tickers: deactivate, registryAddress }) : []),
    ];
    console.log(JSON.stringify({
      mode: initialTopVolume ? 'initial-top-volume-safe-proposal' : 'safe-proposal',
      authoritative: false,
      sendsTransactions: false,
      oneTimeBootstrap: initialTopVolume,
      continuousRotation: false,
      sources: {
        assets: ASSET_ENDPOINT,
        prices: initialTopVolume ? PRICE_ENDPOINT : null,
      },
      chainId: 4663,
      fetchedAt: fetchedAt.toISOString(),
      registryAddress,
      selectedTickers: tickers.map((t) => t.toUpperCase()),
      deactivatedTickers: deactivate.map((t) => t.toUpperCase()),
      ranking: initialTopVolume ? {
        metric: INITIAL_RWA_VOLUME_METRIC,
        metricMeaning: 'underlying security daily share volume (not Stock Token DEX volume)',
        count: INITIAL_RWA_APPROVAL_COUNT,
        assets: rankedAssets.map((asset) => ({
          rank: asset.rank,
          ticker: asset.ticker,
          name: asset.name,
          tokenAddress: asset.tokenAddress,
          dailyTradingVolume: asset.dailyTradingVolume,
          quoteBid: asset.quoteBid,
          quoteAsk: asset.quoteAsk,
          quoteGeneratedAt: asset.quoteGeneratedAt,
        })),
      } : null,
      transactions,
      next: 'Verify every row and import these calls into the OMERTÀ Safe. Legal/product review, route/oracle support, and exposure caps remain required. Family voting changes only after Safe execution and worker sync.',
    }, null, 2));
  }
} catch (error) {
  console.error(`[stock-catalog] ${error?.message || error}`);
  process.exitCode = 1;
}
