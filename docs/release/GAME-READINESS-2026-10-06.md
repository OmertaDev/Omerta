# Game readiness follow-up — October 6, 2026

Status: **NOT RELEASE READY**. This follow-up preserves the existing matrix waiver;
it does not restart that matrix or admit the incomplete load soak.

## Verified production observation

Read-only Render inspection of the user-selected My Workspace found both the API
and worker live at `0ef6dc73ac740942134d606acd180093a5e1359d`.
At 2026-10-07T02:32:53.729Z (October 6 in New York), `/health` reported database up,
zero recent 5xx responses, 324 ms recent request p95, and `worker.stale=false`.
The reported heartbeat age was 3,196 seconds; this is a health snapshot, not proof
that every background lifecycle ran or that the service meets launch load targets.
No production setting, database, account, or deployment was changed in this work.
At 2026-10-07T02:52:23.227Z, a second observation confirmed a renewed worker
heartbeat (765 seconds old), database up, zero recent 5xx and 302 ms request p95.

## Repairs and executed checks

- Restored the release's incomplete-migration startup guard in this older working
  checkout, preserving the new signup and one-time starting-level reset. A real
  PostgreSQL DDL interruption reproduced startup incorrectly recording success
  before the repair. After repair, startup refuses, the previous stamp remains,
  and retry/reapplication succeed. The live release already contains this guard.
- Added `test/readiness-migration-failure.js` and a real-PostgreSQL CI step to keep
  that failure covered. The migration suite and signup/level-reset test pass.
- Reproduced a brief database-disconnect recovery defect: a legacy request
  returned `503 db_down`, then remained `409 in_progress` because its receipt
  reservation could not be released. The conservative seven-day orphan horizon
  preserves ambiguous committed value; it is not a short recovery lease.
- Added bounded reconnect retries for receipt reads, completion and release.
  Each pending reservation has a unique ownership token. Conditional writes
  retain that token, account, key, body hash and pending status, so a delayed
  callback cannot overwrite or delete a replacement with the same request body.
  Lost INSERT acknowledgements recognize only their own attempted token.
- Six real-PostgreSQL ownership controls and three native full-server HTTP
  controls pass in both the isolated release worktree and this working checkout.
  They cover actual backend disconnects, lost acknowledgements, replacement
  races, exact replay, unchanged cash/ledger counts, exhaustion and non-network
  errors. Security, receipt, persistence and migration regressions pass. The
  isolated release worktree's larger hardening suite also passes.
- Updated this checkout's stale security assertion to the already implemented
  public-signup policy: eight concurrent signups create distinct accounts and
  leave unused invitation credit unchanged under stale invitation settings.
- At isolated source `19d9bb6154433e0c036c2b2a339b30cd19621b81`, PostgreSQL 16
  `tools/pgcheck.js` passed 221 checks, including one-connection post-commit
  execution, exactly-once release, rollback, retry, and hook-failure controls.
- Independently verified all 1,065 retained stopped-soak files (41,113,654 bytes)
  with no missing files, size discrepancies, or hash discrepancies.
- Restored the retained candidate22 backup into a new local PostgreSQL 18
  database. All 369 tables were restored; 1,004 accounts and 1,004 characters
  were present; all 55 ledger checks passed with database writes disabled for
  validation. This proves recovery of that retained backup, not today's
  production backup or production failover.

Restricted logs and restored database files remain under
`C:/Users/Jorge/.codex/game-readiness-20261006/`. They are not public evidence or
player data exports. Existing historical evidence remains unchanged.

## Current limits

The prior candidate22 replacement soak was cancelled by the user after 15.078
minutes. Its reconnect intervention passed 100/100; its full 12-hour duration,
participation, worker interruption, database reconnect, API restart, and sustained
performance were not qualified. Its raw read p95 was 3,057.67 ms, exceeding the
500 ms target. Temporary hosted resources were deleted and the key revoked.

The new short local diagnostic exercises 100 ordinary entrants and the original
API/worker on an exclusively owned database. Its first attempt retained a failed
market contention setup: it assumed the first actors remained unjailed after
normal crime traffic. All four other interventions executed; no baseline request
failures or unresolved commands remained. Read p95 was 627.83 ms. This local host
does not match the production resource envelope and this is not soak clearance.

Subsequent attempts retained the market eligibility race, a too-short recovery
window, and the actual stranded reservation. The market control now selects
eligible players in one location and uses its original two-buyer scope; the
100-request burst and 100-actor reconnect remain separate, unchanged controls.
All five attempts' complete artifact indexes and history chains were verified.

Final retest at `d6305163d8815ae393c58d9b2d4ca7075b8d60d7`: **PASS_SCOPED**,
100 distinct successful command actors, 100 requests concurrently on the wire,
all five fault interventions executed, zero unresolved commands and zero
unexpected baseline request failures. All 163 indexed artifacts verified.
Command p95 was 36.63 ms; read p95 was 588.01 ms, still above the 500 ms target.
This three-minute local run is not production-equivalent or full-soak evidence.
The recorder correctly leaves fault recovery qualification unverified; executing
an intervention does not establish every production due-work deadline.

The source changes are retained on `codex/game-readiness-closure` in
`C:/Users/Jorge/.codex/worktrees/game-readiness-closure/Omerta`. Application fixes
and native regression tests are also applied surgically to this working checkout.
Other pending work is preserved. Neither version has been deployed by this task.

## Scoped recovery review and release limits

Two independent agent passes reviewed the request/receipt trust boundary and
lost-acknowledgement races. Native tests establish ownership and value/replay
properties; they are not a comprehensive review of all game or contract code.
Working-file hashes and before/after logs are retained in
`working-checkout-evidence.json` in the restricted evidence directory.

Drain old API instances before claiming reservation-token protection: their old
callbacks do not apply the token predicate. No pending legacy reservation is
blindly reclaimed, and the seven-day pruning policy is unchanged. Bounded retries
handle brief disconnects; prolonged outages, process death before receipt storage,
and exhausted writes can still leave a genuinely ambiguous request reserved.
Do not infer that this patch supplies transactional receipts to every legacy route.

The current working checkout's SQL gate also remains red: its query extractor
prepares a Crew query prefix without its concatenated GROUP BY, and its unchecked
interpolation inventory exceeds the existing ceiling (190 versus 168). This
checkout contains unrelated pending changes and cannot inherit release clearance
from the live revision. Do not raise the ceiling merely to clear the gate.

## Before real-player admission

Complete and qualify the full sustained-load/fault run on the selected release and
production-equivalent isolated resources. Reconcile the actual deployment and
working checkout before treating source-scoped evidence as applicable.

For tomorrow's real players, record first-action time, understandable consequence
and next objective, critical mobile failures, command errors and later-day returns.
Assign an operator to review errors, ledger alarms, worker state and player reports;
keep a recovery path ready. Physical iPhone/Android testing and human comprehension
require real participants. Missing human or long-duration evidence remains missing.
