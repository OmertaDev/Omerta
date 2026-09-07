import { canonicalBytes } from './canonical.js';
import { ownRequest, failRegistry, storedNumber } from './artifact-storage.js';

// Process-local trusted operator configuration; serialized audit evidence grants no authority.
const POLICIES = new WeakMap();
function snapshot(config) {
  try {
    const { environment, allowedProfiles } = ownRequest(config, ['environment', 'allowedProfiles']);
    if (typeof environment !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(environment)
        || !Array.isArray(allowedProfiles) || allowedProfiles.length > 1) throw Error();
    const profiles = [];
    // Inspect own data slots: accessors, holes, custom array properties and inherited values
    // must not supply trusted configuration or execute during admission.
    if (Reflect.ownKeys(allowedProfiles).length !== allowedProfiles.length + 1) throw Error();
    for (let i = 0; i < allowedProfiles.length; i++) {
      const property = Object.getOwnPropertyDescriptor(allowedProfiles, String(i));
      if (!property || !Object.hasOwn(property, 'value') || property.value !== 'phase2_economy') throw Error();
      profiles.push(property.value);
    }
    return Object.freeze({ environment, allowedProfiles: Object.freeze(profiles.sort()) });
  } catch { failRegistry('content_activation_policy_invalid'); }
}
export function createActivationPolicy(config) {
  const value = snapshot(config);
  const policy = Object.freeze({});
  POLICIES.set(policy, value);
  return policy;
}
export function activationPolicySnapshot(policy) {
  const value = policy && POLICIES.get(policy);
  if (!value) failRegistry('content_activation_policy_invalid');
  return value;
}
export function assertActivationPolicy(policy, artifactRow) {
  const value = activationPolicySnapshot(policy);
  if (artifactRow.authority_profile !== 'production' || !value.allowedProfiles.includes(artifactRow.profile)) {
    failRegistry('content_activation_policy_denied');
  }
  return value;
}
export function assertActivationHistory(event, artifactRow) {
  try {
    const value = snapshot(JSON.parse(event.policy_snapshot_json));
    if (canonicalBytes(value).toString('utf8') !== event.policy_snapshot_json
        || artifactRow.authority_profile !== 'production' || !value.allowedProfiles.includes(artifactRow.profile)
        || event.namespace !== artifactRow.namespace || event.bundle_hash !== artifactRow.bundle_hash
        || event.dependency_lock_hash !== artifactRow.dependency_lock_hash
        || storedNumber(event.bundle_version) !== storedNumber(artifactRow.bundle_version)
        || event.compiler_version !== artifactRow.compiler_version || event.ir_version !== artifactRow.ir_version
        || event.profile !== artifactRow.profile || event.report_hashes_json !== artifactRow.report_hashes_json) throw Error();
    const reports = JSON.parse(event.report_hashes_json);
    if (canonicalBytes(reports).toString('utf8') !== event.report_hashes_json) throw Error();
    return value;
  } catch { failRegistry('content_registry_corrupt'); }
}
