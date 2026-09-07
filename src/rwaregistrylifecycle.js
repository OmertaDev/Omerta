import { randomUUID } from 'node:crypto';
import {
  createPublicClient, decodeEventLog, getAddress, http, keccak256, numberToHex, toBytes,
} from 'viem';

import {
  commitFinalizedObservation, FinalizedObservationError, finalizedInboxIdentity, observeFinalized,
} from './finalizedobservation.js';
import { dbCaps } from './db.js';

const CHAIN_ID = '4663';
const CONSUMER_KEY = 'rwa_registry_lifecycle_v2';
const TASK5_CONSUMER_KEY = 'stock_catalog_getter_v2';
const ZERO_ADDRESS = `0x${'0'.repeat(40)}`;
const ZERO_HASH = `0x${'0'.repeat(64)}`;
const UINT64_MAX = (1n << 64n) - 1n;
const UINT256_MAX = (1n << 256n) - 1n;
const ACTIVATION_TTL = 604800n;
const READY_SECONDS = 600;
const ATTEMPT_SECONDS = 300;

const EVENT_SIGNATURES = Object.freeze([
  'PublisherSet(address)',
  'AssetVersionRegistered(bytes32,bytes32,address,bytes32,string,string,uint8,uint64)',
  'AssetVersionActivated(bytes32,bytes32,bytes32,uint64,uint64,uint256)',
  'AssetVersionDeactivated(bytes32,bytes32,uint64,uint256)',
  'BallotPublished(uint256,bytes32,address,uint8,bytes32,uint256,uint256,uint64,uint64)',
]);
const TOPICS = Object.freeze(EVENT_SIGNATURES.map((value) => keccak256(toBytes(value))).sort());
const MAX_BLOCK_SPAN = 10000;
const LIMITS = Object.freeze({ maxBlockSpan: BigInt(MAX_BLOCK_SPAN), maxLogs: 2000, maxBytes: 2000000 });
const MAX_TOUCHED_ASSETS = 256;
const MAX_BALLOT_DAYS = 64;
const MAX_LOCAL_JOINS = 256;
const MAX_REGISTRY_VERSIONS = 2048;
const HEAD_RECEIPT_CLIENTS = new WeakMap();

const REGISTRY_EVENT_ABI = Object.freeze([
  { type: 'event', name: 'PublisherSet', inputs: [
    { indexed: true, name: 'publisher', type: 'address' },
  ] },
  { type: 'event', name: 'AssetVersionRegistered', inputs: [
    { indexed: true, name: 'versionKey', type: 'bytes32' },
    { indexed: true, name: 'tickerHash', type: 'bytes32' },
    { indexed: true, name: 'token', type: 'address' },
    { indexed: false, name: 'robinhoodAssetIdHash', type: 'bytes32' },
    { indexed: false, name: 'ticker', type: 'string' },
    { indexed: false, name: 'name', type: 'string' },
    { indexed: false, name: 'tokenDecimals', type: 'uint8' },
    { indexed: false, name: 'registeredAt', type: 'uint64' },
  ] },
  { type: 'event', name: 'AssetVersionActivated', inputs: [
    { indexed: true, name: 'versionKey', type: 'bytes32' },
    { indexed: true, name: 'evidenceHash', type: 'bytes32' },
    { indexed: true, name: 'reviewId', type: 'bytes32' },
    { indexed: false, name: 'approvedAt', type: 'uint64' },
    { indexed: false, name: 'validUntil', type: 'uint64' },
    { indexed: false, name: 'catalogVersion', type: 'uint256' },
  ] },
  { type: 'event', name: 'AssetVersionDeactivated', inputs: [
    { indexed: true, name: 'versionKey', type: 'bytes32' },
    { indexed: true, name: 'reasonHash', type: 'bytes32' },
    { indexed: false, name: 'deactivatedAt', type: 'uint64' },
    { indexed: false, name: 'catalogVersion', type: 'uint256' },
  ] },
  { type: 'event', name: 'BallotPublished', inputs: [
    { indexed: true, name: 'day', type: 'uint256' },
    { indexed: true, name: 'versionKey', type: 'bytes32' },
    { indexed: true, name: 'token', type: 'address' },
    { indexed: false, name: 'tokenDecimals', type: 'uint8' },
    { indexed: false, name: 'tallyHash', type: 'bytes32' },
    { indexed: false, name: 'catalogVersion', type: 'uint256' },
    { indexed: false, name: 'maxEthWei', type: 'uint256' },
    { indexed: false, name: 'purchaseUntil', type: 'uint64' },
    { indexed: false, name: 'publishedAt', type: 'uint64' },
  ] },
]);

const REGISTRY_READ_ABI = Object.freeze([{
  type: 'function', name: 'publisher', stateMutability: 'view', inputs: [],
  outputs: [{ name: '', type: 'address' }],
}, {
  type: 'function', name: 'catalogVersion', stateMutability: 'view', inputs: [],
  outputs: [{ name: '', type: 'uint256' }],
}, {
  type: 'function', name: 'versionCount', stateMutability: 'view', inputs: [],
  outputs: [{ name: '', type: 'uint256' }],
}, {
  type: 'function', name: 'versionKeyAt', stateMutability: 'view',
  inputs: [{ name: 'index', type: 'uint256' }], outputs: [{ name: '', type: 'bytes32' }],
}, {
  type: 'function', name: 'activationGeneration', stateMutability: 'view',
  inputs: [{ name: 'versionKey', type: 'bytes32' }], outputs: [{ name: '', type: 'uint256' }],
}]);

class LifecycleError extends Error {
  constructor(code, message, cause) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'RwaRegistryLifecycleError';
    this.code = code;
  }
}

function fail(code, message, cause) { throw new LifecycleError(code, message, cause); }
function retryableFail(code, message, cause) {
  const error = new LifecycleError(code, message, cause);
  error.retryable = true;
  throw error;
}
function isLifecycleError(error) { return error instanceof LifecycleError; }

function plainObject(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).length !== keys.length) return false;
  return keys.every((key, index) => Object.keys(descriptors)[index] === key
    && descriptors[key]?.enumerable === true && 'value' in descriptors[key]);
}

function decimal(value, field, { positive = false, bits = 256 } = {}) {
  const text = typeof value === 'bigint' ? value.toString() : String(value ?? '');
  if (!/^(?:0|[1-9][0-9]*)$/.test(text)) fail('rwa_activation_input', `Invalid ${field}.`);
  const number = BigInt(text);
  const maximum = bits === 64 ? UINT64_MAX : UINT256_MAX;
  if (number > maximum || (positive && number === 0n)) fail('rwa_activation_input', `Invalid ${field}.`);
  return text;
}

function hash(value, field, { nonzero = false } = {}) {
  if (typeof value !== 'string') fail('rwa_activation_input', `Invalid ${field}.`);
  const raw = value;
  const text = raw.toLowerCase();
  if (raw !== text || !/^0x[0-9a-f]{64}$/.test(text) || (nonzero && text === ZERO_HASH)) {
    fail('rwa_activation_input', `Invalid ${field}.`);
  }
  return text;
}

function address(value, field) {
  let result;
  try { result = getAddress(String(value ?? '')).toLowerCase(); } catch { fail('rwa_activation_input', `Invalid ${field}.`); }
  if (result === ZERO_ADDRESS) fail('rwa_activation_input', `Invalid ${field}.`);
  return result;
}

function frozenRecord(entries) {
  const result = Object.create(null);
  for (const [key, value] of entries) result[key] = value;
  return Object.freeze(result);
}

function iso(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) fail('rwa_lifecycle_not_ready', 'Registry lifecycle readiness is unavailable.');
  return date.toISOString();
}

function nowSql() { return dbCaps.skipLocked ? 'clock_timestamp()' : 'now()'; }

function epochSeconds(value) {
  const milliseconds = new Date(value).getTime();
  return Number.isFinite(milliseconds) ? String(Math.floor(milliseconds / 1000)) : '';
}

function config() {
  const rawRpc = process.env.CHAIN_RPC_URL;
  const rawRegistry = process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS;
  const rawStart = process.env.STOCK_TOKEN_REGISTRY_V2_START_BLOCK;
  if (typeof rawRpc !== 'string' || typeof rawRegistry !== 'string' || typeof rawStart !== 'string') return null;
  let rpc;
  let registryAddress;
  let startBlock;
  try {
    rpc = new URL(rawRpc.trim());
    if (!['http:', 'https:'].includes(rpc.protocol) || !rpc.hostname) return null;
    registryAddress = address(rawRegistry.trim(), 'Registry address');
    startBlock = decimal(rawStart.trim(), 'Registry start block');
  } catch { return null; }
  return { rpc: rpc.toString(), registryAddress, startBlock };
}

function queryClient(client) {
  if (!client || typeof client.query !== 'function') fail('rwa_activation_input', 'Invalid database client.');
  return client;
}

function canonicalEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event) || !Object.isFrozen(event)) {
    fail('rwa_lifecycle_decode', 'Malformed Registry lifecycle event.');
  }
  return {
    ...event,
    blockNumber: decimal(event.blockNumber, 'block number'),
    blockHash: hash(event.blockHash, 'block hash', { nonzero: true }),
    blockTimestamp: decimal(event.blockTimestamp, 'block timestamp', { bits: 64 }),
    transactionHash: hash(event.transactionHash, 'transaction hash', { nonzero: true }),
    transactionIndex: decimal(event.transactionIndex, 'transaction index'),
    logIndex: decimal(event.logIndex, 'log index'),
  };
}

function orderedBatch(decodedBatch, allowedKinds) {
  if (!Array.isArray(decodedBatch) || !Object.isFrozen(decodedBatch)) {
    fail('rwa_lifecycle_decode', 'Malformed Registry lifecycle batch.');
  }
  const events = decodedBatch.map(canonicalEvent);
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (!allowedKinds.has(event.kind)) fail('rwa_lifecycle_decode', 'Unexpected Registry lifecycle event.');
    if (index > 0) {
      const previous = events[index - 1];
      const left = [BigInt(previous.blockNumber), BigInt(previous.transactionIndex), BigInt(previous.logIndex)];
      const right = [BigInt(event.blockNumber), BigInt(event.transactionIndex), BigInt(event.logIndex)];
      if (left[0] > right[0] || (left[0] === right[0] && (left[1] > right[1]
        || (left[1] === right[1] && left[2] >= right[2])))) {
        fail('rwa_lifecycle_decode', 'Registry lifecycle events are not in canonical order.');
      }
    }
  }
  const transactionPositions = new Map();
  for (const event of events) {
    const position = `${event.blockNumber}:${event.transactionIndex}`;
    const prior = transactionPositions.get(event.transactionHash);
    if (prior !== undefined && prior !== position) {
      fail('rwa_lifecycle_decode', 'Registry transaction identity is inconsistent.');
    }
    transactionPositions.set(event.transactionHash, position);
  }
  return events;
}

async function currentRow(client, key, lock = true) {
  return (await client.query(`SELECT * FROM rwa_registry_asset_lifecycle_current_v2
    WHERE asset_version_key=$1${lock ? ' FOR UPDATE' : ''}`, [key])).rows[0] ?? null;
}

async function globalCatalog(client) {
  const row = (await client.query(`SELECT COALESCE(MAX(catalog_version),0) AS catalog_version
    FROM rwa_registry_asset_lifecycle_current_v2`)).rows[0];
  return BigInt(String(row?.catalog_version ?? '0'));
}

function eventTransactionIdentity(event) {
  return `${event.blockNumber}:${event.transactionIndex}:${event.transactionHash}`;
}

function simulatedRegistration(event, catalogVersion) {
  return {
    assetVersionKey: hash(event.assetVersionKey, 'asset version key', { nonzero: true }),
    tickerHash: hash(event.tickerHash, 'ticker hash', { nonzero: true }),
    tokenAddress: address(event.tokenAddress, 'token address'),
    providerHash: hash(event.robinhoodAssetIdHash, 'provider ID hash', { nonzero: true }),
    active: false,
    activationGeneration: 0n,
    catalogVersion,
  };
}

function validateCatalogTransactionShape(events) {
  const transactions = [];
  for (const event of events) {
    const identity = eventTransactionIdentity(event);
    const prior = transactions.at(-1);
    if (!prior || prior.identity !== identity) transactions.push({ identity, events: [event] });
    else prior.events.push(event);
  }
  for (const transaction of transactions) {
    const firstCatalogIndex = transaction.events.findIndex((event) =>
      event.kind === 'AssetVersionActivated' || event.kind === 'AssetVersionDeactivated');
    if (firstCatalogIndex < 0) continue;
    const prefix = transaction.events.slice(0, firstCatalogIndex);
    const suffix = transaction.events.slice(firstCatalogIndex);
    if (prefix.some((event) => event.kind !== 'AssetVersionRegistered')
      || suffix.some((event) => event.kind !== 'AssetVersionActivated'
        && event.kind !== 'AssetVersionDeactivated')) {
      fail('rwa_lifecycle_catalog', 'Registry catalog events are not contiguous.');
    }
    if (!suffix.some((event) => event.kind === 'AssetVersionActivated')
      && transaction.events.length !== 1) {
      fail('rwa_lifecycle_catalog', 'Registry standalone deactivation transaction is invalid.');
    }
  }
}

