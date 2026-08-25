import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { makeDb } from '../src/db.js';
import { TICKER_BALLOT } from '../src/rules.js';
import {
  approvedStockTokenCatalog, syncApprovedStockTokenCatalog, __setStockTokenRegistryReader,
  parseRobinhoodStockTokenAssets, buildStockTokenRegistrySafeTransactions,
  buildStockTokenRegistryDeactivationSafeTransactions, parseRobinhoodStockTokenQuotes,
  selectInitialTopVolumeAssets, INITIAL_RWA_APPROVAL_COUNT, INITIAL_RWA_VOLUME_METRIC,
} from '../src/stockcatalog.js';
import {
  publishResolvedStockBallot, __setResolvedBallotPublisher,
} from '../src/rwastockkeeper.js';

const pool = await makeDb();

// Robinhood's public API is a discovery input only. It must resolve the canonical chain-4663
// deployment, preserve provider identity, and produce unsigned Safe calldata only for an explicit
// reviewed selection. An inactive/non-fractional asset can never slip into the proposal.
const robinhoodPayload = { assets: [
  { id: '0x' + '01'.repeat(32), tokenSymbol: 'AAPL', tokenName: 'Apple • Robinhood Token',
    status: 'ASSET_STATUS_ACTIVE', tokenDecimals: 18,
    deployments: [{ chainId: 4663, networkName: 'Robinhood Chain', contractAddress: '0x1111111111111111111111111111111111111111' }],
    tradingCapabilities: { market: { whole: 'TRADING_STATUS_TRADABLE', fractional: 'TRADING_STATUS_TRADABLE' } } },
  { id: '0x' + '02'.repeat(32), tokenSymbol: 'TSLA', tokenName: 'Tesla • Robinhood Token',
    status: 'ASSET_STATUS_INACTIVE', tokenDecimals: 18,
    deployments: [{ chainId: 4663, networkName: 'Robinhood Chain', contractAddress: '0x2222222222222222222222222222222222222222' }],
    tradingCapabilities: { market: { whole: 'TRADING_STATUS_TRADABLE', fractional: 'TRADING_STATUS_TRADABLE' } } },
  { id: '0x' + '03'.repeat(32), tokenSymbol: 'NVDA', tokenName: 'Nvidia • Robinhood Token',
    status: 'ASSET_STATUS_ACTIVE', tokenDecimals: 18,
    deployments: [{ chainId: 4663, networkName: 'Robinhood Chain', contractAddress: '0x3333333333333333333333333333333333333333' }],
    tradingCapabilities: { fractionalTradability: 'tradable', wholeShareTradability: 'tradable' } },
  { id: '0x' + '05'.repeat(32), tokenSymbol: 'MSFT', tokenName: 'Microsoft • Robinhood Token',
    status: 'ASSET_STATUS_ACTIVE', tokenDecimals: 18,
    deployments: [{ chainId: 4663, networkName: 'Robinhood Chain', contractAddress: '0x5555555555555555555555555555555555555555' }],
    tradingCapabilities: { fractionalTradability: 'untradable', wholeShareTradability: 'tradable' } },
  { id: '0x' + '04'.repeat(32), tokenSymbol: 'WRONG', tokenName: 'Wrong Chain',
    status: 'ASSET_STATUS_ACTIVE', tokenDecimals: 18,
    deployments: [{ chainId: 1, networkName: 'Ethereum', contractAddress: '0x4444444444444444444444444444444444444444' }] },
] };
const discovered = parseRobinhoodStockTokenAssets(robinhoodPayload);
assert.deepEqual(discovered.map((a) => a.ticker), ['AAPL', 'MSFT', 'NVDA', 'TSLA']);
assert.equal(discovered[0].tokenAddress, '0x1111111111111111111111111111111111111111');
assert.equal(discovered[0].providerAssetId, '0x' + '01'.repeat(32));
assert.equal(discovered[0].fractionalTradable, true);
assert.equal(discovered.find((a) => a.ticker === 'NVDA').fractionalTradable, true,
  'the parser accepts Robinhood\'s documented fractionalTradability shape');
