# RC1 deployment and recovery

This runbook is for the frozen main `626e61b9ab2b14a9dc45566983b70cdc65692839`
and gate repairs recorded in the release report. It grants no additional game authority.
Readiness is determined by [the release report](RC1-RELEASE-REPORT.md), not by this procedure.

## Deployment procedure

1. Select the exact tested candidate SHA, an isolated deployment/database, and the approved
   real-player cohort. Record the API and worker revisions, schema hash, configuration hash,
   and the existing contract deployment manifests. Do not copy production player data into test logs.
2. Install the lockfile with `npm ci --omit=dev`. Supply `DATABASE_URL`, `NODE_ENV=production`,
   strong `JWT_SECRET`, `MARKET_SEED`, `MOD_KEY`, and an explicit `SOCIAL_VERIFY_MODE`.
   Use the same database and secrets for API and worker. Run `npm run preflight`.
3. For the RC1 gameplay cohort enable `CORE_PROGRESSION`, `WORLD_GRAPH_KERNEL`,
   `COORDINATION_ENGINE`, `COORDINATION_KNOWLEDGE`, `COORDINATION_KNOWLEDGE_SHARING`,
   and `COORDINATION_OPERATIONS` with `on`. Set `LIVING_WORLD_DIRECTOR=LIMITED_COHORT`;
   set identical nonempty `DIRECTOR_ACCOUNT_IDS` and `COORDINATION_ACCOUNT_IDS` lists.
   Keep `INVITE_MODE=on`. Configure account/OAuth/wallet integrations for the intended cohort.
   Do not enable dormant contract rails as part of this release.
4. Take a native PostgreSQL backup; verify restoration to a separate scratch database before writes.
   Run `npm start`. Boot applies schema and migrations. `schema_migration_incomplete` is a failed
   deployment: keep traffic closed, preserve the previous schema stamp, fix the actual migration
   cause, and retry the same build. Never edit `schema_meta` to simulate success.
5. Run exactly one `npm run worker` at the same SHA. Verify `/health`, database latency,
   worker heartbeat, Director mode, and absence of migration/worker exceptions. Configure
   private invariant/backup alerts on both processes as described in [DEPLOY.md](../../DEPLOY.md).
6. Execute a cohort-only smoke journey through real HTTP and confirm a persisted command receipt,
   visible consequence, exact-key replay, and clean native invariants. Record time to first action,
   abandonment, errors/latency, opportunity engagement, campaign and coordination participation,
   return sessions, mobile failures and repeated confusing dead ends.
7. Keep access controlled until all gates and the real cohort's unresolved P0/P1 count are satisfied.
   An automation or seeded fixture is not a cohort member or a retention observation.

## Incident procedure

Every intervention records: operator, UTC time, incident/correlation ID, exact SHA/configuration,
affected private object identifiers in restricted storage, original receipt/event IDs, reason,
before/after state hashes, conservation checks, action and result. Never put private facts or
raw request bodies into public logs. If a supported operation cannot repair the state without
breaking conservation, preserve the failure and fix forward; do not improvise balance edits.

| Incident | Safe containment and recovery | Verification before readmission |
| --- | --- | --- |
| Stuck campaign | Pause new admission to the affected cohort; preserve `director_campaigns`, transitions, selections and canonical World Kernel events. Restart the same worker and let idempotent ticks reconcile committed facts. Do not manually force campaign status or create rewards. | Native Director recovery and campaign journey gates; no orphan or duplicate linked operation. |
| Stuck operation | Preserve operation participants, commitments, custody and receipt. Retry the original command identity, or let the canonical expiry/cancel path settle when authorized. | `familyOperationInvariants`, custody/inventory census and exact-key replay. |
| Bad or expired opportunity | Fetch a fresh authorized `/v1/commands` board. Do not fabricate availability, costs, participants or deadlines in a client. Reconcile a timed-out command with its original identity before issuing another action. | Receipt exists at most once; refreshed board derives from current canonical state. |
| Worker crash/database interruption | Check `/health` and private worker/DB diagnostics. Restore connectivity, then restart one worker with unchanged configuration. Do not run overlapping workers as a repair. | Persisted heartbeat advances; missed ticks recover; invariants and duplicate-worker tests pass. |
| Failed migration | Preserve native error and previous `schema_meta`; keep API/worker unavailable. Correct the actual DDL/environment defect, then rerun the same migration. | `test/rc1-postgres-migration-failure.js`: failure refuses boot, preserves stamp, retry and repeated boot succeed. |
| Corrupt generated content | Stop admitting new uses of the affected definition; retain original bundle and hash. Validate the canonical pack and use existing reviewed activation procedures. Never mutate immutable history to hide the corruption. | Definition-registry invariants and content hash/World Graph checks. |
| Broken mystery | Preserve evidence, choices, custody and action receipts. Reproduce with the authorized actor's exact history in scratch PostgreSQL, then repair through the canonical transition or a reviewed implementation correction. | Knowledge redaction, irreversible-choice integrity, inventory conservation and exact replay. |
| Bad world mutation | Preserve append-only events and affected custody. Stop affected writes; evaluate an audited compensating canonical transition. A code rollback does not reverse a committed world event. | Before + created - destroyed + transferred in - transferred out = after for every affected resource; Kernel and operation invariants. |
| Bad deploy | Follow the rollback procedure below. | Same SHA on both processes, matching state census, replay/reconstruction/health. |

## Rollback procedure and proof boundary

Drain/stop affected admission, preserve the incident evidence and database backup, then roll back
**both** API and worker to the same previously tested commit in Render. Restore a database only
to a separate scratch target for rehearsal; replacing live data needs an explicit, reviewed
recovery decision because it can discard valid intervening actions. Keep market seed, chain
network and signer domains unchanged. Do not assume schema compatibility merely because most DDL
is additive: the repository also has named migrations.

This pass rehearsed native dump/restore and boot of the exact frozen predecessor on a populated
database, comparing all 368 table censuses/hashes. See [PostgreSQL evidence](RC1-POSTGRES-REPORT.md).
That proof applies to that source pair and fixture, not to every historical revision or a live
production restore. Linux backup permissions and real SIGTERM are separate recorded gates.

## Diagnostic scope

Player Command requests return a server-generated `x-correlation-id`. JSON records use only
allowlisted stages/counters: request, authorization, command, mutation, consequence, opportunity,
failure, response. No token, account, target, command payload, prerequisite, Knowledge or exception
object is serialized. Replays are explicitly marked. Auth failures include revoked and banned
direct-return paths. Logging failure cannot turn a committed mutation into a failed response.

Existing Director worker metrics cover selections, generated/resolved/expired/recovered situations,
active campaigns and backlog. Existing `/health`, worker heartbeat, database recovery logs,
private invariant alerts and persisted domain event/receipt tables provide complementary evidence.
This is not a claim that every legacy write has an end-to-end correlation chain or that cohort
analytics are deployed; those limitations remain in the release gate matrix.
