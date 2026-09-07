import { getAddress } from 'viem';

import { dbCaps } from './db.js';

const CHAIN_ID = '4663';
const CONSUMER_KEY = 'rwa_health_overlay_v2';
const READY_SECONDS = 600;
const ZERO_ADDRESS = `0x${'0'.repeat(40)}`;
const ZERO_HASH = `0x${'0'.repeat(64)}`;
const UINT256_MAX = (1n << 256n) - 1n;

export const RWA_HEALTH_OVERLAY_ERROR_CODES = Object.freeze([
  'h2_input', 'h2_readiness_input', 'h2_unconfigured', 'h2_not_ready', 'h2_halted',
  'h2_authority_incident', 'h2_readiness_stale', 'h2_readiness_changed',
  'h2_health_not_authoritative', 'h2_activation_not_authoritative',
  'h2_semantic_conflict', 'h2_approval_stale', 'h2_submission_conflict',
  'h2_submission_terminal', 'h2_package_not_found', 'h2_contention', 'h2_internal',
]);

const ERROR_MESSAGES = Object.freeze(Object.assign(Object.create(null), {
  h2_input: 'RWA health overlay input is invalid.',
  h2_readiness_input: 'RWA health overlay readiness input is invalid.',
  h2_unconfigured: 'RWA health overlay authority is unconfigured.',
  h2_not_ready: 'RWA health overlay authority is not ready.',
  h2_halted: 'RWA health overlay authority is halted.',
  h2_authority_incident: 'RWA health overlay authority is under review.',
  h2_readiness_stale: 'RWA health overlay readiness is stale.',
  h2_readiness_changed: 'RWA health overlay readiness changed.',
  h2_health_not_authoritative: 'RWA health authority is unavailable.',
  h2_activation_not_authoritative: 'RWA activation authority is unavailable.',
  h2_semantic_conflict: 'RWA health clearance request conflicts.',
  h2_approval_stale: 'RWA health clearance approval is stale.',
  h2_submission_conflict: 'RWA health clearance submission conflicts.',
  h2_submission_terminal: 'RWA health clearance submission is terminal.',
  h2_package_not_found: 'RWA health clearance package was not found.',
  h2_contention: 'RWA health overlay state changed.',
  h2_internal: 'RWA health overlay operation failed.',
}));

export class RwaHealthOverlayError extends Error {
  static CODES = RWA_HEALTH_OVERLAY_ERROR_CODES;

  constructor(code, cause) {
    if (!RWA_HEALTH_OVERLAY_ERROR_CODES.includes(code)) {
      throw new TypeError('invalid RWA health overlay error code');
    }
    super(ERROR_MESSAGES[code], cause === undefined ? undefined : { cause });
    this.name = 'RwaHealthOverlayError';
    this.code = code;
  }
}

const fail = (code, cause) => { throw new RwaHealthOverlayError(code, cause); };

function queryClient(client, code) {
  if (!client || typeof client.query !== 'function') fail(code);
  return client;
}

function canonicalDecimal(value, { positive = false } = {}) {
  if (typeof value !== 'string' || !/^(?:0|[1-9][0-9]*)$/.test(value)) return null;
  const parsed = BigInt(value);
  if (parsed > UINT256_MAX || (positive && parsed === 0n)) return null;
  return value;
}

function rowDecimal(value, options) {
  if (value === null || value === undefined) return null;
  return canonicalDecimal(typeof value === 'bigint' ? value.toString() : String(value), options);
}

function canonicalHash(value, { nonzero = true } = {}) {
  return typeof value === 'string' && /^0x[0-9a-f]{64}$/.test(value)
    && (!nonzero || value !== ZERO_HASH) ? value : null;
}

function canonicalAddress(value) {
  if (typeof value !== 'string') return null;
  try {
    const result = getAddress(value).toLowerCase();
    return result === ZERO_ADDRESS ? null : result;
  } catch {
    return null;
  }
}

function canonicalIso(value) {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value ? value : null;
}

function rowIso(value) {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function exactNullRecord(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.getPrototypeOf(value) !== null || Reflect.ownKeys(value).length !== keys.length) {
    return false;
  }
  return keys.every((key, index) => {
    if (Reflect.ownKeys(value)[index] !== key) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor?.enumerable === true && Object.hasOwn(descriptor, 'value');
  });
}

function frozenRecord(entries) {
  const result = Object.create(null);
  for (const [key, value] of entries) result[key] = value;
  return Object.freeze(result);
}

function productionIdentity() {
  const registryAddress = canonicalAddress(process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS);
  const overlayAddress = canonicalAddress(process.env.RWA_HEALTH_OVERLAY_V2_ADDRESS);
  const safeAddress = canonicalAddress(process.env.RWA_HEALTH_OVERLAY_V2_SAFE_ADDRESS);
  const startBlockNumber = canonicalDecimal(process.env.RWA_HEALTH_OVERLAY_V2_START_BLOCK ?? '');
  if (!registryAddress || !overlayAddress || !safeAddress || startBlockNumber === null) return null;
  return Object.freeze({ registryAddress, overlayAddress, safeAddress, startBlockNumber });
}

