import { withPhase2Read } from './phase2-transactions.js';
import { loadVerifiedStoredArtifact, storedNumber, validHash } from './artifact-storage.js';
import { definitionByHash, verifyRegisteredDefinitions } from '../itemdefinitions.js';
import { assertActivationHistory, assertActivationPolicy } from './activation-policy.js';

// Diagnostics contain only closed check names and row positions, never stored/private values.
// Full scans are intentional for this offline integrity audit; per-check examples are bounded.
export async function collectDefinitionChecks(queryable, activationPolicy = null) {
  return withPhase2Read(queryable, async (q) => {
    const checks = ['content_artifact_integrity', 'item_definition_integrity', 'content_membership_integrity',
      'content_activation_chain_integrity', 'content_selection_integrity',
      'content_activation_history_policy', 'content_activation_policy_drift']
      .map((name) => ({ name, lhs: 0, rhs: 0, drift: 0, ok: true, issues: [] }));
    function fail(index, row) {
      const check = checks[index]; check.lhs++; check.drift++; check.ok = false;
      if (check.issues.length < 20) check.issues.push(`row:${row}`);
    }
    const artifacts = (await q.query('SELECT * FROM content_bundle_artifacts ORDER BY bundle_hash')).rows;
    const definitions = (await q.query('SELECT * FROM item_definition_versions ORDER BY definition_hash')).rows;
    const members = (await q.query('SELECT * FROM content_bundle_item_definitions ORDER BY bundle_hash,ordinal')).rows;
    const events = (await q.query('SELECT * FROM content_activation_events ORDER BY namespace,activation_revision')).rows;
    const pointers = (await q.query('SELECT * FROM content_bundle_activations ORDER BY namespace')).rows;
    const selections = (await q.query('SELECT * FROM item_definition_activations ORDER BY logical_item_id')).rows;
    const artifactMap = new Map(artifacts.map((row) => [row.bundle_hash,row]));
    const definitionMap = new Map(definitions.map((row) => [row.definition_hash,row]));
    const pointerMap = new Map(pointers.map((row) => [row.namespace,row]));
    const eventMap = new Map(events.map((row) => [String(row.id),row]));
    const memberships = new Map(), history = new Map();
    for (const member of members) {
      if (!memberships.has(member.bundle_hash)) memberships.set(member.bundle_hash,[]);
      memberships.get(member.bundle_hash).push(member);
    }
    for (const event of events) {
      if (!history.has(event.namespace)) history.set(event.namespace,[]);
      history.get(event.namespace).push(event);
    }
    for (const [i,row] of artifacts.entries()) {
      let verified;
      try { verified = await loadVerifiedStoredArtifact(q,row.bundle_hash); } catch (error) {
        // These are explicit stored-artifact/closure refusals. SQLSTATEs, transport errors
        // and unexpected failures must reach the snapshot owner instead of raising drift.
        if (!['content_artifact_not_found', 'content_registry_corrupt', 'content_dependency_unresolved',
          'content_dependency_drift', 'content_input_limit'].includes(error?.code)) throw error;
        fail(0,i);
      }
      const set = memberships.get(row.bundle_hash) ?? [];
      if (set.length !== row.definition_count || set.some((member,index) => member.ordinal !== index)) fail(2,i);
      if (verified) {
        try { await verifyRegisteredDefinitions(q,verified); } catch (error) {
          if (error?.code !== 'content_registry_corrupt') throw error;
          fail(2,i);
        }
      }
    }
    for (const [i,row] of definitions.entries()) {
      // This value came from stored state, not a caller. Keep its synchronous format
      // refusal separate from operational errors raised by the awaited public lookup.
      try { validHash(row.definition_hash); } catch (error) {
        if (error?.code !== 'bad_content_request') throw error;
        fail(1,i); continue;
      }
      try { await definitionByHash(q,row.definition_hash); } catch (error) {
        if (!['definition_not_found', 'content_registry_corrupt'].includes(error?.code)) throw error;
        fail(1,i);
      }
    }
    for (const [i,row] of members.entries()) {
      const artifact = artifactMap.get(row.bundle_hash), definition = definitionMap.get(row.definition_hash);
      if (!artifact || !definition || row.logical_item_id !== definition.logical_item_id
          || definition.package_id !== artifact.namespace
          || !row.logical_item_id.startsWith(`${artifact.namespace}::`)) fail(2,i);
    }
    function eventMetadata(event, artifact) {
      if (!artifact || event.namespace !== artifact.namespace || event.bundle_hash !== artifact.bundle_hash
          || event.dependency_lock_hash !== artifact.dependency_lock_hash
          || storedNumber(event.bundle_version) !== storedNumber(artifact.bundle_version)
          || event.compiler_version !== artifact.compiler_version || event.ir_version !== artifact.ir_version
          || event.profile !== artifact.profile || event.report_hashes_json !== artifact.report_hashes_json) throw Error();
    }
    for (const [i,event] of events.entries()) {
      const artifact = artifactMap.get(event.bundle_hash);
      try { eventMetadata(event,artifact); } catch { fail(3,i); }
      try { assertActivationHistory(event,artifact); } catch { fail(5,i); }
      if (!pointerMap.has(event.namespace)) fail(3,i);
    }
    for (const [i,pointer] of pointers.entries()) {
      const chain = history.get(pointer.namespace) ?? [];
      try {
        const revision = pointer.activation_revision === 0 || pointer.activation_revision === '0'
          ? 0 : storedNumber(pointer.activation_revision);
        if (revision === 0) {
          if (chain.length || pointer.bundle_hash !== null || pointer.last_event_id !== null
              || pointer.activated_by !== null || pointer.activated_at !== null) throw Error();
        } else {
          if (chain.length !== revision || !pointer.activated_by || !pointer.activated_at) throw Error();
          let previous = null;
          for (const [index,event] of chain.entries()) {
            if (storedNumber(event.activation_revision) !== index+1
                || event.previous_bundle_hash !== (previous?.bundle_hash ?? null)
                || event.previous_dependency_lock_hash !== (previous?.dependency_lock_hash ?? null)) throw Error();
            previous = event;
          }
          if (String(previous.id) !== String(pointer.last_event_id) || previous.bundle_hash !== pointer.bundle_hash
              || previous.operator_id !== pointer.activated_by
              || new Date(previous.activated_at).getTime() !== new Date(pointer.activated_at).getTime()) throw Error();
        }
      } catch { fail(3,i); }
      if (Number(pointer.activation_revision) > 0) {
        try {
          const artifact = artifactMap.get(pointer.bundle_hash);
          if (!artifact || artifact.namespace !== pointer.namespace) throw Error();
          assertActivationPolicy(activationPolicy,artifact);
        } catch { fail(6,i); }
      }
      const expected = Number(pointer.activation_revision) > 0 ? memberships.get(pointer.bundle_hash) ?? [] : [];
      const selected = selections.filter((row) => row.package_id === pointer.namespace);
      if (expected.length !== selected.length || expected.some((member) => !selected.some((row) =>
        row.logical_item_id === member.logical_item_id && row.definition_hash === member.definition_hash
        && row.bundle_hash === pointer.bundle_hash && String(row.activation_revision) === String(pointer.activation_revision)
        && String(row.event_id) === String(pointer.last_event_id)))) fail(4,i);
    }
    for (const [i,row] of selections.entries()) {
      const pointer = pointerMap.get(row.package_id), definition = definitionMap.get(row.definition_hash);
      const event = eventMap.get(String(row.event_id)), artifact = artifactMap.get(row.bundle_hash);
      if (!pointer || !definition || row.package_id !== definition.package_id
          || !event || event.namespace !== row.package_id || event.bundle_hash !== row.bundle_hash
          || String(event.activation_revision) !== String(row.activation_revision)
          || !artifact || artifact.authority_profile !== 'production' || artifact.namespace !== row.package_id
          || row.logical_item_id !== definition.logical_item_id || !row.logical_item_id.startsWith(`${row.package_id}::`)
          || row.bundle_hash !== pointer.bundle_hash || String(row.activation_revision) !== String(pointer.activation_revision)
          || String(row.event_id) !== String(pointer.last_event_id)
          || !(memberships.get(row.bundle_hash) ?? []).some((member) =>
            member.logical_item_id === row.logical_item_id && member.definition_hash === row.definition_hash)) fail(4,i);
    }
    return checks;
  });
}