async function validateCatalogGrammar(client, events) {
  validateCatalogTransactionShape(events);
  const rows = (await client.query(`SELECT asset_version_key,ticker_hash,token_address,
      robinhood_asset_id_hash,active,activation_generation,catalog_version
    FROM rwa_registry_asset_lifecycle_current_v2`)).rows;
  const state = new Map(rows.map((row) => [String(row.asset_version_key).toLowerCase(), {
    assetVersionKey: String(row.asset_version_key).toLowerCase(),
    tickerHash: String(row.ticker_hash).toLowerCase(),
    tokenAddress: String(row.token_address).toLowerCase(),
    providerHash: String(row.robinhood_asset_id_hash).toLowerCase(),
    active: row.active === true,
    activationGeneration: BigInt(String(row.activation_generation)),
    catalogVersion: BigInt(String(row.catalog_version)),
  }]));
  let catalogVersion = rows.reduce((maximum, row) => {
    const candidate = BigInt(String(row.catalog_version));
    return candidate > maximum ? candidate : maximum;
  }, 0n);
  const transactions = [];
  for (const event of events) {
    const identity = eventTransactionIdentity(event);
    const prior = transactions.at(-1);
    if (!prior || prior.identity !== identity) transactions.push({ identity, events: [event] });
    else prior.events.push(event);
  }
  for (const transaction of transactions) {
    for (const event of transaction.events) {
      if (event.kind !== 'AssetVersionRegistered') continue;
      const registered = simulatedRegistration(event, catalogVersion);
      const prior = state.get(registered.assetVersionKey);
      if (!prior) state.set(registered.assetVersionKey, registered);
    }
    const firstCatalogIndex = transaction.events.findIndex((event) =>
      event.kind === 'AssetVersionActivated' || event.kind === 'AssetVersionDeactivated');
    const catalogEvents = firstCatalogIndex < 0 ? [] : transaction.events.slice(firstCatalogIndex);
    if (catalogEvents.length === 0) continue;
    const activations = catalogEvents.filter((event) => event.kind === 'AssetVersionActivated');
    const nextCatalogVersion = catalogVersion + 1n;
    if (activations.length === 0) {
      if (catalogEvents.length !== 1 || transaction.events.length !== 1) {
        fail('rwa_lifecycle_catalog', 'Registry catalog transaction is invalid.');
      }
      const event = catalogEvents[0];
      const key = hash(event.assetVersionKey, 'asset version key', { nonzero: true });
      const current = state.get(key);
      if (!current?.active || BigInt(decimal(event.catalogVersion, 'catalog version')) !== nextCatalogVersion) {
        fail('rwa_lifecycle_catalog', 'Registry catalog sequence is invalid.');
      }
      current.active = false;
      current.catalogVersion = nextCatalogVersion;
      catalogVersion = nextCatalogVersion;
      continue;
    }
    if (activations.length !== 1 || catalogEvents.at(-1) !== activations[0]
      || catalogEvents.length > 4
      || catalogEvents.slice(0, -1).some((event) => event.kind !== 'AssetVersionDeactivated')) {
      fail('rwa_lifecycle_catalog', 'Registry activation transaction grammar is invalid.');
    }
    const activation = activations[0];
    const targetKey = hash(activation.assetVersionKey, 'asset version key', { nonzero: true });
    const target = state.get(targetKey);
    if (!target) fail('rwa_lifecycle_catalog', 'Registry activation target state is invalid.');
    const seen = new Set();
    const conflicts = [];
    for (const [field, value] of [
      ['tickerHash', target.tickerHash],
      ['tokenAddress', target.tokenAddress],
      ['providerHash', target.providerHash],
    ]) {
      const conflict = [...state.values()].find((candidate) =>
        candidate.assetVersionKey !== targetKey && candidate.active && candidate[field] === value);
      if (conflict && !seen.has(conflict.assetVersionKey)) {
        seen.add(conflict.assetVersionKey);
        conflicts.push(conflict.assetVersionKey);
      }
    }
    const emittedConflicts = catalogEvents.slice(0, -1)
      .map((event) => hash(event.assetVersionKey, 'asset version key', { nonzero: true }));
    if (emittedConflicts.length !== conflicts.length
      || emittedConflicts.some((key, index) => key !== conflicts[index])
      || catalogEvents.some((event) =>
        BigInt(decimal(event.catalogVersion, 'catalog version')) !== nextCatalogVersion)) {
      fail('rwa_lifecycle_catalog', 'Registry activation conflict sequence is invalid.');
    }
    for (const key of conflicts) {
      const conflict = state.get(key);
      conflict.active = false;
      conflict.catalogVersion = nextCatalogVersion;
    }
    target.active = true;
    target.activationGeneration += 1n;
    target.catalogVersion = nextCatalogVersion;
    catalogVersion = nextCatalogVersion;
  }
}

function rowGeneration(row) { return row ? String(row.activation_generation) : '0'; }
function rowCatalog(row) { return row ? String(row.catalog_version) : '0'; }

async function insertRegistration(client, event) {
  const key = hash(event.assetVersionKey, 'asset version key', { nonzero: true });
  const tickerHash = hash(event.tickerHash, 'ticker hash', { nonzero: true });
  const tokenAddress = address(event.tokenAddress, 'token address');
  const providerHash = hash(event.robinhoodAssetIdHash, 'provider ID hash', { nonzero: true });
  const registeredAt = decimal(event.registeredAt, 'registration time', { bits: 64 });
  if (registeredAt !== event.blockTimestamp || !Number.isInteger(event.tokenDecimals)
    || event.tokenDecimals < 0 || event.tokenDecimals > 255
    || typeof event.ticker !== 'string' || typeof event.name !== 'string') {
    fail('rwa_lifecycle_structure', 'Malformed Registry registration.');
  }
  const existing = await currentRow(client, key);
  if (existing) {
    const same = String(existing.ticker_hash).toLowerCase() === tickerHash
      && String(existing.token_address).toLowerCase() === tokenAddress
      && String(existing.robinhood_asset_id_hash).toLowerCase() === providerHash
      && existing.ticker === event.ticker && existing.name === event.name
      && Number(existing.token_decimals) === event.tokenDecimals
      && String(existing.registered_at) === registeredAt
      && String(existing.registration_block_number) === String(event.blockNumber)
      && sameLower(existing.registration_block_hash, event.blockHash)
      && sameLower(existing.registration_transaction_hash, event.transactionHash)
      && String(existing.registration_log_index) === String(event.logIndex);
    if (!same) fail('rwa_lifecycle_structure', 'Registry registration conflicts with immutable identity.');
    return { disposition: 'registration_applied', localRecordId: null };
  }
  const checkpoint = (await client.query(`SELECT registry_address FROM rwa_registry_lifecycle_checkpoint_v2
    WHERE consumer_key=$1`, [CONSUMER_KEY])).rows[0];
  const registryAddress = checkpoint?.registry_address ?? config()?.registryAddress;
  if (!registryAddress) fail('rwa_lifecycle_unconfigured', 'Registry lifecycle is unconfigured.');
  await client.query(`INSERT INTO rwa_registry_asset_lifecycle_current_v2
    (chain_id,registry_address,asset_version_key,ticker_hash,token_address,
     robinhood_asset_id_hash,ticker,name,token_decimals,registered_at,
     registry_index,
     registration_block_number,registration_block_hash,registration_transaction_hash,
     registration_log_index,activation_generation,active,catalog_version)
    VALUES (4663,$1,$2,$3,$4,$5,$6,$7,$8,$9,
      (SELECT COUNT(*) FROM rwa_registry_asset_lifecycle_current_v2),
      $10,$11,$12,$13,0,false,$14)`,
  [registryAddress, key, tickerHash, tokenAddress, providerHash, event.ticker,
    event.name, event.tokenDecimals, registeredAt, event.blockNumber, event.blockHash,
    event.transactionHash, event.logIndex, (await globalCatalog(client)).toString()]);
  return { disposition: 'registration_applied', localRecordId: null };
}

function activationDisposition(row, event, current) {
  if (!row) return { disposition: 'unmatched', localRecordId: null };
  const evidence = String(row.evidence_hash ?? '').toLowerCase() === String(event.evidenceHash).toLowerCase();
  const review = String(row.review_id ?? '').toLowerCase() === String(event.reviewId).toLowerCase();
  const approved = epochSeconds(row.approved_at) === String(event.approvedAt);
  const valid = epochSeconds(row.valid_until) === String(event.validUntil);
  const asset = String(row.asset_version_key ?? '').toLowerCase() === String(event.assetVersionKey).toLowerCase();
  const registry = String(row.registry_address ?? '').toLowerCase() === String(current.registry_address).toLowerCase();
  return evidence && review && approved && valid && asset && registry
    ? { disposition: 'matched', localRecordId: String(row.nomination_id) }
    : { disposition: 'drift', localRecordId: String(row.nomination_id) };
}

