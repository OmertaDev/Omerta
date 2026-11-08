# Playtest remediation release and continuation

Release phase: candidate verification; deployment is a separate recorded operation.
Base source: `bb4a6c451465d6f58caa1e320ffcbed8992b4b1b` (current main), preserving its
signup-origin authority, age-21 cookie-policy binding and player privacy behavior.
The older dirty development checkout was not copied wholesale into this release.

## Reviewed changes

- First Blood grants its owner identity-only visibility of the exact assigned living
  NPC; other players, locations and replacement lives remain private.
- Business upgrades use the same earned-income settlement as collection, including
  Ledger benefits and Tycoon progress.
- Casino rakeback checkpoints a historical cumulative entitlement before ownership
  changes. Rational indices preserve fractions; payouts retain the house-profit cap.
- Agent Alpha observes after cadence waits, durably journals before submitting, and
  reuses its checked Windows credential helper within one finite invocation. A
  separate bounded turn-observation quota preserves the hard mutation cadence.
- The progression harness advances street-action cooldowns and recognizes current
  First Blood prose; its post-obedience diagnostic no longer counts pre-completion time.
- Dedicated `/v1/auth/agent` signup commits permanent classification before issuing
  its first bearer. Human signup still requires its age check; known denials and
  explicit invalid dates remain denied. Existing origin and cookie safeguards remain.
- MCP initial recovery publication is exclusive across hosts and late responses
  cannot replace another saved identity. Bootstrap error recovery releases its
  creation connection before acquiring another connection.
- Agent crime risk now exposes `baseJailSeconds` and expresses legacy `jailMinutes`
  in actual minutes. Canonical gameplay jail duration is unchanged.
- A finite three-agent QA coordinator uses separate private identities, bounded
  actions and an overlap lease. It stops on the lead's level-100 goal, identity loss
  or required attention rather than replacing characters silently.

## Executed local evidence

Targeted candidate checks include First Blood/privacy, human/agent age admission,
signup origin authority, MCP, agent turns, Alpha recovery/security and browser flows.
The ordinary Windows runner with rate limiting on completed five actions with no
stale turns and no supplied DOB. Three independent local agents also executed in
parallel. Mixed local tests exercised two flagged agents and two synthetic humans
through crew consent/privacy, escrow trade/retry and authored-case ownership.

Owned PostgreSQL 18.4: 222 pgcheck assertions passed. The concurrent load harness
completed 4,467 operations with zero server errors, deadlocks or ledger drift.
Historical casino migration/ordering/rollback proofs passed. Native Windows chaos
passed interrupted payouts, killed backend and full database outage/recovery cases;
its POSIX SIGTERM drain leg requires the Linux workflow and is not claimed green.

The deterministic world graph check and earned-economy simulation passed. The
mounted-source and suite inventory gates retain all existing proofs and explicitly
wire the new regressions. Full lifecycle and Linux checks must finish successfully
on the candidate commit before cutover; pending checks are not deployment approval.

Detailed retained command outputs, source hashes and production read-only aggregate
checks are in the local `output/live-release-2026-11-08/` evidence package. They do
not contain production credentials or individual player records. Source-level
tests/proofs are committed with this release for reproduction.

## Cutover requirements

The casino change must not mix old and new settlement writers. First deploy the
candidate worker with the deliberately DB-free maintenance start command, verify
old-worker retirement, enable API maintenance and drain outstanding traffic, then
deploy the API candidate. After old API retirement, restore the worker's normal
start command at the exact same SHA and verify both live instances and worker
heartbeat before reopening traffic. Do not create a casino checkpoint until old
writers are retired. Recheck active jobs and aggregate casino integrity at cutover.

Historical ownership cohorts before this change cannot be reconstructed. Existing
legacy counters receive the old formula's entitlement at the first frozen snapshot;
new intervals use historical ownership. Additive schema compatibility does not make
an old-code rollback economically safe after the new index is used. Recovery after
that point must retain the new settlement semantics.

## Continued play

Three clearly marked agents advance through shared unlocks and coordinate with the
opted-in human street `real1`. The human retains their own credentials, choices and
classification. Browser testing uses an existing flagged agent identity. Dedicated
cohort sessions remain outside the repository; action logs and coverage are redacted.
Potential exploits are reproduced locally rather than farmed against live players.
Observed coverage, unmet prerequisites and required human actions remain explicit;
this is not a claim to have exhausted every interaction or the game's endgame.
