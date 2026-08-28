import { dbCaps } from './db.js';
import { RwaHealthError } from './rwahealtherror.js';
import { finalizedStockCatalogForHealthV2 } from './stockcatalogv2.js';

const ZERO_HASH = `0x${'00'.repeat(32)}`;
const MAX_I63 = 2n ** 63n - 1n;
const MAX_U256 = 2n ** 256n - 1n;
const STATES = new Set(['healthy', 'health_unknown', 'operational_quarantine', 'stale', 'registry_inactive']);
const PURPOSES = new Set(['ballot_publication', 'purchase_broadcast', 'delivery_start']);
const PREDICATES = [
  ['provider_record', 'provider_record'], ['supported_chain', 'supported_chain'],
  ['ticker_identity', 'ticker_identity'], ['token_identity', 'token_identity'],
  ['token_decimals', 'token_decimals_result'], ['provider_active', 'provider_active'],
  ['fractional_tradable', 'fractional_tradable'],
];
const RESULTS = ['pass', 'unknown', 'verified_failure'];

const fail = (code) => { throw new RwaHealthError(code); };
const bytes32 = (value) => typeof value === 'string' && /^0x[0-9a-f]{64}$/.test(value) && value !== ZERO_HASH;
const decimal = (value, max, positive = false) => {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)) return null;
  const parsed = BigInt(value);
  return parsed <= max && (!positive || parsed > 0n) ? parsed : null;
};
const iso = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) fail('health_state_conflict');
  return date.toISOString();
};
const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
};
const ownData = (value, names) => {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype
      || Reflect.ownKeys(value).length !== names.length) return false;
  return names.every((name) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    return descriptor && Object.hasOwn(descriptor, 'value');
  });
};
const shareLockSql = () => `SELECT id FROM stock_catalog_sync_lock_v2 WHERE id=1${dbCaps.skipLocked ? ' FOR SHARE' : ''}`;
const nowSql = () => dbCaps.skipLocked ? "date_trunc('milliseconds',clock_timestamp())" : 'now()';

async function lockedCatalog(client) {
  // The preliminary acquisition makes Registry authority the first lock even though
  // the frozen catalog seam requires an observed database epoch as an input.
  await client.query(shareLockSql());
  const clock = (await client.query(
    `WITH t AS (SELECT ${nowSql()} AS now) SELECT now,extract(epoch FROM now)::text AS epoch FROM t`,
  )).rows[0];
  const catalog = await finalizedStockCatalogForHealthV2(client, { observedEpochSeconds: String(clock.epoch).split('.')[0] });
  if (!catalog.available) {
    if (catalog.reason === 'stale') fail('health_registry_stale');
    if (catalog.reason === 'changed') fail('health_snapshot_changed');
    fail('health_registry_unavailable');
  }
  return { catalog };
}

function validateActionArgs(assetVersionKey, args) {
  const names = ['expectedEvaluationId', 'purpose', 'expectedEpisodeGeneration',
    'expectedStateSequence', 'expectedEpisodeEventId', 'expectedMaterialEvidenceHash'];
  if (!bytes32(assetVersionKey) || !ownData(args, names) || !bytes32(args.expectedEvaluationId)
      || decimal(args.expectedStateSequence, MAX_I63, true) === null) fail('health_bad_input');
  if (PURPOSES.has(args.purpose)) {
    if (args.expectedEpisodeGeneration !== null || args.expectedEpisodeEventId !== null
        || args.expectedMaterialEvidenceHash !== null) fail('health_bad_input');
    return false;
  }
  if (args.purpose !== 'quarantine_clearance_broadcast'
      || decimal(args.expectedEpisodeGeneration, MAX_U256, true) === null
      || !bytes32(args.expectedEpisodeEventId) || !bytes32(args.expectedMaterialEvidenceHash)) {
    fail('health_bad_input');
  }
  return true;
}

