# World Graph Phases 2 and 3 Program Design

## Status

The architecture was approved in conversation on 2026-09-04, and the user subsequently explicitly approved the written designs and implementation. This document binds the Phase 2A–2E and Phase 3A–3E design specifications. Implementation is in progress; that approval does not mean Phase 2 or Phase 3 is complete. Where a sub-phase document is ambiguous, this program design and the Phase 1 design invariants take precedence.

This program is prepared on branch `codex/world-graph-phases-2-3`, based on Phase 1 commit `0bdc0af79261fbbb00acab5e4516747f40cbe365`. On 2026-09-07 the user explicitly confirmed the automatic production-deployment side effect and gave standing approval to push and merge completed, reviewed pieces into `main` going forward. Existing specification, quality, security, local-verification, and exact-head CI gates remain mandatory. Normal releases need no repeated merge/deployment approval; this supersedes earlier approval-pending wording in the program's documents. Content-package activation, seasonal OMR rewards, NFT-contract deployment, and chain activation remain separately gated and are not implied by a code release.

## Objective

Extend the Phase 1 world graph and item ledger into two connected systems:

1. A broad, RuneScape-like production economy in which economically important objects have useful sources, processing stages, specialist production, use, maintenance or consumption, sinks, and durable history.
2. A large authored mystery network in which individual, Crew, Family, and seasonal investigations combine deduction, private evidence, social coordination, world state, and the production economy.

The result must deepen OMERTÀ without turning authored content into executable application code, weakening item conservation, or creating a new OMR emission rail.

## Specification set

This program design is implemented through the following normative documents:

- [Cross-cutting architecture and verification](2026-09-04-world-graph-phases-2-3-cross-cutting-design.md)
- [Phase 2A — materials, versioned inventory, and salvage](2026-09-04-world-graph-phase-2a-materials-salvage-design.md)
- [Phase 2A — lot integration amendment and exact Crew precedence](2026-09-07-world-graph-phase-2a-lot-integration-amendment.md)
- [Phase 2A — exact lot quality, candidate, and lineage contracts](2026-09-07-world-graph-phase-2a-lot-contract-amendment.md)
- [Phase 2B — professions, discovery, and blueprints](2026-09-04-world-graph-phase-2b-professions-blueprints-design.md)
- [Phase 2C — facilities, crafting, quality, durability, and repair](2026-09-04-world-graph-phase-2c-workshops-crafting-durability-design.md)
- [Phase 2D — ammunition, contraband, and equipment](2026-09-04-world-graph-phase-2d-ammunition-contraband-equipment-design.md)
- [Phase 2E — trade, services, social production, provenance, and NFT readiness](2026-09-04-world-graph-phase-2e-trade-social-provenance-nft-readiness-design.md)
- [Phase 3A — mystery runtime and evidence boards](2026-09-04-phase-3a-mystery-runtime-evidence-board-design.md)
- [Phase 3B — Crew and social puzzle primitives](2026-09-04-phase-3b-crew-social-puzzle-primitives-design.md)
- [Phase 3C — Family and hierarchical investigation](2026-09-04-phase-3c-family-hierarchical-investigation-design.md)
- [Phase 3D — dynamic world state and cross-season mysteries](2026-09-04-phase-3d-dynamic-cross-season-mystery-design.md)
- [Phase 3E — authoring pipeline, starter corpus, and Content Desk](2026-09-04-phase-3e-authoring-corpus-content-desk-design.md)

The cross-cutting document controls safety, transaction, compiler, migration, verification, and stop-gate questions. A sub-phase document controls its product and runtime domain. Any unresolved contradiction blocks implementation until the design is amended and reviewed.

## Binding invariants

