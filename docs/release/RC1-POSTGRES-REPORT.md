# RC1 PostgreSQL production proof

Frozen source: `626e61b9ab2b14a9dc45566983b70cdc65692839` (`origin/main`). Tests run on that source plus the explicitly identified RC gate repairs below. This report does not identify an uncommitted tree as a release SHA.

The repaired local candidate was recorded as `4d35c8e8b3a1db696f1bf5b5e8b7b0dc327cecb1`. Local logs retain their actual run times; the initial frozen runs and repair reruns are distinguished below. Fresh hosted recovery tests passed at candidate `29a49c6b7673b22c2e803dd2473dc5c7fa03f46a`; that evidence is recorded separately below.

## Environment and isolation

- Actual engine: PostgreSQL **18.4**, Windows x64, local disposable cluster; Node **24.19.0**. No `pg-mem` result is counted here as production database proof.
- Dedicated cluster: `%TEMP%/omerta-rc1-pg-626e61b9`, bound only to `127.0.0.1:55439`. Each gate creates its own database; domain suites additionally create private schemas. Database names and execution times are retained in [machine-readable results](evidence/postgres/results-pgquery.json).
- Local test connection: `postgres://postgres@127.0.0.1:55439/postgres`, local trust authentication. These are disposable test fixtures, not production credentials. No live database was accessed.
- Cluster initialization: `"C:/Program Files/PostgreSQL/18/bin/initdb.exe" -D "$env:TEMP/omerta-rc1-pg-626e61b9" -U postgres -A trust --encoding=UTF8 --locale=C`.
- Cluster startup: `"C:/Program Files/PostgreSQL/18/bin/pg_ctl.exe" -D "$env:TEMP/omerta-rc1-pg-626e61b9" -l "$env:TEMP/omerta-rc1-pg-626e61b9/server.log" -o "-h 127.0.0.1 -p 55439" start`.
- Reproduction runner: `node docs/release/evidence/postgres/run-gates.mjs`. The runner uses the exact Node command bodies of the named npm scripts, records their command, database, timestamps and exit codes, and continues independent gates after failures.

CI's main PostgreSQL lane explicitly pins **PostgreSQL 16** for production fidelity. Version 16, Docker and a working Linux/WSL environment were not present locally. The later hosted Linux/PostgreSQL 16 recovery run below supplies fresh platform-specific evidence; local PostgreSQL 18 results remain labeled as such.

## Reproduced failures and gate-required repairs

### PG-01 — A: incomplete migration reported successful (repaired)

Release gate: partial migration failure, retry, trustworthy startup and schema stamp.

Command: `COORDINATION_TEST_DATABASE_URL=<isolated loopback database> node test/rc1-postgres-migration-failure.js`.

The regression creates a private schema, boots canonical migrations, simulates an older schema without `characters.bank_credit_ms`, and installs a real PostgreSQL DDL event trigger that interrupts that exact `ADD COLUMN`. Frozen implementation returned `migration.failed: 1` and stamped current version `1.2.0` / schema `da89a90b235b0b46`, despite leaving the column absent. Evidence: [baseline failure](evidence/postgres/migration-failure-baseline.log).

Repair: `src/db.js:migrateSchemaUnderLock` now throws `schema_migration_incomplete` before targeted migrations and the stamp whenever a generic column migration failed. Successfully applied additive DDL remains retryable; failure cannot be advertised as a healthy boot. No economic state is invented, discarded or compensated.

Retest: [native failure/retry evidence](evidence/postgres/migration-failure-retest.log) proves startup refusal, preservation of the previous stamp, successful retry after fault removal and successful repeated migration. The new gate is registered as `npm run test:db-migration:postgres` in the real PostgreSQL CI job. Existing `node test/migrate.js` also passes; [log](evidence/postgres/migrate-unit.log), supporting unit evidence only.

### PG-02 — D: market deadlock fixture schedules the wrong victim (repaired)

Release gate: `npm run pgcheck`, section 9f.

The real server correctly cancelled a listing and refunded the bidder exactly once, while PostgreSQL aborted the artificial holder with `40P01`. The test expected the player to be the victim and therefore reported six failures. [Frozen failure log](evidence/postgres/pgcheck-baseline-failed.log).

