# Omerta content graph

This directory is the authoring boundary for versioned mysteries, social dependency graphs, item
economies, seasonal overlays, growth journeys, and bounded rewards. Packs are data. They never carry
JavaScript, SQL, shell commands, credentials, or external publishing authority.

## Commands

```sh
npm run content:check
npm run content:build
npm run content:build:storylets
npm run content:build:don-cases
npm run content:build:path-cases
npm run content:build:social-cases
npm run content:build:seasonal-cases
npm run content:build:crafting-packs
npm run content:build:crafting-jobs
npm run content:build:crafting-tools
npm run content:build:crafting-exchange
```

`content:check` validates both Sixth Chair source packs, all six district storylets, all seven Don
Cases, all six Path Cases, the first two-seat organization case, the first production seasonal case,
and all four versions of the first production authored workshop, then prints their SHA-256 identities.
`content:build` writes the current runtime-ready bundle to `content/dist/sixth-chair-v2.json`;
`npm run content:build:storylets` writes the six independently versioned district bundles;
`npm run content:build:don-cases` writes the seven independently versioned late-game bundles;
`npm run content:build:path-cases` writes the six independently versioned identity bundles; and
`npm run content:build:social-cases` writes **The Two-Man Rule**;
`npm run content:build:seasonal-cases` writes **The Books Open at Midnight** to the immutable
`content/dist/books-open-at-midnight-v1.json` artifact;
`npm run content:build:crafting-packs` writes **The Bellini Restoration** to the immutable
`content/dist/bellini-lockbox-v1.json` artifact;
`npm run content:build:crafting-jobs` writes **The Bellini Restoration School** to the immutable
`content/dist/bellini-lockbox-v2.json` artifact;
`npm run content:build:crafting-tools` writes its **Press Room** durable-tool extension to the immutable
`content/dist/bellini-lockbox-v3.json` artifact;
`npm run content:build:crafting-exchange` writes its **Material Exchange** extension to the immutable
`content/dist/bellini-lockbox-v4.json` artifact;
`npm run content:build:v1` retains the original compiler specimen build. Build commands never activate
content: an operator must still promote the exact artifact and hash. Rebuilding identical input
is byte-for-byte idempotent, and changing an existing output version is refused. Author a new version
instead of overwriting a promoted one.

[`packs/sixth-chair/pack.json`](packs/sixth-chair/pack.json) is the unchanged v1 compiler specimen.
[`packs/sixth-chair-v2/pack.json`](packs/sixth-chair-v2/pack.json) is the first runtime-ready story:
a four-role Crew or Extended Family mystery with three normalized-answer puzzles, one
consent-required human witness choice, shared evidence, a world fact, and value-neutral status and
collectible awards. Builds never activate a pack. An operator promotes the exact compiled artifact
and hash through `POST /v1/mod/content/activate`.

The first district sampler is six short, personal stories, one per district:

- Docks — **The Man Who Missed the Tide**;
- Canal — **Water in the Cellar**;
- Brick — **The Last Kiln**;
- Neon — **House Lights**;
- Foundry — **The Furnace Ledger**;
- Cathedral — **A Saint's Account**.

Each is district-gated, sequential, playable by a human or agent-controlled living street, and pays
one exactly-once gameplay-inert collectible. The selected choice is recorded with the instance, but
this first sampler intentionally has no divergent cash, $OMR, status, or power consequence. Each pack
has its own namespace, version, and activation hash, so operators can promote or roll forward one
district without rewriting another.

The late-game spine is seven personal **Don Cases**, each with five to eight sequential actions:

- level 35 — **The Iron Election** (Brick Yards; The Gambler 10 route);
- level 50 — **A House Made of Glass** (Neon Mile; Larceny 10 route);
- level 65 — **Port of No Return** (Docks; Seamanship 10 route);
- level 80 — **The Empty Seat** (Cathedral Steps; Big Scores 25 route);
- level 95 — **Two Funerals** (Foundry Row; Wet Work 25 route);
- level 110 — **The Federal Ledger** (Canal Ward; Commerce 25 route);
- level 125 — **Don of the City** (Brick Yards; Protection 40 route).

