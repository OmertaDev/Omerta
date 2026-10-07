import { encodeFunctionData, getAddress, isAddress, keccak256, parseAbi } from 'viem';

const CHAIN_ID = 4663;
const ZERO = '0x0000000000000000000000000000000000000000';
const U64 = (1n << 64n) - 1n, U128 = (1n << 128n) - 1n, U256 = (1n << 256n) - 1n;
const HASH = /^0x[0-9a-fA-F]{64}$/;
const ABI = parseAbi([
  'function characterNft() view returns (address)',
  'function characterNftCodeHash() view returns (bytes32)',
  'function validatorCodeHash() view returns (bytes32)',
  'function hookCodeHash() view returns (bytes32)',
  'function poolManager() view returns (address)',
  'function positionManager() view returns (address)',
  'function permit2() view returns (address)',
  'function poolKey() view returns (address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks)',
  'function eligibilityChainId() view returns (uint256)',
  'function launchGate() view returns (address)',
  'function launchGateCodeHash() view returns (bytes32)',
  'function launchChainId() view returns (uint256)',
  'function token() view returns (address)',
  'function currency() view returns (address)',
  'function fundsRecipient() view returns (address)',
  'function validationHook() view returns (address)',
  'function chainId() view returns (uint256)',
  'function auction() view returns (address)',
  'function omr() view returns (address)',
  'function omrCodeHash() view returns (bytes32)',
  'function approvedSupply() view returns (uint256)',
  'function auctionCodeHash() view returns (bytes32)',
  'function migrationSucceeded() view returns (bool)',
  'function playerClaimsOpen() view returns (bool)',
  'function auctionPriceX96() view returns (uint256)',
  'function poolPriceX96() view returns (uint256)',
  'function lpNativeBudget() view returns (uint256)',
  'function publicProceeds() view returns (uint256)',
  'function safe() view returns (address)',
  'function familyYieldTreasury() view returns (address)',
  'function liquidityOwner() view returns (address)',
  'function tokenReserve() view returns (uint128)',
  'function totalSupply() view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function tokensRecipient() view returns (address)',
  'function minimumRaiseWei() view returns (uint256)',
  'function currencyRaised() view returns (uint256)',
  'function clearingPrice() view returns (uint256)',
  'function blockNumberish() view returns (uint256)',
  'function startBlock() view returns (uint64)',
  'function endBlock() view returns (uint64)',
  'function claimBlock() view returns (uint64)',
  'function floorPrice() view returns (uint256)',
  'function MAX_BID_PRICE() view returns (uint256)',
  'function TICK_SPACING_Q96() view returns (uint256)',
  'function isGraduated() view returns (bool)',
  'function nextBidId() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function bids(uint256) view returns (uint64 startBlock, uint24 startCumulativeMps, uint64 exitedBlock, uint256 maxPrice, address owner, uint256 amountQ96, uint256 tokensFilled)',
  'function submitBid(uint256 maxPrice, uint128 amount, address owner, bytes hookData) payable returns (uint256)',
  'function exitBid(uint256 bidId)',
  'function claimTokens(uint256 bidId)',
  'function exitPartiallyFilledBid(uint256 bidId, uint64 lastFullyFilledCheckpointBlock, uint64 outbidBlock)',
  'function checkpoints(uint64) view returns (uint256 clearingPrice, uint256 currencyRaisedAtClearingPriceQ96X7, uint256 cumulativeMpsPerPrice, uint24 cumulativeMps, uint64 prev, uint64 next)',
]);

