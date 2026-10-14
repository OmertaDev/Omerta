// Test/tool-only closed Case/Crew catalog inverse. No gameplay authority is inherited.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { canonicalJson, sha256 } from './rc1-native-proof.js';

const normalize = text => text.replaceAll('\r\n', '\n');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
const hash = value => sha256(canonicalJson(value));
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };

export const CASE_CREW_CATALOG_TRANSFER = freeze({
  "sourceRevision": "299465106a662f90c4304b9535e2b2959d41bb2b",
  "predecessorRevision": "c75eb6de12ad9816d4a48f1e614a099098144eec",
  "sourcePins": {
    "src/content/phase1.js": "8406dcc2f0f97fa44325455ec9d72866b8f04467aa6f523613961a4ecdca1d48",
    "src/content/first-errand-case.js": "9b608d75e3e08f173fb2523ba3c824131b2480397ff34afbcdd8c5aa1cacd701",
    "src/content/crew-crosscurrent.js": "e6cd8e7680a4d8e6dcdda62d464a72e4997ebea309b7b571c0f4ed020a8e1772"
  },
  "sourceBlobs": {
    "src/content/phase1.js": "4ed2a005e13eae04aa7c216eef1e1ecbe51e04c9",
    "src/content/first-errand-case.js": "efc09fdbec7bbcf2edb2fcc2935c8eb7c3d2f50b",
    "src/content/crew-crosscurrent.js": "f3c4434f5936a84b76f28ca1c2a552e2cc532efe"
  },
  "manifestFile": "src/content/phase1.js",
  "manifestPredecessorSha256": "88f23c44f6ed589d0f9c91c6b6be0035653d6c0754fd8183b55148eb2df6b96a",
  "manifestPredecessorBlob": "aa2ffed2557910616472f5d517c405c89c929545",
  "manifestInverses": [
    {
      "current": "import { NEIGHBORHOOD_INITIATION_PACKAGE } from './neighborhood-initiation.js';\nimport { DISTRICT_STORY_ARC_PACKAGES } from './district-story-arcs.js';\nimport { STAGED_CREW_MISSIONS_PACKAGE } from './staged-crew-missions.js';\nimport { FIRST_ERRAND_CASE_PACKAGE } from './first-errand-case.js';\nimport { CITY_WORLD_OPPORTUNITY_PACKAGES } from './city-world-opportunities.js';\nimport { CREW_CROSSCURRENT_PACKAGE } from './crew-crosscurrent.js';\n\nexport const PHASE1_WORLD_GRAPH_PACKAGES = Object.freeze([\n  CORE_MATERIALS_PACKAGE,\n",
      "baseline": "import { NEIGHBORHOOD_INITIATION_PACKAGE } from './neighborhood-initiation.js';\nimport { DISTRICT_STORY_ARC_PACKAGES } from './district-story-arcs.js';\nimport { STAGED_CREW_MISSIONS_PACKAGE } from './staged-crew-missions.js';\nimport { CITY_WORLD_OPPORTUNITY_PACKAGES } from './city-world-opportunities.js';\n\nexport const PHASE1_WORLD_GRAPH_PACKAGES = Object.freeze([\n  CORE_MATERIALS_PACKAGE,\n"
    },
    {
      "current": "  ...DISTRICT_STORY_ARC_PACKAGES,\n  STAGED_CREW_MISSIONS_PACKAGE,\n  ...CITY_WORLD_OPPORTUNITY_PACKAGES,\n  FIRST_ERRAND_CASE_PACKAGE,\n  CREW_CROSSCURRENT_PACKAGE,\n]);\n",
      "baseline": "  ...DISTRICT_STORY_ARC_PACKAGES,\n  STAGED_CREW_MISSIONS_PACKAGE,\n  ...CITY_WORLD_OPPORTUNITY_PACKAGES,\n]);\n"
    }
  ],
  "actualSha256": "fd520b1928292d8152a69e8f453d7c383fd87cf8248264babd08ec64163929d8",
  "predecessorSha256": "3414895eac00bdec45efdd88ad7b0fce7274d86f903bee75a29cbc7b86f42268",
  "packageIds": [
    "first-errand-case-v2",
    "crew-crosscurrent-v1"
  ],
  "packageVersions": {
    "first-errand-case-v2": 2,
    "crew-crosscurrent-v1": 1
  },
  "packageNodeCounts": {
    "first-errand-case-v2": 13,
    "crew-crosscurrent-v1": 23
  },
  "addedNodes": 36,
  "addedNodesSha256": "d4c80d538b5edd8900a300cd915e5de7a31c23bc2bc62d492f49f2a4a48b7e1f",
  "phase": "exact source and catalog transfer only",
  "scope": "Only the complete exact Case/Crew catalog and three complete producer files reconstruct the complete frozen RPG catalog and its original manifest before unchanged historical inverses. ALL new Case/Crew authority, privacy, reachability, recovery, native, worker, migration, activation and deployment qualification remain outside this source-only transfer. New package instances remain UNKNOWN to historical sufficient paths."
});

