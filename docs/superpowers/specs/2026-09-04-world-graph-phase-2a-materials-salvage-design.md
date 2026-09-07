# Phase 2A — Material Taxonomy, Versioned Inventory, and Vehicle Salvage

## Status and scope

This specification defines the first independently reviewable increment of the approved Phase 2 world-graph expansion. It depends on the Phase 1 world-graph and item-economy foundation and establishes the canonical definitions, inventory versioning, material catalog, salvage runtime, and static economy analysis required by all later Phase 2 work.

Task 3's sealed-artifact registry, immutable definition membership, definition-plane selection, and associated transaction/read/invariant contracts are amended by [Phase 2A Definition Registry Amendment](2026-09-07-world-graph-phase-2a-definition-registry-amendment.md). That amendment takes precedence over conflicting Task 3 wording in this specification and the Phase 2A implementation plan. It preserves the remaining Phase 2A scope and legacy-runtime boundaries. Task 3 executes as three reviewable increments within the existing Phase 2A plan; Task 4 begins after all three pass their review and verification gates.

Phase 2A does not add professions, recipe discovery, facilities, player markets, social production, or mystery content. It creates the safe substrate those systems use.

The binding architectural choice is staged convergence:

- source-controlled JSON packages are the authoring plane;
- a strict compiler produces immutable, exact-hash server bundles and safe public projections;
- allowlisted runtime capability adapters perform mutations;
- the generic item ledger is the only authoritative store for Phase 2 value-bearing inventory;
- the earlier Bellini exact-hash workshop inventory remains a legacy, gameplay-inert sandbox and is not extended into the general economy.

Nothing in this phase merges, deploys, activates a bundle, emits OMR, or creates an NFT.

## Goals

Phase 2A must:

1. Introduce automatic authored-package discovery and one validation path shared by local tooling, CI, and activation.
2. Compile package-qualified logical identifiers and exact-hash dependency locks into a canonical intermediate representation.
3. Version item definitions immutably and make definition hash part of inventory identity.
4. Replace aggregate-only fungible storage with lot-aware authoritative inventory while preserving Phase 1 holdings.
5. Publish a coherent starter material taxonomy in which every material has an acquisition path, meaningful use, sink, rarity, trade rule, owner scope, and quality rule.
6. Expand car salvage into data-defined, model/class/condition-sensitive output profiles.
7. Prove that a car can be salvaged exactly once under retries and concurrent requests.
8. Produce source, sink, orphan, scarcity, conservation, and reachability reports before a package can activate.

## Authoring and compiler architecture

### Package discovery

The compiler discovers packages beneath `content/packs` from manifests rather than a hand-maintained `package.json` command. A package not discovered by the canonical walker must not be activatable by another route.

Discovery rules are deterministic:

- symbolic links outside the content root are rejected;
- manifest and content files must use supported extensions and bounded sizes;
- duplicate package IDs or logical node IDs fail compilation;
- filesystem traversal order does not affect the compiled hash;
- packages beneath server-owned approved fixture roots are assigned a non-activatable profile; authored data may declare the expected fixture kind for reconciliation but cannot grant or elevate its own activation authority;
- every production package is compiled by the same command used in CI.

### Canonical intermediate representation

Authored IDs are package-qualified during compilation. Human-friendly local references are resolved to canonical IDs before hashing. The compiler emits:

- a sealed server bundle containing private and authoritative fields;
- a safe public projection with secrets and operator-only fields removed;
- an exact-hash dependency lock;
- indexed node, recipe, source, sink, and item-definition tables;
- a reachability report;
- a material source/sink and orphan report;
- an economy/conservation report;
- a knowledge manifest for repository documentation and graph tooling.

Package imports may express an accepted logical compatibility range, but the committed compiled lock resolves every import to one exact dependency hash. Runtime instances and economic mutations use the resolved exact hash, never a floating package version.

The compiler and activation service must call the same complete validation entry point. It is unacceptable for `content:check` to pass a package that activation rejects because a second validator was omitted.

