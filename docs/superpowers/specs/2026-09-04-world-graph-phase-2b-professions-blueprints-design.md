# Phase 2B — Professions, Recipe Discovery, and Blueprint Knowledge

## Status and scope

This specification defines the second independently reviewable Phase 2 increment. It begins only after Phase 2A establishes immutable item definitions, authoritative lots, automatic package discovery, exact-hash dependency locks, and a green salvage/economy validation gate.

Phase 2B introduces production specialization and knowledge as economic resources. It extends OMERTÀ's existing skill and mastery architecture rather than creating an unrelated leveling game. It deliberately separates knowing a recipe from being able to execute it.

This phase does not implement facilities, long-running crafting jobs, broad equipment production, player markets, social projects, OMR rewards, or NFTs.

## Goals

Phase 2B must:

1. Define a compact set of professions that fit OMERTÀ's existing progression and lore.
2. Make profession progress character-scoped, auditable, economically earned, and resistant to trivial repetitive farming.
3. Preserve meaningful account continuity without making a replacement character instantly masterful.
4. Add account-, character-, and Family-scoped recipe knowledge with explicit sharing rules.
5. Represent common, rare, fragmented, seasonal, physical, and non-transferable blueprints.
6. Keep recipe knowledge, profession rank, materials, tools, facility access, location, and social requirements as separate server-authoritative gates.
7. Validate that every discoverable recipe has at least one reachable knowledge path and cannot discover itself circularly.
8. Make mastery across all professions possible only at prohibitive cost, so specialists and organizations have economic value.

## Profession model

### Initial production professions

The initial set is:

- **Salvage** — dismantling judgment, material recovery, and classification.
- **Mechanics** — engines, drivetrains, suspension, vehicle maintenance, and tuning assemblies.
- **Machining** — processed metals, precision parts, dies, molds, bearings, and machine components.
- **Armory** — fictional weapon work, abstract ammunition batches, armor components, and safe game-only compatibility knowledge.
- **Garmentwork** — tailoring, treated fabrics, leatherwork, concealment, and protective garments.
- **Medicine** — clinical tools, treatment supplies, protective equipment, and forensic preparation.
- **Presswork** — printing, document restoration, seals, forgery tools, and blueprint reproduction where copying is allowed.
- **Finework** — jewelry, lockwork, heirloom repair, precision instruments, and mystery devices.
- **Construction** — facility components, secure storage, structural upgrades, and large project infrastructure.

Existing masteries such as Chemistry, Wheels, Commerce, and other relevant paths remain co-requisites or modifiers. Phase 2B must not create duplicate profession tracks under new names.

### Progression scope and continuity

Operational profession progress belongs to the living character because practical mastery is part of a street's build. The existing death/replacement and mastery-echo policy is reused:

- completed profession events remain immutable historical records;
- a replacement character does not take ownership of the dead character's progress row;
- an explicitly configured, bounded legacy echo may contribute to the heir in the same way existing mastery does;
- account-known recipes can survive character replacement when the recipe's knowledge scope declares account continuity;
- character-known recipes remain attached to the historical character;
- account lifetime statistics can recognize prior specialists but grant no direct execution authority.

The exact echo percentage and curve are data/configuration balance values shared with the existing mastery architecture, not client inputs.

### Ranks and curve

Profession ranks use the existing mastery event and threshold pattern, with immutable compiled thresholds. The intended curve is quadratic or steeper at high rank. The runtime derives rank from auditable XP; the client never submits a rank or XP award.

Rank names are presentation metadata. Runtime requirements use canonical numeric levels to avoid coupling package logic to localized labels.

### Earning profession XP

XP is awarded only for completed, economically meaningful actions in the profession's registered capability set. Examples include successful salvage, collected work orders, completed repairs, delivered service commissions, or accepted project stages.

XP is not awarded for:

- starting and cancelling a job;
- moving items between owned inventories;
- listing and delisting the same item;
- repeating a zero-value recipe;
- an HTTP retry or replay;
- passive time elapsed without completed work;
- administrative grants;
- content actions that merely assert completion.

Each XP event binds to one logical economic mutation and profession contribution ordinal. A unique constraint makes replay impossible. The award formula is server-side and uses compiled recipe complexity, consumed input scarcity/value classes, output class, role responsibility, and bounded quality difficulty.

Repeated production in one trivial recipe family receives diminishing eligible XP within a server-defined rolling window. Diminishing XP never changes inventory output and therefore cannot be used to reroll products. The compiler reports loops capable of producing XP without a net material, capacity, risk, or cash cost.

### Economic specialization

