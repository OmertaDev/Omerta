# Company workflow core review — 2026-10-12

Reviewed implementation commit: `31a0f6741f16f97ab17afeccaff259cff89e7f7d`.
Base: `727df2f02b2d0e5031b4c5a4516144de67aba0a8`.
Phase: isolated core implementation; shared server/worker/agent/estate wiring, deployment,
and activation are separate coordinator work. Financial activation remains OFF.

Scope: `src/companyworkflows.js`, `src/companyworkflowinvariants.js`,
`src/routes/companyworkflows.js`, `test/companyworkflows.js`, and the appended
`company_workflow*` schema. Followed canonical callees in `delivery.js`, `depot.js`,
`depotbook.js`, `warehouseleases.js`, `market.js`, `deliveryfinance.js`, `loans.js`,
and character transaction wrappers in `game.js`. Existing game/domain SQL sources
remain authoritative; arbitrary database administration is outside this boundary.

## Model and authority

An original account company can bind one owned depot to an already funded, active
finance-backed supplier commitment and an existing paid warehouse lease. Exactly three
dependent stages observe procurement, paid storage/retrieval, then full financed delivery.
No workflow function creates funding, charges fees, moves cash/cargo, or invokes providers.
`paid` is always zero. `proof.canonicalCash` identifies an already executed canonical
source amount: sale-journal revenue, warehouse-rent revenue, or the finance request's
linked settlement delivery credit. These amounts are not a second payment or accounting bucket.

The closed next-action DTO names a fixed existing API and exact bounded body. It is a
suggestion for the existing authorized operator; it does not grant spending permission.
When proof already exists it suggests metadata advancement, avoiding another purchase.
Original-account heirs can read and replay immutable receipts or cancel metadata; they
cannot advance the predecessor's live workflow or replay its funding. Estate integration
can mark active workflows failed after existing source locks. Cancellation leaves original
escrow, warehouse retrieval, and debt recovery with their canonical APIs.

Source proofs are canonical owned quantity events. They do **not** establish identity
of fungible gin units across a shared trunk, or attest which particular purchased units
were later stored/delivered. Ordinary unfinanced delivery's unlinked `market:fill` ledger
cannot attribute a payment to a commitment, so this core deliberately admits only the
existing linked finance settlement for terminal payment evidence.

Lock order: canonical caller character/account locks → sorted involved depots → canonical
loan → market order → warehouse lease → delivery commitment → finance request → workflow.
This preserves the finance subsystem's loan/order/commitment/request relative order.
Sources are reread after locking, deadlines use `clock_timestamp()`, and proof acceptance
and dependent-stage unlocking happen in the same caller transaction. A source ID can
be consumed only once globally, and a commitment/lease can bind only one workflow.
Receipt replay is account/key/action/workflow/exact closed terms, with stable serialization
for PostgreSQL JSONB key ordering. Pending observations replay as observations; automatic
advancement does not persist a permanent pending receipt before evidence exists.

## Methods actually used

The policy's local method repositories were verified at their exact pinned revisions:

* pashov/skills `c577eb7799c349de0acb187ba00ca98e14e436fd`: direct
  `solidity-auditor/references/hacking-agents/trust-gap-agent.md` and shared-rule review,
  adapted to account authority × existing payments × original-owner/heir asymmetry.
* PlamenTSV/plamen `795962b96e254f2e423a2635fe7f8cb8ea1e6d69`: direct
  `agents/security-analyzer.md` and `agents/security-verifier.md` source-trace/hypothesis
  separation, with executable boundary and temporal proofs.
* trailofbits/skills `d3323cefbcf645678b8dc481de204b02ad3d02dc`: direct
  audit-context-building trust map and property-based-testing invariant guidance.

Single-agent JavaScript/PostgreSQL adaptation: no upstream orchestration, external
historical-finding services, Solidity compiler, or broad Solidity audit was run.
Source navigation/static triage used native `rg`, Node syntax checks, and direct SQL
inspection. Reentrancy, callbacks, ERC transfers, and EVM numeric behavior are not
applicable because these functions make only transaction-local database operations.

Separate passes covered actor/account/source ownership; stage and proof ordering;
canonical payment provenance and nonduplication; idempotency and heir asymmetry;
source-lock waiting, expiry, concurrency, rollback, failure and recovery. Cross-checking
compared DTO endpoint/body contracts with existing routes and actual domain calls.

## Findings and retests

| ID | Disposition | Evidence / remediation |
| --- | --- | --- |
| WF-001 | Resolved implementation finding | JSONB reorders identity keys. Stable recursive serialization replaced raw identity stringification; native exact create replay passes. |
| WF-002 | Resolved implementation finding | JavaScript Date loses native sub-millisecond ordering. Proof admission additionally compares journal and workflow times inside SQL; old proof is rejected in both database modes. |
| WF-003 | Resolved implementation finding | An action hint could suggest a new purchase after its proof already existed. Hints now select metadata advancement first; canonical procurement still enforces its budget/cargo boundary. |
| WF-004 | Invalidated payout-attribution hypothesis | Plain delivered commitment plus unlinked ledger cannot identify a payment. Terminal completion instead requires the canonical linked financed settlement, exact full quantity/gross/net and repaid loan. |

No in-scope unresolved critical/high finding was confirmed. The listed mitigations are
tested against this exact core revision; shared integration can introduce new boundaries
and requires its own retest rather than inheriting a blanket conclusion.

## Executed evidence and limits

Node `v24.19.0`; native database `PostgreSQL 18.4` on Windows, role `pilot_runner`.
An initial read-only probe failed `ECONNREFUSED` while the coordinator's known cluster
was stopped. A subsequent `BEGIN READ ONLY` version/identity probe succeeded; no new
cluster or ambient `DATABASE_URL` was used.

Passing commands, exit 0:

```
node test/companyworkflows.js
COMPANY_WORKFLOW_TEST_DATABASE_URL=postgresql://pilot_runner@127.0.0.1:35439/company_workflow_20261012_final node test/companyworkflows.js --postgres
node --check src/companyworkflows.js
node --check src/companyworkflowinvariants.js
node --check src/routes/companyworkflows.js
node --check test/companyworkflows.js
git diff --check
```

The native runner first requires its own empty database and validates endpoint/role/version
read-only, then loads the repository schema. Fixtures fund existing canonical contexts;
actual `buyCommittedFromDepot`, warehouse rent/deposit/withdraw, and
`deliverFinancedCommitment` produce the proofs. These are game-cash domain calls only.
Checks cover stage/proof ordering, old/foreign rejection, failure blocking, expiry,
original-account heir read/replay, no workflow cash/journal payment, five unique proof
sources, and read-only reconciliation. Native-only checks prove concurrent same-key
creation and stage advancement, forced rollback, and expiry after waiting for a source
depot lock. Seed 1947 exercises 300 closed-schema quantity bounds; it is bounded input
testing, not a claim of exhaustive stateful fuzz coverage.

Raw logs and source hashes are retained under ignored `output/company-workflow-review/`.
The isolated proof databases are retained for coordinator evidence. HTTP auth integration,
full release checks, shared operator authority, death wiring, and worker scheduling were
not executed by this core task. Ready for coordinator integration and its affected checks;
this report does not authorize production financial activation.
