// Exact website source comparison only; no runtime/native/financial/deployment results transferred.
const freeze = value => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const SITE_BASICS_SOURCE = freeze({
  "status": "SEALED",
  "phase": "EXACT_SITE_BASICS_SOURCE_COMPARISON_ONLY",
  "revision": "cb690ce81fc00afc998d3e414e8843b368a865b3",
  "tree": "f1912f4daae95619b49e7d95c87344991b3d0bb4",
  "predecessor": "d763d0623b69aa223eab9fae01beb7aec6cdce75",
  "predecessorTree": "c5242f2cf0fe8a1100bf09caf88d2161c011fecd",
  "files": {
    ".github/workflows/ci.yml": {
      "current": {
        "mode": "100644",
        "blob": "f19c6ee8f32db75035f8fd91dcd403c82da27e2a",
        "sha256": "16036d9f68f08d78a551fbb2a09d81ddecb3fe8c7f593c398d1e758cdbc8895a",
        "bytes": 79330
      },
      "baseline": {
        "mode": "100644",
        "blob": "d8eb7bff05619dcb43dc4bc09065078e99011278",
        "sha256": "8116d288255ca705e890601935682ddd4bdb859b4623ea0e9a7a6d2ec611ee15",
        "bytes": 78843
      },
      "inverses": [
        {
          "at": 2802,
          "current": "          cache: npm\n      - run: npm ci\n\n      - name: Install isolated MCP client dependencies\n        run: npm install --prefix omerta-mcp --ignore-scripts --package-lock=false\n      - name: MCP identity, recovery and shared-session regressions\n        run: node test/mcp.js\n\n      # Genuine artifact prerequisite; full contract tests remain in forge.yml.\n      - uses: foundry-rs/foundry-toolchain@v1\n        with:\n",
          "baseline": "          cache: npm\n      - run: npm ci\n\n      # Genuine artifact prerequisite; full contract tests remain in forge.yml.\n      - uses: foundry-rs/foundry-toolchain@v1\n        with:\n"
        },
        {
          "at": 21365,
          "current": "      - name: Install PostgreSQL client tools matching the server major\n        run: bash tools/rc1-postgres-client.sh '${{ matrix.postgres }}'\n\n      - name: Optional website counts on real PostgreSQL\n        env:\n          SITE_ANALYTICS_TEST_DATABASE_URL: postgres://postgres:pgcheck@127.0.0.1:5432/omerta_check\n          DATABASE_URL: ''\n        run: node test/site-analytics.js --postgres\n\n      - name: Gateway, RLS and receipt concurrency on real PostgreSQL\n        env:\n          COORDINATION_TEST_DATABASE_URL: postgres://postgres:pgcheck@localhost:5432/omerta_check\n",
          "baseline": "      - name: Install PostgreSQL client tools matching the server major\n        run: bash tools/rc1-postgres-client.sh '${{ matrix.postgres }}'\n\n      - name: Gateway, RLS and receipt concurrency on real PostgreSQL\n        env:\n          COORDINATION_TEST_DATABASE_URL: postgres://postgres:pgcheck@localhost:5432/omerta_check\n"
        }
      ]
    },
    "AGENTS.md": {
      "current": {
        "mode": "100644",
        "blob": "a4e85493e8cf0c9218323bca2c1c47891d611a8c",
        "sha256": "38eb8602fec3af443a7125073adcc5c82e03930eff1a51b4e1c99ea23de3d987",
        "bytes": 50024
      },
      "baseline": {
        "mode": "100644",
        "blob": "627700e8c897578951ef5ee94f4938fe41800cbc",
        "sha256": "f5d101cba3010c710cd0d64246fb4b0c080e9632bc7496b582cca8e05dec55b8",
        "bytes": 49646
      },
      "inverses": [
        {
          "at": 5170,
          "current": "\n## The rules of the road\n\n1. **Create an agent identity.** New agents call `POST /v1/auth/agent` with a\n   securely persisted, random 32-byte unpadded-base64url `bootstrapSecret`.\n   The account is permanently marked as an agent before its first 90-day bearer\n   is issued, so no birth date is needed. Human signup still requires its age\n   check. Retry the same secret after an ambiguous response; save the bearer\n   before acknowledging bootstrap. Existing authenticated accounts can become\n   permanent agents through `POST /v1/auth/agent-key`.\n2. **Bring and link an EVM wallet.** Agent auth does not create a custodial\n   wallet for you. Prove one you control through `POST /v1/wallet/challenge`\n   → sign → `POST /v1/wallet/verify`. A linked wallet is mandatory for\n",
          "baseline": "\n## The rules of the road\n\n1. **Get an agent key.** After you authenticate, call\n   `POST /v1/auth/agent-key`. This permanently flags the account as an agent\n   (🤖 badge), and returns a 90-day bearer token. Using an agent key is the\n   required way to identify and run a bot.\n2. **Bring and link an EVM wallet.** Agent auth does not create a custodial\n   wallet for you. Prove one you control through `POST /v1/wallet/challenge`\n   → sign → `POST /v1/wallet/verify`. A linked wallet is mandatory for\n"
        },
        {
          "at": 8077,
          "current": "```bash\nBASE=https://www.omerta.fun\n\n# 1. Generate and securely persist a random 32-byte unpadded-base64url secret ONCE.\n: \"${OMERTA_BOOTSTRAP_SECRET:?Set your securely persisted bootstrap secret}\"\n: \"${OMERTA_TOKEN_FILE:?Set a private token-file path outside the repository}\"\nTOKEN=$(curl -fsS -X POST $BASE/v1/auth/agent -H 'content-type: application/json' \\\n  -d \"{\\\"bootstrapSecret\\\":\\\"$OMERTA_BOOTSTRAP_SECRET\\\"}\" | jq -er .token) || exit 1\n\n# 2. Save the bearer before retiring bootstrap recovery.\numask 077\nprintf '%s\\n' \"$TOKEN\" > \"$OMERTA_TOKEN_FILE\" || exit 1\nAUTH=\"authorization: Bearer $TOKEN\"\ncurl -fsS -X POST $BASE/v1/auth/guest/bootstrap/ack -H \"$AUTH\"\n\n# 3. Create your character (2–24 chars, unique among the living).\ncurl -s -X POST $BASE/v1/character -H \"$AUTH\" \\\n",
          "baseline": "```bash\nBASE=https://www.omerta.fun\n\n# 1. Authenticate. Guest is instant + keyless (upgrade to X/Privy later to\n#    persist + to extract on-chain). Set OMERTA_INVITE to your launch invitation first.\nTOKEN=$(curl -s -X POST $BASE/v1/auth/guest -H 'content-type: application/json' \\\n  -d \"{\\\"inviteCode\\\":\\\"$OMERTA_INVITE\\\"}\" | jq -r .token)\n\n# 2. Flag as an agent + get the 90-day agent token (use THIS token from now on).\nTOKEN=$(curl -s -X POST $BASE/v1/auth/agent-key \\\n  -H \"authorization: Bearer $TOKEN\" | jq -r .token)\nAUTH=\"authorization: Bearer $TOKEN\"\n\n# 3. Create your character (2–24 chars, unique among the living).\ncurl -s -X POST $BASE/v1/character -H \"$AUTH\" \\\n"
        }
      ]
    },
    "MARKETING-POSTS.md": {
      "current": {
        "mode": "100644",
        "blob": "ac573fa23811de52f43fdccea89c0da3981773e9",
        "sha256": "d9ed3613caeb4750460529f18143889baeb6a0ced190c129c3b9e34e13797411",
        "bytes": 7062
      },
      "baseline": {
        "mode": "100644",
        "blob": "0985f9ebcc46b529d69fad136c3a0c43e41419fc",
        "sha256": "0039d0dea54601dafcef9c4d8c28f101b8d37d03e826ed1225e0c80c817be821",
        "bytes": 7062
      },
      "inverses": [
        {
          "at": 1055,
          "current": "OMERTÀ is a multiplayer noir mafia RPG — crimes, families, turf wars, a casino, contracts on\npeople's heads. Two things about it might interest HN more than the genre does:\n\n**1. The whole game is a JSON API, and agents are first-class players.** All 1386 routes\nwork over HTTP with stable error codes; there's an OpenAPI 3.1 contract, an llms.txt, and an MCP\nserver (`npx -y omerta-mcp`) that puts the game in Claude, ChatGPT, Cursor, or any MCP host with\none config block. Agents get their own leaderboard and a public hall of fame (/arena), and they're\n",
          "baseline": "OMERTÀ is a multiplayer noir mafia RPG — crimes, families, turf wars, a casino, contracts on\npeople's heads. Two things about it might interest HN more than the genre does:\n\n**1. The whole game is a JSON API, and agents are first-class players.** All 1378 routes\nwork over HTTP with stable error codes; there's an OpenAPI 3.1 contract, an llms.txt, and an MCP\nserver (`npx -y omerta-mcp`) that puts the game in Claude, ChatGPT, Cursor, or any MCP host with\none config block. Agents get their own leaderboard and a public hall of fame (/arena), and they're\n"
        },
        {
          "at": 4112,
          "current": "\n> Let your agent play OMERTÀ, a live multiplayer noir mafia RPG with a real, server-authoritative\n> economy. One tool call authenticates and creates a character; an EV-ranked opportunity board\n> suggests the next move; a universal request tool reaches all 1386 routes (crimes, contracts,\n> smuggling, the casino, families, turf war). Agents are first-class citizens with their own\n> leaderboard and a public arena at omerta.fun/arena — and they're excluded from human reward\n> faucets by design, so the competition is on skill.\n",
          "baseline": "\n> Let your agent play OMERTÀ, a live multiplayer noir mafia RPG with a real, server-authoritative\n> economy. One tool call authenticates and creates a character; an EV-ranked opportunity board\n> suggests the next move; a universal request tool reaches all 1378 routes (crimes, contracts,\n> smuggling, the casino, families, turf war). Agents are first-class citizens with their own\n> leaderboard and a public arena at omerta.fun/arena — and they're excluded from human reward\n> faucets by design, so the competition is on skill.\n"
        }
      ]
    },
    "SPEC.md": {
      "current": {
        "mode": "100644",
        "blob": "84f48d51a9221c6cea2c3f55ca4a2bfdab71fc28",
        "sha256": "36ca0f670daa8946a36715efe2385c5df1e406f502c4ae4259aefba6b1aa8984",
        "bytes": 57155
      },
      "baseline": {
        "mode": "100644",
        "blob": "a1d5fead866c16bc3642a189705a6cf19118f23c",
        "sha256": "229c472a16882a6e27469c7f0d1822eea0a698a6826ec2a26b60244be16d99da",
        "bytes": 57155
      },
      "inverses": [
        {
          "at": 41,
          "current": "\nA complete inventory of the built system, and an honest technical-debt register.\n\nThe census below records the combined release source inventory measured on 2026-11-07. Availability and activation are documented separately in the deployment guides.\n\n---\n\n## 1. Size, measured\n\nCounts were measured for the combined release source on 2026-11-07, before generated release records; they do not identify a deployed revision.\n\n| | |\n|---|---|\n| Backend modules | **613** files, **141073** lines (recursive source inventory) |\n| Test suites | **1009** files, **213491** lines (recursive source inventory) |\n| HTTP routes | **1386** registrations (**1386** unique; 1274 under `/v1`) |\n| Database tables | **585** (`schema.sql`, 9820 lines) |\n| Client | **14683** lines in `public/index.html`; tabbed game interface with locally served Fieldwork and player guidance modules |\n| Ops dashboard + wiki | `public/admin.html`, `public/wiki.html` |\n| Smart contracts | **41** top-level Solidity files, **11590** lines, **1125** declared top-level Foundry test functions; the release gate re-measures the passing suite |\n| Harnesses | `tools/sim.js` (economy), `tools/playthrough.js` (player experience), `tools/pgcheck.js` (real Postgres), `tools/loadtest.js` (concurrency), `tools/chaos.js` (interruption), `tools/mobile.js` (the screens, at phone size), `tools/scale.js` (market liquidity at population scale), `tools/keeper-dials.js` (sizing the stock keeper's price-continuity wall), `tools/pgquery.js` (every SQL string parses on real Postgres), `tools/concurrency.js` (lost-update correctness on real Postgres), `tools/arena.js` (a population of EV-optimizing strategies against the live economy), `tools/arena-sweep.js` (N runs × `--reps` replicates per arena arm, read as a distribution — disjoint ranges only) |\n",
          "baseline": "\nA complete inventory of the built system, and an honest technical-debt register.\n\nThe census below records the combined release source inventory measured on 2026-11-06. Availability and activation are documented separately in the deployment guides.\n\n---\n\n## 1. Size, measured\n\nCounts were measured for the combined release source on 2026-11-06, before generated release records; they do not identify a deployed revision.\n\n| | |\n|---|---|\n| Backend modules | **610** files, **140775** lines (recursive source inventory) |\n| Test suites | **1002** files, **212398** lines (recursive source inventory) |\n| HTTP routes | **1378** registrations (**1378** unique; 1273 under `/v1`) |\n| Database tables | **585** (`schema.sql`, 9820 lines) |\n| Client | **14652** lines in `public/index.html`; tabbed game interface with locally served Fieldwork and player guidance modules |\n| Ops dashboard + wiki | `public/admin.html`, `public/wiki.html` |\n| Smart contracts | **41** top-level Solidity files, **11590** lines, **1125** declared top-level Foundry test functions; the release gate re-measures the passing suite |\n| Harnesses | `tools/sim.js` (economy), `tools/playthrough.js` (player experience), `tools/pgcheck.js` (real Postgres), `tools/loadtest.js` (concurrency), `tools/chaos.js` (interruption), `tools/mobile.js` (the screens, at phone size), `tools/scale.js` (market liquidity at population scale), `tools/keeper-dials.js` (sizing the stock keeper's price-continuity wall), `tools/pgquery.js` (every SQL string parses on real Postgres), `tools/concurrency.js` (lost-update correctness on real Postgres), `tools/arena.js` (a population of EV-optimizing strategies against the live economy), `tools/arena-sweep.js` (N runs × `--reps` replicates per arena arm, read as a distribution — disjoint ranges only) |\n"
        }
      ]
    },
    "omerta-mcp/README.md": {
      "current": {
        "mode": "100644",
        "blob": "57c4fc72568867e878f9118f2d0d58de1a39d007",
        "sha256": "6352d782b1ab6a39c1d07bccd0c773044e57b7d876be9b30ece583413e0b3725",
        "bytes": 9553
      },
      "baseline": {
        "mode": "100644",
        "blob": "d59cf863e352ca503ca91785934a8c72c9c9a089",
        "sha256": "829ab184402a42bf70926dd83520816f345f12ee17fdd13c4a5b26903754583b",
        "bytes": 9225
      },
      "inverses": [
        {
          "at": 6559,
          "current": "session lifecycle described below. Production extraction remains dormant because\nno chain is configured.\n\nNew identities use `POST /v1/auth/agent` without a birth date and are permanently\nclassified as agents before their first bearer is issued. Human signup keeps its\nage check. The MCP saves a shared recovery secret before signup, then saves the\nbearer before acknowledging bootstrap so a lost reply cannot create a new identity.\n\nThe 90-day agent token is persisted in an owner-only configuration file and reused after\nMCP-host restarts. A corrupt or expired session fails closed instead of silently creating\na duplicate agent identity. If that session truly cannot be recovered, call\n",
          "baseline": "session lifecycle described below. Production extraction remains dormant because\nno chain is configured.\n\nThe 90-day agent token is persisted in an owner-only configuration file and reused after\nMCP-host restarts. A corrupt or expired session fails closed instead of silently creating\na duplicate agent identity. If that session truly cannot be recovered, call\n"
        }
      ]
    },
    "package-lock.json": {
      "current": {
        "mode": "100644",
        "blob": "cb692ac8e9381b05a920612cadb51dc2275b85f7",
        "sha256": "20f8360cea8c6565ddf257e0e5846d009a672dd6fd2ef36df5ddff38fa3eaa7f",
        "bytes": 257066
      },
      "baseline": {
        "mode": "100644",
        "blob": "558dc61f9de691962cca03fbe7a54f763e5ee8f9",
        "sha256": "ad275c512da2aabcbd76721cd242dcf10efecf7cd2698742e964c8e8f6ff287a",
        "bytes": 257066
      },
      "inverses": [
        {
          "at": 0,
          "current": "{\n  \"name\": \"omerta-backend\",\n  \"version\": \"1.6.0\",\n  \"lockfileVersion\": 3,\n  \"requires\": true,\n  \"packages\": {\n    \"\": {\n      \"name\": \"omerta-backend\",\n      \"version\": \"1.6.0\",\n      \"hasInstallScript\": true,\n      \"dependencies\": {\n        \"@fastify/jwt\": \"^10.2.0\",\n",
          "baseline": "{\n  \"name\": \"omerta-backend\",\n  \"version\": \"1.5.1\",\n  \"lockfileVersion\": 3,\n  \"requires\": true,\n  \"packages\": {\n    \"\": {\n      \"name\": \"omerta-backend\",\n      \"version\": \"1.5.1\",\n      \"hasInstallScript\": true,\n      \"dependencies\": {\n        \"@fastify/jwt\": \"^10.2.0\",\n"
        }
      ]
    },
    "package.json": {
      "current": {
        "mode": "100644",
        "blob": "bc218d24a127fe29c1c7ef57067674b443dbbd98",
        "sha256": "57a4f021aabaf6c5fd0ef70bbe3ba1dd609fb8c4a98a93e07246fc62bf3cc5a4",
        "bytes": 62904
      },
      "baseline": {
        "mode": "100644",
        "blob": "57f741d8cce297c9ca20f5548f33bd0fc4b0c239",
        "sha256": "f0f37f6059554eeb4fc1db86c0222f68b6c0bc1beb1ed045a8f36bfaad7e3e1d",
        "bytes": 62152
      },
      "inverses": [
        {
          "at": 0,
          "current": "{\n  \"name\": \"omerta-backend\",\n  \"version\": \"1.6.0\",\n  \"type\": \"module\",\n  \"engines\": {\n    \"node\": \">=20\"\n  },\n  \"scripts\": {\n    \"test:site\": \"node test/site-basics-source-transfer.js && node test/site-seo.js && node test/site-basics.js && node test/site-analytics.js && node test/site-analytics-isolation.js\",\n    \"test:site:browser\": \"node test/site-entry-browser.js && node test/client-shell-browser.js\",\n    \"test:player-experience\": \"node test/player-experience.js && node test/player-experience-client.js && node test/player-experience-api.js && npm run test:decision-guide\",\n    \"test:agent-economy-commerce\": \"node test/commerce-source-compatibility.js && node test/commerce-current-native-guard.js && node test/saleattribution.js && node test/saleattribution-witness.js && node test/saleattribution-expiry.js && node test/saleattribution-api.js && node test/saleattribution-estate.js && node test/saleattribution-native-guard.js && node test/merchantloyalty.js && node test/merchantloyalty-accounting.js && node test/merchantloyalty-boundary.js && node test/merchantloyalty-expiry.js && node test/merchantloyalty-estate.js && node test/merchantloyalty-api.js && node test/merchantloyalty-native-guard.js && node test/shoppingbasket.js && node test/shoppingbasket-boundary.js && node test/shoppingbasket-atomicity.js && node test/shoppingbasket-finalization.js && node test/shoppingbasket-expiry.js && node test/shoppingbasket-estate.js && node test/shoppingbasket-api.js && node test/shoppingbasket-native-guard.js && node test/eventmarkets.js && node test/eventmarkets-boundary.js && node test/eventmarkets-integration.js && node test/commercialcampaigns-contracts.js && node test/commercialcampaigns-descriptors.js && node test/commercialcampaigns-metadata.js && node test/commerce-release-phase2-migration-catalog.js\",\n    \"test:agent-economy-commerce:postgres\": \"node tools/commerce-native.js --ci\",\n",
          "baseline": "{\n  \"name\": \"omerta-backend\",\n  \"version\": \"1.5.1\",\n  \"type\": \"module\",\n  \"engines\": {\n    \"node\": \">=20\"\n  },\n  \"scripts\": {\n    \"test:player-experience\": \"node test/player-experience.js && node test/player-experience-client.js && node test/player-experience-api.js && npm run test:decision-guide\",\n    \"test:agent-economy-commerce\": \"node test/commerce-source-compatibility.js && node test/commerce-current-native-guard.js && node test/saleattribution.js && node test/saleattribution-witness.js && node test/saleattribution-expiry.js && node test/saleattribution-api.js && node test/saleattribution-estate.js && node test/saleattribution-native-guard.js && node test/merchantloyalty.js && node test/merchantloyalty-accounting.js && node test/merchantloyalty-boundary.js && node test/merchantloyalty-expiry.js && node test/merchantloyalty-estate.js && node test/merchantloyalty-api.js && node test/merchantloyalty-native-guard.js && node test/shoppingbasket.js && node test/shoppingbasket-boundary.js && node test/shoppingbasket-atomicity.js && node test/shoppingbasket-finalization.js && node test/shoppingbasket-expiry.js && node test/shoppingbasket-estate.js && node test/shoppingbasket-api.js && node test/shoppingbasket-native-guard.js && node test/eventmarkets.js && node test/eventmarkets-boundary.js && node test/eventmarkets-integration.js && node test/commercialcampaigns-contracts.js && node test/commercialcampaigns-descriptors.js && node test/commercialcampaigns-metadata.js && node test/commerce-release-phase2-migration-catalog.js\",\n    \"test:agent-economy-commerce:postgres\": \"node tools/commerce-native.js --ci\",\n"
        },
        {
          "at": 11556,
          "current": "    \"phase2:lots:check\": \"node test/phase2-lot-boundary.js && node test/phase2-lots.js && node test/phase2-lots-property.js\",\n    \"phase2:lots:postgres\": \"node test/phase2-postgres.js --lots\",\n    \"phase2:definitions:postgres\": \"node test/phase2-postgres.js --definitions\",\n    \"test\": \"npm run test:questing && npm run test:ux && node test/classic-interface-source-compatibility.js && npm run test:player-experience && node test/player-intel.js && node test/player-intel-projections.js && node test/player-intel-gates.js && node test/resourceproviders.js && node test/resourceauction.js && node test/resourcepayments.js && node test/resourcecompute.js && node test/resourcework.js && node test/resourcelabor.js && node test/resourcebusiness.js && node test/resourceoutcomes.js && node test/resourcestorefront.js && node test/agentcompany.js && node test/resourceoutcomeobserver.js && node test/businesspolicy.js && node test/business-agent.js && node test/computeexperiment.js && node test/compute-experiment-cli.js && node test/computerouting.js && node test/computeoutcomes.js && node test/compute-router-cli.js && node test/decisionproofs.js && node test/decisionproofs-api.js && node test/resource-agent.js && node test/resource-worker.js && node test/operatingpolicy.js && node test/supplytenders.js && node test/supplytenders-api.js && node test/warehouseleases.js && node test/warehouseleases-api.js && node test/crewlogistics.js && node test/crewlogistics-api.js && node test/franchiselicenses.js && node test/franchiselicenses-api.js && node test/intelforecasts.js && node test/intelforecastjobs.js && node test/intelforecastjobs-api.js && node test/rc1-intel-source-compatibility.js && node test/rc1-loan-source-compatibility.js && node test/rc1-invoice-source-compatibility.js && node test/deliveryfinanceterms.js && node test/deliveryfinance.js && node test/deliveryfinance-guards.js && node test/deliveryfinance-api.js && node test/logisticscoverageterms.js && node test/logisticscoverage-event-clock.js && node test/logisticscoverage.js && node test/logisticscoverage-api.js && node test/rc1-logistics-coverage-source-compatibility.js && node test/strategylicenses.js && node test/strategylicenses-api.js && node test/rc1-strategy-source-compatibility.js && node test/companysuccession.js && node test/companysuccession-api.js && node test/rc1-company-succession-source-compatibility.js && node test/marketfeed.js && node test/marketfeed-api.js && node test/rc1-market-feed-source-compatibility.js && node test/strategyleagues.js && node test/strategyleagues-api.js && node test/rc1-strategy-league-source-compatibility.js && node test/supplier-history.js && node test/delivery.js && node test/depot.js && node test/restock.js && node test/restock-api.js && node test/smoke.js && node test/persist.js && node test/economy.js && node test/business-settlement.js && node test/goods-market.js && node test/social.js && node test/growth.js && node test/hardening.js && node test/agent-alpha.js && node test/agent-cohort.js && node test/agentturn.js && node test/agentturn-jail-units.js && node test/local-agent-human-coordination.js && node test/agent-turn-cadence.js && node test/security.js && node test/chain.js && node test/watcher.js && node test/vig.js && node test/casino.js && node test/heists.js && node test/convoy.js && node test/commission.js && node test/stockcatalog.js && node test/stockcatalogv2.js && node test/market.js && node test/skills.js && node test/underworld.js && node test/law.js && node test/world.js && node test/npcwar.js && node test/pen.js && node test/loans.js && node test/portfolio.js && node test/estate.js && node test/deeds.js && node test/auction.js && node test/wire.js && node test/store.js && node test/pass.js && node test/landmarks.js && node test/speakeasy.js && node test/boxing.js && node test/inventory-bond-checkout.js && node test/bonds.js && node test/races.js && node test/port.js && node test/stable.js && node test/migrate.js && node test/emission.js && node test/desk.js && node test/made.js && node test/nft.js && node test/reimport.js && node test/walletforge.js && node test/expansion.js && node test/dynasty.js && node test/intrigue.js && node test/megaproject.js && node test/duels.js && node test/clues.js && node test/seasons.js && node test/ring.js && node test/standing.js && node test/sacking.js && node test/shields.js && node test/population.js && node test/tokenomics.js && node test/treasury.js && node test/stockdeliver.js && node test/dexbot.js && node test/mastery.js && node test/activity.js && node test/brokers.js && node test/deed-upgrades.js && node test/deed-upgrade-ownership.js && node test/bank.js && node test/community.js && node test/tokenhealth.js && node test/regimen.js && node test/career.js && node test/favors.js && node test/crew.js && node test/firstblood.js && node test/firstblood-intel.js && node test/discovery.js && node test/mentor.js && node test/events.js && node test/results.js && node test/vouch.js && node test/streak.js && node test/circle.js && node test/collision.js && node test/firsts.js && node test/runs.js && node test/shipment.js && node test/avatar.js && node test/portrait.js && node test/nft-art.js && node test/portrait-access.js && node test/push.js && node test/dispatch.js && node test/pwa.js && node test/people.js && node test/citywire.js && node test/bulletin.js && node test/explore.js && node test/primetime.js && node test/citymap.js && node test/day.js && node test/payroll.js && node test/home.js && node test/streets.js && node test/citywide.js && node test/drop.js && node test/sweeps.js && node test/tax.js && node test/router.js && node test/auth.js && node test/agent-onboarding.js && node test/rules.js && node test/path-funnel.js && node test/routes.js && node test/diagram-renderer.js && node test/coldstart.js && node test/preflight.js && node test/client-ip.js && node test/client.js && node test/engagement.js && node test/levers.js && node test/graph.js && node test/gates.js && node test/chainparams.js && node test/docs.js && node test/playthrough-truth.js && node tools/knowledge-test.js && node test/genesisauction.js && node test/genesis-auction-http.js && node test/player-genesis-client.js && node test/genesis-auction-operations.js && node test/genesis-deploy-client.js && node test/city-presence.js && node test/city-presence-api.js && node test/city-activity.js && node test/city-social-api.js && node test/city-homes-api.js && npm run test:city:layout && npm run test:city-gameplay && npm run test:company-workforce && npm run test:company-commercial && npm run test:company-autonomy && node test/wiki-economy-media.js\",\n    \"content:check\": \"npm run content:check:corpus\",\n    \"content:check:corpus\": \"node tools/content.js check-corpus content/packs\",\n    \"content:build\": \"node tools/content.js build content/packs/sixth-chair-v2/pack.json content/dist/sixth-chair-v2.json\",\n",
          "baseline": "    \"phase2:lots:check\": \"node test/phase2-lot-boundary.js && node test/phase2-lots.js && node test/phase2-lots-property.js\",\n    \"phase2:lots:postgres\": \"node test/phase2-postgres.js --lots\",\n    \"phase2:definitions:postgres\": \"node test/phase2-postgres.js --definitions\",\n    \"test\": \"npm run test:questing && npm run test:ux && node test/classic-interface-source-compatibility.js && npm run test:player-experience && node test/player-intel.js && node test/player-intel-projections.js && node test/player-intel-gates.js && node test/resourceproviders.js && node test/resourceauction.js && node test/resourcepayments.js && node test/resourcecompute.js && node test/resourcework.js && node test/resourcelabor.js && node test/resourcebusiness.js && node test/resourceoutcomes.js && node test/resourcestorefront.js && node test/agentcompany.js && node test/resourceoutcomeobserver.js && node test/businesspolicy.js && node test/business-agent.js && node test/computeexperiment.js && node test/compute-experiment-cli.js && node test/computerouting.js && node test/computeoutcomes.js && node test/compute-router-cli.js && node test/decisionproofs.js && node test/decisionproofs-api.js && node test/resource-agent.js && node test/resource-worker.js && node test/operatingpolicy.js && node test/supplytenders.js && node test/supplytenders-api.js && node test/warehouseleases.js && node test/warehouseleases-api.js && node test/crewlogistics.js && node test/crewlogistics-api.js && node test/franchiselicenses.js && node test/franchiselicenses-api.js && node test/intelforecasts.js && node test/intelforecastjobs.js && node test/intelforecastjobs-api.js && node test/rc1-intel-source-compatibility.js && node test/rc1-loan-source-compatibility.js && node test/rc1-invoice-source-compatibility.js && node test/deliveryfinanceterms.js && node test/deliveryfinance.js && node test/deliveryfinance-guards.js && node test/deliveryfinance-api.js && node test/logisticscoverageterms.js && node test/logisticscoverage-event-clock.js && node test/logisticscoverage.js && node test/logisticscoverage-api.js && node test/rc1-logistics-coverage-source-compatibility.js && node test/strategylicenses.js && node test/strategylicenses-api.js && node test/rc1-strategy-source-compatibility.js && node test/companysuccession.js && node test/companysuccession-api.js && node test/rc1-company-succession-source-compatibility.js && node test/marketfeed.js && node test/marketfeed-api.js && node test/rc1-market-feed-source-compatibility.js && node test/strategyleagues.js && node test/strategyleagues-api.js && node test/rc1-strategy-league-source-compatibility.js && node test/supplier-history.js && node test/delivery.js && node test/depot.js && node test/restock.js && node test/restock-api.js && node test/smoke.js && node test/persist.js && node test/economy.js && node test/goods-market.js && node test/social.js && node test/growth.js && node test/hardening.js && node test/agent-alpha.js && node test/agentturn.js && node test/security.js && node test/chain.js && node test/watcher.js && node test/vig.js && node test/casino.js && node test/heists.js && node test/convoy.js && node test/commission.js && node test/stockcatalog.js && node test/stockcatalogv2.js && node test/market.js && node test/skills.js && node test/underworld.js && node test/law.js && node test/world.js && node test/npcwar.js && node test/pen.js && node test/loans.js && node test/portfolio.js && node test/estate.js && node test/deeds.js && node test/auction.js && node test/wire.js && node test/store.js && node test/pass.js && node test/landmarks.js && node test/speakeasy.js && node test/boxing.js && node test/inventory-bond-checkout.js && node test/bonds.js && node test/races.js && node test/port.js && node test/stable.js && node test/migrate.js && node test/emission.js && node test/desk.js && node test/made.js && node test/nft.js && node test/reimport.js && node test/walletforge.js && node test/expansion.js && node test/dynasty.js && node test/intrigue.js && node test/megaproject.js && node test/duels.js && node test/clues.js && node test/seasons.js && node test/ring.js && node test/standing.js && node test/sacking.js && node test/shields.js && node test/population.js && node test/tokenomics.js && node test/treasury.js && node test/stockdeliver.js && node test/dexbot.js && node test/mastery.js && node test/activity.js && node test/brokers.js && node test/deed-upgrades.js && node test/deed-upgrade-ownership.js && node test/bank.js && node test/community.js && node test/tokenhealth.js && node test/regimen.js && node test/career.js && node test/favors.js && node test/crew.js && node test/firstblood.js && node test/discovery.js && node test/mentor.js && node test/events.js && node test/results.js && node test/vouch.js && node test/streak.js && node test/circle.js && node test/collision.js && node test/firsts.js && node test/runs.js && node test/shipment.js && node test/avatar.js && node test/portrait.js && node test/nft-art.js && node test/portrait-access.js && node test/push.js && node test/dispatch.js && node test/pwa.js && node test/people.js && node test/citywire.js && node test/bulletin.js && node test/explore.js && node test/primetime.js && node test/citymap.js && node test/day.js && node test/payroll.js && node test/home.js && node test/streets.js && node test/citywide.js && node test/drop.js && node test/sweeps.js && node test/tax.js && node test/router.js && node test/auth.js && node test/rules.js && node test/path-funnel.js && node test/routes.js && node test/diagram-renderer.js && node test/coldstart.js && node test/preflight.js && node test/client-ip.js && node test/client.js && node test/engagement.js && node test/levers.js && node test/graph.js && node test/gates.js && node test/chainparams.js && node test/docs.js && node test/playthrough-truth.js && node tools/knowledge-test.js && node test/genesisauction.js && node test/genesis-auction-http.js && node test/player-genesis-client.js && node test/genesis-auction-operations.js && node test/genesis-deploy-client.js && node test/city-presence.js && node test/city-presence-api.js && node test/city-activity.js && node test/city-social-api.js && node test/city-homes-api.js && npm run test:city:layout && npm run test:city-gameplay && npm run test:company-workforce && npm run test:company-commercial && npm run test:company-autonomy && node test/wiki-economy-media.js\",\n    \"content:check\": \"npm run content:check:corpus\",\n    \"content:check:corpus\": \"node tools/content.js check-corpus content/packs\",\n    \"content:build\": \"node tools/content.js build content/packs/sixth-chair-v2/pack.json content/dist/sixth-chair-v2.json\",\n"
        },
        {
          "at": 59292,
          "current": "    \"test:city:layout\": \"node test/city-world-layout.js && node test/continuous-city-source-compatibility.js\",\n    \"test:decision-guide\": \"node test/decision-guide.js && node test/decision-guide-client.js && node test/decision-guide-api.js\",\n    \"test:ux\": \"npm run test:ux:source && node test/ux-feedback.js && node test/circle-highlights.js && node test/ux-workspace.js && node test/ux-tactics.js && node test/ux-investigation-api.js && node test/ux-coordination.js && node test/ux-identity.js && node test/ux-story.js && node test/ux-community.js && node test/ux-tools.js\",\n    \"test:ux:browser\": \"node test/ux-shell-browser.js && node test/ux-progression-browser.js && node test/ux-navigation-browser.js && node test/ux-social-browser.js && node test/ux-experience-browser.js && node test/ux-workspace-browser.js && node test/ux-tactics-browser.js && node test/ux-investigation-browser.js && node test/ux-coordination-browser.js && node test/ux-expanded-browser.js && node test/ux-feel-browser.js && node test/ux-tools-browser.js && node test/ux-identity-browser.js && node test/ux-story-browser.js && node test/ux-community-browser.js && node test/ux-personality-browser.js && npm run test:site && npm run test:site:browser\",\n    \"test:ux:postgres\": \"node test/ux-postgres.js && node test/ux-postgres-rls.js\",\n    \"test:ux:source\": \"node test/noir-ui-source-compatibility.js && node test/sale-source-compatibility.js && node test/ux-source-compatibility.js\",\n    \"test:economy-ux-source\": \"node test/contract-release-source-compatibility.js && node test/businessdesk-combined-source-compatibility.js && node test/businessdesk-combined-native-provenance.js && node test/economy-deed-merge-source-compatibility.js && node test/businessdesk-noir-source-compatibility.js && node test/businessdesk-source-compatibility.js && node test/deed-allocation-source-compatibility.js && node test/deed-benefit-native-catalog.js && node test/economy-ux-merge-source-compatibility.js\",\n",
          "baseline": "    \"test:city:layout\": \"node test/city-world-layout.js && node test/continuous-city-source-compatibility.js\",\n    \"test:decision-guide\": \"node test/decision-guide.js && node test/decision-guide-client.js && node test/decision-guide-api.js\",\n    \"test:ux\": \"npm run test:ux:source && node test/ux-feedback.js && node test/circle-highlights.js && node test/ux-workspace.js && node test/ux-tactics.js && node test/ux-investigation-api.js && node test/ux-coordination.js && node test/ux-identity.js && node test/ux-story.js && node test/ux-community.js && node test/ux-tools.js\",\n    \"test:ux:browser\": \"node test/ux-shell-browser.js && node test/ux-progression-browser.js && node test/ux-navigation-browser.js && node test/ux-social-browser.js && node test/ux-experience-browser.js && node test/ux-workspace-browser.js && node test/ux-tactics-browser.js && node test/ux-investigation-browser.js && node test/ux-coordination-browser.js && node test/ux-expanded-browser.js && node test/ux-feel-browser.js && node test/ux-tools-browser.js && node test/ux-identity-browser.js && node test/ux-story-browser.js && node test/ux-community-browser.js && node test/ux-personality-browser.js\",\n    \"test:ux:postgres\": \"node test/ux-postgres.js && node test/ux-postgres-rls.js\",\n    \"test:ux:source\": \"node test/noir-ui-source-compatibility.js && node test/sale-source-compatibility.js && node test/ux-source-compatibility.js\",\n    \"test:economy-ux-source\": \"node test/contract-release-source-compatibility.js && node test/businessdesk-combined-source-compatibility.js && node test/businessdesk-combined-native-provenance.js && node test/economy-deed-merge-source-compatibility.js && node test/businessdesk-noir-source-compatibility.js && node test/businessdesk-source-compatibility.js && node test/deed-allocation-source-compatibility.js && node test/deed-benefit-native-catalog.js && node test/economy-ux-merge-source-compatibility.js\",\n"
        },
        {
          "at": 61585,
          "current": "    \"test:eth-staking:browser\": \"node test/eth-staking.js --browser\",\n    \"test:questing\": \"node test/content-narrative.js && node test/content-narrative-security.js && node test/content-casework.js && node test/quest-saga.js && node test/quest-saga-social.js && node test/quest-specialist.js && node test/quest-workshop.js && node test/clue-puzzles.js && node test/content-api.js\",\n    \"test:questing:browser\": \"node test/quest-experience-browser.js && node test/clue-puzzles-browser.js\",\n    \"questing:check\": \"node tools/questing-content.js check && node tools/questing-workgraph.js check --complete\",\n    \"test:questing:postgres\": \"node test/questing-postgres.js\",\n    \"test:agent-onboarding:postgres\": \"node test/agent-onboarding-postgres.js\",\n    \"test:casino-rakeback:postgres\": \"node test/casino-rakeback-postgres.js\"\n  },\n  \"dependencies\": {\n    \"@fastify/jwt\": \"^10.2.0\",\n",
          "baseline": "    \"test:eth-staking:browser\": \"node test/eth-staking.js --browser\",\n    \"test:questing\": \"node test/content-narrative.js && node test/content-narrative-security.js && node test/content-casework.js && node test/quest-saga.js && node test/quest-saga-social.js && node test/quest-specialist.js && node test/quest-workshop.js && node test/clue-puzzles.js && node test/content-api.js\",\n    \"test:questing:browser\": \"node test/quest-experience-browser.js && node test/clue-puzzles-browser.js\",\n    \"questing:check\": \"node tools/questing-content.js check && node tools/questing-workgraph.js check\",\n    \"test:questing:postgres\": \"node test/questing-postgres.js\"\n  },\n  \"dependencies\": {\n    \"@fastify/jwt\": \"^10.2.0\",\n"
        }
      ]
    },
    "public/admin.html": {
      "current": {
        "mode": "100644",
        "blob": "0ec72d4db8a1c09a9881e611c825b97d231db07d",
        "sha256": "60285ad56d13d2dd67433e2f845f03a366aa8e36760047d2711ca85795367054",
        "bytes": 102600
      },
      "baseline": {
        "mode": "100644",
        "blob": "e3941b7cdbd15fd45e58f3c9bf07ef71b38b0752",
        "sha256": "c8df61887195c23e7f9513bb723ce28bec14fd4e34874533304b9c8d5d97960b",
        "bytes": 100281
      },
      "inverses": [
        {
          "at": 14517,
          "current": "    <div class=\"panel\" id=\"p-economy\"><h2>Economy</h2><div class=\"body\">…</div></div>\n    <div class=\"panel\" id=\"p-players\"><h2>Players</h2><div class=\"body\">…</div></div>\n    <div class=\"panel\" id=\"p-funnel\"><h2>Onboarding progress</h2><div class=\"body\">…</div></div>\n    <div class=\"panel\" id=\"p-site-analytics\"><h2>Public site analytics</h2><div class=\"body\" aria-live=\"polite\">Loading optional counts…</div></div>\n    <div class=\"panel\" id=\"p-coach\"><h2>Current coach prompts</h2><div class=\"body\">…</div></div>\n    <div class=\"panel\" id=\"p-engage\"><h2>Engagement &amp; retention</h2><div class=\"body\">…</div></div>\n    <div class=\"panel\" id=\"p-top\"><h2>The Powerful</h2><div class=\"body\">…</div></div>\n",
          "baseline": "    <div class=\"panel\" id=\"p-economy\"><h2>Economy</h2><div class=\"body\">…</div></div>\n    <div class=\"panel\" id=\"p-players\"><h2>Players</h2><div class=\"body\">…</div></div>\n    <div class=\"panel\" id=\"p-funnel\"><h2>Onboarding progress</h2><div class=\"body\">…</div></div>\n    <div class=\"panel\" id=\"p-coach\"><h2>Current coach prompts</h2><div class=\"body\">…</div></div>\n    <div class=\"panel\" id=\"p-engage\"><h2>Engagement &amp; retention</h2><div class=\"body\">…</div></div>\n    <div class=\"panel\" id=\"p-top\"><h2>The Powerful</h2><div class=\"body\">…</div></div>\n"
        },
        {
          "at": 20826,
          "current": "    $('#dash').setAttribute('aria-busy', 'true');\n    $('#status').textContent = 'refreshing…';\n    const [ov, inv, fn, res, vig, em, act, rev, eng, bnd, tre, coa, intg, rtr, cpar, bkv, com, thl,\n      rwaBallot, rwaEpochs, rwaBudget, rwaDeliveries, siteAnalytics] = await Promise.all([\n      j('GET', '/v1/mod/overview'), j('GET', '/v1/mod/invariants'), j('GET', '/v1/mod/funnel'),\n      j('GET', '/v1/mod/reserve'), j('GET', '/v1/mod/vig'), j('GET', '/v1/mod/emission'),\n      j('GET', '/v1/mod/activity?limit=60'), j('GET', '/v1/mod/revenue'),\n",
          "baseline": "    $('#dash').setAttribute('aria-busy', 'true');\n    $('#status').textContent = 'refreshing…';\n    const [ov, inv, fn, res, vig, em, act, rev, eng, bnd, tre, coa, intg, rtr, cpar, bkv, com, thl,\n      rwaBallot, rwaEpochs, rwaBudget, rwaDeliveries] = await Promise.all([\n      j('GET', '/v1/mod/overview'), j('GET', '/v1/mod/invariants'), j('GET', '/v1/mod/funnel'),\n      j('GET', '/v1/mod/reserve'), j('GET', '/v1/mod/vig'), j('GET', '/v1/mod/emission'),\n      j('GET', '/v1/mod/activity?limit=60'), j('GET', '/v1/mod/revenue'),\n"
        },
        {
          "at": 21563,
          "current": "      j('GET', '/v1/mod/chain/params'), j('GET', '/v1/mod/bank'), j('GET', '/v1/mod/community'),\n      j('GET', '/v1/mod/tokenhealth'), j('GET', '/v1/commission/ticker'),\n      j('GET', '/v1/mod/brokers'), j('GET', '/v1/mod/treasury/budget'),\n      j('GET', '/v1/mod/treasury/deliveries'), j('GET', '/v1/mod/site-analytics'),\n    ]);\n    $('#dash').removeAttribute('aria-busy');\n    if (ov.code === 401) return $('#logout').onclick();\n",
          "baseline": "      j('GET', '/v1/mod/chain/params'), j('GET', '/v1/mod/bank'), j('GET', '/v1/mod/community'),\n      j('GET', '/v1/mod/tokenhealth'), j('GET', '/v1/commission/ticker'),\n      j('GET', '/v1/mod/brokers'), j('GET', '/v1/mod/treasury/budget'),\n      j('GET', '/v1/mod/treasury/deliveries'),\n    ]);\n    $('#dash').removeAttribute('aria-busy');\n    if (ov.code === 401) return $('#logout').onclick();\n"
        },
        {
          "at": 23523,
          "current": "\n    $('#stamp').textContent = 'as of ' + new Date().toLocaleTimeString();\n    renderIntegrity(inv.body); renderEconomy(ov.body, em.body); renderPlayers(ov.body); renderEngagement(eng.body);\n    renderSiteAnalytics(siteAnalytics);\n    renderFunnel(fn.body); renderTop(ov.body); renderChain(res.body, vig.body, em.body, rev.body, bnd.body, tre, ov.body, bkv.body, com.body); renderRouter(rtr.body); renderTokenHealth(thl.body);\n    renderBackups(ov.body); renderSocial(ov.body); renderCoach(coa.body);\n    renderIntegrations(intg.body); window.__cpar = (cpar.body && cpar.body.rows) || []; renderChainParams(cpar.body);\n",
          "baseline": "\n    $('#stamp').textContent = 'as of ' + new Date().toLocaleTimeString();\n    renderIntegrity(inv.body); renderEconomy(ov.body, em.body); renderPlayers(ov.body); renderEngagement(eng.body);\n    renderFunnel(fn.body); renderTop(ov.body); renderChain(res.body, vig.body, em.body, rev.body, bnd.body, tre, ov.body, bkv.body, com.body); renderRouter(rtr.body); renderTokenHealth(thl.body);\n    renderBackups(ov.body); renderSocial(ov.body); renderCoach(coa.body);\n    renderIntegrations(intg.body); window.__cpar = (cpar.body && cpar.body.rows) || []; renderChainParams(cpar.body);\n"
        },
        {
          "at": 39716,
          "current": "      `<div class=\"note\">${fmt(c.surveyed)} active players surveyed (last ${c.activeWindowDays}d) · ${fmt(c.silent)} with a quiet coach</div>`\n      + (rows || '<div class=\"note\">No players were active during this window.</div>');\n  }\n  function renderSiteAnalytics(response) {\n    const panel = $('#p-site-analytics .body');\n    const data = response?.body;\n    if (response?.code !== 200 || !data?.totals) {\n      panel.textContent = 'Optional counts are unavailable. Refresh to retry.';\n      return;\n    }\n    const pages = new Map();\n    for (const row of data.rows || []) {\n      const completion = row.target === 'signup_success' ? 'Guest signups' : 'First-job milestones claimed';\n      const label = row.event === 'cta' ? `${row.page} → ${row.target === 'guest_start' ? 'Play as guest' : row.target}`\n        : row.event === 'completion' ? completion : row.page;\n      const key = `${row.event}:${label}`;\n      const previous = pages.get(key);\n      pages.set(key, { label, event: row.event, count: (previous?.count || 0) + Number(row.count || 0) });\n    }\n    const top = [...pages.values()].sort((a, b) => b.count - a.count).slice(0, 12);\n    panel.innerHTML = `<div class=\"row\"><span class=\"k\">page views</span><span class=\"v\">${fmt(data.totals.pageviews)}</span></div>`\n      + `<div class=\"row\"><span class=\"k\">public CTA clicks</span><span class=\"v\">${fmt(data.totals.ctaClicks)}</span></div>`\n      + `<div class=\"row\"><span class=\"k\">guest signups</span><span class=\"v\">${fmt(data.totals.guestSignups || 0)}</span></div>`\n      + `<div class=\"row\"><span class=\"k\">first-job milestones claimed</span><span class=\"v\">${fmt(data.totals.firstJobMilestones || 0)}</span></div>`\n      + `<div class=\"note\">Opted-in counts since ${esc(data.since)}. First-job milestones are counted when their one-time reward is claimed. Browser privacy signals are respected. These are event totals, not unique visitors or conversion rates.</div>`\n      + (top.length ? top.map(row => `<div class=\"row\"><span class=\"k\">${esc(row.label)}${row.event === 'cta' ? ' · clicks' : row.event === 'completion' ? ' · completions' : ' · views'}</span><span class=\"v\">${fmt(row.count)}</span></div>`).join('')\n        : '<div class=\"note\">No optional counts yet. Visitors can enable them in Analytics choices.</div>');\n  }\n\n  function renderFunnel(fn) {\n    if (!fn) return;\n    const lv = fn.levels || {}, pr = fn.progression || {}, fw = fn.firstWeek || {};\n",
          "baseline": "      `<div class=\"note\">${fmt(c.surveyed)} active players surveyed (last ${c.activeWindowDays}d) · ${fmt(c.silent)} with a quiet coach</div>`\n      + (rows || '<div class=\"note\">No players were active during this window.</div>');\n  }\n  function renderFunnel(fn) {\n    if (!fn) return;\n    const lv = fn.levels || {}, pr = fn.progression || {}, fw = fn.firstWeek || {};\n"
        }
      ]
    },
    "public/index.html": {
      "current": {
        "mode": "100644",
        "blob": "11b57ab1ec441c17437d65b24c6be531864b21d7",
        "sha256": "74f874f43f5c5c664f8e23cd50dd1be44d153ea2b9b08ebc2d45aa650458c3f2",
        "bytes": 1407572
      },
      "baseline": {
        "mode": "100644",
        "blob": "36c06ad5170cd87784b1161efd0048bb2ff003b2",
        "sha256": "7437ba8597018e1cbeabb61975283c1086cc9813c4d98cf1daf6e95f257d58a0",
        "bytes": 1405906
      },
      "inverses": [
        {
          "at": 761,
          "current": "<meta name=\"apple-mobile-web-app-title\" content=\"OMERTÀ\">\n<link rel=\"apple-touch-icon\" href=\"/apple-touch-icon.png\">\n<link rel=\"preload\" href=\"/art/display.woff2\" as=\"font\" type=\"font/woff2\" crossorigin>\n<title>OMERTÀ | Multiplayer mafia browser game</title>\n<meta name=\"description\" content=\"Play a free multiplayer mafia browser game alongside people and AI agents. Run jobs, build a family, and survive the city. On-chain features are not active in production.\">\n<link rel=\"canonical\" href=\"https://www.omerta.fun/\">\n<meta property=\"og:type\" content=\"website\">\n<meta property=\"og:url\" content=\"https://www.omerta.fun/\">\n<meta property=\"og:title\" content=\"OMERTÀ | Multiplayer mafia browser game\">\n<meta property=\"og:description\" content=\"Run jobs, build a family, and survive a shared mafia city alongside people and AI agents. Play free. On-chain features are not active in production.\">\n<meta property=\"og:image\" content=\"https://www.omerta.fun/art/hero-backdrop.jpg\">\n<meta name=\"twitter:card\" content=\"summary_large_image\">\n<meta name=\"twitter:title\" content=\"OMERTÀ | Multiplayer mafia browser game\">\n<meta name=\"twitter:description\" content=\"Run jobs, build a family, and survive a shared mafia city alongside people and AI agents. Play free. On-chain features are not active in production.\">\n<meta name=\"twitter:image\" content=\"https://www.omerta.fun/art/hero-backdrop.jpg\">\n<!-- Machine discovery: agents & LLMs. See /agents (quickstart), /openapi.json (API), /llms.txt, /v1/rules. -->\n",
          "baseline": "<meta name=\"apple-mobile-web-app-title\" content=\"OMERTÀ\">\n<link rel=\"apple-touch-icon\" href=\"/apple-touch-icon.png\">\n<link rel=\"preload\" href=\"/art/display.woff2\" as=\"font\" type=\"font/woff2\" crossorigin>\n<title>OMERTÀ | Multiplayer mafia RPG</title>\n<meta name=\"description\" content=\"Play a free multiplayer mafia RPG alongside people and AI agents. Run jobs, build a family, and survive the city. On-chain features are not active in production.\">\n<link rel=\"canonical\" href=\"https://www.omerta.fun/\">\n<meta property=\"og:type\" content=\"website\">\n<meta property=\"og:url\" content=\"https://www.omerta.fun/\">\n<meta property=\"og:title\" content=\"OMERTÀ | Multiplayer mafia RPG\">\n<meta property=\"og:description\" content=\"Run jobs, build a family, and survive a shared mafia city alongside people and AI agents. Play free. On-chain features are not active in production.\">\n<meta property=\"og:image\" content=\"https://www.omerta.fun/art/hero-backdrop.jpg\">\n<meta name=\"twitter:card\" content=\"summary_large_image\">\n<meta name=\"twitter:title\" content=\"OMERTÀ | Multiplayer mafia RPG\">\n<meta name=\"twitter:description\" content=\"Run jobs, build a family, and survive a shared mafia city alongside people and AI agents. Play free. On-chain features are not active in production.\">\n<meta name=\"twitter:image\" content=\"https://www.omerta.fun/art/hero-backdrop.jpg\">\n<!-- Machine discovery: agents & LLMs. See /agents (quickstart), /openapi.json (API), /llms.txt, /v1/rules. -->\n"
        },
        {
          "at": 2583,
          "current": "{\n  \"@context\": \"https://schema.org\",\n  \"@type\": \"VideoGame\",\n  \"@id\": \"https://www.omerta.fun/#game\",\n  \"url\": \"https://www.omerta.fun/\",\n  \"name\": \"OMERTÀ\",\n  \"description\": \"A multiplayer mafia RPG where people and AI agents share a persistent city. Run jobs, build a family, and trade items tracked by the server. On-chain settlement is implemented but not active in production.\",\n  \"genre\": [\"MMORPG\", \"Strategy\", \"Crypto\"],\n",
          "baseline": "{\n  \"@context\": \"https://schema.org\",\n  \"@type\": \"VideoGame\",\n  \"name\": \"OMERTÀ\",\n  \"description\": \"A multiplayer mafia RPG where people and AI agents share a persistent city. Run jobs, build a family, and trade items tracked by the server. On-chain settlement is implemented but not active in production.\",\n  \"genre\": [\"MMORPG\", \"Strategy\", \"Crypto\"],\n"
        },
        {
          "at": 111707,
          "current": "    <p class=\"d\">Read our <a href=\"/privacy\">Privacy policy</a> and <a href=\"/terms\">Terms</a> before creating a street.</p>\n    <div id=\"enter-city\"><button class=\"act cta\" id=\"btn-guest\" data-i18n=\"e_ghost\">PLAY AS A GUEST</button></div>\n    <div class=\"ctahint\">Play without a wallet or email. Link your street to X or Privy later.</div>\n    <p id=\"guest-status\" class=\"ctahint\" role=\"status\" aria-live=\"polite\" hidden></p>\n    <nav class=\"hero-index\" aria-label=\"Explore this page\"><a href=\"#city-guide\">The gameplay</a><a href=\"#choose-your-path\">Your Path</a><a href=\"#agent-players\">AI players</a><a href=\"#omr-economy\">The money</a></nav>\n    <div class=\"wire-ticker\" data-feed-mode=\"editorial\"><span class=\"wl\">SCENES FROM THE CITY</span><span id=\"wire-line\">opening a case file&hellip;</span><button class=\"act\" id=\"wire-toggle\" type=\"button\" aria-pressed=\"false\" aria-label=\"Pause city scenes\">pause</button></div>\n    <button class=\"act hero-motion hidden\" id=\"hero-motion\" type=\"button\" aria-pressed=\"false\">Animate scene</button>\n",
          "baseline": "    <p class=\"d\">Read our <a href=\"/privacy\">Privacy policy</a> and <a href=\"/terms\">Terms</a> before creating a street.</p>\n    <div id=\"enter-city\"><button class=\"act cta\" id=\"btn-guest\" data-i18n=\"e_ghost\">PLAY AS A GUEST</button></div>\n    <div class=\"ctahint\">Play without a wallet or email. Link your street to X or Privy later.</div>\n    <nav class=\"hero-index\" aria-label=\"Explore this page\"><a href=\"#city-guide\">The gameplay</a><a href=\"#choose-your-path\">Your Path</a><a href=\"#agent-players\">AI players</a><a href=\"#omr-economy\">The money</a></nav>\n    <div class=\"wire-ticker\" data-feed-mode=\"editorial\"><span class=\"wl\">SCENES FROM THE CITY</span><span id=\"wire-line\">opening a case file&hellip;</span><button class=\"act\" id=\"wire-toggle\" type=\"button\" aria-pressed=\"false\" aria-label=\"Pause city scenes\">pause</button></div>\n    <button class=\"act hero-motion hidden\" id=\"hero-motion\" type=\"button\" aria-pressed=\"false\">Animate scene</button>\n"
        },
        {
          "at": 115491,
          "current": "  <div class=\"artifact-deck landing-routes\" aria-label=\"Choose how to enter OMERTÀ\">\n    <a class=\"artifact-card\" href=\"#enter-city\"><span class=\"artifact-card__label\">Play yourself</span><strong>Start a street</strong><p>Play free and link your account later to keep your progress.</p></a>\n    <a class=\"artifact-card\" href=\"/play\"><span class=\"artifact-card__label\">Bring an AI</span><strong>Set up an agent</strong><p>Connect through MCP or the API, with a guide written for agents.</p></a>\n    <a class=\"artifact-card\" href=\"/guides/getting-started\"><span class=\"artifact-card__label\">New to the city?</span><strong>Read the beginner guide</strong><p>Choose a Path, make your first moves, and learn what puts your character at risk.</p></a>\n  </div>\n\n  <section class=\"operation-proof\" aria-labelledby=\"operation-proof-title\">\n",
          "baseline": "  <div class=\"artifact-deck landing-routes\" aria-label=\"Choose how to enter OMERTÀ\">\n    <a class=\"artifact-card\" href=\"#enter-city\"><span class=\"artifact-card__label\">Play yourself</span><strong>Start a street</strong><p>Play free and link your account later to keep your progress.</p></a>\n    <a class=\"artifact-card\" href=\"/play\"><span class=\"artifact-card__label\">Bring an AI</span><strong>Set up an agent</strong><p>Connect through MCP or the API, with a guide written for agents.</p></a>\n    <a class=\"artifact-card\" href=\"/wiki\"><span class=\"artifact-card__label\">Learn the rules</span><strong>Open the Codex</strong><p>Look up jobs, costs, risks, and the rest of the city.</p></a>\n  </div>\n\n  <section class=\"operation-proof\" aria-labelledby=\"operation-proof-title\">\n"
        },
        {
          "at": 533387,
          "current": "      // the \"Last Word\" viewer shows the ACTION result (written here, before refresh's GET /v1/me\n      // would otherwise overwrite it — the raw JSON for the deck / power users; the toast is the human read).\n      $('#resp').textContent = `${method} ${path}\\n` + JSON.stringify(r.body, null, 2);\n      window.OmertaSiteAnalytics?.firstJobResult(method, path, r);\n      _operationResponseCurrent = () => actorCurrent() && (!options.isCurrent || options.isCurrent());\n      // a location refusal comes back naming the district (GameError data) — offer the ride rather\n      // than leaving the player to find the travel control on one screen out of 25\n",
          "baseline": "      // the \"Last Word\" viewer shows the ACTION result (written here, before refresh's GET /v1/me\n      // would otherwise overwrite it — the raw JSON for the deck / power users; the toast is the human read).\n      $('#resp').textContent = `${method} ${path}\\n` + JSON.stringify(r.body, null, 2);\n      _operationResponseCurrent = () => actorCurrent() && (!options.isCurrent || options.isCurrent());\n      // a location refusal comes back naming the district (GameError data) — offer the ride rather\n      // than leaving the player to find the travel control on one screen out of 25\n"
        },
        {
          "at": 588582,
          "current": "  }\n  $('#btn-down-retry').onclick = () => { downStop(); $('#down-tick').textContent = 'trying again…'; boot(); };\n\n  const landToken = async (r) => {\n    if (r.body?.token) { token = r.body.token; projections.setSession(token); localStorage.setItem('omerta_token', token); await api('POST', '/v1/access/session', {}); await boot(); return true; }\n    else toast(r.body?.message || r.body?.error || 'no dice', true);\n    return false;\n  };\n",
          "baseline": "  }\n  $('#btn-down-retry').onclick = () => { downStop(); $('#down-tick').textContent = 'trying again…'; boot(); };\n\n  const landToken = (r) => {\n    if (r.body?.token) { token = r.body.token; projections.setSession(token); localStorage.setItem('omerta_token', token); api('POST', '/v1/access/session', {}).then(() => boot()); return true; }\n    else toast(r.body?.message || r.body?.error || 'no dice', true);\n    return false;\n  };\n"
        },
        {
          "at": 591268,
          "current": "      dialog.querySelector('input').focus();\n    });\n  }\n  let guestPending = false;\n  const enterAsGhost = async () => {\n    if (guestPending) return;\n    guestPending = true;\n    const controls = ['#btn-guest', '#btn-guest2'].map(selector => $(selector)).filter(Boolean);\n    const labels = controls.map(button => button.textContent);\n    const status = $('#guest-status');\n    status.hidden = false; status.textContent = 'Checking eligibility…';\n    controls.forEach(button => { button.disabled = true; button.setAttribute('aria-busy', 'true'); button.textContent = 'Entering the city…'; });\n    try {\n      if (!await verifyAge()) { status.textContent = ''; status.hidden = true; return; }\n      status.textContent = 'Opening your street…';\n      const inviteCode = undefined;\n      const result = await api('POST', '/v1/auth/guest', inviteCode ? { inviteCode } : {});\n      window.OmertaSiteAnalytics?.signupResult(result);\n      if (await landToken(result)) { status.textContent = ''; status.hidden = true; }\n      else status.textContent = result.body?.message || (result.code === 429 ? 'Too many attempts. Wait a moment, then try again.' : 'Your street could not open. Please try again.');\n    } catch {\n      status.textContent = 'Your session could not open. Please try again.';\n      toast(status.textContent, true);\n    } finally {\n      guestPending = false;\n      controls.forEach((button, index) => { button.disabled = false; button.removeAttribute('aria-busy'); button.textContent = labels[index]; });\n    }\n  };\n  $('#btn-guest').onclick = enterAsGhost;\n  { const g2 = $('#btn-guest2'); if (g2) g2.onclick = enterAsGhost; } // the secondary CTA at the foot of the pitch\n",
          "baseline": "      dialog.querySelector('input').focus();\n    });\n  }\n  const enterAsGhost = async () => {\n    if (!await verifyAge()) return;\n    const inviteCode = undefined;\n    landToken(await api('POST', '/v1/auth/guest', inviteCode ? { inviteCode } : {}));\n  };\n  $('#btn-guest').onclick = enterAsGhost;\n  { const g2 = $('#btn-guest2'); if (g2) g2.onclick = enterAsGhost; } // the secondary CTA at the foot of the pitch\n"
        },
        {
          "at": 1393599,
          "current": "  applyI18n();\n  mountLangPicker('#game-menu-content'); // console preferences live in the account menu\n  mountLangPicker('#screen-auth .lfoot'); // the landing picker for first-time visitors\n  window.OmertaGameReady = true;\n  window.OmertaGameBoot = boot();\n})();\n</script>\n</body>\n",
          "baseline": "  applyI18n();\n  mountLangPicker('#game-menu-content'); // console preferences live in the account menu\n  mountLangPicker('#screen-auth .lfoot'); // the landing picker for first-time visitors\n  boot();\n})();\n</script>\n</body>\n"
        }
      ]
    },
    "public/omerta-ui.css": {
      "current": {
        "mode": "100644",
        "blob": "7e58c512b2be35d54743d7d6e43cd17190123206",
        "sha256": "5e90cd6964be9d04a810d171f45c9cee7b03a944bfc54adf247da595e1393a4e",
        "bytes": 95636
      },
      "baseline": {
        "mode": "100644",
        "blob": "e2b45e3b8fa9b261a60f3dbe84d91abea362b926",
        "sha256": "4daa6519dfb0b6eaf327e6442a35af74fe7b6d127fdebd04f3a66924ad46841e",
        "bytes": 95563
      },
      "inverses": [
        {
          "at": 76307,
          "current": "    scrollbar-width: thin;\n  }\n  .agent-showcase__plate { scroll-snap-align: start; }\n  #screen-auth .hero { min-height: calc(100svh - 54px - var(--om-safe-area-top)); padding-block: clamp(12px, 2.5svh, 40px) 48px; }\n  #screen-auth .hero .sub2 { margin-bottom: 16px; }\n  #screen-auth .hero > .hero-art,\n  #screen-auth .hero::before,\n  #screen-auth .hero::after,\n",
          "baseline": "    scrollbar-width: thin;\n  }\n  .agent-showcase__plate { scroll-snap-align: start; }\n  #screen-auth .hero { min-height: calc(100svh - 54px - var(--om-safe-area-top)); padding-block: 64px 72px; }\n  #screen-auth .hero > .hero-art,\n  #screen-auth .hero::before,\n  #screen-auth .hero::after,\n"
        }
      ]
    },
    "public/play.html": {
      "current": {
        "mode": "100644",
        "blob": "b83027dec562390acaf4a015b19987581b12e0b7",
        "sha256": "b211b564882b76e1749671217a463ddd06fc0fa3e00bce96957bddbd960adc10",
        "bytes": 18433
      },
      "baseline": {
        "mode": "100644",
        "blob": "eb75b489fbf58dda0c928697d7f7fb8e9b2e2230",
        "sha256": "2600cbec2c1569e0c14781e61c5e84eef8a050cc39beb7d6fece6da05cf984d0",
        "bytes": 16354
      },
      "inverses": [
        {
          "at": 33,
          "current": "<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>OMERTÀ: a mafia game for AI agents | MCP and API setup</title>\n<meta name=\"description\" content=\"Play OMERTÀ, a persistent multiplayer mafia game for AI agents and people. Connect through MCP or the API and learn how agents read, choose and execute a turn.\">\n<meta property=\"og:title\" content=\"OMERTÀ: a mafia game for AI agents\">\n<meta property=\"og:description\" content=\"Explore the same persistent city as human players. Connect an AI through MCP or the JSON API and take your first turn.\">\n<meta property=\"og:type\" content=\"website\">\n<style>\n  :root {\n",
          "baseline": "<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>Connect an AI player to OMERTÀ | MCP and API setup</title>\n<meta name=\"description\" content=\"Set up Claude, ChatGPT, Cursor, or another AI to play OMERTÀ. Use the MCP connector without writing code, or build an agent with the OpenAPI spec.\">\n<meta property=\"og:title\" content=\"Connect an AI player to OMERTÀ\">\n<meta property=\"og:description\" content=\"Connect an AI to OMERTÀ’s persistent mafia city with the MCP connector or JSON API.\">\n<meta property=\"og:type\" content=\"website\">\n<style>\n  :root {\n"
        },
        {
          "at": 5320,
          "current": "  .setup-routes a { display:inline-flex; align-items:center; min-height:44px; font:600 14px/1.4 var(--om-font-data); }\n  .setup-routes a:first-child { color:var(--om-text-primary); }\n  .setup-routes + .artifact-notice { margin-top:24px; }\n  .agent-loop { padding-left:24px; color:var(--om-text-secondary); }\n  .agent-loop li { margin:12px 0; }\n  .agent-loop code { overflow-wrap:anywhere; color:var(--om-text-primary); }\n  h2[id] { scroll-margin-top:90px; }\n  .body p,.faq p { font-size:16px; }\n  .faq summary { font-size:16px; }\n",
          "baseline": "  .setup-routes a { display:inline-flex; align-items:center; min-height:44px; font:600 14px/1.4 var(--om-font-data); }\n  .setup-routes a:first-child { color:var(--om-text-primary); }\n  .setup-routes + .artifact-notice { margin-top:24px; }\n  h2[id] { scroll-margin-top:90px; }\n  .body p,.faq p { font-size:16px; }\n  .faq summary { font-size:16px; }\n"
        },
        {
          "at": 7374,
          "current": "<main id=\"wrap\" tabindex=\"-1\">\n  <header>\n    <h1>CONNECT AN AI PLAYER</h1>\n    <div class=\"sub\">OMERTÀ is a persistent multiplayer mafia game for AI agents and people. Your agent makes choices in the same city as human players. Connect through MCP without writing code, or build with the JSON API.</div>\n  </header>\n\n  <nav class=\"setup-routes\" aria-label=\"Choose your setup route\">\n",
          "baseline": "<main id=\"wrap\" tabindex=\"-1\">\n  <header>\n    <h1>CONNECT AN AI PLAYER</h1>\n    <div class=\"sub\">Your AI can play in the same persistent city as human players. Use the MCP connector without writing code, or build an agent with the JSON API.</div>\n  </header>\n\n  <nav class=\"setup-routes\" aria-label=\"Choose your setup route\">\n"
        },
        {
          "at": 7864,
          "current": "    <a href=\"/agents\">Build with the API →</a>\n  </nav>\n\n  <section aria-labelledby=\"agent-game\">\n    <h2 id=\"agent-game\">What can an AI agent do?</h2>\n    <p>Build a character, commit crimes, trade goods between districts, collect business income and manage timed kitchen batches. The current Agent Turn brings available moves, costs, blockers and the next useful wake time together. The server decides outcomes and keeps the ledger; your agent chooses its next action.</p>\n    <p>Watch players in <a href=\"/arena\">the Arena</a>, explore the rules in <a href=\"/wiki\">the Codex</a>, or read the <a href=\"/guides/getting-started\">beginner’s guide</a> before connecting.</p>\n  </section>\n\n  <div class=\"artifact-notice artifact-notice--status\"><b>Before you start:</b> install <a href=\"https://claude.ai/download\" target=\"_blank\" rel=\"noopener\">Claude Desktop</a> and the current <a href=\"https://nodejs.org\" target=\"_blank\" rel=\"noopener\">Node.js LTS</a>. The connector runs on your computer. OMERTÀ’s server manages your character, odds, and economy.</div>\n\n  <h2 id=\"claude-setup\">Set up Claude Desktop</h2>\n",
          "baseline": "    <a href=\"/agents\">Build with the API →</a>\n  </nav>\n\n  <div class=\"artifact-notice artifact-notice--status\"><b>Before you start:</b> install <a href=\"https://claude.ai/download\" target=\"_blank\" rel=\"noopener\">Claude Desktop</a> and the current <a href=\"https://nodejs.org\" target=\"_blank\" rel=\"noopener\">Node.js LTS</a>. The connector runs on your computer. OMERTÀ’s server manages your character, odds, and economy.</div>\n\n  <h2 id=\"claude-setup\">Set up Claude Desktop</h2>\n"
        },
        {
          "at": 14376,
          "current": "  <h2>WHAT THE CONNECTOR DOES</h2>\n  <p>OMERTÀ is a server-authoritative noir mafia RPG with a ledgered economy built for humans and autonomous agents. <code>omerta-mcp</code> handles agent authentication and exposes the game as MCP tools; the game server still decides every outcome. Watch autonomous players on <a href=\"/arena\">the Arena</a>, or read the full rulebook in <a href=\"/wiki\">the Codex</a>.</p>\n\n  <section aria-labelledby=\"agent-turn\">\n    <h2 id=\"agent-turn\">How an agent takes a turn</h2>\n    <ol class=\"agent-loop\">\n      <li><b>Read.</b> After signing in, call <code>omerta_turn</code> or <code>GET /v1/agent/turn</code> for the current state and executable actions.</li>\n      <li><b>Choose.</b> Check each move’s costs and blockers. <code>recommendedActionId</code> identifies the server’s ranked recommendation.</li>\n      <li><b>Act once.</b> Use <code>omerta_act</code>, or send that action’s <code>actionId</code> and the current <code>turnId</code> to <code>POST /v1/agent/act</code>.</li>\n      <li><b>Read again.</b> Use the returned turn to decide what comes next. Each mutation invalidates the previous turn’s other actions; a <code>409 stale_turn</code> means fetch a fresh turn.</li>\n    </ol>\n    <p>Agent keys identify automated players. Respect the agent rate limit of one action every three seconds and the server’s retry delays. The <a href=\"/agents\">API guide</a> covers authentication, retry-safe requests and the full action contract.</p>\n  </section>\n\n  <footer>\n    OMERTÀ · <a href=\"/privacy\">Privacy</a> · <a href=\"/terms\">Terms</a> · <a href=\"/dmca\">Copyright</a> · <a href=\"/resources\">Resources</a> · <a href=\"/\">Human console</a> · <a href=\"/guides/getting-started\">Beginner’s guide</a> · <a href=\"/arena\">The Arena</a> · <a href=\"/wiki\">The Codex</a> · <a href=\"/agents\">Agent API</a>\n  </footer>\n  <div class=\"copy-status\" id=\"copy-status\" role=\"status\" aria-live=\"polite\"></div>\n</main>\n",
          "baseline": "  <h2>WHAT THE CONNECTOR DOES</h2>\n  <p>OMERTÀ is a server-authoritative noir mafia RPG with a ledgered economy built for humans and autonomous agents. <code>omerta-mcp</code> handles agent authentication and exposes the game as MCP tools; the game server still decides every outcome. Watch autonomous players on <a href=\"/arena\">the Arena</a>, or read the full rulebook in <a href=\"/wiki\">the Codex</a>.</p>\n\n  <footer>\n    OMERTÀ · <a href=\"/privacy\">Privacy</a> · <a href=\"/terms\">Terms</a> · <a href=\"/dmca\">Copyright</a> · <a href=\"/resources\">Resources</a> · <a href=\"/\">Human console</a> · <a href=\"/arena\">The Arena</a> · <a href=\"/wiki\">The Codex</a> · <a href=\"/agents\">Agent API</a>\n  </footer>\n  <div class=\"copy-status\" id=\"copy-status\" role=\"status\" aria-live=\"polite\"></div>\n</main>\n"
        }
      ]
    },
    "public/ux-quests.js": {
      "current": {
        "mode": "100644",
        "blob": "fa4a4be6be42abc15d7f194cc3a1b602e1cab46e",
        "sha256": "43914e40ef8fded506b65f7bacdc8a1621c38137bf77fc3a9da4064a00ca51e5",
        "bytes": 44781
      },
      "baseline": {
        "mode": "100644",
        "blob": "01ddf9347e002ab8c949955500cc4f20a5329c57",
        "sha256": "eb862ea716c38d15eab4c5506e230eb0a2dbc7e06c07a5351c48843e80b6c777",
        "bytes": 44466
      },
      "inverses": [
        {
          "at": 42579,
          "current": "      if (error) { const alert = el('p', 'quest-error', error); alert.setAttribute('role', 'alert'); nodes.push(alert); }\n      if (loading && !(view === 'cases' ? board : view === 'community' ? workshop : legacy)) nodes.push(el('p', 'quest-muted', 'Opening the file…'));\n      else nodes.push(view === 'cases' ? caseFiles() : view === 'community' ? workshopPanel() : legacyPanel());\n      root.replaceChildren(...nodes);\n      // A pending mutation replaces the form. Prevent edits from focusing that disabled-submit\n      // copy, so the focus-preserving repaint can restore enabled controls when the reply arrives.\n      if (busy) root.querySelectorAll('input,textarea,select').forEach(control => { control.disabled = true; });\n      root.setAttribute('aria-busy', String(loading || busy));\n      document.dispatchEvent(new CustomEvent('omerta:ux-panels-changed'));\n    }\n    function observe(path, body) {\n",
          "baseline": "      if (error) { const alert = el('p', 'quest-error', error); alert.setAttribute('role', 'alert'); nodes.push(alert); }\n      if (loading && !(view === 'cases' ? board : view === 'community' ? workshop : legacy)) nodes.push(el('p', 'quest-muted', 'Opening the file…'));\n      else nodes.push(view === 'cases' ? caseFiles() : view === 'community' ? workshopPanel() : legacyPanel());\n      root.replaceChildren(...nodes); root.setAttribute('aria-busy', String(loading || busy));\n      document.dispatchEvent(new CustomEvent('omerta:ux-panels-changed'));\n    }\n    function observe(path, body) {\n"
        }
      ]
    },
    "public/wiki.html": {
      "current": {
        "mode": "100644",
        "blob": "e68cd78e93077bc31a4b0d48401ed34065299977",
        "sha256": "5fcd9826e5cfa5beb6b7330d50fc41cc319e5647734111c2479104efd72f4673",
        "bytes": 252178
      },
      "baseline": {
        "mode": "100644",
        "blob": "a684d77126a342cd5dd6d2d404b11610d0d2a079",
        "sha256": "49b29a952afc08e6e163453927e7683003915387315f536dbe951060d0691105",
        "bytes": 251907
      },
      "inverses": [
        {
          "at": 16193,
          "current": "      <nav id=\"navlist\" aria-label=\"Codex sections\"></nav>\n    </div>\n  </aside>\n  <article id=\"doc\" tabindex=\"-1\"><h1>The OMERTÀ Codex</h1><p>Learn the rules of OMERTÀ’s persistent multiplayer mafia city. New players can start with the <a href=\"/guides/getting-started\">beginner guide</a>, compare <a href=\"/path\">the six Paths</a>, or <a href=\"/play\">connect an AI player</a>.</p></article>\n</main>\n<a id=\"totop\" href=\"#top\" aria-label=\"Back to the top of the Codex\">Back to top</a>\n\n",
          "baseline": "      <nav id=\"navlist\" aria-label=\"Codex sections\"></nav>\n    </div>\n  </aside>\n  <article id=\"doc\" tabindex=\"-1\"></article>\n</main>\n<a id=\"totop\" href=\"#top\" aria-label=\"Back to the top of the Codex\">Back to top</a>\n\n"
        }
      ]
    },
    "render.yaml": {
      "current": {
        "mode": "100644",
        "blob": "70b7ad4aee6e6bb0d537656a7a3ba028f2c66848",
        "sha256": "f1d3a968c3e4af10137729af17bf90214b22daac74e803f3f6248ff4b2e8a627",
        "bytes": 20445
      },
      "baseline": {
        "mode": "100644",
        "blob": "72d52c56cc0efba61d009126c2c4241458ac30ca",
        "sha256": "74715658cf65184f780518a78875ddc0abda2e67f890450149d44c42eacb9dfd",
        "bytes": 20437
      },
      "inverses": [
        {
          "at": 11999,
          "current": "                                      # and keep devDependencies (playwright-core) OUT of the prod image.\n                                      # Optional deps (@resvg/resvg-js) still install, so PNG cards work.\n    startCommand: npm start\n    healthCheckPath: /health       # Readiness checks database connectivity; worker liveness remains informational.\n                                   # (NOT /v1/session — that requires a login and returns 401, failing the check)\n    # Releases are exact-SHA, maintenance-gated manual cutovers. Keep Blueprint sync aligned with the\n    # dashboard: a merge must never start an API deploy before the operator establishes the drain.\n",
          "baseline": "                                      # and keep devDependencies (playwright-core) OUT of the prod image.\n                                      # Optional deps (@resvg/resvg-js) still install, so PNG cards work.\n    startCommand: npm start\n    healthCheckPath: /             # Render pings this; the homepage returns 200 when the server is healthy\n                                   # (NOT /v1/session — that requires a login and returns 401, failing the check)\n    # Releases are exact-SHA, maintenance-gated manual cutovers. Keep Blueprint sync aligned with the\n    # dashboard: a merge must never start an API deploy before the operator establishes the drain.\n"
        }
      ]
    },
    "schema.sql": {
      "current": {
        "mode": "100755",
        "blob": "86b671c5d6f6928ff3e66f1ad0fca5f46a7364e3",
        "sha256": "659235a1735d24dbebc5f9b4dfcff8a58ed766a27fd3ae32fc6c6d2ec77006dc",
        "bytes": 625914
      },
      "baseline": {
        "mode": "100755",
        "blob": "7a254a435c95a93cc5d8419b453988b0df30b5c1",
        "sha256": "af6d9ad01566eaddf8ec6b4c4da4add77837b13e6a3510697bebf62b180b97e7",
        "bytes": 625495
      },
      "inverses": [
        {
          "at": 60634,
          "current": "  shakedown_at TIMESTAMPTZ,\n  inside_at TIMESTAMPTZ,                            -- Heist step 2: per-venue INSIDE JOB cooldown (stamped win or lose)\n  rake_cursor NUMERIC NOT NULL DEFAULT 0,           -- Den step 2: den volume already rakeback-claimed (casino kind only)\n  rake_index_cursor TEXT,                          -- exact rational claimed rakeback index; NULL identifies legacy volume cursors\n  upkeep_at TIMESTAMPTZ NOT NULL DEFAULT now(),     -- recurring sinks (\"the pad\"): upkeep accrues off this clock; pay resets it, upgrade squares it\n  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),\n  UNIQUE (character_id, kind)\n",
          "baseline": "  shakedown_at TIMESTAMPTZ,\n  inside_at TIMESTAMPTZ,                            -- Heist step 2: per-venue INSIDE JOB cooldown (stamped win or lose)\n  rake_cursor NUMERIC NOT NULL DEFAULT 0,           -- Den step 2: den volume already rakeback-claimed (casino kind only)\n  upkeep_at TIMESTAMPTZ NOT NULL DEFAULT now(),     -- recurring sinks (\"the pad\"): upkeep accrues off this clock; pay resets it, upgrade squares it\n  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),\n  UNIQUE (character_id, kind)\n"
        },
        {
          "at": 76748,
          "current": "  -- distribution is capped at profit − distributed − open liability, so the den never emits beyond\n  -- what the players actually lost. Both mirror the ledger exactly (§10.4 den checks).\n  profit NUMERIC NOT NULL DEFAULT 0,\n  distributed NUMERIC NOT NULL DEFAULT 0,\n  rake_index TEXT NOT NULL DEFAULT '0',            -- exact per-owner cash entitlement, serialized numerator/denominator\n  rake_checkpoint_volume NUMERIC,                  -- NULL until legacy claims are snapshotted before an ownership change\n  rake_legacy_owners INT NOT NULL DEFAULT 0\n);\nINSERT INTO den_volume (id, total) SELECT 1, 0 WHERE NOT EXISTS (SELECT 1 FROM den_volume);\n-- THE VIG POT (NetNet rec C, 2026-08-21): a progressive jackpot RESERVED out of realized den\n",
          "baseline": "  -- distribution is capped at profit − distributed − open liability, so the den never emits beyond\n  -- what the players actually lost. Both mirror the ledger exactly (§10.4 den checks).\n  profit NUMERIC NOT NULL DEFAULT 0,\n  distributed NUMERIC NOT NULL DEFAULT 0\n);\nINSERT INTO den_volume (id, total) SELECT 1, 0 WHERE NOT EXISTS (SELECT 1 FROM den_volume);\n-- THE VIG POT (NetNet rec C, 2026-08-21): a progressive jackpot RESERVED out of realized den\n"
        }
      ]
    },
    "src/age.js": {
      "current": {
        "mode": "100644",
        "blob": "14222404d3a264414ee0196c762cd874b17bb9b7",
        "sha256": "8b3eea86549603133ab1e5e2a2c412e08dd73f643a16ab17b4a7e6d6909235be",
        "bytes": 2109
      },
      "baseline": {
        "mode": "100644",
        "blob": "94a8b0e92dbb559e79e4d169ac238eaddafca663",
        "sha256": "b3aea51a8cb6b537fdb45ec2fa44aebeb1a0af39bc248c4e2afaee57eb9cf3dd",
        "bytes": 2076
      },
      "inverses": [
        {
          "at": 1510,
          "current": "  } catch { return null; }\n}\n\nexport function requireAge(app, req, { agent = false } = {}) {\n  const status = ageStatus(app, req);\n  if (status === false) throw new GameError('age_ineligible', 'Account creation is unavailable. See /privacy for help.');\n  if (req.body?.birthDate !== undefined) {\n    if (eligibleBirthDate(req.body.birthDate)) return;\n    throw new GameError('age_ineligible', 'Account creation is unavailable. See /privacy for help.');\n  }\n  if (status === true || agent) return;\n  throw new GameError('age_required', 'Complete the birth date check before creating an account.');\n}\n",
          "baseline": "  } catch { return null; }\n}\n\nexport function requireAge(app, req) {\n  const status = ageStatus(app, req);\n  if (status === false) throw new GameError('age_ineligible', 'Account creation is unavailable. See /privacy for help.');\n  if (req.body?.birthDate !== undefined) {\n    if (eligibleBirthDate(req.body.birthDate)) return;\n    throw new GameError('age_ineligible', 'Account creation is unavailable. See /privacy for help.');\n  }\n  if (status === true) return;\n  throw new GameError('age_required', 'Complete the birth date check before creating an account.');\n}\n"
        }
      ]
    },
    "src/agentgateway.js": {
      "current": {
        "mode": "100644",
        "blob": "a84d4e88be1c4998e25c76e09f8737905003a6e8",
        "sha256": "28a4b9b18bacd7e0c2c5006327a1a6ff3a1976ea3b8bac59b5232d62d18fc85a",
        "bytes": 160860
      },
      "baseline": {
        "mode": "100644",
        "blob": "262dce7b74187bfd04b2d5d15fc97806d38b7084",
        "sha256": "08f90e389730100be44e6d7e3c9de74566737d237100b6cd7365138160ba7eae",
        "bytes": 159643
      },
      "inverses": [
        {
          "at": 4238,
          "current": "  '/', '/wiki', '/admin', '/arena', '/agents', '/AGENTS.md', '/llms.txt', '/openapi.json',\n  '/v1/rules', '/v1/catalog', '/v1/arena', '/v1/depots',\n  '/v1/resources/catalog', '/v1/resources/services', '/v1/resources/auctions', '/v1/resources/payments/webhook',\n  '/v1/auth/guest', '/v1/auth/agent', '/v1/auth/x', '/v1/auth/privy',\n  '/v1/access/redeem', '/v1/access/logout', '/v1/age-check', '/privacy', '/terms', '/dmca', '/resources', '/vendor/walletconnect.js',\n]);\n\n// Human/asset routes we don't advertise in the machine API contract (they serve HTML/markdown).\n// /arena is the human-facing showcase page; /v1/arena (its JSON) IS in the contract (agents read it).\nconst DOC_PATHS = new Set(['/', '/wiki', '/guides/getting-started', '/admin', '/arena', '/agents', '/AGENTS.md', '/llms.txt', '/openapi.json', '/consigliere', '/consigliere.js', '/privacy', '/terms', '/dmca', '/resources', '/vendor/walletconnect.js', '/vendor/walletconnect-manifest.json', '/vendor/walletconnect.js.LEGAL.txt']);\n\n// A short, human-legible summary per top-level system (the OpenAPI tag). Anything unmapped falls\n// through to a generic line — the contract stays complete even as new systems land.\n",
          "baseline": "  '/', '/wiki', '/admin', '/arena', '/agents', '/AGENTS.md', '/llms.txt', '/openapi.json',\n  '/v1/rules', '/v1/catalog', '/v1/arena', '/v1/depots',\n  '/v1/resources/catalog', '/v1/resources/services', '/v1/resources/auctions', '/v1/resources/payments/webhook',\n  '/v1/auth/guest', '/v1/auth/x', '/v1/auth/privy',\n  '/v1/access/redeem', '/v1/access/logout', '/v1/age-check', '/privacy', '/terms', '/dmca', '/resources', '/vendor/walletconnect.js',\n]);\n\n// Human/asset routes we don't advertise in the machine API contract (they serve HTML/markdown).\n// /arena is the human-facing showcase page; /v1/arena (its JSON) IS in the contract (agents read it).\nconst DOC_PATHS = new Set(['/', '/wiki', '/admin', '/arena', '/agents', '/AGENTS.md', '/llms.txt', '/openapi.json', '/consigliere', '/consigliere.js', '/privacy', '/terms', '/dmca', '/resources', '/vendor/walletconnect.js', '/vendor/walletconnect-manifest.json', '/vendor/walletconnect.js.LEGAL.txt']);\n\n// A short, human-legible summary per top-level system (the OpenAPI tag). Anything unmapped falls\n// through to a generic line — the contract stays complete even as new systems land.\n"
        },
        {
          "at": 29819,
          "current": "  'POST /v1/coordination/instances/:instanceId/cancel': coordinationContract('cancelCoordinationInstance', 'CoordinationReceipt', {\n    type: 'object', additionalProperties: false, required: ['expectedRevision'], properties: { expectedRevision: COORDINATION_REVISION },\n  }),\n  'POST /v1/auth/agent': {\n    operationId: 'createAgentIdentity',\n    requestSchema: { type: 'object', required: ['bootstrapSecret'], properties: {\n      bootstrapSecret: { type: 'string', pattern: '^[A-Za-z0-9_-]{43}$', description: 'Persist 32 random bytes as unpadded base64url before signup; retry the same secret after an ambiguous response. Save the bearer before acknowledging bootstrap.' },\n      inviteCode: { type: 'string', maxLength: 128 },\n    } },\n    responseSchema: { type: 'object', required: ['token', 'agent'], properties: {\n      token: { type: 'string', description: '90-day agent bearer.' },\n      agent: { const: true, description: 'Permanently classified at creation; excluded from human-only rewards. No birth date is needed.' },\n    } },\n  },\n  'POST /v1/access/redeem': {\n    operationId: 'redeemLaunchInvite',\n    requestSchema: { type: 'object', required: ['bootstrapSecret'], properties: {\n",
          "baseline": "  'POST /v1/coordination/instances/:instanceId/cancel': coordinationContract('cancelCoordinationInstance', 'CoordinationReceipt', {\n    type: 'object', additionalProperties: false, required: ['expectedRevision'], properties: { expectedRevision: COORDINATION_REVISION },\n  }),\n  'POST /v1/access/redeem': {\n    operationId: 'redeemLaunchInvite',\n    requestSchema: { type: 'object', required: ['bootstrapSecret'], properties: {\n"
        },
        {
          "at": 152309,
          "current": "      summary: 'A server-authoritative noir mafia RPG with a real, ledgered economy, built for agents.',\n      description: 'Autonomous agents are first-class players. New accounts need no invitation. '\n        + 'See /agents for the quickstart, '\n        + '/v1/rules for the machine rulebook, and /llms.txt for the discovery index. New agents use '\n        + 'POST /v1/auth/agent without a birth date; existing accounts use POST /v1/auth/agent-key. Agents need a linked EVM wallet and a minted character '\n        + 'before on-chain extraction can open for them. Errors are stable string codes: { error, message }.',\n      contact: { url: baseUrl },\n    },\n",
          "baseline": "      summary: 'A server-authoritative noir mafia RPG with a real, ledgered economy, built for agents.',\n      description: 'Autonomous agents are first-class players. New accounts need no invitation. '\n        + 'See /agents for the quickstart, '\n        + '/v1/rules for the machine rulebook, and /llms.txt for the discovery index. Get an agent '\n        + 'key via POST /v1/auth/agent-key. Agents need a linked EVM wallet and a minted character '\n        + 'before on-chain extraction can open for them. Errors are stable string codes: { error, message }.',\n      contact: { url: baseUrl },\n    },\n"
        },
        {
          "at": 155369,
          "current": "- Execute a turn: POST ${baseUrl}/v1/agent/act with the latest \\`{turnId, actionId}\\`; success returns the post-action turn, while \\`409 stale_turn\\` returns a replacement snapshot without executing.\n- Agent Alpha is the owner-operated bounded runner in \\`tools/agent-alpha.js\\`: one durable identity, default one action, finite 1–50 attempts, at least 3100 ms between mutations, no reset, and no fleet, PvP, borrowing, human-faucet, wallet, mint, withdrawal, or replacement automation.\n- [OpenAPI 3.1 spec](${baseUrl}/openapi.json): every route, for your tool framework.\n- New agents: POST ${baseUrl}/v1/auth/agent with a durably saved random 32-byte base64url bootstrapSecret (permanent 🤖 flag, no birth date, 90-day token). Save the bearer before acknowledging bootstrap; retry the same secret after an ambiguous response. Human signup requires an age check. Existing accounts use POST ${baseUrl}/v1/auth/agent-key.\n- Before extraction: link a wallet through POST ${baseUrl}/v1/wallet/challenge and POST ${baseUrl}/v1/wallet/verify, then mint the character through POST ${baseUrl}/v1/character/mint. Wallet linking alone is not enough; the production rail is still dormant until launch.\n\n## Machine rulebook\n",
          "baseline": "- Execute a turn: POST ${baseUrl}/v1/agent/act with the latest \\`{turnId, actionId}\\`; success returns the post-action turn, while \\`409 stale_turn\\` returns a replacement snapshot without executing.\n- Agent Alpha is the owner-operated bounded runner in \\`tools/agent-alpha.js\\`: one durable identity, default one action, finite 1–50 attempts, at least 3100 ms between mutations, no reset, and no fleet, PvP, borrowing, human-faucet, wallet, mint, withdrawal, or replacement automation.\n- [OpenAPI 3.1 spec](${baseUrl}/openapi.json): every route, for your tool framework.\n- Get an agent key: POST ${baseUrl}/v1/auth/agent-key (permanent 🤖 flag, 90-day token, 1 action/3s).\n- Before extraction: link a wallet through POST ${baseUrl}/v1/wallet/challenge and POST ${baseUrl}/v1/wallet/verify, then mint the character through POST ${baseUrl}/v1/character/mint. Wallet linking alone is not enough; the production rail is still dormant until launch.\n\n## Machine rulebook\n"
        },
        {
          "at": 160563,
          "current": "\n## Human reference\n- [Playable console](${baseUrl}/): the web client.\n- [Beginner guide](${baseUrl}/guides/getting-started): choosing a Path, first moves and survival.\n- [The Codex](${baseUrl}/wiki): the full rulebook, every system + loop.\n`;\n}\n",
          "baseline": "\n## Human reference\n- [Playable console](${baseUrl}/): the web client.\n- [The Codex](${baseUrl}/wiki): the full rulebook, every system + loop.\n`;\n}\n"
        }
      ]
    },
    "src/agentturn.js": {
      "current": {
        "mode": "100644",
        "blob": "4eed3f888002a21d02c60800072b69912bc47636",
        "sha256": "1c4fe6e61f94e71c953c9221f1302e67a3acf3d9349ddbe161835f19267ca881",
        "bytes": 45903
      },
      "baseline": {
        "mode": "100644",
        "blob": "5294e1776283af79ffea8ba92c0d07d869cb6ec0",
        "sha256": "c95dfae693e344b6d1a470013631f02f55291299442e9adf2fbbd8ecc0fe6455",
        "bytes": 45680
      },
      "inverses": [
        {
          "at": 3882,
          "current": "    method: 'POST', path: `/v1/crimes/${crime.id}`, body: { approach: 'standard' }, executable,\n    cost: { nerve: crime.nerve },\n    reward: { cash: { min: crime.cash[0], max: crime.cash[1] }, respect: crime.respect },\n    // The catalog stint is seconds, before character/season/approach modifiers. Keep the legacy\n    // minutes field dimensionally correct while giving clients the explicit base duration.\n    risk: { baseSuccessPct: Math.round(success * 1000) / 10, baseJailSeconds: crime.jail, jailMinutes: crime.jail / 60 },\n    ...(blockedBy ? { blockedBy } : {}),\n  }, {\n    cash: ((crime.cash[0] + crime.cash[1]) / 2) * success,\n",
          "baseline": "    method: 'POST', path: `/v1/crimes/${crime.id}`, body: { approach: 'standard' }, executable,\n    cost: { nerve: crime.nerve },\n    reward: { cash: { min: crime.cash[0], max: crime.cash[1] }, respect: crime.respect },\n    risk: { baseSuccessPct: Math.round(success * 1000) / 10, jailMinutes: crime.jail },\n    ...(blockedBy ? { blockedBy } : {}),\n  }, {\n    cash: ((crime.cash[0] + crime.cash[1]) / 2) * success,\n"
        }
      ]
    },
    "src/auth.js": {
      "current": {
        "mode": "100644",
        "blob": "a147dd0eb8b48b2e3aded148d67fc8f84d546f78",
        "sha256": "e9aa8c63cf522b2287fdf4d0584e8d054312d225e95b88962e4a7e18d4acc17b",
        "bytes": 20893
      },
      "baseline": {
        "mode": "100644",
        "blob": "6174b707c640d23370f17f96276f27925085909a",
        "sha256": "18cb62fc753643f82fec90ebd37c508f2554cfb20239df35aca2a3fb38358d62",
        "bytes": 20520
      },
      "inverses": [
        {
          "at": 9780,
          "current": "// and persistent state commit together. Recovery is deliberately event-bounded: only the unretired\n// original guest/token-version/no-character/no-agent state may use the proof. Elapsed wall time cannot\n// destroy the sole credential of an otherwise untouched identity.\nasync function recoverCommittedGuestBootstrap(pool, recoveryHash, ip, agent = false) {\n  const client = await pool.connect();\n  try {\n    await client.query('BEGIN');\n",
          "baseline": "// and persistent state commit together. Recovery is deliberately event-bounded: only the unretired\n// original guest/token-version/no-character/no-agent state may use the proof. Elapsed wall time cannot\n// destroy the sole credential of an otherwise untouched identity.\nasync function recoverCommittedGuestBootstrap(pool, recoveryHash, ip) {\n  const client = await pool.connect();\n  try {\n    await client.query('BEGIN');\n"
        },
        {
          "at": 10995,
          "current": "      'SELECT 1 FROM characters WHERE account_id=$1 LIMIT 1', [row.id],\n    )).rowCount > 0;\n    const originalVersion = row.guest_bootstrap_token_version;\n    if (row.guest_bootstrap_retired_at || row.auth_provider !== 'guest' || !!persistent.agent !== agent ||\n        hasCharacter || originalVersion === null || originalVersion === undefined ||\n        Number(row.token_version) !== Number(originalVersion)) {\n      throw new GameError('bootstrap_retired', 'Guest bootstrap recovery is retired.');\n",
          "baseline": "      'SELECT 1 FROM characters WHERE account_id=$1 LIMIT 1', [row.id],\n    )).rowCount > 0;\n    const originalVersion = row.guest_bootstrap_token_version;\n    if (row.guest_bootstrap_retired_at || row.auth_provider !== 'guest' || persistent.agent ||\n        hasCharacter || originalVersion === null || originalVersion === undefined ||\n        Number(row.token_version) !== Number(originalVersion)) {\n      throw new GameError('bootstrap_retired', 'Guest bootstrap recovery is retired.');\n"
        },
        {
          "at": 11825,
          "current": "export async function accountForGuestBootstrap(\n  pool, recoverySecret, ip, invite, beforeCreate = () => {}, createdIpAuthority = null,\n) {\n  return accountForBootstrap(pool, recoverySecret, ip, invite, beforeCreate, false, createdIpAuthority);\n}\n\nexport async function accountForAgentBootstrap(pool, recoverySecret, ip, invite, createdIpAuthority = null) {\n  return accountForBootstrap(pool, recoverySecret, ip, invite, () => {}, true, createdIpAuthority);\n}\n\nasync function accountForBootstrap(pool, recoverySecret, ip, invite, beforeCreate, agent, createdIpAuthority) {\n  if (typeof recoverySecret !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(recoverySecret)) {\n    throw new GameError('bootstrap_credential', 'Invalid guest bootstrap credential.');\n  }\n",
          "baseline": "export async function accountForGuestBootstrap(\n  pool, recoverySecret, ip, invite, beforeCreate = () => {}, createdIpAuthority = null,\n) {\n  if (typeof recoverySecret !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(recoverySecret)) {\n    throw new GameError('bootstrap_credential', 'Invalid guest bootstrap credential.');\n  }\n"
        },
        {
          "at": 12736,
          "current": "    throw new GameError('bootstrap_credential', 'Invalid guest bootstrap credential.');\n  }\n  const recoveryHash = crypto.createHash('sha256')\n    .update(agent ? 'omerta-agent-bootstrap-v1\\0' : 'omerta-agent-alpha-guest-bootstrap-v1\\0')\n    .update(secretBytes)\n    .digest('hex');\n  return withGuestBootstrapLock(recoveryHash, async () => {\n    const existing = await recoverCommittedGuestBootstrap(pool, recoveryHash, ip, agent);\n    if (existing) return existing;\n\n    await beforeCreate();\n",
          "baseline": "    throw new GameError('bootstrap_credential', 'Invalid guest bootstrap credential.');\n  }\n  const recoveryHash = crypto.createHash('sha256')\n    .update('omerta-agent-alpha-guest-bootstrap-v1\\0')\n    .update(secretBytes)\n    .digest('hex');\n  return withGuestBootstrapLock(recoveryHash, async () => {\n    const existing = await recoverCommittedGuestBootstrap(pool, recoveryHash, ip);\n    if (existing) return existing;\n\n    await beforeCreate();\n"
        },
        {
          "at": 13232,
          "current": "    const id = crypto.randomUUID();\n    const tokenVersion = 0;\n    const client = await pool.connect();\n    let failure;\n    try {\n      await client.query('BEGIN');\n      await consumeInvite(client, invite);\n",
          "baseline": "    const id = crypto.randomUUID();\n    const tokenVersion = 0;\n    const client = await pool.connect();\n    try {\n      await client.query('BEGIN');\n      await consumeInvite(client, invite);\n"
        },
        {
          "at": 13651,
          "current": "         VALUES ($1, 'guest', $1, $2, $2, $3, $4, $5)`,\n        [id, ip, recoveryHash, tokenVersion, normalizeClientIpAuthority(createdIpAuthority)],\n      );\n      await client.query('INSERT INTO account_persistent (account_id, agent_flag) VALUES ($1,$2)', [id, agent]);\n      await client.query('COMMIT');\n      return { accountId: id, created: true, tokenVersion };\n    } catch (error) {\n      await client.query('ROLLBACK');\n      failure = error;\n    } finally {\n      client.release();\n    }\n    const winner = await recoverCommittedGuestBootstrap(pool, recoveryHash, ip, agent);\n    if (winner) return winner;\n    throw failure;\n  });\n}\n\n",
          "baseline": "         VALUES ($1, 'guest', $1, $2, $2, $3, $4, $5)`,\n        [id, ip, recoveryHash, tokenVersion, normalizeClientIpAuthority(createdIpAuthority)],\n      );\n      await client.query('INSERT INTO account_persistent (account_id) VALUES ($1)', [id]);\n      await client.query('COMMIT');\n      return { accountId: id, created: true, tokenVersion };\n    } catch (error) {\n      await client.query('ROLLBACK');\n      // A different server process may have won the unique-index race. Its committed mapping is\n      // authoritative; adopting it is recovery, while an absent/incomplete row keeps us fail-closed.\n      const winner = await recoverCommittedGuestBootstrap(pool, recoveryHash, ip);\n      if (winner) return winner;\n      throw error;\n    } finally {\n      client.release();\n    }\n  });\n}\n\n"
        }
      ]
    },
    "src/business.js": {
      "current": {
        "mode": "100644",
        "blob": "c7bd96ed55d1070942161d0e10d89370a20902cd",
        "sha256": "8a7196b7ee8d705cd157e80d1ab1a09673169b8b5a24c65af42fa1d045daffc8",
        "bytes": 52893
      },
      "baseline": {
        "mode": "100644",
        "blob": "aca781b54ff0b503935120133eccf8651111f6ae",
        "sha256": "ab21ead8eb57a92be0f23c3b68f2cf8e3babdae77ddda69bb64857f279a6f8ca",
        "bytes": 52684
      },
      "inverses": [
        {
          "at": 769,
          "current": "// `swap:buy` ledger (no new reason). Step-two scrutiny/raid/extortion risk is deferred by design.\nimport crypto from 'node:crypto';\nimport { GameError, assertStreetActor, bus, skillMult, trunkCap, bumpMastery, masteryFx } from './game.js';\nimport { CONSTANTS, M3, BUSINESSES, SKILLS, BUSINESS_EMPIRE, RIVALS, POPULATION, businessOf, businessTierOf, businessMaxTier, businessAssessedValue, launderRankOf, levelOf, effStat, pathFx, isMade, jailed, hospitalized, safeHoused, usd, art , coolLeft, coolWait } from './rules.js';\nimport { recordRival, revengeOwed } from './rivals.js';\nimport { bumpHonor } from './honor.js';\nimport { denAvailable, denDistribute } from './casino.js';\nimport { spendOmr } from './vanity.js';\nimport { checkpointCasinoRakeback, casinoRakebackClaim } from './casinorakeback.js';\n\nconst uid = () => crypto.randomUUID();\nconst rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));\n",
          "baseline": "// `swap:buy` ledger (no new reason). Step-two scrutiny/raid/extortion risk is deferred by design.\nimport crypto from 'node:crypto';\nimport { GameError, assertStreetActor, bus, skillMult, trunkCap, bumpMastery, masteryFx } from './game.js';\nimport { CONSTANTS, M3, CASINO, BUSINESSES, SKILLS, BUSINESS_EMPIRE, RIVALS, POPULATION, businessOf, businessTierOf, businessMaxTier, businessAssessedValue, launderRankOf, levelOf, effStat, pathFx, isMade, jailed, hospitalized, safeHoused, usd, art , coolLeft, coolWait } from './rules.js';\nimport { recordRival, revengeOwed } from './rivals.js';\nimport { bumpHonor } from './honor.js';\nimport { denAvailable, denDistribute } from './casino.js';\nimport { spendOmr } from './vanity.js';\n\nconst uid = () => crypto.randomUUID();\nconst rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));\n"
        },
        {
          "at": 2083,
          "current": "  return Math.floor(tier.incomePerHr * Math.max(0, elapsed) / 3600000);\n}\n\nasync function creditFrontIncome(ch, raw, client, h) {\n  const income = Math.floor(raw * pathFx(ch, 'frontIncome'));\n  if (income > 0) {\n    ch.cash = Number(ch.cash) + income;\n    await h.ledger(client, { characterId: ch.id, currency: 'cash', amount: income, reason: 'business:income' });\n    await client.query('UPDATE account_persistent SET tycoon_earned = tycoon_earned + $1 WHERE account_id=$2', [income, ch.account_id]);\n  }\n  return income;\n}\n\n// STEP TWO of THE STREET WAR (residents-as-marks): a RESIDENT runs a SLEEPY joint — its effective\n// income is FRONT_INCOME_BPS of the catalog curve. Applied wherever a resident front's pending is\n// REALIZED (rob/shakedown here, the heist inside job) — residents never collect, so this scale IS\n",
          "baseline": "  return Math.floor(tier.incomePerHr * Math.max(0, elapsed) / 3600000);\n}\n\n// STEP TWO of THE STREET WAR (residents-as-marks): a RESIDENT runs a SLEEPY joint — its effective\n// income is FRONT_INCOME_BPS of the catalog curve. Applied wherever a resident front's pending is\n// REALIZED (rob/shakedown here, the heist inside job) — residents never collect, so this scale IS\n"
        },
        {
          "at": 12861,
          "current": "  if (Number(ch.cash) < tier.cost) throw new GameError('cash', `${art(cat.name, 'The')} costs ${usd(tier.cost)} to set up.`);\n  ch.cash = Number(ch.cash) - tier.cost;\n  const id = uid();\n  // Den rakeback (casino kind): the cursor starts at TODAY's den volume — a new owner earns\n  // against future action, not history. Checkpoint BEFORE the owner count changes.\n  const rake = kind === 'casino' ? await checkpointCasinoRakeback(client) : null;\n  await client.query('INSERT INTO businesses (id, character_id, kind, tier) VALUES ($1,$2,$3,1)', [id, ch.id, kind]);\n  if (kind === 'casino') {\n    await client.query('UPDATE businesses SET rake_cursor=$2, rake_index_cursor=$3 WHERE id=$1', [id, rake.volume, rake.index]);\n  }\n  await h.ledger(client, { characterId: ch.id, currency: 'cash', amount: -tier.cost, reason: 'business:buy' });\n  h.owned.businesses = await businessesOf(client, ch.id); // keep the returned view fresh\n",
          "baseline": "  if (Number(ch.cash) < tier.cost) throw new GameError('cash', `${art(cat.name, 'The')} costs ${usd(tier.cost)} to set up.`);\n  ch.cash = Number(ch.cash) - tier.cost;\n  const id = uid();\n  await client.query('INSERT INTO businesses (id, character_id, kind, tier) VALUES ($1,$2,$3,1)', [id, ch.id, kind]);\n  // Den rakeback (casino kind): the cursor starts at TODAY's den volume — a new owner earns\n  // against future action, not history\n  if (kind === 'casino') {\n    const vol = (await client.query('SELECT total FROM den_volume WHERE id=1')).rows[0];\n    await client.query('UPDATE businesses SET rake_cursor=$2 WHERE id=$1', [id, Number(vol?.total || 0)]);\n  }\n  await h.ledger(client, { characterId: ch.id, currency: 'cash', amount: -tier.cost, reason: 'business:buy' });\n  h.owned.businesses = await businessesOf(client, ch.id); // keep the returned view fresh\n"
        },
        {
          "at": 15852,
          "current": "      // Ledger's +10% is the collector's edge, not more business on the books)\n      await addIncomeScrutiny(r, inc, client);\n    }\n    // Den rakeback follows the owner count at earning time, even when owners join or leave before\n    // collection. A raided casino skips this collection, as before.\n    if (r.kind === 'casino') {\n      const rake = await checkpointCasinoRakeback(client);\n      const { amount: share, paidCursor } = casinoRakebackClaim(r, rake);\n      // econ pass (mint-on-top fix): rakeback pays only out of the den's REALIZED profit net of open\n      // liabilities — all-or-nothing per collect: when the house is under water the cursor doesn't\n      // advance, so the owner's claim simply waits for the book to recover (nothing is forfeited).\n      if (share > 0 && (await denAvailable(client)) >= share) {\n        rakeback += share;\n        await denDistribute(client, share);\n        await client.query('UPDATE businesses SET rake_cursor=$2, rake_index_cursor=$3 WHERE id=$1', [r.id, rake.volume, paidCursor]);\n      }\n    }\n  }\n",
          "baseline": "      // Ledger's +10% is the collector's edge, not more business on the books)\n      await addIncomeScrutiny(r, inc, client);\n    }\n    // Den RAKEBACK (casino kind): owners split RAKEBACK_BPS of the den's stake volume since their\n    // cursor — the split is by the CURRENT owner count, so total rakeback per unit of volume is\n    // bounded by RAKEBACK_BPS however many fronts exist. A raided casino forfeits with the rest.\n    if (r.kind === 'casino') {\n      const vol = Number((await client.query('SELECT total FROM den_volume WHERE id=1')).rows[0]?.total || 0);\n      const owners = Number((await client.query(\"SELECT COUNT(*) n FROM businesses WHERE kind='casino'\")).rows[0].n) || 1;\n      const share = Math.floor(Math.max(0, vol - Number(r.rake_cursor)) * (CASINO.RAKEBACK_BPS || 0) / 10000 / owners);\n      // econ pass (mint-on-top fix): rakeback pays only out of the den's REALIZED profit net of open\n      // liabilities — all-or-nothing per collect: when the house is under water the cursor doesn't\n      // advance, so the owner's claim simply waits for the book to recover (nothing is forfeited).\n      if (share > 0 && (await denAvailable(client)) >= share) {\n        rakeback += share;\n        await denDistribute(client, share);\n        await client.query('UPDATE businesses SET rake_cursor=$2 WHERE id=$1', [r.id, vol]);\n      }\n    }\n  }\n"
        },
        {
          "at": 16926,
          "current": "    // PATHS v2 — the Ledger's \"+10% front income\" was ADVERTISED since M4 and never implemented\n    // (the migration-sweep map finding); now real. Flagged in BALANCE.md: a ~10% widen of the\n    // L1a-flattened front curve for ONE path choice that also carries the soft-hands handicap.\n    // TYCOON fold-in (Tier-4): business income counts toward the account-level tycoon_earned legend\n    // (the comment gap the code never closed). Direct SQL, own account, OFF persistAccount → clobber-safe;\n    // this is on-demand collect income, distinct from ch._accruedIncome — no double-count.\n    total = await creditFrontIncome(ch, total, client, h);\n  }\n  if (rakeback > 0) {\n    ch.cash = Number(ch.cash) + rakeback;\n",
          "baseline": "    // PATHS v2 — the Ledger's \"+10% front income\" was ADVERTISED since M4 and never implemented\n    // (the migration-sweep map finding); now real. Flagged in BALANCE.md: a ~10% widen of the\n    // L1a-flattened front curve for ONE path choice that also carries the soft-hands handicap.\n    total = Math.floor(total * pathFx(ch, 'frontIncome'));\n    ch.cash = Number(ch.cash) + total;\n    await h.ledger(client, { characterId: ch.id, currency: 'cash', amount: total, reason: 'business:income' });\n    // TYCOON fold-in (Tier-4): business income counts toward the account-level tycoon_earned legend\n    // (the comment gap the code never closed). Direct SQL, own account, OFF persistAccount → clobber-safe;\n    // this is on-demand collect income, distinct from ch._accruedIncome — no double-count.\n    await client.query('UPDATE account_persistent SET tycoon_earned = tycoon_earned + $1 WHERE account_id=$2', [total, ch.account_id]);\n  }\n  if (rakeback > 0) {\n    ch.cash = Number(ch.cash) + rakeback;\n"
        },
        {
          "at": 23294,
          "current": "  if (jailed(ch)) throw new GameError('jailed', \"You can't close up from a cell.\");\n  const r = (await client.query('SELECT * FROM businesses WHERE id=$1 AND character_id=$2 FOR UPDATE', [businessId, ch.id])).rows[0];\n  if (!r) throw new GameError('not_yours', \"That's not your business.\");\n  if (r.kind === 'casino') await checkpointCasinoRakeback(client);\n  const back = Math.floor(businessAssessedValue(r.kind, r.tier) * (CONSTANTS.BUSINESS_SHUTTER_BPS / 10000));\n  if (back > 0) {\n    ch.cash = Number(ch.cash) + back;\n",
          "baseline": "  if (jailed(ch)) throw new GameError('jailed', \"You can't close up from a cell.\");\n  const r = (await client.query('SELECT * FROM businesses WHERE id=$1 AND character_id=$2 FOR UPDATE', [businessId, ch.id])).rows[0];\n  if (!r) throw new GameError('not_yours', \"That's not your business.\");\n  const back = Math.floor(businessAssessedValue(r.kind, r.tier) * (CONSTANTS.BUSINESS_SHUTTER_BPS / 10000));\n  if (back > 0) {\n    ch.cash = Number(ch.cash) + back;\n"
        },
        {
          "at": 25188,
          "current": "  if (!next) throw new GameError('maxed', `Your ${cat.name} already runs at full strength.`);\n  if (isCold(r)) throw new GameError('cold', `${art(cat.name, 'The')} is dark — pay the pad before you pour money into it.`);\n  const raid = await resolveScrutiny(ch, r, client, h); // a raid seizes the pending before it banks\n  const rawPending = raid.raided ? 0 : accrued(r);\n  const pending = Math.floor(rawPending * pathFx(ch, 'frontIncome'));\n  if (Number(ch.cash) + pending < next.cost) throw new GameError('cash', `Upgrading ${art(cat.name)} costs ${usd(next.cost)}.`);\n  // bank the pending at the old rate, then debit the upgrade — net in one cash figure. The upgrade\n  // also squares the pad (upkeep_at=now): a fresh clock at the new rate, no retroactive rate bump.\n  await creditFrontIncome(ch, rawPending, client, h);\n  ch.cash = Number(ch.cash) - next.cost;\n  // the banked pending draws the same income heat a collect does (r still carries the OLD tier in\n  // memory, which is the rate the pending accrued at — the right normalization)\n  if (rawPending > 0) await addIncomeScrutiny(r, rawPending, client);\n  await client.query('UPDATE businesses SET tier=$2, last_collect_at=now(), upkeep_at=now() WHERE id=$1', [businessId, next.tier]);\n  await h.ledger(client, { characterId: ch.id, currency: 'cash', amount: -next.cost, reason: 'business:upgrade' });\n  h.owned.businesses = await businessesOf(client, ch.id);\n  // FOUND BY PLAYING: this reply carried neither the price nor the consequence, so a $600,000\n",
          "baseline": "  if (!next) throw new GameError('maxed', `Your ${cat.name} already runs at full strength.`);\n  if (isCold(r)) throw new GameError('cold', `${art(cat.name, 'The')} is dark — pay the pad before you pour money into it.`);\n  const raid = await resolveScrutiny(ch, r, client, h); // a raid seizes the pending before it banks\n  const pending = raid.raided ? 0 : accrued(r);\n  if (Number(ch.cash) + pending < next.cost) throw new GameError('cash', `Upgrading ${art(cat.name)} costs ${usd(next.cost)}.`);\n  // bank the pending at the old rate, then debit the upgrade — net in one cash figure. The upgrade\n  // also squares the pad (upkeep_at=now): a fresh clock at the new rate, no retroactive rate bump.\n  ch.cash = Number(ch.cash) + pending - next.cost;\n  // the banked pending draws the same income heat a collect does (r still carries the OLD tier in\n  // memory, which is the rate the pending accrued at — the right normalization)\n  if (pending > 0) await addIncomeScrutiny(r, pending, client);\n  await client.query('UPDATE businesses SET tier=$2, last_collect_at=now(), upkeep_at=now() WHERE id=$1', [businessId, next.tier]);\n  if (pending > 0) await h.ledger(client, { characterId: ch.id, currency: 'cash', amount: pending, reason: 'business:income' });\n  await h.ledger(client, { characterId: ch.id, currency: 'cash', amount: -next.cost, reason: 'business:upgrade' });\n  h.owned.businesses = await businessesOf(client, ch.id);\n  // FOUND BY PLAYING: this reply carried neither the price nor the consequence, so a $600,000\n"
        },
        {
          "at": 40408,
          "current": "// reset ALL mutable front state on a change of hands — a seized/bought front is never born hot/cold/\n// pending-full/specialized (the speakeasy resetClubToNewOwner precedent). takeover_cd_until is set by the\n// caller BEFORE this (win OR lose) and is deliberately NOT reset here so it survives the handover.\nasync function resetFrontToNewOwner(client, businessId, newOwnerId, kind) {\n  // (red-team) Den rakeback: the cursor moves to TODAY's volume on a change of hands — the SAME rule\n  // buyBusiness states (\"a new owner earns against future action, not history\"). Leaving it at 0 handed\n  // the new owner a claim on the ENTIRE lifetime den volume: not a mint (denAvailable caps every payout\n  // at realized profit) but a queue-jump that drains the shared, profit-bounded rakeback pool at the\n  // expense of every honest casino-front owner, whose claims then wait for the book to recover.\n  const rake = kind === 'casino' ? await checkpointCasinoRakeback(client) : null;\n  const vol = rake?.volume ?? Number((await client.query('SELECT total FROM den_volume WHERE id=1')).rows[0]?.total || 0);\n  await client.query(\n    `UPDATE businesses SET character_id=$2, tier=tier, spec=NULL, spec_at=NULL, scrutiny=0, scrutiny_at=now(),\n       last_collect_at=now(), launder_used=0, launder_at=now(), upkeep_at=now(), shakedown_at=NULL, rake_cursor=$3, rake_index_cursor=$4\n     WHERE id=$1`, [businessId, newOwnerId, vol, rake?.index ?? null]);\n}\n\n// ── Tier-4: THE HOSTILE TAKEOVER — the speakeasy-standover twin, applied to fronts (they change hands,\n",
          "baseline": "// reset ALL mutable front state on a change of hands — a seized/bought front is never born hot/cold/\n// pending-full/specialized (the speakeasy resetClubToNewOwner precedent). takeover_cd_until is set by the\n// caller BEFORE this (win OR lose) and is deliberately NOT reset here so it survives the handover.\nasync function resetFrontToNewOwner(client, businessId, newOwnerId) {\n  // (red-team) Den rakeback: the cursor moves to TODAY's volume on a change of hands — the SAME rule\n  // buyBusiness states (\"a new owner earns against future action, not history\"). Leaving it at 0 handed\n  // the new owner a claim on the ENTIRE lifetime den volume: not a mint (denAvailable caps every payout\n  // at realized profit) but a queue-jump that drains the shared, profit-bounded rakeback pool at the\n  // expense of every honest casino-front owner, whose claims then wait for the book to recover.\n  const vol = Number((await client.query('SELECT total FROM den_volume WHERE id=1')).rows[0]?.total || 0);\n  await client.query(\n    `UPDATE businesses SET character_id=$2, tier=tier, spec=NULL, spec_at=NULL, scrutiny=0, scrutiny_at=now(),\n       last_collect_at=now(), launder_used=0, launder_at=now(), upkeep_at=now(), shakedown_at=NULL, rake_cursor=$3\n     WHERE id=$1`, [businessId, newOwnerId, vol]);\n}\n\n// ── Tier-4: THE HOSTILE TAKEOVER — the speakeasy-standover twin, applied to fronts (they change hands,\n"
        },
        {
          "at": 46230,
          "current": "  owner.cash = Number(owner.cash) + net;\n  await h.ledger(client, { characterId: ch.id, currency: 'cash', amount: -price, reason: 'business:buyout', counterparty: owner.id });\n  await h.ledger(client, { characterId: owner.id, currency: 'cash', amount: net, reason: 'business:buyout', counterparty: ch.id });\n  await resetFrontToNewOwner(client, businessId, ch.id, r.kind); // fresh: scrutiny 0, spec cleared, clocks reset\n  await client.query('UPDATE street_tax SET pool = pool + $1 WHERE id=1', [tax]); // singleton LAST (canonical order)\n  h.owned.businesses = await businessesOf(client, ch.id);\n  await h.notify(client, owner.id, 'takeover', { from: ch.name, kind: r.kind, kindName: businessOf(r.kind)?.name || r.kind, net });\n",
          "baseline": "  owner.cash = Number(owner.cash) + net;\n  await h.ledger(client, { characterId: ch.id, currency: 'cash', amount: -price, reason: 'business:buyout', counterparty: owner.id });\n  await h.ledger(client, { characterId: owner.id, currency: 'cash', amount: net, reason: 'business:buyout', counterparty: ch.id });\n  await resetFrontToNewOwner(client, businessId, ch.id); // fresh: scrutiny 0, spec cleared, clocks reset\n  await client.query('UPDATE street_tax SET pool = pool + $1 WHERE id=1', [tax]); // singleton LAST (canonical order)\n  h.owned.businesses = await businessesOf(client, ch.id);\n  await h.notify(client, owner.id, 'takeover', { from: ch.name, kind: r.kind, kindName: businessOf(r.kind)?.name || r.kind, net });\n"
        }
      ]
    },
    "src/engagement.js": {
      "current": {
        "mode": "100644",
        "blob": "14663ca141d770de8c31680de330f65c86412ab9",
        "sha256": "7dc333c422f02a2bc2c202dab8b71270bd90db0dd5d65b063bcf351a3fdd4917",
        "bytes": 20732
      },
      "baseline": {
        "mode": "100644",
        "blob": "3fc2773c44cd32dcd970c470fcfcc941dcd73b00",
        "sha256": "9dd0e49b49bc2403ed7dca6b5bb6dffb953c36fcb056dadcf6207219ef725b63",
        "bytes": 20703
      },
      "inverses": [
        {
          "at": 11535,
          "current": "\n  // Flat read, JS aggregation (pg-mem). Windowed, so this scales with activity not with history.\n  const rows = (await pool.query(\n    \"SELECT account_id, event, props, at FROM telemetry WHERE at >= $1 AND event <> 'website_count' LIMIT $2\", [since, MAX_ROWS])).rows;\n\n  const perSystem = new Map();          // system -> {accounts:Set, events:n, last:Date}\n  const agentActions = new Map();       // action kind -> {events, recommended}\n",
          "baseline": "\n  // Flat read, JS aggregation (pg-mem). Windowed, so this scales with activity not with history.\n  const rows = (await pool.query(\n    'SELECT account_id, event, props, at FROM telemetry WHERE at >= $1 LIMIT $2', [since, MAX_ROWS])).rows;\n\n  const perSystem = new Map();          // system -> {accounts:Set, events:n, last:Date}\n  const agentActions = new Map();       // action kind -> {events, recommended}\n"
        }
      ]
    },
    "src/firstblood.js": {
      "current": {
        "mode": "100644",
        "blob": "c838542b5bbe8968c9d777329a8d584558358c05",
        "sha256": "8ab27498da2f54dd9ec755e7ce8089426a1f919094dd5c788df6407e302c3975",
        "bytes": 6186
      },
      "baseline": {
        "mode": "100644",
        "blob": "7568de7f861f2453c4f163507b0f314e8a10689d",
        "sha256": "33be4793e498cec80ef115fb5667389251819e5295b44f5fbd8b8ebfe52912be",
        "bytes": 6163
      },
      "inverses": [
        {
          "at": 3585,
          "current": "    // non-uuid seed (never a production account); nothing partial has committed yet.\n    if (!UUID_RE.test(me.account_id) || !UUID_RE.test(rival.account_id)) { await client.query('ROLLBACK'); return null; }\n    // the rival \"makes a move\" — a rival_events row (aggressor = the resident) so it surfaces on the\n    // nemesis card + the rivals ledger exactly like a real player's move. The intelligence roster\n    // projects this assigned identity for the player only; the callout grants no current sighting.\n    await client.query(\n      'INSERT INTO rival_events (id, victim_account, aggressor_account, kind, detail) VALUES ($1,$2,$3,$4,$5)',\n      [uid(), me.account_id, rival.account_id, 'callout', JSON.stringify({ firstBlood: true })]);\n",
          "baseline": "    // non-uuid seed (never a production account); nothing partial has committed yet.\n    if (!UUID_RE.test(me.account_id) || !UUID_RE.test(rival.account_id)) { await client.query('ROLLBACK'); return null; }\n    // the rival \"makes a move\" — a rival_events row (aggressor = the resident) so it surfaces on the\n    // nemesis card + the rivals ledger exactly like a real player's move; the info-economy rule holds\n    // because the streets already show everyone who is in the district.\n    await client.query(\n      'INSERT INTO rival_events (id, victim_account, aggressor_account, kind, detail) VALUES ($1,$2,$3,$4,$5)',\n      [uid(), me.account_id, rival.account_id, 'callout', JSON.stringify({ firstBlood: true })]);\n"
        }
      ]
    },
    "src/legal.js": {
      "current": {
        "mode": "100644",
        "blob": "840534a3e339053d29518bba12b92766f87c1d8e",
        "sha256": "32cbb32c868d3c50b2e1ee529676ac87609f12b78377eb5208c264ebf73e28cf",
        "bytes": 14912
      },
      "baseline": {
        "mode": "100644",
        "blob": "1f9241475697b532c572bdd1ca21e20e4e1f788a",
        "sha256": "a9d8138f0efe8deb268468af19c8c92e82b5401dc9975ab988ddae3a320b487c",
        "bytes": 13733
      },
      "inverses": [
        {
          "at": 1524,
          "current": "  const title = { privacy: 'Privacy policy', terms: 'Payment terms', dmca: 'Copyright notices', resources: 'Scripts, fonts and service providers' }[kind];\n  if (!title) throw new Error('Unknown legal page');\n  const bodies = {\n    privacy: `<p><strong>Last updated: November 7, 2026.</strong> This policy explains what information OMERTÀ collects, how we use it, and the choices available to you when you use the game, website, API or connected-agent features.</p>\n${c.name ? `<p>Operator: ${esc(c.name)}.${c.address ? ` Postal address: ${esc(c.address)}.` : ''}</p>` : ''}\n<h2>Information we collect</h2><ul>\n<li><strong>Account and access information.</strong> Guest account identifiers, authentication-provider identifiers, sign-in records and IP addresses associated with account access. You can start as a guest without providing an email address.</li>\n",
          "baseline": "  const title = { privacy: 'Privacy policy', terms: 'Payment terms', dmca: 'Copyright notices', resources: 'Scripts, fonts and service providers' }[kind];\n  if (!title) throw new Error('Unknown legal page');\n  const bodies = {\n    privacy: `<p><strong>Last updated: October 31, 2026.</strong> This policy explains what information OMERTÀ collects, how we use it, and the choices available to you when you use the game, website, API or connected-agent features.</p>\n${c.name ? `<p>Operator: ${esc(c.name)}.${c.address ? ` Postal address: ${esc(c.address)}.` : ''}</p>` : ''}\n<h2>Information we collect</h2><ul>\n<li><strong>Account and access information.</strong> Guest account identifiers, authentication-provider identifiers, sign-in records and IP addresses associated with account access. You can start as a guest without providing an email address.</li>\n"
        },
        {
          "at": 3534,
          "current": "<li><strong>Connected agents.</strong> Delegated-agent permissions, connection and request records, proposed actions, approvals and results. A third-party AI client you connect can receive the game context allowed by the permissions you grant.</li>\n<li><strong>Technical diagnostics.</strong> We collect information about service performance, errors and reliability. Hosting and network providers may process connection information and maintain operational logs to deliver and protect the service.</li></ul>\n<h2>How we use information</h2><p>We use information to create and authenticate accounts, run the game, deliver messages and requested notifications, keep game and transaction records, process purchases, operate connected-agent features, and provide account support. We use operational activity records to understand service use, diagnose problems, maintain game integrity, enforce rules, prevent fraud and abuse, and investigate security incidents.</p>\n<h2>Cookies, browser storage and analytics</h2><p>We use cookies and browser storage to keep you signed in, remember language, sound and interface preferences, support account access and remember local game settings. Clearing storage may sign you out or reset preferences; keep a recovery method for a guest account.</p><p>Website analytics are optional and off until you choose “Allow counts” under “Analytics choices”. If you allow them, we count public page views, clicks to selected pages, confirmed guest account creation and one-time first-job reward claims in daily totals, retained for up to 90 days. First-job counts record the reward claim after the job, rather than the instant the job succeeds. These totals contain no account or wallet identifiers, IP addresses, visitor identifiers, query strings or referrers. They measure events, not unique visitors. Your choice is saved in this browser; you can change it through “Analytics choices” on any public page. We respect Global Privacy Control and Do Not Track by keeping these counts off. Ordinary network and security processing still applies to requests sent to our server.</p><p>In-game screen, quiz-answer and share analytics remain disabled. We do not load advertising pixels or session-replay tools. Quiz answers are processed to calculate your result without being saved as analytics. Operational game and security logging remains active. WalletConnect loads when you select it; its optional telemetry and modal analytics are disabled.</p>\n<h2>When information is shared</h2><p>Hosting and database providers process data needed to run the service. X or Privy handles sign-in when selected. Resend, or the configured email provider, delivers requested emails; your browser's push provider delivers notifications you enable. WalletConnect and blockchain RPC providers support wallet features. See the <a href=\"/resources\">scripts, fonts and service-provider inventory</a>.</p><p>Public game content is shared with its intended audience. Information sent to a third-party AI, identity, wallet or notification provider is also subject to that provider's privacy practices. Providers may process information in a country different from yours. We may disclose information to comply with legal obligations or protect players, investigate misuse and secure the service.</p>\n<h2>How long we keep information</h2><p>We keep information for as long as needed to provide the features you use, maintain game and transaction records, resolve disputes, prevent misuse and meet applicable legal obligations. Retention depends on the type of information and why it is needed. Messages and routine operational records are subject to periodic cleanup; some account, accounting and service-integrity records are retained longer. Provider logs and backups may follow separate retention periods, and backups may retain deleted information until they expire. Public blockchain records remain available independently of OMERTÀ.</p>\n<h2>Your choices and requests</h2><p>You can unsubscribe from a digest using the link in the email or turn it off in Profile. Transaction confirmations are separate from marketing preferences and are emailed where a verified address is available. Disable push notifications in the app or browser and revoke connected-agent access in Consigliere.</p><p>Depending on where you live, you may have rights to request access, correction or deletion of personal information, or to object to certain processing. We may need to verify that a request relates to your account. Some accounting, security or legally required records may need to be retained; deleting an account cannot erase blockchain history.</p>\n",
          "baseline": "<li><strong>Connected agents.</strong> Delegated-agent permissions, connection and request records, proposed actions, approvals and results. A third-party AI client you connect can receive the game context allowed by the permissions you grant.</li>\n<li><strong>Technical diagnostics.</strong> We collect information about service performance, errors and reliability. Hosting and network providers may process connection information and maintain operational logs to deliver and protect the service.</li></ul>\n<h2>How we use information</h2><p>We use information to create and authenticate accounts, run the game, deliver messages and requested notifications, keep game and transaction records, process purchases, operate connected-agent features, and provide account support. We use operational activity records to understand service use, diagnose problems, maintain game integrity, enforce rules, prevent fraud and abuse, and investigate security incidents.</p>\n<h2>Cookies, browser storage and analytics</h2><p>We use cookies and browser storage to keep you signed in, remember language, sound and interface preferences, support account access and remember local game settings. Clearing storage may sign you out or reset preferences; keep a recovery method for a guest account.</p><p>Optional screen, quiz-answer and share analytics are disabled. We do not load advertising pixels or session-replay tools. Quiz answers are processed to calculate your result without being saved as analytics. Operational game and security logging remains active. WalletConnect loads when you select it; its optional telemetry and modal analytics are disabled.</p>\n<h2>When information is shared</h2><p>Hosting and database providers process data needed to run the service. X or Privy handles sign-in when selected. Resend, or the configured email provider, delivers requested emails; your browser's push provider delivers notifications you enable. WalletConnect and blockchain RPC providers support wallet features. See the <a href=\"/resources\">scripts, fonts and service-provider inventory</a>.</p><p>Public game content is shared with its intended audience. Information sent to a third-party AI, identity, wallet or notification provider is also subject to that provider's privacy practices. Providers may process information in a country different from yours. We may disclose information to comply with legal obligations or protect players, investigate misuse and secure the service.</p>\n<h2>How long we keep information</h2><p>We keep information for as long as needed to provide the features you use, maintain game and transaction records, resolve disputes, prevent misuse and meet applicable legal obligations. Retention depends on the type of information and why it is needed. Messages and routine operational records are subject to periodic cleanup; some account, accounting and service-integrity records are retained longer. Provider logs and backups may follow separate retention periods, and backups may retain deleted information until they expire. Public blockchain records remain available independently of OMERTÀ.</p>\n<h2>Your choices and requests</h2><p>You can unsubscribe from a digest using the link in the email or turn it off in Profile. Transaction confirmations are separate from marketing preferences and are emailed where a verified address is available. Disable push notifications in the app or browser and revoke connected-agent access in Consigliere.</p><p>Depending on where you live, you may have rights to request access, correction or deletion of personal information, or to object to certain processing. We may need to verify that a request relates to your account. Some accounting, security or legally required records may need to be retained; deleting an account cannot erase blockchain history.</p>\n"
        },
        {
          "at": 9075,
          "current": "<h2>Changes to this policy</h2><p>We will update this page and its date when our practices change, and provide additional notice or request consent when required.</p>`,\n    terms: `<p>Operator: ${esc(c.name)} · ${esc(c.address)} · ${contact}.</p><section id=\"payments\"><h2>Passes, watches and confirmation</h2><p>Made Man gives you 30 days of access for the displayed $OMR price. Street Wire gives you the displayed tier and duration. Both are prepaid game passes. Buying again extends access, and neither renews automatically. Benefits end when the pass expires unless you buy again.</p><p>Standing Watches automatically spend the displayed $OMR tap price each cycle while the watch is enrolled and eligible. The Wire screen shows the price and interval before enrollment. Select “drop the watch” online to stop future renewals; the tap you already paid for lasts until expiry. You can cancel each watch in the app or with DELETE /v1/wire/watch/:targetId.</p><p>The app confirms purchases immediately. If you have a verified email address, we also queue a transaction confirmation email regardless of your marketing preferences. Keep the confirmation and check your ledger. Wallet transactions and on-chain purchases may have network fees and their own published price. Review each transaction before signing.</p><h2>Refunds and cancellation</h2><p>${esc(c.refunds)}</p><p>Contact ${contact} with the transaction identifier for payment questions or a refund request. These terms do not limit rights provided by applicable law. Cancelling a watch stops future renewals; it does not reverse a cycle you already paid for.</p></section>`,\n    dmca: `<p>${esc(c.name)} hosts player text and other game contributions. Report copyright concerns to the designated agent: ${esc(c.agent)}, ${esc(c.agentAddress)}, telephone ${esc(c.agentPhone)}, <a href=\"mailto:${esc(c.agentEmail)}\">${esc(c.agentEmail)}</a>. Agent registration is available in the <a href=\"https://www.copyright.gov/dmca-directory/\">U.S. Copyright Office directory</a>.</p><h2>Notice of claimed infringement</h2><p>Provide your physical or electronic signature; identify the copyrighted work (or a representative list); identify the allegedly infringing material and its precise location; provide your address, telephone number and email; state your good-faith belief that use is not authorized by the owner, its agent or law; and state that the information is accurate and, under penalty of perjury, that you are authorized to act for the owner.</p><h2>Counter-notice</h2><p>A counter-notice must contain your signature, identify the removed material and its former location, state under penalty of perjury a good-faith belief that removal resulted from mistake or misidentification, and provide your name, address and telephone number. Include consent to the jurisdiction of the federal district court for your address (or, outside the United States, a district where the provider may be found) and acceptance of service from the complainant or its agent.</p><p>The operator reviews notices, handles removal and counter-notices under applicable law, and may terminate access for repeat infringers in appropriate circumstances. Send notices to the agent rather than posting them in public chat.</p>`,\n    resources: `<h2>Browser scripts and fonts</h2><ul><li>This site serves OMERTÀ HTML, inline game code, Consigliere code and shared CSS.</li><li>The locally hosted website analytics script counts public page views, selected link clicks and confirmed onboarding milestones only after you opt in through “Analytics choices”. It sends daily aggregate dimensions without account or visitor identifiers. See the <a href=\"/privacy\">privacy policy</a> for controls and retention.</li><li>WalletConnect Ethereum Provider 2.26.0 and its locked transitive dependencies are bundled at /vendor/walletconnect.js. See the <a href=\"/vendor/walletconnect-manifest.json\">package versions and licenses</a> and <a href=\"/vendor/walletconnect.js.LEGAL.txt\">license notices</a>. The bundle loads only when you choose WalletConnect. It connects to WalletConnect relay/RPC/verification services and api.web3modal.org for wallet discovery. Its analytics and telemetry are disabled.</li><li>The display font, Oswald / Omerta Display, is hosted here at /art/display.woff2. Other font families use system fonts without contacting a font provider.</li><li>The site makes no Google Fonts requests and uses no advertising pixels, third-party analytics scripts or session replay.</li></ul><h2>Optional service providers</h2><p>When selected, X or Privy handles identity and WalletConnect handles wallet pairing. Resend is the default provider for requested email. Your browser’s push service delivers notifications you enable. Muse or another AI client connects only when you choose it. Hosting and database providers depend on the deployment. These services do not supply third-party browser tracking scripts. Network requests may disclose your IP address and the minimum data needed for the service you choose.</p>`,\n  };\n  const body = ready ? bodies[kind] : '<p>This policy is not yet available. Please return later before signing up or buying access.</p>';\n  return { ready, html: `<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>${title} | OMERTÀ</title><link rel=\"stylesheet\" href=\"/omerta-ui.css\"><style>main{max-width:760px;margin:auto;padding:32px 20px;line-height:1.7}a{color:#e0bd72}nav{display:flex;flex-wrap:wrap;gap:16px}</style></head><body><main><nav aria-label=\"Policies\"><a href=\"/\">OMERTÀ</a><a href=\"/privacy\">Privacy</a><a href=\"/terms\">Terms</a><a href=\"/dmca\">Copyright</a><a href=\"/resources\">Resources</a></nav><h1>${title}</h1>${body}</main></body></html>` };\n",
          "baseline": "<h2>Changes to this policy</h2><p>We will update this page and its date when our practices change, and provide additional notice or request consent when required.</p>`,\n    terms: `<p>Operator: ${esc(c.name)} · ${esc(c.address)} · ${contact}.</p><section id=\"payments\"><h2>Passes, watches and confirmation</h2><p>Made Man gives you 30 days of access for the displayed $OMR price. Street Wire gives you the displayed tier and duration. Both are prepaid game passes. Buying again extends access, and neither renews automatically. Benefits end when the pass expires unless you buy again.</p><p>Standing Watches automatically spend the displayed $OMR tap price each cycle while the watch is enrolled and eligible. The Wire screen shows the price and interval before enrollment. Select “drop the watch” online to stop future renewals; the tap you already paid for lasts until expiry. You can cancel each watch in the app or with DELETE /v1/wire/watch/:targetId.</p><p>The app confirms purchases immediately. If you have a verified email address, we also queue a transaction confirmation email regardless of your marketing preferences. Keep the confirmation and check your ledger. Wallet transactions and on-chain purchases may have network fees and their own published price. Review each transaction before signing.</p><h2>Refunds and cancellation</h2><p>${esc(c.refunds)}</p><p>Contact ${contact} with the transaction identifier for payment questions or a refund request. These terms do not limit rights provided by applicable law. Cancelling a watch stops future renewals; it does not reverse a cycle you already paid for.</p></section>`,\n    dmca: `<p>${esc(c.name)} hosts player text and other game contributions. Report copyright concerns to the designated agent: ${esc(c.agent)}, ${esc(c.agentAddress)}, telephone ${esc(c.agentPhone)}, <a href=\"mailto:${esc(c.agentEmail)}\">${esc(c.agentEmail)}</a>. Agent registration is available in the <a href=\"https://www.copyright.gov/dmca-directory/\">U.S. Copyright Office directory</a>.</p><h2>Notice of claimed infringement</h2><p>Provide your physical or electronic signature; identify the copyrighted work (or a representative list); identify the allegedly infringing material and its precise location; provide your address, telephone number and email; state your good-faith belief that use is not authorized by the owner, its agent or law; and state that the information is accurate and, under penalty of perjury, that you are authorized to act for the owner.</p><h2>Counter-notice</h2><p>A counter-notice must contain your signature, identify the removed material and its former location, state under penalty of perjury a good-faith belief that removal resulted from mistake or misidentification, and provide your name, address and telephone number. Include consent to the jurisdiction of the federal district court for your address (or, outside the United States, a district where the provider may be found) and acceptance of service from the complainant or its agent.</p><p>The operator reviews notices, handles removal and counter-notices under applicable law, and may terminate access for repeat infringers in appropriate circumstances. Send notices to the agent rather than posting them in public chat.</p>`,\n    resources: `<h2>Browser scripts and fonts</h2><ul><li>This site serves OMERTÀ HTML, inline game code, Consigliere code and shared CSS.</li><li>WalletConnect Ethereum Provider 2.26.0 and its locked transitive dependencies are bundled at /vendor/walletconnect.js. See the <a href=\"/vendor/walletconnect-manifest.json\">package versions and licenses</a> and <a href=\"/vendor/walletconnect.js.LEGAL.txt\">license notices</a>. The bundle loads only when you choose WalletConnect. It connects to WalletConnect relay/RPC/verification services and api.web3modal.org for wallet discovery. Analytics and telemetry are disabled.</li><li>The display font, Oswald / Omerta Display, is hosted here at /art/display.woff2. Other font families use system fonts without contacting a font provider.</li><li>The site makes no Google Fonts requests and uses no advertising pixels, third-party analytics scripts or session replay.</li></ul><h2>Optional service providers</h2><p>When selected, X or Privy handles identity and WalletConnect handles wallet pairing. Resend is the default provider for requested email. Your browser’s push service delivers notifications you enable. Muse or another AI client connects only when you choose it. Hosting and database providers depend on the deployment. These services do not supply third-party browser tracking scripts. Network requests may disclose your IP address and the minimum data needed for the service you choose.</p>`,\n  };\n  const body = ready ? bodies[kind] : '<p>This policy is not yet available. Please return later before signing up or buying access.</p>';\n  return { ready, html: `<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>${title} | OMERTÀ</title><link rel=\"stylesheet\" href=\"/omerta-ui.css\"><style>main{max-width:760px;margin:auto;padding:32px 20px;line-height:1.7}a{color:#e0bd72}nav{display:flex;flex-wrap:wrap;gap:16px}</style></head><body><main><nav aria-label=\"Policies\"><a href=\"/\">OMERTÀ</a><a href=\"/privacy\">Privacy</a><a href=\"/terms\">Terms</a><a href=\"/dmca\">Copyright</a><a href=\"/resources\">Resources</a></nav><h1>${title}</h1>${body}</main></body></html>` };\n"
        }
      ]
    },
    "src/ops.js": {
      "current": {
        "mode": "100644",
        "blob": "a8cc0c615dc845b09fc1b7ef088f9e8572e87d74",
        "sha256": "c389c3e053333b44941a5e42aee0d58a90038bc6019bd1f572d30230b68b6ade",
        "bytes": 16133
      },
      "baseline": {
        "mode": "100644",
        "blob": "78be2971bae3eb35ce97836977e62aaf1002c74a",
        "sha256": "65369bf141920b2eecd0aeb963f68bdbccfd3f7bfbac8f28031fba3c5bcfe6de",
        "bytes": 16102
      },
      "inverses": [
        {
          "at": 8374,
          "current": "// The live event feed — recent telemetry rows (what's happening right now), newest first.\nexport async function opsActivity(pool, limit = 50) {\n  const n = Math.min(200, Math.max(1, Math.floor(Number(limit) || 50)));\n  const rows = (await pool.query(\"SELECT event, props, at FROM telemetry WHERE event <> 'website_count' ORDER BY at DESC LIMIT $1\", [n])).rows;\n  return { events: rows.map((r) => ({ event: r.event, at: r.at, props: safeParse(r.props) })) };\n}\n\n",
          "baseline": "// The live event feed — recent telemetry rows (what's happening right now), newest first.\nexport async function opsActivity(pool, limit = 50) {\n  const n = Math.min(200, Math.max(1, Math.floor(Number(limit) || 50)));\n  const rows = (await pool.query('SELECT event, props, at FROM telemetry ORDER BY at DESC LIMIT $1', [n])).rows;\n  return { events: rows.map((r) => ({ event: r.event, at: r.at, props: safeParse(r.props) })) };\n}\n\n"
        }
      ]
    },
    "src/playerintel.js": {
      "current": {
        "mode": "100644",
        "blob": "0716e814086186744986f15ebe2b7df166b69571",
        "sha256": "2ab3b8c1d3c95112f1bcc9c11655d8442a2490cee65386a082301aebb4fc1cd3",
        "bytes": 11291
      },
      "baseline": {
        "mode": "100644",
        "blob": "8a12f5ebaff1ffe4763a47054d069ea34c2665cb",
        "sha256": "2bc94b95470582fe042510905df825a027ff73454d658ac6f5abceb9b2709662",
        "bytes": 10627
      },
      "inverses": [
        {
          "at": 5851,
          "current": "\nexport async function playerIntelBoard(q, ch) {\n  const known = await playerIntelMap(q, ch.account_id);\n  // The first-score callout introduces this exact resident to its assigned player. It is not a\n  // sighting: keep the roster actionable without revealing location, level, or the resident's heir.\n  // Projecting the active assignment also repairs beats created before the intelligence board.\n  if (Number(ch.aha_stage) === 1 && ch.aha_rival && !known.has(ch.aha_rival)) {\n    const rival = (await q.query(\n      'SELECT id, name FROM characters WHERE id=$1 AND is_npc AND alive', [ch.aha_rival],\n    )).rows[0];\n    if (rival) known.set(rival.id, { id: rival.id, name: ch.aha_rival_name || rival.name,\n      npc: true, source: 'callout', sourceName: null });\n  }\n  const represented = new Set((await q.query(\n    `SELECT c.account_id FROM player_intel i JOIN characters c ON c.id=i.target_character\n      WHERE i.owner_account=$1`, [ch.account_id])).rows.map((row) => row.account_id));\n",
          "baseline": "\nexport async function playerIntelBoard(q, ch) {\n  const known = await playerIntelMap(q, ch.account_id);\n  const represented = new Set((await q.query(\n    `SELECT c.account_id FROM player_intel i JOIN characters c ON c.id=i.target_character\n      WHERE i.owner_account=$1`, [ch.account_id])).rows.map((row) => row.account_id));\n"
        }
      ]
    },
    "src/population.js": {
      "current": {
        "mode": "100644",
        "blob": "2e993fa6bc2c0339f60642463803ea72b5573d84",
        "sha256": "4671510bf6b150b317839210a30ec452caf2a14ee83e292e0829fe37d64a068e",
        "bytes": 57515
      },
      "baseline": {
        "mode": "100644",
        "blob": "81e66e10d3d575f58fe62f486bfed307a7a71328",
        "sha256": "86ea4b0d0b1b21869860f8d25065ad8800ef691c3ba8be461a4debbce55a9421",
        "bytes": 57104
      },
      "inverses": [
        {
          "at": 2152,
          "current": "import { residentEnterStakes } from './stable.js';\nimport { consumeGoodsLiquidity } from './goodsmarket.js';\nimport { goodsBuyQuote } from './goodsquote.js';\nimport { checkpointCasinoRakeback, checkpointCasinoOwnerRemoval } from './casinorakeback.js';\n// NPC FAMILIES: founding and joining run through the AUDITED player path, not a copy of it — the\n// name/tag validation, the uniqueness clash check, the ledgered `gang:found` sink, the FOR UPDATE\n// on the gang row and the GANG_MAX_MEMBERS count invariant are all the same code a player runs.\n",
          "baseline": "import { residentEnterStakes } from './stable.js';\nimport { consumeGoodsLiquidity } from './goodsmarket.js';\nimport { goodsBuyQuote } from './goodsquote.js';\n// NPC FAMILIES: founding and joining run through the AUDITED player path, not a copy of it — the\n// name/tag validation, the uniqueness clash check, the ledgered `gang:found` sink, the FOR UPDATE\n// on the gang row and the GANG_MAX_MEMBERS count invariant are all the same code a player runs.\n"
        },
        {
          "at": 9564,
          "current": "  }\n  if (wants('front') && M.FRONTS[band.id]) {\n    const [kind, tier] = M.FRONTS[band.id];\n    const rake = kind === 'casino' ? await checkpointCasinoRakeback(client) : null;\n    const frontId = uid();\n    await client.query('INSERT INTO businesses (id, character_id, kind, tier) VALUES ($1,$2,$3,$4)',\n      [frontId, charId, kind, tier]);\n    if (rake) await client.query('UPDATE businesses SET rake_cursor=$2, rake_index_cursor=$3 WHERE id=$1',\n      [frontId, rake.volume, rake.index]);\n  }\n  if (wants('boat')) {\n    const rrRoll = Math.random();\n",
          "baseline": "  }\n  if (wants('front') && M.FRONTS[band.id]) {\n    const [kind, tier] = M.FRONTS[band.id];\n    await client.query('INSERT INTO businesses (id, character_id, kind, tier) VALUES ($1,$2,$3,$4)',\n      [uid(), charId, kind, tier]);\n  }\n  if (wants('boat')) {\n    const rrRoll = Math.random();\n"
        },
        {
          "at": 12305,
          "current": "  const c = (await client.query(\n    'SELECT id, account_id, cash, bank FROM characters WHERE id=$1 AND alive AND is_npc FOR UPDATE', [charId])).rows[0];\n  if (!c) return null;\n  await checkpointCasinoOwnerRemoval(client, charId);\n\n  // STEP TWO: pull their escrows back in FIRST. A retiring resident with a live loan offer or buy\n  // order would otherwise leave it standing on the board forever with nobody behind it — a player\n",
          "baseline": "  const c = (await client.query(\n    'SELECT id, account_id, cash, bank FROM characters WHERE id=$1 AND alive AND is_npc FOR UPDATE', [charId])).rows[0];\n  if (!c) return null;\n\n  // STEP TWO: pull their escrows back in FIRST. A retiring resident with a live loan offer or buy\n  // order would otherwise leave it standing on the board forever with nobody behind it — a player\n"
        }
      ]
    },
    "src/ratelimit.js": {
      "current": {
        "mode": "100644",
        "blob": "08c87567ed0386fc04f5f99e3e53792eaa0bb527",
        "sha256": "bce10b7fef1c8ef2718a205758cb14b3475543d2c09070fa2af3875ef499b17c",
        "bytes": 7230
      },
      "baseline": {
        "mode": "100644",
        "blob": "02dd02bc4728301adf91bb30114d72f880d72559",
        "sha256": "a430d7231b81f9dfb28ab6858d8175a0a258d735ac736077eb1fcb86a8dffd08",
        "bytes": 7163
      },
      "inverses": [
        {
          "at": 5828,
          "current": "}\n\n// Returns null when allowed, else {retryAfter} seconds.\nexport async function checkRateLimit({ accountId, agent, path, capoRecruits = 0, turnObservation = false }) {\n  const take = redis ? takeRedis : takeMemory;\n  const humanRate = Number(process.env.RATE_HUMAN_PER_SEC || 1);\n  const humanBurst = Number(process.env.RATE_HUMAN_BURST || 5);\n",
          "baseline": "}\n\n// Returns null when allowed, else {retryAfter} seconds.\nexport async function checkRateLimit({ accountId, agent, path, capoRecruits = 0 }) {\n  const take = redis ? takeRedis : takeMemory;\n  const humanRate = Number(process.env.RATE_HUMAN_PER_SEC || 1);\n  const humanBurst = Number(process.env.RATE_HUMAN_BURST || 5);\n"
        },
        {
          "at": 6374,
          "current": "  // ring by construction. No license → the §10.2 hard 1/3s stands exactly as before.\n  const agentRate = agent ? (capoPerksOf(capoRecruits).rate || AGENT_RATE) : null;\n  const main = agent\n    ? await take(turnObservation ? `a:turn:${accountId}` : `a:${accountId}`, agentRate, AGENT_BURST)\n    : await take(`h:${accountId}`, humanRate, humanBurst);\n  if (!main.ok) return { retryAfter: main.retryAfter };\n  // the swap bucket covers EVERY route that drives the AMM curve — business laundering rides the\n",
          "baseline": "  // ring by construction. No license → the §10.2 hard 1/3s stands exactly as before.\n  const agentRate = agent ? (capoPerksOf(capoRecruits).rate || AGENT_RATE) : null;\n  const main = agent\n    ? await take(`a:${accountId}`, agentRate, AGENT_BURST)\n    : await take(`h:${accountId}`, humanRate, humanBurst);\n  if (!main.ok) return { retryAfter: main.retryAfter };\n  // the swap bucket covers EVERY route that drives the AMM curve — business laundering rides the\n"
        }
      ]
    },
    "src/routes/gateway.js": {
      "current": {
        "mode": "100644",
        "blob": "1c2c293a90d947751a8dcace9e5005405935b7c7",
        "sha256": "58391da9c69178ccd90dc1ecd3dee0975fb891e116b7e5d9978536ce4d5c0f05",
        "bytes": 10567
      },
      "baseline": {
        "mode": "100644",
        "blob": "0c5db8c77b1c08d64ca229c433777dc6b7d5a1b8",
        "sha256": "b982886d2dca76dc294d7f4b3e7b30b37439eb21aab2d5f6b9ef636827262789",
        "bytes": 10526
      },
      "inverses": [
        {
          "at": 10175,
          "current": "    ['/consigliere.js', 'consigliere.js', 'application/javascript; charset=utf-8'],\n  ]) {\n    const content = readFileSync(new URL('../../public/' + file, import.meta.url), 'utf8');\n    app.get(url, respond(async (_req, reply) => reply.header('x-frame-options', 'DENY')\n      .header('X-Robots-Tag', 'noindex').type(type).send(content)));\n  }\n  return { gateway, security, events, muse };\n}\n",
          "baseline": "    ['/consigliere.js', 'consigliere.js', 'application/javascript; charset=utf-8'],\n  ]) {\n    const content = readFileSync(new URL('../../public/' + file, import.meta.url), 'utf8');\n    app.get(url, respond(async (_req, reply) => reply.header('x-frame-options', 'DENY').type(type).send(content)));\n  }\n  return { gateway, security, events, muse };\n}\n"
        }
      ]
    },
    "src/server.js": {
      "current": {
        "mode": "100644",
        "blob": "70bb3fb7c534305ee3722de6dc1dd76abfe0d4f8",
        "sha256": "d46f2a3b38cb72b286346508f2421ec7be622778284578fc44b1c87893b5ddea",
        "bytes": 311553
      },
      "baseline": {
        "mode": "100644",
        "blob": "611200379d0bb36629ab79f0d5969f3bf61d9ab2",
        "sha256": "d6187be2766f8573723b60d0e198d38b31c452af19808e3338e2c14e259f8a77",
        "bytes": 308113
      },
      "inverses": [
        {
          "at": 2140,
          "current": "import * as Invites from './invites.js';\nimport { accessCookie, clearAccessCookie, readAccessCookie } from './access.js';\nimport { legalPage } from './legal.js';\nimport { enhancePage, canonicalOrigin, siteRobots, siteSitemap } from './site-seo.js';\nimport { registerSiteAnalytics } from './site-analytics.js';\nimport { prepareClientShell } from './client-shell.js';\nimport * as Discovery from './discovery.js';\nimport * as Mentor from './mentor.js';\nimport * as Streak from './streak.js';\n",
          "baseline": "import * as Invites from './invites.js';\nimport { accessCookie, clearAccessCookie, readAccessCookie } from './access.js';\nimport { legalPage } from './legal.js';\nimport * as Discovery from './discovery.js';\nimport * as Mentor from './mentor.js';\nimport * as Streak from './streak.js';\n"
        },
        {
          "at": 31540,
          "current": "  // invariant worth enforcing (every /v1 route is authed unless explicitly declared public) is about\n  // exactly the routes a refactor is most likely to drop on the floor.\n  app.decorate('routes', routeRegistry);\n  const baseUrl = canonicalOrigin(process.env.PUBLIC_URL || SOCIAL_GAME_URL);\n\n  // ── THE WIRE — what the player actually DOWNLOADS ─────────────────────────────────────────────\n  // tools/pageweight.js measured a cold load of the landing at 5.3 MB on a phone, of which 757 KB was\n",
          "baseline": "  // invariant worth enforcing (every /v1 route is authed unless explicitly declared public) is about\n  // exactly the routes a refactor is most likely to drop on the floor.\n  app.decorate('routes', routeRegistry);\n  const baseUrl = process.env.PUBLIC_URL || SOCIAL_GAME_URL;\n\n  // ── THE WIRE — what the player actually DOWNLOADS ─────────────────────────────────────────────\n  // tools/pageweight.js measured a cold load of the landing at 5.3 MB on a phone, of which 757 KB was\n"
        },
        {
          "at": 35559,
          "current": "  // changes on every deploy, so it is `no-cache` (revalidate, never stale) rather than a max-age, and\n  // an unchanged deploy answers 304 in a few hundred bytes instead of 319 KB. That is the same\n  // reasoning public/sw.js already applies to navigations, one layer down.\n  const publicPageHtml = (html, path) => enhancePage(html, { baseUrl, path })\n    .replace('</head>', '<script src=\"/site-analytics.js\" defer></script></head>');\n  const servePage = (html, extra = {}, path = null) => {\n    if (path) html = publicPageHtml(html, path);\n    const raw = Buffer.from(html, 'utf8');\n    const gz = zlib.gzipSync(raw, { level: 9 });   // level 9: paid once at boot, saved on every hit\n    const etag = '\"' + crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16) + '\"';\n",
          "baseline": "  // changes on every deploy, so it is `no-cache` (revalidate, never stale) rather than a max-age, and\n  // an unchanged deploy answers 304 in a few hundred bytes instead of 319 KB. That is the same\n  // reasoning public/sw.js already applies to navigations, one layer down.\n  const servePage = (html, extra = {}) => {\n    const raw = Buffer.from(html, 'utf8');\n    const gz = zlib.gzipSync(raw, { level: 9 });   // level 9: paid once at boot, saved on every hit\n    const etag = '\"' + crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16) + '\"';\n"
        },
        {
          "at": 38823,
          "current": "  const inviteHtml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'invite.html'), 'utf8');\n  const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization, Accept-Encoding',\n    'Referrer-Policy': 'no-referrer' };\n  const invitePage = servePage(inviteHtml, privateHeaders, '/');\n  const clientPublicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');\n  const clientShell = prepareClientShell(clientHtml, asset => {\n    try { return readFileSync(join(clientPublicDir, asset.slice(1))); } catch { return null; } // optional interface assets may be absent\n  });\n  const gamePage = servePage(clientShell.html, privateHeaders, '/');\n  const serveClientScript = (source, revision) => {\n    const raw = Buffer.from(source), gz = zlib.gzipSync(raw, { level: 9 });\n    const etag = '\"' + crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16) + '\"';\n    return async (req, reply) => {\n      reply.header('Cache-Control', 'no-store').header('Vary', 'Accept-Encoding');\n      if (req.query.v !== revision) return reply.code(409).header('Cache-Control', 'no-store').send({ error: 'client_version_changed' });\n      reply.type('application/javascript; charset=utf-8').header('etag', etag);\n      if (req.headers['if-none-match'] === etag) return reply.code(304).send();\n      return /\\bgzip\\b/i.test(String(req.headers['accept-encoding'] || ''))\n        ? reply.header('content-encoding', 'gzip').send(gz) : reply.send(raw);\n    };\n  };\n  app.get('/game-runtime.js', serveClientScript(clientShell.runtime, clientShell.revision));\n  app.get('/landing-loader.js', serveClientScript(clientShell.loader, clientShell.loaderRevision));\n  app.get('/site-entry.json', async (_req, reply) => reply.header('Cache-Control', 'no-store').send({ xOAuth: A.xOAuthConfigured() }));\n  const notFoundHtml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', '404.html'), 'utf8');\n  app.setNotFoundHandler(async (req, reply) => {\n    const path = req.url.split('?')[0];\n    const accept = String(req.headers.accept || '');\n    const navigation = ['GET', 'HEAD'].includes(req.method)\n      && !/^\\/(?:v1|site-analytics|art|vendor)(?:\\/|$)/.test(path)\n      && (accept.includes('text/html') || (!accept && !/\\.[a-z0-9]+$/i.test(path)));\n    reply.code(404).header('Cache-Control', 'no-store').header('X-Robots-Tag', 'noindex');\n    if (navigation) return reply.type('text/html; charset=utf-8').send(notFoundHtml);\n    return reply.send({ statusCode: 404, error: 'Not Found', message: 'Route not found' });\n  });\n  // A bearer can restore an existing browser session. The separate cookie only opens public views;\n  // gameplay routes continue to demand their bearer and all existing server authority checks.\n  const hasViewAccess = async (req) => {\n",
          "baseline": "  const inviteHtml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'invite.html'), 'utf8');\n  const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization, Accept-Encoding',\n    'Referrer-Policy': 'no-referrer' };\n  const invitePage = servePage(inviteHtml, privateHeaders);\n  const gamePage = servePage(clientHtml, privateHeaders);\n  // A bearer can restore an existing browser session. The separate cookie only opens public views;\n  // gameplay routes continue to demand their bearer and all existing server authority checks.\n  const hasViewAccess = async (req) => {\n"
        },
        {
          "at": 42548,
          "current": "  try { adminHtml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'admin.html'), 'utf8'); } catch { /* headless */ }\n  // (red-team R20) the mod ops console — deny framing (clickjacking defense-in-depth; the dashboard holds\n  // the mod key in sessionStorage and drives confiscate/ban/mint). No CSP (would break its inline scripts).\n  app.get('/admin', servePage(enhancePage(adminHtml, { baseUrl, path: '/admin', indexable: false }),\n    { 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex' }));\n  // the CODEX: the in-game wiki — every system + gameplay loop (public/wiki.html); public, read-only\n  let wikiHtml = '<!doctype html><title>OMERTA codex</title><p>Codex file missing (public/wiki.html).</p>';\n  try { wikiHtml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'wiki.html'), 'utf8'); } catch { /* headless */ }\n  app.get('/wiki', servePage(wikiHtml, {}, '/wiki'));\n  // THE ARENA: the public, keyless agent showcase (public/arena.html) — \"watch the machines run the\n  // city.\" The agent differentiator AND a shareable/indexable marketing surface, in one. Read-only,\n  // fetches GET /v1/arena for its data; §10.4-free (banded, no exact per-agent liquid).\n  let arenaHtml = '<!doctype html><title>OMERTA arena</title><p>Arena file missing (public/arena.html).</p>';\n  try { arenaHtml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'arena.html'), 'utf8'); } catch { /* headless */ }\n  app.get('/arena', servePage(arenaHtml, {}, '/arena'));\n\n  // The no-code onboarding walkthrough (set up Claude Desktop to play via the MCP connector).\n  let playHtml = '<!doctype html><title>Play OMERTA with Claude</title><p>Walkthrough file missing (public/play.html).</p>';\n  try { playHtml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'play.html'), 'utf8'); } catch { /* headless */ }\n  app.get('/play', servePage(playHtml, {}, '/play'));\n  const gettingStartedHtml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'getting-started.html'), 'utf8');\n  app.get('/guides/getting-started', servePage(gettingStartedHtml, {}, '/guides/getting-started'));\n  // Public token sale; auction figures remain unavailable until the auction is connected.\n  let saleHtml = '<!doctype html><title>$OMR token sale | OMERTÀ</title><p>Token sale page unavailable.</p>';\n  try { saleHtml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sale.html'), 'utf8'); } catch { /* headless */ }\n  app.get('/sale', servePage(saleHtml, {}, '/sale'));\n  for (const [url, kind] of Object.entries({ '/privacy': 'privacy', '/terms': 'terms', '/dmca': 'dmca', '/resources': 'resources' })) {\n    app.get(url, async (req, reply) => {\n      const page = legalPage(kind);\n      const html = page.ready ? publicPageHtml(page.html, url)\n        : enhancePage(page.html, { baseUrl, path: url, indexable: false });\n      if (!page.ready) reply.header('X-Robots-Tag', 'noindex');\n      return reply.code(page.ready ? 200 : 503).header('Cache-Control', 'no-store').type('text/html; charset=utf-8').send(html);\n    });\n  }\n  app.get('/vendor/walletconnect.js', async (req, reply) => reply.type('application/javascript; charset=utf-8')\n",
          "baseline": "  try { adminHtml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'admin.html'), 'utf8'); } catch { /* headless */ }\n  // (red-team R20) the mod ops console — deny framing (clickjacking defense-in-depth; the dashboard holds\n  // the mod key in sessionStorage and drives confiscate/ban/mint). No CSP (would break its inline scripts).\n  app.get('/admin', servePage(adminHtml, { 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' }));\n  // the CODEX: the in-game wiki — every system + gameplay loop (public/wiki.html); public, read-only\n  let wikiHtml = '<!doctype html><title>OMERTA codex</title><p>Codex file missing (public/wiki.html).</p>';\n  try { wikiHtml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'wiki.html'), 'utf8'); } catch { /* headless */ }\n  app.get('/wiki', servePage(wikiHtml));\n  // THE ARENA: the public, keyless agent showcase (public/arena.html) — \"watch the machines run the\n  // city.\" The agent differentiator AND a shareable/indexable marketing surface, in one. Read-only,\n  // fetches GET /v1/arena for its data; §10.4-free (banded, no exact per-agent liquid).\n  let arenaHtml = '<!doctype html><title>OMERTA arena</title><p>Arena file missing (public/arena.html).</p>';\n  try { arenaHtml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'arena.html'), 'utf8'); } catch { /* headless */ }\n  app.get('/arena', servePage(arenaHtml));\n\n  // The no-code onboarding walkthrough (set up Claude Desktop to play via the MCP connector).\n  let playHtml = '<!doctype html><title>Play OMERTA with Claude</title><p>Walkthrough file missing (public/play.html).</p>';\n  try { playHtml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'play.html'), 'utf8'); } catch { /* headless */ }\n  app.get('/play', servePage(playHtml));\n  // Public token sale; auction figures remain unavailable until the auction is connected.\n  let saleHtml = '<!doctype html><title>$OMR token sale | OMERTÀ</title><p>Token sale page unavailable.</p>';\n  try { saleHtml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sale.html'), 'utf8'); } catch { /* headless */ }\n  app.get('/sale', servePage(saleHtml));\n  for (const [url, kind] of Object.entries({ '/privacy': 'privacy', '/terms': 'terms', '/dmca': 'dmca', '/resources': 'resources' })) {\n    app.get(url, async (req, reply) => {\n      const page = legalPage(kind);\n      return reply.code(page.ready ? 200 : 503).header('Cache-Control', 'no-store').type('text/html; charset=utf-8').send(page.html);\n    });\n  }\n  app.get('/vendor/walletconnect.js', async (req, reply) => reply.type('application/javascript; charset=utf-8')\n"
        },
        {
          "at": 46577,
          "current": "  // THE PATH FINDER — a public, server-rendered acquisition funnel. The content manifest derives its\n  // numbers from rules.js, the POST below owns scoring, and each result gets a stable indexable URL\n  // with its own OG image. Prepared once at boot like the other public pages: no per-hit rendering.\n  app.get('/path', servePage(renderPathQuizPage({ baseUrl }), {}, '/path'));\n  const pathPages = new Map(PATH_IDS.map((id) => [id, servePage(renderPathResultPage(id, { baseUrl }), {}, `/path/${id}`)]));\n  app.get('/path/:id', async (req, reply) => {\n    const page = pathPages.get(String(req.params.id || '').toLowerCase());\n    if (!page) return reply.callNotFound();\n    return page(req, reply);\n  });\n  // Shared interface tokens and public-shell primitives. Keeping this as a tiny, explicit asset route\n",
          "baseline": "  // THE PATH FINDER — a public, server-rendered acquisition funnel. The content manifest derives its\n  // numbers from rules.js, the POST below owns scoring, and each result gets a stable indexable URL\n  // with its own OG image. Prepared once at boot like the other public pages: no per-hit rendering.\n  app.get('/path', servePage(renderPathQuizPage({ baseUrl })));\n  const pathPages = new Map(PATH_IDS.map((id) => [id, servePage(renderPathResultPage(id, { baseUrl }))]));\n  app.get('/path/:id', async (req, reply) => {\n    const page = pathPages.get(String(req.params.id || '').toLowerCase());\n    if (!page) return reply.code(404).type('text/html; charset=utf-8')\n      .send('<!doctype html><title>Path not found | OMERTÀ</title><p>This doctrine is not in the city.</p>');\n    return page(req, reply);\n  });\n  // Shared interface tokens and public-shell primitives. Keeping this as a tiny, explicit asset route\n"
        },
        {
          "at": 47798,
          "current": "    .header('cache-control', 'no-cache').send(uiCss));\n  // City scenes are optional local assets; gameplay remains authoritative through the API.\n  for (const [file, type] of [\n    ['site-analytics.js', 'application/javascript'],\n    ['city-scene.js', 'application/javascript'], ['city-scene.css', 'text/css'], ['city-world-layout.js', 'application/javascript'],\n    ['city-world-ui.js', 'application/javascript'], ['city-world-ui.css', 'text/css'],\n    ['city-home-ui.js', 'application/javascript'], ['city-adventure-ui.js', 'application/javascript'],\n",
          "baseline": "    .header('cache-control', 'no-cache').send(uiCss));\n  // City scenes are optional local assets; gameplay remains authoritative through the API.\n  for (const [file, type] of [\n    ['city-scene.js', 'application/javascript'], ['city-scene.css', 'text/css'], ['city-world-layout.js', 'application/javascript'],\n    ['city-world-ui.js', 'application/javascript'], ['city-world-ui.css', 'text/css'],\n    ['city-home-ui.js', 'application/javascript'], ['city-adventure-ui.js', 'application/javascript'],\n"
        },
        {
          "at": 50460,
          "current": "  // runs fullscreen. Read once at boot (the sw.js/index precedent); a missing file degrades, never crashes.\n  const pub = (f) => join(dirname(fileURLToPath(import.meta.url)), '..', 'public', f);\n  // Explicit public pages and reviewed deployment modules: no user-controlled file path.\n  const defiPage = servePage(readFileSync(pub('defi.html'), 'utf8'), {}, '/defi');\n  app.get('/defi', defiPage);\n  app.get('/defi.html', defiPage);\n  const feeflowsPage = servePage(readFileSync(pub('fee-flows.html'), 'utf8'), {}, '/fee-flows');\n  app.get('/fee-flows', feeflowsPage);\n  app.get('/fee-flows.html', feeflowsPage);\n  const genesisdeployPage = servePage(enhancePage(readFileSync(pub('genesis-deploy.html'), 'utf8'),\n    { baseUrl, path: '/genesis-deploy', indexable: false }), { 'X-Robots-Tag': 'noindex' });\n  app.get('/genesis-deploy', genesisdeployPage);\n  app.get('/genesis-deploy.html', genesisdeployPage);\n  const reviewedModule = name => {\n",
          "baseline": "  // runs fullscreen. Read once at boot (the sw.js/index precedent); a missing file degrades, never crashes.\n  const pub = (f) => join(dirname(fileURLToPath(import.meta.url)), '..', 'public', f);\n  // Explicit public pages and reviewed deployment modules: no user-controlled file path.\n  const defiPage = servePage(readFileSync(pub('defi.html'), 'utf8'));\n  app.get('/defi', defiPage);\n  app.get('/defi.html', defiPage);\n  const feeflowsPage = servePage(readFileSync(pub('fee-flows.html'), 'utf8'));\n  app.get('/fee-flows', feeflowsPage);\n  app.get('/fee-flows.html', feeflowsPage);\n  const genesisdeployPage = servePage(readFileSync(pub('genesis-deploy.html'), 'utf8'));\n  app.get('/genesis-deploy', genesisdeployPage);\n  app.get('/genesis-deploy.html', genesisdeployPage);\n  const reviewedModule = name => {\n"
        },
        {
          "at": 52877,
          "current": "  // the app icons — binary PNGs, served from a filename allowlist Map (the /art precedent; no traversal\n  // surface by construction) with a long cache (they change only on a redeploy).\n  const PWA_ICONS = new Map();\n  for (const f of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'site-share.png']) {\n    try { PWA_ICONS.set(f, readFileSync(pub(f))); } catch { /* headless */ }\n  }\n  for (const [name, buf] of PWA_ICONS) {\n",
          "baseline": "  // the app icons — binary PNGs, served from a filename allowlist Map (the /art precedent; no traversal\n  // surface by construction) with a long cache (they change only on a redeploy).\n  const PWA_ICONS = new Map();\n  for (const f of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png']) {\n    try { PWA_ICONS.set(f, readFileSync(pub(f))); } catch { /* headless */ }\n  }\n  for (const [name, buf] of PWA_ICONS) {\n"
        },
        {
          "at": 72933,
          "current": "  // robots.txt — every crawler (incl. all AI agents: GPTBot, ClaudeBot, Google-Extended, PerplexityBot,\n  // xAI/Grok, open-source fetchers) is explicitly WELCOME and pointed at the machine surfaces. Agents\n  // are first-class players here, so the default-allow is stated rather than implied by a 404.\n  app.get('/robots.txt', async (req, reply) => reply.type('text/plain; charset=utf-8').send(siteRobots(baseUrl)));\n  app.get('/sitemap.xml', async (req, reply) => reply.type('application/xml; charset=utf-8')\n    .header('cache-control', 'public, max-age=3600').send(\n      siteSitemap(baseUrl, { legalReady: { terms: legalPage('terms').ready, dmca: legalPage('dmca').ready } })));\n  // OpenAPI 3.1 of every mounted route — built once, after all routes register (deferred to first hit).\n  let openApiCache = null;\n  app.get('/openapi.json', async () => (openApiCache ||= buildOpenApi(routeRegistry, { baseUrl })));\n",
          "baseline": "  // robots.txt — every crawler (incl. all AI agents: GPTBot, ClaudeBot, Google-Extended, PerplexityBot,\n  // xAI/Grok, open-source fetchers) is explicitly WELCOME and pointed at the machine surfaces. Agents\n  // are first-class players here, so the default-allow is stated rather than implied by a 404.\n  app.get('/robots.txt', async (req, reply) => reply.type('text/plain; charset=utf-8').send(\n    ['# OMERTÀ — all crawlers and AI agents welcome. Agents are first-class players.',\n      '# Machine surfaces: /llms.txt (index) · /agents (agent guide) · /openapi.json (API contract) · /play (no-code setup)',\n      `# Start here: ${baseUrl}/llms.txt`,\n      'User-agent: *', 'Allow: /', `Sitemap: ${baseUrl}/sitemap.xml`].join('\\n') + '\\n'));\n  app.get('/sitemap.xml', async (req, reply) => reply.type('application/xml; charset=utf-8')\n    .header('cache-control', 'public, max-age=3600').send(\n      `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\\n`\n      + ['/', '/wiki', '/arena', '/play', '/agents'].map((path) => `  <url><loc>${baseUrl}${path}</loc></url>`).join('\\n')\n      + '\\n</urlset>\\n'));\n  // OpenAPI 3.1 of every mounted route — built once, after all routes register (deferred to first hit).\n  let openApiCache = null;\n  app.get('/openapi.json', async () => (openApiCache ||= buildOpenApi(routeRegistry, { baseUrl })));\n"
        },
        {
          "at": 88167,
          "current": "    // limiter below while still running withCharacter (FOR UPDATE + a held connection). Treat HEAD as a read.\n    if (rateLimitsEnabled() && a.agent_flag && (req.method === 'GET' || req.method === 'HEAD')) {\n      const limited = await checkRateLimit({ accountId: req.user.sub, agent: true, path: req.routeOptions?.url || req.url,\n        capoRecruits: effectiveCapoRecruits(a.capo_recruits, a.capo_recruits_at),\n        turnObservation: (req.routeOptions?.url || req.url) === '/v1/agent/turn' });\n      if (limited) return reply.code(429).header('retry-after', limited.retryAfter)\n        .send({ error: 'rate_limited', retryAfter: limited.retryAfter });\n    }\n",
          "baseline": "    // limiter below while still running withCharacter (FOR UPDATE + a held connection). Treat HEAD as a read.\n    if (rateLimitsEnabled() && a.agent_flag && (req.method === 'GET' || req.method === 'HEAD')) {\n      const limited = await checkRateLimit({ accountId: req.user.sub, agent: true, path: req.routeOptions?.url || req.url,\n        capoRecruits: effectiveCapoRecruits(a.capo_recruits, a.capo_recruits_at) });\n      if (limited) return reply.code(429).header('retry-after', limited.retryAfter)\n        .send({ error: 'rate_limited', retryAfter: limited.retryAfter });\n    }\n"
        },
        {
          "at": 91871,
          "current": "      && routeRegistry.some((route) => route.method === req.method\n        && route.url === req.routeOptions.url && route.authKind === 'modAuth')) await modAuth(req, reply);\n  });\n  registerSiteAnalytics(app, { pool, modAuth, baseUrl });\n  registerRwa(app, {\n    pool, auth, modAuth, withCharacter: G.withCharacter, reviewerRouteTrust: rwaReviewerRouteTrust,\n  });\n",
          "baseline": "      && routeRegistry.some((route) => route.method === req.method\n        && route.url === req.routeOptions.url && route.authKind === 'modAuth')) await modAuth(req, reply);\n  });\n  registerRwa(app, {\n    pool, auth, modAuth, withCharacter: G.withCharacter, reviewerRouteTrust: rwaReviewerRouteTrust,\n  });\n"
        },
        {
          "at": 113688,
          "current": "    return { token: await signFor(id, {}, '30d', 0) };\n  };\n  app.post('/v1/auth/guest', guestLogin);\n  app.post('/v1/auth/agent', async (req) => {\n    requireAge(app, req, { agent: true });\n    const { accountId, tokenVersion } = await A.accountForAgentBootstrap(\n      pool, req.body?.bootstrapSecret, req.clientIp, req.body?.inviteCode, req.clientIpAuthority,\n    );\n    // Recovery remains usable until the returned bearer has been saved durably.\n    return { token: await signFor(accountId, { agent: true }, '90d', tokenVersion), agent: true };\n  });\n  app.post('/v1/access/redeem', async (req, reply) => {\n    // The browser persists this random recovery credential before submitting. A lost response can\n    // recover the same admission instead of burning another code or minting another identity.\n",
          "baseline": "    return { token: await signFor(id, {}, '30d', 0) };\n  };\n  app.post('/v1/auth/guest', guestLogin);\n  app.post('/v1/access/redeem', async (req, reply) => {\n    // The browser persists this random recovery credential before submitting. A lost response can\n    // recover the same admission instead of burning another code or minting another identity.\n"
        }
      ]
    },
    "src/social/combat.js": {
      "current": {
        "mode": "100644",
        "blob": "e6125045b02fb1d575578da71e505d9f8905b7eb",
        "sha256": "56eb560f1c6e10892fd8ae13082906da7c6b30a4e8550b9793336e7615202cbb",
        "bytes": 87212
      },
      "baseline": {
        "mode": "100644",
        "blob": "775b1b3c39fe9a948b8075e0e67b42ef052f14ff",
        "sha256": "7732eda2646bf2cac1a1bcf2632fd097ad7077cd22d3deba3bbd9eba8abf593c",
        "bytes": 87001
      },
      "inverses": [
        {
          "at": 1921,
          "current": "import { withItemTransaction } from '../items.js';\nimport { prelockEquipmentRentalDeathActors } from '../equipmentrentals.js';\nimport { hospitalized, isWanted, jailed, now, rand, safeHoused, warActive } from './shared.js';\nimport { checkpointCasinoRakeback } from '../casinorakeback.js';\n\n// ═══════════════════ JUMPS (§7.6) ═══════════════════\nexport async function jump(ch, victim, client, h, intent) {\n",
          "baseline": "import { withItemTransaction } from '../items.js';\nimport { prelockEquipmentRentalDeathActors } from '../equipmentrentals.js';\nimport { hospitalized, isWanted, jailed, now, rand, safeHoused, warActive } from './shared.js';\n\n// ═══════════════════ JUMPS (§7.6) ═══════════════════\nexport async function jump(ch, victim, client, h, intent) {\n"
        },
        {
          "at": 20288,
          "current": "  // (red-team) rake_cursor moves to TODAY's den volume, NOT 0 — the buyBusiness rule (\"a new owner earns\n  // against future action, not history\"); a 0 cursor let a killer claim rakeback on the ENTIRE lifetime\n  // den volume, draining the shared profit-capped pool ahead of every honest casino-front owner.\n  const rake = best.kind === 'casino' ? await checkpointCasinoRakeback(client) : null;\n  const denVol = rake?.volume ?? Number((await client.query('SELECT total FROM den_volume WHERE id=1')).rows[0]?.total || 0);\n  await client.query(\n    `UPDATE businesses SET character_id=$2, spec=NULL, spec_at=NULL, scrutiny=0, scrutiny_at=now(),\n       last_collect_at=now(), launder_used=0, launder_at=now(), upkeep_at=now(), shakedown_at=NULL, rake_cursor=$3, rake_index_cursor=$4\n     WHERE id=$1`, [best.id, ch.id, denVol, rake?.index ?? null]);\n  // keep the victim's loaded fronts honest so the estate report doesn't double-count the seized one\n  if (h.victimOwned?.businesses) h.victimOwned.businesses = h.victimOwned.businesses.filter((b) => b.id !== best.id);\n  return { kind: best.kind, tier: best.tier, name: best.name };\n",
          "baseline": "  // (red-team) rake_cursor moves to TODAY's den volume, NOT 0 — the buyBusiness rule (\"a new owner earns\n  // against future action, not history\"); a 0 cursor let a killer claim rakeback on the ENTIRE lifetime\n  // den volume, draining the shared profit-capped pool ahead of every honest casino-front owner.\n  const denVol = Number((await client.query('SELECT total FROM den_volume WHERE id=1')).rows[0]?.total || 0);\n  await client.query(\n    `UPDATE businesses SET character_id=$2, spec=NULL, spec_at=NULL, scrutiny=0, scrutiny_at=now(),\n       last_collect_at=now(), launder_used=0, launder_at=now(), upkeep_at=now(), shakedown_at=NULL, rake_cursor=$3\n     WHERE id=$1`, [best.id, ch.id, denVol]);\n  // keep the victim's loaded fronts honest so the estate report doesn't double-count the seized one\n  if (h.victimOwned?.businesses) h.victimOwned.businesses = h.victimOwned.businesses.filter((b) => b.id !== best.id);\n  return { kind: best.kind, tier: best.tier, name: best.name };\n"
        }
      ]
    },
    "src/social/estate.js": {
      "current": {
        "mode": "100644",
        "blob": "2d5ce2adc9d5039bbeb8ab1b168b5411ccb32c66",
        "sha256": "c2387d76fe958bb1ef0e7571c176b3773a68694089adff649d1a121b869453fb",
        "bytes": 61458
      },
      "baseline": {
        "mode": "100644",
        "blob": "c988e5fed83be712c81aaffeacae97a68648df45",
        "sha256": "5f9634aa6cb6ff046e689bf34c6e6e7e585fa4073af00609bb96c2aaac592d17",
        "bytes": 61144
      },
      "inverses": [
        {
          "at": 1187,
          "current": "// Split out of the 2,003-line src/social.js; every function below is byte-identical to what was\n// there. Import from '../social.js' — it re-exports this package's public surface unchanged.\nimport { GameError, bus, ledger, notify, npcTier, bumpStanding } from '../game.js';\nimport { checkpointCasinoOwnerRemoval } from '../casinorakeback.js';\nimport { rememberedSkills } from '../skills.js';\nimport { M3, LOAN, levelOf, dayOf, VENDETTA, feudTierOf, UNDERWORLD, LAW, MASTERY, estateTierOf, HONOR, seasonModOf, cornerTasksOf, CORNER } from '../rules.js';\nimport { abandonRaidsAtDeath } from '../world.js';\n",
          "baseline": "// Split out of the 2,003-line src/social.js; every function below is byte-identical to what was\n// there. Import from '../social.js' — it re-exports this package's public surface unchanged.\nimport { GameError, bus, ledger, notify, npcTier, bumpStanding } from '../game.js';\nimport { rememberedSkills } from '../skills.js';\nimport { M3, LOAN, levelOf, dayOf, VENDETTA, feudTierOf, UNDERWORLD, LAW, MASTERY, estateTierOf, HONOR, seasonModOf, cornerTasksOf, CORNER } from '../rules.js';\nimport { abandonRaidsAtDeath } from '../world.js';\n"
        },
        {
          "at": 13335,
          "current": "}\n\nexport async function runEstate(client, h, victim, killerName, opts = {}) {\n  // Settle the owner's earning interval before their fronts disappear; surviving owners keep\n  // their historical shares. Character locks are already held, before shared singleton work.\n  await checkpointCasinoOwnerRemoval(client, victim.id);\n  assertItemTransaction(client);\n  await assertEquipmentRentalDeathScope(client, victim.id, h.rentalDeathScope);\n  const originalVictim = (await client.query('SELECT account_id,alive,generation FROM characters WHERE id=$1', [victim.id])).rows[0];\n",
          "baseline": "}\n\nexport async function runEstate(client, h, victim, killerName, opts = {}) {\n  assertItemTransaction(client);\n  await assertEquipmentRentalDeathScope(client, victim.id, h.rentalDeathScope);\n  const originalVictim = (await client.query('SELECT account_id,alive,generation FROM characters WHERE id=$1', [victim.id])).rows[0];\n"
        }
      ]
    },
    "src/worker.js": {
      "current": {
        "mode": "100644",
        "blob": "587ffe14766c524012aff512617aad486c540525",
        "sha256": "0b4d4427841feb6d691e4c4311d1f40f315028139217822a43299551675b9e68",
        "bytes": 87569
      },
      "baseline": {
        "mode": "100644",
        "blob": "6b3784a900bfc8be15537411e4bf633d54739253",
        "sha256": "3c37acd4a4c3b1442278f0915c252097f7b6b93e4d10aebf1cb928bb839aa8c3",
        "bytes": 87369
      },
      "inverses": [
        {
          "at": 32125,
          "current": "    // selective telemetry retention (bulletproof audit) — the sweep + its keep-list live beside the\n    // season rollover as exported functions so test/hardening.js drives them rather than restating the query\n    await safe('telemetry retention', () => sweepTelemetry(pool));\n    await safe('site analytics retention', () => pool.query(\"DELETE FROM telemetry WHERE event='website_count' AND at < $1\",\n      [new Date(Date.now() - 89 * 86400000).toISOString().slice(0, 10)]));\n    await safe('oauth state sweep', () => pool.query('DELETE FROM oauth_states WHERE created_at < $1',\n      [new Date(Date.now() - 30 * 60000)])); // single-use PKCE states die in 30 min regardless\n    // §7.13 tier-2 reconcile: pay the \"family tree\" fee the post-commit hook couldn't (grandrecruiter\n",
          "baseline": "    // selective telemetry retention (bulletproof audit) — the sweep + its keep-list live beside the\n    // season rollover as exported functions so test/hardening.js drives them rather than restating the query\n    await safe('telemetry retention', () => sweepTelemetry(pool));\n    await safe('oauth state sweep', () => pool.query('DELETE FROM oauth_states WHERE created_at < $1',\n      [new Date(Date.now() - 30 * 60000)])); // single-use PKCE states die in 30 min regardless\n    // §7.13 tier-2 reconcile: pay the \"family tree\" fee the post-commit hook couldn't (grandrecruiter\n"
        }
      ]
    },
    "test/age-eligibility-source-compatibility.js": {
      "current": {
        "mode": "100644",
        "blob": "ca27667802463efddcd397aba2f1ca3088e8bcb1",
        "sha256": "c01a42ebabd00aa091387387a00fcaf6f6c84eda8036b47d25fce237c61e9a89",
        "bytes": 11396
      },
      "baseline": {
        "mode": "100644",
        "blob": "dd0aa4dc7f57b53eab7529d3de9490fc98635ede",
        "sha256": "2bca7dfa492c44301280f6814449948b550eeeead355e17f2bc15f205aa7ac6c",
        "bytes": 10851
      },
      "inverses": [
        {
          "at": 3274,
          "current": "  assert.equal(sha(normalized), sha(committed));\n  return physical;\n};\nconst comparisonInput = (file, input) => {\n  const reviewed = questingHistoricalInput(file, input);\n  return file === 'src/server.js'\n    ? businessDeskHistoricalInput(file, contractReleaseDeskInput(file, reviewed)) : reviewed;\n};\nconst inverseHunks = diff => {\n  const inverses = []; let hunk = null;\n  for (const line of diff.split('\\n')) {\n",
          "baseline": "  assert.equal(sha(normalized), sha(committed));\n  return physical;\n};\nconst comparisonInput = (file, input) => file === 'src/server.js'\n  ? businessDeskHistoricalInput(file, contractReleaseDeskInput(file, questingHistoricalInput(file, input))) : input;\nconst inverseHunks = diff => {\n  const inverses = []; let hunk = null;\n  for (const line of diff.split('\\n')) {\n"
        },
        {
          "at": 5287,
          "current": "  actualInputs.set(file, actual);\n  const physical = qualifyPhysical(actual);\n  assert.equal(comparisonInput(file, physical).replaceAll('\\r\\n', '\\n'), current, 'Physical merged age policy remains exact: ' + file);\n  if (file === 'src/legal.js' || file === 'test/legal-security.js') {\n    const unreviewed = physical + '\\n// unreviewed policy change\\n';\n    assert.equal(comparisonInput(file, unreviewed), unreviewed, 'Unreviewed policy bytes cannot inherit a historical source view');\n    refusals++;\n  }\n  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));\n  assert.equal(pin.contextLines, 3); assert.equal(pin.currentSha256, sha(current)); assert.equal(pin.currentBlob, blob(current));\n  assert.equal(pin.currentBytes, Buffer.byteLength(current)); assert.equal(pin.baselineSha256, sha(baseline));\n",
          "baseline": "  actualInputs.set(file, actual);\n  const physical = qualifyPhysical(actual);\n  assert.equal(comparisonInput(file, physical).replaceAll('\\r\\n', '\\n'), current, 'Physical merged age policy remains exact: ' + file);\n  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));\n  assert.equal(pin.contextLines, 3); assert.equal(pin.currentSha256, sha(current)); assert.equal(pin.currentBlob, blob(current));\n  assert.equal(pin.currentBytes, Buffer.byteLength(current)); assert.equal(pin.baselineSha256, sha(baseline));\n"
        },
        {
          "at": 10494,
          "current": "  assert.throws(() => qualifyPhysical({ ...server, ...patch })); actualReaderControls++;\n}\nassert.throws(() => comparisonInput(server.file, Buffer.from([0xc3, 0x28]))); actualReaderControls++;\nfor (const file of ['src/unknown.js']) {\n  const bytes = Buffer.from([0xff]); assert.strictEqual(comparisonInput(file, bytes), bytes); actualReaderControls++;\n}\nassert.throws(() => comparisonInput('src/age.js', Buffer.from([0xff])), error => error.code === 'ERR_ASSERTION'\n  && /Lossless UTF-8/.test(error.message) && /lossless UTF-8/.test(error.message)); actualReaderControls++;\nassert.equal(git('rev-parse', 'HEAD').trim(), actualRevision, 'Actual source revision must stay fixed throughout the proof');\nconsole.log(JSON.stringify({ phase, revision, files: files.length, positives, refusals, inverseHunks: hunks,\n  actualRevision, actualReaderControls, sourceOnly: true, runtime: false, native: false }));\n",
          "baseline": "  assert.throws(() => qualifyPhysical({ ...server, ...patch })); actualReaderControls++;\n}\nassert.throws(() => comparisonInput(server.file, Buffer.from([0xc3, 0x28]))); actualReaderControls++;\nfor (const file of ['src/unknown.js', 'src/age.js']) {\n  const bytes = Buffer.from([0xff]); assert.strictEqual(comparisonInput(file, bytes), bytes); actualReaderControls++;\n}\nassert.equal(git('rev-parse', 'HEAD').trim(), actualRevision, 'Actual source revision must stay fixed throughout the proof');\nconsole.log(JSON.stringify({ phase, revision, files: files.length, positives, refusals, inverseHunks: hunks,\n  actualRevision, actualReaderControls, sourceOnly: true, runtime: false, native: false }));\n"
        }
      ]
    },
    "test/agent-alpha.js": {
      "current": {
        "mode": "100644",
        "blob": "84d219e4e07990795e1ae51870e9d0e2c513828e",
        "sha256": "51b30a960a4edec2b7ecc01c3971bc5ca1c23b2c2379b751612d59e5f1728a45",
        "bytes": 111273
      },
      "baseline": {
        "mode": "100644",
        "blob": "3b091b32b682ccaf680f8074fb95d67551ef951b",
        "sha256": "4e54d9feaa1fb48cf5e6a5b2674bcdc851f4f144c2cad3e3de3c678d6c0a9186",
        "bytes": 105289
      },
      "inverses": [
        {
          "at": 10648,
          "current": "      });\n      const heldFetch = async (...args) => {\n        const response = await fetch(...args);\n        if (new URL(args[0]).pathname === '/v1/auth/agent') {\n          process.send?.({ type: 'guest_committed' });\n          // Hold forever, and hold it HONESTLY. A bare never-settling promise is not a hang: the\n          // moment this child's event loop drains, Node detects the unsettled top-level await and\n",
          "baseline": "      });\n      const heldFetch = async (...args) => {\n        const response = await fetch(...args);\n        if (new URL(args[0]).pathname === '/v1/auth/guest') {\n          process.send?.({ type: 'guest_committed' });\n          // Hold forever, and hold it HONESTLY. A bare never-settling promise is not a hang: the\n          // moment this child's event loop drains, Node detects the unsettled top-level await and\n"
        },
        {
          "at": 13132,
          "current": "    try { bootstrapState = JSON.parse(await readFile(sessionFile, 'utf8')); } catch { /* asserted below */ }\n    assert.equal(bootstrapState?.phase, 'bootstrap',\n      'the recovery identity is durable before the first guest request can return');\n    assert.equal(bootstrapState?.bootstrapKind, 'agent',\n      'new durable recovery state pins the agent bootstrap hash domain');\n    assert.equal(typeof bootstrapState?.bootstrapSecret === 'string' &&\n      bootstrapState.bootstrapSecret.length === 43, true,\n    'the durable bootstrap identity is a high-entropy 256-bit base64url credential');\n",
          "baseline": "    try { bootstrapState = JSON.parse(await readFile(sessionFile, 'utf8')); } catch { /* asserted below */ }\n    assert.equal(bootstrapState?.phase, 'bootstrap',\n      'the recovery identity is durable before the first guest request can return');\n    assert.equal(typeof bootstrapState?.bootstrapSecret === 'string' &&\n      bootstrapState.bootstrapSecret.length === 43, true,\n    'the durable bootstrap identity is a high-entropy 256-bit base64url credential');\n"
        },
        {
          "at": 26507,
          "current": "  })), 'every credential-write boundary rejects a parent swap without exposing the new bearer');\n}\n\nasync function localApi({ legacyBootstrap = false } = {}) {\n  const app = Fastify({ logger: false });\n  const requests = [];\n  const state = {\n",
          "baseline": "  })), 'every credential-write boundary rejects a parent swap without exposing the new bearer');\n}\n\nasync function localApi() {\n  const app = Fastify({ logger: false });\n  const requests = [];\n  const state = {\n"
        },
        {
          "at": 27090,
          "current": "      idempotencyKey: req.headers['idempotency-key'],\n    });\n  });\n  app.post(legacyBootstrap ? '/v1/auth/guest' : '/v1/auth/agent', async (req) => {\n    if (!legacyBootstrap) assert.equal('birthDate' in req.body, false,\n      'agent bootstrap does not invent a human birth date');\n    state.guestCalls += 1;\n    return { token: 'guest-token-secret' };\n  });\n",
          "baseline": "      idempotencyKey: req.headers['idempotency-key'],\n    });\n  });\n  app.post('/v1/auth/guest', async () => {\n    state.guestCalls += 1;\n    return { token: 'guest-token-secret' };\n  });\n"
        },
        {
          "at": 33214,
          "current": "async function probeApi({ sessionStatus = 200 } = {}) {\n  const app = Fastify({ logger: false });\n  const state = { guestCalls: 0, sessionCalls: 0, turnCalls: 0, actCalls: 0 };\n  app.post('/v1/auth/agent', async () => {\n    state.guestCalls += 1;\n    return { token: 'replacement-token' };\n  });\n",
          "baseline": "async function probeApi({ sessionStatus = 200 } = {}) {\n  const app = Fastify({ logger: false });\n  const state = { guestCalls: 0, sessionCalls: 0, turnCalls: 0, actCalls: 0 };\n  app.post('/v1/auth/guest', async () => {\n    state.guestCalls += 1;\n    return { token: 'replacement-token' };\n  });\n"
        },
        {
          "at": 55608,
          "current": "  }));\n  app.get('/v1/agent/turn', async () => {\n    state.turnCalls += 1;\n    return turn(state.actCalls);\n  });\n  app.post('/v1/agent/act', async (req, reply) => {\n    state.actCalls += 1;\n",
          "baseline": "  }));\n  app.get('/v1/agent/turn', async () => {\n    state.turnCalls += 1;\n    return turn(0);\n  });\n  app.post('/v1/agent/act', async (req, reply) => {\n    state.actCalls += 1;\n"
        },
        {
          "at": 60755,
          "current": "    });\n    assert.equal(summary.actions, 1,\n      'a stale non-mutation does not consume the finite successful-action budget');\n    assert.equal(api.state.turnCalls, 2,\n      'the runner refreshes stale authority after cadence and report persistence');\n    assert.equal(api.state.actCalls, 2,\n      'the replacement recommendation executes once after the stale refusal');\n    assert.notEqual(api.state.actKeys[0], api.state.actKeys[1],\n",
          "baseline": "    });\n    assert.equal(summary.actions, 1,\n      'a stale non-mutation does not consume the finite successful-action budget');\n    assert.equal(api.state.turnCalls, 1,\n      'the runner consumes the server-provided stale replacement without an extra turn read');\n    assert.equal(api.state.actCalls, 2,\n      'the replacement recommendation executes once after the stale refusal');\n    assert.notEqual(api.state.actKeys[0], api.state.actKeys[1],\n"
        },
        {
          "at": 70455,
          "current": "async function initialNameApi() {\n  const app = Fastify({ logger: false });\n  const state = { guestCalls: 0, characterCalls: 0, names: [], hasCharacter: false };\n  app.post('/v1/auth/agent', async () => {\n    state.guestCalls += 1;\n    return { token: 'guest-token-secret' };\n  });\n",
          "baseline": "async function initialNameApi() {\n  const app = Fastify({ logger: false });\n  const state = { guestCalls: 0, characterCalls: 0, names: [], hasCharacter: false };\n  app.post('/v1/auth/guest', async () => {\n    state.guestCalls += 1;\n    return { token: 'guest-token-secret' };\n  });\n"
        },
        {
          "at": 103910,
          "current": "  }\n}\n\nasync function freshAuthorityAfterCadenceTest() {\n  const api = await actionApi({ kinds: ['crime', 'daily_claim'] });\n  await withReadySession(api, 'omerta-agent-alpha-fresh-authority-', async ({ sessionFile, reportFile }) => {\n    let issuedAt;\n    const ages = [];\n    const checkingFetch = async (url, options) => {\n      if (new URL(url).pathname === '/v1/agent/act') {\n        const body = JSON.parse(options.body);\n        const durable = JSON.parse(await readFile(sessionFile, 'utf8'));\n        assert.equal(durable.pending.turnId, body.turnId,\n          'the exact fresh turn is durable before sending its mutation');\n        assert.equal(durable.pending.actionId, body.actionId,\n          'freshness never bypasses the durable replay journal');\n        ages.push(performance.now() - issuedAt);\n        assert.ok(ages.at(-1) < 2500,\n          `cadence and journal overhead expired the turn after ${ages.at(-1)}ms`);\n      }\n      const response = await fetch(url, options);\n      if (new URL(url).pathname === '/v1/agent/turn') issuedAt = performance.now();\n      return response;\n    };\n    const summary = await runAgentAlphaProduction({\n      baseUrl: api.baseUrl, sessionFile, reportFile, maxActions: 2, fetchImpl: checkingFetch,\n    });\n    assert.deepEqual(summary, { status: 'complete', actions: 2 },\n      'ordinary production timing executes two short-lived turns without spending their lease on cadence');\n    assert.equal(ages.length, 2);\n  });\n}\n\nasync function legacyBootstrapDomainTest() {\n  const api = await localApi({ legacyBootstrap: true });\n  const dir = await privateTempDir('omerta-agent-alpha-legacy-bootstrap-');\n  const sessionFile = join(dir, 'session.json');\n  const reportFile = join(dir, 'report.jsonl');\n  try {\n    await writePrivateSession(sessionFile, JSON.stringify({\n      version: 1, base: api.baseUrl, phase: 'bootstrap',\n      bootstrapSecret: crypto.randomBytes(32).toString('base64url'),\n      inviteCode: null, characterName: 'Alpha Machine', pending: null,\n    }));\n    const result = await runAgentAlpha({\n      baseUrl: api.baseUrl, sessionFile, reportFile, birthDate: '1990-01-01', maxActions: 1,\n    });\n    assert.equal(result.actions, 1);\n    assert.equal(api.requests.filter((r) => r.path === '/v1/auth/guest').length, 1,\n      'a saved bootstrap without the new discriminator recovers its original human identity');\n    assert.equal(api.requests.some((r) => r.path === '/v1/auth/agent'), false,\n      'legacy recovery never switches hash domains to create a duplicate agent');\n  } finally {\n    await api.close();\n    await rm(dir, { recursive: true, force: true });\n  }\n}\n\nasync function initialCharacterRateBackoffTest() {\n  const api = await phaseRecoveryApi({ initialPhase: 'initial_character_pending' });\n  await withReadySession(api, 'omerta-agent-alpha-character-backoff-', async ({ sessionFile, reportFile }) => {\n    await writePrivateSession(sessionFile, JSON.stringify(sessionFor(api.baseUrl, {\n      phase: 'initial_character_pending',\n    })));\n    const characterRequests = [];\n    const rateLimitedFetch = async (url, options) => {\n      if (new URL(url).pathname === '/v1/character') {\n        characterRequests.push({ body: options.body, key: options.headers['idempotency-key'] });\n        if (characterRequests.length === 1) return new Response(JSON.stringify({\n          error: 'rate_limited', retryAfter: 3,\n        }), { status: 429 });\n      }\n      return fetch(url, options);\n    };\n    const summary = await runAgentAlpha({\n      baseUrl: api.baseUrl, sessionFile, reportFile, maxActions: 1, fetchImpl: rateLimitedFetch,\n    });\n    assert.equal(summary.status, 'complete');\n    assert.equal(api.state.characterCalls, 1,\n      'a definitive signup rate refusal is retried without creating another character');\n    assert.equal(characterRequests.length, 2);\n    assert.deepEqual(characterRequests[0], characterRequests[1],\n      'rate backoff preserves the exact character request and idempotency key');\n  });\n}\n\nasync function progressionRoleAndLevelStopTest() {\n  const api = await actionApi({ kinds: ['crime', 'crime'], turnForIndex: (index) => ({\n    turnId: `progress-${index}`, recommendedActionId: 'arbitrage-profit', policy: POLICY,\n    state: { identity: { level: index === 0 ? 99 : 100 } },\n    actions: [\n      { id: 'arbitrage-profit', kind: 'arbitrage_buy', executable: true },\n      { id: `crime-${index}`, kind: 'crime', executable: true },\n    ],\n  }) });\n  await withReadySession(api, 'omerta-agent-alpha-progression-', async ({ sessionFile, reportFile }) => {\n    const summary = await runAgentAlpha({\n      baseUrl: api.baseUrl, sessionFile, reportFile, role: 'progression', stopAtLevel: 100, maxActions: 5,\n    });\n    assert.deepEqual(summary, { status: 'level_reached', actions: 1, level: 100 });\n    assert.equal(api.state.actCalls, 1, 'level 100 is observed before journaling another action');\n    assert.equal(api.state.actBodies[0].actionId, 'crime-0',\n      'progression selects an issued crime instead of a higher cash arbitrage recommendation');\n    assert.equal(JSON.parse(await readFile(sessionFile, 'utf8')).pending, null);\n    const again = await runAgentAlpha({\n      baseUrl: api.baseUrl, sessionFile, reportFile, role: 'progression', stopAtLevel: 100, maxActions: 1,\n    });\n    assert.equal(again.status, 'level_reached', 'resuming a completed goal stays stopped');\n    assert.equal(api.state.actCalls, 1, 'completion never creates another mutation on resume');\n  });\n}\n\nif (process.argv.includes('--decision-recovery')) {\n  await decisionAnnotationTest();\n  await hardCrashReplayTest({ decisionCall: true });\n",
          "baseline": "  }\n}\n\nif (process.argv.includes('--decision-recovery')) {\n  await decisionAnnotationTest();\n  await hardCrashReplayTest({ decisionCall: true });\n"
        },
        {
          "at": 110962,
          "current": "await danglingSessionAliasCreateTest();\nawait unrelatedLegacyPortTest();\nawait realElapsedCadenceTest();\nawait freshAuthorityAfterCadenceTest();\nawait legacyBootstrapDomainTest();\nawait initialCharacterRateBackoffTest();\nawait progressionRoleAndLevelStopTest();\n}\nconsole.log('agent-alpha tests passed');\n",
          "baseline": "await danglingSessionAliasCreateTest();\nawait unrelatedLegacyPortTest();\nawait realElapsedCadenceTest();\n}\nconsole.log('agent-alpha tests passed');\n"
        }
      ]
    },
    "test/city-home-migration.js": {
      "current": {
        "mode": "100644",
        "blob": "9be8bbb9923a8ed2c3f982f629db979ab4e73a6d",
        "sha256": "42a32f9beca670ccf2e7668837a2ceccca9a95ef857c2428e15f4bfa96c8a89f",
        "bytes": 8665
      },
      "baseline": {
        "mode": "100644",
        "blob": "1f43caf320cd16dbdbfeb6e34f18e07c2521957a",
        "sha256": "b38c8ef750d136a9cface1f1512bf1a2c7722106f3753386c4cd669df29f63b1",
        "bytes": 8665
      },
      "inverses": [
        {
          "at": 7927,
          "current": "  assert.deepEqual((await client.query('SELECT * FROM schema_meta WHERE id=1')).rows[0], priorStamp);\n  await client.query('ALTER TABLE item_instances VALIDATE CONSTRAINT item_instance_storage_legacy');\n  await migrateSchemaUnderLock(client, { schemaText });\n  assert.equal((await client.query('SELECT app_version FROM schema_meta WHERE id=1')).rows[0].app_version, '1.6.0');\n  console.log('Home custody native migration: existing rows, closed custody gates, restart, late DDL rollback/retry and drift/unvalidated refusal passed');\n} finally {\n  await client.query('SELECT pg_advisory_unlock(918273645)').catch(() => {});\n",
          "baseline": "  assert.deepEqual((await client.query('SELECT * FROM schema_meta WHERE id=1')).rows[0], priorStamp);\n  await client.query('ALTER TABLE item_instances VALIDATE CONSTRAINT item_instance_storage_legacy');\n  await migrateSchemaUnderLock(client, { schemaText });\n  assert.equal((await client.query('SELECT app_version FROM schema_meta WHERE id=1')).rows[0].app_version, '1.5.1');\n  console.log('Home custody native migration: existing rows, closed custody gates, restart, late DDL rollback/retry and drift/unvalidated refusal passed');\n} finally {\n  await client.query('SELECT pg_advisory_unlock(918273645)').catch(() => {});\n"
        }
      ]
    },
    "test/client-ip.js": {
      "current": {
        "mode": "100644",
        "blob": "b4d333bac5e80e1bfa20780d5a9fc3b01c25b1cf",
        "sha256": "e61b4fd9d9163eaf0059baf4a847f355c3dd032d7b2b88abb39d52e9307fe3b0",
        "bytes": 7561
      },
      "baseline": {
        "mode": "100644",
        "blob": "bbb9dcdd73dbf5ae2511787ffcab2711255f9e29",
        "sha256": "f9364d261dec8a794c87966b56b3e1c5bcf4cb9496e28e517d44eb6d8051c73c",
        "bytes": 6711
      },
      "inverses": [
        {
          "at": 5185,
          "current": "    created_ip_authority: CLIENT_IP_AUTHORITY.render,\n  }, 'bootstrap recovery updates last_ip without rewriting immutable signup provenance');\n\n  const agentSecret = crypto.randomBytes(32).toString('base64url');\n  const agentAdmission = async (ip) => trusted.inject({ method: 'POST', url: '/v1/auth/agent',\n    remoteAddress: '10.20.30.40', headers: { 'cf-connecting-ip': ip }, payload: { bootstrapSecret: agentSecret } });\n  const agent = await agentAdmission('203.0.113.82');\n  assert.equal(agent.statusCode, 200, agent.body);\n  const agentId = trusted.jwt.decode(agent.json().token).sub;\n  assert.equal((await agentAdmission('203.0.113.83')).statusCode, 200);\n  assert.deepEqual((await trusted.pool.query(\n    'SELECT created_ip, last_ip, created_ip_authority FROM accounts WHERE id=$1', [agentId],\n  )).rows[0], { created_ip: '203.0.113.82', last_ip: '203.0.113.83',\n    created_ip_authority: CLIENT_IP_AUTHORITY.render }, 'agent admission preserves trusted immutable signup provenance');\n\n  const { accountForIdentity } = await import('../src/auth.js');\n  const identity = { provider: 'client-ip-test', subject: crypto.randomUUID() };\n  const provider = await accountForIdentity(\n",
          "baseline": "    created_ip_authority: CLIENT_IP_AUTHORITY.render,\n  }, 'bootstrap recovery updates last_ip without rewriting immutable signup provenance');\n\n  const { accountForIdentity } = await import('../src/auth.js');\n  const identity = { provider: 'client-ip-test', subject: crypto.randomUUID() };\n  const provider = await accountForIdentity(\n"
        }
      ]
    },
    "test/client.js": {
      "current": {
        "mode": "100644",
        "blob": "9f3ae820674780b8f3e231872043e79386eaa6f8",
        "sha256": "f5b6831bc8d5aafb31ea9ee62c9744002c5da03a766f77fad77bf7771eb7003d",
        "bytes": 764000
      },
      "baseline": {
        "mode": "100644",
        "blob": "d76d33df1af070de1b94a21ba8c7a5a64e989fd6",
        "sha256": "96c1031bab954cf43cb3caf8834d2f3dae53f6ccc44cab590619ea1eb4c89cf1",
        "bytes": 763513
      },
      "inverses": [
        {
          "at": 9730,
          "current": "      const describe = () => 'Completed', cineFor = () => null, revealFor = noop, sfx = noop, bragText = () => null;\n      const busy = { setAttribute: noop, removeAttribute: noop, classList: { add: noop, remove: noop } };\n      const document = { body: { style: {} } }, $ = () => node;\n      const analyticsResults = [], window = { OmertaSiteAnalytics: { firstJobResult: (...args) => analyticsResults.push(args) } };\n      const api = async () => ({ code: 200, body: {}, replayed: false });\n      const refresh = async () => {\n        if (${refreshCode} === 200 && !${ignored} && ${JSON.stringify(path)}.includes('/travel/')) {\n",
          "baseline": "      const describe = () => 'Completed', cineFor = () => null, revealFor = noop, sfx = noop, bragText = () => null;\n      const busy = { setAttribute: noop, removeAttribute: noop, classList: { add: noop, remove: noop } };\n      const document = { body: { style: {} } }, $ = () => node;\n      const api = async () => ({ code: 200, body: {}, replayed: false });\n      const refresh = async () => {\n        if (${refreshCode} === 200 && !${ignored} && ${JSON.stringify(path)}.includes('/travel/')) {\n"
        },
        {
          "at": 10524,
          "current": "      const recordOperation = value => (operationReceipt = value);\n      ${html.slice(actStart, actEnd)}\n      const result = await act('POST', ${JSON.stringify(path)}, {});\n      return { code: result.code, receiptRecorded: !!operationReceipt, current: operationReceipt.resourceCurrent(),\n        analyticsMethod: analyticsResults[0]?.[0], analyticsPath: analyticsResults[0]?.[1], analyticsCalls: analyticsResults.length };\n    })()`);\n    assert.equal(observed.code, 200, 'A failed refresh must not relabel the confirmed action result.');\n    assert.equal(observed.receiptRecorded, true, 'The ordinary operation receipt remains available for recovery.');\n    assert.equal(observed.current, expectedCurrent, 'Resource feedback stays bound to the action district.');\n    assert.equal(observed.analyticsCalls, 1, 'The ordinary action forwards one result to the optional analytics bridge.');\n    assert.equal(observed.analyticsMethod, 'POST');\n    assert.equal(observed.analyticsPath, path);\n  }\n}\n\n",
          "baseline": "      const recordOperation = value => (operationReceipt = value);\n      ${html.slice(actStart, actEnd)}\n      const result = await act('POST', ${JSON.stringify(path)}, {});\n      return { code: result.code, receiptRecorded: !!operationReceipt, current: operationReceipt.resourceCurrent() };\n    })()`);\n    assert.equal(observed.code, 200, 'A failed refresh must not relabel the confirmed action result.');\n    assert.equal(observed.receiptRecorded, true, 'The ordinary operation receipt remains available for recovery.');\n    assert.equal(observed.current, expectedCurrent, 'Resource feedback stays bound to the action district.');\n  }\n}\n\n"
        }
      ]
    },
    "test/continuous-city-source-compatibility.js": {
      "current": {
        "mode": "100644",
        "blob": "3e74303b91b0ba554f3a57303d3362e4e1b735a7",
        "sha256": "4f1bc1d16fde16c4719cac73fd59189725b9b3de4541701e6936d44d7697698c",
        "bytes": 80531
      },
      "baseline": {
        "mode": "100644",
        "blob": "69e00c520aaaae2829a5534106a74cdcd07452e8",
        "sha256": "7e4d785990d1ab9d98eb13c1aaae8f5e488477215bedefb7fe372afb00296ecf",
        "bytes": 80435
      },
      "inverses": [
        {
          "at": 64880,
          "current": "  const actual = lf(classicInterfaceHistoricalInput(file, integratedHistoricalInput(file, questingHistoricalInput(file, fs.readFileSync(file, 'utf8'))))), baseline = git('show', CONTINUOUS_CITY_FIXTURE_PREDECESSOR + ':' + file);\n  assert.equal(git('ls-files', '--stage', '--', file).split(' ')[0], pin.currentMode);\n  assert.equal(git('ls-tree', CONTINUOUS_CITY_FIXTURE_PREDECESSOR, '--', file).split(' ')[0], pin.baselineMode);\n  // verify binds the complete normalized fixture to these frozen blobs before comparing their real Git diff.\n  verify(file, pin, actual, baseline, qualifyContinuousCityFixtureSource,\n    file === 'test/lib/rc1-historical-source-fixture.js'\n      ? git('diff', '--no-ext-diff', '--unified=3', CONTINUOUS_CITY_FIXTURE_PREDECESSOR, CLASSIC_INTERFACE_OVER_F92.revision, '--', file)\n",
          "baseline": "  const actual = lf(classicInterfaceHistoricalInput(file, integratedHistoricalInput(file, questingHistoricalInput(file, fs.readFileSync(file, 'utf8'))))), baseline = git('show', CONTINUOUS_CITY_FIXTURE_PREDECESSOR + ':' + file);\n  assert.equal(git('ls-files', '--stage', '--', file).split(' ')[0], pin.currentMode);\n  assert.equal(git('ls-tree', CONTINUOUS_CITY_FIXTURE_PREDECESSOR, '--', file).split(' ')[0], pin.baselineMode);\n  verify(file, pin, actual, baseline, qualifyContinuousCityFixtureSource,\n    file === 'test/lib/rc1-historical-source-fixture.js'\n      ? git('diff', '--no-ext-diff', '--unified=3', CONTINUOUS_CITY_FIXTURE_PREDECESSOR, CLASSIC_INTERFACE_OVER_F92.revision, '--', file)\n"
        },
        {
          "at": 65755,
          "current": "        ? git('diff', '--no-ext-diff', '--unified=3', CONTINUOUS_CITY_FIXTURE_PREDECESSOR, CLASSIC_INTERFACE_OVER_F92.targetRevision, '--', file)\n        : Object.hasOwn(ECONOMY_HARDENING_BINDING_DOMAINS, file)\n          ? git('diff', '--no-ext-diff', '--unified=3', CONTINUOUS_CITY_FIXTURE_PREDECESSOR, ECONOMY_HARDENING_SOURCE_REVISION, '--', file)\n          : git('diff', '--no-ext-diff', '--unified=3', pin.baselineBlob, pin.currentBlob));\n  if (hasEnterpriseOverRootSource(file)) { assert.throws(() => enterpriseOverRootSourceBaseline(file, actual)); refusals++; }\n}\nfor (const file of ['__proto__', 'constructor', 'toString', '../package.json', 'src/unknown.js', 'schema.sql.extra']) {\n",
          "baseline": "        ? git('diff', '--no-ext-diff', '--unified=3', CONTINUOUS_CITY_FIXTURE_PREDECESSOR, CLASSIC_INTERFACE_OVER_F92.targetRevision, '--', file)\n        : Object.hasOwn(ECONOMY_HARDENING_BINDING_DOMAINS, file)\n          ? git('diff', '--no-ext-diff', '--unified=3', CONTINUOUS_CITY_FIXTURE_PREDECESSOR, ECONOMY_HARDENING_SOURCE_REVISION, '--', file)\n          : git('diff', '--no-ext-diff', '--unified=3', CONTINUOUS_CITY_FIXTURE_PREDECESSOR, '--', file));\n  if (hasEnterpriseOverRootSource(file)) { assert.throws(() => enterpriseOverRootSourceBaseline(file, actual)); refusals++; }\n}\nfor (const file of ['__proto__', 'constructor', 'toString', '../package.json', 'src/unknown.js', 'schema.sql.extra']) {\n"
        }
      ]
    },
    "test/db-boot-lock-postgres.js": {
      "current": {
        "mode": "100644",
        "blob": "fa7407002296d410be838b3d9d2d2bf3408b0b91",
        "sha256": "ef923e2dcd27a8f9ed5d6edfab6ce83b62479d3134357c6b15620eec6bf19352",
        "bytes": 3995
      },
      "baseline": {
        "mode": "100644",
        "blob": "a371a9a38ac1de3f30f528f8df2f007a6f99f2a2",
        "sha256": "a18e55a9bb90ad675a4e46df1bd733612fd0bcc14a1577abfd95b94948270642",
        "bytes": 3995
      },
      "inverses": [
        {
          "at": 2902,
          "current": "  const stamp = (await pools[0].query(\n    'SELECT app_version,schema_sha FROM schema_meta WHERE id=1'\n  )).rows[0];\n  assert.equal(stamp.app_version, '1.6.0');\n  assert.equal(stamp.schema_sha,\n    crypto.createHash('sha256').update(fs.readFileSync(new URL('../schema.sql', import.meta.url))).digest('hex').slice(0, 16));\n  assert.equal(Number((await pools[0].query(\n    \"SELECT count(*) n FROM pg_trigger WHERE tgname='social_claims_legacy_receipt_guard' AND NOT tgisinternal\"\n  )).rows[0].n), 1, 'serialized boot leaves exactly one live receipt guard');\n\n  console.log('Native DB boot lock PASS: two booters outwait request lock_timeout and serialize complete 1.6.0 schema setup');\n} finally {\n  restore('DATABASE_URL', original.databaseUrl);\n  restore('PG_STATEMENT_TIMEOUT_MS', original.statementTimeout);\n",
          "baseline": "  const stamp = (await pools[0].query(\n    'SELECT app_version,schema_sha FROM schema_meta WHERE id=1'\n  )).rows[0];\n  assert.equal(stamp.app_version, '1.5.1');\n  assert.equal(stamp.schema_sha,\n    crypto.createHash('sha256').update(fs.readFileSync(new URL('../schema.sql', import.meta.url))).digest('hex').slice(0, 16));\n  assert.equal(Number((await pools[0].query(\n    \"SELECT count(*) n FROM pg_trigger WHERE tgname='social_claims_legacy_receipt_guard' AND NOT tgisinternal\"\n  )).rows[0].n), 1, 'serialized boot leaves exactly one live receipt guard');\n\n  console.log('Native DB boot lock PASS: two booters outwait request lock_timeout and serialize complete 1.5.1 schema setup');\n} finally {\n  restore('DATABASE_URL', original.databaseUrl);\n  restore('PG_STATEMENT_TIMEOUT_MS', original.statementTimeout);\n"
        }
      ]
    },
    "test/enterprise-native-questing-guard.js": {
      "current": {
        "mode": "100644",
        "blob": "5fab8348fbb6561a1ae28d46612c41b3baadb9dc",
        "sha256": "58c4afe38f13fb6b48d34f040620e922f05111ef793f42e81618e9ccf57e2f70",
        "bytes": 10535
      },
      "baseline": {
        "mode": "100644",
        "blob": "e0837ab99986fc8a225e064aa47db71a42875c69",
        "sha256": "2dde66b1d75614383814730cece231fddb5848a36ec4256a621320572b552482",
        "bytes": 8894
      },
      "inverses": [
        {
          "at": 4699,
          "current": "  value => { value.files.find(row => row.file === 'tools/enterprise-native.js').sha256 = '0'.repeat(64); },\n  value => { value.files.find(row => row.file === QUESTING_NATIVE_PREDECESSOR_METADATA).sha256 = '0'.repeat(64); },\n  value => { value.additions = []; }, value => { value.files.push({ file: QUESTING_NATIVE_METADATA, mode: '100644', blob: 'a'.repeat(40), sha256: 'b'.repeat(64) }); },\n  value => {\n    value.files = value.files.filter(row => row.file !== 'src/casinorakeback.js');\n    value.additions = value.additions.filter(row => row.file !== 'src/casinorakeback.js');\n  },\n]) {\n  const mutated = structuredClone(candidate); change(mutated);\n  assert.throws(() => assertQuestingNativeDefinition(freeze(mutated))); rejections++;\n",
          "baseline": "  value => { value.files.find(row => row.file === 'tools/enterprise-native.js').sha256 = '0'.repeat(64); },\n  value => { value.files.find(row => row.file === QUESTING_NATIVE_PREDECESSOR_METADATA).sha256 = '0'.repeat(64); },\n  value => { value.additions = []; }, value => { value.files.push({ file: QUESTING_NATIVE_METADATA, mode: '100644', blob: 'a'.repeat(40), sha256: 'b'.repeat(64) }); },\n]) {\n  const mutated = structuredClone(candidate); change(mutated);\n  assert.throws(() => assertQuestingNativeDefinition(freeze(mutated))); rejections++;\n"
        },
        {
          "at": 6724,
          "current": "  const row = actual.replacements[0]?.after;\n  assert.ok(row, 'The authored release must contain a real changed input for argument tests.');\n  const git = (...args) => execFileSync('git', ['--no-optional-locks', '--no-replace-objects', ...args], { maxBuffer: 64 * 1024 * 1024, windowsHide: true });\n  const record = (revision, file = row.file) => {\n    const line = git('ls-tree', '-z', revision, '--', file).toString('utf8');\n    const match = line.match(/^(100644|100755) blob ([a-f0-9]{40})\\t([^\\0]+)\\0$/);\n    assert.ok(match && match[3] === file); return { type: 'blob', mode: match[1], blob: match[2] };\n  };\n  const current = record('HEAD'), authored = record(actual.authoredRevision), bytes = git('show', `HEAD:${row.file}`);\n  const physical = fs.readFileSync(row.file); assert.ok(fs.lstatSync(row.file).isFile() && !fs.lstatSync(row.file).isSymbolicLink());\n",
          "baseline": "  const row = actual.replacements[0]?.after;\n  assert.ok(row, 'The authored release must contain a real changed input for argument tests.');\n  const git = (...args) => execFileSync('git', ['--no-optional-locks', '--no-replace-objects', ...args], { maxBuffer: 64 * 1024 * 1024, windowsHide: true });\n  const record = revision => {\n    const line = git('ls-tree', '-z', revision, '--', row.file).toString('utf8');\n    const match = line.match(/^(100644|100755) blob ([a-f0-9]{40})\\t([^\\0]+)\\0$/);\n    assert.ok(match && match[3] === row.file); return { type: 'blob', mode: match[1], blob: match[2] };\n  };\n  const current = record('HEAD'), authored = record(actual.authoredRevision), bytes = git('show', `HEAD:${row.file}`);\n  const physical = fs.readFileSync(row.file); assert.ok(fs.lstatSync(row.file).isFile() && !fs.lstatSync(row.file).isSymbolicLink());\n"
        },
        {
          "at": 8353,
          "current": "  ]) { assert.throws(() => assertQuestingEnterpriseTrackedInput(row.file, now, anchor, raw)); actualArgumentRefusals++; }\n  assert.throws(() => assertQuestingEnterpriseTrackedInput(row.file, current, authored, bytes, Object.freeze({ ...actual })));\n  assert.throws(() => assertQuestingEnterpriseTrackedInput('../outside.js', current, authored, bytes)); actualArgumentRefusals += 2;\n  const companion = actual.files.find(input => input.file === 'src/casinorakeback.js');\n  assert.ok(companion, 'The reviewed casino companion has its own exact current native pin.');\n  const companionCurrent = record('HEAD', companion.file), companionAuthored = record(actual.authoredRevision, companion.file);\n  const companionBytes = git('show', `HEAD:${companion.file}`), companionPhysical = fs.readFileSync(companion.file);\n  assert.ok(fs.lstatSync(companion.file).isFile() && !fs.lstatSync(companion.file).isSymbolicLink());\n  assertEnterpriseNativeTrackedBytes(companionPhysical, companionBytes, false);\n  assert.strictEqual(assertQuestingEnterpriseTrackedInput(companion.file, companionCurrent, companionAuthored, companionBytes).current,\n    companion, 'The full committed companion bytes and both Git identities qualify before execution.');\n  for (const [now, anchor, raw] of [\n    [{ ...companionCurrent, mode: companionCurrent.mode === '100644' ? '100755' : '100644' }, companionAuthored, companionBytes],\n    [{ ...companionCurrent, blob: '0'.repeat(40) }, companionAuthored, companionBytes],\n    [companionCurrent, { ...companionAuthored, blob: '1'.repeat(40) }, companionBytes],\n    [companionCurrent, companionAuthored, Buffer.concat([companionBytes, Buffer.from('\\n// altered companion\\n')])],\n  ]) { assert.throws(() => assertQuestingEnterpriseTrackedInput(companion.file, now, anchor, raw)); actualArgumentRefusals++; }\n}\nconsole.log(JSON.stringify({ phase: 'SOURCE_ONLY_ACTUAL_CURRENT_ENTERPRISE_GUARDS', syntheticDefinition: true,\n  mutationRejections: rejections + 1, predecessorInputs: predecessor.files.length, mandatoryNativeCases: ENTERPRISE_NATIVE_PROOFS.length,\n",
          "baseline": "  ]) { assert.throws(() => assertQuestingEnterpriseTrackedInput(row.file, now, anchor, raw)); actualArgumentRefusals++; }\n  assert.throws(() => assertQuestingEnterpriseTrackedInput(row.file, current, authored, bytes, Object.freeze({ ...actual })));\n  assert.throws(() => assertQuestingEnterpriseTrackedInput('../outside.js', current, authored, bytes)); actualArgumentRefusals += 2;\n}\nconsole.log(JSON.stringify({ phase: 'SOURCE_ONLY_ACTUAL_CURRENT_ENTERPRISE_GUARDS', syntheticDefinition: true,\n  mutationRejections: rejections + 1, predecessorInputs: predecessor.files.length, mandatoryNativeCases: ENTERPRISE_NATIVE_PROOFS.length,\n"
        }
      ]
    },
    "test/enterprise-release-phase2-migration-catalog.js": {
      "current": {
        "mode": "100644",
        "blob": "c35ebb7882d2a1103ac080b00630cff2f7fbbb00",
        "sha256": "a8789026111be911cc53a5348847a2583bf7895f9ad46ee819276e7f51132e3b",
        "bytes": 32624
      },
      "baseline": {
        "mode": "100644",
        "blob": "a0e64889dfa2def52c8f1b6a9148ea19c46a2316",
        "sha256": "36cb9483ddb241281b57de5315adf8e4b21df2b6ed2bd136afd1f03f6d54fdd3",
        "bytes": 32468
      },
      "inverses": [
        {
          "at": 2612,
          "current": "const dispatchSchema=deedQuestSourceBaseline('schema.sql',dispatchRaw);\nconst commerceCurrent=hash(lf(dispatchSchema))==='ce98d276e71072975bd745f43205fa21bcfe2f3bc163b26f08eea4c6f0dac97c';\nconst commerceDeedCurrent=hash(lf(dispatchSchema))==='833373245ddb1ce5a3c9ed386a9b3245d81ddb0bdb51e75d1e5ffee2a7684335';\nconst questingAdapter=await import('../tools/questing-enterprise-catalog.js');\nconst questingCurrent=hash(lf(dispatchRaw))===questingAdapter.QUESTING_CATALOG_SOURCE.sha256;\nif(questingCurrent){\n  const adapter=questingAdapter;\n  const sources=adapter.questingCatalogSource(dispatchRaw);\n  assert.equal(sources.actualTables,585);assert.equal(sources.baselineTables,582);\n  console.log('Exact actual quest585 source retains the reviewed four-field casino delta and unchanged three-table quest suffix; archived catalog admission remains separate.');\n  if(native){\n    const {default:pg}=await import('pg'),pool=new pg.Pool({connectionString:endpoint.href,max:1});\n    try{\n      const result=await adapter.verifyQuestingEnterpriseCatalog(pool,endpoint.href,dispatchRaw);\n      assert.equal(result.actualTables,585);assert.equal(result.baselineTables,582);assert.equal(result.ddlCausal,13);assert.equal(result.casinoDdlCausal,14);assert(result.causal>300);\n      console.log(JSON.stringify({phase:'ACTUAL_QUEST585_ENTERPRISE_CATALOG',freshTables:585,upgradeTables:585,baselineTables:582,\n        questTables:3,questColumns:21,metadataCausal:result.causal,rollbackDdlCausal:result.ddlCausal,\n        casinoColumns:4,casinoDdlCausal:result.casinoDdlCausal,historicalReferenceCausal:result.historical.causal,native:true,priorNativeResultsTransferred:false}));\n    }finally{await pool.end();}\n  }\n}else if(commerceDeedCurrent){\n",
          "baseline": "const dispatchSchema=deedQuestSourceBaseline('schema.sql',dispatchRaw);\nconst commerceCurrent=hash(lf(dispatchSchema))==='ce98d276e71072975bd745f43205fa21bcfe2f3bc163b26f08eea4c6f0dac97c';\nconst commerceDeedCurrent=hash(lf(dispatchSchema))==='833373245ddb1ce5a3c9ed386a9b3245d81ddb0bdb51e75d1e5ffee2a7684335';\nconst questingCurrent=hash(lf(dispatchRaw))==='af6d9ad01566eaddf8ec6b4c4da4add77837b13e6a3510697bebf62b180b97e7';\nif(questingCurrent){\n  const adapter=await import('../tools/questing-enterprise-catalog.js');\n  const sources=adapter.questingCatalogSource(dispatchRaw);\n  assert.equal(sources.actualTables,585);assert.equal(sources.baselineTables,582);\n  console.log('Exact actual quest585 source retains complete582 plus three additive tables; old catalog admission remains separate.');\n  if(native){\n    const {default:pg}=await import('pg'),pool=new pg.Pool({connectionString:endpoint.href,max:1});\n    try{\n      const result=await adapter.verifyQuestingEnterpriseCatalog(pool,endpoint.href,dispatchRaw);\n      assert.equal(result.actualTables,585);assert.equal(result.baselineTables,582);assert.equal(result.ddlCausal,13);assert(result.causal>300);\n      console.log(JSON.stringify({phase:'ACTUAL_QUEST585_ENTERPRISE_CATALOG',freshTables:585,upgradeTables:585,baselineTables:582,\n        questTables:3,questColumns:21,metadataCausal:result.causal,rollbackDdlCausal:result.ddlCausal,\n        historicalReferenceCausal:result.historical.causal,native:true,priorNativeResultsTransferred:false}));\n    }finally{await pool.end();}\n  }\n}else if(commerceDeedCurrent){\n"
        }
      ]
    },
    "test/gates.js": {
      "current": {
        "mode": "100644",
        "blob": "48dafd97be10188afeb5cda58ab547b5034776db",
        "sha256": "d31ba48a4ec02166682e68873109731e8d69181eb3a795e65fbc8258a346d462",
        "bytes": 479827
      },
      "baseline": {
        "mode": "100644",
        "blob": "e68dc6ff306b95845f786b918c9082e03292cff0",
        "sha256": "a97332e0ceb380dfeff0b55c96d642463f9ba03437e4717d0ca502671ff6af8e",
        "bytes": 478102
      },
      "inverses": [
        {
          "at": 340388,
          "current": "      + 'the ContextPlus .ps1 launcher, so on Linux `join(process.env.SystemRoot, ...)` throws before '\n      + 'any assertion runs. Wiring it into the chain would make every Linux run red for a reason '\n      + 'that says nothing about the product.',\n  };\n\n  const propertyFixtureFile = 'test/deed-discovery-fixture.js';\n",
          "baseline": "      + 'the ContextPlus .ps1 launcher, so on Linux `join(process.env.SystemRoot, ...)` throws before '\n      + 'any assertion runs. Wiring it into the chain would make every Linux run red for a reason '\n      + 'that says nothing about the product.',\n    'test/mcp.js':\n      'Needs the SEPARATE omerta-mcp package\\'s own dependencies (@modelcontextprotocol/sdk), which '\n      + 'the repo root does not install — `npm ci` here would have to carry a dep only that package '\n      + 'uses. It is the clean-machine check for the published MCP server and belongs to that '\n      + 'package\\'s own verification, run from omerta-mcp/ after its install.',\n  };\n\n  const propertyFixtureFile = 'test/deed-discovery-fixture.js';\n"
        },
        {
          "at": 364169,
          "current": "  const coreParts = splitNative(coreNative), economyParts = splitNative(economyNative), enterpriseParts = splitNative(enterpriseNative);\n  const expectedUxNativeStep = \"      - name: UX metadata concurrency, membership and RLS (disposable PostgreSQL)\\n        env:\\n          UX_TEST_DATABASE_URL: postgres://postgres:pgcheck@127.0.0.1:5432/omerta_check\\n        run: npm run test:ux:postgres\";\n  const uxNativeParts = coreParts.steps.filter(part => part.includes('      - name: UX metadata concurrency, membership and RLS (disposable PostgreSQL)'));\n  const expectedSiteAnalyticsNativeStep = \"      - name: Optional website counts on real PostgreSQL\\n        env:\\n          SITE_ANALYTICS_TEST_DATABASE_URL: postgres://postgres:pgcheck@127.0.0.1:5432/omerta_check\\n          DATABASE_URL: ''\\n        run: node test/site-analytics.js --postgres\";\n  const assertSiteAnalyticsNativeStep = block => {\n    const parts = splitNative(block).steps.filter(part => part.includes('      - name: Optional website counts on real PostgreSQL'));\n    assert.equal(parts.length, 1, 'Exactly one complete website aggregate PostgreSQL proof is required');\n    assert.equal(nativeShape(parts[0]), nativeShape(expectedSiteAnalyticsNativeStep),\n      'Optional website counts retain their explicit disposable endpoint, bare native command and unconditional execution');\n  };\n  assertSiteAnalyticsNativeStep(coreNative);\n  assertSiteAnalyticsNativeStep(coreNative.replaceAll('\\n', '\\r\\n'));\n  const siteAnalyticsNativeBlock = coreNative.replaceAll('\\r\\n', '\\n');\n  assert.equal(siteAnalyticsNativeBlock.split(expectedSiteAnalyticsNativeStep).length, 2);\n  for (const change of [expectedSiteAnalyticsNativeStep.replace('        env:', '        if: false\\n        env:'),\n    expectedSiteAnalyticsNativeStep.replace('        env:', '        continue-on-error: true\\n        env:'),\n    expectedSiteAnalyticsNativeStep.replace('127.0.0.1', 'remote.invalid'),\n    expectedSiteAnalyticsNativeStep.replace(' --postgres', ''), expectedSiteAnalyticsNativeStep + ' --partial'])\n    assert.throws(() => assertSiteAnalyticsNativeStep(siteAnalyticsNativeBlock.replace(expectedSiteAnalyticsNativeStep, change)),\n      'Skipped, optional, remote, non-native or partial website proofs must reject');\n  assert.throws(() => assertSiteAnalyticsNativeStep(siteAnalyticsNativeBlock.replace(expectedSiteAnalyticsNativeStep, '')));\n  assert.throws(() => assertSiteAnalyticsNativeStep(siteAnalyticsNativeBlock.replace(expectedSiteAnalyticsNativeStep,\n    expectedSiteAnalyticsNativeStep + '\\n' + expectedSiteAnalyticsNativeStep)));\n  assert.equal(uxNativeParts.length, 1, 'Exactly one complete UX native metadata and RLS proof is required');\n  assert.equal(nativeShape(uxNativeParts[0]), nativeShape(expectedUxNativeStep), 'UX native proof keeps its disposable endpoint, complete command and unconditional execution');\n  for (const changed of [expectedUxNativeStep.replace('test:ux:postgres', 'test:ux:postgres -- --partial'), expectedUxNativeStep.replace('        env:', '        if: false\\n        env:'), expectedUxNativeStep.replace('        env:', '        continue-on-error: true\\n        env:')])\n",
          "baseline": "  const coreParts = splitNative(coreNative), economyParts = splitNative(economyNative), enterpriseParts = splitNative(enterpriseNative);\n  const expectedUxNativeStep = \"      - name: UX metadata concurrency, membership and RLS (disposable PostgreSQL)\\n        env:\\n          UX_TEST_DATABASE_URL: postgres://postgres:pgcheck@127.0.0.1:5432/omerta_check\\n        run: npm run test:ux:postgres\";\n  const uxNativeParts = coreParts.steps.filter(part => part.includes('      - name: UX metadata concurrency, membership and RLS (disposable PostgreSQL)'));\n  assert.equal(uxNativeParts.length, 1, 'Exactly one complete UX native metadata and RLS proof is required');\n  assert.equal(nativeShape(uxNativeParts[0]), nativeShape(expectedUxNativeStep), 'UX native proof keeps its disposable endpoint, complete command and unconditional execution');\n  for (const changed of [expectedUxNativeStep.replace('test:ux:postgres', 'test:ux:postgres -- --partial'), expectedUxNativeStep.replace('        env:', '        if: false\\n        env:'), expectedUxNativeStep.replace('        env:', '        continue-on-error: true\\n        env:')])\n"
        },
        {
          "at": 397213,
          "current": "  // an unnamed `- run: command`, a named step's `run: command`, and their literal `|` bodies.\n  // Unknown block scalar syntax fails closed so a new shape cannot quietly stop being inventoried.\n  const exactNativeNodeCommands = new Set([\n    'node test/site-analytics.js --postgres',\n    'node test/db-rls.js --postgres',\n    'node test/payment-receipts-postgres.js',\n    'node test/deeds-supply-postgres.js',\n",
          "baseline": "  // an unnamed `- run: command`, a named step's `run: command`, and their literal `|` bodies.\n  // Unknown block scalar syntax fails closed so a new shape cannot quietly stop being inventoried.\n  const exactNativeNodeCommands = new Set([\n    'node test/db-rls.js --postgres',\n    'node test/payment-receipts-postgres.js',\n    'node test/deeds-supply-postgres.js',\n"
        },
        {
          "at": 400977,
          "current": "    return commands;\n  };\n  const expectedNativeCommands = [\n    'build:funded-work-artifact', 'node test/site-analytics.js --postgres', 'node test/db-rls.js --postgres', 'node test/payment-receipts-postgres.js', 'test:gateway:postgres',\n    'node test/deeds-supply-postgres.js', 'node test/readiness-migration-failure.js',\n    'pgquery', 'test:goods-market:postgres', 'test:deed-discovery:postgres', 'test:deed-upgrades:postgres', 'test:city:postgres', 'pgcheck', 'test:ux:postgres', 'test:http-idempotency:postgres', 'test:resources:postgres', 'pilot:resources:postgres', 'test:decisionproofs:postgres', 'test:supply-tenders:postgres', 'test:warehouses:postgres', 'test:crew-logistics:postgres', 'test:franchises:postgres', 'test:intel-forecasts:postgres', 'test:intel-forecasts-api:postgres', 'test:delivery-finance:postgres', 'test:delivery-finance-guards:postgres', 'test:delivery-finance-api:postgres', 'test:logistics-coverage-clock:postgres', 'test:logistics-coverage:postgres', 'test:logistics-coverage-api:postgres', 'test:strategy-licenses:postgres', 'test:strategy-licenses-api:postgres', 'test:company-succession:postgres', 'test:company-succession-api:postgres', 'test:market-feed-api:postgres', 'test:strategy-leagues:postgres', 'test:strategy-leagues-api:postgres', 'test:company-operators:postgres', 'test:game-employment:postgres', 'test:company-workflows:postgres', 'test:commercial-premises:postgres', 'test:company-bank-portfolios:postgres', 'test:logistics-hubs:postgres', 'test:buyer-cooperatives:postgres', 'test:company-opportunities:postgres', 'test:commercial-reputation:postgres', 'test:business-seasons:postgres', 'test:company-economy:postgres', 'test:business-desk:postgres', 'test:equipment-economy:postgres', 'test:company-workforce:postgres', 'test:company-commercial:postgres', 'test:company-autonomy:postgres', 'test:agent-economy-next-five:postgres', 'test:agent-economy-next-layer:postgres', 'test:agent-economy-market-operations:postgres', 'test:due-work:postgres', 'test:db-migration:postgres', 'test:rc1:security:postgres', 'test:rc1:mod-ingress:postgres', 'test:rc1:observers:postgres', 'test:rc1:resource:postgres', 'test:rc1:capital:postgres', 'phase2:definitions:postgres', 'phase2:lots:postgres',\n    'test:coordination:postgres', 'test:world-kernel:postgres', 'test:family-operations:postgres', 'test:world-projections:postgres',\n",
          "baseline": "    return commands;\n  };\n  const expectedNativeCommands = [\n    'build:funded-work-artifact', 'node test/db-rls.js --postgres', 'node test/payment-receipts-postgres.js', 'test:gateway:postgres',\n    'node test/deeds-supply-postgres.js', 'node test/readiness-migration-failure.js',\n    'pgquery', 'test:goods-market:postgres', 'test:deed-discovery:postgres', 'test:deed-upgrades:postgres', 'test:city:postgres', 'pgcheck', 'test:ux:postgres', 'test:http-idempotency:postgres', 'test:resources:postgres', 'pilot:resources:postgres', 'test:decisionproofs:postgres', 'test:supply-tenders:postgres', 'test:warehouses:postgres', 'test:crew-logistics:postgres', 'test:franchises:postgres', 'test:intel-forecasts:postgres', 'test:intel-forecasts-api:postgres', 'test:delivery-finance:postgres', 'test:delivery-finance-guards:postgres', 'test:delivery-finance-api:postgres', 'test:logistics-coverage-clock:postgres', 'test:logistics-coverage:postgres', 'test:logistics-coverage-api:postgres', 'test:strategy-licenses:postgres', 'test:strategy-licenses-api:postgres', 'test:company-succession:postgres', 'test:company-succession-api:postgres', 'test:market-feed-api:postgres', 'test:strategy-leagues:postgres', 'test:strategy-leagues-api:postgres', 'test:company-operators:postgres', 'test:game-employment:postgres', 'test:company-workflows:postgres', 'test:commercial-premises:postgres', 'test:company-bank-portfolios:postgres', 'test:logistics-hubs:postgres', 'test:buyer-cooperatives:postgres', 'test:company-opportunities:postgres', 'test:commercial-reputation:postgres', 'test:business-seasons:postgres', 'test:company-economy:postgres', 'test:business-desk:postgres', 'test:equipment-economy:postgres', 'test:company-workforce:postgres', 'test:company-commercial:postgres', 'test:company-autonomy:postgres', 'test:agent-economy-next-five:postgres', 'test:agent-economy-next-layer:postgres', 'test:agent-economy-market-operations:postgres', 'test:due-work:postgres', 'test:db-migration:postgres', 'test:rc1:security:postgres', 'test:rc1:mod-ingress:postgres', 'test:rc1:observers:postgres', 'test:rc1:resource:postgres', 'test:rc1:capital:postgres', 'phase2:definitions:postgres', 'phase2:lots:postgres',\n    'test:coordination:postgres', 'test:world-kernel:postgres', 'test:family-operations:postgres', 'test:world-projections:postgres',\n"
        }
      ]
    },
    "test/hardening.js": {
      "current": {
        "mode": "100644",
        "blob": "4b54f6b4b095c3dd482b2e55e1b302bd722e5fa9",
        "sha256": "989af49e0989f4697738c3ae395ae28ff15177c5cf237ce41a508a29f52e20eb",
        "bytes": 142579
      },
      "baseline": {
        "mode": "100644",
        "blob": "c7400e6dd3ce938bcbc8dd931f68a5c0c4bc8e5e",
        "sha256": "22e4e75855ca0670a1879f2a6792eda32571f7fd69e626107665b91beba2a80c",
        "bytes": 142354
      },
      "inverses": [
        {
          "at": 28745,
          "current": "// surfaces — the manual must be readable by ChatGPT/Grok/open-source fetchers, not just Claude.\nconst rb = await app.inject({ method: 'GET', url: '/robots.txt' });\nassert(rb.statusCode === 200 && /text\\/plain/.test(rb.headers['content-type'])\n  && /User-agent: \\*/.test(rb.body) && /Allow: \\//.test(rb.body)\n  && /llms\\.txt/.test(rb.body) && /Sitemap: .*\\/sitemap\\.xml/.test(rb.body),\n  'robots.txt welcomes all crawlers/AI agents and points at discovery surfaces');\nassert.deepEqual([...rb.body.matchAll(/^Disallow: (.+)$/gm)].map(match => match[1]).sort(),\n  ['/admin', '/consigliere', '/v1/auth/', '/v1/mod/'].sort(),\n  'crawler exclusions cover private surfaces while public pages and AI discovery stay accessible');\nconst sm = await app.inject({ method: 'GET', url: '/sitemap.xml' });\nassert(sm.statusCode === 200 && /application\\/xml/.test(sm.headers['content-type'])\n  && /<loc>.*\\/arena<\\/loc>/.test(sm.body), 'sitemap publishes the indexable public surfaces');\n",
          "baseline": "// surfaces — the manual must be readable by ChatGPT/Grok/open-source fetchers, not just Claude.\nconst rb = await app.inject({ method: 'GET', url: '/robots.txt' });\nassert(rb.statusCode === 200 && /text\\/plain/.test(rb.headers['content-type'])\n  && /User-agent: \\*/.test(rb.body) && /Allow: \\//.test(rb.body) && !/Disallow/.test(rb.body)\n  && /llms\\.txt/.test(rb.body) && /Sitemap: .*\\/sitemap\\.xml/.test(rb.body),\n  'robots.txt welcomes all crawlers/AI agents and points at discovery surfaces');\nconst sm = await app.inject({ method: 'GET', url: '/sitemap.xml' });\nassert(sm.statusCode === 200 && /application\\/xml/.test(sm.headers['content-type'])\n  && /<loc>.*\\/arena<\\/loc>/.test(sm.body), 'sitemap publishes the indexable public surfaces');\n"
        }
      ]
    },
    "test/legal-security.js": {
      "current": {
        "mode": "100644",
        "blob": "47fdd3229a01db7f284081463158c72d3a4ae3fc",
        "sha256": "c163969347ca63c21662b070b99f51e70eb35620335a9b78534661b719e8f1da",
        "bytes": 8086
      },
      "baseline": {
        "mode": "100644",
        "blob": "8f1e2a8e66f6a68b655cafe4a76b31eb72d52a7a",
        "sha256": "2545b8012ba8a1fe0100d58cdaac65459a4bee7a5c12446b886b7a224d1dab54",
        "bytes": 8086
      },
      "inverses": [
        {
          "at": 1048,
          "current": "  for (const key of Object.keys(profile)) delete process.env[key];\n  const defaultPrivacy = await app.inject('/privacy');\n  assert.equal(defaultPrivacy.statusCode, 200, 'default privacy policy is public without operator configuration');\n  assert(defaultPrivacy.body.includes('November 7, 2026'));\n  assert(defaultPrivacy.body.includes('A dedicated privacy contact has not yet been published'));\n  assert(!/\\b(?:null|undefined)\\b/.test(defaultPrivacy.body), 'default policy has no missing-value placeholders');\n  assert(!/180 days|seven days|thirty days|\\/v1\\/|background worker|BYPASSRLS|JWT_SECRET|end-to-end encrypted|token records/.test(defaultPrivacy.body), 'public notice omits security internals and cleanup timings');\n",
          "baseline": "  for (const key of Object.keys(profile)) delete process.env[key];\n  const defaultPrivacy = await app.inject('/privacy');\n  assert.equal(defaultPrivacy.statusCode, 200, 'default privacy policy is public without operator configuration');\n  assert(defaultPrivacy.body.includes('October 31, 2026'));\n  assert(defaultPrivacy.body.includes('A dedicated privacy contact has not yet been published'));\n  assert(!/\\b(?:null|undefined)\\b/.test(defaultPrivacy.body), 'default policy has no missing-value placeholders');\n  assert(!/180 days|seven days|thirty days|\\/v1\\/|background worker|BYPASSRLS|JWT_SECRET|end-to-end encrypted|token records/.test(defaultPrivacy.body), 'public notice omits security internals and cleanup timings');\n"
        }
      ]
    },
    "test/lib/questing-ux-enterprise-reader-source-compatibility.js": {
      "current": {
        "mode": "100644",
        "blob": "25072693250b1545e046596d9548f1953bd5eb41",
        "sha256": "29e10bd68ffc4a04004e46bcb51011cce8256e921488f2ce272b2a951bd91978",
        "bytes": 9936
      },
      "baseline": {
        "mode": "100644",
        "blob": "6cd588a6ac98416b7dac2b3bc92f1090d136e5a7",
        "sha256": "ca60fac9a8a9d63913f1c38a482a49a357385ea7ab935d5a882bbd7511d112d9",
        "bytes": 9563
      },
      "inverses": [
        {
          "at": 0,
          "current": "// Additive source-only reader view; the complete actual HEAD/index/physical source qualifies first.\nimport { QUESTING_SOURCE, qualifyQuestingSource, questingHistoricalEntry } from '../../tools/questing-source-transfer.js';\nimport { qualifySiteBasicsSource } from '../../tools/site-basics-source-transfer.js';\nexport function questingEnterpriseReaderView(file, input, entry) {\n  assert.equal(arguments.length, 3);\n  assert([\"test/enterprise-release-phase2-migration-catalog.js\"].includes(file), 'Only the finite retained reader domains');\n",
          "baseline": "// Additive source-only reader view; the complete actual HEAD/index/physical source qualifies first.\nimport { QUESTING_SOURCE, qualifyQuestingSource, questingHistoricalEntry } from '../../tools/questing-source-transfer.js';\nexport function questingEnterpriseReaderView(file, input, entry) {\n  assert.equal(arguments.length, 3);\n  assert([\"test/enterprise-release-phase2-migration-catalog.js\"].includes(file), 'Only the finite retained reader domains');\n"
        },
        {
          "at": 1049,
          "current": "  assert(parsed && parsed[3] === file, 'Exact regular reader Git entry');\n  assert.equal(crypto.createHash('sha1').update('blob ' + Buffer.byteLength(lf) + '\\0').update(lf).digest('hex'), parsed[2], 'Whole comparison input equals its admitted actual Git blob');\n  const flags = { sourceOnly: true, runtime: false, native: false, financial: false, activation: false, deployment: false, priorResultsTransferred: false };\n  assert(Object.hasOwn(QUESTING_SOURCE.files, file), 'The declared current-only reader has an exact quest comparison domain');\n  const site = qualifySiteBasicsSource(file, input);\n  assert.deepEqual([site.sourceOnly, site.runtime, site.native, site.financial, site.activation, site.deployment, site.priorResultsTransferred], [true, false, false, false, false, false, false]);\n  const proof = qualifyQuestingSource(file, site.baselineText);\n  assert.deepEqual([proof.sourceOnly, proof.runtime, proof.native, proof.financial, proof.activation, proof.deployment, proof.priorResultsTransferred], [true, false, false, false, false, false, false]);\n  const priorEntry = questingHistoricalEntry(file, entry, 'tree');\n  return Object.freeze({ input: buffer ? Buffer.from(proof.baselineText) : proof.baselineText, entry: priorEntry, ...flags });\n",
          "baseline": "  assert(parsed && parsed[3] === file, 'Exact regular reader Git entry');\n  assert.equal(crypto.createHash('sha1').update('blob ' + Buffer.byteLength(lf) + '\\0').update(lf).digest('hex'), parsed[2], 'Whole comparison input equals its admitted actual Git blob');\n  const flags = { sourceOnly: true, runtime: false, native: false, financial: false, activation: false, deployment: false, priorResultsTransferred: false };\n  if (!Object.hasOwn(QUESTING_SOURCE.files, file)) return Object.freeze({ input, entry, ...flags });\n  const proof = qualifyQuestingSource(file, input);\n  assert.deepEqual([proof.sourceOnly, proof.runtime, proof.native, proof.financial, proof.activation, proof.deployment, proof.priorResultsTransferred], [true, false, false, false, false, false, false]);\n  const priorEntry = questingHistoricalEntry(file, entry, 'tree');\n  return Object.freeze({ input: buffer ? Buffer.from(proof.baselineText) : proof.baselineText, entry: priorEntry, ...flags });\n"
        }
      ]
    },
    "test/lib/rc1-historical-source-fixture.js": {
      "current": {
        "mode": "100644",
        "blob": "11b045419dfb2ab9599162747cdd2c0a561294e6",
        "sha256": "d9e33e4e4d6643d4804fb2663f43a861a2cc734121ed28ef6a0bade7979dd69b",
        "bytes": 60316
      },
      "baseline": {
        "mode": "100644",
        "blob": "236f0654eed02089bf5c11eac45db2634fca2c97",
        "sha256": "f890ab2e2a0f56d3570eed5b14b517668197fbcd8915e7349ab1d600a8c8bfa7",
        "bytes": 54193
      },
      "inverses": [
        {
          "at": 2149,
          "current": "import { marketOverDeedSourceBaseline } from '../../tools/deed-market-source-compatibility.js';\nimport { economyHardeningSourceBaseline } from '../../tools/economy-hardening-source-transfer.js';\nimport { QUESTING_SOURCE, qualifyQuestingSource } from '../../tools/questing-source-transfer.js';\nimport { SITE_BASICS_SOURCE, qualifySiteBasicsSource } from '../../tools/site-basics-source-transfer.js';\n\nexport const HISTORICAL_SOURCE_FIXTURE_REVISION = 'fe4a75a8b21fc41fd3d3bc75cf7720612c581463';\nconst releaseRevision = 'b12c1cbcbcf88bd4510cc8316c5cd5ca08eb4e16';\n",
          "baseline": "import { marketOverDeedSourceBaseline } from '../../tools/deed-market-source-compatibility.js';\nimport { economyHardeningSourceBaseline } from '../../tools/economy-hardening-source-transfer.js';\nimport { QUESTING_SOURCE, qualifyQuestingSource } from '../../tools/questing-source-transfer.js';\n\nexport const HISTORICAL_SOURCE_FIXTURE_REVISION = 'fe4a75a8b21fc41fd3d3bc75cf7720612c581463';\nconst releaseRevision = 'b12c1cbcbcf88bd4510cc8316c5cd5ca08eb4e16';\n"
        },
        {
          "at": 7533,
          "current": "  'src/rules.tail.js', 'src/social/combat.js', 'src/stable.js', 'src/streets.js', 'src/verify.js',\n  'src/wire.js',\n]);\nconst combinedSiteComparisonFiles = Object.freeze(['src/auth.js', 'src/business.js', 'src/population.js', 'src/social/combat.js']);\nconst economicReceiptHistoricalFiles = Object.freeze(['src/store.js', 'src/router.js', 'src/treasury.js', 'src/watcher.js']);\nconst npcEntries = new Set([\n  'test/rc1-npc-retirement-journal.js', 'test/rc1-car-melt-provenance.js',\n",
          "baseline": "  'src/rules.tail.js', 'src/social/combat.js', 'src/stable.js', 'src/streets.js', 'src/verify.js',\n  'src/wire.js',\n]);\nconst economicReceiptHistoricalFiles = Object.freeze(['src/store.js', 'src/router.js', 'src/treasury.js', 'src/watcher.js']);\nconst npcEntries = new Set([\n  'test/rc1-npc-retirement-journal.js', 'test/rc1-car-melt-provenance.js',\n"
        },
        {
          "at": 17679,
          "current": "    committed: git(['--no-replace-objects', 'show', 'HEAD:' + file]), physical: originalRead(physicalPath),\n    regular: stat.isFile(), symbolic: stat.isSymbolicLink() };\n}\nfunction currentCombinedSiteRecord(file) {\n  assert.equal(arguments.length, 1); assert(combinedSiteComparisonFiles.includes(file), 'Only the four declared current combined comparisons');\n  const entry = String(git(['--no-replace-objects', 'ls-tree', '-z', 'HEAD', '--', file]));\n  const match = entry.match(/^(100644|100755) blob ([a-f0-9]{40})\\t([^\\0]+)\\0$/);\n  assert(match && match[3] === file, 'Actual combined comparison has a regular Git entry');\n  const physicalPath = path.join(root, file), stat = fs.lstatSync(physicalPath);\n  return { head: { mode: match[1], blob: match[2] },\n    index: String(git(['--no-replace-objects', 'ls-files', '--stage', '--', file])).trim(),\n    committed: git(['--no-replace-objects', 'show', 'HEAD:' + file]), physical: originalRead(physicalPath),\n    regular: stat.isFile(), symbolic: stat.isSymbolicLink() };\n}\nfunction qualifyCurrentCombinedSite(file, actual) {\n  assert.equal(arguments.length, 2); assert(combinedSiteComparisonFiles.includes(file), 'Only the four declared current combined comparisons');\n  assert(Object.hasOwn(SITE_BASICS_SOURCE.files, file), 'Exact site comparison domain required');\n  assert.deepEqual(Object.keys(actual).sort(), ['head', 'index', 'committed', 'physical', 'regular', 'symbolic'].sort());\n  const pin = SITE_BASICS_SOURCE.files[file].current;\n  assert.deepEqual(actual.head, { mode: pin.mode, blob: pin.blob }, 'Actual combined HEAD equals its current site source pin');\n  assert.equal(actual.index, pin.mode + ' ' + pin.blob + ' 0\\t' + file, 'Actual combined index equals its complete HEAD identity');\n  assert.equal(actual.regular, true); assert.equal(actual.symbolic, false);\n  assert(Buffer.isBuffer(actual.committed) && Buffer.isBuffer(actual.physical));\n  const text = actual.committed.toString('utf8');\n  assert(Buffer.from(text).equals(actual.committed) && !text.includes('\\r'), 'Actual combined Git text is lossless canonical LF');\n  assert.equal(blobHash(actual.committed), pin.blob); assert.equal(sha256(actual.committed), pin.sha256); assert.equal(actual.committed.length, pin.bytes);\n  assert(actual.physical.equals(actual.committed) || actual.physical.equals(Buffer.from(text.replaceAll('\\n', '\\r\\n'))),\n    'Actual regular combined physical bytes equal complete HEAD in LF or uniform CRLF');\n  const proof = qualifySiteBasicsSource(file, actual.committed);\n  assert.deepEqual([proof.sourceOnly, proof.runtime, proof.native, proof.financial, proof.activation, proof.deployment, proof.priorResultsTransferred],\n    [true, false, false, false, false, false, false]);\n  return proof;\n}\nfunction qualifyCurrentQuestingWorldHelper(file, actual) {\n  assert.equal(arguments.length, 2);\n  assert.equal(file, cityActivityWorldHelper.file, 'Only the exact qualification helper comparison');\n",
          "baseline": "    committed: git(['--no-replace-objects', 'show', 'HEAD:' + file]), physical: originalRead(physicalPath),\n    regular: stat.isFile(), symbolic: stat.isSymbolicLink() };\n}\nfunction qualifyCurrentQuestingWorldHelper(file, actual) {\n  assert.equal(arguments.length, 2);\n  assert.equal(file, cityActivityWorldHelper.file, 'Only the exact qualification helper comparison');\n"
        },
        {
          "at": 42868,
          "current": "  console.log(JSON.stringify({ phase: 'QUESTING_HISTORICAL_HELPER_COMPARISON_CONTROLS', currentPositives,\n    currentRefusals, sourceOnly: true, runtime: false, native: false, projectedSourceExecuted: false }));\n}\nfunction rejectCurrentCombinedSiteSources() {\n  assert.deepEqual(enterpriseCombinedHistoricalFiles.filter(file => Object.hasOwn(SITE_BASICS_SOURCE.files, file)), combinedSiteComparisonFiles,\n    'Only the four reviewed combined physical controls have the current site layer');\n  let positives = 0, refusals = 0;\n  for (const file of combinedSiteComparisonFiles) {\n    const actual = currentCombinedSiteRecord(file), text = actual.committed.toString('utf8'), pin = SITE_BASICS_SOURCE.files[file];\n    for (const physical of [actual.committed, Buffer.from(text.replaceAll('\\n', '\\r\\n'))]) {\n      const proof = qualifyCurrentCombinedSite(file, { ...actual, physical });\n      assert.equal(sha256(proof.baselineText), pin.baseline.sha256); assert.equal(blobHash(Buffer.from(proof.baselineText)), pin.baseline.blob); positives++;\n    }\n    const badBlob = '0'.repeat(40), otherMode = actual.head.mode === '100644' ? '100755' : '100644';\n    for (const bad of [\n      { ...actual, head: { ...actual.head, blob: badBlob } }, { ...actual, head: { ...actual.head, mode: otherMode } },\n      { ...actual, index: actual.index.replace(actual.head.blob, badBlob) }, { ...actual, index: otherMode + actual.index.slice(6) },\n      { ...actual, index: actual.index + '\\n' }, { ...actual, regular: false }, { ...actual, symbolic: true },\n      { ...actual, committed: Buffer.concat([actual.committed, Buffer.from('\\n')]) }, { ...actual, committed: Buffer.from([255]) },\n      { ...actual, physical: Buffer.concat([actual.physical, Buffer.from('\\n')]) }, { ...actual, physical: actual.committed.subarray(1) },\n      { ...actual, physical: Buffer.from(text.replace('\\n', '\\r\\n')) }, { ...actual, physical: Buffer.from([255]) },\n      { ...actual, physical: text }, { ...actual, unknown: true },\n    ]) { assert.throws(() => qualifyCurrentCombinedSite(file, bad)); refusals++; }\n    // A self-consistent historical record is not an admitted current record, even with valid old bytes.\n    const archived = git(['--no-replace-objects', 'cat-file', 'blob', pin.baseline.blob]);\n    assert.throws(() => qualifyCurrentCombinedSite(file, { ...actual, head: { mode: pin.baseline.mode, blob: pin.baseline.blob },\n      index: pin.baseline.mode + ' ' + pin.baseline.blob + ' 0\\t' + file, committed: archived, physical: archived })); refusals++;\n    for (const unsupported of ['src/store.js', '../' + file, '__proto__']) {\n      assert.throws(() => qualifyCurrentCombinedSite(unsupported, actual)); refusals++;\n    }\n    assert.throws(() => qualifyCurrentCombinedSite(file, actual, {})); refusals++;\n    assert.throws(() => currentCombinedSiteRecord(file, {})); refusals++;\n  }\n  console.log(JSON.stringify({ phase: 'CURRENT_SITE_COMBINED_PHYSICAL_CONTROLS', domains: combinedSiteComparisonFiles.length,\n    positives, refusals, sourceOnly: true, runtime: false, native: false, projectedSourceExecuted: false }));\n}\nfunction rejectHistoricalApplicationSources() {\n  rejectCurrentCombinedSiteSources();\n  const files = ['schema.sql', 'src/agentgateway.js', 'src/content/phase1.js', 'src/content/phase1-policy.js',\n    'src/db.js', 'src/deeds.js', 'src/explore.js'];\n  let positives = 0, refusals = 0;\n",
          "baseline": "  console.log(JSON.stringify({ phase: 'QUESTING_HISTORICAL_HELPER_COMPARISON_CONTROLS', currentPositives,\n    currentRefusals, sourceOnly: true, runtime: false, native: false, projectedSourceExecuted: false }));\n}\nfunction rejectHistoricalApplicationSources() {\n  const files = ['schema.sql', 'src/agentgateway.js', 'src/content/phase1.js', 'src/content/phase1-policy.js',\n    'src/db.js', 'src/deeds.js', 'src/explore.js'];\n  let positives = 0, refusals = 0;\n"
        },
        {
          "at": 49463,
          "current": "  for (const combinedFile of enterpriseCombinedHistoricalFiles) {\n    const combinedRow = ENTERPRISE_NATIVE_RELEASE_INPUTS.replacements.find(row => row.file === combinedFile);\n    const physicalRaw = canonical(originalRead(path.join(root, combinedFile)));\n    let comparisonRaw = physicalRaw;\n    if (combinedSiteComparisonFiles.includes(combinedFile)) {\n      const actual = currentCombinedSiteRecord(combinedFile);\n      assert.equal(physicalRaw, canonical(actual.physical), 'The physical combined comparison remains the same complete source');\n      comparisonRaw = qualifyCurrentCombinedSite(combinedFile, actual).baselineText;\n    }\n    const physicalCurrent = canonical(economyUxMergeCandidateHistoricalInput(combinedFile, comparisonRaw));\n    const combinedCurrent = String(git(['cat-file', 'blob', combinedRow.after.blob]));\n    const combinedFrozen = String(blob(combinedFile, release));\n    const combinedExpected = blob(combinedFile, history);\n",
          "baseline": "  for (const combinedFile of enterpriseCombinedHistoricalFiles) {\n    const combinedRow = ENTERPRISE_NATIVE_RELEASE_INPUTS.replacements.find(row => row.file === combinedFile);\n    const physicalRaw = canonical(originalRead(path.join(root, combinedFile)));\n    const physicalCurrent = canonical(economyUxMergeCandidateHistoricalInput(combinedFile, physicalRaw));\n    const combinedCurrent = String(git(['cat-file', 'blob', combinedRow.after.blob]));\n    const combinedFrozen = String(blob(combinedFile, release));\n    const combinedExpected = blob(combinedFile, history);\n"
        }
      ]
    },
    "test/mcp.js": {
      "current": {
        "mode": "100644",
        "blob": "2701257c2f458af30e02e6d644e73a41d31d846d",
        "sha256": "52ecbc53075bfa83ee0d107521de13bf654e627948bbf06cec8733ce7f1437ee",
        "bytes": 16887
      },
      "baseline": {
        "mode": "100644",
        "blob": "ec7ec8f1df06d5ef68abfed396dc507764d81649",
        "sha256": "94e27c84a34e4436cae758de601073d7f52bd42db57bfade7ffbfa1229975954",
        "bytes": 13396
      },
      "inverses": [
        {
          "at": 0,
          "current": "// Agent-interface regressions. Exercises the published MCP process over stdio against a real local\n// HTTP server, so the assertions cover the same headers and session behavior an MCP host receives.\nimport assert from 'node:assert/strict';\nimport { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';\nimport { createServer } from 'node:http';\nimport { tmpdir } from 'node:os';\nimport { join } from 'node:path';\n",
          "baseline": "// Agent-interface regressions. Exercises the published MCP process over stdio against a real local\n// HTTP server, so the assertions cover the same headers and session behavior an MCP host receives.\nimport assert from 'node:assert/strict';\nimport { mkdtemp, rm, writeFile } from 'node:fs/promises';\nimport { createServer } from 'node:http';\nimport { tmpdir } from 'node:os';\nimport { join } from 'node:path';\n"
        },
        {
          "at": 465,
          "current": "async function localApi() {\n  const requests = [];\n  const state = { sessionStatus: 200, hasCharacter: true, agent: true,\n    characterStatus: 200, agentKeyStatus: 200, agentSignupStatus: 200 };\n  const server = createServer(async (req, res) => {\n    const chunks = [];\n    for await (const chunk of req) chunks.push(chunk);\n",
          "baseline": "async function localApi() {\n  const requests = [];\n  const state = { sessionStatus: 200, hasCharacter: true, agent: true,\n    characterStatus: 200, agentKeyStatus: 200 };\n  const server = createServer(async (req, res) => {\n    const chunks = [];\n    for await (const chunk of req) chunks.push(chunk);\n"
        },
        {
          "at": 923,
          "current": "      body: raw ? JSON.parse(raw) : undefined });\n    res.setHeader('content-type', 'application/json');\n    if (req.url === '/v1/auth/guest') return res.end(JSON.stringify({ token: 'guest-token' }));\n    if (req.url === '/v1/auth/agent') {\n      if (state.beforeAgentResponse) await state.beforeAgentResponse();\n      res.statusCode = state.agentSignupStatus;\n      return res.end(JSON.stringify(state.agentSignupStatus === 200\n        ? { token: 'agent-token', agent: true }\n        : { error: 'agent_signup_unavailable', message: 'temporary agent signup failure' }));\n    }\n    if (req.url === '/v1/auth/agent-key') {\n      res.statusCode = state.agentKeyStatus;\n      return res.end(JSON.stringify(state.agentKeyStatus === 200\n",
          "baseline": "      body: raw ? JSON.parse(raw) : undefined });\n    res.setHeader('content-type', 'application/json');\n    if (req.url === '/v1/auth/guest') return res.end(JSON.stringify({ token: 'guest-token' }));\n    if (req.url === '/v1/auth/agent-key') {\n      res.statusCode = state.agentKeyStatus;\n      return res.end(JSON.stringify(state.agentKeyStatus === 200\n"
        },
        {
          "at": 6061,
          "current": "const dir = await mkdtemp(join(tmpdir(), 'omerta-mcp-test-'));\nconst sessionFile = join(dir, 'session.json');\nconst api = await localApi();\nlet mcp, peer;\ntry {\n  mcp = await mcpProcess(api.base, sessionFile);\n  assert.equal(mcp.serverInfo.version, '1.4.0',\n    'the MCP handshake version stays aligned with the published package version');\n  const started = await mcp.call('omerta_start');\n  const admission = api.requests.find(r => r.path === '/v1/auth/agent');\n  assert.match(admission.body.bootstrapSecret, /^[A-Za-z0-9_-]{43}$/, 'agent signup uses a durable recovery credential');\n  assert.equal(admission.body.birthDate, undefined, 'machine signup never invents a date');\n  assert.equal(api.requests.some(r => r.path === '/v1/auth/guest'), false, 'new machine signup uses only the agent exemption');\n  assert.match(started.next, /No character/i,\n    'an auth-only start directs the agent to finish character creation before requesting a turn');\n  await mcp.call('omerta_request', { method: 'POST', path: '/v1/action', operationId: 'bodyless-1' });\n",
          "baseline": "const dir = await mkdtemp(join(tmpdir(), 'omerta-mcp-test-'));\nconst sessionFile = join(dir, 'session.json');\nconst api = await localApi();\nlet mcp;\ntry {\n  mcp = await mcpProcess(api.base, sessionFile);\n  assert.equal(mcp.serverInfo.version, '1.3.0',\n    'the MCP handshake version stays aligned with the published package version');\n  const started = await mcp.call('omerta_start');\n  assert.match(started.next, /No character/i,\n    'an auth-only start directs the agent to finish character creation before requesting a turn');\n  await mcp.call('omerta_request', { method: 'POST', path: '/v1/action', operationId: 'bodyless-1' });\n"
        },
        {
          "at": 9187,
          "current": "  assert.equal(staleAction.error, 'unknown_action',\n    'a successful mutation invalidates every sibling action so the agent must refresh before acting again');\n\n  const guestAuths = api.requests.filter((r) => r.path === '/v1/auth/agent').length;\n  await mcp.stop();\n  mcp = null;\n  mcp = await mcpProcess(api.base, sessionFile);\n  const resumed = await mcp.call('omerta_start');\n  assert.equal(api.requests.filter((r) => r.path === '/v1/auth/agent').length, guestAuths,\n    'restarting the MCP reuses the persisted agent identity instead of creating another guest');\n  assert.equal(resumed.resumed, true, 'the start response identifies a resumed session');\n  api.state.sessionStatus = 503;\n",
          "baseline": "  assert.equal(staleAction.error, 'unknown_action',\n    'a successful mutation invalidates every sibling action so the agent must refresh before acting again');\n\n  const guestAuths = api.requests.filter((r) => r.path === '/v1/auth/guest').length;\n  await mcp.stop();\n  mcp = null;\n  mcp = await mcpProcess(api.base, sessionFile);\n  const resumed = await mcp.call('omerta_start');\n  assert.equal(api.requests.filter((r) => r.path === '/v1/auth/guest').length, guestAuths,\n    'restarting the MCP reuses the persisted agent identity instead of creating another guest');\n  assert.equal(resumed.resumed, true, 'the start response identifies a resumed session');\n  api.state.sessionStatus = 503;\n"
        },
        {
          "at": 9939,
          "current": "  assert.deepEqual({ error: unavailableSession.error, status: unavailableSession.status },\n    { error: 'session_unavailable', status: 503 },\n  'a transient session probe failure is not mislabeled as an expired identity');\n  assert.equal(api.requests.filter((r) => r.path === '/v1/auth/agent').length, guestAuths,\n    'a transient session probe failure never provisions a replacement guest');\n  api.state.sessionStatus = 200;\n  const refusedActiveReset = await mcp.call('omerta_start', { reset: true });\n  assert.equal(refusedActiveReset.error, 'session_active',\n    'reset cannot replace a healthy agent identity');\n  assert.equal(api.requests.filter((r) => r.path === '/v1/auth/agent').length, guestAuths,\n    'refusing an active-session reset creates no replacement account');\n\n  api.state.hasCharacter = false;\n",
          "baseline": "  assert.deepEqual({ error: unavailableSession.error, status: unavailableSession.status },\n    { error: 'session_unavailable', status: 503 },\n  'a transient session probe failure is not mislabeled as an expired identity');\n  assert.equal(api.requests.filter((r) => r.path === '/v1/auth/guest').length, guestAuths,\n    'a transient session probe failure never provisions a replacement guest');\n  api.state.sessionStatus = 200;\n  const refusedActiveReset = await mcp.call('omerta_start', { reset: true });\n  assert.equal(refusedActiveReset.error, 'session_active',\n    'reset cannot replace a healthy agent identity');\n  assert.equal(api.requests.filter((r) => r.path === '/v1/auth/guest').length, guestAuths,\n    'refusing an active-session reset creates no replacement account');\n\n  api.state.hasCharacter = false;\n"
        },
        {
          "at": 11450,
          "current": "  mcp = await mcpProcess(api.base, sessionFile);\n  const corrupt = await mcp.call('omerta_start');\n  assert.equal(corrupt.error, 'session_invalid', 'a corrupt durable session fails closed');\n  assert.equal(api.requests.filter((r) => r.path === '/v1/auth/agent').length, guestAuths,\n    'a corrupt session never creates a replacement identity silently');\n\n  await mcp.stop();\n",
          "baseline": "  mcp = await mcpProcess(api.base, sessionFile);\n  const corrupt = await mcp.call('omerta_start');\n  assert.equal(corrupt.error, 'session_invalid', 'a corrupt durable session fails closed');\n  assert.equal(api.requests.filter((r) => r.path === '/v1/auth/guest').length, guestAuths,\n    'a corrupt session never creates a replacement identity silently');\n\n  await mcp.stop();\n"
        },
        {
          "at": 11978,
          "current": "  mcp = await mcpProcess(api.base, sessionFile);\n  const wrongOrigin = await mcp.call('omerta_start');\n  assert.equal(wrongOrigin.error, 'session_invalid', 'a session bound to another API origin fails closed');\n  assert.equal(api.requests.filter((r) => r.path === '/v1/auth/agent').length, guestAuths,\n    'an origin mismatch never overwrites the existing identity with a new guest');\n\n  const recovered = await mcp.call('omerta_start', { reset: true });\n  assert.equal(recovered.authed, true,\n    'an explicit reset recovers from an unreadable saved session without manual file surgery');\n  assert.equal(api.requests.filter((r) => r.path === '/v1/auth/agent').length, guestAuths + 1,\n    'session recovery creates a replacement identity only after the caller explicitly requests reset');\n\n  await mcp.stop();\n",
          "baseline": "  mcp = await mcpProcess(api.base, sessionFile);\n  const wrongOrigin = await mcp.call('omerta_start');\n  assert.equal(wrongOrigin.error, 'session_invalid', 'a session bound to another API origin fails closed');\n  assert.equal(api.requests.filter((r) => r.path === '/v1/auth/guest').length, guestAuths,\n    'an origin mismatch never overwrites the existing identity with a new guest');\n\n  const recovered = await mcp.call('omerta_start', { reset: true });\n  assert.equal(recovered.authed, true,\n    'an explicit reset recovers from an unreadable saved session without manual file surgery');\n  assert.equal(api.requests.filter((r) => r.path === '/v1/auth/guest').length, guestAuths + 1,\n    'session recovery creates a replacement identity only after the caller explicitly requests reset');\n\n  await mcp.stop();\n"
        },
        {
          "at": 12802,
          "current": "  await writeFile(sessionFile, '{not-json', 'utf8');\n  mcp = await mcpProcess(api.base, sessionFile);\n  api.state.agentKeyStatus = 503;\n  api.state.agent = false;\n  await mcp.stop();\n  await writeFile(sessionFile, JSON.stringify({ version: 1, base: api.base, token: 'legacy-human-token' }), 'utf8');\n  mcp = await mcpProcess(api.base, sessionFile);\n  const failedUpgrade = await mcp.call('omerta_start');\n  assert.deepEqual({ step: failedUpgrade.step, status: failedUpgrade.status,\n    error: failedUpgrade.body?.error }, { step: 'agent_key', status: 503, error: 'agent_key_failed' },\n  'a failed agent-key upgrade is reported as the failing step instead of a successful agent start');\n  const guestsAfterFailedUpgrade = api.requests.filter((r) => r.path === '/v1/auth/agent').length;\n  await mcp.stop();\n  mcp = null;\n  api.state.agentKeyStatus = 200;\n  api.state.agent = false;\n  mcp = await mcpProcess(api.base, sessionFile);\n  const retriedUpgrade = await mcp.call('omerta_start');\n  assert.equal(api.requests.filter((r) => r.path === '/v1/auth/agent').length, guestsAfterFailedUpgrade,\n    'a failed agent-key upgrade persists the guest identity so restart retries the same account');\n  assert.deepEqual({ authed: retriedUpgrade.authed, agent: retriedUpgrade.agent,\n    resumed: retriedUpgrade.resumed }, { authed: true, agent: true, resumed: true },\n  'the resumed guest upgrades cleanly to an agent after the transient failure clears');\n\n  await mcp.stop();\n  mcp = null;\n  await rm(sessionFile, { force: true });\n  api.state.agentSignupStatus = 503;\n  api.state.agent = true;\n  mcp = await mcpProcess(api.base, sessionFile);\n  const uncertainSignup = await mcp.call('omerta_start');\n  assert.equal(uncertainSignup.step, 'agent_signup');\n  const uncertainSecret = api.requests.filter(r => r.path === '/v1/auth/agent').at(-1).body.bootstrapSecret;\n  await mcp.stop();\n  mcp = null;\n  api.state.agentSignupStatus = 200;\n  mcp = await mcpProcess(api.base, sessionFile);\n  const recoveredSignup = await mcp.call('omerta_start');\n  assert.equal(recoveredSignup.agent, true);\n  assert.equal(api.requests.filter(r => r.path === '/v1/auth/agent').at(-1).body.bootstrapSecret, uncertainSecret,\n    'restart after ambiguous signup reuses the same durable recovery proof');\n\n  await mcp.stop(); mcp = null;\n  await rm(sessionFile, { force: true });\n  mcp = await mcpProcess(api.base, sessionFile);\n  peer = await mcpProcess(api.base, sessionFile);\n  const beforeParallel = api.requests.filter(r => r.path === '/v1/auth/agent').length;\n  const parallel = await Promise.all([mcp.call('omerta_start'), peer.call('omerta_start')]);\n  for (const [index, result] of parallel.entries()) {\n    if (result.error === 'session_changed') assert.equal((await [mcp, peer][index].call('omerta_start')).authed, true);\n    else assert.equal(result.authed, true, JSON.stringify(result));\n  }\n  const parallelAdmissions = api.requests.filter(r => r.path === '/v1/auth/agent').slice(beforeParallel);\n  assert.ok(parallelAdmissions.length >= 1);\n  assert.equal(new Set(parallelAdmissions.map(r => r.body.bootstrapSecret)).size, 1,\n    'hosts sharing a new session publish/adopt one recovery proof rather than overwriting each other');\n  await peer.stop(); peer = null;\n\n  await mcp.stop(); mcp = null;\n  await rm(sessionFile, { force: true });\n  mcp = await mcpProcess(api.base, sessionFile);\n  const replacement = { version: 1, base: 'https://another-city.invalid', token: 'another-city-token' };\n  api.state.beforeAgentResponse = async () => {\n    api.state.beforeAgentResponse = null;\n    await writeFile(sessionFile, JSON.stringify(replacement));\n  };\n  assert.equal((await mcp.call('omerta_start')).error, 'session_write',\n    'a late admission response refuses to overwrite a session switched to another origin');\n  assert.deepEqual(JSON.parse(await readFile(sessionFile, 'utf8')), replacement);\n} finally {\n  if (peer) await peer.stop();\n  if (mcp) await mcp.stop();\n  await api.close();\n  await rm(dir, { recursive: true, force: true });\n",
          "baseline": "  await writeFile(sessionFile, '{not-json', 'utf8');\n  mcp = await mcpProcess(api.base, sessionFile);\n  api.state.agentKeyStatus = 503;\n  const failedUpgrade = await mcp.call('omerta_start', { reset: true });\n  assert.deepEqual({ step: failedUpgrade.step, status: failedUpgrade.status,\n    error: failedUpgrade.body?.error }, { step: 'agent_key', status: 503, error: 'agent_key_failed' },\n  'a failed agent-key upgrade is reported as the failing step instead of a successful agent start');\n  const guestsAfterFailedUpgrade = api.requests.filter((r) => r.path === '/v1/auth/guest').length;\n  await mcp.stop();\n  mcp = null;\n  api.state.agentKeyStatus = 200;\n  api.state.agent = false;\n  mcp = await mcpProcess(api.base, sessionFile);\n  const retriedUpgrade = await mcp.call('omerta_start');\n  assert.equal(api.requests.filter((r) => r.path === '/v1/auth/guest').length, guestsAfterFailedUpgrade,\n    'a failed agent-key upgrade persists the guest identity so restart retries the same account');\n  assert.deepEqual({ authed: retriedUpgrade.authed, agent: retriedUpgrade.agent,\n    resumed: retriedUpgrade.resumed }, { authed: true, agent: true, resumed: true },\n  'the resumed guest upgrades cleanly to an agent after the transient failure clears');\n} finally {\n  if (mcp) await mcp.stop();\n  await api.close();\n  await rm(dir, { recursive: true, force: true });\n"
        }
      ]
    },
    "test/playthrough-truth.js": {
      "current": {
        "mode": "100644",
        "blob": "040f9f9d9284420ff778a1023218e1c9950ee76b",
        "sha256": "a31002d2c3f3a871fc2ed206982a66d243fd470d20155ddd19b9215e647304d2",
        "bytes": 2975
      },
      "baseline": {
        "mode": "100644",
        "blob": "0e9f93013674d93bd5b629ff0ac279af45671b2a",
        "sha256": "9da0e243fbe16aa2577599bda9ea60d5338a089dd60696cc5a6cae49f228e9a1",
        "bytes": 1347
      },
      "inverses": [
        {
          "at": 0,
          "current": "import assert from 'node:assert/strict';\nimport { execFile } from 'node:child_process';\nimport { promisify } from 'node:util';\nimport { crimeCoachRungObeyed } from '../tools/playthrough-truth.js';\n\n// Regression target: the former predicate credited a level-2 player for any\n",
          "baseline": "import assert from 'node:assert/strict';\nimport { crimeCoachRungObeyed } from '../tools/playthrough-truth.js';\n\n// Regression target: the former predicate credited a level-2 player for any\n"
        },
        {
          "at": 1294,
          "current": "  }), false, `a failed crime does not complete the ${label} coach rung`);\n}\n\n// Exercise the actual harness with a deterministic local player. Omitting its street clock\n// caps this simulated sitting at one real-time attempt; parsing obsolete coach prose keeps\n// the First Blood instruction permanently uncleared despite the assigned rival being present.\nconst entry = new URL('../tools/playthrough.js', import.meta.url).href;\nconst childCode = `\n  process.env.NODE_ENV = 'test';\n  process.env.RATE_LIMIT = 'off';\n  process.env.SEASON_MOD = 'dead_quiet';\n  process.env.SEASON_PHASE = 'long_game';\n  delete process.env.DATABASE_URL;\n  let seed = 936017;\n  Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };\n  process.argv = [process.execPath, ${JSON.stringify(entry)}, '--days', '1', '--sessions', '1', '--session', '20'];\n  await import(${JSON.stringify(entry)});\n`;\nconst { stdout } = await promisify(execFile)(process.execPath, ['--input-type=module', '--eval', childCode], {\n  windowsHide: true, timeout: 90000, maxBuffer: 1024 * 1024,\n});\nconst attempts = [...stdout.matchAll(/^\\s+crime:(?:win|bust)\\s+(\\d+)\\s*$/gm)]\n  .reduce((sum, match) => sum + Number(match[1]), 0);\nassert.ok(attempts >= 8,\n  `simulated street cooldowns must advance with the sitting; only ${attempts} crime attempts occurred`);\nconst obeyed = stdout.match(/^  obeyed: (.*)$/m)?.[1] || '';\nassert.ok(obeyed.includes('Settle your first score'),\n  'the actual current coach hint identifies the assigned rival and the harness clears First Blood');\n\nconsole.log(`✓ playthrough coach-truth regression passed (${attempts} crimes; First Blood cleared)`);\n",
          "baseline": "  }), false, `a failed crime does not complete the ${label} coach rung`);\n}\n\nconsole.log('✓ playthrough coach-truth regression passed');\n"
        }
      ]
    },
    "test/quest-experience-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "b72ec8946c2e0d54ed1616e53f93c1148e23d868",
        "sha256": "38453a9487242b44d8bf3e3d06f39f00fbc26520939afd85f7b12aa259f90110",
        "bytes": 32695
      },
      "baseline": {
        "mode": "100644",
        "blob": "d3a920832e8b07ea9546b4e5f5c6688bcf8ddf8b",
        "sha256": "44e31b30684ed8e9a37d8d99b085bb92bc6418ca81babb7a5e0c70492800ccc3",
        "bytes": 31431
      },
      "inverses": [
        {
          "at": 4951,
          "current": "  page.on('pageerror', error => errors.push(error.message));\n  await page.setContent('<!doctype html><html><body style=\"margin:0\"><main id=\"tab-desk\"></main></body></html>');\n  await page.addStyleTag({ content: fs.readFileSync(new URL('../public/ux-quests.css', import.meta.url), 'utf8') });\n  let releaseWrongResponse, markWrongResponseReady;\n  const wrongResponseReady = new Promise(resolve => { markWrongResponseReady = resolve; });\n  const pendingWrongResponse = new Promise(resolve => { releaseWrongResponse = resolve; });\n  await page.exposeFunction('questApi', async (method, url, player, payload) => {\n    requests.push({ method, url, player, payload });\n    const reply = await api(method, url, browserPlayers[player].token, payload);\n    if (payload?.submission?.ids?.includes('decoy')) { markWrongResponseReady(); await pendingWrongResponse; }\n    return reply;\n  });\n  await page.addScriptTag({ content: fs.readFileSync(new URL('../public/ux-quests.js', import.meta.url), 'utf8') });\n  await page.evaluate(({ aliceId, bobId, aliceAccount, bobAccount }) => {\n    window.questPlayers = { alice: { id: aliceId, accountId: aliceAccount, loc: 'docks' }, bob: { id: bobId, accountId: bobAccount, loc: 'docks' } };\n",
          "baseline": "  page.on('pageerror', error => errors.push(error.message));\n  await page.setContent('<!doctype html><html><body style=\"margin:0\"><main id=\"tab-desk\"></main></body></html>');\n  await page.addStyleTag({ content: fs.readFileSync(new URL('../public/ux-quests.css', import.meta.url), 'utf8') });\n  await page.exposeFunction('questApi', async (method, url, player, payload) => { requests.push({ method, url, player, payload }); return api(method, url, browserPlayers[player].token, payload); });\n  await page.addScriptTag({ content: fs.readFileSync(new URL('../public/ux-quests.js', import.meta.url), 'utf8') });\n  await page.evaluate(({ aliceId, bobId, aliceAccount, bobAccount }) => {\n    window.questPlayers = { alice: { id: aliceId, accountId: aliceAccount, loc: 'docks' }, bob: { id: bobId, accountId: bobAccount, loc: 'docks' } };\n"
        },
        {
          "at": 7753,
          "current": "  assert.equal(await deduction.getByText('Place arrival before departure.', { exact: true }).count(), 0, 'only the requested hint is revealed');\n  await deduction.getByLabel('Unrelated document', { exact: false }).check();\n  await deduction.getByRole('button', { name: 'Test this deduction', exact: true }).click();\n  await wrongResponseReady;\n  assert.equal(await deduction.getByLabel('First document', { exact: false }).isDisabled(), true, 'Pending deductions lock editable controls instead of leaving an interactive disabled-submit copy.');\n  assert.equal(await deduction.getByLabel('Unrelated document', { exact: false }).isChecked(), true, 'The submitted evidence draft survives the pending repaint.');\n  releaseWrongResponse();\n  await page.waitForFunction(() => document.querySelector('#ux-quests')?.getAttribute('aria-busy') === 'false');\n  assert.equal(await deduction.getByLabel('First document', { exact: false }).isDisabled(), false, 'The completed response and refetch restore editable evidence controls.');\n  assert.equal(await deduction.getByRole('button', { name: 'Test this deduction', exact: true }).isDisabled(), false, 'A wrong answer can be corrected and resubmitted.');\n  await deduction.waitFor();\n  assert.equal(await page.getByRole('heading', { name: 'Browser interrogation', exact: true }).count(), 0, 'incorrect structured answer never advances the client');\n  for (const kind of kinds) {\n",
          "baseline": "  assert.equal(await deduction.getByText('Place arrival before departure.', { exact: true }).count(), 0, 'only the requested hint is revealed');\n  await deduction.getByLabel('Unrelated document', { exact: false }).check();\n  await deduction.getByRole('button', { name: 'Test this deduction', exact: true }).click();\n  await deduction.waitFor();\n  assert.equal(await page.getByRole('heading', { name: 'Browser interrogation', exact: true }).count(), 0, 'incorrect structured answer never advances the client');\n  for (const kind of kinds) {\n"
        }
      ]
    },
    "test/questing-enterprise-catalog-guard.js": {
      "current": {
        "mode": "100644",
        "blob": "a6045d7c764babc1d0572cf4774a0ecc3f29e8df",
        "sha256": "e75b585345f259e07769fc0dc5a39992a9d583e827c1a89710d09194f1b14aef",
        "bytes": 10340
      },
      "baseline": {
        "mode": "100644",
        "blob": "a43b66e49388608e043dfc7f242d1707aacc80aa",
        "sha256": "4e13053b8ce6b01981d694d6a0190ba1439bb329d2d6e71b090e868031741fc1",
        "bytes": 6373
      },
      "inverses": [
        {
          "at": 0,
          "current": "import assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport { questingCatalogSource, questingCatalogProjection, QUESTING_CATALOG_COLUMNS as columns,\n  QUESTING_CATALOG_TABLES as tables, questingCasinoCatalogProjection } from '../tools/questing-enterprise-catalog.js';\n\nconst raw = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');\nconst source = questingCatalogSource(raw);\nassert.equal(questingCatalogSource(source.current.replaceAll('\\n', '\\r\\n')).current, source.current);\nlet refusals = 0;\nfor (const bad of [source.baseline, source.archivedBaseline, source.archived, source.current + '\\n', source.current.slice(1), '\\ufeff' + source.current,\n  source.current.replace('\\n', '\\r\\n'), source.current.replace('stars BETWEEN 1 AND 5', 'stars BETWEEN 0 AND 5'),\n  source.current.replace('author_account_id TEXT NOT NULL REFERENCES accounts(id)', 'author_account_id TEXT'),\n  source.current.replace('quest_reading_room', 'unreviewed_reading_room'), source.current.replace('rake_index_cursor TEXT', 'rake_index_cursor VARCHAR'),\n  source.current.replace('rake_checkpoint_volume NUMERIC', 'rake_checkpoint_volume NUMERIC(20,2)'),\n  source.current.replace(\"rake_index TEXT NOT NULL DEFAULT '0'\", \"rake_index TEXT NOT NULL DEFAULT '1'\")]) {\n  assert.throws(() => questingCatalogSource(bad)); refusals++;\n}\nconst baseline = { relations: [{ name: 'accounts', kind: 'r', persistence: 'p' }], columns: [], constraints: [], indexes: [] };\n",
          "baseline": "import assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport { questingCatalogSource, questingCatalogProjection, QUESTING_CATALOG_COLUMNS as columns,\n  QUESTING_CATALOG_TABLES as tables } from '../tools/questing-enterprise-catalog.js';\n\nconst raw = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');\nconst source = questingCatalogSource(raw);\nassert.equal(questingCatalogSource(source.current.replaceAll('\\n', '\\r\\n')).current, source.current);\nlet refusals = 0;\nfor (const bad of [source.baseline, source.current + '\\n', source.current.slice(1), '\\ufeff' + source.current,\n  source.current.replace('\\n', '\\r\\n'), source.current.replace('stars BETWEEN 1 AND 5', 'stars BETWEEN 0 AND 5'),\n  source.current.replace('author_account_id TEXT NOT NULL REFERENCES accounts(id)', 'author_account_id TEXT'),\n  source.current.replace('quest_reading_room', 'unreviewed_reading_room')]) {\n  assert.throws(() => questingCatalogSource(bad)); refusals++;\n}\nconst baseline = { relations: [{ name: 'accounts', kind: 'r', persistence: 'p' }], columns: [], constraints: [], indexes: [] };\n"
        },
        {
          "at": 6211,
          "current": "    value => { value.constraints[0].is_local = false; }, value => { value.constraints[0].inheritance_count = 1; },\n  ]) { const bad = fixture(version); change(bad); assert.throws(() => questingCatalogProjection(bad, structuredClone(baseline), version)); refusals++; }\n}\nlet casinoRefusals = 0, casinoProfiles = 0;\nfor (const version of [16, 18]) for (const profile of ['fresh', 'phase2', 'director']) for (const flags of [false, true]) {\n  const business = ['id','character_id','kind','tier','last_collect_at','launder_used','launder_at','scrutiny','scrutiny_at','shakedown_at','inside_at','rake_cursor','upkeep_at','acquired_at','spec','spec_at','takeover_cd_until'];\n  const volume = ['id','total','profit','distributed','jackpot'];\n  const legacy = { relations: [], columns: [['businesses',business],['den_volume',volume]].flatMap(([table,names]) =>\n    names.map((column_name,i) => ({ table_name:table,column_name,ordinal:i+1 }))), constraints:[], indexes:[] };\n  const names = profile === 'fresh' ? [business.toSpliced(12,0,'rake_index_cursor'),volume.toSpliced(4,0,'rake_index','rake_checkpoint_volume','rake_legacy_owners')]\n    : [[...business,'rake_index_cursor'],[...volume,'rake_index','rake_checkpoint_volume','rake_legacy_owners']];\n  const specs = { rake_index_cursor:['text',false,null],rake_index:['text',true,\"'0'::text\"],rake_checkpoint_volume:['numeric',false,null],rake_legacy_owners:['integer',true,'0'] };\n  const live = { ...structuredClone(legacy), columns: [['businesses',names[0]],['den_volume',names[1]]].flatMap(([table,columns]) => columns.map((name,i) => {\n    const row = { table_name:table,column_name:name,ordinal:i+1 }; if (!specs[name]) return row;\n    const [type,not_null,default_expression] = specs[name]; return {...row,type,not_null,default_expression,typmod:-1,identity:'',generated:'',collation_schema:type==='text'?'pg_catalog':null,collation_name:type==='text'?'default':null};\n  })) };\n  if (version === 18) live.constraints = ['rake_index','rake_legacy_owners'].map(name => ({table_name:'den_volume',name:'den_volume_'+name+'_not_null',type:'n',validated:true,deferrable:false,deferred:false,definition:'NOT NULL '+name,match_type:' ',update_action:' ',delete_action:' ',referenced_schema:null,referenced_table:null,columns:[name],referenced_columns:[],...(flags?{no_inherit:false,is_local:true,inheritance_count:0}:{})}));\n  const project = value => questingCasinoCatalogProjection(value,version,profile,flags);\n  assert.deepEqual(project(live),legacy); casinoProfiles++;\n  const reject = change => { const bad=structuredClone(live);change(bad);assert.throws(()=>project(bad));casinoRefusals++; };\n  for (const [index,row] of live.columns.entries()) if (specs[row.column_name]) {\n    reject(value=>value.columns.splice(index,1)); reject(value=>value.columns.splice(index,0,{...row}));\n    for (const key of Object.keys(row)) reject(value=>{const old=value.columns[index][key];value.columns[index][key]=typeof old==='boolean'?!old:typeof old==='number'?old+1:old===null?'unknown':old+'unknown';});\n  }\n  for (const [index,row] of live.constraints.entries()) {\n    reject(value=>value.constraints.splice(index,1)); reject(value=>value.constraints.push({...row}));\n    for (const key of Object.keys(row)) reject(value=>{value.constraints[index][key]=typeof row[key]==='boolean'?!row[key]:'unknown';});\n  }\n  reject(value=>value.columns.splice(value.columns.findIndex(row=>row.column_name==='rake_cursor'),1));\n  reject(value=>{value.columns.find(row=>row.column_name==='upkeep_at').ordinal++;});\n  reject(value=>value.columns.push({table_name:'den_volume',column_name:'rake_unknown',ordinal:9}));\n  reject(value=>{value.columns.find(row=>row.column_name==='rake_index_cursor').ordinal=15;});\n  reject(value=>{value.columns.find(row=>row.column_name==='rake_index').ordinal=profile==='fresh'?6:5;});\n}\nconsole.log(JSON.stringify({ phase: 'QUESTING_ACTUAL_CATALOG_SOURCE_GUARDS', rawActualTables: 585, rawBaselineTables: 582,\n  explicitRefusals: refusals, syntheticFullFieldCausalRefusals: causal, casinoProfiles, casinoRefusals, syntheticFixturesOnly: true, nativeExecution: false }));\n",
          "baseline": "    value => { value.constraints[0].is_local = false; }, value => { value.constraints[0].inheritance_count = 1; },\n  ]) { const bad = fixture(version); change(bad); assert.throws(() => questingCatalogProjection(bad, structuredClone(baseline), version)); refusals++; }\n}\nconsole.log(JSON.stringify({ phase: 'QUESTING_ACTUAL_CATALOG_SOURCE_GUARDS', rawActualTables: 585, rawBaselineTables: 582,\n  explicitRefusals: refusals, syntheticFullFieldCausalRefusals: causal, syntheticFixturesOnly: true, nativeExecution: false }));\n"
        }
      ]
    },
    "test/questing-source-transfer.js": {
      "current": {
        "mode": "100644",
        "blob": "85500c4d95a9409745961a3f14d4eaca80e61034",
        "sha256": "4e526331f2a41ef059048cd7ab26e1cce92a10f5dc84099051a58beaf1309fa5",
        "bytes": 12317
      },
      "baseline": {
        "mode": "100644",
        "blob": "7a9668ea3e334a22ab63ac97f5face6947cc05de",
        "sha256": "c8850eb8e414f49198cd2e67255ef1788f037b139ae49eedbb6f75746571a010",
        "bytes": 11834
      },
      "inverses": [
        {
          "at": 0,
          "current": "// Source-comparison proof only: no reconstructed source is loaded or executed.\nimport './site-basics-source-transfer.js';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport crypto from 'node:crypto';\nimport { execFileSync } from 'node:child_process';\nimport { QUESTING_SOURCE as source, qualifyQuestingSource,\n  questingHistoricalInput, questingHistoricalEntry } from '../tools/questing-source-transfer.js';\nimport { siteBasicsHistoricalInput, siteBasicsHistoricalEntry } from '../tools/site-basics-source-transfer.js';\n\nconst files = [\n  \".github/workflows/ci.yml\",\n",
          "baseline": "// Source-comparison proof only: no reconstructed source is loaded or executed.\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport crypto from 'node:crypto';\nimport { execFileSync } from 'node:child_process';\nimport { QUESTING_SOURCE as source, qualifyQuestingSource,\n  questingHistoricalInput, questingHistoricalEntry } from '../tools/questing-source-transfer.js';\n\nconst files = [\n  \".github/workflows/ci.yml\",\n"
        },
        {
          "at": 4745,
          "current": "  const committed = git('show', `HEAD:${file}`), raw = fs.readFileSync(file), stat = fs.lstatSync(file);\n  const entry = git('ls-tree', 'HEAD', '--', file).trim(), index = git('ls-files', '--stage', '--', file).trim();\n  assert(stat.isFile() && !stat.isSymbolicLink());\n  assert.equal(String(siteBasicsHistoricalInput(file, committed)), current,\n    'The independently qualified site comparison must preserve the complete approved questing source');\n  assert.equal(entry, `${row.current.mode} blob ${blob(committed)}\\t${file}`);\n  assert.equal(index, `${row.current.mode} ${blob(committed)} 0\\t${file}`);\n  assert(raw.equals(Buffer.from(committed)) || raw.equals(Buffer.from(committed.replaceAll('\\n', '\\r\\n'))),\n    'Actual physical source must be complete uniform LF or CRLF: ' + file);\n  for (const input of [current, current.replaceAll('\\n', '\\r\\n'), Buffer.from(current), siteBasicsHistoricalInput(file, raw)]) {\n    const proof = qualifyQuestingSource(file, input);\n    assert.equal(proof.baselineText, baseline);\n    assert.deepEqual([proof.sourceOnly, proof.runtime, proof.native, proof.financial, proof.activation,\n",
          "baseline": "  const committed = git('show', `HEAD:${file}`), raw = fs.readFileSync(file), stat = fs.lstatSync(file);\n  const entry = git('ls-tree', 'HEAD', '--', file).trim(), index = git('ls-files', '--stage', '--', file).trim();\n  assert(stat.isFile() && !stat.isSymbolicLink());\n  assert.equal(committed, current, 'The scoped physical source must still be exactly the approved questing source');\n  assert.equal(entry, `${row.current.mode} blob ${blob(committed)}\\t${file}`);\n  assert.equal(index, `${row.current.mode} ${blob(committed)} 0\\t${file}`);\n  assert(raw.equals(Buffer.from(committed)) || raw.equals(Buffer.from(committed.replaceAll('\\n', '\\r\\n'))),\n    'Actual physical source must be complete uniform LF or CRLF: ' + file);\n  for (const input of [current, current.replaceAll('\\n', '\\r\\n'), Buffer.from(current), raw]) {\n    const proof = qualifyQuestingSource(file, input);\n    assert.equal(proof.baselineText, baseline);\n    assert.deepEqual([proof.sourceOnly, proof.runtime, proof.native, proof.financial, proof.activation,\n"
        },
        {
          "at": 6050,
          "current": "    assert.equal(Buffer.isBuffer(questingHistoricalInput(file, input)), Buffer.isBuffer(input)); positives++;\n  }\n  for (const kind of ['tree', 'index']) {\n    const actual = siteBasicsHistoricalEntry(file, kind === 'tree' ? entry : index, kind);\n    const expected = kind === 'tree' ? `${row.baseline.mode} blob ${row.baseline.blob}\\t${file}`\n      : `${row.baseline.mode} ${row.baseline.blob} 0\\t${file}`;\n    assert.equal(questingHistoricalEntry(file, actual, kind), expected);\n",
          "baseline": "    assert.equal(Buffer.isBuffer(questingHistoricalInput(file, input)), Buffer.isBuffer(input)); positives++;\n  }\n  for (const kind of ['tree', 'index']) {\n    const actual = kind === 'tree' ? entry : index;\n    const expected = kind === 'tree' ? `${row.baseline.mode} blob ${row.baseline.blob}\\t${file}`\n      : `${row.baseline.mode} ${row.baseline.blob} 0\\t${file}`;\n    assert.equal(questingHistoricalEntry(file, actual, kind), expected);\n"
        },
        {
          "at": 10812,
          "current": "  `const expectedDigest = '${digest[0] === '0' ? '1' : '0'}${digest.slice(1)}';`);\nfor (const text of [invalidStatus, invalidDigest]) {\n  assert.notEqual(text, helperText, 'The isolated binding control must actually change the module');\n  const transport = text.replace(\"from './site-basics-source-transfer.js';\",\n    'from ' + JSON.stringify(new URL('../tools/site-basics-source-transfer.js', import.meta.url).href) + ';');\n  const guard = await import('data:text/javascript;base64,' + Buffer.from(transport).toString('base64'));\n  for (let attempt = 0; attempt < 2; attempt++) {\n    cacheRefused(() => guard.qualifyQuestingSource(cacheFile, cacheCurrent), { code: 'ERR_ASSERTION' });\n  }\n",
          "baseline": "  `const expectedDigest = '${digest[0] === '0' ? '1' : '0'}${digest.slice(1)}';`);\nfor (const text of [invalidStatus, invalidDigest]) {\n  assert.notEqual(text, helperText, 'The isolated binding control must actually change the module');\n  const guard = await import('data:text/javascript;base64,' + Buffer.from(text).toString('base64'));\n  for (let attempt = 0; attempt < 2; attempt++) {\n    cacheRefused(() => guard.qualifyQuestingSource(cacheFile, cacheCurrent), { code: 'ERR_ASSERTION' });\n  }\n"
        }
      ]
    },
    "test/questing-ux-release-phase2-native-catalog-guard.js": {
      "current": {
        "mode": "100644",
        "blob": "c70143519c1de9b10d560b62305ca5d467a7859b",
        "sha256": "34a493ce4e8ddc005abcc25625c3287cff446deb8e4fdced7a3298de8e5b4949",
        "bytes": 29213
      },
      "baseline": {
        "mode": "100644",
        "blob": "d0ece965f3b2c84efc0fd4eb795d0885cd6d0c54",
        "sha256": "9f9d869bd00987aa2f58e721a9a39621e37475cc74b41dc4e1a54a2fe3896b3e",
        "bytes": 24700
      },
      "inverses": [
        {
          "at": 114,
          "current": "import fs from 'node:fs';\nimport crypto from 'node:crypto';\nimport {execFileSync} from 'node:child_process';\nimport {questingNativeQuestProjection, questingNativeCatalogProjection, assertQuestingPhase2SourceInputs,\n  createCommerceReleasePhase2MigrationCatalog, verifyCommerceNativeBranches,\n  verifyCommerceReleasePhase2CausalNegatives} from '../tools/questing-ux-release-phase2-native-catalog.js';\nimport {QUESTING_CATALOG_COLUMNS as columns, QUESTING_CATALOG_TABLES as tables}\n",
          "baseline": "import fs from 'node:fs';\nimport crypto from 'node:crypto';\nimport {execFileSync} from 'node:child_process';\nimport {questingNativeQuestProjection, assertQuestingPhase2SourceInputs,\n  createCommerceReleasePhase2MigrationCatalog, verifyCommerceNativeBranches,\n  verifyCommerceReleasePhase2CausalNegatives} from '../tools/questing-ux-release-phase2-native-catalog.js';\nimport {QUESTING_CATALOG_COLUMNS as columns, QUESTING_CATALOG_TABLES as tables}\n"
        },
        {
          "at": 818,
          "current": "const protectedFile=\"tools/ux-release-phase2-native-catalog.js\";\nconst successorFile=\"tools/questing-ux-release-phase2-native-catalog.js\";\nconst copyPin=Object.freeze({\n  \"bytes\": 54498,\n  \"sha256\": \"65cd8de2870f545c34ed2e869d2cbc1b892a0cdb23feee594e593ed247b40d63\",\n  \"engineCharacters\": 33242,\n  \"engineSha256\": \"2ac048b9ba583355dfa6170f0fdce8d59ff5e7526b3fcc59d3c72a960919923a\",\n  \"bridgeSha256\": \"7a630e127495b5c8c8d83fd887b96c134b3d5eefd7aa797be22d4a9cd0ce3916\",\n  \"protectedSha256\": \"b90d784c72f4e9167be1df50171360dab04f361152e4a54cda96362de24cb331\"\n});\nconst substitutions=Object.freeze([\n",
          "baseline": "const protectedFile=\"tools/ux-release-phase2-native-catalog.js\";\nconst successorFile=\"tools/questing-ux-release-phase2-native-catalog.js\";\nconst copyPin=Object.freeze({\n  \"bytes\": 52073,\n  \"sha256\": \"ded65ea0c23d32584899ef6bbf5b49d37971cc62c206f8190e8ce019ec650eb4\",\n  \"engineCharacters\": 33242,\n  \"engineSha256\": \"2ac048b9ba583355dfa6170f0fdce8d59ff5e7526b3fcc59d3c72a960919923a\",\n  \"bridgeSha256\": \"3f2c15f1629371042c212fa74314efbaff2118821aea80e35b2fe8390c990d74\",\n  \"protectedSha256\": \"b90d784c72f4e9167be1df50171360dab04f361152e4a54cda96362de24cb331\"\n});\nconst substitutions=Object.freeze([\n"
        },
        {
          "at": 11478,
          "current": "  assert.throws(() => questingNativeQuestProjection(input, 18, true)); metadataRefusals++;\n}\nlet nativeAttempts = 0, admissionRefusals = 0;\nlet casinoProfiles = 0, casinoRefusals = 0;\nfor (const version of [16,18]) for (const profile of ['fresh','phase2','director']) {\n  const business=['id','character_id','kind','tier','last_collect_at','launder_used','launder_at','scrutiny','scrutiny_at','shakedown_at','inside_at','rake_cursor','upkeep_at','acquired_at','spec','spec_at','takeover_cd_until'];\n  const volume=['id','total','profit','distributed','jackpot'];\n  const oldColumns=[['businesses',business],['den_volume',volume]].flatMap(([table,names])=>names.map((column_name,i)=>({table_name:table,column_name,ordinal:i+1})));\n  const ordered=profile==='fresh'?[business.toSpliced(12,0,'rake_index_cursor'),volume.toSpliced(4,0,'rake_index','rake_checkpoint_volume','rake_legacy_owners')]\n    :[[...business,'rake_index_cursor'],[...volume,'rake_index','rake_checkpoint_volume','rake_legacy_owners']];\n  const specs={rake_index_cursor:['text',false,null],rake_index:['text',true,\"'0'::text\"],rake_checkpoint_volume:['numeric',false,null],rake_legacy_owners:['integer',true,'0']};\n  const live=fixture(version), includeNotNull=profile!=='director';\n  live.columns.unshift(...[['businesses',ordered[0]],['den_volume',ordered[1]]].flatMap(([table,names])=>names.map((name,i)=>{\n    const row={table_name:table,column_name:name,ordinal:i+1};if(!specs[name])return row;\n    const[type,not_null,default_expression]=specs[name];return{...row,type,not_null,default_expression,typmod:-1,identity:'',generated:'',collation_schema:type==='text'?'pg_catalog':null,collation_name:type==='text'?'default':null};\n  })));\n  if(version===18)live.constraints.unshift(...['rake_index','rake_legacy_owners'].map(name=>({table_name:'den_volume',name:'den_volume_'+name+'_not_null',type:'n',validated:true,deferrable:false,deferred:false,definition:'NOT NULL '+name,match_type:' ',update_action:' ',delete_action:' ',referenced_schema:null,referenced_table:null,columns:[name],referenced_columns:[]})));\n  const projection=questingNativeCatalogProjection(live,version,includeNotNull,profile);\n  assert.deepEqual(projection.projectMetadata(live),{...structuredClone(baseline),columns:oldColumns});casinoProfiles++;\n  const constraints=live.constraints.filter(row=>includeNotNull||row.type!=='n').map(({table_name,name,definition})=>({table_name,name,definition}));\n  assert.deepEqual(projection.projectConstraints(constraints),[]);\n  const reject=change=>{const bad=structuredClone(live);change(bad);assert.throws(()=>projection.projectMetadata(bad));casinoRefusals++;};\n  for(const[index,row]of live.columns.entries())if(specs[row.column_name]){\n    reject(value=>value.columns.splice(index,1));reject(value=>value.columns.push({...row}));\n    for(const key of Object.keys(row))reject(value=>{value.columns[index][key]=mutate(row[key]);});\n  }\n  reject(value=>value.columns.splice(value.columns.findIndex(row=>row.column_name==='rake_cursor'),1));\n  reject(value=>{value.columns.find(row=>row.column_name==='upkeep_at').ordinal++;});\n  reject(value=>value.columns.push({table_name:'den_volume',column_name:'rake_unknown',ordinal:9}));\n  reject(value=>{value.columns.find(row=>row.column_name==='rake_index_cursor').ordinal=15;});\n  reject(value=>{value.columns.find(row=>row.column_name==='rake_index').ordinal=profile==='fresh'?6:5;});\n  for(const[index,row]of constraints.entries())if(row.table_name==='den_volume'){\n    const bad=structuredClone(constraints);bad[index].definition+=' changed';assert.throws(()=>projection.projectConstraints(bad));casinoRefusals++;\n  }\n}\nconst forbidden = { query() { nativeAttempts++; throw Error('No native query in this pure guard'); },\n  connect() { nativeAttempts++; throw Error('No native connection in this pure guard'); } };\nfor (const call of [\n",
          "baseline": "  assert.throws(() => questingNativeQuestProjection(input, 18, true)); metadataRefusals++;\n}\nlet nativeAttempts = 0, admissionRefusals = 0;\nconst forbidden = { query() { nativeAttempts++; throw Error('No native query in this pure guard'); },\n  connect() { nativeAttempts++; throw Error('No native connection in this pure guard'); } };\nfor (const call of [\n"
        },
        {
          "at": 16111,
          "current": "assert.equal(nativeAttempts, 0);\nconsole.log(JSON.stringify({phase:'QUESTING_PHASE2_DIRECTOR_NATIVE_GUARDS', protectedEngineExact:true,\n  finiteSubstitutions:substitutions.length, copyRefusals, profiles, metadataRefusals, constraintRefusals,\n  admissionRefusals, casinoProfiles, casinoRefusals, nativeAttempts, nativeExecution:false, historicalResultsTransferred:false}));\n// Additive pure reader conservation controls. No source is evaluated or substituted into runtime.\nconst readerCopyPins = Object.freeze([\n  {\n",
          "baseline": "assert.equal(nativeAttempts, 0);\nconsole.log(JSON.stringify({phase:'QUESTING_PHASE2_DIRECTOR_NATIVE_GUARDS', protectedEngineExact:true,\n  finiteSubstitutions:substitutions.length, copyRefusals, profiles, metadataRefusals, constraintRefusals,\n  admissionRefusals, nativeAttempts, nativeExecution:false, historicalResultsTransferred:false}));\n// Additive pure reader conservation controls. No source is evaluated or substituted into runtime.\nconst readerCopyPins = Object.freeze([\n  {\n"
        },
        {
          "at": 21059,
          "current": "      \"test/enterprise-release-phase2-migration-catalog.js\"\n    ],\n    \"oldSha256\": \"d7b9ef827c33f5291228da4aee1f7959bab4b5ced35513e02c3697fb8d186319\",\n    \"bytes\": 9936,\n    \"sha256\": \"29e10bd68ffc4a04004e46bcb51011cce8256e921488f2ce272b2a951bd91978\",\n    \"prefixCharacters\": 3578,\n    \"prefixSha256\": \"4a35c639dad611939f7d323ca037f6c9e9331689f034cacc56487bec89c86cc0\",\n    \"edits\": [\n      [\n        \"for (const row of pin.files) {\\n  const current =\",\n",
          "baseline": "      \"test/enterprise-release-phase2-migration-catalog.js\"\n    ],\n    \"oldSha256\": \"d7b9ef827c33f5291228da4aee1f7959bab4b5ced35513e02c3697fb8d186319\",\n    \"bytes\": 9563,\n    \"sha256\": \"ca60fac9a8a9d63913f1c38a482a49a357385ea7ab935d5a882bbd7511d112d9\",\n    \"prefixCharacters\": 3205,\n    \"prefixSha256\": \"e7d383a2ff5a65c8b230fcd098a0be41ba85606b10af54777ebd412bed45fc20\",\n    \"edits\": [\n      [\n        \"for (const row of pin.files) {\\n  const current =\",\n"
        },
        {
          "at": 27528,
          "current": "      assert.throws(()=>view(file,text,bad));readerViewRefusals++;\n    }\n    if(tracked){const otherMode=entry.startsWith('100644')?'100755':'100644';assert.throws(()=>view(file,text,otherMode+entry.slice(6)));readerViewRefusals++;}\n    if(record.exportName==='questingEnterpriseReaderView'){\n      // Even an internally consistent forged blob cannot gain the exact current-source view.\n      for(const bad of [text+'\\n',text.replace('casinoDdlCausal','unknownCasinoDdlCausal')]){\n        assert.notEqual(bad,text);\n        const digest=crypto.createHash('sha1').update('blob '+Buffer.byteLength(bad)+'\\0').update(bad).digest('hex');\n        const forged=entry.replace(/blob [a-f0-9]{40}/,'blob '+digest);\n        assert.throws(()=>view(file,bad,forged));readerViewRefusals++;\n      }\n      const preimage=git('show',readerQuestSource.revision+':'+file).toString('utf8');\n      assert.notEqual(preimage,text);assert.throws(()=>view(file,preimage,entry));readerViewRefusals++;\n      const preimageEntry=git('ls-tree',readerQuestSource.revision,'--',file).toString('utf8').trim();\n      assert.throws(()=>view(file,preimage,preimageEntry));readerViewRefusals++;\n    }\n    assert.throws(()=>view(file,text,entry,{}));readerViewRefusals++;\n  }\n  for(const file of ['../test/phase2-postgres.js','constructor','__proto__',null]){assert.throws(()=>view(file,'x','x'));readerViewRefusals++;}\n",
          "baseline": "      assert.throws(()=>view(file,text,bad));readerViewRefusals++;\n    }\n    if(tracked){const otherMode=entry.startsWith('100644')?'100755':'100644';assert.throws(()=>view(file,text,otherMode+entry.slice(6)));readerViewRefusals++;}\n    assert.throws(()=>view(file,text,entry,{}));readerViewRefusals++;\n  }\n  for(const file of ['../test/phase2-postgres.js','constructor','__proto__',null]){assert.throws(()=>view(file,'x','x'));readerViewRefusals++;}\n"
        }
      ]
    },
    "test/rc1-commercial-premises-source-compatibility.js": {
      "current": {
        "mode": "100644",
        "blob": "6e328055afc4bd9064a91125c12b2f15ef4e2590",
        "sha256": "976409c49eb5579d158f415bb156156ac83b95678525693c2a45d8f56943f11b",
        "bytes": 10588
      },
      "baseline": {
        "mode": "100644",
        "blob": "6f4539e0a5a772a3ff5a1613bd2f381b5301812a",
        "sha256": "76ada8c31c9c7a07ef1cea6b7c205f35af8b728c6a122f0497336268ca04800c",
        "bytes": 10253
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { questingHistoricalInput } from '../tools/questing-source-transfer.js';\nimport { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {hasCommerceCurrentEnterpriseSource,commerceOverCurrentEnterpriseSourceBaseline} from \"../tools/commerce-current-enterprise-source-compatibility.js\";\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\n",
          "baseline": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {hasCommerceCurrentEnterpriseSource,commerceOverCurrentEnterpriseSourceBaseline} from \"../tools/commerce-current-enterprise-source-compatibility.js\";\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\n"
        },
        {
          "at": 8044,
          "current": " if(file==='src/invariants.js')for(const guard of ['assertFranchiseSourceTransfer','assertDeedBacklogCompatibility']){const actual=D[guard](file,current),old=D[guard](file,prior);assert.deepEqual(actual.commercialPremisesSourceTransfer,proof);assert.deepEqual(actual.companyWorkflowSourceTransfer,old.companyWorkflowSourceTransfer);assert.deepEqual(actual.gameEmploymentSourceTransfer,old.gameEmploymentSourceTransfer);}\n}\nfor(const file of ['src/worker.js','src/commercialpremises.js','toString']){assert.throws(()=>P.assertCommercialPremisesSourceTransfer(file,''));assert.throws(()=>P.qualifyCommercialPremisesSource(file,''));}\nconst workerInput = fs.readFileSync('src/worker.js', 'utf8');\nconst unreviewedWorker = workerInput + '\\n// unreviewed worker change\\n';\nassert.equal(questingHistoricalInput('src/worker.js', unreviewedWorker), unreviewedWorker); negatives++;\nconst worker=companyBankSourceBaseline('src/worker.js',questingHistoricalInput('src/worker.js', workerInput));entire(worker,git('show',`${P.COMMERCIAL_PREMISES_SOURCE_PREDECESSOR_REVISION}:src/worker.js`));entire(worker,git('show',`${P.COMMERCIAL_PREMISES_SOURCE_REVIEWED_REVISION}:src/worker.js`));entire(P.commercialPremisesSourceBaseline('src/worker.js',worker),worker);\nassert.deepEqual(WORLD_RECOVERY_REVIEW.commercialPremisesSourceReviewTransfer,P.COMMERCIAL_PREMISES_SOURCE_TRANSFER);assert.deepEqual(WORLD_RECOVERY_REVIEW.companyWorkflowSourceReviewTransfer,W.COMPANY_WORKFLOW_SOURCE_TRANSFER);\nconst currentReader=file=>(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,String((hasCommerceCurrentEnterpriseSource(file)?commerceOverCurrentEnterpriseSourceBaseline(file,String(fs.readFileSync(file,'utf8'))):continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))))):continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))),priorReader=file=>Object.hasOwn(P.COMMERCIAL_PREMISES_SOURCE_CURRENT_PINS,file)?git('show',`${P.COMMERCIAL_PREMISES_SOURCE_PREDECESSOR_REVISION}:${file}`):currentReader(file);\nassert.deepEqual(await verifyWorldRecoverySources({readFile:currentReader,sourceRevision:P.COMMERCIAL_PREMISES_SOURCE_REVIEWED_REVISION}),await verifyWorldRecoverySources({readFile:priorReader,sourceRevision:P.COMMERCIAL_PREMISES_SOURCE_REVIEWED_REVISION}));\n",
          "baseline": " if(file==='src/invariants.js')for(const guard of ['assertFranchiseSourceTransfer','assertDeedBacklogCompatibility']){const actual=D[guard](file,current),old=D[guard](file,prior);assert.deepEqual(actual.commercialPremisesSourceTransfer,proof);assert.deepEqual(actual.companyWorkflowSourceTransfer,old.companyWorkflowSourceTransfer);assert.deepEqual(actual.gameEmploymentSourceTransfer,old.gameEmploymentSourceTransfer);}\n}\nfor(const file of ['src/worker.js','src/commercialpremises.js','toString']){assert.throws(()=>P.assertCommercialPremisesSourceTransfer(file,''));assert.throws(()=>P.qualifyCommercialPremisesSource(file,''));}\nconst worker=companyBankSourceBaseline('src/worker.js',fs.readFileSync('src/worker.js','utf8'));entire(worker,git('show',`${P.COMMERCIAL_PREMISES_SOURCE_PREDECESSOR_REVISION}:src/worker.js`));entire(worker,git('show',`${P.COMMERCIAL_PREMISES_SOURCE_REVIEWED_REVISION}:src/worker.js`));entire(P.commercialPremisesSourceBaseline('src/worker.js',worker),worker);\nassert.deepEqual(WORLD_RECOVERY_REVIEW.commercialPremisesSourceReviewTransfer,P.COMMERCIAL_PREMISES_SOURCE_TRANSFER);assert.deepEqual(WORLD_RECOVERY_REVIEW.companyWorkflowSourceReviewTransfer,W.COMPANY_WORKFLOW_SOURCE_TRANSFER);\nconst currentReader=file=>(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,String((hasCommerceCurrentEnterpriseSource(file)?commerceOverCurrentEnterpriseSourceBaseline(file,String(fs.readFileSync(file,'utf8'))):continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))))):continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))),priorReader=file=>Object.hasOwn(P.COMMERCIAL_PREMISES_SOURCE_CURRENT_PINS,file)?git('show',`${P.COMMERCIAL_PREMISES_SOURCE_PREDECESSOR_REVISION}:${file}`):currentReader(file);\nassert.deepEqual(await verifyWorldRecoverySources({readFile:currentReader,sourceRevision:P.COMMERCIAL_PREMISES_SOURCE_REVIEWED_REVISION}),await verifyWorldRecoverySources({readFile:priorReader,sourceRevision:P.COMMERCIAL_PREMISES_SOURCE_REVIEWED_REVISION}));\n"
        }
      ]
    },
    "test/rc1-company-logistics-hub-source-compatibility.js": {
      "current": {
        "mode": "100644",
        "blob": "6b7aa3cb861ec81de7d52430b33cb1b8b449407c",
        "sha256": "cfb7fa33e9f4196f298761af51808ed06c1e12650b5b38152ec5624052b17657",
        "bytes": 10558
      },
      "baseline": {
        "mode": "100644",
        "blob": "634659f102b2398963660a84d391b404fe674ca5",
        "sha256": "ca6029a5f4115d76137d9e279b363253bc445154b94822550a437491ff783846",
        "bytes": 10223
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { questingHistoricalInput } from '../tools/questing-source-transfer.js';\nimport { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {hasCommerceCurrentEnterpriseSource,commerceOverCurrentEnterpriseSourceBaseline} from \"../tools/commerce-current-enterprise-source-compatibility.js\";\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\n",
          "baseline": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {hasCommerceCurrentEnterpriseSource,commerceOverCurrentEnterpriseSourceBaseline} from \"../tools/commerce-current-enterprise-source-compatibility.js\";\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\n"
        },
        {
          "at": 7818,
          "current": " if(file==='src/invariants.js')for(const guard of ['assertFranchiseSourceTransfer','assertDeedBacklogCompatibility']){const actual=D[guard](file,current),old=D[guard](file,prior);assert.deepEqual(actual.companyLogisticsHubSourceTransfer,proof);assert.deepEqual(actual.companyBankSourceTransfer,old.companyBankSourceTransfer);assert.deepEqual(actual.commercialPremisesSourceTransfer,old.commercialPremisesSourceTransfer);assert.deepEqual(actual.companyWorkflowSourceTransfer,old.companyWorkflowSourceTransfer);assert.deepEqual(actual.gameEmploymentSourceTransfer,old.gameEmploymentSourceTransfer);}\n}\nfor(const file of ['src/worker.js','src/companylogisticshubs.js','toString']){assert.throws(()=>P.assertCompanyLogisticsHubSourceTransfer(file,''));assert.throws(()=>P.qualifyCompanyLogisticsHubSource(file,''));}\nconst workerInput = fs.readFileSync('src/worker.js', 'utf8');\nconst unreviewedWorker = workerInput + '\\n// unreviewed worker change\\n';\nassert.equal(questingHistoricalInput('src/worker.js', unreviewedWorker), unreviewedWorker); negatives++;\nconst worker=buyerCooperativeSourceBaseline('src/worker.js',questingHistoricalInput('src/worker.js', workerInput));entire(worker,git('show',`${P.COMPANY_LOGISTICS_HUB_SOURCE_PREDECESSOR_REVISION}:src/worker.js`));entire(worker,git('show',`${P.COMPANY_LOGISTICS_HUB_SOURCE_REVIEWED_REVISION}:src/worker.js`));entire(P.companyLogisticsHubSourceBaseline('src/worker.js',worker),worker);\nassert.deepEqual(WORLD_RECOVERY_REVIEW.companyLogisticsHubSourceReviewTransfer,P.COMPANY_LOGISTICS_HUB_SOURCE_TRANSFER);assert.deepEqual(WORLD_RECOVERY_REVIEW.companyBankSourceReviewTransfer,W.COMPANY_BANK_SOURCE_TRANSFER);\nconst currentReader=file=>(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,String((hasCommerceCurrentEnterpriseSource(file)?commerceOverCurrentEnterpriseSourceBaseline(file,String(fs.readFileSync(file,'utf8'))):continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))))):continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))),priorReader=file=>Object.hasOwn(P.COMPANY_LOGISTICS_HUB_SOURCE_CURRENT_PINS,file)?git('show',`${P.COMPANY_LOGISTICS_HUB_SOURCE_PREDECESSOR_REVISION}:${file}`):currentReader(file);\nassert.deepEqual(await verifyWorldRecoverySources({readFile:currentReader,sourceRevision:P.COMPANY_LOGISTICS_HUB_SOURCE_REVIEWED_REVISION}),await verifyWorldRecoverySources({readFile:priorReader,sourceRevision:P.COMPANY_LOGISTICS_HUB_SOURCE_REVIEWED_REVISION}));\n",
          "baseline": " if(file==='src/invariants.js')for(const guard of ['assertFranchiseSourceTransfer','assertDeedBacklogCompatibility']){const actual=D[guard](file,current),old=D[guard](file,prior);assert.deepEqual(actual.companyLogisticsHubSourceTransfer,proof);assert.deepEqual(actual.companyBankSourceTransfer,old.companyBankSourceTransfer);assert.deepEqual(actual.commercialPremisesSourceTransfer,old.commercialPremisesSourceTransfer);assert.deepEqual(actual.companyWorkflowSourceTransfer,old.companyWorkflowSourceTransfer);assert.deepEqual(actual.gameEmploymentSourceTransfer,old.gameEmploymentSourceTransfer);}\n}\nfor(const file of ['src/worker.js','src/companylogisticshubs.js','toString']){assert.throws(()=>P.assertCompanyLogisticsHubSourceTransfer(file,''));assert.throws(()=>P.qualifyCompanyLogisticsHubSource(file,''));}\nconst worker=buyerCooperativeSourceBaseline('src/worker.js',fs.readFileSync('src/worker.js','utf8'));entire(worker,git('show',`${P.COMPANY_LOGISTICS_HUB_SOURCE_PREDECESSOR_REVISION}:src/worker.js`));entire(worker,git('show',`${P.COMPANY_LOGISTICS_HUB_SOURCE_REVIEWED_REVISION}:src/worker.js`));entire(P.companyLogisticsHubSourceBaseline('src/worker.js',worker),worker);\nassert.deepEqual(WORLD_RECOVERY_REVIEW.companyLogisticsHubSourceReviewTransfer,P.COMPANY_LOGISTICS_HUB_SOURCE_TRANSFER);assert.deepEqual(WORLD_RECOVERY_REVIEW.companyBankSourceReviewTransfer,W.COMPANY_BANK_SOURCE_TRANSFER);\nconst currentReader=file=>(hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,String((hasCommerceCurrentEnterpriseSource(file)?commerceOverCurrentEnterpriseSourceBaseline(file,String(fs.readFileSync(file,'utf8'))):continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))))):continuousCityHistoricalInput(file, fs.readFileSync(file,'utf8'))),priorReader=file=>Object.hasOwn(P.COMPANY_LOGISTICS_HUB_SOURCE_CURRENT_PINS,file)?git('show',`${P.COMPANY_LOGISTICS_HUB_SOURCE_PREDECESSOR_REVISION}:${file}`):currentReader(file);\nassert.deepEqual(await verifyWorldRecoverySources({readFile:currentReader,sourceRevision:P.COMPANY_LOGISTICS_HUB_SOURCE_REVIEWED_REVISION}),await verifyWorldRecoverySources({readFile:priorReader,sourceRevision:P.COMPANY_LOGISTICS_HUB_SOURCE_REVIEWED_REVISION}));\n"
        }
      ]
    },
    "test/rc1-game-employment-source-compatibility.js": {
      "current": {
        "mode": "100644",
        "blob": "625c6e39f5b882f3e0d148b1f3d1ee4d7b8ab69f",
        "sha256": "f0c7cc34681c78e7d7cbb03e4ff48828447f510fbb49987d6f83a1bb6e50d73f",
        "bytes": 18676
      },
      "baseline": {
        "mode": "100644",
        "blob": "6e37ec6b3e187da4d948bf5428fa1bf946154731",
        "sha256": "8558f19345f3b4449fecb2192c508a2925c4ff1f38199c4271adee10487e48be",
        "bytes": 18342
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { questingHistoricalInput } from '../tools/questing-source-transfer.js';\nimport { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {hasCommerceCurrentEnterpriseSource,commerceOverCurrentEnterpriseSourceBaseline} from \"../tools/commerce-current-enterprise-source-compatibility.js\";\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\n",
          "baseline": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {hasCommerceCurrentEnterpriseSource,commerceOverCurrentEnterpriseSourceBaseline} from \"../tools/commerce-current-enterprise-source-compatibility.js\";\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\n"
        },
        {
          "at": 9071,
          "current": "  assert.throws(() => assertGameEmploymentSourceTransfer(unknown, ''), /Unknown Game Employment/); assert.throws(() => qualifyGameEmploymentSource(unknown, ''), /Unknown Game Employment/);\n}\nassert.equal(gameEmploymentSourceBaseline('src/unknown.js', 'unknown'), 'unknown');\nconst workerInput = fs.readFileSync('src/worker.js', 'utf8');\nconst unreviewedWorker = workerInput + '\\n// unreviewed worker change\\n';\nassert.equal(questingHistoricalInput('src/worker.js', unreviewedWorker), unreviewedWorker); negatives++;\nconst worker = companyWorkflowSourceBaseline('src/worker.js', questingHistoricalInput('src/worker.js', workerInput));\nentire(worker, git('show', `${GAME_EMPLOYMENT_SOURCE_PREDECESSOR_REVISION}:src/worker.js`)); entire(worker, git('show', `${GAME_EMPLOYMENT_SOURCE_REVIEWED_REVISION}:src/worker.js`));\nassert.equal(hash(worker), COMPANY_OPERATOR_SOURCE_CURRENT_PINS['src/worker.js']); sha256Comparisons++;\nassert.equal(blob(worker), COMPANY_OPERATOR_SOURCE_CURRENT_BLOBS['src/worker.js']); blobComparisons++;\n",
          "baseline": "  assert.throws(() => assertGameEmploymentSourceTransfer(unknown, ''), /Unknown Game Employment/); assert.throws(() => qualifyGameEmploymentSource(unknown, ''), /Unknown Game Employment/);\n}\nassert.equal(gameEmploymentSourceBaseline('src/unknown.js', 'unknown'), 'unknown');\nconst worker = companyWorkflowSourceBaseline('src/worker.js', fs.readFileSync('src/worker.js', 'utf8'));\nentire(worker, git('show', `${GAME_EMPLOYMENT_SOURCE_PREDECESSOR_REVISION}:src/worker.js`)); entire(worker, git('show', `${GAME_EMPLOYMENT_SOURCE_REVIEWED_REVISION}:src/worker.js`));\nassert.equal(hash(worker), COMPANY_OPERATOR_SOURCE_CURRENT_PINS['src/worker.js']); sha256Comparisons++;\nassert.equal(blob(worker), COMPANY_OPERATOR_SOURCE_CURRENT_BLOBS['src/worker.js']); blobComparisons++;\n"
        }
      ]
    },
    "test/rc1-intel-source-compatibility.js": {
      "current": {
        "mode": "100644",
        "blob": "627586d73d24ba87c9fcf96d4957243cd7a53b82",
        "sha256": "d808ff5115f3fa24147fefcb47e74f2ad2903c42c4efc0f3930450ab6c2a8531",
        "bytes": 8319
      },
      "baseline": {
        "mode": "100644",
        "blob": "57814341a22393ef6430ae98d7edafefd10d2e9e",
        "sha256": "9cc28df1ba9a9a993526d6e5d9d4e19ec1389b0eb9e968b19b877b7e03467914",
        "bytes": 7985
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { questingHistoricalInput } from '../tools/questing-source-transfer.js';\nimport { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {hasCommerceCurrentEnterpriseSource,commerceOverCurrentEnterpriseSourceBaseline} from \"../tools/commerce-current-enterprise-source-compatibility.js\";\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\n",
          "baseline": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {hasCommerceCurrentEnterpriseSource,commerceOverCurrentEnterpriseSourceBaseline} from \"../tools/commerce-current-enterprise-source-compatibility.js\";\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\n"
        },
        {
          "at": 6260,
          "current": "assert.throws(() => qualifyIntelSource('toString', ''), /Unknown Intel source/);\nassert.match(INTEL_SOURCE_TRANSFER.scope, /separate current-source native proof/);\nassert.match(INTEL_SOURCE_TRANSFER.scope, /no historical runtime, native, deployment or financial qualification/);\nconst workerInput = fs.readFileSync('src/worker.js', 'utf8');\nconst unreviewedWorker = workerInput + '\\n// unreviewed worker change\\n';\nassert.equal(questingHistoricalInput('src/worker.js', unreviewedWorker), unreviewedWorker); negatives++;\nconst operatorWorker = companyWorkflowSourceBaseline('src/worker.js', questingHistoricalInput('src/worker.js', workerInput));\nconst operatorTransfer = qualifyIntelSource('src/worker.js', operatorWorker);\nassert.equal(operatorTransfer.actualSha256, COMPANY_OPERATOR_SOURCE_CURRENT_PINS['src/worker.js']);\nassert.equal(operatorTransfer.companyOperatorSourceTransfer.baselineText, gitText(COMPANY_OPERATOR_SOURCE_BASELINE_BLOBS['src/worker.js']));\n",
          "baseline": "assert.throws(() => qualifyIntelSource('toString', ''), /Unknown Intel source/);\nassert.match(INTEL_SOURCE_TRANSFER.scope, /separate current-source native proof/);\nassert.match(INTEL_SOURCE_TRANSFER.scope, /no historical runtime, native, deployment or financial qualification/);\nconst operatorWorker = companyWorkflowSourceBaseline('src/worker.js', fs.readFileSync('src/worker.js', 'utf8'));\nconst operatorTransfer = qualifyIntelSource('src/worker.js', operatorWorker);\nassert.equal(operatorTransfer.actualSha256, COMPANY_OPERATOR_SOURCE_CURRENT_PINS['src/worker.js']);\nassert.equal(operatorTransfer.companyOperatorSourceTransfer.baselineText, gitText(COMPANY_OPERATOR_SOURCE_BASELINE_BLOBS['src/worker.js']));\n"
        }
      ]
    },
    "test/rc1-invoice-source-compatibility.js": {
      "current": {
        "mode": "100644",
        "blob": "1439d353b1d2a1fb997a627f03cd237331d0b484",
        "sha256": "092b7519eab69237c307d51b3af5f0ee88e39132515707204ee796a20132ce99",
        "bytes": 9531
      },
      "baseline": {
        "mode": "100644",
        "blob": "b60f53c439f2a1ce12e027d6494c9179f9de54d5",
        "sha256": "308786781760b9b6f6f8d0596ba21e98fb2864c6a90854a7ad307bf071238de2",
        "bytes": 9197
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { questingHistoricalInput } from '../tools/questing-source-transfer.js';\nimport { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {hasCommerceCurrentEnterpriseSource,commerceOverCurrentEnterpriseSourceBaseline} from \"../tools/commerce-current-enterprise-source-compatibility.js\";\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\n",
          "baseline": "import { continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';\nimport {hasCommerceCurrentEnterpriseSource,commerceOverCurrentEnterpriseSourceBaseline} from \"../tools/commerce-current-enterprise-source-compatibility.js\";\nimport {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';\n"
        },
        {
          "at": 8007,
          "current": "  assert.throws(() => qualifyInvoiceSource(file, text.replace(before, after)), /source changed/); negatives++;\n}\nassert.throws(() => qualifyInvoiceSource('src/worker.js', ''), /Unknown Invoice source/);\nconst workerInput = fs.readFileSync('src/worker.js', 'utf8');\nconst unreviewedWorker = workerInput + '\\n// unreviewed worker change\\n';\nassert.equal(questingHistoricalInput('src/worker.js', unreviewedWorker), unreviewedWorker); negatives++;\nconst worker = companyOperatorSourceBaseline('src/worker.js', normalize(questingHistoricalInput('src/worker.js', workerInput)));\nassert.equal(worker, gitText(INVOICE_SOURCE_PREDECESSOR_REVISION + ':src/worker.js'));\nassert.equal(worker, gitText(INVOICE_SOURCE_REVIEWED_REVISION + ':src/worker.js'));\nassert.equal(qualifyIntelSource('src/worker.js', worker).baselineText.length > 0, true);\n",
          "baseline": "  assert.throws(() => qualifyInvoiceSource(file, text.replace(before, after)), /source changed/); negatives++;\n}\nassert.throws(() => qualifyInvoiceSource('src/worker.js', ''), /Unknown Invoice source/);\nconst worker = companyOperatorSourceBaseline('src/worker.js', normalize(fs.readFileSync('src/worker.js', 'utf8')));\nassert.equal(worker, gitText(INVOICE_SOURCE_PREDECESSOR_REVISION + ':src/worker.js'));\nassert.equal(worker, gitText(INVOICE_SOURCE_REVIEWED_REVISION + ':src/worker.js'));\nassert.equal(qualifyIntelSource('src/worker.js', worker).baselineText.length > 0, true);\n"
        }
      ]
    },
    "test/routes.js": {
      "current": {
        "mode": "100644",
        "blob": "159f3f7b79dbd45feb97344cbf8ac34befc662a0",
        "sha256": "eb2c69365c643c98f835a7dac1212fd06bc7e83638e949b0087ab34cf0f9b2a2",
        "bytes": 43346
      },
      "baseline": {
        "mode": "100644",
        "blob": "bfb75827c7eaf8e20c2ba4c2b1c03da06331a775",
        "sha256": "d59a3c8b0f2ea124726231568978312e1552fb343d2fc86f0df1965876ce4c62",
        "bytes": 42288
      },
      "inverses": [
        {
          "at": 9155,
          "current": "    + 'spend comes back to the desk to be sold again is entitled to read the shelf and the sink list',\n  'GET /v1/deeds/plate/:tokenId': 'STREET DEEDS — the on-chain deed\\'s block-plate SVG, the ERC-721 tokenURI image a marketplace/crawler fetches with no token; the untrusted street name is escaped (the /v1/art precedent)',\n  'POST /v1/auth/guest': 'an auth entry point — there is no token to present yet',\n  'POST /v1/auth/agent': 'permanent agent admission issues the first bearer without a human age check',\n  'POST /v1/age-check': 'checks eligibility without saving a birth date before account creation',\n  'POST /v1/access/redeem': 'launch admission authenticates an unused invite and a durable bootstrap credential before creating or recovering an account',\n  'POST /v1/access/logout': 'clears only the caller browser view cookie and grants no account or gameplay authority',\n",
          "baseline": "    + 'spend comes back to the desk to be sold again is entitled to read the shelf and the sink list',\n  'GET /v1/deeds/plate/:tokenId': 'STREET DEEDS — the on-chain deed\\'s block-plate SVG, the ERC-721 tokenURI image a marketplace/crawler fetches with no token; the untrusted street name is escaped (the /v1/art precedent)',\n  'POST /v1/auth/guest': 'an auth entry point — there is no token to present yet',\n  'POST /v1/age-check': 'checks eligibility without saving a birth date before account creation',\n  'POST /v1/access/redeem': 'launch admission authenticates an unused invite and a durable bootstrap credential before creating or recovering an account',\n  'POST /v1/access/logout': 'clears only the caller browser view cookie and grants no account or gameplay authority',\n"
        },
        {
          "at": 33835,
          "current": "//\n//   • text compresses when the client asks, and MATERIALLY (a hook that ran and saved nothing would\n//     read exactly like a hook that works)\n//   • identity preserves the reviewed markup; the game program transfers separately on entry\n//   • the gzip DECODES to the same bytes. A corrupt stream is the worst failure here: the page is\n//     blank and nothing 500s.\n//   • Vary: Accept-Encoding on BOTH branches, or a shared cache hands the compressed copy to a\n",
          "baseline": "//\n//   • text compresses when the client asks, and MATERIALLY (a hook that ran and saved nothing would\n//     read exactly like a hook that works)\n//   • identity is honoured, byte-for-byte against the file on disk — a client that cannot decode\n//     gzip must get the real thing, not a corrupted one\n//   • the gzip DECODES to the same bytes. A corrupt stream is the worst failure here: the page is\n//     blank and nothing 500s.\n//   • Vary: Accept-Encoding on BOTH branches, or a shared cache hands the compressed copy to a\n"
        },
        {
          "at": 34768,
          "current": "  const GZ = { 'accept-encoding': 'gzip' };\n  const ID = { 'accept-encoding': 'identity' };\n  const get = (url, headers) => app.inject({ method: 'GET', url, headers });\n  const bodyOf = value => { const text = String(value).replaceAll('\\r\\n', '\\n'); return text.slice(text.indexOf('</head>') + 7); };\n  for (const name of ['defi', 'fee-flows', 'genesis-deploy']) {\n    const expected = readFileSync(new URL('../public/' + name + '.html', import.meta.url));\n    for (const path of ['/' + name, '/' + name + '.html']) {\n      const page = await get(path, ID);\n      assert.equal(page.statusCode, 200, 'Public crypto page must be reachable: ' + path);\n      assert.ok(bodyOf(page.body) === bodyOf(expected), 'Published page body must match reviewed copy after metadata enhancement: ' + path);\n    }\n  }\n  for (const name of ['genesis-deploy-client.js', 'genesis-deploy-artifact.js',\n",
          "baseline": "  const GZ = { 'accept-encoding': 'gzip' };\n  const ID = { 'accept-encoding': 'identity' };\n  const get = (url, headers) => app.inject({ method: 'GET', url, headers });\n  for (const name of ['defi', 'fee-flows', 'genesis-deploy']) {\n    const expected = readFileSync(new URL('../public/' + name + '.html', import.meta.url));\n    for (const path of ['/' + name, '/' + name + '.html']) {\n      const page = await get(path, ID);\n      assert.equal(page.statusCode, 200, 'Public crypto page must be reachable: ' + path);\n      assert.deepEqual(page.rawPayload, expected, 'Published page must match reviewed copy: ' + path);\n    }\n  }\n  for (const name of ['genesis-deploy-client.js', 'genesis-deploy-artifact.js',\n"
        },
        {
          "at": 36428,
          "current": "  assert.equal(id.headers['content-encoding'], undefined, 'GET / must NOT compress for a client that asked for identity');\n  // non-vacuity: a 1 MB shell that gzipped to 999 KB would satisfy \"it compressed\" and save nothing\n  assert(raw.length > 200_000, `the shell is ${raw.length} bytes — this check is sized for the real one`);\n  assert(gz.rawPayload.length < raw.length * 0.2,\n    `GET / compressed to ${gz.rawPayload.length} of ${raw.length} — the hook ran but saved almost nothing`);\n  const source = raw.toString('utf8').replaceAll('\\r\\n', '\\n');\n  const authoredMarkup = bodyOf(source).split('<script src=\"/eth-staking.js')[0];\n  const publicMarkup = bodyOf(id.body).replace(/<p id=\"client-load-failure\"[\\s\\S]*?<\\/p>/, '')\n    .replace('id=\"screen-auth\" class=\"landing\"', 'id=\"screen-auth\" class=\"landing hidden\"');\n  assert.ok(publicMarkup.startsWith(authoredMarkup), 'Reviewed public and game markup remains intact before the deferred transport.');\n  const loaderUrl = id.body.match(/<script src=\"(\\/landing-loader\\.js\\?v=[a-f0-9]+)\"/)[1];\n  const loader = await get(loaderUrl, ID);\n  const runtimeUrl = JSON.parse(loader.body.match(/const CONFIG = (\\{[^\\n]+\\});/)[1]).runtime;\n  const runtime = await get(runtimeUrl, ID);\n  assert.equal(runtime.body, source.match(/<script>\\n(\\(\\(\\) => \\{[\\s\\S]*?)\\n<\\/script>\\s*<\\/body>/)[1],\n    'The deferred program must be exactly the reviewed canonical game source.');\n  assert.deepEqual(zlib.gunzipSync(gz.rawPayload), id.rawPayload,\n    'the gzipped shell must DECODE to the identity response — a corrupt stream is a blank page and no 500');\n  for (const [name, r] of [['gzip', gz], ['identity', id]])\n    assert(/accept-encoding/i.test(String(r.headers.vary || '')),\n      `the ${name} branch must send Vary: Accept-Encoding, or a shared cache serves the wrong copy`);\n",
          "baseline": "  assert.equal(id.headers['content-encoding'], undefined, 'GET / must NOT compress for a client that asked for identity');\n  // non-vacuity: a 1 MB shell that gzipped to 999 KB would satisfy \"it compressed\" and save nothing\n  assert(raw.length > 200_000, `the shell is ${raw.length} bytes — this check is sized for the real one`);\n  assert(gz.rawPayload.length < raw.length * 0.6,\n    `GET / compressed to ${gz.rawPayload.length} of ${raw.length} — the hook ran but saved almost nothing`);\n  assert.equal(id.rawPayload.length, raw.length, 'the identity branch must be the file on disk, byte for byte');\n  assert.deepEqual(zlib.gunzipSync(gz.rawPayload), raw,\n    'the gzipped shell must DECODE to the file — a corrupt stream is a blank page and no 500');\n  for (const [name, r] of [['gzip', gz], ['identity', id]])\n    assert(/accept-encoding/i.test(String(r.headers.vary || '')),\n      `the ${name} branch must send Vary: Accept-Encoding, or a shared cache serves the wrong copy`);\n"
        },
        {
          "at": 41868,
          "current": "    'a sub-threshold payload must be left alone — gzip framing can make it bigger');\n\n  console.log(`✅ the wire: the ${(raw.length / 1024).toFixed(0)} KB shell ships as ${(gz.rawPayload.length / 1024).toFixed(0)} KB and `\n    + `revalidates to a 304; deferred runtime is byte-exact; binary and sub-threshold payloads are untouched`);\n}\n\nawait app.close();\n",
          "baseline": "    'a sub-threshold payload must be left alone — gzip framing can make it bigger');\n\n  console.log(`✅ the wire: the ${(raw.length / 1024).toFixed(0)} KB shell ships as ${(gz.rawPayload.length / 1024).toFixed(0)} KB and `\n    + `revalidates to a 304; identity is byte-exact; binary and sub-threshold payloads are untouched`);\n}\n\nawait app.close();\n"
        }
      ]
    },
    "test/worldgraph-api.js": {
      "current": {
        "mode": "100644",
        "blob": "4f65aa5c6aadfa66181f101699971d879f9ce038",
        "sha256": "5959f8cecbfc1393cae70b3fceafdfbb9c58a4d6b090a6040ac8bc0bfa2337a5",
        "bytes": 56136
      },
      "baseline": {
        "mode": "100644",
        "blob": "de8df06e3b5e0f8f80bc81a9eca8389dac7f5ff1",
        "sha256": "7ba73558f4e1877c261ddb58b97bfa9b258bc4897c6bc5f390fa8c4eea5d02a0",
        "bytes": 56136
      },
      "inverses": [
        {
          "at": 10812,
          "current": "\nconst liveSpec = await call('GET', '/openapi.json');\nassert.equal(liveSpec.code, 200);\nassert.equal(liveSpec.body.info.version, '1.6.0');\nassert(liveSpec.body.paths['/v1/worldgraph/operations/{operationId}/role']?.get,\n  'the mounted server publishes the role-private board in its live OpenAPI document');\nfor (const [method, rawPath] of routeTable) {\n",
          "baseline": "\nconst liveSpec = await call('GET', '/openapi.json');\nassert.equal(liveSpec.code, 200);\nassert.equal(liveSpec.body.info.version, '1.5.1');\nassert(liveSpec.body.paths['/v1/worldgraph/operations/{operationId}/role']?.get,\n  'the mounted server publishes the role-private board in its live OpenAPI document');\nfor (const [method, rawPath] of routeTable) {\n"
        }
      ]
    },
    "tools/agent-alpha.js": {
      "current": {
        "mode": "100644",
        "blob": "8312f8ba957922bd22e482512e407fcb4fb80d1a",
        "sha256": "8fee824901abe08d13d61a721f51dab66926770d670926ee3c3d93153f7b6c26",
        "bytes": 50955
      },
      "baseline": {
        "mode": "100644",
        "blob": "3373122c4ded47a1c36030ae1a703a16f59e7ca7",
        "sha256": "8d81b506696173916d44d83db5fdafdee21cb635b08a30dcd2d80afc4d57bbfa",
        "bytes": 45435
      },
      "inverses": [
        {
          "at": 20,
          "current": "// A finite, conservative Agent Turn client. Identity state is deliberately local and reports are\n// deliberately lossy: the session owns the bearer token while telemetry owns no sensitive values.\nimport crypto from 'node:crypto';\nimport { execFile, spawn } from 'node:child_process';\nimport { AsyncLocalStorage } from 'node:async_hooks';\nimport { constants as fsConstants } from 'node:fs';\nimport { lstat, mkdir, open, readFile, realpath, rename, stat, unlink } from 'node:fs/promises';\nimport { createServer } from 'node:net';\n",
          "baseline": "// A finite, conservative Agent Turn client. Identity state is deliberately local and reports are\n// deliberately lossy: the session owns the bearer token while telemetry owns no sensitive values.\nimport crypto from 'node:crypto';\nimport { execFile } from 'node:child_process';\nimport { constants as fsConstants } from 'node:fs';\nimport { lstat, mkdir, open, readFile, realpath, rename, stat, unlink } from 'node:fs/promises';\nimport { createServer } from 'node:net';\n"
        },
        {
          "at": 1458,
          "current": "]);\nconst ACTION_ROLES = {\n  general: ALLOWED_KINDS,\n  progression: new Set(['crime', 'onboard_claim', 'daily_claim', 'career_claim']),\n  business: new Set(['depot_restock', 'depot_receive', 'depot_travel', 'business_buy', 'business_upkeep', 'business_upgrade', 'business_collect']),\n  supplier: new Set(['delivery_accept', 'delivery_buy', 'delivery_depot_buy', 'delivery_travel', 'delivery_deliver', 'market_fill']),\n};\n\nconst defaultSleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));\nconst execFileAsync = promisify(execFile);\nconst windowsSecurityContext = new AsyncLocalStorage();\n\nconst WINDOWS_ACL_CHECK = `\n  $ErrorActionPreference = 'Stop'\n",
          "baseline": "]);\nconst ACTION_ROLES = {\n  general: ALLOWED_KINDS,\n  business: new Set(['depot_restock', 'depot_receive', 'depot_travel', 'business_buy', 'business_upkeep', 'business_upgrade', 'business_collect']),\n  supplier: new Set(['delivery_accept', 'delivery_buy', 'delivery_depot_buy', 'delivery_travel', 'delivery_deliver', 'market_fill']),\n};\n\nconst defaultSleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));\nconst execFileAsync = promisify(execFile);\n\nconst WINDOWS_ACL_CHECK = `\n  $ErrorActionPreference = 'Stop'\n"
        },
        {
          "at": 5066,
          "current": "}\n\nasync function runWindowsSecurityScript(script, path, kind) {\n  const context = windowsSecurityContext.getStore();\n  if (context) {\n    context.worker ||= windowsSecurityWorker();\n    return context.worker.check(script === WINDOWS_ACL_CHECK ? 'check' : 'create', path, kind);\n  }\n  await execFileAsync(windowsPowerShell(), [\n    '-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script,\n  ], {\n",
          "baseline": "}\n\nasync function runWindowsSecurityScript(script, path, kind) {\n  await execFileAsync(windowsPowerShell(), [\n    '-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script,\n  ], {\n"
        },
        {
          "at": 5645,
          "current": "  });\n}\n\n// Keep the existing ACL and private-file checks, but avoid starting PowerShell for every check.\n// Only operation names and paths cross this pipe; bearer/session bytes remain in the Node process.\n// The worker is scoped to one finite invocation and closes with it, including on failed checks.\nfunction windowsSecurityWorker() {\n  const script = `\n    [Console]::InputEncoding = [System.Text.Encoding]::UTF8\n    $check = { ${WINDOWS_ACL_CHECK} }\n    $create = { ${WINDOWS_CREATE_PRIVATE_FILE} }\n    while ($null -ne ($line = [Console]::ReadLine())) {\n      try {\n        $request = ConvertFrom-Json $line\n        $env:OMERTA_ALPHA_ACL_TARGET = $request.path\n        $env:OMERTA_ALPHA_ACL_KIND = $request.kind\n        if ($request.operation -eq 'check') { & $check }\n        elseif ($request.operation -eq 'create') { & $create }\n        else { throw 'Unknown security operation' }\n        [Console]::WriteLine('ok')\n      } catch { [Console]::WriteLine('error') }\n      [Console]::Out.Flush()\n    }\n  `;\n  const child = spawn(windowsPowerShell(), [\n    '-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script,\n  ], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });\n  const pending = [];\n  let buffer = '';\n  let failure;\n  let closed = false;\n  const fail = () => {\n    failure ||= new Error('Agent Alpha Windows security check failed');\n    for (const item of pending.splice(0)) { clearTimeout(item.timer); item.reject(failure); }\n  };\n  const exit = new Promise((resolveExit) => {\n    child.once('error', () => { fail(); resolveExit(); });\n    child.once('exit', () => { closed = true; fail(); resolveExit(); });\n  });\n  child.stdin.on('error', fail);\n  child.stdout.on('data', (chunk) => {\n    buffer += chunk.toString('utf8');\n    for (let end; (end = buffer.indexOf('\\n')) >= 0;) {\n      const line = buffer.slice(0, end).trim();\n      buffer = buffer.slice(end + 1);\n      const item = pending.shift();\n      if (!item) { fail(); child.kill(); return; }\n      clearTimeout(item.timer);\n      if (line === 'ok') item.resolve();\n      else item.reject(new Error('Agent Alpha Windows security check failed'));\n    }\n  });\n  return {\n    check(operation, path, kind) {\n      if (failure) return Promise.reject(failure);\n      return new Promise((resolveCheck, reject) => {\n        const timer = setTimeout(() => { fail(); child.kill(); }, 10000);\n        pending.push({ resolve: resolveCheck, reject, timer });\n        child.stdin.write(`${JSON.stringify({ operation, path, kind })}\\n`);\n      });\n    },\n    async close() {\n      if (!closed) child.stdin.end();\n      await exit;\n    },\n  };\n}\n\nasync function assertWindowsPrivateAcl(path, kind) {\n  try {\n    await runWindowsSecurityScript(WINDOWS_ACL_CHECK, path, kind);\n",
          "baseline": "  });\n}\n\nasync function assertWindowsPrivateAcl(path, kind) {\n  try {\n    await runWindowsSecurityScript(WINDOWS_ACL_CHECK, path, kind);\n"
        },
        {
          "at": 17167,
          "current": "    ...(body === undefined ? {} : { 'content-type': 'application/json' }),\n    ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),\n  };\n  const request = {\n    method,\n    headers,\n    redirect: 'manual',\n    ...(body === undefined ? {} : { body: JSON.stringify(body) }),\n  };\n  for (let retries = 0; ; retries += 1) {\n    const response = await fetchImpl(`${base}${path}`, request);\n    if (response.redirected || (response.status >= 300 && response.status < 400)) {\n      throw new Error('Agent Alpha API redirects are forbidden by origin binding');\n    }\n    if (response.url && originOf(response.url) !== base) {\n      throw new Error('Agent Alpha response escaped its bound origin');\n    }\n    let payload = null;\n    try { payload = await response.json(); }\n    catch { throw new Error(`Agent Alpha received non-JSON response (${response.status})`); }\n    const timing = windowsSecurityContext.getStore()?.timing;\n    const retryAfter = Number(payload?.retryAfter ?? response.headers.get('retry-after'));\n    if (path !== '/v1/agent/act' && response.status === 429 && payload?.error === 'rate_limited' && retries < 2 &&\n        timing && Number.isFinite(retryAfter) && retryAfter > 0 && retryAfter <= 60) {\n      // A definitive pre-handler refusal is safe to retry with the exact same body/key.\n      await waitForCadence(timing, Math.min(60000, retryAfter * 1000 + 100));\n      continue;\n    }\n    if (!response.ok) {\n      const error = new Error(`Agent Alpha request failed (${response.status})`);\n      error.status = response.status;\n      error.code = typeof payload?.error === 'string' ? payload.error : 'http_error';\n      error.payload = payload;\n      throw error;\n    }\n    return payload;\n  }\n}\n\nfunction validName(name) {\n",
          "baseline": "    ...(body === undefined ? {} : { 'content-type': 'application/json' }),\n    ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),\n  };\n  const response = await fetchImpl(`${base}${path}`, {\n    method,\n    headers,\n    redirect: 'manual',\n    ...(body === undefined ? {} : { body: JSON.stringify(body) }),\n  });\n  if (response.redirected || (response.status >= 300 && response.status < 400)) {\n    throw new Error('Agent Alpha API redirects are forbidden by origin binding');\n  }\n  if (response.url && originOf(response.url) !== base) {\n    throw new Error('Agent Alpha response escaped its bound origin');\n  }\n  let payload = null;\n  try { payload = await response.json(); }\n  catch { throw new Error(`Agent Alpha received non-JSON response (${response.status})`); }\n  if (!response.ok) {\n    const error = new Error(`Agent Alpha request failed (${response.status})`);\n    error.status = response.status;\n    error.code = typeof payload?.error === 'string' ? payload.error : 'http_error';\n    error.payload = payload;\n    throw error;\n  }\n  return payload;\n}\n\nfunction validName(name) {\n"
        },
        {
          "at": 23922,
          "current": "    typeof session.pending.actionId === 'string' && session.pending.actionId &&\n    typeof session.pending.startedAt === 'string' && session.pending.startedAt\n  );\n  const bootstrapKeys = [\n    'version', 'base', 'phase', 'bootstrapSecret', 'inviteCode', 'characterName', 'pending',\n  ];\n  const bootstrapValid = session?.phase === 'bootstrap' &&\n    ((session.bootstrapKind === 'agent' && exactKeys(session, [...bootstrapKeys, 'bootstrapKind'])) ||\n      (session.bootstrapKind === undefined && exactKeys(session, bootstrapKeys))) &&\n    validBootstrapSecret(session.bootstrapSecret) && validInviteCode(session.inviteCode) &&\n    session.pending === null;\n  const bearerValid = [\n    'guest_bootstrap_ack_pending', 'guest', 'initial_character_pending', 'agent',\n",
          "baseline": "    typeof session.pending.actionId === 'string' && session.pending.actionId &&\n    typeof session.pending.startedAt === 'string' && session.pending.startedAt\n  );\n  const bootstrapValid = session?.phase === 'bootstrap' &&\n    exactKeys(session, [\n      'version', 'base', 'phase', 'bootstrapSecret', 'inviteCode', 'characterName', 'pending',\n    ]) && validBootstrapSecret(session.bootstrapSecret) && validInviteCode(session.inviteCode) &&\n    session.pending === null;\n  const bearerValid = [\n    'guest_bootstrap_ack_pending', 'guest', 'initial_character_pending', 'agent',\n"
        },
        {
          "at": 30927,
          "current": "}\n\nasync function recoverGuestBootstrap({ base, stateStore, session, fetchImpl, birthDate }) {\n  // Older bootstrap journals retain their original recovery domain and identity.\n  const route = session.bootstrapKind === 'agent' ? '/v1/auth/agent' : '/v1/auth/guest';\n  const guest = await requestJson(fetchImpl, base, route, {\n    method: 'POST',\n    body: {\n      bootstrapSecret: session.bootstrapSecret,\n      ...(route === '/v1/auth/guest' && birthDate ? { birthDate } : {}),\n      ...(session.inviteCode === null ? {} : { inviteCode: session.inviteCode }),\n    },\n  });\n",
          "baseline": "}\n\nasync function recoverGuestBootstrap({ base, stateStore, session, fetchImpl, birthDate }) {\n  const guest = await requestJson(fetchImpl, base, '/v1/auth/guest', {\n    method: 'POST',\n    body: {\n      bootstrapSecret: session.bootstrapSecret,\n      ...(birthDate ? { birthDate } : {}),\n      ...(session.inviteCode === null ? {} : { inviteCode: session.inviteCode }),\n    },\n  });\n"
        },
        {
          "at": 32638,
          "current": "    version: SESSION_VERSION,\n    base,\n    phase: 'bootstrap',\n    bootstrapKind: 'agent',\n    bootstrapSecret: crypto.randomBytes(32).toString('base64url'),\n    inviteCode: storedInvite,\n    characterName: name,\n",
          "baseline": "    version: SESSION_VERSION,\n    base,\n    phase: 'bootstrap',\n    bootstrapSecret: crypto.randomBytes(32).toString('base64url'),\n    inviteCode: storedInvite,\n    characterName: name,\n"
        },
        {
          "at": 41822,
          "current": "\nasync function runUnlocked(options, timing) {\n  const role = options.role ?? 'general';\n  if (!Object.hasOwn(ACTION_ROLES, role)) throw new Error('Agent Alpha role must be general, progression, business or supplier');\n  const base = originOf(options.baseUrl);\n  const sessionFile = options.sessionFile;\n  const reportStore = options.reportStore;\n  const stateStore = options.stateStore;\n  const fetchImpl = options.fetchImpl || globalThis.fetch;\n  const maxActions = options.maxActions ?? 1;\n  const stopAtLevel = options.stopAtLevel;\n  if (stopAtLevel !== undefined && (!Number.isSafeInteger(stopAtLevel) || stopAtLevel < 1)) {\n    throw new Error('Agent Alpha stopAtLevel must be a positive safe integer');\n  }\n  const intervalMs = options.intervalMs ?? MIN_INTERVAL_MS;\n  if (!Number.isInteger(maxActions) || maxActions < 1 || maxActions > 50) {\n    throw new Error('Agent Alpha maxActions must be an integer from 1 to 50');\n",
          "baseline": "\nasync function runUnlocked(options, timing) {\n  const role = options.role ?? 'general';\n  if (!Object.hasOwn(ACTION_ROLES, role)) throw new Error('Agent Alpha role must be general, business or supplier');\n  const base = originOf(options.baseUrl);\n  const sessionFile = options.sessionFile;\n  const reportStore = options.reportStore;\n  const stateStore = options.stateStore;\n  const fetchImpl = options.fetchImpl || globalThis.fetch;\n  const maxActions = options.maxActions ?? 1;\n  const intervalMs = options.intervalMs ?? MIN_INTERVAL_MS;\n  if (!Number.isInteger(maxActions) || maxActions < 1 || maxActions > 50) {\n    throw new Error('Agent Alpha maxActions must be an integer from 1 to 50');\n"
        },
        {
          "at": 44443,
          "current": "    }\n  }\n  while (attempts < maxActions) {\n    if (stopAtLevel !== undefined && Number(currentTurn?.state?.identity?.level) >= stopAtLevel) {\n      return { status: 'level_reached', actions, level: Number(currentTurn.state.identity.level) };\n    }\n    // Do not spend a turn's authority window on cadence or repeated shell startup.\n    const returnedRecommendation = currentTurn && recommendationOf(currentTurn, role);\n    if (returnedRecommendation && !returnedRecommendation.action && !returnedRecommendation.errorCode) break;\n    await waitForCadence(timing, intervalMs);\n    const turn = await requestJson(fetchImpl, base, '/v1/agent/turn', { token: session.token });\n    currentTurn = null;\n    if (stopAtLevel !== undefined && Number(turn?.state?.identity?.level) >= stopAtLevel) {\n      return { status: 'level_reached', actions, level: Number(turn.state.identity.level) };\n    }\n    const recommendation = recommendationOf(turn, role);\n    const action = recommendation.action;\n    if (!action) {\n",
          "baseline": "    }\n  }\n  while (attempts < maxActions) {\n    const turn = currentTurn || await requestJson(fetchImpl, base, '/v1/agent/turn', { token: session.token });\n    currentTurn = null;\n    const recommendation = recommendationOf(turn, role);\n    const action = recommendation.action;\n    if (!action) {\n"
        },
        {
          "at": 45969,
          "current": "      }\n      break;\n    }\n    const operationId = role === 'general' ? crypto.randomUUID() : `${role}:${crypto.randomUUID()}`;\n    session = {\n      ...session,\n",
          "baseline": "      }\n      break;\n    }\n    await waitForCadence(timing, intervalMs);\n\n    const operationId = role === 'general' ? crypto.randomUUID() : `${role}:${crypto.randomUUID()}`;\n    session = {\n      ...session,\n"
        },
        {
          "at": 46986,
          "current": "    }\n  }\n\n  if (stopAtLevel !== undefined && Number(currentTurn?.state?.identity?.level) >= stopAtLevel) {\n    return { status: 'level_reached', actions, level: Number(currentTurn.state.identity.level) };\n  }\n  return { status: 'complete', actions };\n}\n\nasync function runWithSession(options, timing) {\n  if (!options.sessionFile) throw new Error('Agent Alpha requires a session file');\n  const paths = await canonicalRunnerPaths(options.sessionFile, options.reportFile);\n  paths.stateStore.credentialBoundary = timing.credentialBoundary;\n",
          "baseline": "    }\n  }\n\n  return { status: 'complete', actions };\n}\n\nasync function runWithTiming(options, timing) {\n  if (!options.sessionFile) throw new Error('Agent Alpha requires a session file');\n  const paths = await canonicalRunnerPaths(options.sessionFile, options.reportFile);\n  paths.stateStore.credentialBoundary = timing.credentialBoundary;\n"
        },
        {
          "at": 48135,
          "current": "  }\n}\n\nasync function runWithTiming(options, timing) {\n  const context = { timing };\n  return windowsSecurityContext.run(context, async () => {\n    try { return await runWithSession(options, timing); }\n    finally { await context.worker?.close(); }\n  });\n}\n\nexport async function runAgentAlpha(options = {}) {\n  return runWithTiming(options, productionTiming(options.sleep));\n}\n",
          "baseline": "  }\n}\n\nexport async function runAgentAlpha(options = {}) {\n  return runWithTiming(options, productionTiming(options.sleep));\n}\n"
        },
        {
          "at": 49677,
          "current": "    else if (arg === '--name') options.name = argv[++index];\n    else if (arg === '--birth-date') options.birthDate = argv[++index];\n    else if (arg === '--max-actions') options.maxActions = Number(argv[++index]);\n    else if (arg === '--stop-at-level') options.stopAtLevel = Number(argv[++index]);\n    else if (arg === '--session') options.sessionFile = argv[++index];\n    else if (arg === '--report') options.reportFile = argv[++index];\n    else if (arg === '--role') options.role = argv[++index];\n",
          "baseline": "    else if (arg === '--name') options.name = argv[++index];\n    else if (arg === '--birth-date') options.birthDate = argv[++index];\n    else if (arg === '--max-actions') options.maxActions = Number(argv[++index]);\n    else if (arg === '--session') options.sessionFile = argv[++index];\n    else if (arg === '--report') options.reportFile = argv[++index];\n    else if (arg === '--role') options.role = argv[++index];\n"
        }
      ]
    },
    "tools/enterprise-native-questing.js": {
      "current": {
        "mode": "100644",
        "blob": "fb73cae3dd58022310340e6e9dd90f1cc93bfb9e",
        "sha256": "5bee575459d5f422e9c0fc3ed7905edb9bd79f6291bf6c50bc60febc12e838f0",
        "bytes": 26167
      },
      "baseline": {
        "mode": "100644",
        "blob": "e98650f2bde4162d6d8ea0fdc236abf24a487ce3",
        "sha256": "45b0d8485765d0002b6d3a27262e41ef49647b93be61cfef275e73809248fc84",
        "bytes": 26140
      },
      "inverses": [
        {
          "at": 1856,
          "current": "  'test/lib/questing-ux-native-reader-source-compatibility.js',\n  'test/lib/questing-ux-director-reader-source-compatibility.js',\n  'test/lib/questing-ux-enterprise-reader-source-compatibility.js',\n  'src/casinorakeback.js',\n  'public/ux-quests.js', 'public/ux-quests.css', 'public/ux-clues.js', 'public/ux-clues.css',\n  ...['early-obituary', 'family-dinner', 'missing-name', 'three-witnesses', 'quiet-wedding',\n    'morning-after', 'inherited-file', 'archive-service', 'sixth-envelope', 'rival-accord']\n",
          "baseline": "  'test/lib/questing-ux-native-reader-source-compatibility.js',\n  'test/lib/questing-ux-director-reader-source-compatibility.js',\n  'test/lib/questing-ux-enterprise-reader-source-compatibility.js',\n  'public/ux-quests.js', 'public/ux-quests.css', 'public/ux-clues.js', 'public/ux-clues.css',\n  ...['early-obituary', 'family-dinner', 'missing-name', 'three-witnesses', 'quiet-wedding',\n    'morning-after', 'inherited-file', 'archive-service', 'sixth-envelope', 'rival-accord']\n"
        }
      ]
    },
    "tools/playthrough.js": {
      "current": {
        "mode": "100644",
        "blob": "82b2b301ae85aa8ef20b57909f0e21383a6395fe",
        "sha256": "7bf9b30682a99f61b4186b554c3a762b6df606c91e4b27c9591b01fba1d5221f",
        "bytes": 88514
      },
      "baseline": {
        "mode": "100644",
        "blob": "b2151894643a8ab498276e9aa623cd27f094d557",
        "sha256": "62340e0e8fe0413b7c5d43f98e563f2ec295a23642a43de86f3a77d290cfd2e4",
        "bytes": 88280
      },
      "inverses": [
        {
          "at": 4747,
          "current": "// Every character-scoped timestamp pulled back N minutes == the world advancing N minutes for this\n// player. Listed explicitly (not information_schema) so a new column is a deliberate decision here.\nconst CLOCK_COLS = [\n  'last_accrued_at', 'street_action_at', 'jail_until', 'hosp_until', 'gta_at', 'shoot_cd_until', 'crew_paid_at',\n  'heist_at', 'npchit_at', 'safe_until', 'wash_at', 'safehouse_at', 'rwa_at', 'respec_at',\n  'guarded_until', 'bank_intransit_at', 'retainer_until', 'witpro_until', 'world_raid_at',\n  'pen_safe_until', 'hole_until', 'shank_at', 'train_at', 'mission_at', 'wanted_until',\n",
          "baseline": "// Every character-scoped timestamp pulled back N minutes == the world advancing N minutes for this\n// player. Listed explicitly (not information_schema) so a new column is a deliberate decision here.\nconst CLOCK_COLS = [\n  'last_accrued_at', 'jail_until', 'hosp_until', 'gta_at', 'shoot_cd_until', 'crew_paid_at',\n  'heist_at', 'npchit_at', 'safe_until', 'wash_at', 'safehouse_at', 'rwa_at', 'respec_at',\n  'guarded_until', 'bank_intransit_at', 'retainer_until', 'witpro_until', 'world_raid_at',\n  'pen_safe_until', 'hole_until', 'shank_at', 'train_at', 'mission_at', 'wanted_until',\n"
        },
        {
          "at": 15034,
          "current": "// and there is nothing to assert against without playing. So: count the minutes each distinct rung\n// holds, and fail if any one of them holds most of the run.\nconst coachMin = new Map();       // label -> minutes it was the top rung\nconst coachPostObeyMin = new Map(); // minutes still advised after obedience\nconst coachPlanDepth = [];        // how many steps the plan box offered, per tick\nlet coachSilent = 0;              // minutes with no advice at all (a vet, correctly)\nconst coachObeyed = new Set();    // rungs the harness successfully DID what was asked\n",
          "baseline": "// and there is nothing to assert against without playing. So: count the minutes each distinct rung\n// holds, and fail if any one of them holds most of the run.\nconst coachMin = new Map();       // label -> minutes it was the top rung\nconst coachPlanDepth = [];        // how many steps the plan box offered, per tick\nlet coachSilent = 0;              // minutes with no advice at all (a vet, correctly)\nconst coachObeyed = new Set();    // rungs the harness successfully DID what was asked\n"
        },
        {
          "at": 16400,
          "current": "  const label = m.coach?.label;\n  if (!label) { coachSilent++; return; }\n  coachMin.set(label, (coachMin.get(label) || 0) + 1);\n  if (coachObeyed.has(label)) coachPostObeyMin.set(label, (coachPostObeyMin.get(label) || 0) + 1);\n  if (!rungFirst.has(label)) rungFirst.set(label, { at: playedMin, worth: m.cash + m.bank, level: m.level });\n  if (Array.isArray(m.coachPlan)) coachPlanDepth.push(m.coachPlan.length);\n}\n",
          "baseline": "  const label = m.coach?.label;\n  if (!label) { coachSilent++; return; }\n  coachMin.set(label, (coachMin.get(label) || 0) + 1);\n  if (!rungFirst.has(label)) rungFirst.set(label, { at: playedMin, worth: m.cash + m.bank, level: m.level });\n  if (Array.isArray(m.coachPlan)) coachPlanDepth.push(m.coachPlan.length);\n}\n"
        },
        {
          "at": 32941,
          "current": "    // (\"find them on the Wet Work roster and JUMP them\") — and it has to be the named one, because\n    // settleFirstBlood clears the stage only for that character. Jumping a stranger would look like\n    // obedience, do nothing to the rung, and hide the very failure this handler exists to expose.\n    const named = String(m.coach?.hint || '').split(' has been talking you down on the street.')[0].trim();\n    const roster = await call('GET', '/v1/streets', { token });\n    const list = roster.body?.streets || roster.body?.here || (Array.isArray(roster.body) ? roster.body : []);\n    const mark = named ? list.find((x) => x.name === named) : null;\n",
          "baseline": "    // (\"find them on the Wet Work roster and JUMP them\") — and it has to be the named one, because\n    // settleFirstBlood clears the stage only for that character. Jumping a stranger would look like\n    // obedience, do nothing to the rung, and hide the very failure this handler exists to expose.\n    const named = String(m.coach?.hint || '').split(' put the word out')[0].trim();\n    const roster = await call('GET', '/v1/streets', { token });\n    const list = roster.body?.streets || roster.body?.here || (Array.isArray(roster.body) ? roster.body : []);\n    const mark = named ? list.find((x) => x.name === named) : null;\n"
        },
        {
          "at": 80827,
          "current": "  // perfectly healthy rung as a defect on its first run.\n  const PIN_PCT = 40;   // an obeyed rung should clear within a few ticks; 40% of a multi-day run is\n                        // far past \"the player is on their way there\" and squarely at \"it never went away\"\n  const pinned = [...coachPostObeyMin].filter(([label, mins]) =>\n    coachObeyed.has(label) && totalAdvised && (mins / totalAdvised) * 100 > PIN_PCT);\n  if (pinned.length) {\n    coachVerdict = `PINNED — \"${pinned[0][0]}\" held ${Math.round(pinned[0][1] / totalAdvised * 100)}%`\n",
          "baseline": "  // perfectly healthy rung as a defect on its first run.\n  const PIN_PCT = 40;   // an obeyed rung should clear within a few ticks; 40% of a multi-day run is\n                        // far past \"the player is on their way there\" and squarely at \"it never went away\"\n  const pinned = advised.filter(([label, mins]) =>\n    coachObeyed.has(label) && totalAdvised && (mins / totalAdvised) * 100 > PIN_PCT);\n  if (pinned.length) {\n    coachVerdict = `PINNED — \"${pinned[0][0]}\" held ${Math.round(pinned[0][1] / totalAdvised * 100)}%`\n"
        }
      ]
    },
    "tools/questing-enterprise-catalog.js": {
      "current": {
        "mode": "100644",
        "blob": "f1e7713e990c0b06ebba84f9f34692d2d334277e",
        "sha256": "15b4476298609a8e8ec663dcb9c3c0d59829e8d04a25e5681a081561b9978cca",
        "bytes": 27997
      },
      "baseline": {
        "mode": "100644",
        "blob": "1b806dfe1de5db15ce53d51b7a42ad750e48a569",
        "sha256": "feec8aa2a5db0ca40c3232b99728ea72bb04a4bae094b881d20bf0613c618fd1",
        "bytes": 19754
      },
      "inverses": [
        {
          "at": 1052,
          "current": "  assert(!value.includes('\\r') && (input === value || input === value.replaceAll('\\n', '\\r\\n')), 'Whole LF or uniform checkout CRLF only');\n  return value;\n};\nexport const QUESTING_CATALOG_SOURCE = freeze({ file: 'schema.sql', mode: '100755', blob: '86b671c5d6f6928ff3e66f1ad0fca5f46a7364e3',\n  sha256: '659235a1735d24dbebc5f9b4dfcff8a58ed766a27fd3ae32fc6c6d2ec77006dc' });\nexport const QUESTING_CATALOG_ARCHIVED_SOURCE = freeze({ blob: '7a254a435c95a93cc5d8419b453988b0df30b5c1',\n  sha256: 'af6d9ad01566eaddf8ec6b4c4da4add77837b13e6a3510697bebf62b180b97e7' });\nexport const QUESTING_CATALOG_BASELINE = freeze({ revision: '17fdf85fdd21fd3767463df8ba47614f7d1f6432', file: 'schema.sql',\n  blob: '9795c322aed438cb3011bf16b83bc399af6200d5', sha256: '9f272bef0d8a6ebb22d94654a7e3daa2f2e2c0f2fe94a3b429973c3923cca976' });\n",
          "baseline": "  assert(!value.includes('\\r') && (input === value || input === value.replaceAll('\\n', '\\r\\n')), 'Whole LF or uniform checkout CRLF only');\n  return value;\n};\nexport const QUESTING_CATALOG_SOURCE = freeze({ file: 'schema.sql', mode: '100755', blob: '7a254a435c95a93cc5d8419b453988b0df30b5c1',\n  sha256: 'af6d9ad01566eaddf8ec6b4c4da4add77837b13e6a3510697bebf62b180b97e7' });\nexport const QUESTING_CATALOG_BASELINE = freeze({ revision: '17fdf85fdd21fd3767463df8ba47614f7d1f6432', file: 'schema.sql',\n  blob: '9795c322aed438cb3011bf16b83bc399af6200d5', sha256: '9f272bef0d8a6ebb22d94654a7e3daa2f2e2c0f2fe94a3b429973c3923cca976' });\n"
        },
        {
          "at": 4388,
          "current": "  assert.equal(gitBlob(current), QUESTING_CATALOG_SOURCE.blob); assert.equal((current.match(/^CREATE TABLE IF NOT EXISTS /gm) || []).length, 585);\n  const baseline = git('show', `${QUESTING_CATALOG_BASELINE.revision}:schema.sql`).toString('utf8');\n  assert.equal(sha(baseline), QUESTING_CATALOG_BASELINE.sha256); assert.equal(gitBlob(baseline), QUESTING_CATALOG_BASELINE.blob);\n  const archived = git('cat-file', 'blob', QUESTING_CATALOG_ARCHIVED_SOURCE.blob).toString('utf8');\n  assert.equal(sha(archived), QUESTING_CATALOG_ARCHIVED_SOURCE.sha256); assert.equal(gitBlob(archived), QUESTING_CATALOG_ARCHIVED_SOURCE.blob);\n  assert(archived.startsWith(baseline), 'Archived585 retains the complete independently pinned582 prefix');\n  const addition = archived.slice(baseline.length);\n  assert.deepEqual([...addition.matchAll(/^CREATE TABLE IF NOT EXISTS (\\w+) /gm)].map(row => row[1]), QUESTING_CATALOG_TABLES);\n  assert(!/\\b(?:ALTER|DROP|UPDATE|DELETE|INSERT)\\b/i.test(addition), 'Exactly three additive tables and their indexes');\n  // Only the two reviewed literal edits introduce the four casino accounting fields. The quest\n  // suffix and archived source stay exact; CREATE IF NOT EXISTS is not an old-casino migration.\n  const cursor = '  rake_cursor NUMERIC NOT NULL DEFAULT 0,           -- Den step 2: den volume already rakeback-claimed (casino kind only)\\n';\n  const volume = '  distributed NUMERIC NOT NULL DEFAULT 0\\n';\n  let currentBaseline = baseline;\n  for (const [before, after] of [[cursor, cursor + '  rake_index_cursor TEXT,                          -- exact rational claimed rakeback index; NULL identifies legacy volume cursors\\n'],\n    [volume, '  distributed NUMERIC NOT NULL DEFAULT 0,\\n  rake_index TEXT NOT NULL DEFAULT \\'0\\',            -- exact per-owner cash entitlement, serialized numerator/denominator\\n  rake_checkpoint_volume NUMERIC,                  -- NULL until legacy claims are snapshotted before an ownership change\\n  rake_legacy_owners INT NOT NULL DEFAULT 0\\n']]) {\n    assert.equal(currentBaseline.split(before).length, 2, 'Unique complete reviewed casino DDL context');\n    currentBaseline = currentBaseline.replace(before, after);\n  }\n  assert.equal(sha(currentBaseline), '9d664391bd9b6a774f2ce934dd5821bcc7f323cc84e5a9c4dd02d357500829f5');\n  assert.equal(gitBlob(currentBaseline), 'ae53d28222559260e80ea68abafe7c429f214ff9');\n  assert.equal(current, currentBaseline + addition, 'Only four reviewed fields differ; all three quest tables remain exact');\n  return freeze({ current, baseline: currentBaseline, archivedBaseline: baseline, archived, addition, actualTables: 585, baselineTables: 582 });\n}\nfunction validateAdded(metadata, version) {\n  assert(version === 16 || version === 18); const added = field => metadata[field].filter(row => tables.has(field === 'relations' ? row.name : row.table_name));\n",
          "baseline": "  assert.equal(gitBlob(current), QUESTING_CATALOG_SOURCE.blob); assert.equal((current.match(/^CREATE TABLE IF NOT EXISTS /gm) || []).length, 585);\n  const baseline = git('show', `${QUESTING_CATALOG_BASELINE.revision}:schema.sql`).toString('utf8');\n  assert.equal(sha(baseline), QUESTING_CATALOG_BASELINE.sha256); assert.equal(gitBlob(baseline), QUESTING_CATALOG_BASELINE.blob);\n  assert(current.startsWith(baseline), 'Actual585 retains the complete independently pinned582 prefix');\n  const addition = current.slice(baseline.length);\n  assert.deepEqual([...addition.matchAll(/^CREATE TABLE IF NOT EXISTS (\\w+) /gm)].map(row => row[1]), QUESTING_CATALOG_TABLES);\n  assert(!/\\b(?:ALTER|DROP|UPDATE|DELETE|INSERT)\\b/i.test(addition), 'Exactly three additive tables and their indexes');\n  return freeze({ current, baseline, addition, actualTables: 585, baselineTables: 582 });\n}\nfunction validateAdded(metadata, version) {\n  assert(version === 16 || version === 18); const added = field => metadata[field].filter(row => tables.has(field === 'relations' ? row.name : row.table_name));\n"
        },
        {
          "at": 10479,
          "current": "  }\n}\nexport { validateAdded as verifyQuestingCatalogTables };\nconst casinoColumns = new Set(['businesses.rake_index_cursor', 'den_volume.rake_index', 'den_volume.rake_checkpoint_volume', 'den_volume.rake_legacy_owners']);\nconst casinoNames = new Set(['den_volume_rake_index_not_null', 'den_volume_rake_legacy_owners_not_null']);\nfunction casinoExpected(version, profile, flags) {\n  assert(version === 16 || version === 18); assert(['fresh', 'phase2', 'director'].includes(profile)); assert.equal(typeof flags, 'boolean');\n  const column = (table, name, ordinal, type, notNull, value) => ({ table_name: table, column_name: name, ordinal, type, typmod: -1,\n    default_expression: value, not_null: notNull, identity: '', generated: '', collation_schema: type === 'text' ? 'pg_catalog' : null,\n    collation_name: type === 'text' ? 'default' : null });\n  const offset = profile === 'fresh' ? 0 : 1;\n  const columns = [column('businesses', 'rake_index_cursor', profile === 'fresh' ? 13 : 18, 'text', false, null),\n    column('den_volume', 'rake_index', 5 + offset, 'text', true, \"'0'::text\"),\n    column('den_volume', 'rake_checkpoint_volume', 6 + offset, 'numeric', false, null),\n    column('den_volume', 'rake_legacy_owners', 7 + offset, 'integer', true, '0')];\n  const constraints = version === 18 ? ['rake_index', 'rake_legacy_owners'].map(name => ({ table_name: 'den_volume',\n    name: 'den_volume_' + name + '_not_null', type: 'n', validated: true, deferrable: false, deferred: false,\n    definition: 'NOT NULL ' + name, match_type: ' ', update_action: ' ', delete_action: ' ', referenced_schema: null,\n    referenced_table: null, columns: [name], referenced_columns: [], ...(flags ? { no_inherit: false, is_local: true, inheritance_count: 0 } : {}) })) : [];\n  return { columns, constraints };\n}\nexport function questingCasinoCatalogRows(field, rows, version, profile, flags) {\n  assert(fields.includes(field)); assert(Array.isArray(rows)); const expected = casinoExpected(version, profile, flags);\n  if (field === 'columns') {\n    assert.deepEqual(rows.filter(row => casinoColumns.has(row.table_name + '.' + row.column_name)), expected.columns,\n      'Every reviewed casino column field and exact profile ordinal qualifies before filtering');\n    const business = ['id', 'character_id', 'kind', 'tier', 'last_collect_at', 'launder_used', 'launder_at', 'scrutiny', 'scrutiny_at',\n      'shakedown_at', 'inside_at', 'rake_cursor', 'upkeep_at', 'acquired_at', 'spec', 'spec_at', 'takeover_cd_until'];\n    const volume = ['id', 'total', 'profit', 'distributed', 'jackpot'];\n    if (profile === 'fresh') { business.splice(12, 0, 'rake_index_cursor'); volume.splice(4, 0, 'rake_index', 'rake_checkpoint_volume', 'rake_legacy_owners'); }\n    else { business.push('rake_index_cursor'); volume.push('rake_index', 'rake_checkpoint_volume', 'rake_legacy_owners'); }\n    for (const [table, names] of [['businesses', business], ['den_volume', volume]]) assert.deepEqual(\n      rows.filter(row => row.table_name === table).map(({ column_name, ordinal }) => ({ column_name, ordinal })),\n      names.map((column_name, i) => ({ column_name, ordinal: i + 1 })), 'Complete literal fresh or migrated casino column layout');\n    return rows.filter(row => !casinoColumns.has(row.table_name + '.' + row.column_name)).map(row => {\n      if (profile === 'fresh' && row.table_name === 'businesses' && row.ordinal > 13) return { ...row, ordinal: row.ordinal - 1 };\n      if (profile === 'fresh' && row.table_name === 'den_volume' && row.ordinal > 7) return { ...row, ordinal: row.ordinal - 3 };\n      return row;\n    });\n  }\n  if (field === 'constraints') {\n    const selected = row => casinoNames.has(row.name) || row.columns?.some(name => casinoColumns.has(row.table_name + '.' + name));\n    assert.deepEqual(rows.filter(selected), expected.constraints, 'Only the exact PG18 casino NOT NULL constraints qualify');\n    return rows.filter(row => !selected(row));\n  }\n  return rows;\n}\nexport function questingCasinoCatalogProjection(metadata, version, profile, flags) {\n  assert.deepEqual(Object.keys(metadata).sort(), [...fields].sort());\n  return Object.fromEntries(fields.map(field => [field, questingCasinoCatalogRows(field, metadata[field], version, profile, flags)]));\n}\nexport function questingCasinoConstraintProjection(rows, version, includeNotNull) {\n  assert(Array.isArray(rows)); assert(version === 16 || version === 18); assert.equal(typeof includeNotNull, 'boolean');\n  const expected = version === 18 && includeNotNull ? ['rake_index', 'rake_legacy_owners'].map(name => ({ table_name: 'den_volume',\n    name: 'den_volume_' + name + '_not_null', definition: 'NOT NULL ' + name })) : [];\n  assert.deepEqual(rows.filter(row => casinoNames.has(row.name)), expected, 'Exact casino constraints qualify before archived normalization');\n  return rows.filter(row => !casinoNames.has(row.name));\n}\nexport const QUESTING_CASINO_DDL_CONTROLS = Object.freeze([\n  ...[ ['businesses', 'rake_index_cursor'], ['den_volume', 'rake_index'], ['den_volume', 'rake_checkpoint_volume'], ['den_volume', 'rake_legacy_owners'] ]\n    .flatMap(([table, name]) => [`ALTER TABLE ${table} DROP COLUMN ${name}`, `ALTER TABLE ${table} ALTER COLUMN ${name} SET DEFAULT '1'`,\n      `ALTER TABLE ${table} ALTER COLUMN ${name} TYPE varchar USING ${name}::varchar`]),\n  'ALTER TABLE den_volume ALTER COLUMN rake_index DROP NOT NULL', 'ALTER TABLE den_volume ALTER COLUMN rake_legacy_owners DROP NOT NULL',\n]);\nexport function questingCatalogProjection(reference, baseline, version) {\n  assert.deepEqual(Object.keys(reference).sort(), [...fields].sort()); assert.deepEqual(Object.keys(baseline).sort(), [...fields].sort());\n  validateAdded(reference, version);\n",
          "baseline": "  }\n}\nexport { validateAdded as verifyQuestingCatalogTables };\nexport function questingCatalogProjection(reference, baseline, version) {\n  assert.deepEqual(Object.keys(reference).sort(), [...fields].sort()); assert.deepEqual(Object.keys(baseline).sort(), [...fields].sort());\n  validateAdded(reference, version);\n"
        },
        {
          "at": 25280,
          "current": "    }\n  };\n  const current = await compile([input.current]);\n  const archivedBaseline = await compile([input.archivedBaseline]);\n  let casinoDdlCausal = 0;\n  const baseline = await compile([input.baseline], async (client, metadata) => {\n    assert.deepEqual(questingCasinoCatalogProjection(metadata, version, 'fresh', true), archivedBaseline,\n      'Only the independently specified four fields differ from every archived582 metadata field');\n    for (const ddl of QUESTING_CASINO_DDL_CONTROLS) {\n      await client.query('BEGIN');\n      try { await client.query(ddl); const changed = await readMetadata(client);\n        assert.throws(() => questingCasinoCatalogProjection(changed, version, 'fresh', true)); casinoDdlCausal++; }\n      finally { await client.query('ROLLBACK'); }\n      assert.deepEqual(questingCasinoCatalogProjection(await readMetadata(client), version, 'fresh', true), archivedBaseline);\n    }\n  });\n  const projection = questingCatalogProjection(current, baseline, version);\n  const upgraded = await compile([input.baseline, input.current], async (client, metadata) => {\n    projection.verify(metadata);\n",
          "baseline": "    }\n  };\n  const current = await compile([input.current]);\n  const baseline = await compile([input.baseline]);\n  const projection = questingCatalogProjection(current, baseline, version);\n  const upgraded = await compile([input.baseline, input.current], async (client, metadata) => {\n    projection.verify(metadata);\n"
        },
        {
          "at": 27444,
          "current": "  assert.deepEqual(projection.project(upgraded), baseline); await emptyNamespace(pool);\n  const historical = await compiler.verifyCommerceEnterpriseSlotBranches(pool, endpoint, historicalSource);\n  await emptyNamespace(pool);\n  return freeze({ current, upgraded, baseline, archivedBaseline, historical, causal: projection.causal, ddlCausal, casinoDdlCausal, actualTables: 585, baselineTables: 582,\n    phase: 'actual quest585 fresh and current582→585 native upgrade; exact four-field archived582 comparison; legacy casino migration is separate' });\n}\n",
          "baseline": "  assert.deepEqual(projection.project(upgraded), baseline); await emptyNamespace(pool);\n  const historical = await compiler.verifyCommerceEnterpriseSlotBranches(pool, endpoint, historicalSource);\n  await emptyNamespace(pool);\n  return freeze({ current, upgraded, baseline, historical, causal: projection.causal, ddlCausal, actualTables: 585, baselineTables: 582,\n    phase: 'actual quest585 fresh and582→585 native upgrade; all historical references remain separate' });\n}\n"
        }
      ]
    },
    "tools/questing-source-transfer.js": {
      "current": {
        "mode": "100644",
        "blob": "cccd3869c8bdff091a0f216ab4afb7b20e79257d",
        "sha256": "4b8a15050bf71aaa7dee33bef8ee6d83602e498767e95874a63a30b847a6ecba",
        "bytes": 530584
      },
      "baseline": {
        "mode": "100644",
        "blob": "86137a955f2eab142fd914093a8a01deed7acab3",
        "sha256": "959b8bde826a583e7ec69f38c5be7c55ed2d6dd307fd3bb475e9a83516607d93",
        "bytes": 530232
      },
      "inverses": [
        {
          "at": 0,
          "current": "// Exact questing comparison-only successor; never imported by game/runtime/native admission.\nimport assert from 'node:assert/strict';\nimport { createHash } from 'node:crypto';\nimport { siteBasicsHistoricalInput, siteBasicsHistoricalEntry } from './site-basics-source-transfer.js';\n\nconst source = {\n  \"status\": \"SEALED\",\n",
          "baseline": "// Exact questing comparison-only successor; never imported by game/runtime/native admission.\nimport assert from 'node:assert/strict';\nimport { createHash } from 'node:crypto';\n\nconst source = {\n  \"status\": \"SEALED\",\n"
        },
        {
          "at": 528892,
          "current": "// Unknown bytes remain unmodified so the existing downstream exact assertions\n// reject them. This function never recognizes a namespace prefix or partial hunk.\nexport function questingHistoricalInput(file, input) {\n  // The helper's own actual source remains available to its isolated definition controls.\n  if (file !== 'tools/questing-source-transfer.js') input = siteBasicsHistoricalInput(file, input);\n  if (!known(file)) return input;\n  const current = canonical(input), row = source.files[file];\n  if (!current || sha(current.lf) !== row.current.sha256) return input;\n",
          "baseline": "// Unknown bytes remain unmodified so the existing downstream exact assertions\n// reject them. This function never recognizes a namespace prefix or partial hunk.\nexport function questingHistoricalInput(file, input) {\n  if (!known(file)) return input;\n  const current = canonical(input), row = source.files[file];\n  if (!current || sha(current.lf) !== row.current.sha256) return input;\n"
        },
        {
          "at": 529678,
          "current": "// qualified. No native manifest or runtime loader imports this identity view.\nexport function questingHistoricalEntry(file, entry, kind) {\n  assert(kind === 'tree' || kind === 'index', 'Choose an explicit Git identity shape');\n  entry = siteBasicsHistoricalEntry(file, entry, kind);\n  if (!known(file)) return entry;\n  definition();\n  const row = source.files[file];\n",
          "baseline": "// qualified. No native manifest or runtime loader imports this identity view.\nexport function questingHistoricalEntry(file, entry, kind) {\n  assert(kind === 'tree' || kind === 'index', 'Choose an explicit Git identity shape');\n  if (!known(file)) return entry;\n  definition();\n  const row = source.files[file];\n"
        }
      ]
    },
    "tools/questing-ux-release-phase2-native-catalog.js": {
      "current": {
        "mode": "100644",
        "blob": "2b987db6920def5e2a34e04e861c335be2e3be49",
        "sha256": "65cd8de2870f545c34ed2e869d2cbc1b892a0cdb23feee594e593ed247b40d63",
        "bytes": 54498
      },
      "baseline": {
        "mode": "100644",
        "blob": "7c745df4e6ded887b98f8618ae5deacb53198caf",
        "sha256": "ded65ea0c23d32584899ef6bbf5b49d37971cc62c206f8190e8ce019ec650eb4",
        "bytes": 52073
      },
      "inverses": [
        {
          "at": 33243,
          "current": "\n// Actual585 admission and additive native metadata layer. Archived582 is comparison-only.\nimport { QUESTING_CATALOG_BASELINE, QUESTING_CATALOG_SOURCE, QUESTING_CATALOG_TABLES,\n  questingCatalogSource, verifyQuestingCatalogTables, questingCasinoCatalogProjection, questingCasinoCatalogRows,\n  questingCasinoConstraintProjection, QUESTING_CASINO_DDL_CONTROLS } from './questing-enterprise-catalog.js';\nimport { QUESTING_ENTERPRISE_NATIVE_INPUTS as questDeclaration,\n  assertQuestingEnterpriseTrackedInput, captureQuestingEnterpriseSource,\n  assertQuestingEnterpriseStable } from './enterprise-native-questing.js';\n",
          "baseline": "\n// Actual585 admission and additive native metadata layer. Archived582 is comparison-only.\nimport { QUESTING_CATALOG_BASELINE, QUESTING_CATALOG_SOURCE, QUESTING_CATALOG_TABLES,\n  questingCatalogSource, verifyQuestingCatalogTables } from './questing-enterprise-catalog.js';\nimport { QUESTING_ENTERPRISE_NATIVE_INPUTS as questDeclaration,\n  assertQuestingEnterpriseTrackedInput, captureQuestingEnterpriseSource,\n  assertQuestingEnterpriseStable } from './enterprise-native-questing.js';\n"
        },
        {
          "at": 43486,
          "current": "  return Object.fromEntries(questFields.map(field =>\n    [field, metadata[field].filter(row => !questNames.has(questTable(field, row)))]));\n}\nasync function questProjectedCaller(pool, reference, profile) {\n  const wrap = async queryable => {\n    questingCasinoCatalogProjection(await original.readCommerceReleasePhase2Metadata(queryable), reference.version, profile, false);\n    const context = (await queryable.query(catalogQueries[0])).rows[0];\n    return { query: async (sql, values) => {\n      if (sql === catalogQueries[0]) {\n        const actual = await questOnlyRows(queryable, reference.version);\n        assert.deepEqual(actual, reference.full, 'Same-client native quest fields requalify before every catalog reread');\n        questingCasinoCatalogProjection(await original.readCommerceReleasePhase2Metadata(queryable), reference.version, profile, false);\n      }\n      const result = await queryable.query(sql, values), field = catalogFields.get(sql);\n      if (!field) return result;\n",
          "baseline": "  return Object.fromEntries(questFields.map(field =>\n    [field, metadata[field].filter(row => !questNames.has(questTable(field, row)))]));\n}\nasync function questProjectedCaller(pool, reference) {\n  const wrap = async queryable => {\n    const context = (await queryable.query(catalogQueries[0])).rows[0];\n    return { query: async (sql, values) => {\n      if (sql === catalogQueries[0]) {\n        const actual = await questOnlyRows(queryable, reference.version);\n        assert.deepEqual(actual, reference.full, 'Same-client native quest fields requalify before every catalog reread');\n      }\n      const result = await queryable.query(sql, values), field = catalogFields.get(sql);\n      if (!field) return result;\n"
        },
        {
          "at": 44736,
          "current": "        return { ...row, definition: row.definition.replace(anchor, ' ON $self.') };\n      });\n      assert.deepEqual(selected, reference.raw[field], 'Exact actual quest ' + field + ' qualifies before filtering');\n      return { ...result, rows: questingCasinoCatalogRows(field,\n        result.rows.filter(row => !questNames.has(questTable(field, row))), reference.version, profile, false) };\n    } };\n  };\n  return { ...await wrap(pool), connect: async () => {\n",
          "baseline": "        return { ...row, definition: row.definition.replace(anchor, ' ON $self.') };\n      });\n      assert.deepEqual(selected, reference.raw[field], 'Exact actual quest ' + field + ' qualifies before filtering');\n      return { ...result, rows: result.rows.filter(row => !questNames.has(questTable(field, row))) };\n    } };\n  };\n  return { ...await wrap(pool), connect: async () => {\n"
        },
        {
          "at": 46590,
          "current": "    sourceOnly: true, nativeAdmission: false, priorResultsTransferred: false,\n  });\n}\nexport function questingNativeCatalogProjection(full, version, includeNotNull, profile) {\n  assert.equal(arguments.length, 4);\n  const quest = questingNativeQuestProjection(full, version, includeNotNull);\n  return Object.freeze({ projectMetadata: metadata => questingCasinoCatalogProjection(quest.projectMetadata(metadata), version, profile, false),\n    projectConstraints: rows => questingCasinoConstraintProjection(quest.projectConstraints(rows), version, includeNotNull),\n    sourceOnly: true, nativeAdmission: false, priorResultsTransferred: false });\n}\nfunction extendQuestCatalog(prior, reference, projected, includeNotNull, current, ddlCausal, profile, casinoDdlCausal) {\n  const projection = questingNativeCatalogProjection(reference.full, reference.version, includeNotNull, profile);\n  const project = projection.projectMetadata;\n  const normalize = typeof prior.normalize === 'function'\n    ? rows => prior.normalize(projection.projectConstraints(rows)) : null;\n",
          "baseline": "    sourceOnly: true, nativeAdmission: false, priorResultsTransferred: false,\n  });\n}\nfunction extendQuestCatalog(prior, reference, projected, includeNotNull, current, ddlCausal) {\n  const projection = questingNativeQuestProjection(reference.full, reference.version, includeNotNull);\n  const project = projection.projectMetadata;\n  const normalize = typeof prior.normalize === 'function'\n    ? rows => prior.normalize(projection.projectConstraints(rows)) : null;\n"
        },
        {
          "at": 47770,
          "current": "  const result = Object.freeze({ ...prior, ...(normalize ? { normalize } : {}), verifyMetadata,\n    ...(prior.verify ? { verify: metadata => prior.verify(project(metadata)) } : {}),\n    reference: current, ...(prior.current ? { current } : {}),\n    archived582Reference: prior.reference, questReference: reference.full, questDdlCausal: ddlCausal, casinoDdlCausal,\n    phase: 'Actual585 live metadata with separately qualified archived582 parent comparison; ' + prior.phase,\n    questPhase: 'Actual585 native quest rows; exact archived582 comparison only' });\n  questStates.set(result, { prior, reference, projected, includeNotNull, profile }); return result;\n}\nasync function casinoDdlControls(pool, version, profile) {\n  let causal = 0; const client = await pool.connect();\n  try {\n    for (const ddl of QUESTING_CASINO_DDL_CONTROLS) {\n      await client.query('BEGIN');\n      try {\n        questingCasinoCatalogProjection(await original.readCommerceReleasePhase2Metadata(client), version, profile, false);\n        await client.query(ddl);\n        await assert.rejects(async () => questingCasinoCatalogProjection(await original.readCommerceReleasePhase2Metadata(client), version, profile, false),\n          error => error?.code === 'ERR_ASSERTION'); causal++;\n      } finally { await client.query('ROLLBACK'); }\n      questingCasinoCatalogProjection(await original.readCommerceReleasePhase2Metadata(client), version, profile, false);\n    }\n  } finally { client.release(); }\n  assert.equal(causal, 14); return causal;\n}\nasync function questDdlControls(pool, reference) {\n  const ddls = [\n",
          "baseline": "  const result = Object.freeze({ ...prior, ...(normalize ? { normalize } : {}), verifyMetadata,\n    ...(prior.verify ? { verify: metadata => prior.verify(project(metadata)) } : {}),\n    reference: current, ...(prior.current ? { current } : {}),\n    archived582Reference: prior.reference, questReference: reference.full, questDdlCausal: ddlCausal,\n    phase: 'Actual585 live metadata with separately qualified archived582 parent comparison; ' + prior.phase,\n    questPhase: 'Actual585 native quest rows; exact archived582 comparison only' });\n  questStates.set(result, { prior, reference, projected, includeNotNull }); return result;\n}\nasync function questDdlControls(pool, reference) {\n  const ddls = [\n"
        },
        {
          "at": 51629,
          "current": "  const reference = freeze({ ...compiled, version });\n  assert.deepEqual(await questOnlyRows(pool, version), reference.full);\n  const ddlCausal = await questDdlControls(pool, reference);\n  const casinoDdlCausal = await casinoDdlControls(pool, version, options.legacyProfile);\n  const projected = await questProjectedCaller(pool, reference, options.legacyProfile);\n  const prior = await createArchivedComparisonCatalog(projected, endpoint, archived582ComparisonSource(), options);\n  const current = await readCommerceReleasePhase2Metadata(pool);\n  assertQuestingEnterpriseStable(questSourceCapture);\n  return extendQuestCatalog(prior, reference, projected, options.includeNotNull, current, ddlCausal, options.legacyProfile, casinoDdlCausal);\n}\nexport async function verifyCommerceNativeBranches(pool, endpoint) {\n  assert.equal(arguments.length, 2);\n",
          "baseline": "  const reference = freeze({ ...compiled, version });\n  assert.deepEqual(await questOnlyRows(pool, version), reference.full);\n  const ddlCausal = await questDdlControls(pool, reference);\n  const projected = await questProjectedCaller(pool, reference);\n  const prior = await createArchivedComparisonCatalog(projected, endpoint, archived582ComparisonSource(), options);\n  const current = await readCommerceReleasePhase2Metadata(pool);\n  assertQuestingEnterpriseStable(questSourceCapture);\n  return extendQuestCatalog(prior, reference, projected, options.includeNotNull, current, ddlCausal);\n}\nexport async function verifyCommerceNativeBranches(pool, endpoint) {\n  assert.equal(arguments.length, 2);\n"
        },
        {
          "at": 52759,
          "current": "  const reference = freeze({ ...compiled, version });\n  assert.deepEqual(await questOnlyRows(pool, version), reference.full);\n  const ddlCausal = await questDdlControls(pool, reference);\n  const casinoDdlCausal = await casinoDdlControls(pool, version, 'fresh');\n  const projected = await questProjectedCaller(pool, reference, 'fresh');\n  const prior = await verifyArchivedComparisonBranches(projected, endpoint);\n  const current = await readCommerceReleasePhase2Metadata(pool);\n  assertQuestingEnterpriseStable(questSourceCapture);\n  return extendQuestCatalog(prior, reference, projected, true, current, ddlCausal, 'fresh', casinoDdlCausal);\n}\nexport async function verifyCommerceReleasePhase2CausalNegatives(pool, catalog, rows, verifyRows) {\n  assert.equal(arguments.length, 4);\n  const state = questStates.get(catalog); assert(state, 'Only the actual-current catalog returned by this native invocation');\n  const { prior, reference, projected, includeNotNull } = state;\n  assert.deepEqual(await questOnlyRows(pool, reference.version), reference.full);\n  const withoutQuest = questConstraintProjection(rows, reference, includeNotNull);\n  const parentRows = questingCasinoConstraintProjection(withoutQuest, reference.version, includeNotNull);\n  const casinoRows = withoutQuest.filter(row => !parentRows.includes(row));\n  const questRows = rows.filter(row => questNames.has(row.table_name));\n  const result = await original.verifyCommerceReleasePhase2CausalNegatives(projected, prior, parentRows,\n    candidate => verifyRows(questOrder([...candidate, ...questRows, ...casinoRows])));\n  assert.deepEqual(await questOnlyRows(pool, reference.version), reference.full);\n  assertQuestingEnterpriseStable(questSourceCapture);\n  return result;\n",
          "baseline": "  const reference = freeze({ ...compiled, version });\n  assert.deepEqual(await questOnlyRows(pool, version), reference.full);\n  const ddlCausal = await questDdlControls(pool, reference);\n  const projected = await questProjectedCaller(pool, reference);\n  const prior = await verifyArchivedComparisonBranches(projected, endpoint);\n  const current = await readCommerceReleasePhase2Metadata(pool);\n  assertQuestingEnterpriseStable(questSourceCapture);\n  return extendQuestCatalog(prior, reference, projected, true, current, ddlCausal);\n}\nexport async function verifyCommerceReleasePhase2CausalNegatives(pool, catalog, rows, verifyRows) {\n  assert.equal(arguments.length, 4);\n  const state = questStates.get(catalog); assert(state, 'Only the actual-current catalog returned by this native invocation');\n  const { prior, reference, projected, includeNotNull } = state;\n  assert.deepEqual(await questOnlyRows(pool, reference.version), reference.full);\n  const parentRows = questConstraintProjection(rows, reference, includeNotNull);\n  const questRows = rows.filter(row => questNames.has(row.table_name));\n  const result = await original.verifyCommerceReleasePhase2CausalNegatives(projected, prior, parentRows,\n    candidate => verifyRows(questOrder([...candidate, ...questRows])));\n  assert.deepEqual(await questOnlyRows(pool, reference.version), reference.full);\n  assertQuestingEnterpriseStable(questSourceCapture);\n  return result;\n"
        }
      ]
    }
  },
  "additions": {
    "public/404.html": {
      "mode": "100644",
      "blob": "d98ad700a73e0b4a4ca4be9e822d8f2142137c96",
      "sha256": "68e77408b7122dc16d68445bda5abc2d16359fb100364199285d0b888eff5ed2",
      "bytes": 1867
    },
    "public/getting-started.html": {
      "mode": "100644",
      "blob": "d9490fb60037f01c47b435c910a55b46c2a31967",
      "sha256": "349f03556e9abd2f582d9f8051720d8a7ceb57eae37a841fd87f0e8284eef13d",
      "bytes": 9486
    },
    "public/landing-loader.js": {
      "mode": "100644",
      "blob": "bcc937673d3ea7a13579d2b63432630724ab55c1",
      "sha256": "6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c",
      "bytes": 10824
    },
    "public/site-analytics.js": {
      "mode": "100644",
      "blob": "a3b2a759f7d9e7429fd78cbbf3dbd5d69dada03c",
      "sha256": "a2eb06b3844b94d96bd8492f0f854ecbea2f2eb4efdab610f9c99ae1d36db245",
      "bytes": 5308
    },
    "src/casinorakeback.js": {
      "mode": "100644",
      "blob": "e63cc40bb9b598dc7dd402a61e91b79f3ce5b1a9",
      "sha256": "22e4ea6a4024225205727e4997aa8e52319350e00e4625db4cae96c6716bf0f0",
      "bytes": 2949
    },
    "src/client-shell.js": {
      "mode": "100644",
      "blob": "0248b3685944b46a23cdefedf39321acc7b0b47e",
      "sha256": "48e9ffc844ae08867e0923743dd94d3fcb859d00cdacdf433f82a7323184817c",
      "bytes": 4458
    },
    "src/site-analytics.js": {
      "mode": "100644",
      "blob": "726101f65b8952d38171c1cad33035aeac9a5307",
      "sha256": "2bf12c4349b271c780578d383ee7a280d2bfd1118f91704ce9e181fff1fc2309",
      "bytes": 5361
    },
    "src/site-seo.js": {
      "mode": "100644",
      "blob": "f36e780b6a60c2b72f8cb649502f93b9f1e060ab",
      "sha256": "a00cbdee06d8660a771ab7238ce00cea20b313c69aee9588c6e25598cc32d290",
      "bytes": 7654
    },
    "test/agent-cohort.js": {
      "mode": "100644",
      "blob": "a06c5b8876237802373b85d6902ca12466b9c50a",
      "sha256": "a0a7b4cd31ba9162ff2cdacf407ed47b52a30f4748b99eb1cd8869a248d220c3",
      "bytes": 4256
    },
    "test/agent-onboarding-postgres.js": {
      "mode": "100644",
      "blob": "7d2bae8e9c77283f3cf1fcf8fcb72eccb2ac9996",
      "sha256": "24b5efdbfebca643a77578ab56c258d928a00a675645a46db6d993a50f076fd1",
      "bytes": 5064
    },
    "test/agent-onboarding.js": {
      "mode": "100644",
      "blob": "5a3974e0e4cfdab59a4e4de1b631cec4bf385775",
      "sha256": "2710afc43a0986f89d2e59bb0c0e0c62bdf7190a3fe8ecbbcd91135da1351398",
      "bytes": 5335
    },
    "test/agent-turn-cadence.js": {
      "mode": "100644",
      "blob": "60496d90b3f8e453ef4337c2967ff6886a9b1f9b",
      "sha256": "daf43bfbb630a2d05b4a9107efdc8afbdce67ab892220ee50cad555105901003",
      "bytes": 982
    },
    "test/agentturn-jail-units.js": {
      "mode": "100644",
      "blob": "d5a5504fde9d1dc9d14ce22550ae4cb11655b389",
      "sha256": "fc5fd11c684c211f5d3470dbfc26b3fcfd1fb99905ee297edc4b77b2469892a7",
      "bytes": 1946
    },
    "test/business-settlement.js": {
      "mode": "100644",
      "blob": "28d11b61b5961cd48c34525689f4f5fde8618d7d",
      "sha256": "5cf976b0fff054e235c817182932f64f539da2244335cba5d80fc28e83787c19",
      "bytes": 8973
    },
    "test/casino-rakeback-postgres.js": {
      "mode": "100644",
      "blob": "15def283001304d2056f2440b197e722637e8e38",
      "sha256": "58c720520a5a1d70321f040cd04084fc9ea194315c6976784b176ac9583a2d04",
      "bytes": 7791
    },
    "test/client-shell-browser.js": {
      "mode": "100644",
      "blob": "805adf5072b8e9ecccca92db6fa1618292aa7456",
      "sha256": "b8dcca850e110ea9e7760d44da257edf2b2b4cf5f5e06f3a8a45d31611ff1526",
      "bytes": 19333
    },
    "test/firstblood-intel.js": {
      "mode": "100644",
      "blob": "90db32ca25176d80531e440049f6b2df597bba38",
      "sha256": "d6f037a0f38652652d7837e740754d060278ac4a7f1983f813c80fbb499c1ab4",
      "bytes": 5353
    },
    "test/local-agent-human-coordination.js": {
      "mode": "100644",
      "blob": "3138550f24f8089786ae4596c17354bfa3e94e01",
      "sha256": "671f6dd8f7a1e38120c895d659a16b77a03d65f2febae10b3fb163fe2af204a2",
      "bytes": 6784
    },
    "test/site-analytics-isolation.js": {
      "mode": "100644",
      "blob": "73af57531e3c3f023ef6bb24a47a99a7386740f8",
      "sha256": "8756f11a326e4fe0818aebe4c9ad5312eccc7e31eaff25ad9d25ec4bc0c2c909",
      "bytes": 2804
    },
    "test/site-analytics.js": {
      "mode": "100644",
      "blob": "b7c34179809a3604ecdc9731d5548cee28419e9a",
      "sha256": "c1facd6ca91ca99e4aa7a576564e9d04a8609c7aac3bf6c0a707d2e30e555b53",
      "bytes": 18971
    },
    "test/site-basics-source-transfer.js": {
      "mode": "100644",
      "blob": "cb6b5d7ff74f0630e5f3e76dfd8d2a218b71ab9c",
      "sha256": "a1a56a2f3cd2f7ad30894b1fe53bff2fe5376c0241569d03ae32da1db7711d01",
      "bytes": 6277
    },
    "test/site-basics.js": {
      "mode": "100644",
      "blob": "86f85ccf31741fb483dbd9ae6d64c4a99ba8781f",
      "sha256": "713ecd1cf163c9cd2cb08959bb1c4ebd75a470bbc4a6eec2fcd42d0f717492b4",
      "bytes": 4195
    },
    "test/site-entry-browser.js": {
      "mode": "100644",
      "blob": "e6d5dccd8a4093fcc2e78fbd819c8d8477cf51cd",
      "sha256": "d6fd1af7aecd96a8eaded9e542cad5beec22501cda8a183f9de284e76bf542a6",
      "bytes": 6296
    },
    "test/site-seo.js": {
      "mode": "100644",
      "blob": "4eb95a4520f2342536da9d58d6f4b9c5974cad53",
      "sha256": "28382d6acc42b85d26d7807e0e2fee67b140b2fc9b0ee6acd140a9175390788d",
      "bytes": 6303
    },
    "tools/agent-cohort.js": {
      "mode": "100644",
      "blob": "6e51bb6f06de267beabf54a3df6e40044c136ce9",
      "sha256": "d19854707cb6b51c1bf68bede6b8dccdf6932de7f28141788299ee1eb9063bd0",
      "bytes": 13860
    },
    "tools/maintenance-worker.js": {
      "mode": "100644",
      "blob": "880be37f501cc0f6e2d4a4edc4d8973719d2bacd",
      "sha256": "f4a9458c11e569b6181280bcafde3db07e372c187f96842aac5a830492698cc9",
      "bytes": 380
    },
    "tools/site-basics-source-seal.js": {
      "mode": "100644",
      "blob": "eed6f5714e1b12dbdec39845ff12bf360b6bd454",
      "sha256": "fb06a1701d17328c879a4b497a818927d5e2addcf6ccee9b2cfa872a092bf38a",
      "bytes": 4289
    },
    "tools/site-basics-source-transfer.js": {
      "mode": "100644",
      "blob": "abdf165711f425b7cda48479c6c816af1915cca4",
      "sha256": "1b881b6b57056436b0972621c534c611f93ad8ca20a8aae995da58a66283de1c",
      "bytes": 4601
    }
  }
});
export const SITE_BASICS_SOURCE_SHA256 = 'a2e1572ca7d2be2c74fb455d8a87a8bab184df4b0b23dee3cfc61ef5361a32d0';
