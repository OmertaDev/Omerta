# RC1 release decision

**BLOCKED — do not admit the first real-player cohort.** The required solo
journey cannot reach its first world consequence under the existing Family and
Crew authority rules. Complete mobile stories and sustained population campaign
evidence also remain incomplete. Passing integrity tests do not override these
failed or unproved release gates.

Decision recorded 2026-09-20. This is a completed validation package with a
blocked decision, not completion of the READY_FOR_COHORT milestone.

## Exact source and environment

- Frozen main: `626e61b9ab2b14a9dc45566983b70cdc65692839`.
- Corrected source tested by full hosted CI and Linux recovery:
  `f31b5290080506f6407a9b7f9a514e2ea020a9d4`.
- Final package commits add evidence, reports, generated knowledge artifacts
  and supplemental harness corrections. No production code changed after the
  corrected source above. Individual tests retain their original provenance.
- [Immutable manifest](RC1-MANIFEST.md): schema, content/Situation hashes,
  definitions, Director configuration, dependencies, contract settings and flags.
- Hosted application/recovery: clean Ubuntu, Node 22.23.2, PostgreSQL 16.15.
  Liquidity: PostgreSQL 18. Foundry 1.7.1, Solidity 0.8.26, pinned dependencies.
- Local supplemental evidence: Windows, Node 24.19.0, PostgreSQL 18.4,
  Chromium 153.0.8010.48. Mobile results are viewport/touch emulation, not
  physical-device or Safari/WebKit results.

The [source comparison](evidence/gates/source-comparison.json) checks all 370
frozen manifest entries. Contracts, schema, economic rules, item/crafting logic,
Director, Coordination and World Kernel authority are unchanged. No production
account, database, deployment or feature flag was modified.

## Automated gate results