assert.equal(discovered.find((a) => a.ticker === 'MSFT').fractionalTradable, false);
const proposal = buildStockTokenRegistrySafeTransactions({
  assets: discovered, tickers: ['AAPL'],
  registryAddress: '0x9999999999999999999999999999999999999999',
});
assert.equal(proposal.length, 1);
assert.equal(proposal[0].to, '0x9999999999999999999999999999999999999999');
assert.equal(proposal[0].value, '0');
assert.equal(proposal[0].operation, 0);
assert.match(proposal[0].data, /^0x[0-9a-f]+$/i);
assert.match(proposal[0].assetKey, /^0x[0-9a-f]{64}$/i);
assert.match(proposal[0].robinhoodAssetIdHash, /^0x[0-9a-f]{64}$/i);
const deactivation = buildStockTokenRegistryDeactivationSafeTransactions({
  tickers: ['TSLA'], registryAddress: proposal[0].to,
});
assert.equal(deactivation.length, 1);
assert.equal(deactivation[0].ticker, 'TSLA');
assert.equal(deactivation[0].active, false);
assert.match(deactivation[0].data, /^0x[0-9a-f]+$/i);
await assert.rejects(async () => buildStockTokenRegistrySafeTransactions({
  assets: discovered, tickers: ['TSLA'], registryAddress: proposal[0].to,
}), /not active and fractional-tradable/);
await assert.rejects(async () => buildStockTokenRegistrySafeTransactions({
  assets: discovered, tickers: ['MSFT'], registryAddress: proposal[0].to,
}), /not active and fractional-tradable/);

// Initial launch approval is a deterministic, one-time top-15 snapshot. Robinhood documents
// dailyTradingVolume as the underlying security's daily share volume; it is not DEX volume. The
// ranking must join quotes to the canonical chain-4663 token address, reject stale/halted/bad-market
// observations, and break equal-volume ties by ticker. The registry preserves this ranked insertion
// order so the highest-volume approved token, not an arbitrary alphabetic ticker, is the fallback.
assert.equal(INITIAL_RWA_APPROVAL_COUNT, 15);
assert.equal(INITIAL_RWA_VOLUME_METRIC, 'underlying_daily_share_volume');
const rankingNow = Date.parse('2026-08-25T03:30:00Z');
const rankTickers = ['SPY', ...Array.from({ length: 16 }, (_, i) => `T${String(i + 1).padStart(2, '0')}`)];
const rankingAssets = rankTickers.map((ticker, i) => ({
  providerAssetId: `0x${(i + 100).toString(16).padStart(64, '0')}`,
  ticker,
  name: `${ticker} Token`,
  tokenAddress: `0x${(i + 100).toString(16).padStart(40, '0')}`,
  chainId: 4663,
  active: true,
  fractionalTradable: true,
}));
const extraAssets = [
  ['HALT', true, true], ['STALE', true, true], ['MISMATCH', true, true],
  ['NOBID', true, true], ['ZERO', true, true], ['INACTIVE', false, true],
  ['UNFRAC', true, false],
].map(([ticker, active, fractionalTradable], i) => ({
  providerAssetId: `0x${(i + 200).toString(16).padStart(64, '0')}`,
  ticker,
  name: `${ticker} Token`,
  tokenAddress: `0x${(i + 200).toString(16).padStart(40, '0')}`,
  chainId: 4663,
  active,
  fractionalTradable,
}));
const volumeFor = (ticker) => {
  if (ticker === 'SPY') return '900719925474099312345'; // proves ranking never coerces to Number
  const index = Number(ticker.slice(1));
  return String(index === 5 || index === 6 ? 195 : 201 - index);
};
const quoteFor = (asset, overrides = {}) => ({
  tokenSymbol: asset.ticker,
  deployments: [{ chainId: 4663, networkName: 'Robinhood Chain', contractAddress: asset.tokenAddress }],
  bid: '10.00', ask: '10.01', dailyTradingVolume: volumeFor(asset.ticker),
  isTradingHalt: false, generatedAt: '2026-08-25T03:29:30.123456789Z',
  ...overrides,
});
const extraQuotes = [
  quoteFor(extraAssets[0], { dailyTradingVolume: '999999999999', isTradingHalt: true }),
  quoteFor(extraAssets[1], { dailyTradingVolume: '999999999998', generatedAt: '2026-08-25T03:00:00Z' }),
  quoteFor(extraAssets[2], { dailyTradingVolume: '999999999997',
    deployments: [{ chainId: 4663, contractAddress: '0x9999999999999999999999999999999999999999' }] }),
  quoteFor(extraAssets[3], { dailyTradingVolume: '999999999996', bid: '0' }),
  quoteFor(extraAssets[4], { dailyTradingVolume: '0' }),
  quoteFor(extraAssets[5], { dailyTradingVolume: '999999999995' }),
  quoteFor(extraAssets[6], { dailyTradingVolume: '999999999994' }),
];
const rankingQuotes = parseRobinhoodStockTokenQuotes({
  quotes: [...rankTickers].reverse().map((ticker) => quoteFor(rankingAssets.find((a) => a.ticker === ticker)))
    .concat(extraQuotes),
});
const quoteWithoutHaltState = quoteFor(rankingAssets[0]);
delete quoteWithoutHaltState.isTradingHalt;
assert.throws(() => parseRobinhoodStockTokenQuotes({ quotes: [quoteWithoutHaltState] }),
  /invalid Robinhood Stock Token quote/,
  'a missing halt state fails closed instead of being interpreted as tradable');
