# Business shadow review

Source base: `46341d551fa5626c13d0662b6f93c06319b83555`. Reviewed working tree adds the business snapshot, policy evaluator, finite observer and tests. Phase: local shadow implementation. No production configuration changes, real payments, provider purchases, customer messages, prices or owner policies were changed. Raw working-tree SHA256s below pin the source scope.

Methods reuse verified project pins: Pashov `c577eb7799c349de0acb187ba00ca98e14e436fd` senior-auditor-sop for concrete traces and inversion; Plamen `795962b96e254f2e423a2635fe7f8cb8ea1e6d69` generic-security-rules for accounting and trust-boundary reasoning adapted to JavaScript; Trail of Bits `d3323cefbcf645678b8dc481de204b02ad3d02dc` audit-context-building for delegated context and callees before the separate adversarial pass. These are applied methods, not whole upstream audit or scanner certification. No contract/onchain changes are in scope.

## Model and findings

Authenticated GET loads only the caller's financial receipt projections. It holds an existing treasury row lock for consistency but never inserts a treasury or executes application mutation SQL. Details are bounded; global totals are SQL aggregates. Questions, reports, prompts and outputs are not loaded. Exact-safe integer guards refuse unrepresentable metrics. Open bounty identifiers/prices are the existing authenticated discovery surface. Resource intake can remain off.

The pure evaluator computes a conservative full-input/output quote, measured cost floor, target gross margin and cent-rounded price with integer arithmetic. It accounts for the same funds/daily budget across proposed jobs and preserves owner reserves/capacity. Frozen, unauthorized, expired, unknown-cost and truncated cases block hypothetical bids. Every proposal has `eligibleToExecute:false`; no execution mode or spending-policy update exists.

**BS-01 — low in shadow phase, expired work priority; fixed.** An expired open/claimed job originally met the within-one-hour condition and could be recommended for delivery. Strict future-deadline checking now excludes it and flags recovery instead. The causal unit regression sets expiry equal to observation time and proves no delivery recommendation. No financial loss occurred: the observer cannot execute.

**BS-02 — low in shadow phase, stale observation clock under contention; fixed.** Capturing time before waiting for a treasury lock could mislabel policy expiry or the UTC daily budget after a wait. Time now follows acquisition. Native PostgreSQL regression holds the writer lock while observation waits, then checks the returned observation timestamp is at or after release. Initial source would precede that release.

**BS-03 — low, missing-customer comparison; fixed.** A customer absent from the next bounded cohort could be treated as zero accepted jobs, falsely implying a decline. The comparison now returns null when either observation lacks that customer. A regression removes a prior repeat customer under truncated coverage and verifies the unknown result. Non-job proposals also avoid a misleading job-state label.

A suspected concurrent-observer pacing issue was retracted after scheduling analysis: dispatch timestamps are synchronously assigned and waiting invocations recheck the shared timestamp before dispatch. Existing tests exercise the actual production 3100ms cadence; no unproven finding is retained as a defect.

The observer obtains an environment-only bearer, sends GET only to its configured HTTPS origin (loopback HTTP for tests), refuses redirects, enforces time/body/record bounds and prints sanitized records. Prior JSON records are read-only, bounded, regular-file/identity checked and never transmitted to the API. Comparisons reject different accounts, payment modes and reversed time. Bid-to-job, price and repeat-work observations expressly identify other actors; they never claim causality or net profit.

## Evidence and limits

Node v24.19.0; disposable PostgreSQL18.4 on loopback54839 with random isolated schemas. All fixtures and providers are simulated.

- `node test/businesspolicy.js`: pass; exact pricing, daily/funds/capacity allocation, policy/retention/recovery guards, account/mode/time matching and 200 pricing trials seed1947.
- `node test/business-agent.js`: pass; finite GET-only sampling, production cadence, credential omission, origin/redirect limits, bounded bodies and prior-record validation.
- `node test/resourcebusiness.js` and `--postgres`: pass; no application mutation SQL or raw private-field reads, correct settled ledger revenue, held/unknown costs, complete global costs beyond detail windows and contended-clock regression.
- `npm run pilot:resources:postgres`: six simulated bids matched to accepted jobs with observed receipt/cost changes and zero observer financial requests. The first matching assertion failed because the pilot's custom adapter catalog was not exposed through the snapshot's configured catalog; setting that isolated fixture catalog corrected the setup and the rerun passed. This was not a live model invocation.

