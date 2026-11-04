// Exact source/provenance only. Generate after the complete integration source is committed.
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const ECONOMY_DEED_MERGE_SOURCE = freeze({
  version: 1, status: 'UNSEALED', phase: 'EXACT_ECONOMY_DEED_MERGE_SOURCE_ONLY',
  sourceRevision: null, sourceTree: null,
  profiles: { monitor: { revision: 'c771f5ba73453a57e24e31f8eeb920933fe7544c', tree: null },
    deed: { revision: '4e5f7fdb1cc4d2055ac613d2d4cb562a8007c364', tree: null } },
  files: [], sourceOnly: true, runtime: false, native: false,
});
export const ECONOMY_DEED_MERGE_SOURCE_SHA256 = '0000000000000000000000000000000000000000000000000000000000000000';
export const ECONOMY_DEED_MERGE_NATIVE_PROVENANCE = freeze({
  version: 1, status: 'UNSEALED', phase: 'EXACT_ECONOMY_DEED_MERGE_SOURCE_PROVENANCE_ONLY',
  sourceRevision: null, sourceTree: null, predecessorRevision: null,
  predecessorDefinitionSha256: null, predecessorMetadataSha256: null,
  reviewedFiles: [], files: [], sourceOnly: true, nativeAdmission: false, priorResultsTransferred: false,
});
export const ECONOMY_DEED_MERGE_NATIVE_PROVENANCE_SHA256 = '0000000000000000000000000000000000000000000000000000000000000000';
