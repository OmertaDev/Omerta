# OMERTÀ engineering graph

The repository has two complementary navigation tools. `tools/graph.js` traces economy levers, ledger reasons, invariant checks, tests, and named implementation patterns. `tools/knowledge.js` inventories the wider source tree, imports, routes, schema, contracts, documentation, and Git lineage.

Neither graph grants gameplay authority. Runtime world and coordination graphs have separate definitions, transaction boundaries, and validation gates.

## Current sources

`CLAUDE.md` contains **49 lines** of contributor guidance. Current system behavior belongs in `SPEC.md`, the player guides, implementation, and tests. Superseded designs and the discarded prototype do not belong in the current working tree.

The repository retains **96 audit reports** as point-in-time evidence. `docs/AUDITS.md` indexes their dates and subjects. A historical finding does not establish a current defect or current clearance. Consult the relevant revision, fix, and retest evidence.

Balance and decision records remain in `BALANCE.md` and `SIGN-OFF.md`. `test/levers.js` pins **727 signed levers**; a historical prose row does not override an implemented value or a later signed decision.

## Commands

```sh
node tools/graph.js build
node tools/graph.js check
node tools/graph.js query pattern buyout
node tools/graph.js query open-findings
npm run knowledge
npm run knowledge:check
```

`test/graph.js` verifies the graph's extraction, queries, and invariants. `tools/knowledge-test.js` checks the broader knowledge model and its generated artifacts. See [knowledge maintenance](knowledge/maintenance.md) for regeneration and recorded-revision behavior.

## Evidence model

| Relationship | Meaning |
| --- | --- |
| `DEFINES` | A source defines a named rule, reason, or check |
| `READS` | A source mentions a rule identifier; this is a structural lead |
| `PINS` | A test pins a rule value |
| `EMITS` | A source records a ledger reason |
| `RECONCILES` | An invariant names the value or custody it checks |
| `COVERS` | A test or harness references a surface; this does not imply complete coverage |
| `CITES` | A source comment names a shared implementation pattern |
| `MENTIONS` | A document mentions an entity; this is not proof of runtime behavior |

Every node needs provenance and every edge must resolve. Report extraction limitations explicitly. Preserve the distinction between an exact source reference, inferred association, behavior test, and release approval.

## Working practice

Inspect known files directly. Use graph queries when a question crosses modules or requires tracing a rule to its tests and ledger effects. Check callers before changing shared symbols, then run the relevant native checks.

Generated files under `knowledge/generated/` are owned by the generator. Regenerate after changes, inspect unexpected inventory shifts, and run `npm run knowledge:check`. Retained Git lineage explains removed artifacts without presenting them as current designs.

The knowledge plane is implemented in `tools/knowledge.js`, with its checked output in `knowledge/generated/graph.json`. Current instructions remain concise; historical implementation narratives can be retrieved from Git when a specific investigation requires them.
