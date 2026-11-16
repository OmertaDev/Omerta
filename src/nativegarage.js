// Read-only RPC facade. Transactions are simulated here and signed only by the player's wallet.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createPublicClient, http, parseAbi, parseAbiItem, getAddress, isAddress,
  keccak256, encodeFunctionData, toHex } from 'viem';

const ZERO = '0x0000000000000000000000000000000000000000';
const ZERO_HASH = `0x${'0'.repeat(64)}`;
const DRAND_CHAIN = '0x04f1e9062b8a81f848fded9c12306733282b2727ecced50032187751166ec8c3';
const FEE = 600000000000000000n;
const TRANSFER = parseAbiItem('event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)');
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
const json = value => JSON.parse(JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v));
const snapshot = '(uint32 level,bytes32 location,bool alive,bool fenceNetwork,uint32 speed,uint32 cunning,uint128 energyMicros,uint64 capturedAtMs,uint64 nextGtaAtMs,uint64 jailUntilMs)';
const errors = ['ERC721NonexistentToken(uint256)', 'ERC721InvalidReceiver(address)', 'ERC721IncorrectOwner(address,uint256,address)',
  'ERC721InsufficientApproval(address,uint256)', 'InvalidRecipient()', 'Unauthorized()', 'NotActive()', 'GarageFull()',
  'ToolAssigned()', 'ToolNotAssigned()', 'InsufficientMaterials()', 'PaymentNotReady()', 'InexactPayment()',
  'DependencyChanged()', 'RandomnessPending()', 'InvalidProof()', 'AlreadyFulfilled()'].map(e => `error ${e}`);

export const NATIVE_GARAGE_ABI = Object.freeze({
  engine: parseAbi([
    ...errors,
    'function manifestHash() view returns(bytes32)', 'function sourceRulesCommitment() view returns(bytes32)',
    'function migrationChainId() view returns(uint256)', 'function randomnessSource() view returns(address)',
    'function rules() view returns(address)', 'function foundry() view returns(address)',
    'function randomnessRuntimeHash() view returns(bytes32)', 'function rulesRuntimeHash() view returns(bytes32)',
    'function profileForWallet(address) view returns(bytes32)',
    `function profile(bytes32) view returns((bytes32 profileId,bytes32 accountIdHash,bytes32 characterIdHash,address wallet,bytes32 snapshotHash,${snapshot} state))`,
    'function claimed(bytes32) view returns(bool)', 'function retired(bytes32) view returns(bool)',
    'function energy(bytes32) view returns(uint128 micros,uint64 atMs,uint32 carry)',
    'function energyCap(uint32) pure returns(uint128)', 'function nextGtaAtMs(bytes32) view returns(uint64)',
    'function jailUntilMs(bytes32) view returns(uint64)', 'function pendingRequest(bytes32) view returns(uint256)',
    'function garageCount(bytes32) view returns(uint256)',
    'function action(uint256) view returns((bytes32 profileId,uint256 nonce,uint64 requestedAtMs,uint64 round,uint16 chanceBps,bool settled,bool success,uint256 tokenId,bytes32 wordHash))',
    'function car(uint256) view returns((bytes32 originProfile,uint256 requestId,uint256 actionNonce,bytes32 wordHash,uint8 modelIndex,uint8 trimIndex,uint8 damage,uint8 rarityIndex,bytes32 sourceHash))',
    'function ownerOf(uint256) view returns(address)', 'function claim(bytes32)', 'function requestGta(bytes32)',
    'function settleGta(uint256)', 'function abandonCar(uint256)',
    'function safeTransferFrom(address,address,uint256)',
  ]),
  module: parseAbi([
    ...errors,
    'function recipeCommitment() view returns(bytes32)', 'function deploymentChainId() view returns(uint256)',
    'function acquisition() view returns(address)', 'function acquisitionRuntimeHash() view returns(bytes32)',
    'function omr() view returns(address)', 'function omrRuntimeHash() view returns(bytes32)',
    'function houseRevenueRecipient() view returns(address)',
    'function materials(bytes32) view returns(uint128 scrap,uint128 wire,uint128 steel,uint128 parts)',
    'function assignedProfile(uint256) view returns(bytes32)', 'function ownerOf(uint256) view returns(address)',
    'function provenance(uint256) view returns((bytes32 profileId,bytes32 snapshotHash,bytes32 accountIdHash,bytes32 characterIdHash,address crafter,bytes32 recipeCommitment,uint256 sequence,uint128 steelConsumed,uint128 partsConsumed))',
    'function salvage(bytes32,uint256)', 'function harden(bytes32,uint256)', 'function craft(bytes32)',
    'function assign(uint256,bytes32)', 'function unassign(uint256)', 'function safeTransferFrom(address,address,uint256)',
  ]),
  rules: parseAbi(['function sourceRulesCommitment() pure returns(bytes32)', 'function modelId(uint256) pure returns(string)']),
  drand: parseAbi([...errors, 'function CHAIN_HASH() view returns(bytes32)',
    'function requests(uint256) view returns(address consumer,uint64 round,bool fulfilled,uint256 word)',
    'function readyAt(uint64) pure returns(uint256)', 'function fulfill(uint256,bytes)']),
  omr: parseAbi(['function decimals() view returns(uint8)', 'function balanceOf(address) view returns(uint256)',
    'function allowance(address,address) view returns(uint256)', 'function approve(address,uint256) returns(bool)',
    'function policySealed() view returns(bool)', 'function isOperator(address) view returns(bool)',
    'function operatorRole(address) view returns(uint8)', 'function isRecipient(address) view returns(bool)']),
});