export function assertCaseCrewCatalogSource(file, input) {
  const transfer = CASE_CREW_CATALOG_TRANSFER;
  assert(Object.hasOwn(transfer.sourcePins, file), 'Unknown Case/Crew catalog source: ' + file);
  assert.equal(typeof input, 'string', 'Case/Crew catalog source changed: non-text input');
  const text = normalize(input), actualSha256 = sha256(text);
  const current = actualSha256 === transfer.sourcePins[file];
  const prior = file === transfer.manifestFile && actualSha256 === transfer.manifestPredecessorSha256;
  assert(current || prior, 'Case/Crew catalog source changed: ' + file);
  assert.equal(blob(text), current ? transfer.sourceBlobs[file] : transfer.manifestPredecessorBlob,
    'Case/Crew complete catalog source blob changed: ' + file);
  let baselineText = text;
  if (file === transfer.manifestFile) {
    if (current) for (const chunk of transfer.manifestInverses) {
      assert.equal(baselineText.split(chunk.current).length, 2, 'Case/Crew manifest inverse is not exact and unique');
      baselineText = baselineText.replace(chunk.current, () => chunk.baseline);
    }
    assert.equal(sha256(baselineText), transfer.manifestPredecessorSha256, 'Case/Crew complete predecessor manifest changed');
    assert.equal(blob(baselineText), transfer.manifestPredecessorBlob, 'Case/Crew predecessor manifest blob changed');
  }
  return Object.freeze({ file, actualSha256, baselineText, sourceTransfer: transfer });
}

export function caseCrewCatalogSourceBaseline(file, input) {
  if (!Object.hasOwn(CASE_CREW_CATALOG_TRANSFER.sourcePins, file) || typeof input !== 'string') return input;
  const actual = sha256(normalize(input));
  if (actual !== CASE_CREW_CATALOG_TRANSFER.sourcePins[file]
      && !(file === CASE_CREW_CATALOG_TRANSFER.manifestFile && actual === CASE_CREW_CATALOG_TRANSFER.manifestPredecessorSha256)) return input;
  return assertCaseCrewCatalogSource(file, input).baselineText;
}

export function caseCrewRecoveryCatalog(catalog) {
  const transfer = CASE_CREW_CATALOG_TRANSFER;
  if (hash(catalog) !== transfer.actualSha256) return catalog;
  const ids = new Set(transfer.packageIds), added = catalog.nodes.filter(node => ids.has(node.packageId));
  assert.equal(added.length, transfer.addedNodes, 'Case/Crew complete additions changed');
  assert.equal(hash(added), transfer.addedNodesSha256, 'Case/Crew addition bytes changed');
  for (const id of transfer.packageIds) assert.equal(added.filter(node => node.packageId === id).length,
    transfer.packageNodeCounts[id], 'Case/Crew package count changed: ' + id);
  const predecessor = { ...catalog, nodes: catalog.nodes.filter(node => !ids.has(node.packageId)) };
  assert.equal(hash(predecessor), transfer.predecessorSha256, 'Complete frozen RPG catalog differs beyond exact Case/Crew additions');
  return predecessor;
}
