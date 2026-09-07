# Phase 2C — Facilities, Deep Crafting, Quality, Durability, and Repair

## Status and scope

This specification defines the third independently reviewable Phase 2 increment. It depends on the Phase 2A definition/lot/compiler contracts and Phase 2B professions and recipe knowledge.

Phase 2C turns recipes into a production runtime with locations, facilities, capacity, time, tools, deterministic craftsmanship, selected equipment wear, and specialist repair. It is the point at which OMERTÀ gains multi-stage production instead of a catalog of shallow one-click conversions.

This phase provides generic capabilities and a compact proving catalog. Phase 2D supplies the broader ammunition, contraband, and equipment content. Phase 2E supplies player service orders and social projects.

## Goals

Phase 2C must:

1. Create a first-class facility abstraction with ownership, capabilities, location, upgrades, capacity, access, condition, and maintenance.
2. Execute recipes as exact-hash-pinned work orders when time, capacity, tools, or facilities matter.
3. Consume inputs exactly once at job start and create outputs exactly once at collection.
4. Support deep recipes that consume outputs from several profession chains.
5. Calculate appropriate item quality mainly from deterministic skill, input, tool, facility, and recipe factors.
6. Make Masterwork output scarce through explicit prerequisites rather than gambling.
7. Add durability only to economically meaningful unique equipment.
8. Make repair a conserving production action that consumes components and records the specialist.
9. Preserve in-flight old-definition jobs through later activations.

## Facility model

### Facility types

The initial capability catalog supports:

- scrapyard;
- garage;
- machine shop;
- armory bench;
- tailoring room;
- clinic;
- print room;
- warehouse;
- secure Family workshop;
- fictional processing laboratory.

A facility type is a compiled definition with capability tags. Recipes require capabilities, minimum levels, and optional location/access properties—not a hard-coded facility route.

### Ownership and relationship to existing systems

Facilities may be:

- public/system-operated;
- account-owned;
- Family-owned.

Businesses and Family infrastructure can grant facility access, discounts, capacity, risk modifiers, or upgrade eligibility through allowlisted adapters. Existing business or gang rows do not become inventory or crafting authority, and the implementation must not add a custom column for every facility or recipe.

Crew ownership is deferred. A Crew or Family project in Phase 2E can reserve facility capacity without creating an unrestricted Crew inventory.

Every enabled non-system facility definition has one reachable, reviewed creation/acquisition authority. It is either deterministically derived from named existing business/Family infrastructure, produced by a Phase 2E project, or acquired through a bounded source with compiled cash/material costs and per-subject/world caps. Its definition declares initial owner, whether transfer is forbidden or uses an explicit transfer lifecycle, creation provenance, capacity supply, owner-death behavior, and Family-dissolution recovery. Facility creation/capacity is included in source/sink and population simulations; an account- or Family-owned facility with no reachable source is invalid. Types whose creation path is deferred remain non-activatable.

### Facility state

Conceptual `facilities` fields are:

- permanent facility ID;
- exact facility definition hash;
- owner scope and ID;
- district/location;
- level;
- current and maximum condition;
- state (`active`, `maintenance`, `suspended`, or `closed`);
- access-policy identifier;
- risk profile;
- created/updated timestamps.

Supporting state includes:

- `facility_access` for explicit grants with subject, role, permissions, and expiry;
- `facility_upgrades` with exact definition/hash and provenance;
- `facility_events` as append-only ownership, upgrade, maintenance, damage, and closure history;
- server-defined slot/capacity records or an equivalent indexed allocation that makes double booking impossible.

### Facility state machine

```text
active -> maintenance -> active
active -> suspended -> active
active|maintenance|suspended -> closed
```

Closure is allowed only when no active work, repair, service, or project reservation depends on the facility, or when an explicit recovery migration moves those reservations without duplicating their inputs. A closed facility remains historical and cannot be reopened under a different definition without a new instance.

Condition loss comes from completed declared work or explicit world events, not merely time passing. Maintenance consumes compiled materials/cash and restores a bounded amount. Maintenance cannot exceed compiled maximum condition.

