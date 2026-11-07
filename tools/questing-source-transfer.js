// Exact questing comparison-only successor; never imported by game/runtime/native admission.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const source = {
  "status": "SEALED",
  "phase": "EXACT_QUESTING_SOURCE_COMPARISON_ONLY",
  "revision": "a25c568a324c3cc400681095ca4f1566ac7c1638",
  "tree": "7855586c29c2adfc59b41ac31ec31831a90c302f",
  "predecessor": "17fdf85fdd21fd3767463df8ba47614f7d1f6432",
  "predecessorTree": "a0be7bcf49d3b85fb59072042df2f1d0f232b718",
  "files": {
    ".github/workflows/ci.yml": {
      "current": {
        "mode": "100644",
        "blob": "b1107a462aa1ef35f4bbecd1b23265df168d580c",
        "sha256": "b59af458017d60a95f081a91a008196674cafbce658b6607221dc0dc488e2df8",
        "bytes": 75984
      },
      "baseline": {
        "mode": "100644",
        "blob": "b3e1bba6a4064d39397cc1c6b54e425d08c4d49d",
        "sha256": "82d4545f3edde5a66e2eba38706ebd22b16c66a157709f1dc93fddcd24f9ffcb",
        "bytes": 72681
      },
      "inverses": [
        {
          "at": 10702,
          "current": "          POPULATION_OFF: 'on'      # residents on the streets roster would vary the screens run to run\n        run: npm run mobile\n\n  questing_browser:\n    name: Quest acceptance and browser playthroughs\n    runs-on: ubuntu-latest\n    timeout-minutes: 15\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 0\n      - uses: actions/setup-node@v7\n        with:\n          node-version: '22'\n          cache: npm\n      - run: npm ci\n      - run: npx playwright-core install --with-deps chromium\n      - name: Quest runtime, cases and community workshop\n        run: npm run test:questing\n      - name: Production quest and clue interfaces\n        run: |\n          export CHROMIUM_PATH=\"$(node --input-type=module -e 'import { chromium } from \"playwright-core\"; process.stdout.write(chromium.executablePath());')\"\n          npm run test:questing:browser\n      - run: npm run questing:check\n\n  questing_native:\n    name: Quest authority and concurrency (PostgreSQL)\n    runs-on: ubuntu-latest\n    timeout-minutes: 15\n    services:\n      postgres:\n        image: postgres:18\n        env:\n          POSTGRES_PASSWORD: questing\n          POSTGRES_DB: omerta_questing_ci\n        ports:\n          - 5432:5432\n        options: >-\n          --health-cmd \"pg_isready -U postgres\"\n          --health-interval 5s\n          --health-timeout 5s\n          --health-retries 12\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 0\n      - uses: actions/setup-node@v7\n        with:\n          node-version: '22'\n          cache: npm\n      - run: npm ci\n      - name: Set owned test PostgreSQL lock capacity for populated migrations\n        timeout-minutes: 3\n        shell: bash\n        env:\n          POSTGRES_SERVICE_ID: ${{ job.services.postgres.id }}\n        run: |\n          set -euo pipefail\n          # The context identifies only this matrix job's disposable service container.\n          [[ \"$POSTGRES_SERVICE_ID\" =~ ^[0-9a-f]{64}$ ]] || { echo 'Missing owned PostgreSQL service container ID' >&2; exit 1; }\n          timeout 15s docker exec \"$POSTGRES_SERVICE_ID\" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'ALTER SYSTEM SET max_locks_per_transaction = 512;'\n          timeout 45s docker restart --timeout 30 \"$POSTGRES_SERVICE_ID\"\n          ready=0\n          deadline=$((SECONDS + 60))\n          while (( SECONDS < deadline )); do\n            if timeout 3s docker exec \"$POSTGRES_SERVICE_ID\" pg_isready -q -t 1 -U postgres -d postgres; then\n              ready=1\n              break\n            fi\n            sleep 1\n          done\n          [[ \"$ready\" == 1 ]] || { echo 'Owned PostgreSQL service did not become ready within 60 seconds' >&2; exit 1; }\n          actual=\"$(timeout 10s docker exec \"$POSTGRES_SERVICE_ID\" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc 'SHOW max_locks_per_transaction;')\"\n          [[ \"$actual\" == 512 ]] || { echo \"Unexpected test max_locks_per_transaction: $actual\" >&2; exit 1; }\n\n      - name: Native invitation, handoff and receipt races\n        env:\n          QUESTING_TEST_DATABASE_URL: postgres://postgres:questing@127.0.0.1:5432/omerta_questing_ci\n          JWT_SECRET: ci-questing-jwt-not-a-real-secret\n          MOD_KEY: ci-questing-mod-not-a-real-secret\n          MARKET_SEED: ciQuestingMarketSeed7Qx2mVb9PwLn4\n          SOCIAL_VERIFY_MODE: 'off'\n          POPULATION_OFF: 'on'\n        run: npm run test:questing:postgres\n\n  ux_browser:\n    name: UX desktop and mobile regression\n    needs: [suites, suite_tail]\n",
          "baseline": "          POPULATION_OFF: 'on'      # residents on the streets roster would vary the screens run to run\n        run: npm run mobile\n\n  ux_browser:\n    name: UX desktop and mobile regression\n    needs: [suites, suite_tail]\n"
        }
      ]
    },
    "package.json": {
      "current": {
        "mode": "100644",
        "blob": "4ddf683f274cbd8666de3bfe2ace5481429f26e7",
        "sha256": "44d6110eaa8ed8dbd18095bba73f5ccdddda480f2c2e37e1b2b633a06d64eb05",
        "bytes": 62053
      },
      "baseline": {
        "mode": "100644",
        "blob": "e974da47da54a5500b4605c77e81a55be78bc2fb",
        "sha256": "c25139ddc6d46f99ab9060ce02871cb6be1af4a407912272feda6011ad59076e",
        "bytes": 61440
      },
      "inverses": [
        {
          "at": 11273,
          "current": "    \"phase2:lots:check\": \"node test/phase2-lot-boundary.js && node test/phase2-lots.js && node test/phase2-lots-property.js\",\n    \"phase2:lots:postgres\": \"node test/phase2-postgres.js --lots\",\n    \"phase2:definitions:postgres\": \"node test/phase2-postgres.js --definitions\",\n    \"test\": \"npm run test:questing && npm run test:ux && node test/classic-interface-source-compatibility.js && npm run test:player-experience && node test/player-intel.js && node test/player-intel-projections.js && node test/player-intel-gates.js && node test/resourceproviders.js && node test/resourceauction.js && node test/resourcepayments.js && node test/resourcecompute.js && node test/resourcework.js && node test/resourcelabor.js && node test/resourcebusiness.js && node test/resourceoutcomes.js && node test/resourcestorefront.js && node test/agentcompany.js && node test/resourceoutcomeobserver.js && node test/businesspolicy.js && node test/business-agent.js && node test/computeexperiment.js && node test/compute-experiment-cli.js && node test/computerouting.js && node test/computeoutcomes.js && node test/compute-router-cli.js && node test/decisionproofs.js && node test/decisionproofs-api.js && node test/resource-agent.js && node test/resource-worker.js && node test/operatingpolicy.js && node test/supplytenders.js && node test/supplytenders-api.js && node test/warehouseleases.js && node test/warehouseleases-api.js && node test/crewlogistics.js && node test/crewlogistics-api.js && node test/franchiselicenses.js && node test/franchiselicenses-api.js && node test/intelforecasts.js && node test/intelforecastjobs.js && node test/intelforecastjobs-api.js && node test/rc1-intel-source-compatibility.js && node test/rc1-loan-source-compatibility.js && node test/rc1-invoice-source-compatibility.js && node test/deliveryfinanceterms.js && node test/deliveryfinance.js && node test/deliveryfinance-guards.js && node test/deliveryfinance-api.js && node test/logisticscoverageterms.js && node test/logisticscoverage-event-clock.js && node test/logisticscoverage.js && node test/logisticscoverage-api.js && node test/rc1-logistics-coverage-source-compatibility.js && node test/strategylicenses.js && node test/strategylicenses-api.js && node test/rc1-strategy-source-compatibility.js && node test/companysuccession.js && node test/companysuccession-api.js && node test/rc1-company-succession-source-compatibility.js && node test/marketfeed.js && node test/marketfeed-api.js && node test/rc1-market-feed-source-compatibility.js && node test/strategyleagues.js && node test/strategyleagues-api.js && node test/rc1-strategy-league-source-compatibility.js && node test/supplier-history.js && node test/delivery.js && node test/depot.js && node test/restock.js && node test/restock-api.js && node test/smoke.js && node test/persist.js && node test/economy.js && node test/goods-market.js && node test/social.js && node test/growth.js && node test/hardening.js && node test/agent-alpha.js && node test/agentturn.js && node test/security.js && node test/chain.js && node test/watcher.js && node test/vig.js && node test/casino.js && node test/heists.js && node test/convoy.js && node test/commission.js && node test/stockcatalog.js && node test/stockcatalogv2.js && node test/market.js && node test/skills.js && node test/underworld.js && node test/law.js && node test/world.js && node test/npcwar.js && node test/pen.js && node test/loans.js && node test/portfolio.js && node test/estate.js && node test/deeds.js && node test/auction.js && node test/wire.js && node test/store.js && node test/pass.js && node test/landmarks.js && node test/speakeasy.js && node test/boxing.js && node test/inventory-bond-checkout.js && node test/bonds.js && node test/races.js && node test/port.js && node test/stable.js && node test/migrate.js && node test/emission.js && node test/desk.js && node test/made.js && node test/nft.js && node test/reimport.js && node test/walletforge.js && node test/expansion.js && node test/dynasty.js && node test/intrigue.js && node test/megaproject.js && node test/duels.js && node test/clues.js && node test/seasons.js && node test/ring.js && node test/standing.js && node test/sacking.js && node test/shields.js && node test/population.js && node test/tokenomics.js && node test/treasury.js && node test/stockdeliver.js && node test/dexbot.js && node test/mastery.js && node test/activity.js && node test/brokers.js && node test/deed-upgrades.js && node test/deed-upgrade-ownership.js && node test/bank.js && node test/community.js && node test/tokenhealth.js && node test/regimen.js && node test/career.js && node test/favors.js && node test/crew.js && node test/firstblood.js && node test/discovery.js && node test/mentor.js && node test/events.js && node test/results.js && node test/vouch.js && node test/streak.js && node test/circle.js && node test/collision.js && node test/firsts.js && node test/runs.js && node test/shipment.js && node test/avatar.js && node test/portrait.js && node test/nft-art.js && node test/portrait-access.js && node test/push.js && node test/dispatch.js && node test/pwa.js && node test/people.js && node test/citywire.js && node test/bulletin.js && node test/explore.js && node test/primetime.js && node test/citymap.js && node test/day.js && node test/payroll.js && node test/home.js && node test/streets.js && node test/citywide.js && node test/drop.js && node test/sweeps.js && node test/tax.js && node test/router.js && node test/auth.js && node test/rules.js && node test/path-funnel.js && node test/routes.js && node test/diagram-renderer.js && node test/coldstart.js && node test/preflight.js && node test/client-ip.js && node test/client.js && node test/engagement.js && node test/levers.js && node test/graph.js && node test/gates.js && node test/chainparams.js && node test/docs.js && node test/playthrough-truth.js && node tools/knowledge-test.js && node test/genesisauction.js && node test/genesis-auction-http.js && node test/player-genesis-client.js && node test/genesis-auction-operations.js && node test/genesis-deploy-client.js && node test/city-presence.js && node test/city-presence-api.js && node test/city-activity.js && node test/city-social-api.js && node test/city-homes-api.js && npm run test:city:layout && npm run test:city-gameplay && npm run test:company-workforce && npm run test:company-commercial && npm run test:company-autonomy && node test/wiki-economy-media.js\",\n    \"content:check\": \"npm run content:check:corpus\",\n    \"content:check:corpus\": \"node tools/content.js check-corpus content/packs\",\n    \"content:build\": \"node tools/content.js build content/packs/sixth-chair-v2/pack.json content/dist/sixth-chair-v2.json\",\n",
          "baseline": "    \"phase2:lots:check\": \"node test/phase2-lot-boundary.js && node test/phase2-lots.js && node test/phase2-lots-property.js\",\n    \"phase2:lots:postgres\": \"node test/phase2-postgres.js --lots\",\n    \"phase2:definitions:postgres\": \"node test/phase2-postgres.js --definitions\",\n    \"test\": \"npm run test:ux && node test/classic-interface-source-compatibility.js && npm run test:player-experience && node test/player-intel.js && node test/player-intel-projections.js && node test/player-intel-gates.js && node test/resourceproviders.js && node test/resourceauction.js && node test/resourcepayments.js && node test/resourcecompute.js && node test/resourcework.js && node test/resourcelabor.js && node test/resourcebusiness.js && node test/resourceoutcomes.js && node test/resourcestorefront.js && node test/agentcompany.js && node test/resourceoutcomeobserver.js && node test/businesspolicy.js && node test/business-agent.js && node test/computeexperiment.js && node test/compute-experiment-cli.js && node test/computerouting.js && node test/computeoutcomes.js && node test/compute-router-cli.js && node test/decisionproofs.js && node test/decisionproofs-api.js && node test/resource-agent.js && node test/resource-worker.js && node test/operatingpolicy.js && node test/supplytenders.js && node test/supplytenders-api.js && node test/warehouseleases.js && node test/warehouseleases-api.js && node test/crewlogistics.js && node test/crewlogistics-api.js && node test/franchiselicenses.js && node test/franchiselicenses-api.js && node test/intelforecasts.js && node test/intelforecastjobs.js && node test/intelforecastjobs-api.js && node test/rc1-intel-source-compatibility.js && node test/rc1-loan-source-compatibility.js && node test/rc1-invoice-source-compatibility.js && node test/deliveryfinanceterms.js && node test/deliveryfinance.js && node test/deliveryfinance-guards.js && node test/deliveryfinance-api.js && node test/logisticscoverageterms.js && node test/logisticscoverage-event-clock.js && node test/logisticscoverage.js && node test/logisticscoverage-api.js && node test/rc1-logistics-coverage-source-compatibility.js && node test/strategylicenses.js && node test/strategylicenses-api.js && node test/rc1-strategy-source-compatibility.js && node test/companysuccession.js && node test/companysuccession-api.js && node test/rc1-company-succession-source-compatibility.js && node test/marketfeed.js && node test/marketfeed-api.js && node test/rc1-market-feed-source-compatibility.js && node test/strategyleagues.js && node test/strategyleagues-api.js && node test/rc1-strategy-league-source-compatibility.js && node test/supplier-history.js && node test/delivery.js && node test/depot.js && node test/restock.js && node test/restock-api.js && node test/smoke.js && node test/persist.js && node test/economy.js && node test/goods-market.js && node test/social.js && node test/growth.js && node test/hardening.js && node test/agent-alpha.js && node test/agentturn.js && node test/security.js && node test/chain.js && node test/watcher.js && node test/vig.js && node test/casino.js && node test/heists.js && node test/convoy.js && node test/commission.js && node test/stockcatalog.js && node test/stockcatalogv2.js && node test/market.js && node test/skills.js && node test/underworld.js && node test/law.js && node test/world.js && node test/npcwar.js && node test/pen.js && node test/loans.js && node test/portfolio.js && node test/estate.js && node test/deeds.js && node test/auction.js && node test/wire.js && node test/store.js && node test/pass.js && node test/landmarks.js && node test/speakeasy.js && node test/boxing.js && node test/inventory-bond-checkout.js && node test/bonds.js && node test/races.js && node test/port.js && node test/stable.js && node test/migrate.js && node test/emission.js && node test/desk.js && node test/made.js && node test/nft.js && node test/reimport.js && node test/walletforge.js && node test/expansion.js && node test/dynasty.js && node test/intrigue.js && node test/megaproject.js && node test/duels.js && node test/clues.js && node test/seasons.js && node test/ring.js && node test/standing.js && node test/sacking.js && node test/shields.js && node test/population.js && node test/tokenomics.js && node test/treasury.js && node test/stockdeliver.js && node test/dexbot.js && node test/mastery.js && node test/activity.js && node test/brokers.js && node test/deed-upgrades.js && node test/deed-upgrade-ownership.js && node test/bank.js && node test/community.js && node test/tokenhealth.js && node test/regimen.js && node test/career.js && node test/favors.js && node test/crew.js && node test/firstblood.js && node test/discovery.js && node test/mentor.js && node test/events.js && node test/results.js && node test/vouch.js && node test/streak.js && node test/circle.js && node test/collision.js && node test/firsts.js && node test/runs.js && node test/shipment.js && node test/avatar.js && node test/portrait.js && node test/nft-art.js && node test/portrait-access.js && node test/push.js && node test/dispatch.js && node test/pwa.js && node test/people.js && node test/citywire.js && node test/bulletin.js && node test/explore.js && node test/primetime.js && node test/citymap.js && node test/day.js && node test/payroll.js && node test/home.js && node test/streets.js && node test/citywide.js && node test/drop.js && node test/sweeps.js && node test/tax.js && node test/router.js && node test/auth.js && node test/rules.js && node test/path-funnel.js && node test/routes.js && node test/diagram-renderer.js && node test/coldstart.js && node test/preflight.js && node test/client-ip.js && node test/client.js && node test/engagement.js && node test/levers.js && node test/graph.js && node test/gates.js && node test/chainparams.js && node test/docs.js && node test/playthrough-truth.js && node tools/knowledge-test.js && node test/genesisauction.js && node test/genesis-auction-http.js && node test/player-genesis-client.js && node test/genesis-auction-operations.js && node test/genesis-deploy-client.js && node test/city-presence.js && node test/city-presence-api.js && node test/city-activity.js && node test/city-social-api.js && node test/city-homes-api.js && npm run test:city:layout && npm run test:city-gameplay && npm run test:company-workforce && npm run test:company-commercial && npm run test:company-autonomy && node test/wiki-economy-media.js\",\n    \"content:check\": \"npm run content:check:corpus\",\n    \"content:check:corpus\": \"node tools/content.js check-corpus content/packs\",\n    \"content:build\": \"node tools/content.js build content/packs/sixth-chair-v2/pack.json content/dist/sixth-chair-v2.json\",\n"
        },
        {
          "at": 60074,
          "current": "    \"test:economy-ux-source\": \"node test/contract-release-source-compatibility.js && node test/businessdesk-combined-source-compatibility.js && node test/businessdesk-combined-native-provenance.js && node test/economy-deed-merge-source-compatibility.js && node test/businessdesk-noir-source-compatibility.js && node test/businessdesk-source-compatibility.js && node test/deed-allocation-source-compatibility.js && node test/deed-benefit-native-catalog.js && node test/economy-ux-merge-source-compatibility.js\",\n    \"test:economy-security\": \"node test/economy-monitor.js && node test/economy-composition.js\",\n    \"test:eth-rewards\": \"node test/marketv2abi.js && node test/marketv2keeper-eth.js && node test/eth-rewards-readiness.js && node test/eth-rewards-upkeep.js && node test/ethrewardsworker.js && node test/eth-staking.js\",\n    \"test:eth-staking:browser\": \"node test/eth-staking.js --browser\",\n    \"test:questing\": \"node test/content-narrative.js && node test/content-narrative-security.js && node test/content-casework.js && node test/quest-saga.js && node test/quest-saga-social.js && node test/quest-specialist.js && node test/quest-workshop.js && node test/clue-puzzles.js && node test/content-api.js\",\n    \"test:questing:browser\": \"node test/quest-experience-browser.js && node test/clue-puzzles-browser.js\",\n    \"questing:check\": \"node tools/questing-content.js check && node tools/questing-workgraph.js check\",\n    \"test:questing:postgres\": \"node test/questing-postgres.js\"\n  },\n  \"dependencies\": {\n    \"@fastify/jwt\": \"^10.2.0\",\n",
          "baseline": "    \"test:economy-ux-source\": \"node test/contract-release-source-compatibility.js && node test/businessdesk-combined-source-compatibility.js && node test/businessdesk-combined-native-provenance.js && node test/economy-deed-merge-source-compatibility.js && node test/businessdesk-noir-source-compatibility.js && node test/businessdesk-source-compatibility.js && node test/deed-allocation-source-compatibility.js && node test/deed-benefit-native-catalog.js && node test/economy-ux-merge-source-compatibility.js\",\n    \"test:economy-security\": \"node test/economy-monitor.js && node test/economy-composition.js\",\n    \"test:eth-rewards\": \"node test/marketv2abi.js && node test/marketv2keeper-eth.js && node test/eth-rewards-readiness.js && node test/eth-rewards-upkeep.js && node test/ethrewardsworker.js && node test/eth-staking.js\",\n    \"test:eth-staking:browser\": \"node test/eth-staking.js --browser\"\n  },\n  \"dependencies\": {\n    \"@fastify/jwt\": \"^10.2.0\",\n"
        }
      ]
    },
    "public/index.html": {
      "current": {
        "mode": "100644",
        "blob": "36c06ad5170cd87784b1161efd0048bb2ff003b2",
        "sha256": "7437ba8597018e1cbeabb61975283c1086cc9813c4d98cf1daf6e95f257d58a0",
        "bytes": 1405906
      },
      "baseline": {
        "mode": "100644",
        "blob": "ea48eb922b9668c19d6c3aa0f9530e4cf57e772d",
        "sha256": "3b12d14aa59209466626b7f9cc9fc3d2080379d66cfdda83a15b62edf2e2e534",
        "bytes": 1405259
      },
      "inverses": [
        {
          "at": 106411,
          "current": "<link rel=\"stylesheet\" href=\"/ux-tools.css?v=20261025-1\">\n<link rel=\"stylesheet\" href=\"/ux-identity.css?v=20261025-1\">\n<link rel=\"stylesheet\" href=\"/ux-story.css?v=20261025-1\">\n<link rel=\"stylesheet\" href=\"/ux-quests.css?v=20261106-1\">\n<link rel=\"stylesheet\" href=\"/ux-clues.css?v=20261106-1\">\n<link rel=\"stylesheet\" href=\"/ux-community.css?v=20261025-1\">\n<link rel=\"stylesheet\" href=\"/ux-tactics.css?v=20261024-2\">\n<link rel=\"stylesheet\" href=\"/ux-investigation.css?v=20261024-2\">\n",
          "baseline": "<link rel=\"stylesheet\" href=\"/ux-tools.css?v=20261025-1\">\n<link rel=\"stylesheet\" href=\"/ux-identity.css?v=20261025-1\">\n<link rel=\"stylesheet\" href=\"/ux-story.css?v=20261025-1\">\n<link rel=\"stylesheet\" href=\"/ux-community.css?v=20261025-1\">\n<link rel=\"stylesheet\" href=\"/ux-tactics.css?v=20261024-2\">\n<link rel=\"stylesheet\" href=\"/ux-investigation.css?v=20261024-2\">\n"
        },
        {
          "at": 157315,
          "current": "<script src=\"/ux-tools.js?v=20261025-1\"></script>\n<script src=\"/ux-identity.js?v=20261025-1\"></script>\n<script src=\"/ux-story.js?v=20261025-1\"></script>\n<script src=\"/ux-quests.js?v=20261106-1\"></script>\n<script src=\"/ux-clues.js?v=20261106-1\"></script>\n<script src=\"/ux-community.js?v=20261025-1\"></script>\n<script src=\"/ux-tactics.js?v=20261105-noir-release\"></script>\n<script src=\"/ux-investigation.js?v=20261024-2\"></script>\n",
          "baseline": "<script src=\"/ux-tools.js?v=20261025-1\"></script>\n<script src=\"/ux-identity.js?v=20261025-1\"></script>\n<script src=\"/ux-story.js?v=20261025-1\"></script>\n<script src=\"/ux-community.js?v=20261025-1\"></script>\n<script src=\"/ux-tactics.js?v=20261105-noir-release\"></script>\n<script src=\"/ux-investigation.js?v=20261024-2\"></script>\n"
        },
        {
          "at": 709482,
          "current": "      ? `<div class=\"desk-empty desk-empty--compact\"><b>No move is issued to you.</b><span>Another party role may need to act before this file advances.</span></div>` : '';\n    return `<div class=\"desk-issued\">${actions.map((action) => {\n      if (action.kind === 'start_instance') return `<section class=\"desk-prompt\"><span class=\"desk-kicker\">Party authority</span><h3>Every required seat is ready.</h3><button class=\"act prime\" type=\"button\" data-desk-instance-action=\"${esc(action.id)}\">start the case</button></section>`;\n      if (action.kind === 'solve' && action.interaction) return `<section class=\"desk-prompt\"><span class=\"desk-kicker\">Investigation</span><h3>${esc(action.title || 'Work the evidence')}</h3><p>Use the interactive case file below to arrange evidence and submit your deduction.</p></section>`;\n      if (action.kind === 'solve') return `<form class=\"desk-prompt\" data-desk-solve=\"${esc(action.id)}\"><span class=\"desk-kicker\">Evidence question</span><h3>${esc(action.title || 'Submit an answer')}</h3>${action.prompt ? `<p>${esc(action.prompt)}</p>` : ''}\n        <label>Your answer<input name=\"answer\" autocomplete=\"off\" required placeholder=\"Type the answer from the evidence\"></label><button class=\"act prime\" type=\"submit\">submit answer</button></form>`;\n      if (action.kind === 'choose') return `<section class=\"desk-prompt\"><span class=\"desk-kicker\">Decision required</span><h3>${esc(action.title || 'Choose how this ends')}</h3>${action.prompt ? `<p>${esc(action.prompt)}</p>` : ''}\n",
          "baseline": "      ? `<div class=\"desk-empty desk-empty--compact\"><b>No move is issued to you.</b><span>Another party role may need to act before this file advances.</span></div>` : '';\n    return `<div class=\"desk-issued\">${actions.map((action) => {\n      if (action.kind === 'start_instance') return `<section class=\"desk-prompt\"><span class=\"desk-kicker\">Party authority</span><h3>Every required seat is ready.</h3><button class=\"act prime\" type=\"button\" data-desk-instance-action=\"${esc(action.id)}\">start the case</button></section>`;\n      if (action.kind === 'solve') return `<form class=\"desk-prompt\" data-desk-solve=\"${esc(action.id)}\"><span class=\"desk-kicker\">Evidence question</span><h3>${esc(action.title || 'Submit an answer')}</h3>${action.prompt ? `<p>${esc(action.prompt)}</p>` : ''}\n        <label>Your answer<input name=\"answer\" autocomplete=\"off\" required placeholder=\"Type the answer from the evidence\"></label><button class=\"act prime\" type=\"submit\">submit answer</button></form>`;\n      if (action.kind === 'choose') return `<section class=\"desk-prompt\"><span class=\"desk-kicker\">Decision required</span><h3>${esc(action.title || 'Choose how this ends')}</h3>${action.prompt ? `<p>${esc(action.prompt)}</p>` : ''}\n"
        },
        {
          "at": 733714,
          "current": "    if (!panel) return;\n    panel.innerHTML = deskState.board ? deskShell(deskState.board) : deskLoading();\n    bindContentDesk();\n    uxCall('render');\n  }\n  async function reloadContentDesk() {\n    if (deskState.loading) return;\n",
          "baseline": "    if (!panel) return;\n    panel.innerHTML = deskState.board ? deskShell(deskState.board) : deskLoading();\n    bindContentDesk();\n  }\n  async function reloadContentDesk() {\n    if (deskState.loading) return;\n"
        },
        {
          "at": 982492,
          "current": "    // and patched this slot in a beat late; it is a board in /v1/block like the rest).\n    { const slot = t.querySelector('#clue-slot');\n      const c = blk.clues;\n      if (slot && c && !window.renderOmertaCluePuzzle?.(slot, c, { action: act, refresh: renderStreets })) {\n        slot.innerHTML = c.scroll ? `<div class=\"card\" style=\"border-color:var(--gold,#c9a227);margin-top:8px\">\n            <span class=\"t\" style=\"color:var(--gold,#c9a227)\">🗺 THE TREASURE TRAIL</span> <span class=\"chip\">${esc(c.scroll.tierName || 'a Scroll')}</span> <span class=\"d\">step ${c.scroll.step} of ${c.scroll.of}${c.scroll.kind && c.scroll.kind !== 'riddle' ? ` · ${c.scroll.kind}` : ''}</span>\n            <div class=\"d\" style=\"font-style:italic\">“${esc(c.scroll.riddle)}”</div>\n",
          "baseline": "    // and patched this slot in a beat late; it is a board in /v1/block like the rest).\n    { const slot = t.querySelector('#clue-slot');\n      const c = blk.clues;\n      if (slot && c) {\n        slot.innerHTML = c.scroll ? `<div class=\"card\" style=\"border-color:var(--gold,#c9a227);margin-top:8px\">\n            <span class=\"t\" style=\"color:var(--gold,#c9a227)\">🗺 THE TREASURE TRAIL</span> <span class=\"chip\">${esc(c.scroll.tierName || 'a Scroll')}</span> <span class=\"d\">step ${c.scroll.step} of ${c.scroll.of}${c.scroll.kind && c.scroll.kind !== 'riddle' ? ` · ${c.scroll.kind}` : ''}</span>\n            <div class=\"d\" style=\"font-style:italic\">“${esc(c.scroll.riddle)}”</div>\n"
        },
        {
          "at": 1389459,
          "current": "  if (workspaceUX) uxModules.push(workspaceUX);\n  for (const factory of [window.createOmertaFeedback, window.createOmertaProgression, window.createOmertaSocial, window.createOmertaNavigation,\n    window.createOmertaTactics, window.createOmertaInvestigation, window.createOmertaCoordination,\n    window.createOmertaFeel, window.createOmertaTools, window.createOmertaIdentity, window.createOmertaStory, window.createOmertaQuests, window.createOmertaCommunity, window.createOmertaWorld]) {\n    if (!factory) continue;\n    try { const module = factory(uxContext); uxModules.push(module); if (factory === window.createOmertaFeedback) feedbackUX = module; }\n    catch (error) { console.warn('UI enhancement unavailable', error); }\n",
          "baseline": "  if (workspaceUX) uxModules.push(workspaceUX);\n  for (const factory of [window.createOmertaFeedback, window.createOmertaProgression, window.createOmertaSocial, window.createOmertaNavigation,\n    window.createOmertaTactics, window.createOmertaInvestigation, window.createOmertaCoordination,\n    window.createOmertaFeel, window.createOmertaTools, window.createOmertaIdentity, window.createOmertaStory, window.createOmertaCommunity, window.createOmertaWorld]) {\n    if (!factory) continue;\n    try { const module = factory(uxContext); uxModules.push(module); if (factory === window.createOmertaFeedback) feedbackUX = module; }\n    catch (error) { console.warn('UI enhancement unavailable', error); }\n"
        }
      ]
    },
    "schema.sql": {
      "current": {
        "mode": "100755",
        "blob": "7a254a435c95a93cc5d8419b453988b0df30b5c1",
        "sha256": "af6d9ad01566eaddf8ec6b4c4da4add77837b13e6a3510697bebf62b180b97e7",
        "bytes": 625495
      },
      "baseline": {
        "mode": "100755",
        "blob": "9795c322aed438cb3011bf16b83bc399af6200d5",
        "sha256": "9f272bef0d8a6ebb22d94654a7e3daa2f2e2c0f2fe94a3b429973c3923cca976",
        "bytes": 624168
      },
      "inverses": [
        {
          "at": 621028,
          "current": "CREATE TABLE IF NOT EXISTS ux_mentor_subjects (\n account_id TEXT PRIMARY KEY, specialties TEXT NOT NULL, help_subject TEXT NOT NULL DEFAULT '', published_until TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n\n-- Bounded player-authored mysteries: fictional evidence, account-owned play and ratings.\nCREATE TABLE IF NOT EXISTS quest_workshop_mysteries (\n  id TEXT PRIMARY KEY,\n  author_account_id TEXT NOT NULL REFERENCES accounts(id),\n  author_credit TEXT NOT NULL,\n  title TEXT NOT NULL,\n  template_id TEXT NOT NULL,\n  scene_id TEXT NOT NULL,\n  culprit_id TEXT NOT NULL,\n  clue_ids TEXT NOT NULL,\n  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),\n  published_at TIMESTAMPTZ\n);\nCREATE INDEX IF NOT EXISTS ix_quest_workshop_author ON quest_workshop_mysteries(author_account_id);\nCREATE INDEX IF NOT EXISTS ix_quest_workshop_published ON quest_workshop_mysteries(status,published_at);\nCREATE TABLE IF NOT EXISTS quest_workshop_plays (\n  mystery_id TEXT NOT NULL REFERENCES quest_workshop_mysteries(id),\n  account_id TEXT NOT NULL REFERENCES accounts(id),\n  attempts INT NOT NULL DEFAULT 0,\n  solved_at TIMESTAMPTZ,\n  stars INT CHECK (stars BETWEEN 1 AND 5),\n  PRIMARY KEY (mystery_id,account_id)\n);\nCREATE TABLE IF NOT EXISTS quest_reading_room (\n  account_id TEXT NOT NULL REFERENCES accounts(id),\n  day_ordinal INT NOT NULL,\n  exercise_id TEXT NOT NULL,\n  attempts INT NOT NULL DEFAULT 0,\n  solved_at TIMESTAMPTZ,\n  PRIMARY KEY (account_id,day_ordinal)\n);\n",
          "baseline": "CREATE TABLE IF NOT EXISTS ux_mentor_subjects (\n account_id TEXT PRIMARY KEY, specialties TEXT NOT NULL, help_subject TEXT NOT NULL DEFAULT '', published_until TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n"
        }
      ]
    },
    "src/explore.js": {
      "current": {
        "mode": "100644",
        "blob": "af5a51940e27cd9c164acd30696c6c43f9257a90",
        "sha256": "d0d87a39f7a12dccf98c97662bd69d68e0643894c5ed59b345f8c5790097ca88",
        "bytes": 54070
      },
      "baseline": {
        "mode": "100644",
        "blob": "bfe21922ca3df0f50aed7aae9485d9fb8f5f7eda",
        "sha256": "27af4bee3ac1194d8f5874215472e44e60c2c37c3685aa4cc1cd5a8cd29a5e8f",
        "bytes": 54032
      },
      "inverses": [
        {
          "at": 19566,
          "current": "    case 'clue': {\n      if (jailed(ctx.ch) || safeHoused(ctx.ch)) return stop('status');\n      const scroll = ctx.live.clueBoard?.scroll || ctx.owned.work?.clue;\n      return gate(!!scroll && num(ctx.ch.energy) >= CLUES.DIG_ENERGY, scroll?.interaction ? 'clue:answer' : 'clue:dig', scroll ? 'resource' : 'status');\n    }\n    case 'reachableFamily': {\n      if (ctx.owned.gangId) return stop('status');\n",
          "baseline": "    case 'clue': {\n      if (jailed(ctx.ch) || safeHoused(ctx.ch)) return stop('status');\n      const scroll = ctx.live.clueBoard?.scroll || ctx.owned.work?.clue;\n      return gate(!!scroll && num(ctx.ch.energy) >= CLUES.DIG_ENERGY, 'clue:dig', scroll ? 'resource' : 'status');\n    }\n    case 'reachableFamily': {\n      if (ctx.owned.gangId) return stop('status');\n"
        }
      ]
    },
    "src/game.js": {
      "current": {
        "mode": "100644",
        "blob": "01e36158e5398dc8da427affd8363ee8457d7869",
        "sha256": "f8058d0890ab0d2bf226b0f1c645f95e756f9ac86cad4528c134c1fe7abb7a28",
        "bytes": 231036
      },
      "baseline": {
        "mode": "100644",
        "blob": "b879627d63b592354183384a161e8ddcb670830e",
        "sha256": "9bde6b2f4213cc034a0dbb02fd05fb49cda106f006aab629214442fee0439e5d",
        "bytes": 230977
      },
      "inverses": [
        {
          "at": 62,
          "current": "export const commercialCampaignCompletionRevision = 'commercial_campaign_v1';\n// M1 core + shared transaction machinery. Every formula cites spec §7 / prototype v24.\nimport crypto from 'node:crypto';\nimport { newClueSalt, cluePuzzleOf } from './clue-puzzles.js';\nimport { carChoiceQuote } from './car-choices.js';\nimport { recordMeeting } from './contacts.js';\nimport { recordPlayerIntel, requireKnownPlayer } from './playerintel.js';\n",
          "baseline": "export const commercialCampaignCompletionRevision = 'commercial_campaign_v1';\n// M1 core + shared transaction machinery. Every formula cites spec §7 / prototype v24.\nimport crypto from 'node:crypto';\nimport { carChoiceQuote } from './car-choices.js';\nimport { recordMeeting } from './contacts.js';\nimport { recordPlayerIntel, requireKnownPlayer } from './playerintel.js';\n"
        },
        {
          "at": 185530,
          "current": "          try {\n            const held = (await client.query('SELECT 1 FROM clue_scrolls WHERE character_id=$1', [ch.id])).rows[0];\n            if (!held) {\n              const salt = newClueSalt();\n              // TIER-4 §A: roll the trail TIER (weighted — harder is rarer); it sets the step count\n              const tier = rollClueTier(Math.random());\n              const nSteps = tier.steps;\n              await client.query('INSERT INTO clue_scrolls (character_id, salt, step, steps, tier) VALUES ($1,$2,1,$3,$4)', [ch.id, salt, nSteps, tier.id]);\n              // (red-team flag) the entry ticket to a cash faucet is audited randomness\n              await h.rngLog(client, ch.id, 'clue:drop', clueRoll, `${tier.id} scroll dropped (${nSteps} steps)`);\n              clue = { steps: nSteps, tier: tier.id, tierName: tier.name, riddle: cluePuzzleOf(salt, 1).riddle };\n              await notify(client, ch.id, 'clue_found', clue);\n            }\n            if (clueSavepoints) await client.query('RELEASE SAVEPOINT clue_drop');\n",
          "baseline": "          try {\n            const held = (await client.query('SELECT 1 FROM clue_scrolls WHERE character_id=$1', [ch.id])).rows[0];\n            if (!held) {\n              const salt = crypto.randomUUID();\n              // TIER-4 §A: roll the trail TIER (weighted — harder is rarer); it sets the step count\n              const tier = rollClueTier(Math.random());\n              const nSteps = tier.steps;\n              await client.query('INSERT INTO clue_scrolls (character_id, salt, step, steps, tier) VALUES ($1,$2,1,$3,$4)', [ch.id, salt, nSteps, tier.id]);\n              // (red-team flag) the entry ticket to a cash faucet is audited randomness\n              await h.rngLog(client, ch.id, 'clue:drop', clueRoll, `${tier.id} scroll dropped (${nSteps} steps)`);\n              clue = { steps: nSteps, tier: tier.id, tierName: tier.name, riddle: clueStepOf(salt, 1).riddle };\n              await notify(client, ch.id, 'clue_found', clue);\n            }\n            if (clueSavepoints) await client.query('RELEASE SAVEPOINT clue_drop');\n"
        }
      ]
    },
    "src/server.js": {
      "current": {
        "mode": "100644",
        "blob": "611200379d0bb36629ab79f0d5969f3bf61d9ab2",
        "sha256": "d6187be2766f8573723b60d0e198d38b31c452af19808e3338e2c14e259f8a77",
        "bytes": 308113
      },
      "baseline": {
        "mode": "100644",
        "blob": "a5aebe8a016c18d65f8be0eb375f84f2df50279b",
        "sha256": "594674b2c15555c1cec21811868281bd2d26202c35a60f451bc45b3e517e2b00",
        "bytes": 307673
      },
      "inverses": [
        {
          "at": 12812,
          "current": "import { register as registerModTools } from './routes/modtools.js';\nimport { registerRwa } from './routes/rwa.js';\nimport { register as registerContent } from './routes/content.js';\nimport { register as registerQuestWorkshop } from './routes/quest-workshop.js';\nimport { register as registerQuesting } from './routes/questing.js';\nimport { register as registerCoordination } from './routes/coordination.js';\nimport { register as registerWorldKernel } from './routes/world-kernel.js';\nimport { register as registerFamilyOperations } from './routes/family-operations.js';\n",
          "baseline": "import { register as registerModTools } from './routes/modtools.js';\nimport { registerRwa } from './routes/rwa.js';\nimport { register as registerContent } from './routes/content.js';\nimport { register as registerCoordination } from './routes/coordination.js';\nimport { register as registerWorldKernel } from './routes/world-kernel.js';\nimport { register as registerFamilyOperations } from './routes/family-operations.js';\n"
        },
        {
          "at": 45457,
          "current": "    ['ux-progression.js', 'application/javascript'], ['ux-progression.css', 'text/css'],\n    ['ux-social.js', 'application/javascript'], ['ux-social.css', 'text/css'],\n    ['ux-navigation.js', 'application/javascript'], ['ux-navigation.css', 'text/css'],\n    ...['feel', 'tools', 'identity', 'story', 'community', 'quests', 'clues'].flatMap(name => [[`ux-${name}.js`, 'application/javascript'], [`ux-${name}.css`, 'text/css']]),\n    ['ux-workspace.js', 'application/javascript'], ['ux-world.js', 'application/javascript'], ['ux-world.css', 'text/css'],\n    ['ux-tactics.js', 'application/javascript'], ['ux-tactics.css', 'text/css'],\n    ['ux-investigation.js', 'application/javascript'], ['ux-investigation.css', 'text/css'],\n",
          "baseline": "    ['ux-progression.js', 'application/javascript'], ['ux-progression.css', 'text/css'],\n    ['ux-social.js', 'application/javascript'], ['ux-social.css', 'text/css'],\n    ['ux-navigation.js', 'application/javascript'], ['ux-navigation.css', 'text/css'],\n    ...['feel', 'tools', 'identity', 'story', 'community'].flatMap(name => [[`ux-${name}.js`, 'application/javascript'], [`ux-${name}.css`, 'text/css']]),\n    ['ux-workspace.js', 'application/javascript'], ['ux-world.js', 'application/javascript'], ['ux-world.css', 'text/css'],\n    ['ux-tactics.js', 'application/javascript'], ['ux-tactics.css', 'text/css'],\n    ['ux-investigation.js', 'application/javascript'], ['ux-investigation.css', 'text/css'],\n"
        },
        {
          "at": 179543,
          "current": "    G.withCharacter(pool, req.user.sub, (ch, client, h) => Loans.repayHouseLoan(ch, client, h)));\n  registerModTools(app, { pool, auth, modAuth, closeAccountSockets });\n  registerContent(app, { pool, auth, modAuth });\n  registerQuestWorkshop(app, { pool, auth });\n  registerQuesting(app, { pool, auth });\n  const coordination = registerCoordination(app, { pool, auth, modAuth, receiptTrust: coordinationReceiptTrust });\n  registerWorldGraph(app, { pool, auth });\n  registerUxWorkspace(app, { pool, auth });\n",
          "baseline": "    G.withCharacter(pool, req.user.sub, (ch, client, h) => Loans.repayHouseLoan(ch, client, h)));\n  registerModTools(app, { pool, auth, modAuth, closeAccountSockets });\n  registerContent(app, { pool, auth, modAuth });\n  const coordination = registerCoordination(app, { pool, auth, modAuth, receiptTrust: coordinationReceiptTrust });\n  registerWorldGraph(app, { pool, auth });\n  registerUxWorkspace(app, { pool, auth });\n"
        },
        {
          "at": 299283,
          "current": "    G.readCharacter(pool, req.user.sub, (ch, client, h) => Clues.clueBoard(client, ch, h.acct)));\n  app.post('/v1/clues/dig', { preHandler: auth }, async (req) =>\n    G.withCharacter(pool, req.user.sub, (ch, client, h) => Clues.dig(ch, client, h)));\n  app.post('/v1/clues/answer', { preHandler: auth, bodyLimit: 1024 }, async (req) =>\n    G.withCharacter(pool, req.user.sub, (ch, client, h) => Clues.answer(ch, req.body, client, h)));\n  app.get('/v1/world', { preHandler: auth }, async (req) =>\n    G.readCharacter(pool, req.user.sub, (ch, client, h) => World.worldBoard(client, ch, h)));\n  app.post('/v1/world/:npcId/raid', { preHandler: auth }, async (req) =>\n",
          "baseline": "    G.readCharacter(pool, req.user.sub, (ch, client, h) => Clues.clueBoard(client, ch, h.acct)));\n  app.post('/v1/clues/dig', { preHandler: auth }, async (req) =>\n    G.withCharacter(pool, req.user.sub, (ch, client, h) => Clues.dig(ch, client, h)));\n  app.get('/v1/world', { preHandler: auth }, async (req) =>\n    G.readCharacter(pool, req.user.sub, (ch, client, h) => World.worldBoard(client, ch, h)));\n  app.post('/v1/world/:npcId/raid', { preHandler: auth }, async (req) =>\n"
        }
      ]
    }
  }
};
const expectedDigest = 'b451655ea3ea493a640ca305162c92229132979030ed5f60bf29336aad2c8b72';

