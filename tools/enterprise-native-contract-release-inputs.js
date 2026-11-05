// Actual-current native input admission only; prior native results do not transfer.
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const ENTERPRISE_NATIVE_UX_INPUTS = freeze({
  "version": 4,
  "status": "UNSEALED",
  "phase": "ACTUAL_ENTERPRISE_CONTRACT_RELEASE_NATIVE_INPUTS",
  "authoredRevision": null,
  "predecessorRevision": "c6247976ff71e8d4c103ebd1498c2d373217d077",
  "uxRevision": "940df6a1efbe4ddcd8301cd138d5643dbe48a0bc",
  "nativePredecessorRevision": "1822593cfff6e66483a685fc7bf6bff4c50de5f0",
  "nativePredecessorMetadataSha256": "70db907a20352f433aec965c5cd1bdaa05ac7fb2c159b3c132538fc7d714789e",
  "deedSourceDefinitionSha256": null,
  "contractPredecessorRevision": null,
  "contractPredecessorMetadataSha256": null,
  "contractSourceDefinitionSha256": null,
  "contractSourceRevision": null,
  "contractBaseRevision": null,
  "reviewedContractRevision": "d70c17d2cd9eb613e8695caf8c6dfc0b60a64a9e",
  "reviewedUiRevision": "f3b1fe4768fe2a6ef18dba5edb45bfdb090a04b7",
  "legacyRevision": null,
  "legacyDefinitionSha256": null,
  "legacyInventorySha256": null,
  "files": [],
  "replacements": [],
  "legacyAdditionReplacements": [],
  "additions": []
});
export const ENTERPRISE_NATIVE_UX_INPUTS_SHA256 = "a9d020297380e13bc3cb8762e9277d80d8132706128709723a4076a6ec7847b5";