function lockSuffix() { return dbCaps.skipLocked ? ' FOR SHARE' : ''; }
function nowSql() {
  return dbCaps.skipLocked ? "date_trunc('milliseconds',clock_timestamp())" : 'now()';
}

function rowIdentityState(row, identity) {
  if (!row) return 'uninitialized';
  const fields = ['consumer_key', 'chain_id', 'registry_address', 'overlay_address',
    'safe_address', 'start_block_number'];
  if (fields.some((field) => row[field] === null || row[field] === undefined)) return 'uninitialized';
  const matches = String(row.consumer_key) === CONSUMER_KEY && String(row.chain_id) === CHAIN_ID
    && canonicalAddress(String(row.registry_address)) === identity.registryAddress
    && canonicalAddress(String(row.overlay_address)) === identity.overlayAddress
    && canonicalAddress(String(row.safe_address)) === identity.safeAddress
    && rowDecimal(row.start_block_number) === identity.startBlockNumber;
  return matches ? 'matches' : 'conflicts';
}

function headProjection(checkpoint) {
  if (!checkpoint) return null;
  const result = {
    appliedBlockNumber: rowDecimal(checkpoint.last_applied_block_number),
    appliedBlockHash: canonicalHash(String(checkpoint.last_applied_block_hash ?? '')),
    observationHash: canonicalHash(String(checkpoint.last_observation_hash ?? '')),
    finalizedHorizonBlockNumber: rowDecimal(checkpoint.finalized_horizon_block_number),
    finalizedHorizonBlockHash: canonicalHash(String(checkpoint.finalized_horizon_block_hash ?? '')),
  };
  return Object.values(result).every((value) => value !== null) ? result : null;
}

function exactCaughtUpHead(head, identity) {
  if (!head) return false;
  const applied = BigInt(head.appliedBlockNumber);
  const horizon = BigInt(head.finalizedHorizonBlockNumber);
  const start = BigInt(identity.startBlockNumber);
  if (applied !== horizon || head.appliedBlockHash !== head.finalizedHorizonBlockHash) return false;
  return applied >= start || (start > 0n && applied === start - 1n);
}

async function lockAndReadAuthority(client, identity) {
  const singleton = (await client.query(
    `SELECT id FROM rwa_health_overlay_lock_v2 WHERE id=1${lockSuffix()}`,
  )).rows[0] ?? null;
  const checkpoint = (await client.query(
    `SELECT * FROM rwa_health_overlay_checkpoint_v2
      WHERE consumer_key=$1${lockSuffix()}`,
    [CONSUMER_KEY],
  )).rows[0] ?? null;
  const runtime = (await client.query(
    `SELECT * FROM rwa_health_overlay_runtime_v2 WHERE id=1${lockSuffix()}`,
  )).rows[0] ?? null;

  const checkpointIdentity = rowIdentityState(checkpoint, identity);
  const runtimeIdentity = rowIdentityState(runtime, identity);
  if (checkpointIdentity === 'conflicts' || runtimeIdentity === 'conflicts') fail('h2_unconfigured');
  const head = headProjection(checkpoint);
  if (!singleton || checkpointIdentity !== 'matches' || runtimeIdentity !== 'matches'
      || String(singleton.id) !== '1' || String(runtime.id) !== '1'
      || checkpoint?.caught_up !== true || runtime?.caught_up !== true
      || runtime?.sync_in_progress !== false || head === null || !exactCaughtUpHead(head, identity)
      || ![true, false].includes(checkpoint?.halted) || ![true, false].includes(runtime?.halted)
      || rowIso(runtime?.ready_verified_at) === null) {
    fail('h2_not_ready');
  }
  if (checkpoint.halted === true || runtime.halted === true) fail('h2_halted');
  const incidentCount = rowDecimal(runtime.unresolved_authority_incident_count);
  if (incidentCount === null) fail('h2_not_ready');
  if (BigInt(incidentCount) > 0n) fail('h2_authority_incident');

  return { checkpoint, runtime, head };
}

async function readAssetProjection(client, identity, assetVersionKey) {
  const result = await client.query(
    `SELECT registry_address,overlay_address,asset_version_key,overlay_generation
       FROM rwa_health_overlay_asset_state_v2
      WHERE registry_address=$1 AND overlay_address=$2 AND asset_version_key=$3${lockSuffix()}`,
    [identity.registryAddress, identity.overlayAddress, assetVersionKey],
  );
  if (!Array.isArray(result.rows) || result.rows.length > 1) fail('h2_not_ready');
  return result.rows[0] ?? null;
}