There is no hard rule that prohibits a character from learning basic work in every profession. Specialization emerges from:

- steep high-rank thresholds;
- consumptive input and capacity costs;
- diminishing XP from a narrow trivial recipe family;
- Path, existing mastery, and relationship affinities;
- high-rank recipes that require substantial real production history;
- multiple parallel profession seats in advanced social projects;
- facility access and blueprint scarcity.

No account may accelerate breadth by transferring the same item through alternate accounts or repeatedly reversing a service. XP eligibility follows unique mutation provenance and completed economic work, not nominal ownership changes.

## Profession definitions and state

Profession definitions are compiled content, not mutable database configuration. Each definition declares:

- stable profession ID and exact definition hash;
- compatible existing mastery/Path adapters;
- immutable level thresholds;
- eligible action families;
- XP formula profile and caps;
- repetition/diminishing category rules;
- optional legacy-echo behavior;
- public lore and safe progression hints.

Runtime state is conceptually stored in:

### `profession_progress`

- historical character ID;
- profession ID and definition hash;
- total eligible XP;
- derived/cached level;
- last eligible event time;
- version used for threshold derivation;
- timestamps.

There is one row per character and exact profession revision. A definition upgrade never silently changes earned event values. If thresholds change, a declared deterministic migration derives the new projection while retaining the old event history.

Every economic XP-producing event has one revision-independent permanent event identity. A profession revision is a projection over an explicit compatible event set; the event's awarded XP is immutable unless a separately reviewed one-time transform is declared. `profession_projection_migrations` or an equivalent receipt binds each source event/progress generation to one target profession revision so a rerun cannot reset or double-count history. New XP arriving during rollover is ordered against a migration boundary and is included exactly once. Real-PostgreSQL tests exercise XP before, during, and after concurrent revision activation.

### `profession_events`

- permanent event ID;
- character and account attribution;
- profession ID/hash;
- logical item/economy mutation ID;
- contribution ordinal;
- recipe/action family;
- eligible XP;
- repetition multiplier and reason;
- source facility/project/service where present;
- timestamp.

The pair `(mutation_id, profession_id, contribution_ordinal)` is unique.

## Recipe knowledge model

Recipe definitions live in compiled packages and carry immutable exact hashes. Knowledge is an entitlement to see and attempt that recipe, not permission to bypass its other gates.

Knowledge scopes are:

- `account` for durable learned knowledge;
- `character` for identity- or life-specific knowledge;
- `family` for institutional knowledge available only while current membership and access rules hold.

Crew-wide permanent knowledge is not introduced in this phase. Crew operations can contribute a discovery to individual or Family knowledge through an explicit effect in later phases.

Conceptual `recipe_knowledge` fields are:

- subject scope and ID;
- logical recipe ID and exact recipe definition hash;
- state (`known`, `archived`, or `revoked_by_content_migration` only where an explicit reversible migration permits it);
- discovery method and source identity;
- source item, mystery, relationship, business, season, or progression reference;
- season/run key where applicable;
- learned timestamp;
- immutable provenance event ID.

Normal learned knowledge is write-once and is not arbitrarily revoked. An old recipe revision remains visible as archived knowledge when a new version activates. Knowledge of an old hash does not automatically unlock a materially different revision unless the new package declares a compatible knowledge migration.

### `blueprint_use_state`

`finite_uses` is permitted only for a unique blueprint item instance, never for a fungible lot. A one-to-one revisioned state row stores the server-defined initial and remaining uses, current binding/transfer state, last mutation, and provenance reference. Learning decrements the last available use in the same transaction that creates the knowledge entitlement; reaching zero consumes or permanently binds the physical blueprint according to its compiled policy. Concurrent last-use attempts can create at most one new entitlement. Splitting, merging, or copying remaining-use authority is impossible, and transfer carries the same unique state row.

## Discovery methods

The compiler supports allowlisted discovery types:

- normal progression thresholds;
- NPC relationship state;
- authored mystery completion receipts;
- document or physical blueprint use;
- assembled blueprint fragments;
- rare item discovery;
- business access;
- Family-shared knowledge;
- bounded experimentation from an explicit candidate set;
- historical artifact interaction;
- season-specific discovery;
- use or analysis of another crafted item.

Discovery conditions are data-defined through registered read-only adapters. They cannot query arbitrary columns or run authored code.

Experimentation never asks the client to name arbitrary ingredients. The server publishes or issues a bounded experiment action derived from eligible known candidate definitions. Failed experimentation consumes only the compiled, disclosed costs and cannot emit OMR, rare value, or uncapped XP.

## Blueprint model

### Physical blueprints

