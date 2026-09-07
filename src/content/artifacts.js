import { dbCaps } from '../db.js';
import { withPhase2Transaction, registerPhase2Undo } from './phase2-transactions.js';
import { ownRequest, snapshotBytes, snapshotIdentity, auditOperator, failRegistry,
  verifyIncomingArtifact, verifyStoredArtifactRow, verifiedArtifactData } from './artifact-storage.js';
import { registerVerifiedDefinitions, verifyRegisteredDefinitions } from '../itemdefinitions.js';

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
