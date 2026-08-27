import { getAddress, keccak256, toBytes } from 'viem';

const DECIMAL_RE = /^(?:0|[1-9][0-9]*)$/;
const BYTES32_RE = /^0x[0-9a-f]{64}$/;
const ZERO_ADDRESS = `0x${'0'.repeat(40)}`;
const MAX_BLOCK_SPAN = 1_000_000n;
const MAX_LOGS = 10_000;
const MAX_BYTES = 10_000_000;
const PUBLISHED_FO_ERRORS = new WeakSet();
const SAFE_DOMAIN_ERRORS = new WeakSet();

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
    if (!FinalizedObservationError.CODES.includes(code)) {
      throw new TypeError('unpublished finalized observation error code');
    }
    super(message);
    this.name = 'FinalizedObservationError';
    this.code = code;
    if (cause !== undefined) Object.defineProperty(this, 'cause', { value: cause, enumerable: false });
    PUBLISHED_FO_ERRORS.add(this);
  }

  static safeDomain(code, cause) {
    if (typeof code !== 'string' || !/^[a-z][a-z0-9_]{0,63}$/.test(code) || code.startsWith('fo_')) {
      throw new TypeError('invalid finalized observation domain error code');
    }
    const error = new Error(`finalized observation consumer error: ${code}`);
    error.name = 'FinalizedObservationDomainError';
    Object.defineProperty(error, 'code', { value: code, enumerable: true });
    if (cause !== undefined) Object.defineProperty(error, 'cause', { value: cause, enumerable: false });
    SAFE_DOMAIN_ERRORS.add(error);
    return Object.freeze(error);
  }
}

function isPublishedFoError(error) {
  return PUBLISHED_FO_ERRORS.has(error)
    && FinalizedObservationError.CODES.includes(error.code);
}

function isSafeDomainError(error) {
  return SAFE_DOMAIN_ERRORS.has(error);
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
  if (typeof value !== 'object'
    || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
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
    if (isPublishedFoError(cause) || isSafeDomainError(cause)) throw cause;
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
  let lastObservationHash;
  try {
    chainId = decimal(input.chainId, 'checkpoint chain id', { positive: true });
    contractAddress = canonicalAddress(input.contractAddress, 'checkpoint contract address');
    startBlock = decimal(input.startBlock, 'checkpoint start block');
    lastAppliedBlockNumber = decimal(input.lastAppliedBlockNumber, 'last applied block number');
    lastAppliedBlockHash = bytes32(input.lastAppliedBlockHash, 'last applied block hash');
    lastObservationHash = input.lastObservationHash == null
      ? null : bytes32(input.lastObservationHash, 'last observation hash');
  } catch (cause) {
    fail('fo_checkpoint_identity', 'checkpoint identity is malformed', cause);
  }
  if (chainId !== identity.chainId || contractAddress !== identity.contractAddress
    || startBlock !== identity.startBlock || BigInt(lastAppliedBlockNumber) < BigInt(startBlock)) {
    fail('fo_checkpoint_identity', 'checkpoint belongs to another finalized observation identity');
  }
  return { lastAppliedBlockNumber, lastAppliedBlockHash, lastObservationHash };
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
        if (isPublishedFoError(cause) && cause.code === 'fo_rpc_unavailable') throw cause;
        if (isPublishedFoError(cause) && cause.code === 'fo_head_mismatch') {
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

function descriptorView(value, field) {
  try {
    return {
      prototype: Object.getPrototypeOf(value),
      descriptors: Object.getOwnPropertyDescriptors(value),
    };
  } catch (cause) {
    fail('fo_bad_config', `${field} cannot be inspected safely`, cause);
  }
}

function copyDataSnapshot(value, field, { allowBigInt = false, requireFrozen = false } = {},
  active = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean'
    || (allowBigInt && typeof value === 'bigint')) return value;
  if (typeof value !== 'object') fail('fo_bad_config', `${field} contains unsupported data`);
  if (active.has(value)) fail('fo_bad_config', `${field} must not contain cycles`);
  if (requireFrozen) {
    let frozen;
    try { frozen = Object.isFrozen(value); }
    catch (cause) { fail('fo_bad_config', `${field} cannot be inspected safely`, cause); }
    if (!frozen) fail('fo_bad_config', `${field} must be deeply immutable`);
  }
  active.add(value);
  const { prototype, descriptors } = descriptorView(value, field);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some((key) => typeof key === 'symbol')) {
    fail('fo_bad_config', `${field} must not contain symbol capabilities`);
  }
  let copy;
  if (Array.isArray(value)) {
    if (prototype !== Array.prototype) fail('fo_bad_config', `${field} must contain plain arrays`);
    const lengthDescriptor = descriptors.length;
    if (!lengthDescriptor || !Object.hasOwn(lengthDescriptor, 'value') || lengthDescriptor.enumerable
      || !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0) {
      fail('fo_bad_config', `${field} array length is malformed`);
    }
    const indexKeys = keys.filter((key) => key !== 'length');
    if (indexKeys.length !== lengthDescriptor.value) {
      fail('fo_bad_config', `${field} arrays must be dense and carry no extra properties`);
    }
    copy = [];
    for (let index = 0; index < lengthDescriptor.value; index++) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
        fail('fo_bad_config', `${field} arrays must contain enumerable data entries`);
      }
      copy.push(copyDataSnapshot(
        descriptor.value, `${field}[${index}]`, { allowBigInt, requireFrozen }, active));
    }
  } else {
    if (prototype !== Object.prototype && prototype !== null) {
      fail('fo_bad_config', `${field} must contain only plain objects`);
    }
    copy = Object.create(prototype);
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
        fail('fo_bad_config', `${field} must contain only enumerable data properties`);
      }
      Object.defineProperty(copy, key, {
        value: copyDataSnapshot(
          descriptor.value, `${field}.${key}`, { allowBigInt, requireFrozen }, active),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
  }
  active.delete(value);
  return copy;
}

