# RC1-04 command authority review and native regressions

Owner: Codex/source_repairs. Phase: RC1 readiness engineering. Reviewed and
executed source: `b6bc56e58d19605106cfc8d14934ba741a4cee6c`, clean before and after
the seven runs below, on 2026-09-21. This is **partial review**, not full security
or release clearance. No runtime changes or confirmed runtime defect resulted.

[The matrix](authority-command-matrix.json) maps all 24 dispatched command types
to specific authority branches, executed assertions, test runs and remaining
coverage. It retains hashes of reviewed files, dependency lockfile, test sources,
logs, and the new denial snapshots. A source reference or a generic input check
does not prove every command branch or mounted route. The original 529-route
[census](authority-inventory.json) remains **MISSING REVIEW**. The runtime,
schema and dependency lockfile diff from that census source to this test source
is empty; this does not extend its anonymous probes into role coverage.

## Executed native evidence

All seven commands exited zero on native PostgreSQL 18.4 / Node 24.19.0. Each
used a private schema or disposable database under the explicit loopback endpoint
`postgres://postgres@127.0.0.1:55441/rc1_golden_browser_0359`. Existing test setup
and fault injection remain declared fixtures; these runs do not prove natural
player provisioning or production configuration.

| Command after `node` | Observed scope |
| --- | --- |
| `test/rc1-command-family-postgres.js` | 22 denial requests, eight exact replay comparisons including complete server reconstruction, 41 authority tables unchanged for every denial; world and operation invariants pass. |
| `test/rc1-command-redteam.js` | 78 denial requests: 42 envelope/input cases and 36 role/Knowledge cases; eight concurrent requests produce exactly one fresh mystery execution; persisted replay/restart and capital conservation pass. |
| `test/coordination-knowledge-postgres.js` | Existing native read/revoke and Crew/Family kick/read cases in both lock orders, pending revoke versus progression, receipt privacy and death/heir authority pass. |
| `test/family-operations.js --postgres` | Existing roles/readiness, withdrawal/rejoin, cancellation/refund, expiry, deterministic failure, concurrent execution, restart and after-write rollback pass. |
| `test/player-commands.js --postgres` | 17 existing groups pass, including current-character replacement, expiration, malformed identity, postcommit projection failure, independent-process replay and repeated schema application. |
| `test/director-security.js --postgres` | Existing audience/Knowledge/membership, disabled/shadow/cohort, expiry, duplicate worker, definition tampering and native fact/event race checks pass. |
| `test/furnace-ledger.js --postgres` | Both authored branches pass: hidden recipe/clue, independent evidence, sharing/revocation, irreversible choice, collective outcome and replay/restart. |

The two HTTP suites exercised 100 denial requests, including 29 additions in
this change. This is a request count, not a count of independently audited
vulnerability classes. Native Knowledge concurrency coverage is reused and
explicitly mapped; it is neither new nor absent from the repository.

The new full-server family harness requires `COORDINATION_TEST_DATABASE_URL` and
accepts `RC1_COMMAND_FAMILY_OUTPUT` for a new evidence directory. It records
method, route, expected/actual status, actual response and before/after state
hashes. All 44 raw before/after snapshots and `results.json` are retained under
`output/rc1-command-family-frozen-1/`, with hashes in the matrix. Its run lasted
from `04:32:58.102Z` to `04:33:16.577Z`; this is functional test timing, not a
performance claim. Logs for all seven runs are under
`output/source-reconciliation/*-frozen-1.log` at the paths recorded in the matrix.

## Added checks and reviewed boundaries

Seven operation route denials close specific gaps in the prior HTTP probes:
ordinary-member draft publication, occupied-seat join, officer assignment of a
known outsider, nonparticipant leave, premature expiry, and two attempts to
withdraw another role's capital. Each compares the existing 30-table authority
snapshot immediately before and after the request.

The new family harness checks stolen issued identities and authoritative
parameter substitution for salvage, crafting, world execution and situations.
It also checks confirmation and changed location, direct recipe cost/output
injection, a known foreign item, competing stale world revision, collective-action
bypass, and real Crew/Family departures after command issuance. Positive native
HTTP actions establish real receipts before exact and reconstructed-server
retries. The comparison adds cars, recipe usage, mystery node/choice state and
Director tables to the original authority set, preserving SQL numeric text.
Projection issuance, passive telemetry, HTTP receipt cache and sequences are
outside these comparisons. No concurrent worker or gameplay runs during a
before/after comparison.

The matrix records the common command envelope separately: only `executionId`
and boolean `confirmed` are accepted; the key must match the issued identity;
the stored board binds account and current character; new work checks current
state and expiry before dispatch. Domain functions still own cost, prerequisites,
participation, targets, effects and rewards. Historical receipts are not a current
visibility or authorization projection. The individual command rows identify
where direct domain tests, full HTTP tests and source review differ.

## Findings, methods and remaining scope

Three development failures remain retained as invalidated harness expectations:
`RC1-04-HARNESS-02` caught an import selecting memory mode before native setup;
the private-schema assertion stopped the run before measured HTTP probes.
`RC1-04-HARNESS-03` expected the dock's idle state to be hidden, but authored
content explicitly makes it public. The final probe checks public idle and then
known/missing 404 equivalence for private shortage after a real world transition.
`RC1-04-HARNESS-04` expected an internal 403 for a collective-only world action;
the public boundary deliberately returns generic 404 first. Corrected expectations
pass without changing the runtime. Their original failed reports remain in the
matrix; the final run was not relabeled from one of those attempts.

The adapted policy methods are Pashov access-control review at
`c577eb7799c349de0acb187ba00ca98e14e436fd`, Plamen outcome determinism at
`795962b96e254f2e423a2635fe7f8cb8ea1e6d69`, and Trail of Bits audit context building
at `d3323cefbcf645678b8dc481de204b02ad3d02dc`. We followed callers into concrete
authority branches, compared expected state transitions, tested reachable attack
hypotheses, and retained invalidated expectations. This does not claim a whole
upstream audit orchestration or standalone static analyzer ran. Contract compiler,
chain, signer and Solidity callback checks are outside these JavaScript changes.

Every command row remains partial. Open work includes all mounted route/role
combinations; all authored definitions and scarcity branches; dedicated choice
confirmation and nonowner Knowledge-revoke HTTP probes; positive assignment and
every stale assigned-character/cohort combination; every operation recovery
schedule; HTTP cache expiry fallback; production configuration and broader
fuzz/static-analysis campaigns. The matrix states per-command gaps rather than
equating shared request validation or a source reference with complete coverage.
