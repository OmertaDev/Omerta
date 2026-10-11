# Paid game forecasts — implementation review

Phase: unactivated game-cash implementation. Runtime integration revision:
`a752ce8743aab9c0027a06a2ce06a95161dceef3`; predecessor:
`e6669079acf97c01b24dc7a6926ecea0b7797b8b`. Later release wiring and
compatibility evidence do not extend this runtime review to other features.

## Model and boundaries

A living buyer escrows 50–5,000 game cash for one named independent reporter.
Both humans and agents use canonical character transactions. Only a timely,
valid public gin-stock forecast earns the complete fixed fee; correctness does
not determine payment. Neither game cash nor these receipts back external assets.
No payment provider, compute purchase, wallet authority or financial activation
is introduced. Observations contain public market fields, not private Wire data.

The outcome grades the first server snapshot captured within the thirty-second
window after the target, rather than claiming exact target-time stock. Resolution
is on demand. Missing, late or cross-block samples produce a frozen unknown result.
There is no new sampling scheduler. Queries and reports are private to original
party accounts; succession exposes historical receipts without paying them again.

Character/account locks precede job locks. Fixed payments and matching journal
entries commit together. Cancellation and expiry return original escrow only to
the living original buyer. Canonical buyer death consumes open escrow through
existing estate loot/burn rules; it cannot create a refund to an heir. Reporter
death leaves the buyer's refund recoverable. New accounting checks reconcile each
job, recipient and terminal receipt, as well as the total escrow.

## Executed evidence and findings

Adapted repository-policy passes covered authority, replay, accounting, temporal
boundaries, recovery and persistence. These were JavaScript/native SQL reviews,
not contract audits or a claim that upstream review orchestration ran.

- Pure helpers: nine cases, 1,000 seeded trials, actual public market projection.
- Native domain: fixed/fractional cash, rollback, exact replay, escrow refund,
  private history, sampling and distinct-job final-capacity concurrency.
- Actual HTTP API: authorization, human/agent parity, exact request replay,
  fixed payment for incorrect/unknown forecasts, jailed/safe funded buyers,
  canonical estate loot/burn, account succession and invariant tamper controls.
- Fresh PostgreSQL 18.4 and memory runs passed. Fixture clock/SQL translations
  make temporal tests bounded; they do not establish real-time sampling service
  guarantees or slow-query behavior. Hosted PostgreSQL 16/18.4 remains required.

**INTEL-CAPACITY-1 (resolved):** three unsolicited incoming requests consumed a
reporter's capacity. Actual HTTP reproduction blocked the victim's own work.
Repair `6103d90e76a6e416c895dcd66bf2b3eea8d8e026` counts only funded own requests
and voluntarily submitted unresolved reports. Submission checks capacity under
existing locks before payment. Memory/native reproduction and HTTP retests passed;
two concurrent reports competing for the final slot produce one payment.

**INTEL-CASH-1 (resolved during domain development):** integer-total validation
rejected valid fractional preexisting cash. Finite bounded totals now preserve
that balance while forecast fees remain integers; native 0.5-balance retest passed.

API proof commit `993c013ab99044c87912ed333645e8f730a58433`; retained native log
SHA-256 `924b60ca8147bcf4ff8430b4b154f30167b976e6b52651040a102822c23ee0b4`;
memory log `c7589e4cb09ce1316f59195ddf691deb08bdd32d64b9fb46b749f3945f89dc36`;
capacity reproduction `0e725ca465f938821a64e9166380056997723addbb0306a4d720123851af176d`.
Evidence is retained in the managed native/API worktrees' ignored output folders.

## Release limit

Implementation tests support this bounded game-cash flow. Required source guards,
schema catalog, census, full CI, browser checks, exact revision review and deployed
revision/health verification remain separate gates. No release or activation is
claimed by this report. Historical whole-file transfers preserve their original
scope; reconstructed worker fixtures do not qualify the new refund sweep.
