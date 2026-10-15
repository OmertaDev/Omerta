# Backend integration review — 2026-10-14

Source C: `b602dc0da8fd3922ae53b84d23e4e46b6e90439f`.
Upstream baseline: `fe4a75a8b21fc41fd3d3bc75cf7720612c581463`.
Phase: local merge/integration verification. This report does not authorize or attest a deployment.

## Scope and source binding

Owned scope was backend `src/`, backend `test/`, and `schema.sql` integration, excluding
the separately assigned genesis/market keeper implementation and associated deployment tests.
[Source hashes](backend-evidence/source-hashes.json) inventory changed owned files at C, with
Git-blob SHA256, CRLF-to-LF-normalized SHA256, and separately identified host-file hashes.
This inventory identifies integration ownership; it does not claim an independent security audit
of every listed line. Report/evidence additions do not change source C.

Merge intent was to retain newer upstream city, commerce, resource, authorization, migration,
and command-projection behavior while integrating the pending Gateway, legal/age, database-RLS,
payment-receipt and deed-supply work. All 484 upstream declared table identities remain in
the merged schema; seven new identities were added. The native migration receipt reports
488 protected actual tables; textual declarations and runtime catalog counts are different measures.

## Trust boundaries retained or integrated

- The real server remains the authority for player sessions, current characters, permissions,
  inventory and mutations. Gateway proposals/previews do not replace domain authorization.
- Gateway credentials are scoped, revocable and revalidated. Native tests cover cross-instance
  rate limits, subscription limits, durable preparation recovery and cursor precision.
- Existing command-projection retries reauthenticate and reproject private state rather than
  returning a cached board. New Gateway registration preserves upstream route registrations.
- Schema migration remains fail-closed and retains city-home storage migration and the existing
  one-time player-reset identity. RLS installation follows those migrations, before schema stamping.
- Direct SQL roles are denied game-table access; the trusted backend must own/bypass protected
  tables. This is not per-player isolation inside the backend connection.
- Receipt delivery uses committed database state, independent marketing consent and leased claims.
  Deed issuance uses the shared durable lifetime-supply row and transaction rollback.
- Synthetic-adult fixtures apply only to unrelated test requests. Age and legal suites continue
  importing the real server for missing-age/ineligible-age controls.
- SQL values remain bound parameters. Bounded IN lists generate numbered placeholders; fixed
  Gateway timestamp expressions depend only on boot-established database capability and literal columns.

## Executed evidence

Runs were local on 2026-10-14: Windows, Node `v24.19.0`, PostgreSQL `18.4`, `pg` `8.22.0`,
`pg-mem` `3.0.14`, Acorn `8.18.0`. No fuzz campaign was run for this integration task.
There is no fuzz seed: cases are deterministic; UUIDs/random suffixes only isolate fixtures.

The isolated PostgreSQL instance listens on `127.0.0.1:55438`, with newly initialized data under
`output/release/2026-10-14/backend-checks/postgres/data`. Native commands used
`COORDINATION_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:55438/omerta_release_native`;
the Gateway command additionally used the identical `GATEWAY_TEST_DATABASE_URL` endpoint.
No production database endpoint or credentials were used. This disposable instance used local trust auth.

