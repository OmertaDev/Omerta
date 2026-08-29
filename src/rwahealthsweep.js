import { encodeAbiParameters, keccak256, toBytes } from 'viem';

import { finalizedStockCatalogForHealthV2 } from './stockcatalogv2.js';
import { dbCaps } from './db.js';
import {
  RwaHealthError,
  deriveRwaActiveSetHash,
  deriveRwaBatchId,
  deriveRwaEpisodeEventId,
  deriveRwaEpisodeId,
  deriveRwaEvaluationIds,
  deriveRwaExpectedIdentityHash,
  deriveRwaPageId,
  evaluateRwaHealthAsset,
  fetchRwaHealthProvider,
  healthDbNowSql,
  parseRwaHealthProviderBody,
} from './rwahealth.js';

const MAX_ACTIVE = 2_048;
const PAGE_SIZE = 256;
const RETAIN_DAYS = 35;
const ZERO_HASH = `0x${'00'.repeat(32)}`;
const ENDPOINT_HASH = keccak256(toBytes('https://api.robinhood.com/rhj/assets'));
const tag = (value) => keccak256(toBytes(value));
const RULE_SET_HASH = keccak256(encodeAbiParameters([
  { type: 'bytes32' }, ...Array(7).fill({ type: 'bytes32' }),
  { type: 'uint8' }, { type: 'uint8' }, { type: 'uint8' },
], [
  tag('RWA_HEALTH_RHJ_ASSET_IDENTITY_V2'),
  ...[
    'provider_record', 'supported_chain', 'ticker_identity', 'token_identity',
    'token_decimals', 'provider_active', 'fractional_tradable',
  ].map(tag), 0, 1, 2,
]));

const RESULT = Object.freeze({ pass: 0, unknown: 1, verified_failure: 2 });
const KIND = Object.freeze({ healthy: 0, health_unknown: 1, operational_quarantine: 2 });

function fail(code, message = code) { throw new RwaHealthError(code, message); }
function nowSql() { return healthDbNowSql({ postgres: dbCaps.skipLocked }); }
function pagesFor(count) { return count === 0 ? 0 : Math.ceil(count / PAGE_SIZE); }
function providerFailureCode(error) {
  const closed = new Set([
    'provider_timeout', 'provider_redirect', 'provider_http', 'provider_content_type',
    'provider_content_encoding', 'provider_oversized', 'provider_utf8', 'provider_json',
    'provider_shape', 'provider_identity_malformed', 'provider_identity_duplicate',
  ]);
  return closed.has(error?.providerFailureCode) ? error.providerFailureCode : null;
}
function providerFailureHash(code) {
  return keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'bytes32' }], [
    tag('OMERTA_RWA_HEALTH_PROVIDER_FAILURE_V2'), tag(code),
  ]));
}
function runtimeProviderError(code) {
  if (code === null || code === undefined) return null;
  if (code === 'provider_timeout') return 'health_provider_timeout';
  if (code === 'provider_oversized') return 'health_provider_oversized';
  if (code === 'provider_redirect' || code === 'provider_http') return 'health_provider_http';
  return 'health_provider_malformed';
}
function identityFor(asset, catalog) {
  return {
    chainId: '4663', registryAddress: catalog.registryAddress.toLowerCase(),
    catalogVersion: catalog.catalogVersion,
    catalogSnapshotHash: catalog.catalogSnapshotHash,
    assetVersionKey: asset.assetVersionKey,
    normalizedTicker: asset.normalizedTicker,
    tokenAddress: asset.tokenAddress.toLowerCase(),
    tokenDecimals: asset.tokenDecimals,
    robinhoodAssetIdHash: asset.robinhoodAssetIdHash,
    active: true,
  };
}
function stableCatalog(catalog) {
  return catalog?.available === true && catalog.chainId === '4663'
    && Array.isArray(catalog.activeVersions) && catalog.activeVersions.every((asset, index, all) => (
      asset.active === true && (index === 0 || all[index - 1].assetVersionKey < asset.assetVersionKey)
    ));
}
async function checkedClient(pool) {
  if (!pool || typeof pool.connect !== 'function') fail('health_bad_input');
  return pool.connect();
}
async function rollback(client) { try { await client.query('ROLLBACK'); } catch { /* original wins */ } }

async function preflight(pool) {
  const client = await checkedClient(pool);
  try {
    const row = dbCaps.skipLocked
      ? (await client.query(`WITH t AS (SELECT ${nowSql()} AS now)
          SELECT now,floor(extract(epoch FROM now))::numeric AS epoch_seconds,
                 floor(extract(epoch FROM now)/300)::numeric AS cycle_slot FROM t`)).rows[0]
      : (await client.query('SELECT now() AS now')).rows[0];
    if (!dbCaps.skipLocked && row?.now) {
      const epoch = Math.floor(new Date(row.now).getTime() / 1000);
      row.epoch_seconds = String(epoch);
      row.cycle_slot = String(Math.floor(epoch / 300));
    }
    if (!row?.now || row.cycle_slot == null) fail('health_state_conflict');
    return { observedAt: row.now, observedEpochSeconds: String(row.epoch_seconds), cycleSlot: String(row.cycle_slot) };
  } finally { client.release(); }
}

