# RC1 security and operations review

This review covers the player-command, Director, campaign, World Kernel,
Knowledge and item/custody boundaries of RC1. It is not a contract audit or
authorization to enable chain, withdrawal, liquidity or other economic rails.

The frozen application source is
`626e61b9ab2b14a9dc45566983b70cdc65692839`. The focused security run records its
working revision and reviewed file hashes in
[`evidence/security-operations/source-hashes.json`](evidence/security-operations/source-hashes.json).
The added termination harness and evidence package are release validation work;
they change no signed economic parameter or domain architecture.

## Methods and scope

The methods required by `omerta-contracts/SECURITY-REVIEW-POLICY.md` were adapted
to this bounded JavaScript/PostgreSQL review:

| Pinned source | Pass actually applied |
| --- | --- |
| pashov/skills `c577eb7799c349de0acb187ba00ca98e14e436fd` | `solidity-auditor/references/hacking-agents/{access-control,execution-trace,invariant}-agent.md`: caller/guard comparison, interruption traces and resource/state coupling; Solidity-only mechanics excluded |
| PlamenTSV/plamen `795962b96e254f2e423a2635fe7f8cb8ea1e6d69` | `agents/skills/evm/temporal-parameter-staleness/SKILL.md`: issued projection versus current membership, character, evidence, deadline, asset and definition authority |
| trailofbits/skills `d3323cefbcf645678b8dc481de204b02ad3d02dc` | `plugins/audit-context-building/skills/audit-context-building/SKILL.md`: entry-point, callee, storage and trust-boundary mapping before adversarial claims |

These are the named passes used, not a claim that the upstream full-agent
orchestration or every security scanner ran. The task was already delegated as
a bounded review; additional audit agents were not started. No Solidity
compiler, chain deployment, malicious token callback or on-chain oracle claim
is made here; contract evidence belongs to the separate Foundry/recovery gates.

## System and trust boundaries

| Boundary | Authority and recovery property |
| --- | --- |
| HTTP to Player Commands | Authentication supplies the account. Strict body/query validation accepts an execution identity and confirmation, never an account or client permission claim. Error responses avoid hidden domain details. |
| Issued board to mutation | `player_command_boards` is an expiring suggestion. `withIssuedBoard` binds account/board and serializes admission; execution rechecks current state. The domain transaction separately verifies current character and requirements. |
| Command to item/crafting/operation/Kernel | Native services retain transactions, mutation guards and durable receipts. Domain effects commit before feedback; a projection failure reports completed work and preserves the original retry identity. |
| Coordination to Knowledge | The current claim/grant and membership snapshot decides visibility and usable evidence. An issued card does not preserve revoked access. |
| Director to canonical world | The scheduler samples canonical objects/history under locks and writes its own situations, campaigns, clocks and receipts. It has no alternative path to mint resources or apply a World Kernel action. |
| API termination | `src/server.js` closes its listener, drains active requests for 10 seconds, reaps idle connections, and bounds shutdown. |
| Worker termination | The production worker has no SIGTERM drain handler. PostgreSQL rolls back interrupted transactions; durable receipts and predicated transitions permit restart. A graceful API exit and a signal-terminated worker are distinct expected results. |

Replay domains include account, original character, issued-board identity,
domain mutation identity, world revision, operation definition hash and
Director mode/tick identity. Client telemetry is outside all these boundaries.

## Executed evidence

The focused native run used Windows, Node `v24.19.0` and real PostgreSQL `18.4`
on a disposable loopback cluster. Each test creates an isolated schema.
Commands, timestamps and exit status are in
[`evidence/security-operations/results.json`](evidence/security-operations/results.json);
individual stdout/stderr logs are beside it. An executable proof counts only
when its recorded exit status is zero.

| Lane | Properties exercised |
| --- | --- |
| `node test/director-security.js --postgres` | Unauthorized situation enumeration, forged IDs/actions/revisions, revoked evidence, Crew/Family departure, definition tampering, duplicate workers, restart, expiry, fact/event sample race and downstream branch preservation |
| `node test/player-commands.js --postgres` | Stable issuance, confirmation, double submission, expired/stale/foreign identities, suspension/death/succession, eight simultaneous submissions, atomic item failure/retry, post-commit feedback failure, independent process HTTP replay and bounded pool admission |
| `node test/director-network-recovery.js --postgres` | Contested operations, one resource sink, exact reward/consequence replay, loser cancellation/refund, late Director restart, Crew/Family departure, competing item consumption, deadline change and database exception after partial work |

The termination evidence is maintained separately in
[`evidence/graceful-shutdown/`](evidence/graceful-shutdown/README.md).
Local Windows probes reached all nine real SQL barriers; they explicitly do
not establish POSIX signal behavior. The initial Linux workflow
`35406921227` passed all nine at
`cf661c399d02290dd1bb4b031c87a9235a65371f`; retained results are in
[`linux-cf661c/result.json`](evidence/graceful-shutdown/linux-cf661c/result.json).
The final corrected source `f31b5290080506f6407a9b7f9a514e2ea020a9d4`
passed all nine scenarios in run `35408617560`, using Node 22.23.2 and
PostgreSQL 16.15. Its complete result and process logs are retained in
[`linux-f31b529/result.json`](evidence/graceful-shutdown/linux-f31b529/result.json).
The final fingerprint also includes character cash and bank balances.

