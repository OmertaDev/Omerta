# Phase 2E — Item Trade, Specialist Services, Social Production, Provenance, and NFT Readiness

## Status and scope

This specification defines the final independently reviewable Phase 2 increment. It depends on the complete Phase 2A–2D foundation: immutable definitions and lots, professions and knowledge, facilities and jobs, quality and durability, ammunition and contraband, and the broader equipment catalog.

Phase 2E connects specialists through safe player markets and service commissions, enables genuinely multi-account Crew/Family production, completes unique-item provenance, and stores selective NFT eligibility state without exporting anything on-chain.

The end of Phase 2E triggers the full Phase 2 economy, security, concurrency, PostgreSQL, and population-scale review. It does not merge, deploy, activate OMR rewards, or deploy NFT contracts.

## Goals

Phase 2E must:

1. Add a typed market for approved materials, components, crafted items, physical blueprints, and unique items.
2. Escrow all offered assets and cash so replay, cancellation, partial fills, and races conserve ownership.
3. Add bounded service orders for repair, modification, and crafting commissions without relying on informal trust.
4. Implement staged Crew and Family production projects requiring distinct accounts, professions, facilities, items, and meaningful contributions.
5. Attribute contribution by economic meaning rather than raw action count or time online.
6. Expand append-only provenance for creation, materials, modifications, repairs, transfers, PvP, mysteries, organizations, and historical events.
7. Add selected unique-item NFT eligibility state plus schema-ready identity/provenance fields for a separately approved future export design, while preserving one authoritative ownership state.
8. Preserve compatibility with existing markets, organizations, item holdings, and death/dissolution policies.

## Custody model

Markets, services, and projects require custody, not a second inventory.

Phase 2E uses a generic `item_custodies` aggregate or an equivalent typed extension of the Phase 1 operation escrow model. Each custody record declares:

- permanent custody ID;
- kind (`operation`, `market`, `service`, `project`, or another allowlisted kind);
- owning aggregate ID;
- state (`open`, `releasing`, or `closed`);
- recovery policy;
- creation/closure timestamps.

Lots and unique items continue to live in the sole authoritative item ledger. Their owner/custody tuple points at one custody record while escrowed. Supporting deposit rows record the exact depositor and quantity/item identity so release returns value to the correct historical owner.

Introducing a custody kind requires a complete lifecycle: deposit, consume/transfer, cancel/release, expiry, death, organization dissolution, and backup/restore. A package cannot invent a custody kind.

Phase 1 `operation_escrow` remains compatible and can be migrated or adapted into the typed custody model. It must not remain a competing authority.

## Typed item market

### Relationship to existing exchanges

OMERTÀ's existing asset-specific markets and the Bellini material exchange retain their current contracts. Phase 2E does not widen a legacy polymorphic listing table to accept every new item.

A new item market handles only Phase 2 definitions whose compiled trade policy permits it. Bellini inert lots, bound knowledge, ordinary collection status, OMR, on-chain gear, and unsupported legacy assets cannot be listed.

### Listing state

Conceptual `item_market_listings` fields include:

- listing ID and seller account/character attribution;
- logical item ID and exact definition hash;
- unique item ID or escrowed lot/quantity;
- quality and public provenance summary;
- unit/whole price and currency (`cash` only in Phase 2);
- original, filled, and remaining quantity;
- state;
- expiry;
- market policy/tax hash;
- creation/cancellation mutation IDs and timestamps.

The custody deposit remainder is the authoritative sellable quantity. Listing `filled` and `remaining` values are derived from custody movements or updated under a database-enforced equality in the same transaction, with `filled + remaining = original`. Partial fills transfer or split the exact custody lot quantity and record lineage; cancellation and expiry release the custody remainder rather than trusting a separately editable counter.

The state machine is:

```text
draft server action
  -> open
  -> partially_filled -> filled
  -> cancelled
  -> expired -> released
```

Unique items are whole-fill only. Stack lots may support partial fills when the definition permits them. Every fill atomically transfers the exact purchased quantity/item from custody, debits buyer cash, credits seller cash net of ledgered fees, records provenance, and advances listing state.

The listing mutation escrows assets before the listing becomes visible. A seller cannot use, consume, transfer, modify, repair, or export an escrowed object. Cancellation/expiry returns only the remaining amount.