Repair: use the existing section 9e boundary hook to pause the exact real refund before sending it, establish the holder's reverse lock wait, then release the refund. Only the artificial holder defers deadlock detection. Production SQL, production timeouts, real deadlock counter checks, rollback checks and exactly-once refund assertions are unchanged. Retest: **203 passed, 0 failed**; [log](evidence/postgres/pgcheck.log).

### PG-03 — E: POSIX backup permission assertion unavailable on NTFS

Command: with the disposable `DATABASE_URL` and PostgreSQL binaries on PATH, `"C:/Program Files/Git/bin/bash.exe" tools/backup-selftest.sh`.

Local result: **25 passed, 1 failed**. Dump creation, rejection of empty/invalid backups, pruning behavior and actual restore passed; restored fixture IDs, custody, provenance and graph state matched, with no orphan or duplicated custody. The owner-only permission assertion expected `0600`; Git Bash/NTFS reported `0644`. [Evidence](evidence/postgres/backup-selftest.log). This host failure was resolved by the fresh Linux run below, without weakening the assertion.

## Gate results

All **19 named PostgreSQL gates below passed after the recorded repairs/corrected local fixture setup**. Logs contain exact invocation and database scope; no passed gate is inferred from a historical report. The first sweep, repair rerun and audit environment rerun are retained separately in `results-pgquery.json`, `results-pgcheck.json` and `results-test-audit-mint-dev-postgres.json`.

| Command | Actual result | Evidence |
| --- | --- | --- |
| `npm run pgquery` | PASS: 4,059 static statements; 168 interpolated and 38 nonliteral sites explicitly counted, not claimed parsed | [log](evidence/postgres/pgquery.log) |
| `npm run pgcheck` | PASS after PG-01/PG-02 repair: 203 assertions | [log](evidence/postgres/pgcheck.log) |
| `npm run test:db-migration:postgres` | PASS: genuine DDL fault, unchanged stamp, retry, repeated application | [log](evidence/postgres/test-db-migration-postgres.log) |
| `npm run phase2:definitions:postgres` | PASS | [log](evidence/postgres/phase2-definitions-postgres.log) |
| `npm run phase2:lots:postgres` | PASS: exact lots, lost-COMMIT recovery, upgrade/replay | [log](evidence/postgres/phase2-lots-postgres.log) |
| `npm run test:coordination:postgres` | PASS | [log](evidence/postgres/test-coordination-postgres.log) |
| `npm run test:world-kernel:postgres` | PASS: knowledge, kernel, queries, populated migration | [log](evidence/postgres/test-world-kernel-postgres.log) |
| `npm run test:family-operations:postgres` | PASS: capital/material custody, rollback, migration, contention/reconstruction | [log](evidence/postgres/test-family-operations-postgres.log) |
| `npm run test:world-projections:postgres` | PASS | [log](evidence/postgres/test-world-projections-postgres.log) |
| `npm run test:core-progression:postgres` | PASS: prerequisites, quotas, both furnace branches, populated migration | [log](evidence/postgres/test-core-progression-postgres.log) |
| `npm run test:player-commands:postgres` | PASS: 17 command groups, both player journeys, consequences; independent HTTP process replay | [log](evidence/postgres/test-player-commands-postgres.log) |
| `npm run test:director:postgres` | PASS: all 11 suites, campaign branches, real contested operations, native interrupted writes, retries, reconstruction | [log](evidence/postgres/test-director-postgres.log) |
| `npm run test:stockcatalogv2:postgres` | PASS | [log](evidence/postgres/test-stockcatalogv2-postgres.log) |
| `npm run test:rwahealth:postgres` | PASS | [log](evidence/postgres/test-rwahealth-postgres.log) |
| `npm run test:rwaregistrylifecycle:postgres` | PASS | [log](evidence/postgres/test-rwaregistrylifecycle-postgres.log) |
| `npm run test:audit:mint-dev:postgres` | PASS on its required dedicated database | [log](evidence/postgres/test-audit-mint-dev-postgres.log) |
| `npm run test:audit:deed-reimport:postgres` | PASS on its required dedicated database | [log](evidence/postgres/test-audit-deed-reimport-postgres.log) |
| `npm run concurrency` | PASS: exactly-once command, one escrow winner, symmetric transfers, exact house take; zero deadlocks | [log](evidence/postgres/concurrency.log) |
| `npm run loadtest` | PASS: 8 concurrent players, 3,599 operations, no 5xx or pool failures; all 55 conservation checks unchanged | [log](evidence/postgres/loadtest.log) |

