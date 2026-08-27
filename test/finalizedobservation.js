import assert from 'node:assert/strict';
import { newDb } from 'pg-mem';
import { getAddress } from 'viem';

import {
  FinalizedObservationError,
  commitFinalizedObservation,
  finalizedInboxIdentity,
  normalizeFinalizedObservationConfig,
  observeFinalized,
} from '../src/finalizedobservation.js';

const STABLE_ERROR_CODES = Object.freeze([
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

assert.equal(typeof normalizeFinalizedObservationConfig, 'function');
assert.equal(typeof finalizedInboxIdentity, 'function');
assert.equal(typeof observeFinalized, 'function');
assert.equal(typeof commitFinalizedObservation, 'function');
assert.deepEqual(FinalizedObservationError.CODES, STABLE_ERROR_CODES);

const failures = [];
async function test(name, run) {
  try { await run(); }
  catch (error) {
    error.message = `${name}: ${error.message}`;
    failures.push(error);
  }
}

const hash = (char) => `0x${char.repeat(64)}`;
const CONTRACT = getAddress('0x1234567890abcdef1234567890abcdef12345678');
const OTHER_CONTRACT = getAddress(`0x${'9'.repeat(40)}`);
const START = 9007199254740993n;
const TOPICS = Object.freeze([hash('1'), hash('2')]);
const LIMITS = Object.freeze({ maxBlockSpan: 3n, maxLogs: 4, maxBytes: 4096 });
const IDENTITY = Object.freeze({
  chainId: 4663n,
  contractAddress: CONTRACT.toLowerCase(),
  startBlock: START,
});

const config = (overrides = {}) => ({
  identity: { ...IDENTITY, ...(overrides.identity || {}) },
  topics: overrides.topics || [...TOPICS],
  limits: { ...LIMITS, ...(overrides.limits || {}) },
});

async function rejectsCode(run, code) {
  let caught;
  try { await run(); }
  catch (error) { caught = error; }
  if (caught) {
    const error = caught;
    assert(error instanceof FinalizedObservationError);
    assert.equal(error.code, code);
    return error;
  }
  assert.fail(`expected ${code}`);
}

await test('canonical config retains block authority as decimal strings', () => {
  const normalized = normalizeFinalizedObservationConfig(config());
  assert.deepEqual(normalized.identity, {
    chainId: '4663',
    contractAddress: CONTRACT,
    startBlock: START.toString(),
  });
  assert.deepEqual(normalized.topics, TOPICS);
  assert.deepEqual(normalized.limits, {
    maxBlockSpan: '3',
    maxLogs: 4,
    maxBytes: 4096,
  });
  assert(Object.isFrozen(normalized));
  assert(Object.isFrozen(normalized.identity));
  assert(Object.isFrozen(normalized.topics));
  assert(Object.isFrozen(normalized.limits));
});

for (const [name, input, code] of [
  ['absent input', undefined, 'fo_unconfigured'],
  ['absent identity', { topics: [...TOPICS], limits: { ...LIMITS } }, 'fo_unconfigured'],
  ['absent start block', config({ identity: { startBlock: undefined } }), 'fo_unconfigured'],
  ['zero address', config({ identity: { contractAddress: `0x${'0'.repeat(40)}` } }), 'fo_unconfigured'],
  ['malformed address', config({ identity: { contractAddress: '0x1234' } }), 'fo_bad_config'],
  ['Number chain', config({ identity: { chainId: 4663 } }), 'fo_bad_config'],
  ['Number start block', config({ identity: { startBlock: Number(START) } }), 'fo_bad_config'],
  ['noncanonical chain decimal', config({ identity: { chainId: '04663' } }), 'fo_bad_config'],
  ['noncanonical start decimal', config({ identity: { startBlock: '01' } }), 'fo_bad_config'],
  ['empty topics', config({ topics: [] }), 'fo_bad_config'],
  ['unordered topics', config({ topics: [hash('2'), hash('1')] }), 'fo_bad_config'],
  ['duplicate topics', config({ topics: [hash('1'), hash('1')] }), 'fo_bad_config'],
  ['malformed topic', config({ topics: ['0x12'] }), 'fo_bad_config'],
  ['uppercase topic', config({ topics: [`0x${'A'.repeat(64)}`] }), 'fo_bad_config'],
  ['zero block span', config({ limits: { maxBlockSpan: 0n } }), 'fo_bad_config'],
  ['Number block span', config({ limits: { maxBlockSpan: 3 } }), 'fo_bad_config'],
  ['unsafe block span', config({ limits: { maxBlockSpan: 1000001n } }), 'fo_bad_config'],
  ['zero log cap', config({ limits: { maxLogs: 0 } }), 'fo_bad_config'],
  ['unsafe log cap', config({ limits: { maxLogs: 10001 } }), 'fo_bad_config'],
  ['zero byte cap', config({ limits: { maxBytes: 0 } }), 'fo_bad_config'],
  ['unsafe byte cap', config({ limits: { maxBytes: 10000001 } }), 'fo_bad_config'],
]) {
  await test(`config rejects ${name}`, () => rejectsCode(
    () => normalizeFinalizedObservationConfig(input), code));
}

const INBOX_INPUT = Object.freeze({
  chainId: 4663n,
  contractAddress: CONTRACT.toLowerCase(),
  blockHash: hash('a'),
  transactionHash: hash('b'),
  logIndex: 9007199254740995n,
});

await test('inbox identity is canonical and input-key-order independent', () => {
  const first = finalizedInboxIdentity(INBOX_INPUT);
  const reordered = finalizedInboxIdentity({
    logIndex: INBOX_INPUT.logIndex.toString(),
    transactionHash: INBOX_INPUT.transactionHash,
    blockHash: INBOX_INPUT.blockHash,
    contractAddress: CONTRACT,
    chainId: '4663',
  });
  assert.match(first, /^0x[0-9a-f]{64}$/);
  assert.equal(reordered, first);
});

for (const [name, change] of [
  ['chain', { chainId: 4664n }],
  ['contract', { contractAddress: OTHER_CONTRACT }],
  ['block hash', { blockHash: hash('c') }],
  ['transaction hash', { transactionHash: hash('d') }],
  ['log index', { logIndex: 9007199254740996n }],
]) {
  await test(`inbox identity binds ${name}`, () => {
    assert.notEqual(finalizedInboxIdentity({ ...INBOX_INPUT, ...change }),
      finalizedInboxIdentity(INBOX_INPUT));
  });
}

await test('inbox identity rejects Number indices', () => rejectsCode(
  () => finalizedInboxIdentity({ ...INBOX_INPUT, logIndex: 7 }), 'fo_bad_config'));

const blockHash = (number) => `0x${(BigInt(number) + 0xabcden).toString(16).padStart(64, '0').slice(-64)}`;
const chainBlock = (number, overrides = {}) => ({
  number: BigInt(number),
  hash: blockHash(number),
  timestamp: BigInt(number) + 1000n,
  ...overrides,
});

class FakePublicClient {
  constructor({ chainId = 4663n, finalized = START + 9n, finalTags, logs = [], readResult = 7n,
    chainError = null } = {}) {
    this.chainId = chainId;
    this.chainError = chainError;
    this.finalizedObservationRawTopics = true;
    this.finalTags = finalTags || [chainBlock(finalized), chainBlock(finalized)];
    this.logs = logs;
    this.readResult = readResult;
    this.calls = [];
    this.getBlockCalls = [];
    this.getLogsCalls = [];
    this.readContractCalls = [];
    this.tagIndex = 0;
    this.exactSequences = new Map();
    this.exactIndices = new Map();
  }

  setExact(number, sequence) {
    this.exactSequences.set(BigInt(number).toString(), sequence);
    return this;
  }

  async getChainId() {
    this.calls.push('getChainId');
    if (this.chainError) throw this.chainError;
    return this.chainId;
  }

  async getBlock(request) {
    this.calls.push(request.blockTag ? 'getBlock:finalized' : `getBlock:${String(request.blockNumber)}`);
    this.getBlockCalls.push(request);
    if (request.blockTag === 'finalized') {
      const value = this.finalTags[Math.min(this.tagIndex++, this.finalTags.length - 1)];
      if (value instanceof Error) throw value;
      return value;
    }
    const key = BigInt(request.blockNumber).toString();
    const sequence = this.exactSequences.get(key);
    if (sequence) {
      const index = this.exactIndices.get(key) || 0;
      this.exactIndices.set(key, index + 1);
      const value = sequence[Math.min(index, sequence.length - 1)];
      if (value instanceof Error) throw value;
      return value;
    }
    return chainBlock(request.blockNumber);
  }

  async getLogs(request) {
    this.calls.push('getLogs');
    this.getLogsCalls.push(request);
    return typeof this.logs === 'function' ? this.logs(request) : this.logs;
  }

  async readContract(request) {
    this.calls.push(`readContract:${request.functionName || 'unknown'}`);
    this.readContractCalls.push(request);
    if (this.readResult instanceof Error) throw this.readResult;
    return typeof this.readResult === 'function' ? this.readResult(request) : this.readResult;
  }
}

function eventLog(number, overrides = {}) {
  return {
    removed: false,
    address: CONTRACT.toLowerCase(),
    topics: [TOPICS[0]],
    data: '0x1234',
    blockNumber: BigInt(number),
    blockHash: blockHash(number),
    transactionHash: hash('b'),
    transactionIndex: 0n,
    logIndex: 0n,
    ...overrides,
  };
}

function checkpointAt(number, overrides = {}) {
  return {
    chainId: IDENTITY.chainId,
    contractAddress: IDENTITY.contractAddress,
    startBlock: IDENTITY.startBlock,
    lastAppliedBlockNumber: BigInt(number),
    lastAppliedBlockHash: blockHash(number),
    ...overrides,
  };
}

const observe = (client, overrides = {}) => observeFinalized({
  client,
  identity: { ...IDENTITY, ...(overrides.identity || {}) },
  checkpoint: overrides.checkpoint === undefined ? null : overrides.checkpoint,
  topics: overrides.topics || [...TOPICS],
  limits: { ...LIMITS, ...(overrides.limits || {}) },
  readGetters: overrides.readGetters || (async ({ readContract }, head) => ({
    value: String(await readContract({ abi: [], functionName: 'value', args: [] })),
    at: head.blockNumber,
  })),
});

await test('bootstrap scans the inclusive start and bounded N with one unpaginated read', async () => {
  const client = new FakePublicClient({ logs: [
    eventLog(START),
    eventLog(START + 1n, { transactionHash: hash('c'), logIndex: 1n }),
  ] });
  let facadeKeys;
  let facadeClient;
  let headEvidence;
  const observed = await observe(client, {
    readGetters: async (facade, head) => {
      facadeKeys = Object.keys(facade);
      facadeClient = facade.client;
      headEvidence = head;
      return { z: 'last', value: String(await facade.readContract({
        abi: [], functionName: 'value', args: [],
      })), a: { y: '2', x: '1' } };
    },
  });
  const target = START + 2n;
  assert.deepEqual(client.getLogsCalls, [{
    address: CONTRACT,
    fromBlock: START,
    toBlock: target,
    topics: [[...TOPICS]],
  }]);
  assert.deepEqual(facadeKeys, ['readContract']);
  assert.equal(facadeClient, undefined);
  assert(Object.isFrozen(headEvidence));
  assert.deepEqual(client.readContractCalls, [{
    abi: [], functionName: 'value', args: [], address: CONTRACT, blockNumber: target,
  }]);
  assert.deepEqual(observed.identity, {
    chainId: '4663', contractAddress: CONTRACT, startBlock: START.toString(),
  });
  assert.equal(observed.checkpointBase, null);
  assert.deepEqual(observed.range, { fromBlock: START.toString(), toBlock: target.toString() });
  assert.equal(observed.head.blockNumber, target.toString());
  assert.equal(observed.finalizedHorizon.blockNumber, (START + 9n).toString());
  assert.equal(observed.caughtUp, false);
  assert.equal(observed.logs[0].blockNumber, START.toString());
  assert.equal(observed.logs[1].logIndex, '1');
  assert.match(observed.evidenceHash, /^0x[0-9a-f]{64}$/);
  assert(Object.isFrozen(observed));
  assert(Object.isFrozen(observed.logs));
  assert(Object.isFrozen(observed.logs[0]));
  assert(Object.isFrozen(observed.getters));
  assert.equal(client.getBlockCalls.filter((call) => call.blockNumber === START).length, 1,
    'the first unique event block hash is fetched once');
  assert.equal(client.getBlockCalls.filter((call) => call.blockNumber === START + 1n).length, 1,
    'the second unique event block hash is fetched once');
});

await test('subsequent range is exactly checkpoint plus one through bounded N', async () => {
  const base = START + 2n;
  const client = new FakePublicClient({ logs: [eventLog(base + 1n)] });
  const observed = await observe(client, { checkpoint: checkpointAt(base) });
  assert.deepEqual(observed.checkpointBase, {
    lastAppliedBlockNumber: base.toString(), lastAppliedBlockHash: blockHash(base),
    lastObservationHash: null,
  });
  assert.deepEqual(observed.range, {
    fromBlock: (base + 1n).toString(), toBlock: (base + 3n).toString(),
  });
  assert.deepEqual(client.getLogsCalls[0], {
    address: CONTRACT, fromBlock: base + 1n, toBlock: base + 3n, topics: [[...TOPICS]],
  });
});

await test('bounded target equals finalized horizon only when caught up', async () => {
  const finalized = START + 1n;
  const client = new FakePublicClient({ finalized, logs: [] });
  const observed = await observe(client);
  assert.equal(observed.head.blockNumber, finalized.toString());
  assert.equal(observed.finalizedHorizon.blockNumber, finalized.toString());
  assert.equal(observed.caughtUp, true);
});

await test('natural finalized-tag advancement preserves the original coherent horizon', async () => {
  const finalized = START + 1n;
  const later = finalized + 2n;
  const client = new FakePublicClient({
    finalized,
    finalTags: [chainBlock(finalized), chainBlock(later)],
    logs: [],
  });
  const observed = await observe(client);
  assert.equal(observed.finalizedHorizon.blockNumber, finalized.toString());
  assert.equal(observed.head.blockNumber, finalized.toString());
  assert.equal(observed.caughtUp, true);
});

await test('an exact no-work checkpoint omits the log RPC', async () => {
  const finalized = START + 5n;
  const client = new FakePublicClient({ finalized, logs: () => { throw new Error('unexpected logs'); } });
  const observed = await observe(client, { checkpoint: checkpointAt(finalized) });
  assert.equal(observed.range, null);
  assert.deepEqual(observed.logs, []);
  assert.equal(client.getLogsCalls.length, 0);
  assert.equal(observed.caughtUp, true);
});

await test('wrong live chain rejects before head or payload reads', async () => {
  const client = new FakePublicClient({ chainId: 1n });
  await rejectsCode(() => observe(client), 'fo_wrong_chain');
  assert.deepEqual(client.calls, ['getChainId']);
});

await test('unwrapped viem clients without the raw-topic capability fail before RPC', async () => {
  const client = new FakePublicClient({ logs: [] });
  delete client.finalizedObservationRawTopics;
  await rejectsCode(() => observe(client), 'fo_bad_config');
  assert.deepEqual(client.calls, []);
});

await test('viem Number chain result is immediately canonicalized without entering evidence', async () => {
  const client = new FakePublicClient({ chainId: 4663, logs: [] });
  const observed = await observe(client, { readGetters: async () => ({}) });
  assert.equal(observed.identity.chainId, '4663');
  assert.equal(typeof observed.identity.chainId, 'string');
});

await test('missing finalized head identity is unavailable', async () => {
  const client = new FakePublicClient({ finalTags: [null] });
  await rejectsCode(() => observe(client), 'fo_head_unavailable');
  assert.equal(client.getLogsCalls.length, 0);
});

await test('checkpoint identity mismatch rejects before RPC', async () => {
  const client = new FakePublicClient();
  await rejectsCode(() => observe(client, {
    checkpoint: checkpointAt(START, { chainId: 1n }),
  }), 'fo_checkpoint_identity');
  assert.deepEqual(client.calls, []);
});

await test('checkpoint hash mismatch rejects before scanning', async () => {
  const base = START + 2n;
  const client = new FakePublicClient();
  client.setExact(base, [chainBlock(base, { hash: hash('e') })]);
  await rejectsCode(() => observe(client, { checkpoint: checkpointAt(base) }), 'fo_checkpoint_reorg');
  assert.equal(client.getLogsCalls.length, 0);
});

await test('finalized head behind the checkpoint rejects as a regression', async () => {
  const base = START + 5n;
  const client = new FakePublicClient({ finalized: START + 4n });
  await rejectsCode(() => observe(client, { checkpoint: checkpointAt(base) }), 'fo_head_regression');
  assert.equal(client.getLogsCalls.length, 0);
});

await test('provider causes stay non-enumerable and secret-safe', async () => {
  const cause = new Error('https://rpc.invalid/?secret=top-secret request={private}');
  const client = new FakePublicClient({ chainError: cause });
  const error = await rejectsCode(() => observe(client), 'fo_rpc_unavailable');
  assert.equal(error.cause, cause);
  assert.equal(Object.prototype.propertyIsEnumerable.call(error, 'cause'), false);
  assert.doesNotMatch(error.message, /rpc\.invalid|secret|private/i);
  assert.doesNotMatch(JSON.stringify(error), /rpc\.invalid|secret|private/i);
});

for (const [name, makeLogs, code] of [
  ['removed log', () => [eventLog(START, { removed: true })], 'fo_log_removed'],
  ['wrong address', () => [eventLog(START, { address: OTHER_CONTRACT })], 'fo_log_address'],
  ['wrong topic0', () => [eventLog(START, { topics: [hash('3')] })], 'fo_log_topic'],
  ['missing topic0', () => [eventLog(START, { topics: [] })], 'fo_log_topic'],
  ['malformed later topic', () => [eventLog(START, { topics: [TOPICS[0], '0x12'] })], 'fo_log_identity'],
  ['below-range block', () => [eventLog(START - 1n)], 'fo_log_range'],
  ['above-range block', () => [eventLog(START + 3n)], 'fo_log_range'],
  ['missing block hash', () => [eventLog(START, { blockHash: undefined })], 'fo_log_identity'],
  ['missing transaction hash', () => [eventLog(START, { transactionHash: undefined })], 'fo_log_identity'],
  ['Number block', () => [eventLog(START, { blockNumber: Number(START) })], 'fo_log_identity'],
  ['Number transaction index', () => [eventLog(START, { transactionIndex: 0 })], 'fo_log_identity'],
  ['Number log index', () => [eventLog(START, { logIndex: 0 })], 'fo_log_identity'],
  ['malformed data', () => [eventLog(START, { data: '0x123' })], 'fo_log_identity'],
  ['unordered logs', () => [eventLog(START + 1n), eventLog(START)], 'fo_log_order'],
  ['duplicate log identity', () => [eventLog(START), eventLog(START)], 'fo_log_duplicate'],
  ['conflicting duplicate identity', () => [eventLog(START), eventLog(START, { data: '0xabcd' })], 'fo_log_duplicate'],
]) {
  await test(`log validation rejects ${name}`, async () => {
    const client = new FakePublicClient({ logs: makeLogs() });
    await rejectsCode(() => observe(client, { readGetters: async () => ({}) }), code);
  });
}

await test('log count beyond the hard cap fails closed', async () => {
  const logs = Array.from({ length: LIMITS.maxLogs + 1 }, (_, index) => eventLog(START, {
    transactionHash: hash(String(index + 1)),
    transactionIndex: BigInt(index),
    logIndex: BigInt(index),
  }));
  const client = new FakePublicClient({ logs });
  await rejectsCode(() => observe(client, { readGetters: async () => ({}) }), 'fo_work_oversized');
});

await test('serialized log bytes beyond the hard cap fail closed', async () => {
  const client = new FakePublicClient({ logs: [eventLog(START, { data: `0x${'ab'.repeat(1000)}` })] });
  await rejectsCode(() => observe(client, {
    limits: { maxBytes: 300 }, readGetters: async () => ({}),
  }), 'fo_work_oversized');
});

await test('a provider truncation signal rejects the response as a range gap', async () => {
  const truncated = [];
  truncated.truncated = true;
  const client = new FakePublicClient({ logs: truncated });
  await rejectsCode(() => observe(client, { readGetters: async () => ({}) }), 'fo_range_gap');
});

await test('a non-array paginated response rejects rather than guessing completeness', async () => {
  const client = new FakePublicClient({ logs: { logs: [], nextPage: 'secret-cursor' } });
  await rejectsCode(() => observe(client, { readGetters: async () => ({}) }), 'fo_range_gap');
});

await test('every unique event block is independently checked and cached', async () => {
  const client = new FakePublicClient({ logs: [
    eventLog(START),
    eventLog(START, { transactionHash: hash('c'), logIndex: 1n }),
    eventLog(START + 1n, { transactionHash: hash('d'), transactionIndex: 1n }),
  ] });
  await observe(client, { readGetters: async () => ({}) });
  assert.equal(client.getBlockCalls.filter((call) => call.blockNumber === START).length, 1);
  assert.equal(client.getBlockCalls.filter((call) => call.blockNumber === START + 1n).length, 1);
});

await test('an event block hash mismatch fails closed', async () => {
  const client = new FakePublicClient({ logs: [eventLog(START, { blockHash: hash('f') })] });
  await rejectsCode(() => observe(client, { readGetters: async () => ({}) }), 'fo_log_block_hash');
});

await test('an unavailable event block identity fails closed', async () => {
  const client = new FakePublicClient({ logs: [eventLog(START)] });
  client.setExact(START, [null]);
  await rejectsCode(() => observe(client, { readGetters: async () => ({}) }), 'fo_log_block_hash');
});

await test('a missing exact target before payload work is unavailable', async () => {
  const target = START + 2n;
  const client = new FakePublicClient({ logs: [] }).setExact(target, [null]);
  await rejectsCode(() => observe(client), 'fo_head_unavailable');
  assert.equal(client.getLogsCalls.length, 0);
});

await test('an exact target returning another height mismatches before payload work', async () => {
  const target = START + 2n;
  const client = new FakePublicClient({ logs: [] })
    .setExact(target, [chainBlock(target + 1n)]);
  await rejectsCode(() => observe(client), 'fo_head_mismatch');
  assert.equal(client.getLogsCalls.length, 0);
});

await test('target hash drift immediately after the log RPC is rejected', async () => {
  const target = START + 2n;
  const client = new FakePublicClient({ logs: [] }).setExact(target, [
    chainBlock(target), chainBlock(target, { hash: hash('e') }),
  ]);
  await rejectsCode(() => observe(client, { readGetters: async () => ({}) }), 'fo_head_mismatch');
  assert.equal(client.getLogsCalls.length, 1);
});

await test('target hash drift after a getter RPC is rejected', async () => {
  const target = START + 2n;
  const client = new FakePublicClient({ logs: [] }).setExact(target, [
    chainBlock(target), chainBlock(target), chainBlock(target, { hash: hash('e') }),
  ]);
  await rejectsCode(() => observe(client), 'fo_head_mismatch');
  assert.equal(client.readContractCalls.length, 1);
});

await test('target hash drift after a getter-free callback is rejected by the final bracket', async () => {
  const target = START + 2n;
  const client = new FakePublicClient({ logs: [] }).setExact(target, [
    chainBlock(target), chainBlock(target), chainBlock(target, { hash: hash('e') }),
  ]);
  await rejectsCode(() => observe(client, { readGetters: async () => ({ ok: true }) }), 'fo_head_mismatch');
});

await test('the original finalized horizon exact hash is rechecked at the final bracket', async () => {
  const horizon = START + 9n;
  const client = new FakePublicClient({ logs: [] }).setExact(horizon, [
    chainBlock(horizon), chainBlock(horizon, { hash: hash('e') }),
  ]);
  await rejectsCode(() => observe(client, { readGetters: async () => ({}) }), 'fo_head_mismatch');
});

await test('the final finalized tag cannot regress below the bounded target', async () => {
  const horizon = START + 9n;
  const target = START + 2n;
  const client = new FakePublicClient({
    finalized: horizon,
    finalTags: [chainBlock(horizon), chainBlock(target - 1n)],
    logs: [],
  });
  await rejectsCode(() => observe(client, { readGetters: async () => ({}) }), 'fo_head_regression');
});

await test('the final finalized tag at the same height cannot change hash', async () => {
  const horizon = START + 9n;
  const client = new FakePublicClient({
    finalized: horizon,
    finalTags: [chainBlock(horizon), chainBlock(horizon, { hash: hash('e') })],
    logs: [],
  });
  await rejectsCode(() => observe(client, { readGetters: async () => ({}) }), 'fo_head_mismatch');
});

for (const forbidden of [
  { address: CONTRACT },
  { address: OTHER_CONTRACT },
  { blockNumber: START + 2n },
  { blockHash: hash('f') },
  { blockTag: 'latest' },
  { stateOverride: [] },
  { blockOverrides: { number: START + 2n } },
  { account: CONTRACT },
  { authorizationList: [] },
  { factory: OTHER_CONTRACT },
  { factoryData: '0x' },
  { code: '0x00' },
  { gas: 1n },
  { value: 1n },
  { nonce: 1n },
  { chain: { id: '4663' } },
  { futureExecutionContext: true },
]) {
  await test(`pinned getter refuses override ${Object.keys(forbidden)[0]}`, async () => {
    const client = new FakePublicClient({ logs: [] });
    await rejectsCode(() => observe(client, {
      readGetters: ({ readContract }) => readContract({
        abi: [], functionName: 'value', ...forbidden,
      }),
    }), 'fo_bad_config');
    assert.equal(client.readContractCalls.length, 0);
  });
}

await test('pinned getter rejects non-enumerable and symbol request capabilities', async () => {
  for (const request of [
    Object.defineProperty({ abi: [], functionName: 'value' }, 'gas', { value: 1n }),
    Object.assign({ abi: [], functionName: 'value' }, { [Symbol('capability')]: () => true }),
  ]) {
    const client = new FakePublicClient({ logs: [] });
    await rejectsCode(() => observe(client, {
      readGetters: ({ readContract }) => readContract(request),
    }), 'fo_bad_config');
    assert.equal(client.readContractCalls.length, 0);
  }
});

for (const [name, args] of [
  ['Number argument', [1]],
  ['function argument', [() => true]],
  ['sparse arguments', Array(1)],
]) {
  await test(`pinned getter rejects capability-bearing ${name}`, async () => {
    const client = new FakePublicClient({ logs: [] });
    await rejectsCode(() => observe(client, {
      readGetters: ({ readContract }) => readContract({ abi: [], functionName: 'value', args }),
    }), 'fo_bad_config');
    assert.equal(client.readContractCalls.length, 0);
  });
}

await test('pinned getter forwards only fresh copied ABI, function name, and BigInt arguments', async () => {
  const abi = [{
    type: 'function', name: 'value', stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }],
  }];
  const args = [1n];
  const client = new FakePublicClient({
    logs: [],
    readResult: (request) => {
      assert.notEqual(request.abi, abi);
      assert.notEqual(request.abi[0], abi[0]);
      assert.notEqual(request.args, args);
      assert.deepEqual(Reflect.ownKeys(request).sort(),
        ['abi', 'address', 'args', 'blockNumber', 'functionName'].sort());
      return 7n;
    },
  });
  await observe(client, {
    readGetters: async ({ readContract }) => ({
      value: String(await readContract({ abi, functionName: 'value', args })),
    }),
  });
});

