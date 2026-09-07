# Phase 2D — Ammunition, Contraband, and the Broader Equipment Economy

## Status and scope

This specification defines the fourth independently reviewable Phase 2 increment. It depends on Phase 2A's material/lot/compiler authority, Phase 2B's professions and knowledge, and Phase 2C's facility, job, quality, durability, and repair runtime.

Phase 2D proves that the generic systems can support two demanding economic loops—ammunition consumption and fictional contraband production—while expanding useful equipment without destabilizing existing combat, transport, business, or cash systems.

All ammunition and contraband content remains abstract game fiction. Packages must never contain actionable real-world weapon, ammunition, or controlled-substance manufacturing instructions.

## Goals

Phase 2D must:

1. Make ammunition a produced, compatible, quality-aware, batch consumable.
2. Consume ammunition transactionally in applicable combat actions without duplicating shots or inventory.
3. Build a multi-stage fictional contraband economy around sourcing, processing, packaging, storage, transport, distribution, law pressure, and demand.
4. Use existing businesses, territory, kitchen, transport, and market patterns through narrow adapters rather than bespoke routes per product.
5. Add useful crafted equipment, tools, protection, vehicle modifications, medical equipment, and mystery devices.
6. Keep equipment power inside the current OMERTÀ balance envelope.
7. Validate and simulate production margins, material accumulation, ammunition consumption, durability sinks, law-pressure losses, and population-scale throughput.
8. Prove that no package can emit OMR or provide operational real-world manufacturing detail.

## Content profile and safety boundary

Phase 2D content is authored as declarative packages compiled under a server-owned capability subset of the closed `phase2_economy` profile. It cannot select a broader or third profile and inherits every `phase2_economy` safety and OMR prohibition. In addition to ordinary graph validation, that subset rejects free-form procedural fields and permits only:

- fictional resource names;
- abstract stage labels;
- integer game quantities;
- durations and capacity costs;
- registered quality-formula profile identifiers with schema-bounded numeric parameters;
- compatibility tags;
- game risk profiles;
- registered facility, profession, business, territory, transport, combat, and market adapters.

Public descriptions may establish noir atmosphere and economic function. They must not include real-world ingredient ratios, temperatures, pressures, tolerances, machining instructions, synthesis steps, or instructions for converting real equipment.

## Ammunition economy

### Abstract material chain

The initial chain uses game abstractions such as:

- recovered casings/brass;
- lead stock;
- sealed propellant supply;
- primer components;
- packaging materials;
- caliber tooling;
- inspection supplies.

Names and descriptions remain fictional or generic. Recipes state only resource dependencies and game quantities.

### Compatibility classes

Weapons and ammunition use a small, canonical compatibility vocabulary rather than unvalidated text. The starter catalog should use no more than four or five gameplay classes, for example compact, service, heavy, and specialty.

Compatibility is compiled into item definitions. A combat action checks the equipped weapon's compatibility tag and selects eligible owned lots in deterministic order. Clients cannot claim that an incompatible batch fits a weapon.

Existing weapons that predate ammunition receive an explicit compatibility migration or remain on a documented legacy behavior until migrated. No weapon silently becomes unusable.

### Batch production

Ammunition is a stack lot whose definition hash captures compatibility and whose lot captures quality/provenance. Batch recipes require:

- Armory profession rank;
- the correct blueprint or known recipe;
- compatible tooling with sufficient condition;
- an armory facility capability;
- abstract components;
- capacity/time;
- inspection or packaging sinks where defined.

Quality is deterministic under the Phase 2C rules. Quality may produce bounded reliability, concealment, wear, or performance differences, but cannot create large unreviewed combat multipliers.

Failed quality checks cannot duplicate inputs or create a second sellable by-product unless the recipe declares a conserving recovery output. Retrying cannot reroll the batch.

### Combat consumption

Ammunition consumption must occur inside the authoritative combat mutation, not through a separate best-effort request.

For each accepted action that fires a weapon:

