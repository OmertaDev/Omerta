# RC1 termination evidence

`tools/rc1-shutdown.js` starts the actual `src/server.js` and `src/worker.js`
production entry points against disposable PostgreSQL schemas. It installs
schema-local `AFTER` triggers which wait on harness-held advisory locks. A query
of `pg_locks` must prove that a child has reached each barrier before any signal
is sent. Timing a sleep and hoping that work is in flight is not accepted.

Run from the repository root on Linux with Node 22 and PostgreSQL 16:

```sh
npm ci
export COORDINATION_TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/rc1_recovery
node tools/rc1-shutdown.js
```

The database must be disposable and on loopback. The harness creates and drops
its own schemas. External webhook/RPC/private-key settings are removed from
child environments. Fixture accounts start in the current season. Each child
uses the production database timeouts, production authentication checks,
limited Director/world cohort, disabled chain RPC, and a 10-second API drain.
Random fixture credentials are never written to the report.

| Stage | Proven SQL barrier | Expected termination behavior |
| --- | --- | --- |
| Director selection | Insert into `director_selections` | Worker termination rolls back the whole selection; restart observes again |
| Campaign progression | Update of `director_campaigns` | Worker termination rolls back branch updates and receipts together |
| World Kernel mutation | Update of `world_kernel_objects` | API drains the in-flight canonical command |
| Operation resolution | `world_operations.status=completed` | API drains the in-flight canonical command |
| Item consumption | `item_instances.state=consumed` | API drains the in-flight canonical command |
| Crafting | Insert into `item_instances` | API drains the craft and retains its output |
| Player Command execution | Completion of `item_mutation_guards` | API drains the domain mutation and retains its retry identity |
| Consequence generation | Insert into `world_kernel_events` | API drains the canonical consequence transaction |
| Scheduled worker processing | Expired `npc_wars` update | Worker termination rolls back expiry; restart completes it |

Campaign setup uses the existing Director in LIVE mode followed by the
production LIMITED_COHORT mode. Their separate tick receipt identities permit
the new process to observe the fixture's canonical operation immediately,
without changing the production clock or five-minute cadence. Unrelated hourly
jobs are held at their heartbeat write in the two Director scenarios. The
scheduled-job scenario exercises the normal worker sequence without that hold.

The report records the exact source commit, platform, runtime, PostgreSQL
version, targeted SQL barrier, blocked backend PID, signal, before/after state
hashes, and verdict. Per-child logs are retained alongside `result.json`.
Assertions cover database-session cleanup, atomic rollback or successful API
drain, committed-state survival, exact command replay after process restart,
no duplicate canonical consequence, no negative stacks, World Kernel history
integrity, Family custody/capital integrity, and unchanged canonical state for
Director observation/replay.

Limits: these are nine precise interruption points, not every instruction or
every scheduled job. API cases release the lock during the graceful window;
they do not claim to test a platform's later forced SIGKILL at every point.
The scheduled example is an NPC war expiry, not proof that every background
job is safe. Existing chaos, concurrency, economic and liquidity recovery
gates remain independently required.

`--probe-only` can validate fixture setup, real HTTP execution, and each SQL
barrier on Windows. Its report is always `BLOCKED`, and it never counts as Linux
signal evidence. `windows-probe.json` retains that distinction. Without that
switch a non-Linux invocation exits 2 rather than manufacturing a pass.

CI reproduction is `.github/workflows/rc1-recovery.yml`; it uploads the complete
evidence directory even when a scenario fails. A missing or non-PASS Linux
`result.json` leaves the hard shutdown release gate open.
