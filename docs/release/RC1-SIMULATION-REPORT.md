# RC1 simulation and conservation evidence

Frozen source: `626e61b9ab2b14a9dc45566983b70cdc65692839`.
Candidate source snapshot after the documented repairs:
`4d35c8e8b3a1db696f1bf5b5e8b7b0dc327cecb1`.
Phase: RC1 closure, isolated local verification; no deployment or public traffic.
Evidence directory: [`evidence/simulation/`](evidence/simulation/).

This report distinguishes a modeled Director frontier from the real game. A
passing model is not PostgreSQL, custody, security, cohort, or equilibrium proof.

## Baseline revalidation

| Command | Result | Evidence | Scope |
| --- | --- | --- | --- |
| `npm run sim` | PASS, exit 0 | `baseline-sim.log` | Existing API economy probe using pg-mem; final conservation only. |
| `$env:SCALE_PLAYERS='18'; $env:SCALE_DAYS='2'; npm run scale` | PASS, exit 0 | `baseline-scale.log` | 18-player, two-day pg-mem population probe; all nine driven markets posted; 55 invariant drift deltas unchanged. |
| `npm run invariants` | PASS, exit 0 | `baseline-invariants.log` | Fresh pg-mem bootstrap, 55 production invariant checks. |
| `node test/director-simulation.js` | PASS, exit 0 | `baseline-director-test.log` | Existing deterministic model regression. |
| `npm run director:sim -- --output docs/release/evidence/simulation/baseline-director.json` | PASS, exit 0 | `baseline-director.log`, `baseline-director.json` | 13 model scenarios, snapshots at 1/7/30/180 days. |

No historical result was substituted for these runs.

## Failed gates and narrowly scoped repairs

**RC1-SIM-TOOL-01 — D, tooling defect, repaired.** `tools/scale.js` documented
real PostgreSQL support but unconditionally set `SEASON_MOD` and `SEASON_PHASE`.
Production preflight correctly refused to boot. Reproduce the original failure
with a fresh local database, valid random `JWT_SECRET`, `DATABASE_URL`, and
`SCALE_PLAYERS=18 SCALE_DAYS=2 npm run scale`; see `postgres-scale-before.log`.
The repair pins these test seasons only for pg-mem. PostgreSQL uses the actual
production calendar. No production guard or gameplay invariant was weakened.

**RC1-SIM-TOOL-02 — D, tooling scope limitation.** `npm run sim` is explicitly a
pg-mem probe. Giving it `DATABASE_URL` fails preflight because the tool sets
`ALLOW_MOD_REAL_REVENUE`, `SEARCH_MS`, `SHOOT_CD_MS`, and season overrides.
See `postgres-sim.log`. Its synthetic revenue recording and timer compression
were not enabled in production mode. Real database evidence below comes from
separate production-compatible API probes.

**RC1-SIM-ENV-01 — E, corrected fixture configuration.** The first PostgreSQL
scale retry created 0/18 characters because closed admission was enabled.
See `postgres-scale-after.log`. The isolated market fixture must explicitly use
`INVITE_MODE=off`, as the existing pgcheck fixture already does. This does not
change release admission settings.

**RC1-SIM-PROOF-01 — required coverage was absent.** Existing scale and economy
tools checked conservation only at the end. Added optional
`SCALE_ASSERT_EACH_TRANSITION=on` checks after each API request and each population
worker invocation. It uses the same production invariant implementation and the
same existing seeded-fixture drift delta; no tolerance was widened.

The new `tools/rc1-command-population.js` uses real PostgreSQL, production HTTP
handlers, API-created accounts/characters, server-issued commands, exact replay,
and absolute production invariants after character creation and every command
and replay. It grants no value through SQL. The initial 25-player prototype
passed 6,985 assertions; `population25.json` records its narrower case-opening
policy. A failed first harness boot due to missing `MOD_KEY` is retained in
`population25-setup-failure.*` and was corrected by generating a local test key.

## Extended deterministic model

Command: `node tools/rc1-director-matrix.js`.

