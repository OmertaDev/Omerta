# RC1 native proof harness (owner: Codex/native_harness)

This extends the existing canonical service simulation. It does not replace the game,
introduce an economy journal authority, or qualify the 225 world runs. The committed
`scenario-manifest.json` freezes all 15 archetypes, five populations, three seeds,
90-day/two-rollover/two-longest-lifecycle requirements, zero-drift/dead-world targets,
and the separate 12-hour/1,000-actor soak before acceptance execution. Its 225 cells
remain unimplemented until their full native workloads and prerequisite resource gate
have passing evidence. No model, scoped fixture, timeout, skip, or missing cell counts.

## Commands

Run from a clean committed checkout. Install the exact lockfile dependencies first.
Use only an explicit disposable loopback PostgreSQL database. On Windows, set
`RC1_PG_BIN` to the installed PostgreSQL `bin` directory. Set
`COORDINATION_TEST_DATABASE_URL` to the local disposable database URL. Do not put
credentials in committed artifacts. Evidence output must be outside the checkout;
protect that directory with user-only filesystem permissions before execution.

```powershell
node test/rc1-native-proof.js
node test/rc1-native-proof.js --postgres --output=C:/private-evidence/unique-proof-run
node tools/rc1-sim.js --postgres --populations=25 --seeds=rc1-alpha --replicates=1 --rounds=1 --output=C:/private-evidence/scoped-summary --proof-directory=C:/private-evidence/unique-scoped-run
```

The output directory is exclusive and must not be reused, including after failure.
Record the command exit code. A clean-tree identity and checkout-content, schema,
lockfile, configuration, and Git hashes are checked again before the result is sealed.
Output artifacts include synthetic actor details and complete durable database state;
publish redacted summaries and hashes, not raw database dumps or full command traces.
The tool creates restrictive POSIX file modes, but Windows ACLs must be set separately.

## Implemented evidence

`rc1-sim.js --proof-directory` retains seeded roster, fixture grants, initial complete
state, canonical command inputs/identities/responses, Director schedule, final state,
PostgreSQL dumps and hashes, invariants, and the first failing state/checkpoint when
the database remains available. A capture failure is retained explicitly. Invalid
round/replicate counts cannot make an empty campaign pass. `run.json` always identifies
this harness as `native-postgresql-scoped-fixture` with `matrixQualifying: false`.

The checkpoint regression runs the canonical Player Command engine against real
PostgreSQL, races the same issued command, requires exactly one newly committed
effect, dumps the resulting database schema, closes/drops the disposable original
schema, restores into an absent schema, and replays its durable receipt. It compares
the complete canonical state across restore and receipt replay. It then proves a
rolled-back corrupt mutation leaves state intact and that a deliberately committed
one-unit cash adjustment fails the existing ledger invariant. The injected failure
and recoverable database dump remain as sensitivity-test evidence; this is not a
successful gameplay run. Existing destination schemas and changed artifact bytes
are rejected.

## Normalization and limitations

The normalization map excludes **no fields**. Table rows are read within one
repeatable-read transaction and sorted by their complete PostgreSQL JSON text;
JSON object keys are sorted in the outer representation. PostgreSQL serializes
numeric/atomic values directly into retained text to avoid JavaScript precision loss.
Generated IDs, timestamps, balances, visibility, outcomes, and sequences are retained.
Checkpoint capture is a quiescent barrier with equal complete-state hashes immediately
before and after `pg_dump`. No deadline or status is rewritten to manufacture progress.

Invocation and response-completion traces are hash chained. They are observed API
ordering, **not a total PostgreSQL commit order** and not a deterministic concurrency
scheduler. Fixture helper transactions bypassing the wrapped Player Command engine
are represented by durable tables/receipts and checkpoint state, not complete
invocation traces. The existing fixture also pins some boost randomness and only
advances the Director application clock; database `NOW()` remains wall time.

Remaining RC1-01 proof: same-seed fresh-world normalized equivalence, a complete
recorded concurrent failure schedule that can be reexecuted, full worker/application/
database time coordination, and automated failure-history reduction. Remaining
RC1-03 proof: every acceptance workload, the complete 225-run matrix, due worker
interval/lifecycle coverage, dead-world metrics/assertions, and the production-envelope
12-hour soak. Checkpoint receipt replay is deliberately narrower than these claims.
