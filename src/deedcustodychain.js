// Typed custody adapter. Game deaths are an ordered outbox; physical custody is
// projected only from confirmed logs. All oracle transactions share one durable
// keeper nonce journal, including exits, so a later death cannot overtake an exit.
import { createPublicClient, createWalletClient, http, parseAbi, encodeFunctionData,
  getAddress, isAddress, keccak256, zeroHash, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { GameError } from './game.js';
import { ensureCharacterDeedLife, bindCharacterDeedAccount, recordCharacterDeedEquipment,
  listCharacterDeedOutbox, confirmCharacterDeedDeath, characterDeedStatus,
  backfillCharacterDeedEstates, requestCharacterDeedSafeHouse, recordCharacterDeedSafeHouse, characterDeedExitJobKey } from './deedcustody.js';
import { getCursor } from './watcher.js';
import { runKeeperTransaction, reconcileKeeperTransactions } from './keepertransactions.js';

export const DEED_CUSTODY_ABI = parseAbi([
  'function deed() view returns (address)',
  'function dynasty() view returns (address)',
  'function omr() view returns (address)',
  'function volumeSource() view returns (address)',
  'function volumeSourceRuntimeHash() view returns (bytes32)',
  'function lifecycleOperator() view returns (address)',
  'function accountImplementation() view returns (address)',
  'function accountRegistry() view returns (address)',
  'function accountOf(bytes32) view returns (address)',
  'function lifeState(bytes32) view returns ((address account,address wallet,uint256 dynastyId,bool dead,bytes32 killer,uint256 deathSequence,uint256 deathAt,bytes32 heir,bool estateDeath))',
  'function equippedLife(uint256) view returns (bytes32)',
  'function exitNonce(bytes32) view returns (uint256)',
  'function activeLifeByDynasty(uint256) view returns (bytes32)',
  'function deedVault(uint256) view returns (address)',
  'function registerPendingLife(bytes32)',
  'function bindLife(bytes32,uint256)',
  'function recordDeath(bytes32,bytes32,bytes32,uint256,uint256)',
  'function recordEstateDeath(bytes32,bytes32,uint256,uint256)',
  'function safeHouseQuote() view returns (uint256 priceDay,uint256 previousDayVolume,uint256 dailyBurn)',
  'function safeHouseNonce(bytes32) view returns (uint256)',
  'function safeHouseUntil(uint256,uint256) view returns (uint256)',
  'function safeHouseCoveredAt(uint256,uint256,uint256) view returns (bool)',
  'function prepaySafeHouse((bytes32 lifeId,uint256 deedId,uint256 days_,uint256 priceDay,uint256 maxBurn,uint256 nonce,uint256 issuedAt,uint256 deadline),bytes)',
  'function estateReleaseAt(bytes32) view returns (uint256)',
  'function ESTATE_DELAY() view returns (uint256)',
  'function settleDeed(uint256,uint256)',
  'function equip(bytes32,uint256)',
  'function unequip((bytes32 lifeId,uint256 deedId,uint256 nonce,uint256 issuedAt,uint256 deadline),bytes)',
  'event LifeRegistered(bytes32 indexed lifeId,address indexed account,address indexed wallet,uint256 dynastyId)',
  'event LifeBound(bytes32 indexed lifeId,address indexed wallet,uint256 indexed dynastyId)',
  'event DeathRecorded(bytes32 indexed victimLifeId,bytes32 indexed killerLifeId,uint256 indexed deathSequence,bytes32 heirLifeId,uint256 deathAt)',
  'event EstateDeathRecorded(bytes32 indexed victimLifeId,bytes32 indexed heirLifeId,uint256 indexed deathSequence,uint256 releaseAt)',
  'event DeedEquipped(uint256 indexed deedId,bytes32 indexed lifeId,address indexed wallet,address vault)',
  'event DeedSettled(uint256 indexed deedId,bytes32 indexed fromLifeId,bytes32 indexed toLifeId,uint256 hops)',
  'event DeedUnequipped(uint256 indexed deedId,bytes32 indexed lifeId,address indexed wallet,uint256 nonce)',
  'event SafeHousePurchased(uint256 indexed deedId,bytes32 indexed lifeId,uint256 indexed dynastyId,uint256 priceDay,uint256 previousDayVolume,uint256 burnAmount,uint256 startsAt,uint256 until,uint256 nonce)',
]);
const lower = x => String(x || '').toLowerCase();
const ZERO = '0x0000000000000000000000000000000000000000';
const fail = message => { throw new GameError('custody_unconfigured', message); };
const positive = (value, name) => {
  if (!/^[1-9][0-9]*$/.test(String(value || ''))) fail(`${name} must be configured as a positive integer.`);
  return BigInt(value);
};

export function characterDeedChainConfig(env = process.env) {
  if (env.CHARACTER_DEED_CUSTODY_ENABLED !== 'true') return null;
  for (const key of ['CHARACTER_DEED_CUSTODY_ADDRESS', 'STREET_DEED_ADDRESS', 'DYNASTY_NFT_ADDRESS', 'ERC6551_ACCOUNT_IMPL', 'OMR_ADDRESS'])
    if (!isAddress(env[key] || '') || lower(env[key]) === ZERO) fail(`${key} must be configured.`);
  if (!env.CHAIN_RPC_URL) fail('The custody RPC must be configured.');
  if (!/^0x[0-9a-f]{64}$/i.test(env.CHARACTER_DEED_CUSTODY_CODE_HASH || '')) fail('Pin the custody runtime code hash.');
  if (!/^[0-9]+$/.test(String(env.CHARACTER_DEED_CUSTODY_START_BLOCK ?? ''))) fail('Pin the custody deployment block.');
  const chainId = Number(positive(env.CHAIN_ID, 'CHAIN_ID'));
  const confirmations = Number(positive(env.CHAIN_CONFIRMATIONS || 5, 'CHAIN_CONFIRMATIONS'));
  if (!Number.isSafeInteger(chainId) || !Number.isSafeInteger(confirmations)) fail('Invalid custody chain policy.');
  return { address: getAddress(env.CHARACTER_DEED_CUSTODY_ADDRESS),
    deed: getAddress(env.STREET_DEED_ADDRESS), dynasty: getAddress(env.DYNASTY_NFT_ADDRESS), omr: getAddress(env.OMR_ADDRESS),
    implementation: getAddress(env.ERC6551_ACCOUNT_IMPL), rpc: env.CHAIN_RPC_URL, chainId,
    codeHash: lower(env.CHARACTER_DEED_CUSTODY_CODE_HASH), confirmations,
    startBlock: BigInt(env.CHARACTER_DEED_CUSTODY_START_BLOCK) };
}

function clientsFor(config, signing = false) {
  const publicClient = createPublicClient({ transport: http(config.rpc) });
  if (!signing) return { publicClient };
  const key = process.env.CHARACTER_DEED_OPERATOR_PK;
  if (!/^0x[0-9a-f]{64}$/i.test(key || '')) fail('A dedicated custody operator key is required.');
  const account = privateKeyToAccount(key);
  return { publicClient, account, walletClient: createWalletClient({ account, transport: http(config.rpc) }) };
}

export async function verifyCharacterDeedDeployment(config, publicClient, operator = null) {
  if (Number(await publicClient.getChainId()) !== config.chainId) fail('The custody RPC is on another chain.');
  const code = await publicClient.getCode({ address: config.address });
  if (!code || lower(keccak256(code)) !== config.codeHash) fail('The custody runtime differs from its pinned code.');
  const read = name => publicClient.readContract({ address: config.address, abi: DEED_CUSTODY_ABI, functionName: name });
  const [deed, dynasty, implementation, actualOperator, registry, estateDelay, omr, volumeSource, volumeHash] = await Promise.all([
    read('deed'), read('dynasty'), read('accountImplementation'), read('lifecycleOperator'), read('accountRegistry'), read('ESTATE_DELAY'),
    read('omr'), read('volumeSource'), read('volumeSourceRuntimeHash'),
  ]);
  if (lower(deed) !== lower(config.deed) || lower(dynasty) !== lower(config.dynasty)
    || lower(implementation) !== lower(config.implementation) || lower(omr) !== lower(config.omr)) fail('The configured deed, identity, OMR or constrained stock vault does not match custody.');
  const manager = await publicClient.readContract({ address: config.omr,
    abi: parseAbi(['function settlementManager() view returns (address)']), functionName: 'settlementManager' });
  const managerCode = await publicClient.getCode({ address: volumeSource });
  if (lower(manager) !== lower(volumeSource) || !managerCode || lower(keccak256(managerCode)) !== lower(volumeHash))
    fail('The canonical OMR volume source differs from its pinned deployment.');
  if (process.env.ERC6551_REGISTRY && lower(process.env.ERC6551_REGISTRY) !== lower(registry)
    || process.env.ERC6551_SALT && lower(process.env.ERC6551_SALT) !== zeroHash)
    fail('Custody uses its immutable registry and zero salt; the delivery configuration differs.');
  if (estateDelay !== 86400n) fail('The custody deployment must enforce the 24-hour estate policy.');
  if (operator && lower(operator) !== lower(actualOperator)) fail('The keeper is not the custody lifecycle operator.');
}

export async function resolveConstrainedDeedVault(tokenId) {
  const config = characterDeedChainConfig();
  if (!config) return null;
  const { publicClient } = clientsFor(config);
  await verifyCharacterDeedDeployment(config, publicClient);
  return publicClient.readContract({ address: config.address, abi: DEED_CUSTODY_ABI,
    functionName: 'deedVault', args: [BigInt(tokenId)] });
}

export async function prepareCharacterDeedEquipment(pool, accountId, tokenId) {
  const config = characterDeedChainConfig();
  if (!config) fail('Character deed equipment is not enabled.');
  if (!/^[0-9]+$/.test(String(tokenId))) throw new GameError('custody_args', 'A deed token ID is required.');
  const client = await pool.connect();
  let life;
  try {
    await client.query('BEGIN');
    const ch = (await client.query('SELECT id FROM characters WHERE account_id=$1 AND alive FOR UPDATE', [accountId])).rows[0];
    if (!ch) throw new GameError('no_character', 'Create a living character first.');
    life = await ensureCharacterDeedLife(client, ch.id);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
  const identity = (await pool.query('SELECT token_id FROM dynasty_tokens WHERE account_id=$1', [accountId])).rows[0];
  if (!identity) return { ready: false, lifeHash: life.life_hash, reason: 'identity_required' };
  const { publicClient } = clientsFor(config);
  await verifyCharacterDeedDeployment(config, publicClient);
  const state = await publicClient.readContract({ address: config.address, abi: DEED_CUSTODY_ABI,
    functionName: 'lifeState', args: [life.life_hash] });
  if (lower(state.account) === ZERO || !life.custody_address || lower(state.wallet) === ZERO)
    return { ready: false, lifeHash: life.life_hash, reason: 'identity_registration_pending' };
  if (state.dead) throw new GameError('custody_dead', 'This character life is closed.');
  return { ready: true, lifeHash: life.life_hash, account: state.account, chainId: config.chainId,
    contract: config.address, deedContract: config.deed, custodyAddress: config.address, deedAddress: config.deed,
    omrAddress: config.omr, tokenId: String(tokenId),
    ownerWallet: state.wallet,
    steps: [
      { to: config.deed, value: '0x0', data: encodeFunctionData({ abi: parseAbi(['function setTransferLock(uint256,bool)']),
        functionName: 'setTransferLock', args: [BigInt(tokenId), false] }) },
      { to: config.deed, value: '0x0', data: encodeFunctionData({ abi: parseAbi(['function approve(address,uint256)']),
        functionName: 'approve', args: [config.address, BigInt(tokenId)] }) },
      { to: config.address, value: '0x0', data: encodeFunctionData({ abi: DEED_CUSTODY_ABI,
        functionName: 'equip', args: [life.life_hash, BigInt(tokenId)] }) },
    ],
    functionName: 'equip', args: [life.life_hash, String(tokenId)],
    data: encodeFunctionData({ abi: DEED_CUSTODY_ABI, functionName: 'equip', args: [life.life_hash, BigInt(tokenId)] }),
    note: 'Unlock and approve this deed, then submit equip from the identity wallet. Equipped deeds and their canonical stock vaults are at risk on death.' };
}

export async function characterDeedExitIntent(pool, accountId, tokenId) {
  const config = characterDeedChainConfig();
  if (!config) fail('Character deed equipment is not enabled.');
  const status = await characterDeedStatus(pool, accountId);
  const exit = status.exits.find(row => row.deed_token_id === String(tokenId) && row.status === 'pending');
  if (!exit || new Date(exit.available_at).getTime() > Date.now())
    throw new GameError('custody_notice', 'Start and complete the exit notice before signing consent.');
  const { publicClient } = clientsFor(config);
  await verifyCharacterDeedDeployment(config, publicClient);
  const nonce = await publicClient.readContract({ address: config.address, abi: DEED_CUSTODY_ABI,
    functionName: 'exitNonce', args: [status.life.life_hash] });
  const issuedAt = BigInt(Math.floor(Date.now() / 1000));
  return { ownerWallet: status.life.wallet || (await publicClient.readContract({ address: config.address, abi: DEED_CUSTODY_ABI,
    functionName: 'lifeState', args: [status.life.life_hash] })).wallet,
    chainId: config.chainId, custodyAddress: config.address,
    domain: { name: 'OmertaDeedCustody', version: '1', chainId: config.chainId, verifyingContract: config.address },
    primaryType: 'ExitRequest', types: { EIP712Domain: [
      { name: 'name', type: 'string' }, { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' }, { name: 'verifyingContract', type: 'address' },
    ], ExitRequest: [
      { name: 'lifeId', type: 'bytes32' }, { name: 'deedId', type: 'uint256' },
      { name: 'nonce', type: 'uint256' }, { name: 'issuedAt', type: 'uint256' }, { name: 'deadline', type: 'uint256' },
    ] }, message: { lifeId: status.life.life_hash, deedId: String(tokenId), nonce: String(nonce),
      issuedAt: String(issuedAt), deadline: String(issuedAt + 300n) } };
}

export const SAFE_HOUSE_TYPES = { SafeHouseRequest: [
  { name: 'lifeId', type: 'bytes32' }, { name: 'deedId', type: 'uint256' }, { name: 'days_', type: 'uint256' },
  { name: 'priceDay', type: 'uint256' }, { name: 'maxBurn', type: 'uint256' },
  { name: 'nonce', type: 'uint256' }, { name: 'issuedAt', type: 'uint256' }, { name: 'deadline', type: 'uint256' },
] };

export async function characterDeedSafeHouseIntent(pool, accountId, tokenId, days = 1,
  { config = characterDeedChainConfig(), publicClient } = {}) {
  if (!config) fail('Character deed custody is not enabled.');
  if (!/^[0-9]+$/.test(String(tokenId)) || !Number.isSafeInteger(Number(days)) || Number(days) < 1 || Number(days) > 7)
    throw new GameError('custody_args', 'Choose a deed and between one and seven full days.');
  const status = await characterDeedStatus(pool, accountId);
  if (!status.life || !status.equipment.some(row => row.deed_token_id === String(tokenId)))
    throw new GameError('custody_equipment', 'Equip this deed on your living character first.');
  const pub = publicClient || clientsFor(config).publicClient;
  await verifyCharacterDeedDeployment(config, pub);
  const read = (functionName, args = []) => pub.readContract({ address: config.address, abi: DEED_CUSTODY_ABI, functionName, args });
  const [state, quote, nonce] = await Promise.all([read('lifeState', [status.life.life_hash]), read('safeHouseQuote'), read('safeHouseNonce', [status.life.life_hash])]);
  if (state.dead || lower(state.wallet) === ZERO || String(state.dynastyId) !== String(status.life.dynasty_token_id))
    throw new GameError('custody_binding', 'Wait for your living identity registration to be confirmed.');
  const [priceDay, previousDayVolume, dailyBurn] = Array.isArray(quote) ? quote : [quote.priceDay, quote.previousDayVolume, quote.dailyBurn];
  const until = BigInt(await read('safeHouseUntil', [BigInt(tokenId), BigInt(state.dynastyId)]));
  const now = BigInt(Math.floor(Date.now() / 1000)), total = BigInt(dailyBurn) * BigInt(days);
  if (BigInt(priceDay) !== now / 86400n || BigInt(dailyBurn) < 10n ** 18n || BigInt(dailyBurn) > 25n * 10n ** 18n)
    throw new GameError('custody_quote', 'A current canonical daily volume quote is required.');
  if ((until > now ? until : now) + BigInt(days) * 86400n > now + 7n * 86400n)
    throw new GameError('custody_horizon', 'Protection can extend at most seven days into the future.');
  const typedData = { domain: { name: 'OmertaDeedCustody', version: '1', chainId: config.chainId, verifyingContract: config.address },
    primaryType: 'SafeHouseRequest', types: SAFE_HOUSE_TYPES, message: { lifeId: status.life.life_hash, deedId: String(tokenId), days_: String(days),
      priceDay: String(priceDay), maxBurn: String(total), nonce: String(nonce), issuedAt: String(now), deadline: String(now + 300n) } };
  return { ready: true, chainId: config.chainId, ownerWallet: state.wallet, custodyAddress: config.address,
    deedAddress: config.deed, omrAddress: config.omr, tokenId: String(tokenId), lifeHash: status.life.life_hash,
    days: Number(days), priceDay: String(priceDay), previousDayVolumeAtomic: String(previousDayVolume),
    dailyBurnAtomic: String(dailyBurn), dailyBurnOmr: formatEther(BigInt(dailyBurn)), maxBurnAtomic: String(total),
    costOmr: formatEther(total), protects: 'deed_and_all_assets', typedData,
    steps: [{ kind: 'approve', to: config.omr, value: '0', data: encodeFunctionData({ abi: parseAbi(['function approve(address,uint256) returns (bool)']),
      functionName: 'approve', args: [config.address, total] }) }] };
}

export async function submitCharacterDeedSafeHouse(pool, accountId, args,
  { config = characterDeedChainConfig(), publicClient } = {}) {
  const plan = await characterDeedSafeHouseIntent(pool, accountId, args.tokenId, args.days, { config, publicClient });
  if (String(args.priceDay) !== plan.priceDay || String(args.maxBurn) !== plan.maxBurnAtomic
    || String(args.userNonce) !== plan.typedData.message.nonce)
    throw new GameError('custody_quote', 'The quote or nonce changed. Review and sign a fresh request.');
  const typedData = { ...plan.typedData, message: { ...plan.typedData.message,
    issuedAt: String(args.userIssuedAt), deadline: String(args.userDeadline) } };
  let valid;
  try { valid = await (publicClient || clientsFor(config).publicClient).verifyTypedData({ ...typedData, address: plan.ownerWallet, signature: args.userSignature }); }
  catch { throw new GameError('custody_consent', 'Invalid Safe House signature.'); }
  if (!valid) throw new GameError('custody_consent', 'The identity wallet must sign this Safe House request.');
  return requestCharacterDeedSafeHouse(pool, accountId, { ...args, lifeHash: plan.lifeHash });
}

// Events are processed in block/log order across ALL lifecycle event types.
// Registration before equipment is essential when both happen in one block.
export async function syncCharacterDeedEvents(pool, { config = characterDeedChainConfig(), publicClient } = {}) {
  if (!config) return { processed: 0, dormant: true };
  const pub = publicClient || clientsFor(config).publicClient;
  await verifyCharacterDeedDeployment(config, pub);
  const stream = `character_deed:${config.chainId}:${lower(config.address)}`;
  const head = BigInt(await pub.getBlockNumber()) - BigInt(config.confirmations);
  const cursor = BigInt(await getCursor(pool, stream, Number(config.startBlock > 0n ? config.startBlock - 1n : 0n)));
  if (head <= cursor) return { processed: 0 };
  const to = head < cursor + 2000n ? head : cursor + 2000n;
  const [custodyLogs, transferLogs] = await Promise.all([
    pub.getLogs({ address: config.address, events: DEED_CUSTODY_ABI.filter(x => x.type === 'event'),
      fromBlock: cursor + 1n, toBlock: to, strict: true }),
    pub.getLogs({ address: config.deed, events: parseAbi(['event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)']),
      fromBlock: cursor + 1n, toBlock: to, strict: true }),
  ]);
  const logs = [...custodyLogs, ...transferLogs];
  logs.sort((a, b) => Number(a.blockNumber - b.blockNumber) || Number(a.logIndex) - Number(b.logIndex));
  // Validate each complete death transaction before acknowledging any part of
  // the batch. A conflicting/missing estate event must not leave its generic
  // death acknowledged while the cursor correctly refuses the bad batch.
  const deathGroups = new Map();
  for (const log of logs) {
    if (!['DeathRecorded', 'EstateDeathRecorded'].includes(log.eventName)) continue;
    const key = `${log.transactionHash}:${lower(log.args.victimLifeId)}`;
    if (!deathGroups.has(key)) deathGroups.set(key, []);
    deathGroups.get(key).push(log);
  }
  for (const group of deathGroups.values()) {
    const life = (await pool.query(
      'SELECT death_sequence,killer_life_id,successor_life_id,heir_life_id,death_at,closure_reason FROM character_deed_lives WHERE life_hash=$1',
      [lower(group[0].args.victimLifeId)])).rows[0];
    if (!life?.death_sequence) throw new Error('Custody death has no authoritative game outbox.');
    const estate = life.closure_reason === 'estate_inheritance';
    const generic = group.filter(log => log.eventName === 'DeathRecorded');
    const inheritance = group.filter(log => log.eventName === 'EstateDeathRecorded');
    if (generic.length !== 1 || inheritance.length !== (estate ? 1 : 0))
      throw new Error('Custody death event pair differs from its authorized disposition.');
    const successorId = life.successor_life_id || life.killer_life_id;
    const successor = successorId ? (await pool.query('SELECT life_hash FROM character_deed_lives WHERE life_id=$1', [successorId])).rows[0]?.life_hash : zeroHash;
    const heir = (await pool.query('SELECT life_hash FROM character_deed_lives WHERE life_id=$1', [life.heir_life_id])).rows[0]?.life_hash;
    if (lower(generic[0].args.killerLifeId) !== lower(successor) || lower(generic[0].args.heirLifeId) !== lower(heir)
      || String(generic[0].args.deathAt) !== String(life.death_at)
      || String(generic[0].args.deathSequence) !== String(life.death_sequence))
      throw new Error('Custody death recipient, heir, timestamp or sequence differs from the authoritative game outbox.');
    if (estate && (lower(inheritance[0].args.heirLifeId) !== lower(heir)
      || String(inheritance[0].args.deathSequence) !== String(life.death_sequence)))
      throw new Error('Custody estate event differs from its authoritative game outbox.');
    if (estate && BigInt(inheritance[0].args.releaseAt ?? 0) !== BigInt(life.death_at) + 86400n)
      throw new Error('Custody estate event differs from its authoritative release time.');
  }
  const blocks = new Map();
  for (const log of logs) {
    const args = log.args, ref = `${log.transactionHash}:${log.logIndex}`;
    const proof = { ref, txHash: log.transactionHash, finalized: true };
    if (log.eventName === 'LifeRegistered' || log.eventName === 'LifeBound') {
      // LifeBound omits account; its deterministic address was registered first.
      const life = (await pool.query('SELECT custody_address FROM character_deed_lives WHERE life_hash=$1', [lower(args.lifeId)])).rows[0];
      await bindCharacterDeedAccount(pool, { ...proof, lifeHash: args.lifeId,
        address: args.account || life?.custody_address, dynastyTokenId: log.eventName === 'LifeRegistered' ? null : String(args.dynastyId) });
    } else if (log.eventName === 'SafeHousePurchased') {
      await recordCharacterDeedSafeHouse(pool, { ...proof, tokenId: args.deedId, dynastyTokenId: args.dynastyId,
        lifeHash: args.lifeId, startsAt: args.startsAt, until: args.until, nonce: args.nonce, priceDay: args.priceDay,
        previousDayVolume: args.previousDayVolume, burnAmount: args.burnAmount,
        blockNumber: log.blockNumber, logIndex: log.logIndex });
    } else if (log.eventName === 'DeathRecorded' || log.eventName === 'EstateDeathRecorded') {
      const life = (await pool.query('SELECT death_sequence,killer_life_id,successor_life_id,closure_reason FROM character_deed_lives WHERE life_hash=$1', [lower(args.victimLifeId)])).rows[0];
      if (!life?.death_sequence) throw new Error('Custody death has no authoritative game outbox.');
      const estate = life.closure_reason === 'estate_inheritance';
      if (log.eventName === 'EstateDeathRecorded' && !estate) throw new Error('An estate event cannot replace a player-kill disposition.');
      const successorId = life.successor_life_id || life.killer_life_id;
      const successor = successorId ? (await pool.query('SELECT life_hash FROM character_deed_lives WHERE life_id=$1', [successorId])).rows[0]?.life_hash : zeroHash;
      if (lower(successor) !== lower(log.eventName === 'EstateDeathRecorded' ? args.heirLifeId : args.killerLifeId)) throw new Error('Custody death recipient differs from the game outbox.');
      // EstateDeathRecorded supplies the canonical timelock. Its accompanying
      // generic DeathRecorded edge alone must never imply an unlocked estate.
      if (estate && log.eventName === 'DeathRecorded') continue;
      await confirmCharacterDeedDeath(pool, { ...proof, lifeHash: args.victimLifeId,
        deathSequence: String(life.death_sequence), chainDeathSequence: String(args.deathSequence),
        chainReleaseAt: estate ? String(args.releaseAt) : String(BigInt(args.deathAt) + 86400n) });
    } else {
      // ERC721 Transfer is the sole ownership authority. Custody's later event
      // must not erase a transfer performed by a smart-wallet receiver callback.
      let lifeHash;
      const tokenId = args.deedId ?? args.tokenId;
      if (log.eventName === 'Transfer') {
        const life = (await pool.query('SELECT life_hash FROM character_deed_lives WHERE custody_address=$1', [lower(args.to)])).rows[0];
        const prior = (await pool.query('SELECT life_hash FROM character_deed_equipment WHERE deed_token_id=$1 AND active=true', [String(tokenId)])).rows[0];
        if (!life && !prior) continue;
        lifeHash = life?.life_hash || null;
      }
      if (log.eventName === 'Transfer') {
        if (!blocks.has(String(log.blockNumber))) blocks.set(String(log.blockNumber), await pub.getBlock({ blockNumber: log.blockNumber }));
        await recordCharacterDeedEquipment(pool, { ...proof, tokenId: String(tokenId), lifeHash,
          blockNumber: String(log.blockNumber), logIndex: log.logIndex,
          blockTimestamp: String(blocks.get(String(log.blockNumber)).timestamp) });
      }
      if (log.eventName === 'DeedUnequipped') await pool.query(
        "UPDATE character_deed_exits SET status='confirmed' WHERE life_id=(SELECT life_id FROM character_deed_lives WHERE life_hash=$1) AND deed_token_id=$2 AND status IN ('pending','releasing')",
        [lower(args.lifeId), String(args.deedId)]);
    }
  }
  await pool.query('UPDATE chain_cursor SET last_block=$2 WHERE stream=$1', [stream, String(to)]);
  return { processed: logs.length, from: String(cursor + 1n), to: String(to) };
}

function transportOptions(config, clients) {
  return { chainId: config.chainId, wallet: clients.account.address, clients,
    target: config.address, targetCodeHash: config.codeHash,
    allowedTargets: { [lower(config.address)]: config.codeHash }, confirmations: config.confirmations,
    maxGas: positive(process.env.CHARACTER_DEED_MAX_GAS, 'CHARACTER_DEED_MAX_GAS'),
    maxFeePerGas: positive(process.env.CHARACTER_DEED_MAX_FEE_WEI, 'CHARACTER_DEED_MAX_FEE_WEI'),
    maxPriorityFeePerGas: positive(process.env.CHARACTER_DEED_PRIORITY_FEE_WEI, 'CHARACTER_DEED_PRIORITY_FEE_WEI'),
    gasBudget: { key: 'character-deed-gas', period: new Date().toISOString().slice(0, 10),
      limit: positive(process.env.CHARACTER_DEED_DAILY_GAS_WEI, 'CHARACTER_DEED_DAILY_GAS_WEI') } };
}

export async function recoverFailedCharacterDeedExits(pool) {
  const rows = (await pool.query(
    `SELECT e.life_id,e.deed_token_id,e.tx_hash FROM character_deed_exits e
     JOIN keeper_transactions k ON k.tx_hash=e.tx_hash
     WHERE e.status='releasing' AND k.status='reverted'`)).rows;
  for (const row of rows) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const ch = (await client.query('SELECT alive FROM characters WHERE id=$1 FOR UPDATE', [row.life_id])).rows[0];
      // Keep the completed notice, but require a new owner intent. A failed
      // transaction never counts as an asset release or erases a death right.
      await client.query(
        `UPDATE character_deed_exits SET status=$4,user_signature=NULL,user_nonce=NULL,
         user_issued_at=NULL,user_deadline=NULL,tx_hash=NULL
         WHERE life_id=$1 AND deed_token_id=$2 AND status='releasing' AND tx_hash=$3`,
        [row.life_id, row.deed_token_id, row.tx_hash, ch?.alive ? 'pending' : 'cancelled']);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  return rows.length;
}

function isContractRevert(error) {
  for (let cause = error; cause; cause = cause.cause)
    if (cause.name === 'ContractFunctionRevertedError') return true;
  return false;
}

// At most one command per tick. Missing/reverted commands hold the ordered queue;
// an RPC error never silently acknowledges a death or releases an equipment lock.
export async function runCharacterDeedKeeper(pool, { config = characterDeedChainConfig(), clients } = {}) {
  if (!config || !process.env.CHARACTER_DEED_OPERATOR_PK && !clients) return { dormant: true };
  const use = clients || clientsFor(config, true), pub = use.publicClient;
  await verifyCharacterDeedDeployment(config, pub, use.account.address);
  const options = transportOptions(config, use);
  const resumed = await reconcileKeeperTransactions(pool, options);
  await recoverFailedCharacterDeedExits(pool);
  await pool.query(`UPDATE character_deed_safe_house_intents SET status='cancelled'
    WHERE status='releasing' AND tx_hash IN (SELECT tx_hash FROM keeper_transactions WHERE status='reverted')`);
  if (resumed.state !== 'idle' && resumed.state !== 'settled') return resumed;
  await backfillCharacterDeedEstates(pool);
  const readLife = lifeHash => pub.readContract({ address: config.address, abi: DEED_CUSTODY_ABI,
    functionName: 'lifeState', args: [lifeHash] });
  const send = (jobKey, functionName, args) => runKeeperTransaction(pool, { ...options, jobKey,
    request: { data: encodeFunctionData({ abi: DEED_CUSTODY_ABI, functionName, args }), value: '0' },
    metadata: { kind: 'character_deed', functionName } });
  const ensure = async lifeHash => {
    const state = await readLife(lifeHash);
    if (lower(state.account) === ZERO) return send(`deed-life:${lifeHash}`, 'registerPendingLife', [lifeHash]);
    return null;
  };
  const pending = await listCharacterDeedOutbox(pool, { limit: 1 });
  if (pending.length) {
    const row = pending[0];
    const successor = row.successorLifeHash || row.killerLifeHash;
    if (!successor) return { state: 'estate_heir_missing', lifeHash: row.lifeHash };
    for (const lifeHash of [...new Set([row.lifeHash, successor, row.heirLifeHash])]) {
      if (!lifeHash) return { state: 'estate_heir_missing', lifeHash: row.lifeHash };
      const sent = await ensure(lifeHash); if (sent) return sent;
    }
    const state = await readLife(row.lifeHash);
    if (state.dead) return { state: 'awaiting_indexer', lifeHash: row.lifeHash };
    return send(`deed-death:${row.lifeHash}`, row.disposition === 'estate_inheritance' ? 'recordEstateDeath' : 'recordDeath',
      row.disposition === 'estate_inheritance'
        ? [row.lifeHash, successor, BigInt(row.deathSequence), BigInt(row.deathAt)]
        : [row.lifeHash, successor, row.heirLifeHash, BigInt(row.deathSequence), BigInt(row.deathAt)]);
  }
  // A claimed identity binds to its exact life. Unminted killers can still receive
  // locked loot in pending accounts, and can themselves die before claiming.
  const lives = (await pool.query(
    `SELECT l.*,d.token_id AS identity_token_id FROM character_deed_lives l
     JOIN dynasty_tokens d ON d.account_id=l.account_id
     LEFT JOIN character_deed_lives held ON held.dynasty_token_id=d.token_id
       AND held.status='dead' AND held.closure_reason='estate_escrow'
     WHERE l.status='alive' AND l.dynasty_token_id IS NULL AND held.life_id IS NULL
     ORDER BY l.created_at LIMIT 100`)).rows;
  for (const life of lives) {
    const sent = await ensure(life.life_hash); if (sent) return sent;
    const state = await readLife(life.life_hash);
    if (lower(state.wallet) === ZERO) {
      const activeLife = await pub.readContract({ address: config.address, abi: DEED_CUSTODY_ABI,
        functionName: 'activeLifeByDynasty', args: [BigInt(life.identity_token_id)] });
      if (activeLife !== zeroHash && activeLife !== life.life_hash) continue;
      return send(`deed-bind:${life.life_hash}`, 'bindLife', [life.life_hash, BigInt(life.identity_token_id)]);
    }
  }
  const equipped = (await pool.query('SELECT deed_token_id,life_hash FROM character_deed_equipment WHERE active=true')).rows;
  let settlementTime;
  for (const row of equipped) {
    const state = await readLife(row.life_hash);
    if (state.dead && state.killer !== zeroHash) {
      const releaseAt = BigInt(await pub.readContract({ address: config.address, abi: DEED_CUSTODY_ABI,
        functionName: 'estateReleaseAt', args: [row.life_hash] }));
      const protectedEstate = state.estateDeath || await pub.readContract({ address: config.address, abi: DEED_CUSTODY_ABI,
        functionName: 'safeHouseCoveredAt', args: [BigInt(row.deed_token_id), BigInt(state.dynastyId), BigInt(state.deathAt)] });
      if (protectedEstate && releaseAt !== 0n) {
        if (settlementTime === undefined) settlementTime = BigInt((await pub.getBlock({ blockNumber: await pub.getBlockNumber() })).timestamp);
        if (settlementTime < releaseAt) continue; // This estate never blocks other eligible loot.
      }
      const position = await pub.readContract({ address: config.address, abi: DEED_CUSTODY_ABI,
        functionName: 'equippedLife', args: [BigInt(row.deed_token_id)] });
      if (position !== row.life_hash) return { state: 'awaiting_indexer' };
      return send(`deed-settle:${row.deed_token_id}:${row.life_hash}`, 'settleDeed', [BigInt(row.deed_token_id), 32n]);
    }
  }
  const purchases = (await pool.query("SELECT * FROM character_deed_safe_house_intents WHERE status='pending' ORDER BY user_issued_at LIMIT 100")).rows;
  for (const purchase of purchases) {
    const connection = await pool.connect();
    try {
      await connection.query('BEGIN');
      const ch = (await connection.query('SELECT id,alive FROM characters WHERE id=$1 FOR UPDATE', [purchase.life_id])).rows[0];
      const fresh = (await connection.query('SELECT * FROM character_deed_safe_house_intents WHERE life_id=$1 AND user_nonce=$2 FOR UPDATE', [purchase.life_id, purchase.user_nonce])).rows[0];
      const life = (await connection.query('SELECT * FROM character_deed_lives WHERE life_id=$1', [purchase.life_id])).rows[0];
      const now = BigInt(Math.floor(Date.now() / 1000));
      if (fresh?.status !== 'pending') { await connection.query('ROLLBACK'); continue; }
      if (!ch?.alive || life?.status !== 'alive' || BigInt(purchase.user_deadline) <= now || BigInt(purchase.price_day) !== now / 86400n) {
        await connection.query("UPDATE character_deed_safe_house_intents SET status='cancelled' WHERE life_id=$1 AND user_nonce=$2", [purchase.life_id, purchase.user_nonce]);
        await connection.query('COMMIT'); continue;
      }
      const request = { lifeId: life.life_hash, deedId: BigInt(purchase.deed_token_id), days_: BigInt(purchase.days),
        priceDay: BigInt(purchase.price_day), maxBurn: BigInt(purchase.max_burn), nonce: BigInt(purchase.user_nonce),
        issuedAt: BigInt(purchase.user_issued_at), deadline: BigInt(purchase.user_deadline) };
      try { await pub.simulateContract({ account: use.account.address, address: config.address,
        abi: DEED_CUSTODY_ABI, functionName: 'prepaySafeHouse', args: [request, purchase.user_signature] }); }
      catch (error) {
        if (!isContractRevert(error)) throw error;
        await connection.query("UPDATE character_deed_safe_house_intents SET status='cancelled' WHERE life_id=$1 AND user_nonce=$2", [purchase.life_id, purchase.user_nonce]);
        await connection.query('COMMIT'); continue;
      }
      const intentHash = keccak256(encodeFunctionData({ abi: DEED_CUSTODY_ABI, functionName: 'prepaySafeHouse', args: [request, purchase.user_signature] }));
      const sent = await send(`deed-safe-house:${intentHash}`, 'prepaySafeHouse', [request, purchase.user_signature]);
      if (sent.txHash && !['blocked','reverted'].includes(sent.state)) await connection.query(
        "UPDATE character_deed_safe_house_intents SET status='releasing',tx_hash=$3 WHERE life_id=$1 AND user_nonce=$2",
        [purchase.life_id, purchase.user_nonce, sent.txHash]);
      await connection.query('COMMIT'); return sent;
    } catch (error) { await connection.query('ROLLBACK'); throw error; }
    finally { connection.release(); }
  }
  const exits = (await pool.query(
    `SELECT * FROM character_deed_exits WHERE status='pending' AND user_signature IS NOT NULL
     AND available_at <= now() AND user_deadline > $1 ORDER BY user_issued_at LIMIT 100`,
    [Math.floor(Date.now() / 1000)])).rows;
  for (const exit of exits) {
    if (!exit.user_signature || new Date(exit.available_at).getTime() > Date.now()
      || BigInt(exit.user_deadline || 0) <= BigInt(Math.floor(Date.now() / 1000))) continue;
    const connection = await pool.connect();
    try {
      await connection.query('BEGIN');
      const ch = (await connection.query('SELECT id,alive FROM characters WHERE id=$1 FOR UPDATE', [exit.life_id])).rows[0];
      const fresh = (await connection.query('SELECT * FROM character_deed_exits WHERE life_id=$1 AND deed_token_id=$2 FOR UPDATE', [exit.life_id, exit.deed_token_id])).rows[0];
      const life = (await connection.query('SELECT * FROM character_deed_lives WHERE life_id=$1', [exit.life_id])).rows[0];
      if (!ch?.alive || life?.status !== 'alive' || fresh?.status !== 'pending' || fresh.user_signature !== exit.user_signature) {
        await connection.query('ROLLBACK'); continue;
      }
      // The character lock serializes this safe-release commit with every real
      // death. In-flight journal replay takes priority over later death commands.
      const request = {
        lifeId: life.life_hash, deedId: BigInt(exit.deed_token_id), nonce: BigInt(exit.user_nonce),
        issuedAt: BigInt(exit.user_issued_at), deadline: BigInt(exit.user_deadline),
      };
      const exitJobKey = characterDeedExitJobKey(exit, life.life_hash);
      try {
        await pub.simulateContract({ account: use.account.address, address: config.address,
          abi: DEED_CUSTODY_ABI, functionName: 'unequip', args: [request, exit.user_signature] });
      } catch (error) {
        if (!isContractRevert(error)) throw error;
        // An invalid signature/nonce is this user's bad intent, not a reason to
        // starve every later release. Transient RPC failures retain the intent.
        await connection.query(
          'UPDATE character_deed_exits SET user_signature=NULL WHERE life_id=$1 AND deed_token_id=$2 AND status=\'pending\'',
          [exit.life_id, exit.deed_token_id]);
        await connection.query('COMMIT'); continue;
      }
      const sent = await send(exitJobKey, 'unequip', [request, exit.user_signature]);
      if (sent.txHash && !['blocked', 'reverted'].includes(sent.state)) await connection.query(
        "UPDATE character_deed_exits SET status='releasing',tx_hash=$3 WHERE life_id=$1 AND deed_token_id=$2",
        [exit.life_id, exit.deed_token_id, sent.txHash]);
      await connection.query('COMMIT'); return sent;
    } catch (error) { await connection.query('ROLLBACK'); throw error; }
    finally { connection.release(); }
  }
  return { state: 'idle' };
}