Facility upgrades run through the generic job authority. An immutable upgrade definition declares exact hash, current and target level, capability/capacity/condition effects, ownership and access authority, location, materials, cash, tools, duration, slot use, and maintenance consequences. Starting reserves the facility's upgrade slot and consumes the exact inputs; collection applies the target revision and event once. Only one conflicting upgrade may be active for a facility and target level. Cancellation, failure, owner death, Family dissolution, package rollover, and facility closure use declared recovery rules and cannot return consumed inputs plus the upgrade. A later definition cannot reinterpret an in-flight upgrade.

### Access checks

Access is recalculated under lock when work starts. The server considers ownership, public policy, current Family membership/role, explicit grants, district, business entitlement, facility state, and available capacity.

A stale board action cannot start after access is revoked. In-flight work remains collectible by its declared beneficiary even if access changes, unless the authored definition includes a fair recovery rule.

## Deep recipe model

A compiled recipe may declare:

- exact input lots and/or unique items;
- catalysts, including whether they are consumed, damaged, or merely required;
- output definitions and quantities;
- profession level and optional cross-profession requirements;
- known-recipe/blueprint prerequisites;
- facility capabilities, level, access, and location;
- reusable tool definitions and minimum condition;
- character, business, Family, mystery, or progression gates;
- cash costs;
- duration and capacity units;
- quality formula profile;
- failure/recovery policy;
- cooldown or production cap;
- output ownership policy;
- provenance summary rules.

Client-submitted arbitrary inputs are forbidden. A server-issued action resolves the eligible recipe and exact input selection or a bounded allowed selection. Substitutions exist only as explicit compiled alternatives.

### Target production depth

The proving catalog must include chains at least as deep as:

```text
salvaged vehicle material
  -> processed metal
  -> precision component
  -> specialized subassembly
  -> finished equipment or vehicle component
  -> modification
  -> Masterwork-eligible version
```

The catalog must also include at least one chain that requires outputs from three different professions. No path may become the universally dominant source of profession XP, cash value, quality, or downstream components.

## Craft job state machine

Long or facility-bound production uses `craft_jobs` rather than keeping an HTTP request open.

Conceptual job fields include:

- job ID and logical mutation identity;
- account and character actor;
- beneficiary owner/custody;
- recipe ID and exact recipe `definitionHash`, root `bundleHash`, `dependencyLockHash`, and every other relevant exact definition hash;
- facility ID and reserved slot/capacity;
- tool/item references;
- state;
- deterministic quality inputs/result envelope;
- start, ready, collect, cancel, and expiry times;
- start and collection mutation guards.

`job_item_commitments` or an equivalent canonical authority binds every reusable tool, repair target, modification target, and other reserved unique item to the job from start through its terminal state. It records item ID/hash, reservation kind and capacity ordinal, expected condition/state revision, original recovery owner, beneficiary, and job ID. Generic transfer, listing, consumption, repair, modification, service, project, and future export-readiness mutations recheck this authority under the item lock.

Normalized job input rows bind every consumed lot/instance and quantity. Planned output rows bind exact definitions, quantity, quality basis, and deterministic output ordinal before collection.

The state machine is:

```text
eligible action
  -> started (inputs/cash/catalyst wear consumed, facility capacity reserved)
  -> ready (derived from server time; no value created yet)
  -> collected (outputs created once, capacity released, XP/event recorded)
```

Optional terminal states are `cancelled`, `expired`, and `failed_recovered`, but only when the recipe declares them.

Rules:

- all input consumption occurs atomically at `started`;
- no output lot or item exists before `collected`;
- collection uses the recipe/facility/tool/input definitions pinned at start;
- activation changes do not strand an old job;
- start replay does not consume again;
- collect replay does not create again;
- a different key cannot collect one job twice;
- a cancellation never returns both original inputs and salvage/recovery outputs;
- completion XP is recorded only on successful collection;
- time changes availability, never OMR balance or free item quantity.

Processing completion and player collection are separate. A definition declares whether facility/tool capacity releases automatically when processing becomes ready or after a bounded collection grace period. An idempotent expiry resolver releases the exact reservations once. It also declares whether an expired output remains collectible in bounded account storage, becomes a conservation-safe recovery output, or is intentionally sunk. Expiry never creates both a collectible output and a refund. Unclaimed ready outputs are capped per account so abandoned jobs cannot create unbounded storage or hold public/Family capacity hostage.

