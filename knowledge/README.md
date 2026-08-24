# OMERTÀ knowledge base

This is the front door to the project’s durable knowledge. It combines a curated explanation of the
system with a generated, provenance-backed inventory of the repository and GitHub history.

The snapshot describes the current checkout, including uncommitted work, at the revision recorded in
[the generated inventory](generated/inventory.md). GitHub state is captured separately in
[github-snapshot.json](github-snapshot.json), because the local tree and the remote collaboration
surface can move independently.

## Start here

| Question | Best entry point |
|---|---|
| What is this system and how does it fit together? | [Architecture](architecture.md) |
| Where does a product capability live? | [Domain map](domains.md), then the [generated module map](generated/modules.md) |
| What are the money, state and consistency rules? | [Data and economy](data-economy.md) |
| What routes, tables or contracts exist? | [Routes](generated/routes.md), [schema](generated/schema.md), [contracts](generated/contracts.md) |
| How is it tested, deployed and operated? | [Operations and quality](operations-quality.md) |
| What is decided, gated or still risky? | [Decisions and risks](decisions-and-risks.md) |
| What happened on GitHub? | [GitHub guide](github.md) and [generated history](generated/github-history.md) |
| What does a project term mean? | [Glossary](glossary.md) |
| How is the graph modelled? | [Taxonomy](taxonomy.md) and [graph summary](generated/graph-summary.md) |
| How do we keep this current? | [Maintenance](maintenance.md) |
| What documents already exist? | [Generated document catalog](generated/documents.md) |

The complete machine-readable graph is [generated/graph.json](generated/graph.json). The compact
Mermaid topology is [generated/graph.mmd](generated/graph.mmd). The existing [GRAPH.md](../GRAPH.md)
and [tools/graph.js](../tools/graph.js) remain the specialized graph for balance levers, ledger
reasons, invariant checks and named engineering precedents.

## Source priority

OMERTÀ has a large documentary history. A statement’s authority depends on its source type:

1. **Runtime implementation and schema** — `src/`, `schema.sql`, `omerta-contracts/src/`, live
   environment and deployed contract configuration.
2. **Deterministic checks** — `test/`, `tools/`, Foundry tests and CI workflows. They prove only the
   property they actually assert.
3. **Current operational declarations** — `render.yaml`, `.github/workflows/`, `DEPLOY.md`,
   `CHAIN-DEPLOY.md` and the active environment.
4. **Current syntheses** — this knowledge base, `SPEC.md`, `README.md`, `BALANCE.md` and
   `SIGN-OFF.md`. Generated counts here outrank hand-maintained counts elsewhere.
5. **Design documents** — intended behavior and rationale. A design is not proof that the feature
   shipped unchanged.
6. **Audit reports and chronological logs** — point-in-time evidence. They are invaluable for
   precedent and failure history, but a finding may later be fixed, accepted or superseded.
7. **GitHub discussions and PR descriptions** — change rationale and review record, not runtime
   authority by themselves.

When two sources disagree, inspect the current implementation and its tests, then record the
disagreement rather than averaging the claims.

## What the generated plane covers

The generator refuses silent loss. Every current repository file becomes an `Artifact`, even when it
has no richer classification. It also extracts:

- JavaScript imports and external package dependencies;
- literal Fastify route registrations, access mode and resolved handler modules;
- PostgreSQL table declarations and source modules that name each table;
- Solidity contracts, interfaces, libraries and local inheritance;
- package commands, tests, workflows and documentation references;
- the complete local commit lineage and every file each commit changed;
- current and historical artifacts, so deleted paths remain addressable;
- GitHub pull requests and issues from the explicit connector snapshot;
- subsystem and product-domain membership plus aggregated domain dependencies.

The graph does not pretend that an exact-name reference is a runtime call, that a direct import is
complete behavioral coverage, or that a PR description proves its claims. Edge names are deliberately
narrow and their provenance points back to the evidence.

## Commands

```text
npm run knowledge                 rebuild generated artifacts
npm run knowledge:check           fail when generated artifacts drift
node tools/knowledge.js stats     print the graph census
node tools/knowledge.js query X   inspect matching nodes and their neighbors
npm run graph                     build the specialized economy/precedent graph
node tools/graph.js check         verify the specialized graph
```

See [maintenance.md](maintenance.md) for refreshing GitHub data and the repository ritual.
