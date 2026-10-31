#!/usr/bin/env node
// Offline, publisher-attested complete change history. This does not collect production
// state, prove that supplied observations are truthful, publish roots, or sign claims.
// Resource bounds: 4,096 snapshots, 100,000 wallet/game rows per array, 250,000
// snapshot rows in aggregate, and a 64 MiB CLI input file. These are finite input
// capacity limits, not evidence of production throughput or anti-Sybil protection.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { concatHex, encodeAbiParameters, getAddress, keccak256, toHex } from 'viem';

export const MAX_SNAPSHOTS = 4096;
export const MAX_ROWS_PER_SNAPSHOT = 100000;
export const MAX_TOTAL_SNAPSHOT_ROWS = 250000;
export const MAX_SNAPSHOT_GAP_SECONDS = 86400n;
export const MAX_BACKING_AGE_SECONDS = 300n;
export const MAX_PERIOD_SECONDS = 365n * 86400n;
export const OMR_SUPPLY = 100000000n * 10n ** 18n;
const UINT256 = 1n << 256n, UINT64 = 1n << 64n;
const MAX_INPUT_BYTES = 64 * 1024 * 1024;
const EXCLUSIONS = ['protocolCustody', 'lp', 'treasury', 'unclaimedGenesis'];
const fail = (at, message) => { throw new Error(`${at}: ${message}`); };

function object(value, keys, at) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(at, 'object required');
  for (const key of keys) if (!Object.hasOwn(value, key)) fail(`${at}.${key}`, 'missing');
  for (const key of Object.keys(value)) if (!keys.includes(key)) fail(`${at}.${key}`, 'unknown field');
}
function uint(value, at, { zero = true, limit = UINT256 } = {}) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value) || value.length > 78) {
    fail(at, 'canonical decimal integer string required');
  }
  const result = BigInt(value);
  if ((!zero && result === 0n) || result >= limit) fail(at, 'integer outside bounds');
  return result;
}
function address(value, at) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value) || /^0x0{40}$/.test(value)) {
    fail(at, 'nonzero public address required');
  }
  return getAddress(value.toLowerCase()).toLowerCase();
}
function hash(value, at) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value) || /^0x0{64}$/.test(value)) {
    fail(at, 'nonzero bytes32 required');
  }
  return value.toLowerCase();
}
function list(value, at, maximum) {
  if (!Array.isArray(value) || value.length > maximum) fail(at, 'bounded array required');
}
function balance(value, at) {
  const n = uint(value, at);
  if (n > OMR_SUPPLY) fail(at, 'exceeds fixed OMR supply');
  return n;
}

// Sort object keys recursively; preserve array order. No floating point or unsafe
// integer can enter a manifest, and unsupported/cyclic values are rejected.
export function canonicalJson(value) {
  const seen = new Set();
  function encode(item) {
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return JSON.stringify(item);
    if (typeof item === 'number') {
      if (!Number.isSafeInteger(item)) fail('manifest', 'only safe integer JSON numbers allowed');
      return JSON.stringify(item);
    }
    if (!item || typeof item !== 'object' || seen.has(item)) fail('manifest', 'unsupported or cyclic value');
    seen.add(item);
    let result;
    if (Array.isArray(item)) {
      for (let i = 0; i < item.length; ++i) if (!Object.hasOwn(item, i)) fail('manifest', 'sparse array rejected');
      result = '[' + item.map(encode).join(',') + ']';
    }
    else {
      if (![Object.prototype, null].includes(Object.getPrototypeOf(item))) fail('manifest', 'plain object required');
      result = '{' + Object.keys(item).sort().map(key => JSON.stringify(key) + ':' + encode(item[key])).join(',') + '}';
    }
    seen.delete(item);
    return result;
  }
  return encode(value);
}

