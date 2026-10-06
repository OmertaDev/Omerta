#!/usr/bin/env node
// Offline public-input planner. No RPC, keys, signing, or broadcasting.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { encodeDeployData, encodeFunctionData, encodeAbiParameters, getContractAddress, getAddress,
  keccak256, toHex, concatHex, parseAbi, zeroAddress } from 'viem';
import { mineMarketV2Hook } from './market-v2-deployment-plan.js';

const ROOT = fileURLToPath(new URL('../omerta-contracts/', import.meta.url));
export const GENESIS_AUCTION_ARTIFACTS = Object.freeze({
  OmertaAuctionCoordinatorV2: 'src/market-v2/OmertaAuctionCoordinatorV2.sol',
  OmertaHookV2: 'src/market-v2/OmertaHookV2.sol',
  OmertaGuardedAuction: 'src/genesis-auction/OmertaGuardedAuction.sol',
  GenesisCharacterBidValidation: 'src/genesis-auction/GenesisCharacterEligibility.sol',
  OmertaReserveFundingV2: 'src/market-v2/OmertaReserveFundingV2.sol',
});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = x => JSON.stringify(x, (_, v) => typeof v === 'bigint' ? String(v) : v, 2);
const ordered = x => Array.isArray(x) ? x.map(ordered) : x && typeof x === 'object'
  ? Object.fromEntries(Object.keys(x).sort().map(k => [k, ordered(x[k])])) : x;
const abiIdentity = abi => JSON.stringify(abi.map(x => JSON.stringify(ordered(x))).sort());
function check(ok, message) { if (!ok) throw Error(message); }
function closed(name, x, keys) {
  check(x && typeof x === 'object' && !Array.isArray(x), `${name}: required object`);
  for (const k of keys) check(Object.hasOwn(x, k), `${name}.${k}: missing required field`);
  for (const k of Object.keys(x)) check(keys.includes(k), `${name}.${k}: unknown field`);
}
function addr(name, x) {
  check(typeof x === 'string' && /^0x[0-9a-fA-F]{40}$/.test(x) && !/^0x0{40}$/i.test(x), `${name}: public nonzero address required`);
  return getAddress(x.toLowerCase());
}
function digest(name, x, prefix = true) {
  check(typeof x === 'string' && (prefix ? /^0x[0-9a-f]{64}$/i : /^[0-9a-f]{64}$/i).test(x)
    && !/^(0x)?0{64}$/i.test(x), `${name}: explicit nonzero hash required`);
  return x.toLowerCase();
}
function uint(name, x, bits = 256, zero = false) {
  check(typeof x === 'string' && /^(0|[1-9][0-9]*)$/.test(x), `${name}: decimal integer string required`);
  const n = BigInt(x); check((zero || n > 0n) && n < 1n << BigInt(bits), `${name}: uint${bits} bounds`); return n;
}
function number(name, x, lo, hi) { check(Number.isSafeInteger(x) && x >= lo && x <= hi, `${name}: policy bounds`); return x; }
function publicOnly(x) {
  if (!x || typeof x !== 'object') return;
  for (const [k, v] of Object.entries(x)) {
    check(!/private|secret|mnemonic|credential|rpcurl|apikey|password/i.test(k), `Forbidden credential field: ${k}`);
    if (typeof v === 'string') check(!/^(https?:|wss?:)/i.test(v), 'RPC/remote inputs are forbidden');
    publicOnly(v);
  }
}
const within = (root, file) => { const p = path.relative(root, file); return p !== '..' && !p.startsWith(`..${path.sep}`) && !path.isAbsolute(p); };

