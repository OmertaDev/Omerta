#!/usr/bin/env node
// Offline-only constructor and unsigned-call planning. No RPC, signer, key reader or broadcaster.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { encodeDeployData, encodeFunctionData, encodeAbiParameters, getContractAddress, getAddress,
  keccak256, toHex, concatHex, parseAbi, zeroAddress } from 'viem';

const ROOT = fileURLToPath(new URL('../omerta-contracts/', import.meta.url));
export const MARKET_V2_HOOK_FLAGS = 0x35c4n;
export const MARKET_V2_ROLES = [
  ['polFunding', 'OmertaReserveFundingV2'], ['reserveFunding', 'OmertaReserveFundingV2'],
  ['gameSettlement', 'OmertaGameSettlementV2'], ['hook', 'OmertaHookV2'],
  ['marketState', 'OmertaMarketStateV2'], ['turf', 'OmertaTurfV2'],
  ['turfFeeBridge', 'OmertaTurfFeeBridgeV2'], ['controller', 'OmertaStabilityControllerV2'],
  ['bond', 'OmertaInventoryBondV2'], ['arbitrage', 'OmertaArbitrageV2'], ['commitment', 'OmertaCommitmentVaultV2'],
];
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (v) => JSON.stringify(v, (_, x) => typeof x === 'bigint' ? x.toString() : x, 2);
const clone = (v) => JSON.parse(json(v));
const ordered = (v) => Array.isArray(v) ? v.map(ordered) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, ordered(v[k])])) : v;
const identity = (abi) => JSON.stringify(abi.map(x => JSON.stringify(ordered(x))).sort());
function obj(name, x) { if (!x || typeof x !== 'object' || Array.isArray(x)) throw Error(`${name} is required`); return x; }
function address(name, x) {
  if (typeof x !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(x) || /^0x0{40}$/.test(x)) throw Error(`${name}: nonzero public address required`);
  return getAddress(x.toLowerCase());
}
function hash(name, x) {
  if (typeof x !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(x) || /^0x0{64}$/.test(x)) throw Error(`${name}: nonzero 32-byte hash required`);
  return x.toLowerCase();
}
function uint(name, x, bits = 256, zero = false) {
  if (typeof x !== 'string' || !/^(0|[1-9][0-9]*)$/.test(x)) throw Error(`${name}: explicit decimal integer string required`);
  const n = BigInt(x);
  if ((!zero && n === 0n) || n >= 1n << BigInt(bits)) throw Error(`${name}: uint${bits} bounds`);
  return n;
}
function integer(name, x, low, high) {
  if (!Number.isSafeInteger(x) || x < low || x > high) throw Error(`${name}: integer ${low}..${high} required`);
  return x;
}
function exact(name, actual, expected) {
  if (String(actual).toLowerCase() !== String(expected).toLowerCase()) throw Error(`${name}: binding mismatch`);
}
function closed(name, value, keys) {
  obj(name, value);
  for (const k of keys) if (!(k in value)) throw Error(`${name}.${k}: missing required manifest field`);
  for (const k of Object.keys(value)) if (!keys.includes(k)) throw Error(`${name}.${k}: unknown manifest field`);
}
function range(name, value, low, high) {
  if ((typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value))
    && (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)) throw Error(`${name}: explicit nonnegative integer required`);
  const n = BigInt(value);
  if (n < BigInt(low) || n > BigInt(high)) throw Error(`${name}: constructor policy bounds`);
  return n;
}
function within(root, target) { const p = path.relative(root, target); return p !== '..' && !p.startsWith(`..${path.sep}`) && !path.isAbsolute(p); }
function noSecrets(value) {
  if (!value || typeof value !== 'object') return;
  for (const [k, v] of Object.entries(value)) {
    if (/private.?key|mnemonic|secret|password|seed.?phrase|rpc.?url/i.test(k)) throw Error(`Credentials/endpoints are not plan inputs: ${k}`);
    noSecrets(v);
  }
}