await test('pinned getter facade rechecks the target after every read', async () => {
  const target = START + 2n;
  const client = new FakePublicClient({ logs: [] });
  await observe(client, {
    readGetters: async ({ readContract }) => ({
      first: String(await readContract({ abi: [], functionName: 'first' })),
      second: String(await readContract({ abi: [], functionName: 'second' })),
    }),
  });
  assert.equal(client.readContractCalls.length, 2);
  assert(client.readContractCalls.every((call) => call.address === CONTRACT && call.blockNumber === target));
  assert(client.getBlockCalls.filter((call) => call.blockNumber === target).length >= 5,
    'initial, post-log, per-getter, and final target checks all remain pinned');
});

await test('getter provider failures use a secret-safe stable category', async () => {
  const cause = new Error('provider payload secret=private');
  const client = new FakePublicClient({ logs: [], readResult: cause });
  const error = await rejectsCode(() => observe(client), 'fo_rpc_unavailable');
  assert.equal(error.cause, cause);
  assert.doesNotMatch(error.message, /secret|private/i);
});

for (const [name, result] of [
  ['function', { value: () => true }],
  ['BigInt', { value: 1n }],
  ['Number', { value: 1 }],
  ['undefined', { value: undefined }],
]) {
  await test(`getter evidence rejects ${name}`, async () => {
    const client = new FakePublicClient({ logs: [] });
    await rejectsCode(() => observe(client, { readGetters: async () => result }), 'fo_bad_config');
  });
}

