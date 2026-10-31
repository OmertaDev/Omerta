// Generated exact source-only envelope for economy monitoring and composition tests.
// Historical pins remain unchanged; unknown or non-exact bytes pass through.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

export const ECONOMY_MONITOR_SOURCE_REVISION = "9000f2afaf4640e018b2d4026fb7b1ff984a8257";
export const ECONOMY_MONITOR_SOURCE_TREE = "3b3b3b22eff1a10f837887e27290b1b64d1ebc83";
export const ECONOMY_MONITOR_SOURCE_PREDECESSOR = "a24df18ea1a0b57f25df942675dd9fef7415f275";
export const ECONOMY_MONITOR_SOURCE_PREDECESSOR_TREE = "71f63dbc85d6f53af047ab93739fa67bb28b4062";
export const ECONOMY_MONITOR_SOURCE_PHASE = 'exact-economy-monitor-composition-source-transfer-only; no historical runtime, native, migration, financial, activation or deployment clearance';
export const ECONOMY_MONITOR_SOURCE_DOMAINS = {
  ".github/workflows/economy-hardening.yml": {
    "predecessorAbsent": false,
    "mode": "100644",
    "currentSha256": "9f8158f99f3aa7c0d78ce7ae8a5baf30fe47b145ff72b81ca6eb254c53ebb754",
    "currentBlob": "de1040e2d9073cab9234132497f1092feb0a72d0",
    "currentBytes": 5299,
    "baselineSha256": "340f34c413e65b54cfc70dd521938fd882c716bfbbdc3f164fb1e87a5d4b86f8",
    "baselineBlob": "a7224d9600c3d78f93fa66d4830c8460ea0fea31",
    "baselineBytes": 3263,
    "contextLines": 3,
    "inverses": [
      {
        "current": "\njobs:\n  economy-hardening:\n    name: economy-hardening (${{ matrix.postgres }})\n    runs-on: ubuntu-latest\n    timeout-minutes: 25\n    strategy:\n      fail-fast: false\n      matrix:\n        postgres: ['16', '18.4']\n    services:\n      postgres:\n        image: postgres:${{ matrix.postgres }}\n        env:\n          POSTGRES_PASSWORD: pgcheck\n        ports:\n",
        "baseline": "\njobs:\n  economy-hardening:\n    runs-on: ubuntu-latest\n    timeout-minutes: 20\n    services:\n      postgres:\n        image: postgres:18.4\n        env:\n          POSTGRES_PASSWORD: pgcheck\n        ports:\n"
      },
      {
        "current": "          node-version: '22'\n          cache: npm\n      - run: npm ci\n      - name: Set owned test PostgreSQL lock capacity for populated migrations\n        timeout-minutes: 3\n        shell: bash\n        env:\n          POSTGRES_SERVICE_ID: ${{ job.services.postgres.id }}\n        run: |\n          set -euo pipefail\n          [[ \"$POSTGRES_SERVICE_ID\" =~ ^[0-9a-f]{64}$ ]] || { echo 'Missing owned PostgreSQL service container ID' >&2; exit 1; }\n          timeout 15s docker exec \"$POSTGRES_SERVICE_ID\" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'ALTER SYSTEM SET max_locks_per_transaction = 512;'\n          timeout 45s docker restart --timeout 30 \"$POSTGRES_SERVICE_ID\"\n          ready=0\n          deadline=$((SECONDS + 60))\n          while (( SECONDS < deadline )); do\n            if timeout 3s docker exec \"$POSTGRES_SERVICE_ID\" pg_isready -q -t 1 -U postgres -d postgres; then\n              ready=1\n              break\n            fi\n            sleep 1\n          done\n          [[ \"$ready\" == 1 ]] || { echo 'Owned PostgreSQL service did not become ready within 60 seconds' >&2; exit 1; }\n          actual=\"$(timeout 10s docker exec \"$POSTGRES_SERVICE_ID\" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc 'SHOW max_locks_per_transaction;')\"\n          [[ \"$actual\" == 512 ]] || { echo \"Unexpected test max_locks_per_transaction: $actual\" >&2; exit 1; }\n      - name: In-memory exploit and pacing regressions\n        run: >-\n          node test/economy-hardening-source-compatibility.js &&\n",
        "baseline": "          node-version: '22'\n          cache: npm\n      - run: npm ci\n      - name: In-memory exploit and pacing regressions\n        run: >-\n          node test/economy-hardening-source-compatibility.js &&\n"
      },
      {
        "current": "          node test/secondary-cooldowns.js &&\n          node test/cooldown-surfaces.js &&\n          node test/economy-balance.js &&\n          node test/economy-monitor.js &&\n          node test/economy-composition.js &&\n          node test/cooldown-surfaces-browser.js\n      - name: Create isolated native databases\n        env:\n",
        "baseline": "          node test/secondary-cooldowns.js &&\n          node test/cooldown-surfaces.js &&\n          node test/economy-balance.js &&\n          node test/cooldown-surfaces-browser.js\n      - name: Create isolated native databases\n        env:\n"
      },
      {
        "current": "          createdb daily_lineage_test\n          createdb crew_wage_migration_test\n          createdb social_receipt_test\n          createdb omerta_economy_composition_test\n      - name: PostgreSQL cooldown and lineage races\n        env:\n          COOLDOWN_TEST_DATABASE_URL: postgresql://postgres:pgcheck@127.0.0.1:55442/omerta_cooldown_test\n",
        "baseline": "          createdb daily_lineage_test\n          createdb crew_wage_migration_test\n          createdb social_receipt_test\n      - name: PostgreSQL cooldown and lineage races\n        env:\n          COOLDOWN_TEST_DATABASE_URL: postgresql://postgres:pgcheck@127.0.0.1:55442/omerta_cooldown_test\n"
      },
      {
        "current": "          node test/crew-wage-postgres.js\n          node test/social-receipt-postgres.js\n          node test/db-boot-lock-postgres.js\n      - name: PostgreSQL economic monitoring and mixed workflow exploit proofs\n        env:\n          ECONOMY_MONITOR_TEST_DATABASE_URL: postgresql://postgres:pgcheck@127.0.0.1:55442/postgres\n          ECONOMY_COMPOSITION_TEST_DATABASE_URL: postgresql://postgres:pgcheck@127.0.0.1:55442/omerta_economy_composition_test\n        run: |\n          node test/economy-monitor.js --postgres\n          node test/economy-composition.js --postgres\n",
        "baseline": "          node test/crew-wage-postgres.js\n          node test/social-receipt-postgres.js\n          node test/db-boot-lock-postgres.js\n"
      }
    ]
  },
  "package.json": {
    "predecessorAbsent": false,
    "mode": "100644",
    "currentSha256": "d7fb38ced9030cc5b50981adfc4e04a3d7e229d42ce4034e99215399efd40bea",
    "currentBlob": "970067b4a2b448eb6368203a1ef4b738e5b129bb",
    "currentBytes": 59794,
    "baselineSha256": "25a5a2cb4f5c8bc5ce9538495716d60fad3c67e995a2db36daca01505c92e2fc",
    "baselineBlob": "531e67d793e7758751f1734fe6dd96b7520268d4",
    "baselineBytes": 59697,
    "contextLines": 3,
    "inverses": [
      {
        "current": "    \"test:coordination:postgres\": \"node test/coordination.js --postgres && node test/coordination-knowledge-runtime.js --postgres && node test/coordination-knowledge-postgres.js\",\n    \"start\": \"node src/server.js\",\n    \"worker\": \"node src/worker.js\",\n    \"test:economy-security\": \"node test/economy-monitor.js && node test/economy-composition.js\",\n    \"pretest\": \"npm run test:economy-ux-source && npm run test:agent-economy-commerce && node test/deed-market-source-compatibility.js && npm run test:deed-discovery && node test/deed-quest-source-compatibility.js && npm run test:agent-economy-enterprise && npm run test:agent-economy-market-operations && npm run test:agent-economy-next-layer && npm run test:agent-economy-next-five && npm run test:equipment-economy && node test/rc1-first-batch-source-compatibility.js && node test/companyproduction.js && node test/companyspecialization.js && node test/itemdurability.js && node test/itemdurability-quality.js && node test/companydemand.js && node test/companyforecast.js && node test/companyproduction-integration.js && node test/company-economy-contracts.js && node test/player-intel-source-compatibility.js && node test/commercialpremises.js && node test/commercialpremises-integration.js && node test/rc1-commercial-premises-source-compatibility.js && node test/companybankportfolios.js && node test/companybankportfolio-integration.js && node test/rc1-company-bank-source-compatibility.js && node test/companylogisticshubs.js && node test/companylogisticshubs-integration.js && node test/rc1-company-logistics-hub-source-compatibility.js && node test/buyercooperatives.js && node test/buyercooperative-integration.js && node test/rc1-buyer-cooperative-source-compatibility.js && node test/companyopportunities.js && node test/companyopportunity-integration.js && node test/rc1-company-opportunity-source-compatibility.js && node test/commercialreputation.js && node test/commercialreputation-integration.js && node test/rc1-commercial-reputation-source-compatibility.js && node test/businessseasons.js && node test/businessseason-integration.js && node test/rc1-business-season-source-compatibility.js && node test/rc1-game-employment-source-compatibility.js && node test/rc1-company-workflow-source-compatibility.js && node test/companyopportunities-api.js && node test/commercialreputation-api.js && node test/businessseasons-api.js && node test/companyworkflows.js && node test/companyworkflow-integration.js && node test/gameemployment.js && node test/gameemployment-integration.js && node test/companyoperatorrunner.js && node test/rc1-company-operator-source-compatibility.js && node test/companyoperators.js && node test/companyoperators-api.js && node test/storefrontfulfillment.js && node test/storefront-fulfillment-api.js && node test/courierjobs.js && node test/supplycontracts.js && node test/supplycontracts-api.js && node test/earningreceipts.js && node test/resource-deliver.js && node test/identity-checkout.js && node test/identity-checkout-client.js && node test/identity-checkout-api.js && node test/current-copy.js && node test/operation-read-paths.js && node test/world-projection-mysteries.js && node test/world-projection-mysteries-api.js && node test/world-projection-read.js && node test/world-projection.js && node test/world-projection-api.js && node test/projection-events.js && node test/projection-events-ws.js && node test/world-projection-client.js && node test/coordination-operation-definitions.js && node test/coordination-mode-boundary.js && node test/coordination-capital.js && node test/coordination-materials.js && node test/coordination-knowledge-proof.js && node test/world-kernel-transaction.js && node test/family-operations.js && node test/family-operations-api.js && node test/world-knowledge-crafting.js && node test/world-kernel-query.js && node test/world-kernel-input.js && node test/world-kernel.js && node test/world-kernel-api.js && node test/coordination-graph.js && node test/coordination.js && node test/coordination-api.js && node test/coordination-http-receipts.js && node test/coordination-knowledge.js && node test/coordination-knowledge-runtime.js && node test/coordination-knowledge-api.js && node test/finalizedobservation.js && node test/stockballotv2.js && node test/rwanominations.js && node test/rwaroutes.js && node test/rwahealth.js && node test/rwahealth.integration.js && node test/rwahealthclearance.js && node test/rwahealthclearancecontext.js && node test/rwahealthoverlay.readiness.js && node test/rwahealthoverlay.schema.js && node test/rwahealthoverlay.vector.js && node test/rwaregistrylifecycle.js && node test/rwaregistrylifecycle.sync.js && node test/agent-referral-cash.js && node test/phase2-discovery.js && node test/phase2-compiler.js && node test/phase2-review-regressions.js && node test/phase2-scale.js && node test/content-graph.js && node test/content-runtime.js && node test/content-social.js && node test/content-seasonal.js && node test/content-seasonal-case.js && node test/content-crafting.js && node test/content-crafting-jobs.js && node test/content-crafting-tools.js && node test/content-exchange.js && node test/content-api.js && node test/v4oraclekeeper.js && node test/genesiscca.js && node test/genesislaunch.js && node test/genesisrelease.js && node test/worldgraph.js && node test/worldgraph-validation.js && node test/items.js && node test/crafting.js && node test/mysteries.js && node test/operations.js && node test/belladonna.js && node test/worldgraph-api.js && node test/city-rpg.js && node tools/pgcheck-belladonna.js --pg-mem && node test/phase2-definition-schema.js && node test/phase2-definitions.js && node test/phase2-activation.js && node test/phase2-definition-invariants.js && node test/phase2-lot-boundary.js && node test/keepertransactions.js && node test/liquiditykeeper.js && node test/genesiskeeper.js && node test/liquidityaccounting.js --memory && node test/liquidityaccounting-review.js && node test/liquiditypolicy.js --memory && node test/bond-unlimited.js --memory && node test/bondquoteexpiry.js && node test/liquidityrpc.js && node tools/liquidity-manifest-example.js --self-test && node test/liquiditypolicy-review.js && node test/liquidityqueue.js --memory && node test/liquidityqueue-review.js && node test/character-mint-policy.js && node test/phase2-lots.js && node test/phase2-lots-property.js && node test/audit/mint-dev-allocation.js --memory && node test/audit/deed-reimport-order.js --memory && node test/progression-admission.js && node test/world-prerequisites.js && node test/recipe-policy.js && node test/furnace-ledger.js && node test/core-progression-api.js && node test/player-commands.js && node test/player-command-journey.js && node test/player-command-api.js && node test/player-command-client.js && node test/director-definitions.js && node test/director-config.js && node test/director-runtime.js && node test/director-recovery.js && node test/director-dock-world.js && node test/director-commands.js && node test/director-api.js && node test/director-journey.js && node test/director-security.js && node test/director-simulation.js && node test/director-network.js && node test/campaign-network-journey.js && node test/director-network-recovery.js && node test/player-opportunities.js && node test/world-consequences.js && node test/rc1-city-gameplay-source-compatibility.js && npm run test:gateway && npm run test:legal-security && npm run test:release-source-transfer\",\n    \"phase2:definitions:check\": \"node test/phase2-definition-schema.js && node test/phase2-definitions.js && node test/phase2-activation.js && node test/phase2-definition-invariants.js\",\n    \"phase2:lots:check\": \"node test/phase2-lot-boundary.js && node test/phase2-lots.js && node test/phase2-lots-property.js\",\n",
        "baseline": "    \"test:coordination:postgres\": \"node test/coordination.js --postgres && node test/coordination-knowledge-runtime.js --postgres && node test/coordination-knowledge-postgres.js\",\n    \"start\": \"node src/server.js\",\n    \"worker\": \"node src/worker.js\",\n    \"pretest\": \"npm run test:economy-ux-source && npm run test:agent-economy-commerce && node test/deed-market-source-compatibility.js && npm run test:deed-discovery && node test/deed-quest-source-compatibility.js && npm run test:agent-economy-enterprise && npm run test:agent-economy-market-operations && npm run test:agent-economy-next-layer && npm run test:agent-economy-next-five && npm run test:equipment-economy && node test/rc1-first-batch-source-compatibility.js && node test/companyproduction.js && node test/companyspecialization.js && node test/itemdurability.js && node test/itemdurability-quality.js && node test/companydemand.js && node test/companyforecast.js && node test/companyproduction-integration.js && node test/company-economy-contracts.js && node test/player-intel-source-compatibility.js && node test/commercialpremises.js && node test/commercialpremises-integration.js && node test/rc1-commercial-premises-source-compatibility.js && node test/companybankportfolios.js && node test/companybankportfolio-integration.js && node test/rc1-company-bank-source-compatibility.js && node test/companylogisticshubs.js && node test/companylogisticshubs-integration.js && node test/rc1-company-logistics-hub-source-compatibility.js && node test/buyercooperatives.js && node test/buyercooperative-integration.js && node test/rc1-buyer-cooperative-source-compatibility.js && node test/companyopportunities.js && node test/companyopportunity-integration.js && node test/rc1-company-opportunity-source-compatibility.js && node test/commercialreputation.js && node test/commercialreputation-integration.js && node test/rc1-commercial-reputation-source-compatibility.js && node test/businessseasons.js && node test/businessseason-integration.js && node test/rc1-business-season-source-compatibility.js && node test/rc1-game-employment-source-compatibility.js && node test/rc1-company-workflow-source-compatibility.js && node test/companyopportunities-api.js && node test/commercialreputation-api.js && node test/businessseasons-api.js && node test/companyworkflows.js && node test/companyworkflow-integration.js && node test/gameemployment.js && node test/gameemployment-integration.js && node test/companyoperatorrunner.js && node test/rc1-company-operator-source-compatibility.js && node test/companyoperators.js && node test/companyoperators-api.js && node test/storefrontfulfillment.js && node test/storefront-fulfillment-api.js && node test/courierjobs.js && node test/supplycontracts.js && node test/supplycontracts-api.js && node test/earningreceipts.js && node test/resource-deliver.js && node test/identity-checkout.js && node test/identity-checkout-client.js && node test/identity-checkout-api.js && node test/current-copy.js && node test/operation-read-paths.js && node test/world-projection-mysteries.js && node test/world-projection-mysteries-api.js && node test/world-projection-read.js && node test/world-projection.js && node test/world-projection-api.js && node test/projection-events.js && node test/projection-events-ws.js && node test/world-projection-client.js && node test/coordination-operation-definitions.js && node test/coordination-mode-boundary.js && node test/coordination-capital.js && node test/coordination-materials.js && node test/coordination-knowledge-proof.js && node test/world-kernel-transaction.js && node test/family-operations.js && node test/family-operations-api.js && node test/world-knowledge-crafting.js && node test/world-kernel-query.js && node test/world-kernel-input.js && node test/world-kernel.js && node test/world-kernel-api.js && node test/coordination-graph.js && node test/coordination.js && node test/coordination-api.js && node test/coordination-http-receipts.js && node test/coordination-knowledge.js && node test/coordination-knowledge-runtime.js && node test/coordination-knowledge-api.js && node test/finalizedobservation.js && node test/stockballotv2.js && node test/rwanominations.js && node test/rwaroutes.js && node test/rwahealth.js && node test/rwahealth.integration.js && node test/rwahealthclearance.js && node test/rwahealthclearancecontext.js && node test/rwahealthoverlay.readiness.js && node test/rwahealthoverlay.schema.js && node test/rwahealthoverlay.vector.js && node test/rwaregistrylifecycle.js && node test/rwaregistrylifecycle.sync.js && node test/agent-referral-cash.js && node test/phase2-discovery.js && node test/phase2-compiler.js && node test/phase2-review-regressions.js && node test/phase2-scale.js && node test/content-graph.js && node test/content-runtime.js && node test/content-social.js && node test/content-seasonal.js && node test/content-seasonal-case.js && node test/content-crafting.js && node test/content-crafting-jobs.js && node test/content-crafting-tools.js && node test/content-exchange.js && node test/content-api.js && node test/v4oraclekeeper.js && node test/genesiscca.js && node test/genesislaunch.js && node test/genesisrelease.js && node test/worldgraph.js && node test/worldgraph-validation.js && node test/items.js && node test/crafting.js && node test/mysteries.js && node test/operations.js && node test/belladonna.js && node test/worldgraph-api.js && node test/city-rpg.js && node tools/pgcheck-belladonna.js --pg-mem && node test/phase2-definition-schema.js && node test/phase2-definitions.js && node test/phase2-activation.js && node test/phase2-definition-invariants.js && node test/phase2-lot-boundary.js && node test/keepertransactions.js && node test/liquiditykeeper.js && node test/genesiskeeper.js && node test/liquidityaccounting.js --memory && node test/liquidityaccounting-review.js && node test/liquiditypolicy.js --memory && node test/bond-unlimited.js --memory && node test/bondquoteexpiry.js && node test/liquidityrpc.js && node tools/liquidity-manifest-example.js --self-test && node test/liquiditypolicy-review.js && node test/liquidityqueue.js --memory && node test/liquidityqueue-review.js && node test/character-mint-policy.js && node test/phase2-lots.js && node test/phase2-lots-property.js && node test/audit/mint-dev-allocation.js --memory && node test/audit/deed-reimport-order.js --memory && node test/progression-admission.js && node test/world-prerequisites.js && node test/recipe-policy.js && node test/furnace-ledger.js && node test/core-progression-api.js && node test/player-commands.js && node test/player-command-journey.js && node test/player-command-api.js && node test/player-command-client.js && node test/director-definitions.js && node test/director-config.js && node test/director-runtime.js && node test/director-recovery.js && node test/director-dock-world.js && node test/director-commands.js && node test/director-api.js && node test/director-journey.js && node test/director-security.js && node test/director-simulation.js && node test/director-network.js && node test/campaign-network-journey.js && node test/director-network-recovery.js && node test/player-opportunities.js && node test/world-consequences.js && node test/rc1-city-gameplay-source-compatibility.js && npm run test:gateway && npm run test:legal-security && npm run test:release-source-transfer\",\n    \"phase2:definitions:check\": \"node test/phase2-definition-schema.js && node test/phase2-definitions.js && node test/phase2-activation.js && node test/phase2-definition-invariants.js\",\n    \"phase2:lots:check\": \"node test/phase2-lot-boundary.js && node test/phase2-lots.js && node test/phase2-lots-property.js\",\n"
      }
    ]
  },
  "schema.sql": {
    "predecessorAbsent": false,
    "mode": "100755",
    "currentSha256": "d8131ea84e1eb6eb186ee42fa722ce13fd0b8b6dd1b056395037d471d09c7fda",
    "currentBlob": "a0659f7908061802b87d1c40aa22d4de7e7632c5",
    "currentBytes": 624050,
    "baselineSha256": "b2a337dfaddd06f670774c9bbf2ddebb09c5857a769be598aa54376ea29fa5f7",
    "baselineBlob": "9a2605d3d4c6fdcb382184ccc1e1ce12180c3a42",
    "baselineBytes": 623900,
    "contextLines": 3,
    "inverses": [
      {
        "current": "-- Lineage cutover reconciliation reads only the current/previous UTC day after its first full pass.\n-- Keep the time key behind the two exact filters so restarts do not revisit the lifetime ledger.\nCREATE INDEX IF NOT EXISTS ix_tx_currency_reason_at ON transactions (currency, reason, at);\n-- The five-minute economy monitor reads a bounded recent window across all sources.\nCREATE INDEX IF NOT EXISTS ix_tx_at_id ON transactions (at, id);\nCREATE INDEX IF NOT EXISTS ix_tx_character ON transactions (character_id);\nCREATE INDEX IF NOT EXISTS ix_rng_action ON rng_audit (action);\n-- (red-team R16) funnelStats filters telemetry by event ('broadcast_share'/'first_week_step'); without\n",
        "baseline": "-- Lineage cutover reconciliation reads only the current/previous UTC day after its first full pass.\n-- Keep the time key behind the two exact filters so restarts do not revisit the lifetime ledger.\nCREATE INDEX IF NOT EXISTS ix_tx_currency_reason_at ON transactions (currency, reason, at);\nCREATE INDEX IF NOT EXISTS ix_tx_character ON transactions (character_id);\nCREATE INDEX IF NOT EXISTS ix_rng_action ON rng_audit (action);\n-- (red-team R16) funnelStats filters telemetry by event ('broadcast_share'/'first_week_step'); without\n"
      }
    ]
  },
  "src/economy-monitor.js": {
    "predecessorAbsent": true,
    "mode": "100644",
    "currentSha256": "bcd10f2fbc0f45c73243d8a2aaa07d934f603ffe8b83607678ad5582775a25a9",
    "currentBlob": "4381c7942f7cd4bdb020a1e73ad8c2ece29e1050",
    "currentBytes": 16574,
    "baselineSha256": null,
    "baselineBlob": null,
    "baselineBytes": null,
    "contextLines": 3,
    "inverses": []
  },
  "src/game.js": {
    "predecessorAbsent": false,
    "mode": "100644",
    "currentSha256": "b8908ca04307476f40c712efa25909ac0b84f2e7ccfdd737de9ae802581d63a0",
    "currentBlob": "47fc6feb58ad0d01636f855eebd579d262a45b5a",
    "currentBytes": 230395,
    "baselineSha256": "7b2d6a8feaebbf77988afde846565b0a01b0e7a7f11dd83403b73841f1c246f2",
    "baselineBlob": "947046030354529e41b509cb5229147ce466bee5",
    "baselineBytes": 230049,
    "contextLines": 3,
    "inverses": [
      {
        "current": "         STABLE, SPEAKEASY, ESTATE, MADE, CREW, crewObjectiveOf, DEEDS, deedController , runOf, npcOf, usd, WALLET_FORGE, bustAttemptsLeft, bustRefillSeconds, safehouseLeftMs , coolLeft, coolWait } from './rules.js';\nimport { dbCaps } from './db.js';\nimport { accrue } from './accrual.js';\nimport { captureAccrualEconomy, accrualEconomyIssues } from './economy-monitor.js';\nimport { consumeStreetActionCooldown } from './actioncooldown.js';\nimport { resolvedBoundedClaimIds, takeAccountDailyClaim } from './accountdaily.js';\nimport { logCollect } from './collection.js';\n",
        "baseline": "         STABLE, SPEAKEASY, ESTATE, MADE, CREW, crewObjectiveOf, DEEDS, deedController , runOf, npcOf, usd, WALLET_FORGE, bustAttemptsLeft, bustRefillSeconds, safehouseLeftMs , coolLeft, coolWait } from './rules.js';\nimport { dbCaps } from './db.js';\nimport { accrue } from './accrual.js';\nimport { consumeStreetActionCooldown } from './actioncooldown.js';\nimport { resolvedBoundedClaimIds, takeAccountDailyClaim } from './accountdaily.js';\nimport { logCollect } from './collection.js';\n"
      },
      {
        "current": "  `${+new Date(ch.last_accrued_at)}|${Number(ch.bank_intransit || 0)}|${Number(acct?.unbonding || 0)}`;\n\nasync function accrueAndLedger(client, ch, acct, owned) {\n  const economyBefore = captureAccrualEconomy(ch, owned);\n  accrueInMemory(ch, acct, owned);\n  // §7.1 accrued racket/front income is a faucet — record it so the ledger balances\n  if (ch._accruedIncome > 0) {\n",
        "baseline": "  `${+new Date(ch.last_accrued_at)}|${Number(ch.bank_intransit || 0)}|${Number(acct?.unbonding || 0)}`;\n\nasync function accrueAndLedger(client, ch, acct, owned) {\n  accrueInMemory(ch, acct, owned);\n  // §7.1 accrued racket/front income is a faucet — record it so the ledger balances\n  if (ch._accruedIncome > 0) {\n"
      },
      {
        "current": "    await client.query('UPDATE account_persistent SET product_moved = product_moved + $1 WHERE account_id=$2',\n      [Math.floor(ch._crewSale.proceeds), ch.account_id]);\n  }\n  const economyIssues = accrualEconomyIssues(economyBefore, ch);\n  if (economyIssues.length)\n    await track(client, ch.account_id, 'economy_payout_bound', { characterId: ch.id, issues: economyIssues });\n  if (ch._raid) {\n    await rngLog(client, ch.id, 'raid', ch._raid.roll, `raided (P ${ch._raid.pWindow.toFixed(4)}, kept ${ch._raid.keepPct}%)`);\n    await notify(client, ch.id, 'raid', { lost: ch._raid.lost, keptPct: ch._raid.keepPct });\n",
        "baseline": "    await client.query('UPDATE account_persistent SET product_moved = product_moved + $1 WHERE account_id=$2',\n      [Math.floor(ch._crewSale.proceeds), ch.account_id]);\n  }\n  if (ch._raid) {\n    await rngLog(client, ch.id, 'raid', ch._raid.roll, `raided (P ${ch._raid.pWindow.toFixed(4)}, kept ${ch._raid.keepPct}%)`);\n    await notify(client, ch.id, 'raid', { lost: ch._raid.lost, keptPct: ch._raid.keepPct });\n"
      }
    ]
  },
  "src/invariants.js": {
    "predecessorAbsent": false,
    "mode": "100644",
    "currentSha256": "c800b02d492e9068ad68c50607061685a6d2b00e5850b733239eee0549264a67",
    "currentBlob": "42715dd4c1f23a0a57a1b8567249968cdd2a6aec",
    "currentBytes": 143062,
    "baselineSha256": "e75cc63ff714f0bd9169fea5d4d8171a61b8812bdd82f24f648bdbbe9b09e168",
    "baselineBlob": "b0dcabcd1589cb914860fc629f69aff856507e82",
    "baselineBytes": 142735,
    "contextLines": 3,
    "inverses": [
      {
        "current": "  await pool.query('INSERT INTO telemetry (id, event, props) VALUES ($1,$2,$3)',\n    [crypto.randomUUID(), event, JSON.stringify(failed)]);\n  console.error(`🚨 ${kind === 'ledger' ? '§10.4 LEDGER' : kind.toUpperCase()} INVARIANT DRIFT:`, JSON.stringify(failed));\n  let webhook = 'not_configured';\n  if (process.env.INVARIANT_WEBHOOK_URL) {\n    webhook = 'failed';\n    // RETRIED, with backoff (bulletproof pass, 2026-08-21). This is the single most important\n    // outbound POST in the app — the alarm the whole invariant machinery exists to deliver — and it\n    // was one transient Discord 502 away from being lost: the telemetry row and the console line\n",
        "baseline": "  await pool.query('INSERT INTO telemetry (id, event, props) VALUES ($1,$2,$3)',\n    [crypto.randomUUID(), event, JSON.stringify(failed)]);\n  console.error(`🚨 ${kind === 'ledger' ? '§10.4 LEDGER' : kind.toUpperCase()} INVARIANT DRIFT:`, JSON.stringify(failed));\n  if (process.env.INVARIANT_WEBHOOK_URL) {\n    // RETRIED, with backoff (bulletproof pass, 2026-08-21). This is the single most important\n    // outbound POST in the app — the alarm the whole invariant machinery exists to deliver — and it\n    // was one transient Discord 502 away from being lost: the telemetry row and the console line\n"
      },
      {
        "current": "        // nothing worth the branch, and the payload-shape 400s have their own regression above.\n        if (res && res.ok === false && i < attempts - 1) { await new Promise((r) => setTimeout(r, retryDelaysMs[i])); continue; }\n        if (res && res.ok === false) console.error(`invariant webhook failed after ${attempts} attempts`, `HTTP ${res.status}`);\n        else webhook = 'delivered';\n        break;\n      } catch (e) {\n        if (i === attempts - 1) console.error(`invariant webhook failed after ${attempts} attempts`, e.message);\n",
        "baseline": "        // nothing worth the branch, and the payload-shape 400s have their own regression above.\n        if (res && res.ok === false && i < attempts - 1) { await new Promise((r) => setTimeout(r, retryDelaysMs[i])); continue; }\n        if (res && res.ok === false) console.error(`invariant webhook failed after ${attempts} attempts`, `HTTP ${res.status}`);\n        break;\n      } catch (e) {\n        if (i === attempts - 1) console.error(`invariant webhook failed after ${attempts} attempts`, e.message);\n"
      },
      {
        "current": "      }\n    }\n  }\n  // Existing callers remain best-effort. Monitors with durable episode suppression can distinguish\n  // a locally recorded alert from exhausted external delivery and retry on their next sample.\n  return { recorded: true, webhook };\n}\n\n// One human-readable line per failed check, clamped under Discord's 2,000-char message limit. Every alert\n",
        "baseline": "      }\n    }\n  }\n}\n\n// One human-readable line per failed check, clamped under Discord's 2,000-char message limit. Every alert\n"
      }
    ]
  },
  "src/worker.js": {
    "predecessorAbsent": false,
    "mode": "100644",
    "currentSha256": "84d388556abf7e40d8a69c0774c997670fffb48654d6d9eda8a25ace09794789",
    "currentBlob": "40b7c121ef5e59c32344c098da006b035d6e63fe",
    "currentBytes": 87231,
    "baselineSha256": "2a07dc2ac6740ffa9495b08f807d4cae591e0e7c8cc50da3f2746f9b6eaf0329",
    "baselineBlob": "84be99e513a7a66343f0652a55fdc6d885d8687a",
    "baselineBytes": 86380,
    "contextLines": 3,
    "inverses": [
      {
        "current": "import { levelOf, dayOf, CONSTANTS, DUELS, COMMISSION, POPULATION, FAMILY_YIELD, recapTitleOf } from './rules.js';\nimport { recordReckoning } from './season.js';\nimport { runLedgerInvariants, alertDrift } from './invariants.js';\nimport { runEconomyMonitor } from './economy-monitor.js';\nimport { runVigInvariants, chainParity } from './vig.js';\nimport { carveExchange, mergeLegacyYieldPools, payFamilyYield, runExchangeInvariants } from './exchange.js';\nimport { runRouterInvariants } from './router.js';\n",
        "baseline": "import { levelOf, dayOf, CONSTANTS, DUELS, COMMISSION, POPULATION, FAMILY_YIELD, recapTitleOf } from './rules.js';\nimport { recordReckoning } from './season.js';\nimport { runLedgerInvariants, alertDrift } from './invariants.js';\nimport { runVigInvariants, chainParity } from './vig.js';\nimport { carveExchange, mergeLegacyYieldPools, payFamilyYield, runExchangeInvariants } from './exchange.js';\nimport { runRouterInvariants } from './router.js';\n"
      },
      {
        "current": "  setInterval(guardedCompanyTick, 30000);\n  void guardedCompanyTick();\n\n  // A bounded economic window runs independently of the hourly settlements and daily full sweep.\n  // Register first, so a failed initial sample cannot prevent later observations. The monitor owns\n  // durable episode suppression; this guard keeps slow database/webhook work from overlapping here.\n  let economyTicking = false;\n  const guardedEconomyTick = async () => {\n    if (economyTicking) return;\n    economyTicking = true;\n    try {\n      const summary = await runEconomyMonitor(pool, { alert: alertDrift });\n      console.log('[economy monitor]', JSON.stringify(summary));\n    } catch (error) {\n      console.error('worker: economy monitor failed', error);\n    } finally { economyTicking = false; }\n  };\n  setInterval(guardedEconomyTick, 5 * 60 * 1000);\n  void guardedEconomyTick();\n\n  // H1 operational health is its own fixed five-minute clock. JavaScript time chooses only when to\n  // wake; sweepRwaHealth derives every authoritative slot/timestamp from PostgreSQL. Recomputing the\n  // next wall boundary after each run avoids completion-relative drift, and the local guard prevents\n",
        "baseline": "  setInterval(guardedCompanyTick, 30000);\n  void guardedCompanyTick();\n\n  // H1 operational health is its own fixed five-minute clock. JavaScript time chooses only when to\n  // wake; sweepRwaHealth derives every authoritative slot/timestamp from PostgreSQL. Recomputing the\n  // next wall boundary after each run avoids completion-relative drift, and the local guard prevents\n"
      }
    ]
  },
  "test/economy-composition-restart.js": {
    "predecessorAbsent": true,
    "mode": "100644",
    "currentSha256": "3e2fe025a508801729b159fe992a6709bb0b11d7d47df328c8e0c269667c27a7",
    "currentBlob": "62a3d107f3a31f963a277647dce165a48db49b04",
    "currentBytes": 2785,
    "baselineSha256": null,
    "baselineBlob": null,
    "baselineBytes": null,
    "contextLines": 3,
    "inverses": []
  },
  "test/economy-composition.js": {
    "predecessorAbsent": true,
    "mode": "100644",
    "currentSha256": "b9bd2e165f1b792f49ad64708f82ee35844e5f872c05a2475e4e5571d5be354c",
    "currentBlob": "f34e219bd5800b4ac68cfa3381b43f56e4fca35e",
    "currentBytes": 21612,
    "baselineSha256": null,
    "baselineBlob": null,
    "baselineBytes": null,
    "contextLines": 3,
    "inverses": []
  },
  "test/economy-monitor.js": {
    "predecessorAbsent": true,
    "mode": "100644",
    "currentSha256": "2a69549167ec3b098d8070ff3fcdf6a6a0bda77a7983d4877012e36a2b9f067a",
    "currentBlob": "1735b4f995195995d49836f548536b5f9c777e0d",
    "currentBytes": 13863,
    "baselineSha256": null,
    "baselineBlob": null,
    "baselineBytes": null,
    "contextLines": 3,
    "inverses": []
  }
};
for (const pin of Object.values(ECONOMY_MONITOR_SOURCE_DOMAINS)) {
  for (const inverse of pin.inverses) Object.freeze(inverse);
  Object.freeze(pin.inverses); Object.freeze(pin);
}
Object.freeze(ECONOMY_MONITOR_SOURCE_DOMAINS);
const lf = text => text.replaceAll('\r\n', '\n');
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
const uniform = text => typeof text === 'string' && !text.startsWith('\ufeff') && !text.includes('\0')
  && (text === lf(text) || text === lf(text).replaceAll('\n', '\r\n'));