async function lockedCatalogSnapshot(client) {
  await client.query(`SELECT id FROM stock_catalog_sync_lock_v2 WHERE id=1${dbCaps.skipLocked ? ' FOR SHARE' : ''}`);
  const clock = dbCaps.skipLocked
    ? (await client.query(`WITH t AS (SELECT ${nowSql()} AS now)
        SELECT floor(extract(epoch FROM now))::numeric::text AS epoch FROM t`)).rows[0]
    : (await client.query('SELECT now() AS now')).rows[0];
  if (!dbCaps.skipLocked && clock?.now) {
    clock.epoch = String(Math.floor(new Date(clock.now).getTime() / 1000));
  }
  if (clock?.epoch == null) fail('health_state_conflict');
  return finalizedStockCatalogForHealthV2(client, { observedEpochSeconds: String(clock.epoch) });
}

async function acquireGraph(client, pool) {
  const catalog = await lockedCatalogSnapshot(client);
  if (!catalog.available) {
    if (catalog.reason === 'stale') fail('health_registry_stale');
    if (catalog.reason === 'changed') fail('health_snapshot_changed');
    fail('health_registry_unavailable', `health_registry_unavailable:${catalog.reason}`);
  }
  if (!stableCatalog(catalog)) fail('health_registry_unavailable');
  await client.query(`SELECT id FROM rwa_health_apply_lock_v2 WHERE id=1${dbCaps.skipLocked ? ' FOR UPDATE' : ''}`);
  return catalog;
}

async function writeRuntime(client, pool, catalog, slot, count, error = null, completed = false) {
  const prior = (await client.query(`SELECT last_attempted_slot::text,missed_slot_count::text
    FROM rwa_health_runtime_v2 WHERE registry_address=$1`, [
    catalog.registryAddress.toLowerCase(),
  ])).rows[0];
  const attemptedSlot = BigInt(slot);
  const priorSlot = prior?.last_attempted_slot == null ? null : BigInt(prior.last_attempted_slot);
  const gap = priorSlot !== null && attemptedSlot > priorSlot + 1n
    ? attemptedSlot - priorSlot - 1n : 0n;
  const missedSlotCount = (prior ? BigInt(prior.missed_slot_count) : 0n) + gap;
  if (missedSlotCount > 2n ** 63n - 1n) fail('health_state_conflict');
  await client.query(`INSERT INTO rwa_health_runtime_v2
    (chain_id,registry_address,catalog_version,catalog_snapshot_hash,active_version_count,
     capacity_exceeded,last_attempted_slot,last_completed_slot,missed_slot_count,last_error_code,updated_at)
    VALUES (4663,$1,$2,$3,$4,$5,$6,$7,$8,$9,${nowSql()})
    ON CONFLICT (registry_address) DO UPDATE SET
      catalog_version=EXCLUDED.catalog_version,catalog_snapshot_hash=EXCLUDED.catalog_snapshot_hash,
      active_version_count=EXCLUDED.active_version_count,capacity_exceeded=EXCLUDED.capacity_exceeded,
      last_attempted_slot=EXCLUDED.last_attempted_slot,
      last_completed_slot=COALESCE(EXCLUDED.last_completed_slot,rwa_health_runtime_v2.last_completed_slot),
      missed_slot_count=EXCLUDED.missed_slot_count,
      last_error_code=EXCLUDED.last_error_code,updated_at=EXCLUDED.updated_at`, [
    catalog.registryAddress.toLowerCase(), catalog.catalogVersion, catalog.catalogSnapshotHash,
    count, count > MAX_ACTIVE, slot, completed ? slot : null, missedSlotCount.toString(), error,
  ]);
}

function derivePlan(catalog, source, slot) {
  const identities = catalog.activeVersions.map((asset) => identityFor(asset, catalog));
  const identityHashes = identities.map(deriveRwaExpectedIdentityHash);
  const setHash = deriveRwaActiveSetHash(identityHashes);
  const commitment = source.providerCommitment;
  const batchId = deriveRwaBatchId({
    registryAddress: catalog.registryAddress.toLowerCase(),
    catalogVersion: catalog.catalogVersion, catalogSnapshotHash: catalog.catalogSnapshotHash,
    activeSetHash: setHash, cycleSlot: slot, providerCommitment: commitment,
  });
  return { identities, identityHashes, activeSetHash: setHash, batchId };
}

async function createOrResumeHeader(client, pool, catalog, source, timing, plan) {
  const existing = (await client.query(`SELECT * FROM rwa_health_batches_v2
    WHERE chain_id=4663 AND registry_address=$1 AND catalog_version=$2
      AND catalog_snapshot_hash=$3 AND rule_set_hash=$4 AND provider_endpoint_hash=$5
      AND cycle_slot=$6`, [catalog.registryAddress.toLowerCase(), catalog.catalogVersion,
    catalog.catalogSnapshotHash, RULE_SET_HASH, ENDPOINT_HASH, timing.cycleSlot])).rows[0];
  if (existing) {
    if (existing.batch_id !== plan.batchId || existing.active_set_hash !== plan.activeSetHash
        || existing.provider_commitment !== source.providerCommitment) fail('health_slot_conflict');
    return { ...existing, inserted: false };
  }
  const pending = (await client.query(`SELECT batch_id FROM rwa_health_batches_v2
    WHERE chain_id=4663 AND registry_address=$1 AND status='pending'`,
  [catalog.registryAddress.toLowerCase()])).rows[0];
  if (pending) fail('health_slot_conflict');
  const inserted = (await client.query(`INSERT INTO rwa_health_batches_v2
    (batch_id,chain_id,registry_address,catalog_version,catalog_snapshot_hash,active_set_hash,
     rule_set_hash,provider_endpoint_hash,provider_commitment,cycle_slot,source_state,failure_code,
     observed_at,fetch_completed_at,active_version_count,declared_page_count,status)
    VALUES ($1,4663,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'pending')
    RETURNING *`, [
    plan.batchId, catalog.registryAddress.toLowerCase(), catalog.catalogVersion,
    catalog.catalogSnapshotHash, plan.activeSetHash, RULE_SET_HASH, ENDPOINT_HASH,
    source.providerCommitment, timing.cycleSlot, source.state, source.failureCode,
    timing.observedAt, timing.fetchCompletedAt, plan.identities.length, pagesFor(plan.identities.length),
  ])).rows[0];
  if (!inserted) fail('health_state_conflict');
  return { ...inserted, inserted: true };
}