await test('getter evidence rejects cycles', async () => {
  const cycle = {};
  cycle.self = cycle;
  const client = new FakePublicClient({ logs: [] });
  await rejectsCode(() => observe(client, { readGetters: async () => cycle }), 'fo_bad_config');
});

await test('getter evidence rejects enumerable accessors without invoking them', async () => {
  let reads = 0;
  const evidence = Object.defineProperty({}, 'value', {
    enumerable: true,
    get() { reads++; return 'live'; },
  });
  const client = new FakePublicClient({ logs: [] });
  await rejectsCode(() => observe(client, { readGetters: async () => evidence }), 'fo_bad_config');
  assert.equal(reads, 0);
});

await test('getter evidence rejects symbol and non-enumerable properties', async () => {
  for (const evidence of [
    Object.assign({ value: 'visible' }, { [Symbol('capability')]: { live: true } }),
    Object.defineProperty({ value: 'visible' }, 'hidden', { value: 'unhashed' }),
  ]) {
    const client = new FakePublicClient({ logs: [] });
    await rejectsCode(() => observe(client, { readGetters: async () => evidence }), 'fo_bad_config');
  }
});

await test('getter evidence rejects sparse arrays instead of hashing them like dense arrays', async () => {
  const sparse = Array(1);
  const dense = [];
  const sparseClient = new FakePublicClient({ logs: [] });
  await rejectsCode(() => observe(sparseClient, { readGetters: async () => sparse }), 'fo_bad_config');
  const denseObservation = await observe(new FakePublicClient({ logs: [] }), {
    readGetters: async () => dense,
  });
  assert.deepEqual(denseObservation.getters, []);
});

