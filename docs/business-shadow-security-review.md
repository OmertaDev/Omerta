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

## Shadow routing outcome reconciliation follow-up

Source base: `e82567685f5fd07da4d0296157a0290cfc5d076f`; pre-release scope: reconcileShadowComputeOutcomes, bounded CLI --reconcile, and outcome/CLI regressions. Unchanged planner, analyzer and file loader are included dependencies. Pinned security-policy methods are adapted to input/evidence boundaries, accounting traces, invariant testing and static finding triage. No persistence, external call, contract, signer or owner authority changes occur; transaction/concurrency and Solidity proofs are inapplicable to this offline module.

Independent review found no concrete blocker. The original routing input regenerates the plan. Missing funded outcomes, deferred executions, mismatched models, rejected or unobserved acceptance, unknown costs and unsuccessful results block a review recommendation. Known failed and unexpected costs remain in totals; incomplete successful coverage suppresses aggregate cost differences. Maximum 100-record sum is 10^14 micros, safely exact. A single summarized task record does not verify retry history or external billing. Projected outputs reject raw report fields. No provider calls, budget reservations, live policy changes, causality or profitability claims occur.

Executed 2026-10-09: routing, reconciliation and CLI suites pass, including 201 independent cost/budget cases and existing 1001 allocation invariants. Existing experiment tests and docs pass. Static inspection finds no concrete issue; no clean SAST verdict or formal proof is claimed. Conclusions apply only to the following source hashes and authorize no financial activation.

| File | SHA256 |
| --- | --- |
| src/computerouting.js | f4f75291ace520d32bf598e9374b5fe13d22b1c90ac98a3fc23e843b4aa6e1a8 |
| tools/compute-router.js | 3de3a69b483e9c0a04983bd9ef426a524a13c341cd4fa353e1859bf5bb82a3f5 |
| test/computeoutcomes.js | 2e7317275538f48e94af01bcbdae22782c6b2d7394d1c29e1e3186e9c4b19ec3 |
| test/compute-router-cli.js | 8fb01c8c1320178369c5e2ea25e2bb06f3fc271ebfa06387b3f3243bd8579b2a |

## Authenticated outcomes and public storefront review

Source base: `f053b822a79fb82e73ab8511a207fc7a2ff1b215`; pre-release scope: resourceOutcomes, resourceStorefront, outcome record validation/observer/bridge, missing-latency reconciliation, two routes/contracts and tests. Dependencies are existing resource transaction locks, job/call records, bounded file loader and shadow planner. Pinned policy methods adapt access/control and data-provenance traces, accounting and invariant tests, static query triage and exploit hypothesis retests. No schema, provider execution, external settlement, spending policy or owner authority change occurs; Solidity and new transaction-write proofs do not apply.

The authenticated feed binds seller ownership, call account and paid-market-analysis job purpose. Selected calls repeat that binding. Full aggregates include known failed costs beyond detail windows; null costs remain unknown. Named projections exclude task questions/reports/output, buyer identities, raw configuration and provider request IDs. Details cap at 100 jobs, 100 attempts/job and 1000 overall; selected projections can remain separately available outside truncated detail. Public storefronts require an enabled existing offering and expose service/capacity/descriptive acceptance counts only. Existing treasury locks serialize funded writes; reads create no treasury. A configured model is a stored identity, not independently verified response quality; no measured inference latency exists.

RO1 (low, resolved): malformed observer records could supply fully covered totals inconsistent with visible attempts or conflicting selected details. RO2 (low, resolved): a selected attempt could be absent from a purportedly complete detail array. Neither reproduced against consistent server-generated records or enabled financial execution. Exact complete totals/global sums, selected detail equality/membership and cross-job attempt identities now reject these traces. Regression and independent retest pass. Truncated aggregates remain trusted server assertions, not independent billing proofs.

Executed 2026-10-09, Node24.19.0 and isolated PostgreSQL18.4 localhost54839: outcome/storefront memory and native tests pass, including Fastify401/account/delegated-agent/query-forgery cases, ownership/purpose binding, 1215-call totals beyond 1000 detail, null/failed costs and no mutation/private SQL projection. Existing business snapshot native tests pass. Observer and reconciliation tests pass, including encoded credential echoes, redirect/origin/body bounds, private/unknown fields, recorded retry totals and latency-unobserved holds. Routes/auth, docs, repository gates and development preflight pass. Native helper was stopped after tests. Static SQL inspection retains no concrete blocker; no clean SAST verdict or formal proof is claimed. Conclusions apply to these hashes, exclude live financial activation and do not implement banks or new property yield.