async function pendingForRegistry(client, registryAddress) {
  return (await client.query(`SELECT * FROM rwa_health_batches_v2
    WHERE chain_id=4663 AND registry_address=$1 AND status='pending'`,
  [registryAddress.toLowerCase()])).rows[0] ?? null;
}

async function abandonPending(client, batchId, code) {
  const result = await client.query(`UPDATE rwa_health_batches_v2 SET
    status='abandoned',abandoned_at=${nowSql()},abandoned_code=$2
    WHERE batch_id=$1 AND status='pending'`, [batchId, code]);
  if (result.rowCount !== 1) fail('health_state_conflict');
}

async function abandonAfterCatalogFailure(pool, batchId, code) {
  const client = await checkedClient(pool);
  try {
    await client.query('BEGIN');
    await lockedCatalogSnapshot(client);
    await client.query(`SELECT id FROM rwa_health_apply_lock_v2 WHERE id=1${dbCaps.skipLocked ? ' FOR UPDATE' : ''}`);
    await abandonPending(client, batchId, code);
    await client.query('COMMIT');
  } catch (error) { await rollback(client); throw error; } finally { client.release(); }
}

function evaluationFromRow(row) {
  const predicateValues = [row.provider_record, row.supported_chain, row.ticker_identity,
    row.token_identity, row.token_decimals_result, row.provider_active, row.fractional_tradable]
    .map(Number);
  const winning = row.evaluation_kind === 'operational_quarantine' ? 2
    : row.evaluation_kind === 'health_unknown' ? 1 : 0;
  const first = predicateValues.findIndex((value) => value === winning && winning !== 0);
  return {
    evaluationId: row.evaluation_id, expectedIdentityHash: row.expected_identity_hash,
    predicateCommitment: row.predicate_commitment, evidenceHash: row.evidence_hash,
    evaluationKind: row.evaluation_kind, predicateValues,
    ruleCode: first < 0 ? null : [
      'provider_record', 'supported_chain', 'ticker_identity', 'token_identity',
      'token_decimals', 'provider_active', 'fractional_tradable',
    ][first],
    observedAt: row.observed_at, appliedAt: row.applied_at,
  };
}

function identityFromRow(row) {
  return {
    chainId: '4663', registryAddress: row.registry_address,
    catalogVersion: String(row.catalog_version), catalogSnapshotHash: row.catalog_snapshot_hash,
    assetVersionKey: row.asset_version_key, normalizedTicker: row.normalized_ticker,
    tokenAddress: row.token_address, tokenDecimals: Number(row.token_decimals),
    robinhoodAssetIdHash: row.robinhood_asset_id_hash, active: true,
  };
}

function pageId(batchId, pageIndex, slice) {
  return deriveRwaPageId({
    batchId, pageIndex, firstAssetVersionKey: slice[0].assetVersionKey,
    lastAssetVersionKey: slice.at(-1).assetVersionKey, itemCount: slice.length,
  });
}

function evaluationFor(identity, observation, source, plan, slice, pageIndex, appliedAt) {
  const reduced = source.state === 'observed'
    ? evaluateRwaHealthAsset(identity, observation)
    : { predicates: [
      'provider_record', 'supported_chain', 'ticker_identity', 'token_identity',
      'token_decimals', 'provider_active', 'fractional_tradable',
    ].map((code) => ({ code, result: 'unknown' })), evaluationKind: 'health_unknown', ruleCode: 'provider_record' };
  const predicateValues = reduced.predicates.map((item) => RESULT[item.result]);
  const pid = pageId(plan.batchId, pageIndex, slice);
  const ids = deriveRwaEvaluationIds({
    batchId: plan.batchId, pageId: pid, identity, predicateValues,
    evaluationKind: KIND[reduced.evaluationKind], providerCommitment: source.providerCommitment,
  });
  return { ...reduced, ...ids, predicateValues, appliedAt };
}

