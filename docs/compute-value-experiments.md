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
