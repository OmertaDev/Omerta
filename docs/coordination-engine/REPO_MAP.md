# Coordination Engine — repository map

This map describes the existing OMERTÀ implementation that a separate Coordination Engine can reuse. It distinguishes runtime authority from architectural precedent: the presence of a helper or table does not authorize a new subsystem to spend currency, transfer an item, execute content, or act for another account.

## Source snapshot and method

- Inspected on 2026-09-13 in `C:\Users\Jorge\Documents\Omerta`.
- Git HEAD at inspection: `2b3feb7c807848564094c9b56d13fd7e41f97bae`.
- The working tree was already dirty. In particular, `SPEC.md`, `public/index.html`, `test/routes.js`, and contract configuration had tracked edits; DeFi/market-v2 source, tests, contract files, deployments, and campaign assets also existed as untracked work. Those changes are not attributed to this documentation task and are not treated as committed or deployed features.
- This is a source inspection, not a production-state verification or security conclusion. File and symbol references below identify the inspected implementation; new Coordination Engine files being developed alongside this map are not described as preexisting functionality.
- Read `AGENTS.md`, including its ContextPlus workflow and proportional-change discipline. Used ContextPlus `get_context_tree`, focused `get_file_skeleton` calls, and semantic search, then direct source/schema reads and exact `rg` matches. Semantic results were treated as navigation, not authority. No application source was changed for this map.

References use repository-relative paths and exact symbols where possible. The important identity, transaction, and authorization boundaries were read in source rather than inferred from documentation titles.

Implementation update: the map below remains the preexisting-system baseline. Coordination Phases 00–01 now add their own private runtime, authentic claims, read grants, assertions and personal reference archives; see [the current architecture](ARCHITECTURE.md) and [Phase 01 review](PHASE_01_REVIEW.md). Knowledge rows do not grant authority over any preexisting ledger described below. Delegated organization execution and the later economic/operation adapters remain planned.

## Application and deployment shape

| Area | Existing implementation | Coordination integration consequence |
| --- | --- | --- |
| Runtime | [package.json](../../package.json): ESM JavaScript, Node `>=20`, Fastify 5, `pg`, `pg-mem`, `@fastify/jwt`, `@fastify/websocket`, optional Redis through `ioredis`, chain operations through `viem`. CI selects Node 22. | Use existing ESM modules and native Node test conventions. A separate service or framework is unnecessary for the bounded foundation. |
| HTTP composition | [src/server.js](../../src/server.js): `buildServer`; feature modules expose `register(app, { pool, auth, ... })`, including [src/routes/content.js](../../src/routes/content.js): `register` and [src/routes/worldgraph.js](../../src/routes/worldgraph.js): `register`. | Mount a narrow route module through existing server composition. A new route still needs explicit auth and closed request validation. |
| API discovery | [src/server.js](../../src/server.js): the `onRoute` registry records mounted method, URL, and actual auth kind; [src/agentgateway.js](../../src/agentgateway.js) contains declared schemas and route contracts used for machine discovery. | Route existence and a complete machine contract are separate changes. Reuse the registration and verification pattern when exposing coordination APIs. |
| Human client | [public/index.html](../../public/index.html), [public/omerta-ui.css](../../public/omerta-ui.css), [public/sw.js](../../public/sw.js), and [public/manifest.json](../../public/manifest.json). Fastify serves the console and static surfaces. | Existing console is a large static application, not an installed React application. A coordination UI would need an explicit scope and browser checks. |
| Deployment | [render.yaml](../../render.yaml): API and worker use `npm ci --omit=dev`, separate start commands, and deployment after checks pass; [DEPLOY.md](../../DEPLOY.md) contains health, rollback, and backup procedures. | Foundation rollout should be independently disabled by default. A new feature flag should not activate content packages, token rails, or worker duties indirectly. |