async function freezePlan(client, catalog, source, timing, plan) {
  const evaluations = [];
  for (let pageIndex = 0; pageIndex < pagesFor(plan.identities.length); pageIndex += 1) {
    const slice = plan.identities.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE);
    const pid = pageId(plan.batchId, pageIndex, slice);
    await client.query(`INSERT INTO rwa_health_pages_v2
      (page_id,batch_id,page_index,first_asset_version_key,last_asset_version_key,item_count,status)
      VALUES ($1,$2,$3,$4,$5,$6,'planned')`, [pid, plan.batchId, pageIndex,
    slice[0].assetVersionKey, slice.at(-1).assetVersionKey, slice.length]);
    for (const identity of slice) {
      const evaluation = evaluationFor(identity, source.observation, source, plan, slice, pageIndex, null);
      evaluations.push(evaluation);
      const p = evaluation.predicateValues;
      await client.query(`INSERT INTO rwa_health_evaluations_v2
        (evaluation_id,batch_id,page_id,chain_id,registry_address,catalog_version,
         catalog_snapshot_hash,asset_version_key,normalized_ticker,token_address,token_decimals,
         robinhood_asset_id_hash,expected_identity_hash,evaluation_kind,predicate_commitment,
         provider_record,supported_chain,ticker_identity,token_identity,token_decimals_result,
         provider_active,fractional_tradable,evidence_hash,observed_at,status,applied_at)
        VALUES ($1,$2,$3,4663,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
                $20,$21,$22,$23,'planned',NULL)`, [
        evaluation.evaluationId, plan.batchId, pid, catalog.registryAddress.toLowerCase(),
        catalog.catalogVersion, catalog.catalogSnapshotHash, identity.assetVersionKey,
        identity.normalizedTicker, identity.tokenAddress, identity.tokenDecimals,
        identity.robinhoodAssetIdHash, evaluation.expectedIdentityHash, evaluation.evaluationKind,
        evaluation.predicateCommitment, ...p, evaluation.evidenceHash, timing.observedAt,
      ]);
    }
  }
  return evaluations;
}

async function insertEvaluation(client, catalog, identity, evaluation, plan, pid, observedAt) {
  const p = evaluation.predicateValues;
  const result = await client.query(`INSERT INTO rwa_health_evaluations_v2
    (evaluation_id,batch_id,page_id,chain_id,registry_address,catalog_version,
     catalog_snapshot_hash,asset_version_key,normalized_ticker,token_address,token_decimals,
     robinhood_asset_id_hash,expected_identity_hash,evaluation_kind,predicate_commitment,
     provider_record,supported_chain,ticker_identity,token_identity,token_decimals_result,
     provider_active,fractional_tradable,evidence_hash,observed_at,status,applied_at)
    VALUES ($1,$2,$3,4663,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
            $20,$21,$22,$23,'applied',$24)
    ON CONFLICT (evaluation_id) DO NOTHING RETURNING evaluation_id`, [
    evaluation.evaluationId, plan.batchId, pid, catalog.registryAddress.toLowerCase(),
    catalog.catalogVersion, catalog.catalogSnapshotHash, identity.assetVersionKey,
    identity.normalizedTicker, identity.tokenAddress, identity.tokenDecimals,
    identity.robinhoodAssetIdHash, evaluation.expectedIdentityHash, evaluation.evaluationKind,
    evaluation.predicateCommitment, ...p, evaluation.evidenceHash, observedAt, evaluation.appliedAt,
  ]);
  if (!result.rowCount) {
    const prior = (await client.query(`SELECT batch_id,page_id,asset_version_key,evidence_hash,
      evaluation_kind FROM rwa_health_evaluations_v2 WHERE evaluation_id=$1`,
    [evaluation.evaluationId])).rows[0];
    if (!prior || prior.batch_id !== plan.batchId || prior.page_id !== pid
        || prior.asset_version_key !== identity.assetVersionKey
        || prior.evidence_hash !== evaluation.evidenceHash
        || prior.evaluation_kind !== evaluation.evaluationKind) fail('health_evidence_conflict');
  }
}

const severityNumber = (value) => value === 'operational_quarantine' ? 2
  : value === 'health_unknown' ? 1 : 0;
const eventNumber = (value) => ({ opened: 0, escalated: 1, terminal: 4 })[value];

async function appendEvaluationEvent(client, {
  episodeId, registryAddress, assetVersionKey, generation, eventKind,
  evaluation, resultingSeverity,
}) {
  const eventId = deriveRwaEpisodeEventId({
    episodeId, eventKind: eventNumber(eventKind), sourceId: evaluation.evaluationId,
    resultingSeverity: severityNumber(resultingSeverity), evidenceHash: evaluation.evidenceHash,
  });
  await client.query(`INSERT INTO rwa_health_episode_events_v2
    (event_id,episode_id,registry_address,asset_version_key,episode_generation,event_kind,
     source_kind,source_id,source_evaluation_id,source_evaluation_status,source_evaluation_kind,
     resulting_severity,evidence_hash,created_at)
    VALUES ($1,$2,$3,$4,$5,$6,'evaluation',$7,$7,'applied',$8,$9,$10,$11)`, [
    eventId, episodeId, registryAddress, assetVersionKey, generation, eventKind,
    evaluation.evaluationId, evaluation.evaluationKind, resultingSeverity,
    evaluation.evidenceHash, evaluation.appliedAt,
  ]);
  return eventId;
}

async function nextGeneration(client, registryAddress, assetVersionKey) {
  const row = (await client.query(`SELECT generation::text FROM rwa_health_episodes_v2
    WHERE registry_address=$1 AND asset_version_key=$2 ORDER BY generation DESC LIMIT 1`,
  [registryAddress, assetVersionKey])).rows[0];
  return row ? (BigInt(row.generation) + 1n).toString() : '1';
}