The board keeps a locked case visible with `eligible: false` and safe `blockedBy` data. Each ending
offers an ungated baseline, a mastery-sensitive method, and an optional Crew method; the specialized
route changes the authored outcome, never reward value. A selected ending writes one account-scoped,
write-once story flag from the reviewed vocabulary (`npc_ally`, `npc_grudge`, `district_contact`,
`witness_spared`, `family_debt`, `case_evidence`, `public_reputation`, or
`future_scene_variant`). `GET /v1/content` returns the caller's safe `storyFlags`, while bundle-source
provenance remains private. These flags are narrative memory only: they cannot change cash, $OMR,
mastery, combat power, or the transaction ledger. Every Don Case converges on one distinct,
gameplay-inert memento.

The identity drop is six personal **Path Cases**, one for each declared career:

- Gun — **The Last Clean Contract**;
- Ledger — **Hostile Books**;
- Kitchen — **The Bad Batch**;
- Wheel — **Black Ice**;
- Shadow — **Nobody Saw Him Leave**;
- Ring — **Twelve Rounds**.

Each case is discoverable only to its declared Path and runs through four investigations plus one
three-way resolution. The baseline is always available. The specialist method reads a reviewed
combination of owned skill, mastery, and regimen; the relationship method reads Honor or Infamy and
effective, lazily decayed standing with a canonical Underworld fixture. These server-derived gates
change method and remembered outcome, never reward value. Each ending writes one namespace-scoped,
write-once story flag and converges on one distinct gameplay-inert memento.

The social follow-up begins with **The Two-Man Rule**, a short two-seat case available to either a
Crew or an Extended Family. Its Watcher and Signatory investigate two private branches in parallel;
both branches must close before the Signatory receives the three-way resolution. Either supported
participant kind may fill either seat, so the case works for human-human, agent-agent, or mixed
organizations without weakening The Sixth Chair's separate consenting-human Witness contract. Every
participant self-claims the same gameplay-inert Split Counterseal, exactly once; the case moves no
cash or $OMR and grants no status or permanent power.

The first production seasonal case is **The Books Open at Midnight**
(`omerta.case.season.books-open-at-midnight`), a personal Opening-phase story with
`runPolicy: "once_per_season"`. Two normalized-answer puzzles lead to a three-way resolution and one
recurring, gameplay-inert seasonal page. It moves no cash, $OMR, power, or transaction-ledger value.
The source at `packs/books-open-at-midnight/pack.json` and its build artifact remain invisible until
an operator activates that exact compiled bundle hash.

The first production authored workshop is **The Bellini Restoration**
(`omerta.workshop.bellini-lockbox`). At the Old Foundry, two globally finite daily salvage sources
issue exact-hash Ledger Plate and Charred Binding lots once per account per source and epoch. The
v2 apprenticeship consumes those inputs at the start of server-timed work orders, produces inert
stackable workpieces at collection, and awards exact-hash Bellini Restoration XP at compiled
thresholds. The v3 Press Room adds a compiled location facility and one non-tradeable, exact-hash
Bellini Restoration Press whose only power is satisfying declared authored-crafting requirements.
The press wears when a requiring work order or recipe starts and repairs to its compiled maximum
only by consuming compiled same-hash materials at that facility. One account may have only one active
work order in this namespace. The final recipe
requires skill level 2 and consumes the workpieces FIFO to create one non-stackable Restored Bellini
Lockbox. The v4 Material Exchange makes only Ledger Plates and Charred Bindings tradeable through a
cashless, same-hash, whole-lot barter board. The compiled exchange manifest fixes its item allowlist,
24-hour offer lifetime, and five-open-offer account cap. Tools, workpieces, and the Lockbox remain
non-tradeable; every item remains account-owned and outside rare-item export.
Sources, jobs, recipes, clocks, XP, output quantities, global budgets, item caps, and location gates
are compiled data; clients cannot nominate them. A new active version never reinterprets an old
material lot or inherits its XP. An already-started old-hash job remains collectible under its pinned
definition, with its output and XP archived under that old hash, while non-stackable keepsake caps
span versions so a version bump cannot duplicate the keepsake. Durable tool state is intentionally
exact-hash instead: an old press remains archived and visible but cannot block or unlock a new version.
An open exchange offer is likewise pinned to its immutable hash and remains fillable or recoverable
after activation changes; it never accepts a current-version substitute.

## Runtime surface

