# World Graph, Mystery, and Item Economy Design

## Purpose

Build one reusable gameplay foundation that lets OMERTÀ support a very large library of mysteries, puzzles, Crew and Extended Family operations, crafting chains, salvage, specialized production, item provenance, and selected NFT export without turning each new piece of content into custom server code.

The system must support content authored by parallel agents while preserving economic safety, deterministic validation, seasonal controls, and the existing OMR invariant that normal gameplay does not create an uncapped time-based OMR faucet.

## Design principles

1. Content is data-defined. New mysteries, recipes, item chains, and social operations should normally be added as graph content rather than new route logic.
2. The graph is the source of dependency truth. Every material source, recipe input, mystery prerequisite, social role, world condition, and reward dependency is represented explicitly enough to validate.
3. Items and collection status are separate concepts. `collection_log` remains an account-level completion/status ledger. Crafting inventory uses a new value-bearing ledger and must not reuse collection storage.
4. OMR is isolated from ordinary crafting. Graph content can qualify a player or group for finite seasonal OMR inventory, but cannot mint OMR or grant chance-based OMR from repeatable activities.
5. Social requirements must be real. Crew and Family content can require distinct accounts, distinct roles, ordered contributions, simultaneous participation windows, and evidence held by different players.
6. Default inventory stays off-chain. Only selected unique or high-value item instances become eligible for NFT export after the internal ownership ledger is authoritative.
7. Every economic mutation is transactional, ledgered, replay-safe where practical, and validated against duplicate claims.
8. The first implementation proves the architecture with a small vertical slice. It does not attempt to ship thousands of content nodes before the engine is stable.

## Existing systems to preserve and reuse

The current clue system already proves several useful patterns: deterministic per-scroll puzzle state, server-verifiable progression, explicit pacing, account-level completion tracking, and a deliberate rule against randomized OMR rewards. The new mystery runtime should preserve those properties while allowing broader node types and social dependencies.

The current skill system already provides character specialization, prerequisite chains, account-level prestige interactions, and explicit economic boundaries. The new crafting professions should integrate with this model instead of replacing it.

The existing collection system remains a best-effort, idempotent record of lifetime discoveries. New item acquisition may call collection logging for status purposes, but the collection ledger must never become authoritative inventory.

## Architecture overview

The expansion is divided into six modules:

1. World Graph Registry
2. Inventory and Item Ledger
3. Crafting and Salvage Runtime
4. Mystery and Social Operation Runtime
5. Static and Runtime Graph Validation
6. NFT Export Boundary

The first implementation phase includes modules 1 through 5 and only the interface contract for module 6.

## 1. World Graph Registry

### Node model

Every authored graph node has a stable string identifier and a declared type.

Initial node types:

- `material`
- `item_template`
- `recipe`
- `source`
- `sink`
- `evidence`
- `mystery_step`
- `operation_step`
- `social_gate`
- `world_gate`
- `choice`
- `reward`

A node definition must be immutable for an active season unless a migration explicitly upgrades in-progress state.

### Common fields

Each node may declare:

- `id`
- `type`
- `version`
- `season`
- `visibility`
- `requires`
- `requiresAny`
- `excludes`
- `consumes`
- `produces`
- `conditions`
- `failureRules`
- `repeatability`
- `cooldown`
- `metadata`

`requires` is an AND dependency list. `requiresAny` contains OR groups. Content authors must not implement dependency rules through arbitrary executable code inside data files.

### Visibility

Supported visibility states:

- `public`
- `discovered`
- `hidden`
- `role_private`

Hidden nodes can become visible after graph conditions are met. Role-private nodes are visible only to assigned social-operation participants.

### Graph packages

Content is loaded in named packages, for example:

- `core-materials`
- `automotive-salvage`
- `ammunition-crafting`
- `belladonna-demo`

Packages declare dependencies on other packages. This allows parallel content authorship without editing one giant catalog file.

