# Gateway PostgreSQL and event-delivery evidence

## Scope and source checkpoint

Date: 2026-09-21. Phase: local pre-release integration verification. Repository
HEAD: `e56cf576065c5f1bbb9bb55115f5961267f7d654`, with working-tree changes.
The final run records SHA256 hashes of the exact schema, database adapter,
gateway security, service, events, action targets, capabilities and regression
script in [gateway-postgres-run.txt](gateway-postgres-run.txt). The script
asserts these files remain unchanged during the run. Later changes require
retesting the affected claims.

This supplement follows the repository's
[agent-led review policy](../../omerta-contracts/SECURITY-REVIEW-POLICY.md).
It covers delegated credential invalidation, durable rate limits, subscriptions,
timestamp cursors, preparation identity and committed-receipt recovery. It does
not claim a complete protocol audit, production deployment, vendor approval,
live-wallet verification or exactly-once event transport.

Runtime: PostgreSQL **18.4**, Node **v24.19.0**, `pg` **8.22.0**. PostgreSQL was
initialized in a new task-owned directory under `tmp/gateway-postgres`, bound
only to `127.0.0.1` on an unused port. A fresh `gateway_pgcheck` database served
the repository gate; gateway regressions used generated isolated schemas that
were dropped after their runs. No `.env` or existing database was read. The
cluster was [stopped successfully](postgres-stop.txt).

## Trust and state model

Delegated principals identify a connection and account, but their current
authority comes from `security.revalidate`: current connection status and
expiry, account status and token version, and stored scopes. An account's SQL
rate bucket is shared across its connections and gateway instances. Subscription
creation locks the account before checking the per-connection count.

Event subscriptions are metadata. Event content remains in authoritative
notifications, coordination events and public event results. Every read
filters current ownership, scope and relevant membership/discovery visibility.
In-process emitter payloads are not a record of committed game state.

Agent preparation writes an immutable request identity and preparation. The
player's confirmation uses its bound nonce and digest. A lost response can
leave `executing` after the underlying command committed. Recovery must find
the same committed command receipt; absent that receipt, expiry and a fresh
preview continue to gate any new execution.

## Executed checks

| Command | Result | Evidence |
| --- | --- | --- |
| `node test/gateway-events.js` | Exit 0 | [Event integration output](gateway-events-run.txt) |
| `GATEWAY_TEST_DATABASE_URL=<isolated loopback URL> node test/gateway-postgres.js` | Exit 0; ten focused groups | [PostgreSQL regression and exact source hashes](gateway-postgres-run.txt) |
| `npm run pgcheck` with a fresh isolated database and development-only fixture configuration | Exit 0; **203 passed, 0 failed** | [Full repository PostgreSQL gate](pgcheck-run.txt) |
| `node --check` on gateway events, security, service and PostgreSQL regression | Exit 0; no diagnostics | Syntax-only check; not a security-analyzer result |

The PostgreSQL regression applies the **full production schema twice**, then
uses two independent connection pools and service instances. Its concrete
budgets are 65 concurrent rate-limit attempts (exactly 60 admitted), 25 distinct
concurrent subscriptions (exactly 20 admitted), eight concurrent preparations
with one request ID (one preparation), and three event rows spanning distinct
microseconds and a timestamp tie. Replay resumes from another gateway instance.
It also exercises revocation, account logout, ban, expiry and rate-window rollover.

The committed-action recovery test uses a **durable PostgreSQL fixture receipt**
bound to command key, account, target URL and canonical body. A simulated lost
response after that row commits is recovered after preparation expiry without
another dispatch. A pre-commit disconnect has no receipt and cannot execute
after expiry. Revocation blocks recovery before receipt lookup. This proves
gateway orchestration against the defined receipt contract; the test sink is
not an actual game crafting command.

The broader `pgcheck` run exercised the real server, locks, transaction rollback,
all 51 ledger identities, schema migrations, lock-free reads, deadlock recovery
and invitation concurrency. Its isolated-fixture warnings about unset public
origin and invariant webhooks are retained; no production configuration was
changed. The final receipt-recovery service fix was verified by the focused
PostgreSQL rerun after this broader gate.

## Methods and triage

Policy-pinned checkouts were verified locally: Pashov
`c577eb7799c349de0acb187ba00ca98e14e436fd`, Plamen
`795962b96e254f2e423a2635fe7f8cb8ea1e6d69`, and Trail of Bits
`d3323cefbcf645678b8dc481de204b02ad3d02dc`.

Adapted passes used Pashov's trust-boundary/asymmetry guidance, Plamen's
cross-function state-transition and boundary-check guidance, and Trail of
Bits' service trust-boundary/callee and persistent-concurrency guidance.
References inspected were `solidity-auditor/references/hacking-agents/trust-gap-agent.md`,
`agents/depth-state-trace.md`, and audit-context-building's `DOMAIN_NOTES.md`.
These were targeted JavaScript/PostgreSQL adaptations; their complete upstream
orchestrators, Solidity scanners and Solidity fuzzers were not executed. No
contracts or cryptographic signing implementations changed in this scope.

| ID | Disposition | Trace and evidence |
| --- | --- | --- |
| GW-EVT-001 | Resolved, medium reliability | JavaScript `Date` drops PostgreSQL microseconds; an imprecise resume position can duplicate or skip tied records. Real PostgreSQL now emits UTC microsecond cursor text, and source-batch order preserves database ordering. The reverse-lexical-ID precision regression passes. |
| GW-REC-001 | Resolved, medium reliability | An executing preparation whose action committed could previously become unrecoverable when its preview expired. Recovery now requires a matching committed receipt before checking pending-execution expiry. Durable receipt, absent receipt, expiry, changed readiness, and revoked-connection traces pass. |
| GW-EVT-002 | Explicit transport limitation | Existing event timestamps are not commit sequence numbers. A sufficiently late transaction can commit behind a cursor. The interface reports timestamp replay, and its documentation requires authoritative refresh after reconnect. A transactional outbox/committed-change stream is still needed for a stronger completeness guarantee. |

The pg-mem timestamp-to-text incompatibility was an executed test failure during
implementation, corrected with an explicit database capability. Memory mode
uses its native millisecond timestamps; real PostgreSQL uses formatted
microsecond text. Both regression modes pass. Syntax checks produced no
diagnostics; no broader static-security tool run is claimed here.

## Conclusion

The pinned gateway checkpoint passes the tested persistence, concurrency,
credential invalidation and receipt-recovery properties on PostgreSQL. Event
scope/discovery isolation and bounded streaming pass the focused integration
suite. Completeness beyond existing timestamp logs and retention, multi-process
stream admission, live vendor enrollment, and production activation remain
outside these verified claims. See [event contract and limits](../agent-gateway-events.md).