### Safe content language

Packages contain declarative data only. They may name registered condition and effect capabilities with schema-checked arguments. The following are rejected at parse time or validation time:

- JavaScript or other executable source;
- SQL or database identifiers chosen by content;
- shell commands;
- templating with arbitrary evaluation;
- network locations used as mutation inputs;
- unknown adapters or adapter arguments;
- prototype-polluting keys;
- unbounded recursive expressions.

## Item definition model

Every economic object has a stable logical item ID and one or more immutable definition revisions.

The authoritative definition record is conceptually `item_definition_versions` with:

- `logical_item_id`;
- positive `definition_version`;
- `definition_hash`;
- `package_id` and exact owning `bundleHash`;
- `kind` (`material`, `component`, `consumable`, `tool`, `equipment`, `blueprint`, `unique`, or another allowlisted class);
- `family` and tags;
- rarity;
- stackability;
- trade policy;
- permitted ownership/custody scopes;
- quality mode;
- maximum stack or lot quantity;
- optional conservation/scarcity class;
- compact public metadata;
- creation timestamp.

The database enforces uniqueness for both `(logical_item_id, definition_version)` and `(logical_item_id, definition_hash)`, and activation versions are monotonic. An active package can select the current revision, but it cannot mutate an older definition. Existing lots and instances remain pinned to the revision that created them.

Definitions are source-controlled and compiled. Database rows cache activated immutable definitions and hashes for referential integrity; operators cannot hand-edit them into a different meaning.

## Authoritative fungible lots

Phase 1 `item_stacks` aggregate by owner, template, and quality. That is insufficient once definition versions, source quality, escrow, and provenance matter. Phase 2A introduces authoritative `item_lots`.

Each lot contains:

- permanent lot ID;
- logical item ID and exact definition hash;
- owner scope and owner ID;
- quality band where applicable;
- quality-state digest for any economically meaningful numeric quality state;
- exact trade-policy version/hash;
- binding and transfer restriction;
- season/run or source-cap identity when economically relevant;
- expiration timestamp or immutable age basis where applicable;
- provenance-coalescing class;
- explicit custody scope and custody reference when not directly spendable;
- original quantity and remaining quantity;
- lot state (`active`, `escrowed`, or `exhausted`);
- source mutation ID and output ordinal;
- compact provenance class/digest;
- creation and update timestamps.

An output is uniquely identified by `(mutation_id, output_ordinal)`. Replaying a successful logical mutation therefore resolves to the same output rather than creating another lot. The textual HTTP `Idempotency-Key` is scoped by authenticated account and server action kind; first use creates the immutable server `mutation_id` bound to actor/owner, normalized request, selected car or item authorities, and exact definition hashes. The same text used by another account or action kind is independent, while a changed digest in the same scope conflicts.

Consumption selects and locks eligible lots in a canonical FIFO order unless a server-issued action explicitly identifies a particular lot. The client cannot choose arbitrary hidden provenance or substitute a different definition hash.

Authoritative lots are never physically coalesced by changing an existing lot's immutable original quantity, deleting another lot identity, or rewriting its source mutation. Compatible lots are aggregated only in read projections and deterministic FIFO selectors. Two lots may appear in one aggregate only when every economically relevant dimension matches: logical item ID, definition hash, owner scope/ID, direct or custody state/reference, quality band and quality-state digest, exact trade-policy hash, binding/transfer restriction, season/run or source-cap identity, expiration/age basis, and provenance-coalescing class. Splitting preserves every dimension and source lineage.

`collection_log` may record that an item family was encountered, but it is never read as inventory authority.

## Unique item extensions

Existing `item_instances` remain the unique-object authority. Phase 2A extends each instance with:

- exact definition hash;
- applicable quality band;
- optional condition summary reserved for Phase 2C;
- compact provenance summary/digest;
- creation mutation and output ordinal.

The one-row, one-state, one-owner rule remains binding. Unique rows are never reused for a different item and are not deleted after consumption.

## Mutation and provenance records