The first local audit invocations refused generated database names before touching state. Class **D local orchestration defect**: those existing tests intentionally require `omerta_audit_mint_dev` and `omerta_audit_deed_recovery`. The runner was corrected to create those names in the isolated cluster; both passed without changing their assertions or implementation. The original refusals remain in `test-audit-mint-dev-wrong-db.log` and `test-audit-deed-reimport-wrong-db.log`.

The separate liquidity PostgreSQL CI lane was also reproduced with its dedicated database names: `node test/keepertransactions.js`, `node test/liquiditykeeper.js`, `node test/liquidityaccounting.js`, `node test/liquidityindexer.js`, `node test/liquidityqueue.js`, and `node test/liquiditypolicy.js` all **PASS**. [Exact commands and results](evidence/postgres/liquidity-results.json); reproduction: `node docs/release/evidence/postgres/run-liquidity.mjs` on a fresh disposable cluster. These use deterministic RPC fixtures and make no claim about a deployed contract or live balances.

The request-rate figure in the load log is a local correctness observation, not a production capacity promise; the separate 1,000-player simulation belongs in the simulation report.

## Actual native restore and application rollback

Command: `node docs/release/evidence/postgres/rollback-proof.mjs --postgres`.

The repaired application created a real campaign conflict and resolved an operation through canonical services. The resulting corpus contained **71 nonempty tables**, including characters, coordination/Knowledge, world state, operations, inventory and Director campaigns. The current application booted successfully. Native PostgreSQL `pg_dump --format=custom` and `pg_restore --no-owner` restored the database into a separate disposable database; complete row hashes across **368 tables** matched exactly. `schema_meta` was separately excluded because startup intentionally changes its application timestamp.

The independently checked-out, exact frozen application at `626e61b9ab2b14a9dc45566983b70cdc65692839` then booted against that restored database, answered `/health` with **200**, and preserved every one of those table hashes. This proves this specific rollback pair against this populated fixture, not an arbitrary prior release or an unseen production database. [Execution log](evidence/postgres/rollback-proof.log), [table census, dump location and SHA-256](evidence/postgres/rollback-proof.json).

## Interruption and full database outage

Command: with local fixture credentials, `DATABASE_URL=postgres://postgres@127.0.0.1:55440/omerta_rc1_chaos PG_CTL='<PostgreSQL18 pg_ctl with the isolated chaos data directory and log>' node tools/chaos.js`.

The chaos lane used its own separately initialized disposable cluster at `%TEMP%/omerta-rc1-chaos-626e61b9`, port **55440**, so stopping it could not interrupt other proof suites. [Evidence](evidence/postgres/chaos.log).

Real worker interruption, killed active PostgreSQL backends, full PostgreSQL stop/start, automatic API recovery and interrupted two-party transfer conservation completed. The API survived the actual database outage, reported a legible database-unavailable error and recovered without redeployment. This is actual process/database evidence, not a simulated exception.

The overall local chaos gate **failed on Windows**: its three graceful SIGTERM assertions observed a reset in-flight request, signal termination and no drain announcement. Class **E environment defect**: Windows forced termination does not provide the production Linux signal semantics. This was a historical local-host limitation; fresh Linux/PostgreSQL 16 evidence below now proves the required production-process barriers without relaxing assertions.

`tools/rc1-shutdown.js` was reused from the separately reviewed repository validation commit `36156ace3f4e4600badc8394a205d0e10432d227` as a proof harness only. No historical PASS or production code was imported. A local `--probe-only --scenario=player-command` run reached its real SQL barrier and completed the command; its result deliberately remains `BLOCKED`, because it delivered no Linux signal. [Probe record](evidence/postgres/shutdown-probe/result.json). The new `rc1-recovery.yml` workflow runs fresh PostgreSQL 16/Node 22 migration fault, Linux backup/permissions/restore and all nine actual production-process SIGTERM barriers, and uploads evidence named with the tested SHA. Its fresh result follows.

### Fresh hosted Linux recovery — PASS