1. resolve equipped weapon and compatibility;
2. collect actor and target character/account IDs and lock all character rows, then all account rows, in canonical ID order;
3. claim the combat/domain mutation guard;
4. lock any separate combat aggregate, then eligible ammunition lots, in the global canonical order;
5. validate sufficient compatible quantity;
6. consume the declared amount;
7. resolve the server-authoritative combat action;
8. write ammunition, combat, and wear events;
9. store one replay result and commit.

A rejected action consumes nothing. A completed action replay consumes nothing additional. The combat result and ammunition debit cannot diverge.

Non-firing legacy actions do not consume ammunition. NPC or system combat follows explicit definitions and cannot access a player's inventory without the same authoritative adapter.

### Ammunition sinks

Primary sinks are combat use, training or testing recipes, damaged/contaminated batch disposal, and declared operation contributions. There is no conversion from ammunition back into a larger amount of its source materials.

## Fictional contraband economy

### Product architecture

The starter catalog should contain several distinct fictional product families with different supply-chain shapes rather than reskins of one dominant recipe. Each family may use:

- precursor supply;
- fictional processing media;
- laboratory or kitchen-like equipment;
- staged intermediate lots;
- quality/purity classes;
- contamination state represented as item quality or a safe definition variant;
- packaging;
- secure storage;
- transport;
- wholesale distribution;
- street distribution;
- territory/business demand;
- law pressure and supply shocks.

No product uses OMR. No production stage creates cash. Cash is realized only through an existing or explicitly ledgered sale/distribution adapter.

### Processing stages

A full contraband chain should normally contain at least four economic stages:

```text
source inputs
  -> prepared intermediate
  -> processed product
  -> packaged lot
  -> stored or transported lot
  -> wholesale or street distribution
```

Some chains can branch between safer/lower-margin and riskier/higher-margin distribution. Branches change logistics, demand, law pressure, loss exposure, or buyer access—not chemical realism.

### Quality and contamination

Quality is derived through the generic craftsmanship model. Contraband definitions may present quality as purity/reliability language, but it remains a bounded game statistic.

Contamination/failure risk is server-side, auditable, and fixed when a job starts. It can reduce output quality, produce a lower-value recovery lot, damage a tool/facility, increase law pressure, or destroy a bounded portion of inputs. It cannot award a jackpot, OMR, or more conserved input value than the successful path.

Retries cannot reroll failure. Players receive sufficient disclosed risk bands to make an economic decision without seeing secret RNG state.

### Storage and transportation

Packaged contraband can require a warehouse, business front, vehicle storage modification, or project custody. Storage rules use capacity and declared risk; they do not silently delete inventory through an unaudited background job.

Any timed seizure, spoilage, or loss is represented by a scheduled authoritative mutation with an event record and idempotent identity. At scheduling, it binds the exact lot/item IDs, quantities, definition hashes, expected condition/state revisions, custody, destination, and recovery owner/policy. When the loss is part of the modeled economy and must survive until due time, every at-risk unit immediately enters purpose-bound transport/storage custody or an equivalent exclusive item commitment. Player-initiated split, transfer, market, consume, or custody changes either reject against that commitment or atomically allocate it to deterministic successor quantities; age-based spoilage/expiry follows derived lots. If liability can follow a transfer, the buyer's safe board action discloses the bounded risk/due band and requires explicit server-issued acceptance in the same mutation—an imminent hidden loss never transfers silently. A non-voluntary character death, organization dissolution, seizure, or world transition can never be rejected or rolled back merely because committed cargo exists: the same transaction settles the cargo to its compiled loss/recovery owner or propagates the commitment to the canonical estate/successor custody. Leaving the risky context cancels the risk only through a compiled, atomic, ledgered terminal transition. A mere owner, quantity, or revision mismatch can never erase modeled risk from a retained remainder or make its holder immune to another game transition.