export function rewardLeaf(input) {
  object(input, ['chainId', 'rewardsVault', 'epochId', 'account', 'amount'], 'leaf');
  const values = [uint(input.chainId, 'leaf.chainId', { zero: false }), address(input.rewardsVault, 'leaf.rewardsVault'),
    uint(input.epochId, 'leaf.epochId', { zero: false }), address(input.account, 'leaf.account'),
    uint(input.amount, 'leaf.amount', { zero: false })];
  return keccak256(keccak256(encodeAbiParameters([
    { type: 'uint256' }, { type: 'address' }, { type: 'uint256' }, { type: 'address' }, { type: 'uint256' },
  ], values)));
}
const pair = (a, b) => keccak256(concatHex(a < b ? [a, b] : [b, a]));

export function verifyRewardProof(root, leaf, proof) {
  try {
    root = hash(root, 'root'); leaf = hash(leaf, 'leaf');
    list(proof, 'proof', 256);
    for (let i = 0; i < proof.length; ++i) leaf = pair(leaf, hash(proof[i], `proof[${i}]`));
    return root === leaf;
  } catch { return false; }
}

// Complete binary tree layout and sorted leaves/pairs match StandardMerkleTree.
// With an odd leaf count no leaf is duplicated or credited twice.
function merkle(claims, domain) {
  const leaves = claims.map(claim => ({ claim, leaf: rewardLeaf({ ...domain, ...claim }) }))
    .sort((a, b) => a.leaf < b.leaf ? -1 : a.leaf > b.leaf ? 1 : 0);
  const tree = new Array(2 * leaves.length - 1);
  leaves.forEach((entry, i) => { tree[tree.length - 1 - i] = entry.leaf; });
  for (let i = leaves.length - 2; i >= 0; --i) tree[i] = pair(tree[2 * i + 1], tree[2 * i + 2]);
  for (let i = 0; i < leaves.length; ++i) {
    const proof = [];
    for (let at = tree.length - 1 - i; at > 0; at = Math.floor((at - 1) / 2)) {
      proof.push(tree[at % 2 === 1 ? at + 1 : at - 1]);
    }
    leaves[i].claim.proof = proof;
  }
  return tree[0];
}

/** All OMR balances are canonical integer strings in 18-decimal token base units.
 * totalRewards/claim amounts are integer WBTC raw units (8 decimals, satoshis).
 * Each snapshot is a full state effective from its timestamp to the next point;
 * start/end boundary snapshots and every intervening state change are attested.
 * Hashes bind supplied evidence; they do not authenticate an untrusted publisher.
 */