| Command | Result and retained evidence |
| --- | --- |
| `node test/db-rls.js --postgres` | Exit 0: owner access, restrictive direct-client denial, legacy permissive-policy resistance, repair/idempotence. `rls-native.*` |
| `node test/payment-receipts-postgres.js` | Exit 0: 488 protected tables; actual commit/rollback isolation, opt-out independence, replay prevention, concurrent claim and direct-client denial. `payment-receipts-native.*` |
| `node test/gateway-postgres.js` | Exit 0: exactly 60/65 concurrent admissions, rollover/revocation, subscription cap, microsecond ties/replay, and committed/no-receipt preparation recovery. Source hashes appear in `gateway-native.log`. |
| `node test/deeds-supply-postgres.js` | Initial exit 1: minimal fixture lacked upstream `home_authority_token`. Retest exit 0: extracted supply, rollback, final-slot lock serialization and boot replay. Both `deeds-supply-native.*` and `deeds-supply-native-retest.*` retained. |
| `node test/readiness-migration-failure.js` | Exit 0: injected real DDL failure refuses startup/stamp; retry and reapplication succeed. `migration-failure-native.*` |
| `node test/migrate.js` | Exit 0 on pg-mem: 1,101 statements reapply, 4,076 derived column migrations, 149 character-scoped table dispositions. `migration-memory.*` |
| `node test/gates.js` | Final exit 0: 232 interpolations (148 shape-safe; 60 distinct declarations), 47 concurrency sites, all 623 suites invoked or declared, exact CI lanes/inventories. `gates-retest3.*` |

Logs and exit records are in [backend-evidence](backend-evidence/).
[Evidence index](backend-evidence/evidence-index.json) records commands, results and SHA256.
Earlier gate failures are retained as `gates.log`, `gates-retest.log`, and `gates-retest2.log`.
Their companion exit records were reconstructed from captured tool exit status 1; the index labels
this explicitly. Other copied exit files were written by the execution wrappers.

## Resolved integration defects and leads

| ID | Disposition and retest |
| --- | --- |
| BACKEND-INT-001 | Resolved build defect: automatic merge duplicated `depotActions`, `resetStartingLevels`, and mystery discovery/exploration functions. Removed duplicate copies while retaining upstream knowledge-snapshot behavior. Native syntax checks exposed the issue; later executable suites imported the corrected modules. |
| BACKEND-INT-002 | Resolved SQL extraction defect: the bounded Crew aggregate exposed a literal prefix lacking `GROUP BY`. Split complete bounded/unbounded query branches; removed three redundant lock interpolations in deeds/operations. Values remain bound. SQL ledgers pass; PostgreSQL PREPARE is separately recorded by the parent release review. |
| BACKEND-INT-003 | Resolved test-fixture defect: deed-supply proof omitted upstream home-authority column. Added the fixture column; preserved initial failure and successful native final-slot retest. No production repair was needed. |
| BACKEND-INT-004 | Resolved verification-integration gaps: classified new RPC/pool concurrency and fixed timestamp/index SQL expressions; preserved exact-match/stale-declaration checks. Declared two imported helpers and wired three otherwise orphaned executable suites into CI; updated exact browser/native command inventories. Gates pass. |
| BACKEND-INT-005 | Resolved source-seal mismatch after complete diff inspection: `explore.js` changed player-facing copy and added `depot_id` to an existing SELECT. Its scoped-social-context AST seal and ANY bindings were unchanged. Recomputed whole-file LF hash independently with PowerShell and Node: `797a2b76833968049f21c78dffa02b9b60b3eb975a8e3c8bc1ab5228985f8f88`. Byte-seal negative controls still pass. |
| BACKEND-LEAD-001 | Closed as a new-release concern: player-reset migration and public signup were already upstream. Preserving their existing identities avoids presenting either as a newly introduced production action. Actual live database state was not inspected. |

## Limits

This is a scoped integration review, not a full protocol audit, exploit absence proof, or launch claim.
The native checks used disposable schemas and synthetic actors. They do not establish sustained load,
hosted-environment behavior, complete game-economy correctness or PostgreSQL 16 equivalence.
The final gate log predates this documentation addition; no passed check was rerun to produce this report.
Post-C changes by other release work are outside C and require their own source binding.

No production environment configuration, real operator/DMCA registration, live database state,
wallet/signer, RPC fork, deployed contract runtime, target-chain rehearsal, broadcast or activation
was verified by this task. Required legal configuration and trusted-backend database privileges
remain deployment checks. Existing hook evidence is unchanged and retains its own source limitations.