export class NativeGarageError extends Error {
  constructor(code, message, statusCode = 400) { super(message); this.code = code; this.statusCode = statusCode; }
}
const fail = (code, message, status = 400) => { throw new NativeGarageError(code, message, status); };
function address(value, label = 'Wallet') {
  if (typeof value !== 'string' || !isAddress(value) || same(value, ZERO)) fail('native_bad_address', `${label} must be a nonzero address.`);
  return getAddress(value);
}
function hash(value, label = 'Hash') {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value) || same(value, ZERO_HASH)) fail('native_bad_hash', `${label} must be a nonzero 32-byte hash.`);
  return value.toLowerCase();
}
function uint(value, label, { zero = false, max = (1n << 256n) - 1n } = {}) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,77})$/.test(value)) fail('native_bad_amount', `${label} must be a canonical decimal string.`);
  const n = BigInt(value);
  if ((!zero && n === 0n) || n > max) fail('native_bad_amount', `${label} is outside the permitted range.`);
  return n;
}
function object(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Reflect.ownKeys(value).some(k => !allowed.includes(k) || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, k), 'value'))) {
    fail('native_bad_request', 'Unsupported request fields.');
  }
  return value;
}
function closed(reason, status = 'unconfigured') { return Object.freeze({ configured: false, enabled: false, status, reason }); }

// Deployment files contain public data only. A separate hash pins their exact bytes.
export function loadNativeGarageConfig(env = process.env, { allowLocal = false } = {}) {
  if (env.NATIVE_GARAGE_ENABLED !== 'on') return closed('Native garage deployment is not enabled.');
  try {
    if (!env.NATIVE_GARAGE_MANIFEST_PATH || !/^[0-9a-fA-F]{64}$/.test(env.NATIVE_GARAGE_MANIFEST_SHA256 || '')) throw new Error('pins');
    const bytes = fs.readFileSync(env.NATIVE_GARAGE_MANIFEST_PATH);
    if (bytes.length > 65536 || crypto.createHash('sha256').update(bytes).digest('hex') !== env.NATIVE_GARAGE_MANIFEST_SHA256.toLowerCase()) throw new Error('pins');
    const manifest = JSON.parse(bytes.toString('utf8'));
    const config = validateConfig({ ...manifest, rpcUrl: env.NATIVE_GARAGE_RPC_URL,
      deploymentHash: env.NATIVE_GARAGE_MANIFEST_SHA256.toLowerCase() }, { allowLocal });
    return Object.freeze(config);
  } catch { return closed('Native garage deployment configuration is missing or invalid.', 'invalid-configuration'); }
}

function validateConfig(c, { allowLocal = false } = {}) {
  if (c.schema !== 'omerta.native-garage.deployment.v1' || !Number.isSafeInteger(c.chainId)
    || (c.chainId !== 4663 && !(allowLocal && c.chainId === 31337))) fail('native_configuration', 'Unsupported native garage chain.');
  const confirmations = c.confirmations ?? 5;
  if (!Number.isSafeInteger(confirmations) || confirmations < 5 || confirmations > 100) fail('native_configuration', 'At least five confirmations are required.');
  const startBlock = uint(c.startBlock, 'Start block', { zero: true });
  const contracts = {};
  for (const name of ['engine', 'module', 'drand', 'rules', 'omr']) contracts[name] = {
    address: address(c.contracts?.[name]?.address, name), runtimeHash: hash(c.contracts?.[name]?.runtimeHash, `${name} runtime hash`),
  };
  if (new Set(Object.values(contracts).map(v => v.address.toLowerCase())).size !== 5) fail('native_configuration', 'Contract addresses must be distinct.');
  const rpc = new URL(c.rpcUrl), explorer = new URL(c.explorer);
  if ((rpc.protocol !== 'https:' && !(allowLocal && rpc.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(rpc.hostname)))
    || explorer.protocol !== 'https:' || rpc.username || rpc.password || explorer.username || explorer.password) {
    fail('native_configuration', 'Invalid RPC or explorer URL.');
  }
  return { configured: true, enabled: true, status: 'configured', schema: c.schema, chainId: c.chainId,
    startBlock: startBlock.toString(), startBlockHash: hash(c.startBlockHash, 'Start block hash'), confirmations,
    explorer: explorer.href.replace(/\/$/, ''), rpcUrl: rpc.href, contracts, house: address(c.house, 'House'),
    manifestHash: hash(c.manifestHash, 'Manifest hash'), sourceRulesCommitment: hash(c.sourceRulesCommitment, 'Rules commitment'),
    foundryRecipeCommitment: hash(c.foundryRecipeCommitment, 'Foundry commitment'),
    deploymentHash: c.deploymentHash || crypto.createHash('sha256').update(JSON.stringify(c)).digest('hex') };
}

