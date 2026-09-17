# Core architecture execution record

Source baseline: `e56cf576065c5f1bbb9bb55115f5961267f7d654` (`origin/main`, 2026-09-17).
Working branch: `codex/core-architecture-20260917`. No production activation or deployment.

## Dependency order and current gate

1. World Graph Kernel: component completion gate passed; source checkpoint and revision-stamped knowledge generation pending. Repository-wide release gates have the baseline failures recorded below.
2. Coordination Engine Core: not advanced during this gate. Existing crew operations and private coordination/knowledge pilots are retained.
3. World Projection Layer: not advanced during this gate. Existing domain boards are retained; the new graph query is an internal foundation.
4. Mystery/crafting/economy/social framework: not advanced during this gate. Existing static and authored-content engines are retained.
5. Hardening/UX: only foundation correctness/security work has been performed.

Repository documents use different phase numbering. A historical “Phase 1” label does not imply this execution plan's gate is complete.

## Architecture and public interfaces

- `worldgraph.js` owns immutable authored definitions. `world-kernel-query.js` resolves a bounded player-specific graph from existing domain tables, using stable encoded references. It stores no copies of accounts, characters, Crew/Family membership, inventory, knowledge, mystery or operation state.
- `createWorldKernelQuery({pool, knowledge?, registry?}).snapshot(accountId, {limit?})` returns version 1 nodes, typed relationships and explicit truncation flags. Authentication supplies `accountId`; the client cannot nominate another inventory owner. Snapshot consistency uses one PostgreSQL repeatable-read transaction.
- Current Crew affiliation to a Family is derived only when every living member belongs to that Family. It is a query fact, not permanent affiliation or delegated mutation authority. Mutations lock and recheck current memberships.
- Existing accepted, unexpired Family pacts appear as `alliance` relationships with `kind: pact`; active wars appear as rivalries. Public coalition summaries retain their existing target/count visibility and disclose only the requesting Family's membership edge. Current-Crew weekly objectives use the original `(crew_id, week)` identity, deterministic unmaterialized fallback and own contribution fields. A single server timestamp governs expiry and week selection. These views grant no diplomatic or objective mutation authority.
- `createWorldKernel({pool, registry, objects, enabled, knowledgeEnabled, sharingEnabled, accountIds})` provides `list(accountId)`, `get(accountId, objectId)` and `execute(accountId, {objectId,actionId,itemId,expectedRevision}, key)`. Only compiled state transitions can change physical objects; a current boss/underboss, a uniform living Crew, location, authentic knowledge, own item and required materials are checked server-side.
- `compileWorldObjects` defines facility/workshop/object identity, location, states, visibility and transitions. Existing territory/economy tables remain authoritative for their domains. New physical objects live in `world_kernel_objects`; immutable transitions live in `world_kernel_events`.
- `withItemTransaction` remains the sole transaction owner for world actions, item consumption, provenance and retry receipts. Item guards namespace logical world keys by authenticated account. Events commit with state; process-local `world:changed` notifications are invalidation hints only.
- `normalizeKnowledgeRequirement` pins a discovery content hash, domain, proposition, source root and typed value. `createCoordinationKnowledge().matchesRequirements` checks original authenticated claims under current ACL/membership locks. It locks the complete candidate union in global ID order. No knowledge is copied or minted by crafting.
- Crafting adds the `knowledge` condition adapter and server-configured knowledge/sharing/cohort switches to `createCraftingContext`. `recipeCatalogForPlayer` supplies a truthful, redacted board. `craftWorldGraphRecipe` and `salvageCar` retain their existing mutation contracts and re-evaluate knowledge inside the transaction.
- `worldKernelInvariants` reconciles current object state, contiguous revisions, immutable events, consumed items and durable receipts in a consistent snapshot. The existing invariant sweep includes it.

Domain equivalents are intentional: players retain their account/current-character split; districts represent territory and location; physical objects use facility/workshop/object kinds; item instances and resource balances remain in the existing item ledger; knowledge claims carry discovered information and authenticated source evidence; mysteries and operations remain references to their existing engines. No duplicate alliance, clue, inventory, objective or location store was introduced.

## HTTP contract and pilot

All new endpoints require authentication and `WORLD_GRAPH_KERNEL=on`; the existing coordination cohort is honored. Mutation endpoints require a fresh `Idempotency-Key` per logical action and exact retries retain it.

- `GET /v1/worldgraph/state`
- `GET /v1/worldgraph/objects`
- `GET /v1/worldgraph/objects/:objectId`
- `POST /v1/worldgraph/objects/:objectId/actions/:actionId` with `{itemId,expectedRevision}`
- `GET /v1/worldgraph/kernel/recipes`
- `POST /v1/worldgraph/kernel/recipes/:recipeId/craft` with an absent or empty JSON object body

The optional Foundry Archive pilot reuses Split Ledger discovery and canonical salvaged steel/wire. Learning the original Docks claim enables cutting an Archive Turn Key at the Foundry. A qualifying Family command consumes its own key and wire, opens the archive, records current control, and makes the object visible to other players. It creates no currency or resource faucet. Existing static recipe/mystery/operation endpoints are preserved.

