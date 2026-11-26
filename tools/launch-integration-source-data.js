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
    "public/ux-navigation.css"
  ],
  "files": {
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
    "test/grand-strategy-source-transfer.js": {
      "baseline": {
        "mode": "100644",
        "blob": "2dc535d071ef91d76102fa3621d939168967f872",
        "sha256": "ffb2c1407de2e7d6579f5f893b1ca6e3fa4eb22fe2f447be31825f65d4d0c3f6",
        "bytes": 16020
      },
      "current": {
        "mode": "100644",
        "blob": "cddd750f899b3f477c3e1cf7d734b17d38d3a2eb",
        "sha256": "b129d81dbca1822483ab292d2586f8ca29ce261594f09092c65c4418773ff2ab",
        "bytes": 16070
      },
      "inverses": [
        {
          "at": 92,
          "current": "import './launch-integration-source-transfer.js';\n",
          "baseline": ""
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
    }
  },
  "additions": {
    "test/launch-integration-source-transfer.js": {
      "mode": "100644",
      "blob": "ea896e8bebaeb9c718b6d554f8a9ff1a920f46d8",
      "sha256": "90e112b2404ddeabae07eeb78c768a1d142825010e10f11d8f09e76a6af1763e",
      "bytes": 5155,
      "text": true
    },
    "tools/launch-integration-source-transfer.js": {
      "mode": "100644",
      "blob": "c06db8df147674c10ae70095b2aaf2804f1bb529",
      "sha256": "b0b567fd4161c4167ec361448d80a3e25c66032a5d0a4506d29efe3fe36a43d1",
      "bytes": 16041,
      "text": true
    }
  },
  "scope": "Candidate path/tree pins bind source only. Product source review is limited to the explicit3 inputs and exact qualification helper/test deltas; no security/runtime/native/financial/deployment/prior-result equivalence for other integration paths."
});
export const LAUNCH_INTEGRATION_SOURCE_SHA256 = 'a746f2c383c8190a37cbe830f5ff559ac73f9927a31c2d58947de42785f517ce';