The deployment blueprint explicitly requires one API instance. Its event bus, WebSocket presence, some flood controls, and metrics are process-local. `REDIS_URL` addresses shared rate-limit buckets but does not provide a shared event bus or all other process-local controls. The blueprint also requires one worker and warns that duplicate-worker safety belongs to each job; a new job inherits no global leader lock. These are concrete constraints in `render.yaml`, not an assessment of live replica counts.

## Database, migrations, and transaction ownership

[schema.sql](../../schema.sql) is the central schema. [src/db.js](../../src/db.js): `makeDb` selects real PostgreSQL when `DATABASE_URL` exists and `pg-mem` otherwise, and refuses the memory backend in production. `dbCaps` exposes driver capabilities including `skipLocked` and `indexedTextArrayAny`; it is not a feature-policy object.

Real database boot holds the session advisory `SCHEMA_LOCK_KEY`, then calls `migrateSchemaUnderLock`. The latter applies the schema, checks the Phase 2 definition schema, runs derived column additions and explicit migrations, then records `stampSchema`. `columnMigrations` derives additive column updates from table definitions; `migrateColumns` logs failed derived statements and continues. Consequently, a successful ordinary boot is not by itself proof that a newly required authority constraint was added correctly. Existing Phase 2 code provides a stricter precedent in `verifyPhase2DefinitionSchema`, which verifies the literal shape required by that subsystem.

The repository has several transaction owners with different guarantees:

| Boundary | What it does | Reuse rule |
| --- | --- | --- |
| [src/game.js](../../src/game.js): `withCharacter` | Commits due accrual first through `settleIfDue`; starts the action transaction; optionally takes a pre-character lock hook; locks the living character and `account_persistent`; loads holdings; runs the callback; persists character/account/kitchen state and commits. It maps deadlocks to `contention` and protects success from post-commit rendering/referral failures. | Useful for bounded character-authoritative actions when their required lock order fits. Keep action writes on the provided client; `h.pool` is a separate connection and is not equivalent transaction scope. |
| `withCharacterRead`, `readCharacter` | Tries an unlocked read and in-memory accrual preview with a SQL write guard; falls back to `withCharacter` if accrual changed. | A GET using this wrapper can write legitimate accrual. Do not call it a globally pure read or nest an unrelated transaction beneath it. |
| `withTwoCharacters` | Owns the two-party transaction and coordinated character/account state persistence. | Reference for two-party lock discipline; not a general arbitrary-participant coordinator. |
| [src/crew.js](../../src/crew.js): `CREW_FIRST_CHARACTER_LOCKS` | Locks the Crew before character/account locks, then re-locks and checks membership afterward. | Existing integration seam when a Crew mutation requires Crew-first authority. Do not invert it with operation or item locks. |
| [src/items.js](../../src/items.js): `withItemTransaction`, `withItemMutation`, `withLotMutation` | Branded transaction and mutation contexts; one checked-out client; logical-key replay guards; conditional writes, immutable receipts, item-event audit, and restricted compound destinations. Handles ambiguous commit separately. | Item mutations must enter through this owner and its authority envelope. Calling item SQL or nesting this under a generic transaction bypasses its guarantees. |
| [src/content/phase2-transactions.js](../../src/content/phase2-transactions.js): `withPhase2Transaction`, `withPhase2Read` | Async-context-bound registry ownership, no nested registry transactions, error mapping, explicit unknown-commit outcomes, and memory-backend serialization/compensation. | Precedent for a separate coordination transaction owner if stronger receipts/recovery are required. Reusing the code verbatim would also couple coordination to definition-registry assumptions. |

`pg-mem` does not reproduce real rollback and row-lock behavior. Item and registry boundaries explicitly serialize and compensate their own memory-backend operations. That compensation is local to those boundaries; it is not a general property of `makeDb` or `withCharacter`. Lock races, rollback atomicity, and commit ambiguity for new coordination persistence require real PostgreSQL evidence.