export async function requireFreshRwaHealth(client, assetVersionKey, args) {
  if (!client || typeof client.query !== 'function') fail('health_bad_input');
  const clearance = validateActionArgs(assetVersionKey, args);
  const { catalog } = await lockedCatalog(client);
  const all = [...catalog.activeVersions, ...catalog.historicalVersions];
  const asset = all.find((entry) => entry.assetVersionKey === assetVersionKey);
  if (!asset) fail('health_asset_not_found');
  if (!asset.active) fail('health_blocked');
  if (catalog.activeVersions.length > 2_048) fail('health_capacity_exceeded');

  await client.query(`SELECT id FROM rwa_health_apply_lock_v2 WHERE id=1${dbCaps.skipLocked ? ' FOR UPDATE' : ''}`);
  const runtime = (await client.query(
    'SELECT capacity_exceeded FROM rwa_health_runtime_v2 WHERE registry_address=$1',
    [catalog.registryAddress],
  )).rows[0];
  if (runtime?.capacity_exceeded === true) fail('health_capacity_exceeded');
  const checkedNow = (await client.query(`SELECT ${nowSql()} AS checked_now`)).rows[0]?.checked_now;
  if (!checkedNow) fail('health_state_conflict');
  const row = (await client.query(
    `SELECT c.*,e.provider_record,e.supported_chain,e.ticker_identity,e.token_identity,
            e.token_decimals_result,e.provider_active,e.fractional_tradable,
            $3::timestamptz AS checked_now,
            c.last_observed_at + interval '600 seconds' AS fresh_through,
            $3::timestamptz <= c.last_observed_at + interval '600 seconds' AS is_fresh
       FROM rwa_health_current_v2 c
       LEFT JOIN rwa_health_evaluations_v2 e ON e.evaluation_id=c.last_evaluation_id
      WHERE c.registry_address=$1 AND c.asset_version_key=$2${dbCaps.skipLocked ? ' FOR UPDATE OF c' : ''}`,
    [catalog.registryAddress, assetVersionKey, checkedNow],
  )).rows[0];
  if (!row) fail('health_not_fresh');
  if (String(row.catalog_version) !== catalog.catalogVersion
      || row.catalog_snapshot_hash !== catalog.catalogSnapshotHash) fail('health_snapshot_changed');

  const hasEpisode = row.current_episode_id != null;
  if (!clearance && hasEpisode) fail('health_blocked');
  if (clearance && !hasEpisode) fail('health_blocked');
  if (clearance
      && String(row.current_episode_generation) !== args.expectedEpisodeGeneration) {
    fail('health_snapshot_changed');
  }
  if (clearance && row.clearance_applied_at != null) fail('health_blocked');
  if (row.latest_evaluation_kind !== 'healthy') fail('health_not_fresh');
  const observed = new Date(row.last_observed_at);
  const applied = new Date(row.last_applied_at);
  const checked = new Date(row.checked_now);
  const freshThrough = new Date(row.fresh_through);
  if (![observed, applied, checked, freshThrough].every((date) => Number.isFinite(date.getTime()))
      || row.is_fresh !== true) fail('health_not_fresh');
  if (row.last_evaluation_id !== args.expectedEvaluationId
      || String(row.state_sequence) !== args.expectedStateSequence) fail('health_snapshot_changed');
  if (clearance && (row.latest_episode_event_id !== args.expectedEpisodeEventId
      || row.latest_material_evidence_hash !== args.expectedMaterialEvidenceHash)) {
    fail('health_snapshot_changed');
  }
  return deepFreeze({
    ok: true, purpose: args.purpose, chainId: '4663', registryAddress: catalog.registryAddress,
    catalogVersion: catalog.catalogVersion, catalogSnapshotHash: catalog.catalogSnapshotHash,
    assetVersionKey, evaluationId: row.last_evaluation_id, evaluationKind: 'healthy',
    observedAt: iso(observed), appliedAt: iso(applied), freshThrough: iso(freshThrough),
    stateSequence: String(row.state_sequence), episodeId: clearance ? row.current_episode_id : null,
    episodeGeneration: clearance ? String(row.current_episode_generation) : null,
    latestEpisodeEventId: clearance ? row.latest_episode_event_id : null,
    latestMaterialEvidenceHash: clearance ? row.latest_material_evidence_hash : null,
  });
}

