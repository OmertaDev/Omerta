# External resource economy review

Review date: 2026-10-08. Source base: `92efdbef6f84c8b2b2b6ab652eee155cd9b49a23`; working tree dirty with new resource modules. The SHA256 inventory below pins the reviewed bytes rather than claiming the base commit contains this implementation. Release phase: local, inactive; no deployment, card payment, real inference purchase, chain transaction, or live funding occurred in this review.

## Scope and methods

Reviewed resource treasury/policy/accounting, funding intents and signed receipts, compute dispatch/reconciliation, funded auctions/credits, paid market-analysis jobs, resource routes/contracts, agent client, recovery worker and their schema. Followed the existing server JWT/account-status/token-version checks, moderator authentication, agent role selection, and database transaction helpers. Existing gameplay, Solidity contracts, dependency source audits, infrastructure, provider internals, and live payment/model configuration are excluded.

Policy: `omerta-contracts/SECURITY-REVIEW-POLICY.md`. Verified local method repository HEADs exactly match its pins:

- Pashov `c577eb7799c349de0acb187ba00ca98e14e436fd`: `solidity-auditor/references/senior-auditor-sop.md`, plain-language function explanation, assumption questioning and backward adversarial traces.
- Plamen `795962b96e254f2e423a2635fe7f8cb8ea1e6d69`: `prompts/evm/generic-security-rules.md` and `prompts/evm/v2/phase4b-invariant-fuzz.md`, external return binding, manipulable preconditions and lifecycle/conservation properties. Its `audit-prep/references/shared-rules.md` was read but is explicitly a preparation format excluding security analysis, so was not used as a security verdict method.
- Trail of Bits `d3323cefbcf645678b8dc481de204b02ad3d02dc`: `plugins/audit-context-building/skills/audit-context-building/SKILL.md`, entry-point/trust-boundary mapping and following callees before finding review.

These are adapted reasoning passes for JavaScript/PostgreSQL. No upstream orchestration, Solidity fuzz campaign, formal proof, or external audit is claimed.

## System model and checked properties

USD micro-units are independent of game cash and OMR. Stripe receipts authorize owner-capital credits; job acceptance moves existing buyer escrow to seller customer revenue. Owner JWTs alone grant policy, initiate funding and publish services; agent JWTs can exercise bounded approved duties. Moderator credentials alone create scarce rounds or adjudicate disputes. Models propose existing action IDs and cannot manufacture authority or request paths.

Reservations precede network I/O; committed sending/unknown calls cannot automatically resend. Refunds do not restore daily authority. Retained provider receipts are bound to server-generated call identity, model/configuration, usage and output limit. Auction commitments include version, round, account, price and nonce; prices are uniform, winners are funded, losers/unrevealed bids recover escrow. Credits hold the winning price until consumption or expiry. Resource jobs bind one server-generated compute call and public snapshot to the assigned seller and customer; report submission needs a settled receipt. Job content/model output remain untrusted.

Final focused refresh: recovery releases only committed `reserved` calls older than ten minutes, under treasury and call locks with status/time rechecked. It does not release `sending`/`unknown` calls. Concurrent dispatch therefore either commits its sending marker first and preserves its reservation, or observes the refunded/failed call and cannot send. The resource worker catches frozen customer escrow failures per job so unrelated expired jobs continue. Accounting now compares reserved money to explicit call/bid/unused-credit/job liabilities, reports unresolved calls and configured provider costs separately, and reports zero external customer revenue for test-mode funds. Hardened preflight requires explicit payment mode, Stripe verification/checkout configuration and trusted HTTPS for intake; real compute additionally requires live mode, its provider key and a configured catalog. Runtime catalog validation remains authoritative for individual capability entries.

Client automation refresh: paid jobs require explicit `maxPaidJobs` opt-in (default zero, maximum ten), consume a per-run quota before dispatch, and deduplicate job IDs including pending/unknown outcomes. The authenticated queue prioritizes the bounded oldest assigned active jobs, keeping completed private history from hiding work. Only server-derived `assignedToYou` jobs in open/claimed state are attempted; customer acceptance is never automated by the seller client. All authenticated requests share a monotonic per-origin/per-bearer scheduler with at least 3100ms between starts, including turn, queue, claim, work, compute and gameplay. Standalone default-fetch paid work uses that same scheduler. Cross-origin credential forwarding is rejected before dispatch, redirects remain disabled, cancelled queued requests never dispatch, and no raw report/token is sent to telemetry. Timing injection exists only in the explicitly named test constructor, not production API/CLI options.