The existing domain-level `item_mutation_guards` remains the replay boundary and is extended with allowlisted Phase 2 mutation kinds rather than bypassed.

Normalized mutation input and output records must identify:

- mutation guard;
- input or output ordinal;
- lot or unique instance;
- definition hash;
- quantity and quality;
- external asset identity where a non-item asset such as a car is consumed.

`item_events` remains append-only. It records direction, owner/custody changes, definition hash, lot or item identity, reason, and mutation key. Hot inventory rows retain only compact current state.

### Global lock order

Every Phase 2 value mutation follows the cross-cutting order; this local inventory copy keeps the optional social class explicit even though Phase 2A salvage does not use it:

1. Resolve immutable definitions without locks.
2. Lock character rows in canonical ID order.
3. Lock account rows in canonical ID order.
4. When a later social mutation relies on independent participation, lock social-independence account-mapping rows by account ID/generation, then subject-generation rows by subject ID/generation.
5. Lock organization rows in canonical ID order when present.
6. Claim and lock the economy mutation guard.
7. Lock the action aggregate, such as the salvage target or future job/listing.
8. Lock lots and unique items in canonical ID order.
9. Lock shared budgets or singleton state only when required.
10. Write inventory, economic, and provenance events; store the replay result; commit.

No adapter may invert this order by wrapping the item mutation inside a conflicting outer character or asset lock. The shared lock trace asserts the same class, subrow-type, key, ID, and generation order defined by the cross-cutting contract.

## Migration and compatibility

The migration copies every nonzero Phase 1 `item_stacks` row into one deterministic legacy lot pinned to the corresponding immutable Phase 1 definition revision. It also backfills every legacy unique `item_instances` row to an immutable compatibility definition while preserving the canonical item ID, owner, custody, and state exactly. The unique-item quality is derived by one documented deterministic compatibility rule, and its compact provenance version truthfully records a migration-origin event; it never invents an unproven historical crafter, source, or creation event. It then verifies per-owner, per-template, per-quality stack totals plus unique-instance identity/owner/state counts and digests before the lot runtime becomes writable.

At the Phase 2A cutover:

- an explicit maintenance-window or deployment-epoch fence prevents concurrent Phase 1 stack writers before final reconciliation;
- all generic inventory reads and writes use `item_lots` and `item_instances` after a final locked reconciliation;
- the old aggregate table is renamed or otherwise made non-spendable and immutable;
- it may be retained temporarily as migration evidence, but it is not a second authority;
- compatibility responses aggregate active lots into the existing inventory response shape and may add lot detail additively;
- Phase 1 recipes, Belladonna, and salvage use the compatibility adapter backed by lots;
- existing item and operation IDs remain valid;
- existing in-flight mystery and operation custody remains recoverable.

If pg-mem cannot support a read-only compatibility view reliably, the server compatibility adapter queries and aggregates lots directly. A writable mirrored table is forbidden.

The cutover transaction records a lot-authority epoch and installs database write blocking or equivalent privilege enforcement for legacy stacks and obsolete unique-instance fields. Every new runtime process verifies that epoch before accepting value mutations. A real-PostgreSQL race test proves a legacy stack or unique-item write concurrent with cutover is either included in final reconciliation or rejected cleanly, never lost. A surviving old process fails closed rather than writing the retired authority. Backup/restore checks reproduce both the stack totals and the unique item identity/owner/state/provenance digests, and a migration rerun creates neither a second lot nor a second migration-origin event.

The earlier authored Bellini workshop tables are not migrated into economic lots in this phase because their content contract is deliberately gameplay-inert and exact-hash siloed. Their item IDs cannot be used by Phase 2 recipes or markets.

## Material taxonomy

The starter catalog should contain approximately 45–60 purposeful definitions across these families:

