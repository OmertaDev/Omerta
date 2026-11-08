// Exact quest quality source comparison only; no runtime/native/financial/deployment results transferred.
const freeze = value => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const QUEST_QUALITY_SOURCE = freeze({
  "status": "SEALED",
  "phase": "EXACT_QUEST_QUALITY_SOURCE_COMPARISON_ONLY",
  "revision": "aad19e38304c8b11403dd24fc3e83e4f352d9b52",
  "tree": "90e9521528ad8619dcb2fd1ef5b701e26cc8c0e4",
  "predecessor": "84473ac558e501eec1c2fa78067493d4cf0d7741",
  "predecessorTree": "20d4397f23065e084deb3bddc54a4418337d8324",
  "files": {
    ".github/workflows/ci.yml": {
      "current": {
        "mode": "100644",
        "blob": "f964aa2908d28fe4ad4e71012320903bedc081cb",
        "sha256": "e1295d68e45e163fe3390114f593eeba2bf22419f36b14808bce9d85f41a84e5",
        "bytes": 79748
      },
      "baseline": {
        "mode": "100644",
        "blob": "338816d38bd0fbc72fb6097b815a31157e55a4a0",
        "sha256": "21aceab5066f56ac7d0cf8599eaa03b8328ab2d4ce7c8e2a54959d07ec62880c",
        "bytes": 79203
      },
      "inverses": [
        {
          "at": 0,
          "current": "name: ci\npermissions:\n  contents: read\nrun-name: ${{ inputs.tail_only && 'Candidate19 affected CI remainder' || 'ci' }}\n\n# The three gates the codebase already treats as required, run automatically instead of by hand.\n",
          "baseline": "name: ci\nrun-name: ${{ inputs.tail_only && 'Candidate19 affected CI remainder' || 'ci' }}\n\n# The three gates the codebase already treats as required, run automatically instead of by hand.\n"
        },
        {
          "at": 2853,
          "current": "      - run: npm ci\n\n      # Genuine artifact prerequisite; full contract tests remain in forge.yml.\n      - name: Install verified pinned Foundry\n        env:\n          GH_TOKEN: ${{ github.token }}\n        run: |\n          node test/foundry-release-api.js\n          node tools/foundry-release-api.js bootstrap\n      - name: Compile original funded-work escrow artifact\n        run: npm run build:funded-work-artifact\n\n",
          "baseline": "      - run: npm ci\n\n      # Genuine artifact prerequisite; full contract tests remain in forge.yml.\n      - name: Install pinned Foundry 1.7.1\n        timeout-minutes: 5\n        run: node tools/ci-foundry.js\n      - name: Compile original funded-work escrow artifact\n        run: npm run build:funded-work-artifact\n\n"
        },
        {
          "at": 6515,
          "current": "          node-version: '22'\n          cache: npm\n      - run: npm ci\n      - name: Install verified pinned Foundry\n        env:\n          GH_TOKEN: ${{ github.token }}\n        run: |\n          node test/foundry-release-api.js\n          node tools/foundry-release-api.js bootstrap\n      - name: Compile original funded-work escrow artifact\n        run: npm run build:funded-work-artifact\n\n",
          "baseline": "          node-version: '22'\n          cache: npm\n      - run: npm ci\n      - name: Install pinned Foundry 1.7.1\n        timeout-minutes: 5\n        run: node tools/ci-foundry.js\n      - name: Compile original funded-work escrow artifact\n        run: npm run build:funded-work-artifact\n\n"
        },
        {
          "at": 12320,
          "current": "  questing_native:\n    name: Quest authority and concurrency (PostgreSQL)\n    runs-on: ubuntu-latest\n    timeout-minutes: 30\n    services:\n      postgres:\n        image: postgres:18.4\n",
          "baseline": "  questing_native:\n    name: Quest authority and concurrency (PostgreSQL)\n    runs-on: ubuntu-latest\n    timeout-minutes: 15\n    services:\n      postgres:\n        image: postgres:18.4\n"
        },
        {
          "at": 69440,
          "current": "      - run: npm ci\n\n      # Genuine artifact prerequisite; full contract tests remain in forge.yml.\n      - name: Install verified pinned Foundry\n        env:\n          GH_TOKEN: ${{ github.token }}\n        run: |\n          node test/foundry-release-api.js\n          node tools/foundry-release-api.js bootstrap\n      - name: Compile original funded-work escrow artifact\n        run: npm run build:funded-work-artifact\n\n",
          "baseline": "      - run: npm ci\n\n      # Genuine artifact prerequisite; full contract tests remain in forge.yml.\n      - name: Install pinned Foundry 1.7.1\n        timeout-minutes: 5\n        run: node tools/ci-foundry.js\n      - name: Compile original funded-work escrow artifact\n        run: npm run build:funded-work-artifact\n\n"
        },
        {
          "at": 74888,
          "current": "      - run: npm ci\n\n      # Genuine artifact prerequisite; full contract tests remain in forge.yml.\n      - name: Install verified pinned Foundry\n        env:\n          GH_TOKEN: ${{ github.token }}\n        run: |\n          node test/foundry-release-api.js\n          node tools/foundry-release-api.js bootstrap\n      - name: Compile original funded-work escrow artifact\n        run: npm run build:funded-work-artifact\n\n",
          "baseline": "      - run: npm ci\n\n      # Genuine artifact prerequisite; full contract tests remain in forge.yml.\n      - name: Install pinned Foundry 1.7.1\n        timeout-minutes: 5\n        run: node tools/ci-foundry.js\n      - name: Compile original funded-work escrow artifact\n        run: npm run build:funded-work-artifact\n\n"
        },
        {
          "at": 77864,
          "current": "      - run: npm ci\n\n      # Genuine artifact prerequisite; full contract tests remain in forge.yml.\n      - name: Install verified pinned Foundry\n        env:\n          GH_TOKEN: ${{ github.token }}\n        run: |\n          node test/foundry-release-api.js\n          node tools/foundry-release-api.js bootstrap\n      - name: Compile original funded-work escrow artifact\n        run: npm run build:funded-work-artifact\n\n",
          "baseline": "      - run: npm ci\n\n      # Genuine artifact prerequisite; full contract tests remain in forge.yml.\n      - name: Install pinned Foundry 1.7.1\n        timeout-minutes: 5\n        run: node tools/ci-foundry.js\n      - name: Compile original funded-work escrow artifact\n        run: npm run build:funded-work-artifact\n\n"
        }
      ]
    },
    ".github/workflows/forge.yml": {
      "current": {
        "mode": "100644",
        "blob": "35f4447c4ed16469dab2b5b79d5cbb18c7f7a69e",
        "sha256": "4d4414429d5d289da3ba02699ecbc8b012247df4e00802280c3ecd1c55799f76",
        "bytes": 13053
      },
      "baseline": {
        "mode": "100644",
        "blob": "5b9f629f53efc96da3991572d49b52d332c48ab0",
        "sha256": "e97eb70c6e22fc816815f425afc1a5408e42aac7b98e0393f2f4ed3249eadfb4",
        "bytes": 12684
      },
      "inverses": [
        {
          "at": 0,
          "current": "name: forge test (contracts)\npermissions:\n  contents: read\n\n# The pre-mainnet gate the sandboxed build environment can't run (Foundry's release binaries are\n# egress-blocked there). GitHub's runners have open internet, so `forge test` — the OMERTÀ Solidity\n",
          "baseline": "name: forge test (contracts)\n\n# The pre-mainnet gate the sandboxed build environment can't run (Foundry's release binaries are\n# egress-blocked there). GitHub's runners have open internet, so `forge test` — the OMERTÀ Solidity\n"
        },
        {
          "at": 559,
          "current": "    paths:\n      - 'omerta-contracts/**'\n      - '.github/workflows/forge.yml'\n      - 'tools/foundry-release-api.js'\n      - 'test/foundry-release-api.js'\n      - 'src/dexbot.js'                # the v4 encodings the fork prover below executes\n      - 'tools/dexbot-e2e.js'\n      - 'src/stockdeliver.js'          # the 6551 + StockVault legs the second prover executes\n",
          "baseline": "    paths:\n      - 'omerta-contracts/**'\n      - '.github/workflows/forge.yml'\n      - 'src/dexbot.js'                # the v4 encodings the fork prover below executes\n      - 'tools/dexbot-e2e.js'\n      - 'src/stockdeliver.js'          # the 6551 + StockVault legs the second prover executes\n"
        },
        {
          "at": 1863,
          "current": "    paths:\n      - 'omerta-contracts/**'\n      - '.github/workflows/forge.yml'\n      - 'tools/foundry-release-api.js'\n      - 'test/foundry-release-api.js'\n      - 'src/dexbot.js'\n      - 'tools/dexbot-e2e.js'\n      - 'src/stockdeliver.js'\n",
          "baseline": "    paths:\n      - 'omerta-contracts/**'\n      - '.github/workflows/forge.yml'\n      - 'src/dexbot.js'\n      - 'tools/dexbot-e2e.js'\n      - 'src/stockdeliver.js'\n"
        },
        {
          "at": 4115,
          "current": "      # sibling. A moving compiler means a red gate cannot be reproduced locally, which is exactly the\n      # position this gate was in. The banner is the instrument: when local and CI disagree again, the\n      # log answers \"which forge ran this\" instead of leaving it to be guessed at.\n      - uses: actions/setup-node@v7\n        with:\n          node-version: '22'\n          cache: npm\n      - name: Install Foundry\n        env:\n          GH_TOKEN: ${{ github.token }}\n        run: |\n          node ../test/foundry-release-api.js\n          node ../tools/foundry-release-api.js bootstrap\n\n      - name: forge --version (what actually ran)\n        working-directory: omerta-contracts\n",
          "baseline": "      # sibling. A moving compiler means a red gate cannot be reproduced locally, which is exactly the\n      # position this gate was in. The banner is the instrument: when local and CI disagree again, the\n      # log answers \"which forge ran this\" instead of leaving it to be guessed at.\n      - name: Install Foundry\n        uses: foundry-rs/foundry-toolchain@v1\n        with:\n          version: v1.7.1\n\n      - name: forge --version (what actually ran)\n        working-directory: omerta-contracts\n"
        }
      ]
    },
    "SPEC.md": {
      "current": {
        "mode": "100644",
        "blob": "1101d1af510d3c96067eb3635be09e3bc8743990",
        "sha256": "fa4d66f93bcbbaf3362eaced1fd86859694e5bcd3285bfb50fd8ea88efe10362",
        "bytes": 57266
      },
      "baseline": {
        "mode": "100644",
        "blob": "84f48d51a9221c6cea2c3f55ca4a2bfdab71fc28",
        "sha256": "36ca0f670daa8946a36715efe2385c5df1e406f502c4ae4259aefba6b1aa8984",
        "bytes": 57155
      },
      "inverses": [
        {
          "at": 318,
          "current": "\nCounts were measured for the combined release source on 2026-11-07, before generated release records; they do not identify a deployed revision.\n\nFile counts include the quest-quality additions as of 2026-11-08. Line totals retain the 2026-11-07 snapshot.\n\n| | |\n|---|---|\n| Backend modules | **617** files, **141073** lines (recursive source inventory) |\n| Test suites | **1023** files, **213491** lines (recursive source inventory) |\n| HTTP routes | **1386** registrations (**1386** unique; 1274 under `/v1`) |\n| Database tables | **585** (`schema.sql`, 9820 lines) |\n| Client | **14683** lines in `public/index.html`; tabbed game interface with locally served Fieldwork and player guidance modules |\n| Ops dashboard + wiki | `public/admin.html`, `public/wiki.html` |\n| Smart contracts | **41** top-level Solidity files, **11590** lines, **1125** declared top-level Foundry test functions; the release gate re-measures the passing suite |\n| Harnesses | `tools/sim.js` (economy), `tools/playthrough.js` (player experience), `tools/pgcheck.js` (real Postgres), `tools/loadtest.js` (concurrency), `tools/chaos.js` (interruption), `tools/mobile.js` (the screens, at phone size), `tools/scale.js` (market liquidity at population scale), `tools/keeper-dials.js` (sizing the stock keeper's price-continuity wall), `tools/pgquery.js` (every SQL string parses on real Postgres), `tools/concurrency.js` (lost-update correctness on real Postgres), `tools/arena.js` (a population of EV-optimizing strategies against the live economy), `tools/arena-sweep.js` (N runs × `--reps` replicates per arena arm, read as a distribution — disjoint ranges only) |\n| Design + audit docs | **986** markdown files, **158083** lines — dated security evidence is indexed in `docs/AUDITS.md` |\n| Ledger invariants | **133** checks — **127** named escrow/identity/custody/definition-registry checks + **6** per-currency conservation, **drift-0** |\n\nRoughly **369,000 lines** of backend code, tests, schema and top-level contracts.\n",
          "baseline": "\nCounts were measured for the combined release source on 2026-11-07, before generated release records; they do not identify a deployed revision.\n\n| | |\n|---|---|\n| Backend modules | **613** files, **141073** lines (recursive source inventory) |\n| Test suites | **1009** files, **213491** lines (recursive source inventory) |\n| HTTP routes | **1386** registrations (**1386** unique; 1274 under `/v1`) |\n| Database tables | **585** (`schema.sql`, 9820 lines) |\n| Client | **14683** lines in `public/index.html`; tabbed game interface with locally served Fieldwork and player guidance modules |\n| Ops dashboard + wiki | `public/admin.html`, `public/wiki.html` |\n| Smart contracts | **41** top-level Solidity files, **11590** lines, **1125** declared top-level Foundry test functions; the release gate re-measures the passing suite |\n| Harnesses | `tools/sim.js` (economy), `tools/playthrough.js` (player experience), `tools/pgcheck.js` (real Postgres), `tools/loadtest.js` (concurrency), `tools/chaos.js` (interruption), `tools/mobile.js` (the screens, at phone size), `tools/scale.js` (market liquidity at population scale), `tools/keeper-dials.js` (sizing the stock keeper's price-continuity wall), `tools/pgquery.js` (every SQL string parses on real Postgres), `tools/concurrency.js` (lost-update correctness on real Postgres), `tools/arena.js` (a population of EV-optimizing strategies against the live economy), `tools/arena-sweep.js` (N runs × `--reps` replicates per arena arm, read as a distribution — disjoint ranges only) |\n| Design + audit docs | **983** markdown files, **158083** lines — dated security evidence is indexed in `docs/AUDITS.md` |\n| Ledger invariants | **133** checks — **127** named escrow/identity/custody/definition-registry checks + **6** per-currency conservation, **drift-0** |\n\nRoughly **369,000 lines** of backend code, tests, schema and top-level contracts.\n"
        }
      ]
    },
    "package.json": {
      "current": {
        "mode": "100644",
        "blob": "cf4b7cd7f19c1dd09ae8b5d2fc64ea643772ebd7",
        "sha256": "c617aac24c9a805092fc1942c000364cffc95e65df7c861bc03208732cb132c0",
        "bytes": 63302
      },
      "baseline": {
        "mode": "100644",
        "blob": "978b81602db7fe05924f10b24070c7e2f61253a5",
        "sha256": "920e01c32eea446f361544a851fca7105c567f8fa56328704ad280b31d441368",
        "bytes": 62496
      },
      "inverses": [
        {
          "at": 3790,
          "current": "    \"test:coordination:postgres\": \"node test/coordination.js --postgres && node test/coordination-knowledge-runtime.js --postgres && node test/coordination-knowledge-postgres.js\",\n    \"start\": \"node src/server.js\",\n    \"worker\": \"node src/worker.js\",\n    \"pretest\": \"npm run test:foundry-release-api && npm run test:economy-ux-source && npm run test:agent-economy-commerce && node test/deed-market-source-compatibility.js && npm run test:deed-discovery && node test/deed-quest-source-compatibility.js && npm run test:agent-economy-enterprise && npm run test:business-desk && npm run test:business-desk:provenance && npm run test:agent-economy-market-operations && npm run test:agent-economy-next-layer && npm run test:agent-economy-next-five && npm run test:equipment-economy && node test/rc1-first-batch-source-compatibility.js && node test/companyproduction.js && node test/companyspecialization.js && node test/itemdurability.js && node test/itemdurability-quality.js && node test/companydemand.js && node test/companyforecast.js && node test/companyproduction-integration.js && node test/company-economy-contracts.js && node test/player-intel-source-compatibility.js && node test/commercialpremises.js && node test/commercialpremises-integration.js && node test/rc1-commercial-premises-source-compatibility.js && node test/companybankportfolios.js && node test/companybankportfolio-integration.js && node test/rc1-company-bank-source-compatibility.js && node test/companylogisticshubs.js && node test/companylogisticshubs-integration.js && node test/rc1-company-logistics-hub-source-compatibility.js && node test/buyercooperatives.js && node test/buyercooperative-integration.js && node test/rc1-buyer-cooperative-source-compatibility.js && node test/companyopportunities.js && node test/companyopportunity-integration.js && node test/rc1-company-opportunity-source-compatibility.js && node test/commercialreputation.js && node test/commercialreputation-integration.js && node test/rc1-commercial-reputation-source-compatibility.js && node test/businessseasons.js && node test/businessseason-integration.js && node test/rc1-business-season-source-compatibility.js && node test/rc1-game-employment-source-compatibility.js && node test/rc1-company-workflow-source-compatibility.js && node test/companyopportunities-api.js && node test/commercialreputation-api.js && node test/businessseasons-api.js && node test/companyworkflows.js && node test/companyworkflow-integration.js && node test/gameemployment.js && node test/gameemployment-integration.js && node test/companyoperatorrunner.js && node test/rc1-company-operator-source-compatibility.js && node test/companyoperators.js && node test/companyoperators-api.js && node test/storefrontfulfillment.js && node test/storefront-fulfillment-api.js && node test/courierjobs.js && node test/supplycontracts.js && node test/supplycontracts-api.js && node test/earningreceipts.js && node test/resource-deliver.js && node test/identity-checkout.js && node test/identity-checkout-client.js && node test/identity-checkout-api.js && node test/current-copy.js && node test/operation-read-paths.js && node test/world-projection-mysteries.js && node test/world-projection-mysteries-api.js && node test/world-projection-read.js && node test/world-projection.js && node test/world-projection-api.js && node test/projection-events.js && node test/projection-events-ws.js && node test/world-projection-client.js && node test/coordination-operation-definitions.js && node test/coordination-mode-boundary.js && node test/coordination-capital.js && node test/coordination-materials.js && node test/coordination-knowledge-proof.js && node test/world-kernel-transaction.js && node test/family-operations.js && node test/family-operations-api.js && node test/world-knowledge-crafting.js && node test/world-kernel-query.js && node test/world-kernel-input.js && node test/world-kernel.js && node test/world-kernel-api.js && node test/coordination-graph.js && node test/coordination.js && node test/coordination-api.js && node test/coordination-http-receipts.js && node test/coordination-knowledge.js && node test/coordination-knowledge-runtime.js && node test/coordination-knowledge-api.js && node test/finalizedobservation.js && node test/stockballotv2.js && node test/rwanominations.js && node test/rwaroutes.js && node test/rwahealth.js && node test/rwahealth.integration.js && node test/rwahealthclearance.js && node test/rwahealthclearancecontext.js && node test/rwahealthoverlay.readiness.js && node test/rwahealthoverlay.schema.js && node test/rwahealthoverlay.vector.js && node test/rwaregistrylifecycle.js && node test/rwaregistrylifecycle.sync.js && node test/agent-referral-cash.js && node test/phase2-discovery.js && node test/phase2-compiler.js && node test/phase2-review-regressions.js && node test/phase2-scale.js && node test/content-graph.js && node test/content-runtime.js && node test/content-social.js && node test/content-seasonal.js && node test/content-seasonal-case.js && node test/content-crafting.js && node test/content-crafting-jobs.js && node test/content-crafting-tools.js && node test/content-exchange.js && node test/content-api.js && node test/v4oraclekeeper.js && node test/genesiscca.js && node test/genesislaunch.js && node test/genesisrelease.js && node test/worldgraph.js && node test/worldgraph-validation.js && node test/items.js && node test/crafting.js && node test/mysteries.js && node test/operations.js && node test/belladonna.js && node test/worldgraph-api.js && node test/city-rpg.js && node tools/pgcheck-belladonna.js --pg-mem && node test/phase2-definition-schema.js && node test/phase2-definitions.js && node test/phase2-activation.js && node test/phase2-definition-invariants.js && node test/phase2-lot-boundary.js && node test/keepertransactions.js && node test/liquiditykeeper.js && node test/genesiskeeper.js && node test/liquidityaccounting.js --memory && node test/liquidityaccounting-review.js && node test/liquiditypolicy.js --memory && node test/bond-unlimited.js --memory && node test/bondquoteexpiry.js && node test/liquidityrpc.js && node tools/liquidity-manifest-example.js --self-test && node test/liquiditypolicy-review.js && node test/liquidityqueue.js --memory && node test/liquidityqueue-review.js && node test/character-mint-policy.js && node test/phase2-lots.js && node test/phase2-lots-property.js && node test/audit/mint-dev-allocation.js --memory && node test/audit/deed-reimport-order.js --memory && node test/progression-admission.js && node test/world-prerequisites.js && node test/recipe-policy.js && node test/furnace-ledger.js && node test/core-progression-api.js && node test/player-commands.js && node test/player-command-journey.js && node test/player-command-api.js && node test/player-command-client.js && node test/director-definitions.js && node test/director-config.js && node test/director-runtime.js && node test/director-recovery.js && node test/director-dock-world.js && node test/director-commands.js && node test/director-api.js && node test/director-journey.js && node test/director-security.js && node test/director-simulation.js && node test/director-network.js && node test/campaign-network-journey.js && node test/director-network-recovery.js && node test/player-opportunities.js && node test/world-consequences.js && node test/rc1-city-gameplay-source-compatibility.js && npm run test:gateway && npm run test:legal-security && npm run test:release-source-transfer && node test/wiki-media-source-transfer.js && node test/age21-source-transfer.js && node test/ci-deed-recovery-source.js\",\n    \"phase2:definitions:check\": \"node test/phase2-definition-schema.js && node test/phase2-definitions.js && node test/phase2-activation.js && node test/phase2-definition-invariants.js\",\n    \"phase2:lots:check\": \"node test/phase2-lot-boundary.js && node test/phase2-lots.js && node test/phase2-lots-property.js\",\n    \"phase2:lots:postgres\": \"node test/phase2-postgres.js --lots\",\n",
          "baseline": "    \"test:coordination:postgres\": \"node test/coordination.js --postgres && node test/coordination-knowledge-runtime.js --postgres && node test/coordination-knowledge-postgres.js\",\n    \"start\": \"node src/server.js\",\n    \"worker\": \"node src/worker.js\",\n    \"pretest\": \"npm run test:economy-ux-source && npm run test:agent-economy-commerce && node test/deed-market-source-compatibility.js && npm run test:deed-discovery && node test/deed-quest-source-compatibility.js && npm run test:agent-economy-enterprise && npm run test:business-desk && npm run test:business-desk:provenance && npm run test:agent-economy-market-operations && npm run test:agent-economy-next-layer && npm run test:agent-economy-next-five && npm run test:equipment-economy && node test/rc1-first-batch-source-compatibility.js && node test/companyproduction.js && node test/companyspecialization.js && node test/itemdurability.js && node test/itemdurability-quality.js && node test/companydemand.js && node test/companyforecast.js && node test/companyproduction-integration.js && node test/company-economy-contracts.js && node test/player-intel-source-compatibility.js && node test/commercialpremises.js && node test/commercialpremises-integration.js && node test/rc1-commercial-premises-source-compatibility.js && node test/companybankportfolios.js && node test/companybankportfolio-integration.js && node test/rc1-company-bank-source-compatibility.js && node test/companylogisticshubs.js && node test/companylogisticshubs-integration.js && node test/rc1-company-logistics-hub-source-compatibility.js && node test/buyercooperatives.js && node test/buyercooperative-integration.js && node test/rc1-buyer-cooperative-source-compatibility.js && node test/companyopportunities.js && node test/companyopportunity-integration.js && node test/rc1-company-opportunity-source-compatibility.js && node test/commercialreputation.js && node test/commercialreputation-integration.js && node test/rc1-commercial-reputation-source-compatibility.js && node test/businessseasons.js && node test/businessseason-integration.js && node test/rc1-business-season-source-compatibility.js && node test/rc1-game-employment-source-compatibility.js && node test/rc1-company-workflow-source-compatibility.js && node test/companyopportunities-api.js && node test/commercialreputation-api.js && node test/businessseasons-api.js && node test/companyworkflows.js && node test/companyworkflow-integration.js && node test/gameemployment.js && node test/gameemployment-integration.js && node test/companyoperatorrunner.js && node test/rc1-company-operator-source-compatibility.js && node test/companyoperators.js && node test/companyoperators-api.js && node test/storefrontfulfillment.js && node test/storefront-fulfillment-api.js && node test/courierjobs.js && node test/supplycontracts.js && node test/supplycontracts-api.js && node test/earningreceipts.js && node test/resource-deliver.js && node test/identity-checkout.js && node test/identity-checkout-client.js && node test/identity-checkout-api.js && node test/current-copy.js && node test/operation-read-paths.js && node test/world-projection-mysteries.js && node test/world-projection-mysteries-api.js && node test/world-projection-read.js && node test/world-projection.js && node test/world-projection-api.js && node test/projection-events.js && node test/projection-events-ws.js && node test/world-projection-client.js && node test/coordination-operation-definitions.js && node test/coordination-mode-boundary.js && node test/coordination-capital.js && node test/coordination-materials.js && node test/coordination-knowledge-proof.js && node test/world-kernel-transaction.js && node test/family-operations.js && node test/family-operations-api.js && node test/world-knowledge-crafting.js && node test/world-kernel-query.js && node test/world-kernel-input.js && node test/world-kernel.js && node test/world-kernel-api.js && node test/coordination-graph.js && node test/coordination.js && node test/coordination-api.js && node test/coordination-http-receipts.js && node test/coordination-knowledge.js && node test/coordination-knowledge-runtime.js && node test/coordination-knowledge-api.js && node test/finalizedobservation.js && node test/stockballotv2.js && node test/rwanominations.js && node test/rwaroutes.js && node test/rwahealth.js && node test/rwahealth.integration.js && node test/rwahealthclearance.js && node test/rwahealthclearancecontext.js && node test/rwahealthoverlay.readiness.js && node test/rwahealthoverlay.schema.js && node test/rwahealthoverlay.vector.js && node test/rwaregistrylifecycle.js && node test/rwaregistrylifecycle.sync.js && node test/agent-referral-cash.js && node test/phase2-discovery.js && node test/phase2-compiler.js && node test/phase2-review-regressions.js && node test/phase2-scale.js && node test/content-graph.js && node test/content-runtime.js && node test/content-social.js && node test/content-seasonal.js && node test/content-seasonal-case.js && node test/content-crafting.js && node test/content-crafting-jobs.js && node test/content-crafting-tools.js && node test/content-exchange.js && node test/content-api.js && node test/v4oraclekeeper.js && node test/genesiscca.js && node test/genesislaunch.js && node test/genesisrelease.js && node test/worldgraph.js && node test/worldgraph-validation.js && node test/items.js && node test/crafting.js && node test/mysteries.js && node test/operations.js && node test/belladonna.js && node test/worldgraph-api.js && node test/city-rpg.js && node tools/pgcheck-belladonna.js --pg-mem && node test/phase2-definition-schema.js && node test/phase2-definitions.js && node test/phase2-activation.js && node test/phase2-definition-invariants.js && node test/phase2-lot-boundary.js && node test/keepertransactions.js && node test/liquiditykeeper.js && node test/genesiskeeper.js && node test/liquidityaccounting.js --memory && node test/liquidityaccounting-review.js && node test/liquiditypolicy.js --memory && node test/bond-unlimited.js --memory && node test/bondquoteexpiry.js && node test/liquidityrpc.js && node tools/liquidity-manifest-example.js --self-test && node test/liquiditypolicy-review.js && node test/liquidityqueue.js --memory && node test/liquidityqueue-review.js && node test/character-mint-policy.js && node test/phase2-lots.js && node test/phase2-lots-property.js && node test/audit/mint-dev-allocation.js --memory && node test/audit/deed-reimport-order.js --memory && node test/progression-admission.js && node test/world-prerequisites.js && node test/recipe-policy.js && node test/furnace-ledger.js && node test/core-progression-api.js && node test/player-commands.js && node test/player-command-journey.js && node test/player-command-api.js && node test/player-command-client.js && node test/director-definitions.js && node test/director-config.js && node test/director-runtime.js && node test/director-recovery.js && node test/director-dock-world.js && node test/director-commands.js && node test/director-api.js && node test/director-journey.js && node test/director-security.js && node test/director-simulation.js && node test/director-network.js && node test/campaign-network-journey.js && node test/director-network-recovery.js && node test/player-opportunities.js && node test/world-consequences.js && node test/rc1-city-gameplay-source-compatibility.js && npm run test:gateway && npm run test:legal-security && npm run test:release-source-transfer && node test/wiki-media-source-transfer.js && node test/age21-source-transfer.js && node test/ci-deed-recovery-source.js\",\n    \"phase2:definitions:check\": \"node test/phase2-definition-schema.js && node test/phase2-definitions.js && node test/phase2-activation.js && node test/phase2-definition-invariants.js\",\n    \"phase2:lots:check\": \"node test/phase2-lot-boundary.js && node test/phase2-lots.js && node test/phase2-lots-property.js\",\n    \"phase2:lots:postgres\": \"node test/phase2-postgres.js --lots\",\n"
        },
        {
          "at": 61053,
          "current": "    \"test:economy-security\": \"node test/economy-monitor.js && node test/economy-composition.js\",\n    \"test:eth-rewards\": \"node test/marketv2abi.js && node test/marketv2keeper-eth.js && node test/eth-rewards-readiness.js && node test/eth-rewards-upkeep.js && node test/ethrewardsworker.js && node test/eth-staking.js\",\n    \"test:eth-staking:browser\": \"node test/eth-staking.js --browser\",\n    \"test:questing\": \"node test/content-narrative.js && node test/content-narrative-security.js && node test/content-casework.js && node test/quest-saga.js && node test/quest-saga-social.js && node test/quest-specialist.js && node test/quest-workshop.js && node test/clue-puzzles.js && node test/content-api.js && npm run test:quest-quality\",\n    \"test:questing:browser\": \"node test/quest-experience-browser.js && node test/clue-puzzles-browser.js && node test/quest-quality-browser.js\",\n    \"questing:check\": \"node tools/questing-content.js check && node tools/questing-workgraph.js check --complete && node tools/quest-quality-workgraph.js check\",\n    \"test:questing:postgres\": \"node test/questing-postgres.js && node test/quest-quality-postgres.js\",\n    \"test:quest-quality\": \"node test/quest-quality-source-transfer.js && node test/quest-quality-rules.js && node test/quest-quality-stateful.js && node test/quest-quality-api.js && node test/quest-quality-runtime.js && node test/quest-quality-social.js && node test/quest-quality-spoilers.js && node test/quest-quality-content.js && node test/quest-quality-studio.js && node test/quest-quality-study.js\",\n    \"quest-quality:verify\": \"node tools/quest-quality-workgraph.js verify\",\n    \"quest-quality:studio\": \"node tools/quest-quality-studio.js\",\n    \"test:foundry-release-api\": \"node test/foundry-release-api.js\"\n  },\n  \"dependencies\": {\n    \"@fastify/jwt\": \"^10.2.0\",\n",
          "baseline": "    \"test:economy-security\": \"node test/economy-monitor.js && node test/economy-composition.js\",\n    \"test:eth-rewards\": \"node test/marketv2abi.js && node test/marketv2keeper-eth.js && node test/eth-rewards-readiness.js && node test/eth-rewards-upkeep.js && node test/ethrewardsworker.js && node test/eth-staking.js\",\n    \"test:eth-staking:browser\": \"node test/eth-staking.js --browser\",\n    \"test:questing\": \"node test/content-narrative.js && node test/content-narrative-security.js && node test/content-casework.js && node test/quest-saga.js && node test/quest-saga-social.js && node test/quest-specialist.js && node test/quest-workshop.js && node test/clue-puzzles.js && node test/content-api.js\",\n    \"test:questing:browser\": \"node test/quest-experience-browser.js && node test/clue-puzzles-browser.js\",\n    \"questing:check\": \"node tools/questing-content.js check && node tools/questing-workgraph.js check --complete\",\n    \"test:questing:postgres\": \"node test/questing-postgres.js\"\n  },\n  \"dependencies\": {\n    \"@fastify/jwt\": \"^10.2.0\",\n"
        }
      ]
    },
    "public/index.html": {
      "current": {
        "mode": "100644",
        "blob": "87001f9c2f12ca5357dad2beec721c143a9db391",
        "sha256": "bff35121e60ff9e88c8cda3b9ee326a858aca60c54b04a21b246f0c7b3f7b9a6",
        "bytes": 1408520
      },
      "baseline": {
        "mode": "100644",
        "blob": "db8787f55081cb2a5029282c07d157e3f19e2562",
        "sha256": "6d77cf17288457e8cc6efcf911f4fe2d72d4d4355c6bcc912a9e9be82d3ddc2d",
        "bytes": 1407584
      },
      "inverses": [
        {
          "at": 106582,
          "current": "<link rel=\"stylesheet\" href=\"/ux-identity.css?v=20261025-1\">\n<link rel=\"stylesheet\" href=\"/ux-story.css?v=20261025-1\">\n<link rel=\"stylesheet\" href=\"/ux-quests.css?v=20261106-1\">\n<link rel=\"stylesheet\" href=\"/ux-quest-quality.css?v=20261107-1\">\n<link rel=\"stylesheet\" href=\"/ux-clues.css?v=20261106-1\">\n<link rel=\"stylesheet\" href=\"/ux-community.css?v=20261025-1\">\n<link rel=\"stylesheet\" href=\"/ux-tactics.css?v=20261024-2\">\n",
          "baseline": "<link rel=\"stylesheet\" href=\"/ux-identity.css?v=20261025-1\">\n<link rel=\"stylesheet\" href=\"/ux-story.css?v=20261025-1\">\n<link rel=\"stylesheet\" href=\"/ux-quests.css?v=20261106-1\">\n<link rel=\"stylesheet\" href=\"/ux-clues.css?v=20261106-1\">\n<link rel=\"stylesheet\" href=\"/ux-community.css?v=20261025-1\">\n<link rel=\"stylesheet\" href=\"/ux-tactics.css?v=20261024-2\">\n"
        },
        {
          "at": 157636,
          "current": "<script src=\"/ux-tools.js?v=20261025-1\"></script>\n<script src=\"/ux-identity.js?v=20261025-1\"></script>\n<script src=\"/ux-story.js?v=20261025-1\"></script>\n<script src=\"/ux-quest-quality.js?v=20261107-1\"></script>\n<script src=\"/ux-quests.js?v=20261107-1\"></script>\n<script src=\"/ux-clues.js?v=20261106-1\"></script>\n<script src=\"/ux-community.js?v=20261025-1\"></script>\n<script src=\"/ux-tactics.js?v=20261105-noir-release\"></script>\n",
          "baseline": "<script src=\"/ux-tools.js?v=20261025-1\"></script>\n<script src=\"/ux-identity.js?v=20261025-1\"></script>\n<script src=\"/ux-story.js?v=20261025-1\"></script>\n<script src=\"/ux-quests.js?v=20261106-1\"></script>\n<script src=\"/ux-clues.js?v=20261106-1\"></script>\n<script src=\"/ux-community.js?v=20261025-1\"></script>\n<script src=\"/ux-tactics.js?v=20261105-noir-release\"></script>\n"
        },
        {
          "at": 240396,
          "current": "    if (Array.isArray(body?.claimed) && body.instance)\n      return `case record claimed: ${body.claimed.map((item) => txt(item.title || item.kind)).join(', ') || 'filed'}`;\n    if (body?.instance?.namespace && body.instance?.title) {\n      if (body.instance.quality) return `case file updated: ${txt(body.instance.title)}. Review your recorded changes in the investigation workbench.`;\n      if (body.instance.status === 'completed') return `case closed: ${txt(body.instance.title)}. Your ending is on the permanent record.`;\n      if (body.instance.status === 'active') return `case advanced: ${txt(body.instance.title)}. The next issued move is on the Desk.`;\n      return `party file updated: ${txt(body.instance.title)}. ${body.instance.members?.length || 1} seat${body.instance.members?.length === 1 ? '' : 's'} filled.`;\n",
          "baseline": "    if (Array.isArray(body?.claimed) && body.instance)\n      return `case record claimed: ${body.claimed.map((item) => txt(item.title || item.kind)).join(', ') || 'filed'}`;\n    if (body?.instance?.namespace && body.instance?.title) {\n      if (body.instance.status === 'completed') return `case closed: ${txt(body.instance.title)}. Your ending is on the permanent record.`;\n      if (body.instance.status === 'active') return `case advanced: ${txt(body.instance.title)}. The next issued move is on the Desk.`;\n      return `party file updated: ${txt(body.instance.title)}. ${body.instance.members?.length || 1} seat${body.instance.members?.length === 1 ? '' : 's'} filled.`;\n"
        },
        {
          "at": 711190,
          "current": "    </li>`).join('')}</ol>`;\n  }\n  function deskIssuedActions(instance) {\n    if (instance.quality && instance.status !== 'forming') return `<section class=\"desk-prompt\"><span class=\"desk-kicker\">Investigation workbench</span><h3>Review your reasoning before committing.</h3><p>Your private drafts, evidence and decision previews are in the case file below.</p><button class=\"act prime\" type=\"button\" data-desk-quality-case=\"${esc(instance.id)}\">Open investigation workbench</button></section>`;\n    const actions = deskList(instance.actions);\n    if (!actions.length) return instance.status === 'active'\n      ? `<div class=\"desk-empty desk-empty--compact\"><b>No move is issued to you.</b><span>Another party role may need to act before this file advances.</span></div>` : '';\n",
          "baseline": "    </li>`).join('')}</ol>`;\n  }\n  function deskIssuedActions(instance) {\n    const actions = deskList(instance.actions);\n    if (!actions.length) return instance.status === 'active'\n      ? `<div class=\"desk-empty desk-empty--compact\"><b>No move is issued to you.</b><span>Another party role may need to act before this file advances.</span></div>` : '';\n"
        },
        {
          "at": 737871,
          "current": "    const board = deskState.board;\n    if (!panel) return;\n    panel.querySelectorAll('[data-desk-reload]').forEach((button) => { button.onclick = () => reloadContentDesk(); });\n    panel.querySelectorAll('[data-desk-quality-case]').forEach((button) => {\n      button.onclick = () => document.dispatchEvent(new CustomEvent('omerta:quality-case', { detail: { instanceId: button.dataset.deskQualityCase } }));\n    });\n    panel.querySelectorAll('[data-desk-view]').forEach((button) => {\n      button.onclick = () => { deskState.view = button.dataset.deskView; drawContentDesk(); };\n    });\n",
          "baseline": "    const board = deskState.board;\n    if (!panel) return;\n    panel.querySelectorAll('[data-desk-reload]').forEach((button) => { button.onclick = () => reloadContentDesk(); });\n    panel.querySelectorAll('[data-desk-view]').forEach((button) => {\n      button.onclick = () => { deskState.view = button.dataset.deskView; drawContentDesk(); };\n    });\n"
        }
      ]
    },
    "public/ux-quests.js": {
      "current": {
        "mode": "100644",
        "blob": "1cb9e732213969d865c8bf066eff0804097521fd",
        "sha256": "95cb6d48231ca048d42ef10da09a4c1788522502c20af57fea1f723ef90ee367",
        "bytes": 47597
      },
      "baseline": {
        "mode": "100644",
        "blob": "fa4a4be6be42abc15d7f194cc3a1b602e1cab46e",
        "sha256": "43914e40ef8fded506b65f7bacdc8a1621c38137bf77fc3a9da4064a00ca51e5",
        "bytes": 44781
      },
      "inverses": [
        {
          "at": 1729,
          "current": "    const districtTabs = new Set(['streets', 'city', 'map', 'fieldwork']);\n    const pending = new Map(), local = new Map(), openSections = new Set(), interactionDrafts = new Map();\n    const state = () => getState() || {};\n    const qualityUX = window.createOmertaQuestQuality?.({ getState,\n      onOperation: (instance, payload, label) => mutate('/v1/content/instances/' + encode(instance.id) + '/quality', {\n        expectedRevision: instance.revision, expectedQualityRevision: instance.quality.revision, ...payload,\n      }, label), onSubmit: submitAction, repaint: focused => paint(true, focused) });\n    const identity = () => [String(state().session?.accountId || state().me?.accountId || ''), String(state().me?.id || '')];\n    const saved = () => workspace?.get('quests', {}) || local.get(owner) || {};\n    const save = patch => { const next = { ...saved(), ...patch }; local.set(owner, next); workspace?.set('quests', next); };\n",
          "baseline": "    const districtTabs = new Set(['streets', 'city', 'map', 'fieldwork']);\n    const pending = new Map(), local = new Map(), openSections = new Set(), interactionDrafts = new Map();\n    const state = () => getState() || {};\n    const identity = () => [String(state().session?.accountId || state().me?.accountId || ''), String(state().me?.id || '')];\n    const saved = () => workspace?.get('quests', {}) || local.get(owner) || {};\n    const save = patch => { const next = { ...saved(), ...patch }; local.set(owner, next); workspace?.set('quests', next); };\n"
        },
        {
          "at": 2735,
          "current": "      if (next !== owner || character !== actor) {\n        owner = next; actor = character; epoch++; board = workshop = legacy = mystery = null; selected = ''; view = 'cases';\n        loading = busy = false; error = ''; legacyReadAt = districtAttemptAt = 0; requestedCase = ''; pending.clear(); openSections.clear(); interactionDrafts.clear(); root?.remove(); root = null; districtRoot?.remove(); districtRoot = null;\n        qualityUX?.reset();\n      }\n      return !!owner && !!actor && !destroyed;\n    }\n",
          "baseline": "      if (next !== owner || character !== actor) {\n        owner = next; actor = character; epoch++; board = workshop = legacy = mystery = null; selected = ''; view = 'cases';\n        loading = busy = false; error = ''; legacyReadAt = districtAttemptAt = 0; requestedCase = ''; pending.clear(); openSections.clear(); interactionDrafts.clear(); root?.remove(); root = null; districtRoot?.remove(); districtRoot = null;\n      }\n      return !!owner && !!actor && !destroyed;\n    }\n"
        },
        {
          "at": 19558,
          "current": "    function runFile(instance) {\n      const root = el('div', 'quest-run'); root.dataset.questInstance = instance.id;\n      root.append(recap(instance));\n      if (instance.quality) { const workbench = qualityUX?.render(instance); if (workbench) root.append(workbench); }\n      if (instance.agenda?.prompt) { const agenda = el('aside', 'quest-private-agenda'); agenda.append(el('strong', '', 'Your private agenda'), el('p', '', instance.agenda.prompt), el('small', 'quest-muted', instance.agenda.completed ? 'Your objective is recorded as complete.' : 'This objective is private until the case debrief.')); root.append(agenda); }\n      if (instance.suspicion != null) {\n        const value = typeof instance.suspicion === 'object' ? instance.suspicion.value ?? instance.suspicion.current : instance.suspicion;\n",
          "baseline": "    function runFile(instance) {\n      const root = el('div', 'quest-run'); root.dataset.questInstance = instance.id;\n      root.append(recap(instance));\n      if (instance.agenda?.prompt) { const agenda = el('aside', 'quest-private-agenda'); agenda.append(el('strong', '', 'Your private agenda'), el('p', '', instance.agenda.prompt), el('small', 'quest-muted', instance.agenda.completed ? 'Your objective is recorded as complete.' : 'This objective is private until the case debrief.')); root.append(agenda); }\n      if (instance.suspicion != null) {\n        const value = typeof instance.suspicion === 'object' ? instance.suspicion.value ?? instance.suspicion.current : instance.suspicion;\n"
        },
        {
          "at": 20849,
          "current": "        root.append(el('p', 'quest-complete', 'Case closed. Your decisions are on the record.'));\n        for (const award of list(instance.awards?.mine)) root.append(el('p', '', (award.title || words(award.kind)) + ' · ' + words(award.state)));\n        if (list(instance.awards?.mine).some(award => award.state === 'pending')) root.append(button('Claim my case record', () => mutate('/v1/content/instances/' + encode(instance.id) + '/claim', { expectedRevision: instance.revision }, 'Claim case record')));\n        if (!instance.quality && list(instance.debrief).length) { const debrief = el('div'); for (const entry of instance.debrief) debrief.append(el('p', '', (entry.name || words(entry.roleId)) + ': ' + entry.prompt + ' · ' + (entry.completed ? 'Objective fulfilled' : 'Objective not fulfilled'))); root.append(section(instance.id + ':debrief', 'The party’s private perspectives', debrief)); }\n      } else {\n        for (const item of list(instance.actions)) root.append(issuedAction(instance, item));\n        if (!list(instance.actions).length) root.append(el('p', 'quest-muted', 'No move is issued to your role yet. Another contribution may be needed.'));\n",
          "baseline": "        root.append(el('p', 'quest-complete', 'Case closed. Your decisions are on the record.'));\n        for (const award of list(instance.awards?.mine)) root.append(el('p', '', (award.title || words(award.kind)) + ' · ' + words(award.state)));\n        if (list(instance.awards?.mine).some(award => award.state === 'pending')) root.append(button('Claim my case record', () => mutate('/v1/content/instances/' + encode(instance.id) + '/claim', { expectedRevision: instance.revision }, 'Claim case record')));\n        if (list(instance.debrief).length) { const debrief = el('div'); for (const entry of instance.debrief) debrief.append(el('p', '', (entry.name || words(entry.roleId)) + ': ' + entry.prompt + ' · ' + (entry.completed ? 'Objective fulfilled' : 'Objective not fulfilled'))); root.append(section(instance.id + ':debrief', 'The party’s private perspectives', debrief)); }\n      } else {\n        for (const item of list(instance.actions)) root.append(issuedAction(instance, item));\n        if (!list(instance.actions).length) root.append(el('p', 'quest-muted', 'No move is issued to your role yet. Another contribution may be needed.'));\n"
        },
        {
          "at": 23771,
          "current": "      return mutate('/v1/content/instances/' + encode(instance.id) + '/act', { expectedRevision: instance.revision, actionId: item.id, ...payload }, label || item.title || 'Continue case');\n    }\n    function issuedAction(instance, item) {\n      const root = el('section', 'quest-action'); root.dataset.questAction = item.id; if (item.nodeId) root.dataset.questNode = item.nodeId;\n      root.append(el('span', 'quest-kicker', item.interaction ? words(item.interaction.kind) : words(item.kind)), el('h4', '', item.title || 'Continue the case'));\n      if (instance.quality && item.spotlight?.title) root.append(el('p', 'quest-muted', item.spotlight.title + ' has the spotlight; any participant can volunteer.'));\n      if (item.prompt) root.append(el('p', 'quest-prompt', item.prompt));\n      if (item.feedback) { const feedback = el('p', 'quest-attempt-feedback', item.feedback); feedback.setAttribute('role', 'status'); root.append(feedback); }\n      if (item.kind === 'start_instance') root.append(button('Start the case', () => submitAction(instance, item, {}, 'Start the case')));\n      else if (item.kind === 'choose' && instance.quality && qualityUX) root.append(qualityUX.choice(instance, item));\n      else if (item.kind === 'choose') {\n        const choices = el('div', 'quest-choices');\n        for (const choice of list(item.options)) {\n",
          "baseline": "      return mutate('/v1/content/instances/' + encode(instance.id) + '/act', { expectedRevision: instance.revision, actionId: item.id, ...payload }, label || item.title || 'Continue case');\n    }\n    function issuedAction(instance, item) {\n      const root = el('section', 'quest-action'); root.dataset.questAction = item.id;\n      root.append(el('span', 'quest-kicker', item.interaction ? words(item.interaction.kind) : words(item.kind)), el('h4', '', item.title || 'Continue the case'));\n      if (item.prompt) root.append(el('p', 'quest-prompt', item.prompt));\n      if (item.feedback) { const feedback = el('p', 'quest-attempt-feedback', item.feedback); feedback.setAttribute('role', 'status'); root.append(feedback); }\n      if (item.kind === 'start_instance') root.append(button('Start the case', () => submitAction(instance, item, {}, 'Start the case')));\n      else if (item.kind === 'choose') {\n        const choices = el('div', 'quest-choices');\n        for (const choice of list(item.options)) {\n"
        },
        {
          "at": 25257,
          "current": "          pick.disabled = busy || choice.available === false; wrap.append(pick, blockers(choice.blockedBy)); choices.append(wrap);\n        }\n        root.append(choices);\n      } else if (item.submissionKind === 'proof_sets') {\n        if (instance.quality && qualityUX) root.append(qualityUX.interaction(instance, item));\n        else root.append(el('p', 'quest-muted', 'The evidence-backed deduction interface could not be opened. Refresh the case file.'));\n      } else if (item.interaction) root.append(interactionForm(instance, item));\n      else if (item.kind === 'solve') {\n        const form = el('form', 'quest-form'), answer = field('Your answer'); answer.input.required = true; answer.input.autocomplete = 'off'; answer.input.maxLength = 2000;\n",
          "baseline": "          pick.disabled = busy || choice.available === false; wrap.append(pick, blockers(choice.blockedBy)); choices.append(wrap);\n        }\n        root.append(choices);\n      } else if (item.interaction) root.append(interactionForm(instance, item));\n      else if (item.kind === 'solve') {\n        const form = el('form', 'quest-form'), answer = field('Your answer'); answer.input.required = true; answer.input.autocomplete = 'off'; answer.input.maxLength = 2000;\n"
        },
        {
          "at": 42508,
          "current": "      }\n      return root;\n    }\n    function paint(force = false, focusedEditor = null) {\n      if (!scope() || state().currentTab !== 'desk') return;\n      const host = document.getElementById('tab-desk'); if (!host) return;\n      if (!root || !root.isConnected || !host.contains(root)) { root?.remove(); root = el('section', 'ux-quests'); root.id = 'ux-quests'; root.dataset.uxPanel = 'quests'; host.append(root); }\n      const active = root.contains(document.activeElement) && document.activeElement.matches('input,textarea,select') ? document.activeElement : null;\n      root.setAttribute('aria-busy', String(loading || busy));\n      if (active && !busy && (!force || !active.closest('.quest-quality,.quest-quality-proof'))) return;\n      const focused = force && active ? { label: active.getAttribute('aria-label'), start: active.selectionStart, end: active.selectionEnd } : force ? focusedEditor : null;\n      const header = el('header', 'quest-heading'); header.append(el('span', 'quest-kicker', 'Bureau of unfinished business'), el('h2', '', 'Your case files'));\n      const controls = el('nav', 'quest-tabs'); controls.setAttribute('aria-label', 'Quest tools');\n      for (const [id, title] of [['cases', 'Case files'], ['community', 'Community mysteries'], ['legacy', 'Your history']]) { const tab = button(title, () => { view = id; error = ''; load(); }); tab.setAttribute('aria-pressed', String(view === id)); tab.disabled = busy || loading; controls.append(tab); }\n",
          "baseline": "      }\n      return root;\n    }\n    function paint() {\n      if (!scope() || state().currentTab !== 'desk') return;\n      const host = document.getElementById('tab-desk'); if (!host) return;\n      if (!root || !root.isConnected || !host.contains(root)) { root?.remove(); root = el('section', 'ux-quests'); root.id = 'ux-quests'; root.dataset.uxPanel = 'quests'; host.append(root); }\n      if (root.contains(document.activeElement) && document.activeElement.matches('input,textarea,select') && !busy) return;\n      const header = el('header', 'quest-heading'); header.append(el('span', 'quest-kicker', 'Bureau of unfinished business'), el('h2', '', 'Your case files'));\n      const controls = el('nav', 'quest-tabs'); controls.setAttribute('aria-label', 'Quest tools');\n      for (const [id, title] of [['cases', 'Case files'], ['community', 'Community mysteries'], ['legacy', 'Your history']]) { const tab = button(title, () => { view = id; error = ''; load(); }); tab.setAttribute('aria-pressed', String(view === id)); tab.disabled = busy || loading; controls.append(tab); }\n"
        },
        {
          "at": 44282,
          "current": "      if (loading && !(view === 'cases' ? board : view === 'community' ? workshop : legacy)) nodes.push(el('p', 'quest-muted', 'Opening the file…'));\n      else nodes.push(view === 'cases' ? caseFiles() : view === 'community' ? workshopPanel() : legacyPanel());\n      root.replaceChildren(...nodes);\n      // Keep issued-action forms stable during a commit. Private editors retain newer local\n      // text while their submitted snapshot is in flight; a reply never commits those edits.\n      if (busy) {\n        root.querySelectorAll('input,textarea,select').forEach(control => {\n          if (!control.closest('[data-quality-section=\"workbench\"],[data-quality-section=\"impression\"]')) control.disabled = true;\n        });\n        root.querySelectorAll('[data-quest-quality] button').forEach(control => { control.disabled = true; });\n      }\n      root.setAttribute('aria-busy', String(loading || busy));\n      document.dispatchEvent(new CustomEvent('omerta:ux-panels-changed'));\n      if (focused?.label) {\n        const target = [...root.querySelectorAll('input,textarea,select')].find(node => node.getAttribute('aria-label') === focused.label);\n        if (target) { target.focus({ preventScroll: true }); if (focused.start != null && typeof target.setSelectionRange === 'function') try { target.setSelectionRange(focused.start, focused.end); } catch { /* Non-text input. */ } }\n      }\n    }\n    function observe(path, body) {\n      if (!scope()) return;\n",
          "baseline": "      if (loading && !(view === 'cases' ? board : view === 'community' ? workshop : legacy)) nodes.push(el('p', 'quest-muted', 'Opening the file…'));\n      else nodes.push(view === 'cases' ? caseFiles() : view === 'community' ? workshopPanel() : legacyPanel());\n      root.replaceChildren(...nodes);\n      // A pending mutation replaces the form. Prevent edits from focusing that disabled-submit\n      // copy, so the focus-preserving repaint can restore enabled controls when the reply arrives.\n      if (busy) root.querySelectorAll('input,textarea,select').forEach(control => { control.disabled = true; });\n      root.setAttribute('aria-busy', String(loading || busy));\n      document.dispatchEvent(new CustomEvent('omerta:ux-panels-changed'));\n    }\n    function observe(path, body) {\n      if (!scope()) return;\n"
        },
        {
          "at": 46551,
          "current": "      if (state().currentTab !== 'desk') return;\n      paint(); if (!(view === 'cases' ? board : view === 'community' ? workshop : legacy) && !loading && !error) load();\n    }\n    const openQualityCase = event => {\n      if (!scope() || !list(board?.instances).some(instance => instance.id === event.detail?.instanceId && instance.quality)) return;\n      selected = 'run:' + event.detail.instanceId; view = 'cases'; paint();\n      const target = root?.querySelector('.quest-quality-heading h4');\n      if (target) { target.tabIndex = -1; target.focus(); target.scrollIntoView({ block: 'start' }); }\n    };\n    document.addEventListener('omerta:quality-case', openQualityCase);\n    return { render, observe, reloadWorkspace() { if (scope()) { paint(); paintDistrictAftermath(); } }, destroy() { destroyed = true; epoch++; pending.clear(); qualityUX?.reset(); document.removeEventListener('omerta:quality-case', openQualityCase); root?.remove(); root = null; districtRoot?.remove(); districtRoot = null; } };\n  };\n})();\n",
          "baseline": "      if (state().currentTab !== 'desk') return;\n      paint(); if (!(view === 'cases' ? board : view === 'community' ? workshop : legacy) && !loading && !error) load();\n    }\n    return { render, observe, reloadWorkspace() { if (scope()) { paint(); paintDistrictAftermath(); } }, destroy() { destroyed = true; epoch++; pending.clear(); root?.remove(); root = null; districtRoot?.remove(); districtRoot = null; } };\n  };\n})();\n"
        }
      ]
    },
    "src/agentgateway.js": {
      "current": {
        "mode": "100644",
        "blob": "a7ec8942ac9ca29e9fb5f4fc33bd68309cecc992",
        "sha256": "3fa8b354e53473ffe269c517d0c930bf995130d32a1dab97954c891727c54e95",
        "bytes": 160610
      },
      "baseline": {
        "mode": "100644",
        "blob": "79743e2e8fa0762ef9a2950e081a683045654b06",
        "sha256": "f6086a80c1d8bd2bb8dd9cad5f5d08f514a079a65a8c41361c44e83d85a08125",
        "bytes": 159768
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { SALE_ATTRIBUTION_CONTRACTS, SALE_ATTRIBUTION_SCHEMAS } from './saleattribution-contracts.js';\nimport { QUEST_QUALITY_BODY, QUEST_QUALITY_SCHEMA } from './quest-quality-contracts.js';\nimport { MERCHANT_LOYALTY_CONTRACTS, MERCHANT_LOYALTY_SCHEMAS } from './merchantloyalty-contracts.js';\nimport { SHOPPING_BASKET_CONTRACTS, SHOPPING_BASKET_SCHEMAS } from './shoppingbasket-contracts.js';\nimport { EVENT_MARKET_CONTRACTS, EVENT_MARKET_SCHEMAS } from './eventmarkets-contracts.js';\n",
          "baseline": "import { SALE_ATTRIBUTION_CONTRACTS, SALE_ATTRIBUTION_SCHEMAS } from './saleattribution-contracts.js';\nimport { MERCHANT_LOYALTY_CONTRACTS, MERCHANT_LOYALTY_SCHEMAS } from './merchantloyalty-contracts.js';\nimport { SHOPPING_BASKET_CONTRACTS, SHOPPING_BASKET_SCHEMAS } from './shoppingbasket-contracts.js';\nimport { EVENT_MARKET_CONTRACTS, EVENT_MARKET_SCHEMAS } from './eventmarkets-contracts.js';\n"
        },
        {
          "at": 71733,
          "current": "          properties: {\n            ids: { type: 'array', maxItems: 64, items: { type: 'string', minLength: 1, maxLength: 160 } },\n            assignments: { type: 'object', maxProperties: 64, additionalProperties: { type: 'string', minLength: 1, maxLength: 160 } },\n            conclusionId: { type: 'string', minLength: 1, maxLength: 160 },\n            evidenceIds: { type: 'array', minItems: 1, maxItems: 64, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 160 } },\n          },\n          oneOf: [{ required: ['ids'] }, { required: ['assignments'] }, { required: ['conclusionId', 'evidenceIds'] }],\n        },\n        hint: { type: 'boolean' },\n      }, not: { required: ['answer', 'choiceId'] } },\n    responseSchema: { $ref: '#/components/schemas/ContentReceipt' },\n    extraResponses: { 409: CONTENT_STALE_RESPONSE },\n  },\n  'POST /v1/content/instances/:instanceId/quality': {\n    operationId: 'actOnContentQuality', requestSchema: QUEST_QUALITY_BODY,\n    responseSchema: { $ref: '#/components/schemas/ContentReceipt' },\n    extraResponses: { 409: CONTENT_STALE_RESPONSE },\n  },\n  'POST /v1/content/instances/:instanceId/leave': {\n    operationId: 'leaveContentInstance',\n    requestSchema: { type: 'object', additionalProperties: false,\n",
          "baseline": "          properties: {\n            ids: { type: 'array', maxItems: 64, items: { type: 'string', minLength: 1, maxLength: 160 } },\n            assignments: { type: 'object', maxProperties: 64, additionalProperties: { type: 'string', minLength: 1, maxLength: 160 } },\n          },\n          oneOf: [{ required: ['ids'] }, { required: ['assignments'] }],\n        },\n        hint: { type: 'boolean' },\n      }, not: { required: ['answer', 'choiceId'] } },\n    responseSchema: { $ref: '#/components/schemas/ContentReceipt' },\n    extraResponses: { 409: CONTENT_STALE_RESPONSE },\n  },\n  'POST /v1/content/instances/:instanceId/leave': {\n    operationId: 'leaveContentInstance',\n    requestSchema: { type: 'object', additionalProperties: false,\n"
        },
        {
          "at": 86606,
          "current": "    properties: {\n      id: { type: 'string', minLength: 1 }, kind: { type: 'string' },\n      nodeId: { type: 'string' }, title: { type: 'string' }, prompt: { type: ['string', 'null'] },\n      submissionKind: { type: 'string', enum: ['normalized_exact', 'ordered_ids', 'unordered_ids', 'mapping', 'proof_sets'] },\n      interaction: { $ref: '#/components/schemas/ContentInteraction' },\n      spotlight: { type: 'object', additionalProperties: false, required: ['roleId', 'title'],\n        properties: { roleId: { type: 'string' }, title: { type: 'string' } } },\n      hints: { type: 'array', maxItems: 8, items: { type: 'string' } },\n      hintsRemaining: { type: 'integer', minimum: 0 }, canRequestHint: { type: 'boolean' },\n      attempts: { type: 'integer', minimum: 0 }, suspicion: { type: 'integer', minimum: 0 },\n",
          "baseline": "    properties: {\n      id: { type: 'string', minLength: 1 }, kind: { type: 'string' },\n      nodeId: { type: 'string' }, title: { type: 'string' }, prompt: { type: ['string', 'null'] },\n      submissionKind: { type: 'string', enum: ['normalized_exact', 'ordered_ids', 'unordered_ids', 'mapping'] },\n      interaction: { $ref: '#/components/schemas/ContentInteraction' },\n      hints: { type: 'array', maxItems: 8, items: { type: 'string' } },\n      hintsRemaining: { type: 'integer', minimum: 0 }, canRequestHint: { type: 'boolean' },\n      attempts: { type: 'integer', minimum: 0 }, suspicion: { type: 'integer', minimum: 0 },\n"
        },
        {
          "at": 92130,
          "current": "      expectations: { oneOf: [{ $ref: '#/components/schemas/ContentExpectations' }, { type: 'null' }] },\n      recap: { $ref: '#/components/schemas/ContentRecap' }, recapText: { type: 'string' },\n      suspicion: { type: 'integer', minimum: 0 },\n      quality: QUEST_QUALITY_SCHEMA,\n      awards: { type: 'object', additionalProperties: false,\n        required: ['pending', 'applied', 'mine'], properties: {\n          pending: { type: 'integer', minimum: 0 }, applied: { type: 'integer', minimum: 0 },\n",
          "baseline": "      expectations: { oneOf: [{ $ref: '#/components/schemas/ContentExpectations' }, { type: 'null' }] },\n      recap: { $ref: '#/components/schemas/ContentRecap' }, recapText: { type: 'string' },\n      suspicion: { type: 'integer', minimum: 0 },\n      awards: { type: 'object', additionalProperties: false,\n        required: ['pending', 'applied', 'mine'], properties: {\n          pending: { type: 'integer', minimum: 0 }, applied: { type: 'integer', minimum: 0 },\n"
        }
      ]
    },
    "src/content/compiler.js": {
      "current": {
        "mode": "100644",
        "blob": "10b5aab91c03d456cc41d3e52d83f5abcc795c98",
        "sha256": "20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641",
        "bytes": 69250
      },
      "baseline": {
        "mode": "100644",
        "blob": "fc324fbfd2139ffb6bb92dcaf706a51f37dfda4f",
        "sha256": "045a917a8f2eef1eb95e77b2dfa56e852eab8adcc9b335010c6ba47b638e4f77",
        "bytes": 69139
      },
      "inverses": [
        {
          "at": 0,
          "current": "import crypto from 'node:crypto';\nimport { HONOR, MASTERY, PATHS, REGIMEN, SEASON_PHASES, SKILLS, UNDERWORLD } from '../rules.js';\nimport { NARRATIVE_VERIFIERS, validateNarrativeAnswer, validateNarrativePuzzle } from './narrative.js';\nimport { assertQuestQuality } from './quality.js';\n\nexport const NODE_TYPES = Object.freeze([\n  'mystery', 'chapter', 'puzzle', 'choice', 'terminal', 'evidence', 'answer_spec',\n",
          "baseline": "import crypto from 'node:crypto';\nimport { HONOR, MASTERY, PATHS, REGIMEN, SEASON_PHASES, SKILLS, UNDERWORLD } from '../rules.js';\nimport { NARRATIVE_VERIFIERS, validateNarrativeAnswer, validateNarrativePuzzle } from './narrative.js';\n\nexport const NODE_TYPES = Object.freeze([\n  'mystery', 'chapter', 'puzzle', 'choice', 'terminal', 'evidence', 'answer_spec',\n"
        },
        {
          "at": 54538,
          "current": "    profiles += 1;\n  }\n  if (!profiles) throw new Error('activatable content requires a supported capability manifest');\n  assertQuestQuality(bundle);\n  return bundle;\n}\n\n",
          "baseline": "    profiles += 1;\n  }\n  if (!profiles) throw new Error('activatable content requires a supported capability manifest');\n  return bundle;\n}\n\n"
        },
        {
          "at": 68539,
          "current": "    }),\n  });\n  const canonicalJson = JSON.stringify(source);\n  assertQuestQuality(source);\n  return {\n    ...source,\n    contentHash: crypto.createHash('sha256').update(canonicalJson).digest('hex'),\n",
          "baseline": "    }),\n  });\n  const canonicalJson = JSON.stringify(source);\n  return {\n    ...source,\n    contentHash: crypto.createHash('sha256').update(canonicalJson).digest('hex'),\n"
        }
      ]
    },
    "src/content/narrative.js": {
      "current": {
        "mode": "100644",
        "blob": "790d08fb5f51bd7c5a58f6b41f8469e28194ed88",
        "sha256": "96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41",
        "bytes": 10972
      },
      "baseline": {
        "mode": "100644",
        "blob": "20a048aceae83f31b371511df6a4ab091bc7f805",
        "sha256": "5259245371f6786d8a530c0d6eb03528acceb3f0105d2c2031bbd75a25781b9d",
        "bytes": 7378
      },
      "inverses": [
        {
          "at": 0,
          "current": "import crypto from 'node:crypto';\n\nexport const NARRATIVE_VERIFIERS = Object.freeze(['ordered_ids', 'unordered_ids', 'mapping', 'proof_sets']);\nexport const INTERACTION_KINDS = Object.freeze([\n  'deduction', 'interrogation', 'timeline', 'scene', 'planning', 'stealth', 'inventory',\n]);\n",
          "baseline": "import crypto from 'node:crypto';\n\nexport const NARRATIVE_VERIFIERS = Object.freeze(['ordered_ids', 'unordered_ids', 'mapping']);\nexport const INTERACTION_KINDS = Object.freeze([\n  'deduction', 'interrogation', 'timeline', 'scene', 'planning', 'stealth', 'inventory',\n]);\n"
        },
        {
          "at": 595,
          "current": "const ids = (value) => Array.isArray(value) && value.length > 0 && value.length <= 64\n  && value.every(id) && new Set(value).size === value.length;\nconst text = (value) => typeof value === 'string' && value.trim().length > 0 && value.length <= 4096;\nconst closed = (value, keys) => only(value, keys)\n  && [Object.prototype, null].includes(Object.getPrototypeOf(value))\n  && Reflect.ownKeys(value).every((key) => typeof key === 'string'\n    && Object.getOwnPropertyDescriptor(value, key)?.value !== undefined);\n\nexport function validateNarrativeAnswer(spec, owner) {\n  const payload = spec.payload || {};\n  if (!NARRATIVE_VERIFIERS.includes(payload.verifier)) return;\n  if (payload.verifier === 'proof_sets') {\n    if (!closed(payload, ['verifier', 'proofs']) || !Array.isArray(payload.proofs)\n      || payload.proofs.length < 1 || payload.proofs.length > 32) throw new Error(`${owner} requires 1-32 bounded proofs`);\n    const seen = new Set();\n    for (const proof of payload.proofs) {\n      if (!closed(proof, ['conclusionId', 'evidenceIds']) || !id(proof.conclusionId) || !ids(proof.evidenceIds)) {\n        throw new Error(`${owner} requires a conclusion and unique cited evidence IDs`);\n      }\n      const key = JSON.stringify([proof.conclusionId, [...proof.evidenceIds].sort()]);\n      if (seen.has(key)) throw new Error(`${owner} has duplicate sufficient proofs`);\n      seen.add(key);\n    }\n    return;\n  }\n  if (!only(payload, ['verifier', 'solution'])) throw new Error(`${owner} answer spec has unknown fields`);\n  if (payload.verifier === 'mapping') {\n    if (!record(payload.solution) || !ids(Object.keys(payload.solution))\n",
          "baseline": "const ids = (value) => Array.isArray(value) && value.length > 0 && value.length <= 64\n  && value.every(id) && new Set(value).size === value.length;\nconst text = (value) => typeof value === 'string' && value.trim().length > 0 && value.length <= 4096;\n\nexport function validateNarrativeAnswer(spec, owner) {\n  const payload = spec.payload || {};\n  if (!NARRATIVE_VERIFIERS.includes(payload.verifier)) return;\n  if (!only(payload, ['verifier', 'solution'])) throw new Error(`${owner} answer spec has unknown fields`);\n  if (payload.verifier === 'mapping') {\n    if (!record(payload.solution) || !ids(Object.keys(payload.solution))\n"
        },
        {
          "at": 2452,
          "current": "}\n\nfunction validateInteraction(interaction, spec, owner) {\n  if (spec?.payload?.verifier === 'proof_sets') {\n    if (!closed(interaction, ['kind', 'items', 'conclusions']) || interaction.kind !== 'deduction'\n      || !Array.isArray(interaction.items) || !ids(interaction.items.map((item) => item?.id))\n      || interaction.items.some((item) => !closed(item, ['id', 'label', 'description', 'evidenceNodeId'])\n        || !text(item.label) || !id(item.evidenceNodeId)\n        || (item.description !== undefined && !text(item.description)))\n      || new Set(interaction.items.map((item) => item.evidenceNodeId)).size !== interaction.items.length\n      || !Array.isArray(interaction.conclusions) || !ids(interaction.conclusions.map((item) => item?.id))\n      || interaction.conclusions.some((item) => !closed(item, ['id', 'label', 'description'])\n        || !text(item.label) || (item.description !== undefined && !text(item.description)))) {\n      throw new Error(`${owner} requires bounded public conclusions and linked evidence items`);\n    }\n    const items = new Set(interaction.items.map((item) => item.id));\n    const conclusions = new Set(interaction.conclusions.map((item) => item.id));\n    if (spec.payload.proofs.some((proof) => !conclusions.has(proof.conclusionId)\n      || proof.evidenceIds.some((itemId) => !items.has(itemId)))) {\n      throw new Error(`${owner} proof references unknown public conclusions or evidence`);\n    }\n    return;\n  }\n  if (!only(interaction, ['kind', 'items', 'slots']) || !INTERACTION_KINDS.includes(interaction.kind)) {\n    throw new Error(`${owner} requires a supported narrative interaction`);\n  }\n",
          "baseline": "}\n\nfunction validateInteraction(interaction, spec, owner) {\n  if (!only(interaction, ['kind', 'items', 'slots']) || !INTERACTION_KINDS.includes(interaction.kind)) {\n    throw new Error(`${owner} requires a supported narrative interaction`);\n  }\n"
        },
        {
          "at": 5726,
          "current": "    if (NARRATIVE_VERIFIERS.includes(spec.payload?.verifier)) {\n      validateNarrativeAnswer(spec, owner);\n      validateInteraction(value.interaction, spec, owner);\n      if (spec.payload.verifier === 'proof_sets' && value.interaction.items.some((item) =>\n        !profileIds.has(item.evidenceNodeId) || nodeById.get(item.evidenceNodeId)?.type !== 'evidence')) {\n        throw new Error(`${owner} proof evidence must reference profiled evidence nodes`);\n      }\n    } else if (value.interaction !== undefined) validateInteraction(value.interaction, spec, owner);\n    if (value.hints !== undefined && (!Array.isArray(value.hints) || value.hints.length > 8\n      || value.hints.some((hint) => !text(hint)))) throw new Error(`${owner} hints must be bounded text`);\n",
          "baseline": "    if (NARRATIVE_VERIFIERS.includes(spec.payload?.verifier)) {\n      validateNarrativeAnswer(spec, owner);\n      validateInteraction(value.interaction, spec, owner);\n    } else if (value.interaction !== undefined) validateInteraction(value.interaction, spec, owner);\n    if (value.hints !== undefined && (!Array.isArray(value.hints) || value.hints.length > 8\n      || value.hints.some((hint) => !text(hint)))) throw new Error(`${owner} hints must be bounded text`);\n"
        },
        {
          "at": 8270,
          "current": "  return { ...node.payload, ...variants[hash.readUInt32BE(0) % variants.length] };\n}\n\nexport function verifyNarrativeSubmission(spec, interaction, submission, context) {\n  const verifier = spec.payload.verifier;\n  if (verifier === 'proof_sets') {\n    if (!closed(submission, ['conclusionId', 'evidenceIds']) || !id(submission.conclusionId)\n      || !ids(submission.evidenceIds) || !(context?.knownEvidenceNodeIds instanceof Set)\n      || !interaction.conclusions.some((entry) => entry.id === submission.conclusionId)) return { valid: false };\n    const evidence = new Map(interaction.items.map((item) => [item.id, item.evidenceNodeId]));\n    if (submission.evidenceIds.some((itemId) => !evidence.has(itemId)\n      || !context.knownEvidenceNodeIds.has(evidence.get(itemId)))) return { valid: false };\n    const cited = new Set(submission.evidenceIds);\n    return { valid: true, matched: spec.payload.proofs.some((proof) => proof.conclusionId === submission.conclusionId\n      && proof.evidenceIds.length === cited.size && proof.evidenceIds.every((itemId) => cited.has(itemId))) };\n  }\n  const items = new Set(interaction.items.map((entry) => entry.id));\n  if (verifier === 'mapping') {\n    if (!only(submission, ['assignments']) || !record(submission.assignments)) return { valid: false };\n",
          "baseline": "  return { ...node.payload, ...variants[hash.readUInt32BE(0) % variants.length] };\n}\n\nexport function verifyNarrativeSubmission(spec, interaction, submission) {\n  const verifier = spec.payload.verifier;\n  const items = new Set(interaction.items.map((entry) => entry.id));\n  if (verifier === 'mapping') {\n    if (!only(submission, ['assignments']) || !record(submission.assignments)) return { valid: false };\n"
        }
      ]
    },
    "src/content/runtime.js": {
      "current": {
        "mode": "100644",
        "blob": "ed8c406c17c2ca4343525b8b9662286e90ad8d40",
        "sha256": "c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2",
        "bytes": 79657
      },
      "baseline": {
        "mode": "100644",
        "blob": "32fc3abc13d7c0f850ac7a390fa67f7b8be47b1a",
        "sha256": "a6e50a80acac7ee519c9a6a4fffc03058df8c35432b3af91bb3e4b027921ba2f",
        "bytes": 70154
      },
      "inverses": [
        {
          "at": 34,
          "current": "import { GameError } from '../game.js';\nimport { compileContentPack, validateActivatableContentPack } from './compiler.js';\nimport { NARRATIVE_VERIFIERS, narrativeBranchAllows, narrativeVariant, verifyNarrativeSubmission } from './narrative.js';\nimport { qualitySpoilerAllows } from './quality.js';\nimport {\n  applyQualityOperation, qualityActorKey, QUALITY_SHARED_KEY, qualityControlledEvidence, qualityDesign,\n  qualityMandateAllows, qualityMemberId, qualityRevelationAllowed, qualityStates, projectQualityRuntime,\n} from './quality-runtime.js';\nimport {\n  MASTERY, PATHS, REGIMEN, SEASON_PHASES, SKILLS, UNDERWORLD,\n  disciplineLvlOf, levelOf, masteryLvlOf, seasonIdxOf, seasonPhaseLeft, seasonPhaseOf,\n",
          "baseline": "import { GameError } from '../game.js';\nimport { compileContentPack, validateActivatableContentPack } from './compiler.js';\nimport { NARRATIVE_VERIFIERS, narrativeBranchAllows, narrativeVariant, verifyNarrativeSubmission } from './narrative.js';\nimport {\n  MASTERY, PATHS, REGIMEN, SEASON_PHASES, SKILLS, UNDERWORLD,\n  disciplineLvlOf, levelOf, masteryLvlOf, seasonIdxOf, seasonPhaseLeft, seasonPhaseOf,\n"
        },
        {
          "at": 26272,
          "current": "  const actions = [];\n  const quorum = Number(graph.quorum.payload?.minimumParticipants || graph.partyRoles.length);\n  const root = graph.nodeById.get(graph.runtime.entryNodeId);\n  const design = qualityDesign(graph);\n  const quality = qualityStates(facts, ch.account_id);\n  const completed = new Set(progress.filter(row => row.state === COMPLETE).map(row => row.node_id));\n  const authorizedNodes = new Set([...completed].filter(nodeId => {\n    const node = graph.nodeById.get(nodeId);\n    return !(node?.type === 'evidence' && node.payload?.shareScope === 'role_private' && node.payload.roleId !== mine.role_id)\n      && !(node?.payload?.gates || []).some(gate => gate.kind === 'party_role' && gate.role !== mine.role_id);\n  }));\n  const knownEvidence = new Set(progress.filter(row => row.state === COMPLETE).filter(row => {\n    const node = graph.nodeById.get(row.node_id);\n    return node?.type === 'evidence' && authorizedNodes.has(node.id)\n      && (!design || qualitySpoilerAllows(design, node.id, authorizedNodes));\n  }).map(row => row.node_id));\n  if (instance.status === FORMING && instance.created_by_account === ch.account_id\n    && members.length >= quorum\n    && blockedGates(ch, h, root?.payload?.gates, graph, mine.role_id).length === 0) {\n",
          "baseline": "  const actions = [];\n  const quorum = Number(graph.quorum.payload?.minimumParticipants || graph.partyRoles.length);\n  const root = graph.nodeById.get(graph.runtime.entryNodeId);\n  if (instance.status === FORMING && instance.created_by_account === ch.account_id\n    && members.length >= quorum\n    && blockedGates(ch, h, root?.payload?.gates, graph, mine.role_id).length === 0) {\n"
        },
        {
          "at": 27756,
          "current": "      const node = graph.nodeById.get(nodeId);\n      if (row?.state !== 'available'\n        || blockedGates(ch, h, node.payload?.gates, graph, mine.role_id).length) continue;\n      if (design && !qualityRevelationAllowed(design, nodeId, completed, quality.shared, graph.nodeById)) continue;\n      if (design && !qualitySpoilerAllows(design, nodeId, authorizedNodes)) continue;\n      const action = {\n        id: actionId(instance, node.type, nodeId), kind: node.type === 'choice' ? 'choose' : 'solve',\n        nodeId, title: node.payload?.title || nodeId, prompt: node.payload?.prompt || null,\n      };\n      const spotlight = design?.spotlights?.find(item => item.nodeId === nodeId);\n      if (spotlight) action.spotlight = { roleId: spotlight.roleId,\n        title: graph.nodeById.get(spotlight.roleId)?.payload?.title || spotlight.roleId };\n      if (node.type === 'puzzle') {\n        const payload = narrativeVariant(node, instance.id);\n        const spec = graph.nodeById.get(payload.answerSpecId);\n",
          "baseline": "      const node = graph.nodeById.get(nodeId);\n      if (row?.state !== 'available'\n        || blockedGates(ch, h, node.payload?.gates, graph, mine.role_id).length) continue;\n      const action = {\n        id: actionId(instance, node.type, nodeId), kind: node.type === 'choice' ? 'choose' : 'solve',\n        nodeId, title: node.payload?.title || nodeId, prompt: node.payload?.prompt || null,\n      };\n      if (node.type === 'puzzle') {\n        const payload = narrativeVariant(node, instance.id);\n        const spec = graph.nodeById.get(payload.answerSpecId);\n"
        },
        {
          "at": 28872,
          "current": "        action.prompt = payload.prompt || null;\n        action.submissionKind = spec.payload.verifier;\n        if (payload.interaction) action.interaction = { ...payload.interaction, mode: spec.payload.verifier };\n        if (spec.payload.verifier === 'proof_sets') action.interaction.items = payload.interaction.items\n          .filter(item => knownEvidence.has(item.evidenceNodeId));\n        action.hints = (payload.hints || []).slice(0, hintLevel);\n        action.canRequestHint = hintLevel < (payload.hints || []).length;\n        action.hintsRemaining = Math.max(0, (payload.hints || []).length - hintLevel);\n",
          "baseline": "        action.prompt = payload.prompt || null;\n        action.submissionKind = spec.payload.verifier;\n        if (payload.interaction) action.interaction = { ...payload.interaction, mode: spec.payload.verifier };\n        action.hints = (payload.hints || []).slice(0, hintLevel);\n        action.canRequestHint = hintLevel < (payload.hints || []).length;\n        action.hintsRemaining = Math.max(0, (payload.hints || []).length - hintLevel);\n"
        },
        {
          "at": 29685,
          "current": "        if (result.feedback) action.feedback = result.feedback;\n      }\n      if (node.type === 'choice') {\n        const procedure = design?.procedures?.find(item => item.nodeId === nodeId);\n        action.options = node.payload.options.filter(option => !procedure || option.id !== procedure.skipOptionId\n          || h.authoredStoryFlags.get(procedure.masteryFlag) === 'learned').map((option) => {\n          const blockedBy = blockedGates(ch, h, option.gates, graph, mine.role_id);\n          return {\n            id: option.id, label: option.label,\n",
          "baseline": "        if (result.feedback) action.feedback = result.feedback;\n      }\n      if (node.type === 'choice') {\n        action.options = node.payload.options.map((option) => {\n          const blockedBy = blockedGates(ch, h, option.gates, graph, mine.role_id);\n          return {\n            id: option.id, label: option.label,\n"
        },
        {
          "at": 30366,
          "current": "  const visibleNodes = progress.flatMap((row) => {\n    const node = graph.nodeById.get(row.node_id);\n    if (!node || node.type === 'answer_spec') return [];\n    if (design && !qualitySpoilerAllows(design, node.id, authorizedNodes)) return [];\n    if (design && !quality.actor.debriefOpened && row.state === COMPLETE\n      && (node.type === 'terminal' || (graph.outgoing.get(node.id) || [])\n        .some(edge => edge.type === 'UNLOCKS' && edge.to === graph.runtime.terminalNodeId))) return [];\n    if (node.type === 'evidence' && node.payload?.shareScope === 'role_private'\n      && node.payload.roleId !== mine.role_id) return [];\n    if (ACTION_TYPES.has(node.type) && (node.payload?.gates || []).some((gate) => (\n",
          "baseline": "  const visibleNodes = progress.flatMap((row) => {\n    const node = graph.nodeById.get(row.node_id);\n    if (!node || node.type === 'answer_spec') return [];\n    if (node.type === 'evidence' && node.payload?.shareScope === 'role_private'\n      && node.payload.roleId !== mine.role_id) return [];\n    if (ACTION_TYPES.has(node.type) && (node.payload?.gates || []).some((gate) => (\n"
        },
        {
          "at": 33158,
          "current": "    return { prompt: agenda.prompt, completed: objective?.state === COMPLETE\n      && (!agenda.choiceId || agenda.choiceId === result.choiceId) };\n  };\n  const projectedQuality = design ? projectQualityRuntime(design, {\n    instance, accountId: ch.account_id, members, visibleNodes, completed, actions, now: Date.now(),\n    debriefText: progress.filter(row => row.state === COMPLETE).map(row => ({\n      node: graph.nodeById.get(row.node_id), result: parseJson(row.result_json, {}),\n    })).filter(({ node, result }) => result.summary || node?.type === 'terminal')\n      .map(({ node, result }) => result.summary || node.payload.summary || '').filter(Boolean).join('\\n\\n').slice(0, 16000),\n  }, quality.actor, quality.shared, facts) : null;\n  return {\n    instance: {\n      id: instance.id, namespace: instance.namespace, version: Number(instance.version),\n",
          "baseline": "    return { prompt: agenda.prompt, completed: objective?.state === COMPLETE\n      && (!agenda.choiceId || agenda.choiceId === result.choiceId) };\n  };\n  return {\n    instance: {\n      id: instance.id, namespace: instance.namespace, version: Number(instance.version),\n"
        },
        {
          "at": 34359,
          "current": "      members: members.map((row) => projectedMember(row, graph, instance, ch.account_id)),\n      nodes: visibleNodes, facts: publicFacts, actions, notes,\n      agenda: agendaFor(mine.role_id),\n      debrief: instance.status === COMPLETE && (!design || quality.actor.debriefOpened) ? members.filter((member) => agendaFor(member.role_id)).map((member) => ({\n        name: member.name_snapshot, roleId: member.role_id, ...agendaFor(member.role_id),\n      })) : [],\n      canReleaseRole: instance.status === ACTIVE && graph.policy.payload.allowRoleReplacement === true,\n",
          "baseline": "      members: members.map((row) => projectedMember(row, graph, instance, ch.account_id)),\n      nodes: visibleNodes, facts: publicFacts, actions, notes,\n      agenda: agendaFor(mine.role_id),\n      debrief: instance.status === COMPLETE ? members.filter((member) => agendaFor(member.role_id)).map((member) => ({\n        name: member.name_snapshot, roleId: member.role_id, ...agendaFor(member.role_id),\n      })) : [],\n      canReleaseRole: instance.status === ACTIVE && graph.policy.payload.allowRoleReplacement === true,\n"
        },
        {
          "at": 35481,
          "current": "      awards: {\n        pending: effects.filter((effect) => effect.state === 'pending').length,\n        applied: effects.filter((effect) => effect.state === 'applied').length,\n        mine: design && !quality.actor.debriefOpened ? [] : ownEffects,\n      },\n      createdAt: instance.created_at, startedAt: instance.started_at,\n      completedAt: instance.completed_at, formingExpiresAt: instance.forming_expires_at || null,\n      ...(projectedQuality ? { quality: projectedQuality } : {}),\n    },\n  };\n}\n",
          "baseline": "      awards: {\n        pending: effects.filter((effect) => effect.state === 'pending').length,\n        applied: effects.filter((effect) => effect.state === 'applied').length,\n        mine: ownEffects,\n      },\n      createdAt: instance.created_at, startedAt: instance.started_at,\n      completedAt: instance.completed_at, formingExpiresAt: instance.forming_expires_at || null,\n    },\n  };\n}\n"
        },
        {
          "at": 54928,
          "current": "}\n\nasync function cascade(client, graph, instance, actor = null) {\n  const controlledEvidence = qualityControlledEvidence(qualityDesign(graph));\n  let changed = true;\n  while (changed) {\n    changed = false;\n",
          "baseline": "}\n\nasync function cascade(client, graph, instance, actor = null) {\n  let changed = true;\n  while (changed) {\n    changed = false;\n"
        },
        {
          "at": 55503,
          "current": "\n    for (const nodeId of [...graph.nodeById.keys()].sort()) {\n      if (completed.has(nodeId)) continue;\n      if (controlledEvidence.has(nodeId)) continue;\n      const node = graph.nodeById.get(nodeId);\n      if ((node.payload?.gates || []).length && nodeId !== graph.runtime.entryNodeId && !graph.actionIds.has(nodeId)) {\n        fail('unsupported_content_feature', 'This pinned bundle declares an unsupported passive-node gate.');\n",
          "baseline": "\n    for (const nodeId of [...graph.nodeById.keys()].sort()) {\n      if (completed.has(nodeId)) continue;\n      const node = graph.nodeById.get(nodeId);\n      if ((node.payload?.gates || []).length && nodeId !== graph.runtime.entryNodeId && !graph.actionIds.has(nodeId)) {\n        fail('unsupported_content_feature', 'This pinned bundle declares an unsupported passive-node gate.');\n"
        },
        {
          "at": 62489,
          "current": "    )).rows[0];\n    if (progress?.state !== 'available') fail('unknown_action', 'That node is not currently actionable.');\n    assertNodeGates(ch, h, selected, graph, member.role_id);\n    const design = qualityDesign(graph);\n    let qualityContext;\n    const usesProofSets = selected.type === 'puzzle'\n      && graph.nodeById.get(narrativeVariant(selected, instance.id).answerSpecId)?.payload.verifier === 'proof_sets';\n    if (design || usesProofSets) {\n      const board = await projection(ch, instance, bundle, client, h);\n      const facts = (await client.query('SELECT fact_key, value_json FROM content_instance_facts WHERE instance_id=$1', [instanceId]))\n        .rows.map(row => ({ key: row.fact_key, value: parseJson(row.value_json) }));\n      const completed = new Set((await client.query(\"SELECT node_id FROM content_instance_nodes WHERE instance_id=$1 AND state='completed'\", [instanceId])).rows.map(row => row.node_id));\n      const states = qualityStates(facts, ch.account_id);\n      qualityContext = { board, completed, states, knownEvidence: new Set(board.instance.nodes\n        .filter(node => node.type === 'evidence' && node.state === COMPLETE).map(node => node.id)) };\n      const authorizedNodes = new Set(board.instance.nodes.filter(node => node.state === COMPLETE).map(node => node.id));\n      if (design && !qualitySpoilerAllows(design, selected.id, authorizedNodes)) {\n        fail('unknown_action', 'That scene has not been revealed to you.');\n      }\n      if (design && !qualityRevelationAllowed(design, selected.id, completed, states.shared, graph.nodeById)) {\n        fail('npc_knowledge', 'This conversation requires information the witness has not learned.');\n      }\n      if (design && selected.type === 'choice') {\n        const participants = (await memberRows(client, instanceId)).map(row => ({ id: qualityMemberId(instanceId, row.account_id) }));\n        if ((participants.length > 1 && !Object.hasOwn(states.shared.delegations, selected.id))\n          || !qualityMandateAllows(states.shared, selected.id, qualityMemberId(instanceId, ch.account_id), participants)) {\n          fail('decision_acknowledgement', 'Agree on a scene delegate and acknowledge the decision before committing.');\n        }\n      }\n    }\n    let result;\n    if (selected.type === 'puzzle') {\n      const payload = narrativeVariant(selected, instance.id);\n",
          "baseline": "    )).rows[0];\n    if (progress?.state !== 'available') fail('unknown_action', 'That node is not currently actionable.');\n    assertNodeGates(ch, h, selected, graph, member.role_id);\n    let result;\n    if (selected.type === 'puzzle') {\n      const payload = narrativeVariant(selected, instance.id);\n"
        },
        {
          "at": 65584,
          "current": "        let matched;\n        if (NARRATIVE_VERIFIERS.includes(spec.payload.verifier)) {\n          if (submitted[0] !== 'submission') fail('bad_request', 'This investigation requires its issued structured submission.');\n          const checked = verifyNarrativeSubmission(spec, payload.interaction, opts.submission,\n            { knownEvidenceNodeIds: qualityContext?.knownEvidence || new Set() });\n          if (!checked.valid) fail('bad_request', 'The submission must use only the issued items and slots.');\n          matched = checked.matched;\n        } else {\n",
          "baseline": "        let matched;\n        if (NARRATIVE_VERIFIERS.includes(spec.payload.verifier)) {\n          if (submitted[0] !== 'submission') fail('bad_request', 'This investigation requires its issued structured submission.');\n          const checked = verifyNarrativeSubmission(spec, payload.interaction, opts.submission);\n          if (!checked.valid) fail('bad_request', 'The submission must use only the issued items and slots.');\n          matched = checked.matched;\n        } else {\n"
        },
        {
          "at": 66964,
          "current": "        result = { hintLevel: Number(previous.hintLevel || 0), attempts, suspicion, matched,\n          ...(matched ? { outcome: 'success', summary: payload.summary || null }\n            : complication ? { outcome: 'complication', summary: payload.failForward.summary }\n              : { feedback: spec.payload.verifier === 'proof_sets'\n                ? 'Your selected evidence does not establish the conclusion as a complete chain. Compare the stated assumptions with independent observations; selecting every clue does not make a proof.'\n                : 'The evidence does not support that reconstruction. Review your clues or request a hint.' }) };\n      }\n      if (!result.outcome) {\n        await client.query('UPDATE content_instance_nodes SET result_json=$3 WHERE instance_id=$1 AND node_id=$2',\n",
          "baseline": "        result = { hintLevel: Number(previous.hintLevel || 0), attempts, suspicion, matched,\n          ...(matched ? { outcome: 'success', summary: payload.summary || null }\n            : complication ? { outcome: 'complication', summary: payload.failForward.summary }\n              : { feedback: 'The evidence does not support that reconstruction. Review your clues or request a hint.' }) };\n      }\n      if (!result.outcome) {\n        await client.query('UPDATE content_instance_nodes SET result_json=$3 WHERE instance_id=$1 AND node_id=$2',\n"
        },
        {
          "at": 68332,
          "current": "      }\n      const choice = selected.payload.options.find((option) => option.id === opts?.choiceId);\n      if (!choice) fail('unknown_action', 'That choice was not offered.');\n      const procedure = design?.procedures?.find(item => item.nodeId === selected.id);\n      if (procedure && choice.id === procedure.skipOptionId && h.authoredStoryFlags.get(procedure.masteryFlag) !== 'learned') {\n        fail('procedure_unlearned', 'Complete this procedure once before using its shortcut.');\n      }\n      assertNodeGates(ch, h, { payload: { gates: choice.gates || [] } }, graph, member.role_id,\n        { option: true });\n      await recordStoryFlags(client, graph, instance, ch, selected, choice);\n",
          "baseline": "      }\n      const choice = selected.payload.options.find((option) => option.id === opts?.choiceId);\n      if (!choice) fail('unknown_action', 'That choice was not offered.');\n      assertNodeGates(ch, h, { payload: { gates: choice.gates || [] } }, graph, member.role_id,\n        { option: true });\n      await recordStoryFlags(client, graph, instance, ch, selected, choice);\n"
        },
        {
          "at": 69124,
          "current": "    } else fail('unknown_action', 'That node is not executable.');\n    await completeNode(client, instanceId, selected.id,\n      { accountId: ch.account_id, characterId: ch.id }, result);\n    const learned = design?.procedures?.find(item => item.learnNodeId === selected.id);\n    if (learned && result.matched === true) {\n      await client.query(\n        `INSERT INTO content_story_flags\n          (account_id,flag_key,flag_kind,flag_value,title,source_namespace,source_version,source_instance_id,source_node_id,source_choice_id)\n         VALUES ($1,$2,'case_evidence','learned',$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,\n        [ch.account_id, learned.masteryFlag, 'Practiced procedure', instance.namespace, instance.version,\n          instanceId, selected.id, learned.learnOptionId],\n      );\n    }\n    await cascade(client, graph, instance, { accountId: ch.account_id, characterId: ch.id });\n  }\n  await client.query('UPDATE content_instances SET revision=revision+1 WHERE id=$1', [instanceId]);\n",
          "baseline": "    } else fail('unknown_action', 'That node is not executable.');\n    await completeNode(client, instanceId, selected.id,\n      { accountId: ch.account_id, characterId: ch.id }, result);\n    await cascade(client, graph, instance, { accountId: ch.account_id, characterId: ch.id });\n  }\n  await client.query('UPDATE content_instances SET revision=revision+1 WHERE id=$1', [instanceId]);\n"
        },
        {
          "at": 70232,
          "current": "  return projection(ch, next, bundle, client, h);\n}\n\n// Private reasoning is stored separately from public progress. The instance lock serializes\n// disclosures/mandates across actors; the private revision catches a second tab's lost update.\nexport async function actOnContentQuality(ch, instanceId, opts, client, h) {\n  const instance = await lockedInstance(client, instanceId);\n  const bundle = await loadBundle(client, instance.namespace, Number(instance.version), instance.content_hash);\n  const graph = graphOf(bundle), design = qualityDesign(graph);\n  if (!design) fail('unsupported_content_feature', 'This case does not use the quality workbench.');\n  const board = await projection(ch, instance, bundle, client, h);\n  await assertRevision(ch, instance, opts?.expectedRevision, bundle, client, h);\n  const members = await memberRows(client, instanceId);\n  const facts = (await client.query('SELECT fact_key, value_json FROM content_instance_facts WHERE instance_id=$1', [instanceId]))\n    .rows.map(row => ({ key: row.fact_key, value: parseJson(row.value_json) }));\n  const states = qualityStates(facts, ch.account_id);\n  const completed = new Set((await client.query(\"SELECT node_id FROM content_instance_nodes WHERE instance_id=$1 AND state='completed'\", [instanceId])).rows.map(row => row.node_id));\n  let outcome;\n  try { outcome = applyQualityOperation(design, {\n    instance, accountId: ch.account_id, members, completed, nodeById: graph.nodeById,\n    actions: board.instance.actions, knownEvidence: new Set(board.instance.quality.evidence.map(item => item.id)), now: Date.now(),\n  }, states.actor, states.shared, opts); }\n  catch (error) { if (error.code === 'stale_quality') error.data = board; throw error; }\n  if (outcome.publicChange) await validateCurrentPartyAuthority(client, graph, instance);\n  const persist = (key, value) => client.query(\n    `INSERT INTO content_instance_facts (instance_id,fact_key,value_json,set_by_node_id)\n     VALUES ($1,$2,$3,'runtime') ON CONFLICT (instance_id,fact_key)\n     DO UPDATE SET value_json=EXCLUDED.value_json, set_at=now()`, [instanceId, key, JSON.stringify(value)],\n  );\n  await persist(qualityActorKey(ch.account_id), outcome.actor);\n  if (outcome.publicChange) {\n    await persist(QUALITY_SHARED_KEY, outcome.shared);\n    for (const nodeId of outcome.revealNodeIds) {\n      const node = graph.nodeById.get(nodeId);\n      if (node?.type !== 'evidence') fail('unsupported_content_feature', 'A quality operation may reveal only authored evidence.');\n      await completeNode(client, instanceId, nodeId, { accountId: ch.account_id, characterId: ch.id });\n    }\n    await cascade(client, graph, instance, { accountId: ch.account_id, characterId: ch.id });\n    await client.query('UPDATE content_instances SET revision=revision+1 WHERE id=$1', [instanceId]);\n  }\n  const next = (await client.query('SELECT * FROM content_instances WHERE id=$1', [instanceId])).rows[0];\n  return projection(ch, next, bundle, client, h);\n}\n\nexport async function leaveContentInstance(ch, instanceId, opts, client, h) {\n  const instance = await lockedInstance(client, instanceId);\n  const bundle = await loadBundle(client, instance.namespace, Number(instance.version), instance.content_hash);\n",
          "baseline": "  return projection(ch, next, bundle, client, h);\n}\n\nexport async function leaveContentInstance(ch, instanceId, opts, client, h) {\n  const instance = await lockedInstance(client, instanceId);\n  const bundle = await loadBundle(client, instance.namespace, Number(instance.version), instance.content_hash);\n"
        }
      ]
    },
    "src/questing-contract.js": {
      "current": {
        "mode": "100644",
        "blob": "1f55e3ba51943d96da89a3ff38b381e8ad65941b",
        "sha256": "15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71",
        "bytes": 7874
      },
      "baseline": {
        "mode": "100644",
        "blob": "07424135def851f11f7c90a6046f96ebee06c5a8",
        "sha256": "e9fb4d63be72493ccd5607139f785ab9e9f6940e8c6593ee7de46a994a928f71",
        "bytes": 7777
      },
      "inverses": [
        {
          "at": 1266,
          "current": "};\n\nexport const QUESTING_SCHEMAS = {\n  ContentInteractionItem: object({ id: string, label: string, description: string, evidenceNodeId: string }, ['id', 'label']),\n  ContentInteraction: object({\n    kind: { type: 'string', enum: ['deduction', 'interrogation', 'timeline', 'scene', 'planning', 'stealth', 'inventory'] },\n    mode: { type: 'string', enum: ['ordered_ids', 'unordered_ids', 'mapping', 'proof_sets'] },\n    items: array(ref('ContentInteractionItem'), 64), slots: array(ref('ContentInteractionItem'), 64),\n    conclusions: array(ref('ContentInteractionItem'), 64),\n  }, ['kind', 'mode', 'items']),\n  ContentExpectations: object({ durationMinutes: { type: 'integer', minimum: 1 }, difficulty: string,\n    summary: string, reasoning: string, combat: string, group: string, commitments: array(string) }, []),\n",
          "baseline": "};\n\nexport const QUESTING_SCHEMAS = {\n  ContentInteractionItem: object({ id: string, label: string, description: string }, ['id', 'label']),\n  ContentInteraction: object({\n    kind: { type: 'string', enum: ['deduction', 'interrogation', 'timeline', 'scene', 'planning', 'stealth', 'inventory'] },\n    mode: { type: 'string', enum: ['ordered_ids', 'unordered_ids', 'mapping'] },\n    items: array(ref('ContentInteractionItem'), 64), slots: array(ref('ContentInteractionItem'), 64),\n  }, ['kind', 'mode', 'items']),\n  ContentExpectations: object({ durationMinutes: { type: 'integer', minimum: 1 }, difficulty: string,\n    summary: string, reasoning: string, combat: string, group: string, commitments: array(string) }, []),\n"
        }
      ]
    },
    "src/routes/content.js": {
      "current": {
        "mode": "100644",
        "blob": "0a1372dd01583318f56df074a97b66378e034d83",
        "sha256": "12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e",
        "bytes": 15132
      },
      "baseline": {
        "mode": "100644",
        "blob": "0b22de016f9f781fe3f64aca3c772edee571f392",
        "sha256": "b84e686e218b5fcd6a78500780e05d3f73c7f8dfd70f1a2d5145664d8f594e4d",
        "bytes": 14366
      },
      "inverses": [
        {
          "at": 96,
          "current": "// Account, character, organization, participant kind, and effect authority are always derived by\n// the runtime; handlers copy only the caller choices defined by the public contract.\nimport * as G from '../game.js';\nimport { QUEST_QUALITY_BODY } from '../quest-quality-contracts.js';\nimport {\n  activateContentBundle,\n  contentBoard,\n",
          "baseline": "// Account, character, organization, participant kind, and effect authority are always derived by\n// the runtime; handlers copy only the caller choices defined by the public contract.\nimport * as G from '../game.js';\nimport {\n  activateContentBundle,\n  contentBoard,\n"
        },
        {
          "at": 480,
          "current": "  joinContentInstance,\n  setContentConsent,\n  actOnContentInstance,\n  actOnContentQuality,\n  leaveContentInstance,\n  claimContentRewards,\n  addContentCaseNote,\n",
          "baseline": "  joinContentInstance,\n  setContentConsent,\n  actOnContentInstance,\n  leaveContentInstance,\n  claimContentRewards,\n  addContentCaseNote,\n"
        },
        {
          "at": 2425,
          "current": "      properties: {\n        ids: { type: 'array', maxItems: 64, items: { type: 'string', minLength: 1, maxLength: 160 } },\n        assignments: { type: 'object', maxProperties: 64, additionalProperties: { type: 'string', minLength: 1, maxLength: 160 } },\n        conclusionId: { type: 'string', minLength: 1, maxLength: 160 },\n        evidenceIds: { type: 'array', minItems: 1, maxItems: 64, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 160 } },\n      },\n      oneOf: [{ required: ['ids'] }, { required: ['assignments'] }, { required: ['conclusionId', 'evidenceIds'] }],\n    },\n    hint: { type: 'boolean' },\n  },\n",
          "baseline": "      properties: {\n        ids: { type: 'array', maxItems: 64, items: { type: 'string', minLength: 1, maxLength: 160 } },\n        assignments: { type: 'object', maxProperties: 64, additionalProperties: { type: 'string', minLength: 1, maxLength: 160 } },\n      },\n      oneOf: [{ required: ['ids'] }, { required: ['assignments'] }],\n    },\n    hint: { type: 'boolean' },\n  },\n"
        },
        {
          "at": 5305,
          "current": "    for (const [name, item] of Object.entries(value)) {\n      const child = Object.hasOwn(rule.properties || {}, name) ? rule.properties[name]\n        : typeof rule.additionalProperties === 'object' ? rule.additionalProperties : null;\n      if (!child && rule.additionalProperties === false) invalidBody(`Unexpected request field: ${key}.${name}.`);\n      if (child) strictValue(child, item, `${key}.${name}`);\n    }\n  }\n",
          "baseline": "    for (const [name, item] of Object.entries(value)) {\n      const child = Object.hasOwn(rule.properties || {}, name) ? rule.properties[name]\n        : typeof rule.additionalProperties === 'object' ? rule.additionalProperties : null;\n      if (child) strictValue(child, item, `${key}.${name}`);\n    }\n  }\n"
        },
        {
          "at": 6744,
          "current": "  try {\n    return await run();\n  } catch (error) {\n    if (!['stale_instance', 'stale_content', 'stale_quality'].includes(error?.code)) throw error;\n    return reply.code(409).send({\n      error: error.code,\n      message: error.message,\n",
          "baseline": "  try {\n    return await run();\n  } catch (error) {\n    if (!['stale_instance', 'stale_content'].includes(error?.code)) throw error;\n    return reply.code(409).send({\n      error: error.code,\n      message: error.message,\n"
        },
        {
          "at": 13244,
          "current": "        hint: req.body?.hint,\n      }, client, h))));\n\n  app.post('/v1/content/instances/:instanceId/quality', guarded(auth, QUEST_QUALITY_BODY), async (req, reply) =>\n    instanceMutation(reply, () => G.withCharacter(pool, req.user.sub, (ch, client, h) =>\n      actOnContentQuality(ch, req.params.instanceId, req.body, client, h))));\n\n  app.post('/v1/content/instances/:instanceId/leave', guarded(auth, revisionBody), async (req, reply) =>\n    instanceMutation(reply, () => G.withCharacter(pool, req.user.sub, (ch, client, h) =>\n      leaveContentInstance(ch, req.params.instanceId, {\n",
          "baseline": "        hint: req.body?.hint,\n      }, client, h))));\n\n  app.post('/v1/content/instances/:instanceId/leave', guarded(auth, revisionBody), async (req, reply) =>\n    instanceMutation(reply, () => G.withCharacter(pool, req.user.sub, (ch, client, h) =>\n      leaveContentInstance(ch, req.params.instanceId, {\n"
        }
      ]
    },
    "src/server.js": {
      "current": {
        "mode": "100644",
        "blob": "49ec2a2fbb5659278d78fa705d026bb4ce64feea",
        "sha256": "0f18cac05dfe6763132b431d5fb6ebce1492bda1353643e7f4eb8ddd87982388",
        "bytes": 311322
      },
      "baseline": {
        "mode": "100644",
        "blob": "491571ec5bb1b32f175ea3a4a15ef924666f4896",
        "sha256": "6e61533e75accd0cb16d21c750554ac79d4e7c0e4f92d1fc5d6597d9568560a8",
        "bytes": 311229
      },
      "inverses": [
        {
          "at": 48930,
          "current": "    ['ux-social.js', 'application/javascript'], ['ux-social.css', 'text/css'],\n    ['ux-navigation.js', 'application/javascript'], ['ux-navigation.css', 'text/css'],\n    ...['feel', 'tools', 'identity', 'story', 'community', 'quests', 'clues'].flatMap(name => [[`ux-${name}.js`, 'application/javascript'], [`ux-${name}.css`, 'text/css']]),\n    ['ux-quest-quality.js', 'application/javascript'], ['ux-quest-quality.css', 'text/css'],\n    ['ux-workspace.js', 'application/javascript'], ['ux-world.js', 'application/javascript'], ['ux-world.css', 'text/css'],\n    ['ux-tactics.js', 'application/javascript'], ['ux-tactics.css', 'text/css'],\n    ['ux-investigation.js', 'application/javascript'], ['ux-investigation.css', 'text/css'],\n",
          "baseline": "    ['ux-social.js', 'application/javascript'], ['ux-social.css', 'text/css'],\n    ['ux-navigation.js', 'application/javascript'], ['ux-navigation.css', 'text/css'],\n    ...['feel', 'tools', 'identity', 'story', 'community', 'quests', 'clues'].flatMap(name => [[`ux-${name}.js`, 'application/javascript'], [`ux-${name}.css`, 'text/css']]),\n    ['ux-workspace.js', 'application/javascript'], ['ux-world.js', 'application/javascript'], ['ux-world.css', 'text/css'],\n    ['ux-tactics.js', 'application/javascript'], ['ux-tactics.css', 'text/css'],\n    ['ux-investigation.js', 'application/javascript'], ['ux-investigation.css', 'text/css'],\n"
        }
      ]
    },
    "test/client.js": {
      "current": {
        "mode": "100644",
        "blob": "fd83f534638faf520e1d56c28133d05bef5cbd45",
        "sha256": "b3d3c81a038f42c28fbf1dd5142e3fccecc653cf48ca23b5cc85565e118ffd60",
        "bytes": 763551
      },
      "baseline": {
        "mode": "100644",
        "blob": "d76d33df1af070de1b94a21ba8c7a5a64e989fd6",
        "sha256": "96c1031bab954cf43cb3caf8834d2f3dae53f6ccc44cab590619ea1eb4c89cf1",
        "bytes": 763513
      },
      "inverses": [
        {
          "at": 9008,
          "current": "  ]) {\n    const observed = await vm.runInNewContext(`(async () => {\n      let acting = false, activatedControl = null, operationPending = null, operationPhase = '', _operationResponseCurrent = null;\n      globalThis.window = globalThis;\n      let me = { id: 'owner', generation: 1, loc: 'docks' };\n      const currentTab = 'streets', feedbackUX = null;\n      const noop = () => {}, node = { textContent: '' };\n",
          "baseline": "  ]) {\n    const observed = await vm.runInNewContext(`(async () => {\n      let acting = false, activatedControl = null, operationPending = null, operationPhase = '', _operationResponseCurrent = null;\n      let me = { id: 'owner', generation: 1, loc: 'docks' };\n      const currentTab = 'streets', feedbackUX = null;\n      const noop = () => {}, node = { textContent: '' };\n"
        }
      ]
    },
    "test/clue-puzzles-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "18071261094efeb63f1cc213a3f75cc110154e5b",
        "sha256": "f4d5fdcd227878ef871f709167039e1064197a59c0ccc9e5b19227b3b36509c2",
        "bytes": 7782
      },
      "baseline": {
        "mode": "100644",
        "blob": "1eacf4f78edd2775d3759a019092798fd8b8e7c1",
        "sha256": "b324693b29f70643c6b796b5bbe97079194503f4d33f66ed5a5f6e46910d61ad",
        "bytes": 7713
      },
      "inverses": [
        {
          "at": 2148,
          "current": "  page.on('pageerror', (error) => errors.push(error.message));\n  await page.addInitScript(token => { localStorage.setItem('omerta_token', token); for (const key of ['omerta_tour2', 'omerta_welcomed', 'omerta_alltabs']) localStorage.setItem(key, '1'); }, token);\n  await page.goto(base, { waitUntil: 'domcontentloaded' });\n  await page.waitForFunction(() => window.OmertaGameReady === true);\n  assert.equal(await page.evaluate(() => typeof window.renderOmertaCluePuzzle), 'function', 'the production page loads the clue renderer');\n  await page.locator('#screen-main:not(.hidden)').waitFor();\n  await page.evaluate(() => document.querySelectorAll('.modal-bg:not(.hidden)').forEach(element => element.classList.add('hidden')));\n",
          "baseline": "  page.on('pageerror', (error) => errors.push(error.message));\n  await page.addInitScript(token => { localStorage.setItem('omerta_token', token); for (const key of ['omerta_tour2', 'omerta_welcomed', 'omerta_alltabs']) localStorage.setItem(key, '1'); }, token);\n  await page.goto(base, { waitUntil: 'domcontentloaded' });\n  assert.equal(await page.evaluate(() => typeof window.renderOmertaCluePuzzle), 'function', 'the production page loads the clue renderer');\n  await page.locator('#screen-main:not(.hidden)').waitFor();\n  await page.evaluate(() => document.querySelectorAll('.modal-bg:not(.hidden)').forEach(element => element.classList.add('hidden')));\n"
        }
      ]
    },
    "test/content-api.js": {
      "current": {
        "mode": "100644",
        "blob": "0eaf8caf9049234233f32de4b0793310e306391a",
        "sha256": "af8662191fd428d95072e82de96ab6d12fedda3d1207d040665cb32244dc33cb",
        "bytes": 22828
      },
      "baseline": {
        "mode": "100644",
        "blob": "a16f83efaa68c33809bede7f396e5a02048a552f",
        "sha256": "649db44938d8aa4ad3ec4fbcae4a626b86af08367fdee0a79e91be3bc56d09f6",
        "bytes": 22679
      },
      "inverses": [
        {
          "at": 2051,
          "current": "  { method: 'POST', url: '/v1/content/instances/:instanceId/join', hasAuth: true, isMod: false },\n  { method: 'POST', url: '/v1/content/instances/:instanceId/consent', hasAuth: true, isMod: false },\n  { method: 'POST', url: '/v1/content/instances/:instanceId/act', hasAuth: true, isMod: false },\n  { method: 'POST', url: '/v1/content/instances/:instanceId/quality', hasAuth: true, isMod: false },\n  { method: 'POST', url: '/v1/content/instances/:instanceId/leave', hasAuth: true, isMod: false },\n  { method: 'POST', url: '/v1/content/instances/:instanceId/notes', hasAuth: true, isMod: false },\n  { method: 'POST', url: '/v1/content/instances/:instanceId/release', hasAuth: true, isMod: false },\n",
          "baseline": "  { method: 'POST', url: '/v1/content/instances/:instanceId/join', hasAuth: true, isMod: false },\n  { method: 'POST', url: '/v1/content/instances/:instanceId/consent', hasAuth: true, isMod: false },\n  { method: 'POST', url: '/v1/content/instances/:instanceId/act', hasAuth: true, isMod: false },\n  { method: 'POST', url: '/v1/content/instances/:instanceId/leave', hasAuth: true, isMod: false },\n  { method: 'POST', url: '/v1/content/instances/:instanceId/notes', hasAuth: true, isMod: false },\n  { method: 'POST', url: '/v1/content/instances/:instanceId/release', hasAuth: true, isMod: false },\n"
        },
        {
          "at": 3560,
          "current": "  '/v1/content/instances/{instanceId}/join',\n  '/v1/content/instances/{instanceId}/consent',\n  '/v1/content/instances/{instanceId}/act',\n  '/v1/content/instances/{instanceId}/quality',\n  '/v1/content/instances/{instanceId}/leave',\n  '/v1/content/instances/{instanceId}/notes',\n  '/v1/content/instances/{instanceId}/release',\n",
          "baseline": "  '/v1/content/instances/{instanceId}/join',\n  '/v1/content/instances/{instanceId}/consent',\n  '/v1/content/instances/{instanceId}/act',\n  '/v1/content/instances/{instanceId}/leave',\n  '/v1/content/instances/{instanceId}/notes',\n  '/v1/content/instances/{instanceId}/release',\n"
        }
      ]
    },
    "test/decision-guide-client.js": {
      "current": {
        "mode": "100644",
        "blob": "ff17d0c8356b8b1420cb242b7e12d41288eb2078",
        "sha256": "1ec84d7069f9a4a75971f1d6a1e609e003d1dbe53f7cabc1fa80f68ae6978285",
        "bytes": 7606
      },
      "baseline": {
        "mode": "100644",
        "blob": "90c1ebe5612ddde3f58fd8464dee7bc4cda59df6",
        "sha256": "78595e5075617b53a8e0ba47f52815b264ce0c490db66d06b89de50190928dcf",
        "bytes": 7512
      },
      "inverses": [
        {
          "at": 1232,
          "current": " projections:{snapshot:()=>1,current:()=>true},cityIdentity:()=> 'key',renderOperationPending(){},busy:{removeAttribute(){},setAttribute(){},classList:{add(){},remove(){}}},\n toast(){},describe:()=>'',shake(){},sfx(){},$:()=>resp,_operationResponseCurrent:null,\n recordOperation:r=>{receipts.push(r);return r;}});\n // Model the browser global while leaving the optional analytics module absent.\n c.window=c;\n c.api=async(method,path,body,options)=>{if(stage==='queued'){c.me={id:'b',generation:1};if(options.beforeDispatch?.()===false)return {code:499,body:{},ignored:true};sent++;}if(stage==='api')c.me={id:'b',generation:1};return {code:400,body:{private:'old'},...(stage==='ignored'?{ignored:true}:{})};};\n c.refresh=async()=>{if(stage==='refresh')c.me={id:'b',generation:1};return {code:200};};\n vm.runInContext(source('act')+'; globalThis.act=act;',c);\n",
          "baseline": " projections:{snapshot:()=>1,current:()=>true},cityIdentity:()=> 'key',renderOperationPending(){},busy:{removeAttribute(){},setAttribute(){},classList:{add(){},remove(){}}},\n toast(){},describe:()=>'',shake(){},sfx(){},$:()=>resp,_operationResponseCurrent:null,\n recordOperation:r=>{receipts.push(r);return r;}});\n c.api=async(method,path,body,options)=>{if(stage==='queued'){c.me={id:'b',generation:1};if(options.beforeDispatch?.()===false)return {code:499,body:{},ignored:true};sent++;}if(stage==='api')c.me={id:'b',generation:1};return {code:400,body:{private:'old'},...(stage==='ignored'?{ignored:true}:{})};};\n c.refresh=async()=>{if(stage==='refresh')c.me={id:'b',generation:1};return {code:200};};\n vm.runInContext(source('act')+'; globalThis.act=act;',c);\n"
        }
      ]
    },
    "test/docs.js": {
      "current": {
        "mode": "100644",
        "blob": "c46129ddc42b8d9f391ee7a4345717f37606f355",
        "sha256": "39f0d963c0a8c8d893298c1b27611112af1b63d50f35019083d698dc1fad68ca",
        "bytes": 318871
      },
      "baseline": {
        "mode": "100644",
        "blob": "dfbbabe4efba8557ecbd5b96e65339f30609c51a",
        "sha256": "e71083891eff9339ddb45a6b05e6145a4e196c0c2ab2b18f7dc9cd00abc19920",
        "bytes": 317626
      },
      "inverses": [
        {
          "at": 1636,
          "current": "import path from 'node:path';\nimport { execFileSync } from 'node:child_process';\nimport { walkSrc } from './lib/srcfiles.js';\nimport { POLICY as FOUNDRY_API_POLICY } from '../tools/foundry-release-api.js';\n\nconst read = (p) => fs.readFileSync(p, 'utf8').replaceAll('\\r\\n', '\\n');\n// Counted the way `wc -l` counts — newlines, not `split('\\n').length`, which adds a phantom line for\n",
          "baseline": "import path from 'node:path';\nimport { execFileSync } from 'node:child_process';\nimport { walkSrc } from './lib/srcfiles.js';\n\nconst read = (p) => fs.readFileSync(p, 'utf8').replaceAll('\\r\\n', '\\n');\n// Counted the way `wc -l` counts — newlines, not `split('\\n').length`, which adds a phantom line for\n"
        },
        {
          "at": 69931,
          "current": "// CI failure cannot be reproduced locally, and this gate spent a session in that position with\n// three tests passing on the developer's machine and failing on the runner.\n//\n// The workflow runs the exact release API verifier. Its signed release policy supplies the pin;\n// an action channel or a version argument cannot substitute for that verified toolchain.\nconst expectedForgeFoundrySetup = '      - name: Install Foundry\\n        env:\\n          GH_TOKEN: ${{ github.token }}\\n        run: |\\n          node ../test/foundry-release-api.js\\n          node ../tools/foundry-release-api.js bootstrap';\nconst pinnedFoundryVersion = workflow => {\n  const steps = workflow.split(/(?=^      - (?:uses:|run:|name:))/m);\n  const setup = steps.filter(step => step.includes('      - name: Install Foundry'));\n  assert.equal(setup.length, 1, 'Exactly one unconditional verified Foundry setup is required');\n  assert.equal(setup[0].trimEnd(), expectedForgeFoundrySetup,\n    'Foundry setup keeps its step-scoped token, offline guard and cryptographic bootstrap in order');\n  for (const command of ['node ../test/foundry-release-api.js', 'node ../tools/foundry-release-api.js bootstrap'])\n    assert.equal(workflow.split(command).length, 2, 'Foundry validation and installation run exactly once');\n  assert(/^permissions:\\n  contents: read\\n/m.test(workflow), 'Installer token keeps read-only repository permissions');\n  assert(!/foundry-rs\\/foundry-toolchain@/.test(workflow), 'An action channel cannot replace the verified release API installer');\n  assert.equal(FOUNDRY_API_POLICY.version, 'v1.7.1');\n  assert.equal(FOUNDRY_API_POLICY.commit, '4072e48705af9d93e3c0f6e29e93b5e9a40caed8');\n  assert.equal(FOUNDRY_API_POLICY.archive.sha256, 'cf7e688ed0c4c48adffca788b496076e31060b67ac5afe1e43dbb5499c20c88b');\n  assert.equal(FOUNDRY_API_POLICY.pointer.sha256, 'c02be634804dc59dd1e2d27bb0be89dbe65e60a41e00598621db60f64819d052');\n  return FOUNDRY_API_POLICY.version.slice(1);\n};\n{\n  const wf = read('.github/workflows/forge.yml');\n  assert.equal(pinnedFoundryVersion(wf), '1.7.1');\n  for (const changed of [wf.replace(expectedForgeFoundrySetup, ''),\n    wf.replace(expectedForgeFoundrySetup, expectedForgeFoundrySetup + '\\n' + expectedForgeFoundrySetup),\n    wf.replace('        env:\\n          GH_TOKEN:', '        if: false\\n        env:\\n          GH_TOKEN:'),\n    wf.replace('        env:\\n          GH_TOKEN:', '        continue-on-error: true\\n        env:\\n          GH_TOKEN:'),\n    wf.replace('GH_TOKEN: ${{ github.token }}', 'GH_TOKEN: ${{ secrets.UNREVIEWED_TOKEN }}'),\n    wf.replace('node ../test/foundry-release-api.js', 'echo guard skipped'),\n    wf.replace('node ../tools/foundry-release-api.js bootstrap', 'echo synthetic compiler'),\n    wf.replace('bootstrap', 'bootstrap --version stable'),\n    wf.replace('bootstrap', 'bootstrap || true'),\n    wf.replace('  contents: read', '  contents: write')]) {\n    assert.notEqual(changed, wf, 'Every Foundry workflow mutation changes actual source');\n    assert.throws(() => pinnedFoundryVersion(changed), 'Missing, mutable, skipped or optional compiler verification must reject');\n  }\n  assert(/run:\\s*forge --version/.test(wf),\n    '.github/workflows/forge.yml no longer prints `forge --version`. The pin says which binary SHOULD '\n    + 'run; the banner is how the log says which one DID, without anybody having to guess at it.');\n",
          "baseline": "// CI failure cannot be reproduced locally, and this gate spent a session in that position with\n// three tests passing on the developer's machine and failing on the runner.\n//\n// The rule is deliberately two-sided, because half of it is not obvious: a `version` key alone is\n// not a pin. `stable` and `nightly` are CHANNELS — they satisfy \"a version is declared\" and still\n// resolve at run time, which is the state this guard exists to forbid wearing a version key.\n{\n  const wf = read('.github/workflows/forge.yml');\n  const step = wf.match(/uses:\\s*foundry-rs\\/foundry-toolchain@[^\\n]*\\n([\\s\\S]*?)(?=\\n\\s*-\\s|$)/);\n  assert(step, \".github/workflows/forge.yml no longer installs foundry-rs/foundry-toolchain — the \"\n    + 'extractor found no step to check, which reads exactly like a clean sweep. If the gate now '\n    + 'gets its compiler some other way, pin THAT and re-point this guard at it.');\n  const version = step[1].match(/^\\s*version:\\s*(\\S+)/m);\n  assert(version, '.github/workflows/forge.yml installs foundry-toolchain with NO `version:`, so it '\n    + 'resolves `stable` at run time. Every other dependency in this workflow is pinned by hand; the '\n    + 'compiler and test runner must be too, or a red gate cannot be reproduced locally.');\n  assert(!/^(stable|nightly|latest)$/i.test(version[1]),\n    `.github/workflows/forge.yml pins the toolchain to \"${version[1]}\", which is a CHANNEL rather `\n    + 'than a version — it still resolves at run time. Pin the release tag (e.g. v1.7.1), which is '\n    + 'the whole point: the log and the local run must be able to name the same binary.');\n  assert(/run:\\s*forge --version/.test(wf),\n    '.github/workflows/forge.yml no longer prints `forge --version`. The pin says which binary SHOULD '\n    + 'run; the banner is how the log says which one DID, without anybody having to guess at it.');\n"
        },
        {
          "at": 95449,
          "current": "  assert(pktForge, 'CHAIN-AUDIT-PACKET.md freezes a Foundry test count and names no toolchain version. '\n    + 'The count is version-dependent (invariant-only suites aggregate differently), so a figure without '\n    + 'a compiler beside it cannot be reproduced — name it');\n  const wfPin = pinnedFoundryVersion(read('.github/workflows/forge.yml'));\n  assert.equal(pktForge[1], wfPin,\n    `the packet says its rebuilt measurement will use forge v${pktForge[1]} while the workflow pins `\n    + `v${wfPin}. A stale toolchain claim beside a frozen figure is worse than none: it tells a `\n    + 'reader the count is reproducible under a compiler that is no longer the one that runs');\n\n  console.log(`✓ the audit packet agrees with itself (${tableContracts} contracts + ${tableIfaces} `\n",
          "baseline": "  assert(pktForge, 'CHAIN-AUDIT-PACKET.md freezes a Foundry test count and names no toolchain version. '\n    + 'The count is version-dependent (invariant-only suites aggregate differently), so a figure without '\n    + 'a compiler beside it cannot be reproduced — name it');\n  const wfPin = /foundry-toolchain@v1[\\s\\S]{0,200}?version:\\s*v?(\\d+\\.\\d+\\.\\d+)/\n    .exec(read('.github/workflows/forge.yml'));\n  assert(wfPin, 'the forge workflow has lost its pinned toolchain version — the packet cites one, so '\n    + 'this cross-check has nothing left to hold it to');\n  assert.equal(pktForge[1], wfPin[1],\n    `the packet says its rebuilt measurement will use forge v${pktForge[1]} while the workflow pins `\n    + `v${wfPin[1]}. A stale toolchain claim beside a frozen figure is worse than none: it tells a `\n    + 'reader the count is reproducible under a compiler that is no longer the one that runs');\n\n  console.log(`✓ the audit packet agrees with itself (${tableContracts} contracts + ${tableIfaces} `\n"
        },
        {
          "at": 103230,
          "current": "    + 'version-dependent count needs its compiler beside it wherever the count appears');\n  assert.equal(new Set(pktForge).size, 1,\n    `the O1 packet names two toolchains: ${[...new Set(pktForge)].join(' and ')}`);\n  const wfPin = pinnedFoundryVersion(read('.github/workflows/forge.yml'));\n  assert.equal(pktForge[0], wfPin,\n    `the O1 packet freezes its count under forge v${pktForge[0]} while the workflow pins v${wfPin}. `\n    + 'A stale toolchain claim beside a frozen figure is worse than none: it tells a reader the count is '\n    + 'reproducible under a compiler that is no longer the one that runs');\n\n",
          "baseline": "    + 'version-dependent count needs its compiler beside it wherever the count appears');\n  assert.equal(new Set(pktForge).size, 1,\n    `the O1 packet names two toolchains: ${[...new Set(pktForge)].join(' and ')}`);\n  const wfPin = /foundry-toolchain@v1[\\s\\S]{0,200}?version:\\s*v?(\\d+\\.\\d+\\.\\d+)/\n    .exec(read('.github/workflows/forge.yml'));\n  assert(wfPin, 'the forge workflow has lost its pinned toolchain version');\n  assert.equal(pktForge[0], wfPin[1],\n    `the O1 packet freezes its count under forge v${pktForge[0]} while the workflow pins v${wfPin[1]}. `\n    + 'A stale toolchain claim beside a frozen figure is worse than none: it tells a reader the count is '\n    + 'reproducible under a compiler that is no longer the one that runs');\n\n"
        }
      ]
    },
    "test/gates.js": {
      "current": {
        "mode": "100644",
        "blob": "b6d2f5d135c625a2f01452bee5b55bf2ea6b9db1",
        "sha256": "840b5dfa74c445eedff119addce4e9f572bea4dda149d70f1ea575989794a119",
        "bytes": 489461
      },
      "baseline": {
        "mode": "100644",
        "blob": "8f5ca07ccd23ea14667853781bb2565e7504a85d",
        "sha256": "ed5cb59910c768b4d125a8e4f3a57e02d9bf101d9d983179028f1dd0f6c09f3d",
        "bytes": 485787
      },
      "inverses": [
        {
          "at": 2027,
          "current": "import { DEED_QUEST_SOURCE_DOMAINS, deedQuestSourceBaseline } from '../tools/deed-quest-source-transfer.js';\nimport { QUESTING_SOURCE, qualifyQuestingSource } from '../tools/questing-source-transfer.js';\nimport { FOUNDRY_RELEASE, verifyFoundryArchive } from '../tools/ci-foundry.js';\nimport { POLICY as FOUNDRY_API_POLICY } from '../tools/foundry-release-api.js';\n\nconst expectedFoundryRelease = {\n  version: '1.7.1',\n",
          "baseline": "import { DEED_QUEST_SOURCE_DOMAINS, deedQuestSourceBaseline } from '../tools/deed-quest-source-transfer.js';\nimport { QUESTING_SOURCE, qualifyQuestingSource } from '../tools/questing-source-transfer.js';\nimport { FOUNDRY_RELEASE, verifyFoundryArchive } from '../tools/ci-foundry.js';\n\nconst expectedFoundryRelease = {\n  version: '1.7.1',\n"
        },
        {
          "at": 3870,
          "current": "Object.defineProperty(accessorArchive, 'bytes', { get() { archiveGetterRead = true; return foundryArchive.bytes; } });\nassert.throws(() => verifyFoundryArchive(accessorArchive), 'Archive verification must reject accessor records');\nassert.equal(archiveGetterRead, false, 'Archive verification must not execute caller-controlled accessors');\nassert.deepStrictEqual(FOUNDRY_API_POLICY, {\n  version: 'v1.7.1', repo: 'foundry-rs/foundry', repoId: '404320053', ownerId: '99892494',\n  ref: 'refs/tags/v1.7.1', commit: '4072e48705af9d93e3c0f6e29e93b5e9a40caed8',\n  identity: 'https://github.com/foundry-rs/foundry/.github/workflows/release.yml@refs/tags/v1.7.1',\n  issuer: 'https://token.actions.githubusercontent.com', predicate: 'https://slsa.dev/provenance/v1',\n  invocation: 'https://github.com/foundry-rs/foundry/actions/runs/25543860392/attempts/1',\n  archive: { id: 415095756, name: 'foundry_v1.7.1_linux_amd64.tar.gz', bytes: 98596412,\n    sha256: expectedFoundryRelease.sha256 },\n  pointer: { id: 415095753, name: 'foundry_v1.7.1_linux_amd64.attestation.txt', bytes: 60,\n    sha256: 'c02be634804dc59dd1e2d27bb0be89dbe65e60a41e00598621db60f64819d052',\n    url: 'https://github.com/foundry-rs/foundry/attestations/26850510' },\n  expandedBytes: 233564160,\n  binaries: {\n    forge: { bytes: 84666760, sha256: '4f77da0810de94325734855d0ad58d70640aa8a5b2a837608ddf8c26da34355c' },\n    cast: { bytes: 62663216, sha256: 'ccd95a4607ca3ebfcb88bb90e7235cdb7f0564f5f1afa17478d5fccabbb222cb' },\n    anvil: { bytes: 44330832, sha256: '10c1c727d6c1de973aeb160e59875b9a9a23464d6e74149ee8abb30b3500311b' },\n    chisel: { bytes: 41893784, sha256: 'a338965386e29b0f76122053031340128a6aca4ef1bbc1ed764b82d2b2ea269d' },\n  },\n}, 'The API installer retains the exact release, signing identity and all five signed subject digests');\nfor (const value of [FOUNDRY_API_POLICY, FOUNDRY_API_POLICY.archive, FOUNDRY_API_POLICY.pointer,\n  FOUNDRY_API_POLICY.binaries, ...Object.values(FOUNDRY_API_POLICY.binaries)])\n  assert(Object.isFrozen(value), 'The API verification policy is deeply immutable');\n\nconst SRC = fileURLToPath(new URL('../src/', import.meta.url));\nconst relPath = (from, to) => path.relative(from, to).replaceAll('\\\\', '/');\n",
          "baseline": "Object.defineProperty(accessorArchive, 'bytes', { get() { archiveGetterRead = true; return foundryArchive.bytes; } });\nassert.throws(() => verifyFoundryArchive(accessorArchive), 'Archive verification must reject accessor records');\nassert.equal(archiveGetterRead, false, 'Archive verification must not execute caller-controlled accessors');\n\nconst SRC = fileURLToPath(new URL('../src/', import.meta.url));\nconst relPath = (from, to) => path.relative(from, to).replaceAll('\\\\', '/');\n"
        },
        {
          "at": 353972,
          "current": "{\n  const ROOT = fileURLToPath(new URL('../', import.meta.url));\n  const ci = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');\n  const assertFoundryPermissions = workflow => assert(/^permissions:\\n  contents: read\\n/m.test(workflow.replaceAll('\\r\\n', '\\n')),\n    'The Foundry API installer uses a read-only repository token');\n  assertFoundryPermissions(ci);\n  const writableFoundryToken = ci.replace('  contents: read', '  contents: write');\n  assert.notEqual(writableFoundryToken, ci);\n  assert.throws(() => assertFoundryPermissions(writableFoundryToken));\n  const jobsHeader = /^jobs:\\s*$/m.exec(ci);\n  assert(jobsHeader, '.github/workflows/ci.yml has no top-level `jobs:` block');\n  const jobsText = ci.slice(jobsHeader.index + jobsHeader[0].length);\n",
          "baseline": "{\n  const ROOT = fileURLToPath(new URL('../', import.meta.url));\n  const ci = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');\n  const jobsHeader = /^jobs:\\s*$/m.exec(ci);\n  assert(jobsHeader, '.github/workflows/ci.yml has no top-level `jobs:` block');\n  const jobsText = ci.slice(jobsHeader.index + jobsHeader[0].length);\n"
        },
        {
          "at": 356082,
          "current": "  const nativeShape = block => block.replaceAll('\\r\\n', '\\n').split('\\n')\n    .filter(line => line.trim() && !/^\\s*#/.test(line)).map(line => line.trimEnd()).join('\\n');\n  const expectedQuestBrowser = \"  questing_browser:\\n    name: Quest acceptance and browser playthroughs\\n    runs-on: ubuntu-latest\\n    timeout-minutes: 15\\n    steps:\\n      - uses: actions/checkout@v7\\n        with:\\n          fetch-depth: 0\\n      - uses: actions/setup-node@v7\\n        with:\\n          node-version: '22'\\n          cache: npm\\n      - run: npm ci\\n      - run: npx playwright-core install --with-deps chromium\\n      - name: Quest source and current native admission guards\\n        run: |\\n          node test/questing-source-transfer.js\\n          node test/enterprise-native-questing-guard.js\\n          node test/questing-enterprise-catalog-guard.js\\n          node test/questing-ux-release-phase2-native-catalog-guard.js\\n          node test/rc1-npc-retirement-journal.js\\n          node test/genesis-fee-readiness-source-transfer.js\\n      - name: Quest runtime, cases and community workshop\\n        run: npm run test:questing\\n      - name: Production quest and clue interfaces\\n        run: |\\n          export CHROMIUM_PATH=\\\"$(node --input-type=module -e 'import { chromium } from \\\"playwright-core\\\"; process.stdout.write(chromium.executablePath());')\\\"\\n          npm run test:questing:browser\\n      - run: npm run questing:check\";\n  const expectedQuestNative = \"  questing_native:\\n    name: Quest authority and concurrency (PostgreSQL)\\n    runs-on: ubuntu-latest\\n    timeout-minutes: 30\\n    services:\\n      postgres:\\n        image: postgres:18.4\\n        env:\\n          POSTGRES_PASSWORD: pgcheck\\n          POSTGRES_DB: omerta_questing_ci\\n        ports:\\n          - 5432:5432\\n        options: >-\\n          --health-cmd \\\"pg_isready -U postgres\\\"\\n          --health-interval 5s\\n          --health-timeout 5s\\n          --health-retries 12\\n    steps:\\n      - uses: actions/checkout@v7\\n        with:\\n          fetch-depth: 0\\n      - uses: actions/setup-node@v7\\n        with:\\n          node-version: '22'\\n          cache: npm\\n      - run: npm ci\\n      - name: Set owned test PostgreSQL lock capacity for populated migrations\\n        timeout-minutes: 3\\n        shell: bash\\n        env:\\n          POSTGRES_SERVICE_ID: ${{ job.services.postgres.id }}\\n        run: |\\n          set -euo pipefail\\n          [[ \\\"$POSTGRES_SERVICE_ID\\\" =~ ^[0-9a-f]{64}$ ]] || { echo 'Missing owned PostgreSQL service container ID' >&2; exit 1; }\\n          timeout 15s docker exec \\\"$POSTGRES_SERVICE_ID\\\" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'ALTER SYSTEM SET max_locks_per_transaction = 512;'\\n          timeout 45s docker restart --timeout 30 \\\"$POSTGRES_SERVICE_ID\\\"\\n          ready=0\\n          deadline=$((SECONDS + 60))\\n          while (( SECONDS < deadline )); do\\n            if timeout 3s docker exec \\\"$POSTGRES_SERVICE_ID\\\" pg_isready -q -t 1 -U postgres -d postgres; then\\n              ready=1\\n              break\\n            fi\\n            sleep 1\\n          done\\n          [[ \\\"$ready\\\" == 1 ]] || { echo 'Owned PostgreSQL service did not become ready within 60 seconds' >&2; exit 1; }\\n          actual=\\\"$(timeout 10s docker exec \\\"$POSTGRES_SERVICE_ID\\\" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc 'SHOW max_locks_per_transaction;')\\\"\\n          [[ \\\"$actual\\\" == 512 ]] || { echo \\\"Unexpected test max_locks_per_transaction: $actual\\\" >&2; exit 1; }\\n      - name: Create fresh owned migration fixture databases\\n        timeout-minutes: 1\\n        run: |\\n          node --input-type=module <<'NODE'\\n          import assert from 'node:assert/strict';\\n          import pg from 'pg';\\n          const client = new pg.Client({ connectionString: 'postgres://postgres:pgcheck@127.0.0.1:5432/postgres', connectionTimeoutMillis: 10000, query_timeout: 30000 });\\n          try {\\n            await client.connect();\\n            assert.deepEqual((await client.query('SELECT current_user AS role,current_database() AS database,inet_server_port() AS port')).rows,\\n              [{ role: 'postgres', database: 'postgres', port: 5432 }]);\\n            const existing = await client.query('SELECT datname FROM pg_database WHERE datname IN ($1,$2)', ['omerta_check', 'omerta_query']);\\n            assert.deepEqual(existing.rows, [], 'Owned migration fixture databases must not pre-exist');\\n            await client.query('CREATE DATABASE omerta_check');\\n            await client.query('CREATE DATABASE omerta_query');\\n            assert.deepEqual((await client.query('SELECT datname,pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname IN ($1,$2) ORDER BY datname', ['omerta_check', 'omerta_query'])).rows,\\n              [{ datname: 'omerta_check', owner: 'postgres' }, { datname: 'omerta_query', owner: 'postgres' }]);\\n          } finally { await client.end(); }\\n          NODE\\n      - name: Populated phase2 and Director migration regression\\n        run: |\\n          set -euo pipefail\\n          (\\n            export TEST_DATABASE_URL=postgres://postgres:pgcheck@127.0.0.1:5432/omerta_check\\n            phase2_status=0\\n            npm run phase2:definitions:postgres || phase2_status=1\\n            npm run phase2:lots:postgres || phase2_status=1\\n            exit \\\"$phase2_status\\\"\\n          ) > \\\"$RUNNER_TEMP/questing-phase2-migrations.log\\\" 2>&1 &\\n          phase2_pid=$!\\n          (\\n            export COORDINATION_TEST_DATABASE_URL=postgres://postgres:pgcheck@127.0.0.1:5432/omerta_query\\n            node test/director-migration.js --postgres\\n          ) > \\\"$RUNNER_TEMP/questing-director-migration.log\\\" 2>&1 &\\n          director_pid=$!\\n          result=0\\n          wait \\\"$phase2_pid\\\" || result=1\\n          wait \\\"$director_pid\\\" || result=1\\n          cat \\\"$RUNNER_TEMP/questing-phase2-migrations.log\\\"\\n          cat \\\"$RUNNER_TEMP/questing-director-migration.log\\\"\\n          exit \\\"$result\\\"\\n      - name: Native invitation, handoff and receipt races\\n        env:\\n          QUESTING_TEST_DATABASE_URL: postgres://postgres:pgcheck@127.0.0.1:5432/omerta_questing_ci\\n          JWT_SECRET: ci-questing-jwt-not-a-real-secret\\n          MOD_KEY: ci-questing-mod-not-a-real-secret\\n          MARKET_SEED: ciQuestingMarketSeed7Qx2mVb9PwLn4\\n          SOCIAL_VERIFY_MODE: 'off'\\n          POPULATION_OFF: 'on'\\n        run: npm run test:questing:postgres\";\n  const assertQuestJobs = (browserBlock, nativeBlock) => {\n    assert.equal(nativeShape(browserBlock), expectedQuestBrowser, 'The quest browser job retains complete pure guards, cases and real browser commands without database authority');\n    assert.equal(nativeShape(nativeBlock), expectedQuestNative, 'The quest authority job retains its isolated PostgreSQL18 service, owned lock setup and real native endpoint/command');\n",
          "baseline": "  const nativeShape = block => block.replaceAll('\\r\\n', '\\n').split('\\n')\n    .filter(line => line.trim() && !/^\\s*#/.test(line)).map(line => line.trimEnd()).join('\\n');\n  const expectedQuestBrowser = \"  questing_browser:\\n    name: Quest acceptance and browser playthroughs\\n    runs-on: ubuntu-latest\\n    timeout-minutes: 15\\n    steps:\\n      - uses: actions/checkout@v7\\n        with:\\n          fetch-depth: 0\\n      - uses: actions/setup-node@v7\\n        with:\\n          node-version: '22'\\n          cache: npm\\n      - run: npm ci\\n      - run: npx playwright-core install --with-deps chromium\\n      - name: Quest source and current native admission guards\\n        run: |\\n          node test/questing-source-transfer.js\\n          node test/enterprise-native-questing-guard.js\\n          node test/questing-enterprise-catalog-guard.js\\n          node test/questing-ux-release-phase2-native-catalog-guard.js\\n          node test/rc1-npc-retirement-journal.js\\n          node test/genesis-fee-readiness-source-transfer.js\\n      - name: Quest runtime, cases and community workshop\\n        run: npm run test:questing\\n      - name: Production quest and clue interfaces\\n        run: |\\n          export CHROMIUM_PATH=\\\"$(node --input-type=module -e 'import { chromium } from \\\"playwright-core\\\"; process.stdout.write(chromium.executablePath());')\\\"\\n          npm run test:questing:browser\\n      - run: npm run questing:check\";\n  const expectedQuestNative = \"  questing_native:\\n    name: Quest authority and concurrency (PostgreSQL)\\n    runs-on: ubuntu-latest\\n    timeout-minutes: 15\\n    services:\\n      postgres:\\n        image: postgres:18.4\\n        env:\\n          POSTGRES_PASSWORD: pgcheck\\n          POSTGRES_DB: omerta_questing_ci\\n        ports:\\n          - 5432:5432\\n        options: >-\\n          --health-cmd \\\"pg_isready -U postgres\\\"\\n          --health-interval 5s\\n          --health-timeout 5s\\n          --health-retries 12\\n    steps:\\n      - uses: actions/checkout@v7\\n        with:\\n          fetch-depth: 0\\n      - uses: actions/setup-node@v7\\n        with:\\n          node-version: '22'\\n          cache: npm\\n      - run: npm ci\\n      - name: Set owned test PostgreSQL lock capacity for populated migrations\\n        timeout-minutes: 3\\n        shell: bash\\n        env:\\n          POSTGRES_SERVICE_ID: ${{ job.services.postgres.id }}\\n        run: |\\n          set -euo pipefail\\n          [[ \\\"$POSTGRES_SERVICE_ID\\\" =~ ^[0-9a-f]{64}$ ]] || { echo 'Missing owned PostgreSQL service container ID' >&2; exit 1; }\\n          timeout 15s docker exec \\\"$POSTGRES_SERVICE_ID\\\" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'ALTER SYSTEM SET max_locks_per_transaction = 512;'\\n          timeout 45s docker restart --timeout 30 \\\"$POSTGRES_SERVICE_ID\\\"\\n          ready=0\\n          deadline=$((SECONDS + 60))\\n          while (( SECONDS < deadline )); do\\n            if timeout 3s docker exec \\\"$POSTGRES_SERVICE_ID\\\" pg_isready -q -t 1 -U postgres -d postgres; then\\n              ready=1\\n              break\\n            fi\\n            sleep 1\\n          done\\n          [[ \\\"$ready\\\" == 1 ]] || { echo 'Owned PostgreSQL service did not become ready within 60 seconds' >&2; exit 1; }\\n          actual=\\\"$(timeout 10s docker exec \\\"$POSTGRES_SERVICE_ID\\\" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc 'SHOW max_locks_per_transaction;')\\\"\\n          [[ \\\"$actual\\\" == 512 ]] || { echo \\\"Unexpected test max_locks_per_transaction: $actual\\\" >&2; exit 1; }\\n      - name: Create fresh owned migration fixture databases\\n        timeout-minutes: 1\\n        run: |\\n          node --input-type=module <<'NODE'\\n          import assert from 'node:assert/strict';\\n          import pg from 'pg';\\n          const client = new pg.Client({ connectionString: 'postgres://postgres:pgcheck@127.0.0.1:5432/postgres', connectionTimeoutMillis: 10000, query_timeout: 30000 });\\n          try {\\n            await client.connect();\\n            assert.deepEqual((await client.query('SELECT current_user AS role,current_database() AS database,inet_server_port() AS port')).rows,\\n              [{ role: 'postgres', database: 'postgres', port: 5432 }]);\\n            const existing = await client.query('SELECT datname FROM pg_database WHERE datname IN ($1,$2)', ['omerta_check', 'omerta_query']);\\n            assert.deepEqual(existing.rows, [], 'Owned migration fixture databases must not pre-exist');\\n            await client.query('CREATE DATABASE omerta_check');\\n            await client.query('CREATE DATABASE omerta_query');\\n            assert.deepEqual((await client.query('SELECT datname,pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname IN ($1,$2) ORDER BY datname', ['omerta_check', 'omerta_query'])).rows,\\n              [{ datname: 'omerta_check', owner: 'postgres' }, { datname: 'omerta_query', owner: 'postgres' }]);\\n          } finally { await client.end(); }\\n          NODE\\n      - name: Populated phase2 and Director migration regression\\n        run: |\\n          set -euo pipefail\\n          (\\n            export TEST_DATABASE_URL=postgres://postgres:pgcheck@127.0.0.1:5432/omerta_check\\n            phase2_status=0\\n            npm run phase2:definitions:postgres || phase2_status=1\\n            npm run phase2:lots:postgres || phase2_status=1\\n            exit \\\"$phase2_status\\\"\\n          ) > \\\"$RUNNER_TEMP/questing-phase2-migrations.log\\\" 2>&1 &\\n          phase2_pid=$!\\n          (\\n            export COORDINATION_TEST_DATABASE_URL=postgres://postgres:pgcheck@127.0.0.1:5432/omerta_query\\n            node test/director-migration.js --postgres\\n          ) > \\\"$RUNNER_TEMP/questing-director-migration.log\\\" 2>&1 &\\n          director_pid=$!\\n          result=0\\n          wait \\\"$phase2_pid\\\" || result=1\\n          wait \\\"$director_pid\\\" || result=1\\n          cat \\\"$RUNNER_TEMP/questing-phase2-migrations.log\\\"\\n          cat \\\"$RUNNER_TEMP/questing-director-migration.log\\\"\\n          exit \\\"$result\\\"\\n      - name: Native invitation, handoff and receipt races\\n        env:\\n          QUESTING_TEST_DATABASE_URL: postgres://postgres:pgcheck@127.0.0.1:5432/omerta_questing_ci\\n          JWT_SECRET: ci-questing-jwt-not-a-real-secret\\n          MOD_KEY: ci-questing-mod-not-a-real-secret\\n          MARKET_SEED: ciQuestingMarketSeed7Qx2mVb9PwLn4\\n          SOCIAL_VERIFY_MODE: 'off'\\n          POPULATION_OFF: 'on'\\n        run: npm run test:questing:postgres\";\n  const assertQuestJobs = (browserBlock, nativeBlock) => {\n    assert.equal(nativeShape(browserBlock), expectedQuestBrowser, 'The quest browser job retains complete pure guards, cases and real browser commands without database authority');\n    assert.equal(nativeShape(nativeBlock), expectedQuestNative, 'The quest authority job retains its isolated PostgreSQL18 service, owned lock setup and real native endpoint/command');\n"
        },
        {
          "at": 365082,
          "current": "    expectedQuestNative.replace('image: postgres:18.4', 'image: postgres:16'),\n    expectedQuestNative.replace('image: postgres:18.4', 'image: postgres:18'),\n    expectedQuestNative.replace('image: postgres:18.4', 'image: postgres:18.6'),\n    expectedQuestNative.replace('timeout-minutes: 30', 'timeout-minutes: 150'),\n    expectedQuestNative.replace('    runs-on:', '    if: false\\n    runs-on:'),\n    expectedQuestNative.replace('    runs-on:', '    continue-on-error: true\\n    runs-on:'),\n    expectedQuestNative.replace('127.0.0.1:5432', 'remote.invalid:5432'),\n",
          "baseline": "    expectedQuestNative.replace('image: postgres:18.4', 'image: postgres:16'),\n    expectedQuestNative.replace('image: postgres:18.4', 'image: postgres:18'),\n    expectedQuestNative.replace('image: postgres:18.4', 'image: postgres:18.6'),\n    expectedQuestNative.replace('timeout-minutes: 15', 'timeout-minutes: 150'),\n    expectedQuestNative.replace('    runs-on:', '    if: false\\n    runs-on:'),\n    expectedQuestNative.replace('    runs-on:', '    continue-on-error: true\\n    runs-on:'),\n    expectedQuestNative.replace('127.0.0.1:5432', 'remote.invalid:5432'),\n"
        },
        {
          "at": 367378,
          "current": "  assert.throws(() => assertQuestJobs(expectedQuestNative, expectedQuestBrowser), 'Native authority cannot substitute for browser interaction coverage');\n  assert.equal(nativeShape(nativeGate), \"  pgcheck:\\n    if: ${{ always() && !inputs.tail_only }}\\n    name: real Postgres (${{ matrix.postgres }})\\n    needs: [pgcheck_core, pgcheck_economy, pgcheck_enterprise, pgcheck_commerce]\\n    runs-on: ubuntu-latest\\n    timeout-minutes: 5\\n    strategy:\\n      fail-fast: false\\n      matrix:\\n        postgres: ['16', '18.4']\\n    steps:\\n      - name: Require all four complete native cohorts\\n        env:\\n          CORE_RESULT: ${{ needs.pgcheck_core.result }}\\n          ECONOMY_RESULT: ${{ needs.pgcheck_economy.result }}\\n          ENTERPRISE_RESULT: ${{ needs.pgcheck_enterprise.result }}\\n          COMMERCE_RESULT: ${{ needs.pgcheck_commerce.result }}\\n        run: |\\n          test \\\"$CORE_RESULT\\\" = success\\n          test \\\"$ECONOMY_RESULT\\\" = success\\n          test \\\"$ENTERPRISE_RESULT\\\" = success\\n          test \\\"$COMMERCE_RESULT\\\" = success\", 'Required native identities must fail closed on failure, cancellation or a skipped cohort');\n  const splitNative = block => { const pieces = block.replaceAll('\\r\\n', '\\n').split(/(?=^      - (?:uses:|run:|name:))/m); return { header: pieces.shift(), steps: pieces }; };\n  const expectedFoundrySetup = '      - name: Install verified pinned Foundry\\n        env:\\n          GH_TOKEN: ${{ github.token }}\\n        run: |\\n          node test/foundry-release-api.js\\n          node tools/foundry-release-api.js bootstrap';\n  const expectedArtifactStep = '      - name: Compile original funded-work escrow artifact\\n        run: npm run build:funded-work-artifact';\n  const assertPinnedFoundrySetup = block => {\n    const steps = splitNative(block).steps;\n    const matching = steps.filter(step => step.includes('      - name: Install verified pinned Foundry'));\n    assert.equal(matching.length, 1, 'Exactly one complete pinned compiler setup is required');\n    assert.equal(nativeShape(matching[0]), nativeShape(expectedFoundrySetup),\n      'Pinned compiler setup keeps its step-scoped token, offline guard and unconditional cryptographic bootstrap');\n    for (const command of ['node test/foundry-release-api.js', 'node tools/foundry-release-api.js bootstrap'])\n      assert.equal(steps.filter(step => nativeShape(step).includes(command)).length, 1,\n        'The compiler guard and installer cannot be invoked a second time or under another step');\n    assert.equal(nativeShape(steps[steps.indexOf(matching[0]) + 1] || ''), expectedArtifactStep,\n      'The genuine artifact build immediately follows verified compiler setup');\n    return matching[0];\n",
          "baseline": "  assert.throws(() => assertQuestJobs(expectedQuestNative, expectedQuestBrowser), 'Native authority cannot substitute for browser interaction coverage');\n  assert.equal(nativeShape(nativeGate), \"  pgcheck:\\n    if: ${{ always() && !inputs.tail_only }}\\n    name: real Postgres (${{ matrix.postgres }})\\n    needs: [pgcheck_core, pgcheck_economy, pgcheck_enterprise, pgcheck_commerce]\\n    runs-on: ubuntu-latest\\n    timeout-minutes: 5\\n    strategy:\\n      fail-fast: false\\n      matrix:\\n        postgres: ['16', '18.4']\\n    steps:\\n      - name: Require all four complete native cohorts\\n        env:\\n          CORE_RESULT: ${{ needs.pgcheck_core.result }}\\n          ECONOMY_RESULT: ${{ needs.pgcheck_economy.result }}\\n          ENTERPRISE_RESULT: ${{ needs.pgcheck_enterprise.result }}\\n          COMMERCE_RESULT: ${{ needs.pgcheck_commerce.result }}\\n        run: |\\n          test \\\"$CORE_RESULT\\\" = success\\n          test \\\"$ECONOMY_RESULT\\\" = success\\n          test \\\"$ENTERPRISE_RESULT\\\" = success\\n          test \\\"$COMMERCE_RESULT\\\" = success\", 'Required native identities must fail closed on failure, cancellation or a skipped cohort');\n  const splitNative = block => { const pieces = block.replaceAll('\\r\\n', '\\n').split(/(?=^      - (?:uses:|run:|name:))/m); return { header: pieces.shift(), steps: pieces }; };\n  const expectedFoundrySetup = '      - name: Install pinned Foundry 1.7.1\\n        timeout-minutes: 5\\n        run: node tools/ci-foundry.js';\n  const expectedArtifactStep = '      - name: Compile original funded-work escrow artifact\\n        run: npm run build:funded-work-artifact';\n  const assertPinnedFoundrySetup = block => {\n    const steps = splitNative(block).steps;\n    const matching = steps.filter(step => step.includes('      - name: Install pinned Foundry 1.7.1'));\n    assert.equal(matching.length, 1, 'Exactly one complete pinned compiler setup is required');\n    assert.equal(nativeShape(matching[0]), nativeShape(expectedFoundrySetup),\n      'Pinned compiler setup keeps its finite bound and bare, unconditional verifier command');\n    assert.equal(steps.filter(step => nativeShape(step).includes('node tools/ci-foundry.js')).length, 1,\n      'The compiler installer cannot be invoked a second time or under another step');\n    assert.equal(nativeShape(steps[steps.indexOf(matching[0]) + 1] || ''), expectedArtifactStep,\n      'The genuine artifact build immediately follows verified compiler setup');\n    return matching[0];\n"
        },
        {
          "at": 370314,
          "current": "  }\n  const foundryControlJob = economyNative.replaceAll('\\r\\n', '\\n');\n  assert.equal(foundryControlJob.split(expectedFoundrySetup).length, 2);\n  for (const drift of [expectedFoundrySetup.replace('        env:', '        timeout-minutes: 0\\n        env:'),\n    expectedFoundrySetup.replace('        env:', '        timeout-minutes: 50\\n        env:'),\n    expectedFoundrySetup.replace('        run:', '        if: false\\n        run:'),\n    expectedFoundrySetup.replace('        run:', '        continue-on-error: true\\n        run:'),\n    expectedFoundrySetup.replace('bootstrap', 'bootstrap --version stable'),\n    expectedFoundrySetup.replace('bootstrap', 'bootstrap || true'),\n    expectedFoundrySetup.replace('node tools/foundry-release-api.js bootstrap', 'echo synthetic compiler'),\n    expectedFoundrySetup.replace('node test/foundry-release-api.js', 'echo guard skipped'),\n    expectedFoundrySetup.replace('GH_TOKEN: ${{ github.token }}', 'GH_TOKEN: ${{ secrets.UNREVIEWED_TOKEN }}'),\n    expectedFoundrySetup.replace('          node test/foundry-release-api.js\\n          node tools/foundry-release-api.js bootstrap',\n      '          node tools/foundry-release-api.js bootstrap\\n          node test/foundry-release-api.js')]) {\n    assert.notEqual(drift, expectedFoundrySetup, 'Every compiler setup mutation must change actual workflow bytes');\n    assert.throws(() => assertPinnedFoundrySetup(foundryControlJob.replace(expectedFoundrySetup, drift)),\n      'Skipped, optional, unbounded, mutable-version or fake compiler setup must reject');\n  }\n  assert.throws(() => assertPinnedFoundrySetup(foundryControlJob.replace(expectedFoundrySetup, '')));\n  assert.throws(() => assertPinnedFoundrySetup(foundryControlJob.replace(expectedFoundrySetup,\n    expectedFoundrySetup + '\\n' + expectedFoundrySetup)));\n",
          "baseline": "  }\n  const foundryControlJob = economyNative.replaceAll('\\r\\n', '\\n');\n  assert.equal(foundryControlJob.split(expectedFoundrySetup).length, 2);\n  for (const drift of [expectedFoundrySetup.replace('timeout-minutes: 5', 'timeout-minutes: 0'),\n    expectedFoundrySetup.replace('timeout-minutes: 5', 'timeout-minutes: 50'),\n    expectedFoundrySetup.replace('        run:', '        if: false\\n        run:'),\n    expectedFoundrySetup.replace('        run:', '        continue-on-error: true\\n        run:'),\n    expectedFoundrySetup.replace('node tools/ci-foundry.js', 'node tools/ci-foundry.js --version stable'),\n    expectedFoundrySetup.replace('node tools/ci-foundry.js', 'node tools/ci-foundry.js || true'),\n    expectedFoundrySetup.replace('node tools/ci-foundry.js', 'echo synthetic compiler')])\n    assert.throws(() => assertPinnedFoundrySetup(foundryControlJob.replace(expectedFoundrySetup, drift)),\n      'Skipped, optional, unbounded, mutable-version or fake compiler setup must reject');\n  assert.throws(() => assertPinnedFoundrySetup(foundryControlJob.replace(expectedFoundrySetup, '')));\n  assert.throws(() => assertPinnedFoundrySetup(foundryControlJob.replace(expectedFoundrySetup,\n    expectedFoundrySetup + '\\n' + expectedFoundrySetup)));\n"
        },
        {
          "at": 378539,
          "current": "  assert.throws(()=>assertOwnedLockSetup(ownedSetupCore.replace(expectedOwnedLockSetup,expectedOwnedLockSetup+expectedOwnedLockSetup)),'Duplicate owned lock setup must reject');\n  assert.equal(nativeShape(coreParts.header), \"  pgcheck_core:\\n    if: ${{ !inputs.tail_only }}\\n    name: native core (${{ matrix.postgres }})\\n    runs-on: ubuntu-latest\\n    timeout-minutes: 120\\n    strategy:\\n      fail-fast: false\\n      matrix:\\n        postgres: ['16', '18.4']\\n    services:\\n      postgres:\\n        image: ${{ matrix.postgres == '16' && 'docker.io/library/postgres@sha256:ca0bd484cb98bf4b24eb1010e73fb3fcbd6714d240fbc1a10eea5b7dbecb641d' || 'docker.io/library/postgres@sha256:a02db8cac496f15b094798a38254f14d6e00741f709360e5e00bb6668ea31636' }}\\n        env:\\n          POSTGRES_PASSWORD: pgcheck\\n          POSTGRES_DB: omerta_check\\n        ports: ['5432:5432']\\n        options: >-\\n          --shm-size=256m\\n          --health-cmd \\\"pg_isready -U postgres\\\"\\n          --health-interval 5s --health-timeout 5s --health-retries 20\\n    steps:\", 'Native core service, matrix and finite bound are closed');\n  assert.equal(nativeShape(economyParts.header), \"  pgcheck_economy:\\n    if: ${{ !inputs.tail_only }}\\n    name: native economy (${{ matrix.postgres }})\\n    runs-on: ubuntu-latest\\n    timeout-minutes: 90\\n    strategy:\\n      fail-fast: false\\n      matrix:\\n        postgres: ['16', '18.4']\\n    services:\\n      postgres:\\n        image: ${{ matrix.postgres == '16' && 'docker.io/library/postgres@sha256:ca0bd484cb98bf4b24eb1010e73fb3fcbd6714d240fbc1a10eea5b7dbecb641d' || 'docker.io/library/postgres@sha256:a02db8cac496f15b094798a38254f14d6e00741f709360e5e00bb6668ea31636' }}\\n        env:\\n          POSTGRES_PASSWORD: pgcheck\\n          POSTGRES_DB: omerta_check\\n        ports: ['5432:5432']\\n        options: >-\\n          --health-cmd \\\"pg_isready -U postgres\\\"\\n          --health-interval 5s --health-timeout 5s --health-retries 20\\n    steps:\", 'Native economy service, matrix and finite bound are closed');\n  const expectedEconomyParts = [\"      - uses: actions/checkout@v7\\n        with:\\n          fetch-depth: 0\",\"      - uses: actions/setup-node@v7\\n        with:\\n          node-version: '22'\\n          cache: npm\",\"      - run: npm ci\",\"      - name: Install verified pinned Foundry\\n        env:\\n          GH_TOKEN: ${{ github.token }}\\n        run: |\\n          node test/foundry-release-api.js\\n          node tools/foundry-release-api.js bootstrap\",\"      - name: Compile original funded-work escrow artifact\\n        run: npm run build:funded-work-artifact\",\"      - name: Install PostgreSQL client tools matching the server major\\n        run: bash tools/rc1-postgres-client.sh '${{ matrix.postgres }}'\",\"      - name: Paid equipment, canonical repairs, negotiated deliveries, subscriptions and auctions (real PostgreSQL)\\n        if: '!cancelled()'\\n        env:\\n          RESOURCE_ECONOMY: 'off'\\n          EQUIPMENT_ECONOMY_NATIVE_ADMIN_DATABASE_URL: postgresql://postgres:pgcheck@127.0.0.1:5432/postgres\\n        run: npm run test:equipment-economy:postgres\",\"      - name: Funded apprenticeships, Crew organizations, partnerships, governance and actual acquisitions (real PostgreSQL)\\n        if: '!cancelled()'\\n        env:\\n          RESOURCE_ECONOMY: 'off'\\n          COMPANY_WORKFORCE_NATIVE_ADMIN_DATABASE_URL: postgresql://postgres:pgcheck@127.0.0.1:5432/postgres\\n        run: npm run test:company-workforce:postgres\",\"      - name: Restructuring, canonical disputes, insurance, concessions and territory sharing (real PostgreSQL)\\n        if: '!cancelled()'\\n        env:\\n          RESOURCE_ECONOMY: 'off'\\n          COMPANY_COMMERCIAL_NATIVE_ADMIN_DATABASE_URL: postgresql://postgres:pgcheck@127.0.0.1:5432/postgres\\n        run: npm run test:company-commercial:postgres\",\"      - name: Economic intelligence, laboratories, operating memory, teams and offline funded work (real PostgreSQL)\\n        if: '!cancelled()'\\n        env:\\n          RESOURCE_ECONOMY: 'off'\\n          COMPANY_AUTONOMY_NATIVE_ADMIN_DATABASE_URL: postgresql://postgres:pgcheck@127.0.0.1:5432/postgres\\n        run: npm run test:company-autonomy:postgres\"];\n  assert.deepEqual(economyParts.steps.map(nativeShape), expectedEconomyParts, 'Every native economy setup, command, environment and condition remains exact');\n  const expectedEnterpriseOwnedLockSetup = expectedOwnedLockSetup.replace('Set owned test PostgreSQL lock capacity for populated migrations','Set owned enterprise test PostgreSQL lock capacity for full-schema catalog cleanup');\n  const assertEnterpriseOwnedLockSetup = block => {\n",
          "baseline": "  assert.throws(()=>assertOwnedLockSetup(ownedSetupCore.replace(expectedOwnedLockSetup,expectedOwnedLockSetup+expectedOwnedLockSetup)),'Duplicate owned lock setup must reject');\n  assert.equal(nativeShape(coreParts.header), \"  pgcheck_core:\\n    if: ${{ !inputs.tail_only }}\\n    name: native core (${{ matrix.postgres }})\\n    runs-on: ubuntu-latest\\n    timeout-minutes: 120\\n    strategy:\\n      fail-fast: false\\n      matrix:\\n        postgres: ['16', '18.4']\\n    services:\\n      postgres:\\n        image: ${{ matrix.postgres == '16' && 'docker.io/library/postgres@sha256:ca0bd484cb98bf4b24eb1010e73fb3fcbd6714d240fbc1a10eea5b7dbecb641d' || 'docker.io/library/postgres@sha256:a02db8cac496f15b094798a38254f14d6e00741f709360e5e00bb6668ea31636' }}\\n        env:\\n          POSTGRES_PASSWORD: pgcheck\\n          POSTGRES_DB: omerta_check\\n        ports: ['5432:5432']\\n        options: >-\\n          --shm-size=256m\\n          --health-cmd \\\"pg_isready -U postgres\\\"\\n          --health-interval 5s --health-timeout 5s --health-retries 20\\n    steps:\", 'Native core service, matrix and finite bound are closed');\n  assert.equal(nativeShape(economyParts.header), \"  pgcheck_economy:\\n    if: ${{ !inputs.tail_only }}\\n    name: native economy (${{ matrix.postgres }})\\n    runs-on: ubuntu-latest\\n    timeout-minutes: 90\\n    strategy:\\n      fail-fast: false\\n      matrix:\\n        postgres: ['16', '18.4']\\n    services:\\n      postgres:\\n        image: ${{ matrix.postgres == '16' && 'docker.io/library/postgres@sha256:ca0bd484cb98bf4b24eb1010e73fb3fcbd6714d240fbc1a10eea5b7dbecb641d' || 'docker.io/library/postgres@sha256:a02db8cac496f15b094798a38254f14d6e00741f709360e5e00bb6668ea31636' }}\\n        env:\\n          POSTGRES_PASSWORD: pgcheck\\n          POSTGRES_DB: omerta_check\\n        ports: ['5432:5432']\\n        options: >-\\n          --health-cmd \\\"pg_isready -U postgres\\\"\\n          --health-interval 5s --health-timeout 5s --health-retries 20\\n    steps:\", 'Native economy service, matrix and finite bound are closed');\n  const expectedEconomyParts = [\"      - uses: actions/checkout@v7\\n        with:\\n          fetch-depth: 0\",\"      - uses: actions/setup-node@v7\\n        with:\\n          node-version: '22'\\n          cache: npm\",\"      - run: npm ci\",\"      - name: Install pinned Foundry 1.7.1\\n        timeout-minutes: 5\\n        run: node tools/ci-foundry.js\",\"      - name: Compile original funded-work escrow artifact\\n        run: npm run build:funded-work-artifact\",\"      - name: Install PostgreSQL client tools matching the server major\\n        run: bash tools/rc1-postgres-client.sh '${{ matrix.postgres }}'\",\"      - name: Paid equipment, canonical repairs, negotiated deliveries, subscriptions and auctions (real PostgreSQL)\\n        if: '!cancelled()'\\n        env:\\n          RESOURCE_ECONOMY: 'off'\\n          EQUIPMENT_ECONOMY_NATIVE_ADMIN_DATABASE_URL: postgresql://postgres:pgcheck@127.0.0.1:5432/postgres\\n        run: npm run test:equipment-economy:postgres\",\"      - name: Funded apprenticeships, Crew organizations, partnerships, governance and actual acquisitions (real PostgreSQL)\\n        if: '!cancelled()'\\n        env:\\n          RESOURCE_ECONOMY: 'off'\\n          COMPANY_WORKFORCE_NATIVE_ADMIN_DATABASE_URL: postgresql://postgres:pgcheck@127.0.0.1:5432/postgres\\n        run: npm run test:company-workforce:postgres\",\"      - name: Restructuring, canonical disputes, insurance, concessions and territory sharing (real PostgreSQL)\\n        if: '!cancelled()'\\n        env:\\n          RESOURCE_ECONOMY: 'off'\\n          COMPANY_COMMERCIAL_NATIVE_ADMIN_DATABASE_URL: postgresql://postgres:pgcheck@127.0.0.1:5432/postgres\\n        run: npm run test:company-commercial:postgres\",\"      - name: Economic intelligence, laboratories, operating memory, teams and offline funded work (real PostgreSQL)\\n        if: '!cancelled()'\\n        env:\\n          RESOURCE_ECONOMY: 'off'\\n          COMPANY_AUTONOMY_NATIVE_ADMIN_DATABASE_URL: postgresql://postgres:pgcheck@127.0.0.1:5432/postgres\\n        run: npm run test:company-autonomy:postgres\"];\n  assert.deepEqual(economyParts.steps.map(nativeShape), expectedEconomyParts, 'Every native economy setup, command, environment and condition remains exact');\n  const expectedEnterpriseOwnedLockSetup = expectedOwnedLockSetup.replace('Set owned test PostgreSQL lock capacity for populated migrations','Set owned enterprise test PostgreSQL lock capacity for full-schema catalog cleanup');\n  const assertEnterpriseOwnedLockSetup = block => {\n"
        },
        {
          "at": 391349,
          "current": "  assert.equal(nativeShape(nextLayerParts[0]), nativeShape(expectedNextLayerStep), 'Next-layer native condition, financial OFF, owned admin endpoint and unfiltered runner remain exact');\n  assert.equal(ownedSetupCore.split(expectedOwnedLockSetup).length,2,'Only the exact complete once-reviewed non-proof setup may leave the command-inventory view');\n  const coreAsOriginal = ownedSetupCore.replace(expectedOwnedLockSetup,'').replace('  pgcheck_core:', '  pgcheck:').replace('name: native core (', 'name: real Postgres (');\n  const artifactParts = [\"      - name: Install verified pinned Foundry\\n        env:\\n          GH_TOKEN: ${{ github.token }}\\n        run: |\\n          node test/foundry-release-api.js\\n          node tools/foundry-release-api.js bootstrap\\n\",\"      - name: Compile original funded-work escrow artifact\\n        run: npm run build:funded-work-artifact\\n\\n\"];\n  const economyProofParts = [\"      - name: Paid equipment, canonical repairs, negotiated deliveries, subscriptions and auctions (real PostgreSQL)\\n        if: '!cancelled()'\\n        env:\\n          RESOURCE_ECONOMY: 'off'\\n          EQUIPMENT_ECONOMY_NATIVE_ADMIN_DATABASE_URL: postgresql://postgres:pgcheck@127.0.0.1:5432/postgres\\n        run: npm run test:equipment-economy:postgres\\n\\n\",\"      - name: Funded apprenticeships, Crew organizations, partnerships, governance and actual acquisitions (real PostgreSQL)\\n        if: '!cancelled()'\\n        env:\\n          RESOURCE_ECONOMY: 'off'\\n          COMPANY_WORKFORCE_NATIVE_ADMIN_DATABASE_URL: postgresql://postgres:pgcheck@127.0.0.1:5432/postgres\\n        run: npm run test:company-workforce:postgres\\n\\n\",\"      - name: Restructuring, canonical disputes, insurance, concessions and territory sharing (real PostgreSQL)\\n        if: '!cancelled()'\\n        env:\\n          RESOURCE_ECONOMY: 'off'\\n          COMPANY_COMMERCIAL_NATIVE_ADMIN_DATABASE_URL: postgresql://postgres:pgcheck@127.0.0.1:5432/postgres\\n        run: npm run test:company-commercial:postgres\\n\\n\",\"      - name: Economic intelligence, laboratories, operating memory, teams and offline funded work (real PostgreSQL)\\n        if: '!cancelled()'\\n        env:\\n          RESOURCE_ECONOMY: 'off'\\n          COMPANY_AUTONOMY_NATIVE_ADMIN_DATABASE_URL: postgresql://postgres:pgcheck@127.0.0.1:5432/postgres\\n        run: npm run test:company-autonomy:postgres\\n\\n\"];\n  const buildBoundary = '      - name: Install PostgreSQL client tools matching the server major';\n  const tailBoundary = \"      - name: Consignments, atomic barter, commissioned crafting, freight and warehouse work (real PostgreSQL)\";\n",
          "baseline": "  assert.equal(nativeShape(nextLayerParts[0]), nativeShape(expectedNextLayerStep), 'Next-layer native condition, financial OFF, owned admin endpoint and unfiltered runner remain exact');\n  assert.equal(ownedSetupCore.split(expectedOwnedLockSetup).length,2,'Only the exact complete once-reviewed non-proof setup may leave the command-inventory view');\n  const coreAsOriginal = ownedSetupCore.replace(expectedOwnedLockSetup,'').replace('  pgcheck_core:', '  pgcheck:').replace('name: native core (', 'name: real Postgres (');\n  const artifactParts = [\"      - name: Install pinned Foundry 1.7.1\\n        timeout-minutes: 5\\n        run: node tools/ci-foundry.js\\n\",\"      - name: Compile original funded-work escrow artifact\\n        run: npm run build:funded-work-artifact\\n\\n\"];\n  const economyProofParts = [\"      - name: Paid equipment, canonical repairs, negotiated deliveries, subscriptions and auctions (real PostgreSQL)\\n        if: '!cancelled()'\\n        env:\\n          RESOURCE_ECONOMY: 'off'\\n          EQUIPMENT_ECONOMY_NATIVE_ADMIN_DATABASE_URL: postgresql://postgres:pgcheck@127.0.0.1:5432/postgres\\n        run: npm run test:equipment-economy:postgres\\n\\n\",\"      - name: Funded apprenticeships, Crew organizations, partnerships, governance and actual acquisitions (real PostgreSQL)\\n        if: '!cancelled()'\\n        env:\\n          RESOURCE_ECONOMY: 'off'\\n          COMPANY_WORKFORCE_NATIVE_ADMIN_DATABASE_URL: postgresql://postgres:pgcheck@127.0.0.1:5432/postgres\\n        run: npm run test:company-workforce:postgres\\n\\n\",\"      - name: Restructuring, canonical disputes, insurance, concessions and territory sharing (real PostgreSQL)\\n        if: '!cancelled()'\\n        env:\\n          RESOURCE_ECONOMY: 'off'\\n          COMPANY_COMMERCIAL_NATIVE_ADMIN_DATABASE_URL: postgresql://postgres:pgcheck@127.0.0.1:5432/postgres\\n        run: npm run test:company-commercial:postgres\\n\\n\",\"      - name: Economic intelligence, laboratories, operating memory, teams and offline funded work (real PostgreSQL)\\n        if: '!cancelled()'\\n        env:\\n          RESOURCE_ECONOMY: 'off'\\n          COMPANY_AUTONOMY_NATIVE_ADMIN_DATABASE_URL: postgresql://postgres:pgcheck@127.0.0.1:5432/postgres\\n        run: npm run test:company-autonomy:postgres\\n\\n\"];\n  const buildBoundary = '      - name: Install PostgreSQL client tools matching the server major';\n  const tailBoundary = \"      - name: Consignments, atomic barter, commissioned crafting, freight and warehouse work (real PostgreSQL)\";\n"
        },
        {
          "at": 399449,
          "current": "    'duplicate native wall bounds must reject');\n\n\n  const expectedSuiteTail = \"  suite_tail:\\n    name: worker harness + economy simulations\\n    needs: suites\\n    runs-on: ubuntu-latest\\n    timeout-minutes: 45\\n    steps:\\n      - uses: actions/checkout@v7\\n        with:\\n          fetch-depth: 0\\n      - uses: actions/setup-node@v7\\n        with:\\n          node-version: '22'\\n          cache: npm\\n      - run: npm ci\\n      - name: Install verified pinned Foundry\\n        env:\\n          GH_TOKEN: ${{ github.token }}\\n        run: |\\n          node test/foundry-release-api.js\\n          node tools/foundry-release-api.js bootstrap\\n      - name: Compile original funded-work escrow artifact\\n        run: npm run build:funded-work-artifact\\n      - name: Invite-only launch admission and Crew allowance\\n        run: npm run test:invites\\n      - name: RC1 telemetry isolation and complementary campaign regressions\\n        run: npm run test:rc1\\n      - name: RC1 private command diagnostics and passive confirmation regression\\n        run: npm run test:rc1:observability\\n      - name: RC1 original worker scheduling and diagnostic harness controls\\n        run: npm run test:rc1:harness\\n      - name: economy sim (§10.4 drift-0)\\n        run: npm run sim\\n      - name: scale (population-scale market reachability + §10.4)\\n        env:\\n          SCALE_PLAYERS: '18'\\n          SCALE_DAYS: '2'\\n        run: npm run scale\";\n  const requireSuiteTail = block => assert.equal(nativeShape(block), expectedSuiteTail,\n    'Every tail setup, prerequisite, complete command and scale value is unconditional and exact');\n  requireSuiteTail(suiteTail);\n",
          "baseline": "    'duplicate native wall bounds must reject');\n\n\n  const expectedSuiteTail = \"  suite_tail:\\n    name: worker harness + economy simulations\\n    needs: suites\\n    runs-on: ubuntu-latest\\n    timeout-minutes: 45\\n    steps:\\n      - uses: actions/checkout@v7\\n        with:\\n          fetch-depth: 0\\n      - uses: actions/setup-node@v7\\n        with:\\n          node-version: '22'\\n          cache: npm\\n      - run: npm ci\\n      - name: Install pinned Foundry 1.7.1\\n        timeout-minutes: 5\\n        run: node tools/ci-foundry.js\\n      - name: Compile original funded-work escrow artifact\\n        run: npm run build:funded-work-artifact\\n      - name: Invite-only launch admission and Crew allowance\\n        run: npm run test:invites\\n      - name: RC1 telemetry isolation and complementary campaign regressions\\n        run: npm run test:rc1\\n      - name: RC1 private command diagnostics and passive confirmation regression\\n        run: npm run test:rc1:observability\\n      - name: RC1 original worker scheduling and diagnostic harness controls\\n        run: npm run test:rc1:harness\\n      - name: economy sim (§10.4 drift-0)\\n        run: npm run sim\\n      - name: scale (population-scale market reachability + §10.4)\\n        env:\\n          SCALE_PLAYERS: '18'\\n          SCALE_DAYS: '2'\\n        run: npm run scale\";\n  const requireSuiteTail = block => assert.equal(nativeShape(block), expectedSuiteTail,\n    'Every tail setup, prerequisite, complete command and scale value is unconditional and exact');\n  requireSuiteTail(suiteTail);\n"
        },
        {
          "at": 406020,
          "current": "  const nativeCommandsFrom = (block) => {\n    // Compiler installation is setup, not an economic proof. Only its independently\n    // checked complete block may leave this view; every existing native proof stays.\n    if (block.includes('      - name: Install verified pinned Foundry')) {\n      const normalized = block.replaceAll('\\r\\n', '\\n');\n      const setup = assertPinnedFoundrySetup(normalized);\n      assert.equal(normalized.split(setup).length, 2);\n",
          "baseline": "  const nativeCommandsFrom = (block) => {\n    // Compiler installation is setup, not an economic proof. Only its independently\n    // checked complete block may leave this view; every existing native proof stays.\n    if (block.includes('      - name: Install pinned Foundry 1.7.1')) {\n      const normalized = block.replaceAll('\\r\\n', '\\n');\n      const setup = assertPinnedFoundrySetup(normalized);\n      assert.equal(normalized.split(setup).length, 2);\n"
        },
        {
          "at": 409780,
          "current": "    }\n    return commands;\n  };\n  for (const command of ['node tools/ci-foundry.js', 'node tools/ci-foundry.js --version stable',\n    'node test/foundry-release-api.js', 'node tools/foundry-release-api.js bootstrap',\n    'node tools/foundry-release-api.js bootstrap --version stable', 'node tools/unreviewed-compiler.js'])\n    assert.throws(() => nativeCommandsFrom('      - run: ' + command),\n      'Compiler setup requires its exact reviewed block; arbitrary tooling is never a native proof');\n  assert.throws(() => nativeCommandsFrom(pgcheck + '\\n      - run: node tools/unreviewed-compiler.js\\n'),\n",
          "baseline": "    }\n    return commands;\n  };\n  for (const command of ['node tools/ci-foundry.js', 'node tools/ci-foundry.js --version stable', 'node tools/unreviewed-compiler.js'])\n    assert.throws(() => nativeCommandsFrom('      - run: ' + command),\n      'Compiler setup requires its exact reviewed block; arbitrary tooling is never a native proof');\n  assert.throws(() => nativeCommandsFrom(pgcheck + '\\n      - run: node tools/unreviewed-compiler.js\\n'),\n"
        },
        {
          "at": 421603,
          "current": "  };\n  assert(artifactAdmits(suites.replaceAll('\\r\\n','\\n'),expectedArtifactCommand));assert(artifactAdmits(pgcheck.replaceAll('\\r\\n','\\n'),expectedArtifactCommand));\n  for(const bad of [expectedArtifactCommand.replace('v5.6.1','master'),'cp retained-artifact.json omerta-contracts/out/OmertaWorkEscrowV2.json','echo synthetic'])assert(!artifactAdmits(pgcheck.replaceAll('\\r\\n','\\n'),bad));\n  const mutableCompilerJob = pgcheck.replaceAll('\\r\\n','\\n').replace('node tools/foundry-release-api.js bootstrap','node tools/foundry-release-api.js bootstrap --version stable');\n  assert.notEqual(mutableCompilerJob, pgcheck.replaceAll('\\r\\n','\\n'));\n  assert(!artifactAdmits(mutableCompilerJob,expectedArtifactCommand));\n  const {AUTONOMY_NATIVE_PROOFS}=await import('../tools/company-autonomy-native.js');\n  assert.equal(AUTONOMY_NATIVE_PROOFS.length,11,'All eleven fresh proofs required');\n  assert(AUTONOMY_NATIVE_PROOFS.some(([file,key,prefix])=>file==='fundedworkescrowadapter'&&key==='FUNDED_WORK_ADAPTER_TEST_DATABASE_URL'&&prefix==='funded_work_adapter_test_'));\n",
          "baseline": "  };\n  assert(artifactAdmits(suites.replaceAll('\\r\\n','\\n'),expectedArtifactCommand));assert(artifactAdmits(pgcheck.replaceAll('\\r\\n','\\n'),expectedArtifactCommand));\n  for(const bad of [expectedArtifactCommand.replace('v5.6.1','master'),'cp retained-artifact.json omerta-contracts/out/OmertaWorkEscrowV2.json','echo synthetic'])assert(!artifactAdmits(pgcheck.replaceAll('\\r\\n','\\n'),bad));\n  assert(!artifactAdmits(pgcheck.replaceAll('\\r\\n','\\n').replace('node tools/ci-foundry.js','node tools/ci-foundry.js --version stable'),expectedArtifactCommand));\n  const {AUTONOMY_NATIVE_PROOFS}=await import('../tools/company-autonomy-native.js');\n  assert.equal(AUTONOMY_NATIVE_PROOFS.length,11,'All eleven fresh proofs required');\n  assert(AUTONOMY_NATIVE_PROOFS.some(([file,key,prefix])=>file==='fundedworkescrowadapter'&&key==='FUNDED_WORK_ADAPTER_TEST_DATABASE_URL'&&prefix==='funded_work_adapter_test_'));\n"
        }
      ]
    },
    "test/lib/ux-journeys.js": {
      "current": {
        "mode": "100644",
        "blob": "d519371d05ae1075ae8e9ceafbad7262b2e0da77",
        "sha256": "f4edfb0d836f75fc688af169d938ebb577a5bd3606696f3902c7d84c7e6bfd88",
        "bytes": 22566
      },
      "baseline": {
        "mode": "100644",
        "blob": "60b9e2ec24f95bce3da74ee013aee1f36ea84390",
        "sha256": "5f74eb906f64969bc6a763eeb401b92c713ab5e0d8a98f2730365ce7ad20520c",
        "bytes": 21970
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { integratedEconomicParentInput } from '../../tools/integrated-economic-parent-source.js';\nimport { QUESTING_SOURCE, questingHistoricalInput, questingHistoricalEntry } from '../../tools/questing-source-transfer.js';\nimport { QUEST_QUALITY_SOURCE, qualifyQuestQualitySource } from '../../tools/quest-quality-source-transfer.js';\nimport { SITE_BASICS_SOURCE, qualifySiteBasicsSource } from '../../tools/site-basics-source-transfer.js';\nimport { BUSINESS_DESK_COMBINED_SOURCE, assertBusinessDeskCombinedSourceTransfer } from '../../tools/businessdesk-combined-source-transfer.js';\nimport assert from 'node:assert/strict';\nimport { readFileSync, lstatSync } from 'node:fs';\n",
          "baseline": "import { integratedEconomicParentInput } from '../../tools/integrated-economic-parent-source.js';\nimport { QUESTING_SOURCE, questingHistoricalInput, questingHistoricalEntry } from '../../tools/questing-source-transfer.js';\nimport { SITE_BASICS_SOURCE } from '../../tools/site-basics-source-transfer.js';\nimport { BUSINESS_DESK_COMBINED_SOURCE, assertBusinessDeskCombinedSourceTransfer } from '../../tools/businessdesk-combined-source-transfer.js';\nimport assert from 'node:assert/strict';\nimport { readFileSync, lstatSync } from 'node:fs';\n"
        },
        {
          "at": 7316,
          "current": "      && Object.hasOwn(rootSource.sourceViews[file].targets, 'desk') ? rootSource.sourceViews[file] : null;\n    const domain = Object.hasOwn(BUSINESS_DESK_DOMAINS, file) ? BUSINESS_DESK_DOMAINS[file] : original;\n    const combined = BUSINESS_DESK_COMBINED_SOURCE.files.find(row => row.file === file);\n    const quality = Object.hasOwn(QUEST_QUALITY_SOURCE.files, file) ? QUEST_QUALITY_SOURCE.files[file] : null;\n    const siteBasics = Object.hasOwn(SITE_BASICS_SOURCE.files, file) ? SITE_BASICS_SOURCE.files[file] : null;\n    const questing = Object.hasOwn(QUESTING_SOURCE.files, file) ? QUESTING_SOURCE.files[file] : null;\n    const outer = quality ? qualifyQuestQualitySource(file, current) : siteBasics ? qualifySiteBasicsSource(file, current) : null;\n    if (outer) assert.deepEqual([outer.sourceOnly, outer.runtime, outer.native, outer.priorResultsTransferred], [true, false, false, false]);\n    const expected = quality ? quality.current : siteBasics ? siteBasics.current : questing ? questing.current : desk ? desk.current : combined ? combined.current : { mode: domain.mode, blob: domain.currentBlob,\n      sha256: domain.currentSha256, bytes: domain.currentBytes };\n    assert.deepEqual(raw, { mode: expected.mode, blob: expected.blob }, 'Actual raw HEAD must qualify before historical bookkeeping');\n    assert.equal(typeof current, 'string'); assert.equal(sha(current), expected.sha256);\n",
          "baseline": "      && Object.hasOwn(rootSource.sourceViews[file].targets, 'desk') ? rootSource.sourceViews[file] : null;\n    const domain = Object.hasOwn(BUSINESS_DESK_DOMAINS, file) ? BUSINESS_DESK_DOMAINS[file] : original;\n    const combined = BUSINESS_DESK_COMBINED_SOURCE.files.find(row => row.file === file);\n    const questing = Object.hasOwn(QUESTING_SOURCE.files, file) ? QUESTING_SOURCE.files[file] : null;\n    const site = Object.hasOwn(SITE_BASICS_SOURCE.files, file) ? SITE_BASICS_SOURCE.files[file] : null;\n    const expected = site ? site.current : questing ? questing.current : desk ? desk.current : combined ? combined.current : { mode: domain.mode, blob: domain.currentBlob,\n      sha256: domain.currentSha256, bytes: domain.currentBytes };\n    assert.deepEqual(raw, { mode: expected.mode, blob: expected.blob }, 'Actual raw HEAD must qualify before historical bookkeeping');\n    assert.equal(typeof current, 'string'); assert.equal(sha(current), expected.sha256);\n"
        },
        {
          "at": 10320,
          "current": "    const actualPhysical = readFileSync(physicalPath);\n    assert(actualPhysical.equals(Buffer.from(actualCommitted)) || actualPhysical.equals(Buffer.from(actualCommitted.replaceAll('\\n', '\\r\\n'))),\n      'Whole actual physical LF/CRLF bytes match raw HEAD before historical bookkeeping');\n    assertActualHeadInput(file, actualHead, actualCommitted, actualPhysical.toString('utf8'));\n    // The exact comparison view follows actual HEAD/index/whole physical admission.\n    // Runtime/native consumers continue to use their unchanged actual inputs.\n    let comparisonSource = questingHistoricalInput(file, actualCommitted);\n",
          "baseline": "    const actualPhysical = readFileSync(physicalPath);\n    assert(actualPhysical.equals(Buffer.from(actualCommitted)) || actualPhysical.equals(Buffer.from(actualCommitted.replaceAll('\\n', '\\r\\n'))),\n      'Whole actual physical LF/CRLF bytes match raw HEAD before historical bookkeeping');\n    // The exact comparison view follows actual HEAD/index/whole physical admission.\n    // Runtime/native consumers continue to use their unchanged actual inputs.\n    let comparisonSource = questingHistoricalInput(file, actualCommitted);\n"
        },
        {
          "at": 18253,
          "current": "      actualHead.replace('\\n', '\\r\\n'), actualHead.replace('\\n', '\\r'), baseline]) {\n      rejectRaw(() => assertActualHeadInput(row.file, actualRecord, actualHead, input));\n    }\n    const outerPredecessor = Object.hasOwn(QUEST_QUALITY_SOURCE.files, row.file) ? QUEST_QUALITY_SOURCE.predecessor\n      : Object.hasOwn(SITE_BASICS_SOURCE.files, row.file) ? SITE_BASICS_SOURCE.predecessor : null;\n    if (outerPredecessor) {\n      const staleSource = git('show', outerPredecessor + ':' + row.file);\n      rejectRaw(() => assertActualHeadInput(row.file, record(outerPredecessor, row.file), staleSource, staleSource));\n    }\n    if (row.file === 'src/server.js') {\n      for (const input of [git('show', rootSource.baseRevision + ':' + row.file), current]) {\n",
          "baseline": "      actualHead.replace('\\n', '\\r\\n'), actualHead.replace('\\n', '\\r'), baseline]) {\n      rejectRaw(() => assertActualHeadInput(row.file, actualRecord, actualHead, input));\n    }\n    if (Object.hasOwn(SITE_BASICS_SOURCE.files, row.file)) {\n      const site = SITE_BASICS_SOURCE.files[row.file];\n      const stale = git('show', SITE_BASICS_SOURCE.predecessor + ':' + row.file);\n      assert.notEqual(stale, actualHead, 'The prior website source differs from actual HEAD');\n      rejectRaw(() => assertActualHeadInput(row.file, actualRecord, actualHead, stale));\n      rejectRaw(() => assertActualHeadInput(row.file, { mode: site.baseline.mode, blob: site.baseline.blob }, stale));\n    }\n    if (row.file === 'src/server.js') {\n      for (const input of [git('show', rootSource.baseRevision + ':' + row.file), current]) {\n"
        }
      ]
    },
    "test/site-basics-source-transfer.js": {
      "current": {
        "mode": "100644",
        "blob": "95bb3837eb63416eb2236dbb501a95c94531f629",
        "sha256": "cd121515663e8c88fb6a0efc2be8577aeef1d91067e7f759db9ee0dce99bb3f5",
        "bytes": 7070
      },
      "baseline": {
        "mode": "100644",
        "blob": "58cbf849fd6ce2a67a7005aa52ba09115eb2ccd9",
        "sha256": "f87e1028271df6d4f46b68d14e9c4ec6662ec6c1dc8294a3c56a3eeb53787bd5",
        "bytes": 6186
      },
      "inverses": [
        {
          "at": 131,
          "current": "import fs from 'node:fs';\nimport { createHash } from 'node:crypto';\nimport { execFileSync } from 'node:child_process';\nimport { questQualityHistoricalInput, questQualityHistoricalEntry } from '../tools/quest-quality-source-transfer.js';\nimport { SITE_BASICS_SOURCE as source, qualifySiteBasicsSource,\n  siteBasicsHistoricalInput, siteBasicsHistoricalEntry, siteBasicsSourceDataBytes } from '../tools/site-basics-source-transfer.js';\n\n",
          "baseline": "import fs from 'node:fs';\nimport { createHash } from 'node:crypto';\nimport { execFileSync } from 'node:child_process';\nimport { SITE_BASICS_SOURCE as source, qualifySiteBasicsSource,\n  siteBasicsHistoricalInput, siteBasicsHistoricalEntry, siteBasicsSourceDataBytes } from '../tools/site-basics-source-transfer.js';\n\n"
        },
        {
          "at": 2294,
          "current": "  siteBasicsSourceDataBytes(source), 'The only self-reference is complete generated data without executable additions');\nlet positives = 0, refusals = 0;\nfunction actual(file, pin) {\n  const committed = git('show', 'HEAD:' + file), authored = git('show', source.revision + ':' + file);\n  const stat = fs.lstatSync(file), physical = fs.readFileSync(file);\n  assert(stat.isFile() && !stat.isSymbolicLink());\n  assert(physical.equals(Buffer.from(committed)) || physical.equals(Buffer.from(committed.replaceAll('\\n', '\\r\\n'))),\n    'Actual whole committed and physical source qualify before historical comparison: ' + file);\n  const actualBlob = createHash('sha1').update('blob ' + Buffer.byteLength(committed) + '\\0').update(committed).digest('hex');\n  assert.equal(git('ls-tree', 'HEAD', '--', file).trim(), pin.mode + ' blob ' + actualBlob + '\\t' + file);\n  assert.equal(git('ls-files', '--stage', '--', file).trim(), pin.mode + ' ' + actualBlob + ' 0\\t' + file);\n  const text = questQualityHistoricalInput(file, committed), raw = questQualityHistoricalInput(file, physical);\n  assert.equal(text, authored, 'Whole authored source remains the actual committed source: ' + file);\n  assert.equal(sha(text), pin.sha256); assert.equal(Buffer.byteLength(text), pin.bytes);\n  const entry = pin.mode + ' blob ' + pin.blob + '\\t' + file;\n  assert.equal(questQualityHistoricalEntry(file, git('ls-tree', 'HEAD', '--', file).trim(), 'tree'), entry);\n  assert.equal(questQualityHistoricalEntry(file, git('ls-files', '--stage', '--', file).trim(), 'index'), pin.mode + ' ' + pin.blob + ' 0\\t' + file);\n  assert(raw.equals(Buffer.from(text)) || raw.equals(Buffer.from(text.replaceAll('\\n', '\\r\\n'))),\n    'Complete physical UTF-8 source is uniformly LF/CRLF: ' + file);\n  return { text, raw, entry };\n",
          "baseline": "  siteBasicsSourceDataBytes(source), 'The only self-reference is complete generated data without executable additions');\nlet positives = 0, refusals = 0;\nfunction actual(file, pin) {\n  const text = git('show', 'HEAD:' + file), authored = git('show', source.revision + ':' + file);\n  const stat = fs.lstatSync(file), raw = fs.readFileSync(file);\n  assert(stat.isFile() && !stat.isSymbolicLink());\n  assert.equal(text, authored, 'Whole authored source remains the actual committed source: ' + file);\n  assert.equal(sha(text), pin.sha256); assert.equal(Buffer.byteLength(text), pin.bytes);\n  const entry = pin.mode + ' blob ' + pin.blob + '\\t' + file;\n  assert.equal(git('ls-tree', 'HEAD', '--', file).trim(), entry);\n  assert.equal(git('ls-files', '--stage', '--', file).trim(), pin.mode + ' ' + pin.blob + ' 0\\t' + file);\n  assert(raw.equals(Buffer.from(text)) || raw.equals(Buffer.from(text.replaceAll('\\n', '\\r\\n'))),\n    'Complete physical UTF-8 source is uniformly LF/CRLF: ' + file);\n  return { text, raw, entry };\n"
        }
      ]
    },
    "tools/site-basics-source-transfer.js": {
      "current": {
        "mode": "100644",
        "blob": "a014b72ae419ced3b1d279569ee84500969fc5f6",
        "sha256": "b1cb4ac3db610e7d95ca87f8ff0ec45eb7d61b42f352fd74f223c67de5af2498",
        "bytes": 4822
      },
      "baseline": {
        "mode": "100644",
        "blob": "abdf165711f425b7cda48479c6c816af1915cca4",
        "sha256": "1b881b6b57056436b0972621c534c611f93ad8ca20a8aae995da58a66283de1c",
        "bytes": 4601
      },
      "inverses": [
        {
          "at": 96,
          "current": "import assert from 'node:assert/strict';\nimport { createHash } from 'node:crypto';\nimport { SITE_BASICS_SOURCE, SITE_BASICS_SOURCE_SHA256 } from './site-basics-source-data.js';\nimport { questQualityHistoricalInput, questQualityHistoricalEntry } from './quest-quality-source-transfer.js';\n\nexport { SITE_BASICS_SOURCE };\nconst sha = text => createHash('sha256').update(text).digest('hex');\n",
          "baseline": "import assert from 'node:assert/strict';\nimport { createHash } from 'node:crypto';\nimport { SITE_BASICS_SOURCE, SITE_BASICS_SOURCE_SHA256 } from './site-basics-source-data.js';\n\nexport { SITE_BASICS_SOURCE };\nconst sha = text => createHash('sha256').update(text).digest('hex');\n"
        },
        {
          "at": 3743,
          "current": "}\n// Unknown or partial changes remain untouched so immutable downstream qualifiers reject them.\nexport function siteBasicsHistoricalInput(file, input) {\n  input = questQualityHistoricalInput(file, input);\n  if (!known(file)) return input;\n  const current = canonical(input), row = SITE_BASICS_SOURCE.files[file];\n  if (!current || sha(current.lf) !== row.current.sha256) return input;\n",
          "baseline": "}\n// Unknown or partial changes remain untouched so immutable downstream qualifiers reject them.\nexport function siteBasicsHistoricalInput(file, input) {\n  if (!known(file)) return input;\n  const current = canonical(input), row = SITE_BASICS_SOURCE.files[file];\n  if (!current || sha(current.lf) !== row.current.sha256) return input;\n"
        },
        {
          "at": 4259,
          "current": "}\nexport function siteBasicsHistoricalEntry(file, entry, kind) {\n  assert(kind === 'tree' || kind === 'index');\n  entry = questQualityHistoricalEntry(file, entry, kind);\n  if (!known(file)) return entry;\n  const row = SITE_BASICS_SOURCE.files[file];\n  const format = pin => kind === 'tree' ? pin.mode + ' blob ' + pin.blob + '\\t' + file\n",
          "baseline": "}\nexport function siteBasicsHistoricalEntry(file, entry, kind) {\n  assert(kind === 'tree' || kind === 'index');\n  if (!known(file)) return entry;\n  const row = SITE_BASICS_SOURCE.files[file];\n  const format = pin => kind === 'tree' ? pin.mode + ' blob ' + pin.blob + '\\t' + file\n"
        }
      ]
    }
  },
  "additions": {
    "content/packs/quest-quality-favors/pack.json": {
      "mode": "100644",
      "blob": "93484b45f713ff5c60da70fd193f1a43b78fc99e",
      "sha256": "c827712dddc0470741b9c84d764ac95dbe22223767b36e501ab11a207cf80c71",
      "bytes": 18533
    },
    "content/packs/quest-quality-field-notes/pack.json": {
      "mode": "100644",
      "blob": "698b9b3c219cd4f2f9b60d6177f9491c12637e05",
      "sha256": "c4b34bcaa557f6cf47b2cb6fd0256665256fa5aa71f89beaa36951f155763e5a",
      "bytes": 18929
    },
    "content/packs/quest-quality-last-ferry/pack.json": {
      "mode": "100644",
      "blob": "8fbc96b5850458d199d078f68c9332c9e224fc00",
      "sha256": "ca48e286aa7e47bbb2552fb3e7bbb503026796006fba310d9fc67857e702b881",
      "bytes": 17307
    },
    "content/packs/quest-quality-night-edition/pack.json": {
      "mode": "100644",
      "blob": "92933602c6681b6045ebad7d18821b3544b54ada",
      "sha256": "1d99b3a7369260b7e0303681628ed588b4e9f8faf654df722950b0526233c1c1",
      "bytes": 18722
    },
    "content/packs/quest-quality-open-office/pack.json": {
      "mode": "100644",
      "blob": "4649538d79145e9449b21cd4b2cbe4ad4a6d2e7d",
      "sha256": "97121605779dd3060510833f035b66a8cecec6b3c46be9f681edd3844b5506ff",
      "bytes": 25299
    },
    "content/packs/quest-quality-payday/pack.json": {
      "mode": "100644",
      "blob": "869bc45f4b54c1cbbd89784d223c12bb1ea8066f",
      "sha256": "855e6fd2f74784ed9f02ccb5a62ed13b3cb381e5d199c66b12ffdf668d7055ed",
      "bytes": 19574
    },
    "content/packs/quest-quality-shared-meaning/pack.json": {
      "mode": "100644",
      "blob": "031b239d68905d67338cc97e424ff9cb7963cd76",
      "sha256": "cfdc64e1ed5bce634eb10db8dbd5db95af35b016c89a13128e882ba2f9c1e072",
      "bytes": 14592
    },
    "content/packs/quest-quality-small-fire/pack.json": {
      "mode": "100644",
      "blob": "de555248801b2a66445b9e798b99c2946048f341",
      "sha256": "64d240fe1aa97e6868a0190eac3130716eae8607c9b3881719b46a32d9b800d7",
      "bytes": 24604
    },
    "content/packs/quest-quality-truce/pack.json": {
      "mode": "100644",
      "blob": "f74fb25f22e7ff80c1716a3f1e7d4c2b01432115",
      "sha256": "2bf1e67fe40d07e70bf2e51181fd870da979340a65d8ecb2e6f9a246d6bbfc08",
      "bytes": 18805
    },
    "content/packs/quest-three-witnesses-v2/pack.json": {
      "mode": "100644",
      "blob": "106a4aee8f37882bc65ca2a5b957752d91a71ef7",
      "sha256": "294a307015a074ebd6340b1acd346fc798bcdc02ba13792506f077cc0f2c2423",
      "bytes": 45669
    },
    "public/ux-quest-quality.css": {
      "mode": "100644",
      "blob": "48a87cff55328ae53ec017de6dbec0e77222f7c4",
      "sha256": "8b695b3d42e9f43586b0f82c0fcf713168c5e61834facc758ec6fff2f80e941f",
      "bytes": 2401
    },
    "public/ux-quest-quality.js": {
      "mode": "100644",
      "blob": "4d2fa08eb0170d09678b912df450e46373a65c77",
      "sha256": "ebd0f32f0c43727b1176c5ef71afdf74ab5d7bd6d7afd60dce7aa6121ac4f2f7",
      "bytes": 34223
    },
    "src/content/quality-runtime.js": {
      "mode": "100644",
      "blob": "01f23d0a64341e88662c40c1669921049ab3ebba",
      "sha256": "609bab529eae343b33a2873a9da34668d63c3ee2f91bbcca77f85bcdb43e5d4e",
      "bytes": 17517
    },
    "src/content/quality.js": {
      "mode": "100644",
      "blob": "f561fe2fd9f858979ece7cb971b1272511339e69",
      "sha256": "94a0a31a4df250d4ed1d69a35f212414aaa1fe4603bee86e6b584d332ecd08a4",
      "bytes": 24924
    },
    "src/content/quest-quality-packs.js": {
      "mode": "100644",
      "blob": "77dc8b053325ceb554bee072e821c040a8a451e4",
      "sha256": "fcdbbd2a6269b445c8a4ded1624cd91482b5d454371e3b3a169ca1babcb0bae9",
      "bytes": 1804
    },
    "src/quest-quality-contracts.js": {
      "mode": "100644",
      "blob": "0e060732b49e13979687585f8cd7c15261d2ab03",
      "sha256": "b611d8dd4f174b8f5bb08ecf91a14d1c3833099052c518059d7a631dd3415395",
      "bytes": 5452
    },
    "test/foundry-release-api.js": {
      "mode": "100644",
      "blob": "d3f3956df152072068586210d981f39bb981788e",
      "sha256": "5a16ad62dfd2faf9eca28b0c4acf19560d95133281887f11936fcb16633b49f1",
      "bytes": 12727
    },
    "test/lib/quest-quality-fixture.js": {
      "mode": "100644",
      "blob": "955a70522014eb26f28b73bbbcd5395f3c9c28c7",
      "sha256": "316f3bf09ce3788fc6997f7dc766af3b1cd057b058143f315106a37053c6a50b",
      "bytes": 4103
    },
    "test/quest-quality-api.js": {
      "mode": "100644",
      "blob": "87f2648e6b6761ca82fc21f3127836f279e684cb",
      "sha256": "eb06739d7e08a8124b9a91371de7ea2b314339dd20f5a3451138efc08441bd8e",
      "bytes": 3896
    },
    "test/quest-quality-browser.js": {
      "mode": "100644",
      "blob": "084b4643e7794f973dc2da13d7e5a816dad5e14b",
      "sha256": "a11d2e23ce21ce24179fa44d641cb5621b58d8ec271ff6020bcb024068300722",
      "bytes": 35211
    },
    "test/quest-quality-content.js": {
      "mode": "100644",
      "blob": "12fcad9a55093fc31af2aca520fcd5fccdd1fa14",
      "sha256": "0ea2d6179a005d153c0e1c8f1c813c750c9525aa51fe9befefe14e48959dc266",
      "bytes": 13832
    },
    "test/quest-quality-postgres.js": {
      "mode": "100644",
      "blob": "374a212760b326460fcc704e48c87a34e9bf86e8",
      "sha256": "f8b535feb91fc5ad23b2b61c56432eca948c5c3eb4e9a5b6962eea9abd905e7a",
      "bytes": 8564
    },
    "test/quest-quality-rules.js": {
      "mode": "100644",
      "blob": "cf7f60a14c4e437220de7beb7b2fcf0c91ac99b6",
      "sha256": "a826d549449bfff306a42553d5c218412d0b903d7acc0756791787cb19211b08",
      "bytes": 16410
    },
    "test/quest-quality-runtime.js": {
      "mode": "100644",
      "blob": "763988d2e1b4e547388c5e03f58c6d91cb9bb115",
      "sha256": "3f227f0b0b8158b97d6e1790fcab5f5cdb788320446bcf0ecc378513a903e6a6",
      "bytes": 7524
    },
    "test/quest-quality-social.js": {
      "mode": "100644",
      "blob": "b34886765b566045a76024b3ac45c5e47f3c46fd",
      "sha256": "a4dfce14e220a79d78651ea113c33efbfb4361906882ab2ffe20079c730964a6",
      "bytes": 7111
    },
    "test/quest-quality-source-transfer.js": {
      "mode": "100644",
      "blob": "cd6af8f2336b769ede7a9213a5004e97876190a3",
      "sha256": "f5cde171acedf3396bb0a423267e343844b4e938a620eacea0f4331601584fd4",
      "bytes": 5640
    },
    "test/quest-quality-spoilers.js": {
      "mode": "100644",
      "blob": "a57b861cb7bd81a4ead4a2117c85a8e09f8a4ef0",
      "sha256": "55fc0fc6512934fccfdf3628b5f178b95fe27722753aba704b1acc515d8876e4",
      "bytes": 3458
    },
    "test/quest-quality-stateful.js": {
      "mode": "100644",
      "blob": "10894777fbbc351a5b56d9cea6df5cc9e27def1d",
      "sha256": "25b514da3ba7440638639362b814c4145ade0f5050b0297a4c6b39d3bc3e51df",
      "bytes": 3525
    },
    "test/quest-quality-studio.js": {
      "mode": "100644",
      "blob": "c9a54a262f1463a52a200abc00ca6e2947307859",
      "sha256": "7312af34a011503deb2cd3a36ea4f9b667ddc9cc57c6de7e2ef384121ff944f6",
      "bytes": 8306
    },
    "test/quest-quality-study.js": {
      "mode": "100644",
      "blob": "9577ef10f7296a8a0c9b80cafb9ad87065bf75ef",
      "sha256": "6043fb8143c39ce3b1d418265670565faae908006e07d7760c0cef5f2c5a896b",
      "bytes": 2448
    },
    "tools/foundry-release-api.js": {
      "mode": "100644",
      "blob": "c26921c9545e76d1d89828b9803ffac92ad3877c",
      "sha256": "57dca16e3c3cfd6b4fd11773892fb1ab0db48efa095e5c4cff138e27d538fa34",
      "bytes": 20198
    },
    "tools/quest-quality-source-seal.js": {
      "mode": "100644",
      "blob": "8915acff0a104f168c86dab13604f6fb687f6c4f",
      "sha256": "c35478931b71a777dc6bf45064c456b63641854e6cecce3be995f6074277f42c",
      "bytes": 4220
    },
    "tools/quest-quality-source-transfer.js": {
      "mode": "100644",
      "blob": "72908f02e65daf65309af20a79bb2b978a8d9ff1",
      "sha256": "c056c3b8e2efe22e9ba465393c3a895bbca94929113ddd1ef0fbcad53f9f7fe9",
      "bytes": 4679
    },
    "tools/quest-quality-studio.js": {
      "mode": "100644",
      "blob": "91f99a49c57d14a997bc3d59f7b1b332171d8e77",
      "sha256": "997b7cc34cec5c18875f3166b013c14f595a24549e79a9a57552a035a602aa52",
      "bytes": 19938
    },
    "tools/quest-quality-study.js": {
      "mode": "100644",
      "blob": "14c075150925d69bfe843dec555895d75a6d0328",
      "sha256": "856b8459dc9f38ca6ea7a131374897ea5c9b4d25922535515b5dc5822c17ce01",
      "bytes": 4242
    },
    "tools/quest-quality-workgraph.js": {
      "mode": "100644",
      "blob": "f88a3252501ca70d01480192e288bcf43c9ca693",
      "sha256": "c1228a648475f7caef08b98cc16488d5979a8a4db0666250feaac573c6bffd11",
      "bytes": 5711
    }
  }
});
export const QUEST_QUALITY_SOURCE_SHA256 = '0a3845364dea3b6e8f99ca33fdbeec5872cf7858d07afc046d79fa73f0b0bbe7';
