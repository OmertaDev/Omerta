# Original-worker logical schedule engine

Owner: Codex/native_harness. Native PostgreSQL proof tooling only. No production
source files are changed. This engine is a prerequisite for matrix evidence,
not a claim that 225 worlds, player policies, load, or deployed gates passed.

`tools/rc1-native-worker.js` pins the LF SHA256 of `src/worker.js` and `src/db.js`.
A test-process Node loader requires both complete source hashes and every exact
instrumentation site to match. The retained artifact contains original and
transformed source text, hashes, and the explicit edit map. Worker job bodies,
canonical pacing values, SQL deadlines, migrations, transaction behavior and
makeDb's pool/client error hooks stay in use.

The map binds only worker-local timer names, captures the four existing
fire-and-forget boot callbacks, observes each `safe()` job, and selects the
isolated-schema clock-enabled PostgreSQL pool. All timers from other modules,
including driver connection/statement watchdogs, remain native. Boot callbacks
are queued until registrations are complete and then awaited in their original
registration order. Subsequent worker callbacks run at every actual registered
deadline, ordered by registration identity when deadlines tie. Timeout chains
register their own next deadline. Watchdog registration, unref and clearing are
recorded; a completed main tick must leave no watchdog behind.

This is an explicit serial test schedule with zero logical callback duration.
Actual wall durations are retained. It does not simulate a hung callback's
elapsed logical time or prove production scheduler races. A native wall deadline
fails pending work and preserves evidence. The harness seals callback failures
instead of letting a boot acknowledgement terminate the test before recording.

Every guarded job records its returned result or thrown error. Unexpected
`safe()` failures and error logs fail the run even if production catches them.
Two local conditions are predeclared: PostgreSQL archiving is off (the actual
backup alarms are retained), and the external RWA registry is unavailable
(`health_registry_unavailable`). Health callbacks still execute at every
five-minute boundary and retain their fail-closed result. These do not count
as PITR or external health settlement coverage. Chain watching and liquidity
automation are unconfigured/disabled and explicitly excluded.

The initial fixture has one declared character with 500 cash and 10,000 respect.
Its season is the canonical current season. Initial and later full ledger
invariants must reconcile without subtracting fixture drift. After initialization,
all changes come from the real worker/makeDb. Canonical resident population is
enabled. No post-initialization database fixture updates are permitted.

The default 673 hours starts one hour before a true 28-day boundary and crosses
two actual seasonal rollovers. All hourly, Director five-minute, and health
five-minute callbacks must fire their exact expected counts. Full raw snapshots,
sequences, initial/first-rollover/final dumps, job results, timer history, random
draws, errors, and source bindings are retained. `--compare` requires exact initial
state, final state, guarded job outcomes, logical schedule and random-tape equality with a prior run
on the same source; it does not normalize away balances, visibility or outcomes.

```powershell
$env:COORDINATION_TEST_DATABASE_URL='postgres://postgres@127.0.0.1:55441/rc1_native_harness'
$env:RC1_PG_BIN='C:/Program Files/PostgreSQL/18/bin'
node test/rc1-native-worker-schedule.js
node test/rc1-native-worker-schedule.js --postgres --hours=2 --output=C:/Users/Jorge/.codex/rc1-native-evidence/worker-smoke-1
node test/rc1-native-worker-schedule.js --postgres --output=C:/Users/Jorge/.codex/rc1-native-evidence/worker-two-seasons-1
node test/rc1-native-worker-schedule.js --postgres --compare=C:/Users/Jorge/.codex/rc1-native-evidence/worker-two-seasons-1 --output=C:/Users/Jorge/.codex/rc1-native-evidence/worker-two-seasons-replay-1
```

Commit before every evidence run. Use a new restricted output path and preserve
failed attempts with their original source identity. Full process restart is a
separate comparison from uninterrupted replay.

`--resume=<retained run directory>` verifies the parent's complete artifact
index and source-pinned production map, restores its final custom-format dump
into its original isolated schema (refusing any existing schema), and verifies
the exact canonical hash before any new work. The clock factory explicitly
restores both SQL clocks; the raw default restore helper is still available for
ordinary checkpoints. The retained random tape is regenerated from seed and
counter, rejecting changed bytes, and restores each stream before new draws.
No fixture initialization is repeated. A newly imported original worker then
performs its real boot work and due callbacks. Restart boot effects, including
operational telemetry, are retained. There is no claim that restarting equals
an uninterrupted schedule; two fresh checkpoint continuations must agree exactly.
Parent source and continuation-tool source identities stay distinct.

The first full seed-only replay on source `7b630340` failed: PostgreSQL's
unordered JAILBIRDS `LIMIT 24` query changed the array indexed by seeded random
selection. The first divergence was at hour 2; balances and other semantic
values were not normalized away. `tools/rc1-native-query-order.js` records that
one exact SQL query, parameters, and returned order. The version 1 replay on
`8093e606` then failed closed at logical hour 134, occurrence 269: three of the
24 native candidate IDs changed. The sealed failure, raw candidate sets,
checkpoint and source binding are retained; the 673-hour observation remains a
separate scoped pass. Version 1 was not sufficient for a full worker replay.