The Phase 1 global item mutation guard is a globally unique logical-operation key, not permission to select arbitrary accounts or inventory. The inspected worldgraph routes reserve that guard before locking current-character authority. A coordination run must not reorder or borrow those locks casually.

## Identities, organizations, and lifecycle

| Identity | Storage and authority | Relevant limitation |
| --- | --- | --- |
| Account | `accounts`, unique `(auth_provider, auth_subject)`; persistent progression in `account_persistent`. [src/auth.js](../../src/auth.js): `accountForIdentity`, `accountForGuestBootstrap`, `upgradeAccount`. | Provider identity, auth principal, current character, and display name are distinct. Client-supplied owner IDs must not replace authenticated account authority. |
| Character | `characters` holds a mortal street identity. [src/game.js](../../src/game.js): `assertStreetActor`, `withCharacter`; [src/social/estate.js](../../src/social/estate.js): `runEstate`, `clearInboundPointers`. | Death/replacement changes the current actor. A character-owned run needs a pinned owner and explicit refusal/recovery behavior, not automatic inheritance. |
| Crew | `crews`, `crew_members`, `crew_invites`, `crew_requests`. [src/crew.js](../../src/crew.js): `crewIdOf`, `createCrew`, `acceptInvite`, `leaveCrew`, `settleCrew`, `CREW_FIRST_CHARACTER_LOCKS`. Membership is account-keyed. | Crew membership survives character death, but membership can still change while a request is in flight. Crew itself has no treasury or generic escrow authority. |
| Family | `gangs`, `gang_members`. [src/social/gangs.js](../../src/social/gangs.js): `createGang`, `joinGang`, `removeMember`, `promoteMember`, `tribute`, `tributeOmr`. Membership is character-keyed. | Family authority and wealth have different lifecycle and accounting rules from Crew. Authored `extended_family` means current membership in these gangs. |
| Dynasty relationships | [src/dynasty.js](../../src/dynasty.js): `marriageOf`, `acceptMarriage`, `nameConsigliere`, `acceptConsigliere`; persistent account-level relationship tables. | These are not the `extended_family` scope used by authored content. Do not conflate narrative terminology with storage authority. |

[src/content/runtime.js](../../src/content/runtime.js): `scopeIdFor` derives personal scope from the current character ID, Crew scope from account membership, and `extended_family` from the character's gang membership. `belongsToScope` rechecks those distinct relationships. `participantKind` derives NPC/agent/human-eligible classification from persistent account state; labels supplied by a caller cannot establish those roles.

For the bounded foundation, the smallest supported scope is a private run owned by the authenticated account and its pinned current character. Future organization scope must separately define current membership, stored participant authority, revocation, historical access, and release-only recovery.

## Existing graph and content systems: preserve separate authority

There are three related but distinct foundations. Their similar vocabulary does not make their tables or execution contexts interchangeable.

### Phase 1 worldgraph

- [src/worldgraph.js](../../src/worldgraph.js): `loadGraphPackages`, `nodeOf`, `requirementsMet`, `visibleNode`; [src/worldgraph-validate.js](../../src/worldgraph-validate.js) validates graph declarations.
- [src/content/phase1.js](../../src/content/phase1.js): `PHASE1_WORLD_GRAPH_PACKAGES` selects the canonical CORE, AUTOMOTIVE, and BELLADONNA packages. [src/content/phase1-policy.js](../../src/content/phase1-policy.js): `validatePhase1EconomyPolicy` imposes the release-specific economy boundary. The exact `recipe:hardened_steel` sink is $300; Phase 1 otherwise has no cash authority and no $OMR authority.
- [src/crafting.js](../../src/crafting.js) and [src/items.js](../../src/items.js) own crafting and custody; `item_stacks`, `item_instances`, `item_events`, `item_mutation_guards`, and `operation_escrow` carry item authority. `collection_log` is not an interchangeable inventory ledger.
- [src/mysteries.js](../../src/mysteries.js): `createMysteryContext`, `startMystery`, `discoverNode`, `completeNode`, `commitChoice`, `cancelMystery`, `mysteryBoard`. Context seals account authority; character-scoped instances and their stored versions have explicit lifecycle semantics.
- [src/operations.js](../../src/operations.js): `createOperationContext`, `openOperation`, `assignRole`, `contribute`, `completeOperation`, `cancelOperation`, `operationBoard`, `roleBoard`. Existing cooperative behavior includes graph-defined roles, ordered contributions, distinct-account role uniqueness, condition/effect allowlists, item escrow, and private role projections.

