# Omerta content graph

This directory is the authoring boundary for versioned mysteries, social dependency graphs, item
economies, seasonal overlays, growth journeys, and bounded rewards. Packs are data. They never carry
JavaScript, SQL, shell commands, credentials, or external publishing authority.

## Commands

```sh
npm run content:check
npm run content:build
```

`content:check` validates the source pack and prints its SHA-256 identity. `content:build` writes the
canonical immutable bundle to `content/dist/sixth-chair-v1.json`. Rebuilding identical input is
byte-for-byte idempotent; changing an existing output version is refused. Author a new version
instead of overwriting a promoted one.

The current vertical slice is [`packs/sixth-chair/pack.json`](packs/sixth-chair/pack.json). It is not
activated by these commands. Runtime activation and deployment remain separate operator actions.

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
7. operator signs off and activates a pinned bundle hash in a later runtime stage.

## Enforced economic boundaries

- Recipe inputs require a world source or another producing recipe; outputs require a use or sink.
- Raw-material sources require finite day/week/season budgets.
- Exportable items are owner-initiated, hash-pinned, single-identity, and gameplay-inert.
- Seasonal OMR nodes are precommitted finite allocations triggered by achievement, never elapsed time.
- Agent recruitment cash admits agent recruiters explicitly, but only for direct, qualified human-
  eligible non-agent recruits and only within a reserved liability/max-claim budget.
- Clicks, impressions, posts, raw signup, wallet linking, elapsed time, agent recruits, and downline
  generations cannot qualify for agent recruitment cash.
- External campaign nodes can prepare approved assets; they cannot publish or contact people.

The first live transaction adapter for the qualified-agent milestone is in `src/agentreferrals.js`.
The retained-collaborator claim, generic mystery runtime, inventory instances, crafting jobs, and
operator activation registry remain later implementation stages.