1. Authored packages contain data only. Arbitrary JavaScript, SQL, templates with execution authority, shell commands, and general expressions are forbidden.
2. The authored compiler and activation system define content. Small, allowlisted runtime adapters define the mutations that content may request.
3. The generic world-graph item ledger is authoritative for all new value-bearing Phase 2 inventory. `collection_log` remains a status and completion ledger.
4. A logical asset has one authoritative ownership state. Legacy authored workshop lots remain an isolated, gameplay-inert compatibility system until deliberately migrated; they do not become a second Phase 2 inventory.
5. Every value-bearing mutation is one database transaction guarded by a domain idempotency record committed with its inputs, outputs, currency legs, progression, condition changes, escrow changes, provenance, and replay result.
6. Items and materials conserve across acquisition budgets, crafting, transfer, escrow, use, repair, destruction, salvage, and project completion. Quality or rarity upgrades cannot evade conservation merely by preserving unit count.
7. OMR is not a material, recipe output, mystery reward, random drop, timed faucet, repeatable emission, service payment, or project reward in Phases 2 or 3. Activatable Phase 2/3 profiles reject OMR effects.
8. Social gates are revalidated by the server and use distinct authenticated accounts. Client-visible roles or evidence never grant authority by themselves.
9. Packages must pass the same static and activation validators before they can load. Source files and builds never activate themselves.
10. Normal inventory remains database-native. NFT readiness applies only to selected unique instances and adds no Phase 2 export route or contract.
11. In-flight work, operations, and mysteries remain pinned to immutable definitions. A later activation cannot silently reinterpret their inputs, outputs, gates, answers, or rewards.
12. Existing lore, economy ledgers, transaction architecture, PostgreSQL behavior, pg-mem conventions, browser/mobile behavior, and unrelated user changes are preserved.
13. This repository is public. Production canonical solutions, private evidence bodies, secret graph structure, and secret-bearing dependency details live only in a separately access-controlled content overlay and trusted server artifact store.

## Chosen architecture: staged convergence

Phase 1 contains a generic, value-bearing world-graph lane and an exact-hash authored-content lane whose Bellini workshop inventory is intentionally inert. Phase 2/3 will not grow these into competing economies and will not begin with a disruptive rewrite of every existing content package.

Instead, all new definitions pass through one compiler and activation plane:

```text
public authored JSON packages + access-controlled secret overlays
  -> automatic discovery and strict schema validation
  -> qualified canonical graph IR
  -> exact-hash dependency lock
  -> structural, privacy, social, economy, recovery, and difficulty validation
  -> sealed server bundle + safe public projection + runtime indexes + reports
  -> operator activation
  -> allowlisted capability adapters
  -> PostgreSQL-authoritative state and ledgers
```

Existing direct Phase 1 crafting, mystery, and operation routes remain compatibility surfaces while equivalent authored adapters are proven. New content does not increase their custom-route surface.

## Definition and dependency policy

- Stable logical identifiers are package-qualified in compiled output.
- Authors may use package-local identifiers; the compiler resolves them explicitly.
- Cross-package imports declare compatibility intent. A safe public lock subset is committed here; a private exact lock pins secret-bearing dependencies in the access-controlled overlay. A signed access-controlled trusted-build attestation binds both to one non-self-referential `bundleHash`; the public repository receives only an opaque non-oracular attestation ID/status.
- Active definitions are immutable. Replacement produces a new definition version, definition hash, and containing `bundleHash`.
- One player experience normally occupies one package. Reusable materials, item definitions, profession definitions, evidence vocabularies, and other shared definitions may use library packages.
- An in-flight instance or job always uses its pinned definitions. Migration is an explicit, separately reviewed operation, never an activation side effect.

## Canonical state boundaries

### Item authority

The generic item subsystem owns Phase 2 lots, unique instances, item custody, item mutation guards, and item provenance. Definition versions prevent incompatible items from merging. Lots preserve economically relevant ancestry without putting unbounded history on hot rows.

### Content authority

Compiled bundles own immutable definitions, safe projections, answer specifications, graph indexes, and validation reports. Activations select which exact bundle is discoverable for new work. They do not rewrite live state.

### Runtime authority

Runtime adapters interpret only declared capability operations. They resolve dynamic state, authorize actors, lock rows in the global order, execute a single database transaction, append events, and return a stored replay result.

### Knowledge graph

The compiler emits a deterministic manifest for repository knowledge and impact analysis. That graph is documentation and release-governance input, not gameplay authority.

## Global transaction and lock order

Every Phase 2/3 mutation uses the same acquisition discipline:

