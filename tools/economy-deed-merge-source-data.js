// Generated exact integration source/provenance only. No historical execution or native admission.
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const ECONOMY_DEED_MERGE_SOURCE = freeze({
  "version": 1,
  "status": "SEALED",
  "phase": "EXACT_ECONOMY_DEED_MERGE_SOURCE_ONLY",
  "sourceRevision": "34ad488a93450530136972f48c188988f1210e5f",
  "sourceTree": "d01741a225ee4bacde88dc15870f1ae9bdcae9f8",
  "profiles": {
    "monitor": {
      "revision": "c771f5ba73453a57e24e31f8eeb920933fe7544c",
      "tree": "7cbf98c004aa85577bf8675778fa5d0ff6180a55"
    },
    "deed": {
      "revision": "4e5f7fdb1cc4d2055ac613d2d4cb562a8007c364",
      "tree": "916df76fb589bb506040879b904af02275fb109d"
    }
  },
  "files": [
    {
      "file": "package.json",
      "current": {
        "mode": "100644",
        "sha256": "3d2085e0a3096cc83698fc024a01796c0780fc3d1fab66acc42b9e43bf50d9dc",
        "blob": "cfd0c6f62d1a1cbe5ba02e3b30ddbbdaaac55bb3",
        "bytes": 60057,
        "rawSha256": {
          "lf": "3d2085e0a3096cc83698fc024a01796c0780fc3d1fab66acc42b9e43bf50d9dc",
          "crlf": "497fa91ad2b770ffc2205e881c0dadd8650cc7bfb0e2b4a86117b320971377e9"
        }
      },
      "parents": {
        "monitor": {
          "mode": "100644",
          "sha256": "d7fb38ced9030cc5b50981adfc4e04a3d7e229d42ce4034e99215399efd40bea",
          "blob": "970067b4a2b448eb6368203a1ef4b738e5b129bb",
          "bytes": 59794,
          "inverses": [
            {
              "current": "    \"test:agent-economy-next-five:postgres\": \"node tools/next-five-native.js\",\n    \"test:agent-economy-next-layer\": \"node test/next-layer-source-compatibility.js && node test/next-layer-release-phase2-migration-catalog.js && node test/next-layer-native-guard.js && node test/next-layer-graph-helpers.js && node test/multihopcourier.js && node test/multihopcourier-api.js && node test/multihopcourier-estate.js && node test/multihopcourier-idempotency.js && node test/multihopcourier-boundary.js && node test/multihopcourier-recovery.js && node test/multihopcourier-expired-owner.js && node test/customerlayaway.js && node test/customerlayaway-api.js && node test/customerlayaway-integration.js && node test/customervaults-guards.js && node test/customervaults.js && node test/customervaults-estate.js && node test/decisionreplay-guards.js && node test/decisionreplay.js && node test/decisionreplay-integration.js && node test/economicdependencymap-guards.js && node test/economicdependencymap.js && node test/economicdependencymap-integration.js && node test/agent-economy-next-layer-estate.js && node test/depotacquisition-vaults.js && node test/worldgraph-validation.js\",\n    \"test:agent-economy-next-layer:postgres\": \"node tools/next-layer-native.js\",\n    \"test:deed-discovery\": \"node test/deedallocation.js && node test/deed-benefit-boundaries.js && node test/deedquesteligibility.js && node test/deeddiscovery.js && node test/deeddiscovery-api.js && node test/deedbuildings.js && node test/deed-discovery-migration-catalog.js\",\n    \"test:deed-discovery:browser\": \"node test/deed-discovery-ui.js && node test/deedbuildings-browser.js\",\n    \"test:deed-discovery:postgres\": \"node test/deed-benefits-postgres.js && node test/deeddiscovery-postgres.js && node test/deeds-supply-postgres.js\",\n    \"test:agent-economy-market-operations\": \"node test/market-operations-source-compatibility.js && node test/market-operations-graph-helpers.js && node test/market-operations-director-catalog.js && node test/market-operations-native-guard.js && node test/market-operations-release-phase2-migration-catalog.js && node test/crossdocking.js && node test/crossdocking-api.js && node test/crossdocking-estate.js && node test/crossdocking-actions.js && node test/crossdocking-races.js && node test/crossdocking-lifecycle.js && node test/crossdocking-boundary.js && node test/productionslots.js && node test/productionslots-api.js && node test/productionslots-estate.js && node test/productionslots-races.js && node test/productionslots-recovery.js && node test/productionslots-boundary.js && node test/merchantreturns.js && node test/merchantreturns-api.js && node test/depotacquisition-production-slots.js && node test/worldgraph-validation.js\",\n    \"test:agent-economy-market-operations:postgres\": \"node tools/market-operations-native.js\",\n    \"test:agent-economy-enterprise\": \"node test/enterprise-source-compatibility.js && node test/enterprise-current-source-compatibility.js && node test/enterprise-release-phase2-migration-catalog.js && node test/enterprise-native-guard.js && node test/businessrelocation-acquisition-negative.js && node test/businessrelocation-api.js && node test/businessrelocation-current-api.js && node test/businessrelocation-floor-negative.js && node test/businessrelocation-history-negative.js && node test/businessrelocation-license-negative.js && node test/businessrelocation.js && node test/equipmentrecovery-api.js && node test/equipmentrecovery-integration.js && node test/equipmentrecovery-wear.js && node test/equipmentrecovery.js && node test/manufacturinglicenses-acquisition.js && node test/manufacturinglicenses-api.js && node test/manufacturinglicenses-contracts.js && node test/manufacturinglicenses-estate.js && node test/manufacturinglicenses-invariants.js && node test/manufacturinglicenses-production.js && node test/manufacturinglicenses.js && node test/mobileshops-api.js && node test/mobileshops-integration.js && node test/mobileshops.js && node test/workshopfloor-acquisition-compatibility.js && node test/workshopfloor-adversarial.js && node test/workshopfloor-api.js && node test/workshopfloor-capacity.js && node test/workshopfloor-estate.js && node test/workshopfloor-expiry.js && node test/workshopfloor-recipes.js && node test/workshopfloor.js && node test/worldgraph-validation.js\",\n",
              "baseline": "    \"test:agent-economy-next-five:postgres\": \"node tools/next-five-native.js\",\n    \"test:agent-economy-next-layer\": \"node test/next-layer-source-compatibility.js && node test/next-layer-release-phase2-migration-catalog.js && node test/next-layer-native-guard.js && node test/next-layer-graph-helpers.js && node test/multihopcourier.js && node test/multihopcourier-api.js && node test/multihopcourier-estate.js && node test/multihopcourier-idempotency.js && node test/multihopcourier-boundary.js && node test/multihopcourier-recovery.js && node test/multihopcourier-expired-owner.js && node test/customerlayaway.js && node test/customerlayaway-api.js && node test/customerlayaway-integration.js && node test/customervaults-guards.js && node test/customervaults.js && node test/customervaults-estate.js && node test/decisionreplay-guards.js && node test/decisionreplay.js && node test/decisionreplay-integration.js && node test/economicdependencymap-guards.js && node test/economicdependencymap.js && node test/economicdependencymap-integration.js && node test/agent-economy-next-layer-estate.js && node test/depotacquisition-vaults.js && node test/worldgraph-validation.js\",\n    \"test:agent-economy-next-layer:postgres\": \"node tools/next-layer-native.js\",\n    \"test:deed-discovery\": \"node test/deedquesteligibility.js && node test/deeddiscovery.js && node test/deeddiscovery-api.js && node test/deedbuildings.js && node test/deed-discovery-migration-catalog.js\",\n    \"test:deed-discovery:browser\": \"node test/deed-discovery-ui.js && node test/deedbuildings-browser.js\",\n    \"test:deed-discovery:postgres\": \"node test/deeddiscovery-postgres.js && node test/deeds-supply-postgres.js\",\n    \"test:agent-economy-market-operations\": \"node test/market-operations-source-compatibility.js && node test/market-operations-graph-helpers.js && node test/market-operations-director-catalog.js && node test/market-operations-native-guard.js && node test/market-operations-release-phase2-migration-catalog.js && node test/crossdocking.js && node test/crossdocking-api.js && node test/crossdocking-estate.js && node test/crossdocking-actions.js && node test/crossdocking-races.js && node test/crossdocking-lifecycle.js && node test/crossdocking-boundary.js && node test/productionslots.js && node test/productionslots-api.js && node test/productionslots-estate.js && node test/productionslots-races.js && node test/productionslots-recovery.js && node test/productionslots-boundary.js && node test/merchantreturns.js && node test/merchantreturns-api.js && node test/depotacquisition-production-slots.js && node test/worldgraph-validation.js\",\n    \"test:agent-economy-market-operations:postgres\": \"node tools/market-operations-native.js\",\n    \"test:agent-economy-enterprise\": \"node test/enterprise-source-compatibility.js && node test/enterprise-current-source-compatibility.js && node test/enterprise-release-phase2-migration-catalog.js && node test/enterprise-native-guard.js && node test/businessrelocation-acquisition-negative.js && node test/businessrelocation-api.js && node test/businessrelocation-current-api.js && node test/businessrelocation-floor-negative.js && node test/businessrelocation-history-negative.js && node test/businessrelocation-license-negative.js && node test/businessrelocation.js && node test/equipmentrecovery-api.js && node test/equipmentrecovery-integration.js && node test/equipmentrecovery-wear.js && node test/equipmentrecovery.js && node test/manufacturinglicenses-acquisition.js && node test/manufacturinglicenses-api.js && node test/manufacturinglicenses-contracts.js && node test/manufacturinglicenses-estate.js && node test/manufacturinglicenses-invariants.js && node test/manufacturinglicenses-production.js && node test/manufacturinglicenses.js && node test/mobileshops-api.js && node test/mobileshops-integration.js && node test/mobileshops.js && node test/workshopfloor-acquisition-compatibility.js && node test/workshopfloor-adversarial.js && node test/workshopfloor-api.js && node test/workshopfloor-capacity.js && node test/workshopfloor-estate.js && node test/workshopfloor-expiry.js && node test/workshopfloor-recipes.js && node test/workshopfloor.js && node test/worldgraph-validation.js\",\n"
            },
            {
              "current": "    \"test:ux:browser\": \"node test/ux-progression-browser.js && node test/ux-navigation-browser.js && node test/ux-social-browser.js && node test/ux-experience-browser.js && node test/ux-workspace-browser.js && node test/ux-tactics-browser.js && node test/ux-investigation-browser.js && node test/ux-coordination-browser.js && node test/ux-expanded-browser.js && node test/ux-feel-browser.js && node test/ux-tools-browser.js && node test/ux-identity-browser.js && node test/ux-story-browser.js && node test/ux-community-browser.js && node test/ux-personality-browser.js\",\n    \"test:ux:postgres\": \"node test/ux-postgres.js && node test/ux-postgres-rls.js\",\n    \"test:ux:source\": \"node test/sale-source-compatibility.js && node test/ux-source-compatibility.js\",\n    \"test:economy-ux-source\": \"node test/economy-deed-merge-source-compatibility.js && node test/deed-allocation-source-compatibility.js && node test/deed-benefit-native-catalog.js && node test/economy-ux-merge-source-compatibility.js\"\n  },\n  \"dependencies\": {\n    \"@fastify/jwt\": \"^10.2.0\",\n",
              "baseline": "    \"test:ux:browser\": \"node test/ux-progression-browser.js && node test/ux-navigation-browser.js && node test/ux-social-browser.js && node test/ux-experience-browser.js && node test/ux-workspace-browser.js && node test/ux-tactics-browser.js && node test/ux-investigation-browser.js && node test/ux-coordination-browser.js && node test/ux-expanded-browser.js && node test/ux-feel-browser.js && node test/ux-tools-browser.js && node test/ux-identity-browser.js && node test/ux-story-browser.js && node test/ux-community-browser.js && node test/ux-personality-browser.js\",\n    \"test:ux:postgres\": \"node test/ux-postgres.js && node test/ux-postgres-rls.js\",\n    \"test:ux:source\": \"node test/sale-source-compatibility.js && node test/ux-source-compatibility.js\",\n    \"test:economy-ux-source\": \"node test/economy-ux-merge-source-compatibility.js\"\n  },\n  \"dependencies\": {\n    \"@fastify/jwt\": \"^10.2.0\",\n"
            }
          ]
        },
        "deed": {
          "mode": "100644",
          "sha256": "44a450b15010487b9c2916c9d0a29a583dfe95f9c9b12033afbb25620560ab56",
          "blob": "02a624dc1659581ee688c22e5442712552ca9170",
          "bytes": 59904,
          "inverses": [
            {
              "current": "    \"test:coordination:postgres\": \"node test/coordination.js --postgres && node test/coordination-knowledge-runtime.js --postgres && node test/coordination-knowledge-postgres.js\",\n    \"start\": \"node src/server.js\",\n    \"worker\": \"node src/worker.js\",\n    \"test:economy-security\": \"node test/economy-monitor.js && node test/economy-composition.js\",\n    \"pretest\": \"npm run test:economy-ux-source && npm run test:agent-economy-commerce && node test/deed-market-source-compatibility.js && npm run test:deed-discovery && node test/deed-quest-source-compatibility.js && npm run test:agent-economy-enterprise && npm run test:agent-economy-market-operations && npm run test:agent-economy-next-layer && npm run test:agent-economy-next-five && npm run test:equipment-economy && node test/rc1-first-batch-source-compatibility.js && node test/companyproduction.js && node test/companyspecialization.js && node test/itemdurability.js && node test/itemdurability-quality.js && node test/companydemand.js && node test/companyforecast.js && node test/companyproduction-integration.js && node test/company-economy-contracts.js && node test/player-intel-source-compatibility.js && node test/commercialpremises.js && node test/commercialpremises-integration.js && node test/rc1-commercial-premises-source-compatibility.js && node test/companybankportfolios.js && node test/companybankportfolio-integration.js && node test/rc1-company-bank-source-compatibility.js && node test/companylogisticshubs.js && node test/companylogisticshubs-integration.js && node test/rc1-company-logistics-hub-source-compatibility.js && node test/buyercooperatives.js && node test/buyercooperative-integration.js && node test/rc1-buyer-cooperative-source-compatibility.js && node test/companyopportunities.js && node test/companyopportunity-integration.js && node test/rc1-company-opportunity-source-compatibility.js && node test/commercialreputation.js && node test/commercialreputation-integration.js && node test/rc1-commercial-reputation-source-compatibility.js && node test/businessseasons.js && node test/businessseason-integration.js && node test/rc1-business-season-source-compatibility.js && node test/rc1-game-employment-source-compatibility.js && node test/rc1-company-workflow-source-compatibility.js && node test/companyopportunities-api.js && node test/commercialreputation-api.js && node test/businessseasons-api.js && node test/companyworkflows.js && node test/companyworkflow-integration.js && node test/gameemployment.js && node test/gameemployment-integration.js && node test/companyoperatorrunner.js && node test/rc1-company-operator-source-compatibility.js && node test/companyoperators.js && node test/companyoperators-api.js && node test/storefrontfulfillment.js && node test/storefront-fulfillment-api.js && node test/courierjobs.js && node test/supplycontracts.js && node test/supplycontracts-api.js && node test/earningreceipts.js && node test/resource-deliver.js && node test/identity-checkout.js && node test/identity-checkout-client.js && node test/identity-checkout-api.js && node test/current-copy.js && node test/operation-read-paths.js && node test/world-projection-mysteries.js && node test/world-projection-mysteries-api.js && node test/world-projection-read.js && node test/world-projection.js && node test/world-projection-api.js && node test/projection-events.js && node test/projection-events-ws.js && node test/world-projection-client.js && node test/coordination-operation-definitions.js && node test/coordination-mode-boundary.js && node test/coordination-capital.js && node test/coordination-materials.js && node test/coordination-knowledge-proof.js && node test/world-kernel-transaction.js && node test/family-operations.js && node test/family-operations-api.js && node test/world-knowledge-crafting.js && node test/world-kernel-query.js && node test/world-kernel-input.js && node test/world-kernel.js && node test/world-kernel-api.js && node test/coordination-graph.js && node test/coordination.js && node test/coordination-api.js && node test/coordination-http-receipts.js && node test/coordination-knowledge.js && node test/coordination-knowledge-runtime.js && node test/coordination-knowledge-api.js && node test/finalizedobservation.js && node test/stockballotv2.js && node test/rwanominations.js && node test/rwaroutes.js && node test/rwahealth.js && node test/rwahealth.integration.js && node test/rwahealthclearance.js && node test/rwahealthclearancecontext.js && node test/rwahealthoverlay.readiness.js && node test/rwahealthoverlay.schema.js && node test/rwahealthoverlay.vector.js && node test/rwaregistrylifecycle.js && node test/rwaregistrylifecycle.sync.js && node test/agent-referral-cash.js && node test/phase2-discovery.js && node test/phase2-compiler.js && node test/phase2-review-regressions.js && node test/phase2-scale.js && node test/content-graph.js && node test/content-runtime.js && node test/content-social.js && node test/content-seasonal.js && node test/content-seasonal-case.js && node test/content-crafting.js && node test/content-crafting-jobs.js && node test/content-crafting-tools.js && node test/content-exchange.js && node test/content-api.js && node test/v4oraclekeeper.js && node test/genesiscca.js && node test/genesislaunch.js && node test/genesisrelease.js && node test/worldgraph.js && node test/worldgraph-validation.js && node test/items.js && node test/crafting.js && node test/mysteries.js && node test/operations.js && node test/belladonna.js && node test/worldgraph-api.js && node test/city-rpg.js && node tools/pgcheck-belladonna.js --pg-mem && node test/phase2-definition-schema.js && node test/phase2-definitions.js && node test/phase2-activation.js && node test/phase2-definition-invariants.js && node test/phase2-lot-boundary.js && node test/keepertransactions.js && node test/liquiditykeeper.js && node test/genesiskeeper.js && node test/liquidityaccounting.js --memory && node test/liquidityaccounting-review.js && node test/liquiditypolicy.js --memory && node test/bond-unlimited.js --memory && node test/bondquoteexpiry.js && node test/liquidityrpc.js && node tools/liquidity-manifest-example.js --self-test && node test/liquiditypolicy-review.js && node test/liquidityqueue.js --memory && node test/liquidityqueue-review.js && node test/character-mint-policy.js && node test/phase2-lots.js && node test/phase2-lots-property.js && node test/audit/mint-dev-allocation.js --memory && node test/audit/deed-reimport-order.js --memory && node test/progression-admission.js && node test/world-prerequisites.js && node test/recipe-policy.js && node test/furnace-ledger.js && node test/core-progression-api.js && node test/player-commands.js && node test/player-command-journey.js && node test/player-command-api.js && node test/player-command-client.js && node test/director-definitions.js && node test/director-config.js && node test/director-runtime.js && node test/director-recovery.js && node test/director-dock-world.js && node test/director-commands.js && node test/director-api.js && node test/director-journey.js && node test/director-security.js && node test/director-simulation.js && node test/director-network.js && node test/campaign-network-journey.js && node test/director-network-recovery.js && node test/player-opportunities.js && node test/world-consequences.js && node test/rc1-city-gameplay-source-compatibility.js && npm run test:gateway && npm run test:legal-security && npm run test:release-source-transfer\",\n    \"phase2:definitions:check\": \"node test/phase2-definition-schema.js && node test/phase2-definitions.js && node test/phase2-activation.js && node test/phase2-definition-invariants.js\",\n    \"phase2:lots:check\": \"node test/phase2-lot-boundary.js && node test/phase2-lots.js && node test/phase2-lots-property.js\",\n",
              "baseline": "    \"test:coordination:postgres\": \"node test/coordination.js --postgres && node test/coordination-knowledge-runtime.js --postgres && node test/coordination-knowledge-postgres.js\",\n    \"start\": \"node src/server.js\",\n    \"worker\": \"node src/worker.js\",\n    \"pretest\": \"npm run test:economy-ux-source && npm run test:agent-economy-commerce && node test/deed-market-source-compatibility.js && npm run test:deed-discovery && node test/deed-quest-source-compatibility.js && npm run test:agent-economy-enterprise && npm run test:agent-economy-market-operations && npm run test:agent-economy-next-layer && npm run test:agent-economy-next-five && npm run test:equipment-economy && node test/rc1-first-batch-source-compatibility.js && node test/companyproduction.js && node test/companyspecialization.js && node test/itemdurability.js && node test/itemdurability-quality.js && node test/companydemand.js && node test/companyforecast.js && node test/companyproduction-integration.js && node test/company-economy-contracts.js && node test/player-intel-source-compatibility.js && node test/commercialpremises.js && node test/commercialpremises-integration.js && node test/rc1-commercial-premises-source-compatibility.js && node test/companybankportfolios.js && node test/companybankportfolio-integration.js && node test/rc1-company-bank-source-compatibility.js && node test/companylogisticshubs.js && node test/companylogisticshubs-integration.js && node test/rc1-company-logistics-hub-source-compatibility.js && node test/buyercooperatives.js && node test/buyercooperative-integration.js && node test/rc1-buyer-cooperative-source-compatibility.js && node test/companyopportunities.js && node test/companyopportunity-integration.js && node test/rc1-company-opportunity-source-compatibility.js && node test/commercialreputation.js && node test/commercialreputation-integration.js && node test/rc1-commercial-reputation-source-compatibility.js && node test/businessseasons.js && node test/businessseason-integration.js && node test/rc1-business-season-source-compatibility.js && node test/rc1-game-employment-source-compatibility.js && node test/rc1-company-workflow-source-compatibility.js && node test/companyopportunities-api.js && node test/commercialreputation-api.js && node test/businessseasons-api.js && node test/companyworkflows.js && node test/companyworkflow-integration.js && node test/gameemployment.js && node test/gameemployment-integration.js && node test/companyoperatorrunner.js && node test/rc1-company-operator-source-compatibility.js && node test/companyoperators.js && node test/companyoperators-api.js && node test/storefrontfulfillment.js && node test/storefront-fulfillment-api.js && node test/courierjobs.js && node test/supplycontracts.js && node test/supplycontracts-api.js && node test/earningreceipts.js && node test/resource-deliver.js && node test/identity-checkout.js && node test/identity-checkout-client.js && node test/identity-checkout-api.js && node test/current-copy.js && node test/operation-read-paths.js && node test/world-projection-mysteries.js && node test/world-projection-mysteries-api.js && node test/world-projection-read.js && node test/world-projection.js && node test/world-projection-api.js && node test/projection-events.js && node test/projection-events-ws.js && node test/world-projection-client.js && node test/coordination-operation-definitions.js && node test/coordination-mode-boundary.js && node test/coordination-capital.js && node test/coordination-materials.js && node test/coordination-knowledge-proof.js && node test/world-kernel-transaction.js && node test/family-operations.js && node test/family-operations-api.js && node test/world-knowledge-crafting.js && node test/world-kernel-query.js && node test/world-kernel-input.js && node test/world-kernel.js && node test/world-kernel-api.js && node test/coordination-graph.js && node test/coordination.js && node test/coordination-api.js && node test/coordination-http-receipts.js && node test/coordination-knowledge.js && node test/coordination-knowledge-runtime.js && node test/coordination-knowledge-api.js && node test/finalizedobservation.js && node test/stockballotv2.js && node test/rwanominations.js && node test/rwaroutes.js && node test/rwahealth.js && node test/rwahealth.integration.js && node test/rwahealthclearance.js && node test/rwahealthclearancecontext.js && node test/rwahealthoverlay.readiness.js && node test/rwahealthoverlay.schema.js && node test/rwahealthoverlay.vector.js && node test/rwaregistrylifecycle.js && node test/rwaregistrylifecycle.sync.js && node test/agent-referral-cash.js && node test/phase2-discovery.js && node test/phase2-compiler.js && node test/phase2-review-regressions.js && node test/phase2-scale.js && node test/content-graph.js && node test/content-runtime.js && node test/content-social.js && node test/content-seasonal.js && node test/content-seasonal-case.js && node test/content-crafting.js && node test/content-crafting-jobs.js && node test/content-crafting-tools.js && node test/content-exchange.js && node test/content-api.js && node test/v4oraclekeeper.js && node test/genesiscca.js && node test/genesislaunch.js && node test/genesisrelease.js && node test/worldgraph.js && node test/worldgraph-validation.js && node test/items.js && node test/crafting.js && node test/mysteries.js && node test/operations.js && node test/belladonna.js && node test/worldgraph-api.js && node test/city-rpg.js && node tools/pgcheck-belladonna.js --pg-mem && node test/phase2-definition-schema.js && node test/phase2-definitions.js && node test/phase2-activation.js && node test/phase2-definition-invariants.js && node test/phase2-lot-boundary.js && node test/keepertransactions.js && node test/liquiditykeeper.js && node test/genesiskeeper.js && node test/liquidityaccounting.js --memory && node test/liquidityaccounting-review.js && node test/liquiditypolicy.js --memory && node test/bond-unlimited.js --memory && node test/bondquoteexpiry.js && node test/liquidityrpc.js && node tools/liquidity-manifest-example.js --self-test && node test/liquiditypolicy-review.js && node test/liquidityqueue.js --memory && node test/liquidityqueue-review.js && node test/character-mint-policy.js && node test/phase2-lots.js && node test/phase2-lots-property.js && node test/audit/mint-dev-allocation.js --memory && node test/audit/deed-reimport-order.js --memory && node test/progression-admission.js && node test/world-prerequisites.js && node test/recipe-policy.js && node test/furnace-ledger.js && node test/core-progression-api.js && node test/player-commands.js && node test/player-command-journey.js && node test/player-command-api.js && node test/player-command-client.js && node test/director-definitions.js && node test/director-config.js && node test/director-runtime.js && node test/director-recovery.js && node test/director-dock-world.js && node test/director-commands.js && node test/director-api.js && node test/director-journey.js && node test/director-security.js && node test/director-simulation.js && node test/director-network.js && node test/campaign-network-journey.js && node test/director-network-recovery.js && node test/player-opportunities.js && node test/world-consequences.js && node test/rc1-city-gameplay-source-compatibility.js && npm run test:gateway && npm run test:legal-security && npm run test:release-source-transfer\",\n    \"phase2:definitions:check\": \"node test/phase2-definition-schema.js && node test/phase2-definitions.js && node test/phase2-activation.js && node test/phase2-definition-invariants.js\",\n    \"phase2:lots:check\": \"node test/phase2-lot-boundary.js && node test/phase2-lots.js && node test/phase2-lots-property.js\",\n"
            },
            {
              "current": "    \"test:ux:browser\": \"node test/ux-progression-browser.js && node test/ux-navigation-browser.js && node test/ux-social-browser.js && node test/ux-experience-browser.js && node test/ux-workspace-browser.js && node test/ux-tactics-browser.js && node test/ux-investigation-browser.js && node test/ux-coordination-browser.js && node test/ux-expanded-browser.js && node test/ux-feel-browser.js && node test/ux-tools-browser.js && node test/ux-identity-browser.js && node test/ux-story-browser.js && node test/ux-community-browser.js && node test/ux-personality-browser.js\",\n    \"test:ux:postgres\": \"node test/ux-postgres.js && node test/ux-postgres-rls.js\",\n    \"test:ux:source\": \"node test/sale-source-compatibility.js && node test/ux-source-compatibility.js\",\n    \"test:economy-ux-source\": \"node test/economy-deed-merge-source-compatibility.js && node test/deed-allocation-source-compatibility.js && node test/deed-benefit-native-catalog.js && node test/economy-ux-merge-source-compatibility.js\"\n  },\n  \"dependencies\": {\n    \"@fastify/jwt\": \"^10.2.0\",\n",
              "baseline": "    \"test:ux:browser\": \"node test/ux-progression-browser.js && node test/ux-navigation-browser.js && node test/ux-social-browser.js && node test/ux-experience-browser.js && node test/ux-workspace-browser.js && node test/ux-tactics-browser.js && node test/ux-investigation-browser.js && node test/ux-coordination-browser.js && node test/ux-expanded-browser.js && node test/ux-feel-browser.js && node test/ux-tools-browser.js && node test/ux-identity-browser.js && node test/ux-story-browser.js && node test/ux-community-browser.js && node test/ux-personality-browser.js\",\n    \"test:ux:postgres\": \"node test/ux-postgres.js && node test/ux-postgres-rls.js\",\n    \"test:ux:source\": \"node test/sale-source-compatibility.js && node test/ux-source-compatibility.js\",\n    \"test:economy-ux-source\": \"node test/deed-allocation-source-compatibility.js && node test/deed-benefit-native-catalog.js && node test/economy-ux-merge-source-compatibility.js\"\n  },\n  \"dependencies\": {\n    \"@fastify/jwt\": \"^10.2.0\",\n"
            }
          ]
        }
      }
    },
    {
      "file": "src/game.js",
      "current": {
        "mode": "100644",
        "sha256": "9bde6b2f4213cc034a0dbb02fd05fb49cda106f006aab629214442fee0439e5d",
        "blob": "b879627d63b592354183384a161e8ddcb670830e",
        "bytes": 230977,
        "rawSha256": {
          "lf": "9bde6b2f4213cc034a0dbb02fd05fb49cda106f006aab629214442fee0439e5d",
          "crlf": "25d3bd8d1d0baeb5bab9b5a30e8d77f5f4e9e63b1b242c904c23a7a412037f95"
        }
      },
      "parents": {
        "monitor": {
          "mode": "100644",
          "sha256": "b8908ca04307476f40c712efa25909ac0b84f2e7ccfdd737de9ae802581d63a0",
          "blob": "47fc6feb58ad0d01636f855eebd579d262a45b5a",
          "bytes": 230395,
          "inverses": [
            {
              "current": "import { withItemTransaction, assertItemTransactionHealthy } from './items.js';\nimport { prelockEquipmentRentalDeathActors } from './equipmentrentals.js';\nimport { normalizeClientIp, normalizeClientIpAuthority } from './client-ip.js';\nimport { DEED_BENEFITS_MIN_LEVEL, deedBenefitEligibilityAt, recordDeedBenefitEligibility } from './deedbenefits.js';\n\nconst uid = () => crypto.randomUUID();\nimport { startFirstBlood } from './firstblood.js';   // THE AHA MOMENT — assign a fresh player their first rival\n",
              "baseline": "import { withItemTransaction, assertItemTransactionHealthy } from './items.js';\nimport { prelockEquipmentRentalDeathActors } from './equipmentrentals.js';\nimport { normalizeClientIp, normalizeClientIpAuthority } from './client-ip.js';\n\nconst uid = () => crypto.randomUUID();\nimport { startFirstBlood } from './firstblood.js';   // THE AHA MOMENT — assign a fresh player their first rival\n"
            },
            {
              "current": "  // / extraction-pending deed is INERT (the car/boat rule) so it perks nobody. `deedPerk` is OR'd\n  // with family turf by SET-UNION at every perk site — a district in both lists adds NOTHING —\n  // and `deedSeat` (you control your OWN corner) is the +1 operation seat, capped at SLOTS_MAX.\n  let deedPerk = [], deedSeat = false, deedActiveFrom = null;\n  if ((DEEDS.PERK_TURF || DEEDS.PERK_OP_SLOTS) && levelOf(Number(ch.respect)) >= DEED_BENEFITS_MIN_LEVEL) {\n    const now = Date.now();\n    const drows = (await client.query(\n      'SELECT district, account_id, controller_account, control_until, onchain_token_id, corner_at FROM street_deeds WHERE account_id=$1 OR controller_account=$1',\n      [ch.account_id])).rows.filter((d) => !d.onchain_token_id && deedController(d, now) === ch.account_id);\n    deedPerk = DEEDS.PERK_TURF ? [...new Set(drows.map((d) => d.district))] : [];\n    deedSeat = drows.some((d) => d.account_id === ch.account_id);\n    if (drows.length) {\n      const eligibleAt = await deedBenefitEligibilityAt(client, ch, now);\n      const transitions = drows.map(d => new Date(d.corner_at).getTime());\n      deedActiveFrom = new Date(Math.max(+eligibleAt, ...transitions.map(at => Number.isFinite(at) ? at : now)));\n    }\n  }\n  const businesses = await businessesOf(client, ch.id); // late-game personal fronts (usually empty)\n  const speakeasy = await speakeasyOwnedOf(client, ch.id); // the district's club, if this man runs one\n",
              "baseline": "  // / extraction-pending deed is INERT (the car/boat rule) so it perks nobody. `deedPerk` is OR'd\n  // with family turf by SET-UNION at every perk site — a district in both lists adds NOTHING —\n  // and `deedSeat` (you control your OWN corner) is the +1 operation seat, capped at SLOTS_MAX.\n  let deedPerk = [], deedSeat = false;\n  if (DEEDS.PERK_TURF || DEEDS.PERK_OP_SLOTS) {\n    const now = Date.now();\n    const drows = (await client.query(\n      'SELECT district, account_id, controller_account, control_until, onchain_token_id FROM street_deeds WHERE account_id=$1 OR controller_account=$1',\n      [ch.account_id])).rows.filter((d) => !d.onchain_token_id && deedController(d, now) === ch.account_id);\n    deedPerk = DEEDS.PERK_TURF ? [...new Set(drows.map((d) => d.district))] : [];\n    deedSeat = drows.some((d) => d.account_id === ch.account_id);\n  }\n  const businesses = await businessesOf(client, ch.id); // late-game personal fronts (usually empty)\n  const speakeasy = await speakeasyOwnedOf(client, ch.id); // the district's club, if this man runs one\n"
            },
            {
              "current": "    gear: idList(gear.rows, 'gear_id'), guns: idList(guns.rows, 'gun_id'),\n    gearOnchain: idList(gearnft.rows, 'gear_id'), // extracted gear: boosts nothing, but blocks a re-mint and dedupes kill-loot (the row still holds the PK)\n    gangId, gangRole: gm.rows[0]?.role || null, gangJoinedAt: gm.rows[0]?.joined_at || null, gang, held,\n    deedPerk, deedSeat, deedActiveFrom, // controlled corners and their eligible passive interval\n    crewId,   // THE CREW — the non-aggression gate reads this off owned/victimOwned (combat.js)\n    bespoke,  // THE SHIPMENT — commissioned pieces (account-level status, survives death)\n    makings: Object.fromEntries(mk.rows.map((r) => [r.drug_id, Number(r.qty)])),\n",
              "baseline": "    gear: idList(gear.rows, 'gear_id'), guns: idList(guns.rows, 'gun_id'),\n    gearOnchain: idList(gearnft.rows, 'gear_id'), // extracted gear: boosts nothing, but blocks a re-mint and dedupes kill-loot (the row still holds the PK)\n    gangId, gangRole: gm.rows[0]?.role || null, gangJoinedAt: gm.rows[0]?.joined_at || null, gang, held,\n    deedPerk, deedSeat, // STREET DEEDS 2C — controlled-corner districts (turf perk) + the own-corner op seat\n    crewId,   // THE CREW — the non-aggression gate reads this off owned/victimOwned (combat.js)\n    bespoke,  // THE SHIPMENT — commissioned pieces (account-level status, survives death)\n    makings: Object.fromEntries(mk.rows.map((r) => [r.drug_id, Number(r.qty)])),\n"
            },
            {
              "current": "export function accrueInMemory(ch, acct, owned, { preview = false } = {}) {\n  accrue(ch, acct, { preview, rackets: owned.rackets, assets: owned.assets, held: owned.held, stash: owned.stash,\n    deedHeld: owned.deedPerk, // STREET DEEDS 2C — controlled corners count at accrual's two perk reads (cathedral nerve, neon income)\n    deedActiveFrom: owned.deedActiveFrom,\n    racketLevels: owned.racketLevels, // Tier-4 — per-racket upgrade levels multiply the drip\n    disciplines: owned.disciplines, // THE REGIMEN — stamina/composure raise the regen CAPS (pool, not rate)\n    foundationTier: owned.gang?.foundation || 0 }); // THE FOUNDATION step two: the family charity speeds the exposure bleed\n",
              "baseline": "export function accrueInMemory(ch, acct, owned, { preview = false } = {}) {\n  accrue(ch, acct, { preview, rackets: owned.rackets, assets: owned.assets, held: owned.held, stash: owned.stash,\n    deedHeld: owned.deedPerk, // STREET DEEDS 2C — controlled corners count at accrual's two perk reads (cathedral nerve, neon income)\n    racketLevels: owned.racketLevels, // Tier-4 — per-racket upgrade levels multiply the drip\n    disciplines: owned.disciplines, // THE REGIMEN — stamina/composure raise the regen CAPS (pool, not rate)\n    foundationTier: owned.gang?.foundation || 0 }); // THE FOUNDATION step two: the family charity speeds the exposure bleed\n"
            },
            {
              "current": "}\n\nasync function persistCharacter(client, ch) {\n  await recordDeedBenefitEligibility(client, ch);\n  await client.query(`UPDATE characters SET ${CHARACTER_SET} WHERE id=$1`,\n    [ch.id, ...valuesOf(CHARACTER_PERSIST_COLUMNS, ch)]);\n}\n",
              "baseline": "}\n\nasync function persistCharacter(client, ch) {\n  await client.query(`UPDATE characters SET ${CHARACTER_SET} WHERE id=$1`,\n    [ch.id, ...valuesOf(CHARACTER_PERSIST_COLUMNS, ch)]);\n}\n"
            }
          ]
        },
        "deed": {
          "mode": "100644",
          "sha256": "4866b648e511a51a5b70a6eda0cafac0113970d7598ad9466f56a3de76eb12be",
          "blob": "c5624fb115ac26f286a160f9f3d0b2190c7ec5c6",
          "bytes": 230631,
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
        }
      }
    },
    {
      "file": "test/economy-hardening-source-compatibility.js",
      "current": {
        "mode": "100644",
        "sha256": "a72cc031967aee6f578946c2e40087248d20a5015440d39cccbe5a6dc7b60cdc",
        "blob": "8e95e9e8a6a209693c9d06a24fc10a2f3ff3c943",
        "bytes": 88858,
        "rawSha256": {
          "lf": "a72cc031967aee6f578946c2e40087248d20a5015440d39cccbe5a6dc7b60cdc",
          "crlf": "8503c0e243352acd96414cef276fdbf7bd0f7467cb9c6dc8268d92c98834991d"
        }
      },
      "parents": {
        "monitor": {
          "mode": "100644",
          "sha256": "ce71b23555917ab319a7298df55210aceb1ba675a265eb1cf9dcae37f068af2b",
          "blob": "969b59b5f116864e90b0073efb110e8059dce6ee",
          "bytes": 88487,
          "inverses": [
            {
              "current": "import { deedAllocationHistoricalInput } from '../tools/deed-allocation-source-transfer.js';\nimport { economyDeedMergeHistoricalInput } from '../tools/economy-deed-merge-source-compatibility.js';\nimport assert from 'node:assert/strict';\nimport './economy-monitor-source-compatibility.js';\nimport './age-eligibility-source-compatibility.js';\n",
              "baseline": "import assert from 'node:assert/strict';\nimport './economy-monitor-source-compatibility.js';\nimport './age-eligibility-source-compatibility.js';\n"
            },
            {
              "current": "];\nconst socialReceiptFiles = ['src/db.js', 'src/growth.js', 'test/growth.js', 'test/sweeps.js'];\nconst lf = text => text.replaceAll('\\r\\n', '\\n');\nconst deedAllocationPhysicalSource = file => deedAllocationHistoricalInput(file,\n  economyDeedMergeHistoricalInput(file, fs.readFileSync(file, 'utf8'), 'monitor'));\nconst monitorPhysicalSource = file => {\n  let input = deedAllocationPhysicalSource(file);\n  input = uxAfterwordHistoricalInput(file, input);\n  input = economyMonitorWorkerHistoricalInput(file, input);\n  input = economyMonitorReaderHistoricalInput(file, input);\n",
              "baseline": "];\nconst socialReceiptFiles = ['src/db.js', 'src/growth.js', 'test/growth.js', 'test/sweeps.js'];\nconst lf = text => text.replaceAll('\\r\\n', '\\n');\nconst monitorPhysicalSource = file => {\n  let input = fs.readFileSync(file, 'utf8');\n  input = uxAfterwordHistoricalInput(file, input);\n  input = economyMonitorWorkerHistoricalInput(file, input);\n  input = economyMonitorReaderHistoricalInput(file, input);\n"
            },
            {
              "current": "  return economyMonitorHistoricalInput(file, input);\n};\nconst physicalCandidateSource = file => lf(economyUxMergeCandidateHistoricalInput(\n  file, uxAfterwordHistoricalInput(file, deedAllocationPhysicalSource(file))));\nconst git = (...args) => lf(execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,\n  stdio: ['ignore', 'pipe', 'pipe'] }));\nconst hash = text => crypto.createHash('sha256').update(text).digest('hex');\n",
              "baseline": "  return economyMonitorHistoricalInput(file, input);\n};\nconst physicalCandidateSource = file => lf(economyUxMergeCandidateHistoricalInput(\n  file, uxAfterwordHistoricalInput(file, fs.readFileSync(file, 'utf8'))));\nconst git = (...args) => lf(execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,\n  stdio: ['ignore', 'pipe', 'pipe'] }));\nconst hash = text => crypto.createHash('sha256').update(text).digest('hex');\n"
            }
          ]
        },
        "deed": {
          "mode": "100644",
          "sha256": "136ec510491f7fc6fce130209b3728add5fc3cb1e2ab1d9e18c9eefdf45ad7fc",
          "blob": "33e8a00549129dde4fd23b40a9d020679bfd2428",
          "bytes": 88042,
          "inverses": [
            {
              "current": "import { deedAllocationHistoricalInput } from '../tools/deed-allocation-source-transfer.js';\nimport { economyDeedMergeHistoricalInput } from '../tools/economy-deed-merge-source-compatibility.js';\nimport assert from 'node:assert/strict';\nimport './economy-monitor-source-compatibility.js';\nimport './age-eligibility-source-compatibility.js';\nimport crypto from 'node:crypto';\nimport fs from 'node:fs';\nimport { execFileSync } from 'node:child_process';\nimport { economyMonitorHistoricalInput } from '../tools/economy-monitor-source-transfer.js';\nimport { uxAfterwordHistoricalInput } from '../tools/ux-afterword-source-compatibility.js';\nimport {\n  ECONOMY_HARDENING_SOURCE_REVISION, ECONOMY_HARDENING_SOURCE_TREE,\n",
              "baseline": "import { deedAllocationHistoricalInput } from '../tools/deed-allocation-source-transfer.js';\nimport assert from 'node:assert/strict';\nimport crypto from 'node:crypto';\nimport fs from 'node:fs';\nimport { execFileSync } from 'node:child_process';\nimport { uxAfterwordHistoricalInput } from '../tools/ux-afterword-source-compatibility.js';\nimport {\n  ECONOMY_HARDENING_SOURCE_REVISION, ECONOMY_HARDENING_SOURCE_TREE,\n"
            },
            {
              "current": "} from '../tools/economy-release-tail-source-transfer.js';\nimport { ECONOMY_UX_MERGE_SOURCE,\n  economyUxMergeCandidateHistoricalInput,\n  economyUxMergeMainHistoricalInput, economyMonitorWorkerHistoricalInput,\n  economyMonitorReaderHistoricalInput, economyMonitorReleaseHistoricalInput } from '../tools/economy-ux-merge-source-compatibility.js';\nimport {\n  ECONOMY_BANK_INTEREST_HARDENING_REVISION, ECONOMY_BANK_INTEREST_HARDENING_TREE,\n  ECONOMY_BANK_INTEREST_HARDENING_PREDECESSOR, ECONOMY_BANK_INTEREST_HARDENING_PREDECESSOR_TREE,\n",
              "baseline": "} from '../tools/economy-release-tail-source-transfer.js';\nimport { ECONOMY_UX_MERGE_SOURCE,\n  economyUxMergeCandidateHistoricalInput,\n  economyUxMergeMainHistoricalInput } from '../tools/economy-ux-merge-source-compatibility.js';\nimport {\n  ECONOMY_BANK_INTEREST_HARDENING_REVISION, ECONOMY_BANK_INTEREST_HARDENING_TREE,\n  ECONOMY_BANK_INTEREST_HARDENING_PREDECESSOR, ECONOMY_BANK_INTEREST_HARDENING_PREDECESSOR_TREE,\n"
            },
            {
              "current": "];\nconst socialReceiptFiles = ['src/db.js', 'src/growth.js', 'test/growth.js', 'test/sweeps.js'];\nconst lf = text => text.replaceAll('\\r\\n', '\\n');\nconst deedAllocationPhysicalSource = file => deedAllocationHistoricalInput(file,\n  economyDeedMergeHistoricalInput(file, fs.readFileSync(file, 'utf8'), 'monitor'));\nconst monitorPhysicalSource = file => {\n  let input = deedAllocationPhysicalSource(file);\n  input = uxAfterwordHistoricalInput(file, input);\n  input = economyMonitorWorkerHistoricalInput(file, input);\n  input = economyMonitorReaderHistoricalInput(file, input);\n  input = economyMonitorReleaseHistoricalInput(file, input);\n  return economyMonitorHistoricalInput(file, input);\n};\nconst physicalCandidateSource = file => lf(economyUxMergeCandidateHistoricalInput(\n  file, uxAfterwordHistoricalInput(file, deedAllocationPhysicalSource(file))));\nconst git = (...args) => lf(execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,\n",
              "baseline": "];\nconst socialReceiptFiles = ['src/db.js', 'src/growth.js', 'test/growth.js', 'test/sweeps.js'];\nconst lf = text => text.replaceAll('\\r\\n', '\\n');\nconst deedAllocationPhysicalSource = file => deedAllocationHistoricalInput(file, fs.readFileSync(file, 'utf8'));\nconst physicalCandidateSource = file => lf(economyUxMergeCandidateHistoricalInput(\n  file, uxAfterwordHistoricalInput(file, deedAllocationPhysicalSource(file))));\nconst git = (...args) => lf(execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,\n"
            },
            {
              "current": "  const pin = ECONOMY_BANK_INTEREST_HARDENING_DOMAINS[file];\n  const current = git('show', ECONOMY_BANK_INTEREST_HARDENING_REVISION + ':' + file);\n  const baseline = git('show', ECONOMY_BANK_INTEREST_HARDENING_PREDECESSOR + ':' + file);\n  const physical = lf(monitorPhysicalSource(file));\n  assert.equal(physical, current, 'Physical bank-interest hardening source must remain exact: ' + file);\n  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));\n  assert.deepEqual(Object.keys(pin).sort(), [\n",
              "baseline": "  const pin = ECONOMY_BANK_INTEREST_HARDENING_DOMAINS[file];\n  const current = git('show', ECONOMY_BANK_INTEREST_HARDENING_REVISION + ':' + file);\n  const baseline = git('show', ECONOMY_BANK_INTEREST_HARDENING_PREDECESSOR + ':' + file);\n  const physical = lf(deedAllocationPhysicalSource(file));\n  assert.equal(physical, current, 'Physical bank-interest hardening source must remain exact: ' + file);\n  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));\n  assert.deepEqual(Object.keys(pin).sort(), [\n"
            },
            {
              "current": "  const predecessorAbsent = socialProofCutoverAdditions.has(file);\n  const baseline = predecessorAbsent ? null\n    : git('show', ECONOMY_SOCIAL_PROOF_CUTOVER_PREDECESSOR + ':' + file);\n  const physical = lf(monitorPhysicalSource(file));\n  assert.equal(physical, current, 'Physical social-proof cutover source must remain exact: ' + file);\n  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));\n  assert.deepEqual(Object.keys(pin).sort(), [\n",
              "baseline": "  const predecessorAbsent = socialProofCutoverAdditions.has(file);\n  const baseline = predecessorAbsent ? null\n    : git('show', ECONOMY_SOCIAL_PROOF_CUTOVER_PREDECESSOR + ':' + file);\n  const physical = lf(deedAllocationPhysicalSource(file));\n  assert.equal(physical, current, 'Physical social-proof cutover source must remain exact: ' + file);\n  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));\n  assert.deepEqual(Object.keys(pin).sort(), [\n"
            },
            {
              "current": "  const pin = ECONOMY_SOCIAL_RECEIPT_SAFETY_DOMAINS[file];\n  const current = git('show', ECONOMY_SOCIAL_RECEIPT_SAFETY_REVISION + ':' + file);\n  const baseline = git('show', ECONOMY_SOCIAL_RECEIPT_SAFETY_PREDECESSOR + ':' + file);\n  const physical = lf(economySocialProofCutoverHistoricalInput(file, monitorPhysicalSource(file)));\n  assert.equal(physical, current, 'Physical receipt-safety repair source must remain exact: ' + file);\n  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));\n  assert.deepEqual(Object.keys(pin).sort(), [\n",
              "baseline": "  const pin = ECONOMY_SOCIAL_RECEIPT_SAFETY_DOMAINS[file];\n  const current = git('show', ECONOMY_SOCIAL_RECEIPT_SAFETY_REVISION + ':' + file);\n  const baseline = git('show', ECONOMY_SOCIAL_RECEIPT_SAFETY_PREDECESSOR + ':' + file);\n  const physical = lf(economySocialProofCutoverHistoricalInput(file, deedAllocationPhysicalSource(file)));\n  assert.equal(physical, current, 'Physical receipt-safety repair source must remain exact: ' + file);\n  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));\n  assert.deepEqual(Object.keys(pin).sort(), [\n"
            },
            {
              "current": "  const pin = ECONOMY_SOCIAL_RECEIPT_DOMAINS[file];\n  const current = git('show', ECONOMY_SOCIAL_RECEIPT_REVISION + ':' + file);\n  const baseline = git('show', ECONOMY_SOCIAL_RECEIPT_PREDECESSOR + ':' + file);\n  const cutoverPhysical = economySocialProofCutoverHistoricalInput(file, monitorPhysicalSource(file));\n  const physical = lf(economySocialReceiptSafetyHistoricalInput(file, cutoverPhysical));\n  assert.equal(physical, current, 'Physical social-receipt repair source must remain exact: ' + file);\n  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));\n",
              "baseline": "  const pin = ECONOMY_SOCIAL_RECEIPT_DOMAINS[file];\n  const current = git('show', ECONOMY_SOCIAL_RECEIPT_REVISION + ':' + file);\n  const baseline = git('show', ECONOMY_SOCIAL_RECEIPT_PREDECESSOR + ':' + file);\n  const cutoverPhysical = economySocialProofCutoverHistoricalInput(file, deedAllocationPhysicalSource(file));\n  const physical = lf(economySocialReceiptSafetyHistoricalInput(file, cutoverPhysical));\n  assert.equal(physical, current, 'Physical social-receipt repair source must remain exact: ' + file);\n  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));\n"
            }
          ]
        }
      }
    },
    {
      "file": "test/lib/enterprise-ux-native-guard.js",
      "current": {
        "mode": "100644",
        "sha256": "8e71846ce53b4a5f7e5e51094ba85b2804e4880ad0cc735e2ad5f543c2f20d45",
        "blob": "6525e9b15bd312867dd51ad18e1aec68be868f3c",
        "bytes": 17359,
        "rawSha256": {
          "lf": "8e71846ce53b4a5f7e5e51094ba85b2804e4880ad0cc735e2ad5f543c2f20d45",
          "crlf": "34998925bed5395e1abbdaf2ecb76a3d672d4c97d58230d4e915e34b5a5d6416"
        }
      },
      "parents": {
        "monitor": {
          "mode": "100644",
          "sha256": "b472544b4e698beae10affaf66ac4fcca9fa6fdf09e3eba5061ee8e623f54031",
          "blob": "98e3df7098d337126210345ee78642c46868cc2c",
          "bytes": 13688,
          "inverses": [
            {
              "current": "  'tools/generate-economy-monitor-source-transfer.js', 'test/economy-monitor-source-compatibility.js',\n  'test/economy-monitor.js', 'test/economy-composition.js', 'test/economy-composition-restart.js',\n  'tools/generate-age-eligibility-source-transfer.js', 'test/age-eligibility-source-compatibility.js',\n  'test/age.js', 'test/legal-security.js', 'tools/economy-deed-merge-source-data.js',\n  'tools/economy-deed-merge-source-compatibility.js', 'tools/generate-economy-deed-merge-source.js',\n  'test/economy-deed-merge-source-compatibility.js'];\n for (const file of economySupport)\n  assert(ENTERPRISE_UX_SUPPORT.includes(file), 'Current monitoring and merged-source proofs remain in the native closure: ' + file);\n const fixturePin = (file, blobDigit, shaDigit, mode = '100644') => Object.freeze({ file, mode, blob: blobDigit.repeat(40), sha256: shaDigit.repeat(64) });\n const fixtureFiles = ['src/present-changed.js', 'src/present-unchanged.js', 'src/absent-changed.js', 'src/absent-unchanged.js'];\n const presentBefore = fixturePin(fixtureFiles[0], '1', '2'), presentAfter = fixturePin(fixtureFiles[0], '3', '4'), presentSame = fixturePin(fixtureFiles[1], '5', '6');\n",
              "baseline": "  'tools/generate-economy-monitor-source-transfer.js', 'test/economy-monitor-source-compatibility.js',\n  'test/economy-monitor.js', 'test/economy-composition.js', 'test/economy-composition-restart.js',\n  'tools/generate-age-eligibility-source-transfer.js', 'test/age-eligibility-source-compatibility.js',\n  'test/age.js', 'test/legal-security.js'];\n for (const file of economySupport)\n  assert(ENTERPRISE_UX_SUPPORT.includes(file), 'Current economy monitor and composition execution inputs stay in the native closure: ' + file);\n const fixturePin = (file, blobDigit, shaDigit, mode = '100644') => Object.freeze({ file, mode, blob: blobDigit.repeat(40), sha256: shaDigit.repeat(64) });\n const fixtureFiles = ['src/present-changed.js', 'src/present-unchanged.js', 'src/absent-changed.js', 'src/absent-unchanged.js'];\n const presentBefore = fixturePin(fixtureFiles[0], '1', '2'), presentAfter = fixturePin(fixtureFiles[0], '3', '4'), presentSame = fixturePin(fixtureFiles[1], '5', '6');\n"
            },
            {
              "current": " if (pin.status === 'UNSEALED') reject(() => assertEnterpriseUxInputDefinition(legacyFiles, legacy));\n else {\n  assert.equal(assertEnterpriseUxInputDefinition(legacyFiles, legacy), pin);\n  for (const mutate of [p => p.version = 1, p => p.status = 'UNSEALED', p => p.authoredRevision = '0'.repeat(40), p => p.predecessorRevision = '1'.repeat(40), p => p.legacyDefinitionSha256 = '2'.repeat(64), p => p.files.shift(), p => p.files.push(p.files[0]), p => p.files[0].blob = '3'.repeat(40), p => p.additions.length = 0, p => p.replacements.length = 0, p => p.legacyAdditionReplacements.length = 0, p => p.extraMetadataExemption = 'src/server.js']) {\n   const changed = structuredClone(pin); mutate(changed); reject(() => assertEnterpriseUxInputDefinition(legacyFiles, legacy, changed));\n  }\n  assert.equal(pin.version, 3); assert.equal(pin.phase, 'ACTUAL_ENTERPRISE_DEED_NATIVE_INPUTS');\n  assert.equal(pin.files.length, legacyFiles.length + pin.additions.length);\n  assert.equal(pin.legacyAdditionReplacements.length, 4);\n  assert(pin.files.some(row => row.file === 'tools/enterprise-native-ux-b35-inputs.js'), 'The old B35 native manifest is an ordinary pinned input');\n  assert(pin.files.some(row => row.file === 'tools/enterprise-native-ux-inputs.js'), 'The qualified UX native manifest is an ordinary pinned input');\n  assert(pin.files.some(row => row.file === 'src/deedbenefits.js'), 'The actual new runtime benefit dependency is in the closed native capture');\n  assert.equal(ENTERPRISE_UX_METADATA, 'tools/enterprise-native-deed-inputs.js', 'Only the fresh successor manifest is self-referential');\n  const requiredLegacyReplacements = ['src/accountdaily.js', 'src/socialproof.js', 'tools/economy-hardening-source-transfer.js', 'tools/economy-release-tail-source-transfer.js'];\n  assert.deepEqual(pin.legacyAdditionReplacements.map(row => row.file), requiredLegacyReplacements);\n  const tree = revision => new Map(git('ls-tree', '-r', '-z', revision).toString().split('\\0').filter(Boolean).map(line => { const index = line.indexOf('\\t'), [mode, type, blob] = line.slice(0, index).split(' '); return [line.slice(index + 1), { mode, type, blob }]; }));\n",
              "baseline": " if (pin.status === 'UNSEALED') reject(() => assertEnterpriseUxInputDefinition(legacyFiles, legacy));\n else {\n  assert.equal(assertEnterpriseUxInputDefinition(legacyFiles, legacy), pin);\n  for (const file of [...economySupport, 'src/economy-monitor.js', 'tools/economy-monitor-source-transfer.js',\n   'tools/age-eligibility-source-transfer.js', 'tools/walletconnect-privacy.mjs'])\n   assert(pin.files.some(row => row.file === file), 'Sealed actual economy monitoring/composition input: ' + file);\n  for (const mutate of [p => p.version = 1, p => p.status = 'UNSEALED', p => p.authoredRevision = '0'.repeat(40), p => p.predecessorRevision = '1'.repeat(40), p => p.legacyDefinitionSha256 = '2'.repeat(64), p => p.files.shift(), p => p.files.push(p.files[0]), p => p.files[0].blob = '3'.repeat(40), p => p.additions.length = 0, p => p.replacements.length = 0, p => p.legacyAdditionReplacements.length = 0, p => p.extraMetadataExemption = 'src/server.js']) {\n   const changed = structuredClone(pin); mutate(changed); reject(() => assertEnterpriseUxInputDefinition(legacyFiles, legacy, changed));\n  }\n  assert.equal(pin.files.length, 1746); assert.equal(pin.replacements.length, 92); assert.equal(pin.legacyAdditionReplacements.length, 4); assert.equal(pin.additions.length, 103);\n  const requiredLegacyReplacements = ['src/accountdaily.js', 'src/socialproof.js', 'tools/economy-hardening-source-transfer.js', 'tools/economy-release-tail-source-transfer.js'];\n  assert.deepEqual(pin.legacyAdditionReplacements.map(row => row.file), requiredLegacyReplacements);\n  const tree = revision => new Map(git('ls-tree', '-r', '-z', revision).toString().split('\\0').filter(Boolean).map(line => { const index = line.indexOf('\\t'), [mode, type, blob] = line.slice(0, index).split(' '); return [line.slice(index + 1), { mode, type, blob }]; }));\n"
            },
            {
              "current": "  const predecessorPin = (file, after) => { const before = predecessor.get(file); if (before) return Object.freeze({ file, mode: before.mode, blob: before.blob, sha256: before.blob === after.blob ? after.sha256 : digest(git('show', pin.predecessorRevision + ':' + file)) }); const legacyPin = legacyAdditions.get(file), actual = legacyTree.get(file); assert(legacyPin && actual?.type === 'blob'); assert.equal(actual.mode, legacyPin.mode); assert.equal(actual.blob, legacyPin.blob); assert.equal(digest(git('show', pin.legacyRevision + ':' + file)), legacyPin.sha256); return null; };\n  assertEnterpriseUxReplacementPlan(legacyFiles, legacy, pin.files, predecessorPin, pin);\n  for (const file of requiredLegacyReplacements) { const row = pin.legacyAdditionReplacements.find(entry => entry.file === file), before = legacyAdditions.get(file), after = pin.files.find(entry => entry.file === file); assert.equal(git('ls-tree', pin.predecessorRevision, '--', file).length, 0); assert.deepEqual(row.before, before); assert.deepEqual(row.after, after); }\n  const unchanged = pin.files.find(row => row.file === '.github/workflows/ci.yml'); assert(unchanged);\n  const unchangedBytes = git('show', pin.authoredRevision + ':' + unchanged.file);\n  const unchangedRecord = { type: 'blob', mode: unchanged.mode, blob: unchanged.blob };\n  assert.equal(assertEnterpriseUxTrackedInput(unchanged.file, unchangedRecord, unchangedRecord, unchangedBytes), null,\n    'An unchanged actual-current input needs no changed-source provenance');\n  const first = pin.files.find(row => row.file === 'AGENTS.md'); assert(first);\n  const canonical = git('show', pin.authoredRevision + ':' + first.file), record = { type: 'blob', mode: first.mode, blob: first.blob };\n  const provenance = assertEnterpriseUxTrackedInput(first.file, record, record, canonical);\n  assert(provenance && Object.isFrozen(provenance));\n  assert.equal(provenance.current.blob, record.blob, 'Provenance retains the actual current Git identity');\n  assert.equal(provenance.current.sha256, digest(canonical));\n  assert.notEqual(provenance.predecessor.blob, record.blob);\n  assert.equal(provenance.nativeAdmission, false, 'Historical provenance cannot grant native admission');\n  assert.equal(provenance.priorResultsTransferred, false);\n  const merged = pin.files.find(row => row.file === 'src/game.js'); assert(merged);\n  const mergedBytes = git('show', pin.authoredRevision + ':' + merged.file);\n  const mergedRecord = { type: 'blob', mode: merged.mode, blob: merged.blob };\n  const mergedProvenance = assertEnterpriseUxTrackedInput(merged.file, mergedRecord, mergedRecord, mergedBytes);\n  assert.equal(mergedProvenance.relation, 'exact-reviewed-economy-deed-merge-source-provenance-only');\n  assert.equal(mergedProvenance.nativeAdmission, false); assert.equal(mergedProvenance.priorResultsTransferred, false);\n  assert.equal(mergedProvenance.current.sha256, digest(mergedBytes));\n  for (const parent of ['c771f5ba73453a57e24e31f8eeb920933fe7544c', '4e5f7fdb1cc4d2055ac613d2d4cb562a8007c364']) {\n   const parentBytes = git('show', parent + ':' + merged.file);\n   const parentBlob = crypto.createHash('sha1').update('blob ' + parentBytes.length + '\\0').update(parentBytes).digest('hex');\n   assert.notEqual(parentBlob, merged.blob, 'Each reviewed parent lacks part of the actual merged game source');\n   const parentRecord = { type: 'blob', mode: merged.mode, blob: parentBlob };\n   reject(() => assertEnterpriseUxTrackedInput(merged.file, parentRecord, parentRecord, parentBytes));\n  }\n  const historical = git('show', provenance.predecessorRevision + ':' + first.file);\n  const historicalRecord = { type: 'blob', mode: provenance.predecessor.mode, blob: provenance.predecessor.blob };\n  reject(() => assertEnterpriseUxTrackedInput(first.file, historicalRecord, historicalRecord, historical),\n    'Historical bytes cannot replace the fresh current-native input');\n  for (const [current, authored, bytes] of [[{ ...record, blob: '0'.repeat(40) }, record, canonical], [record, { ...record, blob: '1'.repeat(40) }, canonical], [{ ...record, mode: '120000' }, record, canonical], [record, record, Buffer.concat([canonical, Buffer.from('\\n')])], [record, record, canonical.subarray(1)], [record, record, canonical.toString('utf8')]]) reject(() => assertEnterpriseUxTrackedInput(first.file, current, authored, bytes));\n  reject(() => assertEnterpriseUxTrackedInput('../outside.js', record, record, canonical));\n  reject(() => assertEnterpriseUxTrackedInput(first.file, record, record, canonical, structuredClone(pin)));\n",
              "baseline": "  const predecessorPin = (file, after) => { const before = predecessor.get(file); if (before) return Object.freeze({ file, mode: before.mode, blob: before.blob, sha256: before.blob === after.blob ? after.sha256 : digest(git('show', pin.predecessorRevision + ':' + file)) }); const legacyPin = legacyAdditions.get(file), actual = legacyTree.get(file); assert(legacyPin && actual?.type === 'blob'); assert.equal(actual.mode, legacyPin.mode); assert.equal(actual.blob, legacyPin.blob); assert.equal(digest(git('show', pin.legacyRevision + ':' + file)), legacyPin.sha256); return null; };\n  assertEnterpriseUxReplacementPlan(legacyFiles, legacy, pin.files, predecessorPin, pin);\n  for (const file of requiredLegacyReplacements) { const row = pin.legacyAdditionReplacements.find(entry => entry.file === file), before = legacyAdditions.get(file), after = pin.files.find(entry => entry.file === file); assert.equal(git('ls-tree', pin.predecessorRevision, '--', file).length, 0); assert.deepEqual(row.before, before); assert.deepEqual(row.after, after); }\n  const first = pin.files[0], canonical = git('show', pin.authoredRevision + ':' + first.file), record = { type: 'blob', mode: first.mode, blob: first.blob };\n  assertEnterpriseUxTrackedInput(first.file, record, record, canonical);\n  for (const [current, authored, bytes] of [[{ ...record, blob: '0'.repeat(40) }, record, canonical], [record, { ...record, blob: '1'.repeat(40) }, canonical], [{ ...record, mode: '120000' }, record, canonical], [record, record, Buffer.concat([canonical, Buffer.from('\\n')])], [record, record, canonical.subarray(1)], [record, record, canonical.toString('utf8')]]) reject(() => assertEnterpriseUxTrackedInput(first.file, current, authored, bytes));\n  reject(() => assertEnterpriseUxTrackedInput('../outside.js', record, record, canonical));\n  reject(() => assertEnterpriseUxTrackedInput(first.file, record, record, canonical, structuredClone(pin)));\n"
            },
            {
              "current": " const capture = after.get('captureEnterpriseSource');\n assert(capture.includes('assertEnterpriseUxInputDefinition(ENTERPRISE_NATIVE_FILES,successor)'));\n assert(capture.includes('assertEnterpriseUxTrackedInput(f,tracked,authored.get(f),canonical,ux)'));\n assert(capture.includes('if(provenance)sourceProvenance[f]=provenance') && capture.includes('nativeInputProvenance:sourceProvenance'),\n  'Current physical input identity and historical source provenance are captured separately');\n assert(!/HistoricalInput|SourceBaseline|qualifyUxSource/.test(capture), 'Native capture never reconstructs a historical source');\n const nativeInputGuard = lf(fs.readFileSync('tools/enterprise-native-ux.js', 'utf8'));\n assert(!/assertDeedAllocationSourceTransfer|deedAllocationHistoricalInput|baselineText/.test(nativeInputGuard),\n  'Actual-current native admission and provenance never reconstruct inverse historical source text');\n assert(capture.includes('f===ENTERPRISE_UX_METADATA') && !capture.includes(\"f!=='tools/enterprise-native-inputs.js'\"), 'Exactly the new self-reference is unpinnable; old metadata is pinned');\n assert(capture.includes('assertEnterpriseUxReplacementPlan(ENTERPRISE_NATIVE_FILES,successor,ux.files,predecessorPin,ux)') && capture.includes('uxLegacyAdditionReplacements:replacementPlan.legacyAdditionReplacements.map'), 'UX integration recomputes and records both complete replacement categories');\n console.log(JSON.stringify({ phase: 'CURRENT_UX_NATIVE_ADMISSION_GUARDS', status: pin.status, refusals: negatives, unchangedWorkloadCases: 16, originalGuardsUnchanged: true, nativeExecution: false, priorResultsTransferred: false }));\n",
              "baseline": " const capture = after.get('captureEnterpriseSource');\n assert(capture.includes('assertEnterpriseUxInputDefinition(ENTERPRISE_NATIVE_FILES,successor)'));\n assert(capture.includes('assertEnterpriseUxTrackedInput(f,tracked,authored.get(f),canonical,ux)'));\n assert(!/HistoricalInput|SourceBaseline|qualifyUxSource/.test(capture), 'Native capture never reconstructs a historical source');\n assert(capture.includes('f===ENTERPRISE_UX_METADATA') && !capture.includes(\"f!=='tools/enterprise-native-inputs.js'\"), 'Exactly the new self-reference is unpinnable; old metadata is pinned');\n assert(capture.includes('assertEnterpriseUxReplacementPlan(ENTERPRISE_NATIVE_FILES,successor,ux.files,predecessorPin,ux)') && capture.includes('uxLegacyAdditionReplacements:replacementPlan.legacyAdditionReplacements.map'), 'UX integration recomputes and records both complete replacement categories');\n console.log(JSON.stringify({ phase: 'CURRENT_UX_NATIVE_ADMISSION_GUARDS', status: pin.status, refusals: negatives, unchangedWorkloadCases: 16, originalGuardsUnchanged: true, nativeExecution: false, priorResultsTransferred: false }));\n"
            }
          ]
        },
        "deed": {
          "mode": "100644",
          "sha256": "82c978c98c833a44dd5250f64e0d3fe09992c9806690e14f812a229992ce2b97",
          "blob": "dca55c5abc1c733552c9177b3dfc9c17c3d55887",
          "bytes": 15325,
          "inverses": [
            {
              "current": " let negatives = 0;\n const reject = run => { assert.throws(run); negatives++; };\n const pin = ENTERPRISE_NATIVE_UX_INPUTS;\n const economySupport = ['.github/workflows/economy-hardening.yml',\n  'tools/generate-economy-monitor-source-transfer.js', 'test/economy-monitor-source-compatibility.js',\n  'test/economy-monitor.js', 'test/economy-composition.js', 'test/economy-composition-restart.js',\n  'tools/generate-age-eligibility-source-transfer.js', 'test/age-eligibility-source-compatibility.js',\n  'test/age.js', 'test/legal-security.js', 'tools/economy-deed-merge-source-data.js',\n  'tools/economy-deed-merge-source-compatibility.js', 'tools/generate-economy-deed-merge-source.js',\n  'test/economy-deed-merge-source-compatibility.js'];\n for (const file of economySupport)\n  assert(ENTERPRISE_UX_SUPPORT.includes(file), 'Current monitoring and merged-source proofs remain in the native closure: ' + file);\n const fixturePin = (file, blobDigit, shaDigit, mode = '100644') => Object.freeze({ file, mode, blob: blobDigit.repeat(40), sha256: shaDigit.repeat(64) });\n const fixtureFiles = ['src/present-changed.js', 'src/present-unchanged.js', 'src/absent-changed.js', 'src/absent-unchanged.js'];\n const presentBefore = fixturePin(fixtureFiles[0], '1', '2'), presentAfter = fixturePin(fixtureFiles[0], '3', '4'), presentSame = fixturePin(fixtureFiles[1], '5', '6');\n",
              "baseline": " let negatives = 0;\n const reject = run => { assert.throws(run); negatives++; };\n const pin = ENTERPRISE_NATIVE_UX_INPUTS;\n const fixturePin = (file, blobDigit, shaDigit, mode = '100644') => Object.freeze({ file, mode, blob: blobDigit.repeat(40), sha256: shaDigit.repeat(64) });\n const fixtureFiles = ['src/present-changed.js', 'src/present-unchanged.js', 'src/absent-changed.js', 'src/absent-unchanged.js'];\n const presentBefore = fixturePin(fixtureFiles[0], '1', '2'), presentAfter = fixturePin(fixtureFiles[0], '3', '4'), presentSame = fixturePin(fixtureFiles[1], '5', '6');\n"
            },
            {
              "current": "  assert.notEqual(provenance.predecessor.blob, record.blob);\n  assert.equal(provenance.nativeAdmission, false, 'Historical provenance cannot grant native admission');\n  assert.equal(provenance.priorResultsTransferred, false);\n  const merged = pin.files.find(row => row.file === 'src/game.js'); assert(merged);\n  const mergedBytes = git('show', pin.authoredRevision + ':' + merged.file);\n  const mergedRecord = { type: 'blob', mode: merged.mode, blob: merged.blob };\n  const mergedProvenance = assertEnterpriseUxTrackedInput(merged.file, mergedRecord, mergedRecord, mergedBytes);\n  assert.equal(mergedProvenance.relation, 'exact-reviewed-economy-deed-merge-source-provenance-only');\n  assert.equal(mergedProvenance.nativeAdmission, false); assert.equal(mergedProvenance.priorResultsTransferred, false);\n  assert.equal(mergedProvenance.current.sha256, digest(mergedBytes));\n  for (const parent of ['c771f5ba73453a57e24e31f8eeb920933fe7544c', '4e5f7fdb1cc4d2055ac613d2d4cb562a8007c364']) {\n   const parentBytes = git('show', parent + ':' + merged.file);\n   const parentBlob = crypto.createHash('sha1').update('blob ' + parentBytes.length + '\\0').update(parentBytes).digest('hex');\n   assert.notEqual(parentBlob, merged.blob, 'Each reviewed parent lacks part of the actual merged game source');\n   const parentRecord = { type: 'blob', mode: merged.mode, blob: parentBlob };\n   reject(() => assertEnterpriseUxTrackedInput(merged.file, parentRecord, parentRecord, parentBytes));\n  }\n  const historical = git('show', provenance.predecessorRevision + ':' + first.file);\n  const historicalRecord = { type: 'blob', mode: provenance.predecessor.mode, blob: provenance.predecessor.blob };\n  reject(() => assertEnterpriseUxTrackedInput(first.file, historicalRecord, historicalRecord, historical),\n",
              "baseline": "  assert.notEqual(provenance.predecessor.blob, record.blob);\n  assert.equal(provenance.nativeAdmission, false, 'Historical provenance cannot grant native admission');\n  assert.equal(provenance.priorResultsTransferred, false);\n  const historical = git('show', provenance.predecessorRevision + ':' + first.file);\n  const historicalRecord = { type: 'blob', mode: provenance.predecessor.mode, blob: provenance.predecessor.blob };\n  reject(() => assertEnterpriseUxTrackedInput(first.file, historicalRecord, historicalRecord, historical),\n"
            }
          ]
        }
      }
    },
    {
      "file": "test/lib/ux-native-reader-source-compatibility.js",
      "current": {
        "mode": "100644",
        "sha256": "851f1f99f5bcb478d2a7bf354b0f0b08ea9ae5afc5535fadf877a943c33f1c35",
        "blob": "ac8ef4b0dd5476f7d6ee94b6f67ac9ef26141835",
        "bytes": 15653,
        "rawSha256": {
          "lf": "851f1f99f5bcb478d2a7bf354b0f0b08ea9ae5afc5535fadf877a943c33f1c35",
          "crlf": "acaefcd9c036f382d1a5f43806dd5524a830a84be79d0dfd461125658ecc5fee"
        }
      },
      "parents": {
        "monitor": {
          "mode": "100644",
          "sha256": "bfeb64c42f056a2c7e556fb9e079faded5a5cb8f9785e428e8dd40a4194bce61",
          "blob": "a983314da61b23e61a8f2263e3c338201a1f572d",
          "bytes": 13837,
          "inverses": [
            {
              "current": "import { UX_NATIVE_READER_SOURCE as pin, UX_NATIVE_READER_SOURCE_FILES, qualifyUxNativeReaderSource, uxNativeReaderHistoricalInput, UX_PHASE2_UPGRADE_BOUND_SOURCE, UX_PHASE2_UPGRADE_BOUND_FILE, qualifyUxPhase2UpgradeBoundSource, uxPhase2UpgradeBoundHistoricalInput } from '../../tools/ux-native-reader-source-compatibility.js';\nimport { qualifyUxSource, uxHistoricalInput } from '../../tools/ux-source-compatibility.js';\nimport { ECONOMY_UX_MERGE_SOURCE, economyUxMergeMainHistoricalInput } from '../../tools/economy-ux-merge-source-compatibility.js';\nimport { DEED_ALLOCATION_SOURCE_PREDECESSOR, DEED_ALLOCATION_SOURCE_DOMAINS, assertDeedAllocationSourceTransfer } from '../../tools/deed-allocation-source-transfer.js';\nimport { ECONOMY_DEED_MERGE_SOURCE, assertEconomyDeedMergeSource,\n  economyDeedMergeHistoricalInput } from '../../tools/economy-deed-merge-source-compatibility.js';\nconst AUTHORED_NATIVE_READER_FIX = 'c1720a694799e743c6f70bc3069dba2bbecae08e';\nconst git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });\nconst sha = value => crypto.createHash('sha256').update(value).digest('hex');\n",
              "baseline": "import { UX_NATIVE_READER_SOURCE as pin, UX_NATIVE_READER_SOURCE_FILES, qualifyUxNativeReaderSource, uxNativeReaderHistoricalInput, UX_PHASE2_UPGRADE_BOUND_SOURCE, UX_PHASE2_UPGRADE_BOUND_FILE, qualifyUxPhase2UpgradeBoundSource, uxPhase2UpgradeBoundHistoricalInput } from '../../tools/ux-native-reader-source-compatibility.js';\nimport { qualifyUxSource, uxHistoricalInput } from '../../tools/ux-source-compatibility.js';\nimport { ECONOMY_UX_MERGE_SOURCE, economyUxMergeMainHistoricalInput } from '../../tools/economy-ux-merge-source-compatibility.js';\nconst AUTHORED_NATIVE_READER_FIX = 'c1720a694799e743c6f70bc3069dba2bbecae08e';\nconst git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });\nconst sha = value => crypto.createHash('sha256').update(value).digest('hex');\n"
            },
            {
              "current": "};\n// This is only the historical reader's qualified view; raw HEAD is independently pinned below.\nfunction qualifiedNativeReaderHeadEntry(file) {\n  const actual = git('show', 'HEAD:' + file); let entry = git('ls-tree', 'HEAD', '--', file).trim();\n  const raw = economyDeedMergeHistoricalInput(file, actual, 'deed');\n  if (raw !== actual) {\n    const integration = ECONOMY_DEED_MERGE_SOURCE.files.find(row => row.file === file);\n    const proof = assertEconomyDeedMergeSource(file, actual, 'deed');\n    assert.equal(entry, integration.current.mode + ' blob ' + integration.current.blob + '\\t' + file,\n      'Actual merged HEAD mode/blob must qualify before source-only parent bookkeeping');\n    assert.deepEqual([proof.sourceOnly, proof.runtime, proof.native], [true, false, false]);\n    assert.equal(proof.baselineText, raw);\n    entry = integration.parents.deed.mode + ' blob ' + integration.parents.deed.blob + '\\t' + file;\n  }\n  const deed = DEED_ALLOCATION_SOURCE_DOMAINS[file];\n  if (deed) {\n    assert.equal(entry, deed.currentMode + ' blob ' + deed.currentBlob + '\\t' + file, 'Raw Deed HEAD mode/blob must qualify before historical source bookkeeping');\n    const proof = assertDeedAllocationSourceTransfer(file, raw);\n    assert.deepEqual([proof.sourceOnly, proof.runtime, proof.native], [true, false, false]);\n    assert.equal(proof.predecessorRevision, DEED_ALLOCATION_SOURCE_PREDECESSOR);\n    const baselineEntry = git('ls-tree', DEED_ALLOCATION_SOURCE_PREDECESSOR, '--', file).trim();\n    assert.equal(baselineEntry, deed.baselineMode + ' blob ' + deed.baselineBlob + '\\t' + file);\n    assert.equal(proof.baselineText, git('show', DEED_ALLOCATION_SOURCE_PREDECESSOR + ':' + file));\n    entry = baselineEntry;\n  }\n  const mergeQualified = economyUxMergeMainHistoricalInput(file, raw);\n  if (mergeQualified !== raw) {\n    const mergeRow = ECONOMY_UX_MERGE_SOURCE.files.find(item => item.file === file); assert(mergeRow);\n",
              "baseline": "};\n// This is only the historical reader's qualified view; raw HEAD is independently pinned below.\nfunction qualifiedNativeReaderHeadEntry(file) {\n  const raw = git('show', 'HEAD:' + file); let entry = git('ls-tree', 'HEAD', '--', file).trim();\n  const mergeQualified = economyUxMergeMainHistoricalInput(file, raw);\n  if (mergeQualified !== raw) {\n    const mergeRow = ECONOMY_UX_MERGE_SOURCE.files.find(item => item.file === file); assert(mergeRow);\n"
            },
            {
              "current": "  if (row.inverses.length > 1) { const [left, right] = row.inverses, marker = '\\u0001NATIVE_READER_HUNK_SWAP\\u0001'; assert(!current.includes(marker)); reject(current.replace(left.current, () => marker).replace(right.current, () => left.current).replace(marker, () => right.current)); }\n  for (const input of [current + '\\n// arbitrary future source\\n', current.slice(1), target]) assert.equal(uxNativeReaderHistoricalInput(row.file, input), input);\n  assert.throws(() => qualifyUxNativeReaderSource(row.file, current, Object.freeze({ ...pin }))); refusals++;\n  assert.throws(() => uxNativeReaderHistoricalInput(row.file, Buffer.concat([Buffer.from(current), Buffer.from([0xff])])), /Lossless UTF-8/i); refusals++;\n  assert.throws(() => qualifyUxSource(row.file, current)); refusals++;\n  assert.equal(sha(current), row.currentSha256);\n}\n",
              "baseline": "  if (row.inverses.length > 1) { const [left, right] = row.inverses, marker = '\\u0001NATIVE_READER_HUNK_SWAP\\u0001'; assert(!current.includes(marker)); reject(current.replace(left.current, () => marker).replace(right.current, () => left.current).replace(marker, () => right.current)); }\n  for (const input of [current + '\\n// arbitrary future source\\n', current.slice(1), target]) assert.equal(uxNativeReaderHistoricalInput(row.file, input), input);\n  assert.throws(() => qualifyUxNativeReaderSource(row.file, current, Object.freeze({ ...pin }))); refusals++;\n  assert.throws(() => uxNativeReaderHistoricalInput(row.file, Buffer.concat([Buffer.from(current), Buffer.from([0xff])])), /Lossless UTF-8/); refusals++;\n  assert.throws(() => qualifyUxSource(row.file, current)); refusals++;\n  assert.equal(sha(current), row.currentSha256);\n}\n"
            }
          ]
        },
        "deed": {
          "mode": "100644",
          "sha256": "907a349ae898c7b7b6541cf06eb68f50de54d2474c883ced62f5e6919a2d0f1d",
          "blob": "d2154925f5de67b0bc06e0c25f132140cb1d025e",
          "bytes": 14801,
          "inverses": [
            {
              "current": "import { qualifyUxSource, uxHistoricalInput } from '../../tools/ux-source-compatibility.js';\nimport { ECONOMY_UX_MERGE_SOURCE, economyUxMergeMainHistoricalInput } from '../../tools/economy-ux-merge-source-compatibility.js';\nimport { DEED_ALLOCATION_SOURCE_PREDECESSOR, DEED_ALLOCATION_SOURCE_DOMAINS, assertDeedAllocationSourceTransfer } from '../../tools/deed-allocation-source-transfer.js';\nimport { ECONOMY_DEED_MERGE_SOURCE, assertEconomyDeedMergeSource,\n  economyDeedMergeHistoricalInput } from '../../tools/economy-deed-merge-source-compatibility.js';\nconst AUTHORED_NATIVE_READER_FIX = 'c1720a694799e743c6f70bc3069dba2bbecae08e';\nconst git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });\nconst sha = value => crypto.createHash('sha256').update(value).digest('hex');\n",
              "baseline": "import { qualifyUxSource, uxHistoricalInput } from '../../tools/ux-source-compatibility.js';\nimport { ECONOMY_UX_MERGE_SOURCE, economyUxMergeMainHistoricalInput } from '../../tools/economy-ux-merge-source-compatibility.js';\nimport { DEED_ALLOCATION_SOURCE_PREDECESSOR, DEED_ALLOCATION_SOURCE_DOMAINS, assertDeedAllocationSourceTransfer } from '../../tools/deed-allocation-source-transfer.js';\nconst AUTHORED_NATIVE_READER_FIX = 'c1720a694799e743c6f70bc3069dba2bbecae08e';\nconst git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });\nconst sha = value => crypto.createHash('sha256').update(value).digest('hex');\n"
            },
            {
              "current": "};\n// This is only the historical reader's qualified view; raw HEAD is independently pinned below.\nfunction qualifiedNativeReaderHeadEntry(file) {\n  const actual = git('show', 'HEAD:' + file); let entry = git('ls-tree', 'HEAD', '--', file).trim();\n  const raw = economyDeedMergeHistoricalInput(file, actual, 'deed');\n  if (raw !== actual) {\n    const integration = ECONOMY_DEED_MERGE_SOURCE.files.find(row => row.file === file);\n    const proof = assertEconomyDeedMergeSource(file, actual, 'deed');\n    assert.equal(entry, integration.current.mode + ' blob ' + integration.current.blob + '\\t' + file,\n      'Actual merged HEAD mode/blob must qualify before source-only parent bookkeeping');\n    assert.deepEqual([proof.sourceOnly, proof.runtime, proof.native], [true, false, false]);\n    assert.equal(proof.baselineText, raw);\n    entry = integration.parents.deed.mode + ' blob ' + integration.parents.deed.blob + '\\t' + file;\n  }\n  const deed = DEED_ALLOCATION_SOURCE_DOMAINS[file];\n  if (deed) {\n    assert.equal(entry, deed.currentMode + ' blob ' + deed.currentBlob + '\\t' + file, 'Raw Deed HEAD mode/blob must qualify before historical source bookkeeping');\n",
              "baseline": "};\n// This is only the historical reader's qualified view; raw HEAD is independently pinned below.\nfunction qualifiedNativeReaderHeadEntry(file) {\n  const raw = git('show', 'HEAD:' + file); let entry = git('ls-tree', 'HEAD', '--', file).trim();\n  const deed = DEED_ALLOCATION_SOURCE_DOMAINS[file];\n  if (deed) {\n    assert.equal(entry, deed.currentMode + ' blob ' + deed.currentBlob + '\\t' + file, 'Raw Deed HEAD mode/blob must qualify before historical source bookkeeping');\n"
            },
            {
              "current": "  if (row.inverses.length > 1) { const [left, right] = row.inverses, marker = '\\u0001NATIVE_READER_HUNK_SWAP\\u0001'; assert(!current.includes(marker)); reject(current.replace(left.current, () => marker).replace(right.current, () => left.current).replace(marker, () => right.current)); }\n  for (const input of [current + '\\n// arbitrary future source\\n', current.slice(1), target]) assert.equal(uxNativeReaderHistoricalInput(row.file, input), input);\n  assert.throws(() => qualifyUxNativeReaderSource(row.file, current, Object.freeze({ ...pin }))); refusals++;\n  assert.throws(() => uxNativeReaderHistoricalInput(row.file, Buffer.concat([Buffer.from(current), Buffer.from([0xff])])), /Lossless UTF-8/i); refusals++;\n  assert.throws(() => qualifyUxSource(row.file, current)); refusals++;\n  assert.equal(sha(current), row.currentSha256);\n}\n",
              "baseline": "  if (row.inverses.length > 1) { const [left, right] = row.inverses, marker = '\\u0001NATIVE_READER_HUNK_SWAP\\u0001'; assert(!current.includes(marker)); reject(current.replace(left.current, () => marker).replace(right.current, () => left.current).replace(marker, () => right.current)); }\n  for (const input of [current + '\\n// arbitrary future source\\n', current.slice(1), target]) assert.equal(uxNativeReaderHistoricalInput(row.file, input), input);\n  assert.throws(() => qualifyUxNativeReaderSource(row.file, current, Object.freeze({ ...pin }))); refusals++;\n  assert.throws(() => uxNativeReaderHistoricalInput(row.file, Buffer.concat([Buffer.from(current), Buffer.from([0xff])])), /Lossless UTF-8/); refusals++;\n  assert.throws(() => qualifyUxSource(row.file, current)); refusals++;\n  assert.equal(sha(current), row.currentSha256);\n}\n"
            }
          ]
        }
      }
    },
    {
      "file": "test/sale-source-compatibility.js",
      "current": {
        "mode": "100644",
        "sha256": "9eb278519625e3ff8bc91e7b43ad3948f9dcffea56227021a8ae6949f4c36808",
        "blob": "9d3de35cedac17863c7e80589f68f73936d23131",
        "bytes": 15587,
        "rawSha256": {
          "lf": "9eb278519625e3ff8bc91e7b43ad3948f9dcffea56227021a8ae6949f4c36808",
          "crlf": "8fad9dfa9a46645e7478c329136051b9c9e0c76acf5f4cd0616433ce1e2b06cb"
        }
      },
      "parents": {
        "monitor": {
          "mode": "100644",
          "sha256": "017a878c526149819ec26e7b27a23a028164b1e278ea0496d396468bce05c323",
          "blob": "484779d13f679b7a596aad42435acaf06c7671f3",
          "bytes": 15265,
          "inverses": [
            {
              "current": "import { economyMonitorHistoricalInput } from '../tools/economy-monitor-source-transfer.js';\nimport { ageEligibilityHistoricalInput } from '../tools/age-eligibility-source-transfer.js';\nimport { COMMERCE_CURRENT_BOOT_READER } from '../tools/commerce-current-native-data.js';\nimport { deedAllocationHistoricalInput } from '../tools/deed-allocation-source-transfer.js';\nimport { economyDeedMergeHistoricalInput } from '../tools/economy-deed-merge-source-compatibility.js';\nconst git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024 });\nconst sha = value => crypto.createHash('sha256').update(value).digest('hex');\nconst pin = SALE_SOURCE;\n",
              "baseline": "import { economyMonitorHistoricalInput } from '../tools/economy-monitor-source-transfer.js';\nimport { ageEligibilityHistoricalInput } from '../tools/age-eligibility-source-transfer.js';\nimport { COMMERCE_CURRENT_BOOT_READER } from '../tools/commerce-current-native-data.js';\nconst git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024 });\nconst sha = value => crypto.createHash('sha256').update(value).digest('hex');\nconst pin = SALE_SOURCE;\n"
            },
            {
              "current": "};\nlet positives = 0, refusals = 0, hunks = 0;\nconst currentSaleSource = (file, input) => {\n  input = economyDeedMergeHistoricalInput(file, input, 'monitor');\n  input = deedAllocationHistoricalInput(file, input);\n  input = uxAfterwordHistoricalInput(file, input);\n  input = ageEligibilityHistoricalInput(file, input);\n  input = economyMonitorHistoricalInput(file, input);\n",
              "baseline": "};\nlet positives = 0, refusals = 0, hunks = 0;\nconst currentSaleSource = (file, input) => {\n  input = uxAfterwordHistoricalInput(file, input);\n  input = ageEligibilityHistoricalInput(file, input);\n  input = economyMonitorHistoricalInput(file, input);\n"
            },
            {
              "current": "  assert.equal(conserved.split(hook).length, 2, 'One exact separately admitted Afterword integration hook'); conserved = conserved.replace(hook, '');\n}\nassert.equal(conserved, git('show', pin.targetRevision + ':tools/ux-source-compatibility.js'), 'All prior historical qualifiers and refusal predicates remain byte-identical');\n// The dual-parent definition first proves the complete physical integration reader and reconstructs\n// its monitor parent. Retain that parent's independently pinned correction-reader conservation\n// proof below; neither reconstruction executes historical source or admits native bytes.\nconst correctionFile = 'tools/economy-ux-merge-source-compatibility.js';\nconst correctionPhysical = economyDeedMergeHistoricalInput(correctionFile, fs.readFileSync(correctionFile, 'utf8'), 'monitor');\nlet candidateConserved = correctionPhysical.replaceAll('\\r\\n', '\\n');\nconst correctionRevision = '77882cdfc2e54f94602065c58132b9da913b5427';\nconst correctionPredecessor = '6fdc897851ef23e8c2cf691733ad944a7663242a';\nconst correctionCurrent = Object.freeze({ sha256: 'bae09cba0a3833d53b1f29db1c8462513924eb3e9f0b6373544b9c94304e4aea',\n",
              "baseline": "  assert.equal(conserved.split(hook).length, 2, 'One exact separately admitted Afterword integration hook'); conserved = conserved.replace(hook, '');\n}\nassert.equal(conserved, git('show', pin.targetRevision + ':tools/ux-source-compatibility.js'), 'All prior historical qualifiers and refusal predicates remain byte-identical');\nlet candidateConserved = fs.readFileSync('tools/economy-ux-merge-source-compatibility.js', 'utf8').replaceAll('\\r\\n', '\\n');\n// The current correction reader admits only exact newer sources before the old hooks below. Prove\n// its complete authored bytes and reconstruct the immutable pre-correction reader separately; the\n// original hook counts and final byte-for-byte conservation assertion remain unchanged.\nconst correctionFile = 'tools/economy-ux-merge-source-compatibility.js';\nconst correctionPhysical = fs.readFileSync(correctionFile, 'utf8');\nconst correctionRevision = '77882cdfc2e54f94602065c58132b9da913b5427';\nconst correctionPredecessor = '6fdc897851ef23e8c2cf691733ad944a7663242a';\nconst correctionCurrent = Object.freeze({ sha256: 'bae09cba0a3833d53b1f29db1c8462513924eb3e9f0b6373544b9c94304e4aea',\n"
            }
          ]
        },
        "deed": {
          "mode": "100644",
          "sha256": "30ab4aeee8d601dc44928d80321b7f9b757b94e4674e35342d6e2f44aa030eed",
          "blob": "b0f0c53d6d15d95ac3a2c27966c8aa23c5fc466a",
          "bytes": 10170,
          "inverses": [
            {
              "current": "import { uxAfterwordHistoricalInput } from '../tools/ux-afterword-source-compatibility.js';\nimport { economyUxMergeCandidateHistoricalInput, economyUxMergeMainHistoricalInput } from '../tools/economy-ux-merge-source-compatibility.js';\nimport { economySocialProofCutoverHistoricalInput } from '../tools/economy-social-proof-cutover-source-transfer.js';\nimport { economyMonitorHistoricalInput } from '../tools/economy-monitor-source-transfer.js';\nimport { ageEligibilityHistoricalInput } from '../tools/age-eligibility-source-transfer.js';\nimport { COMMERCE_CURRENT_BOOT_READER } from '../tools/commerce-current-native-data.js';\nimport { deedAllocationHistoricalInput } from '../tools/deed-allocation-source-transfer.js';\nimport { economyDeedMergeHistoricalInput } from '../tools/economy-deed-merge-source-compatibility.js';\nconst git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024 });\nconst sha = value => crypto.createHash('sha256').update(value).digest('hex');\nconst pin = SALE_SOURCE;\n",
              "baseline": "import { uxAfterwordHistoricalInput } from '../tools/ux-afterword-source-compatibility.js';\nimport { economyUxMergeCandidateHistoricalInput, economyUxMergeMainHistoricalInput } from '../tools/economy-ux-merge-source-compatibility.js';\nimport { economySocialProofCutoverHistoricalInput } from '../tools/economy-social-proof-cutover-source-transfer.js';\nimport { COMMERCE_CURRENT_BOOT_READER } from '../tools/commerce-current-native-data.js';\nimport { deedAllocationHistoricalInput } from '../tools/deed-allocation-source-transfer.js';\nconst git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024 });\nconst sha = value => crypto.createHash('sha256').update(value).digest('hex');\nconst pin = SALE_SOURCE;\n"
            },
            {
              "current": "  return rows;\n};\nlet positives = 0, refusals = 0, hunks = 0;\nconst currentSaleSource = (file, input) => {\n  input = economyDeedMergeHistoricalInput(file, input, 'monitor');\n  input = deedAllocationHistoricalInput(file, input);\n  input = uxAfterwordHistoricalInput(file, input);\n  input = ageEligibilityHistoricalInput(file, input);\n  input = economyMonitorHistoricalInput(file, input);\n  return economySocialProofCutoverHistoricalInput(file, input);\n};\nfor (const row of pin.files) {\n  const current = git('show', pin.revision + ':' + row.file), target = git('show', pin.targetRevision + ':' + row.file);\n  const physical = currentSaleSource(row.file, fs.readFileSync(row.file, 'utf8'));\n  const committed = currentSaleSource(row.file, git('show', 'HEAD:' + row.file));\n  const stat = fs.lstatSync(row.file);\n  assert(stat.isFile() && !stat.isSymbolicLink());\n  assert.equal(committed, current, 'Actual committed sale source remains exact after the reviewed outer transfer');\n",
              "baseline": "  return rows;\n};\nlet positives = 0, refusals = 0, hunks = 0;\nfor (const row of pin.files) {\n  const current = git('show', pin.revision + ':' + row.file), target = git('show', pin.targetRevision + ':' + row.file);\n  const physical = economySocialProofCutoverHistoricalInput(row.file, uxAfterwordHistoricalInput(row.file, deedAllocationHistoricalInput(row.file, fs.readFileSync(row.file, 'utf8'))));\n  const committed = economySocialProofCutoverHistoricalInput(row.file, uxAfterwordHistoricalInput(row.file, deedAllocationHistoricalInput(row.file, git('show', 'HEAD:' + row.file))));\n  const stat = fs.lstatSync(row.file);\n  assert(stat.isFile() && !stat.isSymbolicLink());\n  assert.equal(committed, current, 'Actual committed sale source remains exact after the reviewed outer transfer');\n"
            },
            {
              "current": "  assert.equal(conserved.split(hook).length, 2, 'One exact separately admitted Afterword integration hook'); conserved = conserved.replace(hook, '');\n}\nassert.equal(conserved, git('show', pin.targetRevision + ':tools/ux-source-compatibility.js'), 'All prior historical qualifiers and refusal predicates remain byte-identical');\n// The dual-parent definition first proves the complete physical integration reader and reconstructs\n// its monitor parent. Retain that parent's independently pinned correction-reader conservation\n// proof below; neither reconstruction executes historical source or admits native bytes.\nconst correctionFile = 'tools/economy-ux-merge-source-compatibility.js';\nconst correctionPhysical = economyDeedMergeHistoricalInput(correctionFile, fs.readFileSync(correctionFile, 'utf8'), 'monitor');\nlet candidateConserved = correctionPhysical.replaceAll('\\r\\n', '\\n');\nconst correctionRevision = '77882cdfc2e54f94602065c58132b9da913b5427';\nconst correctionPredecessor = '6fdc897851ef23e8c2cf691733ad944a7663242a';\nconst correctionCurrent = Object.freeze({ sha256: 'bae09cba0a3833d53b1f29db1c8462513924eb3e9f0b6373544b9c94304e4aea',\n  blob: 'f14f8b5aee26da0062e5b9be1b8d129df7852a41', bytes: 46593 });\nconst correctionBaseline = Object.freeze({ sha256: 'ca6fd1a86117cf5caf77e43a3518471fc2e804d000de34ee325ceb1c316bb94e',\n  blob: '14e2b55c534ce79715e7916a17891a6c449df0fe', bytes: 7769 });\nconst correctionInverses = Object.freeze(inverseHunks(git('diff', '--no-ext-diff', '--unified=3',\n  correctionPredecessor, correctionRevision, '--', correctionFile)).map(Object.freeze));\nconst correctionBlob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\\0').update(text).digest('hex');\ngit('merge-base', '--is-ancestor', correctionPredecessor, correctionRevision);\ngit('merge-base', '--is-ancestor', correctionRevision, 'HEAD');\nassert.equal(git('show', correctionRevision + ':' + correctionFile), candidateConserved);\nconst correctionStat = fs.lstatSync(correctionFile); assert(correctionStat.isFile() && !correctionStat.isSymbolicLink());\nfor (const [revision, record] of [[correctionRevision, correctionCurrent], [correctionPredecessor, correctionBaseline]])\n  assert.equal(git('ls-tree', revision, '--', correctionFile).trim(), '100644 blob ' + record.blob + '\\t' + correctionFile);\nassert(correctionInverses.length > 0);\nconst restoreCorrectionReader = input => {\n  assert.equal(typeof input, 'string');\n  assert.equal(Buffer.from(input).toString('utf8'), input);\n  assert(!input.startsWith('\\ufeff') && !input.includes('\\0'));\n  const current = input.replaceAll('\\r\\n', '\\n');\n  assert(!current.includes('\\r') && (input === current || input === current.replaceAll('\\n', '\\r\\n')));\n  assert.equal(sha(current), correctionCurrent.sha256); assert.equal(correctionBlob(current), correctionCurrent.blob);\n  assert.equal(Buffer.byteLength(current), correctionCurrent.bytes);\n  let restored = current, end = -1;\n  for (const inverse of correctionInverses) {\n    assert.deepEqual(Object.keys(inverse).sort(), ['baseline', 'current']);\n    assert(inverse.current.length); assert.equal(current.split(inverse.current).length, 2);\n    const at = current.indexOf(inverse.current); assert(at >= end); end = at + inverse.current.length;\n    assert.equal(restored.split(inverse.current).length, 2); restored = restored.replace(inverse.current, () => inverse.baseline);\n  }\n  assert.equal(sha(restored), correctionBaseline.sha256); assert.equal(correctionBlob(restored), correctionBaseline.blob);\n  assert.equal(Buffer.byteLength(restored), correctionBaseline.bytes);\n  assert.equal(restored, git('show', correctionPredecessor + ':' + correctionFile));\n  return restored;\n};\nlet correctionRefusals = 0;\nfor (const current of [candidateConserved, candidateConserved.replaceAll('\\n', '\\r\\n')])\n  assert.equal(restoreCorrectionReader(current), git('show', correctionPredecessor + ':' + correctionFile));\nfor (const changed of [candidateConserved + '\\n// drift\\n', candidateConserved.slice(1), '\\ufeff' + candidateConserved,\n  candidateConserved + '\\0', candidateConserved.replace('\\n', '\\r\\n'), candidateConserved.replace('\\n', '\\r'),\n  Buffer.from(candidateConserved), Buffer.from([0xc3, 0x28]), null]) {\n  assert.throws(() => restoreCorrectionReader(changed)); correctionRefusals++;\n}\nfor (const inverse of correctionInverses) for (const changed of [\n  candidateConserved.replace(inverse.current, ''),\n  candidateConserved.replace(inverse.current, inverse.current + inverse.current),\n  candidateConserved.replace(inverse.current, inverse.baseline),\n  candidateConserved.replace(inverse.current, inverse.current.replace(/\\S/, char => char === '?' ? '!' : '?')),\n]) { assert.throws(() => restoreCorrectionReader(changed)); correctionRefusals++; }\ncandidateConserved = restoreCorrectionReader(correctionPhysical);\nconsole.log(JSON.stringify({ phase: 'EXACT_ECONOMY_MONITOR_CORRECTION_READER_SOURCE_ONLY', source: correctionRevision,\n  predecessor: correctionPredecessor, files: 1, inverseHunks: correctionInverses.length, positives: 2,\n  refusals: correctionRefusals, sourceOnly: true, native: false, runtime: false }));\nfor (const [hook, count] of [[\"import { saleHistoricalInput } from './sale-source-compatibility.js';\\n\", 1], ['  input = saleHistoricalInput(file, input);\\n', 2],\n  [\"import { economyMonitorHistoricalInput } from './economy-monitor-source-transfer.js';\\n\", 1],\n  ['  input = economyMonitorHistoricalInput(file, input);\\n', 2],\n  [\"import { ageEligibilityHistoricalInput } from './age-eligibility-source-transfer.js';\\n\", 1],\n  ['  input = ageEligibilityHistoricalInput(file, input);\\n', 2],\n  [\"import { economyBankInterestHardeningHistoricalInput } from './economy-bank-interest-source-transfer.js';\\n\", 1],\n  ['  input = economyBankInterestHardeningHistoricalInput(file, input);\\n', 2],\n  [\"import { economySocialProofCutoverHistoricalInput } from './economy-social-proof-cutover-source-transfer.js';\\n\", 1],\n",
              "baseline": "  assert.equal(conserved.split(hook).length, 2, 'One exact separately admitted Afterword integration hook'); conserved = conserved.replace(hook, '');\n}\nassert.equal(conserved, git('show', pin.targetRevision + ':tools/ux-source-compatibility.js'), 'All prior historical qualifiers and refusal predicates remain byte-identical');\nlet candidateConserved = deedAllocationHistoricalInput('tools/economy-ux-merge-source-compatibility.js', fs.readFileSync('tools/economy-ux-merge-source-compatibility.js', 'utf8')).replaceAll('\\r\\n', '\\n');\nfor (const [hook, count] of [[\"import { saleHistoricalInput } from './sale-source-compatibility.js';\\n\", 1], ['  input = saleHistoricalInput(file, input);\\n', 2],\n  [\"import { economyBankInterestHardeningHistoricalInput } from './economy-bank-interest-source-transfer.js';\\n\", 1],\n  ['  input = economyBankInterestHardeningHistoricalInput(file, input);\\n', 2],\n  [\"import { economySocialProofCutoverHistoricalInput } from './economy-social-proof-cutover-source-transfer.js';\\n\", 1],\n"
            }
          ]
        }
      }
    },
    {
      "file": "tools/economy-ux-merge-source-compatibility.js",
      "current": {
        "mode": "100644",
        "sha256": "42698fc0941bff85d18a2ba6618582d51d87dd45ea5d308b0a7b91421f5e0d2e",
        "blob": "3e51216a70882421a3ae93553dd10befbd5b453c",
        "bytes": 47265,
        "rawSha256": {
          "lf": "42698fc0941bff85d18a2ba6618582d51d87dd45ea5d308b0a7b91421f5e0d2e",
          "crlf": "c8af283552ce8643b59e58752a21dc8a7694625508772076516c1bebb4cc8b7c"
        }
      },
      "parents": {
        "monitor": {
          "mode": "100644",
          "sha256": "bae09cba0a3833d53b1f29db1c8462513924eb3e9f0b6373544b9c94304e4aea",
          "blob": "f14f8b5aee26da0062e5b9be1b8d129df7852a41",
          "bytes": 46593,
          "inverses": [
            {
              "current": "import { deedAllocationHistoricalInput } from './deed-allocation-source-transfer.js';\nimport { economyDeedMergeHistoricalInput } from './economy-deed-merge-source-compatibility.js';\n// Exact source reconstruction only. Runtime and native checks always use physical current bytes.\nimport assert from 'node:assert/strict';\nimport crypto from 'node:crypto';\n",
              "baseline": "// Exact source reconstruction only. Runtime and native checks always use physical current bytes.\nimport assert from 'node:assert/strict';\nimport crypto from 'node:crypto';\n"
            },
            {
              "current": "  const restored = qualifyEconomyUxMergeSource(file, text, target).baselineText;\n  return buffer ? Buffer.from(restored) : restored;\n}\nexport function economyUxMergeCandidateHistoricalInput(file, input, profile = 'monitor') {\n  input = economyDeedMergeHistoricalInput(file, input, profile);\n  if (profile === 'monitor') input = ageEligibilityHistoricalInput(file, input);\n  input = deedAllocationHistoricalInput(file, input);\n  if (profile === 'deed') input = ageEligibilityHistoricalInput(file, input);\n  input = economyMonitorWorkerHistoricalInput(file, input);\n  input = economyMonitorReaderHistoricalInput(file, input);\n  input = economyMonitorReleaseHistoricalInput(file, input);\n",
              "baseline": "  const restored = qualifyEconomyUxMergeSource(file, text, target).baselineText;\n  return buffer ? Buffer.from(restored) : restored;\n}\nexport function economyUxMergeCandidateHistoricalInput(file, input) {\n  input = ageEligibilityHistoricalInput(file, input);\n  input = economyMonitorWorkerHistoricalInput(file, input);\n  input = economyMonitorReaderHistoricalInput(file, input);\n  input = economyMonitorReleaseHistoricalInput(file, input);\n"
            },
            {
              "current": "  input = saleHistoricalInput(file, input);\n  return historicalInput(file, input, 'candidate');\n}\nexport function economyUxMergeMainHistoricalInput(file, input, profile = 'monitor') {\n  input = economyDeedMergeHistoricalInput(file, input, profile);\n  if (profile === 'monitor') input = ageEligibilityHistoricalInput(file, input);\n  input = deedAllocationHistoricalInput(file, input);\n  if (profile === 'deed') input = ageEligibilityHistoricalInput(file, input);\n  input = economyMonitorWorkerHistoricalInput(file, input);\n  input = economyMonitorReaderHistoricalInput(file, input);\n  input = economyMonitorReleaseHistoricalInput(file, input);\n",
              "baseline": "  input = saleHistoricalInput(file, input);\n  return historicalInput(file, input, 'candidate');\n}\nexport function economyUxMergeMainHistoricalInput(file, input) {\n  input = ageEligibilityHistoricalInput(file, input);\n  input = economyMonitorWorkerHistoricalInput(file, input);\n  input = economyMonitorReaderHistoricalInput(file, input);\n  input = economyMonitorReleaseHistoricalInput(file, input);\n"
            }
          ]
        },
        "deed": {
          "mode": "100644",
          "sha256": "3b9f788b377d16559ca39884e3c4bedd4fe110d3de3711a0181dba255d37065b",
          "blob": "7121c48da85276b7cec7534e88a88b7e5d0fc9da",
          "bytes": 7575,
          "inverses": [
            {
              "current": "import { deedAllocationHistoricalInput } from './deed-allocation-source-transfer.js';\nimport { economyDeedMergeHistoricalInput } from './economy-deed-merge-source-compatibility.js';\n// Exact source reconstruction only. Runtime and native checks always use physical current bytes.\nimport assert from 'node:assert/strict';\nimport crypto from 'node:crypto';\nimport { ECONOMY_UX_MERGE_SOURCE, ECONOMY_UX_MERGE_SOURCE_SHA256 } from './economy-ux-merge-source-data.js';\nimport { saleHistoricalInput } from './sale-source-compatibility.js';\nimport { assertEconomyMonitorSourceTransfer, economyMonitorHistoricalInput } from './economy-monitor-source-transfer.js';\nimport { ageEligibilityHistoricalInput } from './age-eligibility-source-transfer.js';\nimport { economyBankInterestHardeningHistoricalInput } from './economy-bank-interest-source-transfer.js';\nimport { economySocialProofCutoverHistoricalInput } from './economy-social-proof-cutover-source-transfer.js';\nimport { economySocialReceiptSafetyHistoricalInput } from './economy-social-proof-receipt-safety-source-transfer.js';\n",
              "baseline": "import { deedAllocationHistoricalInput } from './deed-allocation-source-transfer.js';\n// Exact source reconstruction only. Runtime and native checks always use physical current bytes.\nimport assert from 'node:assert/strict';\nimport crypto from 'node:crypto';\nimport { ECONOMY_UX_MERGE_SOURCE, ECONOMY_UX_MERGE_SOURCE_SHA256 } from './economy-ux-merge-source-data.js';\nimport { saleHistoricalInput } from './sale-source-compatibility.js';\nimport { economyBankInterestHardeningHistoricalInput } from './economy-bank-interest-source-transfer.js';\nimport { economySocialProofCutoverHistoricalInput } from './economy-social-proof-cutover-source-transfer.js';\nimport { economySocialReceiptSafetyHistoricalInput } from './economy-social-proof-receipt-safety-source-transfer.js';\n"
            },
            {
              "current": "  assert(!text.includes('\\r') && (input === text || input === text.replaceAll('\\n', '\\r\\n')), 'Uniform whole LF/CRLF only');\n  return text;\n};\n// Exact successor admissions for safe()/null, the private constant, CI wiring and child listeners. The\n// published monitor envelope remains unchanged: only these complete physical bytes reconstruct\n// their 9000f2af sources, checked by the original frozen monitor transfer before chaining.\nexport const ECONOMY_MONITOR_WORKER_SOURCE = Object.freeze({\n  file: 'src/worker.js', sourceRevision: 'fd9ba2014cf7ceb42a7b155bf94a208f9992cfea',\n  predecessorRevision: '9000f2afaf4640e018b2d4026fb7b1ff984a8257',\n  currentSha256: '8461ccc60c86ccadcda3c2820a9026f8eadacebdd201355f23b09e4b646f38f9',\n  currentBlob: '6e0eb2656fb6c815908ddf722a4e8a89dc75f3d2', currentBytes: 87275,\n  occurrences: 1,\n  current: \"      const summary = await safe('economy monitor', () => runEconomyMonitor(pool, { alert: alertDrift }));\\n      if (summary) console.log('[economy monitor]', JSON.stringify(summary));\\n\",\n  baseline: \"      const summary = await runEconomyMonitor(pool, { alert: alertDrift });\\n      console.log('[economy monitor]', JSON.stringify(summary));\\n\",\n});\nexport const ECONOMY_MONITOR_READER_SOURCE = Object.freeze({\n  file: 'src/economy-monitor.js', sourceRevision: '9da329e2be042a105b78c6df089c5c88a4f8ba1f',\n  predecessorRevision: '9000f2afaf4640e018b2d4026fb7b1ff984a8257',\n  currentSha256: '2f08e91725b6692a9c846f1528ca099e2ace7461ed29b6d14ae663f4a923095a',\n  currentBlob: 'c8fad52af8b3f1ea1d2863bbb85edd2a5e09102a', currentBytes: 16574,\n  current: 'COLUMNS', baseline: 'columns', occurrences: 3,\n});\nexport const ECONOMY_MONITOR_RELEASE_SOURCES = Object.freeze({\n  '.github/workflows/economy-hardening.yml': Object.freeze({\n    file: '.github/workflows/economy-hardening.yml', sourceRevision: '9a5c784034a9f543cd32e27fd0b73a23e332ee5b',\n    predecessorRevision: '9000f2afaf4640e018b2d4026fb7b1ff984a8257',\n    currentSha256: '1551813fbb50fb14a3bd9690e5d0d62f09b1605ea4e582612cade095514a57ad',\n    currentBlob: '18d9875f1112661aa57148d7f9c7704d4958bb93', currentBytes: 5425,\n    current: '          node test/age-eligibility-source-compatibility.js &&\\n          node test/economy-monitor-source-compatibility.js &&\\n',\n    baseline: '', occurrences: 1,\n  }),\n  'test/gates.js': Object.freeze({\n    file: 'test/gates.js', sourceRevision: '9a5c784034a9f543cd32e27fd0b73a23e332ee5b',\n    predecessorRevision: '6fdc897851ef23e8c2cf691733ad944a7663242a',\n    currentSha256: 'a30914836d5d503aaf0114a5634e183dfec43a0a9c1c799692e2644612d581f8',\n    currentBlob: 'a0a4551b721073b1eb33780e3702cd0b8fde6813', currentBytes: 461700,\n    baselineSha256: '727b8cfba27ab2b1a69dedaa43aa5d289a09d91aeb27be5f66e87d744f1f4a12',\n    baselineBlob: '238e7a38313f54fd09d82df4dedb9a574f04243d', baselineBytes: 461461,\n    current: \"    'test/economy-composition-restart.js': 'Fresh-process child probe executed by the required native economy-composition suite; it requires an owned disposable PostgreSQL schema and bounded synthetic stdin, so it cannot run standalone.',\\n\",\n    baseline: '', occurrences: 1,\n  }),\n  'test/economy-composition.js': Object.freeze({\n    file: 'test/economy-composition.js', sourceRevision: 'b5155c297f9ab4d097ca4cba1e3ef86babaa449e',\n    predecessorRevision: '9000f2afaf4640e018b2d4026fb7b1ff984a8257',\n    currentSha256: '20d42640e5f750f6abc35d7631024a132ad56f375e48b268827fb704c55b7022',\n    currentBlob: '7f8426a3f112703709e08b8a1b2546c2d72a7896', currentBytes: 21633,\n    current: \"  const child = spawn(process.execPath, [fileURLToPath(new URL('./economy-composition-restart.js', import.meta.url))],\\n    { env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });\\n  const exited = new Promise((resolve, reject) => {\\n    child.once('error', reject); child.once('close', resolve);\\n  });\\n  let stdout = '', stderr = '';\\n  const timeout = setTimeout(() => child.kill(), 90_000); timeout.unref();\\n  child.stdout.on('data', chunk => { stdout += chunk; });\\n  child.stderr.on('data', chunk => { stderr += chunk; });\\n  child.stdin.end(JSON.stringify({ ...probe, wall }));\\n  try {\\n    const exitCode = await exited;\\n\",\n    baseline: \"  const child = spawn(process.execPath, [fileURLToPath(new URL('./economy-composition-restart.js', import.meta.url))],\\n    { env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });\\n  let stdout = '', stderr = '';\\n  const timeout = setTimeout(() => child.kill(), 90_000); timeout.unref();\\n  child.stdout.on('data', chunk => { stdout += chunk; });\\n  child.stderr.on('data', chunk => { stderr += chunk; });\\n  child.stdin.end(JSON.stringify({ ...probe, wall }));\\n  try {\\n    const exitCode = await new Promise((resolve, reject) => {\\n      child.once('error', reject); child.once('close', resolve);\\n    });\\n\", occurrences: 1,\n  }),\n  \"tools/ux-release-phase2-native-catalog.js\": Object.freeze({\n    \"file\": \"tools/ux-release-phase2-native-catalog.js\",\n    \"sourceRevision\": \"5d364a6aa6ff1f5e90a56b056ccc7974c8e4a1f0\",\n    \"predecessorRevision\": \"6fdc897851ef23e8c2cf691733ad944a7663242a\",\n    \"currentSha256\": \"fccef92e9a633a8edad3fe543a47bcd9e852d88cbb354b1f19330a0940d26e9a\",\n    \"currentBlob\": \"03f00b1d21988ff978d8196c8429ef21ba8c5360\",\n    \"currentBytes\": 25797,\n    \"baselineSha256\": \"4c122b2439ef19868259a0b6dbc7cb29d4539c6098ef7e5289703c32d1687fd9\",\n    \"baselineBlob\": \"38dc31de8b9d30cdfd359b6bf8f5cfa02ad1925e\",\n    \"baselineBytes\": 22713,\n    \"contextLines\": 3,\n    inverses: Object.freeze([\n  {\n    \"current\": \"  ? row.table_name === socialBridgeTable && socialExtensionColumns.has(row.column_name)\\n  : field === 'constraints' && row.table_name === socialBridgeTable && row.name === socialBridgeConstraint;\\nconst socialBridgeRows = (metadata, field) => metadata[field].filter(row => isSocialBridgeRow(field, row));\\nconst monitorIndexName = 'ix_tx_at_id';\\nconst isMonitorIndexRow = (field, row) => field === 'indexes' && row.table_name === 'transactions' && row.name === monitorIndexName;\\nconst monitorRows = (metadata, field) => metadata[field].filter(row => isMonitorIndexRow(field, row));\\nconst freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };\\n// Keep the original engine's exact predecessor order; insert the existing-table bridge at its exact\\n// catalog anchors, then retain the reviewed UX append order. No collation normalization is introduced.\\nconst merge = (base, socialBridge, ux, monitor) => {\\n  const merged = Object.fromEntries(fields.map(field => [field, [...base[field]]]));\\n  assert.equal(socialBridge.columns.length, 2); assert(socialBridge.constraints.length <= 1);\\n  assert.deepEqual(socialBridge.columns.map(row => row.column_name),\\n\",\n    \"baseline\": \"  ? row.table_name === socialBridgeTable && socialExtensionColumns.has(row.column_name)\\n  : field === 'constraints' && row.table_name === socialBridgeTable && row.name === socialBridgeConstraint;\\nconst socialBridgeRows = (metadata, field) => metadata[field].filter(row => isSocialBridgeRow(field, row));\\nconst freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };\\n// Keep the original engine's exact predecessor order; insert the existing-table bridge at its exact\\n// catalog anchors, then retain the reviewed UX append order. No collation normalization is introduced.\\nconst merge = (base, socialBridge, ux) => {\\n  const merged = Object.fromEntries(fields.map(field => [field, [...base[field]]]));\\n  assert.equal(socialBridge.columns.length, 2); assert(socialBridge.constraints.length <= 1);\\n  assert.deepEqual(socialBridge.columns.map(row => row.column_name),\\n\"\n  },\n  {\n    \"current\": \"    merged.constraints.splice(constraintAt, 0, ...socialBridge.constraints);\\n  }\\n  for (const field of fields) merged[field].push(...ux[field]);\\n  const indexAt = merged.indexes.findIndex(row => row.table_name === 'transactions' && row.name === 'ix_tx_character');\\n  assert(indexAt >= 0, 'The monitor index precedes the exact predecessor transaction index');\\n  merged.indexes.splice(indexAt, 0, ...monitor.indexes);\\n  return freeze(merged);\\n};\\n\\n\",\n    \"baseline\": \"    merged.constraints.splice(constraintAt, 0, ...socialBridge.constraints);\\n  }\\n  for (const field of fields) merged[field].push(...ux[field]);\\n  return freeze(merged);\\n};\\n\\n\"\n  },\n  {\n    \"current\": \"  }\\n  assert.equal(settings.role, address.username); assert.equal('/' + settings.database, address.pathname);\\n}\\nasync function projectedCaller(pool, ux, socialBridge, monitor) {\\n  const uxProjection = uxNativeProjection(ux), socialBridgeProjection = socialLegacyBridgeProjection(socialBridge),\\n    monitorProjection = monitorNativeProjection(monitor);\\n  const projectMetadata = metadata => monitorProjection.projectMetadata(socialBridgeProjection.projectMetadata(uxProjection.projectMetadata(metadata)));\\n  const context = (await pool.query(catalogQueries[0])).rows[0];\\n  const verify = async () => { projectMetadata(await original.readCommerceReleasePhase2Metadata(pool)); await assertUxNativeSecurity(pool); };\\n  await verify();\\n\",\n    \"baseline\": \"  }\\n  assert.equal(settings.role, address.username); assert.equal('/' + settings.database, address.pathname);\\n}\\nasync function projectedCaller(pool, ux, socialBridge) {\\n  const uxProjection = uxNativeProjection(ux), socialBridgeProjection = socialLegacyBridgeProjection(socialBridge);\\n  const projectMetadata = metadata => socialBridgeProjection.projectMetadata(uxProjection.projectMetadata(metadata));\\n  const context = (await pool.query(catalogQueries[0])).rows[0];\\n  const verify = async () => { projectMetadata(await original.readCommerceReleasePhase2Metadata(pool)); await assertUxNativeSecurity(pool); };\\n  await verify();\\n\"\n  },\n  {\n    \"current\": \"    assert.deepEqual(selected, ux[field], 'Every fresh projected SQL result retains the complete UX ' + field);\\n    assert.deepEqual(socialBridgeRows({ [field]: result.rows }, field), socialBridge[field],\\n      'Every fresh projected SQL result retains the exact social bridge ' + field);\\n    const monitorSelected = monitorRows({ [field]: result.rows }, field).map(row => {\\n      const prefix = ' ON ' + context.schema + '.'; assert.equal(row.definition.split(prefix).length, 2);\\n      return { ...row, definition: row.definition.replace(prefix, ' ON $self.') };\\n    });\\n    assert.deepEqual(monitorSelected, monitor[field], 'Every fresh projected SQL result retains the exact monitor ' + field);\\n    if (guarded) await assertUxNativeSecurity(pool);\\n    return { ...result, rows: result.rows.filter(row => !names.has(tableOf(field, row)) && !isSocialBridgeRow(field, row) && !isMonitorIndexRow(field, row)) };\\n  } });\\n  return { ...wrap(pool, true), connect: async () => {\\n    const client = await pool.connect();\\n\",\n    \"baseline\": \"    assert.deepEqual(selected, ux[field], 'Every fresh projected SQL result retains the complete UX ' + field);\\n    assert.deepEqual(socialBridgeRows({ [field]: result.rows }, field), socialBridge[field],\\n      'Every fresh projected SQL result retains the exact social bridge ' + field);\\n    if (guarded) await assertUxNativeSecurity(pool);\\n    return { ...result, rows: result.rows.filter(row => !names.has(tableOf(field, row)) && !isSocialBridgeRow(field, row)) };\\n  } });\\n  return { ...wrap(pool, true), connect: async () => {\\n    const client = await pool.connect();\\n\"\n  },\n  {\n    \"current\": \"    const settings = (await client.query('SELECT current_schema() AS schema,current_database() AS database,current_user AS role')).rows[0];\\n    const parent = (await pool.query('SELECT current_database() AS database,current_user AS role')).rows[0];\\n    assert.equal(settings.schema, schema); assert.equal(settings.database, parent.database); assert.equal(settings.role, parent.role);\\n    // Compile the monitor index independently of schema.sql and the migrated caller. Only this\\n    // exact additive index is projected from the unchanged predecessor's complete catalog proof.\\n    await client.query(socialBridgeDdl + '\\\\n' + uxDdl + '\\\\nCREATE TABLE transactions (at TIMESTAMPTZ, id TEXT);\\\\nCREATE INDEX ix_tx_at_id ON transactions (at, id);');\\n    const reference = await original.readCommerceReleasePhase2Metadata(client);\\n    assert.deepEqual(reference.relations.map(row => row.name), [socialBridgeTable, 'transactions', ...UX_NATIVE_TABLES],\\n      'Independent immutable DDL creates exactly the social bridge, monitor fixture and seven UX tables');\\n    const ux = Object.fromEntries(fields.map(field => [field, uxRows(reference, field)]));\\n    assert.deepEqual(ux.relations.map(row => row.name), UX_NATIVE_TABLES, 'Independent immutable DDL creates exactly the seven UX tables');\\n    const socialBridge = Object.fromEntries(fields.map(field => [field, socialBridgeRows(reference, field)]));\\n\",\n    \"baseline\": \"    const settings = (await client.query('SELECT current_schema() AS schema,current_database() AS database,current_user AS role')).rows[0];\\n    const parent = (await pool.query('SELECT current_database() AS database,current_user AS role')).rows[0];\\n    assert.equal(settings.schema, schema); assert.equal(settings.database, parent.database); assert.equal(settings.role, parent.role);\\n    await client.query(socialBridgeDdl + '\\\\n' + uxDdl);\\n    const reference = await original.readCommerceReleasePhase2Metadata(client);\\n    assert.deepEqual(reference.relations.map(row => row.name), [socialBridgeTable, ...UX_NATIVE_TABLES],\\n      'Independent immutable DDL creates exactly the social bridge fixture and seven UX tables');\\n    const ux = Object.fromEntries(fields.map(field => [field, uxRows(reference, field)]));\\n    assert.deepEqual(ux.relations.map(row => row.name), UX_NATIVE_TABLES, 'Independent immutable DDL creates exactly the seven UX tables');\\n    const socialBridge = Object.fromEntries(fields.map(field => [field, socialBridgeRows(reference, field)]));\\n\"\n  },\n  {\n    \"current\": \"      referenced_schema: null, referenced_table: null, columns: [socialBridgeColumn], referenced_columns: [] }],\\n    'PostgreSQL 18 exposes the exact generated social bridge NOT NULL catalog row');\\n    assert.equal(socialBridge.relations.length + socialBridge.indexes.length, 0, 'The social bridge adds no relation or index');\\n    const monitor = Object.fromEntries(fields.map(field => [field, monitorRows(reference, field)]));\\n    assert.deepEqual(monitor.indexes, [{ table_name: 'transactions', name: monitorIndexName,\\n      definition: 'CREATE INDEX ix_tx_at_id ON $self.transactions USING btree (at, id)',\\n      unique: false, primary: false, valid: true, ready: true, live: true, nulls_not_distinct: false, predicate: null }],\\n    'Independent fixed DDL compiles the exact complete monitor index catalog row');\\n    return freeze({ ux, socialBridge, monitor });\\n  } finally {\\n    await client?.end();\\n    if (created) {\\n\",\n    \"baseline\": \"      referenced_schema: null, referenced_table: null, columns: [socialBridgeColumn], referenced_columns: [] }],\\n    'PostgreSQL 18 exposes the exact generated social bridge NOT NULL catalog row');\\n    assert.equal(socialBridge.relations.length + socialBridge.indexes.length, 0, 'The social bridge adds no relation or index');\\n    return freeze({ ux, socialBridge });\\n  } finally {\\n    await client?.end();\\n    if (created) {\\n\"\n  },\n  {\n    \"current\": \"  };\\n  return Object.freeze({ projectMetadata, projectConstraints });\\n}\\nexport function monitorNativeProjection(reference) {\\n  reference = freeze(structuredClone(reference));\\n  assert.equal(reference.relations.length + reference.columns.length + reference.constraints.length, 0);\\n  assert.equal(reference.indexes.length, 1);\\n  assert(isMonitorIndexRow('indexes', reference.indexes[0]));\\n  const projectMetadata = metadata => {\\n    for (const field of fields) assert.deepEqual(monitorRows(metadata, field), reference[field],\\n      'Exact independently compiled monitor ' + field);\\n    return Object.fromEntries(fields.map(field => [field, metadata[field].filter(row => !isMonitorIndexRow(field, row))]));\\n  };\\n  return Object.freeze({ projectMetadata });\\n}\\nfunction extendCatalog(prior, ux, socialBridge, monitor, branches = false) {\\n  const uxProjection = uxNativeProjection(ux), socialBridgeProjection = socialLegacyBridgeProjection(socialBridge),\\n    monitorProjection = monitorNativeProjection(monitor),\\n    projectMetadata = metadata => monitorProjection.projectMetadata(socialBridgeProjection.projectMetadata(uxProjection.projectMetadata(metadata))),\\n    base = branches ? prior.current : prior.reference, reference = merge(base, socialBridge, ux, monitor);\\n  const verifyMetadata = metadata => (branches ? prior.verify : prior.verifyMetadata)(projectMetadata(metadata));\\n  verifyMetadata(reference);\\n  const causal = { socialBridge: 0, socialProofContract: 0, ux: 0, monitor: 0 };\\n  assert.throws(() => { reference.columns.push({}); }, TypeError);\\n  for (const [label, extension, makeProjection] of [\\n    ['socialBridge', socialBridge, socialLegacyBridgeProjection], ['ux', ux, uxNativeProjection],\\n    ['monitor', monitor, monitorNativeProjection],\\n  ]) {\\n    const field = fields.find(field => extension[field].length), key = Object.keys(extension[field][0])[0];\\n    assert.throws(() => { extension[field][0][key] = 'tampered'; }, TypeError);\\n    const retained = structuredClone(extension), independent = makeProjection(retained);\\n    retained[field][0][key] = 'tampered';\\n    const integrated = merge(base, label === 'socialBridge' ? retained : socialBridge,\\n      label === 'ux' ? retained : ux, label === 'monitor' ? retained : monitor);\\n    assert.throws(() => independent.projectMetadata(integrated), error => error?.code === 'ERR_ASSERTION'); causal[label]++;\\n  }\\n  verifyMetadata(reference);\\n  for (const [label, extension] of [['socialBridge', socialBridge], ['ux', ux], ['monitor', monitor]]) {\\n    for (const field of fields) for (const row of extension[field]) {\\n      const causalLabel = label === 'socialBridge' && field === 'columns'\\n        && row.column_name === socialProofContractColumn ? 'socialProofContract' : label;\\n\",\n    \"baseline\": \"  };\\n  return Object.freeze({ projectMetadata, projectConstraints });\\n}\\nfunction extendCatalog(prior, ux, socialBridge, branches = false) {\\n  const uxProjection = uxNativeProjection(ux), socialBridgeProjection = socialLegacyBridgeProjection(socialBridge),\\n    projectMetadata = metadata => socialBridgeProjection.projectMetadata(uxProjection.projectMetadata(metadata)),\\n    base = branches ? prior.current : prior.reference, reference = merge(base, socialBridge, ux);\\n  const verifyMetadata = metadata => (branches ? prior.verify : prior.verifyMetadata)(projectMetadata(metadata));\\n  verifyMetadata(reference);\\n  const causal = { socialBridge: 0, socialProofContract: 0, ux: 0 };\\n  assert.throws(() => { reference.columns.push({}); }, TypeError);\\n  for (const [label, extension, makeProjection] of [\\n    ['socialBridge', socialBridge, socialLegacyBridgeProjection], ['ux', ux, uxNativeProjection],\\n  ]) {\\n    assert.throws(() => { extension.columns[0].type = 'tampered'; }, TypeError);\\n    const retained = structuredClone(extension), independent = makeProjection(retained);\\n    retained.columns[0].type = 'tampered';\\n    const integrated = label === 'socialBridge' ? merge(base, retained, ux) : merge(base, socialBridge, retained);\\n    assert.throws(() => independent.projectMetadata(integrated), error => error?.code === 'ERR_ASSERTION'); causal[label]++;\\n  }\\n  verifyMetadata(reference);\\n  for (const [label, extension] of [['socialBridge', socialBridge], ['ux', ux]]) {\\n    for (const field of fields) for (const row of extension[field]) {\\n      const causalLabel = label === 'socialBridge' && field === 'columns'\\n        && row.column_name === socialProofContractColumn ? 'socialProofContract' : label;\\n\"\n  },\n  {\n    \"current\": \"    'Proof-contract missing, duplicate and every-field mutations are all refused');\\n  const common = { ...prior, reference, verifyMetadata, socialBridgeReference: socialBridge,\\n    socialBridgeCausal: causal.socialBridge, socialProofContractCausal: causal.socialProofContract,\\n    uxReference: ux, uxSource: UX_SOURCE.revision, uxCausal: causal.ux,\\n    monitorReference: monitor, monitorCausal: causal.monitor };\\n  if (branches) return Object.freeze({ ...common, current: reference, verify: verifyMetadata });\\n  return Object.freeze({ ...common, normalize: rows => prior.normalize(socialBridgeProjection.projectConstraints(\\n    uxProjection.projectConstraints(rows, prior.includeNotNull), prior.includeNotNull)) });\\n\",\n    \"baseline\": \"    'Proof-contract missing, duplicate and every-field mutations are all refused');\\n  const common = { ...prior, reference, verifyMetadata, socialBridgeReference: socialBridge,\\n    socialBridgeCausal: causal.socialBridge, socialProofContractCausal: causal.socialProofContract,\\n    uxReference: ux, uxSource: UX_SOURCE.revision, uxCausal: causal.ux };\\n  if (branches) return Object.freeze({ ...common, current: reference, verify: verifyMetadata });\\n  return Object.freeze({ ...common, normalize: rows => prior.normalize(socialBridgeProjection.projectConstraints(\\n    uxProjection.projectConstraints(rows, prior.includeNotNull), prior.includeNotNull)) });\\n\"\n  },\n  {\n    \"current\": \"export async function createCommerceReleasePhase2MigrationCatalog(pool, endpoint, input, options) {\\n  const { candidate } = integratedSchemaSources(input);\\n  await assertNativeCaller(pool, endpoint, options?.legacyProfile, options?.includeNotNull);\\n  const { ux, socialBridge, monitor } = await compileCurrentExtensionReference(pool, endpoint);\\n  const prior = await original.createCommerceReleasePhase2MigrationCatalog(\\n    await projectedCaller(pool, ux, socialBridge, monitor), endpoint, candidate, options);\\n  return extendCatalog(prior, ux, socialBridge, monitor);\\n}\\nexport async function verifyCommerceNativeBranches(pool, endpoint) {\\n  await assertNativeCaller(pool, endpoint, 'fresh', true);\\n  const { candidate } = integratedSchemaSources(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));\\n  const { ux, socialBridge, monitor } = await compileCurrentExtensionReference(pool, endpoint);\\n  const prior = await original.verifyCommerceNativeBranches(\\n    await projectedCaller(pool, ux, socialBridge, monitor), endpoint, candidate);\\n  return extendCatalog(prior, ux, socialBridge, monitor, true);\\n}\\n\",\n    \"baseline\": \"export async function createCommerceReleasePhase2MigrationCatalog(pool, endpoint, input, options) {\\n  const { candidate } = integratedSchemaSources(input);\\n  await assertNativeCaller(pool, endpoint, options?.legacyProfile, options?.includeNotNull);\\n  const { ux, socialBridge } = await compileCurrentExtensionReference(pool, endpoint);\\n  const prior = await original.createCommerceReleasePhase2MigrationCatalog(\\n    await projectedCaller(pool, ux, socialBridge), endpoint, candidate, options);\\n  return extendCatalog(prior, ux, socialBridge);\\n}\\nexport async function verifyCommerceNativeBranches(pool, endpoint) {\\n  await assertNativeCaller(pool, endpoint, 'fresh', true);\\n  const { candidate } = integratedSchemaSources(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));\\n  const { ux, socialBridge } = await compileCurrentExtensionReference(pool, endpoint);\\n  const prior = await original.verifyCommerceNativeBranches(\\n    await projectedCaller(pool, ux, socialBridge), endpoint, candidate);\\n  return extendCatalog(prior, ux, socialBridge, true);\\n}\\n\"\n  }\n].map(Object.freeze)),\n  }),\n  \"tools/pgquery.js\": Object.freeze({\n    \"file\": \"tools/pgquery.js\",\n    \"sourceRevision\": \"29d6861f44bf281182ea55880d4262aaa4cfb8d1\",\n    \"predecessorRevision\": \"6fdc897851ef23e8c2cf691733ad944a7663242a\",\n    \"currentSha256\": \"0676e31ece6b2412bef8b3a5f3e4e8cba35f149d822488dcf1cd0620a2bcead9\",\n    \"currentBlob\": \"60d7d486af4104d12304ed3871ef7e3d391461d0\",\n    \"currentBytes\": 41576,\n    \"baselineSha256\": \"ed8d93ce2c634c861af924270ea77b26ab77d3e5e34a3d7cb24e84d06540d311\",\n    \"baselineBlob\": \"db503b17b08439bcbd36aacc4deae0b8a1907c53\",\n    \"baselineBytes\": 35419,\n    \"contextLines\": 3,\n    inverses: Object.freeze([\n  {\n    \"current\": \"  return variants;\\n}\\n\\n// The monitor's private readRows dispatcher has exactly two closed callers; its daily SELECT\\n// interpolates only one fixed column list. Pin the complete caller authority and scanner corpus,\\n// then capture the actual exported monitor at both row-limit extremes and UTC boundaries. None of\\n// these three statements needs an unchecked-query allowance: dates, sources and limits stay bound.\\nasync function modelEconomyMonitorQueries(rows, dynamicSites) {\\n  const rel = 'src/economy-monitor.js';\\n  const sourcePin = '2f08e91725b6692a9c846f1528ca099e2ace7461ed29b6d14ae663f4a923095a';\\n  const verifySource = raw => {\\n    const lf = canonicalSql(raw);\\n    if (lf.includes('\\\\r') || (raw !== lf && raw !== lf.replaceAll('\\\\n', '\\\\r\\\\n'))\\n        || createHash('sha256').update(lf).digest('hex') !== sourcePin)\\n      throw new Error('economy monitor source changed; review its complete closed SQL model');\\n  };\\n  const source = readFileSync(path.join(ROOT, rel), 'utf8');\\n  verifySource(source);\\n  let mutationRejected = false;\\n  try { verifySource(source + ' '); }\\n  catch (error) {\\n    if (!error.message.includes('source changed')) throw error;\\n    mutationRejected = true;\\n  }\\n  if (!mutationRejected) throw new Error('economy monitor SQL model accepted mutated source');\\n\\n  const checkpoint = \\\"SELECT props FROM telemetry WHERE event='economy_monitor' ORDER BY at DESC,id DESC LIMIT 1\\\";\\n  const insert = 'INSERT INTO telemetry (id,event,props,at) VALUES ($1,$2,$3,$4)';\\n  const dailyTemplate = `SELECT  FROM transactions t LEFT JOIN characters c ON c.id=t.character_id\\n      WHERE t.at >= $1 AND t.at <= $2 AND t.currency=$3 AND t.reason=$4\\n      ORDER BY t.at DESC,t.id DESC LIMIT $5`;\\n  const expectedReadable = [[rel, checkpoint, []], [rel, dailyTemplate, ['COLUMNS']], [rel, insert, []]];\\n  const monitorRows = rows.filter(row => row.rel === rel);\\n  if (JSON.stringify(monitorRows.map(scannerSignature))\\n      !== JSON.stringify(expectedReadable.map(([rel, sql, parts]) => scannerSignature({ rel, sql, parts }))))\\n    throw new Error('economy monitor readable SQL call sites changed');\\n  const helperSites = dynamicSites.filter(row => row.rel === rel);\\n  if (helperSites.length !== 1 || helperSites[0].where !== rel + ':139')\\n    throw new Error('economy monitor private SQL dispatcher changed');\\n  const dailyRow = monitorRows[1], helper = helperSites[0];\\n  const shapes = new Map(['recent', 'daily', 'bounds'].map(name => [name, new Set()]));\\n  const { runEconomyMonitor } = await import('../src/economy-monitor.js');\\n  for (const rowLimit of [1, 50000]) for (const instant of ['2026-10-31T23:59:59.999Z', '2026-11-01T00:00:00.000Z']) {\\n    const now = new Date(instant), calls = [];\\n    const client = { query: async (sql, params) => {\\n      if (typeof sql !== 'string') throw new Error('economy monitor model captured non-string SQL');\\n      calls.push(sql);\\n      if (sql === checkpoint) {\\n        if (params !== undefined) throw new Error('economy monitor checkpoint acquired unmodeled parameters');\\n        return { rows: [] };\\n      }\\n      if (sql === insert) {\\n        if (!Array.isArray(params) || params.length !== 4 || params[1] !== 'economy_monitor'\\n            || +params[3] !== +now)\\n          throw new Error('economy monitor summary INSERT changed its bound values');\\n        return { rows: [] };\\n      }\\n      const kind = sql.includes('FROM transactions t')\\n        ? (sql.includes('t.currency=$3 AND t.reason=$4') ? 'daily' : 'recent')\\n        : sql.includes(\\\"event='economy_payout_bound'\\\") ? 'bounds' : null;\\n      if (!kind) throw new Error('economy monitor model captured an unknown dispatcher query');\\n      const count = kind === 'daily' ? 5 : 3;\\n      const placeholders = [...sql.matchAll(/\\\\$(\\\\d+)/g)].map(match => Number(match[1]));\\n      if (!Array.isArray(params) || params.length !== count || placeholders.length !== count\\n          || placeholders.some((placeholder, index) => placeholder !== index + 1)\\n          || !(params[0] instanceof Date) || +params[1] !== +now || params.at(-1) !== rowLimit + 1)\\n        throw new Error('economy monitor model did not retain dates and limit as separate bound values');\\n      if (kind === 'daily' && (!['cash', 'omr'].includes(params[2]) || typeof params[3] !== 'string'))\\n        throw new Error('economy monitor daily source values are not bound');\\n      shapes.get(kind).add(sql);\\n      return { rows: [] };\\n    } };\\n    const summary = await runEconomyMonitor(client, { now, rowLimit, ledgerRowsWarn: 1000,\\n      netCashWarn: 10000000, netOmrWarn: 1000 });\\n    if (!summary.ok || calls.length !== summary.dailySources.length + 4\\n        || calls[0] !== checkpoint || calls.at(-1) !== insert)\\n      throw new Error('economy monitor model did not execute its complete closed query path');\\n  }\\n  if ([...shapes.values()].some(set => set.size !== 1))\\n    throw new Error('economy monitor dates or row limits changed a closed SQL shape');\\n  return { variants: new Map([[dailyRow, [...shapes.get('daily')]]]),\\n    helper, helperSql: [...shapes.get('recent'), ...shapes.get('bounds')] };\\n}\\n\\nlet modeledQueries;\\nlet monitorModel;\\ntry {\\n  modeledQueries = await modelSocialReceiptQueries(readable);\\n  monitorModel = await modelEconomyMonitorQueries(readable, unreadableSites);\\n  for (const [site, sql] of monitorModel.variants) modeledQueries.set(site, sql);\\n} catch (error) {\\n  console.error('pgquery refused bounded runtime query model: ' + error.message);\\n  process.exit(1);\\n}\\nlet modeledSites = 0, modeledVariants = 0;\\n\",\n    \"baseline\": \"  return variants;\\n}\\n\\nlet modeledQueries;\\ntry {\\n  modeledQueries = await modelSocialReceiptQueries(readable);\\n} catch (error) {\\n  console.error('pgquery refused bounded social-receipt query model: ' + error.message);\\n  process.exit(1);\\n}\\nlet modeledSites = 0, modeledVariants = 0;\\n\"\n  },\n  {\n    \"current\": \"  if (!DML.test(got.sql)) { skipped.push(got.where); continue; }\\n  stmts.push({ where: got.where, sql: got.sql });\\n}\\nif (modeledSites !== 8 || modeledVariants !== 3012) {\\n  console.error(`pgquery bounded interpolated models classified ${modeledSites} sites/${modeledVariants} variants (expected 8/3012)`);\\n  process.exit(1);\\n}\\nconst monitorHelperIndex = unreadable.indexOf(monitorModel.helper.where);\\nif (monitorHelperIndex < 0 || monitorModel.helperSql.length !== 2)\\n  throw new Error('economy monitor modeled dispatcher is not in the unchecked corpus exactly once');\\nunreadable.splice(monitorHelperIndex, 1);\\nfor (let i = 0; i < monitorModel.helperSql.length; i++)\\n  stmts.push({ where: `${monitorModel.helper.where} [closed dispatcher ${i + 1}/2]`, sql: monitorModel.helperSql[i] });\\n\\n// These four Commerce sites stay counted/listed as UNPREPARED. Whole-source pins close the\\n// caller/column authority: a 23-column INSERT with bound values; the forward/undo UPDATE over\\n\",\n    \"baseline\": \"  if (!DML.test(got.sql)) { skipped.push(got.where); continue; }\\n  stmts.push({ where: got.where, sql: got.sql });\\n}\\nif (modeledSites !== 7 || modeledVariants !== 3011) {\\n  console.error(`pgquery bounded social-receipt model classified ${modeledSites} sites/${modeledVariants} variants (expected 7/3011)`);\\n  process.exit(1);\\n}\\n\\n// These four Commerce sites stay counted/listed as UNPREPARED. Whole-source pins close the\\n// caller/column authority: a 23-column INSERT with bound values; the forward/undo UPDATE over\\n\"\n  },\n  {\n    \"current\": \"// ── 3. REPORT ────────────────────────────────────────────────────────────────────────────────────\\nconsole.log(`\\\\npgquery — ${stmts.length} static/bounded statements prepared against real Postgres`);\\nconsole.log(`  ${modeledVariants} generated variants from ${modeledSites} interpolated sites were materialized and prepared`);\\nconsole.log('  2 closed SELECT shapes from the economy monitor non-literal dispatcher were captured and prepared');\\nconsole.log(`  ${interpolated.length} interpolated (cannot be prepared — counted, never silently passed; PGQUERY_LIST=1 to list)`);\\nconsole.log(`  ${skipped.length} non-DML (DDL / transaction control — not preparable by design)`);\\nconsole.log(`  ${unreadable.length} call sites whose argument is not a literal (a variable or a helper)\\\\n`);\\n\",\n    \"baseline\": \"// ── 3. REPORT ────────────────────────────────────────────────────────────────────────────────────\\nconsole.log(`\\\\npgquery — ${stmts.length} static/bounded statements prepared against real Postgres`);\\nconsole.log(`  ${modeledVariants} generated variants from ${modeledSites} interpolated sites were materialized and prepared`);\\nconsole.log(`  ${interpolated.length} interpolated (cannot be prepared — counted, never silently passed; PGQUERY_LIST=1 to list)`);\\nconsole.log(`  ${skipped.length} non-DML (DDL / transaction control — not preparable by design)`);\\nconsole.log(`  ${unreadable.length} call sites whose argument is not a literal (a variable or a helper)\\\\n`);\\n\"\n  },\n  {\n    \"current\": \"// bounded model above invokes their real runtime generators, materializes every admitted cardinality\\n// and closed branch (3,011 statements), and PREPAREs each one. Exact scanner signatures and runtime\\n// cap assertions fail closed on drift; the pre-R6 measured interpolated corpus therefore remains 172.\\n// Economy monitoring adds one fixed-column interpolation and a two-caller private dispatcher. The\\n// pinned runtime model above captures and PREPAREs all three shapes instead of consuming new\\n// unchecked-query room. Its one non-literal dispatcher is removed only after that complete model\\n// succeeds; the 44-site non-literal ceiling is unchanged.\\nconst CEILING = { interpolated: 173, unreadable: 44 };\\nconst overflow = [];\\nif (interpolated.length > CEILING.interpolated)\\n\",\n    \"baseline\": \"// bounded model above invokes their real runtime generators, materializes every admitted cardinality\\n// and closed branch (3,011 statements), and PREPAREs each one. Exact scanner signatures and runtime\\n// cap assertions fail closed on drift; the pre-R6 measured interpolated corpus therefore remains 172.\\nconst CEILING = { interpolated: 173, unreadable: 44 };\\nconst overflow = [];\\nif (interpolated.length > CEILING.interpolated)\\n\"\n  }\n].map(Object.freeze)),\n  }),\n\n});\nfunction assertMonitorSuccessor(file, input, pin) {\n  assert.equal(file, pin.file, 'Only the exact named economy-monitor successor');\n  const current = normalize(input);\n  assert.equal(sha(current), pin.currentSha256, 'Whole economy-monitor successor changed');\n  assert.equal(blob(current), pin.currentBlob); assert.equal(Buffer.byteLength(current), pin.currentBytes);\n  let baselineText = current;\n  if (pin.inverses) {\n    assert(Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));\n    let end = -1;\n    for (const inverse of pin.inverses) {\n      assert.deepEqual(Object.keys(inverse).sort(), ['baseline', 'current']);\n      assert(inverse.current.length && typeof inverse.baseline === 'string');\n      assert.equal(current.split(inverse.current).length, 2, 'Unique complete release correction hunk');\n      const at = current.indexOf(inverse.current); assert(at >= end, 'Ordered nonoverlapping release correction hunks');\n      end = at + inverse.current.length;\n      assert.equal(baselineText.split(inverse.current).length, 2);\n      baselineText = baselineText.replace(inverse.current, () => inverse.baseline);\n    }\n  } else {\n    assert.equal(current.split(pin.current).length, pin.occurrences + 1, 'Exact bounded economy-monitor successor replacements');\n    baselineText = current.replaceAll(pin.current, () => pin.baseline);\n  }\n  if (pin.baselineSha256) {\n    assert.equal(sha(baselineText), pin.baselineSha256); assert.equal(blob(baselineText), pin.baselineBlob);\n    assert.equal(Buffer.byteLength(baselineText), pin.baselineBytes);\n  } else assertEconomyMonitorSourceTransfer(file, baselineText);\n  return Object.freeze({ file, baselineText, sourceRevision: pin.sourceRevision, predecessorRevision: pin.predecessorRevision,\n    sourceOnly: true, native: false, runtime: false });\n}\nexport function assertEconomyMonitorWorkerSource(file, input) {\n  return assertMonitorSuccessor(file, input, ECONOMY_MONITOR_WORKER_SOURCE);\n}\nexport function assertEconomyMonitorReaderSource(file, input) {\n  return assertMonitorSuccessor(file, input, ECONOMY_MONITOR_READER_SOURCE);\n}\nfunction monitorSuccessorHistoricalInput(file, input, pin) {\n  if (file !== pin.file) return input;\n  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;\n  if (buffer) assert(Buffer.from(text).equals(input), 'lossless UTF-8 physical successor source required');\n  let current;\n  try { current = normalize(text); } catch { return input; }\n  if (sha(current) !== pin.currentSha256) return input;\n  const restored = assertMonitorSuccessor(file, text, pin).baselineText;\n  return buffer ? Buffer.from(restored) : restored;\n}\nexport function economyMonitorWorkerHistoricalInput(file, input) {\n  return monitorSuccessorHistoricalInput(file, input, ECONOMY_MONITOR_WORKER_SOURCE);\n}\nexport function economyMonitorReaderHistoricalInput(file, input) {\n  return monitorSuccessorHistoricalInput(file, input, ECONOMY_MONITOR_READER_SOURCE);\n}\nexport function assertEconomyMonitorReleaseSource(file, input) {\n  assert(Object.hasOwn(ECONOMY_MONITOR_RELEASE_SOURCES, file), 'Only the five exact economy-monitor CI/test/tool source domains');\n  return assertMonitorSuccessor(file, input, ECONOMY_MONITOR_RELEASE_SOURCES[file]);\n}\nexport function economyMonitorReleaseHistoricalInput(file, input) {\n  if (!Object.hasOwn(ECONOMY_MONITOR_RELEASE_SOURCES, file)) return input;\n  return monitorSuccessorHistoricalInput(file, input, ECONOMY_MONITOR_RELEASE_SOURCES[file]);\n}\nconst assertPin = pin => {\n  assert.equal(pin, ECONOMY_UX_MERGE_SOURCE, 'Only the exact frozen economy+UX merge binding');\n  assert.equal(sha(JSON.stringify(pin)), ECONOMY_UX_MERGE_SOURCE_SHA256);\n",
              "baseline": "  assert(!text.includes('\\r') && (input === text || input === text.replaceAll('\\n', '\\r\\n')), 'Uniform whole LF/CRLF only');\n  return text;\n};\nconst assertPin = pin => {\n  assert.equal(pin, ECONOMY_UX_MERGE_SOURCE, 'Only the exact frozen economy+UX merge binding');\n  assert.equal(sha(JSON.stringify(pin)), ECONOMY_UX_MERGE_SOURCE_SHA256);\n"
            },
            {
              "current": "  const restored = qualifyEconomyUxMergeSource(file, text, target).baselineText;\n  return buffer ? Buffer.from(restored) : restored;\n}\nexport function economyUxMergeCandidateHistoricalInput(file, input, profile = 'monitor') {\n  input = economyDeedMergeHistoricalInput(file, input, profile);\n  if (profile === 'monitor') input = ageEligibilityHistoricalInput(file, input);\n  input = deedAllocationHistoricalInput(file, input);\n  if (profile === 'deed') input = ageEligibilityHistoricalInput(file, input);\n  input = economyMonitorWorkerHistoricalInput(file, input);\n  input = economyMonitorReaderHistoricalInput(file, input);\n  input = economyMonitorReleaseHistoricalInput(file, input);\n  input = economyMonitorHistoricalInput(file, input);\n  input = economyBankInterestHardeningHistoricalInput(file, input);\n  input = economySocialProofCutoverHistoricalInput(file, input);\n  input = economySocialReceiptSafetyHistoricalInput(file, input);\n",
              "baseline": "  const restored = qualifyEconomyUxMergeSource(file, text, target).baselineText;\n  return buffer ? Buffer.from(restored) : restored;\n}\nexport function economyUxMergeCandidateHistoricalInput(file, input) {\n  input = deedAllocationHistoricalInput(file, input);\n  input = economyBankInterestHardeningHistoricalInput(file, input);\n  input = economySocialProofCutoverHistoricalInput(file, input);\n  input = economySocialReceiptSafetyHistoricalInput(file, input);\n"
            },
            {
              "current": "  input = saleHistoricalInput(file, input);\n  return historicalInput(file, input, 'candidate');\n}\nexport function economyUxMergeMainHistoricalInput(file, input, profile = 'monitor') {\n  input = economyDeedMergeHistoricalInput(file, input, profile);\n  if (profile === 'monitor') input = ageEligibilityHistoricalInput(file, input);\n  input = deedAllocationHistoricalInput(file, input);\n  if (profile === 'deed') input = ageEligibilityHistoricalInput(file, input);\n  input = economyMonitorWorkerHistoricalInput(file, input);\n  input = economyMonitorReaderHistoricalInput(file, input);\n  input = economyMonitorReleaseHistoricalInput(file, input);\n  input = economyMonitorHistoricalInput(file, input);\n  input = economyBankInterestHardeningHistoricalInput(file, input);\n  input = economySocialProofCutoverHistoricalInput(file, input);\n  input = economySocialReceiptSafetyHistoricalInput(file, input);\n",
              "baseline": "  input = saleHistoricalInput(file, input);\n  return historicalInput(file, input, 'candidate');\n}\nexport function economyUxMergeMainHistoricalInput(file, input) {\n  input = deedAllocationHistoricalInput(file, input);\n  input = economyBankInterestHardeningHistoricalInput(file, input);\n  input = economySocialProofCutoverHistoricalInput(file, input);\n  input = economySocialReceiptSafetyHistoricalInput(file, input);\n"
            }
          ]
        }
      }
    },
    {
      "file": "tools/enterprise-native-ux.js",
      "current": {
        "mode": "100644",
        "sha256": "0890e7638554d6e0b90acf9aea2edf403a9a6e8b7d5350267b549941d114e908",
        "blob": "78878a2aa0968ce55b5bae1d580a0715a4559f02",
        "bytes": 18010,
        "rawSha256": {
          "lf": "0890e7638554d6e0b90acf9aea2edf403a9a6e8b7d5350267b549941d114e908",
          "crlf": "cb7ade5c64e2f9ed304421fa144e0731b5d381fdf15f402eb207d67438ea51e7"
        }
      },
      "parents": {
        "monitor": {
          "mode": "100644",
          "sha256": "255b5f6aa52d43b44092da709a1dc43a49bc6a4bf10a57d0efc59d05d2895324",
          "blob": "4267d353e00d269394c1da89b239f2d3f48ee7bf",
          "bytes": 12954,
          "inverses": [
            {
              "current": "// Admission executes unchanged native proofs on exact current source. Historical provenance never admits bytes.\nimport assert from 'node:assert/strict';\nimport crypto from 'node:crypto';\nimport path from 'node:path';\nimport { parse } from 'acorn';\nimport { ENTERPRISE_NATIVE_UX_INPUTS, ENTERPRISE_NATIVE_UX_INPUTS_SHA256 } from './enterprise-native-deed-inputs.js';\nimport { ENTERPRISE_NATIVE_UX_INPUTS as PREDECESSOR_NATIVE_INPUTS,\n ENTERPRISE_NATIVE_UX_INPUTS_SHA256 as PREDECESSOR_NATIVE_DEFINITION_SHA256 } from './enterprise-native-ux-b35-inputs.js';\nimport { DEED_ALLOCATION_SOURCE_DOMAINS } from './deed-allocation-source-data.js';\nimport { ECONOMY_DEED_MERGE_NATIVE_PROVENANCE, ECONOMY_DEED_MERGE_NATIVE_PROVENANCE_SHA256 } from './economy-deed-merge-source-data.js';\nimport { assertEconomyDeedNativeProvenance, assertEconomyDeedNativeProvenanceDefinition } from './economy-deed-merge-source-compatibility.js';\nexport { ENTERPRISE_NATIVE_UX_INPUTS };\nexport const ENTERPRISE_UX_METADATA = 'tools/enterprise-native-deed-inputs.js';\nexport const ENTERPRISE_UX_PREDECESSOR_METADATA = 'tools/enterprise-native-ux-b35-inputs.js';\nexport const ENTERPRISE_UX_PREDECESSOR_METADATA_SHA256 = '70db907a20352f433aec965c5cd1bdaa05ac7fb2c159b3c132538fc7d714789e';\nexport const ENTERPRISE_UX_QUALIFIED_METADATA = 'tools/enterprise-native-ux-inputs.js';\nexport const ENTERPRISE_UX_QUALIFIED_METADATA_SHA256 = 'b37b8de9a428f2e23a43c33d69393785fc6b2e7b728750950ab4ad177c5c4e68';\nexport const ENTERPRISE_UX_SUPPORT = Object.freeze([\n ENTERPRISE_UX_PREDECESSOR_METADATA, ENTERPRISE_UX_QUALIFIED_METADATA,\n 'tools/enterprise-native-ux.js', 'tools/enterprise-native-ux-seal.js', 'test/lib/enterprise-ux-native-guard.js',\n 'test/ux-source-compatibility.js', 'test/lib/ux-native-reader-source-compatibility.js',\n 'tools/ux-director-reader-source-seal.js', 'tools/ux-workflow-bound-source-seal.js',\n 'tools/ux-phase2-upgrade-bound-source-seal.js', 'tools/ux-suites-gate-source-seal.js',\n 'tools/sale-source-seal.js', 'test/sale-source-compatibility.js',\n 'tools/generate-economy-social-proof-receipt-source-transfer.js',\n 'tools/generate-economy-social-proof-receipt-safety-source-transfer.js',\n 'tools/generate-economy-social-proof-cutover-source-transfer.js',\n 'tools/generate-economy-bank-interest-source-transfer.js', 'tools/pgquery.js',\n 'test/social-receipt-postgres.js', 'test/db-boot-lock-postgres.js',\n '.github/workflows/economy-hardening.yml', 'tools/generate-economy-monitor-source-transfer.js',\n 'test/economy-monitor-source-compatibility.js', 'test/economy-monitor.js',\n 'test/economy-composition.js', 'test/economy-composition-restart.js',\n 'tools/generate-age-eligibility-source-transfer.js', 'test/age-eligibility-source-compatibility.js',\n 'test/age.js', 'test/legal-security.js', 'tools/economy-deed-merge-source-data.js',\n 'tools/economy-deed-merge-source-compatibility.js',\n 'tools/generate-economy-deed-merge-source.js', 'test/economy-deed-merge-source-compatibility.js',\n]);\nexport const ENTERPRISE_UX_ASSETS = Object.freeze([\n ...['feedback', 'progression', 'social', 'navigation', 'workspace', 'world', 'tactics', 'investigation', 'coordination', 'feel', 'tools', 'identity', 'story', 'community'].flatMap(name => ['public/ux-' + name + '.js', ...(name === 'workspace' ? [] : ['public/ux-' + name + '.css'])]),\n 'public/sale.html',\n",
              "baseline": "// Admission to execute the unchanged native proofs on actual current source. No historical inverses.\nimport assert from 'node:assert/strict';\nimport crypto from 'node:crypto';\nimport path from 'node:path';\nimport { parse } from 'acorn';\nimport { ENTERPRISE_NATIVE_UX_INPUTS, ENTERPRISE_NATIVE_UX_INPUTS_SHA256 } from './enterprise-native-ux-inputs.js';\nexport { ENTERPRISE_NATIVE_UX_INPUTS };\nexport const ENTERPRISE_UX_METADATA = 'tools/enterprise-native-ux-inputs.js';\nexport const ENTERPRISE_UX_SUPPORT = Object.freeze(['tools/enterprise-native-ux.js', 'tools/enterprise-native-ux-seal.js', 'test/lib/enterprise-ux-native-guard.js', 'test/ux-source-compatibility.js', 'test/lib/ux-native-reader-source-compatibility.js', 'tools/ux-director-reader-source-seal.js', 'tools/ux-workflow-bound-source-seal.js', 'tools/ux-phase2-upgrade-bound-source-seal.js', 'tools/ux-suites-gate-source-seal.js', 'tools/sale-source-seal.js', 'test/sale-source-compatibility.js', 'tools/generate-economy-social-proof-receipt-source-transfer.js', 'tools/generate-economy-social-proof-receipt-safety-source-transfer.js', 'tools/generate-economy-social-proof-cutover-source-transfer.js', 'tools/generate-economy-bank-interest-source-transfer.js', 'tools/pgquery.js', 'test/social-receipt-postgres.js', 'test/db-boot-lock-postgres.js', '.github/workflows/economy-hardening.yml', 'tools/generate-economy-monitor-source-transfer.js', 'test/economy-monitor-source-compatibility.js', 'test/economy-monitor.js', 'test/economy-composition.js', 'test/economy-composition-restart.js', 'tools/generate-age-eligibility-source-transfer.js', 'test/age-eligibility-source-compatibility.js', 'test/age.js', 'test/legal-security.js']);\nexport const ENTERPRISE_UX_ASSETS = Object.freeze([\n ...['feedback', 'progression', 'social', 'navigation', 'workspace', 'world', 'tactics', 'investigation', 'coordination', 'feel', 'tools', 'identity', 'story', 'community'].flatMap(name => ['public/ux-' + name + '.js', ...(name === 'workspace' ? [] : ['public/ux-' + name + '.css'])]),\n 'public/sale.html',\n"
            },
            {
              "current": " assert.equal(declaration, ENTERPRISE_NATIVE_UX_INPUTS, 'Only the actual frozen current-native declaration');\n assert.equal(declaration.status, 'SEALED', 'Current UX native inputs remain UNSEALED; no prior native results transfer');\n assert.equal(digest(JSON.stringify(declaration)), ENTERPRISE_NATIVE_UX_INPUTS_SHA256, 'Whole current-native declaration changed');\n fields(declaration, ['version', 'status', 'phase', 'authoredRevision', 'predecessorRevision', 'uxRevision', 'legacyRevision', 'legacyDefinitionSha256', 'legacyInventorySha256', 'nativePredecessorRevision', 'nativePredecessorMetadataSha256', 'deedSourceDefinitionSha256', 'economyDeedProvenanceDefinitionSha256', 'files', 'replacements', 'legacyAdditionReplacements', 'additions']);\n assert.equal(declaration.version, 3); assert.equal(declaration.phase, 'ACTUAL_ENTERPRISE_DEED_NATIVE_INPUTS');\n assert.equal(PREDECESSOR_NATIVE_INPUTS.status, 'SEALED');\n assert.equal(digest(JSON.stringify(PREDECESSOR_NATIVE_INPUTS)), PREDECESSOR_NATIVE_DEFINITION_SHA256, 'Immutable predecessor native declaration');\n assert.equal(declaration.nativePredecessorRevision, PREDECESSOR_NATIVE_INPUTS.authoredRevision);\n assert.equal(declaration.nativePredecessorMetadataSha256, ENTERPRISE_UX_PREDECESSOR_METADATA_SHA256, 'Original native manifest bytes remain immutable');\n assert.equal(declaration.deedSourceDefinitionSha256, digest(JSON.stringify(DEED_ALLOCATION_SOURCE_DOMAINS)), 'Exact reviewed Deed source layer, not a phase-only grant');\n assert.equal(declaration.economyDeedProvenanceDefinitionSha256, ECONOMY_DEED_MERGE_NATIVE_PROVENANCE_SHA256);\n assert(assertEconomyDeedNativeProvenanceDefinition(), 'Only the closed immutable merged-source provenance definition');\n assert.equal(digest(JSON.stringify(ECONOMY_DEED_MERGE_NATIVE_PROVENANCE)), ECONOMY_DEED_MERGE_NATIVE_PROVENANCE_SHA256);\n assert.equal(ECONOMY_DEED_MERGE_NATIVE_PROVENANCE.predecessorRevision, PREDECESSOR_NATIVE_INPUTS.authoredRevision);\n assert.equal(ECONOMY_DEED_MERGE_NATIVE_PROVENANCE.predecessorDefinitionSha256, PREDECESSOR_NATIVE_DEFINITION_SHA256);\n assert.equal(ECONOMY_DEED_MERGE_NATIVE_PROVENANCE.predecessorMetadataSha256, ENTERPRISE_UX_PREDECESSOR_METADATA_SHA256);\n assert.equal(ECONOMY_DEED_MERGE_NATIVE_PROVENANCE.sourceOnly, true);\n assert.equal(ECONOMY_DEED_MERGE_NATIVE_PROVENANCE.nativeAdmission, false);\n assert.equal(ECONOMY_DEED_MERGE_NATIVE_PROVENANCE.priorResultsTransferred, false);\n assert.equal(declaration.predecessorRevision, 'c6247976ff71e8d4c103ebd1498c2d373217d077'); assert.equal(declaration.uxRevision, '940df6a1efbe4ddcd8301cd138d5643dbe48a0bc'); assert.match(declaration.authoredRevision, /^[a-f0-9]{40}$/);\n assert.equal(declaration.legacyRevision, legacy.revision); assert.equal(declaration.legacyDefinitionSha256, digest(JSON.stringify(legacy))); assert.equal(declaration.legacyInventorySha256, digest(JSON.stringify(legacyFiles)));\n assert(Object.isFrozen(declaration) && Object.isFrozen(declaration.files) && Object.isFrozen(declaration.replacements) && Object.isFrozen(declaration.legacyAdditionReplacements) && Object.isFrozen(declaration.additions));\n assert.equal(new Set(declaration.files.map(row => row.file)).size, declaration.files.length);\n assert.deepEqual(declaration.files.slice(0, legacyFiles.length).map(row => row.file), legacyFiles, 'Complete original ordered native inventory retained');\n const current = new Map(); for (const row of declaration.files) { pin(row); assert.notEqual(row.file, ENTERPRISE_UX_METADATA, 'Only unavoidable manifest self-reference is separately captured'); current.set(row.file, row); }\n assert.equal(current.get(ENTERPRISE_UX_PREDECESSOR_METADATA)?.sha256, declaration.nativePredecessorMetadataSha256, 'The old native manifest is an exact ordinary input, never another self-reference');\n assert.equal(current.get(ENTERPRISE_UX_QUALIFIED_METADATA)?.sha256, ENTERPRISE_UX_QUALIFIED_METADATA_SHA256, 'The qualified UX manifest remains an exact ordinary input, never native admission');\n const extra = declaration.files.slice(legacyFiles.length); assert.deepEqual(extra.map(row => row.file), extra.map(row => row.file).sort()); assert.deepEqual(declaration.additions, extra);\n for (const file of [...ENTERPRISE_UX_SUPPORT, ...ENTERPRISE_UX_ASSETS]) assert(current.has(file), 'Required actual UX/native support file: ' + file);\n const seen = new Set(), order = new Map(legacyFiles.map((file, index) => [file, index]));\n",
              "baseline": " assert.equal(declaration, ENTERPRISE_NATIVE_UX_INPUTS, 'Only the actual frozen current-native declaration');\n assert.equal(declaration.status, 'SEALED', 'Current UX native inputs remain UNSEALED; no prior native results transfer');\n assert.equal(digest(JSON.stringify(declaration)), ENTERPRISE_NATIVE_UX_INPUTS_SHA256, 'Whole current-native declaration changed');\n fields(declaration, ['version', 'status', 'phase', 'authoredRevision', 'predecessorRevision', 'uxRevision', 'legacyRevision', 'legacyDefinitionSha256', 'legacyInventorySha256', 'files', 'replacements', 'legacyAdditionReplacements', 'additions']);\n assert.equal(declaration.version, 2); assert.equal(declaration.phase, 'ACTUAL_ENTERPRISE_UX_NATIVE_INPUTS');\n assert.equal(declaration.predecessorRevision, 'c6247976ff71e8d4c103ebd1498c2d373217d077'); assert.equal(declaration.uxRevision, '940df6a1efbe4ddcd8301cd138d5643dbe48a0bc'); assert.match(declaration.authoredRevision, /^[a-f0-9]{40}$/);\n assert.equal(declaration.legacyRevision, legacy.revision); assert.equal(declaration.legacyDefinitionSha256, digest(JSON.stringify(legacy))); assert.equal(declaration.legacyInventorySha256, digest(JSON.stringify(legacyFiles)));\n assert(Object.isFrozen(declaration) && Object.isFrozen(declaration.files) && Object.isFrozen(declaration.replacements) && Object.isFrozen(declaration.legacyAdditionReplacements) && Object.isFrozen(declaration.additions));\n assert.equal(new Set(declaration.files.map(row => row.file)).size, declaration.files.length);\n assert.deepEqual(declaration.files.slice(0, legacyFiles.length).map(row => row.file), legacyFiles, 'Complete original ordered native inventory retained');\n const current = new Map(); for (const row of declaration.files) { pin(row); assert.notEqual(row.file, ENTERPRISE_UX_METADATA, 'Only unavoidable manifest self-reference is separately captured'); current.set(row.file, row); }\n const extra = declaration.files.slice(legacyFiles.length); assert.deepEqual(extra.map(row => row.file), extra.map(row => row.file).sort()); assert.deepEqual(declaration.additions, extra);\n for (const file of [...ENTERPRISE_UX_SUPPORT, ...ENTERPRISE_UX_ASSETS]) assert(current.has(file), 'Required actual UX/native support file: ' + file);\n const seen = new Set(), order = new Map(legacyFiles.map((file, index) => [file, index]));\n"
            },
            {
              "current": " assert(Buffer.isBuffer(bytes)); assert(current && authored && current.type === 'blob' && authored.type === 'blob');\n assert.equal(current.mode, expected.mode); assert.equal(authored.mode, expected.mode); assert.equal(current.blob, expected.blob, 'Current native source differs from actual authored input'); assert.equal(authored.blob, expected.blob, 'Native pin is not actual authored Git');\n assert.equal(digest(bytes), expected.sha256, 'Whole actual native source changed'); assert.equal(blob(bytes), expected.blob, 'Actual native Git bytes changed');\n // These exact current bytes have already been admitted independently of any historical relation.\n // The relation below records provenance only; native execution and its sixteen fresh cases remain mandatory.\n const previous = PREDECESSOR_NATIVE_INPUTS.files.find(row => row.file === file);\n if (!previous || !changedPin(previous, expected)) return null;\n const sourcePin = DEED_ALLOCATION_SOURCE_DOMAINS[file];\n const deedSource = sourcePin && expected.mode === sourcePin.currentMode && expected.blob === sourcePin.currentBlob\n  && expected.sha256 === sourcePin.currentSha256 && previous.mode === sourcePin.baselineMode\n  && previous.blob === sourcePin.baselineBlob && previous.sha256 === sourcePin.baselineSha256;\n if (deedSource) {\n  assert.equal(expected.mode, sourcePin.currentMode); assert.equal(expected.blob, sourcePin.currentBlob);\n  assert.equal(expected.sha256, sourcePin.currentSha256);\n  assert.equal(previous.mode, sourcePin.baselineMode); assert.equal(previous.blob, sourcePin.baselineBlob);\n  assert.equal(previous.sha256, sourcePin.baselineSha256);\n } else {\n  const provenance = assertEconomyDeedNativeProvenance(file, expected, previous);\n  assert(provenance && Object.isFrozen(provenance), 'Only an exact reviewed merged-source relation');\n }\n return Object.freeze({ file, current: Object.freeze({ mode: current.mode, blob: current.blob, sha256: digest(bytes) }),\n  predecessor: previous, predecessorRevision: PREDECESSOR_NATIVE_INPUTS.authoredRevision,\n  relation: deedSource ? 'exact-reviewed-deed-source-provenance-only' : 'exact-reviewed-economy-deed-merge-source-provenance-only',\n  nativeAdmission: false, priorResultsTransferred: false });\n}\n",
              "baseline": " assert(Buffer.isBuffer(bytes)); assert(current && authored && current.type === 'blob' && authored.type === 'blob');\n assert.equal(current.mode, expected.mode); assert.equal(authored.mode, expected.mode); assert.equal(current.blob, expected.blob, 'Current native source differs from actual authored input'); assert.equal(authored.blob, expected.blob, 'Native pin is not actual authored Git');\n assert.equal(digest(bytes), expected.sha256, 'Whole actual native source changed'); assert.equal(blob(bytes), expected.blob, 'Actual native Git bytes changed');\n}\n"
            }
          ]
        },
        "deed": {
          "mode": "100644",
          "sha256": "ac538474d4fa502d69f5abd3a202deef1ae13b7f435082deda514b7f0fd5cd49",
          "blob": "cfc8df57c2f6afe1dde3b02a5ec63191baea469a",
          "bytes": 15631,
          "inverses": [
            {
              "current": "import { ENTERPRISE_NATIVE_UX_INPUTS as PREDECESSOR_NATIVE_INPUTS,\n ENTERPRISE_NATIVE_UX_INPUTS_SHA256 as PREDECESSOR_NATIVE_DEFINITION_SHA256 } from './enterprise-native-ux-b35-inputs.js';\nimport { DEED_ALLOCATION_SOURCE_DOMAINS } from './deed-allocation-source-data.js';\nimport { ECONOMY_DEED_MERGE_NATIVE_PROVENANCE, ECONOMY_DEED_MERGE_NATIVE_PROVENANCE_SHA256 } from './economy-deed-merge-source-data.js';\nimport { assertEconomyDeedNativeProvenance, assertEconomyDeedNativeProvenanceDefinition } from './economy-deed-merge-source-compatibility.js';\nexport { ENTERPRISE_NATIVE_UX_INPUTS };\nexport const ENTERPRISE_UX_METADATA = 'tools/enterprise-native-deed-inputs.js';\nexport const ENTERPRISE_UX_PREDECESSOR_METADATA = 'tools/enterprise-native-ux-b35-inputs.js';\nexport const ENTERPRISE_UX_PREDECESSOR_METADATA_SHA256 = '70db907a20352f433aec965c5cd1bdaa05ac7fb2c159b3c132538fc7d714789e';\nexport const ENTERPRISE_UX_QUALIFIED_METADATA = 'tools/enterprise-native-ux-inputs.js';\nexport const ENTERPRISE_UX_QUALIFIED_METADATA_SHA256 = 'b37b8de9a428f2e23a43c33d69393785fc6b2e7b728750950ab4ad177c5c4e68';\nexport const ENTERPRISE_UX_SUPPORT = Object.freeze([\n ENTERPRISE_UX_PREDECESSOR_METADATA, ENTERPRISE_UX_QUALIFIED_METADATA,\n 'tools/enterprise-native-ux.js', 'tools/enterprise-native-ux-seal.js', 'test/lib/enterprise-ux-native-guard.js',\n 'test/ux-source-compatibility.js', 'test/lib/ux-native-reader-source-compatibility.js',\n 'tools/ux-director-reader-source-seal.js', 'tools/ux-workflow-bound-source-seal.js',\n 'tools/ux-phase2-upgrade-bound-source-seal.js', 'tools/ux-suites-gate-source-seal.js',\n 'tools/sale-source-seal.js', 'test/sale-source-compatibility.js',\n 'tools/generate-economy-social-proof-receipt-source-transfer.js',\n 'tools/generate-economy-social-proof-receipt-safety-source-transfer.js',\n 'tools/generate-economy-social-proof-cutover-source-transfer.js',\n 'tools/generate-economy-bank-interest-source-transfer.js', 'tools/pgquery.js',\n 'test/social-receipt-postgres.js', 'test/db-boot-lock-postgres.js',\n '.github/workflows/economy-hardening.yml', 'tools/generate-economy-monitor-source-transfer.js',\n 'test/economy-monitor-source-compatibility.js', 'test/economy-monitor.js',\n 'test/economy-composition.js', 'test/economy-composition-restart.js',\n 'tools/generate-age-eligibility-source-transfer.js', 'test/age-eligibility-source-compatibility.js',\n 'test/age.js', 'test/legal-security.js', 'tools/economy-deed-merge-source-data.js',\n 'tools/economy-deed-merge-source-compatibility.js',\n 'tools/generate-economy-deed-merge-source.js', 'test/economy-deed-merge-source-compatibility.js',\n]);\nexport const ENTERPRISE_UX_ASSETS = Object.freeze([\n ...['feedback', 'progression', 'social', 'navigation', 'workspace', 'world', 'tactics', 'investigation', 'coordination', 'feel', 'tools', 'identity', 'story', 'community'].flatMap(name => ['public/ux-' + name + '.js', ...(name === 'workspace' ? [] : ['public/ux-' + name + '.css'])]),\n 'public/sale.html',\n",
              "baseline": "import { ENTERPRISE_NATIVE_UX_INPUTS as PREDECESSOR_NATIVE_INPUTS,\n ENTERPRISE_NATIVE_UX_INPUTS_SHA256 as PREDECESSOR_NATIVE_DEFINITION_SHA256 } from './enterprise-native-ux-b35-inputs.js';\nimport { DEED_ALLOCATION_SOURCE_DOMAINS } from './deed-allocation-source-data.js';\nexport { ENTERPRISE_NATIVE_UX_INPUTS };\nexport const ENTERPRISE_UX_METADATA = 'tools/enterprise-native-deed-inputs.js';\nexport const ENTERPRISE_UX_PREDECESSOR_METADATA = 'tools/enterprise-native-ux-b35-inputs.js';\nexport const ENTERPRISE_UX_PREDECESSOR_METADATA_SHA256 = '70db907a20352f433aec965c5cd1bdaa05ac7fb2c159b3c132538fc7d714789e';\nexport const ENTERPRISE_UX_QUALIFIED_METADATA = 'tools/enterprise-native-ux-inputs.js';\nexport const ENTERPRISE_UX_QUALIFIED_METADATA_SHA256 = 'b37b8de9a428f2e23a43c33d69393785fc6b2e7b728750950ab4ad177c5c4e68';\nexport const ENTERPRISE_UX_SUPPORT = Object.freeze([ENTERPRISE_UX_PREDECESSOR_METADATA, ENTERPRISE_UX_QUALIFIED_METADATA, 'tools/enterprise-native-ux.js', 'tools/enterprise-native-ux-seal.js', 'test/lib/enterprise-ux-native-guard.js', 'test/ux-source-compatibility.js', 'test/lib/ux-native-reader-source-compatibility.js', 'tools/ux-director-reader-source-seal.js', 'tools/ux-workflow-bound-source-seal.js', 'tools/ux-phase2-upgrade-bound-source-seal.js', 'tools/ux-suites-gate-source-seal.js', 'tools/sale-source-seal.js', 'test/sale-source-compatibility.js', 'tools/generate-economy-social-proof-receipt-source-transfer.js', 'tools/generate-economy-social-proof-receipt-safety-source-transfer.js', 'tools/generate-economy-social-proof-cutover-source-transfer.js', 'tools/generate-economy-bank-interest-source-transfer.js', 'tools/pgquery.js', 'test/social-receipt-postgres.js', 'test/db-boot-lock-postgres.js']);\nexport const ENTERPRISE_UX_ASSETS = Object.freeze([\n ...['feedback', 'progression', 'social', 'navigation', 'workspace', 'world', 'tactics', 'investigation', 'coordination', 'feel', 'tools', 'identity', 'story', 'community'].flatMap(name => ['public/ux-' + name + '.js', ...(name === 'workspace' ? [] : ['public/ux-' + name + '.css'])]),\n 'public/sale.html',\n"
            },
            {
              "current": " assert.equal(declaration, ENTERPRISE_NATIVE_UX_INPUTS, 'Only the actual frozen current-native declaration');\n assert.equal(declaration.status, 'SEALED', 'Current UX native inputs remain UNSEALED; no prior native results transfer');\n assert.equal(digest(JSON.stringify(declaration)), ENTERPRISE_NATIVE_UX_INPUTS_SHA256, 'Whole current-native declaration changed');\n fields(declaration, ['version', 'status', 'phase', 'authoredRevision', 'predecessorRevision', 'uxRevision', 'legacyRevision', 'legacyDefinitionSha256', 'legacyInventorySha256', 'nativePredecessorRevision', 'nativePredecessorMetadataSha256', 'deedSourceDefinitionSha256', 'economyDeedProvenanceDefinitionSha256', 'files', 'replacements', 'legacyAdditionReplacements', 'additions']);\n assert.equal(declaration.version, 3); assert.equal(declaration.phase, 'ACTUAL_ENTERPRISE_DEED_NATIVE_INPUTS');\n assert.equal(PREDECESSOR_NATIVE_INPUTS.status, 'SEALED');\n assert.equal(digest(JSON.stringify(PREDECESSOR_NATIVE_INPUTS)), PREDECESSOR_NATIVE_DEFINITION_SHA256, 'Immutable predecessor native declaration');\n assert.equal(declaration.nativePredecessorRevision, PREDECESSOR_NATIVE_INPUTS.authoredRevision);\n assert.equal(declaration.nativePredecessorMetadataSha256, ENTERPRISE_UX_PREDECESSOR_METADATA_SHA256, 'Original native manifest bytes remain immutable');\n assert.equal(declaration.deedSourceDefinitionSha256, digest(JSON.stringify(DEED_ALLOCATION_SOURCE_DOMAINS)), 'Exact reviewed Deed source layer, not a phase-only grant');\n assert.equal(declaration.economyDeedProvenanceDefinitionSha256, ECONOMY_DEED_MERGE_NATIVE_PROVENANCE_SHA256);\n assert(assertEconomyDeedNativeProvenanceDefinition(), 'Only the closed immutable merged-source provenance definition');\n assert.equal(digest(JSON.stringify(ECONOMY_DEED_MERGE_NATIVE_PROVENANCE)), ECONOMY_DEED_MERGE_NATIVE_PROVENANCE_SHA256);\n assert.equal(ECONOMY_DEED_MERGE_NATIVE_PROVENANCE.predecessorRevision, PREDECESSOR_NATIVE_INPUTS.authoredRevision);\n assert.equal(ECONOMY_DEED_MERGE_NATIVE_PROVENANCE.predecessorDefinitionSha256, PREDECESSOR_NATIVE_DEFINITION_SHA256);\n assert.equal(ECONOMY_DEED_MERGE_NATIVE_PROVENANCE.predecessorMetadataSha256, ENTERPRISE_UX_PREDECESSOR_METADATA_SHA256);\n assert.equal(ECONOMY_DEED_MERGE_NATIVE_PROVENANCE.sourceOnly, true);\n assert.equal(ECONOMY_DEED_MERGE_NATIVE_PROVENANCE.nativeAdmission, false);\n assert.equal(ECONOMY_DEED_MERGE_NATIVE_PROVENANCE.priorResultsTransferred, false);\n assert.equal(declaration.predecessorRevision, 'c6247976ff71e8d4c103ebd1498c2d373217d077'); assert.equal(declaration.uxRevision, '940df6a1efbe4ddcd8301cd138d5643dbe48a0bc'); assert.match(declaration.authoredRevision, /^[a-f0-9]{40}$/);\n assert.equal(declaration.legacyRevision, legacy.revision); assert.equal(declaration.legacyDefinitionSha256, digest(JSON.stringify(legacy))); assert.equal(declaration.legacyInventorySha256, digest(JSON.stringify(legacyFiles)));\n assert(Object.isFrozen(declaration) && Object.isFrozen(declaration.files) && Object.isFrozen(declaration.replacements) && Object.isFrozen(declaration.legacyAdditionReplacements) && Object.isFrozen(declaration.additions));\n",
              "baseline": " assert.equal(declaration, ENTERPRISE_NATIVE_UX_INPUTS, 'Only the actual frozen current-native declaration');\n assert.equal(declaration.status, 'SEALED', 'Current UX native inputs remain UNSEALED; no prior native results transfer');\n assert.equal(digest(JSON.stringify(declaration)), ENTERPRISE_NATIVE_UX_INPUTS_SHA256, 'Whole current-native declaration changed');\n fields(declaration, ['version', 'status', 'phase', 'authoredRevision', 'predecessorRevision', 'uxRevision', 'legacyRevision', 'legacyDefinitionSha256', 'legacyInventorySha256', 'nativePredecessorRevision', 'nativePredecessorMetadataSha256', 'deedSourceDefinitionSha256', 'files', 'replacements', 'legacyAdditionReplacements', 'additions']);\n assert.equal(declaration.version, 3); assert.equal(declaration.phase, 'ACTUAL_ENTERPRISE_DEED_NATIVE_INPUTS');\n assert.equal(PREDECESSOR_NATIVE_INPUTS.status, 'SEALED');\n assert.equal(digest(JSON.stringify(PREDECESSOR_NATIVE_INPUTS)), PREDECESSOR_NATIVE_DEFINITION_SHA256, 'Immutable predecessor native declaration');\n assert.equal(declaration.nativePredecessorRevision, PREDECESSOR_NATIVE_INPUTS.authoredRevision);\n assert.equal(declaration.nativePredecessorMetadataSha256, ENTERPRISE_UX_PREDECESSOR_METADATA_SHA256, 'Original native manifest bytes remain immutable');\n assert.equal(declaration.deedSourceDefinitionSha256, digest(JSON.stringify(DEED_ALLOCATION_SOURCE_DOMAINS)), 'Exact reviewed Deed source layer, not a phase-only grant');\n assert.equal(declaration.predecessorRevision, 'c6247976ff71e8d4c103ebd1498c2d373217d077'); assert.equal(declaration.uxRevision, '940df6a1efbe4ddcd8301cd138d5643dbe48a0bc'); assert.match(declaration.authoredRevision, /^[a-f0-9]{40}$/);\n assert.equal(declaration.legacyRevision, legacy.revision); assert.equal(declaration.legacyDefinitionSha256, digest(JSON.stringify(legacy))); assert.equal(declaration.legacyInventorySha256, digest(JSON.stringify(legacyFiles)));\n assert(Object.isFrozen(declaration) && Object.isFrozen(declaration.files) && Object.isFrozen(declaration.replacements) && Object.isFrozen(declaration.legacyAdditionReplacements) && Object.isFrozen(declaration.additions));\n"
            },
            {
              "current": " const previous = PREDECESSOR_NATIVE_INPUTS.files.find(row => row.file === file);\n if (!previous || !changedPin(previous, expected)) return null;\n const sourcePin = DEED_ALLOCATION_SOURCE_DOMAINS[file];\n const deedSource = sourcePin && expected.mode === sourcePin.currentMode && expected.blob === sourcePin.currentBlob\n  && expected.sha256 === sourcePin.currentSha256 && previous.mode === sourcePin.baselineMode\n  && previous.blob === sourcePin.baselineBlob && previous.sha256 === sourcePin.baselineSha256;\n if (deedSource) {\n  assert.equal(expected.mode, sourcePin.currentMode); assert.equal(expected.blob, sourcePin.currentBlob);\n  assert.equal(expected.sha256, sourcePin.currentSha256);\n  assert.equal(previous.mode, sourcePin.baselineMode); assert.equal(previous.blob, sourcePin.baselineBlob);\n  assert.equal(previous.sha256, sourcePin.baselineSha256);\n } else {\n  const provenance = assertEconomyDeedNativeProvenance(file, expected, previous);\n  assert(provenance && Object.isFrozen(provenance), 'Only an exact reviewed merged-source relation');\n }\n return Object.freeze({ file, current: Object.freeze({ mode: current.mode, blob: current.blob, sha256: digest(bytes) }),\n  predecessor: previous, predecessorRevision: PREDECESSOR_NATIVE_INPUTS.authoredRevision,\n  relation: deedSource ? 'exact-reviewed-deed-source-provenance-only' : 'exact-reviewed-economy-deed-merge-source-provenance-only',\n  nativeAdmission: false, priorResultsTransferred: false });\n}\n",
              "baseline": " const previous = PREDECESSOR_NATIVE_INPUTS.files.find(row => row.file === file);\n if (!previous || !changedPin(previous, expected)) return null;\n const sourcePin = DEED_ALLOCATION_SOURCE_DOMAINS[file];\n assert(sourcePin, 'No unreviewed change to an existing native input: ' + file);\n assert.equal(expected.mode, sourcePin.currentMode); assert.equal(expected.blob, sourcePin.currentBlob);\n assert.equal(expected.sha256, sourcePin.currentSha256);\n assert.equal(previous.mode, sourcePin.baselineMode); assert.equal(previous.blob, sourcePin.baselineBlob);\n assert.equal(previous.sha256, sourcePin.baselineSha256);\n return Object.freeze({ file, current: Object.freeze({ mode: current.mode, blob: current.blob, sha256: digest(bytes) }),\n  predecessor: previous, predecessorRevision: PREDECESSOR_NATIVE_INPUTS.authoredRevision,\n  relation: 'exact-reviewed-deed-source-provenance-only', nativeAdmission: false, priorResultsTransferred: false });\n}\n"
            }
          ]
        }
      }
    },
    {
      "file": "tools/enterprise-native-ux-seal.js",
      "current": {
        "mode": "100644",
        "sha256": "0ed005b47cc9214b2cb688c4a80f2295093dc3c248193fc0b26be32906f7ef46",
        "blob": "ce068150be2334d8b41618740a6a8ea130338f75",
        "bytes": 5245,
        "rawSha256": {
          "lf": "0ed005b47cc9214b2cb688c4a80f2295093dc3c248193fc0b26be32906f7ef46",
          "crlf": "2d684ecfe33df7f447909baba65e7206946ec41ec19f007287cc030de88c0fce"
        }
      },
      "parents": {
        "monitor": {
          "mode": "100644",
          "sha256": "68019afc0554efaa273c9a008d06dd353b670d88adb6d45fc79c90ed611295c4",
          "blob": "5bdf43a3c48e98557ac6eb49487b56e20130ce2b",
          "bytes": 3639,
          "inverses": [
            {
              "current": "import { execFileSync } from 'node:child_process';\nimport { ENTERPRISE_NATIVE_FILES } from './enterprise-native.js';\nimport { ENTERPRISE_NATIVE_RELEASE_INPUTS } from './enterprise-native-inputs.js';\nimport { ENTERPRISE_UX_METADATA, ENTERPRISE_UX_PREDECESSOR_METADATA, ENTERPRISE_UX_PREDECESSOR_METADATA_SHA256, ENTERPRISE_UX_QUALIFIED_METADATA, ENTERPRISE_UX_QUALIFIED_METADATA_SHA256, enterpriseUxClosure, enterpriseUxMetadataBytes, enterpriseUxReplacementPlan } from './enterprise-native-ux.js';\nimport { ENTERPRISE_NATIVE_UX_INPUTS as predecessorNativeInputs } from './enterprise-native-ux-b35-inputs.js';\nimport { DEED_ALLOCATION_SOURCE_DOMAINS } from './deed-allocation-source-data.js';\nimport { ECONOMY_DEED_MERGE_NATIVE_PROVENANCE, ECONOMY_DEED_MERGE_NATIVE_PROVENANCE_SHA256 } from './economy-deed-merge-source-data.js';\nimport { assertEconomyDeedNativeProvenanceDefinition } from './economy-deed-merge-source-compatibility.js';\nconst revision = process.argv[2], predecessorRevision = 'c6247976ff71e8d4c103ebd1498c2d373217d077', uxRevision = '940df6a1efbe4ddcd8301cd138d5643dbe48a0bc';\nassert.equal(process.argv.length, 3, 'Usage: node tools/enterprise-native-ux-seal.js <authored-commit>'); assert.match(revision || '', /^[a-f0-9]{40}$/);\nconst git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { windowsHide: true, maxBuffer: 64 * 1024 * 1024 });\nconst sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');\ngit('merge-base', '--is-ancestor', predecessorRevision, revision); git('merge-base', '--is-ancestor', uxRevision, revision); git('merge-base', '--is-ancestor', ENTERPRISE_NATIVE_RELEASE_INPUTS.revision, revision);\nassertEconomyDeedNativeProvenanceDefinition();\ngit('merge-base', '--is-ancestor', ECONOMY_DEED_MERGE_NATIVE_PROVENANCE.sourceRevision, revision);\nassert.equal(ECONOMY_DEED_MERGE_NATIVE_PROVENANCE.predecessorRevision, predecessorNativeInputs.authoredRevision);\nassert.equal(ECONOMY_DEED_MERGE_NATIVE_PROVENANCE.predecessorDefinitionSha256, sha(JSON.stringify(predecessorNativeInputs)));\nconst read = file => git('show', revision + ':' + file);\nconst legacyAdditions = new Map(ENTERPRISE_NATIVE_RELEASE_INPUTS.additions.map(row => [row.file, row]));\nconst record = (rev, file, allowAbsence = false) => {\n",
              "baseline": "import { execFileSync } from 'node:child_process';\nimport { ENTERPRISE_NATIVE_FILES } from './enterprise-native.js';\nimport { ENTERPRISE_NATIVE_RELEASE_INPUTS } from './enterprise-native-inputs.js';\nimport { ENTERPRISE_UX_METADATA, enterpriseUxClosure, enterpriseUxMetadataBytes, enterpriseUxReplacementPlan } from './enterprise-native-ux.js';\nconst revision = process.argv[2], predecessorRevision = 'c6247976ff71e8d4c103ebd1498c2d373217d077', uxRevision = '940df6a1efbe4ddcd8301cd138d5643dbe48a0bc';\nassert.equal(process.argv.length, 3, 'Usage: node tools/enterprise-native-ux-seal.js <authored-commit>'); assert.match(revision || '', /^[a-f0-9]{40}$/);\nconst git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { windowsHide: true, maxBuffer: 64 * 1024 * 1024 });\nconst sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');\ngit('merge-base', '--is-ancestor', predecessorRevision, revision); git('merge-base', '--is-ancestor', uxRevision, revision); git('merge-base', '--is-ancestor', ENTERPRISE_NATIVE_RELEASE_INPUTS.revision, revision);\nconst read = file => git('show', revision + ':' + file);\nconst legacyAdditions = new Map(ENTERPRISE_NATIVE_RELEASE_INPUTS.additions.map(row => [row.file, row]));\nconst record = (rev, file, allowAbsence = false) => {\n"
            },
            {
              "current": "const inventory = enterpriseUxClosure(ENTERPRISE_NATIVE_FILES, read), files = inventory.map(file => record(revision, file));\nconst predecessorPin = (file) => { const before = record(predecessorRevision, file, true); if (before !== null) return before; const legacy = legacyAdditions.get(file); assert(legacy, 'Only a sealed legacy addition may be absent from the UX predecessor: ' + file); assert.deepEqual(record(ENTERPRISE_NATIVE_RELEASE_INPUTS.revision, file), legacy, 'Legacy-addition baseline matches its exact sealed Git bytes'); return null; };\nconst plan = enterpriseUxReplacementPlan(ENTERPRISE_NATIVE_FILES, ENTERPRISE_NATIVE_RELEASE_INPUTS, files, predecessorPin);\nassert.equal(sha(read(ENTERPRISE_UX_PREDECESSOR_METADATA)), ENTERPRISE_UX_PREDECESSOR_METADATA_SHA256, 'Never reseal a rewritten predecessor native manifest');\nassert.equal(sha(read(ENTERPRISE_UX_QUALIFIED_METADATA)), ENTERPRISE_UX_QUALIFIED_METADATA_SHA256, 'Never reseal a rewritten qualified UX manifest');\nconst value = { version: 3, status: 'SEALED', phase: 'ACTUAL_ENTERPRISE_DEED_NATIVE_INPUTS', authoredRevision: revision, predecessorRevision, uxRevision,\n nativePredecessorRevision: predecessorNativeInputs.authoredRevision,\n nativePredecessorMetadataSha256: sha(read(ENTERPRISE_UX_PREDECESSOR_METADATA)),\n deedSourceDefinitionSha256: sha(JSON.stringify(DEED_ALLOCATION_SOURCE_DOMAINS)),\n economyDeedProvenanceDefinitionSha256: ECONOMY_DEED_MERGE_NATIVE_PROVENANCE_SHA256,\n legacyRevision: ENTERPRISE_NATIVE_RELEASE_INPUTS.revision, legacyDefinitionSha256: sha(JSON.stringify(ENTERPRISE_NATIVE_RELEASE_INPUTS)), legacyInventorySha256: sha(JSON.stringify(ENTERPRISE_NATIVE_FILES)), files, replacements: plan.replacements, legacyAdditionReplacements: plan.legacyAdditionReplacements, additions: files.slice(ENTERPRISE_NATIVE_FILES.length) };\nfs.writeFileSync(new URL('../' + ENTERPRISE_UX_METADATA, import.meta.url), enterpriseUxMetadataBytes(value));\nconsole.log(JSON.stringify({ authoredRevision: revision, actualInputs: files.length, replacements: plan.replacements.length, legacyAdditionReplacements: plan.legacyAdditionReplacements.length, additions: value.additions.length, onlySelfReference: ENTERPRISE_UX_METADATA, nativeResultsTransferred: false }));\n",
              "baseline": "const inventory = enterpriseUxClosure(ENTERPRISE_NATIVE_FILES, read), files = inventory.map(file => record(revision, file));\nconst predecessorPin = (file) => { const before = record(predecessorRevision, file, true); if (before !== null) return before; const legacy = legacyAdditions.get(file); assert(legacy, 'Only a sealed legacy addition may be absent from the UX predecessor: ' + file); assert.deepEqual(record(ENTERPRISE_NATIVE_RELEASE_INPUTS.revision, file), legacy, 'Legacy-addition baseline matches its exact sealed Git bytes'); return null; };\nconst plan = enterpriseUxReplacementPlan(ENTERPRISE_NATIVE_FILES, ENTERPRISE_NATIVE_RELEASE_INPUTS, files, predecessorPin);\nconst value = { version: 2, status: 'SEALED', phase: 'ACTUAL_ENTERPRISE_UX_NATIVE_INPUTS', authoredRevision: revision, predecessorRevision, uxRevision, legacyRevision: ENTERPRISE_NATIVE_RELEASE_INPUTS.revision, legacyDefinitionSha256: sha(JSON.stringify(ENTERPRISE_NATIVE_RELEASE_INPUTS)), legacyInventorySha256: sha(JSON.stringify(ENTERPRISE_NATIVE_FILES)), files, replacements: plan.replacements, legacyAdditionReplacements: plan.legacyAdditionReplacements, additions: files.slice(ENTERPRISE_NATIVE_FILES.length) };\nfs.writeFileSync(new URL('./enterprise-native-ux-inputs.js', import.meta.url), enterpriseUxMetadataBytes(value));\nconsole.log(JSON.stringify({ authoredRevision: revision, actualInputs: files.length, replacements: plan.replacements.length, legacyAdditionReplacements: plan.legacyAdditionReplacements.length, additions: value.additions.length, onlySelfReference: ENTERPRISE_UX_METADATA, nativeResultsTransferred: false }));\n"
            }
          ]
        },
        "deed": {
          "mode": "100644",
          "sha256": "2a96e83125ce88e884165ef6672d9d175b6e8e092c41a078a6a256776b959b4b",
          "blob": "e92bc4c2f7b57a28be315e760ef5ec199b9172ef",
          "bytes": 4529,
          "inverses": [
            {
              "current": "import { ENTERPRISE_UX_METADATA, ENTERPRISE_UX_PREDECESSOR_METADATA, ENTERPRISE_UX_PREDECESSOR_METADATA_SHA256, ENTERPRISE_UX_QUALIFIED_METADATA, ENTERPRISE_UX_QUALIFIED_METADATA_SHA256, enterpriseUxClosure, enterpriseUxMetadataBytes, enterpriseUxReplacementPlan } from './enterprise-native-ux.js';\nimport { ENTERPRISE_NATIVE_UX_INPUTS as predecessorNativeInputs } from './enterprise-native-ux-b35-inputs.js';\nimport { DEED_ALLOCATION_SOURCE_DOMAINS } from './deed-allocation-source-data.js';\nimport { ECONOMY_DEED_MERGE_NATIVE_PROVENANCE, ECONOMY_DEED_MERGE_NATIVE_PROVENANCE_SHA256 } from './economy-deed-merge-source-data.js';\nimport { assertEconomyDeedNativeProvenanceDefinition } from './economy-deed-merge-source-compatibility.js';\nconst revision = process.argv[2], predecessorRevision = 'c6247976ff71e8d4c103ebd1498c2d373217d077', uxRevision = '940df6a1efbe4ddcd8301cd138d5643dbe48a0bc';\nassert.equal(process.argv.length, 3, 'Usage: node tools/enterprise-native-ux-seal.js <authored-commit>'); assert.match(revision || '', /^[a-f0-9]{40}$/);\nconst git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { windowsHide: true, maxBuffer: 64 * 1024 * 1024 });\nconst sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');\ngit('merge-base', '--is-ancestor', predecessorRevision, revision); git('merge-base', '--is-ancestor', uxRevision, revision); git('merge-base', '--is-ancestor', ENTERPRISE_NATIVE_RELEASE_INPUTS.revision, revision);\nassertEconomyDeedNativeProvenanceDefinition();\ngit('merge-base', '--is-ancestor', ECONOMY_DEED_MERGE_NATIVE_PROVENANCE.sourceRevision, revision);\nassert.equal(ECONOMY_DEED_MERGE_NATIVE_PROVENANCE.predecessorRevision, predecessorNativeInputs.authoredRevision);\nassert.equal(ECONOMY_DEED_MERGE_NATIVE_PROVENANCE.predecessorDefinitionSha256, sha(JSON.stringify(predecessorNativeInputs)));\nconst read = file => git('show', revision + ':' + file);\nconst legacyAdditions = new Map(ENTERPRISE_NATIVE_RELEASE_INPUTS.additions.map(row => [row.file, row]));\nconst record = (rev, file, allowAbsence = false) => {\n",
              "baseline": "import { ENTERPRISE_UX_METADATA, ENTERPRISE_UX_PREDECESSOR_METADATA, ENTERPRISE_UX_PREDECESSOR_METADATA_SHA256, ENTERPRISE_UX_QUALIFIED_METADATA, ENTERPRISE_UX_QUALIFIED_METADATA_SHA256, enterpriseUxClosure, enterpriseUxMetadataBytes, enterpriseUxReplacementPlan } from './enterprise-native-ux.js';\nimport { ENTERPRISE_NATIVE_UX_INPUTS as predecessorNativeInputs } from './enterprise-native-ux-b35-inputs.js';\nimport { DEED_ALLOCATION_SOURCE_DOMAINS } from './deed-allocation-source-data.js';\nconst revision = process.argv[2], predecessorRevision = 'c6247976ff71e8d4c103ebd1498c2d373217d077', uxRevision = '940df6a1efbe4ddcd8301cd138d5643dbe48a0bc';\nassert.equal(process.argv.length, 3, 'Usage: node tools/enterprise-native-ux-seal.js <authored-commit>'); assert.match(revision || '', /^[a-f0-9]{40}$/);\nconst git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { windowsHide: true, maxBuffer: 64 * 1024 * 1024 });\nconst sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');\ngit('merge-base', '--is-ancestor', predecessorRevision, revision); git('merge-base', '--is-ancestor', uxRevision, revision); git('merge-base', '--is-ancestor', ENTERPRISE_NATIVE_RELEASE_INPUTS.revision, revision);\nconst read = file => git('show', revision + ':' + file);\nconst legacyAdditions = new Map(ENTERPRISE_NATIVE_RELEASE_INPUTS.additions.map(row => [row.file, row]));\nconst record = (rev, file, allowAbsence = false) => {\n"
            },
            {
              "current": " nativePredecessorRevision: predecessorNativeInputs.authoredRevision,\n nativePredecessorMetadataSha256: sha(read(ENTERPRISE_UX_PREDECESSOR_METADATA)),\n deedSourceDefinitionSha256: sha(JSON.stringify(DEED_ALLOCATION_SOURCE_DOMAINS)),\n economyDeedProvenanceDefinitionSha256: ECONOMY_DEED_MERGE_NATIVE_PROVENANCE_SHA256,\n legacyRevision: ENTERPRISE_NATIVE_RELEASE_INPUTS.revision, legacyDefinitionSha256: sha(JSON.stringify(ENTERPRISE_NATIVE_RELEASE_INPUTS)), legacyInventorySha256: sha(JSON.stringify(ENTERPRISE_NATIVE_FILES)), files, replacements: plan.replacements, legacyAdditionReplacements: plan.legacyAdditionReplacements, additions: files.slice(ENTERPRISE_NATIVE_FILES.length) };\nfs.writeFileSync(new URL('../' + ENTERPRISE_UX_METADATA, import.meta.url), enterpriseUxMetadataBytes(value));\nconsole.log(JSON.stringify({ authoredRevision: revision, actualInputs: files.length, replacements: plan.replacements.length, legacyAdditionReplacements: plan.legacyAdditionReplacements.length, additions: value.additions.length, onlySelfReference: ENTERPRISE_UX_METADATA, nativeResultsTransferred: false }));\n",
              "baseline": " nativePredecessorRevision: predecessorNativeInputs.authoredRevision,\n nativePredecessorMetadataSha256: sha(read(ENTERPRISE_UX_PREDECESSOR_METADATA)),\n deedSourceDefinitionSha256: sha(JSON.stringify(DEED_ALLOCATION_SOURCE_DOMAINS)),\n legacyRevision: ENTERPRISE_NATIVE_RELEASE_INPUTS.revision, legacyDefinitionSha256: sha(JSON.stringify(ENTERPRISE_NATIVE_RELEASE_INPUTS)), legacyInventorySha256: sha(JSON.stringify(ENTERPRISE_NATIVE_FILES)), files, replacements: plan.replacements, legacyAdditionReplacements: plan.legacyAdditionReplacements, additions: files.slice(ENTERPRISE_NATIVE_FILES.length) };\nfs.writeFileSync(new URL('../' + ENTERPRISE_UX_METADATA, import.meta.url), enterpriseUxMetadataBytes(value));\nconsole.log(JSON.stringify({ authoredRevision: revision, actualInputs: files.length, replacements: plan.replacements.length, legacyAdditionReplacements: plan.legacyAdditionReplacements.length, additions: value.additions.length, onlySelfReference: ENTERPRISE_UX_METADATA, nativeResultsTransferred: false }));\n"
            }
          ]
        }
      }
    },
    {
      "file": "tools/enterprise-native.js",
      "current": {
        "mode": "100644",
        "sha256": "e75e51b8f04badbecf819c15f50f4b0c36dcfd52e3710e851acd962014818868",
        "blob": "c2c4d0393840d7048046989dec643c4f07746c6e",
        "bytes": 46559,
        "rawSha256": {
          "lf": "e75e51b8f04badbecf819c15f50f4b0c36dcfd52e3710e851acd962014818868",
          "crlf": "906a3a5aa2d5f48595f273c06fe655ccad9909209e39f475ec5d8475f04a3fbd"
        }
      },
      "parents": {
        "monitor": {
          "mode": "100644",
          "sha256": "12b218541f988366ae91c570ec4a05bf18e5a717d9afcda7e8bc1f825e7888d4",
          "blob": "5eb580ee6c27e3b1d9938b4829f97da1221dcca2",
          "bytes": 46240,
          "inverses": [
            {
              "current": "import {ENTERPRISE_NATIVE_BASE_REVISION,ENTERPRISE_NATIVE_FILES as HISTORICAL_ENTERPRISE_NATIVE_FILES,ENTERPRISE_NATIVE_BASE_INPUTS,ENTERPRISE_NATIVE_BINARY_FILES,ENTERPRISE_NATIVE_DIRECTORY_MEMBERSHIPS,ENTERPRISE_NATIVE_RELEASE_INPUTS} from './enterprise-native-inputs.js';\nimport {ENTERPRISE_NATIVE_CONTINUOUS_CITY_INPUTS as CURRENT_GUI_INPUTS} from './enterprise-native-continuous-city-inputs.js';\nimport {ENTERPRISE_UX_METADATA,assertEnterpriseUxInputDefinition,assertEnterpriseUxTrackedInput,assertEnterpriseUxMetadataBytes,assertEnterpriseUxReplacementPlan,enterpriseUxClosure} from './enterprise-native-ux.js';\nimport {ECONOMY_DEED_MERGE_NATIVE_PROVENANCE} from './economy-deed-merge-source-data.js';\n\nconst SUCCESSOR_DATA='tools/enterprise-native-continuous-city-inputs.js';\nconst SUCCESSOR_PREDECESSOR='792f1da708375fc28fca6fe9c4fb9c2c7c756ee6';\n",
              "baseline": "import {ENTERPRISE_NATIVE_BASE_REVISION,ENTERPRISE_NATIVE_FILES as HISTORICAL_ENTERPRISE_NATIVE_FILES,ENTERPRISE_NATIVE_BASE_INPUTS,ENTERPRISE_NATIVE_BINARY_FILES,ENTERPRISE_NATIVE_DIRECTORY_MEMBERSHIPS,ENTERPRISE_NATIVE_RELEASE_INPUTS} from './enterprise-native-inputs.js';\nimport {ENTERPRISE_NATIVE_CONTINUOUS_CITY_INPUTS as CURRENT_GUI_INPUTS} from './enterprise-native-continuous-city-inputs.js';\nimport {ENTERPRISE_UX_METADATA,assertEnterpriseUxInputDefinition,assertEnterpriseUxTrackedInput,assertEnterpriseUxMetadataBytes,assertEnterpriseUxReplacementPlan,enterpriseUxClosure} from './enterprise-native-ux.js';\n\nconst SUCCESSOR_DATA='tools/enterprise-native-continuous-city-inputs.js';\nconst SUCCESSOR_PREDECESSOR='792f1da708375fc28fca6fe9c4fb9c2c7c756ee6';\n"
            },
            {
              "current": "function tree(revision){return git('ls-tree','-r','-z',revision).toString().split('\\0').filter(Boolean).map(line=>{const i=line.indexOf('\\t'),[mode,type,blob]=line.slice(0,i).split(' ');return{file:line.slice(i+1),mode,type,blob,line};});}\nexport function captureEnterpriseSource(){\n const successor=assertEnterpriseCombinedInputDefinition(),ux=assertEnterpriseUxInputDefinition(ENTERPRISE_NATIVE_FILES,successor),revision=textGit('rev-parse','HEAD');assert.match(revision,/^[a-f0-9]{40}$/);assert.equal(textGit('status','--porcelain','--untracked-files=all'),'','Clean exact committed source required');\n git('merge-base','--is-ancestor',ECONOMY_DEED_MERGE_NATIVE_PROVENANCE.sourceRevision,ux.authoredRevision);\n assertHistoricalGUIWitness();assertCurrentGUIWitness();git('merge-base','--is-ancestor',COMMERCE_SOURCE,successor.revision);git('merge-base','--is-ancestor',CURRENT_GUI_SOURCE,successor.revision);git('merge-base','--is-ancestor',successor.revision,revision);\n git('merge-base','--is-ancestor',successor.revision,ux.authoredRevision);git('merge-base','--is-ancestor',ux.predecessorRevision,ux.authoredRevision);git('merge-base','--is-ancestor',ux.uxRevision,ux.authoredRevision);git('merge-base','--is-ancestor',ux.authoredRevision,revision);\n const records=tree(revision),current=new Map(records.map(r=>[r.file,r])),base=new Map(tree(ENTERPRISE_NATIVE_BASE_REVISION).map(r=>[r.file,r])),authored=new Map(tree(ux.authoredRevision).map(r=>[r.file,r])),predecessor=new Map(tree(ux.predecessorRevision).map(r=>[r.file,r])),legacyTree=new Map(tree(ux.legacyRevision).map(r=>[r.file,r])),legacyAdditions=new Map(successor.additions.map(r=>[r.file,r])),pins=new Map(ENTERPRISE_NATIVE_BASE_INPUTS.map(r=>[r.file,r])),binary=new Set(ENTERPRISE_NATIVE_BINARY_FILES),files={},sourceProvenance={};\n assert.equal(new Set(ENTERPRISE_NATIVE_FILES).size,ENTERPRISE_NATIVE_FILES.length,'Complete combined input inventory has no duplicates');\n assert.deepEqual(enterpriseUxClosure(ENTERPRISE_NATIVE_FILES,f=>git('show',ux.authoredRevision+':'+f)),ux.files.map(r=>r.file),'Actual current import/asset closure is complete');\n const predecessorPin=(file,after)=>{const before=predecessor.get(file);if(before){assert(before.type==='blob'&&['100644','100755'].includes(before.mode),'Regular predecessor native input: '+file);return Object.freeze({file,mode:before.mode,blob:before.blob,sha256:before.blob===after.blob?after.sha256:sha(git('show',ux.predecessorRevision+':'+file))});}const legacy=legacyAdditions.get(file),actual=legacyTree.get(file);assert(legacy,'Only a sealed legacy addition may be absent from the UX predecessor: '+file);assert(actual&&actual.type==='blob','Legacy-addition Git baseline exists: '+file);assert.equal(actual.mode,legacy.mode,'Legacy-addition baseline mode: '+file);assert.equal(actual.blob,legacy.blob,'Legacy-addition baseline blob: '+file);assert.equal(sha(git('show',ux.legacyRevision+':'+file)),legacy.sha256,'Legacy-addition baseline bytes: '+file);return null;};\n",
              "baseline": "function tree(revision){return git('ls-tree','-r','-z',revision).toString().split('\\0').filter(Boolean).map(line=>{const i=line.indexOf('\\t'),[mode,type,blob]=line.slice(0,i).split(' ');return{file:line.slice(i+1),mode,type,blob,line};});}\nexport function captureEnterpriseSource(){\n const successor=assertEnterpriseCombinedInputDefinition(),ux=assertEnterpriseUxInputDefinition(ENTERPRISE_NATIVE_FILES,successor),revision=textGit('rev-parse','HEAD');assert.match(revision,/^[a-f0-9]{40}$/);assert.equal(textGit('status','--porcelain','--untracked-files=all'),'','Clean exact committed source required');\n assertHistoricalGUIWitness();assertCurrentGUIWitness();git('merge-base','--is-ancestor',COMMERCE_SOURCE,successor.revision);git('merge-base','--is-ancestor',CURRENT_GUI_SOURCE,successor.revision);git('merge-base','--is-ancestor',successor.revision,revision);\n git('merge-base','--is-ancestor',successor.revision,ux.authoredRevision);git('merge-base','--is-ancestor',ux.predecessorRevision,ux.authoredRevision);git('merge-base','--is-ancestor',ux.uxRevision,ux.authoredRevision);git('merge-base','--is-ancestor',ux.authoredRevision,revision);\n const records=tree(revision),current=new Map(records.map(r=>[r.file,r])),base=new Map(tree(ENTERPRISE_NATIVE_BASE_REVISION).map(r=>[r.file,r])),authored=new Map(tree(ux.authoredRevision).map(r=>[r.file,r])),predecessor=new Map(tree(ux.predecessorRevision).map(r=>[r.file,r])),legacyTree=new Map(tree(ux.legacyRevision).map(r=>[r.file,r])),legacyAdditions=new Map(successor.additions.map(r=>[r.file,r])),pins=new Map(ENTERPRISE_NATIVE_BASE_INPUTS.map(r=>[r.file,r])),binary=new Set(ENTERPRISE_NATIVE_BINARY_FILES),files={};\n assert.equal(new Set(ENTERPRISE_NATIVE_FILES).size,ENTERPRISE_NATIVE_FILES.length,'Complete combined input inventory has no duplicates');\n assert.deepEqual(enterpriseUxClosure(ENTERPRISE_NATIVE_FILES,f=>git('show',ux.authoredRevision+':'+f)),ux.files.map(r=>r.file),'Actual current import/asset closure is complete');\n const predecessorPin=(file,after)=>{const before=predecessor.get(file);if(before){assert(before.type==='blob'&&['100644','100755'].includes(before.mode),'Regular predecessor native input: '+file);return Object.freeze({file,mode:before.mode,blob:before.blob,sha256:before.blob===after.blob?after.sha256:sha(git('show',ux.predecessorRevision+':'+file))});}const legacy=legacyAdditions.get(file),actual=legacyTree.get(file);assert(legacy,'Only a sealed legacy addition may be absent from the UX predecessor: '+file);assert(actual&&actual.type==='blob','Legacy-addition Git baseline exists: '+file);assert.equal(actual.mode,legacy.mode,'Legacy-addition baseline mode: '+file);assert.equal(actual.blob,legacy.blob,'Legacy-addition baseline blob: '+file);assert.equal(sha(git('show',ux.legacyRevision+':'+file)),legacy.sha256,'Legacy-addition baseline bytes: '+file);return null;};\n"
            },
            {
              "current": "  else{\n   if(STAGED.includes(f)){const actual=authored.get(f);assert(actual&&actual.type==='blob'&&tracked.mode===actual.mode,'Exact authored staged mode required');assert.equal(tracked.blob,actual.blob,'Every existing staged input, including old metadata, remains exact');}\n   if(!STAGED.includes(f)){const pin=pins.get(f),old=base.get(f);if(pin){assert(old&&old.type==='blob');assert.equal(old.blob,pin.blob,f);assert.equal(old.mode,tracked.mode,f);assert.equal(sha(git('show',ENTERPRISE_NATIVE_BASE_REVISION+':'+f)),pin.sha256,f);}}\n   const provenance=assertEnterpriseUxTrackedInput(f,tracked,authored.get(f),canonical,ux);if(provenance)sourceProvenance[f]=provenance;\n  }\n  files[f]={sha256:sha(raw),gitSha256:sha(canonical),blob:tracked.blob,binary:binary.has(f),bytes:raw.length};\n }\n const result={revision,baseRevision:ENTERPRISE_NATIVE_BASE_REVISION,authoredRevision:ux.authoredRevision,legacyAuthoredRevision:successor.revision,commerceRevision:successor.commerceSource,guiRevision:successor.guiSource,historicalGUIAuthoredRevision:GUI_AUTHORED_REVISION,fullGitTreeSha256:sha(JSON.stringify(records.map(r=>r.line).sort())),stagedFiles:[...STAGED],historicalStagedFiles:[...STAGED],successorReplacements:successor.replacements.map(row=>row.file),successorAdditions:successor.additions.map(row=>row.file),uxReplacements:replacementPlan.replacements.map(row=>row.file),uxLegacyAdditionReplacements:replacementPlan.legacyAdditionReplacements.map(row=>row.file),uxAdditions:ux.additions.map(row=>row.file),uxMetadataSelfReference:ENTERPRISE_UX_METADATA,nativeInputProvenance:sourceProvenance,priorNativeResultsTransferred:false,directoryMemberships:inspectDirectories(),directoryPredicateSource:{file:'src/server.js',...files['src/server.js']},files};assertStable(result);return result;\n}\nfunction assertStable(source){assert.equal(textGit('rev-parse','HEAD'),source.revision);assert.equal(textGit('status','--porcelain','--untracked-files=all'),'');for(const[f,p]of Object.entries(source.files)){const file=path.join(ROOT,f),stat=fs.lstatSync(file);assert(stat.isFile()&&!stat.isSymbolicLink());assert.equal(stat.size,p.bytes,'Actual boot stat size changed: '+f);assert.equal(sha(fs.readFileSync(file)),p.sha256,'Input changed during qualification: '+f);}assert.deepEqual(inspectDirectories(),source.directoryMemberships);}\nexport function assertEnterpriseBackend(row,profile,port){assert(profile==='local'||profile==='ci');assert.deepEqual(Object.keys(row).sort(),['role','database','version','directory'].sort());assert.equal(row.role,profile==='local'?'pilot_runner':'postgres');assert.equal(row.database,'postgres');assert.equal(typeof row.directory,'string');assert(row.directory.length);if(profile==='local'){assert(port===35439||port===35449);assert.match(row.version,/^18\\.4\\b/);assert.equal(row.directory.replaceAll('\\\\','/').toLowerCase(),DIRECTORIES[port]);}else{assert.equal(port,5432);assert.match(row.version,/^(?:16\\b|18\\.4\\b)/);}}\n",
              "baseline": "  else{\n   if(STAGED.includes(f)){const actual=authored.get(f);assert(actual&&actual.type==='blob'&&tracked.mode===actual.mode,'Exact authored staged mode required');assert.equal(tracked.blob,actual.blob,'Every existing staged input, including old metadata, remains exact');}\n   if(!STAGED.includes(f)){const pin=pins.get(f),old=base.get(f);if(pin){assert(old&&old.type==='blob');assert.equal(old.blob,pin.blob,f);assert.equal(old.mode,tracked.mode,f);assert.equal(sha(git('show',ENTERPRISE_NATIVE_BASE_REVISION+':'+f)),pin.sha256,f);}}\n   assertEnterpriseUxTrackedInput(f,tracked,authored.get(f),canonical,ux);\n  }\n  files[f]={sha256:sha(raw),gitSha256:sha(canonical),blob:tracked.blob,binary:binary.has(f),bytes:raw.length};\n }\n const result={revision,baseRevision:ENTERPRISE_NATIVE_BASE_REVISION,authoredRevision:ux.authoredRevision,legacyAuthoredRevision:successor.revision,commerceRevision:successor.commerceSource,guiRevision:successor.guiSource,historicalGUIAuthoredRevision:GUI_AUTHORED_REVISION,fullGitTreeSha256:sha(JSON.stringify(records.map(r=>r.line).sort())),stagedFiles:[...STAGED],historicalStagedFiles:[...STAGED],successorReplacements:successor.replacements.map(row=>row.file),successorAdditions:successor.additions.map(row=>row.file),uxReplacements:replacementPlan.replacements.map(row=>row.file),uxLegacyAdditionReplacements:replacementPlan.legacyAdditionReplacements.map(row=>row.file),uxAdditions:ux.additions.map(row=>row.file),uxMetadataSelfReference:ENTERPRISE_UX_METADATA,priorNativeResultsTransferred:false,directoryMemberships:inspectDirectories(),directoryPredicateSource:{file:'src/server.js',...files['src/server.js']},files};assertStable(result);return result;\n}\nfunction assertStable(source){assert.equal(textGit('rev-parse','HEAD'),source.revision);assert.equal(textGit('status','--porcelain','--untracked-files=all'),'');for(const[f,p]of Object.entries(source.files)){const file=path.join(ROOT,f),stat=fs.lstatSync(file);assert(stat.isFile()&&!stat.isSymbolicLink());assert.equal(stat.size,p.bytes,'Actual boot stat size changed: '+f);assert.equal(sha(fs.readFileSync(file)),p.sha256,'Input changed during qualification: '+f);}assert.deepEqual(inspectDirectories(),source.directoryMemberships);}\nexport function assertEnterpriseBackend(row,profile,port){assert(profile==='local'||profile==='ci');assert.deepEqual(Object.keys(row).sort(),['role','database','version','directory'].sort());assert.equal(row.role,profile==='local'?'pilot_runner':'postgres');assert.equal(row.database,'postgres');assert.equal(typeof row.directory,'string');assert(row.directory.length);if(profile==='local'){assert(port===35439||port===35449);assert.match(row.version,/^18\\.4\\b/);assert.equal(row.directory.replaceAll('\\\\','/').toLowerCase(),DIRECTORIES[port]);}else{assert.equal(port,5432);assert.match(row.version,/^(?:16\\b|18\\.4\\b)/);}}\n"
            }
          ]
        },
        "deed": {
          "mode": "100644",
          "sha256": "aab55320cc189995658aa0c03f71cfcc192b980fbbd56a9135ff3bad94432d99",
          "blob": "57132d9d7af79a5dc205fa5a433aab3f8cf9f0c0",
          "bytes": 46361,
          "inverses": [
            {
              "current": "import {ENTERPRISE_NATIVE_BASE_REVISION,ENTERPRISE_NATIVE_FILES as HISTORICAL_ENTERPRISE_NATIVE_FILES,ENTERPRISE_NATIVE_BASE_INPUTS,ENTERPRISE_NATIVE_BINARY_FILES,ENTERPRISE_NATIVE_DIRECTORY_MEMBERSHIPS,ENTERPRISE_NATIVE_RELEASE_INPUTS} from './enterprise-native-inputs.js';\nimport {ENTERPRISE_NATIVE_CONTINUOUS_CITY_INPUTS as CURRENT_GUI_INPUTS} from './enterprise-native-continuous-city-inputs.js';\nimport {ENTERPRISE_UX_METADATA,assertEnterpriseUxInputDefinition,assertEnterpriseUxTrackedInput,assertEnterpriseUxMetadataBytes,assertEnterpriseUxReplacementPlan,enterpriseUxClosure} from './enterprise-native-ux.js';\nimport {ECONOMY_DEED_MERGE_NATIVE_PROVENANCE} from './economy-deed-merge-source-data.js';\n\nconst SUCCESSOR_DATA='tools/enterprise-native-continuous-city-inputs.js';\nconst SUCCESSOR_PREDECESSOR='792f1da708375fc28fca6fe9c4fb9c2c7c756ee6';\n",
              "baseline": "import {ENTERPRISE_NATIVE_BASE_REVISION,ENTERPRISE_NATIVE_FILES as HISTORICAL_ENTERPRISE_NATIVE_FILES,ENTERPRISE_NATIVE_BASE_INPUTS,ENTERPRISE_NATIVE_BINARY_FILES,ENTERPRISE_NATIVE_DIRECTORY_MEMBERSHIPS,ENTERPRISE_NATIVE_RELEASE_INPUTS} from './enterprise-native-inputs.js';\nimport {ENTERPRISE_NATIVE_CONTINUOUS_CITY_INPUTS as CURRENT_GUI_INPUTS} from './enterprise-native-continuous-city-inputs.js';\nimport {ENTERPRISE_UX_METADATA,assertEnterpriseUxInputDefinition,assertEnterpriseUxTrackedInput,assertEnterpriseUxMetadataBytes,assertEnterpriseUxReplacementPlan,enterpriseUxClosure} from './enterprise-native-ux.js';\n\nconst SUCCESSOR_DATA='tools/enterprise-native-continuous-city-inputs.js';\nconst SUCCESSOR_PREDECESSOR='792f1da708375fc28fca6fe9c4fb9c2c7c756ee6';\n"
            },
            {
              "current": "function tree(revision){return git('ls-tree','-r','-z',revision).toString().split('\\0').filter(Boolean).map(line=>{const i=line.indexOf('\\t'),[mode,type,blob]=line.slice(0,i).split(' ');return{file:line.slice(i+1),mode,type,blob,line};});}\nexport function captureEnterpriseSource(){\n const successor=assertEnterpriseCombinedInputDefinition(),ux=assertEnterpriseUxInputDefinition(ENTERPRISE_NATIVE_FILES,successor),revision=textGit('rev-parse','HEAD');assert.match(revision,/^[a-f0-9]{40}$/);assert.equal(textGit('status','--porcelain','--untracked-files=all'),'','Clean exact committed source required');\n git('merge-base','--is-ancestor',ECONOMY_DEED_MERGE_NATIVE_PROVENANCE.sourceRevision,ux.authoredRevision);\n assertHistoricalGUIWitness();assertCurrentGUIWitness();git('merge-base','--is-ancestor',COMMERCE_SOURCE,successor.revision);git('merge-base','--is-ancestor',CURRENT_GUI_SOURCE,successor.revision);git('merge-base','--is-ancestor',successor.revision,revision);\n git('merge-base','--is-ancestor',successor.revision,ux.authoredRevision);git('merge-base','--is-ancestor',ux.predecessorRevision,ux.authoredRevision);git('merge-base','--is-ancestor',ux.uxRevision,ux.authoredRevision);git('merge-base','--is-ancestor',ux.authoredRevision,revision);\n const records=tree(revision),current=new Map(records.map(r=>[r.file,r])),base=new Map(tree(ENTERPRISE_NATIVE_BASE_REVISION).map(r=>[r.file,r])),authored=new Map(tree(ux.authoredRevision).map(r=>[r.file,r])),predecessor=new Map(tree(ux.predecessorRevision).map(r=>[r.file,r])),legacyTree=new Map(tree(ux.legacyRevision).map(r=>[r.file,r])),legacyAdditions=new Map(successor.additions.map(r=>[r.file,r])),pins=new Map(ENTERPRISE_NATIVE_BASE_INPUTS.map(r=>[r.file,r])),binary=new Set(ENTERPRISE_NATIVE_BINARY_FILES),files={},sourceProvenance={};\n",
              "baseline": "function tree(revision){return git('ls-tree','-r','-z',revision).toString().split('\\0').filter(Boolean).map(line=>{const i=line.indexOf('\\t'),[mode,type,blob]=line.slice(0,i).split(' ');return{file:line.slice(i+1),mode,type,blob,line};});}\nexport function captureEnterpriseSource(){\n const successor=assertEnterpriseCombinedInputDefinition(),ux=assertEnterpriseUxInputDefinition(ENTERPRISE_NATIVE_FILES,successor),revision=textGit('rev-parse','HEAD');assert.match(revision,/^[a-f0-9]{40}$/);assert.equal(textGit('status','--porcelain','--untracked-files=all'),'','Clean exact committed source required');\n assertHistoricalGUIWitness();assertCurrentGUIWitness();git('merge-base','--is-ancestor',COMMERCE_SOURCE,successor.revision);git('merge-base','--is-ancestor',CURRENT_GUI_SOURCE,successor.revision);git('merge-base','--is-ancestor',successor.revision,revision);\n git('merge-base','--is-ancestor',successor.revision,ux.authoredRevision);git('merge-base','--is-ancestor',ux.predecessorRevision,ux.authoredRevision);git('merge-base','--is-ancestor',ux.uxRevision,ux.authoredRevision);git('merge-base','--is-ancestor',ux.authoredRevision,revision);\n const records=tree(revision),current=new Map(records.map(r=>[r.file,r])),base=new Map(tree(ENTERPRISE_NATIVE_BASE_REVISION).map(r=>[r.file,r])),authored=new Map(tree(ux.authoredRevision).map(r=>[r.file,r])),predecessor=new Map(tree(ux.predecessorRevision).map(r=>[r.file,r])),legacyTree=new Map(tree(ux.legacyRevision).map(r=>[r.file,r])),legacyAdditions=new Map(successor.additions.map(r=>[r.file,r])),pins=new Map(ENTERPRISE_NATIVE_BASE_INPUTS.map(r=>[r.file,r])),binary=new Set(ENTERPRISE_NATIVE_BINARY_FILES),files={},sourceProvenance={};\n"
            }
          ]
        }
      }
    },
    {
      "file": "tools/pgquery.js",
      "current": {
        "mode": "100644",
        "sha256": "9d5ced1d591ab0d5328b686a0f1f0b5937148c721b626c73b6cebf5833a861c6",
        "blob": "40f24c96132606a3ffa4986790ed00606a702089",
        "bytes": 41576,
        "rawSha256": {
          "lf": "9d5ced1d591ab0d5328b686a0f1f0b5937148c721b626c73b6cebf5833a861c6",
          "crlf": "af3c415cc7c2082d03a910d93ec4880f8c7bf450ce5e85be4aea7f4ce236aec0"
        }
      },
      "parents": {
        "monitor": {
          "mode": "100644",
          "sha256": "0676e31ece6b2412bef8b3a5f3e4e8cba35f149d822488dcf1cd0620a2bcead9",
          "blob": "60d7d486af4104d12304ed3871ef7e3d391461d0",
          "bytes": 41576,
          "inverses": [
            {
              "current": "async function modelSocialReceiptQueries(rows) {\n  const sourcePins = Object.freeze({\n    'src/accountdaily.js': 'ec1c5b770146297f4471a839ff8bfbbbeeec44fe607eeadb926fc5c91f39aca3',\n    'src/db.js': '9d8ef3f15ed9141792679808d791b51dd679daf28f9f70768ba9472d3b84cae4',\n    'src/growth.js': 'a56eef048988290bcab08966e9874b74dd84d1275e062e84b1d26c5d1097657b',\n  });\n  const verifyPinnedSource = (rel, raw, expectedHash) => {\n",
              "baseline": "async function modelSocialReceiptQueries(rows) {\n  const sourcePins = Object.freeze({\n    'src/accountdaily.js': 'ec1c5b770146297f4471a839ff8bfbbbeeec44fe607eeadb926fc5c91f39aca3',\n    'src/db.js': 'b81f2db08de8ac9ec4975cb653fd89cbc50e8aeb966726b4ac259f961447ca8c',\n    'src/growth.js': 'a56eef048988290bcab08966e9874b74dd84d1275e062e84b1d26c5d1097657b',\n  });\n  const verifyPinnedSource = (rel, raw, expectedHash) => {\n"
            }
          ]
        },
        "deed": {
          "mode": "100644",
          "sha256": "be9447f2ae9ff8c0263d188029b80fd7d4671510a7b4f8c38503b7ead23e455d",
          "blob": "f8a33c93f7f417a6b7ee2928d6ae4a3720f0cfca",
          "bytes": 35419,
          "inverses": [
            {
              "current": "  return variants;\n}\n\n// The monitor's private readRows dispatcher has exactly two closed callers; its daily SELECT\n// interpolates only one fixed column list. Pin the complete caller authority and scanner corpus,\n// then capture the actual exported monitor at both row-limit extremes and UTC boundaries. None of\n// these three statements needs an unchecked-query allowance: dates, sources and limits stay bound.\nasync function modelEconomyMonitorQueries(rows, dynamicSites) {\n  const rel = 'src/economy-monitor.js';\n  const sourcePin = '2f08e91725b6692a9c846f1528ca099e2ace7461ed29b6d14ae663f4a923095a';\n  const verifySource = raw => {\n    const lf = canonicalSql(raw);\n    if (lf.includes('\\r') || (raw !== lf && raw !== lf.replaceAll('\\n', '\\r\\n'))\n        || createHash('sha256').update(lf).digest('hex') !== sourcePin)\n      throw new Error('economy monitor source changed; review its complete closed SQL model');\n  };\n  const source = readFileSync(path.join(ROOT, rel), 'utf8');\n  verifySource(source);\n  let mutationRejected = false;\n  try { verifySource(source + ' '); }\n  catch (error) {\n    if (!error.message.includes('source changed')) throw error;\n    mutationRejected = true;\n  }\n  if (!mutationRejected) throw new Error('economy monitor SQL model accepted mutated source');\n\n  const checkpoint = \"SELECT props FROM telemetry WHERE event='economy_monitor' ORDER BY at DESC,id DESC LIMIT 1\";\n  const insert = 'INSERT INTO telemetry (id,event,props,at) VALUES ($1,$2,$3,$4)';\n  const dailyTemplate = `SELECT  FROM transactions t LEFT JOIN characters c ON c.id=t.character_id\n      WHERE t.at >= $1 AND t.at <= $2 AND t.currency=$3 AND t.reason=$4\n      ORDER BY t.at DESC,t.id DESC LIMIT $5`;\n  const expectedReadable = [[rel, checkpoint, []], [rel, dailyTemplate, ['COLUMNS']], [rel, insert, []]];\n  const monitorRows = rows.filter(row => row.rel === rel);\n  if (JSON.stringify(monitorRows.map(scannerSignature))\n      !== JSON.stringify(expectedReadable.map(([rel, sql, parts]) => scannerSignature({ rel, sql, parts }))))\n    throw new Error('economy monitor readable SQL call sites changed');\n  const helperSites = dynamicSites.filter(row => row.rel === rel);\n  if (helperSites.length !== 1 || helperSites[0].where !== rel + ':139')\n    throw new Error('economy monitor private SQL dispatcher changed');\n  const dailyRow = monitorRows[1], helper = helperSites[0];\n  const shapes = new Map(['recent', 'daily', 'bounds'].map(name => [name, new Set()]));\n  const { runEconomyMonitor } = await import('../src/economy-monitor.js');\n  for (const rowLimit of [1, 50000]) for (const instant of ['2026-10-31T23:59:59.999Z', '2026-11-01T00:00:00.000Z']) {\n    const now = new Date(instant), calls = [];\n    const client = { query: async (sql, params) => {\n      if (typeof sql !== 'string') throw new Error('economy monitor model captured non-string SQL');\n      calls.push(sql);\n      if (sql === checkpoint) {\n        if (params !== undefined) throw new Error('economy monitor checkpoint acquired unmodeled parameters');\n        return { rows: [] };\n      }\n      if (sql === insert) {\n        if (!Array.isArray(params) || params.length !== 4 || params[1] !== 'economy_monitor'\n            || +params[3] !== +now)\n          throw new Error('economy monitor summary INSERT changed its bound values');\n        return { rows: [] };\n      }\n      const kind = sql.includes('FROM transactions t')\n        ? (sql.includes('t.currency=$3 AND t.reason=$4') ? 'daily' : 'recent')\n        : sql.includes(\"event='economy_payout_bound'\") ? 'bounds' : null;\n      if (!kind) throw new Error('economy monitor model captured an unknown dispatcher query');\n      const count = kind === 'daily' ? 5 : 3;\n      const placeholders = [...sql.matchAll(/\\$(\\d+)/g)].map(match => Number(match[1]));\n      if (!Array.isArray(params) || params.length !== count || placeholders.length !== count\n          || placeholders.some((placeholder, index) => placeholder !== index + 1)\n          || !(params[0] instanceof Date) || +params[1] !== +now || params.at(-1) !== rowLimit + 1)\n        throw new Error('economy monitor model did not retain dates and limit as separate bound values');\n      if (kind === 'daily' && (!['cash', 'omr'].includes(params[2]) || typeof params[3] !== 'string'))\n        throw new Error('economy monitor daily source values are not bound');\n      shapes.get(kind).add(sql);\n      return { rows: [] };\n    } };\n    const summary = await runEconomyMonitor(client, { now, rowLimit, ledgerRowsWarn: 1000,\n      netCashWarn: 10000000, netOmrWarn: 1000 });\n    if (!summary.ok || calls.length !== summary.dailySources.length + 4\n        || calls[0] !== checkpoint || calls.at(-1) !== insert)\n      throw new Error('economy monitor model did not execute its complete closed query path');\n  }\n  if ([...shapes.values()].some(set => set.size !== 1))\n    throw new Error('economy monitor dates or row limits changed a closed SQL shape');\n  return { variants: new Map([[dailyRow, [...shapes.get('daily')]]]),\n    helper, helperSql: [...shapes.get('recent'), ...shapes.get('bounds')] };\n}\n\nlet modeledQueries;\nlet monitorModel;\ntry {\n  modeledQueries = await modelSocialReceiptQueries(readable);\n  monitorModel = await modelEconomyMonitorQueries(readable, unreadableSites);\n  for (const [site, sql] of monitorModel.variants) modeledQueries.set(site, sql);\n} catch (error) {\n  console.error('pgquery refused bounded runtime query model: ' + error.message);\n  process.exit(1);\n}\nlet modeledSites = 0, modeledVariants = 0;\n",
              "baseline": "  return variants;\n}\n\nlet modeledQueries;\ntry {\n  modeledQueries = await modelSocialReceiptQueries(readable);\n} catch (error) {\n  console.error('pgquery refused bounded social-receipt query model: ' + error.message);\n  process.exit(1);\n}\nlet modeledSites = 0, modeledVariants = 0;\n"
            },
            {
              "current": "  if (!DML.test(got.sql)) { skipped.push(got.where); continue; }\n  stmts.push({ where: got.where, sql: got.sql });\n}\nif (modeledSites !== 8 || modeledVariants !== 3012) {\n  console.error(`pgquery bounded interpolated models classified ${modeledSites} sites/${modeledVariants} variants (expected 8/3012)`);\n  process.exit(1);\n}\nconst monitorHelperIndex = unreadable.indexOf(monitorModel.helper.where);\nif (monitorHelperIndex < 0 || monitorModel.helperSql.length !== 2)\n  throw new Error('economy monitor modeled dispatcher is not in the unchecked corpus exactly once');\nunreadable.splice(monitorHelperIndex, 1);\nfor (let i = 0; i < monitorModel.helperSql.length; i++)\n  stmts.push({ where: `${monitorModel.helper.where} [closed dispatcher ${i + 1}/2]`, sql: monitorModel.helperSql[i] });\n\n// These four Commerce sites stay counted/listed as UNPREPARED. Whole-source pins close the\n// caller/column authority: a 23-column INSERT with bound values; the forward/undo UPDATE over\n",
              "baseline": "  if (!DML.test(got.sql)) { skipped.push(got.where); continue; }\n  stmts.push({ where: got.where, sql: got.sql });\n}\nif (modeledSites !== 7 || modeledVariants !== 3011) {\n  console.error(`pgquery bounded social-receipt model classified ${modeledSites} sites/${modeledVariants} variants (expected 7/3011)`);\n  process.exit(1);\n}\n\n// These four Commerce sites stay counted/listed as UNPREPARED. Whole-source pins close the\n// caller/column authority: a 23-column INSERT with bound values; the forward/undo UPDATE over\n"
            },
            {
              "current": "// ── 3. REPORT ────────────────────────────────────────────────────────────────────────────────────\nconsole.log(`\\npgquery — ${stmts.length} static/bounded statements prepared against real Postgres`);\nconsole.log(`  ${modeledVariants} generated variants from ${modeledSites} interpolated sites were materialized and prepared`);\nconsole.log('  2 closed SELECT shapes from the economy monitor non-literal dispatcher were captured and prepared');\nconsole.log(`  ${interpolated.length} interpolated (cannot be prepared — counted, never silently passed; PGQUERY_LIST=1 to list)`);\nconsole.log(`  ${skipped.length} non-DML (DDL / transaction control — not preparable by design)`);\nconsole.log(`  ${unreadable.length} call sites whose argument is not a literal (a variable or a helper)\\n`);\n",
              "baseline": "// ── 3. REPORT ────────────────────────────────────────────────────────────────────────────────────\nconsole.log(`\\npgquery — ${stmts.length} static/bounded statements prepared against real Postgres`);\nconsole.log(`  ${modeledVariants} generated variants from ${modeledSites} interpolated sites were materialized and prepared`);\nconsole.log(`  ${interpolated.length} interpolated (cannot be prepared — counted, never silently passed; PGQUERY_LIST=1 to list)`);\nconsole.log(`  ${skipped.length} non-DML (DDL / transaction control — not preparable by design)`);\nconsole.log(`  ${unreadable.length} call sites whose argument is not a literal (a variable or a helper)\\n`);\n"
            },
            {
              "current": "// bounded model above invokes their real runtime generators, materializes every admitted cardinality\n// and closed branch (3,011 statements), and PREPAREs each one. Exact scanner signatures and runtime\n// cap assertions fail closed on drift; the pre-R6 measured interpolated corpus therefore remains 172.\n// Economy monitoring adds one fixed-column interpolation and a two-caller private dispatcher. The\n// pinned runtime model above captures and PREPAREs all three shapes instead of consuming new\n// unchecked-query room. Its one non-literal dispatcher is removed only after that complete model\n// succeeds; the 44-site non-literal ceiling is unchanged.\nconst CEILING = { interpolated: 173, unreadable: 44 };\nconst overflow = [];\nif (interpolated.length > CEILING.interpolated)\n",
              "baseline": "// bounded model above invokes their real runtime generators, materializes every admitted cardinality\n// and closed branch (3,011 statements), and PREPAREs each one. Exact scanner signatures and runtime\n// cap assertions fail closed on drift; the pre-R6 measured interpolated corpus therefore remains 172.\nconst CEILING = { interpolated: 173, unreadable: 44 };\nconst overflow = [];\nif (interpolated.length > CEILING.interpolated)\n"
            }
          ]
        }
      }
    },
    {
      "file": "tools/ux-release-phase2-native-catalog.js",
      "current": {
        "mode": "100644",
        "sha256": "d59e8b81c8ce0ac2caeb3301d164914a4d7a452b3a2b1103060017c08878eb7b",
        "blob": "9627018aedc2700e1cd4a9dc06a3a9c0c100d87d",
        "bytes": 28584,
        "rawSha256": {
          "lf": "d59e8b81c8ce0ac2caeb3301d164914a4d7a452b3a2b1103060017c08878eb7b",
          "crlf": "ca848d6a1fc52a7ab9604e8617dd32da5d83e10816d657b9bd5a73acc6a8534f"
        }
      },
      "parents": {
        "monitor": {
          "mode": "100644",
          "sha256": "fccef92e9a633a8edad3fe543a47bcd9e852d88cbb354b1f19330a0940d26e9a",
          "blob": "03f00b1d21988ff978d8196c8429ef21ba8c5360",
          "bytes": 25797,
          "inverses": [
            {
              "current": "import { economyUxMergeCandidateHistoricalInput,\n  economyUxMergeMainHistoricalInput } from './economy-ux-merge-source-compatibility.js';\nimport { UX_SOURCE, qualifyUxSource } from './ux-source-compatibility.js';\nimport { DEED_BENEFIT_NATIVE_DDL, DEED_BENEFIT_NATIVE_TABLE, assertDeedBenefitNativeMigration,\n  assertDeedBenefitNativeSecurity, deedBenefitNativeRows, deedBenefitNativeProjection } from './deed-benefit-native-catalog.js';\nexport * from './commerce-deed-release-phase2-native-catalog.js';\n\nexport const UX_NATIVE_TABLES = Object.freeze(['ux_community_documents', 'ux_community_entries', 'ux_community_portrait_consents', 'ux_crew_notes', 'ux_crew_signals', 'ux_mentor_subjects', 'ux_workspaces']);\n",
              "baseline": "import { economyUxMergeCandidateHistoricalInput,\n  economyUxMergeMainHistoricalInput } from './economy-ux-merge-source-compatibility.js';\nimport { UX_SOURCE, qualifyUxSource } from './ux-source-compatibility.js';\nexport * from './commerce-deed-release-phase2-native-catalog.js';\n\nexport const UX_NATIVE_TABLES = Object.freeze(['ux_community_documents', 'ux_community_entries', 'ux_community_portrait_consents', 'ux_crew_notes', 'ux_crew_signals', 'ux_mentor_subjects', 'ux_workspaces']);\n"
            },
            {
              "current": "  }\n  assert.equal(settings.role, address.username); assert.equal('/' + settings.database, address.pathname);\n}\nasync function projectedCaller(pool, ux, socialBridge, monitor, benefitNative) {\n  const uxProjection = uxNativeProjection(ux), socialBridgeProjection = socialLegacyBridgeProjection(socialBridge),\n    monitorProjection = monitorNativeProjection(monitor);\n  const projectMetadata = metadata => monitorProjection.projectMetadata(socialBridgeProjection.projectMetadata(\n    uxProjection.projectMetadata(benefitNative.projectMetadata(metadata))));\n  const context = (await pool.query(catalogQueries[0])).rows[0];\n  const verify = async () => { projectMetadata(await original.readCommerceReleasePhase2Metadata(pool)); await assertUxNativeSecurity(pool); await assertDeedBenefitNativeSecurity(pool); };\n  await verify();\n  const wrap = (queryable, guarded) => ({ query: async (sql, values) => {\n    if (guarded && sql === catalogQueries[0]) await verify();\n",
              "baseline": "  }\n  assert.equal(settings.role, address.username); assert.equal('/' + settings.database, address.pathname);\n}\nasync function projectedCaller(pool, ux, socialBridge, monitor) {\n  const uxProjection = uxNativeProjection(ux), socialBridgeProjection = socialLegacyBridgeProjection(socialBridge),\n    monitorProjection = monitorNativeProjection(monitor);\n  const projectMetadata = metadata => monitorProjection.projectMetadata(socialBridgeProjection.projectMetadata(uxProjection.projectMetadata(metadata)));\n  const context = (await pool.query(catalogQueries[0])).rows[0];\n  const verify = async () => { projectMetadata(await original.readCommerceReleasePhase2Metadata(pool)); await assertUxNativeSecurity(pool); };\n  await verify();\n  const wrap = (queryable, guarded) => ({ query: async (sql, values) => {\n    if (guarded && sql === catalogQueries[0]) await verify();\n"
            },
            {
              "current": "      return { ...row, definition: row.definition.replace(prefix, ' ON $self.') };\n    });\n    assert.deepEqual(monitorSelected, monitor[field], 'Every fresh projected SQL result retains the exact monitor ' + field);\n    let benefitRows = deedBenefitNativeRows({ [field]: result.rows }, field);\n    if (field === 'indexes') benefitRows = benefitRows.map(row => {\n      const prefix = ' ON ' + context.schema + '.'; assert.equal(row.definition.split(prefix).length, 2);\n      return { ...row, definition: row.definition.replace(prefix, ' ON $self.') };\n    });\n    assert.deepEqual(benefitRows, benefitNative.reference[field], 'Every fresh projected SQL result retains the complete current marker ' + field);\n    if (guarded) { await assertUxNativeSecurity(pool); await assertDeedBenefitNativeSecurity(pool); }\n    return { ...result, rows: result.rows.filter(row => !names.has(tableOf(field, row)) && !isSocialBridgeRow(field, row)\n      && !isMonitorIndexRow(field, row) && tableOf(field, row) !== DEED_BENEFIT_NATIVE_TABLE) };\n  } });\n  return { ...wrap(pool, true), connect: async () => {\n    const client = await pool.connect();\n",
              "baseline": "      return { ...row, definition: row.definition.replace(prefix, ' ON $self.') };\n    });\n    assert.deepEqual(monitorSelected, monitor[field], 'Every fresh projected SQL result retains the exact monitor ' + field);\n    if (guarded) await assertUxNativeSecurity(pool);\n    return { ...result, rows: result.rows.filter(row => !names.has(tableOf(field, row)) && !isSocialBridgeRow(field, row) && !isMonitorIndexRow(field, row)) };\n  } });\n  return { ...wrap(pool, true), connect: async () => {\n    const client = await pool.connect();\n"
            },
            {
              "current": "}\nexport async function readCommerceReleasePhase2Metadata(pool) {\n  const metadata = await original.readCommerceReleasePhase2Metadata(pool);\n  await assertUxNativeSecurity(pool); await assertDeedBenefitNativeSecurity(pool); return metadata;\n}\nasync function compileCurrentExtensionReference(pool, endpoint) {\n  const schema = 'release_phase2_ref_' + crypto.randomBytes(8).toString('hex');\n",
              "baseline": "}\nexport async function readCommerceReleasePhase2Metadata(pool) {\n  const metadata = await original.readCommerceReleasePhase2Metadata(pool);\n  await assertUxNativeSecurity(pool); return metadata;\n}\nasync function compileCurrentExtensionReference(pool, endpoint) {\n  const schema = 'release_phase2_ref_' + crypto.randomBytes(8).toString('hex');\n"
            },
            {
              "current": "    assert.equal(settings.schema, schema); assert.equal(settings.database, parent.database); assert.equal(settings.role, parent.role);\n    // Compile the monitor index independently of schema.sql and the migrated caller. Only this\n    // exact additive index is projected from the unchanged predecessor's complete catalog proof.\n    await assertDeedBenefitNativeMigration();\n    await client.query('CREATE TABLE characters (id TEXT PRIMARY KEY);\\n' + DEED_BENEFIT_NATIVE_DDL + ';\\n' + socialBridgeDdl + '\\n' + uxDdl\n      + '\\nCREATE TABLE transactions (at TIMESTAMPTZ, id TEXT);\\nCREATE INDEX ix_tx_at_id ON transactions (at, id);');\n    const reference = await original.readCommerceReleasePhase2Metadata(client);\n    assert.deepEqual(reference.relations.map(row => row.name), ['characters', socialBridgeTable, DEED_BENEFIT_NATIVE_TABLE, 'transactions', ...UX_NATIVE_TABLES],\n      'Independent immutable DDL creates exactly the FK target, current marker, social bridge, monitor fixture and seven UX tables');\n    const ux = Object.fromEntries(fields.map(field => [field, uxRows(reference, field)]));\n    assert.deepEqual(ux.relations.map(row => row.name), UX_NATIVE_TABLES, 'Independent immutable DDL creates exactly the seven UX tables');\n    const socialBridge = Object.fromEntries(fields.map(field => [field, socialBridgeRows(reference, field)]));\n",
              "baseline": "    assert.equal(settings.schema, schema); assert.equal(settings.database, parent.database); assert.equal(settings.role, parent.role);\n    // Compile the monitor index independently of schema.sql and the migrated caller. Only this\n    // exact additive index is projected from the unchanged predecessor's complete catalog proof.\n    await client.query(socialBridgeDdl + '\\n' + uxDdl + '\\nCREATE TABLE transactions (at TIMESTAMPTZ, id TEXT);\\nCREATE INDEX ix_tx_at_id ON transactions (at, id);');\n    const reference = await original.readCommerceReleasePhase2Metadata(client);\n    assert.deepEqual(reference.relations.map(row => row.name), [socialBridgeTable, 'transactions', ...UX_NATIVE_TABLES],\n      'Independent immutable DDL creates exactly the social bridge, monitor fixture and seven UX tables');\n    const ux = Object.fromEntries(fields.map(field => [field, uxRows(reference, field)]));\n    assert.deepEqual(ux.relations.map(row => row.name), UX_NATIVE_TABLES, 'Independent immutable DDL creates exactly the seven UX tables');\n    const socialBridge = Object.fromEntries(fields.map(field => [field, socialBridgeRows(reference, field)]));\n"
            },
            {
              "current": "      definition: 'CREATE INDEX ix_tx_at_id ON $self.transactions USING btree (at, id)',\n      unique: false, primary: false, valid: true, ready: true, live: true, nulls_not_distinct: false, predicate: null }],\n    'Independent fixed DDL compiles the exact complete monitor index catalog row');\n    const benefitNative = deedBenefitNativeProjection(Object.fromEntries(fields.map(field =>\n      [field, deedBenefitNativeRows(reference, field)])), version);\n    return freeze({ ux, socialBridge, monitor, benefitNative });\n  } finally {\n    await client?.end();\n    if (created) {\n",
              "baseline": "      definition: 'CREATE INDEX ix_tx_at_id ON $self.transactions USING btree (at, id)',\n      unique: false, primary: false, valid: true, ready: true, live: true, nulls_not_distinct: false, predicate: null }],\n    'Independent fixed DDL compiles the exact complete monitor index catalog row');\n    return freeze({ ux, socialBridge, monitor });\n  } finally {\n    await client?.end();\n    if (created) {\n"
            },
            {
              "current": "  };\n  return Object.freeze({ projectMetadata });\n}\nfunction extendCatalog(prior, ux, socialBridge, monitor, benefitNative, branches = false) {\n  const uxProjection = uxNativeProjection(ux), socialBridgeProjection = socialLegacyBridgeProjection(socialBridge),\n    monitorProjection = monitorNativeProjection(monitor),\n    projectMetadata = metadata => monitorProjection.projectMetadata(socialBridgeProjection.projectMetadata(\n      uxProjection.projectMetadata(benefitNative.projectMetadata(metadata)))),\n    base = branches ? prior.current : prior.reference, reference = benefitNative.extendReference(merge(base, socialBridge, ux, monitor));\n  const verifyMetadata = metadata => (branches ? prior.verify : prior.verifyMetadata)(projectMetadata(metadata));\n  verifyMetadata(reference);\n  const causal = { socialBridge: 0, socialProofContract: 0, ux: 0, monitor: 0 };\n",
              "baseline": "  };\n  return Object.freeze({ projectMetadata });\n}\nfunction extendCatalog(prior, ux, socialBridge, monitor, branches = false) {\n  const uxProjection = uxNativeProjection(ux), socialBridgeProjection = socialLegacyBridgeProjection(socialBridge),\n    monitorProjection = monitorNativeProjection(monitor),\n    projectMetadata = metadata => monitorProjection.projectMetadata(socialBridgeProjection.projectMetadata(uxProjection.projectMetadata(metadata))),\n    base = branches ? prior.current : prior.reference, reference = merge(base, socialBridge, ux, monitor);\n  const verifyMetadata = metadata => (branches ? prior.verify : prior.verifyMetadata)(projectMetadata(metadata));\n  verifyMetadata(reference);\n  const causal = { socialBridge: 0, socialProofContract: 0, ux: 0, monitor: 0 };\n"
            },
            {
              "current": "    assert.throws(() => { extension[field][0][key] = 'tampered'; }, TypeError);\n    const retained = structuredClone(extension), independent = makeProjection(retained);\n    retained[field][0][key] = 'tampered';\n    const integrated = benefitNative.extendReference(merge(base, label === 'socialBridge' ? retained : socialBridge,\n      label === 'ux' ? retained : ux, label === 'monitor' ? retained : monitor));\n    assert.throws(() => independent.projectMetadata(integrated), error => error?.code === 'ERR_ASSERTION'); causal[label]++;\n  }\n  verifyMetadata(reference);\n",
              "baseline": "    assert.throws(() => { extension[field][0][key] = 'tampered'; }, TypeError);\n    const retained = structuredClone(extension), independent = makeProjection(retained);\n    retained[field][0][key] = 'tampered';\n    const integrated = merge(base, label === 'socialBridge' ? retained : socialBridge,\n      label === 'ux' ? retained : ux, label === 'monitor' ? retained : monitor);\n    assert.throws(() => independent.projectMetadata(integrated), error => error?.code === 'ERR_ASSERTION'); causal[label]++;\n  }\n  verifyMetadata(reference);\n"
            },
            {
              "current": "  const proofContract = socialBridge.columns.find(row => row.column_name === socialProofContractColumn);\n  assert(proofContract); assert.equal(causal.socialProofContract, Object.keys(proofContract).length + 2,\n    'Proof-contract missing, duplicate and every-field mutations are all refused');\n  let deedBenefitCausal = 0;\n  for (const field of fields) for (const row of benefitNative.reference[field]) {\n    const at = reference[field].findIndex(candidate => candidate === row); assert(at >= 0);\n    const reject = metadata => { assert.throws(() => verifyMetadata(metadata), error => error?.code === 'ERR_ASSERTION'); deedBenefitCausal++; };\n    reject({ ...reference, [field]: reference[field].filter((_, index) => index !== at) });\n    reject({ ...reference, [field]: [...reference[field], { ...row }] });\n    for (const key of Object.keys(row)) {\n      const value = row[key], changed = { ...row, [key]: typeof value === 'boolean' ? !value\n        : typeof value === 'number' ? value + 1 : Array.isArray(value) ? [...value, 'unknown'] : value === null ? 'unknown' : value + '__unknown' };\n      reject({ ...reference, [field]: reference[field].map((candidate, index) => index === at ? changed : candidate) });\n    }\n    const unknown = { ...row, [field === 'relations' ? 'name' : 'table_name']: '__unknown_deed_marker__' };\n    reject({ ...reference, [field]: [...reference[field], unknown] });\n  }\n  const common = { ...prior, reference, verifyMetadata, socialBridgeReference: socialBridge,\n    socialBridgeCausal: causal.socialBridge, socialProofContractCausal: causal.socialProofContract,\n    uxReference: ux, uxSource: UX_SOURCE.revision, uxCausal: causal.ux,\n    monitorReference: monitor, monitorCausal: causal.monitor,\n    deedBenefitReference: benefitNative.reference, deedBenefitCausal };\n  if (branches) return Object.freeze({ ...common, current: reference, verify: verifyMetadata });\n  return Object.freeze({ ...common, normalize: rows => prior.normalize(socialBridgeProjection.projectConstraints(\n    uxProjection.projectConstraints(benefitNative.projectConstraints(rows, prior.includeNotNull), prior.includeNotNull), prior.includeNotNull)) });\n}\nfunction integratedSchemaSources(input) {\n  const candidate = economyUxMergeCandidateHistoricalInput('schema.sql', input);\n",
              "baseline": "  const proofContract = socialBridge.columns.find(row => row.column_name === socialProofContractColumn);\n  assert(proofContract); assert.equal(causal.socialProofContract, Object.keys(proofContract).length + 2,\n    'Proof-contract missing, duplicate and every-field mutations are all refused');\n  const common = { ...prior, reference, verifyMetadata, socialBridgeReference: socialBridge,\n    socialBridgeCausal: causal.socialBridge, socialProofContractCausal: causal.socialProofContract,\n    uxReference: ux, uxSource: UX_SOURCE.revision, uxCausal: causal.ux,\n    monitorReference: monitor, monitorCausal: causal.monitor };\n  if (branches) return Object.freeze({ ...common, current: reference, verify: verifyMetadata });\n  return Object.freeze({ ...common, normalize: rows => prior.normalize(socialBridgeProjection.projectConstraints(\n    uxProjection.projectConstraints(rows, prior.includeNotNull), prior.includeNotNull)) });\n}\nfunction integratedSchemaSources(input) {\n  const candidate = economyUxMergeCandidateHistoricalInput('schema.sql', input);\n"
            },
            {
              "current": "export async function createCommerceReleasePhase2MigrationCatalog(pool, endpoint, input, options) {\n  const { candidate } = integratedSchemaSources(input);\n  await assertNativeCaller(pool, endpoint, options?.legacyProfile, options?.includeNotNull);\n  const { ux, socialBridge, monitor, benefitNative } = await compileCurrentExtensionReference(pool, endpoint);\n  const prior = await original.createCommerceReleasePhase2MigrationCatalog(\n    await projectedCaller(pool, ux, socialBridge, monitor, benefitNative), endpoint, candidate, options);\n  return extendCatalog(prior, ux, socialBridge, monitor, benefitNative);\n}\nexport async function verifyCommerceNativeBranches(pool, endpoint) {\n  await assertNativeCaller(pool, endpoint, 'fresh', true);\n  const { candidate } = integratedSchemaSources(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));\n  const { ux, socialBridge, monitor, benefitNative } = await compileCurrentExtensionReference(pool, endpoint);\n  const prior = await original.verifyCommerceNativeBranches(\n    await projectedCaller(pool, ux, socialBridge, monitor, benefitNative), endpoint, candidate);\n  return extendCatalog(prior, ux, socialBridge, monitor, benefitNative, true);\n}\n",
              "baseline": "export async function createCommerceReleasePhase2MigrationCatalog(pool, endpoint, input, options) {\n  const { candidate } = integratedSchemaSources(input);\n  await assertNativeCaller(pool, endpoint, options?.legacyProfile, options?.includeNotNull);\n  const { ux, socialBridge, monitor } = await compileCurrentExtensionReference(pool, endpoint);\n  const prior = await original.createCommerceReleasePhase2MigrationCatalog(\n    await projectedCaller(pool, ux, socialBridge, monitor), endpoint, candidate, options);\n  return extendCatalog(prior, ux, socialBridge, monitor);\n}\nexport async function verifyCommerceNativeBranches(pool, endpoint) {\n  await assertNativeCaller(pool, endpoint, 'fresh', true);\n  const { candidate } = integratedSchemaSources(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));\n  const { ux, socialBridge, monitor } = await compileCurrentExtensionReference(pool, endpoint);\n  const prior = await original.verifyCommerceNativeBranches(\n    await projectedCaller(pool, ux, socialBridge, monitor), endpoint, candidate);\n  return extendCatalog(prior, ux, socialBridge, monitor, true);\n}\n"
            }
          ]
        },
        "deed": {
          "mode": "100644",
          "sha256": "bfc7ce695934b6d14fb2d414b9f7ce237d9b54fcb62bbea860fd2b98b6821d3a",
          "blob": "d600b17bdcc244abc64312194a85ce29d7bfda2b",
          "bytes": 25482,
          "inverses": [
            {
              "current": "  ? row.table_name === socialBridgeTable && socialExtensionColumns.has(row.column_name)\n  : field === 'constraints' && row.table_name === socialBridgeTable && row.name === socialBridgeConstraint;\nconst socialBridgeRows = (metadata, field) => metadata[field].filter(row => isSocialBridgeRow(field, row));\nconst monitorIndexName = 'ix_tx_at_id';\nconst isMonitorIndexRow = (field, row) => field === 'indexes' && row.table_name === 'transactions' && row.name === monitorIndexName;\nconst monitorRows = (metadata, field) => metadata[field].filter(row => isMonitorIndexRow(field, row));\nconst freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };\n// Keep the original engine's exact predecessor order; insert the existing-table bridge at its exact\n// catalog anchors, then retain the reviewed UX append order. No collation normalization is introduced.\nconst merge = (base, socialBridge, ux, monitor) => {\n  const merged = Object.fromEntries(fields.map(field => [field, [...base[field]]]));\n  assert.equal(socialBridge.columns.length, 2); assert(socialBridge.constraints.length <= 1);\n  assert.deepEqual(socialBridge.columns.map(row => row.column_name),\n",
              "baseline": "  ? row.table_name === socialBridgeTable && socialExtensionColumns.has(row.column_name)\n  : field === 'constraints' && row.table_name === socialBridgeTable && row.name === socialBridgeConstraint;\nconst socialBridgeRows = (metadata, field) => metadata[field].filter(row => isSocialBridgeRow(field, row));\nconst freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };\n// Keep the original engine's exact predecessor order; insert the existing-table bridge at its exact\n// catalog anchors, then retain the reviewed UX append order. No collation normalization is introduced.\nconst merge = (base, socialBridge, ux) => {\n  const merged = Object.fromEntries(fields.map(field => [field, [...base[field]]]));\n  assert.equal(socialBridge.columns.length, 2); assert(socialBridge.constraints.length <= 1);\n  assert.deepEqual(socialBridge.columns.map(row => row.column_name),\n"
            },
            {
              "current": "    merged.constraints.splice(constraintAt, 0, ...socialBridge.constraints);\n  }\n  for (const field of fields) merged[field].push(...ux[field]);\n  const indexAt = merged.indexes.findIndex(row => row.table_name === 'transactions' && row.name === 'ix_tx_character');\n  assert(indexAt >= 0, 'The monitor index precedes the exact predecessor transaction index');\n  merged.indexes.splice(indexAt, 0, ...monitor.indexes);\n  return freeze(merged);\n};\n\n",
              "baseline": "    merged.constraints.splice(constraintAt, 0, ...socialBridge.constraints);\n  }\n  for (const field of fields) merged[field].push(...ux[field]);\n  return freeze(merged);\n};\n\n"
            },
            {
              "current": "  }\n  assert.equal(settings.role, address.username); assert.equal('/' + settings.database, address.pathname);\n}\nasync function projectedCaller(pool, ux, socialBridge, monitor, benefitNative) {\n  const uxProjection = uxNativeProjection(ux), socialBridgeProjection = socialLegacyBridgeProjection(socialBridge),\n    monitorProjection = monitorNativeProjection(monitor);\n  const projectMetadata = metadata => monitorProjection.projectMetadata(socialBridgeProjection.projectMetadata(\n    uxProjection.projectMetadata(benefitNative.projectMetadata(metadata))));\n  const context = (await pool.query(catalogQueries[0])).rows[0];\n  const verify = async () => { projectMetadata(await original.readCommerceReleasePhase2Metadata(pool)); await assertUxNativeSecurity(pool); await assertDeedBenefitNativeSecurity(pool); };\n  await verify();\n",
              "baseline": "  }\n  assert.equal(settings.role, address.username); assert.equal('/' + settings.database, address.pathname);\n}\nasync function projectedCaller(pool, ux, socialBridge, benefitNative) {\n  const uxProjection = uxNativeProjection(ux), socialBridgeProjection = socialLegacyBridgeProjection(socialBridge);\n  const projectMetadata = metadata => socialBridgeProjection.projectMetadata(uxProjection.projectMetadata(benefitNative.projectMetadata(metadata)));\n  const context = (await pool.query(catalogQueries[0])).rows[0];\n  const verify = async () => { projectMetadata(await original.readCommerceReleasePhase2Metadata(pool)); await assertUxNativeSecurity(pool); await assertDeedBenefitNativeSecurity(pool); };\n  await verify();\n"
            },
            {
              "current": "    assert.deepEqual(selected, ux[field], 'Every fresh projected SQL result retains the complete UX ' + field);\n    assert.deepEqual(socialBridgeRows({ [field]: result.rows }, field), socialBridge[field],\n      'Every fresh projected SQL result retains the exact social bridge ' + field);\n    const monitorSelected = monitorRows({ [field]: result.rows }, field).map(row => {\n      const prefix = ' ON ' + context.schema + '.'; assert.equal(row.definition.split(prefix).length, 2);\n      return { ...row, definition: row.definition.replace(prefix, ' ON $self.') };\n    });\n    assert.deepEqual(monitorSelected, monitor[field], 'Every fresh projected SQL result retains the exact monitor ' + field);\n    let benefitRows = deedBenefitNativeRows({ [field]: result.rows }, field);\n    if (field === 'indexes') benefitRows = benefitRows.map(row => {\n      const prefix = ' ON ' + context.schema + '.'; assert.equal(row.definition.split(prefix).length, 2);\n",
              "baseline": "    assert.deepEqual(selected, ux[field], 'Every fresh projected SQL result retains the complete UX ' + field);\n    assert.deepEqual(socialBridgeRows({ [field]: result.rows }, field), socialBridge[field],\n      'Every fresh projected SQL result retains the exact social bridge ' + field);\n    let benefitRows = deedBenefitNativeRows({ [field]: result.rows }, field);\n    if (field === 'indexes') benefitRows = benefitRows.map(row => {\n      const prefix = ' ON ' + context.schema + '.'; assert.equal(row.definition.split(prefix).length, 2);\n"
            },
            {
              "current": "    assert.deepEqual(benefitRows, benefitNative.reference[field], 'Every fresh projected SQL result retains the complete current marker ' + field);\n    if (guarded) { await assertUxNativeSecurity(pool); await assertDeedBenefitNativeSecurity(pool); }\n    return { ...result, rows: result.rows.filter(row => !names.has(tableOf(field, row)) && !isSocialBridgeRow(field, row)\n      && !isMonitorIndexRow(field, row) && tableOf(field, row) !== DEED_BENEFIT_NATIVE_TABLE) };\n  } });\n  return { ...wrap(pool, true), connect: async () => {\n    const client = await pool.connect();\n",
              "baseline": "    assert.deepEqual(benefitRows, benefitNative.reference[field], 'Every fresh projected SQL result retains the complete current marker ' + field);\n    if (guarded) { await assertUxNativeSecurity(pool); await assertDeedBenefitNativeSecurity(pool); }\n    return { ...result, rows: result.rows.filter(row => !names.has(tableOf(field, row)) && !isSocialBridgeRow(field, row)\n      && tableOf(field, row) !== DEED_BENEFIT_NATIVE_TABLE) };\n  } });\n  return { ...wrap(pool, true), connect: async () => {\n    const client = await pool.connect();\n"
            },
            {
              "current": "    const settings = (await client.query('SELECT current_schema() AS schema,current_database() AS database,current_user AS role')).rows[0];\n    const parent = (await pool.query('SELECT current_database() AS database,current_user AS role')).rows[0];\n    assert.equal(settings.schema, schema); assert.equal(settings.database, parent.database); assert.equal(settings.role, parent.role);\n    // Compile the monitor index independently of schema.sql and the migrated caller. Only this\n    // exact additive index is projected from the unchanged predecessor's complete catalog proof.\n    await assertDeedBenefitNativeMigration();\n    await client.query('CREATE TABLE characters (id TEXT PRIMARY KEY);\\n' + DEED_BENEFIT_NATIVE_DDL + ';\\n' + socialBridgeDdl + '\\n' + uxDdl\n      + '\\nCREATE TABLE transactions (at TIMESTAMPTZ, id TEXT);\\nCREATE INDEX ix_tx_at_id ON transactions (at, id);');\n    const reference = await original.readCommerceReleasePhase2Metadata(client);\n    assert.deepEqual(reference.relations.map(row => row.name), ['characters', socialBridgeTable, DEED_BENEFIT_NATIVE_TABLE, 'transactions', ...UX_NATIVE_TABLES],\n      'Independent immutable DDL creates exactly the FK target, current marker, social bridge, monitor fixture and seven UX tables');\n    const ux = Object.fromEntries(fields.map(field => [field, uxRows(reference, field)]));\n    assert.deepEqual(ux.relations.map(row => row.name), UX_NATIVE_TABLES, 'Independent immutable DDL creates exactly the seven UX tables');\n    const socialBridge = Object.fromEntries(fields.map(field => [field, socialBridgeRows(reference, field)]));\n",
              "baseline": "    const settings = (await client.query('SELECT current_schema() AS schema,current_database() AS database,current_user AS role')).rows[0];\n    const parent = (await pool.query('SELECT current_database() AS database,current_user AS role')).rows[0];\n    assert.equal(settings.schema, schema); assert.equal(settings.database, parent.database); assert.equal(settings.role, parent.role);\n    await assertDeedBenefitNativeMigration();\n    await client.query('CREATE TABLE characters (id TEXT PRIMARY KEY);\\n' + DEED_BENEFIT_NATIVE_DDL + ';\\n' + socialBridgeDdl + '\\n' + uxDdl);\n    const reference = await original.readCommerceReleasePhase2Metadata(client);\n    assert.deepEqual(reference.relations.map(row => row.name), ['characters', socialBridgeTable, DEED_BENEFIT_NATIVE_TABLE, ...UX_NATIVE_TABLES],\n      'Independent immutable DDL creates exactly the FK target, current marker, social bridge fixture and seven UX tables');\n    const ux = Object.fromEntries(fields.map(field => [field, uxRows(reference, field)]));\n    assert.deepEqual(ux.relations.map(row => row.name), UX_NATIVE_TABLES, 'Independent immutable DDL creates exactly the seven UX tables');\n    const socialBridge = Object.fromEntries(fields.map(field => [field, socialBridgeRows(reference, field)]));\n"
            },
            {
              "current": "      referenced_schema: null, referenced_table: null, columns: [socialBridgeColumn], referenced_columns: [] }],\n    'PostgreSQL 18 exposes the exact generated social bridge NOT NULL catalog row');\n    assert.equal(socialBridge.relations.length + socialBridge.indexes.length, 0, 'The social bridge adds no relation or index');\n    const monitor = Object.fromEntries(fields.map(field => [field, monitorRows(reference, field)]));\n    assert.deepEqual(monitor.indexes, [{ table_name: 'transactions', name: monitorIndexName,\n      definition: 'CREATE INDEX ix_tx_at_id ON $self.transactions USING btree (at, id)',\n      unique: false, primary: false, valid: true, ready: true, live: true, nulls_not_distinct: false, predicate: null }],\n    'Independent fixed DDL compiles the exact complete monitor index catalog row');\n    const benefitNative = deedBenefitNativeProjection(Object.fromEntries(fields.map(field =>\n      [field, deedBenefitNativeRows(reference, field)])), version);\n    return freeze({ ux, socialBridge, monitor, benefitNative });\n  } finally {\n    await client?.end();\n    if (created) {\n",
              "baseline": "      referenced_schema: null, referenced_table: null, columns: [socialBridgeColumn], referenced_columns: [] }],\n    'PostgreSQL 18 exposes the exact generated social bridge NOT NULL catalog row');\n    assert.equal(socialBridge.relations.length + socialBridge.indexes.length, 0, 'The social bridge adds no relation or index');\n    const benefitNative = deedBenefitNativeProjection(Object.fromEntries(fields.map(field =>\n      [field, deedBenefitNativeRows(reference, field)])), version);\n    return freeze({ ux, socialBridge, benefitNative });\n  } finally {\n    await client?.end();\n    if (created) {\n"
            },
            {
              "current": "  };\n  return Object.freeze({ projectMetadata, projectConstraints });\n}\nexport function monitorNativeProjection(reference) {\n  reference = freeze(structuredClone(reference));\n  assert.equal(reference.relations.length + reference.columns.length + reference.constraints.length, 0);\n  assert.equal(reference.indexes.length, 1);\n  assert(isMonitorIndexRow('indexes', reference.indexes[0]));\n  const projectMetadata = metadata => {\n    for (const field of fields) assert.deepEqual(monitorRows(metadata, field), reference[field],\n      'Exact independently compiled monitor ' + field);\n    return Object.fromEntries(fields.map(field => [field, metadata[field].filter(row => !isMonitorIndexRow(field, row))]));\n  };\n  return Object.freeze({ projectMetadata });\n}\nfunction extendCatalog(prior, ux, socialBridge, monitor, benefitNative, branches = false) {\n  const uxProjection = uxNativeProjection(ux), socialBridgeProjection = socialLegacyBridgeProjection(socialBridge),\n    monitorProjection = monitorNativeProjection(monitor),\n    projectMetadata = metadata => monitorProjection.projectMetadata(socialBridgeProjection.projectMetadata(\n      uxProjection.projectMetadata(benefitNative.projectMetadata(metadata)))),\n    base = branches ? prior.current : prior.reference, reference = benefitNative.extendReference(merge(base, socialBridge, ux, monitor));\n  const verifyMetadata = metadata => (branches ? prior.verify : prior.verifyMetadata)(projectMetadata(metadata));\n  verifyMetadata(reference);\n  const causal = { socialBridge: 0, socialProofContract: 0, ux: 0, monitor: 0 };\n  assert.throws(() => { reference.columns.push({}); }, TypeError);\n  for (const [label, extension, makeProjection] of [\n    ['socialBridge', socialBridge, socialLegacyBridgeProjection], ['ux', ux, uxNativeProjection],\n    ['monitor', monitor, monitorNativeProjection],\n  ]) {\n    const field = fields.find(field => extension[field].length), key = Object.keys(extension[field][0])[0];\n    assert.throws(() => { extension[field][0][key] = 'tampered'; }, TypeError);\n    const retained = structuredClone(extension), independent = makeProjection(retained);\n    retained[field][0][key] = 'tampered';\n    const integrated = benefitNative.extendReference(merge(base, label === 'socialBridge' ? retained : socialBridge,\n      label === 'ux' ? retained : ux, label === 'monitor' ? retained : monitor));\n    assert.throws(() => independent.projectMetadata(integrated), error => error?.code === 'ERR_ASSERTION'); causal[label]++;\n  }\n  verifyMetadata(reference);\n  for (const [label, extension] of [['socialBridge', socialBridge], ['ux', ux], ['monitor', monitor]]) {\n    for (const field of fields) for (const row of extension[field]) {\n      const causalLabel = label === 'socialBridge' && field === 'columns'\n        && row.column_name === socialProofContractColumn ? 'socialProofContract' : label;\n",
              "baseline": "  };\n  return Object.freeze({ projectMetadata, projectConstraints });\n}\nfunction extendCatalog(prior, ux, socialBridge, benefitNative, branches = false) {\n  const uxProjection = uxNativeProjection(ux), socialBridgeProjection = socialLegacyBridgeProjection(socialBridge),\n    projectMetadata = metadata => socialBridgeProjection.projectMetadata(uxProjection.projectMetadata(benefitNative.projectMetadata(metadata))),\n    base = branches ? prior.current : prior.reference, reference = benefitNative.extendReference(merge(base, socialBridge, ux));\n  const verifyMetadata = metadata => (branches ? prior.verify : prior.verifyMetadata)(projectMetadata(metadata));\n  verifyMetadata(reference);\n  const causal = { socialBridge: 0, socialProofContract: 0, ux: 0 };\n  assert.throws(() => { reference.columns.push({}); }, TypeError);\n  for (const [label, extension, makeProjection] of [\n    ['socialBridge', socialBridge, socialLegacyBridgeProjection], ['ux', ux, uxNativeProjection],\n  ]) {\n    assert.throws(() => { extension.columns[0].type = 'tampered'; }, TypeError);\n    const retained = structuredClone(extension), independent = makeProjection(retained);\n    retained.columns[0].type = 'tampered';\n    const integrated = benefitNative.extendReference(label === 'socialBridge' ? merge(base, retained, ux) : merge(base, socialBridge, retained));\n    assert.throws(() => independent.projectMetadata(integrated), error => error?.code === 'ERR_ASSERTION'); causal[label]++;\n  }\n  verifyMetadata(reference);\n  for (const [label, extension] of [['socialBridge', socialBridge], ['ux', ux]]) {\n    for (const field of fields) for (const row of extension[field]) {\n      const causalLabel = label === 'socialBridge' && field === 'columns'\n        && row.column_name === socialProofContractColumn ? 'socialProofContract' : label;\n"
            },
            {
              "current": "  const common = { ...prior, reference, verifyMetadata, socialBridgeReference: socialBridge,\n    socialBridgeCausal: causal.socialBridge, socialProofContractCausal: causal.socialProofContract,\n    uxReference: ux, uxSource: UX_SOURCE.revision, uxCausal: causal.ux,\n    monitorReference: monitor, monitorCausal: causal.monitor,\n    deedBenefitReference: benefitNative.reference, deedBenefitCausal };\n  if (branches) return Object.freeze({ ...common, current: reference, verify: verifyMetadata });\n  return Object.freeze({ ...common, normalize: rows => prior.normalize(socialBridgeProjection.projectConstraints(\n",
              "baseline": "  const common = { ...prior, reference, verifyMetadata, socialBridgeReference: socialBridge,\n    socialBridgeCausal: causal.socialBridge, socialProofContractCausal: causal.socialProofContract,\n    uxReference: ux, uxSource: UX_SOURCE.revision, uxCausal: causal.ux,\n    deedBenefitReference: benefitNative.reference, deedBenefitCausal };\n  if (branches) return Object.freeze({ ...common, current: reference, verify: verifyMetadata });\n  return Object.freeze({ ...common, normalize: rows => prior.normalize(socialBridgeProjection.projectConstraints(\n"
            },
            {
              "current": "export async function createCommerceReleasePhase2MigrationCatalog(pool, endpoint, input, options) {\n  const { candidate } = integratedSchemaSources(input);\n  await assertNativeCaller(pool, endpoint, options?.legacyProfile, options?.includeNotNull);\n  const { ux, socialBridge, monitor, benefitNative } = await compileCurrentExtensionReference(pool, endpoint);\n  const prior = await original.createCommerceReleasePhase2MigrationCatalog(\n    await projectedCaller(pool, ux, socialBridge, monitor, benefitNative), endpoint, candidate, options);\n  return extendCatalog(prior, ux, socialBridge, monitor, benefitNative);\n}\nexport async function verifyCommerceNativeBranches(pool, endpoint) {\n  await assertNativeCaller(pool, endpoint, 'fresh', true);\n  const { candidate } = integratedSchemaSources(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));\n  const { ux, socialBridge, monitor, benefitNative } = await compileCurrentExtensionReference(pool, endpoint);\n  const prior = await original.verifyCommerceNativeBranches(\n    await projectedCaller(pool, ux, socialBridge, monitor, benefitNative), endpoint, candidate);\n  return extendCatalog(prior, ux, socialBridge, monitor, benefitNative, true);\n}\n",
              "baseline": "export async function createCommerceReleasePhase2MigrationCatalog(pool, endpoint, input, options) {\n  const { candidate } = integratedSchemaSources(input);\n  await assertNativeCaller(pool, endpoint, options?.legacyProfile, options?.includeNotNull);\n  const { ux, socialBridge, benefitNative } = await compileCurrentExtensionReference(pool, endpoint);\n  const prior = await original.createCommerceReleasePhase2MigrationCatalog(\n    await projectedCaller(pool, ux, socialBridge, benefitNative), endpoint, candidate, options);\n  return extendCatalog(prior, ux, socialBridge, benefitNative);\n}\nexport async function verifyCommerceNativeBranches(pool, endpoint) {\n  await assertNativeCaller(pool, endpoint, 'fresh', true);\n  const { candidate } = integratedSchemaSources(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));\n  const { ux, socialBridge, benefitNative } = await compileCurrentExtensionReference(pool, endpoint);\n  const prior = await original.verifyCommerceNativeBranches(\n    await projectedCaller(pool, ux, socialBridge, benefitNative), endpoint, candidate);\n  return extendCatalog(prior, ux, socialBridge, benefitNative, true);\n}\n"
            }
          ]
        }
      }
    }
  ],
  "sourceOnly": true,
  "runtime": false,
  "native": false
});
export const ECONOMY_DEED_MERGE_SOURCE_SHA256 = "e527170d18ab73feca7458dcf671afdf7d63a9b7d38d38d359cdbaf157217ad3";
export const ECONOMY_DEED_MERGE_NATIVE_PROVENANCE = freeze({
  "version": 1,
  "status": "SEALED",
  "phase": "EXACT_ECONOMY_DEED_MERGE_SOURCE_PROVENANCE_ONLY",
  "sourceRevision": "34ad488a93450530136972f48c188988f1210e5f",
  "sourceTree": "d01741a225ee4bacde88dc15870f1ae9bdcae9f8",
  "predecessorRevision": "1822593cfff6e66483a685fc7bf6bff4c50de5f0",
  "predecessorDefinitionSha256": "1a18c61c509dab42516af5763f618c3374f5a30d0ec7ca46eb592aa8ef2dbdab",
  "predecessorMetadataSha256": "70db907a20352f433aec965c5cd1bdaa05ac7fb2c159b3c132538fc7d714789e",
  "reviewedFiles": [
    "AGENTS.md",
    "package.json",
    "public/index.html",
    "public/sale.html",
    "public/ux-coordination.css",
    "public/ux-coordination.js",
    "public/ux-navigation.css",
    "public/ux-navigation.js",
    "public/ux-progression.css",
    "public/ux-progression.js",
    "public/ux-tactics.css",
    "public/ux-tactics.js",
    "schema.sql",
    "src/accrual.js",
    "src/age.js",
    "src/content/city-quest-presentation.js",
    "src/content/phase1-policy.js",
    "src/content/phase1.js",
    "src/db.js",
    "src/deedbuildings.js",
    "src/deeddiscovery.js",
    "src/deeds.js",
    "src/engagement.js",
    "src/game.js",
    "src/invariants.js",
    "src/legal.js",
    "src/preflight.js",
    "src/server.js",
    "src/ux-story.js",
    "src/ux-tactics.js",
    "src/worker.js",
    "src/worldgraph-ui.js",
    "test/client.js",
    "test/commerce-current-native-guard.js",
    "test/companyworkflows.js",
    "test/director-migration.js",
    "test/gates.js",
    "test/lib/enterprise-ux-native-guard.js",
    "test/lib/phase2-definition-fixtures.js",
    "test/lib/player-command-support.js",
    "test/lib/ux-native-director-guard.js",
    "test/lib/ux-native-reader-source-compatibility.js",
    "test/sale-source-compatibility.js",
    "test/ux-source-compatibility.js",
    "test/worldgraph-validation.js",
    "tools/commerce-current-native-guard.js",
    "tools/economy-ux-merge-source-compatibility.js",
    "tools/enterprise-native-ux-seal.js",
    "tools/enterprise-native-ux.js",
    "tools/enterprise-native.js",
    "tools/pgquery.js",
    "tools/ux-release-phase2-native-catalog.js",
    "tools/ux-source-compatibility.js"
  ],
  "files": [
    {
      "file": "AGENTS.md",
      "current": {
        "file": "AGENTS.md",
        "mode": "100644",
        "blob": "40a764e3fc39a7c93d2c0d8797913f6f9e9d4444",
        "sha256": "ffd42e51acb2b06b12b4ac7132f5fd4c4ae2f29f63720b9e7d3931d3fe7b79b4"
      },
      "predecessor": {
        "file": "AGENTS.md",
        "mode": "100644",
        "blob": "9d7a3b61336d8950d164aec695cb3ac82cc221a7",
        "sha256": "1aa9290c76468c11ec0f41940d5589871fa9246d830e2be64ab9345c7ba80a24"
      }
    },
    {
      "file": "package.json",
      "current": {
        "file": "package.json",
        "mode": "100644",
        "blob": "cfd0c6f62d1a1cbe5ba02e3b30ddbbdaaac55bb3",
        "sha256": "3d2085e0a3096cc83698fc024a01796c0780fc3d1fab66acc42b9e43bf50d9dc"
      },
      "predecessor": {
        "file": "package.json",
        "mode": "100644",
        "blob": "531e67d793e7758751f1734fe6dd96b7520268d4",
        "sha256": "25a5a2cb4f5c8bc5ce9538495716d60fad3c67e995a2db36daca01505c92e2fc"
      }
    },
    {
      "file": "public/index.html",
      "current": {
        "file": "public/index.html",
        "mode": "100644",
        "blob": "96b2921c67993953909847604016491481e64919",
        "sha256": "ff1924deb41952c9be01a1064f0696d18eb21948e762a60144050c74b7d81344"
      },
      "predecessor": {
        "file": "public/index.html",
        "mode": "100644",
        "blob": "0b187d5f921800af383e612025d1c635dc89c442",
        "sha256": "e123908ed56e87ec55a8cb5ab0922f94b6a9651b01c039591d3652ac1e3c8750"
      }
    },
    {
      "file": "public/sale.html",
      "current": {
        "file": "public/sale.html",
        "mode": "100644",
        "blob": "6e24725980377c963619bc00c813da0819e564e8",
        "sha256": "639d41062a3f6b0744ae6553b4b6ae03cd31d7c9625204841cd51ac8993378ce"
      },
      "predecessor": {
        "file": "public/sale.html",
        "mode": "100644",
        "blob": "d6c60cb31e849a988364e0d2e347717c3c17bc41",
        "sha256": "87817dbd2e4f716a0933c1c58ac7d32b0135a56049185538403d90e48ffac857"
      }
    },
    {
      "file": "public/ux-coordination.css",
      "current": {
        "file": "public/ux-coordination.css",
        "mode": "100644",
        "blob": "36a963c6b495e5c87c5d8e110f57808e19ee4732",
        "sha256": "8044d107e1a0a9a790ecbe8591eeb436f08ceda4d46f350f37302dd22334aa7e"
      },
      "predecessor": {
        "file": "public/ux-coordination.css",
        "mode": "100644",
        "blob": "981d76247b0b6301b0a4fe6652841a4ef2dc9a39",
        "sha256": "9b79f34286e6829ba03202511686fdaa9398e57d8bbb76fe0f2c9ad8511c021b"
      }
    },
    {
      "file": "public/ux-coordination.js",
      "current": {
        "file": "public/ux-coordination.js",
        "mode": "100644",
        "blob": "b793c95fdaf2dd129196cc4a09ce9a49d2744779",
        "sha256": "4868b786546015d7a9137432db177dd5468bbccb1088565fe8190e2ad9d8b64e"
      },
      "predecessor": {
        "file": "public/ux-coordination.js",
        "mode": "100644",
        "blob": "ad35b284f2ba7f425ba15391410a6f4b0cce51db",
        "sha256": "7e74509012c977a5a9438942883ffa6168ada4cb187bac97f8d72bcc21bfe1f1"
      }
    },
    {
      "file": "public/ux-navigation.css",
      "current": {
        "file": "public/ux-navigation.css",
        "mode": "100644",
        "blob": "7c42357e601b6a9d5093d30bef159d8628cc8539",
        "sha256": "712ebf19faf5303e45d82c55cfc9cda4b3d4156fc0ab759a115a849dbe2efbd6"
      },
      "predecessor": {
        "file": "public/ux-navigation.css",
        "mode": "100644",
        "blob": "3d893dd6ba661e409fc206bda1d8602c9eedc135",
        "sha256": "b47aa884a0bc7d5536ff5741f0678e559d9836fdef3b595607d11416144dc5eb"
      }
    },
    {
      "file": "public/ux-navigation.js",
      "current": {
        "file": "public/ux-navigation.js",
        "mode": "100644",
        "blob": "4799cee8f4224ca54fd6a7353ac9524d3fae4c31",
        "sha256": "dc3bb19447298cfce5dd2ad471e14cce708df163be0fe4d85dc1d0a76fee748c"
      },
      "predecessor": {
        "file": "public/ux-navigation.js",
        "mode": "100644",
        "blob": "023df70d5afcae806c13b025b8af2f06dc0f7601",
        "sha256": "f0a6d8103c77fceb9a2812152cf1df70911577618a199cc87beacafffe35bd3a"
      }
    },
    {
      "file": "public/ux-progression.css",
      "current": {
        "file": "public/ux-progression.css",
        "mode": "100644",
        "blob": "417b260ee7272b36cf4b01a2d096af2df517b6fc",
        "sha256": "d5e3d1c28b3e8ee60e2a964bb843fdc3c82356955e2fc6f2a9cb2def6066a1ba"
      },
      "predecessor": {
        "file": "public/ux-progression.css",
        "mode": "100644",
        "blob": "1a487d3ab5cc5380270fdb94812e7435799a99b2",
        "sha256": "b3f8ddb1bbc31fb2820a5bbc3aea07b0cdc2399f4e0193dfb6105f6a204c1f9d"
      }
    },
    {
      "file": "public/ux-progression.js",
      "current": {
        "file": "public/ux-progression.js",
        "mode": "100644",
        "blob": "3edc29b7a3ffad2aa721f50cf9725212c04a1e30",
        "sha256": "afa7aea0a043975ec7c8f55639a089196e8abe054d6324aa5bd5ed1654062ec6"
      },
      "predecessor": {
        "file": "public/ux-progression.js",
        "mode": "100644",
        "blob": "d231ec582491d0deaa6629fb32a75e9c6fc86501",
        "sha256": "4b016e1f713b94e6914b55f8b8da88323b76ce0750bfa90bd17de944636de46b"
      }
    },
    {
      "file": "public/ux-tactics.css",
      "current": {
        "file": "public/ux-tactics.css",
        "mode": "100644",
        "blob": "ecf50ff3e58aaed57bc7b4da0d1b6eb82dc4604d",
        "sha256": "d4894c313b391e37a65948a1314e0cc44f6db5bcd4f23106da3150d5da2fff6a"
      },
      "predecessor": {
        "file": "public/ux-tactics.css",
        "mode": "100644",
        "blob": "09774a4598a055dd3807562cbcc7bd9ffbce0066",
        "sha256": "3dd675c2c1e3f53b22e19d2e9d80e94915f849b56bdd85089995e1452c7544ff"
      }
    },
    {
      "file": "public/ux-tactics.js",
      "current": {
        "file": "public/ux-tactics.js",
        "mode": "100644",
        "blob": "518d03651cbfa63105dfed2698c1c11d493d8c5d",
        "sha256": "23ee8040bd87b1e1a101d1a5d44193b1486307afbbaa8ff76f04609d9d7683c9"
      },
      "predecessor": {
        "file": "public/ux-tactics.js",
        "mode": "100644",
        "blob": "a9705b769947558f18be5dfe30d5c05258da9ff8",
        "sha256": "b42132fa716af3649910e3052bb7dc33348dbe31426f3085a38957938cc056ba"
      }
    },
    {
      "file": "schema.sql",
      "current": {
        "file": "schema.sql",
        "mode": "100755",
        "blob": "a0659f7908061802b87d1c40aa22d4de7e7632c5",
        "sha256": "d8131ea84e1eb6eb186ee42fa722ce13fd0b8b6dd1b056395037d471d09c7fda"
      },
      "predecessor": {
        "file": "schema.sql",
        "mode": "100755",
        "blob": "9a2605d3d4c6fdcb382184ccc1e1ce12180c3a42",
        "sha256": "b2a337dfaddd06f670774c9bbf2ddebb09c5857a769be598aa54376ea29fa5f7"
      }
    },
    {
      "file": "src/accrual.js",
      "current": {
        "file": "src/accrual.js",
        "mode": "100644",
        "blob": "86c2bfb96e037455a49643d2dc0a2d3b846f2088",
        "sha256": "9d71503578beaac62e0ae1bcddebf8946f86c949e7ad259ea1fed298646b8d51"
      },
      "predecessor": {
        "file": "src/accrual.js",
        "mode": "100644",
        "blob": "46e33a86e875eecc148ae7418923edc00f143f15",
        "sha256": "ff99ed4d9194ce09c32aa5f8811665db13e58703bd7d27210761d96701dcc2cd"
      }
    },
    {
      "file": "src/age.js",
      "current": {
        "file": "src/age.js",
        "mode": "100644",
        "blob": "94a8b0e92dbb559e79e4d169ac238eaddafca663",
        "sha256": "b3aea51a8cb6b537fdb45ec2fa44aebeb1a0af39bc248c4e2afaee57eb9cf3dd"
      },
      "predecessor": {
        "file": "src/age.js",
        "mode": "100644",
        "blob": "314806666a9f590e4755aa50707d40adcfbde0db",
        "sha256": "70aa08ad07eba867d8b4c0fd7ced892e7e1871869c03832295d60ee78331e0ff"
      }
    },
    {
      "file": "src/content/city-quest-presentation.js",
      "current": {
        "file": "src/content/city-quest-presentation.js",
        "mode": "100644",
        "blob": "57e3fb9dcfd3e9067546feb3ba36b360071ec148",
        "sha256": "7abe9758e99a68dda3f00bd54ad8f4d0b61af3bae844977a69e9dbba58f64515"
      },
      "predecessor": {
        "file": "src/content/city-quest-presentation.js",
        "mode": "100644",
        "blob": "3f1d2cfa796bc80e8a881210446fb5cf8f7f5742",
        "sha256": "12acd35f7ec91bc16e2b0e72ffeb17cf0448f7734342f770e123d55a5b17005e"
      }
    },
    {
      "file": "src/content/phase1-policy.js",
      "current": {
        "file": "src/content/phase1-policy.js",
        "mode": "100644",
        "blob": "31f67a4aa71a61688873d615d08d73dfd0e58895",
        "sha256": "f5d2339a39d856551ddd91dd1ca86a08e00e861348cc70c7f834f8a18f5bc837"
      },
      "predecessor": {
        "file": "src/content/phase1-policy.js",
        "mode": "100644",
        "blob": "9905ac9dcc65ca58073bc0bdfe412c8b4aa97601",
        "sha256": "54fcf367ee3234527faa608d0725fcd3f4b58c646f4164f2264ea79655443ecb"
      }
    },
    {
      "file": "src/content/phase1.js",
      "current": {
        "file": "src/content/phase1.js",
        "mode": "100644",
        "blob": "90f295bd33959e574bfc835301380e46e6cfb2e7",
        "sha256": "6d8ca127ad60b3e1b2672e5f015568b4b7712488c3ac8be9100f260404cc6c04"
      },
      "predecessor": {
        "file": "src/content/phase1.js",
        "mode": "100644",
        "blob": "410973e7de00da7b7e703d4e0c137319a4bf39a2",
        "sha256": "6d3d5cccc4fbf99ca09ba13906536477651f64b3c8182d7d387cd9be08d8ffcb"
      }
    },
    {
      "file": "src/db.js",
      "current": {
        "file": "src/db.js",
        "mode": "100644",
        "blob": "71e6a1a28c0347c78296d871f8102f987c85a4d5",
        "sha256": "9d8ef3f15ed9141792679808d791b51dd679daf28f9f70768ba9472d3b84cae4"
      },
      "predecessor": {
        "file": "src/db.js",
        "mode": "100644",
        "blob": "5abcd1c874c8b5d9b7cc6739ff7e59f29a808610",
        "sha256": "b81f2db08de8ac9ec4975cb653fd89cbc50e8aeb966726b4ac259f961447ca8c"
      }
    },
    {
      "file": "src/deedbuildings.js",
      "current": {
        "file": "src/deedbuildings.js",
        "mode": "100644",
        "blob": "17e5cdea02b729a06c637ab88c597b33e2c7fccf",
        "sha256": "0b2218069df93d0b9920ead93d3b92b46534b4b650ad2e4fc28dc0b64ca48206"
      },
      "predecessor": {
        "file": "src/deedbuildings.js",
        "mode": "100644",
        "blob": "91ec9c496dd6afc9c83f6d0a5fd02b272eed6bb5",
        "sha256": "1184d5d65bd00733cb545bae6d6b3c7ad527eaa3910a5a9abe8de8227b8867ca"
      }
    },
    {
      "file": "src/deeddiscovery.js",
      "current": {
        "file": "src/deeddiscovery.js",
        "mode": "100644",
        "blob": "fdcd944422cf3ea24b107d9efc0e17974c60fa6c",
        "sha256": "88638a873d6dc482011a3aa626047f9b416e7b035dcd456d99f1aa32aa80909c"
      },
      "predecessor": {
        "file": "src/deeddiscovery.js",
        "mode": "100644",
        "blob": "d9fcb6eb5e79aeb3abb111bfad805539fc6c7c80",
        "sha256": "a01913ebe30b3fcf71be85de38cf712db726f479e64c7058a3f823ea1c1524f0"
      }
    },
    {
      "file": "src/deeds.js",
      "current": {
        "file": "src/deeds.js",
        "mode": "100644",
        "blob": "3bef65b9bc4245f65646895559a4e0cbd0ebe3c7",
        "sha256": "cc773c26fdb76d98223c272221a7ada8da384ab2e22e5ec1664f405470ed2011"
      },
      "predecessor": {
        "file": "src/deeds.js",
        "mode": "100644",
        "blob": "9f7f1fab401d195fb192005d3164dcfd6c55a73c",
        "sha256": "edf542f5cfc596358964283cfcafc7eaa8f66fee2ed81edb901c53dcd4d0b0fa"
      }
    },
    {
      "file": "src/engagement.js",
      "current": {
        "file": "src/engagement.js",
        "mode": "100644",
        "blob": "3fc2773c44cd32dcd970c470fcfcc941dcd73b00",
        "sha256": "9dd0e49b49bc2403ed7dca6b5bb6dffb953c36fcb056dadcf6207219ef725b63"
      },
      "predecessor": {
        "file": "src/engagement.js",
        "mode": "100644",
        "blob": "c7f1d2521ca4afc974aed7d5504c09b75a8c6270",
        "sha256": "d8166dc243fd0ff54322a4da048436566182fba76d098b865215d68db69c1356"
      }
    },
    {
      "file": "src/game.js",
      "current": {
        "file": "src/game.js",
        "mode": "100644",
        "blob": "b879627d63b592354183384a161e8ddcb670830e",
        "sha256": "9bde6b2f4213cc034a0dbb02fd05fb49cda106f006aab629214442fee0439e5d"
      },
      "predecessor": {
        "file": "src/game.js",
        "mode": "100644",
        "blob": "947046030354529e41b509cb5229147ce466bee5",
        "sha256": "7b2d6a8feaebbf77988afde846565b0a01b0e7a7f11dd83403b73841f1c246f2"
      }
    },
    {
      "file": "src/invariants.js",
      "current": {
        "file": "src/invariants.js",
        "mode": "100644",
        "blob": "42715dd4c1f23a0a57a1b8567249968cdd2a6aec",
        "sha256": "c800b02d492e9068ad68c50607061685a6d2b00e5850b733239eee0549264a67"
      },
      "predecessor": {
        "file": "src/invariants.js",
        "mode": "100644",
        "blob": "b0dcabcd1589cb914860fc629f69aff856507e82",
        "sha256": "e75cc63ff714f0bd9169fea5d4d8171a61b8812bdd82f24f648bdbbe9b09e168"
      }
    },
    {
      "file": "src/legal.js",
      "current": {
        "file": "src/legal.js",
        "mode": "100644",
        "blob": "1f9241475697b532c572bdd1ca21e20e4e1f788a",
        "sha256": "a9d8138f0efe8deb268468af19c8c92e82b5401dc9975ab988ddae3a320b487c"
      },
      "predecessor": {
        "file": "src/legal.js",
        "mode": "100644",
        "blob": "70942fdd7dfd2848988280ffdfdd70a760197ec8",
        "sha256": "cc9d56d27c0630d67dc2cdc1d53a8ff3fc294d7e2faa86a49a1fe1d15b1fa9b6"
      }
    },
    {
      "file": "src/preflight.js",
      "current": {
        "file": "src/preflight.js",
        "mode": "100644",
        "blob": "3f020b59416c6edd9f63ac5753510377088105fa",
        "sha256": "ec03b2586d2a816b02a66a8128ca396ec4dae829fbeadb8557d29c364e892a80"
      },
      "predecessor": {
        "file": "src/preflight.js",
        "mode": "100644",
        "blob": "ac3ba92249dbcebe7cfde910d2276373b15eb845",
        "sha256": "4901dca23d457a6c0dc56c6ca72371162200235de7287ec449363584f74286ea"
      }
    },
    {
      "file": "src/server.js",
      "current": {
        "file": "src/server.js",
        "mode": "100644",
        "blob": "9ac86b5b025e3a40f0142f8adf855471e8a21e77",
        "sha256": "eae571fecd106622365194b2fd862f54635a9488ea9784d660defa292da28b5a"
      },
      "predecessor": {
        "file": "src/server.js",
        "mode": "100644",
        "blob": "98be176eb2d676e3eaa1992da787c76cb15acb00",
        "sha256": "f0fba7a89de112aa2c85e61955cd2b36eb6387605f46696ef1290d442d14615e"
      }
    },
    {
      "file": "src/ux-story.js",
      "current": {
        "file": "src/ux-story.js",
        "mode": "100644",
        "blob": "d8f3e023d4aa929f918540ee2e36afa2b95b7b70",
        "sha256": "5b91648482dd363abfa4adfb32e622f272f0efe668ad294c19ec4058d4a3c2fc"
      },
      "predecessor": {
        "file": "src/ux-story.js",
        "mode": "100644",
        "blob": "120c6413d8700f6d6f2fdbd59235e4a9096a6c1a",
        "sha256": "a7becb7b78c09e03524f81472e2ce36bcff3e5795748aa51f6e6594fe85e7a69"
      }
    },
    {
      "file": "src/ux-tactics.js",
      "current": {
        "file": "src/ux-tactics.js",
        "mode": "100644",
        "blob": "84f8a92eff7c02e071041016c13b9c1ef2cd13bd",
        "sha256": "c92cfabb6f5786aa4e8656afbe9e3b51a8ce30ca67546ca2c71ffef7d9d44850"
      },
      "predecessor": {
        "file": "src/ux-tactics.js",
        "mode": "100644",
        "blob": "386bb613e49c788cbffb7330181cbbe94e97b9b1",
        "sha256": "1d15b503c1fffe911b34cab76bf99a34b5dcf9b7332ee505775dd792eed57917"
      }
    },
    {
      "file": "src/worker.js",
      "current": {
        "file": "src/worker.js",
        "mode": "100644",
        "blob": "6e0eb2656fb6c815908ddf722a4e8a89dc75f3d2",
        "sha256": "8461ccc60c86ccadcda3c2820a9026f8eadacebdd201355f23b09e4b646f38f9"
      },
      "predecessor": {
        "file": "src/worker.js",
        "mode": "100644",
        "blob": "84be99e513a7a66343f0652a55fdc6d885d8687a",
        "sha256": "2a07dc2ac6740ffa9495b08f807d4cae591e0e7c8cc50da3f2746f9b6eaf0329"
      }
    },
    {
      "file": "src/worldgraph-ui.js",
      "current": {
        "file": "src/worldgraph-ui.js",
        "mode": "100644",
        "blob": "e3cd96e43401fc571d5dd63baf55a4514c9b5519",
        "sha256": "b4d09ff8d26efe2d4871f4eaacdf720571de609ea71d48f3f675059790e0975f"
      },
      "predecessor": {
        "file": "src/worldgraph-ui.js",
        "mode": "100644",
        "blob": "9bf9f7ae2573efca5a0f8505b0a5da28d87a9675",
        "sha256": "b8bb33c5ec1e8f45a12eb9d68fbaeab6dd95e999e06ae8e481f99201d4759829"
      }
    },
    {
      "file": "test/client.js",
      "current": {
        "file": "test/client.js",
        "mode": "100644",
        "blob": "b712b8bc0fa7e26c2188b5f214e6fc5e42117213",
        "sha256": "62496859ad98d2bc6b82d77754141dac93eadabb3cdefae3432e5527294501a1"
      },
      "predecessor": {
        "file": "test/client.js",
        "mode": "100644",
        "blob": "9042c603a35b5f6c3dd82f54fae03f64c3bd42ff",
        "sha256": "fe807783ec2f55b263e4a7d72a65aaed28c2216e6dd05a9177cdb1e25cc2a5aa"
      }
    },
    {
      "file": "test/commerce-current-native-guard.js",
      "current": {
        "file": "test/commerce-current-native-guard.js",
        "mode": "100644",
        "blob": "66e2d720b9ab85a8adb9d6db01f5603315080e48",
        "sha256": "b5e9bf5a3c503efd14bd9a217aff4738ec1153003c4ddb204a8d8ff62e0eeb1d"
      },
      "predecessor": {
        "file": "test/commerce-current-native-guard.js",
        "mode": "100644",
        "blob": "d65b113be14e50a542f65c0488c5147c6d39fa2c",
        "sha256": "5bdcde68d956b588d66996a7a73f6f25deacaecf47c445676a3259d7275b71ba"
      }
    },
    {
      "file": "test/companyworkflows.js",
      "current": {
        "file": "test/companyworkflows.js",
        "mode": "100644",
        "blob": "baa76230ebab75e8163e7701358c3f2f24fad4eb",
        "sha256": "f5d377b7abbbb5155515df198113849ee333f316e55acdd36e84f53b83273121"
      },
      "predecessor": {
        "file": "test/companyworkflows.js",
        "mode": "100644",
        "blob": "0784e59969f23d5be86a8e87196a23cea618cd6b",
        "sha256": "6d6a265517ab729a24ae7b5f7ff72164f030be74f1674308ba02b08b3eadbec6"
      }
    },
    {
      "file": "test/director-migration.js",
      "current": {
        "file": "test/director-migration.js",
        "mode": "100644",
        "blob": "f7280d01e195f14d82c63972b16a26880ac367de",
        "sha256": "5ce0b994c9a0e6f2eec4b39964136bbba4af11a72d1e943a6af2830be23548cd"
      },
      "predecessor": {
        "file": "test/director-migration.js",
        "mode": "100644",
        "blob": "d614abcc16118a444e3d6835c6bd72fa9256bf69",
        "sha256": "b250fe40588ac1c6e6fc3bec727694c526af71654410974ebe728bbd5b65cc36"
      }
    },
    {
      "file": "test/gates.js",
      "current": {
        "file": "test/gates.js",
        "mode": "100644",
        "blob": "a0a4551b721073b1eb33780e3702cd0b8fde6813",
        "sha256": "a30914836d5d503aaf0114a5634e183dfec43a0a9c1c799692e2644612d581f8"
      },
      "predecessor": {
        "file": "test/gates.js",
        "mode": "100644",
        "blob": "238e7a38313f54fd09d82df4dedb9a574f04243d",
        "sha256": "727b8cfba27ab2b1a69dedaa43aa5d289a09d91aeb27be5f66e87d744f1f4a12"
      }
    },
    {
      "file": "test/lib/enterprise-ux-native-guard.js",
      "current": {
        "file": "test/lib/enterprise-ux-native-guard.js",
        "mode": "100644",
        "blob": "6525e9b15bd312867dd51ad18e1aec68be868f3c",
        "sha256": "8e71846ce53b4a5f7e5e51094ba85b2804e4880ad0cc735e2ad5f543c2f20d45"
      },
      "predecessor": {
        "file": "test/lib/enterprise-ux-native-guard.js",
        "mode": "100644",
        "blob": "94e4ecab922b3e867d1f045b06bbaf660f184f2e",
        "sha256": "0f56601338664284990e833531c55467cd5871cfa2df7063a74c9ec64f35eb67"
      }
    },
    {
      "file": "test/lib/phase2-definition-fixtures.js",
      "current": {
        "file": "test/lib/phase2-definition-fixtures.js",
        "mode": "100644",
        "blob": "d7f1009811df95cd640c40d8ca6734fecc188300",
        "sha256": "5cebc42f838dc74d967da17c17842d90c26857ada505fd59f75d08517d5c7fa3"
      },
      "predecessor": {
        "file": "test/lib/phase2-definition-fixtures.js",
        "mode": "100644",
        "blob": "7e2d24c68cf92f1ffccf40f724e6a87abfa56c51",
        "sha256": "6a4caefad045583ec40f83b1dc7167a996d1f6d192dbf2fd5a48487dc5b45ff5"
      }
    },
    {
      "file": "test/lib/player-command-support.js",
      "current": {
        "file": "test/lib/player-command-support.js",
        "mode": "100644",
        "blob": "b2a797622dd08345ded80885dfaadceb7d91155e",
        "sha256": "a8ef16abc4e2cec361e44acbe79ca4f4ef6fd51bf7a0b7773a63e39c7b149e0f"
      },
      "predecessor": {
        "file": "test/lib/player-command-support.js",
        "mode": "100644",
        "blob": "64ea82dc7260db453a4ed25c8eca04deec33ae31",
        "sha256": "01ee09a0805a10ccc742e36b1e525d72a8c482940e1600e0a468c8ad749efdc5"
      }
    },
    {
      "file": "test/lib/ux-native-director-guard.js",
      "current": {
        "file": "test/lib/ux-native-director-guard.js",
        "mode": "100644",
        "blob": "e8b55aef3a18d32dd217d5b06656c5a9df5af066",
        "sha256": "1cce2f6aaf303737644338f0220dccfb6276c62747023b758cb34fa37774f952"
      },
      "predecessor": {
        "file": "test/lib/ux-native-director-guard.js",
        "mode": "100644",
        "blob": "374bdf171b7555225b6e777c05af16331f7e38e4",
        "sha256": "9c61586bea0737dbfc3f55f2577e432fdbe8fc1448c59c47f982ac523efd2dde"
      }
    },
    {
      "file": "test/lib/ux-native-reader-source-compatibility.js",
      "current": {
        "file": "test/lib/ux-native-reader-source-compatibility.js",
        "mode": "100644",
        "blob": "ac8ef4b0dd5476f7d6ee94b6f67ac9ef26141835",
        "sha256": "851f1f99f5bcb478d2a7bf354b0f0b08ea9ae5afc5535fadf877a943c33f1c35"
      },
      "predecessor": {
        "file": "test/lib/ux-native-reader-source-compatibility.js",
        "mode": "100644",
        "blob": "a983314da61b23e61a8f2263e3c338201a1f572d",
        "sha256": "bfeb64c42f056a2c7e556fb9e079faded5a5cb8f9785e428e8dd40a4194bce61"
      }
    },
    {
      "file": "test/sale-source-compatibility.js",
      "current": {
        "file": "test/sale-source-compatibility.js",
        "mode": "100644",
        "blob": "9d3de35cedac17863c7e80589f68f73936d23131",
        "sha256": "9eb278519625e3ff8bc91e7b43ad3948f9dcffea56227021a8ae6949f4c36808"
      },
      "predecessor": {
        "file": "test/sale-source-compatibility.js",
        "mode": "100644",
        "blob": "6b8e9c0d281ded00ce4833d346189145ec25967f",
        "sha256": "219cd4e6682ec5d0340e15effb6f207722b002d20bfb504be4175e6049264525"
      }
    },
    {
      "file": "test/ux-source-compatibility.js",
      "current": {
        "file": "test/ux-source-compatibility.js",
        "mode": "100644",
        "blob": "0e0ace196c4845a2b5a5c57dd5e215932ecc6654",
        "sha256": "144648a26a9126e899a8cebd6f04419492538ab39b572f16dfa3caa6305db42d"
      },
      "predecessor": {
        "file": "test/ux-source-compatibility.js",
        "mode": "100644",
        "blob": "d37ee22044e7314521df4f0b327e922084fa217f",
        "sha256": "9c64ace981c024f013f9328f8d41608d35dedc80cd00275c603f073a03bf728d"
      }
    },
    {
      "file": "test/worldgraph-validation.js",
      "current": {
        "file": "test/worldgraph-validation.js",
        "mode": "100644",
        "blob": "c73f08efbd515a6dbb4037de18a1b63defb6be4e",
        "sha256": "3c5db55fc8f1cb0fe42e2750661ff1084d42e96aa21efe0cace570b825aa7f8f"
      },
      "predecessor": {
        "file": "test/worldgraph-validation.js",
        "mode": "100644",
        "blob": "0f5272b41cb138775276a3bc25ad368cec7d8126",
        "sha256": "f6b5dc19d1b3b7beca45baa87e5a698dc8d958d5e93de3ac7e58de7fe48abe17"
      }
    },
    {
      "file": "tools/commerce-current-native-guard.js",
      "current": {
        "file": "tools/commerce-current-native-guard.js",
        "mode": "100644",
        "blob": "8efe89f46026e25746402bd22a860583b46a7b83",
        "sha256": "657998557ad14fec8ec120db4f5943c99f68ab16c27022a64d604cb82304e213"
      },
      "predecessor": {
        "file": "tools/commerce-current-native-guard.js",
        "mode": "100644",
        "blob": "7864e8407579d67db4c60e7a89dec2f569df02d3",
        "sha256": "df114c17bc1c172ed356c1d2c595eea31b42f4df378f797c93144fae89b7b305"
      }
    },
    {
      "file": "tools/economy-ux-merge-source-compatibility.js",
      "current": {
        "file": "tools/economy-ux-merge-source-compatibility.js",
        "mode": "100644",
        "blob": "3e51216a70882421a3ae93553dd10befbd5b453c",
        "sha256": "42698fc0941bff85d18a2ba6618582d51d87dd45ea5d308b0a7b91421f5e0d2e"
      },
      "predecessor": {
        "file": "tools/economy-ux-merge-source-compatibility.js",
        "mode": "100644",
        "blob": "3771af6b4e45f589a7838d33ea90dcf5cbc9c52d",
        "sha256": "c027cdf11599511a20ebca0ae57eb5c65f523e4b79df2a0ac8f7b185bef5d60e"
      }
    },
    {
      "file": "tools/enterprise-native-ux-seal.js",
      "current": {
        "file": "tools/enterprise-native-ux-seal.js",
        "mode": "100644",
        "blob": "ce068150be2334d8b41618740a6a8ea130338f75",
        "sha256": "0ed005b47cc9214b2cb688c4a80f2295093dc3c248193fc0b26be32906f7ef46"
      },
      "predecessor": {
        "file": "tools/enterprise-native-ux-seal.js",
        "mode": "100644",
        "blob": "5bdf43a3c48e98557ac6eb49487b56e20130ce2b",
        "sha256": "68019afc0554efaa273c9a008d06dd353b670d88adb6d45fc79c90ed611295c4"
      }
    },
    {
      "file": "tools/enterprise-native-ux.js",
      "current": {
        "file": "tools/enterprise-native-ux.js",
        "mode": "100644",
        "blob": "78878a2aa0968ce55b5bae1d580a0715a4559f02",
        "sha256": "0890e7638554d6e0b90acf9aea2edf403a9a6e8b7d5350267b549941d114e908"
      },
      "predecessor": {
        "file": "tools/enterprise-native-ux.js",
        "mode": "100644",
        "blob": "c86362d86bcd653428a83ab3c3e4d6df27d5c69d",
        "sha256": "7c4912e7c713e2f920447233f4e51d5d57706eb00a5b520c597725b55c1666f3"
      }
    },
    {
      "file": "tools/enterprise-native.js",
      "current": {
        "file": "tools/enterprise-native.js",
        "mode": "100644",
        "blob": "c2c4d0393840d7048046989dec643c4f07746c6e",
        "sha256": "e75e51b8f04badbecf819c15f50f4b0c36dcfd52e3710e851acd962014818868"
      },
      "predecessor": {
        "file": "tools/enterprise-native.js",
        "mode": "100644",
        "blob": "5eb580ee6c27e3b1d9938b4829f97da1221dcca2",
        "sha256": "12b218541f988366ae91c570ec4a05bf18e5a717d9afcda7e8bc1f825e7888d4"
      }
    },
    {
      "file": "tools/pgquery.js",
      "current": {
        "file": "tools/pgquery.js",
        "mode": "100644",
        "blob": "40f24c96132606a3ffa4986790ed00606a702089",
        "sha256": "9d5ced1d591ab0d5328b686a0f1f0b5937148c721b626c73b6cebf5833a861c6"
      },
      "predecessor": {
        "file": "tools/pgquery.js",
        "mode": "100644",
        "blob": "db503b17b08439bcbd36aacc4deae0b8a1907c53",
        "sha256": "ed8d93ce2c634c861af924270ea77b26ab77d3e5e34a3d7cb24e84d06540d311"
      }
    },
    {
      "file": "tools/ux-release-phase2-native-catalog.js",
      "current": {
        "file": "tools/ux-release-phase2-native-catalog.js",
        "mode": "100644",
        "blob": "9627018aedc2700e1cd4a9dc06a3a9c0c100d87d",
        "sha256": "d59e8b81c8ce0ac2caeb3301d164914a4d7a452b3a2b1103060017c08878eb7b"
      },
      "predecessor": {
        "file": "tools/ux-release-phase2-native-catalog.js",
        "mode": "100644",
        "blob": "38dc31de8b9d30cdfd359b6bf8f5cfa02ad1925e",
        "sha256": "4c122b2439ef19868259a0b6dbc7cb29d4539c6098ef7e5289703c32d1687fd9"
      }
    },
    {
      "file": "tools/ux-source-compatibility.js",
      "current": {
        "file": "tools/ux-source-compatibility.js",
        "mode": "100644",
        "blob": "064bc4f3bbb8933f7a4d152d371711c45a68ad90",
        "sha256": "cf9ea1c334631561259caf857c16847146a76d225e8641b17d9e19e04158bd68"
      },
      "predecessor": {
        "file": "tools/ux-source-compatibility.js",
        "mode": "100644",
        "blob": "510ec979b9e83221cf6a7dd2045b08e2f0419d6a",
        "sha256": "7d4652ef370a10daf52c59a40d5e9435bf4b3aeb71f717da9a21371bcab37096"
      }
    }
  ],
  "sourceOnly": true,
  "nativeAdmission": false,
  "priorResultsTransferred": false
});
export const ECONOMY_DEED_MERGE_NATIVE_PROVENANCE_SHA256 = "7e1789e4f7e7c65c23b6145835b10a66432efbc32d0d3726b1ae26237971ee85";