async function activate(client, event, { sharedCatalog = false } = {}) {
  const key = hash(event.assetVersionKey, 'asset version key', { nonzero: true });
  const evidenceHash = hash(event.evidenceHash, 'evidence hash', { nonzero: true });
  const reviewId = hash(event.reviewId, 'review ID', { nonzero: true });
  const approvedAt = BigInt(decimal(event.approvedAt, 'approved time', { bits: 64 }));
  const validUntil = BigInt(decimal(event.validUntil, 'valid-until time', { bits: 64 }));
  const includedAt = BigInt(event.blockTimestamp);
  const catalogVersion = BigInt(decimal(event.catalogVersion, 'catalog version'));
  if (validUntil !== approvedAt + ACTIVATION_TTL || includedAt < approvedAt || includedAt >= validUntil) {
    fail('rwa_lifecycle_timestamp', 'Registry activation timestamp is invalid.');
  }
  const current = await currentRow(client, key);
  if (!current) fail('rwa_lifecycle_structure', 'Registry activation lacks registration.');
  const nextGeneration = BigInt(rowGeneration(current)) + 1n;
  if (nextGeneration > UINT256_MAX) fail('rwa_lifecycle_generation', 'Registry activation generation overflow.');
  const global = await globalCatalog(client);
  const expectedCatalog = sharedCatalog ? global : global + 1n;
  if (catalogVersion !== expectedCatalog) fail('rwa_lifecycle_catalog', 'Registry catalog sequence is invalid.');
  const proposal = (await client.query(`SELECT * FROM rwa_nomination_safe_proposals_v2
    WHERE review_id=$1 LIMIT 1`, [reviewId])).rows[0];
  const result = activationDisposition(proposal, event, current);
  await client.query(`INSERT INTO rwa_registry_activation_instances_v2
    (chain_id,registry_address,asset_version_key,activation_generation,
     activation_block_number,activation_block_hash,activation_transaction_hash,activation_log_index,
     activation_transaction_index,evidence_hash,review_id,approved_at,valid_until,included_at,
     catalog_version,local_match,local_match_record_id)
    VALUES (4663,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
  [current.registry_address, key, nextGeneration.toString(), event.blockNumber, event.blockHash,
    event.transactionHash, event.logIndex, event.transactionIndex, evidenceHash, reviewId,
    new Date(Number(approvedAt) * 1000), new Date(Number(validUntil) * 1000),
    new Date(Number(includedAt) * 1000), catalogVersion.toString(),
    result.disposition === 'matched', result.disposition === 'matched' ? result.localRecordId : null]);
  await client.query(`UPDATE rwa_registry_asset_lifecycle_current_v2 SET
    activation_generation=$2,active=true,catalog_version=$3,updated_at=now()
    WHERE asset_version_key=$1`, [key, nextGeneration.toString(), catalogVersion.toString()]);
  return result;
}

async function deactivate(client, event, { allowSharedCatalog = false } = {}) {
  const key = hash(event.assetVersionKey, 'asset version key', { nonzero: true });
  const reasonHash = hash(event.reasonHash, 'deactivation reason', { nonzero: true });
  const deactivatedAt = decimal(event.deactivatedAt, 'deactivation time', { bits: 64 });
  if (deactivatedAt !== event.blockTimestamp) fail('rwa_lifecycle_timestamp', 'Registry deactivation time is invalid.');
  const current = await currentRow(client, key);
  if (!current || current.active !== true) fail('rwa_lifecycle_structure', 'Registry deactivation lacks an active instance.');
  const catalogVersion = BigInt(decimal(event.catalogVersion, 'catalog version'));
  const global = await globalCatalog(client);
  const expected = allowSharedCatalog && catalogVersion === global ? global : global + 1n;
  if (catalogVersion !== expected) {
    fail('rwa_lifecycle_catalog', 'Registry catalog sequence is invalid.');
  }
  const instance = await client.query(`UPDATE rwa_registry_activation_instances_v2 SET
    deactivation_block_number=$4,deactivation_block_hash=$5,
    deactivation_transaction_hash=$6,deactivation_log_index=$7,deactivation_reason_hash=$8,
    deactivation_catalog_version=$9,deactivated_at=$10
    WHERE registry_address=$1 AND asset_version_key=$2
      AND activation_generation=$3`,
  [current.registry_address, key, rowGeneration(current), event.blockNumber, event.blockHash,
    event.transactionHash, event.logIndex, reasonHash, catalogVersion.toString(),
    new Date(Number(deactivatedAt) * 1000)]);
  if (instance.rowCount !== 1) {
    fail('rwa_lifecycle_structure', 'Registry deactivation instance is missing.');
  }
  await client.query(`UPDATE rwa_registry_asset_lifecycle_current_v2 SET active=false,
    catalog_version=$2,updated_at=now() WHERE asset_version_key=$1`, [key, catalogVersion.toString()]);
  return { disposition: 'deactivation_applied', localRecordId: null };
}

export async function applyFinalizedRwaActivationEvents(client, decodedBatch) {
  queryClient(client);
  const events = orderedBatch(decodedBatch, new Set([
    'PublisherSet', 'AssetVersionRegistered', 'AssetVersionActivated', 'AssetVersionDeactivated',
  ]));
  if (new Set(events.flatMap((event) => event.assetVersionKey ? [event.assetVersionKey] : [])).size
      > MAX_TOUCHED_ASSETS) fail('rwa_lifecycle_capacity', 'Registry lifecycle work exceeds its asset bound.');
  // Validate all event-local invariants before the first projection write.  This is
  // also required by the pg-mem harness, whose transaction rollback is not a
  // substitute for the production transaction's fail-before-write discipline.
  for (const event of events) {
    if (event.kind === 'AssetVersionActivated') {
      const approvedAt = BigInt(decimal(event.approvedAt, 'approved time', { bits: 64 }));
      const validUntil = BigInt(decimal(event.validUntil, 'valid-until time', { bits: 64 }));
      const includedAt = BigInt(event.blockTimestamp);
      if (validUntil !== approvedAt + ACTIVATION_TTL || includedAt < approvedAt || includedAt >= validUntil) {
        fail('rwa_lifecycle_timestamp', 'Registry activation timestamp is invalid.');
      }
    } else if (event.kind === 'AssetVersionDeactivated'
      && decimal(event.deactivatedAt, 'deactivation time', { bits: 64 }) !== event.blockTimestamp) {
      fail('rwa_lifecycle_timestamp', 'Registry deactivation time is invalid.');
    } else if (event.kind === 'AssetVersionRegistered'
      && decimal(event.registeredAt, 'registration time', { bits: 64 }) !== event.blockTimestamp) {
      fail('rwa_lifecycle_structure', 'Malformed Registry registration.');
    }
  }
  await validateCatalogGrammar(client, events);
  const results = [];
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (event.kind === 'PublisherSet') {
      const publisher = getAddress(String(event.publisher)).toLowerCase();
      const checkpoint = (await client.query(`SELECT registry_address FROM rwa_registry_lifecycle_checkpoint_v2
        WHERE consumer_key=$1`, [CONSUMER_KEY])).rows[0];
      if (!checkpoint?.registry_address) fail('rwa_lifecycle_unconfigured', 'Registry lifecycle is unconfigured.');
      await client.query(`INSERT INTO rwa_registry_publisher_history_v2
        (chain_id,registry_address,publisher,block_number,block_hash,block_timestamp,
         transaction_hash,transaction_index,log_index)
        VALUES (4663,$1,$2,$3,$4,$5,$6,$7,$8)`,
      [checkpoint.registry_address, publisher, event.blockNumber, event.blockHash,
        event.blockTimestamp, event.transactionHash, event.transactionIndex, event.logIndex]);
      await client.query(`INSERT INTO rwa_registry_publisher_current_v2
        (chain_id,registry_address,publisher,block_number,block_hash,block_timestamp,
         transaction_hash,transaction_index,log_index)
        VALUES (4663,$1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (chain_id,registry_address) DO UPDATE SET publisher=EXCLUDED.publisher,
          block_number=EXCLUDED.block_number,block_hash=EXCLUDED.block_hash,
          block_timestamp=EXCLUDED.block_timestamp,transaction_hash=EXCLUDED.transaction_hash,
          transaction_index=EXCLUDED.transaction_index,log_index=EXCLUDED.log_index,updated_at=now()`,
      [checkpoint.registry_address, publisher, event.blockNumber, event.blockHash,
        event.blockTimestamp, event.transactionHash, event.transactionIndex, event.logIndex]);
      results.push({ disposition: 'publisher_applied', localRecordId: null });
    } else if (event.kind === 'AssetVersionRegistered') {
      results.push(await insertRegistration(client, event));
    } else if (event.kind === 'AssetVersionDeactivated') {
      let nextIndex = index + 1;
      while (events[nextIndex]?.kind === 'AssetVersionDeactivated'
        && eventTransactionIdentity(events[nextIndex]) === eventTransactionIdentity(event)) nextIndex += 1;
      const nextActivation = events[nextIndex];
      const shared = nextActivation?.kind === 'AssetVersionActivated'
        && nextActivation.transactionHash === event.transactionHash
        && nextActivation.transactionIndex === event.transactionIndex
        && String(nextActivation.catalogVersion) === String(event.catalogVersion);
      results.push(await deactivate(client, event, { allowSharedCatalog: shared }));
    } else {
      const previous = events[index - 1];
      const sharedCatalog = previous?.kind === 'AssetVersionDeactivated'
        && previous.transactionHash === event.transactionHash
        && previous.transactionIndex === event.transactionIndex
        && String(previous.catalogVersion) === String(event.catalogVersion);
      results.push(await activate(client, event, { sharedCatalog }));
    }
  }
  return results;
}

export async function applyFinalizedRwaBallotEvents(client, decodedBatch) {
  queryClient(client);
  const events = orderedBatch(decodedBatch, new Set(['BallotPublished']));
  if (new Set(events.map((event) => event.day)).size > MAX_BALLOT_DAYS) {
    fail('rwa_lifecycle_capacity', 'Registry lifecycle work exceeds its ballot bound.');
  }
  const results = [];
  for (const event of events) {
    const key = hash(event.assetVersionKey, 'asset version key', { nonzero: true });
    const current = await currentRow(client, key);
    if (!current) fail('rwa_lifecycle_structure', 'Registry ballot references an unknown version.');
    const day = decimal(event.day, 'ballot day');
    const tokenAddress = address(event.tokenAddress, 'ballot token');
    const tallyHash = hash(event.tallyHash, 'tally hash', { nonzero: true });
    const catalogVersion = decimal(event.catalogVersion, 'catalog version');
    const maxEthWei = decimal(event.maxEthWei, 'maximum ETH', { positive: true });
    const purchaseUntil = decimal(event.purchaseUntil, 'purchase deadline', { bits: 64 });
    const publishedAt = decimal(event.publishedAt, 'published time', { bits: 64 });
    const local = (await client.query('SELECT * FROM ticker_ballot_results_v2 WHERE day=$1', [day])).rows[0];
    let disposition = 'unmatched';
    let localRecordId = null;
    if (local) {
      localRecordId = String(local.day);
      const matched = local.status === 'closed_ready'
        && String(local.asset_version_key ?? '').toLowerCase() === key
        && String(local.token_address ?? '').toLowerCase() === tokenAddress
        && Number(local.token_decimals) === event.tokenDecimals
        && String(local.tally_hash ?? '').toLowerCase() === tallyHash
        && String(local.catalog_version) === catalogVersion
        && String(local.max_eth_wei) === maxEthWei
        && epochSeconds(local.purchase_until) === purchaseUntil;
      disposition = matched ? 'matched' : 'drift';
    }
    await client.query(`INSERT INTO rwa_registry_ballot_events_v2
      (chain_id,registry_address,ballot_day,asset_version_key,token_address,token_decimals,
       tally_hash,catalog_version,max_eth_wei,purchase_until,published_at,activation_generation,
       block_number,block_hash,block_timestamp,transaction_hash,transaction_index,log_index)
      VALUES (4663,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [current.registry_address, day, key, tokenAddress, event.tokenDecimals, tallyHash,
      catalogVersion, maxEthWei, purchaseUntil, publishedAt, rowGeneration(current),
      event.blockNumber, event.blockHash, event.blockTimestamp, event.transactionHash,
      event.transactionIndex, event.logIndex]);
    results.push({ disposition, localRecordId });
  }
  return results;
}

async function lockHeadRows(client, runtimeMode = 'SHARE') {
  await client.query('SELECT id FROM rwa_registry_lifecycle_lock_v2 WHERE id=1 FOR SHARE');
  const checkpoint = (await client.query(`SELECT * FROM rwa_registry_lifecycle_checkpoint_v2
    WHERE consumer_key=$1 FOR SHARE`, [CONSUMER_KEY])).rows[0];
  const runtime = (await client.query(`SELECT * FROM rwa_registry_lifecycle_runtime_v2
    WHERE id=1 FOR ${runtimeMode}`)).rows[0];
  return { checkpoint, runtime };
}

async function task5Head(client) {
  await client.query('SELECT id FROM stock_catalog_sync_lock_v2 WHERE id=1 FOR SHARE');
  const checkpoint = (await client.query(`SELECT * FROM stock_catalog_getter_checkpoint_v2
    WHERE consumer_key=$1`, [TASK5_CONSUMER_KEY])).rows[0];
  const state = (await client.query('SELECT * FROM stock_catalog_sync_state_v2 WHERE id=1')).rows[0];
  return { checkpoint, state };
}

function headReceiptEntries(checkpoint, state, runtime) {
  const ready = iso(runtime.ready_verified_at);
  const freshThrough = new Date(new Date(ready).getTime() + READY_SECONDS * 1000).toISOString();
  return [
    ['chainId', CHAIN_ID],
    ['registryAddress', String(checkpoint.registry_address).toLowerCase()],
    ['consumerKey', CONSUMER_KEY],
    ['appliedBlockNumber', String(checkpoint.last_applied_block_number)],
    ['appliedBlockHash', String(checkpoint.last_applied_block_hash).toLowerCase()],
    ['observationHash', String(checkpoint.last_observation_hash).toLowerCase()],
    ['finalizedHorizonBlockNumber', String(checkpoint.finalized_horizon_block_number)],
    ['finalizedHorizonBlockHash', String(checkpoint.finalized_horizon_block_hash).toLowerCase()],
    ['catalogVersion', String(state.catalog_version)],
    ['catalogSnapshotHash', String(state.snapshot_hash).toLowerCase()],
    ['caughtUp', true], ['halted', false], ['readyVerifiedAt', ready], ['freshThrough', freshThrough],
  ];
}

function reconciledHash(value) {
  const text = String(value ?? '');
  if (!/^0x[0-9a-f]{64}$/.test(text) || text === ZERO_HASH) {
    fail('rwa_lifecycle_task5_mismatch', 'Registry lifecycle authority hash is malformed.');
  }
  return text;
}

export async function readFinalizedRwaLifecycleHeadV2(client) {
  queryClient(client);
  const production = config();
  if (!production) fail('rwa_lifecycle_unconfigured', 'Registry lifecycle is unconfigured.');
  const task5 = await task5Head(client).catch((cause) => fail('rwa_lifecycle_unconfigured', 'Registry lifecycle is unconfigured.', cause));
  const { checkpoint, runtime } = await lockHeadRows(client);
  if (!checkpoint || !runtime || !task5.checkpoint || !task5.state) {
    fail('rwa_lifecycle_unconfigured', 'Registry lifecycle is unconfigured.');
  }
  const identityMatches = String(checkpoint.chain_id) === CHAIN_ID
    && String(runtime.chain_id) === CHAIN_ID
    && String(task5.checkpoint.chain_id) === CHAIN_ID
    && String(task5.state.chain_id) === CHAIN_ID
    && sameLower(checkpoint.registry_address, production.registryAddress)
    && sameLower(runtime.registry_address, production.registryAddress)
    && sameLower(task5.checkpoint.contract_address, production.registryAddress)
    && sameLower(task5.state.registry_address, production.registryAddress)
    && String(checkpoint.start_block_number) === production.startBlock
    && String(runtime.start_block_number) === production.startBlock;
  if (!identityMatches) fail('rwa_lifecycle_unconfigured', 'Registry lifecycle identity is unconfigured.');
  if (checkpoint.halted === true || runtime.halted === true) fail('rwa_lifecycle_halted', 'Registry lifecycle is halted.');
  const readyAt = runtime.ready_verified_at == null ? Number.NaN : new Date(runtime.ready_verified_at).getTime();
  const databaseNow = new Date((await client.query(`SELECT ${nowSql()} AS now`)).rows[0].now).getTime();
  if (runtime.sync_in_progress === true || checkpoint.caught_up !== true || runtime.caught_up !== true
    || task5.checkpoint.caught_up !== true || task5.state.caught_up !== true
    || Number(runtime.unresolved_incident_count) !== 0
    || checkpoint.ready_verified_at == null || task5.checkpoint.ready_verified_at == null
    || task5.state.ready_verified_at == null
    || !Number.isFinite(readyAt) || databaseNow > readyAt + READY_SECONDS * 1000) {
    fail('rwa_lifecycle_not_ready', 'Registry lifecycle is not ready.');
  }
  const sameHead = String(checkpoint.last_applied_block_number) === String(task5.checkpoint.last_applied_block_number)
    && String(checkpoint.last_applied_block_hash).toLowerCase()
      === String(task5.checkpoint.last_applied_block_hash).toLowerCase()
    && String(checkpoint.last_applied_block_number) === String(task5.state.finalized_block_number)
    && sameLower(checkpoint.last_applied_block_hash, task5.state.finalized_block_hash)
    && String(checkpoint.finalized_horizon_block_number) === String(runtime.finalized_horizon_block_number)
    && sameLower(checkpoint.finalized_horizon_block_hash, runtime.finalized_horizon_block_hash)
    && String(checkpoint.last_applied_block_number) === String(runtime.last_applied_block_number)
    && sameLower(checkpoint.last_applied_block_hash, runtime.last_applied_block_hash)
    && String(task5.checkpoint.finalized_horizon_number) === String(task5.state.finalized_horizon_number)
    && sameLower(task5.checkpoint.finalized_horizon_hash, task5.state.finalized_horizon_hash)
    && String(task5.checkpoint.finalized_horizon_number) === String(checkpoint.finalized_horizon_block_number)
    && sameLower(task5.checkpoint.finalized_horizon_hash, checkpoint.finalized_horizon_block_hash);
  if (!sameHead) fail('rwa_lifecycle_task5_mismatch', 'Registry lifecycle and catalog disagree.');
  for (const value of [checkpoint.last_applied_block_hash, checkpoint.last_observation_hash,
    checkpoint.finalized_horizon_block_hash, task5.state.snapshot_hash]) reconciledHash(value);
  await reconcileStoredAuthority(client, task5.state, production.registryAddress);
  const receipt = frozenRecord(headReceiptEntries(checkpoint, task5.state, runtime));
  HEAD_RECEIPT_CLIENTS.set(receipt, client);
  return receipt;
}

function assertHeadReceipt(value, client) {
  const keys = ['chainId', 'registryAddress', 'consumerKey', 'appliedBlockNumber', 'appliedBlockHash',
    'observationHash', 'finalizedHorizonBlockNumber', 'finalizedHorizonBlockHash', 'catalogVersion',
    'catalogSnapshotHash', 'caughtUp', 'halted', 'readyVerifiedAt', 'freshThrough'];
  if (!plainObject(value, keys) || !Object.isFrozen(value) || Object.getPrototypeOf(value) !== null
    || HEAD_RECEIPT_CLIENTS.get(value) !== client) {
    fail('rwa_activation_input', 'Invalid lifecycle head receipt.');
  }
}

function activationOrder(instance) {
  return [BigInt(String(instance.activation_block_number)),
    BigInt(String(instance.activation_transaction_index)), BigInt(String(instance.activation_log_index))];
}

function activationPrecedes(left, right) {
  const a = activationOrder(left);
  const b = activationOrder(right);
  return a[0] < b[0] || (a[0] === b[0] && (a[1] < b[1]
    || (a[1] === b[1] && a[2] < b[2])));
}

async function validatedActivationInstance(client, registryAddress, key, generation, currentGeneration) {
  const instance = (await client.query(`SELECT * FROM rwa_registry_activation_instances_v2
    WHERE registry_address=$1 AND asset_version_key=$2 AND activation_generation=$3 FOR SHARE`,
  [registryAddress, key, generation])).rows[0] ?? null;
  if (!instance) return null;
  const fact = (await client.query(`SELECT i.*,r.event_kind AS result_event_kind,
      r.disposition AS result_disposition,r.local_record_id AS result_local_record_id,
      r.detail_code AS result_detail_code
    FROM rwa_registry_lifecycle_inbox_v2 i
    JOIN rwa_registry_lifecycle_event_results_v2 r ON r.inbox_id=i.inbox_id
    WHERE i.contract_address=$1 AND i.block_hash=$2 AND i.transaction_hash=$3 AND i.log_index=$4`,
  [registryAddress, instance.activation_block_hash, instance.activation_transaction_hash,
    instance.activation_log_index])).rows[0];
  let proposal = null;
  if (fact?.result_detail_code === 'matched' || fact?.result_detail_code === 'drift') {
    proposal = (await client.query(`SELECT nomination_id,asset_version_key,registry_address,
        evidence_hash,review_id,approved_at,valid_until
      FROM rwa_nomination_safe_proposals_v2 WHERE review_id=$1`,
    [String(instance.review_id).toLowerCase()])).rows[0] ?? null;
  }
  const expectedProposalId = proposal?.nomination_id ?? null;
  const proposalFactExact = proposal != null
    && sameLower(proposal.asset_version_key, key)
    && sameLower(proposal.registry_address, registryAddress)
    && sameLower(proposal.evidence_hash, instance.evidence_hash)
    && sameLower(proposal.review_id, instance.review_id)
    && epochSeconds(proposal.approved_at) === epochSeconds(instance.approved_at)
    && epochSeconds(proposal.valid_until) === epochSeconds(instance.valid_until);
  const resultExact = instance.local_match === true
    ? fact?.result_disposition === 'activation_matched' && fact.result_detail_code === 'matched'
      && proposalFactExact
      && expectedProposalId != null && String(fact.result_local_record_id) === String(expectedProposalId)
      && String(instance.local_match_record_id) === String(expectedProposalId)
    : (fact?.result_disposition === 'activation_provenance_unmatched'
        && fact.result_detail_code === 'unmatched' && fact.result_local_record_id == null)
      || (fact?.result_disposition === 'drift' && fact.result_detail_code === 'drift'
        && expectedProposalId != null && !proposalFactExact
        && String(fact.result_local_record_id) === String(expectedProposalId));
  const factExact = fact && resultExact && fact.event_kind === 'AssetVersionActivated'
    && fact.result_event_kind === 'AssetVersionActivated'
    && String(fact.chain_id) === CHAIN_ID && sameLower(fact.contract_address, registryAddress)
    && sameLower(fact.asset_version_key, key)
    && String(fact.block_number) === String(instance.activation_block_number)
    && sameLower(fact.block_hash, instance.activation_block_hash)
    && String(fact.transaction_index) === String(instance.activation_transaction_index)
    && sameLower(fact.transaction_hash, instance.activation_transaction_hash)
    && String(fact.log_index) === String(instance.activation_log_index)
    && sameLower(fact.evidence_hash, instance.evidence_hash)
    && sameLower(fact.review_id, instance.review_id)
    && String(fact.approved_at) === epochSeconds(instance.approved_at)
    && String(fact.valid_until) === epochSeconds(instance.valid_until)
    && String(fact.block_timestamp) === epochSeconds(instance.included_at)
    && String(fact.catalog_version) === String(instance.catalog_version);
  const generationNumber = BigInt(generation);
  let neighborsExact = true;
  if (generationNumber > 1n) {
    const previous = (await client.query(`SELECT * FROM rwa_registry_activation_instances_v2
      WHERE registry_address=$1 AND asset_version_key=$2 AND activation_generation=$3`,
    [registryAddress, key, (generationNumber - 1n).toString()])).rows[0];
    neighborsExact = previous != null && activationPrecedes(previous, instance);
  }
  if (neighborsExact && generationNumber < BigInt(currentGeneration)) {
    const next = (await client.query(`SELECT * FROM rwa_registry_activation_instances_v2
      WHERE registry_address=$1 AND asset_version_key=$2 AND activation_generation=$3`,
    [registryAddress, key, (generationNumber + 1n).toString()])).rows[0];
    neighborsExact = next != null && activationPrecedes(instance, next);
  }
  if (!factExact || !neighborsExact) {
    fail('rwa_activation_state_malformed', 'Registry activation state is malformed.');
  }
  return instance;
}

export async function compareFinalizedRwaActivationV2(client, headReceipt, assetVersionKey, expectation) {
  queryClient(client);
  assertHeadReceipt(headReceipt, client);
  const key = hash(assetVersionKey, 'asset version key', { nonzero: true });
  if (!plainObject(expectation, ['observedActivationGeneration'])) {
    fail('rwa_activation_input', 'Invalid activation comparison request.');
  }
  if (typeof expectation.observedActivationGeneration !== 'string') {
    fail('rwa_activation_input', 'Invalid observed activation generation.');
  }
  const observed = decimal(expectation.observedActivationGeneration, 'observed activation generation', { positive: true });
  const lockedHead = await readFinalizedRwaLifecycleHeadV2(client);
  if (Object.keys(headReceipt).some((field) => headReceipt[field] !== lockedHead[field])) {
    fail('rwa_activation_head_changed', 'Registry lifecycle head changed.');
  }
  const current = (await client.query(`SELECT * FROM rwa_registry_asset_lifecycle_current_v2
    WHERE asset_version_key=$1 FOR SHARE`, [key])).rows[0] ?? null;
  const currentRegistered = current !== null;
  const currentActive = current?.active === true;
  const currentGeneration = currentRegistered ? rowGeneration(current) : '0';
  if (currentRegistered && BigInt(observed) > BigInt(currentGeneration)) {
    fail('rwa_activation_state_malformed', 'Registry activation state is malformed.');
  }
  const instance = await validatedActivationInstance(
    client, headReceipt.registryAddress, key, observed, currentGeneration);
  const exists = instance !== null;
  const localMatch = exists && instance.local_match === true;
  const deactivated = exists && instance.deactivated_at != null;
  if ((exists && (!sameLower(instance.registry_address, headReceipt.registryAddress)
      || (instance.local_match === true) !== (instance.local_match_record_id != null)
      || (instance.deactivation_block_number == null) !== (instance.deactivated_at == null)))
    || (exists && (!currentRegistered || BigInt(observed) > BigInt(currentGeneration)))
    || (currentRegistered && (current.registered !== true
      || !sameLower(current.registry_address, headReceipt.registryAddress)
      || (currentActive && currentGeneration === '0')))) {
    fail('rwa_activation_state_malformed', 'Registry activation state is malformed.');
  }
  const same = exists && currentActive && currentGeneration === observed;
  return frozenRecord([
    ['chainId', CHAIN_ID], ['registryAddress', headReceipt.registryAddress], ['assetVersionKey', key],
    ['observedActivationGeneration', observed], ['observedInstanceExists', exists],
    ['observedLocalMatch', localMatch], ['observedDeactivated', deactivated],
    ['currentRegistered', currentRegistered], ['currentActive', currentActive],
    ['currentActivationGeneration', currentGeneration], ['sameAsCurrent', same],
    ['currentCatalogVersion', headReceipt.catalogVersion],
    ['appliedBlockNumber', headReceipt.appliedBlockNumber], ['appliedBlockHash', headReceipt.appliedBlockHash],
  ]);
}

export async function requireFinalizedRwaActivationV2(client, assetVersionKey, expectation) {
  queryClient(client);
  const key = hash(assetVersionKey, 'asset version key', { nonzero: true });
  if (!plainObject(expectation, ['expectedActivationGeneration'])) {
    fail('rwa_activation_input', 'Invalid activation authority request.');
  }
  if (typeof expectation.expectedActivationGeneration !== 'string') {
    fail('rwa_activation_input', 'Invalid expected activation generation.');
  }
  const expected = decimal(expectation.expectedActivationGeneration, 'expected activation generation', { positive: true });
  let head;
  try { head = await readFinalizedRwaLifecycleHeadV2(client); }
  catch (cause) {
    const mapping = {
      rwa_lifecycle_unconfigured: 'rwa_activation_unconfigured',
      rwa_lifecycle_halted: 'rwa_activation_halted',
      rwa_lifecycle_not_ready: 'rwa_activation_not_ready',
      rwa_lifecycle_task5_mismatch: 'rwa_activation_task5_mismatch',
    };
    if (isLifecycleError(cause) && mapping[cause.code]) fail(mapping[cause.code], cause.message, cause);
    throw cause;
  }
  const comparison = await compareFinalizedRwaActivationV2(client, head, key,
    { observedActivationGeneration: expected });
  if (!comparison.observedInstanceExists || !comparison.observedLocalMatch
    || comparison.observedDeactivated || !comparison.currentActive) {
    fail('rwa_activation_not_authoritative', 'Registry activation is not authoritative.');
  }
  if (comparison.currentActivationGeneration !== expected) {
    fail('rwa_activation_generation_stale', 'Registry activation generation changed.');
  }
  const instance = (await client.query(`SELECT * FROM rwa_registry_activation_instances_v2
    WHERE registry_address=$1 AND asset_version_key=$2 AND activation_generation=$3 FOR SHARE`,
  [head.registryAddress, key, expected])).rows[0];
  return frozenRecord([
    ['chainId', CHAIN_ID], ['registryAddress', head.registryAddress], ['assetVersionKey', key],
    ['activationGeneration', expected], ['active', true], ['localMatch', true],
    ['activationBlockNumber', String(instance.activation_block_number)],
    ['activationBlockHash', String(instance.activation_block_hash).toLowerCase()],
    ['activationTransactionHash', String(instance.activation_transaction_hash).toLowerCase()],
    ['activationLogIndex', String(instance.activation_log_index)],
    ['catalogVersion', String(instance.catalog_version)], ['catalogSnapshotHash', head.catalogSnapshotHash],
    ['reviewId', String(instance.review_id).toLowerCase()], ['evidenceHash', String(instance.evidence_hash).toLowerCase()],
    ['approvedAt', epochSeconds(instance.approved_at)], ['validUntil', epochSeconds(instance.valid_until)],
    ['includedAt', epochSeconds(instance.included_at)], ['appliedBlockNumber', head.appliedBlockNumber],
    ['appliedBlockHash', head.appliedBlockHash], ['caughtUp', true], ['halted', false],
  ]);
}

async function startAttempt(pool, production) {
  const client = await pool.connect();
  const next = randomUUID();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM rwa_registry_lifecycle_lock_v2 WHERE id=1 FOR UPDATE');
    const checkpoint = (await client.query(`SELECT * FROM rwa_registry_lifecycle_checkpoint_v2
      WHERE consumer_key=$1 FOR UPDATE`, [CONSUMER_KEY])).rows[0];
    const runtime = (await client.query(`SELECT *,${nowSql()} AS database_now,
      CASE WHEN last_attempt_at IS NULL THEN true
        ELSE ${nowSql()} >= last_attempt_at + INTERVAL '${ATTEMPT_SECONDS} seconds' END AS lease_expired
      FROM rwa_registry_lifecycle_runtime_v2 WHERE id=1 FOR UPDATE`)).rows[0];
    if (!checkpoint || !runtime) fail('rwa_lifecycle_config', 'Registry lifecycle control rows are unavailable.');
    for (const row of [checkpoint, runtime]) {
      const empty = row.registry_address == null && row.start_block_number == null;
      const matches = sameLower(row.registry_address, production.registryAddress)
        && String(row.start_block_number) === production.startBlock;
      if (!empty && !matches) fail('rwa_lifecycle_config', 'Registry lifecycle identity conflicts.');
    }
    if (checkpoint.halted === true || runtime.halted === true) {
      fail('rwa_lifecycle_halted', 'Registry lifecycle is halted.');
    }
    if (checkpoint.registry_address == null) {
      await client.query(`UPDATE rwa_registry_lifecycle_checkpoint_v2
        SET registry_address=$2,start_block_number=$3 WHERE consumer_key=$1`,
      [CONSUMER_KEY, production.registryAddress, production.startBlock]);
    }
    if (runtime.registry_address == null) {
      await client.query(`UPDATE rwa_registry_lifecycle_runtime_v2
        SET registry_address=$1,start_block_number=$2 WHERE id=1`,
      [production.registryAddress, production.startBlock]);
    }
    const now = runtime.database_now;
    if (runtime?.sync_in_progress === true) {
      if (runtime.lease_expired !== true) fail('rwa_lifecycle_sync_busy', 'Registry lifecycle sync is already running.');
      const superseded = await client.query(`UPDATE rwa_registry_lifecycle_attempts_v2 SET status='superseded',
        ended_at=$2,superseded_by_attempt_id=$3 WHERE attempt_id=$1 AND status='started'
        RETURNING attempt_id`,
      [runtime.attempt_id, now, next]);
      if (superseded.rowCount !== 1) fail('rwa_lifecycle_attempt_superseded', 'Registry lifecycle attempt changed.');
    }
    await client.query(`INSERT INTO rwa_registry_lifecycle_attempts_v2
      (attempt_id,status,started_at) VALUES ($1,'started',$2)`, [next, now]);
    const installed = runtime.attempt_id == null
      ? await client.query(`UPDATE rwa_registry_lifecycle_runtime_v2 SET sync_in_progress=true,
          attempt_id=$1,last_attempt_at=$2,ready_verified_at=NULL
          WHERE id=1 AND attempt_id IS NULL AND sync_in_progress=$3 RETURNING id`,
      [next, now, runtime.sync_in_progress === true])
      : await client.query(`UPDATE rwa_registry_lifecycle_runtime_v2 SET sync_in_progress=true,
          attempt_id=$1,last_attempt_at=$2,ready_verified_at=NULL
          WHERE id=1 AND attempt_id=$3 AND sync_in_progress=$4 RETURNING id`,
      [next, now, runtime.attempt_id, runtime.sync_in_progress === true]);
    if (installed.rowCount !== 1) fail('rwa_lifecycle_attempt_superseded', 'Registry lifecycle attempt changed.');
    await client.query('COMMIT');
    return next;
  } catch (cause) {
    await client.query('ROLLBACK').catch(() => {});
    throw cause;
  } finally { client.release(); }
}