`director-population-matrix.json` runs the existing 13 admitted scenarios at
25, 100, 250, 500 and 1,000 modeled players, with seeds `rc1-director-a` and
`rc1-director-b`, each through 180 days. This is 130 runs and 520 period
snapshots. There were zero failed assertions. Every modeled operation now checks
both wire and seal conservation immediately. Production selection, pressure,
world-definition and operation-definition compilers remain in use.

The modeled population consists of synthetic actor observations. It does not
create database players or execute physical custody transactions. Each new
season supplies separate, explicitly synthetic pre-existing fixture scopes.
The model therefore does not prove resource renewal or economic equilibrium.
No new gameplay feature or world recovery reward was added.

## Production PostgreSQL population proof

Local disposable PostgreSQL endpoint: `127.0.0.1:55439`; engine version and runtime
are recorded in each JSON report. Each run requires a fresh `omerta_rc1_*`
database. The harness generates transient JWT/mod credentials locally and enables
the existing core progression/World Graph/Coordination flags. It disables invite
admission and request throttling only in its own test process.

Reproduction:

```powershell
$env:DATABASE_URL='postgres://postgres@127.0.0.1:55439/omerta_rc1_entry25'
node tools/rc1-command-population.js --players 25 --rounds 2 --output docs/release/evidence/simulation/entry25.json
```

Repeat with separate fresh databases and `--players 100`, `250`, `500`, and
`1000`. The 1,000-player report is `population1000.json`; the other final-policy
reports are `entry25.json`, `entry100.json`, `entry250.json`, and `entry500.json`.
The adjacent `*-transitions.ndjson` records the production checks and every
changed held/accounted balance. `before + accountedDelta = after` follows from
the unchanged production ledger identities at every recorded transition.

These are sequential entry/command/replay workloads, not a concurrent 1,000-user
load test. Their declared seed fixes actor policy and `Math.random`, not UUIDs,
database time or scheduling. The commands actually exercised, request latency,
database size, final checks and raw history are recorded instead of inferred.

The 1,000-player entry run passed on PostgreSQL 18.4: 8,000 requests, 2,000
successful discovery commands, 2,000 exact retries, 5,002 conservation sweeps and
275,110 invariant assertions. No sampled player lacked an available command.
Its sequential command/replay handler latency was p50 60.2 ms, p95 96.1 ms,
maximum 365.5 ms; these measurements exclude network transit and the subsequent
invariant sweep. Final database size was 57,546,431 bytes. These are observed
local measurements under concurrent test load, not a production capacity claim.
All five entry populations passed. Together they exercise 1,875 API-created
players, 15,000 requests, 3,750 commands and 3,750 exact retries, with 516,175
invariant assertions across 9,385 sweeps. Only `discovery.start` and
`discovery.act` are claimed by this entry policy.

## Native social, inventory and campaign execution

`tools/rc1-sim.js` and its corruption-detection regression were adapted from the
pre-existing `36156ace3f4e4600badc8394a205d0e10432d227` branch. Only test harness
code was reused; no historical evidence or production-source changes from that
branch were imported. Its shared fixture helpers are identical to frozen main.
The regression (`node test/rc1-simulation.js`) passes against this candidate.

Fresh execution:

```powershell
$env:COORDINATION_TEST_DATABASE_URL='postgres://postgres@127.0.0.1:55439/omerta_rc1_sim'
node tools/rc1-sim.js --postgres --populations=25 --seeds=rc1-alpha,rc1-beta --replicates=1 --rounds=2 --output=docs/release/evidence/simulation/native
node tools/rc1-sim.js --postgres --populations=1000 --seeds=rc1-alpha --replicates=1 --rounds=2 --output=docs/release/evidence/simulation/native1000
node tools/rc1-sim.js --postgres --populations=100,250,500 --seeds=rc1-alpha --replicates=1 --rounds=2 --output=docs/release/evidence/simulation/native-mid
```

Both 25-player seeds passed. Alpha executes 109 commands and 6,985 invariant
assertions; beta executes 136 commands and 8,800 assertions. Together they create
ten physical items, consume eight, grant 153 stack units and consume 54. The beta
run performs shipment interception, market establishment and market exposure,
completing two campaigns. Both reject unauthorized foreign commands and stale
commands, protect private Knowledge, prove authorized Knowledge sharing, expire
an abandoned operation, issue a concurrent duplicate operation execute, and
verify durable replay. Recreating the Director in the same process replays the
persisted tick without another world mutation; process-kill recovery is a
separate gate.
Seeds reproduce roster/policy selection; native UUIDs, persisted resolution seeds
and wall-clock timestamps are not fixed. These runs therefore do not claim
bit-for-bit deterministic whole-game replay.