Every scheduled definition has a sealed registry-owned policy class: `committed_economic_effect` or `conditional_observation`. A committed effect must use custody/commitment, survive successor mutations as above, and appear in simulation with the same terminal probabilities. Conditional expected-state execution without custody is permitted only for `conditional_observation`, whose compiled policy explicitly treats a mismatch as cancellation and whose loss is excluded from economy-balance assumptions. It never substitutes another lot of the same definition. Critical items needed by mysteries must have a recovery path and cannot be destroyed by generic storage pressure unless the content explicitly supplies a replacement route.

Transport integrates with existing travel/convoy patterns through an allowlisted cargo adapter. A transport action locks cargo custody and destination state. Completion, ambush loss, and recovery conserve the same lots.

### Distribution and cash

Wholesale and street distribution use existing demand, territory, business-front, kitchen/deal, or market patterns where compatible. New adapters must:

- compute price from server state and compiled profiles;
- debit the exact sold lot quantity;
- credit cash through the normal transaction ledger;
- charge fees/taxes/losses explicitly;
- write law-pressure and provenance events;
- bind the sale to one mutation guard.

Every buyer/source authority is explicit. A distribution is either a player-to-player transfer, an existing bounded economic source, or a new per-epoch NPC demand and payout budget. A system buyer locks and consumes both remaining demand and remaining cash-emission authority at the shared-counter lock stage. Concurrent sales cannot all observe an undepleted price band. Price response after partial depletion is deterministic, and economy reports identify gross cash emitted by each bounded source adapter rather than only net player balances.

Supply shocks alter availability, demand, capacity, or price within reviewed bounds. They never grant free product or OMR. Daily or seasonal signals are deterministic or server-recorded so replay cannot shop for a better outcome.

### Law pressure

Law pressure is an economic risk signal, not an arbitrary punishment. It may be district-, business-, facility-, or product-family-scoped and can affect:

- action eligibility;
- facility risk;
- transport exposure;
- distribution margin;
- bounded seizure/failure chance;
- required cooldown or front maintenance.

Pressure changes are ledgered and capped. They cannot make every recovery path permanently impossible. The runtime provides at least one lower-risk cooling, alternate-location, or time-based recovery path for ordinary production.

## Crafted equipment expansion

The Phase 2D starter catalog should include interconnected examples from:

- weapon variants within existing combat archetypes;
- armor and protective garments;
- professional tools and lock tools;
- vehicle modifications;
- smuggling/storage equipment;
- medical and forensic equipment;
- forgery/printing tools;
- mystery-specific devices;
- Family-operation equipment components.

Finished items must consume components from the Phase 2A catalog and use Phase 2B/2C profession, knowledge, facility, tool, quality, durability, and repair contracts.

### Power budget

Every equipment definition declares a balance class and bounded effect adapters. The compiler rejects unknown stat keys and values outside configured class envelopes.

Quality and modifications cannot stack without a declared cap. A Masterwork item is scarce and historically meaningful, but it is not an unconditional replacement for every existing rare item.

The starter catalog must demonstrate horizontal utility—special access, lower wear, concealment, cargo protection, facility efficiency, forensic capability, or alternative tactical choices—as well as modest vertical improvement.

### Modifications

A modification is a unique-item state transition performed by a compiled job:

- it targets one existing instance;
- consumes exact components/cash/tool wear;
- checks compatibility and modification slots;
- records definition/hash and installer provenance;
- mutates the same authoritative instance;
- cannot be installed twice in the same slot;
- can be removed only through an explicit conserving recipe.

Modifications do not create a new independently owned copy unless the definition explicitly consumes the old instance and creates one replacement with a recorded lineage edge.

## State and schema additions

Most Phase 2D assets use existing definition, lot, job, durability, facility, and provenance tables. Specialized state is kept narrow.

Conceptual additions may include:

### `item_modifications`

- item ID;
- slot ID;
- modification definition/hash;
- installer character/account;
- source job/mutation;
- state (`installed` or `removed`);
- installed/removed timestamps.

