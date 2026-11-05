// Generated closed contract-release source binding; UNBOUND is deliberately unaccepted.
// Source views never grant runtime, native, migration, financial or deployment clearance.
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const CONTRACT_RELEASE_SOURCE_DATA = freeze({
  "version": 1,
  "status": "UNBOUND",
  "phase": "EXACT_CONTRACT_RELEASE_SOURCE_ONLY",
  "reviewedContractRevision": "d70c17d2cd9eb613e8695caf8c6dfc0b60a64a9e",
  "reviewedUiRevision": "f3b1fe4768fe2a6ef18dba5edb45bfdb090a04b7",
  "baseRevision": null,
  "baseTree": null,
  "sourceRevision": null,
  "sourceTree": null,
  "historicalManifests": {},
  "nativeChanges": {},
  "approvedAdditions": {},
  "sourceViews": {}
});
export const CONTRACT_RELEASE_SOURCE_DATA_SHA256 = "c205b24d39f00924cb34d9bc65c0b8a9738708b3fc803fc8618a8b6ce8b6c05f";
