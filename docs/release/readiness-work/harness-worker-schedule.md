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
state, final state, logical schedule and random-tape equality with a prior run
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
separate gate; the current comparison is a fresh-process same-seed replay.
