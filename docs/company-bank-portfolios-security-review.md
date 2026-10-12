# Company game-cash portfolio core review — 2026-10-12

Reviewed implementation: `7b30b2acd53f51ed94ae9a25de9d75a5d377956d`.
Base: `2ba42a8282cefd3e0f6357b7ad334946ec983b30`.
Phase: isolated core before coordinator wiring/release. Financial activation remains OFF.

Scope: `src/companybankportfolios.js`, `src/companybankportfolioinvariants.js`,
`src/routes/companybankportfolios.js`, `test/companybankportfolios.js`, and appended
`company_bank_portfolio*` DDL. Followed actual `Loans.offerLoan`, `takeLoan`, `cancelLoan`,
`repayLoan`, `collectLoan`, `voidLoansAtDeath`, the loan constants and owed arithmetic,
finance-request loan references, canonical character/account transaction wrappers,
and existing owner-only operator enrollment routes.

## Authority and accounting model

This is a branded portfolio of **existing game-cash loan escrow and debt**, with a
bounded operator grant. It has no monetary balance, customer deposits, fractional
reserve, token minting, new collateral rail, USDC/RWA provider, or external financial
transaction. Canonical `loans` and `transactions` retain all monetary authority.

An owner session alone can grant or disable policy. The domain function additionally
requires a trusted `{ ownerSession: true }` argument; request JSON cannot supply it.
Policy has a closed schema: explicit consent, one to three independent living borrower
IDs, fixed principal/rate/term, cash reserve, maximum outstanding principal exposure,
lifetime new-funding budget, expiry and revision. Runs are available to normal human
and agent sessions with the same game authority. Each run calls the existing
`Loans.offerLoan` once, creating one directed unsecured game-cash offer. Borrower
acceptance, repayment, cancellation, default collection, offer expiry, paper transfer,
and estate handling remain the existing canonical APIs.

Before funding, the original-account portfolio locks all current related canonical
loan contexts (bounded at 64), then its policy row. Original actor and account locks
are held by the caller. Source status/ownership is reclassified after locks. Every
original-account lender-owned open escrow and active principal counts toward exposure,
including loans created outside this automation. Active debt owed by the original
account additionally increases the required pocket-cash reserve. After funding:

```
cash >= consented reserve + existing own borrowing repayment debt
owned open escrow + active principal <= consented maximum exposure
portfolio-issued lifetime principal <= consented lifetime budget
```

The lifetime counter is an authorization metric, not money or a second claim. It
does not replenish on cancellation, repayment, defaults, policy revision, disable,
or an heir's new consent. Imported preexisting loans count in current exposure;
their historic origination is not falsely counted as a new portfolio-funded run.
Borrower eligibility checks actual alive/NPC/account/default/jail/active-debt state
and avoids an existing same-account offer/debt to that borrower. These are descriptive
bounds and game eligibility, not creditworthiness, recovery, or profit guarantees.

Receipt replay is original-account/key/action/exact closed terms. Stable serialization
handles PostgreSQL JSONB key ordering. A successful run is bound to its actual newly
created canonical loan ID. Old-generation grants cannot run from an heir; the estate
helper only disables metadata. Tests invoke actual `voidLoansAtDeath`, which passes an
active receivable to the heir with the **same canonical loan ID**. The portfolio does
not reassign it. Historical bindings can show missing or transferred canonical rows;
neither creates current ownership or exposure. An heir may read/replay history and
explicitly obtain a new owner grant while preserving lifetime spend.

Lock order: canonical actor/account → sorted canonical loan contexts → portfolio;
subsequent binding/receipt rows are owned metadata. Expiry/cadence use a fresh
`clock_timestamp()` after these locks. Existing game character wrappers own current
in-memory cash, including unpersisted canonical accrual; it is not overwritten with
a stale database snapshot. Canonical offering itself retains jail/safehouse, price,
term, living directed recipient and available-cash gates.

## Methods actually applied

Pinned methods reused from the verified local policy repositories:

* pashov/skills `c577eb7799c349de0acb187ba00ca98e14e436fd`: direct
  trust-gap/shared-rule reference passes across owner/agent authority, escrow economics,
  original-owner/heir asymmetry, and canonical entry-point execution traces.
* PlamenTSV/plamen `795962b96e254f2e423a2635fe7f8cb8ea1e6d69`: direct
  security-analyzer/verifier hypothesis separation and executed standard, boundary and
  temporal proofs for budget contention, rollback, default and inheritance.