function pinnedGetterRequest(request) {
  if (!request || typeof request !== 'object') {
    fail('fo_bad_config', 'pinned getter request must be a plain object');
  }
  const { prototype, descriptors } = descriptorView(request, 'pinned getter request');
  if (prototype !== Object.prototype && prototype !== null) {
    fail('fo_bad_config', 'pinned getter request must be a plain object');
  }
  const keys = Reflect.ownKeys(descriptors);
  const allowed = new Set(['abi', 'functionName', 'args']);
  if (keys.some((key) => typeof key !== 'string' || !allowed.has(key))) {
    fail('fo_bad_config', 'pinned getter request contains an execution-context capability');
  }
  for (const key of keys) {
    if (!descriptors[key].enumerable || !Object.hasOwn(descriptors[key], 'value')) {
      fail('fo_bad_config', 'pinned getter request must contain only enumerable data properties');
    }
  }
  if (!descriptors.abi || !descriptors.functionName
    || typeof descriptors.functionName.value !== 'string' || descriptors.functionName.value === '') {
    fail('fo_bad_config', 'pinned getter request requires ABI and function name data');
  }
  const abi = copyDataSnapshot(descriptors.abi.value, 'pinned getter ABI', { allowBigInt: true });
  if (!Array.isArray(abi)) fail('fo_bad_config', 'pinned getter ABI must be a dense array');
  const normalized = { abi, functionName: descriptors.functionName.value };
  if (descriptors.args) {
    const args = copyDataSnapshot(
      descriptors.args.value, 'pinned getter arguments', { allowBigInt: true });
    if (!Array.isArray(args)) fail('fo_bad_config', 'pinned getter arguments must be a dense array');
    normalized.args = args;
  }
  return deepFreeze(normalized);
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
      const call = pinnedGetterRequest(request);
      const result = await rpc(() => client.readContract({
        ...call,
        address: config.identity.contractAddress,
        blockNumber: targetNumber,
      }));
      await recheckExact(client, targetNumber, target);
      return result;
    },
  });
  let getterSource;
  try { getterSource = await readGetters(facade, publicHead); }
  catch (cause) {
    if (isPublishedFoError(cause) || isSafeDomainError(cause)) throw cause;
    fail('fo_rpc_unavailable', 'pinned getter observation failed', cause);
  }
  const getters = deepFreeze(copyDataSnapshot(getterSource, 'getter evidence'));
  const getterJson = canonicalJson(getters);
  if (Buffer.byteLength(getterJson) > config.limits.maxBytes) {
    fail('fo_work_oversized', 'getter evidence exceeds the configured byte bound');
  }
  await recheckExact(client, targetNumber, target);

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

