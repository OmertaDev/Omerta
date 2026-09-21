# RC1 native proof harness (owner: Codex/native_harness)

This extends the existing canonical service simulation. It does not replace the game,
introduce an economy journal authority, or qualify the 225 world runs. The committed
`scenario-manifest.json` freezes all 15 archetypes, five populations, three seeds,
90-day/two-rollover/two-longest-lifecycle requirements, zero-drift/dead-world targets,
and the separate 12-hour/1,000-actor soak before acceptance execution. The manifest
also freezes read p95 <=500ms, authoritative command p95 <=1500ms and p99 <=3000ms,
unexpected 5xx/timeout rate <0.1% outside injected faults, and recovery of due-work
backlog within two scheduling periods or a larger canonical deadline declared before
the run. Provider time, intended denials, and injected outages have separate counters.
These are proposed acceptance targets, not observed measurements. The 225 cells
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
Seeded policy choices use authorized graph/action semantics rather than generated
command or instance IDs. For a hidden discover action, the key uses its ordinal in
the authorized action list and never reads the hidden node definition. Choice keys
and issued command IDs are both retained. The recorded logical duration explicitly
identifies the limited Director/fixture clock scope.

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

## Retained execution results

`harness-results.json` records actual source/configuration identities, exit codes,
artifact hashes, counters, exclusions, and the failed small-population diagnostic.
The PostgreSQL 18.4 checkpoint regression passes on `67d33908`. The restored standard
36-player/five-day population harness also passes on that revision with 6,730
API/worker transition checks, unchanged drift across all 55 invariants, all nine
driven markets receiving posts, and reconciled census totals. Its direct time/resource
warping and fixture grants disqualify it from the required long-term world matrix.

Two fresh serial 25-player scoped PostgreSQL runs on `1b12efb2` each execute 94
commands. Their 20 seeded actor policy choices match. Their full database hashes
do not match because no IDs/timestamps or other fields were excluded. This proves
policy replay only; it leaves complete-state deterministic replay open.

## Same-seed serial clock/RNG experiment

`test/rc1-native-serial-replay.js --postgres --output=<restricted-external-directory>`
runs two serial copies of the existing 25-player canonical workload with the same
seed and declared epoch. The original mismatch affected energy/nerve and accrual
credits, not merely UUID spelling: those fields must never be normalized away.
The opt-in seams in `tools/rc1-native-determinism.js` seed UUID/random-byte/random
decisions and bind `Date.now()` and zero-argument `new Date()` to the fixture clock.
Both original crypto functions and the application clock are restored in `finally`.

Only each isolated test schema receives clock functions. An explicit search path
selects those functions ahead of `pg_catalog`; no public or built-in function changes.
Connection settings supply logical transaction and statement time before canonical
queries. Date arithmetic, expiry values, durations, and all stored timestamps remain
intact. Unsupported SQL clock keywords fail closed. Deadline progress uses the
existing fixture advance seam, and duplicate execution is serial in this experiment.
This is clock control for a scoped workload, not evidence that every due worker ran.

The comparison excludes **no database fields**, retains both raw snapshots and dumps,
and must reject modified cash, Knowledge access, world state, or operation outcome.
RNG tapes and exact source/configuration hashes remain in restricted artifacts. The
declared fixture boost random override remains visible. An experiment failure is
retained and cannot be promoted into a native matrix or concurrent-replay pass.

The bounded same-seed serial proof now **passes** on
`57bbecb54cbb602c2752efbfa0045ac10d070301`. Both fresh 25-player PostgreSQL schemas
produce complete canonical state hash
`55d4176b96b03fbdf4a9c8e5898de03f379aa0e122bba39f86e7321de14a5079`, with no
excluded fields. Four exact-field corruption checks confirm that cash, Knowledge
access, world state, and operation outcome differences remain detectable. Native
assertions also cover transaction/statement time, savepoint rollback, and rejection
of uncontrolled SQL clock keywords. The savepoint assertion first reproduced a
test-seam defect on `d0ed8617`; the final retest preserves the transaction timestamp.

`harness-serial-replay-results.json` records this later proof, its before/after source
identities, exact command, artifact hashes, configuration, and exclusions. It closes
the bounded serial reproducibility gap described above; the earlier results retain
their actual source SHAs and are not retroactively upgraded. Recorded concurrent
replay, complete production-worker scheduling, full resource coverage, the 225-run
matrix, and the soak remain open.