## 2. Inventory and Item Ledger

### Inventory classes

Two inventory classes are required.

#### Stack inventory

Used for fungible materials and commodities:

- scrap steel
- brass
- lead
- wire
- cloth
- chemicals
- fuel
- generic parts

Stacks are keyed by owner, template ID, and optional quality band.

#### Item instances

Used for unique or stateful objects:

- crafted weapons
- modified vehicle parts
- mystery artifacts
- rare tools
- blueprints
- named masterwork items
- future NFT-eligible objects

Each instance receives a permanent server-side item ID.

### Ownership scopes

Items may belong to:

- character
- account
- Crew
- Family
- escrow or operation

The first phase must support character and account ownership plus operation escrow. Crew and Family inventory can be added through the same ownership abstraction when social production requires it.

### Provenance

Unique item instances record a compact provenance history through events rather than repeated mutation of free-form metadata.

Initial event types:

- crafted
- salvaged
- transferred
- consumed
- modified
- used_in_mystery
- awarded
- exported
- imported

This history later supports NFT metadata and historical game mechanics.

### Conservation rules

All inventory mutation runs through a small set of primitives:

- grant stack
- consume stack
- create item instance
- transfer item instance
- consume item instance
- escrow item
- release escrow

No content package writes inventory tables directly.

## 3. Crafting and Salvage Runtime

### Recipe definition

A recipe declares:

- stable recipe ID
- inputs
- optional catalyst inputs
- outputs
- required profession or skill state
- required facility or location
- time or cooldown if applicable
- cash or other explicit costs
- quality rule
- discovery rule
- repeatability

Recipes may produce stack materials, unique item instances, or both.

### Profession integration

Phase one must not create a second full skill tree. It introduces a recipe requirement adapter that can read existing skill and progression state. Later phases may expand the skill catalog with professions such as mechanics, machining, chemistry, gunsmithing, tailoring, forgery, and medicine.

### Salvage

Salvage is recipe-like but consumes an existing game asset or item instance and produces materials.

The first vertical slice uses vehicle salvage because OMERTÀ already has cars and ownership state.

Example demonstration chain:

`wrecked car -> scrap steel + wire + salvage parts`

`scrap steel -> hardened steel`

`hardened steel + salvage parts -> precision lock tool`

The exact production values are balance levers and must be kept in graph content, not hard-coded into handlers.

### Ammunition and drug production

These are later content packages, not first-phase production features. The engine must be able to model multi-stage supply chains, but the initial PR should not expand regulated-product detail beyond game abstractions needed for safe fictional gameplay.

## 4. Mystery and Social Operation Runtime

### Mystery state

A mystery instance stores only runtime state:

- graph ID and version
- owner scope
- discovered nodes
- completed nodes
- failed nodes
- committed choices
- escrowed items
- participant assignments
- timestamps
- claim state

The graph definition stays in source-controlled content files.

### Player mystery nodes

A node may require combinations of:

- location
- character progression
- owned item or material
- evidence
- previous graph nodes
- world event state
- player history
- time window
- explicit interaction

The runtime evaluates these through registered condition adapters rather than arbitrary content code.

### Social operation model

A social operation defines named roles and participant constraints.

Example roles:

- investigator
- driver
- mechanic
- enforcer

Role definitions can require different player state. The runtime enforces distinct account IDs where the operation demands multiple people.

Supported coordination patterns in phase one:

- distinct participant count
- role assignment
- role-private evidence
- ordered contributions
- shared operation state
- item escrow from different participants
- completion only when all required branches converge

Later phases can add narrow simultaneity windows, Crew hierarchy constraints, Extended Family aggregation, and cross-Family operations without changing the core state model.

### Evidence model

Evidence is graph state, not necessarily a physical item. Evidence can be:

- personal
- operation-shared
- role-private
- transferable through an explicit mechanic in later phases

