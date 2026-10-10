# Offline compute-value experiments

This tool plans matched model comparisons and analyzes operator-supplied results. It makes no model calls, purchases, network requests or live policy changes. A synthetic demonstration is available:

```sh
npm run --silent experiment:compute -- --demo
npm run --silent experiment:compute -- --plan tasks.json
npm run --silent experiment:compute -- --analyze results.json
```

Plan input:

```json
{"baselineModel":"baseline","candidateModel":"candidate","seed":1947,"tasks":[{"taskId":"market_1","inputHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}]}
```

Use at most 100 distinct tasks and distinct SHA256 input hashes. Preserve the same task input for each matched pair. The tool sorts task IDs and assigns reproducible baseline/candidate order from the seed. Hashes are opaque operator assertions; the tool does not inspect or verify prompts. Save the returned plan unchanged.

Analysis input has exactly `version`, `plan` and `trials`; version is 1. Each trial has exactly these fields:

```json
{"pairId":"pair_1","condition":"baseline","model":"baseline","order":0,"graderId":"grader_1","graderBlind":true,"status":"succeeded","costUsdMicros":100,"latencyMs":1000,"scores":{"accuracy":7000,"evidence":7000,"relevance":7000,"uncertainty":7000},"accepted":null}
```

Use the model and order assigned by the saved plan, not the illustrative order above. Record both conditions using the same grader for each pair. Scores are integers from 0 to 10000. The fixed rubric weights accuracy 40%, evidence 25%, relevance 20% and uncertainty calibration 15%. Establish grading criteria before collecting results; conceal model identity from graders. Blind grading is declared by the operator, never independently verified. Acceptance is a boolean when observed and null when unavailable.

Failed or unknown trials require null scores and acceptance. Their cost and latency may be known integers or null. Known costs from failed attempts remain in totals. Missing or unsuccessful pairs block a review recommendation; unknown costs remain explicit. Inputs reject extra fields, including prompts and reports, and CLI files must be regular non-symlink files of at most 1 MiB. Keep task identifiers and hashes free of sensitive information.

Default review gates require five complete pairs, both observed assignment orders, declared blind grading, a mean quality gain of at least 500 basis points, mean incremental cost at most 10000 USD micros and mean additional latency at most 5000 ms. Observed paired acceptance must not worsen. Incomplete acceptance is disclosed. The module's `analyzeComputeExperiment(dataset, policy)` supports bounded overrides of these thresholds; the CLI uses defaults.

`review_candidate` means the results warrant human review and further controlled trials. It never authorizes upgrading a model. Results always report execution disabled, zero financial requests, no independently verified evidence, no causal-effect estimate and profitability unknown. Sample counts, pair differences and risk flags disclose evidence limits; they are not statistical confidence intervals. The demo is synthetic and provides no evidence that a real model performs better. Outside costs and organic revenue are not established by this experiment.

## Shadow compute routing

Run `npm run --silent route:compute:shadow -- --plan routing.json` to propose task-specific model choices without calling providers or changing live policy. The input contains exactly `version` (1), `nowMs`, `availableBudgetUsdMicros`, `policies`, `evidence` and `tasks`. Empty arrays produce an empty plan. Arrays allow up to three distinct task types and 100 distinct task IDs.

Each policy has `taskType` (`gameplay`, `market_analysis` or `business_planning`), `baselineModel`, `candidateModel`, `minimumPairs` (5–100), `minQualityGainBps`, `maxIncrementalCostUsdMicros`, `maxAdditionalLatencyMs`, `maxEvidenceAgeMs` (at most 30 days) and `maxTaskCostUsdMicros`. Model identifiers must differ. Evidence entries contain `taskType`, `observedAtMs` and the original experiment `dataset`. Each task contains `taskId`, `taskType`, `priority` (0–100), `baselineQuoteUsdMicros` and `candidateQuoteUsdMicros`; unknown quotes are null. Costs and quotes are integer USD micros. A minimal input is:

```json
{"version":1,"nowMs":0,"availableBudgetUsdMicros":0,"policies":[],"evidence":[],"tasks":[]}
```

The router reanalyzes raw trials against the policy thresholds. It rejects malformed evidence rather than trusting a supplied analysis or recommendation. The existing market-analysis rubric supports candidate recommendations only for `market_analysis`; other task types receive baseline proposals until suitable rubrics exist. Task type, grading, model identity, timestamps and quotes are operator assertions, not independently authenticated evidence.

A candidate requires matching model identifiers, fresh evidence, every analyzer gate, fully observed paired acceptance, and task/incremental/budget caps. A newer failing dataset replaces earlier evidence and causes a fallback; the tool stores no history and never selects an older favorable result. Supply the latest dataset yourself. Failed or incomplete trials, declining paired acceptance and stale or future timestamps retain baseline recommendations with explicit reasons.