Lock order checked: participating treasuries sorted by account ID before job lock; compute treasury before call/policy; auction round before participating treasuries; payment treasury before payment. No reachable opposing round lock acquisition was found in the reviewed compute/job recovery paths. Native concurrency tests, rather than pg-mem, support same-request dispatch and balanced settlement claims.

Payment receipts verify signature/exact bytes, paid state, USD cents, metadata/client reference, checkout session, intent and test/live snapshot. Early unbound sessions fail for receipt retry. Dispute/refund events freeze new outgoing use; they do not manufacture negative balances. Intake-off recovery remains enabled. Deployment payment mode is immutable for existing treasury obligations: changing test/live mode can block round/call/job recovery and requires a deliberate drained-state migration; test balances cannot purchase real provider inference.

## Findings and disposition

**RE-01 — medium, canonical configuration hashing; fixed.** JSONB normalizes object key order. Comparing raw JSON.stringify configuration hashes rejected a valid first call at dispatch as `authorization_changed`; both memory and native tests reproduced the failure. Primary replaced hashing with recursive canonical key ordering. Both environments now pass dispatch, round freshness and exact credit configuration checks.

**RE-02 — medium, unbounded funded bidder set; fixed.** More than 1000 eligible accounts could exceed the pure clearing allocator bound and prevent round settlement/refunds. Primary added the 1000-bid limit under the locked round before reservation. Native auction lifecycle and pure invalid-input bounds pass; no 1001-account full database stress campaign was executed.

**RE-03 — low, inconsistent accounting snapshots; fixed.** Independent treasury/ledger reads could report false drift across a concurrent posting. Primary changed accounting to a transaction with the treasury locked before reading entries. Lifecycle ledger drift assertions pass. No dedicated adversarial snapshot scheduler was executed.

**RE-04 — high before live payments, frozen escrow payout bypass; fixed.** After a customer funding chargeback froze its treasury, accepting an already submitted job could still move its reserved funds to an unfrozen seller, enabling external compute spending. Primary added a frozen-buyer guard to every non-refund job settlement. Memory and native tests reject customer acceptance, automatic expiry acceptance and moderator payout while frozen; operator-approved refund remains allowed and preserves the freeze.

**RE-05 — medium, aggregate balance bound; fixed.** Available and reserved balances were each bounded at 1e12, but the original posting helper did not bound their sum. Concrete trace: available 1e12-100 plus reserved 100; capital top-up 100 reaches available 1e12; refund 100 then exceeds the available bound and cannot release reserved funds. Primary now enforces aggregate exposure in the posting helper and schema, and checks existing/pending checkout exposure before creating a new funding intent. Memory and native causal regressions reject the top-up, preserve escrow, then successfully refund to exactly the cap with zero ledger drift. Funding tests reject checkout capacity overflow before remote dispatch. Unknown checkout retries older than 20 hours require reconciliation rather than risking provider idempotency expiration; memory/native regression confirms no additional provider call.

**RE-06 — medium, recovery queue starvation; fixed.** A first page of 100 held escrows could prevent later refunds from being inspected. The worker now advances a bounded `(created_at,id)` cursor and wraps at the end. Primary-agent memory and native PostgreSQL tests seed 100 frozen jobs ahead of an unrelated refund: the second page refunds the later job, the held funds remain reserved, and ledger/liability drift stays zero.

**RE-07 — medium, auxiliary-request cadence; fixed.** Compute and paid-work requests initially bypassed the gameplay runner’s request pacing and would hit the agent account’s production three-second throttle. A shared monotonic transport now spaces all authenticated turn, queue, claim, work, compute and gameplay requests by at least 3100ms. Parent-agent tests verify six-request spacing, cancellation and origin isolation with an explicitly named fake-clock seam; production has no interval override. The owner-selected paid-work quota defaults to zero, is capped at ten, and deduplicates attempted jobs including ambiguous outcomes. Only viewer-derived assigned jobs can be selected; customer acceptance is never automated by the seller. Active seller jobs are listed separately from bounded completed history.