async function recordFailure(pool, attemptId, code, halt = false) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM rwa_registry_lifecycle_lock_v2 WHERE id=1 FOR UPDATE');
    await client.query(`SELECT consumer_key FROM rwa_registry_lifecycle_checkpoint_v2
      WHERE consumer_key=$1 FOR UPDATE`, [CONSUMER_KEY]);
    await client.query('SELECT * FROM rwa_registry_lifecycle_runtime_v2 WHERE id=1 FOR UPDATE');
    const attempt = await client.query(`UPDATE rwa_registry_lifecycle_attempts_v2 SET status='failed',
      ended_at=${nowSql()},failure_code=$2 WHERE attempt_id=$1 AND status='started'
      RETURNING attempt_id`, [attemptId, code]);
    if (attempt.rowCount === 0) {
      await client.query('COMMIT');
      return false;
    }
    const runtime = await client.query(`UPDATE rwa_registry_lifecycle_runtime_v2 SET sync_in_progress=false,
      ready_verified_at=NULL,failure_code=$2,halted=halted OR $3,
      unresolved_incident_count=unresolved_incident_count+CASE WHEN $3 THEN 1 ELSE 0 END,
      last_incident_id=CASE WHEN $3 THEN $1 ELSE last_incident_id END
      WHERE id=1 AND attempt_id=$1 AND sync_in_progress=true RETURNING id`,
    [attemptId, code, halt]);
    if (runtime.rowCount !== 1) fail('rwa_lifecycle_attempt_superseded', 'Registry lifecycle attempt changed.');
    if (halt) {
      const checkpoint = await client.query(`UPDATE rwa_registry_lifecycle_checkpoint_v2
        SET halted=true,ready_verified_at=NULL WHERE consumer_key=$1 RETURNING consumer_key`, [CONSUMER_KEY]);
      if (checkpoint.rowCount !== 1) fail('rwa_lifecycle_config', 'Registry lifecycle checkpoint is unavailable.');
    }
    await client.query('COMMIT');
    return true;
  } catch (cause) {
    await client.query('ROLLBACK').catch(() => {});
    throw cause;
  } finally { client.release(); }
}

