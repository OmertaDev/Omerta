# Native world database isolation

Owner: Codex/native_harness. Test infrastructure only; no production lock or
worker behavior is changed.

The original separate-schema worker replay failed at hour 458 on source
`934fcf97`: a concurrent quiet-world run in the same database contended on the
canonical NPC offensive advisory lock. The first different job returned
`skipped: 'locked'`; later cash/location differences correctly failed the full
eligible-state comparison. Schema search paths do not isolate PostgreSQL
advisory locks. That failed run remains retained and cannot qualify replay.

`planOwnedWorldDatabase` plans a unique `rc1_world_<random>` database. The explicit
local control URL is used only to create/check/drop that database. Each worker
and actor world creates its own database inside its evidence lifecycle before
schema/fixture initialization. Resumed worlds also use a new database. Canonical
advisory keys, pool behavior and commands are untouched.

The name and ownership marker are declared in configuration. Creation records
the actual database OID. Cleanup requires the exact name, OID and marker, closes
owned pools first, and uses `DROP DATABASE` without `FORCE`. Changed ownership or
remaining connections fail cleanup and preserve the database; the runner records
the failure. It never changes server settings or terminates foreign backends.

`test/rc1-native-database.js` holds the real NPC lock key in one schema, invokes
the canonical `sweepNpcAggression` in another schema to reproduce its locked skip,
then proves that a different owned database acquires the same lock key. A changed
ownership marker must reject cleanup while preserving the database. All evidence
is source-bound. Run only against the explicitly disposable local control URL:

```powershell
$env:COORDINATION_TEST_DATABASE_URL='postgres://postgres@127.0.0.1:55441/rc1_native_harness'
node test/rc1-native-database.js --postgres --output=C:/Users/Jorge/.codex/rc1-native-evidence/database-isolation-1
```

Independent databases isolate this demonstrated interference. Shared host/cluster
CPU, memory, disk and PostgreSQL telemetry remain shared; these local proofs do
not claim production capacity or matrix qualification.