The approved [Lot Integration Amendment](2026-09-07-world-graph-phase-2a-lot-integration-amendment.md) inserts an optional exact Crew-authority prefix after non-locking immutable resolution and before the first character row. Resolve the complete Crew set first, lock it by canonical Crew ID, and recheck invitation/membership after account locks. Drift or late Crew/participant discovery requires whole-transaction restart. This narrow precedence preserves the numbered suffix and its social, organization, aggregate and item ordering; it is not a general organization-first exception. Task 5 applies trusted exact target-Crew hooks to invite acceptance, preserves existing Crew-first lifecycle hooks and the opener's `FOR NO KEY UPDATE`, and retains accrual's explicit no-late-Crew-write rule. Complete trace/race evidence must cover the prefix and historical-role/rejoin schedule.

1. Resolve immutable IDs with non-locking reads.
2. Lock participating character rows in canonical ID order.
3. Lock participating account rows in canonical account-ID order.
4. Lock social-independence account-mapping rows by account ID/generation, then subject-generation rows by subject ID/generation, when independent participation is a prerequisite.
5. Lock organization and owner aggregates in canonical type-and-ID order.
6. Lock or create the domain mutation guard.
7. Lock the job, facility, project, service, listing, or mystery-instance aggregate.
8. Lock item lots and unique instances in canonical composite-key order.
9. Lock shared budgets, source epochs, project stages, taxes, or other singleton resources last.
10. Revalidate every prerequisite under lock; mutate inputs, outputs, state, and ledgers; store the replay result; commit once.

New code must not create an inverse lock edge. A task that cannot obey this order requires an architectural review before implementation.

## Product decisions

### Professions

The production profession set is Salvage, Mechanics, Machining, Armory, Garmentwork, Medicine, Presswork, Finework, and Construction. Existing Chemistry, Wheels, Commerce, and other relevant masteries remain co-requisites instead of being duplicated.

Operational proficiency is character-scoped and extends the existing mastery/event model. Recipe knowledge may be account-, character-, or Family-scoped as its definition declares. Specialization comes from progression cost, real consumptive work, facility capacity, Path affinity, and cross-profession projects—not an arbitrary prohibition against trying other professions.

### Quality

The bands are Rough, Serviceable, Fine, Superior, and Masterwork. Quality is primarily deterministic from inputs, profession, recipe, tools, facility, and mastery. Bounded server variance cannot be the primary path to a valuable result. Masterwork has explicit deterministic gates.

### Evidence privacy

Evidence is private by default. Every response surface uses the same server-side audience policy. Hidden structure may conceal identifiers, titles, edge endpoints, content, and node count. Explicit placeholders are allowed only when authored. Eligible evidence can be shared through a server-authorized action; client hiding is never security.

The runtime exposes opaque audience-specific projection cursors, not its canonical mutation revision. A hidden-only action neither advances another viewer's cursor nor invalidates an unrelated issued action. Caches, searches, pagination, stale responses, and deltas are bound to the caller's current authority and grant generations.

### Dynamic state

Content can use only versioned signals from an allowlisted server registry. Dynamic facts are snapshotted at instance start by default. A live-state gate is allowed only when declared and recoverable. Critical progression cannot depend permanently on an ephemeral external state.

### Social continuity

Organization identity and assigned roles are pinned, while current membership, living-character state, and current leader authority are rechecked when relevant. Long-running cases may declare timed, authorized seat replacement. Contribution remains attributed to the original actor and reward eligibility requires typed meaningful contribution rather than attendance or raw action count.

### Cross-season continuity

Seasonal identity uses season plus logical case key, independent of bundle version. Packages export and import typed durable facts through exact dependency locks. Required historical evidence has an in-game recovery mechanism. External community archaeology may enrich but never gate the critical path.

## Delivery slices

### Phase 2A — material taxonomy, inventory extensions, and salvage

Establish immutable item definitions, lot-aware fungible ownership, a purposeful starter taxonomy, expanded condition-aware vehicle salvage, compiler source/sink analysis, and exactly-once conservation.

### Phase 2B — professions, discovery, and blueprints

Extend mastery-backed specialization, anti-farm progression, distinct recipe knowledge, physical and fragmented blueprints, and account/character/Family knowledge policies.

### Phase 2C — facilities, deep crafting, quality, durability, and repair

Add first-class facilities, capacity and access, timed craft runs with normalized inputs and outputs, multi-stage recipes, quality, selected durability, and specialist repair.

### Phase 2D — ammunition, contraband, and equipment

Add abstract ammunition batches and consumption, fictional contraband logistics and law pressure, and balanced crafted equipment without real-world procedural manufacturing instructions or uncontrolled power growth.

