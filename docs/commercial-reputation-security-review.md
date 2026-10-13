# Commercial reputation security review

Date: 2026-10-12. Phase: source integration candidate; financial activation remains OFF.
Reviewed executable/test/schema source: `1370b48c6be4c4f76c9dd85575066a566ad69c91`, based on `11ea59154539a6b11a563905be535c7f2771fb40`.
Scope: `src/commercialreputation.js`, `src/routes/commercialreputation.js`, their two tests and appended `commercial_reputation_*` metadata tables/indexes. Included canonical read/payment traces: delivery commitments/market fill, employment wage claims, warehouse rent/closure journals, loan repayment ledger, and completed company workflow procurement/custody/financed settlement proofs. Excluded: shared server/gateway/invariant/census/test wiring, generated knowledge graph, deployment, real financial activation and external providers/messages.

## Model and disclosure

Normal authenticated human and agent sessions may explicitly set the same account's publication preference with optimistic revision. There is no rating submission or caller-selected proof ID, counterparty, score, amount, source adapter or rule. A living heir on the original account can observe existing historical performance; this informational permission grants no old funds, contracts, grants, credentials or spending authority.

Publication requires source validation and an already published canonical company profile. Public lookup requires both grants and rechecks both after source traversal, so consent withdrawal or company unpublication redacts the entire response. The public DTO contains current public company name and fixed category bands only, with null below the privacy threshold. It never includes original characters, account counterparties, contract/journal/transaction IDs, rules, principal, wages, balances, private offers or detailed failure diagnostics. Categories require at least three distinct other original game accounts and at least three eligible source records. This excludes the same original account even across characters; it does not prove separate human controllers or prevent collusion/Sybil accounts.

The private authenticated diagnostics expose only candidate source ID, category, eligibility and, on refresh, an evidence hash for that account's canonical performance role. Explicit account fields on employment/workflow sources must agree with character ownership. Counterparty IDs and monetary/rule details are not copied into diagnostic DTOs.

## Canonical evidence and deterministic roles

| Category | Performed role and required evidence |
| --- | --- |
| deliveries | Original supplier account; delivered commitment, zero remaining, positive quantity and matching canonical procurement order owner/Depot/good/price; buyer's original account must differ |
| paidWork | Original worker account; paid assignment with timestamp, matching independently owned employer/job and delivered commitment, funded job paid-cash coverage and exactly one assignment-specific canonical wage ledger entry for the wage |
| closedStorage | Original landlord account; closed lease with zero held cargo, positive exact unit tariff, matching original Depot ownership and exactly one matching rent journal for the independent tenant |
| repaidLoans | Lender account at settled paper ownership; canonical repaid loan plus exact borrower debit/lender credit ledger records at or after the offer; borrower original account differs; actual debit/credit records are globally bound to one loan proof |
| workflows | Original company account; completed three-stage workflow and exactly five globally consumed source proofs, actual procurement sale and sequential custody/rent journals, delivered commitment, settled original delivery finance and real repaid loan ledger; correct original roles/quantities/gross/net/repayment and source clocks/order through the workflow deadline |

Loan/paper ownership at actual settlement determines the credited lender role; adopted/managed portfolio metadata alone is not evidence of repayment or yield. Categories can overlap (for example delivered employment work and a completed workflow); they are never summed into a score or represented as creditworthiness/profit. Closed paid storage records prove a paid rental ended without cargo remaining, not a future service guarantee. Failed, collected/defaulted, unpaid, unknown, missing, foreign or same-account sources do not certify success.

Three tables are **informational consent/proof-binding metadata**, with no monetary conservation bucket: `commercial_reputation_publications`, `commercial_reputation_proofs`, `commercial_reputation_settlements`. The global category/source primary key prevents duplicate claims or reassignment. The proof pins original performer and account; public validation checks that original performer too. The globally unique transaction primary key prevents one repayment's real debit or credit from certifying copied loan metadata. Registry existence, hashes or completion labels alone never create public success: public reads revalidate current canonical sources and ownership.

## Bounds, transactions and residual limits

Each role/source query uses a deterministic ID-ordered 100-row window; there are five categories. At most 500 proof records per account are persisted; when full, refresh reports `proofLimitReached` and cannot invent replacement proofs. Loan matching returns at most 100 candidate ledger rows per side, and workflow proof reads at most six rows to reject an overfull five-proof set. Wage and rent reads cap two rows to reject duplicated evidence. The returned public bands describe this finite verified window, not an exhaustive all-time history. Canonical rows deleted by another system cannot be represented as currently revalidated successes merely because old metadata exists.