const RUNTIME_FAILURE_CODES = new Set([
  'rwa_lifecycle_unconfigured', 'rwa_lifecycle_config', 'rwa_lifecycle_input',
  'rwa_lifecycle_rpc', 'rwa_lifecycle_decode', 'rwa_lifecycle_timestamp', 'rwa_lifecycle_structure',
  'rwa_lifecycle_generation', 'rwa_lifecycle_catalog', 'rwa_lifecycle_getter_mismatch',
  'rwa_lifecycle_task5_mismatch', 'rwa_lifecycle_inbox_conflict',
  'rwa_lifecycle_provenance', 'rwa_lifecycle_capacity', 'rwa_lifecycle_reorg',
  'rwa_lifecycle_observation', 'rwa_lifecycle_halted', 'rwa_lifecycle_internal',
]);

const HALTING_FAILURE_CODES = new Set([
  'rwa_lifecycle_decode', 'rwa_lifecycle_timestamp', 'rwa_lifecycle_structure',
  'rwa_lifecycle_generation', 'rwa_lifecycle_catalog', 'rwa_lifecycle_getter_mismatch',
  'rwa_lifecycle_task5_mismatch', 'rwa_lifecycle_inbox_conflict', 'rwa_lifecycle_reorg',
  'rwa_lifecycle_halted',
]);

function haltsConsumer(cause, code) {
  let cursor = cause;
  while (cursor && typeof cursor === 'object') {
    if (cursor.retryable === true) return false;
    cursor = cursor.cause;
  }
  return HALTING_FAILURE_CODES.has(code);
}

function runtimeFailureCode(cause) {
  if (isLifecycleError(cause) && RUNTIME_FAILURE_CODES.has(cause.code)) return cause.code;
  const code = String(cause?.code ?? '');
  if (RUNTIME_FAILURE_CODES.has(code)) return code;
  if (/rpc|transport|timeout/i.test(code)) return 'rwa_lifecycle_rpc';
  if (/reorg|checkpoint_advanced|head_(?:mismatch|regression)/i.test(code)) return 'rwa_lifecycle_reorg';
  if (/oversized|capacity/i.test(code)) return 'rwa_lifecycle_capacity';
  if (/decode|log|event/i.test(code)) return 'rwa_lifecycle_decode';
  if (/fo_/.test(code)) return 'rwa_lifecycle_observation';
  return 'rwa_lifecycle_internal';
}

function observationConfig() {
  const production = config();
  if (!production) fail('rwa_lifecycle_unconfigured', 'Registry lifecycle is unconfigured.');
  return production;
}

function rawClient(publicClient) {
  return Object.freeze({
    finalizedObservationRawTopics: true,
    getChainId: () => publicClient.getChainId(),
    getBlock: (request) => publicClient.getBlock(request),
    getLogs: async ({ address: contractAddress, fromBlock, toBlock, topics }) => {
      const logs = await publicClient.request({ method: 'eth_getLogs', params: [{
        address: contractAddress, fromBlock: numberToHex(fromBlock), toBlock: numberToHex(toBlock), topics,
      }] });
      return Array.isArray(logs) ? logs.map((log) => ({ ...log,
        blockNumber: BigInt(log.blockNumber), transactionIndex: BigInt(log.transactionIndex),
        logIndex: BigInt(log.logIndex) })) : logs;
    },
    readContract: (request) => publicClient.readContract(request),
  });
}

async function lifecycleCheckpoint(pool, production) {
  const row = (await pool.query(`SELECT * FROM rwa_registry_lifecycle_checkpoint_v2
    WHERE consumer_key=$1`, [CONSUMER_KEY])).rows[0];
  if (!row) fail('rwa_lifecycle_config', 'Registry lifecycle checkpoint is unavailable.');
  if (!sameLower(row.registry_address, production.registryAddress)
    || String(row.start_block_number) !== production.startBlock) {
    fail('rwa_lifecycle_config', 'Registry lifecycle checkpoint identity conflicts.');
  }
  if (row.last_applied_block_number == null) return null;
  return {
    chainId: CHAIN_ID, contractAddress: production.registryAddress, startBlock: production.startBlock,
    lastAppliedBlockNumber: String(row.last_applied_block_number),
    lastAppliedBlockHash: String(row.last_applied_block_hash).toLowerCase(),
    lastObservationHash: row.last_observation_hash == null ? null : String(row.last_observation_hash).toLowerCase(),
  };
}