function validateCommitObservation(observation) {
  if (!observation || typeof observation !== 'object') {
    fail('fo_bad_config', 'commit requires completed immutable finalized evidence');
  }
  const snapshot = deepFreeze(copyDataSnapshot(
    observation, 'commit evidence', { requireFrozen: true }));
  let identity;
  let head;
  let horizon;
  try {
    identity = {
      chainId: decimal(snapshot.identity?.chainId, 'observation chain id', { positive: true }),
      contractAddress: canonicalAddress(snapshot.identity?.contractAddress),
      startBlock: decimal(snapshot.identity?.startBlock, 'observation start block'),
    };
    head = {
      blockNumber: decimal(snapshot.head?.blockNumber, 'observation head number'),
      blockHash: bytes32(snapshot.head?.blockHash, 'observation head hash'),
    };
    horizon = {
      blockNumber: decimal(snapshot.finalizedHorizon?.blockNumber, 'observation horizon number'),
      blockHash: bytes32(snapshot.finalizedHorizon?.blockHash, 'observation horizon hash'),
    };
    bytes32(snapshot.evidenceHash, 'observation evidence hash');
  } catch (cause) {
    if (isPublishedFoError(cause) && cause.code === 'fo_bad_config') throw cause;
    fail('fo_bad_config', 'commit evidence identity is malformed', cause);
  }
  if (identity.chainId !== snapshot.identity.chainId
    || identity.contractAddress !== snapshot.identity.contractAddress
    || identity.startBlock !== snapshot.identity.startBlock
    || head.blockNumber !== snapshot.head.blockNumber || head.blockHash !== snapshot.head.blockHash
    || horizon.blockNumber !== snapshot.finalizedHorizon.blockNumber
    || horizon.blockHash !== snapshot.finalizedHorizon.blockHash
    || BigInt(head.blockNumber) > BigInt(horizon.blockNumber)) {
    fail('fo_bad_config', 'commit evidence is not canonical');
  }
  const { evidenceHash, ...payload } = snapshot;
  if (keccak256(toBytes(canonicalJson(payload))) !== evidenceHash) {
    fail('fo_bad_config', 'commit evidence hash does not match its immutable payload');
  }
  return { identity, head, observation: snapshot };
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
  if (emptyNumber) {
    if (input.lastObservationHash != null) {
      fail('fo_checkpoint_identity', 'empty consumer checkpoint cannot carry an observation commitment');
    }
    return { lastAppliedBlockNumber: null, lastAppliedBlockHash: null, lastObservationHash: null };
  }
  try {
    return {
      lastAppliedBlockNumber: decimal(input.lastAppliedBlockNumber, 'consumer last-applied number'),
      lastAppliedBlockHash: bytes32(input.lastAppliedBlockHash, 'consumer last-applied hash'),
      lastObservationHash: input.lastObservationHash == null
        ? null : bytes32(input.lastObservationHash, 'consumer last-observation hash'),
    };
  } catch (cause) {
    fail('fo_checkpoint_identity', 'consumer last-applied checkpoint is malformed', cause);
  }
}

function matchesCheckpoint(current, expected) {
  if (expected == null) {
    return current.lastAppliedBlockNumber == null && current.lastAppliedBlockHash == null
      && current.lastObservationHash == null;
  }
  return current.lastAppliedBlockNumber === expected.lastAppliedBlockNumber
    && current.lastAppliedBlockHash === expected.lastAppliedBlockHash
    && current.lastObservationHash === (expected.lastObservationHash ?? null);
}

function safeConsumerCause(cause) {
  if (isPublishedFoError(cause) || isSafeDomainError(cause)) return cause;
  return FinalizedObservationError.safeDomain('consumer_failed', cause);
}

/**
 * Atomically consumes immutable evidence through a domain adapter. The locked checkpoint
 * must return `lastObservationHash`; `advanceCheckpoint` must store the supplied evidence
 * hash with its metadata in the same transaction. Only that exact commitment is a replay.
 */
export async function commitFinalizedObservation(pool, observation, adapter) {
  const canonical = validateCommitObservation(observation);
  const committed = canonical.observation;
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
      await adapter.lockAndReadCheckpoint(client, committed), canonical.identity);
    const exactReplay = matchesCheckpoint(locked, {
      lastAppliedBlockNumber: canonical.head.blockNumber,
      lastAppliedBlockHash: canonical.head.blockHash,
      lastObservationHash: committed.evidenceHash,
    });
    const atBase = matchesCheckpoint(locked, committed.checkpointBase);
    if (!exactReplay && !atBase) {
      fail('fo_checkpoint_advanced', 'consumer checkpoint advanced after observation');
    }

    if (!exactReplay) {
      await adapter.insertOrVerifyInbox(client, committed);
      await adapter.applyDomainState(client, committed);
      await adapter.advanceCheckpoint(client, committed);
    }
    const result = await adapter.readCommittedResult(client, committed);
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
