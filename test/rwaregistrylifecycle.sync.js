import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import {
  encodeEventTopics, encodeFunctionResult, getAddress, keccak256, toBytes, toFunctionSelector,
} from 'viem';

import { makeDb } from '../src/db.js';

const HASH = (character) => `0x${character.repeat(64)}`;
const REGISTRY = getAddress('0x1234567890abcdef1234567890abcdef12345678').toLowerCase();
const PUBLISHER = getAddress('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd').toLowerCase();
const BLOCK_HASH = HASH('6');
const PARENT_HASH = HASH('7');
const TX_HASH = HASH('5');
const OBSERVATION_HASH = HASH('8');
const SNAPSHOT_HASH = HASH('9');
const ZERO_ADDRESS = `0x${'0'.repeat(40)}`;
const ZERO_BLOOM = `0x${'0'.repeat(512)}`;
const quantity = (value) => `0x${BigInt(value).toString(16)}`;

const PUBLISHER_EVENT = [{
  type: 'event', name: 'PublisherSet', inputs: [
    { indexed: true, name: 'publisher', type: 'address' },
  ],
}];
const READ_ABI = Object.freeze({
  publisher: [{ type: 'function', name: 'publisher', stateMutability: 'view', inputs: [],
    outputs: [{ type: 'address' }] }],
  catalogVersion: [{ type: 'function', name: 'catalogVersion', stateMutability: 'view', inputs: [],
    outputs: [{ type: 'uint256' }] }],
  versionCount: [{ type: 'function', name: 'versionCount', stateMutability: 'view', inputs: [],
    outputs: [{ type: 'uint256' }] }],
});
const SELECTORS = Object.freeze(Object.fromEntries(Object.keys(READ_ABI)
  .map((name) => [toFunctionSelector(`${name}()`), name])));

const state = { catalogVersion: 0n, finalizedNumber: 100n };
const blockHash = (number) => BigInt(number) === 100n ? BLOCK_HASH
  : `0x${BigInt(number).toString(16).padStart(64, '0')}`;

function rpcBlock(number = state.finalizedNumber) {
  const blockNumber = BigInt(number);
  return {
    baseFeePerGas: '0x0', difficulty: '0x0', extraData: '0x', gasLimit: '0x1c9c380',
    gasUsed: '0x0', hash: blockHash(blockNumber), logsBloom: ZERO_BLOOM, miner: ZERO_ADDRESS,
    mixHash: HASH('a'), nonce: '0x0000000000000000', number: quantity(blockNumber),
    parentHash: blockNumber === 100n ? PARENT_HASH : blockHash(blockNumber - 1n),
    receiptsRoot: HASH('b'), sha3Uncles: HASH('c'), size: '0x1',
    stateRoot: HASH('d'), timestamp: quantity(1000), totalDifficulty: '0x0',
    transactions: [], transactionsRoot: HASH('e'), uncles: [],
  };
}

function rpcResult(request) {
  if (request.method === 'eth_chainId') return quantity(4663);
  if (request.method === 'eth_getBlockByNumber') {
    const tag = request.params?.[0];
    return rpcBlock(tag === 'finalized' ? state.finalizedNumber : BigInt(tag));
  }
  if (request.method === 'eth_getLogs') {
    const fromBlock = BigInt(request.params?.[0]?.fromBlock ?? '0x0');
    const toBlock = BigInt(request.params?.[0]?.toBlock ?? '0x0');
    if (fromBlock > 100n || toBlock < 100n) return [];
    return [{
      address: REGISTRY,
      blockHash: BLOCK_HASH,
      blockNumber: quantity(100),
      data: '0x',
      logIndex: '0x0',
      removed: false,
      topics: encodeEventTopics({ abi: PUBLISHER_EVENT, eventName: 'PublisherSet',
        args: { publisher: PUBLISHER } }),
      transactionHash: TX_HASH,
      transactionIndex: '0x0',
    }];
  }
  if (request.method === 'eth_call') {
    const selector = String(request.params?.[0]?.data ?? '').slice(0, 10);
    const functionName = SELECTORS[selector];
    assert(functionName, `unexpected Registry getter selector ${selector}`);
    const result = functionName === 'publisher' ? PUBLISHER : state.catalogVersion;
    return encodeFunctionResult({ abi: READ_ABI[functionName], functionName, result });
  }
  throw new Error(`unexpected RPC method ${request.method}`);
}