async function pinnedGetters(facade) {
  try {
    const read = (functionName, args = []) => facade.readContract({
      abi: REGISTRY_READ_ABI, functionName, args,
    });
    const publisher = getAddress(String(await read('publisher'))).toLowerCase();
    const catalogVersion = BigInt(await read('catalogVersion')).toString();
    const versionCount = BigInt(await read('versionCount'));
    if (versionCount > BigInt(MAX_REGISTRY_VERSIONS)) {
      fail('rwa_lifecycle_capacity', 'Registry version bound exceeded.');
    }
    const versions = [];
    const seenKeys = new Set();
    for (let index = 0n; index < versionCount; index += 1n) {
      const assetVersionKey = String(await read('versionKeyAt', [index])).toLowerCase();
      if (!/^0x[0-9a-f]{64}$/.test(assetVersionKey) || assetVersionKey === ZERO_HASH
        || seenKeys.has(assetVersionKey)) {
        fail('rwa_lifecycle_getter_mismatch', 'Registry version order is malformed.');
      }
      seenKeys.add(assetVersionKey);
      const activationGeneration = BigInt(await read('activationGeneration', [assetVersionKey])).toString();
      versions.push({ assetVersionKey, activationGeneration });
    }
    return { publisher, catalogVersion, versionCount: versionCount.toString(), versions };
  } catch (cause) {
    if (cause?.name === 'FinalizedObservationDomainError') throw cause;
    const code = isLifecycleError(cause) ? cause.code : 'rwa_lifecycle_getter_mismatch';
    throw FinalizedObservationError.safeDomain(code, cause);
  }
}

function authorityMismatch(code, message) { fail(code, message); }

function zeroEpoch(value) {
  if (value == null) return '0';
  const normalized = epochSeconds(value);
  return normalized || '0';
}

function sameLower(left, right) {
  return String(left ?? '').toLowerCase() === String(right ?? '').toLowerCase();
}

async function requirePublisherProjection(client, registryAddress, expectedPublisher = null,
  mismatchCode = 'rwa_lifecycle_getter_mismatch') {
  const canonicalRegistry = String(registryAddress).toLowerCase();
  const publisher = (await client.query(`SELECT * FROM rwa_registry_publisher_current_v2
    WHERE registry_address=$1`, [canonicalRegistry])).rows[0];
  const latest = (await client.query(`SELECT * FROM rwa_registry_publisher_history_v2
    WHERE registry_address=$1
    ORDER BY block_number DESC,transaction_index DESC,log_index DESC LIMIT 1`, [canonicalRegistry])).rows[0];
  const exact = publisher && latest
    && String(publisher.chain_id) === CHAIN_ID && String(latest.chain_id) === CHAIN_ID
    && sameLower(publisher.registry_address, canonicalRegistry)
    && sameLower(publisher.publisher, latest.publisher)
    && String(publisher.block_number) === String(latest.block_number)
    && sameLower(publisher.block_hash, latest.block_hash)
    && String(publisher.block_timestamp) === String(latest.block_timestamp)
    && sameLower(publisher.transaction_hash, latest.transaction_hash)
    && String(publisher.transaction_index) === String(latest.transaction_index)
    && String(publisher.log_index) === String(latest.log_index)
    && (expectedPublisher == null || sameLower(publisher.publisher, expectedPublisher));
  if (!exact) authorityMismatch(mismatchCode, 'Registry publisher projection disagrees.');
  return publisher;
}

async function reconcilePinnedLifecycle(client, evidence) {
  const getters = evidence.getters;
  if (!getters || !Array.isArray(getters.versions)
    || String(getters.versionCount) !== String(getters.versions.length)) {
    authorityMismatch('rwa_lifecycle_getter_mismatch', 'Registry getter evidence is inconsistent.');
  }
  const lifecycleVersions = (await client.query(`SELECT * FROM rwa_registry_asset_lifecycle_current_v2
    ORDER BY registry_index`)).rows;
  const catalog = await globalCatalog(client);
  if (lifecycleVersions.length !== getters.versions.length
    || catalog.toString() !== String(getters.catalogVersion)) {
    authorityMismatch('rwa_lifecycle_getter_mismatch', 'Registry version counts disagree.');
  }
  for (let index = 0; index < getters.versions.length; index += 1) {
    const expected = getters.versions[index];
    const lifecycle = lifecycleVersions[index];
    const lifecycleMatches = String(index) === String(lifecycle?.registry_index)
      && sameLower(expected.assetVersionKey, lifecycle?.asset_version_key)
      && String(expected.activationGeneration) === String(lifecycle?.activation_generation);
    if (!lifecycleMatches) {
      authorityMismatch('rwa_lifecycle_getter_mismatch', 'Registry version projection disagrees.');
    }
  }
  await requirePublisherProjection(client, evidence.identity.contractAddress, getters.publisher);
  return { catalogVersion: String(getters.catalogVersion) };
}

async function reconcileStoredAuthority(client, task5State, registryAddress) {
  const canonicalRegistry = String(registryAddress).toLowerCase();
  const task5Versions = (await client.query(
    'SELECT * FROM stock_asset_versions_v2 ORDER BY registry_index')).rows;
  const lifecycleVersions = (await client.query(`SELECT * FROM rwa_registry_asset_lifecycle_current_v2
    ORDER BY registry_index`)).rows;
  if (task5Versions.length > MAX_REGISTRY_VERSIONS
    || lifecycleVersions.length > MAX_REGISTRY_VERSIONS
    || task5Versions.length !== lifecycleVersions.length) {
    authorityMismatch('rwa_lifecycle_task5_mismatch', 'Registry version counts disagree.');
  }
  const currentInstances = (await client.query(`SELECT a.*
    FROM rwa_registry_activation_instances_v2 a
    JOIN rwa_registry_asset_lifecycle_current_v2 c
      ON c.chain_id=a.chain_id AND c.registry_address=a.registry_address
      AND c.asset_version_key=a.asset_version_key
      AND c.activation_generation=a.activation_generation
    WHERE c.registry_address=$1 AND c.activation_generation>0
    ORDER BY c.registry_index`, [canonicalRegistry])).rows;
  const currentInstancesByKey = new Map(currentInstances.map((instance) =>
    [String(instance.asset_version_key).toLowerCase(), instance]));
  if (currentInstances.length !== lifecycleVersions.filter((row) => BigInt(String(row.activation_generation)) > 0n).length) {
    authorityMismatch('rwa_lifecycle_task5_mismatch', 'Registry current activation history disagrees.');
  }
  for (let index = 0; index < task5Versions.length; index += 1) {
    const task5 = task5Versions[index];
    const lifecycle = lifecycleVersions[index];
    const key = String(lifecycle?.asset_version_key ?? '').toLowerCase();
    const generation = BigInt(String(lifecycle?.activation_generation ?? '-1'));
    const currentInstance = currentInstancesByKey.get(key);
    const instanceExact = generation === 0n ? currentInstance == null
      : currentInstance != null && String(currentInstance.activation_generation) === generation.toString();
    const instanceActive = generation > 0n && currentInstance?.deactivated_at == null;
    const exact = String(index) === String(task5.registry_index)
      && String(index) === String(lifecycle.registry_index)
      && String(task5.chain_id) === CHAIN_ID && String(lifecycle.chain_id) === CHAIN_ID
      && sameLower(lifecycle.registry_address, canonicalRegistry)
      && sameLower(task5.asset_version_key, key)
      && sameLower(task5.ticker_hash, lifecycle.ticker_hash)
      && task5.ticker === lifecycle.ticker && task5.name === lifecycle.name
      && sameLower(task5.token_address, lifecycle.token_address)
      && Number(task5.token_decimals) === Number(lifecycle.token_decimals)
      && sameLower(task5.robinhood_asset_id_hash, lifecycle.robinhood_asset_id_hash)
      && zeroEpoch(task5.registered_at) === String(lifecycle.registered_at)
      && task5.active === lifecycle.active
      && String(task5.last_catalog_version) === String(lifecycle.catalog_version)
      && instanceExact && lifecycle.active === instanceActive
      && zeroEpoch(task5.activated_at) === (currentInstance ? epochSeconds(currentInstance.included_at) : '0')
      && zeroEpoch(task5.deactivated_at) === (currentInstance ? zeroEpoch(currentInstance.deactivated_at) : '0');
    if (!exact) authorityMismatch('rwa_lifecycle_task5_mismatch', 'Registry version projection disagrees.');
  }
  if (String(task5State.catalog_version) !== (await globalCatalog(client)).toString()) {
    authorityMismatch('rwa_lifecycle_task5_mismatch', 'Registry catalog projections disagree.');
  }
  const expectedHeads = [];
  for (const row of lifecycleVersions.filter((version) => version.active === true)) {
    for (const [dimensionType, field] of [
      ['tickerHash', 'ticker_hash'], ['tokenAddress', 'token_address'],
      ['robinhoodAssetIdHash', 'robinhood_asset_id_hash'],
    ]) expectedHeads.push({ dimension_type: dimensionType,
      dimension_value: String(row[field]).toLowerCase(), asset_version_key: String(row.asset_version_key).toLowerCase() });
  }
  expectedHeads.sort((left, right) => left.dimension_type.localeCompare(right.dimension_type)
    || left.dimension_value.localeCompare(right.dimension_value));
  const task5Heads = (await client.query(`SELECT dimension_type,dimension_value,asset_version_key
    FROM stock_asset_active_heads_v2 ORDER BY dimension_type,dimension_value`)).rows;
  if (task5Heads.length !== expectedHeads.length || task5Heads.some((row, index) => {
    const expected = expectedHeads[index];
    return row.dimension_type !== expected.dimension_type
      || !sameLower(row.dimension_value, expected.dimension_value)
      || !sameLower(row.asset_version_key, expected.asset_version_key);
  })) authorityMismatch('rwa_lifecycle_task5_mismatch', 'Registry active heads disagree.');
  await requirePublisherProjection(client, canonicalRegistry, null, 'rwa_lifecycle_task5_mismatch');
}

async function reconcileFinalizedAuthority(client, evidence) {
  const task5Checkpoint = (await client.query(`SELECT * FROM stock_catalog_getter_checkpoint_v2
    WHERE consumer_key=$1`, [TASK5_CONSUMER_KEY])).rows[0];
  const task5State = (await client.query('SELECT * FROM stock_catalog_sync_state_v2 WHERE id=1')).rows[0];
  if (!task5Checkpoint || !task5State || task5Checkpoint.caught_up !== true || task5State.caught_up !== true
    || String(task5Checkpoint.chain_id) !== CHAIN_ID || String(task5State.chain_id) !== CHAIN_ID
    || !sameLower(task5Checkpoint.contract_address, evidence.identity.contractAddress)
    || !sameLower(task5State.registry_address, evidence.identity.contractAddress)
    || String(task5Checkpoint.last_applied_block_number) !== evidence.head.blockNumber
    || !sameLower(task5Checkpoint.last_applied_block_hash, evidence.head.blockHash)
    || String(task5Checkpoint.finalized_horizon_number) !== evidence.finalizedHorizon.blockNumber
    || !sameLower(task5Checkpoint.finalized_horizon_hash, evidence.finalizedHorizon.blockHash)
    || String(task5State.finalized_block_number) !== evidence.head.blockNumber
    || !sameLower(task5State.finalized_block_hash, evidence.head.blockHash)
    || String(task5State.finalized_horizon_number) !== evidence.finalizedHorizon.blockNumber
    || !sameLower(task5State.finalized_horizon_hash, evidence.finalizedHorizon.blockHash)) {
    authorityMismatch('rwa_lifecycle_task5_mismatch', 'Registry lifecycle and catalog heads disagree.');
  }
  const pinned = await reconcilePinnedLifecycle(client, evidence);
  if (String(task5State.catalog_version) !== pinned.catalogVersion) {
    authorityMismatch('rwa_lifecycle_getter_mismatch', 'Registry getter catalog disagrees.');
  }
  await reconcileStoredAuthority(client, task5State, evidence.identity.contractAddress);
  return { catalogVersion: pinned.catalogVersion, snapshotHash: String(task5State.snapshot_hash).toLowerCase() };
}

