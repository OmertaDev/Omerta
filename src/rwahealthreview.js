import {
  encodeAbiParameters, getAddress, keccak256, stringToHex,
} from 'viem';

import { dbCaps } from './db.js';
import { RwaHealthError } from './rwahealtherror.js';
import { finalizedStockCatalogForHealthV2 } from './stockcatalogv2.js';

const ZERO_HASH = `0x${'00'.repeat(32)}`;
const MAX_SEQUENCE = 9_223_372_036_854_775_807n;
const tag = (value) => keccak256(stringToHex(value));

const fail = (code) => { throw new RwaHealthError(code); };
const bytes32 = (value) => typeof value === 'string' && /^0x[0-9a-f]{64}$/.test(value)
  && value !== ZERO_HASH;
const plainExact = (value, keys) => value !== null
  && Object.getPrototypeOf(value) === Object.prototype
  && Reflect.ownKeys(value).length === keys.length
  && keys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && Object.hasOwn(descriptor, 'value');
  });
const abiHash = (types, values) => keccak256(encodeAbiParameters(
  types.map((type) => ({ type })), values,
));
const lock = () => (dbCaps.skipLocked ? ' FOR UPDATE' : '');

function validate(assetVersionKey, reviewerId, transportKeyHash, body) {
  const fields = ['state', 'ruleCode', 'reasonHash', 'evidenceHash'];
  const pair = body?.state === 'health_unknown'
    ? body.ruleCode === 'reviewer_verification_unknown'
    : body?.state === 'operational_quarantine'
      ? body.ruleCode === 'reviewer_material_drift' : false;
  if (!bytes32(assetVersionKey)
      || typeof reviewerId !== 'string' || !/^[A-Za-z0-9._-]{1,128}$/.test(reviewerId)
      || typeof transportKeyHash !== 'string' || !/^[0-9a-f]{64}$/.test(transportKeyHash)
      || !plainExact(body, fields) || !pair
      || !bytes32(body.reasonHash) || !bytes32(body.evidenceHash)) fail('health_bad_input');
}

function ids(registryAddress, assetVersionKey, generation, reviewerId, body, outcome, severity) {
  const episodeId = abiHash(
    ['bytes32', 'uint256', 'address', 'bytes32', 'uint256'],
    [tag('OMERTA_RWA_HEALTH_EPISODE_V2'), 4663n, registryAddress, assetVersionKey, generation],
  );
  const requestedState = body.state === 'health_unknown' ? 1 : 2;
  const reviewerActionId = abiHash(
    ['bytes32', 'uint256', 'address', 'bytes32', 'uint256', 'bytes32', 'uint8', 'bytes32', 'bytes32', 'bytes32'],
    [tag('OMERTA_RWA_HEALTH_REVIEWER_ACTION_V2'), 4663n, registryAddress,
      assetVersionKey, generation, keccak256(stringToHex(reviewerId)), requestedState,
      keccak256(stringToHex(body.ruleCode)), body.reasonHash, body.evidenceHash],
  );
  const eventKind = { opened: 0, escalated: 1, evidence_only: 2 }[outcome];
  const episodeEventId = abiHash(
    ['bytes32', 'bytes32', 'uint8', 'bytes32', 'uint8', 'bytes32'],
    [tag('OMERTA_RWA_HEALTH_EPISODE_EVENT_V2'), episodeId, eventKind,
      reviewerActionId, severity, body.evidenceHash],
  );
  return { episodeId, reviewerActionId, episodeEventId };
}

function receipt(row, replay = false) {
  return Object.freeze({
    reviewerActionId: row.reviewer_action_id,
    episodeId: row.target_episode_id,
    episodeGeneration: String(row.target_episode_generation),
    outcome: row.outcome,
    state: row.requested_state,
    ruleCode: row.rule_code,
    reasonHash: row.reason_hash,
    evidenceHash: row.evidence_hash,
    requestedAt: new Date(row.requested_at).toISOString(),
    appliedAt: new Date(row.applied_at).toISOString(),
    replay,
  });
}

