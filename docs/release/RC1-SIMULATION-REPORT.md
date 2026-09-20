# RC1 multiplayer simulation evidence

**Decision: supplementary simulation checks PASS; Phase 4 remains INCOMPLETE.** The measured native workload has 16/16 passing runs. It does not prove every required long-term or adversarial population behavior. Do not substitute model invariants or missing measurements for zero failures.

The original batch passed 15/16 runs. The remaining 1,000-player run failed during schema cleanup with PostgreSQL 53200 (lock-table exhaustion while concurrent release harnesses shared the disposable cluster). Its complete isolated rerun passed all 55 invariants on the same frozen source and harness, with the default max_locks_per_transaction=64. Original failure and summary remain unchanged in native/; retest evidence is in [retest/1000-rc1-alpha-1.json](evidence/simulation/retest/1000-rc1-alpha-1.json). The table below uses that successful rerun. Classification: ENVIRONMENTAL, reproduced workload retested successfully; no production setting or assertion was relaxed.

## Tested source and environment

- Frozen application revision: `626e61b9ab2b14a9dc45566983b70cdc65692839`.
- Native harness SHA-256 (UTF-8 JSON string representation): `835ccd1b9d58203cb44009f389e492d0cfa3b859ef223f43c918132527aec616`; the individual run files retain the same identity.
- Windows host, Node.js v24.19.0, PostgreSQL 18, isolated fresh schema per run. Each fixture loads the complete schema and drops its own schema on completion.
- Two policy seeds (`rc1-alpha`, `rc1-beta`), two independent replicates each, four population sizes; 6500 account participations across completed runs. Five designated actors in each run establish the initial world and execute campaign operations. Other accounts execute their own issued commands.
- The roster uses all 13 requested archetypes. Activity, acquisition, sharing, stale/foreign attempts, hoarding and disappearance policies differ. Social actors form real Crews and Families through domain services. Independent population campaigns are not yet simulated.
- Explicit fixture starting wealth is $100,000 and 10,000 respect per actor. Initial character-cash drift is exactly population × $99,500; that same drift must remain unchanged. All other 54 production ledger/provenance checks must pass without a baseline exception. No inventory, world state, claim, operation outcome or OMR balance is seeded or rewritten.
- Acquisition uses the existing deterministic successful boost/salvage fixture. Native operation resolution retains cryptographic production randomness; operation IDs and resolution seeds are saved. Policy seeds reproduce the workload recipe, not UUIDs, exact schedules or every random operation outcome.

## Reproduction

Use a disposable local PostgreSQL database and installed lockfile dependencies:

```powershell
$env:COORDINATION_TEST_DATABASE_URL='postgres://postgres@127.0.0.1:55439/rc1_check'
node test/rc1-simulation.js
node tools/rc1-sim.js --postgres --populations=25,100,500,1000 --seeds=rc1-alpha,rc1-beta --replicates=2 --rounds=2 --output=docs/release/evidence/simulation/native
node tools/rc1-sim-model.js
node tools/rc1-sim-report.js
```

The harness calls production command issuance/execution, Knowledge authorization, Crew/Family membership, crafting, salvage, operation escrow, World Kernel and Director services. It does not use HTTP, browsers or player credentials. PostgreSQL enforces the actual transactional boundaries. Population actions are scheduled sequentially; each run additionally issues a simultaneous pair of identical operation execution requests, then retries the receipt.

## Native results

| Population | Passed runs | Executed commands | Knowledge shares | Canonical world changes | Total run seconds |
| --- | ---: | ---: | ---: | ---: | ---: |
| 25 | 4/4 | 488 | 16 | 16 | 104.8 |
| 100 | 4/4 | 1554 | 86 | 16 | 215.6 |
| 500 | 4/4 | 7227 | 456 | 16 | 839.8 |
| 1000 | 4/4 | 14288 | 916 | 15 | 1374.6 |

Durations include fixture creation, setup, service work, invariants and local competing test activity. They are not production latency or capacity measurements.