const initialSelection = selectInitialTopVolumeAssets({
  assets: rankingAssets.concat(extraAssets), quotes: rankingQuotes, now: rankingNow,
});
assert.equal(initialSelection.length, 15);
assert.equal(initialSelection[0].ticker, 'SPY');
assert.deepEqual(initialSelection.slice(1).map((a) => a.ticker),
  ['T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07', 'T08', 'T09', 'T10', 'T11', 'T12', 'T13', 'T14']);
assert.deepEqual(initialSelection.slice(4, 7).map((a) => a.ticker), ['T04', 'T05', 'T06'],
  'equal volume ties use ticker order');
assert.equal(initialSelection[0].dailyTradingVolume, '900719925474099312345');
assert(initialSelection.every((a, i) => a.rank === i + 1));
const selectionWithoutStaticDefault = selectInitialTopVolumeAssets({
  assets: rankingAssets.filter((a) => a.ticker !== 'SPY'),
  quotes: rankingQuotes.filter((q) => q.ticker !== 'SPY'), now: rankingNow,
});
assert.equal(selectionWithoutStaticDefault.length, 15,
  'production selection is the exact top 15 even when the development-only SPY fallback is absent');

// Once a production registry address is configured, an unsynchronized node must fail closed. The
// static launch list is useful only while the chain integration is deliberately dormant.
const unsyncedPool = await makeDb();
process.env.STOCK_TOKEN_REGISTRY_ADDRESS = '0x9999999999999999999999999999999999999999';
const unsynced = await approvedStockTokenCatalog(unsyncedPool);
assert.equal(unsynced.source, 'registry_unavailable');
assert.deepEqual(unsynced.tickers, []);
delete process.env.STOCK_TOKEN_REGISTRY_ADDRESS;
await unsyncedPool.end?.();

// Chain-dormant/dev starts from the published launch allowlist; it is explicitly not presented as
// a verified token-address catalog.
let catalog = await approvedStockTokenCatalog(pool);
assert.equal(catalog.source, 'launch_allowlist');
assert.deepEqual(catalog.tickers, TICKER_BALLOT.TICKERS);
assert(catalog.assets.every((a) => a.tokenAddress === null));

const AAPL = '0x1111111111111111111111111111111111111111';
const TSLA = '0x2222222222222222222222222222222222222222';
const NVDA = '0x3333333333333333333333333333333333333333';
__setStockTokenRegistryReader(async () => [
  { assetKey: '0x' + 'cc'.repeat(32), robinhoodAssetIdHash: '0x' + '03'.repeat(32),
    ticker: 'NVDA', name: 'Nvidia', tokenAddress: NVDA, active: true },
  { assetKey: '0x' + 'aa'.repeat(32), robinhoodAssetIdHash: '0x' + '01'.repeat(32),
    ticker: 'AAPL', name: 'Apple', tokenAddress: AAPL, active: true },
  { assetKey: '0x' + 'bb'.repeat(32), robinhoodAssetIdHash: '0x' + '02'.repeat(32),
    ticker: 'TSLA', name: 'Tesla', tokenAddress: TSLA, active: false },
]);

let sync = await syncApprovedStockTokenCatalog(pool);
assert.equal(sync.synced, true);
assert.equal(sync.active, 2);
catalog = await approvedStockTokenCatalog(pool);
assert.equal(catalog.source, 'robinhood_chain_registry');
assert.deepEqual(catalog.tickers, ['AAPL', 'NVDA'], 'families see only active Safe-approved assets');
assert.equal(catalog.defaultTicker, 'NVDA', 'production fallback preserves the Safe registry order');
assert.equal(catalog.assets.find((a) => a.ticker === 'NVDA').tokenAddress, NVDA);
assert(catalog.syncedAt, 'the voter list says when the chain registry was last observed');

