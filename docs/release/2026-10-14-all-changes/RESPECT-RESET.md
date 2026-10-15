# October 14 respect-reset supplement

Scope: the owner's explicit request to apply a new one-time production respect reset.
Source baseline: `c07a002bd74b00f4dfe0aa5f351e109f4ff3c897`, with the three working-file
changes pinned in [source-and-evidence.json](respect-reset-evidence/source-and-evidence.json).
The retained [patch](respect-reset-evidence/reset.patch) records the complete supplement.
The earlier `b602dc0d` backend report and evidence remain historical and unchanged.

## Behavior and boundary

`resetStartingLevels` now checks and records `starting-levels-2026-10-14`.
The previous `starting-levels-2026-10-06` record remains untouched and cannot suppress the new reset.
The existing transaction and boot-time schema advisory lock are retained.
The sole player mutation remains:

```sql
UPDATE characters SET respect=0 WHERE alive=true AND is_npc=false;
```

Cash, other character fields, dead characters and every NPC are outside that mutation.
The respect update and new marker commit together; failure to insert the marker rolls back the reset.
Subsequent boots preserve progress earned after the successful reset.

Only these protected source/test files changed:

- `src/db.js`: new marker and explanatory comment; unchanged predicate/transaction/lock caller.
- `test/public-start.js`: memory upgrade from the old marker, full-row preservation and replay.
- `test/readiness-migration-failure.js`: native upgrade, injected marker failure/rollback,
  two living humans plus dead-human/living-NPC/dead-NPC controls, full-row and marker preservation,
  repeated boot, and the existing interrupted-DDL recovery checks.

The tests remain wired through the existing invitation and native migration CI steps.

## Executed verification — 2026-10-14

Tools: Node `v24.19.0`, PostgreSQL `18.4`, `pg` `8.22.0`, `pg-mem` `3.0.14`.
No fuzz campaign or seed is claimed; random schema suffixes only isolate deterministic native cases.

| Command | Result |
| --- | --- |
| `node test/public-start.js` | Exit 0: old-marker upgrade, respect zero, unchanged other fields/dead/NPC state, preserved new progress and both marker records. |
| `node test/readiness-migration-failure.js` | Exit 0 on real PostgreSQL: failed marker insertion rolls back every changed respect value; successful retry resets both living humans only; cash/all other fields and both historical markers survive replay. Injected DDL failure still refuses startup/stamp and recovers on retry. |
| `npm run pgquery` | Exit 0: 5,728 static statements prepare/type-resolve; unchanged 172 interpolated sites and 41 nonliteral sites remain explicitly counted. No guard ceiling or SQL-review exemption changed. |

Native regression endpoint:
`COORDINATION_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:55438/omerta_release_native`.
SQL preparation used a separately created empty database:
`DATABASE_URL=postgres://postgres@127.0.0.1:55438/omerta_respect_reset_query`.
Both belong to the isolated local release PostgreSQL instance; no production connection was used.
Raw logs and wrapper exit records are retained in [respect-reset-evidence](respect-reset-evidence/).

## Finding and limits

**RESET-INT-001 — resolved functional release requirement:** the already-applied October 6 marker
would skip another reset. The separate October 14 marker supplies an independently recorded one-time
operation. Memory/native upgrade and replay controls pass; native fault injection verifies atomicity.

This is source/test evidence for the pinned file hashes, not proof that production has executed the
reset. The parent release must repin its source-transfer proof after the final source freeze and
verify deployment/marker state separately. No production database write, deployment, contract change,
RPC rehearsal or activation occurred in this supplement.
