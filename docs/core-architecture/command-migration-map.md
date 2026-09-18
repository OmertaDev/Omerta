# Production command migration map

Starting point: architecture checkpoint `bca01026`. This milestone preserves the Phase 1–5 services and moves the existing World tab onto their server-issued commands. It does not replace the other economic and social systems.

## Canonical production path

1. `src/world-kernel-query.js` reads the authenticated account's bounded neighborhood: current character, memberships, custody, known relationships, events and territory.
2. `src/coordination/knowledge.js` supplies current authorized knowledge. `src/coordination/operations.js` owns role, promise, contribution, readiness and execution rules. `src/coordination/runtime.js` supplies issued discovery actions.
3. `src/mysteries.js` projects revealed mystery nodes, choices and actions from the persistent mystery runtime. `src/content/core-progression.js` supplies pinned progression definitions and connects world state and operation outcomes to the story.
4. `src/world-projection.js` composes graph, knowledge, crafting, mystery and operation views inside the existing read transaction. It exposes truncation rather than silently implying a complete city scan.
5. `src/player-commands.js` adapts that projection and bounded discovery/vehicle reads into a versioned command board. `src/player-opportunities.js` assigns server-owned relevance and limits the returned opportunities. `src/routes/commands.js` provides `GET /v1/commands` and `POST /v1/commands/execute`.
6. `public/index.html` uses its existing projection refresh coordinator with `/v1/commands` for the World lane. The World tab is now the Command Center. Player sheet reads remain `/v1/projections/player`; `/v1/projections/world` remains API compatible for existing clients.
7. Execution submits only `{executionId, confirmed}` and the identical `Idempotency-Key`. The server revalidates current authority and dispatches to the existing domain service. Existing durable receipts, transactions and mutation events remain authoritative. Projection invalidation and the next bounded board read update commands and opportunities.

## Surfaces

| Surface | Checkpoint source / behavior | This milestone | Remaining boundary |
|---|---|---|---|
| World / Command Center | `/v1/projections/world`; browser translated action arrays into eight domain mutation route shapes | `/v1/commands`; one generic command renderer; one execution route | No browser prerequisites or domain payload synthesis |
| Case catalog and mystery notes | Canonical mystery projection, but browser constructed start, discover, complete and choice requests | Canonical notes preserved; actions use exact issued command objects; server confirmation wording | Unrevealed nodes, arbitrary option metadata and raw prerequisite adapters never become buttons |
| Discovery investigations | Coordination pilots primarily API-driven | Current authorized investigation notes and issued discovery commands appear in Command Center | Other authored Content Desk cases remain a separate domain |
| World object / territory cards | Canonical state, browser generated action paths and expected revisions | Shared commands matched by server subject/target | No invented action for an entity without an issued command |
| Crafting / inventory / salvage | Canonical recipe/material/item projection; browser constructed crafting route | Shared recipe/item commands, visible costs, custody/provenance and owner vehicle salvage | Legacy garage, market and authored content materials are still their own authorities |
| Family operation catalog, roles and contributions | Canonical operation projection; browser mapped role/requirement actions into domain requests | Canonical readiness, role and history display; exact command objects for create/join/commit/contribute/withdraw/execute | Existing Family treasury, hierarchy, war and vanity screens stay on their domain APIs |
| Crew activity in Command Center | Crew membership and objective in world projection | Uses canonical Crew/member/objective projection | Crew chat, invitations, recruiting, social targeting and objective payouts remain `/v1/crew` |
| Knowledge in Command Center | Current knowledge projection | Shows owned/shared claims and current discovery notes; shared clue/Crew/Family commands expose authorized knowledge sharing and revocation | Old Streets clues (`/v1/clues`) are a distinct collection mechanic, not a substitute for coordination knowledge |
| Player sheet / login | `/v1/projections/player` wraps established authoritative accrual/read path | Preserved | No migration back to `/v1/me` |
| Home / morning paper | `/v1/home`, `/v1/paper`, `/v1/bulletin` | Preserved for economy/onboarding/digest | A parallel presentation, not used to authorize Command Center actions |
| City map | `/v1/map` supplies legacy district occupancy, war and contest summary | Command Center territory/object cards use canonical graph | Full map still reads its established specialized domain view; follow-up may embed commands without duplicating its rules |
| Content Desk | `/v1/content` authored cases, workshop and exchange | Preserved with its own issued actions/revisions | Separate authored-content persistence has not been falsely treated as World Graph custody or mystery state |
| Market / garage / Family administration | Specialized authoritative domain routes | Preserved | Future command adapters must call these routes' existing services, not duplicate mutation rules |

