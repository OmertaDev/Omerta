# Scoped native actor replay and continuation

Owner: Codex/native_harness. These controls do not qualify a matrix cell.

`test/rc1-native-world-workload.js` records exact authorized actor projection
hashes, actual decisions, native outcomes, complete canonical database state,
worker schedules/jobs, RNG draws, policy options, actor metrics and observations.
`--replay=<prior-directory>` requires verified artifacts and exactly the same
source, seed, population and duration. It replays actual actor decisions and
native PostgreSQL unordered subset selection, rejecting any changed authorized
input or eligible row value/multiplicity before substitution. The final
comparison is mandatory and retains balances, IDs, timestamps and every state
field. Only native wall durations and physical MVCC/relation-size diagnostics
are excluded from semantic comparison; their raw artifacts remain retained.

`--resume=<prior-directory>` restores the exact PostgreSQL dump, logical clock,
RNG draws and actor-policy checkpoint, including original policy epoch,
last completed day, options, actions, metrics and first/last opportunity sightings.
No fixture grants execute after restore. The original worker then boots again.
Compare two fresh continuations from the same checkpoint using `--resume` plus
`--replay`; this is not equivalence to an uninterrupted worker process. All
configured local worker callbacks execute. External health registry, archive,
chain watcher and liquidity exclusions remain explicit in each run.

Example with local PostgreSQL and a configured `RC1_PG_BIN`:

```text
node test/rc1-native-world-workload.js --postgres --hours=23 --population=25 --output=<observation>
node test/rc1-native-world-workload.js --postgres --hours=23 --population=25 --replay=<observation> --output=<replay>
node test/rc1-native-world-workload.js --postgres --hours=2 --population=25 --resume=<observation> --output=<continuation>
node test/rc1-native-world-workload.js --postgres --hours=2 --population=25 --resume=<observation> --replay=<continuation> --output=<continuation-replay>
```

The observation starts one hour before a canonical season boundary. The two-hour
continuation from hour23 must preserve day0 and execute day1 actor sessions.
`--inject-actor-input-mismatch` with `--replay` deliberately alters only the first
authorized snapshot comparison input. The real native snapshot remains recorded;
the altered input cannot execute an actor command. Expected result is a sealed
FAIL with actor tape, original native outcome, failure state and RNG retained.

Resource observation is optional and separately scoped. The SQL boundary guard
supports explicit single-statement quoting/comments and native BEGIN/START,
COMMIT/ROLLBACK and savepoint controls. It refuses SQL-level prepared statements,
procedures, transaction chaining and two-phase controls before execution; driver
parameter binding remains unchanged. Overlapping native queries are refused,
not serialized into a fabricated per-commit proof.

The actor tape is bounded to the selected workload but currently stored in one
artifact; query selections use lossless bounded chunks. Full snapshots and
actor/worker artifacts retain their existing whole-artifact capacity limits.