Caller owns a transaction and canonical character lock through `G.withCharacter`. Metadata lock sequence is character then publication; source traversal reads canonical records without introducing another money-action lock order. Canonical money operations remain unchanged. Proof inserts, repayment bindings and publication changes commit together. Concurrent refreshes on the account serialize and retain globally unique claims. Private/public reads perform no writes and no funds movement. There is no new worker loop; refresh is a finite authenticated operation. Public traversal can perform many bounded source queries, so existing gateway/rate controls and integrated performance checks remain relevant.

## Methods, findings and static triage

Applied native adaptations of all three methods pinned in `omerta-contracts/SECURITY-REVIEW-POLICY.md`: Trail of Bits trust-boundary/caller mapping and specification/property comparison; Pashov privilege/replay/boundary execution traces; Plamen canonical accounting, settlement-state and proof-hypothesis checks. No upstream orchestration or Solidity tooling is claimed.

- Access-control/disclosure pass: account-scoped private DTOs, deterministic performed roles, explicit dual publication consent, source validation before consent and a final visibility recheck. Counterparty independence is original-game-account equality, not a human identity assertion.
- State/proof pass: completed/paid/closed/repaid canonical rows followed through journals/ledger and workflow dependencies; late source failure and missing/unknown proof tests; immutable performer/account binding and no metadata-only success.
- Replay/concurrency pass: global source IDs, globally unique loan ledger bindings, same-account serialization, exact optimistic revision and injected late publication failure rollback.
- Boundary pass: closed publication body rejects ratings/extra fields; empty refresh body only; finite 100-source and 500-proof caps; unknown or unavailable evidence never counts success.
- Static diagnostics: Node syntax checks and `git diff --check` pass without actionable diagnostics. SQL values are parameterized; interpolated table/role names come only from the fixed internal definition map, never caller input. No external URLs, provider keys, messages, financial writes or dynamic rating DSL exist.
- Inapplicable: EVM reentrancy/callbacks, chain signers and deployment payment activation. Existing canonical money methods are traced and exercised as test sources; this node adds no money method.

REP-001 (resolved proof lead): a copied repaid-loan row could reuse a matching genuine repayment ledger pair. Correction: globally bind actual debit/credit IDs to a single source loan and filter new matching candidates against those bindings; deterministic local allocation also prevents reuse within a refresh. Retest rejects the seeded copied loan and preserves 14 real source proofs.

REP-002 (resolved disclosure lead): publication might be revoked during the potentially lengthy public source traversal. Correction: recheck both consent and company publication immediately before returning DTO. Retest revokes company publication during traversal and returns only `available:false`.

REP-003 (resolved context lead): workflow validation must distinguish the company's own operating Depot from the buyer commitment's Depot, and use the actual finance supplier fields. Correction: verify each canonical role/reference separately, actual repayment/gross/net, consumed source journals and chronological proof chain. Retest completes a real funded workflow through all canonical actions and rejects a changed source journal despite completion metadata.

Harness corrections: goods purchase is imported from the canonical economy module; ledger timestamps use `transactions.at`; a private-field test uses JSON field keys rather than matching the incidental word fragment in “Separate”. All corrected tests pass. No runtime issue remains open from these failures.

## Executed evidence and conclusion

Retained ignored package: `output/commercial-reputation-20261012/`, including `source-revision.log`, `source-hashes.log`, `memory-final.log`, `routes-final.log`, `static-final.log`, `native-probe.log` and `native-final.log`. Node `v24.19.0`. PostgreSQL `18.4`, role `pilot_runner`, loopback `35439`, verified read-only before provisioning fresh owned database `commercial_reputation_test_4ac396ae338e7205`. Tests explicitly stage `COMMERCIAL_REPUTATION_TEST_DATABASE_URL`, require a local owned-name prefix, overwrite ambient `DATABASE_URL` in native mode and discard it in memory mode.

Commands exit 0: `node test/commercialreputation.js`; `node test/commercialreputation-api.js`; `node test/commercialreputation.js --postgres`; syntax checks of both new source files; `git diff --check`. Real canonical fixtures execute funded procurement, goods purchase/delivery, paid employment claims, paid rent and lease closure, offered/accepted/repaid loans, and a complete purchased/custodied/financed-delivery/repaid workflow across three counterpart accounts. Additional tests cover source/global ledger dedup, foreign/self exclusion, threshold suppression, no public identifiers/balances/rules, dual revocation, revocation during traversal, late wage/workflow source failure, 100-source/500-proof caps with unbacked metadata, unchanged account funds from reputation operations, and original-account history observed by a fresh heir. The heir test changes the living character and retains original canonical historical rows; it does not claim an additional full estate death-path audit.

Native additionally proves concurrent refresh dedup and transaction rollback of a newly validated source proof when the later consent update fails. No confirmed high/critical finding remains in this core. Ready for coordinator integration, conditional on authenticated/public route schemas, metadata source classes, gateway/census/test wiring and final merged release checks. This report covers this exact source and phase, clears no financial activation rail and performs no deployment.
