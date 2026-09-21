# RC1-04 scoped role, visibility and replay regression

Owner: **Codex/source_repairs**. Phase: local prerelease regression engineering.
Runtime source: `6a2af13cfdfd940de236e785e295dcee390218f5`. No runtime,
dependency, or configuration-source changes were made. The test and helper were
dirty development changes during this run; exact file hashes and the native
PostgreSQL result are retained in [the run record](authority-role-regressions.json).
This is targeted evidence, not final source qualification or completion of the
[authority review queue](authority-inventory.md).

Run `node test/rc1-command-redteam.js` with
`RC1_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:55441/postgres` against an
isolated local PostgreSQL instance. The harness creates a random database and
drops it in `finally`. It passed on Node 24.19.0 and PostgreSQL 18.4. Syntax checks
for both changed JavaScript files and `git diff --check` also passed.

The retained run exercises 71 denials: 42 existing malformed/forged/client
authority probes and 29 added valid-shaped role or visibility probes. The
existing probes compare authority before and after the batch; each added denial
compares all 30 listed authority tables immediately before and after its request.
Those tables include characters, social membership, operation capital and events,
item state and guards, world state/events, discovery instances/events/receipts,
Knowledge ACLs/grants/archives/links and transactions. Projection issuance,
passive telemetry and the HTTP idempotency cache are deliberately outside this
game-authority comparison. No concurrent gameplay runs during the comparisons.

| Boundary | Executed assertion |
| --- | --- |
| Family leadership | Ordinary member cannot create, assign, cancel or approve leadership work. |
| Operation participation | Same-Family nonparticipant cannot commit/contribute; a participant cannot fund another role or execute as organizer. |
| Hidden operation IDs | Outsider known and nonexistent IDs return identical detail 404 and selected-board 409 responses; ordinary board omits the hidden ID. |
| Issued command identity | Nonparticipant cannot execute the organizer's issued commitment identity. |
| Capital and replay | Canonical contribution deducts 100 cash and escrows 100 exactly once; retry and reconstructed-server retry preserve all compared state; cancellation refunds once and the old contribution retry cannot restore capital. Family operation invariants pass. |
| Private discovery | Foreign actor cannot read the instance or execute a currently valid owner action; the owner then successfully executes that same action. |
| Knowledge ownership/ACL | Recipient lacks owner ACL/grant projection and cannot reshare; stale ACL revision is denied. Hidden/missing claim and instance responses match. |
| Revocation | Recipient loses claim/list/archive/link visibility; previously issued direct discovery action and Player Command fail; new archive/link writes fail without changing authority. |
| Historical HTTP receipts | After server reconstruction, old share/revoke/archive/link requests replay without regranting or mutating authority. Recipient receipt bodies contain no revoked claim ID, and current visibility remains denied. |

The original eight concurrent mystery requests still produce exactly one fresh
execution and one mystery instance; its reconstructed-server retry also passes.
The new cases reconstruct the complete server twice more against the same native
database. Operation Player Command replay follows the server's command replay
path. Knowledge historical request replay can use the persistent HTTP receipt
cache; this run does not force cache expiry or isolate coordination receipt
fallback. An owner's historic share receipt is not a current authorization view.

Six new actors start with fixture cash 100,000 and respect 10,000; the reader is
at docks, the others at foundry. Boss, participant and nonparticipant have initial
Family/crew memberships inserted directly. All measured operation, discovery,
share, revoke, archive and link mutations then use canonical HTTP routes. This
does not prove natural social entry, low-resource accessibility or cohort play.

The trust-boundary pass followed `src/routes/family-operations.js` into operation
membership/officer/seat checks and capital transitions in
`src/coordination/operations.js`; `src/routes/coordination.js` into account-bound
commands in `src/coordination/runtime.js` and visibility/ACL/reference handling
in `src/coordination/knowledge.js`; and `src/routes/commands.js`,
`src/player-commands.js` and the idempotency hooks in `src/server.js` for issued
identity and replay behavior. Native assertions cover the reachable hypotheses;
no standalone static analyzer, stateful fuzz campaign or Solidity suite was run
for this JavaScript-only test extension. Contract callbacks, token accounting,
signers and deployment are outside scope.

Per the security review policy, the adapted methods used were Pashov
`access-control-agent.md` at `c577eb7799c349de0acb187ba00ca98e14e436fd`,
Plamen outcome determinism at `795962b96e254f2e423a2635fe7f8cb8ea1e6d69`, and
Trail of Bits audit context building at
`d3323cefbcf645678b8dc481de204b02ad3d02dc`. These guided direct source/caller,
authorization, state-transition and replay checks, not a claim that whole
upstream audit orchestrations ran.

No runtime defect was confirmed. `RC1-04-PROBE-01` records the first harness's
incorrect expectation that an outsider selected-operation projection would
return 200. Source behavior returns generic 409. The corrected test requires
known-hidden/missing-ID response equality and passes; no implementation change
was needed.

Still open: complete 529-route/24-command review, all operation terminal branches,
all Knowledge propagation policies, concurrent revoke/use schedules, membership
churn, HTTP cache expiry, production configuration, and natural player setup.
The broad inventory retains **MISSING REVIEW**. No full security or release
clearance follows from these targeted passes.
