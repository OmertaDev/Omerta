import { getAddress, keccak256, toBytes } from 'viem';

const DECIMAL_RE = /^(?:0|[1-9][0-9]*)$/;
const BYTES32_RE = /^0x[0-9a-f]{64}$/;
const ZERO_ADDRESS = `0x${'0'.repeat(40)}`;
const MAX_BLOCK_SPAN = 1_000_000n;
const MAX_LOGS = 10_000;
const MAX_BYTES = 10_000_000;

export class FinalizedObservationError extends Error {
  static CODES = Object.freeze([
    'fo_unconfigured',
    'fo_bad_config',
    'fo_wrong_chain',
    'fo_head_unavailable',
    'fo_checkpoint_identity',
    'fo_checkpoint_reorg',
    'fo_head_regression',
    'fo_range_gap',
    'fo_work_oversized',
    'fo_rpc_unavailable',
    'fo_log_removed',
    'fo_log_address',
    'fo_log_topic',
    'fo_log_range',
    'fo_log_identity',
    'fo_log_order',
    'fo_log_duplicate',
    'fo_log_block_hash',
    'fo_head_mismatch',
    'fo_checkpoint_advanced',
  ]);

  constructor(code, message, cause) {
    super(message);
    this.name = 'FinalizedObservationError';
    this.code = code;
    if (cause !== undefined) Object.defineProperty(this, 'cause', { value: cause, enumerable: false });
  }
}

function fail(code, message, cause) {
  throw new FinalizedObservationError(code, message, cause);
}

function decimal(value, field, { positive = false } = {}) {
  if (typeof value !== 'bigint' && typeof value !== 'string') {
    fail('fo_bad_config', `${field} must be a canonical decimal string or BigInt`);
  }
  const text = typeof value === 'bigint' ? value.toString() : value;
  if (!DECIMAL_RE.test(text)) fail('fo_bad_config', `${field} must be canonical decimal`);
  if (positive && text === '0') fail('fo_bad_config', `${field} must be positive`);
  return text;
}

function canonicalAddress(value, field = 'contract address') {
  if (value == null || String(value).trim() === '') fail('fo_unconfigured', `${field} is not configured`);
  let address;
  try { address = getAddress(String(value)); }
  catch (cause) { fail('fo_bad_config', `${field} is invalid`, cause); }
  if (address.toLowerCase() === ZERO_ADDRESS) fail('fo_unconfigured', `${field} is not configured`);
  return address;
}

function bytes32(value, field) {
  if (typeof value !== 'string' || !BYTES32_RE.test(value)) {
    fail('fo_bad_config', `${field} must be canonical lowercase bytes32`);
  }
  return value;
}

function positiveLimit(value, field, ceiling) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > ceiling) {
    fail('fo_bad_config', `${field} is outside its safe work bound`);
  }
  return value;
}

function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const nested of Object.values(value)) deepFreeze(nested, seen);
  return Object.freeze(value);
}

