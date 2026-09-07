import { dbCaps } from '../db.js';
import { withPhase2Transaction, registerPhase2Undo, phase2ContextIdentity } from './phase2-transactions.js';
import { ownRequest, snapshotBytes, snapshotIdentity, auditOperator, failRegistry,
  verifyIncomingArtifact, verifyStoredArtifactRow, verifiedArtifactData, loadVerifiedStoredArtifact,
  validHash, storedNumber } from './artifact-storage.js';
import { registerVerifiedDefinitions, verifyRegisteredDefinitions } from '../itemdefinitions.js';
import { canonicalBytes } from './canonical.js';
import { activationPolicySnapshot, assertActivationPolicy, assertActivationHistory } from './activation-policy.js';

// Only this module issues replacement authority, after appending its exact activation event.
const SELECTIONS = new WeakMap();

export async function storeSealedBundle(pool, request) {
  // All admission completes synchronously, before checkout or serialization yields to caller code.
  const admitted = ownRequest(request, ['canonicalBytes', 'expectedIdentity', 'operatorId']);
  const identity = snapshotIdentity(admitted.expectedIdentity);
  const bytes = snapshotBytes(admitted.canonicalBytes);
  const operator = auditOperator(admitted.operatorId);
  return withPhase2Transaction(pool, async (client) => {
    let pointer = (await client.query('SELECT * FROM content_bundle_activations WHERE namespace=$1', [identity.packageId])).rows[0];
    if (!pointer) {
      registerPhase2Undo(client, () => client.query('DELETE FROM content_bundle_activations WHERE namespace=$1', [identity.packageId]));
      await client.query('INSERT INTO content_bundle_activations (namespace) VALUES ($1) ON CONFLICT (namespace) DO NOTHING', [identity.packageId]);
    }
    pointer = (await client.query(dbCaps.skipLocked
      ? 'SELECT * FROM content_bundle_activations WHERE namespace=$1 FOR UPDATE'
      : 'SELECT * FROM content_bundle_activations WHERE namespace=$1', [identity.packageId])).rows[0];
    if (!pointer) failRegistry('content_registry_corrupt');
    const verified = await verifyIncomingArtifact(client, bytes, identity);
    const { row } = verifiedArtifactData(client, verified);
    const existing = (await client.query('SELECT * FROM content_bundle_artifacts WHERE bundle_hash=$1', [identity.bundleHash])).rows[0];
    if (existing) {
      verifyStoredArtifactRow(client, verified, existing);
      await verifyRegisteredDefinitions(client, verified);
      return result(row, true);
    }
    const version = (await client.query('SELECT bundle_hash FROM content_bundle_artifacts WHERE namespace=$1 AND bundle_version=$2',
      [row.namespace, row.bundle_version])).rows[0];
    if (version) failRegistry('content_bundle_version_conflict');
    registerPhase2Undo(client, () => client.query('DELETE FROM content_bundle_artifacts WHERE bundle_hash=$1', [row.bundle_hash]));
    await client.query(`INSERT INTO content_bundle_artifacts
      (bundle_hash,namespace,bundle_version,artifact_format_version,compiler_version,ir_version,authored_kind,
       package_kind,profile,authority_profile,activatable,source_hash,secret_overlay_hash,dependency_lock_hash,
       ir_hash,public_manifest_hash,report_hashes_json,definition_count,canonical_bytes,registered_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
    [row.bundle_hash, row.namespace, row.bundle_version, row.artifact_format_version, row.compiler_version,
      row.ir_version, row.authored_kind, row.package_kind, row.profile, row.authority_profile, row.activatable,
      row.source_hash, row.secret_overlay_hash, row.dependency_lock_hash, row.ir_hash, row.public_manifest_hash,
      row.report_hashes_json, row.definition_count, bytes, operator]);
    await registerVerifiedDefinitions(client, verified);
    await verifyRegisteredDefinitions(client, verified);
    return result(row, false);
  });
}
function result(row, replayed) {
  return Object.freeze({ namespace: row.namespace, bundleVersion: row.bundle_version,
    authorityProfile: row.authority_profile, bundleHash: row.bundle_hash,
    dependencyLockHash: row.dependency_lock_hash, definitionCount: row.definition_count, replayed });
}

function eventId(value) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) failRegistry('content_registry_corrupt');
  const id = String(value);
  if (!/^[1-9][0-9]*$/.test(id)) failRegistry('content_registry_corrupt');
  return id;
}
async function currentSelection(client, pointer, target) {
  const selected = (await client.query(`SELECT * FROM item_definition_activations
    WHERE package_id=$1 OR logical_item_id LIKE $2 ORDER BY logical_item_id`,
  [pointer.namespace, `${pointer.namespace}::%`])).rows.filter((row) =>
    row.package_id === pointer.namespace || row.logical_item_id.startsWith(`${pointer.namespace}::`));
  if (pointer.activation_revision === 0 || pointer.activation_revision === '0') {
    if (pointer.bundle_hash !== null || pointer.last_event_id !== null || pointer.activated_by !== null
        || pointer.activated_at !== null || selected.length) failRegistry('content_registry_corrupt');
    return { revision: 0, event: null, selected };
  }
  const revision = storedNumber(pointer.activation_revision);
  const sameTarget = verifiedArtifactData(client, target).row.bundle_hash === pointer.bundle_hash;
  const artifact = sameTarget ? target : await loadVerifiedStoredArtifact(client, pointer.bundle_hash);
  const { row } = verifiedArtifactData(client, artifact);
  if (!sameTarget) await verifyRegisteredDefinitions(client, artifact);
  const event = (await client.query('SELECT * FROM content_activation_events WHERE id=$1', [pointer.last_event_id])).rows[0];
  if (!event || row.namespace !== pointer.namespace || storedNumber(event.activation_revision) !== revision
      || eventId(event.id) !== eventId(pointer.last_event_id)) failRegistry('content_registry_corrupt');
  assertActivationHistory(event, row);
  const memberships = (await client.query(`SELECT * FROM content_bundle_item_definitions
    WHERE bundle_hash=$1 ORDER BY logical_item_id`, [pointer.bundle_hash])).rows;
  if (memberships.length !== selected.length) failRegistry('content_registry_corrupt');
  for (let i = 0; i < selected.length; i++) {
    const selection = selected[i], member = memberships[i];
    if (selection.logical_item_id !== member.logical_item_id || selection.definition_hash !== member.definition_hash
        || selection.package_id !== pointer.namespace || selection.bundle_hash !== pointer.bundle_hash
        || storedNumber(selection.activation_revision) !== revision
        || eventId(selection.event_id) !== eventId(event.id)) failRegistry('content_registry_corrupt');
  }
  return { revision, event, selected };
}
async function insertSelection(client, row) {
  await client.query(`INSERT INTO item_definition_activations
    (logical_item_id,definition_hash,package_id,bundle_hash,activation_revision,event_id)
    VALUES ($1,$2,$3,$4,$5,$6)`, [row.logical_item_id, row.definition_hash, row.package_id,
    row.bundle_hash, row.activation_revision, row.event_id]);
}
async function replaceSelections(client, capability) {
  const context = SELECTIONS.get(capability);
  if (!context || context.client !== client || context.identity !== phase2ContextIdentity(client)) {
    failRegistry('content_transaction_required');
  }
  // Consume once; neither a retained token nor another callback can replay the replacement.
  SELECTIONS.delete(capability);
  const { artifact, event, previous } = context;
  const { row } = verifiedArtifactData(client, artifact);
  const stored = (await client.query('SELECT * FROM content_activation_events WHERE id=$1', [event.id])).rows[0];
  if (!stored || eventId(stored.id) !== event.id || storedNumber(stored.activation_revision) !== event.revision) {
    failRegistry('content_registry_corrupt');
  }
  assertActivationHistory(stored, row);
  registerPhase2Undo(client, async () => {
    for (const selection of previous) {
      const retained = (await client.query('SELECT * FROM item_definition_activations WHERE logical_item_id=$1', [selection.logical_item_id])).rows[0];
      if (!retained) await insertSelection(client, selection);
      else if (Object.keys(selection).some((key) => String(retained[key]) !== String(selection[key]))) {
        failRegistry('content_registry_corrupt');
      }
    }
  });
  await client.query('DELETE FROM item_definition_activations WHERE package_id=$1', [row.namespace]);
  const memberships = (await client.query('SELECT * FROM content_bundle_item_definitions WHERE bundle_hash=$1 ORDER BY ordinal', [row.bundle_hash])).rows;
  for (const member of memberships) {
    registerPhase2Undo(client, () => client.query('DELETE FROM item_definition_activations WHERE logical_item_id=$1', [member.logical_item_id]));
    await insertSelection(client, { ...member, package_id: row.namespace,
      activation_revision: event.revision, event_id: event.id });
  }
}
async function updatePointer(client, pointer) {
  await client.query(`UPDATE content_bundle_activations SET bundle_hash=$2, activation_revision=$3,
    last_event_id=$4, activated_by=$5, activated_at=$6 WHERE namespace=$1`,
  [pointer.namespace, pointer.bundle_hash, pointer.activation_revision, pointer.last_event_id,
    pointer.activated_by, pointer.activated_at]);
}
export async function activateStoredBundle(pool, request, policy) {
  const input = ownRequest(request, ['namespace', 'bundleHash', 'expectedRevision', 'expectedPreviousBundleHash', 'operatorId']);
  if (typeof input.namespace !== 'string' || input.namespace.length > 128
      || !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/.test(input.namespace)
      || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 || Object.is(input.expectedRevision, -0)
      || (input.expectedRevision === 0) !== (input.expectedPreviousBundleHash === null)) failRegistry('bad_content_request');
  validHash(input.bundleHash);
  if (input.expectedPreviousBundleHash !== null) validHash(input.expectedPreviousBundleHash);
  auditOperator(input.operatorId);
  activationPolicySnapshot(policy);
  return withPhase2Transaction(pool, async (client) => {
    let pointer = (await client.query('SELECT * FROM content_bundle_activations WHERE namespace=$1', [input.namespace])).rows[0];
    if (!pointer) {
      registerPhase2Undo(client, () => client.query('DELETE FROM content_bundle_activations WHERE namespace=$1', [input.namespace]));
      await client.query('INSERT INTO content_bundle_activations (namespace) VALUES ($1) ON CONFLICT (namespace) DO NOTHING', [input.namespace]);
    }
    pointer = (await client.query(dbCaps.skipLocked
      ? 'SELECT * FROM content_bundle_activations WHERE namespace=$1 FOR UPDATE'
      : 'SELECT * FROM content_bundle_activations WHERE namespace=$1', [input.namespace])).rows[0];
    if (!pointer) failRegistry('content_registry_corrupt');
    const artifact = await loadVerifiedStoredArtifact(client, input.bundleHash);
    const { row } = verifiedArtifactData(client, artifact);
    await verifyRegisteredDefinitions(client, artifact);
    if (row.namespace !== input.namespace) failRegistry('bad_content_request');
    const policySnapshot = assertActivationPolicy(policy, row);
    const current = await currentSelection(client, pointer, artifact);
    const exact = input.expectedRevision === current.revision && input.expectedPreviousBundleHash === pointer.bundle_hash;
    if (input.bundleHash === pointer.bundle_hash) {
      const predecessor = current.revision === input.expectedRevision + 1
        && current.event.previous_bundle_hash === input.expectedPreviousBundleHash;
      if (!exact && !predecessor) failRegistry('content_activation_conflict');
      return activationResult(row, current.revision, eventId(current.event.id), true);
    }
    if (!exact || current.revision === Number.MAX_SAFE_INTEGER) failRegistry('content_activation_conflict');
    const revision = current.revision + 1;
    // Revision is unique under the namespace lock; register the inverse before INSERT can succeed.
    registerPhase2Undo(client, () => client.query('DELETE FROM content_activation_events WHERE namespace=$1 AND activation_revision=$2', [input.namespace, revision]));
    const event = (await client.query(`INSERT INTO content_activation_events
      (namespace,activation_revision,previous_bundle_hash,previous_dependency_lock_hash,bundle_hash,
       dependency_lock_hash,bundle_version,compiler_version,ir_version,profile,policy_snapshot_json,report_hashes_json,operator_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [row.namespace, revision, pointer.bundle_hash, current.event?.dependency_lock_hash ?? null,
      row.bundle_hash, row.dependency_lock_hash, row.bundle_version, row.compiler_version, row.ir_version,
      row.profile, canonicalBytes(policySnapshot).toString('utf8'), row.report_hashes_json, input.operatorId])).rows[0];
    const id = eventId(event.id);
    const capability = Object.freeze({});
    SELECTIONS.set(capability, { client, identity: phase2ContextIdentity(client), artifact,
      event: Object.freeze({ id, revision }), previous: current.selected });
    try { await replaceSelections(client, capability); } finally { SELECTIONS.delete(capability); }
    registerPhase2Undo(client, () => updatePointer(client, pointer));
    await updatePointer(client, { namespace: row.namespace, bundle_hash: row.bundle_hash,
      activation_revision: revision, last_event_id: id, activated_by: input.operatorId, activated_at: event.activated_at });
    return activationResult(row, revision, id, false);
  });
}
function activationResult(row, revision, id, replayed) {
  return Object.freeze({ namespace: row.namespace, bundleHash: row.bundle_hash,
    dependencyLockHash: row.dependency_lock_hash, activationRevision: revision, eventId: id, replayed });
}
