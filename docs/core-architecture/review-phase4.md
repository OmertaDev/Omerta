# Phase 4 progression review

Reviewed 2026-09-17. Baseline: `a18c63cc0c1eb15c7a89df99d7a1428616eb3b58`.
Scope is the Phase 4 source checkpoint containing this report. Exact reviewed working-file
hashes and command logs are retained in the engineering evidence archive. Generated knowledge
indexes are committed separately. This review does not cover unrelated banking, chain or deployment code.

## Model and method

The existing inventory tables and mutation guards retain asset/custody/provenance authority.
Coordination owns authenticated discoveries and live sharing; mystery evidence is not silently
promoted to a claim. The new prerequisite layer consumes those authorities through bounded,
scope-bound proofs. The kernel owns physical consequences; Family operations own collective
participation, escrow and resolution. Content admission has no database access. Player DTOs
are produced after visibility checks and never confer executable authority.

The [repository policy](../../omerta-contracts/SECURITY-REVIEW-POLICY.md) and its existing pinned
method sources govern this scoped review: access-control and execution-trace passes from
`pashov/skills@c577eb7799c349de0acb187ba00ca98e14e436fd`; state/accounting and verified-hypothesis
passes from `PlamenTSV/plamen@795962b96e254f2e423a2635fe7f8cb8ea1e6d69`; trust-boundary,
specification, invariant and false-positive review from
`trailofbits/skills@d3323cefbcf645678b8dc481de204b02ad3d02dc`. These are adaptations to this
JavaScript/PostgreSQL scope. No upstream orchestration, Solidity audit or static analyzer run
is implied. Independent agents cross-reviewed implementations they did not own. Read-only
review findings were checked against real command paths before fixes.

## Findings and resolution

- **P4-FAMILY-DISCLOSURE-01:** existing Family catalogs exposed the new hidden key and allowed
  opening either branch before deduction. Optional pinned own-mystery admission now filters
  catalog DTOs and guards creation after exact replay. Guessed creation before deduction and
  after the opposite branch is denied; current participant history remains separately authorized.
- **P4-COLLECTIVE-ORACLE-01:** a guessed hidden collective action returned forbidden while an
  absent action returned unavailable. Direct collective entry now returns generic unavailable
  before reserving a mutation. The HTTP regression compares complete hidden/absent responses.
  Authorized projections explain the Family requirement. Both native branches pass after the fix.
- **P4-RECIPE-DISCLOSURE-01:** the authoritative standalone catalog lacked the aggregate view's
  hidden-template filter. Both now use the same policy; tests cover hidden ungated omission,
  partial redaction and explicitly learned secret outputs in both views.
- **P4-RECIPE-REPLAY-01:** adding default discovery/scarcity fields to legacy recipe mutation
  envelopes would change existing request hashes. The implementation preserves omission for
  old definitions and includes explicit new policy in new requests. Memory and native regressions
  create actual completed V1 craft and salvage guards with the exact baseline envelopes and
  conserved effects, then replay both upgraded adapters without changing inventory, cars,
  cash, quota or receipt rows. Explicit default/new policies still reject old-key reuse.
- **P4-PGCHECK-SCHEDULE-01 (test fixture):** the unchanged native bounty test assumed
  that the first waiter would be PostgreSQL's deadlock victim. One full run returned
  198 passed/5 failed when the fixture holder was selected, causing four dependent
  refund assertions to fail. The test now pauses the exact refund query, observes the
  holder's reverse wait, then releases the real SQL. Only the fixture holder receives
  a transaction-local one-minute `deadlock_timeout`; production settings are unchanged.
  The original real deadlock counter, retry, pot, exactly-once refund and conservation
  assertions remain. A fresh database run passes **203/0**. The native fixture requires
  its disposable database role to set `deadlock_timeout`, as the CI PostgreSQL role can.

No additional confirmed authority or accounting finding remained in the bounded cross-review
of shared prerequisites, discovery witnesses, mystery actions, Family integration and recipe
quota locks. This is a scoped conclusion, not a claim that no defects exist.

## Verification and limits

Memory and PostgreSQL16 gates cover authentic share/revoke decisions, live Crew/Family
membership, current-world control, exact pins, NULL-pin refusal, replacement characters,
crafted provenance, one planned write proof, one read-only snapshot, and proof reuse rejection.
A native revocation test observes the blocker on the claim mutex; a late genuine grant cannot
expand an already prepared false proof. Scarcity competitors both observe the absent counter
before insertion, exercising the unique-key race. Quota insert/update and later inventory
failures roll back counters, outputs, events and replay reservations together.

Both Furnace branches use real garage acquisition/salvage and domain commands, with no
resource faucet added. They prove two original discoverers, explicit sharing, a hidden crafted
clue, irreversible deduction, separate current Crews in one Family, exact escrow, collective
consequence and participant-only aftermath. Reopened pools/services retain the result and
return the original receipt on retry. Existing kernel, Family and projection suites remain
registered; the new memory/native gates are also registered in npm/CI. The populated upgrade
starts from the exact baseline schema, preserves existing records and replays, applies current
migrations repeatedly, and enforces new quota/kind constraints.

The legacy Coordination, world-object and Family definition hashes match the baseline exactly.
Only new authored content uses the extra policy. Core `definition_hash IS NULL` inventory
boundaries remain intact; authored workshop lots and dormant exact-definition lots were not
merged or reinterpreted. No new OMR authority, external signer, asynchronous adapter or token
transfer was introduced, so Solidity callback/reentrancy testing is outside this change.

Release limitations remain explicit: feature defaults are off; no production activation,
deployment or push occurred. The earlier homepage-image assertion and repository gate debt
remain separate release blockers until verified otherwise. PostgreSQL static SQL preparation
and the interpolation ceiling are reported separately. Best-effort process-local invalidation
still has no durable outbox. Finite recipe counters persist by stable recipe ID and period;
quota/history retention and future content replacement require an operator policy. The admitted
composition is source-controlled; there is no direct generated-content production importer.