`world_operation_roles` has both a primary key on `(operation_id, role_id)` and uniqueness on `(operation_id, account_id)`. These enforce distinct accounts, not distinct humans or proof that accounts are independently controlled. The operation runtime does not allow callers to nominate arbitrary role participants or reward recipients.

`operations.js:cancellationAuthority` uses the stored opener account and intentionally avoids package/node lookup. `lockedCancellationAuthority` checks that historical authority again under locks. Cancellation can therefore release exact recorded escrow after graph retirement, version change, death, or Crew departure without executing retired effects. Mystery recovery similarly uses the stored account and exact instance ID. These are strong precedents for immutable history and release-only recovery; they are not a generic contract cancellation API.

`operations.js:stepOf` gives the same unavailable result for absent, hidden, foreign-operation, and other-role private nodes. Shared `operationBoard` and caller-specific `roleBoard` deliberately differ. A future knowledge-sharing layer should preserve this non-enumeration pattern and explicit projection policy.

### Activated authored stories and workshops

[src/content/compiler.js](../../src/content/compiler.js): `compileContentPack`, `validateRuntimeContentPack`, `validateCraftingContentPack`, `validateActivatableContentPack` define closed node, edge, gate, verifier, and effect vocabularies. This is typed data execution through approved adapters, not arbitrary code evaluation.

[src/content/runtime.js](../../src/content/runtime.js): `activateContentBundle` verifies the bundle hash and persists activation. `loadBundle` resolves pinned definitions; `loadActiveBundle` resolves the current entry point. Tables `content_bundles` and `content_activations` record the authority. Building a source pack does not activate it.

The story runtime has usable precedents for coordination:

- `createContentInstance`, `joinContentInstance`, `setContentConsent`, and `actOnContentInstance` operate on persisted lobbies/runs.
- `assertRevision` returns a replacement projection on stale revisions; action IDs bind to the current instance projection.
- `validateCurrentPartyAuthority` rechecks scope, participant classification, eligible roles, explicit consent, and optional quorum. This establishes useful checks, but a new multi-party coordinator still needs its own demonstrated lock order around all changing authority rows.
- `CONTENT_FORMING_TTL_MS` bounds forming lobbies to 24 hours. `runKeyOf` derives `once` or `season:<number>`; clients do not nominate the run key.
- `recordStoryFlags` records account-scoped, write-once narrative outcomes. `materializeTerminalEffects` and `claimContentRewards` retain separate entitlement/claim state. Runtime effect kinds are limited to status and collectible awards.

`content_instances`, `content_instance_members`, `content_instance_nodes`, `content_instance_facts`, `content_story_flags`, and `content_instance_effects` provide the corresponding storage. They are authored-content state, not a general coordination event store.

[src/content/crafting.js](../../src/content/crafting.js): `collectContentSource`, `startContentWorkOrder`, `finishContentWorkOrder`, `craftContentRecipe`, `repairContentTool` maintain exact-hash supplies, finite source epochs, server-timed jobs, skills, and durable tools. Work orders consume inputs at start and resolve against pinned definitions at collection. [src/content/exchange.js](../../src/content/exchange.js): `createContentExchangeListing`, `fillContentExchangeListing`, `cancelContentExchangeListing` provide an allowlisted, whole-lot, same-hash cashless barter slice. These surfaces do not supply generic cash-market, token, or item-export authority.

### Phase 2 sealed artifacts and item definitions