A physical blueprint is an ordinary Phase 2 item lot or unique item instance with an immutable definition hash and trade policy. It may be:

- tradeable and consumed on learning;
- tradeable and retained after use;
- non-tradeable and consumed;
- unique and bound to provenance;
- seasonal with a server-derived season key.

The definition, never the client, selects the behavior.

Every physical blueprint also declares a `learn_use_policy`: `consume_on_learn`, `bind_after_learn`, `finite_uses`, or `common_reusable`. A `finite_uses` definition must be unique and use the conserving state authority above. Unbounded retained-and-tradeable learning is permitted only for definitions classified as common/public knowledge. Rare, seasonal, fragmented, Family-limited, or mystery-derived knowledge must consume, bind, spend a finite server-ledgered use, or use a reviewed reproduction recipe with meaningful inputs, authorization, and a bounded output. The economy validator treats retained tradeable learning as an unbounded knowledge source unless `common_reusable` is explicitly valid for the rarity class.

### Fragments and assembly

Fragments are exact-hash items. An assembly recipe declares the required fragment set, quantity, quality rules where applicable, optional restoration supplies, and resulting physical blueprint.

Fragments from incompatible blueprint revisions or seasons cannot be combined. Assembly consumes inputs and creates exactly one deterministic output under the item mutation guard.

### Learning state machine

A physical blueprint progresses through no hidden client state. The server-issued learning action performs one atomic transition:

```text
eligible physical blueprint + unmet knowledge entitlement
    -> validate subject scope and all conditions under lock
    -> consume, bind, decrement the unique finite-use state, or retain the physical item as defined
    -> create one recipe_knowledge entitlement
    -> write item and knowledge provenance events
```

Replaying returns the original result. A second key cannot create a second entitlement or consume the item again. If knowledge already exists, the action either returns the existing entitlement without consuming another blueprint or fails with a stable `already_known` code according to the compiled policy.

### Family knowledge

Family knowledge belongs to the immutable Family ID and is usable only by current authorized members. It does not get copied to an account when that account leaves. The entitlement survives ordinary leadership changes. Family dissolution behavior must be explicit before Family knowledge is writable: records remain historical and non-executable, and any physical source item follows its own custody recovery policy.

## Separate execution gates

Recipe projections and mutations report these blockers independently:

- recipe unknown;
- profession level insufficient;
- character or account progression insufficient;
- required material absent;
- input quality insufficient;
- required tool absent or unusable;
- required facility unavailable;
- wrong location;
- blueprint object required;
- Family knowledge/access unavailable;
- mystery discovery absent;
- cooldown, time, or capacity unavailable;
- social contribution or project stage incomplete.

A recipe becoming known changes only the knowledge blocker. Mutations re-read every gate from locked server state.

## API and capability surface

Additive authenticated reads:

- `GET /v1/worldgraph/professions` — current character progression, thresholds, affinities, eligible work families, and safe blockers.
- `GET /v1/worldgraph/knowledge` — account-, current-character-, and currently usable Family-known recipes, with archived revisions separated.
- `GET /v1/worldgraph/blueprints` — owned physical blueprints/fragments and only server-issued assembly or learn actions.
- `GET /v1/worldgraph/recipes` — preserves the existing route while adding knowledge, profession, tool, facility, and resource blockers as separate fields.

Mutations:

- `POST /v1/worldgraph/blueprints/:blueprintId/assemble` for a server-issued exact assembly action.
- `POST /v1/worldgraph/blueprints/:itemId/learn` for an owned physical blueprint.
- an internal `grantRecipeKnowledge` capability for allowlisted progression, mystery, relationship, business, and season adapters.

All mutations require `Idempotency-Key`. Clients cannot submit XP, rank, recipe hashes, knowledge scope unless the issued action permits a choice, fragment substitutions, or entitlement provenance. A no-secret economy package may use the existing expected-content hash contract. A secret-bearing recipe/discovery package exposes only a safe public version/`publicManifestHash` and an opaque server-issued action token that binds the private `bundleHash` internally.

## Validation

Compilation or activation fails when:

- a profession references an unknown mastery/Path/action adapter;
- thresholds are non-monotonic, invalid, or overflow safe numeric ranges;
- an XP family has a zero-cost repeatable cycle;
- a recipe requires an unknown or incompatible profession revision;
- a production recipe has no reachable discovery path;
- a discovery path directly or indirectly requires the undiscovered recipe as its only source;
- a blueprint fragment has no source or assembly use;
- an assembly mixes definition hashes or produces multiple non-stackable copies without a cap;
- Family knowledge lacks complete membership and dissolution semantics;
- a seasonal knowledge path accepts a client-nominated season/run key;
- a physical blueprint trade policy conflicts with its item definition;
- a discovery effect can grant arbitrary recipe IDs;
- knowledge unlocks OMR movement or any forbidden effect.