- ferrous scrap, processed steel, high-grade steel, and structural plate;
- brass, lead, copper, wire, springs, gears, bearings, fasteners, molds, dies, and machine parts;
- engine, drivetrain, suspension, body-panel, glass, rubber, and specialty vehicle parts;
- leather, cloth, treated fabric, wood, and protective inserts;
- paper, ink, printing stock, plates, seals, and binding materials;
- fuel, lubricants, packaging, warehouse, and construction supplies;
- medical and laboratory supplies;
- safely fictional contraband precursors, processing media, and packaging inputs;
- jewelry metals, stones, fine mechanisms, and rare precision parts;
- reusable tools, catalysts, rare mystery components, and blueprint fragments.

Every definition declares:

- at least one acquisition source;
- at least one concrete current or committed downstream use;
- an appropriate sink, consumption path, or durable-use declaration;
- rarity and source-cap behavior;
- tradeability and transfer restrictions;
- ownership/custody scope;
- whether quality applies and how source quality is assigned;
- whether it is safe for ordinary markets;
- whether it may ever be a unique/export-eligible object.

Definitions included only for a hypothetical future use fail the production profile unless marked as non-activatable development content.

## Vehicle salvage design

### Data-defined profiles

Car models are mapped to compiled salvage profiles by existing canonical model/class identifiers. Profiles define bounded yield ranges and rarity conditions for:

- ferrous scrap;
- wiring and copper;
- glass;
- rubber;
- engine and drivetrain components;
- suspension components and bearings;
- body panels;
- upholstery or fine materials;
- rare mechanical and specialty components.

Class identity determines the mix. Authoritative car damage and compatible tuning/condition values modify recoverability:

- higher damage shifts precision outputs toward lower-grade scrap;
- better preserved cars can retain more glass, panels, bearings, and engine components;
- model-specific specialty parts are possible only when declared by that model profile;
- tuning never creates more valuable material than the tuning system actually invested or a reviewed scarcity rule permits.

Randomness, when used for low-value mix variation, is server-side, auditable, and derived once from the logical mutation. Retrying cannot reroll. Rare output eligibility is bounded by the compiled profile and economy simulation.

### Exactly-once state transition

Salvage consumes an owned car through the existing locked car authority in the same database transaction that creates output lots.

The server must revalidate under lock that the car:

- exists and belongs to the living authorized character;
- is not listed, pledged, racing, already consumed, or in an incompatible on-chain/export state;
- satisfies the server-selected salvage profile;
- has not been consumed by another mutation.

The external-asset input record permanently binds car ID to the completed salvage mutation. A unique database constraint prevents a second completed consumption of the same car even if a second idempotency key is used. HTTP idempotency alone is not sufficient.

The transaction either consumes the car and creates every output/event, or performs neither. No partial salvage result is visible.

## API and capability surface

Phase 2A preserves the Phase 1 routes and adds only additive data required for versioned inventory:

- `GET /v1/worldgraph/inventory` returns aggregate holdings and, where requested through a bounded query, exact lots and unique instances.
- `GET /v1/worldgraph/materials` returns activated safe material definitions, sources, uses, rarity, trade rules, and discovery-safe blockers.
- `GET /v1/worldgraph/salvage` returns server-issued eligible-car actions with recipe/profile hash, expected output bands, blockers, and an opaque action identity.
- `POST /v1/worldgraph/recipes/:recipeId/salvage/:carId` remains supported during compatibility; it requires an `Idempotency-Key` and revalidates current authority.

Clients never send output item IDs, quantities, quality, condition, rarity rolls, car condition, or definition hashes. A no-secret package may require its expected active `bundleHash` solely for stale-content detection; a secret-bearing package uses a safe public version/`publicManifestHash` and opaque action authority bound to the private `bundleHash` internally.

The registered runtime capability vocabulary in this phase is limited to definition lookup, lot grant/consume/transfer, unique creation/consume/transfer, collection-status observation, and car salvage. Authored packages cannot call database primitives directly.

## Static validation and reports

Activation fails on:

