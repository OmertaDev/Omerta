# Warehouse lease source review

Date: 2026-10-11. Phase: source review and isolated native proofs; release and
production health verification are separate gates. Domain source
`c423a321eb68e0c96e6f59659c111009a87b73f2`, integration
`9d5a2d38669a820d646d2d8661b87fd2707b1737`, combined tender source
`e3b5586c9887d980bc03c709841804b66e36752b`, release wiring `22d57a13`.
Server blob `2e340c1069979debd62ef9f9190c76d1490caadd`.

Scope: prepaid twenty-four-hour game-cash storage capacity at independently
owned depots. Immutable lease terms bind the tenant, landlord, depot, capped
units, price and published offer revision. Rent transfers existing personal
cash into business treasury once. Storage moves actual cargo into separately
journaled tenant custody; it never counts as merchant sale stock or revenue.

Depot locking serializes merchant procurement, receipts and rented capacity.
All three share the forty-unit physical limit. Expiry blocks deposits but
retains cargo and retrieval rights. Landlord death preserves tenant goods;
tenant death clears only its own custody once. Estate cleanup locks the sorted
union of current obligations before touching leases or procurement orders,
avoiding reciprocal warehouse deadlocks. No unrelated historical claims lock.

Journal invariants reconcile rent debits with landlord receipts, immutable
lease ownership, physical custody and ordered per-lease after-state sequences.
Nullable unique rent identifiers prevent duplicate fees. Fixed terms introduce
no debt, automatic renewal, refund promise, crypto payment or spending grant.

Repository security policy methods applied to custody, accounting, authority,
replay and lock ordering. Independent combined warehouse/tender review found
no concrete defect; legacy exact source inverses preserve historical pins
without extending their qualification to this new runtime.

Memory domain/API and existing depot regressions passed. PostgreSQL 18.4 API
proofs passed: inserted journal failure rolls back custody, valid competing
rentals have one last-slot winner, procurement respects rented capacity,
expired claims retain retrieval, and simultaneous reciprocal landlord/tenant
deaths complete with reconciled custody. After-state tampering is detected.
Frozen migration definitions and existing causal controls passed. Evidence:
output/warehouse-api-postgres-final.log and warehouse-upgrade-definitions.log.
Test fixtures use isolated local databases; no production actor or transaction.

Financial activation remains disabled. Fresh hosted checks must qualify the
exact release revision before merge, followed by deployed revision and health
verification. This review does not establish outside earnings or crypto backing.

Hosted `8691f308` exposed the inherited tender fixture/census gaps and a missing
warehouse-claim estate-census entry. Scoped test-only repairs `b7e7bd41` and
`9cdf355e7b2837b4c94037af5ad0cd92b4491a12` preserve native runtime and exact
source transfers. The combined migration classification retest passed; current
claims are cleaned by the existing death hooks and immutable history remains.
No guard was waived. Fresh complete hosted gates are still required.

Further hosted qualification exposed the Director migration test's finite table
classification omitting these reviewed additive features. Test-only repair
c05b1e2c8c8adf86663c6dff7a640c0b8a93abdc recognizes only explicitly named
feature tables present in the frozen catalog, compares exact constraints and
nullability, and preserves the pinned baseline plus unknown-addition controls.
Native PostgreSQL 18.4 full-stack and new causal-negative retests passed;
partial-stack native PostgreSQL 16/18.4 hosted retests remain release gates.