function publicConfig(config) {
  if (!config.configured) return { ...config };
  return { configured: true, enabled: true, status: 'configured', chainId: config.chainId,
    manifestHash: config.manifestHash, deploymentHash: config.deploymentHash,
    sourceRulesCommitment: config.sourceRulesCommitment, foundryRecipeCommitment: config.foundryRecipeCommitment,
    contracts: { ...Object.fromEntries(Object.entries(config.contracts).map(([k, v]) => [k, v.address])), house: config.house },
    explorer: config.explorer, confirmations: config.confirmations, startBlock: config.startBlock };
}

function safeError(error) {
  if (error instanceof NativeGarageError) return error;
  let current = error;
  for (let i = 0; current && i < 6; i++, current = current.cause) {
    const name = current.data?.errorName;
    if (typeof name === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,64}$/.test(name)) {
      return new NativeGarageError('native_simulation_reverted', `Transaction simulation rejected: ${name}.`);
    }
  }
  return new NativeGarageError('native_rpc_unavailable', 'Native garage RPC verification could not complete.', 503);
}

export function createNativeGarageService({ config = loadNativeGarageConfig(), publicClient,
  fetchImpl = globalThis.fetch, clock = () => Date.now(), allowLocal = false, limits = {} } = {}) {
  if (config.configured) config = validateConfig(config, { allowLocal });
  const client = publicClient || (config.configured ? createPublicClient({ transport: http(config.rpcUrl, { retryCount: 0, timeout: 12000 }) }) : null);
  const chunkSize = BigInt(Math.min(limits.chunkSize || 1000, 1000));
  const maxChunks = Math.min(limits.maxChunks || 4, 4);
  const maxTokens = Math.min(limits.maxTokens || 100000, 100000);
  const maxLogs = Math.min(limits.maxLogs || 10000, 10000);
  const index = { cursor: BigInt(config.startBlock || 0) - 1n, hash: null, owners: new Map(), lock: Promise.resolve() };
  const read = (kind, functionName, args = [], blockNumber) => client.readContract({ address: config.contracts[kind].address,
    abi: NATIVE_GARAGE_ABI[kind], functionName, args, ...(blockNumber == null ? {} : { blockNumber }) });
  const needConfigured = () => { if (!config.configured) fail('native_unconfigured', config.reason || 'Native garage is unavailable.', 503); };

  async function context(confirmed = false) {
    needConfigured();
    const [chain, head] = await Promise.all([client.getChainId(), client.getBlock({ blockTag: 'latest' })]);
    if (chain !== config.chainId) fail('native_chain_mismatch', 'Native garage RPC is on the wrong chain.', 503);
    const age = clock() - Number(head.timestamp) * 1000;
    if (age > 300000 || age < -60000) fail('native_stale_chain', 'Native garage chain clock is not sufficiently current.', 503);
    let number = head.number;
    if (confirmed) number -= BigInt(config.confirmations - 1);
    if (number < BigInt(config.startBlock)) fail('native_awaiting_confirmations', 'Deployment is awaiting confirmations.', 503);
    const block = confirmed ? await client.getBlock({ blockNumber: number }) : head;
    const start = await client.getBlock({ blockNumber: BigInt(config.startBlock) });
    if (!same(start.hash, config.startBlockHash)) fail('native_deployment_reorg', 'Deployment anchor does not match the canonical chain.', 503);
    const codes = await Promise.all(Object.entries(config.contracts).map(async ([name, pin]) => {
      const code = await client.getCode({ address: pin.address, blockNumber: number });
      if (!code || code === '0x' || !same(keccak256(code), pin.runtimeHash)) fail('native_runtime_mismatch', `${name} runtime does not match the deployment.`, 503);
      return [name, pin.runtimeHash];
    }));
    const runtime = Object.fromEntries(codes);
    const pins = [
      ['engine', 'manifestHash', config.manifestHash], ['engine', 'sourceRulesCommitment', config.sourceRulesCommitment],
      ['engine', 'migrationChainId', BigInt(config.chainId)], ['engine', 'randomnessSource', config.contracts.drand.address],
      ['engine', 'rules', config.contracts.rules.address], ['engine', 'foundry', config.contracts.module.address],
      ['engine', 'randomnessRuntimeHash', runtime.drand], ['engine', 'rulesRuntimeHash', runtime.rules],
      ['module', 'recipeCommitment', config.foundryRecipeCommitment], ['module', 'deploymentChainId', BigInt(config.chainId)],
      ['module', 'acquisition', config.contracts.engine.address], ['module', 'acquisitionRuntimeHash', runtime.engine],
      ['module', 'omr', config.contracts.omr.address], ['module', 'omrRuntimeHash', runtime.omr],
      ['module', 'houseRevenueRecipient', config.house], ['rules', 'sourceRulesCommitment', config.sourceRulesCommitment],
      ['drand', 'CHAIN_HASH', DRAND_CHAIN], ['omr', 'decimals', 18],
    ];
    await Promise.all(pins.map(async ([kind, name, expected]) => {
      const actual = await read(kind, name, [], number);
      if (typeof expected === 'string' ? !same(actual, expected) : BigInt(actual) !== BigInt(expected)) {
        fail('native_binding_mismatch', `${kind}.${name} does not match the deployment.`, 503);
      }
    }));
    return { block, number, head };
  }

  async function walletState(wallet, ctx) {
    const id = await read('engine', 'profileForWallet', [wallet], ctx.number);
    let profile = null, energy = null, pending = null;
    let materials = { scrap: 0n, wire: 0n, steel: 0n, parts: 0n };
    if (!same(id, ZERO_HASH)) {
      const [record, claimed, retired, e, cooldown, jail, requestId, count, m] = await Promise.all([
        read('engine', 'profile', [id], ctx.number), read('engine', 'claimed', [id], ctx.number),
        read('engine', 'retired', [id], ctx.number), read('engine', 'energy', [id], ctx.number),
        read('engine', 'nextGtaAtMs', [id], ctx.number), read('engine', 'jailUntilMs', [id], ctx.number),
        read('engine', 'pendingRequest', [id], ctx.number), read('engine', 'garageCount', [id], ctx.number),
        read('module', 'materials', [id], ctx.number),
      ]);
      if (!same(record.wallet, wallet) || !same(record.profileId, id)) fail('native_profile_mismatch', 'Profile wallet binding is inconsistent.', 503);
      profile = { id, wallet: record.wallet, claimed, retired, level: Number(record.state.level),
        accountIdHash: record.accountIdHash, characterIdHash: record.characterIdHash, snapshotHash: record.snapshotHash,
        snapshot: record.state, garageCount: count };
      energy = { micros: e[0], capMicros: await read('engine', 'energyCap', [record.state.level], ctx.number),
        nextGtaAtMs: cooldown, jailUntilMs: jail };
      materials = { scrap: m[0], wire: m[1], steel: m[2], parts: m[3] };
      if (requestId !== 0n) {
        const [request, action] = await Promise.all([read('drand', 'requests', [requestId], ctx.number), read('engine', 'action', [requestId], ctx.number)]);
        if (!same(request[0], config.contracts.engine.address) || !same(action.profileId, id) || action.round !== request[1] || action.settled) {
          fail('native_pending_mismatch', 'Pending randomness binding is inconsistent.', 503);
        }
        pending = { requestId, round: request[1], fulfilled: request[2], readyAt: await read('drand', 'readyAt', [request[1]], ctx.number),
          requestedAtMs: action.requestedAtMs, chanceBps: action.chanceBps };
      }
    }
    const [balance, allowance, policySealed, operator, role, payerAllowed, houseAllowed] = await Promise.all([
      read('omr', 'balanceOf', [wallet], ctx.number), read('omr', 'allowance', [wallet, config.contracts.module.address], ctx.number),
      read('omr', 'policySealed', [], ctx.number), read('omr', 'isOperator', [config.contracts.module.address], ctx.number),
      read('omr', 'operatorRole', [config.contracts.module.address], ctx.number), read('omr', 'isRecipient', [wallet], ctx.number),
      read('omr', 'isRecipient', [config.house], ctx.number),
    ]);
    return { profile, energy, pending, materials, omr: { balance, allowance, hardeningCostWei: FEE,
      paymentReady: policySealed && operator && Number(role) === 2 && payerAllowed && houseAllowed && !same(wallet, config.house) } };
  }

  async function project(ctx, wallet, cursor) {
    const operation = index.lock.then(async () => {
      if (index.hash && (index.cursor > ctx.number || !same((await client.getBlock({ blockNumber: index.cursor })).hash, index.hash))) {
        index.cursor = BigInt(config.startBlock) - 1n; index.hash = null; index.owners.clear();
      }
      for (let i = 0; i < maxChunks && index.cursor < ctx.number; i++) {
        const fromBlock = index.cursor + 1n, toBlock = fromBlock + chunkSize - 1n > ctx.number ? ctx.number : fromBlock + chunkSize - 1n;
        const before = await client.getBlock({ blockNumber: toBlock });
        const logs = await client.getLogs({ address: [config.contracts.engine.address, config.contracts.module.address],
          event: TRANSFER, fromBlock, toBlock, strict: true });
        if (logs.length > maxLogs) fail('native_index_limit', 'Inventory range exceeds the bounded index capacity.', 503);
        const next = new Map(index.owners);
        logs.sort((a, b) => a.blockNumber === b.blockNumber ? Number(a.logIndex - b.logIndex) : a.blockNumber < b.blockNumber ? -1 : 1);
        for (const log of logs) {
          if (log.removed || log.blockNumber < fromBlock || log.blockNumber > toBlock
            || ![config.contracts.engine.address, config.contracts.module.address].some(a => same(a, log.address))) continue;
          const key = `${log.address.toLowerCase()}:${log.args.tokenId}`;
          if (same(log.args.to, ZERO)) next.delete(key); else next.set(key, log.args.to.toLowerCase());
          if (next.size > maxTokens) fail('native_index_limit', 'Inventory exceeds the bounded index capacity.', 503);
        }
        const end = await client.getBlock({ blockNumber: toBlock });
        if (!same(before.hash, end.hash)) {
          index.cursor = BigInt(config.startBlock) - 1n; index.hash = null; index.owners.clear();
          fail('native_index_reorg', 'Inventory changed branches while indexing. Retry the read.', 503);
        }
        index.owners = next; index.cursor = toBlock; index.hash = end.hash;
      }
      const owned = [...index.owners].filter(([, owner]) => same(owner, wallet)).map(([key]) => key);
      const ids = kind => owned.filter(key => key.startsWith(config.contracts[kind].address.toLowerCase() + ':'))
        .map(key => BigInt(key.split(':')[1])).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
      const cars = ids('engine'), tools = ids('module'), offset = Number(cursor);
      return { cars: cars.slice(offset, offset + 25), tools: tools.slice(offset, offset + 25),
        inventory: { cursor: cursor.toString(), nextCursor: cars.length > offset + 25 || tools.length > offset + 25 ? String(offset + 25) : null,
          hasNext: cars.length > offset + 25 || tools.length > offset + 25, limit: 25, carsTotal: String(cars.length), toolsTotal: String(tools.length) },
        indexing: { status: index.cursor < ctx.number ? 'syncing' : 'ready', cursorBlock: index.cursor,
          targetBlock: ctx.number, more: index.cursor < ctx.number } };
    });
    index.lock = operation.catch(() => {});
    return operation;
  }

  async function ownedCar(id, wallet, ctx) {
    if (!same(await ownerOf('engine', id, ctx), wallet)) fail('native_not_owner', 'The connected wallet does not own this car.');
    return read('engine', 'car', [id], ctx.number);
  }
  async function ownedTool(id, wallet, ctx) {
    if (!same(await ownerOf('module', id, ctx), wallet)) fail('native_not_owner', 'The connected wallet does not own this tool.');
    const [provenance, assignedProfile] = await Promise.all([read('module', 'provenance', [id], ctx.number), read('module', 'assignedProfile', [id], ctx.number)]);
    return { provenance, assignedProfile };
  }
  async function ownerOf(kind, id, ctx) {
    try { return await read(kind, 'ownerOf', [id], ctx.number); }
    catch (e) {
      let current = e;
      for (let i = 0; current && i < 6; i++, current = current.cause) {
        if (current.data?.errorName === 'ERC721NonexistentToken') return ZERO;
      }
      throw e;
    }
  }
  async function canonical(ctx) {
    if (!same((await client.getBlock({ blockNumber: ctx.number })).hash, ctx.block.hash)) {
      fail('native_read_reorg', 'The chain changed branches during this read. Retry the action.', 503);
    }
  }
  function available(s, nowMs) {
    const actions = [];
    if (s.profile && !s.profile.claimed && !s.profile.retired) actions.push('claim');
    if (s.pending?.fulfilled) actions.push('settleGta');
    else if (s.pending && BigInt(nowMs) >= s.pending.readyAt * 1000n) actions.push('fulfill');
    if (s.profile?.claimed && !s.profile.retired) {
      if (!s.pending && s.energy.micros >= 10000000n && BigInt(nowMs) >= s.energy.nextGtaAtMs
        && BigInt(nowMs) >= s.energy.jailUntilMs && s.profile.garageCount < 12n) actions.push('requestGta');
      actions.push('salvage', 'assign');
      if (s.materials.steel >= 1n && s.materials.parts >= 2n) actions.push('craft');
      if (s.omr.paymentReady && s.materials.scrap >= 4n && s.omr.balance >= FEE) actions.push(s.omr.allowance >= FEE ? 'harden' : 'approve');
    }
    return actions;
  }

  async function board({ wallet, cursor = '0' } = {}) {
    if (!config.configured) return publicConfig(config);
    wallet = address(wallet);
    const page = uint(cursor, 'Cursor', { zero: true, max: BigInt(maxTokens) });
    try {
      const ctx = await context(true), s = await walletState(wallet, ctx), projection = await project(ctx, wallet, page);
      const cars = (await Promise.all(projection.cars.map(async tokenId => {
        // Projection is a discovery aid; canonical owner/provenance reads determine displayed inventory.
        try { const car = await ownedCar(tokenId, wallet, ctx); return { tokenId, owner: wallet, ...car,
          modelName: await read('rules', 'modelId', [BigInt(car.modelIndex)], ctx.number),
          trim: String(car.trimIndex), rarity: String(car.rarityIndex) }; } catch (e) {
          if (e instanceof NativeGarageError && e.code === 'native_not_owner') return null;
          throw e;
        }
      }))).filter(Boolean);
      const tools = (await Promise.all(projection.tools.map(async tokenId => {
        try { return { tokenId, owner: wallet, ...await ownedTool(tokenId, wallet, ctx) }; }
        catch (e) { if (e instanceof NativeGarageError && e.code === 'native_not_owner') return null; throw e; }
      }))).filter(Boolean);
      const actions = available(s, Number(ctx.block.timestamp) * 1000);
      if (cars.length) actions.push('transferCar', 'abandonCar');
      if (tools.some(t => same(t.assignedProfile, ZERO_HASH))) actions.push('transferTool');
      if (tools.some(t => !same(t.assignedProfile, ZERO_HASH))) actions.push('unassign');
      await canonical(ctx);
      return json({ ...publicConfig(config), status: projection.indexing.status === 'ready' ? 'ready' : 'indexing', wallet,
        confirmedBlock: { number: ctx.number, hash: ctx.block.hash, timestamp: ctx.block.timestamp }, ...s, cars, tools,
        availableActions: [...new Set(actions)], indexing: projection.indexing, inventory: projection.inventory });
    } catch (e) { throw safeError(e); }
  }

  async function fetchProof(round) {
    for (const host of ['api.drand.sh', 'api2.drand.sh']) {
      try {
        const response = await fetchImpl(`https://${host}/${DRAND_CHAIN.slice(2)}/public/${round}`, { redirect: 'error', signal: AbortSignal.timeout(8000) });
        if (!response.ok || Number(response.headers?.get('content-length') || 0) > 4096) continue;
        const text = await response.text();
        if (text.length > 4096) continue;
        const body = JSON.parse(text);
        if (!Number.isSafeInteger(body.round) || BigInt(body.round) !== round || !/^(0x)?[0-9a-fA-F]{128}$/.test(body.signature || '')) continue;
        const signature = body.signature.replace(/^0x/, '').toLowerCase();
        if (body.randomness && (!/^[0-9a-fA-F]{64}$/.test(body.randomness)
          || crypto.createHash('sha256').update(Buffer.from(signature, 'hex')).digest('hex') !== body.randomness.toLowerCase())) continue;
        return `0x${signature}`;
      } catch { /* A second pinned public endpoint may have the published round. */ }
    }
    fail('native_proof_unavailable', 'The pinned drand round is not available or has an invalid proof.', 503);
  }

  async function prepare({ wallet, action, args = {} } = {}) {
    needConfigured(); wallet = address(wallet);
    const fields = { claim: [], requestGta: [], craft: [], fulfill: ['requestId'], settleGta: ['requestId'],
      salvage: ['tokenId'], abandonCar: ['tokenId'], assign: ['tokenId'], unassign: ['tokenId'],
      harden: ['batches'], approve: ['batches'], transferCar: ['tokenId', 'to'], transferTool: ['tokenId', 'to'] };
    if (!Object.hasOwn(fields, action)) fail('native_bad_action', 'Unsupported native garage action.');
    object(args, fields[action]);
    if (fields[action].some(k => !Object.hasOwn(args, k))) fail('native_bad_request', 'Required action fields are missing.');
    try {
      const ctx = await context(false), s = await walletState(wallet, ctx), profileId = s.profile?.id || null;
      const active = () => { if (!s.profile?.claimed || s.profile.retired) fail('native_inactive_profile', 'An active claimed profile is required.'); };
      let kind = 'engine', functionName = action, inputs = [], summary = '';
      if (action === 'claim') {
        if (!s.profile || s.profile.claimed || s.profile.retired) fail('native_claim_unavailable', 'This wallet has no unclaimed native profile.');
        inputs = [profileId]; summary = 'Claim the immutable native profile.';
      } else if (action === 'requestGta') {
        active(); if (!available(s, Number(ctx.block.timestamp) * 1000).includes(action)) fail('native_action_unavailable', 'GTA energy, cooldown, jail or garage capacity prevents this request.');
        inputs = [profileId]; summary = 'Lock 10 energy and a five-minute cooldown for one GTA attempt.';
      } else if (action === 'fulfill' || action === 'settleGta') {
        const requestId = uint(args.requestId, 'Request id');
        if (!s.pending || s.pending.requestId !== requestId) fail('native_unknown_request', 'This is not the profile’s pending request.');
        if (action === 'fulfill') {
          if (s.pending.fulfilled || ctx.block.timestamp < s.pending.readyAt) fail('native_randomness_pending', 'This drand round is not ready for fulfillment.');
          kind = 'drand'; inputs = [requestId, await fetchProof(s.pending.round)]; summary = `Verify the public drand proof for round ${s.pending.round}.`;
        } else {
          if (!s.pending.fulfilled) fail('native_randomness_pending', 'The drand proof must be fulfilled first.');
          inputs = [requestId]; summary = 'Settle the already locked GTA outcome.';
        }
      } else if (['salvage', 'abandonCar', 'transferCar'].includes(action)) {
        const tokenId = uint(args.tokenId, 'Car token id'), car = await ownedCar(tokenId, wallet, ctx);
        if (action === 'salvage') {
          active(); if (Number(car.modelIndex) !== 0) fail('native_not_junker', 'Only a junker can be salvaged.');
          kind = 'module'; inputs = [profileId, tokenId]; summary = `Permanently salvage car ${tokenId} for 6 scrap, 2 wire and 2 parts.`;
        } else if (action === 'abandonCar') { inputs = [tokenId]; summary = `Destroy car ${tokenId} without reward.`; }
        else {
          const to = address(args.to, 'Recipient');
          if (same(to, wallet)) fail('native_bad_recipient', 'Choose a different recipient wallet.');
          const receiver = await walletState(to, ctx);
          if (!receiver.profile?.claimed || receiver.profile.retired || receiver.profile.garageCount + (receiver.pending ? 1n : 0n) >= 12n) {
            fail('native_bad_recipient', 'Recipient needs an active claimed profile with a free garage slot.');
          }
          functionName = 'safeTransferFrom'; inputs = [wallet, to, tokenId]; summary = `Transfer car ${tokenId} to ${to}.`;
        }
      } else if (action === 'harden' || action === 'approve') {
        active(); const batches = uint(args.batches, 'Batches', { max: (1n << 128n) / 4n }), cost = batches * FEE;
        if (s.materials.scrap < batches * 4n) fail('native_materials', 'Hardening requires four scrap per batch.');
        if (!s.omr.paymentReady) fail('native_payment_closed', 'Restricted OMR policy is not ready for this payer and foundry.');
        if (s.omr.balance < cost) fail('native_balance', 'The wallet has insufficient OMR.');
        if (action === 'harden') {
          if (s.omr.allowance < cost) fail('native_allowance', 'Approve the exact hardening fee first.');
          kind = 'module'; inputs = [profileId, batches]; summary = `Consume ${batches * 4n} scrap and pay ${batches} × 0.6 OMR for steel.`;
        } else { kind = 'omr'; inputs = [config.contracts.module.address, cost]; summary = `Approve exactly ${cost} OMR base units for the foundry.`; }
      } else if (action === 'craft') {
        active(); if (s.materials.steel < 1n || s.materials.parts < 2n) fail('native_materials', 'Crafting requires one steel and two parts.');
        kind = 'module'; inputs = [profileId]; summary = 'Consume one steel and two parts to craft a unique precision lock tool.';
      } else {
        const tokenId = uint(args.tokenId, 'Tool token id'), tool = await ownedTool(tokenId, wallet, ctx);
        kind = 'module';
        if (action === 'unassign') {
          if (same(tool.assignedProfile, ZERO_HASH)) fail('native_tool_unassigned', 'This tool is already unassigned.');
          inputs = [tokenId]; summary = `Unassign tool ${tokenId}.`;
        } else {
          if (!same(tool.assignedProfile, ZERO_HASH)) fail('native_tool_assigned', 'Unassign this tool before assigning or transferring it.');
          if (action === 'assign') { active(); inputs = [tokenId, profileId]; summary = `Assign tool ${tokenId} to this native profile.`; }
          else { const to = address(args.to, 'Recipient'); functionName = 'safeTransferFrom'; inputs = [wallet, to, tokenId]; summary = `Transfer tool ${tokenId} to ${to}.`; }
        }
      }
      const target = config.contracts[kind].address;
      await client.simulateContract({ address: target, abi: NATIVE_GARAGE_ABI[kind], functionName, args: inputs, account: wallet,
        blockNumber: ctx.number });
      await canonical(ctx);
      return { chainId: config.chainId, from: wallet, to: target,
        data: encodeFunctionData({ abi: NATIVE_GARAGE_ABI[kind], functionName, args: inputs }), value: '0x0',
        action, manifestHash: config.manifestHash, deploymentHash: config.deploymentHash, profileId, summary,
        preparedBlock: { number: ctx.number.toString(), hash: ctx.block.hash }, validUntilMs: String(clock() + 300000) };
    } catch (e) { throw safeError(e); }
  }

  async function receipt(txHash, { wallet } = {}) {
    needConfigured(); txHash = hash(txHash, 'Transaction hash'); wallet = address(wallet);
    try {
      const ctx = await context(false);
      let tx = null, r = null;
      try { tx = await client.getTransaction({ hash: txHash }); }
      catch (e) { if (!['TransactionNotFoundError', 'TransactionReceiptNotFoundError'].includes(e.name)) throw e; }
      if (tx && (!same(tx.from, wallet) || !Object.values(config.contracts).some(v => same(v.address, tx.to)))) {
        fail('native_transaction_mismatch', 'Transaction does not belong to this wallet and deployment.');
      }
      try { r = await client.getTransactionReceipt({ hash: txHash }); }
      catch (e) { if (!['TransactionReceiptNotFoundError', 'TransactionNotFoundError'].includes(e.name)) throw e; }
      let confirmations = 0n, status = 'pending';
      if (r && r.blockNumber <= ctx.number && same((await client.getBlock({ blockNumber: r.blockNumber })).hash, r.blockHash)) {
        confirmations = ctx.number - r.blockNumber + 1n;
        status = confirmations < BigInt(config.confirmations) ? 'confirming' : r.status === 'success' ? 'confirmed' : 'reverted';
      }
      return json({ hash: txHash, status, confirmations, requiredConfirmations: config.confirmations,
        ...(r && confirmations ? { executionStatus: r.status, blockNumber: r.blockNumber, blockHash: r.blockHash } : {}),
        link: `${config.explorer}/tx/${txHash}`,
        transaction: tx ? { chainId: config.chainId, from: tx.from, to: tx.to, data: tx.input, value: toHex(tx.value) } : null });
    } catch (e) { throw safeError(e); }
  }
  return Object.freeze({ config: () => publicConfig(config), board, prepare, receipt });
}