function decodeObservation(observation) {
  const blocks = new Map(observation.eventBlocks.map((block) => [block.blockNumber.toString(), block]));
  return Object.freeze(observation.logs.map((log) => {
    let decoded;
    try { decoded = decodeEventLog({ abi: REGISTRY_EVENT_ABI, topics: log.topics, data: log.data, strict: true }); }
    catch (cause) { fail('rwa_lifecycle_decode', 'Registry lifecycle log decode failed.', cause); }
    const block = blocks.get(String(log.blockNumber));
    if (!block) fail('rwa_lifecycle_decode', 'Registry lifecycle event block is absent.');
    const args = decoded.args;
    const common = { kind: decoded.eventName, blockNumber: log.blockNumber, blockHash: log.blockHash,
      blockTimestamp: block.blockTimestamp, transactionHash: log.transactionHash,
      transactionIndex: log.transactionIndex, logIndex: log.logIndex };
    const mapped = decoded.eventName === 'PublisherSet' ? { publisher: args.publisher }
      : decoded.eventName === 'AssetVersionRegistered' ? { assetVersionKey: args.versionKey,
        tickerHash: args.tickerHash, tokenAddress: args.token, robinhoodAssetIdHash: args.robinhoodAssetIdHash,
        ticker: args.ticker, name: args.name, tokenDecimals: Number(args.tokenDecimals), registeredAt: args.registeredAt }
        : decoded.eventName === 'AssetVersionActivated' ? { assetVersionKey: args.versionKey,
          evidenceHash: args.evidenceHash, reviewId: args.reviewId, approvedAt: args.approvedAt,
          validUntil: args.validUntil, catalogVersion: args.catalogVersion }
          : decoded.eventName === 'AssetVersionDeactivated' ? { assetVersionKey: args.versionKey,
            reasonHash: args.reasonHash, deactivatedAt: args.deactivatedAt, catalogVersion: args.catalogVersion }
            : { day: args.day, assetVersionKey: args.versionKey, tokenAddress: args.token,
              tokenDecimals: Number(args.tokenDecimals), tallyHash: args.tallyHash,
              catalogVersion: args.catalogVersion, maxEthWei: args.maxEthWei,
              purchaseUntil: args.purchaseUntil, publishedAt: args.publishedAt };
    return Object.freeze({ ...common, ...mapped });
  }));
}

function eventResultKey(event) {
  return `${event.blockNumber}:${event.transactionIndex}:${event.logIndex}`;
}

const DECODED_HASH_FIELDS = new Set([
  'publisher', 'asset_version_key', 'ticker_hash', 'token_address',
  'robinhood_asset_id_hash', 'evidence_hash', 'review_id', 'reason_hash', 'tally_hash',
]);

function decodedInboxFields(event) {
  return {
    publisher: event.publisher ?? null, asset_version_key: event.assetVersionKey ?? null,
    ticker_hash: event.tickerHash ?? null, token_address: event.tokenAddress ?? null,
    robinhood_asset_id_hash: event.robinhoodAssetIdHash ?? null, ticker: event.ticker ?? null,
    name: event.name ?? null, token_decimals: event.tokenDecimals ?? null,
    registered_at: event.registeredAt ?? null, evidence_hash: event.evidenceHash ?? null,
    review_id: event.reviewId ?? null, approved_at: event.approvedAt ?? null,
    valid_until: event.validUntil ?? null, catalog_version: event.catalogVersion ?? null,
    reason_hash: event.reasonHash ?? null, deactivated_at: event.deactivatedAt ?? null,
    ballot_day: event.day ?? null, tally_hash: event.tallyHash ?? null,
    max_eth_wei: event.maxEthWei ?? null, purchase_until: event.purchaseUntil ?? null,
    published_at: event.publishedAt ?? null,
  };
}

function decodedInboxFieldsMatch(row, fields) {
  return Object.entries(fields).every(([field, expected]) => {
    const actual = row[field];
    if (expected == null) return actual == null;
    return DECODED_HASH_FIELDS.has(field) ? sameLower(actual, expected) : String(actual) === String(expected);
  });
}

function replayResultMatches(row, event, expectedLocalRecordId = null) {
  const local = row.result_local_record_id;
  const detail = row.result_detail_code;
  const disposition = row.result_disposition;
  if (event.kind === 'PublisherSet') {
    return disposition === 'publisher_applied' && detail === 'publisher_applied' && local == null;
  }
  if (event.kind === 'AssetVersionRegistered') {
    return disposition === 'registration_applied' && detail === 'registration_applied' && local == null;
  }
  if (event.kind === 'AssetVersionDeactivated') {
    return disposition === 'deactivation_applied' && detail === 'deactivation_applied' && local == null;
  }
  const prefix = event.kind === 'AssetVersionActivated' ? 'activation' : 'ballot';
  if (detail === 'matched') {
    return disposition === `${prefix}_matched`
      && String(local ?? '') === String(expectedLocalRecordId ?? '');
  }
  if (detail === 'unmatched') return disposition === `${prefix}_provenance_unmatched` && local == null;
  return detail === 'drift' && disposition === 'drift'
    && String(local ?? '') === String(expectedLocalRecordId ?? '');
}

async function expectedReplayLocalRecordId(client, row, event) {
  if (row?.result_detail_code !== 'matched' && row?.result_detail_code !== 'drift') return null;
  if (event.kind === 'AssetVersionActivated') {
    return (await client.query(`SELECT nomination_id
      FROM rwa_nomination_safe_proposals_v2 WHERE review_id=$1`,
    [String(event.reviewId).toLowerCase()])).rows[0]?.nomination_id ?? null;
  }
  return event.kind === 'BallotPublished' ? String(event.day) : null;
}

async function lockSortedDomainRows(client, decoded) {
  const assetKeys = [...new Set(decoded.flatMap((event) =>
    event.assetVersionKey ? [String(event.assetVersionKey).toLowerCase()] : []))].sort();
  if (assetKeys.length) {
    const placeholders = assetKeys.map((_, index) => `$${index + 1}`).join(',');
    await client.query(`SELECT asset_version_key FROM rwa_registry_asset_lifecycle_current_v2
      WHERE asset_version_key IN (${placeholders}) ORDER BY asset_version_key FOR UPDATE`, assetKeys);
  }
  const reviewIds = [...new Set(decoded.flatMap((event) =>
    event.reviewId ? [String(event.reviewId).toLowerCase()] : []))].sort();
  if (reviewIds.length) {
    const placeholders = reviewIds.map((_, index) => `$${index + 1}`).join(',');
    await client.query(`SELECT review_id FROM rwa_nomination_safe_proposals_v2
      WHERE review_id IN (${placeholders}) ORDER BY review_id FOR UPDATE`, reviewIds);
  }
  const ballotDays = [...new Set(decoded.flatMap((event) =>
    event.day == null ? [] : [String(event.day)]))].sort((left, right) => BigInt(left) < BigInt(right) ? -1 : 1);
  if (ballotDays.length) {
    const placeholders = ballotDays.map((_, index) => `$${index + 1}`).join(',');
    await client.query(`SELECT day FROM ticker_ballot_results_v2
      WHERE day IN (${placeholders}) ORDER BY day FOR UPDATE`, ballotDays);
  }
}

async function foDomain(run) {
  try { return await run(); }
  catch (cause) {
    if (cause?.name === 'FinalizedObservationDomainError') throw cause;
    const code = isLifecycleError(cause) ? cause.code : 'rwa_lifecycle_internal';
    throw FinalizedObservationError.safeDomain(code, cause);
  }
}