The highest-value gameplay path is now unified: lead → discovery → knowledge → recipe/item → group operation → persistent world change → story branch → authorized consequences. Presence of legacy screens does not imply their state can satisfy the new path's authorization rules.

## Operational questions

- **What changed?** Current visible activity plus authorized command feedback counts and immediate result.
- **What needs my attention?** Server-ranked opportunity list; the client preserves its order.
- **What can I do?** Issued `AVAILABLE` commands with execution identities.
- **What am I waiting for?** Server `BLOCKED`, `LOCKED` and `IN_PROGRESS` states. Undiscovered requirements get generic wording; raw mystery prerequisite adapters are not printed.
- **What is my Crew doing?** Current roster and objective from the graph projection.
- **What is my Family doing?** Membership, visible relations, operation instances, readiness, roles and history.
- **What have I discovered?** Authorized investigations, knowledge claims, case notes and recorded choices.

## Browser correctness and privacy

`createProjectionRefresh` preserves the existing latest-request, session-epoch and character-replacement guards. Refresh and membership invalidation immediately clear private cards and controls. Case and operation selectors remain independent. WebSocket reconnect refreshes both selectors to recover missed invalidations.

Saved uncertain attempts are restored only after a fresh board matches both account and character. Storage contains execution identity, label and confirmed consent, never arbitrary routes, request bodies or a bearer token. Retry uses the exact server identity even after the board is cleared or the browser reloads. An uncertain attempt disables fresh actions. A successful action with unavailable projection data is already recorded: it needs a fresh read, not a new mutation key.

Production-source tests: `test/world-projection-client.js` retains stale/session/selection/revocation queue and queued API isolation checks. `test/player-command-client.js` executes the actual command functions and renderer for all availability states, shared context actions, confirmation cancellation, double click suppression, exact retries, restore isolation, safe prose and refusal to reconstruct legacy action arrays. These are browser-layer tests; persistence and concurrency claims require the separate PostgreSQL command suite.

The repository's `tools/mobile.js` also passes 175 screen checks, including the existing restart-window recovery and stored-XSS assertions. Its fault-injection target was corrected from `/v1/me` to `/v1/projections/player`: `e56cf576` used the old endpoint, while `bca01026` had migrated the client without updating the fault injector. This was architecture-introduced verification drift, not a failure predating the architecture. Evidence is retained in `output/player-command-engine/mobile-checkpoint-evidence.txt` and `mobile-harness-final.log`.

A separate headless Chrome regression runs the actual production HTTP server against the isolated PostgreSQL `command_engine_browser` database. It passes ten checks: canonical login and seven sections; 1440/390/320-pixel layouts; keyboard focus and Escape cancellation; button cancellation; a deliberately lost reply after committed salvage followed by page reload and exact retry without duplicate inventory effects; persistent mystery start and selected case notes; account isolation; and absence of uncaught browser errors. It uses real domain responses, with only the lost transport reply injected. Source hashes, results and screenshots are retained in `output/player-command-engine/command-browser-results.json` and `command-center-*.png`. CUA itself had no enabled browser surfaces; the existing repository `playwright-core` test runtime supplied headless regression coverage without changing the user's browser configuration.

That production HTTP rehearsal found a new integration defect: Fastify supplies a custom query-object prototype for nonempty selectors, which the projection's strict plain-object check rejected. The command route now copies its already validated query fields into a plain object. The initial case-selection failure is retained as `command-browser-query-failure.json`; the complete retest passes. The frontend also reserves its character-replacement wording for the explicit `projection_character_changed` response, rather than attributing every 409 to a changed character.

## Follow-up scope

Extend the same issued-command contract to the remaining market, Crew social requests, full territory map and Family administration surfaces only where their existing authoritative services expose a bounded safe adapter. Preserve the distinct authored Content Desk content model until a separately specified migration reconciles its instances, materials and rewards. No mass content production or architecture rewrite is required for this map.