For genuinely instantaneous low-risk recipes, the same state model may execute start and collect within one transaction, preserving the same mutation/output invariants.

## Capacity and concurrency

Facility capacity is a locked scarce resource. It may be represented by explicit slot rows or a transactional counter with a database constraint, but must satisfy:

- no two active jobs occupy the same exclusive slot;
- aggregate capacity cannot exceed the facility level's compiled maximum;
- cancellation/collection releases exactly the reservation held by that job;
- one request cannot reserve capacity in two facilities;
- deadlocks are avoided through the global lock order;
- pg-mem compensation and PostgreSQL rollback preserve identical visible outcomes.

## Quality and craftsmanship

### Bands

The five quality bands are:

- Rough
- Serviceable
- Fine
- Superior
- Masterwork

Definitions specify whether quality applies. Commodities for which quality has no gameplay meaning stay unbanded rather than receiving cosmetic complexity.

### Calculation

Quality is derived server-side from a compiled formula profile using:

- weighted input-lot quality;
- relevant profession level and real work history;
- recipe difficulty;
- facility level and condition;
- reusable tool definition and condition;
- blueprint tier;
- declared mastery or mystery conditions;
- at most a small, bounded server-random variance.

The server stores the deterministic basis and any auditable variance seed/result when the job starts. A retry cannot reroll.

Masterwork requires explicit deterministic prerequisites, such as a minimum profession rank, Superior-or-better inputs, a specialized blueprint, a qualified facility, and appropriate tools. Random variance alone can never promote an otherwise ineligible job to Masterwork.

Quality effects must be bounded by item class. It may improve durability, repairability, efficiency, concealment, compatibility, or modest combat attributes, but it cannot create uncontrolled power creep.

### Conservation and upgrading cycles

The validator assigns each quality band and item class a conservative value/power envelope. A conversion cycle that upgrades quality without a bounded scarce source, sink, cash cost, facility wear, cap, or irreversible loss fails validation.

Recipes cannot split a high-quality input into a greater amount of equivalent high-quality material and reassemble it for net gain.

## Tools and catalysts

Reusable tools are unique item instances with definition hash, quality, and condition. A recipe declares whether the tool:

- is only required;
- loses condition once at job start;
- is consumed;
- is transformed into another unique item.

Tool wear is charged once at start and recorded in the job input/event ledger. The same tool cannot be committed concurrently beyond any declared capacity.

Tool capacity reservations are explicit item commitments. A committed tool cannot be transferred, listed, consumed, or committed beyond its available capacity until the exact reservation releases on collection, cancellation, expiry, or reviewed recovery.

Catalysts follow the same explicit modes. A catalyst that is not consumed cannot be returned as an additional output. Definitions cannot use the word “catalyst” to bypass conservation accounting.

## Durability

Durability applies only to selected unique equipment. Conceptual `item_durability` is one-to-one with `item_instances` and contains:

- item ID;
- current and maximum condition;
- condition revision;
- last wear event;
- broken-at timestamp when applicable.

An item's usability is derived from its definition and condition. Zero condition can mean broken-but-repairable or consumed only when the definition explicitly says so. A broken item remains exactly one owned instance and cannot be recreated by repair.

Wear events are transactional with the gameplay action that caused them. A failed or rejected action does not wear an item. Replayed actions do not wear it twice.

Routine materials, documents, blueprint knowledge, trivial clothing, and disposable consumables do not receive durability state.

## Repair

Repair is a compiled production recipe targeting one unique item instance. It can require:

- a profession and minimum rank;
- compatible replacement components;
- a tool;
- facility capability/location;
- cash;
- time/capacity;
- maximum recoverable condition based on item quality and damage history.

The client supplies only the target item and a server-issued repair action. It cannot nominate the durability gain or substitute arbitrary materials.

The repair target enters exclusive job or service custody at start. Its owner and beneficiary are frozen, and its expected condition/state revision is rechecked before the commitment is created. It cannot be transferred, listed, repaired, modified, consumed, or committed elsewhere until the terminal transition returns or transfers that same authoritative instance.

Repair uses a job state machine when timed. Components and cash are consumed at start; collection applies one bounded condition increase to the same item and writes a repair provenance event. It never creates a duplicate item or resets provenance.

