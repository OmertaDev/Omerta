// Actual-current native input admission only; prior native results do not transfer.
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const ENTERPRISE_NATIVE_UX_INPUTS = freeze({
  "version": 3,
  "status": "UNSEALED",
  "phase": "ACTUAL_ENTERPRISE_DEED_NATIVE_INPUTS",
  "authoredRevision": "0000000000000000000000000000000000000000",
  "predecessorRevision": "c6247976ff71e8d4c103ebd1498c2d373217d077",
  "uxRevision": "940df6a1efbe4ddcd8301cd138d5643dbe48a0bc",
  "nativePredecessorRevision": "1822593cfff6e66483a685fc7bf6bff4c50de5f0",
  "nativePredecessorMetadataSha256": "70db907a20352f433aec965c5cd1bdaa05ac7fb2c159b3c132538fc7d714789e",
  "deedSourceDefinitionSha256": "c2f04fd65bc1556b1e09a45ed7b4e3886fdbbae69c835880bae98d98178dd77e",
  "legacyRevision": "123c1b2e1da3e24398ca88b1b261185c08dd3988",
  "legacyDefinitionSha256": "a5b7fb0db57cc7945b5f96b975b7ac0fe6cef4d05e1dd10c929c083429703ce4",
  "legacyInventorySha256": "385de56c6df70d28b8550412dd2c4909b6ed2eae99ef5d5c79da4d641481a84f",
  "files": [],
  "replacements": [],
  "legacyAdditionReplacements": [],
  "additions": []
});
export const ENTERPRISE_NATIVE_UX_INPUTS_SHA256 = "fbb8c9517396580490cd922ce2df031038aa5f11ddf1aa6f763de050bb21bc4a";