/** Uses the actual mixed default/via-IR profiles, and hashes every transitive imported source. */
export function loadGenesisAuctionArtifact(contract, { contractsRoot = ROOT } = {}) {
  const target = GENESIS_AUCTION_ARTIFACTS[contract]; check(target, 'Unsupported genesis artifact');
  const root = fs.realpathSync(contractsRoot);
  const artifactFile = path.join(root, 'out', path.basename(target), `${contract}.json`);
  // Worktrees may share a compiled out/ junction; exact artifact/imported-source pins still apply.
  check(within(fs.realpathSync(path.join(root, 'out')), fs.realpathSync(artifactFile)), 'Artifact outside artifact store');
  const bytes = fs.readFileSync(artifactFile), a = JSON.parse(bytes);
  const m = typeof a.rawMetadata === 'string' ? JSON.parse(a.rawMetadata) : a.metadata;
  const viaIR = target.startsWith('src/market-v2/');
  check(m?.settings?.compilationTarget?.[target] === contract && m.compiler?.version === '0.8.26+commit.8a97fa7a'
    && m.settings.optimizer?.enabled === true && m.settings.optimizer.runs === 800
    && m.settings.evmVersion === 'cancun' && Boolean(m.settings.viaIR) === viaIR,
  `${contract}: compiler profile mismatch`);
  check(Array.isArray(a.abi) && abiIdentity(a.abi) === abiIdentity(m.output.abi), `${contract}: ABI mismatch`);
  const sources = {};
  check(Object.keys(m.sources || {}).length > 0, `${contract}: source metadata absent`);
  for (const [source, info] of Object.entries(m.sources)) {
    const p = path.resolve(root, source);
    const dependency = /^lib\/(openzeppelin-contracts|v4-core|v4-periphery|permit2)\//.exec(source);
    const mount = dependency ? fs.realpathSync(path.join(root, 'lib', dependency[1])) : root;
    check(within(root, p) && within(mount, fs.realpathSync(p)), `${contract}: source escapes approved source/dependency mount`);
    const sourceBytes = fs.readFileSync(p), raw = keccak256(toHex(sourceBytes));
    check(raw === info.keccak256 || keccak256(toHex(sourceBytes.toString('utf8').replace(/\r\n/g, '\n'))) === info.keccak256,
      `${contract}: stale artifact source ${source}`);
    sources[source] = { sha256: sha(sourceBytes), compilerInputKeccak256: info.keccak256, rawKeccak256: raw };
  }
  for (const field of ['bytecode', 'deployedBytecode']) check(/^0x(?:[a-f0-9]{2})+$/i.test(a[field]?.object || '')
    && Object.keys(a[field].linkReferences || {}).length === 0, `${contract}: unresolved bytecode`);
  const runtimeBytes = (a.deployedBytecode.object.length - 2) / 2;
  check(runtimeBytes <= 24576, `${contract}: EIP-170 runtime size`);
  check((a.bytecode.object.length - 2) / 2 <= 49152, `${contract}: EIP-3860 creation bytecode size`);
  return { abi: a.abi, bytecode: a.bytecode.object, evidence: {
    contract, artifactSha256: sha(bytes), abiSha256: sha(abiIdentity(a.abi)), compiler: m.compiler.version,
    settings: m.settings, sources, runtimeTemplateBytes: runtimeBytes,
    runtimeTemplateKeccak256: keccak256(a.deployedBytecode.object), creationBytecodeKeccak256: keccak256(a.bytecode.object),
    immutableReferences: a.deployedBytecode.immutableReferences || {},
  } };
}

export function genesisAuctionArtifactInventory({ contractsRoot = ROOT } = {}) {
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: contractsRoot, encoding: 'utf8' }).trim();
  const artifacts = Object.fromEntries(Object.keys(GENESIS_AUCTION_ARTIFACTS).map(c => [c, loadGenesisAuctionArtifact(c, { contractsRoot }).evidence]));
  const sourceHashes = {};
  for (const a of Object.values(artifacts)) for (const [file, s] of Object.entries(a.sources)) sourceHashes[file] = s.sha256;
  sourceHashes['foundry.toml'] = sha(fs.readFileSync(path.join(contractsRoot, 'foundry.toml')));
  // Revision and exact bytes are separate pins: dirty working sources must never masquerade as a committed review.
  const mounts = [...new Set(Object.keys(sourceHashes).filter(p => p.startsWith('lib/')).map(p => p.split('/').slice(0, 2).join('/')))];
  const workingTreeMatchesRevision = !execFileSync('git', ['status', '--porcelain', '--untracked-files=all', '--ignore-submodules=none', '--',
    ...Object.keys(sourceHashes), ...mounts], { cwd: contractsRoot, encoding: 'utf8' }).trim();
  return { sourceRevision, workingTreeMatchesRevision, artifactHashes: Object.fromEntries(Object.entries(artifacts).map(([c, a]) => [c, a.artifactSha256])), sourceHashes, artifacts };
}