Repeated repairs may reduce the maximum recoverable condition only when explicitly declared for that item class. Maintenance must improve the economy without making all equipment disposable or every trivial action annoying.

## API and capability surface

Authenticated reads:

- `GET /v1/worldgraph/facilities` — accessible facilities, capabilities, location, condition, capacity, maintenance blockers, and issued actions.
- `GET /v1/worldgraph/jobs` — the caller's active, ready, collectible, and recent jobs with exact pinned definition identity.
- `GET /v1/worldgraph/items/:itemId` — safe unique-item detail including quality, condition, compatible modifications/repairs, and provenance summary.
- `GET /v1/worldgraph/recipes` — adds facility, tool, capacity, duration, and quality projection fields.

Mutations:

- `POST /v1/worldgraph/facilities/sources/:sourceId/acquire` for a server-issued bounded acquisition action when no existing business, project, or job adapter owns creation;
- `POST /v1/worldgraph/jobs/:recipeId/start`;
- `POST /v1/worldgraph/jobs/:jobId/collect`;
- `POST /v1/worldgraph/jobs/:jobId/cancel` only when a cancellation action is issued;
- `POST /v1/worldgraph/facilities/:facilityId/maintain`;
- `POST /v1/worldgraph/facilities/:facilityId/upgrade/start`, with completion through the generic job collection route;
- `POST /v1/worldgraph/items/:itemId/repair/start` and corresponding job collection through the generic job route.

Routes are thin adapters over server modules. Every mutation requires `Idempotency-Key`. A facility definition either names the existing business/project/job adapter that creates it or uses the generic bounded acquisition source above. Acquisition claims the domain guard; locks owner and source-cap/budget rows in the global order; atomically debits compiled cash/material costs, creates the one facility identity, consumes per-subject/world capacity, and writes ledger plus facility provenance/events. Replay returns that facility, and a client cannot nominate its type, owner, level, condition, capacity, or price.

Standalone new work in a no-secret economy package requires the expected active `bundleHash`. Confidential recipe packages expose only a safe public version/`publicManifestHash` plus an opaque issued action that binds the private active `bundleHash` internally. A dependent start issued by an already-live mystery, project, or service may instead use only the exact archived dependency revision in that parent's stored lock, under the scoped action/digest/provenance and recovery-freeze rules in the cross-cutting contract; this never generally reopens the archived recipe. Collection uses the job's internally pinned `bundleHash` and must not reject solely because a newer bundle activated.

Clients never submit output IDs, output quality, time, durability gain, XP, facility modifiers, or material quantities outside explicit bounded substitution options.

## Validation

Activation fails for:

- unknown facility, profession, tool, recipe, input, or output definitions;
- a recipe with unreachable facility or knowledge requirements;
- a non-system facility with no reachable reviewed creation/acquisition source naming an existing adapter or the generic acquisition capability, bounded costs/caps, provenance, ownership/transfer rule, or death/dissolution recovery;
- a facility owner scope without access, closure, and dissolution behavior;
- a facility upgrade with an unknown target, non-monotonic level/capability transition, missing source/sink accounting, overlapping slot authority, or incomplete cancellation/dissolution behavior;
- a recipe duration/capacity outside safe bounds;
- negative, zero, overflowing, or fractional inventory quantities;
- an unbounded quality-upgrade cycle;
- a Masterwork outcome reachable without its deterministic prerequisites;
- a reusable tool with no wear, repair, consumption, scarcity, or declared permanent-use rationale;
- durability on unsupported stack items;
- a repair that creates a second instance or increases condition beyond its allowed maximum;
- a cancellation path that returns more than it consumed;
- an in-flight definition without a pinned collection projection;
- a timed job with no bounded reservation-release and unclaimed-output policy;
- a cash cost without a corresponding ledger sink;
- any OMR cost, output, reward, or balance adapter.

The report calculates minimum chain depth, professions, facility capabilities, tools, cash sinks, time gates, and critical unique-item dependencies for every finished product.

## Migration and compatibility