The server stores immutable bundles and one active version per namespace. Each new instance pins
the active `{namespace, version, contentHash}` for its lifetime, so later promotions cannot rewrite
an in-progress story. Authenticated clients use:

- `GET /v1/content` for active experiences, eligible organization lobbies, and their own instances;
- the same board's `crafting` collection for active authored workshops, exact-hash inventory,
  archived lots, finite source state, recipe inputs, blockers, and refresh-safe direct actions;
- `POST /v1/content/:namespace/instances` to create a personal run or a Crew/Extended Family lobby
  and take a role;
- `GET /v1/content/instances/:instanceId` to refresh an issued lobby or member projection;
- the instance `join`, `consent`, `act`, `leave`, and `claim` endpoints for revision-checked play.
- `POST /v1/content/:namespace/sources/:sourceId/collect` and
  `POST /v1/content/:namespace/recipes/:recipeId/craft` with the board's `expectedContentHash`;
- `POST /v1/content/:namespace/jobs/:jobId/start` and
  `POST /v1/content/:namespace/jobs/:jobId/collect` for the board-issued work-order identity and hash.
- `POST /v1/content/:namespace/tools/:toolId/repair` for a board-issued exact-hash tool repair.
- `POST /v1/content/:namespace/exchange/list` to escrow an allowlisted material pair, plus the
  board-issued `exchange/:listingId/fill` and `exchange/:listingId/cancel` routes.

Mutations derive the actor, character, participant kind, and organization from authentication and
the database. Clients submit only their selected scope/role, affirmative consent where required,
the latest revision, and a server-issued action ID. A stale mutation returns `409 stale_instance`
with a safe replacement projection. Answer specifications, effect payloads, account IDs, and raw
organization IDs are never published. Runtime terminal awards are deliberately value-neutral and
do not call the currency ledger. Active actions revalidate the whole party's organization,
participant-kind, and consent authority; logical status and collectible entitlements are unique per
account even when that account appears in another organization run or later content version. Personal
district stories also revalidate location at create, start, and action time; `wrong_location` identifies
the required district without advancing the run.

Authored supply mutations derive the account, active bundle, exact source or recipe, global epoch,
quantities, and item definitions from server state. A changed activation returns `409 stale_content`
with a replacement workshop projection. Source issuance locks one citywide epoch reservoir and one
account claim authority before creating immutable provenance lots and an audit receipt. Recipe
execution consumes only same-hash lots in FIFO order, records an immutable receipt, and never calls
the cash, crate, ammo, or $OMR ledger. Inventory remains account-owned across street death. Archived
lots remain visible but cannot be substituted into a new bundle version's recipe pool. These direct
routes are deliberate player/controller actions and do not enter `POST /v1/agent/act` authority.

Authored exchange listing is the one supply-side request that deliberately accepts player-selected
item IDs and quantities. Both legs must be different members of the active compiled exchange allowlist,
both remain inside one exact content hash, and settlement is all-or-nothing. Listing consumes available
lots into an account-owned escrow row; filling atomically consumes the buyer's requested lots and emits
two provenance lots; cancellation restores exactly the offered leg. Live escrow remains included in
`maxOwned` checks, so posting an offer cannot reopen a source or recipe cap. Listing, fill, and cancel
append immutable events. The rail moves no cash, crates, ammo, $OMR, or transaction-ledger value and
does not touch either existing cash marketplace.

Location facilities are compiled references to authored locations, not ownable property. Durable
tools are account-owned, non-tradeable authored items plus an exact-hash durability row. Acquisition,
use, and repair append audit events. Wear is charged once at job start or inside the instant recipe
transaction; collecting a timed job never charges again. Repair input, maximum durability, per-use
cost, and facility are server-owned compiled data. This narrow power cannot affect combat, markets,
export, currency, ordinary inventory, or any action outside its authored workshop.

Work-order start consumes only current-hash inputs and records an immutable snapshot of its inputs,
outputs, duration, skill, and XP before the server clock begins. Collection is refused before
`readyAt`. A later activation does not strand a run: collection resolves the pinned immutable bundle
and keeps its output and skill progress under the run's original hash. Current-version skill levels
therefore never inherit archived XP. Jobs produce only stackable `authored_workpiece` items, and the
adapter grants no cash, crates, ammo, $OMR, transaction-ledger entry, trade authority, gameplay power,
or rare-item export authority.