await test('getter evidence turns a benign Proxy descriptor view into inert copied data', async () => {
  const target = { nested: { value: 'before' } };
  const proxy = new Proxy(target, {});
  const observed = await observe(new FakePublicClient({ logs: [] }), {
    readGetters: async () => proxy,
  });
  assert.notEqual(observed.getters, proxy);
  assert.notEqual(observed.getters.nested, target.nested);
  target.nested.value = 'after';
  assert.equal(observed.getters.nested.value, 'before');
});

await test('getter evidence accepts and freshly snapshots null-prototype data objects', async () => {
  const source = Object.assign(Object.create(null), { value: 'fixed' });
  const observed = await observe(new FakePublicClient({ logs: [] }), {
    readGetters: async () => source,
  });
  assert.notEqual(observed.getters, source);
  assert.equal(Object.getPrototypeOf(observed.getters), null);
  assert.equal(observed.getters.value, 'fixed');
});

await test('getter evidence fails closed and safely when Proxy descriptor inspection throws', async () => {
  const cause = new Error('proxy trap secret=private');
  const proxy = new Proxy({}, { ownKeys() { throw cause; } });
  const client = new FakePublicClient({ logs: [] });
  const error = await rejectsCode(
    () => observe(client, { readGetters: async () => proxy }), 'fo_bad_config');
  assert.equal(error.cause, cause);
  assert.doesNotMatch(error.message, /secret|private/i);
});