[src/content/corpus.js](../../src/content/corpus.js): `compileContentCorpus`, `validateCompiledBundle`, `verifyStoredBundleBytes`, `sealedBundleBytes` supply canonical compilation and verification. [src/content/artifacts.js](../../src/content/artifacts.js): `storeSealedBundle`, `activateStoredBundle`; [src/content/activation-policy.js](../../src/content/activation-policy.js): `createActivationPolicy`, `assertActivationPolicy`, `assertActivationHistory`; [src/itemdefinitions.js](../../src/itemdefinitions.js): `registerItemDefinitions`, `definitionByHash`, `activeDefinition` separate verified storage from explicit activation.

Corresponding tables include `content_bundle_artifacts`, `item_definition_versions`, `content_bundle_item_definitions`, `content_activation_events`, `content_bundle_activations`, and `item_definition_activations`. This is the strongest existing precedent for immutable artifacts plus an independently gated active pointer and retained activation history. It is a foundation for reuse of design discipline; it does not make future deep crafting, a generic Coordination Engine, or all corpus node types executable today.

## Economy, contracts, and wallet boundaries

[src/game.js](../../src/game.js): `ledger` appends `transactions` and applies the existing $OMR recycling policy where relevant. [src/invariants.js](../../src/invariants.js): `runLedgerInvariants` reconciles balances, escrow, and other economic identities; `alertDrift` records and reports failures. [src/router.js](../../src/router.js): `waterfall`, `runRouterInvariants`, `routerBoard` declare and check the cross-source real-value flow. Despite its filename, this module is the money router, not the Fastify HTTP router.

Existing contracts are domain-specific. [src/social/contracts.js](../../src/social/contracts.js): `postBounty`, `postFamilyContract`, `claimBounty`, `refundPot`, `sweepExpiredBounties` own bounty escrow and settlement. [src/loans.js](../../src/loans.js) owns capital offers, debt, and collateral. [src/heists.js](../../src/heists.js): `planHeist`, `joinHeist`, `executeHeist`, `sweepStaleHeists` own a cooperative mission lifecycle. These provide examples of explicit counterparty consent, reserved funds, deadline settlement, and replay/lifecycle guards. They do not expose a safe generic “execute contract” adapter for a new graph.

[src/chain.js](../../src/chain.js): `walletChallenge`, `walletVerify`, `requestWithdraw`, `requestGearWithdraw`, `requestItemWithdraw`, `drainQueue`, `reclaimExpiredVouchers` are separate chain and extraction authority. Solidity code lives in [omerta-contracts](../../omerta-contracts), with its own [security review policy](../../omerta-contracts/SECURITY-REVIEW-POLICY.md). Current configuration and deployment readiness must be verified independently before making any live-chain claim.

The Coordination foundation should be value-neutral: completing a node records progress and audit history only. It should not import `ledger`, custody mutation methods, wallet signing, bounty payouts, or authored-content reward execution. Any future integration needs a narrow server-owned adapter, separate economic authority, and the existing ledger/item invariants for that adapter.

## Authentication, idempotency, and action authority

[src/server.js](../../src/server.js): `buildServer` registers JWT auth, checks banned accounts and token versions, applies agent cadence on authenticated reads as well as mutations, and derives operator auth separately. [src/auth.js](../../src/auth.js) owns provider verification and invite-backed account bootstrap. [src/ratelimit.js](../../src/ratelimit.js): `initRateLimiter`, `checkAuthRateLimit`, `checkReadLimit`, `checkPublicRateLimit`, `checkRateLimit` support memory or Redis buckets. The base agent rate is one action per three seconds with no burst; other player and public controls are independent.

The global HTTP idempotency hook hashes method, full request URL, and JSON body, then reserves `(account_id, key)` before execution. A differing request returns `idempotency_key_reuse`; a reservation still in progress returns 409; stored successes replay their original response. The success receipt is persisted in `onSend`, after the domain transaction has committed. An acknowledgment/storage failure can leave a committed action with an in-progress key. Existing code deliberately retains that uncertainty instead of pretending the action failed.