[GitHub run 35543734703](https://github.com/OmertaDev/Omerta/actions/runs/35543734703) ran the candidate at exact SHA **`29a49c6b7673b22c2e803dd2473dc5c7fa03f46a`** on **PostgreSQL 16.15 / Node 22.23.2 / Linux**. The completed workflow and all jobs report success; [retained run metadata](evidence/hosted/linux-recovery-run.json).

Fresh results: the native DDL fault refused migration/startup stamping and retried successfully; Linux backup ownership permissions and native restore passed; **all nine real production-process SIGTERM scenarios passed**. The barriers were Director selection, campaign progression, World Graph mutation, operation resolution, item consumption, crafting, Player Command receipt, consequence generation and scheduled worker processing. Each targeted statement actually reached a database barrier before termination; API requests drained, interrupted worker transactions rolled back, processes restarted, replay did not duplicate canonical effects, and invariants held.

[Exact-SHA scenario results](evidence/hosted/linux-29a49c6b/rc1-linux-recovery-29a49c6b7673b22c2e803dd2473dc5c7fa03f46a/result.json) and sibling process logs are preserved. These fresh results resolve the local SIGTERM and backup-permission limitations. They do not certify an unseen deployed database/configuration, nor do they replace the separate critical-CI gate matrix or a real-player cohort.

The separate full **real Postgres** CI job also passed at this exact SHA: [job 106165883189, run 35543735864](https://github.com/OmertaDev/Omerta/actions/runs/35543735864/job/106165883189), completed `2026-09-20T23:20:26Z`. Its retained [job metadata](evidence/hosted/ci-29a49c6b-run.json) records success for pgquery, pgcheck, the new migration-failure regression, every registered gameplay PostgreSQL suite, mint/deed audits, backup/restore, chaos, load and concurrency. The broader workflow was superseded/canceled after this database job completed; it is not a whole-CI pass. The later complete CI at 21d0589a passed both jobs: [run 35544649446](https://github.com/OmertaDev/Omerta/actions/runs/35544649446), with full metadata and logs in `evidence/hosted/ci-21d0589a*`.

## Final candidate hosted retest

[Run35545394093](https://github.com/OmertaDev/Omerta/actions/runs/35545394093)
completed successfully at **`cce721029c86de7c6f0d875fef7cb8de29504dda`**.
It reran PostgreSQL16 partial migration fault/retry, native backup/permissions/restore,
all nine Linux termination/recovery barriers, the common-command tampering/concurrent
replay proof and the corrected newcomer/returning phone harness. Raw metadata, logs
and uploaded artifacts are retained under `evidence/hosted/linux-cce72102*`.

The preceding 21d0589a workflow passed migration, backup and all termination barriers
but failed its newly added phone harness on a legitimate lockup onboarding dialog.
That tooling failure is retained and classified in the gate report. The correction
changes only the test's waiting and real dismissal controls plus artifact retention;
application, contract and database implementation bytes did not change.

## Failed-migration recovery procedure

If startup raises `schema_migration_incomplete`, keep rollout closed and retain the exact failed DDL and previous `schema_meta` stamp. Correct the demonstrated lock, permission or required data-backfill cause in a reviewed recovery step, then rerun the normal startup migration under its existing advisory lock. Do not manually stamp success or silently default valuable resources. Successfully applied additive columns are idempotent on retry; the native fault test above proves the repaired column and stamp complete together on retry. Restore the verified dump or roll back the code only to the specifically tested target when needed; all recovery execution and checks belong in the deployment evidence.

## Scope limits

After all local test processes finished, the isolated cluster on 55439 was stopped
cleanly; its data directory was retained. See `evidence/postgres/local-cluster-stop.json`.
To repeat the local commands, start that same disposable cluster with PostgreSQL18's
`pg_ctl -D C:/Users/Jorge/AppData/Local/Temp/omerta-rc1-pg-626e61b9 -o "-h 127.0.0.1 -p 55439" -w start`,
or create a fresh isolated cluster and substitute its loopback URLs. No production
service or database was stopped or changed.

- A reopened pool or recreated domain service demonstrates database-backed reconstruction but is not labeled a killed-process recovery proof. Independent HTTP process replay and real worker/process interruption are reported separately.
- Local fixture migrations and a verified dump restore do not prove compatibility with an unseen production database, its deployment settings or its selected rollback commit.
- A Windows `child.kill('SIGTERM')` terminates the child; it does not deliver Linux's graceful signal semantics. Windows failures cannot establish that the production drain is broken, nor can forced termination establish that its Linux drain is correct.
- No deployment, on-chain write, public launch or real-player cohort action was performed by this database lane.