* trailofbits/skills `d3323cefbcf645678b8dc481de204b02ad3d02dc`: direct
  audit-context-building trust mapping and property-based-testing invariant guidance.

Adaptation: one agent, JavaScript/game SQL, direct `rg`/source navigation, native Node
syntax checks, and memory/native PostgreSQL proofs. No upstream orchestration, historical
finding service, Solidity toolchain, blanket audit, or activation clearance is claimed.
EVM callbacks, ERC transfers, on-chain reentrancy and external-provider behavior are
inapplicable to these transaction-local game functions.

Separate passes covered closed inputs and original-account ownership; owner grant versus
agent execution; monetary source and reserve/exposure provenance; exact replay and lifetime
budget persistence; source-lock ordering and fresh expiry; rollback; default/writeoff;
actual canonical inheritance and historical foreign-source exclusion. DTO/request bodies
and route wrappers were cross-checked against the actual canonical function signatures.

## Findings, static triage and evidence

| ID | Disposition | Concrete trace / retest |
| --- | --- | --- |
| BANK-001 | Resolved implementation issue | Whole-integer cash admission would reject legitimate fractional accrued game cash. Admission now checks finite bounded current cash; principal/budget arithmetic remains bounded integers. |
| BANK-002 | Invalidated exposure-omission hypothesis | Existing direct loans are included regardless of portfolio binding. Tests import a manual escrow, block excess exposure, and exclude a foreign creditor's loan from lender bindings while reserving its owed debt. |
| BANK-003 | Invalidated budget-reset hypothesis | Cancel, repay, default, new policy and new-generation owner consent cannot decrement lifetime spend. Executed tests keep funded spend unchanged and reject reducing the budget below it. |
| BANK-004 | Invalidated inherited-authority hypothesis | Actual canonical estate transfer preserves loan ID, old policy disables, heir can replay its receipt but cannot issue a new offer until explicit owner consent. |

Static triage found parameterized fixed SQL only, no caller URLs/code/DSL, no dynamic
SQL construction in domain/routes, no direct loan ownership reassignment, and one canonical
offer funding call. Bound table iteration and selector limits are explicit. No in-scope
critical/high finding remains confirmed. Database administrator tampering and shared
integration changes are outside this core conclusion.

Executed on Node `v24.19.0`, native Windows PostgreSQL `18.4`, role `pilot_runner`.
The known local cluster identity was read-only verified first. The native runner requires
a fresh owned empty database, validates endpoint/role/version under `BEGIN READ ONLY`,
and accepts only `COMPANY_BANK_PORTFOLIO_TEST_DATABASE_URL`. Ambient `DATABASE_URL`
is refused. Source-pinned final native database: `company_bank_portfolio_7b30b2ac`.

Passing commands, exit 0:

```
node test/companybankportfolios.js
COMPANY_BANK_PORTFOLIO_TEST_DATABASE_URL=postgresql://pilot_runner@127.0.0.1:35439/company_bank_portfolio_7b30b2ac node test/companybankportfolios.js --postgres
node --check src/companybankportfolios.js
node --check src/companybankportfolioinvariants.js
node --check src/routes/companybankportfolios.js
node --check test/companybankportfolios.js
git diff --check
```

Proofs execute actual canonical offering, take, repay, cancel, zero-recovery default
collection, and estate inheritance. Native checks additionally exercise same-key replay,
distinct-key contention for the final funding allowance, exhausted concurrent budgets,
rollback of loan/cash/ledger/binding/receipt, and consent expiry while waiting for an
existing source-loan lock. Source tests verify reserve floors, borrowed-funds debt reserve,
preexisting exposure, foreign-source exclusion, exact-body conflict, cadence, inherited
ownership, owner-only grant and human/agent execution. The real Fastify routes and
`G.withCharacter` wrappers run under a bounded test-auth adapter; shared JWT wiring remains
coordinator scope. Seed 1947 covers 300 rate-bound cases, plus closed-schema rejection;
this is bounded input testing, not exhaustive stateful fuzz coverage.

Raw logs, source hashes, static/adversarial notes and retest metadata are retained under
ignored `output/company-bank-portfolio-review/`. Ready for coordinator integration and
its affected checks. Shared server, worker/operator authority, gateway, estate wiring,
release-wide checks, deployment and financial activation are separate operations.