### Market authority and prices

Players may choose price within server-defined integer and maximum bounds. The client may not choose item definition, quality, provenance, or quantity beyond the exact owned lot/action options projected by the server.

All cash uses the existing transaction ledger. No market code updates balances without a corresponding ledger entry. OMR is not an accepted price currency.

Settlement uses checked integer multiplication and addition for `unit_price × quantity`, gross, fee, and net. One immutable market-policy hash defines the fee basis and deterministic rounding direction. Boundary overflow, remainder mismatch, and rounding behavior are rejected before any balance or item movement.

## Specialist service orders

Services use a separate state machine because the customer contributes an item or materials and the provider contributes skill, access, capacity, or additional materials.

Initial service kinds are:

- repair;
- modification installation/removal;
- crafting commission from an approved recipe.

Conceptual `service_orders` fields include:

- order ID and exact service/recipe hash;
- customer and optional directed provider;
- required provider profession/level;
- customer and provider input manifests;
- cash price/fee and payer;
- required facility/capacity;
- beneficiary/return policy;
- deadline;
- state and revision;
- associated craft/repair job;
- completion and cancellation mutations.

State machine:

```text
open -> accepted -> in_progress -> ready -> completed
open|accepted -> cancelled/expired
in_progress -> failed_recovered only through a declared recovery path
```

Before an order becomes `open`, the exact target item, every promised customer input, and the maximum customer payment/fee are escrowed. A deliberately provider-funded service records an explicit empty customer-material manifest rather than a deferred obligation. At acceptance/start, the provider's exact promised inputs are escrowed or consumed and facility/tool/target commitments are reserved. The accepted revision freezes target, manifests, beneficiary, recovery owner, price, fee policy, deadline, and required facility. The ordinary Phase 2C job produces or mutates the authoritative target. Completion transfers the result to the declared beneficiary and pays the provider exactly once.

The service defines idempotent deadline and recovery behavior for `accepted`, `in_progress`, and `ready`, including customer/provider death or replacement, provider departure, facility closure, and abandoned collection. No visible order can be accepted while materially unbacked.

Phase 2 does not implement subjective disputes, arbitration, or arbitrary free-form contracts. The server can determine success from the compiled recipe and state machine.

## Social production projects

### Project scale

Projects support:

- small Crew work involving several distinct accounts;
- large Crew work involving approximately 8–12 distinct accounts where content warrants it;
- Family work involving several profession groups and Family infrastructure.

Extended-Family and cross-Family production are architectural future cases and are not activated in Phase 2.

### Definition model

A project definition is authored graph content with:

- stable project ID and exact hash;
- organization scope;
- forming/start/expiry rules;
- stages and dependency edges;
- material and unique-item requirements;
- required professions and minimum levels;
- distinct-account/role constraints and whether the mandatory server-owned `real_independent_participants` policy applies;
- required facilities, location, and infrastructure;
- parallel and ordered work;
- contribution types and eligibility thresholds;
- custody, cancellation, and recovery policy;
- deterministic outputs and provenance rules.

Role constraints declare `distinctnessScope`: simultaneous, per stage, or lifetime of the project. For lifetime-distinct role equivalence classes, an account remains recorded after vacancy/replacement and cannot return through another character or generation to manufacture another distinct role or contribution.

Content authors cannot provide custom project code. Stages invoke only allowlisted lot, item, job, facility, contribution, and organization capabilities.

### Runtime state

Conceptual storage includes:

#### `production_projects`

- project ID, organization ID/type, package/hash, state, revision;
- custody and facility reservation identities;
- forming/start/ready/completion/expiry timestamps;
- output beneficiary policy;
- completion mutation.

#### `project_participants`

- account and historical character IDs;
- project-defined role, role-equivalence group, and server-derived assignment generation;
- profession qualification snapshot plus current-action revalidation;
- join/leave/replacement state;
- distinct-account constraint and `distinctnessScope`.

Assignments are append-only by `(project_id, role_id, assignment_generation)`. Closing or replacing a seat never overwrites its account history. A separate permanent project-role occupancy authority keyed by project, role-equivalence group, account, and applicable stage/lifetime scope prevents character swaps, vacancy/rejoin, or later generations from manufacturing another distinct participant. Only the active generation can act, while convergence and completion query the full relevant occupancy/meaningful-contribution history.