async function openEvaluationEpisode(client, catalog, identity, evaluation, generation) {
  const episodeId = deriveRwaEpisodeId({
    registryAddress: catalog.registryAddress.toLowerCase(),
    assetVersionKey: identity.assetVersionKey, generation,
  });
  await client.query(`INSERT INTO rwa_health_episodes_v2
    (episode_id,chain_id,registry_address,asset_version_key,generation,initial_state,opened_at,
     opening_evaluation_id,opening_evaluation_status,opening_reviewer_action_id,
     opening_rule_code,opening_reason_hash,opening_evidence_hash)
    VALUES ($1,4663,$2,$3,$4,$5,$6,$7,'applied',NULL,$8,$9,$9)`, [
    episodeId, catalog.registryAddress.toLowerCase(), identity.assetVersionKey, generation,
    evaluation.evaluationKind, evaluation.appliedAt, evaluation.evaluationId,
    evaluation.ruleCode, evaluation.evidenceHash,
  ]);
  const eventId = await appendEvaluationEvent(client, {
    episodeId, registryAddress: catalog.registryAddress.toLowerCase(),
    assetVersionKey: identity.assetVersionKey, generation, eventKind: 'opened', evaluation,
    resultingSeverity: evaluation.evaluationKind,
  });
  return {
    episodeId, generation, severity: evaluation.evaluationKind,
    openedAt: evaluation.appliedAt, eventId, materialEventId: eventId,
    materialEvidenceHash: evaluation.evidenceHash,
  };
}

async function reduceCurrent(client, catalog, identity, evaluation) {
  const prior = (await client.query(`SELECT * FROM rwa_health_current_v2
    WHERE registry_address=$1 AND asset_version_key=$2${dbCaps.skipLocked ? ' FOR UPDATE' : ''}`,
  [catalog.registryAddress.toLowerCase(), identity.assetVersionKey])).rows[0];
  let episode = prior?.current_episode_id ? {
    episodeId: prior.current_episode_id, generation: String(prior.current_episode_generation),
    severity: prior.current_severity, openedAt: prior.episode_opened_at,
    eventId: prior.latest_episode_event_id, materialEventId: prior.latest_material_event_id,
    materialEvidenceHash: prior.latest_material_evidence_hash,
  } : null;
  let clearanceId = prior?.clearance_id ?? null;
  let clearanceGeneration = prior?.clearance_generation == null
    ? null : String(prior.clearance_generation);
  let clearanceAppliedAt = prior?.clearance_applied_at ?? null;
  let sequenceDelta = 1n;

  if (!episode && evaluation.evaluationKind !== 'healthy') {
    episode = await openEvaluationEpisode(client, catalog, identity, evaluation,
      await nextGeneration(client, catalog.registryAddress.toLowerCase(), identity.assetVersionKey));
  } else if (episode) {
    let afterClearance = false;
    if (clearanceAppliedAt != null) {
      const comparison = (await client.query(`SELECT
          (e.observed_at > c.clearance_applied_at
           AND e.applied_at > c.clearance_applied_at) AS after_clearance
        FROM rwa_health_current_v2 c
        JOIN rwa_health_evaluations_v2 e ON e.evaluation_id=$3
       WHERE c.registry_address=$1 AND c.asset_version_key=$2`, [
        catalog.registryAddress.toLowerCase(), identity.assetVersionKey, evaluation.evaluationId,
      ])).rows[0];
      if (!comparison || typeof comparison.after_clearance !== 'boolean') {
        fail('health_state_conflict');
      }
      afterClearance = comparison.after_clearance;
    }
    if (afterClearance) {
      const terminalStatus = evaluation.evaluationKind === 'healthy'
        ? 'healthy_after_clearance' : 'post_clearance_failure_superseded';
      const terminalEventId = await appendEvaluationEvent(client, {
        episodeId: episode.episodeId, registryAddress: catalog.registryAddress.toLowerCase(),
        assetVersionKey: identity.assetVersionKey, generation: episode.generation,
        eventKind: 'terminal', evaluation, resultingSeverity: 'none',
      });
      const closed = await client.query(`UPDATE rwa_health_episodes_v2 SET
        terminal_status=$2,terminal_evaluation_id=$3,terminal_evaluation_status='applied',
        terminal_evaluation_kind=$4,terminal_evaluation_evidence_hash=$5,closed_at=$6
        WHERE episode_id=$1 AND closed_at IS NULL AND clearance_id IS NOT NULL`, [
        episode.episodeId, terminalStatus, evaluation.evaluationId,
        evaluation.evaluationKind, evaluation.evidenceHash, evaluation.appliedAt,
      ]);
      if (closed.rowCount !== 1) fail('health_state_conflict');
      episode = null;
      clearanceId = null;
      clearanceGeneration = null;
      clearanceAppliedAt = null;
      if (evaluation.evaluationKind !== 'healthy') {
        episode = await openEvaluationEpisode(client, catalog, identity, evaluation,
          (BigInt(prior.current_episode_generation) + 1n).toString());
        sequenceDelta = 2n;
      } else {
        // The terminal event is historical; a healthy current projection has no open evidence head.
        void terminalEventId;
      }
    } else if (evaluation.evaluationKind === 'operational_quarantine'
        && episode.severity === 'health_unknown') {
      const eventId = await appendEvaluationEvent(client, {
        episodeId: episode.episodeId, registryAddress: catalog.registryAddress.toLowerCase(),
        assetVersionKey: identity.assetVersionKey, generation: episode.generation,
        eventKind: 'escalated', evaluation, resultingSeverity: 'operational_quarantine',
      });
      episode = {
        ...episode, severity: 'operational_quarantine', eventId,
        materialEventId: eventId, materialEvidenceHash: evaluation.evidenceHash,
      };
    }
  }

  const sequence = (prior ? BigInt(prior.state_sequence) : 0n) + sequenceDelta;
  if (sequence > 2n ** 63n - 1n) fail('health_state_conflict');
  await client.query(`INSERT INTO rwa_health_current_v2
    (chain_id,registry_address,asset_version_key,catalog_version,catalog_snapshot_hash,
     last_evaluation_id,last_evaluation_status,latest_evaluation_kind,last_evaluation_evidence_hash,
     last_observed_at,last_applied_at,current_episode_id,current_episode_generation,current_severity,
     episode_opened_at,latest_episode_event_id,latest_material_event_id,latest_material_evidence_hash,
     clearance_id,clearance_generation,clearance_applied_at,next_due_at,state_sequence)
    VALUES (4663,$1,$2,$3,$4,$5,'applied',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
            $8::timestamptz + interval '300 seconds',$20)
    ON CONFLICT (registry_address,asset_version_key) DO UPDATE SET
      catalog_version=EXCLUDED.catalog_version,catalog_snapshot_hash=EXCLUDED.catalog_snapshot_hash,
      last_evaluation_id=EXCLUDED.last_evaluation_id,last_evaluation_status='applied',
      latest_evaluation_kind=EXCLUDED.latest_evaluation_kind,
      last_evaluation_evidence_hash=EXCLUDED.last_evaluation_evidence_hash,
      last_observed_at=EXCLUDED.last_observed_at,last_applied_at=EXCLUDED.last_applied_at,
      current_episode_id=EXCLUDED.current_episode_id,
      current_episode_generation=EXCLUDED.current_episode_generation,
      current_severity=EXCLUDED.current_severity,episode_opened_at=EXCLUDED.episode_opened_at,
      latest_episode_event_id=EXCLUDED.latest_episode_event_id,
      latest_material_event_id=EXCLUDED.latest_material_event_id,
      latest_material_evidence_hash=EXCLUDED.latest_material_evidence_hash,
      clearance_id=EXCLUDED.clearance_id,clearance_generation=EXCLUDED.clearance_generation,
      clearance_applied_at=EXCLUDED.clearance_applied_at,
      next_due_at=EXCLUDED.next_due_at,state_sequence=EXCLUDED.state_sequence`, [
    catalog.registryAddress.toLowerCase(), identity.assetVersionKey, catalog.catalogVersion,
    catalog.catalogSnapshotHash, evaluation.evaluationId, evaluation.evaluationKind,
    evaluation.evidenceHash, evaluation.observedAt, evaluation.appliedAt,
    episode?.episodeId ?? null, episode?.generation ?? null, episode?.severity ?? null,
    episode?.openedAt ?? null, episode?.eventId ?? null, episode?.materialEventId ?? null,
    episode?.materialEvidenceHash ?? null, clearanceId, clearanceGeneration,
    clearanceAppliedAt, sequence.toString(),
  ]);
}