The 1,000-player run starts from the candidate source snapshot above. Its result
and measured metrics are retained in `native1000/summary.json`.
It passed with 3,559 successful commands, 154 durable replays, and 235,895
invariant assertions over 4,289 sweeps. There were 1,225 Knowledge privacy probes
and zero unauthorized disclosures, 230 authorized shares, 117 Families and
117 Crews. It completed one campaign and three canonical world changes with
zero duplicated consequences. There were two actual operation participants;
the other actors are not claimed as participants in that conflict. All sampled
visits had an available command. The run took 868.7 seconds on the shared local
test host and did not measure sustained concurrent production load.

All five native population sizes passed. The 100-, 250- and 500-player alpha runs
execute 375, 898 and 1,789 commands and 24,640, 59,510 and 118,525 invariant
assertions respectively. Each completes one campaign. The six native runs
(including both 25-player seeds) total 6,866 commands and 454,355 invariant
assertions. Their complete metrics remain in `native/`, `native-mid/`, and
`native1000/` rather than being merged into a fictitious single world.

These native fixtures give characters a declared initial cash balance of
$100,000 to reach the systems. The exact initial cash drift is asserted as
`population * (100000 - 500)`, then must stay unchanged. Other invariant baselines
must pass absolutely. Materials and items are acquired through production
boost/salvage/craft authorities; no item stock is inserted directly. Five fixture
actors conduct the authored world conflict, while other roster actors exercise
their explicit policies. They are not falsely counted as operation participants.

Conservation runs after every issued/rejected/replayed Player Command and
Director tick, and after compound social/material fixture calls. A compound
fixture helper's internal steps are not individually instrumented by this
harness; that remaining scope is recorded in `notMeasured`. The original
`harnessSha256` field hashes `JSON.stringify(sourceText)`; true file-byte hashes
are recorded separately in this package's `run-summary.json`.

## Conservation scope

The machine-readable [resource/transition table](evidence/simulation/resource-transition-coverage.json)
maps all 13 requested resource categories to the **55 actual invariant names**,
retained entry journals, native event aggregates and pinned source definitions.
It lists one read-only inspection command for each concrete proof gap.

Excluding bootstrap observations, all five entry journals record exactly 1,875
new-character cash grants totaling **937,500 cash** and 1,875 ammunition grants
totaling **46,875 units**. Their actual and accounted deltas match exactly. No
other balance changed in those journals. This does not turn zero issue counts
into evidence of an exercised material transition: stack, unique custody,
operation and content checks report the number of reconciliation errors.

The native 1,000-player report records four unique items created, three consumed,
1,565 stack units created and 21 consumed. These real mutations passed production
checks, but the report retains aggregate event counts rather than each raw item
event and each owner's transfer amounts. Scale additionally proves 1,465 checked
API/worker boundaries and real market posts/takes, without a per-ledger-reason
coverage journal.

| Gap ID | Required transition evidence still missing in this simulation package |
| --- | --- |
| C02-OMR | Nonzero OMR movement, mint/burn, desk recycling and OMR pledge settlement; all six native reports contain zero OMR transactions. |
| C02-CAMPAIGN-CASH | Existing legacy street-campaign cash claim and duplicate-claim reconciliation (`campaign:reward`). |
| C02-OPERATION-CAPITAL | Operation capital deposit, refund, spend and forfeiture; the executed canal/dock definitions have no capital requirement. |
| C02-HARDENING | The existing hardening recipe's exact 300-cash sink and replay; native crafting chooses the cargo-seal recipe. |
| C02-COMPOUND-JOURNAL | Separate boost/salvage boundaries inside compound helpers, plus retained per-owner item/stack custody movement amounts. |
| C02-ESCROW-DISPOSITIONS | Branch-level evidence for market/loan refund, death/loot and other escrow terminal dispositions; aggregate posts/takes do not establish every branch. |
| C02-FAMILY-TREASURY | Existing tribute, war spoils, turf stake/refund/burn and dissolution balance transitions; creating Families is insufficient. |
| C02-NFT-CHAIN | Paid rarity upgrade, NFT extraction/expiry/import and deployed token-backing reconciliation; outside these local simulations. |
| C02-SHIPMENT-MATERIAL | Daily capped shipment material creation and bespoke commissioning consumption/output; the 55 check names contain no independent shipment-material quantity identity. |