- unresolved or floating dependencies;
- duplicate canonical IDs;
- mutable reuse of an existing definition hash;
- item kinds incompatible with stackability;
- owner scopes without a complete lifecycle;
- negative, zero, overflowing, or non-integral quantities;
- a required material with no reachable source;
- an economy material with no sink or declared bounded durable use;
- zero-cost or upgrading cycles that create conserved value;
- unique outputs represented as stack quantities;
- a salvage profile with no matching car source or no sink for its material mix;
- an OMR cost, output, effect, or indirect reward capability;
- any unknown or executable content.

Warnings include excessive accumulation, one overwhelmingly dominant source, dead low-quality bands, and material families with only one economically meaningful consumer. Production activation can promote configured warnings to errors.

Algorithms must be iterative and bounded. The synthetic validation fixture contains at least 10,000 nodes; compilation must not recurse on graph depth or copy full path witnesses into every node.

## TDD and verification

Implementation begins with failing tests for:

1. Automatic corpus discovery and unlisted-package detection.
2. CLI/CI/activation validation parity.
3. Exact-hash import locking and stale-content rejection.
4. Migration of Phase 1 stacks into deterministic lots with equal totals, plus every legacy unique row into an immutable compatibility definition with unchanged item ID/owner/custody/state, deterministic quality, truthful migration-origin provenance, idempotent rerun, backup/restore digest, and legacy-writer cutover race coverage.
5. Prohibition of physical lot coalescing and of aggregate/split recombination across hash, quality state, binding, trade restriction, season, expiry/age, source-cap identity, provenance class, owner, or custody.
6. FIFO and exact-lot consumption.
7. Mutation output uniqueness under replay.
7a. Account/action-scoped transport identity: the same textual key used by two accounts or two action kinds remains independent; the same scoped key with a changed normalized digest conflicts; crash-window and archived-result replays return one semantic result.
8. Car salvage by class, model, damage, and compatible tuning state.
9. Same-key replay returning the original output and random seed result.
10. Different-key concurrent salvage of one car producing one winner and no duplicate materials.
11. Transaction rollback after injected failure at each salvage write boundary.
12. Source/sink/orphan and conservation validator failures.
13. Rejection of JavaScript, SQL, unknown adapters, prototype-polluting objects, and OMR effects.
14. Synthetic 10,000-node compilation with bounded time and memory.

Required verification includes focused unit and API tests, item invariants, pg-mem clean-start and migration tests, real PostgreSQL migration and concurrent transaction tests, backup/restore critical-table assertions, economy simulations, and the full existing repository suite.

The known Windows line-ending failure in `test/worldgraph-api.js` is repaired first as a separate red-green portability task; the test must accept LF and CRLF without weakening the source-contract assertion.

## Economy and red-team acceptance gates

Phase 2A is complete only when reviewers cannot reproduce:

- material creation without a declared source;
- cross-version lot merging;
- integer overflow or negative inventory;
- salvage replay with one or multiple idempotency keys;
- car survival after successful salvage;
- partial output after rollback;
- duplicate rare-output rerolls;
- use of Bellini inert lots as economic inventory;
- collection-log spoofing as inventory;
- unauthorized adapter execution;
- OMR or unledgered cash movement.

The source/sink report must contain no production errors. Economy simulation must show bounded material generation for the starter salvage population and identify configured consumption assumptions for every material family.

## Explicit non-goals

Phase 2A does not include:

- profession progression or specialization;
- recipe discovery or learned knowledge;
- blueprint assembly or trading;
- facilities, timed crafting jobs, quality upgrades, durability, or repair;
- ammunition or contraband production;
- player item markets or service commissions;
- Crew or Family project inventory;
- broad dismantling of weapons, businesses, buildings, or other assets;
- OMR rewards or any new OMR movement;
- NFT contracts, minting, exporting, or on-chain normal inventory;
- production activation or deployment.

## Exit criteria

Phase 2A exits only when the compiler/activation path is unified, all generic Phase 1 holdings are preserved in the sole lot authority, the material catalog has no orphan or invalid source/sink paths, salvage is transactional and exactly-once on pg-mem and real PostgreSQL, all Critical and Important review findings are resolved, and the branch remains unmerged and undeployed.