async function applyPage(pool, batchId, pageIndex) {
  const client = await checkedClient(pool);
  try {
    await client.query('BEGIN');
    const confirmed = await acquireGraph(client, pool);
    const batch = (await client.query(`SELECT * FROM rwa_health_batches_v2
      WHERE batch_id=$1${dbCaps.skipLocked ? ' FOR UPDATE' : ''}`, [batchId])).rows[0];
    if (!batch) fail('health_state_conflict');
    if (confirmed.catalogVersion !== String(batch.catalog_version)
        || confirmed.catalogSnapshotHash !== batch.catalog_snapshot_hash) fail('health_snapshot_changed');
    const page = (await client.query(`SELECT * FROM rwa_health_pages_v2
      WHERE batch_id=$1 AND page_index=$2`, [batchId, pageIndex])).rows[0];
    if (!page) fail('health_page_conflict');
    if (page.status === 'applied') { await client.query('COMMIT'); return { complete: false }; }
    const planned = (await client.query(`SELECT * FROM rwa_health_evaluations_v2
      WHERE batch_id=$1 AND page_id=$2 ORDER BY asset_version_key ASC`, [batchId, page.page_id])).rows;
    if (planned.length !== Number(page.item_count)
        || planned[0]?.asset_version_key !== page.first_asset_version_key
        || planned.at(-1)?.asset_version_key !== page.last_asset_version_key) fail('health_page_conflict');
    await verifySelectiveEvidence(client, batch);
    for (const row of planned) {
      await client.query(`SELECT asset_version_key FROM rwa_health_current_v2
        WHERE registry_address=$1 AND asset_version_key=$2${dbCaps.skipLocked ? ' FOR UPDATE' : ''}`,
      [batch.registry_address, row.asset_version_key]);
    }
    const appliedAt = (await client.query(`SELECT ${nowSql()} AS now`)).rows[0].now;
    const catalog = {
      registryAddress: batch.registry_address, catalogVersion: String(batch.catalog_version),
      catalogSnapshotHash: batch.catalog_snapshot_hash,
    };
    for (const row of planned) {
      if (row.status !== 'planned' || row.applied_at != null) fail('health_evidence_conflict');
      const updated = await client.query(`UPDATE rwa_health_evaluations_v2 SET
        status='applied',applied_at=$2 WHERE evaluation_id=$1 AND status='planned'`,
      [row.evaluation_id, appliedAt]);
      if (updated.rowCount !== 1) fail('health_evidence_conflict');
      row.status = 'applied'; row.applied_at = appliedAt;
      await reduceCurrent(client, catalog, identityFromRow(row), evaluationFromRow(row));
    }
    await client.query(`UPDATE rwa_health_pages_v2 SET status='applied',applied_at=$2
      WHERE page_id=$1 AND status='planned'`, [page.page_id, appliedAt]);
    await client.query(`UPDATE rwa_health_batches_v2 SET
      applied_page_count=applied_page_count+1,applied_item_count=applied_item_count+$2
      WHERE batch_id=$1 AND status='pending'`, [batchId, planned.length]);
    const isFinal = pageIndex + 1 === Number(batch.declared_page_count);
    if (isFinal) {
      const completed = (await client.query(`UPDATE rwa_health_batches_v2 SET
        status='complete',completed_at=${nowSql()} WHERE batch_id=$1 AND status='pending'
        AND applied_page_count=declared_page_count AND applied_item_count=active_version_count
        RETURNING status,active_version_count,declared_page_count`, [batchId])).rows[0];
      if (!completed) fail('health_page_conflict');
      await writeRuntime(client, pool, catalog, String(batch.cycle_slot),
        Number(batch.active_version_count), runtimeProviderError(batch.failure_code), true);
      await client.query('COMMIT');
      return { complete: true, batch: completed };
    }
    await client.query('COMMIT');
    return { complete: false };
  } catch (error) {
    await rollback(client);
    if (error?.code === 'health_snapshot_changed' || error?.code === 'health_registry_stale') {
      await abandonAfterCatalogFailure(pool, batchId, error.code);
    }
    throw error;
  } finally { client.release(); }
}