#### `project_contributions`

- permanent contribution ID;
- participant account/character;
- stage and contribution type;
- contributed lot/item/job/operation identity;
- normalized economic weight category;
- risk/support/critical-path flags;
- accepted mutation and timestamp.

The same economic mutation cannot count as two independent required contributions unless the project explicitly declares multiple bounded outputs from it.

### Project state machine

```text
forming -> active -> ready -> completed
forming -> expired/abandoned
active -> cancelled/recovered only under declared policy
```

Starting locks the exact organization and project definition. Materials deposited during forming remain recoverable if the project expires. Active-stage cancellation follows explicit loss/refund rules and never returns consumed stage inputs.

Completion creates outputs once and attributes their provenance to the project, organization, relevant facilities, and meaningful contributors.

### Distinct participation and roles

Distinct accounts are enforced in storage and under lock. Every value-bearing/scarce project and every critical-path social minimum also requires distinct current social-independence subjects under the cross-cutting server-owned policy. Current character state, Family/Crew membership, profession, role, independence-subject generation, and facility authority are revalidated for every contribution.

The same account cannot fill two roles declared distinct, even with two characters. Agent/human eligibility rules are applied only where the project definition and existing game policy require them; no social rule is trusted from the client.

Long projects provide a declared seat-replacement path after a timeout or departure. Replacement cannot erase prior contribution attribution or let one account impersonate two required participants.

Every critical convergence and completion revalidates the distinct set of meaningful contributor accounts required by the project, not merely the forming roster. Reusing an account after replacement restores availability only where allowed; it does not increment distinct-account, distinct-role, output, or entitlement counts.

A high-confidence independence-subject merge during an active project preserves custody and attribution but blocks convergence until an independently eligible replacement or compiled recovery restores the minimum. Appeals and corrections use the sealed platform authority and never reveal linked accounts to content or other participants. A correction cannot reopen a completed output entitlement.

### Contribution eligibility

Completion and any non-cash status recognition do not reward inactive passengers equally by default. Definitions declare meaningful contribution categories such as:

- scarce materials deposited and consumed;
- specialist job completed;
- required profession role fulfilled;
- high-risk operation performed;
- critical component delivered;
- facility or logistics support committed;
- required deduction/evidence receipt in a later mystery-linked project.

Raw action count, chat messages, time present, joining early, or depositing and withdrawing the same value are not sufficient.

Every value-bearing output ordinal resolves to exactly one server-derived account recipient or one purpose-bound installed Family facility/project asset. The recipient policy and output cardinality are frozen before value contributions begin. A participant set may define eligibility but is not an ownership scope. Multiple contributor outputs must be individually declared and capped independently of roster size; replacement, rejoin, or alt accounts cannot multiply them. A leader cannot choose recipients at completion. Continuing project custody and installed Family assets require complete dissolution and recovery behavior and do not create a general Family item wallet. Phase 2 projects do not distribute OMR.

Directly distributed valuable outputs require a platform-level minimum semantic contribution proven by server receipts, not an author-selected passenger list. Any baseline passenger acknowledgment is non-tradeable, non-export-eligible, non-power-bearing, and cannot unlock progression or another economy prerequisite.

### Proving social project

The Phase 2 starter catalog must include at least one major armored-vehicle or secure-transport project requiring:

- a master or high-rank mechanic;
- a machinist;
- an armory/armor specialist;
- a rare physical blueprint;
- a Family garage or secure workshop;
- components from several production chains;
- several distinct accounts;
- parallel and ordered stages;
- full contribution and output provenance.

The result must stay inside existing vehicle/combat balance envelopes.

## Provenance

### Event ledger

`item_events` is expanded with typed, bounded references rather than unbounded JSON on hot rows. Important events include:

- crafted or salvaged creation;
- source-lot lineage where reasonable;
- creation season;
- quality determination;
- modification installation/removal;
- damage, repair, and maintenance;
- market and direct ownership transfers;
- service completion;
- project contribution and completion;
- major PvP events;
- mystery use or discovery;
- Family operations;
- historical/seasonal designation;
- export-eligibility evaluation, grant, or revocation (eligibility metadata only in Phase 2).

Not every bullet or trivial use creates permanent notable provenance. Definitions and server capabilities decide which events are notable. Full transactional item movements remain auditable even when they are not displayed as lore.