Knowledge-gated play additionally needs `COORDINATION_ENGINE=on` and `COORDINATION_KNOWLEDGE=on`; shared evidence additionally needs `COORDINATION_KNOWLEDGE_SHARING=on`. All switches default off. Installation alone enables nothing.

## Verification retained so far

- Existing graph, validation, item, crafting, mystery, operation, Belladonna and worldgraph HTTP baselines passed.
- Native PostgreSQL Belladonna rollback, duplicate completion and provenance proof passed.
- New query, knowledge/crafting, mutable-command, world-action and HTTP suites pass individually. An explicit-null HTTP regression initially failed and was corrected; its affected suite passed afterward.
- Native PostgreSQL 16.15 and 18 new suites pass: full social/salvage/discovery/crafting/action journey; new connection/service persistence; same-key and different-key races; forced failures after world update and event insertion; both lock orderings against real Family kick, Crew departure and knowledge revoke.
- Upgrade from the exact baseline schema, repeated migration, preserved legacy provenance, post-migration replay, FK/negative-revision constraints, Family dissolution and deliberate invariant-corruption detection pass.
- PostgreSQL 16's full existing `pgcheck` passes 203 checks, including the established Belladonna flow, ledger, pooling, migration, lock and rollback checks.
- A PostgreSQL 16 custom-format backup restored into a separate database preserves world state/control, consumed-item provenance, exact retry receipt, event count and invariants. This used isolated local databases and made no production changes.
- The first full `npm test` stopped at old crafting fixtures that omitted account rows. The fixtures now create active accounts; missing/banned-account refusal and same-key retry after activation are explicitly tested. Crafting, mystery, operation, Belladonna and native-helper regressions passed. A supplemental run is executing every remaining lifecycle command and retaining failures individually; this record does not assert a full-suite pass.
- Baseline `test/gates.js` fails on unchanged `bonds.js:bondQuoteBudgetAmount`. Baseline `test/routes.js` fails on unchanged homepage research-sheet expectations. Both failures were reproduced on the clean original checkout; they are not hidden or waived.
- The static SQL engine prepares all 3,804 current statements successfully. Its separate interpolation-count gate fails at 185 against ceiling 168; unchanged baseline already fails at 183. The two additional interpolated statements use reviewed source-owned visibility fragments or generated bound-parameter lists, are exercised natively, and are not waived by a ceiling change. All query-facade SQL is static. The independent review addendum records the remaining baseline static failures.
- JavaScript syntax checks pass for all 26 changed JS files; `git diff --check`, documentation census, preflight, content corpus/graph validation, content build and idempotent schema migration pass. This JavaScript package defines no separate TypeScript or lint script; no `tsc` or linter execution is claimed.

## World Graph component completion evidence

The component gate is supported by the focused suites, not a claim that the whole repository is green. Native persisted state plus backup/restore establish durability; encoded typed domain references and hash-pinned object definitions establish identity; the single item transaction, constraint/migration tests, observed races and exact-key receipts establish atomicity, concurrency and retry behavior; conserved item events and the invariant sweep establish provenance and state reconciliation; authentic claim/source/ACL tests and per-reader facade tests establish knowledge and visibility. The real social/salvage/discovery/crafting/Family-action slice passes on PostgreSQL 16 and 18. Public query and command interfaces are recorded above. All newly added and directly affected functional suites pass after the documented fixture correction; broader lifecycle verification remains recorded separately.

## Migrations, limits and deployment notes

`schema.sql` adds two tables and extends the existing item guard kind constraint with `world_action`. Physical control has a nullable Family FK with `ON DELETE SET NULL`; events retain historical Family/actor identities. Mutation and consumed-item FKs connect world events to established provenance. Existing object definitions are hash-pinned and fail closed on incompatible replacement.

Tests use separately initialized loopback PostgreSQL 16.15 and 18 clusters and disposable per-suite schemas. The declared CI major, PostgreSQL 16, passed the native kernel and full server checks. The native kernel runner is included in that existing CI job. No existing application database was used.

After new world-action receipts exist, an older build that reinstalls the old item-kind CHECK cannot simply boot against that database; use a compatible roll-forward build or restore a matching pre-upgrade backup. Feature switches stay off until release acceptance. The isolated current-build backup/restore proof does not establish old-build downgrade compatibility. No production rollout is claimed.

Current bounds: at most 100 authored physical objects, 16 distinct knowledge requirements per kernel, 256 candidate claims, 4 living Crew participants per action. Queries expose truncation rather than claiming complete world traversal. Graph state and physical-object lists are separate snapshots; a later projection boundary must compose them without introducing inconsistent claim-lock ordering.

The in-progress exact-lot inventory cutover remains separate. These adapters consume only existing legacy item authority (`definition_hash IS NULL`) and never create a second lot store. Existing content and coordination pilots are not declared fully complete by this kernel work.
