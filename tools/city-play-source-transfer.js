// Pure test/tool adapter for the additive City play candidate over the pinned predecessor.
// The literal working-source hashes qualify source reconstruction only, never current gameplay or deployment.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const lf = text => text.replaceAll('\r\n', '\n');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
const uniform = text => text === lf(text) || text === lf(text).replaceAll('\n', '\r\n');
export const CITY_PLAY_SOURCE_PREDECESSOR = '5c18acaaf47c84851729b82354340c4d56734dd9';
export const CITY_PLAY_SOURCE_PHASE = 'exact-working-source-transfer-only; no historical runtime/native/migration/financial/deployment clearance';
export const CITY_PLAY_SOURCE_DOMAINS = Object.freeze({
  "package.json": {
    "currentSha256": "89786037c14e4b0599d50ec12c77fe043406533687386a7bb6ddbb75ea6b6467",
    "currentBlob": "a154fd09ddf0150b4a55a8e6fadc0d7d141e0727",
    "baselineSha256": "e897f74c0b77a407e7592d6804bad98b5b14306224021fdce60371fec2c78067",
    "baselineBlob": "db63d40d420dcea51cfffe0ef146ec9e6cbc6463",
    "contextLines": 3,
    "inverses": [
      {
        "current": "    \"test:company-opportunities:postgres\": \"node test/companyopportunities.js --postgres && node test/companyopportunity-integration.js --postgres\",\n    \"test:commercial-reputation:postgres\": \"node test/commercialreputation.js --postgres && node test/commercialreputation-integration.js --postgres\",\n    \"test:business-seasons:postgres\": \"node test/businessseasons.js --postgres && node test/businessseason-integration.js --postgres\",\n    \"test:city-gameplay\": \"node test/city-district-arcs.js && node test/staged-crew-missions.js && node test/staged-crew-missions-api.js && node test/city-home-interiors-api.js && node test/city-encounters.js && node test/city-world-opportunities.js && node test/city-neighborhood-broadcast.js\",\n    \"test:city-gameplay:postgres\": \"node tools/city-gameplay-native.js\",\n    \"test:player-intel:postgres\": \"node tools/player-intel-native.js\",\n    \"test:city-gameplay:browser\": \"node test/city-district-arcs-browser.js && node test/city-gameplay-panels-browser.js\",\n",
        "baseline": "    \"test:company-opportunities:postgres\": \"node test/companyopportunities.js --postgres && node test/companyopportunity-integration.js --postgres\",\n    \"test:commercial-reputation:postgres\": \"node test/commercialreputation.js --postgres && node test/commercialreputation-integration.js --postgres\",\n    \"test:business-seasons:postgres\": \"node test/businessseasons.js --postgres && node test/businessseason-integration.js --postgres\",\n    \"test:city-gameplay\": \"node test/city-district-arcs.js && node test/staged-crew-missions.js && node test/staged-crew-missions-api.js && node test/city-home-interiors-api.js && node test/city-encounters.js && node test/city-world-opportunities.js\",\n    \"test:city-gameplay:postgres\": \"node tools/city-gameplay-native.js\",\n    \"test:player-intel:postgres\": \"node tools/player-intel-native.js\",\n    \"test:city-gameplay:browser\": \"node test/city-district-arcs-browser.js && node test/city-gameplay-panels-browser.js\",\n"
      }
    ]
  },
  "src/content/phase1.js": {
    "currentSha256": "a2eebadb85609e347dc3f1b4d13ac588b8972092c279430e6715fc383ae34b40",
    "currentBlob": "c766ca9a84ae9375de179ac2c4a12c9f7cbfb9a1",
    "baselineSha256": "53fdb996a2f82d1e02a219e5f23012dc6eeddaa6e76fe5dbe2a5dc9878f1be8f",
    "baselineBlob": "6fda3b76b784904980397001378cb5a481c7146c",
    "contextLines": 3,
    "inverses": [
      {
        "current": "import { DISTRICT_STORY_ARC_PACKAGES } from './district-story-arcs.js';\nimport { STAGED_CREW_MISSIONS_PACKAGE } from './staged-crew-missions.js';\nimport { CITY_WORLD_OPPORTUNITY_PACKAGES } from './city-world-opportunities.js';\nimport { NEIGHBORHOOD_BROADCAST_PACKAGE } from './neighborhood-broadcast.js';\n\nexport const PHASE1_WORLD_GRAPH_PACKAGES = Object.freeze([\n  CORE_MATERIALS_PACKAGE,\n",
        "baseline": "import { DISTRICT_STORY_ARC_PACKAGES } from './district-story-arcs.js';\nimport { STAGED_CREW_MISSIONS_PACKAGE } from './staged-crew-missions.js';\nimport { CITY_WORLD_OPPORTUNITY_PACKAGES } from './city-world-opportunities.js';\n\nexport const PHASE1_WORLD_GRAPH_PACKAGES = Object.freeze([\n  CORE_MATERIALS_PACKAGE,\n"
      },
      {
        "current": "  ...DISTRICT_STORY_ARC_PACKAGES,\n  STAGED_CREW_MISSIONS_PACKAGE,\n  ...CITY_WORLD_OPPORTUNITY_PACKAGES,\n  NEIGHBORHOOD_BROADCAST_PACKAGE,\n]);\n",
        "baseline": "  ...DISTRICT_STORY_ARC_PACKAGES,\n  STAGED_CREW_MISSIONS_PACKAGE,\n  ...CITY_WORLD_OPPORTUNITY_PACKAGES,\n]);\n"
      }
    ]
  },
  "src/content/phase1-policy.js": {
    "currentSha256": "bf2fb1c09955ef40b227aa9784b1e108210b3ba5c918ffacb8788b125a755121",
    "currentBlob": "fdf41299c12c81b328b6fc8bd3ae465b925a89c5",
    "baselineSha256": "f96edecd74219d94c327e0fa3e02dbfd539b89c9477ea7b05947af8f17bf69f1",
    "baselineBlob": "c872f66fa1babf2680eac4a5f4bda70bcc5be9c9",
    "contextLines": 3,
    "inverses": [
      {
        "current": "  'staged-crew-missions', 'city-neighbor-favors', 'city-shutter-lock', 'city-loading-route',\n  'city-careful-negotiation', 'city-sealed-record', 'city-rotating-account-0',\n  'city-rotating-account-1', 'city-rotating-account-2', 'city-rotating-account-3',\n  'neighborhood-broadcast',\n]);\n\nexport function phase1CraftReason(recipeId) {\n",
        "baseline": "  'staged-crew-missions', 'city-neighbor-favors', 'city-shutter-lock', 'city-loading-route',\n  'city-careful-negotiation', 'city-sealed-record', 'city-rotating-account-0',\n  'city-rotating-account-1', 'city-rotating-account-2', 'city-rotating-account-3',\n]);\n\nexport function phase1CraftReason(recipeId) {\n"
      }
    ]
  },
  "tools/release-source-transfer.js": {
    "currentSha256": "1af7c4d87c7400e123e5cd081ccf36855b572812fb0d24aa483dc430bc4f924e",
    "currentBlob": "0816d02da4520b9b2cd5673df8f2fb2acacbeb3b",
    "baselineSha256": "85242aafcd9e1ff6ea6d040de1fece427259051b32df80cf4316ba463dc885fd",
    "baselineBlob": "fcd07d77e6dbc2d5ee1bd378339202fdffb312b3",
    "contextLines": 3,
    "inverses": [
      {
        "current": "// This grants no historical runtime, PostgreSQL, migration, financial, genesis or deployment qualification.\nimport assert from 'node:assert/strict';\nimport crypto from 'node:crypto';\nimport { cityPlaySourceBaseline } from './city-play-source-transfer.js';\n\nconst lf = text => text.replaceAll('\\r\\n', '\\n');\nconst hash = text => crypto.createHash('sha256').update(text).digest('hex');\n",
        "baseline": "// This grants no historical runtime, PostgreSQL, migration, financial, genesis or deployment qualification.\nimport assert from 'node:assert/strict';\nimport crypto from 'node:crypto';\n\nconst lf = text => text.replaceAll('\\r\\n', '\\n');\nconst hash = text => crypto.createHash('sha256').update(text).digest('hex');\n"
      },
      {
        "current": "\n// No runtime discovery or pin refresh: only the literal candidate bytes above have an alias.\nexport function releaseSourceBaseline(file, input) {\n  input = cityPlaySourceBaseline(file, input);\n  if (!Object.hasOwn(RELEASE_SOURCE_DOMAINS, file) || typeof input !== 'string' || !uniform(input)) return input;\n  return hash(lf(input)) === RELEASE_SOURCE_DOMAINS[file].currentSha256\n    ? assertReleaseSourceTransfer(file, input).baselineText : input;\n",
        "baseline": "\n// No runtime discovery or pin refresh: only the literal candidate bytes above have an alias.\nexport function releaseSourceBaseline(file, input) {\n  if (!Object.hasOwn(RELEASE_SOURCE_DOMAINS, file) || typeof input !== 'string' || !uniform(input)) return input;\n  return hash(lf(input)) === RELEASE_SOURCE_DOMAINS[file].currentSha256\n    ? assertReleaseSourceTransfer(file, input).baselineText : input;\n"
      }
    ]
  }
});
for (const domain of Object.values(CITY_PLAY_SOURCE_DOMAINS)) {
  domain.inverses.forEach(Object.freeze);
  Object.freeze(domain.inverses);
  Object.freeze(domain);
}

