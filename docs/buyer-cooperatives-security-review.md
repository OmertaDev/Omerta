# Buyer cooperative core review — 2026-10-12

Implementation: `14c8c548891059dd60bf14fb58162b5e904d4f84`.
Base: `22a2c9995939d9b7dd7b21be346ec56b393177d7`.
Phase: isolated core and pure custody hooks, **before shared integration**.
Financial activation remains OFF. This core is not a standalone release clearance.

Scope: `src/buyercooperatives.js`, `src/buyercooperativecustody.js`,
`src/buyercooperativeinvariants.js`, `src/routes/buyercooperatives.js`,
`test/buyercooperatives.js`, and appended `buyer_cooperative*` DDL.
Followed actual `Market.postOrder`, `fillOrder`, `claimOrder`, cancellation/sweep/estate
paths, the existing locked-treasury `Depot.restockDepot` adapter, `Delivery.acceptDelivery`,
`G.ledger`, cargo writes/caps, and character/account transaction authority.

## Fixed terms, authority and accounting

A cooperative contains at most three distinct original accounts and eight gin units.
Each account is pinned to its original living character. Closed terms fix member unit
shares, per-unit order price, total listing-fee cap, funding deadline, order term,
publication choice, proportional partial-fill policy, and cancellation consent. Each
member independently supplies exact signed terms hash and its capped funded amount
from its own pocket, preserving a $1,000 game-cash reserve. A character/account owns
its normal canonical transaction; no mutation requires a framework for three characters.

Cash funding creates an explicit joint custody bucket backed by its actual negative
character ledger row. Launch requires all original members funded/alive and a fresh
deadline after locks. The existing Depot adapter pattern passes a snapshot of the
**locked real joint balance** to actual `Market.postOrder`, routes its canonical
`market:list`/`market:order` ledger rows to NULL character and cooperative counterparty,
then records the actual joint debit and unique canonical order binding. Organizer
pocket cash is never credited or debited for another member's capital.

Canonical suppliers use ordinary `Market.fillOrder`. Settlement reads the actual
locked order's remaining cash quantity and paid warehouse `filled_qty`; request callers
cannot assert success, stock or payment. It atomically returns remaining `qty*price`
to joint custody, captures paid gin, clears source quantities/status, and allocates
rights. Cash refunds, including unused fee-cap surplus, are proportional to original
funded cash; gin allocation is proportional to consented unit shares. Largest integer
remainders use fixed canonical member rank. No lost rounding remainder, second funding,
second order, double claim, or organizer estate ownership is intended.

The actual listing fee remains consumed, following the existing market rule; unused
fee-cap surplus is refundable. Partial allocation can assign an indivisible unit to
one member while costs/refunds remain shared under the explicit proportional policy.
This is bounded shared purchase risk, not a promise of a fixed individual price per
actually received unit or fungible-unit provenance.

Members claim only their own original-character rights. Cash uses the existing pocket
ledger; gin uses the existing character-cargo write pattern and `G.trunkCap`, with a
GIN audit row and joint custody debit. Claims and exact receipts are transaction-local.
Heirs can read/replay original-account metadata and receipts, but cannot fund or claim
the predecessor's wealth. Public opt-in cooperative projection and private own-share
projection expose no other member account/character IDs. The canonical public market
order retains its normal public trading visibility.

Lock order: canonical actor/account → existing canonical order, when bound → cooperative
→ ranked share rows. Funding-to-order binding changes while awaiting metadata locks
produce `source_changed` and require whole-transaction retry; a new earlier order lock
is never acquired while holding a later cooperative lock. Funded unclaimed rights
and organizer live plans are each bounded at three, bounding affected death contexts
at six. Death obtains all known source orders before cooperative/member metadata.

Joint death recovery cancels/captures affected sources, then burns/loots **only** the
dead original member's unclaimed cash and burns that member's gin. Other live members
keep private refundable/claimable rights. Already claimed pocket/cargo belongs to the
ordinary personal estate, handled separately. This core never manually reassigns
other members' rights or group wealth to an heir or organizer.

Exported reconciliation verifies actual funding debit identities, canonical NULL
market fee/order debits, claim credits, original membership, unique source bindings,
all journal deltas, and these explicit equations:

```
funded cash = joint cash + live canonical market escrow + actual paid fee
            + actual purchased units * unit price + member cash claims + death cash out
captured gin = joint gin + member gin claims + dead-share gin burns
```

## Required coordinator integration — not yet wired

Pure `buyercooperativecustody.js` imports neither Market nor cooperative core, avoiding
a Market↔core cycle. Required shared calls:

* Personal `claimOrder`/`cancelListing`: after canonical order lock, use
  `buyerCooperativeOrderBinding(client, orderId)` and reject joint sources.
* Sweep: joint sources call
  `settleBuyerCooperativeOrder(client, orderId, ledger, { cancel: true })`, then
  continue before ordinary poster refund and source mutation.
* Estate: call
  `recoverBuyerCooperativesAtDeath(client, characterId, ledger, killerCh, lootRate)`
  before ordinary market estate handling. Exclude joint bindings from ordinary
  organizer refund/burn **and the final unconditional market row DELETE**.
  A non-organizer death concurrent with launch can return `source_changed`; retry the
  whole estate transaction, not a fragment after its canonical source locks.
* Include joint cash/gin buckets, reason classes, private routes and bounded due
  candidates in shared reconciliation/operator wiring. Depot procurement/refund
  checks must distinguish NULL-character cooperative counterparty rows from depots.

