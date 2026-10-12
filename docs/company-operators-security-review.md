# Company operator core security review

Date: 2026-10-12. Phase: source integration candidate; financial activation remains OFF.
Reviewed source: `a10900015e01fc081b091f81c5909901fee2a306` (clean core commit).
Scope: `src/companyoperators.js`, `src/routes/companyoperators.js`, their two tests and the appended `company_operator*` schema. Included dependency traces: Depot restock/receive, operating policies, supply contracts, market order/fill and Depot journals. Excluded: coordinator server/worker/gateway integration, external providers, live deployment and financial activation.

## Model and guarantees

The separate owner credential enrolls an existing current owner policy; enrollment creates no grant, cash transfer or procurement terms. Authenticated human and agent credentials may execute the enrolled duty. Original account, character and Depot identity stay pinned. Death or a replacement character cannot acquire the enrollment. A revoked or superseded policy, expiry or procurement-term drift stops a new execution. Owner disabling remains available after policy revocation.

A cycle selects at most one delivered procurement for canonical receive, otherwise invokes canonical automated restock. Existing warehouse capacity, district, prison/safehouse controls, restock ceiling/reserve and optional owner supply-contract cadence continue to apply. Optional owner `pricePolicy` separately consents to minimum/maximum sale price, target net cost margin (basis points), and finite expiry capped by policy expiry. Only when no receive/restock is ready, a deterministic target price (clamped within that range) invokes canonical Depot configuration with every procurement term unchanged. Missing/expired consent permits no repricing. No arbitrary provider, key, external purchase, message or personal spending interface exists.

Caller must provide a transaction and locked character through `G.withCharacter`. Lock sequence is character, Depot, policy, existing supply cadence, operator, followed by canonical order/custody dependencies. The operator checks policy expiry after its blocking locks. Concurrent canonical owner controls share the Depot lock. The exact account-scoped request key binds normalized Depot ID and original character/account in a SHA-256 digest. Successful receipt replay precedes new eligibility and returns the original canonical result without spending. Two checks around lock acquisition recover a racing committed receipt. Canonical action, receipt and scheduling update commit together. A conflicting body/character fails closed. New keys do not bypass the 60-second operator interval or canonical pending-order/cadence restrictions.

`dueCompanyOperators(client, limit)` returns a finite 1–100-row snapshot, including original identities, enrollment revisions and due timestamp. This core does not itself wire a worker. The coordinator must execute each candidate through `G.withCharacter` and use a stable key incorporating Depot, enrollment revision and snapshot due timestamp. Snapshot eligibility is advisory; execution revalidates it. A dead owner cannot replay through the ordinary live-character wrapper; direct trusted receipt recovery is limited to the original identity.

## Review methods and triage

Adapted the pinned policy methods: Trail of Bits trust-boundary/caller mapping, specification comparison and invariant checks; Pashov access-control/replay/boundary execution traces; Plamen protocol accounting/state-transition and exploit-hypothesis checks. This is a JavaScript/PostgreSQL review, not a claim that upstream orchestration or Solidity tooling ran. Pin references are those in `omerta-contracts/SECURITY-REVIEW-POLICY.md`.

- Access-control pass: owner enrollment guard; execution actor/body binding; original-account/death/heir negatives.
- State/accounting pass: all spending and stock receipt stay in canonical actions/journals; successful execution consumes exact policy spend; refunds cannot create approval.
- Replay/concurrency pass: persisted account/key receipt, second lookup under locks, finite one-action execution, injected receipt failure rollback on native PostgreSQL.
- Configuration/expiry pass: pinned latest policy identity/revision, current terms, fresh post-lock policy clock, optional canonical cadence.
- Static diagnostics: Node syntax checks and `git diff --check`; no actionable diagnostics. SQL parameter binding and caller inspection found no interpolation of untrusted input. Earlier memory DDL failure (`length` unsupported) was resolved with existing registered `char_length`; no existing DDL was changed.
- Inapplicable: smart-contract callbacks, EVM reentrancy, chain signers/oracles and provider credentials; this change introduces none.

## Executed evidence

Evidence directory (ignored): `output/company-operator-20261012/`. Node `v24.19.0`.
Commands: `node test/companyoperators.js`, `node test/companyoperators.js --postgres`, `node test/companyoperators-api.js`, `node --check src/companyoperators.js`, `node --check src/routes/companyoperators.js`, `git diff --check`.
Memory regressions prove real canonical funded restock (2020 escrow plus fee), supplier-fill/receive, bounded owner-consented repricing, unchanged treasury/stock/spend/reserve/bid/stock-target/budget, stable receipts, revocation/expiry replay, policy drift, pending-order rejection, original/dead/heir identities, bounded discovery and all existing ledger invariants. Route registration proves authenticated read/run and separate owner enrollment guard. Memory does not prove transaction rollback or row-lock exclusion.

Native evidence passed on PostgreSQL 18.4, role `pilot_runner`, loopback port 35439; read-only endpoint verification precedes fresh database creation. Final proof database: `company_operator_test_c262cced105c313d`. Retained in `native-probe.log` and `native-final.log` (exit 0). The endpoint initially refused connections, then started successfully under coordinator control. The native branch uses only explicitly named local `company_operator_test_*` databases and stages `COMPANY_OPERATOR_TEST_DATABASE_URL`; ambient `DATABASE_URL` is discarded in memory mode. Native branch includes three simultaneous same-key restocks, concurrent same-key repricing, distinct-key receive exclusion and an injected post-action receipt failure proving atomic rollback. An independently observed PostgreSQL lock wait crosses the policy expiry boundary and rejects the cycle after lock release; receipt replay remains recoverable. No ambient or production database is used.

## Findings and conclusion

OP-001 (resolved implementation lead): acquiring optional cadence after the authority clock could wait across expiry. Core prelocks the existing supply-cadence row before fresh policy validation. Existing canonical cadence validation remains authoritative.

OP-002 (resolved compatibility defect): pg-mem lacks `length(text)`. Appended owned checks now use the existing compatibility-supported `char_length`. Retest: complete memory regression passes.

OP-003 (resolved test harness defect): PostgreSQL preflight needs explicit fixture-only market seed and mod key. Added fixed isolated test values; native boot succeeds. OP-004 (resolved test harness defect): reading `pg_stat_activity` inside the blocker transaction retained a cached statistics snapshot and missed the runner wait. The observer now uses an independent autocommit pool query; the test observes the lock and proves post-wait expiry rejection. These are harness corrections, not reported runtime defects.

No confirmed high/critical issue in the reviewed core. Core memory, native and static scope is ready for coordinator integration; release readiness remains conditional on fresh integrated authenticated-route/worker checks. Original policy expiry/identity, finite worker candidate selection and canonical ledger invariants remain required. This report clears no activation rail or live deployment.
