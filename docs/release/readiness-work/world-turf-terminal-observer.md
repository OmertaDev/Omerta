# Scoped shared turf-terminal observer

This diagnostic increment classifies one completed contest among live, unchartered
Families, with a live incumbent and no overlapping cash action. It does not change
gameplay or qualify C02-FAMILY-TREASURY as complete.

`src/social/gangs.js:stakeClaim` moves treasury to `district_bids`, retaining a
`turf:claim` receipt. Original `settleContest` consumes that escrow: the winner
burns its stake; each loser receives the authored floored refund and burns the
remainder. The classifier assigns every fresh refund/burn receipt exactly once to
its original Family counterparty, requires null personal owners, and checks each
Family's treasury. Garrison is nonmonetary standing, not a second cash balance.
Winner, holder, garrison and deadline are exact; changed-holder NPC/watch fields
and seizure time are also exact. Every other changed district field remains
unsupported. Full district rows are now observed and retained in restricted row
diagnostics even outside this branch.

Receipts do not contain a district ID. The classifier therefore supports only one
isolated disappearing bid set and does not invent a receipt foreign key. Multiple
or reopened contests, charter modifiers, dissolved bidders/incumbents, setup,
staking, territory effects, war spoils and other Family changes remain unknown.
The independent native verifier binds settlement to the original successful
`turf contest sweep` callback and its logical time. It does not claim that receipt
parity by itself establishes HTTP authorization or worker origin.

The focused native runner uses four ordinary entrants and three declared
prebaseline level-400 respect fixtures. Cash comes from canonical check-in;
formation, tribute and initial seizure are canonical. No balance, escrow,
deadline, district or membership row is rewritten. Three concurrent authorized
claims retain request/response completion order and durable account/key/body
bindings; a total PostgreSQL commit order is not inferred. Bounded concurrent
batch snapshots and original callback snapshots are retained, not mislabeled as
individual commit observations.

The original season-adjusted contest window elapses, followed by three original
hourly sweeps. A declared DELETE trigger verifies five refund/burn receipts,
escrow conservation and the closed district latch before aborting the first
settlement. The separate original boot sweep is retained as an empty result;
only post-epoch hourly callbacks count toward the three-hour sequence. TOOL44
preserves the first native failure, which completed the lifecycle but counted the
boot sweep as an extra hourly zero result. No runtime or classifier was changed
to correct that test oracle.
Escrow, Family treasury, district status and terminal receipts must
remain exactly unchanged; unrelated original callbacks retain separate evidence.
The next original sweep retries after trigger removal. The third returns zero.
Odd-unit loser rounding, winner burn, exact request replay, unauthorized outsider
refusal, and source immutability are required. Native negative projections cover
missing/stale/duplicate receipts, wrong owners, balanced wrong-Family custody,
incorrect refund rounding, missing transfer, retained escrow/deadline, wrong
winner/garrison, early settlement, and missing/wrong original-worker authority.

Run in a clean committed isolated checkout with local native PostgreSQL:

```powershell
$env:COORDINATION_TEST_DATABASE_URL = 'postgres://postgres@127.0.0.1:55438/postgres'
$env:RC1_TURF_TERMINAL_OUTPUT = 'C:/private/fresh-turf-terminal'
node test/rc1-native-turf-terminal.js --postgres
node test/rc1-world-turf-terminal.js --evidence=C:/private/fresh-turf-terminal
node test/rc1-world-resource-observer.js
```

Run the shared observer's separate `--postgres` regression with
`RC1_RESOURCE_DATABASE_URL` and a fresh private `RC1_RESOURCE_OUTPUT`. Retain raw
failures and full artifact/source hashes. The turf runner creates and verifies
cleanup of its unique database; the generic observer's deliberate corruption
database is retained by that existing test. Outputs contain private actors and
must not be published. Public summaries contain only source/artifact hashes,
aggregate counts and exclusions.

Security review phase: isolated pre-release accounting-diagnostic review under
`omerta-contracts/SECURITY-REVIEW-POLICY.md`. Applied the pinned Pashov authority,
rounding and adversarial-trace passes; Plamen transition/callback/accounting
analysis; Trail of Bits caller/context/specification and negative-property
checks. Native transaction behavior and retained replay controls support only
this branch. No upstream full orchestration, Solidity, deployment, external
backing, full-world seed replay or matrix coverage is asserted.