New reason classes: `buyer_cooperative:fund`/`:refund` for pocket↔joint cash;
`:claim` for gin; `:death_cash`/`:death_gin` for NULL-character burns;
`:loot_cash` for the escrow-side counterpart of canonical positive `whack:loot`.
Order posting/refund use existing NULL `market:list`, `market:order`, `market:refund`.

Current canonical `Delivery.acceptDelivery` rejects orders without `depot_id` before
creating any commitment. Cooperative order `depot_id` is NULL and reconciliation
requires that. Actual acceptance refusal is tested; no speculative future reservation
adapter was added. Settlement also rejects an accepted commitment as defense in depth.
N06 hubs are not imported or claimed; this implementation uses existing standing market
orders and their paid warehouse goods only.

## Methods, findings and limits

Direct pinned-method adaptations: pashov/skills
`c577eb7799c349de0acb187ba00ca98e14e436fd` trust-gap/access/economic/asymmetry
passes; PlamenTSV/plamen `795962b96e254f2e423a2635fe7f8cb8ea1e6d69`
source traces and executable standard/boundary/temporal hypotheses; trailofbits/skills
`d3323cefbcf645678b8dc481de204b02ad3d02dc` context mapping, property/invariant
guidance and false-positive separation. Adaptation: one agent, JavaScript/Git/SQL
inspection and memory/native proofs; no upstream orchestration or blanket Solidity audit.

Separate passes covered member/organizer authority and privacy; backed cash/stock;
fee/price/quantity/cargo caps; allocation remainders; replay/body identity; source-lock
ordering and rollback; original-account death/recovery; and standard-market escape
paths. Static triage found fixed parameterized SQL, closed enums/objects, no caller
URLs/code/DSL, external provider, financial activation, absent hub import, or manual
wealth inheritance.

| ID | Disposition | Evidence / retest |
| --- | --- | --- |
| BC-001 | Resolved persistence defect | A JavaScript ledger-ID array was treated as a PostgreSQL array rather than JSONB. Explicit JSON serialization fixes both database modes; fund/order/claim/death journals and ledger identity checks pass. |
| BC-002 | Resolved replay identity issue | Allocation rank sorts members, but request-array replay must remain exact. Receipt identity now preserves input array order; reordered same-key creation rejects in memory and native PostgreSQL. |
| BC-003 | Verified bounded race/retry contract | Native staged launch and non-organizer death reach an actual source lock wait. Changed binding rolls back death as `source_changed`; whole-transaction retry settles/refunds the real source, preserving other members' rights. Coordinator must retain that retry contract. |
| BC-004 | Pending shared integration blocker | Ordinary personal market claim/cancel/expiry/estate paths do not yet consume these bindings in this core branch. The listed root guards, exclusions and cash/GIN reconciliation are required and must be tested before exposing/releasing cooperative routes. |
| BC-005 | Invalidated reservation-stranding lead | Actual `Delivery.acceptDelivery` returns `no_order` for the NULL-depot joint order and creates zero commitments. No speculative feature path was introduced. |

The native test harness initially stalled because its query observer omitted PostgreSQL
callback arguments. It was interrupted; the observer now forwards all arguments and
restores the original method. The interrupted log remains retained. This was a harness
failure, not passed concurrency evidence; the corrected source-pinned native run passes.

## Executed evidence

Node `v24.19.0`; native Windows PostgreSQL `18.4`, role `pilot_runner`. Known local
cluster identity was verified read-only first. The runner requires its own empty
database and accepts only `BUYER_COOPERATIVE_TEST_DATABASE_URL`; ambient `DATABASE_URL`
is refused. Final source-pinned native database: `buyer_cooperative_14c8c548`.

Passing commands, exit 0:

```
node test/buyercooperatives.js
BUYER_COOPERATIVE_TEST_DATABASE_URL=postgresql://pilot_runner@127.0.0.1:35439/buyer_cooperative_14c8c548 node test/buyercooperatives.js --postgres
node --check src/buyercooperatives.js
node --check src/buyercooperativecustody.js
node --check src/buyercooperativeinvariants.js
node --check src/routes/buyercooperatives.js
node --check test/buyercooperatives.js
git diff --check
```

Fixtures declare initial pocket cash/gin; actual canonical posting/filling and existing
ledger/cargo primitives perform transitions. Checks cover full and partial allocation,
proportional unused cash/fee surplus, cargo overflow, privacy, exact replay/conflict,
canonical reservation refusal, organizer/non-organizer cash/gin burn and loot, and heir
replay without wealth. Native additionally proves three independent funders, same-pocket
reserve contention, launch/claim replay contention, funding and full order/ledger/binding
rollback, `pg_stat_activity`-observed lock waits before deadline changes, and death/launch
rollback plus retry. Seed 1947 covers 500 deterministic bounded remainder-conservation
cases; this is not exhaustive stateful fuzzing. Memory does not prove locks/rollback;
the cargo-overflow memory fixture explicitly restores its temporary setup.

Raw logs, interrupted/retest evidence, source hashes and findings are retained under
ignored `output/buyer-cooperative-review/`. Core checks pass for this revision. Shared
integration blockers remain open; native HTTP/estate escape-guard and whole-repository
release reconciliation are coordinator work. No deployment/financial activation or
complete production cooperative qualification is asserted.