function parseOptions(options) {
  if (options === undefined) return { state: null, limit: 100, cursor: null };
  if (!options || Object.getPrototypeOf(options) !== Object.prototype
      || Reflect.ownKeys(options).some((key) => !['state', 'limit', 'cursor'].includes(key))) fail('health_bad_input');
  const state = options.state ?? null;
  const limit = options.limit ?? 100;
  const cursor = options.cursor ?? null;
  if (!(state === null || STATES.has(state)) || !Number.isInteger(limit) || limit < 1 || limit > 500
      || !(cursor === null || typeof cursor === 'string')) fail('health_bad_input');
  return { state, limit, cursor };
}

function cursorObject(cursor) {
  if (cursor === null) return null;
  let text;
  try { text = Buffer.from(cursor, 'base64url').toString('utf8'); } catch { fail('health_bad_input'); }
  let value;
  try { value = JSON.parse(text); } catch { fail('health_bad_input'); }
  const names = ['kind', 'state', 'catalogSnapshotHash', 'registryAddress', 'assetVersionKey'];
  if (!ownData(value, names) || value.kind !== 'rwa_health_v2'
      || !(value.state === null || STATES.has(value.state)) || !bytes32(value.catalogSnapshotHash)
      || !/^0x[0-9a-f]{40}$/.test(value.registryAddress) || !bytes32(value.assetVersionKey)
      || Buffer.from(JSON.stringify(value)).toString('base64url') !== cursor) fail('health_bad_input');
  return value;
}

function projection(asset, row, effectiveState, registryAddress) {
  const predicateSummary = PREDICATES.map(([code, column]) => ({
    code, result: row && Number.isInteger(Number(row[column])) ? RESULTS[Number(row[column])] : 'unknown',
  }));
  const observed = row?.last_observed_at ? iso(row.last_observed_at) : null;
  const applied = row?.last_applied_at ? iso(row.last_applied_at) : null;
  const freshThrough = row?.last_observed_at ? iso(new Date(new Date(row.last_observed_at).getTime() + 600_000)) : null;
  return deepFreeze({
    chainId: '4663', registryAddress,
    assetVersionKey: asset.assetVersionKey, normalizedTicker: asset.normalizedTicker,
    tokenAddress: asset.tokenAddress, tokenDecimals: asset.tokenDecimals,
    active: asset.active, state: effectiveState, ready: effectiveState === 'healthy',
    evaluationId: row?.last_evaluation_id ?? null, evaluationKind: row?.latest_evaluation_kind ?? null,
    observedAt: observed, appliedAt: applied, freshThrough,
    predicateSummary, expectedIdentityHash: row?.expected_identity_hash ?? null,
    predicateCommitment: row?.predicate_commitment ?? null,
    evidenceHash: row?.last_evaluation_evidence_hash ?? null,
    stateSequence: row?.state_sequence == null ? null : String(row.state_sequence),
    episodeId: row?.current_episode_id ?? null,
    episodeGeneration: row?.current_episode_generation == null ? null : String(row.current_episode_generation),
    episodeSeverity: row?.current_severity ?? null, episodeOpenedAt: row?.episode_opened_at ? iso(row.episode_opened_at) : null,
    latestEpisodeEventId: row?.latest_episode_event_id ?? null,
    latestMaterialEvidenceHash: row?.latest_material_evidence_hash ?? null,
    clearanceId: row?.clearance_id ?? null,
    clearanceGeneration: row?.clearance_generation == null ? null : String(row.clearance_generation),
    clearanceAppliedAt: row?.clearance_applied_at ? iso(row.clearance_applied_at) : null,
  });
}

function effective(asset, row, now, catalog) {
  if (!asset.active) return 'registry_inactive';
  if (row?.current_severity) return row.current_severity;
  if (!row || String(row.catalog_version) !== catalog.catalogVersion
      || row.catalog_snapshot_hash !== catalog.catalogSnapshotHash) return 'stale';
  if (row.latest_evaluation_kind !== 'healthy' || !row.last_observed_at
      || now > new Date(row.last_observed_at).getTime() + 600_000) return 'stale';
  return 'healthy';
}

