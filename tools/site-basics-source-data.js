// Exact website source comparison only; no runtime/native/financial/deployment results transferred.
const freeze = value => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const SITE_BASICS_SOURCE = freeze({
  "status": "SEALED",
  "phase": "EXACT_SITE_BASICS_SOURCE_COMPARISON_ONLY",
  "revision": "ffa216b2692ecdc473fd3ae161731220a41b036f",
  "tree": "eb2185336dcc54be0f60e957e44c2b661e909cb4",
  "predecessor": "d763d0623b69aa223eab9fae01beb7aec6cdce75",
  "predecessorTree": "c5242f2cf0fe8a1100bf09caf88d2161c011fecd",
  "files": {
    ".github/workflows/ci.yml": {
      "current": {
        "mode": "100644",
        "blob": "5c58de842c8905b6b9cf566dd1bb5683270533fb",
        "sha256": "867e277d67cbab1bd844b6680404ba3372ffd7a604b4a780115fb8fdaba09806",
        "bytes": 79093
      },
      "baseline": {
        "mode": "100644",
        "blob": "d8eb7bff05619dcb43dc4bc09065078e99011278",
        "sha256": "8116d288255ca705e890601935682ddd4bdb859b4623ea0e9a7a6d2ec611ee15",
        "bytes": 78843
      },
      "inverses": [
        {
          "at": 21128,
          "current": "      - name: Install PostgreSQL client tools matching the server major\n        run: bash tools/rc1-postgres-client.sh '${{ matrix.postgres }}'\n\n      - name: Optional website counts on real PostgreSQL\n        env:\n          SITE_ANALYTICS_TEST_DATABASE_URL: postgres://postgres:pgcheck@127.0.0.1:5432/omerta_check\n          DATABASE_URL: ''\n        run: node test/site-analytics.js --postgres\n\n      - name: Gateway, RLS and receipt concurrency on real PostgreSQL\n        env:\n          COORDINATION_TEST_DATABASE_URL: postgres://postgres:pgcheck@localhost:5432/omerta_check\n",
          "baseline": "      - name: Install PostgreSQL client tools matching the server major\n        run: bash tools/rc1-postgres-client.sh '${{ matrix.postgres }}'\n\n      - name: Gateway, RLS and receipt concurrency on real PostgreSQL\n        env:\n          COORDINATION_TEST_DATABASE_URL: postgres://postgres:pgcheck@localhost:5432/omerta_check\n"
        }
      ]
    },
    "MARKETING-POSTS.md": {
      "current": {
        "mode": "100644",
        "blob": "6bef01671df9ea98460c08d4317f2bbb5c58ef42",
        "sha256": "4f9862e8a3b9cadbc02910d195de703106d6e1cdd15536ed549948f67d83895b",
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
          "current": "OMERTÀ is a multiplayer noir mafia RPG — crimes, families, turf wars, a casino, contracts on\npeople's heads. Two things about it might interest HN more than the genre does:\n\n**1. The whole game is a JSON API, and agents are first-class players.** All 1382 routes\nwork over HTTP with stable error codes; there's an OpenAPI 3.1 contract, an llms.txt, and an MCP\nserver (`npx -y omerta-mcp`) that puts the game in Claude, ChatGPT, Cursor, or any MCP host with\none config block. Agents get their own leaderboard and a public hall of fame (/arena), and they're\n",
          "baseline": "OMERTÀ is a multiplayer noir mafia RPG — crimes, families, turf wars, a casino, contracts on\npeople's heads. Two things about it might interest HN more than the genre does:\n\n**1. The whole game is a JSON API, and agents are first-class players.** All 1378 routes\nwork over HTTP with stable error codes; there's an OpenAPI 3.1 contract, an llms.txt, and an MCP\nserver (`npx -y omerta-mcp`) that puts the game in Claude, ChatGPT, Cursor, or any MCP host with\none config block. Agents get their own leaderboard and a public hall of fame (/arena), and they're\n"
        },
        {
          "at": 4112,
          "current": "\n> Let your agent play OMERTÀ, a live multiplayer noir mafia RPG with a real, server-authoritative\n> economy. One tool call authenticates and creates a character; an EV-ranked opportunity board\n> suggests the next move; a universal request tool reaches all 1382 routes (crimes, contracts,\n> smuggling, the casino, families, turf war). Agents are first-class citizens with their own\n> leaderboard and a public arena at omerta.fun/arena — and they're excluded from human reward\n> faucets by design, so the competition is on skill.\n",
          "baseline": "\n> Let your agent play OMERTÀ, a live multiplayer noir mafia RPG with a real, server-authoritative\n> economy. One tool call authenticates and creates a character; an EV-ranked opportunity board\n> suggests the next move; a universal request tool reaches all 1378 routes (crimes, contracts,\n> smuggling, the casino, families, turf war). Agents are first-class citizens with their own\n> leaderboard and a public arena at omerta.fun/arena — and they're excluded from human reward\n> faucets by design, so the competition is on skill.\n"
        }
      ]
    },
    "SPEC.md": {
      "current": {
        "mode": "100644",
        "blob": "27a6428021d65f1e616d35114bd40ce786c4c18a",
        "sha256": "147a5e8a1743742386c86186397e21f6f64ae0e0c499eede4476d6374ce342fc",
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
          "at": 463,
          "current": "\n| | |\n|---|---|\n| Backend modules | **612** files, **140997** lines (recursive source inventory) |\n| Test suites | **1008** files, **213140** lines (recursive source inventory) |\n| HTTP routes | **1382** registrations (**1382** unique; 1274 under `/v1`) |\n| Database tables | **585** (`schema.sql`, 9820 lines) |\n| Client | **14678** lines in `public/index.html`; tabbed game interface with locally served Fieldwork and player guidance modules |\n| Ops dashboard + wiki | `public/admin.html`, `public/wiki.html` |\n| Smart contracts | **41** top-level Solidity files, **11590** lines, **1125** declared top-level Foundry test functions; the release gate re-measures the passing suite |\n| Harnesses | `tools/sim.js` (economy), `tools/playthrough.js` (player experience), `tools/pgcheck.js` (real Postgres), `tools/loadtest.js` (concurrency), `tools/chaos.js` (interruption), `tools/mobile.js` (the screens, at phone size), `tools/scale.js` (market liquidity at population scale), `tools/keeper-dials.js` (sizing the stock keeper's price-continuity wall), `tools/pgquery.js` (every SQL string parses on real Postgres), `tools/concurrency.js` (lost-update correctness on real Postgres), `tools/arena.js` (a population of EV-optimizing strategies against the live economy), `tools/arena-sweep.js` (N runs × `--reps` replicates per arena arm, read as a distribution — disjoint ranges only) |\n",
          "baseline": "\n| | |\n|---|---|\n| Backend modules | **610** files, **140775** lines (recursive source inventory) |\n| Test suites | **1002** files, **212398** lines (recursive source inventory) |\n| HTTP routes | **1378** registrations (**1378** unique; 1273 under `/v1`) |\n| Database tables | **585** (`schema.sql`, 9820 lines) |\n| Client | **14652** lines in `public/index.html`; tabbed game interface with locally served Fieldwork and player guidance modules |\n| Ops dashboard + wiki | `public/admin.html`, `public/wiki.html` |\n| Smart contracts | **41** top-level Solidity files, **11590** lines, **1125** declared top-level Foundry test functions; the release gate re-measures the passing suite |\n| Harnesses | `tools/sim.js` (economy), `tools/playthrough.js` (player experience), `tools/pgcheck.js` (real Postgres), `tools/loadtest.js` (concurrency), `tools/chaos.js` (interruption), `tools/mobile.js` (the screens, at phone size), `tools/scale.js` (market liquidity at population scale), `tools/keeper-dials.js` (sizing the stock keeper's price-continuity wall), `tools/pgquery.js` (every SQL string parses on real Postgres), `tools/concurrency.js` (lost-update correctness on real Postgres), `tools/arena.js` (a population of EV-optimizing strategies against the live economy), `tools/arena-sweep.js` (N runs × `--reps` replicates per arena arm, read as a distribution — disjoint ranges only) |\n"
        }
      ]
    },
    "package.json": {
      "current": {
        "mode": "100644",
        "blob": "cecff6f862ba0e996ee0b3f6dfee7141864d0e67",
        "sha256": "f376d7557e2da7ad25864796f0fb6771f6d82be9326f901edee4a34fc75c0c2c",
        "bytes": 62448
      },
      "baseline": {
        "mode": "100644",
        "blob": "57f741d8cce297c9ca20f5548f33bd0fc4b0c239",
        "sha256": "f0f37f6059554eeb4fc1db86c0222f68b6c0bc1beb1ed045a8f36bfaad7e3e1d",
        "bytes": 62152
      },
      "inverses": [
        {
          "at": 87,
          "current": "    \"node\": \">=20\"\n  },\n  \"scripts\": {\n    \"test:site\": \"node test/site-basics-source-transfer.js && node test/site-seo.js && node test/site-basics.js && node test/site-analytics.js && node test/site-analytics-isolation.js\",\n    \"test:site:browser\": \"node test/site-entry-browser.js\",\n    \"test:player-experience\": \"node test/player-experience.js && node test/player-experience-client.js && node test/player-experience-api.js && npm run test:decision-guide\",\n    \"test:agent-economy-commerce\": \"node test/commerce-source-compatibility.js && node test/commerce-current-native-guard.js && node test/saleattribution.js && node test/saleattribution-witness.js && node test/saleattribution-expiry.js && node test/saleattribution-api.js && node test/saleattribution-estate.js && node test/saleattribution-native-guard.js && node test/merchantloyalty.js && node test/merchantloyalty-accounting.js && node test/merchantloyalty-boundary.js && node test/merchantloyalty-expiry.js && node test/merchantloyalty-estate.js && node test/merchantloyalty-api.js && node test/merchantloyalty-native-guard.js && node test/shoppingbasket.js && node test/shoppingbasket-boundary.js && node test/shoppingbasket-atomicity.js && node test/shoppingbasket-finalization.js && node test/shoppingbasket-expiry.js && node test/shoppingbasket-estate.js && node test/shoppingbasket-api.js && node test/shoppingbasket-native-guard.js && node test/eventmarkets.js && node test/eventmarkets-boundary.js && node test/eventmarkets-integration.js && node test/commercialcampaigns-contracts.js && node test/commercialcampaigns-descriptors.js && node test/commercialcampaigns-metadata.js && node test/commerce-release-phase2-migration-catalog.js\",\n    \"test:agent-economy-commerce:postgres\": \"node tools/commerce-native.js --ci\",\n",
          "baseline": "    \"node\": \">=20\"\n  },\n  \"scripts\": {\n    \"test:player-experience\": \"node test/player-experience.js && node test/player-experience-client.js && node test/player-experience-api.js && npm run test:decision-guide\",\n    \"test:agent-economy-commerce\": \"node test/commerce-source-compatibility.js && node test/commerce-current-native-guard.js && node test/saleattribution.js && node test/saleattribution-witness.js && node test/saleattribution-expiry.js && node test/saleattribution-api.js && node test/saleattribution-estate.js && node test/saleattribution-native-guard.js && node test/merchantloyalty.js && node test/merchantloyalty-accounting.js && node test/merchantloyalty-boundary.js && node test/merchantloyalty-expiry.js && node test/merchantloyalty-estate.js && node test/merchantloyalty-api.js && node test/merchantloyalty-native-guard.js && node test/shoppingbasket.js && node test/shoppingbasket-boundary.js && node test/shoppingbasket-atomicity.js && node test/shoppingbasket-finalization.js && node test/shoppingbasket-expiry.js && node test/shoppingbasket-estate.js && node test/shoppingbasket-api.js && node test/shoppingbasket-native-guard.js && node test/eventmarkets.js && node test/eventmarkets-boundary.js && node test/eventmarkets-integration.js && node test/commercialcampaigns-contracts.js && node test/commercialcampaigns-descriptors.js && node test/commercialcampaigns-metadata.js && node test/commerce-release-phase2-migration-catalog.js\",\n    \"test:agent-economy-commerce:postgres\": \"node tools/commerce-native.js --ci\",\n"
        },
        {
          "at": 59005,
          "current": "    \"test:city:layout\": \"node test/city-world-layout.js && node test/continuous-city-source-compatibility.js\",\n    \"test:decision-guide\": \"node test/decision-guide.js && node test/decision-guide-client.js && node test/decision-guide-api.js\",\n    \"test:ux\": \"npm run test:ux:source && node test/ux-feedback.js && node test/circle-highlights.js && node test/ux-workspace.js && node test/ux-tactics.js && node test/ux-investigation-api.js && node test/ux-coordination.js && node test/ux-identity.js && node test/ux-story.js && node test/ux-community.js && node test/ux-tools.js\",\n    \"test:ux:browser\": \"node test/ux-shell-browser.js && node test/ux-progression-browser.js && node test/ux-navigation-browser.js && node test/ux-social-browser.js && node test/ux-experience-browser.js && node test/ux-workspace-browser.js && node test/ux-tactics-browser.js && node test/ux-investigation-browser.js && node test/ux-coordination-browser.js && node test/ux-expanded-browser.js && node test/ux-feel-browser.js && node test/ux-tools-browser.js && node test/ux-identity-browser.js && node test/ux-story-browser.js && node test/ux-community-browser.js && node test/ux-personality-browser.js && npm run test:site && npm run test:site:browser\",\n    \"test:ux:postgres\": \"node test/ux-postgres.js && node test/ux-postgres-rls.js\",\n    \"test:ux:source\": \"node test/noir-ui-source-compatibility.js && node test/sale-source-compatibility.js && node test/ux-source-compatibility.js\",\n    \"test:economy-ux-source\": \"node test/contract-release-source-compatibility.js && node test/businessdesk-combined-source-compatibility.js && node test/businessdesk-combined-native-provenance.js && node test/economy-deed-merge-source-compatibility.js && node test/businessdesk-noir-source-compatibility.js && node test/businessdesk-source-compatibility.js && node test/deed-allocation-source-compatibility.js && node test/deed-benefit-native-catalog.js && node test/economy-ux-merge-source-compatibility.js\",\n",
          "baseline": "    \"test:city:layout\": \"node test/city-world-layout.js && node test/continuous-city-source-compatibility.js\",\n    \"test:decision-guide\": \"node test/decision-guide.js && node test/decision-guide-client.js && node test/decision-guide-api.js\",\n    \"test:ux\": \"npm run test:ux:source && node test/ux-feedback.js && node test/circle-highlights.js && node test/ux-workspace.js && node test/ux-tactics.js && node test/ux-investigation-api.js && node test/ux-coordination.js && node test/ux-identity.js && node test/ux-story.js && node test/ux-community.js && node test/ux-tools.js\",\n    \"test:ux:browser\": \"node test/ux-shell-browser.js && node test/ux-progression-browser.js && node test/ux-navigation-browser.js && node test/ux-social-browser.js && node test/ux-experience-browser.js && node test/ux-workspace-browser.js && node test/ux-tactics-browser.js && node test/ux-investigation-browser.js && node test/ux-coordination-browser.js && node test/ux-expanded-browser.js && node test/ux-feel-browser.js && node test/ux-tools-browser.js && node test/ux-identity-browser.js && node test/ux-story-browser.js && node test/ux-community-browser.js && node test/ux-personality-browser.js\",\n    \"test:ux:postgres\": \"node test/ux-postgres.js && node test/ux-postgres-rls.js\",\n    \"test:ux:source\": \"node test/noir-ui-source-compatibility.js && node test/sale-source-compatibility.js && node test/ux-source-compatibility.js\",\n    \"test:economy-ux-source\": \"node test/contract-release-source-compatibility.js && node test/businessdesk-combined-source-compatibility.js && node test/businessdesk-combined-native-provenance.js && node test/economy-deed-merge-source-compatibility.js && node test/businessdesk-noir-source-compatibility.js && node test/businessdesk-source-compatibility.js && node test/deed-allocation-source-compatibility.js && node test/deed-benefit-native-catalog.js && node test/economy-ux-merge-source-compatibility.js\",\n"
        }
      ]
    },
    "public/admin.html": {
      "current": {
        "mode": "100644",
        "blob": "85f1b4157d5bb3eb64f10b19fa859e36cf7b8c39",
        "sha256": "3154d93fc56550f4405ee7c99f4024fa1b79a1daec9e57d2f042b13792095b51",
        "bytes": 102019
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
          "current": "      `<div class=\"note\">${fmt(c.surveyed)} active players surveyed (last ${c.activeWindowDays}d) · ${fmt(c.silent)} with a quiet coach</div>`\n      + (rows || '<div class=\"note\">No players were active during this window.</div>');\n  }\n  function renderSiteAnalytics(response) {\n    const panel = $('#p-site-analytics .body');\n    const data = response?.body;\n    if (response?.code !== 200 || !data?.totals) {\n      panel.textContent = 'Optional counts are unavailable. Refresh to retry.';\n      return;\n    }\n    const pages = new Map();\n    for (const row of data.rows || []) {\n      const label = row.event === 'cta' ? `${row.page} → ${row.target === 'guest_start' ? 'Play as guest' : row.target}` : row.page;\n      const key = `${row.event}:${label}`;\n      const previous = pages.get(key);\n      pages.set(key, { label, event: row.event, count: (previous?.count || 0) + Number(row.count || 0) });\n    }\n    const top = [...pages.values()].sort((a, b) => b.count - a.count).slice(0, 12);\n    panel.innerHTML = `<div class=\"row\"><span class=\"k\">page views</span><span class=\"v\">${fmt(data.totals.pageviews)}</span></div>`\n      + `<div class=\"row\"><span class=\"k\">public CTA clicks</span><span class=\"v\">${fmt(data.totals.ctaClicks)}</span></div>`\n      + `<div class=\"note\">Opted-in counts since ${esc(data.since)}. Browser privacy signals are respected. These are event totals, not unique visitors.</div>`\n      + (top.length ? top.map(row => `<div class=\"row\"><span class=\"k\">${esc(row.label)}${row.event === 'cta' ? ' · clicks' : ' · views'}</span><span class=\"v\">${fmt(row.count)}</span></div>`).join('')\n        : '<div class=\"note\">No optional counts yet. Visitors can enable them in Analytics choices.</div>');\n  }\n\n  function renderFunnel(fn) {\n    if (!fn) return;\n    const lv = fn.levels || {}, pr = fn.progression || {}, fw = fn.firstWeek || {};\n",
          "baseline": "      `<div class=\"note\">${fmt(c.surveyed)} active players surveyed (last ${c.activeWindowDays}d) · ${fmt(c.silent)} with a quiet coach</div>`\n      + (rows || '<div class=\"note\">No players were active during this window.</div>');\n  }\n  function renderFunnel(fn) {\n    if (!fn) return;\n    const lv = fn.levels || {}, pr = fn.progression || {}, fw = fn.firstWeek || {};\n"
        }
      ]
    },
    "public/index.html": {
      "current": {
        "mode": "100644",
        "blob": "65c5d7e86d401b760bd98022bb5f522b089dd785",
        "sha256": "244ef05efe9be5f2e9081d569868b1551402e7239a51d2c37bbab1378dc7c8ec",
        "bytes": 1407392
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
          "at": 588515,
          "current": "  }\n  $('#btn-down-retry').onclick = () => { downStop(); $('#down-tick').textContent = 'trying again…'; boot(); };\n\n  const landToken = async (r) => {\n    if (r.body?.token) { token = r.body.token; projections.setSession(token); localStorage.setItem('omerta_token', token); await api('POST', '/v1/access/session', {}); await boot(); return true; }\n    else toast(r.body?.message || r.body?.error || 'no dice', true);\n    return false;\n  };\n",
          "baseline": "  }\n  $('#btn-down-retry').onclick = () => { downStop(); $('#down-tick').textContent = 'trying again…'; boot(); };\n\n  const landToken = (r) => {\n    if (r.body?.token) { token = r.body.token; projections.setSession(token); localStorage.setItem('omerta_token', token); api('POST', '/v1/access/session', {}).then(() => boot()); return true; }\n    else toast(r.body?.message || r.body?.error || 'no dice', true);\n    return false;\n  };\n"
        },
        {
          "at": 591201,
          "current": "      dialog.querySelector('input').focus();\n    });\n  }\n  let guestPending = false;\n  const enterAsGhost = async () => {\n    if (guestPending) return;\n    guestPending = true;\n    const controls = ['#btn-guest', '#btn-guest2'].map(selector => $(selector)).filter(Boolean);\n    const labels = controls.map(button => button.textContent);\n    const status = $('#guest-status');\n    status.hidden = false; status.textContent = 'Checking eligibility…';\n    controls.forEach(button => { button.disabled = true; button.setAttribute('aria-busy', 'true'); button.textContent = 'Entering the city…'; });\n    try {\n      if (!await verifyAge()) { status.textContent = ''; status.hidden = true; return; }\n      status.textContent = 'Opening your street…';\n      const inviteCode = undefined;\n      const result = await api('POST', '/v1/auth/guest', inviteCode ? { inviteCode } : {});\n      if (await landToken(result)) { status.textContent = ''; status.hidden = true; }\n      else status.textContent = result.body?.message || (result.code === 429 ? 'Too many attempts. Wait a moment, then try again.' : 'Your street could not open. Please try again.');\n    } catch {\n      status.textContent = 'Your session could not open. Please try again.';\n      toast(status.textContent, true);\n    } finally {\n      guestPending = false;\n      controls.forEach((button, index) => { button.disabled = false; button.removeAttribute('aria-busy'); button.textContent = labels[index]; });\n    }\n  };\n  $('#btn-guest').onclick = enterAsGhost;\n  { const g2 = $('#btn-guest2'); if (g2) g2.onclick = enterAsGhost; } // the secondary CTA at the foot of the pitch\n",
          "baseline": "      dialog.querySelector('input').focus();\n    });\n  }\n  const enterAsGhost = async () => {\n    if (!await verifyAge()) return;\n    const inviteCode = undefined;\n    landToken(await api('POST', '/v1/auth/guest', inviteCode ? { inviteCode } : {}));\n  };\n  $('#btn-guest').onclick = enterAsGhost;\n  { const g2 = $('#btn-guest2'); if (g2) g2.onclick = enterAsGhost; } // the secondary CTA at the foot of the pitch\n"
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
    "src/agentgateway.js": {
      "current": {
        "mode": "100644",
        "blob": "79743e2e8fa0762ef9a2950e081a683045654b06",
        "sha256": "f6086a80c1d8bd2bb8dd9cad5f5d08f514a079a65a8c41361c44e83d85a08125",
        "bytes": 159768
      },
      "baseline": {
        "mode": "100644",
        "blob": "262dce7b74187bfd04b2d5d15fc97806d38b7084",
        "sha256": "08f90e389730100be44e6d7e3c9de74566737d237100b6cd7365138160ba7eae",
        "bytes": 159643
      },
      "inverses": [
        {
          "at": 4689,
          "current": "\n// Human/asset routes we don't advertise in the machine API contract (they serve HTML/markdown).\n// /arena is the human-facing showcase page; /v1/arena (its JSON) IS in the contract (agents read it).\nconst DOC_PATHS = new Set(['/', '/wiki', '/guides/getting-started', '/admin', '/arena', '/agents', '/AGENTS.md', '/llms.txt', '/openapi.json', '/consigliere', '/consigliere.js', '/privacy', '/terms', '/dmca', '/resources', '/vendor/walletconnect.js', '/vendor/walletconnect-manifest.json', '/vendor/walletconnect.js.LEGAL.txt']);\n\n// A short, human-legible summary per top-level system (the OpenAPI tag). Anything unmapped falls\n// through to a generic line — the contract stays complete even as new systems land.\n",
          "baseline": "\n// Human/asset routes we don't advertise in the machine API contract (they serve HTML/markdown).\n// /arena is the human-facing showcase page; /v1/arena (its JSON) IS in the contract (agents read it).\nconst DOC_PATHS = new Set(['/', '/wiki', '/admin', '/arena', '/agents', '/AGENTS.md', '/llms.txt', '/openapi.json', '/consigliere', '/consigliere.js', '/privacy', '/terms', '/dmca', '/resources', '/vendor/walletconnect.js', '/vendor/walletconnect-manifest.json', '/vendor/walletconnect.js.LEGAL.txt']);\n\n// A short, human-legible summary per top-level system (the OpenAPI tag). Anything unmapped falls\n// through to a generic line — the contract stays complete even as new systems land.\n"
        },
        {
          "at": 159471,
          "current": "\n## Human reference\n- [Playable console](${baseUrl}/): the web client.\n- [Beginner guide](${baseUrl}/guides/getting-started): choosing a Path, first moves and survival.\n- [The Codex](${baseUrl}/wiki): the full rulebook, every system + loop.\n`;\n}\n",
          "baseline": "\n## Human reference\n- [Playable console](${baseUrl}/): the web client.\n- [The Codex](${baseUrl}/wiki): the full rulebook, every system + loop.\n`;\n}\n"
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
    "src/legal.js": {
      "current": {
        "mode": "100644",
        "blob": "6f47cdce3934792618c1e82661796b33399dde3a",
        "sha256": "cdc88a81c5953e5130799903f1d5ce1d2f224196280d708eb0ea257cb208784f",
        "bytes": 14713
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
          "current": "<li><strong>Connected agents.</strong> Delegated-agent permissions, connection and request records, proposed actions, approvals and results. A third-party AI client you connect can receive the game context allowed by the permissions you grant.</li>\n<li><strong>Technical diagnostics.</strong> We collect information about service performance, errors and reliability. Hosting and network providers may process connection information and maintain operational logs to deliver and protect the service.</li></ul>\n<h2>How we use information</h2><p>We use information to create and authenticate accounts, run the game, deliver messages and requested notifications, keep game and transaction records, process purchases, operate connected-agent features, and provide account support. We use operational activity records to understand service use, diagnose problems, maintain game integrity, enforce rules, prevent fraud and abuse, and investigate security incidents.</p>\n<h2>Cookies, browser storage and analytics</h2><p>We use cookies and browser storage to keep you signed in, remember language, sound and interface preferences, support account access and remember local game settings. Clearing storage may sign you out or reset preferences; keep a recovery method for a guest account.</p><p>Website analytics are optional and off until you choose “Allow counts” under “Analytics choices”. If you allow them, we count public page views and clicks to selected pages in daily totals, retained for up to 90 days. These totals contain no account or wallet identifiers, IP addresses, visitor identifiers, query strings or referrers. They measure events, not unique visitors. Your choice is saved in this browser; you can change it through “Analytics choices” on any public page. We respect Global Privacy Control and Do Not Track by keeping these counts off. Ordinary network and security processing still applies to requests sent to our server.</p><p>In-game screen, quiz-answer and share analytics remain disabled. We do not load advertising pixels or session-replay tools. Quiz answers are processed to calculate your result without being saved as analytics. Operational game and security logging remains active. WalletConnect loads when you select it; its optional telemetry and modal analytics are disabled.</p>\n<h2>When information is shared</h2><p>Hosting and database providers process data needed to run the service. X or Privy handles sign-in when selected. Resend, or the configured email provider, delivers requested emails; your browser's push provider delivers notifications you enable. WalletConnect and blockchain RPC providers support wallet features. See the <a href=\"/resources\">scripts, fonts and service-provider inventory</a>.</p><p>Public game content is shared with its intended audience. Information sent to a third-party AI, identity, wallet or notification provider is also subject to that provider's privacy practices. Providers may process information in a country different from yours. We may disclose information to comply with legal obligations or protect players, investigate misuse and secure the service.</p>\n<h2>How long we keep information</h2><p>We keep information for as long as needed to provide the features you use, maintain game and transaction records, resolve disputes, prevent misuse and meet applicable legal obligations. Retention depends on the type of information and why it is needed. Messages and routine operational records are subject to periodic cleanup; some account, accounting and service-integrity records are retained longer. Provider logs and backups may follow separate retention periods, and backups may retain deleted information until they expire. Public blockchain records remain available independently of OMERTÀ.</p>\n<h2>Your choices and requests</h2><p>You can unsubscribe from a digest using the link in the email or turn it off in Profile. Transaction confirmations are separate from marketing preferences and are emailed where a verified address is available. Disable push notifications in the app or browser and revoke connected-agent access in Consigliere.</p><p>Depending on where you live, you may have rights to request access, correction or deletion of personal information, or to object to certain processing. We may need to verify that a request relates to your account. Some accounting, security or legally required records may need to be retained; deleting an account cannot erase blockchain history.</p>\n",
          "baseline": "<li><strong>Connected agents.</strong> Delegated-agent permissions, connection and request records, proposed actions, approvals and results. A third-party AI client you connect can receive the game context allowed by the permissions you grant.</li>\n<li><strong>Technical diagnostics.</strong> We collect information about service performance, errors and reliability. Hosting and network providers may process connection information and maintain operational logs to deliver and protect the service.</li></ul>\n<h2>How we use information</h2><p>We use information to create and authenticate accounts, run the game, deliver messages and requested notifications, keep game and transaction records, process purchases, operate connected-agent features, and provide account support. We use operational activity records to understand service use, diagnose problems, maintain game integrity, enforce rules, prevent fraud and abuse, and investigate security incidents.</p>\n<h2>Cookies, browser storage and analytics</h2><p>We use cookies and browser storage to keep you signed in, remember language, sound and interface preferences, support account access and remember local game settings. Clearing storage may sign you out or reset preferences; keep a recovery method for a guest account.</p><p>Optional screen, quiz-answer and share analytics are disabled. We do not load advertising pixels or session-replay tools. Quiz answers are processed to calculate your result without being saved as analytics. Operational game and security logging remains active. WalletConnect loads when you select it; its optional telemetry and modal analytics are disabled.</p>\n<h2>When information is shared</h2><p>Hosting and database providers process data needed to run the service. X or Privy handles sign-in when selected. Resend, or the configured email provider, delivers requested emails; your browser's push provider delivers notifications you enable. WalletConnect and blockchain RPC providers support wallet features. See the <a href=\"/resources\">scripts, fonts and service-provider inventory</a>.</p><p>Public game content is shared with its intended audience. Information sent to a third-party AI, identity, wallet or notification provider is also subject to that provider's privacy practices. Providers may process information in a country different from yours. We may disclose information to comply with legal obligations or protect players, investigate misuse and secure the service.</p>\n<h2>How long we keep information</h2><p>We keep information for as long as needed to provide the features you use, maintain game and transaction records, resolve disputes, prevent misuse and meet applicable legal obligations. Retention depends on the type of information and why it is needed. Messages and routine operational records are subject to periodic cleanup; some account, accounting and service-integrity records are retained longer. Provider logs and backups may follow separate retention periods, and backups may retain deleted information until they expire. Public blockchain records remain available independently of OMERTÀ.</p>\n<h2>Your choices and requests</h2><p>You can unsubscribe from a digest using the link in the email or turn it off in Profile. Transaction confirmations are separate from marketing preferences and are emailed where a verified address is available. Disable push notifications in the app or browser and revoke connected-agent access in Consigliere.</p><p>Depending on where you live, you may have rights to request access, correction or deletion of personal information, or to object to certain processing. We may need to verify that a request relates to your account. Some accounting, security or legally required records may need to be retained; deleting an account cannot erase blockchain history.</p>\n"
        },
        {
          "at": 8909,
          "current": "<h2>Changes to this policy</h2><p>We will update this page and its date when our practices change, and provide additional notice or request consent when required.</p>`,\n    terms: `<p>Operator: ${esc(c.name)} · ${esc(c.address)} · ${contact}.</p><section id=\"payments\"><h2>Passes, watches and confirmation</h2><p>Made Man gives you 30 days of access for the displayed $OMR price. Street Wire gives you the displayed tier and duration. Both are prepaid game passes. Buying again extends access, and neither renews automatically. Benefits end when the pass expires unless you buy again.</p><p>Standing Watches automatically spend the displayed $OMR tap price each cycle while the watch is enrolled and eligible. The Wire screen shows the price and interval before enrollment. Select “drop the watch” online to stop future renewals; the tap you already paid for lasts until expiry. You can cancel each watch in the app or with DELETE /v1/wire/watch/:targetId.</p><p>The app confirms purchases immediately. If you have a verified email address, we also queue a transaction confirmation email regardless of your marketing preferences. Keep the confirmation and check your ledger. Wallet transactions and on-chain purchases may have network fees and their own published price. Review each transaction before signing.</p><h2>Refunds and cancellation</h2><p>${esc(c.refunds)}</p><p>Contact ${contact} with the transaction identifier for payment questions or a refund request. These terms do not limit rights provided by applicable law. Cancelling a watch stops future renewals; it does not reverse a cycle you already paid for.</p></section>`,\n    dmca: `<p>${esc(c.name)} hosts player text and other game contributions. Report copyright concerns to the designated agent: ${esc(c.agent)}, ${esc(c.agentAddress)}, telephone ${esc(c.agentPhone)}, <a href=\"mailto:${esc(c.agentEmail)}\">${esc(c.agentEmail)}</a>. Agent registration is available in the <a href=\"https://www.copyright.gov/dmca-directory/\">U.S. Copyright Office directory</a>.</p><h2>Notice of claimed infringement</h2><p>Provide your physical or electronic signature; identify the copyrighted work (or a representative list); identify the allegedly infringing material and its precise location; provide your address, telephone number and email; state your good-faith belief that use is not authorized by the owner, its agent or law; and state that the information is accurate and, under penalty of perjury, that you are authorized to act for the owner.</p><h2>Counter-notice</h2><p>A counter-notice must contain your signature, identify the removed material and its former location, state under penalty of perjury a good-faith belief that removal resulted from mistake or misidentification, and provide your name, address and telephone number. Include consent to the jurisdiction of the federal district court for your address (or, outside the United States, a district where the provider may be found) and acceptance of service from the complainant or its agent.</p><p>The operator reviews notices, handles removal and counter-notices under applicable law, and may terminate access for repeat infringers in appropriate circumstances. Send notices to the agent rather than posting them in public chat.</p>`,\n    resources: `<h2>Browser scripts and fonts</h2><ul><li>This site serves OMERTÀ HTML, inline game code, Consigliere code and shared CSS.</li><li>The locally hosted website analytics script counts public page views and selected link clicks only after you opt in through “Analytics choices”. It sends daily aggregate dimensions without account or visitor identifiers. See the <a href=\"/privacy\">privacy policy</a> for controls and retention.</li><li>WalletConnect Ethereum Provider 2.26.0 and its locked transitive dependencies are bundled at /vendor/walletconnect.js. See the <a href=\"/vendor/walletconnect-manifest.json\">package versions and licenses</a> and <a href=\"/vendor/walletconnect.js.LEGAL.txt\">license notices</a>. The bundle loads only when you choose WalletConnect. It connects to WalletConnect relay/RPC/verification services and api.web3modal.org for wallet discovery. Its analytics and telemetry are disabled.</li><li>The display font, Oswald / Omerta Display, is hosted here at /art/display.woff2. Other font families use system fonts without contacting a font provider.</li><li>The site makes no Google Fonts requests and uses no advertising pixels, third-party analytics scripts or session replay.</li></ul><h2>Optional service providers</h2><p>When selected, X or Privy handles identity and WalletConnect handles wallet pairing. Resend is the default provider for requested email. Your browser’s push service delivers notifications you enable. Muse or another AI client connects only when you choose it. Hosting and database providers depend on the deployment. These services do not supply third-party browser tracking scripts. Network requests may disclose your IP address and the minimum data needed for the service you choose.</p>`,\n  };\n  const body = ready ? bodies[kind] : '<p>This policy is not yet available. Please return later before signing up or buying access.</p>';\n  return { ready, html: `<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>${title} | OMERTÀ</title><link rel=\"stylesheet\" href=\"/omerta-ui.css\"><style>main{max-width:760px;margin:auto;padding:32px 20px;line-height:1.7}a{color:#e0bd72}nav{display:flex;flex-wrap:wrap;gap:16px}</style></head><body><main><nav aria-label=\"Policies\"><a href=\"/\">OMERTÀ</a><a href=\"/privacy\">Privacy</a><a href=\"/terms\">Terms</a><a href=\"/dmca\">Copyright</a><a href=\"/resources\">Resources</a></nav><h1>${title}</h1>${body}</main></body></html>` };\n",
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
        "blob": "06879f17622e4e8983483fc1087144518e941032",
        "sha256": "e69fef7e92cec791f0293a539ebf23f2c1740f61031bfe00197712954a47207d",
        "bytes": 309521
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
          "current": "import * as Invites from './invites.js';\nimport { accessCookie, clearAccessCookie, readAccessCookie } from './access.js';\nimport { legalPage } from './legal.js';\nimport { enhancePage, canonicalOrigin, siteRobots, siteSitemap } from './site-seo.js';\nimport { registerSiteAnalytics } from './site-analytics.js';\nimport * as Discovery from './discovery.js';\nimport * as Mentor from './mentor.js';\nimport * as Streak from './streak.js';\n",
          "baseline": "import * as Invites from './invites.js';\nimport { accessCookie, clearAccessCookie, readAccessCookie } from './access.js';\nimport { legalPage } from './legal.js';\nimport * as Discovery from './discovery.js';\nimport * as Mentor from './mentor.js';\nimport * as Streak from './streak.js';\n"
        },
        {
          "at": 31484,
          "current": "  // invariant worth enforcing (every /v1 route is authed unless explicitly declared public) is about\n  // exactly the routes a refactor is most likely to drop on the floor.\n  app.decorate('routes', routeRegistry);\n  const baseUrl = canonicalOrigin(process.env.PUBLIC_URL || SOCIAL_GAME_URL);\n\n  // ── THE WIRE — what the player actually DOWNLOADS ─────────────────────────────────────────────\n  // tools/pageweight.js measured a cold load of the landing at 5.3 MB on a phone, of which 757 KB was\n",
          "baseline": "  // invariant worth enforcing (every /v1 route is authed unless explicitly declared public) is about\n  // exactly the routes a refactor is most likely to drop on the floor.\n  app.decorate('routes', routeRegistry);\n  const baseUrl = process.env.PUBLIC_URL || SOCIAL_GAME_URL;\n\n  // ── THE WIRE — what the player actually DOWNLOADS ─────────────────────────────────────────────\n  // tools/pageweight.js measured a cold load of the landing at 5.3 MB on a phone, of which 757 KB was\n"
        },
        {
          "at": 35503,
          "current": "  // changes on every deploy, so it is `no-cache` (revalidate, never stale) rather than a max-age, and\n  // an unchanged deploy answers 304 in a few hundred bytes instead of 319 KB. That is the same\n  // reasoning public/sw.js already applies to navigations, one layer down.\n  const publicPageHtml = (html, path) => enhancePage(html, { baseUrl, path })\n    .replace('</head>', '<script src=\"/site-analytics.js\" defer></script></head>');\n  const servePage = (html, extra = {}, path = null) => {\n    if (path) html = publicPageHtml(html, path);\n    const raw = Buffer.from(html, 'utf8');\n    const gz = zlib.gzipSync(raw, { level: 9 });   // level 9: paid once at boot, saved on every hit\n    const etag = '\"' + crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16) + '\"';\n",
          "baseline": "  // changes on every deploy, so it is `no-cache` (revalidate, never stale) rather than a max-age, and\n  // an unchanged deploy answers 304 in a few hundred bytes instead of 319 KB. That is the same\n  // reasoning public/sw.js already applies to navigations, one layer down.\n  const servePage = (html, extra = {}) => {\n    const raw = Buffer.from(html, 'utf8');\n    const gz = zlib.gzipSync(raw, { level: 9 });   // level 9: paid once at boot, saved on every hit\n    const etag = '\"' + crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16) + '\"';\n"
        },
        {
          "at": 38767,
          "current": "  const inviteHtml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'invite.html'), 'utf8');\n  const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization, Accept-Encoding',\n    'Referrer-Policy': 'no-referrer' };\n  const invitePage = servePage(inviteHtml, privateHeaders, '/');\n  const gamePage = servePage(clientHtml, privateHeaders, '/');\n  const notFoundHtml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', '404.html'), 'utf8');\n  app.setNotFoundHandler(async (req, reply) => {\n    const path = req.url.split('?')[0];\n    const accept = String(req.headers.accept || '');\n    const navigation = ['GET', 'HEAD'].includes(req.method)\n      && !/^\\/(?:v1|site-analytics|art|vendor)(?:\\/|$)/.test(path)\n      && (accept.includes('text/html') || (!accept && !/\\.[a-z0-9]+$/i.test(path)));\n    reply.code(404).header('Cache-Control', 'no-store').header('X-Robots-Tag', 'noindex');\n    if (navigation) return reply.type('text/html; charset=utf-8').send(notFoundHtml);\n    return reply.send({ statusCode: 404, error: 'Not Found', message: 'Route not found' });\n  });\n  // A bearer can restore an existing browser session. The separate cookie only opens public views;\n  // gameplay routes continue to demand their bearer and all existing server authority checks.\n  const hasViewAccess = async (req) => {\n",
          "baseline": "  const inviteHtml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'invite.html'), 'utf8');\n  const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization, Accept-Encoding',\n    'Referrer-Policy': 'no-referrer' };\n  const invitePage = servePage(inviteHtml, privateHeaders);\n  const gamePage = servePage(clientHtml, privateHeaders);\n  // A bearer can restore an existing browser session. The separate cookie only opens public views;\n  // gameplay routes continue to demand their bearer and all existing server authority checks.\n  const hasViewAccess = async (req) => {\n"
        },
        {
          "at": 41052,
          "current": "  try { adminHtml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'admin.html'), 'utf8'); } catch { /* headless */ }\n  // (red-team R20) the mod ops console — deny framing (clickjacking defense-in-depth; the dashboard holds\n  // the mod key in sessionStorage and drives confiscate/ban/mint). No CSP (would break its inline scripts).\n  app.get('/admin', servePage(enhancePage(adminHtml, { baseUrl, path: '/admin', indexable: false }),\n    { 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex' }));\n  // the CODEX: the in-game wiki — every system + gameplay loop (public/wiki.html); public, read-only\n  let wikiHtml = '<!doctype html><title>OMERTA codex</title><p>Codex file missing (public/wiki.html).</p>';\n  try { wikiHtml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'wiki.html'), 'utf8'); } catch { /* headless */ }\n  app.get('/wiki', servePage(wikiHtml, {}, '/wiki'));\n  // THE ARENA: the public, keyless agent showcase (public/arena.html) — \"watch the machines run the\n  // city.\" The agent differentiator AND a shareable/indexable marketing surface, in one. Read-only,\n  // fetches GET /v1/arena for its data; §10.4-free (banded, no exact per-agent liquid).\n  let arenaHtml = '<!doctype html><title>OMERTA arena</title><p>Arena file missing (public/arena.html).</p>';\n  try { arenaHtml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'arena.html'), 'utf8'); } catch { /* headless */ }\n  app.get('/arena', servePage(arenaHtml, {}, '/arena'));\n\n  // The no-code onboarding walkthrough (set up Claude Desktop to play via the MCP connector).\n  let playHtml = '<!doctype html><title>Play OMERTA with Claude</title><p>Walkthrough file missing (public/play.html).</p>';\n  try { playHtml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'play.html'), 'utf8'); } catch { /* headless */ }\n  app.get('/play', servePage(playHtml, {}, '/play'));\n  const gettingStartedHtml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'getting-started.html'), 'utf8');\n  app.get('/guides/getting-started', servePage(gettingStartedHtml, {}, '/guides/getting-started'));\n  // Public token sale; auction figures remain unavailable until the auction is connected.\n  let saleHtml = '<!doctype html><title>$OMR token sale | OMERTÀ</title><p>Token sale page unavailable.</p>';\n  try { saleHtml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sale.html'), 'utf8'); } catch { /* headless */ }\n  app.get('/sale', servePage(saleHtml, {}, '/sale'));\n  for (const [url, kind] of Object.entries({ '/privacy': 'privacy', '/terms': 'terms', '/dmca': 'dmca', '/resources': 'resources' })) {\n    app.get(url, async (req, reply) => {\n      const page = legalPage(kind);\n      const html = page.ready ? publicPageHtml(page.html, url)\n        : enhancePage(page.html, { baseUrl, path: url, indexable: false });\n      if (!page.ready) reply.header('X-Robots-Tag', 'noindex');\n      return reply.code(page.ready ? 200 : 503).header('Cache-Control', 'no-store').type('text/html; charset=utf-8').send(html);\n    });\n  }\n  app.get('/vendor/walletconnect.js', async (req, reply) => reply.type('application/javascript; charset=utf-8')\n",
          "baseline": "  try { adminHtml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'admin.html'), 'utf8'); } catch { /* headless */ }\n  // (red-team R20) the mod ops console — deny framing (clickjacking defense-in-depth; the dashboard holds\n  // the mod key in sessionStorage and drives confiscate/ban/mint). No CSP (would break its inline scripts).\n  app.get('/admin', servePage(adminHtml, { 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' }));\n  // the CODEX: the in-game wiki — every system + gameplay loop (public/wiki.html); public, read-only\n  let wikiHtml = '<!doctype html><title>OMERTA codex</title><p>Codex file missing (public/wiki.html).</p>';\n  try { wikiHtml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'wiki.html'), 'utf8'); } catch { /* headless */ }\n  app.get('/wiki', servePage(wikiHtml));\n  // THE ARENA: the public, keyless agent showcase (public/arena.html) — \"watch the machines run the\n  // city.\" The agent differentiator AND a shareable/indexable marketing surface, in one. Read-only,\n  // fetches GET /v1/arena for its data; §10.4-free (banded, no exact per-agent liquid).\n  let arenaHtml = '<!doctype html><title>OMERTA arena</title><p>Arena file missing (public/arena.html).</p>';\n  try { arenaHtml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'arena.html'), 'utf8'); } catch { /* headless */ }\n  app.get('/arena', servePage(arenaHtml));\n\n  // The no-code onboarding walkthrough (set up Claude Desktop to play via the MCP connector).\n  let playHtml = '<!doctype html><title>Play OMERTA with Claude</title><p>Walkthrough file missing (public/play.html).</p>';\n  try { playHtml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'play.html'), 'utf8'); } catch { /* headless */ }\n  app.get('/play', servePage(playHtml));\n  // Public token sale; auction figures remain unavailable until the auction is connected.\n  let saleHtml = '<!doctype html><title>$OMR token sale | OMERTÀ</title><p>Token sale page unavailable.</p>';\n  try { saleHtml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sale.html'), 'utf8'); } catch { /* headless */ }\n  app.get('/sale', servePage(saleHtml));\n  for (const [url, kind] of Object.entries({ '/privacy': 'privacy', '/terms': 'terms', '/dmca': 'dmca', '/resources': 'resources' })) {\n    app.get(url, async (req, reply) => {\n      const page = legalPage(kind);\n      return reply.code(page.ready ? 200 : 503).header('Cache-Control', 'no-store').type('text/html; charset=utf-8').send(page.html);\n    });\n  }\n  app.get('/vendor/walletconnect.js', async (req, reply) => reply.type('application/javascript; charset=utf-8')\n"
        },
        {
          "at": 45081,
          "current": "  // THE PATH FINDER — a public, server-rendered acquisition funnel. The content manifest derives its\n  // numbers from rules.js, the POST below owns scoring, and each result gets a stable indexable URL\n  // with its own OG image. Prepared once at boot like the other public pages: no per-hit rendering.\n  app.get('/path', servePage(renderPathQuizPage({ baseUrl }), {}, '/path'));\n  const pathPages = new Map(PATH_IDS.map((id) => [id, servePage(renderPathResultPage(id, { baseUrl }), {}, `/path/${id}`)]));\n  app.get('/path/:id', async (req, reply) => {\n    const page = pathPages.get(String(req.params.id || '').toLowerCase());\n    if (!page) return reply.callNotFound();\n    return page(req, reply);\n  });\n  // Shared interface tokens and public-shell primitives. Keeping this as a tiny, explicit asset route\n",
          "baseline": "  // THE PATH FINDER — a public, server-rendered acquisition funnel. The content manifest derives its\n  // numbers from rules.js, the POST below owns scoring, and each result gets a stable indexable URL\n  // with its own OG image. Prepared once at boot like the other public pages: no per-hit rendering.\n  app.get('/path', servePage(renderPathQuizPage({ baseUrl })));\n  const pathPages = new Map(PATH_IDS.map((id) => [id, servePage(renderPathResultPage(id, { baseUrl }))]));\n  app.get('/path/:id', async (req, reply) => {\n    const page = pathPages.get(String(req.params.id || '').toLowerCase());\n    if (!page) return reply.code(404).type('text/html; charset=utf-8')\n      .send('<!doctype html><title>Path not found | OMERTÀ</title><p>This doctrine is not in the city.</p>');\n    return page(req, reply);\n  });\n  // Shared interface tokens and public-shell primitives. Keeping this as a tiny, explicit asset route\n"
        },
        {
          "at": 46302,
          "current": "    .header('cache-control', 'no-cache').send(uiCss));\n  // City scenes are optional local assets; gameplay remains authoritative through the API.\n  for (const [file, type] of [\n    ['site-analytics.js', 'application/javascript'],\n    ['city-scene.js', 'application/javascript'], ['city-scene.css', 'text/css'], ['city-world-layout.js', 'application/javascript'],\n    ['city-world-ui.js', 'application/javascript'], ['city-world-ui.css', 'text/css'],\n    ['city-home-ui.js', 'application/javascript'], ['city-adventure-ui.js', 'application/javascript'],\n",
          "baseline": "    .header('cache-control', 'no-cache').send(uiCss));\n  // City scenes are optional local assets; gameplay remains authoritative through the API.\n  for (const [file, type] of [\n    ['city-scene.js', 'application/javascript'], ['city-scene.css', 'text/css'], ['city-world-layout.js', 'application/javascript'],\n    ['city-world-ui.js', 'application/javascript'], ['city-world-ui.css', 'text/css'],\n    ['city-home-ui.js', 'application/javascript'], ['city-adventure-ui.js', 'application/javascript'],\n"
        },
        {
          "at": 48964,
          "current": "  // runs fullscreen. Read once at boot (the sw.js/index precedent); a missing file degrades, never crashes.\n  const pub = (f) => join(dirname(fileURLToPath(import.meta.url)), '..', 'public', f);\n  // Explicit public pages and reviewed deployment modules: no user-controlled file path.\n  const defiPage = servePage(readFileSync(pub('defi.html'), 'utf8'), {}, '/defi');\n  app.get('/defi', defiPage);\n  app.get('/defi.html', defiPage);\n  const feeflowsPage = servePage(readFileSync(pub('fee-flows.html'), 'utf8'), {}, '/fee-flows');\n  app.get('/fee-flows', feeflowsPage);\n  app.get('/fee-flows.html', feeflowsPage);\n  const genesisdeployPage = servePage(enhancePage(readFileSync(pub('genesis-deploy.html'), 'utf8'),\n    { baseUrl, path: '/genesis-deploy', indexable: false }), { 'X-Robots-Tag': 'noindex' });\n  app.get('/genesis-deploy', genesisdeployPage);\n  app.get('/genesis-deploy.html', genesisdeployPage);\n  const reviewedModule = name => {\n",
          "baseline": "  // runs fullscreen. Read once at boot (the sw.js/index precedent); a missing file degrades, never crashes.\n  const pub = (f) => join(dirname(fileURLToPath(import.meta.url)), '..', 'public', f);\n  // Explicit public pages and reviewed deployment modules: no user-controlled file path.\n  const defiPage = servePage(readFileSync(pub('defi.html'), 'utf8'));\n  app.get('/defi', defiPage);\n  app.get('/defi.html', defiPage);\n  const feeflowsPage = servePage(readFileSync(pub('fee-flows.html'), 'utf8'));\n  app.get('/fee-flows', feeflowsPage);\n  app.get('/fee-flows.html', feeflowsPage);\n  const genesisdeployPage = servePage(readFileSync(pub('genesis-deploy.html'), 'utf8'));\n  app.get('/genesis-deploy', genesisdeployPage);\n  app.get('/genesis-deploy.html', genesisdeployPage);\n  const reviewedModule = name => {\n"
        },
        {
          "at": 51381,
          "current": "  // the app icons — binary PNGs, served from a filename allowlist Map (the /art precedent; no traversal\n  // surface by construction) with a long cache (they change only on a redeploy).\n  const PWA_ICONS = new Map();\n  for (const f of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'site-share.png']) {\n    try { PWA_ICONS.set(f, readFileSync(pub(f))); } catch { /* headless */ }\n  }\n  for (const [name, buf] of PWA_ICONS) {\n",
          "baseline": "  // the app icons — binary PNGs, served from a filename allowlist Map (the /art precedent; no traversal\n  // surface by construction) with a long cache (they change only on a redeploy).\n  const PWA_ICONS = new Map();\n  for (const f of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png']) {\n    try { PWA_ICONS.set(f, readFileSync(pub(f))); } catch { /* headless */ }\n  }\n  for (const [name, buf] of PWA_ICONS) {\n"
        },
        {
          "at": 71437,
          "current": "  // robots.txt — every crawler (incl. all AI agents: GPTBot, ClaudeBot, Google-Extended, PerplexityBot,\n  // xAI/Grok, open-source fetchers) is explicitly WELCOME and pointed at the machine surfaces. Agents\n  // are first-class players here, so the default-allow is stated rather than implied by a 404.\n  app.get('/robots.txt', async (req, reply) => reply.type('text/plain; charset=utf-8').send(siteRobots(baseUrl)));\n  app.get('/sitemap.xml', async (req, reply) => reply.type('application/xml; charset=utf-8')\n    .header('cache-control', 'public, max-age=3600').send(\n      siteSitemap(baseUrl, { legalReady: { terms: legalPage('terms').ready, dmca: legalPage('dmca').ready } })));\n  // OpenAPI 3.1 of every mounted route — built once, after all routes register (deferred to first hit).\n  let openApiCache = null;\n  app.get('/openapi.json', async () => (openApiCache ||= buildOpenApi(routeRegistry, { baseUrl })));\n",
          "baseline": "  // robots.txt — every crawler (incl. all AI agents: GPTBot, ClaudeBot, Google-Extended, PerplexityBot,\n  // xAI/Grok, open-source fetchers) is explicitly WELCOME and pointed at the machine surfaces. Agents\n  // are first-class players here, so the default-allow is stated rather than implied by a 404.\n  app.get('/robots.txt', async (req, reply) => reply.type('text/plain; charset=utf-8').send(\n    ['# OMERTÀ — all crawlers and AI agents welcome. Agents are first-class players.',\n      '# Machine surfaces: /llms.txt (index) · /agents (agent guide) · /openapi.json (API contract) · /play (no-code setup)',\n      `# Start here: ${baseUrl}/llms.txt`,\n      'User-agent: *', 'Allow: /', `Sitemap: ${baseUrl}/sitemap.xml`].join('\\n') + '\\n'));\n  app.get('/sitemap.xml', async (req, reply) => reply.type('application/xml; charset=utf-8')\n    .header('cache-control', 'public, max-age=3600').send(\n      `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\\n`\n      + ['/', '/wiki', '/arena', '/play', '/agents'].map((path) => `  <url><loc>${baseUrl}${path}</loc></url>`).join('\\n')\n      + '\\n</urlset>\\n'));\n  // OpenAPI 3.1 of every mounted route — built once, after all routes register (deferred to first hit).\n  let openApiCache = null;\n  app.get('/openapi.json', async () => (openApiCache ||= buildOpenApi(routeRegistry, { baseUrl })));\n"
        },
        {
          "at": 90293,
          "current": "      && routeRegistry.some((route) => route.method === req.method\n        && route.url === req.routeOptions.url && route.authKind === 'modAuth')) await modAuth(req, reply);\n  });\n  registerSiteAnalytics(app, { pool, modAuth, baseUrl });\n  registerRwa(app, {\n    pool, auth, modAuth, withCharacter: G.withCharacter, reviewerRouteTrust: rwaReviewerRouteTrust,\n  });\n",
          "baseline": "      && routeRegistry.some((route) => route.method === req.method\n        && route.url === req.routeOptions.url && route.authKind === 'modAuth')) await modAuth(req, reply);\n  });\n  registerRwa(app, {\n    pool, auth, modAuth, withCharacter: G.withCharacter, reviewerRouteTrust: rwaReviewerRouteTrust,\n  });\n"
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
    "test/gates.js": {
      "current": {
        "mode": "100644",
        "blob": "3defd01ee988772bcd1686242a31b9f74f30b23c",
        "sha256": "bd940f0a7710ba1b9fe9309bb16dadd5fe135bfc3a134acf43cefd7d8d07d0e6",
        "bytes": 480228
      },
      "baseline": {
        "mode": "100644",
        "blob": "e68dc6ff306b95845f786b918c9082e03292cff0",
        "sha256": "a97332e0ceb380dfeff0b55c96d642463f9ba03437e4717d0ca502671ff6af8e",
        "bytes": 478102
      },
      "inverses": [
        {
          "at": 364568,
          "current": "  const coreParts = splitNative(coreNative), economyParts = splitNative(economyNative), enterpriseParts = splitNative(enterpriseNative);\n  const expectedUxNativeStep = \"      - name: UX metadata concurrency, membership and RLS (disposable PostgreSQL)\\n        env:\\n          UX_TEST_DATABASE_URL: postgres://postgres:pgcheck@127.0.0.1:5432/omerta_check\\n        run: npm run test:ux:postgres\";\n  const uxNativeParts = coreParts.steps.filter(part => part.includes('      - name: UX metadata concurrency, membership and RLS (disposable PostgreSQL)'));\n  const expectedSiteAnalyticsNativeStep = \"      - name: Optional website counts on real PostgreSQL\\n        env:\\n          SITE_ANALYTICS_TEST_DATABASE_URL: postgres://postgres:pgcheck@127.0.0.1:5432/omerta_check\\n          DATABASE_URL: ''\\n        run: node test/site-analytics.js --postgres\";\n  const assertSiteAnalyticsNativeStep = block => {\n    const parts = splitNative(block).steps.filter(part => part.includes('      - name: Optional website counts on real PostgreSQL'));\n    assert.equal(parts.length, 1, 'Exactly one complete website aggregate PostgreSQL proof is required');\n    assert.equal(nativeShape(parts[0]), nativeShape(expectedSiteAnalyticsNativeStep),\n      'Optional website counts retain their explicit disposable endpoint, bare native command and unconditional execution');\n  };\n  assertSiteAnalyticsNativeStep(coreNative);\n  assertSiteAnalyticsNativeStep(coreNative.replaceAll('\\n', '\\r\\n'));\n  const siteAnalyticsNativeBlock = coreNative.replaceAll('\\r\\n', '\\n');\n  assert.equal(siteAnalyticsNativeBlock.split(expectedSiteAnalyticsNativeStep).length, 2);\n  for (const change of [expectedSiteAnalyticsNativeStep.replace('        env:', '        if: false\\n        env:'),\n    expectedSiteAnalyticsNativeStep.replace('        env:', '        continue-on-error: true\\n        env:'),\n    expectedSiteAnalyticsNativeStep.replace('127.0.0.1', 'remote.invalid'),\n    expectedSiteAnalyticsNativeStep.replace(' --postgres', ''), expectedSiteAnalyticsNativeStep + ' --partial'])\n    assert.throws(() => assertSiteAnalyticsNativeStep(siteAnalyticsNativeBlock.replace(expectedSiteAnalyticsNativeStep, change)),\n      'Skipped, optional, remote, non-native or partial website proofs must reject');\n  assert.throws(() => assertSiteAnalyticsNativeStep(siteAnalyticsNativeBlock.replace(expectedSiteAnalyticsNativeStep, '')));\n  assert.throws(() => assertSiteAnalyticsNativeStep(siteAnalyticsNativeBlock.replace(expectedSiteAnalyticsNativeStep,\n    expectedSiteAnalyticsNativeStep + '\\n' + expectedSiteAnalyticsNativeStep)));\n  assert.equal(uxNativeParts.length, 1, 'Exactly one complete UX native metadata and RLS proof is required');\n  assert.equal(nativeShape(uxNativeParts[0]), nativeShape(expectedUxNativeStep), 'UX native proof keeps its disposable endpoint, complete command and unconditional execution');\n  for (const changed of [expectedUxNativeStep.replace('test:ux:postgres', 'test:ux:postgres -- --partial'), expectedUxNativeStep.replace('        env:', '        if: false\\n        env:'), expectedUxNativeStep.replace('        env:', '        continue-on-error: true\\n        env:')])\n",
          "baseline": "  const coreParts = splitNative(coreNative), economyParts = splitNative(economyNative), enterpriseParts = splitNative(enterpriseNative);\n  const expectedUxNativeStep = \"      - name: UX metadata concurrency, membership and RLS (disposable PostgreSQL)\\n        env:\\n          UX_TEST_DATABASE_URL: postgres://postgres:pgcheck@127.0.0.1:5432/omerta_check\\n        run: npm run test:ux:postgres\";\n  const uxNativeParts = coreParts.steps.filter(part => part.includes('      - name: UX metadata concurrency, membership and RLS (disposable PostgreSQL)'));\n  assert.equal(uxNativeParts.length, 1, 'Exactly one complete UX native metadata and RLS proof is required');\n  assert.equal(nativeShape(uxNativeParts[0]), nativeShape(expectedUxNativeStep), 'UX native proof keeps its disposable endpoint, complete command and unconditional execution');\n  for (const changed of [expectedUxNativeStep.replace('test:ux:postgres', 'test:ux:postgres -- --partial'), expectedUxNativeStep.replace('        env:', '        if: false\\n        env:'), expectedUxNativeStep.replace('        env:', '        continue-on-error: true\\n        env:')])\n"
        },
        {
          "at": 397612,
          "current": "  // an unnamed `- run: command`, a named step's `run: command`, and their literal `|` bodies.\n  // Unknown block scalar syntax fails closed so a new shape cannot quietly stop being inventoried.\n  const exactNativeNodeCommands = new Set([\n    'node test/site-analytics.js --postgres',\n    'node test/db-rls.js --postgres',\n    'node test/payment-receipts-postgres.js',\n    'node test/deeds-supply-postgres.js',\n",
          "baseline": "  // an unnamed `- run: command`, a named step's `run: command`, and their literal `|` bodies.\n  // Unknown block scalar syntax fails closed so a new shape cannot quietly stop being inventoried.\n  const exactNativeNodeCommands = new Set([\n    'node test/db-rls.js --postgres',\n    'node test/payment-receipts-postgres.js',\n    'node test/deeds-supply-postgres.js',\n"
        },
        {
          "at": 401376,
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
    "test/routes.js": {
      "current": {
        "mode": "100644",
        "blob": "bd6f1b9f497c8d41fa54b7d7bd1102bc24d45953",
        "sha256": "0a4e9693b75fdca326176a87a66e8f696f45a891ce0f49a9f122b0777e0bb642",
        "bytes": 42431
      },
      "baseline": {
        "mode": "100644",
        "blob": "bfb75827c7eaf8e20c2ba4c2b1c03da06331a775",
        "sha256": "d59a3c8b0f2ea124726231568978312e1552fb343d2fc86f0df1965876ce4c62",
        "bytes": 42288
      },
      "inverses": [
        {
          "at": 33731,
          "current": "//\n//   • text compresses when the client asks, and MATERIALLY (a hook that ran and saved nothing would\n//     read exactly like a hook that works)\n//   • identity preserves the file's body after public metadata is added to the head — a client\n//     that cannot decode gzip must still get the complete playable console\n//   • the gzip DECODES to the same bytes. A corrupt stream is the worst failure here: the page is\n//     blank and nothing 500s.\n//   • Vary: Accept-Encoding on BOTH branches, or a shared cache hands the compressed copy to a\n",
          "baseline": "//\n//   • text compresses when the client asks, and MATERIALLY (a hook that ran and saved nothing would\n//     read exactly like a hook that works)\n//   • identity is honoured, byte-for-byte against the file on disk — a client that cannot decode\n//     gzip must get the real thing, not a corrupted one\n//   • the gzip DECODES to the same bytes. A corrupt stream is the worst failure here: the page is\n//     blank and nothing 500s.\n//   • Vary: Accept-Encoding on BOTH branches, or a shared cache hands the compressed copy to a\n"
        },
        {
          "at": 36456,
          "current": "  assert(raw.length > 200_000, `the shell is ${raw.length} bytes — this check is sized for the real one`);\n  assert(gz.rawPayload.length < raw.length * 0.6,\n    `GET / compressed to ${gz.rawPayload.length} of ${raw.length} — the hook ran but saved almost nothing`);\n  const source = raw.toString('utf8');\n  assert.ok(id.body.slice(id.body.indexOf('</head>') + 7) === source.slice(source.indexOf('</head>') + 7),\n    'metadata enhancement must preserve the complete document body');\n  assert.deepEqual(zlib.gunzipSync(gz.rawPayload), id.rawPayload,\n    'the gzipped shell must DECODE to the identity response — a corrupt stream is a blank page and no 500');\n  for (const [name, r] of [['gzip', gz], ['identity', id]])\n    assert(/accept-encoding/i.test(String(r.headers.vary || '')),\n      `the ${name} branch must send Vary: Accept-Encoding, or a shared cache serves the wrong copy`);\n",
          "baseline": "  assert(raw.length > 200_000, `the shell is ${raw.length} bytes — this check is sized for the real one`);\n  assert(gz.rawPayload.length < raw.length * 0.6,\n    `GET / compressed to ${gz.rawPayload.length} of ${raw.length} — the hook ran but saved almost nothing`);\n  assert.equal(id.rawPayload.length, raw.length, 'the identity branch must be the file on disk, byte for byte');\n  assert.deepEqual(zlib.gunzipSync(gz.rawPayload), raw,\n    'the gzipped shell must DECODE to the file — a corrupt stream is a blank page and no 500');\n  for (const [name, r] of [['gzip', gz], ['identity', id]])\n    assert(/accept-encoding/i.test(String(r.headers.vary || '')),\n      `the ${name} branch must send Vary: Accept-Encoding, or a shared cache serves the wrong copy`);\n"
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
    "public/site-analytics.js": {
      "mode": "100644",
      "blob": "5e8086d82cd9e4bca51733c202819c94f318f5ef",
      "sha256": "2ae989a7a592506cac5afb38d4b6f409c3205c2637298f34c51ddeac07430e42",
      "bytes": 4308
    },
    "src/site-analytics.js": {
      "mode": "100644",
      "blob": "f81feabc6244cfb20660e028fcfbc1c23d558322",
      "sha256": "3cd60da105764971c619514f4d155c4f81d565e15353fe188b908eff508aac1b",
      "bytes": 4865
    },
    "src/site-seo.js": {
      "mode": "100644",
      "blob": "f36e780b6a60c2b72f8cb649502f93b9f1e060ab",
      "sha256": "a00cbdee06d8660a771ab7238ce00cea20b313c69aee9588c6e25598cc32d290",
      "bytes": 7654
    },
    "test/site-analytics-isolation.js": {
      "mode": "100644",
      "blob": "73af57531e3c3f023ef6bb24a47a99a7386740f8",
      "sha256": "8756f11a326e4fe0818aebe4c9ad5312eccc7e31eaff25ad9d25ec4bc0c2c909",
      "bytes": 2804
    },
    "test/site-analytics.js": {
      "mode": "100644",
      "blob": "4e3d1a8e9274aab90666b557a1f79c3700aa12e2",
      "sha256": "6d06316795b9aaab5ceee3cc68d699548b517192c779feeec8c77cee542acdb1",
      "bytes": 13124
    },
    "test/site-basics-source-transfer.js": {
      "mode": "100644",
      "blob": "506ec6f01c083992674222c2362884900160abee",
      "sha256": "3165ca32398a1e1c9a197ad11cdd3a71e5a510747acdf97c6adb94a4b3102e2f",
      "bytes": 5689
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
    "tools/site-basics-source-seal.js": {
      "mode": "100644",
      "blob": "3fa6f4a17941f2d6b0e8a99148aeb3a08ee26f3c",
      "sha256": "5ffd3e51d6572fb79fda737298c1fbd54461de7c850c403a6f9b5e2862538ce5",
      "bytes": 4172
    },
    "tools/site-basics-source-transfer.js": {
      "mode": "100644",
      "blob": "331bded367cd3b7b80862017913ecfcae307f47f",
      "sha256": "cd9cfbdf3d870d10524dfb82af54c862f008bf5e93b9c79bf7559363d40bc258",
      "bytes": 4576
    }
  }
});
export const SITE_BASICS_SOURCE_SHA256 = '550e71fd26621d20fda0a001576a88bc367eb77cffb22f708df2e3c7a0bdb377';