### Phase 2E — trade, services, social production, provenance, and NFT readiness

Add a typed item market, service orders, project escrow, multi-account production, contribution history, expanded provenance, and unique-item export-eligibility state without export routes or contracts.

### Phase 3A — mystery runtime, evidence, and conspiracy boards

Converge new mysteries on the authored runtime, enforce private projections, add typed evidence and player-proposed relationships, structured theory submissions, indexed frontiers, and audience-bound projection-cursor deltas.

### Phase 3B — advanced Crew and social puzzle primitives

Add content-defined roles, asymmetric evidence, explicit sharing, ordered and concurrent branches, distinct-account gates, replacement policies, contribution accounting, and recovery-safe mutually exclusive choices.

### Phase 3C — Family aggregation and hierarchy

Add Crew completion receipts, bounded finding exports, Family conspiracy aggregation, organization-rank authority, hierarchical information flow, and Family theory resolution without leaking every private clue upward.

### Phase 3D — dynamic and cross-season support

Add the safe signal registry, snapshot/live policies, package imports and exports, exact dependency locks, durable facts, season migration checks, and in-game recovery for critical historical state.

### Phase 3E — authoring pipeline, corpus, and UI

Add automatic package discovery, disciplined package fixtures and reports, an evidence-board and production UI, and an initial target of 24 individual mysteries, 10 Crew cases, 4 Family conspiracies, and 1 deep seasonal meta-mystery. Depth and review quality take precedence over quota.

## Development workflow

Each independently reviewable task follows this gate:

1. The approved sub-phase design is decomposed into a detailed plan.
2. A fresh specialized implementer writes a failing test first.
3. The implementer makes the smallest coherent implementation and runs focused tests.
4. A fresh reviewer checks specification compliance.
5. The implementer resolves every compliance finding.
6. A different fresh reviewer checks code quality, transaction safety, security, PostgreSQL behavior, and maintainability.
7. The implementer resolves all Critical and Important findings.
8. Focused and relevant regression tests pass.
9. The integration agent reviews the diff and makes the task commit.

Schema and runtime tasks integrate sequentially. Content packages may be authored in parallel only after their compiler/runtime contract is stable and only on disjoint package paths. One integration head remains authoritative.

## Program verification gates

Phase 2 cannot complete until focused tests, pg-mem, real PostgreSQL, replay and concurrency races, conservation invariants, source/sink reports, market and escrow tests, durability/repair tests, provenance replay, economy simulations, population-scale simulations, backup/restore checks, route tests, changed browser/mobile surfaces, and the full repository suite pass.

Phase 3 cannot complete until authored graph reachability, role feasibility, evidence noninterference across read/mutation/stale/replay/error/live paths, social distinct-account enforcement, contribution eligibility, branch recovery, dynamic-signal replay, cross-season compatibility, package dependency locking, real-PostgreSQL contention, large-corpus browser behavior, synthetic 10,000-node validation, malicious-package rejection, and the full repository suite pass.

The final red-team pass attacks material and item duplication, salvage/craft/trade/repair replay, escrow duplication, unique-item double ownership, exported/off-chain split ownership, social alt abuse, role bypass, passenger rewards, private evidence leakage, reward replay, impossible and dead-end graphs, destructive unique-item soft locks, inflation, OMR leakage, and unauthorized content execution.

## Baseline portability task

A fresh Windows checkout currently exposes a Phase 1 test that assumes LF-only source lines. The implementation behaves correctly; the source-inspection test does not accept CRLF. Before feature work, Task 0 will add a failing portability regression and make the assertion newline-agnostic. It is a test portability correction, not a production runtime change.

## Completion and stop condition

After all sub-phases pass their gates, the strongest available whole-branch review must be performed. Every Critical and Important finding must be resolved and reverified. Final delivery reports architecture, schema, material and profession catalogs, recipes, facilities, item systems, social production, mystery systems, package counts, graph validation, simulations, security findings, tests, known deferrals, branch, and commits.

The final whole-program delivery then stops. Incremental reviewed merges and their automatic production deployments may proceed under the user's standing 2026-09-07 approval, with verification and CI gates intact and release status reported honestly. Content-package activation, seasonal OMR activation, NFT-contract deployment, and chain activation still require separate explicit approval.