await test('retained callback data cannot mutate or grow after the snapshot byte check', async () => {
  const source = { value: 'before' };
  const client = new FakePublicClient({ logs: [] });
  const getBlock = client.getBlock.bind(client);
  client.getBlock = async (request) => {
    if (request.blockTag === 'finalized' && client.tagIndex === 1) source.value = 'x'.repeat(1000);
    return getBlock(request);
  };
  const observed = await observe(client, {
    limits: { maxBytes: 64 },
    readGetters: async () => source,
  });
  assert.notEqual(observed.getters, source);
  assert.deepEqual(observed.getters, { value: 'before' });
  assert(Buffer.byteLength(JSON.stringify(observed.getters)) <= 64);
});

await test('getter evidence is bounded by the configured byte cap', async () => {
  const client = new FakePublicClient({ logs: [] });
  await rejectsCode(() => observe(client, {
    limits: { maxBytes: 100 },
    readGetters: async () => ({ value: 'x'.repeat(1000) }),
  }), 'fo_work_oversized');
});

await test('normalized evidence hash is independent of object key order', async () => {
  const firstLog = eventLog(START);
  const reorderedLog = {
    logIndex: firstLog.logIndex,
    transactionIndex: firstLog.transactionIndex,
    transactionHash: firstLog.transactionHash,
    blockHash: firstLog.blockHash,
    blockNumber: firstLog.blockNumber,
    data: firstLog.data,
    topics: firstLog.topics,
    address: firstLog.address,
    removed: firstLog.removed,
  };
  const first = await observe(new FakePublicClient({ logs: [firstLog] }), {
    readGetters: async () => ({ b: '2', a: { y: '2', x: '1' } }),
  });
  const second = await observe(new FakePublicClient({ logs: [reorderedLog] }), {
    readGetters: async () => ({ a: { x: '1', y: '2' }, b: '2' }),
  });
  assert.equal(first.evidenceHash, second.evidenceHash);
});

await test('changing normalized log evidence changes the evidence hash', async () => {
  const first = await observe(new FakePublicClient({ logs: [eventLog(START)] }), {
    readGetters: async () => ({}),
  });
  const second = await observe(new FakePublicClient({ logs: [eventLog(START, { data: '0xabcd' })] }), {
    readGetters: async () => ({}),
  });
  assert.notEqual(first.evidenceHash, second.evidenceHash);
});

await test('deeply immutable evidence rejects nested mutation', async () => {
  const observed = await observe(new FakePublicClient({ logs: [eventLog(START)] }), {
    readGetters: async () => ({ nested: { value: 'fixed' } }),
  });
  assert.throws(() => observed.logs.push(eventLog(START)));
  assert.throws(() => { observed.getters.nested.value = 'changed'; });
  assert.equal(observed.getters.nested.value, 'fixed');
});

await test('module import does not fall back to environment configuration', async () => {
  const before = process.env.FINALIZED_OBSERVATION_CHAIN_ID;
  process.env.FINALIZED_OBSERVATION_CHAIN_ID = '1';
  try {
    const fresh = await import(`../src/finalizedobservation.js?no-env=${Date.now()}`);
    let error;
    try { fresh.normalizeFinalizedObservationConfig(undefined); }
    catch (caught) { error = caught; }
    assert.equal(error?.code, 'fo_unconfigured');
  } finally {
    if (before === undefined) delete process.env.FINALIZED_OBSERVATION_CHAIN_ID;
    else process.env.FINALIZED_OBSERVATION_CHAIN_ID = before;
  }
});

const TEST_CONSUMER_SCHEMA = `
  CREATE TABLE fo_checkpoint_test (
    id INTEGER PRIMARY KEY CHECK (id=1),
    chain_id NUMERIC(78,0) NOT NULL,
    contract_address TEXT NOT NULL,
    start_block NUMERIC(78,0) NOT NULL,
    last_applied_block_number NUMERIC(78,0),
    last_applied_block_hash TEXT,
    last_observation_hash TEXT,
    finalized_horizon_number NUMERIC(78,0),
    finalized_horizon_hash TEXT,
    caught_up BOOLEAN NOT NULL DEFAULT false,
    verified_at TIMESTAMPTZ
  );
  CREATE TABLE fo_inbox_test (
    identity TEXT PRIMARY KEY,
    payload TEXT NOT NULL
  );
  CREATE TABLE fo_domain_test (
    identity TEXT PRIMARY KEY,
    payload TEXT NOT NULL
  );
`;

await test('test-local concrete consumer schema is independently executable', async () => {
  const memory = newDb();
  const { Pool } = memory.adapters.createPg();
  const pool = new Pool();
  try {
    await pool.query(TEST_CONSUMER_SCHEMA);
    for (const table of ['fo_checkpoint_test', 'fo_inbox_test', 'fo_domain_test']) {
      assert.deepEqual((await pool.query(`SELECT COUNT(*)::INT AS count FROM ${table}`)).rows,
        [{ count: 0 }]);
    }
  } finally { await pool.end(); }
});

function cloneConsumerState(state) {
  return {
    checkpoint: { ...state.checkpoint },
    inbox: new Map([...state.inbox].map(([key, value]) => [key, { ...value }])),
    domain: new Map([...state.domain].map(([key, value]) => [key, { ...value }])),
  };
}

class AtomicTestPool {
  constructor(trace = []) {
    this.trace = trace;
    this.connectCount = 0;
    this.releaseCount = 0;
    this.rollbackCount = 0;
    this.verificationCount = 0;
    this.owner = null;
    this.waiters = [];
    this.state = {
      checkpoint: {
        id: 1,
        chain_id: '4663',
        contract_address: CONTRACT,
        start_block: START.toString(),
        last_applied_block_number: null,
        last_applied_block_hash: null,
        last_observation_hash: null,
        finalized_horizon_number: null,
        finalized_horizon_hash: null,
        caught_up: false,
        verified_at: null,
      },
      inbox: new Map(),
      domain: new Map(),
    };
  }

  async connect() {
    this.connectCount++;
    this.trace.push('connect');
    return new AtomicTestClient(this);
  }

  async acquire(client) {
    if (!this.owner) {
      this.owner = client;
      client.tx = cloneConsumerState(this.state);
      return;
    }
    await new Promise((resolve) => this.waiters.push({ client, resolve }));
    client.tx = cloneConsumerState(this.state);
  }

  unlock(client) {
    if (this.owner !== client) return;
    this.owner = null;
    const next = this.waiters.shift();
    if (next) {
      this.owner = next.client;
      next.resolve();
    }
  }

  snapshot() {
    return {
      checkpoint: { ...this.state.checkpoint },
      inbox: [...this.state.inbox.entries()],
      domain: [...this.state.domain.entries()],
    };
  }
}

class AtomicTestClient {
  constructor(pool) {
    this.pool = pool;
    this.active = false;
    this.tx = null;
    this.released = false;
  }

