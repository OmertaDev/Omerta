// Generated comparison-only Git records. Native checks use physical bytes.
export const integratedEconomicSource = {
  "revision": "31066d3fb2ea1e93a5525edf7859606334f86efd",
  "tree": "854196b57ff1698b8a74530d35fb131f6905a196",
  "parents": {
    "economic": "3cf03ab3ebec43983b59ee07849594ed34f3dcae",
    "main": "68a4d92d810ee17c192abb8a8c2a3fcbf87c4c52"
  },
  "files": {
    "docs/WIKI.md": {
      "current": {
        "mode": "100644",
        "blob": "b8963b492d52c58f56cc0d34ef51fa3ca5c48183",
        "sha256": "d751d95113c51de96a98f1a4044098c4aedbc80a35d4db0516c81eb1ecc5447e",
        "bytes": 230355
      },
      "parents": {
        "economic": {
          "pin": {
            "mode": "100644",
            "blob": "77f183bed1d20cf69a9f9add4c427b3acdd3f78c",
            "sha256": "4d51fa2fd535f8a9cdc6dc79b800aecab4b8f3474dbee68ebebfe4f073b6f300",
            "bytes": 227918
          },
          "inverses": [
            {
              "at": 13486,
              "current": "### Watch: how the game economy works\n\n**October 30, 2026 · launch design snapshot.** This captioned, narrated guide explains the current design. Production trading, financial rewards and NFT issuance remain subject to deployment, funding and launch activation.\n\n[![Watch the OMERTÀ game economy explainer](../public/art/wiki-economy/omerta-wiki-economy-poster.jpg)](../public/art/wiki-economy/omerta-wiki-economy-1080p.mp4)\n\n[Watch or download the film](../public/art/wiki-economy/omerta-wiki-economy-1080p.mp4) · [English captions](../public/art/wiki-economy/captions.vtt) · [Read the transcript](../public/art/wiki-economy/transcript.md) · [Explore all six graphics](../public/art/wiki-economy/gallery.html)\n\nSelect a diagram for its full-resolution PNG; editable SVGs are also available.\n\n| Diagram | Preview | Editable SVG |\n| --- | --- | --- |\n| How value moves | [![Game cash, OMR and stock rewards follow separate value flows.](../public/art/wiki-economy/economy-map.png)](../public/art/wiki-economy/economy-map.png) | [SVG](../public/art/wiki-economy/economy-map.svg) |\n| Where trading fees go | [![The 4% protocol fee has five destinations; hook and LP fees are separate.](../public/art/wiki-economy/fee-split.png)](../public/art/wiki-economy/fee-split.png) | [SVG](../public/art/wiki-economy/fee-split.svg) |\n| The Deed lifecycle | [![Bloodline identity, character custody and equipped Deeds have separate ownership and death rules.](../public/art/wiki-economy/deed-lifecycle.png)](../public/art/wiki-economy/deed-lifecycle.png) | [SVG](../public/art/wiki-economy/deed-lifecycle.svg) |\n| Qualifying for stocks | [![New stocks require verified equipment, a living character, Broker activation and qualifying play.](../public/art/wiki-economy/stock-rewards.png)](../public/art/wiki-economy/stock-rewards.png) | [SVG](../public/art/wiki-economy/stock-rewards.svg) |\n| Token and property supply | [![Fixed supply of 100 million OMR and 2,500 Deeds: 1,000 earned, 1,000 paid and 500 partnership.](../public/art/wiki-economy/token-supply.png)](../public/art/wiki-economy/token-supply.png) | [SVG](../public/art/wiki-economy/token-supply.svg) |\n| Technology and ownership | [![Token and NFT standards connect authoritative gameplay to on-chain custody and settlement.](../public/art/wiki-economy/technology-stack.png)](../public/art/wiki-economy/technology-stack.png) | [SVG](../public/art/wiki-economy/technology-stack.svg) |\n\n",
              "baseline": ""
            }
          ]
        },
        "main": {
          "pin": {
            "mode": "100644",
            "blob": "ec52c5ed9fa0bd90eaef9e836b5a63d460a1b9fa",
            "sha256": "24c8d4c1bf9787c8653353813b5234ee19b105685f44146f5bd44e746863019d",
            "bytes": 230340
          },
          "inverses": [
            {
              "at": 18062,
              "current": "verified auction contract’s opening and closing blocks determine when bids are accepted. Check the published auction status for timing",
              "baseline": "target is around noon New York on October 9–14, 2026. Verified native block boundaries determine the window; exact wall-clock timing is not guaranteed"
            },
            {
              "at": 174229,
              "current": "The Store quotes PLEX prices from the market rate, subject to each package’s price floor",
              "baseline": "Across the mission ladder, $OMR rewards sum to 1,320 and the daily contract bonus adds 3 per day, compared\nwith 4,118 for the cheapest PLEX package"
            },
            {
              "at": 187848,
              "current": "recorded receipts and allocations. Verifying the treasury’s actual wallet balance requires a separate on-chain check",
              "baseline": "funding and allocation records"
            }
          ]
        }
      }
    },
    "package.json": {
      "current": {
        "mode": "100644",
        "blob": "2ba16a679f284ba94ca9957045607b4dd3bb4509",
        "sha256": "18794e721e0c6ac8797266a12e41fccb53c74df19af6b3634897d99e1260976d",
        "bytes": 61055
      },
      "parents": {
        "economic": {
          "pin": {
            "mode": "100644",
            "blob": "d88a33d6eaa1e4b9e6adc3490ecb0c9e1bd96afc",
            "sha256": "82107889e119e262579663e239f09b4abbe1c068ff63c582764ddcb2e5ce32fa",
            "bytes": 60022
          },
          "inverses": [
            {
              "at": 4029,
              "current": "business-desk && npm run test:business-desk:provenance && npm run test:agent-economy-market-operations && npm run test:agent-economy-next-layer && npm run test:agent-economy-next-five && npm run test:equipment-economy && node test/rc1-first-batch-source-compatibility.js && node test/companyproduction.js && node test/companyspecialization.js && node test/itemdurability.js && node test/itemdurability-quality.js && node test/companydemand.js && node test/companyforecast.js && node test/companyproduction-integration.js && node test/company-economy-contracts.js && node test/player-intel-source-compatibility.js && node test/commercialpremises.js && node test/commercialpremises-integration.js && node test/rc1-commercial-premises-source-compatibility.js && node test/companybankportfolios.js && node test/companybankportfolio-integration.js && node test/rc1-company-bank-source-compatibility.js && node test/companylogisticshubs.js && node test/companylogisticshubs-integration.js && node test/rc1-company-logistics-hub-source-compatibility.js && node test/buyercooperatives.js && node test/buyercooperative-integration.js && node test/rc1-buyer-cooperative-source-compatibility.js && node test/companyopportunities.js && node test/companyopportunity-integration.js && node test/rc1-company-opportunity-source-compatibility.js && node test/commercialreputation.js && node test/commercialreputation-integration.js && node test/rc1-commercial-reputation-source-compatibility.js && node test/businessseasons.js && node test/businessseason-integration.js && node test/rc1-business-season-source-compatibility.js && node test/rc1-game-employment-source-compatibility.js && node test/rc1-company-workflow-source-compatibility.js && node test/companyopportunities-api.js && node test/commercialreputation-api.js && node test/businessseasons-api.js && node test/companyworkflows.js && node test/companyworkflow-integration.js && node test/gameemployment.js && node test/gameemployment-integration.js && node test/companyoperatorrunner.js && node test/rc1-company-operator-source-compatibility.js && node test/companyoperators.js && node test/companyoperators-api.js && node test/storefrontfulfillment.js && node test/storefront-fulfillment-api.js && node test/courierjobs.js && node test/supplycontracts.js && node test/supplycontracts-api.js && node test/earningreceipts.js && node test/resource-deliver.js && node test/identity-checkout.js && node test/identity-checkout-client.js && node test/identity-checkout-api.js && node test/current-copy.js && node test/operation-read-paths.js && node test/world-projection-mysteries.js && node test/world-projection-mysteries-api.js && node test/world-projection-read.js && node test/world-projection.js && node test/world-projection-api.js && node test/projection-events.js && node test/projection-events-ws.js && node test/world-projection-client.js && node test/coordination-operation-definitions.js && node test/coordination-mode-boundary.js && node test/coordination-capital.js && node test/coordination-materials.js && node test/coordination-knowledge-proof.js && node test/world-kernel-transaction.js && node test/family-operations.js && node test/family-operations-api.js && node test/world-knowledge-crafting.js && node test/world-kernel-query.js && node test/world-kernel-input.js && node test/world-kernel.js && node test/world-kernel-api.js && node test/coordination-graph.js && node test/coordination.js && node test/coordination-api.js && node test/coordination-http-receipts.js && node test/coordination-knowledge.js && node test/coordination-knowledge-runtime.js && node test/coordination-knowledge-api.js && node test/finalizedobservation.js && node test/stockballotv2.js && node test/rwanominations.js && node test/rwaroutes.js && node test/rwahealth.js && node test/rwahealth.integration.js && node test/rwahealthclearance.js && node test/rwahealthclearancecontext.js && node test/rwahealthoverlay.readiness.js && node test/rwahealthoverlay.schema.js && node test/rwahealthoverlay.vector.js && node test/rwaregistrylifecycle.js && node test/rwaregistrylifecycle.sync.js && node test/agent-referral-cash.js && node test/phase2-discovery.js && node test/phase2-compiler.js && node test/phase2-review-regressions.js && node test/phase2-scale.js && node test/content-graph.js && node test/content-runtime.js && node test/content-social.js && node test/content-seasonal.js && node test/content-seasonal-case.js && node test/content-crafting.js && node test/content-crafting-jobs.js && node test/content-crafting-tools.js && node test/content-exchange.js && node test/content-api.js && node test/v4oraclekeeper.js && node test/genesiscca.js && node test/genesislaunch.js && node test/genesisrelease.js && node test/worldgraph.js && node test/worldgraph-validation.js && node test/items.js && node test/crafting.js && node test/mysteries.js && node test/operations.js && node test/belladonna.js && node test/worldgraph-api.js && node test/city-rpg.js && node tools/pgcheck-belladonna.js --pg-mem && node test/phase2-definition-schema.js && node test/phase2-definitions.js && node test/phase2-activation.js && node test/phase2-definition-invariants.js && node test/phase2-lot-boundary.js && node test/keepertransactions.js && node test/liquiditykeeper.js && node test/genesiskeeper.js && node test/liquidityaccounting.js --memory && node test/liquidityaccounting-review.js && node test/liquiditypolicy.js --memory && node test/bond-unlimited.js --memory && node test/bondquoteexpiry.js && node test/liquidityrpc.js && node tools/liquidity-manifest-example.js --self-test && node test/liquiditypolicy-review.js && node test/liquidityqueue.js --memory && node test/liquidityqueue-review.js && node test/character-mint-policy.js && node test/phase2-lots.js && node test/phase2-lots-property.js && node test/audit/mint-dev-allocation.js --memory && node test/audit/deed-reimport-order.js --memory && node test/progression-admission.js && node test/world-prerequisites.js && node test/recipe-policy.js && node test/furnace-ledger.js && node test/core-progression-api.js && node test/player-commands.js && node test/player-command-journey.js && node test/player-command-api.js && node test/player-command-client.js && node test/director-definitions.js && node test/director-config.js && node test/director-runtime.js && node test/director-recovery.js && node test/director-dock-world.js && node test/director-commands.js && node test/director-api.js && node test/director-journey.js && node test/director-security.js && node test/director-simulation.js && node test/director-network.js && node test/campaign-network-journey.js && node test/director-network-recovery.js && node test/player-opportunities.js && node test/world-consequences.js && node test/rc1-city-gameplay-source-compatibility.js && npm run test:gateway && npm run test:legal-security && npm run test:release-source-transfer && node test/wiki-media-source-transfer.js && node test/age21-source-transfer.js",
              "baseline": "agent-economy-market-operations && npm run test:agent-economy-next-layer && npm run test:agent-economy-next-five && npm run test:equipment-economy && node test/rc1-first-batch-source-compatibility.js && node test/companyproduction.js && node test/companyspecialization.js && node test/itemdurability.js && node test/itemdurability-quality.js && node test/companydemand.js && node test/companyforecast.js && node test/companyproduction-integration.js && node test/company-economy-contracts.js && node test/player-intel-source-compatibility.js && node test/commercialpremises.js && node test/commercialpremises-integration.js && node test/rc1-commercial-premises-source-compatibility.js && node test/companybankportfolios.js && node test/companybankportfolio-integration.js && node test/rc1-company-bank-source-compatibility.js && node test/companylogisticshubs.js && node test/companylogisticshubs-integration.js && node test/rc1-company-logistics-hub-source-compatibility.js && node test/buyercooperatives.js && node test/buyercooperative-integration.js && node test/rc1-buyer-cooperative-source-compatibility.js && node test/companyopportunities.js && node test/companyopportunity-integration.js && node test/rc1-company-opportunity-source-compatibility.js && node test/commercialreputation.js && node test/commercialreputation-integration.js && node test/rc1-commercial-reputation-source-compatibility.js && node test/businessseasons.js && node test/businessseason-integration.js && node test/rc1-business-season-source-compatibility.js && node test/rc1-game-employment-source-compatibility.js && node test/rc1-company-workflow-source-compatibility.js && node test/companyopportunities-api.js && node test/commercialreputation-api.js && node test/businessseasons-api.js && node test/companyworkflows.js && node test/companyworkflow-integration.js && node test/gameemployment.js && node test/gameemployment-integration.js && node test/companyoperatorrunner.js && node test/rc1-company-operator-source-compatibility.js && node test/companyoperators.js && node test/companyoperators-api.js && node test/storefrontfulfillment.js && node test/storefront-fulfillment-api.js && node test/courierjobs.js && node test/supplycontracts.js && node test/supplycontracts-api.js && node test/earningreceipts.js && node test/resource-deliver.js && node test/identity-checkout.js && node test/identity-checkout-client.js && node test/identity-checkout-api.js && node test/current-copy.js && node test/operation-read-paths.js && node test/world-projection-mysteries.js && node test/world-projection-mysteries-api.js && node test/world-projection-read.js && node test/world-projection.js && node test/world-projection-api.js && node test/projection-events.js && node test/projection-events-ws.js && node test/world-projection-client.js && node test/coordination-operation-definitions.js && node test/coordination-mode-boundary.js && node test/coordination-capital.js && node test/coordination-materials.js && node test/coordination-knowledge-proof.js && node test/world-kernel-transaction.js && node test/family-operations.js && node test/family-operations-api.js && node test/world-knowledge-crafting.js && node test/world-kernel-query.js && node test/world-kernel-input.js && node test/world-kernel.js && node test/world-kernel-api.js && node test/coordination-graph.js && node test/coordination.js && node test/coordination-api.js && node test/coordination-http-receipts.js && node test/coordination-knowledge.js && node test/coordination-knowledge-runtime.js && node test/coordination-knowledge-api.js && node test/finalizedobservation.js && node test/stockballotv2.js && node test/rwanominations.js && node test/rwaroutes.js && node test/rwahealth.js && node test/rwahealth.integration.js && node test/rwahealthclearance.js && node test/rwahealthclearancecontext.js && node test/rwahealthoverlay.readiness.js && node test/rwahealthoverlay.schema.js && node test/rwahealthoverlay.vector.js && node test/rwaregistrylifecycle.js && node test/rwaregistrylifecycle.sync.js && node test/agent-referral-cash.js && node test/phase2-discovery.js && node test/phase2-compiler.js && node test/phase2-review-regressions.js && node test/phase2-scale.js && node test/content-graph.js && node test/content-runtime.js && node test/content-social.js && node test/content-seasonal.js && node test/content-seasonal-case.js && node test/content-crafting.js && node test/content-crafting-jobs.js && node test/content-crafting-tools.js && node test/content-exchange.js && node test/content-api.js && node test/v4oraclekeeper.js && node test/genesiscca.js && node test/genesislaunch.js && node test/genesisrelease.js && node test/worldgraph.js && node test/worldgraph-validation.js && node test/items.js && node test/crafting.js && node test/mysteries.js && node test/operations.js && node test/belladonna.js && node test/worldgraph-api.js && node test/city-rpg.js && node tools/pgcheck-belladonna.js --pg-mem && node test/phase2-definition-schema.js && node test/phase2-definitions.js && node test/phase2-activation.js && node test/phase2-definition-invariants.js && node test/phase2-lot-boundary.js && node test/keepertransactions.js && node test/liquiditykeeper.js && node test/genesiskeeper.js && node test/liquidityaccounting.js --memory && node test/liquidityaccounting-review.js && node test/liquiditypolicy.js --memory && node test/bond-unlimited.js --memory && node test/bondquoteexpiry.js && node test/liquidityrpc.js && node tools/liquidity-manifest-example.js --self-test && node test/liquiditypolicy-review.js && node test/liquidityqueue.js --memory && node test/liquidityqueue-review.js && node test/character-mint-policy.js && node test/phase2-lots.js && node test/phase2-lots-property.js && node test/audit/mint-dev-allocation.js --memory && node test/audit/deed-reimport-order.js --memory && node test/progression-admission.js && node test/world-prerequisites.js && node test/recipe-policy.js && node test/furnace-ledger.js && node test/core-progression-api.js && node test/player-commands.js && node test/player-command-journey.js && node test/player-command-api.js && node test/player-command-client.js && node test/director-definitions.js && node test/director-config.js && node test/director-runtime.js && node test/director-recovery.js && node test/director-dock-world.js && node test/director-commands.js && node test/director-api.js && node test/director-journey.js && node test/director-security.js && node test/director-simulation.js && node test/director-network.js && node test/campaign-network-journey.js && node test/director-network-recovery.js && node test/player-opportunities.js && node test/world-consequences.js && node test/rc1-city-gameplay-source-compatibility.js && npm run test:gateway && npm run test:legal-security && npm run test:release-source-transfer"
            },
            {
              "at": 17604,
              "current": " && node test/wiki-economy-media.js",
              "baseline": ""
            },
            {
              "at": 47757,
              "current": "    \"test:business-desk\": \"node test/businessdesk.js && node test/businessdesk-api.js && node test/business-control-desk-loop.js\",\n    \"test:business-desk:browser\": \"node test/businessdesk-consent-browser.js && node test/business-control-desk-browser.js\",\n    \"test:business-desk:postgres\": \"node test/businessdesk-api.js --postgres && node test/business-control-desk-loop.js --postgres\",\n    \"test:business-desk:provenance\": \"node test/businessdesk-native-provenance.js\",\n",
              "baseline": ""
            },
            {
              "at": 60050,
              "current": "businessdesk-combined-source-compatibility.js && node test/businessdesk-combined-native-provenance.js && node test/economy-deed-merge-source-compatibility.js && node test/businessdesk-noir-source-compatibility.js && node test/businessdesk-source-compatibility.js && node test/deed-allocation-source-compatibility.js && node test/deed-benefit-native-catalog.js && node test/economy-ux-merge-source-compatibility.js\",\n    \"test:economy-security\": \"node test/economy-monitor.js && node test/economy-composition",
              "baseline": "deed-allocation-source-compatibility.js && node test/deed-benefit-native-catalog.js && node test/economy-ux-merge-source-compatibility"
            }
          ]
        },
        "main": {
          "pin": {
            "mode": "100644",
            "blob": "8377a7868772bcd0aba88aec3df9590aea3cbe69",
            "sha256": "81f5d07b01fb62a61eee002d88b5d5ae70ead9d764286569955ad6af6aadf202",
            "bytes": 61015
          },
          "inverses": [
            {
              "at": 14877,
              "current": "inventory-bond-checkout.js && node test/",
              "baseline": ""
            }
          ]
        }
      }
    },
    "public/index.html": {
      "current": {
        "mode": "100644",
        "blob": "8bf91d981ed41b573b19b59ca61d9b0a2e95aa96",
        "sha256": "9e4a8c2889e7fef7f3d9ddda6e2737b17b8df4489c68171df082cfe9bb3ad226",
        "bytes": 1404170
      },
      "parents": {
        "economic": {
          "pin": {
            "mode": "100644",
            "blob": "d356290eff68f6ac8521ed0d63c257712b3cb214",
            "sha256": "9c520c523d8d79be1a3608f49580a62112e0b7adb695a5e2876b8fb144538468",
            "bytes": 1400474
          },
          "inverses": [
            {
              "at": 7140,
              "current": "relative",
              "baseline": "static"
            },
            {
              "at": 103846,
              "current": "<link rel=\"stylesheet\" href=\"/business-control-desk.css?v=20261030-1\">\n",
              "baseline": ""
            },
            {
              "at": 227197,
              "current": "  let _businessDesk = null, _businessDeskEpoch = 0;\n",
              "baseline": ""
            },
            {
              "at": 476770,
              "current": "      if (['session', 'character'].includes(kind)) destroyBusinessDesk();\n",
              "baseline": ""
            },
            {
              "at": 525703,
              "current": "    // Showing a closed <details> only reveals its summary, not the protected recovery control.\n    const history = $('#operation-desk .operation-desk__history'), latest = operationReceipts[0];\n    if (history && latest?.state === 'error' && (latest.recovery?.run || latest.recovery?.tab))\n      history.open = true;\n",
              "baseline": ""
            },
            {
              "at": 577377,
              "current": "destroyBusinessDesk(); ",
              "baseline": ""
            },
            {
              "at": 598713,
              "current": "closeGameMenu(); ",
              "baseline": ""
            },
            {
              "at": 607655,
              "current": "async ",
              "baseline": ""
            },
            {
              "at": 607941,
              "current": "const returnTab = tourReturnTab, opener = tourReplayOpener;\n      // The screen render replaces its controls; restore focus only after that render and modal teardown.\n      await setTab(returnTab);\n      if (currentTab !== returnTab || topModal()) return",
              "baseline": "setTab(tourReturnTab)"
            },
            {
              "at": 608250,
              "current": "returnTab}`),\n        ...document.querySelectorAll(`#tab-${returnTab} button:not([disabled]), #tab-${returnTab} [href], #tab-${returnTab} input:not([disabled]), #tab-${returnTab} select:not([disabled])`),\n        $(`#tab-control-${r",
              "baseline": "tourReturnTab}`),\n        ...document.querySelectorAll(`#tab-${tourReturnTab} button:not([disabled]), #tab-${tourReturnTab} [href], #tab-${tourReturnTab} input:not([disabled]), #tab-${tourReturnTab} select:not([disabled])`),\n        $(`#tab-control-${tourR"
            },
            {
              "at": 608659,
              "current": "opener?.isConnected && !opener.closest('.hidden, [hidden], [inert]')\n        && opener.getClientRects().length && getComputedStyle(opener).visibility !== 'hidden'\n        && typeof opener.focus === 'function') {\n        o",
              "baseline": "tourReplayOpener?.isConnected && tourReplayOpener.getClientRects().length && typeof tourReplayOpener.focus === 'function') {\n        tourReplayO"
            },
            {
              "at": 669318,
              "current": " 'business',",
              "baseline": ""
            },
            {
              "at": 669579,
              "current": "id === 'business' ? 'Business Desk' : ",
              "baseline": ""
            },
            {
              "at": 670360,
              "current": "    business: ['business desk', 'company', 'production', 'manufacturing', 'orders', 'courier', 'consignment', 'cash flow', 'reinvest'],\n",
              "baseline": ""
            },
            {
              "at": 672671,
              "current": "business', '",
              "baseline": ""
            },
            {
              "at": 673557,
              "current": "business: 'interior-empire', ",
              "baseline": ""
            },
            {
              "at": 683590,
              "current": "business: renderBusiness, ",
              "baseline": ""
            },
            {
              "at": 685642,
              "current": "    business: 'Run your company with real inventory, production, deliveries and customer sales. Cash flow records game-cash movements, including refundable escrow and transfers; it is not a profit forecast.',\n",
              "baseline": ""
            },
            {
              "at": 822421,
              "current": "  function businessIdentity() { return me?.id ? [session?.accountId || \"\", me.id, me.generation].join(\":\") : \"\"; }\n  function destroyBusinessDesk() { _businessDeskEpoch++; _businessDesk?.destroy(); _businessDesk = null; }\n  async function renderBusiness() {\n    const host = $(\"#tab-business\");\n    if (!host || currentTab !== \"business\") return;\n    const identity = businessIdentity(), credential = token;\n    const current = () => !!identity && identity === businessIdentity() && credential === token;\n    const guarded = (options, mutation = false) => ({ ...options,\n      isCurrent: () => current() && (!options.isCurrent || options.isCurrent()),\n      ...(mutation ? { beforeDispatch: () => current() && currentTab === \"business\" && (!options.beforeDispatch || options.beforeDispatch()) } : {}),\n    });\n    const options = { character: { ...me }, identity,\n      api: (method, path, body, request = {}) => api(method, path, body, guarded(request)),\n      act: (method, path, body, request = {}) => act(method, path, body, guarded(request, true)),\n      refresh: () => current() ? refresh() : Promise.resolve({ ignored: true, code: 499, body: {} }),\n      onNavigate: (tab, context) => { if (current()) navigateGameTab(tab, context); },\n      isActive: () => current() && currentTab === \"business\" && !$(\"#screen-main\").classList.contains(\"hidden\"),\n    };\n    if (_businessDesk) { _businessDesk.update(options); return; }\n    const epoch = ++_businessDeskEpoch;\n    host.innerHTML = '<div class=\"card\" role=\"status\">Opening your business desk…</div>';\n    try {\n      await loadGameScript(\"/business-control-desk.js?v=20261030-1\", () => !!window.OmertaBusinessDesk);\n      if (epoch !== _businessDeskEpoch || !current() || currentTab !== \"business\") return;\n      _businessDesk = window.OmertaBusinessDesk.mount(host, options);\n    } catch {\n      if (epoch !== _businessDeskEpoch || !current() || currentTab !== \"business\") return;\n      host.innerHTML = '<div class=\"card\"><p role=\"status\">The business desk could not open. Your other game screens remain available.</p><button class=\"act\" id=\"business-retry-open\">Try again</button></div>';\n      $(\"#business-retry-open\").onclick = renderBusiness;\n    }\n  }\n\n",
              "baseline": ""
            },
            {
              "at": 1389544,
              "current": "    if (event.target.closest('.modal-bg, dialog')) return;\n",
              "baseline": ""
            },
            {
              "at": 1389889,
              "current": " || event.defaultPrevented) return;\n    if (document.querySelector('.modal-bg:not(.hidden), dialog[open]')",
              "baseline": ""
            }
          ]
        },
        "main": {
          "pin": {
            "mode": "100644",
            "blob": "cb87163f7b87389596a737e18be397ce6a1af02a",
            "sha256": "e2795f78d407109a4b2e8e12f09b3eedd5d640fa6d7f3cecc435c0dd273e5f28",
            "bytes": 1406694
          },
          "inverses": [
            {
              "at": 447626,
              "current": "intent?.minimumOmr && body.noteId)\n      bits.push(`Pay ${body.intent.principalEth} ETH for at least ${body.intent.minimumOmr} OMR base units, vesting over ${minsTxt(body.vestingSeconds)}. Review the wallet transaction in Portfolio before the quote expires.",
              "baseline": "bond === 'quote')\n      bits.push(`\\u{1F4DD} quote signed — ${fmt(body.payoutOmr)} $OMR at ${body.discountBps / 100}% off the market price, vesting over ${\n        minsTxt(body.vestSeconds)} · submit bond(quote, signature) with your wallet within ${untilTxt(body.deadline)} or it lapses"
            },
            {
              "at": 459219,
              "current": "recorded a treasury allocation of ${body.eth} ETH",
              "baseline": "claimed ${body.eth} ETH into the vault"
            },
            {
              "at": 548850,
              "current": "async function inventoryBondWallet(",
              "baseline": "// submit a signed bond quote on-chain with the connected wallet. The server ABI-encodes bond(quote, sig)\n  // (viem — the zero-dep client never hand-rolls ABI); the wallet switches to the right chain, shows the tx\n  // (to / value / data), and the player approves. Mainnet-dormant until the bond chain is configured.\n  async function submitBondOnChain(nonce"
            },
            {
              "at": 548951,
              "current": "throw Error('A wallet is required.');\n    await provider.request({method:'eth_requestAccounts'});\n    await switchCharacterChain(provider, '0x1237');\n    return provider;\n  }\n\n  function bondOmr(units) {\n    const whole = units / 10n**18n, fraction = (units % 10n**18n).toString().padStart(18,'0').replace(/0+$/, '');\n    return String(whole) + (fraction ? '.'+fraction : '');",
              "baseline": "return; // picker closed — it already showed what is available / how to get one\n    try {\n      const cd = await api('POST', '/v1/bond/calldata', { nonce });\n      if (cd.code !== 200) { toast(describe(cd.body, cd.code), true); return; }\n      if (cd.body.deadline && cd.body.deadline * 1000 < Date.now()) { toast('that quote expired — request a fresh one', true); return; }\n      const [from] = await provider.request({ method: 'eth_requestAccounts' });\n      connectedProvider = provider;\n      try { await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: cd.body.chainIdHex }] }); }\n      catch (sw) { if (sw?.code !== 4902) throw sw; toast('add the OMERTÀ chain to your wallet first', true); return; }\n      const txHash = await provider.request({ method: 'eth_sendTransaction',\n        params: [{ from, to: cd.body.to, value: cd.body.value, data: cd.body.data }] });\n      toast('bond submitted on-chain — tx ' + String(txHash).slice(0, 12) + '…');\n    } catch (e) { toast(e?.message ? 'bond: ' + e.message : 'bond submit cancelled', true); }"
            },
            {
              "at": 688409,
              "current": "reasury allocations",
              "baseline": "he backed Vault"
            },
            {
              "at": 688780,
              "current": "Free players can compete on the boards. Each item lists its price and benefit",
              "baseline": "A skilled free player still tops every board; spending here funds the prize pool"
            },
            {
              "at": 836325,
              "current": "iControl && deed && c.canCollect === false)\n        parts.push(`<div class=\"d\">Your character can start earning corner income at level ${c.cornerMinLvl}",
              "baseline": "collectable > 0 && c.canCollect === false)\n        parts.push(`<div class=\"t\">The take is building — $${(c.collectable).toLocaleString()} banked. Working a corner takes level ${c.cornerMinLvl}; the street stays yours until then"
            },
            {
              "at": 836714,
              "current": " && !deed.onChain && c.canCollect !== false",
              "baseline": ""
            },
            {
              "at": 847164,
              "current": "level 25 on your current character, however you acquired the property",
              "baseline": "Level 25 for either public allocation"
            },
            {
              "at": 1045223,
              "current": "'1'",
              "baseline": "1"
            },
            {
              "at": 1110128,
              "current": "\n        <div style=\"margin-top:6px\">Use in-game $OMR for items showing a PLEX price. The ETH checkout requires activation",
              "baseline": " Spending funds token buybacks and backed prize pools.\n        <div style=\"margin-top:6px\">Pay in ETH or with in-game $OMR through PLEX for the same goods"
            },
            {
              "at": 1113760,
              "current": "ETH package fees through the payment router: developer ${S.split.founder / 100}% · Vig prize funding ${S.split.buyback / 100}% · treasury ${S.split.rwa / 100}% · community ${S.split.community / 100}%. PLEX spends game $OMR",
              "baseline": "Revenue split — founder ${S.split.founder / 100}% · token buyback ${S.split.buyback / 100}% · treasury ${S.split.rwa / 100}%"
            },
            {
              "at": 1233161,
              "current": "",
              "baseline": "bd.genesis || "
            },
            {
              "at": 1235401,
              "current": "ChecksAvailable = bd.purchase?.verificationAvailable === true",
              "baseline": "Daily = bd.daily || null;\n    const bondUnlimited = bondDaily?.unlimited === true;\n    const bondUnlimitedReady = bd.liquidity?.bondReady === true && bd.genesis?.bondQuotesOpen === true && !!bd.quote;\n    const bondOffered = Number(bondDaily?.offeredOmr || 0);\n    const bondRemaining = Number(bondDaily?.remainingOmr || 0);\n    const bondTranche = Number(bd.reserve?.remainingOmr || 0);\n    const bondCapacityKnown = bd.reserve?.remainingOmr != null && Number.isFinite(bondTranche);\n    const bondBuyable = bondUnlimited ? (bondUnlimitedReady && bondCapacityKnown ? Math.max(0, bondTranche) : 0)\n      : Math.max(0, Math.min(bondRemaining, bondTranche));\n    const bondFilledPct = bondOffered > 0 ? Math.max(0, Math.min(100, ((bondOffered - bondRemaining) / bondOffered) * 100)) : 0"
            },
            {
              "at": 1242107,
              "current": "Inventory bonds</span>\n            <span class=\"capital-market__body\">Funded OMR vests over the bond contract’s published term. Check the current quote before sending ETH.</span>\n            <span class=\"capital-market__value ${bondChecksAvailable ? '' : 'is-closed'}\">${bondChecksAvailable ? 'verify terms' : 'purchases unavailable",
              "baseline": "Bond account records</span>\n            <span class=\"capital-market__body\">${bondUnlimited ? `No daily account quota · ${bondCapacityKnown ? `${fmt(Math.max(0, bondTranche))} $OMR of reported quote capacity` : 'quote capacity is not reported'}` : bondDaily ? `${fmt(bondBuyable)} $OMR of reported quote capacity within today’s account limit` : 'No account bond offering has been posted.'}</span>\n            <span class=\"capital-market__value ${bondBuyable > 0 ? 'is-live' : 'is-closed'}\">${bondUnlimited ? (bondBuyable > 0 ? 'open' : 'quotes unavailable') : bondDaily ? `${Math.round(bondFilledPct)}% filled` : 'closed"
            },
            {
              "at": 1242820,
              "current": "accounting?.oracle ? 'is-live' : 'is-closed'}\">${bd.accounting?.oracle ? `${fmt(bd.accounting?",
              "baseline": "oracle ? 'is-live' : 'is-closed'}\">${bd.oracle ? `${fmt(bd"
            },
            {
              "at": 1243356,
              "current": "accounting?.reserve?.polEth || 0)} ETH · RWA ${fmt(bd.accounting?",
              "baseline": "reserve?.polEth || 0)} ETH · RWA ${fmt(bd"
            },
            {
              "at": 1247505,
              "current": "ransfers, loot, and funded distributions can move existing $OMR between accounts",
              "baseline": "he rest of the city's $OMR comes from purchases made with real money"
            },
            {
              "at": 1268036,
              "current": "Inventory bonds</h2>\n      <div class=\"card\"><span class=\"t\">Buy a vested OMR note</span>\n        <div class=\"d\">When open, the market bond reserves existing OMR for your wallet. It vests linearly. Your quote shows the ETH payment, minimum OMR, vesting term and expiry. Network gas applies.</div>\n        ${bondChecksAvailable ? `<div style=\"margin-top:6px\"><input id=\"bond-eth\" inputmode=\"decimal\" maxlength=\"60\" aria-label=\"ETH to pay\" placeholder=\"ETH\" size=\"8\"> <button class=\"act\" id=\"bond-quote\">Check purchase terms</button>\n          <button class=\"act\" id=\"bond-submit\" hidden>Review purchase in wallet</button>\n          <pre id=\"bond-quote-out\" style=\"white-space:pre-wrap;overflow-wrap:anywhere\" aria-live=\"polite\"></pre></div>` : '<p class=\"d\">New purchases are awaiting verified deployment, activation and funding.</p>'}",
              "baseline": "Bond account quotes <span class=\"d\" style=\"font-size:11px\">(reported account terms — verify the settlement contract, funded inventory and current market availability before paying)</span></h2>\n      ${(() => {\n        const dl = bd.daily, off = bd.offering || {};\n        const unlimited = dl?.unlimited === true;\n        // Unlimited daily policy does not imply readiness or available quote capacity.\n        const tranche = Number(bd.reserve?.remainingOmr || 0);\n        const capacityKnown = bd.reserve?.remainingOmr != null && Number.isFinite(tranche);\n        const posted = dl ? Number(dl.remainingOmr || 0) : 0;\n        const left = unlimited ? (capacityKnown ? Math.max(0, tranche) : 0) : Math.min(posted, tranche);\n        const ready = !unlimited || (bd.liquidity?.bondReady === true && bd.genesis?.bondQuotesOpen === true && !!bd.quote);\n        const open = !!dl && left > 0 && ready;\n        const pct = dl && Number(dl.offeredOmr) > 0 ? Math.round((posted / Number(dl.offeredOmr)) * 100) : 0;\n        return `\n      <div class=\"card\" style=\"border-color:${open ? 'var(--neon)' : 'rgba(255,255,255,.12)'}\">\n        <span class=\"t\" style=\"color:${open ? 'var(--neon)' : 'var(--dim)'}\">${unlimited ? 'No daily purchase limit' : open ? \"TODAY'S WINDOW — OPEN\" : 'THE WINDOW IS SHUT TODAY'}</span>\n        ${unlimited ? `<div class=\"d\">${capacityKnown ? `<b>${fmt(left)}</b> $OMR available for new quotes.` : 'Available supply is not reported.'}</div>\n          ${Number(bd.reserve?.reservedQuotesOmr) > 0 ? `<div class=\"d\">${fmt(bd.reserve.reservedQuotesOmr)} $OMR is reserved for outstanding signed quotes.</div>` : ''}\n          <div class=\"d\" style=\"font-size:11.5px;color:var(--dim);margin-top:4px\">${open ? 'Choose your purchase amount. The quote checks the available supply and current price.' : !ready ? 'New bond purchases are temporarily unavailable while the desk is paused or waiting for launch, liquidity and a current price.' : !capacityKnown ? 'Purchases are unavailable until the available supply is confirmed.' : 'There is no available supply for a new quote. Purchases resume when supply becomes available.'}</div>`\n        : open ? `<div class=\"d\"><b>${fmt(left)}</b> $OMR still on offer${posted > left ? ` <span class=\"chip cold\">the tranche behind the desk is the tighter of the two</span>` : ` of ${fmt(dl.offeredOmr)} posted`}</div>\n          <div class=\"bar\" style=\"margin-top:4px\"><i style=\"width:${pct}%\"></i></div>\n          <div class=\"d\" style=\"font-size:11.5px;color:var(--dim);margin-top:4px\">When it's gone it's gone until the house posts the next one. There is no queue and no reservation.</div>`\n        : (dl\n          ? `<div class=\"d\">An account offering was posted for today, but its quote budget has no remaining capacity. No new quote is available.</div>`\n          : `<div class=\"d\">No offering was posted. The house opens the window day by day and it is shut until it does — nothing is bought or sold here today.</div>`)}\n      </div>\n      <div class=\"card\">\n        <span class=\"t\">The Terms</span>\n        <table>\n          <tr><th>what you pay</th><td>ETH, on-chain, minimum ${off.minEth ?? '—'}</td></tr>\n          <tr><th>what you get</th><td>$OMR at <b>${off.discountBps != null ? (off.discountBps / 100) + '%' : '—'}</b> below the market price${bd.quote ? ` — about <b>${fmt(bd.quote.payoutOmr)}</b> per ETH right now` : ''}</td></tr>\n          <tr><th>when</th><td>released steadily over <b>${off.vestHours ?? '—'}h</b>, not all at once</td></tr>\n          <tr><th>settlement terms</th><td>verify the exact contract and recipient before paying. Canonical-market inventory bonds reserve already funded OMR and route proceeds to the configured War Chest.</td></tr>\n        </table>\n        <div class=\"d\" style=\"font-size:11.5px;color:var(--dim);margin-top:4px\">${unlimited ? `${bd.quote ? '' : 'A quote is unavailable while the desk is closed. '}${capacityKnown ? `${fmt(left)} $OMR remains available after accounting for outstanding signed quotes.` : 'Available supply is not reported.'}` : `${bd.quote ? '' : 'No market price has printed yet, so no quote can be signed. '}${tranche > 0\n          ? `The account service reports ${fmt(tranche)} $OMR of remaining quote capacity. This figure alone does not prove on-chain inventory or purchase availability.`\n          : 'The account quote budget has no remaining capacity.'}`}</div>"
            },
            {
              "at": 1268933,
              "current": "Inventory bond receipts</span>\n        <p class=\"d\">Find your note ID in the Purchased event of your confirmed wallet transaction. On Robinhood Chain, read claimable(bytes32) on the contract that emitted the event. Send claim(bytes32) with that note ID and zero ETH to collect vested OMR. The recorded beneficiary receives the tokens.</p>\n        ${bd.purchase?.deployment && me.wallet ? `<div class=\"d\">Bond contract: ${esc(bd.purchase.deployment.address)}</div>\n          <label>Receipt ID <input id=\"bond-note-id\" size=\"24\" list=\"bond-saved\" placeholder=\"0x…\" maxlength=\"66\"></label><datalist id=\"bond-saved\"></datalist>\n          <button class=\"act\" id=\"bond-note-read\">Check receipt</button><button class=\"act\" id=\"bond-note-claim\" hidden>Claim vested OMR in wallet</button>\n          <pre id=\"bond-note-out\" aria-live=\"polite\" style=\"white-space:pre-wrap;overflow-wrap:anywhere\"></pre>` : ''}",
              "baseline": "Take the Deal</span>\n        <div class=\"d\">This form reads the account quote service. Check its contract and terms before authorizing ETH; a returned quote does not establish canonical-market activation. Canonical-market inventory bonds use prefunded inventory, bounded purchases and linear vesting.</div>\n        <div style=\"margin-top:6px\"><input id=\"bond-eth\" placeholder=\"ETH\" size=\"6\"> <button class=\"act\" id=\"bond-quote\"${open ? '' : ' disabled'}>${open ? 'request a signed quote' : unlimited ? 'quotes unavailable' : 'the window is shut'}</button>\n          <button class=\"act\" id=\"bond-submit\" style=\"display:none;border-color:var(--neon)\">submit on-chain with wallet</button>\n          <div class=\"d\" style=\"font-size:11px;color:var(--dim)\">${me.wallet ? '' : '<b>Link your wallet above first</b> — a quote is bound to a proven address. '}${unlimited ? (open ? 'The desk is ready for on-chain purchases.' : 'New on-chain purchases are currently unavailable.') : 'The on-chain desk is <b>dormant until launch</b>.'}</div>\n          <pre id=\"bond-quote-out\" style=\"display:none;white-space:pre-wrap;font-size:11px;background:#111;padding:6px;border-radius:4px;margin-top:4px;overflow-x:auto\"></pre></div>"
            },
            {
              "at": 1269899,
              "current": "historical bond records</span>\n        <div class=\"d\">For an older on-chain purchase, find the numeric bondId in its Bonded event. Use the original contract’s claim(uint256) from the owner wallet. The claim button below updates your game record.</div",
              "baseline": "Bonds</span"
            },
            {
              "at": 1271100,
              "current": "",
              "baseline": "`; })()}"
            },
            {
              "at": 1272908,
              "current": "reasury Allocation <span class=\"d\" style=\"font-size:11px\">(spend game $OMR to record an allocation denominated in ETH",
              "baseline": "he Vault <span class=\"d\" style=\"font-size:11px\">(spend game $OMR to record a bounded internal ETH allocation; no blockchain token burn, ETH payout or redemption is implemented"
            },
            {
              "at": 1273087,
              "current": "This records an allocation on your account. No ETH is sent to your wallet. Minimum spend: ${vault.claimMin ?? 150} $OMR. Rolling daily limit: ${fmt(vault.claimDailyOmr ?? 12000)} $OMR per account.</div>\n        ${vault.open ? `\n        <div class=\"d\" style=\"margin-top:6px\"><b>${vault.availableEth} ETH</b> available to allocate from ${vault.heldEth} ETH in recorded revenue · ${fmt(vault.omrPerEth)} $OMR per ETH\n          <input id=\"vault-amt\" placeholder=\"$OMR\" size=\"7\"> <button class=\"act\" id=\"vault-claim\"${groundOff('The vault')}>record allocation",
              "baseline": "the house never owes ETH it doesn't hold · claims ${vault.claimMin ?? 150}–${fmt(vault.claimDailyOmr ?? 12000)} $OMR/day per house · big moves draw the Bureau's eye</div>\n        ${vault.availableEth > 0 ? `\n        <div class=\"d\" style=\"margin-top:6px\"><b>${vault.availableEth} ETH</b> unclaimed of ${vault.heldEth} held · ${fmt(vault.omrPerEth)} $OMR per ETH\n          <input id=\"vault-amt\" placeholder=\"$OMR\" size=\"7\"> <button class=\"act\" id=\"vault-claim\"${groundOff('The vault')}>claim"
            },
            {
              "at": 1273949,
              "current": "`<div class=\"d\" style=\"color:var(--dim)\">${vaultR.code !== 200 ? 'The allocation ledger is unavailable.' : vault.priceStale ? 'A current $OMR price is required before an allocation can be recorded.' : 'No recorded revenue is available for an allocation.'}</div>`}\n        ${vault.mine?.eth > 0 ? `<div class=\"d\" style=\"margin-top:6px\">Your recorded allocation: <b>${vault.mine.eth} ETH</b> (${fmt(vault.mine.costOmr)} game $OMR spent).</div>` : ''}\n        ${vault.funding ? `<div class=\"d\" style=\"font-size:11px;margin-top:6px\">Recorded revenue by source ·",
              "baseline": "'<div class=\"d\" style=\"color:var(--dim)\">the vault is fully claimed — the next revenue refills it (the ETH streams are accumulating)</div>'}\n        ${vault.mine?.eth > 0 ? `<div class=\"d\" style=\"margin-top:6px\">your vault: <b>${vault.mine.eth} ETH</b> (${fmt(vault.mine.costOmr)} $OMR burned) <span class=\"chip good\">BACKED</span></div>` : ''}\n        ${vault.funding ? `<div class=\"d\" style=\"font-size:11px;margin-top:6px\">WHAT'S BEHIND IT —"
            },
            {
              "at": 1279711,
              "current": "\n      const input = $('#bond-eth'), out = $('#bond-quote-out'), buy = $('#bond-submit');\n      let quote = null;\n      input.oninput = () => { quote = null; out.textContent = ''; buy.hidden = true; }",
              "baseline": " let lastNonce = null"
            },
            {
              "at": 1279954,
              "current": "quote = null; buy.hidden = true; bq.disabled = true;\n        try {\n          const principalEth = input.value.trim();\n          const reply = await api('POST','/v1/bond/quote',{principalEth});\n          if (reply.code !== 200) throw Error(describe(reply.body,reply.code) || 'Quote unavailable.');\n          const intent = reply.body.intent;\n          const client = await import('/inventory-bond-client.js');\n          if (input.value.trim() !== principalEth) return;\n          client.validateBondQuote(reply.body,bd.purchase.deployment,me.wallet,principalEth);\n          const minDisplay = bondOmr(BigInt(intent.minimumOmr));\n          out.textContent = 'Pay '+principalEth+' ETH for at least '+minDisplay+' OMR. Vesting: '+reply.body.vestingSeconds+' seconds.'\n            +'\\nExpires: '+new Date(intent.deadline*1000).toLocaleTimeString()+'\\nBond: '+intent.to+'\\nYour wallet: '+intent.buyer+'\\nNote ID: '+reply.body.noteId;\n          quote = reply.body; buy.hidden = false;\n        } catch(error) {out.textContent=error?.message || 'Quote unavailable.';}\n        finally { bq.disabled = false; }\n      };\n      buy.onclick = async () => {\n        if (!quote || buy.disabled) return;\n        buy.disabled = true; bq.disabled = true; input.disabled = true;\n        try {\n          const provider = await inventoryBondWallet();\n          const reply = await api('POST','/v1/bond/calldata',quote.intent);\n          if (reply.code !== 200) throw Error(describe(reply.body,reply.code) || 'Request a fresh quote.');\n          const client = await import('/inventory-bond-client.js');\n          const hash = await client.submitPurchase(provider,bd.purchase.deployment,quote,reply.body,me.wallet,localStorage);\n          out.textContent += '\\nSubmitted: '+hash+'. Check the receipt after confirmation.';\n          $('#bond-note-id').value = quote.noteId;\n        } catch (error) { out.textContent += '\\n'+(error?.message || 'Purchase unavailable.'); }\n        finally { quote=null; buy.hidden=true; buy.disabled=false; bq.disabled=false; input.disabled=false; }\n      };\n    } }\n    { const input = $('#bond-note-id'); if (input) {\n      const read = $('#bond-note-read'), claim = $('#bond-note-claim'), out = $('#bond-note-out'), pin = bd.purchase.deployment;\n      const client = await import('/inventory-bond-client.js');\n      try {\n        const ids = client.savedBondIds(localStorage,pin,me.wallet);\n        $('#bond-saved').replaceChildren(...ids.map(id => new Option(id,id)));\n        input.value = ids.at(-1) || '';\n      } catch { out.textContent = 'Paste the note ID from your wallet receipt.'; }\n      input.oninput = () => { claim.hidden = true; out.textContent = ''; };\n      const handle = async sending => {\n        read.disabled = claim.disabled = input.disabled = true; claim.hidden = true;\n        try {\n          const id = input.value.trim(), provider = await inventoryBondWallet();\n          if (sending) out.textContent = 'Claim submitted: '+await client.submitClaim(provider,pin,me.wallet,id)+'. Check the receipt after confirmation.';\n          else {\n            const note = await client.readBondNote(provider,pin,me.wallet,id);\n            out.textContent = 'Amount: '+bondOmr(note.amount)+' OMR. Claimed: '+bondOmr(note.claimed)+' OMR. Available: '\n              +bondOmr(note.claimable)+' OMR. Fully vested: '+new Date(note.end*1000).toLocaleString()+'.';\n            claim.hidden = !note.claimable;\n          }\n        } catch(error) { out.textContent = error?.message || 'Unable to verify this receipt.'; }\n        finally { read.disabled = claim.disabled = input.disabled = false",
              "baseline": "const r = await api('POST', '/v1/bond/quote', { principalEth: Number($('#bond-eth').value) });\n        const out = $('#bond-quote-out'); const bs = $('#bond-submit');\n        if (r.code === 200) { lastNonce = r.body.nonce; out.style.display = 'block'; if (bs) bs.style.display = 'inline-block';\n          out.textContent = `${fmt(r.body.payoutOmr)} $OMR at ${r.body.discountBps / 100}% off · nonce ${r.body.nonce}\\nsubmit bond(quote, signature) on-chain (or use the button):\\n` + JSON.stringify({ quote: r.body.quote, signature: r.body.signature }, null, 2);\n          toast('quote signed — submit it with your wallet'); }\n        else { out.style.display = 'none'; if (bs) bs.style.display = 'none'; toast(describe(r.body) || 'quote failed')"
            },
            {
              "at": 1283579,
              "current": "read.onclick = () => handle(false); claim.onclick = () => handle(true)",
              "baseline": "const bs = $('#bond-submit'); if (bs) bs.onclick = () => { if (lastNonce != null) submitBondOnChain(lastNonce); else toast('request a quote first', true); }"
            }
          ]
        }
      }
    },
    "public/wiki.html": {
      "current": {
        "mode": "100644",
        "blob": "6692138782cb1cfce78a9046230ed3de3bf03cad",
        "sha256": "1d2e97a176167539d1540b1ce3b62687ca80d059872b3d0595f9d68cc7c86750",
        "bytes": 250700
      },
      "parents": {
        "economic": {
          "pin": {
            "mode": "100644",
            "blob": "f01de86e75c5be43a7f9ff0ef9ff2a3d03aae4b5",
            "sha256": "a738f2be4719fc9a2414e9fae546e33b1186bfa8fad3608fd288e6d5d763ce0b",
            "bytes": 245588
          },
          "inverses": [
            {
              "at": 9336,
              "current": "#doc .wiki-economy-media{margin:0 0 28px;padding:18px;border:1px solid var(--line2);background:var(--panel);border-radius:2px}\n  #doc .wiki-economy-media h3{margin:0 0 10px}\n  #doc .wiki-economy-media .media-status{color:var(--dim);font-size:14px}\n  #doc .wiki-economy-media video{display:block;width:100%;height:auto;aspect-ratio:16/9;background:#080706}\n  #doc .wiki-economy-media .media-links{display:flex;flex-wrap:wrap;gap:6px 18px;margin:12px 0 16px;font-size:14px}\n  #doc .wiki-economy-media .media-links a{display:inline-flex;align-items:center;min-height:44px}\n  #doc .wiki-economy-previews{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:0 0 14px}\n  #doc .wiki-economy-previews figure{margin:0;min-width:0;border:1px solid var(--line)}\n  #doc .wiki-economy-previews img{display:block;width:100%;height:auto}\n  #doc .wiki-economy-previews figcaption{padding:8px 10px;color:var(--dim);font:14px/1.45 var(--mono)}\n  #doc .wiki-economy-previews figcaption{display:flex;align-items:center;justify-content:space-between;gap:8px}\n  #doc .wiki-economy-previews figcaption a{display:inline-flex;align-items:center;min-height:44px;padding:0 4px;flex-shrink:0}\n  @media(max-width:600px){#doc .wiki-economy-media{padding:12px}#doc .wiki-economy-previews{grid-template-columns:1fr}}\n\n",
              "baseline": ""
            },
            {
              "at": 42143,
              "current": "div class=\"wiki-economy-media\" aria-labelledby=\"economy-explainer-title\">\n      <h3 id=\"economy-explainer-title\">Watch: how the game economy works</h3>\n      <p class=\"media-status\" id=\"economy-explainer-status\"><b>October 30, 2026 · launch design snapshot.</b> This captioned, narrated guide explains the current design. Production trading, financial rewards and NFT issuance remain subject to deployment, funding and launch activation.</p>\n      <video controls playsinline preload=\"none\" width=\"1920\" height=\"1080\" poster=\"/art/wiki-economy/omerta-wiki-economy-poster.jpg\" aria-label=\"OMERTÀ game economy explainer\" aria-describedby=\"economy-explainer-status\">\n        <source src=\"/art/wiki-economy/omerta-wiki-economy-1080p.mp4\" type=\"video/mp4\">\n        <p><a href=\"/art/wiki-economy/omerta-wiki-economy-1080p.mp4\">Download the video</a> or <a href=\"/art/wiki-economy/transcript.md\">read the transcript</a>.</p>\n      </video>\n      <div class=\"media-links\"><a href=\"/art/wiki-economy/transcript.md\">Read the transcript</a><a href=\"/art/wiki-economy/gallery.html\">Open the media gallery</a><a href=\"/art/wiki-economy/omerta-wiki-economy-1080p.mp4\" download>Download the film</a><a href=\"/art/wiki-economy/captions.vtt\" download>Download captions (VTT)</a></div>\n      <div class=\"wiki-economy-previews\" aria-label=\"Six economy diagrams; select an image for the full-resolution PNG\">\n        <figure><a href=\"/art/wiki-economy/economy-map.png\"><img src=\"/art/wiki-economy/economy-map.png\" width=\"1920\" height=\"1080\" loading=\"lazy\" decoding=\"async\" alt=\"Game cash, OMR and stock rewards follow separate value flows.\"></a><figcaption>How value moves <a href=\"/art/wiki-economy/economy-map.svg\" download>SVG</a></figcaption></figure>\n        <figure><a href=\"/art/wiki-economy/fee-split.png\"><img src=\"/art/wiki-economy/fee-split.png\" width=\"1920\" height=\"1080\" loading=\"lazy\" decoding=\"async\" alt=\"The 4% protocol fee has five destinations; hook and LP fees are separate.\"></a><figcaption>Where trading fees go <a href=\"/art/wiki-economy/fee-split.svg\" download>SVG</a></figcaption></figure>\n        <figure><a href=\"/art/wiki-economy/deed-lifecycle.png\"><img src=\"/art/wiki-economy/deed-lifecycle.png\" width=\"1920\" height=\"1080\" loading=\"lazy\" decoding=\"async\" alt=\"Bloodline identity, character custody and equipped Deeds have separate ownership and death rules.\"></a><figcaption>The Deed lifecycle <a href=\"/art/wiki-economy/deed-lifecycle.svg\" download>SVG</a></figcaption></figure>\n        <figure><a href=\"/art/wiki-economy/stock-rewards.png\"><img src=\"/art/wiki-economy/stock-rewards.png\" width=\"1920\" height=\"1080\" loading=\"lazy\" decoding=\"async\" alt=\"New stocks require verified equipment, a living character, Broker activation and qualifying play.\"></a><figcaption>Qualifying for stocks <a href=\"/art/wiki-economy/stock-rewards.svg\" download>SVG</a></figcaption></figure>\n        <figure><a href=\"/art/wiki-economy/token-supply.png\"><img src=\"/art/wiki-economy/token-supply.png\" width=\"1920\" height=\"1080\" loading=\"lazy\" decoding=\"async\" alt=\"Fixed supply of 100 million OMR and 2,500 Deeds: 1,000 earned, 1,000 paid and 500 partnership.\"></a><figcaption>Token and property supply <a href=\"/art/wiki-economy/token-supply.svg\" download>SVG</a></figcaption></figure>\n        <figure><a href=\"/art/wiki-economy/technology-stack.png\"><img src=\"/art/wiki-economy/technology-stack.png\" width=\"1920\" height=\"1080\" loading=\"lazy\" decoding=\"async\" alt=\"Token and NFT standards connect authoritative gameplay to on-chain custody and settlement.\"></a><figcaption>Technology and ownership <a href=\"/art/wiki-economy/technology-stack.svg\" download>SVG</a></figcaption></figure>\n      </div>\n    </div>\n      <",
              "baseline": ""
            },
            {
              "at": 100788,
              "current": "Paid NFT minting remains unavailable until the matching contracts are deployed and verified. ",
              "baseline": ""
            }
          ]
        },
        "main": {
          "pin": {
            "mode": "100644",
            "blob": "5ed291081afb35338a55656fbf7664b4affaae9e",
            "sha256": "2c434d438d9f65e7cdaf27ba4d1526096757ad3a6a63dd8d4df5c6e1d202643b",
            "bytes": 250319
          },
          "inverses": [
            {
              "at": 38684,
              "current": "verified auction contract’s opening and closing blocks determine when bids are accepted. Check the published auction status for timing",
              "baseline": "target is around noon New York on Friday, October 9 through Wednesday, October 14, 2026. Verified native block boundaries determine the window; exact wall-clock timing is not guaranteed"
            },
            {
              "at": 48915,
              "current": "depends on the previous day’s returned inventory and the available shelf. Its daily float cap starts at 1% and can rise to 3% during a surge, with a 6,000 OMR minimum for the ca",
              "baseline": "is what came home yesterday, capped at 1% of all the $OMR in player hands so a big\n      spending day can't become a dum"
            },
            {
              "at": 49794,
              "current": "starts a new 48-hour surcharge window</b>. The extra withdrawal charge falls linearly from 50% at receipt to zero after 48 hours",
              "baseline": "is FRESH</b> — full early-exit toll for its first 48 hours, like any other"
            },
            {
              "at": 100276,
              "current": "Of the city’s 2,500 permanent properties, 1,000 are available through gameplay from level 25, 1,000 are reserved for paid minting and 500 for partnerships. Select a gameplay property on the district map, then inspect its site, verify the registry record, question its witness and return to secure its title. Each of the four objectives costs 5 energy and names its required district. Alternatively, follow <b>A House With a Past</b> in the quest journal, collecting evidence and committing to its story choices",
              "baseline": "The city has 1,000 gameplay Deeds, 1,000 paid-mint Deeds and 500 partnership Deeds. From level 25, select an available gameplay building on the district property map, then inspect its site, verify the registry record, question its witness and return to secure its title. Each of the four objectives costs 5 energy and names its required district. Alternatively, follow <b>A House With a Past</b> in the quest journal, collecting evidence and committing to its story choices. Each account has one lifetime gameplay claim. Operating benefits require level 25"
            },
            {
              "at": 101309,
              "current": "Once your current character reaches level 25, active streets you control can start earning the capped cash <b>corner take</b>. The same level requirement applies however you acquired the property",
              "baseline": "At level 8, collect the capped cash <b>corner take</b> from streets you control"
            },
            {
              "at": 102107,
              "current": ",actionId",
              "baseline": ""
            },
            {
              "at": 123963,
              "current": "Under the configured payment router, 50% of ETH package revenue goes to the developer, 25% to the Vig, 10% to Treasury and 15% to the community. Character mint payments go entirely to the developer",
              "baseline": "Revenue divides 40% founder / 40% buyback / 20%\n      treasury (the Vault's ETH)"
            },
            {
              "at": 124445,
              "current": "The Store quotes PLEX prices from the market rate, subject to each package’s price floor",
              "baseline": "Across the mission ladder, $OMR rewards sum to 1,320 and the daily bonus adds 3,\n      compared with 4,118 for the cheapest PLEX package"
            },
            {
              "at": 125603,
              "current": "requires launch approval and confirmed reserve capacity.</b> The Treasury board records an ETH allocation when you spend game OMR. The allocation stays on the game ledger. It sends no ETH to your walle",
              "baseline": "and backed ETH claims remain gated</b>; they become available only after production launch requirements clear and actual backing is presen"
            },
            {
              "at": 192064,
              "current": "gameplay qualification, optional deed upgrades",
              "baseline": "activity, activation"
            },
            {
              "at": 219356,
              "current": "receipts and allocations. Verifying the treasury’s actual wallet balance requires a separate on-chain check",
              "baseline": "funding and\n      allocations"
            },
            {
              "at": 221110,
              "current": "ithdrawals depend on reserve capacity.</b> The game checks its recorded reserve before signing a voucher for the net amount after withdrawal charges. Requests can queue. On-chain redemption also depends on the claim contract’s actual OMR balance and available capacity",
              "baseline": "hat you can take out is bounded by code, not by arithmetic.</b> The withdrawal rail signs nothing the\n        reserve cannot back, and the reserve is filled by real revenue — so \"you can only take out what somebody put\n        in\" is a rule the rail enforces on every withdrawal, whatever the supply does. That is the guarantee worth\n        having, and the one that holds even with the mission tap open"
            },
            {
              "at": 224367,
              "current": "qualifies the account for extraction after launch. Pay",
              "baseline": "makes a trial character permanent for"
            },
            {
              "at": 224747,
              "current": "ntract reserves the complete entitlement from existing inventory at purchase. Each offer has a fixed discount of at most 10% and a linear vest of 1 to 365 days",
              "baseline": "mplete payout is reserved from existing inventory at purchase"
            },
            {
              "at": 225140,
              "current": " The offer requires verified deployment, funding and activation.",
              "baseline": ""
            },
            {
              "at": 225397,
              "current": "",
              "baseline": " · GET /v1/bonds [public] · /bonds/:id/claim"
            }
          ]
        }
      }
    },
    "schema.sql": {
      "current": {
        "mode": "100755",
        "blob": "9795c322aed438cb3011bf16b83bc399af6200d5",
        "sha256": "9f272bef0d8a6ebb22d94654a7e3daa2f2e2c0f2fe94a3b429973c3923cca976",
        "bytes": 624168
      },
      "parents": {
        "economic": {
          "pin": {
            "mode": "100755",
            "blob": "92f7dec47d2b012437c9253d87ff796f68d29c18",
            "sha256": "019ecc952bc9ae81b99c2a1a2bb713af6ad1971fd0b803a564d54ca4115dbf1e",
            "bytes": 624018
          },
          "inverses": [
            {
              "at": 139698,
              "current": "-- The five-minute economy monitor reads a bounded recent window across all sources.\nCREATE INDEX IF NOT EXISTS ix_tx_at_id ON transactions (at, id);\n",
              "baseline": ""
            }
          ]
        },
        "main": {
          "pin": {
            "mode": "100755",
            "blob": "a0659f7908061802b87d1c40aa22d4de7e7632c5",
            "sha256": "d8131ea84e1eb6eb186ee42fa722ce13fd0b8b6dd1b056395037d471d09c7fda",
            "bytes": 624050
          },
          "inverses": [
            {
              "at": 51809,
              "current": "  revenue_split JSONB,                -- exact decimal ETH legs and receipt route; null for historical rows and comps\n",
              "baseline": ""
            }
          ]
        }
      }
    },
    "src/preflight.js": {
      "current": {
        "mode": "100644",
        "blob": "c010d97f5f83448b1325927be5ae073ad2618152",
        "sha256": "9ccc64d75626b8bdf832fa5d57e59aa6b297d365172e52faf4afccc22f7e919a",
        "bytes": 40253
      },
      "parents": {
        "economic": {
          "pin": {
            "mode": "100644",
            "blob": "ff4cac0d92091afa51fb31a5aa29e0769d9df19d",
            "sha256": "64b78df31d2c6df6cbeb4854be51c36ba72b8c9d7ba7c650325caf55d783e071",
            "bytes": 40051
          },
          "inverses": [
            {
              "at": 8250,
              "current": "  // Economic anomaly alert thresholds; the monitor validates positive finite values and defaults.\n  'ECONOMY_MONITOR_LEDGER_ROWS_WARN', 'ECONOMY_MONITOR_NET_CASH_WARN', 'ECONOMY_MONITOR_NET_OMR_WARN',\n",
              "baseline": ""
            }
          ]
        },
        "main": {
          "pin": {
            "mode": "100644",
            "blob": "3f020b59416c6edd9f63ac5753510377088105fa",
            "sha256": "ec03b2586d2a816b02a66a8128ca396ec4dae829fbeadb8557d29c364e892a80",
            "bytes": 40275
          },
          "inverses": [
            {
              "at": 10803,
              "current": "  'INVENTORY_BOND_MANIFEST_PATH', 'INVENTORY_BOND_MANIFEST_SHA256',\n",
              "baseline": ""
            },
            {
              "at": 17532,
              "current": "",
              "baseline": "REVENUE_BUYBACK_BPS', 'REVENUE_FOUNDER_BPS',\n  'REVENUE_RWA_BPS', '"
            },
            {
              "at": 17919,
              "current": "",
              "baseline": "TORE_COMMUNITY_BPS', 'S"
            }
          ]
        }
      }
    },
    "src/server.js": {
      "current": {
        "mode": "100644",
        "blob": "4aa9ddd44da5e62fade44750ae1c1e736fd035ac",
        "sha256": "7eb7025f871ca7b4d24a1d7a9c4c4a5414e747fa5bc087c117fc630cf3fb6ff5",
        "bytes": 307493
      },
      "parents": {
        "economic": {
          "pin": {
            "mode": "100644",
            "blob": "0dba5620f244faa9123f077291b2f0abf615cac8",
            "sha256": "0448712a4923d2d0c7b1b62e4ef1c15afa6017995bfce315f5f9b29210e1fb7e",
            "bytes": 304880
          },
          "inverses": [
            {
              "at": 5335,
              "current": "import { register as registerBusinessDesk } from './routes/businessdesk.js';\n",
              "baseline": ""
            },
            {
              "at": 45049,
              "current": "    ['business-control-desk.js', 'application/javascript'], ['business-control-desk.css', 'text/css'],\n",
              "baseline": ""
            },
            {
              "at": 53521,
              "current": ", cacheControl = 'public, max-age=604800, immutable'",
              "baseline": ""
            },
            {
              "at": 53751,
              "current": "hit.cacheControl || cacheControl",
              "baseline": "'public, max-age=604800, immutable'"
            },
            {
              "at": 55346,
              "current": "  // The wiki explainer uses stable public filenames. Allow only the finished reader-facing assets;\n  // generated source art and production metadata in neighbouring files never become public routes.\n  // Stream the diagrams too: their embedded art can make SVGs much larger than the root art plates.\n  const wikiEconomyDir = join(artDir, 'wiki-economy');\n  const wikiEconomyFiles = new Map();\n  const wikiDiagramIds = ['economy-map', 'fee-split', 'deed-lifecycle', 'stock-rewards', 'token-supply', 'technology-stack'];\n  const wikiEconomyTypes = new Map([\n    ...wikiDiagramIds.flatMap(id => ['', '-panel'].flatMap(suffix => [\n      [`${id}${suffix}.png`, 'image/png'], [`${id}${suffix}.svg`, 'image/svg+xml; charset=utf-8'],\n    ])),\n    ['omerta-wiki-economy-poster.jpg', 'image/jpeg'],\n    ['gallery.html', 'text/html; charset=utf-8'],\n    ['captions.vtt', 'text/vtt; charset=utf-8'],\n    ['transcript.md', 'text/plain; charset=utf-8'],\n  ]);\n  for (const [name, type] of wikiEconomyTypes) {\n    try {\n      const path = join(wikiEconomyDir, name), stat = statSync(path);\n      if (stat.isFile()) wikiEconomyFiles.set(name, { path, size: stat.size, type });\n    } catch { /* optional until the completed explainer ships */ }\n  }\n  const wikiMovieName = 'omerta-wiki-economy-1080p.mp4';\n  const wikiMovieKey = 'wiki-economy/' + wikiMovieName;\n  try {\n    const path = join(wikiEconomyDir, wikiMovieName), stat = statSync(path);\n    if (stat.isFile()) ART_VIDEOS.set(wikiMovieKey, { path, size: stat.size, type: 'video/mp4', cacheControl: 'no-cache' });\n  } catch { /* no film player until the completed export ships */ }\n  app.get('/art/wiki-economy/:file', async (req, reply) => {\n    const name = req.params.file;\n    if (name === wikiMovieName) return sendVideo(wikiMovieKey, req, reply, 'no-cache');\n    const hit = wikiEconomyFiles.get(name);\n    if (!hit) return reply.code(404).send({ error: 'not_found' });\n    if (hit.type.startsWith('text/html')) reply.header('Content-Security-Policy',\n      \"default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'; \"\n      + \"style-src 'unsafe-inline'; img-src 'self'; media-src 'self'\");\n    return reply.type(hit.type).header('cache-control', 'no-cache').header('content-length', String(hit.size))\n      .send(createReadStream(hit.path));\n  });\n",
              "baseline": ""
            },
            {
              "at": 193783,
              "current": "  registerBusinessDesk(app, { pool, auth });\n",
              "baseline": ""
            }
          ]
        },
        "main": {
          "pin": {
            "mode": "100644",
            "blob": "29f49b5fe55e976590ebd536bccdcf80c8e59462",
            "sha256": "10bdc7c9188178b2244cac50832f7c57413905577da678cc12a30bc95948d030",
            "bytes": 306370
          },
          "inverses": [
            {
              "at": 11530,
              "current": "import { loadInventoryBondCheckout, inventoryBondTransaction } from './inventorybond.js';\n",
              "baseline": ""
            },
            {
              "at": 48136,
              "current": "  app.get('/inventory-bond-client.js', reviewedModule('inventory-bond-client.js'));\n",
              "baseline": ""
            },
            {
              "at": 282630,
              "current": "const inventoryCheckout = loadInventoryBondCheckout();\n  app.get('/v1/bonds', { preHandler: auth }, async (req, reply) => {\n    reply.header('cache-control','no-store');\n    const { yours, isBacker, yourStanding, catalogs, oracle, reserve } = await Bonds.bondBoard(pool, req.user.sub);\n    return { yours, isBacker, yourStanding, catalogs, accounting: { oracle, reserve },\n      purchase: { verificationAvailable: Boolean(inventoryCheckout), deployment: inventoryCheckout?.manifest.contracts.bond ?? null },\n      note: 'Account records are historical. Request current purchase terms from POST /v1/bond/quote.' };\n  }",
              "baseline": "app.get('/v1/bonds', { preHandler: auth }, async (req) => Bonds.bondBoard(pool, req.user.sub)"
            },
            {
              "at": 283941,
              "current": "const bondPurchase = async (req, reply, prepare) => {\n    reply.header('cache-control', 'no-store');\n    if (!inventoryCheckout) return reply.code(503).send({ error: 'bond_unavailable',\n      message: 'Inventory bond purchases are awaiting verified deployment, activation and funding.' });\n    if (typeof req.body?.principalEth !== 'string') throw new G.GameError('bond_input', 'Enter the ETH amount as an exact decimal string.');\n    const wallet = (await pool.query('SELECT wallet_address FROM account_persistent WHERE account_id=$1',\n      [req.user.sub])).rows[0]?.wallet_address;\n    return inventoryBondTransaction(inventoryCheckout, wallet, req.body, { prepare });\n  };\n  app.post('/v1/bond/quote', { preHandler: auth }, async (req, reply) => bondPurchase(req, reply, false));\n  app.post('/v1/bond/calldata', { preHandler: auth }, async (req, reply) => bondPurchase(req, reply, tru",
              "baseline": "app.post('/v1/bond/quote', { preHandler: auth }, async (req) => Chain.quoteBond(pool, req.user.sub, req.body?.principalEth));\n  // server-encode the bond() submission so an injected browser wallet (MetaMask / Robinhood Wallet / etc.)\n  // can `eth_sendTransaction` it without the zero-dep client hand-rolling ABI (viem does it server-side).\n  app.post('/v1/bond/calldata', { preHandler: auth }, async (req) => Chain.bondCalldata(pool, req.user.sub, req.body?.nonc"
            }
          ]
        }
      }
    },
    "test/client.js": {
      "current": {
        "mode": "100644",
        "blob": "d76d33df1af070de1b94a21ba8c7a5a64e989fd6",
        "sha256": "96c1031bab954cf43cb3caf8834d2f3dae53f6ccc44cab590619ea1eb4c89cf1",
        "bytes": 763513
      },
      "parents": {
        "economic": {
          "pin": {
            "mode": "100644",
            "blob": "9ac4f48a71d559a64bd520aed4cf70f3c2ec1cd5",
            "sha256": "250b5003130d72494a43eeb4c977a14eee43e05ce9b50db3812d77b379ec7894",
            "bytes": 757517
          },
          "inverses": [
            {
              "at": 21139,
              "current": "const declaration = (re, label) => {\n    const lines = tour.split(/\\r?\\n/), start = lines.findIndex(line => re.test(line));\n    assert(start >= 0, `${label} is missing from the tour`);\n    for (let end = start; end < Math.min(lines.length, start + 100); end++) {\n      const source = lines.slice(start, end + 1).join('\\n');\n      try { new vm.Script(source); return source; } catch { /* wait for the complete declaration */ }\n    }\n    assert.fail(`${label} never parses as a complete browser declaration`);\n  };\n  const openSource = declaration(/^  function openTour\\(/, 'replay opener');\n  const closeSource = declaration(/^  const closeTour = /, 'tour close handler');\n  const fixture = ({ replay = true, connected = true, hidden = false, rects = true, visibility = 'visible', focusable = true, panel = {}, children = [], control = {} } = {}) => {\n    const focused = [], navigated = [], stored = {}, welcome = { hidden: false }, modal = { active: false };\n    welcome.classList = { add(name) { assert.equal(name, 'hidden'); welcome.hidden = true; }, remove(name) { assert.equal(name, 'hidden'); welcome.hidden = false; } };\n    const focus = name => options => { assert.equal(options.preventScroll, true); focused.push(name); };\n    const opener = { isConnected: connected, closest: () => hidden ? {} : null, getClientRects: () => rects ? [{}] : [], ...(focusable ? { focus: focus('opener') } : {}) };\n    const candidate = (name, options) => options === false ? null : {\n      isConnected: options.connected !== false, getClientRects: () => options.rects === false ? [] : [{}],\n      ...(options.focusable === false ? {} : { focus: focus(name) }),\n    };\n    const fallback = candidate('panel', panel), childControls = children.map((options, index) => candidate(`child-${index}`, options)), tabControl = candidate('tab-control', control);\n    let resolveNavigation, rejectNavigation, synced = false;\n    const context = vm.createContext({ tourReplay: false, tourReturnTab: null, tourReplayOpener: null, currentTab: 'market',\n      document: { activeElement: opener, querySelectorAll(selector) {\n        assert.equal(selector, '#tab-market button:not([disabled]), #tab-market [href], #tab-market input:not([disabled]), #tab-market select:not([disabled])');\n        return childControls;\n      } }, localStorage: { setItem(key, value) { stored[key] = value; } },\n      tourStep(step) { assert.equal(step, 0); }, syncStaticModal(node) { assert.equal(node, welcome); synced = true; },\n      topModal: () => modal.active ? {} : null, getComputedStyle: () => ({ visibility }),\n      $: selector => selector === '#welcome' ? welcome : selector === '#tab-market' ? fallback : selector === '#tab-control-market' ? tabControl : null,\n      setTab(tab) { navigated.push(tab); return new Promise((resolve, reject) => { resolveNavigation = resolve; rejectNavigation = reject; }); },\n    });\n    vm.runInContext(`${openSource}\\n${closeSource}\\nglobalThis.closeTour = closeTour;`, context);\n    if (replay) {\n      context.openTour();\n      assert.equal(context.tourReplay, true);\n      assert.equal(context.tourReturnTab, 'market', 'replay captures the interrupted screen');\n      assert.equal(context.tourReplayOpener, opener, 'replay captures the opener before modal focus moves');\n      assert.equal(welcome.hidden, false);\n    }\n    return { context, opener, focused, navigated, stored, welcome, modal, synced: () => synced,\n      settle(tab = 'market') { context.currentTab = tab; resolveNavigation(); }, fail() { rejectNavigation(new Error('navigation failed')); } };\n  };\n  {\n    const f = fixture(), closing = f.context.closeTour();\n    assert.deepEqual(f.navigated, ['market'], 'replay Close restores its interrupted screen');\n    assert.deepEqual(f.focused, [], 'held navigation cannot focus controls before their screen renders');\n    assert.equal(f.welcome.hidden, true); assert.equal(f.synced(), true);\n    assert.deepEqual(f.stored, { omerta_tour2: '1', omerta_welcomed: '1' });\n    f.context.tourReturnTab = 'scores'; f.context.tourReplayOpener = null;\n    f.settle(); await closing;\n    assert.deepEqual(f.focused, ['opener'], 'settled replay restores its captured, visible connected opener');\n  }\n  for (const options of [{ connected: false }, { hidden: true }, { rects: false }, { visibility: 'hidden' }, { focusable: false }]) {\n    const f = fixture(options), closing = f.context.closeTour();\n    assert.deepEqual(f.focused, [], 'an unusable opener cannot be focused during navigation');\n    f.settle(); await closing;\n    assert.deepEqual(f.focused, ['panel'], 'a stale or hidden opener falls back to the rendered current tab');\n  }\n  {\n    const f = fixture(), closing = f.context.closeTour();\n    f.opener.isConnected = false;\n    f.settle(); await closing;\n    assert.deepEqual(f.focused, ['panel'], 'an opener replaced during navigation cannot receive focus');\n  }\n  {\n    const f = fixture({ connected: false, panel: false }), closing = f.context.closeTour();\n    f.settle(); await closing;\n    assert.deepEqual(f.focused, ['tab-control'], 'the restored tab control is the fallback when its panel is absent');\n  }\n  for (const [options, expected] of [\n    [{ panel: {}, children: [{}] }, ['panel']],\n    [{ panel: { connected: false } }, ['tab-control']],\n    [{ panel: { rects: false } }, ['tab-control']],\n    [{ panel: { focusable: false } }, ['tab-control']],\n    [{ panel: false, children: [{}] }, ['child-0']],\n    [{ panel: { rects: false }, children: [{ connected: false }, { rects: false }, { focusable: false }, {}] }, ['child-3']],\n    [{ panel: false, children: [{ rects: false }], control: {} }, ['tab-control']],\n    [{ panel: { connected: false }, children: [{ rects: false }], control: { focusable: false } }, []],\n    [{ panel: false, control: false }, []],\n  ]) {\n    const f = fixture({ connected: false, ...options }), closing = f.context.closeTour();\n    assert.deepEqual(f.focused, [], 'fallback controls cannot receive focus before navigation settles');\n    f.settle(); await closing;\n    assert.deepEqual(f.focused, expected, 'fallback order is usable panel, then enabled usable children, then usable tab control; no eligible target means no focus');\n  }\n  for (const blocked of ['different-tab', 'active-modal', 'failed-navigation']) {\n    const f = fixture(), closing = f.context.closeTour();\n    if (blocked === 'failed-navigation') { f.fail(); await assert.rejects(closing, /navigation failed/); }\n    else { f.modal.active = blocked === 'active-modal'; f.settle(blocked === 'different-tab' ? 'scores' : 'market'); await closing; }\n    assert.deepEqual(f.focused, [], `${blocked} cannot return focus to an interrupted screen`);\n  }\n  for (const [replay, play] of [[false, false], [false, true], [true, true]]) {\n    const f = fixture({ replay });\n    await f.context.closeTour({ play });\n    assert.deepEqual(f.navigated, ['streets'], 'first-run Close and either Play hand off to Streets');\n    assert.deepEqual(f.focused, [], 'the play handoff leaves focus and gameplay to the real Streets controls');\n    f.settle('streets');\n  }",
              "baseline": "assert(/tourReturnTab\\s*=\\s*currentTab/.test(tour) && /setTab\\(tourReturnTab\\)/.test(tour),\n    'replay captures and restores the screen it interrupted');\n  assert(/tourReplayOpener\\s*=\\s*document\\.activeElement/.test(tour),\n    'replay captures its opener before the modal moves focus to Close');\n  assert(/tourReplayOpener\\?\\.isConnected[\\s\\S]*?tourReplayOpener\\.focus/.test(tour),\n    'replay Close restores focus to its connected opener');\n  assert(/#tab-\\$\\{tourReturnTab\\}[\\s\\S]*?#tab-control-\\$\\{tourReturnTab\\}/.test(tour),\n    'replay Close has a focusable restored-tab fallback when its opener disappeared');\n  assert(/const fallbackCandidates\\s*=\\s*\\[[\\s\\S]*?#tab-\\$\\{tourReturnTab\\}[\\s\\S]*?#tab-control-\\$\\{tourReturnTab\\}[\\s\\S]*?\\]/.test(tour),\n    'replay fallback gathers restored-tab candidates before its tab control last');\n  assert(/fallbackCandidates\\.find\\(\\(el\\)\\s*=>\\s*el\\?\\.isConnected\\s*&&\\s*el\\.getClientRects\\(\\)\\.length\\s*&&\\s*typeof el\\.focus === 'function'\\)/.test(tour),\n    'replay fallback skips disconnected, hidden, and unfocusable candidates');"
            }
          ]
        },
        "main": {
          "pin": {
            "mode": "100644",
            "blob": "dd27c8809894ed3f68545db1a334f46a64eb207b",
            "sha256": "b815589854b57a62565bec7a565a6b434d85e9d0e295c48fdab97b26dd46e54b",
            "bytes": 764649
          },
          "inverses": [
            {
              "at": 49122,
              "current": "  if (field === 'principalEth') {\n    assert.match(value, /^(?:0|[1-9]\\d*)(?:\\.\\d{1,18})?$/, 'inventory bond principal is an exact decimal ETH string');\n    assert.ok(/[1-9]/.test(value), 'inventory bond principal is positive');\n    continue;\n  }\n",
              "baseline": ""
            },
            {
              "at": 677673,
              "current": "const closedQuote = await inj8('POST','/v1/bond/quote',tC,{principalEth:'1'});\n  assert.equal(closedQuote.code,503);\n  assert.equal(closedQuote.body.error,'bond_unavailable'",
              "baseline": "// ── THE BOND QUOTE. The curated card renders its own panel through the silent api() and is NOT\n  // defective; the raw deck presses this same route through act() and read \"done.\" over a signed\n  // quote carrying a payout, a discount, a vest window and a deadline.\n  await app8.pool.query(\n    `INSERT INTO vig_buyback (id, eth_spent, omr_bought, price_omr_per_eth, to_reserve, to_prize, real, created_at)\n       VALUES ('w73-vb', 1, 3000, 3000, 0, 0, true, now())`);\n  await app8.pool.query('UPDATE bond_reserve SET capacity_omr = 1000000 WHERE id=1');\n  await app8.pool.query('INSERT INTO bond_offerings (day, offered_omr, quoted_omr) VALUES ($1, 500000, 0)',\n    [Math.floor(Date.now() / 86400000)]);\n  const bq = await driveC('/v1/bond/quote', tC, { principalEth: 1 }, 'the bond quote');\n  assert.equal(bq.r.body.bond, 'quote', 'WAVE 73 (chain): the quote must NAME its system');\n  assert.ok(bq.r.body.payoutOmr > 0 && bq.r.body.discountBps > 0 && bq.r.body.vestSeconds > 0 && bq.r.body.deadline > 0,\n    'WAVE 73 (chain): the quote must SEND the payout, the discount, the vest window and the deadline — none is derivable client-side');\n  assert.ok(bq.line.includes(fmtC(bq.r.body.payoutOmr)), `WAVE 73 (chain): the quote must name what it pays — got ${bq.line}`);\n  assert.ok(bq.line.includes(String(bq.r.body.discountBps / 100)), `WAVE 73 (chain): the quote must name the discount it was signed at — got ${bq.line}`);\n  assert.match(bq.line, /vesting over/, `WAVE 73 (chain): the quote must state that the payout vests — got ${bq.line}`"
            }
          ]
        }
      }
    },
    "test/economy-hardening-source-compatibility.js": {
      "current": {
        "mode": "100644",
        "blob": "0e4f444c2f8c4ebc4fbc50fc08138f2ba27f70dc",
        "sha256": "b57e9fe5c92c106313c70df700fac3d4ac23e5f97ef156bf50d0693f711aa4dd",
        "bytes": 89208
      },
      "parents": {
        "economic": {
          "pin": {
            "mode": "100644",
            "blob": "172a91b93c21de3ffabb05b422090ad25da7952c",
            "sha256": "ab7f074cfd609a09472184f13039807cea4a00904c81c3fa9caa69ca376c4023",
            "bytes": 88143
          },
          "inverses": [
            {
              "at": 0,
              "current": "import { wikiMediaHistoricalInput } from '../tools/wiki-media-source-transfer.js';\nimport { age21HistoricalInput } from '../tools/age21-source-transfer.js';\n",
              "baseline": ""
            },
            {
              "at": 250,
              "current": "import { economyDeedMergeHistoricalInput } from '../tools/economy-deed-merge-source-compatibility.js';\n",
              "baseline": ""
            },
            {
              "at": 394,
              "current": "import { integratedEconomicParentInput } from '../tools/integrated-economic-parent-source.js';\nimport './economy-monitor-source-compatibility.js';\nimport './age-eligibility-source-compatibility.js';\n",
              "baseline": ""
            },
            {
              "at": 704,
              "current": "import { economyMonitorHistoricalInput } from '../tools/economy-monitor-source-transfer.js';\n",
              "baseline": ""
            },
            {
              "at": 4196,
              "current": "",
              "baseline": "import { currentEconomicTermsBaseline } from '../tools/current-economic-terms-source-transfer.js';\n"
            },
            {
              "at": 4793,
              "current": ", economyMonitorWorkerHistoricalInput,\n  economyMonitorReaderHistoricalInput, economyMonitorReleaseHistoricalInput",
              "baseline": ""
            },
            {
              "at": 10713,
              "current": "deedAllocationPhysicalSource = file => age21HistoricalInput(file, wikiMediaHistoricalInput(file, deedAllocationHistoricalInput(file,\n  economyDeedMergeHistoricalInput(file, integratedEconomicParentInput(file, fs.readFileSync(file, 'utf8'), 'main'), 'monitor'))));\nconst monitorPhysicalSource = file => {\n  let input = deedAllocationPhysicalSource(file);\n  input = uxAfterwordHistoricalInput(file, input);\n  input = economyMonitorWorkerHistoricalInput(file, input);\n  input = economyMonitorReaderHistoricalInput(file, input);\n  input = economyMonitorReleaseHistoricalInput(file, input);\n  return economyMonitorHistoricalInput(file, input);\n}",
              "baseline": "reviewedPhysicalSource = file => currentEconomicTermsBaseline(file,\n  deedAllocationHistoricalInput(file, fs.readFileSync(file, 'utf8')))"
            },
            {
              "at": 11479,
              "current": "monitor",
              "baseline": "reviewed"
            },
            {
              "at": 25300,
              "current": "monitor",
              "baseline": "reviewed"
            },
            {
              "at": 31025,
              "current": "monitor",
              "baseline": "reviewed"
            },
            {
              "at": 37333,
              "current": "monitor",
              "baseline": "reviewed"
            },
            {
              "at": 42731,
              "current": "monitor",
              "baseline": "reviewed"
            }
          ]
        },
        "main": {
          "pin": {
            "mode": "100644",
            "blob": "de5f301ba2aad9de49c8dc19e96117f2b44880f7",
            "sha256": "bef78954f780703a11723ca9cac45cd4d6bff9a7b2996d1eb9919b84d24b13dd",
            "bytes": 89075
          },
          "inverses": [
            {
              "at": 394,
              "current": "import { integratedEconomicParentInput } from '../tools/integrated-economic-parent-source.js';\n",
              "baseline": ""
            },
            {
              "at": 10886,
              "current": "integratedEconomicParentInput(file, fs.readFileSync(file, 'utf8'), 'main",
              "baseline": "fs.readFileSync(file, 'utf8"
            },
            {
              "at": 11479,
              "current": "monitor",
              "baseline": "deedAllocation"
            }
          ]
        }
      }
    },
    "test/gates.js": {
      "current": {
        "mode": "100644",
        "blob": "8a3170caa9f8274320e48fb1f8b5d6eb236cdc4a",
        "sha256": "c895928b8bae367cdf5deeab34bfb4fc8468f23ec92510577a40a2556d95697e",
        "bytes": 462256
      },
      "parents": {
        "economic": {
          "pin": {
            "mode": "100644",
            "blob": "fe95ef10b9a17f81e4852c96c64253b9a768f954",
            "sha256": "47a484c6c419e7606cac33bfb4bbaa0e7906d2604090d0940b356c61280282df",
            "bytes": 461839
          },
          "inverses": [
            {
              "at": 335157,
              "current": "    'test/economy-composition-restart.js': 'Fresh-process child probe executed by the required native economy-composition suite; it requires an owned disposable PostgreSQL schema and bounded synthetic stdin, so it cannot run standalone.',\n",
              "baseline": ""
            },
            {
              "at": 378922,
              "current": "    '      - name: Business desk desktop and phone trade, recovery and account boundaries',\n    '        run: npm run test:business-desk:browser',\n",
              "baseline": ""
            },
            {
              "at": 385088,
              "current": "business-desk:postgres', 'test:",
              "baseline": ""
            }
          ]
        },
        "main": {
          "pin": {
            "mode": "100644",
            "blob": "32efa3f2b7b6162558c097d97a656bcc1382dce4",
            "sha256": "6e7cb10cd85f776bc814dca12e68b70ccebe3b5bba4a0ea39b3ba2c9aa58814a",
            "bytes": 461878
          },
          "inverses": [
            {
              "at": 112277,
              "current": "    { file: 'src/inventorybond.js', mark: '[bond, marketState, omr, manager].map(async pin',\n      why: 'four pinned runtime-code RPC reads; no database connection or transaction' },\n    { file: 'src/inventorybond.js', mark: \"read(bond,'availableInventory')\",\n      why: 'fixed on-chain eligibility, inventory and collateral reads at one canonical block; no database client' },\n",
              "baseline": ""
            }
          ]
        }
      }
    },
    "test/lib/enterprise-ux-native-guard.js": {
      "current": {
        "mode": "100644",
        "blob": "4f11c4abe81d579ee8e90b819469e7e69d41b594",
        "sha256": "aa5dbd7d1c991c79b9e9234e18143ad43fc2a70289ce8a0415a4dcd60841b52a",
        "bytes": 25651
      },
      "parents": {
        "economic": {
          "pin": {
            "mode": "100644",
            "blob": "ce0f7326ef43de3c7d3042fa148c9d760b3d234c",
            "sha256": "1ecf820ac012655c9e358ba4946c810815a8d0cce3f4731e559fcb7e0ffc2e36",
            "bytes": 17357
          },
          "inverses": [
            {
              "at": 0,
              "current": "import { BUSINESS_DESK_COMBINED_NATIVE_PARENTS } from '../../tools/businessdesk-combined-native-parents.js';\nimport { ENTERPRISE_NATIVE_UX_INPUTS as ORIGINAL_B35_NATIVE_INPUTS } from '../../tools/enterprise-native-ux-b35-inputs.js';\n",
              "baseline": ""
            },
            {
              "at": 539,
              "current": "Source as combinedEconomicDeedPin } from '../../tools/combined-economic-deed-source-data.js';\nimport { ENTERPRISE_NATIVE_UX_INPUTS as economicParent } from '../../tools/enterprise-native-economic-inputs.js';\nimport { assertReviewedNativePin } from '../../tools/economic-release-native-provenance.js';\nimport { WIKI_MEDIA_MERGE_SOURCE, WIKI_MEDIA_MERGE_SOURCE_SHA256,\n WIKI_MEDIA_NOIR_MERGE_SOURCE, WIKI_MEDIA_NOIR_MERGE_SOURCE_SHA256 } from '../../tools/wiki-media-source-data.js';\nimport { NOIR_UI_SOURCE_SHA256 } from '../../tools/noir-ui-source-data",
              "baseline": "Pin } from '../../tools/combined-economic-deed-source-transfer"
            },
            {
              "at": 2735,
              "current": " const economySupport = ['.github/workflows/economy-hardening.yml',\n  'tools/generate-economy-monitor-source-transfer.js', 'test/economy-monitor-source-compatibility.js',\n  'test/economy-monitor.js', 'test/economy-composition.js', 'test/economy-composition-restart.js',\n  'tools/generate-age-eligibility-source-transfer.js', 'test/age-eligibility-source-compatibility.js',\n  'test/age.js', 'test/legal-security.js', 'tools/economy-deed-merge-source-data.js',\n  'tools/economy-deed-merge-source-compatibility.js', 'tools/generate-economy-deed-merge-source.js',\n  'test/economy-deed-merge-source-compatibility.js', 'tools/noir-ui-source-data.js',\n  'tools/noir-ui-source-transfer.js', 'tools/generate-noir-ui-source-transfer.js',\n  'test/noir-ui-source-compatibility.js', 'test/ux-expanded-browser.js', 'test/launch-invites-browser.js', 'test/wallet-connect-browser.js',\n  'tools/mobile.js', 'tools/public-ui.js'];\n for (const file of economySupport)\n  assert(ENTERPRISE_UX_SUPPORT.includes(file), 'Current monitoring and merged-source proofs remain in the native closure: ' + file);\n",
              "baseline": ""
            },
            {
              "at": 8791,
              "current": "7); assert.equal(pin.phase, 'ACTUAL_ENTERPRISE_ECONOMIC_BUSINESS_DESK_NATIVE_INPUTS');\n  assert.equal(pin.wikiMergeSourceDefinitionSha256, WIKI_MEDIA_MERGE_SOURCE_SHA256);\n  assert.equal(pin.noirSourceDefinitionSha256, NOIR_UI_SOURCE_SHA256);\n  assert.equal(pin.noirMergeSourceDefinitionSha256, WIKI_MEDIA_NOIR_MERGE_SOURCE_SHA256",
              "baseline": "4); assert.equal(pin.phase, 'ACTUAL_ENTERPRISE_ECONOMIC_DEED_NATIVE_INPUTS'"
            },
            {
              "at": 9777,
              "current": "release-",
              "baseline": ""
            },
            {
              "at": 10291,
              "current": "  for (const file of ['tools/noir-ui-source-data.js', 'tools/noir-ui-source-transfer.js']) {\n   assert(pin.files.some(row => row.file === file), 'The actual noir source dependency is in the closed native capture: ' + file);\n  }\n",
              "baseline": ""
            },
            {
              "at": 12326,
              "current": "ORIGINAL_B35_NATIVE_INPUTS.files.some(before => before.file === row.file && before.mode === row.mode && before.blob === row.blob && before.sha256 === row.sha256)); assert(unchanged, 'A real independently pinned unchanged native input is mandatory');\n  const unchangedOriginal = ORIGINAL_B35_NATIVE_INPUTS.files.find(row => row.file === unchanged.file);\n  assert.deepEqual(unchanged, unchangedOriginal",
              "baseline": "row.file === '.github/workflows/ci.yml'); assert(unchanged"
            },
            {
              "at": 12900,
              "current": "  assert.equal(digest(unchangedBytes), unchangedOriginal.sha256);\n  assert.equal(crypto.createHash('sha1').update('blob ' + unchangedBytes.length + '\\0').update(unchangedBytes).digest('hex'), unchangedOriginal.blob);\n",
              "baseline": ""
            },
            {
              "at": 13594,
              "current": "admission = assertEnterpriseUxTrackedInput(file, record, record, bytes);\n   const transition = admission.economicProvenance ?? admission;\n   const historical = economicParent.files.find(row => row.file === file);\n   assert.deepEqual(transition.current, historical);\n   assert.equal(admission.current.blob, actual.blob",
              "baseline": "transition = assertEnterpriseUxTrackedInput(file, record, record, bytes"
            },
            {
              "at": 14167,
              "current": "historical.blob, 'The combined source differs from the Deed input');\n   const prior = git('show', transition.predecessorRevision + ':' + file);\n   if (!prior.equals(bytes)) reject(() => assertEnterpriseUxTrackedInput(file, record, record, prior));\n   reject(() => assertEnterpriseUxTrackedInput(file, record, record, Buffer.concat([bytes, Buffer.from('\\n')])));\n  }\n  const pointer = pin.files.find(row => row.file === 'tools/economic-release-native-source.js');\n  for (const row of [pointer, pin.files.find(row => row.file === 'src/server.js')]) {\n   assertReviewedNativePin(row);\n   reject(() => assertReviewedNativePin({...row, blob:'0'.repeat(40)}));\n   reject(() => assertReviewedNativePin({...row, mode:'120000'}",
              "baseline": "actual.blob, 'The combined source differs from the Deed input');\n   reject(() => assertEnterpriseUxTrackedInput(file, record, record, git('show', transition.predecessorRevision + ':' + file)"
            },
            {
              "at": 14893,
              "current": "  reject(() => assertReviewedNativePin({...pointer, sha256:'0'.repeat(64)}));\n",
              "baseline": ""
            },
            {
              "at": 15729,
              "current": "  const monitored = pin.files.find(row => row.file === 'src/game.js'); assert(monitored);\n  const monitorBytes = git('show', pin.authoredRevision + ':' + monitored.file);\n  const monitorRecord = { type: 'blob', mode: monitored.mode, blob: monitored.blob };\n  const monitorProvenance = assertEnterpriseUxTrackedInput(monitored.file, monitorRecord, monitorRecord, monitorBytes);\n  assert.equal((monitorProvenance.deskProvenance ?? monitorProvenance).relation, 'exact-reviewed-monitor-wiki-desk-native-pin-provenance-only');\n  assert.equal(monitorProvenance.nativeAdmission, false); assert.equal(monitorProvenance.priorResultsTransferred, false);\n  assert.equal(monitorProvenance.current.sha256, digest(monitorBytes));\n  for (const parent of ['c771f5ba73453a57e24e31f8eeb920933fe7544c', '4e5f7fdb1cc4d2055ac613d2d4cb562a8007c364']) {\n   const parentBytes = git('show', parent + ':' + monitored.file);\n   const parentBlob = crypto.createHash('sha1').update('blob ' + parentBytes.length + '\\0').update(parentBytes).digest('hex');\n   assert.notEqual(parentBlob, monitored.blob, 'Each reviewed parent lacks part of the actual monitored game source');\n   const parentRecord = { type: 'blob', mode: monitored.mode, blob: parentBlob };\n   reject(() => assertEnterpriseUxTrackedInput(monitored.file, parentRecord, parentRecord, parentBytes));\n  }\n  const merged = pin.files.find(row => row.file === 'src/server.js'); assert(merged);\n  const mergedRow = WIKI_MEDIA_MERGE_SOURCE.files[merged.file]; assert(mergedRow);\n  const mergedBytes = git('show', pin.authoredRevision + ':' + merged.file);\n  const mergedRecord = { type: 'blob', mode: merged.mode, blob: merged.blob };\n  const mergedProvenance = assertEnterpriseUxTrackedInput(merged.file, mergedRecord, mergedRecord, mergedBytes);\n  assert.equal(mergedProvenance.current.blob, merged.blob);\n  const wikiServerPath = BUSINESS_DESK_COMBINED_NATIVE_PARENTS.parentPaths.wiki.find(row => row.file === merged.file); assert(wikiServerPath);\n  const wikiServerEdge = wikiServerPath.edges.find(edge => edge.kind === 'wiki-merge'); assert(wikiServerEdge);\n  assert.equal(wikiServerEdge.to.blob, mergedRow.main.lf.blob);\n  assert.equal(BUSINESS_DESK_COMBINED_NATIVE_PARENTS.catalogs.wikiMerge.definitionSha256, WIKI_MEDIA_MERGE_SOURCE_SHA256);\n  assert.equal(mergedProvenance.nativeAdmission, false); assert.equal(mergedProvenance.priorResultsTransferred, false);\n  const mainBytes = git('show', WIKI_MEDIA_MERGE_SOURCE.parents.main.revision + ':' + merged.file);\n  const mainRecord = { type: 'blob', mode: mergedRow.main.mode, blob: mergedRow.main.lf.blob };\n  reject(() => assertEnterpriseUxTrackedInput(merged.file, mainRecord, mainRecord, mainBytes),\n    'Even an exact admitted main parent cannot replace the actual merged native input');\n  reject(() => assertEnterpriseUxTrackedInput(merged.file, mergedRecord, mergedRecord, Buffer.concat([mergedBytes, Buffer.from('\\n')])));\n  const noir = pin.files.find(row => row.file === 'public/index.html'); assert(noir);\n  const noirRow = WIKI_MEDIA_NOIR_MERGE_SOURCE.files[noir.file]; assert(noirRow);\n  const noirBytes = git('show', pin.authoredRevision + ':' + noir.file);\n  const noirRecord = { type: 'blob', mode: noir.mode, blob: noir.blob };\n  const noirProvenance = assertEnterpriseUxTrackedInput(noir.file, noirRecord, noirRecord, noirBytes);\n  assert.equal(noirProvenance.current.blob, noir.blob);\n  const wikiIndexPath = BUSINESS_DESK_COMBINED_NATIVE_PARENTS.parentPaths.wiki.find(row => row.file === noir.file); assert(wikiIndexPath);\n  const wikiIndexEdge = wikiIndexPath.edges.find(edge => edge.kind === 'wiki-noir-merge'); assert(wikiIndexEdge);\n  assert.equal(wikiIndexEdge.to.blob, noirRow.wiki.lf.blob);\n  assert.equal(BUSINESS_DESK_COMBINED_NATIVE_PARENTS.catalogs.wikiNoir.definitionSha256, WIKI_MEDIA_NOIR_MERGE_SOURCE_SHA256);\n  assert.equal((noirProvenance.deskProvenance ?? noirProvenance).relation, 'exact-reviewed-monitor-wiki-desk-native-pin-provenance-only');\n  assert.equal(noirProvenance.nativeAdmission, false); assert.equal(noirProvenance.priorResultsTransferred, false);\n  const wikiBytes = git('show', WIKI_MEDIA_NOIR_MERGE_SOURCE.parents.wiki.revision + ':' + noir.file);\n  const wikiRecord = { type: 'blob', mode: noirRow.wiki.mode, blob: noirRow.wiki.lf.blob };\n  reject(() => assertEnterpriseUxTrackedInput(noir.file, wikiRecord, wikiRecord, wikiBytes),\n    'An exact admitted wiki parent cannot replace actual noir/merged native source');\n  reject(() => assertEnterpriseUxTrackedInput(noir.file, noirRecord, noirRecord, Buffer.concat([noirBytes, Buffer.from('\\n')])));\n",
              "baseline": ""
            }
          ]
        },
        "main": {
          "pin": {
            "mode": "100644",
            "blob": "f4a6c3232a9332b0803d13926b6ac54026f34776",
            "sha256": "189fba3ce57bae50e2365d953a32781856c063b27e10267586d76e04fe30e8a1",
            "bytes": 22457
          },
          "inverses": [
            {
              "at": 510,
              "current": "import { combinedEconomicDeedSource as combinedEconomicDeedPin } from '../../tools/combined-economic-deed-source-data.js';\nimport { ENTERPRISE_NATIVE_UX_INPUTS as economicParent } from '../../tools/enterprise-native-economic-inputs.js';\nimport { assertReviewedNativePin } from '../../tools/economic-release-native-provenance.js';\n",
              "baseline": ""
            },
            {
              "at": 2055,
              "current": " const nativeEntry = 'tools/enterprise-native.js';\n assert.equal(JSON.parse(fs.readFileSync('package.json', 'utf8')).scripts['test:agent-economy-enterprise:postgres'], 'node ' + nativeEntry);\n for (const profile of ['ci', 'local']) {\n  for (const key of ['INVENTORY_BOND_MANIFEST_PATH', 'inventory_bond_manifest_sha256']) {\n   assert.throws(() => execFileSync(process.execPath, [nativeEntry], {\n    env: { ...process.env, ENTERPRISE_NATIVE_PROFILE: profile, [key]: 'forbidden' }, stdio: 'pipe', windowsHide: true,\n   }), error => error.status === 1 && String(error.stderr).includes('Inventory bond manifest forbidden during native qualification: ' + key));\n   negatives++;\n  }\n }\n",
              "baseline": ""
            },
            {
              "at": 8791,
              "current": "7); assert.equal(pin.phase, 'ACTUAL_ENTERPRISE_ECONOMIC_BUSINESS",
              "baseline": "6); assert.equal(pin.phase, 'ACTUAL_ENTERPRISE_MONITOR_WIKI"
            },
            {
              "at": 9704,
              "current": "  assert.equal(ENTERPRISE_UX_METADATA, 'tools/enterprise-native-economic-release-inputs.js', 'Only the fresh successor manifest is self-referential');\n  for (const file of ['tools/enterprise-native-deed-inputs.js', 'public/inventory-bond-client.js', 'src/inventorybond.js',\n   'test/inventory-bond-checkout.js', 'test/economy-ux-merge-source-compatibility.js',\n   'tools/generate-current-economic-terms-source-transfer.js', 'tools/generate-combined-economic-deed-source-transfer.js']) {\n   assert(pin.files.some(row => row.file === file), 'Missing current native support: ' + file);\n  }\n",
              "baseline": ""
            },
            {
              "at": 10519,
              "current": "",
              "baseline": "  assert.equal(ENTERPRISE_UX_METADATA, 'tools/enterprise-native-deed-inputs.js', 'Only the fresh successor manifest is self-referential');\n"
            },
            {
              "at": 13313,
              "current": "  for (const file of Object.keys(combinedEconomicDeedPin.nativeFiles)) {\n   const actual = pin.files.find(row => row.file === file);\n   const record = { type: 'blob', mode: actual.mode, blob: actual.blob };\n   const bytes = git('show', pin.authoredRevision + ':' + file);\n   const admission = assertEnterpriseUxTrackedInput(file, record, record, bytes);\n   const transition = admission.economicProvenance ?? admission;\n   const historical = economicParent.files.find(row => row.file === file);\n   assert.deepEqual(transition.current, historical);\n   assert.equal(admission.current.blob, actual.blob);\n   assert.equal(transition.relation, 'exact-reviewed-economic-deed-source-provenance-only');\n   assert.equal(transition.nativeAdmission, false);\n   assert.equal(transition.priorResultsTransferred, false);\n   assert.notEqual(transition.predecessor.blob, historical.blob, 'The combined source differs from the Deed input');\n   const prior = git('show', transition.predecessorRevision + ':' + file);\n   if (!prior.equals(bytes)) reject(() => assertEnterpriseUxTrackedInput(file, record, record, prior));\n   reject(() => assertEnterpriseUxTrackedInput(file, record, record, Buffer.concat([bytes, Buffer.from('\\n')])));\n  }\n  const pointer = pin.files.find(row => row.file === 'tools/economic-release-native-source.js');\n  for (const row of [pointer, pin.files.find(row => row.file === 'src/server.js')]) {\n   assertReviewedNativePin(row);\n   reject(() => assertReviewedNativePin({...row, blob:'0'.repeat(40)}));\n   reject(() => assertReviewedNativePin({...row, mode:'120000'}));\n  }\n  reject(() => assertReviewedNativePin({...pointer, sha256:'0'.repeat(64)}));\n",
              "baseline": ""
            },
            {
              "at": 16121,
              "current": "(monitorProvenance.deskProvenance ?? monitorProvenance)",
              "baseline": "monitorProvenance"
            },
            {
              "at": 19572,
              "current": "(noirProvenance.deskProvenance ?? noirProvenance)",
              "baseline": "noirProvenance"
            }
          ]
        }
      }
    },
    "test/sale-source-compatibility.js": {
      "current": {
        "mode": "100644",
        "blob": "13b93df8ba1974397c9c249582d347778acacab2",
        "sha256": "347c2e006c1963e70cdf99ca7bc3483432a8f08422edd563c71e989f72f7d0ed",
        "bytes": 17589
      },
      "parents": {
        "economic": {
          "pin": {
            "mode": "100644",
            "blob": "22f1d430cbfba314aab830a33219825d56819645",
            "sha256": "525e737bad922ba0a982b3f6b5dd88867392f0c040e7014d250f4ebcd932bfc2",
            "bytes": 10491
          },
          "inverses": [
            {
              "at": 129,
              "current": "import { integratedEconomicParentInput } from '../tools/integrated-economic-parent-source.js';\n",
              "baseline": ""
            },
            {
              "at": 813,
              "current": "",
              "baseline": "import { currentEconomicTermsBaseline } from '../tools/current-economic-terms-source-transfer.js';\n"
            },
            {
              "at": 930,
              "current": "import { economyMonitorHistoricalInput } from '../tools/economy-monitor-source-transfer.js';\nimport { ageEligibilityHistoricalInput } from '../tools/age-eligibility-source-transfer.js';\n",
              "baseline": ""
            },
            {
              "at": 1298,
              "current": "import { economyDeedMergeHistoricalInput } from '../tools/economy-deed-merge-source-compatibility.js';\n",
              "baseline": ""
            },
            {
              "at": 2747,
              "current": "const currentSaleSource = (file, input) => {\n  input = integratedEconomicParentInput(file, input, 'main');\n  input = economyDeedMergeHistoricalInput(file, input, 'monitor');\n  input = deedAllocationHistoricalInput(file, input);\n  input = uxAfterwordHistoricalInput(file, input);\n  input = ageEligibilityHistoricalInput(file, input);\n  input = economyMonitorHistoricalInput(file, input);\n  return economySocialProofCutoverHistoricalInput(file, input);\n};\n",
              "baseline": ""
            },
            {
              "at": 3361,
              "current": "physical = currentSaleSource(row.file, fs.readFileSync(row.file, 'utf8'));\n  const committed = currentSaleSource(row.file, ",
              "baseline": "historical = raw => economySocialProofCutoverHistoricalInput(row.file,\n    uxAfterwordHistoricalInput(row.file, currentEconomicTermsBaseline(row.file, deedAllocationHistoricalInput(row.file, raw))));\n  const physical = historical(fs.readFileSync(row.file, 'utf8'));\n  const committed = historical("
            },
            {
              "at": 9097,
              "current": "// The dual-parent definition first proves the complete physical integration reader and reconstructs\n// its monitor parent. Retain that parent's independently pinned correction-reader conservation\n// proof below; neither reconstruction executes historical source or admits native bytes.\nconst correctionFile = 'tools/economy-ux-merge-source-compatibility.js';\nconst correctionPhysical = economyDeedMergeHistoricalInput(correctionFile, fs.readFileSync(correctionFile, 'utf8'), 'monitor');\nlet candidateConserved = correctionPhysical.replaceAll('\\r\\n', '\\n');\nconst correctionRevision = '77882cdfc2e54f94602065c58132b9da913b5427';\nconst correctionPredecessor = '6fdc897851ef23e8c2cf691733ad944a7663242a';\nconst correctionCurrent = Object.freeze({ sha256: 'bae09cba0a3833d53b1f29db1c8462513924eb3e9f0b6373544b9c94304e4aea',\n  blob: 'f14f8b5aee26da0062e5b9be1b8d129df7852a41', bytes: 46593 });\nconst correctionBaseline = Object.freeze({ sha256: 'ca6fd1a86117cf5caf77e43a3518471fc2e804d000de34ee325ceb1c316bb94e',\n  blob: '14e2b55c534ce79715e7916a17891a6c449df0fe', bytes: 7769 });\nconst correctionInverses = Object.freeze(inverseHunks(git('diff', '--no-ext-diff', '--unified=3',\n  correctionPredecessor, correctionRevision, '--', correctionFile)).map(Object.freeze));\nconst correctionBlob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\\0').update(text).digest('hex');\ngit('merge-base', '--is-ancestor', correctionPredecessor, correctionRevision);\ngit('merge-base', '--is-ancestor', correctionRevision, 'HEAD');\nassert.equal(git('show', correctionRevision + ':' + correctionFile), candidateConserved);\nconst correctionStat = fs.lstatSync(correctionFile); assert(correctionStat.isFile() && !correctionStat.isSymbolicLink());\nfor (const [revision, record] of [[correctionRevision, correctionCurrent], [correctionPredecessor, correctionBaseline]])\n  assert.equal(git('ls-tree', revision, '--', correctionFile).trim(), '100644 blob ' + record.blob + '\\t' + correctionFile);\nassert(correctionInverses.length > 0);\nconst restoreCorrectionReader = input => {\n  assert.equal(typeof input, 'string');\n  assert.equal(Buffer.from(input).toString('utf8'), input);\n  assert(!input.startsWith('\\ufeff') && !input.includes('\\0'));\n  const current = input.replaceAll('\\r\\n', '\\n');\n  assert(!current.includes('\\r') && (input === current || input === current.replaceAll('\\n', '\\r\\n')));\n  assert.equal(sha(current), correctionCurrent.sha256); assert.equal(correctionBlob(current), correctionCurrent.blob);\n  assert.equal(Buffer.byteLength(current), correctionCurrent.bytes);\n  let restored = current, end = -1;\n  for (const inverse of correctionInverses) {\n    assert.deepEqual(Object.keys(inverse).sort(), ['baseline', 'current']);\n    assert(inverse.current.length); assert.equal(current.split(inverse.current).length, 2);\n    const at = current.indexOf(inverse.current); assert(at >= end); end = at + inverse.current.length;\n    assert.equal(restored.split(inverse.current).length, 2); restored = restored.replace(inverse.current, () => inverse.baseline);\n  }\n  assert.equal(sha(restored), correctionBaseline.sha256); assert.equal(correctionBlob(restored), correctionBaseline.blob);\n  assert.equal(Buffer.byteLength(restored), correctionBaseline.bytes);\n  assert.equal(restored, git('show', correctionPredecessor + ':' + correctionFile));\n  return restored;\n};\nlet correctionRefusals = 0;\nfor (const current of [candidateConserved, candidateConserved.replaceAll('\\n', '\\r\\n')])\n  assert.equal(restoreCorrectionReader(current), git('show', correctionPredecessor + ':' + correctionFile));\nfor (const changed of [candidateConserved + '\\n// drift\\n', candidateConserved.slice(1), '\\ufeff' + candidateConserved,\n  candidateConserved + '\\0', candidateConserved.replace('\\n', '\\r\\n'), candidateConserved.replace('\\n', '\\r'),\n  Buffer.from(candidateConserved), Buffer.from([0xc3, 0x28]), null]) {\n  assert.throws(() => restoreCorrectionReader(changed)); correctionRefusals++;\n}\nfor (const inverse of correctionInverses) for (const changed of [\n  candidateConserved.replace(inverse.current, ''),\n  candidateConserved.replace(inverse.current, inverse.current + inverse.current),\n  candidateConserved.replace(inverse.current, inverse.baseline),\n  candidateConserved.replace(inverse.current, inverse.current.replace(/\\S/, char => char === '?' ? '!' : '?')),\n]) { assert.throws(() => restoreCorrectionReader(changed)); correctionRefusals++; }\ncandidateConserved = restoreCorrectionReader(correctionPhysical);\nconsole.log(JSON.stringify({ phase: 'EXACT_ECONOMY_MONITOR_CORRECTION_READER_SOURCE_ONLY', source: correctionRevision,\n  predecessor: correctionPredecessor, files: 1, inverseHunks: correctionInverses.length, positives: 2,\n  refusals: correctionRefusals, sourceOnly: true, native: false, runtime: false }));\nfor (const [hook, count] of [[\"import { saleHistoricalInput } from './sale-source-compatibility.js';\\n\", 1], ['  input = saleHistoricalInput(file, input);\\n', 2],\n  [\"import { economyMonitorHistoricalInput } from './economy-monitor-source-transfer.js';\\n\", 1],\n  ['  input = economyMonitorHistoricalInput(file, input);\\n', 2],\n  [\"import { ageEligibilityHistoricalInput } from './age-eligibility-source-transfer.js';\\n\", 1],\n  ['  input = ageEligibilityHistoricalInput(file, input);\\n', 2],\n  [\"import { economyBankInterestHardeningHistoricalInput } from './economy-bank-interest-source-transfer.js';\\n\", 1],\n  ['  input = economyBankInterestHardeningHistoricalInput(file, input);\\n', 2],\n  [\"import { economySocialProofCutoverHistoricalInput } from './economy-social-proof-cutover-source-transfer.js';\\n\", 1],\n  ['  input = economySocialProofCutoverHistoricalInput(file, input);\\n', 2],\n  [\"import { economySocialReceiptSafetyHistoricalInput } from './economy-social-proof-receipt-safety-source-transfer.js';\\n\", 1],\n  ['  input = economySocialReceiptSafetyHistoricalInput(file, input);\\n', 2],\n  [\"import { economySocialReceiptHistoricalInput } from './economy-social-proof-receipt-source-transfer.js';\\n\", 1],\n  ['  input = economySocialReceiptHistoricalInput(file, input);\\n', 2]]) {\n  assert.equal(candidateConserved.split(hook).length, count + 1, 'Exact candidate and main sale integration hooks'); candidateConserved = candidateConserved.split(hook).join('');\n}\nassert.equal(candidateConserved, git('show', 'c86bcd310e5f38845642637230ba4bec7d653183:tools/economy-ux-merge-source-compatibility.js'), 'All committed economy merge qualifiers and refusal predicates remain byte-identical');\nconsole.log(JSON.stringify({ phase: pin.phase, files: pin.files.length, hunks, positives, refusals, runtime: false, native: false }));\n\nlet economicConserved = integratedEconomicParentInput(correctionFile, fs.readFileSync(correctionFile, 'utf8'), 'economic",
              "baseline": "let candidateConserved = fs.readFileSync('tools/economy-ux-merge-source-compatibility.js', 'utf8"
            },
            {
              "at": 17202,
              "current": "economicConserved.split(hook).length, count + 1, 'Exact candidate and main sale integration hooks'); economicConserved = economic",
              "baseline": "candidateConserved.split(hook).length, count + 1, 'Exact candidate and main sale integration hooks'); candidateConserved = candidate"
            },
            {
              "at": 17378,
              "current": "economicConserved, git('show', 'c86bcd310e5f38845642637230ba4bec7d653183:tools/economy-ux-merge-source-compatibility.js'), 'All committed economy merge qualifiers and refusal predicates remain byte-identical'",
              "baseline": "candidateConserved, git('show', 'c86bcd310e5f38845642637230ba4bec7d653183:tools/economy-ux-merge-source-compatibility.js'), 'All committed economy merge qualifiers and refusal predicates remain byte-identical');\nconsole.log(JSON.stringify({ phase: pin.phase, files: pin.files.length, hunks, positives, refusals, runtime: false, native: false })"
            }
          ]
        },
        "main": {
          "pin": {
            "mode": "100644",
            "blob": "9d3de35cedac17863c7e80589f68f73936d23131",
            "sha256": "9eb278519625e3ff8bc91e7b43ad3948f9dcffea56227021a8ae6949f4c36808",
            "bytes": 15587
          },
          "inverses": [
            {
              "at": 129,
              "current": "import { integratedEconomicParentInput } from '../tools/integrated-economic-parent-source.js';\n",
              "baseline": ""
            },
            {
              "at": 2792,
              "current": "  input = integratedEconomicParentInput(file, input, 'main');\n",
              "baseline": ""
            },
            {
              "at": 15744,
              "current": "\nlet economicConserved = integratedEconomicParentInput(correctionFile, fs.readFileSync(correctionFile, 'utf8'), 'economic').replaceAll('\\r\\n', '\\n');\nfor (const [hook, count] of [[\"import { saleHistoricalInput } from './sale-source-compatibility.js';\\n\", 1], ['  input = saleHistoricalInput(file, input);\\n', 2],\n  [\"import { deedAllocationHistoricalInput } from './deed-allocation-source-transfer.js';\\n\", 1],\n  ['  input = deedAllocationHistoricalInput(file, input);\\n', 2],\n  [\"import { currentEconomicTermsBaseline } from './current-economic-terms-source-transfer.js';\\n\", 1],\n  ['  input = currentEconomicTermsBaseline(file, input);\\n', 2],\n  [\"import { economyBankInterestHardeningHistoricalInput } from './economy-bank-interest-source-transfer.js';\\n\", 1],\n  ['  input = economyBankInterestHardeningHistoricalInput(file, input);\\n', 2],\n  [\"import { economySocialProofCutoverHistoricalInput } from './economy-social-proof-cutover-source-transfer.js';\\n\", 1],\n  ['  input = economySocialProofCutoverHistoricalInput(file, input);\\n', 2],\n  [\"import { economySocialReceiptSafetyHistoricalInput } from './economy-social-proof-receipt-safety-source-transfer.js';\\n\", 1],\n  ['  input = economySocialReceiptSafetyHistoricalInput(file, input);\\n', 2],\n  [\"import { economySocialReceiptHistoricalInput } from './economy-social-proof-receipt-source-transfer.js';\\n\", 1],\n  ['  input = economySocialReceiptHistoricalInput(file, input);\\n', 2]]) {\n  assert.equal(economicConserved.split(hook).length, count + 1, 'Exact candidate and main sale integration hooks'); economicConserved = economicConserved.split(hook).join('');\n}\nassert.equal(economicConserved, git('show', 'c86bcd310e5f38845642637230ba4bec7d653183:tools/economy-ux-merge-source-compatibility.js'), 'All committed economy merge qualifiers and refusal predicates remain byte-identical');\n",
              "baseline": ""
            }
          ]
        }
      }
    },
    "test/ux-community-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "d94ad5b89ae6f7ebc6857a8e07289d0cf5d73a59",
        "sha256": "b116725c5683eb044a1b51cc0d2cd33ac72fc656d197c19699e91a4470d91db7",
        "bytes": 29507
      },
      "parents": {
        "economic": {
          "pin": {
            "mode": "100644",
            "blob": "4985b962d60f67d3fbbf59cd58fe914a82f4e366",
            "sha256": "968afcda607bb725fd520b16993a87fcfcfe1e4e61e57346dcdcd0afc7b0e9b3",
            "bytes": 27965
          },
          "inverses": [
            {
              "at": 9569,
              "current": "Details = page.locator(`form[data-community-form=emote][data-subject=\"${threadId}\"]`).locator('xpath=parent::details');\n const emoteSummary = emoteDetails.locator(':scope > summary');\n if (await emoteDetails.evaluate((node) => node.open)) await emoteSummary.click();\n await page.waitForFunction((subject) => {\n  const form = [...document.querySelectorAll('form[data-community-form=emote]')].find((node) => node.dataset.subject === subject);\n  return form?.parentElement.isConnected && !form.parentElement.open;\n }, threadId);\n await page.evaluate((subject) => {\n  window.communityDisclosureRace = { removals: 0, preclickOpen: null };\n  const interrupt = (event) => {\n   const summary = event.target.closest?.('summary'), details = summary?.parentElement;\n   const form = details?.querySelector(':scope > form[data-community-form=emote]'), host = details?.closest('[data-community-host]');\n   if (!host?.isConnected || form?.dataset.subject !== subject || summary !== details.querySelector(':scope > summary')) return;\n   document.removeEventListener('click', interrupt, true);\n   // Registered after the runtime intent handler: recreate the live panel before native toggle.\n   communityDisclosureRace.preclickOpen = details.open;\n   host.remove(); communityDisclosureRace.removals++; communityUnderTest.render();\n  };\n  document.addEventListener('click', interrupt, true);\n }, threadId);\n await emoteSummary.click();\n assert.deepEqual(await page.evaluate(() => communityDisclosureRace), { removals: 1, preclickOpen: false }, 'The live closed disclosure is interrupted exactly once during its opening click');\n await page.waitForFunction((subject) => {\n  const form = [...document.querySelectorAll('form[data-community-form=emote]')].find((node) => node.dataset.subject === subject);\n  return form?.parentElement.isConnected && form.parentElement.open;\n }, threadId);\n assert.equal(await emoteDetails.evaluate((node) => node.open), true, 'The replacement disclosure preserves the deliberate opening intent without another click'",
              "baseline": "Summary = page.locator(`form[data-community-form=emote][data-subject=\"${threadId}\"]`).locator('xpath=parent::details/summary');\n await emoteSummary.evaluate((summary) => summary.addEventListener('click', () => {\n  // Recreate the panel in the exact native-click / asynchronous-toggle window. Its user’s\n  // requested disclosure state must survive a concurrent base-screen refresh.\n  summary.closest('[data-community-host]').remove(); communityUnderTest.render();\n }, { once: true })"
            }
          ]
        },
        "main": {
          "pin": {
            "mode": "100644",
            "blob": "e43b7884dca39515a17a9420bbafaa5bd300e7a8",
            "sha256": "548f20f2364c22fd8e63abf452470271494d50a843903cca5a20fca1b9b74f65",
            "bytes": 29227
          },
          "inverses": [
            {
              "at": 18467,
              "current": "const acceptedAvatars = verified.participants.filter((p) => p.status === 'accepted' && p.characterId)\n  .map((p) => `/v1/avatar/${encodeURIComponent(p.characterId)}`).sort();\n assert.equal(acceptedAvatars.length, 2, 'the actual crew read verifies both explicit current consents');\n const renderedAvatars = await bossPage.waitForFunction(({ id, count }) => {\n  const portrait = document.querySelector(`[data-community-download=\"${id}\"]:enabled`)?.closest('.ux-community-portrait');\n  const images = portrait?.querySelectorAll('img');\n  return images?.length === count && Array.from(images, (img) => img.getAttribute('src')).sort();\n }, { id: portraitId, count: acceptedAvatars.length });\n assert.deepEqual(await renderedAvatars.jsonValue(), acceptedAvatars, 'only the two explicitly accepted avatars appear in the enabled portrait",
              "baseline": "assert.equal(verified.participants.filter((p) => p.status === 'accepted' && p.characterId).length, 2, 'the actual crew read verifies both explicit current consents');\n await bossPortrait.locator('[data-community-download]:enabled').waitFor({ state: 'attached' });\n await bossPage.waitForFunction((id) => document.querySelector(`[data-community-download=\"${id}\"]`)?.closest('.ux-community-portrait')?.querySelectorAll('img').length === 2, portraitId);\n assert.equal(await bossPortrait.locator('img').count(), 2, 'only explicit accepted avatars appear"
            }
          ]
        }
      }
    },
    "tools/economy-ux-merge-source-compatibility.js": {
      "current": {
        "mode": "100644",
        "blob": "32f2d4fa4df42b2865d7c75ed4a67df5263695a9",
        "sha256": "5b6bdb2df698198b5083e69e8a56f685a4f620e3405d36a7be320a046457324b",
        "bytes": 48000
      },
      "parents": {
        "economic": {
          "pin": {
            "mode": "100644",
            "blob": "d14c68de5a401c250cd54fea2267cc3dc6bb26d2",
            "sha256": "597e4aa6b686042ff7a2987bfe8cce892ca3a8641259e78ed75a006a5808e5ff",
            "bytes": 7773
          },
          "inverses": [
            {
              "at": 0,
              "current": "import { wikiMediaHistoricalInput } from './wiki-media-source-transfer.js';\nimport { businessDeskCombinedHistoricalInput } from './businessdesk-combined-source-transfer.js';\nimport { age21HistoricalInput } from './age21-source-transfer.js';\n",
              "baseline": ""
            },
            {
              "at": 327,
              "current": "import { economyDeedMergeHistoricalInput } from './economy-deed-merge-source-compatibility.js';\n",
              "baseline": ""
            },
            {
              "at": 867,
              "current": "import { assertEconomyMonitorSourceTransfer, economyMonitorHistoricalInput } from './economy-monitor-source-transfer.js';\nimport { ageEligibilityHistoricalInput } from './age-eligibility-source-transfer.js';\n",
              "baseline": ""
            },
            {
              "at": 3699,
              "current": "// Exact successor admissions for safe()/null, the private constant, CI wiring and child listeners. The\n// published monitor envelope remains unchanged: only these complete physical bytes reconstruct\n// their 9000f2af sources, checked by the original frozen monitor transfer before chaining.\nexport const ECONOMY_MONITOR_WORKER_SOURCE = Object.freeze({\n  file: 'src/worker.js', sourceRevision: 'fd9ba2014cf7ceb42a7b155bf94a208f9992cfea',\n  predecessorRevision: '9000f2afaf4640e018b2d4026fb7b1ff984a8257',\n  currentSha256: '8461ccc60c86ccadcda3c2820a9026f8eadacebdd201355f23b09e4b646f38f9',\n  currentBlob: '6e0eb2656fb6c815908ddf722a4e8a89dc75f3d2', currentBytes: 87275,\n  occurrences: 1,\n  current: \"      const summary = await safe('economy monitor', () => runEconomyMonitor(pool, { alert: alertDrift }));\\n      if (summary) console.log('[economy monitor]', JSON.stringify(summary));\\n\",\n  baseline: \"      const summary = await runEconomyMonitor(pool, { alert: alertDrift });\\n      console.log('[economy monitor]', JSON.stringify(summary));\\n\",\n});\nexport const ECONOMY_MONITOR_READER_SOURCE = Object.freeze({\n  file: 'src/economy-monitor.js', sourceRevision: '9da329e2be042a105b78c6df089c5c88a4f8ba1f',\n  predecessorRevision: '9000f2afaf4640e018b2d4026fb7b1ff984a8257',\n  currentSha256: '2f08e91725b6692a9c846f1528ca099e2ace7461ed29b6d14ae663f4a923095a',\n  currentBlob: 'c8fad52af8b3f1ea1d2863bbb85edd2a5e09102a', currentBytes: 16574,\n  current: 'COLUMNS', baseline: 'columns', occurrences: 3,\n});\nexport const ECONOMY_MONITOR_RELEASE_SOURCES = Object.freeze({\n  '.github/workflows/economy-hardening.yml': Object.freeze({\n    file: '.github/workflows/economy-hardening.yml', sourceRevision: '9a5c784034a9f543cd32e27fd0b73a23e332ee5b',\n    predecessorRevision: '9000f2afaf4640e018b2d4026fb7b1ff984a8257',\n    currentSha256: '1551813fbb50fb14a3bd9690e5d0d62f09b1605ea4e582612cade095514a57ad',\n    currentBlob: '18d9875f1112661aa57148d7f9c7704d4958bb93', currentBytes: 5425,\n    current: '          node test/age-eligibility-source-compatibility.js &&\\n          node test/economy-monitor-source-compatibility.js &&\\n',\n    baseline: '', occurrences: 1,\n  }),\n  'test/gates.js': Object.freeze({\n    file: 'test/gates.js', sourceRevision: '9a5c784034a9f543cd32e27fd0b73a23e332ee5b',\n    predecessorRevision: '6fdc897851ef23e8c2cf691733ad944a7663242a',\n    currentSha256: 'a30914836d5d503aaf0114a5634e183dfec43a0a9c1c799692e2644612d581f8',\n    currentBlob: 'a0a4551b721073b1eb33780e3702cd0b8fde6813', currentBytes: 461700,\n    baselineSha256: '727b8cfba27ab2b1a69dedaa43aa5d289a09d91aeb27be5f66e87d744f1f4a12',\n    baselineBlob: '238e7a38313f54fd09d82df4dedb9a574f04243d', baselineBytes: 461461,\n    current: \"    'test/economy-composition-restart.js': 'Fresh-process child probe executed by the required native economy-composition suite; it requires an owned disposable PostgreSQL schema and bounded synthetic stdin, so it cannot run standalone.',\\n\",\n    baseline: '', occurrences: 1,\n  }),\n  'test/economy-composition.js': Object.freeze({\n    file: 'test/economy-composition.js', sourceRevision: 'b5155c297f9ab4d097ca4cba1e3ef86babaa449e',\n    predecessorRevision: '9000f2afaf4640e018b2d4026fb7b1ff984a8257',\n    currentSha256: '20d42640e5f750f6abc35d7631024a132ad56f375e48b268827fb704c55b7022',\n    currentBlob: '7f8426a3f112703709e08b8a1b2546c2d72a7896', currentBytes: 21633,\n    current: \"  const child = spawn(process.execPath, [fileURLToPath(new URL('./economy-composition-restart.js', import.meta.url))],\\n    { env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });\\n  const exited = new Promise((resolve, reject) => {\\n    child.once('error', reject); child.once('close', resolve);\\n  });\\n  let stdout = '', stderr = '';\\n  const timeout = setTimeout(() => child.kill(), 90_000); timeout.unref();\\n  child.stdout.on('data', chunk => { stdout += chunk; });\\n  child.stderr.on('data', chunk => { stderr += chunk; });\\n  child.stdin.end(JSON.stringify({ ...probe, wall }));\\n  try {\\n    const exitCode = await exited;\\n\",\n    baseline: \"  const child = spawn(process.execPath, [fileURLToPath(new URL('./economy-composition-restart.js', import.meta.url))],\\n    { env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });\\n  let stdout = '', stderr = '';\\n  const timeout = setTimeout(() => child.kill(), 90_000); timeout.unref();\\n  child.stdout.on('data', chunk => { stdout += chunk; });\\n  child.stderr.on('data', chunk => { stderr += chunk; });\\n  child.stdin.end(JSON.stringify({ ...probe, wall }));\\n  try {\\n    const exitCode = await new Promise((resolve, reject) => {\\n      child.once('error', reject); child.once('close', resolve);\\n    });\\n\", occurrences: 1,\n  }),\n  \"tools/ux-release-phase2-native-catalog.js\": Object.freeze({\n    \"file\": \"tools/ux-release-phase2-native-catalog.js\",\n    \"sourceRevision\": \"5d364a6aa6ff1f5e90a56b056ccc7974c8e4a1f0\",\n    \"predecessorRevision\": \"6fdc897851ef23e8c2cf691733ad944a7663242a\",\n    \"currentSha256\": \"fccef92e9a633a8edad3fe543a47bcd9e852d88cbb354b1f19330a0940d26e9a\",\n    \"currentBlob\": \"03f00b1d21988ff978d8196c8429ef21ba8c5360\",\n    \"currentBytes\": 25797,\n    \"baselineSha256\": \"4c122b2439ef19868259a0b6dbc7cb29d4539c6098ef7e5289703c32d1687fd9\",\n    \"baselineBlob\": \"38dc31de8b9d30cdfd359b6bf8f5cfa02ad1925e\",\n    \"baselineBytes\": 22713,\n    \"contextLines\": 3,\n    inverses: Object.freeze([\n  {\n    \"current\": \"  ? row.table_name === socialBridgeTable && socialExtensionColumns.has(row.column_name)\\n  : field === 'constraints' && row.table_name === socialBridgeTable && row.name === socialBridgeConstraint;\\nconst socialBridgeRows = (metadata, field) => metadata[field].filter(row => isSocialBridgeRow(field, row));\\nconst monitorIndexName = 'ix_tx_at_id';\\nconst isMonitorIndexRow = (field, row) => field === 'indexes' && row.table_name === 'transactions' && row.name === monitorIndexName;\\nconst monitorRows = (metadata, field) => metadata[field].filter(row => isMonitorIndexRow(field, row));\\nconst freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };\\n// Keep the original engine's exact predecessor order; insert the existing-table bridge at its exact\\n// catalog anchors, then retain the reviewed UX append order. No collation normalization is introduced.\\nconst merge = (base, socialBridge, ux, monitor) => {\\n  const merged = Object.fromEntries(fields.map(field => [field, [...base[field]]]));\\n  assert.equal(socialBridge.columns.length, 2); assert(socialBridge.constraints.length <= 1);\\n  assert.deepEqual(socialBridge.columns.map(row => row.column_name),\\n\",\n    \"baseline\": \"  ? row.table_name === socialBridgeTable && socialExtensionColumns.has(row.column_name)\\n  : field === 'constraints' && row.table_name === socialBridgeTable && row.name === socialBridgeConstraint;\\nconst socialBridgeRows = (metadata, field) => metadata[field].filter(row => isSocialBridgeRow(field, row));\\nconst freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };\\n// Keep the original engine's exact predecessor order; insert the existing-table bridge at its exact\\n// catalog anchors, then retain the reviewed UX append order. No collation normalization is introduced.\\nconst merge = (base, socialBridge, ux) => {\\n  const merged = Object.fromEntries(fields.map(field => [field, [...base[field]]]));\\n  assert.equal(socialBridge.columns.length, 2); assert(socialBridge.constraints.length <= 1);\\n  assert.deepEqual(socialBridge.columns.map(row => row.column_name),\\n\"\n  },\n  {\n    \"current\": \"    merged.constraints.splice(constraintAt, 0, ...socialBridge.constraints);\\n  }\\n  for (const field of fields) merged[field].push(...ux[field]);\\n  const indexAt = merged.indexes.findIndex(row => row.table_name === 'transactions' && row.name === 'ix_tx_character');\\n  assert(indexAt >= 0, 'The monitor index precedes the exact predecessor transaction index');\\n  merged.indexes.splice(indexAt, 0, ...monitor.indexes);\\n  return freeze(merged);\\n};\\n\\n\",\n    \"baseline\": \"    merged.constraints.splice(constraintAt, 0, ...socialBridge.constraints);\\n  }\\n  for (const field of fields) merged[field].push(...ux[field]);\\n  return freeze(merged);\\n};\\n\\n\"\n  },\n  {\n    \"current\": \"  }\\n  assert.equal(settings.role, address.username); assert.equal('/' + settings.database, address.pathname);\\n}\\nasync function projectedCaller(pool, ux, socialBridge, monitor) {\\n  const uxProjection = uxNativeProjection(ux), socialBridgeProjection = socialLegacyBridgeProjection(socialBridge),\\n    monitorProjection = monitorNativeProjection(monitor);\\n  const projectMetadata = metadata => monitorProjection.projectMetadata(socialBridgeProjection.projectMetadata(uxProjection.projectMetadata(metadata)));\\n  const context = (await pool.query(catalogQueries[0])).rows[0];\\n  const verify = async () => { projectMetadata(await original.readCommerceReleasePhase2Metadata(pool)); await assertUxNativeSecurity(pool); };\\n  await verify();\\n\",\n    \"baseline\": \"  }\\n  assert.equal(settings.role, address.username); assert.equal('/' + settings.database, address.pathname);\\n}\\nasync function projectedCaller(pool, ux, socialBridge) {\\n  const uxProjection = uxNativeProjection(ux), socialBridgeProjection = socialLegacyBridgeProjection(socialBridge);\\n  const projectMetadata = metadata => socialBridgeProjection.projectMetadata(uxProjection.projectMetadata(metadata));\\n  const context = (await pool.query(catalogQueries[0])).rows[0];\\n  const verify = async () => { projectMetadata(await original.readCommerceReleasePhase2Metadata(pool)); await assertUxNativeSecurity(pool); };\\n  await verify();\\n\"\n  },\n  {\n    \"current\": \"    assert.deepEqual(selected, ux[field], 'Every fresh projected SQL result retains the complete UX ' + field);\\n    assert.deepEqual(socialBridgeRows({ [field]: result.rows }, field), socialBridge[field],\\n      'Every fresh projected SQL result retains the exact social bridge ' + field);\\n    const monitorSelected = monitorRows({ [field]: result.rows }, field).map(row => {\\n      const prefix = ' ON ' + context.schema + '.'; assert.equal(row.definition.split(prefix).length, 2);\\n      return { ...row, definition: row.definition.replace(prefix, ' ON $self.') };\\n    });\\n    assert.deepEqual(monitorSelected, monitor[field], 'Every fresh projected SQL result retains the exact monitor ' + field);\\n    if (guarded) await assertUxNativeSecurity(pool);\\n    return { ...result, rows: result.rows.filter(row => !names.has(tableOf(field, row)) && !isSocialBridgeRow(field, row) && !isMonitorIndexRow(field, row)) };\\n  } });\\n  return { ...wrap(pool, true), connect: async () => {\\n    const client = await pool.connect();\\n\",\n    \"baseline\": \"    assert.deepEqual(selected, ux[field], 'Every fresh projected SQL result retains the complete UX ' + field);\\n    assert.deepEqual(socialBridgeRows({ [field]: result.rows }, field), socialBridge[field],\\n      'Every fresh projected SQL result retains the exact social bridge ' + field);\\n    if (guarded) await assertUxNativeSecurity(pool);\\n    return { ...result, rows: result.rows.filter(row => !names.has(tableOf(field, row)) && !isSocialBridgeRow(field, row)) };\\n  } });\\n  return { ...wrap(pool, true), connect: async () => {\\n    const client = await pool.connect();\\n\"\n  },\n  {\n    \"current\": \"    const settings = (await client.query('SELECT current_schema() AS schema,current_database() AS database,current_user AS role')).rows[0];\\n    const parent = (await pool.query('SELECT current_database() AS database,current_user AS role')).rows[0];\\n    assert.equal(settings.schema, schema); assert.equal(settings.database, parent.database); assert.equal(settings.role, parent.role);\\n    // Compile the monitor index independently of schema.sql and the migrated caller. Only this\\n    // exact additive index is projected from the unchanged predecessor's complete catalog proof.\\n    await client.query(socialBridgeDdl + '\\\\n' + uxDdl + '\\\\nCREATE TABLE transactions (at TIMESTAMPTZ, id TEXT);\\\\nCREATE INDEX ix_tx_at_id ON transactions (at, id);');\\n    const reference = await original.readCommerceReleasePhase2Metadata(client);\\n    assert.deepEqual(reference.relations.map(row => row.name), [socialBridgeTable, 'transactions', ...UX_NATIVE_TABLES],\\n      'Independent immutable DDL creates exactly the social bridge, monitor fixture and seven UX tables');\\n    const ux = Object.fromEntries(fields.map(field => [field, uxRows(reference, field)]));\\n    assert.deepEqual(ux.relations.map(row => row.name), UX_NATIVE_TABLES, 'Independent immutable DDL creates exactly the seven UX tables');\\n    const socialBridge = Object.fromEntries(fields.map(field => [field, socialBridgeRows(reference, field)]));\\n\",\n    \"baseline\": \"    const settings = (await client.query('SELECT current_schema() AS schema,current_database() AS database,current_user AS role')).rows[0];\\n    const parent = (await pool.query('SELECT current_database() AS database,current_user AS role')).rows[0];\\n    assert.equal(settings.schema, schema); assert.equal(settings.database, parent.database); assert.equal(settings.role, parent.role);\\n    await client.query(socialBridgeDdl + '\\\\n' + uxDdl);\\n    const reference = await original.readCommerceReleasePhase2Metadata(client);\\n    assert.deepEqual(reference.relations.map(row => row.name), [socialBridgeTable, ...UX_NATIVE_TABLES],\\n      'Independent immutable DDL creates exactly the social bridge fixture and seven UX tables');\\n    const ux = Object.fromEntries(fields.map(field => [field, uxRows(reference, field)]));\\n    assert.deepEqual(ux.relations.map(row => row.name), UX_NATIVE_TABLES, 'Independent immutable DDL creates exactly the seven UX tables');\\n    const socialBridge = Object.fromEntries(fields.map(field => [field, socialBridgeRows(reference, field)]));\\n\"\n  },\n  {\n    \"current\": \"      referenced_schema: null, referenced_table: null, columns: [socialBridgeColumn], referenced_columns: [] }],\\n    'PostgreSQL 18 exposes the exact generated social bridge NOT NULL catalog row');\\n    assert.equal(socialBridge.relations.length + socialBridge.indexes.length, 0, 'The social bridge adds no relation or index');\\n    const monitor = Object.fromEntries(fields.map(field => [field, monitorRows(reference, field)]));\\n    assert.deepEqual(monitor.indexes, [{ table_name: 'transactions', name: monitorIndexName,\\n      definition: 'CREATE INDEX ix_tx_at_id ON $self.transactions USING btree (at, id)',\\n      unique: false, primary: false, valid: true, ready: true, live: true, nulls_not_distinct: false, predicate: null }],\\n    'Independent fixed DDL compiles the exact complete monitor index catalog row');\\n    return freeze({ ux, socialBridge, monitor });\\n  } finally {\\n    await client?.end();\\n    if (created) {\\n\",\n    \"baseline\": \"      referenced_schema: null, referenced_table: null, columns: [socialBridgeColumn], referenced_columns: [] }],\\n    'PostgreSQL 18 exposes the exact generated social bridge NOT NULL catalog row');\\n    assert.equal(socialBridge.relations.length + socialBridge.indexes.length, 0, 'The social bridge adds no relation or index');\\n    return freeze({ ux, socialBridge });\\n  } finally {\\n    await client?.end();\\n    if (created) {\\n\"\n  },\n  {\n    \"current\": \"  };\\n  return Object.freeze({ projectMetadata, projectConstraints });\\n}\\nexport function monitorNativeProjection(reference) {\\n  reference = freeze(structuredClone(reference));\\n  assert.equal(reference.relations.length + reference.columns.length + reference.constraints.length, 0);\\n  assert.equal(reference.indexes.length, 1);\\n  assert(isMonitorIndexRow('indexes', reference.indexes[0]));\\n  const projectMetadata = metadata => {\\n    for (const field of fields) assert.deepEqual(monitorRows(metadata, field), reference[field],\\n      'Exact independently compiled monitor ' + field);\\n    return Object.fromEntries(fields.map(field => [field, metadata[field].filter(row => !isMonitorIndexRow(field, row))]));\\n  };\\n  return Object.freeze({ projectMetadata });\\n}\\nfunction extendCatalog(prior, ux, socialBridge, monitor, branches = false) {\\n  const uxProjection = uxNativeProjection(ux), socialBridgeProjection = socialLegacyBridgeProjection(socialBridge),\\n    monitorProjection = monitorNativeProjection(monitor),\\n    projectMetadata = metadata => monitorProjection.projectMetadata(socialBridgeProjection.projectMetadata(uxProjection.projectMetadata(metadata))),\\n    base = branches ? prior.current : prior.reference, reference = merge(base, socialBridge, ux, monitor);\\n  const verifyMetadata = metadata => (branches ? prior.verify : prior.verifyMetadata)(projectMetadata(metadata));\\n  verifyMetadata(reference);\\n  const causal = { socialBridge: 0, socialProofContract: 0, ux: 0, monitor: 0 };\\n  assert.throws(() => { reference.columns.push({}); }, TypeError);\\n  for (const [label, extension, makeProjection] of [\\n    ['socialBridge', socialBridge, socialLegacyBridgeProjection], ['ux', ux, uxNativeProjection],\\n    ['monitor', monitor, monitorNativeProjection],\\n  ]) {\\n    const field = fields.find(field => extension[field].length), key = Object.keys(extension[field][0])[0];\\n    assert.throws(() => { extension[field][0][key] = 'tampered'; }, TypeError);\\n    const retained = structuredClone(extension), independent = makeProjection(retained);\\n    retained[field][0][key] = 'tampered';\\n    const integrated = merge(base, label === 'socialBridge' ? retained : socialBridge,\\n      label === 'ux' ? retained : ux, label === 'monitor' ? retained : monitor);\\n    assert.throws(() => independent.projectMetadata(integrated), error => error?.code === 'ERR_ASSERTION'); causal[label]++;\\n  }\\n  verifyMetadata(reference);\\n  for (const [label, extension] of [['socialBridge', socialBridge], ['ux', ux], ['monitor', monitor]]) {\\n    for (const field of fields) for (const row of extension[field]) {\\n      const causalLabel = label === 'socialBridge' && field === 'columns'\\n        && row.column_name === socialProofContractColumn ? 'socialProofContract' : label;\\n\",\n    \"baseline\": \"  };\\n  return Object.freeze({ projectMetadata, projectConstraints });\\n}\\nfunction extendCatalog(prior, ux, socialBridge, branches = false) {\\n  const uxProjection = uxNativeProjection(ux), socialBridgeProjection = socialLegacyBridgeProjection(socialBridge),\\n    projectMetadata = metadata => socialBridgeProjection.projectMetadata(uxProjection.projectMetadata(metadata)),\\n    base = branches ? prior.current : prior.reference, reference = merge(base, socialBridge, ux);\\n  const verifyMetadata = metadata => (branches ? prior.verify : prior.verifyMetadata)(projectMetadata(metadata));\\n  verifyMetadata(reference);\\n  const causal = { socialBridge: 0, socialProofContract: 0, ux: 0 };\\n  assert.throws(() => { reference.columns.push({}); }, TypeError);\\n  for (const [label, extension, makeProjection] of [\\n    ['socialBridge', socialBridge, socialLegacyBridgeProjection], ['ux', ux, uxNativeProjection],\\n  ]) {\\n    assert.throws(() => { extension.columns[0].type = 'tampered'; }, TypeError);\\n    const retained = structuredClone(extension), independent = makeProjection(retained);\\n    retained.columns[0].type = 'tampered';\\n    const integrated = label === 'socialBridge' ? merge(base, retained, ux) : merge(base, socialBridge, retained);\\n    assert.throws(() => independent.projectMetadata(integrated), error => error?.code === 'ERR_ASSERTION'); causal[label]++;\\n  }\\n  verifyMetadata(reference);\\n  for (const [label, extension] of [['socialBridge', socialBridge], ['ux', ux]]) {\\n    for (const field of fields) for (const row of extension[field]) {\\n      const causalLabel = label === 'socialBridge' && field === 'columns'\\n        && row.column_name === socialProofContractColumn ? 'socialProofContract' : label;\\n\"\n  },\n  {\n    \"current\": \"    'Proof-contract missing, duplicate and every-field mutations are all refused');\\n  const common = { ...prior, reference, verifyMetadata, socialBridgeReference: socialBridge,\\n    socialBridgeCausal: causal.socialBridge, socialProofContractCausal: causal.socialProofContract,\\n    uxReference: ux, uxSource: UX_SOURCE.revision, uxCausal: causal.ux,\\n    monitorReference: monitor, monitorCausal: causal.monitor };\\n  if (branches) return Object.freeze({ ...common, current: reference, verify: verifyMetadata });\\n  return Object.freeze({ ...common, normalize: rows => prior.normalize(socialBridgeProjection.projectConstraints(\\n    uxProjection.projectConstraints(rows, prior.includeNotNull), prior.includeNotNull)) });\\n\",\n    \"baseline\": \"    'Proof-contract missing, duplicate and every-field mutations are all refused');\\n  const common = { ...prior, reference, verifyMetadata, socialBridgeReference: socialBridge,\\n    socialBridgeCausal: causal.socialBridge, socialProofContractCausal: causal.socialProofContract,\\n    uxReference: ux, uxSource: UX_SOURCE.revision, uxCausal: causal.ux };\\n  if (branches) return Object.freeze({ ...common, current: reference, verify: verifyMetadata });\\n  return Object.freeze({ ...common, normalize: rows => prior.normalize(socialBridgeProjection.projectConstraints(\\n    uxProjection.projectConstraints(rows, prior.includeNotNull), prior.includeNotNull)) });\\n\"\n  },\n  {\n    \"current\": \"export async function createCommerceReleasePhase2MigrationCatalog(pool, endpoint, input, options) {\\n  const { candidate } = integratedSchemaSources(input);\\n  await assertNativeCaller(pool, endpoint, options?.legacyProfile, options?.includeNotNull);\\n  const { ux, socialBridge, monitor } = await compileCurrentExtensionReference(pool, endpoint);\\n  const prior = await original.createCommerceReleasePhase2MigrationCatalog(\\n    await projectedCaller(pool, ux, socialBridge, monitor), endpoint, candidate, options);\\n  return extendCatalog(prior, ux, socialBridge, monitor);\\n}\\nexport async function verifyCommerceNativeBranches(pool, endpoint) {\\n  await assertNativeCaller(pool, endpoint, 'fresh', true);\\n  const { candidate } = integratedSchemaSources(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));\\n  const { ux, socialBridge, monitor } = await compileCurrentExtensionReference(pool, endpoint);\\n  const prior = await original.verifyCommerceNativeBranches(\\n    await projectedCaller(pool, ux, socialBridge, monitor), endpoint, candidate);\\n  return extendCatalog(prior, ux, socialBridge, monitor, true);\\n}\\n\",\n    \"baseline\": \"export async function createCommerceReleasePhase2MigrationCatalog(pool, endpoint, input, options) {\\n  const { candidate } = integratedSchemaSources(input);\\n  await assertNativeCaller(pool, endpoint, options?.legacyProfile, options?.includeNotNull);\\n  const { ux, socialBridge } = await compileCurrentExtensionReference(pool, endpoint);\\n  const prior = await original.createCommerceReleasePhase2MigrationCatalog(\\n    await projectedCaller(pool, ux, socialBridge), endpoint, candidate, options);\\n  return extendCatalog(prior, ux, socialBridge);\\n}\\nexport async function verifyCommerceNativeBranches(pool, endpoint) {\\n  await assertNativeCaller(pool, endpoint, 'fresh', true);\\n  const { candidate } = integratedSchemaSources(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));\\n  const { ux, socialBridge } = await compileCurrentExtensionReference(pool, endpoint);\\n  const prior = await original.verifyCommerceNativeBranches(\\n    await projectedCaller(pool, ux, socialBridge), endpoint, candidate);\\n  return extendCatalog(prior, ux, socialBridge, true);\\n}\\n\"\n  }\n].map(Object.freeze)),\n  }),\n  \"tools/pgquery.js\": Object.freeze({\n    \"file\": \"tools/pgquery.js\",\n    \"sourceRevision\": \"29d6861f44bf281182ea55880d4262aaa4cfb8d1\",\n    \"predecessorRevision\": \"6fdc897851ef23e8c2cf691733ad944a7663242a\",\n    \"currentSha256\": \"0676e31ece6b2412bef8b3a5f3e4e8cba35f149d822488dcf1cd0620a2bcead9\",\n    \"currentBlob\": \"60d7d486af4104d12304ed3871ef7e3d391461d0\",\n    \"currentBytes\": 41576,\n    \"baselineSha256\": \"ed8d93ce2c634c861af924270ea77b26ab77d3e5e34a3d7cb24e84d06540d311\",\n    \"baselineBlob\": \"db503b17b08439bcbd36aacc4deae0b8a1907c53\",\n    \"baselineBytes\": 35419,\n    \"contextLines\": 3,\n    inverses: Object.freeze([\n  {\n    \"current\": \"  return variants;\\n}\\n\\n// The monitor's private readRows dispatcher has exactly two closed callers; its daily SELECT\\n// interpolates only one fixed column list. Pin the complete caller authority and scanner corpus,\\n// then capture the actual exported monitor at both row-limit extremes and UTC boundaries. None of\\n// these three statements needs an unchecked-query allowance: dates, sources and limits stay bound.\\nasync function modelEconomyMonitorQueries(rows, dynamicSites) {\\n  const rel = 'src/economy-monitor.js';\\n  const sourcePin = '2f08e91725b6692a9c846f1528ca099e2ace7461ed29b6d14ae663f4a923095a';\\n  const verifySource = raw => {\\n    const lf = canonicalSql(raw);\\n    if (lf.includes('\\\\r') || (raw !== lf && raw !== lf.replaceAll('\\\\n', '\\\\r\\\\n'))\\n        || createHash('sha256').update(lf).digest('hex') !== sourcePin)\\n      throw new Error('economy monitor source changed; review its complete closed SQL model');\\n  };\\n  const source = readFileSync(path.join(ROOT, rel), 'utf8');\\n  verifySource(source);\\n  let mutationRejected = false;\\n  try { verifySource(source + ' '); }\\n  catch (error) {\\n    if (!error.message.includes('source changed')) throw error;\\n    mutationRejected = true;\\n  }\\n  if (!mutationRejected) throw new Error('economy monitor SQL model accepted mutated source');\\n\\n  const checkpoint = \\\"SELECT props FROM telemetry WHERE event='economy_monitor' ORDER BY at DESC,id DESC LIMIT 1\\\";\\n  const insert = 'INSERT INTO telemetry (id,event,props,at) VALUES ($1,$2,$3,$4)';\\n  const dailyTemplate = `SELECT  FROM transactions t LEFT JOIN characters c ON c.id=t.character_id\\n      WHERE t.at >= $1 AND t.at <= $2 AND t.currency=$3 AND t.reason=$4\\n      ORDER BY t.at DESC,t.id DESC LIMIT $5`;\\n  const expectedReadable = [[rel, checkpoint, []], [rel, dailyTemplate, ['COLUMNS']], [rel, insert, []]];\\n  const monitorRows = rows.filter(row => row.rel === rel);\\n  if (JSON.stringify(monitorRows.map(scannerSignature))\\n      !== JSON.stringify(expectedReadable.map(([rel, sql, parts]) => scannerSignature({ rel, sql, parts }))))\\n    throw new Error('economy monitor readable SQL call sites changed');\\n  const helperSites = dynamicSites.filter(row => row.rel === rel);\\n  if (helperSites.length !== 1 || helperSites[0].where !== rel + ':139')\\n    throw new Error('economy monitor private SQL dispatcher changed');\\n  const dailyRow = monitorRows[1], helper = helperSites[0];\\n  const shapes = new Map(['recent', 'daily', 'bounds'].map(name => [name, new Set()]));\\n  const { runEconomyMonitor } = await import('../src/economy-monitor.js');\\n  for (const rowLimit of [1, 50000]) for (const instant of ['2026-10-31T23:59:59.999Z', '2026-11-01T00:00:00.000Z']) {\\n    const now = new Date(instant), calls = [];\\n    const client = { query: async (sql, params) => {\\n      if (typeof sql !== 'string') throw new Error('economy monitor model captured non-string SQL');\\n      calls.push(sql);\\n      if (sql === checkpoint) {\\n        if (params !== undefined) throw new Error('economy monitor checkpoint acquired unmodeled parameters');\\n        return { rows: [] };\\n      }\\n      if (sql === insert) {\\n        if (!Array.isArray(params) || params.length !== 4 || params[1] !== 'economy_monitor'\\n            || +params[3] !== +now)\\n          throw new Error('economy monitor summary INSERT changed its bound values');\\n        return { rows: [] };\\n      }\\n      const kind = sql.includes('FROM transactions t')\\n        ? (sql.includes('t.currency=$3 AND t.reason=$4') ? 'daily' : 'recent')\\n        : sql.includes(\\\"event='economy_payout_bound'\\\") ? 'bounds' : null;\\n      if (!kind) throw new Error('economy monitor model captured an unknown dispatcher query');\\n      const count = kind === 'daily' ? 5 : 3;\\n      const placeholders = [...sql.matchAll(/\\\\$(\\\\d+)/g)].map(match => Number(match[1]));\\n      if (!Array.isArray(params) || params.length !== count || placeholders.length !== count\\n          || placeholders.some((placeholder, index) => placeholder !== index + 1)\\n          || !(params[0] instanceof Date) || +params[1] !== +now || params.at(-1) !== rowLimit + 1)\\n        throw new Error('economy monitor model did not retain dates and limit as separate bound values');\\n      if (kind === 'daily' && (!['cash', 'omr'].includes(params[2]) || typeof params[3] !== 'string'))\\n        throw new Error('economy monitor daily source values are not bound');\\n      shapes.get(kind).add(sql);\\n      return { rows: [] };\\n    } };\\n    const summary = await runEconomyMonitor(client, { now, rowLimit, ledgerRowsWarn: 1000,\\n      netCashWarn: 10000000, netOmrWarn: 1000 });\\n    if (!summary.ok || calls.length !== summary.dailySources.length + 4\\n        || calls[0] !== checkpoint || calls.at(-1) !== insert)\\n      throw new Error('economy monitor model did not execute its complete closed query path');\\n  }\\n  if ([...shapes.values()].some(set => set.size !== 1))\\n    throw new Error('economy monitor dates or row limits changed a closed SQL shape');\\n  return { variants: new Map([[dailyRow, [...shapes.get('daily')]]]),\\n    helper, helperSql: [...shapes.get('recent'), ...shapes.get('bounds')] };\\n}\\n\\nlet modeledQueries;\\nlet monitorModel;\\ntry {\\n  modeledQueries = await modelSocialReceiptQueries(readable);\\n  monitorModel = await modelEconomyMonitorQueries(readable, unreadableSites);\\n  for (const [site, sql] of monitorModel.variants) modeledQueries.set(site, sql);\\n} catch (error) {\\n  console.error('pgquery refused bounded runtime query model: ' + error.message);\\n  process.exit(1);\\n}\\nlet modeledSites = 0, modeledVariants = 0;\\n\",\n    \"baseline\": \"  return variants;\\n}\\n\\nlet modeledQueries;\\ntry {\\n  modeledQueries = await modelSocialReceiptQueries(readable);\\n} catch (error) {\\n  console.error('pgquery refused bounded social-receipt query model: ' + error.message);\\n  process.exit(1);\\n}\\nlet modeledSites = 0, modeledVariants = 0;\\n\"\n  },\n  {\n    \"current\": \"  if (!DML.test(got.sql)) { skipped.push(got.where); continue; }\\n  stmts.push({ where: got.where, sql: got.sql });\\n}\\nif (modeledSites !== 8 || modeledVariants !== 3012) {\\n  console.error(`pgquery bounded interpolated models classified ${modeledSites} sites/${modeledVariants} variants (expected 8/3012)`);\\n  process.exit(1);\\n}\\nconst monitorHelperIndex = unreadable.indexOf(monitorModel.helper.where);\\nif (monitorHelperIndex < 0 || monitorModel.helperSql.length !== 2)\\n  throw new Error('economy monitor modeled dispatcher is not in the unchecked corpus exactly once');\\nunreadable.splice(monitorHelperIndex, 1);\\nfor (let i = 0; i < monitorModel.helperSql.length; i++)\\n  stmts.push({ where: `${monitorModel.helper.where} [closed dispatcher ${i + 1}/2]`, sql: monitorModel.helperSql[i] });\\n\\n// These four Commerce sites stay counted/listed as UNPREPARED. Whole-source pins close the\\n// caller/column authority: a 23-column INSERT with bound values; the forward/undo UPDATE over\\n\",\n    \"baseline\": \"  if (!DML.test(got.sql)) { skipped.push(got.where); continue; }\\n  stmts.push({ where: got.where, sql: got.sql });\\n}\\nif (modeledSites !== 7 || modeledVariants !== 3011) {\\n  console.error(`pgquery bounded social-receipt model classified ${modeledSites} sites/${modeledVariants} variants (expected 7/3011)`);\\n  process.exit(1);\\n}\\n\\n// These four Commerce sites stay counted/listed as UNPREPARED. Whole-source pins close the\\n// caller/column authority: a 23-column INSERT with bound values; the forward/undo UPDATE over\\n\"\n  },\n  {\n    \"current\": \"// ── 3. REPORT ────────────────────────────────────────────────────────────────────────────────────\\nconsole.log(`\\\\npgquery — ${stmts.length} static/bounded statements prepared against real Postgres`);\\nconsole.log(`  ${modeledVariants} generated variants from ${modeledSites} interpolated sites were materialized and prepared`);\\nconsole.log('  2 closed SELECT shapes from the economy monitor non-literal dispatcher were captured and prepared');\\nconsole.log(`  ${interpolated.length} interpolated (cannot be prepared — counted, never silently passed; PGQUERY_LIST=1 to list)`);\\nconsole.log(`  ${skipped.length} non-DML (DDL / transaction control — not preparable by design)`);\\nconsole.log(`  ${unreadable.length} call sites whose argument is not a literal (a variable or a helper)\\\\n`);\\n\",\n    \"baseline\": \"// ── 3. REPORT ────────────────────────────────────────────────────────────────────────────────────\\nconsole.log(`\\\\npgquery — ${stmts.length} static/bounded statements prepared against real Postgres`);\\nconsole.log(`  ${modeledVariants} generated variants from ${modeledSites} interpolated sites were materialized and prepared`);\\nconsole.log(`  ${interpolated.length} interpolated (cannot be prepared — counted, never silently passed; PGQUERY_LIST=1 to list)`);\\nconsole.log(`  ${skipped.length} non-DML (DDL / transaction control — not preparable by design)`);\\nconsole.log(`  ${unreadable.length} call sites whose argument is not a literal (a variable or a helper)\\\\n`);\\n\"\n  },\n  {\n    \"current\": \"// bounded model above invokes their real runtime generators, materializes every admitted cardinality\\n// and closed branch (3,011 statements), and PREPAREs each one. Exact scanner signatures and runtime\\n// cap assertions fail closed on drift; the pre-R6 measured interpolated corpus therefore remains 172.\\n// Economy monitoring adds one fixed-column interpolation and a two-caller private dispatcher. The\\n// pinned runtime model above captures and PREPAREs all three shapes instead of consuming new\\n// unchecked-query room. Its one non-literal dispatcher is removed only after that complete model\\n// succeeds; the 44-site non-literal ceiling is unchanged.\\nconst CEILING = { interpolated: 173, unreadable: 44 };\\nconst overflow = [];\\nif (interpolated.length > CEILING.interpolated)\\n\",\n    \"baseline\": \"// bounded model above invokes their real runtime generators, materializes every admitted cardinality\\n// and closed branch (3,011 statements), and PREPAREs each one. Exact scanner signatures and runtime\\n// cap assertions fail closed on drift; the pre-R6 measured interpolated corpus therefore remains 172.\\nconst CEILING = { interpolated: 173, unreadable: 44 };\\nconst overflow = [];\\nif (interpolated.length > CEILING.interpolated)\\n\"\n  }\n].map(Object.freeze)),\n  }),\n\n});\nfunction assertMonitorSuccessor(file, input, pin) {\n  assert.equal(file, pin.file, 'Only the exact named economy-monitor successor');\n  const current = normalize(input);\n  assert.equal(sha(current), pin.currentSha256, 'Whole economy-monitor successor changed');\n  assert.equal(blob(current), pin.currentBlob); assert.equal(Buffer.byteLength(current), pin.currentBytes);\n  let baselineText = current;\n  if (pin.inverses) {\n    assert(Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));\n    let end = -1;\n    for (const inverse of pin.inverses) {\n      assert.deepEqual(Object.keys(inverse).sort(), ['baseline', 'current']);\n      assert(inverse.current.length && typeof inverse.baseline === 'string');\n      assert.equal(current.split(inverse.current).length, 2, 'Unique complete release correction hunk');\n      const at = current.indexOf(inverse.current); assert(at >= end, 'Ordered nonoverlapping release correction hunks');\n      end = at + inverse.current.length;\n      assert.equal(baselineText.split(inverse.current).length, 2);\n      baselineText = baselineText.replace(inverse.current, () => inverse.baseline);\n    }\n  } else {\n    assert.equal(current.split(pin.current).length, pin.occurrences + 1, 'Exact bounded economy-monitor successor replacements');\n    baselineText = current.replaceAll(pin.current, () => pin.baseline);\n  }\n  if (pin.baselineSha256) {\n    assert.equal(sha(baselineText), pin.baselineSha256); assert.equal(blob(baselineText), pin.baselineBlob);\n    assert.equal(Buffer.byteLength(baselineText), pin.baselineBytes);\n  } else assertEconomyMonitorSourceTransfer(file, baselineText);\n  return Object.freeze({ file, baselineText, sourceRevision: pin.sourceRevision, predecessorRevision: pin.predecessorRevision,\n    sourceOnly: true, native: false, runtime: false });\n}\nexport function assertEconomyMonitorWorkerSource(file, input) {\n  return assertMonitorSuccessor(file, input, ECONOMY_MONITOR_WORKER_SOURCE);\n}\nexport function assertEconomyMonitorReaderSource(file, input) {\n  return assertMonitorSuccessor(file, input, ECONOMY_MONITOR_READER_SOURCE);\n}\nfunction monitorSuccessorHistoricalInput(file, input, pin) {\n  if (file !== pin.file) return input;\n  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;\n  if (buffer) assert(Buffer.from(text).equals(input), 'lossless UTF-8 physical successor source required');\n  let current;\n  try { current = normalize(text); } catch { return input; }\n  if (sha(current) !== pin.currentSha256) return input;\n  const restored = assertMonitorSuccessor(file, text, pin).baselineText;\n  return buffer ? Buffer.from(restored) : restored;\n}\nexport function economyMonitorWorkerHistoricalInput(file, input) {\n  return monitorSuccessorHistoricalInput(file, input, ECONOMY_MONITOR_WORKER_SOURCE);\n}\nexport function economyMonitorReaderHistoricalInput(file, input) {\n  return monitorSuccessorHistoricalInput(file, input, ECONOMY_MONITOR_READER_SOURCE);\n}\nexport function assertEconomyMonitorReleaseSource(file, input) {\n  assert(Object.hasOwn(ECONOMY_MONITOR_RELEASE_SOURCES, file), 'Only the five exact economy-monitor CI/test/tool source domains');\n  return assertMonitorSuccessor(file, input, ECONOMY_MONITOR_RELEASE_SOURCES[file]);\n}\nexport function economyMonitorReleaseHistoricalInput(file, input) {\n  if (!Object.hasOwn(ECONOMY_MONITOR_RELEASE_SOURCES, file)) return input;\n  return monitorSuccessorHistoricalInput(file, input, ECONOMY_MONITOR_RELEASE_SOURCES[file]);\n}\n",
              "baseline": ""
            },
            {
              "at": 45396,
              "current": ", profile = 'monitor') {\n  input = businessDeskCombinedHistoricalInput(file, input, 'monitor');\n  input = economyDeedMergeHistoricalInput(file, input, profile);\n  if (profile === 'monitor') input = ageEligibilityHistoricalInput(file, input);",
              "baseline": ") {"
            },
            {
              "at": 45745,
              "current": "  if (profile === 'deed') input = ageEligibilityHistoricalInput(file, input);\n  input = age21HistoricalInput(file, wikiMediaHistoricalInput(file, input));\n  input = economyMonitorWorkerHistoricalInput(file, input);\n  input = economyMonitorReaderHistoricalInput(file, input);\n  input = economyMonitorReleaseHistoricalInput(file, input);\n  input = economyMonitorHistoricalInput(file, input);\n",
              "baseline": ""
            },
            {
              "at": 46553,
              "current": ", profile = 'monitor') {\n  input = businessDeskCombinedHistoricalInput(file, input, 'monitor');\n  input = economyDeedMergeHistoricalInput(file, input, profile);\n  if (profile === 'monitor') input = ageEligibilityHistoricalInput(file, input);",
              "baseline": ") {"
            },
            {
              "at": 46902,
              "current": "  if (profile === 'deed') input = ageEligibilityHistoricalInput(file, input);\n  input = age21HistoricalInput(file, wikiMediaHistoricalInput(file, input));\n  input = economyMonitorWorkerHistoricalInput(file, input);\n  input = economyMonitorReaderHistoricalInput(file, input);\n  input = economyMonitorReleaseHistoricalInput(file, input);\n  input = economyMonitorHistoricalInput(file, input);\n",
              "baseline": ""
            }
          ]
        },
        "main": {
          "pin": {
            "mode": "100644",
            "blob": "4c1aef1eb0e7cc54c5d13f7677d3d108ead329d1",
            "sha256": "4a42f8a56fb4944849061579390f5f8f835be54ecec1281b59f51037f6f687e7",
            "bytes": 47802
          },
          "inverses": [
            {
              "at": 705,
              "current": "import { currentEconomicTermsBaseline } from './current-economic-terms-source-transfer.js';\n",
              "baseline": ""
            },
            {
              "at": 45692,
              "current": "  input = currentEconomicTermsBaseline(file, input);\n",
              "baseline": ""
            },
            {
              "at": 46849,
              "current": "  input = currentEconomicTermsBaseline(file, input);\n",
              "baseline": ""
            }
          ]
        }
      }
    },
    "tools/enterprise-native-ux-seal.js": {
      "current": {
        "mode": "100644",
        "blob": "0fd413b3ee5149b16d6fef83352afd26ff5204b8",
        "sha256": "3b867de85ed2d6e353bc3c84db608bde0eb7e834f635bd6f1dd879dad9def61d",
        "bytes": 8426
      },
      "parents": {
        "economic": {
          "pin": {
            "mode": "100644",
            "blob": "8972b325c738cd1b313ed72914a1849c321f9401",
            "sha256": "0dfc250fd22cae0936b67e16c1e6d0b1c2bf498edbbe89e9bba27b3ddc9698fc",
            "bytes": 4960
          },
          "inverses": [
            {
              "at": 435,
              "current": "BUSINESS_PREDECESSOR_METADATA, ENTERPRISE_UX_BUSINESS_PREDECESSOR_METADATA_SHA256, ENTERPRISE_UX_PREDECESSOR_METADATA, ENTERPRISE_UX_PREDECESSOR_METADATA_SHA256, ENTERPRISE_UX_QUALIFIED_METADATA, ENTERPRISE_UX_QUALIFI",
              "baseline": "PREDECESSOR_METADATA, ENTERPRISE_UX_PREDECESSOR_METADATA_SHA256, ENTERPRISE_UX_QUALIFIED_METADATA, ENTERPRISE_UX_QUALIFIED_METADATA_SHA256, ENTERPRISE_DEED_METADATA, ENTERPRISE_DE"
            },
            {
              "at": 895,
              "current": "",
              "baseline": "import { combinedEconomicDeedPin } from './combined-economic-deed-source-transfer.js';\n"
            },
            {
              "at": 978,
              "current": "import { BUSINESS_DESK_COMBINED_SOURCE, BUSINESS_DESK_COMBINED_SOURCE_SHA256 } from './businessdesk-combined-source-data.js';\nimport { BUSINESS_DESK_COMBINED_NATIVE, BUSINESS_DESK_COMBINED_NATIVE_SHA256 } from './businessdesk-combined-native-data.js';\nimport { BUSINESS_DESK_COMBINED_NATIVE_PARENTS, BUSINESS_DESK_COMBINED_NATIVE_PARENTS_SHA256 } from './businessdesk-combined-native-parents.js';\nimport { assertBusinessDeskCombinedNativeParents } from './businessdesk-combined-native-provenance.js';\nimport { ECONOMY_DEED_MERGE_NATIVE_PROVENANCE_SHA256 } from './economy-deed-merge-source-data.js';\nimport { WIKI_MEDIA_MERGE_SOURCE_SHA256, WIKI_MEDIA_NOIR_MERGE_SOURCE_SHA256 } from './wiki-media-source-data.js';\nimport { NOIR_UI_SOURCE_SHA256 } from './noir-ui-source-data.js';\nimport { assertEconomicReleaseNativeDefinition } from './economic-release-native-provenance.js';\nimport { reviewedRevision, reviewedTree } from './economic-release-native-source.js';\n",
              "baseline": ""
            },
            {
              "at": 3329,
              "current": "assertBusinessDeskCombinedNativeParents();\nfor (const parent of Object.values(BUSINESS_DESK_COMBINED_NATIVE_PARENTS.profiles)) {\n git('merge-base', '--is-ancestor', parent.revision, revision);\n assert.equal(git('rev-parse', parent.revision + '^{tree}').toString().trim(), parent.tree,\n  'Every accepted parent is its exact reviewed tree');\n const archived = record(revision, parent.archiveFile);\n assert.equal(archived.mode, parent.original.mode); assert.equal(archived.blob, parent.original.blob);\n assert.equal(archived.sha256, parent.original.rawSha256, 'Never reseal a rewritten frozen parent descriptor');\n}\nfor (const catalog of Object.values(BUSINESS_DESK_COMBINED_NATIVE_PARENTS.catalogs)) {\n git('merge-base', '--is-ancestor', catalog.revision, revision);\n const original = record(catalog.revision, catalog.source.file);\n assert.equal(original.mode, catalog.source.mode); assert.equal(original.blob, catalog.source.blob);\n assert.equal(original.sha256, catalog.source.rawSha256, 'Every historical catalog retains its exact committed source anchor');\n}\nfor (const [definition, expected] of [[BUSINESS_DESK_COMBINED_SOURCE, BUSINESS_DESK_COMBINED_SOURCE_SHA256],\n [BUSINESS_DESK_COMBINED_NATIVE, BUSINESS_DESK_COMBINED_NATIVE_SHA256],\n [BUSINESS_DESK_COMBINED_NATIVE_PARENTS, BUSINESS_DESK_COMBINED_NATIVE_PARENTS_SHA256]]) {\n assert.equal(definition.status, 'SEALED'); assert.equal(sha(JSON.stringify(definition)), expected);\n}\nassert.equal(BUSINESS_DESK_COMBINED_NATIVE.topSourceDefinitionSha256, BUSINESS_DESK_COMBINED_SOURCE_SHA256);\nassert.equal(BUSINESS_DESK_COMBINED_NATIVE.parentRegistryDefinitionSha256, BUSINESS_DESK_COMBINED_NATIVE_PARENTS_SHA256);\nfor (const definition of [BUSINESS_DESK_COMBINED_SOURCE, BUSINESS_DESK_COMBINED_NATIVE]) {\n git('merge-base', '--is-ancestor', definition.sourceRevision, revision);\n assert.equal(git('rev-parse', definition.sourceRevision + '^{tree}').toString().trim(), definition.sourceTree,\n  'Every combined comparison/provenance anchor is its exact committed tree');\n}\n",
              "baseline": ""
            },
            {
              "at": 6475,
              "current": "UX_BUSINESS_PREDECESSOR_METADATA)), ENTERPRISE_UX_BUSINESS_PREDECESSOR_METADATA_SHA256, 'Never reseal a rewritten frozen Deed record');\nconst value = { version: 7, status: 'SEALED', phase: 'ACTUAL_ENTERPRISE_ECONOMIC_BUSINESS_DESK",
              "baseline": "DEED_METADATA)), ENTERPRISE_DEED_METADATA_SHA256, 'Never reseal a rewritten Deed manifest');\nconst value = { version: 4, status: 'SEALED', phase: 'ACTUAL_ENTERPRISE_ECONOMIC_DEED"
            },
            {
              "at": 7017,
              "current": "economyDeedProvenanceDefinitionSha256: ECONOMY_DEED_MERGE_NATIVE_PROVENANCE_SHA256,\n wikiMergeSourceDefinitionSha256: WIKI_MEDIA_MERGE_SOURCE_SHA256,\n noirSourceDefinitionSha256: NOIR_UI_SOURCE_SHA256,\n noirMergeSourceDefinitionSha256: WIKI_MEDIA_NOIR_MERGE_SOURCE_SHA256,\n combinedSourceDefinitionSha256: BUSINESS_DESK_COMBINED_SOURCE_SHA256,\n combinedNativeDefinitionSha256: BUSINESS_DESK_COMBINED_NATIVE_SHA256,\n reviewedNativeRevision: reviewedRevision, reviewedNativeTree: reviewedTree,\n combinedNativeParentsDefinitionSha256: BUSINESS_DESK_COMBINED_NATIVE_PARENTS_SHA256",
              "baseline": "deedNativeMetadataSha256: sha(read(ENTERPRISE_DEED_METADATA)), economicNativeSourceSha256: sha(JSON.stringify(combinedEconomicDeedPin.nativeFiles))"
            },
            {
              "at": 7962,
              "current": "assertEconomicReleaseNativeDefinition(value);\n",
              "baseline": ""
            }
          ]
        },
        "main": {
          "pin": {
            "mode": "100644",
            "blob": "e0f8aacab1014963b15ecd3d6cab45babb1caeee",
            "sha256": "a5d0ef6841f72a517d91f52b5aeb5ed361b596d862c52825c0407c2fe4e22dff",
            "bytes": 8760
          },
          "inverses": [
            {
              "at": 1759,
              "current": "import { assertEconomicReleaseNativeDefinition } from './economic-release-native-provenance.js';\nimport { reviewedRevision, reviewedTree } from './economic-release-native-source.js';\n",
              "baseline": ""
            },
            {
              "at": 6611,
              "current": "const value = { version: 7, status: 'SEALED', phase: 'ACTUAL_ENTERPRISE_ECONOMIC_BUSINESS",
              "baseline": "assert.deepEqual(inventory, BUSINESS_DESK_COMBINED_NATIVE.nativeClosure, 'Combined native provenance covers the actual raw closure');\nconst changedExisting = files.filter(row => {\n const before = predecessorNativeInputs.files.find(old => old.file === row.file);\n return before && (before.mode !== row.mode || before.blob !== row.blob || before.sha256 !== row.sha256);\n}).sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);\nassert.deepEqual(changedExisting, BUSINESS_DESK_COMBINED_NATIVE.files.map(row => row.current),\n 'Every changed existing native provenance row exactly matches actual authored raw mode/blob/SHA before sealing');\nconst value = { version: 6, status: 'SEALED', phase: 'ACTUAL_ENTERPRISE_MONITOR_WIKI"
            },
            {
              "at": 7432,
              "current": " reviewedNativeRevision: reviewedRevision, reviewedNativeTree: reviewedTree,\n",
              "baseline": ""
            },
            {
              "at": 7962,
              "current": "assertEconomicReleaseNativeDefinition(value);\n",
              "baseline": ""
            }
          ]
        }
      }
    },
    "tools/enterprise-native-ux.js": {
      "current": {
        "mode": "100644",
        "blob": "a38cc7c689453a6fe050e210c5717c0bcf333292",
        "sha256": "97118ab64a10a710fd8715fca4183d34be1755dcc62ec0712129a12b08cd69fe",
        "bytes": 21005
      },
      "parents": {
        "economic": {
          "pin": {
            "mode": "100644",
            "blob": "6ca43f3bb5a7bb29502d679c29c889cbc4ee97e6",
            "sha256": "ff288ada71159928285072e8814b1cc92e8f4e035f1a386b546d8159eea1d36f",
            "bytes": 18432
          },
          "inverses": [
            {
              "at": 401,
              "current": "release-inputs",
              "baseline": "inputs.js';\nimport { ENTERPRISE_NATIVE_UX_INPUTS as DEED_NATIVE_INPUTS } from './enterprise-native-deed-inputs.js';\nimport { combinedEconomicDeedPin } from './combined-economic-deed-source-transfer"
            },
            {
              "at": 694,
              "current": "import { assertBusinessDeskCombinedNativeDefinition } from './businessdesk-combined-native-provenance.js';\nimport { BUSINESS_DESK_COMBINED_SOURCE, BUSINESS_DESK_COMBINED_SOURCE_SHA256 } from './businessdesk-combined-source-data.js';\nimport { BUSINESS_DESK_COMBINED_NATIVE_SHA256 } from './businessdesk-combined-native-data.js';\nimport { BUSINESS_DESK_COMBINED_NATIVE_PARENTS, BUSINESS_DESK_COMBINED_NATIVE_PARENTS_SHA256 } from './businessdesk-combined-native-parents.js';\nimport { ECONOMY_DEED_MERGE_NATIVE_PROVENANCE_SHA256 } from './economy-deed-merge-source-data.js';\nimport { WIKI_MEDIA_MERGE_SOURCE_SHA256, WIKI_MEDIA_NOIR_MERGE_SOURCE_SHA256 } from './wiki-media-source-data.js';\nimport { NOIR_UI_SOURCE_SHA256 } from './noir-ui-source-data.js';\nimport { assertEconomicReleaseNativeDefinition, economicReleaseNativeProvenance,\n assertReviewedNativePin } from './economic-release-native-provenance.js';\n",
              "baseline": ""
            },
            {
              "at": 2148,
              "current": "release-inputs.js",
              "baseline": "inputs.js';\nexport const ENTERPRISE_DEED_METADATA = 'tools/enterprise-native-deed-inputs.js';\nexport const ENTERPRISE_DEED_METADATA_SHA256 = '7dab84d91912e78448797e70dcf0fca4af19027a482d780c8557ae6a2293d311"
            },
            {
              "at": 2625,
              "current": "BUSINESS_PREDECESSOR_METADATA = 'tools/businessdesk-deed-native-inputs.js';\nexport const ENTERPRISE_UX_BUSINESS_PREDECESSOR_METADATA_SHA256 = '489be592435800a0d760592006327c624a0a043c15c059c858b9b3c5457755ff';\nexport const ENTERPRISE_UX_SUPPORT = Object.freeze([\n \"tools/enterprise-native-ux-b35-inputs.js\",\n \"tools/enterprise-native-ux-inputs.js\",\n \"tools/enterprise-native-ux.js\",\n \"tools/enterprise-native-ux-seal.js\",\n \"test/lib/enterprise-ux-native-guard.js\",\n \"test/ux-source-compatibility.js\",\n \"test/lib/ux-native-reader-source-compatibility.js\",\n \"tools/ux-director-reader-source-seal.js\",\n \"tools/ux-workflow-bound-source-seal.js\",\n \"tools/ux-phase2-upgrade-bound-source-seal.js\",\n \"tools/ux-suites-gate-source-seal.js\",\n \"tools/sale-source-seal.js\",\n \"test/sale-source-compatibility.js\",\n \"tools/generate-economy-social-proof-receipt-source-transfer.js\",\n \"tools/generate-economy-social-proof-receipt-safety-source-transfer.js\",\n \"tools/generate-economy-social-proof-cutover-source-transfer.js\",\n \"tools/generate-economy-bank-interest-source-transfer.js\",\n \"tools/pgquery.js\",\n \"test/social-receipt-postgres.js\",\n \"test/db-boot-lock-postgres.js\",\n \"tools/businessdesk-deed-native-inputs.js\",\n \"test/businessdesk.js\",\n \"test/businessdesk-api.js\",\n \"test/business-control-desk-loop.js\",\n \"test/business-control-desk-browser.js\",\n \"test/businessdesk-source-compatibility.js\",\n \"test/businessdesk-native-provenance.js\",\n \"tools/businessdesk-native-provenance.js\",\n \"test/businessdesk-consent-browser.js\",\n \"tools/generate-businessdesk-source-transfer.js\",\n \".github/workflows/economy-hardening.yml\",\n \"tools/generate-economy-monitor-source-transfer.js\",\n \"test/economy-monitor-source-compatibility.js\",\n \"test/economy-monitor.js\",\n \"test/economy-composition.js\",\n \"test/economy-composition-restart.js\",\n \"tools/generate-age-eligibility-source-transfer.js\",\n \"test/age-eligibility-source-compatibility.js\",\n \"test/age.js\",\n \"test/legal-security.js\",\n \"tools/economy-deed-merge-source-data.js\",\n \"tools/economy-deed-merge-source-compatibility.js\",\n \"tools/generate-economy-deed-merge-source.js\",\n \"test/economy-deed-merge-source-compatibility.js\",\n \"tools/noir-ui-source-data.js\",\n \"tools/noir-ui-source-transfer.js\",\n \"tools/generate-noir-ui-source-transfer.js\",\n \"test/noir-ui-source-compatibility.js\",\n \"test/ux-expanded-browser.js\",\n \"tools/businessdesk-combined-source-data.js\",\n \"tools/businessdesk-combined-source-transfer.js\",\n \"tools/generate-businessdesk-combined-source.js\",\n \"test/businessdesk-combined-source-compatibility.js\",\n \"tools/businessdesk-desk-parent-native-inputs.js\",\n \"tools/businessdesk-monitor-parent-native-inputs.js\",\n \"tools/businessdesk-wiki-parent-native-inputs.js\",\n \"tools/businessdesk-combined-native-parents.js\",\n \"tools/businessdesk-combined-native-data.js\",\n \"tools/businessdesk-combined-native-provenance.js\",\n \"tools/generate-businessdesk-combined-native.js\",\n \"test/businessdesk-combined-native-provenance.js\",\n \"test/launch-invites-browser.js\",\n \"test/wallet-connect-browser.js\",\n \"tools/mobile.js\",\n \"tools/public-ui.js\",\n \"tools/generate-current-economic-terms-source-transfer.js\",\n \"tools/generate-combined-economic-deed-source-transfer.js\",\n \"test/economy-ux-merge-source-compatibility.js\",\n \"test/inventory-bond-checkout.js\"\n",
              "baseline": "SUPPORT = Object.freeze([ENTERPRISE_UX_PREDECESSOR_METADATA, ENTERPRISE_UX_QUALIFIED_METADATA, ENTERPRISE_DEED_METADATA, 'tools/enterprise-native-ux.js', 'tools/enterprise-native-ux-seal.js', 'test/lib/enterprise-ux-native-guard.js', 'test/ux-source-compatibility.js', 'test/lib/ux-native-reader-source-compatibility.js', 'tools/ux-director-reader-source-seal.js', 'tools/ux-workflow-bound-source-seal.js', 'tools/ux-phase2-upgrade-bound-source-seal.js', 'tools/ux-suites-gate-source-seal.js', 'tools/sale-source-seal.js', 'test/sale-source-compatibility.js', 'tools/generate-economy-social-proof-receipt-source-transfer.js', 'tools/generate-economy-social-proof-receipt-safety-source-transfer.js', 'tools/generate-economy-social-proof-cutover-source-transfer.js', 'tools/generate-economy-bank-interest-source-transfer.js', 'tools/generate-current-economic-terms-source-transfer.js', 'tools/generate-combined-economic-deed-source-transfer.js', 'test/economy-ux-merge-source-compatibility.js', 'test/inventory-bond-checkout.js', 'tools/pgquery.js', 'test/social-receipt-postgres.js', 'test/db-boot-lock-postgres.js'"
            },
            {
              "at": 5960,
              "current": "\"public/ux-feedback.js\",\n \"public/ux-feedback.css\",\n \"public/ux-progression.js\",\n \"public/ux-progression.css\",\n \"public/ux-social.js\",\n \"public/ux-social.css\",\n \"public/ux-navigation.js\",\n \"public/ux-navigation.css\",\n \"public/ux-workspace.js\",\n \"public/ux-world.js\",\n \"public/ux-world.css\",\n \"public/ux-tactics.js\",\n \"public/ux-tactics.css\",\n \"public/ux-investigation.js\",\n \"public/ux-investigation.css\",\n \"public/ux-coordination.js\",\n \"public/ux-coordination.css\",\n \"public/ux-feel.js\",\n \"public/ux-feel.css\",\n \"public/ux-tools.js\",\n \"public/ux-tools.css\",\n \"public/ux-identity.js\",\n \"public/ux-identity.css\",\n \"public/ux-story.js\",\n \"public/ux-story.css\",\n \"public/ux-community.js\",\n \"public/ux-community.css\",\n \"public/sale.html\",\n \"public/inventory-bond-client.js\",\n \"public/business-control-desk.js\",\n \"public/business-control-desk.css\",\n \"public/art/nft/deed-docks.jpg\",\n \"public/art/nft/deed-neon.jpg\",\n \"public/art/nft/deed-foundry.jpg\",\n \"public/art/nft/deed-brick.jpg\",\n \"public/art/nft/deed-canal.jpg\",\n \"public/art/nft/deed-cathedral.jpg\"",
              "baseline": "...['feedback', 'progression', 'social', 'navigation', 'workspace', 'world', 'tactics', 'investigation', 'coordination', 'feel', 'tools', 'identity', 'story', 'community'].flatMap(name => ['public/ux-' + name + '.js', ...(name === 'workspace' ? [] : ['public/ux-' + name + '.css'])]),\n 'public/sale.html', 'public/inventory-bond-client.js',\n ...['docks', 'neon', 'foundry', 'brick', 'canal', 'cathedral'].map(district => 'public/art/nft/deed-' + district + '.jpg'),"
            },
            {
              "at": 14130,
              "current": "\"economyDeedProvenanceDefinitionSha256\", \"wikiMergeSourceDefinitionSha256\", \"noirSourceDefinitionSha256\", \"noirMergeSourceDefinitionSha256\", \"combinedSourceDefinitionSha256\", \"combinedNativeDefinitionSha256\", \"combinedNativeParentsDefinitionSha256\", \"reviewedNativeRevision\", \"reviewedNativeTree\", 'files', 'replacements', 'legacyAdditionReplacements', 'additions']);\n assert.equal(declaration.version, 7); assert.equal(declaration.phase, 'ACTUAL_ENTERPRISE_ECONOMIC_BUSINESS_DESK_NATIVE_INPUTS');\n assert.equal(declaration.economyDeedProvenanceDefinitionSha256, ECONOMY_DEED_MERGE_NATIVE_PROVENANCE_SHA256);\n assert.equal(declaration.wikiMergeSourceDefinitionSha256, WIKI_MEDIA_MERGE_SOURCE_SHA256);\n assert.equal(declaration.noirSourceDefinitionSha256, NOIR_UI_SOURCE_SHA256);\n assert.equal(declaration.noirMergeSourceDefinitionSha256, WIKI_MEDIA_NOIR_MERGE_SOURCE_SHA256);\n assert.equal(declaration.combinedSourceDefinitionSha256, BUSINESS_DESK_COMBINED_SOURCE_SHA256);\n assert.equal(declaration.combinedNativeDefinitionSha256, BUSINESS_DESK_COMBINED_NATIVE_SHA256);\n assert.equal(declaration.combinedNativeParentsDefinitionSha256, BUSINESS_DESK_COMBINED_NATIVE_PARENTS_SHA256);\n assert.equal(BUSINESS_DESK_COMBINED_SOURCE.status, 'SEALED');\n assertBusinessDeskCombinedNativeDefinition(",
              "baseline": "'deedNativeMetadataSha256', 'economicNativeSourceSha256', 'files', 'replacements', 'legacyAdditionReplacements', 'additions']);\n assert.equal(declaration.version, 4); assert.equal(declaration.phase, 'ACTUAL_ENTERPRISE_ECONOMIC_DEED_NATIVE_INPUTS');\n assert.equal(declaration.deedNativeMetadataSha256, ENTERPRISE_DEED_METADATA_SHA256);\n assert.equal(declaration.economicNativeSourceSha256, digest(JSON.stringify(combinedEconomicDeedPin.nativeFiles))"
            },
            {
              "at": 17649,
              "current": "UX_BUSINESS_PREDECESSOR_METADATA)?.sha256, ENTERPRISE_UX_BUSINESS_PREDECESSOR_METADATA_SHA256, 'The frozen Deed record is an exact ordinary input, never another self-reference');\n for (const parent of Object.values(BUSINESS_DESK_COMBINED_NATIVE_PARENTS.profiles)) {\n  const actual = current.get(parent.archiveFile);\n  assert(actual, 'Every exact frozen parent descriptor is an ordinary input');\n  assert.equal(actual.mode, parent.original.mode); assert.equal(actual.blob, parent.original.blob);\n  assert.equal(actual.sha256, parent.original.rawSha256, 'Never admit a rewritten parent archive');\n }\n assertEconomicReleaseNativeDefinition(declaration",
              "baseline": "DEED_METADATA)?.sha256, ENTERPRISE_DEED_METADATA_SHA256, 'Preserve the qualified Deed native manifest');\n const changedFromDeed = DEED_NATIVE_INPUTS.files.filter(row => {\n  const actual = current.get(row.file); assert(actual, 'Missing existing Deed native input: ' + row.file);\n  return changedPin(row, actual);\n }).map(row => row.file).sort();\n assert.deepEqual(Object.keys(combinedEconomicDeedPin.nativeFiles).sort(), changedFromDeed, 'Reviewed transitions must cover exactly the changed Deed inputs'"
            },
            {
              "at": 20911,
              "current": "assertReviewedNativePin(expected);\n return economicReleaseNativeProvenance(file, expected",
              "baseline": "const previous = PREDECESSOR_NATIVE_INPUTS.files.find(row => row.file === file);\n const deed = DEED_NATIVE_INPUTS.files.find(row => row.file === file);\n assert(!previous || deed, 'Existing B35 native input is missing from Deed admission: ' + file);\n let deedProvenance = null;\n if (previous && deed && changedPin(previous, deed)) {\n  const sourcePin = DEED_ALLOCATION_SOURCE_DOMAINS[file];\n  assert(sourcePin, 'No unreviewed Deed change to an existing native input: ' + file);\n  assert.equal(deed.mode, sourcePin.currentMode); assert.equal(deed.blob, sourcePin.currentBlob);\n  assert.equal(deed.sha256, sourcePin.currentSha256);\n  assert.equal(previous.mode, sourcePin.baselineMode); assert.equal(previous.blob, sourcePin.baselineBlob);\n  assert.equal(previous.sha256, sourcePin.baselineSha256);\n  deedProvenance = Object.freeze({ file, current: deed, predecessor: previous,\n   predecessorRevision: PREDECESSOR_NATIVE_INPUTS.authoredRevision, relation: 'exact-reviewed-deed-source-provenance-only',\n   nativeAdmission: false, priorResultsTransferred: false });\n }\n if (!deed || !changedPin(deed, expected)) return deedProvenance;\n const transition = combinedEconomicDeedPin.nativeFiles[file];\n assert(transition, 'No unreviewed economic change to an existing Deed native input: ' + file);\n for (const key of ['mode', 'blob', 'sha256']) {\n  assert.equal(transition.baseline[key], deed[key], 'Economic native predecessor: ' + file);\n  assert.equal(transition.current[key], expected[key], 'Economic native input: ' + file);\n }\n return Object.freeze({ file, current: expected, predecessor: deed, predecessorRevision: DEED_NATIVE_INPUTS.authoredRevision,\n  relation: 'exact-reviewed-economic-deed-source-provenance-only', deedProvenance, nativeAdmission: false, priorResultsTransferred: false }"
            }
          ]
        },
        "main": {
          "pin": {
            "mode": "100644",
            "blob": "0ad8d9cdfc247f7df7e0feb63fa6c5ae258924f5",
            "sha256": "af3cc87d05c9053ada09ef4957f547639dd1536b5dbb55eee64096c1807048ea",
            "bytes": 20163
          },
          "inverses": [
            {
              "at": 218,
              "current": "import { fileURLToPath } from 'node:url';\n",
              "baseline": ""
            },
            {
              "at": 392,
              "current": "economic-release",
              "baseline": "deed"
            },
            {
              "at": 703,
              "current": "",
              "baseline": "businessDeskCombinedNativeProvenance, "
            },
            {
              "at": 1447,
              "current": "import { assertEconomicReleaseNativeDefinition, economicReleaseNativeProvenance,\n assertReviewedNativePin } from './economic-release-native-provenance.js';\n// Refuse ambient checkout manifests before a native parent can connect or launch any of its sixteen children.\nif (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(new URL('./enterprise-native.js', import.meta.url))) {\n  for (const key of Object.keys(process.env)) {\n    assert(!/^INVENTORY_BOND_MANIFEST_(?:PATH|SHA256)$/i.test(key), 'Inventory bond manifest forbidden during native qualification: ' + key);\n  }\n}\n",
              "baseline": ""
            },
            {
              "at": 2139,
              "current": "economic-release",
              "baseline": "deed"
            },
            {
              "at": 5694,
              "current": ",\n \"tools/generate-current-economic-terms-source-transfer.js\",\n \"tools/generate-combined-economic-deed-source-transfer.js\",\n \"test/economy-ux-merge-source-compatibility.js\",\n \"test/inventory-bond-checkout.js\"",
              "baseline": ""
            },
            {
              "at": 6694,
              "current": " \"public/inventory-bond-client.js\",\n",
              "baseline": ""
            },
            {
              "at": 14380,
              "current": "\"reviewedNativeRevision\", \"reviewedNativeTree\", 'files', 'replacements', 'legacyAdditionReplacements', 'additions']);\n assert.equal(declaration.version, 7); assert.equal(declaration.phase, 'ACTUAL_ENTERPRISE_ECONOMIC_BUSINESS",
              "baseline": "'files', 'replacements', 'legacyAdditionReplacements', 'additions']);\n assert.equal(declaration.version, 6); assert.equal(declaration.phase, 'ACTUAL_ENTERPRISE_MONITOR_WIKI"
            },
            {
              "at": 18247,
              "current": " assertEconomicReleaseNativeDefinition(declaration);\n",
              "baseline": ""
            },
            {
              "at": 20911,
              "current": "assertReviewedNativePin(expected);\n return economicReleaseNativeProvenance(file",
              "baseline": "const previous = PREDECESSOR_NATIVE_INPUTS.files.find(row => row.file === file);\n if (!previous || !changedPin(previous, expected)) return null;\n return businessDeskCombinedNativeProvenance(file, previous"
            }
          ]
        }
      }
    },
    "tools/ux-release-phase2-native-catalog.js": {
      "current": {
        "mode": "100644",
        "blob": "46c727886b2a773f13e6ac8f37da48f2e745c150",
        "sha256": "b90d784c72f4e9167be1df50171360dab04f361152e4a54cda96362de24cb331",
        "bytes": 33311
      },
      "parents": {
        "economic": {
          "pin": {
            "mode": "100644",
            "blob": "14beaa6ac20acf452d911791b9cc45552e4fadf5",
            "sha256": "ebfc9dc7e4f990415a8f9795e151d9c8234f7deac3559c8df961c1f1b44b4c5e",
            "bytes": 30199
          },
          "inverses": [
            {
              "at": 3463,
              "current": "const monitorIndexName = 'ix_tx_at_id';\nconst isMonitorIndexRow = (field, row) => field === 'indexes' && row.table_name === 'transactions' && row.name === monitorIndexName;\nconst monitorRows = (metadata, field) => metadata[field].filter(row => isMonitorIndexRow(field, row));\n",
              "baseline": ""
            },
            {
              "at": 4128,
              "current": ", monitor",
              "baseline": ""
            },
            {
              "at": 5258,
              "current": "  const indexAt = merged.indexes.findIndex(row => row.table_name === 'transactions' && row.name === 'ix_tx_character');\n  assert(indexAt >= 0, 'The monitor index precedes the exact predecessor transaction index');\n  merged.indexes.splice(indexAt, 0, ...monitor.indexes);\n",
              "baseline": ""
            },
            {
              "at": 9612,
              "current": "monitor, benefitNative, storeRevenue) {\n  const uxProjection = uxNativeProjection(ux), socialBridgeProjection = socialLegacyBridgeProjection(socialBridge),\n    monitorProjection = monitorNativeProjection(monitor);\n  const projectMetadata = metadata => monitorProjection.projectMetadata(socialBridgeProjection.projectMetadata(\n    uxProjection.projectMetadata(benefitNative.projectMetadata(storeRevenue.projectMetadata(metadata)",
              "baseline": "benefitNative, storeRevenue) {\n  const uxProjection = uxNativeProjection(ux), socialBridgeProjection = socialLegacyBridgeProjection(socialBridge);\n  const projectMetadata = metadata => socialBridgeProjection.projectMetadata(uxProjection.projectMetadata(benefitNative.projectMetadata(storeRevenue.projectMetadata(metadata"
            },
            {
              "at": 11196,
              "current": "    const monitorSelected = monitorRows({ [field]: result.rows }, field).map(row => {\n      const prefix = ' ON ' + context.schema + '.'; assert.equal(row.definition.split(prefix).length, 2);\n      return { ...row, definition: row.definition.replace(prefix, ' ON $self.') };\n    });\n    assert.deepEqual(monitorSelected, monitor[field], 'Every fresh projected SQL result retains the exact monitor ' + field);\n",
              "baseline": ""
            },
            {
              "at": 12316,
              "current": "!isMonitorIndexRow(field, row) && ",
              "baseline": ""
            },
            {
              "at": 15125,
              "current": "    // Compile the monitor index independently of schema.sql and the migrated caller. Only this\n    // exact additive index is projected from the unchanged predecessor's complete catalog proof.\n",
              "baseline": ""
            },
            {
              "at": 15966,
              "current": "\n      + '\\nCREATE TABLE transactions (at TIMESTAMPTZ, id TEXT);\\nCREATE INDEX ix_tx_at_id ON transactions (at, id);'",
              "baseline": ""
            },
            {
              "at": 16309,
              "current": "'transactions', ...UX_NATIVE_TABLES],\n      'Independent immutable DDL creates exactly the FK target, current marker, social bridge, Store and monitor",
              "baseline": "...UX_NATIVE_TABLES],\n      'Independent DDL creates exactly the FK target, current marker, social bridge and Store"
            },
            {
              "at": 18430,
              "current": "    const monitor = Object.fromEntries(fields.map(field => [field, monitorRows(reference, field)]));\n    assert.deepEqual(monitor.indexes, [{ table_name: 'transactions', name: monitorIndexName,\n      definition: 'CREATE INDEX ix_tx_at_id ON $self.transactions USING btree (at, id)',\n      unique: false, primary: false, valid: true, ready: true, live: true, nulls_not_distinct: false, predicate: null }],\n    'Independent fixed DDL compiles the exact complete monitor index catalog row');\n",
              "baseline": ""
            },
            {
              "at": 19230,
              "current": "monitor, ",
              "baseline": ""
            },
            {
              "at": 24288,
              "current": "export function monitorNativeProjection(reference) {\n  reference = freeze(structuredClone(reference));\n  assert.equal(reference.relations.length + reference.columns.length + reference.constraints.length, 0);\n  assert.equal(reference.indexes.length, 1);\n  assert(isMonitorIndexRow('indexes', reference.indexes[0]));\n  const projectMetadata = metadata => {\n    for (const field of fields) assert.deepEqual(monitorRows(metadata, field), reference[field],\n      'Exact independently compiled monitor ' + field);\n    return Object.fromEntries(fields.map(field => [field, metadata[field].filter(row => !isMonitorIndexRow(field, row))]));\n  };\n  return Object.freeze({ projectMetadata });\n}\nfunction extendCatalog(prior, ux, socialBridge, monitor",
              "baseline": "function extendCatalog(prior, ux, socialBridge"
            },
            {
              "at": 25198,
              "current": "monitorProjection = monitorNativeProjection(monitor),\n    projectMetadata = metadata => monitorProjection.projectMetadata(socialBridgeProjection.projectMetadata(\n      uxProjection.projectMetadata(benefitNative.projectMetadata(storeRevenue.projectMetadata(metadata))))),\n    base = branches ? prior.current : prior.reference, reference = storeRevenue.extendReference(benefitNative.extendReference(merge(base, socialBridge, ux, monitor",
              "baseline": "projectMetadata = metadata => socialBridgeProjection.projectMetadata(uxProjection.projectMetadata(benefitNative.projectMetadata(storeRevenue.projectMetadata(metadata)))),\n    base = branches ? prior.current : prior.reference, reference = storeRevenue.extendReference(benefitNative.extendReference(merge(base, socialBridge, ux"
            },
            {
              "at": 25845,
              "current": ", monitor: 0",
              "baseline": ""
            },
            {
              "at": 26079,
              "current": "    ['monitor', monitor, monitorNativeProjection],\n",
              "baseline": ""
            },
            {
              "at": 26141,
              "current": "const field = fields.find(field => extension[field].length), key = Object.keys(extension[field][0])[0];\n    assert.throws(() => { extension[field][0][key]",
              "baseline": "assert.throws(() => { extension.columns[0].type"
            },
            {
              "at": 26426,
              "current": "[field][0][key] = 'tampered';\n    const integrated = benefitNative.extendReference(merge(base, label === 'socialBridge' ? retained : socialBridge,\n      label === 'ux' ? retained : ux, label === 'monitor' ? retained : monitor",
              "baseline": ".columns[0].type = 'tampered';\n    const integrated = benefitNative.extendReference(label === 'socialBridge' ? merge(base, retained, ux) : merge(base, socialBridge, retained"
            },
            {
              "at": 26891,
              "current": ", ['monitor', monitor]",
              "baseline": ""
            },
            {
              "at": 30951,
              "current": "    monitorReference: monitor, monitorCausal: causal.monitor,\n",
              "baseline": ""
            },
            {
              "at": 32260,
              "current": "monitor, ",
              "baseline": ""
            },
            {
              "at": 32506,
              "current": "monitor, benefitNative, storeRevenue), endpoint, candidate, options);\n  return extendCatalog(prior, ux, socialBridge, monitor",
              "baseline": "benefitNative, storeRevenue), endpoint, candidate, options);\n  return extendCatalog(prior, ux, socialBridge"
            },
            {
              "at": 32938,
              "current": "monitor, ",
              "baseline": ""
            },
            {
              "at": 33155,
              "current": "monitor, benefitNative, storeRevenue), endpoint, candidate);\n  return extendCatalog(prior, ux, socialBridge, monitor",
              "baseline": "benefitNative, storeRevenue), endpoint, candidate);\n  return extendCatalog(prior, ux, socialBridge"
            }
          ]
        },
        "main": {
          "pin": {
            "mode": "100644",
            "blob": "9627018aedc2700e1cd4a9dc06a3a9c0c100d87d",
            "sha256": "d59e8b81c8ce0ac2caeb3301d164914a4d7a452b3a2b1103060017c08878eb7b",
            "bytes": 28584
          },
          "inverses": [
            {
              "at": 1284,
              "current": "const storeRevenueTable = 'store_payments', storeRevenueColumn = 'revenue_split';\nconst isStoreRevenueColumn = row => row.table_name === storeRevenueTable && row.column_name === storeRevenueColumn;\nconst storeTrailingColumns = ['account_id', 'granted', 'created_at'];\n",
              "baseline": ""
            },
            {
              "at": 9634,
              "current": ", storeRevenue",
              "baseline": ""
            },
            {
              "at": 10001,
              "current": "storeRevenue.projectMetadata(metadata)",
              "baseline": "metadata"
            },
            {
              "at": 12202,
              "current": "const rows = result.rows.filter(row => !names.has(tableOf(field, row)) && !isSocialBridgeRow(field, row)\n      && !isMonitorIndexRow(field, row) && tableOf(field, row) !== DEED_BENEFIT_NATIVE_TABLE);\n    return { ...result, rows: field === 'columns' ? storeRevenue.projectColumns(rows) : rows",
              "baseline": "return { ...result, rows: result.rows.filter(row => !names.has(tableOf(field, row)) && !isSocialBridgeRow(field, row)\n      && !isMonitorIndexRow(field, row) && tableOf(field, row) !== DEED_BENEFIT_NATIVE_TABLE)"
            },
            {
              "at": 14015,
              "current": ", profile) {\n  assert(['fresh', 'phase2', 'director'].includes(profile));",
              "baseline": ") {"
            },
            {
              "at": 15369,
              "current": "const storeDdl = `CREATE TABLE store_payments (\n      nonce BIGINT PRIMARY KEY, sku TEXT NOT NULL, payer_address TEXT NOT NULL,\n      amount_wei TEXT NOT NULL, tx_hash TEXT, ${profile === 'fresh' ? 'revenue_split JSONB,' : ''}\n      account_id TEXT, granted BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n    );` + (profile === 'fresh' ? '' : '\\nALTER TABLE store_payments ADD COLUMN revenue_split JSONB;');\n    await client.query('CREATE TABLE characters (id TEXT PRIMARY KEY);\\n' + DEED_BENEFIT_NATIVE_DDL + ';\\n' + socialBridgeDdl + '\\n' + stor",
              "baseline": "await client.query('CREATE TABLE characters (id TEXT PRIMARY KEY);\\n' + DEED_BENEFIT_NATIVE_DDL + ';\\n' + socialBridg"
            },
            {
              "at": 16263,
              "current": "storeRevenueTable, DEED_BENEFIT_NATIVE_TABLE, 'transactions', ...UX_NATIVE_TABLES],\n      'Independent immutable DDL creates exactly the FK target, current marker, social bridge, Store and monitor fixtures",
              "baseline": "DEED_BENEFIT_NATIVE_TABLE, 'transactions', ...UX_NATIVE_TABLES],\n      'Independent immutable DDL creates exactly the FK target, current marker, social bridge, monitor fixture"
            },
            {
              "at": 19084,
              "current": "const storeRevenue = storeRevenueNativeProjection(reference.columns.filter(isStoreRevenueColumn), profile);\n    return freeze({ ux, socialBridge, monitor, benefitNative, storeRevenu",
              "baseline": "return freeze({ ux, socialBridge, monitor, benefitNativ"
            },
            {
              "at": 19557,
              "current": "function storeRevenueNativeProjection(reference, profile) {\n  const fresh = profile === 'fresh';\n  assert.deepEqual(reference, [{ table_name: storeRevenueTable, column_name: storeRevenueColumn,\n    ordinal: fresh ? 6 : 9, type: 'jsonb', typmod: -1, default_expression: null, not_null: false,\n    identity: '', generated: '', collation_schema: null, collation_name: null }],\n  'Independent Store DDL yields exactly the nullable JSONB receipt column at its fresh or upgrade ordinal');\n  reference = freeze(structuredClone(reference));\n  const projectColumns = columns => {\n    assert.deepEqual(columns.filter(isStoreRevenueColumn), reference, 'The complete Store receipt column remains exact before historical projection');\n    let shifted = 0;\n    const projected = columns.filter(row => !isStoreRevenueColumn(row)).map(row => {\n      const index = row.table_name === storeRevenueTable ? storeTrailingColumns.indexOf(row.column_name) : -1;\n      if (!fresh || index < 0) return row;\n      assert.equal(row.ordinal, index + 7, 'Only the three exact fresh Store columns follow the new receipt column');\n      shifted++; return { ...row, ordinal: row.ordinal - 1 };\n    });\n    assert.equal(shifted, fresh ? 3 : 0);\n    return projected;\n  };\n  const projectMetadata = metadata => ({ ...metadata, columns: projectColumns(metadata.columns) });\n  const extendReference = base => {\n    assert.deepEqual(base.columns.filter(row => row.table_name === storeRevenueTable).map(row => [row.column_name, row.ordinal]),\n      ['nonce', 'sku', 'payer_address', 'amount_wei', 'tx_hash', ...storeTrailingColumns].map((name, index) => [name, index + 1]),\n      'The unchanged historical oracle has exactly the eight original Store columns');\n    const columns = base.columns.map(row => fresh && row.table_name === storeRevenueTable && storeTrailingColumns.includes(row.column_name)\n      ? { ...row, ordinal: row.ordinal + 1 } : row);\n    const at = columns.findIndex(row => row.table_name === storeRevenueTable && row.column_name === (fresh ? 'tx_hash' : 'created_at'));\n    assert(at >= 0); columns.splice(at + 1, 0, ...reference);\n    return freeze({ ...base, columns });\n  };\n  return Object.freeze({ reference, projectColumns, projectMetadata, extendReference });\n}\n",
              "baseline": ""
            },
            {
              "at": 25044,
              "current": "storeRevenue, ",
              "baseline": ""
            },
            {
              "at": 25425,
              "current": "storeRevenue.projectMetadata(metadata))))),\n    base = branches ? prior.current : prior.reference, reference = storeRevenue.extendReference(benefitNative.extendReference(merge(base, socialBridge, ux, monitor)",
              "baseline": "metadata)))),\n    base = branches ? prior.current : prior.reference, reference = benefitNative.extendReference(merge(base, socialBridge, ux, monitor"
            },
            {
              "at": 29552,
              "current": "  let storeRevenueCausal = 0;\n  const receipt = storeRevenue.reference[0], at = reference.columns.indexOf(receipt);\n  assert(at >= 0);\n  const rejectStore = columns => { assert.throws(() => verifyMetadata({ ...reference, columns }), error => error?.code === 'ERR_ASSERTION'); storeRevenueCausal++; };\n  rejectStore(reference.columns.filter((_, index) => index !== at));\n  rejectStore([...reference.columns, { ...receipt }]);\n  for (const key of Object.keys(receipt)) {\n    const value = receipt[key], changed = { ...receipt, [key]: typeof value === 'boolean' ? !value\n      : typeof value === 'number' ? value + 1 : value === null ? 'unknown' : value + '__unknown' };\n    rejectStore(reference.columns.map((row, index) => index === at ? changed : row));\n  }\n  for (const column of storeTrailingColumns) rejectStore(reference.columns.map(row =>\n    row.table_name === storeRevenueTable && row.column_name === column ? { ...row, ordinal: row.ordinal + 1 } : row));\n  assert.equal(storeRevenueCausal, Object.keys(receipt).length + 5, 'Store receipt missing, duplicate, every field and all three adjacent ordinal mutations are refused');\n",
              "baseline": ""
            },
            {
              "at": 31081,
              "current": ",\n    storeRevenueReference: storeRevenue.reference, storeRevenueCausal",
              "baseline": ""
            },
            {
              "at": 32282,
              "current": ", storeRevenue } = await compileCurrentExtensionReference(pool, endpoint, options.legacyProfile",
              "baseline": " } = await compileCurrentExtensionReference(pool, endpoint"
            },
            {
              "at": 32528,
              "current": ", storeRevenue), endpoint, candidate, options);\n  return extendCatalog(prior, ux, socialBridge, monitor, benefitNative, storeRevenu",
              "baseline": "), endpoint, candidate, options);\n  return extendCatalog(prior, ux, socialBridge, monitor, benefitNativ"
            },
            {
              "at": 32960,
              "current": ", storeRevenue } = await compileCurrentExtensionReference(pool, endpoint, 'fresh'",
              "baseline": " } = await compileCurrentExtensionReference(pool, endpoint"
            },
            {
              "at": 33177,
              "current": ", storeRevenue), endpoint, candidate);\n  return extendCatalog(prior, ux, socialBridge, monitor, benefitNative, storeRevenu",
              "baseline": "), endpoint, candidate);\n  return extendCatalog(prior, ux, socialBridge, monitor, benefitNativ"
            }
          ]
        }
      }
    },
    "AGENTS.md": {
      "current": {
        "mode": "100644",
        "blob": "627700e8c897578951ef5ee94f4938fe41800cbc",
        "sha256": "f5d101cba3010c710cd0d64246fb4b0c080e9632bc7496b582cca8e05dec55b8",
        "bytes": 49646
      },
      "parents": {
        "main": {
          "pin": {
            "mode": "100644",
            "blob": "40a764e3fc39a7c93d2c0d8797913f6f9e9d4444",
            "sha256": "ffd42e51acb2b06b12b4ac7132f5fd4c4ae2f29f63720b9e7d3931d3fe7b79b4",
            "bytes": 49584
          },
          "inverses": [
            {
              "at": 36775,
              "current": "character mint. Use the current\n   ETH fee quoted by `OmertaFees` or an earned mission credit, then call `POST",
              "baseline": "mint. Pay the mint\n   fee on-chain (the `OmertaFees` tollbooth) and call `POST\n  "
            },
            {
              "at": 37106,
              "current": "The server signs only within its recorded reserve capacity. A withdrawal can queue for capacity.\n   The wallet receives the net amount after the configured withdrawal toll and age-based surcharge when the voucher is redeemed",
              "baseline": "Withdrawals\n   are full-reserve backed (extraction ≤ inflow, by construction), so a large\n   withdrawal may queue until the reserve funds"
            },
            {
              "at": 42869,
              "current": "the account has minted its character",
              "baseline": "paid the identity mint fee, currently 0.01 ETH, wave 1 of the published tranche schedule"
            }
          ]
        }
      }
    },
    "MARKETING-POSTS.md": {
      "current": {
        "mode": "100644",
        "blob": "989796d7b5c64fe60a44c6448384fa760a5497fc",
        "sha256": "5ee66cb1aeb501cd3e6b0fa9c65059e26349b90ed23bb49ba0b59c9f42793dfb",
        "bytes": 7062
      },
      "parents": {
        "main": {
          "pin": {
            "mode": "100644",
            "blob": "9b960bbe87c664c0e54eae4476530ba74bd962f9",
            "sha256": "e7c789e105a5edf0259b1a5426c7313bf987e426b6c01b1d514863162562f464",
            "bytes": 7062
          },
          "inverses": [
            {
              "at": 1308,
              "current": "60",
              "baseline": "56"
            },
            {
              "at": 2712,
              "current": "2",
              "baseline": "1"
            },
            {
              "at": 4371,
              "current": "60",
              "baseline": "56"
            }
          ]
        }
      }
    },
    "SPEC.md": {
      "current": {
        "mode": "100644",
        "blob": "6848cba281d30a27dfedca01b7ac8f53f6e3fe9c",
        "sha256": "0591dcb9ae261fcabaf9be2c1cacbfdacbd834adadf2f2ecb7e41c21a5c0eecc",
        "bytes": 57077
      },
      "parents": {
        "main": {
          "pin": {
            "mode": "100644",
            "blob": "39b584b0e34c3cb2b5c8e303af4aa801672c1999",
            "sha256": "c1fbe15ec7dd0bbce78cd43c76c97379eaff98a2111f9c845a806309563f53ba",
            "bytes": 57077
          },
          "inverses": [
            {
              "at": 427,
              "current": "7** files, **138652** lines (recursive source inventory) |\n| Test suites | **972** files, **205772** lines (recursive source inventory) |\n| HTTP routes | **1360** registrations (**1360** unique; 1260 under `/v1`) |\n| Database tables | **582** (`schema.sql`, 9787 lines) |\n| Client | **14647",
              "baseline": "6** files, **138522** lines (recursive source inventory) |\n| Test suites | **971** files, **205080** lines (recursive source inventory) |\n| HTTP routes | **1356** registrations (**1356** unique; 1260 under `/v1`) |\n| Database tables | **582** (`schema.sql`, 9784 lines) |\n| Client | **14638"
            },
            {
              "at": 1799,
              "current": "1** markdown files, **156942",
              "baseline": "0** markdown files, **156909"
            },
            {
              "at": 2060,
              "current": "6",
              "baseline": "5"
            }
          ]
        }
      }
    },
    "public/sale.html": {
      "current": {
        "mode": "100644",
        "blob": "09cc60309bdee3674415625c1371aa6eb7e4d9d2",
        "sha256": "77f4ae77545f7cc107af791db0020024db48625b429d712f9c5a68743ae55a2b",
        "bytes": 29932
      },
      "parents": {
        "main": {
          "pin": {
            "mode": "100644",
            "blob": "6e24725980377c963619bc00c813da0819e564e8",
            "sha256": "639d41062a3f6b0744ae6553b4b6ae03cd31d7c9625204841cd51ac8993378ce",
            "bytes": 29713
          },
          "inverses": [
            {
              "at": 14951,
              "current": "One five-day auction offers 40 million OMR from the 100 million supply. The graduation minimum is 10 ETH. Check the verified opening and closing blocks before bidding.</p></li>\n      <li><span class=\"sale-step__number\" aria-hidden=\"true\">02</span><h3>Enter the auction</h3><p>When bidding opens, use a wallet that holds a character NFT. Paid and free-credit character mints both qualify. Review the bid before signing.</p></li>\n      <li><span class=\"sale-step__number\" aria-hidden=\"true\">03</span><h3>Follow the settlement</h3><p>After a successful close, exit the bid and claim its filled OMR. Unused bid ETH is refundable. If graduation fails, bidders can reclaim their deposited ETH",
              "baseline": "Review the allocation, bidding window and auction rules once launch details are published.</p></li>\n      <li><span class=\"sale-step__number\" aria-hidden=\"true\">02</span><h3>Enter the auction</h3><p>When bidding opens, follow the auction link to connect your wallet and review your bid.</p></li>\n      <li><span class=\"sale-step__number\" aria-hidden=\"true\">03</span><h3>Follow the settlement</h3><p>Check the auction outcome and follow its instructions for claiming tokens or refunds"
            },
            {
              "at": 18172,
              "current": "The city has 2,500 permanent Street Deeds across six districts. Players can earn 1,000 through gameplay from level 25. Another 1,000 are reserved for paid minting and 500 for partnerships",
              "baseline": "2,500 permanent Street Deed identities across six districts: 1,000 earned through gameplay from Level 25, 1,000 allocated to paid minting, and 500 reserved for partnerships. Earn a gameplay property through its investigation or a qualifying quest. NFT minting is not available yet"
            },
            {
              "at": 19045,
              "current": "Paid mint price</dt><dd",
              "baseline": "Mint cost</dt><dd id=\"deed-cost\""
            },
            {
              "at": 19709,
              "current": "",
              "baseline": ", cost"
            },
            {
              "at": 20778,
              "current": "From level 25, investigate an available gameplay property or complete its qualifying quest. Each account can claim one gameplay Deed in its lifetime. You can also buy an existing Deed from another player. Operating benefits begin at level 25 for any Deed you control.</p><p>When extraction opens, an account that has minted its character can take an unlisted Deed it owns on-chain with a verified wallet and eligibility attestation. The signed extraction claim costs 0 ETH plus network gas. The separate character mint terms still apply",
              "baseline": "Street Deeds are discovered through gameplay or earned through eligible quests. NFT minting requires a deed you own, an eligible account and a linked wallet. Review the requirements in the city before minting"
            },
            {
              "at": 26878,
              "current": " and wallet steps will appear here when connected.'],\n    scheduled: ['Opening soon', 'Deed mint not open yet', 'Review your account and Deed eligibility",
              "baseline": ", cost and wallet steps will appear here when connected.'],\n    scheduled: ['Opening soon', 'Deed mint not open yet', 'Review deed eligibility and published mint terms"
            },
            {
              "at": 27667,
              "current": "opensAt is an ISO timestamp and",
              "baseline": "mintCostEth is in display units; opensAt is an ISO timestamp;"
            },
            {
              "at": 28107,
              "current": "",
              "baseline": "    const cost = amount(data.mintCostEth);\n"
            },
            {
              "at": 28833,
              "current": "",
              "baseline": "    byId('deed-cost').textContent = cost === null ? 'To be announced' : `${number.format(cost)} ETH + network fees`;\n"
            }
          ]
        }
      }
    },
    "src/agentgateway.js": {
      "current": {
        "mode": "100644",
        "blob": "aaf10d3531f5158f76bf9482f536bba7dd3d7ed6",
        "sha256": "fd889fb402a434d95744260a5da48b6b4d0e9f61a0088146f4b4b366d412f43a",
        "bytes": 155683
      },
      "parents": {
        "main": {
          "pin": {
            "mode": "100644",
            "blob": "e0185998ed68e0604062aca2e23dfefdb1d79ea1",
            "sha256": "337a77e151c17e55ea4055280d192d353cdd067d6069b4d001ce7bfbf9be4071",
            "bytes": 155543
          },
          "inverses": [
            {
              "at": 8144,
              "current": "OMR extraction requires launch approval, a minted account, and a wallet. Requests can queue unsigned until the reserve covers the voucher",
              "baseline": "Withdraw earned $OMR on-chain (EIP-712 voucher, full-reserve backed; rail not yet open — opens when the audit and launch gates clear)"
            },
            {
              "at": 8438,
              "current": "Inventory bond purchases require verified deployment, funded inventory and an open offering. Existing bond records retain their original claim terms",
              "baseline": "Reserve bonds (protocol-owned liquidity)"
            },
            {
              "at": 154976,
              "current": "extraction opens, link a wallet and mint your character using the current fee or an earned mission credit.\n  POST /v1/withdraw debits game OMR. A request can queue until the reserve covers the net voucher amount",
              "baseline": "open: link a wallet (SIWE), mint the account (one-time on-chain fee), then POST /v1/withdraw\n  signs a full-reserve-backed EIP-712 voucher you claim on-chain (extraction ≤ inflow)"
            }
          ]
        }
      }
    },
    "src/chain.js": {
      "current": {
        "mode": "100644",
        "blob": "48b695827e44993257c2afb7de0b5d109fda48b5",
        "sha256": "3d902aec853e3f3df5dfeed3bace7df97c021f2060b1e198018918928fe88b35",
        "bytes": 131574
      },
      "parents": {
        "main": {
          "pin": {
            "mode": "100644",
            "blob": "dc022999473e6f659caa828cf664ca113a9ab1ec",
            "sha256": "ce07b1723a4657326ea37ab40010843b711aa04834b14950ffc0e2568eb15110",
            "bytes": 131508
          },
          "inverses": [
            {
              "at": 15904,
              "current": "Mint your character with the current ETH fee or an earned mint credit before withdrawing OMR",
              "baseline": "Only a made account can cash out — pay the 0.01 ETH mint fee first"
            },
            {
              "at": 23108,
              "current": "Mint your character with the current ETH fee or an earned mint credit before extracting gear",
              "baseline": "Only a made account can take gear on-chain — pay the 0.01 ETH mint fee first"
            },
            {
              "at": 26216,
              "current": "Mint your character with the current ETH fee or an earned mint credit before extracting property",
              "baseline": "Only a made account can take property on-chain — pay the 0.01 ETH mint fee first"
            },
            {
              "at": 69064,
              "current": "Mint your character with the current ETH fee or an earned mint credit before extracting a Street Deed",
              "baseline": "Only a made account can take a Street Deed on-chain — pay the 0.01 ETH mint fee first"
            }
          ]
        }
      }
    },
    "src/routes/modtools.js": {
      "current": {
        "mode": "100644",
        "blob": "c141604882574c7fee44e667f4281c05b9b157c3",
        "sha256": "117ef38c68e1d801c66b25310b7ff0928aa839a4d6609c1fcba1a2f8acfea845",
        "bytes": 35444
      },
      "parents": {
        "main": {
          "pin": {
            "mode": "100644",
            "blob": "ef47f2fbadb3119cf9ffb7cbecaabccb23b11f58",
            "sha256": "0c168552617be43d7a6800c3f2ff33dce0d6186f3d9cd9bcdd76b3ca82d330dc",
            "bytes": 35633
          },
          "inverses": [
            {
              "at": 30163,
              "current": "Store revenue and idempotent QA grants. Real ETH bookings come from the watcher",
              "baseline": "Mod/ops: the founder's three-way revenue split (founder / buyback / RWA), and the comp/simulate\n    // path — drives recordStorePurchase with a synthetic nonce (for comps, QA, and until the paywall\n    // ships). `nonce` must be unique; a duplicate is the idempotent no-op"
            },
            {
              "at": 30978,
              "current": ", routing: { route: 'simulation' } })); // QA-only simulated receip",
              "baseline": " })); // D-MED2: strip caller txHash unless the QA flag is se"
            }
          ]
        }
      }
    },
    "src/rules.tail.js": {
      "current": {
        "mode": "100644",
        "blob": "a17a1e6ef6f4607d9ef765e9b44bc98258386f32",
        "sha256": "bc034017234bc42fccb38a63d00beb8c6bfc73ea950f055e75ef5b79bc0c4991",
        "bytes": 495218
      },
      "parents": {
        "main": {
          "pin": {
            "mode": "100644",
            "blob": "ab3906403df571350d7057fd8a01de53d23116be",
            "sha256": "5d255c106c3d10d9f813fda71be75bff2c80b3d3559cdeda48da18b379563845",
            "bytes": 496801
          },
          "inverses": [
            {
              "at": 213386,
              "current": "and the backend records the receipt and",
              "baseline": "(dormant); the backend records the payment (three-way revenue split) +"
            },
            {
              "at": 213774,
              "current": "FeeRevenueRouter policy for routed package payments. Public field names are retained for clients.\n  SPLIT_BPS: Object.freeze({ founder: 5000, buyback: 2500, rwa: 1000, community: 1500 })",
              "baseline": "the founder's three-way revenue split (must sum to 10000): founder profit / $OMR buyback\n  // flywheel / RWA reserve (R2, dormant). Env-overridable; validated at module load.\n  SPLIT_BPS: {\n    founder: Number(process.env.REVENUE_FOUNDER_BPS || 4000),\n    buyback: Number(process.env.REVENUE_BUYBACK_BPS || 4000),\n    rwa: Number(process.env.REVENUE_RWA_BPS || 2000),\n  }"
            },
            {
              "at": 232879,
              "current": "A harvest carve cannot exceed the underlying payment.\n(() => {",
              "baseline": "validate the split sums to 10000 at load — a misconfig would silently mis-earmark real revenue\n(() => { const s = STORE.SPLIT_BPS; const t = s.founder + s.buyback + s.rwa;\n  if (t !== 10000) throw new Error(`REVENUE_SPLIT_BPS must sum to 10000 (got ${t})`);\n  // (red team 2026-08-16) …AND the community carve must fit inside the share it comes out of. The\n  // Store's community slice is carved from the FOUNDER remainder, which nothing validated: the sum\n  // check above cannot catch it because the remainder is computed as `founder - carve` and therefore\n  // sums to 10000 for ANY carve, including a negative one. Measured with STORE_COMMUNITY_BPS=5000:\n  // the module boots clean and the store row reads `[vig 4000, treasury 2000, community 5000,\n  // operations -1000] sum 10000` — real ETH earmarked to the dev wallet booked as another system's\n  // spendable budget. The fee split (above) already guards its own three-way sum; this is the same\n  // guard for the shape that hides behind an implicit remainder.\n  const commStore = Number(process.env.STORE_COMMUNITY_BPS ?? 0);\n  if (commStore > s.founder)\n    throw new Error(`STORE_COMMUNITY_BPS (${commStore}) exceeds the founder share it is carved from (${s.founder}) — the operations remainder would go negative and real revenue would be double-booked.`);"
            },
            {
              "at": 476232,
              "current": "",
              "baseline": "  STORE_BPS: () => Number(process.env.STORE_COMMUNITY_BPS ?? 0),      // of each Store payment's gross\n"
            }
          ]
        }
      }
    },
    "test/deed-allocation-source-compatibility.js": {
      "current": {
        "mode": "100644",
        "blob": "80947aa1a1d22b28f3bd499e71851a9e8672ac58",
        "sha256": "2c1301ea7deccb7935e9c69b18ae1d3659641c1035793853425efec02bb02583",
        "bytes": 20243
      },
      "parents": {
        "main": {
          "pin": {
            "mode": "100644",
            "blob": "cd56e4e996bbf388ca05e2fab320e9f39395998e",
            "sha256": "4d30382859c581323cb21155348446dfd3be546a68acfa866747f3ee206b24b0",
            "bytes": 10605
          },
          "inverses": [
            {
              "at": 147,
              "current": ", BUSINESS_DESK_COMBINED_SOURCE_FILES",
              "baseline": ""
            },
            {
              "at": 286,
              "current": "import { integratedEconomicSource, integratedEconomicParentInput } from '../tools/integrated-economic-parent-source.js';\n",
              "baseline": ""
            },
            {
              "at": 643,
              "current": "import { currentEconomicTermsBaseline, currentEconomicTermsPin } from '../tools/current-economic-terms-source-transfer.js';\nimport { ENTERPRISE_NATIVE_UX_INPUTS as deedNative } from '../tools/economic-deed-parent-native-inputs.js';\nimport { combinedEconomicDeedPin as combined, combinedEconomicDeedInput, combinedEconomicTermsInput, combinedEconomicFixtureInput } from '../tools/combined-economic-deed-source-transfer.js';\n",
              "baseline": ""
            },
            {
              "at": 5621,
              "current": "integratedEconomicParentInput(file, rawPhysical, 'main')",
              "baseline": "rawPhysical"
            },
            {
              "at": 9848,
              "current": "const actualSchema = lf(fs.readFileSync('schema.sql', 'utf8'));\nassert.equal(deedAllocationHistoricalInput('schema.sql', actualSchema), actualSchema, 'Deed normalization excludes the native schema');\nassert.equal(currentEconomicTermsBaseline('schema.sql', integratedEconomicParentInput('schema.sql', actualSchema, 'economic')), git('show', `${DEED_ALLOCATION_SOURCE_PREDECESSOR}:schema.sql`),\n  'Only the independently reviewed economic schema can reconstruct its predecessor for source comparison');\nassert.equal(lf(economyMonitorHistoricalInput('schema.sql', integratedEconomicParentInput('schema.sql', actualSchema, 'main",
              "baseline": "assert.equal(lf(economyMonitorHistoricalInput('schema.sql', fs.readFileSync('schema.sql', 'utf8"
            },
            {
              "at": 11760,
              "current": "\n// The authored merge and the Deed release both stay independently identifiable after later proof commits.\nassert.equal(combined.source,'c220834210928560f303795086ee1098d0a65509');\nassert.equal(combined.predecessor,'4e5f7fdb1cc4d2055ac613d2d4cb562a8007c364');\ngit('merge-base','--is-ancestor',combined.predecessor,combined.source);\ngit('merge-base','--is-ancestor',combined.source,'HEAD');\nfor(const [revision,tree] of [[combined.source,combined.sourceTree],[combined.predecessor,combined.predecessorTree]])\n  assert.equal(git('rev-parse',revision+'^{tree}').trim(),tree);\nconst changed=git('diff','--name-only','-z',combined.predecessor,combined.source).split('\\0').filter(Boolean);\nconst deedNativeFiles=new Set(deedNative.files.map(row=>row.file));\nassert.deepEqual(Object.keys(combined.files),changed.filter(file=>Object.hasOwn(DEED_ALLOCATION_SOURCE_DOMAINS,file)));\nassert.deepEqual(Object.keys(combined.nativeFiles),changed.filter(file=>deedNativeFiles.has(file)));\nassert.deepEqual(Object.keys(combined.economicFiles),['public/wiki.html']);\nfor(const file of new Set([...Object.keys(combined.files),...Object.keys(combined.economicFiles),...Object.keys(combined.nativeFiles)])) {\n  const economicOnly=Object.hasOwn(combined.economicFiles,file);\n  const inputFor=economicOnly ? combinedEconomicTermsInput : combinedEconomicDeedInput;\n  const row=combined.files[file]??combined.economicFiles[file]??combined.nativeFiles[file];\n  if(combined.nativeFiles[file]) {\n    assert.deepEqual(combined.nativeFiles[file],{current:row.current,baseline:row.baseline});\n    assert(!Object.hasOwn(combined.nativeFiles[file],'inverses'));\n  }\n  const current=git('show',combined.source+':'+file), prior=git('show',combined.predecessor+':'+file);\n  for(const [rev,text,pin] of [[combined.source,current,row.current],[combined.predecessor,prior,row.baseline]]) {\n    assert.equal(git('ls-tree',rev,'--',file).trim(),pin.mode+' blob '+pin.blob+'\\t'+file);\n    assert.equal(sha256(text),pin.sha256); assert.equal(Buffer.byteLength(text),pin.bytes);\n  }\n  const physical=fs.readFileSync(file,'utf8'), head=git('show','HEAD:'+file);\n  assert(physical===head || physical===head.replaceAll('\\n','\\r\\n'),'Exact physical integration source: '+file);\n  assert.equal(git('ls-tree','HEAD','--',file).trim(),git('ls-tree',integratedEconomicSource.revision,'--',file).trim(),\n    'Current mode and blob must match the reviewed integrated source: '+file);\n  if(economicOnly || Object.hasOwn(combined.files,file)) {\n    assert.equal(lf(integratedEconomicParentInput(file,physical,'economic')),current,'Exact economic merge parent: '+file);\n  }\n  if(economicOnly) {\n    assert.strictEqual(combinedEconomicDeedInput(file,physical),physical);\n    assert.equal(currentEconomicTermsBaseline(file,integratedEconomicParentInput(file,physical,'economic')),prior);\n  }\n  if(!economicOnly && !Object.hasOwn(combined.files,file)) {\n    assert.strictEqual(combinedEconomicDeedInput(file,physical),physical,'Native-only inputs never receive historical substitutions');\n    continue;\n  }\n  for(const text of [current,current.replaceAll('\\n','\\r\\n')])\n    assert.equal(inputFor(file,text),prior);\n  assert.deepEqual(inputFor(file,Buffer.from(current)),Buffer.from(prior));\n  for(const input of [prior,current.slice(1),current+'\\n',current.replace('\\n','\\r\\n'),current+'\\0'])\n    assert.strictEqual(inputFor(file,input),input);\n  const invalid=Buffer.from([255]);\n  assert.throws(()=>inputFor(file,invalid),/lossless/i);\n}\nconsole.log('Verified the merged economic and Deed source and its separate native input identities.');\n\nassert.deepEqual(Object.keys(combined.fixtureFiles),['test/lib/rc1-historical-source-fixture.js']);\nfor(const [file,row] of Object.entries(combined.fixtureFiles)) {\n  assert.deepEqual(combined.nativeFiles[file],{current:row.current,baseline:row.baseline});\n  const current=git('show',combined.source+':'+file), prior=git('show',combined.predecessor+':'+file);\n  for(const input of [current,current.replaceAll('\\n','\\r\\n'),Buffer.from(current)]) {\n    const restored=combinedEconomicFixtureInput(file,input);\n    assert.equal(String(restored),prior);\n    assert.equal(Buffer.isBuffer(restored),Buffer.isBuffer(input));\n    assert.equal(String(currentEconomicTermsBaseline(file,input)),prior);\n  }\n  for(const input of [prior,current+'\\n',current.slice(1),'\\ufeff'+current,current+'\\0',current.replace('\\n','\\r\\n'),current.replace(/\\S/,'?')])\n    assert.strictEqual(combinedEconomicFixtureInput(file,input),input);\n  for(const inverse of row.inverses) {\n    const partial=current.slice(0,inverse.at)+inverse.baseline+current.slice(inverse.at+inverse.current.length);\n    assert.strictEqual(combinedEconomicFixtureInput(file,partial),partial);\n  }\n  assert.throws(()=>combinedEconomicFixtureInput(file,Buffer.from([255])),/lossless/i);\n}\nfor(const file of ['src/store.js','__proto__','../test/lib/rc1-historical-source-fixture.js'])\n  assert.strictEqual(combinedEconomicFixtureInput(file,'unknown'),'unknown');\nconsole.log('Verified the separate exact RC1 fixture source reconstruction and mutation refusals.');\n\n// Seal only the changed paths in the two existing comparison domains. Execution always uses the checkout.\nconst integration = integratedEconomicSource;\nassert.deepEqual(integration.parents, {\n  economic:'3cf03ab3ebec43983b59ee07849594ed34f3dcae',\n  main:'68a4d92d810ee17c192abb8a8c2a3fcbf87c4c52',\n});\nassert.equal(git('rev-parse',integration.revision+'^{tree}').trim(),integration.tree);\ngit('merge-base','--is-ancestor',integration.revision,'HEAD');\nconst economicDomain = new Set([currentEconomicTermsPin.files, combined.files, combined.noirFiles,\n  combined.economicFiles, combined.fixtureFiles].flatMap(Object.keys));\nconst mainDomain = new Set([...BUSINESS_DESK_COMBINED_SOURCE_FILES, ...Object.keys(DEED_ALLOCATION_SOURCE_DOMAINS), ...economicDomain]);\nfor (const [profile,parent] of Object.entries(integration.parents)) {\n  git('merge-base','--is-ancestor',parent,integration.revision);\n  const domain = profile === 'main' ? mainDomain : economicDomain;\n  const changed = git('diff','--name-only','--diff-filter=M','-z',parent,integration.revision).split('\\0').filter(file=>domain.has(file));\n  assert.deepEqual(Object.keys(integration.files).filter(file=>Object.hasOwn(integration.files[file].parents,profile)).sort(),changed.sort());\n  for (const file of changed) {\n    const row = integration.files[file], target = row.parents[profile];\n    const current = git('show',integration.revision+':'+file), predecessor = git('show',parent+':'+file);\n    for (const [rev,source,pin] of [[integration.revision,current,row.current],[parent,predecessor,target.pin]]) {\n      assert.equal(git('ls-tree',rev,'--',file).trim(),pin.mode+' blob '+pin.blob+'\\t'+file);\n      assert.equal(sha256(source),pin.sha256); assert.equal(Buffer.byteLength(source),pin.bytes);\n    }\n    assert.equal(git('ls-tree','HEAD','--',file).trim(),git('ls-tree',integration.revision,'--',file).trim());\n    assert.equal(git('ls-files','--stage','--',file).trim(),row.current.mode+' '+row.current.blob+' 0\\t'+file);\n    const stat=fs.lstatSync(file); assert(stat.isFile() && !stat.isSymbolicLink());\n    const raw = fs.readFileSync(file);\n    assert(raw.equals(Buffer.from(current)) || raw.equals(Buffer.from(current.replaceAll('\\n','\\r\\n'))));\n    for (const input of [current,current.replaceAll('\\n','\\r\\n'),raw]) {\n      const result = integratedEconomicParentInput(file,input,profile);\n      assert.equal(String(result),predecessor); assert.equal(Buffer.isBuffer(result),Buffer.isBuffer(input));\n    }\n    for (const input of [current+'\\n', current.slice(1), current.replace('\\n','\\r\\n'), '\\ufeff'+current, current+'\\0', predecessor]) {\n      assert.strictEqual(integratedEconomicParentInput(file,input,profile),input);\n    }\n    for (const h of target.inverses) {\n      const partial = current.slice(0,h.at)+h.baseline+current.slice(h.at+h.current.length);\n      assert.notEqual(partial,current); assert.strictEqual(integratedEconomicParentInput(file,partial,profile),partial);\n    }\n    assert.throws(()=>integratedEconomicParentInput(file,Buffer.from([255]),profile),/lossless/i);\n  }\n}\nfor (const path of ['../package.json','__proto__','tools/enterprise-native-deed-inputs.js']) {\n  const invalid=Buffer.from([255]);\n  assert.strictEqual(integratedEconomicParentInput(path,invalid,'main'),invalid);\n}\nconsole.log('Verified complete comparison postimages for both reviewed economic integration parents.');\n",
              "baseline": ""
            }
          ]
        }
      }
    },
    "test/lib/rc1-historical-source-fixture.js": {
      "current": {
        "mode": "100644",
        "blob": "05b015e5e73922216d5a98aa746baaee373fbc66",
        "sha256": "fb724f2bddeb67bc14273f53781c5b74b42f51889d5688a31c7dfee2373ed3f5",
        "bytes": 47402
      },
      "parents": {
        "main": {
          "pin": {
            "mode": "100644",
            "blob": "0773ce2a68874504490d6301f896c2b908f14656",
            "sha256": "0c7d1202e9b1eb86ec144451cdf28e81ebc8784648c0ab27aa43513d1625d989",
            "bytes": 44705
          },
          "inverses": [
            {
              "at": 455,
              "current": "import {combinedEconomicDeedPin} from '../../tools/combined-economic-deed-source-transfer.js';\n",
              "baseline": ""
            },
            {
              "at": 7369,
              "current": "const economicReceiptHistoricalFiles = Object.freeze(['src/store.js', 'src/router.js', 'src/treasury.js', 'src/watcher.js']);\n",
              "baseline": ""
            },
            {
              "at": 14244,
              "current": "function economicReceiptHistoricalInput(file, input, expected) {\n  if (!economicReceiptHistoricalFiles.includes(file)) return input;\n  const raw = uniformHistoricalInput(file, input), current = canonical(raw);\n  const row = combinedEconomicDeedPin.nativeFiles[file];\n  // This table binds source identities only. The frozen fixture independently selects its body.\n  assert(row, 'Reviewed economic receipt identities required: ' + file);\n  assert.equal(row.baseline.sha256, sha256(expected), 'Economic receipt predecessor differs from frozen release: ' + file);\n  assert.equal(row.baseline.blob, blobHash(expected), 'Economic receipt predecessor blob changed: ' + file);\n  if (sha256(current) !== row.current.sha256) return raw;\n  assert.equal(blobHash(Buffer.from(current)), row.current.blob, 'Economic receipt current blob changed: ' + file);\n  assert.equal(Buffer.byteLength(current), row.current.bytes);\n  for (const [revision, pin] of [[combinedEconomicDeedPin.source, row.current], [combinedEconomicDeedPin.predecessor, row.baseline]]) {\n    assert.equal(String(git(['ls-tree', revision, '--', file])).trim(), pin.mode + ' blob ' + pin.blob + '\\t' + file,\n      'Economic receipt revision identity changed: ' + file);\n  }\n  assert.equal(current, String(git(['cat-file', 'blob', row.current.blob])), 'Complete economic receipt authored source changed: ' + file);\n  return String(expected);\n}\n",
              "baseline": ""
            },
            {
              "at": 18311,
              "current": "receipts = economicReceiptHistoricalInput(file, input, expected);\n  const combined = enterpriseCombinedHistoricalInput(file, receipts",
              "baseline": "combined = enterpriseCombinedHistoricalInput(file, input"
            },
            {
              "at": 35422,
              "current": "  for (const file of economicReceiptHistoricalFiles) {\n    const current = canonical(originalRead(path.join(root, file))), frozen = String(blob(file, release));\n    const expected = blob(file, history);\n    assert.notEqual(current, frozen, 'Receipt fixture control exercises the reviewed successor: ' + file);\n    for (const source of [current, frozen]) {\n      for (const supplied of [source, source.replaceAll('\\n', '\\r\\n')]) {\n        assert.deepEqual(currentHistoricalApplicationSource(file, supplied), expected);\n        positives++;\n      }\n      for (const supplied of [source + '\\n// unreviewed\\n', source.slice(1), source.replace(/\\S/, '?'),\n        '\\ufeff' + source, source.replace('\\n', '\\r\\n'), source.replace('\\n', '\\r')]) {\n        assert.throws(() => currentHistoricalApplicationSource(file, supplied));\n        refusals++;\n      }\n    }\n  }\n  assert.throws(() => currentHistoricalApplicationSource('src/store.js', String(originalRead(path.join(root, 'src/router.js')))));\n  refusals++;\n",
              "baseline": ""
            }
          ]
        }
      }
    },
    "test/lib/ux-journeys.js": {
      "current": {
        "mode": "100644",
        "blob": "5c2f2db2cf172a81b03c258fcc3e2da4f28cbb86",
        "sha256": "b5cf3de1049133475deccc0c7f263fdf8ba82876bc01809542dbe67cee94a97c",
        "bytes": 15320
      },
      "parents": {
        "main": {
          "pin": {
            "mode": "100644",
            "blob": "6cdb42d8d08e3360c233f54a314f601a96f9e43c",
            "sha256": "f0bbc66dfe11d4e89604570778f132a01b4b37ca8e4746cf6ba3cb28c8b5bd84",
            "bytes": 15011
          },
          "inverses": [
            {
              "at": 0,
              "current": "import { integratedEconomicParentInput } from '../../tools/integrated-economic-parent-source.js';\n",
              "baseline": ""
            },
            {
              "at": 7625,
              "current": "const mainSource = integratedEconomicParentInput(file, committed, 'main');\n    let source = mainSource;\n    raw = { mode: raw.mode, blob: blob(source) }",
              "baseline": "let source = committed"
            },
            {
              "at": 8535,
              "current": "mainSource",
              "baseline": "committed"
            },
            {
              "at": 11826,
              "current": "fileText = readFileSync(new URL('../../' + row.file, import.meta.url), 'utf8');\n    const physical = businessDeskHistoricalInput(row.file, integratedEconomicParentInput(row.file, fileText, 'main",
              "baseline": "physical = businessDeskHistoricalInput(row.file, readFileSync(new URL('../../' + row.file, import.meta.url), 'utf8"
            }
          ]
        }
      }
    },
    "test/noir-ui-source-compatibility.js": {
      "current": {
        "mode": "100644",
        "blob": "6e6ab963efc34c690a18e89f340302c9a38b69ba",
        "sha256": "8c42d741b79f0f8342a35a19db9e88cea9b6b7b2340eabe1b2fa6cff12137ba0",
        "bytes": 7887
      },
      "parents": {
        "main": {
          "pin": {
            "mode": "100644",
            "blob": "d20f43b06ef714dd1b46eb57e2a3ca36091fe7c5",
            "sha256": "8736e6ced6339cd7cb694c6d0223fe057af3a8cd4878fba47e128546daf2e895",
            "bytes": 6545
          },
          "inverses": [
            {
              "at": 269,
              "current": "import { integratedEconomicParentInput } from '../tools/integrated-economic-parent-source.js';\n",
              "baseline": ""
            },
            {
              "at": 717,
              "current": "import { combinedEconomicDeedPin, combinedNoirUiInput } from '../tools/combined-economic-deed-source-transfer.js';\n",
              "baseline": ""
            },
            {
              "at": 1517,
              "current": "assert.equal(combinedEconomicDeedPin.noirSource, revision);\nassert.deepEqual(Object.keys(combinedEconomicDeedPin.noirFiles), ['package.json', 'public/index.html', 'test/ux-community-browser.js']);\n",
              "baseline": ""
            },
            {
              "at": 4747,
              "current": "  const combined = combinedEconomicDeedPin.noirFiles[file];\n  if (combined) {\n    const actual = lf(integratedEconomicParentInput(file, rawPhysical, 'economic'));\n    assert.equal(actual, git('show', `${combinedEconomicDeedPin.source}:${file}`));\n    assert.equal(sha(actual), combined.current.sha256);\n    assert.equal(sha(committed), combined.baseline.sha256);\n    assert.equal(combinedNoirUiInput(file, actual.replaceAll('\\n', '\\r\\n')), committed);\n    assert.deepEqual(combinedNoirUiInput(file, Buffer.from(actual)), Buffer.from(committed));\n    for (const changed of [actual.slice(1), actual + '\\n', actual + '\\0', actual.replace('\\n', '\\r\\n'),\n      ...combined.inverses.map(h => actual.slice(0, h.at) + h.baseline + actual.slice(h.at + h.current.length))]) {\n      assert.equal(combinedNoirUiInput(file, changed), changed);\n      if (changed !== committed) assert.equal(noirUiHistoricalInput(file, changed), changed);\n    }\n  }\n",
              "baseline": ""
            }
          ]
        }
      }
    },
    "test/wiki-media-source-transfer.js": {
      "current": {
        "mode": "100644",
        "blob": "8f9e14b9c702db7ed5bc94ae335311fd06e0a688",
        "sha256": "c7d1bc79087cd7af810a1c2d68a7cfe1df6687253692ffe54d4a5788af365a21",
        "bytes": 26107
      },
      "parents": {
        "main": {
          "pin": {
            "mode": "100644",
            "blob": "9efe2f3db49d82592e8917631d9ae9a95426897b",
            "sha256": "bccb99a106538fb63f5164e99c1ba571cd5b2a3f4982ba653d54a555927dab1e",
            "bytes": 25713
          },
          "inverses": [
            {
              "at": 358,
              "current": "import { integratedEconomicSource, integratedEconomicParentInput } from '../tools/integrated-economic-parent-source.js';\n",
              "baseline": ""
            },
            {
              "at": 1489,
              "current": "integratedEconomicSource.r",
              "baseline": "combinedSource.sourceR"
            },
            {
              "at": 2046,
              "current": "integratedEconomicSource.r",
              "baseline": "combinedSource.sourceR"
            },
            {
              "at": 2579,
              "current": "const main = integratedEconomicParentInput(file, physical, 'main');\n  const parent = git('show', combinedSource.sourceRevision + ':' + file);\n  assert(main === parent || main === parent.replaceAll('\\n', '\\r\\n'), 'Exact original combined comparison source: ' + file);\n  return main",
              "baseline": "return physical"
            }
          ]
        }
      }
    },
    "tools/deed-allocation-source-transfer.js": {
      "current": {
        "mode": "100644",
        "blob": "3b22fcf632333b23862e4b3168611e50bc4f607f",
        "sha256": "b78ee286cd73425b6eb8046731360600bff880944652e43641a2f93a7142198c",
        "bytes": 4334
      },
      "parents": {
        "main": {
          "pin": {
            "mode": "100644",
            "blob": "74c7c14639819f68d250bac71d04427bcca4b77a",
            "sha256": "65529c0b85d8376aaaa919776dd8f875f18a95b921754736e2a6153032d13551",
            "bytes": 4195
          },
          "inverses": [
            {
              "at": 443,
              "current": "import { combinedEconomicDeedInput } from './combined-economic-deed-source-transfer.js';\n",
              "baseline": ""
            },
            {
              "at": 3823,
              "current": "  input = combinedEconomicDeedInput(file, input);\n",
              "baseline": ""
            }
          ]
        }
      }
    },
    "tools/noir-ui-source-transfer.js": {
      "current": {
        "mode": "100644",
        "blob": "a78f36d56203083143a9ae54de9b9e3d7fd82db3",
        "sha256": "a452fac4f36919e166d56639b6473d4cb8429a5f1c2191fd22f0dc369a4abf06",
        "bytes": 5773
      },
      "parents": {
        "main": {
          "pin": {
            "mode": "100644",
            "blob": "453473a55cf234922b06270d65a16b483b75cc94",
            "sha256": "6d5b96cca698e92144e35927620a2830424c41c0eb8e938f64d02da769f1564b",
            "bytes": 5646
          },
          "inverses": [
            {
              "at": 439,
              "current": "import { combinedNoirUiInput } from './combined-economic-deed-source-transfer.js';\n",
              "baseline": ""
            },
            {
              "at": 5196,
              "current": "  input = combinedNoirUiInput(file, input);\n",
              "baseline": ""
            }
          ]
        }
      }
    },
    "tools/public-ui.js": {
      "current": {
        "mode": "100644",
        "blob": "bd71350152904f9520f481c68b656b2f04e10554",
        "sha256": "067ce0daaf80a618fc0d0cd3668f7354d3569f1e6281450a8af1e91102bcaf3b",
        "bytes": 48001
      },
      "parents": {
        "main": {
          "pin": {
            "mode": "100644",
            "blob": "4bec97c8b2668b4f8eab5fb469c6b852858bf395",
            "sha256": "44d7124d1bbf9d7e47932b91148ceda39dc97f2742addc4bc37d01e0f559c963",
            "bytes": 47858
          },
          "inverses": [
            {
              "at": 29499,
              "current": "const firstJob = mobile.locator('#tab-streets.on #ux-action-pocket [data-do^=\"POST /v1/crimes/\"][data-body*=standard]:enabled');\n  await firstJob.click({ trial: true });\n  check(await mobile.locator('#tabs [data-tab=\"streets\"]').getAttribute('aria-selected') === 'true',\n    'Completing the tour selects Streets with an available first",
              "baseline": "await mobile.waitForSelector('#tab-streets.on [data-do^=\"POST /v1/crimes/\"]:not([disabled])');\n  check(await mobile.locator('#tab-streets.on').isVisible()\n      && await mobile.locator('#tabs [data-tab=\"streets\"]').getAttribute('aria-selected') === 'true',\n    'The first-job welcome opens Streets with an available"
            },
            {
              "at": 29970,
              "current": " job uses the classic interface.');\n  const operationDesk = await firstJob.evaluate((primary",
              "baseline": "-job welcome must use the classic interface.');\n  const operationDesk = await mobile.evaluate(("
            },
            {
              "at": 30139,
              "current": "rect = primary",
              "baseline": "primary = desk?.querySelector('[data-operation-primary]');\n    const rect = desk?"
            },
            {
              "at": 30418,
              "current": ".top, bottom: rect.bottom, height: rect.height, viewportHeight: innerHeight",
              "baseline": "?.top"
            },
            {
              "at": 30822,
              "current": "'Your Turn needs a labelled operation region, an available job and a live receipt feed.');\n  check(operationDesk.height >= 44 && operationDesk.top >= 0 && operationDesk.bottom <= operationDesk.viewportHeight && operationDesk.over <= 1,\n    'The first Streets job must scroll into reach with a 44px touch target and fit the phone width — ' + JSON.stringify(operationDesk)",
              "baseline": "`Your Turn is not one labelled, actionable operation surface — ${JSON.stringify(operationDesk)}`);\n  check(operationDesk.top < 260 && operationDesk.over <= 1,\n    `Your Turn is buried or causes mobile overflow — ${JSON.stringify(operationDesk)}`"
            },
            {
              "at": 36843,
              "current": "3",
              "baseline": "4"
            }
          ]
        }
      }
    }
  }
};
export const integratedEconomicSourceDigest = 'c57ceb2c83d13047663cdd0a0b285c62e5c82a6846138ee57c5210260b380006';