Statuses distinguish a path absent from the scripted workloads from a movement
whose full journal was not retained. Neither status asserts an exploit. Separate
release suites may supply evidence for some paths; they are not credited here
without that evidence.

Current Campaign Network operations deliberately resolve world state without a
currency reward adapter. The missing cash reward proof is the separate legacy
street-campaign claim in `src/campaigns.js`, not a request to add monetary operation
rewards. Similarly, `src/season.js` explicitly makes reckoning pure status, with no
currency reset, seizure or reward. Season-dependent treasury/escrow actions map
to the Family resource gap. Retired emission, plex and portfolio invariants are
expected zero guards and must not be reactivated to achieve coverage.

The standard checks retain their existing numeric tolerances. Integer inventory
and provenance identities use exact equality. These tolerances were not changed.

## Dead-world interpretation and unresolved release proof

The existing model's `deadEnds=0` only means its situation lifecycle has a
terminal recovery path. It does **not** mean players can fund or complete it.
The baseline explicitly records three unfunded scopes in `economic_shortage`
and two in `new_world` after 180 days; the latter completes zero campaigns.
Quiet/abundant worlds generate no modeled Director conflict. These are truthful
fixture observations, not proven whole-game deadlocks: other game activities and
resource sources are outside this model. Reproduce with
`node tools/director-sim.js --output report.json` and inspect those rows.
The extended matrix has 70 snapshots with unfunded scopes; its smallest
enumerated case is seed `rc1-director-a`, 25 modeled players, `economic_shortage`,
day 1, with three unfunded scopes. `director-matrix-summary.json` retains its
resource arithmetic and receipt provenance hash. This is not a minimized
canonical-game event history and must not be reported as one.

The full requested 75-case **canonical PostgreSQL** stress matrix remains
unproven. In particular, neither a new/veteran mix, high churn, a coordinated
alliance, market stress, permanent Family monopoly, Knowledge propagation under
churn, nor cross-system unreachable prerequisites can be established from the
bounded model and the entry workload. The required world/database growth,
resource velocity, concentration, all-player inactivity, and full campaign/
operation equilibrium metrics also need that canonical workload.

This is a release-blocking missing proof, not a claimed exploit or a proposal
for a new gameplay system. `matrix-coverage.json` enumerates the exact requested
population/archetype cells and their evidence status. Passing component/model
checks must not clear those cells.

`blockers.json` supplies machine-readable reproductions for
`RC1-SIM-MATRIX-01` and `RC1-SIM-CONSERVATION-02`. The second now references the
nine concrete gaps above and their pinned-source/artifact inspection commands
in `resource-transition-coverage.json`. Mapping the gaps does not close them: the
required all-resource transition equation remains unproven for those paths.
Separate contract/deployment proofs may cover additional scope, but these
simulations do not claim it.

No native event history demonstrates a dead world or value-duplication exploit.
The smallest native cases contain two and five canonical world events, both
with zero visits lacking an available command. Their histories are retained in
`blockers.json` and the native reports. The modeled unfunded fixture is explicitly
separate from those native histories.

## Run completion

Final production run totals and file hashes are recorded in
`evidence/simulation/run-summary.json` after all local processes complete.
This scoped report does not make a public-release readiness claim.

All simulation processes completed successfully. A final source audit found one
later test-helper change: `test/lib/player-command-support.js` received an
optional browser-only retry hook at 23:20:28 UTC. The native processes had already
imported the candidate helper; their engines do not define the optional hook.
No simulation tool or reviewed production dependency changed from the tested
candidate. The run summary retains both helper hashes and the original native
source pin; it does not relabel these results as tests of a later commit.
