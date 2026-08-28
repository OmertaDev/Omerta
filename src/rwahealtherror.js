export const RWA_HEALTH_ERROR_CODES = Object.freeze([
  'health_bad_input', 'health_asset_not_found', 'health_registry_unavailable',
  'health_registry_stale', 'health_snapshot_changed', 'health_work_oversized',
  'health_capacity_exceeded', 'health_slot_conflict', 'health_page_conflict',
  'health_provider_timeout', 'health_provider_http', 'health_provider_oversized',
  'health_provider_malformed', 'health_evidence_conflict', 'health_evidence_limit',
  'health_state_conflict', 'health_not_fresh', 'health_blocked',
]);

export class RwaHealthError extends Error {
  static CODES = RWA_HEALTH_ERROR_CODES;

  constructor(code, message = code) {
    if (!RWA_HEALTH_ERROR_CODES.includes(code)) throw new TypeError('invalid RWA health error code');
    super(message);
    this.name = 'RwaHealthError';
    this.code = code;
  }
}