Only one active modification occupies a unique `(item_id, slot_id)`.

### `district_supply_states`

- server-derived epoch/season key;
- district and product family;
- demand/supply profile ID;
- bounded pressure and shock values;
- derivation/audit metadata;
- timestamps.

This table records current evaluated signals. It is not inventory and cannot grant items.

### `scheduled_economy_mutations`

Only if existing job/clock infrastructure cannot express storage or transport resolution safely, a generic scheduled mutation record may hold capability ID, exact bundle/definition hashes, due time, state, immutable scheduled mutation ID, exact lot/item and quantity manifest, exclusive commitment/custody IDs, expected owner/custody and state revision, destination, compiled cancellation policy, recovery owner/policy, and worker lease/claim state. It cannot contain executable code. Worker retries, deterministic successor allocation, explicit cancellation, and old-hash continuation are idempotent and preserve the scheduled identities.

## API and capability surface

Reads are primarily integrated into existing boards:

- `GET /v1/worldgraph/recipes` exposes known ammunition, contraband, equipment, and modification recipes with safe blockers.
- `GET /v1/worldgraph/jobs` exposes production/transport readiness.
- `GET /v1/worldgraph/items/:itemId` exposes compatibility, modifications, quality, condition, and safe provenance.
- `GET /v1/worldgraph/economy` exposes bounded demand, pressure, supply-shock, and distribution opportunities without private RNG state.
- existing combat and transport boards add ammunition/cargo blockers and server-issued action descriptors.

Mutations use generic jobs and existing authoritative gameplay routes. Narrow new endpoints are allowed only for generic distribution or modification capabilities, for example:

- `POST /v1/worldgraph/items/:itemId/modifications/:modificationId/start`;
- `POST /v1/worldgraph/distribution/:actionId/execute`.

Every mutation requires `Idempotency-Key`. Clients cannot submit price, output quantity, quality, compatibility, pressure, failure result, cash reward, ammunition consumed, or arbitrary product/facility identifiers outside a server-issued action.

Tests prove a Phase 2D package cannot select another activation profile, reference an OMR-capable adapter, or submit authored expression/formula source.

## Validation

Activation fails for:

- real-world procedural manufacturing fields or disallowed terminology patterns requiring human safety review;
- unknown ammunition compatibility or weapon adapters;
- a firing action with no defined ammunition policy;
- production batches with no consumption sink;
- an ammunition salvage cycle producing equal or greater source value;
- contraband production that directly emits cash or OMR;
- distribution without item debit and transaction-ledger cash credit;
- system distribution without a locked bounded demand and cash-emission authority;
- pressure/loss paths without bounded outcomes and recovery;
- a storage timer that can destroy a critical unique mystery dependency with no replacement route;
- a scheduled mutation that does not pin exact item/lot identity, quantity, state revision, custody, destination, and recovery behavior;
- a modeled loss/sink declared as a conditional observation, a committed effect without exclusive custody/commitment and successor/death/dissolution settlement, or any policy whose simulator classification differs from runtime classification;
- equipment effects outside balance envelopes;
- modification slot conflicts or unbounded stat stacking;
- a finished item with no production source, use, maintenance/consumption path, or provenance;
- a supply shock capable of creating free inventory;
- unknown executable content.

Reports include minimum professions/facilities, material sources and sinks, batch consumption assumptions, gross and net margin bands, expected loss/pressure, quality distribution, combat consumption, equipment power score, and population-scale throughput.

## Migration and compatibility

- Existing weapons receive reviewed compatibility declarations or remain on an explicit temporary legacy no-ammunition policy; no accidental breakage is allowed.
- Existing ammo counters/items, if any, are migrated only after a conservation mapping is proven. No duplicate “old ammo plus new lot” spendability is permitted.
- Existing kitchen, drug, convoy, business, territory, market, and combat behaviors remain authoritative. Phase 2 adapters call their locked transaction seams rather than updating their tables independently.
- Existing cars and modifications are not rewritten. New modification slots apply only where definitions explicitly opt in.
- Legacy equipment receives no invented Masterwork quality or provenance.
- In-flight jobs remain pinned and collectible across content activation.