Rank and Path entry gates are derived from the server-owned street and rechecked before creation and
start. Choice-option skill, mastery, regimen, honor, Underworld-standing, and Crew gates are derived
from the current locked character snapshot, projected as `available` plus safe `blockedBy` details,
and rechecked during the choice mutation. Underworld checks consume the same effective standing used
by the rest of the game after lazy decay. A locked option therefore cannot be selected by crafting a
request, and every consequential choice retains an ungated fallback.

Forming lobbies carry a finite server-issued expiry. An expired lobby is lazily abandoned on the
next content read or creation attempt, and the same organization may form a fresh lobby without
erasing the abandoned audit row. Active stories do not expire. Runtime manifests may also declare
`runPolicy: "once_per_season"`; the server derives a `season:<index>` run key from the canonical
28-day clock. A root-only `season_phase_is` gate controls discovery, creation, and start while an
already-started instance remains finishable after the phase changes. The board publishes the current
and required phase plus the days until the next phase. Seasonal collectible entitlements are scoped
by namespace plus that server-derived season run key: the same logical inert memento may be
self-claimed once each season, but additional scopes or content versions cannot mint it again during
that season. These clock adapters grant no reward authority.

## Pack contract

Every pack declares:

- `schemaVersion`, stable `namespace`, and monotonic `version`;
- one `growth.role`, or `internal_only` with an explicit `exemptReason`;
- allowlisted typed `nodes` with server-owned declarative gates/effects;
- allowlisted typed `edges` whose endpoints exist;
- no duplicate node IDs or accidental dependency cycles.

The compiler in `src/content/compiler.js` canonicalizes object keys, nodes, and edges before hashing.
Agent/filesystem traversal order therefore cannot change a bundle identity.

## Authoring-agent workflow

Give each authoring agent a bounded namespace, version, allowed node/edge catalogs, economy budget,
difficulty rubric, growth role, and explicit output path. Agents should return source subgraphs plus a
canonical solution/rationale; they do not edit runtime code or activate content.

Promotion should use separate roles:

1. author creates a bounded subgraph;
2. solver checks that the mystery is solvable without the canonical solution;
3. economy reviewer checks sources, recipes, sinks, durability, and liabilities;
4. social reviewer checks roles, distinct participants, consent, and organization scope;
5. growth reviewer checks public hook, attribution, human agency, safety, and retention;
6. compiler performs deterministic structural/policy validation;
7. operator signs off and activates the exact compiled bundle and pinned hash.

## Enforced economic boundaries

- Recipe inputs require a world source, producing recipe, or producing work order; outputs require a
  use or sink.
- Raw-material sources require finite day/week/season budgets.
- Work orders consume fixed inputs at start, use bounded server-owned clocks, produce only inert
  stackable workpieces, and train one exact-hash skill track through compiled thresholds.
- Authored durable tools are non-tradeable, exact-hash, facility-bound, material-repaired, and usable
  only by declared authored recipes or work orders; every wear and repair is append-only audited.
- Authored barter admits only compiler-allowlisted, stackable, gameplay-inert raw materials or
  workpieces; offers are exact-hash, whole-lot, TTL/cap bounded, conservation-checked, and cashless.
- Exportable items are owner-initiated, hash-pinned, single-identity, and gameplay-inert.
- Seasonal OMR nodes are precommitted finite allocations triggered by achievement, never elapsed time.
- Agent recruitment cash admits agent recruiters explicitly, but only for direct, qualified human-
  eligible non-agent recruits and only within a reserved liability/max-claim budget.
- Clicks, impressions, posts, raw signup, wallet linking, elapsed time, agent recruits, and downline
  generations cannot qualify for agent recruitment cash.
- External campaign nodes can prepare approved assets; they cannot publish or contact people.

The first live transaction adapter for the qualified-agent milestone is in `src/agentreferrals.js`.
The generic social mystery runtime, operator activation registry, and the exact-hash authored
inventory/source/recipe/work-order/skill/tool/facility/exchange adapter is live under a strict capability manifest.
Power outside authored crafting, drug supply, rare-item export,
retention/referral adapters, and
bounded OMR reward settlement remain separate later stages; broad compiler graphs still document
those systems without granting runtime authority.