/** Verifies compiler metadata, every imported source, ABI, and bytecode before planning. */
export function loadMarketV2Artifact(contract, { contractsRoot = ROOT } = {}) {
  if (!MARKET_V2_ROLES.some(([, name]) => name === contract)) throw Error(`Unsupported V2 artifact ${contract}`);
  const root = fs.realpathSync(contractsRoot);
  const file = path.join(root, 'out', `${contract}.sol`, `${contract}.json`);
  const bytes = fs.readFileSync(file);
  const a = JSON.parse(bytes);
  const m = typeof a.rawMetadata === 'string' ? JSON.parse(a.rawMetadata) : a.metadata;
  if (m?.settings?.compilationTarget?.[`src/market-v2/${contract}.sol`] !== contract
    || !m.compiler?.version?.startsWith('0.8.26+') || !m.settings.optimizer?.enabled
    || m.settings.optimizer.runs !== 800 || m.settings.evmVersion !== 'cancun' || m.settings.viaIR !== true
    || !Array.isArray(a.abi) || identity(a.abi) !== identity(m.output.abi)) throw Error(`${contract}: compiler/ABI metadata mismatch`);
  const sourceHashes = {};
  for (const [source, info] of Object.entries(m.sources)) {
    const p = path.resolve(root, source);
    if (!within(root, p) || !within(root, fs.realpathSync(p))) throw Error(`${contract}: source outside contracts root`);
    const sourceBytes = fs.readFileSync(p);
    const actual = keccak256(toHex(sourceBytes));
    const lf = keccak256(toHex(sourceBytes.toString('utf8').replace(/\r\n/g, '\n')));
    if (actual !== info.keccak256 && lf !== info.keccak256) throw Error(`${contract}: stale artifact for ${source}`);
    sourceHashes[source] = { sha256: sha(sourceBytes), compilerInputKeccak256: info.keccak256, rawKeccak256: actual };
  }
  for (const field of ['bytecode', 'deployedBytecode']) {
    if (!/^0x(?:[\da-fA-F]{2})+$/.test(a[field]?.object || '') || Object.keys(a[field].linkReferences || {}).length)
      throw Error(`${contract}: bytecode absent or linked-library resolution required`);
  }
  return { abi: a.abi, bytecode: a.bytecode.object, evidence: {
    contract, artifactSha256: sha(bytes), compiler: m.compiler.version, settings: m.settings,
    creationBytecodeKeccak256: keccak256(a.bytecode.object), runtimeTemplateKeccak256: keccak256(a.deployedBytecode.object),
    runtimeTemplateBytes: (a.deployedBytecode.object.length - 2) / 2,
    immutableReferences: a.deployedBytecode.immutableReferences || {}, sources: sourceHashes,
  } };
}

export function mineMarketV2Hook(factory, initCodeHash, start, attempts) {
  address('create2 factory', factory); hash('initCodeHash', initCodeHash);
  if (typeof start !== 'bigint' || start < 0n || !Number.isSafeInteger(attempts) || attempts < 1 || attempts > 1_000_000)
    throw Error('Explicit bounded CREATE2 mining budget required');
  for (let i = 0; i < attempts; ++i) {
    const value = start + BigInt(i);
    if (value >= 1n << 256n) throw Error('CREATE2 salt overflow');
    const salt = toHex(value, { size: 32 });
    const candidate = getContractAddress({ opcode: 'CREATE2', from: factory, salt, bytecodeHash: initCodeHash });
    if ((BigInt(candidate) & 0x3fffn) === MARKET_V2_HOOK_FLAGS) return { address: candidate, salt, attempts: i + 1 };
  }
  throw Error('CREATE2 hook mining budget exhausted; increase explicit budget or change saltStart');
}

// Exact integer TickMath port for offline bootstrap cost checks, constants pinned to v4-core.
function sqrtAtTick(tick) {
  const factors = ['fffcb933bd6fad37aa2d162d1a594001','fff97272373d413259a46990580e213a','fff2e50f5f656932ef12357cf3c7fdcc','ffe5caca7e10e4e61c3624eaa0941cd0',
    'ffcb9843d60f6159c9db58835c926644','ff973b41fa98c081472e6896dfb254c0','ff2ea16466c96a3843ec78b326b52861','fe5dee046a99a2a811c461f1969c3053',
    'fcbe86c7900a88aedcffc83b479aa3a4','f987a7253ac413176f2b074cf7815e54','f3392b0822b70005940c7a398e4b70f3','e7159475a2c29b7443b29c7fa6e889d9',
    'd097f3bdfd2022b8845ad8f792aa5825','a9f746462d870fdf8a65dc1f90e061e5','70d869a156d2a1b890bb3df62baf32f7','31be135f97d08fd981231505542fcfa6',
    '9aa508b5b7a84e1c677de54f3e99bc9','5d6af8dedb81196699c329225ee604','2216e584f5fa1ea926041bedfe98','48a170391f7dc42444e8fa2'];
  let ratio = 1n << 128n;
  const absolute = Math.abs(tick);
  for (let i = 0; i < factors.length; ++i) if (absolute & (1 << i)) ratio = ratio * BigInt(`0x${factors[i]}`) >> 128n;
  if (tick > 0) ratio = ((1n << 256n) - 1n) / ratio;
  return (ratio >> 32n) + (ratio % (1n << 32n) === 0n ? 0n : 1n);
}
const POOL_PARAM = { type: 'tuple', components: [
  { name: 'currency0', type: 'address' }, { name: 'currency1', type: 'address' }, { name: 'fee', type: 'uint24' },
  { name: 'tickSpacing', type: 'int24' }, { name: 'hooks', type: 'address' },
] };