export async function enterRwaHealthReview(
  pool, assetVersionKey, reviewerId, transportKeyHash, body,
) {
  if (!pool || typeof pool.connect !== 'function') fail('health_bad_input');
  validate(assetVersionKey, reviewerId, transportKeyHash, body);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT id FROM stock_catalog_sync_lock_v2 WHERE id=1${dbCaps.skipLocked ? ' FOR SHARE' : ''}`);
    const clockExpression = dbCaps.skipLocked
      ? "date_trunc('milliseconds',clock_timestamp())" : 'now()';
    const clock = dbCaps.skipLocked
      ? (await client.query(
        `WITH t AS (SELECT ${clockExpression} AS now)
         SELECT now,floor(extract(epoch FROM now))::numeric::text AS epoch FROM t`,
      )).rows[0]
      : (await client.query('SELECT now() AS now')).rows[0];
    if (!dbCaps.skipLocked) clock.epoch = String(Math.floor(new Date(clock.now).getTime() / 1000));
    const catalog = await finalizedStockCatalogForHealthV2(client, { observedEpochSeconds: clock.epoch });
    if (!catalog.available) {
      if (catalog.reason === 'stale') fail('health_registry_stale');
      if (catalog.reason === 'changed') fail('health_snapshot_changed');
      fail('health_registry_unavailable');
    }
    if (catalog.activeVersions.length > 2_048) fail('health_capacity_exceeded');
    const asset = catalog.activeVersions.find((item) => item.assetVersionKey === assetVersionKey);
    if (!asset) {
      const historical = catalog.historicalVersions.some((item) => item.assetVersionKey === assetVersionKey);
      fail(historical ? 'health_blocked' : 'health_asset_not_found');
    }

    await client.query(`SELECT id FROM rwa_health_apply_lock_v2 WHERE id=1${lock()}`);
    const runtime = (await client.query(
      'SELECT capacity_exceeded FROM rwa_health_runtime_v2 WHERE registry_address=$1',
      [catalog.registryAddress],
    )).rows[0];
    if (runtime?.capacity_exceeded === true) fail('health_capacity_exceeded');
    const current = (await client.query(
      `SELECT * FROM rwa_health_current_v2
        WHERE registry_address=$1 AND asset_version_key=$2${lock()}`,
      [catalog.registryAddress, assetVersionKey],
    )).rows[0] || null;
    const open = current?.current_episode_id ? current : null;
    let generation;
    if (open) generation = BigInt(open.current_episode_generation);
    else {
      const prior = (await client.query(
        `SELECT generation::text FROM rwa_health_episodes_v2
          WHERE registry_address=$1 AND asset_version_key=$2
          ORDER BY generation DESC LIMIT 1${lock()}`,
        [catalog.registryAddress, assetVersionKey],
      )).rows[0];
      generation = prior ? BigInt(prior.generation) + 1n : 1n;
    }
    const requestedSeverity = body.state === 'health_unknown' ? 1 : 2;
    const existingSeverity = open?.current_severity === 'operational_quarantine' ? 2
      : open?.current_severity === 'health_unknown' ? 1 : 0;
    const outcome = !open ? 'opened'
      : requestedSeverity > existingSeverity ? 'escalated' : 'evidence_only';
    const resultingSeverity = Math.max(requestedSeverity, existingSeverity);
    const derived = ids(getAddress(catalog.registryAddress), assetVersionKey, generation,
      reviewerId, body, outcome, resultingSeverity);

    const replay = (await client.query(
      'SELECT * FROM rwa_health_reviewer_actions_v2 WHERE reviewer_action_id=$1',
      [derived.reviewerActionId],
    )).rows[0];
    if (replay) {
      await client.query('COMMIT');
      return receipt(replay, true);
    }
    if (outcome === 'evidence_only') {
      const count = (await client.query(
        `SELECT count(*)::text AS count FROM rwa_health_reviewer_actions_v2
          WHERE target_episode_id=$1 AND outcome='evidence_only'`, [derived.episodeId],
      )).rows[0];
      if (BigInt(count.count) >= 255n) fail('health_evidence_limit');
    }
    const sequence = current ? BigInt(current.state_sequence) + 1n : 1n;
    if (sequence > MAX_SEQUENCE) fail('health_state_conflict');

    const action = (await client.query(
      `INSERT INTO rwa_health_reviewer_actions_v2
        (reviewer_action_id,chain_id,registry_address,asset_version_key,target_episode_id,
         target_episode_generation,requested_state,rule_code,reason_hash,evidence_hash,
         reviewer_id,first_transport_key_hash,requested_at,applied_at,outcome)
       VALUES ($1,4663,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12,$13)
       RETURNING *`,
      [derived.reviewerActionId, catalog.registryAddress, assetVersionKey, derived.episodeId,
        generation.toString(), body.state, body.ruleCode, body.reasonHash, body.evidenceHash,
        reviewerId, transportKeyHash, clock.now, outcome],
    )).rows[0];
    if (!open) {
      await client.query(
        `INSERT INTO rwa_health_episodes_v2
          (episode_id,chain_id,registry_address,asset_version_key,generation,initial_state,
           opened_at,opening_evaluation_id,opening_evaluation_status,opening_reviewer_action_id,
           opening_rule_code,opening_reason_hash,opening_evidence_hash)
         VALUES ($1,4663,$2,$3,$4,$5,$6,NULL,NULL,$7,$8,$9,$10)`,
        [derived.episodeId, catalog.registryAddress, assetVersionKey, generation.toString(),
          body.state, clock.now, derived.reviewerActionId, body.ruleCode,
          body.reasonHash, body.evidenceHash],
      );
    }
    const severity = resultingSeverity === 2 ? 'operational_quarantine' : 'health_unknown';
    await client.query(
      `INSERT INTO rwa_health_episode_events_v2
        (event_id,episode_id,registry_address,asset_version_key,episode_generation,event_kind,
         source_kind,source_id,source_reviewer_action_id,source_reviewer_state,
         source_reviewer_outcome,resulting_severity,evidence_hash,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,'reviewer',$7,$7,$8,$6,$9,$10,$11)`,
      [derived.episodeEventId, derived.episodeId, catalog.registryAddress, assetVersionKey,
        generation.toString(), outcome, derived.reviewerActionId, body.state, severity,
        body.evidenceHash, clock.now],
    );
    if (current) {
      const changed = await client.query(
        `UPDATE rwa_health_current_v2 SET
           current_episode_id=$3,current_episode_generation=$4,current_severity=$5,
           episode_opened_at=COALESCE(episode_opened_at,$6),latest_episode_event_id=$7,
           latest_material_event_id=$7,latest_material_evidence_hash=$8,state_sequence=$9
         WHERE registry_address=$1 AND asset_version_key=$2 AND state_sequence=$10`,
        [catalog.registryAddress, assetVersionKey, derived.episodeId, generation.toString(), severity,
          open?.episode_opened_at || clock.now, derived.episodeEventId, body.evidenceHash,
          sequence.toString(), String(current.state_sequence)],
      );
      if (changed.rowCount !== 1) fail('health_state_conflict');
    } else {
      await client.query(
        `INSERT INTO rwa_health_current_v2
          (chain_id,registry_address,asset_version_key,catalog_version,catalog_snapshot_hash,
           current_episode_id,current_episode_generation,current_severity,episode_opened_at,
           latest_episode_event_id,latest_material_event_id,latest_material_evidence_hash,state_sequence)
         VALUES (4663,$1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,1)`,
        [catalog.registryAddress, assetVersionKey, catalog.catalogVersion,
          catalog.catalogSnapshotHash, derived.episodeId, generation.toString(), severity,
          clock.now, derived.episodeEventId, body.evidenceHash],
      );
    }
    await client.query('COMMIT');
    return receipt(action, false);
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* preserve the domain failure */ }
    throw error;
  } finally {
    client.release();
  }
}