  async query(statement, params = []) {
    const sql = String(statement).replace(/\s+/g, ' ').trim();
    if (sql === 'BEGIN') {
      assert.equal(this.active, false);
      this.active = true;
      this.pool.trace.push('BEGIN');
      return { rows: [] };
    }
    if (sql === 'COMMIT') {
      assert(this.active && this.tx);
      this.pool.trace.push('COMMIT');
      this.pool.state = cloneConsumerState(this.tx);
      this.active = false;
      this.tx = null;
      this.pool.unlock(this);
      return { rows: [] };
    }
    if (sql === 'ROLLBACK') {
      this.pool.trace.push('ROLLBACK');
      this.pool.rollbackCount++;
      this.active = false;
      this.tx = null;
      this.pool.unlock(this);
      return { rows: [] };
    }
    assert(this.active, `query outside transaction: ${sql}`);
    if (/FROM fo_checkpoint_test WHERE id=1 FOR UPDATE/i.test(sql)) {
      if (!this.tx) await this.pool.acquire(this);
      return { rows: [{ ...this.tx.checkpoint }] };
    }
    assert(this.tx, `consumer query before checkpoint lock: ${sql}`);
    if (/SELECT payload FROM fo_inbox_test/i.test(sql)) {
      const row = this.tx.inbox.get(params[0]);
      return { rows: row ? [{ payload: row.payload }] : [] };
    }
    if (/INSERT INTO fo_inbox_test/i.test(sql)) {
      if (this.tx.inbox.has(params[0])) throw new Error('test inbox primary key conflict');
      this.tx.inbox.set(params[0], { payload: params[1] });
      return { rows: [] };
    }
    if (/INSERT INTO fo_domain_test/i.test(sql)) {
      if (!this.tx.domain.has(params[0])) this.tx.domain.set(params[0], { payload: params[1] });
      return { rows: [] };
    }
    if (/UPDATE fo_checkpoint_test/i.test(sql)) {
      Object.assign(this.tx.checkpoint, {
        last_applied_block_number: params[0],
        last_applied_block_hash: params[1],
        last_observation_hash: params[2],
        finalized_horizon_number: params[3],
        finalized_horizon_hash: params[4],
        caught_up: params[5],
        verified_at: `test-db-time-${++this.pool.verificationCount}`,
      });
      return { rows: [] };
    }
    if (/SELECT \* FROM fo_checkpoint_test WHERE id=1$/i.test(sql)) {
      return { rows: [{ ...this.tx.checkpoint }] };
    }
    if (/SELECT COUNT\(\*\)::INT AS count FROM fo_inbox_test/i.test(sql)) {
      return { rows: [{ count: this.tx.inbox.size }] };
    }
    if (/SELECT COUNT\(\*\)::INT AS count FROM fo_domain_test/i.test(sql)) {
      return { rows: [{ count: this.tx.domain.size }] };
    }
    throw new Error(`unexpected test consumer SQL: ${sql}`);
  }

  release() {
    assert.equal(this.released, false);
    this.released = true;
    this.pool.releaseCount++;
    this.pool.trace.push('release');
  }
}

function adapterFor({ trace = [], failAt = null, failure = null } = {}) {
  const maybeFail = (point) => {
    if (failAt === point) throw failure || new Error(`unsafe adapter secret at ${point}`);
  };
  return {
    async lockAndReadCheckpoint(client) {
      trace.push('lock');
      const row = (await client.query('SELECT * FROM fo_checkpoint_test WHERE id=1 FOR UPDATE')).rows[0];
      return {
        chainId: String(row.chain_id),
        contractAddress: row.contract_address,
        startBlock: String(row.start_block),
        lastAppliedBlockNumber: row.last_applied_block_number == null
          ? null : String(row.last_applied_block_number),
        lastAppliedBlockHash: row.last_applied_block_hash,
        lastObservationHash: row.last_observation_hash,
      };
    },
    async insertOrVerifyInbox(client, observation) {
      trace.push('inbox');
      for (const log of observation.logs) {
        const identity = finalizedInboxIdentity({
          chainId: observation.identity.chainId,
          contractAddress: observation.identity.contractAddress,
          blockHash: log.blockHash,
          transactionHash: log.transactionHash,
          logIndex: log.logIndex,
        });
        const payload = JSON.stringify(log);
        const existing = (await client.query(
          'SELECT payload FROM fo_inbox_test WHERE identity=$1', [identity])).rows[0];
        if (existing && existing.payload !== payload) {
          throw new FinalizedObservationError('fo_log_duplicate', 'conflicting finalized inbox identity');
        }
        if (!existing) await client.query(
          'INSERT INTO fo_inbox_test(identity,payload) VALUES($1,$2)', [identity, payload]);
      }
      maybeFail('afterInbox');
    },
    async applyDomainState(client, observation) {
      trace.push('apply');
      for (const log of observation.logs) {
        const identity = finalizedInboxIdentity({
          chainId: observation.identity.chainId,
          contractAddress: observation.identity.contractAddress,
          blockHash: log.blockHash,
          transactionHash: log.transactionHash,
          logIndex: log.logIndex,
        });
        await client.query('INSERT INTO fo_domain_test(identity,payload) VALUES($1,$2)',
          [identity, JSON.stringify(log)]);
        maybeFail('duringApply');
      }
      maybeFail('duringApply');
    },
    async advanceCheckpoint(client, observation) {
      trace.push('advance');
      maybeFail('beforeAdvance');
      await client.query(
        `UPDATE fo_checkpoint_test
            SET last_applied_block_number=$1,last_applied_block_hash=$2,
                last_observation_hash=$3,
                finalized_horizon_number=$4,finalized_horizon_hash=$5,caught_up=$6,
                verified_at=now() WHERE id=1`,
        [observation.head.blockNumber, observation.head.blockHash, observation.evidenceHash,
          observation.finalizedHorizon.blockNumber, observation.finalizedHorizon.blockHash,
          observation.caughtUp]);
    },
    async readCommittedResult(client) {
      trace.push('result');
      const checkpoint = (await client.query('SELECT * FROM fo_checkpoint_test WHERE id=1')).rows[0];
      const inbox = (await client.query(
        'SELECT COUNT(*)::INT AS count FROM fo_inbox_test')).rows[0].count;
      const domain = (await client.query(
        'SELECT COUNT(*)::INT AS count FROM fo_domain_test')).rows[0].count;
      return { checkpoint, inbox, domain };
    },
  };
}

const transactionObservation = () => observe(new FakePublicClient({
  finalized: START + 1n,
  logs: [eventLog(START)],
}), { readGetters: async () => ({ version: '1' }) });

await test('all RPC finishes before pool connection and BEGIN', async () => {
  const trace = [];
  const client = new FakePublicClient({
    finalized: START + 1n,
    logs: () => { trace.push('rpc:getLogs'); return [eventLog(START)]; },
    readResult: () => { trace.push('rpc:readContract'); return 1n; },
  });
  const observation = await observe(client);
  trace.push('rpc:complete');
  const pool = new AtomicTestPool(trace);
  await commitFinalizedObservation(pool, observation, adapterFor({ trace }));
  assert(trace.indexOf('rpc:complete') < trace.indexOf('connect'));
  assert(trace.indexOf('connect') < trace.indexOf('BEGIN'));
});

await test('coordinator owns one transaction and invokes the adapter in fixed order', async () => {
  const observation = await transactionObservation();
  const trace = [];
  const pool = new AtomicTestPool(trace);
  const result = await commitFinalizedObservation(pool, observation, adapterFor({ trace }));
  assert.deepEqual(trace, [
    'connect', 'BEGIN', 'lock', 'inbox', 'apply', 'advance', 'result', 'COMMIT', 'release',
  ]);
  assert.equal(pool.connectCount, 1);
  assert.equal(pool.releaseCount, 1);
  assert.equal(result.inbox, 1);
  assert.equal(result.domain, 1);
  assert.equal(pool.state.checkpoint.last_applied_block_number, observation.head.blockNumber);
  assert.equal(pool.state.checkpoint.finalized_horizon_number,
    observation.finalizedHorizon.blockNumber);
  assert.equal(pool.state.checkpoint.caught_up, true);
  assert.equal(pool.state.checkpoint.verified_at, 'test-db-time-1');
});

for (const failAt of ['afterInbox', 'duringApply', 'beforeAdvance']) {
  await test(`crash ${failAt} rolls back inbox, domain state, and checkpoint`, async () => {
    const observation = await transactionObservation();
    const pool = new AtomicTestPool();
    const before = pool.snapshot();
    await assert.rejects(() => commitFinalizedObservation(
      pool, observation, adapterFor({ failAt })), /consumer|failed/i);
    assert.deepEqual(pool.snapshot(), before);
    assert.equal(pool.rollbackCount, 1);
    assert.equal(pool.releaseCount, 1);
  });
}