The report distinguishes intentionally confidential recipes from unreachable recipes and from merely client-undiscovered but repository-public recipes. Any genuinely secret recipe body, input/output identity, discovery topology, verifier dependency, or blueprint clue lives only in the separately access-controlled data-only overlay described by the cross-cutting contract. The public repository holds discovery-safe metadata/hints, public dependency shells, synthetic fixtures, and an opaque attestation status; trusted compilation produces the sealed bundle. Public source, Git objects, CI caches/artifacts, source maps, packaging contexts, logs, and reports are scanned for overlay canaries. Merely hiding public repository data in the client is never described as confidentiality.

## Migration and compatibility

Existing Phase 1 recipes receive explicit default knowledge policies during compilation:

- public Phase 1 production recipes remain progression-known or automatically known as their current behavior requires;
- Belladonna prerequisites remain compatible;
- the legacy Bellini Restoration skill and exact-hash workshop recipe knowledge are not silently converted into Phase 2 profession XP or economic knowledge;
- existing OMERTÀ skills/masteries are read through adapters and retain their current authority;
- no existing mastery event is rewritten.

The route response remains backward-compatible: older clients can display public recipes, while newer clients receive structured knowledge and profession blockers. A server does not activate a recipe revision until its knowledge migration policy has validated.

## TDD and verification

Implementation begins with failing tests for:

1. Profession event replay and unique mutation attribution.
2. No XP on start/cancel, transfer loops, listing loops, or failed work.
3. Diminishing XP on trivial repeated recipe families without altered output.
4. Existing mastery and Path adapter enforcement.
5. Character death/replacement isolation and bounded configured legacy echo.
6. Account knowledge continuity and character knowledge non-transfer.
7. Family knowledge access on join, leave, leadership change, and dissolution.
8. Physical blueprint consumed/retained behavior.
8a. Blueprint learn-use scarcity, including one physical blueprint circulated through many accounts, use exhaustion, transfer with unchanged remaining uses, rejected lot/split representation, and a real-PostgreSQL race for the last use.
9. Fragment assembly exact-hash and exact-season enforcement.
10. Same-key and different-key concurrent learn/assembly replay.
11. Discovery cycles, orphan fragments, and unreachable knowledge paths.
12. Archived recipe revision behavior after activation changes.
13. Public/private recipe-source pairing, synthetic overlays, opaque action authority, noninterference, and secret scans across repository/Git/CI/cache/package/source-map/log/report surfaces; confidential recipe `bundleHash` values never enter public payloads.
14. Rejection of arbitrary recipe IDs, XP amounts, subject scopes, and season keys.

Required verification includes focused unit/API tests, property-style progression threshold tests, item conservation, pg-mem and real PostgreSQL migration tests, concurrent blueprint learning, backup/restore assertions, graph validation, anti-farm simulations, and the full repository suite.

## Security, exploit, and economic gates

Reviewers must explicitly attempt:

- repeated XP through idempotency-key changes;
- alt-account transfer/service loops;
- start/cancel XP farming;
- learning without owning the required physical blueprint;
- consuming one blueprint into two scopes;
- combining old, new, and seasonal fragments;
- retaining Family knowledge after leaving;
- using archived knowledge against a new incompatible recipe;
- enumerating secret recipe content through blockers or error messages;
- introducing a zero-cost discovery/XP cycle;
- causing any OMR or unledgered cash movement.

Phase 2B passes only when profession growth reflects completed economic participation, knowledge and item conservation agree, and the compiler reports no impossible or circular discovery paths.

## Explicit non-goals

Phase 2B does not include:

- a second general character skill tree;
- a hard permanent ban on learning multiple professions;
- profession XP from raw action count or time online;
- facilities, capacity, maintenance, or timed production jobs;
- item quality calculation or durability;
- ammunition or contraband production packages;
- player markets, service commissions, or social production projects;
- freely copyable rare or Family knowledge;
- client-authored experiments or arbitrary ingredient combinations;
- OMR rewards, NFT export, contracts, deployment, or activation.

## Exit criteria

Phase 2B exits only when the nine-profession model is implemented through existing mastery-compatible patterns, all production recipes have validated discovery paths, blueprint and knowledge mutations conserve physical objects and entitlements under replay/concurrency, specialization simulations show high-rank breadth is meaningfully inefficient, all Critical and Important review findings are resolved, and the branch remains unmerged and undeployed.
