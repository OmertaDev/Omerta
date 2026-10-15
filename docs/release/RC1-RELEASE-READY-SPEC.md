# OMERTA RC1: specification for reaching release readiness

Status: implementation specification. This document does not grant release clearance.

## 1. Objective and scope

Close the four open proof gaps in the RC1 assessment, reconcile the release source,
and produce a reproducible decision for one exact deployable revision:
**RELEASE READY** or **NOT RELEASE READY**.

The architecture is feature complete. Work is limited to release tooling, missing
assertions, workload coverage, diagnostics, recovery validation, and repairs required
by reproduced release failures. Do not add another gameplay, progression, economy,
social, graph, campaign, crafting, mystery, currency, or blockchain system. Do not
redesign the interface without a demonstrated critical-path failure.

This specification introduces proposed numerical launch criteria below. They are
project acceptance targets, not observed results or industry benchmarks. Record them
before running the acceptance campaign; do not lower them after seeing failures.

## 2. Evidence baseline

| Item | Recorded revision or result |
| --- | --- |
| Frozen main | `626e61b9ab2b14a9dc45566983b70cdc65692839` |
| Assessed repaired candidate | `cce721029c86de7c6f0d875fef7cb8de29504dda` |
| Sealed evidence commit | `a3d2d56aecc9e6d10c24e3c12ff9cf29e9257c8d` |
| Main movement observed during assessment | `468516d8d6f3729514711ad5a0b83e440c5c46f9`; outside the assessed freeze |
| Recorded verdict | NOT RELEASE READY |

Authoritative starting references:

- [Release report](https://github.com/OmertaDev/Omerta/blob/a3d2d56aecc9e6d10c24e3c12ff9cf29e9257c8d/docs/release/RC1-RELEASE-REPORT.md).
- [Gate report](https://github.com/OmertaDev/Omerta/blob/a3d2d56aecc9e6d10c24e3c12ff9cf29e9257c8d/docs/release/RC1-GATE-REPORT.md).
- [Resource-transition gaps](https://github.com/OmertaDev/Omerta/blob/a3d2d56aecc9e6d10c24e3c12ff9cf29e9257c8d/docs/release/evidence/simulation/resource-transition-coverage.json).
- [Simulation coverage](https://github.com/OmertaDev/Omerta/blob/a3d2d56aecc9e6d10c24e3c12ff9cf29e9257c8d/docs/release/evidence/simulation/matrix-coverage.json).

Existing evidence includes full CI, real PostgreSQL recovery, 1,247 Foundry tests,
scoped native 1,000-player runs, and automated phone journeys. Preserve their exact
source boundaries. A scoped pass is useful regression evidence but does not close
the missing long-term, full-resource, human, or deployed-environment requirements.
The four open items are missing required proof, not claims of demonstrated exploits.

## 3. Work packages and ownership

| Package | Responsible role | Dependency | Exit artifact |
| --- | --- | --- | --- |
| RC1-00: select and reconcile source | Release engineer | None | Candidate manifest and source reconciliation |
| RC1-01: reproducible proof harness | Backend/test engineer | RC1-00 | Native runner, replay records, evidence validator |
| RC1-02: resource conservation | Backend/economy engineer | RC1-01 | Complete transition coverage and movement reconciliation |
| RC1-03: world matrix and dead-world detection | Simulation engineer | RC1-01, RC1-02 | 225 canonical runs and minimized failures |
| RC1-04: authority and replay completeness | Security/backend engineer | RC1-00, RC1-02 | Role/command attack matrix and retests |
| RC1-05: mobile and golden journeys | Client/QA engineer | RC1-00 | Browser, physical-device, and journey evidence |
| RC1-06: deployment and recovery | Release/operator role | RC1-00; admission waits for technical gates | Environment attestation and recovery rehearsal |
| RC1-07: controlled real cohort | Cohort coordinator and operator | Technical gates RC1-02 through RC1-06 | Real-session results and resolved P0/P1 findings |
| RC1-08: final qualification | Release owner | All packages | Final report, immutable evidence, tested release tag |

Assign a named owner to each role before execution. Independent packages may run
in parallel in isolated checkouts/databases. Do not mutate a checkout while it is
being used to generate exact-revision evidence.

### RC1-00: reconcile and freeze the actual release source

1. Fetch current main and compare it with the assessed candidate. Inspect the actual
   runtime, schema, client, deployment, dependency, and workflow differences; the
   previously observed main SHA is historical, not a claim about current main.
2. Integrate the required RC1 repairs into the intended main lineage in an isolated
   branch. Preserve the migration fail-closed behavior, passive-telemetry confirmation
   repair, and privacy-safe diagnostics. Resolve overlapping edits by invariant, not
   by blindly cherry-picking whole files. Preserve unrelated user work.
3. Record one candidate SHA, clean-tree status, lockfile/content/schema hashes,
   migration inventory, enabled flags, supported integrations, services, workers,
   background schedules, PostgreSQL version/extensions, and contract deployment scope.
4. Pin the source pair for upgrade and rollback. A different rollback predecessor
   requires a new compatibility rehearsal.
5. Assign every subsequent repair a failed gate ID, reproduction, before/after result,
   changed source list, and affected-gate rerun list. Never silently move the freeze.

Acceptance: every run resolves to an immutable source revision and configuration.
No report inherits a pass merely because code was merged. Relevant proofs must run
against the integrated candidate before final clearance.

### RC1-01: make native proof reproducible

Extend the existing `tools/rc1-sim.js`, population probes, campaign support, and RC1
PostgreSQL/recovery tests. Do not replace the game with another model or add a second
authoritative state store.

Required runner behavior:

- Use real PostgreSQL and the canonical API, command dispatcher, workers, and domain
  transactions. Each run owns an isolated database/schema and explicit configuration.
- Seed roster, actor policy, scenario, logical clock, and relevant random decisions.
  Advance application and database time consistently through existing seams where
  possible; do not rewrite deadlines/statuses directly to manufacture progress.
- Record otherwise nondeterministic values and actual concurrent ordering. Serial
  seeded runs must reproduce normalized canonical state. Concurrent runs must retain
  enough request/commit ordering to reproduce the observed failure schedule.
- Exclude generated IDs and wall-clock diagnostics only through a documented
  normalization map; do not normalize away balances, visibility, state, or outcomes.
- Actor policies use only information that the actor can obtain through authorized
  interfaces. An omniscient diagnostic observer must never feed hidden facts to them.
- Record fixture grants, social memberships, balances, items, world conditions, and
  eligibility before the measured run. After initialization, all changes use canonical
  transitions. Keep fixture-assisted and natural-entry results distinct.
- Persist a checkpoint, event history, command identities, worker schedule, and
  resource journals sufficient for restart and failure reduction. Checkpoints are
  recoverable database state, not a substitute for durable game state.
- Fail the run on a failed assertion, unexpected exception, unfinished required cell,
  invalid evidence reference, or unreconciled resource movement. Do not average failures
  into a success percentage or turn timeouts into passing skips.

Each run record must contain source/configuration hashes, run/seed/scenario IDs,
database/runtime versions, hardware limits, start/end times, logical duration,
population and active-actor counts, commands/denials/replays, assertions, outcome,
artifact hashes, and explicit coverage exclusions. Store restricted actor details in
access-controlled artifacts; public summaries use synthetic or pseudonymous IDs.

Acceptance: same-seed serial replay, recorded concurrent replay, checkpoint restart,
and deliberate invariant-failure injection demonstrate that the harness detects
failure and preserves an actionable reproduction.

### RC1-02: prove every existing valuable-resource transition

Create a coverage inventory mapping each resource, authoritative table/ledger,
mutator, terminal branch, authorization requirement, and replay identity to at least
one native test and one simulation exercise. Cover all thirteen resource categories
from the original mission, including seasonal and contract-related resources.

For each resource type and ownership/custody boundary, assert:

```text
AFTER = BEFORE + CREATED - DESTROYED + TRANSFERRED_IN - TRANSFERRED_OUT
```

Creation and destruction must cite an existing rule and authoritative receipt/event;
an unexplained adjustment cannot be renamed a mint or burn. Count a custody claim and
its backing asset once. Transfers must have equal source and destination movements.
Crafting reconciles each material and output type separately against its recipe.
Use exact integer/atomic units and the existing explicit rounding rules.

Close all nine recorded gaps:

| Gap | Required executions and assertions |
| --- | --- |
| C02-OMR | Nonzero transfers, sinks/recycling, mint/burn, backing, and collateral pledge/refund/seizure; reconcile player, desk, custody, and aggregate balances. |
| C02-CAMPAIGN-CASH | Actual legacy campaign cash claim and exact retries; one reward credit per authorized claim. Campaign Network outcomes alone do not cover this payout. |
| C02-OPERATION-CAPITAL | Deposit, refund, spend, cancellation/expiry, and forfeiture after owner death/replacement; every held unit reaches one valid disposition. |
| C02-HARDENING | Consume canonical inputs, charge exactly 300 cash once, create the intended output once; retries and rollback preserve the equation. |
| C02-COMPOUND-JOURNAL | Separate boost, salvage, grant, destruction, and per-owner custody movements within compound actions; reconcile each logical step and transaction completion. |
| C02-ESCROW-DISPOSITIONS | Market/loan sale, take, refund, death/loot release; poker/racing/stake win, refund, rake, and death branches. |
| C02-FAMILY-TREASURY | Cash/OMR tribute, reserve, war spoils, turf stake/refund/burn, and dissolution of treasury/reserve/ammo. |
| C02-NFT-CHAIN | Paid rarity upgrade, extraction, expiry, return/import, and backing; an eligible item cannot be simultaneously usable on-chain and in game. |
| C02-SHIPMENT-MATERIAL | Capped shipment creation, cash/material consumption, and exactly one bespoke serial; boundary-time and replay attempts do not bypass caps. |

Run movement checks after each committed command and worker transition, and record
internal logical movements for compound transactions. Under concurrency, use a
consistent database snapshot or committed event boundary; overlapping reads must not
produce fictitious drift. Also run complete canonical invariants at checkpoints and
at completion. Aborted transactions must leave no committed balance or movement.

Exercise success, rejection, duplicate, concurrent duplicate, lost response, restart,
expiry, ownership change, and relevant terminal branches. Inject failure between
material debit/output creation and between custody release/reward application.

Reuse existing ledgers and receipts; add only narrowly scoped instrumentation where
evidence is missing. Test journals must not become a new economy or financial authority.
Intentionally nonmonetary outcomes need state assertions, not invented rewards.

For enabled contract paths, combine native game tests with local-chain/Foundry or
pinned-fork execution and read-only deployed configuration/backing attestation.
For deliberately disabled rails, prove server-side denial and inventory their
inapplicability to this deployment; disabling a required RC1 path to avoid a failure
does not satisfy the gate. Do not introduce new blockchain mechanics.

Acceptance: every in-scope transition and terminal branch has retained execution
evidence; nonzero resource cases actually ran; zero unexplained drift, duplicate value,
missing disposition, or unclassified coverage gap remains.

### RC1-03: complete the world matrix and detect dead worlds

Run all five populations: **25, 100, 250, 500, and 1,000**. Run each population against
all fifteen archetypes below with **three fixed seeds**: 75 cells, 225 canonical runs.
These are full-game PostgreSQL runs, not Director-model analogues.

Freeze an explicit scenario manifest before running the matrix. The percentages below
are proposed fixture/policy settings, not changes to game rules. Use supported
canonical parameters; where a setting is impossible under current invariants, use the
nearest valid extreme and record why rather than corrupting the starting state.

| Archetype | Required distinguishing workload |
| --- | --- |
| Quiet world | 10% daily active actors; remaining actors absent; scarce coordination must remain observable and recoverable. |
| High aggression | 70% of eligible policy choices prefer conflict; losses, replacement characters, retaliation, and recovery are exercised. |
| Family monopoly | One Family starts with 80% of joinable actors and the largest legal resource position; outsiders attempt natural entry/progression. |
| Fragmented Families | At least ten small Families where population/formation rules permit; no Family exceeds 20% of actors. |
| Resource scarcity | Lowest valid initial resource supply; actors consume contested prerequisites and test their canonical replenishment paths. |
| Resource abundance | High but legally valid initial supply; sustained spending, hoarding, concentration, and sink behavior. |
| High player churn | 30% of active actors leave per simulated week and are replaced by new entrants; commitments and custody survive departure. |
| Mostly new players | 90% start without earned progression, privileged roles, or discovered Knowledge. |
| Mostly veteran players | 90% have valid recorded progression fixtures; remaining newcomers must still find viable progression. |
| Coordinated alliance | At least three Families coordinate through actual sharing and participation permissions. |
| Multi-Family war | At least three opposing Families contest overlapping scarce objectives through canonical actions. |
| High mystery participation | 70% of eligible choices pursue investigation; evidence/items and Knowledge propagation become contested. |
| Low mystery participation | At most 5% of eligible choices pursue investigation; neglected dependencies and later entrants are exercised. |
| Market stress | Concurrent posting, taking, refund, expiry, and escrow settlement against shared assets. |
| Law pressure | Sustained canonical Heat/Law pressure, detention/loss where applicable, and legal recovery/progression paths. |

Each run covers at least **90 simulated days**, **two applicable seasonal rollovers**,
and **two executions of the longest relevant lifecycle**, whichever requires more
logical time. Continue longer when concentration, backlog, or reachability has not
stabilized. Fast-forwarding time must execute due work through the same authority and
ordering guarantees as production; skipped worker intervals are missing coverage.

Additionally run a **12-hour real-time soak** with 1,000 distinct actors on a recorded
production-equivalent resource envelope. At least 250 actors remain active per hour;
include a 100-in-flight-request burst, shared-object contention, reconnect storms,
worker interruption, database reconnect, and server restart. Report intended request
arrival rate, queued time, and completed rate so slow responses cannot hide load.
Every actor must participate in the workload; five fixture actors do not represent
a 1,000-player conflict.

Record time series, per-player distributions, and final totals for every requested
metric: meaningful actions; generated/accepted/ignored opportunities; created/completed/
failed campaigns; coordination participation; resource velocity; inventory and Family
concentration; deadlocked campaigns; orphaned operations; unreachable objectives;
Knowledge distribution; inactivity; reward concentration; world/database growth;
command latency. Exclude reads, telemetry, invalid attempts, and replays from meaningful
action counts. Define ignored opportunities by expiration or an explicit observation
window, not by counting opportunities a player was never authorized to see.

Dead-world assertions must detect:

- No meaningful path for an eligible new or returning player, distinguishing legal
  temporary waits from a prerequisite that can never be satisfied.
- Required resources exhausted without an existing reachable replenishment path.
- Dependency cycles/deadlocks, orphaned operations, impossible mysteries, or thresholds
  that remain unreachable after all canonical expiry/recovery paths have run.
- Permanent progression exclusion by one Family, or required Knowledge with no valid
  acquisition/propagation path available to the intended actors.
- Growing unresolved worker backlog or live-state orphans across successive lifecycle
  windows. Legitimate append-only history growth is measured separately.

On failure, retain the first failing checkpoint and reduce population, events, and
time windows while preserving the assertion. Emit the smallest reproduction achieved,
its seed, source/configuration, event ordering, resource journal, and replay command.
Do not claim mathematical minimality. Do not insert arbitrary grants or force statuses
to keep the run alive; repair the reproduced systemic cause and rerun the affected
cells plus the complete final matrix on the qualified source.

Proposed load targets: read p95 at most 500ms; authoritative command p95 at most 1.5s
and p99 at most 3s; unexpected 5xx/timeout rate below 0.1% outside deliberate faults.
External wallet/provider time is measured separately. Intended denials and injected
outages stay visible in their own counters. Recovery clears due-work backlog within
two normal scheduling periods after service restoration, or the documented larger
canonical recovery deadline established before the run.

Acceptance: all 225 runs and the soak complete; zero conservation/authorization/state
invariant failures; zero unresolved dead worlds; every required metric retained; no
coverage exclusions contradict the required matrix. Finite simulation is empirical
release evidence, not a mathematical proof of every possible future world.

### RC1-04: close command, authorization, and replay coverage

Generate a reviewed inventory of command families and all authoritative HTTP mutation
routes from the selected source. Cover legacy routes as well as Player Commands.
Map every important mutation to its authoritative cost, prerequisites, participants,
targets, effect, reward, idempotency identity, and denial behavior.

For each applicable command family, exercise sequential/concurrent duplicates, timeout
and successful retries, restart replay, changed cost/prerequisites/participants/target/
reward expectations, expiration, intervening world changes, and unauthorized callers.
Rejected tampering must leave all authoritative state unchanged. An authorized retry
must reproduce the committed result without creating another effect.

Cross direct API attacks with unauthenticated/new/ordinary players; Crew member/leader;
Family member/leadership; operation participant/nonparticipant; allies/enemies; partial,
stale, and revoked Knowledge. Probe known IDs for hidden opportunities, nodes, private
relationships/membership, evidence, mystery state, Family intelligence, inventory,
campaign state, consequences, metadata, and authorization predicates. Include list,
detail, error, export, notification, and stale client paths where present.

Retain parameter, role-escalation, injection, serialization, XSS/CSRF where applicable,
rate-limit, oversized-payload, and resource-exhaustion regressions. Shared cache or
client hiding cannot substitute for server authorization. Security changes follow
`omerta-contracts/SECURITY-REVIEW-POLICY.md` at the pinned source and deployment phase.

Acceptance: complete reviewed route/command coverage; no critical disclosure, IDOR,
privilege escalation, unauthorized mutation/economic benefit, or duplicate value.
All previously confirmed repairs remain protected by passing regression tests.

### RC1-05: finish mobile and golden-player proof

Reuse the existing phone, campaign, social-entry, and lost-response harnesses. Add
missing cases through actual controls without forced clicks, hidden DOM removal, or
privileged fixture actions disguised as normal player behavior.

Run browser checks at widths 320, 360, 390, and 430, with representative short/tall
heights. Validate at least one physical iPhone/Safari and one physical Android/Chrome;
record device, OS, browser, and enabled wallet/account provider versions. Viewport
emulation does not prove native keyboard, deep-link, or external-wallet behavior.

Cover Command Center, City, Empire, Family, Market, Intel, inventory, crafting,
mysteries, operations, campaigns, opportunities, navigation, modals, account/wallet,
and critical confirmations. Exercise empty/loading/error states, 750ms network
latency, lost committed responses, reconnect, double tap, back navigation, maximum
supported names, overlapping dialogs, keyboard open/close, and interrupted wallet
handoff. Critical touch controls must have at least 44-by-44 CSS-pixel hit areas and
remain reachable without horizontal scrolling, focus loss, or a scroll trap.

For inventory, Family, and opportunity stress, use legal populations at both measured
simulation p95 and the supported maximum; if no maximum exists, record an explicit
stress count and prove pagination/bounded rendering beyond the first page. Do not
claim unlimited-list coverage from a small fixture.

Retain end-to-end evidence for every golden journey:

| Journey | Required result |
| --- | --- |
| A: new player | Entry, understandable immediate objective, first meaningful action, visible consequence, and next objective without external documentation or privileged grants. |
| B: returning player | After actual intervening changes: what happened, what matters, threats/social activity, and an available next action. Reload alone is insufficient. |
| C: social player | Ordinary actor discovers need, joins through the normal request/approval flow, contributes, sees others contribute, reaches threshold, and observes the shared outcome. |
| D: investigation | Evidence acquisition/combination, incomplete Knowledge, required item/relationship acquisition, and visible mystery progression. |
| E: Family conflict | Two Families contest one scarce objective, receive only authorized facts, change canonical state, and reach a terminal result without administrator resolution. |

For every major action family, verify a visible receipt/state update explains what
happened, why, what changed, and what is newly possible or blocked. Include failure,
loss, expiry, and replay outcomes. A successful response with no intelligible
consequence does not pass.

Acceptance: automated journeys and critical physical-device paths pass; remaining
human comprehension/return evidence is supplied by RC1-07. Fix repeated confusion with
the smallest contextual copy or interaction repair supported by observed failures.

### RC1-06: attest deployment, observability, and recovery

Select the actual controlled environment, database, service owner, integration scope,
and testers. The previous assessment did not select a Render workspace or deploy a
cohort. Workspace selection and access must be supplied by the operator; automated
fixtures cannot fill these inputs. Record identities of secrets/configuration sources,
not secret values.

Deploy the selected candidate to an isolated, access-controlled environment using the
existing runbook and invitation/cohort controls. Verify API and worker SHA/configuration
agreement, migrations, PostgreSQL extensions, singleton worker assumptions, schedules,
flags, content hashes, contract network/addresses/code/configuration where enabled,
account/wallet callbacks, health, and persistent receipts. Prove uninvited direct API
access cannot enter gated gameplay. Do not enable dormant rails to expand this release.

Correlate request, authorization, command, mutation, consequence, opportunity update,
and response. Verify private diagnostics for command failures, campaign generation/
transitions, opportunity generation/acceptance, operation lifecycle, World Graph,
Knowledge propagation, inventory, conservation, workers, database recovery, and
unexpected exceptions. Add only missing instrumentation. Test alert delivery to the
actual operator and verify secrets/restricted Knowledge do not enter unsafe logs.

Rehearse fresh bootstrap, representative existing-schema migration, partial failure,
retry, restart, connection loss, worker interruption, transaction rollback, Linux
SIGTERM during writes, replay, and reconstruction of campaigns, operations, inventory,
Knowledge, Player Commands, and World Graph. Reconcile state and conservation after
each recovery. Use the deployment's actual predecessor for a code rollback rehearsal
and a separate restored database for backup verification; compare canonical hashes.

Every administrative recovery records actor, time, incident/correlation ID, reason,
before/after hashes, affected receipts, action, and conservation result. Exercise stuck
campaign/operation, bad opportunity/content/mystery, worker/migration failure, and bad
world mutation recovery without silent balance edits or bypassing canonical authority.

Proposed operational target: restore the controlled environment and pass its smoke,
receipt-replay, and invariant checks within 30 minutes. No acknowledged write may
disappear through process restart or code rollback. State the measured backup recovery
point separately; restoring a snapshot can lose later writes and must not be described
as zero-loss recovery. Never overwrite a live database as part of a rehearsal.

Acceptance: deployment-specific attestation, delivered alerts, passing recovery drills,
tested rollback source pair, and observable recovery procedures. Live state is verified,
not inferred from committed environment templates.

### RC1-07: run a controlled real-player cohort

Before admission, all technical safety gates must pass and no known P0/P1 may remain.
Then run an invite-only cohort of at least **30 real participants for seven consecutive
days**, including **20 unfamiliar players**, **10 mobile-first participants**, and at
least **two competing Families with five real participants each**. Groups may overlap.
If recruitment or natural progression is insufficient, extend the observation period;
do not count bots, seeded accounts, administrator intervention, or reloads as people,
earned progression, or return sessions.

Observe the first 15 minutes of the 20 unfamiliar players with their consent. Provide
no external gameplay instructions or developer coaching; record assistance separately.
At each important screen ask what is happening, why it matters, what they can do,
what the action will do, and what changed. Measure behavior before offering help.

Proposed cohort acceptance targets:

- At least 16 of 20 unfamiliar players perform a meaningful action within five minutes;
  at least 18 of 20 do so within fifteen minutes without coaching.
- At least 18 of 20 can identify their action's consequence and a valid next objective.
- Journeys A-E each have at least three independent real completions; social/conflict
  journeys include actual contributions from both sides and canonical resolution.
- At least ten participants voluntarily return in a later-day session. Report day-one
  and day-seven return rates with eligible denominators; extend collection until the
  observation window exists rather than labeling missing data zero.
- All critical physical-device paths pass. A repeated blocking interaction affecting
  three eligible participants or more than 10% of at least 20 attempts is P1 until fixed.
- Zero unresolved P0/P1; no unauthorized Knowledge/economic benefit, duplication,
  unrecoverable world state, or critical action requiring desktop.

Instrument session completion, first-action time, abandonment, command failure,
opportunity engagement, campaign/coordination participation, return sessions, errors,
latency, mobile failures, and confusing dead ends. Publish denominators, eligibility,
sample sizes, versions, and missing data for every rate. Minimize personal data; retain
consented recordings and private events in restricted storage, with only redacted
summaries in the release package.

P0 covers unauthorized value/state/Knowledge compromise or unrecoverable corruption.
P1 covers unavailable critical journeys, persistent dead worlds, failed recovery, or
repeated major consequence/comprehension failures. Reproduce and classify each finding;
an individual preference is not a redesign mandate. After a repair, rerun its technical
gates and affected human journey. Require at least 72 consecutive hours on the final
candidate without an unresolved P0/P1 before qualification; extend the cohort as needed.

### RC1-08: qualify and preserve one final release

From the clean final candidate, run every existing critical CI lane and the required
release gates: `npm test`, real PostgreSQL integrations, `pgquery`, `pgcheck`, definition
registry, Knowledge graph/artifacts, World Graph/content, invariants, simulation,
migrations, routes/frontend/browser/mobile, and full-budget Foundry tests. Resolve exact
commands from the selected package/workflows; do not delete lanes or weaken budgets.
Run final required matrix, resource, replay/security, recovery, and journey checks.

Any source/configuration change after a run invalidates affected evidence. For an
unaffected retained run, document byte/dependency equivalence explicitly; never
rewrite its actual SHA. No pending, skipped, model-only, fixture-only, or environment-
blocked result may count as a required native, human, or deployed pass.

Use a new evidence directory keyed by candidate/run identity; preserve the sealed
earlier package unchanged. Deliver:

- Updated release/candidate manifest and source-reconciliation report.
- Gate report with exact commands, exit codes, SHA/configuration, failure classes,
  reproduction instructions, repairs, and retest links.
- Complete simulation matrix, metrics/time series, transition coverage, conservation
  journals, checkpoint/replay artifacts, and minimized failure histories.
- Security findings, mobile/device matrix, golden journeys, first-session/cohort
  results, deployed configuration attestation, diagnostics and recovery proof.
- Deployment/rollback runbook, known nonblocking defects with owner and rationale,
  SHA256 evidence index, working verifier, and final release report.

Use the existing A-E failure classifications: RC blocker, nonblocking defect, stale
test, tooling defect, environment defect. A stale test requires evidence of conflict
with canonical behavior; an inconvenient failure is not proof that the test is stale.
An environment failure remains an unmet release gate until the required test runs.

The final report must contain exactly one final state. Emit **RELEASE READY** only if
every required gate has qualifying evidence and the controlled cohort has no unresolved
P0/P1. Tag the exact qualified source as the RC1 candidate and preserve the evidence.
Public admission is a separate controlled operator step after that decision.

Otherwise emit **NOT RELEASE READY**, listing only actual open defects or unmet required
proofs, each with evidence, reproduction or missing input, responsible owner, and
affected reruns. Do not propose new gameplay features as substitutes for closure.

## 4. Execution order and completion rule

Start with source reconciliation and the proof harness. Complete conservation coverage
before counting matrix results. Authority/replay and mobile work can proceed in parallel
against pinned source. Provision and rehearse the controlled environment while technical
proof runs; admit real players only after the technical safety gate. Finish with real
cohort evidence, final-candidate regression, and the release decision.

Continue all independent engineering work while operator inputs or recruitment are
pending. Required external inputs are the selected deployment/workspace, service and
integration access, named operator, real participants, and physical test devices.
Never invent those inputs or substitute synthetic evidence for them.

The implementation is complete when the four original blockers are closed with the
specified evidence and the integrated source satisfies every original launch gate.
Passing the old scoped tests, increasing a model's population, writing this document,
or documenting a missing proof does not by itself complete the release milestone.