await test('same immutable observation replays exact inbox evidence without reapplying domain state', async () => {
  const observation = await transactionObservation();
  const pool = new AtomicTestPool();
  await commitFinalizedObservation(pool, observation, adapterFor());
  const replayTrace = [];
  const replayed = await commitFinalizedObservation(pool, observation, adapterFor({ trace: replayTrace }));
  assert.deepEqual(replayTrace, ['lock', 'result']);
  assert.equal(replayed.inbox, 1);
  assert.equal(replayed.domain, 1);
  assert.equal(pool.state.domain.size, 1);
});

await test('same-head A then A+B fails before committing an inbox-only alternative', async () => {
  const first = await observe(new FakePublicClient({
    finalized: START + 1n,
    logs: [eventLog(START)],
  }), { readGetters: async () => ({ version: '1' }) });
  const alternative = await observe(new FakePublicClient({
    finalized: START + 1n,
    logs: [eventLog(START), eventLog(START + 1n, { transactionHash: hash('c') })],
  }), { readGetters: async () => ({ version: '1' }) });
  const pool = new AtomicTestPool();
  await commitFinalizedObservation(pool, first, adapterFor());
  const before = pool.snapshot();
  const trace = [];
  await rejectsCode(
    () => commitFinalizedObservation(pool, alternative, adapterFor({ trace })),
    'fo_checkpoint_advanced');
  assert.deepEqual(trace, ['lock']);
  assert.deepEqual(pool.snapshot(), before);
});

await test('same-head A+B then subset A is not exact replay', async () => {
  const first = await observe(new FakePublicClient({
    finalized: START + 1n,
    logs: [eventLog(START), eventLog(START + 1n, { transactionHash: hash('c') })],
  }), { readGetters: async () => ({ version: '1' }) });
  const subset = await observe(new FakePublicClient({
    finalized: START + 1n,
    logs: [eventLog(START)],
  }), { readGetters: async () => ({ version: '1' }) });
  const pool = new AtomicTestPool();
  await commitFinalizedObservation(pool, first, adapterFor());
  const before = pool.snapshot();
  const trace = [];
  await rejectsCode(() => commitFinalizedObservation(pool, subset, adapterFor({ trace })),
    'fo_checkpoint_advanced');
  assert.deepEqual(trace, ['lock']);
  assert.deepEqual(pool.snapshot(), before);
});

for (const [name, alternative] of [
  ['changed getters', () => observe(new FakePublicClient({
    finalized: START + 1n, logs: [eventLog(START)],
  }), { readGetters: async () => ({ version: '2' }) })],
  ['changed finalized horizon', () => observe(new FakePublicClient({
    finalized: START + 10n, logs: [eventLog(START)],
  }), { limits: { maxBlockSpan: 2n }, readGetters: async () => ({ version: '1' }) })],
]) {
  await test(`same-head ${name} is not exact replay`, async () => {
    const first = await transactionObservation();
    const second = await alternative();
    assert.equal(second.head.blockHash, first.head.blockHash);
    assert.notEqual(second.evidenceHash, first.evidenceHash);
    const pool = new AtomicTestPool();
    await commitFinalizedObservation(pool, first, adapterFor());
    const before = pool.snapshot();
    const trace = [];
    await rejectsCode(() => commitFinalizedObservation(pool, second, adapterFor({ trace })),
      'fo_checkpoint_advanced');
    assert.deepEqual(trace, ['lock']);
    assert.deepEqual(pool.snapshot(), before);
  });
}

await test('new no-work observation CASes prior commitment and refreshes metadata atomically', async () => {
  const first = await observe(new FakePublicClient({
    finalized: START, logs: [eventLog(START)],
  }), { readGetters: async () => ({ version: '1' }) });
  const pool = new AtomicTestPool();
  await commitFinalizedObservation(pool, first, adapterFor());
  const beforeVerified = pool.state.checkpoint.verified_at;
  const noWork = await observe(new FakePublicClient({ finalized: START, logs: () => {
    assert.fail('no-work observation must not read logs');
  } }), {
    checkpoint: checkpointAt(START, { lastObservationHash: first.evidenceHash }),
    readGetters: async () => ({ version: '1' }),
  });
  assert.equal(noWork.range, null);
  assert.equal(noWork.checkpointBase.lastObservationHash, first.evidenceHash);
  assert.notEqual(noWork.evidenceHash, first.evidenceHash);
  const trace = [];
  await commitFinalizedObservation(pool, noWork, adapterFor({ trace }));
  assert.deepEqual(trace, ['lock', 'inbox', 'apply', 'advance', 'result']);
  assert.equal(pool.state.checkpoint.last_applied_block_number, first.head.blockNumber);
  assert.equal(pool.state.checkpoint.last_observation_hash, noWork.evidenceHash);
  assert.notEqual(pool.state.checkpoint.verified_at, beforeVerified);
  assert.equal(pool.state.inbox.size, 1);
  assert.equal(pool.state.domain.size, 1);
});

await test('stale same-head no-work base commitment fails before inbox mutation', async () => {
  const first = await observe(new FakePublicClient({
    finalized: START, logs: [eventLog(START)],
  }), { readGetters: async () => ({ version: '1' }) });
  const pool = new AtomicTestPool();
  await commitFinalizedObservation(pool, first, adapterFor());
  const stale = await observe(new FakePublicClient({ finalized: START, logs: [] }), {
    checkpoint: checkpointAt(START, { lastObservationHash: hash('a') }),
    readGetters: async () => ({ version: '1' }),
  });
  const before = pool.snapshot();
  const trace = [];
  await rejectsCode(() => commitFinalizedObservation(pool, stale, adapterFor({ trace })),
    'fo_checkpoint_advanced');
  assert.deepEqual(trace, ['lock']);
  assert.deepEqual(pool.snapshot(), before);
});