### Lineage

Output provenance can reference selected source lots/items through normalized lineage edges. To prevent unbounded fanout:

- every mutation retains complete input/output accounting;
- the canonical full-lineage/event digest is server-internal and never projected as a private-history equality oracle;
- a client receives either an opaque stable public handle or a digest computed only over that viewer's authorized projected event set and domain-bound to item, audience subject/scope/generation, projection-policy version, and pagination frontier; a hidden event cannot change an unauthorized viewer's handle/digest, summary bytes, cache key, count, cursor, or market/item response;
- full lineage is paginated and queried from ledger tables;
- material lots remain physically distinct and may aggregate only in Phase 2A-compatible read projections;
- lineage cycles are impossible because outputs can reference only inputs consumed or transformed by an earlier/same mutation ordinal.

### Hot-row summary

Unique item rows store a compact internal canonical provenance digest and selected server-authoritative summary fields such as creator, season, quality, current modification count, major historical flag, and latest repair. Projection derives only audience-authorized fields and its separately domain-bound viewer digest/opaque handle; it never copies the internal digest. The append-only event ledger remains the detailed authority.

## Selective NFT readiness

### Eligibility

Only unique item definitions can declare possible export eligibility. Candidate classes include:

- Masterwork weapons;
- legendary vehicles represented by one authoritative unique asset identity;
- unique jewelry;
- seasonal trophies;
- historical artifacts;
- important mystery objects;
- named high-provenance equipment.

Materials, stack components, ammunition, contraband, consumables, routine tools, routine equipment, and recipe knowledge cannot become export eligible.

Eligibility is not export. It grants no token, contract call, or chain ownership.

### State machine

Conceptual `item_export_eligibility` is one-to-one with the canonical unique item or vehicle identity and supports only:

```text
ineligible <-> eligible
```

No Phase 2 schema constraint, route, adapter, operator action, or activated package can enter `export_reserved`, `exported`, or an import state. Those states require a separately approved future migration and design; they are not prematurely included in the Phase 2 enum.

Eligibility records preserve only canonical asset ID, definition hash, provenance digest, eligibility reason, policy hash, state revision, and evaluation audit data. Current owner is derived from the authoritative item or vehicle row and is never duplicated as eligibility authority. Contract addresses and token IDs do not exist in this Phase 2 table.

If legendary vehicles become eligible, the existing canonical car identity is referenced directly or migrated once into a reviewed unified unique-asset authority. The implementation may not create an independently owned `item_instance` representing the same vehicle.

### Eligibility policy

Eligibility is derived by an allowlisted server policy from item definition, quality, provenance, season, and uniqueness. Content cannot nominate arbitrary existing item IDs. Revoking eligibility changes metadata only and cannot change ownership, custody, or item identity; any future export migration requires explicit state handling.

## API and capability surface

Market reads and mutations:

- `GET /v1/worldgraph/market`;
- `GET /v1/worldgraph/market/:listingId`;
- `POST /v1/worldgraph/market/list` using one server-issued owned-asset action plus bounded price/quantity fields;
- `POST /v1/worldgraph/market/:listingId/fill`;
- `POST /v1/worldgraph/market/:listingId/cancel`.

Service reads and mutations:

- `GET /v1/worldgraph/services`;
- `POST /v1/worldgraph/services` from a server-issued recipe/item service action;
- `POST /v1/worldgraph/services/:orderId/accept`;
- `POST /v1/worldgraph/services/:orderId/start`;
- `POST /v1/worldgraph/services/:orderId/complete`;
- `POST /v1/worldgraph/services/:orderId/cancel` when issued.

Project reads and mutations:

- `GET /v1/worldgraph/projects`;
- `POST /v1/worldgraph/projects/:projectDefinitionId/open`;
- `GET /v1/worldgraph/projects/:projectId`;
- `POST /v1/worldgraph/projects/:projectId/join`;
- `POST /v1/worldgraph/projects/:projectId/contribute` from an issued contribution action;
- `POST /v1/worldgraph/projects/:projectId/start`;
- `POST /v1/worldgraph/projects/:projectId/complete`;
- `POST /v1/worldgraph/projects/:projectId/cancel` when issued.

Item detail exposes paginated provenance and safe export eligibility:

- `GET /v1/worldgraph/items/:itemId`;
- `GET /v1/worldgraph/items/:itemId/provenance`.

Every mutation requires `Idempotency-Key` and current revision where the aggregate is revisioned. The server revalidates all authority under lock. Stale state returns a stable conflict code plus safe replacement projection.

No Phase 2 endpoint exports an item, mints an NFT, accepts OMR, or distributes OMR.

## Lock order and transaction boundaries

The global Phase 2 lock order remains binding. For multi-party actions, character/account IDs are sorted before locking. Cash balance authority is acquired through the applicable character/account locks at global steps 2 and 3. Any required social-independence account-mapping rows are locked next by account ID/generation, followed by subject-generation rows by subject ID/generation, before organization rows and the domain mutation guard. The listing, service, or project aggregate precedes lots/items, and shared ledger budgets or singleton rows follow inventory at global step 9. If an existing cash path would require an inverse lock edge, implementation blocks for architectural review instead of creating an exception locally.

Each logical action has one domain guard and one database transaction:

- list: escrow asset and open listing;
- fill: transfer item/lot, move cash/fee, write provenance, advance listing;
- service start/complete: escrow/consume inputs, reserve/release capacity, mutate/produce item, move cash;
- project contribution: escrow/consume exact requirement and record contribution;
- project completion: verify stages/contributors, create output, close custody.

HTTP idempotency response storage is not considered sufficient. Domain guards and unique database constraints survive changed idempotency keys and races.

## Validation

Activation fails for:

- trade of a definition whose policy forbids it;
- a marketable item without custody lifecycle behavior;
- unique-item partial fills;
- prices/quantities outside safe integer bounds;
- settlement arithmetic without checked multiplication/addition and deterministic fee rounding, or a listing whose custody remainder can diverge from its displayed remainder;
- a service without deterministic success/completion criteria;
- a visible service order not fully backed by its frozen target, customer inputs, and maximum payment;
- a cancellation path that refunds consumed value or pays an unperformed service;
- a project with impossible role/profession/account composition;
- project stages with circular or unreachable dependencies;
- contributions that can be satisfied entirely by one account when distinct roles are required;
- a value-bearing/scarce or critical-path social project that omits `real_independent_participants`, or whose composition/recovery cannot satisfy distinct current independence subjects;
- replacement generations that let one account satisfy a lifetime-distinct role or contributor set several times;
- duplicate output or reward paths;
- a value-bearing project output with multiple owners, roster-dependent cardinality, retroactive recipient selection, or passenger eligibility;
- destructive unique-item dependencies without recovery;
- organization dissolution without custody recovery;
- provenance lineage cycles or unbounded hot-row history;
- export eligibility on stack, consumable, OMR, knowledge, ordinary inventory definitions, or a duplicate item-instance representation of an existing vehicle;
- any route/effect capable of NFT export or contract invocation in Phase 2;
- any OMR cost, price, output, reward, or movement.

The compiler emits project minimum-account/profession/facility/item estimates, contribution critical paths, custody/recovery analysis, provenance fanout, marketability, and export-eligibility reports.

## Migration and compatibility

- Existing market listing types continue unchanged; Phase 2 item listings use their own typed tables and routes.
- Existing Bellini exchange offers remain exact-hash inert and cannot accept Phase 2 items.
- Existing operation escrow is migrated/adapted without changing the recorded historical depositor or releasing an item to a replacement character.
- Existing Phase 1 items acquire provenance summaries only from known ledger facts. Unknown history is not fabricated.
- Existing unique assets become export-ineligible by default. Eligibility requires an explicit reviewed definition and deterministic migration.
- Existing organizations retain their current identity, hierarchy, treasury, and dissolution behavior. Project custody adds no general-purpose Crew treasury or inventory.
- Existing in-flight jobs/services/operations remain pinned and recoverable. If a registered incident freezes an unsafe pinned offer fill, service accept/start/complete, or project transition, safe cancel/refund/custody recovery remains available and no transition floats to the new definition.

Backup, restore, death, replacement, and organization-dissolution verification must include every new market, custody, service, project, contribution, provenance, and eligibility table.