const sha = value => createHash('sha256').update(value).digest('hex');
const blob = value => createHash('sha1').update('blob ' + Buffer.byteLength(value) + '\0').update(value).digest('hex');
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
export const QUESTING_SOURCE = freeze(source);

function definition() {
  assert.equal(source.status, 'SEALED');
  assert.equal(source.phase, 'EXACT_QUESTING_SOURCE_COMPARISON_ONLY');
  assert.equal(source.revision, 'a25c568a324c3cc400681095ca4f1566ac7c1638');
  assert.equal(source.predecessor, '17fdf85fdd21fd3767463df8ba47614f7d1f6432');
  assert.equal(sha(JSON.stringify(source)), expectedDigest, 'The complete questing comparison envelope changed');
}
const known = file => typeof file === 'string' && Object.hasOwn(source.files, file);
function canonical(input) {
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'Lossless complete UTF-8 source required');
  if (typeof text !== 'string') return null;
  const lf = text.replaceAll('\r\n', '\n');
  if (lf.includes('\r') || (text !== lf && text !== lf.replaceAll('\n', '\r\n'))) return null;
  return { buffer, lf };
}
function fingerprint(text, pin) {
  assert.equal(Buffer.byteLength(text), pin.bytes, 'Complete questing source length changed');
  assert.equal(sha(text), pin.sha256, 'Complete questing source hash changed');
  assert.equal(blob(text), pin.blob, 'Complete questing Git blob changed');
}