This global hook is useful transport protection, but it is not an atomic domain receipt. A Coordination command journal/replay receipt should be persisted in the same transaction as run state and audit history. Requests must still revalidate owner, current character, pinned definition, run revision, and node eligibility. Idempotency key possession does not grant authority.

[src/routes/worldgraph.js](../../src/routes/worldgraph.js): `innerIdempotencyKey`, `requireIdempotency`, `mutationOptions`, `mutate` are examples of a mandatory HTTP key combined with a domain mutation guard. [src/routes/content.js](../../src/routes/content.js): `strictBody`, `guarded`, `instanceMutation` are examples of rejecting unknown fields and returning safe replacement projections.

[src/agentturn.js](../../src/agentturn.js): `agentTurn` and the `/v1/agent/act` handler in `server.js` provide a separate autonomous authority path: the server resolves an issued action against a fresh turn under locks. Authored stories, puzzles, workshop actions, and worldgraph discovery are deliberately outside that queue. New coordination discovery should also remain outside Agent Act unless a later change explicitly adds and proves an allowlisted action kind.

## Events, workers, and caching

[src/game.js](../../src/game.js): `bus` is a Node `EventEmitter`; `notify` inserts a durable notification row and immediately emits the live event. `notifyOnce` suppresses duplicate unread solicitation payloads. These emissions occur when the helper runs, potentially before the enclosing transaction commits. The live signal therefore must not be used as proof of committed coordination state.

[src/server.js](../../src/server.js): `/v1/ws` authenticates with a bearer subprotocol, checks account/token/current-character state, derives personal/Crew/Family subscriptions, bounds sockets per account, sends heartbeat pings, and drops live events for slow consumers above `WS_MAX_BUFFER`. Durable state is recovered by reads. There is no demonstrated durable cross-process coordination outbox in this path.

[src/worker.js](../../src/worker.js) runs independently, stamps `worker_heartbeat`, performs domain sweeps through a `safe` wrapper, and guards its async timers against overlap. Hourly sweeps coexist with separate health, season, and optional keeper clocks. [src/server.js](../../src/server.js): `WORKER_STALE_SEC`, the worker-watch logic, and `/health` report liveness separately from API availability. A future asynchronous coordinator must supply durable claims, leases or fencing, retries, and restart recovery; an interval callback alone provides none of them.

[src/memo.js](../../src/memo.js): `memo` supplies TTL plus single-flight deduplication for identical server-wide reads, with `clear()` for invalidation/testing. Its cache is not keyed by caller. It must never cache private coordination state, role evidence, actor-specific permissions, or personalized actions. Reuse it only for genuinely public identical projections.

## Verification surfaces

This mapping task inspected verification code and CI; it did not run or claim the application suites passed.

| Concern | Existing verification entry points |
| --- | --- |
| Core transactions and API security | `test/persist.js`, `test/hardening.js`, `test/security.js`, `test/auth.js`, `test/routes.js`, `test/agentturn.js`, `test/crew.js`; `tools/pgcheck.js`, `tools/pgquery.js`, `tools/concurrency.js`, `tools/chaos.js`. |
| Worldgraph and cooperative operation privacy/lifecycle | `test/worldgraph.js`, `test/worldgraph-validation.js`, `test/worldgraph-api.js`, `test/items.js`, `test/mysteries.js`, `test/operations.js`, `test/belladonna.js`, `tools/pgcheck-belladonna.js`; `npm run worldgraph:check`. |
| Authored runtime and crafting | `test/content-runtime.js`, `test/content-social.js`, `test/content-seasonal.js`, `test/content-api.js`, `test/content-crafting.js`, `test/content-crafting-jobs.js`, `test/content-crafting-tools.js`, `test/content-exchange.js`; `npm run content:check`. |
| Definition/artifact/lot foundation | `test/phase2-definition-schema.js`, `test/phase2-definitions.js`, `test/phase2-activation.js`, `test/phase2-definition-invariants.js`, `test/phase2-lot-boundary.js`, `test/phase2-postgres.js`; dedicated definition and lot PostgreSQL scripts in `package.json`. |
| Economic conservation | `test/economy.js`, `test/router.js`, `test/tokenomics.js`, relevant domain suites; `npm run sim`, `npm run invariants`. |
| Client and contracts | `tools/mobile.js`, `tools/public-ui.js`, invitation browser tests; contract Foundry workflow and scoped contract test directories. |