| File | SHA256 |
| --- | --- |
| src/resourceoutcomes.js | f8a6f109e9ec7c0d6313c1e8dba6bd1ae0adbdc529b32137fcee5e839df97f57 |
| src/resourcestorefront.js | 10a98171cc8ec259c42828040502b7d79a6d496d79157305cd948262d7a23ae6 |
| src/resourceoutcomeobserver.js | 9e341abe7072554b69d6a1c535c330b522a3ee896b5210368120a0f05acbecca |
| tools/resource-outcome-observer.js | 5040eadf3da4f4b0cac1a0efd51100e5f36ac265013da0a7a59b4d31527d8b36 |
| src/routes/resources.js | f0e5b1b283e2c63a9214e9137527394008ec79293090e893b49d702d58a2ffda |
| src/resourcecontracts.js | d8436d3e2d0eeab30c478eba02f5b9cf791ac0be48673d7535374afda4900cce |
| src/computerouting.js | a6cf01e032c983f8a4ce7bc7f1a674ba9b19ab33e98891b4bc8bb7b751ca55b5 |
| test/resourceoutcomes.js | 10601a1c4efd900b1ee428df4430ee40df67b142393a76ea837d3597cfb0b683 |
| test/resourcestorefront.js | 030e8bd1e2c4d59ff1f7c3208fe548b8220807e76e0a01b0a52442504e6dd300 |
| test/resourceoutcomeobserver.js | 409a9112f21b803179730101709cc20eb0b03f5a0f53423df5ae7d915db39e9e |

Route-guard retest: hosted run `38015879249` passed Forge, both PostgreSQL jobs and recovery, but failed the mounted-route guard because the intended public storefront lacked its explicit PUBLIC rationale. The earlier batched local command continued after that failure; the earlier statement that routes passed was incorrect. The guard now declares only the enabled-service projection and its privacy rationale. `node test/routes.js` passes independently with 881 registrations and 48 deliberate public routes. Runtime route/authentication behavior is unchanged; the authenticated outcome feed remains private. Fresh checks are required for the updated revision. Failed hosted diagnostics are retained in the run and local `output/resource-outcomes-ci-failed.log`.

## Owned-premises storefront release — 2026-10-10

Base: clean `a3e5125fa7e7b55dac07cda879e68162067e6cf8`. Scope: `resourceStorefront` and its regression suite; documentation describes the additive public projection. Runtime SHA256 `9e97769b58b05f5fff880546496cbacbab9bef69cccdd669ce04d21e6a5c2420`; test SHA256 `9bc80ee51c0887df2a2fce67d1a74b30a7cca2c0c9d9f3b7d6b74a9fa5111c31`. Release phase: read-only discovery, financial activation excluded.

Existing enabled-service publication remains the entry gate. Queries bind the requested seller account, project only acquired estate tier and owned street district, and exclude pending/extracted deeds requiring separate chain verification. Controller authority is not ownership. No names, balances, purchase values, private jobs, mutation, new authority or external calls are added. Ownership observations do not establish service location, collateral, income or bank privileges. Separate queries do not promise an atomic snapshot across concurrent property transfers; subsequent requests reflect committed transfers.

Applied the existing pinned Pashov access/projection and economic-assumption passes, Plamen storage-authority/transition review, and Trail of Bits specification comparison and negative tests. Independent scoped review found no concrete issue. Static SQL inspection found only bound SELECTs inside the existing transaction; no SAST or formal proof claim. Reentrancy, callbacks, token transfer accounting and contract changes are inapplicable to this read-only projection.

Executed individually, exit 0: `node test/resourcestorefront.js`, native `node test/resourcestorefront.js --postgres` against disposable PostgreSQL 18.4 on localhost54839, `node test/routes.js`, `node test/auth.js`, `node test/gates.js`, `node test/docs.js`, and `npm run preflight` (development configuration only). Regressions cover unacquired estates, another account's controlled street, owned streets under rival control, transfer removal, extracted deed exclusion, private-field omission and no writes. Native helper stopped afterward. Hosted exact-head required checks remain the merge gate; live deployment verification remains separate. No open concrete finding in this scope.

## Capacity-aware service discovery — 2026-10-10

Base: clean `ca73a1952440b7ddaf09eafffab06e9ffedc88bc`. Scope: `resourceServiceBoard`, existing services GET query forwarding, resourcework regressions and feature documentation. Source SHA256 `ff264af8d46f2399340935ef9e78f1a6e59753470268d40a0f5a59595e1c369f`; route SHA256 `e312b68c37913bfdc996f294899ed3dacfb58fcf731e538fe4fa5de67846c578`; test SHA256 `a9dc5f5e0b5a635d38edc487aabe41f169d70e9e8f3dd460f66fbaad5a0e3867`. Phase: public read-only discovery; financial activation excluded.

