// Exact launch integration source binding only; no runtime or release results transfer.
const freeze = value => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const LAUNCH_INTEGRATION_SOURCE = freeze({
  "status": "SEALED",
  "phase": "EXACT_LAUNCH_INTEGRATION_SOURCE_BINDING_ONLY",
  "revision": "5c662b9c1f42785af9765fb81be3aff4803fbcd6",
  "tree": "bd4caaf8f85cc818addf645b7761870a9de4dd9d",
  "predecessor": "83baa47c51c00ec16ac982aa751ee0c1cb6e00c7",
  "predecessorTree": "6aafe091338ca76f50b1c65bae0c43b1326751e1",
  "candidateEntries": {
    ".github/workflows/forge.yml": {
      "mode": "100644",
      "blob": "76ea4665324d92732fe54e0d8a03dda651169bd4"
    },
    "omerta-contracts/src/StreetDeed.sol": {
      "mode": "100644",
      "blob": "738cf95b6a0c0abb7b1cfdb5a1c169df31056596"
    },
    "omerta-contracts/src/interfaces/IVenuePolicy.sol": {
      "mode": "100644",
      "blob": "4825371e3a68213fbab546b1c043cf76dc89b145"
    },
    "omerta-contracts/src/market-v2/OmertaEthRewardsV2.sol": {
      "mode": "100644",
      "blob": "69ab0de2c1b6efbad156be9515c6e3711f4f0959"
    },
    "omerta-contracts/src/market-v2/OmertaGameCustodyV2.sol": {
      "mode": "100644",
      "blob": "3d8b8cd8e9eb20fbc95845a5e91e84d2de55d5a6"
    },
    "omerta-contracts/src/market-v2/OmertaOperatingSinksV2.sol": {
      "mode": "100644",
      "blob": "36596ff0340bd538718a9c02b5c4e5da8c0eff24"
    },
    "omerta-contracts/src/market-v2/OmertaRestrictedOMRV2.sol": {
      "mode": "100644",
      "blob": "76b77ef1546292877663fb2f3184a085d606589f"
    },
    "omerta-contracts/src/market-v2/core/OmertaPoolManagerV2.sol": {
      "mode": "100644",
      "blob": "d10841ffe4e39f9c2cbfbc1e9b8eaa53da429050"
    },
    "omerta-contracts/test/StreetDeed.t.sol": {
      "mode": "100644",
      "blob": "39ec3333a90a4b6827b639bc5cd9a60b912904bf"
    },
    "omerta-contracts/test/StreetDeedGameplay.t.sol": {
      "mode": "100644",
      "blob": "d759bc09a76385698ef7687b45c91797e4cbb518"
    },
    "omerta-contracts/test/StreetDeedPrimarySale.t.sol": {
      "mode": "100644",
      "blob": "5eccc8e1eb084c88789def9c000d5cc1610dc040"
    },
    "omerta-contracts/test/market-v2/EthRewardsIntegrationV2.t.sol": {
      "mode": "100644",
      "blob": "703fc2cbf5f7ae58f80b5fde2d7941b10b0dcb8a"
    },
    "omerta-contracts/test/market-v2/EthRewardsV2.t.sol": {
      "mode": "100644",
      "blob": "5200b22537b927e3272c6ee86b7377f8e284d71a"
    },
    "omerta-contracts/test/market-v2/FamilyDistributorV2.t.sol": {
      "mode": "100644",
      "blob": "0a35023657d547fb7550744826397ddc2045cf6d"
    },
    "omerta-contracts/test/market-v2/GameCustodyV2.t.sol": {
      "mode": "100644",
      "blob": "c8cc36f4096847b4a683363156bc1fe428cdd52e"
    },
    "omerta-contracts/test/market-v2/InventoryBondV2.t.sol": {
      "mode": "100644",
      "blob": "744b7a5919d5f46e44d3efad579b4750fcd60184"
    },
    "omerta-contracts/test/market-v2/OperatingSinksAdversarialV2.t.sol": {
      "mode": "100644",
      "blob": "dfdc6c7b10bedf953a485527b9f4053307b0c8cd"
    },
    "omerta-contracts/test/market-v2/OperatingSinksV2.t.sol": {
      "mode": "100644",
      "blob": "15b90ad4036bbdba335706b6909ab7695365d820"
    },
    "omerta-contracts/test/market-v2/OperatingSinksV2Invariant.t.sol": {
      "mode": "100644",
      "blob": "9860b44b6aec7d875639d8d1d8646df660800a46"
    },
    "omerta-contracts/test/market-v2/PlayerGenesisProductionStackV2.t.sol": {
      "mode": "100644",
      "blob": "3fae0b0b77122d9f6c5c19c3aee70cd514518051"
    },
    "omerta-contracts/test/market-v2/PolicyLifecycleIntegrationV2.t.sol": {
      "mode": "100644",
      "blob": "00ab13d13a0cec9883a50e66d46cb43738e6eaa8"
    },
    "omerta-contracts/test/market-v2/PublicGenesisProductionStackV2.t.sol": {
      "mode": "100644",
      "blob": "f3e713e718247776ddc2f3fd6f6ac1bc2bd13a75"
    },
    "omerta-contracts/test/market-v2/RestrictedMarketIntegrationV2.t.sol": {
      "mode": "100644",
      "blob": "c4c870d5a9323c3c8111d6d77024308da247b4c1"
    },
    "omerta-contracts/test/market-v2/RestrictedOMRV2.t.sol": {
      "mode": "100644",
      "blob": "9a191b4fae31afef5564245b86b32d7cf3c07b63"
    },
    "omerta-contracts/test/market-v2/RestrictedPoolManagerV2.t.sol": {
      "mode": "100644",
      "blob": "2215b89bd2271650b7e1d7b4a636728e82a9fd39"
    },
    "omerta-contracts/test/market-v2/RewardsFeeV2.t.sol": {
      "mode": "100644",
      "blob": "8272bf1ecfe8186299aafc463c6b5bb8fbb47dfa"
    },
    "omerta-contracts/test/market-v2/VenuePolicyRefusalsV2.t.sol": {
      "mode": "100644",
      "blob": "e23729148217205e2fa79623bc575e7f09186728"
    },
    "omerta-contracts/test/market-v2/VenuePolicyV2.t.sol": {
      "mode": "100644",
      "blob": "f28195316eeb2f2b45c9599e1a73c0a2899603df"
    },
    "omerta-privacy/experiments/private-account-record/encryption.mjs": {
      "mode": "100644",
      "blob": "b9110705399b1c1dced3be16a252c1661a5dd947"
    },
    "omerta-privacy/experiments/private-account-record/fixtures.mjs": {
      "mode": "100644",
      "blob": "1b913cba067b300bfdb309845da01db35fd1fab3"
    },
    "omerta-privacy/experiments/private-account-record/record.mjs": {
      "mode": "100644",
      "blob": "53dce91b2fc1e8275ca5b36ddfceeffd812df60a"
    },
    "omerta-privacy/experiments/private-account-record/recovery.mjs": {
      "mode": "100644",
      "blob": "d02978f576b6dbba10fbffecaed46f3860ad9c91"
    },
    "omerta-privacy/experiments/private-book-codec/decimal.mjs": {
      "mode": "100644",
      "blob": "5125cf05a5bff542c02e0240262d09bc81a72f30"
    },
    "omerta-privacy/experiments/private-character-eligibility/registry.mjs": {
      "mode": "100644",
      "blob": "adf4392233c62dda714dd3872e5a9980d54fd0ec"
    },
    "omerta-privacy/experiments/private-character-eligibility/schema-catalog.mjs": {
      "mode": "100644",
      "blob": "74c8ea1a0101e33fe8fb91324b58e50a03b89a13"
    },
    "omerta-privacy/experiments/private-character-eligibility/values.mjs": {
      "mode": "100644",
      "blob": "01d4e8261f8f7652234f91afb9b0d49b05f3e87a"
    },
    "omerta-privacy/experiments/private-current-reads/index.mjs": {
      "mode": "100644",
      "blob": "5e236740fef703e5eb305d6a9abe029cc7bce01e"
    },
    "omerta-privacy/experiments/private-mutable-binding/codec.mjs": {
      "mode": "100644",
      "blob": "feeb2077b65164177a4df150781b9f4fb5e874aa"
    },
    "omerta-privacy/experiments/private-mutable-binding/codec.test.mjs": {
      "mode": "100644",
      "blob": "23983b05193e7c72c0c8d4b35d7a599c39ec0a22"
    },
    "omerta-privacy/experiments/private-mutable-binding/fixtures/CONTEXT-VECTORS.json": {
      "mode": "100644",
      "blob": "b8dd4cb8d24d8e5ba902ff697446e337066d15a7"
    },
    "omerta-privacy/experiments/private-mutable-envelope-codec/bytes.mjs": {
      "mode": "100644",
      "blob": "207e16f7aa67a43eb9d2381bbaaa3a4ea43e4871"
    },
    "omerta-privacy/experiments/private-mutable-envelope-codec/codec.mjs": {
      "mode": "100644",
      "blob": "ffbcaefe5bd3bccc246bba6bd81cbbe462d98c26"
    },
    "omerta-privacy/experiments/private-mutable-envelope-codec/codec.test.mjs": {
      "mode": "100644",
      "blob": "2a37987837b74f7f5552d9033e6c4c2417c862a8"
    },
    "omerta-privacy/experiments/private-mutable-envelope-codec/fixtures/DIFFERENTIAL-VECTORS.json": {
      "mode": "100644",
      "blob": "b4730028f1a47f3db40ae44b59ae4abdb5187bb0"
    },
    "omerta-privacy/experiments/private-record-recovery-ownership/guarded.mjs": {
      "mode": "100644",
      "blob": "694436839c4924f2108cadfa1055d7f3e8730194"
    },
    "omerta-privacy/experiments/verifiable-note-encryption/encryption.mjs": {
      "mode": "100644",
      "blob": "f71c7278aaeb5af6eca542362dd8e854874d000e"
    },
    "omerta-privacy/package-lock.json": {
      "mode": "100644",
      "blob": "2bf80eb5a9623417bac7a6b995cf8f4f006b1ac8"
    },
    "omerta-privacy/package.json": {
      "mode": "100644",
      "blob": "b155ccb4f805e333810b512ad7c3026763590625"
    },
    "omerta-privacy/src/canonical-record-current-status.mjs": {
      "mode": "100644",
      "blob": "939d49f752d7e22824b92d94914afcaf7b7651cd"
    },
    "omerta-privacy/src/canonical-record-format.mjs": {
      "mode": "100644",
      "blob": "266166074408703eb7d8b075c8b42b1dbad891de"
    },
    "omerta-privacy/src/canonical-record-indexer.mjs": {
      "mode": "100644",
      "blob": "efef6f06d410cc280ba708cddfca05ed2c74896f"
    },
    "omerta-privacy/src/canonical-record-recovery.mjs": {
      "mode": "100644",
      "blob": "0526721e3761702b10678268c5b6185267f092fd"
    },
    "omerta-privacy/src/canonical-record-rollover.mjs": {
      "mode": "100644",
      "blob": "2c6e0ddce6d5edf1c94654dc793d7f498563a535"
    },
    "omerta-privacy/src/canonical-record-rpc.mjs": {
      "mode": "100644",
      "blob": "489bb95fd0cf6f76cbe9cf2bd844195e5fa6430d"
    },
    "omerta-privacy/src/note-vault.mjs": {
      "mode": "100644",
      "blob": "d455ee637b4b8abac9ed99cbdb698cda03f25399"
    },
    "omerta-privacy/test/canonical-record-fixtures.mjs": {
      "mode": "100644",
      "blob": "013c9e2d1bd095992cf821d749d69af188e8679b"
    },
    "omerta-privacy/test/canonical-record-rollover.mjs": {
      "mode": "100644",
      "blob": "8c89a1cdd16bb33a762c3612f19eb1a866045b37"
    },
    "omerta-privacy/test/note-vault-fixtures.mjs": {
      "mode": "100644",
      "blob": "ce662734035bbb1193e1e73aa9ab620667f610c9"
    },
    "package.json": {
      "mode": "100644",
      "blob": "af98c243e4e48670ceb8abe75ccf232410d58884"
    },
    "public/index.html": {
      "mode": "100644",
      "blob": "2873b448da307af3dfaf5c360bf50f694d1a3218"
    },
    "public/ux-navigation.css": {
      "mode": "100644",
      "blob": "8e39884b44195d3ee1aed5c382d1c8a2e70d6f51"
    },
    "schema.sql": {
      "mode": "100755",
      "blob": "538b702ca8c5cd39534c69835d62ecd07bc10d2e"
    },
    "src/chain.js": {
      "mode": "100644",
      "blob": "889c851cc0de239c16768f895e76bfab7c22dbfc"
    },
    "src/data/market-v2-eth-abis.json": {
      "mode": "100644",
      "blob": "672b66c8bb7bae2d0687c19494af40963fb289e1"
    },
    "src/db.js": {
      "mode": "100644",
      "blob": "ad11751c52062c0eedc317c2d909ef32b295e9c6"
    },
    "src/deedbuildings.js": {
      "mode": "100644",
      "blob": "44d9a18d960974c32fcd8cbbc0d0f67f49a3d7c7"
    },
    "src/deeds.js": {
      "mode": "100644",
      "blob": "e248cedd5d16370ef14b25613a6b5603be381148"
    },
    "src/marketv2abi.js": {
      "mode": "100644",
      "blob": "6b3250ed07fdeb95ab1821fa66be5e2c4cac9213"
    },
    "src/preflight.js": {
      "mode": "100644",
      "blob": "4dec2082e0b3747fe8a6af7b5bdba22ef733f42b"
    },
    "src/routes/deeds.js": {
      "mode": "100644",
      "blob": "2dbf305c44c0a6eea181cf014d251214c6fe86ab"
    },
    "src/watcher.js": {
      "mode": "100644",
      "blob": "6f3940d87f4a54d91c51946b24c0e40c9ad0e8f5"
    },
    "test/chain-reserve-precision-postgres.js": {
      "mode": "100644",
      "blob": "6687fb4abe607b6e5c6f9cf56f42db325cd5feb1"
    },
    "test/chain-reserve-precision.js": {
      "mode": "100644",
      "blob": "c211549aaace1bb5ed67f6d71060d46db2780bda"
    },
    "test/custody-cutover-readiness.mjs": {
      "mode": "100644",
      "blob": "a58be05de312fe2a8ae6d17f39aa3dbc7be97f64"
    },
    "test/deed-paid-checkout-ui.js": {
      "mode": "100644",
      "blob": "d09ecd4908ff738c4c9d71d1730d2611be0e4847"
    },
    "test/deed-pgmem-schema.js": {
      "mode": "100644",
      "blob": "fac30e579afc0898a96e5f92ec3676bfcc00f0fe"
    },
    "test/deed-primary-issuance-postgres.js": {
      "mode": "100644",
      "blob": "744580edff7cc880650dd3ff3ae3e9d4f0208a18"
    },
    "test/deed-primary-issuance.js": {
      "mode": "100644",
      "blob": "9f849a51464c9290d7d68fe01cfd3e7905a1550e"
    },
    "test/deedbuildings.js": {
      "mode": "100644",
      "blob": "fb3c2d01a60c313bc27a8af3cdc8455dedbd928c"
    },
    "test/deeds.js": {
      "mode": "100644",
      "blob": "648cbb1ddf9b22ba7bcfa09fb33da0f7f0575bca"
    },
    "test/implemented-release-packet.mjs": {
      "mode": "100644",
      "blob": "cbd69eb35c5c5182a8cf843e4629f3462d00f49b"
    },
    "test/lib/deed-issuance-entry-fixture.js": {
      "mode": "100644",
      "blob": "40d454f951af3b23139fad67ea7b2cb5a79b1fd7"
    },
    "test/lib/phase2-error.js": {
      "mode": "100644",
      "blob": "b60c4e9881d742ffacaf29d6a42e2a909008d966"
    },
    "test/market-v2-deployment-plan.js": {
      "mode": "100644",
      "blob": "5a27660c9b04a80f5d7252330f4a7f0a811a1616"
    },
    "test/phase2-error.js": {
      "mode": "100644",
      "blob": "e38787b112568acf0dc183f979d2137d8a3d6f27"
    },
    "test/phase2-postgres.js": {
      "mode": "100644",
      "blob": "2adb306714d43667ea18a2dddfe790f5d3c36652"
    },
    "test/player-genesis-artifact-metadata.js": {
      "mode": "100644",
      "blob": "e08f65829ba9d32a31c3014d3d460e1e0f644196"
    },
    "test/player-genesis-deployment.js": {
      "mode": "100644",
      "blob": "c418c9047293626886b034819fcbb56eacf173f8"
    },
    "test/preflight.js": {
      "mode": "100644",
      "blob": "77aafc114ea7fec700a4b3ce6dcf0088371199c2"
    },
    "test/rc1-qualification.js": {
      "mode": "100644",
      "blob": "b2d96d479605dcd151d3bc3edaa1e621e8a8cda3"
    },
    "tools/custody-cutover-readiness.mjs": {
      "mode": "100644",
      "blob": "ecef3277a0d8ce6cb0cf6b70506b639efdcbd24f"
    },
    "tools/implemented-release-packet.mjs": {
      "mode": "100644",
      "blob": "df1daec490ada6c55e753ca762db4dfc0078d5ad"
    },
    "tools/market-v2-deployment-plan.js": {
      "mode": "100644",
      "blob": "7d6f16cfb932f5a25cc6a904f4f8601fbda585dc"
    },
    "tools/player-genesis-deployment-plan.js": {
      "mode": "100644",
      "blob": "6a4b475ee3c33f1510004721820b99515c4de4b0"
    },
    "tools/player-genesis-preflight.js": {
      "mode": "100644",
      "blob": "c59ef01141b1cf6f269a10506e10372eeb05b691"
    },
    "tools/rc1-qualification.mjs": {
      "mode": "100644",
      "blob": "182475f0df889026a568f75f959074c08c046741"
    }
  },
  "protectedFiles": [
    ".github/workflows/ci.yml",
    ".github/workflows/ui-trim-source.yml",
    "AGENTS.md",
    "MARKETING-POSTS.md",
    "SPEC.md",
    "docs/TASK-PUZZLES.md",
    "docs/quest-quality-workgraph.json",
    "docs/questing-workgraph.json",
    "docs/reviews/2026-11-15-native-garage-ui/LOCAL-REVIEW.md",
    "docs/reviews/2026-11-15-native-garage-ui/MANIFEST.json",
    "docs/reviews/2026-11-15-native-garage-ui/MANIFEST.sha256",
    "docs/reviews/2026-11-15-native-garage-ui/REVIEW.md",
    "docs/reviews/2026-11-15-native-garage-ui/evidence/checks-summary.json",
    "docs/reviews/2026-11-15-native-garage-ui/evidence/client.log",
    "docs/reviews/2026-11-15-native-garage-ui/evidence/current-copy.log",
    "docs/reviews/2026-11-15-native-garage-ui/evidence/desktop.png",
    "docs/reviews/2026-11-15-native-garage-ui/evidence/gates.log",
    "docs/reviews/2026-11-15-native-garage-ui/evidence/mobile.png",
    "docs/reviews/2026-11-15-native-garage-ui/evidence/nativegarage-browser.log",
    "docs/reviews/2026-11-15-native-garage-ui/evidence/nativegarage-client.log",
    "docs/reviews/2026-11-15-native-garage-ui/evidence/nativegarage.log",
    "docs/reviews/2026-11-15-native-garage-ui/evidence/original-source-pins.json",
    "docs/reviews/2026-11-15-native-garage-ui/evidence/preflight.log",
    "docs/reviews/2026-11-15-native-garage-ui/evidence/real-chain-browser.exit",
    "docs/reviews/2026-11-15-native-garage-ui/evidence/real-chain-browser.json",
    "docs/reviews/2026-11-15-native-garage-ui/evidence/real-chain-browser.log",
    "docs/reviews/2026-11-15-native-garage-ui/evidence/routes.log",
    "docs/reviews/2026-11-15-native-garage-ui/evidence/security-xss.png",
    "docs/reviews/2026-11-15-native-garage-ui/evidence/site-basics.log",
    "docs/reviews/2026-11-15-native-garage-ui/evidence/source-pins.json",
    "docs/reviews/2026-11-15-native-garage-ui/evidence/sql-scope.json",
    "docs/reviews/2026-11-15-native-garage-ui/evidence/worldgraph.log",
    "omerta-mcp/index.js",
    "package.json",
    "public/index.html",
    "public/nativegarage-client.js",
    "public/nativegarage.css",
    "public/nativegarage.js",
    "public/noir-shell.js",
    "public/strategy-command.js",
    "public/ux-crime-minigame.css",
    "public/ux-crime-minigame.js",
    "public/ux-identity.js",
    "public/ux-navigation.js",
    "public/ux-progression.js",
    "public/ux-tactics.js",
    "src/agentgateway.js",
    "src/agentturn.js",
    "src/crime-minigame.js",
    "src/game.js",
    "src/nativegarage.js",
    "src/server.js",
    "src/task-puzzle-jobs.js",
    "src/ux-tactics.js",
    "test/action-cooldowns.js",
    "test/agent-alpha.js",
    "test/agent-cohort.js",
    "test/agentturn-jail-units.js",
    "test/brokers.js",
    "test/client-shell-browser.js",
    "test/client.js",
    "test/clue-puzzles.js",
    "test/clues.js",
    "test/coldstart.js",
    "test/crime-fixture.js",
    "test/crime-minigame-browser.js",
    "test/crime-minigame-source-transfer.js",
    "test/crime-minigame.js",
    "test/decision-guide-client.js",
    "test/dynasty.js",
    "test/economy.js",
    "test/engagement.js",
    "test/explore.js",
    "test/firstblood.js",
    "test/firsts.js",
    "test/gates.js",
    "test/grand-strategy-source-transfer.js",
    "test/growth.js",
    "test/hardening.js",
    "test/intrigue.js",
    "test/lib/ux-opening-live-browser.js",
    "test/mastery.js",
    "test/mcp.js",
    "test/native-garage-enterprise-source.js",
    "test/native-garage-source-transfer.js",
    "test/nativegarage-browser.js",
    "test/nativegarage-client.js",
    "test/nativegarage.js",
    "test/noir-shell-browser.js",
    "test/playthrough-truth.js",
    "test/rc1-aggression-heir.js",
    "test/rc1-alliance-response-barrier.js",
    "test/rc1-mobile-postgres.js",
    "test/security.js",
    "test/skills.js",
    "test/smoke.js",
    "test/task-puzzle-jobs.js",
    "test/task-puzzle-native-integration-guard.js",
    "test/task-puzzles-browser.js",
    "test/ux-experience-browser.js",
    "test/ux-postgres-rls.js",
    "test/ux-shell-browser.js",
    "test/ux-tactics-browser.js",
    "tools/agent-alpha.js",
    "tools/arena.js",
    "tools/chaos.js",
    "tools/crime-minigame-client.js",
    "tools/crime-minigame-source-compatibility.js",
    "tools/enterprise-native-questing.js",
    "tools/grand-strategy-source-transfer.js",
    "tools/loadtest.js",
    "tools/mobile.js",
    "tools/native-garage-enterprise-source.js",
    "tools/native-garage-source-seal.js",
    "tools/native-garage-source-transfer.js",
    "tools/pgcheck.js",
    "tools/playthrough.js",
    "tools/rc1-postgres-client.sh",
    "tools/scale.js",
    "tools/seal-crime-minigame-source.js",
    "tools/sim.js"
  ],
  "reviewedProtectedChanges": [
    "package.json",
    "public/index.html"
  ],
  "reviewedProductChanges": [
    "package.json",
    "public/index.html",
    "public/ux-navigation.css",
    "src/preflight.js",
    ".github/workflows/forge.yml",
    "schema.sql",
    "test/phase2-postgres.js"
  ],
  "files": {
    ".github/workflows/forge.yml": {
      "baseline": {
        "mode": "100644",
        "blob": "da9438636cf3d68c3e5bf7e9fc574859e4682609",
        "sha256": "233f7f266a1deca5df4c0bfd329fae90e78a97f7b0abca027a77f6e91cc7f73f",
        "bytes": 13901
      },
      "current": {
        "mode": "100644",
        "blob": "76ea4665324d92732fe54e0d8a03dda651169bd4",
        "sha256": "54dd886adfe6eea1e233ff836013bedef088c0c3433d6356c8f2f5fd7aafb402",
        "bytes": 14059
      },
      "inverses": [
        {
          "at": 1566,
          "current": "player-genesis-artifact-metadata.js'\n      - 'test/marketv2*.js'\n      - 'test/market-v2-deployment-plan.js'\n      - 'tools/genesis-auction-*.js'\n      - 'test/genesis-auction-deployment-plan.js'\n      - 'tools/genesis-fee-readiness-source-transfer.js'\n      - 'test/genesis-fee-readiness-source-transfer.js'\n      - 'package.json'\n  pull_request:\n    paths:\n      - 'omerta-contracts/**'\n      - '.github/workflows/forge.yml'\n      - 'tools/foundry-release-api.js'\n      - 'test/foundry-release-api.js'\n      - 'src/dexbot.js'\n      - 'tools/dexbot-e2e.js'\n      - 'src/stockdeliver.js'\n      - 'tools/stock-e2e.js'\n      - 'src/liquidity*.js'\n      - 'src/keepertransactions.js'\n      - 'tools/liquidity-*.js'\n      - 'test/liquidity*.js'\n      - 'src/marketv2*.js'\n      - 'tools/market-v2-deployment-plan.js'\n      - 'tools/solidity-dependency-pragmas.js'\n      - 'tools/eth-rewards-*.js'\n      - 'src/eth*.js'\n      - 'test/eth*.js'\n      - 'public/eth-staking.js'\n      - 'tools/*native-eth-source-transfer*'\n      - 'test/native-eth-source-transfer.js'\n      - 'tools/tokenomics-pilot.js'\n      - 'test/tokenomics-pilot.js'\n      - 'tools/player-genesis-*.js'\n      - 'test/player-genesis-deployment.js'\n      - 'test/player-genesis-artifact-metadata.js'\n      - 'test/marketv2*.js'\n      - 'test/market-v2-deployment-plan.js'\n      - 'tools/genesis-auction-*.js'\n      - 'test/genesis-auction-deployment-plan.js'\n      - 'tools/genesis-fee-readiness-source-transfer.js'\n      - 'test/genesis-fee-readiness-source-transfer.js'\n      - 'package.json'\n  workflow_dispatch: {}\n\njobs:\n  forge:\n    runs-on: ubuntu-latest\n    services:\n      postgres:\n        image: docker.io/library/postgres:18@sha256:74935e72241653ca55e0414067e6d8763aceb8a810eb51b452253ec3dcfc4336\n        env:\n          POSTGRES_USER: postgres\n          POSTGRES_PASSWORD: postgres\n        ports:\n          - 5432:5432\n        options: >-\n          --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5\n    defaults:\n      run:\n        working-directory: omerta-contracts\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          # Source-transfer guards read exact historical blobs and their ancestry.\n          fetch-depth: 0\n\n      # PINNED, like every other dependency this workflow fetches. `foundry-toolchain@v1` with no\n      # `version` resolves `stable` AT RUN TIME, so the one thing compiling and running the suite was\n      # the only thing here not held still — while forge-std (v1.9.6), OpenZeppelin (v5.6.1), v4-core\n      # (1.0.2) and solc (0.8.38, foundry.toml) are all pinned by hand a few lines below. The forgotten\n      # sibling. A moving compiler means a red gate cannot be reproduced locally, which is exactly the\n      # position this gate was in. The banner is the instrument: when local and CI disagree again, the\n      # log answers \"which forge ran this\" instead of leaving it to be guessed at.\n      - uses: actions/setup-node@v7\n        with:\n          node-version: '22'\n          cache: npm\n      - name: Foundry release API offline controls\n        run: node ../test/foundry-release-api.js\n      - name: Install Foundry\n        uses: foundry-rs/foundry-toolchain@v1\n        with:\n          version: v1.7.1\n        id: foundry_setup\n        continue-on-error: true\n      - name: Install verified Foundry from the official release API\n        if: steps.foundry_setup.outcome == 'failure'\n        timeout-minutes: 10\n        working-directory: ${{ github.workspace }}\n        env:\n          GH_TOKEN: ${{ github.token }}\n        run: bash tools/install-foundry-verified.sh\n      - name: Require the pinned Foundry release build\n        shell: bash\n        run: |\n          set -euo pipefail\n          foundry_version=\"$(forge --version)\"\n          printf '%s\\n' \"$foundry_version\"\n          grep -Fxq 'forge Version: 1.7.1' <<< \"$foundry_version\"\n          grep -Fxq 'Commit SHA: 4072e48705af9d93e3c0f6e29e93b5e9a40caed8' <<< \"$foundry_version\"\n          grep -Fxq 'Build Profile: dist' <<< \"$foundry_version\"\n\n      - name: forge --version (what actually ran)\n        working-directory: omerta-contracts\n        run: forge --version\n\n      # Deps aren't committed as submodules — fetch them into lib/ at the pinned versions the\n      # contracts target (deterministic, avoids forge-install/submodule friction inside the parent\n      # git repo). KEEP THIS IN LOCKSTEP WITH omerta-contracts/run-forge-test.sh — when v3 step 6\n      # added the v4 hook it added v4-core to that script and not to this one, so `forge build`\n      # failed to PARSE and every step below was skipped: not just the hook's tests but the OMR,\n      # bond, oracle, VoucherClaim and GearVault suites that had been green for months. A red\n      # contracts job is the pre-mainnet gate, so it must fail on a real regression, never on a\n      # dependency this file forgot about.\n      - name: Fetch dependencies\n        run: |\n          git clone --depth 1 --branch v1.9.6 https://github.com/foundry-rs/forge-std lib/forge-std\n          git clone --depth 1 --branch v5.6.1 https://github.com/OpenZeppelin/openzeppelin-contracts lib/openzeppelin-contracts\n          # Uniswap v4 core, for OmertaHook and its suite. From npm rather than git because the npm\n          # package ships its own lib/ (forge-std, solmate, OZ) already populated, which is what\n          # lets the hook tests deploy a REAL PoolManager and route REAL swaps instead of a mock.\n          npm pack @uniswap/v4-core@1.0.2 >/dev/null\n          mkdir -p lib/v4-core\n          tar xzf uniswap-v4-core-1.0.2.tgz -C lib/v4-core --strip-components=1\n          rm -f uniswap-v4-core-1.0.2.tgz\n          # Exact dependencies used by the custody vault and real PositionManager tests.\n          git clone --no-checkout https://github.com/Uniswap/v4-periphery lib/v4-periphery\n          git -C lib/v4-periphery checkout --detach ad04c9f24a170accf5ea1b2836bbafd514537ca6\n          git clone --no-checkout https://github.com/Uniswap/permit2 lib/permit2\n          git -C lib/permit2 checkout --detach cc56ad0f3439c502c246fc5cfcc3db92bb8b7219\n          # Apply only exact version pragma pins for the reviewed compiler migration.\n          node ../tools/solidity-dependency-pragmas.js\n\n      # PARSE gate only — the SIZE gate is its own step at the END of this job, and the split is\n      # load-bearing rather than tidy. `forge build --sizes` is all-or-nothing: on 2026-08-27 a test\n      # harness went 906 bytes over EIP-170 and that one row failed this step, which SKIPPED\n      # `forge test` and both e2e provers with it — 19 hours of a red pre-mainnet gate in which the\n      # suite did not run at all, on a path-filtered workflow nobody was watching. Same shape as the\n      # v4-core dependency gap recorded above, different cause. A size regression must fail on its\n      # own step, after the suite has already proven the contracts work.\n      # Forge 1.7.1's --threads limits its global pools, while the compiler creates a separate\n      # pool from the available CPU affinity. Pin only the two build steps to one allowed CPU\n      # to serialize profile compilation; leave tests normally parallel. The termination\n      # trigger remains unproven. Compiler profiles, inputs and downstream gates stay intact.\n      - name: Runner resources before compilation\n        run: |\n          free -m\n          df -h .\n\n      - name: forge build\n        run: taskset --cpu-list \"$(python3 -c 'import os; print(min(os.sched_getaffinity(0)))')\" forge build --threads 1\n\n      - name: Market V2 artifact contracts and keeper orchestration\n        working-directory: .\n        run: |\n          npm ci\n          npm run test:market-v2\n          node tools/eth-rewards-abi-pack.js --check\n          npm run test:eth-rewards\n          node test/native-eth-source-transfer.js\n          node test/tokenomics-pilot.js\n          node test/player-genesis-artifact-metadata",
          "baseline": "marketv2*.js'\n      - 'test/market-v2-deployment-plan.js'\n      - 'tools/genesis-auction-*.js'\n      - 'test/genesis-auction-deployment-plan.js'\n      - 'tools/genesis-fee-readiness-source-transfer.js'\n      - 'test/genesis-fee-readiness-source-transfer.js'\n      - 'package.json'\n  pull_request:\n    paths:\n      - 'omerta-contracts/**'\n      - '.github/workflows/forge.yml'\n      - 'tools/foundry-release-api.js'\n      - 'test/foundry-release-api.js'\n      - 'src/dexbot.js'\n      - 'tools/dexbot-e2e.js'\n      - 'src/stockdeliver.js'\n      - 'tools/stock-e2e.js'\n      - 'src/liquidity*.js'\n      - 'src/keepertransactions.js'\n      - 'tools/liquidity-*.js'\n      - 'test/liquidity*.js'\n      - 'src/marketv2*.js'\n      - 'tools/market-v2-deployment-plan.js'\n      - 'tools/solidity-dependency-pragmas.js'\n      - 'tools/eth-rewards-*.js'\n      - 'src/eth*.js'\n      - 'test/eth*.js'\n      - 'public/eth-staking.js'\n      - 'tools/*native-eth-source-transfer*'\n      - 'test/native-eth-source-transfer.js'\n      - 'tools/tokenomics-pilot.js'\n      - 'test/tokenomics-pilot.js'\n      - 'tools/player-genesis-*.js'\n      - 'test/player-genesis-deployment.js'\n      - 'test/marketv2*.js'\n      - 'test/market-v2-deployment-plan.js'\n      - 'tools/genesis-auction-*.js'\n      - 'test/genesis-auction-deployment-plan.js'\n      - 'tools/genesis-fee-readiness-source-transfer.js'\n      - 'test/genesis-fee-readiness-source-transfer.js'\n      - 'package.json'\n  workflow_dispatch: {}\n\njobs:\n  forge:\n    runs-on: ubuntu-latest\n    services:\n      postgres:\n        image: docker.io/library/postgres:18@sha256:74935e72241653ca55e0414067e6d8763aceb8a810eb51b452253ec3dcfc4336\n        env:\n          POSTGRES_USER: postgres\n          POSTGRES_PASSWORD: postgres\n        ports:\n          - 5432:5432\n        options: >-\n          --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5\n    defaults:\n      run:\n        working-directory: omerta-contracts\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          # Source-transfer guards read exact historical blobs and their ancestry.\n          fetch-depth: 0\n\n      # PINNED, like every other dependency this workflow fetches. `foundry-toolchain@v1` with no\n      # `version` resolves `stable` AT RUN TIME, so the one thing compiling and running the suite was\n      # the only thing here not held still — while forge-std (v1.9.6), OpenZeppelin (v5.6.1), v4-core\n      # (1.0.2) and solc (0.8.38, foundry.toml) are all pinned by hand a few lines below. The forgotten\n      # sibling. A moving compiler means a red gate cannot be reproduced locally, which is exactly the\n      # position this gate was in. The banner is the instrument: when local and CI disagree again, the\n      # log answers \"which forge ran this\" instead of leaving it to be guessed at.\n      - uses: actions/setup-node@v7\n        with:\n          node-version: '22'\n          cache: npm\n      - name: Foundry release API offline controls\n        run: node ../test/foundry-release-api.js\n      - name: Install Foundry\n        uses: foundry-rs/foundry-toolchain@v1\n        with:\n          version: v1.7.1\n        id: foundry_setup\n        continue-on-error: true\n      - name: Install verified Foundry from the official release API\n        if: steps.foundry_setup.outcome == 'failure'\n        timeout-minutes: 10\n        working-directory: ${{ github.workspace }}\n        env:\n          GH_TOKEN: ${{ github.token }}\n        run: bash tools/install-foundry-verified.sh\n      - name: Require the pinned Foundry release build\n        shell: bash\n        run: |\n          set -euo pipefail\n          foundry_version=\"$(forge --version)\"\n          printf '%s\\n' \"$foundry_version\"\n          grep -Fxq 'forge Version: 1.7.1' <<< \"$foundry_version\"\n          grep -Fxq 'Commit SHA: 4072e48705af9d93e3c0f6e29e93b5e9a40caed8' <<< \"$foundry_version\"\n          grep -Fxq 'Build Profile: dist' <<< \"$foundry_version\"\n\n      - name: forge --version (what actually ran)\n        working-directory: omerta-contracts\n        run: forge --version\n\n      # Deps aren't committed as submodules — fetch them into lib/ at the pinned versions the\n      # contracts target (deterministic, avoids forge-install/submodule friction inside the parent\n      # git repo). KEEP THIS IN LOCKSTEP WITH omerta-contracts/run-forge-test.sh — when v3 step 6\n      # added the v4 hook it added v4-core to that script and not to this one, so `forge build`\n      # failed to PARSE and every step below was skipped: not just the hook's tests but the OMR,\n      # bond, oracle, VoucherClaim and GearVault suites that had been green for months. A red\n      # contracts job is the pre-mainnet gate, so it must fail on a real regression, never on a\n      # dependency this file forgot about.\n      - name: Fetch dependencies\n        run: |\n          git clone --depth 1 --branch v1.9.6 https://github.com/foundry-rs/forge-std lib/forge-std\n          git clone --depth 1 --branch v5.6.1 https://github.com/OpenZeppelin/openzeppelin-contracts lib/openzeppelin-contracts\n          # Uniswap v4 core, for OmertaHook and its suite. From npm rather than git because the npm\n          # package ships its own lib/ (forge-std, solmate, OZ) already populated, which is what\n          # lets the hook tests deploy a REAL PoolManager and route REAL swaps instead of a mock.\n          npm pack @uniswap/v4-core@1.0.2 >/dev/null\n          mkdir -p lib/v4-core\n          tar xzf uniswap-v4-core-1.0.2.tgz -C lib/v4-core --strip-components=1\n          rm -f uniswap-v4-core-1.0.2.tgz\n          # Exact dependencies used by the custody vault and real PositionManager tests.\n          git clone --no-checkout https://github.com/Uniswap/v4-periphery lib/v4-periphery\n          git -C lib/v4-periphery checkout --detach ad04c9f24a170accf5ea1b2836bbafd514537ca6\n          git clone --no-checkout https://github.com/Uniswap/permit2 lib/permit2\n          git -C lib/permit2 checkout --detach cc56ad0f3439c502c246fc5cfcc3db92bb8b7219\n          # Apply only exact version pragma pins for the reviewed compiler migration.\n          node ../tools/solidity-dependency-pragmas.js\n\n      # PARSE gate only — the SIZE gate is its own step at the END of this job, and the split is\n      # load-bearing rather than tidy. `forge build --sizes` is all-or-nothing: on 2026-08-27 a test\n      # harness went 906 bytes over EIP-170 and that one row failed this step, which SKIPPED\n      # `forge test` and both e2e provers with it — 19 hours of a red pre-mainnet gate in which the\n      # suite did not run at all, on a path-filtered workflow nobody was watching. Same shape as the\n      # v4-core dependency gap recorded above, different cause. A size regression must fail on its\n      # own step, after the suite has already proven the contracts work.\n      # Forge 1.7.1's --threads limits its global pools, while the compiler creates a separate\n      # pool from the available CPU affinity. Pin only the two build steps to one allowed CPU\n      # to serialize profile compilation; leave tests normally parallel. The termination\n      # trigger remains unproven. Compiler profiles, inputs and downstream gates stay intact.\n      - name: Runner resources before compilation\n        run: |\n          free -m\n          df -h .\n\n      - name: forge build\n        run: taskset --cpu-list \"$(python3 -c 'import os; print(min(os.sched_getaffinity(0)))')\" forge build --threads 1\n\n      - name: Market V2 artifact contracts and keeper orchestration\n        working-directory: .\n        run: |\n          npm ci\n          npm run test:market-v2\n          node tools/eth-rewards-abi-pack.js --check\n          npm run test:eth-rewards\n          node test/native-eth-source-transfer.js\n          node test/tokenomics-pilot"
        }
      ]
    },
    ".github/workflows/ui-trim-source.yml": {
      "baseline": {
        "mode": "100644",
        "blob": "1a0805b3002d5a9fe75980f57738ff263fe41841",
        "sha256": "63b6e229d514c0a7cc15190006310651ef829f882a4eeeb66f44c393a6433208",
        "bytes": 1946
      },
      "current": {
        "mode": "100644",
        "blob": "07295c34d3c8605f472a3e40317ee2cdfb8229b9",
        "sha256": "a110f69679ba7e94e094299aceace900f6f7f633d4924b7dc90e95a4a1b559bb",
        "bytes": 3834
      },
      "inverses": [
        {
          "at": 330,
          "current": "20\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 0\n      - uses: actions/setup-node@v7\n        with:\n          node-version: '22'\n      # The proof uses Node built-ins only and independently admits actual Git,\n      # index and physical source before any immutable historical comparison.\n      - name: Qualify the exact UI successor and rejection controls\n        run: |\n          node test/ui-trim-source-transfer.js\n\n  ui_browser:\n    name: Desktop and mobile browser checks\n    runs-on: ubuntu-latest\n    timeout-minutes: 20\n    env:\n      DATABASE_URL: ''\n      LEGAL_OPERATOR_NAME: CI Test Operator\n      LEGAL_POSTAL_ADDRESS: 123 Fixture Street, Test City\n      PRIVACY_CONTACT_EMAIL: privacy@example.test\n      DMCA_AGENT_NAME: CI Test Agent\n      DMCA_AGENT_EMAIL: copyright@example.test\n      DMCA_AGENT_ADDRESS: 123 Fixture Street, Test City\n      DMCA_AGENT_PHONE: '+1 202 555 0100'\n      DMCA_AGENT_REGISTERED: 'true'\n      PAYMENT_REFUND_POLICY: Test fixture policy; not a production policy.\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 0\n      - uses: actions/setup-node@v7\n        with:\n          node-version: '22'\n          cache: npm\n      - run: npm ci\n      - run: npx playwright-core install --with-deps chromium\n      - name: Full desktop and mobile UX suite\n        run: |\n          export CHROMIUM_PATH=\"$(node --input-type=module -e 'import { chromium } from \"playwright-core\"; process.stdout.write(chromium.executablePath());')\"\n          node test/ui-trim-browser.js\n          node test/strategy-command-browser.js\n          node test/noir-shell-browser.js\n          node test/ux-shell-browser.js\n          node test/ux-progression-browser.js\n          node test/ux-navigation-browser.js\n          node test/ux-social-browser.js\n          node test/ux-experience-browser.js\n          node test/ux-workspace-browser.js\n          node test/ux-tactics-browser.js\n          node test/ux-investigation-browser.js\n          node test/ux-coordination-browser.js\n          node test/ux-expanded-browser.js\n          node test/ux-feel-browser.js\n          node test/ux-tools-browser.js\n          node test/ux-identity-browser.js\n          node test/ux-story-browser.js\n          node test/ux-community-browser.js\n          node test/ux-personality-browser.js\n\n  site_browser:\n    name: Site source and browser checks\n    needs: ui_browser\n    runs-on: ubuntu-latest\n    timeout-minutes: 20\n    env:\n      DATABASE_URL: ''\n      LEGAL_OPERATOR_NAME: CI Test Operator\n      LEGAL_POSTAL_ADDRESS: 123 Fixture Street, Test City\n      PRIVACY_CONTACT_EMAIL: privacy@example.test\n      DMCA_AGENT_NAME: CI Test Agent\n      DMCA_AGENT_EMAIL: copyright@example.test\n      DMCA_AGENT_ADDRESS: 123 Fixture Street, Test City\n      DMCA_AGENT_PHONE: '+1 202 555 0100'\n      DMCA_AGENT_REGISTERED: 'true'\n      PAYMENT_REFUND_POLICY: Test fixture policy; not a production policy.\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 0\n      - uses: actions/setup-node@v7\n        with:\n          node-version: '22'\n          cache: npm\n      - run: npm ci\n      - run: npx playwright-core install --with-deps chromium\n      - name: Full site source and browser suite\n        run: |\n          export CHROMIUM_PATH=\"$(node --input-type=module -e 'import { chromium } from \"playwright-core\"; process.stdout.write(chromium.executablePath());')\"\n          npm run test:site && npm run test:site",
          "baseline": "10\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 0\n      - uses: actions/setup-node@v7\n        with:\n          node-version: '22'\n      # The proof uses Node built-ins only and independently admits actual Git,\n      # index and physical source before any immutable historical comparison.\n      - name: Qualify the exact UI successor and rejection controls\n        run: |\n          node test/grand-strategy-source-transfer.js\n          node test/ui-trim-source-transfer.js\n\n  ui_browser:\n    name: Desktop and mobile browser checks\n    runs-on: ubuntu-latest\n    timeout-minutes: 20\n    env:\n      DATABASE_URL: ''\n      LEGAL_OPERATOR_NAME: CI Test Operator\n      LEGAL_POSTAL_ADDRESS: 123 Fixture Street, Test City\n      PRIVACY_CONTACT_EMAIL: privacy@example.test\n      DMCA_AGENT_NAME: CI Test Agent\n      DMCA_AGENT_EMAIL: copyright@example.test\n      DMCA_AGENT_ADDRESS: 123 Fixture Street, Test City\n      DMCA_AGENT_PHONE: '+1 202 555 0100'\n      DMCA_AGENT_REGISTERED: 'true'\n      PAYMENT_REFUND_POLICY: Test fixture policy; not a production policy.\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 0\n      - uses: actions/setup-node@v7\n        with:\n          node-version: '22'\n          cache: npm\n      - run: npm ci\n      - run: npx playwright-core install --with-deps chromium\n      - name: Full desktop and mobile UX suite\n        run: |\n          export CHROMIUM_PATH=\"$(node --input-type=module -e 'import { chromium } from \"playwright-core\"; process.stdout.write(chromium.executablePath());')\"\n          npm run test:ux"
        }
      ]
    },
    "package.json": {
      "baseline": {
        "mode": "100644",
        "blob": "8ac7958703164e5f5b7d2c13816cdd50fcf08e01",
        "sha256": "9e9b084efac7c9a0a24a839aceed84b23c1272ece8c93272a58642af93bbc454",
        "bytes": 65055
      },
      "current": {
        "mode": "100644",
        "blob": "af98c243e4e48670ceb8abe75ccf232410d58884",
        "sha256": "944a922f2b3edc7f15d049da04785493cf8085991e371869f351186c71ec0b63",
        "bytes": 65442
      },
      "inverses": [
        {
          "at": 2641,
          "current": "    \"test:deed-primary\": \"node test/deed-primary-issuance.js && node test/deed-paid-checkout-ui.js && node test/deed-primary-issuance-postgres.js --preflight && node test/deed-pgmem-schema.js\",\n    \"test:deed-primary:postgres\": \"node test/deed-primary-issuance-postgres.js --postgres\",\n",
          "baseline": ""
        },
        {
          "at": 3453,
          "current": "    \"test:rc1\": \"node test/phase2-error.js && node test/custody-cutover-readiness.mjs && node test/world-telemetry.js && node test/rc1-simulation.js && node test/rc1-journeys.js && node test/rc1-qualification.js && node test/rc1-native-proof.js && node test/rc1-resource-journal.js && node test/rc1-native-serial-replay.js && node test/rc1-source-pair.js && node test/rc1-source-pair-additive.js\",\n",
          "baseline": "    \"test:rc1\": \"node test/world-telemetry.js && node test/rc1-simulation.js && node test/rc1-journeys.js && node test/rc1-qualification.js && node test/rc1-native-proof.js && node test/rc1-resource-journal.js && node test/rc1-native-serial-replay.js && node test/rc1-source-pair.js && node test/rc1-source-pair-additive.js\",\n"
        },
        {
          "at": 12580,
          "current": "    \"test\": \"node test/task-puzzle-native-catalog-guard.js && node test/task-puzzle-native-integration-guard.js && npm run test:questing && npm run test:ux && node test/classic-interface-source-compatibility.js && npm run test:player-experience && node test/player-intel.js && node test/player-intel-projections.js && node test/player-intel-gates.js && node test/resourceproviders.js && node test/resourceauction.js && node test/resourcepayments.js && node test/resourcecompute.js && node test/resourcework.js && node test/resourcelabor.js && node test/resourcebusiness.js && node test/resourceoutcomes.js && node test/resourcestorefront.js && node test/agentcompany.js && node test/resourceoutcomeobserver.js && node test/businesspolicy.js && node test/business-agent.js && node test/computeexperiment.js && node test/compute-experiment-cli.js && node test/computerouting.js && node test/computeoutcomes.js && node test/compute-router-cli.js && node test/decisionproofs.js && node test/decisionproofs-api.js && node test/resource-agent.js && node test/resource-worker.js && node test/operatingpolicy.js && node test/supplytenders.js && node test/supplytenders-api.js && node test/warehouseleases.js && node test/warehouseleases-api.js && node test/crewlogistics.js && node test/crewlogistics-api.js && node test/franchiselicenses.js && node test/franchiselicenses-api.js && node test/intelforecasts.js && node test/intelforecastjobs.js && node test/intelforecastjobs-api.js && node test/rc1-intel-source-compatibility.js && node test/rc1-loan-source-compatibility.js && node test/rc1-invoice-source-compatibility.js && node test/deliveryfinanceterms.js && node test/deliveryfinance.js && node test/deliveryfinance-guards.js && node test/deliveryfinance-api.js && node test/logisticscoverageterms.js && node test/logisticscoverage-event-clock.js && node test/logisticscoverage.js && node test/logisticscoverage-api.js && node test/rc1-logistics-coverage-source-compatibility.js && node test/strategylicenses.js && node test/strategylicenses-api.js && node test/rc1-strategy-source-compatibility.js && node test/companysuccession.js && node test/companysuccession-api.js && node test/rc1-company-succession-source-compatibility.js && node test/marketfeed.js && node test/marketfeed-api.js && node test/rc1-market-feed-source-compatibility.js && node test/strategyleagues.js && node test/strategyleagues-api.js && node test/rc1-strategy-league-source-compatibility.js && node test/supplier-history.js && node test/delivery.js && node test/depot.js && node test/restock.js && node test/restock-api.js && node test/smoke.js && node test/persist.js && node test/economy.js && node test/business-settlement.js && node test/goods-market.js && node test/social.js && node test/growth.js && node test/hardening.js && node test/agent-alpha.js && node test/agent-cohort.js && node test/agentturn.js && node test/agentturn-jail-units.js && node test/local-agent-human-coordination.js && node test/agent-turn-cadence.js && node test/security.js && node test/chain.js && node test/watcher.js && node test/vig.js && node test/casino.js && node test/heists.js && node test/convoy.js && node test/commission.js && node test/stockcatalog.js && node test/stockcatalogv2.js && node test/market.js && node test/skills.js && node test/underworld.js && node test/law.js && node test/world.js && node test/npcwar.js && node test/pen.js && node test/loans.js && node test/portfolio.js && node test/estate.js && node test/deeds.js && npm run test:deed-primary && node test/auction.js && node test/wire.js && node test/store.js && node test/pass.js && node test/landmarks.js && node test/speakeasy.js && node test/boxing.js && node test/inventory-bond-checkout.js && node test/bonds.js && node test/races.js && node test/port.js && node test/stable.js && node test/migrate.js && node test/emission.js && node test/desk.js && node test/made.js && node test/nft.js && node test/reimport.js && node test/walletforge.js && node test/expansion.js && node test/dynasty.js && node test/intrigue.js && node test/megaproject.js && node test/duels.js && node test/clues.js && node test/seasons.js && node test/ring.js && node test/standing.js && node test/sacking.js && node test/shields.js && node test/population.js && node test/tokenomics.js && node test/treasury.js && node test/stockdeliver.js && node test/dexbot.js && node test/mastery.js && node test/activity.js && node test/brokers.js && node test/deed-upgrades.js && node test/deed-upgrade-ownership.js && node test/bank.js && node test/community.js && node test/tokenhealth.js && node test/regimen.js && node test/career.js && node test/favors.js && node test/crew.js && node test/firstblood.js && node test/firstblood-intel.js && node test/discovery.js && node test/mentor.js && node test/events.js && node test/results.js && node test/vouch.js && node test/streak.js && node test/circle.js && node test/collision.js && node test/firsts.js && node test/runs.js && node test/shipment.js && node test/avatar.js && node test/portrait.js && node test/nft-art.js && node test/portrait-access.js && node test/push.js && node test/dispatch.js && node test/pwa.js && node test/people.js && node test/citywire.js && node test/bulletin.js && node test/explore.js && node test/primetime.js && node test/citymap.js && node test/day.js && node test/payroll.js && node test/home.js && node test/streets.js && node test/citywide.js && node test/drop.js && node test/sweeps.js && node test/tax.js && node test/router.js && node test/auth.js && node test/agent-onboarding.js && node test/rules.js && node test/path-funnel.js && node test/routes.js && node test/diagram-renderer.js && node test/coldstart.js && node test/preflight.js && node test/client-ip.js && node test/client.js && node test/engagement.js && node test/levers.js && node test/graph.js && node test/gates.js && node test/chainparams.js && node test/docs.js && node test/playthrough-firstblood-truth.js && node test/playthrough-truth.js && node tools/knowledge-test.js && node test/genesisauction.js && node test/genesis-auction-http.js && node test/player-genesis-client.js && node test/genesis-auction-operations.js && node test/genesis-deploy-client.js && node test/city-presence.js && node test/city-presence-api.js && node test/city-activity.js && node test/city-social-api.js && node test/city-homes-api.js && npm run test:city:layout && npm run test:city-gameplay && npm run test:company-workforce && npm run test:company-commercial && npm run test:company-autonomy && node test/wiki-economy-media.js\",\n",
          "baseline": "    \"test\": \"node test/task-puzzle-native-catalog-guard.js && node test/task-puzzle-native-integration-guard.js && npm run test:questing && npm run test:ux && node test/classic-interface-source-compatibility.js && npm run test:player-experience && node test/player-intel.js && node test/player-intel-projections.js && node test/player-intel-gates.js && node test/resourceproviders.js && node test/resourceauction.js && node test/resourcepayments.js && node test/resourcecompute.js && node test/resourcework.js && node test/resourcelabor.js && node test/resourcebusiness.js && node test/resourceoutcomes.js && node test/resourcestorefront.js && node test/agentcompany.js && node test/resourceoutcomeobserver.js && node test/businesspolicy.js && node test/business-agent.js && node test/computeexperiment.js && node test/compute-experiment-cli.js && node test/computerouting.js && node test/computeoutcomes.js && node test/compute-router-cli.js && node test/decisionproofs.js && node test/decisionproofs-api.js && node test/resource-agent.js && node test/resource-worker.js && node test/operatingpolicy.js && node test/supplytenders.js && node test/supplytenders-api.js && node test/warehouseleases.js && node test/warehouseleases-api.js && node test/crewlogistics.js && node test/crewlogistics-api.js && node test/franchiselicenses.js && node test/franchiselicenses-api.js && node test/intelforecasts.js && node test/intelforecastjobs.js && node test/intelforecastjobs-api.js && node test/rc1-intel-source-compatibility.js && node test/rc1-loan-source-compatibility.js && node test/rc1-invoice-source-compatibility.js && node test/deliveryfinanceterms.js && node test/deliveryfinance.js && node test/deliveryfinance-guards.js && node test/deliveryfinance-api.js && node test/logisticscoverageterms.js && node test/logisticscoverage-event-clock.js && node test/logisticscoverage.js && node test/logisticscoverage-api.js && node test/rc1-logistics-coverage-source-compatibility.js && node test/strategylicenses.js && node test/strategylicenses-api.js && node test/rc1-strategy-source-compatibility.js && node test/companysuccession.js && node test/companysuccession-api.js && node test/rc1-company-succession-source-compatibility.js && node test/marketfeed.js && node test/marketfeed-api.js && node test/rc1-market-feed-source-compatibility.js && node test/strategyleagues.js && node test/strategyleagues-api.js && node test/rc1-strategy-league-source-compatibility.js && node test/supplier-history.js && node test/delivery.js && node test/depot.js && node test/restock.js && node test/restock-api.js && node test/smoke.js && node test/persist.js && node test/economy.js && node test/business-settlement.js && node test/goods-market.js && node test/social.js && node test/growth.js && node test/hardening.js && node test/agent-alpha.js && node test/agent-cohort.js && node test/agentturn.js && node test/agentturn-jail-units.js && node test/local-agent-human-coordination.js && node test/agent-turn-cadence.js && node test/security.js && node test/chain.js && node test/watcher.js && node test/vig.js && node test/casino.js && node test/heists.js && node test/convoy.js && node test/commission.js && node test/stockcatalog.js && node test/stockcatalogv2.js && node test/market.js && node test/skills.js && node test/underworld.js && node test/law.js && node test/world.js && node test/npcwar.js && node test/pen.js && node test/loans.js && node test/portfolio.js && node test/estate.js && node test/deeds.js && node test/auction.js && node test/wire.js && node test/store.js && node test/pass.js && node test/landmarks.js && node test/speakeasy.js && node test/boxing.js && node test/inventory-bond-checkout.js && node test/bonds.js && node test/races.js && node test/port.js && node test/stable.js && node test/migrate.js && node test/emission.js && node test/desk.js && node test/made.js && node test/nft.js && node test/reimport.js && node test/walletforge.js && node test/expansion.js && node test/dynasty.js && node test/intrigue.js && node test/megaproject.js && node test/duels.js && node test/clues.js && node test/seasons.js && node test/ring.js && node test/standing.js && node test/sacking.js && node test/shields.js && node test/population.js && node test/tokenomics.js && node test/treasury.js && node test/stockdeliver.js && node test/dexbot.js && node test/mastery.js && node test/activity.js && node test/brokers.js && node test/deed-upgrades.js && node test/deed-upgrade-ownership.js && node test/bank.js && node test/community.js && node test/tokenhealth.js && node test/regimen.js && node test/career.js && node test/favors.js && node test/crew.js && node test/firstblood.js && node test/firstblood-intel.js && node test/discovery.js && node test/mentor.js && node test/events.js && node test/results.js && node test/vouch.js && node test/streak.js && node test/circle.js && node test/collision.js && node test/firsts.js && node test/runs.js && node test/shipment.js && node test/avatar.js && node test/portrait.js && node test/nft-art.js && node test/portrait-access.js && node test/push.js && node test/dispatch.js && node test/pwa.js && node test/people.js && node test/citywire.js && node test/bulletin.js && node test/explore.js && node test/primetime.js && node test/citymap.js && node test/day.js && node test/payroll.js && node test/home.js && node test/streets.js && node test/citywide.js && node test/drop.js && node test/sweeps.js && node test/tax.js && node test/router.js && node test/auth.js && node test/agent-onboarding.js && node test/rules.js && node test/path-funnel.js && node test/routes.js && node test/diagram-renderer.js && node test/coldstart.js && node test/preflight.js && node test/client-ip.js && node test/client.js && node test/engagement.js && node test/levers.js && node test/graph.js && node test/gates.js && node test/chainparams.js && node test/docs.js && node test/playthrough-firstblood-truth.js && node test/playthrough-truth.js && node tools/knowledge-test.js && node test/genesisauction.js && node test/genesis-auction-http.js && node test/player-genesis-client.js && node test/genesis-auction-operations.js && node test/genesis-deploy-client.js && node test/city-presence.js && node test/city-presence-api.js && node test/city-activity.js && node test/city-social-api.js && node test/city-homes-api.js && npm run test:city:layout && npm run test:city-gameplay && npm run test:company-workforce && npm run test:company-commercial && npm run test:company-autonomy && node test/wiki-economy-media.js\",\n"
        }
      ]
    },
    "public/index.html": {
      "baseline": {
        "mode": "100644",
        "blob": "840c0d9d97b60d3677f52c3d9da83505499f03f6",
        "sha256": "4660d277bf20f3685b2d3ba1351b63ef076f12e18f12d1a0a58b85efc10ff131",
        "bytes": 1406464
      },
      "current": {
        "mode": "100644",
        "blob": "2873b448da307af3dfaf5c360bf50f694d1a3218",
        "sha256": "49c02703e94a9790f35f5ae3379924c4f364e824a55d29ec1fd3ce4b28485526",
        "bytes": 1419576
      },
      "inverses": [
        {
          "at": 105423,
          "current": "<link rel=\"stylesheet\" href=\"/ux-navigation.css?v=20261126-mobile-header\">\n",
          "baseline": "<link rel=\"stylesheet\" href=\"/ux-navigation.css?v=20261024\">\n"
        },
        {
          "at": 827993,
          "current": "  // Street Deed checkout uses the server-authored transaction; it never rebuilds claim calldata.\n  let deedCheckoutPending = false;\n  function deedCheckoutFailure(message) { return Object.assign(new Error(message), { deedCheckout: true }); }\n  function deedCheckoutScope() {\n    const auth = token, actor = me?.id, generation = me?.generation, navigation = navigationRevision, wallet = me?.wallet?.toLowerCase();\n    return () => !!actor && token === auth && me?.id === actor && me?.generation === generation\n      && me?.wallet?.toLowerCase() === wallet && currentTab === 'deeds' && navigationRevision === navigation;\n  }\n  function deedCheckoutHeld(reply) {\n    return ({ migration_required: 'This deed needs a reviewed migration before checkout can continue.',\n      chain_unconfigured: 'Deed checkout is held until the chain and contract runtime are configured.',\n      claim_pending: 'This claim is already being confirmed. Wait for the deed record to update.' })[reply?.body?.error]\n      || 'Deed checkout is unavailable. Refresh the property record and retry.';\n  }\n  function deedCheckoutUint(value, label, textOnly = false) {\n    if ((!textOnly && typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)) value = String(value);\n    if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value) || value.length > 78)\n      throw deedCheckoutFailure('Invalid ' + label + '. Refresh the deed quote.');\n    const result = BigInt(value);\n    if (result >= 1n << 256n) throw deedCheckoutFailure('Invalid ' + label + '. Refresh the deed quote.');\n    return result;\n  }\n  function deedEthPrice(wei) {\n    const amount = deedCheckoutUint(wei, 'ETH price', true), unit = 10n ** 18n;\n    const fraction = (amount % unit).toString().padStart(18, '0').replace(/0+$/, '');\n    return (amount / unit).toString() + (fraction ? '.' + fraction : '');\n  }\n  function validateDeedCheckout(body, wallet) {\n    const address = value => typeof value === 'string' && /^0x[0-9a-f]{40}$/i.test(value) && !/^0x0{40}$/i.test(value);\n    const hash = value => typeof value === 'string' && /^0x[0-9a-f]{64}$/i.test(value) && !/^0x0{64}$/i.test(value);\n    const voucher = body?.voucher, quote = body?.quote, transaction = body?.transaction;\n    if (body?.status !== 'signed' || !voucher || !quote || !transaction || !address(wallet)\n      || !address(voucher.to) || voucher.to.toLowerCase() !== wallet.toLowerCase()\n      || !address(body.contract) || !address(transaction.to) || !address(quote.contract)\n      || transaction.to.toLowerCase() !== body.contract.toLowerCase() || quote.contract.toLowerCase() !== body.contract.toLowerCase()\n      || typeof transaction.data !== 'string' || !/^0x(?:[0-9a-f]{2}){4,}$/i.test(transaction.data)\n      || typeof body.signature !== 'string' || !/^0x[0-9a-f]{130}$/i.test(body.signature)\n      || !['paid', 'gameplay', 'remint'].includes(body.issuanceRoute)\n      || !((body.primaryType === 'DeedVoucher' && body.claimMethod === 'claim')\n        || (body.primaryType === 'GameplayDeedVoucher' && body.claimMethod === 'claimGameplay'))\n      || (body.issuanceRoute === 'paid' && body.primaryType !== 'DeedVoucher')\n      || (body.issuanceRoute === 'gameplay' && body.primaryType !== 'GameplayDeedVoucher')\n      || typeof voucher.name !== 'string' || !voucher.name || typeof voucher.district !== 'string' || !voucher.district\n      || quote.name !== voucher.name || quote.district !== voucher.district || quote.usedNonce !== false\n      || !hash(quote.runtimeHash) || !hash(quote.blockHash) || typeof quote.identityIssued !== 'boolean'\n      || typeof quote.gameplayIdentity !== 'boolean' || typeof quote.nativeName !== 'string' || typeof quote.nativeDistrict !== 'string'\n      || (quote.identityIssued ? quote.nativeName !== voucher.name || quote.nativeDistrict !== voucher.district\n        : quote.nativeName !== '' || quote.nativeDistrict !== '')\n      || (body.issuanceRoute === 'remint') !== quote.identityIssued\n      || (body.issuanceRoute === 'remint' && quote.liveOwner !== null))\n      throw deedCheckoutFailure('The deed quote or wallet binding is incomplete. Refresh before paying.');\n    const chain = deedCheckoutUint(body.chainId, 'chain'), quotedChain = deedCheckoutUint(quote.chainId, 'quote chain');\n    const value = deedCheckoutUint(transaction.value, 'transaction value', true), quotedValue = deedCheckoutUint(quote.valueWei, 'quoted value', true);\n    const nonce = deedCheckoutUint(voucher.nonce, 'voucher nonce'), deadline = deedCheckoutUint(voucher.deadline, 'voucher deadline');\n    const at = deedCheckoutUint(quote.timestamp, 'quote timestamp'); deedCheckoutUint(quote.blockNumber, 'quote block');\n    if (chain === 0n || chain !== quotedChain || value !== quotedValue || deadline <= at\n      || (body.issuanceRoute !== 'paid' && value !== 0n))\n      throw deedCheckoutFailure('The deed price, network or expiry changed. Refresh before paying.');\n    return Object.freeze({ from: wallet, to: transaction.to, data: transaction.data, value: '0x' + value.toString(16),\n      valueWei: transaction.value, chainIdHex: '0x' + chain.toString(16), signature: body.signature, nonce: nonce.toString(),\n      primaryType: body.primaryType, claimMethod: body.claimMethod, route: body.issuanceRoute,\n      priceEth: deedEthPrice(transaction.value), name: voucher.name,\n      pendingKey: 'omerta-deed-claim:' + chain + ':' + body.contract.toLowerCase() + ':' + wallet.toLowerCase() + ':' + nonce });\n  }\n  async function reservePaidDeed(property, name, district) {\n    if (deedCheckoutPending) return;\n    const current = deedCheckoutScope();\n    if (!current() || property?.issuanceKind !== 'paid' || property.claimed !== false || property.reserved !== false || !name) return;\n    deedCheckoutPending = true;\n    try {\n      const reply = await api('POST', '/v1/deeds/paid/reserve', { name, buildingId: property.id, district }, { isCurrent: current, beforeDispatch: current });\n      if (!current() || reply.ignored) return;\n      if (reply.code >= 400 || reply.body?.status !== 'payment_required' || reply.body?.benefitEligible !== false)\n        throw deedCheckoutFailure(deedCheckoutHeld(reply));\n      toast('Property reserved for payment. No deed or benefits are granted until its mint is confirmed.');\n      return reply;\n    } catch (error) { if (current()) toast(error?.deedCheckout ? error.message : 'The reservation could not be confirmed. Refresh before retrying.', true); }\n    finally { deedCheckoutPending = false; }\n  }\n  async function beginDeedCheckout() {\n    if (deedCheckoutPending) return;\n    const current = deedCheckoutScope(), wallet = me?.wallet;\n    if (!current() || !wallet) { toast('Link your wallet in the Capital Desk before minting a deed.', true); return; }\n    deedCheckoutPending = true;\n    try {\n      const attest = await ask('Take your deed on-chain?', 'The NFT goes inert in-game (no corner or in-game sale) until re-imported. Your vault stays with the street name. By continuing, you attest that you may lawfully hold the instruments this deed’s vault can receive — treasury-bought stock is delivered into it with no further check. You will review the exact ETH price and pay network gas separately.', { yes: 'I attest — review price' });\n      if (!attest || !current()) return;\n      const extract = () => api('POST', '/v1/deeds/extract', { address: wallet, attest: true }, { isCurrent: current, beforeDispatch: current });\n      const reply = await extract();\n      if (!current() || reply.ignored) return;\n      if (reply.code >= 400) throw deedCheckoutFailure(deedCheckoutHeld(reply));\n      const tx = validateDeedCheckout(reply.body, wallet);\n      if (localStorage.getItem(tx.pendingKey)) throw deedCheckoutFailure('A deed transaction already has a pending or unknown outcome. Check your wallet and wait for confirmation before retrying.');\n      const approved = await ask('Review deed mint', tx.name + ': ' + tx.priceEth + ' ETH, plus network gas paid by you. Chain ' + BigInt(tx.chainIdHex) + '. A reservation or wallet submission grants no new paid deed or benefits; confirmation is required.', { yes: 'Continue to wallet' });\n      if (!approved || !current()) return;\n      if (typeof navigator === 'undefined' || typeof navigator.locks?.request !== 'function')\n        throw deedCheckoutFailure('This browser cannot safely submit this deed transaction. Use another secure browser and retry.');\n      const provider = await pickProvider();\n      if (!provider || !current()) return;\n      await provider.request({ method: 'eth_requestAccounts' });\n      if (!current()) return;\n      const fresh = await extract();\n      if (!current() || fresh.ignored) return;\n      if (fresh.code >= 400) throw deedCheckoutFailure(deedCheckoutHeld(fresh));\n      const latest = validateDeedCheckout(fresh.body, wallet);\n      if (latest.to !== tx.to || latest.data !== tx.data || latest.value !== tx.value || latest.chainIdHex !== tx.chainIdHex\n        || latest.signature !== tx.signature || latest.nonce !== tx.nonce || latest.primaryType !== tx.primaryType\n        || latest.claimMethod !== tx.claimMethod || latest.route !== tx.route)\n        throw deedCheckoutFailure('The deed price or transaction changed. Retry to review the refreshed quote; nothing was sent.');\n      const send = async () => {\n        if (!current() || localStorage.getItem(tx.pendingKey)) throw deedCheckoutFailure('This deed checkout changed or is already pending. Refresh its record.');\n        const [account] = await provider.request({ method: 'eth_accounts' });\n        if (!current() || account?.toLowerCase() !== wallet.toLowerCase()\n          || me?.wallet?.toLowerCase() !== wallet.toLowerCase()) throw deedCheckoutFailure('Choose your linked wallet account and retry.');\n        const chain = await provider.request({ method: 'eth_chainId' });\n        if (!current() || me?.wallet?.toLowerCase() !== wallet.toLowerCase() || BigInt(chain) !== BigInt(tx.chainIdHex)) throw deedCheckoutFailure('Switch your wallet to chain ' + BigInt(tx.chainIdHex) + ' and retry. Nothing was sent.');\n        localStorage.setItem(tx.pendingKey, 'pending');\n        let result;\n        try { result = await provider.request({ method: 'eth_sendTransaction', params: [{ from: latest.from, to: latest.to,\n          data: latest.data, value: latest.value, chainId: latest.chainIdHex }] }); }\n        catch (error) { if (error?.code === 4001) localStorage.removeItem(tx.pendingKey); throw error; }\n        if (typeof result !== 'string' || !/^0x[0-9a-f]{64}$/i.test(result))\n          throw deedCheckoutFailure('Submission has an unknown outcome. Check your wallet before retrying.');\n        localStorage.setItem(tx.pendingKey, result);\n        return result;\n      };\n      const hash = await navigator.locks.request(tx.pendingKey, { ifAvailable: true }, lock => {\n        if (!lock) throw deedCheckoutFailure('Another tab is reviewing this deed. Use that tab.');\n        return send();\n      });\n      if (current()) toast('Deed transaction submitted: ' + hash + '. Wait for confirmed registration before benefits become available.');\n    } catch (error) {\n      if (current()) toast(error?.deedCheckout ? error.message : error?.code === 4001\n        ? 'Wallet request cancelled. You can retry the same pending deed quote.'\n        : 'Deed checkout did not complete. Check any wallet request or transaction before retrying.', true);\n    } finally { deedCheckoutPending = false; if (current()) await renderDeeds(); }\n  }\n\n",
          "baseline": ""
        },
        {
          "at": 840459,
          "current": "    const deed = b.deed, paidIntent = b.paidIntent, districts = b.districts || [], history = b.history || [], ranks = b.ranks || [];\n",
          "baseline": "    const deed = b.deed, districts = b.districts || [], history = b.history || [], ranks = b.ranks || [];\n"
        },
        {
          "at": 852136,
          "current": "      if (!deed && !paidIntent) return '';\n      if (paidIntent) return `<div class=\"card\" style=\"border-color:var(--gold);margin-top:10px\"><span class=\"t\">Reserved for payment: ${esc(paidIntent.name)}</span><div class=\"d\">${esc(paidIntent.building?.id || '')} · ${esc(paidIntent.district)}. This is an unpaid reservation; no property or benefits have been granted.</div>${chain.configured && !chain.activationPending ? '<button class=\"act\" id=\"deed-extract\">Review ETH price and mint</button>' : '<div class=\"d\">Checkout is held until chain and contract runtime configuration is ready.</div>'}</div>`;\n      if (chain.activationPending || !chain.configured) return `<div class=\"card\" id=\"deed-mint-pending\" style=\"margin-top:10px\"><span class=\"t\">Deed NFT activation pending</span><div class=\"d\">Your in-game property is recorded. NFT issuance is not available yet. Checkout is held until chain and contract runtime configuration is ready.</div></div>`;\n",
          "baseline": "      if (!deed) return '';\n      if (chain.activationPending || !chain.configured) return `<div class=\"card\" id=\"deed-mint-pending\" style=\"margin-top:10px\"><span class=\"t\">Deed NFT activation pending</span><div class=\"d\">Your in-game property is recorded. NFT issuance is not available yet. Mint availability and any wallet network gas will be shown before it opens.</div></div>`;\n"
        },
        {
          "at": 853236,
          "current": "        <div class=\"d\">Your street is being taken on-chain — review its current price and submit the signed claim from your linked wallet to mint the NFT. It's <b>inert in-game</b> (no corner, no in-game sale) until you re-import it.</div>\n        <button class=\"act\" id=\"deed-extract\">Review pending claim and wallet transaction</button>\n",
          "baseline": "        <div class=\"d\">Your street is being taken on-chain — submit the signed claim to your wallet to mint the NFT. It's <b>inert in-game</b> (no corner, no in-game sale) until you re-import it.</div>\n"
        },
        {
          "at": 857009,
          "current": "        <div class=\"d\">Operating benefits require level 25 on your current character, however you acquired the property. Select an available paid property to reserve it, then review its exact ETH price and player-paid gas before minting. Availability depends on chain readiness.</div>\n        ${b.supply?.gameplay && b.supply?.paid ? `<div class=\"d\" id=\"deed-supply\">Gameplay: ${Number(b.supply.gameplay.remaining).toLocaleString()} of 1,000 remaining${b.supply.gameplay.remaining === 0 ? ' · fully claimed' : ''}. Paid allocation: ${Number(b.supply.paid.remaining).toLocaleString()} of 1,000 unissued. Partnership: 500 reserved.</div>` : ''}\n",
          "baseline": "        <div class=\"d\">Operating benefits require level 25 on your current character, however you acquired the property. Paid NFT minting is not available yet.</div>\n        ${b.supply?.gameplay && b.supply?.paid ? `<div class=\"d\" id=\"deed-supply\">Gameplay: ${Number(b.supply.gameplay.remaining).toLocaleString()} of 1,000 remaining${b.supply.gameplay.remaining === 0 ? ' · fully claimed' : ''}. Paid allocation: ${Number(b.supply.paid.remaining).toLocaleString()} of 1,000 unissued · minting pending. Partnership: 500 reserved.</div>` : ''}\n"
        },
        {
          "at": 865112,
          "current": "          const canReserve = paid && p.claimed === false && p.reserved === false && !deed && !paidIntent;\n",
          "baseline": ""
        },
        {
          "at": 865636,
          "current": "              : paid ? `<div class=\"d\">Reserve this exact paid property, then review its live ETH mint price and pay your own network gas. A reservation grants no property or benefits. Discovery and quests cannot claim this allocation.</div>${p.reserved ? '<div class=\"d\">This property is reserved for a pending payment.</div>' : ''}`\n",
          "baseline": "              : paid ? '<div class=\"d\">This property belongs to the 1,000-Deed paid mint allocation. Paid NFT minting is not available yet. Discovery and quests cannot claim this allocation.</div>'\n"
        },
        {
          "at": 866136,
          "current": "            ${canReserve ? `<label class=\"d\" for=\"deed-paid-name\">Property name</label><input id=\"deed-paid-name\" placeholder=\"name your street\" size=\"20\" maxlength=\"${b.nameMax || 28}\"><button class=\"act\" id=\"deed-paid-reserve\"${acting || deedCheckoutPending ? ' disabled' : ''}>Reserve this paid property</button>` : ''}\n",
          "baseline": ""
        },
        {
          "at": 866546,
          "current": "          const input = $('#deed-paid-name');\n          if (input) { input.value = deedPropertyNames.get(p.id) || ''; input.oninput = () => { if (actor === me?.id) deedPropertyNames.set(p.id, input.value); }; }\n          const reserve = $('#deed-paid-reserve');\n          if (reserve) reserve.onclick = async () => {\n            if (!valid()) return;\n            const name = input.value.trim();\n            if (!name) { toast('Name this property first.'); return; }\n            reserve.disabled = true;\n            await reservePaidDeed(p, name, district);\n            if (actor === me?.id && currentTab === 'deeds' && navigation === navigationRevision) await renderDeeds({ district, buildingId: p.id });\n          };\n",
          "baseline": ""
        },
        {
          "at": 875083,
          "current": "    { const el = $('#deed-extract'); if (el) el.onclick = () => beginDeedCheckout(); }\n",
          "baseline": "    { const el = $('#deed-extract'); if (el) el.onclick = () =>\n      ask('Take your street on-chain as a tradeable NFT? It goes inert in-game (no corner, no in-game sale) until you re-import it — but you keep the deed and its whole legend, and it sells on any marketplace.\\n\\nBy continuing you also ATTEST that you may lawfully hold the instruments this deed’s vault can receive — treasury-bought stock is delivered into it with no further check.', 'I attest — take it on-chain')\n        .then((ok) => { if (ok) act('POST', '/v1/deeds/extract', { attest: true }).then(() => renderDeeds()); }); }\n"
        }
      ]
    },
    "public/ux-navigation.css": {
      "baseline": {
        "mode": "100644",
        "blob": "7c42357e601b6a9d5093d30bef159d8628cc8539",
        "sha256": "712ebf19faf5303e45d82c55cfc9cda4b3d4156fc0ab759a115a849dbe2efbd6",
        "bytes": 7808
      },
      "current": {
        "mode": "100644",
        "blob": "8e39884b44195d3ee1aed5c382d1c8a2e70d6f51",
        "sha256": "860291845156456fbf02382e49f45802b9d6407e6b42b7c9eb828a5fea3beb96",
        "bytes": 7821
      },
      "inverses": [
        {
          "at": 6052,
          "current": "  #screen-main #top{flex-wrap:nowrap;overflow-x:auto;max-width:100%;box-sizing:border-box;scrollbar-width:thin}#top>*{flex-shrink:0}#top #whoami{margin-left:0;white-space:nowrap}\n",
          "baseline": "  #top{flex-wrap:nowrap;overflow-x:auto;max-width:100%;box-sizing:border-box;scrollbar-width:thin}#top>*{flex-shrink:0}#top #whoami{margin-left:0;white-space:nowrap}\n"
        }
      ]
    },
    "schema.sql": {
      "baseline": {
        "mode": "100755",
        "blob": "511950e2a68d50cebebe6139098a5dbb609117c9",
        "sha256": "b5c66d128de9b730bac19b135a8d13791f3bc70ba4a27818abec7de5141564de",
        "bytes": 627053
      },
      "current": {
        "mode": "100755",
        "blob": "538b702ca8c5cd39534c69835d62ecd07bc10d2e",
        "sha256": "fcd12b36f4c322ecbd5d6573f8ae780ce80a793b4911ea07d3268d4ab9861c90",
        "bytes": 628039
      },
      "inverses": [
        {
          "at": 103053,
          "current": "CREATE INDEX IF NOT EXISTS ix_street_deeds_district ON street_deeds (district);\nALTER TABLE street_deeds ADD COLUMN IF NOT EXISTS building_id TEXT;\nCREATE UNIQUE INDEX IF NOT EXISTS ix_street_deeds_building ON street_deeds (building_id);\n-- Prospective provenance only. Legacy allocation/backfill is not evidence of payment or eligibility.\nALTER TABLE street_deeds ADD COLUMN IF NOT EXISTS issuance_kind TEXT CHECK (issuance_kind IN ('gameplay','paid','partnership'));\nALTER TABLE street_deeds ADD COLUMN IF NOT EXISTS primary_issuance_receipt JSONB;\nALTER TABLE street_deeds ADD COLUMN IF NOT EXISTS last_burn_receipt JSONB;\nALTER TABLE street_deeds ADD COLUMN IF NOT EXISTS last_extraction_receipt JSONB;\n-- An unpaid intent grants no street, home, rent, stock target or permanent supply assignment.\n-- Never copy these rows into street_deeds until the confirmed first-payment receipt is verified.\nCREATE TABLE IF NOT EXISTS street_deed_paid_intents (\n  account_id TEXT PRIMARY KEY,\n  name TEXT NOT NULL,\n  name_lc TEXT NOT NULL UNIQUE,\n  district TEXT NOT NULL,\n  building_id TEXT NOT NULL UNIQUE,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\nCREATE TABLE IF NOT EXISTS street_deed_building_assignments (\n  building_id TEXT PRIMARY KEY,\n  street_name TEXT NOT NULL UNIQUE,\n",
          "baseline": "CREATE INDEX IF NOT EXISTS ix_street_deeds_district ON street_deeds (district);\nALTER TABLE street_deeds ADD COLUMN IF NOT EXISTS building_id TEXT;\nCREATE UNIQUE INDEX IF NOT EXISTS ix_street_deeds_building ON street_deeds (building_id);\nCREATE TABLE IF NOT EXISTS street_deed_building_assignments (\n  building_id TEXT PRIMARY KEY,\n  street_name TEXT NOT NULL UNIQUE,\n"
        },
        {
          "at": 114225,
          "current": "  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),\n  applied_at TIMESTAMPTZ\n);\nALTER TABLE deed_reimports ADD COLUMN IF NOT EXISTS burn_receipt JSONB;\n\n-- ── THE AUCTION HOUSE (\"the sit-down\"): the competitive, recurring $OMR sink ──\n-- A live auction row exists once a lot gets its first bid. `current_bid` on status='live' rows IS the\n",
          "baseline": "  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),\n  applied_at TIMESTAMPTZ\n);\n\n-- ── THE AUCTION HOUSE (\"the sit-down\"): the competitive, recurring $OMR sink ──\n-- A live auction row exists once a lot gets its first bid. `current_bid` on status='live' rows IS the\n"
        }
      ]
    },
    "src/preflight.js": {
      "baseline": {
        "mode": "100644",
        "blob": "670f3760da75509864679284cdefc08b5d4d28c9",
        "sha256": "1876a11acc5398f34f08921a3eec716f936f393cf9f97a7b64a989b148181bde",
        "bytes": 40479
      },
      "current": {
        "mode": "100644",
        "blob": "4dec2082e0b3747fe8a6af7b5bdba22ef733f42b",
        "sha256": "2ab53568520efdf68280449288ad241c42a2253b5b318a0ddcc236bc0a5babc1",
        "bytes": 40574
      },
      "inverses": [
        {
          "at": 11743,
          "current": " 'STREET_DEED_RUNTIME_HASH', // Explicit reviewed runtime pin; no default or proxy equivalence.",
          "baseline": ""
        }
      ]
    },
    "test/crime-minigame-source-transfer.js": {
      "baseline": {
        "mode": "100644",
        "blob": "346942434315f4b096a171af5a70b452ee7f5f57",
        "sha256": "f4cb006c8a728332b84716cf7dd37b5a20a982f62577a2a177b090bbde45cbb0",
        "bytes": 10754
      },
      "current": {
        "mode": "100644",
        "blob": "39b73c31af6cb77e7c72164d52aa8a65c0ab0adf",
        "sha256": "3ec6fdb337c246c31837cd7b62c1669d10bcf7adcc5122a923812bd712639609",
        "bytes": 11342
      },
      "inverses": [
        {
          "at": 121,
          "current": "import { launchIntegrationActual } from '../tools/launch-integration-source-transfer.js';\n",
          "baseline": ""
        },
        {
          "at": 9057,
          "current": "const temporaryIndex = fs.mkdtempSync(path.join(os.tmpdir(), 'omerta-crime-source-index-'));\n",
          "baseline": ""
        },
        {
          "at": 9156,
          "current": "  const file = 'public/index.html', actual = launchIntegrationActual(file);\n",
          "baseline": "  const file = 'public/index.html', actual = crimeMinigameActual(file);\n"
        },
        {
          "at": 9328,
          "current": "    GIT_WORK_TREE: temporary, GIT_INDEX_FILE: path.join(temporaryIndex, 'reviewed-index') };\n",
          "baseline": "    GIT_WORK_TREE: temporary, GIT_INDEX_FILE: path.join(temporary, 'reviewed-index') };\n"
        },
        {
          "at": 9548,
          "current": "  execFileSync('git', ['--no-replace-objects', 'checkout-index', '--all', '--force'], { cwd: temporary, env: environment, windowsHide: true });\n  fs.mkdirSync(path.join(temporary, 'public'), { recursive: true }); fs.writeFileSync(path.join(temporary, file), actual.physical);\n",
          "baseline": "  fs.mkdirSync(path.join(temporary, 'public')); fs.writeFileSync(path.join(temporary, file), actual.physical);\n"
        },
        {
          "at": 10487,
          "current": "  const index = child({ ...environment, GIT_INDEX_FILE: path.join(temporaryIndex, 'empty-index') });\n",
          "baseline": "  const index = child({ ...environment, GIT_INDEX_FILE: path.join(temporary, 'empty-index') });\n"
        },
        {
          "at": 10696,
          "current": "  assert(path.resolve(temporaryIndex).startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(temporaryIndex).startsWith('omerta-crime-source-index-'));\n  fs.rmSync(temporaryIndex, { recursive: true, force: true });\n",
          "baseline": ""
        }
      ]
    },
    "test/deeddiscovery-postgres.js": {
      "baseline": {
        "mode": "100644",
        "blob": "42430434ce34056a5a3218820737c8e12f8b46bd",
        "sha256": "db19acc28dac5fe0359dbfaf97cf2f4efd71f77dcaf390b9366d443204cb2d49",
        "bytes": 10260
      },
      "current": {
        "mode": "100644",
        "blob": "a2ad861652e2886e21fbc8e90d48b763db96628c",
        "sha256": "486a432fd57a6fd8e75bc0a9086790653deff7d896a29c247a36d32385ff5da8",
        "bytes": 10702
      },
      "inverses": [
        {
          "at": 1315,
          "current": "paidIntentMigration = definition.match(/CREATE TABLE IF NOT EXISTS street_deed_paid_intents \\([\\s\\S]*?\\);/)?.[0];\nconst issuanceKindMigration = definition.match(/^ALTER TABLE street_deeds ADD COLUMN IF NOT EXISTS issuance_kind [^\\r\\n]+;$/m)?.[0];\nassert(paidIntentMigration && issuanceKindMigration, 'canonical primary issuance schema is retained');\nconst actor = (id, account = id) => ({ id, account_id: account, name: id, alive: true,\n  is_npc: false, loc: 'cathedral', respect: 1e8, energy: 100 });\nconst target = 'cathedral-0001';\nconst street = (name, buildingId = target) => ({ name, buildingId });\nconst transaction = async (fn) => {\n  const client = await pool.connect();\n  try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }\n  catch (error) { await client.query('ROLLBACK'); throw error; }\n  finally { client.release(); }\n};\nasync function addActor(ch) {\n  await pool.query('INSERT INTO characters VALUES ($1,$2,true,false)', [ch.id, ch.account_id]);\n  await pool.query('INSERT INTO account_persistent VALUES ($1) ON CONFLICT DO NOTHING', [ch.account_id]);\n}\nasync function qualify(accountId, buildingId = target) {\n  const evidence=deedInvestigationRoute(deedBuildingById(buildingId)).map(step=>({buildingId,policyVersion:2,objectiveId:step.id,actionId:step.actionId,district:step.requiredDistrict,characterId:accountId,at:new Date().toISOString()}));\n  await pool.query(`INSERT INTO street_deed_discoveries\n    (account_id,building_id,steps,qualified_at,policy_version,objective_evidence) VALUES ($1,$2,4,now(),2,$3)`, [accountId,buildingId,JSON.stringify(evidence)]);\n}\ntry {\n  await first.query(`CREATE TABLE characters(id TEXT PRIMARY KEY,account_id TEXT,alive BOOLEAN,is_npc BOOLEAN);\n    CREATE TABLE account_persistent(account_id TEXT PRIMARY KEY);\n    CREATE TABLE street_deeds(account_id TEXT PRIMARY KEY,name TEXT NOT NULL,name_lc TEXT UNIQUE,\n      district TEXT,building_id TEXT UNIQUE,onchain_token_id TEXT,extracted_by_account TEXT,\n      corner_at TIMESTAMPTZ,home_authority_token TEXT,claimed_at TIMESTAMPTZ DEFAULT now());\n    CREATE TABLE street_deed_history(account_id TEXT,kind TEXT,detail TEXT,at TIMESTAMPTZ DEFAULT now());`);\n  await first.query(paidIntentMigration);\n  await first.query(issuanceKindMigration",
          "baseline": "actor = (id, account = id) => ({ id, account_id: account, name: id, alive: true,\n  is_npc: false, loc: 'cathedral', respect: 1e8, energy: 100 });\nconst target = 'cathedral-0001';\nconst street = (name, buildingId = target) => ({ name, buildingId });\nconst transaction = async (fn) => {\n  const client = await pool.connect();\n  try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }\n  catch (error) { await client.query('ROLLBACK'); throw error; }\n  finally { client.release(); }\n};\nasync function addActor(ch) {\n  await pool.query('INSERT INTO characters VALUES ($1,$2,true,false)', [ch.id, ch.account_id]);\n  await pool.query('INSERT INTO account_persistent VALUES ($1) ON CONFLICT DO NOTHING', [ch.account_id]);\n}\nasync function qualify(accountId, buildingId = target) {\n  const evidence=deedInvestigationRoute(deedBuildingById(buildingId)).map(step=>({buildingId,policyVersion:2,objectiveId:step.id,actionId:step.actionId,district:step.requiredDistrict,characterId:accountId,at:new Date().toISOString()}));\n  await pool.query(`INSERT INTO street_deed_discoveries\n    (account_id,building_id,steps,qualified_at,policy_version,objective_evidence) VALUES ($1,$2,4,now(),2,$3)`, [accountId,buildingId,JSON.stringify(evidence)]);\n}\ntry {\n  await first.query(`CREATE TABLE characters(id TEXT PRIMARY KEY,account_id TEXT,alive BOOLEAN,is_npc BOOLEAN);\n    CREATE TABLE account_persistent(account_id TEXT PRIMARY KEY);\n    CREATE TABLE street_deeds(account_id TEXT PRIMARY KEY,name TEXT NOT NULL,name_lc TEXT UNIQUE,\n      district TEXT,building_id TEXT UNIQUE,onchain_token_id TEXT,extracted_by_account TEXT,\n      corner_at TIMESTAMPTZ,home_authority_token TEXT,claimed_at TIMESTAMPTZ DEFAULT now());\n    CREATE TABLE street_deed_history(account_id TEXT,kind TEXT,detail TEXT,at TIMESTAMPTZ DEFAULT now());`"
        }
      ]
    },
    "test/deeds-supply-postgres.js": {
      "baseline": {
        "mode": "100644",
        "blob": "786318e455e5079b671a2c36acb3260cb27edd3e",
        "sha256": "03f51ca8ffa2e61e05b634a8785b1992b6614ecf01ac66815293cff649cb502a",
        "bytes": 6864
      },
      "current": {
        "mode": "100644",
        "blob": "d19c617edcc16c467353687041e9a7d9e2987d50",
        "sha256": "7cb94804931e52b8ecdfc671215703b51c3c7e0dbfc8dedbf22da1cedd12f319",
        "bytes": 7328
      },
      "inverses": [
        {
          "at": 1437,
          "current": "paidIntentMigration = definition.match(/CREATE TABLE IF NOT EXISTS street_deed_paid_intents \\([\\s\\S]*?\\);/)?.[0];\nconst issuanceKindMigration = definition.match(/^ALTER TABLE street_deeds ADD COLUMN IF NOT EXISTS issuance_kind [^\\r\\n]+;$/m)?.[0];\nassert(paidIntentMigration && issuanceKindMigration, 'test exercises the current canonical intent and issuance migrations');\nconst finalBuilding = DEED_BUILDINGS.filter(lot => lot.issuanceKind === 'gameplay').at(-1);\nconst issuedBuildings = DEED_BUILDINGS.filter(lot => lot.id !== finalBuilding.id);\nconst player = account_id => ({ id: account_id, account_id, name: account_id, alive: true,\n  is_npc: false, loc: finalBuilding.district, respect: 1e8, energy: 100 });\nconst street = name => ({ name, district: finalBuilding.district, buildingId: finalBuilding.id });\ntry {\n  await first.query(`CREATE TABLE street_deeds (\n    account_id TEXT PRIMARY KEY, name TEXT NOT NULL, name_lc TEXT UNIQUE NOT NULL,\n    district TEXT NOT NULL, corner_at TIMESTAMPTZ, onchain_token_id TEXT,\n    building_id TEXT UNIQUE, extracted_by_account TEXT, home_authority_token TEXT, claimed_at TIMESTAMPTZ DEFAULT now()\n  ); CREATE TABLE street_deed_history (\n    account_id TEXT NOT NULL, kind TEXT NOT NULL, detail TEXT NOT NULL, at TIMESTAMPTZ DEFAULT now()\n  )`);\n  await first.query(issuanceKindMigration);\n  await first.query(paidIntentMigration",
          "baseline": "finalBuilding = DEED_BUILDINGS.filter(lot => lot.issuanceKind === 'gameplay').at(-1);\nconst issuedBuildings = DEED_BUILDINGS.filter(lot => lot.id !== finalBuilding.id);\nconst player = account_id => ({ id: account_id, account_id, name: account_id, alive: true,\n  is_npc: false, loc: finalBuilding.district, respect: 1e8, energy: 100 });\nconst street = name => ({ name, district: finalBuilding.district, buildingId: finalBuilding.id });\ntry {\n  await first.query(`CREATE TABLE street_deeds (\n    account_id TEXT PRIMARY KEY, name TEXT NOT NULL, name_lc TEXT UNIQUE NOT NULL,\n    district TEXT NOT NULL, corner_at TIMESTAMPTZ, onchain_token_id TEXT,\n    building_id TEXT UNIQUE, extracted_by_account TEXT, home_authority_token TEXT, claimed_at TIMESTAMPTZ DEFAULT now()\n  ); CREATE TABLE street_deed_history (\n    account_id TEXT NOT NULL, kind TEXT NOT NULL, detail TEXT NOT NULL, at TIMESTAMPTZ DEFAULT now()\n  )`"
        }
      ]
    },
    "test/grand-strategy-source-transfer.js": {
      "baseline": {
        "mode": "100644",
        "blob": "2dc535d071ef91d76102fa3621d939168967f872",
        "sha256": "ffb2c1407de2e7d6579f5f893b1ca6e3fa4eb22fe2f447be31825f65d4d0c3f6",
        "bytes": 16020
      },
      "current": {
        "mode": "100644",
        "blob": "d5dc549e5f01821c7fa501772b50bd85ee9bc6d0",
        "sha256": "3e83c880684cabac855aec8f39be59ed94b20729c42b115fefe8096b58997891",
        "bytes": 16668
      },
      "inverses": [
        {
          "at": 99,
          "current": "'./launch-integration-source-transfer.js';\nimport { launchIntegrationActual } from '../tools/launch-integration-source-transfer.js';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport os from 'node:os';\nimport path from 'node:path';\nimport { createHash } from 'node:crypto';\nimport { execFileSync, spawnSync } from 'node:child_process';\nimport { crimeMinigameActual } from '../tools/crime-minigame-source-compatibility.js';\nimport { AGE_REMOVAL_SOURCE, ageRemovalHistoricalRecord } from '../tools/age-removal-source-transfer.js';\nimport { NATIVE_GARAGE_PREDECESSOR, assertNativeGarageCurrentSource, nativeGarageActual,\n  nativeGarageHistoricalInput, nativeGarageHistoricalEntry } from '../tools/native-garage-source-transfer.js';\nimport { GRAND_STRATEGY_SOURCE as source, GRAND_STRATEGY_PREDECESSOR, GRAND_STRATEGY_SCOPE,\n  GRAND_STRATEGY_GENERATED_FILES, GRAND_STRATEGY_RELEASE_FILES, grandStrategySourceDataBytes,\n  grandStrategyActual, qualifyGrandStrategySource, grandStrategyHistoricalInput,\n  grandStrategyHistoricalEntry, grandStrategyHistoricalRecord } from '../tools/grand-strategy-source-transfer.js';\nconst git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], {\n  encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024,\n});\nconst sha = value => createHash('sha256').update(value).digest('hex');\nconst blob = value => createHash('sha1').update('blob ' + Buffer.byteLength(value) + '\\0').update(value).digest('hex');\nconst entry = (file, pin, kind) => kind === 'tree' ? pin.mode + ' blob ' + pin.blob + '\\t' + file\n  : pin.mode + ' ' + pin.blob + ' 0\\t' + file;\nassert.equal(source.status, 'SEALED', 'An unsealed successor never inherits a historical comparison');\nassert.equal(source.phase, 'EXACT_GRAND_STRATEGY_SOURCE_COMPARISON_ONLY');\nassert.equal(source.predecessor, GRAND_STRATEGY_PREDECESSOR);\nassert.equal(GRAND_STRATEGY_RELEASE_FILES.length, 99, 'The original release input set is finite');\nfor (const [revision, tree] of [[source.revision, source.tree], [source.predecessor, source.predecessorTree]])\n  assert.equal(git('rev-parse', revision + '^{tree}').trim(), tree);\ngit('merge-base', '--is-ancestor', source.predecessor, source.revision);\ngit('merge-base', '--is-ancestor', source.revision, 'HEAD');\nconst excluded = new Set(GRAND_STRATEGY_GENERATED_FILES);\nconst changes = kind => git('diff', '--name-only', '--no-renames', '--diff-filter=' + kind,\n  '-z', source.predecessor, source.revision).split('\\0').filter(file => file && !excluded.has(file));\nassert.deepEqual(Object.keys(source.files), changes('M'));\nassert.deepEqual(Object.keys(source.additions), changes('A'));\nassert.deepEqual(changes('DRTCUXB'), []);\nassert.deepEqual([...Object.keys(source.files), ...Object.keys(source.additions)].sort(),\n  GRAND_STRATEGY_SCOPE.filter(file => !excluded.has(file)), 'Every authored runtime, test, helper and binary asset has one exact pin');\nfor (const file of excluded) assert(!Object.hasOwn(source.files, file) && !Object.hasOwn(source.additions, file));\nassertNativeGarageCurrentSource();\nconst postCandidate = git('diff', '--name-only', '--no-renames', '-z', source.revision, NATIVE_GARAGE_PREDECESSOR).split('\\0').filter(Boolean);\nassert(postCandidate.every(file => excluded.has(file)), 'Only the fixed independently generated domains may follow the reviewed candidate');\nassert.equal(fs.readFileSync('tools/grand-strategy-source-data.js', 'utf8').replaceAll('\\r\\n', '\\n'), grandStrategySourceDataBytes(source),\n  'The sole generated self-reference contains exact data and no executable additions');\nassert.equal(git('diff', '--name-only', source.predecessor, 'HEAD', '--',\n  'tools/ui-trim-source-data.js', 'tools/age-removal-source-data.js'), '', 'Every earlier sealed historical pin remains immutable');\n\n// Batch genuine identity reads, then fingerprint whole physical text/binary inputs.\nconst pins = Object.fromEntries([...Object.entries(source.files).map(([file, row]) => [file, { ...row.current, text: true }]),\n  ...Object.entries(source.additions)]);\nconst names = Object.keys(pins);\nconst rows = output => new Map(output.split('\\0').filter(Boolean).map(row => [row.slice(row.indexOf('\\t') + 1), row]));\nconst heads = rows(git('ls-tree', '-z', 'HEAD', '--', ...names));\nconst indexes = rows(git('ls-files', '--stage', '-z', '--', ...names));\nfor (const [file, pin] of Object.entries(pins)) {\n  assert.equal(nativeGarageHistoricalEntry(file, heads.get(file), 'tree'), entry(file, pin, 'tree'), 'Whole genuine HEAD identity: ' + file);\n  assert.equal(nativeGarageHistoricalEntry(file, indexes.get(file), 'index'), entry(file, pin, 'index'), 'Whole genuine stage-zero identity: ' + file);\n  const stat = fs.lstatSync(file); assert(stat.isFile() && !stat.isSymbolicLink());\n  const physical = nativeGarageHistoricalInput(file, fs.readFileSync(file));\n  let canonical = physical;\n  if (pin.text) {\n    const raw = physical.toString('utf8'); assert(Buffer.from(raw).equals(physical));\n    const lf = raw.replaceAll('\\r\\n', '\\n');\n    assert(!/[\\r\\0\\ufeff]/.test(lf) && (raw === lf || raw === lf.replaceAll('\\n', '\\r\\n')));\n    canonical = Buffer.from(lf);\n  }\n  assert.equal(canonical.length, pin.bytes); assert.equal(sha(canonical), pin.sha256); assert.equal(blob(canonical), pin.blob);\n}\nlet positives = 0, refusals = 0;\nfor (const [file, row] of Object.entries(source.files)) {\n  const actual = grandStrategyActual(file), current = actual.committed.toString('utf8');\n  const before = git('show', source.predecessor + ':' + file);\n  for (const input of [current, current.replaceAll('\\n', '\\r\\n'), Buffer.from(current), actual.physical]) {\n    const proof = qualifyGrandStrategySource(file, input);\n    assert.equal(proof.baselineText, before);\n    assert.deepEqual([proof.sourceOnly, proof.runtime, proof.native, proof.migration, proof.financial,\n      proof.activation, proof.deployment, proof.priorResultsTransferred], [true, false, false, false, false, false, false, false]);\n    const projected = grandStrategyHistoricalInput(file, input);\n    assert.equal(String(projected), before);\n    assert.equal(Buffer.isBuffer(projected), Buffer.isBuffer(input)); positives++;\n  }\n  const historical = grandStrategyHistoricalRecord(file, actual);\n  assert.equal(historical.committed.toString('utf8'), before);\n  assert.deepEqual(historical.head, { mode: row.baseline.mode, blob: row.baseline.blob });\n  assert.strictEqual(grandStrategyHistoricalRecord(file, historical), historical, 'Prior tuples acquire no new qualification');\n  for (const physical of [actual.committed, Buffer.from(current.replaceAll('\\n', '\\r\\n'))]) {\n    assert.deepEqual(grandStrategyHistoricalRecord(file, { ...actual, physical }), historical,\n      'Complete LF and CRLF supplied records retain the same historical identity'); positives++;\n  }\n  assert.throws(() => qualifyGrandStrategySource(file, before)); refusals++; positives++;\n  for (const kind of ['tree', 'index']) {\n    for (const suffix of ['', '\\n'])\n      assert.equal(grandStrategyHistoricalEntry(file, entry(file, row.current, kind) + suffix, kind), entry(file, row.baseline, kind) + suffix);\n    for (const value of [' ' + entry(file, row.current, kind), entry(file, row.current, kind) + '\\n\\n',\n      entry(file, row.current, kind).replace(row.current.blob, '0'.repeat(40))]) {\n      assert.equal(grandStrategyHistoricalEntry(file, value, kind), value); refusals++;\n    }\n  }\n  for (const value of [current + '\\n// unreviewed successor\\n', current.slice(1), '\\ufeff' + current, current + '\\0',\n    current.replace('\\n', '\\r\\n'), current.replace('\\n', '\\r'), null]) {\n    assert.throws(() => qualifyGrandStrategySource(file, value));\n    assert.strictEqual(grandStrategyHistoricalInput(file, value), value); refusals++;\n  }\n  const invalid = Buffer.from([0xff]);\n  assert.throws(() => qualifyGrandStrategySource(file, invalid), /Lossless UTF-8/);\n  assert.throws(() => grandStrategyHistoricalInput(file, invalid), /Lossless UTF-8/); refusals += 2;\n}\nconst observedFile = 'public/index.html', observed = grandStrategyActual(observedFile);\nconst currentObserved = launchIntegrationActual(observedFile);\nconst priorObserved = grandStrategyHistoricalRecord(observedFile, observed);\nfor (const file of ['public/index.html', 'public/sw.js', 'src/server.js']) {\n  const actual = grandStrategyActual(file), pin = AGE_REMOVAL_SOURCE.files[file].baseline;\n  for (const physical of [actual.committed, Buffer.from(actual.committed.toString('utf8').replaceAll('\\n', '\\r\\n'))]) {\n    const historical = ageRemovalHistoricalRecord(file, { ...actual, physical });\n    assert.deepEqual(historical.head, { mode: pin.mode, blob: pin.blob });\n    assert.equal(historical.index, entry(file, pin, 'index'));\n    assert.equal(historical.committed.length, pin.bytes); assert.equal(sha(historical.committed), pin.sha256);\n    assert.equal(blob(historical.committed), pin.blob); assert(historical.physical.equals(historical.committed));\n    assert.equal(historical.regular, true); assert.equal(historical.symbolic, false); positives++;\n  }\n}\nassert.throws(() => grandStrategyHistoricalRecord(observedFile, { ...priorObserved, head: { ...priorObserved.head, extra: true } })); refusals++;\nfor (const patch of [{ head: { ...observed.head, mode: '120000' } },\n  { index: observed.index.replace(observed.head.blob, '0'.repeat(40)) }, { regular: false }, { symbolic: true },\n  { physical: Buffer.concat([observed.physical, Buffer.from('x')]) },\n  { physical: observed.committed.subarray(1) }, { physical: priorObserved.committed },\n  { physical: Buffer.from(observed.committed.toString('utf8').replace('\\n', '\\r\\n')) },\n  { physical: Buffer.from(observed.committed.toString('utf8').replace('\\n', '\\r')) },\n  { physical: Buffer.concat([Buffer.from('\\ufeff'), observed.committed]) },\n  { physical: Buffer.concat([observed.committed, Buffer.from('\\0')]) }, { physical: Buffer.from([0xff]) },\n  { committed: Buffer.concat([observed.committed, Buffer.from('x')]) }, { extra: true }]) {\n  for (const qualify of [grandStrategyHistoricalRecord, ageRemovalHistoricalRecord]) {\n    assert.throws(() => qualify(observedFile, { ...observed, ...patch })); refusals++;\n  }\n}\nassert.equal(git('ls-tree', '-z', source.predecessor, '--', ...Object.keys(source.additions)), '',\n  'An added source or binary asset has no predecessor record');\nfor (const file of Object.keys(source.additions)) {\n  const input = Buffer.from('new files have no predecessor');\n  assert.throws(() => qualifyGrandStrategySource(file, input));\n  assert.strictEqual(grandStrategyHistoricalInput(file, input), input); refusals++;\n}\nfor (const file of ['__proto__', 'constructor', 'src/unreviewed-successor.js']) {\n  const input = Buffer.from([0xff]); assert.throws(() => qualifyGrandStrategySource(file, input));\n  assert.strictEqual(grandStrategyHistoricalInput(file, input), input); refusals++;\n}\n// Genuine index/physical refusal controls use an isolated alternate index/work tree, never the caller's checkout.\nconst temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'omerta-grand-source-'));\nconst temporaryIndex = fs.mkdtempSync(path.join(os.tmpdir(), 'omerta-grand-source-index-'));\ntry {\n  const environment = { ...process.env, GIT_DIR: git('rev-parse', '--absolute-git-dir').trim(),\n    GIT_WORK_TREE: temporary, GIT_INDEX_FILE: path.join(temporaryIndex, 'reviewed-index') };\n  execFileSync('git', ['--no-replace-objects', 'read-tree', 'HEAD'], { cwd: temporary, env: environment, windowsHide: true });\n  execFileSync('git', ['--no-replace-objects', 'checkout-index', '--all', '--force'], { cwd: temporary, env: environment, windowsHide: true });\n  fs.mkdirSync(path.join(temporary, 'public'), { recursive: true }); fs.writeFileSync(path.join(temporary, observedFile), currentObserved.physical);\n  const script = 'import { grandStrategyActual } from ' + JSON.stringify(new URL('../tools/grand-strategy-source-transfer.js', import.meta.url).href)\n    + '; grandStrategyActual(' + JSON.stringify(observedFile) + ');';\n  const child = (env, code = script) => spawnSync(process.execPath, ['--input-type=module', '-e', code], {\n    cwd: temporary, env, windowsHide: true, encoding: 'utf8',\n  });\n  const historicalScript = 'import { execFileSync } from \"node:child_process\"; import { GRAND_STRATEGY_SOURCE as source, grandStrategyHistoricalRecord } from '\n    + JSON.stringify(new URL('../tools/grand-strategy-source-transfer.js', import.meta.url).href)\n    + '; const file = ' + JSON.stringify(observedFile)\n    + '; const pin = source.files[file].baseline; const bytes = execFileSync(\"git\", [\"--no-replace-objects\", \"show\", source.predecessor + \":\" + file], { maxBuffer: 64 * 1024 * 1024, windowsHide: true });'\n    + ' grandStrategyHistoricalRecord(file, { head: { mode: pin.mode, blob: pin.blob }, index: pin.mode + \" \" + pin.blob + \" 0\\\\t\" + file,'\n    + ' committed: bytes, physical: bytes, regular: true, symbolic: false });';\n  const currentRecordScript = ending => 'import { crimeMinigameActual } from '\n    + JSON.stringify(new URL('../tools/crime-minigame-source-compatibility.js', import.meta.url).href)\n    + '; import { grandStrategyHistoricalRecord } from ' + JSON.stringify(new URL('../tools/grand-strategy-source-transfer.js', import.meta.url).href)\n    + '; import { ageRemovalHistoricalRecord } from ' + JSON.stringify(new URL('../tools/age-removal-source-transfer.js', import.meta.url).href)\n    + '; const file = ' + JSON.stringify(observedFile) + '; const actual = crimeMinigameActual(file);'\n    + ' actual.physical = ' + (ending === 'LF' ? 'actual.committed' : 'Buffer.from(actual.committed.toString(\"utf8\").replaceAll(\"\\\\n\", \"\\\\r\\\\n\"))') + ';'\n    + ' for (const qualify of [grandStrategyHistoricalRecord, ageRemovalHistoricalRecord]) qualify(file, actual);';\n  assert.equal(child(environment).status, 0, 'Genuine closed source succeeds in an isolated checkout');\n  assert.equal(child(environment, historicalScript).status, 0, 'Historical tuples are idempotent only after genuine current admission');\n  for (const physical of [currentObserved.committed, Buffer.from(currentObserved.committed.toString('utf8').replaceAll('\\n', '\\r\\n'))]) {\n    fs.writeFileSync(path.join(temporary, observedFile), physical);\n    for (const ending of ['LF', 'CRLF']) {\n      assert.equal(child(environment, currentRecordScript(ending)).status, 0,\n        'Genuine LF/CRLF disk bytes admit either whole supplied representation through the historical chain'); positives += 2;\n    }\n  }\n  fs.writeFileSync(path.join(temporary, observedFile), currentObserved.physical);\n  fs.appendFileSync(path.join(temporary, observedFile), 'x');\n  const changed = child(environment); assert.notEqual(changed.status, 0); assert.match(changed.stderr, /Physical source/); refusals++;\n  const forgedPrior = child(environment, historicalScript); assert.notEqual(forgedPrior.status, 0);\n  assert.match(forgedPrior.stderr, /Physical source/); refusals++;\n  const forgedCurrent = child(environment, currentRecordScript('LF')); assert.notEqual(forgedCurrent.status, 0);\n  assert.match(forgedCurrent.stderr, /Physical source/); refusals++;\n  fs.writeFileSync(path.join(temporary, observedFile), currentObserved.physical);\n  const changedIndex = child({ ...environment, GIT_INDEX_FILE: path.join(temporaryIndex, 'empty-index') });\n  assert.notEqual(changedIndex.status, 0); assert.match(changedIndex.stderr, /stage-zero index/); refusals++;\n  const forgedIndex = child({ ...environment, GIT_INDEX_FILE: path.join(temporaryIndex, 'empty-index') }, historicalScript);\n  assert.notEqual(forgedIndex.status, 0); assert.match(forgedIndex.stderr, /stage-zero index/); refusals++;\n  const forgedCurrentIndex = child({ ...environment, GIT_INDEX_FILE: path.join(temporaryIndex, 'empty-index') }, currentRecordScript('LF'));\n  assert.notEqual(forgedCurrentIndex.status, 0); assert.match(forgedCurrentIndex.stderr, /stage-zero index/); refusals++;\n} finally {\n  assert(path.resolve(temporaryIndex).startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(temporaryIndex).startsWith('omerta-grand-source-index-'));\n  fs.rmSync(temporaryIndex, { recursive: true, force: true });",
          "baseline": "assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport os from 'node:os';\nimport path from 'node:path';\nimport { createHash } from 'node:crypto';\nimport { execFileSync, spawnSync } from 'node:child_process';\nimport { crimeMinigameActual } from '../tools/crime-minigame-source-compatibility.js';\nimport { AGE_REMOVAL_SOURCE, ageRemovalHistoricalRecord } from '../tools/age-removal-source-transfer.js';\nimport { NATIVE_GARAGE_PREDECESSOR, assertNativeGarageCurrentSource, nativeGarageActual,\n  nativeGarageHistoricalInput, nativeGarageHistoricalEntry } from '../tools/native-garage-source-transfer.js';\nimport { GRAND_STRATEGY_SOURCE as source, GRAND_STRATEGY_PREDECESSOR, GRAND_STRATEGY_SCOPE,\n  GRAND_STRATEGY_GENERATED_FILES, GRAND_STRATEGY_RELEASE_FILES, grandStrategySourceDataBytes,\n  grandStrategyActual, qualifyGrandStrategySource, grandStrategyHistoricalInput,\n  grandStrategyHistoricalEntry, grandStrategyHistoricalRecord } from '../tools/grand-strategy-source-transfer.js';\nconst git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], {\n  encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024,\n});\nconst sha = value => createHash('sha256').update(value).digest('hex');\nconst blob = value => createHash('sha1').update('blob ' + Buffer.byteLength(value) + '\\0').update(value).digest('hex');\nconst entry = (file, pin, kind) => kind === 'tree' ? pin.mode + ' blob ' + pin.blob + '\\t' + file\n  : pin.mode + ' ' + pin.blob + ' 0\\t' + file;\nassert.equal(source.status, 'SEALED', 'An unsealed successor never inherits a historical comparison');\nassert.equal(source.phase, 'EXACT_GRAND_STRATEGY_SOURCE_COMPARISON_ONLY');\nassert.equal(source.predecessor, GRAND_STRATEGY_PREDECESSOR);\nassert.equal(GRAND_STRATEGY_RELEASE_FILES.length, 99, 'The original release input set is finite');\nfor (const [revision, tree] of [[source.revision, source.tree], [source.predecessor, source.predecessorTree]])\n  assert.equal(git('rev-parse', revision + '^{tree}').trim(), tree);\ngit('merge-base', '--is-ancestor', source.predecessor, source.revision);\ngit('merge-base', '--is-ancestor', source.revision, 'HEAD');\nconst excluded = new Set(GRAND_STRATEGY_GENERATED_FILES);\nconst changes = kind => git('diff', '--name-only', '--no-renames', '--diff-filter=' + kind,\n  '-z', source.predecessor, source.revision).split('\\0').filter(file => file && !excluded.has(file));\nassert.deepEqual(Object.keys(source.files), changes('M'));\nassert.deepEqual(Object.keys(source.additions), changes('A'));\nassert.deepEqual(changes('DRTCUXB'), []);\nassert.deepEqual([...Object.keys(source.files), ...Object.keys(source.additions)].sort(),\n  GRAND_STRATEGY_SCOPE.filter(file => !excluded.has(file)), 'Every authored runtime, test, helper and binary asset has one exact pin');\nfor (const file of excluded) assert(!Object.hasOwn(source.files, file) && !Object.hasOwn(source.additions, file));\nassertNativeGarageCurrentSource();\nconst postCandidate = git('diff', '--name-only', '--no-renames', '-z', source.revision, NATIVE_GARAGE_PREDECESSOR).split('\\0').filter(Boolean);\nassert(postCandidate.every(file => excluded.has(file)), 'Only the fixed independently generated domains may follow the reviewed candidate');\nassert.equal(fs.readFileSync('tools/grand-strategy-source-data.js', 'utf8').replaceAll('\\r\\n', '\\n'), grandStrategySourceDataBytes(source),\n  'The sole generated self-reference contains exact data and no executable additions');\nassert.equal(git('diff', '--name-only', source.predecessor, 'HEAD', '--',\n  'tools/ui-trim-source-data.js', 'tools/age-removal-source-data.js'), '', 'Every earlier sealed historical pin remains immutable');\n\n// Batch genuine identity reads, then fingerprint whole physical text/binary inputs.\nconst pins = Object.fromEntries([...Object.entries(source.files).map(([file, row]) => [file, { ...row.current, text: true }]),\n  ...Object.entries(source.additions)]);\nconst names = Object.keys(pins);\nconst rows = output => new Map(output.split('\\0').filter(Boolean).map(row => [row.slice(row.indexOf('\\t') + 1), row]));\nconst heads = rows(git('ls-tree', '-z', 'HEAD', '--', ...names));\nconst indexes = rows(git('ls-files', '--stage', '-z', '--', ...names));\nfor (const [file, pin] of Object.entries(pins)) {\n  assert.equal(nativeGarageHistoricalEntry(file, heads.get(file), 'tree'), entry(file, pin, 'tree'), 'Whole genuine HEAD identity: ' + file);\n  assert.equal(nativeGarageHistoricalEntry(file, indexes.get(file), 'index'), entry(file, pin, 'index'), 'Whole genuine stage-zero identity: ' + file);\n  const stat = fs.lstatSync(file); assert(stat.isFile() && !stat.isSymbolicLink());\n  const physical = nativeGarageHistoricalInput(file, fs.readFileSync(file));\n  let canonical = physical;\n  if (pin.text) {\n    const raw = physical.toString('utf8'); assert(Buffer.from(raw).equals(physical));\n    const lf = raw.replaceAll('\\r\\n', '\\n');\n    assert(!/[\\r\\0\\ufeff]/.test(lf) && (raw === lf || raw === lf.replaceAll('\\n', '\\r\\n')));\n    canonical = Buffer.from(lf);\n  }\n  assert.equal(canonical.length, pin.bytes); assert.equal(sha(canonical), pin.sha256); assert.equal(blob(canonical), pin.blob);\n}\nlet positives = 0, refusals = 0;\nfor (const [file, row] of Object.entries(source.files)) {\n  const actual = grandStrategyActual(file), current = actual.committed.toString('utf8');\n  const before = git('show', source.predecessor + ':' + file);\n  for (const input of [current, current.replaceAll('\\n', '\\r\\n'), Buffer.from(current), actual.physical]) {\n    const proof = qualifyGrandStrategySource(file, input);\n    assert.equal(proof.baselineText, before);\n    assert.deepEqual([proof.sourceOnly, proof.runtime, proof.native, proof.migration, proof.financial,\n      proof.activation, proof.deployment, proof.priorResultsTransferred], [true, false, false, false, false, false, false, false]);\n    const projected = grandStrategyHistoricalInput(file, input);\n    assert.equal(String(projected), before);\n    assert.equal(Buffer.isBuffer(projected), Buffer.isBuffer(input)); positives++;\n  }\n  const historical = grandStrategyHistoricalRecord(file, actual);\n  assert.equal(historical.committed.toString('utf8'), before);\n  assert.deepEqual(historical.head, { mode: row.baseline.mode, blob: row.baseline.blob });\n  assert.strictEqual(grandStrategyHistoricalRecord(file, historical), historical, 'Prior tuples acquire no new qualification');\n  for (const physical of [actual.committed, Buffer.from(current.replaceAll('\\n', '\\r\\n'))]) {\n    assert.deepEqual(grandStrategyHistoricalRecord(file, { ...actual, physical }), historical,\n      'Complete LF and CRLF supplied records retain the same historical identity'); positives++;\n  }\n  assert.throws(() => qualifyGrandStrategySource(file, before)); refusals++; positives++;\n  for (const kind of ['tree', 'index']) {\n    for (const suffix of ['', '\\n'])\n      assert.equal(grandStrategyHistoricalEntry(file, entry(file, row.current, kind) + suffix, kind), entry(file, row.baseline, kind) + suffix);\n    for (const value of [' ' + entry(file, row.current, kind), entry(file, row.current, kind) + '\\n\\n',\n      entry(file, row.current, kind).replace(row.current.blob, '0'.repeat(40))]) {\n      assert.equal(grandStrategyHistoricalEntry(file, value, kind), value); refusals++;\n    }\n  }\n  for (const value of [current + '\\n// unreviewed successor\\n', current.slice(1), '\\ufeff' + current, current + '\\0',\n    current.replace('\\n', '\\r\\n'), current.replace('\\n', '\\r'), null]) {\n    assert.throws(() => qualifyGrandStrategySource(file, value));\n    assert.strictEqual(grandStrategyHistoricalInput(file, value), value); refusals++;\n  }\n  const invalid = Buffer.from([0xff]);\n  assert.throws(() => qualifyGrandStrategySource(file, invalid), /Lossless UTF-8/);\n  assert.throws(() => grandStrategyHistoricalInput(file, invalid), /Lossless UTF-8/); refusals += 2;\n}\nconst observedFile = 'public/index.html', observed = grandStrategyActual(observedFile);\nconst currentObserved = crimeMinigameActual(observedFile);\nconst priorObserved = grandStrategyHistoricalRecord(observedFile, observed);\nfor (const file of ['public/index.html', 'public/sw.js', 'src/server.js']) {\n  const actual = grandStrategyActual(file), pin = AGE_REMOVAL_SOURCE.files[file].baseline;\n  for (const physical of [actual.committed, Buffer.from(actual.committed.toString('utf8').replaceAll('\\n', '\\r\\n'))]) {\n    const historical = ageRemovalHistoricalRecord(file, { ...actual, physical });\n    assert.deepEqual(historical.head, { mode: pin.mode, blob: pin.blob });\n    assert.equal(historical.index, entry(file, pin, 'index'));\n    assert.equal(historical.committed.length, pin.bytes); assert.equal(sha(historical.committed), pin.sha256);\n    assert.equal(blob(historical.committed), pin.blob); assert(historical.physical.equals(historical.committed));\n    assert.equal(historical.regular, true); assert.equal(historical.symbolic, false); positives++;\n  }\n}\nassert.throws(() => grandStrategyHistoricalRecord(observedFile, { ...priorObserved, head: { ...priorObserved.head, extra: true } })); refusals++;\nfor (const patch of [{ head: { ...observed.head, mode: '120000' } },\n  { index: observed.index.replace(observed.head.blob, '0'.repeat(40)) }, { regular: false }, { symbolic: true },\n  { physical: Buffer.concat([observed.physical, Buffer.from('x')]) },\n  { physical: observed.committed.subarray(1) }, { physical: priorObserved.committed },\n  { physical: Buffer.from(observed.committed.toString('utf8').replace('\\n', '\\r\\n')) },\n  { physical: Buffer.from(observed.committed.toString('utf8').replace('\\n', '\\r')) },\n  { physical: Buffer.concat([Buffer.from('\\ufeff'), observed.committed]) },\n  { physical: Buffer.concat([observed.committed, Buffer.from('\\0')]) }, { physical: Buffer.from([0xff]) },\n  { committed: Buffer.concat([observed.committed, Buffer.from('x')]) }, { extra: true }]) {\n  for (const qualify of [grandStrategyHistoricalRecord, ageRemovalHistoricalRecord]) {\n    assert.throws(() => qualify(observedFile, { ...observed, ...patch })); refusals++;\n  }\n}\nassert.equal(git('ls-tree', '-z', source.predecessor, '--', ...Object.keys(source.additions)), '',\n  'An added source or binary asset has no predecessor record');\nfor (const file of Object.keys(source.additions)) {\n  const input = Buffer.from('new files have no predecessor');\n  assert.throws(() => qualifyGrandStrategySource(file, input));\n  assert.strictEqual(grandStrategyHistoricalInput(file, input), input); refusals++;\n}\nfor (const file of ['__proto__', 'constructor', 'src/unreviewed-successor.js']) {\n  const input = Buffer.from([0xff]); assert.throws(() => qualifyGrandStrategySource(file, input));\n  assert.strictEqual(grandStrategyHistoricalInput(file, input), input); refusals++;\n}\n// Genuine index/physical refusal controls use an isolated alternate index/work tree, never the caller's checkout.\nconst temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'omerta-grand-source-'));\ntry {\n  const environment = { ...process.env, GIT_DIR: git('rev-parse', '--absolute-git-dir').trim(),\n    GIT_WORK_TREE: temporary, GIT_INDEX_FILE: path.join(temporary, 'reviewed-index') };\n  execFileSync('git', ['--no-replace-objects', 'read-tree', 'HEAD'], { cwd: temporary, env: environment, windowsHide: true });\n  fs.mkdirSync(path.join(temporary, 'public')); fs.writeFileSync(path.join(temporary, observedFile), currentObserved.physical);\n  const script = 'import { grandStrategyActual } from ' + JSON.stringify(new URL('../tools/grand-strategy-source-transfer.js', import.meta.url).href)\n    + '; grandStrategyActual(' + JSON.stringify(observedFile) + ');';\n  const child = (env, code = script) => spawnSync(process.execPath, ['--input-type=module', '-e', code], {\n    cwd: temporary, env, windowsHide: true, encoding: 'utf8',\n  });\n  const historicalScript = 'import { execFileSync } from \"node:child_process\"; import { GRAND_STRATEGY_SOURCE as source, grandStrategyHistoricalRecord } from '\n    + JSON.stringify(new URL('../tools/grand-strategy-source-transfer.js', import.meta.url).href)\n    + '; const file = ' + JSON.stringify(observedFile)\n    + '; const pin = source.files[file].baseline; const bytes = execFileSync(\"git\", [\"--no-replace-objects\", \"show\", source.predecessor + \":\" + file], { maxBuffer: 64 * 1024 * 1024, windowsHide: true });'\n    + ' grandStrategyHistoricalRecord(file, { head: { mode: pin.mode, blob: pin.blob }, index: pin.mode + \" \" + pin.blob + \" 0\\\\t\" + file,'\n    + ' committed: bytes, physical: bytes, regular: true, symbolic: false });';\n  const currentRecordScript = ending => 'import { crimeMinigameActual } from '\n    + JSON.stringify(new URL('../tools/crime-minigame-source-compatibility.js', import.meta.url).href)\n    + '; import { grandStrategyHistoricalRecord } from ' + JSON.stringify(new URL('../tools/grand-strategy-source-transfer.js', import.meta.url).href)\n    + '; import { ageRemovalHistoricalRecord } from ' + JSON.stringify(new URL('../tools/age-removal-source-transfer.js', import.meta.url).href)\n    + '; const file = ' + JSON.stringify(observedFile) + '; const actual = crimeMinigameActual(file);'\n    + ' actual.physical = ' + (ending === 'LF' ? 'actual.committed' : 'Buffer.from(actual.committed.toString(\"utf8\").replaceAll(\"\\\\n\", \"\\\\r\\\\n\"))') + ';'\n    + ' for (const qualify of [grandStrategyHistoricalRecord, ageRemovalHistoricalRecord]) qualify(file, actual);';\n  assert.equal(child(environment).status, 0, 'Genuine closed source succeeds in an isolated checkout');\n  assert.equal(child(environment, historicalScript).status, 0, 'Historical tuples are idempotent only after genuine current admission');\n  for (const physical of [currentObserved.committed, Buffer.from(currentObserved.committed.toString('utf8').replaceAll('\\n', '\\r\\n'))]) {\n    fs.writeFileSync(path.join(temporary, observedFile), physical);\n    for (const ending of ['LF', 'CRLF']) {\n      assert.equal(child(environment, currentRecordScript(ending)).status, 0,\n        'Genuine LF/CRLF disk bytes admit either whole supplied representation through the historical chain'); positives += 2;\n    }\n  }\n  fs.writeFileSync(path.join(temporary, observedFile), currentObserved.physical);\n  fs.appendFileSync(path.join(temporary, observedFile), 'x');\n  const changed = child(environment); assert.notEqual(changed.status, 0); assert.match(changed.stderr, /Physical source/); refusals++;\n  const forgedPrior = child(environment, historicalScript); assert.notEqual(forgedPrior.status, 0);\n  assert.match(forgedPrior.stderr, /Physical source/); refusals++;\n  const forgedCurrent = child(environment, currentRecordScript('LF')); assert.notEqual(forgedCurrent.status, 0);\n  assert.match(forgedCurrent.stderr, /Physical source/); refusals++;\n  fs.writeFileSync(path.join(temporary, observedFile), currentObserved.physical);\n  const changedIndex = child({ ...environment, GIT_INDEX_FILE: path.join(temporary, 'empty-index') });\n  assert.notEqual(changedIndex.status, 0); assert.match(changedIndex.stderr, /stage-zero index/); refusals++;\n  const forgedIndex = child({ ...environment, GIT_INDEX_FILE: path.join(temporary, 'empty-index') }, historicalScript);\n  assert.notEqual(forgedIndex.status, 0); assert.match(forgedIndex.stderr, /stage-zero index/); refusals++;\n  const forgedCurrentIndex = child({ ...environment, GIT_INDEX_FILE: path.join(temporary, 'empty-index') }, currentRecordScript('LF'));\n  assert.notEqual(forgedCurrentIndex.status, 0); assert.match(forgedCurrentIndex.stderr, /stage-zero index/); refusals++;\n} finally {"
        }
      ]
    },
    "test/native-garage-enterprise-source.js": {
      "baseline": {
        "mode": "100644",
        "blob": "2a5e29a8fe66934fa4d39e52b3bdb0634143e739",
        "sha256": "3c579a38f6f7e9827582b63e8230126a0af95020358396ec919344a3649f13e2",
        "bytes": 4407
      },
      "current": {
        "mode": "100644",
        "blob": "25aac1cec60037ccb24e128774c8ac5dd41fe289",
        "sha256": "e1057e70fa96ff19ab1b157d0b2e6fe35153d0e6905c4d99c557d7415118360a",
        "bytes": 4736
      },
      "inverses": [
        {
          "at": 2466,
          "current": "row.file === 'package-lock.json');\nassert(unchanged, 'Fixed unchanged declaration fixture');\nconst bytes = git('show', 'HEAD:' + unchanged.file), current = { type: 'blob', mode: unchanged.mode, blob: unchanged.blob };\nassert.equal(git('ls-tree', 'HEAD', '--', unchanged.file).toString('utf8').trim(),\n  `${unchanged.mode} blob ${unchanged.blob}\\t${unchanged.file}`, 'Unchanged fixture is actual current HEAD');\nassert.equal(sha(bytes), unchanged.sha256, 'Unchanged fixture retains its exact declared bytes')",
          "baseline": "!Object.hasOwn(NATIVE_GARAGE_SOURCE.files, row.file));\nconst bytes = git('show', 'HEAD:' + unchanged.file), current = { type: 'blob', mode: unchanged.mode, blob: unchanged.blob }"
        }
      ]
    },
    "test/native-garage-source-transfer.js": {
      "baseline": {
        "mode": "100644",
        "blob": "d3ccb791645784a1309d348b87fd2b6df7e3c638",
        "sha256": "f0996dcde14aecbec07e9639d0dec7d337cbf6b096a639e241a8c1a7f6593280",
        "bytes": 10306
      },
      "current": {
        "mode": "100644",
        "blob": "a4b222c47898c247c45ce7c006586f1c91fef0f5",
        "sha256": "06ae3f6e2c8772e3c863ab193311fcb430263b03a104201337d188cd53ba23b8",
        "bytes": 10872
      },
      "inverses": [
        {
          "at": 140,
          "current": "import { launchIntegrationActual } from '../tools/launch-integration-source-transfer.js';\n",
          "baseline": ""
        },
        {
          "at": 4800,
          "current": "const currentObserved = launchIntegrationActual(observedFile);\n",
          "baseline": "const currentObserved = crimeMinigameActual(observedFile);\n"
        },
        {
          "at": 4946,
          "current": "const temporaryIndex = fs.mkdtempSync(path.join(os.tmpdir(), 'omerta-native-source-index-'));\n",
          "baseline": ""
        },
        {
          "at": 6721,
          "current": "    GIT_WORK_TREE: temporary, GIT_INDEX_FILE: path.join(temporaryIndex, 'reviewed-index') };\n",
          "baseline": "    GIT_WORK_TREE: temporary, GIT_INDEX_FILE: path.join(temporary, 'reviewed-index') };\n"
        },
        {
          "at": 6917,
          "current": "  execFileSync('git', ['checkout-index', '--all', '--force'], { cwd: temporary, env: environment, windowsHide: true });\n  fs.mkdirSync(path.join(temporary, 'public'), { recursive: true });\n",
          "baseline": "  fs.mkdirSync(path.join(temporary, 'public'));\n"
        },
        {
          "at": 8101,
          "current": "  const changedIndex = child({ ...environment, GIT_INDEX_FILE: path.join(temporaryIndex, 'empty-index') });\n",
          "baseline": "  const changedIndex = child({ ...environment, GIT_INDEX_FILE: path.join(temporary, 'empty-index') });\n"
        },
        {
          "at": 10163,
          "current": "  assert(path.resolve(temporaryIndex).startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(temporaryIndex).startsWith('omerta-native-source-index-'));\n  fs.rmSync(temporaryIndex, { recursive: true, force: true });\n",
          "baseline": ""
        }
      ]
    },
    "test/phase2-postgres.js": {
      "baseline": {
        "mode": "100644",
        "blob": "ad44c1827bfc472b003112538ca2f9462879c554",
        "sha256": "95e46eb6c479466a49675b645266f836cf453581079fd4268aea8c4b8fa290c1",
        "bytes": 89727
      },
      "current": {
        "mode": "100644",
        "blob": "2adb306714d43667ea18a2dddfe790f5d3c36652",
        "sha256": "81ecf44220853aff07b151ae96db990a3dab6e6ac5bb850ee20923c9a463be23",
        "bytes": 89132
      },
      "inverses": [
        {
          "at": 67,
          "current": "import { randomUUID, createHash } from 'node:crypto';\nimport { spawnSync, execFileSync } from 'node:child_process';\nimport { fileURLToPath } from 'node:url';\nimport { phase2ErrorSummary } from './lib/phase2-error.js';\nimport pg from 'pg';\nimport { makeDb, dbCaps, verifyPhase2DefinitionSchema, migrateSchemaUnderLock } from '../src/db.js';\nimport { baseLibrary, compileFixture, materialSource, schema, TABLES, deferred, forwardPool,\n",
          "baseline": "import { randomUUID, createHash } from 'node:crypto';\nimport { spawnSync, execFileSync } from 'node:child_process';\nimport { fileURLToPath } from 'node:url';\nimport pg from 'pg';\nimport { makeDb, dbCaps, verifyPhase2DefinitionSchema, migrateSchemaUnderLock } from '../src/db.js';\nimport { baseLibrary, compileFixture, materialSource, schema, TABLES, deferred, forwardPool,\n"
        },
        {
          "at": 4105,
          "current": "const concept = (id = 'note', version = 1) => ({ id, definitionVersion: version, kind: 'concept' });\nconst fixture = (name,version = 1,definitions = [concept()]) => compileFixture(baseLibrary({ packageId: `omerta.pg.${name}`, version, definitions }));\nconst rejects = (promise,code) => assert.rejects(promise,(error) => error.code === code,`expected ${code}`);\n\n// Only the already verified native child can allocate these per-block schemas. The locally retained\n// exact name grants cleanup ownership only after CREATE is positively acknowledged. An ambiguous\n",
          "baseline": "const concept = (id = 'note', version = 1) => ({ id, definitionVersion: version, kind: 'concept' });\nconst fixture = (name,version = 1,definitions = [concept()]) => compileFixture(baseLibrary({ packageId: `omerta.pg.${name}`, version, definitions }));\nconst rejects = (promise,code) => assert.rejects(promise,(error) => error.code === code,`expected ${code}`);\nconst safeError = (error) => {\n  if (error?.code !== 'ERR_ASSERTION') return `code: ${/^[a-zA-Z0-9_]{1,64}$/.test(error?.code ?? '') ? error.code : 'test_failed'}`;\n  const location = String(error.stack ?? '').match(/(?:test[\\\\/])?(phase2-[a-z-]+\\.js:\\d+:\\d+)/)?.[1] ?? 'unknown assertion location';\n  const scalar = (value) => value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))\n    ? JSON.stringify(value) : '[redacted non-scalar]';\n  return `assertion at ${location}; actual=${scalar(error.actual)} expected=${scalar(error.expected)}; ${String(error.operator ?? '').replace(/[^a-zA-Z]/g, '').slice(0, 32)}`;\n};\n\n// Only the already verified native child can allocate these per-block schemas. The locally retained\n// exact name grants cleanup ownership only after CREATE is positively acknowledged. An ambiguous\n"
        },
        {
          "at": 88887,
          "current": "}\n\ntry { assertQuestingPhase2SourceInputs(); const url=endpoint(); if(process.env.P2_TEST_CHILD) await child(url); else await parent(url); }\ncatch(error) { console.error('phase2-postgres: FAIL '+phase2ErrorSummary(error)); process.exitCode=1; }\n",
          "baseline": "}\n\ntry { assertQuestingPhase2SourceInputs(); const url=endpoint(); if(process.env.P2_TEST_CHILD) await child(url); else await parent(url); }\ncatch(error) { console.error('phase2-postgres: FAIL '+safeError(error)); process.exitCode=1; }\n"
        }
      ]
    },
    "test/ux-tactics-browser.js": {
      "baseline": {
        "mode": "100644",
        "blob": "cbf1456286287e28ddda01d6c2c3c0ff10b78a38",
        "sha256": "842c02f9e2f4e4290d93f4a484622cbca0b1a1bbd948cad7dde4adeb9ad5e648",
        "bytes": 13295
      },
      "current": {
        "mode": "100644",
        "blob": "296914a77ebd8e0435e493758f60c9f5e122a841",
        "sha256": "2f4573dfd4eabb15563f85b1b4162b7762bc48e35aa23d2c29b6ce4feb4c182c",
        "bytes": 13621
      },
      "inverses": [
        {
          "at": 7698,
          "current": "age.evaluate(() => {\n      const action = document.querySelector('#tab-streets [data-do=\"POST /v1/crimes/pick\"].prime:enabled');\n      const card = action?.closest('.noir-job-card');\n      if (!card) throw new Error('Current enabled native pick card is required for screenshot.');\n      card.scrollIntoView({ block: 'center', inline: 'nearest' });\n    }",
          "baseline": "ick.scrollIntoViewIfNeeded("
        }
      ]
    },
    "tools/crime-minigame-source-compatibility.js": {
      "baseline": {
        "mode": "100644",
        "blob": "8da20d0ae4151ec497cb72d074c8c1197aac56e7",
        "sha256": "66bb326130ac91b3e2681bfa1245ad69e0c2095d50cc15b74217ef839609904b",
        "bytes": 10137
      },
      "current": {
        "mode": "100644",
        "blob": "b01f94c03f5a131c65980d0b87a40ddf3c8963ea",
        "sha256": "d35fbf21b464e7811497a2c262119bfde2e2e122f0ebccf8372057d3e19179b3",
        "bytes": 11244
      },
      "inverses": [
        {
          "at": 358,
          "current": "import { LAUNCH_INTEGRATION_PREDECESSOR, assertLaunchIntegrationCurrentSource,\n  launchIntegrationHistoricalInput, launchIntegrationHistoricalEntry,\n  launchIntegrationHistoricalRecord } from './launch-integration-source-transfer.js';\n",
          "baseline": ""
        },
        {
          "at": 4979,
          "current": "  assert(git('diff', '--no-renames', '--name-only', '-z', source.revision, LAUNCH_INTEGRATION_PREDECESSOR).split('\\0')\n",
          "baseline": "  assert(git('diff', '--no-renames', '--name-only', '-z', source.revision, 'HEAD').split('\\0')\n"
        },
        {
          "at": 5221,
          "current": "  assertLaunchIntegrationCurrentSource();\n",
          "baseline": ""
        },
        {
          "at": 5795,
          "current": "  const head = git('ls-tree', 'HEAD', '--', file).trim(), rawIndex = git('ls-files', '--stage', '--', file).trim();\n  const match = head.match(/^(100644|100755) blob ([a-f0-9]{40})\\t/);assert(match, 'Regular genuine current source required');\n  const stat = fs.lstatSync(file);assert(stat.isFile() && !stat.isSymbolicLink(), 'Regular physical reviewed source required');\n  const descriptor = fs.openSync(file, 'r');let rawPhysical;\n  try { rawPhysical = readActualPhysical(descriptor); } finally { fs.closeSync(descriptor); }\n",
          "baseline": "  const head = git('ls-tree', 'HEAD', '--', file).trim(), index = git('ls-files', '--stage', '--', file).trim();\n  assert.equal(head, entry(file, pin, 'tree'), 'Genuine current HEAD must equal the reviewed minigame successor');\n  assert.equal(index, entry(file, pin, 'index'), 'Genuine stage-zero index must equal the reviewed minigame successor');\n  const stat = fs.lstatSync(file), physical = readActualPhysical(file);\n"
        },
        {
          "at": 6417,
          "current": "  const rawCommitted = execFileSync('git', ['--no-replace-objects', 'show', 'HEAD:' + file], { windowsHide: true, maxBuffer: 64 * 1024 * 1024 });\n  const actual = launchIntegrationHistoricalRecord(file, { head: { mode: match[1], blob: match[2] }, index: rawIndex,\n    committed: rawCommitted, physical: rawPhysical, regular: true, symbolic: false });\n  const { index, committed, physical } = actual;\n  assert.equal(entry(file, actual.head, 'tree'), entry(file, pin, 'tree'), 'Genuine current HEAD must equal the reviewed minigame successor');\n  assert.equal(index, entry(file, pin, 'index'), 'Genuine stage-zero index must equal the reviewed minigame successor');\n",
          "baseline": "  const committed = execFileSync('git', ['--no-replace-objects', 'show', 'HEAD:' + file], { windowsHide: true, maxBuffer: 64 * 1024 * 1024 });\n"
        },
        {
          "at": 8824,
          "current": "  input = launchIntegrationHistoricalInput(file, input);\n",
          "baseline": ""
        },
        {
          "at": 9286,
          "current": "  input = launchIntegrationHistoricalEntry(file, input, kind);\n",
          "baseline": ""
        },
        {
          "at": 9742,
          "current": "  actual = launchIntegrationHistoricalRecord(file, actual);\n",
          "baseline": ""
        }
      ]
    },
    "tools/enterprise-native-questing.js": {
      "baseline": {
        "mode": "100644",
        "blob": "ec7279f399c0e18ac28b333cacd5b119237198c2",
        "sha256": "1dfd95a9148b8348495e69927667375da9e568964e827fdc1ea9a459bbe850d0",
        "bytes": 27973
      },
      "current": {
        "mode": "100644",
        "blob": "2089ee86d8d90ee5d35e49e9c497770721fc90de",
        "sha256": "0df141f41e902ffd1386446dc7151c89f5f36437cf44d47c85096d4c6baf1e45",
        "bytes": 27954
      },
      "inverses": [
        {
          "at": 1357,
          "current": "  captureLaunchEnterpriseSource, launchEnterpriseDeclaredInput,\n} from './native-garage-enterprise-source.js';\n\nexport const QUESTING_NATIVE_METADATA = 'tools/enterprise-native-questing-inputs.js';\nexport const QUESTING_NATIVE_PREDECESSOR_METADATA = 'tools/enterprise-native-contract-release-inputs.js';\nexport { declaration as QUESTING_ENTERPRISE_NATIVE_INPUTS };\nexport const QUESTING_NATIVE_SUPPORT = Object.freeze([\n  'tools/task-puzzle-native-catalog.js', 'tools/task-puzzle-enterprise-catalog.js',\n  'test/task-puzzle-native-catalog-guard.js', 'test/task-puzzle-native-integration-guard.js',\n  'tools/enterprise-native-questing.js', 'tools/enterprise-native-questing-seal.js',\n  'tools/install-foundry-verified.sh',\n  'test/enterprise-native-questing-guard.js', QUESTING_NATIVE_PREDECESSOR_METADATA,\n  'tools/questing-enterprise-catalog.js', 'test/questing-enterprise-catalog-guard.js',\n  'tools/questing-ux-release-phase2-native-catalog.js',\n  'test/questing-ux-release-phase2-native-catalog-guard.js',\n  'test/lib/questing-ux-native-reader-source-compatibility.js',\n  'test/lib/questing-ux-director-reader-source-compatibility.js',\n  'test/lib/questing-ux-enterprise-reader-source-compatibility.js',\n  'src/casinorakeback.js',\n  'public/ux-quests.js', 'public/ux-quests.css', 'public/ux-clues.js', 'public/ux-clues.css',\n  ...['early-obituary', 'family-dinner', 'missing-name', 'three-witnesses', 'quiet-wedding',\n    'morning-after', 'inherited-file', 'archive-service', 'sixth-envelope', 'rival-accord']\n    .map(id => `content/packs/quest-${id}/pack.json`),\n]);\nconst catalogProof = ENTERPRISE_NATIVE_PROOFS.find(row => row[0] === 'enterprise-release-phase2-migration-catalog');\nexport const QUESTING_ENTERPRISE_EXECUTION = Object.freeze([catalogProof, ...ENTERPRISE_NATIVE_PROOFS.filter(row => row !== catalogProof)]);\nexport function assertQuestingExecutionOrder(order = QUESTING_ENTERPRISE_EXECUTION) {\n  assertEnterpriseInventory(ENTERPRISE_NATIVE_PROOFS);\n  assert.ok(Array.isArray(order) && Object.isFrozen(order)); assert.equal(order.length, 16);\n  assert.equal(new Set(order).size, 16); assert.strictEqual(order[0], catalogProof);\n  const remaining = ENTERPRISE_NATIVE_PROOFS.filter(row => row !== catalogProof);\n  for (let i = 0; i < remaining.length; i++) assert.strictEqual(order[i + 1], remaining[i], 'Same canonical tuple identities and remaining order');\n  return order;\n}\nexport function canonicalQuestingResults(rows) {\n  assert.ok(Array.isArray(rows)); assert.equal(rows.length, 16, 'No missing case receipt may be synthesized');\n  const positions = new Map(ENTERPRISE_NATIVE_PROOFS.map(([name], i) => [name, i]));\n  assert.equal(new Set(rows.map(row => row?.file)).size, 16);\n  for (const row of rows) { assert.ok(row && positions.has(row.file)); assert.equal(row.state, 'passed'); }\n  return [...rows].sort((left, right) => positions.get(left.file) - positions.get(right.file));\n}\nconst ROOT = fileURLToPath(new URL('../', import.meta.url));\nconst sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');\nconst blob = bytes => crypto.createHash('sha1').update(`blob ${bytes.length}\\0`).update(bytes).digest('hex');\nconst freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };\nconst git = (...args) => execFileSync('git', ['--no-optional-locks', '--no-replace-objects', ...args], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024, windowsHide: true });\nconst textGit = (...args) => git(...args).toString('utf8').trim();\nconst fields = (value, keys) => assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), 'Closed actual-current native record');\nconst canonicalPath = file => typeof file === 'string' && !/[\\\\:\\0\\r\\n]/.test(file)\n  && !path.posix.isAbsolute(file) && file.split('/').every(part => part && !['.', '..', '.git'].includes(part));\nconst legacyNames = predecessor.files.map(row => row.file);\nconst legacyPins = new Map(predecessor.files.map(row => [row.file, row]));\nconst binary = new Set(ENTERPRISE_NATIVE_BINARY_FILES);\nconst same = (left, right) => JSON.stringify(left) === JSON.stringify(right);\nconst protectedInput = file => /^tools\\/[^/]*native[^/]*\\.js$/.test(file)\n  || /^test\\/lib\\/[^/]*native[^/]*\\.js$/.test(file) || file === 'test/enterprise-native-guard.js';\n\nexport function questingNativeMetadataBytes(value) {\n  return Buffer.from('// Actual-current native admission only; historical results never grant execution.\\n'\n    + \"const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };\\n\"\n    + `export const QUESTING_ENTERPRISE_NATIVE_INPUTS = freeze(${JSON.stringify(value, null, 2)});\\n`\n    + `export const QUESTING_ENTERPRISE_NATIVE_INPUTS_SHA256 = ${JSON.stringify(sha(JSON.stringify(value)))};\\n`);\n}\nfunction pin(row) {\n  assert.ok(row && Object.isFrozen(row)); fields(row, ['file', 'mode', 'blob', 'sha256']);\n  assert.ok(canonicalPath(row.file)); assert.ok(['100644', '100755'].includes(row.mode));\n  assert.match(row.blob, /^[a-f0-9]{40}$/); assert.match(row.sha256, /^[a-f0-9]{64}$/);\n}\nexport function assertQuestingNativeDefinition(value) {\n  fields(value, ['version', 'status', 'phase', 'authoredRevision', 'predecessorDefinitionSha256', 'proofInventorySha256', 'files', 'replacements', 'additions']);\n  assert.ok(Object.isFrozen(value)); assert.equal(value.version, 1); assert.equal(value.status, 'SEALED', 'Actual-current native inputs remain UNSEALED');\n  assert.equal(value.phase, 'ACTUAL_CURRENT_QUESTING_ENTERPRISE_NATIVE_INPUTS'); assert.match(value.authoredRevision, /^[a-f0-9]{40}$/);\n  assert.equal(sha(JSON.stringify(predecessor)), predecessorHash, 'Immutable predecessor definition');\n  assert.equal(value.predecessorDefinitionSha256, predecessorHash);\n  assertEnterpriseInventory(ENTERPRISE_NATIVE_PROOFS);\n  assert.equal(value.proofInventorySha256, sha(JSON.stringify(ENTERPRISE_NATIVE_PROOFS)), 'The same complete sixteen native proofs are mandatory');\n  assert.ok(Object.isFrozen(value.files) && Object.isFrozen(value.replacements) && Object.isFrozen(value.additions));\n  value.files.forEach(pin); assert.equal(new Set(value.files.map(row => row.file)).size, value.files.length);\n  assert.deepEqual(value.files.slice(0, legacyNames.length).map(row => row.file), legacyNames, 'Complete predecessor inventory retained in order');\n  assert.ok(!value.files.some(row => row.file === QUESTING_NATIVE_METADATA), 'Exactly one separately verified metadata self-reference');\n  const current = new Map(value.files.map(row => [row.file, row]));\n  for (const file of QUESTING_NATIVE_SUPPORT) assert.ok(current.has(file), `Required actual-current native support: ${file}`);\n  for (const before of predecessor.files) if (protectedInput(before.file)) {\n    assert.deepEqual(current.get(before.file), before, `Immutable historical helper/manifest: ${before.file}`);\n  }\n  const predecessorMetadata = current.get(QUESTING_NATIVE_PREDECESSOR_METADATA);\n  assert.equal(predecessorMetadata.sha256, sha(enterpriseUxMetadataBytes(predecessor)), 'Predecessor metadata is an exact ordinary input');\n  const changed = predecessor.files.filter(before => !same(before, current.get(before.file)))\n    .map(before => ({ file: before.file, before, after: current.get(before.file) }));\n  value.replacements.forEach(row => { assert.ok(Object.isFrozen(row)); fields(row, ['file', 'before', 'after']); pin(row.before); pin(row.after); });\n  assert.deepEqual(value.replacements, changed, 'Every actual changed predecessor input has its exact before/after pin');\n  const additions = value.files.slice(legacyNames.length);\n  assert.deepEqual(additions.map(row => row.file), additions.map(row => row.file).sort(), 'Native additions have a closed deterministic order');\n  assert.deepEqual(value.additions, additions);\n  return value;\n}\nexport function assertQuestingEnterpriseTrackedInput(file, current, authored, bytes, actualDeclaration = declaration) {\n  assert.strictEqual(actualDeclaration, declaration, 'Caller cannot substitute an actual-current native declaration');\n  assertQuestingNativeDefinition(declaration);\n  assert.equal(sha(JSON.stringify(declaration)), declarationHash, 'Exact sealed actual-current declaration');\n  return assertQuestingTrackedPin(file, current, authored, bytes, declaration.files.find(row => row.file === file));\n}\n// The capture validates the complete immutable declaration before checking any of its pins.\n// Public callers still validate that declaration independently on every invocation.\nfunction assertQuestingTrackedPin(file, current, authored, bytes, expected, launchReceipt) {\n  assert.ok(expected, `No undeclared actual-current native input: ${file}`);\n  assert.ok(Buffer.isBuffer(bytes) && current && authored);\n  ({ current, bytes } = nativeGarageEnterprisePredecessor(file, current, bytes, expected, launchReceipt));\n  assert.equal(current.type, 'blob'); assert.equal(authored.type, 'blob');\n  assert.equal(current.mode, expected.mode); assert.equal(authored.mode, expected.mode);\n  assert.equal(current.blob, expected.blob, 'Actual HEAD input differs from its new native pin');\n  assert.equal(authored.blob, expected.blob, 'Native pin does not identify the actual authored input');\n  assert.equal(sha(bytes), expected.sha256, 'Actual native bytes differ from the new declaration');\n  assert.equal(blob(bytes), expected.blob, 'Actual native Git bytes differ');\n  return Object.freeze({ current: expected, predecessor: legacyPins.get(file) || null,\n    predecessorRevision: predecessor.authoredRevision, authoredRevision: declaration.authoredRevision,\n    nativeAdmission: false, priorResultsTransferred: false });\n}\nexport function questingNativeClosure(read) {\n  const reached = new Set([...legacyNames, ...QUESTING_NATIVE_SUPPORT]), queue = [...reached];\n  for (let index = 0; index < queue.length; index++) {\n    const file = queue[index]; assert.ok(canonicalPath(file));\n    if (file === QUESTING_NATIVE_METADATA) continue;\n    const bytes = read(file); assert.ok(Buffer.isBuffer(bytes));\n    if (!/\\.(?:js|mjs|cjs)$/.test(file)) continue;\n    assert.ok(Buffer.from(bytes.toString('utf8')).equals(bytes), `Lossless JavaScript source: ${file}`);\n    for (const dependency of enterpriseUxImports(file, bytes.toString('utf8'))) {\n      if (dependency === QUESTING_NATIVE_METADATA || reached.has(dependency)) continue;\n      reached.add(dependency); queue.push(dependency);\n    }\n  }\n  reached.delete(QUESTING_NATIVE_METADATA);\n  return [...legacyNames, ...[...reached].filter(file => !legacyPins.has(file)).sort()];\n}\nfunction tree(revision) {\n  return git('ls-tree', '-r', '-z', revision).toString('utf8').split('\\0').filter(Boolean).map(line => {\n    const at = line.indexOf('\\t'), [mode, type, object] = line.slice(0, at).split(' ');\n    return { file: line.slice(at + 1), mode, type, blob: object, line };\n  });\n}\nfunction actualReader(records) {\n  const byName = new Map(records.map(row => [row.file, row])), cache = new Map();\n  return file => {\n    if (cache.has(file)) return cache.get(file);\n    assert.ok(canonicalPath(file)); const row = byName.get(file);\n    assert.ok(row && row.type === 'blob' && ['100644', '100755'].includes(row.mode), `Regular committed input required: ${file}`);\n    const full = path.join(ROOT, file), stat = fs.lstatSync(full);\n    assert.ok(stat.isFile() && !stat.isSymbolicLink(), `Physical regular input: ${file}`);\n    const raw = fs.readFileSync(full); assert.equal(stat.size, raw.length);\n    const canonical = blob(raw) === row.blob ? raw : Buffer.from(raw.toString('utf8').replaceAll('\\r\\n', '\\n'));\n    assertEnterpriseNativeTrackedBytes(raw, canonical, nativeGarageEnterpriseBinary(file, binary.has(file)));\n    assert.equal(blob(canonical), row.blob, `Physical input equals actual Git bytes: ${file}`);\n    const result = { canonical, raw, pin: Object.freeze({ file, mode: row.mode, blob: row.blob, sha256: sha(canonical) }) };\n    cache.set(file, result); return result;\n  };\n}\nfunction cleanRevision() {\n  const revision = textGit('rev-parse', 'HEAD'); assert.match(revision, /^[a-f0-9]{40}$/);\n  assert.equal(textGit('status', '--porcelain', '--untracked-files=all'), '', 'Clean exact committed source required');\n  return revision;\n}\nfunction directories() {\n  return ENTERPRISE_NATIVE_DIRECTORY_MEMBERSHIPS.map(row => ({ directory: row.directory,\n    eligibleNames: assertEnterpriseDirectoryEntries(row.directory, fs.readdirSync(path.join(ROOT, row.directory))) }));\n}\nexport function buildQuestingNativeDefinition(revision) {\n  assert.equal(cleanRevision(), revision, 'Seal only the exact current authored commit');\n  git('merge-base', '--is-ancestor', predecessor.authoredRevision, revision);\n  const records = tree(revision), read = actualReader(records);\n  assert.ok(records.some(row => row.file === QUESTING_NATIVE_METADATA), 'Commit the initial UNSEALED declaration before generation');\n  const files = questingNativeClosure(file => read(file).canonical).map(file => read(file).pin);\n  const current = new Map(files.map(row => [row.file, row]));\n  const value = freeze({ version: 1, status: 'SEALED', phase: 'ACTUAL_CURRENT_QUESTING_ENTERPRISE_NATIVE_INPUTS', authoredRevision: revision,\n    predecessorDefinitionSha256: predecessorHash, proofInventorySha256: sha(JSON.stringify(ENTERPRISE_NATIVE_PROOFS)), files,\n    replacements: predecessor.files.filter(before => !same(before, current.get(before.file))).map(before => ({ file: before.file, before, after: current.get(before.file) })),\n    additions: files.slice(legacyNames.length) });\n  assertQuestingNativeDefinition(value); directories(); assert.equal(cleanRevision(), revision); return value;\n}\nexport function captureQuestingEnterpriseSource() {\n  assertQuestingNativeDefinition(declaration);\n  assert.equal(sha(JSON.stringify(declaration)), declarationHash, 'Only the exact imported sealed native declaration');\n  const revision = cleanRevision(); git('merge-base', '--is-ancestor', declaration.authoredRevision, revision);\n  const records = tree(revision), current = new Map(records.map(row => [row.file, row]));\n  const authored = new Map(tree(declaration.authoredRevision).map(row => [row.file, row]));\n  const read = actualReader(records), files = {};\n  const launchReceipt = captureLaunchEnterpriseSource();\n  const actualClosure = questingNativeClosure(file => read(file).canonical);\n  const declaredClosure = declaration.files.map(row => row.file);\n  const historicalClosure = questingNativeClosure(file => launchEnterpriseDeclaredInput(file, launchReceipt));\n  assertNativeGarageEnterpriseClosure(actualClosure, historicalClosure, declaredClosure, launchReceipt);\n  for (const expected of declaration.files) {\n    const actual = read(expected.file);\n    const original = authored.get(expected.file);\n    assertQuestingTrackedPin(expected.file, current.get(expected.file), original, actual.canonical, expected, launchReceipt);\n    files[expected.file] = { sha256: sha(actual.raw), gitSha256: actual.pin.sha256, blob: actual.pin.blob, binary: nativeGarageEnterpriseBinary(expected.file, binary.has(expected.file)), bytes: actual.raw.length };\n  }\n  // Fresh native proofs exercise the real successor. Keep every scoped byte in\n  // their stability receipt, including browser assets outside the JS traversal.\n  for (const file of new Set([...actualClosure, ...nativeGarageEnterpriseScope(launchReceipt",
          "baseline": "} from './native-garage-enterprise-source.js';\n\nexport const QUESTING_NATIVE_METADATA = 'tools/enterprise-native-questing-inputs.js';\nexport const QUESTING_NATIVE_PREDECESSOR_METADATA = 'tools/enterprise-native-contract-release-inputs.js';\nexport { declaration as QUESTING_ENTERPRISE_NATIVE_INPUTS };\nexport const QUESTING_NATIVE_SUPPORT = Object.freeze([\n  'tools/task-puzzle-native-catalog.js', 'tools/task-puzzle-enterprise-catalog.js',\n  'test/task-puzzle-native-catalog-guard.js', 'test/task-puzzle-native-integration-guard.js',\n  'tools/enterprise-native-questing.js', 'tools/enterprise-native-questing-seal.js',\n  'tools/install-foundry-verified.sh',\n  'test/enterprise-native-questing-guard.js', QUESTING_NATIVE_PREDECESSOR_METADATA,\n  'tools/questing-enterprise-catalog.js', 'test/questing-enterprise-catalog-guard.js',\n  'tools/questing-ux-release-phase2-native-catalog.js',\n  'test/questing-ux-release-phase2-native-catalog-guard.js',\n  'test/lib/questing-ux-native-reader-source-compatibility.js',\n  'test/lib/questing-ux-director-reader-source-compatibility.js',\n  'test/lib/questing-ux-enterprise-reader-source-compatibility.js',\n  'src/casinorakeback.js',\n  'public/ux-quests.js', 'public/ux-quests.css', 'public/ux-clues.js', 'public/ux-clues.css',\n  ...['early-obituary', 'family-dinner', 'missing-name', 'three-witnesses', 'quiet-wedding',\n    'morning-after', 'inherited-file', 'archive-service', 'sixth-envelope', 'rival-accord']\n    .map(id => `content/packs/quest-${id}/pack.json`),\n]);\nconst catalogProof = ENTERPRISE_NATIVE_PROOFS.find(row => row[0] === 'enterprise-release-phase2-migration-catalog');\nexport const QUESTING_ENTERPRISE_EXECUTION = Object.freeze([catalogProof, ...ENTERPRISE_NATIVE_PROOFS.filter(row => row !== catalogProof)]);\nexport function assertQuestingExecutionOrder(order = QUESTING_ENTERPRISE_EXECUTION) {\n  assertEnterpriseInventory(ENTERPRISE_NATIVE_PROOFS);\n  assert.ok(Array.isArray(order) && Object.isFrozen(order)); assert.equal(order.length, 16);\n  assert.equal(new Set(order).size, 16); assert.strictEqual(order[0], catalogProof);\n  const remaining = ENTERPRISE_NATIVE_PROOFS.filter(row => row !== catalogProof);\n  for (let i = 0; i < remaining.length; i++) assert.strictEqual(order[i + 1], remaining[i], 'Same canonical tuple identities and remaining order');\n  return order;\n}\nexport function canonicalQuestingResults(rows) {\n  assert.ok(Array.isArray(rows)); assert.equal(rows.length, 16, 'No missing case receipt may be synthesized');\n  const positions = new Map(ENTERPRISE_NATIVE_PROOFS.map(([name], i) => [name, i]));\n  assert.equal(new Set(rows.map(row => row?.file)).size, 16);\n  for (const row of rows) { assert.ok(row && positions.has(row.file)); assert.equal(row.state, 'passed'); }\n  return [...rows].sort((left, right) => positions.get(left.file) - positions.get(right.file));\n}\nconst ROOT = fileURLToPath(new URL('../', import.meta.url));\nconst sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');\nconst blob = bytes => crypto.createHash('sha1').update(`blob ${bytes.length}\\0`).update(bytes).digest('hex');\nconst freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };\nconst git = (...args) => execFileSync('git', ['--no-optional-locks', '--no-replace-objects', ...args], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024, windowsHide: true });\nconst textGit = (...args) => git(...args).toString('utf8').trim();\nconst fields = (value, keys) => assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), 'Closed actual-current native record');\nconst canonicalPath = file => typeof file === 'string' && !/[\\\\:\\0\\r\\n]/.test(file)\n  && !path.posix.isAbsolute(file) && file.split('/').every(part => part && !['.', '..', '.git'].includes(part));\nconst legacyNames = predecessor.files.map(row => row.file);\nconst legacyPins = new Map(predecessor.files.map(row => [row.file, row]));\nconst binary = new Set(ENTERPRISE_NATIVE_BINARY_FILES);\nconst same = (left, right) => JSON.stringify(left) === JSON.stringify(right);\nconst protectedInput = file => /^tools\\/[^/]*native[^/]*\\.js$/.test(file)\n  || /^test\\/lib\\/[^/]*native[^/]*\\.js$/.test(file) || file === 'test/enterprise-native-guard.js';\n\nexport function questingNativeMetadataBytes(value) {\n  return Buffer.from('// Actual-current native admission only; historical results never grant execution.\\n'\n    + \"const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };\\n\"\n    + `export const QUESTING_ENTERPRISE_NATIVE_INPUTS = freeze(${JSON.stringify(value, null, 2)});\\n`\n    + `export const QUESTING_ENTERPRISE_NATIVE_INPUTS_SHA256 = ${JSON.stringify(sha(JSON.stringify(value)))};\\n`);\n}\nfunction pin(row) {\n  assert.ok(row && Object.isFrozen(row)); fields(row, ['file', 'mode', 'blob', 'sha256']);\n  assert.ok(canonicalPath(row.file)); assert.ok(['100644', '100755'].includes(row.mode));\n  assert.match(row.blob, /^[a-f0-9]{40}$/); assert.match(row.sha256, /^[a-f0-9]{64}$/);\n}\nexport function assertQuestingNativeDefinition(value) {\n  fields(value, ['version', 'status', 'phase', 'authoredRevision', 'predecessorDefinitionSha256', 'proofInventorySha256', 'files', 'replacements', 'additions']);\n  assert.ok(Object.isFrozen(value)); assert.equal(value.version, 1); assert.equal(value.status, 'SEALED', 'Actual-current native inputs remain UNSEALED');\n  assert.equal(value.phase, 'ACTUAL_CURRENT_QUESTING_ENTERPRISE_NATIVE_INPUTS'); assert.match(value.authoredRevision, /^[a-f0-9]{40}$/);\n  assert.equal(sha(JSON.stringify(predecessor)), predecessorHash, 'Immutable predecessor definition');\n  assert.equal(value.predecessorDefinitionSha256, predecessorHash);\n  assertEnterpriseInventory(ENTERPRISE_NATIVE_PROOFS);\n  assert.equal(value.proofInventorySha256, sha(JSON.stringify(ENTERPRISE_NATIVE_PROOFS)), 'The same complete sixteen native proofs are mandatory');\n  assert.ok(Object.isFrozen(value.files) && Object.isFrozen(value.replacements) && Object.isFrozen(value.additions));\n  value.files.forEach(pin); assert.equal(new Set(value.files.map(row => row.file)).size, value.files.length);\n  assert.deepEqual(value.files.slice(0, legacyNames.length).map(row => row.file), legacyNames, 'Complete predecessor inventory retained in order');\n  assert.ok(!value.files.some(row => row.file === QUESTING_NATIVE_METADATA), 'Exactly one separately verified metadata self-reference');\n  const current = new Map(value.files.map(row => [row.file, row]));\n  for (const file of QUESTING_NATIVE_SUPPORT) assert.ok(current.has(file), `Required actual-current native support: ${file}`);\n  for (const before of predecessor.files) if (protectedInput(before.file)) {\n    assert.deepEqual(current.get(before.file), before, `Immutable historical helper/manifest: ${before.file}`);\n  }\n  const predecessorMetadata = current.get(QUESTING_NATIVE_PREDECESSOR_METADATA);\n  assert.equal(predecessorMetadata.sha256, sha(enterpriseUxMetadataBytes(predecessor)), 'Predecessor metadata is an exact ordinary input');\n  const changed = predecessor.files.filter(before => !same(before, current.get(before.file)))\n    .map(before => ({ file: before.file, before, after: current.get(before.file) }));\n  value.replacements.forEach(row => { assert.ok(Object.isFrozen(row)); fields(row, ['file', 'before', 'after']); pin(row.before); pin(row.after); });\n  assert.deepEqual(value.replacements, changed, 'Every actual changed predecessor input has its exact before/after pin');\n  const additions = value.files.slice(legacyNames.length);\n  assert.deepEqual(additions.map(row => row.file), additions.map(row => row.file).sort(), 'Native additions have a closed deterministic order');\n  assert.deepEqual(value.additions, additions);\n  return value;\n}\nexport function assertQuestingEnterpriseTrackedInput(file, current, authored, bytes, actualDeclaration = declaration) {\n  assert.strictEqual(actualDeclaration, declaration, 'Caller cannot substitute an actual-current native declaration');\n  assertQuestingNativeDefinition(declaration);\n  assert.equal(sha(JSON.stringify(declaration)), declarationHash, 'Exact sealed actual-current declaration');\n  return assertQuestingTrackedPin(file, current, authored, bytes, declaration.files.find(row => row.file === file));\n}\n// The capture validates the complete immutable declaration before checking any of its pins.\n// Public callers still validate that declaration independently on every invocation.\nfunction assertQuestingTrackedPin(file, current, authored, bytes, expected) {\n  assert.ok(expected, `No undeclared actual-current native input: ${file}`);\n  assert.ok(Buffer.isBuffer(bytes) && current && authored);\n  ({ current, bytes } = nativeGarageEnterprisePredecessor(file, current, bytes, expected));\n  assert.equal(current.type, 'blob'); assert.equal(authored.type, 'blob');\n  assert.equal(current.mode, expected.mode); assert.equal(authored.mode, expected.mode);\n  assert.equal(current.blob, expected.blob, 'Actual HEAD input differs from its new native pin');\n  assert.equal(authored.blob, expected.blob, 'Native pin does not identify the actual authored input');\n  assert.equal(sha(bytes), expected.sha256, 'Actual native bytes differ from the new declaration');\n  assert.equal(blob(bytes), expected.blob, 'Actual native Git bytes differ');\n  return Object.freeze({ current: expected, predecessor: legacyPins.get(file) || null,\n    predecessorRevision: predecessor.authoredRevision, authoredRevision: declaration.authoredRevision,\n    nativeAdmission: false, priorResultsTransferred: false });\n}\nexport function questingNativeClosure(read) {\n  const reached = new Set([...legacyNames, ...QUESTING_NATIVE_SUPPORT]), queue = [...reached];\n  for (let index = 0; index < queue.length; index++) {\n    const file = queue[index]; assert.ok(canonicalPath(file));\n    if (file === QUESTING_NATIVE_METADATA) continue;\n    const bytes = read(file); assert.ok(Buffer.isBuffer(bytes));\n    if (!/\\.(?:js|mjs|cjs)$/.test(file)) continue;\n    assert.ok(Buffer.from(bytes.toString('utf8')).equals(bytes), `Lossless JavaScript source: ${file}`);\n    for (const dependency of enterpriseUxImports(file, bytes.toString('utf8'))) {\n      if (dependency === QUESTING_NATIVE_METADATA || reached.has(dependency)) continue;\n      reached.add(dependency); queue.push(dependency);\n    }\n  }\n  reached.delete(QUESTING_NATIVE_METADATA);\n  return [...legacyNames, ...[...reached].filter(file => !legacyPins.has(file)).sort()];\n}\nfunction tree(revision) {\n  return git('ls-tree', '-r', '-z', revision).toString('utf8').split('\\0').filter(Boolean).map(line => {\n    const at = line.indexOf('\\t'), [mode, type, object] = line.slice(0, at).split(' ');\n    return { file: line.slice(at + 1), mode, type, blob: object, line };\n  });\n}\nfunction actualReader(records) {\n  const byName = new Map(records.map(row => [row.file, row])), cache = new Map();\n  return file => {\n    if (cache.has(file)) return cache.get(file);\n    assert.ok(canonicalPath(file)); const row = byName.get(file);\n    assert.ok(row && row.type === 'blob' && ['100644', '100755'].includes(row.mode), `Regular committed input required: ${file}`);\n    const full = path.join(ROOT, file), stat = fs.lstatSync(full);\n    assert.ok(stat.isFile() && !stat.isSymbolicLink(), `Physical regular input: ${file}`);\n    const raw = fs.readFileSync(full); assert.equal(stat.size, raw.length);\n    const canonical = blob(raw) === row.blob ? raw : Buffer.from(raw.toString('utf8').replaceAll('\\r\\n', '\\n'));\n    assertEnterpriseNativeTrackedBytes(raw, canonical, nativeGarageEnterpriseBinary(file, binary.has(file)));\n    assert.equal(blob(canonical), row.blob, `Physical input equals actual Git bytes: ${file}`);\n    const result = { canonical, raw, pin: Object.freeze({ file, mode: row.mode, blob: row.blob, sha256: sha(canonical) }) };\n    cache.set(file, result); return result;\n  };\n}\nfunction cleanRevision() {\n  const revision = textGit('rev-parse', 'HEAD'); assert.match(revision, /^[a-f0-9]{40}$/);\n  assert.equal(textGit('status', '--porcelain', '--untracked-files=all'), '', 'Clean exact committed source required');\n  return revision;\n}\nfunction directories() {\n  return ENTERPRISE_NATIVE_DIRECTORY_MEMBERSHIPS.map(row => ({ directory: row.directory,\n    eligibleNames: assertEnterpriseDirectoryEntries(row.directory, fs.readdirSync(path.join(ROOT, row.directory))) }));\n}\nexport function buildQuestingNativeDefinition(revision) {\n  assert.equal(cleanRevision(), revision, 'Seal only the exact current authored commit');\n  git('merge-base', '--is-ancestor', predecessor.authoredRevision, revision);\n  const records = tree(revision), read = actualReader(records);\n  assert.ok(records.some(row => row.file === QUESTING_NATIVE_METADATA), 'Commit the initial UNSEALED declaration before generation');\n  const files = questingNativeClosure(file => read(file).canonical).map(file => read(file).pin);\n  const current = new Map(files.map(row => [row.file, row]));\n  const value = freeze({ version: 1, status: 'SEALED', phase: 'ACTUAL_CURRENT_QUESTING_ENTERPRISE_NATIVE_INPUTS', authoredRevision: revision,\n    predecessorDefinitionSha256: predecessorHash, proofInventorySha256: sha(JSON.stringify(ENTERPRISE_NATIVE_PROOFS)), files,\n    replacements: predecessor.files.filter(before => !same(before, current.get(before.file))).map(before => ({ file: before.file, before, after: current.get(before.file) })),\n    additions: files.slice(legacyNames.length) });\n  assertQuestingNativeDefinition(value); directories(); assert.equal(cleanRevision(), revision); return value;\n}\nexport function captureQuestingEnterpriseSource() {\n  assertQuestingNativeDefinition(declaration);\n  assert.equal(sha(JSON.stringify(declaration)), declarationHash, 'Only the exact imported sealed native declaration');\n  const revision = cleanRevision(); git('merge-base', '--is-ancestor', declaration.authoredRevision, revision);\n  const records = tree(revision), current = new Map(records.map(row => [row.file, row]));\n  const authored = new Map(tree(declaration.authoredRevision).map(row => [row.file, row]));\n  const read = actualReader(records), files = {};\n  const actualClosure = questingNativeClosure(file => read(file).canonical);\n  const declaredClosure = declaration.files.map(row => row.file);\n  const exactCurrentClosure = actualClosure.length === declaredClosure.length\n    && actualClosure.every((file, index) => file === declaredClosure[index]);\n  const historicalClosure = exactCurrentClosure ? actualClosure\n    : questingNativeClosure(file => nativeGarageEnterpriseHistoricalInput(file, read(file).canonical));\n  assertNativeGarageEnterpriseClosure(actualClosure, historicalClosure, declaredClosure);\n  for (const expected of declaration.files) {\n    const actual = read(expected.file);\n    const original = authored.get(expected.file);\n    assertQuestingTrackedPin(expected.file, current.get(expected.file), original, actual.canonical, expected);\n    files[expected.file] = { sha256: sha(actual.raw), gitSha256: actual.pin.sha256, blob: actual.pin.blob, binary: nativeGarageEnterpriseBinary(expected.file, binary.has(expected.file)), bytes: actual.raw.length };\n  }\n  // Fresh native proofs exercise the real successor. Keep every scoped byte in\n  // their stability receipt, including browser assets outside the JS traversal.\n  for (const file of new Set([...actualClosure, ...nativeGarageEnterpriseScope("
        }
      ]
    },
    "tools/native-garage-enterprise-source.js": {
      "baseline": {
        "mode": "100644",
        "blob": "ad95d4efb8551f60fcc3a1ff18663202bcf2eea4",
        "sha256": "f56586cc88c39644bb8405db7eb16356373ab10a255a31830248bfea58409c17",
        "bytes": 3167
      },
      "current": {
        "mode": "100644",
        "blob": "1ab963b24dceec5b9f8d919a4e25099c3f6f8f09",
        "sha256": "d2d56e26111d53eff04b8f2124cb365a2663e5d511b2fd0b538b4f854c1ebbc0",
        "bytes": 18968
      },
      "inverses": [
        {
          "at": 172,
          "current": "fs from 'node:fs';\nimport { execFileSync } from 'node:child_process';\nimport { QUESTING_ENTERPRISE_NATIVE_INPUTS as declaration,\n  QUESTING_ENTERPRISE_NATIVE_INPUTS_SHA256 as declarationHash } from './enterprise-native-questing-inputs.js';\nimport { ENTERPRISE_NATIVE_UX_INPUTS as predecessor } from './enterprise-native-contract-release-inputs.js';\nimport { LAUNCH_ENTERPRISE_SOURCE as launchSource, LAUNCH_ENTERPRISE_SOURCE_SHA256 } from './launch-enterprise-source-data.js';\nimport { LAUNCH_INTEGRATION_SOURCE } from './launch-integration-source-data.js';\nimport { launchIntegrationSourceDataBytes } from './launch-integration-source-transfer.js';\nimport {\n  NATIVE_GARAGE_SOURCE, assertNativeGarageCurrentSource, nativeGarageActual,\n  nativeGarageHistoricalInput,\n} from './native-garage-source-transfer.js';\n\nexport const NATIVE_GARAGE_SOURCE_METADATA = 'tools/native-garage-source-data.js';\nexport function nativeGarageEnterpriseBinary(file, baselineBinary = false) {\n  return baselineBinary || NATIVE_GARAGE_SOURCE.additions?.[file]?.text === false;\n}\nconst sha = bytes => createHash('sha256').update(bytes).digest('hex');\nconst blob = bytes => createHash('sha1').update(`blob ${bytes.length}\\0`).update(bytes).digest('hex');\nconst git = (...args) => execFileSync('git', ['--no-optional-locks', '--no-replace-objects', ...args], {\n  windowsHide: true, maxBuffer: 256 * 1024 * 1024,\n});\nconst readPhysical = fs.readFileSync.bind(fs);\nconst issued = new WeakMap();\nconst declared = new Map(declaration.files.map(row => [row.file, row]));\nconst changedPaths = Object.freeze(['.github/workflows/forge.yml', 'package.json', 'public/index.html',\n  'public/ux-navigation.css', 'schema.sql', 'src/chain.js', 'src/data/market-v2-eth-abis.json', 'src/db.js',\n  'src/deedbuildings.js', 'src/deeds.js', 'src/marketv2abi.js', 'src/preflight.js', 'src/routes/deeds.js',\n  'src/watcher.js', 'test/grand-strategy-source-transfer.js', 'test/phase2-postgres.js',\n  'tools/crime-minigame-source-compatibility.js', 'tools/market-v2-deployment-plan.js',\n  'tools/native-garage-source-transfer.js', 'tools/pgquery.js', 'tools/rc1-qualification.mjs']);\nconst authoredPaths = Object.freeze(['tools/enterprise-native-questing.js', 'tools/native-garage-enterprise-source.js']);\nconst addedPaths = Object.freeze(['test/launch-integration-source-transfer.js', 'test/lib/phase2-error.js',\n  'tools/launch-integration-source-transfer.js']);\nconst generatedPaths = Object.freeze(['tools/launch-enterprise-source-data.js', 'tools/launch-integration-source-data.js']);\nconst supportPaths = Object.freeze(['test/launch-enterprise-source-transfer.js']);\nlet declaredBytes;\nlet declaredSizes;\nlet declaredPlan;\nexport const LAUNCH_ENTERPRISE_BATCH_TARGET_BYTES = 32 * 1024 * 1024;\nexport const LAUNCH_ENTERPRISE_BATCH_MAX_BYTES = 256 * 1024 * 1024;\nconst metadataMaxBytes = 128 * 1024;\nconst fields = (value, names) => assert.deepEqual(Object.keys(value).sort(), [...names].sort());\nfunction pin(value) {\n  fields(value, ['mode', 'blob', 'sha256', 'bytes']);\n  assert(['100644', '100755'].includes(value.mode));\n  assert.match(value.blob, /^[a-f0-9]{40}$/); assert.match(value.sha256, /^[a-f0-9]{64}$/);\n  assert(Number.isSafeInteger(value.bytes) && value.bytes >= 0);\n}\nconst equalPin = (left, right) => left.mode === right.mode && left.blob === right.blob\n  && left.sha256 === right.sha256 && left.bytes === right.bytes;\nfunction fullDeclaredPin(file) {\n  const expected = declared.get(file); assert(expected);\n  if (!declaredSizes) {\n    declaredSizes = new Map(immutableDeclaredPlan().entries.map(row => [row.file, row.bytes]));\n  }\n  assert([...changedPaths, ...authoredPaths].includes(file), 'Only closed declared replacement sizes');\n  return { ...expected, bytes: declaredSizes.get(file) };\n}\n\n// Pure framing helpers return no current-source receipt or native admission.\nexport function planLaunchEnterpriseDeclaredChunks(rows, metadata) {\n  assert(Array.isArray(rows) && rows.length > 0 && Buffer.isBuffer(metadata));\n  assert(metadata.length <= metadataMaxBytes);\n  const text = metadata.toString('ascii'); assert(Buffer.from(text, 'ascii').equals(metadata));\n  const lines = text.split('\\n'); assert.equal(lines.pop(), ''); assert.equal(lines.length, rows.length);\n  const names = new Set(), entries = []; let totalFramedBytes = 0;\n  for (let index = 0; index < rows.length; index++) {\n    const row = rows[index]; fields(row, ['file', 'mode', 'blob', 'sha256']);\n    assert(typeof row.file === 'string' && row.file.length && !/[\\\\:\\0\\r\\n]/.test(row.file)\n      && row.file.split('/').every(part => part && !['.', '..', '.git'].includes(part)));\n    assert(!names.has(row.file), 'Duplicate declared path'); names.add(row.file);\n    assert(['100644', '100755'].includes(row.mode));\n    assert.match(row.blob, /^[a-f0-9]{40}$/); assert.match(row.sha256, /^[a-f0-9]{64}$/);\n    const match = /^([a-f0-9]{40}) blob (0|[1-9][0-9]*)$/.exec(lines[index]); assert(match);\n    assert.equal(match[1], row.blob, 'Immutable object metadata stays in declared order');\n    const bytes = Number(match[2]); assert(Number.isSafeInteger(bytes));\n    const framedBytes = bytes + Buffer.byteLength(lines[index] + '\\n') + 1;\n    assert(Number.isSafeInteger(framedBytes) && framedBytes <= LAUNCH_ENTERPRISE_BATCH_MAX_BYTES,\n      'Individual immutable object exceeds unchanged process cap');\n    totalFramedBytes += framedBytes; assert(Number.isSafeInteger(totalFramedBytes));\n    entries.push(Object.freeze({ ...row, bytes, framedBytes }));\n  }\n  const chunks = []; let group = [], framedBytes = 0;\n  const finish = () => { if (group.length) chunks.push(Object.freeze({ entries: Object.freeze(group), framedBytes })); group = []; framedBytes = 0; };\n  for (const entry of entries) {\n    if (group.length && framedBytes + entry.framedBytes > LAUNCH_ENTERPRISE_BATCH_TARGET_BYTES) finish();\n    group.push(entry); framedBytes += entry.framedBytes;\n    if (entry.framedBytes > LAUNCH_ENTERPRISE_BATCH_TARGET_BYTES) finish();\n  }\n  finish();\n  assert.deepEqual(chunks.flatMap(chunk => chunk.entries.map(row => row.file)), rows.map(row => row.file));\n  return Object.freeze({ entries: Object.freeze(entries), chunks: Object.freeze(chunks), totalFramedBytes });\n}\n\nexport function decodeLaunchEnterpriseDeclaredChunk(output, chunk) {\n  assert(Buffer.isBuffer(output)); fields(chunk, ['entries', 'framedBytes']);\n  assert(Array.isArray(chunk.entries) && chunk.entries.length > 0);\n  assert(Number.isSafeInteger(chunk.framedBytes) && chunk.framedBytes <= LAUNCH_ENTERPRISE_BATCH_MAX_BYTES);\n  assert(chunk.framedBytes <= LAUNCH_ENTERPRISE_BATCH_TARGET_BYTES || chunk.entries.length === 1);\n  assert.equal(output.length, chunk.framedBytes, 'Complete exact-sized immutable chunk');\n  const result = new Map(); let at = 0;\n  for (const row of chunk.entries) {\n    fields(row, ['file', 'mode', 'blob', 'sha256', 'bytes', 'framedBytes']);\n    assert(!result.has(row.file), 'Duplicate immutable object path');\n    const end = output.indexOf(10, at); assert(end >= at);\n    const rawHeader = output.subarray(at, end), header = rawHeader.toString('ascii');\n    assert(Buffer.from(header, 'ascii').equals(rawHeader));\n    assert.equal(header, `${row.blob} blob ${row.bytes}`, 'Exact immutable object reference/type/size');\n    assert.equal(row.framedBytes, rawHeader.length + 1 + row.bytes + 1);\n    at = end + 1; assert(at + row.bytes < output.length);\n    const content = output.subarray(at, at + row.bytes);\n    assertLaunchEnterpriseCurrentBytes(content, { mode: row.mode, blob: row.blob, sha256: row.sha256, bytes: row.bytes });\n    assert.equal(output[at + row.bytes], 10, 'Immutable object ends with its framing newline');\n    result.set(row.file, Buffer.from(content)); at += row.bytes + 1;\n  }\n  assert.equal(at, output.length, 'No trailing immutable chunk bytes'); return result;\n}\n\nfunction immutableDeclaredPlan() {\n  if (!declaredPlan) {\n    const metadata = execFileSync('git', ['--no-optional-locks', '--no-replace-objects', 'cat-file', '--batch-check'], {\n      input: declaration.files.map(row => row.blob).join('\\n') + '\\n', windowsHide: true, maxBuffer: metadataMaxBytes,\n    });\n    const plan = planLaunchEnterpriseDeclaredChunks(declaration.files, metadata);\n    assert.equal(plan.entries.length, 1917, 'Entire immutable original declaration'); declaredPlan = plan;\n  }\n  return declaredPlan;\n}\nexport function assertLaunchEnterpriseCurrentBytes(bytes, expected) {\n  assert(Buffer.isBuffer(bytes)); pin(expected);\n  assert.equal(bytes.length, expected.bytes); assert.equal(sha(bytes), expected.sha256); assert.equal(blob(bytes), expected.blob);\n}\n\n// Immutable object-size checks grant no current-source or native admission.\nexport function validateLaunchEnterpriseDefinition(value) {\n  fields(value, ['version', 'status', 'phase', 'reviewedRevision', 'declarationSha256', 'declaredRevision',\n    'replacements', 'authored', 'additions', 'generated', 'support', 'currentClosure']);\n  assert.equal(value.version, 1); assert.equal(value.status, 'SEALED');\n  assert.equal(value.phase, 'CURRENT_ENTERPRISE_SOURCE_ONLY_NO_RESULTS_TRANSFER');\n  assert.equal(value.reviewedRevision, '2bc417eab6939350b7ee6ac96a6e970be2d925c6');\n  assert.equal(value.declarationSha256, declarationHash);\n  assert.equal(value.declaredRevision, declaration.authoredRevision);\n  assert.equal(sha(JSON.stringify(declaration)), declarationHash);\n  for (const [name, paths] of [['replacements', changedPaths], ['authored', authoredPaths]]) {\n    assert(Array.isArray(value[name])); assert.deepEqual(value[name].map(row => row.file), paths);\n    for (const row of value[name]) {\n      fields(row, ['file', 'before', 'current']); pin(row.before); pin(row.current);\n      assert(equalPin(row.before, fullDeclaredPin(row.file)), 'Entire old declaration pin must be retained');\n    }\n  }\n  for (const [name, paths] of [['additions', addedPaths], ['support', supportPaths]]) {\n    assert(Array.isArray(value[name])); assert.deepEqual(value[name].map(row => row.file), paths);\n    for (const row of value[name]) { fields(row, ['file', 'current']); pin(row.current); assert(!declared.has(row.file)); }\n  }\n  // Hashing either generated file here would create a metadata cycle. Both exact\n  // paths are instead rendered and checked against genuine current Git below.\n  assert.deepEqual(value.generated, generatedPaths);\n  const old = new Set(predecessor.files.map(row => row.file));\n  const names = new Set([...declared.keys(), ...addedPaths, ...generatedPaths]);\n  const closure = [...old, ...[...names].filter(file => !old.has(file)).sort()];\n  assert.deepEqual(value.currentClosure, closure, 'Closed actual-current import closure');\n  return Object.freeze({ sourceOnly: true, currentSourceQualified: false, nativeAdmission: false, priorResultsTransferred: false });\n}\n\nexport function launchEnterpriseSourceDataBytes(value) {\n  return '// Current enterprise source extension only; no old execution results transfer.\\n'\n    + 'const freeze = value => { if (value && typeof value === \"object\") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };\\n'\n    + 'export const LAUNCH_ENTERPRISE_SOURCE = freeze(' + JSON.stringify(value, null, 2) + ');\\n'\n    + \"export const LAUNCH_ENTERPRISE_SOURCE_SHA256 = '\" + sha(JSON.stringify(value)) + \"';\\n\";\n}\nfunction genuine(file, expected) {\n  pin(expected);\n  const head = git('ls-tree', 'HEAD', '--', file).toString('utf8').trim();\n  assert.equal(head, `${expected.mode} blob ${expected.blob}\\t${file}`, 'Exact current enterprise HEAD');\n  assert.equal(git('ls-files', '--stage', '--', file).toString('utf8').trim(),\n    `${expected.mode} ${expected.blob} 0\\t${file}`, 'Exact current enterprise stage-zero index');\n  const stat = fs.lstatSync(file); assert(stat.isFile() && !stat.isSymbolicLink());\n  const descriptor = fs.openSync(file, 'r'); let physical;\n  try { physical = readPhysical(descriptor); } finally { fs.closeSync(descriptor); }\n  const committed = git('show', 'HEAD:' + file); assertLaunchEnterpriseCurrentBytes(committed, expected);\n  const text = committed.toString('utf8');\n  assert(Buffer.from(text).equals(committed) && !/[\\r\\0\\ufeff]/.test(text), 'Canonical lossless LF source');\n  assert(physical.equals(committed) || physical.equals(Buffer.from(text.replaceAll('\\n', '\\r\\n'))), 'Whole physical current source');\n  return { current: { type: 'blob', mode: expected.mode, blob: expected.blob }, committed };\n}\nfunction renderedPin(text) { const bytes = Buffer.from(text); return { mode: '100644', blob: blob(bytes), sha256: sha(bytes), bytes: bytes.length }; }\n\nexport function captureLaunchEnterpriseSource() {\n  assert.equal(arguments.length, 0); validateLaunchEnterpriseDefinition(launchSource);\n  assert(Object.isFrozen(launchSource)); assert.equal(sha(JSON.stringify(launchSource)), LAUNCH_ENTERPRISE_SOURCE_SHA256);\n  assertNativeGarageCurrentSource(); git('merge-base', '--is-ancestor', launchSource.reviewedRevision, 'HEAD');\n  const records = new Map();\n  for (const row of [...launchSource.replacements, ...launchSource.authored, ...launchSource.additions, ...launchSource.support])\n    records.set(row.file, genuine(row.file, row.current));\n  records.set(generatedPaths[0], genuine(generatedPaths[0], renderedPin(launchEnterpriseSourceDataBytes(launchSource))));\n  records.set(generatedPaths[1], genuine(generatedPaths[1], renderedPin(launchIntegrationSourceDataBytes(LAUNCH_INTEGRATION_SOURCE))));\n  const receipt = Object.freeze({ sourceOnly: true, nativeAdmission: false, priorResultsTransferred: false,\n    revision: git('rev-parse', 'HEAD').toString('utf8').trim() });\n  issued.set(receipt, records); return receipt;\n}\nfunction admission(value) { const records = issued.get(value); assert(records, 'Genuine current enterprise source capture required'); return records; }\n\n// Read the original declaration from immutable Git blobs, never by rewinding\n// current server/game imports to an earlier, pre-garage source epoch.\nexport function launchEnterpriseDeclaredInput(file, receipt) {\n  admission(receipt); assert(declared.has(file), 'Only an original declared input');\n  if (!declaredBytes) {\n    const bytes = new Map(), order = [];\n    for (const chunk of immutableDeclaredPlan().chunks) {\n      admission(receipt);\n      const output = execFileSync('git', ['--no-optional-locks', '--no-replace-objects', 'cat-file', '--batch'], {\n        input: chunk.entries.map(row => row.blob).join('\\n') + '\\n', windowsHide: true, maxBuffer: LAUNCH_ENTERPRISE_BATCH_MAX_BYTES,\n      });\n      const decoded = decodeLaunchEnterpriseDeclaredChunk(output, chunk);\n      for (const row of chunk.entries) {\n        assert(!bytes.has(row.file) && decoded.has(row.file)); bytes.set(row.file, decoded.get(row.file)); order.push(row.file);\n      }\n    }\n    assert.deepEqual(order, declaration.files.map(row => row.file)); assert.equal(bytes.size, 1917); declaredBytes = bytes;\n  }\n  return Buffer.from(declaredBytes.get(file));\n}\n\nexport function nativeGarageEnterprisePredecessor(file, current, bytes, expected, receipt) {\n  assert(Buffer.isBuffer(bytes));\n  // Ordinary predecessor inputs still face every original pin assertion.\n  if (sha(bytes) === expected.sha256 && blob(bytes) === expected.blob) return { current, bytes };\n  const row = NATIVE_GARAGE_SOURCE.files[file];\n  if (receipt !== undefined || !row || !equalPin(row.baseline, expected)) {\n    const records = admission(receipt);\n    const replacement = [...launchSource.replacements, ...launchSource.authored].find(value => value.file === file);\n    const before = Object.hasOwn(expected, 'bytes') ? expected : { ...expected, bytes: fullDeclaredPin(file).bytes };\n    assert(replacement && equalPin(replacement.before, before), 'Only an exact declared current-source replacement');\n    const actual = records.get(file); assert(actual);\n    assert.equal(current.type, actual.current.type); assert.equal(current.mode, actual.current.mode);\n    assert.equal(current.blob, actual.current.blob); assert(bytes.equals(actual.committed), 'Entire genuine current source required');\n    return { current: { ...current, mode: expected.mode, blob: expected.blob }, bytes: launchEnterpriseDeclaredInput(file, receipt) };\n  }\n  assert.equal(row.baseline.mode, expected.mode);\n  assert.equal(row.baseline.blob, expected.blob);\n  assert.equal(row.baseline.sha256, expected.sha256, 'Garage predecessor must equal the entire original native pin');\n  const actual = nativeGarageActual(file);\n  assert.equal(current.type, 'blob');\n  assert.equal(current.mode, actual.head.mode);\n  assert.equal(current.blob, actual.head.blob);\n  assert(bytes.equals(actual.committed), 'Native execution must use the complete genuine garage successor');\n  const restored = Buffer.from(nativeGarageHistoricalInput(file, bytes.toString('utf8')));\n  assert.equal(sha(restored), expected.sha256);\n  assert.equal(blob(restored), expected.blob);\n  return { current: { ...current, mode: expected.mode, blob: expected.blob }, bytes: restored };\n}\n\nexport function assertNativeGarageEnterpriseClosure(actual, historical, expected, receipt) {\n  if (receipt !== undefined) {\n    admission(receipt);\n    assert.deepEqual(expected, declaration.files.map(row => row.file), 'Original declaration stays unchanged');\n    assert.deepEqual(historical, expected, 'Complete original declared closure reconstructed from its own epoch');\n    assert.deepEqual(actual, launchSource.currentClosure, 'Actual current closure remains independently complete');\n    assert.equal(new Set(actual).size, actual.length); return true;\n  }\n  assertNativeGarageCurrentSource();\n  assert.deepEqual(historical, expected, 'Complete original native closure is retained after exact garage reconstruction');\n  assert.equal(new Set(actual).size, actual.length);\n  const prior = new Set(expected);\n  for (const file of expected) assert(actual.includes(file), `Missing original native input: ${file}`);\n  for (const file of actual) {\n    if (prior.has(file)) continue;\n    assert(file === NATIVE_GARAGE_SOURCE_METADATA || Object.hasOwn(NATIVE_GARAGE_SOURCE.additions, file),\n      `Undeclared actual native dependency: ${file}`);\n    if (file !== NATIVE_GARAGE_SOURCE_METADATA) nativeGarageActual(file);\n  }\n  return true;\n}\n\nexport function nativeGarageEnterpriseScope(receipt) {\n  assertNativeGarageCurrentSource();\n  const original = [...Object.keys(NATIVE_GARAGE_SOURCE.files), ...Object.keys(NATIVE_GARAGE_SOURCE.additions), NATIVE_GARAGE_SOURCE_METADATA];\n  if (receipt === undefined) return original;\n  return [...new Set([...original, ...admission(receipt).keys()])",
          "baseline": "{\n  NATIVE_GARAGE_SOURCE, assertNativeGarageCurrentSource, nativeGarageActual,\n  nativeGarageHistoricalInput,\n} from './native-garage-source-transfer.js';\n\nexport const NATIVE_GARAGE_SOURCE_METADATA = 'tools/native-garage-source-data.js';\nexport function nativeGarageEnterpriseBinary(file, baselineBinary = false) {\n  return baselineBinary || NATIVE_GARAGE_SOURCE.additions?.[file]?.text === false;\n}\nconst sha = bytes => createHash('sha256').update(bytes).digest('hex');\nconst blob = bytes => createHash('sha1').update(`blob ${bytes.length}\\0`).update(bytes).digest('hex');\n\nexport function nativeGarageEnterprisePredecessor(file, current, bytes, expected) {\n  assert(Buffer.isBuffer(bytes));\n  // Ordinary predecessor inputs still face every original pin assertion.\n  if (sha(bytes) === expected.sha256 && blob(bytes) === expected.blob) return { current, bytes };\n  const row = NATIVE_GARAGE_SOURCE.files[file];\n  assert(row, 'Only an explicitly pinned garage successor may extend a native input');\n  assert.equal(row.baseline.mode, expected.mode);\n  assert.equal(row.baseline.blob, expected.blob);\n  assert.equal(row.baseline.sha256, expected.sha256, 'Garage predecessor must equal the entire original native pin');\n  const actual = nativeGarageActual(file);\n  assert.equal(current.type, 'blob');\n  assert.equal(current.mode, actual.head.mode);\n  assert.equal(current.blob, actual.head.blob);\n  assert(bytes.equals(actual.committed), 'Native execution must use the complete genuine garage successor');\n  const restored = Buffer.from(nativeGarageHistoricalInput(file, bytes.toString('utf8')));\n  assert.equal(sha(restored), expected.sha256);\n  assert.equal(blob(restored), expected.blob);\n  return { current: { ...current, mode: expected.mode, blob: expected.blob }, bytes: restored };\n}\n\nexport function assertNativeGarageEnterpriseClosure(actual, historical, expected) {\n  assertNativeGarageCurrentSource();\n  assert.deepEqual(historical, expected, 'Complete original native closure is retained after exact garage reconstruction');\n  assert.equal(new Set(actual).size, actual.length);\n  const prior = new Set(expected);\n  for (const file of expected) assert(actual.includes(file), `Missing original native input: ${file}`);\n  for (const file of actual) {\n    if (prior.has(file)) continue;\n    assert(file === NATIVE_GARAGE_SOURCE_METADATA || Object.hasOwn(NATIVE_GARAGE_SOURCE.additions, file),\n      `Undeclared actual native dependency: ${file}`);\n    if (file !== NATIVE_GARAGE_SOURCE_METADATA) nativeGarageActual(file);\n  }\n  return true;\n}\n\nexport function nativeGarageEnterpriseScope() {\n  assertNativeGarageCurrentSource();\n  return [...Object.keys(NATIVE_GARAGE_SOURCE.files), ...Object.keys(NATIVE_GARAGE_SOURCE.additions), NATIVE_GARAGE_SOURCE_METADATA"
        }
      ]
    },
    "tools/native-garage-source-transfer.js": {
      "baseline": {
        "mode": "100644",
        "blob": "25ac3e910e672cfb9d88cbd16fb93c7ee1202184",
        "sha256": "10d488f480edfd0ed9ba990473e208cf8304847448cd8a9e1462932fe66c630c",
        "bytes": 14654
      },
      "current": {
        "mode": "100644",
        "blob": "36b4788563c7507ea6d242ba4aa7dd4d7342490e",
        "sha256": "678bcdbcc73ae75c53ac2b5ee2adfd6b15066e1634e120c6c7fa7e0d6e9d3dad",
        "bytes": 14768
      },
      "inverses": [
        {
          "at": 591,
          "current": "import { LAUNCH_INTEGRATION_PREDECESSOR } from './launch-integration-source-transfer.js';\n",
          "baseline": ""
        },
        {
          "at": 13516,
          "current": "  const after = git('diff', '--name-only', '--no-renames', '-z', source.revision, LAUNCH_INTEGRATION_PREDECESSOR).split('\\0').filter(Boolean);\n",
          "baseline": "  const after = git('diff', '--name-only', '--no-renames', '-z', source.revision, 'HEAD').split('\\0').filter(Boolean);\n"
        }
      ]
    },
    "tools/pgquery.js": {
      "baseline": {
        "mode": "100644",
        "blob": "c9187f19aa83fe3a691523add9ace7848d984235",
        "sha256": "c8d7eeddb573e4ab6abf437a981daba849eae02c965ece6c0025c3a46a6cb644",
        "bytes": 41576
      },
      "current": {
        "mode": "100644",
        "blob": "84c53a02aacc4bc762b2c2e2f90fac2db99bdebb",
        "sha256": "acf1de8ef12af7ebccd6048dd2a797f5479fb4fb8f5c5f2157bd7bac7086a685",
        "bytes": 41576
      },
      "inverses": [
        {
          "at": 4455,
          "current": "1fae78103ce52304e84adb8b017ca16cfec3a775d394cddf8523c4117728012f",
          "baseline": "9d8ef3f15ed9141792679808d791b51dd679daf28f9f70768ba9472d3b84cae4"
        }
      ]
    }
  },
  "additions": {
    "test/launch-enterprise-source-transfer.js": {
      "mode": "100644",
      "blob": "fae64e35c518db5aaa2a5d5e335c94598bd71fb0",
      "sha256": "e272c98016d4344ae749dcf0115a63d726db3f0f96369f28ed30c497e180f495",
      "bytes": 10881,
      "text": true
    },
    "test/launch-integration-source-transfer.js": {
      "mode": "100644",
      "blob": "c1c36d3cc6a5747e3602f1599723e899926e0586",
      "sha256": "5dc7526550d2aa58ed3a358378c56d6610efaa7f3148951cfd68535ce5e7721e",
      "bytes": 9549,
      "text": true
    },
    "tools/launch-enterprise-source-data.js": {
      "mode": "100644",
      "blob": "94ec461efd244b9dff650b80399896e7172e1eab",
      "sha256": "2a60c9ab6be9f070599a3a8235cdb158975e460fc08f21211c27b620fb42e28c",
      "bytes": 86702,
      "text": true
    },
    "tools/launch-integration-source-transfer.js": {
      "mode": "100644",
      "blob": "113e817c5ac4f8e96b77742f3a33fbe163e02df7",
      "sha256": "0a5912a1947547730c7fcafa101af54f936cd4d143364b680686a86b86234574",
      "bytes": 17361,
      "text": true
    }
  },
  "scope": "Candidate path/tree pins bind source only. Source review covers only the seven explicit reviewed inputs and exact qualification, enterprise, tooling, workflow and test deltas; no security/runtime/native/financial/deployment/prior-result equivalence for other integration paths."
});
export const LAUNCH_INTEGRATION_SOURCE_SHA256 = '6e3c6dd7d131802423b45bc5a7e71e8108c11e7455e7f4b006a45aec4fc441ea';