**RE-08 — high before live payments, reversed callback ordering; fixed.** A signed refund or dispute arriving before checkout completion could previously be ignored and a later success callback could create spendable funds. Each recognized receipt now locks a persistent payment-intent record before the treasury and payment records. Reversals survive missing checkout bindings; validated later completion freezes the owner, marks the payment disputed and credits nothing. Memory and native PostgreSQL regressions cover early reversal, provider-response binding races, stale callback replay, mode isolation and concurrent completion/refund settlement.

Accepted operational risks and limitations: successful card payments remain reversible, and a later freeze cannot recover compute already consumed or funds already transferred before the reversal. Operators need fraud/reserve/settlement controls before enabling live funding. Prices are operator-configured estimates requiring provider billing reconciliation; hosting and payment fees are not assumed covered. Funding return URLs must remain stable while ambiguous Stripe intents are being retried because full request parameters participate in provider idempotency. Retention-off ambiguous inference requires external operator reconciliation; reservations must not be guessed free. The dedicated resource worker must actually be launched for unattended expiry/settlement. No claim of self-funding profitability follows from deterministic test demand.

## Executed evidence

Runtime: Node `v24.19.0`, PostgreSQL `18.4`; isolated loopback PostgreSQL on port 54839 with per-suite random schemas. Tests use simulated provider adapters and test funds, not remote credentials or real resources.

Final memory commands, each exit 0:

```
node test/resourceauction.js
node test/resource-agent.js
node test/resourceproviders.js
node test/resourcepayments.js
node test/resourcecompute.js
node test/resourcework.js
```

Retained success summaries: allocator/permutation/bounds/commitments; client bounded action selection/no token leakage/no retry/observational outcomes; provider exact pricing/dispatch ambiguity/receipt and webhook adversarial bindings; payment recovery/deduplication/freezing; compute reservations/authority/unknown recovery/auctions/credits; service owner authority/escrow/private jobs/receipt proofs/disputes/expiry.

Final native commands executed sequentially with explicit isolated `COORDINATION_TEST_DATABASE_URL`, each exit 0:

```
node test/resourcepayments.js --postgres
node test/resourcecompute.js --postgres
node test/resourcework.js --postgres
```

Payment concurrent settlement credits once. Compute parallel same-request dispatch invokes one provider call. Job concurrent acceptance posts one balanced transfer. Refunds preserve daily authorization ceilings; failed/stale/revoked purchases release held money; unknown inference retains it until a matching receipt; credit expiry and losing bids restore balances. Allocation randomized property checks: 200 deterministic trials, seed 1947.

Failed evidence retained here: the first memory and native compute run failed the valid-call assertion due to RE-01; retests passed after correction. A concurrent rerun of three full-schema native suites failed with PostgreSQL `53200 out of shared memory` / `max_locks_per_transaction` during schema cleanup and one concurrency query. Sequential reruns of all three subsequently exited 0; this is a test-cluster lock-budget limitation and those parallel runs are not counted as passing.

Static checks executed: `node --check` on nine resource JavaScript modules/client, all exit 0. Focused native searches traced owner/moderator prehandlers, callbacks, reservations, freeze checks, recovery callers and relevant SQL. Syntax checking is not a vulnerability scanner; no SAST/Semgrep/Slither run or clean scanner verdict is claimed. Solidity compiler/callback/onchain invariant testing is inapplicable because this change adds no contracts or onchain transfers.

Final refresh evidence supplied by the implementing agent: `test/resource-worker.js` and the deterministic resource pilot passed memory/native runs, including intake-off recovery, abandoned pre-dispatch reservation release exactly once, frozen-job isolation, and zero ledger/liability drift. This reviewer read those regression assertions and affected code; these follow-up runtime runs were not independently repeated here. The prior directly executed commands above retain their exact scope. Final syntax checks independently repeated for changed compute/accounting/preflight/worker files, all exit 0.