function lifecycleAdapter(attemptId, decoded) {
  let applied = false;
  const inboxes = [];
  const projectionResults = new Map();
  let authority = null;
  async function verifyReplayState(client, evidence) {
    if (evidence.logs.length !== decoded.length) fail('rwa_lifecycle_inbox_conflict', 'Registry replay count conflicts.');
    for (let index = 0; index < evidence.logs.length; index += 1) {
      const log = evidence.logs[index];
      const event = decoded[index];
      const inboxId = finalizedInboxIdentity({ chainId: CHAIN_ID,
        contractAddress: evidence.identity.contractAddress, blockHash: log.blockHash,
        transactionHash: log.transactionHash, logIndex: log.logIndex });
      const decodedHash = keccak256(toBytes(JSON.stringify(event,
        (_key, value) => typeof value === 'bigint' ? value.toString() : value)));
       const row = (await client.query(`SELECT i.*,r.event_kind AS result_event_kind,
          r.disposition AS result_disposition,r.local_record_id AS result_local_record_id,
          r.detail_code AS result_detail_code
        FROM rwa_registry_lifecycle_inbox_v2 i
         LEFT JOIN rwa_registry_lifecycle_event_results_v2 r ON r.inbox_id=i.inbox_id
         WHERE i.inbox_id=$1`, [inboxId])).rows[0];
      const expectedLocalRecordId = await expectedReplayLocalRecordId(client, row, event);
      if (!row || row.result_event_kind !== event.kind
        || !replayResultMatches(row, event, expectedLocalRecordId)
        || row.consumer_key !== CONSUMER_KEY || String(row.chain_id) !== CHAIN_ID
        || !sameLower(row.contract_address, evidence.identity.contractAddress)
        || String(row.block_number) !== String(event.blockNumber)
        || !sameLower(row.block_hash, log.blockHash)
        || String(row.block_timestamp) !== String(event.blockTimestamp)
        || !sameLower(row.transaction_hash, log.transactionHash)
        || String(row.transaction_index) !== String(event.transactionIndex)
        || String(row.log_index) !== String(log.logIndex)
        || !sameLower(row.topic0, log.topics[0])
        || row.topics_json !== JSON.stringify(log.topics) || row.data_hex !== log.data
        || row.event_kind !== event.kind || !decodedInboxFieldsMatch(row, decodedInboxFields(event))
        || !sameLower(row.decoded_hash, decodedHash)
        || !sameLower(row.observation_hash, evidence.evidenceHash)) {
        fail('rwa_lifecycle_inbox_conflict', 'Registry replay evidence conflicts.');
      }
    }
  }
  return Object.freeze({
    async lockAndReadCheckpoint(client, evidence) {
      return foDomain(async () => {
        await client.query('SELECT id FROM stock_catalog_sync_lock_v2 WHERE id=1 FOR SHARE');
        const task5Checkpoint = (await client.query(`SELECT * FROM stock_catalog_getter_checkpoint_v2
          WHERE consumer_key=$1`, [TASK5_CONSUMER_KEY])).rows[0];
        const task5State = (await client.query('SELECT * FROM stock_catalog_sync_state_v2 WHERE id=1')).rows[0];
        await client.query('SELECT id FROM rwa_registry_lifecycle_lock_v2 WHERE id=1 FOR UPDATE');
        const checkpoint = (await client.query(`SELECT * FROM rwa_registry_lifecycle_checkpoint_v2
          WHERE consumer_key=$1 FOR UPDATE`, [CONSUMER_KEY])).rows[0];
        const runtime = (await client.query(
          'SELECT * FROM rwa_registry_lifecycle_runtime_v2 WHERE id=1 FOR UPDATE')).rows[0];
        if (runtime?.attempt_id !== attemptId || runtime.sync_in_progress !== true) {
          fail('rwa_lifecycle_attempt_superseded', 'Registry lifecycle attempt was superseded.');
        }
        if (checkpoint?.halted === true || runtime?.halted === true) {
          fail('rwa_lifecycle_halted', 'Registry lifecycle is halted.');
        }
        if (!checkpoint || !sameLower(checkpoint.registry_address, evidence.identity.contractAddress)
          || String(checkpoint.start_block_number) !== evidence.identity.startBlock
          || !sameLower(runtime.registry_address, evidence.identity.contractAddress)
          || String(runtime.start_block_number) !== evidence.identity.startBlock) {
          fail('rwa_lifecycle_config', 'Registry lifecycle authority identity conflicts.');
        }
        if (!task5Checkpoint || !task5State
          || String(task5Checkpoint.chain_id) !== CHAIN_ID || String(task5State.chain_id) !== CHAIN_ID
          || !sameLower(task5Checkpoint.contract_address, evidence.identity.contractAddress)
          || !sameLower(task5State.registry_address, evidence.identity.contractAddress)) {
          fail('rwa_lifecycle_task5_mismatch', 'Registry catalog authority is unavailable.');
        }
        if (task5Checkpoint.last_applied_block_number == null || task5State.finalized_block_number == null) {
          retryableFail('rwa_lifecycle_task5_mismatch', 'Registry catalog has not reached the lifecycle target.');
        }
        const target = BigInt(evidence.head.blockNumber);
        const checkpointHead = BigInt(String(task5Checkpoint.last_applied_block_number));
        const stateHead = BigInt(String(task5State.finalized_block_number));
        if (checkpointHead < target || stateHead < target) {
          retryableFail('rwa_lifecycle_task5_mismatch', 'Registry catalog has not reached the lifecycle target.');
        }
        if ((checkpointHead === target
            && !sameLower(task5Checkpoint.last_applied_block_hash, evidence.head.blockHash))
          || (stateHead === target && !sameLower(task5State.finalized_block_hash, evidence.head.blockHash))) {
          fail('rwa_lifecycle_task5_mismatch', 'Registry lifecycle and catalog target disagree.');
        }
        await lockSortedDomainRows(client, decoded);
        return { chainId: CHAIN_ID, contractAddress: checkpoint.registry_address,
          startBlock: String(checkpoint.start_block_number),
          lastAppliedBlockNumber: checkpoint.last_applied_block_number == null
            ? null : String(checkpoint.last_applied_block_number),
          lastAppliedBlockHash: checkpoint.last_applied_block_hash,
          lastObservationHash: checkpoint.last_observation_hash };
      });
    },
    async insertOrVerifyInbox(client, evidence) {
      return foDomain(async () => {
        if (evidence.logs.length !== decoded.length) fail('rwa_lifecycle_decode', 'Decoded event count is invalid.');
        for (let index = 0; index < evidence.logs.length; index += 1) {
          const log = evidence.logs[index];
          const event = decoded[index];
          const inboxId = finalizedInboxIdentity({ chainId: CHAIN_ID,
            contractAddress: evidence.identity.contractAddress, blockHash: log.blockHash,
            transactionHash: log.transactionHash, logIndex: log.logIndex });
          const decodedJson = JSON.stringify(event,
            (_key, value) => typeof value === 'bigint' ? value.toString() : value);
          const decodedHash = keccak256(toBytes(decodedJson));
          const topicsJson = JSON.stringify(log.topics);
          const fields = decodedInboxFields(event);
          const existing = (await client.query(`SELECT i.*,r.event_kind AS result_event_kind,
              r.disposition AS result_disposition,r.local_record_id AS result_local_record_id,
              r.detail_code AS result_detail_code
            FROM rwa_registry_lifecycle_inbox_v2 i
            LEFT JOIN rwa_registry_lifecycle_event_results_v2 r ON r.inbox_id=i.inbox_id
            WHERE i.inbox_id=$1`, [inboxId])).rows[0];
          if (existing) {
            const expectedLocalRecordId = await expectedReplayLocalRecordId(client, existing, event);
            const decodedFieldsMatch = decodedInboxFieldsMatch(existing, fields);
            const same = decodedFieldsMatch && existing.consumer_key === CONSUMER_KEY
              && String(existing.chain_id) === CHAIN_ID
              && sameLower(existing.contract_address, evidence.identity.contractAddress)
              && String(existing.block_number) === String(event.blockNumber)
              && sameLower(existing.block_hash, event.blockHash)
              && String(existing.block_timestamp) === String(event.blockTimestamp)
              && sameLower(existing.transaction_hash, event.transactionHash)
              && String(existing.transaction_index) === String(event.transactionIndex)
              && String(existing.log_index) === String(event.logIndex)
              && sameLower(existing.topic0, log.topics[0])
              && existing.topics_json === topicsJson && existing.data_hex === log.data
              && existing.event_kind === event.kind
              && sameLower(existing.observation_hash, evidence.evidenceHash)
              && sameLower(existing.decoded_hash, decodedHash)
              && existing.result_event_kind === event.kind
              && replayResultMatches(existing, event, expectedLocalRecordId);
            if (!same) fail('rwa_lifecycle_inbox_conflict', 'Registry lifecycle inbox conflicts.');
          } else {
            await client.query(`INSERT INTO rwa_registry_lifecycle_inbox_v2
              (inbox_id,consumer_key,chain_id,contract_address,block_number,block_hash,block_timestamp,
               transaction_hash,transaction_index,log_index,topic0,topics_json,data_hex,event_kind,
               decoded_hash,observation_hash,publisher,asset_version_key,ticker_hash,token_address,
               robinhood_asset_id_hash,ticker,name,token_decimals,registered_at,evidence_hash,review_id,
               approved_at,valid_until,catalog_version,reason_hash,deactivated_at,ballot_day,tally_hash,
               max_eth_wei,purchase_until,published_at)
              VALUES ($1,$2,4663,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
                $20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36)`,
            [inboxId, CONSUMER_KEY, evidence.identity.contractAddress, event.blockNumber, event.blockHash,
              event.blockTimestamp, event.transactionHash, event.transactionIndex, event.logIndex,
              log.topics[0], topicsJson, log.data, event.kind, decodedHash,
              evidence.evidenceHash, ...Object.values(fields)]);
          }
          inboxes.push({ inboxId, kind: event.kind, resultKey: eventResultKey(event) });
        }
      });
    },
    async applyDomainState(client, evidence) {
      return foDomain(async () => {
        validateCatalogTransactionShape(decoded);
        let activationSegment = [];
        for (const event of decoded) {
          if (event.kind === 'BallotPublished') {
            if (activationSegment.length) {
              const results = await applyFinalizedRwaActivationEvents(
                client, Object.freeze(activationSegment));
              activationSegment.forEach((entry, index) =>
                projectionResults.set(eventResultKey(entry), results[index]));
              activationSegment = [];
            }
            const [result] = await applyFinalizedRwaBallotEvents(client, Object.freeze([event]));
            projectionResults.set(eventResultKey(event), result);
          } else activationSegment.push(event);
        }
        if (activationSegment.length) {
          const results = await applyFinalizedRwaActivationEvents(client, Object.freeze(activationSegment));
          activationSegment.forEach((entry, index) =>
            projectionResults.set(eventResultKey(entry), results[index]));
        }
        for (const entry of inboxes) {
          const result = projectionResults.get(entry.resultKey);
          if (!result) fail('rwa_lifecycle_internal', 'Registry event result is unavailable.');
          const disposition = entry.kind === 'AssetVersionActivated'
            ? result.disposition === 'matched' ? 'activation_matched'
              : result.disposition === 'drift' ? 'drift' : 'activation_provenance_unmatched'
            : entry.kind === 'BallotPublished'
              ? result.disposition === 'matched' ? 'ballot_matched'
                : result.disposition === 'drift' ? 'drift' : 'ballot_provenance_unmatched'
              : result.disposition;
          const existing = (await client.query(`SELECT * FROM rwa_registry_lifecycle_event_results_v2
            WHERE inbox_id=$1`, [entry.inboxId])).rows[0];
          if (existing) {
            if (existing.event_kind !== entry.kind || existing.disposition !== disposition
              || String(existing.local_record_id ?? '') !== String(result.localRecordId ?? '')) {
              fail('rwa_lifecycle_inbox_conflict', 'Registry event result conflicts.');
            }
          } else {
            await client.query(`INSERT INTO rwa_registry_lifecycle_event_results_v2
              (inbox_id,event_kind,disposition,local_record_id,detail_code)
              VALUES ($1,$2,$3,$4,$5)`, [entry.inboxId, entry.kind, disposition,
              result.localRecordId, result.disposition]);
          }
        }
        if (evidence.caughtUp) authority = await reconcileFinalizedAuthority(client, evidence);
        else await reconcilePinnedLifecycle(client, evidence);
        applied = true;
      });
    },
    async advanceCheckpoint(client, evidence) {
      return foDomain(async () => {
        const ready = evidence.caughtUp === true && authority !== null;
        await client.query(`UPDATE rwa_registry_lifecycle_checkpoint_v2 SET
          last_applied_block_number=$2,last_applied_block_hash=$3,last_observation_hash=$4,
          finalized_horizon_block_number=$5,finalized_horizon_block_hash=$6,caught_up=$7,
          verified_at=${nowSql()},ready_verified_at=CASE WHEN $8 THEN ${nowSql()} ELSE NULL END
          WHERE consumer_key=$1`, [CONSUMER_KEY, evidence.head.blockNumber, evidence.head.blockHash,
          evidence.evidenceHash, evidence.finalizedHorizon.blockNumber, evidence.finalizedHorizon.blockHash,
          evidence.caughtUp, ready]);
        const runtime = await client.query(`UPDATE rwa_registry_lifecycle_runtime_v2 SET sync_in_progress=false,
          registry_address=$7,start_block_number=$8,last_success_at=${nowSql()},
          last_applied_block_number=$2,last_applied_block_hash=$3,
          finalized_horizon_block_number=$4,finalized_horizon_block_hash=$5,caught_up=$6,
          ready_verified_at=CASE WHEN $9 THEN ${nowSql()} ELSE NULL END,failure_code=NULL
          WHERE id=1 AND attempt_id=$1 AND sync_in_progress=true RETURNING id`,
        [attemptId, evidence.head.blockNumber, evidence.head.blockHash,
          evidence.finalizedHorizon.blockNumber, evidence.finalizedHorizon.blockHash, evidence.caughtUp,
          evidence.identity.contractAddress, evidence.identity.startBlock, ready]);
        if (runtime.rowCount !== 1) fail('rwa_lifecycle_attempt_superseded', 'Registry lifecycle attempt was superseded.');
        const attempt = await client.query(`UPDATE rwa_registry_lifecycle_attempts_v2 SET status='succeeded',
          ended_at=${nowSql()},failure_code=NULL WHERE attempt_id=$1 AND status='started' RETURNING attempt_id`,
        [attemptId]);
        if (attempt.rowCount !== 1) fail('rwa_lifecycle_attempt_superseded', 'Registry lifecycle attempt was superseded.');
      });
    },
    async readCommittedResult(client, evidence) {
      return foDomain(async () => {
        if (!applied) {
          await verifyReplayState(client, evidence);
          if (evidence.caughtUp) authority = await reconcileFinalizedAuthority(client, evidence);
          else await reconcilePinnedLifecycle(client, evidence);
          const ready = evidence.caughtUp === true && authority !== null;
          const runtime = await client.query(`UPDATE rwa_registry_lifecycle_runtime_v2 SET
            sync_in_progress=false,last_success_at=${nowSql()},caught_up=$2,
            last_applied_block_number=$3,last_applied_block_hash=$4,
            finalized_horizon_block_number=$5,finalized_horizon_block_hash=$6,
            ready_verified_at=CASE WHEN $7 THEN ${nowSql()} ELSE NULL END,failure_code=NULL
            WHERE id=1 AND attempt_id=$1 AND sync_in_progress=true RETURNING id`,
          [attemptId, evidence.caughtUp, evidence.head.blockNumber, evidence.head.blockHash,
            evidence.finalizedHorizon.blockNumber, evidence.finalizedHorizon.blockHash, ready]);
          if (runtime.rowCount !== 1) fail('rwa_lifecycle_attempt_superseded', 'Registry lifecycle attempt was superseded.');
          const attempt = await client.query(`UPDATE rwa_registry_lifecycle_attempts_v2 SET status='succeeded',
            ended_at=${nowSql()},failure_code=NULL WHERE attempt_id=$1 AND status='started' RETURNING attempt_id`,
          [attemptId]);
          if (attempt.rowCount !== 1) fail('rwa_lifecycle_attempt_superseded', 'Registry lifecycle attempt was superseded.');
        }
        return { synced: applied, replayed: !applied };
      });
    },
  });
}

export async function syncFinalizedRwaRegistryLifecycle(pool) {
  if (!pool || typeof pool.connect !== 'function' || typeof pool.query !== 'function') {
    fail('rwa_lifecycle_input', 'Registry lifecycle sync requires a database pool.');
  }
  const production = observationConfig();
  const attemptId = await startAttempt(pool, production);
  try {
    const checkpoint = await lifecycleCheckpoint(pool, production);
    const publicClient = createPublicClient({ transport: http(production.rpc) });
    const observation = await observeFinalized({ client: rawClient(publicClient),
      identity: { chainId: CHAIN_ID, contractAddress: production.registryAddress, startBlock: production.startBlock },
      checkpoint, topics: TOPICS, limits: LIMITS, readGetters: pinnedGetters });
    const decoded = decodeObservation(observation);
    if (new Set(decoded.filter((event) => event.assetVersionKey).map((event) => event.assetVersionKey)).size > MAX_TOUCHED_ASSETS
      || new Set(decoded.filter((event) => event.day != null).map((event) => String(event.day))).size > MAX_BALLOT_DAYS
      || decoded.filter((event) => event.kind === 'AssetVersionActivated'
        || event.kind === 'BallotPublished').length > MAX_LOCAL_JOINS) {
      fail('rwa_lifecycle_capacity', 'Registry lifecycle work bound exceeded.');
    }
    return await commitFinalizedObservation(pool, observation, lifecycleAdapter(attemptId, decoded));
  } catch (cause) {
    const code = runtimeFailureCode(cause);
    try {
      await recordFailure(pool, attemptId, code, haltsConsumer(cause, code));
    } catch (recordCause) {
      fail('rwa_lifecycle_internal', 'Registry lifecycle failure could not be recorded.', recordCause);
    }
    throw cause;
  }
}