function canonicalJson(value, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    fail('fo_bad_config', 'evidence numbers must be canonical decimal strings');
  }
  if (typeof value === 'bigint' || typeof value === 'undefined' || typeof value === 'function'
    || typeof value === 'symbol') fail('fo_bad_config', 'evidence must be plain serializable data');
  if (value !== null && typeof value === 'object' && seen.has(value)) {
    fail('fo_bad_config', 'evidence must not contain cycles');
  }
  if (Array.isArray(value)) {
    seen.add(value);
    const serialized = `[${value.map((entry) => canonicalJson(entry, seen)).join(',')}]`;
    seen.delete(value);
    return serialized;
  }
  if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    fail('fo_bad_config', 'evidence must be plain serializable data');
  }
  seen.add(value);
  const serialized = `{${Object.keys(value).sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key], seen)}`).join(',')}}`;
  seen.delete(value);
  return serialized;
}

export function normalizeFinalizedObservationConfig(input) {
  if (!input || typeof input !== 'object' || !input.identity || !input.limits) {
    fail('fo_unconfigured', 'finalized observation identity and limits are required');
  }
  const { identity, topics, limits } = input;
  if (identity.chainId == null || identity.startBlock == null) {
    fail('fo_unconfigured', 'finalized observation chain and start block are required');
  }
  const chainId = decimal(identity.chainId, 'chain id', { positive: true });
  const contractAddress = canonicalAddress(identity.contractAddress);
  const startBlock = decimal(identity.startBlock, 'start block');
  if (!Array.isArray(topics) || topics.length === 0) fail('fo_bad_config', 'topic allow-list is required');
  const normalizedTopics = topics.map((topic, index) => bytes32(topic, `topic ${index}`));
  for (let index = 1; index < normalizedTopics.length; index++) {
    if (normalizedTopics[index - 1] >= normalizedTopics[index]) {
      fail('fo_bad_config', 'topic allow-list must be unique and strictly ordered');
    }
  }
  const maxBlockSpan = decimal(limits.maxBlockSpan, 'max block span', { positive: true });
  if (BigInt(maxBlockSpan) > MAX_BLOCK_SPAN) fail('fo_bad_config', 'max block span exceeds its safe work bound');
  const normalized = {
    identity: { chainId, contractAddress, startBlock },
    topics: normalizedTopics,
    limits: {
      maxBlockSpan,
      maxLogs: positiveLimit(limits.maxLogs, 'max logs', MAX_LOGS),
      maxBytes: positiveLimit(limits.maxBytes, 'max bytes', MAX_BYTES),
    },
  };
  return deepFreeze(normalized);
}

export function finalizedInboxIdentity(input) {
  if (!input || typeof input !== 'object') fail('fo_bad_config', 'inbox identity is required');
  const normalized = {
    chainId: decimal(input.chainId, 'chain id', { positive: true }),
    contractAddress: canonicalAddress(input.contractAddress),
    blockHash: bytes32(input.blockHash, 'block hash'),
    transactionHash: bytes32(input.transactionHash, 'transaction hash'),
    logIndex: decimal(input.logIndex, 'log index'),
  };
  return keccak256(toBytes(canonicalJson(normalized)));
}

async function rpc(call, message = 'finalized observation RPC unavailable') {
  try { return await call(); }
  catch (cause) {
    if (cause instanceof FinalizedObservationError) throw cause;
    fail('fo_rpc_unavailable', message, cause);
  }
}

function mappedDecimal(value, field, code) {
  try { return decimal(value, field); }
  catch (cause) { fail(code, `${field} is unavailable or malformed`, cause); }
}

function viemChainId(value) {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value <= 0) {
      fail('fo_wrong_chain', 'RPC chain id is unavailable or malformed');
    }
    return BigInt(value).toString();
  }
  return mappedDecimal(value, 'RPC chain id', 'fo_wrong_chain');
}

function mappedBytes32(value, field, code) {
  try { return bytes32(value, field); }
  catch (cause) { fail(code, `${field} is unavailable or malformed`, cause); }
}

function normalizedBlock(raw, code, label) {
  if (!raw || typeof raw !== 'object') fail(code, `${label} identity is unavailable`);
  const blockNumber = mappedDecimal(raw.number, `${label} block number`, code);
  const blockHash = mappedBytes32(raw.hash, `${label} block hash`, code);
  const timestamp = mappedDecimal(raw.timestamp, `${label} timestamp`, code);
  return { blockNumber, blockHash, timestamp };
}

async function exactBlock(client, number, missingCode = 'fo_head_unavailable') {
  const raw = await rpc(() => client.getBlock({ blockNumber: number }));
  const normalized = normalizedBlock(raw, missingCode, 'numbered block');
  if (BigInt(normalized.blockNumber) !== number) {
    fail('fo_head_mismatch', 'numbered block returned another height');
  }
  return normalized;
}

function sameBlock(left, right) {
  return left.blockNumber === right.blockNumber && left.blockHash === right.blockHash;
}

function assertSameBlock(actual, expected, message = 'numbered block identity changed') {
  if (!sameBlock(actual, expected)) fail('fo_head_mismatch', message);
}

function normalizedCheckpoint(input, identity) {
  if (input == null) return null;
  if (typeof input !== 'object') fail('fo_checkpoint_identity', 'checkpoint identity is malformed');
  let chainId;
  let contractAddress;
  let startBlock;
  let lastAppliedBlockNumber;
  let lastAppliedBlockHash;
  try {
    chainId = decimal(input.chainId, 'checkpoint chain id', { positive: true });
    contractAddress = canonicalAddress(input.contractAddress, 'checkpoint contract address');
    startBlock = decimal(input.startBlock, 'checkpoint start block');
    lastAppliedBlockNumber = decimal(input.lastAppliedBlockNumber, 'last applied block number');
    lastAppliedBlockHash = bytes32(input.lastAppliedBlockHash, 'last applied block hash');
  } catch (cause) {
    fail('fo_checkpoint_identity', 'checkpoint identity is malformed', cause);
  }
  if (chainId !== identity.chainId || contractAddress !== identity.contractAddress
    || startBlock !== identity.startBlock || BigInt(lastAppliedBlockNumber) < BigInt(startBlock)) {
    fail('fo_checkpoint_identity', 'checkpoint belongs to another finalized observation identity');
  }
  return { lastAppliedBlockNumber, lastAppliedBlockHash };
}

function normalizeLog(raw, { identity, topics }, fromBlock, toBlock) {
  if (!raw || typeof raw !== 'object') fail('fo_log_identity', 'log identity is malformed');
  if (raw.removed !== false) fail('fo_log_removed', 'removed logs are not finalized evidence');
  let address;
  try { address = canonicalAddress(raw.address, 'log address'); }
  catch (cause) { fail('fo_log_address', 'log address is malformed', cause); }
  if (address !== identity.contractAddress) fail('fo_log_address', 'log belongs to another contract');
  if (!Array.isArray(raw.topics) || raw.topics.length === 0) {
    fail('fo_log_topic', 'log topic0 is unavailable');
  }
  let topic0;
  try { topic0 = bytes32(raw.topics[0], 'log topic0'); }
  catch (cause) { fail('fo_log_topic', 'log topic0 is malformed', cause); }
  if (!topics.includes(topic0)) fail('fo_log_topic', 'log topic0 is outside the allow-list');
  const normalizedTopics = [topic0];
  for (let index = 1; index < raw.topics.length; index++) {
    normalizedTopics.push(mappedBytes32(raw.topics[index], `log topic ${index}`, 'fo_log_identity'));
  }
  if (typeof raw.data !== 'string' || !/^0x(?:[0-9a-f]{2})*$/.test(raw.data)) {
    fail('fo_log_identity', 'log data must be canonical lowercase bytes');
  }
  const blockNumber = mappedDecimal(raw.blockNumber, 'log block number', 'fo_log_identity');
  const numericBlock = BigInt(blockNumber);
  if (numericBlock < fromBlock || numericBlock > toBlock) fail('fo_log_range', 'log lies outside the requested range');
  return {
    address,
    topics: normalizedTopics,
    data: raw.data,
    blockNumber,
    blockHash: mappedBytes32(raw.blockHash, 'log block hash', 'fo_log_identity'),
    transactionHash: mappedBytes32(raw.transactionHash, 'log transaction hash', 'fo_log_identity'),
    transactionIndex: mappedDecimal(raw.transactionIndex, 'log transaction index', 'fo_log_identity'),
    logIndex: mappedDecimal(raw.logIndex, 'log index', 'fo_log_identity'),
  };
}

function compareLogPosition(left, right) {
  for (const field of ['blockNumber', 'transactionIndex', 'logIndex']) {
    const delta = BigInt(left[field]) - BigInt(right[field]);
    if (delta < 0n) return -1;
    if (delta > 0n) return 1;
  }
  return 0;
}

async function normalizedLogs(client, rawLogs, config, fromBlock, toBlock) {
  if (!Array.isArray(rawLogs) || rawLogs.truncated === true || rawLogs.hasMore === true
    || rawLogs.nextPage != null || rawLogs.cursor != null || rawLogs.continuationToken != null) {
    fail('fo_range_gap', 'RPC did not return one complete unpaginated log array');
  }
  if (rawLogs.length > config.limits.maxLogs) fail('fo_work_oversized', 'log count exceeds the configured work bound');
  const logs = [];
  const identities = new Set();
  const positions = new Set();
  let previous = null;
  for (const raw of rawLogs) {
    const log = normalizeLog(raw, config, fromBlock, toBlock);
    const inboxIdentity = finalizedInboxIdentity({
      chainId: config.identity.chainId,
      contractAddress: config.identity.contractAddress,
      blockHash: log.blockHash,
      transactionHash: log.transactionHash,
      logIndex: log.logIndex,
    });
    const position = `${log.blockNumber}:${log.transactionIndex}:${log.logIndex}`;
    if (identities.has(inboxIdentity) || positions.has(position)) {
      fail('fo_log_duplicate', 'duplicate or conflicting log identity');
    }
    if (previous && compareLogPosition(log, previous) < 0) {
      fail('fo_log_order', 'logs are not in stable chain order');
    }
    identities.add(inboxIdentity);
    positions.add(position);
    logs.push(log);
    previous = log;
  }
  if (Buffer.byteLength(canonicalJson(logs)) > config.limits.maxBytes) {
    fail('fo_work_oversized', 'serialized logs exceed the configured byte bound');
  }
  const eventBlocks = new Map();
  for (const log of logs) {
    if (!eventBlocks.has(log.blockNumber)) {
      let block;
      try { block = await exactBlock(client, BigInt(log.blockNumber), 'fo_log_block_hash'); }
      catch (cause) {
        if (cause instanceof FinalizedObservationError && cause.code === 'fo_rpc_unavailable') throw cause;
        if (cause instanceof FinalizedObservationError && cause.code === 'fo_head_mismatch') {
          fail('fo_log_block_hash', 'event block returned another height', cause);
        }
        throw cause;
      }
      eventBlocks.set(log.blockNumber, block.blockHash);
    }
    if (eventBlocks.get(log.blockNumber) !== log.blockHash) {
      fail('fo_log_block_hash', 'event block hash does not match its exact numbered block');
    }
  }
  return logs;
}

async function recheckExact(client, number, expected) {
  const actual = await exactBlock(client, number, 'fo_head_mismatch');
  assertSameBlock(actual, expected);
}

/**
 * Observe one bounded finalized range through an FO-compatible public-client wrapper.
 * The wrapper MUST expose `finalizedObservationRawTopics === true` and implement
 * `getLogs({ address, fromBlock, toBlock, topics })` as one unpaginated response whose
 * raw `topics` matrix is honored exactly. An unwrapped viem PublicClient is deliberately
 * rejected because viem's public `getLogs` action ignores an unknown raw `topics` option;
 * a concrete consumer owns the thin raw-RPC adapter outside this domain-neutral kernel.
 */
export async function observeFinalized({ client, identity, checkpoint = null, topics, limits, readGetters } = {}) {
  if (!client || typeof client.getChainId !== 'function' || typeof client.getBlock !== 'function'
    || typeof client.getLogs !== 'function' || typeof client.readContract !== 'function') {
    fail('fo_unconfigured', 'a viem-compatible public client is required');
  }
  if (client.finalizedObservationRawTopics !== true) {
    fail('fo_bad_config', 'public client must declare the FO raw-topic getLogs capability');
  }
  if (typeof readGetters !== 'function') fail('fo_bad_config', 'a pinned getter callback is required');
  const config = normalizeFinalizedObservationConfig({ identity, topics, limits });
  const base = normalizedCheckpoint(checkpoint, config.identity);
  const liveChainId = viemChainId(await rpc(() => client.getChainId()));
  if (liveChainId !== config.identity.chainId) fail('fo_wrong_chain', 'RPC is connected to another chain');

  const taggedHorizon = normalizedBlock(
    await rpc(() => client.getBlock({ blockTag: 'finalized' })), 'fo_head_unavailable', 'finalized head');
  const horizonNumber = BigInt(taggedHorizon.blockNumber);
  const exactHorizon = await exactBlock(client, horizonNumber);
  assertSameBlock(exactHorizon, taggedHorizon, 'finalized tag does not match its exact numbered block');

  const startBlock = BigInt(config.identity.startBlock);
  const span = BigInt(config.limits.maxBlockSpan);
  let baseNumber = null;
  if (base) {
    baseNumber = BigInt(base.lastAppliedBlockNumber);
    if (horizonNumber < baseNumber) fail('fo_head_regression', 'finalized head is behind the checkpoint');
    const exactCheckpoint = await exactBlock(client, baseNumber);
    if (exactCheckpoint.blockHash !== base.lastAppliedBlockHash) {
      fail('fo_checkpoint_reorg', 'stored checkpoint hash no longer matches its exact block');
    }
  } else if (horizonNumber < startBlock) {
    fail('fo_head_regression', 'finalized head is before the configured start block');
  }

  const candidate = baseNumber === null ? startBlock + span - 1n : baseNumber + span;
  const targetNumber = candidate < horizonNumber ? candidate : horizonNumber;
  const target = await exactBlock(client, targetNumber);
  const rangeFrom = baseNumber === null ? startBlock : baseNumber + 1n;
  const range = rangeFrom <= targetNumber ? { fromBlock: rangeFrom, toBlock: targetNumber } : null;
  let logs = [];
  if (range) {
    const rawLogs = await rpc(() => client.getLogs({
      address: config.identity.contractAddress,
      fromBlock: range.fromBlock,
      toBlock: range.toBlock,
      topics: [config.topics],
    }));
    logs = await normalizedLogs(client, rawLogs, config, range.fromBlock, range.toBlock);
  }
  await recheckExact(client, targetNumber, target);

  const publicHead = deepFreeze({ ...target });
  const facade = Object.freeze({
    readContract: async (request) => {
      if (!request || typeof request !== 'object' || Object.getPrototypeOf(request) !== Object.prototype) {
        fail('fo_bad_config', 'pinned getter request must be a plain object');
      }
      for (const key of ['address', 'blockNumber', 'blockTag']) {
        if (Object.hasOwn(request, key)) fail('fo_bad_config', `pinned getter cannot override ${key}`);
      }
      const result = await rpc(() => client.readContract({
        ...request,
        address: config.identity.contractAddress,
        blockNumber: targetNumber,
      }));
      await recheckExact(client, targetNumber, target);
      return result;
    },
  });
  let getters;
  try { getters = await readGetters(facade, publicHead); }
  catch (cause) {
    if (cause instanceof FinalizedObservationError) throw cause;
    fail('fo_rpc_unavailable', 'pinned getter observation failed', cause);
  }
  await recheckExact(client, targetNumber, target);
  const getterJson = canonicalJson(getters);
  if (Buffer.byteLength(getterJson) > config.limits.maxBytes) {
    fail('fo_work_oversized', 'getter evidence exceeds the configured byte bound');
  }

  const finalTag = normalizedBlock(
    await rpc(() => client.getBlock({ blockTag: 'finalized' })), 'fo_head_mismatch', 'final finalized head');
  const finalTagNumber = BigInt(finalTag.blockNumber);
  if (finalTagNumber < horizonNumber || finalTagNumber < targetNumber) {
    fail('fo_head_regression', 'finalized tag regressed during observation');
  }
  if (finalTagNumber === horizonNumber && finalTag.blockHash !== taggedHorizon.blockHash) {
    fail('fo_head_mismatch', 'finalized tag hash changed at the same height');
  }
  const finalHorizon = await exactBlock(client, horizonNumber, 'fo_head_mismatch');
  assertSameBlock(finalHorizon, exactHorizon, 'finalized horizon hash changed during observation');
  await recheckExact(client, targetNumber, target);

  const payload = {
    identity: { ...config.identity },
    checkpointBase: base ? { ...base } : null,
    finalizedHorizon: { ...exactHorizon },
    head: { ...target },
    range: range ? {
      fromBlock: range.fromBlock.toString(),
      toBlock: range.toBlock.toString(),
    } : null,
    logs,
    getters,
    caughtUp: targetNumber === horizonNumber,
  };
  const evidenceHash = keccak256(toBytes(canonicalJson(payload)));
  return deepFreeze({ ...payload, evidenceHash });
}

function isDeepFrozen(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return true;
  if (!Object.isFrozen(value)) return false;
  seen.add(value);
  return Object.values(value).every((nested) => isDeepFrozen(nested, seen));
}

function validateCommitObservation(observation) {
  if (!observation || typeof observation !== 'object' || typeof observation.then === 'function'
    || !isDeepFrozen(observation)) {
    fail('fo_bad_config', 'commit requires completed immutable finalized evidence');
  }
  let identity;
  let head;
  let horizon;
  try {
    identity = {
      chainId: decimal(observation.identity?.chainId, 'observation chain id', { positive: true }),
      contractAddress: canonicalAddress(observation.identity?.contractAddress),
      startBlock: decimal(observation.identity?.startBlock, 'observation start block'),
    };
    head = {
      blockNumber: decimal(observation.head?.blockNumber, 'observation head number'),
      blockHash: bytes32(observation.head?.blockHash, 'observation head hash'),
    };
    horizon = {
      blockNumber: decimal(observation.finalizedHorizon?.blockNumber, 'observation horizon number'),
      blockHash: bytes32(observation.finalizedHorizon?.blockHash, 'observation horizon hash'),
    };
    bytes32(observation.evidenceHash, 'observation evidence hash');
  } catch (cause) {
    if (cause instanceof FinalizedObservationError && cause.code === 'fo_bad_config') throw cause;
    fail('fo_bad_config', 'commit evidence identity is malformed', cause);
  }
  if (identity.chainId !== observation.identity.chainId
    || identity.contractAddress !== observation.identity.contractAddress
    || identity.startBlock !== observation.identity.startBlock
    || head.blockNumber !== observation.head.blockNumber || head.blockHash !== observation.head.blockHash
    || horizon.blockNumber !== observation.finalizedHorizon.blockNumber
    || horizon.blockHash !== observation.finalizedHorizon.blockHash
    || BigInt(head.blockNumber) > BigInt(horizon.blockNumber)) {
    fail('fo_bad_config', 'commit evidence is not canonical');
  }
  const { evidenceHash, ...payload } = observation;
  if (keccak256(toBytes(canonicalJson(payload))) !== evidenceHash) {
    fail('fo_bad_config', 'commit evidence hash does not match its immutable payload');
  }
  return { identity, head };
}

function validateAdapter(adapter) {
  const methods = [
    'lockAndReadCheckpoint',
    'insertOrVerifyInbox',
    'applyDomainState',
    'advanceCheckpoint',
    'readCommittedResult',
  ];
  if (!adapter || typeof adapter !== 'object'
    || methods.some((method) => typeof adapter[method] !== 'function')) {
    fail('fo_bad_config', 'consumer adapter does not implement the finalized observation contract');
  }
}

function normalizeLockedCheckpoint(input, observationIdentity) {
  if (!input || typeof input !== 'object') fail('fo_checkpoint_identity', 'consumer checkpoint is unavailable');
  let chainId;
  let contractAddress;
  let startBlock;
  try {
    chainId = decimal(input.chainId, 'consumer chain id', { positive: true });
    contractAddress = canonicalAddress(input.contractAddress, 'consumer contract address');
    startBlock = decimal(input.startBlock, 'consumer start block');
  } catch (cause) {
    fail('fo_checkpoint_identity', 'consumer checkpoint identity is malformed', cause);
  }
  if (chainId !== observationIdentity.chainId || contractAddress !== observationIdentity.contractAddress
    || startBlock !== observationIdentity.startBlock) {
    fail('fo_checkpoint_identity', 'consumer checkpoint belongs to another authority');
  }
  const emptyNumber = input.lastAppliedBlockNumber == null;
  const emptyHash = input.lastAppliedBlockHash == null;
  if (emptyNumber !== emptyHash) fail('fo_checkpoint_identity', 'consumer checkpoint is only partially initialized');
  if (emptyNumber) return { lastAppliedBlockNumber: null, lastAppliedBlockHash: null };
  try {
    return {
      lastAppliedBlockNumber: decimal(input.lastAppliedBlockNumber, 'consumer last-applied number'),
      lastAppliedBlockHash: bytes32(input.lastAppliedBlockHash, 'consumer last-applied hash'),
    };
  } catch (cause) {
    fail('fo_checkpoint_identity', 'consumer last-applied checkpoint is malformed', cause);
  }
}

function matchesCheckpoint(current, expected) {
  if (expected == null) return current.lastAppliedBlockNumber == null && current.lastAppliedBlockHash == null;
  return current.lastAppliedBlockNumber === expected.lastAppliedBlockNumber
    && current.lastAppliedBlockHash === expected.lastAppliedBlockHash;
}

function safeConsumerCause(cause) {
  if (cause instanceof FinalizedObservationError) return cause;
  if (cause && typeof cause.code === 'string' && /^[a-z][a-z0-9_]*$/.test(cause.code)) return cause;
  const error = new Error('finalized observation consumer transaction failed');
  error.name = 'FinalizedObservationConsumerError';
  Object.defineProperty(error, 'cause', { value: cause, enumerable: false });
  return error;
}

export async function commitFinalizedObservation(pool, observation, adapter) {
  const canonical = validateCommitObservation(observation);
  validateAdapter(adapter);
  if (!pool || typeof pool.connect !== 'function') {
    fail('fo_bad_config', 'commit requires a pool, not a caller-owned transaction client');
  }
  let client;
  let began = false;
  try {
    client = await pool.connect();
    if (!client || typeof client.query !== 'function' || typeof client.release !== 'function') {
      fail('fo_bad_config', 'pool returned an invalid transaction client');
    }
    await client.query('BEGIN');
    began = true;
    const locked = normalizeLockedCheckpoint(
      await adapter.lockAndReadCheckpoint(client, observation), canonical.identity);
    const atHead = matchesCheckpoint(locked, {
      lastAppliedBlockNumber: canonical.head.blockNumber,
      lastAppliedBlockHash: canonical.head.blockHash,
    });
    const atBase = matchesCheckpoint(locked, observation.checkpointBase);
    if (!atHead && !atBase) fail('fo_checkpoint_advanced', 'consumer checkpoint advanced after observation');

    await adapter.insertOrVerifyInbox(client, observation);
    if (!atHead) {
      await adapter.applyDomainState(client, observation);
      await adapter.advanceCheckpoint(client, observation);
    }
    const result = await adapter.readCommittedResult(client, observation);
    await client.query('COMMIT');
    began = false;
    return result;
  } catch (cause) {
    if (client && began) await client.query('ROLLBACK').catch(() => {});
    throw safeConsumerCause(cause);
  } finally {
    if (client && typeof client.release === 'function') client.release();
  }
}
