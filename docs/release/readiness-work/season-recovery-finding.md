# RC1-SEASON-01: interrupted crown cannot recover

Owner: Codex/root. Phase: implementation and local native recovery. Reproduced at
`fcaa60765aa816daa18ef6c2484e15e46d06ac63`; repair retest pending. The affected
seasonal recovery gate remains unmet until the integrated repair passes.

`recordReckoning` committed `season_records.crowned=true` before incrementing the
champion's `account_persistent.season_crowns`. A native PostgreSQL trigger raising
SQLSTATE `RCS01` on that account update left the stored champion marked crowned
with zero crowns. Removing the fault and calling the canonical function again
returned null and left zero crowns. This is permanent loss of a seasonal status
award after a database failure, not a demonstrated currency loss or attacker route.

The reproduction used one ordinary guest/character and the canonical domain
function. No balances, progression, deadlines or result rows were edited. Restricted
full snapshots, source/configuration hashes, invocation history and artifact index
are retained under `reckoning-fault-fcaa-1` in the private evidence root. The helper
hash is included in its configuration. Its sealed outcome is FAIL; no process-kill
or complete worker proof is inferred from a transactional fault.

The repair preserves the first stored standings as the durable award intent, then
commits the claim, crown and notification in one native transaction. The existing
worker also retries saved uncrowned records after characters finish conversion. If
no standings record was saved, it leaves the original standings unconverted for
retry. Character conversion can continue after a saved pending award fails.

The only runtime caller is `runSeasonRollover`. The stored season is the replay
identity and its original champion remains authoritative. Concurrent conditional
claims serialize on the same PostgreSQL row; no new role, route, schema or award is
introduced. Tests cover failure before record insertion, during the account award,
and after the award at notification insertion; retry after completed conversion;
concurrent duplicate claims; and a lost response after native COMMIT. Full canonical
snapshots and all ledger invariants accompany the checks. Original lifetime world
replay, hosted PostgreSQL16/18.4, full regression and source-pair recovery require
affected reruns after this runtime change. Previously observed incorrect production
records, if any, cannot be inferred or silently repaired from the reproduction.

Run from a clean checkout with explicit loopback `COORDINATION_TEST_DATABASE_URL`
and a fresh restricted `RC1_SEASON_OUTPUT`: `npm run test:rc1:season:postgres`.
The test uses the existing explicit season boundary option and does not claim an
elapsed28-day world. Contract, external signer and chain checks do not apply to this
status-only change; the full resource and deployment gates remain open.