The first demonstration mystery uses both personal and shared evidence to prove asymmetric information.

### Choices and failure

Graph choices can be permanent for one mystery instance. Failure rules must be explicit and validated.

Examples:

- consume an item on attempt
- close one branch after another is selected
- invalidate a step after participant death
- expire an operation after a window

The first phase should prove irreversible branching but avoid punitive permanent character losses until the system is tested in production-like simulation.

## 5. Graph Validation

Validation runs before authored content is accepted and again in CI.

### Structural validation

Reject:

- duplicate IDs
- missing dependencies
- invalid node types
- incompatible package versions
- malformed AND or OR dependencies
- unsupported condition adapters

### Reachability validation

For each graph package, calculate whether every non-secret terminal node is reachable from at least one valid starting state under declared dependencies.

Cycles are not automatically illegal. A cycle is legal only if it contains a declared repeatable production loop and does not require net-positive creation of conserved value. Mystery prerequisite cycles are rejected.

### Item source and sink validation

Every required material must have at least one valid source in the loaded package dependency set unless explicitly marked administrator-seeded or seasonal-seeded.

Every economy-significant material class should have at least one sink or durable use. CI reports orphaned sources and sinkless materials.

### Recipe conservation validation

The validator checks:

- no recipe consumes negative quantity
- no zero-cost recursive recipe creates an input ancestor
- unique items are not produced as stack quantities
- consumed unique items cannot remain simultaneously owned

### Social solvability validation

Each social operation reports:

- minimum distinct accounts
- required roles
- mutually incompatible role requirements
- whether one account could satisfy multiple roles when prohibited

Impossible role combinations fail validation.

### Reward validation

Reward nodes are classified by currency or asset type.

OMR reward nodes require all of these:

- seasonal finite allocation ID
- one-time or explicitly capped claim rule
- no random repeatable trigger
- no direct mint behavior
- claim idempotency key

The graph engine does not call the OMR contract mint path.

### Runtime idempotency

Completion and reward claims use transaction-level guards so retries cannot duplicate inventory or rewards.

## 6. NFT Export Boundary

NFT export is not part of the first production implementation, but the item ledger must preserve enough information for it.

Only unique item instances can become export candidates.

Required future export fields:

- immutable server item ID
- template ID
- provenance digest
- current owner
- export state
- chain token identifier when exported

An exported item must either be locked from normal off-chain transfer or represented through a single authoritative bridge state. The same item must never exist as independently spendable on-chain and off-chain copies.

## Database direction

The implementation plan should map exact schema names after reviewing current migrations. Conceptually the first phase needs storage equivalent to:

- world graph instance state
- material stacks
- unique item instances
- item provenance events
- operation participant assignments
- operation escrow
- reward claim guards

Schema additions must follow existing PostgreSQL and pg-mem compatibility rules and be included in migration, backup, restore, and clean-start tests.

## API direction

The first phase should expose only the minimum gameplay surfaces needed for the vertical slice:

- inventory read
- recipe catalog read for discovered recipes
- craft action
- salvage action
- mystery board read
- mystery interaction action
- social operation join or role assignment
- social operation contribution

The engine itself must remain usable from server modules without HTTP so future systems can trigger graph actions internally.

## Vertical proof: Belladonna Lockbox

The first shipped content graph is intentionally small but exercises all important boundaries.

### Part A: acquisition

A player obtains or designates a salvageable car under existing game ownership rules.

### Part B: salvage

The vehicle is consumed by a salvage action and yields bounded material stacks.

### Part C: crafting

The player processes materials and crafts a unique `precision_lock_tool` item instance. The recipe requires an existing progression or skill condition and a valid facility/location condition.

### Part D: individual investigation

The player discovers a Belladonna evidence chain. One step requires possession of the crafted tool and consumes or escrows it according to the authored rule.

### Part E: Crew operation