// A later registry sync deactivates old entries and activates new ones. The list is current without
// deleting the historical identity/address row an old ballot may still need for audit.
__setStockTokenRegistryReader(async () => [
  { assetKey: '0x' + 'aa'.repeat(32), robinhoodAssetIdHash: '0x' + '01'.repeat(32),
    ticker: 'AAPL', name: 'Apple', tokenAddress: AAPL, active: false },
  { assetKey: '0x' + 'bb'.repeat(32), robinhoodAssetIdHash: '0x' + '02'.repeat(32),
    ticker: 'TSLA', name: 'Tesla', tokenAddress: TSLA, active: true },
]);
sync = await syncApprovedStockTokenCatalog(pool);
assert.equal(sync.active, 1);
catalog = await approvedStockTokenCatalog(pool);
assert.deepEqual(catalog.tickers, ['TSLA']);
assert.equal(catalog.defaultTicker, 'TSLA', 'if the broad-market default is unavailable, the first active entry fails safe');

// A dead RPC does not replace a known-good list with an empty/fallback list.
__setStockTokenRegistryReader(async () => { throw new Error('rpc down'); });
await assert.rejects(() => syncApprovedStockTokenCatalog(pool), /rpc down/);
assert.deepEqual((await approvedStockTokenCatalog(pool)).tickers, ['TSLA'], 'last known approved state survives the outage');

// The resolved family vote is committed on-chain by asset key, never by a caller-supplied address.
const ballotDay = 4242;
await pool.query(
  "INSERT INTO ticker_ballot_results (day, ticker, votes, weighted, decided_by) VALUES ($1,'AAPL',1,1,'chamber')",
  [ballotDay - 1]);
await pool.query(
  "INSERT INTO ticker_ballot_results (day, ticker, votes, weighted, decided_by) VALUES ($1,'TSLA',2,9,'chamber')",
  [ballotDay]);
await pool.query(
  `INSERT INTO commission_ticker_votes (day, gang_id, ticker, standing) VALUES
   ($1,'family-b','AAPL',80), ($1,'family-a','TSLA',100)`, [ballotDay]);
const published = [];
__setResolvedBallotPublisher(async (payload) => { published.push(payload); return '0xballot-tx'; });
let result = await publishResolvedStockBallot(pool);
assert.equal(result.published, true);
assert.equal(result.day, ballotDay);
assert.equal(result.ticker, 'TSLA');
assert.equal(result.assetKey, '0x' + 'bb'.repeat(32));
assert.match(result.tallyHash, /^0x[0-9a-f]{64}$/i);
assert.equal(published[0].assetKey, result.assetKey);
assert.equal((await pool.query('SELECT registry_tx_hash FROM ticker_ballot_results WHERE day=$1', [ballotDay])).rows[0].registry_tx_hash,
  '0xballot-tx', 'the DB records the chain publication after the send succeeds');
result = await publishResolvedStockBallot(pool);
assert.equal(result.published, false, 'the same resolved day is never published twice');
assert.equal(published.length, 1);

// Pin the two live consumers: the family ballot validates/publishes this catalog, and the worker
// refreshes it before resolving yesterday's result.
const commissionSource = await readFile(new URL('../src/commission.js', import.meta.url), 'utf8');
const workerSource = await readFile(new URL('../src/worker.js', import.meta.url), 'utf8');
const intakeSource = await readFile(new URL('../tools/robinhood-stock-catalog.js', import.meta.url), 'utf8');
assert.match(commissionSource, /approvedStockTokenCatalog/,
  'Commission voting reads the approved registry cache instead of only a compiled ticker array');
assert.match(workerSource, /safe\('stock token catalog',\s*\(\)\s*=>\s*syncApprovedStockTokenCatalog\(pool\)\)/,
  'the worker refreshes the voter list automatically');
assert.match(workerSource, /safe\('RWA ballot publish',\s*\(\)\s*=>\s*publishResolvedStockBallot\(pool\)\)/,
  'the worker commits resolved family ballots to the on-chain registry automatically');
assert.match(intakeSource, /https:\/\/api\.robinhood\.com\/rhj\/assets/,
  'the operator catalog intake uses Robinhood\'s official asset registry endpoint');
assert.match(intakeSource, /https:\/\/api\.robinhood\.com\/rhj\/prices/,
  'the initial approval intake uses Robinhood\'s official bulk price endpoint');
assert.match(intakeSource, /--initial-top-volume/,
  'the one-time automatic top-volume bootstrap is an explicit operator mode');
assert.match(intakeSource, /selectInitialTopVolumeAssets/,
  'the bootstrap ranks eligible assets before producing Safe calls');
assert.match(intakeSource, /buildStockTokenRegistrySafeTransactions/,
  'the intake produces reviewable Safe calls instead of sending privileged registry writes');

__setStockTokenRegistryReader(null);
__setResolvedBallotPublisher(null);
await pool.end?.();
console.log('✅ stock token catalog: chain-dormant allowlist, Safe-registry sync, active-only family ballot, and last-known-good outage behavior');