- Existing Phase 1 instantaneous recipes remain executable through the generic job capability, with atomic start/collect when their definition declares zero duration and no exclusive capacity.
- Existing crafted unique items receive definition hash, default quality compatible with Phase 1 (`Serviceable` presentation mapped from legacy `standard`), and no durability unless an explicit migration introduces it.
- Existing Bellini jobs/tools remain under their exact-hash inert runtime and do not satisfy Phase 2 facility/tool requirements.
- Business and Family integrations are additive read adapters; existing ownership and revenue behavior is unchanged.
- An activation cannot change an in-flight job. Jobs retain their pinned output plan and collection capability.

No migration may invent provenance, quality, durability damage, or economic value for an existing item. Definition identity, ownership, quality mapping, durability policy, and eligibility always use immutable compatibility definitions. Only a specifically named non-authoritative historical-detail field may say `not_recorded`; that field cannot affect spendability, lot aggregation, quality, condition, or eligibility.

## TDD and verification

Implementation begins with failing tests for:

1. Facility access, location, state, level, and capacity gates.
2. Concurrent exclusive-slot reservation with one winner.
3. Input/cash/tool-wear consumption exactly once at job start.
4. No output before readiness or collection.
5. Same-key and different-key start/collect replay.
6. Definition activation while a job is in flight, plus R2 activation followed by scoped start and collection of an R1 craft, repair, and service issued from a live R1 parent's exact dependency lock; unrelated standalone R1 starts are rejected and any frozen R1 dependency follows its explicit recovery migration.
7. Cancellation conservation and recovery rules.
8. Deterministic quality basis and bounded variance replay.
9. Masterwork deterministic eligibility.
10. Cross-quality and quality-upgrade-cycle validation.
11. Tool concurrent commitment and wear replay.
12. Durability wear transaction rollback with the gameplay action.
13. Repair of the same item under concurrent requests.
14. Facility creation/acquisition through both named existing adapters and the generic source route, including guard replay, concurrent last-cap acquisition, ledger/material rollback, one facility output identity, costs, caps, owner/transfer/death/dissolution lifecycle, provenance, capacity supply, maintenance bounds, and cash/material sinks.
15. Family access changes and facility closure with active jobs.
16. Facility upgrade replay, concurrent starts, prerequisites, caps, rollback, cancellation, dissolution, and old-definition collection.
17. Job/tool/repair/modification commitment races against transfer, listing, consumption, second jobs, death, and recovery.
18. Ready/expiry/collect and expiry/cancel races, worker replay, capacity release, and unclaimed-output caps.

Required verification includes focused unit/API tests, property-based conservation and quality bounds, pg-mem and real PostgreSQL migrations, real PostgreSQL race tests, failure injection at every transaction boundary, backup/restore assertions, production-chain and accumulation simulations, and the full repository suite.

## Economy, exploit, and balance gates

Reviewers must attempt:

- duplicated output through start/collect races;
- free input return through cancellation;
- free facility capacity through counter underflow;
- tool use in concurrent jobs beyond allowed capacity;
- quality reroll through retries;
- low-rank Masterwork production;
- repair above maximum or repeated free repair;
- repair that forks one unique item into two;
- old-definition collection using new, cheaper requirements;
- closure/dissolution that strands or duplicates custody;
- cash debits without ledger entries;
- OMR leakage.

Economy simulation must model source rates, processing loss, facility throughput, maintenance, repair demand, durability wear, quality distribution, and long-run material accumulation. Material families with permanently positive unbounded accumulation must be rebalanced or given a reviewed sink before Phase 2C passes.

## Explicit non-goals

Phase 2C does not include:

- player housing;
- arbitrary custom facilities created by content authors;
- client-authored recipes or substitutions;
- maintenance on every trivial item;
- primarily random high-value crafting;
- broad ammunition, contraband, or equipment catalogs;
- trustless player service commissions;
- Crew/Family contribution projects;
- destructive migration of in-flight Bellini or Phase 1 work;
- OMR rewards, NFT export, contracts, deployment, or activation.

## Exit criteria

Phase 2C exits only when facility-bound deep production, quality, durability, and repair conserve all value under replay and concurrency; old-version jobs remain collectible; Masterwork is deterministically gated; the economy simulation reports acceptable accumulation and power envelopes; all Critical and Important findings are resolved; and the branch remains unmerged and undeployed.