export function assertEconomyMonitorSourceTransfer(file, input) {
  assert(Object.hasOwn(ECONOMY_MONITOR_SOURCE_DOMAINS, file), 'Unknown economy monitor source domain');
  assert(uniform(input), 'Uniform whole economy monitor LF/CRLF source text required');
  const pin = ECONOMY_MONITOR_SOURCE_DOMAINS[file], text = lf(input);
  assert.equal(sha256(text), pin.currentSha256, 'Complete economy monitor source drift: ' + file);
  assert.equal(blob(text), pin.currentBlob, 'Complete economy monitor blob drift: ' + file);
  assert.equal(Buffer.byteLength(text), pin.currentBytes);
  if (pin.predecessorAbsent) {
    assert.equal(pin.baselineSha256, null); assert.equal(pin.baselineBlob, null);
    assert.equal(pin.baselineBytes, null); assert.equal(pin.inverses.length, 0);
    return Object.freeze({ file, baselineText: null, predecessorAbsent: true, postimageSha256: pin.currentSha256,
      sourceRevision: ECONOMY_MONITOR_SOURCE_REVISION, predecessorRevision: ECONOMY_MONITOR_SOURCE_PREDECESSOR,
      inverseChunks: 0, phase: ECONOMY_MONITOR_SOURCE_PHASE, sourceOnly: true, runtime: false, native: false });
  }
  let baselineText = text;
  for (const inverse of pin.inverses) {
    assert(inverse.current.length);
    assert.equal(baselineText.split(inverse.current).length - 1, 1, 'Missing or duplicate economy monitor inverse: ' + file);
    baselineText = baselineText.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(sha256(baselineText), pin.baselineSha256, 'Complete economy monitor predecessor source mismatch: ' + file);
  assert.equal(blob(baselineText), pin.baselineBlob, 'Complete economy monitor predecessor blob mismatch: ' + file);
  assert.equal(Buffer.byteLength(baselineText), pin.baselineBytes);
  return Object.freeze({ file, baselineText, predecessorAbsent: false, postimageSha256: pin.currentSha256,
    sourceRevision: ECONOMY_MONITOR_SOURCE_REVISION, predecessorRevision: ECONOMY_MONITOR_SOURCE_PREDECESSOR,
    inverseChunks: pin.inverses.length, phase: ECONOMY_MONITOR_SOURCE_PHASE, sourceOnly: true, runtime: false, native: false });
}

export function economyMonitorHistoricalInput(file, input) {
  if (!Object.hasOwn(ECONOMY_MONITOR_SOURCE_DOMAINS, file)) return input;
  const pin = ECONOMY_MONITOR_SOURCE_DOMAINS[file];
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'Lossless UTF-8 physical source only; lossless UTF-8 required');
  if (!uniform(text) || sha256(lf(text)) !== pin.currentSha256 || pin.predecessorAbsent) return input;
  const baseline = assertEconomyMonitorSourceTransfer(file, text).baselineText;
  return buffer ? Buffer.from(baseline) : baseline;
}