Every changed market, service, project, provenance, and eligibility UI conforms to the cross-cutting WCAG 2.2 AA contract. Phase 2E maintains the complete applicable/N/A success-criterion matrix with evidence owners and artifacts; browser/mobile verification includes keyboard and assistive-technology operation, orientation, non-essential timer adjustment or reviewed essential-window recovery, hover/focus content, focus not obscured, 24-by-24 target sizing or valid exceptions, 200% text resize, 320-CSS-pixel/400% reflow, exact 1.4.12 text spacing, forced colors, localization, and privacy-safe synthetic fixtures.

## TDD and verification

Implementation begins with failing tests for:

1. Listing escrow, visibility, cancellation, expiry, and partial fills.
2. Same-key and different-key listing/fill/cancel replay.
3. Concurrent fills of the last quantity or one unique item.
4. Custody-remainder authority, `filled + remaining = original`, partial-lot lineage, checked price multiplication, deterministic fee rounding, and cash ledger rollback at integer bounds.
5. Prohibition of listing bound/inert/consumed/reserved items.
6. Fully backed service opening, acceptance/start/completion/cancellation/deadline recovery, provider qualification, customer double-spend refusal, provider no-show, ready abandonment, death/replacement, and concurrent acceptance.
7. Service item, material, cash, facility, and output conservation.
8. Project distinct accounts and social-independence subjects across simultaneous/stage/lifetime scopes, roles, replacement generations, professions, stages, facility access, and contribution types, including linked sockpuppets, unrelated same-origin household accounts, appeal/correction, a mid-run subject merge, privacy, and completion races.
9. Passenger ineligibility and anti-action-count behavior.
10. Seat replacement, departure, death, Family leadership change, and dissolution recovery.
11. Project contribution and completion replay/concurrency, including R1 open offer/service/project transitions racing R2 activation and a registered incident freeze; each unsafe transition commits before the freeze or enters its exact conservation-safe cancel/refund/recovery path.
12. Provenance lineage, pagination, internal canonical digest stability, audience-bound projected digest/opaque-handle behavior, hidden-event noninterference across item detail/market/provenance reads and caches, and bounded hot rows.
13. Unique-item single ownership across market, service, project, and ordinary inventory.
14. Export eligibility/revocation metadata and database rejection of every reservation, exported, import, chain, and token state or field.
15. Rejection of stack/consumable/knowledge export eligibility and every OMR path.

Required verification includes focused unit/API tests, property-based conservation, market-transfer tests, real PostgreSQL multi-session races, pg-mem full suite, migration and backup/restore tests, death/dissolution lifecycle tests, route authorization tests, the complete independently reviewed WCAG 2.2 AA matrix and browser/mobile evidence for every changed UI, economy and population-scale simulations, and the full repository suite.

## Phase 2 whole-economy gate

After Phase 2E task-level review passes, a fresh broad review must cover all Phase 2A–2E code and content.

The starter catalog is not complete unless automatic package discovery and the compiled definition registry reconcile to a counted inventory meeting all blocking floors below. The census counts distinct production-selected logical IDs at exactly one candidate release version after alias/supersession normalization. It excludes fixtures, archived/deprecated versions, compatibility-only legacy definitions, non-activatable examples, aliases, and multiple hashes/quality variants of one logical definition. A definition counts only when its source, dependencies, validator coverage, and required runtime capability are present in the candidate release. “Equipment/modification class” means a distinct registry-owned functional class represented by at least one usable finished definition; “service definition” means a distinct executable logical service contract, not one provider/order/recipe version. The signed census retains the selected ID/version list so review can reproduce every total.

The default target may exceed the floor; any shortfall requires a written user-approved scope amendment with updated economy, graph, and playability evidence. Weak filler is rejected even when the counts pass.

| Catalog class | Blocking floor |
|---|---:|
| Purposeful material definitions | 45 |
| Production recipes | 30, including at least 6 chains of depth 4+ and 2 cross-profession assemblies |
| Physical/knowledge blueprint definitions | 12, including at least 3 fragmented and 4 scarce/non-common learning authorities |
| Enabled facility types with reachable creation/access sources | 8 |
| Ammunition compatibility classes | 3 |
| Fictional contraband product families | 2, each with at least 4 economic stages |
| Finished equipment/modification classes | 12 |
| Service definitions | 4 |
| Social production projects | 2: at least one Crew project and one Family project |