function checkedArgs(abi, args, name) {
  const inputs = abi.find(x => x.type === 'constructor')?.inputs || [];
  const validate = (p, value, at) => {
    if (value === undefined || value === null) throw Error(`${at}: missing constructor field`);
    const array = /^(.*)\[(\d*)\]$/.exec(p.type);
    if (array) {
      if (!Array.isArray(value) || (array[2] && value.length !== Number(array[2]))) throw Error(`${at}: wrong array length`);
      value.forEach((v, i) => validate({ ...p, type: array[1] }, v, `${at}[${i}]`));
    } else if (p.type === 'tuple') {
      obj(at, value);
      for (const component of p.components) validate(component, value[component.name], `${at}.${component.name}`);
      for (const key of Object.keys(value)) if (!p.components.some(c => c.name === key)) throw Error(`${at}.${key}: unknown field`);
    }
  };
  if (inputs.length !== args.length) throw Error(`${name}: wrong constructor arity`);
  inputs.forEach((p, i) => validate(p, args[i], `${name}.${p.name || i}`));
  encodeAbiParameters(inputs, args); // ABI integer/address/array bounds.
  return args;
}

/** Full one-season, one-Turf V2 deployment plan; all capacities and public identities come from input. */
export function buildMarketV2DeploymentPlan(input, { contractsRoot = ROOT, artifactLoader = loadMarketV2Artifact } = {}) {
  const m = clone(obj('manifest', input)); noSecrets(m);
  closed('manifest', m, ['schemaVersion', 'chainId', 'localRehearsal', 'sourceRevision', 'startingNonce', 'roles', 'snapshot',
    'external', 'create2', 'artifactHashes', 'policies', 'season', 'bootstrap', 'funding']);
  if (typeof m.localRehearsal !== 'boolean') throw Error('localRehearsal must explicitly be true or false');
  if (m.schemaVersion !== 1) throw Error('schemaVersion must be 1');
  integer('chainId', m.chainId, 1, Number.MAX_SAFE_INTEGER);
  if (m.chainId === 31337 && m.localRehearsal !== true) throw Error('31337 requires localRehearsal true');
  if (!/^[0-9a-f]{40}$/i.test(m.sourceRevision || '')) throw Error('sourceRevision must explicitly pin a full source commit');
  const r = Object.fromEntries(['safe', 'deployer', 'safeExecutor', 'adjudicator', 'initializer', 'dev', 'rwa', 'community', 'capitalProvider']
    .map(k => [k, address(`roles.${k}`, m.roles?.[k])]));
  closed('roles', m.roles, Object.keys(r));
  if (r.deployer === r.safe || r.deployer === r.safeExecutor || r.deployer === r.capitalProvider || r.deployer === r.adjudicator || r.deployer === r.initializer)
    throw Error('Deployment nonce owner must be separate from setup/initialization/funding callers');
  const external = Object.fromEntries(['omr', 'poolManager', 'positionManager', 'permit2'].map(k => [k, {
    address: address(`external.${k}`, m.external?.[k]?.address), runtimeHash: hash(`external.${k}.runtimeHash`, m.external?.[k]?.runtimeHash),
  }]));
  closed('external', m.external, Object.keys(external));
  for (const k of Object.keys(external)) closed(`external.${k}`, m.external[k], ['address', 'runtimeHash']);
  closed('snapshot', m.snapshot, ['timestamp', 'blockNumber', 'blockHash']);
  const now = uint('snapshot.timestamp', m.snapshot?.timestamp, 64);
  uint('snapshot.blockNumber', m.snapshot?.blockNumber, 64, true); hash('snapshot.blockHash', m.snapshot?.blockHash);
  const factory = address('create2.factory', m.create2?.factory);
  closed('create2', m.create2, ['factory', 'runtimeHash', 'kind', 'saltStart', 'maxAttempts']);
  hash('create2.runtimeHash', m.create2?.runtimeHash);
  if (m.create2.kind !== 'salt-prefix') throw Error('create2.kind must explicitly select salt-prefix deterministic deployment proxy');
  const start = uint('create2.saltStart', m.create2.saltStart, 256, true);
  const attempts = integer('create2.maxAttempts', m.create2.maxAttempts, 1, 1_000_000);
  const nonce = uint('startingNonce', m.startingNonce, 64, true);
  if (nonce + BigInt(MARKET_V2_ROLES.length) >= 1n << 64n) throw Error('Deployment nonce sequence overflows uint64');
  const artifacts = Object.fromEntries([...new Set(MARKET_V2_ROLES.map(([, c]) => c))].map(c => {
    const a = artifactLoader(c, { contractsRoot });
    const expected = m.artifactHashes?.[c];
    if (typeof expected !== 'string' || !/^[0-9a-f]{64}$/i.test(expected)) throw Error(`artifactHashes.${c}: explicit SHA256 required`);
    exact(`artifactHashes.${c}`, a.evidence.artifactSha256, expected);
    return [c, a];
  }));
  const deployed = {};
  MARKET_V2_ROLES.forEach(([role], i) => { if (role !== 'hook') deployed[role] = getContractAddress({ from: r.deployer, nonce: nonce + BigInt(i) }); });
  const p = obj('policies', m.policies);
  closed('policies', p, ['pool', 'hook', 'market', 'turf', 'stability', 'bond', 'arbitrage', 'commitment']);
  closed('policies.pool', p.pool, ['fee', 'tickSpacing']);
  closed('policies.hook', p.hook, ['opening', 'surgeFullTicks', 'epochDuration']);
  const fee = integer('pool.fee', p.pool?.fee, 0, 100_000);
  const spacing = integer('pool.tickSpacing', p.pool?.tickSpacing, 1, 200);
  const opening = obj('hook.opening', p.hook?.opening);
  closed('hook.opening', opening, ['blocks', 'buyBps', 'maxBuyQuote']);
  integer('opening.blocks', opening.blocks, 0, 200); integer('opening.buyBps', opening.buyBps, 0, 1000);
  uint('opening.maxBuyQuote', opening.maxBuyQuote, 128, true);
  if (opening.blocks === 0 && (opening.buyBps !== 0 || opening.maxBuyQuote !== '0')) throw Error('Disabled opening cannot carry a fee/cap');
  integer('surgeFullTicks', p.hook.surgeFullTicks, 1, 100_000);
  integer('epochDuration', p.hook.epochDuration, 60, 86400);
  const args = {};
  args.polFunding = [r.safe, external.omr.address, 0]; args.reserveFunding = [r.safe, external.omr.address, 5];
  args.gameSettlement = [r.safe, r.adjudicator];
  args.hook = [external.poolManager.address, external.omr.address, r.initializer, fee, spacing,
    [r.dev, r.rwa, r.community, deployed.polFunding, deployed.reserveFunding], opening, p.hook.surgeFullTicks, p.hook.epochDuration];
  const hookArtifact = artifacts.OmertaHookV2;
  const hookInit = encodeDeployData({ abi: hookArtifact.abi, bytecode: hookArtifact.bytecode,
    args: checkedArgs(hookArtifact.abi, args.hook, 'hook') });
  const mined = mineMarketV2Hook(factory, keccak256(hookInit), start, attempts);
  deployed.hook = mined.address;
  const pool = { currency0: zeroAddress, currency1: external.omr.address, fee, tickSpacing: spacing, hooks: deployed.hook };
  const poolId = keccak256(encodeAbiParameters([POOL_PARAM], [pool]));
  const s = obj('season', m.season);
  closed('season', s, ['startsAt', 'endsAt', 'lowerTick', 'upperTick', 'families', 'owners']);
  const startsAt = uint('season.startsAt', s.startsAt, 64), endsAt = uint('season.endsAt', s.endsAt, 64);
  if (startsAt <= now || endsAt <= startsAt || endsAt - startsAt > 365n * 86400n) throw Error('A future season of at most 365 days is required');
  integer('season.lowerTick', s.lowerTick, -887272, 887272); integer('season.upperTick', s.upperTick, -887272, 887272);
  if (s.lowerTick >= s.upperTick || s.lowerTick % spacing || s.upperTick % spacing) throw Error('Season range must align to canonical tick spacing');
  const familyMap = new Map();
  if (!Array.isArray(s.families) || s.families.length === 0 || s.families.length > 4) throw Error('1..4 explicit initial family treasuries required');
  for (const family of s.families) {
    closed('family', family, ['id', 'treasury']);
    const id = uint('family.id', family.id, 64).toString();
    if (familyMap.has(id)) throw Error('Duplicate family treasury');
    familyMap.set(id, address(`family.${id}.treasury`, family.treasury));
  }
  const owners = obj('season.owners', s.owners);
  closed('season.owners', owners, ['families', 'shares', 'count']);
  integer('owners.count', owners.count, 1, 4);
  if (owners.families?.length !== 4 || owners.shares?.length !== 4) throw Error('Owner arrays must each contain exactly four slots');
  let shares = 0; const seen = new Set();
  for (let i = 0; i < 4; ++i) {
    const id = uint(`owners.families[${i}]`, owners.families[i], 64, true).toString();
    integer('owner share', owners.shares[i], 0, 10000);
    if (i < owners.count) {
      if (!familyMap.has(id) || seen.has(id) || owners.shares[i] === 0) throw Error('Owner lacks treasury, is duplicated, or has no share');
      seen.add(id); shares += owners.shares[i];
    } else if (id !== '0' || owners.shares[i] !== 0) throw Error('Unused owner slots must be zero');
  }
  if (shares !== 10000) throw Error('Family ownership shares must sum to 10000');
  obj('market', p.market); obj('stability', p.stability); obj('bond', p.bond); obj('arbitrage', p.arbitrage); obj('commitment', p.commitment);
  closed('market', p.market, ['requiredLiquidity', 'maxAge', 'fullStressTicks']);
  closed('turf', p.turf, ['maxAge']);
  closed('arbitrage', p.arbitrage, ['reserveProfitBps', 'maxInput']);
  closed('commitment', p.commitment, ['maxAge', 'minLiquidity']);
  const u128 = (1n << 128n) - 1n, u32 = (1n << 32n) - 1n;
  range('market.requiredLiquidity', p.market.requiredLiquidity, 1, u128);
  range('market.maxAge', p.market.maxAge, p.hook.epochDuration, 7 * 86400);
  range('market.fullStressTicks', p.market.fullStressTicks, 1, 100_000);
  range('turf.maxAge', p.turf.maxAge, 1, 86400);
  range('stability.maxObservationAge', p.stability.maxObservationAge, 1, 86400);
  range('stability.cooldown', p.stability.cooldown, 60, u32);
  range('stability.recoveryInterval', p.stability.recoveryInterval, 60, u32);
  range('stability.minLiquidity', p.stability.minLiquidity, 1, u128);
  range('stability.maxSpotDeviationTicks', p.stability.maxSpotDeviationTicks, 1, 2000);
  const minBand = range('stability.minBandTicks', p.stability.minBandTicks, spacing, 10000);
  range('stability.maxBandTicks', p.stability.maxBandTicks, minBand, 10000);
  const stressOff = range('stability.stressOffBps', p.stability.stressOffBps, 0, 9999);
  range('stability.stressOnBps', p.stability.stressOnBps, stressOff + 1n, 10000);
  const y = range('stability.recoveryY', p.stability.recoveryY, 1, 32);
  range('stability.recoveryX', p.stability.recoveryX, 1, y);
  if (!Array.isArray(p.stability.limits) || p.stability.limits.length !== 7) throw Error('Seven explicit tranche limits required');
  for (const [i, limits] of p.stability.limits.entries()) {
    for (const currency of ['native', 'omr']) {
      // Missing keys are diagnosed as constructor fields below; present values must also obey
      // cross-field budget inequalities, not merely fit the ABI's integer widths.
      const keys = ['PerAction', 'PerEpisode', 'Lifetime', 'Regeneration'].map(k => currency + k);
      if (keys.some(k => !(k in limits))) continue;
      const values = keys.map(k => range(`stability.limits[${i}].${k}`, limits[k], 0, u128));
      if (values[0] > values[1] || values[1] > values[2] || values[3] > values[1]) throw Error('Tranche budget ordering is inconsistent');
    }
  }
  range('bond.maxObservationAge', p.bond.maxObservationAge, 1, 86400);
  range('bond.vestingSeconds', p.bond.vestingSeconds, 86400, 365 * 86400);
  range('bond.minLiquidity', p.bond.minLiquidity, 1, u128);
  range('bond.maxSpotDeviationTicks', p.bond.maxSpotDeviationTicks, 1, 2000);
  range('bond.discountBps', p.bond.discountBps, 0, 1000);
  let minimum = range('bond.minNativePurchase', p.bond.minNativePurchase, 1, u128);
  for (const k of ['maxNativePurchase', 'maxNativePerEpoch', 'maxNativeLifetime']) minimum = range(`bond.${k}`, p.bond[k], minimum, u128);
  minimum = 1n;
  for (const k of ['maxOmrPerPurchase', 'maxOmrPerEpoch', 'maxOmrLifetime']) minimum = range(`bond.${k}`, p.bond[k], minimum, u128);
  range('bond.maxOmrPerEth', p.bond.maxOmrPerEth, 1, (1n << 256n) - 1n);
  range('arbitrage.reserveProfitBps', p.arbitrage.reserveProfitBps, 0, 5000);
  range('arbitrage.maxInput', p.arbitrage.maxInput, 1, (1n << 127n) - 1n);
  range('commitment.maxAge', p.commitment.maxAge, 1, 86400);
  range('commitment.minLiquidity', p.commitment.minLiquidity, 1, u128);
  args.marketState = [deployed.hook, p.market.requiredLiquidity, p.market.maxAge, p.market.fullStressTicks];
  args.turf = [r.safe, external.omr.address, deployed.gameSettlement, deployed.marketState, spacing, p.turf?.maxAge];
  args.turfFeeBridge = [r.safe, deployed.turf, 1n, 0];
  const fixedStability = { safe: r.safe, manager: external.poolManager.address, key: pool, marketState: deployed.marketState,
    feeRecipients: Array.from({ length: 7 }, (_, i) => i === 6 ? deployed.turfFeeBridge : deployed.reserveFunding),
    turfLower: s.lowerTick, turfUpper: s.upperTick, turfSeasonStart: startsAt, turfSeasonEnd: endsAt };
  for (const k of Object.keys(fixedStability)) if (k in p.stability) throw Error(`policies.stability.${k}: binding is derived, not a policy input`);
  args.controller = [{ ...p.stability, ...fixedStability }];
  const fixedBond = { safe: r.safe, proceedsRecipient: deployed.reserveFunding, manager: external.poolManager.address, key: pool, marketState: deployed.marketState };
  for (const k of Object.keys(fixedBond)) if (k in p.bond) throw Error(`policies.bond.${k}: binding is derived, not a policy input`);
  args.bond = [{ ...p.bond, ...fixedBond }];
  args.arbitrage = [external.poolManager.address, pool, deployed.reserveFunding, p.arbitrage.reserveProfitBps, p.arbitrage.maxInput];
  args.commitment = [r.safe, external.positionManager.address, deployed.marketState, pool, p.commitment.maxAge, p.commitment.minLiquidity];
  const deployment = MARKET_V2_ROLES.map(([role, contract], i) => {
    const a = artifacts[contract]; const constructorArgs = checkedArgs(a.abi, args[role], role);
    const initCode = role === 'hook' ? hookInit : encodeDeployData({ abi: a.abi, bytecode: a.bytecode, args: constructorArgs });
    return { kind: 'deployment', role, contract, method: role === 'hook' ? 'CREATE2' : 'CREATE',
      expectedAddress: deployed[role], constructorArgs, initCodeHash: keccak256(initCode),
      transaction: { chainId: m.chainId, from: r.deployer, nonce: nonce + BigInt(i), value: '0',
        ...(role === 'hook' ? { to: factory, data: concatHex([mined.salt, initCode]) } : { data: initCode }) },
      ...(role === 'hook' ? { salt: mined.salt, hookFlags: toHex(MARKET_V2_HOOK_FLAGS), miningAttempts: mined.attempts } : {}) };
  });
  const steps = [];
  function call(label, role, fn, values, caller = r.safe, value = 0n) {
    const contract = MARKET_V2_ROLES.find(([name]) => name === role)[1];
    steps.push({ kind: 'call', label, role, functionName: fn, args: values,
      transaction: { chainId: m.chainId, from: caller, to: deployed[role], value, data: encodeFunctionData({ abi: artifacts[contract].abi, functionName: fn, args: values }) } });
  }
  for (const d of deployment) {
    steps.push(d);
    if (d.role === 'turf') {
      call('Bind game settlement to its immutable registry', 'gameSettlement', 'bindRegistry', [deployed.turf]);
      for (const [id, wallet] of familyMap) call(`Register family ${id} treasury`, 'gameSettlement', 'setFamilyTreasury', [BigInt(id), wallet, 0n], r.adjudicator);
      call('Create future season 1', 'turf', 'createSeason', [startsAt, endsAt]);
      call('Create immutable seasonal Turf 0 before bridge construction', 'turf', 'createTurf', [1n, s.lowerTick, s.upperTick, owners]);
    }
  }
  call('Bind POL funding to Core capital', 'polFunding', 'bindController', [deployed.controller]);
  call('Bind stability funding to War Chest', 'reserveFunding', 'bindController', [deployed.controller]);
  call('Bind earned Turf fees to controller accounting', 'turfFeeBridge', 'bindSource', [deployed.controller]);
  call('Bind the only fee source for season 1 Turf 0', 'turf', 'bindFeeSource', [deployed.turfFeeBridge, 1n, 0]);
  call('Register the game fee checkpoint lane before season start', 'gameSettlement', 'registerLane', [deployed.turfFeeBridge]);

  const b = obj('bootstrap', m.bootstrap);
  closed('bootstrap', b, ['sqrtPriceX96', 'liquidity', 'maxNative', 'maxOmr', 'deadline', 'positionOwner', 'lowerTick', 'upperTick']);
  const price = uint('bootstrap.sqrtPriceX96', b.sqrtPriceX96, 160);
  const liquidity = uint('bootstrap.liquidity', b.liquidity, 127);
  const max0 = uint('bootstrap.maxNative', b.maxNative, 128), max1 = uint('bootstrap.maxOmr', b.maxOmr, 128);
  const deadline = uint('bootstrap.deadline', b.deadline, 48);
  const owner = address('bootstrap.positionOwner', b.positionOwner);
  integer('bootstrap.lowerTick', b.lowerTick, -887272, 887272); integer('bootstrap.upperTick', b.upperTick, -887272, 887272);
  if (b.lowerTick >= b.upperTick || b.lowerTick % spacing || b.upperTick % spacing || deadline <= now)
    throw Error('Invalid bootstrap range, alignment, or deadline');
  const lower = sqrtAtTick(b.lowerTick), upper = sqrtAtTick(b.upperTick);
  if (price <= lower || price >= upper) throw Error('Bootstrap must seed active liquidity around initial price');
  const minimums = [p.market.requiredLiquidity, p.stability.minLiquidity, p.bond.minLiquidity, p.commitment.minLiquidity];
  if (minimums.some(x => liquidity < BigInt(x))) throw Error('Bootstrap liquidity does not meet observation/strategy prerequisites');
  const ceil = (n, d) => (n + d - 1n) / d;
  const required0 = ceil(liquidity * (1n << 96n) * (upper - price), price * upper);
  const required1 = ceil(liquidity * (price - lower), 1n << 96n);
  if (required0 > max0 || required1 > max1) throw Error('Bootstrap asset caps cannot fund requested liquidity');
  const externalCall = (label, to, abi, fn, values, from, value = 0n) => steps.push({ kind: 'call', label,
    functionName: fn, args: values, transaction: { chainId: m.chainId, from, to, value, data: encodeFunctionData({ abi, functionName: fn, args: values }) } });
  const poolAbi = [{ type: 'function', name: 'initialize', stateMutability: 'nonpayable', inputs: [{ ...POOL_PARAM, name: 'key' }, { name: 'sqrtPriceX96', type: 'uint160' }], outputs: [{ type: 'int24' }] }];
  externalCall('Initialize the canonical pool in the authorized caller context', external.poolManager.address, poolAbi, 'initialize', [pool, price], r.initializer);
  const tokenAbi = parseAbi(['function approve(address spender,uint256 amount) returns (bool)']);
  externalCall('Approve only the bootstrap OMR cap to Permit2', external.omr.address, tokenAbi, 'approve', [external.permit2.address, max1], r.capitalProvider);
  externalCall('Authorize only the bootstrap PositionManager cap until its deadline', external.permit2.address,
    parseAbi(['function approve(address token,address spender,uint160 amount,uint48 expiration)']), 'approve', [external.omr.address, external.positionManager.address, max1, deadline], r.capitalProvider);
  const mint = encodeAbiParameters([POOL_PARAM, { type: 'int24' }, { type: 'int24' }, { type: 'uint256' }, { type: 'uint128' }, { type: 'uint128' }, { type: 'address' }, { type: 'bytes' }],
    [pool, b.lowerTick, b.upperTick, liquidity, max0, max1, owner, '0x']);
  const settle = encodeAbiParameters([{ type: 'address' }, { type: 'address' }], [zeroAddress, external.omr.address]);
  const sweep = encodeAbiParameters([{ type: 'address' }, { type: 'address' }], [zeroAddress, r.capitalProvider]);
  const unlock = encodeAbiParameters([{ type: 'bytes' }, { type: 'bytes[]' }], ['0x020d14', [mint, settle, sweep]]);
  externalCall('Mint the funded bootstrap position, settle both currencies and refund unused native cap', external.positionManager.address,
    parseAbi(['function modifyLiquidities(bytes unlockData,uint256 deadline) payable']), 'modifyLiquidities', [unlock, deadline], r.capitalProvider, max0);
  externalCall('Revoke the bootstrap Permit2 token allowance', external.omr.address, tokenAbi, 'approve', [external.permit2.address, 0n], r.capitalProvider);
  externalCall('Revoke PositionManager Permit2 allowance', external.permit2.address,
    parseAbi(['function approve(address token,address spender,uint160 amount,uint48 expiration)']), 'approve', [external.omr.address, external.positionManager.address, 0n, deadline], r.capitalProvider);
  steps.push({ kind: 'readiness', label: 'Wait for a complete healthy finalized observation epoch', required: {
    hookInitialized: true, canonicalPoolId: poolId, activeLiquidityAtLeast: liquidity,
    earliestHealthyEpoch: 'A full fixed epoch after bootstrap liquidity is present throughout; partial genesis and zero-depth intervals are invalid',
    marketStateRefresh: { to: deployed.marketState, data: encodeFunctionData({ abi: artifacts.OmertaMarketStateV2.abi, functionName: 'refresh' }) },
    validSnapshot: true, minLiquidityAtLeast: p.market.requiredLiquidity,
  } });
  const funding = obj('funding', m.funding);
  closed('funding', funding, ['tranches', 'bondOmr']);
  if (!Array.isArray(funding.tranches) || funding.tranches.length !== 7) throw Error('Exactly seven explicit tranche funding budgets required');
  let omrTotal = 0n;
  const budgets = funding.tranches.map((x, i) => {
    closed(`funding.tranches[${i}]`, x, ['native', 'omr']);
    return { native: uint(`funding.tranches[${i}].native`, x.native, 128, true), omr: uint(`funding.tranches[${i}].omr`, x.omr, 128, true) };
  });
  budgets.forEach(x => { omrTotal += x.omr; });
  if (omrTotal > 0n) externalCall('Approve exactly funded controller OMR inventory', external.omr.address, tokenAbi, 'approve', [deployed.controller, omrTotal], r.capitalProvider);
  budgets.forEach((x, i) => { if (x.native || x.omr) call(`Fund tranche ${i} without resetting capacity`, 'controller', 'fund', [i, x.omr], r.capitalProvider, x.native); });
  if (omrTotal > 0n) externalCall('Revoke controller OMR funding allowance', external.omr.address, tokenAbi, 'approve', [deployed.controller, 0n], r.capitalProvider);
  const inventory = uint('funding.bondOmr', funding.bondOmr, 128, true);
  if (inventory > 0n) {
    externalCall('Approve exactly funded bond OMR inventory', external.omr.address, tokenAbi, 'approve', [deployed.bond, inventory], r.capitalProvider);
    call('Fund actual bond inventory', 'bond', 'fundInventory', [inventory], r.capitalProvider);
    externalCall('Revoke bond inventory funding allowance', external.omr.address, tokenAbi, 'approve', [deployed.bond, 0n], r.capitalProvider);
  }
  const output = { schemaVersion: 1, mode: 'offline-unsigned', chainId: m.chainId, sourceRevision: m.sourceRevision,
    manifestSha256: sha(json(m)), snapshot: m.snapshot, addresses: deployed, canonicalPool: { ...pool, poolId },
    economics: { sellBaseBps: 900, splitBps: { dev: 200, rwa: 160, community: 240, pol: 300 }, maximumSurgeBps: 100,
      surgeRecipient: deployed.reserveFunding, ordinaryBuyBps: 0, opening, maximumHookBps: 1000, lpFeeUnits: fee },
    artifacts: Object.fromEntries(Object.entries(artifacts).map(([c, a]) => [c, { abi: a.abi, ...a.evidence }])),
    bootstrapAmounts: { native: required0, omr: required1, nativeCap: max0, omrCap: max1 },
    externalRuntimePins: external, create2Factory: m.create2, steps,
    executionConditions: [
      'No transaction has been simulated, signed or broadcast by this tool.',
      'Read live chain ID, source/runtime identities, deployer nonce and empty predicted addresses before simulation.',
      'EOA deployer sends only the eleven deployment transactions; Safe executor, initializer, adjudicator and capital provider do not consume its nonce sequence.',
      'Safe calls are inner calls for the configured Safe; use its existing threshold and the separate Safe executor.',
      'The salt-prefix factory must have the explicitly pinned runtime and accept salt||initCode with zero value.',
      'Initialize must execute from the hook authorized address; a contract initializer needs its reviewed entry point to make the listed inner call.',
      'Season and fee lane setup must complete before the explicit season starts; bootstrap deadlines and funded balances must remain valid.',
      'External OMR is standard 18-decimal, non-rebasing and has transfer taxes disabled for this hook-tax market.',
      'Verify PositionManager.poolManager and PositionManager.permit2 against the explicit external bindings.',
      'The first pool position is required before autonomous Core deployment because observations and strategies require existing active liquidity.',
      'Runtime template hashes exclude immutable constructor substitution; verify actual deployed runtime with constructor-specific immutable references after simulation.',
    ] };
  return clone(output);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 1) throw Error('Usage: node tools/market-v2-deployment-plan.js <public-manifest.json>');
    process.stdout.write(`${json(buildMarketV2DeploymentPlan(JSON.parse(fs.readFileSync(args[0], 'utf8'))))}\n`);
  } catch (error) { process.stderr.write(`market-v2-deployment-plan: ${error.message}\n`); process.exitCode = 1; }
}