export function qualifyQuestingSource(file, input) {
  assert.equal(arguments.length, 2, 'Only a file and complete physical source are accepted');
  definition();
  assert(known(file), 'Only the seven explicit questing comparison domains are admitted');
  const current = canonical(input); assert(current, 'Uniform complete LF/CRLF source required');
  const row = source.files[file]; fingerprint(current.lf, row.current);
  let baseline = current.lf, previousEnd = current.lf.length;
  for (const inverse of row.inverses.toReversed()) {
    assert(Number.isSafeInteger(inverse.at) && inverse.at >= 0);
    assert(inverse.at + inverse.current.length <= previousEnd, 'Ordered nonoverlapping inverse contexts required');
    assert.equal(baseline.slice(inverse.at, inverse.at + inverse.current.length), inverse.current,
      'The complete pinned inverse context must match at its exact offset');
    baseline = baseline.slice(0, inverse.at) + inverse.baseline + baseline.slice(inverse.at + inverse.current.length);
    previousEnd = inverse.at;
  }
  fingerprint(baseline, row.baseline);
  return Object.freeze({ file, baselineText: baseline, sourceRevision: source.revision,
    sourceTree: source.tree, predecessor: source.predecessor, predecessorTree: source.predecessorTree,
    phase: source.phase, sourceOnly: true, runtime: false, native: false, financial: false,
    activation: false, deployment: false, priorResultsTransferred: false });
}

// Unknown bytes remain unmodified so the existing downstream exact assertions
// reject them. This function never recognizes a namespace prefix or partial hunk.
export function questingHistoricalInput(file, input) {
  if (!known(file)) return input;
  const current = canonical(input), row = source.files[file];
  if (!current || sha(current.lf) !== row.current.sha256) return input;
  const baseline = qualifyQuestingSource(file, input).baselineText;
  return current.buffer ? Buffer.from(baseline) : baseline;
}

// Used only after the actual HEAD blob/index/physical file have independently
// qualified. No native manifest or runtime loader imports this identity view.
export function questingHistoricalEntry(file, entry, kind) {
  assert(kind === 'tree' || kind === 'index', 'Choose an explicit Git identity shape');
  if (!known(file)) return entry;
  definition();
  const row = source.files[file];
  const format = pin => kind === 'tree' ? pin.mode + ' blob ' + pin.blob + '\t' + file
    : pin.mode + ' ' + pin.blob + ' 0\t' + file;
  assert(typeof entry === 'string' && (entry === format(row.current) || entry === format(row.current) + '\n'),
    'The exact actual questing Git identity must qualify before historical comparison');
  return format(row.baseline) + (entry.endsWith('\n') ? '\n' : '');
}