| Requested measurement | Observed native result |
| --- | --- |
| Opportunities generated | 46 Director situations; 1139949 card impressions and 128406 distinct actor/card pairs |
| Opportunities completed | 29 situations have canonical resolution; 10861 successful command/card links; these are different units |
| Opportunities abandoned | NOT_MEASURED as an opportunity lifecycle; 496 visits stop before issuing a command |
| Campaigns started/completed/abandoned | 40 / 21 / 0; canonical campaign schema uses abandoned, not failed |
| Campaign failure | NOT_MEASURED beyond operation failures below |
| Cross-campaign propagation | Retained world action sequences and Director states in each run; no aggregate causal propagation counter |
| Operations created/completed/failed/expired | 64 / 47 / 1 / 16 |
| Coordination participation | 48 run-local distinct participant counts, restricted to designated fixture actors |
| Knowledge propagation | 2051 claims, 1474 grants; 1474 authorized group reads checked |
| Resource consumption | 440 stack debit units and 10678 credit units. These include escrow transfers/refunds; net manufacture/sink totals NOT_MEASURED separately |
| Item creation/destruction | 80 unique items created; 64 consumed |
| World state changes | 63 canonical events |
| Player commands executed | 23557 distinct completions; 1005 replay responses |
| Stale command rejection | 986 stale probes; 986 stale rejections |
| Replay rejection/suppression | 1005 unchanged-history checks; 16 duplicate bursts; safe in-flight contention then durable replay is accepted |
| Dead ends and Director starvation | NOT_MEASURED over a sustained native horizon |
| Opportunity starvation | 0 sampled visits have no AVAILABLE command; this does not prove practical resource acquisition paths |
| Opportunity flooding | Maximum 63 cards in a sampled board; 0 truncated boards. No player-tested flood threshold |
| Campaign repetition | NOT_MEASURED over a sustained native horizon |
| World object contention | Duplicate operation execution exercised; distinct competing commands and a concurrent 1,000-player workload NOT_MEASURED |

## Integrity evidence and limits

- 880 final production invariant evaluations passed in completed runs, including material conservation, unique custody/provenance, World Kernel history and operation capital/custody/history. Harness tests verify that a missing invariant, new OMR drift, cash drift or custody failure makes the run fail.
- 7894 unrelated-reader probes found 0 private claim identity disclosures. These inspect specific undisclosed claims and shared grants; they are not an exhaustive noninterference proof.
- 988 account-bound command attempts were refused and left canonical histories unchanged.
- 0 negative inventory rows and 0 duplicate object/revision consequences observed.
- 16 committed operations expired through the authoritative recovery command; inventory custody was re-audited. Test time crosses the stored deadline; no canonical deadline row is edited.
- All measured OMR conservation checks passed, with 0 OMR transaction rows. OMR-moving or reward-bearing gameplay is not exercised by this content slice; this cannot replace economic/contract gates.
- Each Director was recreated and the same tick replayed without adding canonical history. Process termination and database interruption belong to separate release gates.

## Supplementary selection models

The existing frozen 13-scenario Director catalog ran at 1, 7 and 30 days for each seed/replicate: 156 model snapshots. The existing Campaign Network model also ran all 16 requested population/seed/replicate combinations. The immutable admitted-scenario guard remains intact. See [model matrix](evidence/simulation/model/matrix.json).

These models call production compilation, eligibility, pressure and selection functions. Synthetic custody, knowledge distributions and modeled operation outcomes do **not** execute PostgreSQL or authorize real Player Commands. Their zero balance/dead-end counters are model properties only. Population labels alone are not evidence of native load or human engagement.

## Failures and outstanding release evidence

- No observed production integrity regression in the completed native runs.
- **NEW REGRESSION (validation harness, corrected):** the second 25-player development pilot expected both simultaneous requests to fulfill. The production issuance lock correctly rejected one with `contention`. The final harness accepts only one new completion plus either that refusal or a replay, then demands a successful receipt retry and unchanged canonical counts. The failed pilot is retained at [pilot2](evidence/simulation/pilot2/25-rc1-alpha-0.json).
- **NEW REGRESSION (validation harness integration, corrected):** an initial model invocation supplied custom scenarios to the frozen-catalog Dock simulator and failed its `Choose an admitted scenario` assertion. The final tool retains that assertion, uses the admitted catalog for Dock horizon evidence and the existing configurable Campaign Network model for population scenarios. Synthetic discovery-source counts match the production cap of 32.
- **RELEASE BLOCKER — incomplete Phase 4 coverage:** execute sustained native campaign populations with distinct commands contending for the same objects, independent Crew/Family campaigns, repeated operation failure, long-term starvation/repetition/dead-end detection and correlated player dropout. Reproduce current short horizon with the command above; the explicit `notMeasured` arrays document the missing observations.
- **Required cross-gate evidence:** evaluate reward-bearing and nonzero OMR paths in the economic suites if those features are admitted to the cohort. This simulation cannot stand in for those checks; disabled economic features do not become a demand to enable or expand them.
- A maximum card count is an internal UX finding. Decide pacing changes only after the first-session/mobile audit demonstrates a severe player failure.

SIMULATION_GATE=INCOMPLETE