The full 11 memory and 6 native resource suites, static native SQL preparation, route/authentication, docs, repository gates and preflight also pass.

Static inspection followed authentication, SQL parameter binding, quote arithmetic, locks, privacy projections and observer transport. Native SQL preparation and repository gates provide additional checks; no SAST/Semgrep/Slither clean verdict or formal proof is claimed.

Known limits: external hosting/processor fees remain unreconciled; price quotes do not guarantee provider availability; snapshot details and provider cohorts are bounded and disclose coverage. Prior records are trusted operator observations, not signed independent evidence. No controlled model-quality experiment or organic profitability is proven. This review authorizes no live financial activation.

## Bounty discovery follow-up

Source base: 8947d67267e98d9947f76e02f206daadfaa6ccf4. Scope: the business snapshot bounty projection and its regression. The existing query could return already-bid or self-owned opportunities; enough such rows also hid fresh work behind the page limit. The projection now excludes the observing seller's existing immutable bids and self-owned bounties before LIMIT. A seller-specific LEFT JOIN preserves opportunities with rival bids and selects no rival bid terms. Parameterized account/time bindings, treasury serialization, read-only statements and privacy boundaries are unchanged.

Memory and PostgreSQL18.4 regressions put 101 already-bid opportunities ahead of fresh work, plus self-owned/expired cases and a rival bid. Only fresh competing work remains visible; excluded rows do not mark opportunity coverage truncated. No finance actions or owner authority changes occur.

## Fee-aware planning follow-up

Source base: `f8aae4e6232f9c7a26231c56fefc16b13f0c9631`. Scope: pure shadow pricing, CLI flags and their tests; no database, owner-authority or provider changes. Operating costs are bounded operator estimates and percentage fees round up to cents. A conservative one-cent buffer bounds rounding excess. Target margin plus fee percentage must remain below 100%; separate positive denominators bound both gross target margin and minimum absolute margin. Suggested prices must remain within market limits.

Independent source review and 400 deterministic pricing trials (seed1947) verify the inequalities against independently calculated rounded fees. The fixed case of 12000 compute micros, 300000 operating micros and 290 fee basis points yields a 450000 price, 20000 estimated fee and 118000 estimated contribution. Legacy zero-fee policies remain unchanged. Higher published prices preserve coverage; compute reservations still use only the compute quote. Estimates never become ledger charges and do not make outsideCostsComplete or profitabilityKnown true. Operator fees are not verified provider billing data.

## Reviewed source hashes

| File | SHA256 |
| --- | --- |
| src/resourcebusiness.js | 673b8f1c7b65a50ba3fe1a5518a9e656690f37b890e61dec4ef1f3de12f4c549 |
| src/businesspolicy.js | ef0fa70b7616fd5ad21f48b999f58f45ef30600ecc4cbe641ec7e4d30e381f31 |
| src/routes/resources.js | b3548f94a6f3620710498aa9f7b54f0d49ede5d5d8401de5f5fa3eae547cab15 |
| src/resourcecontracts.js | 7fdb35a2a95c43f6b8cf29cf6ea61e023ec581f904766193cd29046a84b44867 |
| tools/business-agent.js | 1d2bd59f602dd887b91101fdb6460a41cdbf8851b3851b21bc7318d8ab986df3 |
| tools/resource-economy-pilot.js | 115881267cd6be3f6479c765a39972619b4d3d53c792edcd7828fc484819e4c0 |
| test/resourcebusiness.js | 580f3011e74fcce5274f9036dc66d4c1a862cfa9c6ead8aede145b0bc9f888ae |
| test/businesspolicy.js | 76a8adef67b503f76f77e7d7ec12fcad09644b33a69101f59529ec608eb2769a |
| test/business-agent.js | 883921509232ea469f53dd560a12ad9644ca59238791590724d29406d94a1a74 |

