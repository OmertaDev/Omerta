// Exact authored afterword content/reader to genuine B35 source only; no runtime/native/release clearance.
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const UX_AFTERWORD_SOURCE = freeze({
  "version": 1,
  "status": "SEALED",
  "phase": "EXACT_UX_AFTERWORD_SOURCE_ONLY",
  "revision": "fc32848ba3cc52b9b0e7c880c7f0d69771a4364a",
  "tree": "66f5b98ec9b6d35eb5e4b1fa5d63ad5e98af29d7",
  "targetRevision": "b35dd222054f0c5f3ca814f228dd7d9a46c58ae9",
  "targetTree": "c90fffe3232811c91878c9cc11b162074f335b6e",
  "contextLines": 3,
  "files": [
    {
      "file": "src/content/phase1-policy.js",
      "mode": "100644",
      "targetMode": "100644",
      "currentBlob": "31f67a4aa71a61688873d615d08d73dfd0e58895",
      "currentSha256": "f5d2339a39d856551ddd91dd1ca86a08e00e861348cc70c7f834f8a18f5bc837",
      "currentRawSha256": {
        "lf": "f5d2339a39d856551ddd91dd1ca86a08e00e861348cc70c7f834f8a18f5bc837",
        "crlf": "4350bcdc44483a9394c56e3d209c306d9622f1f25bcedf93224c38f73d6591a5"
      },
      "currentBytes": 7852,
      "targetBlob": "9905ac9dcc65ca58073bc0bdfe412c8b4aa97601",
      "targetSha256": "54fcf367ee3234527faa608d0725fcd3f4b58c646f4164f2264ea79655443ecb",
      "targetBytes": 7826,
      "inverses": [
        {
          "current": "  'staged-crew-missions', 'city-neighbor-favors', 'city-shutter-lock', 'city-loading-route',\n  'city-careful-negotiation', 'city-sealed-record', 'city-rotating-account-0',\n  'city-rotating-account-1', 'city-rotating-account-2', 'city-rotating-account-3',\n  'neighborhood-broadcast', 'neighborhood-afterword', 'property-investigation',\n  'equipment-recovery',\n]);\n\n",
          "baseline": "  'staged-crew-missions', 'city-neighbor-favors', 'city-shutter-lock', 'city-loading-route',\n  'city-careful-negotiation', 'city-sealed-record', 'city-rotating-account-0',\n  'city-rotating-account-1', 'city-rotating-account-2', 'city-rotating-account-3',\n  'neighborhood-broadcast', 'property-investigation',\n  'equipment-recovery',\n]);\n\n"
        }
      ]
    },
    {
      "file": "src/content/phase1.js",
      "mode": "100644",
      "targetMode": "100644",
      "currentBlob": "90f295bd33959e574bfc835301380e46e6cfb2e7",
      "currentSha256": "6d8ca127ad60b3e1b2672e5f015568b4b7712488c3ac8be9100f260404cc6c04",
      "currentRawSha256": {
        "lf": "6d8ca127ad60b3e1b2672e5f015568b4b7712488c3ac8be9100f260404cc6c04",
        "crlf": "ac15134b0bf10b97b8b65db0ad5f02adf49d52ed9a1a84b055e698235a10dbca"
      },
      "currentBytes": 1528,
      "targetBlob": "410973e7de00da7b7e703d4e0c137319a4bf39a2",
      "targetSha256": "6d3d5cccc4fbf99ca09ba13906536477651f64b3c8182d7d387cd9be08d8ffcb",
      "targetBytes": 1416,
      "inverses": [
        {
          "current": "import { STAGED_CREW_MISSIONS_PACKAGE } from './staged-crew-missions.js';\nimport { CITY_WORLD_OPPORTUNITY_PACKAGES } from './city-world-opportunities.js';\nimport { NEIGHBORHOOD_BROADCAST_PACKAGE } from './neighborhood-broadcast.js';\nimport { NEIGHBORHOOD_AFTERWORD_PACKAGE } from './neighborhood-afterword.js';\nimport { PROPERTY_INVESTIGATION_PACKAGE } from './property-investigation.js';\n\nexport const PHASE1_WORLD_GRAPH_PACKAGES = Object.freeze([\n",
          "baseline": "import { STAGED_CREW_MISSIONS_PACKAGE } from './staged-crew-missions.js';\nimport { CITY_WORLD_OPPORTUNITY_PACKAGES } from './city-world-opportunities.js';\nimport { NEIGHBORHOOD_BROADCAST_PACKAGE } from './neighborhood-broadcast.js';\nimport { PROPERTY_INVESTIGATION_PACKAGE } from './property-investigation.js';\n\nexport const PHASE1_WORLD_GRAPH_PACKAGES = Object.freeze([\n"
        },
        {
          "current": "  STAGED_CREW_MISSIONS_PACKAGE,\n  ...CITY_WORLD_OPPORTUNITY_PACKAGES,\n  NEIGHBORHOOD_BROADCAST_PACKAGE,\n  NEIGHBORHOOD_AFTERWORD_PACKAGE,\n  PROPERTY_INVESTIGATION_PACKAGE,\n  EQUIPMENT_RECOVERY_PACKAGE,\n]);\n",
          "baseline": "  STAGED_CREW_MISSIONS_PACKAGE,\n  ...CITY_WORLD_OPPORTUNITY_PACKAGES,\n  NEIGHBORHOOD_BROADCAST_PACKAGE,\n  PROPERTY_INVESTIGATION_PACKAGE,\n  EQUIPMENT_RECOVERY_PACKAGE,\n]);\n"
        }
      ]
    },
    {
      "file": "src/content/city-quest-presentation.js",
      "mode": "100644",
      "targetMode": "100644",
      "currentBlob": "57e3fb9dcfd3e9067546feb3ba36b360071ec148",
      "currentSha256": "7abe9758e99a68dda3f00bd54ad8f4d0b61af3bae844977a69e9dbba58f64515",
      "currentRawSha256": {
        "lf": "7abe9758e99a68dda3f00bd54ad8f4d0b61af3bae844977a69e9dbba58f64515",
        "crlf": "e2bf72cb6a0b609de76ec0198aaa7ef23d9f85dbc191c06c05dfe12b9f48e883"
      },
      "currentBytes": 2565,
      "targetBlob": "3f1d2cfa796bc80e8a881210446fb5cf8f7f5742",
      "targetSha256": "12acd35f7ec91bc16e2b0e72ffeb17cf0448f7734342f770e123d55a5b17005e",
      "targetBytes": 2207,
      "inverses": [
        {
          "current": "import { DISTRICT_STORY_ARCS } from './district-story-arcs.js';\nimport { NEIGHBORHOOD_BROADCAST_PRESENTATION, NEIGHBORHOOD_BROADCAST_VENUES,\n  NEIGHBORHOOD_BROADCAST_ACTION_LABELS } from './neighborhood-broadcast.js';\nimport { NEIGHBORHOOD_AFTERWORD_PRESENTATION, NEIGHBORHOOD_AFTERWORD_VENUES,\n  NEIGHBORHOOD_AFTERWORD_ACTION_LABELS } from './neighborhood-afterword.js';\nimport { PROPERTY_QUEST_PRESENTATION, PROPERTY_QUEST_VENUES, PROPERTY_QUEST_DISTRICTS } from './property-investigation.js';\n\nconst neighborhood = Object.freeze({ ...NEIGHBORHOOD_QUEST_PRESENTATION, cityQuest: true });\nexport const CITY_QUEST_PRESENTATIONS = Object.freeze([neighborhood,\n  ...DISTRICT_STORY_ARCS.map(story => story.presentation), NEIGHBORHOOD_BROADCAST_PRESENTATION, NEIGHBORHOOD_AFTERWORD_PRESENTATION,\n  PROPERTY_QUEST_PRESENTATION]);\nconst presentations = new Map(CITY_QUEST_PRESENTATIONS.map(presentation => [presentation.graphId, presentation]));\nconst venues = new Map([[neighborhood.graphId, NEIGHBORHOOD_QUEST_VENUES],\n  ...DISTRICT_STORY_ARCS.map(story => [story.package.id, story.venues]),\n  [NEIGHBORHOOD_BROADCAST_PRESENTATION.graphId, NEIGHBORHOOD_BROADCAST_VENUES],\n  [NEIGHBORHOOD_AFTERWORD_PRESENTATION.graphId, NEIGHBORHOOD_AFTERWORD_VENUES],\n  [PROPERTY_QUEST_PRESENTATION.graphId, PROPERTY_QUEST_VENUES]]);\nconst actionLabels = new Map([...DISTRICT_STORY_ARCS.map(story => [story.package.id, story.actionLabels]),\n  [NEIGHBORHOOD_BROADCAST_PRESENTATION.graphId, NEIGHBORHOOD_BROADCAST_ACTION_LABELS],\n  [NEIGHBORHOOD_AFTERWORD_PRESENTATION.graphId, NEIGHBORHOOD_AFTERWORD_ACTION_LABELS]]);\n\nexport function cityQuestPresentation(graphId) {\n  return presentations.get(graphId) || null;\n",
          "baseline": "import { DISTRICT_STORY_ARCS } from './district-story-arcs.js';\nimport { NEIGHBORHOOD_BROADCAST_PRESENTATION, NEIGHBORHOOD_BROADCAST_VENUES,\n  NEIGHBORHOOD_BROADCAST_ACTION_LABELS } from './neighborhood-broadcast.js';\nimport { PROPERTY_QUEST_PRESENTATION, PROPERTY_QUEST_VENUES, PROPERTY_QUEST_DISTRICTS } from './property-investigation.js';\n\nconst neighborhood = Object.freeze({ ...NEIGHBORHOOD_QUEST_PRESENTATION, cityQuest: true });\nexport const CITY_QUEST_PRESENTATIONS = Object.freeze([neighborhood,\n  ...DISTRICT_STORY_ARCS.map(story => story.presentation), NEIGHBORHOOD_BROADCAST_PRESENTATION,\n  PROPERTY_QUEST_PRESENTATION]);\nconst presentations = new Map(CITY_QUEST_PRESENTATIONS.map(presentation => [presentation.graphId, presentation]));\nconst venues = new Map([[neighborhood.graphId, NEIGHBORHOOD_QUEST_VENUES],\n  ...DISTRICT_STORY_ARCS.map(story => [story.package.id, story.venues]),\n  [NEIGHBORHOOD_BROADCAST_PRESENTATION.graphId, NEIGHBORHOOD_BROADCAST_VENUES],\n  [PROPERTY_QUEST_PRESENTATION.graphId, PROPERTY_QUEST_VENUES]]);\nconst actionLabels = new Map([...DISTRICT_STORY_ARCS.map(story => [story.package.id, story.actionLabels]),\n  [NEIGHBORHOOD_BROADCAST_PRESENTATION.graphId, NEIGHBORHOOD_BROADCAST_ACTION_LABELS]]);\n\nexport function cityQuestPresentation(graphId) {\n  return presentations.get(graphId) || null;\n"
        }
      ]
    },
    {
      "file": "test/worldgraph-validation.js",
      "mode": "100644",
      "targetMode": "100644",
      "currentBlob": "c73f08efbd515a6dbb4037de18a1b63defb6be4e",
      "currentSha256": "3c5db55fc8f1cb0fe42e2750661ff1084d42e96aa21efe0cace570b825aa7f8f",
      "currentRawSha256": {
        "lf": "3c5db55fc8f1cb0fe42e2750661ff1084d42e96aa21efe0cace570b825aa7f8f",
        "crlf": "2e0fc9413cb5cbcf88a006ae9ea85635e0ffc43d96655e619d67e9f20f56250b"
      },
      "currentBytes": 82460,
      "targetBlob": "0f5272b41cb138775276a3bc25ad368cec7d8126",
      "targetSha256": "f6b5dc19d1b3b7beca45baa87e5a698dc8d958d5e93de3ac7e58de7fe48abe17",
      "targetBytes": 82362,
      "inverses": [
        {
          "current": "  'staged-crew-missions', 'city-neighbor-favors', 'city-shutter-lock', 'city-loading-route',\n  'city-careful-negotiation', 'city-sealed-record', 'city-rotating-account-0',\n  'city-rotating-account-1', 'city-rotating-account-2', 'city-rotating-account-3',\n  'neighborhood-broadcast', 'neighborhood-afterword', 'property-investigation', 'equipment-recovery',\n]);\nassert.equal(PHASE1_WORLD_GRAPH_PACKAGES.length, 25);\nassert.equal(phase1First.packages, 25);\nassert.equal(phase1First.nodes, 193);\nassert.equal(phase1First.recipes, 5);\nassert.equal(phase1First.omrRewards, 0, 'the Phase 1 graph cannot mint OMR');\nassert.deepEqual(phase1First.executableDefinitions, {\n",
          "baseline": "  'staged-crew-missions', 'city-neighbor-favors', 'city-shutter-lock', 'city-loading-route',\n  'city-careful-negotiation', 'city-sealed-record', 'city-rotating-account-0',\n  'city-rotating-account-1', 'city-rotating-account-2', 'city-rotating-account-3',\n  'neighborhood-broadcast', 'property-investigation', 'equipment-recovery',\n]);\nassert.equal(PHASE1_WORLD_GRAPH_PACKAGES.length, 24);\nassert.equal(phase1First.packages, 24);\nassert.equal(phase1First.nodes, 183);\nassert.equal(phase1First.recipes, 5);\nassert.equal(phase1First.omrRewards, 0, 'the Phase 1 graph cannot mint OMR');\nassert.deepEqual(phase1First.executableDefinitions, {\n"
        },
        {
          "current": "    fs.readFileSync(path.join(root, 'src', 'content', file), 'utf8'),\n  )).sort();\nassert.deepEqual(packageSources, [\n  'automotive-salvage.js', 'belladonna.js', 'city-world-opportunities.js', 'company-production-quality.js', 'core-materials.js', 'district-story-arcs.js', 'equipment-recovery.js', 'neighborhood-afterword.js', 'neighborhood-broadcast.js', 'neighborhood-initiation.js', 'phase1.js', 'property-investigation.js', 'staged-crew-missions.js',\n], 'every production world-graph package module must be present in the canonical Phase 1 manifest');\nconst phase1RuntimeFiles = [\n  'src/items.js', 'src/crafting.js', 'src/mysteries.js', 'src/operations.js',\n",
          "baseline": "    fs.readFileSync(path.join(root, 'src', 'content', file), 'utf8'),\n  )).sort();\nassert.deepEqual(packageSources, [\n  'automotive-salvage.js', 'belladonna.js', 'city-world-opportunities.js', 'company-production-quality.js', 'core-materials.js', 'district-story-arcs.js', 'equipment-recovery.js', 'neighborhood-broadcast.js', 'neighborhood-initiation.js', 'phase1.js', 'property-investigation.js', 'staged-crew-missions.js',\n], 'every production world-graph package module must be present in the canonical Phase 1 manifest');\nconst phase1RuntimeFiles = [\n  'src/items.js', 'src/crafting.js', 'src/mysteries.js', 'src/operations.js',\n"
        },
        {
          "current": "  'src/content/belladonna.js', 'src/content/phase1.js', 'src/content/phase1-policy.js',\n  'src/content/neighborhood-initiation.js', 'src/content/neighborhood-initiation.json',\n  'src/content/neighborhood-broadcast.js',\n  'src/content/neighborhood-afterword.js',\n  'src/content/property-investigation.js',\n  'src/content/district-story-arcs.js', 'src/content/city-quest-presentation.js',\n  'src/content/staged-crew-missions.js', 'src/content/city-world-opportunities.js',\n",
          "baseline": "  'src/content/belladonna.js', 'src/content/phase1.js', 'src/content/phase1-policy.js',\n  'src/content/neighborhood-initiation.js', 'src/content/neighborhood-initiation.json',\n  'src/content/neighborhood-broadcast.js',\n  'src/content/property-investigation.js',\n  'src/content/district-story-arcs.js', 'src/content/city-quest-presentation.js',\n  'src/content/staged-crew-missions.js', 'src/content/city-world-opportunities.js',\n"
        }
      ]
    }
  ]
});
export const UX_AFTERWORD_SOURCE_SHA256 = "8078db64c051999e4dac30e2ef852644404e44e49b145d0ec9c8b6e304c12389";