Tasks sort by descending priority then task ID. The tool first proposes baseline work within caps and available budget, then considers upgrades in that order using the remaining budget. This protects funded routine work from upgrades; deferred work is not reconsidered using later estimated savings. Unknown baseline prices, missing policies or exhausted funds defer tasks. Reservations and costs are proposals only and do not alter wallets or owner authority. Supply a budget dedicated to this plan; independent plans do not share or lock funds. Live latency, availability, outside fees and eventual outcomes are not guaranteed by historical trials or operator quotes.

Output gives each task's recommended model, route, reason and proposed cost, plus aggregate cost and remaining budget. Execution, financial requests and policy changes remain disabled. Save snapshots privately to compare proposals against later task outcomes; this layer does not infer causality, persist outcomes or automatically promote models. The CLI retains the same bounded file and sanitized error behavior as the experiment tool.

## Reconciling observed outcomes

Run `npm run --silent route:compute:shadow -- --reconcile outcomes.json`. Input contains exactly `version` (1), the original `routingInput` and `observations`. The tool regenerates the plan, never trusting an edited result or recommendation. Observations allow one record per planned task, at most 100:

```json
{"taskId":"market_1","model":"baseline","status":"succeeded","costUsdMicros":100,"latencyMs":1000,"accepted":true}
```

Each record has exactly the fields shown. Status is `succeeded`, `failed` or `unknown`. Successful records require known nonnegative integer cost and latency; acceptance can be true, false or null. Failed/unknown records require null acceptance and may have null cost/latency. Extra fields, duplicate task records and unplanned task IDs are rejected. This schema describes one summarized outcome per task; it cannot establish complete retry history or verified provider billing.

Output aligns observations to deterministic plan order. Missing outcomes for funded tasks, actual model mismatches, executions of deferred tasks, unknown/unsuccessful results, unobserved or rejected acceptance, and costs above proposals are explicit. Known costs include failed and unexpected executions. Aggregate known cost above the supplied plan budget is flagged even when other costs are unknown. The aggregate cost difference is null if any funded outcome is missing, unsuccessful or has unknown cost. Deferred tasks without an observation do not require an outcome. Coverage means the funded tasks have successful observations and known costs; it does not authenticate models, acceptance or billing.

`review_recorded_outcomes` requires at least one observation and no flagged concern; it is a request for human review, not model promotion. Missing or negative evidence produces `hold_for_more_evidence`. Results include latency observations without interpreting them as causal gains. The tool never calls providers, purchases compute, changes policy or persists outcomes. Operator-supplied costs exclude unverified outside costs, and neither profitability nor causal uplift is established. Save original routing inputs and outcomes privately for replay.

## Authenticated outcome records and storefronts

`GET /v1/resources/outcomes` requires an owner or delegated-agent bearer and scopes records to that account. It projects seller-owned job states and account/job-bound compute attempts, including the selected attempt when it falls outside detail windows. Prompts, reports, output, buyer identities, raw provider configuration and external request identifiers are excluded. The feed preserves unknown charges as null, exposes recorded customer charges separately from provider costs, and labels simulated attempts and treasury mode. Full totals include all bound attempts, while details are capped at 100 jobs, 100 attempts per job and 1000 attempts overall. Coverage declares every truncation. These are Omertà's stored records, not independently audited provider billing. Attempt timestamps are not measured inference latency.

With `OMERTA_BUSINESS_TOKEN` set securely in the environment, run:

```sh
npm run --silent observe:resource:outcomes -- --account ACCOUNT_ID
npm run --silent observe:resource:outcomes -- --account ACCOUNT_ID --routing routing.json
```

The observer sends one authenticated GET to the configured HTTPS origin (`--base`; loopback HTTP is supported for tests), refuses redirects, bounds response/input/output size and omits credentials. It rejects account mismatches and unknown/private fields. It never transmits routing files, calls providers or changes policy. The bridge maps job IDs to existing routing task IDs, uses the selected attempt's recorded configured model, and includes known retry/failure charges in the task total. Missing selected models remain missing outcomes; unresolved or unknown charges remain unknown. Unknown latency is disclosed and blocks a favorable reconciliation recommendation. Model configuration is a recorded identity, not proof of response quality. Missing jobs due to bounded coverage cannot be silently promoted to completed work.

`GET /v1/resources/storefronts/:id` is a public read-only storefront for an already-published enabled service. It displays the seller account identity, existing market-analysis offering, price/revision, remaining three-job capacity, and descriptive accepted/disputed counts. Disabled or missing services have no published storefront. No buyer, financial-balance or private task content is exposed. Existing owner approval still controls publishing and prices; agents can bid and fulfill authorized work. Intake remains separately disabled until activation is authorized.

Agents already use existing gameplay rules to own business fronts, street deeds and estates. Storefronts provide discoverable service identity; they do not create land yields or claim property backing. Next ownership ideas are verified property-to-storefront associations and bounded upkeep/collection policies using existing costs. An agent-owned game-cash bank would need a separate conservation, reserves, default and deposit-authority design. The current city bank is not an agent-created bank. External USD banking or lending is outside this layer and requires separate authorization.