## Offline compute experiment follow-up

Source base: `c0449221530b5b26e98b8a6c7a354dee367018bd`. Scope: offline planner/analyzer, bounded file CLI and two regression suites; pre-release source review. No network, database, provider invocation, financial activation or policy writes are introduced.

Independent review found no concrete blocker. Fixed weighted scores use BigInt before exact integer threshold comparisons; bounded 100-pair cost totals stay within safe integer range. Strict schemas reject duplicate task hashes, altered assignment metadata, mismatched models/orders/graders and private report fields. The CLI rejects symlinks and oversized files and closes file handles. Declared blind grading and input hashes remain unverified operator assertions. Both observed orders do not establish equal allocation, statistical significance or causality. Known failed-attempt costs remain in totals; incomplete or failed pairs block review recommendations. Missing acceptance and outside costs are disclosed. Execution remains disabled even for review_candidate.

Validation: planner/analyzer and CLI regressions pass, including 100 seeded plans, exact fractional thresholds, failure/unknown costs, negative acceptance, privacy rejection, bounded input and credential isolation. Existing business policy/observer tests and repository gates pass. No formal proof or clean SAST verdict is claimed. These conclusions apply only to the files below and authorize no live financial activation.

| File | SHA256 |
| --- | --- |
| src/computeexperiment.js | 22c825cc8250ce44af227f9531b290dfbbf2f3265b2b2bba8466851ec5797907 |
| tools/compute-experiment.js | cf6dc04f23fa672aed6c0f33bda4dab117ed3e8282ba12863d812f4bece1973d |
| test/computeexperiment.js | 4ae0c6696efe4310cd225f70d6c5e2620f6494e868cd0f03a80df465806dba0f |
| test/compute-experiment-cli.js | cc34e64adf538338f3ff46fad62eb0c59e973206cefef554a686b78cad96fcc7 |

## Shadow compute routing follow-up

Source base: `5a7dc734fe0c3c7616d6903d10e1764e3abcd877`; pre-release scope is the pure router, offline CLI and two tests below. Dependency: unchanged compute experiment analyzer and bounded file loader. Pinned policy methods were adapted to input/evidence trust boundaries, allocation traces, invariant testing and false-positive triage. No database, contracts, external calls, wallet authority or production configuration change is in scope; transaction/concurrency and Solidity proofs do not apply to this pure offline module.

Independent review found no concrete blocker. Raw trials are reanalyzed, not supplied recommendations. Model mismatch, stale/future evidence, incomplete acceptance and unsupported task rubrics prevent candidate routes. Baselines consume proposed budget first; negative incremental candidate costs refund only shadow allocation. Exact totals remain within safe integer limits. Each task is unique, ordered deterministically, and all proposed totals remain within the supplied budget. Dates, task labels, grades, model identities and prices are unverified operator assertions; separate plans have no shared funds lock. No model calls, real reservations, causal inference or policy writes occur.

Executed on 2026-10-09: `node test/computerouting.js` and `node test/compute-router-cli.js` pass, including 1001 budget invariants, freshness/acceptance/model/scope failures, unknown quotes, duplicate/private-field rejection and sanitized CLI errors. Existing experiment suites pass. Syntax/static source inspection reveals no concrete issue; no clean SAST verdict or formal proof is claimed. Conclusions apply to the exact hashes below; financial activation remains excluded.

| File | SHA256 |
| --- | --- |
| src/computerouting.js | 48807d1a5b6cf6114f98fd33bbadc1e8a14d0205ff7b4c90243aa1643130c2f7 |
| tools/compute-router.js | 40b7948e3f91813f4a2be75c92b1016f77e7d6810b18452843adbba723d98b0e |
| test/computerouting.js | 57b876590934e62f2df7087bf8ad4906402ac31e79d08d6ca916de127cd282d6 |
| test/compute-router-cli.js | 56f5c7882592fc8d5f6f9735123bf25480bc1522c6adb87b82fadcb4fb19c861 |