async function readSnapshot(pool, options, exactKey = null) {
  if (!pool || typeof pool.connect !== 'function') fail('health_bad_input');
  const client = await pool.connect();
  try {
    await client.query(dbCaps.skipLocked
      ? 'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ' : 'BEGIN');
    const { catalog } = await lockedCatalog(client);
    const exactClause = exactKey === null ? '' : ' AND c.asset_version_key=$2';
    const rows = (await client.query(
      `SELECT c.*,e.expected_identity_hash,e.predicate_commitment,e.provider_record,
              e.supported_chain,e.ticker_identity,e.token_identity,e.token_decimals_result,
              e.provider_active,e.fractional_tradable
         FROM rwa_health_current_v2 c LEFT JOIN rwa_health_evaluations_v2 e
           ON e.evaluation_id=c.last_evaluation_id
        WHERE c.registry_address=$1${exactClause}
        ORDER BY c.registry_address ASC,c.asset_version_key ASC`,
      exactKey === null ? [catalog.registryAddress] : [catalog.registryAddress, exactKey],
    )).rows;
    const runtime = (await client.query(
      'SELECT capacity_exceeded FROM rwa_health_runtime_v2 WHERE registry_address=$1',
      [catalog.registryAddress],
    )).rows[0];
    if (runtime?.capacity_exceeded === true) fail('health_capacity_exceeded');
    const checkedNow = (await client.query(`SELECT ${nowSql()} AS now`)).rows[0]?.now;
    if (!checkedNow) fail('health_state_conflict');
    const byKey = new Map(rows.map((row) => [row.asset_version_key, row]));
    const assets = [...catalog.historicalVersions, ...catalog.activeVersions]
      .filter((asset) => exactKey === null || asset.assetVersionKey === exactKey)
      .sort((a, b) => a.assetVersionKey.localeCompare(b.assetVersionKey));
    const now = new Date(checkedNow).getTime();
    if (!Number.isFinite(now)) fail('health_state_conflict');
    const projected = assets.map((asset) => {
      const row = byKey.get(asset.assetVersionKey);
      return projection(asset, row, effective(asset, row, now, catalog), catalog.registryAddress);
    });
    await client.query('COMMIT');
    if (exactKey !== null) return projected.find((item) => item.assetVersionKey === exactKey) ?? null;
    return { catalog, projected, options };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* preserve original */ }
    throw error;
  } finally { client.release(); }
}

export async function rwaHealthBoard(pool, options) {
  const parsed = parseOptions(options);
  const suppliedCursor = cursorObject(parsed.cursor);
  const snapshot = await readSnapshot(pool, parsed);
  if (suppliedCursor && suppliedCursor.state !== parsed.state) fail('health_bad_input');
  if (suppliedCursor && (suppliedCursor.catalogSnapshotHash !== snapshot.catalog.catalogSnapshotHash
      || suppliedCursor.registryAddress !== snapshot.catalog.registryAddress)) fail('health_snapshot_changed');
  let items = snapshot.projected.filter((item) => parsed.state === null || item.state === parsed.state);
  if (suppliedCursor) items = items.filter((item) => item.assetVersionKey > suppliedCursor.assetVersionKey);
  const hasMore = items.length > parsed.limit;
  items = items.slice(0, parsed.limit);
  const last = items.at(-1);
  const nextCursor = hasMore && last ? Buffer.from(JSON.stringify({
    kind: 'rwa_health_v2', state: parsed.state,
    catalogSnapshotHash: snapshot.catalog.catalogSnapshotHash,
    registryAddress: snapshot.catalog.registryAddress, assetVersionKey: last.assetVersionKey,
  })).toString('base64url') : null;
  return deepFreeze({ items, hasMore, nextCursor });
}

export async function rwaHealthDetail(pool, assetVersionKey) {
  if (!bytes32(assetVersionKey)) fail('health_bad_input');
  const item = await readSnapshot(pool, null, assetVersionKey);
  if (!item) fail('health_asset_not_found');
  return item;
}
