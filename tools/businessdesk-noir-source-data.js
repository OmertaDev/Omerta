// Unbound integration source catalog. Only the explicit maintainer generator may bind it.
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const BUSINESS_DESK_NOIR_SOURCE = freeze({
  version: 1,
  status: 'UNBOUND',
  phase: 'EXACT_BUSINESS_DESK_NOIR_SOURCE_ONLY',
  revision: null,
  tree: null,
  contextLines: 3,
  files: [],
});
export const BUSINESS_DESK_NOIR_SOURCE_SHA256 = 'UNBOUND';