Fresh hosted full application and native PostgreSQL gates passed at this same
corrected revision in run `35408648650`, including the telemetry, command,
Director, campaign, concurrency, chaos, migration and backup/restore checks.
Foundry passed 1,247 tests in 82 suites at frozen main; liquidity recovery also
passed there. [Source comparison](evidence/gates/source-comparison.json)
confirms no changes to contract sources, economic rules, schema, item/crafting,
Coordination, Director or World Kernel authority between those revisions.
See [gate index](evidence/gates/INDEX.json) for exact per-step results.

## Adversarial coverage and remaining scope

| Requested attack | Retained proof or required complementary lane |
| --- | --- |
| Replay, duplicate requests, parallel requests | Focused Player Commands and network recovery lanes; HTTP replay uses a separate server process |
| Stale opportunity, death, succession, consumed asset | Focused Player Commands and network recovery lanes |
| Crew/Family departure, revoked Knowledge | Focused Director/network lanes; `coordination-knowledge-postgres` and `world-kernel --postgres` additionally exercise both transaction orders |
| Role change and item transfer during execution | Relevant `world-kernel --postgres`, Family and custody lanes must pass in the overall release-gate record; this report does not substitute sequential departure for every role-transfer race |
| Deadline and campaign version replacement | Focused expiry/definition tamper cases; broader Director recovery/retained-version cases belong to the overall gate record |
| Director restart, worker duplication, server restart | Focused native lanes plus the Linux process harness |
| Database interruption | Focused transactional exception proof; full database restart remains the `chaos` lane with an actual restart capability |
| Hidden history, actor discovery, revision leakage | Director enumeration proof plus `world-consequences`, `player-opportunities`, Knowledge API and projection tests in the overall gate record |
| Resource duplication and conservation | Exact native item/resource/OMR/custody snapshots in focused lanes; full ledger and contract conservation require their separate gates |
| Browser multi-tab/repeated taps/background/offline | Must be supported by the mobile/browser journey evidence; multiple service calls alone do not prove browser recovery presentation |

No new exploitable P0/P1 integrity defect was established by this bounded code
inspection. This does not turn an unexecuted, failed or incomplete lane into a
pass. A failed hard gate in `RC1-READINESS.md` overrides this limited conclusion.

Static analysis: focused source/caller searches and manual transaction tracing
were performed. The native SQL parser passed 4,061 literal statements; it
reported 168 interpolations and 39 nonliteral helper sites as unprepared rather
than silently passing them. The telemetry helper's aggregate query shapes
passed the native telemetry lane. Preflight passed; the first gate-matrix run
found an unclassified query fan-out, corrected by sequential reads. Its next
run reached only the release-test registration gap owned by the package
workstream. Raw diagnostics are retained in `evidence/security-operations/`.
No new general-purpose security scanner was executed in this subtask and no
clean-scanner claim is made.

## Observability finding

At the frozen source, the new loop's domain modules contain no durable gameplay
funnel telemetry. The Director exposes numeric process-local metrics and the
worker logs them; the existing growth/engagement reports cover older events.
Those facts did not prove the requested login → Command Center → opportunity →
preparation → command → consequence → second opportunity → second session
funnel. The RC1 correction adds `src/world-telemetry.js`, authenticated bounded
presentation observations, server-issued command/rejection observations, and a
moderator-only aggregate report using the existing telemetry and canonical
tables. It introduces no schema or permission authority.

The review corrected two observed P1 interaction regressions in the initial
patch: passive observations exhausted the gameplay rate bucket, and their
WebSocket projection hints closed confirmation dialogs. Observations now have
an independent bounded bucket and emit no gameplay projection hints. Writes
are best effort, bounded to one connection and 128 queued events per pool, and
cannot delay a committed command response. The client queue is bounded too.

The eight-stage funnel requires a different follow-up opportunity, matching
authorized current consequence, and distinct return session at least 30
minutes after the move. Older rendered history, replay, reopening the first
opportunity and early reloads do not manufacture those stages. Raw UI events
remain untrusted. The report exposes truncation, dropped writes, failures and
possible undercount; the sequence uses server receipt time, so delayed or lost
beacons can undercount. Canonical operations, campaigns, item provenance,
Knowledge, crafting, Director selections and consequences use domain rows.

Retained native/memory retest results are in
[`evidence/security-operations/telemetry-results.json`](evidence/security-operations/telemetry-results.json).
The correction history and reproduction conditions are retained in
[`telemetry-regressions.md`](evidence/security-operations/telemetry-regressions.md).
The corrected hosted mobile sweep and invite browser gate passed. The separate
fresh-account browser story reaches the documented solo authority blocker;
these security proofs do not replace incomplete golden/mobile journeys.

## Findings disposition

- **OPS-01, hard evidence gate:** Linux process interruption was not established
  by the historical in-memory/native exception tests or Windows probes. The
  new nine-barrier harness makes the missing experiment reproducible. Retain
  the Linux result and classify any failing stage; do not waive it.
- **OBS-01, P1 observability, corrected:** The frozen revision lacked the new
  player funnel. The release correction and native eight-stage regression
  evidence above close that instrumentation gap for the tested source. UI
  delivery remains subject to the mobile/browser gate.
- **SCOPE-01, validation limit:** Native service concurrency does not establish
  every browser multi-tab/mobile recovery flow or every worker job. Keep the
  complementary release gates explicit.

The release decision remains in `RC1-READINESS.md`. This document makes no
independent READY_FOR_COHORT assertion.
