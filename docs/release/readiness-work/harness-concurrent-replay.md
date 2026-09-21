# Bounded recorded concurrent replay

Owner: Codex/native_harness. Scope: RC1-01, local PostgreSQL, synthetic
initialization, one issued `item.salvage` command contested by two engines.
This is not the world matrix or evidence of arbitrary production schedules.

The observation run pauses application delivery after PostgreSQL grants the
winner's actual issued-board row lock. A second backend executes the canonical
`FOR UPDATE NOWAIT` and must encounter SQLSTATE `55P03`, mapped by the canonical
command engine to `contention`. Both requests remain in flight. The winner then
continues through the original economy transaction.

The recorder retains command, connection, SQL dispatch, PostgreSQL completion,
application delivery, and command completion order. Queries retain parameters,
result fingerprints, and errors. Physical backend and transaction identifiers
are retained as diagnostics; they do not enter the repeatable schedule hash.
Additional read-only metadata queries observe those physical identifiers and
do not mutate game state. Replay launches the requests in reverse order and
uses the recorded events to reproduce the overlap without the observation
barrier. It fails closed on divergence, missing events, or a bounded timeout.

A second observed/replayed pair deliberately raises PostgreSQL `P0001` after
the canonical car debit in the same transaction. The command must fail, all
game tables must equal their initial state, and the failure snapshot and dump
are retained. Sequence values are always retained and are not incorrectly
required to roll back. Closing every pool connection and replacing the command
engine then permits a successful canonical retry. An exact retry must replay
the durable receipt. The normal pair also verifies that this connection/engine
restart replay leaves the full database state unchanged. This is not a process
kill/restart claim.

Every run preserves raw full-state snapshots, sequences, custom-format database
checkpoints, a hash-chained history, and an artifact index bound to clean source.
The deterministic runtime and isolated-schema clock functions use the existing
explicit test seams; no balances, visibility, outcomes, deadlines, or IDs are
excluded. Fixture grants, canonical initial car acquisition, clock, and random
draws are recorded before measurement. No fixture state is edited afterward.
The only injected operation is the declared SQL exception in the fault pair.

Commit the checkout first. In PowerShell, using a disposable PostgreSQL database:

```powershell
$env:COORDINATION_TEST_DATABASE_URL='postgres://postgres@127.0.0.1:55441/rc1_native_harness'
$env:RC1_PG_BIN='C:/Program Files/PostgreSQL/18/bin'
node test/rc1-native-concurrent-replay.js
node test/rc1-native-concurrent-replay.js --postgres --output=C:/Users/Jorge/.codex/rc1-native-evidence/concurrent-replay-experiment-1
```

Use a new restricted output directory for each run and retain failed attempts.
Both pairs require identical initial and final canonical state hashes and
identical recorded schedule hashes. They do not prove unobserved races, the
complete worker schedule, multi-writer commit ordering, or 225 matrix runs.