The same discovery-reconciled inventory must contain at least one currently executable, interconnected XP-and-demand loop for each of the nine production professions. Each row requires an integration test and clean source/sink, economy, and profession-event report entries. Every loop demonstrates acquisition → profession-qualified processing/work → meaningful downstream use → maintenance, consumption, or replacement sink → provenance; it must award legitimate XP from real consumptive participation rather than a transfer/list/cancel loop.

| Profession | Minimum proving loop |
|---|---|
| Salvage | Condition-aware vehicle consumption into several useful material families with downstream demand |
| Mechanics | Salvaged/processed components into a usable and maintainable vehicle component or modification |
| Machining | Raw/processed metal through precision component, tooling, and downstream subassembly |
| Armory | Abstract ammunition or equipment inputs through a compatible batch/subassembly into transactional combat consumption, wear, or repair |
| Garmentwork | Cloth/leather/rubber inputs into protective or specialist equipment with bounded quality, wear, and repair |
| Medicine | Medical/laboratory supplies through a clinic-qualified support item or service into bounded use and replenishment/disposal |
| Presswork | Paper/ink/printing supplies through plates, documents, seals, or blueprint reproduction into controlled use and a material/tool sink |
| Finework | Jewelry/precision inputs through a provenance-bearing object, specialist component, or lockwork tool into wear, service, or project use |
| Construction | Construction supplies and machine parts through a facility component/upgrade or secure infrastructure stage into maintenance and eventual replacement |

Cross-domain coverage additionally proves a fictional contraband chain with source, multiple processing stages, packaging, committed custody/transport, bounded distribution, law pressure, and loss/recovery; reusable-tool production through committed use, wear, repair, and replacement; and a rare mystery component through multi-profession production, recovery, and provenance.

At least one contraband/logistics or secure-transport chain must gain meaningful Crew or Family specialization through the Phase 2E project system. This matrix is functional coverage, not an arbitrary item-count quota.

Required economy simulation scenarios include:

- low, expected, and high player populations;
- specialist scarcity and broad generalist behavior;
- salvage supply by car class and condition;
- material source/sink balance over long horizons;
- facility throughput and maintenance;
- recipe profitability and dominant-cycle detection;
- ammunition production and consumption;
- contraband production, loss, pressure, and distribution margins;
- equipment quality/power distribution;
- repair and replacement demand;
- market liquidity, fees, price manipulation, and alt-account transfers;
- project concentration and Family resource requirements.

Before catalog tuning begins, the implementation plan fixes quantitative pass budgets for renewable stock growth, source/sink coverage, gross cash emission, profession/source concentration, Masterwork frequency, facility utilization/queue percentiles, market spread/manipulation tolerance, project completion by population, supply-shock recovery, critical-chain blockage, and contention/retry rates. The branch retains deterministic pre-tuning, final, and sensitivity reports. Moving a threshold after observing a failure requires a reviewed plan/spec amendment rather than silent retuning.

The final Phase 2 red team explicitly attacks material and item duplication, salvage/craft/trade/service/project replay, escrow duplication, integer overflow, unique-item double ownership, same-account character rotation and linked-account social-independence bypass, market manipulation, deadlocks, rollback gaps, exported/off-chain split ownership, unauthorized content execution, economic inflation, cash-ledger divergence, and OMR leakage.

All Critical and Important findings must be resolved and re-reviewed before Phase 2 is declared complete.

## Explicit non-goals

Phase 2E does not include:

- a universal auction house for every OMERTÀ asset;
- OMR-denominated prices or rewards;
- loans, derivatives, or arbitrary player-authored contracts for items;
- subjective service disputes or arbitration;
- unrestricted Crew inventory;
- cross-Family production or diplomacy;
- equal rewards for inactive project members;
- provenance for every trivial use event in hot item rows;
- NFT minting, export routes, bridge code, token contracts, or deployment;
- Phase 3 mystery aggregation;
- production deployment or package activation.

## Exit criteria

Phase 2E and Phase 2 as a whole exit only when markets, services, custody, projects, provenance, and eligibility preserve one authoritative ownership state; social projects enforce real distinct participation; every changed UI conforms to WCAG 2.2 AA with the complete evidence matrix; economy and population simulations find no unbounded source or dominant exploit; pg-mem and real PostgreSQL race suites pass; every Critical and Important finding is resolved; OMR remains untouched; and the branch remains unmerged and undeployed for explicit user approval.