export function buildWbtcRewardEpoch(input) {
  object(input, ['schemaVersion', 'mode', 'chainId', 'rewardsVault', 'epochId', 'startTime', 'endTime',
    'totalRewards', 'exclusions', 'coverage', 'funding', 'snapshots'], 'epoch');
  if (input.schemaVersion !== 1 || input.mode !== 'wallet-and-backed-game') fail('epoch', 'approved schema/mode required');
  const domain = { chainId: uint(input.chainId, 'chainId', { zero: false }).toString(),
    rewardsVault: address(input.rewardsVault, 'rewardsVault'), epochId: uint(input.epochId, 'epochId', { zero: false }).toString() };
  const start = uint(input.startTime, 'startTime', { limit: UINT64 }), end = uint(input.endTime, 'endTime', { limit: UINT64 });
  if (end <= start || end - start > MAX_PERIOD_SECONDS) fail('period', 'positive period of at most 365 days required');
  const budget = uint(input.totalRewards, 'totalRewards', { zero: false });
  object(input.coverage, ['kind', 'through', 'maxGapSeconds', 'sourceManifestHash'], 'coverage');
  if (input.coverage.kind !== 'complete-change-history' || uint(input.coverage.through, 'coverage.through', { limit: UINT64 }) !== end) {
    fail('coverage', 'complete state-change coverage through exact end required');
  }
  const gap = uint(input.coverage.maxGapSeconds, 'coverage.maxGapSeconds', { zero: false, limit: UINT64 });
  if (gap > MAX_SNAPSHOT_GAP_SECONDS) fail('coverage.maxGapSeconds', 'exceeds one day');
  hash(input.coverage.sourceManifestHash, 'coverage.sourceManifestHash');
  object(input.exclusions, EXCLUSIONS, 'exclusions');
  const excluded = new Set(), protocol = new Set();
  for (const kind of EXCLUSIONS) {
    list(input.exclusions[kind], `exclusions.${kind}`, MAX_ROWS_PER_SNAPSHOT);
    for (let i = 0; i < input.exclusions[kind].length; ++i) {
      const a = address(input.exclusions[kind][i], `exclusions.${kind}[${i}]`);
      if (excluded.has(a)) fail('exclusions', 'duplicate or overlapping category address');
      excluded.add(a); if (kind === 'protocolCustody') protocol.add(a);
    }
  }
  if (!protocol.has(domain.rewardsVault)) fail('exclusions.protocolCustody', 'rewards vault must be excluded');
  list(input.snapshots, 'snapshots', MAX_SNAPSHOTS);
  if (input.snapshots.length < 2) fail('snapshots', 'start and end boundary observations required');
  let totalRows = 0;
  for (let i = 0; i < input.snapshots.length; ++i) {
    const s = input.snapshots[i], at = `snapshots[${i}]`;
    object(s, ['timestamp', 'walletBalances', 'gameBalances', 'backing'], at);
    list(s.walletBalances, `${at}.walletBalances`, MAX_ROWS_PER_SNAPSHOT);
    list(s.gameBalances, `${at}.gameBalances`, MAX_ROWS_PER_SNAPSHOT);
    totalRows += s.walletBalances.length + s.gameBalances.length;
    if (totalRows > MAX_TOTAL_SNAPSHOT_ROWS) fail('snapshots', 'total resource bound exceeded');
  }
  const states = [], weights = new Map();
  let previous, custodyDomain, custodyAddress;
  let walletWeight = 0n, gameWeight = 0n, excludedWeight = 0n;
  for (let i = 0; i < input.snapshots.length; ++i) {
    const s = input.snapshots[i], at = `snapshots[${i}]`;
    object(s, ['timestamp', 'walletBalances', 'gameBalances', 'backing'], at);
    const time = uint(s.timestamp, `${at}.timestamp`, { limit: UINT64 });
    if (time < start || time > end || (previous && (time <= previous.time || time - previous.time > gap))) {
      fail(`${at}.timestamp`, 'unordered, out-of-period or stale coverage');
    }
    if ((i === 0 && time !== start) || (i === input.snapshots.length - 1 && time !== end)) {
      fail(`${at}.timestamp`, 'exact start/end boundary required');
    }
    const b = s.backing;
    object(b, ['custody', 'domain', 'blockNumber', 'blockHash', 'observedAt', 'physicalCustody',
      'allDatabaseLiabilities', 'reserveFunded', 'requiredReserve', 'provenanceHash', 'liabilitiesHash'], `${at}.backing`);
    const custody = address(b.custody, `${at}.backing.custody`), custodyKey = hash(b.domain, `${at}.backing.domain`);
    if (!protocol.has(custody)) fail(`${at}.backing.custody`, 'game custody must be explicitly excluded');
    if (i && (custody !== custodyAddress || custodyKey !== custodyDomain)) fail(`${at}.backing`, 'custody cutover requires a separate period');
    custodyAddress = custody; custodyDomain = custodyKey;
    const block = uint(b.blockNumber, `${at}.backing.blockNumber`), blockHash = hash(b.blockHash, `${at}.backing.blockHash`);
    const observed = uint(b.observedAt, `${at}.backing.observedAt`, { limit: UINT64 });
    if (observed > time || time - observed > MAX_BACKING_AGE_SECONDS) fail(`${at}.backing.observedAt`, 'future or stale backing observation');
    const physical = balance(b.physicalCustody, `${at}.backing.physicalCustody`);
    const liabilities = balance(b.allDatabaseLiabilities, `${at}.backing.allDatabaseLiabilities`);
    // Cumulative treasury funding can exceed circulating supply after legitimate
    // recycling; current physical balances and liabilities remain supply-bounded.
    const reserve = uint(b.reserveFunded, `${at}.backing.reserveFunded`);
    const required = uint(b.requiredReserve, `${at}.backing.requiredReserve`, { zero: false });
    hash(b.provenanceHash, `${at}.backing.provenanceHash`); hash(b.liabilitiesHash, `${at}.backing.liabilitiesHash`);
    if (required > OMR_SUPPLY || physical < liabilities || physical < required || reserve < required) {
      fail(`${at}.backing`, 'full liabilities/baseline backing or funding provenance insufficient');
    }
    if (previous && (block < previous.block || (block === previous.block && blockHash !== previous.blockHash)
      || observed < previous.observed || reserve < previous.reserve || required !== previous.required)) {
      fail(`${at}.backing`, 'inconsistent canonical block, cumulative funding or baseline');
    }
    const wallets = new Map(), eligible = new Map();
    let rawWallets = 0n, walletTotal = 0n, gameTotal = 0n, excludedTotal = 0n;
    for (let j = 0; j < s.walletBalances.length; ++j) {
      const row = s.walletBalances[j], rowAt = `${at}.walletBalances[${j}]`;
      object(row, ['account', 'balance'], rowAt);
      const a = address(row.account, `${rowAt}.account`), amount = balance(row.balance, `${rowAt}.balance`);
      if (wallets.has(a)) fail(rowAt, 'duplicate wallet address');
      wallets.set(a, amount); rawWallets += amount;
      if (excluded.has(a)) excludedTotal += amount;
      else { eligible.set(a, amount); walletTotal += amount; }
    }
    if (rawWallets > OMR_SUPPLY) fail(at, 'wallet inventory exceeds fixed supply');
    for (const a of excluded) if (!wallets.has(a)) fail(`${at}.walletBalances`, 'excluded address observation missing');
    if (wallets.get(custody) !== physical) fail(`${at}.backing`, 'physical custody differs from excluded wallet inventory');
    const ids = new Set(), links = new Set();
    for (let j = 0; j < s.gameBalances.length; ++j) {
      const row = s.gameBalances[j], rowAt = `${at}.gameBalances[${j}]`;
      object(row, ['accountId', 'account', 'balance'], rowAt);
      if (typeof row.accountId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(row.accountId)) fail(rowAt, 'bounded account identity required');
      const a = address(row.account, `${rowAt}.account`), amount = balance(row.balance, `${rowAt}.balance`);
      if (ids.has(row.accountId) || links.has(a)) fail(rowAt, 'duplicate game identity or linked wallet');
      if (!wallets.has(a) || excluded.has(a)) fail(rowAt, 'missing or excluded linked wallet');
      ids.add(row.accountId); links.add(a); gameTotal += amount;
      eligible.set(a, (eligible.get(a) || 0n) + amount);
    }
    if (gameTotal > liabilities || walletTotal + gameTotal > OMR_SUPPLY) fail(at, 'game shares exceed backed liabilities or supply');
    states.push({ time, eligible, walletTotal, gameTotal, excludedTotal });
    previous = { time, block, blockHash, observed, reserve, required };
  }
  object(input.funding, ['chainId', 'rewardsVault', 'blockNumber', 'blockHash', 'observedAt',
    'vaultWbtcBalance', 'reservedWbtc', 'sourceManifestHash'], 'funding');
  if (uint(input.funding.chainId, 'funding.chainId', { zero: false }).toString() !== domain.chainId
      || address(input.funding.rewardsVault, 'funding.rewardsVault') !== domain.rewardsVault) {
    fail('funding', 'observation belongs to another chain or vault');
  }
  const fundingBlock = uint(input.funding.blockNumber, 'funding.blockNumber');
  const fundingBlockHash = hash(input.funding.blockHash, 'funding.blockHash');
  const fundingTime = uint(input.funding.observedAt, 'funding.observedAt', { limit: UINT64 });
  hash(input.funding.sourceManifestHash, 'funding.sourceManifestHash');
  if (fundingTime < end || fundingBlock < previous.block
      || (fundingBlock === previous.block && fundingBlockHash !== previous.blockHash)) {
    fail('funding', 'observation precedes period end or conflicts with canonical end block');
  }
  const funded = uint(input.funding.vaultWbtcBalance, 'funding.vaultWbtcBalance');
  const reserved = uint(input.funding.reservedWbtc, 'funding.reservedWbtc');
  if (reserved > funded || budget > funded - reserved) fail('funding', 'epoch exceeds measured unreserved WBTC');
  for (let i = 0; i < states.length - 1; ++i) {
    const s = states[i], duration = states[i + 1].time - s.time;
    walletWeight += s.walletTotal * duration; gameWeight += s.gameTotal * duration; excludedWeight += s.excludedTotal * duration;
    for (const [a, amount] of s.eligible) if (amount > 0n) weights.set(a, (weights.get(a) || 0n) + amount * duration);
  }
  const totalWeight = walletWeight + gameWeight;
  if (totalWeight === 0n) fail('weights', 'no positive eligible exposure');
  const allocations = [...weights].map(([account, weight]) => ({ account, weight, amount: budget * weight / totalWeight,
    remainder: budget * weight % totalWeight }));
  let dust = budget - allocations.reduce((sum, a) => sum + a.amount, 0n);
  const floorDust = dust;
  allocations.sort((a, b) => a.remainder > b.remainder ? -1 : a.remainder < b.remainder ? 1 : a.account < b.account ? -1 : a.account > b.account ? 1 : 0);
  for (const a of allocations) { if (dust === 0n) break; ++a.amount; --dust; }
  if (dust !== 0n) fail('allocation', 'unallocated budget');
  const claims = allocations.filter(a => a.amount > 0n).map(a => ({ account: a.account, amount: a.amount.toString() }))
    .sort((a, b) => a.account < b.account ? -1 : a.account > b.account ? 1 : 0);
  const root = merkle(claims, domain);
  return { schemaVersion: 1, mode: input.mode, ...domain, root, totalRewards: budget.toString(),
    startTime: start.toString(), endTime: end.toString(), manifestHash: keccak256(toHex(canonicalJson(input))), claims,
    totals: { weightedOmrSeconds: totalWeight.toString(), walletOmrSeconds: walletWeight.toString(),
      gameOmrSeconds: gameWeight.toString(), excludedWalletOmrSeconds: excludedWeight.toString(),
      positiveWeightAccounts: weights.size, claimCount: claims.length, snapshotCount: states.length,
      floorRemainderSats: floorDust.toString(), distributedRemainderSats: floorDust.toString(), unallocatedRewards: '0' },
    sourceManifestHash: input.coverage.sourceManifestHash.toLowerCase(),
    fundingSourceManifestHash: input.funding.sourceManifestHash.toLowerCase(),
    evidenceModel: 'publisher-attested complete change history; no automatic production collection or proof of truthful completeness' };
}

function main(args) {
  if ((args.length !== 2 && args.length !== 4) || args[0] !== '--input' || (args.length === 4 && args[2] !== '--output')) {
    throw new Error('Usage: node tools/wbtc-reward-epoch.js --input snapshot.json [--output epoch.json]');
  }
  const inputPath = path.resolve(args[1]), outputPath = args.length === 4 ? path.resolve(args[3]) : null;
  const stat = fs.statSync(inputPath);
  if (!stat.isFile() || stat.size > MAX_INPUT_BYTES) fail('input', 'regular JSON file up to 64 MiB required');
  if (inputPath === outputPath) fail('output', 'cannot replace input');
  const bytes = fs.readFileSync(inputPath);
  if (bytes.length > MAX_INPUT_BYTES) fail('input', 'file exceeds 64 MiB');
  let input;
  try { input = JSON.parse(bytes.toString('utf8')); } catch { fail('input', 'invalid JSON'); }
  const result = JSON.stringify(buildWbtcRewardEpoch(input), null, 2) + '\n';
  if (outputPath) fs.writeFileSync(outputPath, result, { flag: 'wx' });
  else process.stdout.write(result);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`WBTC epoch refused: ${error.message}\n`); process.exitCode = 1; }
}