Version 2 pins the complete `src/population.js` source and exact original SQL.
One PostgreSQL statement wraps the unchanged limited SELECT and the complete
eligible SELECT under identical predicates in scalar JSON aggregates. Both use
one statement snapshot, including an empty result. The eligible query retains
every character column as raw PostgreSQL JSON text, preserving numeric precision.
Observation returns the actual native limited result. Replay may select the
recorded subset/order only after the complete eligible row multiset matches
exactly, including every value and duplicate multiplicity. Both selected sets
must have `min(24, eligibleCount)` rows and belong to that eligible universe with
valid multiplicities. This records an unspecified database selection; no state
or resource values are substituted. Original/transformed SQL and hashes, source,
native arrivals and full eligible rows are retained. Version 1 tapes are refused.

`--query-order-replay=<run>` is **recorded nondeterminism replay**, not a seed-only
pass. Its artifact index and original source must verify before use. Negative
controls reject changed eligibility, exact large numeric values, duplicate
multiplicities and cardinality. Failure paths retain the random tape as well as
the job/query trace and state checkpoint, even when cleanup fails.

Version 3 keeps those exact selection checks and uses streamed, lossless JSON
chunks instead of one in-memory tape. The 673-hour version 2 artifact was about
294 MB; a 90-day equivalent would exceed JavaScript's single-string limit.
Accepted observations and raw native arrivals are flushed through the proof
artifact index at 64 entries or 8 MiB of canonical entry data, whichever comes
first. Every chunk has a content hash; the complete accepted record sequence has
an incremental digest. Replay reads one verified chunk at a time and rejects
missing, changed, incomplete, out-of-order or unconsumed records. Failed native
arrivals are also retained. No character values or duplicate rows are omitted.
A single observation above the declared 8 MiB budget fails closed. Version 2
tapes are retained as historical evidence and cannot drive version 3 replay.

The recorder requires `artifact: proof.artifact` at creation. Its `finish()` and
`diagnostic()` methods are asynchronous so all chunks are durable before the
manifest is attached. Both worker and actor-world runners use a separately owned
database as described in `harness-database-isolation.md`; schema-only runs do not
prove isolation from other native worlds' advisory locks.
The same attempt also exhausted local PostgreSQL lock memory during monolithic
schema cleanup; cleanup now drops only owned tables in separate transactions,
refuses external dependencies, and retains/seals any further cleanup failure.

```powershell
node test/rc1-native-worker-schedule.js --postgres --hours=2 --resume=C:/Users/Jorge/.codex/rc1-native-evidence/worker-two-seasons-1 --output=C:/Users/Jorge/.codex/rc1-native-evidence/worker-restart-1
node test/rc1-native-worker-schedule.js --postgres --hours=2 --resume=C:/Users/Jorge/.codex/rc1-native-evidence/worker-two-seasons-1 --query-order-replay=C:/Users/Jorge/.codex/rc1-native-evidence/worker-restart-1 --compare=C:/Users/Jorge/.codex/rc1-native-evidence/worker-restart-1 --output=C:/Users/Jorge/.codex/rc1-native-evidence/worker-restart-replay-1
```

Those historical restart commands belong to source `8568a10b` and its version 1
tape. Generate new observation/replay artifacts on the same committed source for
version 2; never relabel older artifacts with a newer revision.

The callable interface for scenario workloads is:

```js
const controller = createWorkerSchedule({ start, setClock, expectedDormant });
const instrumentation = installWorkerInstrumentation(controller, { namespace, queryOrder });
// Initialize the isolated schema/clock first. The wrapper below loads the
// original makeDb only after proving db.js was instrumented, BEFORE boot writes.
const pool = await makeWorkerDatabase(controller);
// Only now dynamically import actor authorities and initialize the declared
// roster. Freeze all fixture writes before original worker/actor measurement.
await bootOriginalWorker(controller);
await controller.advanceTo(deadline, async (logicalAt, workerCallback) => {
  const view = await controller.actor({ authority: 'player.snapshot', accountId },
    () => playerEngine.snapshot(accountId));
  const command = chooseAuthorizedIssuedCommand(view);
  await controller.actor({ authority: 'player.execute', accountId,
    executionId: command.executionIdentity.executionId }, () => executeIssued(playerEngine, accountId, command));
});
```

Actor hooks are awaited between original due worker callbacks and retain their
actual identities, results and errors. The supplied closure must call the
canonical player authority, which still performs authorization. The hook does
not grant permissions or classify gameplay rejection as a worker failure;
scenario policy/metrics own that classification. Use a fresh process for each
world so module-level configuration and randomness cannot leak between worlds.