function receipt(batch) {
  return Object.freeze({
    status: batch.status, batchId: batch.batch_id ?? batch.batchId,
    activeVersionCount: Number(batch.active_version_count),
    pageCount: Number(batch.declared_page_count),
  });
}

async function verifySelectiveEvidence(client, batch) {
  const evidence = (await client.query(`SELECT raw_body_hash,byte_count,body_bytes
    FROM rwa_health_private_provider_evidence_v2 WHERE batch_id=$1`, [batch.batch_id])).rows[0];
  const plannedNeedsBody = (await client.query(`SELECT 1 FROM rwa_health_evaluations_v2
    WHERE batch_id=$1 AND evaluation_kind <> 'healthy' LIMIT 1`, [batch.batch_id])).rows[0];
  const openEpisodeNeedsBody = (await client.query(`SELECT 1 FROM rwa_health_episodes_v2 e
    JOIN rwa_health_evaluations_v2 v ON v.batch_id=$1 AND v.asset_version_key=e.asset_version_key
    WHERE e.registry_address=$2 AND e.closed_at IS NULL LIMIT 1`,
  [batch.batch_id, batch.registry_address])).rows[0];
  if (!evidence) {
    if (batch.source_state === 'observed' && (plannedNeedsBody || openEpisodeNeedsBody)) {
      fail('health_evidence_conflict');
    }
    return;
  }
  if (batch.source_state !== 'observed') fail('health_evidence_conflict');
  const body = new Uint8Array(evidence.body_bytes);
  if (Number(evidence.byte_count) !== body.length
      || evidence.raw_body_hash !== batch.provider_commitment
      || keccak256(body) !== evidence.raw_body_hash) fail('health_evidence_conflict');
}

async function resumePending(pool, timing) {
  const client = await checkedClient(pool);
  let committedFailure = null;
  try {
    await client.query('BEGIN');
    const catalogResult = await lockedCatalogSnapshot(client);
    if (!catalogResult.available) {
      if (!['stale', 'changed'].includes(catalogResult.reason)) fail('health_registry_unavailable');
      await client.query(`SELECT id FROM rwa_health_apply_lock_v2 WHERE id=1${dbCaps.skipLocked ? ' FOR UPDATE' : ''}`);
      const pending = await pendingForRegistry(client, catalogResult.registryAddress);
      const code = catalogResult.reason === 'stale' ? 'health_registry_stale' : 'health_snapshot_changed';
      if (!pending) fail(code);
      await abandonPending(client, pending.batch_id, code);
      await client.query('COMMIT');
      committedFailure = new RwaHealthError(code);
      return null;
    }
    const catalog = catalogResult;
    if (!stableCatalog(catalog)) fail('health_registry_unavailable');
    await client.query(`SELECT id FROM rwa_health_apply_lock_v2 WHERE id=1${dbCaps.skipLocked ? ' FOR UPDATE' : ''}`);
    const pending = await pendingForRegistry(client, catalog.registryAddress);
    if (!pending) {
      const count = catalog.activeVersions.length;
      await writeRuntime(client, pool, catalog, timing.cycleSlot, count,
        count > MAX_ACTIVE ? 'health_capacity_exceeded' : null, false);
      await client.query('COMMIT');
      return { pending: null, catalog, capacityExceeded: count > MAX_ACTIVE };
    }
    if (String(pending.catalog_version) !== catalog.catalogVersion
        || pending.catalog_snapshot_hash !== catalog.catalogSnapshotHash) {
      await abandonPending(client, pending.batch_id, 'health_snapshot_changed');
      await client.query('COMMIT');
      fail('health_snapshot_changed');
    }
    await verifySelectiveEvidence(client, pending);
    await client.query('COMMIT');
    return { pending, catalog, capacityExceeded: false };
  } catch (error) { await rollback(client); throw error; } finally {
    client.release();
    if (committedFailure) throw committedFailure;
  }
}