const server = createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const answer = (entry) => {
    try { return { jsonrpc: '2.0', id: entry.id, result: rpcResult(entry) }; }
    catch (error) { return { jsonrpc: '2.0', id: entry.id,
      error: { code: -32000, message: error.message } }; }
  };
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify(Array.isArray(payload) ? payload.map(answer) : answer(payload)));
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});

const original = Object.freeze({
  CHAIN_RPC_URL: process.env.CHAIN_RPC_URL,
  STOCK_TOKEN_REGISTRY_V2_ADDRESS: process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS,
  STOCK_TOKEN_REGISTRY_V2_START_BLOCK: process.env.STOCK_TOKEN_REGISTRY_V2_START_BLOCK,
});
const port = server.address().port;
process.env.CHAIN_RPC_URL = `http://127.0.0.1:${port}`;
process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS = REGISTRY;
process.env.STOCK_TOKEN_REGISTRY_V2_START_BLOCK = '100';

let db;
try {
  const lifecycle = await import('../src/rwaregistrylifecycle.js');
  db = await makeDb();
  const readyAt = '2030-01-01T00:00:00.000Z';
  await db.query(`INSERT INTO stock_catalog_sync_state_v2
    (id,chain_id,registry_address,catalog_version,finalized_block_number,finalized_block_hash,
     snapshot_hash,observation_hash,finalized_horizon_number,finalized_horizon_hash,caught_up,
     verified_at,ready_verified_at,synced_at)
    VALUES (1,4663,$1,'0','100',$2,$3,$4,'100',$2,true,$5,$5,$5)`,
  [REGISTRY, BLOCK_HASH, SNAPSHOT_HASH, OBSERVATION_HASH, readyAt]);
  await db.query(`INSERT INTO stock_catalog_getter_checkpoint_v2
    (consumer_key,chain_id,contract_address,start_block_number,last_applied_block_number,
     last_applied_block_hash,last_observation_hash,finalized_horizon_number,
     finalized_horizon_hash,caught_up,verified_at,ready_verified_at)
    VALUES ('stock_catalog_getter_v2',4663,$1,'100','100',$2,$3,'100',$2,true,$4,$4)`,
  [REGISTRY, BLOCK_HASH, OBSERVATION_HASH, readyAt]);

  await db.query(`UPDATE stock_catalog_getter_checkpoint_v2 SET last_applied_block_number=NULL,
    last_applied_block_hash=NULL,last_observation_hash=NULL,caught_up=false,ready_verified_at=NULL
    WHERE consumer_key='stock_catalog_getter_v2'`);
  await assert.rejects(() => lifecycle.syncFinalizedRwaRegistryLifecycle(db), (error) => {
    assert.equal(error.code, 'rwa_lifecycle_task5_mismatch');
    return true;
  });
  const behindRuntime = (await db.query('SELECT * FROM rwa_registry_lifecycle_runtime_v2 WHERE id=1')).rows[0];
  assert.equal(behindRuntime.halted, false, 'a Task-5-behind bootstrap target is retryable');
  assert.equal(behindRuntime.failure_code, 'rwa_lifecycle_task5_mismatch');
  assert.equal((await db.query('SELECT COUNT(*) AS count FROM rwa_registry_lifecycle_inbox_v2')).rows[0].count, 0);
  assert.equal((await db.query(`SELECT last_applied_block_number FROM rwa_registry_lifecycle_checkpoint_v2
    WHERE consumer_key='rwa_registry_lifecycle_v2'`)).rows[0].last_applied_block_number, null);
  await db.query(`UPDATE stock_catalog_getter_checkpoint_v2 SET last_applied_block_number='100',
    last_applied_block_hash=$1,last_observation_hash=$2,caught_up=true,ready_verified_at=$3
    WHERE consumer_key='stock_catalog_getter_v2'`, [BLOCK_HASH, OBSERVATION_HASH, readyAt]);

  const first = await lifecycle.syncFinalizedRwaRegistryLifecycle(db);
  assert.deepEqual(first, { synced: true, replayed: false });
  const checkpoint = (await db.query(`SELECT * FROM rwa_registry_lifecycle_checkpoint_v2
    WHERE consumer_key='rwa_registry_lifecycle_v2'`)).rows[0];
  const runtime = (await db.query('SELECT * FROM rwa_registry_lifecycle_runtime_v2 WHERE id=1')).rows[0];
  const publisher = (await db.query('SELECT * FROM rwa_registry_publisher_current_v2')).rows[0];
  assert.equal(String(checkpoint.last_applied_block_number), '100');
  assert.equal(checkpoint.caught_up, true);
  assert.equal(runtime.sync_in_progress, false);
  assert.equal(runtime.caught_up, true);
  assert(runtime.ready_verified_at);
  assert.equal(publisher.publisher, PUBLISHER);
  assert.equal((await db.query('SELECT COUNT(*) AS count FROM rwa_registry_lifecycle_inbox_v2')).rows[0].count, 1);
  assert.equal((await db.query('SELECT COUNT(*) AS count FROM rwa_registry_lifecycle_event_results_v2')).rows[0].count, 1);

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const head = await lifecycle.readFinalizedRwaLifecycleHeadV2(client);
    assert.equal(head.registryAddress, REGISTRY);
    assert.equal(head.catalogVersion, '0');
    const forged = Object.freeze(Object.assign(Object.create(null), head));
    await assert.rejects(() => lifecycle.compareFinalizedRwaActivationV2(
      client, forged, HASH('1'), { observedActivationGeneration: '1' }),
    (error) => error.code === 'rwa_activation_input');
    await client.query('ROLLBACK');
  } finally { client.release(); }

  const noLog = await lifecycle.syncFinalizedRwaRegistryLifecycle(db);
  assert.deepEqual(noLog, { synced: true, replayed: false });
  assert.equal((await db.query('SELECT COUNT(*) AS count FROM rwa_registry_lifecycle_inbox_v2')).rows[0].count, 1);
  assert.equal((await db.query('SELECT COUNT(*) AS count FROM rwa_registry_lifecycle_event_results_v2')).rows[0].count, 1);
  await db.query(`UPDATE rwa_registry_lifecycle_inbox_v2 SET publisher=$1`, [REGISTRY]);
  await db.query(`UPDATE rwa_registry_lifecycle_checkpoint_v2 SET
    last_applied_block_number=NULL,last_applied_block_hash=NULL,last_observation_hash=NULL,
    finalized_horizon_block_number=NULL,finalized_horizon_block_hash=NULL,caught_up=false,
    verified_at=NULL,ready_verified_at=NULL
    WHERE consumer_key='rwa_registry_lifecycle_v2'`);
  await db.query(`UPDATE rwa_registry_lifecycle_runtime_v2 SET
    last_applied_block_number=NULL,last_applied_block_hash=NULL,
    finalized_horizon_block_number=NULL,finalized_horizon_block_hash=NULL,caught_up=false,
    ready_verified_at=NULL WHERE id=1`);
  await assert.rejects(() => lifecycle.syncFinalizedRwaRegistryLifecycle(db), (error) => {
    assert.equal(error.code, 'rwa_lifecycle_inbox_conflict',
      'same finalized identity with a changed decoded column must fail closed as inbox conflict');
    return true;
  });
  await db.query(`UPDATE rwa_registry_lifecycle_inbox_v2 SET publisher=$1`, [PUBLISHER]);
  // Administrative fixture repair only: a real inbox conflict is sticky and requires
  // operator incident resolution. Reset it here so this isolated lane can also prove
  // the independent pinned-getter mismatch transition below.
  await db.query(`UPDATE rwa_registry_lifecycle_checkpoint_v2 SET halted=false
    WHERE consumer_key='rwa_registry_lifecycle_v2'`);
  await db.query(`UPDATE rwa_registry_lifecycle_runtime_v2 SET halted=false,failure_code=NULL,
    unresolved_incident_count=0,last_incident_id=NULL WHERE id=1`);
  // Keep the corruption schema-valid so the replay verifier, rather than the
  // database constraint, is what proves the persisted result tuple is exact.
  await db.query(`UPDATE rwa_registry_lifecycle_event_results_v2 SET
    event_kind='AssetVersionRegistered',disposition='registration_applied',
    detail_code='registration_applied',local_record_id=NULL`);
  await assert.rejects(() => lifecycle.syncFinalizedRwaRegistryLifecycle(db), (error) => {
    assert.equal(error.code, 'rwa_lifecycle_inbox_conflict',
      'exact replay accepted a different schema-valid event-result tuple');
    return true;
  });
  await db.query(`UPDATE rwa_registry_lifecycle_event_results_v2 SET
    event_kind='PublisherSet',disposition='publisher_applied',
    detail_code='publisher_applied',local_record_id=NULL`);
  await db.query(`UPDATE rwa_registry_lifecycle_checkpoint_v2 SET halted=false
    WHERE consumer_key='rwa_registry_lifecycle_v2'`);
  await db.query(`UPDATE rwa_registry_lifecycle_runtime_v2 SET halted=false,failure_code=NULL,
    unresolved_incident_count=0,last_incident_id=NULL WHERE id=1`);
  const beforeHash = (await db.query(`SELECT last_observation_hash
    FROM rwa_registry_lifecycle_checkpoint_v2 WHERE consumer_key='rwa_registry_lifecycle_v2'`)).rows[0]
    .last_observation_hash;
  state.catalogVersion = 1n;
  await assert.rejects(() => lifecycle.syncFinalizedRwaRegistryLifecycle(db), (error) => {
    assert.equal(error.code, 'rwa_lifecycle_getter_mismatch');
    return true;
  });
  const failedRuntime = (await db.query('SELECT * FROM rwa_registry_lifecycle_runtime_v2 WHERE id=1')).rows[0];
  assert.equal(failedRuntime.sync_in_progress, false);
  assert.equal(failedRuntime.halted, true);
  assert.equal(failedRuntime.failure_code, 'rwa_lifecycle_getter_mismatch');
  assert.equal((await db.query(`SELECT last_observation_hash
    FROM rwa_registry_lifecycle_checkpoint_v2 WHERE consumer_key='rwa_registry_lifecycle_v2'`)).rows[0]
    .last_observation_hash, beforeHash);

  state.catalogVersion = 0n;
  state.finalizedNumber = 20100n;
  const bootstrapDb = await makeDb();
  try {
    const finalHash = blockHash(state.finalizedNumber);
    await bootstrapDb.query(`INSERT INTO stock_catalog_sync_state_v2
      (id,chain_id,registry_address,catalog_version,finalized_block_number,finalized_block_hash,
       snapshot_hash,observation_hash,finalized_horizon_number,finalized_horizon_hash,caught_up,
       verified_at,ready_verified_at,synced_at)
      VALUES (1,4663,$1,'0','20100',$2,$3,$4,'20100',$2,true,$5,$5,$5)`,
    [REGISTRY, finalHash, SNAPSHOT_HASH, OBSERVATION_HASH, readyAt]);
    await bootstrapDb.query(`INSERT INTO stock_catalog_getter_checkpoint_v2
      (consumer_key,chain_id,contract_address,start_block_number,last_applied_block_number,
       last_applied_block_hash,last_observation_hash,finalized_horizon_number,
       finalized_horizon_hash,caught_up,verified_at,ready_verified_at)
      VALUES ('stock_catalog_getter_v2',4663,$1,'100','20100',$2,$3,'20100',$2,true,$4,$4)`,
    [REGISTRY, finalHash, OBSERVATION_HASH, readyAt]);
    for (const expectedHead of ['10099', '20099']) {
      await lifecycle.syncFinalizedRwaRegistryLifecycle(bootstrapDb);
      const partial = (await bootstrapDb.query(`SELECT last_applied_block_number,caught_up,ready_verified_at
        FROM rwa_registry_lifecycle_checkpoint_v2
        WHERE consumer_key='rwa_registry_lifecycle_v2'`)).rows[0];
      assert.equal(String(partial.last_applied_block_number), expectedHead);
      assert.equal(partial.caught_up, false);
      assert.equal(partial.ready_verified_at, null);
      const partialClient = await bootstrapDb.connect();
      try {
        await partialClient.query('BEGIN');
        await assert.rejects(() => lifecycle.readFinalizedRwaLifecycleHeadV2(partialClient),
          (error) => error.code === 'rwa_lifecycle_not_ready');
        await partialClient.query('ROLLBACK');
      } finally { partialClient.release(); }
    }
    await lifecycle.syncFinalizedRwaRegistryLifecycle(bootstrapDb);
    const finalClient = await bootstrapDb.connect();
    try {
      await finalClient.query('BEGIN');
      const bootstrapHead = await lifecycle.readFinalizedRwaLifecycleHeadV2(finalClient);
      assert.equal(bootstrapHead.appliedBlockNumber, '20100');
      assert.equal(bootstrapHead.appliedBlockHash, finalHash);
      await finalClient.query('ROLLBACK');
    } finally { finalClient.release(); }
  } finally {
    await bootstrapDb.end?.();
    state.finalizedNumber = 100n;
  }

  console.log('rwaregistrylifecycle sync: finalized RPC, inbox, reconciliation, readiness, and mismatch rollback passed');
} finally {
  if (db) await db.end?.();
  await new Promise((resolve) => server.close(resolve));
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