async function databaseReadiness(client, readyVerifiedAt) {
  const ready = rowIso(readyVerifiedAt);
  if (ready === null) fail('h2_not_ready');
  const row = (await client.query(
    `WITH h2_clock AS (SELECT ${nowSql()} AS database_now)
     SELECT database_now,$1::timestamptz + INTERVAL '${READY_SECONDS} seconds' AS fresh_through,
            database_now <= $1::timestamptz + INTERVAL '${READY_SECONDS} seconds' AS readiness_fresh
       FROM h2_clock`,
    [readyVerifiedAt],
  )).rows[0];
  const databaseNow = rowIso(row?.database_now);
  const freshThrough = rowIso(row?.fresh_through);
  if (databaseNow === null || freshThrough === null || row?.readiness_fresh !== true) {
    fail('h2_readiness_stale');
  }
  const expectedFreshThrough = new Date(new Date(ready).getTime() + READY_SECONDS * 1000).toISOString();
  if (freshThrough !== expectedFreshThrough) fail('h2_not_ready');
  return { readyVerifiedAt: ready, freshThrough };
}

function readinessReceipt(identity, head, readiness) {
  return frozenRecord([
    ['ok', true], ['consumerKey', CONSUMER_KEY], ['chainId', CHAIN_ID],
    ['registryAddress', identity.registryAddress], ['overlayAddress', identity.overlayAddress],
    ['startBlockNumber', identity.startBlockNumber],
    ['appliedBlockNumber', head.appliedBlockNumber], ['appliedBlockHash', head.appliedBlockHash],
    ['observationHash', head.observationHash],
    ['finalizedHorizonBlockNumber', head.finalizedHorizonBlockNumber],
    ['finalizedHorizonBlockHash', head.finalizedHorizonBlockHash],
    ['caughtUp', true], ['halted', false],
    ['readyVerifiedAt', readiness.readyVerifiedAt], ['freshThrough', readiness.freshThrough],
  ]);
}

export async function requireRwaHealthOverlayReadyV2(client, expectation) {
  queryClient(client, 'h2_readiness_input');
  const keys = ['expectedH2BlockNumber', 'expectedH2BlockHash', 'expectedReadyVerifiedAt'];
  if (!exactNullRecord(expectation, keys)
      || canonicalDecimal(expectation.expectedH2BlockNumber) === null
      || canonicalHash(expectation.expectedH2BlockHash) === null
      || canonicalIso(expectation.expectedReadyVerifiedAt) === null) {
    fail('h2_readiness_input');
  }
  const request = frozenRecord([
    ['expectedH2BlockNumber', expectation.expectedH2BlockNumber],
    ['expectedH2BlockHash', expectation.expectedH2BlockHash],
    ['expectedReadyVerifiedAt', expectation.expectedReadyVerifiedAt],
  ]);
  const identity = productionIdentity();
  if (!identity) fail('h2_unconfigured');
  const authority = await lockAndReadAuthority(client, identity);
  const readiness = await databaseReadiness(client, authority.runtime.ready_verified_at);
  if (request.expectedH2BlockNumber !== authority.head.appliedBlockNumber
      || request.expectedH2BlockHash !== authority.head.appliedBlockHash
      || request.expectedReadyVerifiedAt !== readiness.readyVerifiedAt) {
    fail('h2_readiness_changed');
  }
  return readinessReceipt(identity, authority.head, readiness);
}

export async function readRwaHealthOverlayAuthoringContextV2(client, assetVersionKey) {
  queryClient(client, 'h2_input');
  const key = canonicalHash(assetVersionKey);
  if (key === null) fail('h2_input');
  const identity = productionIdentity();
  if (!identity) fail('h2_unconfigured');
  const authority = await lockAndReadAuthority(client, identity);
  const asset = await readAssetProjection(client, identity, key);
  let currentOverlayGeneration = '0';
  if (asset) {
    if (canonicalAddress(String(asset.registry_address ?? '')) !== identity.registryAddress
        || canonicalAddress(String(asset.overlay_address ?? '')) !== identity.overlayAddress
        || canonicalHash(String(asset.asset_version_key ?? '')) !== key) fail('h2_not_ready');
    currentOverlayGeneration = rowDecimal(asset.overlay_generation, { positive: true });
    if (currentOverlayGeneration === null || BigInt(currentOverlayGeneration) === UINT256_MAX) {
      fail('h2_not_ready');
    }
  }
  const readiness = await databaseReadiness(client, authority.runtime.ready_verified_at);
  const nextOverlayGeneration = (BigInt(currentOverlayGeneration) + 1n).toString();
  return frozenRecord([
    ['chainId', CHAIN_ID], ['consumerKey', CONSUMER_KEY],
    ['registryAddress', identity.registryAddress], ['overlayAddress', identity.overlayAddress],
    ['safeAddress', identity.safeAddress], ['startBlockNumber', identity.startBlockNumber],
    ['appliedBlockNumber', authority.head.appliedBlockNumber],
    ['appliedBlockHash', authority.head.appliedBlockHash],
    ['observationHash', authority.head.observationHash],
    ['finalizedHorizonBlockNumber', authority.head.finalizedHorizonBlockNumber],
    ['finalizedHorizonBlockHash', authority.head.finalizedHorizonBlockHash],
    ['caughtUp', true], ['halted', false],
    ['readyVerifiedAt', readiness.readyVerifiedAt], ['freshThrough', readiness.freshThrough],
    ['assetVersionKey', key], ['currentOverlayGeneration', currentOverlayGeneration],
    ['nextOverlayGeneration', nextOverlayGeneration],
  ]);
}