The individual chain opens a four-role operation. Four distinct accounts must fill investigator, driver, mechanic, and enforcer roles. At least two roles receive different private evidence. The mechanic branch requires a contributed crafted item.

### Part F: convergence

The four branches converge on one lockbox decision. A correct completion creates a non-OMR mystery artifact and a finite status reward. The demonstration does not distribute OMR.

This proves the engine before OMR seasonal vault integration is enabled.

## Security and exploit constraints

- Never trust client-declared inventory, role qualification, completion, recipe cost, or graph state.
- Lock consumed inventory rows in the same transaction as production.
- Unique item state changes require single-owner checks.
- Operation contribution is idempotent.
- Participant uniqueness is enforced in storage or transaction logic, not only UI.
- No content-defined SQL or JavaScript execution.
- Content definitions use allow-listed condition and effect adapters.
- Seasonal content changes require versioning.
- Admin or agent accounts remain excluded from competitive or scarce-player reward paths where current game policy requires exclusion.

## Agent-authored content workflow

After the engine is stable, content agents work on independent graph packages.

Recommended author roles:

- mystery author
- Crew operation author
- Family conspiracy author
- crafting-chain author
- salvage author
- economic balance reviewer
- lore consistency reviewer
- graph reachability reviewer
- exploit reviewer

Every authored package must pass the same validators before merge. Agents cannot bypass validation by adding custom server logic for ordinary content.

## Testing strategy

The first implementation requires:

1. Unit tests for graph loading, dependency evaluation, visibility, choices, and node completion.
2. Inventory conservation tests for stack and unique items.
3. Transactional crafting tests including duplicate request replay.
4. Salvage tests proving the source asset is consumed exactly once.
5. Social operation tests proving distinct-account and role rules.
6. Graph validation tests for missing nodes, cycles, impossible recipes, impossible social role sets, and invalid OMR reward definitions.
7. End-to-end Belladonna vertical-slice test.
8. Existing full repository suite.
9. Real PostgreSQL migration and transaction tests.
10. Economy simulation checks proving the new demonstration chain does not create OMR or uncontrolled cash.

## Delivery phases

### Phase 1: foundation

World graph registry, inventory ledger, unique item instances, recipe runtime, salvage primitive, mystery runtime, basic social operations, validators, and Belladonna proof.

### Phase 2: RuneScape-like economy expansion

Broader material catalog, professions, workshops, recipe discovery, repair, durability, more salvage classes, production sinks, market integration, and multiple crafting packages.

### Phase 3: massive mystery content

Parallel authoring of individual mysteries, Crew cases, Family conspiracies, seasonal meta-mysteries, hidden recipe chains, and social coordination content.

### Phase 4: seasonal OMR hunt integration

Finite seasonal OMR vault allocations become graph reward sources with hard one-time or capped claim rules, competition limits, and token-economy simulation.

### Phase 5: NFT export

Selected unique item instances can be exported with provenance while preserving single authoritative ownership.

## Acceptance criteria for Phase 1

Phase 1 is complete only when:

- graph content can be added without editing the runtime
- stack materials and unique items conserve ownership across mutations
- a car can be salvaged exactly once into defined materials
- a unique crafted item can be produced from those materials
- a mystery can require and consume or escrow that item
- a social operation can require at least four distinct accounts in different roles
- private evidence can differ by role
- operation branches can converge into one completion state
- duplicate requests cannot duplicate materials, items, or rewards
- invalid graph content fails CI before deployment
- OMR cannot be minted or randomly emitted through the graph engine
- the Belladonna vertical proof passes on pg-mem and real PostgreSQL
- the existing game test suite remains green

## Out of scope for Phase 1

- thousands of production mystery nodes
- full profession rebalance
- player-to-player item market redesign
- NFT minting or bridge deployment
- cross-Family diplomacy mechanics
- permanent punitive character loss from puzzle failure
- production OMR seasonal distribution

These are intentionally deferred until the core graph, inventory, and validation contracts are proven.