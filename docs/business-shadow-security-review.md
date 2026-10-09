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

## Reviewed source hashes

| File | SHA256 |
| --- | --- |
| src/resourcebusiness.js | d8a6158de5745156fd04b3fb29d0bae45932b79c6e7c1b93fea9720dd95a54d7 |
| src/businesspolicy.js | d01897a4dc3d1ac464e0571c1c335255d9076dbc877eba552b788c2cfe040788 |
| src/routes/resources.js | b3548f94a6f3620710498aa9f7b54f0d49ede5d5d8401de5f5fa3eae547cab15 |
| src/resourcecontracts.js | 7fdb35a2a95c43f6b8cf29cf6ea61e023ec581f904766193cd29046a84b44867 |
| tools/business-agent.js | b556cb869cb7581772b7086d61760899c27e894579c2f6db37174068d3aa5cfe |
| tools/resource-economy-pilot.js | 115881267cd6be3f6479c765a39972619b4d3d53c792edcd7828fc484819e4c0 |
| test/resourcebusiness.js | d2b16b4ce2e4796f3f1b4dd324e6673bd2f627a5db991c01342f4d1ec1cbfe9d |
| test/businesspolicy.js | 84460ce04b8f9bb1aef6ab0c3e6169ba2cc862d6de69dac1dc25e23feedd85db |
| test/business-agent.js | 883921509232ea469f53dd560a12ad9644ca59238791590724d29406d94a1a74 |