Client automation follow-up independently executed: `node test/resource-agent.js`, exit 0. New cases cover assigned-queue selection, global quota, foreign/customer jobs ignored, pending/unknown no resend, sanitised telemetry, six-request shared fake-clock spacing, aborted/cross-origin dispatch rejection, dot/colon provider IDs, and standalone production monotonic spacing using a mocked network with the real clock. Its production-clock assertion waits through the actual minimum cadence; no live API or credentials are involved. The final runner result retains a bounded list of sanitized resource observations for operator review.

## Conclusion

Evidence supports the scoped local test implementation and the resolved findings above. No confirmed critical/high finding remains open in this review snapshot. Live activation is not cleared by this report; provider/account configuration, payment reversibility controls and resource-worker launch must be addressed separately. Hashes identify this review snapshot; material source or configuration changes require scoped reassessment. Historical project audit totals are not extended by this report.

## Working-tree SHA256 inventory

| File | SHA256 |
| --- | --- |
| src/resourceauction.js | ba2d2d39a85527cbc818d54794b3ee93bbcf74e187b347139ea91cc766760bde |
| src/resourcebook.js | cec63c67a4c86b48d5a617d6175cba0da433b81c20260700e3295d20932b8d1a |
| src/resourcecompute.js | 95638d3c769e8b7702340618f58afa3321979953cfc3b1a0b9d8afb024e5955c |
| src/resourcecontracts.js | 3ba649e71144a7602882231c9988e6f94f218a6c0142972fe77bec96762253f2 |
| src/resourcepayments.js | 5380b240c388f67700851e0335127afc554fdf0e336898b0cb30ee0126029818 |
| src/resourceproviders.js | c4ce4ebbe78db8c8de4aec6cd108807aae2521ba495ff1a654db73a29aea7223 |
| src/resourcework.js | 65544ae71f899e770ac6887460a7d2bc64b126d1f98cf2330dfc0c032a4b5d59 |
| src/routes/resources.js | 7c2532f845a83bb1bbc963814329bc17da8a6a8da0928ee1508b97eb82f48c20 |
| tools/resource-agent.js | d8e9474b54486fac4f9b626daa16a71048c0f612c2ae29e143512fdf041ff4d0 |
| tools/resource-worker.js | aeda9cec9314a0b41b3ccfa59ec8ba3df84651ba484f4d3a5917bf48ef1d537c |
| tools/resource-economy-pilot.js | 3c375d06fb8efdf66b5430d28ab1499dbc5a2fb3a4b027d124356f08167813c0 |
| schema.sql | 34614492a4385fe50f385d165108806099d0d1c3391f6cc8ee9aed2723f24457 |
| src/server.js | 6d5cfc24df5fc2cfe7b47bfbb4f4952feba660c9737b22692c44ad2aecc7f853 |
| src/agentgateway.js | 3d7ef59298315e8589941fcecd9686bf0d8d18223b38890abf4954f663ea0cdf |
| src/db.js | d5d72084714652eba64548d77af4febb72aea98a60995a1b1e0f27475da03401 |
| src/preflight.js | 3e08d1c02e8bd48f91b360393238fd3733421bbb13f5470aa46a51f76e90f15b |
| test/resourceauction.js | ea751667e7f5dc338b30b894643b27b37b88965f93a58f171ab7219f5d0a7d44 |
| test/resource-agent.js | 3983fcb2b77563c25367931f5665d7e1e794baa50c6c7b3be128314f7a210c7f |
| test/resourceproviders.js | ead7c0f057a95e5639ae6f03a30c1a2999b2e3798d03a8a7adac414b5ca341b8 |
| test/resourcepayments.js | 79dd5c0104c6f7098d9ead05d22da9a2ef961cdb303b7517be33a3086b2a4b18 |
| test/resourcecompute.js | d6b9518cc176454068b5af33c00ce4ccccf8da62f8ff88c98e0281cd7f009b9e |
| test/resourcework.js | 42c2e21890f3c472aea738ff935e7fae57ba09d46a7df7199325e69117d65e23 |
| test/resource-worker.js | 34e3353b1a3309a9b4b223658a938f390c0d67f3b8f35671f14a1f97f9c50c64 |