async function applyRemaining(pool, batch) {
  for (let index = 0; index < Number(batch.declared_page_count); index += 1) {
    const result = await applyPage(pool, batch.batch_id, index);
    if (result.complete) return receipt({ ...result.batch, batch_id: batch.batch_id });
  }
  const current = await pool.query('SELECT * FROM rwa_health_batches_v2 WHERE batch_id=$1', [batch.batch_id]);
  if (current.rows[0]?.status === 'complete') return receipt(current.rows[0]);
  fail('health_page_conflict');
}

export async function sweepRwaHealth(pool, { fetchFn = globalThis.fetch } = {}) {
  if (typeof fetchFn !== 'function') fail('health_bad_input');
  const timing = await preflight(pool);
  const resume = await resumePending(pool, timing);
  if (resume?.capacityExceeded) fail('health_capacity_exceeded');
  if (resume?.pending) return applyRemaining(pool, resume.pending);

  let source;
  try {
    const fetched = await fetchRwaHealthProvider(fetchFn);
    const observation = parseRwaHealthProviderBody(fetched.body);
    source = {
      state: 'observed', failureCode: null, providerCommitment: fetched.providerBodyHash,
      body: fetched.body, observation, cycleSlot: timing.cycleSlot, persistBody: false,
    };
  } catch (error) {
    const code = providerFailureCode(error);
    if (code === null) throw error;
    source = {
      state: 'unknown', failureCode: code, providerCommitment: providerFailureHash(code),
      body: new Uint8Array(), observation: null, cycleSlot: timing.cycleSlot, persistBody: false,
    };
  }
  const completionClient = await checkedClient(pool);
  try {
    timing.fetchCompletedAt = (await completionClient.query(`SELECT ${nowSql()} AS now`)).rows[0].now;
  } finally { completionClient.release(); }

  const header = await checkedClient(pool);
  let batch;
  try {
    await header.query('BEGIN');
    const catalog = await acquireGraph(header, pool);
    const count = catalog.activeVersions.length;
    await writeRuntime(header, pool, catalog, timing.cycleSlot, count,
      count > MAX_ACTIVE ? 'health_capacity_exceeded'
        : runtimeProviderError(source.failureCode), false);
    if (count > MAX_ACTIVE) { await header.query('COMMIT'); fail('health_capacity_exceeded'); }
    const plan = derivePlan(catalog, source, timing.cycleSlot);
    const existing = await createOrResumeHeader(header, pool, catalog, source, timing, plan);
    if (existing.status === 'complete') {
      await header.query('COMMIT');
      return receipt(existing);
    }
    if (existing.inserted === true) {
      const evaluations = await freezePlan(header, catalog, source, timing, plan);
      if (source.state === 'observed') {
        const keys = plan.identities.map((identity) => identity.assetVersionKey);
        const placeholders = keys.map((_, index) => `$${index + 2}`).join(',');
        const open = keys.length === 0 ? null : (await header.query(`SELECT 1
          FROM rwa_health_episodes_v2 WHERE registry_address=$1 AND closed_at IS NULL
            AND asset_version_key IN (${placeholders}) LIMIT 1`, [
          catalog.registryAddress.toLowerCase(), ...keys,
        ])).rows[0];
        source.persistBody = evaluations.some((evaluation) => evaluation.evaluationKind !== 'healthy') || !!open;
        if (source.persistBody) {
          await header.query(`INSERT INTO rwa_health_private_provider_evidence_v2
            (batch_id,raw_body_hash,source_state,byte_count,body_bytes,captured_at,retain_until)
            VALUES ($1,$2,'observed',$3,$4,$5::timestamptz,$5::timestamptz + interval '${RETAIN_DAYS} days')`, [
            plan.batchId, source.providerCommitment, source.body.length, Buffer.from(source.body),
            timing.fetchCompletedAt,
          ]);
        }
      }
    }
    if (count === 0) {
      batch = (await header.query(`UPDATE rwa_health_batches_v2 SET status='complete',
        completed_at=${nowSql()} WHERE batch_id=$1 AND status='pending'
        RETURNING *`, [plan.batchId])).rows[0];
      if (!batch) fail('health_page_conflict');
      await writeRuntime(header, pool, catalog, timing.cycleSlot, 0,
        runtimeProviderError(source.failureCode), true);
      await header.query('COMMIT');
      return receipt(batch);
    }
    batch = (await header.query('SELECT * FROM rwa_health_batches_v2 WHERE batch_id=$1', [plan.batchId])).rows[0];
    await header.query('COMMIT');
  } catch (error) { await rollback(header); throw error; } finally { header.release(); }
  return applyRemaining(pool, batch);
}
