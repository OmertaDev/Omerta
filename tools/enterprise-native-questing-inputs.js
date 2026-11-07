// A separate actual-current native declaration. No prior native result is transferred.
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const QUESTING_ENTERPRISE_NATIVE_INPUTS = freeze({
  version: 1,
  status: 'UNSEALED',
  phase: 'ACTUAL_CURRENT_QUESTING_ENTERPRISE_NATIVE_INPUTS',
  authoredRevision: null,
  predecessorDefinitionSha256: null,
  proofInventorySha256: null,
  files: [],
  replacements: [],
  additions: [],
});
export const QUESTING_ENTERPRISE_NATIVE_INPUTS_SHA256 = null;