Every integration must include a rollback/removal strategy that disables the adapter without deleting authoritative lots or history.

## TDD and verification

Implementation begins with failing tests for:

1. Ammunition production conservation and exact compatibility.
2. Combat success/failure/replay with atomic ammunition debit.
3. Concurrent combat attempts against the last compatible batch.
4. Batch quality and risk replay without rerolls.
5. Rejection of real-world procedural content fields and arbitrary adapters.
6. Multi-stage contraband source, processing, packaging, storage, transport, and distribution.
7. Distribution cash/item atomicity and ledger reconciliation.
8. Storage/transport scheduled mutation replay.
8a. Scheduling races with sale, transfer, split, consumption, market listing, non-voluntary death/dissolution/seizure, custody change, explicit cancellation, due execution, worker lease expiry, and old-hash continuation. For each original unit, the oracle requires exactly one terminal disposition—authorized sale/transfer outside the risk, due loss, explicit compiled risk cancellation, or recovery—and proves a source-lot revision cannot silently remove risk from a retained remainder. Non-voluntary transitions complete while atomically settling/reassigning cargo; committed cargo never rejects the death/dissolution/seizure.
8b. Validator/runtime/simulator parity rejects a balance-modeled sink labeled `conditional_observation` and proves observation mismatch cancellation cannot affect approved economic loss assumptions.
9. Law-pressure bounds and recovery paths.
10. Supply shock determinism/auditability and no free inventory.
11. Modification slot, compatibility, replay, removal, and provenance.
12. Equipment power-envelope validation and stacking caps.
13. Old weapon compatibility migration and legacy fallback.
14. Critical mystery-item recovery under storage/loss rules.
15. Fifty-way system-buyer sale races reconciling product, gross cash source, seller cash, fees, remaining demand, and payout budget.
16. Closed-profile tests rejecting profile aliases, OMR-capable adapters, and authored expression/formula source.

Required verification includes focused unit/API/integration tests, combat and transport regressions, lot and cash-ledger conservation, pg-mem and real PostgreSQL migrations/races, economy simulations over varied player populations, equipment combat simulations, law-pressure simulations, content-safety review, and the full repository suite.

## Economy, exploit, and red-team gates

Reviewers must attack:

- ammunition duplication through combat retries;
- shots without compatible ammunition;
- ammunition debit when combat fails before acceptance;
- batch rerolling;
- contraband input duplication at stage boundaries;
- storage/transport double delivery;
- price or pressure spoofing;
- sale credit without product debit;
- laundering a loss path into more valuable recovery outputs;
- modification duplication or stat-cap bypass;
- power creep that invalidates existing rare gear;
- alt-account demand manipulation at population scale;
- real-world procedural detail leakage;
- OMR movement through production, failure, sale, or rewards.

Economy simulations must demonstrate that ammunition demand is a material sink, contraband margins remain positive only with real inputs/risk/capacity, no chain produces unbounded cash or materials, and high-quality equipment remains scarce under realistic population assumptions.

## Explicit non-goals

Phase 2D does not include:

- real-world ammunition or drug manufacturing instructions;
- player-selectable arbitrary chemistry or ingredient combinations;
- unlimited background production;
- direct cash or OMR crafting outputs;
- a replacement combat engine;
- large unreviewed stat inflation;
- universal durability for trivial items;
- full player trading or specialist service escrow;
- Crew/Family social production projects;
- NFT exporting or contracts;
- production activation or deployment.

## Exit criteria

Phase 2D exits only when ammunition is a real transactional consumable, the fictional contraband loop has several deep and balanced supply chains, equipment remains inside reviewed balance envelopes, all integration points reconcile their authoritative ledgers, content safety validation passes, all Critical and Important findings are resolved, and the branch remains unmerged and undeployed.