export function buildGenesisAuctionDeploymentPlan(input, { contractsRoot = ROOT } = {}) {
  publicOnly(input);
  closed('manifest', input, ['schemaVersion', 'chainId', 'localRehearsal', 'sourceRevision', 'startingNonce', 'roles',
    'external', 'create2', 'artifactHashes', 'sourceHashes', 'observation', 'nativeClock', 'hook', 'auction', 'tokenReserve']);
  check(input.schemaVersion === 1 && typeof input.localRehearsal === 'boolean', 'Explicit schemaVersion/localRehearsal required');
  const chainId = number('chainId', input.chainId, 1, Number.MAX_SAFE_INTEGER);
  check(chainId === 4663 || chainId === 31337, 'Only production chain 4663 or explicit local rehearsal chain 31337 is supported');
  check(chainId !== 31337 || input.localRehearsal, '31337 requires localRehearsal');
  check(/^[a-f0-9]{40}$/i.test(input.sourceRevision || ''), 'Full sourceRevision required');
  const inventory = genesisAuctionArtifactInventory({ contractsRoot });
  check(input.sourceRevision === inventory.sourceRevision, 'sourceRevision differs from checked-out revision');
  check(input.localRehearsal || inventory.workingTreeMatchesRevision, 'Production planning requires committed source bytes');
  const artifacts = Object.fromEntries(Object.keys(GENESIS_AUCTION_ARTIFACTS).map(c => {
    check(digest(`artifactHashes.${c}`, input.artifactHashes?.[c], false) === inventory.artifactHashes[c], `${c}: artifact hash mismatch`);
    return [c, loadGenesisAuctionArtifact(c, { contractsRoot })];
  }));
  closed('artifactHashes', input.artifactHashes, Object.keys(GENESIS_AUCTION_ARTIFACTS));
  closed('sourceHashes', input.sourceHashes, Object.keys(inventory.sourceHashes));
  for (const [file, hash] of Object.entries(inventory.sourceHashes)) check(digest(file, input.sourceHashes[file], false) === hash, `Source hash mismatch: ${file}`);
  const roleKeys = ['deployer', 'safe', 'liquidityOwner', 'treasury', 'vig', 'founder', 'unsoldRecipient', 'hookRecipients'];
  closed('roles', input.roles, roleKeys);
  const r = Object.fromEntries(roleKeys.filter(k => k !== 'hookRecipients').map(k => [k, addr(`roles.${k}`, input.roles[k])]));
  check(r.deployer !== r.safe, 'EOA nonce owner must be separate from funding Safe');
  check(Array.isArray(input.roles.hookRecipients) && input.roles.hookRecipients.length === 3, 'Three explicit dev/RWA/community hook recipients required; POL/reserve adapters are deployed internally');
  const recipients = input.roles.hookRecipients.map((a, i) => addr(`hookRecipients.${i}`, a));
  const externalKeys = ['omr', 'poolManager', 'positionManager', 'permit2', 'characterNft'];
  closed('external', input.external, externalKeys);
  const e = Object.fromEntries(externalKeys.map(k => { closed(`external.${k}`, input.external[k], ['address', 'runtimeHash']);
    return [k, { address: addr(k, input.external[k].address), runtimeHash: digest(k, input.external[k].runtimeHash) }]; }));
  check(new Set(Object.values(e).map(x => x.address)).size === externalKeys.length, 'External roles must be distinct contracts');
  closed('create2', input.create2, ['factory', 'runtimeHash', 'kind', 'saltStart', 'maxAttempts']);
  const factory = addr('factory', input.create2.factory); digest('factory.runtimeHash', input.create2.runtimeHash);
  check(input.create2.kind === 'salt-prefix', 'Only explicitly reviewed salt-prefix factory supported');
  const nonce = uint('startingNonce', input.startingNonce, 64, true); check(nonce + 4n < (1n << 64n) - 1n, 'Nonce sequence overflows');
  const deployed = { polFunding: getContractAddress({ from: r.deployer, nonce }), reserveFunding: getContractAddress({ from: r.deployer, nonce: nonce + 1n }),
    coordinator: getContractAddress({ from: r.deployer, nonce: nonce + 2n }), auction: getContractAddress({ from: r.deployer, nonce: nonce + 4n }) };
  closed('observation', input.observation, ['blockNumber', 'blockHash', 'timestamp']);
  uint('observation.blockNumber', input.observation.blockNumber, 64, true); digest('observation.blockHash', input.observation.blockHash);
  const now = uint('observation.timestamp', input.observation.timestamp, 64);
  closed('nativeClock', input.nativeClock, ['chainId', 'mode', 'currentBlock', 'evidenceSha256', 'minMillisecondsPerBlock', 'maxMillisecondsPerBlock', 'samples']);
  const clock = input.nativeClock;
  check(clock.chainId === chainId && ['block.number', 'arbsys'].includes(clock.mode), 'Explicit chain-bound native clock mode required');
  digest('nativeClock.evidenceSha256', clock.evidenceSha256, false);
  const current = uint('nativeClock.currentBlock', clock.currentBlock, 64, true);
  if (clock.mode === 'block.number') check(current === BigInt(input.observation.blockNumber), 'block.number clock differs from RPC snapshot');
  const minMs = uint('nativeClock.minMillisecondsPerBlock', clock.minMillisecondsPerBlock, 64), maxMs = uint('nativeClock.maxMillisecondsPerBlock', clock.maxMillisecondsPerBlock, 64);
  check(minMs <= maxMs, 'Native clock cadence bounds inverted');
  check(Array.isArray(clock.samples) && clock.samples.length >= 2, 'Native clock requires measured block/UTC samples');
  const samples = clock.samples.map(s => { closed('clock sample', s, ['nativeBlock', 'rpcBlock', 'timestamp']);
    return { nativeBlock: uint('sample.nativeBlock', s.nativeBlock, 64, true), rpcBlock: uint('sample.rpcBlock', s.rpcBlock, 64, true), timestamp: uint('sample.timestamp', s.timestamp, 64) }; });
  for (let i = 1; i < samples.length; i++) {
    const blocks = samples[i].nativeBlock - samples[i - 1].nativeBlock, elapsedMs = (samples[i].timestamp - samples[i - 1].timestamp) * 1000n;
    check(blocks > 0n && elapsedMs > 0n && elapsedMs >= blocks * minMs && elapsedMs <= blocks * maxMs, 'Native clock samples contradict cadence bounds');
    check(samples[i].rpcBlock > samples[i - 1].rpcBlock, 'RPC clock samples must be increasing');
  }
  check(samples.at(-1).nativeBlock === current && samples.at(-1).timestamp === now && samples.at(-1).rpcBlock === BigInt(input.observation.blockNumber), 'Native clock evidence must end at pinned snapshot');
  if (clock.mode === 'block.number') check(samples.every(s => s.nativeBlock === s.rpcBlock), 'block.number samples must equal RPC block numbers');
  closed('hook', input.hook, ['poolFee', 'tickSpacing', 'opening', 'surgeFullTicks', 'epochDuration']);
  const h = input.hook, fee = number('poolFee', h.poolFee, 0, 100000), spacing = number('tickSpacing', h.tickSpacing, 1, 32767);
  closed('opening', h.opening, ['blocks', 'buyBps', 'maxBuyQuote']);
  number('opening.blocks', h.opening.blocks, 0, 200); number('opening.buyBps', h.opening.buyBps, 0, 1000);
  uint('opening.maxBuyQuote', h.opening.maxBuyQuote, 128, true);
  check(h.opening.blocks !== 0 || (h.opening.buyBps === 0 && h.opening.maxBuyQuote === '0'), 'Disabled opening policy carries fee/cap');
  number('surgeFullTicks', h.surgeFullTicks, 1, 100000); number('epochDuration', h.epochDuration, 60, 86400);
  const deployData = (name, args) => { const a = artifacts[name]; const data = encodeDeployData({ abi: a.abi, bytecode: a.bytecode, args });
    check((data.length - 2) / 2 <= 49152, `${name}: EIP-3860 initcode size`); return data; };
  const hookInit = deployData('OmertaHookV2', [e.poolManager.address, e.omr.address, deployed.coordinator, fee, spacing,
    [...recipients, deployed.polFunding, deployed.reserveFunding], h.opening, h.surgeFullTicks, h.epochDuration]);
  const mined = mineMarketV2Hook(factory, keccak256(hookInit), uint('saltStart', input.create2.saltStart, 256, true), number('maxAttempts', input.create2.maxAttempts, 1, 1000000));
  deployed.hook = mined.address;
  const allNew = Object.values(deployed);
  check(new Set([...allNew, ...Object.values(e).map(x => x.address), factory]).size === allNew.length + externalKeys.length + 1, 'Deployment address collision');
  check([...Object.values(r), ...recipients].every(a => !allNew.includes(a)), 'Recipient cannot be a newly deployed contract');
  const reserve = uint('tokenReserve', input.tokenReserve, 128); check(reserve <= (1n << 127n) - 1n, 'Reserve exceeds signed liquidity bound');
  closed('auction', input.auction, ['totalSupply', 'startBlock', 'endBlock', 'claimBlock', 'tickSpacing', 'floorPrice', 'requiredCurrencyRaised', 'auctionStepsData']);
  const a = input.auction, supply = uint('auction.totalSupply', a.totalSupply, 128);
  check(supply <= 1n << 100n, 'Auction total supply limit');
  const start = uint('startBlock', a.startBlock, 64), end = uint('endBlock', a.endBlock, 64), claim = uint('claimBlock', a.claimBlock, 64);
  check(current < start && start < end && end <= claim, 'Auction native-clock ordering must be future');
  const tick = uint('auction.tickSpacing', a.tickSpacing), floor = uint('floorPrice', a.floorPrice);
  const q = (1n << 154n) / supply, raisedBound = (1n << 222n) / supply;
  const maxBid = supply <= 1n << 62n ? (1n << 160n) - 1n : q * q < raisedBound ? q * q : raisedBound;
  check(tick >= 2n && floor > 1n << 32n && floor % tick === 0n && floor + tick <= maxBid, 'Auction floor/tick constructor bounds');
  uint('requiredCurrencyRaised', a.requiredCurrencyRaised, 128);
  check(/^0x(?:[a-f0-9]{16})+$/i.test(a.auctionStepsData), 'Auction schedule must encode uint24 mps + uint40 blockDelta steps');
  let duration = 0n, mps = 0n;
  for (let i = 2; i < a.auctionStepsData.length; i += 16) { const rate = BigInt(`0x${a.auctionStepsData.slice(i, i + 6)}`), delta = BigInt(`0x${a.auctionStepsData.slice(i + 6, i + 16)}`);
    check(delta > 0n, 'Zero auction step duration'); duration += delta; mps += rate * delta; }
  check(duration === end - start && mps === 10000000n, 'Auction schedule duration/issuance mismatch');
  check(supply + reserve < 1n << 256n, 'Aggregate Safe OMR inventory overflows uint256');
  const targetDurationMs = 72n * 3600n * 1000n;
  check(duration * minMs <= targetDurationMs && duration * maxMs >= targetDurationMs,
    'Auction schedule must target 72 hours within measured native-clock cadence bounds');
  const params = { currency: zeroAddress, tokensRecipient: r.unsoldRecipient, fundsRecipient: deployed.coordinator,
    startBlock: start, endBlock: end, claimBlock: claim, tickSpacing: tick, validationHook: zeroAddress, floorPrice: floor,
    requiredCurrencyRaised: BigInt(a.requiredCurrencyRaised), auctionStepsData: a.auctionStepsData };
  const coordinatorData = deployData('OmertaAuctionCoordinatorV2', [e.poolManager.address, e.positionManager.address, e.permit2.address, e.omr.address,
    deployed.hook, fee, spacing, reserve, r.liquidityOwner, r.treasury, r.vig, r.founder, e.characterNft.address]);
  const auctionData = deployData('OmertaGuardedAuction', [e.omr.address, supply, params, deployed.coordinator, e.characterNft.address]);
  const call = (from, to, abi, functionName, args = []) => ({ chainId, from, to, value: '0x0', data: encodeFunctionData({ abi, functionName, args }) });
  const funding = [[deployed.auction, supply], [deployed.coordinator, reserve]].map(([to, amount]) =>
    call(r.safe, e.omr.address, parseAbi(['function transfer(address to,uint256 amount) returns(bool)']), 'transfer', [to, amount]));
  funding.push(call(r.safe, deployed.auction, artifacts.OmertaGuardedAuction.abi, 'onTokensReceived'));
  const deployments = [
    { role: 'polFunding', nonce: String(nonce), predicted: deployed.polFunding, data: deployData('OmertaReserveFundingV2', [r.safe, e.omr.address, 0]) },
    { role: 'reserveFunding', nonce: String(nonce + 1n), predicted: deployed.reserveFunding, data: deployData('OmertaReserveFundingV2', [r.safe, e.omr.address, 5]) },
    { role: 'coordinator', nonce: String(nonce + 2n), predicted: deployed.coordinator, data: coordinatorData },
    { role: 'hook', nonce: String(nonce + 3n), predicted: deployed.hook, to: factory, data: concatHex([mined.salt, hookInit]) },
    { role: 'auction', nonce: String(nonce + 4n), predicted: deployed.auction, data: auctionData },
  ].map(t => ({ chainId, from: r.deployer, value: '0x0', ...t }));
  const plan = { schemaVersion: 1, kind: 'unsigned-genesis-auction', activationReady: false,
    strategiesReady: false, fundingAdaptersBound: false,
    sourceRevision: input.sourceRevision, workingTreeMatchesRevision: inventory.workingTreeMatchesRevision,
    manifestSha256: sha(JSON.stringify(ordered(input))), evidence: inventory.artifacts, external: e,
    factory: input.create2, observation: input.observation, nativeClock: clock, addresses: deployed,
    internalValidatorAddress: getContractAddress({ from: deployed.auction, nonce: 1n }), hookMining: mined,
    inventory: { public: String(supply), reserve: String(reserve), totalSafeOmrRequired: String(supply + reserve), auctionDurationSecondsBounds: [String(duration * minMs / 1000n), String((duration * maxMs + 999n) / 1000n)] },
    deployments, safeFundingCalls: funding, deployerBindCall: call(r.deployer, deployed.coordinator, artifacts.OmertaAuctionCoordinatorV2.abi, 'bind', [deployed.auction]),
    finalManifest: { chainId, activationReady: false, contracts: {
      auction: { address: deployed.auction, runtimeCodeHash: null },
      coordinator: { address: deployed.coordinator, runtimeCodeHash: null },
      characterNft: { address: e.characterNft.address, runtimeCodeHash: e.characterNft.runtimeHash },
      omr: { address: e.omr.address, runtimeCodeHash: e.omr.runtimeHash },
      validator: { address: getContractAddress({ from: deployed.auction, nonce: 1n }), runtimeCodeHash: null },
    }, dependencies: {
      poolManager: { address: e.poolManager.address, runtimeCodeHash: e.poolManager.runtimeHash },
      positionManager: { address: e.positionManager.address, runtimeCodeHash: e.positionManager.runtimeHash },
      permit2: { address: e.permit2.address, runtimeCodeHash: e.permit2.runtimeHash },
      hook: { address: deployed.hook, runtimeCodeHash: null },
    } },
    remainingGates: ['Verify every external/factory runtime hash and interface, OMR decimals=18 and Safe inventory at execution.',
      'Verify deployer nonce, empty predicted addresses, factory salt-prefix semantics, and native clock selection/cadence at execution.',
      'Simulate all deployment/funding/bind transactions and verify NFT validator and governance recipients.',
      'Review reserve adequacy at actual clearing price and total raised; no unconditional migration guarantee is inferred from inventory.',
      'Bids, checkpoint, migration and claims require separate launch approval; this plan does not arm market strategies.'] };
  return JSON.parse(json(plan));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === '--inventory') process.stdout.write(json(genesisAuctionArtifactInventory()) + '\n');
    else { check(args.length === 1, 'Usage: node tools/genesis-auction-deployment-plan.js --inventory | <public-manifest.json>');
      process.stdout.write(json(buildGenesisAuctionDeploymentPlan(JSON.parse(fs.readFileSync(args[0], 'utf8')))) + '\n'); }
  } catch (error) { process.stderr.write(`genesis-auction-deployment-plan: ${error.message}\n`); process.exitCode = 1; }
}