await test('concurrent different same-head observations serialize and one fails before inbox', async () => {
  const first = await observe(new FakePublicClient({
    finalized: START, logs: [eventLog(START)],
  }), { readGetters: async () => ({ version: '1' }) });
  const pool = new AtomicTestPool();
  await commitFinalizedObservation(pool, first, adapterFor());
  const base = checkpointAt(START, { lastObservationHash: first.evidenceHash });
  const left = await observe(new FakePublicClient({ finalized: START, logs: [] }), {
    checkpoint: base, readGetters: async () => ({ version: '2' }),
  });
  const right = await observe(new FakePublicClient({ finalized: START, logs: [] }), {
    checkpoint: base, readGetters: async () => ({ version: '3' }),
  });
  const leftTrace = [];
  const rightTrace = [];
  const results = await Promise.allSettled([
    commitFinalizedObservation(pool, left, adapterFor({ trace: leftTrace })),
    commitFinalizedObservation(pool, right, adapterFor({ trace: rightTrace })),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const rejected = results.find((result) => result.status === 'rejected');
  assert.equal(rejected.reason.code, 'fo_checkpoint_advanced');
  const rejectedTrace = results[0].status === 'rejected' ? leftTrace : rightTrace;
  assert.deepEqual(rejectedTrace, ['lock']);
  assert.equal(pool.state.inbox.size, 1);
  assert.equal(pool.state.domain.size, 1);
});

for (const failAt of ['afterInbox', 'duringApply', 'beforeAdvance']) {
  await test(`no-work crash ${failAt} rolls back commitment and refreshed metadata`, async () => {
    const first = await observe(new FakePublicClient({
      finalized: START, logs: [eventLog(START)],
    }), { readGetters: async () => ({ version: '1' }) });
    const pool = new AtomicTestPool();
    await commitFinalizedObservation(pool, first, adapterFor());
    const noWork = await observe(new FakePublicClient({ finalized: START, logs: [] }), {
      checkpoint: checkpointAt(START, { lastObservationHash: first.evidenceHash }),
      readGetters: async () => ({ version: '2' }),
    });
    const before = pool.snapshot();
    await assert.rejects(
      () => commitFinalizedObservation(pool, noWork, adapterFor({ failAt })), /consumer|failed/i);
    assert.deepEqual(pool.snapshot(), before);
  });
}

await test('same-head conflicting inbox payload fails commitment CAS before inbox mutation', async () => {
  const original = await transactionObservation();
  const conflicting = await observe(new FakePublicClient({
    finalized: START + 1n,
    logs: [eventLog(START, { data: '0xabcd' })],
  }), { readGetters: async () => ({ version: '1' }) });
  const pool = new AtomicTestPool();
  await commitFinalizedObservation(pool, original, adapterFor());
  const before = pool.snapshot();
  const trace = [];
  await rejectsCode(
    () => commitFinalizedObservation(pool, conflicting, adapterFor({ trace })),
    'fo_checkpoint_advanced');
  assert.deepEqual(trace, ['lock']);
  assert.deepEqual(pool.snapshot(), before);
});

await test('stale consumer checkpoint compare-and-swap fails closed', async () => {
  const observation = await transactionObservation();
  const pool = new AtomicTestPool();
  pool.state.checkpoint.last_applied_block_number = (START + 8n).toString();
  pool.state.checkpoint.last_applied_block_hash = blockHash(START + 8n);
  await rejectsCode(() => commitFinalizedObservation(pool, observation, adapterFor()),
    'fo_checkpoint_advanced');
  assert.equal(pool.state.inbox.size, 0);
  assert.equal(pool.state.domain.size, 0);
});

await test('two different observations from one base serialize and one sees checkpoint advanced', async () => {
  const first = await observe(new FakePublicClient({
    finalized: START,
    logs: [eventLog(START)],
  }), { readGetters: async () => ({ version: '1' }) });
  const second = await observe(new FakePublicClient({
    finalized: START + 1n,
    logs: [eventLog(START + 1n, { transactionHash: hash('c') })],
  }), { readGetters: async () => ({ version: '2' }) });
  const pool = new AtomicTestPool();
  const results = await Promise.allSettled([
    commitFinalizedObservation(pool, first, adapterFor()),
    commitFinalizedObservation(pool, second, adapterFor()),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const rejected = results.find((result) => result.status === 'rejected');
  assert(rejected.reason instanceof FinalizedObservationError);
  assert.equal(rejected.reason.code, 'fo_checkpoint_advanced');
  assert.equal(pool.state.domain.size, 1);
});

await test('consumer checkpoint identity mismatch is distinct from advancement', async () => {
  const observation = await transactionObservation();
  const pool = new AtomicTestPool();
  pool.state.checkpoint.contract_address = OTHER_CONTRACT;
  await rejectsCode(() => commitFinalizedObservation(pool, observation, adapterFor()),
    'fo_checkpoint_identity');
});

await test('stable FO and domain errors retain object identity through rollback', async () => {
  const observation = await transactionObservation();
  const domainCause = new Error('raw domain detail stays private');
  for (const failure of [
    new FinalizedObservationError('fo_log_duplicate', 'stable FO conflict'),
    FinalizedObservationError.safeDomain('domain_conflict', domainCause),
  ]) {
    const pool = new AtomicTestPool();
    let caught;
    try {
      await commitFinalizedObservation(pool, observation,
        adapterFor({ failAt: 'afterInbox', failure }));
    } catch (error) { caught = error; }
    assert.equal(caught, failure);
    assert.equal(pool.rollbackCount, 1);
  }
  const domain = FinalizedObservationError.safeDomain('domain_conflict', domainCause);
  assert.equal(domain.code, 'domain_conflict');
  assert.equal(domain.cause, domainCause);
  assert.equal(Object.prototype.propertyIsEnumerable.call(domain, 'cause'), false);
  assert.doesNotMatch(domain.message, /raw|private|detail/i);
});

await test('FO constructor rejects every unpublished code', () => {
  for (const code of ['domain_error', 'fo_not_published', '23505', '']) {
    assert.throws(() => new FinalizedObservationError(code, 'secret must not escape'), TypeError);
  }
});

await test('safe domain factory validates its code and cannot be forged by marker or shape', async () => {
  assert.throws(() => FinalizedObservationError.safeDomain('Bad Code', new Error('private')), TypeError);
  const observation = await transactionObservation();
  const forged = Object.assign(new Error('postgres://user:password@host forged secret'), {
    code: 'domain_conflict', safeDomain: true,
  });
  const pool = new AtomicTestPool();
  let caught;
  try {
    await commitFinalizedObservation(pool, observation,
      adapterFor({ failAt: 'afterInbox', failure: forged }));
  } catch (error) { caught = error; }
  assert.notEqual(caught, forged);
  assert.equal(caught.cause, forged);
  assert.doesNotMatch(caught.message, /password|private|postgres|forged/i);
  assert.doesNotMatch(JSON.stringify(caught), /password|private|postgres|forged/i);
});

await test('arbitrary coded adapter errors are always wrapped without exposing their message', async () => {
  const observation = await transactionObservation();
  for (const code of ['domain_error', '23505', 'ECONNRESET']) {
    const failure = Object.assign(new Error(`postgres://user:password@host secret ${code}`), { code });
    const pool = new AtomicTestPool();
    let caught;
    try {
      await commitFinalizedObservation(pool, observation,
        adapterFor({ failAt: 'afterInbox', failure }));
    } catch (error) { caught = error; }
    assert.notEqual(caught, failure);
    assert.equal(caught.cause, failure);
    assert.doesNotMatch(caught.message, /password|private|postgres|secret/i);
    assert.doesNotMatch(JSON.stringify(caught), /password|private|postgres|secret/i);
  }
});

await test('forged FinalizedObservationError prototypes do not bypass provider wrapping', async () => {
  const forged = Object.assign(Object.create(FinalizedObservationError.prototype), {
    name: 'FinalizedObservationError',
    message: 'provider secret=private',
    code: 'fo_bad_config',
  });
  const client = new FakePublicClient({ chainError: forged });
  const error = await rejectsCode(() => observe(client), 'fo_rpc_unavailable');
  assert.notEqual(error, forged);
  assert.equal(error.cause, forged);
  assert.doesNotMatch(error.message, /secret|private/i);
});

await test('unknown adapter errors are safe wrappers with non-enumerable causes', async () => {
  const observation = await transactionObservation();
  const failure = new Error('postgres://user:password@host private payload');
  const pool = new AtomicTestPool();
  let caught;
  try {
    await commitFinalizedObservation(pool, observation,
      adapterFor({ failAt: 'afterInbox', failure }));
  } catch (error) { caught = error; }
  assert(caught);
  assert.equal(caught.cause, failure);
  assert.equal(Object.prototype.propertyIsEnumerable.call(caught, 'cause'), false);
  assert.doesNotMatch(caught.message, /password|private|postgres/i);
  assert.doesNotMatch(JSON.stringify(caught), /password|private|postgres/i);
});

await test('commit rejects live accessor evidence before post-validation mutation or pool acquisition', async () => {
  const observation = await transactionObservation();
  let live = '1';
  const getters = Object.freeze(Object.defineProperty({}, 'version', {
    enumerable: true,
    get() { return live; },
  }));
  const forged = Object.freeze({ ...observation, getters });
  const pool = new AtomicTestPool();
  const connect = pool.connect.bind(pool);
  pool.connect = async () => {
    live = 'changed-after-validation';
    return connect();
  };
  await rejectsCode(
    () => commitFinalizedObservation(pool, forged, adapterFor()), 'fo_bad_config');
  assert.equal(pool.connectCount, 0);
  assert.equal(live, '1');
});

await test('caller cannot pass a promise, mutable evidence, or a pre-opened client', async () => {
  const observation = await transactionObservation();
  const pool = new AtomicTestPool();
  await rejectsCode(() => commitFinalizedObservation(pool, Promise.resolve(observation), adapterFor()),
    'fo_bad_config');
  await rejectsCode(() => commitFinalizedObservation(pool, { ...observation }, adapterFor()),
    'fo_bad_config');
  await rejectsCode(() => commitFinalizedObservation({
    query: async () => ({ rows: [] }), release() {},
  }, observation, adapterFor()), 'fo_bad_config');
  assert.equal(pool.connectCount, 0);
});

if (failures.length) throw new AggregateError(failures, `${failures.length} finalized observation tests failed`);
console.log('finalized observation tests passed');