export function assertCityPlaySourceTransfer(file, input) {
  assert(Object.hasOwn(CITY_PLAY_SOURCE_DOMAINS, file), 'Unknown City play source domain: ' + file);
  assert.equal(typeof input, 'string', 'City play source must be text: ' + file);
  assert(uniform(input), 'Mixed City play source line endings: ' + file);
  const domain = CITY_PLAY_SOURCE_DOMAINS[file], text = lf(input);
  assert.equal(hash(text), domain.currentSha256, 'City play complete current source drift: ' + file);
  assert.equal(blob(text), domain.currentBlob, 'City play complete current blob drift: ' + file);
  let baselineText = text;
  for (const hunk of domain.inverses) {
    assert(hunk.current.length, 'Empty City play inverse context');
    assert.equal(baselineText.split(hunk.current).length - 1, 1, 'Missing/duplicate/reordered City play inverse context: ' + file);
    baselineText = baselineText.replace(hunk.current, () => hunk.baseline);
  }
  assert.equal(hash(baselineText), domain.baselineSha256, 'City play complete predecessor source mismatch: ' + file);
  assert.equal(blob(baselineText), domain.baselineBlob, 'City play complete predecessor blob mismatch: ' + file);
  return { file, baselineText, currentSha256: domain.currentSha256, predecessorRevision: CITY_PLAY_SOURCE_PREDECESSOR,
    inverseChunks: domain.inverses.length, phase: CITY_PLAY_SOURCE_PHASE, sourceOnly: true };
}

// Unrecognized or partially applied source remains unchanged for the historical rejecting guard.
export function cityPlaySourceBaseline(file, input) {
  if (!Object.hasOwn(CITY_PLAY_SOURCE_DOMAINS, file) || typeof input !== 'string' || !uniform(input)) return input;
  return hash(lf(input)) === CITY_PLAY_SOURCE_DOMAINS[file].currentSha256
    ? assertCityPlaySourceTransfer(file, input).baselineText : input;
}