[.github/workflows/ci.yml](../../.github/workflows/ci.yml) runs the memory suite, economy simulation, scale/browser checks, and a PostgreSQL 16 job for query parsing, row locks, migration, explicit Phase 2 checks, and interruption/concurrency harnesses. Markdown-only changes are ignored by the main CI workflow. [.github/workflows/forge.yml](../../.github/workflows/forge.yml) and [.github/workflows/liquidity-postgres.yml](../../.github/workflows/liquidity-postgres.yml) cover additional domains.

For new coordination code, the narrow first checks should cover deterministic canonical compilation, cycles and bounds, all/any/threshold semantics, server-derived gates, owner isolation, stale revisions, exact replay, conflicting-key refusal, and value neutrality. Persistence changes also need real PostgreSQL tests for same-run concurrent commands, rollback, restart/replay, and schema upgrades. Existing tests are examples, not evidence that new code inherits their conclusions.

## Reuse and remaining gaps

| Foundation need | Reuse now | New work or explicit future scope |
| --- | --- | --- |
| Bounded deterministic graph | Closed compiler vocabulary, canonical hashes, reference checking, artifact verification. | A separate small coordination schema and evaluator with explicit DAG/node/edge/depth/text limits and deterministic `all`, `any`, `threshold`, level, district, and elapsed gates. Existing graph node types do not become coordination types by import. |
| Activation | Verified immutable artifacts plus independently recorded active pointers and history. | Distinct activation/enablement policy for coordination. Default-off foundation must not activate existing content or chain features. |
| Private runs | Auth principal, current-character wrappers, stored scope identity, safe projections. | Coordination-owned persisted run state and immutable owner tuple, including deliberate death/replacement behavior. |
| Commands and history | Item receipts, content revisions, write-once narrative state, transaction-aware audit precedents. | Atomic coordination replay receipt and append-only transition audit with restart and ambiguous-result recovery. |
| Cooperation and approvals | Crew/Family membership resolvers, role uniqueness, consent, quorum, private boards. | General threshold approvals, delegated authority, revocation, asynchronous participant operations, and cross-scope permissions remain future features. |
| Knowledge and provenance | Role-private evidence, exact definition hashes, narrative facts, immutable item history. | First-class knowledge objects, provenance chains, trust policies, controlled disclosure, and evidence authenticity are not supplied by a generic facts table. |
| Contracts and automation | Domain-specific heists, bounty/debt escrow, worker sweeps, issued Agent Turn actions. | A generic contract engine, cross-system command executor, delegated autonomous authority, and durable workflow scheduler are not current features. |
| Large graph scale | Corpus budget checks, public-read memoization, database indexing precedents. | Massive branching, bulk evaluation, pagination/cursors, queue partitioning, load budgets, and observable backpressure require separate design and measurement. |
| AI-generated candidates | Closed compilers and operator activation barriers. | Candidate generation, validation reports, review history, trust thresholds, and automatic promotion policies are future scope. Untrusted candidate content cannot grant itself execution authority. |

The initial distinct value-neutral coordinator can reuse the repository's authentication, deployment, test conventions, and server-derived identity checks while adding only its own bounded definitions, persisted private runs, replay receipts, and audit. Broader knowledge, cooperative contracts, funds/items, and asynchronous multi-party orchestration require explicit adapters and proofs at the existing authority boundaries.