export class GenesisAuctionError extends Error {
  constructor(code, message) { super(message); this.name = 'GenesisAuctionError'; this.code = code; }
}
const fail = (code, message) => { throw new GenesisAuctionError(code, message); };
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
function uint(value, max = U256) {
  if (typeof value !== 'string' || value.length > 78 || !/^(0|[1-9][0-9]*)$/.test(value)) fail('invalid_input', 'Enter an unsigned integer as text.');
  const n = BigInt(value);
  if (n > max) fail('invalid_input', 'The value exceeds the contract limit.');
  return n;
}
function amountWei(value, max = U256) {
  if (typeof value !== 'string' || value.length > 98 || !/^(0|[1-9][0-9]*)(\.[0-9]{1,18})?$/.test(value))
    fail('invalid_input', 'Enter an exact ETH amount with at most 18 decimal places.');
  const [whole, fraction = ''] = value.split('.');
  const amount = BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, '0'));
  if (amount === 0n || amount > max) fail('invalid_input', 'The ETH amount is outside the contract limit.');
  return amount;
}
function configuration(manifest, account) {
  if (manifest?.chainId !== CHAIN_ID || !isAddress(account || '') || same(account, ZERO))
    fail('invalid_configuration', 'Robinhood Chain and a valid wallet are required.');
  const contracts = {};
  const required = ['auction', 'coordinator', 'characterNft', 'omr', 'validator'];
  if (!manifest.contracts || Object.keys(manifest.contracts).length !== required.length
    || Object.keys(manifest.contracts).some(name => !required.includes(name)))
    fail('invalid_configuration', 'The public auction requires exactly five reviewed contract pins.');
  for (const name of ['auction', 'coordinator', 'characterNft', 'omr', 'validator']) {
    const pin = manifest.contracts?.[name];
    if (!isAddress(pin?.address || '') || same(pin.address, ZERO) || !HASH.test(pin?.runtimeCodeHash || ''))
      fail('invalid_configuration', 'The reviewed deployment manifest is incomplete.');
    contracts[name] = { address: getAddress(pin.address), runtimeCodeHash: pin.runtimeCodeHash.toLowerCase() };
  }
  if (new Set(Object.values(contracts).map(p => p.address.toLowerCase())).size !== 5)
    fail('invalid_configuration', 'Deployment addresses must be distinct.');
  const dependencyNames = ['poolManager', 'positionManager', 'permit2', 'hook'];
  if (!manifest.dependencies || Object.keys(manifest.dependencies).length !== 4
    || Object.keys(manifest.dependencies).some(name => !dependencyNames.includes(name)))
    fail('invalid_configuration', 'Four reviewed production dependency pins are required.');
  const addresses = new Set(Object.values(contracts).map(p => p.address.toLowerCase()));
  for (const name of dependencyNames) {
    const pin = manifest.dependencies[name];
    if (!isAddress(pin?.address || '') || same(pin.address, ZERO) || !HASH.test(pin?.runtimeCodeHash || '')
      || addresses.has(pin.address.toLowerCase()))
      fail('invalid_configuration', 'Production dependency pins must be complete and distinct.');
    addresses.add(pin.address.toLowerCase());
  }
  const policy = manifest.policy;
  const approved = { totalSupplyWei: '100000000000000000000000000', decimals: 18,
    saleTokenAmountWei: '40000000000000000000000000', lpTokenAmountWei: '20000000000000000000000000',
    bondTokenAmountWei: '40000000000000000000000000', minimumRaiseWei: '10000000000000000000',
    lpProceedsBps: 5000, claimsAtAuctionEnd: true };
  const custody = ['familySafe', 'liquidityOwner', 'unsoldRecipient', 'bondReserveCustodian'];
  if (!policy || Object.keys(policy).length !== Object.keys(approved).length + custody.length
    || Object.entries(approved).some(([key, value]) => policy[key] !== value)
    || Object.keys(policy).some(key => !Object.hasOwn(approved, key) && !custody.includes(key))
    || custody.some(key => !isAddress(policy[key] || '') || same(policy[key], ZERO)
      || !same(policy[key], policy.familySafe)))
    fail('invalid_configuration', 'The reviewed founder allocation and Safe custody policy is incomplete or differs.');
  const maxAge = manifest.maxSnapshotAgeSeconds ?? 120;
  if (!Number.isSafeInteger(maxAge) || maxAge < 1 || maxAge > 120)
    fail('invalid_configuration', 'The snapshot freshness limit is invalid.');
  return { contracts, account: getAddress(account), maxAge };
}
async function context({ manifest, account, client, bidId, nowMs = Date.now() }, recovery = false) {
  const config = configuration(manifest, account), { contracts: c } = config;
  if (!client) fail('invalid_configuration', 'A bounded public RPC client is required.');
  if (Number(await client.getChainId()) !== CHAIN_ID) fail('deployment_mismatch', 'The RPC chain does not match Robinhood Chain.');
  const block = await client.getBlock({ blockTag: 'latest' });
  if (typeof block.number !== 'bigint' || typeof block.timestamp !== 'bigint' || !HASH.test(block.hash || ''))
    fail('state_unavailable', 'The chain snapshot is incomplete.');
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) fail('invalid_configuration', 'The observation clock is invalid.');
  const age = nowMs / 1000 - Number(block.timestamp);
  if (!Number.isFinite(age) || age < -30 || age > config.maxAge) fail('state_unavailable', 'The chain snapshot is stale.');
  const read = (name, functionName, args = []) => client.readContract({ address: c[name]?.address || name,
    abi: ABI, functionName, args, blockNumber: block.number });
  await Promise.all(Object.values(c).map(async pin => {
    const code = await client.getCode({ address: pin.address, blockNumber: block.number });
    if (!code || code === '0x' || !same(keccak256(code), pin.runtimeCodeHash))
      fail('deployment_mismatch', 'A deployed contract differs from the reviewed manifest.');
  }));
  const bindings = [
    ['auction', 'characterNft', c.characterNft.address], ['auction', 'validationHook', c.validator.address], ['auction', 'token', c.omr.address],
    ['auction', 'currency', ZERO], ['auction', 'launchGate', c.coordinator.address],
    ['auction', 'fundsRecipient', c.coordinator.address], ['auction', 'launchGateCodeHash', c.coordinator.runtimeCodeHash],
    ['coordinator', 'auction', c.auction.address], ['coordinator', 'omr', c.omr.address],
    ['coordinator', 'auctionCodeHash', c.auction.runtimeCodeHash],
    ['coordinator', 'characterNft', c.characterNft.address], ['coordinator', 'characterNftCodeHash', c.characterNft.runtimeCodeHash],
    ['coordinator', 'validatorCodeHash', c.validator.runtimeCodeHash],
  ];
  await Promise.all(bindings.map(async ([name, fn, expected]) => {
    if (!same(await read(name, fn), expected)) fail('deployment_mismatch', 'Genesis immutable bindings do not match the manifest.');
  }));
  const policy = manifest.policy;
  for (const [name, fn, expected] of [
    ['coordinator', 'safe', policy.familySafe], ['coordinator', 'familyYieldTreasury', policy.familySafe],
    ['coordinator', 'liquidityOwner', policy.liquidityOwner], ['auction', 'tokensRecipient', policy.unsoldRecipient],
  ]) if (!same(await read(name, fn), expected))
    fail('deployment_mismatch', 'The founder-approved Safe custody binding differs.');
  for (const [name, fn, expected] of [
    ['omr', 'totalSupply', policy.totalSupplyWei], ['omr', 'decimals', policy.decimals],
    ['auction', 'totalSupply', policy.saleTokenAmountWei], ['coordinator', 'tokenReserve', policy.lpTokenAmountWei],
    ['auction', 'minimumRaiseWei', policy.minimumRaiseWei],
  ]) {
    // Mutable supply is a launch/admission prerequisite; earned exits and claims retain their
    // immutable accounting if later issuance changes it. Runtime/decimals/allocation pins remain.
    if (recovery && name === 'omr' && fn === 'totalSupply') continue;
    if (BigInt(await read(name, fn)) !== BigInt(expected))
      fail('deployment_mismatch', 'The founder-approved token allocation or minimum raise differs.');
  }
  {
    const deps = manifest.dependencies;
    for (const name of ['poolManager', 'positionManager', 'permit2', 'hook']) {
      const pin = deps?.[name];
      if (!isAddress(pin?.address || '') || same(pin.address, ZERO) || !HASH.test(pin?.runtimeCodeHash || ''))
        fail('invalid_configuration', 'The dependency runtime pins are incomplete.');
      const code = await client.getCode({ address: pin.address, blockNumber: block.number });
      if (!code || code === '0x' || !same(keccak256(code), pin.runtimeCodeHash))
        fail('deployment_mismatch', 'A production dependency differs from its reviewed runtime.');
      if (name !== 'hook' && !same(await read('coordinator', name), pin.address))
        fail('deployment_mismatch', 'A production dependency binding differs from the manifest.');
    }
    const key = await read('coordinator', 'poolKey');
    if (!same(key[0], ZERO) || !same(key[1], c.omr.address) || !same(key[4], deps.hook.address)
      || !same(await read('coordinator', 'hookCodeHash'), deps.hook.runtimeCodeHash)
      || !same(await client.readContract({ address: deps.positionManager.address, abi: ABI,
        functionName: 'poolManager', blockNumber: block.number }), deps.poolManager.address))
      fail('deployment_mismatch', 'The production pool and position-manager bindings differ.');
  }
  const validator = await read('auction', 'validationHook');
  if (!isAddress(validator || '') || same(validator, ZERO)) fail('deployment_mismatch', 'The auction ownership validator is missing.');
  const validatorCode = await client.getCode({ address: validator, blockNumber: block.number });
  if (!validatorCode || validatorCode === '0x'
    || !same(await read(validator, 'characterNft'), c.characterNft.address)
    || !same(await read(validator, 'characterNftCodeHash'), c.characterNft.runtimeCodeHash)
    || !same(await read(validator, 'omr'), c.omr.address)
    || !same(await read(validator, 'omrCodeHash'), c.omr.runtimeCodeHash)
    || BigInt(await read(validator, 'approvedSupply')) !== BigInt(policy.totalSupplyWei))
    fail('deployment_mismatch', 'The auction admission validator does not match the reviewed NFT, OMR and supply snapshot.');
  for (const [name, fn] of [['auction', 'launchChainId'], ['coordinator', 'chainId'], [validator, 'eligibilityChainId']]) {
    if (BigInt(await read(name, fn)) !== BigInt(CHAIN_ID)) fail('deployment_mismatch', 'A genesis chain binding is incorrect.');
  }
  const requests = [...['blockNumberish', 'startBlock', 'endBlock', 'claimBlock', 'floorPrice', 'MAX_BID_PRICE', 'TICK_SPACING_Q96', 'isGraduated'].map(fn => ['auction', fn]),
    ...['currencyRaised', 'clearingPrice'].map(fn => ['auction', fn]),
    ...['migrationSucceeded', 'playerClaimsOpen', 'auctionPriceX96', 'poolPriceX96', 'lpNativeBudget', 'publicProceeds'].map(fn => ['coordinator', fn])];
  const state = {};
  await Promise.all(requests.map(async ([name, fn, args = []]) => { state[fn] = await read(name, fn, args); }));
  if (BigInt(state.claimBlock) !== BigInt(state.endBlock))
    fail('deployment_mismatch', 'Auction claims must open at auction closure.');
  const tick = BigInt(state.TICK_SPACING_Q96);
  const saleAmount = BigInt(policy.saleTokenAmountWei);
  const ceilFloor = ((BigInt(policy.minimumRaiseWei) << 96n) + saleAmount - 1n) / saleAmount;
  const expectedTick = (ceilFloor + 99n) / 100n;
  if (tick < 2n || tick !== expectedTick || BigInt(state.floorPrice) !== expectedTick * 100n)
    fail('deployment_mismatch', 'The auction floor differs from the approved full-inventory floor.');
  if (state.migrationSucceeded && (BigInt(state.lpNativeBudget) !== BigInt(state.publicProceeds) / 2n
    || BigInt(state.poolPriceX96) !== (BigInt(state.lpNativeBudget) << 96n) / BigInt(policy.lpTokenAmountWei)))
    fail('deployment_mismatch', 'The funded LP budget and price differ from the approved funded ratio.');
  // NFT ownership is admission only. An unrelated balance read must not prevent recovery.
  if (recovery) state.balanceOf = null;
  else state.balanceOf = await read('characterNft', 'balanceOf', [config.account]);
  let bid = null;
  if (bidId !== undefined) {
    const id = uint(bidId);
    if (id >= BigInt(await read('auction', 'nextBidId'))) fail('invalid_input', 'The public bid does not exist.');
    const b = await read('auction', 'bids', [id]);
    // viem decodes these named scalar outputs as an array.
    bid = { id: id.toString(), startBlock: b[0].toString(), exitedBlock: b[2].toString(), maxPriceX96: b[3].toString(),
      owner: getAddress(b[4]), amountQ96: b[5].toString(), tokensFilled: b[6].toString(), ownedByAccount: same(b[4], config.account) };
  }
  const native = BigInt(state.blockNumberish), start = BigInt(state.startBlock), end = BigInt(state.endBlock);
  const phase = state.migrationSucceeded ? 'migrated' : native < start ? 'prepare' : native < end ? 'auction' : 'auction_closed';
  return { config, state, bid, block, phase, client, manifest };
}
async function unchanged(ctx) {
  const block = await ctx.client.getBlock({ blockNumber: ctx.block.number });
  if (!same(block.hash, ctx.block.hash) || Number(await ctx.client.getChainId()) !== CHAIN_ID)
    fail('state_unavailable', 'The chain snapshot changed during preparation.');
}
async function partialExitHints(ctx, options) {
  const supplied = options.lastFullyFilledCheckpointBlock !== undefined || options.outbidBlock !== undefined;
  if (supplied) {
    // Explicit hints are never trusted for execution: the same-block simulation below validates them.
    return [uint(options.lastFullyFilledCheckpointBlock, U64), uint(options.outbidBlock, U64)];
  }
  const end = BigInt(ctx.state.endBlock), maxPrice = BigInt(ctx.bid.maxPriceX96);
  let cursor = BigInt(ctx.bid.startBlock), previousBlock = null, previousPrice = null;
  let lastFull = null, outbid = 0n, crossed = false;
  const seen = new Set();
  const hintsNeeded = message => fail('exit_hints_required', `${message} Supply both checkpoint hints to simulate the exit safely.`);
  for (let reads = 0; reads < 256; reads++) {
    if (cursor > end || cursor === U64 || seen.has(cursor.toString())) hintsNeeded('The checkpoint links cannot be followed.');
    seen.add(cursor.toString());
    const checkpoint = await ctx.client.readContract({ address: ctx.config.contracts.auction.address,
      abi: ABI, functionName: 'checkpoints', args: [cursor], blockNumber: ctx.block.number });
    const price = BigInt(checkpoint[0]), prev = BigInt(checkpoint[4]), next = BigInt(checkpoint[5]);
    if ((previousBlock !== null && (prev !== previousBlock || price < previousPrice))
      || (price === 0n && prev === 0n && next === 0n)) hintsNeeded('The checkpoint history is unavailable or inconsistent.');
    if (price < maxPrice && !crossed) lastFull = cursor;
    if (price >= maxPrice) crossed = true;
    if (price > maxPrice && outbid === 0n) outbid = cursor;
    if (cursor === end) {
      if (next !== U64 || lastFull === null || !crossed) hintsNeeded('The final checkpoint cannot establish a partial exit.');
      return [lastFull, outbid];
    }
    if (next <= cursor || next > end || next === U64) hintsNeeded('The final checkpoint is missing or its links are invalid.');
    previousBlock = cursor; previousPrice = price; cursor = next;
  }
  hintsNeeded('Automatic recovery exceeded the 256-checkpoint limit.');
}
function projection(ctx) {
  const { config, state: s, block, bid, phase } = ctx;
  return { chainId: CHAIN_ID, account: config.account, snapshot: { blockNumber: block.number.toString(),
    blockHash: block.hash, timestamp: block.timestamp.toString() }, phase,
  auction: { nativeClock: s.blockNumberish.toString(), start: s.startBlock.toString(), end: s.endBlock.toString(),
    claim: s.claimBlock.toString(), floorPriceX96: s.floorPrice.toString(), maxBidPriceX96: s.MAX_BID_PRICE.toString(), tickSpacingQ96: s.TICK_SPACING_Q96.toString(), graduated: s.isGraduated,
    clearingPriceX96: s.clearingPrice.toString(), finalClearingPriceX96: s.auctionPriceX96.toString(), acceptedEthWei: s.currencyRaised.toString() },
  nftOwned: s.balanceOf === null ? null : BigInt(s.balanceOf) > 0n, bid,
  policy: { ...ctx.manifest.policy },
  migration: { succeeded: s.migrationSucceeded, claimsOpen: s.playerClaimsOpen && s.isGraduated,
    fundedPoolPriceX96: s.poolPriceX96.toString(), lpNativeBudgetWei: s.lpNativeBudget.toString(),
    publicProceedsWei: s.publicProceeds.toString(), lpTokenAmountWei: ctx.manifest.policy.lpTokenAmountWei } };
}
async function safe(work) {
  try { return await work(); }
  catch (error) { if (error instanceof GenesisAuctionError) throw error;
    fail('state_unavailable', 'Verified genesis chain state is unavailable.'); }
}
export async function readGenesisAuction(options, { recovery = false } = {}) {
  return safe(async () => { const ctx = await context(options, recovery === true); await unchanged(ctx); return projection(ctx); });
}
export async function prepareGenesisAuctionTransaction(options) {
  return safe(async () => {
    if (!['bid', 'exitBid', 'claimBid'].includes(options?.action))
      fail('invalid_input', 'This genesis action is unavailable.');
    const ctx = await context(options, options.action !== 'bid'), { state: s, config, block } = ctx;
    let name = 'auction', fn, args = [], value = 0n;
    if (options.action === 'bid') {
      if (BigInt(s.balanceOf) === 0n) fail('nft_required', 'The receiving wallet must hold a character NFT.');
      if (BigInt(s.blockNumberish) < BigInt(s.startBlock) || BigInt(s.blockNumberish) >= BigInt(s.endBlock))
        fail('wrong_phase', 'Public bidding is closed.');
      value = amountWei(options.amountEth, U128);
      const price = uint(options.maxPriceX96);
      if (price <= BigInt(s.floorPrice) || price > BigInt(s.MAX_BID_PRICE)) fail('invalid_input', 'The bid price is outside the auction bounds.');
      const spacing = BigInt(s.TICK_SPACING_Q96);
      if (spacing === 0n || price % spacing !== 0n) fail('invalid_input', 'The bid price must match the auction tick spacing.');
      name = 'auction'; fn = 'submitBid'; args = [price, value, config.account, '0x'];
    } else if (options.action === 'exitBid' || options.action === 'claimBid') {
      if (!ctx.bid || !ctx.bid.ownedByAccount) fail('bid_owner', 'Select a bid owned by this wallet.');
      name = 'auction'; fn = options.action === 'exitBid' ? 'exitBid' : 'claimTokens'; args = [BigInt(ctx.bid.id)];
      if (options.action === 'claimBid' && BigInt(s.blockNumberish) < BigInt(s.endBlock))
        fail('wrong_phase', 'Auction token claims open at auction closure.');
      if (options.action === 'claimBid' && !s.isGraduated)
        fail('wrong_phase', 'This auction has not graduated. Exit the bid to recover its refundable ETH.');
    }
    const to = config.contracts[name].address;
    const simulate = (functionName, callArgs) => ctx.client.simulateContract({ account: config.account, address: to,
      abi: ABI, functionName, args: callArgs, value, chain: { id: CHAIN_ID }, blockNumber: block.number });
    if (options.action === 'exitBid') {
      if (BigInt(s.blockNumberish) < BigInt(s.endBlock)) fail('wrong_phase', 'Bid recovery opens after the auction ends.');
      try { await simulate(fn, args); }
      catch {
        const hints = await partialExitHints(ctx, options);
        fn = 'exitPartiallyFilledBid'; args = [BigInt(ctx.bid.id), ...hints];
        try { await simulate(fn, args); }
        catch { fail('simulation_failed', 'The bid exit and checkpoint hints could not be validated at the snapshot.'); }
      }
    } else {
      try { await simulate(fn, args); }
      catch { fail('simulation_failed', 'The selected genesis transaction would revert at the verified snapshot.'); }
    }
    const data = encodeFunctionData({ abi: ABI, functionName: fn, args });
    await unchanged(ctx);
    return { chainId: CHAIN_ID, chainIdHex: '0x1237', from: config.account, to, data, value: `0x${value.toString(16)}`,
      valueWei: value.toString(), action: options.action, snapshot: projection(ctx).snapshot,
      validUntil: new Date((Number(block.timestamp) + config.maxAge) * 1000).toISOString() };
  });
}