The existing enabled-service gate remains. Strict optional filters accept bounded account cursors, integer limits 1–100 and explicit booleans. A single bound SELECT projects public offers and aggregate active-job counts. Availability filtering precedes sorted keyset pagination and limit+1 lookahead; output is bounded to 100 offers. No private job content, buyer identity, balances, ledger writes, reservations or execution/owner authority are added. Capacity is observational and changes between requests; existing job creation still enforces actual capacity and authorization. SQL cursor comparison and ordering use the same database collation.

Applied pinned Pashov access/projection and boundary passes, Plamen storage authority and accounting-transition review, and Trail of Bits specification comparison/negative tests. Independent scoped review found no concrete issue. Initial memory regression exposed pg-mem aggregate HAVING filtering behavior; derived-table filtering preserves native SQL semantics and passes both engines. This failed test and corrected retest are retained here; no assertion was bypassed. Static SQL inspection found bound parameters and explicit public projection; no formal proof/SAST claim. Contract fuzzing, reentrancy and token-transfer callbacks are inapplicable because this layer performs no such changes.

Memory and PostgreSQL 18.4 `test/resourcework.js` pass, including 105 offers across pages, full early sellers, all capacity states, disabled offers, invalid/null limits and queries, HTTP forwarding, private-field omission and one SELECT/no writes. Routes, auth, gates, docs and development preflight separately exit 0. Native helper stopped after tests. Exact-head hosted checks remain the merge gate; live verification remains separate. No concrete unresolved issue in the reviewed scope.

Prior release recovery: changing only CHAIN_RPC_URL on API and worker to PublicNode's published Robinhood endpoint preserved chain ID 4663 and matched genesis hash `0xaad15f3d702aaea00caf3e9bb56395efe9127bc3b31b24921abf1eee3409305c`. No chain verification guard or financial activation changed. Existing reviewed runtime `ca73a195` deployed live as API `dep-db4taiflot8c73culp9g` and worker `dep-db4tainlk1mc73fv4np0`; health reported database up and fresh worker, resource intake false. Public RPC availability remains an operational dependency, not a guarantee of permanent uptime.

## Awarded-delivery budget protection — 2026-10-10

Base: clean `6485e8d0a01a3fb18417ec5eeded7cc1c62238b9`. Scope: `evaluateBusiness`, its regression suite and business-planner documentation. SHA256 source `9347036c34660d405bcd670c19c45b42e2860c10d321ae276a8d6d023ef8fbc2`; test `11aff96e7d838eb304684b0a16e5aa43b8b6605593eb532d857587ef022de8b2`. Phase: shadow proposals only; no financial activation or owner authority changes.

Previously, proposed bids could consume the remaining cash/daily allowance needed for already-awarded open or claimed jobs. The planner now protects one full configured quote per pending job before allocating new bid proposals. Exact BigInt multiplication bounds the protected sum; unavailable or unsafe protection remains null. Coverage booleans describe cash and daily amounts only, not authorization. Existing owner policy, retention, frozen-account and per-call checks remain. Settled costs do not erase unfinished delivery obligations. Incomplete details and invalid/expired pending deadlines hold new bids. Submitted and terminal jobs do not receive new compute allowances; disputed jobs still consume existing capacity. No ledger, treasury, database, provider-call, route, CLI execution or contract changes occur.

Applied existing pinned Pashov boundary/economic-assumption passes, Plamen authority/accounting-transition review, and Trail of Bits caller/specification comparison and negative tests. DB1 (low, shadow-planning integrity): activeJobs=1 with empty visible jobs and no truncation flag originally protected zero while permitting bids. Fixed by requiring visible active-state counts to agree with the global capacity count; inconsistent protection is unknown and bids hold. Duplicate IDs now reject. Independent review reproduced/verified the fix and found no remaining concrete issue. Static source inspection confirms a pure evaluator and unchanged authorization gates; no SAST or formal proof claim.

Executed exit 0: `node test/businesspolicy.js`, `node test/business-agent.js`, routes, auth, gates, docs and development preflight. Regressions cover one/multiple pending commitments, exact cash and daily limits, prior costs, unknown quotes, expired/invalid deadlines, incomplete/mismatched details, duplicates and excluded states, alongside the existing 400 seeded pricing trials. PostgreSQL concurrency proofs and Solidity fuzzing are inapplicable to these pure calculations; required hosted database/release checks remain the exact-head merge gate. Conclusions cover these file hashes only; quote accuracy and external costs remain unverified, and live deployment verification is separate.