let defaultService;
const serviceOf = options => options?.service || (options?.config || options?.publicClient
  ? createNativeGarageService(options) : defaultService ||= createNativeGarageService());
export const nativeGarageBoard = options => serviceOf(options).board(options);
export const prepareNativeGarageAction = options => serviceOf(options).prepare(options);
export const nativeGarageReceipt = (txHash, options) => serviceOf(options).receipt(txHash, options);

export function registerNativeGarageRoutes(app, { auth, service = serviceOf() } = {}) {
  const options = { preHandler: auth };
  function walletFor(explicit) {
    // Public chain reads use the chosen wallet; legacy SQL never selects an onchain identity.
    if (explicit == null) fail('native_wallet_required', 'Connect a wallet to read native garage state.');
    return address(explicit);
  }
  const handle = fn => async (req, reply) => {
    try { return await fn(req); } catch (e) { const safe = safeError(e); return reply.code(safe.statusCode).send({ error: safe.code, message: safe.message }); }
  };
  app.get('/v1/native-garage/config', options, handle(async () => service.config()));
  app.get('/v1/native-garage', options, handle(async req => {
    object({ ...req.query }, ['wallet', 'cursor']);
    if (!service.config().configured) return service.board({});
    return service.board({ wallet: walletFor(req.query.wallet), cursor: req.query.cursor ?? '0' });
  }));
  app.post('/v1/native-garage/prepare', options, handle(async req => {
    object(req.body, ['wallet', 'action', 'args']);
    if (!service.config().configured) fail('native_unconfigured', 'Native garage is unavailable.', 503);
    return service.prepare({ wallet: walletFor(req.body.wallet), action: req.body.action, args: req.body.args ?? {} });
  }));
  app.get('/v1/native-garage/receipt/:hash', options, handle(async req => {
    object({ ...req.query }, ['wallet']);
    if (!service.config().configured) fail('native_unconfigured', 'Native garage is unavailable.', 503);
    return service.receipt(req.params.hash, { wallet: walletFor(req.query.wallet) });
  }));
}
