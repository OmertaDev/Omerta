// Exact age-removal historical comparison only; no execution or deployment results transferred.
const freeze = value => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const AGE_REMOVAL_SOURCE = freeze({
  "status": "SEALED",
  "phase": "EXACT_AGE_REMOVAL_SOURCE_COMPARISON_ONLY",
  "revision": "438d699030e1604663955f21995f98e9f142f17c",
  "tree": "b0c8baa69d1f1841fc39a9483406afefc1be3096",
  "predecessor": "35913ec1b448275b227019ede2a2ef8047be55aa",
  "predecessorTree": "c74c606d97ee2f8ebb6c5201a4ddd2c2781d5db0",
  "files": {
    ".github/workflows/ci.yml": {
      "current": {
        "mode": "100644",
        "blob": "f44ec29d6d170b1c43e69b8f48a5098cbd7e3d46",
        "sha256": "0705cb89a23235c5a8316331c734eb19bfe85fa4777ea3ee8a69b5466799a681",
        "bytes": 84274
      },
      "baseline": {
        "mode": "100644",
        "blob": "1c80774dce6249309d3dee29e5d18335ccb14152",
        "sha256": "3ab77e4756025b66bfbdce5f8802ff1e4607564ce767c12bdb1ff90d75df1670",
        "bytes": 83850
      },
      "inverses": [
        {
          "at": 16588,
          "current": "            await client.connect();\n            assert.deepEqual((await client.query('SELECT current_user AS role,current_database() AS database,inet_server_port() AS port')).rows,\n              [{ role: 'postgres', database: 'postgres', port: 5432 }]);\n            const existing = await client.query('SELECT datname FROM pg_database WHERE datname IN ($1,$2,$3)', ['omerta_check', 'omerta_query', 'omerta_task_puzzles_ci']);\n            assert.deepEqual(existing.rows, [], 'Owned migration fixture databases must not pre-exist');\n            await client.query('CREATE DATABASE omerta_check');\n            await client.query('CREATE DATABASE omerta_query');\n            await client.query('CREATE DATABASE omerta_task_puzzles_ci');\n            assert.deepEqual((await client.query('SELECT datname,pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname IN ($1,$2,$3) ORDER BY datname', ['omerta_check', 'omerta_query', 'omerta_task_puzzles_ci'])).rows,\n              [{ datname: 'omerta_check', owner: 'postgres' }, { datname: 'omerta_query', owner: 'postgres' }, { datname: 'omerta_task_puzzles_ci', owner: 'postgres' }]);\n          } finally { await client.end(); }\n          NODE\n\n",
          "baseline": "            await client.connect();\n            assert.deepEqual((await client.query('SELECT current_user AS role,current_database() AS database,inet_server_port() AS port')).rows,\n              [{ role: 'postgres', database: 'postgres', port: 5432 }]);\n            const existing = await client.query('SELECT datname FROM pg_database WHERE datname IN ($1,$2)', ['omerta_check', 'omerta_query']);\n            assert.deepEqual(existing.rows, [], 'Owned migration fixture databases must not pre-exist');\n            await client.query('CREATE DATABASE omerta_check');\n            await client.query('CREATE DATABASE omerta_query');\n            assert.deepEqual((await client.query('SELECT datname,pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname IN ($1,$2) ORDER BY datname', ['omerta_check', 'omerta_query'])).rows,\n              [{ datname: 'omerta_check', owner: 'postgres' }, { datname: 'omerta_query', owner: 'postgres' }]);\n          } finally { await client.end(); }\n          NODE\n\n"
        },
        {
          "at": 19129,
          "current": "          SOCIAL_VERIFY_MODE: 'off'\n          POPULATION_OFF: 'on'\n        run: npm run test:questing:postgres\n      - name: Native task puzzle issuance, job races and rollback\n        env:\n          TASK_PUZZLE_TEST_DATABASE_URL: postgres://postgres:pgcheck@127.0.0.1:5432/omerta_task_puzzles_ci\n        run: npm run test:task-puzzles:postgres\n\n  ux_browser:\n    name: UX desktop and mobile regression\n",
          "baseline": "          SOCIAL_VERIFY_MODE: 'off'\n          POPULATION_OFF: 'on'\n        run: npm run test:questing:postgres\n\n  ux_browser:\n    name: UX desktop and mobile regression\n"
        }
      ]
    },
    "AGENTS.md": {
      "current": {
        "mode": "100644",
        "blob": "5f0f0fa5343c3de31679c1a43ee258d2074fdd66",
        "sha256": "ca2361d56588728be04b1cf735789ffd125243cfa44ef26dd3c0d26a43f04ba3",
        "bytes": 52177
      },
      "baseline": {
        "mode": "100644",
        "blob": "a4e85493e8cf0c9218323bca2c1c47891d611a8c",
        "sha256": "38eb8602fec3af443a7125073adcc5c82e03930eff1a51b4e1c99ea23de3d987",
        "bytes": 50024
      },
      "inverses": [
        {
          "at": 5197,
          "current": "1. **Create an agent identity.** New agents call `POST /v1/auth/agent` with a\n   securely persisted, random 32-byte unpadded-base64url `bootstrapSecret`.\n   The account is permanently marked as an agent before its first 90-day bearer\n   is issued. Retry the same secret after an ambiguous response; save the bearer\n   before acknowledging bootstrap. Existing authenticated accounts can become\n   permanent agents through `POST /v1/auth/agent-key`.\n2. **Bring and link an EVM wallet.** Agent auth does not create a custodial\n",
          "baseline": "1. **Create an agent identity.** New agents call `POST /v1/auth/agent` with a\n   securely persisted, random 32-byte unpadded-base64url `bootstrapSecret`.\n   The account is permanently marked as an agent before its first 90-day bearer\n   is issued, so no birth date is needed. Human signup still requires its age\n   check. Retry the same secret after an ambiguous response; save the bearer\n   before acknowledging bootstrap. Existing authenticated accounts can become\n   permanent agents through `POST /v1/auth/agent-key`.\n2. **Bring and link an EVM wallet.** Agent auth does not create a custodial\n"
        },
        {
          "at": 9475,
          "current": "\n## How to earn\n\n### Task puzzles\n\nMissions `m2`, `m11`, and `m12` require a puzzle. Hustle step 1 requires a\npuzzle as well as real legwork and the correct district. The mission catalog\nand Hustle board publish `puzzle: {required, scope, targetId}` metadata.\nCrimes offer optional preparation with explanatory feedback only. Preparation\nnever raises rewards, XP, item drops, or success odds. Ordinary crime without\npreparation remains valid. Puzzles are gameplay, not human verification.\n\n- `POST /v1/task-puzzles` with exactly `{scope,targetId}` issues or resumes the\n  current puzzle. Scope is `mission`, `hustle`, or `crime`. Target is a selected\n  mission ID, `legwork` after meeting the Hustle contact, or a valid crime ID.\n- `GET /v1/task-puzzles?scope=...&targetId=...` returns `{puzzle}` or\n  `{puzzle:null}` without issuing. A refresh keeps the same ID and constraints.\n- Solve the public constraints, using the hint if needed. Send\n  `puzzle:{id,answer}` in the existing mission, Hustle advance, or crime body.\n  Answer shapes are `patrol:{start:integer}`, `route:{path:string[]}` (including\n  start and end), `matching:{pairs:[{left,right}]}`, or `evidence:{suspect:string}`.\n  Extra answer fields are refused. `/openapi.json` describes every shape.\n- Verification and consumption commit together with the job. Success includes\n  `puzzle:{id,version,kind,completed:true,message}` feedback. Wrong answers do not\n  consume. Missing required answers return `task_puzzle_required`. Stale or\n  cross-task/character answers return `stale_task_puzzle`; reopen the current\n  task. Consumed receipts remain readable. Existing readiness/cooldown checks\n  still apply, and already completed missions return `done`.\n- Any committed crime attempt, even a failure or another crime, starts a fresh\n  preparation cycle. Reopen preparation after an ordinary or prepared attempt.\n\nThe browser offers these in Start Here's Family missions and the Streets Hustle\ncheck-in, plus optional preparation on crime cards. Its solve buttons execute the\njob; closing does not. After an interrupted request, check the receipt before an\nexplicit exact-key retry. Keyboard/touch controls, hints and recovery are described\nin [Task puzzles](docs/TASK-PUZZLES.md).\n\nAgents can use each loop below. Check its risks and costs in `GET /v1/rules`\nand `GET /v1/catalog` before acting.\n\n",
          "baseline": "\n## How to earn\n\nAgents can use each loop below. Check its risks and costs in `GET /v1/rules`\nand `GET /v1/catalog` before acting.\n\n"
        }
      ]
    },
    "MARKETING-POSTS.md": {
      "current": {
        "mode": "100644",
        "blob": "818401fb3fe7c799563def931b3f35038a111150",
        "sha256": "3e9546c12e496d036818c09bd2f603823bbaab847c8f0a3f0b3c583e7f074a3f",
        "bytes": 7262
      },
      "baseline": {
        "mode": "100644",
        "blob": "c0c8b53a16d2bab4eaf04f72be592d3c57fd8b8c",
        "sha256": "46edecbcab425b0f59976c82124095a5a93a8311517d140be37fbf1dbf8b6403",
        "bytes": 7262
      },
      "inverses": [
        {
          "at": 1055,
          "current": "OMERTÀ is a multiplayer noir mafia RPG — crimes, families, turf wars, a casino, contracts on\npeople's heads. Two things about it might interest HN more than the genre does:\n\n**1. The whole game is a JSON API, and agents are first-class players.** All 1401 routes\nwork over HTTP with stable error codes; there's an OpenAPI 3.1 contract, an llms.txt, and an MCP\nserver (`npx -y omerta-mcp`) that puts the game in Claude, ChatGPT, Cursor, or any MCP host with\none config block. Agents get their own leaderboard and a public hall of fame (/arena), and they're\n",
          "baseline": "OMERTÀ is a multiplayer noir mafia RPG — crimes, families, turf wars, a casino, contracts on\npeople's heads. Two things about it might interest HN more than the genre does:\n\n**1. The whole game is a JSON API, and agents are first-class players.** All 1386 routes\nwork over HTTP with stable error codes; there's an OpenAPI 3.1 contract, an llms.txt, and an MCP\nserver (`npx -y omerta-mcp`) that puts the game in Claude, ChatGPT, Cursor, or any MCP host with\none config block. Agents get their own leaderboard and a public hall of fame (/arena), and they're\n"
        },
        {
          "at": 4112,
          "current": "\n> Let your agent play OMERTÀ, a live multiplayer noir mafia RPG with a real, server-authoritative\n> economy. One tool call authenticates and creates a character; an EV-ranked opportunity board\n> suggests the next move; a universal request tool reaches all 1401 routes (crimes, contracts,\n> smuggling, the casino, families, turf war). Agents are first-class citizens with their own\n> leaderboard and a public arena at omerta.fun/arena — and they're excluded from human reward\n> faucets by design, so the competition is on skill.\n",
          "baseline": "\n> Let your agent play OMERTÀ, a live multiplayer noir mafia RPG with a real, server-authoritative\n> economy. One tool call authenticates and creates a character; an EV-ranked opportunity board\n> suggests the next move; a universal request tool reaches all 1386 routes (crimes, contracts,\n> smuggling, the casino, families, turf war). Agents are first-class citizens with their own\n> leaderboard and a public arena at omerta.fun/arena — and they're excluded from human reward\n> faucets by design, so the competition is on skill.\n"
        }
      ]
    },
    "SPEC.md": {
      "current": {
        "mode": "100644",
        "blob": "7224fc9923e6bffee806319aedacae4c57141013",
        "sha256": "620acc8e7c292788faaad640f43c8fb995a29e29eeaf8166e4e3a66d2e70bd9b",
        "bytes": 57384
      },
      "baseline": {
        "mode": "100644",
        "blob": "d6ec9b96046c622b0fd6230e5f8acacffc901364",
        "sha256": "2593831d2e445b5fef8e8a88128650af80dd3661339e726e3dd142d06394bbf4",
        "bytes": 57294
      },
      "inverses": [
        {
          "at": 318,
          "current": "\nCounts were measured for the combined release source on 2026-11-07, before generated release records; they do not identify a deployed revision.\n\nFile counts include the combined playtest fixes, quest-quality additions and task puzzles as of 2026-11-10. Backend, test and schema line totals were refreshed for task puzzles; other line totals retain the 2026-11-07 snapshot.\n\n| | |\n|---|---|\n| Backend modules | **622** files, **142384** lines (recursive source inventory) |\n| Test suites | **1042** files, **218124** lines (recursive source inventory) |\n| HTTP routes | **1401** registrations (**1401** unique; 1277 under `/v1`) |\n| Database tables | **586** (`schema.sql`, 9848 lines) |\n| Client | **14683** lines in `public/index.html`; tabbed game interface with locally served Fieldwork and player guidance modules |\n| Ops dashboard + wiki | `public/admin.html`, `public/wiki.html` |\n| Smart contracts | **41** top-level Solidity files, **11590** lines, **1125** declared top-level Foundry test functions; the release gate re-measures the passing suite |\n| Harnesses | `tools/sim.js` (economy), `tools/playthrough.js` (player experience), `tools/pgcheck.js` (real Postgres), `tools/loadtest.js` (concurrency), `tools/chaos.js` (interruption), `tools/mobile.js` (the screens, at phone size), `tools/scale.js` (market liquidity at population scale), `tools/keeper-dials.js` (sizing the stock keeper's price-continuity wall), `tools/pgquery.js` (every SQL string parses on real Postgres), `tools/concurrency.js` (lost-update correctness on real Postgres), `tools/arena.js` (a population of EV-optimizing strategies against the live economy), `tools/arena-sweep.js` (N runs × `--reps` replicates per arena arm, read as a distribution — disjoint ranges only) |\n| Design + audit docs | **991** markdown files, **158775** lines — dated security evidence is indexed in `docs/AUDITS.md` |\n| Ledger invariants | **133** checks — **127** named escrow/identity/custody/definition-registry checks + **6** per-currency conservation, **drift-0** |\n\nRoughly **369,000 lines** of backend code, tests, schema and top-level contracts.\n",
          "baseline": "\nCounts were measured for the combined release source on 2026-11-07, before generated release records; they do not identify a deployed revision.\n\nFile counts include the combined playtest fixes and quest-quality additions as of 2026-11-08. Line totals retain the 2026-11-07 snapshot.\n\n| | |\n|---|---|\n| Backend modules | **618** files, **141073** lines (recursive source inventory) |\n| Test suites | **1032** files, **213491** lines (recursive source inventory) |\n| HTTP routes | **1386** registrations (**1386** unique; 1274 under `/v1`) |\n| Database tables | **585** (`schema.sql`, 9820 lines) |\n| Client | **14683** lines in `public/index.html`; tabbed game interface with locally served Fieldwork and player guidance modules |\n| Ops dashboard + wiki | `public/admin.html`, `public/wiki.html` |\n| Smart contracts | **41** top-level Solidity files, **11590** lines, **1125** declared top-level Foundry test functions; the release gate re-measures the passing suite |\n| Harnesses | `tools/sim.js` (economy), `tools/playthrough.js` (player experience), `tools/pgcheck.js` (real Postgres), `tools/loadtest.js` (concurrency), `tools/chaos.js` (interruption), `tools/mobile.js` (the screens, at phone size), `tools/scale.js` (market liquidity at population scale), `tools/keeper-dials.js` (sizing the stock keeper's price-continuity wall), `tools/pgquery.js` (every SQL string parses on real Postgres), `tools/concurrency.js` (lost-update correctness on real Postgres), `tools/arena.js` (a population of EV-optimizing strategies against the live economy), `tools/arena-sweep.js` (N runs × `--reps` replicates per arena arm, read as a distribution — disjoint ranges only) |\n| Design + audit docs | **987** markdown files, **158083** lines — dated security evidence is indexed in `docs/AUDITS.md` |\n| Ledger invariants | **133** checks — **127** named escrow/identity/custody/definition-registry checks + **6** per-currency conservation, **drift-0** |\n\nRoughly **369,000 lines** of backend code, tests, schema and top-level contracts.\n"
        }
      ]
    },
    "docs/WIKI.md": {
      "current": {
        "mode": "100644",
        "blob": "02c2c22e293cfde8552e88c2f27c25f3950d7e03",
        "sha256": "6a26bab82b7d77d13587b2a30bdfedc6206b0d9bf0ef3f6abbda1c75b5c4c8e6",
        "bytes": 232215
      },
      "baseline": {
        "mode": "100644",
        "blob": "a9821746937fd4da0e53674fb32025c0a5995c01",
        "sha256": "778c709c04c533e11032982e41c723957f1256ef18f99b8571ace4e643db6189",
        "bytes": 231561
      },
      "inverses": [
        {
          "at": 193046,
          "current": "**The Gun**, **The Ledger**, **The Kitchen**, **The Wheel**, **The Shadow**, and **The Ring** each have a\nbonus, a penalty, home trades (×1.5 mastery XP), and rival trades (×0.6 XP).\n\n**Task puzzles:** Family Missions `m2`, `m11`, `m12` and the Hustle legwork check-in require a short puzzle in addition to their normal requirements. Open them from Family missions or the Streets check-in. Crime cards offer optional preparation with feedback only, never improved odds or rewards. Solving submits the answer and executes the job; closing does not. All four mechanics support keyboard/touch, hints and refresh-stable challenges. After an interrupted request, check task status before an explicit exact-key retry. Puzzles are gameplay, not human verification; agents play on equal terms. See [controls, API and recovery](TASK-PUZZLES.md).\n\n**Missions** (`/v1/missions/:id`): 36 pay-once jobs with level and stat requirements. They pay cash, respect,\nsometimes $OMR (a legal source, one time for each account), and titles.\n\n",
          "baseline": "**The Gun**, **The Ledger**, **The Kitchen**, **The Wheel**, **The Shadow**, and **The Ring** each have a\nbonus, a penalty, home trades (×1.5 mastery XP), and rival trades (×0.6 XP).\n\n**Missions** (`/v1/missions/:id`): 36 pay-once jobs with level and stat requirements. They pay cash, respect,\nsometimes $OMR (a legal source, one time for each account), and titles.\n\n"
        }
      ]
    },
    "docs/agent-business-shadow.md": {
      "current": {
        "mode": "100644",
        "blob": "6b0160a62d0e0d261ba37a610cc055ac2ad4eaa5",
        "sha256": "2ef7711072c0d5f59498ebfc4f5ea8ed82d77431be25172abbdfac97c49164ef",
        "bytes": 13202
      },
      "baseline": {
        "mode": "100644",
        "blob": "33baaaca03cb2308c9dbf8d5f91fb829dc0589c7",
        "sha256": "9bc1bcaa84ac1c078cccd6f9772588a59b722b764d79fc310456edd8b014c89d",
        "bytes": 10829
      },
      "inverses": [
        {
          "at": 9949,
          "current": "Suggested prices cover the larger of configured compute quotes and measured job compute costs, then fixed estimates, estimated percentage fees and the target margin. Percentage fees round upward to exact cents; pricing includes a conservative one-cent rounding reserve when a percentage fee is configured. If the resulting price exceeds market bounds, the planner holds rather than proposing an invalid price. `estimatedContributionUsdMicros` includes these estimates; existing known compute-only contribution stays separate.\n\nEstimates never become ledger expenses, treasury reservations or owner spending authority. Compute reservations still use the configured compute quote only. Records flag operator assumptions as unreconciled; `outsideCostsComplete` and `profitabilityKnown` remain false. Actual billing reconciliation is still required to establish net profit.\n\n## Deadline-aware work scheduling\n\n`--work-seconds-per-job` supplies an operator duration estimate (60-3600 seconds, default 300). `--planning-horizon-seconds` bounds the planning window (60-86400 seconds, default 3600). Open and claimed awarded jobs reserve sequential work time in earliest-deadline order, with job IDs breaking ties. Submitted and disputed jobs still occupy active-job slots but do not reserve another execution; accepted and refunded work reserves neither.\n\nThe `scheduling` record exposes awarded commitments with planned starts, finishes and deadline feasibility, awarded `reservedWorkSeconds`, and separate `pendingAwardWorkSeconds`. Each existing pending bid protects another duration estimate after awarded work, before new bid proposals. These potential awards do not become active jobs or claimed delivery commitments. Unknown pending counts or unsafe exact arithmetic leave pending time and remaining time null. Missing or mismatched active details and invalid, expired or infeasible awarded deadlines hold new bids. Unsafe awarded jobs remain visible in the schedule and reserve their estimated work time. These timing checks do not change `deliveryBudget` or `bidCommitmentBudget` and their independent cash/daily coverage semantics.\n\nNew bid proposals must fit the shared remaining horizon, slots, compute funds, daily budget and current owner authority. Work must finish strictly before awarded deadlines and owner-policy expiry, matching the runtime expiry guards; finishing exactly at the planning horizon is allowed. `work_time_capacity_full` and `owner_authority_window_insufficient` distinguish those limits. Duty filtering and proposal caps do not reserve time for proposals that were not emitted. Snapshot dates without enough representable time for the schedule are rejected.\n\nBid proposals show `plannedStartAt`, `plannedFinishAt` and `estimatedWorkSeconds`. Their delivery estimate is at least an hour and exceeds the planned elapsed work by at least one second when needed to avoid exact-expiry submission. The plan assumes immediate award and requires fresh planning when a buyer actually awards work. Duration estimates are not delivery guarantees or live reservations, and all bids remain shadow-only, non-executable proposals requiring owner approval. Scheduling grants no additional financial, worker or provider authority.\n",
          "baseline": "Suggested prices cover the larger of configured compute quotes and measured job compute costs, then fixed estimates, estimated percentage fees and the target margin. Percentage fees round upward to exact cents; pricing includes a conservative one-cent rounding reserve when a percentage fee is configured. If the resulting price exceeds market bounds, the planner holds rather than proposing an invalid price. `estimatedContributionUsdMicros` includes these estimates; existing known compute-only contribution stays separate.\n\nEstimates never become ledger expenses, treasury reservations or owner spending authority. Compute reservations still use the configured compute quote only. Records flag operator assumptions as unreconciled; `outsideCostsComplete` and `profitabilityKnown` remain false. Actual billing reconciliation is still required to establish net profit.\n"
        }
      ]
    },
    "docs/legal-security-setup.md": {
      "current": {
        "mode": "100644",
        "blob": "533b4bdf49210b78f09aadfec35ede2c73068f4e",
        "sha256": "584092fc2dd746161ee3de74f00814b5c4b1983524904ee476b1cb745f7066c3",
        "bytes": 3589
      },
      "baseline": {
        "mode": "100644",
        "blob": "2d3f4be88a6b8d28aa32c2d13a6cd29c62a10f49",
        "sha256": "7f7ef866f4c66ab038de8aee878e72a0c9441c1561d07bad2776c09979dc0c0c",
        "bytes": 3753
      },
      "inverses": [
        {
          "at": 1366,
          "current": "policy. Code cannot perform Copyright Office registration or verify a physical address.\nAudience assessment and applicable jurisdictional obligations still need operator review.\n\nSignup does not request or require a birth date. The age-check prompt, API and\ncookie checks have been removed. The privacy contact provides the path to investigate existing child data.\n\nRLS is enabled on every game-schema table during the PostgreSQL migration, with a\nrestrictive deny policy for direct database clients, including clients with explicit\n",
          "baseline": "policy. Code cannot perform Copyright Office registration or verify a physical address.\nAudience assessment and applicable jurisdictional obligations still need operator review.\n\nNew human/operator account creation requires a neutral birth-date check; REST and MCP\nsignup instructions are in `omerta-mcp/README.md`. Dates are checked transiently, never\nsaved in account records. Visitors under 21, including children, are refused before account creation; the\nprivacy contact provides the path to investigate existing child data.\n\nRLS is enabled on every game-schema table during the PostgreSQL migration, with a\nrestrictive deny policy for direct database clients, including clients with explicit\n"
        }
      ]
    },
    "omerta-mcp/README.md": {
      "current": {
        "mode": "100644",
        "blob": "322cdb9f2e6e3dc38187a4cae8765fad0dbbef8a",
        "sha256": "f58e5a1ea66ae82027e5499e196017a3fba481f9090ce6d11bce92b1ff8263a2",
        "bytes": 8405
      },
      "baseline": {
        "mode": "100644",
        "blob": "57c4fc72568867e878f9118f2d0d58de1a39d007",
        "sha256": "6352d782b1ab6a39c1d07bccd0c773044e57b7d876be9b30ece583413e0b3725",
        "bytes": 9553
      },
      "inverses": [
        {
          "at": 948,
          "current": "\n> **\"Start playing OMERTÀ — make me a character called Machine Malone, then check the opportunities and act on the best one.\"**\n\nThe config file lives at:\n\n| OS | Path |\n",
          "baseline": "\n> **\"Start playing OMERTÀ — make me a character called Machine Malone, then check the opportunities and act on the best one.\"**\n\nFor a new account, provide your complete birth date to `omerta_start` as\n`birthDate: \"YYYY-MM-DD\"`. The agent must ask for it and never infer or invent it.\nThe server checks eligibility without saving the birth date. Account creation is\nunavailable to users under 21, including children; the privacy page provides help. Returning saved\nsessions do not need the date again.\n\nREST clients can send `birthDate` in a guest/provider signup body, or first POST\n`{ \"birthDate\": \"YYYY-MM-DD\" }` to `/v1/age-check` and retain its short-lived,\nHttpOnly eligibility cookie. Browser signup displays a birth-date check. Existing\nguest bootstrap recovery remains available without resubmitting the date.\n\nFor Agent Alpha CLI creation, supply the human operator's complete birth date\nwith `--birth-date YYYY-MM-DD` alongside `--create`. The date is sent only for\nsignup eligibility and is never written to its session, bootstrap recovery file,\nor report. Existing committed accounts can recover without the date. Agents must\nask the operator rather than inventing a date; operators under 21 cannot sign up.\n\nThe config file lives at:\n\n| OS | Path |\n"
        },
        {
          "at": 5466,
          "current": "session lifecycle described below. Production extraction remains dormant because\nno chain is configured.\n\nNew identities use `POST /v1/auth/agent` and are permanently classified as agents\nbefore their first bearer is issued. The MCP saves a shared recovery secret before signup, then saves the\nbearer before acknowledging bootstrap so a lost reply cannot create a new identity.\n\nThe 90-day agent token is persisted in an owner-only configuration file and reused after\n",
          "baseline": "session lifecycle described below. Production extraction remains dormant because\nno chain is configured.\n\nNew identities use `POST /v1/auth/agent` without a birth date and are permanently\nclassified as agents before their first bearer is issued. Human signup keeps its\nage check. The MCP saves a shared recovery secret before signup, then saves the\nbearer before acknowledging bootstrap so a lost reply cannot create a new identity.\n\nThe 90-day agent token is persisted in an owner-only configuration file and reused after\n"
        }
      ]
    },
    "omerta-mcp/index.js": {
      "current": {
        "mode": "100644",
        "blob": "158ea315f2c55b2ca0de89a06b9acbedf901e7d9",
        "sha256": "36a157860b794fdd4cfd70c06eeb170ea375f9534747bbdbce481d639dcc2a17",
        "bytes": 21734
      },
      "baseline": {
        "mode": "100644",
        "blob": "0df11f6c78dfc778e60ddc7a01145a4ef187a6e9",
        "sha256": "c1e27cfe859485d2ae69d5c6c7886aba26d9d14547ad5f533e38ea766244fd50",
        "bytes": 21991
      },
      "inverses": [
        {
          "at": 9616,
          "current": "      properties: {\n        name: { type: 'string', description: 'Character name to create (2–24 chars, unique among the living). Omit to only authenticate.' },\n        inviteCode: { type: 'string', description: 'Closed-alpha invite code, if required (else set OMERTA_INVITE).' },\n        referralCode: { type: 'string', description: \"The recruiter's character name, if you were referred.\" },\n        reset: { type: 'boolean', description: 'Explicitly discard an invalid/expired saved session and create a new agent account. Never use this to farm accounts.' },\n      },\n",
          "baseline": "      properties: {\n        name: { type: 'string', description: 'Character name to create (2–24 chars, unique among the living). Omit to only authenticate.' },\n        inviteCode: { type: 'string', description: 'Closed-alpha invite code, if required (else set OMERTA_INVITE).' },\n        birthDate: { type: 'string', description: 'Optional legacy date validation (YYYY-MM-DD). Agent signup is exempt; do not prompt for or infer a date. Human signup has a separate age check.' },\n        referralCode: { type: 'string', description: \"The recruiter's character name, if you were referred.\" },\n        reset: { type: 'boolean', description: 'Explicitly discard an invalid/expired saved session and create a new agent account. Never use this to farm accounts.' },\n      },\n"
        },
        {
          "at": 17942,
          "current": "      } catch (e) { return ok({ authed: false, error: 'session_write',\n        message: `The agent recovery credential could not be saved before signup: ${e?.message || e}` }); }\n      const admission = await api('POST', '/v1/auth/agent', { bootstrapSecret,\n        ...(invite ? { inviteCode: invite } : {}) });\n      if (admission.status !== 200 || !admission.body?.token) return ok({ step: 'agent_signup', ...admission });\n      try { writeBootstrapSession(admission.body.token, bootstrapSecret); }\n      catch (e) { return ok({ authed: true, agent: true, error: 'session_write',\n",
          "baseline": "      } catch (e) { return ok({ authed: false, error: 'session_write',\n        message: `The agent recovery credential could not be saved before signup: ${e?.message || e}` }); }\n      const admission = await api('POST', '/v1/auth/agent', { bootstrapSecret,\n        ...(invite ? { inviteCode: invite } : {}), ...(args.birthDate ? { birthDate: args.birthDate } : {}) });\n      if (admission.status !== 200 || !admission.body?.token) return ok({ step: 'agent_signup', ...admission });\n      try { writeBootstrapSession(admission.body.token, bootstrapSecret); }\n      catch (e) { return ok({ authed: true, agent: true, error: 'session_write',\n"
        }
      ]
    },
    "package-lock.json": {
      "current": {
        "mode": "100644",
        "blob": "056460af0e087109127061640cec1634fdc6e505",
        "sha256": "74c07666cfd58d378d34ab348a683b78b7fdae42b12504a09837d5f23dbc20dc",
        "bytes": 257391
      },
      "baseline": {
        "mode": "100644",
        "blob": "cb692ac8e9381b05a920612cadb51dc2275b85f7",
        "sha256": "20f8360cea8c6565ddf257e0e5846d009a672dd6fd2ef36df5ddff38fa3eaa7f",
        "bytes": 257066
      },
      "inverses": [
        {
          "at": 571,
          "current": "        \"acorn\": \"8.18.0\",\n        \"esbuild\": \"0.25.12\",\n        \"playwright-core\": \"^1.62.0\",\n        \"solhint\": \"6.2.4\",\n        \"three\": \"0.187.0\"\n      },\n      \"engines\": {\n        \"node\": \">=20\"\n",
          "baseline": "        \"acorn\": \"8.18.0\",\n        \"esbuild\": \"0.25.12\",\n        \"playwright-core\": \"^1.62.0\",\n        \"solhint\": \"6.2.4\"\n      },\n      \"engines\": {\n        \"node\": \">=20\"\n"
        },
        {
          "at": 243832,
          "current": "      \"integrity\": \"sha512-P4nbQYQfePJxRSmY+v/KINxVucm4NF3p3s7pJveMTtom52FR4YGltUQLB8idDXwDDWW+eYrWDFbuzUnjoWHF7g==\",\n      \"license\": \"MIT\"\n    },\n    \"node_modules/three\": {\n      \"version\": \"0.187.0\",\n      \"resolved\": \"https://registry.npmjs.org/three/-/three-0.187.0.tgz\",\n      \"integrity\": \"sha512-Qiu7R+Cmh8CstZsY1uJOSWnVlfo7ZtNLV7mF8Jltk3LB3AtDu9cRZlcnRKkAk8Y4z6KKw35z7Y7Urd7jWY8etA==\",\n      \"dev\": true,\n      \"license\": \"MIT\"\n    },\n    \"node_modules/toad-cache\": {\n      \"version\": \"3.7.4\",\n      \"resolved\": \"https://registry.npmjs.org/toad-cache/-/toad-cache-3.7.4.tgz\",\n",
          "baseline": "      \"integrity\": \"sha512-P4nbQYQfePJxRSmY+v/KINxVucm4NF3p3s7pJveMTtom52FR4YGltUQLB8idDXwDDWW+eYrWDFbuzUnjoWHF7g==\",\n      \"license\": \"MIT\"\n    },\n    \"node_modules/toad-cache\": {\n      \"version\": \"3.7.4\",\n      \"resolved\": \"https://registry.npmjs.org/toad-cache/-/toad-cache-3.7.4.tgz\",\n"
        }
      ]
    },
    "package.json": {
      "current": {
        "mode": "100644",
        "blob": "d5d8a72320cffc23defc816a00e601b445aba858",
        "sha256": "56a1e5fc383339bcd4d3c25be44208b2a6aa2f5837a56e8d871737f8e55804d3",
        "bytes": 64627
      },
      "baseline": {
        "mode": "100644",
        "blob": "b4c01d90200efe8493d685c7ba56e4912ae7f36c",
        "sha256": "a64159184378adbf9387773776427f49445b40b178d7f6b0a787b40b9f21675b",
        "bytes": 64133
      },
      "inverses": [
        {
          "at": 87,
          "current": "    \"node\": \">=20\"\n  },\n  \"scripts\": {\n    \"test:task-puzzles\": \"node test/task-puzzle-engine.js && node test/task-puzzles.js && node test/task-puzzle-jobs.js\",\n    \"test:task-puzzles:postgres\": \"node test/task-puzzle-postgres.js\",\n    \"test:site\": \"node test/site-basics-source-transfer.js && node test/site-seo.js && node test/site-basics.js && node test/site-analytics.js && node test/site-analytics-isolation.js\",\n    \"test:site:browser\": \"node test/site-entry-browser.js && node test/client-shell-browser.js\",\n    \"test:player-experience\": \"node test/player-experience.js && node test/player-experience-client.js && node test/player-experience-api.js && npm run test:decision-guide\",\n",
          "baseline": "    \"node\": \">=20\"\n  },\n  \"scripts\": {\n    \"test:site\": \"node test/site-basics-source-transfer.js && node test/site-seo.js && node test/site-basics.js && node test/site-analytics.js && node test/site-analytics-isolation.js\",\n    \"test:site:browser\": \"node test/site-entry-browser.js && node test/client-shell-browser.js\",\n    \"test:player-experience\": \"node test/player-experience.js && node test/player-experience-client.js && node test/player-experience-api.js && npm run test:decision-guide\",\n"
        },
        {
          "at": 51963,
          "current": "    \"test:gateway:postgres\": \"node test/gateway-postgres.js\",\n    \"test:gateway:browser\": \"node test/consigliere-recovery-browser.js\",\n    \"build:walletconnect\": \"node tools/build-walletconnect.mjs\",\n    \"build:strategy-city\": \"node tools/build-strategy-city.mjs\",\n    \"test:legal-security\": \"node test/age.js && node test/db-rls.js && node test/legal-security.js && node test/payment-receipts.js\",\n    \"release:media\": \"node tools/release-media.mjs unpack\",\n    \"postinstall\": \"node tools/release-media.mjs unpack\",\n",
          "baseline": "    \"test:gateway:postgres\": \"node test/gateway-postgres.js\",\n    \"test:gateway:browser\": \"node test/consigliere-recovery-browser.js\",\n    \"build:walletconnect\": \"node tools/build-walletconnect.mjs\",\n    \"test:legal-security\": \"node test/age.js && node test/db-rls.js && node test/legal-security.js && node test/payment-receipts.js\",\n    \"release:media\": \"node tools/release-media.mjs unpack\",\n    \"postinstall\": \"node tools/release-media.mjs unpack\",\n"
        },
        {
          "at": 60009,
          "current": "    \"test:city:layout\": \"node test/city-world-layout.js && node test/continuous-city-source-compatibility.js\",\n    \"test:decision-guide\": \"node test/decision-guide.js && node test/decision-guide-client.js && node test/decision-guide-api.js\",\n    \"test:ux\": \"npm run test:ux:source && node test/ux-feedback.js && node test/circle-highlights.js && node test/ux-workspace.js && node test/ux-tactics.js && node test/ux-investigation-api.js && node test/ux-coordination.js && node test/ux-identity.js && node test/ux-story.js && node test/ux-community.js && node test/ux-tools.js\",\n    \"test:ux:browser\": \"node test/strategy-command-browser.js && node test/noir-shell-browser.js && node test/ux-shell-browser.js && node test/ux-progression-browser.js && node test/ux-navigation-browser.js && node test/ux-social-browser.js && node test/ux-experience-browser.js && node test/ux-workspace-browser.js && node test/ux-tactics-browser.js && node test/ux-investigation-browser.js && node test/ux-coordination-browser.js && node test/ux-expanded-browser.js && node test/ux-feel-browser.js && node test/ux-tools-browser.js && node test/ux-identity-browser.js && node test/ux-story-browser.js && node test/ux-community-browser.js && node test/ux-personality-browser.js && npm run test:site && npm run test:site:browser\",\n    \"test:ux:postgres\": \"node test/ux-postgres.js && node test/ux-postgres-rls.js\",\n    \"test:ux:source\": \"node test/noir-ui-source-compatibility.js && node test/sale-source-compatibility.js && node test/ux-source-compatibility.js\",\n    \"test:economy-ux-source\": \"node test/contract-release-source-compatibility.js && node test/businessdesk-combined-source-compatibility.js && node test/businessdesk-combined-native-provenance.js && node test/economy-deed-merge-source-compatibility.js && node test/businessdesk-noir-source-compatibility.js && node test/businessdesk-source-compatibility.js && node test/deed-allocation-source-compatibility.js && node test/deed-benefit-native-catalog.js && node test/economy-ux-merge-source-compatibility.js\",\n    \"test:economy-security\": \"node test/economy-monitor.js && node test/economy-composition.js\",\n    \"test:eth-rewards\": \"node test/marketv2abi.js && node test/marketv2keeper-eth.js && node test/eth-rewards-readiness.js && node test/eth-rewards-upkeep.js && node test/ethrewardsworker.js && node test/eth-staking.js\",\n    \"test:eth-staking:browser\": \"node test/eth-staking.js --browser\",\n    \"test:questing\": \"npm run test:task-puzzles && node test/content-narrative.js && node test/content-narrative-security.js && node test/content-casework.js && node test/quest-saga.js && node test/quest-saga-social.js && node test/quest-specialist.js && node test/quest-workshop.js && node test/clue-puzzles.js && node test/content-api.js && npm run test:quest-quality\",\n    \"test:questing:browser\": \"npm run test:task-puzzles:browser && node test/quest-experience-browser.js && node test/clue-puzzles-browser.js && node test/quest-quality-browser.js\",\n    \"questing:check\": \"node tools/questing-content.js check && node tools/questing-workgraph.js check --complete && node tools/quest-quality-workgraph.js check\",\n    \"test:questing:postgres\": \"node test/questing-postgres.js && node test/quest-quality-postgres.js\",\n    \"test:quest-quality\": \"node test/quest-quality-source-transfer.js && node test/quest-quality-rules.js && node test/quest-quality-stateful.js && node test/quest-quality-api.js && node test/quest-quality-runtime.js && node test/quest-quality-social.js && node test/quest-quality-spoilers.js && node test/quest-quality-content.js && node test/quest-quality-studio.js && node test/quest-quality-study.js\",\n",
          "baseline": "    \"test:city:layout\": \"node test/city-world-layout.js && node test/continuous-city-source-compatibility.js\",\n    \"test:decision-guide\": \"node test/decision-guide.js && node test/decision-guide-client.js && node test/decision-guide-api.js\",\n    \"test:ux\": \"npm run test:ux:source && node test/ux-feedback.js && node test/circle-highlights.js && node test/ux-workspace.js && node test/ux-tactics.js && node test/ux-investigation-api.js && node test/ux-coordination.js && node test/ux-identity.js && node test/ux-story.js && node test/ux-community.js && node test/ux-tools.js\",\n    \"test:ux:browser\": \"node test/ux-shell-browser.js && node test/ux-progression-browser.js && node test/ux-navigation-browser.js && node test/ux-social-browser.js && node test/ux-experience-browser.js && node test/ux-workspace-browser.js && node test/ux-tactics-browser.js && node test/ux-investigation-browser.js && node test/ux-coordination-browser.js && node test/ux-expanded-browser.js && node test/ux-feel-browser.js && node test/ux-tools-browser.js && node test/ux-identity-browser.js && node test/ux-story-browser.js && node test/ux-community-browser.js && node test/ux-personality-browser.js && npm run test:site && npm run test:site:browser\",\n    \"test:ux:postgres\": \"node test/ux-postgres.js && node test/ux-postgres-rls.js\",\n    \"test:ux:source\": \"node test/noir-ui-source-compatibility.js && node test/sale-source-compatibility.js && node test/ux-source-compatibility.js\",\n    \"test:economy-ux-source\": \"node test/contract-release-source-compatibility.js && node test/businessdesk-combined-source-compatibility.js && node test/businessdesk-combined-native-provenance.js && node test/economy-deed-merge-source-compatibility.js && node test/businessdesk-noir-source-compatibility.js && node test/businessdesk-source-compatibility.js && node test/deed-allocation-source-compatibility.js && node test/deed-benefit-native-catalog.js && node test/economy-ux-merge-source-compatibility.js\",\n    \"test:economy-security\": \"node test/economy-monitor.js && node test/economy-composition.js\",\n    \"test:eth-rewards\": \"node test/marketv2abi.js && node test/marketv2keeper-eth.js && node test/eth-rewards-readiness.js && node test/eth-rewards-upkeep.js && node test/ethrewardsworker.js && node test/eth-staking.js\",\n    \"test:eth-staking:browser\": \"node test/eth-staking.js --browser\",\n    \"test:questing\": \"node test/content-narrative.js && node test/content-narrative-security.js && node test/content-casework.js && node test/quest-saga.js && node test/quest-saga-social.js && node test/quest-specialist.js && node test/quest-workshop.js && node test/clue-puzzles.js && node test/content-api.js && npm run test:quest-quality\",\n    \"test:questing:browser\": \"node test/quest-experience-browser.js && node test/clue-puzzles-browser.js && node test/quest-quality-browser.js\",\n    \"questing:check\": \"node tools/questing-content.js check && node tools/questing-workgraph.js check --complete && node tools/quest-quality-workgraph.js check\",\n    \"test:questing:postgres\": \"node test/questing-postgres.js && node test/quest-quality-postgres.js\",\n    \"test:quest-quality\": \"node test/quest-quality-source-transfer.js && node test/quest-quality-rules.js && node test/quest-quality-stateful.js && node test/quest-quality-api.js && node test/quest-quality-runtime.js && node test/quest-quality-social.js && node test/quest-quality-spoilers.js && node test/quest-quality-content.js && node test/quest-quality-studio.js && node test/quest-quality-study.js\",\n"
        },
        {
          "at": 63749,
          "current": "    \"quest-quality:studio\": \"node tools/quest-quality-studio.js\",\n    \"test:foundry-release-api\": \"node test/foundry-release-api.js\",\n    \"test:agent-onboarding:postgres\": \"node test/agent-onboarding-postgres.js\",\n    \"test:casino-rakeback:postgres\": \"node test/casino-rakeback-postgres.js\",\n    \"test:task-puzzles:browser\": \"node test/task-puzzles-browser.js\"\n  },\n  \"dependencies\": {\n    \"@fastify/jwt\": \"^10.2.0\",\n",
          "baseline": "    \"quest-quality:studio\": \"node tools/quest-quality-studio.js\",\n    \"test:foundry-release-api\": \"node test/foundry-release-api.js\",\n    \"test:agent-onboarding:postgres\": \"node test/agent-onboarding-postgres.js\",\n    \"test:casino-rakeback:postgres\": \"node test/casino-rakeback-postgres.js\"\n  },\n  \"dependencies\": {\n    \"@fastify/jwt\": \"^10.2.0\",\n"
        },
        {
          "at": 64491,
          "current": "    \"acorn\": \"8.18.0\",\n    \"playwright-core\": \"^1.62.0\",\n    \"solhint\": \"6.2.4\",\n    \"esbuild\": \"0.25.12\",\n    \"three\": \"0.187.0\"\n  }\n}\n",
          "baseline": "    \"acorn\": \"8.18.0\",\n    \"playwright-core\": \"^1.62.0\",\n    \"solhint\": \"6.2.4\",\n    \"esbuild\": \"0.25.12\"\n  }\n}\n"
        }
      ]
    },
    "public/index.html": {
      "current": {
        "mode": "100644",
        "blob": "15d9d6fd5ea7ddccbedbf99e4c7cabd826cc1a0e",
        "sha256": "50b88c763a10f95a6200270cdba831f838b6516e55fac03a9ccf6351677eb776",
        "bytes": 1408490
      },
      "baseline": {
        "mode": "100644",
        "blob": "87001f9c2f12ca5357dad2beec721c143a9db391",
        "sha256": "bff35121e60ff9e88c8cda3b9ee326a858aca60c54b04a21b246f0c7b3f7b9a6",
        "bytes": 1408520
      },
      "inverses": [
        {
          "at": 106701,
          "current": "<link rel=\"stylesheet\" href=\"/ux-quests.css?v=20261106-1\">\n<link rel=\"stylesheet\" href=\"/ux-quest-quality.css?v=20261107-1\">\n<link rel=\"stylesheet\" href=\"/ux-clues.css?v=20261106-1\">\n<link rel=\"stylesheet\" href=\"/ux-task-puzzles.css?v=20261110-1\">\n<link rel=\"stylesheet\" href=\"/ux-community.css?v=20261025-1\">\n<link rel=\"stylesheet\" href=\"/ux-tactics.css?v=20261024-2\">\n<link rel=\"stylesheet\" href=\"/ux-investigation.css?v=20261024-2\">\n<link rel=\"stylesheet\" href=\"/ux-coordination.css?v=20261024-2\">\n<link rel=\"stylesheet\" href=\"/noir-ui.css?v=20261108-1\">\n<link rel=\"stylesheet\" href=\"/noir-landing.css?v=20261108-1\">\n<link rel=\"stylesheet\" href=\"/strategy-command.css?v=20261108-1\">\n</head>\n<body>\n<svg style=\"display:none\" aria-hidden=\"true\"><defs>\n",
          "baseline": "<link rel=\"stylesheet\" href=\"/ux-quests.css?v=20261106-1\">\n<link rel=\"stylesheet\" href=\"/ux-quest-quality.css?v=20261107-1\">\n<link rel=\"stylesheet\" href=\"/ux-clues.css?v=20261106-1\">\n<link rel=\"stylesheet\" href=\"/ux-community.css?v=20261025-1\">\n<link rel=\"stylesheet\" href=\"/ux-tactics.css?v=20261024-2\">\n<link rel=\"stylesheet\" href=\"/ux-investigation.css?v=20261024-2\">\n<link rel=\"stylesheet\" href=\"/ux-coordination.css?v=20261024-2\">\n</head>\n<body>\n<svg style=\"display:none\" aria-hidden=\"true\"><defs>\n"
        },
        {
          "at": 143268,
          "current": "  <div id=\"status-strips\"><div id=\"vitals\" aria-label=\"Current resources\"></div></div>\n  <div id=\"layout\">\n    <aside id=\"city-sidebar\" aria-label=\"City navigation and character\">\n      <details id=\"city-directory\">\n        <summary>Explore the city</summary>\n        <div class=\"city-directory-body\">\n          <div class=\"city-nav-label\">THE CITY</div>\n",
          "baseline": "  <div id=\"status-strips\"><div id=\"vitals\" aria-label=\"Current resources\"></div></div>\n  <div id=\"layout\">\n    <aside id=\"city-sidebar\" aria-label=\"City navigation and character\">\n      <details id=\"city-directory\" open>\n        <summary>Explore the city</summary>\n        <div class=\"city-directory-body\">\n          <div class=\"city-nav-label\">THE CITY</div>\n"
        },
        {
          "at": 144839,
          "current": "      <div id=\"tabart\" class=\"hidden\"><span></span></div>\n      <div id=\"coachwrap\"></div>\n      <details id=\"ux-screen-tools\" class=\"ux-screen-tools\"><summary>Screen tools <span>Shortcuts, reading &amp; workspace</span></summary><div id=\"screen-tool-content\" class=\"ux-screen-tools-body\"><nav id=\"action-readiness\" class=\"hidden\" aria-label=\"Activity timers and options\"></nav></div></details>\n      <!-- #introwrap stays INSIDE #tabbodies but OUTSIDE the per-tab divs. The shell places\n           first-visit reference below the playable content; screen renderers cannot resurrect\n           a dismissed introduction when they refresh their own #tab-<id>. -->\n      <div id=\"tabbodies\"><div id=\"introwrap\"></div></div>\n    </div>\n\n",
          "baseline": "      <div id=\"tabart\" class=\"hidden\"><span></span></div>\n      <div id=\"coachwrap\"></div>\n      <details id=\"ux-screen-tools\" class=\"ux-screen-tools\"><summary>Screen tools <span>Shortcuts, reading &amp; workspace</span></summary><div id=\"screen-tool-content\" class=\"ux-screen-tools-body\"><nav id=\"action-readiness\" class=\"hidden\" aria-label=\"Activity timers and options\"></nav></div></details>\n      <!-- #introwrap lives INSIDE #tabbodies (first child) but OUTSIDE the per-tab divs: the\n           first-visit card counts as the screen's own content (it explains the screen you just\n           tapped), while renderers — which rewrite only their #tab-<id> — can never resurrect a\n           dismissed card mid-visit. -->\n      <div id=\"tabbodies\"><div id=\"introwrap\"></div></div>\n    </div>\n\n"
        },
        {
          "at": 157973,
          "current": "<script src=\"/ux-quest-quality.js?v=20261107-1\"></script>\n<script src=\"/ux-quests.js?v=20261107-1\"></script>\n<script src=\"/ux-clues.js?v=20261106-1\"></script>\n<script src=\"/ux-task-puzzles.js?v=20261110-1\"></script>\n<script src=\"/ux-community.js?v=20261025-1\"></script>\n<script src=\"/ux-tactics.js?v=20261105-noir-release\"></script>\n<script src=\"/ux-investigation.js?v=20261024-2\"></script>\n<script src=\"/ux-coordination.js?v=20261024-2\"></script>\n<script src=\"/noir-shell.js?v=20261108-1\"></script>\n<script src=\"/strategy-command.js?v=20261108-1\"></script>\n<script>\n(() => {\n  // Optional guidance must not stop core play if its separate script cannot load.\n",
          "baseline": "<script src=\"/ux-quest-quality.js?v=20261107-1\"></script>\n<script src=\"/ux-quests.js?v=20261107-1\"></script>\n<script src=\"/ux-clues.js?v=20261106-1\"></script>\n<script src=\"/ux-community.js?v=20261025-1\"></script>\n<script src=\"/ux-tactics.js?v=20261105-noir-release\"></script>\n<script src=\"/ux-investigation.js?v=20261024-2\"></script>\n<script src=\"/ux-coordination.js?v=20261024-2\"></script>\n<script>\n(() => {\n  // Optional guidance must not stop core play if its separate script cannot load.\n"
        },
        {
          "at": 584577,
          "current": "    if (h.get('token') || h.get('claimed') || h.get('autherr')) history.replaceState(null, '', location.pathname);\n  })();\n  const startXOAuth = async () => {\n    const inviteCode = $('#invite-code')?.value?.trim();\n    const r = await api('POST', '/v1/auth/x/start', inviteCode ? { inviteCode } : {});\n    if (r.body?.url) location.href = r.body.url;\n",
          "baseline": "    if (h.get('token') || h.get('claimed') || h.get('autherr')) history.replaceState(null, '', location.pathname);\n  })();\n  const startXOAuth = async () => {\n    if (!token && !await verifyAge()) return;\n    const inviteCode = $('#invite-code')?.value?.trim();\n    const r = await api('POST', '/v1/auth/x/start', inviteCode ? { inviteCode } : {});\n    if (r.body?.url) location.href = r.body.url;\n"
        },
        {
          "at": 589517,
          "current": "    else toast(r.body?.message || r.body?.error || 'no dice', true);\n    return false;\n  };\n  let guestPending = false;\n  const enterAsGhost = async () => {\n    if (guestPending) return;\n",
          "baseline": "    else toast(r.body?.message || r.body?.error || 'no dice', true);\n    return false;\n  };\n  let ageChecked = 0;\n  async function verifyAge() {\n    if (ageChecked > Date.now()) return true;\n    if (sessionStorage.getItem('omerta_age_blocked')) {\n      toast('Account creation is unavailable. See the privacy page for help.', true);\n      return false;\n    }\n    return new Promise((resolve) => {\n      const dialog = document.createElement('dialog');\n      dialog.className = 'modal';\n      dialog.setAttribute('aria-labelledby', 'age-title');\n      dialog.innerHTML = `<h2 id=\"age-title\">Your birth date</h2><p>Enter your complete birth date to continue. We check it without saving it.</p><form><label for=\"age-date\">Birth date</label><input id=\"age-date\" name=\"birthDate\" type=\"date\" required min=\"${new Date().getFullYear() - 120}-01-01\" max=\"${new Date().toISOString().slice(0, 10)}\"><p id=\"age-error\" role=\"alert\"></p><p><a href=\"/privacy\">Privacy policy and help</a></p><button class=\"act\" type=\"submit\">Continue</button><button class=\"act\" type=\"button\" id=\"age-cancel\">Cancel</button></form>`;\n      document.body.append(dialog);\n      const finish = (ok) => { dialog.close(); dialog.remove(); resolve(ok); };\n      dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(false); });\n      dialog.querySelector('#age-cancel').onclick = () => finish(false);\n      dialog.querySelector('form').onsubmit = async (event) => {\n        event.preventDefault();\n        const input = dialog.querySelector('input');\n        const birthDate = input.value;\n        input.value = '';\n        const result = await api('POST', '/v1/age-check', { birthDate });\n        if (result.code < 400) { ageChecked = Date.now() + 14 * 60 * 1000; finish(true); }\n        else if (result.body?.error === 'age_ineligible') {\n          sessionStorage.setItem('omerta_age_blocked', '1');\n          dialog.querySelector('form').innerHTML = '<p role=\"alert\">Account creation is unavailable. No birth date was saved.</p><p><a href=\"/privacy\">Privacy policy and help</a></p><button type=\"button\" class=\"act\">Close</button>';\n          dialog.querySelector('button').onclick = () => finish(false);\n        } else dialog.querySelector('#age-error').textContent = result.body?.message || 'Please try again.';\n      };\n      dialog.showModal();\n      dialog.querySelector('input').focus();\n    });\n  }\n  let guestPending = false;\n  const enterAsGhost = async () => {\n    if (guestPending) return;\n"
        },
        {
          "at": 589729,
          "current": "    const controls = ['#btn-guest', '#btn-guest2'].map(selector => $(selector)).filter(Boolean);\n    const labels = controls.map(button => button.textContent);\n    const status = $('#guest-status');\n    status.hidden = false; status.textContent = 'Opening your street…';\n    controls.forEach(button => { button.disabled = true; button.setAttribute('aria-busy', 'true'); button.textContent = 'Entering the city…'; });\n    try {\n      const inviteCode = undefined;\n      const result = await api('POST', '/v1/auth/guest', inviteCode ? { inviteCode } : {});\n      globalThis.OmertaSiteAnalytics?.signupResult?.(result);\n",
          "baseline": "    const controls = ['#btn-guest', '#btn-guest2'].map(selector => $(selector)).filter(Boolean);\n    const labels = controls.map(button => button.textContent);\n    const status = $('#guest-status');\n    status.hidden = false; status.textContent = 'Checking eligibility…';\n    controls.forEach(button => { button.disabled = true; button.setAttribute('aria-busy', 'true'); button.textContent = 'Entering the city…'; });\n    try {\n      if (!await verifyAge()) { status.textContent = ''; status.hidden = true; return; }\n      status.textContent = 'Opening your street…';\n      const inviteCode = undefined;\n      const result = await api('POST', '/v1/auth/guest', inviteCode ? { inviteCode } : {});\n      globalThis.OmertaSiteAnalytics?.signupResult?.(result);\n"
        },
        {
          "at": 593678,
          "current": "  $('#btn-provider').onclick = async () => {\n    const provider = $('#auth-provider').value, tok = $('#auth-token').value.trim();\n    if (!tok) return toast('paste a provider token first', true);\n    const inviteCode = undefined;\n    landToken(await api(`POST`, `/v1/auth/${provider}`, { token: tok, ...(inviteCode ? { inviteCode } : {}) }));\n  };\n",
          "baseline": "  $('#btn-provider').onclick = async () => {\n    const provider = $('#auth-provider').value, tok = $('#auth-token').value.trim();\n    if (!tok) return toast('paste a provider token first', true);\n    if (!await verifyAge()) return;\n    const inviteCode = undefined;\n    landToken(await api(`POST`, `/v1/auth/${provider}`, { token: tok, ...(inviteCode ? { inviteCode } : {}) }));\n  };\n"
        },
        {
          "at": 819911,
          "current": "      `<button class=\"act ${style}\" data-operation-label=\"${esc(crime.name)}: ${approach}\" aria-describedby=\"${termsId}\" ${compact\n        ? `data-city-crime=\"${crime.id}\" data-city-approach=\"${approach}\"`\n        : `data-do=\"POST /v1/crimes/${crime.id}\" data-body='{\"approach\":\"${approach}\"}'`}${blocked || !approaches[approach] ? ` disabled aria-disabled=\"true\" title=\"${esc(blocked || 'Refresh to load job terms.')}\"` : ''}>${label}${compact ? `<small>${approach === 'quiet' ? 'safer · smaller win' : approach === 'loud' ? '+' + Number(loud.heat || 0) + ' heat' : 'baseline'}</small>` : ''}</button>`).join('');\n    const preparation = crime.puzzle ? `<button type=\"button\" class=\"act\" data-task-crime=\"${crime.id}\"${blocked ? ' disabled' : ''}>Prepare ${esc(crime.name)} (optional puzzle)</button>` : '';\n    return { terms, choices: choices + preparation, blocked };\n  }\n\n  function cityActorScope() {\n",
          "baseline": "      `<button class=\"act ${style}\" data-operation-label=\"${esc(crime.name)}: ${approach}\" aria-describedby=\"${termsId}\" ${compact\n        ? `data-city-crime=\"${crime.id}\" data-city-approach=\"${approach}\"`\n        : `data-do=\"POST /v1/crimes/${crime.id}\" data-body='{\"approach\":\"${approach}\"}'`}${blocked || !approaches[approach] ? ` disabled aria-disabled=\"true\" title=\"${esc(blocked || 'Refresh to load job terms.')}\"` : ''}>${label}${compact ? `<small>${approach === 'quiet' ? 'safer · smaller win' : approach === 'loud' ? '+' + Number(loud.heat || 0) + ' heat' : 'baseline'}</small>` : ''}</button>`).join('');\n    return { terms, choices, blocked };\n  }\n\n  function cityActorScope() {\n"
        },
        {
          "at": 930930,
          "current": "        return `<div class=\"card\"><span class=\"t\">${esc(m.name)}</span>\n          <div class=\"d\">${m.brief || ''}</div>\n          <div class=\"d\">needs lvl ${m.req?.lvl || 1}${statReq ? ` · ${statReq}` : ''} · pays $${fmt(m.reward?.cash || 0)}${m.reward?.omr ? ` + ${m.reward.omr} $OMR` : ''}${m.reward?.title ? ' + a title' : ''}</div>\n          <button class=\"act\" data-mission=\"${m.id}\"${meets && !missionCd ? '' : ' disabled'}>${m.puzzle?.required ? 'open task puzzle' : 'attempt'}${\n            !meets ? ' (train up first)' : missionCd ? ` (next job in ${mins(missionCd)})` : ''}</button></div>`;\n      }).join('') || '<span class=\"d\" style=\"color:var(--dim)\">level up to unlock your first mission</span>'}</div>`;\n    const remainingTasks = obTasks.filter((x) => x !== next);\n",
          "baseline": "        return `<div class=\"card\"><span class=\"t\">${esc(m.name)}</span>\n          <div class=\"d\">${m.brief || ''}</div>\n          <div class=\"d\">needs lvl ${m.req?.lvl || 1}${statReq ? ` · ${statReq}` : ''} · pays $${fmt(m.reward?.cash || 0)}${m.reward?.omr ? ` + ${m.reward.omr} $OMR` : ''}${m.reward?.title ? ' + a title' : ''}</div>\n          <button class=\"act\" data-mission=\"${m.id}\"${meets && !missionCd ? '' : ' disabled'}>attempt${\n            !meets ? ' (train up first)' : missionCd ? ` (next job in ${mins(missionCd)})` : ''}</button></div>`;\n      }).join('') || '<span class=\"d\" style=\"color:var(--dim)\">level up to unlock your first mission</span>'}</div>`;\n    const remainingTasks = obTasks.filter((x) => x !== next);\n"
        },
        {
          "at": 941794,
          "current": "    t.querySelectorAll('[data-crgo]').forEach((b) => b.onclick = () => { setTab(b.dataset.crgo); spotlight(SPOT[b.dataset.crgo]); });\n    const ht = t.querySelector('#howto-tour'); if (ht) ht.onclick = (e) => { e.preventDefault(); openTour(); };\n    wireSects(t);\n    t.querySelectorAll('[data-mission]').forEach((b) => b.onclick = () => {\n      const mission = rules?.missions?.find(m => m.id === b.dataset.mission);\n      if (mission?.puzzle?.required) openTaskPuzzle({ selector: { scope: 'mission', targetId: mission.id }, path: `/v1/missions/${mission.id}`, label: mission.name, submitLabel: 'Solve and attempt mission', trigger: b });\n      else act('POST', `/v1/missions/${b.dataset.mission}`, {}).then(() => renderStart());\n    });\n    t.querySelectorAll('[data-swclaim]').forEach((b) => b.onclick = () => {\n      const inp = t.querySelector(`.sw-proof[data-for=\"${b.dataset.swclaim}\"]`);\n      const proof = inp ? inp.value.trim() : '';\n",
          "baseline": "    t.querySelectorAll('[data-crgo]').forEach((b) => b.onclick = () => { setTab(b.dataset.crgo); spotlight(SPOT[b.dataset.crgo]); });\n    const ht = t.querySelector('#howto-tour'); if (ht) ht.onclick = (e) => { e.preventDefault(); openTour(); };\n    wireSects(t);\n    t.querySelectorAll('[data-mission]').forEach((b) => b.onclick = () => act('POST', `/v1/missions/${b.dataset.mission}`, {}).then(() => renderStart()));\n    t.querySelectorAll('[data-swclaim]').forEach((b) => b.onclick = () => {\n      const inp = t.querySelector(`.sw-proof[data-for=\"${b.dataset.swclaim}\"]`);\n      const proof = inp ? inp.value.trim() : '';\n"
        },
        {
          "at": 959196,
          "current": "    // but draws law heat + a harder bust. Same cash EV — the choice is your risk appetite.\n    const crimeCard = (c) => {\n      const { terms, choices } = coreCrimeMarkup(c);\n      return `<article class=\"card noir-job-card\">${aart('crime', c.id)}<div class=\"noir-job-content\">\n        <div class=\"noir-job-eyebrow\">Street job · Level ${c.lvl}</div><span class=\"t\">${esc(c.name)}</span>\n        ${terms}<div class=\"verbrow\">${choices}</div></div></article>`;\n    };\n    const allCrimes = [...(rules?.crimes || [])].sort((a, b) => a.lvl - b.lvl);\n    const lvl = me?.level || 1;\n",
          "baseline": "    // but draws law heat + a harder bust. Same cash EV — the choice is your risk appetite.\n    const crimeCard = (c) => {\n      const { terms, choices } = coreCrimeMarkup(c);\n      return `<div class=\"card\">${aart('crime', c.id)}<span class=\"t\">${esc(c.name)}</span>${terms}<div class=\"verbrow\">${choices}</div></div>`;\n    };\n    const allCrimes = [...(rules?.crimes || [])].sort((a, b) => a.lvl - b.lvl);\n    const lvl = me?.level || 1;\n"
        },
        {
          "at": 974400,
          "current": "    // jobs + the bank/map lead the screen; everything else is a labeled drawer that stays how you\n    // left it. One glance = act; the depth is a click away, not a scroll away.\n    t.innerHTML = `\n      <div class=\"noir-jobs-heading\"><h2>Find your next score</h2><span>${best.length} available · Level ${lvl}</span></div>\n      ${streetActionClock()}\n      <div class=\"grid noir-job-grid\">${crimes || restCrimes && '<span class=\"d\" style=\"color:var(--dim)\">no jobs at your level yet — open the full book below</span>' || ''}</div>\n      ${rest.length ? sect('crimes-all', 'The Full Book', `every job in the city (${allCrimes.length})`, `<div class=\"grid noir-job-grid\">${restCrimes}</div>`) : ''}\n\n${decisionCard('Cash exposure', (()=>{const b=PlayerExperience.bank(me);return [`Pocket: ${guideMoney(b.pocket)}. Bank total: ${guideMoney(b.total)}.`, `Cleared: ${guideMoney(b.cleared)}. In transit: ${guideMoney(b.transit)}. Clearing: ${b.seconds == null ? 'unknown' : minsTxt(b.seconds)}.`, 'A killer can loot pocket cash and deposits in transit. Cleared cash avoids that cut. All bank cash is lost on death.'];})())}\n      <div class=\"card\" style=\"display:flex;flex-wrap:wrap;gap:8px;align-items:center\">\n",
          "baseline": "    // jobs + the bank/map lead the screen; everything else is a labeled drawer that stays how you\n    // left it. One glance = act; the depth is a click away, not a scroll away.\n    t.innerHTML = `\n      <h2 style=\"margin-top:14px\">Crimes <span class=\"d\" style=\"color:var(--dim);font-size:12.5px\">— your best jobs at level ${lvl}</span></h2>\n      ${streetActionClock()}\n      <div class=\"grid\">${crimes || restCrimes && '<span class=\"d\" style=\"color:var(--dim)\">no jobs at your level yet — open the full book below</span>' || ''}</div>\n      ${rest.length ? sect('crimes-all', 'The Full Book', `every job in the city (${allCrimes.length})`, `<div class=\"grid\">${restCrimes}</div>`) : ''}\n\n${decisionCard('Cash exposure', (()=>{const b=PlayerExperience.bank(me);return [`Pocket: ${guideMoney(b.pocket)}. Bank total: ${guideMoney(b.total)}.`, `Cleared: ${guideMoney(b.cleared)}. In transit: ${guideMoney(b.transit)}. Clearing: ${b.seconds == null ? 'unknown' : minsTxt(b.seconds)}.`, 'A killer can loot pocket cash and deposits in transit. Cleared cash avoids that cut. All bank cash is lost on death.'];})())}\n      <div class=\"card\" style=\"display:flex;flex-wrap:wrap;gap:8px;align-items:center\">\n"
        },
        {
          "at": 977015,
          "current": "        <span class=\"d\" style=\"margin-left:6px\">${['◉', '◉', '◉'].map((d, i) => `<span style=\"color:${i < hu.step ? 'var(--ok)' : 'var(--dim)'}\">${d}</span>`).join('​')}</span>\n        <div class=\"d\">${esc(hu.what || '')}</div>\n        ${hu.done ? '' : `<div style=\"margin-top:6px\">\n          ${hu.here ? `<button class=\"act prime\" id=\"hu-go\"${hu.legworkDone === false ? ' disabled' : ''}>${hu.puzzle?.required ? 'OPEN CHECK-IN PUZZLE' : 'CHECK IN'}${hu.step === 2 ? ` — collect $${fmt(hu.pay || 0)}` : ''}</button>${hu.legworkDone === false ? ` <span class=\"d\" style=\"font-size:11px\">the contact wants the work done first — ${esc(hu.legwork || 'pull a job')}</span>` : ''}`\n            : `<button class=\"act\" data-do=\"POST /v1/travel/${hu.district}\">travel to ${esc(hu.districtName || '')}</button> <span class=\"d\" style=\"font-size:11px\">then check in there</span>`}\n        </div>`}\n      </div>` : ''}\n",
          "baseline": "        <span class=\"d\" style=\"margin-left:6px\">${['◉', '◉', '◉'].map((d, i) => `<span style=\"color:${i < hu.step ? 'var(--ok)' : 'var(--dim)'}\">${d}</span>`).join('​')}</span>\n        <div class=\"d\">${esc(hu.what || '')}</div>\n        ${hu.done ? '' : `<div style=\"margin-top:6px\">\n          ${hu.here ? `<button class=\"act prime\" id=\"hu-go\"${hu.legworkDone === false ? ' disabled' : ''}>CHECK IN${hu.step === 2 ? ` — collect $${fmt(hu.pay || 0)}` : ''}</button>${hu.legworkDone === false ? ` <span class=\"d\" style=\"font-size:11px\">the contact wants the work done first — ${esc(hu.legwork || 'pull a job')}</span>` : ''}`\n            : `<button class=\"act\" data-do=\"POST /v1/travel/${hu.district}\">travel to ${esc(hu.districtName || '')}</button> <span class=\"d\" style=\"font-size:11px\">then check in there</span>`}\n        </div>`}\n      </div>` : ''}\n"
        },
        {
          "at": 985310,
          "current": "        if (dg) dg.onclick = () => act('POST', '/v1/clues/dig', {}).then(() => renderStreets());\n      } }\n    // THE HUSTLE — check in at the current stop\n    { const hg = t.querySelector('#hu-go'); if (hg) hg.onclick = () => hu.puzzle?.required\n      ? openTaskPuzzle({ selector: { scope: 'hustle', targetId: 'legwork' }, path: '/v1/hustle/advance', label: 'Hustle legwork check-in', submitLabel: 'Solve and check in', trigger: hg })\n      : act('POST', '/v1/hustle/advance', {}).then(() => renderStreets()); }\n    t.querySelectorAll('[data-corner-take]').forEach((b) => b.onclick = () =>\n      act('POST', `/v1/corner/${b.dataset.cornerTake}/accept`, {}).then(() => renderStreets()));\n    t.querySelectorAll('[data-corner-claim]').forEach((b) => b.onclick = () =>\n",
          "baseline": "        if (dg) dg.onclick = () => act('POST', '/v1/clues/dig', {}).then(() => renderStreets());\n      } }\n    // THE HUSTLE — check in at the current stop\n    { const hg = t.querySelector('#hu-go'); if (hg) hg.onclick = () => act('POST', '/v1/hustle/advance', {}).then(() => renderStreets()); }\n    t.querySelectorAll('[data-corner-take]').forEach((b) => b.onclick = () =>\n      act('POST', `/v1/corner/${b.dataset.cornerTake}/accept`, {}).then(() => renderStreets()));\n    t.querySelectorAll('[data-corner-claim]').forEach((b) => b.onclick = () =>\n"
        },
        {
          "at": 1340980,
          "current": "      act('POST', '/v1/pen/talk', {}).then(() => renderPen()); }\n  }\n\n  let taskPuzzleUI = null;\n  function openTaskPuzzle(options) {\n    taskPuzzleUI ||= window.createOmertaTaskPuzzles({ read: api, issue: api, action: act,\n      getActor: () => `${me?.id}:${me?.generation}`, refresh: async () => { await refresh(); renderActive({ afterAction: true }); },\n      focusFallback: () => { const panel = document.getElementById(`tab-${currentTab}`); const control = [...(panel?.querySelectorAll('button:not(:disabled), summary') || [])].find(node => node.getClientRects().length); (control || panel)?.focus(); } });\n    taskPuzzleUI.open(options);\n  }\n  document.addEventListener('click', event => {\n    const button = event.target?.closest?.('[data-task-crime]');\n    if (!button || button.disabled) return;\n    const crime = rules?.crimes?.find(c => c.id === button.dataset.taskCrime);\n    if (crime) openTaskPuzzle({ selector: { scope: 'crime', targetId: crime.id }, path: `/v1/crimes/${crime.id}`,\n      label: `Prepare ${crime.name}`, submitLabel: 'Solve and attempt crime', trigger: button, body: { approach: 'standard' }, approaches: rules?.crimeApproaches });\n  });\n\n  // data-do buttons (POST/GET; an optional data-body='{...}' rides along).\n  // A button may also carry data-confirm=\"Title|the consequence\" — most of the irreversible verbs\n  // in the game are declarative data-do buttons, so the guard has to live here rather than being\n",
          "baseline": "      act('POST', '/v1/pen/talk', {}).then(() => renderPen()); }\n  }\n\n  // data-do buttons (POST/GET; an optional data-body='{...}' rides along).\n  // A button may also carry data-confirm=\"Title|the consequence\" — most of the irreversible verbs\n  // in the game are declarative data-do buttons, so the guard has to live here rather than being\n"
        },
        {
          "at": 1391937,
          "current": "  if (workspaceUX) uxModules.push(workspaceUX);\n  for (const factory of [window.createOmertaFeedback, window.createOmertaProgression, window.createOmertaSocial, window.createOmertaNavigation,\n    window.createOmertaTactics, window.createOmertaInvestigation, window.createOmertaCoordination,\n    window.createOmertaFeel, window.createOmertaTools, window.createOmertaIdentity, window.createOmertaStory, window.createOmertaQuests, window.createOmertaCommunity, window.createOmertaWorld, window.createOmertaNoirShell, window.createOmertaStrategyCommand]) {\n    if (!factory) continue;\n    try { const module = factory(uxContext); uxModules.push(module); if (factory === window.createOmertaFeedback) feedbackUX = module; }\n    catch (error) { console.warn('UI enhancement unavailable', error); }\n",
          "baseline": "  if (workspaceUX) uxModules.push(workspaceUX);\n  for (const factory of [window.createOmertaFeedback, window.createOmertaProgression, window.createOmertaSocial, window.createOmertaNavigation,\n    window.createOmertaTactics, window.createOmertaInvestigation, window.createOmertaCoordination,\n    window.createOmertaFeel, window.createOmertaTools, window.createOmertaIdentity, window.createOmertaStory, window.createOmertaQuests, window.createOmertaCommunity, window.createOmertaWorld]) {\n    if (!factory) continue;\n    try { const module = factory(uxContext); uxModules.push(module); if (factory === window.createOmertaFeedback) feedbackUX = module; }\n    catch (error) { console.warn('UI enhancement unavailable', error); }\n"
        },
        {
          "at": 1392732,
          "current": "  // The shell reveals optional controls without replacing their original action handlers.\n  const gameMenu = $('#game-menu'), cityDirectory = $('#city-directory');\n  const wideNavigation = matchMedia('(min-width: 1001px)');\n  const syncDirectory = () => { cityDirectory.open = false; };\n  syncDirectory(); wideNavigation.addEventListener('change', syncDirectory);\n  function closeGameMenu(focus = false) {\n    if (!gameMenu.open) return;\n",
          "baseline": "  // The shell reveals optional controls without replacing their original action handlers.\n  const gameMenu = $('#game-menu'), cityDirectory = $('#city-directory');\n  const wideNavigation = matchMedia('(min-width: 1001px)');\n  const syncDirectory = () => { cityDirectory.open = wideNavigation.matches; };\n  syncDirectory(); wideNavigation.addEventListener('change', syncDirectory);\n  function closeGameMenu(focus = false) {\n    if (!gameMenu.open) return;\n"
        }
      ]
    },
    "public/invite.html": {
      "current": {
        "mode": "100644",
        "blob": "36b973e8b60de71a4512b3bfc32a9f29ca0eba22",
        "sha256": "51cb6c5c8bfcb89e3aada4ab88c4b4af43f0f9734da3551901265916de3ef70d",
        "bytes": 10523
      },
      "baseline": {
        "mode": "100644",
        "blob": "605d62403e3bab4eb94b53bb9b614d61cdbe896f",
        "sha256": "8fc7fc6de1afa7406199f65bac414516ea9f9ef8b41a3e8810466a1ec1faf6d8",
        "bytes": 12591
      },
      "inverses": [
        {
          "at": 5526,
          "current": "  </main>\n  <footer><span>LOYALTY IS EARNED. ENTRY IS INVITED.</span><span>OMERTÀ · LAUNCH ACCESS</span></footer>\n  <noscript><p style=\"padding:24px\">Enable JavaScript to redeem your invitation or sign in.</p></noscript>\n  <script>\n    const status = document.querySelector('#gate-status');\n    const codeInput = document.querySelector('#invite-code');\n    const pendingKey = 'omerta_launch_pending';\n",
          "baseline": "  </main>\n  <footer><span>LOYALTY IS EARNED. ENTRY IS INVITED.</span><span>OMERTÀ · LAUNCH ACCESS</span></footer>\n  <noscript><p style=\"padding:24px\">Enable JavaScript to redeem your invitation or sign in.</p></noscript>\n  <dialog id=\"age-dialog\" aria-labelledby=\"age-title\"><h2 id=\"age-title\">Your birth date</h2><p>Enter your complete birth date to continue. We check it without saving it.</p><form id=\"age-form\"><label for=\"age-date\">Birth date</label><input id=\"age-date\" type=\"date\" required><button type=\"submit\">Continue</button><button type=\"button\" id=\"age-cancel\">Cancel</button></form><p id=\"age-status\" role=\"alert\"></p><p><a href=\"/privacy\">Privacy policy and help</a></p></dialog>\n  <script>\n    let ageChecked = 0;\n    async function verifyAge() {\n      if (ageChecked > Date.now()) return;\n      if (sessionStorage.getItem('omerta_age_blocked')) throw new Error('Account creation is unavailable. See /privacy for help.');\n      await new Promise((resolve, reject) => {\n        const dialog = document.querySelector('#age-dialog');\n        const finish = (error) => { dialog.close(); error ? reject(error) : resolve(); };\n        document.querySelector('#age-cancel').onclick = () => finish(new Error('Birth date check cancelled.'));\n        dialog.oncancel = (event) => { event.preventDefault(); finish(new Error('Birth date check cancelled.')); };\n        document.querySelector('#age-form').onsubmit = async (event) => {\n          event.preventDefault();\n          const input = document.querySelector('#age-date');\n          const birthDate = input.value; input.value = '';\n          const response = await fetch('/v1/age-check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ birthDate }) });\n          const result = await response.json();\n          if (response.ok) { ageChecked = Date.now() + 14 * 60 * 1000; finish(); }\n          else {\n            document.querySelector('#age-status').textContent = result.message || 'Please try again.';\n            if (result.error === 'age_ineligible') { sessionStorage.setItem('omerta_age_blocked', '1'); document.querySelector('#age-form').hidden = true; }\n          }\n        };\n        dialog.showModal();\n      });\n    }\n    const status = document.querySelector('#gate-status');\n    const codeInput = document.querySelector('#invite-code');\n    const pendingKey = 'omerta_launch_pending';\n"
        },
        {
          "at": 8408,
          "current": "      message('Checking your invitation…');\n      try {\n        const inviteCode = codeInput.value.trim();\n        let operation = pending();\n        if (!operation || operation.inviteCode !== inviteCode) {\n          operation = { inviteCode, bootstrapSecret: secret() };\n",
          "baseline": "      message('Checking your invitation…');\n      try {\n        const inviteCode = codeInput.value.trim();\n        await verifyAge();\n        let operation = pending();\n        if (!operation || operation.inviteCode !== inviteCode) {\n          operation = { inviteCode, bootstrapSecret: secret() };\n"
        },
        {
          "at": 9022,
          "current": "    };\n    document.querySelector('#return-x').onclick = async () => {\n      const button = document.querySelector('#return-x'); button.disabled = true; message('Connecting to X…');\n      try { location.assign((await request('/v1/auth/x/start', {})).url); }\n      catch (error) { message(error.message, true); button.disabled = false; }\n    };\n    document.querySelector('#token-form').onsubmit = async (event) => {\n",
          "baseline": "    };\n    document.querySelector('#return-x').onclick = async () => {\n      const button = document.querySelector('#return-x'); button.disabled = true; message('Connecting to X…');\n      try { await verifyAge(); location.assign((await request('/v1/auth/x/start', {})).url); }\n      catch (error) { message(error.message, true); button.disabled = false; }\n    };\n    document.querySelector('#token-form').onsubmit = async (event) => {\n"
        },
        {
          "at": 9503,
          "current": "      try {\n        let token = document.querySelector('#account-token').value.trim();\n        const provider = document.querySelector('#token-kind').value;\n        if (provider !== 'omerta') token = (await request('/v1/auth/' + provider, { token })).token;\n        await request('/v1/access/session', {}, token); await enter(token);\n      }\n      catch (error) { message(error.message, true); }\n",
          "baseline": "      try {\n        let token = document.querySelector('#account-token').value.trim();\n        const provider = document.querySelector('#token-kind').value;\n        if (provider !== 'omerta') { await verifyAge(); token = (await request('/v1/auth/' + provider, { token })).token; }\n        await request('/v1/access/session', {}, token); await enter(token);\n      }\n      catch (error) { message(error.message, true); }\n"
        }
      ]
    },
    "public/sw.js": {
      "current": {
        "mode": "100644",
        "blob": "ce01893c73ab21a7f2186e0325246aa99993d916",
        "sha256": "d1cf7d3bc7ed9433aaa27652d9a29327e6d26ce4aa646ebffe989150def25427",
        "bytes": 4886
      },
      "baseline": {
        "mode": "100644",
        "blob": "ebbe1d4dd9559ec29cce926863395d4901d146f5",
        "sha256": "eb6cacd1a4de75600ee019a8c5f7ed7f7ae42a4d8abddae604104cbd611b504b",
        "bytes": 4595
      },
      "inverses": [
        {
          "at": 365,
          "current": "   (you always get the latest client online; cached pages are only offline fallbacks). The shared stylesheet\n   also follows the network so installed players receive visual fixes. Icons and art are cache-first.\n   The API (/v1/*, the websocket) is NEVER cached. */\nconst CACHE = 'omerta-shell-v8';\n// Never precache the private console: cache.addAll ignores its no-store response header.\nconst SHELL = ['/omerta-ui.css', '/noir-ui.css', '/noir-landing.css', '/noir-shell.js', '/strategy-command.css', '/strategy-command.js', '/manifest.json', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];\nconst cacheable = (res) => res && res.status === 200 && !res.redirected\n  && (res.type === 'basic' || res.type === 'default')\n  && !/(?:^|,)\\s*(?:no-store|private)(?:\\s|,|=|$)/i.test(res.headers.get('cache-control') || '');\n",
          "baseline": "   (you always get the latest client online; cached pages are only offline fallbacks). The shared stylesheet\n   also follows the network so installed players receive visual fixes. Icons and art are cache-first.\n   The API (/v1/*, the websocket) is NEVER cached. */\nconst CACHE = 'omerta-shell-v7';\n// Never precache the private console: cache.addAll ignores its no-store response header.\nconst SHELL = ['/omerta-ui.css', '/manifest.json', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];\nconst cacheable = (res) => res && res.status === 200 && !res.redirected\n  && (res.type === 'basic' || res.type === 'default')\n  && !/(?:^|,)\\s*(?:no-store|private)(?:\\s|,|=|$)/i.test(res.headers.get('cache-control') || '');\n"
        },
        {
          "at": 2150,
          "current": "\n  const isNav = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');\n  if (isNav || url.pathname === '/omerta-ui.css'\n    || /^\\/noir-(?:ui|landing|shell)\\.(?:js|css)$/.test(url.pathname)\n    || /^\\/strategy-command\\.(?:js|css)$/.test(url.pathname) || url.pathname === '/vendor/strategy-city-renderer.js'\n    || /^\\/ux-(?:feedback|progression|social|navigation|workspace|world|tactics|investigation|coordination|feel|tools|identity|story|community)\\.(?:js|css)$/.test(url.pathname)\n    || ['/player-experience.js', '/city-scene.js', '/city-scene.css', '/world-fieldwork.js', '/world-fieldwork.css', '/vendor/phaser.js'].includes(url.pathname)) {\n    // NETWORK-FIRST: a Codex visit belongs to its own URL, never the root game's offline slot.\n",
          "baseline": "\n  const isNav = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');\n  if (isNav || url.pathname === '/omerta-ui.css'\n    || /^\\/ux-(?:feedback|progression|social|navigation|workspace|world|tactics|investigation|coordination|feel|tools|identity|story|community)\\.(?:js|css)$/.test(url.pathname)\n    || ['/player-experience.js', '/city-scene.js', '/city-scene.css', '/world-fieldwork.js', '/world-fieldwork.css', '/vendor/phaser.js'].includes(url.pathname)) {\n    // NETWORK-FIRST: a Codex visit belongs to its own URL, never the root game's offline slot.\n"
        }
      ]
    },
    "public/ux-quests.js": {
      "current": {
        "mode": "100644",
        "blob": "bb47e0b2aeda913a607a6b9a9981168b964ce902",
        "sha256": "8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205",
        "bytes": 48930
      },
      "baseline": {
        "mode": "100644",
        "blob": "61b4ec05c45408e3d992434b42d119652dcf702d",
        "sha256": "8b8aeb833b7704f9051099f421551b91dcd1c1670076dc825ac6f78699f5beeb",
        "bytes": 48243
      },
      "inverses": [
        {
          "at": 1729,
          "current": "    const districtTabs = new Set(['streets', 'city', 'map', 'fieldwork']);\n    const pending = new Map(), local = new Map(), openSections = new Set(), interactionDrafts = new Map();\n    const qualityButtonDisabled = new WeakMap();\n    const sectionStates = new WeakMap();\n    const state = () => getState() || {};\n    const qualityUX = window.createOmertaQuestQuality?.({ getState,\n      onOperation: (instance, payload, label) => mutate('/v1/content/instances/' + encode(instance.id) + '/quality', {\n",
          "baseline": "    const districtTabs = new Set(['streets', 'city', 'map', 'fieldwork']);\n    const pending = new Map(), local = new Map(), openSections = new Set(), interactionDrafts = new Map();\n    const qualityButtonDisabled = new WeakMap();\n    const state = () => getState() || {};\n    const qualityUX = window.createOmertaQuestQuality?.({ getState,\n      onOperation: (instance, payload, label) => mutate('/v1/content/instances/' + encode(instance.id) + '/quality', {\n"
        },
        {
          "at": 7011,
          "current": "    }\n    function section(id, title, content) {\n      const panel = disclosure(title); panel.dataset.questSection = id; panel.open = openSections.has(id);\n      sectionStates.set(panel, panel.open);\n      panel.addEventListener('toggle', () => {\n        if (!panel.isConnected) return;\n        sectionStates.set(panel, panel.open);\n        panel.open ? openSections.add(id) : openSections.delete(id);\n      });\n      panel.append(content); return panel;\n    }\n    function blockers(entries) {\n",
          "baseline": "    }\n    function section(id, title, content) {\n      const panel = disclosure(title); panel.dataset.questSection = id; panel.open = openSections.has(id);\n      panel.addEventListener('toggle', () => panel.open ? openSections.add(id) : openSections.delete(id));\n      panel.append(content); return panel;\n    }\n    function blockers(entries) {\n"
        },
        {
          "at": 43917,
          "current": "      updateQualityButtons();\n      if (active && !busy && (!force || !active.closest('.quest-quality,.quest-quality-proof'))) return;\n      const focused = force && active ? { label: active.getAttribute('aria-label'), start: active.selectionStart, end: active.selectionEnd } : force ? focusedEditor : null;\n      // Native toggle events are deferred. Preserve a user's latest disclosure choice before\n      // a refetch replaces the panel, without undoing an intentional programmatic opening.\n      root.querySelectorAll('details[data-quest-section]').forEach(panel => {\n        if (sectionStates.get(panel) === panel.open) return;\n        const id = panel.dataset.questSection;\n        panel.open ? openSections.add(id) : openSections.delete(id);\n        sectionStates.set(panel, panel.open);\n      });\n      const header = el('header', 'quest-heading'); header.append(el('span', 'quest-kicker', 'Bureau of unfinished business'), el('h2', '', 'Your case files'));\n      const controls = el('nav', 'quest-tabs'); controls.setAttribute('aria-label', 'Quest tools');\n      for (const [id, title] of [['cases', 'Case files'], ['community', 'Community mysteries'], ['legacy', 'Your history']]) { const tab = button(title, () => { view = id; error = ''; load(); }); tab.setAttribute('aria-pressed', String(view === id)); tab.disabled = busy || loading; controls.append(tab); }\n",
          "baseline": "      updateQualityButtons();\n      if (active && !busy && (!force || !active.closest('.quest-quality,.quest-quality-proof'))) return;\n      const focused = force && active ? { label: active.getAttribute('aria-label'), start: active.selectionStart, end: active.selectionEnd } : force ? focusedEditor : null;\n      const header = el('header', 'quest-heading'); header.append(el('span', 'quest-kicker', 'Bureau of unfinished business'), el('h2', '', 'Your case files'));\n      const controls = el('nav', 'quest-tabs'); controls.setAttribute('aria-label', 'Quest tools');\n      for (const [id, title] of [['cases', 'Case files'], ['community', 'Community mysteries'], ['legacy', 'Your history']]) { const tab = button(title, () => { view = id; error = ''; load(); }); tab.setAttribute('aria-pressed', String(view === id)); tab.disabled = busy || loading; controls.append(tab); }\n"
        }
      ]
    },
    "public/wiki.html": {
      "current": {
        "mode": "100644",
        "blob": "8660ac659f336ffaa4b2d3cf3aa2ec98da5cceba",
        "sha256": "0f5236174c06c330cdaa53eb8475110cfda07883c4328a96decb34998fd52c80",
        "bytes": 253971
      },
      "baseline": {
        "mode": "100644",
        "blob": "e68cd78e93077bc31a4b0d48401ed34065299977",
        "sha256": "5fcd9826e5cfa5beb6b7330d50fc41cc319e5647734111c2479104efd72f4673",
        "bytes": 252178
      },
      "inverses": [
        {
          "at": 20361,
          "current": "  return `${from ? '…' : ''}${escText(before)}<mark>${escText(match)}</mark>${escText(after)}${to < clean.length ? '…' : ''}`;\n};\nconst SECTIONS = [\n  { id: 'task-puzzles', group: 'Start', title: 'Task puzzles', tag: 'missions, Hustle and optional preparation',\n    html: `<p>Family Missions <code>m2</code>, <code>m11</code>, <code>m12</code> and the Hustle legwork check-in require a short puzzle as well as their normal requirements. Open Family missions on Start Here or the check-in on Streets. The Hustle still needs real legwork and the correct district.</p>\n      <p>Crime cards offer optional preparation with feedback only, never improved odds or rewards. Choose an approach before submitting. <b>Solving and submitting executes the job</b> with its usual resources and risks; closing does not.</p>\n      <p>Choose a patrol start time, build an ordered courier route, match parcels to contacts, or deduce a suspect from evidence. Use touch or Tab, arrow keys, Space and Enter, with hints, visible focus and no dragging or fast reactions. Close with the button or Escape.</p>\n      <p>Refresh and reopening keep the issued challenge and a local answer draft when storage is available. After a lost response, use <b>Check task status</b> to read the receipt without resending. If needed, explicitly retry the exact original submission and request key. A changed occurrence requires <b>Reopen current task</b>; any committed crime attempt invalidates previous preparation.</p>\n      <p>Agents solve the same public constraints: <code>POST /v1/task-puzzles</code> with <code>{scope,targetId}</code>, or read with <code>GET /v1/task-puzzles?scope=…&amp;targetId=…</code>. Submit <code>puzzle:{id,answer}</code> with the existing job request. Verification and consumption commit with the job. See <code>/openapi.json</code> and the <a href=\"/agents#task-puzzles\">agent guide</a>. Puzzles are gameplay, not human verification.</p>` },\n  { id: 'welcome', group: 'Start', title: 'The city', tag: 'rules and reference',\n    html: `<p class=\"lead\">OMERTÀ is a persistent multiplayer mafia RPG. The server runs the rules. You start in the Docks with $500 and share the city with human and autonomous players. Other players can kill your character; your account and bloodline records survive.</p>\n      <p>Use the search box to find a system, risk, or route. The numbers here are the current settings and can change. \"Level N\" is your\n",
          "baseline": "  return `${from ? '…' : ''}${escText(before)}<mark>${escText(match)}</mark>${escText(after)}${to < clean.length ? '…' : ''}`;\n};\nconst SECTIONS = [\n  { id: 'welcome', group: 'Start', title: 'The city', tag: 'rules and reference',\n    html: `<p class=\"lead\">OMERTÀ is a persistent multiplayer mafia RPG. The server runs the rules. You start in the Docks with $500 and share the city with human and autonomous players. Other players can kill your character; your account and bloodline records survive.</p>\n      <p>Use the search box to find a system, risk, or route. The numbers here are the current settings and can change. \"Level N\" is your\n"
        }
      ]
    },
    "schema.sql": {
      "current": {
        "mode": "100755",
        "blob": "511950e2a68d50cebebe6139098a5dbb609117c9",
        "sha256": "b5c66d128de9b730bac19b135a8d13791f3bc70ba4a27818abec7de5141564de",
        "bytes": 627053
      },
      "baseline": {
        "mode": "100755",
        "blob": "86b671c5d6f6928ff3e66f1ad0fca5f46a7364e3",
        "sha256": "659235a1735d24dbebc5f9b4dfcff8a58ed766a27fd3ae32fc6c6d2ec77006dc",
        "bytes": 625914
      },
      "inverses": [
        {
          "at": 135965,
          "current": "  outcome TEXT NOT NULL\n);\n\n-- A durable crime occurrence, including failed attempts. Direct SQL prevents a\n-- stale character snapshot from clobbering it; prepared answers never bind to clocks.\nALTER TABLE characters ADD COLUMN IF NOT EXISTS crime_puzzle_revision BIGINT NOT NULL DEFAULT 0;\n\n-- ── Indexes & integrity (audit hardening) — after all tables exist ──\n-- No two LIVING characters may share a name (referral codes resolve by name, §7.13).\nCREATE UNIQUE INDEX IF NOT EXISTS ux_char_name_alive ON characters (name) WHERE alive;\n",
          "baseline": "  outcome TEXT NOT NULL\n);\n\n-- ── Indexes & integrity (audit hardening) — after all tables exist ──\n-- No two LIVING characters may share a name (referral codes resolve by name, §7.13).\nCREATE UNIQUE INDEX IF NOT EXISTS ux_char_name_alive ON characters (name) WHERE alive;\n"
        },
        {
          "at": 623203,
          "current": "  solved_at TIMESTAMPTZ,\n  PRIMARY KEY (account_id,day_ordinal)\n);\n\n-- Durable gameplay task puzzles. Private payloads and consumed receipts are retained;\n-- trusted adapters bind occurrences and consume under the job's character transaction.\n-- Issuance history survives estate cleanup under its original character ID, never as heir authority.\nCREATE TABLE IF NOT EXISTS task_puzzles (\n  id TEXT PRIMARY KEY,\n  issue_order BIGSERIAL NOT NULL,\n  character_id TEXT NOT NULL REFERENCES characters(id),\n  scope TEXT NOT NULL,\n  target_id TEXT NOT NULL,\n  context_key TEXT NOT NULL,\n  version INT NOT NULL CHECK (version >= 1),\n  kind TEXT NOT NULL,\n  structural_signature TEXT NOT NULL,\n  puzzle JSONB NOT NULL,\n  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),\n  consumed_at TIMESTAMPTZ,\n  UNIQUE (character_id, scope, target_id, context_key)\n);\nCREATE INDEX IF NOT EXISTS ix_task_puzzles_recent ON task_puzzles(character_id, issue_order DESC);\n",
          "baseline": "  solved_at TIMESTAMPTZ,\n  PRIMARY KEY (account_id,day_ordinal)\n);\n"
        }
      ]
    },
    "src/agentgateway.js": {
      "current": {
        "mode": "100644",
        "blob": "a5587d593e9468e8b026de46c578bc3ad6cce516",
        "sha256": "8361354dc6d1ba5ab7da51ca50561a9c3d2e4e132856b767245f10383dee4b3f",
        "bytes": 161832
      },
      "baseline": {
        "mode": "100644",
        "blob": "caca6ad7f577bc3c6f426260f7a1649542446db9",
        "sha256": "a04f73bdc3d87962361c6626604edb5a1f607c67db38353a73331f349b4b6ae5",
        "bytes": 161702
      },
      "inverses": [
        {
          "at": 3848,
          "current": "import { EQUIPMENT_ECONOMY_CONTRACTS, EQUIPMENT_ECONOMY_SCHEMAS } from './equipment-economy-contracts.js';\nimport { COMPANY_WORKFORCE_CONTRACTS, COMPANY_WORKFORCE_SCHEMAS } from './company-workforce-contracts.js';\nimport { DISTRICTS, GOODS } from './rules.js';\nimport { TASK_PUZZLE_CONTRACTS, TASK_PUZZLE_SCHEMAS, TASK_PUZZLE_SUBMISSION } from './task-puzzle-contract.js';\n\n// Routes reachable WITHOUT a player token (the discovery + auth surface). Everything else under\n// /v1 needs the bearer JWT; anything under /v1/mod/ needs the x-mod-key header instead.\n",
          "baseline": "import { EQUIPMENT_ECONOMY_CONTRACTS, EQUIPMENT_ECONOMY_SCHEMAS } from './equipment-economy-contracts.js';\nimport { COMPANY_WORKFORCE_CONTRACTS, COMPANY_WORKFORCE_SCHEMAS } from './company-workforce-contracts.js';\nimport { DISTRICTS, GOODS } from './rules.js';\n\n// Routes reachable WITHOUT a player token (the discovery + auth surface). Everything else under\n// /v1 needs the bearer JWT; anything under /v1/mod/ needs the x-mod-key header instead.\n"
        },
        {
          "at": 4530,
          "current": "  '/v1/rules', '/v1/catalog', '/v1/arena', '/v1/depots',\n  '/v1/resources/catalog', '/v1/resources/services', '/v1/resources/auctions', '/v1/resources/payments/webhook',\n  '/v1/auth/guest', '/v1/auth/agent', '/v1/auth/x', '/v1/auth/privy',\n  '/v1/access/redeem', '/v1/access/logout', '/privacy', '/terms', '/dmca', '/resources', '/vendor/walletconnect.js',\n]);\n\n// Human/asset routes we don't advertise in the machine API contract (they serve HTML/markdown).\n",
          "baseline": "  '/v1/rules', '/v1/catalog', '/v1/arena', '/v1/depots',\n  '/v1/resources/catalog', '/v1/resources/services', '/v1/resources/auctions', '/v1/resources/payments/webhook',\n  '/v1/auth/guest', '/v1/auth/agent', '/v1/auth/x', '/v1/auth/privy',\n  '/v1/access/redeem', '/v1/access/logout', '/v1/age-check', '/privacy', '/terms', '/dmca', '/resources', '/vendor/walletconnect.js',\n]);\n\n// Human/asset routes we don't advertise in the machine API contract (they serve HTML/markdown).\n"
        },
        {
          "at": 23485,
          "current": "// COMPLETE path discovery; these overlays replace its generic object body where the server itself\n// emits an action that an agent is expected to send back verbatim.\nconst OPERATION_CONTRACTS = {\n  ...TASK_PUZZLE_CONTRACTS,\n  ...QUESTING_CONTRACTS,\n  'GET /v1/deeds/discovery': {\n    operationId: 'getDeedDiscovery',\n",
          "baseline": "// COMPLETE path discovery; these overlays replace its generic object body where the server itself\n// emits an action that an agent is expected to send back verbatim.\nconst OPERATION_CONTRACTS = {\n  ...QUESTING_CONTRACTS,\n  'GET /v1/deeds/discovery': {\n    operationId: 'getDeedDiscovery',\n"
        },
        {
          "at": 30761,
          "current": "    } },\n    responseSchema: { type: 'object', required: ['token', 'agent'], properties: {\n      token: { type: 'string', description: '90-day agent bearer.' },\n      agent: { const: true, description: 'Permanently classified at creation; excluded from human-only rewards.' },\n    } },\n  },\n  'POST /v1/access/redeem': {\n",
          "baseline": "    } },\n    responseSchema: { type: 'object', required: ['token', 'agent'], properties: {\n      token: { type: 'string', description: '90-day agent bearer.' },\n      agent: { const: true, description: 'Permanently classified at creation; excluded from human-only rewards. No birth date is needed.' },\n    } },\n  },\n  'POST /v1/access/redeem': {\n"
        },
        {
          "at": 31121,
          "current": "    requestSchema: { type: 'object', required: ['bootstrapSecret'], properties: {\n      inviteCode: { type: 'string', maxLength: 128, description: 'Unused launch invitation. Reuse the same bootstrapSecret after an ambiguous response.' },\n      bootstrapSecret: { type: 'string', pattern: '^[A-Za-z0-9_-]{43}$', description: 'Persist 32 cryptographically random bytes encoded as unpadded base64url before submitting.' },\n    } },\n  },\n  'POST /v1/access/session': { operationId: 'restoreBrowserAccess', requestSchema: { type: 'object' } },\n  'POST /v1/access/logout': { operationId: 'clearBrowserAccess', requestSchema: { type: 'object' } },\n  'GET /v1/invites': { operationId: 'getLaunchInvites' },\n",
          "baseline": "    requestSchema: { type: 'object', required: ['bootstrapSecret'], properties: {\n      inviteCode: { type: 'string', maxLength: 128, description: 'Unused launch invitation. Reuse the same bootstrapSecret after an ambiguous response.' },\n      bootstrapSecret: { type: 'string', pattern: '^[A-Za-z0-9_-]{43}$', description: 'Persist 32 cryptographically random bytes encoded as unpadded base64url before submitting.' },\n      birthDate: { type: 'string', format: 'date', description: 'Human/operator-supplied date for first account creation; omitted with a valid age-check cookie or existing bootstrap recovery. Never infer a date.' },\n    } },\n  },\n  'POST /v1/age-check': {\n    operationId: 'checkAgeEligibility',\n    requestSchema: { type: 'object', required: ['birthDate'], properties: {\n      birthDate: { type: 'string', format: 'date', description: 'Complete birth date, processed transiently and never saved in account records.' },\n    } },\n    extraResponses: { 403: { description: 'Account creation is unavailable; use the privacy contact for help.' } },\n  },\n  'POST /v1/access/session': { operationId: 'restoreBrowserAccess', requestSchema: { type: 'object' } },\n  'POST /v1/access/logout': { operationId: 'clearBrowserAccess', requestSchema: { type: 'object' } },\n  'GET /v1/invites': { operationId: 'getLaunchInvites' },\n"
        },
        {
          "at": 64394,
          "current": "    operationId: 'commitCrime',\n    requestSchema: { type: 'object', additionalProperties: false, properties: {\n      approach: { type: 'string', enum: ['quiet', 'standard', 'loud'], default: 'standard' },\n      puzzle: { ...TASK_PUZZLE_SUBMISSION, description: 'Optional preparation, feedback only. Issue/resume with scope crime and this crime ID. Any committed crime attempt invalidates previous preparations. Omit for ordinary crime; never changes odds or rewards.' },\n    } },\n  },\n  'POST /v1/market/:id/fill': {\n",
          "baseline": "    operationId: 'commitCrime',\n    requestSchema: { type: 'object', additionalProperties: false, properties: {\n      approach: { type: 'string', enum: ['quiet', 'standard', 'loud'], default: 'standard' },\n    } },\n  },\n  'POST /v1/market/:id/fill': {\n"
        },
        {
          "at": 81982,
          "current": "};\n\nconst AGENT_SCHEMAS = {\n  ...TASK_PUZZLE_SCHEMAS,\n  ...QUESTING_SCHEMAS,\n  DeedDiscovery: {\n    type: 'object', required: ['config', 'primaryClaimed', 'currentDistrict', 'questEligible', 'actorEligible', 'buildings'],\n",
          "baseline": "};\n\nconst AGENT_SCHEMAS = {\n  ...QUESTING_SCHEMAS,\n  DeedDiscovery: {\n    type: 'object', required: ['config', 'primaryClaimed', 'currentDistrict', 'questEligible', 'actorEligible', 'buildings'],\n"
        },
        {
          "at": 153010,
          "current": "      description: 'Autonomous agents are first-class players. New accounts need no invitation. '\n        + 'See /agents for the quickstart, '\n        + '/v1/rules for the machine rulebook, and /llms.txt for the discovery index. New agents use '\n        + 'POST /v1/auth/agent; existing accounts use POST /v1/auth/agent-key. Agents need a linked EVM wallet and a minted character '\n        + 'before on-chain extraction can open for them. Errors are stable string codes: { error, message }.',\n      contact: { url: baseUrl },\n    },\n",
          "baseline": "      description: 'Autonomous agents are first-class players. New accounts need no invitation. '\n        + 'See /agents for the quickstart, '\n        + '/v1/rules for the machine rulebook, and /llms.txt for the discovery index. New agents use '\n        + 'POST /v1/auth/agent without a birth date; existing accounts use POST /v1/auth/agent-key. Agents need a linked EVM wallet and a minted character '\n        + 'before on-chain extraction can open for them. Errors are stable string codes: { error, message }.',\n      contact: { url: baseUrl },\n    },\n"
        },
        {
          "at": 155944,
          "current": "- Execute a turn: POST ${baseUrl}/v1/agent/act with the latest \\`{turnId, actionId}\\`; success returns the post-action turn, while \\`409 stale_turn\\` returns a replacement snapshot without executing.\n- Agent Alpha is the owner-operated bounded runner in \\`tools/agent-alpha.js\\`: one durable identity, default one action, finite 1–50 attempts, at least 3100 ms between mutations, no reset, and no fleet, PvP, borrowing, human-faucet, wallet, mint, withdrawal, or replacement automation.\n- [OpenAPI 3.1 spec](${baseUrl}/openapi.json): every route, for your tool framework.\n- New agents: POST ${baseUrl}/v1/auth/agent with a durably saved random 32-byte base64url bootstrapSecret (permanent 🤖 flag, 90-day token). Save the bearer before acknowledging bootstrap; retry the same secret after an ambiguous response. Existing accounts use POST ${baseUrl}/v1/auth/agent-key.\n- Before extraction: link a wallet through POST ${baseUrl}/v1/wallet/challenge and POST ${baseUrl}/v1/wallet/verify, then mint the character through POST ${baseUrl}/v1/character/mint. Wallet linking alone is not enough; the production rail is still dormant until launch.\n\n## Machine rulebook\n- [Rules](${baseUrl}/v1/rules): crimes, districts, guns, drugs, goods, catalogs, thresholds, paths.\n- Task puzzles: POST /v1/task-puzzles with {scope,targetId} issues or resumes the current puzzle; GET with the same query reads it without issuing. Required for missions m2/m11/m12 and Hustle legwork (targetId legwork, step 1). Submit puzzle:{id,answer} with the existing job action. Crime preparation is optional feedback only. Hints and all constraints are public; agents remain first-class players. Puzzles are gameplay, not human verification.\n- [Capability catalog](${baseUrl}/v1/catalog): level-gated fronts plus direct Phase 1 world-graph route pointers.\n\n## Phase 1 world graph: direct play\n",
          "baseline": "- Execute a turn: POST ${baseUrl}/v1/agent/act with the latest \\`{turnId, actionId}\\`; success returns the post-action turn, while \\`409 stale_turn\\` returns a replacement snapshot without executing.\n- Agent Alpha is the owner-operated bounded runner in \\`tools/agent-alpha.js\\`: one durable identity, default one action, finite 1–50 attempts, at least 3100 ms between mutations, no reset, and no fleet, PvP, borrowing, human-faucet, wallet, mint, withdrawal, or replacement automation.\n- [OpenAPI 3.1 spec](${baseUrl}/openapi.json): every route, for your tool framework.\n- New agents: POST ${baseUrl}/v1/auth/agent with a durably saved random 32-byte base64url bootstrapSecret (permanent 🤖 flag, no birth date, 90-day token). Save the bearer before acknowledging bootstrap; retry the same secret after an ambiguous response. Human signup requires an age check. Existing accounts use POST ${baseUrl}/v1/auth/agent-key.\n- Before extraction: link a wallet through POST ${baseUrl}/v1/wallet/challenge and POST ${baseUrl}/v1/wallet/verify, then mint the character through POST ${baseUrl}/v1/character/mint. Wallet linking alone is not enough; the production rail is still dormant until launch.\n\n## Machine rulebook\n- [Rules](${baseUrl}/v1/rules): crimes, districts, guns, drugs, goods, catalogs, thresholds, paths.\n- [Capability catalog](${baseUrl}/v1/catalog): level-gated fronts plus direct Phase 1 world-graph route pointers.\n\n## Phase 1 world graph: direct play\n"
        }
      ]
    },
    "src/auth.js": {
      "current": {
        "mode": "100644",
        "blob": "060f9e0f0d9c86498122343d9e997703be2752a5",
        "sha256": "7a7a89a68999220817766dff20d61aeb47e75bfdf8957a868bc8f5acf985800f",
        "bytes": 20803
      },
      "baseline": {
        "mode": "100644",
        "blob": "a147dd0eb8b48b2e3aded148d67fc8f84d546f78",
        "sha256": "e9aa8c63cf522b2287fdf4d0584e8d054312d225e95b88962e4a7e18d4acc17b",
        "bytes": 20893
      },
      "inverses": [
        {
          "at": 11822,
          "current": "}\n\nexport async function accountForGuestBootstrap(\n  pool, recoverySecret, ip, invite, createdIpAuthority = null,\n) {\n  return accountForBootstrap(pool, recoverySecret, ip, invite, false, createdIpAuthority);\n}\n\nexport async function accountForAgentBootstrap(pool, recoverySecret, ip, invite, createdIpAuthority = null) {\n  return accountForBootstrap(pool, recoverySecret, ip, invite, true, createdIpAuthority);\n}\n\nasync function accountForBootstrap(pool, recoverySecret, ip, invite, agent, createdIpAuthority) {\n  if (typeof recoverySecret !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(recoverySecret)) {\n    throw new GameError('bootstrap_credential', 'Invalid guest bootstrap credential.');\n  }\n",
          "baseline": "}\n\nexport async function accountForGuestBootstrap(\n  pool, recoverySecret, ip, invite, beforeCreate = () => {}, createdIpAuthority = null,\n) {\n  return accountForBootstrap(pool, recoverySecret, ip, invite, beforeCreate, false, createdIpAuthority);\n}\n\nexport async function accountForAgentBootstrap(pool, recoverySecret, ip, invite, createdIpAuthority = null) {\n  return accountForBootstrap(pool, recoverySecret, ip, invite, () => {}, true, createdIpAuthority);\n}\n\nasync function accountForBootstrap(pool, recoverySecret, ip, invite, beforeCreate, agent, createdIpAuthority) {\n  if (typeof recoverySecret !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(recoverySecret)) {\n    throw new GameError('bootstrap_credential', 'Invalid guest bootstrap credential.');\n  }\n"
        },
        {
          "at": 13016,
          "current": "    const existing = await recoverCommittedGuestBootstrap(pool, recoveryHash, ip, agent);\n    if (existing) return existing;\n\n    const id = crypto.randomUUID();\n    const tokenVersion = 0;\n    const client = await pool.connect();\n",
          "baseline": "    const existing = await recoverCommittedGuestBootstrap(pool, recoveryHash, ip, agent);\n    if (existing) return existing;\n\n    await beforeCreate();\n\n    const id = crypto.randomUUID();\n    const tokenVersion = 0;\n    const client = await pool.connect();\n"
        }
      ]
    },
    "src/businesspolicy.js": {
      "current": {
        "mode": "100644",
        "blob": "4798aec24d4f12443c97e761d49946ac2d828a53",
        "sha256": "b3fa39412f83640f0ea3ce8b62064aa5b39752a6ea0c072ab48823938900b23b",
        "bytes": 22387
      },
      "baseline": {
        "mode": "100644",
        "blob": "6653cbf83b4adc1b8634b9949275ac60323ef22b",
        "sha256": "773012d9e65bbb7062d7e1428aa69e5e9014d84f1c60f11829e5044db5512def",
        "bytes": 18477
      },
      "inverses": [
        {
          "at": 905,
          "current": "const amount = value => bounded(value ?? 0, 'amount');\nconst DEFAULTS = Object.freeze({ duty: 'general', providerId: null, maxOutputTokens: 256, targetMarginBps: 2500,\n  minimumMarginUsdMicros: 10000, operatingCostPerJobUsdMicros: 0, paymentFeeBps: 0, maxActiveJobs: 3, minimumReserveUsdMicros: 0,\n  maxProposals: 5, minimumRenewalAcceptedJobs: 2, workSecondsPerJob: 300, planningHorizonSeconds: 3600 });\nexport function normalizeBusinessPolicy(input = {}) {\n  if (!input || Array.isArray(input) || typeof input !== 'object'\n      || Object.keys(input).some(key => !Object.hasOwn(DEFAULTS, key))) throw new Error('Invalid business policy');\n",
          "baseline": "const amount = value => bounded(value ?? 0, 'amount');\nconst DEFAULTS = Object.freeze({ duty: 'general', providerId: null, maxOutputTokens: 256, targetMarginBps: 2500,\n  minimumMarginUsdMicros: 10000, operatingCostPerJobUsdMicros: 0, paymentFeeBps: 0, maxActiveJobs: 3, minimumReserveUsdMicros: 0,\n  maxProposals: 5, minimumRenewalAcceptedJobs: 2 });\nexport function normalizeBusinessPolicy(input = {}) {\n  if (!input || Array.isArray(input) || typeof input !== 'object'\n      || Object.keys(input).some(key => !Object.hasOwn(DEFAULTS, key))) throw new Error('Invalid business policy');\n"
        },
        {
          "at": 2351,
          "current": "  bounded(policy.minimumReserveUsdMicros, 'reserve', 0, 1000000000000);\n  bounded(policy.maxProposals, 'proposal limit', 1, 10);\n  bounded(policy.minimumRenewalAcceptedJobs, 'renewal threshold', 1, 100);\n  bounded(policy.workSecondsPerJob, 'work duration estimate', 60, 3600);\n  bounded(policy.planningHorizonSeconds, 'planning horizon', 60, 86400);\n  return policy;\n}\nfunction estimatePaymentFee(price, bps) { return Number((BigInt(price) * BigInt(bps) + 99999999n) / 100000000n * 10000n); }\nfunction workSchedule(jobs, active, pendingAwardBids, now, policy) {\n  const visibleActive = jobs.filter(job => ['open','claimed','submitted','disputed'].includes(job.state)).length;\n  const deadline = job => Number.isFinite(Date.parse(job.expiresAt)) ? Date.parse(job.expiresAt) : Infinity;\n  const pending = jobs.filter(job => ['open','claimed'].includes(job.state))\n    .sort((a,b) => deadline(a) - deadline(b) || a.id.localeCompare(b.id));\n  const reservedWorkSeconds = pending.length * policy.workSecondsPerJob;\n  if (!Number.isFinite(new Date(now + Math.max(reservedWorkSeconds, policy.planningHorizonSeconds) * 1000).getTime()))\n    throw new Error('Invalid business snapshot time range');\n  const commitments = pending.map((job, index) => {\n    const start = now + index * policy.workSecondsPerJob * 1000;\n    const finish = start + policy.workSecondsPerJob * 1000;\n    return { jobId: job.id, plannedStartAt: new Date(start).toISOString(), plannedFinishAt: new Date(finish).toISOString(),\n      estimatedSeconds: policy.workSecondsPerJob,\n      feasibleByDeadline: Number.isFinite(Date.parse(job.expiresAt)) && finish < Date.parse(job.expiresAt) };\n  });\n  const pendingSeconds = pendingAwardBids === null ? null : BigInt(pendingAwardBids) * BigInt(policy.workSecondsPerJob);\n  const pendingAwardWorkSeconds = pendingSeconds !== null && pendingSeconds + BigInt(reservedWorkSeconds) <= BigInt(MAX)\n    ? Number(pendingSeconds) : null;\n  return { commitments, reservedWorkSeconds, pendingAwardWorkSeconds,\n    remainingWorkSeconds: pendingAwardWorkSeconds === null ? null : Math.max(0, policy.planningHorizonSeconds - reservedWorkSeconds - pendingAwardWorkSeconds),\n    deadlineRisk: commitments.some(job => !job.feasibleByDeadline), activeDetailsIncomplete: visibleActive !== active,\n    assumption: 'Sequential work using operator duration estimates and immediate award; not a delivery guarantee or live reservation' };\n}\nfunction metrics(totals = {}) {\n  return { settledCustomerRevenueUsdMicros: amount(totals.settledCustomerRevenueUsdMicros),\n    settledPaidComputeCostsUsdMicros: amount(totals.settledPaidComputeCostsUsdMicros),\n",
          "baseline": "  bounded(policy.minimumReserveUsdMicros, 'reserve', 0, 1000000000000);\n  bounded(policy.maxProposals, 'proposal limit', 1, 10);\n  bounded(policy.minimumRenewalAcceptedJobs, 'renewal threshold', 1, 100);\n  return policy;\n}\nfunction estimatePaymentFee(price, bps) { return Number((BigInt(price) * BigInt(bps) + 99999999n) / 100000000n * 10000n); }\nfunction metrics(totals = {}) {\n  return { settledCustomerRevenueUsdMicros: amount(totals.settledCustomerRevenueUsdMicros),\n    settledPaidComputeCostsUsdMicros: amount(totals.settledPaidComputeCostsUsdMicros),\n"
        },
        {
          "at": 6749,
          "current": "      netProfitKnown: false };\n  });\n  if (new Set(jobs.map(job => job.id)).size !== jobs.length) throw new Error('Invalid business duplicate jobs');\n  const schedule = workSchedule(jobs, active, pendingAwardBids, now, policy);\n  const riskFlags = ['outside_costs_incomplete'];\n  if (pendingAwardBids === null) riskFlags.push('pending_bid_commitments_unknown');\n  if (jobs.filter(job => ['open','claimed','submitted','disputed'].includes(job.state)).length !== active) riskFlags.push('active_job_detail_mismatch');\n",
          "baseline": "      netProfitKnown: false };\n  });\n  if (new Set(jobs.map(job => job.id)).size !== jobs.length) throw new Error('Invalid business duplicate jobs');\n  const riskFlags = ['outside_costs_incomplete'];\n  if (pendingAwardBids === null) riskFlags.push('pending_bid_commitments_unknown');\n  if (jobs.filter(job => ['open','claimed','submitted','disputed'].includes(job.state)).length !== active) riskFlags.push('active_job_detail_mismatch');\n"
        },
        {
          "at": 12965,
          "current": "  if (snapshot.treasury?.frozen) riskFlags.push('treasury_frozen');\n  if (!authorityValid) riskFlags.push('owner_authority_unavailable');\n  if (!slots) riskFlags.push('capacity_full');\n  if (schedule.deadlineRisk) riskFlags.push('awarded_work_deadline_risk');\n  if (schedule.activeDetailsIncomplete) riskFlags.push('active_work_details_incomplete');\n  if (pendingAwardBids !== null && schedule.pendingAwardWorkSeconds === null) riskFlags.push('pending_bid_work_outside_exact_bounds');\n  if (schedule.remainingWorkSeconds !== null && schedule.remainingWorkSeconds < policy.workSecondsPerJob) riskFlags.push('work_time_capacity_full');\n  let plannedSeconds = schedule.pendingAwardWorkSeconds === null ? null : schedule.reservedWorkSeconds + schedule.pendingAwardWorkSeconds;\n  if (authorityValid && plannedSeconds !== null\n      && (plannedSeconds + policy.workSecondsPerJob) * 1000 >= Date.parse(authority.expiresAt) - now) riskFlags.push('owner_authority_window_insufficient');\n  if (quote !== null && quote > available - reserve) riskFlags.push('compute_funds_insufficient');\n  if (quote !== null && quote > daily) riskFlags.push('daily_compute_budget_insufficient');\n  const canBid = suggestedPrice !== null && snapshot.service?.enabled === true && id(policy.providerId)\n    && Number.isSafeInteger(snapshot.service.revision) && snapshot.service.revision >= 1 && snapshot.service.revision <= 2147483647\n    && snapshot.treasury?.frozen === false && authorityValid && quote <= amount(authority?.maxPerCallUsdMicros)\n    && totals.unresolvedPaidCalls === 0 && deliveryDetailsSafe && protectedCompute !== null && protectedBidCompute !== null\n    && !schedule.deadlineRisk && !schedule.activeDetailsIncomplete && plannedSeconds !== null;\n  const price = suggestedPrice === null ? null : Math.max(suggestedPrice, amount(snapshot.service?.priceUsdMicros));\n  let allocated = 0;\n  for (const bounty of [...bounties].sort((a,b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt))) {\n    if (!canBid || allocated >= slots || quote > available - reserve || quote > daily\n        || plannedSeconds + policy.workSecondsPerJob > policy.planningHorizonSeconds\n        || now + (plannedSeconds + policy.workSecondsPerJob) * 1000 >= Date.parse(authority.expiresAt)) break;\n    if (!id(bounty.id) || bounty.buyerAccountId === snapshot.accountId || amount(bounty.budgetUsdMicros) < price\n        || !Number.isFinite(Date.parse(bounty.expiresAt)) || Date.parse(bounty.expiresAt) < now + 60000) continue;\n    if (!propose({ kind: 'bid', bountyId: bounty.id, priceUsdMicros: price, expectedServiceRevision: snapshot.service.revision, providerId: policy.providerId, maxOutputTokens: policy.maxOutputTokens, computeReserveUsdMicros: quote,\n      expectedKnownMarginUsdMicros: price - quote, estimatedPaymentFeeUsdMicros: estimatePaymentFee(price, policy.paymentFeeBps),\n      estimatedContributionUsdMicros: price - costBasis - policy.operatingCostPerJobUsdMicros - estimatePaymentFee(price, policy.paymentFeeBps),\n      deliverySeconds: Math.max(3600, plannedSeconds + policy.workSecondsPerJob + 1), estimatedWorkSeconds: policy.workSecondsPerJob,\n      plannedStartAt: new Date(now + plannedSeconds * 1000).toISOString(),\n      plannedFinishAt: new Date(now + (plannedSeconds + policy.workSecondsPerJob) * 1000).toISOString(),\n      reason: 'funded_capacity_and_target_margin', requiresOwnerApproval: true })) break;\n    allocated++; plannedSeconds += policy.workSecondsPerJob; available -= quote; daily -= quote;\n  }\n  if (suggestedPrice !== null && snapshot.service?.enabled === true && suggestedPrice !== snapshot.service.priceUsdMicros) {\n    propose({ kind: 'service_price', priceUsdMicros: suggestedPrice, expectedServiceRevision: snapshot.service.revision, reason: 'conservative_cost_and_margin', requiresOwnerApproval: true });\n",
          "baseline": "  if (snapshot.treasury?.frozen) riskFlags.push('treasury_frozen');\n  if (!authorityValid) riskFlags.push('owner_authority_unavailable');\n  if (!slots) riskFlags.push('capacity_full');\n  if (quote !== null && quote > available - reserve) riskFlags.push('compute_funds_insufficient');\n  if (quote !== null && quote > daily) riskFlags.push('daily_compute_budget_insufficient');\n  const canBid = suggestedPrice !== null && snapshot.service?.enabled === true && id(policy.providerId)\n    && Number.isSafeInteger(snapshot.service.revision) && snapshot.service.revision >= 1 && snapshot.service.revision <= 2147483647\n    && snapshot.treasury?.frozen === false && authorityValid && quote <= amount(authority?.maxPerCallUsdMicros)\n    && totals.unresolvedPaidCalls === 0 && deliveryDetailsSafe && protectedCompute !== null && protectedBidCompute !== null;\n  const price = suggestedPrice === null ? null : Math.max(suggestedPrice, amount(snapshot.service?.priceUsdMicros));\n  let allocated = 0;\n  for (const bounty of [...bounties].sort((a,b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt))) {\n    if (!canBid || allocated >= slots || quote > available - reserve || quote > daily) break;\n    if (!id(bounty.id) || bounty.buyerAccountId === snapshot.accountId || amount(bounty.budgetUsdMicros) < price\n        || !Number.isFinite(Date.parse(bounty.expiresAt)) || Date.parse(bounty.expiresAt) < now + 60000) continue;\n    if (!propose({ kind: 'bid', bountyId: bounty.id, priceUsdMicros: price, expectedServiceRevision: snapshot.service.revision, providerId: policy.providerId, maxOutputTokens: policy.maxOutputTokens, computeReserveUsdMicros: quote,\n      expectedKnownMarginUsdMicros: price - quote, estimatedPaymentFeeUsdMicros: estimatePaymentFee(price, policy.paymentFeeBps),\n      estimatedContributionUsdMicros: price - costBasis - policy.operatingCostPerJobUsdMicros - estimatePaymentFee(price, policy.paymentFeeBps), deliverySeconds: 3600, reason: 'funded_capacity_and_target_margin', requiresOwnerApproval: true })) break;\n    allocated++; available -= quote; daily -= quote;\n  }\n  if (suggestedPrice !== null && snapshot.service?.enabled === true && suggestedPrice !== snapshot.service.priceUsdMicros) {\n    propose({ kind: 'service_price', priceUsdMicros: suggestedPrice, expectedServiceRevision: snapshot.service.revision, reason: 'conservative_cost_and_margin', requiresOwnerApproval: true });\n"
        },
        {
          "at": 18636,
          "current": "      feeRoundingReserveUsdMicros: policy.paymentFeeBps ? 10000 : 0, basis: 'Operator estimates, not reconciled bills' },\n    proposals, deliveryBudget, bidCommitmentBudget, capacity: { activeJobs: active, reservedSlots: active,\n      pendingAwardSlots: pendingAwardBids, availableSlots: slots, proposedWorkSlots: allocated },\n    scheduling: { ...schedule, planningHorizonSeconds: policy.planningHorizonSeconds,\n      proposedWorkSeconds: allocated * policy.workSecondsPerJob,\n      remainingAfterProposalsSeconds: plannedSeconds === null ? null : Math.max(0, policy.planningHorizonSeconds - plannedSeconds) },\n    computeValue: { providerOutcomes, causalEffect: null, measurement: 'Descriptive outcomes; stronger models require controlled comparison.' },\n    riskFlags, outsideCostsComplete: false, profitabilityKnown: false };\n}\n",
          "baseline": "      feeRoundingReserveUsdMicros: policy.paymentFeeBps ? 10000 : 0, basis: 'Operator estimates, not reconciled bills' },\n    proposals, deliveryBudget, bidCommitmentBudget, capacity: { activeJobs: active, reservedSlots: active,\n      pendingAwardSlots: pendingAwardBids, availableSlots: slots, proposedWorkSlots: allocated },\n    computeValue: { providerOutcomes, causalEffect: null, measurement: 'Descriptive outcomes; stronger models require controlled comparison.' },\n    riskFlags, outsideCostsComplete: false, profitabilityKnown: false };\n}\n"
        }
      ]
    },
    "src/client-shell.js": {
      "current": {
        "mode": "100644",
        "blob": "5f093004fa2a0431bb019f593abbcbf10944aa42",
        "sha256": "561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4",
        "bytes": 4509
      },
      "baseline": {
        "mode": "100644",
        "blob": "0248b3685944b46a23cdefedf39321acc7b0b47e",
        "sha256": "48e9ffc844ae08867e0923743dd94d3fcb859d00cdacdf433f82a7323184817c",
        "bytes": 4458
      },
      "inverses": [
        {
          "at": 756,
          "current": "  const revision = version(html);\n  const scripts = [...html.matchAll(/<script src=\"([^\"]+)\"[^>]*><\\/script>/g)].map(match => match[1]);\n  const styles = [...html.matchAll(/<link rel=\"stylesheet\" href=\"([^\"]+)\"[^>]*>/g)]\n    .map(match => match[1]).filter(url => !['/omerta-ui.css', '/noir-ui.css', '/noir-landing.css'].includes(url.split('?')[0]));\n  if (!scripts.length || [...scripts, ...styles].some(url => !/^\\/[a-z0-9][a-z0-9_./?=&-]*$/i.test(url) || url.split(/[/?]/).includes('..')))\n    throw new Error('Game dependencies must remain explicit local assets.');\n  const languageStart = runtime.indexOf('  const I18N = {');\n",
          "baseline": "  const revision = version(html);\n  const scripts = [...html.matchAll(/<script src=\"([^\"]+)\"[^>]*><\\/script>/g)].map(match => match[1]);\n  const styles = [...html.matchAll(/<link rel=\"stylesheet\" href=\"([^\"]+)\"[^>]*>/g)]\n    .map(match => match[1]).filter(url => !url.startsWith('/omerta-ui.css'));\n  if (!scripts.length || [...scripts, ...styles].some(url => !/^\\/[a-z0-9][a-z0-9_./?=&-]*$/i.test(url) || url.split(/[/?]/).includes('..')))\n    throw new Error('Game dependencies must remain explicit local assets.');\n  const languageStart = runtime.indexOf('  const I18N = {');\n"
        }
      ]
    },
    "src/game.js": {
      "current": {
        "mode": "100644",
        "blob": "c833190107a3f378e3513718d92ea02dbc04b347",
        "sha256": "f027bfa3c314c9d045a2446e9fef755fe8e4b67ac7ba49ceb0661302bac78654",
        "bytes": 231839
      },
      "baseline": {
        "mode": "100644",
        "blob": "01e36158e5398dc8da427affd8363ee8457d7869",
        "sha256": "f8058d0890ab0d2bf226b0f1c645f95e756f9ac86cad4528c134c1fe7abb7a28",
        "bytes": 231036
      },
      "inverses": [
        {
          "at": 2241,
          "current": "import { accrue } from './accrual.js';\nimport { captureAccrualEconomy, accrualEconomyIssues } from './economy-monitor.js';\nimport { consumeStreetActionCooldown } from './actioncooldown.js';\nimport { taskPuzzleContext } from './task-puzzle-jobs.js';\nimport { consumeTaskPuzzle } from './task-puzzles.js';\nimport { resolvedBoundedClaimIds, takeAccountDailyClaim } from './accountdaily.js';\nimport { logCollect } from './collection.js';\nimport { claimFirst, firstTaken, __setAnnouncer } from './firsts.js';\n",
          "baseline": "import { accrue } from './accrual.js';\nimport { captureAccrualEconomy, accrualEconomyIssues } from './economy-monitor.js';\nimport { consumeStreetActionCooldown } from './actioncooldown.js';\nimport { resolvedBoundedClaimIds, takeAccountDailyClaim } from './accountdaily.js';\nimport { logCollect } from './collection.js';\nimport { claimFirst, firstTaken, __setAnnouncer } from './firsts.js';\n"
        },
        {
          "at": 175840,
          "current": "}\n\n// ── §7.2 CRIME ──\nexport async function doCrime(ch, crimeId, client, h, approach, puzzle) {\n  const c = CRIMES.find((x) => x.id === crimeId);\n  if (!c) throw new GameError('bad_crime', 'No such job.');\n  const lvl = levelOf(Number(ch.respect));\n  if (jailed(ch)) throw new GameError('jailed', 'You are in lockup.');\n  if (lvl < c.lvl) throw new GameError('level', `That job needs level ${c.lvl}.`);\n  if (Number(ch.nerve) < c.nerve) throw new GameError('nerve', `Takes ${c.nerve} nerve.`);\n  // Retain cooldown error priority, but do not consume prep before a known refusal.\n  const streetCool = coolLeft(ch.street_action_at);\n  if (streetCool) throw new GameError('cooldown', `Let the street settle. Next job or deal in ${coolWait(streetCool)}.`, { cooldownSeconds: streetCool });\n  const puzzleFeedback = puzzle !== undefined\n    ? await consumeTaskPuzzle(ch, await taskPuzzleContext(ch, { scope: 'crime', targetId: crimeId }, client), puzzle, client) : null;\n  await consumeStreetActionCooldown(ch, client);\n  await client.query('UPDATE characters SET crime_puzzle_revision=crime_puzzle_revision+1 WHERE id=$1', [ch.id]);\n  // D6a — THE APPROACH: the per-job risk/reward choice. An unknown/omitted approach falls back to\n  // 'standard' (the signed baseline, byte-identical to the old single-click behaviour). Cash EV is\n  // held ~flat by payMult ≈ 1/successMult, so the §7.2 cash faucet is untouched; the choice moves the\n",
          "baseline": "}\n\n// ── §7.2 CRIME ──\nexport async function doCrime(ch, crimeId, client, h, approach) {\n  const c = CRIMES.find((x) => x.id === crimeId);\n  if (!c) throw new GameError('bad_crime', 'No such job.');\n  const lvl = levelOf(Number(ch.respect));\n  if (jailed(ch)) throw new GameError('jailed', 'You are in lockup.');\n  if (lvl < c.lvl) throw new GameError('level', `That job needs level ${c.lvl}.`);\n  if (Number(ch.nerve) < c.nerve) throw new GameError('nerve', `Takes ${c.nerve} nerve.`);\n  await consumeStreetActionCooldown(ch, client);\n  // D6a — THE APPROACH: the per-job risk/reward choice. An unknown/omitted approach falls back to\n  // 'standard' (the signed baseline, byte-identical to the old single-click behaviour). Cash EV is\n  // held ~flat by payMult ≈ 1/successMult, so the §7.2 cash faucet is untouched; the choice moves the\n"
        },
        {
          "at": 179203,
          "current": "  const chance = Math.min(0.97, (c.base + statEdge\n    + gangLevel * 0.02 + (held.includes('brick') ? 0.02 : 0) + (rIdx >= 9 ? 0.02 : 0)) * ap.successMult);\n  const roll = Math.random();\n  const outcome = await (async () => {\n    // SOLDIERS: the assigned, fit second rides along (assists + takes a cut + carries the risk)\n    const second = await assignedSoldier(client, ch.id);\n    // THE MARK (founder: \"crimes can't just be committed against nobody\") — every job names a\n",
          "baseline": "  const chance = Math.min(0.97, (c.base + statEdge\n    + gangLevel * 0.02 + (held.includes('brick') ? 0.02 : 0) + (rIdx >= 9 ? 0.02 : 0)) * ap.successMult);\n  const roll = Math.random();\n  return (async () => {\n    // SOLDIERS: the assigned, fit second rides along (assists + takes a cut + carries the risk)\n    const second = await assignedSoldier(client, ch.id);\n    // THE MARK (founder: \"crimes can't just be committed against nobody\") — every job names a\n"
        },
        {
          "at": 188908,
          "current": "    return { ok: true, success: false, approach: ap.id, jailSeconds: jailS, victim: mark, soldier,\n      cooldownMs: PACING.STREET_ACTION_CD_MS };\n  })();\n  return { ...outcome, ...(puzzleFeedback ? { puzzle: puzzleFeedback } : {}) };\n}\n\n// ── §7.3 TRAIN ──\n",
          "baseline": "    return { ok: true, success: false, approach: ap.id, jailSeconds: jailS, victim: mark, soldier,\n      cooldownMs: PACING.STREET_ACTION_CD_MS };\n  })();\n}\n\n// ── §7.3 TRAIN ──\n"
        }
      ]
    },
    "src/gateway/context.js": {
      "current": {
        "mode": "100644",
        "blob": "082bae0a3d426c12c949c42c496f82cbb0b13bf5",
        "sha256": "7516534f6b3e426efe6c92136aa1bc9d599925fce15a89f4ce57cace35be466f",
        "bytes": 43315
      },
      "baseline": {
        "mode": "100644",
        "blob": "8e1203e0812192e64b349369eea0181406c40c24",
        "sha256": "1b3dfaa49711d8b83824a1edbfb3bb7d554a24d8496d35c3ec47b72058fe6edf",
        "bytes": 43218
      },
      "inverses": [
        {
          "at": 761,
          "current": "import { clueBoard } from '../clues.js';\nimport { territoryOf } from '../territory.js';\nimport { missionReadiness } from '../growth.js';\nimport { missionPuzzle } from '../task-puzzle-jobs.js';\nimport { dynastyBoard } from '../dynasty.js';\nimport { diplomacyBoard } from '../diplomacy.js';\nimport { MISSIONS, GOODS, DISTRICTS, BONDS, goodPriceOf, priceBlock } from '../rules.js';\n",
          "baseline": "import { clueBoard } from '../clues.js';\nimport { territoryOf } from '../territory.js';\nimport { missionReadiness } from '../growth.js';\nimport { dynastyBoard } from '../dynasty.js';\nimport { diplomacyBoard } from '../diplomacy.js';\nimport { MISSIONS, GOODS, DISTRICTS, BONDS, goodPriceOf, priceBlock } from '../rules.js';\n"
        },
        {
          "at": 13114,
          "current": "      const remaining = MISSIONS.filter((row) => !completed.includes(row.id)).map((row) => {\n        const readiness = missionReadiness(ch, row, owned);\n        return { id: row.id, title: row.name, brief: row.brief, requirements: row.req,\n          puzzle: missionPuzzle(row.id),\n          ...(has('economy.read') ? { publishedBaseRewards: row.reward } : {}),\n          available: readiness.available, missing: readiness.missing, cooldownSeconds: readiness.cooldownSeconds };\n      });\n",
          "baseline": "      const remaining = MISSIONS.filter((row) => !completed.includes(row.id)).map((row) => {\n        const readiness = missionReadiness(ch, row, owned);\n        return { id: row.id, title: row.name, brief: row.brief, requirements: row.req,\n          ...(has('economy.read') ? { publishedBaseRewards: row.reward } : {}),\n          available: readiness.available, missing: readiness.missing, cooldownSeconds: readiness.cooldownSeconds };\n      });\n"
        }
      ]
    },
    "src/growth.js": {
      "current": {
        "mode": "100644",
        "blob": "4b839e63f9a1e0e813249ae928b9581e5bfb1df7",
        "sha256": "32f6733d566505eeb5407da8dfb65c9cdfd115f717f9890ed329153b62067298",
        "bytes": 87231
      },
      "baseline": {
        "mode": "100644",
        "blob": "298eb91c65c96bf957e0bcb8f2e39a6d863f1900",
        "sha256": "a56eef048988290bcab08966e9874b74dd84d1275e062e84b1d26c5d1097657b",
        "bytes": 86847
      },
      "inverses": [
        {
          "at": 1107,
          "current": "  takeBoundedAccountDailyClaim } from './accountdaily.js';\nimport { dbCaps } from './db.js';\nimport { normalizeLegacyPaidSocialPostProof } from './socialproof.js';\nimport { missionPuzzle, taskPuzzleContext } from './task-puzzle-jobs.js';\nimport { consumeTaskPuzzle } from './task-puzzles.js';\n\n\n// ── PATHS (§5.1): first pick $10,000 at level ≥5; switching burns PATH_SWITCH_OMR ──\n",
          "baseline": "  takeBoundedAccountDailyClaim } from './accountdaily.js';\nimport { dbCaps } from './db.js';\nimport { normalizeLegacyPaidSocialPostProof } from './socialproof.js';\n\n\n// ── PATHS (§5.1): first pick $10,000 at level ≥5; switching burns PATH_SWITCH_OMR ──\n"
        },
        {
          "at": 9011,
          "current": "}\n\n// ── MISSIONS (§5.1): validate reqs (eff stats, fp, trade), pay once ──\nexport async function doMission(ch, missionId, client, h, puzzle) {\n  const m = MISSIONS.find((x) => x.id === missionId);\n  if (!m) throw new GameError('bad_mission', 'No such job on the books.');\n  const done = (await client.query('SELECT 1 FROM missions_done WHERE character_id=$1 AND mission_id=$2', [ch.id, missionId])).rows.length;\n",
          "baseline": "}\n\n// ── MISSIONS (§5.1): validate reqs (eff stats, fp, trade), pay once ──\nexport async function doMission(ch, missionId, client, h) {\n  const m = MISSIONS.find((x) => x.id === missionId);\n  if (!m) throw new GameError('bad_mission', 'No such job on the books.');\n  const done = (await client.query('SELECT 1 FROM missions_done WHERE character_id=$1 AND mission_id=$2', [ch.id, missionId])).rows.length;\n"
        },
        {
          "at": 11790,
          "current": "  // persistCharacter's positional UPDATE — the active_at pattern), so it can't be clobbered.\n  if (missionCool)\n    throw new GameError('cooldown', `The family gives you one job at a time. Next one in ${coolWait(missionCool)}.`, { cooldownSeconds: missionCool });\n  const puzzleFeedback = missionPuzzle(missionId)\n    ? await consumeTaskPuzzle(ch, await taskPuzzleContext(ch, { scope: 'mission', targetId: missionId }, client), puzzle, client) : null;\n  await client.query('INSERT INTO missions_done (character_id, mission_id) VALUES ($1,$2)', [ch.id, missionId]);\n  const missionAt = new Date(Date.now() + missionCd);\n  await client.query('UPDATE characters SET mission_at=$2 WHERE id=$1', [ch.id, missionAt]);\n",
          "baseline": "  // persistCharacter's positional UPDATE — the active_at pattern), so it can't be clobbered.\n  if (missionCool)\n    throw new GameError('cooldown', `The family gives you one job at a time. Next one in ${coolWait(missionCool)}.`, { cooldownSeconds: missionCool });\n  await client.query('INSERT INTO missions_done (character_id, mission_id) VALUES ($1,$2)', [ch.id, missionId]);\n  const missionAt = new Date(Date.now() + missionCd);\n  await client.query('UPDATE characters SET mission_at=$2 WHERE id=$1', [ch.id, missionAt]);\n"
        },
        {
          "at": 15613,
          "current": "  // it is an object rather than a bare id so nothing else can collide with it. Absence is not a\n  // discriminator — this reply had no marker only until it needed one.\n  return { ok: true, mission: { id: m.id, name: m.name },\n    ...(puzzleFeedback ? { puzzle: puzzleFeedback } : {}),\n    reward: { ...m.reward, respect: missionRep, omr: omrPaid, mintCredit: creditPaid }, title: m.title || null,\n    nextMissionSeconds: missionCd > 0 ? Math.ceil(missionCd / 1000) : 0 };\n}\n",
          "baseline": "  // it is an object rather than a bare id so nothing else can collide with it. Absence is not a\n  // discriminator — this reply had no marker only until it needed one.\n  return { ok: true, mission: { id: m.id, name: m.name },\n    reward: { ...m.reward, respect: missionRep, omr: omrPaid, mintCredit: creditPaid }, title: m.title || null,\n    nextMissionSeconds: missionCd > 0 ? Math.ceil(missionCd / 1000) : 0 };\n}\n"
        }
      ]
    },
    "src/hustle.js": {
      "current": {
        "mode": "100644",
        "blob": "71904e94e6297a607c0896349b540b30abd268b4",
        "sha256": "57f1bf9d918f3dda31991af7cbc6a4f0c3c890cd69d43ff514f721f12e48c9c2",
        "bytes": 6840
      },
      "baseline": {
        "mode": "100644",
        "blob": "9d2e89553aec80799bd0e4314ca7eaf15103d25c",
        "sha256": "66b1853107b1e727e1fb4de4114133f9d4138af3ab629c3ae01666fde3db7833",
        "bytes": 6416
      },
      "inverses": [
        {
          "at": 1048,
          "current": "import { HUSTLE, hustleOf, dayOf, levelOf, DISTRICTS, jailed, districtName } from './rules.js';\nimport { GameError, dailyCounterAdvanced } from './game.js';\nimport { accountDailyClaims, takeAccountDailyClaim } from './accountdaily.js';\nimport { hustlePuzzle, taskPuzzleContext } from './task-puzzle-jobs.js';\nimport { consumeTaskPuzzle } from './task-puzzles.js';\n\n\nasync function countersOf(client, chId, day) {\n",
          "baseline": "import { HUSTLE, hustleOf, dayOf, levelOf, DISTRICTS, jailed, districtName } from './rules.js';\nimport { GameError, dailyCounterAdvanced } from './game.js';\nimport { accountDailyClaims, takeAccountDailyClaim } from './accountdaily.js';\n\n\nasync function countersOf(client, chId, day) {\n"
        },
        {
          "at": 3592,
          "current": "  const legworkDone = cur.step === 1 ? legworkSatisfied(h, row, await countersOf(client, ch.id, day)) : true;\n  return {\n    legworkDone,\n    puzzle: cur.step === 1 ? hustlePuzzle() : null,\n    day,\n    contact: h.contact,\n    stops: h.stops.map((id) => ({ id, name: districtName(id) })),\n",
          "baseline": "  const legworkDone = cur.step === 1 ? legworkSatisfied(h, row, await countersOf(client, ch.id, day)) : true;\n  return {\n    legworkDone,\n    day,\n    contact: h.contact,\n    stops: h.stops.map((id) => ({ id, name: districtName(id) })),\n"
        },
        {
          "at": 4191,
          "current": "\n// ── advance the chain: claim the CURRENT stop (location-gated; the legwork stop also needs the\n// drawn action done SINCE the contact meeting — a counter delta, never a re-countable total) ──\nexport async function advanceHustle(ch, client, h2, puzzle) {\n  if (jailed(ch)) throw new GameError('jailed', 'No working the streets from lockup.');\n  const day = dayOf();\n  if ((await accountDailyClaims(client, ch.account_id, day, 'hustle')).has('payoff'))\n",
          "baseline": "\n// ── advance the chain: claim the CURRENT stop (location-gated; the legwork stop also needs the\n// drawn action done SINCE the contact meeting — a counter delta, never a re-countable total) ──\nexport async function advanceHustle(ch, client, h2) {\n  if (jailed(ch)) throw new GameError('jailed', 'No working the streets from lockup.');\n  const day = dayOf();\n  if ((await accountDailyClaims(client, ch.account_id, day, 'hustle')).has('payoff'))\n"
        },
        {
          "at": 5116,
          "current": "  const counters = await countersOf(client, ch.id, day);\n  if (cur.step === 1 && !legworkSatisfied(h, row, counters))\n    throw new GameError('legwork', `The contact wants the work done first — ${h.leg.how}.`);\n  const puzzleFeedback = cur.step === 1\n    ? await consumeTaskPuzzle(ch, await taskPuzzleContext(ch, { scope: 'hustle', targetId: 'legwork' }, client), puzzle, client) : null;\n  const next = cur.step + 1;\n  // the baseline snapshots the counters at the moment the LEGWORK stop opens, so only work done\n  // AFTER meeting the contact counts (a morning's stockpiled jobs can't pre-pay the chain)\n",
          "baseline": "  const counters = await countersOf(client, ch.id, day);\n  if (cur.step === 1 && !legworkSatisfied(h, row, counters))\n    throw new GameError('legwork', `The contact wants the work done first — ${h.leg.how}.`);\n  const next = cur.step + 1;\n  // the baseline snapshots the counters at the moment the LEGWORK stop opens, so only work done\n  // AFTER meeting the contact counts (a morning's stockpiled jobs can't pre-pay the chain)\n"
        },
        {
          "at": 6546,
          "current": "  }\n  const after = stepOf(h, { step: next });\n  return { ok: true, step: next, of: 3, pay: pay || undefined,\n    ...(puzzleFeedback ? { puzzle: puzzleFeedback } : {}),\n    what: after.what, district: after.district, contact: h.contact };\n}\n",
          "baseline": "  }\n  const after = stepOf(h, { step: next });\n  return { ok: true, step: next, of: 3, pay: pay || undefined,\n    what: after.what, district: after.district, contact: h.contact };\n}\n"
        }
      ]
    },
    "src/legal.js": {
      "current": {
        "mode": "100644",
        "blob": "1c8fb3a1e47b976072c68347c3736ef6e09b23ca",
        "sha256": "eb30dddfa11e33846eb6bef1ca4cfc04c3766264c21d51380a492505dc015c0f",
        "bytes": 14783
      },
      "baseline": {
        "mode": "100644",
        "blob": "840534a3e339053d29518bba12b92766f87c1d8e",
        "sha256": "32cbb32c868d3c50b2e1ee529676ac87609f12b78377eb5208c264ebf73e28cf",
        "bytes": 14912
      },
      "inverses": [
        {
          "at": 1524,
          "current": "  const title = { privacy: 'Privacy policy', terms: 'Payment terms', dmca: 'Copyright notices', resources: 'Scripts, fonts and service providers' }[kind];\n  if (!title) throw new Error('Unknown legal page');\n  const bodies = {\n    privacy: `<p><strong>Last updated: November 9, 2026.</strong> This policy explains what information OMERTÀ collects, how we use it, and the choices available to you when you use the game, website, API or connected-agent features.</p>\n${c.name ? `<p>Operator: ${esc(c.name)}.${c.address ? ` Postal address: ${esc(c.address)}.` : ''}</p>` : ''}\n<h2>Information we collect</h2><ul>\n<li><strong>Account and access information.</strong> Guest account identifiers, authentication-provider identifiers, sign-in records and IP addresses associated with account access. You can start as a guest without providing an email address.</li>\n",
          "baseline": "  const title = { privacy: 'Privacy policy', terms: 'Payment terms', dmca: 'Copyright notices', resources: 'Scripts, fonts and service providers' }[kind];\n  if (!title) throw new Error('Unknown legal page');\n  const bodies = {\n    privacy: `<p><strong>Last updated: November 7, 2026.</strong> This policy explains what information OMERTÀ collects, how we use it, and the choices available to you when you use the game, website, API or connected-agent features.</p>\n${c.name ? `<p>Operator: ${esc(c.name)}.${c.address ? ` Postal address: ${esc(c.address)}.` : ''}</p>` : ''}\n<h2>Information we collect</h2><ul>\n<li><strong>Account and access information.</strong> Guest account identifiers, authentication-provider identifiers, sign-in records and IP addresses associated with account access. You can start as a guest without providing an email address.</li>\n"
        },
        {
          "at": 6005,
          "current": "<h2>When information is shared</h2><p>Hosting and database providers process data needed to run the service. X or Privy handles sign-in when selected. Resend, or the configured email provider, delivers requested emails; your browser's push provider delivers notifications you enable. WalletConnect and blockchain RPC providers support wallet features. See the <a href=\"/resources\">scripts, fonts and service-provider inventory</a>.</p><p>Public game content is shared with its intended audience. Information sent to a third-party AI, identity, wallet or notification provider is also subject to that provider's privacy practices. Providers may process information in a country different from yours. We may disclose information to comply with legal obligations or protect players, investigate misuse and secure the service.</p>\n<h2>How long we keep information</h2><p>We keep information for as long as needed to provide the features you use, maintain game and transaction records, resolve disputes, prevent misuse and meet applicable legal obligations. Retention depends on the type of information and why it is needed. Messages and routine operational records are subject to periodic cleanup; some account, accounting and service-integrity records are retained longer. Provider logs and backups may follow separate retention periods, and backups may retain deleted information until they expire. Public blockchain records remain available independently of OMERTÀ.</p>\n<h2>Your choices and requests</h2><p>You can unsubscribe from a digest using the link in the email or turn it off in Profile. Transaction confirmations are separate from marketing preferences and are emailed where a verified address is available. Disable push notifications in the app or browser and revoke connected-agent access in Consigliere.</p><p>Depending on where you live, you may have rights to request access, correction or deletion of personal information, or to object to certain processing. We may need to verify that a request relates to your account. Some accounting, security or legally required records may need to be retained; deleting an account cannot erase blockchain history.</p>\n<h2>Age eligibility and children</h2><p>OMERTÀ is intended only for users aged 21 and older. We do not accept users under 21, including children. If you believe someone under 21 has provided personal information, report it through the privacy contact below when available so the operator can investigate, restrict access and handle deletion as appropriate.</p>\n<h2>Privacy contact</h2>${contact ? `<p>For privacy questions, account-data requests or reports involving users under 21, email ${contact}. Do not send account credentials or wallet private keys.</p>` : '<p>A dedicated privacy contact has not yet been published. Operator contact details will appear here when available. Do not post account credentials or sensitive personal information in public chat.</p>'}\n<h2>Changes to this policy</h2><p>We will update this page and its date when our practices change, and provide additional notice or request consent when required.</p>`,\n    terms: `<p>Operator: ${esc(c.name)} · ${esc(c.address)} · ${contact}.</p><section id=\"payments\"><h2>Passes, watches and confirmation</h2><p>Made Man gives you 30 days of access for the displayed $OMR price. Street Wire gives you the displayed tier and duration. Both are prepaid game passes. Buying again extends access, and neither renews automatically. Benefits end when the pass expires unless you buy again.</p><p>Standing Watches automatically spend the displayed $OMR tap price each cycle while the watch is enrolled and eligible. The Wire screen shows the price and interval before enrollment. Select “drop the watch” online to stop future renewals; the tap you already paid for lasts until expiry. You can cancel each watch in the app or with DELETE /v1/wire/watch/:targetId.</p><p>The app confirms purchases immediately. If you have a verified email address, we also queue a transaction confirmation email regardless of your marketing preferences. Keep the confirmation and check your ledger. Wallet transactions and on-chain purchases may have network fees and their own published price. Review each transaction before signing.</p><h2>Refunds and cancellation</h2><p>${esc(c.refunds)}</p><p>Contact ${contact} with the transaction identifier for payment questions or a refund request. These terms do not limit rights provided by applicable law. Cancelling a watch stops future renewals; it does not reverse a cycle you already paid for.</p></section>`,\n",
          "baseline": "<h2>When information is shared</h2><p>Hosting and database providers process data needed to run the service. X or Privy handles sign-in when selected. Resend, or the configured email provider, delivers requested emails; your browser's push provider delivers notifications you enable. WalletConnect and blockchain RPC providers support wallet features. See the <a href=\"/resources\">scripts, fonts and service-provider inventory</a>.</p><p>Public game content is shared with its intended audience. Information sent to a third-party AI, identity, wallet or notification provider is also subject to that provider's privacy practices. Providers may process information in a country different from yours. We may disclose information to comply with legal obligations or protect players, investigate misuse and secure the service.</p>\n<h2>How long we keep information</h2><p>We keep information for as long as needed to provide the features you use, maintain game and transaction records, resolve disputes, prevent misuse and meet applicable legal obligations. Retention depends on the type of information and why it is needed. Messages and routine operational records are subject to periodic cleanup; some account, accounting and service-integrity records are retained longer. Provider logs and backups may follow separate retention periods, and backups may retain deleted information until they expire. Public blockchain records remain available independently of OMERTÀ.</p>\n<h2>Your choices and requests</h2><p>You can unsubscribe from a digest using the link in the email or turn it off in Profile. Transaction confirmations are separate from marketing preferences and are emailed where a verified address is available. Disable push notifications in the app or browser and revoke connected-agent access in Consigliere.</p><p>Depending on where you live, you may have rights to request access, correction or deletion of personal information, or to object to certain processing. We may need to verify that a request relates to your account. Some accounting, security or legally required records may need to be retained; deleting an account cannot erase blockchain history.</p>\n<h2>Age eligibility and children</h2><p>OMERTÀ is intended only for users aged 21 and older. We do not accept users under 21, including children. If you provide a birth date for an eligibility check, we use it for that check without retaining the birth date in your account. If you believe someone under 21 has provided personal information, report it through the privacy contact below when available so the operator can investigate, restrict access and handle deletion as appropriate.</p>\n<h2>Privacy contact</h2>${contact ? `<p>For privacy questions, account-data requests or reports involving users under 21, email ${contact}. Do not send account credentials or wallet private keys.</p>` : '<p>A dedicated privacy contact has not yet been published. Operator contact details will appear here when available. Do not post account credentials or sensitive personal information in public chat.</p>'}\n<h2>Changes to this policy</h2><p>We will update this page and its date when our practices change, and provide additional notice or request consent when required.</p>`,\n    terms: `<p>Operator: ${esc(c.name)} · ${esc(c.address)} · ${contact}.</p><section id=\"payments\"><h2>Passes, watches and confirmation</h2><p>Made Man gives you 30 days of access for the displayed $OMR price. Street Wire gives you the displayed tier and duration. Both are prepaid game passes. Buying again extends access, and neither renews automatically. Benefits end when the pass expires unless you buy again.</p><p>Standing Watches automatically spend the displayed $OMR tap price each cycle while the watch is enrolled and eligible. The Wire screen shows the price and interval before enrollment. Select “drop the watch” online to stop future renewals; the tap you already paid for lasts until expiry. You can cancel each watch in the app or with DELETE /v1/wire/watch/:targetId.</p><p>The app confirms purchases immediately. If you have a verified email address, we also queue a transaction confirmation email regardless of your marketing preferences. Keep the confirmation and check your ledger. Wallet transactions and on-chain purchases may have network fees and their own published price. Review each transaction before signing.</p><h2>Refunds and cancellation</h2><p>${esc(c.refunds)}</p><p>Contact ${contact} with the transaction identifier for payment questions or a refund request. These terms do not limit rights provided by applicable law. Cancelling a watch stops future renewals; it does not reverse a cycle you already paid for.</p></section>`,\n"
        }
      ]
    },
    "src/server.js": {
      "current": {
        "mode": "100644",
        "blob": "0cc69dcc0d6e46ff54c699e3b6091eea4c088020",
        "sha256": "0eec1fe0dc4797c823f07460c2da2e2de9c4f47d56dbc7fbcdc5067ac1736048",
        "bytes": 311862
      },
      "baseline": {
        "mode": "100644",
        "blob": "233d3d43977b23e29dd86db63d9956ad5279d38d",
        "sha256": "5103563b4519ab7f3876e997ca4935458178af96c373d025ce73f3de0c60a3b9",
        "bytes": 311858
      },
      "inverses": [
        {
          "at": 917,
          "current": "import crypto from 'node:crypto';\nimport { rescueQuote } from './rescue-quote.js';\nimport { clientIpContextForRequest } from './client-ip.js';\nimport zlib from 'node:zlib';\nimport { makeDb } from './db.js';\nimport { createCityActivityRegistry, readCityActivityActor, cityOwnerActivityCategory } from './city-activity.js';\n",
          "baseline": "import crypto from 'node:crypto';\nimport { rescueQuote } from './rescue-quote.js';\nimport { clientIpContextForRequest } from './client-ip.js';\nimport { MINIMUM_AGE, eligibleBirthDate, ageCookie, ageStatus, requireAge } from './age.js';\nimport zlib from 'node:zlib';\nimport { makeDb } from './db.js';\nimport { createCityActivityRegistry, readCityActivityActor, cityOwnerActivityCategory } from './city-activity.js';\n"
        },
        {
          "at": 14149,
          "current": "import { register as registerUxCoordination } from './ux-coordination.js';\nimport { register as registerUxInvestigation } from './ux-investigation.js';\nimport { registerTacticsRoutes, crimeWithDecisionContext } from './ux-tactics.js';\nimport { jobTaskPuzzle, missionPuzzle, crimePuzzle } from './task-puzzle-jobs.js';\nimport * as Duels from './duels.js';\nimport * as Clues from './clues.js';\nimport * as Estate from './estate.js';\n",
          "baseline": "import { register as registerUxCoordination } from './ux-coordination.js';\nimport { register as registerUxInvestigation } from './ux-investigation.js';\nimport { registerTacticsRoutes, crimeWithDecisionContext } from './ux-tactics.js';\nimport * as Duels from './duels.js';\nimport * as Clues from './clues.js';\nimport * as Estate from './estate.js';\n"
        },
        {
          "at": 48000,
          "current": "    .header('cache-control', 'no-cache').send(uiCss));\n  // City scenes are optional local assets; gameplay remains authoritative through the API.\n  for (const [file, type] of [\n    ['noir-ui.css', 'text/css'], ['noir-landing.css', 'text/css'], ['noir-shell.js', 'application/javascript'],\n    ['strategy-command.css', 'text/css'], ['strategy-command.js', 'application/javascript'],\n    ['vendor/strategy-city-renderer.js', 'application/javascript'], ['vendor/strategy-city-renderer.js.LEGAL.txt', 'text/plain'],\n    ['vendor/strategy-city-renderer.LICENSE.txt', 'text/plain'],\n    ['site-analytics.js', 'application/javascript'],\n    ['city-scene.js', 'application/javascript'], ['city-scene.css', 'text/css'], ['city-world-layout.js', 'application/javascript'],\n    ['city-world-ui.js', 'application/javascript'], ['city-world-ui.css', 'text/css'],\n",
          "baseline": "    .header('cache-control', 'no-cache').send(uiCss));\n  // City scenes are optional local assets; gameplay remains authoritative through the API.\n  for (const [file, type] of [\n    ['site-analytics.js', 'application/javascript'],\n    ['city-scene.js', 'application/javascript'], ['city-scene.css', 'text/css'], ['city-world-layout.js', 'application/javascript'],\n    ['city-world-ui.js', 'application/javascript'], ['city-world-ui.css', 'text/css'],\n"
        },
        {
          "at": 49231,
          "current": "    ['ux-progression.js', 'application/javascript'], ['ux-progression.css', 'text/css'],\n    ['ux-social.js', 'application/javascript'], ['ux-social.css', 'text/css'],\n    ['ux-navigation.js', 'application/javascript'], ['ux-navigation.css', 'text/css'],\n    ...['feel', 'tools', 'identity', 'story', 'community', 'quests', 'clues', 'task-puzzles'].flatMap(name => [[`ux-${name}.js`, 'application/javascript'], [`ux-${name}.css`, 'text/css']]),\n    ['ux-quest-quality.js', 'application/javascript'], ['ux-quest-quality.css', 'text/css'],\n    ['ux-workspace.js', 'application/javascript'], ['ux-world.js', 'application/javascript'], ['ux-world.css', 'text/css'],\n    ['ux-tactics.js', 'application/javascript'], ['ux-tactics.css', 'text/css'],\n",
          "baseline": "    ['ux-progression.js', 'application/javascript'], ['ux-progression.css', 'text/css'],\n    ['ux-social.js', 'application/javascript'], ['ux-social.css', 'text/css'],\n    ['ux-navigation.js', 'application/javascript'], ['ux-navigation.css', 'text/css'],\n    ...['feel', 'tools', 'identity', 'story', 'community', 'quests', 'clues'].flatMap(name => [[`ux-${name}.js`, 'application/javascript'], [`ux-${name}.css`, 'text/css']]),\n    ['ux-quest-quality.js', 'application/javascript'], ['ux-quest-quality.css', 'text/css'],\n    ['ux-workspace.js', 'application/javascript'], ['ux-world.js', 'application/javascript'], ['ux-world.css', 'text/css'],\n    ['ux-tactics.js', 'application/javascript'], ['ux-tactics.css', 'text/css'],\n"
        },
        {
          "at": 112940,
          "current": "    return { ok: true };\n  });\n\n  const guestLogin = async (req) => {\n    if (req.body && typeof req.body === 'object' && !Array.isArray(req.body) &&\n        Object.prototype.hasOwnProperty.call(req.body, 'bootstrapSecret')) {\n      const { accountId, tokenVersion } = await A.accountForGuestBootstrap(\n        pool, req.body.bootstrapSecret, req.clientIp, req.body.inviteCode,\n        req.clientIpAuthority,\n      );\n      return { token: await signFor(accountId, {}, '30d', tokenVersion) };\n    }\n    const id = await A.createGuestAccount(pool, req.clientIp, req.body?.inviteCode, req.clientIpAuthority);\n    return { token: await signFor(id, {}, '30d', 0) };\n  };\n  app.post('/v1/auth/guest', guestLogin);\n  app.post('/v1/auth/agent', async (req) => {\n    const { accountId, tokenVersion } = await A.accountForAgentBootstrap(\n      pool, req.body?.bootstrapSecret, req.clientIp, req.body?.inviteCode, req.clientIpAuthority,\n    );\n",
          "baseline": "    return { ok: true };\n  });\n\n  app.post('/v1/age-check', async (req, reply) => {\n    reply.header('Cache-Control', 'no-store');\n    const eligible = ageStatus(app, req) === false ? false : eligibleBirthDate(req.body?.birthDate);\n    const cookie = app.jwt.sign({ purpose: 'age-check', minimumAge: MINIMUM_AGE, eligible }, { expiresIn: '15m' });\n    reply.header('Set-Cookie', ageCookie(cookie));\n    if (!eligible) return reply.code(403).send({ error: 'age_ineligible', message: 'Account creation is unavailable. See /privacy for help.' });\n    return { ok: true };\n  });\n  const guestLogin = async (req) => {\n    // Recovery authority does not override a known-ineligible browser or an\n    // explicitly supplied birth date. Existing eligible recovery needs no DOB.\n    if (ageStatus(app, req) === false || req.body?.birthDate !== undefined) requireAge(app, req);\n    if (req.body && typeof req.body === 'object' && !Array.isArray(req.body) &&\n        Object.prototype.hasOwnProperty.call(req.body, 'bootstrapSecret')) {\n      const { accountId, tokenVersion } = await A.accountForGuestBootstrap(\n        pool, req.body.bootstrapSecret, req.clientIp, req.body.inviteCode, () => requireAge(app, req),\n        req.clientIpAuthority,\n      );\n      return { token: await signFor(accountId, {}, '30d', tokenVersion) };\n    }\n    requireAge(app, req);\n    const id = await A.createGuestAccount(pool, req.clientIp, req.body?.inviteCode, req.clientIpAuthority);\n    return { token: await signFor(id, {}, '30d', 0) };\n  };\n  app.post('/v1/auth/guest', guestLogin);\n  app.post('/v1/auth/agent', async (req) => {\n    requireAge(app, req, { agent: true });\n    const { accountId, tokenVersion } = await A.accountForAgentBootstrap(\n      pool, req.body?.bootstrapSecret, req.clientIp, req.body?.inviteCode, req.clientIpAuthority,\n    );\n"
        },
        {
          "at": 115388,
          "current": "  app.post('/v1/auth/guest/bootstrap/ack', { preHandler: auth }, async (req) =>\n    A.acknowledgeGuestBootstrap(pool, req.user.sub));\n  const providerLogin = (verify) => async (req) => {\n    const identity = await verify(req.body?.token);\n    // (B2) the invite is consumed ATOMICALLY inside accountForIdentity's create txn — one invite per\n    // new account, gate held even under a concurrent same-identity race (no separate pre-consume).\n",
          "baseline": "  app.post('/v1/auth/guest/bootstrap/ack', { preHandler: auth }, async (req) =>\n    A.acknowledgeGuestBootstrap(pool, req.user.sub));\n  const providerLogin = (verify) => async (req) => {\n    requireAge(app, req);\n    const identity = await verify(req.body?.token);\n    // (B2) the invite is consumed ATOMICALLY inside accountForIdentity's create txn — one invite per\n    // new account, gate held even under a concurrent same-identity race (no separate pre-consume).\n"
        },
        {
          "at": 118607,
          "current": "      const revoked = req.user.tv !== undefined && Number(req.user.tv) !== Number(a?.token_version);\n      if (!a || a.status === 'banned' || revoked) accountId = null;\n    }\n    const { url, state } = await A.xOAuthStart(pool, { accountId, invite: req.body?.inviteCode });\n    // BROWSER-BIND the state (anti account-linking CSRF): the callback must present the same cookie,\n    // so an attacker who leaks their authorize URL can't have a victim's X identity bound to the\n",
          "baseline": "      const revoked = req.user.tv !== undefined && Number(req.user.tv) !== Number(a?.token_version);\n      if (!a || a.status === 'banned' || revoked) accountId = null;\n    }\n    if (!accountId) requireAge(app, req);\n    const { url, state } = await A.xOAuthStart(pool, { accountId, invite: req.body?.inviteCode });\n    // BROWSER-BIND the state (anti account-linking CSRF): the callback must present the same cookie,\n    // so an attacker who leaks their authorize URL can't have a victim's X identity bound to the\n"
        },
        {
          "at": 120216,
          "current": "        return reply.redirect('/#claimed=x');\n      }\n      // (B2) invite consumed atomically inside accountForIdentity's create txn — gate held under races\n      const { accountId } = await A.accountForIdentity(\n        pool, r.identity, req.clientIp, r.invite, req.clientIpAuthority,\n      );\n",
          "baseline": "        return reply.redirect('/#claimed=x');\n      }\n      // (B2) invite consumed atomically inside accountForIdentity's create txn — gate held under races\n      requireAge(app, req);\n      const { accountId } = await A.accountForIdentity(\n        pool, r.identity, req.clientIp, r.invite, req.clientIpAuthority,\n      );\n"
        },
        {
          "at": 130226,
          "current": "\n  // ── M1 actions (crimes/gym/doc/checkin/bank/travel) ──\n  app.post('/v1/crimes/:id', { preHandler: auth }, async (req) =>\n    G.withCharacter(pool, req.user.sub, (ch, client, h) => crimeWithDecisionContext(ch, req.params.id, client, h, req.body?.approach, req.body?.puzzle)));\n  app.post('/v1/task-puzzles', { preHandler: auth }, async req =>\n    G.withCharacter(pool, req.user.sub, (ch, client) => jobTaskPuzzle(ch, req.body, client, true)));\n  app.get('/v1/task-puzzles', { preHandler: auth }, async req => {\n    const { puzzle } = await G.readCharacter(pool, req.user.sub, (ch, client) => jobTaskPuzzle(ch, req.query, client));\n    return { puzzle };\n  });\n  app.post('/v1/train/:stat', { preHandler: auth }, async (req) =>\n    G.withCharacter(pool, req.user.sub, (ch, client, h) => G.train(ch, req.params.stat, client, h)));\n  // THE REGIMEN — the expanded gym: five disciplines on the SAME train_at clock + NPC trainer drills\n",
          "baseline": "\n  // ── M1 actions (crimes/gym/doc/checkin/bank/travel) ──\n  app.post('/v1/crimes/:id', { preHandler: auth }, async (req) =>\n    G.withCharacter(pool, req.user.sub, (ch, client, h) => crimeWithDecisionContext(ch, req.params.id, client, h, req.body?.approach)));\n  app.post('/v1/train/:stat', { preHandler: auth }, async (req) =>\n    G.withCharacter(pool, req.user.sub, (ch, client, h) => G.train(ch, req.params.stat, client, h)));\n  // THE REGIMEN — the expanded gym: five disciplines on the SAME train_at clock + NPC trainer drills\n"
        },
        {
          "at": 131780,
          "current": "  app.get('/v1/hustle', { preHandler: auth }, async (req) =>\n    G.readCharacter(pool, req.user.sub, (ch, client) => Hustle.hustleBoard(ch, client)));\n  app.post('/v1/hustle/advance', { preHandler: auth }, async (req) =>\n    G.withCharacter(pool, req.user.sub, (ch, client, h) => Hustle.advanceHustle(ch, client, h, req.body?.puzzle)));\n  // WORD ON THE STREET — each district's seed-drawn daily quest board (accept where you stand,\n  // do the work, claim the envelope; the counter DELTA proves it — the hustle rule)\n  app.get('/v1/corner', { preHandler: auth }, async (req) =>\n",
          "baseline": "  app.get('/v1/hustle', { preHandler: auth }, async (req) =>\n    G.readCharacter(pool, req.user.sub, (ch, client) => Hustle.hustleBoard(ch, client)));\n  app.post('/v1/hustle/advance', { preHandler: auth }, async (req) =>\n    G.withCharacter(pool, req.user.sub, (ch, client, h) => Hustle.advanceHustle(ch, client, h)));\n  // WORD ON THE STREET — each district's seed-drawn daily quest board (accept where you stand,\n  // do the work, claim the envelope; the counter DELTA proves it — the hustle rule)\n  app.get('/v1/corner', { preHandler: auth }, async (req) =>\n"
        },
        {
          "at": 146284,
          "current": "  app.get('/v1/rules', async (req, reply) => {\n    reply.header('cache-control', 'public, max-age=300, stale-while-revalidate=3600');\n    return jsonEtag(req, reply, {\n    crimes: CRIMES.map((c) => ({ id: c.id, name: c.name, lvl: c.lvl, nerve: c.nerve, cash: c.cash, base: c.base, jail: c.jail, puzzle: crimePuzzle(c.id) })),\n    respecOmr: M8.RESPEC_OMR, // stat respec cost — so The Life tab can price the tradeoff before you commit\n    respecStatMin: M8.RESPEC_STAT_MIN,\n    respecCdHours: Math.round(M8.RESPEC_CD_MS / 3600000), // ...and the CADENCE, which the card priced nowhere\n",
          "baseline": "  app.get('/v1/rules', async (req, reply) => {\n    reply.header('cache-control', 'public, max-age=300, stale-while-revalidate=3600');\n    return jsonEtag(req, reply, {\n    crimes: CRIMES.map((c) => ({ id: c.id, name: c.name, lvl: c.lvl, nerve: c.nerve, cash: c.cash, base: c.base, jail: c.jail })),\n    respecOmr: M8.RESPEC_OMR, // stat respec cost — so The Life tab can price the tradeoff before you commit\n    respecStatMin: M8.RESPEC_STAT_MIN,\n    respecCdHours: Math.round(M8.RESPEC_CD_MS / 3600000), // ...and the CADENCE, which the card priced nowhere\n"
        },
        {
          "at": 148755,
          "current": "    regimen: { disciplines: REGIMEN.DISCIPLINES, cap: REGIMEN.CAP,\n      drillXp: REGIMEN.DRILL_XP, trainers: REGIMEN.TRAINERS, energy: REGIMEN.ENERGY },\n    // THE HUSTLE — the daily three-stop chain's config (the live chain is GET /v1/hustle)\n    hustle: { payPerLvl: HUSTLE.PAY_PER_LVL, payMin: HUSTLE.PAY_MIN, puzzle: { required: true, scope: 'hustle', targetId: 'legwork', step: 1 } },\n    // WORD ON THE STREET — the district quest boards' config (the live board is GET /v1/corner)\n    corner: { perDay: CORNER.PER_DAY, maxDay: CORNER.MAX_DAY, cash: CORNER.CASH, respect: CORNER.RESPECT,\n      chainSteps: CORNER.CHAIN_STEPS, chainBonus: CORNER.CHAIN_BONUS, chainRespect: CORNER.CHAIN_RESPECT },\n",
          "baseline": "    regimen: { disciplines: REGIMEN.DISCIPLINES, cap: REGIMEN.CAP,\n      drillXp: REGIMEN.DRILL_XP, trainers: REGIMEN.TRAINERS, energy: REGIMEN.ENERGY },\n    // THE HUSTLE — the daily three-stop chain's config (the live chain is GET /v1/hustle)\n    hustle: { payPerLvl: HUSTLE.PAY_PER_LVL, payMin: HUSTLE.PAY_MIN },\n    // WORD ON THE STREET — the district quest boards' config (the live board is GET /v1/corner)\n    corner: { perDay: CORNER.PER_DAY, maxDay: CORNER.MAX_DAY, cash: CORNER.CASH, respect: CORNER.RESPECT,\n      chainSteps: CORNER.CHAIN_STEPS, chainBonus: CORNER.CHAIN_BONUS, chainRespect: CORNER.CHAIN_RESPECT },\n"
        },
        {
          "at": 160477,
          "current": "      // BUSINESS EMPIRE Tier-4 — the launderer legend + the front specializations + the takeover surface\n      launderer: BUSINESS_EMPIRE.LAUNDERER_RANKS, specs: BUSINESS_EMPIRE.SPECS, specOmr: BUSINESS_EMPIRE.SPEC_OMR,\n      takeover: { fee: BUSINESS_EMPIRE.TAKEOVER.FEE, minLevel: BUSINESS_EMPIRE.TAKEOVER.MIN_LEVEL } },\n    missions: MISSIONS.map((m) => ({ id: m.id, name: m.name, req: m.req, reward: m.reward, brief: m.brief, puzzle: missionPuzzle(m.id) })),\n    seals: { ladder: GANG_SEALS, colorOmr: VANITY.GANG_COLOR_OMR, renameOmr: VANITY.GANG_RENAME_OMR },\n    // the shop's own price list, so the console never restates a lever (the terms ride with the price)\n    vanity: { nameOmr: VANITY.NAME_CHANGE_OMR, titleOmr: VANITY.TITLE_OMR, plateOmr: VANITY.PLATE_OMR },\n",
          "baseline": "      // BUSINESS EMPIRE Tier-4 — the launderer legend + the front specializations + the takeover surface\n      launderer: BUSINESS_EMPIRE.LAUNDERER_RANKS, specs: BUSINESS_EMPIRE.SPECS, specOmr: BUSINESS_EMPIRE.SPEC_OMR,\n      takeover: { fee: BUSINESS_EMPIRE.TAKEOVER.FEE, minLevel: BUSINESS_EMPIRE.TAKEOVER.MIN_LEVEL } },\n    missions: MISSIONS.map((m) => ({ id: m.id, name: m.name, req: m.req, reward: m.reward, brief: m.brief })),\n    seals: { ladder: GANG_SEALS, colorOmr: VANITY.GANG_COLOR_OMR, renameOmr: VANITY.GANG_RENAME_OMR },\n    // the shop's own price list, so the console never restates a lever (the terms ride with the price)\n    vanity: { nameOmr: VANITY.NAME_CHANGE_OMR, titleOmr: VANITY.TITLE_OMR, plateOmr: VANITY.PLATE_OMR },\n"
        },
        {
          "at": 219624,
          "current": "  const performAgentAction = async (action, ch, client, h, lender = null, policy = null) => {\n    const tail = (prefix) => action.path.startsWith(prefix) ? action.path.slice(prefix.length) : null;\n    switch (action.kind) {\n      case 'crime': return G.doCrime(ch, tail('/v1/crimes/'), client, h, action.body?.approach, action.body?.puzzle);\n      case 'business_buy': return Business.buyBusiness(ch, tail('/v1/business/').replace(/\\/buy$/, ''), client, h);\n      case 'business_upkeep': return Business.payBusinessUpkeep(ch, client, h,\n        { maxCash: action.cost.cash, minimumReserve: policy.cashReserve });\n",
          "baseline": "  const performAgentAction = async (action, ch, client, h, lender = null, policy = null) => {\n    const tail = (prefix) => action.path.startsWith(prefix) ? action.path.slice(prefix.length) : null;\n    switch (action.kind) {\n      case 'crime': return G.doCrime(ch, tail('/v1/crimes/'), client, h, action.body?.approach);\n      case 'business_buy': return Business.buyBusiness(ch, tail('/v1/business/').replace(/\\/buy$/, ''), client, h);\n      case 'business_upkeep': return Business.payBusinessUpkeep(ch, client, h,\n        { maxCash: action.cost.cash, minimumReserve: policy.cashReserve });\n"
        },
        {
          "at": 275573,
          "current": "  app.post('/v1/heist', { preHandler: auth }, async (req) =>\n    G.withCharacter(pool, req.user.sub, (ch, client, h) => W.heist(ch, client, h)));\n  app.post('/v1/missions/:id', { preHandler: auth }, async (req) =>\n    G.withCharacter(pool, req.user.sub, (ch, client, h) => W.doMission(ch, req.params.id, client, h, req.body?.puzzle)));\n  app.get('/v1/daily', { preHandler: auth }, async (req) => {\n    const me = (await pool.query('SELECT id FROM characters WHERE account_id=$1 AND alive', [req.user.sub])).rows[0];\n    if (!me) throw new G.GameError('no_character', 'Create a character first.');\n",
          "baseline": "  app.post('/v1/heist', { preHandler: auth }, async (req) =>\n    G.withCharacter(pool, req.user.sub, (ch, client, h) => W.heist(ch, client, h)));\n  app.post('/v1/missions/:id', { preHandler: auth }, async (req) =>\n    G.withCharacter(pool, req.user.sub, (ch, client, h) => W.doMission(ch, req.params.id, client, h)));\n  app.get('/v1/daily', { preHandler: auth }, async (req) => {\n    const me = (await pool.query('SELECT id FROM characters WHERE account_id=$1 AND alive', [req.user.sub])).rows[0];\n    if (!me) throw new G.GameError('no_character', 'Create a character first.');\n"
        }
      ]
    },
    "src/ux-tactics.js": {
      "current": {
        "mode": "100644",
        "blob": "9e44659e39f2bacffaba47679053d6c12fbab64a",
        "sha256": "7eb343cc77c970c9e71032c2bc25be9a02e80abc481c87773a40be403568b393",
        "bytes": 19004
      },
      "baseline": {
        "mode": "100644",
        "blob": "84f8a92eff7c02e071041016c13b9c1ef2cd13bd",
        "sha256": "c92cfabb6f5786aa4e8656afbe9e3b51a8ce30ca67546ca2c71ffef7d9d44850",
        "bytes": 18980
      },
      "inverses": [
        {
          "at": 17947,
          "current": "  app.get('/v1/ux/tactics', { preHandler: auth }, req => readCharacter(pool, req.user.sub, (ch, client, h) => tacticsBoard(ch, client, h, req.query)));\n}\n\nexport async function crimeWithDecisionContext(ch, crimeId, client, h, approach, puzzle) {\n  const crime = CRIMES.find(entry => entry.id === crimeId);\n  // Preserve the original validation/error contract for unknown actions.\n  if (!crime) return doCrime(ch, crimeId, client, h, approach, puzzle);\n  const projection = quoteCrime(ch, h, crime, approach, await assignedSoldier(client, ch.id));\n  const projectedAt = new Date().toISOString();\n  const result = await doCrime(ch, crimeId, client, h, approach, puzzle);\n  return { ...result, decisionContext: { crimeId: crime.id, cost: { ...projection.cost },\n    probability: projection.probability, modifiers: projection.modifiers,\n    jailSecondsOnFailure: projection.jailSeconds, projectedAt, source: projection.formula.source,\n",
          "baseline": "  app.get('/v1/ux/tactics', { preHandler: auth }, req => readCharacter(pool, req.user.sub, (ch, client, h) => tacticsBoard(ch, client, h, req.query)));\n}\n\nexport async function crimeWithDecisionContext(ch, crimeId, client, h, approach) {\n  const crime = CRIMES.find(entry => entry.id === crimeId);\n  // Preserve the original validation/error contract for unknown actions.\n  if (!crime) return doCrime(ch, crimeId, client, h, approach);\n  const projection = quoteCrime(ch, h, crime, approach, await assignedSoldier(client, ch.id));\n  const projectedAt = new Date().toISOString();\n  const result = await doCrime(ch, crimeId, client, h, approach);\n  return { ...result, decisionContext: { crimeId: crime.id, cost: { ...projection.cost },\n    probability: projection.probability, modifiers: projection.modifiers,\n    jailSecondsOnFailure: projection.jailSeconds, projectedAt, source: projection.formula.source,\n"
        }
      ]
    },
    "test/age.js": {
      "current": {
        "mode": "100644",
        "blob": "3b84c560ccf3f4add4da4b4781c48cad9dd4f9dd",
        "sha256": "5cc55a24e2eff8166ec45643d2289079f688157301a8bc4c936aa098bbfe3c1e",
        "bytes": 4362
      },
      "baseline": {
        "mode": "100644",
        "blob": "940ebd966a457aabce419889892311761b4340b0",
        "sha256": "873861db9dd9a5635563450b4f9412472b3a169b8072707ff6f276634b6bf8c9",
        "bytes": 5005
      },
      "inverses": [
        {
          "at": 0,
          "current": "import assert from 'node:assert/strict';\nimport { buildServer } from '../src/server.js';\n\nif (process.env.DATABASE_URL) throw new Error('Account admission checks require a disposable database.');\nconst keys = ['PRIVY_APP_ID', 'X_CLIENT_ID', 'PUBLIC_URL', 'X_TRUST_USER_TOKEN'];\nconst previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));\nconst oldFetch = global.fetch;\nconst app = await buildServer();\ntry {\n  const count = async () => Number((await app.pool.query('SELECT count(*) AS n FROM accounts')).rows[0].n);\n  const call = (url, payload = {}, headers = {}) => app.inject({ method: 'POST', url, payload, headers });\n  const before = await count();\n  const guest = await call('/v1/auth/guest');\n  assert.equal(guest.statusCode, 200, guest.body);\n  assert.equal(guest.headers['set-cookie'], undefined, 'guest signup sets no age cookie');\n  assert.equal(await count(), before + 1, 'guest signup needs no birth date');\n\n  const deniedCookie = `omerta_age=${app.jwt.sign({ purpose: 'age-check', minimumAge: 21, eligible: false }, { expiresIn: '15m' })}`;\n  const headers = { cookie: deniedCookie };\n  const secret = Buffer.alloc(32, 7).toString('base64url');\n  const first = await call('/v1/auth/guest', { bootstrapSecret: secret }, headers);\n  assert.equal(first.statusCode, 200, 'a legacy denial cookie no longer blocks signup');\n  const recovered = await call('/v1/auth/guest', { bootstrapSecret: secret }, headers);\n  assert.equal(recovered.statusCode, 200, 'bootstrap recovery needs no age confirmation');\n  assert.equal(app.jwt.verify(first.json().token).sub, app.jwt.verify(recovered.json().token).sub);\n  const redeemed = await call('/v1/access/redeem', {\n    bootstrapSecret: Buffer.alloc(32, 8).toString('base64url'),\n  }, headers);\n  assert.equal(redeemed.statusCode, 200, redeemed.body);\n  assert(redeemed.headers['set-cookie'].startsWith('omerta_access='), 'browser admission still issues its access cookie');\n\n  process.env.PRIVY_APP_ID = 'admission-test-app';\n  const privy = await call('/v1/auth/privy', { token: 'malformed' }, headers);\n  assert.equal(privy.json().error, 'auth_failed', 'provider verification runs without age confirmation');\n\n  process.env.X_CLIENT_ID = 'admission-test-client';\n  process.env.PUBLIC_URL = 'https://omerta.example';\n  process.env.X_TRUST_USER_TOKEN = 'on';\n  global.fetch = async url => {\n    if (String(url) === 'https://api.x.com/2/oauth2/token')\n      return { ok: true, status: 200, json: async () => ({ access_token: 'test-provider-token' }) };\n    if (String(url) === 'https://api.x.com/2/users/me')\n      return { ok: true, status: 200, json: async () => ({ data: { id: 'admission-test-user' } }) };\n    throw new Error(`Unexpected provider request: ${url}`);\n  };\n  const provider = await call('/v1/auth/x', { token: 'test-provider-token' }, headers);\n  assert.equal(provider.statusCode, 200, provider.body);\n  const oauth = await call('/v1/auth/x/start', {}, headers);\n  assert.equal(oauth.statusCode, 200, oauth.body);\n  const state = new URL(oauth.json().url).searchParams.get('state');\n  const callback = await app.inject({\n    url: `/v1/auth/x/callback?code=test-code&state=${encodeURIComponent(state)}`,\n    headers: { cookie: `${deniedCookie}; ${oauth.headers['set-cookie'].split(';')[0]}` },\n  });\n  assert.equal(callback.statusCode, 302, callback.body);\n  assert(callback.headers.location.startsWith('/#token='), 'OAuth callback completes without age confirmation');\n  const oauthToken = decodeURIComponent(callback.headers.location.slice('/#token='.length));\n  assert.equal(app.jwt.verify(oauthToken).sub, app.jwt.verify(provider.json().token).sub);\n\n  assert.equal((await call('/v1/age-check', { birthDate: '1990-01-01' })).statusCode, 404, 'the age-check endpoint is removed');\n  const spec = (await app.inject('/openapi.json')).json();\n  assert.equal(spec.paths['/v1/age-check'], undefined);\n  assert.equal(spec.paths['/v1/access/redeem'].post.requestBody.content['application/json'].schema.properties.birthDate, undefined);\n  console.log('Account admission: guest signup, recovery, browser admission, provider login and OAuth work without age verification.');\n} finally {\n  global.fetch = oldFetch;\n  for (const [key, value] of Object.entries(previous)) {\n    if (value === undefined) delete process.env[key]; else process.env[key] = value;\n  }\n  await app.close();\n}\n",
          "baseline": "import assert from 'node:assert/strict';\nimport { MINIMUM_AGE, eligibleBirthDate } from '../src/age.js';\nimport { buildServer } from '../src/server.js';\n\nconst now = new Date('2026-10-31T12:00:00Z');\nassert.equal(MINIMUM_AGE, 21);\nassert.equal(eligibleBirthDate('2005-10-31', now), true);\nassert.equal(eligibleBirthDate('2005-11-01', now), false);\nassert.throws(() => eligibleBirthDate('2005-02-30', now));\nassert.equal(eligibleBirthDate('2006-01-01', now), false, 'a 20-year-old is ineligible');\nassert.equal(eligibleBirthDate('2007-03-01', new Date('2028-02-29T12:00:00Z')), false, 'leap day does not admit a birthday early');\nassert.equal(eligibleBirthDate('2004-02-29', new Date('2025-02-28T12:00:00Z')), false);\nassert.equal(eligibleBirthDate('2004-02-29', new Date('2025-03-01T12:00:00Z')), true);\nassert.throws(() => eligibleBirthDate('2027-01-01', now));\nconst app = await buildServer();\ntry {\n  const count = async () => Number((await app.pool.query('SELECT count(*) AS n FROM accounts')).rows[0].n);\n  const before = await count();\n  for (const birthDate of [undefined, '2020-01-01', '2007-01-01']) {\n    const response = await app.inject({ method: 'POST', url: '/v1/auth/guest', payload: birthDate ? { birthDate } : {} });\n    assert.ok(response.statusCode >= 400);\n  }\n  let fetched = false;\n  const oldFetch = global.fetch;\n  global.fetch = async () => { fetched = true; throw new Error('must not reach provider'); };\n  try {\n    const response = await app.inject({ method: 'POST', url: '/v1/auth/privy', payload: { token: 'hostile', birthDate: '2020-01-01' } });\n    assert.equal(response.json().error, 'age_ineligible');\n    assert.equal(fetched, false);\n  } finally { global.fetch = oldFetch; }\n  assert.equal(await count(), before, 'denied ages create no account or account IP');\n  const denied = await app.inject({ method: 'POST', url: '/v1/age-check', payload: { birthDate: '2020-01-01' } });\n  assert.equal(denied.statusCode, 403);\n  const blockedCookie = denied.headers['set-cookie'].split(';')[0];\n  const retry = await app.inject({ method: 'POST', url: '/v1/age-check', headers: { cookie: blockedCookie }, payload: { birthDate: '1990-01-01' } });\n  assert.equal(retry.statusCode, 403, 'denial cannot be corrected immediately using the same browser cookie');\n  const approved = await app.inject({ method: 'POST', url: '/v1/age-check', payload: { birthDate: '1990-01-01' } });\n  assert.equal(approved.statusCode, 200);\n  const token = approved.headers['set-cookie'].split(';')[0].slice('omerta_age='.length);\n  assert.equal(app.jwt.verify(token).purpose, 'age-check');\n  assert.equal(app.jwt.verify(token).minimumAge, 21);\n  for (const claim of [{ purpose: 'age-check', eligible: true }, { purpose: 'age-check', eligible: true, minimumAge: 13 }]) {\n    const old = app.jwt.sign(claim, { expiresIn: '15m' });\n    const denied = await app.inject({ method: 'POST', url: '/v1/auth/guest', headers: { cookie: 'omerta_age=' + old }, payload: {} });\n    assert.equal(denied.json().error, 'age_required', 'a proof from the earlier policy cannot authorize new signup');\n  }\n  assert.equal(JSON.stringify(app.jwt.verify(token)).includes('1990'), false);\n  const explicitChild = await app.inject({ method: 'POST', url: '/v1/auth/guest',\n    headers: { cookie: approved.headers['set-cookie'].split(';')[0] }, payload: { birthDate: '2020-01-01' } });\n  assert.equal(explicitChild.json().error, 'age_ineligible', 'earlier eligibility cannot override an explicit child birth date');\n  assert.equal(await count(), before);\n  const created = await app.inject({ method: 'POST', url: '/v1/auth/guest', headers: { cookie: approved.headers['set-cookie'].split(';')[0] }, payload: {} });\n  assert.equal(created.statusCode, 200, 'eligible cookie admits account creation');\n  const secret = Buffer.alloc(32, 7).toString('base64url');\n  const first = await app.inject({ method: 'POST', url: '/v1/auth/guest', payload: { bootstrapSecret: secret, birthDate: '1990-01-01' } });\n  assert.equal(first.statusCode, 200);\n  const recovered = await app.inject({ method: 'POST', url: '/v1/auth/guest', payload: { bootstrapSecret: secret } });\n  assert.equal(recovered.statusCode, 200, 'existing bootstrap recovery does not require birth date again');\n  assert.equal(app.jwt.verify(first.json().token).sub, app.jwt.verify(recovered.json().token).sub);\n  const blockedRecovery = await app.inject({ method: 'POST', url: '/v1/auth/guest',\n    headers: { cookie: blockedCookie }, payload: { bootstrapSecret: secret } });\n  assert.equal(blockedRecovery.json().error, 'age_ineligible', 'recovery does not bypass known-ineligible browser status');\n  const ageBearer = await app.inject({ url: '/v1/session', headers: { authorization: `Bearer ${token}` } });\n  assert.ok(ageBearer.statusCode >= 400, 'age eligibility token cannot authorize a player session');\n  console.log('Age gate: boundary, invalid dates, creation rejection, provider isolation, cookie denial and DOB minimization passed.');\n} finally { await app.close(); }\n"
        }
      ]
    },
    "test/agent-onboarding.js": {
      "current": {
        "mode": "100644",
        "blob": "50b91388461a04e4cae800c78e7af82b0bbb5599",
        "sha256": "d9de217c15dd1cb16c8151fd0552d198d78b521b84a500d00f6c10ae80a5a368",
        "bytes": 4063
      },
      "baseline": {
        "mode": "100644",
        "blob": "5a3974e0e4cfdab59a4e4de1b631cec4bf385775",
        "sha256": "2710afc43a0986f89d2e59bb0c0e0c62bdf7190a3fe8ecbbcd91135da1351398",
        "bytes": 5335
      },
      "inverses": [
        {
          "at": 455,
          "current": "const count = async () => Number((await app.pool.query('SELECT count(*) AS n FROM accounts')).rows[0].n);\ntry {\n  const before = await count();\n  for (const bootstrapSecret of [undefined, 'short', 'A'.repeat(42) + 'B']) {\n    const response = await call('/v1/auth/agent', { bootstrapSecret });\n    assert.equal(response.json().error, 'bootstrap_credential');\n",
          "baseline": "const count = async () => Number((await app.pool.query('SELECT count(*) AS n FROM accounts')).rows[0].n);\ntry {\n  const before = await count();\n  for (const url of ['/v1/auth/guest', '/v1/access/redeem', '/v1/auth/x', '/v1/auth/privy', '/v1/auth/x/start']) {\n    const response = await call(url, { bootstrapSecret: secret(), agent: true, token: 'not-a-provider-token' });\n    assert.equal(response.json().error, 'age_required', `${url} cannot opt out through an agent body flag`);\n  }\n  assert.equal(await count(), before);\n  for (const bootstrapSecret of [undefined, 'short', 'A'.repeat(42) + 'B']) {\n    const response = await call('/v1/auth/agent', { bootstrapSecret });\n    assert.equal(response.json().error, 'bootstrap_credential');\n"
        },
        {
          "at": 1991,
          "current": "  const rawAccount = (await app.pool.query('SELECT * FROM accounts WHERE id=$1', [accountId])).rows[0];\n  assert.equal(Object.keys({ ...rawAccount, ...persistent, ...claims[0] }).some(key => /birth|dob/i.test(key)), false);\n\n  await call('/v1/auth/guest/bootstrap/ack', {}, headers);\n  const retired = await call('/v1/auth/agent', { bootstrapSecret });\n  assert.equal(retired.json().error, 'bootstrap_retired', 'durably saved bearer retires bootstrap recovery');\n",
          "baseline": "  const rawAccount = (await app.pool.query('SELECT * FROM accounts WHERE id=$1', [accountId])).rows[0];\n  assert.equal(Object.keys({ ...rawAccount, ...persistent, ...claims[0] }).some(key => /birth|dob/i.test(key)), false);\n\n  const humanRoute = await call('/v1/auth/guest', { bootstrapSecret });\n  assert.equal(humanRoute.json().error, 'age_required', 'agent recovery proof does not admit a human account');\n  assert.equal(await count(), before + 1);\n  await call('/v1/auth/guest/bootstrap/ack', {}, headers);\n  const retired = await call('/v1/auth/agent', { bootstrapSecret });\n  assert.equal(retired.json().error, 'bootstrap_retired', 'durably saved bearer retires bootstrap recovery');\n"
        },
        {
          "at": 2896,
          "current": "  try {\n    process.env.SOCIAL_VERIFY_MODE = 'trust';\n    const social = await call('/v1/social/share/claim', {}, headers);\n    assert.equal(social.json().error, 'agent', 'the agent identity cannot claim human-only social cash');\n  } finally {\n    if (previousSocialMode === undefined) delete process.env.SOCIAL_VERIFY_MODE;\n    else process.env.SOCIAL_VERIFY_MODE = previousSocialMode;\n  }\n\n  const unackedSecret = secret();\n  const unacked = await call('/v1/auth/agent', { bootstrapSecret: unackedSecret });\n  const unackedHeaders = { authorization: `Bearer ${unacked.json().token}` };\n",
          "baseline": "  try {\n    process.env.SOCIAL_VERIFY_MODE = 'trust';\n    const social = await call('/v1/social/share/claim', {}, headers);\n    assert.equal(social.json().error, 'agent', 'the exempt identity cannot claim human-only social cash');\n  } finally {\n    if (previousSocialMode === undefined) delete process.env.SOCIAL_VERIFY_MODE;\n    else process.env.SOCIAL_VERIFY_MODE = previousSocialMode;\n  }\n\n  const denied = await call('/v1/age-check', { birthDate: '2020-01-01' });\n  const cookie = denied.headers['set-cookie'].split(';')[0];\n  const deniedCount = await count();\n  for (const payload of [{ bootstrapSecret: secret(), birthDate: '2020-01-01' }, { bootstrapSecret: secret(), birthDate: 'invalid' }]) {\n    assert.ok((await call('/v1/auth/agent', payload)).statusCode >= 400);\n  }\n  const blocked = await call('/v1/auth/agent', { bootstrapSecret: secret() }, { cookie });\n  assert.equal(blocked.json().error, 'age_ineligible', 'an agent declaration cannot override a known browser denial');\n  assert.equal(await count(), deniedCount);\n\n  const unackedSecret = secret();\n  const unacked = await call('/v1/auth/agent', { bootstrapSecret: unackedSecret });\n  const unackedHeaders = { authorization: `Bearer ${unacked.json().token}` };\n"
        },
        {
          "at": 3675,
          "current": "    'character creation closes unacknowledged recovery');\n  const spec = (await app.inject('/openapi.json')).json();\n  assert.deepEqual(spec.paths['/v1/auth/agent'].post.security, [], 'agent signup is advertised without bearer auth');\n  console.log('Agent onboarding: permanent classification, recovery, privacy and human-only reward isolation passed.');\n} finally { await app.close(); }\n",
          "baseline": "    'character creation closes unacknowledged recovery');\n  const spec = (await app.inject('/openapi.json')).json();\n  assert.deepEqual(spec.paths['/v1/auth/agent'].post.security, [], 'agent signup is advertised without bearer auth');\n  console.log('Agent-only age exemption: permanent classification, recovery, privacy, denial precedence and human-route isolation passed.');\n} finally { await app.close(); }\n"
        }
      ]
    },
    "test/auth-fixture.js": {
      "current": {
        "mode": "100644",
        "blob": "bd83d9da9d978388098e118e227b1a12f304ea5f",
        "sha256": "519c04238d24e230a18823235a27b3d57336125332359d78259d1cfdfb326cc7",
        "bytes": 149
      },
      "baseline": {
        "mode": "100644",
        "blob": "1d4dad44930dfcaea2ec5025bd46fae2bf111449",
        "sha256": "5563c246cc7e679a122d52624a1180523f668d6bb9d181585a8b34d89166b995",
        "bytes": 338
      },
      "inverses": [
        {
          "at": 0,
          "current": "// Preserve the shared auth-test request helper without adding personal data.\nexport function adultAuthFixture(method, url, body) {\n  return body;\n}\n",
          "baseline": "// Synthetic adult fixtures for unrelated auth tests; age.js tests the gate itself.\nexport function adultAuthFixture(method, url, body) {\n  if (method === 'POST' && ['/v1/auth/guest', '/v1/auth/x', '/v1/auth/privy', '/v1/auth/x/start', '/v1/access/redeem'].includes(url))\n    return { birthDate: '1990-01-01', ...body };\n  return body;\n}\n"
        }
      ]
    },
    "test/business-agent.js": {
      "current": {
        "mode": "100644",
        "blob": "ea63e8850c866de011f09fc034222c6600ebf353",
        "sha256": "556d82bd166727f8bb69dd6703ef2b64fe3d9c384b6669ee54863f7927ae0d8c",
        "bytes": 8901
      },
      "baseline": {
        "mode": "100644",
        "blob": "94ac6f516832bd9c94d8a9bf84daa187fb4f61ed",
        "sha256": "fa429d8b6452f40225d9c527c69f23f78748d960faa36df8671b2ea2235dfc9d",
        "bytes": 7925
      },
      "inverses": [
        {
          "at": 6541,
          "current": "  res.end(JSON.stringify(fixture));\n});\nawait new Promise(resolve => server.listen(0, '127.0.0.1', resolve));\nconst cli = (duty, flags = []) => new Promise((resolve, reject) => {\n  const child = spawn(process.execPath, ['tools/business-agent.js', '--base', `http://127.0.0.1:${server.address().port}`, '--duty', duty, ...flags],\n    { env: { ...process.env, OMERTA_BUSINESS_TOKEN: token }, stdio: ['ignore', 'pipe', 'pipe'] });\n  let stdout = '', stderr = '';\n  child.stdout.on('data', data => { stdout += data; });\n",
          "baseline": "  res.end(JSON.stringify(fixture));\n});\nawait new Promise(resolve => server.listen(0, '127.0.0.1', resolve));\nconst cli = duty => new Promise((resolve, reject) => {\n  const child = spawn(process.execPath, ['tools/business-agent.js', '--base', `http://127.0.0.1:${server.address().port}`, '--duty', duty],\n    { env: { ...process.env, OMERTA_BUSINESS_TOKEN: token }, stdio: ['ignore', 'pipe', 'pipe'] });\n  let stdout = '', stderr = '';\n  child.stdout.on('data', data => { stdout += data; });\n"
        },
        {
          "at": 7592,
          "current": "  assert.equal(invalid.stdout, '');\n  assert.equal(invalid.stderr.trim(), 'business_agent_error');\n  assert.equal(cliRequests, 1, 'invalid duty fails before any request');\n  const timed = await cli('sales', ['--work-seconds-per-job', '600', '--planning-horizon-seconds', '1200']);\n  assert.equal(timed.code, 0, timed.stderr);\n  const timedRecord = JSON.parse(timed.stdout);\n  assert.equal(timedRecord.financialRequests, 0);\n  assert.equal(timedRecord.samples[0].evaluation.policy.workSecondsPerJob, 600);\n  assert.equal(timedRecord.samples[0].evaluation.scheduling.planningHorizonSeconds, 1200);\n  assert(!timed.stdout.includes(token));\n  for (const flags of [['--work-seconds-per-job','59'], ['--work-seconds-per-job','3601'],\n    ['--planning-horizon-seconds','86401'], ['--planning-horizon-seconds','1.5'], ['--work-seconds-per-job']]) {\n    const invalidTime = await cli('sales', flags);\n    assert.equal(invalidTime.code, 1); assert.equal(invalidTime.stdout, '');\n    assert.equal(invalidTime.stderr.trim(), 'business_agent_error');\n  }\n  assert.equal(cliRequests, 2, 'invalid timing policy fails before any request');\n} finally { await new Promise(resolve => server.close(resolve)); }\nconsole.log('business-agent: finite read-only sampling, pacing, credential boundaries and bounded responses passed');\n",
          "baseline": "  assert.equal(invalid.stdout, '');\n  assert.equal(invalid.stderr.trim(), 'business_agent_error');\n  assert.equal(cliRequests, 1, 'invalid duty fails before any request');\n} finally { await new Promise(resolve => server.close(resolve)); }\nconsole.log('business-agent: finite read-only sampling, pacing, credential boundaries and bounded responses passed');\n"
        }
      ]
    },
    "test/businesspolicy.js": {
      "current": {
        "mode": "100644",
        "blob": "bc844a110b2fc788046de6a8d8948205e9e50539",
        "sha256": "395a8fbab924c80bccb1db2e19eaed4ca54eb4827fd9ea4a0230a680108445c8",
        "bytes": 28173
      },
      "baseline": {
        "mode": "100644",
        "blob": "1dce1c366e15c1e22060b3791a8bf24f15ea0a59",
        "sha256": "54d0885a02cf3a89aadcb277b64475c2207171b72c003c6b73433a71c880a089",
        "bytes": 19668
      },
      "inverses": [
        {
          "at": 2989,
          "current": "assert.equal(evaluateBusiness(one,policy).proposals.filter(p=>p.kind==='bid').length,1,'Quote reserves allocate across all proposals');\nconst day = snapshot();day.policy.maxPerDayUsdMicros=12000;\nassert.equal(evaluateBusiness(day,policy).capacity.proposedWorkSlots,1);\nconst priority = snapshot();priority.capacity.activeJobs=1;priority.jobs=[{id:'urgent',state:'claimed',expiresAt:'2026-10-09T12:05:01.000Z',settledRevenueUsdMicros:0,settledComputeCostsUsdMicros:12000}];\nconst prioritised=evaluateBusiness(priority,{...policy,maxProposals:1});\nassert.equal(prioritised.proposals[0].kind,'prioritize_delivery');assert.equal(prioritised.capacity.proposedWorkSlots,0,'Dropped proposals cannot occupy phantom slots');\nassert.deepEqual(evaluateBusiness(snapshot(),policy),evaluateBusiness(snapshot(),{...policy,duty:'general'}),'Default duty preserves general planning');\n",
          "baseline": "assert.equal(evaluateBusiness(one,policy).proposals.filter(p=>p.kind==='bid').length,1,'Quote reserves allocate across all proposals');\nconst day = snapshot();day.policy.maxPerDayUsdMicros=12000;\nassert.equal(evaluateBusiness(day,policy).capacity.proposedWorkSlots,1);\nconst priority = snapshot();priority.capacity.activeJobs=1;priority.jobs=[{id:'urgent',state:'claimed',expiresAt:'2026-10-09T12:05:00.000Z',settledRevenueUsdMicros:0,settledComputeCostsUsdMicros:12000}];\nconst prioritised=evaluateBusiness(priority,{...policy,maxProposals:1});\nassert.equal(prioritised.proposals[0].kind,'prioritize_delivery');assert.equal(prioritised.capacity.proposedWorkSlots,0,'Dropped proposals cannot occupy phantom slots');\nassert.deepEqual(evaluateBusiness(snapshot(),policy),evaluateBusiness(snapshot(),{...policy,duty:'general'}),'Default duty preserves general planning');\n"
        },
        {
          "at": 17834,
          "current": "assert.throws(()=>normalizeBusinessPolicy({operatingCostPerJobUsdMicros:1.5}));\nassert.throws(()=>normalizeBusinessPolicy({targetMarginBps:9000,paymentFeeBps:1000}));\nassert.equal(evaluateBusiness(snapshot(),{...policy,operatingCostPerJobUsdMicros:1000000000}).pricing.suggestedPriceUsdMicros,null,'Impossible prices are not proposed');\nconst defaults=normalizeBusinessPolicy();\nassert.equal(defaults.workSecondsPerJob,300);assert.equal(defaults.planningHorizonSeconds,3600);\nfor(const workSecondsPerJob of [59,3601,1.5,Infinity,null,'300',true])assert.throws(()=>normalizeBusinessPolicy({workSecondsPerJob}));\nfor(const planningHorizonSeconds of [59,86401,1.5,Infinity,null,'3600',true])assert.throws(()=>normalizeBusinessPolicy({planningHorizonSeconds}));\nfor(const seconds of [60,3600])assert.equal(normalizeBusinessPolicy({workSecondsPerJob:seconds}).workSecondsPerJob,seconds);\nfor(const seconds of [60,86400])assert.equal(normalizeBusinessPolicy({planningHorizonSeconds:seconds}).planningHorizonSeconds,seconds);\nfor(const jobs of [[],pending(2).jobs]){\n const s=snapshot();s.asOf='+275760-09-13T00:00:00.000Z';s.jobs=jobs;s.capacity.activeJobs=jobs.length;\n assert.throws(()=>evaluateBusiness(s,policy),/snapshot.*time range/,'Parseable dates must leave representable scheduling time');\n}\nconst timePlan=evaluateBusiness(snapshot(),{...policy,workSecondsPerJob:600,planningHorizonSeconds:1200});\nassert.equal(timePlan.capacity.proposedWorkSlots,2,'All proposals share the same time budget');\nassert.equal(timePlan.scheduling.proposedWorkSeconds,1200);\nassert.equal(timePlan.scheduling.remainingAfterProposalsSeconds,0);\nconst times=timePlan.proposals.filter(p=>p.kind==='bid');\nassert.equal(times[0].plannedStartAt,at);assert.equal(times[0].plannedFinishAt,times[1].plannedStartAt);\nassert(times.every(p=>p.estimatedWorkSeconds===600&&p.deliverySeconds===3600&&p.requiresOwnerApproval&&p.eligibleToExecute===false));\nconst commitments=pending(2);\ncommitments.jobs=[{id:'later',state:'claimed',expiresAt:'2026-10-09T13:00:00Z'},{id:'earlier',state:'open',expiresAt:'2026-10-09T12:20:01Z'}];\nconst workload=evaluateBusiness(commitments,{...policy,workSecondsPerJob:600,planningHorizonSeconds:1800});\nassert.deepEqual(workload.scheduling.commitments.map(j=>j.jobId),['earlier','later']);\nassert(workload.scheduling.commitments.every(j=>j.feasibleByDeadline));\nassert.equal(workload.scheduling.reservedWorkSeconds,1200);\nassert.equal(workload.capacity.proposedWorkSlots,1);\nassert.equal(workload.proposals.find(p=>p.kind==='bid').plannedStartAt,'2026-10-09T12:20:00.000Z');\nconst tied=pending(2);tied.jobs.reverse();\nassert.deepEqual(evaluateBusiness(tied,policy).scheduling.commitments.map(j=>j.jobId),['pending-0','pending-1'],'Equal deadlines use stable job IDs');\nfor(const expiresAt of [at,'invalid',null,'2026-10-09T12:05:00Z','2026-10-09T12:04:59Z']){\n const s=pending();s.jobs[0].expiresAt=expiresAt;\n const planned=evaluateBusiness(s,policy);\n assert(planned.riskFlags.includes('awarded_work_deadline_risk'));\n assert.equal(planned.capacity.proposedWorkSlots,0,'Invalid, expired and exact-finish deadlines hold bids');\n assert.equal(planned.scheduling.commitments.length,1,'Unsafe awarded work remains visible');\n assert.equal(planned.scheduling.commitments[0].feasibleByDeadline,false);\n assert.equal(planned.scheduling.reservedWorkSeconds,300,'Unsafe awarded work still reserves estimated time');\n}\nconst jointlyLate=pending(2);jointlyLate.jobs.forEach(job=>{job.expiresAt='2026-10-09T12:09:00Z';});\nconst jointlyLatePlan=evaluateBusiness(jointlyLate,policy);\nassert.deepEqual(jointlyLatePlan.scheduling.commitments.map(job=>job.feasibleByDeadline),[true,false]);\nassert.equal(jointlyLatePlan.capacity.proposedWorkSlots,0,'Individually feasible deadlines cannot share the same execution time');\nfor(const s of [missingActive,inconsistentActive]){\n const planned=evaluateBusiness(s,policy);\n assert(planned.scheduling.activeDetailsIncomplete);assert(planned.riskFlags.includes('active_work_details_incomplete'));\n assert.equal(planned.capacity.proposedWorkSlots,0);\n}\nfor(const state of ['submitted','disputed','accepted','refunded']){\n const s=pending();s.jobs[0].state=state;s.capacity.activeJobs=['submitted','disputed'].includes(state)?1:0;\n const planned=evaluateBusiness(s,policy);\n assert.equal(planned.scheduling.reservedWorkSeconds,0,'Submitted and terminal jobs do not execute twice');\n assert.equal(planned.capacity.proposedWorkSlots,3-s.capacity.activeJobs);\n}\nconst pendingTime=snapshot();pendingTime.commitments.pendingAwardBids=1;\nconst pendingTimePlan=evaluateBusiness(pendingTime,{...policy,workSecondsPerJob:600,planningHorizonSeconds:1200});\nassert.equal(pendingTimePlan.scheduling.pendingAwardWorkSeconds,600);\nassert.equal(pendingTimePlan.capacity.proposedWorkSlots,1,'Potential awards protect time as well as slots and funds');\nassert.equal(pendingTimePlan.proposals.find(p=>p.kind==='bid').plannedStartAt,'2026-10-09T12:10:00.000Z');\nconst bothTime=pending();bothTime.commitments.pendingAwardBids=1;\nconst bothTimePlan=evaluateBusiness(bothTime,{...policy,workSecondsPerJob:600,planningHorizonSeconds:1800});\nassert.equal(bothTimePlan.capacity.proposedWorkSlots,1);\nassert.equal(bothTimePlan.proposals.find(p=>p.kind==='bid').plannedStartAt,'2026-10-09T12:20:00.000Z');\nfor(const s of [missingCommitments,overflowingCommitments]){\n const planned=evaluateBusiness(s,policy);\n assert.equal(planned.scheduling.pendingAwardWorkSeconds,null);\n assert.equal(planned.scheduling.remainingWorkSeconds,null);\n assert.equal(planned.scheduling.remainingAfterProposalsSeconds,null,'Unknown time cannot imply unused capacity');\n assert.equal(planned.capacity.proposedWorkSlots,0);\n}\nassert(evaluateBusiness(overflowingCommitments,policy).riskFlags.includes('pending_bid_work_outside_exact_bounds'));\nconst noTime=evaluateBusiness(snapshot(),{...policy,workSecondsPerJob:600,planningHorizonSeconds:599});\nassert.equal(noTime.capacity.proposedWorkSlots,0);assert(noTime.riskFlags.includes('work_time_capacity_full'));\nconst beyondHorizon=evaluateBusiness(pending(2),{...policy,workSecondsPerJob:600,planningHorizonSeconds:600});\nassert.equal(beyondHorizon.scheduling.reservedWorkSeconds,1200);assert.equal(beyondHorizon.scheduling.remainingWorkSeconds,0);\nfor(const expiresAt of ['2026-10-09T12:04:59Z','2026-10-09T12:05:00Z']){\n const s=snapshot();s.policy.expiresAt=expiresAt;\n const planned=evaluateBusiness(s,policy);\n assert.equal(planned.capacity.proposedWorkSlots,0,'Work must finish strictly before current authority expires');\n assert(planned.riskFlags.includes('owner_authority_window_insufficient'));\n assert(!planned.riskFlags.includes('work_time_capacity_full'),'Authority expiry is distinct from the planning horizon');\n}\nconst exactAuthority=snapshot();exactAuthority.policy.expiresAt='2026-10-09T12:05:00.001Z';\nassert.equal(evaluateBusiness(exactAuthority,policy).capacity.proposedWorkSlots,1);\nconst longPlan=evaluateBusiness(snapshot(),{...policy,workSecondsPerJob:3600,planningHorizonSeconds:10800});\nassert.deepEqual(longPlan.proposals.filter(p=>p.kind==='bid').map(p=>p.deliverySeconds),[3601,7201,10801],\n 'A proposed delivery deadline must leave time to submit strictly before expiry');\nassert.equal(evaluateBusiness(priority,{...policy,maxProposals:1}).scheduling.proposedWorkSeconds,0,'A capped proposal reserves no phantom time');\nassert.equal(evaluateBusiness(priority,{...policy,duty:'fulfillment'}).scheduling.proposedWorkSeconds,0,'Out-of-duty bids reserve no phantom time');\nconst salesTime=evaluateBusiness(priority,{...policy,duty:'sales',maxProposals:1});\nassert.equal(salesTime.scheduling.proposedWorkSeconds,300);assert.equal(salesTime.scheduling.reservedWorkSeconds,300);\nassert.equal(JSON.stringify(original),encoded,'Scheduling never mutates the snapshot or owner authority');\nlet state=1947;const next=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state;};\nfor(let i=0;i<200;i++){\n const s=snapshot();s.catalog=[{...entry,inputUsdMicrosPerMillion:next()%100000000,outputUsdMicrosPerMillion:next()%100000000}];\n",
          "baseline": "assert.throws(()=>normalizeBusinessPolicy({operatingCostPerJobUsdMicros:1.5}));\nassert.throws(()=>normalizeBusinessPolicy({targetMarginBps:9000,paymentFeeBps:1000}));\nassert.equal(evaluateBusiness(snapshot(),{...policy,operatingCostPerJobUsdMicros:1000000000}).pricing.suggestedPriceUsdMicros,null,'Impossible prices are not proposed');\nlet state=1947;const next=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state;};\nfor(let i=0;i<200;i++){\n const s=snapshot();s.catalog=[{...entry,inputUsdMicrosPerMillion:next()%100000000,outputUsdMicrosPerMillion:next()%100000000}];\n"
        },
        {
          "at": 26601,
          "current": " const price=evaluated.pricing.suggestedPriceUsdMicros,cost=evaluated.pricing.planningComputeCostUsdMicros;\n if(price!==null){const roundedFee=(BigInt(price)*BigInt(fee)+99999999n)/100000000n*10000n;const profit=BigInt(price)-BigInt(cost)-BigInt(operating)-roundedFee;assert(profit*10000n>=BigInt(price)*BigInt(Math.min(margin,9000)));assert(profit>=10000n);assert.equal(price%10000,0);}\n}\nfor(let i=0;i<200;i++){\n const duration=60+next()%3541,horizon=60+next()%86341,s=pending(next()%3);\n s.commitments.pendingAwardBids=next()%(4-s.capacity.activeJobs);\n const planned=evaluateBusiness(s,{...policy,workSecondsPerJob:duration,planningHorizonSeconds:horizon});\n assert.equal(planned.scheduling.proposedWorkSeconds,planned.capacity.proposedWorkSlots*duration);\n const bids=planned.proposals.filter(p=>p.kind==='bid');\n let finish=Date.parse(at)+(planned.scheduling.reservedWorkSeconds+planned.scheduling.pendingAwardWorkSeconds)*1000;\n for(const bid of bids){\n  assert.equal(Date.parse(bid.plannedStartAt),finish);finish=Date.parse(bid.plannedFinishAt);\n  assert.equal(finish-Date.parse(bid.plannedStartAt),duration*1000);\n  assert(finish<=Date.parse(at)+horizon*1000);assert(finish<Date.parse(s.policy.expiresAt));\n  assert.equal(bid.eligibleToExecute,false);assert(bid.requiresOwnerApproval);\n }\n assert.equal(planned.scheduling.remainingAfterProposalsSeconds,Math.max(0,horizon-(finish-Date.parse(at))/1000));\n}\nconsole.log('businesspolicy PASS: shadow-only proposals, exact margins, protected commitments, deadlines and 400 pricing / 200 scheduling trials seed1947');\n",
          "baseline": " const price=evaluated.pricing.suggestedPriceUsdMicros,cost=evaluated.pricing.planningComputeCostUsdMicros;\n if(price!==null){const roundedFee=(BigInt(price)*BigInt(fee)+99999999n)/100000000n*10000n;const profit=BigInt(price)-BigInt(cost)-BigInt(operating)-roundedFee;assert(profit*10000n>=BigInt(price)*BigInt(Math.min(margin,9000)));assert(profit>=10000n);assert.equal(price%10000,0);}\n}\nconsole.log('businesspolicy PASS: shadow-only proposals, exact margins, shared capacity/funds/daily reserves, unknowns, retention, comparison and 400 pricing trials seed1947');\n"
        }
      ]
    },
    "test/client-shell-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "b4496fd201b21c5e99536ccdfd6b684faaf9e58d",
        "sha256": "b08ab98426a7e73b497849e0c89dd91fcb5ad28e0d6b850d3f01d5e35d582a85",
        "bytes": 20463
      },
      "baseline": {
        "mode": "100644",
        "blob": "aa7fa2e9d0db94ca279923e39166a781d22ce030",
        "sha256": "c2260db113b4c2b535cdea269153547e7a29653f6b8bfae5b6dac0eb31d9d6fe",
        "bytes": 20927
      },
      "inverses": [
        {
          "at": 7273,
          "current": "  assert.equal(analytics.filter(event => event.event === 'completion').length, 0, 'Failed loading creates no signup completion.');\n  await page.getByRole('button', { name: 'Try loading again', exact: true }).click();\n  assert.equal(await page.locator('#btn-guest').isDisabled(), true);\n  const signup = page.waitForRequest(request => request.url().endsWith('/site-analytics/event') && request.postDataJSON().target === 'signup_success');\n  resume();\n  await signup; await page.locator('#screen-create:not(.hidden)').waitFor();\n  assert.equal(await page.locator('#age-date').count(), 0, 'Guest entry proceeds without age verification.');\n  assert.equal(analytics.filter(event => event.target === 'guest_start').length, 1, 'A delayed physical activation is counted once after replay.');\n  assert.equal(analytics.filter(event => event.target === 'signup_success').length, 1);\n  assert.equal(analytics.filter(event => event.target === 'guest_start').length, 1);\n  assert.equal(await page.locator('#landing-language-controls').count(), 0, 'Core entry removes the temporary picker before mounting its own.');\n",
          "baseline": "  assert.equal(analytics.filter(event => event.event === 'completion').length, 0, 'Failed loading creates no signup completion.');\n  await page.getByRole('button', { name: 'Try loading again', exact: true }).click();\n  assert.equal(await page.locator('#btn-guest').isDisabled(), true);\n  resume();\n  await page.locator('#age-date').waitFor();\n  assert.equal(analytics.filter(event => event.target === 'guest_start').length, 1, 'A delayed physical activation is counted once after replay.');\n  await page.locator('#age-date').fill('1990-01-01');\n  const signup = page.waitForRequest(request => request.url().endsWith('/site-analytics/event') && request.postDataJSON().target === 'signup_success');\n  await page.locator('dialog[open] button[type=\"submit\"]').click();\n  await signup; await page.locator('#screen-create:not(.hidden)').waitFor();\n  assert.equal(analytics.filter(event => event.target === 'signup_success').length, 1);\n  assert.equal(analytics.filter(event => event.target === 'guest_start').length, 1);\n  assert.equal(await page.locator('#landing-language-controls').count(), 0, 'Core entry removes the temporary picker before mounting its own.');\n"
        },
        {
          "at": 13956,
          "current": "  rejected.on('request', request => { if (request.url().endsWith('/site-analytics/event')) rejectedCounts.push(request.postDataJSON()); });\n  await rejected.route('**/v1/auth/guest', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Retry this signup.' }) }));\n  await rejected.goto(base); await rejected.locator('#btn-guest').click();\n  await rejected.waitForFunction(() => document.querySelector('#guest-status').textContent === 'Retry this signup.' && !document.querySelector('#btn-guest').disabled);\n  assert.equal(rejectedCounts.filter(event => event.event === 'completion').length, 0, 'A confirmed failed signup records no successful completion.');\n  await rejected.close();\n",
          "baseline": "  rejected.on('request', request => { if (request.url().endsWith('/site-analytics/event')) rejectedCounts.push(request.postDataJSON()); });\n  await rejected.route('**/v1/auth/guest', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Retry this signup.' }) }));\n  await rejected.goto(base); await rejected.locator('#btn-guest').click();\n  await rejected.locator('#age-date').fill('1990-01-01'); await rejected.locator('dialog[open] button[type=\"submit\"]').click();\n  await rejected.waitForFunction(() => document.querySelector('#guest-status').textContent === 'Retry this signup.' && !document.querySelector('#btn-guest').disabled);\n  assert.equal(rejectedCounts.filter(event => event.event === 'completion').length, 0, 'A confirmed failed signup records no successful completion.');\n  await rejected.close();\n"
        },
        {
          "at": 15545,
          "current": "  const signIn = await browser.newPage({ reducedMotion: 'reduce' });\n  await signIn.route('**/v1/auth/x/start', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: base + '/?oauth-return=1#token=' + encodeURIComponent(guest.token) }) }));\n  await signIn.goto(base); await signIn.locator('#xoauth-row:not(.hidden)').waitFor();\n  await signIn.locator('#btn-xoauth').click(); await signIn.locator('#screen-main:not(.hidden)').waitFor();\n  assert.equal(new URL(signIn.url()).hash, '', 'Configured X entry retains the existing callback flow.'); await signIn.close();\n  delete process.env.X_CLIENT_ID;\n\n",
          "baseline": "  const signIn = await browser.newPage({ reducedMotion: 'reduce' });\n  await signIn.route('**/v1/auth/x/start', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: base + '/?oauth-return=1#token=' + encodeURIComponent(guest.token) }) }));\n  await signIn.goto(base); await signIn.locator('#xoauth-row:not(.hidden)').waitFor();\n  await signIn.locator('#btn-xoauth').click(); await signIn.locator('#age-date').fill('1990-01-01');\n  await signIn.locator('dialog[open] button[type=\"submit\"]').click(); await signIn.locator('#screen-main:not(.hidden)').waitFor();\n  assert.equal(new URL(signIn.url()).hash, '', 'Configured X entry retains the existing callback flow.'); await signIn.close();\n  delete process.env.X_CLIENT_ID;\n\n"
        },
        {
          "at": 16281,
          "current": "  await provider.route('**/v1/auth/privy', route => { providerToken = route.request().postDataJSON().token; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: guest.token }) }); });\n  await provider.goto(base); await provider.locator('#token-signin > summary').click();\n  await provider.locator('#auth-provider').selectOption('privy'); await provider.locator('#auth-token').fill('synthetic-provider-token');\n  await provider.locator('#btn-provider').click(); await provider.locator('#screen-main:not(.hidden)').waitFor();\n  assert.equal(providerToken, 'synthetic-provider-token', 'Deferred initialization preserves an explicitly entered provider token.'); await provider.close();\n\n  const wallet = await browser.newPage({ reducedMotion: 'reduce' });\n  await wallet.goto(base); await wallet.locator('#btn-wallet-onboard').click(); await wallet.locator('#screen-create:not(.hidden)').waitFor();\n  assert.equal(await wallet.evaluate(() => sessionStorage.getItem('omerta-wallet-onboarding')), '1');\n  await wallet.close();\n\n  const broken = await browser.newPage({ reducedMotion: 'reduce' });\n  broken.on('pageerror', () => {}); let brokenLoads = 0;\n",
          "baseline": "  await provider.route('**/v1/auth/privy', route => { providerToken = route.request().postDataJSON().token; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: guest.token }) }); });\n  await provider.goto(base); await provider.locator('#token-signin > summary').click();\n  await provider.locator('#auth-provider').selectOption('privy'); await provider.locator('#auth-token').fill('synthetic-provider-token');\n  await provider.locator('#btn-provider').click(); await provider.locator('#age-date').fill('1990-01-01');\n  await provider.locator('dialog[open] button[type=\"submit\"]').click(); await provider.locator('#screen-main:not(.hidden)').waitFor();\n  assert.equal(providerToken, 'synthetic-provider-token', 'Deferred initialization preserves an explicitly entered provider token.'); await provider.close();\n\n  const wallet = await browser.newPage({ reducedMotion: 'reduce' });\n  await wallet.goto(base); await wallet.locator('#btn-wallet-onboard').click(); await wallet.locator('#age-date').waitFor();\n  assert.equal(await wallet.evaluate(() => sessionStorage.getItem('omerta-wallet-onboarding')), '1');\n  await wallet.locator('#age-cancel').click(); await wallet.close();\n\n  const broken = await browser.newPage({ reducedMotion: 'reduce' });\n  broken.on('pageerror', () => {}); let brokenLoads = 0;\n"
        }
      ]
    },
    "test/client.js": {
      "current": {
        "mode": "100644",
        "blob": "cde6049be9a07ccca511687546808b08aded515f",
        "sha256": "52bbbba86aed3a9e759a588393273b62bd2c80252c18df7466be32a1b655cc64",
        "bytes": 764783
      },
      "baseline": {
        "mode": "100644",
        "blob": "7d2baa55480cf76964962be1c9c398388305bddf",
        "sha256": "9cb4f9873ad8a5c315df076d267a357768f1689edb163f93e67a279b68a2c841",
        "bytes": 764043
      },
      "inverses": [
        {
          "at": 33513,
          "current": "      catch (e) { assert.fail(`${path}: the <script> has a SYNTAX ERROR — the whole page is DEAD in a browser: ${e.message}`); }\n    }\n  }\n  for (const name of ['feedback','progression','social','navigation','workspace','world','tactics','investigation','coordination','feel','tools','identity','story','community','task-puzzles']) {\n    const path = 'public/ux-' + name + '.js';\n    new vm.Script(readFileSync(new URL('../' + path, import.meta.url), 'utf8'), { filename: path });\n  }\n",
          "baseline": "      catch (e) { assert.fail(`${path}: the <script> has a SYNTAX ERROR — the whole page is DEAD in a browser: ${e.message}`); }\n    }\n  }\n  for (const name of ['feedback','progression','social','navigation','workspace','world','tactics','investigation','coordination','feel','tools','identity','story','community']) {\n    const path = 'public/ux-' + name + '.js';\n    new vm.Script(readFileSync(new URL('../' + path, import.meta.url), 'utf8'), { filename: path });\n  }\n"
        },
        {
          "at": 38372,
          "current": "for (const m of admin.matchAll(/\\bj\\(\\s*'(GET|POST|PUT|DELETE)'\\s*,\\s*/g)) addCall(admin, m, '/admin');\n\n// UX dynamic choices have dedicated API/browser proofs; retain their finite mounted contracts.\nfor (const method of ['GET', 'POST']) addRef(method, '/v1/task-puzzles', 'Task puzzle protocol; real page/API/browser proofs');\nfor (const [method,path] of [[\"GET\",\"/v1/ux/workspace\"],[\"PUT\",\"/v1/ux/workspace\"],[\"GET\",\"/v1/ux/tactics\"],[\"GET\",\"/v1/ux/crew-workspace\"],[\"POST\",\"/v1/ux/crew-workspace\"],[\"GET\",\"/v1/ux/investigations\"],[\"GET\",\"/v1/ux/investigations/:p\"],[\"GET\",\"/v1/ux/investigations/:p/nodes/:p/hints/:p\"],[\"GET\",\"/v1/ux/investigation-items\"],[\"GET\",\"/v1/ux/story\"],[\"GET\",\"/v1/ux/story/:p\"],[\"GET\",\"/v1/ux/community\"],[\"POST\",\"/v1/ux/community\"],[\"GET\",\"/v1/ux/community/operations/:p/playback\"],[\"GET\",\"/v1/ux/community/portraits/:p\"],[\"GET\",\"/v1/ux/mentor-subjects\"],[\"POST\",\"/v1/ux/mentor-subjects\"]]) addRef(method,path,'UX route contract');\n\nassert.equal(unreadable, 0, `${unreadable} api()/act() call site(s) name their path in a way this ` +\n",
          "baseline": "for (const m of admin.matchAll(/\\bj\\(\\s*'(GET|POST|PUT|DELETE)'\\s*,\\s*/g)) addCall(admin, m, '/admin');\n\n// UX dynamic choices have dedicated API/browser proofs; retain their finite mounted contracts.\nfor (const [method,path] of [[\"GET\",\"/v1/ux/workspace\"],[\"PUT\",\"/v1/ux/workspace\"],[\"GET\",\"/v1/ux/tactics\"],[\"GET\",\"/v1/ux/crew-workspace\"],[\"POST\",\"/v1/ux/crew-workspace\"],[\"GET\",\"/v1/ux/investigations\"],[\"GET\",\"/v1/ux/investigations/:p\"],[\"GET\",\"/v1/ux/investigations/:p/nodes/:p/hints/:p\"],[\"GET\",\"/v1/ux/investigation-items\"],[\"GET\",\"/v1/ux/story\"],[\"GET\",\"/v1/ux/story/:p\"],[\"GET\",\"/v1/ux/community\"],[\"POST\",\"/v1/ux/community\"],[\"GET\",\"/v1/ux/community/operations/:p/playback\"],[\"GET\",\"/v1/ux/community/portraits/:p\"],[\"GET\",\"/v1/ux/mentor-subjects\"],[\"POST\",\"/v1/ux/mentor-subjects\"]]) addRef(method,path,'UX route contract');\n\nassert.equal(unreadable, 0, `${unreadable} api()/act() call site(s) name their path in a way this ` +\n"
        },
        {
          "at": 44494,
          "current": "    `a catalog resolved to ${[...set].slice(0, 4).join(',')} — the id extraction is wrong, not the client`);\n  return set;\n};\nconst taskPuzzleRules = (await app.inject({ method: 'GET', url: '/v1/rules' })).json();\nconst taskPuzzleSelectors = [...taskPuzzleRules.missions.map(m => m.puzzle), ...taskPuzzleRules.crimes.map(c => c.puzzle), taskPuzzleRules.hustle.puzzle].filter(Boolean);\nassert.equal(new Set(taskPuzzleSelectors.map(p => p.scope)).size, 3, 'All task puzzle scopes are published in the actual rules.');\nconst CATALOGS = {\n  scope: new Set(taskPuzzleSelectors.map(p => p.scope)),\n  targetId: new Set(taskPuzzleSelectors.map(p => p.targetId)), // union for the three scopes; exact binding is verified by task-puzzle jobs/API tests\n  approach: ids(M3.CRIME_APPROACHES),          // the crime verb\n  intent: ids(M3.JUMP_INTENTS),                // the jump verb\n  play: ids(M4.DEAL_PLAYS),                    // the corner verb\n",
          "baseline": "    `a catalog resolved to ${[...set].slice(0, 4).join(',')} — the id extraction is wrong, not the client`);\n  return set;\n};\nconst CATALOGS = {\n  approach: ids(M3.CRIME_APPROACHES),          // the crime verb\n  intent: ids(M3.JUMP_INTENTS),                // the jump verb\n  play: ids(M4.DEAL_PLAYS),                    // the corner verb\n"
        }
      ]
    },
    "test/customerlayaway-integration.js": {
      "current": {
        "mode": "100644",
        "blob": "3adebc91ec245f02d9cb1defa4db206716646fbe",
        "sha256": "ab04a832f7cc8ab83a8e1dec533d1f3ef655f4df26d679eb030e33f86f490203",
        "bytes": 7125
      },
      "baseline": {
        "mode": "100644",
        "blob": "8b27939c13d0b56d82b5b65becf1ed186719ba9e",
        "sha256": "5bb691447d2b5e13b8fe94490bc3b0d30fe87ab5dcaa51f5da2abf30811d8175",
        "bytes": 7368
      },
      "inverses": [
        {
          "at": 95,
          "current": "import {runEstate} from '../src/social/estate.js';\nimport {runLedgerInvariants} from '../src/invariants.js';\nimport {canonicalDatabaseSnapshot} from '../tools/rc1-native-proof.js';\nconst f=await fixture(true),{app,pool,tx,I,L,G,native,tool,terms,ref,pay,invoke,state}=f;\nconst tokens=Object.fromEntries(['seller','buyer','other','third','fourth','fifth'].map(a=>[a,app.jwt.sign({sub:a,tv:0,agent:true})]));let serial=0;\nconst call=(a,url,body,key='shared-'+(++serial))=>app.inject({method:'POST',url,payload:body,headers:{authorization:'Bearer '+tokens[a],'idempotency-key':key}});\n",
          "baseline": "import {runEstate} from '../src/social/estate.js';\nimport {runLedgerInvariants} from '../src/invariants.js';\nimport {canonicalDatabaseSnapshot} from '../tools/rc1-native-proof.js';\nimport {adultAuthFixture} from './auth-fixture.js';\nconst f=await fixture(true),{app,pool,tx,I,L,G,native,tool,terms,ref,pay,invoke,state}=f;\nconst tokens=Object.fromEntries(['seller','buyer','other','third','fourth','fifth'].map(a=>[a,app.jwt.sign({sub:a,tv:0,agent:true})]));let serial=0;\nconst call=(a,url,body,key='shared-'+(++serial))=>app.inject({method:'POST',url,payload:body,headers:{authorization:'Bearer '+tokens[a],'idempotency-key':key}});\n"
        },
        {
          "at": 788,
          "current": "const offer=async(a='seller',b='buyer')=>invoke('offerCustomerLayaway',a,{...terms(await tool(a),b),lifetimeSeconds:600},'shared-offer-'+(++serial));\nconst books=async()=>{assert.deepEqual(await L.collectCustomerLayawayIssues(pool),[]);const r=await runLedgerInvariants(pool,{alert:false});assert.deepEqual(r.checks.filter(x=>!x.ok),[]);};\ntry{\n const guest=await app.inject({method:'POST',url:'/v1/auth/guest',payload:{}});assert.equal(guest.statusCode,200,guest.body);assert(guest.json().token);console.log('actual guest admission without a birth date PASS');\n if(native){const quote=await offer('fourth','fifth');let signal,resume,paused=false,entered=false,committed;const observed=new Promise(r=>signal=r),release=new Promise(r=>resume=r);\n const instrumented=new Proxy(pool,{get(t,k){if(k==='connect')return async()=>{const c=await t.connect();return new Proxy(c,{get(target,key){if(key==='query')return async(...args)=>{const result=await target.query(...args);if(!paused&&args[0]===\"SELECT seller_character,buyer_character FROM customer_layaways WHERE status='active' AND (seller_character=$1 OR buyer_character=$1) ORDER BY id LIMIT 5\"&&args[1]?.[0]==='fifth-actor'){paused=true;signal();await release;}return result;};const v=target[key];return typeof v==='function'?v.bind(target):v;}});};const v=t[k];return typeof v==='function'?v.bind(t):v;}});\n const pending=G.withTwoCharacters(instrumented,'other','fifth-actor',async()=>{entered=true;},{meet:false}),rejected=assert.rejects(pending,e=>e.code==='contention'&&/counterpart/i.test(e.message));await Promise.race([observed,new Promise((_,reject)=>setTimeout(()=>reject(Error('layaway preactor discovery not observed')),5000))]);try{await ok('fifth','/v1/customer/layaway/pay',pay(quote,1),'new-counterpart-pay');committed=await state();}finally{resume();}await rejected;assert(!entered);assert.deepEqual(await state(),committed);await ok('fifth','/v1/customer/layaway/cancel',ref(quote));console.log('native first installment introduces real new counterpart: complete preactor union recheck refuses before gameplay, unchanged committed source/cash/custody PASS');}\n",
          "baseline": "const offer=async(a='seller',b='buyer')=>invoke('offerCustomerLayaway',a,{...terms(await tool(a),b),lifetimeSeconds:600},'shared-offer-'+(++serial));\nconst books=async()=>{assert.deepEqual(await L.collectCustomerLayawayIssues(pool),[]);const r=await runLedgerInvariants(pool,{alert:false});assert.deepEqual(r.checks.filter(x=>!x.ok),[]);};\ntry{\n let r=await app.inject({method:'POST',url:'/v1/auth/guest',payload:{}});assert.equal(r.statusCode,400,r.body);assert.equal(r.json().error,'age_required');r=await app.inject({method:'POST',url:'/v1/auth/guest',payload:adultAuthFixture('POST','/v1/auth/guest',{})});assert.equal(r.statusCode,200,r.body);assert(r.json().token);console.log('actual adult fixture guest admission and missing-age refusal PASS');\n if(native){const quote=await offer('fourth','fifth');let signal,resume,paused=false,entered=false,committed;const observed=new Promise(r=>signal=r),release=new Promise(r=>resume=r);\n const instrumented=new Proxy(pool,{get(t,k){if(k==='connect')return async()=>{const c=await t.connect();return new Proxy(c,{get(target,key){if(key==='query')return async(...args)=>{const result=await target.query(...args);if(!paused&&args[0]===\"SELECT seller_character,buyer_character FROM customer_layaways WHERE status='active' AND (seller_character=$1 OR buyer_character=$1) ORDER BY id LIMIT 5\"&&args[1]?.[0]==='fifth-actor'){paused=true;signal();await release;}return result;};const v=target[key];return typeof v==='function'?v.bind(target):v;}});};const v=t[k];return typeof v==='function'?v.bind(t):v;}});\n const pending=G.withTwoCharacters(instrumented,'other','fifth-actor',async()=>{entered=true;},{meet:false}),rejected=assert.rejects(pending,e=>e.code==='contention'&&/counterpart/i.test(e.message));await Promise.race([observed,new Promise((_,reject)=>setTimeout(()=>reject(Error('layaway preactor discovery not observed')),5000))]);try{await ok('fifth','/v1/customer/layaway/pay',pay(quote,1),'new-counterpart-pay');committed=await state();}finally{resume();}await rejected;assert(!entered);assert.deepEqual(await state(),committed);await ok('fifth','/v1/customer/layaway/cancel',ref(quote));console.log('native first installment introduces real new counterpart: complete preactor union recheck refuses before gameplay, unchanged committed source/cash/custody PASS');}\n"
        }
      ]
    },
    "test/daily-lineage.js": {
      "current": {
        "mode": "100644",
        "blob": "b43317a6c99d81253599450bcd41e6c887b03a54",
        "sha256": "91632aed1916143da41da04a4ee1c7ffe38104a38eab19da63ea92ad4c0d5298",
        "bytes": 31524
      },
      "baseline": {
        "mode": "100644",
        "blob": "7372720d43e14dd0315ac6148d7e95d62881eea1",
        "sha256": "f67c6ac5b90eb2fbd25e52f3b3710fef05cd707a8e3006e78966186241dae764",
        "bytes": 31260
      },
      "inverses": [
        {
          "at": 0,
          "current": "// Character death must not reset same-day cash/token reward ceilings. Work progress may die with the\n// street, but the account's right to be paid for Daily Contracts, Corner jobs, and the Hustle does not.\nimport assert from 'node:assert/strict';\nimport { solveTaskPuzzle } from './lib/task-puzzle-solver.js';\n\n// Default to pg-mem, but allow an explicit disposable loopback PostgreSQL run for the\n// concurrency/death replay proof. Never inherit DATABASE_URL implicitly from a developer shell.\n",
          "baseline": "// Character death must not reset same-day cash/token reward ceilings. Work progress may die with the\n// street, but the account's right to be paid for Daily Contracts, Corner jobs, and the Hustle does not.\nimport assert from 'node:assert/strict';\n\n// Default to pg-mem, but allow an explicit disposable loopback PostgreSQL run for the\n// concurrency/death replay proof. Never inherit DATABASE_URL implicitly from a developer shell.\n"
        },
        {
          "at": 21168,
          "current": "  counters[hustle.leg.kind] = Number(counters[hustle.leg.kind] || 0) + 1;\n  await setCounters(player.id, counters);\n  await pool.query('UPDATE characters SET loc=$2 WHERE id=$1', [player.id, hustle.stops[1]]);\n  const legworkPuzzle = (await call('POST', '/v1/task-puzzles', { token: player.token, body: { scope: 'hustle', targetId: 'legwork' } })).body.puzzle;\n  assert.equal((await call('POST', '/v1/hustle/advance', { token: player.token, body: { puzzle: solveTaskPuzzle(legworkPuzzle) } })).code, 200);\n  await pool.query('UPDATE characters SET loc=$2 WHERE id=$1', [player.id, hustle.stops[2]]);\n  const hustlePaid = await call('POST', '/v1/hustle/advance', { token: player.token });\n  assert.equal(hustlePaid.code, 200, JSON.stringify(hustlePaid.body));\n",
          "baseline": "  counters[hustle.leg.kind] = Number(counters[hustle.leg.kind] || 0) + 1;\n  await setCounters(player.id, counters);\n  await pool.query('UPDATE characters SET loc=$2 WHERE id=$1', [player.id, hustle.stops[1]]);\n  assert.equal((await call('POST', '/v1/hustle/advance', { token: player.token })).code, 200);\n  await pool.query('UPDATE characters SET loc=$2 WHERE id=$1', [player.id, hustle.stops[2]]);\n  const hustlePaid = await call('POST', '/v1/hustle/advance', { token: player.token });\n  assert.equal(hustlePaid.code, 200, JSON.stringify(hustlePaid.body));\n"
        }
      ]
    },
    "test/gates.js": {
      "current": {
        "mode": "100644",
        "blob": "74e58c116322180cccd2c00c85341b366258fcb5",
        "sha256": "c18166f32b5b03d431e33d6e2ea441f87e40f28268e44b4e4e1dff6a716ded2a",
        "bytes": 501995
      },
      "baseline": {
        "mode": "100644",
        "blob": "5c30eba9758ab52b94b86813346afa19a2c7cbbc",
        "sha256": "418c13af33c3f7e40cbe74a198f89f8ba3b3f0416412792f77bc4922d3e9b352",
        "bytes": 501050
      },
      "inverses": [
        {
          "at": 155379,
          "current": "    'combat.js:intent':     'published on /v1/rules; compared, never rendered (the approach precedent)',\n    'rules.tail.js:rarity': 'a catalog helper return — its callers attach the display name',\n    'graph.js:kind': 'bounded declarative prerequisite discriminator from the Coordination compiler; server predicates branch on it, and player projection labels are separately authored',\n    'task-puzzles.js:kind': 'closed patrol/route/matching/evidence protocol discriminator in completion feedback; the issued puzzle supplies its readable title and the acknowledgement supplies a human message, never raw-kind prose',\n    'companyspecialization.js:kind': 'closed volume/quality/speed/niche production-profile discriminator, validated against COMPANY_SPECIALIZATION and a native CHECK; a machine admission setting, never a narrative catalog rung',\n    'operations.js:subjectKey': 'server-private Family prerequisite plan key for a declared role; never rendered as a role display name',\n    // ── the `.kind` half. The rule was widened from `X.id` to `X.id|X.kind` after the business\n",
          "baseline": "    'combat.js:intent':     'published on /v1/rules; compared, never rendered (the approach precedent)',\n    'rules.tail.js:rarity': 'a catalog helper return — its callers attach the display name',\n    'graph.js:kind': 'bounded declarative prerequisite discriminator from the Coordination compiler; server predicates branch on it, and player projection labels are separately authored',\n    'companyspecialization.js:kind': 'closed volume/quality/speed/niche production-profile discriminator, validated against COMPANY_SPECIALIZATION and a native CHECK; a machine admission setting, never a narrative catalog rung',\n    'operations.js:subjectKey': 'server-private Family prerequisite plan key for a declared role; never rendered as a role display name',\n    // ── the `.kind` half. The rule was widened from `X.id` to `X.id|X.kind` after the business\n"
        },
        {
          "at": 338873,
          "current": "    'test/economicintelligence-fixture.js': 'Import-only actual authenticated GIN/forecast fixture; economic intelligence and default autonomy DTO memory/native proofs execute its exported factory.',\n    'test/fundedexternalwork-fixture.js': 'Import-only actual F11 gameplay and explicitly simulated external-work fixture; required memory/native lifecycle suite executes it, public finance remains unavailable.',\n    'test/managementteams-fixture.js': 'Import-only actual original-party governance/management fixture; required memory/native team suite executes it, no standalone runner.',\n    'test/auth-fixture.js': 'Import-only shared auth request helper used by gameplay suites; it exports no standalone assertions.',\n    'test/server-fixture.js': 'Import-only wrapper around the real server for gameplay suites; it exports no standalone assertions.',\n    'test/economy-composition-restart.js': 'Fresh-process child probe executed by the required native economy-composition suite; it requires an owned disposable PostgreSQL schema and bounded synthetic stdin, so it cannot run standalone.',\n    'test/commercialnegotiation-fixture.js': 'Import-only real authenticated gameplay fixture executed by negotiation and equipment-contract memory/native suites; exports no standalone test runner.',\n    'test/equipmentinsurance-fixture.js': 'Import-only real physical wear and canonical repair fixture executed by insurance memory/native suites; no standalone runner.',\n",
          "baseline": "    'test/economicintelligence-fixture.js': 'Import-only actual authenticated GIN/forecast fixture; economic intelligence and default autonomy DTO memory/native proofs execute its exported factory.',\n    'test/fundedexternalwork-fixture.js': 'Import-only actual F11 gameplay and explicitly simulated external-work fixture; required memory/native lifecycle suite executes it, public finance remains unavailable.',\n    'test/managementteams-fixture.js': 'Import-only actual original-party governance/management fixture; required memory/native team suite executes it, no standalone runner.',\n    'test/auth-fixture.js': 'Import-only synthetic-adult request fixture used by gameplay suites; the independent age suite exercises missing and ineligible birth dates against the real server.',\n    'test/server-fixture.js': 'Import-only wrapper around the real server for unrelated gameplay suites; it supplies synthetic-adult auth bodies and exports no standalone assertions.',\n    'test/economy-composition-restart.js': 'Fresh-process child probe executed by the required native economy-composition suite; it requires an owned disposable PostgreSQL schema and bounded synthetic stdin, so it cannot run standalone.',\n    'test/commercialnegotiation-fixture.js': 'Import-only real authenticated gameplay fixture executed by negotiation and equipment-contract memory/native suites; exports no standalone test runner.',\n    'test/equipmentinsurance-fixture.js': 'Import-only real physical wear and canonical repair fixture executed by insurance memory/native suites; no standalone runner.',\n"
        },
        {
          "at": 355863,
          "current": "  const nativeShape = block => block.replaceAll('\\r\\n', '\\n').split('\\n')\n    .filter(line => line.trim() && !/^\\s*#/.test(line)).map(line => line.trimEnd()).join('\\n');\n  const expectedQuestBrowser = \"  questing_browser:\\n    name: Quest acceptance and browser playthroughs\\n    runs-on: ubuntu-latest\\n    timeout-minutes: 15\\n    steps:\\n      - uses: actions/checkout@v7\\n        with:\\n          fetch-depth: 0\\n      - uses: actions/setup-node@v7\\n        with:\\n          node-version: '22'\\n          cache: npm\\n      - run: npm ci\\n      - run: npx playwright-core install --with-deps chromium\\n      - name: Quest source and current native admission guards\\n        run: |\\n          node test/questing-source-transfer.js\\n          node test/enterprise-native-questing-guard.js\\n          node test/questing-enterprise-catalog-guard.js\\n          node test/questing-ux-release-phase2-native-catalog-guard.js\\n          node test/rc1-npc-retirement-journal.js\\n          node test/genesis-fee-readiness-source-transfer.js\\n      - name: Quest runtime, cases and community workshop\\n        run: npm run test:questing\\n      - name: Production quest and clue interfaces\\n        run: |\\n          export CHROMIUM_PATH=\\\"$(node --input-type=module -e 'import { chromium } from \\\"playwright-core\\\"; process.stdout.write(chromium.executablePath());')\\\"\\n          npm run test:questing:browser\\n      - run: npm run questing:check\";\n  const expectedQuestNative = \"  questing_native:\\n    name: Quest authority and concurrency (PostgreSQL)\\n    runs-on: ubuntu-latest\\n    timeout-minutes: 30\\n    services:\\n      postgres:\\n        image: postgres:18.4\\n        env:\\n          POSTGRES_PASSWORD: pgcheck\\n          POSTGRES_DB: omerta_questing_ci\\n        ports:\\n          - 5432:5432\\n        options: >-\\n          --health-cmd \\\"pg_isready -U postgres\\\"\\n          --health-interval 5s\\n          --health-timeout 5s\\n          --health-retries 12\\n    steps:\\n      - uses: actions/checkout@v7\\n        with:\\n          fetch-depth: 0\\n      - uses: actions/setup-node@v7\\n        with:\\n          node-version: '22'\\n          cache: npm\\n      - run: npm ci\\n      - name: Set owned test PostgreSQL lock capacity for populated migrations\\n        timeout-minutes: 3\\n        shell: bash\\n        env:\\n          POSTGRES_SERVICE_ID: ${{ job.services.postgres.id }}\\n        run: |\\n          set -euo pipefail\\n          [[ \\\"$POSTGRES_SERVICE_ID\\\" =~ ^[0-9a-f]{64}$ ]] || { echo 'Missing owned PostgreSQL service container ID' >&2; exit 1; }\\n          timeout 15s docker exec \\\"$POSTGRES_SERVICE_ID\\\" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'ALTER SYSTEM SET max_locks_per_transaction = 512;'\\n          timeout 45s docker restart --timeout 30 \\\"$POSTGRES_SERVICE_ID\\\"\\n          ready=0\\n          deadline=$((SECONDS + 60))\\n          while (( SECONDS < deadline )); do\\n            if timeout 3s docker exec \\\"$POSTGRES_SERVICE_ID\\\" pg_isready -q -t 1 -U postgres -d postgres; then\\n              ready=1\\n              break\\n            fi\\n            sleep 1\\n          done\\n          [[ \\\"$ready\\\" == 1 ]] || { echo 'Owned PostgreSQL service did not become ready within 60 seconds' >&2; exit 1; }\\n          actual=\\\"$(timeout 10s docker exec \\\"$POSTGRES_SERVICE_ID\\\" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc 'SHOW max_locks_per_transaction;')\\\"\\n          [[ \\\"$actual\\\" == 512 ]] || { echo \\\"Unexpected test max_locks_per_transaction: $actual\\\" >&2; exit 1; }\\n      - name: Create fresh owned migration fixture databases\\n        timeout-minutes: 1\\n        run: |\\n          node --input-type=module <<'NODE'\\n          import assert from 'node:assert/strict';\\n          import pg from 'pg';\\n          const client = new pg.Client({ connectionString: 'postgres://postgres:pgcheck@127.0.0.1:5432/postgres', connectionTimeoutMillis: 10000, query_timeout: 30000 });\\n          try {\\n            await client.connect();\\n            assert.deepEqual((await client.query('SELECT current_user AS role,current_database() AS database,inet_server_port() AS port')).rows,\\n              [{ role: 'postgres', database: 'postgres', port: 5432 }]);\\n            const existing = await client.query('SELECT datname FROM pg_database WHERE datname IN ($1,$2,$3)', ['omerta_check', 'omerta_query', 'omerta_task_puzzles_ci']);\\n            assert.deepEqual(existing.rows, [], 'Owned migration fixture databases must not pre-exist');\\n            await client.query('CREATE DATABASE omerta_check');\\n            await client.query('CREATE DATABASE omerta_query');\\n            await client.query('CREATE DATABASE omerta_task_puzzles_ci');\\n            assert.deepEqual((await client.query('SELECT datname,pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname IN ($1,$2,$3) ORDER BY datname', ['omerta_check', 'omerta_query', 'omerta_task_puzzles_ci'])).rows,\\n              [{ datname: 'omerta_check', owner: 'postgres' }, { datname: 'omerta_query', owner: 'postgres' }, { datname: 'omerta_task_puzzles_ci', owner: 'postgres' }]);\\n          } finally { await client.end(); }\\n          NODE\\n      - name: Populated phase2 and Director migration regression\\n        run: |\\n          set -euo pipefail\\n          (\\n            export TEST_DATABASE_URL=postgres://postgres:pgcheck@127.0.0.1:5432/omerta_check\\n            phase2_status=0\\n            npm run phase2:definitions:postgres || phase2_status=1\\n            npm run phase2:lots:postgres || phase2_status=1\\n            exit \\\"$phase2_status\\\"\\n          ) > \\\"$RUNNER_TEMP/questing-phase2-migrations.log\\\" 2>&1 &\\n          phase2_pid=$!\\n          (\\n            export COORDINATION_TEST_DATABASE_URL=postgres://postgres:pgcheck@127.0.0.1:5432/omerta_query\\n            node test/director-migration.js --postgres\\n          ) > \\\"$RUNNER_TEMP/questing-director-migration.log\\\" 2>&1 &\\n          director_pid=$!\\n          result=0\\n          wait \\\"$phase2_pid\\\" || result=1\\n          wait \\\"$director_pid\\\" || result=1\\n          cat \\\"$RUNNER_TEMP/questing-phase2-migrations.log\\\"\\n          cat \\\"$RUNNER_TEMP/questing-director-migration.log\\\"\\n          exit \\\"$result\\\"\\n      - name: Native invitation, handoff and receipt races\\n        env:\\n          QUESTING_TEST_DATABASE_URL: postgres://postgres:pgcheck@127.0.0.1:5432/omerta_questing_ci\\n          JWT_SECRET: ci-questing-jwt-not-a-real-secret\\n          MOD_KEY: ci-questing-mod-not-a-real-secret\\n          MARKET_SEED: ciQuestingMarketSeed7Qx2mVb9PwLn4\\n          SOCIAL_VERIFY_MODE: 'off'\\n          POPULATION_OFF: 'on'\\n        run: npm run test:questing:postgres\\n      - name: Native task puzzle issuance, job races and rollback\\n        env:\\n          TASK_PUZZLE_TEST_DATABASE_URL: postgres://postgres:pgcheck@127.0.0.1:5432/omerta_task_puzzles_ci\\n        run: npm run test:task-puzzles:postgres\";\n  const assertQuestJobs = (browserBlock, nativeBlock) => {\n    assert.equal(nativeShape(browserBlock), expectedQuestBrowser, 'The quest browser job retains complete pure guards, cases and real browser commands without database authority');\n    assert.equal(nativeShape(nativeBlock), expectedQuestNative, 'The quest authority job retains its isolated PostgreSQL18 service, owned lock setup and real native endpoint/command');\n",
          "baseline": "  const nativeShape = block => block.replaceAll('\\r\\n', '\\n').split('\\n')\n    .filter(line => line.trim() && !/^\\s*#/.test(line)).map(line => line.trimEnd()).join('\\n');\n  const expectedQuestBrowser = \"  questing_browser:\\n    name: Quest acceptance and browser playthroughs\\n    runs-on: ubuntu-latest\\n    timeout-minutes: 15\\n    steps:\\n      - uses: actions/checkout@v7\\n        with:\\n          fetch-depth: 0\\n      - uses: actions/setup-node@v7\\n        with:\\n          node-version: '22'\\n          cache: npm\\n      - run: npm ci\\n      - run: npx playwright-core install --with-deps chromium\\n      - name: Quest source and current native admission guards\\n        run: |\\n          node test/questing-source-transfer.js\\n          node test/enterprise-native-questing-guard.js\\n          node test/questing-enterprise-catalog-guard.js\\n          node test/questing-ux-release-phase2-native-catalog-guard.js\\n          node test/rc1-npc-retirement-journal.js\\n          node test/genesis-fee-readiness-source-transfer.js\\n      - name: Quest runtime, cases and community workshop\\n        run: npm run test:questing\\n      - name: Production quest and clue interfaces\\n        run: |\\n          export CHROMIUM_PATH=\\\"$(node --input-type=module -e 'import { chromium } from \\\"playwright-core\\\"; process.stdout.write(chromium.executablePath());')\\\"\\n          npm run test:questing:browser\\n      - run: npm run questing:check\";\n  const expectedQuestNative = \"  questing_native:\\n    name: Quest authority and concurrency (PostgreSQL)\\n    runs-on: ubuntu-latest\\n    timeout-minutes: 30\\n    services:\\n      postgres:\\n        image: postgres:18.4\\n        env:\\n          POSTGRES_PASSWORD: pgcheck\\n          POSTGRES_DB: omerta_questing_ci\\n        ports:\\n          - 5432:5432\\n        options: >-\\n          --health-cmd \\\"pg_isready -U postgres\\\"\\n          --health-interval 5s\\n          --health-timeout 5s\\n          --health-retries 12\\n    steps:\\n      - uses: actions/checkout@v7\\n        with:\\n          fetch-depth: 0\\n      - uses: actions/setup-node@v7\\n        with:\\n          node-version: '22'\\n          cache: npm\\n      - run: npm ci\\n      - name: Set owned test PostgreSQL lock capacity for populated migrations\\n        timeout-minutes: 3\\n        shell: bash\\n        env:\\n          POSTGRES_SERVICE_ID: ${{ job.services.postgres.id }}\\n        run: |\\n          set -euo pipefail\\n          [[ \\\"$POSTGRES_SERVICE_ID\\\" =~ ^[0-9a-f]{64}$ ]] || { echo 'Missing owned PostgreSQL service container ID' >&2; exit 1; }\\n          timeout 15s docker exec \\\"$POSTGRES_SERVICE_ID\\\" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'ALTER SYSTEM SET max_locks_per_transaction = 512;'\\n          timeout 45s docker restart --timeout 30 \\\"$POSTGRES_SERVICE_ID\\\"\\n          ready=0\\n          deadline=$((SECONDS + 60))\\n          while (( SECONDS < deadline )); do\\n            if timeout 3s docker exec \\\"$POSTGRES_SERVICE_ID\\\" pg_isready -q -t 1 -U postgres -d postgres; then\\n              ready=1\\n              break\\n            fi\\n            sleep 1\\n          done\\n          [[ \\\"$ready\\\" == 1 ]] || { echo 'Owned PostgreSQL service did not become ready within 60 seconds' >&2; exit 1; }\\n          actual=\\\"$(timeout 10s docker exec \\\"$POSTGRES_SERVICE_ID\\\" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc 'SHOW max_locks_per_transaction;')\\\"\\n          [[ \\\"$actual\\\" == 512 ]] || { echo \\\"Unexpected test max_locks_per_transaction: $actual\\\" >&2; exit 1; }\\n      - name: Create fresh owned migration fixture databases\\n        timeout-minutes: 1\\n        run: |\\n          node --input-type=module <<'NODE'\\n          import assert from 'node:assert/strict';\\n          import pg from 'pg';\\n          const client = new pg.Client({ connectionString: 'postgres://postgres:pgcheck@127.0.0.1:5432/postgres', connectionTimeoutMillis: 10000, query_timeout: 30000 });\\n          try {\\n            await client.connect();\\n            assert.deepEqual((await client.query('SELECT current_user AS role,current_database() AS database,inet_server_port() AS port')).rows,\\n              [{ role: 'postgres', database: 'postgres', port: 5432 }]);\\n            const existing = await client.query('SELECT datname FROM pg_database WHERE datname IN ($1,$2)', ['omerta_check', 'omerta_query']);\\n            assert.deepEqual(existing.rows, [], 'Owned migration fixture databases must not pre-exist');\\n            await client.query('CREATE DATABASE omerta_check');\\n            await client.query('CREATE DATABASE omerta_query');\\n            assert.deepEqual((await client.query('SELECT datname,pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname IN ($1,$2) ORDER BY datname', ['omerta_check', 'omerta_query'])).rows,\\n              [{ datname: 'omerta_check', owner: 'postgres' }, { datname: 'omerta_query', owner: 'postgres' }]);\\n          } finally { await client.end(); }\\n          NODE\\n      - name: Populated phase2 and Director migration regression\\n        run: |\\n          set -euo pipefail\\n          (\\n            export TEST_DATABASE_URL=postgres://postgres:pgcheck@127.0.0.1:5432/omerta_check\\n            phase2_status=0\\n            npm run phase2:definitions:postgres || phase2_status=1\\n            npm run phase2:lots:postgres || phase2_status=1\\n            exit \\\"$phase2_status\\\"\\n          ) > \\\"$RUNNER_TEMP/questing-phase2-migrations.log\\\" 2>&1 &\\n          phase2_pid=$!\\n          (\\n            export COORDINATION_TEST_DATABASE_URL=postgres://postgres:pgcheck@127.0.0.1:5432/omerta_query\\n            node test/director-migration.js --postgres\\n          ) > \\\"$RUNNER_TEMP/questing-director-migration.log\\\" 2>&1 &\\n          director_pid=$!\\n          result=0\\n          wait \\\"$phase2_pid\\\" || result=1\\n          wait \\\"$director_pid\\\" || result=1\\n          cat \\\"$RUNNER_TEMP/questing-phase2-migrations.log\\\"\\n          cat \\\"$RUNNER_TEMP/questing-director-migration.log\\\"\\n          exit \\\"$result\\\"\\n      - name: Native invitation, handoff and receipt races\\n        env:\\n          QUESTING_TEST_DATABASE_URL: postgres://postgres:pgcheck@127.0.0.1:5432/omerta_questing_ci\\n          JWT_SECRET: ci-questing-jwt-not-a-real-secret\\n          MOD_KEY: ci-questing-mod-not-a-real-secret\\n          MARKET_SEED: ciQuestingMarketSeed7Qx2mVb9PwLn4\\n          SOCIAL_VERIFY_MODE: 'off'\\n          POPULATION_OFF: 'on'\\n        run: npm run test:questing:postgres\";\n  const assertQuestJobs = (browserBlock, nativeBlock) => {\n    assert.equal(nativeShape(browserBlock), expectedQuestBrowser, 'The quest browser job retains complete pure guards, cases and real browser commands without database authority');\n    assert.equal(nativeShape(nativeBlock), expectedQuestNative, 'The quest authority job retains its isolated PostgreSQL18 service, owned lock setup and real native endpoint/command');\n"
        },
        {
          "at": 365980,
          "current": "    expectedQuestNative.replace('job.services.postgres.id', 'inputs.container_id'),\n    expectedQuestNative.replace('test:questing:postgres', 'test:questing:postgres -- --partial'),\n    expectedQuestNative.replace('npm run test:questing:postgres', 'node -e \"process.exit(0)\"'),\n    expectedQuestNative.replace('npm run test:task-puzzles:postgres', 'node -e \"process.exit(0)\"'),\n    expectedQuestNative.replace('test:task-puzzles:postgres', 'test:task-puzzles:postgres -- --partial'),\n    expectedQuestNative.replaceAll('omerta_task_puzzles_ci', 'production'),\n    expectedQuestNative.replace(\"            await client.query('CREATE DATABASE omerta_task_puzzles_ci');\\n\", ''),\n    expectedQuestNative.replace('POSTGRES_PASSWORD: pgcheck', 'POSTGRES_PASSWORD: questing'),\n    expectedQuestNative.replace(\"assert.deepEqual(existing.rows, [], 'Owned migration fixture databases must not pre-exist');\", 'void existing;'),\n    expectedQuestNative.replace('export COORDINATION_TEST_DATABASE_URL=postgres://postgres:pgcheck@127.0.0.1:5432/omerta_query', 'export COORDINATION_TEST_DATABASE_URL=postgres://postgres:pgcheck@127.0.0.1:5432/omerta_check'),\n",
          "baseline": "    expectedQuestNative.replace('job.services.postgres.id', 'inputs.container_id'),\n    expectedQuestNative.replace('test:questing:postgres', 'test:questing:postgres -- --partial'),\n    expectedQuestNative.replace('npm run test:questing:postgres', 'node -e \"process.exit(0)\"'),\n    expectedQuestNative.replace('POSTGRES_PASSWORD: pgcheck', 'POSTGRES_PASSWORD: questing'),\n    expectedQuestNative.replace(\"assert.deepEqual(existing.rows, [], 'Owned migration fixture databases must not pre-exist');\", 'void existing;'),\n    expectedQuestNative.replace('export COORDINATION_TEST_DATABASE_URL=postgres://postgres:pgcheck@127.0.0.1:5432/omerta_query', 'export COORDINATION_TEST_DATABASE_URL=postgres://postgres:pgcheck@127.0.0.1:5432/omerta_check'),\n"
        },
        {
          "at": 487290,
          "current": "    const normalized=source.replaceAll('\\r\\n','\\n');\n    if(file!=='src/growth.js'||source.split(original).length!==4||normalized.includes('\\r')\n      ||(source!==normalized&&source!==normalized.replaceAll('\\n','\\r\\n'))\n      ||createHash('sha256').update(normalized).digest('hex')!=='32f6733d566505eeb5407da8dfb65c9cdfd115f717f9890ed329153b62067298')return source;\n    // These three refusals read the permanent provider/post receipt, not a refillable allowance.\n    // Mask only the reviewed error token; a same-named counter or changed claim path remains visible.\n    return source.replaceAll(original,original.replace(\"'proof_used'\",\"'proof'\"));\n",
          "baseline": "    const normalized=source.replaceAll('\\r\\n','\\n');\n    if(file!=='src/growth.js'||source.split(original).length!==4||normalized.includes('\\r')\n      ||(source!==normalized&&source!==normalized.replaceAll('\\n','\\r\\n'))\n      ||createHash('sha256').update(normalized).digest('hex')!=='a56eef048988290bcab08966e9874b74dd84d1275e062e84b1d26c5d1097657b')return source;\n    // These three refusals read the permanent provider/post receipt, not a refillable allowance.\n    // Mask only the reviewed error token; a same-named counter or changed claim path remains visible.\n    return source.replaceAll(original,original.replace(\"'proof_used'\",\"'proof'\"));\n"
        }
      ]
    },
    "test/gateway-context.js": {
      "current": {
        "mode": "100644",
        "blob": "d7c0a5e4e6e85dabf65e803b26812dc1c7addc48",
        "sha256": "5826d478a250ccd2432182d4f06639a14ad98d825663b0337875c2e0a9d703a5",
        "bytes": 19431
      },
      "baseline": {
        "mode": "100644",
        "blob": "4f420b5e556aab70ea9576536917184b0d571572",
        "sha256": "1c75703a9e278d43759654632ebf0c6d1184f3a5b2914b2200aa46d59ba38b27",
        "bytes": 19074
      },
      "inverses": [
        {
          "at": 16762,
          "current": "  assert.doesNotMatch(JSON.stringify(fullPaths), /foreign-car/);\n  assertNoNumericSecrets(fullPaths, /98765|987/);\n\n  const missionMetadata = await run('get_available_missions');\n  assert.deepEqual([...missionMetadata.missions, ...missionMetadata.blockedMissions]\n    .filter(mission => mission.puzzle?.required).map(mission => mission.id).sort(), ['m11', 'm12', 'm2']);\n  // Every published mission's readiness preview must match its requirements and\n  // cooldown. Selected jobs then stop at the required puzzle gate, before writes.\n  const oldCooldown = process.env.MISSION_CD_MS;\n  process.env.MISSION_CD_MS = '60000';\n  try {\n",
          "baseline": "  assert.doesNotMatch(JSON.stringify(fullPaths), /foreign-car/);\n  assertNoNumericSecrets(fullPaths, /98765|987/);\n\n  // Every published mission's preview must match its actual refusal/acceptance gate.\n  // The fake query stops exactly at the first write, so no reward is executed here.\n  const oldCooldown = process.env.MISSION_CD_MS;\n  process.env.MISSION_CD_MS = '60000';\n  try {\n"
        },
        {
          "at": 17898,
          "current": "      const client = { async query(sql) { if (/^SELECT/.test(sql)) return { rows: [] }; throw Object.assign(new Error('mutation boundary'), { code: 'accepted_at_write' }); } };\n      let refusal;\n      try { await doMission(ch, mission.id, client, { owned: { assets: [], gear: [] } }); } catch (error) { refusal = error; }\n      assert.equal(refusal.code, readiness.missing.length ? 'reqs' : readiness.cooldownSeconds ? 'cooldown' :\n        ['m2', 'm11', 'm12'].includes(mission.id) ? 'task_puzzle_required' : 'accepted_at_write');\n      assert.equal(readiness.available, ['accepted_at_write', 'task_puzzle_required'].includes(refusal.code));\n      if (refusal.code === 'reqs') assert.deepEqual(refusal.data.need, Object.fromEntries(readiness.missing.map(({ k, need }) => [k, need])));\n    }\n  } finally {\n",
          "baseline": "      const client = { async query(sql) { if (/^SELECT/.test(sql)) return { rows: [] }; throw Object.assign(new Error('mutation boundary'), { code: 'accepted_at_write' }); } };\n      let refusal;\n      try { await doMission(ch, mission.id, client, { owned: { assets: [], gear: [] } }); } catch (error) { refusal = error; }\n      assert.equal(refusal.code, readiness.missing.length ? 'reqs' : readiness.cooldownSeconds ? 'cooldown' : 'accepted_at_write');\n      assert.equal(readiness.available, refusal.code === 'accepted_at_write');\n      if (refusal.code === 'reqs') assert.deepEqual(refusal.data.need, Object.fromEntries(readiness.missing.map(({ k, need }) => [k, need])));\n    }\n  } finally {\n"
        }
      ]
    },
    "test/genesis-fee-readiness-source-transfer.js": {
      "current": {
        "mode": "100644",
        "blob": "43e565a31a2233a0143876f733d58b7a8e04e93c",
        "sha256": "001f238a5dd826b9962448e7779f950864c49415956956a60286870475cb79f8",
        "bytes": 25966
      },
      "baseline": {
        "mode": "100644",
        "blob": "2a03ab84b77650bf3ae59189fb6c8a604dd5a035",
        "sha256": "ecc3ffff4d2921da88d9326a133beff3b1bd6dfdca70ea0a189d3289adcf7945",
        "bytes": 24960
      },
      "inverses": [
        {
          "at": 412,
          "current": "import { QUESTING_SOURCE, qualifyQuestingSource, questingHistoricalInput,\n  questingHistoricalEntry } from '../tools/questing-source-transfer.js';\nimport { SITE_BASICS_SOURCE, qualifySiteBasicsSource } from '../tools/site-basics-source-transfer.js';\nimport { ageRemovalHistoricalRecord } from '../tools/age-removal-source-transfer.js';\nimport {\n  GENESIS_FEE_READINESS_BASE_REVISION, GENESIS_FEE_READINESS_REVIEWED_REVISION,\n  GENESIS_FEE_READINESS_DOMAINS, GENESIS_FEE_READINESS_SOURCE_TRANSFER,\n",
          "baseline": "import { QUESTING_SOURCE, qualifyQuestingSource, questingHistoricalInput,\n  questingHistoricalEntry } from '../tools/questing-source-transfer.js';\nimport { SITE_BASICS_SOURCE, qualifySiteBasicsSource } from '../tools/site-basics-source-transfer.js';\nimport {\n  GENESIS_FEE_READINESS_BASE_REVISION, GENESIS_FEE_READINESS_REVIEWED_REVISION,\n  GENESIS_FEE_READINESS_DOMAINS, GENESIS_FEE_READINESS_SOURCE_TRANSFER,\n"
        },
        {
          "at": 12912,
          "current": "  assert(Buffer.from(physical).equals(raw), 'Lossless actual fixture UTF-8 required');\n  assert(physical === head || physical === head.replaceAll('\\n', '\\r\\n'),\n    'Whole actual fixture LF/CRLF bytes qualify before projection');\n  const historical = ageRemovalHistoricalRecord(fixture, { head: { mode: actual[1], blob: actual[2] }, index: actualIndex,\n    committed: Buffer.from(head), physical: raw, regular: stat.isFile(), symbolic: stat.isSymbolicLink() });\n  assert.deepEqual({ mode: historical.head.mode, blob: historical.head.blob, sha256: sha(historical.committed), bytes: historical.committed.length },\n    SITE_BASICS_SOURCE.files[fixture].current, 'Independently admitted current fixture reconstructs its unchanged site pin');\n  function fixtureComparison(file, input, tree, index) {\n    assert.equal(arguments.length, 4, 'Only the closed fixture byte/tree/index comparison is accepted');\n    assert.equal(file, fixture, 'Only the exact Genesis historical fixture comparison');\n    assert(Buffer.isBuffer(input), 'Complete physical fixture Buffer required');\n    const actualTree = typeof tree === 'string' && tree.match(/^(100644|100755) blob ([a-f0-9]{40})\\t(.+)$/);\n    assert(actualTree && actualTree[0] === tree && actualTree[3] === file, 'Complete current fixture tree identity required');\n    const historical = ageRemovalHistoricalRecord(file, { head: { mode: actualTree[1], blob: actualTree[2] }, index,\n      committed: Buffer.from(lf(input.toString('utf8'))), physical: input, regular: stat.isFile(), symbolic: stat.isSymbolicLink() });\n    tree = historical.head.mode + ' blob ' + historical.head.blob + '\\t' + file;\n    index = historical.index;\n    const currentPin = SITE_BASICS_SOURCE.files[file].current;\n    assert.equal(tree, currentPin.mode + ' blob ' + currentPin.blob + '\\t' + file, 'Only the exact current site tree is admitted');\n    assert.equal(index, currentPin.mode + ' ' + currentPin.blob + ' 0\\t' + file, 'Only the exact current site index is admitted');\n    const siteProof = qualifySiteBasicsSource(file, historical.committed);\n    assert.deepEqual([siteProof.sourceOnly, siteProof.runtime, siteProof.native, siteProof.financial, siteProof.activation,\n      siteProof.deployment, siteProof.priorResultsTransferred], [true, false, false, false, false, false, false]);\n    const siteText = siteProof.baselineText;\n",
          "baseline": "  assert(Buffer.from(physical).equals(raw), 'Lossless actual fixture UTF-8 required');\n  assert(physical === head || physical === head.replaceAll('\\n', '\\r\\n'),\n    'Whole actual fixture LF/CRLF bytes qualify before projection');\n  assert.deepEqual({ mode: actual[1], blob: actual[2], sha256: sha(head), bytes: Buffer.byteLength(head) },\n    SITE_BASICS_SOURCE.files[fixture].current, 'The real current fixture independently matches its exact site pin');\n  function fixtureComparison(file, input, tree, index) {\n    assert.equal(arguments.length, 4, 'Only the closed fixture byte/tree/index comparison is accepted');\n    assert.equal(file, fixture, 'Only the exact Genesis historical fixture comparison');\n    assert(Buffer.isBuffer(input), 'Complete physical fixture Buffer required');\n    const currentPin = SITE_BASICS_SOURCE.files[file].current;\n    assert.equal(tree, currentPin.mode + ' blob ' + currentPin.blob + '\\t' + file, 'Only the exact current site tree is admitted');\n    assert.equal(index, currentPin.mode + ' ' + currentPin.blob + ' 0\\t' + file, 'Only the exact current site index is admitted');\n    const siteProof = qualifySiteBasicsSource(file, input);\n    assert.deepEqual([siteProof.sourceOnly, siteProof.runtime, siteProof.native, siteProof.financial, siteProof.activation,\n      siteProof.deployment, siteProof.priorResultsTransferred], [true, false, false, false, false, false, false]);\n    const siteText = siteProof.baselineText;\n"
        },
        {
          "at": 22784,
          "current": "  for (const supplied of [Buffer.from(head + '\\n// unrelated fixture edit\\n'), Buffer.from(head.slice(1)),\n    Buffer.from('\\ufeff' + head), Buffer.from(head + '\\0'), Buffer.from(head.replace('\\n', '\\r\\n')),\n    Buffer.from(head.replace('\\n', '\\r')), Buffer.from(head.replace(/\\S/, '?')), Buffer.from([255]),\n    comparison.source, historical.committed, head, null]) {\n    assert.throws(() => fixtureComparison(fixture, supplied, actualEntry, actualIndex)); currentRefusals++;\n  }\n  for (const kind of ['tree', 'index']) {\n",
          "baseline": "  for (const supplied of [Buffer.from(head + '\\n// unrelated fixture edit\\n'), Buffer.from(head.slice(1)),\n    Buffer.from('\\ufeff' + head), Buffer.from(head + '\\0'), Buffer.from(head.replace('\\n', '\\r\\n')),\n    Buffer.from(head.replace('\\n', '\\r')), Buffer.from(head.replace(/\\S/, '?')), Buffer.from([255]),\n    comparison.source, head, null]) {\n    assert.throws(() => fixtureComparison(fixture, supplied, actualEntry, actualIndex)); currentRefusals++;\n  }\n  for (const kind of ['tree', 'index']) {\n"
        },
        {
          "at": 23999,
          "current": "  assert.throws(() => fixtureComparison(fixture, raw, actualEntry)); currentRefusals++;\n  assert.throws(() => fixtureComparison(fixture, raw, actualEntry, actualIndex, {})); currentRefusals++;\n  assert.throws(() => { comparison.proof.native = true; }, TypeError); currentRefusals++;\n  assert.equal(currentPositives, 2); assert.equal(currentRefusals, 31);\n  let siteRefusals = 0;\n  const questCurrent = QUESTING_SOURCE.files[fixture].current;\n  const oldTree = questCurrent.mode + ' blob ' + questCurrent.blob + '\\t' + fixture;\n",
          "baseline": "  assert.throws(() => fixtureComparison(fixture, raw, actualEntry)); currentRefusals++;\n  assert.throws(() => fixtureComparison(fixture, raw, actualEntry, actualIndex, {})); currentRefusals++;\n  assert.throws(() => { comparison.proof.native = true; }, TypeError); currentRefusals++;\n  assert.equal(currentPositives, 2); assert.equal(currentRefusals, 30);\n  let siteRefusals = 0;\n  const questCurrent = QUESTING_SOURCE.files[fixture].current;\n  const oldTree = questCurrent.mode + ' blob ' + questCurrent.blob + '\\t' + fixture;\n"
        }
      ]
    },
    "test/growth.js": {
      "current": {
        "mode": "100644",
        "blob": "0e1f99df1dd0f5adc07119534a3412ee5c9affa3",
        "sha256": "e9f98498fc333845ed31c34c9ae1ad06e361dd858a4d163a8f3d59de308e6768",
        "bytes": 219883
      },
      "baseline": {
        "mode": "100644",
        "blob": "4a41b57e05be9421a99666e6bf8ed5146299657a",
        "sha256": "e153853b12018c5e2e487e67d4fc6507f99a1d53eaff0e436f2606ca0ca8b9bd",
        "bytes": 219622
      },
      "inverses": [
        {
          "at": 799,
          "current": "import { accrue } from '../src/accrual.js';\nimport { sweepGrandReferrals, gainRespect, maybeSparkReferral } from '../src/game.js';\nimport { GOODS_MARKET } from '../src/goodsmarket.js';\nimport { solveTaskPuzzle } from './lib/task-puzzle-solver.js';\n\n// The City Standing / recruiters boards are CACHED in production (standing.js — they were the most\n// expensive polled reads in the game). This suite reads boards it has just written, so it pins the\n",
          "baseline": "import { accrue } from '../src/accrual.js';\nimport { sweepGrandReferrals, gainRespect, maybeSparkReferral } from '../src/game.js';\nimport { GOODS_MARKET } from '../src/goodsmarket.js';\n\n// The City Standing / recruiters boards are CACHED in production (standing.js — they were the most\n// expensive polled reads in the game). This suite reads boards it has just written, so it pins the\n"
        },
        {
          "at": 188551,
          "current": "  assert.equal((await call('POST', '/v1/hustle/advance', { token: hus.token })).body.error, 'district',\n    'the work counts, but the CHECK-IN is still location-gated — you have to bring it to the stop');\n  await seedCh(hus.id, `loc='${b1.district}'`);\n  const legworkPuzzle = (await call('POST', '/v1/task-puzzles', { token: hus.token, body: { scope: 'hustle', targetId: 'legwork' } })).body.puzzle;\n  r = await call('POST', '/v1/hustle/advance', { token: hus.token, body: { puzzle: solveTaskPuzzle(legworkPuzzle) } });\n  assert.equal(r.body.step, 2, `the legwork done (${b1.legwork}) advances the chain`);\n  // the payoff: on location, ledgered, level-scaled, once a day\n  const b2 = (await call('GET', '/v1/hustle', { token: hus.token })).body;\n",
          "baseline": "  assert.equal((await call('POST', '/v1/hustle/advance', { token: hus.token })).body.error, 'district',\n    'the work counts, but the CHECK-IN is still location-gated — you have to bring it to the stop');\n  await seedCh(hus.id, `loc='${b1.district}'`);\n  r = await call('POST', '/v1/hustle/advance', { token: hus.token });\n  assert.equal(r.body.step, 2, `the legwork done (${b1.legwork}) advances the chain`);\n  // the payoff: on location, ledgered, level-scaled, once a day\n  const b2 = (await call('GET', '/v1/hustle', { token: hus.token })).body;\n"
        }
      ]
    },
    "test/hardening.js": {
      "current": {
        "mode": "100644",
        "blob": "c6dd6e3613d7cc4b3ab5dbd62041d1ece87ff0eb",
        "sha256": "cba4c8e4c4c5ab7936a32cb2642db4887b1c5e0cae139b51ef0f6b77b3028eeb",
        "bytes": 142355
      },
      "baseline": {
        "mode": "100644",
        "blob": "4b54f6b4b095c3dd482b2e55e1b302bd722e5fa9",
        "sha256": "989af49e0989f4697738c3ae395ae28ff15177c5cf237ce41a508a29f52e20eb",
        "bytes": 142579
      },
      "inverses": [
        {
          "at": 3345,
          "current": "  app.post(`/v1/__contention_${code}`, async () => { const e = new Error('boom'); e.code = code; throw e; });\napp.post('/v1/__genuine_bug', async () => { throw new Error('a real null-dereference'); });\nconst pool = app.pool;\nconst modH = { 'x-mod-key': 'test-mod-key' };\nconst call = async (method, url, { token, body, headers } = {}) => {\n  const res = await app.inject({ method, url, payload: headers?.['content-type'] === 'application/json' && body === undefined ? undefined : adultAuthFixture(method, url, body),\n",
          "baseline": "  app.post(`/v1/__contention_${code}`, async () => { const e = new Error('boom'); e.code = code; throw e; });\napp.post('/v1/__genuine_bug', async () => { throw new Error('a real null-dereference'); });\nconst pool = app.pool;\nconst ageCookie = (await app.inject({ method: 'POST', url: '/v1/age-check', payload: { birthDate: '1990-01-01' } })).headers['set-cookie'].split(';')[0];\nconst modH = { 'x-mod-key': 'test-mod-key' };\nconst call = async (method, url, { token, body, headers } = {}) => {\n  const res = await app.inject({ method, url, payload: headers?.['content-type'] === 'application/json' && body === undefined ? undefined : adultAuthFixture(method, url, body),\n"
        },
        {
          "at": 77348,
          "current": "    let r = await call('POST', '/v1/auth/x/start', { body: {} });\n    let state = new URL(r.body.url).searchParams.get('state');\n    let cb = await app.inject({ method: 'GET', url: `/v1/auth/x/callback?code=ok&state=${state}`,\n      headers: { cookie: `omerta_oauth=${state}` } });\n    assert(cb.headers.location.includes('#token='), 'a real exchange lands a signed session token');\n    const xToken = decodeURIComponent(cb.headers.location.split('#token=')[1]);\n    const sess = await call('GET', '/v1/session', { token: xToken });\n    assert.equal(sess.body.provider, 'x', 'the minted session is the X identity');\n    // REPLAY the same callback → the state was consumed (single-use, DELETE-returning)\n    cb = await app.inject({ method: 'GET', url: `/v1/auth/x/callback?code=ok&state=${state}`,\n      headers: { cookie: `omerta_oauth=${state}` } });\n    assert(cb.headers.location.includes('#autherr=oauth_state'), 'a replayed callback finds no state');\n    // (2) the guest UPGRADE: an authed start claims-in-place; the same X id can never claim twice\n    const claimer = await mk('Claim Kid');\n",
          "baseline": "    let r = await call('POST', '/v1/auth/x/start', { body: {} });\n    let state = new URL(r.body.url).searchParams.get('state');\n    let cb = await app.inject({ method: 'GET', url: `/v1/auth/x/callback?code=ok&state=${state}`,\n      headers: { cookie: `omerta_oauth=${state}; ${ageCookie}` } });\n    assert(cb.headers.location.includes('#token='), 'a real exchange lands a signed session token');\n    const xToken = decodeURIComponent(cb.headers.location.split('#token=')[1]);\n    const sess = await call('GET', '/v1/session', { token: xToken });\n    assert.equal(sess.body.provider, 'x', 'the minted session is the X identity');\n    // REPLAY the same callback → the state was consumed (single-use, DELETE-returning)\n    cb = await app.inject({ method: 'GET', url: `/v1/auth/x/callback?code=ok&state=${state}`,\n      headers: { cookie: `omerta_oauth=${state}; ${ageCookie}` } });\n    assert(cb.headers.location.includes('#autherr=oauth_state'), 'a replayed callback finds no state');\n    // (2) the guest UPGRADE: an authed start claims-in-place; the same X id can never claim twice\n    const claimer = await mk('Claim Kid');\n"
        },
        {
          "at": 78504,
          "current": "    r = await call('POST', '/v1/auth/x/start', { token: claimer.token, body: {} });\n    state = new URL(r.body.url).searchParams.get('state');\n    cb = await app.inject({ method: 'GET', url: `/v1/auth/x/callback?code=ok&state=${state}`,\n      headers: { cookie: `omerta_oauth=${state}` } });\n    assert(cb.headers.location.includes('#claimed=x'), 'the guest is upgraded in place');\n    assert.equal((await call('GET', '/v1/session', { token: claimer.token })).body.provider, 'x',\n      'same account row, now an X identity');\n",
          "baseline": "    r = await call('POST', '/v1/auth/x/start', { token: claimer.token, body: {} });\n    state = new URL(r.body.url).searchParams.get('state');\n    cb = await app.inject({ method: 'GET', url: `/v1/auth/x/callback?code=ok&state=${state}`,\n      headers: { cookie: `omerta_oauth=${state}; ${ageCookie}` } });\n    assert(cb.headers.location.includes('#claimed=x'), 'the guest is upgraded in place');\n    assert.equal((await call('GET', '/v1/session', { token: claimer.token })).body.provider, 'x',\n      'same account row, now an X identity');\n"
        },
        {
          "at": 79076,
          "current": "    r = await call('POST', '/v1/auth/x/start', { token: rival.token, body: {} });\n    state = new URL(r.body.url).searchParams.get('state');\n    cb = await app.inject({ method: 'GET', url: `/v1/auth/x/callback?code=ok&state=${state}`,\n      headers: { cookie: `omerta_oauth=${state}` } });\n    assert(cb.headers.location.includes('#autherr=linked_elsewhere'), 'one X account, one street — the collision is clean');\n    // (3) a transient X failure during the exchange is a clean retryable x_busy, never a 500\n    xmock.token = () => jres(500, {});\n    r = await call('POST', '/v1/auth/x/start', { body: {} });\n    state = new URL(r.body.url).searchParams.get('state');\n    cb = await app.inject({ method: 'GET', url: `/v1/auth/x/callback?code=ok&state=${state}`,\n      headers: { cookie: `omerta_oauth=${state}` } });\n    assert(cb.headers.location.includes('#autherr=x_busy'), 'an X outage mid-exchange reads as busy, not broken');\n    // (4) verifyPostUp semantics: transient ≠ definitive (an outage must NEVER read as \"post gone\")\n    process.env.SOCIAL_VERIFY_MODE = 'live';\n",
          "baseline": "    r = await call('POST', '/v1/auth/x/start', { token: rival.token, body: {} });\n    state = new URL(r.body.url).searchParams.get('state');\n    cb = await app.inject({ method: 'GET', url: `/v1/auth/x/callback?code=ok&state=${state}`,\n      headers: { cookie: `omerta_oauth=${state}; ${ageCookie}` } });\n    assert(cb.headers.location.includes('#autherr=linked_elsewhere'), 'one X account, one street — the collision is clean');\n    // (3) a transient X failure during the exchange is a clean retryable x_busy, never a 500\n    xmock.token = () => jres(500, {});\n    r = await call('POST', '/v1/auth/x/start', { body: {} });\n    state = new URL(r.body.url).searchParams.get('state');\n    cb = await app.inject({ method: 'GET', url: `/v1/auth/x/callback?code=ok&state=${state}`,\n      headers: { cookie: `omerta_oauth=${state}; ${ageCookie}` } });\n    assert(cb.headers.location.includes('#autherr=x_busy'), 'an X outage mid-exchange reads as busy, not broken');\n    // (4) verifyPostUp semantics: transient ≠ definitive (an outage must NEVER read as \"post gone\")\n    process.env.SOCIAL_VERIFY_MODE = 'live';\n"
        }
      ]
    },
    "test/launch-invites-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "b9b04ab4c130b1347796baa5c7c09ded8881d2b3",
        "sha256": "9cc27a79042cb52b81f80de26117bdef45f13080ea6707c2324b6dcf590f4074",
        "bytes": 4505
      },
      "baseline": {
        "mode": "100644",
        "blob": "20894bc21000e2efd395450e4c0726ccfa5cb38b",
        "sha256": "84eabf4fbf70639a1834c50eb11df6cdc411cc74dcb3f635bf7e635b76c8a3b2",
        "bytes": 4685
      },
      "inverses": [
        {
          "at": 1374,
          "current": "  await page.setViewportSize({ width: 390, height: 844 });\n  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no mobile overflow');\n  await page.locator('#btn-guest').click();\n  await page.waitForSelector('#screen-create:not(.hidden)', { timeout: 30000 });\n  const token = await page.evaluate(() => localStorage.getItem('omerta_token'));\n  assert(token, 'admission token saved durably before navigation');\n",
          "baseline": "  await page.setViewportSize({ width: 390, height: 844 });\n  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no mobile overflow');\n  await page.locator('#btn-guest').click();\n  await page.waitForSelector('#age-date');\n  await page.locator('#age-date').fill('1990-01-01');\n  await page.locator('#age-date').evaluate((input) => input.form.requestSubmit());\n  await page.waitForSelector('#screen-create:not(.hidden)', { timeout: 30000 });\n  const token = await page.evaluate(() => localStorage.getItem('omerta_token'));\n  assert(token, 'admission token saved durably before navigation');\n"
        }
      ]
    },
    "test/legal-security.js": {
      "current": {
        "mode": "100644",
        "blob": "6d222d5ee3659b246bf50a40a38de2643ce27d49",
        "sha256": "974b248b54c7326dfa3cb64fa000c92fb14e8fbe7e0380baa7e677990b98aa4c",
        "bytes": 8268
      },
      "baseline": {
        "mode": "100644",
        "blob": "47fdd3229a01db7f284081463158c72d3a4ae3fc",
        "sha256": "c163969347ca63c21662b070b99f51e70eb35620335a9b78534661b719e8f1da",
        "bytes": 8086
      },
      "inverses": [
        {
          "at": 1048,
          "current": "  for (const key of Object.keys(profile)) delete process.env[key];\n  const defaultPrivacy = await app.inject('/privacy');\n  assert.equal(defaultPrivacy.statusCode, 200, 'default privacy policy is public without operator configuration');\n  assert(defaultPrivacy.body.includes('November 9, 2026'));\n  assert(defaultPrivacy.body.includes('A dedicated privacy contact has not yet been published'));\n  assert(!/\\b(?:null|undefined)\\b/.test(defaultPrivacy.body), 'default policy has no missing-value placeholders');\n  assert(!/180 days|seven days|thirty days|\\/v1\\/|background worker|BYPASSRLS|JWT_SECRET|end-to-end encrypted|token records/.test(defaultPrivacy.body), 'public notice omits security internals and cleanup timings');\n",
          "baseline": "  for (const key of Object.keys(profile)) delete process.env[key];\n  const defaultPrivacy = await app.inject('/privacy');\n  assert.equal(defaultPrivacy.statusCode, 200, 'default privacy policy is public without operator configuration');\n  assert(defaultPrivacy.body.includes('November 7, 2026'));\n  assert(defaultPrivacy.body.includes('A dedicated privacy contact has not yet been published'));\n  assert(!/\\b(?:null|undefined)\\b/.test(defaultPrivacy.body), 'default policy has no missing-value placeholders');\n  assert(!/180 days|seven days|thirty days|\\/v1\\/|background worker|BYPASSRLS|JWT_SECRET|end-to-end encrypted|token records/.test(defaultPrivacy.body), 'public notice omits security internals and cleanup timings');\n"
        },
        {
          "at": 3277,
          "current": "  const privacy = (await app.inject('/privacy')).body;\n  assert(privacy.includes('under 21, including children'));\n  assert(!privacy.includes('under 13'));\n  for (const description of ['IP addresses', 'Wallet addresses', 'Messages', 'Notification-delivery', 'Delegated-agent', 'Retention depends', 'Technical diagnostics']) assert(privacy.includes(description));\n  assert(!/birth date|age check|age verification/i.test(privacy), 'privacy does not describe the removed birth-date flow');\n  delete process.env.DMCA_AGENT_REGISTERED;\n  assert.equal((await app.inject('/dmca')).statusCode, 503, 'unverified registration is not presented as registered');\n  process.env.DMCA_AGENT_REGISTERED = 'true';\n",
          "baseline": "  const privacy = (await app.inject('/privacy')).body;\n  assert(privacy.includes('under 21, including children'));\n  assert(!privacy.includes('under 13'));\n  for (const description of ['IP addresses', 'Wallet addresses', 'Messages', 'Notification-delivery', 'Delegated-agent', 'Retention depends', 'without retaining', 'Technical diagnostics']) assert(privacy.includes(description));\n  delete process.env.DMCA_AGENT_REGISTERED;\n  assert.equal((await app.inject('/dmca')).statusCode, 503, 'unverified registration is not presented as registered');\n  process.env.DMCA_AGENT_REGISTERED = 'true';\n"
        },
        {
          "at": 4991,
          "current": "  for (const payload of [{ event: 'start' }, { event: 'answer', question: PATH_QUIZ_QUESTIONS[0].id, option: PATH_QUIZ_QUESTIONS[0].options[0].id, step: 1 }, { event: 'share', path: 'gun', channel: 'clipboard' }]) {\n    assert.equal((await app.inject({ method: 'POST', url: '/v1/path-quiz', payload })).statusCode, 200);\n  }\n  const guest = await app.inject({ method: 'POST', url: '/v1/auth/guest', payload: {} });\n  assert.equal(guest.statusCode, 200, 'human signup works without a birth date or optional analytics');\n  const headers = { authorization: `Bearer ${guest.json().token}` };\n  assert.equal((await app.inject({ method: 'POST', url: '/v1/screens', headers, payload: { screens: ['profile', 'wire'] } })).json().counted, 0);\n  assert.equal((await app.inject({ method: 'POST', url: '/v1/broadcast/shared', headers, payload: { kind: 'win' } })).statusCode, 200);\n",
          "baseline": "  for (const payload of [{ event: 'start' }, { event: 'answer', question: PATH_QUIZ_QUESTIONS[0].id, option: PATH_QUIZ_QUESTIONS[0].options[0].id, step: 1 }, { event: 'share', path: 'gun', channel: 'clipboard' }]) {\n    assert.equal((await app.inject({ method: 'POST', url: '/v1/path-quiz', payload })).statusCode, 200);\n  }\n  const guest = await app.inject({ method: 'POST', url: '/v1/auth/guest', payload: { birthDate: '1990-01-01' } });\n  const headers = { authorization: `Bearer ${guest.json().token}` };\n  assert.equal((await app.inject({ method: 'POST', url: '/v1/screens', headers, payload: { screens: ['profile', 'wire'] } })).json().counted, 0);\n  assert.equal((await app.inject({ method: 'POST', url: '/v1/broadcast/shared', headers, payload: { kind: 'win' } })).statusCode, 200);\n"
        }
      ]
    },
    "test/lib/city-afterword-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "b4967b7b24a77e1f4a94ac04b0f61c6ee1b1daee",
        "sha256": "f55b3b18a60815b91b7fd7a635e157636812d15a214ad9f87edb9370a5742c1f",
        "bytes": 6132
      },
      "baseline": {
        "mode": "100644",
        "blob": "70b6c9c3612738d9441586f067e2c59e46d0238d",
        "sha256": "6a8e0fed01c44d65a56266ae9fe221b66b9cd2859326c0dff6190caa94b53d09",
        "bytes": 6035
      },
      "inverses": [
        {
          "at": 134,
          "current": "import fs from 'node:fs';\nimport { chromium } from 'playwright-core';\nimport { cityAfterwordFixture, afterwordGraph as graph, mysteryRoot } from './city-afterword-fixture.js';\nimport { revealOptional } from './ux-disclosure-browser.js';\n\nexport async function runCityAfterwordBrowserProof() {\n  const executablePath = [process.env.CHROMIUM_PATH, chromium.executablePath(),\n",
          "baseline": "import fs from 'node:fs';\nimport { chromium } from 'playwright-core';\nimport { cityAfterwordFixture, afterwordGraph as graph, mysteryRoot } from './city-afterword-fixture.js';\n\nexport async function runCityAfterwordBrowserProof() {\n  const executablePath = [process.env.CHROMIUM_PATH, chromium.executablePath(),\n"
        },
        {
          "at": 4798,
          "current": "      assert.equal((await board(owner)).status, 'completed');\n      await detail.getByRole('heading', { name: 'Case closed', exact: true }).waitFor();\n      const ending = page.locator('[data-ux-story=\"case\"] [data-story-section^=\"epilogue:\"]');\n      await revealOptional(ending);\n      await ending.waitFor();\n      if (!await ending.evaluate(element => element.open)) await ending.locator(':scope > summary').click();\n      assert.match(await ending.innerText(), branch === 'live' ? /The neighborhood knows whom to call/ : /The archive remembers another name/);\n",
          "baseline": "      assert.equal((await board(owner)).status, 'completed');\n      await detail.getByRole('heading', { name: 'Case closed', exact: true }).waitFor();\n      const ending = page.locator('[data-ux-story=\"case\"] [data-story-section^=\"epilogue:\"]');\n      await ending.waitFor();\n      if (!await ending.evaluate(element => element.open)) await ending.locator(':scope > summary').click();\n      assert.match(await ending.innerText(), branch === 'live' ? /The neighborhood knows whom to call/ : /The archive remembers another name/);\n"
        }
      ]
    },
    "test/lib/rc1-historical-source-fixture.js": {
      "current": {
        "mode": "100644",
        "blob": "37e933f657e337ce3f83e61fa868880f4045b79b",
        "sha256": "58289bf4ffd2365f5a9b78fe0c27fe9de54cdf4865f591b3002c9283442cffc9",
        "bytes": 65056
      },
      "baseline": {
        "mode": "100644",
        "blob": "2939b8d45cab84f02514631addaeadb65ddbc67b",
        "sha256": "f04494bf0c912b9c7e8ac6ec075270689ee7206d965f356b9026181088555c81",
        "bytes": 64861
      },
      "inverses": [
        {
          "at": 2245,
          "current": "import { economyHardeningSourceBaseline } from '../../tools/economy-hardening-source-transfer.js';\nimport { QUESTING_SOURCE, qualifyQuestingSource } from '../../tools/questing-source-transfer.js';\nimport { SITE_BASICS_SOURCE, qualifySiteBasicsSource } from '../../tools/site-basics-source-transfer.js';\nimport { ageRemovalHistoricalRecord } from '../../tools/age-removal-source-transfer.js';\n\nexport const HISTORICAL_SOURCE_FIXTURE_REVISION = 'fe4a75a8b21fc41fd3d3bc75cf7720612c581463';\nconst releaseRevision = 'b12c1cbcbcf88bd4510cc8316c5cd5ca08eb4e16';\n",
          "baseline": "import { economyHardeningSourceBaseline } from '../../tools/economy-hardening-source-transfer.js';\nimport { QUESTING_SOURCE, qualifyQuestingSource } from '../../tools/questing-source-transfer.js';\nimport { SITE_BASICS_SOURCE, qualifySiteBasicsSource } from '../../tools/site-basics-source-transfer.js';\n\nexport const HISTORICAL_SOURCE_FIXTURE_REVISION = 'fe4a75a8b21fc41fd3d3bc75cf7720612c581463';\nconst releaseRevision = 'b12c1cbcbcf88bd4510cc8316c5cd5ca08eb4e16';\n"
        },
        {
          "at": 18886,
          "current": "}\nfunction qualifyCurrentCombinedSite(file, actual) {\n  assert.equal(arguments.length, 2); assert(combinedSiteComparisonFiles.includes(file), 'Only the four declared current combined comparisons');\n  actual = ageRemovalHistoricalRecord(file, actual);\n  assert(Object.hasOwn(SITE_BASICS_SOURCE.files, file), 'Exact site comparison domain required');\n  assert.deepEqual(Object.keys(actual).sort(), ['head', 'index', 'committed', 'physical', 'regular', 'symbolic'].sort());\n  const pin = SITE_BASICS_SOURCE.files[file].current;\n",
          "baseline": "}\nfunction qualifyCurrentCombinedSite(file, actual) {\n  assert.equal(arguments.length, 2); assert(combinedSiteComparisonFiles.includes(file), 'Only the four declared current combined comparisons');\n  assert(Object.hasOwn(SITE_BASICS_SOURCE.files, file), 'Exact site comparison domain required');\n  assert.deepEqual(Object.keys(actual).sort(), ['head', 'index', 'committed', 'physical', 'regular', 'symbolic'].sort());\n  const pin = SITE_BASICS_SOURCE.files[file].current;\n"
        },
        {
          "at": 21342,
          "current": "  return qualifyCurrentHistoricalHelper(file, actual, SITE_BASICS_SOURCE.files[file].current, qualifySiteBasicsSource);\n}\nfunction qualifyCurrentHistoricalHelper(file, actual, pin, qualify) {\n  actual = ageRemovalHistoricalRecord(file, actual);\n  assert.deepEqual(Object.keys(actual).sort(), ['head', 'index', 'committed', 'physical', 'regular', 'symbolic'].sort());\n  assert.deepEqual(actual.head, { mode: pin.mode, blob: pin.blob }, 'Actual helper HEAD equals its current source pin');\n  assert.equal(actual.index, pin.mode + ' ' + pin.blob + ' 0\\t' + file, 'Actual helper index equals its complete HEAD identity');\n",
          "baseline": "  return qualifyCurrentHistoricalHelper(file, actual, SITE_BASICS_SOURCE.files[file].current, qualifySiteBasicsSource);\n}\nfunction qualifyCurrentHistoricalHelper(file, actual, pin, qualify) {\n  assert.deepEqual(Object.keys(actual).sort(), ['head', 'index', 'committed', 'physical', 'regular', 'symbolic'].sort());\n  assert.deepEqual(actual.head, { mode: pin.mode, blob: pin.blob }, 'Actual helper HEAD equals its current source pin');\n  assert.equal(actual.index, pin.mode + ' ' + pin.blob + ' 0\\t' + file, 'Actual helper index equals its complete HEAD identity');\n"
        }
      ]
    },
    "test/lib/ux-journeys.js": {
      "current": {
        "mode": "100644",
        "blob": "a226be9421c511b03c7a62b8264e14bb0d640f26",
        "sha256": "4df40879cee8d1e4317170688e737407d2c6f3ad9c7a6085cf03caf973426e37",
        "bytes": 23252
      },
      "baseline": {
        "mode": "100644",
        "blob": "d519371d05ae1075ae8e9ceafbad7262b2e0da77",
        "sha256": "f4edfb0d836f75fc688af169d938ebb577a5bd3606696f3902c7d84c7e6bfd88",
        "bytes": 22566
      },
      "inverses": [
        {
          "at": 98,
          "current": "import { QUESTING_SOURCE, questingHistoricalInput, questingHistoricalEntry } from '../../tools/questing-source-transfer.js';\nimport { QUEST_QUALITY_SOURCE, qualifyQuestQualitySource } from '../../tools/quest-quality-source-transfer.js';\nimport { SITE_BASICS_SOURCE, qualifySiteBasicsSource } from '../../tools/site-basics-source-transfer.js';\nimport { ageRemovalHistoricalRecord } from '../../tools/age-removal-source-transfer.js';\nimport { BUSINESS_DESK_COMBINED_SOURCE, assertBusinessDeskCombinedSourceTransfer } from '../../tools/businessdesk-combined-source-transfer.js';\nimport assert from 'node:assert/strict';\nimport { readFileSync, lstatSync } from 'node:fs';\n",
          "baseline": "import { QUESTING_SOURCE, questingHistoricalInput, questingHistoricalEntry } from '../../tools/questing-source-transfer.js';\nimport { QUEST_QUALITY_SOURCE, qualifyQuestQualitySource } from '../../tools/quest-quality-source-transfer.js';\nimport { SITE_BASICS_SOURCE, qualifySiteBasicsSource } from '../../tools/site-basics-source-transfer.js';\nimport { BUSINESS_DESK_COMBINED_SOURCE, assertBusinessDeskCombinedSourceTransfer } from '../../tools/businessdesk-combined-source-transfer.js';\nimport assert from 'node:assert/strict';\nimport { readFileSync, lstatSync } from 'node:fs';\n"
        },
        {
          "at": 7048,
          "current": "  const rootSource = assertContractReleaseSourceDefinition();\n  const assertActualHeadInput = (file, raw, current, physical = current) => {\n    const original = pin.files.find(row => row.file === file); assert(original, 'Closed actual Afterword source subject');\n    assert.equal(typeof current, 'string'); assert.equal(typeof physical, 'string');\n    const actualIndex = git('ls-files', '--stage', '--', file).trim();\n    const actualStat = lstatSync(new URL('../../' + file, import.meta.url));\n    const historical = ageRemovalHistoricalRecord(file, { head: raw,\n      index: actualIndex, committed: Buffer.from(current), physical: Buffer.from(physical),\n      regular: actualStat.isFile(), symbolic: actualStat.isSymbolicLink() });\n    raw = historical.head; current = historical.committed.toString('utf8'); physical = historical.physical.toString('utf8');\n    const desk = rootSource.status === 'BOUND' && Object.hasOwn(rootSource.sourceViews, file)\n      && Object.hasOwn(rootSource.sourceViews[file].targets, 'desk') ? rootSource.sourceViews[file] : null;\n    const domain = Object.hasOwn(BUSINESS_DESK_DOMAINS, file) ? BUSINESS_DESK_DOMAINS[file] : original;\n",
          "baseline": "  const rootSource = assertContractReleaseSourceDefinition();\n  const assertActualHeadInput = (file, raw, current, physical = current) => {\n    const original = pin.files.find(row => row.file === file); assert(original, 'Closed actual Afterword source subject');\n    const desk = rootSource.status === 'BOUND' && Object.hasOwn(rootSource.sourceViews, file)\n      && Object.hasOwn(rootSource.sourceViews[file].targets, 'desk') ? rootSource.sourceViews[file] : null;\n    const domain = Object.hasOwn(BUSINESS_DESK_DOMAINS, file) ? BUSINESS_DESK_DOMAINS[file] : original;\n"
        }
      ]
    },
    "test/lib/ux-opening-live-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "0f2c29f2c9c397626be67407b4f66abdfb7a4489",
        "sha256": "0397b2dbc14d0158be3794041570d42b585fc0c18feaf9f824c0c79a97db78a8",
        "bytes": 13189
      },
      "baseline": {
        "mode": "100644",
        "blob": "2373227d64c3d200d5d01fdc4e1704ff030dea1d",
        "sha256": "cadbff7891ae7c8a7e7f322066aa03ef8565a6262a8cb5b89f145a94cc32ce55",
        "bytes": 13039
      },
      "inverses": [
        {
          "at": 213,
          "current": "import path from 'node:path';\nimport { chromium } from 'playwright-core';\nimport { buildServer } from '../server-fixture.js';\nimport { revealOptional } from './ux-disclosure-browser.js';\n\nexport async function runOpeningLiveBrowserProof() {\n  assert(!process.env.DATABASE_URL, 'Opening journey proof requires disposable pg-mem.');\n",
          "baseline": "import path from 'node:path';\nimport { chromium } from 'playwright-core';\nimport { buildServer } from '../server-fixture.js';\n\nexport async function runOpeningLiveBrowserProof() {\n  assert(!process.env.DATABASE_URL, 'Opening journey proof requires disposable pg-mem.');\n"
        },
        {
          "at": 1832,
          "current": "    await page.locator(`#jump-list [data-jump=\"${tab}\"]`).first().click();\n    await page.locator(`#tab-${tab}.on`).waitFor();\n  };\n  const openDetails = async locator => {\n    await revealOptional(locator);\n    if (!await locator.evaluate(node => node.open)) await locator.locator(':scope > summary').click();\n  };\n  const opening = (page, tab) => page.locator(`#tab-${tab} [data-ux-progression=\"opening\"] .ux-opening`);\n  const economy = async id => ({\n    cash: Number((await pool.query('SELECT cash FROM characters WHERE id=$1', [id])).rows[0].cash),\n",
          "baseline": "    await page.locator(`#jump-list [data-jump=\"${tab}\"]`).first().click();\n    await page.locator(`#tab-${tab}.on`).waitFor();\n  };\n  const openDetails = async locator => { if (!await locator.evaluate(node => node.open)) await locator.locator(':scope > summary').click(); };\n  const opening = (page, tab) => page.locator(`#tab-${tab} [data-ux-progression=\"opening\"] .ux-opening`);\n  const economy = async id => ({\n    cash: Number((await pool.query('SELECT cash FROM characters WHERE id=$1', [id])).rows[0].cash),\n"
        },
        {
          "at": 8291,
          "current": "    assert.match(await opening(page, 'empire').locator('.ux-opening-complete').innerText(), /Journey complete/);\n    assert.deepEqual(mutations, ['/v1/crimes/pick', '/v1/assets/beater/buy']);\n    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'The real opening journey fits a 390px phone.');\n    await openDetails(opening(page, 'empire'));\n    await opening(page, 'empire').scrollIntoViewIfNeeded();\n    await page.screenshot({ path: path.join(artifacts, 'opening-complete-mobile.png'), fullPage: false });\n    await opening(page, 'empire').screenshot({ path: path.join(artifacts, 'opening-complete-panel.png') });\n",
          "baseline": "    assert.match(await opening(page, 'empire').locator('.ux-opening-complete').innerText(), /Journey complete/);\n    assert.deepEqual(mutations, ['/v1/crimes/pick', '/v1/assets/beater/buy']);\n    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'The real opening journey fits a 390px phone.');\n    await opening(page, 'empire').scrollIntoViewIfNeeded();\n    await page.screenshot({ path: path.join(artifacts, 'opening-complete-mobile.png'), fullPage: false });\n    await opening(page, 'empire').screenshot({ path: path.join(artifacts, 'opening-complete-panel.png') });\n"
        }
      ]
    },
    "test/migrate.js": {
      "current": {
        "mode": "100644",
        "blob": "35576bd87ce5ad52904ae5fb3ac87b8c8c3c970f",
        "sha256": "f68042c5d074b5afc36b433e1be0ee4dbe004abe2a7009560c78659c0d74424a",
        "bytes": 102284
      },
      "baseline": {
        "mode": "100644",
        "blob": "f4fe85900eceda1a420e2503b6849c6cbea4b005",
        "sha256": "c0490da287e43ae591b91b4fb31171ae56640653244de2d6ac657aae8946cad1",
        "bytes": 102102
      },
      "inverses": [
        {
          "at": 34077,
          "current": "// resolve with a `*:death` burn — deliberately NOT wiped so the frozen field resolves), ledger/log\n// (immutable §10.4/audit/historical rows — intentionally never wiped; a dead id is a valid historical ref).\nconst DISPOSITION = {\n  task_puzzles: 'ledger', // issued constraints and consumed receipts retain the original dead character; current-character lookup grants an heir no completion or recovery authority\n  // Original character/generation-bound consent and private puzzle outcomes are\n  // historical. Room/host lifecycle closes active rounds; heirs never inherit a\n  // member's participation or its private history.\n",
          "baseline": "// resolve with a `*:death` burn — deliberately NOT wiped so the frozen field resolves), ledger/log\n// (immutable §10.4/audit/historical rows — intentionally never wiped; a dead id is a valid historical ref).\nconst DISPOSITION = {\n  // Original character/generation-bound consent and private puzzle outcomes are\n  // historical. Room/host lifecycle closes active rounds; heirs never inherit a\n  // member's participation or its private history.\n"
        }
      ]
    },
    "test/player-intel-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "655d4ed46e5b0ef101a4a1b0e9d3ef7d09adca9e",
        "sha256": "24073ba6a79a28c148e84df670592db28916ae90066f28e635d1326fb7385f72",
        "bytes": 8820
      },
      "baseline": {
        "mode": "100644",
        "blob": "9f31fb5fccd1dc1a0bf099e073fc8e46793e99a2",
        "sha256": "d2afc0551a651f27bc00aad376c62ad08d1b62bb25a25802c6fe5bcb45d87077",
        "bytes": 8557
      },
      "inverses": [
        {
          "at": 3713,
          "current": "  return page;\n};\nconst wetWork = async (page) => {\n  const directory = page.locator('#city-directory');\n  if (!await directory.evaluate(node => node.open)) await directory.locator(':scope > summary').click();\n  await page.locator('#grouprail [data-group=\"blood\"]').click();\n  if (!await directory.evaluate(node => node.open)) await directory.locator(':scope > summary').click();\n  await page.locator('#tabs [data-tab=\"pvp\"]').click();\n  await page.locator('#tab-pvp h2').filter({ hasText: 'People you know' }).waitFor();\n};\n",
          "baseline": "  return page;\n};\nconst wetWork = async (page) => {\n  await page.locator('#grouprail [data-group=\"blood\"]').click();\n  await page.locator('#tabs [data-tab=\"pvp\"]').click();\n  await page.locator('#tab-pvp h2').filter({ hasText: 'People you know' }).waitFor();\n};\n"
        }
      ]
    },
    "test/quest-experience-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "0eaf437ea7bbb7cb2954e1e10910832cf7e4d64b",
        "sha256": "0cee33effbeb473a18960e4c5dcc72b896748fa6695968605de3453d5525f7cc",
        "bytes": 34736
      },
      "baseline": {
        "mode": "100644",
        "blob": "b72ec8946c2e0d54ed1616e53f93c1148e23d868",
        "sha256": "38453a9487242b44d8bf3e3d06f39f00fbc26520939afd85f7b12aa259f90110",
        "bytes": 32695
      },
      "inverses": [
        {
          "at": 10210,
          "current": "  }\n  await page.getByRole('button', { name: 'The family hiding below the pier', exact: true }).click();\n  await page.getByText('Case closed. Your decisions are on the record.', { exact: true }).waitFor();\n  await page.waitForFunction(() => document.querySelector('#ux-quests')?.getAttribute('aria-busy') === 'false');\n  // A refetch may repaint before the browser delivers a details element's deferred toggle event.\n  const disclosureRace = await page.evaluate(async () => {\n    const findTheory = () => [...document.querySelectorAll('#ux-quests details')].find(panel => panel.querySelector(':scope > summary')?.textContent === 'Your working theory');\n    const first = findTheory(), firstToggle = new Promise(resolve => first.addEventListener('toggle', resolve, { once: true }));\n    first.querySelector(':scope > summary').click();\n    questUx.render();\n    const stayedOpen = findTheory().open;\n    await firstToggle;\n    const second = findTheory(), secondToggle = new Promise(resolve => second.addEventListener('toggle', resolve, { once: true }));\n    second.querySelector(':scope > summary').click();\n    questUx.render();\n    const stayedClosed = !findTheory().open;\n    await secondToggle;\n    questUx.render();\n    const remainsClosed = !findTheory().open;\n    const cancelled = findTheory().querySelector(':scope > summary');\n    cancelled.addEventListener('click', event => event.preventDefault(), { once: true });\n    cancelled.click(); questUx.render();\n    return { stayedOpen, stayedClosed, remainsClosed, cancelledClickRemainsClosed: !findTheory().open };\n  });\n  assert.deepEqual(disclosureRace, { stayedOpen: true, stayedClosed: true, remainsClosed: true, cancelledClickRemainsClosed: true }, 'Private-note disclosures retain native open and close choices across a refetch repaint and late detached toggle events.');\n  const theories = page.locator('details').filter({ has: page.locator('summary', { hasText: 'Your working theory' }) }); await disclosure(theories);\n  const theorySummary = theories.locator(':scope > summary');\n  await theorySummary.focus(); await theorySummary.press('Enter');\n  assert.equal(await theories.evaluate(panel => panel.open), false, 'Native keyboard activation closes the disclosure.');\n  await theorySummary.press('Space');\n  assert.equal(await theories.evaluate(panel => panel.open), true, 'Native keyboard activation reopens the disclosure.');\n  await page.getByLabel('Your private working theory', { exact: true }).fill('Only my account should see this <img id=\"quest-xss\">');\n  await page.getByRole('button', { name: 'Save private theory', exact: true }).click();\n  assert.equal(await page.locator('#quest-xss').count(), 0, 'private theories are text, never HTML');\n",
          "baseline": "  }\n  await page.getByRole('button', { name: 'The family hiding below the pier', exact: true }).click();\n  await page.getByText('Case closed. Your decisions are on the record.', { exact: true }).waitFor();\n  const theories = page.locator('details').filter({ has: page.locator('summary', { hasText: 'Your working theory' }) }); await disclosure(theories);\n  await page.getByLabel('Your private working theory', { exact: true }).fill('Only my account should see this <img id=\"quest-xss\">');\n  await page.getByRole('button', { name: 'Save private theory', exact: true }).click();\n  assert.equal(await page.locator('#quest-xss').count(), 0, 'private theories are text, never HTML');\n"
        }
      ]
    },
    "test/quest-quality-source-transfer.js": {
      "current": {
        "mode": "100644",
        "blob": "096674aa0ae82eeea20a447c360fe5b4e87ce2d3",
        "sha256": "509a9b85fc11bf8e2d93ccf0635e3ffd47384f7f79cfb646db558f32f21b5717",
        "bytes": 6642
      },
      "baseline": {
        "mode": "100644",
        "blob": "d58b2951c610f55eeb0581e3dc1e2d0d6aef1f2c",
        "sha256": "4e9f41ce0178a814afb2698fa16b13603e44620403783c2ec2b4d4f6b2da54f5",
        "bytes": 5773
      },
      "inverses": [
        {
          "at": 196,
          "current": "import { execFileSync } from 'node:child_process';\nimport { QUEST_QUALITY_SOURCE as source, qualifyQuestQualitySource,\n  questQualityHistoricalInput, questQualityHistoricalEntry, questQualitySourceDataBytes } from '../tools/quest-quality-source-transfer.js';\nimport { ageRemovalHistoricalRecord } from '../tools/age-removal-source-transfer.js';\n\nconst git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });\nconst sha = text => createHash('sha256').update(text).digest('hex');\n",
          "baseline": "import { execFileSync } from 'node:child_process';\nimport { QUEST_QUALITY_SOURCE as source, qualifyQuestQualitySource,\n  questQualityHistoricalInput, questQualityHistoricalEntry, questQualitySourceDataBytes } from '../tools/quest-quality-source-transfer.js';\n\nconst git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });\nconst sha = text => createHash('sha256').update(text).digest('hex');\n"
        },
        {
          "at": 2110,
          "current": "assert.deepEqual(Object.keys(source.additions), changed('A').filter(file => /\\.(?:js|json|html|css|sql)$/.test(file)));\nassert.equal(fs.readFileSync(new URL('../tools/quest-quality-source-data.js', import.meta.url), 'utf8').replaceAll('\\r\\n', '\\n'), questQualitySourceDataBytes(source));\nfunction actual(file, pin) {\n  const committed = git('show', 'HEAD:' + file), authored = git('show', source.revision + ':' + file);\n  const stat = fs.lstatSync(file), physical = fs.readFileSync(file); assert(stat.isFile() && !stat.isSymbolicLink());\n  const actualEntry = git('ls-tree', 'HEAD', '--', file).trim();\n  const match = actualEntry.match(/^(100644|100755) blob ([a-f0-9]{40})\\t(.+)$/);\n  assert(match && match[3] === file, 'Actual regular Git source qualifies first');\n  assert.equal(blob(committed), match[2], 'Complete actual source bytes equal the raw HEAD blob');\n  const index = git('ls-files', '--stage', '--', file).trim();\n  assert.equal(index, match[1] + ' ' + match[2] + ' 0\\t' + file);\n  assert(physical.equals(Buffer.from(committed)) || physical.equals(Buffer.from(committed.replaceAll('\\n', '\\r\\n'))));\n  const historical = ageRemovalHistoricalRecord(file, { head: { mode: match[1], blob: match[2] }, index,\n    committed: Buffer.from(committed), physical, regular: stat.isFile(), symbolic: stat.isSymbolicLink() });\n  const text = historical.committed.toString('utf8'), raw = historical.physical;\n  assert.equal(text, authored, 'Independently admitted current source reconstructs the unchanged quality source: ' + file);\n  assert.equal(sha(text), pin.sha256); assert.equal(blob(text), pin.blob); assert.equal(Buffer.byteLength(text), pin.bytes);\n  const entry = pin.mode + ' blob ' + pin.blob + '\\t' + file;\n  assert.deepEqual(historical.head, { mode: pin.mode, blob: pin.blob });\n  assert.equal(historical.index, pin.mode + ' ' + pin.blob + ' 0\\t' + file);\n  return { text, raw, entry };\n}\nlet positives = 0, refusals = 0, inverseControls = 0;\n",
          "baseline": "assert.deepEqual(Object.keys(source.additions), changed('A').filter(file => /\\.(?:js|json|html|css|sql)$/.test(file)));\nassert.equal(fs.readFileSync(new URL('../tools/quest-quality-source-data.js', import.meta.url), 'utf8').replaceAll('\\r\\n', '\\n'), questQualitySourceDataBytes(source));\nfunction actual(file, pin) {\n  const text = git('show', 'HEAD:' + file), authored = git('show', source.revision + ':' + file);\n  assert.equal(text, authored, 'Whole reviewed source remains the actual committed source: ' + file);\n  const stat = fs.lstatSync(file), raw = fs.readFileSync(file); assert(stat.isFile() && !stat.isSymbolicLink());\n  assert(raw.equals(Buffer.from(text)) || raw.equals(Buffer.from(text.replaceAll('\\n', '\\r\\n'))));\n  assert.equal(sha(text), pin.sha256); assert.equal(blob(text), pin.blob); assert.equal(Buffer.byteLength(text), pin.bytes);\n  const entry = pin.mode + ' blob ' + pin.blob + '\\t' + file;\n  assert.equal(git('ls-tree', 'HEAD', '--', file).trim(), entry);\n  assert.equal(git('ls-files', '--stage', '--', file).trim(), pin.mode + ' ' + pin.blob + ' 0\\t' + file);\n  return { text, raw, entry };\n}\nlet positives = 0, refusals = 0, inverseControls = 0;\n"
        }
      ]
    },
    "test/rc1-mobile-postgres.js": {
      "current": {
        "mode": "100644",
        "blob": "8e1560f8e29af439a5624862f8f8f2cbab5f3feb",
        "sha256": "66b47f6db39652750c2dcdab579b3ffd7edf9b632046b332122a79676d7a4901",
        "bytes": 10295
      },
      "baseline": {
        "mode": "100644",
        "blob": "4726e44bfcd9fd9328ff784dccec02a78122413d",
        "sha256": "824568d0670bc671349b6dbdea3c3c43054ba9aabf9e3060fa0c6dd35694df5c",
        "bytes": 10479
      },
      "inverses": [
        {
          "at": 2278,
          "current": "    const page = await context.newPage(); activePage = page; page.on('pageerror', (error) => errors.push(error.message));\n    await page.goto(origin, { waitUntil: 'networkidle' });\n    await page.locator('#btn-guest').click();\n    await page.locator('#screen-create:not(.hidden)').waitFor();\n    await page.locator('#new-name').fill(`RC1 Phone ${viewport.width}`);\n    await page.locator('#btn-create').click();\n",
          "baseline": "    const page = await context.newPage(); activePage = page; page.on('pageerror', (error) => errors.push(error.message));\n    await page.goto(origin, { waitUntil: 'networkidle' });\n    await page.locator('#btn-guest').click();\n    await page.locator('#age-date').fill('1990-01-01');\n    await page.getByRole('dialog', { name: 'Your birth date' }).getByRole('button', { name: 'Continue', exact: true }).click();\n    await page.locator('#screen-create:not(.hidden)').waitFor();\n    await page.locator('#new-name').fill(`RC1 Phone ${viewport.width}`);\n    await page.locator('#btn-create').click();\n"
        }
      ]
    },
    "test/routes.js": {
      "current": {
        "mode": "100644",
        "blob": "0bd8918339dcfec1d56922c7972b2e52d6c25a36",
        "sha256": "ccb596eafed44aae68bbf28bcdb2e17b33a32ab6f03c8034b60820fa07729d9d",
        "bytes": 43248
      },
      "baseline": {
        "mode": "100644",
        "blob": "159f3f7b79dbd45feb97344cbf8ac34befc662a0",
        "sha256": "eb2c69365c643c98f835a7dac1212fd06bc7e83638e949b0087ab34cf0f9b2a2",
        "bytes": 43346
      },
      "inverses": [
        {
          "at": 9258,
          "current": "  'GET /v1/deeds/plate/:tokenId': 'STREET DEEDS — the on-chain deed\\'s block-plate SVG, the ERC-721 tokenURI image a marketplace/crawler fetches with no token; the untrusted street name is escaped (the /v1/art precedent)',\n  'POST /v1/auth/guest': 'an auth entry point — there is no token to present yet',\n  'POST /v1/auth/agent': 'permanent agent admission issues the first bearer without a human age check',\n  'POST /v1/access/redeem': 'launch admission authenticates an unused invite and a durable bootstrap credential before creating or recovering an account',\n  'POST /v1/access/logout': 'clears only the caller browser view cookie and grants no account or gameplay authority',\n  'POST /v1/auth/privy': 'an auth entry point — there is no token to present yet',\n",
          "baseline": "  'GET /v1/deeds/plate/:tokenId': 'STREET DEEDS — the on-chain deed\\'s block-plate SVG, the ERC-721 tokenURI image a marketplace/crawler fetches with no token; the untrusted street name is escaped (the /v1/art precedent)',\n  'POST /v1/auth/guest': 'an auth entry point — there is no token to present yet',\n  'POST /v1/auth/agent': 'permanent agent admission issues the first bearer without a human age check',\n  'POST /v1/age-check': 'checks eligibility without saving a birth date before account creation',\n  'POST /v1/access/redeem': 'launch admission authenticates an unused invite and a durable bootstrap credential before creating or recovering an account',\n  'POST /v1/access/logout': 'clears only the caller browser view cookie and grants no account or gameplay authority',\n  'POST /v1/auth/privy': 'an auth entry point — there is no token to present yet',\n"
        }
      ]
    },
    "test/server-fixture.js": {
      "current": {
        "mode": "100644",
        "blob": "0baf22494f6a5138a7973e62de8cc98ebf4daac2",
        "sha256": "418c91a0b19abfb172be6f04f6a8295cea3186f122f3cf031c9fa32afdd7c7c5",
        "bytes": 150
      },
      "baseline": {
        "mode": "100644",
        "blob": "565a699bd4f67a3d248f420a04fe81d41473ae96",
        "sha256": "4d12bb8a43b460e89a93046c31368316e795659879455d9198b5f0b071c478cf",
        "bytes": 1476
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { buildServer as buildRealServer } from '../src/server.js';\n\nexport async function buildServer(...args) {\n  return buildRealServer(...args);\n}\n",
          "baseline": "import { buildServer as buildRealServer } from '../src/server.js';\nimport { adultAuthFixture } from './auth-fixture.js';\n\n// Legacy gameplay suites use synthetic adults. Gate-specific suites import the\n// real server directly, so missing-age and underage assertions remain strict.\nexport async function buildServer(...args) {\n  const app = await buildRealServer(...args);\n  const inject = app.inject.bind(app);\n  app.inject = (options, ...rest) => {\n    if (options && typeof options === 'object') {\n      const method = String(options.method || 'GET').toUpperCase();\n      const url = String(options.url || options.path || '').split('?')[0];\n      const headers = options.headers || {};\n      const emptyJson = options.payload === undefined && Object.entries(headers)\n        .some(([name, value]) => name.toLowerCase() === 'content-type' && String(value).includes('application/json'));\n      if (!emptyJson) {\n        let body = options.payload;\n        const json = typeof body === 'string';\n        let valid = true;\n        if (json) { try { body = JSON.parse(body); } catch { valid = false; } }\n        if (valid && (body === undefined || (body && typeof body === 'object' && !Array.isArray(body) && !Buffer.isBuffer(body)))) {\n          const next = adultAuthFixture(method, url, body);\n          if (next !== body) options = { ...options, payload: json ? JSON.stringify(next) : next };\n        }\n      }\n    }\n    return inject(options, ...rest);\n  };\n  return app;\n}\n"
        }
      ]
    },
    "test/site-basics-source-transfer.js": {
      "current": {
        "mode": "100644",
        "blob": "67b6a544479b7b8117b8dab8532c64171ff68260",
        "sha256": "7b669da70852054c0555441029812beb5d144b65e818f182280da7c0a136558b",
        "bytes": 7461
      },
      "baseline": {
        "mode": "100644",
        "blob": "b47a96027f09c62422eea3cf1bfd14b1c514f32f",
        "sha256": "c0fced0a06476990303e48bfd81777511dc30c5ed288405c276bb94e3ec54583",
        "bytes": 6978
      },
      "inverses": [
        {
          "at": 0,
          "current": "// Actual website Git/index/physical identities qualify before any historical comparison.\nimport './lib/age-removal-source-transfer-proof.js';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport { createHash } from 'node:crypto';\nimport { execFileSync } from 'node:child_process';\nimport { SITE_BASICS_SOURCE as source, qualifySiteBasicsSource,\n  siteBasicsHistoricalInput, siteBasicsHistoricalEntry, siteBasicsSourceDataBytes } from '../tools/site-basics-source-transfer.js';\nimport { ageRemovalHistoricalRecord } from '../tools/age-removal-source-transfer.js';\n\nconst git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], {\n  encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024,\n",
          "baseline": "// Actual website Git/index/physical identities qualify before any historical comparison.\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport { createHash } from 'node:crypto';\nimport { execFileSync } from 'node:child_process';\nimport { SITE_BASICS_SOURCE as source, qualifySiteBasicsSource,\n  siteBasicsHistoricalInput, siteBasicsHistoricalEntry, siteBasicsSourceDataBytes } from '../tools/site-basics-source-transfer.js';\n\nconst git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], {\n  encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024,\n"
        },
        {
          "at": 2498,
          "current": "  siteBasicsSourceDataBytes(source), 'The only self-reference is complete generated data without executable additions');\nlet positives = 0, refusals = 0;\nfunction actual(file, pin) {\n  const actualCommitted = git('show', 'HEAD:' + file), authored = git('show', source.revision + ':' + file);\n  const stat = fs.lstatSync(file), physical = fs.readFileSync(file);\n  assert(stat.isFile() && !stat.isSymbolicLink());\n  assert(physical.equals(Buffer.from(actualCommitted)) || physical.equals(Buffer.from(actualCommitted.replaceAll('\\n', '\\r\\n'))),\n    'Actual whole committed and physical source qualify before historical comparison: ' + file);\n  const actualBlob = createHash('sha1').update('blob ' + Buffer.byteLength(actualCommitted) + '\\0').update(actualCommitted).digest('hex');\n  const actualMode = git('ls-tree', 'HEAD', '--', file).trim().split(' ')[0];\n  const actualIndex = git('ls-files', '--stage', '--', file).trim();\n  assert.equal(actualIndex, actualMode + ' ' + actualBlob + ' 0\\t' + file);\n  const historical = ageRemovalHistoricalRecord(file, { head: { mode: actualMode, blob: actualBlob }, index: actualIndex,\n    committed: Buffer.from(actualCommitted), physical, regular: stat.isFile(), symbolic: stat.isSymbolicLink() });\n  const committed = historical.committed.toString('utf8');\n  assert.equal(historical.head.mode, pin.mode); assert.equal(historical.head.blob, pin.blob);\n  const text = committed, raw = historical.physical;\n  assert.equal(text, authored, 'Whole authored source remains the actual committed source: ' + file);\n  assert.equal(sha(text), pin.sha256); assert.equal(Buffer.byteLength(text), pin.bytes);\n  const entry = pin.mode + ' blob ' + pin.blob + '\\t' + file;\n  assert.equal(historical.index, pin.mode + ' ' + pin.blob + ' 0\\t' + file);\n  assert(raw.equals(Buffer.from(text)) || raw.equals(Buffer.from(text.replaceAll('\\n', '\\r\\n'))),\n    'Complete physical UTF-8 source is uniformly LF/CRLF: ' + file);\n  return { text, raw, entry };\n",
          "baseline": "  siteBasicsSourceDataBytes(source), 'The only self-reference is complete generated data without executable additions');\nlet positives = 0, refusals = 0;\nfunction actual(file, pin) {\n  const committed = git('show', 'HEAD:' + file), authored = git('show', source.revision + ':' + file);\n  const stat = fs.lstatSync(file), physical = fs.readFileSync(file);\n  assert(stat.isFile() && !stat.isSymbolicLink());\n  assert(physical.equals(Buffer.from(committed)) || physical.equals(Buffer.from(committed.replaceAll('\\n', '\\r\\n'))),\n    'Actual whole committed and physical source qualify before historical comparison: ' + file);\n  const actualBlob = createHash('sha1').update('blob ' + Buffer.byteLength(committed) + '\\0').update(committed).digest('hex');\n  assert.equal(git('ls-tree', 'HEAD', '--', file).trim(), pin.mode + ' blob ' + actualBlob + '\\t' + file);\n  assert.equal(git('ls-files', '--stage', '--', file).trim(), pin.mode + ' ' + actualBlob + ' 0\\t' + file);\n  const text = committed, raw = physical;\n  assert.equal(text, authored, 'Whole authored source remains the actual committed source: ' + file);\n  assert.equal(sha(text), pin.sha256); assert.equal(Buffer.byteLength(text), pin.bytes);\n  const entry = pin.mode + ' blob ' + pin.blob + '\\t' + file;\n  assert.equal(git('ls-tree', 'HEAD', '--', file).trim(), entry);\n  assert.equal(git('ls-files', '--stage', '--', file).trim(), pin.mode + ' ' + pin.blob + ' 0\\t' + file);\n  assert(raw.equals(Buffer.from(text)) || raw.equals(Buffer.from(text.replaceAll('\\n', '\\r\\n'))),\n    'Complete physical UTF-8 source is uniformly LF/CRLF: ' + file);\n  return { text, raw, entry };\n"
        }
      ]
    },
    "test/site-entry-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "86d198f6e335f939136afd504a47f63877bd7425",
        "sha256": "fd27757c736bd2a4175a90a0842fd114771bb8aad9c8b2c256c33b6bb728045d",
        "bytes": 5789
      },
      "baseline": {
        "mode": "100644",
        "blob": "e6d5dccd8a4093fcc2e78fbd819c8d8477cf51cd",
        "sha256": "d6fd1af7aecd96a8eaded9e542cad5beec22501cda8a183f9de284e76bf542a6",
        "bytes": 6296
      },
      "inverses": [
        {
          "at": 2760,
          "current": "  }\n\n  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });\n  await page.addInitScript(() => sessionStorage.setItem('omerta_age_blocked', '1'));\n  await page.context().addCookies([{\n    name: 'omerta_age', value: app.jwt.sign({ purpose: 'age-check', eligible: false }),\n    url: base, httpOnly: true, sameSite: 'Lax',\n  }]);\n  const faults = [];\n  page.on('pageerror', error => faults.push(error.message));\n  let guestRequests = 0, releaseRequest;\n",
          "baseline": "  }\n\n  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });\n  const faults = [];\n  page.on('pageerror', error => faults.push(error.message));\n  let guestRequests = 0, releaseRequest;\n"
        },
        {
          "at": 3590,
          "current": "  await page.goto(base, { waitUntil: 'domcontentloaded' });\n  const primary = page.locator('#btn-guest');\n  await primary.click();\n  assert.equal(await page.locator('#age-date, input[name=\"birthDate\"]').count(), 0, 'Signup has no age-verification prompt.');\n  await page.waitForFunction(() => document.querySelector('#guest-status').textContent.includes('Opening your street'));\n  assert.equal(await primary.isDisabled(), true, 'The primary signup action stays disabled while waiting.');\n  assert.equal(await page.locator('#btn-guest2').isDisabled(), true, 'The secondary signup action shares the pending state.');\n",
          "baseline": "  await page.goto(base, { waitUntil: 'domcontentloaded' });\n  const primary = page.locator('#btn-guest');\n  await primary.click();\n  await page.locator('#age-date').waitFor();\n  assert.equal(await primary.isDisabled(), true, 'Eligibility checking shares the signup pending state.');\n  await page.evaluate(() => document.querySelector('#btn-guest2').dispatchEvent(new MouseEvent('click', { bubbles: true })));\n  assert.equal(await page.locator('dialog[open] #age-date').count(), 1, 'Repeated activations do not open duplicate eligibility dialogs.');\n  await page.locator('#age-cancel').click();\n  await page.waitForFunction(() => !document.querySelector('#btn-guest').disabled);\n  assert.equal(guestRequests, 0, 'Cancelling eligibility never attempts account creation.');\n  assert.equal(await page.locator('#guest-status').isHidden(), true, 'Cancelling eligibility clears progress feedback.');\n  await primary.click();\n  await page.locator('#age-date').fill('1990-01-01');\n  await page.locator('dialog[open] button[type=\"submit\"]').click();\n  await page.waitForFunction(() => document.querySelector('#guest-status').textContent.includes('Opening your street'));\n  assert.equal(await primary.isDisabled(), true, 'The primary signup action stays disabled while waiting.');\n  assert.equal(await page.locator('#btn-guest2').isDisabled(), true, 'The secondary signup action shares the pending state.');\n"
        },
        {
          "at": 5026,
          "current": "  await page.locator('#screen-create:not(.hidden)').waitFor();\n  await page.waitForFunction(() => !document.querySelector('#btn-guest').disabled);\n  assert.equal(await page.locator('#guest-status').isHidden(), true, 'A successful signup clears progress feedback.');\n  assert.ok(await page.evaluate(() => localStorage.getItem('omerta_token')), 'Signup ignores legacy age-denial state and preserves the session before character creation.');\n  assert.deepEqual(faults, [], 'Signup produces no browser exceptions.');\n  await page.close();\n  console.log('Site entry: desktop/mobile CTA visibility, image labels, direct signup, progress, duplicate prevention, failure recovery and successful signup passed.');\n} finally { await browser?.close(); await app.close(); }\n",
          "baseline": "  await page.locator('#screen-create:not(.hidden)').waitFor();\n  await page.waitForFunction(() => !document.querySelector('#btn-guest').disabled);\n  assert.equal(await page.locator('#guest-status').isHidden(), true, 'A successful signup clears progress feedback.');\n  assert.ok(await page.evaluate(() => localStorage.getItem('omerta_token')), 'Signup preserves the session before opening character creation.');\n  assert.deepEqual(faults, [], 'Signup produces no browser exceptions.');\n  await page.close();\n  console.log('Site entry: desktop/mobile CTA visibility, image labels, eligibility cancellation, signup progress, duplicate prevention, failure recovery and successful signup passed.');\n} finally { await browser?.close(); await app.close(); }\n"
        }
      ]
    },
    "test/ux-community-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "bc9285451b8c3ca9cb6e5a5a6136b41c6c4b2966",
        "sha256": "47a9419a3e51afc8ea8dedbb132ce8a200a32b02d4be5e89e8812ce8f6ce6674",
        "bytes": 29656
      },
      "baseline": {
        "mode": "100644",
        "blob": "d94ad5b89ae6f7ebc6857a8e07289d0cf5d73a59",
        "sha256": "b116725c5683eb044a1b51cc0d2cd33ac72fc656d197c19699e91a4470d91db7",
        "bytes": 29507
      },
      "inverses": [
        {
          "at": 93,
          "current": "import path from 'node:path';\nimport { chromium } from 'playwright-core';\nimport { buildServer } from './server-fixture.js';\nimport { revealOptional } from './lib/ux-disclosure-browser.js';\nimport { MENTOR } from '../src/rules.js';\n\nif (process.env.DATABASE_URL) throw new Error('Community browser checks require disposable pg-mem.');\n",
          "baseline": "import path from 'node:path';\nimport { chromium } from 'playwright-core';\nimport { buildServer } from './server-fixture.js';\nimport { MENTOR } from '../src/rules.js';\n\nif (process.env.DATABASE_URL) throw new Error('Community browser checks require disposable pg-mem.');\n"
        },
        {
          "at": 1172,
          "current": "const create = async (name) => { const { token } = await api('POST', '/v1/auth/guest'); await api('POST', '/v1/character', token, { name }); return { token, ch: (await pool.query('SELECT * FROM characters WHERE name=$1', [name])).rows[0] }; };\nconst ready = (page) => page.waitForFunction(() => !document.querySelector('#operation-desk[aria-busy=true]'));\nconst openTab = async (page, tab) => { await page.locator('#btn-jump').click(); await page.locator('#jump-q').fill(tab); await page.locator(`#jump-list [data-jump=\"${tab}\"]`).click(); await page.locator(`#tab-${tab}.on`).waitFor(); };\nconst openForm = async (page, type, subject = '') => { const f = page.locator(`form[data-community-form=\"${type}\"][data-subject=\"${subject}\"]`); await revealOptional(f); for (const parent of await f.locator('xpath=ancestor::details').all()) if (!await parent.evaluate((n) => n.open)) await parent.locator(':scope > summary').click(); return f; };\nconst submit = async (page, type, values, subject = '', expected = 200) => {\n const f = await openForm(page, type, subject);\n for (const [name, value] of Object.entries(values)) {\n",
          "baseline": "const create = async (name) => { const { token } = await api('POST', '/v1/auth/guest'); await api('POST', '/v1/character', token, { name }); return { token, ch: (await pool.query('SELECT * FROM characters WHERE name=$1', [name])).rows[0] }; };\nconst ready = (page) => page.waitForFunction(() => !document.querySelector('#operation-desk[aria-busy=true]'));\nconst openTab = async (page, tab) => { await page.locator('#btn-jump').click(); await page.locator('#jump-q').fill(tab); await page.locator(`#jump-list [data-jump=\"${tab}\"]`).click(); await page.locator(`#tab-${tab}.on`).waitFor(); };\nconst openForm = async (page, type, subject = '') => { const f = page.locator(`form[data-community-form=\"${type}\"][data-subject=\"${subject}\"]`); for (const parent of await f.locator('xpath=ancestor::details').all()) if (!await parent.evaluate((n) => n.open)) await parent.locator(':scope > summary').click(); return f; };\nconst submit = async (page, type, values, subject = '', expected = 200) => {\n const f = await openForm(page, type, subject);\n for (const [name, value] of Object.entries(values)) {\n"
        },
        {
          "at": 6359,
          "current": "  const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'warning' && /UI .*unavailable/.test(m.text())) errors.push(m.text()); });\n  await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.locator('#screen-main:not(.hidden)').waitFor();\n  await page.evaluate(() => document.querySelectorAll('.modal-bg:not(.hidden)').forEach((n) => n.classList.add('hidden')));\n  await openTab(page, 'crew'); await revealOptional(page.locator('#ux-community')); if (noCrew) await page.locator('#ux-community [data-community-empty]').waitFor(); else await page.locator('#crew-room').waitFor(); await page.locator('#ux-community h3').waitFor(); return page;\n };\n const newcomer = await create('Culture Newcomer'), newcomerPage = await authenticate(newcomer, true);\n const newcomerRead = newcomerPage.waitForResponse((r) => r.url().endsWith(route) && r.request().method() === 'GET'); await newcomerPage.locator('[data-community-refresh]').click();\n",
          "baseline": "  const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'warning' && /UI .*unavailable/.test(m.text())) errors.push(m.text()); });\n  await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.locator('#screen-main:not(.hidden)').waitFor();\n  await page.evaluate(() => document.querySelectorAll('.modal-bg:not(.hidden)').forEach((n) => n.classList.add('hidden')));\n  await openTab(page, 'crew'); if (noCrew) await page.locator('#ux-community [data-community-empty]').waitFor(); else await page.locator('#crew-room').waitFor(); await page.locator('#ux-community h3').waitFor(); return page;\n };\n const newcomer = await create('Culture Newcomer'), newcomerPage = await authenticate(newcomer, true);\n const newcomerRead = newcomerPage.waitForResponse((r) => r.url().endsWith(route) && r.request().method() === 'GET'); await newcomerPage.locator('[data-community-refresh]').click();\n"
        },
        {
          "at": 14395,
          "current": " await page.waitForFunction(() => document.querySelector('form[data-community-form=manual] [name=body0]')?.value === 'A newer revision from the crew.');\n await page.locator('#ux-community details').filter({ has: page.locator(':scope > summary', { hasText: 'Crew map planning pins' }) }).first().locator(':scope > summary').click();\n await submit(page, 'pin', { title: 'Meet by the public canal', destinationId: 'canal', note: 'A crew planning destination, not a player sighting.', spoiler: false });\n await page.locator('[data-community-map]').click(); await revealOptional(page.locator('#ux-community-pins'));\n assert.match(await page.locator('#ux-community-pins').innerText(), /Meet by the public canal/);\n await page.setViewportSize({ width: 390, height: 844 });\n assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));\n",
          "baseline": " await page.waitForFunction(() => document.querySelector('form[data-community-form=manual] [name=body0]')?.value === 'A newer revision from the crew.');\n await page.locator('#ux-community details').filter({ has: page.locator(':scope > summary', { hasText: 'Crew map planning pins' }) }).first().locator(':scope > summary').click();\n await submit(page, 'pin', { title: 'Meet by the public canal', destinationId: 'canal', note: 'A crew planning destination, not a player sighting.', spoiler: false });\n await page.locator('[data-community-map]').click(); await page.locator('#ux-community-pins').waitFor();\n assert.match(await page.locator('#ux-community-pins').innerText(), /Meet by the public canal/);\n await page.setViewportSize({ width: 390, height: 844 });\n assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));\n"
        }
      ]
    },
    "test/ux-coordination-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "6ddae0f717a85e3cf4db8745d0e97a7e9617f4ee",
        "sha256": "eb79dd4c1a991b63423a14a240ac89e44d3a2480b476519015130cb3f0e2e428",
        "bytes": 23285
      },
      "baseline": {
        "mode": "100644",
        "blob": "4cdf1530f4ef5dd7871358ee44c490f91ef4c167",
        "sha256": "dcd38c02c1f5e558acd11d09bea95f52ab0da7ee335fcbd7c3a06013261122d0",
        "bytes": 23164
      },
      "inverses": [
        {
          "at": 93,
          "current": "import path from 'node:path';\nimport { chromium } from 'playwright-core';\nimport { buildServer } from './server-fixture.js';\nimport { revealOptional } from './lib/ux-disclosure-browser.js';\n\nif (process.env.DATABASE_URL) throw new Error('Crew planning browser tests require disposable pg-mem.');\nconst executablePath = process.env.CHROMIUM_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p));\n",
          "baseline": "import path from 'node:path';\nimport { chromium } from 'playwright-core';\nimport { buildServer } from './server-fixture.js';\n\nif (process.env.DATABASE_URL) throw new Error('Crew planning browser tests require disposable pg-mem.');\nconst executablePath = process.env.CHROMIUM_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p));\n"
        },
        {
          "at": 1502,
          "current": "  const refreshed = member ? page.waitForResponse((response) => new URL(response.url()).pathname === '/v1/crew/chat' && response.request().method() === 'GET') : null;\n  await page.locator('#btn-jump').click(); await page.locator('#jump-q').fill('crew'); await page.locator('#jump-list [data-jump=\"crew\"]').click();\n  if (refreshed) await (await refreshed).finished();\n  await page.locator(member ? '#crew-room' : '#crew-form').waitFor(); await revealOptional(page.locator('#ux-coordination')); await page.locator(member ? '#ux-coordination [data-coord-scope]' : '#ux-coordination [data-coord-join]').waitFor();\n};\nconst ready = (page) => page.waitForFunction(() => !document.querySelector('#operation-desk[aria-busy=true]'));\nconst submit = async (page, type, values) => {\n",
          "baseline": "  const refreshed = member ? page.waitForResponse((response) => new URL(response.url()).pathname === '/v1/crew/chat' && response.request().method() === 'GET') : null;\n  await page.locator('#btn-jump').click(); await page.locator('#jump-q').fill('crew'); await page.locator('#jump-list [data-jump=\"crew\"]').click();\n  if (refreshed) await (await refreshed).finished();\n  await page.locator(member ? '#crew-room' : '#crew-form').waitFor(); await page.locator(member ? '#ux-coordination [data-coord-scope]' : '#ux-coordination [data-coord-join]').waitFor();\n};\nconst ready = (page) => page.waitForFunction(() => !document.querySelector('#operation-desk[aria-busy=true]'));\nconst submit = async (page, type, values) => {\n"
        }
      ]
    },
    "test/ux-expanded-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "1ca17c4caea63daee8c1817113f6ae87c6062491",
        "sha256": "41a2d2899fe5bae4bc5663407c7f542fb51535fb190ec60c9e0be987ed3c2040",
        "bytes": 24004
      },
      "baseline": {
        "mode": "100644",
        "blob": "8b2a02b7724aacad6c073a6828c17444a875be0e",
        "sha256": "89b2f4eca2d592e2c11349e5e331ca3d394913cada5d84f7d88fa077a81a8540",
        "bytes": 23367
      },
      "inverses": [
        {
          "at": 218,
          "current": "import { randomUUID } from 'node:crypto';\nimport { chromium } from 'playwright-core';\nimport { buildServer } from './server-fixture.js';\nimport { revealOptional } from './lib/ux-disclosure-browser.js';\nimport { MEGAPROJECT } from '../src/rules.js';\nimport { recordEventResult } from '../src/events.js';\nassert(!process.env.DATABASE_URL, 'Expanded UX browser checks require disposable pg-mem.');\n",
          "baseline": "import { randomUUID } from 'node:crypto';\nimport { chromium } from 'playwright-core';\nimport { buildServer } from './server-fixture.js';\nimport { MEGAPROJECT } from '../src/rules.js';\nimport { recordEventResult } from '../src/events.js';\nassert(!process.env.DATABASE_URL, 'Expanded UX browser checks require disposable pg-mem.');\n"
        },
        {
          "at": 8816,
          "current": "\n  await jump(page, 'fieldwork'); await page.locator('.world-fieldwork').waitFor();\n  await page.locator('[data-fieldwork-view=\"mysteries\"]').click();\n  await revealOptional(page.locator('.investigation-reading-desk'));\n  await page.locator('.investigation-workspace').waitFor(); await page.locator('.investigation-speaker').first().waitFor();\n  await page.getByLabel('Pin a found clue', { exact: true }).selectOption('evidence:neighborhood-timing');\n  await page.locator('.investigation-pin').waitFor();\n",
          "baseline": "\n  await jump(page, 'fieldwork'); await page.locator('.world-fieldwork').waitFor();\n  await page.locator('[data-fieldwork-view=\"mysteries\"]').click();\n  await page.locator('.investigation-workspace').waitFor(); await page.locator('.investigation-speaker').first().waitFor();\n  await page.getByLabel('Pin a found clue', { exact: true }).selectOption('evidence:neighborhood-timing');\n  await page.locator('.investigation-pin').waitFor();\n"
        },
        {
          "at": 9637,
          "current": "  await page.locator('dialog.investigation-inspector').getByRole('button', { name: 'Close inspection', exact: true }).click();\n  assert.deepEqual(gameWrites, [], 'opening and arranging the private case does not execute a game action');\n\n  await jump(page, 'crew'); await revealOptional(page.locator('#ux-coordination')); await page.locator('#ux-coordination [data-coord-scope]').waitFor();\n  assert.match(await page.locator('#ux-coordination').innerText(), /Expanded Planning Crew/);\n  const planForm = page.locator('#ux-coordination form[data-coord-form=\"plan\"]'); await disclosure(planForm.locator('..'));\n  await planForm.locator('[name=\"title\"]').fill('Expanded integration plan'); await planForm.locator('[name=\"nextStep\"]').fill('Review the journal together.');\n",
          "baseline": "  await page.locator('dialog.investigation-inspector').getByRole('button', { name: 'Close inspection', exact: true }).click();\n  assert.deepEqual(gameWrites, [], 'opening and arranging the private case does not execute a game action');\n\n  await jump(page, 'crew'); await page.locator('#ux-coordination [data-coord-scope]').waitFor();\n  assert.match(await page.locator('#ux-coordination').innerText(), /Expanded Planning Crew/);\n  const planForm = page.locator('#ux-coordination form[data-coord-form=\"plan\"]'); await disclosure(planForm.locator('..'));\n  await planForm.locator('[name=\"title\"]').fill('Expanded integration plan'); await planForm.locator('[name=\"nextStep\"]').fill('Review the journal together.');\n"
        },
        {
          "at": 10756,
          "current": "  assert.equal((await api('GET', '/v1/ux/crew-workspace', mate.token)).notes.some(note => note.data.title === 'Expanded integration plan'), true, 'the actual teammate sees the saved planning note');\n\n  await jump(page, 'start'); await page.locator('#tab-start .ux-world-panel').waitFor();\n  await jump(page, 'city'); await revealOptional(page.locator('#tab-city .ux-world-panel')); await page.locator('#tab-city .ux-turf-sign').filter({ hasText: 'EXPD' }).waitFor();\n  const liveMap = await api('GET', '/v1/map', player.token), docks = liveMap.districts.find(district => district.id === 'docks');\n  assert.equal(docks.holder.tag, 'EXPD');\n  assert.match(await page.locator('#tab-city .ux-district-scene').filter({ hasText: 'Turf held by EXPD' }).innerText(), /EXPD/);\n",
          "baseline": "  assert.equal((await api('GET', '/v1/ux/crew-workspace', mate.token)).notes.some(note => note.data.title === 'Expanded integration plan'), true, 'the actual teammate sees the saved planning note');\n\n  await jump(page, 'start'); await page.locator('#tab-start .ux-world-panel').waitFor();\n  await jump(page, 'city'); await page.locator('#tab-city .ux-turf-sign').filter({ hasText: 'EXPD' }).waitFor();\n  const liveMap = await api('GET', '/v1/map', player.token), docks = liveMap.districts.find(district => district.id === 'docks');\n  assert.equal(docks.holder.tag, 'EXPD');\n  assert.match(await page.locator('#tab-city .ux-district-scene').filter({ hasText: 'Turf held by EXPD' }).innerText(), /EXPD/);\n"
        },
        {
          "at": 12483,
          "current": "  await headline.locator('[data-world-go=\"boxing\"]').click(); await page.locator('#tab-boxing.on').waitFor();\n\n  await jump(page, 'life'); await page.locator('#tab-life [data-uwgift=\"doc\"]').waitFor();\n  await revealOptional(page.locator('#tab-life .ux-world-panel'));\n  const oldStanding = (await api('GET', '/v1/underworld', player.token)).npcs.find(npc => npc.id === 'doc').standing;\n  const giftResponse = page.waitForResponse(reply => reply.url().endsWith('/v1/underworld/doc/gift') && reply.request().method() === 'POST');\n  const giftBoardSettled = page.waitForResponse(reply => reply.url().endsWith('/v1/season/recap') && reply.status() === 200);\n",
          "baseline": "  await headline.locator('[data-world-go=\"boxing\"]').click(); await page.locator('#tab-boxing.on').waitFor();\n\n  await jump(page, 'life'); await page.locator('#tab-life [data-uwgift=\"doc\"]').waitFor();\n  const oldStanding = (await api('GET', '/v1/underworld', player.token)).npcs.find(npc => npc.id === 'doc').standing;\n  const giftResponse = page.waitForResponse(reply => reply.url().endsWith('/v1/underworld/doc/gift') && reply.request().method() === 'POST');\n  const giftBoardSettled = page.waitForResponse(reply => reply.url().endsWith('/v1/season/recap') && reply.status() === 200);\n"
        },
        {
          "at": 15703,
          "current": "  }, comfortableSize);\n  const largeSize = await largeFont.jsonValue(); await largeFont.dispose();\n  assert.ok(largeSize > comfortableSize, 'large reading mode changes visible typography');\n  await disclosure(page.locator('#city-directory'));\n  await page.locator('[data-ux-focus]').click(); assert.equal(await page.locator('#leftcol').isVisible(), false, 'focus mode visibly removes the side column');\n  assert.match(await page.locator('#ux-focus-vitals').innerText(), /Health.*nerve/);\n  await page.locator('[data-ux-focus]').click(); assert.equal(await page.locator('#leftcol').isVisible(), true);\n",
          "baseline": "  }, comfortableSize);\n  const largeSize = await largeFont.jsonValue(); await largeFont.dispose();\n  assert.ok(largeSize > comfortableSize, 'large reading mode changes visible typography');\n  await page.locator('[data-ux-focus]').click(); assert.equal(await page.locator('#leftcol').isVisible(), false, 'focus mode visibly removes the side column');\n  assert.match(await page.locator('#ux-focus-vitals').innerText(), /Health.*nerve/);\n  await page.locator('[data-ux-focus]').click(); assert.equal(await page.locator('#leftcol').isVisible(), true);\n"
        },
        {
          "at": 17089,
          "current": "  assert.notEqual(await page.evaluate(() => [...originalWorldParent.children].indexOf(originalWorldPanel)), await page.evaluate(() => worldIndex), 'keyboard Up visibly changes panel order');\n  await page.evaluate(() => { window.originalTacticsPanel = document.querySelector('#tab-life > [data-ux-tactics]'); window.originalGiftControl = document.querySelector('#tab-life [data-uwgift=\"doc\"]'); });\n  const orderOfPanels = () => page.evaluate(() => [...document.querySelector('#tab-life').children].filter(node => node.dataset.uxPanel).map(node => node.dataset.uxPanel));\n  await disclosure(page.locator('#tab-life > [data-ux-tactics]'));\n  const beforeDrag = await orderOfPanels();\n  const dragHandle = page.locator('#tab-life > .ux-world-panel > .ux-panel-handle'), targetHandle = page.locator('#tab-life > [data-ux-tactics] > .ux-panel-handle');\n  await dragHandle.dragTo(targetHandle);\n",
          "baseline": "  assert.notEqual(await page.evaluate(() => [...originalWorldParent.children].indexOf(originalWorldPanel)), await page.evaluate(() => worldIndex), 'keyboard Up visibly changes panel order');\n  await page.evaluate(() => { window.originalTacticsPanel = document.querySelector('#tab-life > [data-ux-tactics]'); window.originalGiftControl = document.querySelector('#tab-life [data-uwgift=\"doc\"]'); });\n  const orderOfPanels = () => page.evaluate(() => [...document.querySelector('#tab-life').children].filter(node => node.dataset.uxPanel).map(node => node.dataset.uxPanel));\n  const beforeDrag = await orderOfPanels();\n  const dragHandle = page.locator('#tab-life > .ux-world-panel > .ux-panel-handle'), targetHandle = page.locator('#tab-life > [data-ux-tactics] > .ux-panel-handle');\n  await dragHandle.dragTo(targetHandle);\n"
        },
        {
          "at": 21025,
          "current": "    await fresh.screenshot({ path: path.join(artifacts, 'expanded-fresh-device-failure.png'), fullPage: false }); throw error;\n  }\n  assert.equal(await fresh.locator('select[data-ux-density]').inputValue(), 'large', 'the visible preference control matches the hydrated typography');\n  await jump(fresh, 'fieldwork'); await fresh.locator('[data-fieldwork-view=\"mysteries\"]').click(); await revealOptional(fresh.locator('.investigation-reading-desk')); await fresh.locator('.investigation-pin').waitFor();\n  assert.match(await fresh.locator('.investigation-pin').first().innerText(), /Stopped Workshop Clock/, 'private workspace pins hydrate on a fresh device');\n  const otherPage = await authenticate(other); assert.equal(await otherPage.locator('body').getAttribute('data-ux-density'), 'comfortable');\n  await jump(otherPage, 'crew'); await otherPage.locator('#tab-crew.on').waitFor();\n",
          "baseline": "    await fresh.screenshot({ path: path.join(artifacts, 'expanded-fresh-device-failure.png'), fullPage: false }); throw error;\n  }\n  assert.equal(await fresh.locator('select[data-ux-density]').inputValue(), 'large', 'the visible preference control matches the hydrated typography');\n  await jump(fresh, 'fieldwork'); await fresh.locator('[data-fieldwork-view=\"mysteries\"]').click(); await fresh.locator('.investigation-pin').waitFor();\n  assert.match(await fresh.locator('.investigation-pin').first().innerText(), /Stopped Workshop Clock/, 'private workspace pins hydrate on a fresh device');\n  const otherPage = await authenticate(other); assert.equal(await otherPage.locator('body').getAttribute('data-ux-density'), 'comfortable');\n  await jump(otherPage, 'crew'); await otherPage.locator('#tab-crew.on').waitFor();\n"
        },
        {
          "at": 22078,
          "current": "  assert.equal((await api('GET', '/v1/ux/workspace', other.token)).values.investigation?.['neighborhood-initiation'], undefined, 'private deduction workspace is account-isolated');\n  const mobile = await authenticate(player, true); await mobile.waitForFunction(() => document.body.dataset.uxDensity === 'large');\n  assert.equal(await mobile.locator('select[data-ux-density]').inputValue(), 'large');\n  await jump(mobile, 'fieldwork'); await mobile.locator('[data-fieldwork-view=\"mysteries\"]').click(); await revealOptional(mobile.locator('.investigation-reading-desk')); await mobile.locator('.investigation-workspace').waitFor();\n  await noOverflow(mobile, 'mobile investigation'); await disclosure(mobile.locator('.investigation-scene')); await mobile.locator('.investigation-desk-object').first().click();\n  await mobile.locator('dialog.investigation-inspector[open]').waitFor(); await noOverflow(mobile, 'mobile document dialog');\n  await mobile.screenshot({ path: path.join(artifacts, 'expanded-investigation-mobile.png'), fullPage: false });\n  await mobile.locator('dialog.investigation-inspector').getByRole('button', { name: 'Close inspection', exact: true }).click();\n  await jump(mobile, 'crew'); await revealOptional(mobile.locator('#ux-coordination')); await mobile.locator('#ux-coordination [data-coord-scope]').waitFor(); await noOverflow(mobile, 'mobile crew coordination');\n  await mobile.locator('#ux-coordination').evaluate(node => node.scrollIntoView({ block: 'start' }));\n  await mobile.screenshot({ path: path.join(artifacts, 'expanded-coordination-mobile.png'), fullPage: false });\n  assert.deepEqual(faults, [], 'the actual page has no runtime errors or unavailable UX module warnings');\n",
          "baseline": "  assert.equal((await api('GET', '/v1/ux/workspace', other.token)).values.investigation?.['neighborhood-initiation'], undefined, 'private deduction workspace is account-isolated');\n  const mobile = await authenticate(player, true); await mobile.waitForFunction(() => document.body.dataset.uxDensity === 'large');\n  assert.equal(await mobile.locator('select[data-ux-density]').inputValue(), 'large');\n  await jump(mobile, 'fieldwork'); await mobile.locator('[data-fieldwork-view=\"mysteries\"]').click(); await mobile.locator('.investigation-workspace').waitFor();\n  await noOverflow(mobile, 'mobile investigation'); await disclosure(mobile.locator('.investigation-scene')); await mobile.locator('.investigation-desk-object').first().click();\n  await mobile.locator('dialog.investigation-inspector[open]').waitFor(); await noOverflow(mobile, 'mobile document dialog');\n  await mobile.screenshot({ path: path.join(artifacts, 'expanded-investigation-mobile.png'), fullPage: false });\n  await mobile.locator('dialog.investigation-inspector').getByRole('button', { name: 'Close inspection', exact: true }).click();\n  await jump(mobile, 'crew'); await mobile.locator('#ux-coordination [data-coord-scope]').waitFor(); await noOverflow(mobile, 'mobile crew coordination');\n  await mobile.locator('#ux-coordination').evaluate(node => node.scrollIntoView({ block: 'start' }));\n  await mobile.screenshot({ path: path.join(artifacts, 'expanded-coordination-mobile.png'), fullPage: false });\n  assert.deepEqual(faults, [], 'the actual page has no runtime errors or unavailable UX module warnings');\n"
        }
      ]
    },
    "test/ux-experience-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "9bbbb788912025a9ee869d2598f498633d7167ab",
        "sha256": "c45f3029c5c0493a487aee925fb49c71b1b87fa5a4d48b7e7e3b4d140b67f884",
        "bytes": 13205
      },
      "baseline": {
        "mode": "100644",
        "blob": "2fe0ffd4e38a04ab6100f89fa0dd51e4faa94911",
        "sha256": "b0d83eb587c4bed0f5e0d7b8d6c73657b3bec4ad37ceaa7555062798be6d0c5b",
        "bytes": 12984
      },
      "inverses": [
        {
          "at": 163,
          "current": "import path from 'node:path';\nimport { chromium } from 'playwright-core';\nimport { buildServer } from './server-fixture.js';\nimport { revealOptional } from './lib/ux-disclosure-browser.js';\nimport { masteryXpFor } from '../src/rules.js';\n\nif (process.env.DATABASE_URL) throw new Error('UX browser integration requires the disposable in-memory database.');\n",
          "baseline": "import path from 'node:path';\nimport { chromium } from 'playwright-core';\nimport { buildServer } from './server-fixture.js';\nimport { masteryXpFor } from '../src/rules.js';\n\nif (process.env.DATABASE_URL) throw new Error('UX browser integration requires the disposable in-memory database.');\n"
        },
        {
          "at": 5594,
          "current": "  await page.locator('[data-ux-search]').waitFor();\n  assert.equal(await page.evaluate(() => ['createOmertaFeedback', 'createOmertaProgression', 'createOmertaSocial', 'createOmertaNavigation'].every((name) => typeof window[name] === 'function')), true);\n  await openTab(page, 'life');\n  await revealOptional(page.locator('#tab-life [data-ux-progression=\"life\"]'));\n  const goal = page.locator('#tab-life select[aria-label=\"Choose your next achievement\"]');\n  await goal.waitFor(); await goal.selectOption('trade:larceny');\n  await openDisclosure(page, '#city-directory');\n  await openDisclosure(page, '#character-sheet');\n  await page.locator('#sheet-body .ux-goal-card strong').filter({ hasText: 'Larceny' }).waitFor();\n  await openTab(page, 'streets');\n",
          "baseline": "  await page.locator('[data-ux-search]').waitFor();\n  assert.equal(await page.evaluate(() => ['createOmertaFeedback', 'createOmertaProgression', 'createOmertaSocial', 'createOmertaNavigation'].every((name) => typeof window[name] === 'function')), true);\n  await openTab(page, 'life');\n  const goal = page.locator('#tab-life select[aria-label=\"Choose your next achievement\"]');\n  await goal.waitFor(); await goal.selectOption('trade:larceny');\n  await openDisclosure(page, '#character-sheet');\n  await page.locator('#sheet-body .ux-goal-card strong').filter({ hasText: 'Larceny' }).waitFor();\n  await openTab(page, 'streets');\n"
        },
        {
          "at": 11324,
          "current": "  });\n  const pocket = await pocketReady.jsonValue();\n  assert.equal(pocket.terms, 1); assert.equal(pocket.rows, 1); assert.equal(pocket.matchingTerms, 1, 'mobile reuses the original action and cost terms once');\n  assert.ok(pocket.bottom <= pocket.barTop + 2 && pocket.z < 20, `mobile action controls remain above bottom navigation and below dialogs: ${JSON.stringify(pocket)}`);\n  await noOverflow(page, 'mobile active operation');\n  await page.screenshot({ path: path.join(artifacts, 'ux-action-mobile.png'), fullPage: false });\n  // Change account in the same browser store: preferences keyed by account cannot carry over.\n",
          "baseline": "  });\n  const pocket = await pocketReady.jsonValue();\n  assert.equal(pocket.terms, 1); assert.equal(pocket.rows, 1); assert.equal(pocket.matchingTerms, 1, 'mobile reuses the original action and cost terms once');\n  assert.ok(pocket.bottom <= pocket.barTop + 2 && pocket.z < 20, 'mobile action controls remain above bottom navigation and below dialogs');\n  await noOverflow(page, 'mobile active operation');\n  await page.screenshot({ path: path.join(artifacts, 'ux-action-mobile.png'), fullPage: false });\n  // Change account in the same browser store: preferences keyed by account cannot carry over.\n"
        }
      ]
    },
    "test/ux-personality-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "7dd7bb0daa5a63b7f1526d46fecb9c2f3ef58b2a",
        "sha256": "4cce1a78c1880457cd8fd05e22c5b7fa6696f8b4bfec9bf3f19072fff8a3e336",
        "bytes": 24568
      },
      "baseline": {
        "mode": "100644",
        "blob": "21c37d24456ec66e11e29586526004e4f491af04",
        "sha256": "56b8971e26089ded94570a62923fe10d1ab824dceacd38e09fb555b027fb9850",
        "bytes": 24266
      },
      "inverses": [
        {
          "at": 220,
          "current": "import { randomUUID } from 'node:crypto';\nimport { chromium } from 'playwright-core';\nimport { buildServer } from './server-fixture.js';\nimport { revealOptional } from './lib/ux-disclosure-browser.js';\nimport { masteryXpFor } from '../src/rules.js';\nimport { grantStack, withItemTransaction } from '../src/items.js';\n\n",
          "baseline": "import { randomUUID } from 'node:crypto';\nimport { chromium } from 'playwright-core';\nimport { buildServer } from './server-fixture.js';\nimport { masteryXpFor } from '../src/rules.js';\nimport { grantStack, withItemTransaction } from '../src/items.js';\n\n"
        },
        {
          "at": 6930,
          "current": "  page.on('request', request => { if (!request.url().startsWith(base + '/v1/')) return; const url = new URL(request.url()); if (request.method() === 'GET') reads.add(url.pathname); else if (url.pathname !== '/v1/ux/workspace') writes.push(url.pathname); });\n  assert.equal(await page.evaluate(() => ['Workspace', 'Feedback', 'Progression', 'Social', 'Navigation', 'Tactics', 'Investigation', 'Coordination', 'Feel', 'Tools', 'Identity', 'Story', 'Community', 'World'].every(name => typeof window['createOmerta' + name] === 'function')), true, 'all fourteen factories load on the actual page');\n\n  await jump(page, 'profile'); const identity = page.locator('#tab-profile .ux-identity'); await revealOptional(identity);\n  const office = identity.locator('[data-identity-section=\"office\"]'); await disclosure(office); await office.locator('[data-office-add]').selectOption('plant');\n  await office.locator('[data-office-position=\"plant\"]').selectOption('0'); assert.equal(await office.locator('.ux-office-prop').first().getAttribute('data-office-prop'), 'plant');\n  const wardrobe = identity.locator('[data-identity-section=\"wardrobe\"]'); await disclosure(wardrobe); await wardrobe.locator('[data-identity-setting=\"coat\"]').selectOption('wine');\n",
          "baseline": "  page.on('request', request => { if (!request.url().startsWith(base + '/v1/')) return; const url = new URL(request.url()); if (request.method() === 'GET') reads.add(url.pathname); else if (url.pathname !== '/v1/ux/workspace') writes.push(url.pathname); });\n  assert.equal(await page.evaluate(() => ['Workspace', 'Feedback', 'Progression', 'Social', 'Navigation', 'Tactics', 'Investigation', 'Coordination', 'Feel', 'Tools', 'Identity', 'Story', 'Community', 'World'].every(name => typeof window['createOmerta' + name] === 'function')), true, 'all fourteen factories load on the actual page');\n\n  await jump(page, 'profile'); const identity = page.locator('#tab-profile .ux-identity'); await identity.waitFor();\n  const office = identity.locator('[data-identity-section=\"office\"]'); await disclosure(office); await office.locator('[data-office-add]').selectOption('plant');\n  await office.locator('[data-office-position=\"plant\"]').selectOption('0'); assert.equal(await office.locator('.ux-office-prop').first().getAttribute('data-office-prop'), 'plant');\n  const wardrobe = identity.locator('[data-identity-section=\"wardrobe\"]'); await disclosure(wardrobe); await wardrobe.locator('[data-identity-setting=\"coat\"]').selectOption('wine');\n"
        },
        {
          "at": 14037,
          "current": "  await eventuallySaved(alice, values => values.tools?.builds?.some(build => build.name === 'The Patient Reader') && values.tools?.tray?.length);\n\n  await jump(page, 'fieldwork'); await page.locator('[data-fieldwork-view=\"mysteries\"]').click(); await page.locator('[data-fieldwork-mystery=\"property-investigation\"]').click();\n  const story = page.locator('[data-ux-story=\"case\"]'); await revealOptional(story); await story.locator('.story-cold-open').waitFor();\n  assert.equal(await story.locator('[data-story-section^=\"epilogue:\"]').count(), 0, 'active case has no invented ending');\n  await disclosure(story.locator('[data-story-section=\"documents\"]'));\n  assert.equal(await story.locator('[data-story-transcript]').count(), 2, 'active case exposes exactly its two already revealed documents');\n",
          "baseline": "  await eventuallySaved(alice, values => values.tools?.builds?.some(build => build.name === 'The Patient Reader') && values.tools?.tray?.length);\n\n  await jump(page, 'fieldwork'); await page.locator('[data-fieldwork-view=\"mysteries\"]').click(); await page.locator('[data-fieldwork-mystery=\"property-investigation\"]').click();\n  const story = page.locator('[data-ux-story=\"case\"]'); await story.locator('.story-cold-open').waitFor();\n  assert.equal(await story.locator('[data-story-section^=\"epilogue:\"]').count(), 0, 'active case has no invented ending');\n  await disclosure(story.locator('[data-story-section=\"documents\"]'));\n  assert.equal(await story.locator('[data-story-transcript]').count(), 2, 'active case exposes exactly its two already revealed documents');\n"
        },
        {
          "at": 16865,
          "current": "  assert.deepEqual(writes, [], 'identity, Room, inventory planning, builds, history and story annotation execute no gameplay write');\n  assert.deepEqual(await snapshot(alice), gameBefore, 'integrated presentation leaves actual currency, materials, owned car and gameplay stats unchanged');\n\n  await jump(page, 'crew'); const community = page.locator('#ux-community'); await revealOptional(community); await community.locator('h3').waitFor();\n  const threadForm = community.locator('form[data-community-form=\"thread\"]'); await disclosure(threadForm.locator('..'));\n  await threadForm.locator('[name=\"anchor\"]').selectOption('question'); await threadForm.locator('[name=\"title\"]').fill('Compare the corrected dates');\n  await threadForm.locator('[name=\"body\"]').fill('The witness account agrees with the corrected registry.'); await threadForm.locator('[name=\"spoiler\"]').check();\n",
          "baseline": "  assert.deepEqual(writes, [], 'identity, Room, inventory planning, builds, history and story annotation execute no gameplay write');\n  assert.deepEqual(await snapshot(alice), gameBefore, 'integrated presentation leaves actual currency, materials, owned car and gameplay stats unchanged');\n\n  await jump(page, 'crew'); const community = page.locator('#ux-community'); await community.locator('h3').waitFor();\n  const threadForm = community.locator('form[data-community-form=\"thread\"]'); await disclosure(threadForm.locator('..'));\n  await threadForm.locator('[name=\"anchor\"]').selectOption('question'); await threadForm.locator('[name=\"title\"]').fill('Compare the corrected dates');\n  await threadForm.locator('[name=\"body\"]').fill('The witness account agrees with the corrected registry.'); await threadForm.locator('[name=\"spoiler\"]').check();\n"
        },
        {
          "at": 18515,
          "current": "  await pinForm.locator('[name=\"title\"]').fill('Read together by the canal'); await pinForm.locator('[name=\"destinationId\"]').selectOption('canal'); await pinForm.locator('[name=\"note\"]').fill('A public destination for later.');\n  const pinSaved = page.waitForResponse(reply => reply.url().endsWith('/v1/ux/community') && reply.request().method() === 'POST' && reply.status() === 200); await pinForm.locator('button[type=\"submit\"]').click(); await pinSaved;\n  const teammateBoard = await api('GET', '/v1/ux/community', mate); assert.ok(teammateBoard.entries.some(entry => entry.kind === 'thread' && entry.data.title === 'Compare the corrected dates'));\n  await jump(page, 'map'); await revealOptional(page.locator('#ux-community-pins')); assert.match(await page.locator('#ux-community-pins').innerText(), /Read together by the canal/);\n  assert.ok(writes.every(url => url === '/v1/ux/community'), 'only explicitly posted Crew writing leaves the private workspace');\n\n  const teammatePage = await open(mate); await jump(teammatePage, 'crew'); await revealOptional(teammatePage.locator('#ux-community')); const teammateThread = teammatePage.locator('.ux-community-thread').filter({ hasText: 'Compare the corrected dates' }); await teammateThread.waitFor();\n  assert.equal(await teammateThread.locator(':scope > .ux-community-spoiler').evaluate(element => element.open), false);\n  await teammateThread.locator(':scope > .ux-community-spoiler > summary').click(); assert.match(await teammateThread.innerText(), /witness account agrees/);\n\n  const mobile = await open(alice, true); await jump(mobile, 'profile'); const mobileIdentity = mobile.locator('#tab-profile .ux-identity'); await revealOptional(mobileIdentity);\n  const mobileOffice = mobileIdentity.locator('[data-identity-section=\"office\"]'); await disclosure(mobileOffice); await mobileOffice.locator('[data-office-position=\"plant\"]').waitFor();\n  assert.equal(await mobileOffice.locator('.ux-office-prop').first().getAttribute('data-office-prop'), 'plant', 'fresh device hydrates private office arrangement');\n  await disclosure(mobileIdentity.locator('[data-identity-section=\"wardrobe\"]')); assert.equal(await mobileIdentity.locator('[data-identity-setting=\"hat\"]').inputValue(), 'fedora');\n",
          "baseline": "  await pinForm.locator('[name=\"title\"]').fill('Read together by the canal'); await pinForm.locator('[name=\"destinationId\"]').selectOption('canal'); await pinForm.locator('[name=\"note\"]').fill('A public destination for later.');\n  const pinSaved = page.waitForResponse(reply => reply.url().endsWith('/v1/ux/community') && reply.request().method() === 'POST' && reply.status() === 200); await pinForm.locator('button[type=\"submit\"]').click(); await pinSaved;\n  const teammateBoard = await api('GET', '/v1/ux/community', mate); assert.ok(teammateBoard.entries.some(entry => entry.kind === 'thread' && entry.data.title === 'Compare the corrected dates'));\n  await jump(page, 'map'); await page.locator('#ux-community-pins').waitFor(); assert.match(await page.locator('#ux-community-pins').innerText(), /Read together by the canal/);\n  assert.ok(writes.every(url => url === '/v1/ux/community'), 'only explicitly posted Crew writing leaves the private workspace');\n\n  const teammatePage = await open(mate); await jump(teammatePage, 'crew'); const teammateThread = teammatePage.locator('.ux-community-thread').filter({ hasText: 'Compare the corrected dates' }); await teammateThread.waitFor();\n  assert.equal(await teammateThread.locator(':scope > .ux-community-spoiler').evaluate(element => element.open), false);\n  await teammateThread.locator(':scope > .ux-community-spoiler > summary').click(); assert.match(await teammateThread.innerText(), /witness account agrees/);\n\n  const mobile = await open(alice, true); await jump(mobile, 'profile'); const mobileIdentity = mobile.locator('#tab-profile .ux-identity'); await mobileIdentity.waitFor();\n  const mobileOffice = mobileIdentity.locator('[data-identity-section=\"office\"]'); await disclosure(mobileOffice); await mobileOffice.locator('[data-office-position=\"plant\"]').waitFor();\n  assert.equal(await mobileOffice.locator('.ux-office-prop').first().getAttribute('data-office-prop'), 'plant', 'fresh device hydrates private office arrangement');\n  await disclosure(mobileIdentity.locator('[data-identity-section=\"wardrobe\"]')); assert.equal(await mobileIdentity.locator('[data-identity-setting=\"hat\"]').inputValue(), 'fedora');\n"
        },
        {
          "at": 21575,
          "current": "  await mobile.screenshot({ path: path.join(artifacts, 'personality-desk-mobile.png'), fullPage: false }); await mobileDesk.locator('[data-tools-close]').click();\n  await mobile.locator('.ux-screen-tools-close').click();\n  await jump(mobile, 'fieldwork'); await mobile.locator('[data-fieldwork-view=\"mysteries\"]').click(); await mobile.locator('[data-fieldwork-mystery=\"property-investigation\"]').click();\n  const mobileStory = mobile.locator('[data-ux-story=\"case\"]'); await revealOptional(mobileStory); await mobileStory.locator('.story-cold-open').waitFor(); await disclosure(mobileStory.locator('[data-story-section=\"documents\"]'));\n  assert.match(await mobileStory.innerText(), /My private cross-reference/, 'fresh-device story highlights hydrate beside the revealed passage');\n  await mobileStory.getByRole('button', { name: 'Compare two found documents', exact: true }).click(); await noOverflow(mobile, 'mobile story dialog');\n  await mobile.getByRole('button', { name: 'Close story reading', exact: true }).click();\n  await jump(mobile, 'crew'); await revealOptional(mobile.locator('#ux-community')); await mobile.locator('#ux-community h3').waitFor(); await noOverflow(mobile, 'mobile Crew writing');\n  await mobile.screenshot({ path: path.join(artifacts, 'personality-crew-mobile.png'), fullPage: false });\n\n  const stranger = await open(other); await jump(stranger, 'profile'); const strangerIdentity = stranger.locator('#tab-profile .ux-identity'); await revealOptional(strangerIdentity);\n  assert.ok(!(await strangerIdentity.innerText()).includes('The Quiet Reader')); assert.equal(await strangerIdentity.locator('[data-identity-setting=\"hat\"]').inputValue(), 'none');\n  assert.equal((await api('GET', '/v1/ux/workspace', other)).values.identity, undefined); assert.equal((await api('GET', '/v1/ux/workspace', other)).values.story, undefined);\n  await stranger.locator('[data-tools-open]').click(); const strangerDesk = stranger.locator('dialog.ux-tools-dialog[open]'); await strangerDesk.locator('[data-tools-view=\"builds\"]').click(); assert.ok(!(await strangerDesk.innerText()).includes('The Patient Reader')); await strangerDesk.locator('[data-tools-close]').click();\n",
          "baseline": "  await mobile.screenshot({ path: path.join(artifacts, 'personality-desk-mobile.png'), fullPage: false }); await mobileDesk.locator('[data-tools-close]').click();\n  await mobile.locator('.ux-screen-tools-close').click();\n  await jump(mobile, 'fieldwork'); await mobile.locator('[data-fieldwork-view=\"mysteries\"]').click(); await mobile.locator('[data-fieldwork-mystery=\"property-investigation\"]').click();\n  const mobileStory = mobile.locator('[data-ux-story=\"case\"]'); await mobileStory.locator('.story-cold-open').waitFor(); await disclosure(mobileStory.locator('[data-story-section=\"documents\"]'));\n  assert.match(await mobileStory.innerText(), /My private cross-reference/, 'fresh-device story highlights hydrate beside the revealed passage');\n  await mobileStory.getByRole('button', { name: 'Compare two found documents', exact: true }).click(); await noOverflow(mobile, 'mobile story dialog');\n  await mobile.getByRole('button', { name: 'Close story reading', exact: true }).click();\n  await jump(mobile, 'crew'); await mobile.locator('#ux-community h3').waitFor(); await noOverflow(mobile, 'mobile Crew writing');\n  await mobile.screenshot({ path: path.join(artifacts, 'personality-crew-mobile.png'), fullPage: false });\n\n  const stranger = await open(other); await jump(stranger, 'profile'); const strangerIdentity = stranger.locator('#tab-profile .ux-identity'); await strangerIdentity.waitFor();\n  assert.ok(!(await strangerIdentity.innerText()).includes('The Quiet Reader')); assert.equal(await strangerIdentity.locator('[data-identity-setting=\"hat\"]').inputValue(), 'none');\n  assert.equal((await api('GET', '/v1/ux/workspace', other)).values.identity, undefined); assert.equal((await api('GET', '/v1/ux/workspace', other)).values.story, undefined);\n  await stranger.locator('[data-tools-open]').click(); const strangerDesk = stranger.locator('dialog.ux-tools-dialog[open]'); await strangerDesk.locator('[data-tools-view=\"builds\"]').click(); assert.ok(!(await strangerDesk.innerText()).includes('The Patient Reader')); await strangerDesk.locator('[data-tools-close]').click();\n"
        }
      ]
    },
    "test/ux-shell-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "236d6c0b536bcb2d103775a0e0a74e38f4e7d37f",
        "sha256": "408deccd8d2c6ccefd5589e2afcdc7b35ab3330303104f2b85a49d71f5255648",
        "bytes": 13698
      },
      "baseline": {
        "mode": "100644",
        "blob": "95f46d285a0f1ac69202ab7bb6f5f5db4395e8b9",
        "sha256": "4c4bcf0990d2c200d974bb01d9ff4a7254d9cc548a375bd8ddd0aa0105e2177e",
        "bytes": 13338
      },
      "inverses": [
        {
          "at": 1570,
          "current": "  const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));\n  assert.ok(size.scroll <= size.width + 2, `${label} overflows: ${JSON.stringify(size)}`);\n}\nasync function openDirectory(page) {\n  if (await page.locator('#city-directory').getAttribute('open') === null)\n    await page.locator('#city-directory > summary').click();\n}\nasync function aboveFold(page, selector, label) {\n  const position = await page.locator(selector).evaluate(element => {\n    const rect = element.getBoundingClientRect();\n",
          "baseline": "  const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));\n  assert.ok(size.scroll <= size.width + 2, `${label} overflows: ${JSON.stringify(size)}`);\n}\nasync function aboveFold(page, selector, label) {\n  const position = await page.locator(selector).evaluate(element => {\n    const rect = element.getBoundingClientRect();\n"
        },
        {
          "at": 4033,
          "current": "  assert.equal(await page.locator('#tabpanel #coachwrap').count(), 1, 'next action belongs beside the operation');\n  assert.equal(await page.locator('#game-menu[open]').count(), 0, 'secondary utilities start closed');\n  assert.equal(await page.locator('#ux-screen-tools[open]').count(), 0, 'workspace controls do not precede gameplay by default');\n  assert.equal(await page.locator('#city-directory[open]').count(), 0, 'the complete directory starts collapsed beside the five main destinations');\n  assert.equal(await page.locator('#game-menu #btn-logout').count(), 1, 'account controls remain available in the utility menu');\n  await aboveFold(page, '#tab-start .start-next-card .act', 'desktop first-week action');\n  const onboardingOrder = await page.evaluate(() => {\n",
          "baseline": "  assert.equal(await page.locator('#tabpanel #coachwrap').count(), 1, 'next action belongs beside the operation');\n  assert.equal(await page.locator('#game-menu[open]').count(), 0, 'secondary utilities start closed');\n  assert.equal(await page.locator('#ux-screen-tools[open]').count(), 0, 'workspace controls do not precede gameplay by default');\n  assert.equal(await page.locator('#city-directory[open]').count(), 1, 'desktop navigation remains visible');\n  assert.equal(await page.locator('#game-menu #btn-logout').count(), 1, 'account controls remain available in the utility menu');\n  await aboveFold(page, '#tab-start .start-next-card .act', 'desktop first-week action');\n  const onboardingOrder = await page.evaluate(() => {\n"
        },
        {
          "at": 5455,
          "current": "  await noOverflow(page, 'desktop Start Here');\n  await page.screenshot({ path: path.join(artifacts, 'shell-desktop.png') });\n\n  await openDirectory(page);\n  await page.locator('#city-sidebar #tabs [data-tab=\"start\"]').focus();\n  await page.keyboard.press('ArrowDown');\n  await page.locator('#tab-streets.on').waitFor();\n",
          "baseline": "  await noOverflow(page, 'desktop Start Here');\n  await page.screenshot({ path: path.join(artifacts, 'shell-desktop.png') });\n\n  await page.locator('#city-sidebar #tabs [data-tab=\"start\"]').focus();\n  await page.keyboard.press('ArrowDown');\n  await page.locator('#tab-streets.on').waitFor();\n"
        },
        {
          "at": 5917,
          "current": "    'vertical navigation follows ArrowDown and retains keyboard focus');\n  await openTab(page, 'start');\n  await page.locator('#tab-start .start-next-card').waitFor();\n  await page.locator('#city-directory > summary').click();\n\n  const menu = page.locator('#game-menu > summary');\n  await menu.click();\n",
          "baseline": "    'vertical navigation follows ArrowDown and retains keyboard focus');\n  await openTab(page, 'start');\n  await page.locator('#tab-start .start-next-card').waitFor();\n\n  const menu = page.locator('#game-menu > summary');\n  await menu.click();\n"
        },
        {
          "at": 7982,
          "current": "  // Secondary onboarding remains useful after a live server refresh.\n  await page.locator('#tab-start details[data-sect=\"start-outreach\"] > summary').click();\n  await page.locator('#ref-claim-name').fill('Unsent referral draft');\n  await openDirectory(page);\n  await page.locator('#character-sheet > summary').click();\n  const sheetRefreshed = page.waitForResponse(response => [`${base}/v1/me`, `${base}/v1/projections/player`].includes(response.url()) && response.status() === 200);\n  await page.locator('#btn-refresh').click();\n",
          "baseline": "  // Secondary onboarding remains useful after a live server refresh.\n  await page.locator('#tab-start details[data-sect=\"start-outreach\"] > summary').click();\n  await page.locator('#ref-claim-name').fill('Unsent referral draft');\n  await page.locator('#character-sheet > summary').click();\n  const sheetRefreshed = page.waitForResponse(response => [`${base}/v1/me`, `${base}/v1/projections/player`].includes(response.url()) && response.status() === 200);\n  await page.locator('#btn-refresh').click();\n"
        },
        {
          "at": 9454,
          "current": "  await aboveFold(page, `${standardCrime} >> nth=0`, 'desktop crime action');\n  await noOverflow(page, 'desktop Streets');\n  await page.screenshot({ path: path.join(artifacts, 'shell-streets-desktop.png') });\n  await openDirectory(page);\n  await page.locator('#tabs-more').click();\n  assert.ok(await page.locator('#grouprail [data-group]:visible').count() >= 8, 'the whole city exposes every navigation group');\n  await page.locator('#grouprail [data-group=\"earners\"]').click();\n",
          "baseline": "  await aboveFold(page, `${standardCrime} >> nth=0`, 'desktop crime action');\n  await noOverflow(page, 'desktop Streets');\n  await page.screenshot({ path: path.join(artifacts, 'shell-streets-desktop.png') });\n  await page.locator('#tabs-more').click();\n  assert.ok(await page.locator('#grouprail [data-group]:visible').count() >= 8, 'the whole city exposes every navigation group');\n  await page.locator('#grouprail [data-group=\"earners\"]').click();\n"
        }
      ]
    },
    "test/ux-story-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "c18a719544b330ca844201362117519e735d1a75",
        "sha256": "324fcbf9702af066fddf01854385e4a962e2416da29d5610a4cd6c302222ff4e",
        "bytes": 19014
      },
      "baseline": {
        "mode": "100644",
        "blob": "9ec07b399d2f5751b6b8fcd5e5c8bce775f27af4",
        "sha256": "713dd4e4196205c0c772a963d0919165165c43301672f0c8ec5c16a7469980d0",
        "bytes": 18835
      },
      "inverses": [
        {
          "at": 123,
          "current": "import { randomUUID } from 'node:crypto';\nimport { chromium } from 'playwright-core';\nimport { buildServer } from './server-fixture.js';\nimport { revealOptional } from './lib/ux-disclosure-browser.js';\n\nassert(!process.env.DATABASE_URL, 'Story browser proof uses disposable pg-mem.');\nprocess.env.INVITE_MODE = 'off'; process.env.RATE_LIMIT = 'off';\n",
          "baseline": "import { randomUUID } from 'node:crypto';\nimport { chromium } from 'playwright-core';\nimport { buildServer } from './server-fixture.js';\n\nassert(!process.env.DATABASE_URL, 'Story browser proof uses disposable pg-mem.');\nprocess.env.INVITE_MODE = 'off'; process.env.RATE_LIMIT = 'off';\n"
        },
        {
          "at": 6087,
          "current": "  page.on('request', request => { if (request.url().startsWith(base + '/v1/') && !['GET', 'HEAD'].includes(request.method()) && !request.url().endsWith('/v1/ux/workspace')) writes.push(new URL(request.url()).pathname); });\n  assert.equal(await page.evaluate(() => typeof createOmertaStory), 'function');\n  await jump(page, 'fieldwork'); await page.locator('[data-fieldwork-view=\"mysteries\"]').click();\n  await page.locator('[data-fieldwork-mystery=\"property-investigation\"]').click(); await revealOptional(page.locator('[data-ux-story=\"case\"]')); await page.locator('[data-ux-story=\"case\"] .story-cold-open').waitFor();\n  const story = page.locator('[data-ux-story=\"case\"]');\n  assert.match(await story.innerText(), /An address on an old cover/);\n  await story.getByRole('button', { name: 'Skip this opening', exact: true }).click();\n  await story.getByRole('button', { name: 'Reread the opening vignette', exact: true }).waitFor();\n  assert.equal(await story.getByRole('heading', { name: 'An address on an old cover', exact: true }).count(), 0);\n  await story.getByRole('button', { name: 'Reread the opening vignette', exact: true }).click();\n  await story.getByRole('heading', { name: 'An address on an old cover', exact: true }).waitFor();\n  await disclosure(story.locator('[data-story-section=\"cast\"]'));\n  await story.locator('.story-cast-node').filter({ hasText: 'Irene Bell' }).click();\n  await page.locator('dialog.story-dialog[open]').waitFor(); assert.match(await page.locator('dialog.story-dialog').innerText(), /AUTHORED RESIDENT SCENE · NPC/);\n",
          "baseline": "  page.on('request', request => { if (request.url().startsWith(base + '/v1/') && !['GET', 'HEAD'].includes(request.method()) && !request.url().endsWith('/v1/ux/workspace')) writes.push(new URL(request.url()).pathname); });\n  assert.equal(await page.evaluate(() => typeof createOmertaStory), 'function');\n  await jump(page, 'fieldwork'); await page.locator('[data-fieldwork-view=\"mysteries\"]').click();\n  await page.locator('[data-fieldwork-mystery=\"property-investigation\"]').click(); await page.locator('[data-ux-story=\"case\"] .story-cold-open').waitFor();\n  const story = page.locator('[data-ux-story=\"case\"]');\n  assert.match(await story.innerText(), /An address on an old cover/);\n  await story.getByRole('button', { name: 'Skip this opening', exact: true }).click();\n  await story.getByRole('button', { name: 'Reread the opening vignette', exact: true }).waitFor();\n  assert.equal(await story.getByText('An address on an old cover', { exact: true }).count(), 0);\n  await story.getByRole('button', { name: 'Reread the opening vignette', exact: true }).click();\n  await story.getByText('An address on an old cover', { exact: true }).waitFor();\n  await disclosure(story.locator('[data-story-section=\"cast\"]'));\n  await story.locator('.story-cast-node').filter({ hasText: 'Irene Bell' }).click();\n  await page.locator('dialog.story-dialog[open]').waitFor(); assert.match(await page.locator('dialog.story-dialog').innerText(), /AUTHORED RESIDENT SCENE · NPC/);\n"
        },
        {
          "at": 10885,
          "current": "  assert.match(await dialog.locator('.story-annotation-note').first().innerText(), /Compare the dates/);\n  await page.screenshot({ path: path.join(artifacts, 'story-documents-desktop.png'), fullPage: false });\n  await page.getByRole('button', { name: 'Close story reading', exact: true }).click();\n  await jump(page, 'profile'); const overview = page.locator('#tab-profile [data-ux-story=\"overview\"]'); await revealOptional(overview);\n  await disclosure(overview.locator('[data-story-section=\"crossover\"]'));\n  assert.match(await overview.locator('[data-story-section=\"crossover\"]').innerText(), /Two files on one newsroom table/);\n  await disclosure(overview.locator('[data-story-section=\"letters\"]')); await disclosure(overview.locator('.story-letter').first());\n",
          "baseline": "  assert.match(await dialog.locator('.story-annotation-note').first().innerText(), /Compare the dates/);\n  await page.screenshot({ path: path.join(artifacts, 'story-documents-desktop.png'), fullPage: false });\n  await page.getByRole('button', { name: 'Close story reading', exact: true }).click();\n  await jump(page, 'profile'); const overview = page.locator('#tab-profile [data-ux-story=\"overview\"]'); await overview.waitFor();\n  await disclosure(overview.locator('[data-story-section=\"crossover\"]'));\n  assert.match(await overview.locator('[data-story-section=\"crossover\"]').innerText(), /Two files on one newsroom table/);\n  await disclosure(overview.locator('[data-story-section=\"letters\"]')); await disclosure(overview.locator('.story-letter').first());\n"
        },
        {
          "at": 12167,
          "current": "  assert.deepEqual(writes, [], 'story scenes, reading, variants, letters, highlights and zoom perform no gameplay write');\n  await page.screenshot({ path: path.join(artifacts, 'story-epilogues-desktop.png'), fullPage: false });\n  const mobile = await open(alice, true); await jump(mobile, 'fieldwork'); await mobile.locator('[data-fieldwork-view=\"mysteries\"]').click();\n  await mobile.locator('[data-fieldwork-mystery=\"property-investigation\"]').click(); const mobileStory = mobile.locator('[data-ux-story=\"case\"]'); await revealOptional(mobileStory);\n  await disclosure(mobileStory.locator('[data-story-section=\"documents\"]'));\n  await mobileStory.getByRole('button', { name: 'Compare two found documents', exact: true }).click(); const mobileDialog = mobile.locator('dialog.story-dialog[open]');\n  await mobileDialog.locator('.story-private-highlight').first().waitFor();\n",
          "baseline": "  assert.deepEqual(writes, [], 'story scenes, reading, variants, letters, highlights and zoom perform no gameplay write');\n  await page.screenshot({ path: path.join(artifacts, 'story-epilogues-desktop.png'), fullPage: false });\n  const mobile = await open(alice, true); await jump(mobile, 'fieldwork'); await mobile.locator('[data-fieldwork-view=\"mysteries\"]').click();\n  await mobile.locator('[data-fieldwork-mystery=\"property-investigation\"]').click(); const mobileStory = mobile.locator('[data-ux-story=\"case\"]'); await mobileStory.waitFor();\n  await disclosure(mobileStory.locator('[data-story-section=\"documents\"]'));\n  await mobileStory.getByRole('button', { name: 'Compare two found documents', exact: true }).click(); const mobileDialog = mobile.locator('dialog.story-dialog[open]');\n  await mobileDialog.locator('.story-private-highlight').first().waitFor();\n"
        },
        {
          "at": 13458,
          "current": "  const dialogRect = await mobileDialog.boundingBox(); assert.ok(dialogRect.x >= 0 && dialogRect.x + dialogRect.width <= 391);\n  await noOverflow(mobile); await mobile.screenshot({ path: path.join(artifacts, 'story-documents-mobile.png'), fullPage: false });\n  await mobile.getByRole('button', { name: 'Close story reading', exact: true }).click();\n  const other = await open(bob); await jump(other, 'profile'); const otherOverview = other.locator('#tab-profile [data-ux-story=\"overview\"]'); await revealOptional(otherOverview);\n  assert.equal(await otherOverview.locator('.story-letter,.story-cast-node,[data-story-section=\"crossover\"]').count(), 0, 'another account has no prior resident cast, milestone letters or crossover');\n  assert.ok(!(await otherOverview.innerText()).includes('Compare the dates'));\n\n",
          "baseline": "  const dialogRect = await mobileDialog.boundingBox(); assert.ok(dialogRect.x >= 0 && dialogRect.x + dialogRect.width <= 391);\n  await noOverflow(mobile); await mobile.screenshot({ path: path.join(artifacts, 'story-documents-mobile.png'), fullPage: false });\n  await mobile.getByRole('button', { name: 'Close story reading', exact: true }).click();\n  const other = await open(bob); await jump(other, 'profile'); const otherOverview = other.locator('#tab-profile [data-ux-story=\"overview\"]'); await otherOverview.waitFor();\n  assert.equal(await otherOverview.locator('.story-letter,.story-cast-node,[data-story-section=\"crossover\"]').count(), 0, 'another account has no prior resident cast, milestone letters or crossover');\n  assert.ok(!(await otherOverview.innerText()).includes('Compare the dates'));\n\n"
        }
      ]
    },
    "test/ux-tactics-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "72794e2eccce4ac43f66d105ba63309009fe8c21",
        "sha256": "85663c4f0dc02e4370d328a0ad5ba4a91e0b6ff668d51d0aa1d8c62241e15210",
        "bytes": 18331
      },
      "baseline": {
        "mode": "100644",
        "blob": "75b4d9f33e26a41dc42f1168678a558c0530d366",
        "sha256": "634e327105dd093cf5f3e657a12106296877f55564d45e5e03c68bc40dc22e59",
        "bytes": 18133
      },
      "inverses": [
        {
          "at": 10215,
          "current": "\n  await openTab(page, 'port');\n  const harbor = tactics(page, 'port');\n  if (!await harbor.evaluate(node => node.open)) await harbor.locator(':scope > summary').click();\n  await harbor.locator('.ux-tactics-view table tbody tr').first().waitFor();\n  assert.match(await harbor.locator('.ux-tactics-view').innerText(), /Clean proceeds/);\n  const costWithoutEscort = await harbor.locator('.ux-tactics-view table tbody tr').first().locator('td').nth(0).innerText();\n",
          "baseline": "\n  await openTab(page, 'port');\n  const harbor = tactics(page, 'port');\n  await harbor.locator('.ux-tactics-view table tbody tr').first().waitFor();\n  assert.match(await harbor.locator('.ux-tactics-view').innerText(), /Clean proceeds/);\n  const costWithoutEscort = await harbor.locator('.ux-tactics-view table tbody tr').first().locator('td').nth(0).innerText();\n"
        },
        {
          "at": 12868,
          "current": "    }\n    // The onboarding landing can visit Home during reload, selecting the default\n    // planning view. Reopen Trials before inspecting the persisted practice run.\n    if (!await table.evaluate(node => node.open)) await table.locator(':scope > summary').click();\n    await table.locator('[data-tactics-view=\"trials\"]').click();\n    await page.waitForFunction(() => document.querySelectorAll('#tab-streets [data-ux-tactics] [data-trial-card]').length === 3);\n  };\n",
          "baseline": "    }\n    // The onboarding landing can visit Home during reload, selecting the default\n    // planning view. Reopen Trials before inspecting the persisted practice run.\n    await table.locator('[data-tactics-view=\"trials\"]').click();\n    await page.waitForFunction(() => document.querySelectorAll('#tab-streets [data-ux-tactics] [data-trial-card]').length === 3);\n  };\n"
        }
      ]
    },
    "tools/agent-alpha.js": {
      "current": {
        "mode": "100644",
        "blob": "59a687d9b7725c6d945f520278b2ca37cd44a278",
        "sha256": "a501ecf510237c626bf1508e757027023e8fdb8cdda0483b9e05df8c71abbc03",
        "bytes": 50695
      },
      "baseline": {
        "mode": "100644",
        "blob": "8312f8ba957922bd22e482512e407fcb4fb80d1a",
        "sha256": "8fee824901abe08d13d61a721f51dab66926770d670926ee3c3d93153f7b6c26",
        "bytes": 50955
      },
      "inverses": [
        {
          "at": 30923,
          "current": "  }\n}\n\nasync function recoverGuestBootstrap({ base, stateStore, session, fetchImpl }) {\n  // Older bootstrap journals retain their original recovery domain and identity.\n  const route = session.bootstrapKind === 'agent' ? '/v1/auth/agent' : '/v1/auth/guest';\n  const guest = await requestJson(fetchImpl, base, route, {\n    method: 'POST',\n    body: {\n      bootstrapSecret: session.bootstrapSecret,\n      ...(session.inviteCode === null ? {} : { inviteCode: session.inviteCode }),\n    },\n  });\n",
          "baseline": "  }\n}\n\nasync function recoverGuestBootstrap({ base, stateStore, session, fetchImpl, birthDate }) {\n  // Older bootstrap journals retain their original recovery domain and identity.\n  const route = session.bootstrapKind === 'agent' ? '/v1/auth/agent' : '/v1/auth/guest';\n  const guest = await requestJson(fetchImpl, base, route, {\n    method: 'POST',\n    body: {\n      bootstrapSecret: session.bootstrapSecret,\n      ...(route === '/v1/auth/guest' && birthDate ? { birthDate } : {}),\n      ...(session.inviteCode === null ? {} : { inviteCode: session.inviteCode }),\n    },\n  });\n"
        },
        {
          "at": 32129,
          "current": "  return acknowledged;\n}\n\nasync function createIdentity({ base, stateStore, name, inviteCode, fetchImpl }) {\n  if (!validName(name)) throw new Error('Explicit creation requires a valid 2-24 character name');\n  const storedInvite = inviteCode ?? null;\n  if (!validInviteCode(storedInvite)) {\n",
          "baseline": "  return acknowledged;\n}\n\nasync function createIdentity({ base, stateStore, name, inviteCode, fetchImpl, birthDate }) {\n  if (!validName(name)) throw new Error('Explicit creation requires a valid 2-24 character name');\n  const storedInvite = inviteCode ?? null;\n  if (!validInviteCode(storedInvite)) {\n"
        },
        {
          "at": 32757,
          "current": "    pending: null,\n  };\n  await writeIdentityState(stateStore, session);\n  session = await recoverGuestBootstrap({ base, stateStore, session, fetchImpl });\n  session = await acknowledgeGuestBootstrap({ base, stateStore, session, fetchImpl });\n\n  const agent = await requestJson(fetchImpl, base, '/v1/auth/agent-key', {\n",
          "baseline": "    pending: null,\n  };\n  await writeIdentityState(stateStore, session);\n  session = await recoverGuestBootstrap({ base, stateStore, session, fetchImpl, birthDate });\n  session = await acknowledgeGuestBootstrap({ base, stateStore, session, fetchImpl });\n\n  const agent = await requestJson(fetchImpl, base, '/v1/auth/agent-key', {\n"
        },
        {
          "at": 33658,
          "current": "  return session;\n}\n\nasync function ensureIdentity({ base, fetchImpl, stateStore, session, requestedName }) {\n  if (session.phase === 'bootstrap') {\n    session = await recoverGuestBootstrap({ base, fetchImpl, stateStore, session });\n  }\n  if (session.phase === 'guest_bootstrap_ack_pending') {\n    session = await acknowledgeGuestBootstrap({ base, fetchImpl, stateStore, session });\n",
          "baseline": "  return session;\n}\n\nasync function ensureIdentity({ base, fetchImpl, stateStore, session, requestedName, birthDate }) {\n  if (session.phase === 'bootstrap') {\n    session = await recoverGuestBootstrap({ base, fetchImpl, stateStore, session, birthDate });\n  }\n  if (session.phase === 'guest_bootstrap_ack_pending') {\n    session = await acknowledgeGuestBootstrap({ base, fetchImpl, stateStore, session });\n"
        },
        {
          "at": 42940,
          "current": "      throw new Error('Agent Alpha session is missing; explicit --create is required');\n    }\n    session = await createIdentity({\n      base, stateStore, name: options.name, inviteCode: options.inviteCode, fetchImpl,\n    });\n  }\n\n",
          "baseline": "      throw new Error('Agent Alpha session is missing; explicit --create is required');\n    }\n    session = await createIdentity({\n      base, stateStore, name: options.name, inviteCode: options.inviteCode, fetchImpl, birthDate: options.birthDate,\n    });\n  }\n\n"
        },
        {
          "at": 43270,
          "current": "  if (session.pending && role !== 'general' && !session.pending.operationId.startsWith(`${role}:`))\n    throw new Error('Resolve the pending operation under its original role before switching to a restricted role');\n  session = await ensureIdentity({\n    base, fetchImpl, stateStore, session, requestedName: options.name,\n  });\n\n  let actions = 0;\n",
          "baseline": "  if (session.pending && role !== 'general' && !session.pending.operationId.startsWith(`${role}:`))\n    throw new Error('Resolve the pending operation under its original role before switching to a restricted role');\n  session = await ensureIdentity({\n    base, fetchImpl, stateStore, session, requestedName: options.name, birthDate: options.birthDate,\n  });\n\n  let actions = 0;\n"
        },
        {
          "at": 49409,
          "current": "    const arg = argv[index];\n    if (arg === '--create') options.create = true;\n    else if (arg === '--name') options.name = argv[++index];\n    else if (arg === '--max-actions') options.maxActions = Number(argv[++index]);\n    else if (arg === '--stop-at-level') options.stopAtLevel = Number(argv[++index]);\n    else if (arg === '--session') options.sessionFile = argv[++index];\n",
          "baseline": "    const arg = argv[index];\n    if (arg === '--create') options.create = true;\n    else if (arg === '--name') options.name = argv[++index];\n    else if (arg === '--birth-date') options.birthDate = argv[++index];\n    else if (arg === '--max-actions') options.maxActions = Number(argv[++index]);\n    else if (arg === '--stop-at-level') options.stopAtLevel = Number(argv[++index]);\n    else if (arg === '--session') options.sessionFile = argv[++index];\n"
        }
      ]
    },
    "tools/business-agent.js": {
      "current": {
        "mode": "100644",
        "blob": "b2119538e83002c511cb7b25d8b9c6629d5ae6d1",
        "sha256": "ad244ad89e7354a0c5a5bf309000ec0d834def0e7f87213f699f43714058a41f",
        "bytes": 8088
      },
      "baseline": {
        "mode": "100644",
        "blob": "730e7e0dfe004e475f334a67cec35eb198804753",
        "sha256": "36ee06bdbca0f7f85526b8be8fe0bd19d9eb1bb39aafd173e4e1db00eaecfe2f",
        "bytes": 7981
      },
      "inverses": [
        {
          "at": 6694,
          "current": "    '--minimum-margin-usd-micros': 'minimumMarginUsdMicros', '--operating-cost-per-job-usd-micros': 'operatingCostPerJobUsdMicros',\n    '--payment-fee-bps': 'paymentFeeBps', '--max-active-jobs': 'maxActiveJobs',\n    '--minimum-reserve-usd-micros': 'minimumReserveUsdMicros', '--max-proposals': 'maxProposals',\n    '--work-seconds-per-job': 'workSecondsPerJob', '--planning-horizon-seconds': 'planningHorizonSeconds',\n    '--minimum-renewal-accepted-jobs': 'minimumRenewalAcceptedJobs' };\n  try {\n    for (let index = 2; index < process.argv.length; index++) {\n",
          "baseline": "    '--minimum-margin-usd-micros': 'minimumMarginUsdMicros', '--operating-cost-per-job-usd-micros': 'operatingCostPerJobUsdMicros',\n    '--payment-fee-bps': 'paymentFeeBps', '--max-active-jobs': 'maxActiveJobs',\n    '--minimum-reserve-usd-micros': 'minimumReserveUsdMicros', '--max-proposals': 'maxProposals',\n    '--minimum-renewal-accepted-jobs': 'minimumRenewalAcceptedJobs' };\n  try {\n    for (let index = 2; index < process.argv.length; index++) {\n"
        }
      ]
    },
    "tools/mobile.js": {
      "current": {
        "mode": "100644",
        "blob": "68949ad778b3caeb60e446748077dda5e7047acb",
        "sha256": "c4415f67194b74f14529f8ff3e82d389512e75b5e9e553d4e63d16b026d3dc06",
        "bytes": 81744
      },
      "baseline": {
        "mode": "100644",
        "blob": "9a8e31406748ff55f8b325a0b5ed6a3f1febe46e",
        "sha256": "f69783a4e0858f7cfeaba5eb581b59883808150a694bb6e57be93446a29423ab",
        "bytes": 82679
      },
      "inverses": [
        {
          "at": 21209,
          "current": "  await check(page, 'landing', vp);\n\n  await page.click('#btn-guest');\n  await page.waitForSelector('#screen-create:not(.hidden)', { timeout: 15000 });\n  await check(page, 'create', vp);\n\n",
          "baseline": "  await check(page, 'landing', vp);\n\n  await page.click('#btn-guest');\n  await page.waitForSelector('#age-date');\n  await page.fill('#age-date', '1990-01-01');\n  await page.locator('#age-date').evaluate((input) => input.form.requestSubmit());\n  await page.waitForSelector('#screen-create:not(.hidden)', { timeout: 15000 });\n  await check(page, 'create', vp);\n\n"
        },
        {
          "at": 22282,
          "current": "    await page.fill('#jump-q', 'garage');\n    await page.locator('#jump-list [data-jump=\"garage\"]').click();\n    await page.locator('#tab-garage.on').waitFor({ state: 'visible' });\n    // The generic ready coach is optional chrome; its mounted renderer still gates tour setup.\n    await page.locator('#coach').waitFor({ state: 'attached' });\n    await clickDisclosureControl(page, '#btn-help', true);\n    await page.click('#glossary-tour');\n  }\n",
          "baseline": "    await page.fill('#jump-q', 'garage');\n    await page.locator('#jump-list [data-jump=\"garage\"]').click();\n    await page.locator('#tab-garage.on').waitFor({ state: 'visible' });\n    await page.locator('#coach').waitFor({ state: 'visible' });\n    await clickDisclosureControl(page, '#btn-help', true);\n    await page.click('#glossary-tour');\n  }\n"
        },
        {
          "at": 51853,
          "current": "\n  await page.goto(BASE, { waitUntil: 'domcontentloaded' });\n  await page.click('#btn-guest');\n  await page.waitForSelector('#screen-create:not(.hidden)', { timeout: 20000 });\n  await page.fill('#new-name', 'Restart Probe');\n  await page.click('#btn-create');\n",
          "baseline": "\n  await page.goto(BASE, { waitUntil: 'domcontentloaded' });\n  await page.click('#btn-guest');\n  await page.waitForSelector('#age-date');\n  await page.fill('#age-date', '1990-01-01');\n  await page.locator('#age-date').evaluate((input) => input.form.requestSubmit());\n  await page.waitForSelector('#screen-create:not(.hidden)', { timeout: 20000 });\n  await page.fill('#new-name', 'Restart Probe');\n  await page.click('#btn-create');\n"
        },
        {
          "at": 58928,
          "current": "  const vp = { w: 375, h: 667 };\n  await page.goto(BASE, { waitUntil: 'domcontentloaded' });\n  await page.click('#btn-guest');\n  await page.waitForSelector('#screen-create:not(.hidden)', { timeout: 20000 });\n  await page.fill('#new-name', 'Cooldown Probe');\n  await page.click('#btn-create');\n",
          "baseline": "  const vp = { w: 375, h: 667 };\n  await page.goto(BASE, { waitUntil: 'domcontentloaded' });\n  await page.click('#btn-guest');\n  await page.waitForSelector('#age-date');\n  await page.fill('#age-date', '1990-01-01');\n  await page.locator('#age-date').evaluate((input) => input.form.requestSubmit());\n  await page.waitForSelector('#screen-create:not(.hidden)', { timeout: 20000 });\n  await page.fill('#new-name', 'Cooldown Probe');\n  await page.click('#btn-create');\n"
        },
        {
          "at": 65441,
          "current": "  });\n  await page.goto(BASE, { waitUntil: 'domcontentloaded' });\n  await page.click('#btn-guest');\n  await page.waitForSelector('#screen-create:not(.hidden)', { timeout: 20000 });\n  await page.fill('#new-name', 'Deep City Probe');\n  await page.click('#btn-create');\n",
          "baseline": "  });\n  await page.goto(BASE, { waitUntil: 'domcontentloaded' });\n  await page.click('#btn-guest');\n  await page.waitForSelector('#age-date');\n  await page.fill('#age-date', '1990-01-01');\n  await page.locator('#age-date').evaluate((input) => input.form.requestSubmit());\n  await page.waitForSelector('#screen-create:not(.hidden)', { timeout: 20000 });\n  await page.fill('#new-name', 'Deep City Probe');\n  await page.click('#btn-create');\n"
        },
        {
          "at": 69537,
          "current": "  const vp = { w: 375, h: 667 };\n  await page.goto(BASE, { waitUntil: 'domcontentloaded' });\n  await page.click('#btn-guest');\n  await page.waitForSelector('#screen-create:not(.hidden)', { timeout: 20000 });\n  await page.fill('#new-name', 'Lockup Probe');\n  await page.click('#btn-create');\n",
          "baseline": "  const vp = { w: 375, h: 667 };\n  await page.goto(BASE, { waitUntil: 'domcontentloaded' });\n  await page.click('#btn-guest');\n  await page.waitForSelector('#age-date');\n  await page.fill('#age-date', '1990-01-01');\n  await page.locator('#age-date').evaluate((input) => input.form.requestSubmit());\n  await page.waitForSelector('#screen-create:not(.hidden)', { timeout: 20000 });\n  await page.fill('#new-name', 'Lockup Probe');\n  await page.click('#btn-create');\n"
        },
        {
          "at": 74967,
          "current": "  page.on('pageerror', (e) => errs.push(String(e).split('\\n')[0]));\n  await page.goto(BASE, { waitUntil: 'domcontentloaded' });\n  await page.click('#btn-guest');\n  await page.waitForSelector('#screen-create:not(.hidden)', { timeout: 20000 });\n  await page.fill('#new-name', 'Xss Probe');\n  await page.click('#btn-create');\n",
          "baseline": "  page.on('pageerror', (e) => errs.push(String(e).split('\\n')[0]));\n  await page.goto(BASE, { waitUntil: 'domcontentloaded' });\n  await page.click('#btn-guest');\n  await page.waitForSelector('#age-date');\n  await page.fill('#age-date', '1990-01-01');\n  await page.locator('#age-date').evaluate((input) => input.form.requestSubmit());\n  await page.waitForSelector('#screen-create:not(.hidden)', { timeout: 20000 });\n  await page.fill('#new-name', 'Xss Probe');\n  await page.click('#btn-create');\n"
        }
      ]
    },
    "tools/public-ui.js": {
      "current": {
        "mode": "100644",
        "blob": "a1c1c07219e290a7c7c2584e3e1c7bdb489c5a03",
        "sha256": "9714c29097eb6e7516f67baa00daef628f38e3c7960ff46a93e236a62c1573a6",
        "bytes": 47823
      },
      "baseline": {
        "mode": "100644",
        "blob": "bd71350152904f9520f481c68b656b2f04e10554",
        "sha256": "067ce0daaf80a618fc0d0cd3668f7354d3569f1e6281450a8af1e91102bcaf3b",
        "bytes": 48001
      },
      "inverses": [
        {
          "at": 28390,
          "current": "  reportStage('Guest onboarding and operation receipts');\n  await mobile.goto(BASE, { waitUntil: 'networkidle' });\n  await mobile.click('#btn-guest');\n  await mobile.waitForSelector('#screen-create:not(.hidden)');\n  await mobile.fill('#new-name', 'Intent ' + Math.random().toString(36).slice(2, 8));\n  await mobile.click('#btn-create');\n",
          "baseline": "  reportStage('Guest onboarding and operation receipts');\n  await mobile.goto(BASE, { waitUntil: 'networkidle' });\n  await mobile.click('#btn-guest');\n  await mobile.waitForSelector('#age-date');\n  await mobile.fill('#age-date', '1990-01-01');\n  await mobile.locator('#age-date').evaluate((input) => input.form.requestSubmit());\n  await mobile.waitForSelector('#screen-create:not(.hidden)');\n  await mobile.fill('#new-name', 'Intent ' + Math.random().toString(36).slice(2, 8));\n  await mobile.click('#btn-create');\n"
        }
      ]
    },
    "tools/quest-quality-source-transfer.js": {
      "current": {
        "mode": "100644",
        "blob": "feb72569e59b5d7b4716307a7fe876c4dd09d73f",
        "sha256": "9c3b0784a18eb890f86fd3413037e026936e87c65a7c3b77987ac59f68fd3630",
        "bytes": 4940
      },
      "baseline": {
        "mode": "100644",
        "blob": "72908f02e65daf65309af20a79bb2b978a8d9ff1",
        "sha256": "c056c3b8e2efe22e9ba465393c3a895bbca94929113ddd1ef0fbcad53f9f7fe9",
        "bytes": 4679
      },
      "inverses": [
        {
          "at": 102,
          "current": "import assert from 'node:assert/strict';\nimport { createHash } from 'node:crypto';\nimport { QUEST_QUALITY_SOURCE, QUEST_QUALITY_SOURCE_SHA256 } from './quest-quality-source-data.js';\nimport { ageRemovalHistoricalInput, ageRemovalHistoricalEntry } from './age-removal-source-transfer.js';\n\nexport { QUEST_QUALITY_SOURCE };\nconst sha = text => createHash('sha256').update(text).digest('hex');\n",
          "baseline": "import assert from 'node:assert/strict';\nimport { createHash } from 'node:crypto';\nimport { QUEST_QUALITY_SOURCE, QUEST_QUALITY_SOURCE_SHA256 } from './quest-quality-source-data.js';\n\nexport { QUEST_QUALITY_SOURCE };\nconst sha = text => createHash('sha256').update(text).digest('hex');\n"
        },
        {
          "at": 2384,
          "current": "}\nexport function qualifyQuestQualitySource(file, input) {\n  assert.equal(arguments.length, 2, 'Only the exact file and whole source are accepted');\n  input = ageRemovalHistoricalInput(file, input);\n  definition(); assert(known(file), 'Only explicitly sealed quest quality comparison domains');\n  const current = canonical(input); assert(current, 'Complete uniform LF/CRLF source required');\n  const row = QUEST_QUALITY_SOURCE.files[file]; fingerprint(current.lf, row.current);\n",
          "baseline": "}\nexport function qualifyQuestQualitySource(file, input) {\n  assert.equal(arguments.length, 2, 'Only the exact file and whole source are accepted');\n  definition(); assert(known(file), 'Only explicitly sealed quest quality comparison domains');\n  const current = canonical(input); assert(current, 'Complete uniform LF/CRLF source required');\n  const row = QUEST_QUALITY_SOURCE.files[file]; fingerprint(current.lf, row.current);\n"
        },
        {
          "at": 3855,
          "current": "}\n// Unknown or partial changes remain untouched so immutable downstream qualifiers reject them.\nexport function questQualityHistoricalInput(file, input) {\n  input = ageRemovalHistoricalInput(file, input);\n  if (!known(file)) return input;\n  const current = canonical(input), row = QUEST_QUALITY_SOURCE.files[file];\n  if (!current || sha(current.lf) !== row.current.sha256) return input;\n",
          "baseline": "}\n// Unknown or partial changes remain untouched so immutable downstream qualifiers reject them.\nexport function questQualityHistoricalInput(file, input) {\n  if (!known(file)) return input;\n  const current = canonical(input), row = QUEST_QUALITY_SOURCE.files[file];\n  if (!current || sha(current.lf) !== row.current.sha256) return input;\n"
        },
        {
          "at": 4375,
          "current": "}\nexport function questQualityHistoricalEntry(file, entry, kind) {\n  assert(kind === 'tree' || kind === 'index');\n  entry = ageRemovalHistoricalEntry(file, entry, kind);\n  if (!known(file)) return entry;\n  const row = QUEST_QUALITY_SOURCE.files[file];\n  const format = pin => kind === 'tree' ? pin.mode + ' blob ' + pin.blob + '\\t' + file\n",
          "baseline": "}\nexport function questQualityHistoricalEntry(file, entry, kind) {\n  assert(kind === 'tree' || kind === 'index');\n  if (!known(file)) return entry;\n  const row = QUEST_QUALITY_SOURCE.files[file];\n  const format = pin => kind === 'tree' ? pin.mode + ' blob ' + pin.blob + '\\t' + file\n"
        }
      ]
    },
    "tools/rc1-mobile-journeys.js": {
      "current": {
        "mode": "100644",
        "blob": "a91a767b5df6683a3d921a8f3ce86361b4b10ba1",
        "sha256": "82275c5f0af31769829cc33405fa9e30e7e2061891d3e55c55274b8d00fbb6ad",
        "bytes": 22296
      },
      "baseline": {
        "mode": "100644",
        "blob": "1a74b94450828e576dbf7899689a8177b0b0baf6",
        "sha256": "87c2974330be4144fdf8fa6fce3c9b27bd66679f4696b9711caeb6b22ff0822d",
        "bytes": 22484
      },
      "inverses": [
        {
          "at": 7889,
          "current": "    try {\n      await page.goto(origin, { waitUntil: 'networkidle' });\n      await page.locator('#btn-guest').click();\n      await page.waitForSelector('#screen-create:not(.hidden)');\n      await page.locator('#new-name').fill(`RC1 Mobile ${width}`);\n      await page.locator('#btn-create').click();\n",
          "baseline": "    try {\n      await page.goto(origin, { waitUntil: 'networkidle' });\n      await page.locator('#btn-guest').click();\n      await page.locator('#age-date').fill('1990-01-01');\n      await page.getByRole('dialog', { name: 'Your birth date' }).getByRole('button', { name: 'Continue', exact: true }).click();\n      await page.waitForSelector('#screen-create:not(.hidden)');\n      await page.locator('#new-name').fill(`RC1 Mobile ${width}`);\n      await page.locator('#btn-create').click();\n"
        }
      ]
    },
    "tools/site-basics-source-transfer.js": {
      "current": {
        "mode": "100644",
        "blob": "fe7b8a67d914387c751967eceef742e8a38e631d",
        "sha256": "2b870269bb7bd13fb85e7d8868370ae5a6d4295f0856ebb90c3d7bd0884a9ea4",
        "bytes": 4862
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
          "current": "import assert from 'node:assert/strict';\nimport { createHash } from 'node:crypto';\nimport { SITE_BASICS_SOURCE, SITE_BASICS_SOURCE_SHA256 } from './site-basics-source-data.js';\nimport { ageRemovalHistoricalInput, ageRemovalHistoricalEntry } from './age-removal-source-transfer.js';\n\nexport { SITE_BASICS_SOURCE };\nconst sha = text => createHash('sha256').update(text).digest('hex');\n",
          "baseline": "import assert from 'node:assert/strict';\nimport { createHash } from 'node:crypto';\nimport { SITE_BASICS_SOURCE, SITE_BASICS_SOURCE_SHA256 } from './site-basics-source-data.js';\n\nexport { SITE_BASICS_SOURCE };\nconst sha = text => createHash('sha256').update(text).digest('hex');\n"
        },
        {
          "at": 2336,
          "current": "}\nexport function qualifySiteBasicsSource(file, input) {\n  assert.equal(arguments.length, 2, 'Only the exact file and whole source are accepted');\n  input = ageRemovalHistoricalInput(file, input);\n  definition(); assert(known(file), 'Only explicitly sealed website comparison domains');\n  const current = canonical(input); assert(current, 'Complete uniform LF/CRLF source required');\n  const row = SITE_BASICS_SOURCE.files[file]; fingerprint(current.lf, row.current);\n",
          "baseline": "}\nexport function qualifySiteBasicsSource(file, input) {\n  assert.equal(arguments.length, 2, 'Only the exact file and whole source are accepted');\n  definition(); assert(known(file), 'Only explicitly sealed website comparison domains');\n  const current = canonical(input); assert(current, 'Complete uniform LF/CRLF source required');\n  const row = SITE_BASICS_SOURCE.files[file]; fingerprint(current.lf, row.current);\n"
        },
        {
          "at": 3787,
          "current": "}\n// Unknown or partial changes remain untouched so immutable downstream qualifiers reject them.\nexport function siteBasicsHistoricalInput(file, input) {\n  input = ageRemovalHistoricalInput(file, input);\n  if (!known(file)) return input;\n  const current = canonical(input), row = SITE_BASICS_SOURCE.files[file];\n  if (!current || sha(current.lf) !== row.current.sha256) return input;\n",
          "baseline": "}\n// Unknown or partial changes remain untouched so immutable downstream qualifiers reject them.\nexport function siteBasicsHistoricalInput(file, input) {\n  if (!known(file)) return input;\n  const current = canonical(input), row = SITE_BASICS_SOURCE.files[file];\n  if (!current || sha(current.lf) !== row.current.sha256) return input;\n"
        },
        {
          "at": 4301,
          "current": "}\nexport function siteBasicsHistoricalEntry(file, entry, kind) {\n  assert(kind === 'tree' || kind === 'index');\n  entry = ageRemovalHistoricalEntry(file, entry, kind);\n  if (!known(file)) return entry;\n  const row = SITE_BASICS_SOURCE.files[file];\n  const format = pin => kind === 'tree' ? pin.mode + ' blob ' + pin.blob + '\\t' + file\n",
          "baseline": "}\nexport function siteBasicsHistoricalEntry(file, entry, kind) {\n  assert(kind === 'tree' || kind === 'index');\n  if (!known(file)) return entry;\n  const row = SITE_BASICS_SOURCE.files[file];\n  const format = pin => kind === 'tree' ? pin.mode + ' blob ' + pin.blob + '\\t' + file\n"
        }
      ]
    }
  },
  "additions": {
    "docs/TASK-PUZZLES.md": {
      "mode": "100644",
      "blob": "7090e5664f79742fc53e235d785f0fa66196c520",
      "sha256": "d4fcac0a9957ec686b327aea3fe836dec74ec00032cfb1337025daffccadb6c4",
      "bytes": 5393
    },
    "docs/superpowers/plans/2026-11-09-business-deadlines.md": {
      "mode": "100644",
      "blob": "bf61f42a0ca68abd77cdd0675c2979f1f43be146",
      "sha256": "a17dba5c71a513c63b91565ac5ec1bd3b632e95aacd92cbb77c33b2931ffb1b6",
      "bytes": 4168
    },
    "docs/superpowers/plans/2026-11-10-task-puzzles.md": {
      "mode": "100644",
      "blob": "b71850687d0b96c02bbb9301eea0108d2ab11e90",
      "sha256": "5ad2b0f12bf414b89885ad86e27a75207fce4cc144a084c2d2047af71c61743e",
      "bytes": 8847
    },
    "docs/superpowers/specs/2026-11-10-task-puzzles.md": {
      "mode": "100644",
      "blob": "fe2ed28739ecba509bd2106b67c5f94941b532ce",
      "sha256": "709d57fb021606c04f1ad01fd855c6fbb0a4a1926895ff0935f1dbf9113ce18a",
      "bytes": 1576
    },
    "public/noir-landing.css": {
      "mode": "100644",
      "blob": "fb53d550d414a89528ffb901763d30a38a450d6b",
      "sha256": "36ed37fe7130a44f2695e03922a7dacd002582fb3a22e9caa985f4b74e00a5cd",
      "bytes": 20340
    },
    "public/noir-shell.js": {
      "mode": "100644",
      "blob": "bdacc6bac1d3600a0b31848c419f74bfd86b3c16",
      "sha256": "d4ec0e56299f9ec0bb0ebe8ffed33972ec01760a294bf50a3b1fe7bb31ed4920",
      "bytes": 21281
    },
    "public/noir-ui.css": {
      "mode": "100644",
      "blob": "3c8dcde2e0131ce3fdb8c16a1d8bba28ce0d410d",
      "sha256": "ae496d63542a71ea17dca2f2b316d8b90164b39947579b043e551c3e956d1d49",
      "bytes": 27974
    },
    "public/strategy-command.css": {
      "mode": "100644",
      "blob": "23eb225a4b5d4da932e7ca2f0bd215589d932bde",
      "sha256": "0bce7f13719a83a6a4a363a7ec16b6af089272ff277664a0543784d94fdeb0d4",
      "bytes": 13723
    },
    "public/strategy-command.js": {
      "mode": "100644",
      "blob": "45361252ffe5ff884809979cfc6d98ed921ada6b",
      "sha256": "c78e8e2cd8d5ee8e566efb0b26452624384b8d41c30f21a4354cdb822325c500",
      "bytes": 17672
    },
    "public/ux-task-puzzles.css": {
      "mode": "100644",
      "blob": "af5f4a9baa675b23b4e060655db2152d44b8e634",
      "sha256": "b023117f75af1230983073758e5fefdcc06e0d7623b759f68c7f83ec8ff775c1",
      "bytes": 2889
    },
    "public/ux-task-puzzles.js": {
      "mode": "100644",
      "blob": "29f011bd0a8cdaabc1dd10d34c0087ba0f62c80b",
      "sha256": "98e9943994e77e20f621297fc84d658c0b12c9de053b6b6ae167e2db214b363e",
      "bytes": 16300
    },
    "public/vendor/strategy-city-renderer.LICENSE.txt": {
      "mode": "100644",
      "blob": "eb5f126d7a44f8b8851cda126679fcc8991421ce",
      "sha256": "c5ad44f6298e4e1a4b11bbf05824f0925fcf4823e342ce3672fea5f7d1f3aba1",
      "bytes": 1099
    },
    "public/vendor/strategy-city-renderer.js": {
      "mode": "100644",
      "blob": "88320ee1723b52e5e2040c69e9788a8ab416eb4d",
      "sha256": "1ea0be67c40254d36d1c42822728d0c97419677532393485dee3812b21c3dc28",
      "bytes": 594159
    },
    "public/vendor/strategy-city-renderer.js.LEGAL.txt": {
      "mode": "100644",
      "blob": "de8389ba82f9776c641fd271300a4f135396163f",
      "sha256": "cc7cc7e2f53d5db0235ab2226e85fc6e91655161573b39813b41bb00e5919674",
      "bytes": 188
    },
    "src/task-puzzle-contract.js": {
      "mode": "100644",
      "blob": "153a1a976a5091b31b5a3ab650ca5d6786434cca",
      "sha256": "10805e0a58ccff1ebaffef3ff06879cdd7ff26b5ed83168dde03a953324315ca",
      "bytes": 3527
    },
    "src/task-puzzle-engine.js": {
      "mode": "100644",
      "blob": "5b19916e75a1b8e3ca883003e22015ee05ba169e",
      "sha256": "63f27241f4c1b3682ee93b483b5c746308fc020751897d07042c65081d53cf1c",
      "bytes": 11339
    },
    "src/task-puzzle-jobs.js": {
      "mode": "100644",
      "blob": "a17d1d71346691206d2e38a210469135f01b868c",
      "sha256": "a500eeadb12330d8a7d364231526663851916fe897f3497e7e5049b4d6792551",
      "bytes": 2302
    },
    "src/task-puzzles.js": {
      "mode": "100644",
      "blob": "e5d9fc3a21eade98fd71e37a317a89bff242592d",
      "sha256": "730fdce2e07b47de81f83d90d201c6ac3d8f588c5d9ff20b1d203ba742aaa6ca",
      "bytes": 5609
    },
    "test/lib/age-removal-source-transfer-proof.js": {
      "mode": "100644",
      "blob": "914db9dc5a5dd0d848a1da75f667786c30ec067c",
      "sha256": "eba04ba9ee8a53ae55d31cc394b7c88c66948e902ee736b65c82c09c99173d41",
      "bytes": 15106
    },
    "test/lib/task-puzzle-solver.js": {
      "mode": "100644",
      "blob": "1c635b6cdbbc265990db632ef28d490985bcd65a",
      "sha256": "86d4a767da41178c5c0b3e0e17cb4f030a7b6c1b9b6736dc0d5e9a219368866f",
      "bytes": 1685
    },
    "test/lib/ux-disclosure-browser.js": {
      "mode": "100644",
      "blob": "94b5798863ed248086e88370add10e5504f784cf",
      "sha256": "cfb1d45427b37f5bb99bbf3defc6370c9feb1818885d72966286603cbf10a5d4",
      "bytes": 768
    },
    "test/noir-shell-browser.js": {
      "mode": "100644",
      "blob": "841c94cc2dfc49367b64757e178f626ef8378c03",
      "sha256": "626cdced36ba412e492237d97adcac5e1fe5c0eca08342700a233556a666f027",
      "bytes": 8705
    },
    "test/strategy-command-browser.js": {
      "mode": "100644",
      "blob": "d7019399a540e555c73e970ebd5489bd618b23bc",
      "sha256": "20628b023bc0ba02069c6e46cc685fc0d3497d54ee3f74c9b4400948ab88c7c7",
      "bytes": 16507
    },
    "test/task-puzzle-engine.js": {
      "mode": "100644",
      "blob": "4e807e5888e22bb7d38ab5ff6ea00707cf56106a",
      "sha256": "056c57025c55dbc9bc50bc987aab1f17aab197f5d1167184cb2002ee8525d8cf",
      "bytes": 6499
    },
    "test/task-puzzle-jobs.js": {
      "mode": "100644",
      "blob": "8ee0b2fddb43cf33cfbf02396ba9c1ddcca9d7ee",
      "sha256": "6b80ba7c3a1016daecb63e07b5c57dfa529ea4acf22c70293271c97ef12b0c4b",
      "bytes": 14612
    },
    "test/task-puzzle-postgres.js": {
      "mode": "100644",
      "blob": "75bf18f388431f5076f4b3a4e24032f0cc2ef702",
      "sha256": "3fb0df0a12894567e5a08c1b9208ed49dbc4f532939d775f6cdd54176ac47113",
      "bytes": 12064
    },
    "test/task-puzzles-browser.js": {
      "mode": "100644",
      "blob": "049a6f2c4a9503fa1b7d7751ad50b83a6954ee32",
      "sha256": "0011fcfa2b5ece16526952cdefbdb2b7a4b4837fb11a634c15ff44cb766f1519",
      "bytes": 22734
    },
    "test/task-puzzles.js": {
      "mode": "100644",
      "blob": "e799df73ab8be8793068b99bcebe7dfd671de8c7",
      "sha256": "aec1182cf38684f913c1df855722a9dbfd3a11dba1d8a672aab664bd7f4e33e7",
      "bytes": 7498
    },
    "tools/age-removal-source-seal.js": {
      "mode": "100644",
      "blob": "a4e1789b0e7125dd4187d42362fc4a1c48d2ba78",
      "sha256": "103e8f01f87c6fd5af6c01076823eea92caa4da523579e6b2ce8edbcc0838d61",
      "bytes": 15097
    },
    "tools/age-removal-source-transfer.js": {
      "mode": "100644",
      "blob": "ea8ecc58f2c9bab35e5c51285df405e89fbfb06c",
      "sha256": "c75fb314eb878ab06faf50e09029f233e6f6a0357f7f8d251bd3e0200f07acce",
      "bytes": 6002
    },
    "tools/build-strategy-city.mjs": {
      "mode": "100644",
      "blob": "1edca21fff85e8709cadb5d4213c37325d17a4bb",
      "sha256": "094f0e1acc75b89f0137ac05cbed376d2da605e9176e43da0f77f62323325749",
      "bytes": 1127
    },
    "tools/strategy-city-scene.mjs": {
      "mode": "100644",
      "blob": "00cefd5b28acbc9c06e174fcd456efe59034ab47",
      "sha256": "11e31e905979ae7d3318c1c23129e729b9c72bd8e22444c5ec152f71492c7863",
      "bytes": 27895
    }
  }
});
export const AGE_REMOVAL_SOURCE_SHA256 = '4aceee8141686513f9c504d6f0cf070a3e9a4961376b220d93d5e2a973be3cee';
