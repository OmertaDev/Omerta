# Independent projection security review

Date: 2026-09-21. Phase: local pre-release integration verification. Base revision:
`e56cf576065c5f1bbb9bb55115f5961267f7d654`, with working-tree changes. The exact
reviewed context, growth and social-helper source hashes are retained in
[projection-run.txt](projection-run.txt). Later changes require retesting the
affected claims. This is a bounded independent pass, not a complete game audit
or production release approval.

## Scope and method

The review traced `src/gateway/context.js` through authoritative player,
inventory, mystery, world-graph, operation, coordination, crew, dynasty and
diplomacy readers, and inspected the extracted `missionReadiness` helper in
`src/growth.js`. The intended boundaries were current account ownership,
current group membership, discovered/role-visible game information, delegated
domain scopes, bounded responses and absence of durable mutations in reads.

The [repository policy](../../omerta-contracts/SECURITY-REVIEW-POLICY.md) was
applied using the pinned methods and JavaScript adaptations recorded in the
[PostgreSQL supplement](postgres.md): trust-boundary/callee tracing,
cross-function state transitions and executable false-positive checks. No
complete upstream orchestrator, Solidity scanner or fuzzer was run for this
JavaScript-only projection scope.

## Confirmed finding and retest

**GW-PROJ-001 — medium availability/bounds, resolved.** The original gateway
family projection called the unrestricted game `dynastyBoard`. An executed
fixture with 125 incoming marriage proposals returned all 125 proposals and
performed 265 queries for the projection, including two peer-name lookups per
relationship. The rows can accumulate from distinct senders without the
recipient accepting them. Similar unrestricted lists existed for crew invites,
crew requests, diplomacy relations and coalitions. A response slice after the
helper would not remove this database/query fan-out.

The gateway now calls the three existing helpers with `{ limit: 20 }`. The
optional mode validates an integer limit, fetches at most `limit + 1` list rows
to detect truncation, returns explicit `truncated` metadata and batches dynasty
counterpart names into two queries. Crew progress still reads the caller's own
contribution even when it is outside the returned contribution list. Bounded
diplomacy omits the unused global dominance ranking and labels that omission;
its default game mode still calculates the original ranking.

The independent regression seeds 125 rows in each relevant collection. Bounded
dynasty returns 20 proposals, 20 advising relationships and 20 offers in exactly
seven helper queries, with the selected peer's correct house/name. Crew and
diplomacy return 20 rows per tested collection with truncation flags. The same
fixtures verify that default helpers still return their complete 125-row lists
and do not acquire the optional metadata. Invalid limits are rejected. The
gateway family response also returns 20 proposals and the truncation flag.

This bounds emitted lists and JavaScript peer-query fan-out; it is not a claim
that database scans or every existing owned-inventory loader have constant cost.

## Privacy and read-only checks

No confirmed hidden-graph, puzzle-answer, peer-private-field, cross-account or
scope-aggregation disclosure was found in the inspected flows. Concrete traces
in `test/gateway-projection-security.js` establish:

- Player-only root context, brief, opportunities and actionable context omit
  seeded cash/OMR, wallet identifiers, peer inventory and unsupported private
  notification content; they do not populate unauthorized domain sections.
- Social/coordination path analysis omits inventory and crafting sections
  without their scopes. Candidate eligibility remains `unknown`; it does not
  infer another member's private resources.
- An investigator's assigned operation task is legitimately visible. Another
  role's private task is hidden. Assignment alone reveals no evidence; after
  completion, the caller's permitted evidence identifier may appear while the
  other role's evidence and the private answer text remain absent.
- Leaving the crew denies operation contribution access, including for its
  original opener. Current membership is checked before the operation board.
- All 52 parameterless READ/ANALYZE capabilities, plus targeted scope and role
  traces, execute behind a query guard rejecting durable mutation statements
  on both the pool and acquired clients. The complete fixture run performed
  729 guarded queries with zero durable writes.

The assigned-task concern was therefore ruled out for the current Belladonna
graph: role assignment is existing game authority for task visibility, while
completed private evidence text is explicitly removed by the gateway. This
does not preapprove future graph content or changes to game visibility rules.
Graph/discovery, account isolation and mission readiness additionally retain
their focused cases in `test/gateway-context.js`; mission checks compare all
current missions across four states using the shared eligibility helper.

## Executed verification

| Command | Result |
| --- | --- |
| `node test/gateway-projection-security.js` | Exit 0; retained output and source hashes in [projection-run.txt](projection-run.txt) |
| `node test/gateway-context.js` | Exit 0; scope/privacy/readiness assertions |
| `node test/dynasty.js` | Exit 0; existing default behavior and ledger checks |
| `node test/crew.js` | Exit 0; existing gameplay checks |

The independent suite uses the real game readers with pg-mem. It does not
measure a production database's query planner or prove every possible graph,
scope combination or interleaving. Real PostgreSQL persistence/concurrency
verification is recorded separately in [postgres.md](postgres.md).