| Gate | Result and exact evidence |
| --- | --- |
| Frozen-main clean reproduction | **PASS**, [CI 35406507577](https://github.com/OmertaDev/Omerta/actions/runs/35406507577) at `626e61b9` |
| Corrected full application suite | **PASS**, [CI 35408648650](https://github.com/OmertaDev/Omerta/actions/runs/35408648650) at `f31b5290`; full npm lifecycle, RC1 regressions, economy simulation, scale, invite and browser/mobile gates |
| Real PostgreSQL, migrations and SQL | **PASS**, same corrected CI: 4,061 static statements, fresh/historical migrations, Coordination/Knowledge, Kernel, custody, crafting, commands, Director, campaigns and backup/restore |
| Concurrency and interruption | **PASS**, same corrected CI: concurrent players, exact-once receipts, escrow races, killed backends, torn transfers, chaos and ledger checks |
| Contracts | **PASS**, [Foundry 35406508964](https://github.com/OmertaDev/Omerta/actions/runs/35406508964): 1,247 tests, 82 suites, zero failed/skipped at frozen main; contract sources unchanged |
| Liquidity recovery | **PASS**, [35406510710](https://github.com/OmertaDev/Omerta/actions/runs/35406510710) at frozen main; relevant implementation unchanged |
| Linux SIGTERM and restart | **PASS**, [35408617560](https://github.com/OmertaDev/Omerta/actions/runs/35408617560) at corrected source: nine production-process SQL barriers, rollback/drain, receipt replay and state/inventory integrity |
| Native population simulation | **16/16 scoped runs PASS; RELEASE GATE INCOMPLETE**. Four sizes, two seeds, two replicates, 23,557 command completions and 880 invariant evaluations; includes one successful environmental retest. [Simulation report](RC1-SIMULATION-REPORT.md) |
| Golden player stories | **BLOCKED / PARTIAL**. Domain branches pass; fresh solo story fails. [Player report](RC1-PLAYER-VALIDATION.md) identifies A–G coverage and gaps |
| Mobile | Existing **175 screen checks PASS**; invite browser **PASS**; **10/10 fixture-assisted campaign/viewport scenarios PASS**, 514 rendered commands at 320/390. Full A–G and all interruption modes remain **unproved** |
| Adversarial execution | Covered native command/Knowledge/membership/replay/worker/custody cases **PASS**; not every requested browser race or population attack ran. [Security report](RC1-SECURITY-OPERATIONS.md) |

The [machine-readable gate index](evidence/gates/INDEX.json) retains run IDs,
revisions and per-step outcomes. Raw logs are adjacent. The interrupted local
Windows full-suite run has no recorded completion and is **ENVIRONMENTAL /
INCOMPLETE**, not a pass; both clean hosted full-suite runs passed.

The complete domain loop is demonstrated by `test/campaign-network-journey.js`
in both the memory and native CI lanes: canonical shipment state enables a
Director selection; Knowledge, preparation and Family coordination produce an
issued interception command; its consequence diverts the shipment; that
physical state starts a distinct market campaign; establishment and exposure
then create an Informant campaign requiring independent corroboration. All
three campaigns complete, five canonical events remain after restart/replay,
and custody/Kernel invariants pass. This proves the connected service loop for
seeded participants. It does not cure the failed new-solo player journey.

## Release blockers and reproduction

### SOLO-WORLD-AUTHORITY — P0 progression dead end

Run `node tools/rc1-mobile-journeys.js` with Chromium available. At both 320px
and 390px, a genuinely new account completes onboarding, discovery, travel,
vehicle acquisition, salvage and archive-key crafting. It holds the key and
wire at the Foundry. `open_archive` remains LOCKED because `src/world-kernel.js`
requires boss/underboss authority and an eligible same-Family Crew. No solo
canonical world consequence or related follow-up occurs.

Evidence: [mobile results](evidence/player/mobile/results.json) and adjacent
`solo-ready-equipment-world-gate` screenshots. This is **KNOWN BASELINE /
RELEASE BLOCKER**. Do not replace this new account with a seeded Family leader
or weaken the assertion. A release needs an explicitly authorized solo
progression path; this package adds no blanket authority bypass or subsystem.

### PLAYER-FOLLOWUP — required campaign loop not demonstrated

Run `node test/rc1-journeys.js` and its `--postgres` variant. Recovery,
destruction, secured-records, disputed-allegation and unresolved-concern
branches preserve canonical history and uncertainty. Four subsequent Director
ticks produce zero consequence-linked opportunities and zero new selections
for these branches. The three cards after recovery/destruction are existing
Dock War business. This does not prove a permanent deadlock; it fails to
demonstrate the required outcome-to-new-business loop for those branches.
Inspect `opportunityIds`, `newOpportunities` and `downstreamSelections` in the
[branch evidence](evidence/player/rc1-branches.json).

### MOBILE-B-G — hard mobile/story coverage incomplete

Run `node tools/rc1-campaign-mobile.js` against disposable PostgreSQL.
Supplemental scenarios exercise rendered commands and consequences, but initial
social/world setup and acquisition use domain fixtures. They do not prove
complete new-player Crew/Family formation, every Shipment and Informant branch,
or a single Dock War-to-Campaign Network browser story.

The solo harness exercises slow replies, repeated taps, response loss and
reload recovery. Expired/stale mobile opportunities, membership changes across
tabs, background/foreground transitions and operation connection loss are not
all covered as browser stories. Failed attempts remain in
[player evidence](evidence/player/). Native assertions do not substitute for
these missing experiments.

### SIMULATION-COVERAGE — hard population scope incomplete

Run the matrix in [RC1-SIMULATION-REPORT.md](RC1-SIMULATION-REPORT.md).
Population commands are sequential, with a duplicate-execution burst; five
designated actors drive campaign operations. This does not establish sustained
1,000-player contention, independent Crew/Family campaigns, long-term
starvation/repetition or absence of irreversible engine-caused dead ends across
all branches. OMR paths are inactive, so economic/contract gates supply
separate evidence. The explicit `notMeasured` fields remain open.

## Corrections, known issues and telemetry

Only demonstrated P1 presentation/observability failures were corrected:
disclosed archive-key acquisition guidance, understandable evidence outcomes,
and the missing eight-stage player funnel. Initial telemetry rate-limit and
confirmation failures were **NEW REGRESSIONS**, fixed and retested. A legacy
screen-beacon confirmation cancellation was **KNOWN BASELINE**, fixed and
retested. No failed assertion was removed to obtain a pass. Harness setup/locator
failures and local PostgreSQL schema-cleanup lock exhaustion are retained and
classified separately from product defects.

Authenticated presentation observations are bounded and untrusted. The
moderator-only `/v1/mod/release-funnel` reports the ordered stages from login
through a distinct return session, command/rejection counts and canonical
operation, campaign, Knowledge, crafting, resource-event and consequence counts.
It exposes truncation, dropped writes and undercount. It never influences
authorization or Director selection. Native tests verify telemetry cannot
delay a committed command or grant permission.

The [first-session audit](RC1-PLAYER-VALIDATION.md) and
[opportunity review](RC1-OPPORTUNITY-QUALITY.md) are source-guided automated and
heuristic evidence. They do not establish unfamiliar-player comprehension,
enjoyment, session length or return rate. Generic prerequisite labels and dense
boards need player observation. Nonblocking expansion and polish items are in
[the post-launch backlog](RC1-POST-LAUNCH-BACKLOG.md).

## Migration, rollback and feature flags

No schema migration or signed economic parameter changes were introduced.
Fresh/historical PostgreSQL migration and backup/restore gates pass. Actual
deployed schema stamps, credentials, alarm delivery and live backup state have
not been attested by this local package.

Rollback procedure, following `DEPLOY.md` section 8c:

1. Stop admission/expansion and disable Director exposure. Retain the database,
   receipts and logs; identify both deployed revisions.
2. Drain the API and stop its worker. Deploy the same previously verified
   revision to both services with the existing environment. Frozen `626e61b9`
   is the verified baseline for this validation environment; this does not
   establish the current live production revision.
3. Check health, schema stamp, worker heartbeat and ledger/custody invariants.
   Retry recoverable work using its original identity. Do not mint replacement
   rewards or rewrite history without reconciliation.
4. Code rollback retains committed consequences. Restore a backup only through
   the established outage procedure, accounting for commits after that backup.
   Reopen admission only after the failed gate is resolved.

Repository defaults keep Director/foundation exposure disabled. After remaining
gates pass, use `LIMITED_COHORT`, identical nonempty `DIRECTOR_ACCOUNT_IDS` and
`COORDINATION_ACCOUNT_IDS`, the six existing foundation flags on and invite
admission on. Liquidity automation stays off; chain RPC and signer inputs remain
absent. No cohort, chain function or live flag has been enabled.

After internal validation, observe 10, 25, 50 and 100 admitted players before
expanding. Review activation, first command/consequence, second opportunity,
Crew/Family participation, completion/abandonment, errors and support questions.
Collect whether players understand what changed and what they can do next.
There is no traffic-based exception to a failed hard gate.

See [reproduction and package instructions](RC1-REPRODUCE.md).

RC1_STATUS=BLOCKED
