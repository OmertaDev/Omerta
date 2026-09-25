# RC1 source reconciliation — development repair record

Owner: **Codex/source_repairs** (release-source and authority engineering).
Phase: local prerelease integration, 2026-09-20 America/New_York.

This is targeted development evidence, not an exact final-candidate acceptance run
or release clearance. The release owner must freeze the integrated commit and rerun
the affected lanes. Earlier evidence remains attributed to its original revision.

## Source boundary and actual differences

- Main lineage inspected: `32859cf7d198d2a003160b2bb1ef005991697d73`.
- Assessed candidate: `cce721029c86de7c6f0d875fef7cb8de29504dda`.
- Sealed source: `a3d2d56aecc9e6d10c24e3c12ff9cf29e9257c8d`.
- Assessed and sealed runtime, schema, client, package, workflow, and tool/test
  paths are byte-equivalent in Git. Sealed evidence is not modified here.
- Main has identical `package-lock.json`, `schema.sql`, content, and contract
  source to the assessed candidate. There is no dependency, schema, content-rule,
  or contract deployment change in this repair. Local dependencies were reused
  through a junction only after lockfile comparison.
- Main adds bounded asynchronous world telemetry, a moderator-only funnel,
  observation-specific rate limiting, non-engagement event classification, and
  client observations. Passive screen/observation requests already preserve
  pending confirmation state on both client and websocket invalidation paths.
  These changes are retained.
- Main adds player-facing archive-key and canal-state explanations; these are
  retained. The diagnostics repair wraps existing command/telemetry execution
  without changing dispatch, receipts, authority, or gameplay effects.
- Main had removed fail-closed generic-column migration and private correlated
  command diagnostics. Both regressions are reproduced below and repaired.
- Main adds a `render.yaml` comment documenting telemetry's single-process
  boundary; it changes no configured deployment resources. CI retains the new
  telemetry lanes and regains the removed diagnostics, native migration, command
  replay, browser, backup and recovery checks. Existing workflow action versions
  are preserved; no historical CI pass is inherited.
- The assessed deterministic `pgcheck` section 9f deadlock barrier, campaign
  browser ordinary-click scrolling, and one explicit stale-command refresh retry
  had also been removed. These harness repairs are restored after inspecting the
  entire diff. Native engines have no retry hook and still fail immediately.
  New campaign/mobile output defaults use ignored `output/`, not sealed evidence.
- Simulation/scale/director differences are handed to the native proof owner;
  they are not silently treated as equivalent by this record.

The adjacent JSON records exact changed paths and hashes. The final manifest,
enabled deployment flags, workers, schedules, PostgreSQL extensions, deployed
integrations, and actual rollback predecessor belong to the integrated freeze and
operator attestation; local fixture settings do not establish those facts.

## Reproduced failures and retained repairs

| Gate ID | Before on main runtime | Repair and development retest | Affected final reruns |
| --- | --- | --- | --- |
| RC1-00-MIGRATION / RC1-06 | Native event trigger rejects `bank_credit_ms` addition; migration reports `failed:1` but stamps current schema and returns success. Restored assertion exits 1. | `migrateSchemaUnderLock` throws `schema_migration_incomplete` before later migrations/stamping. PostgreSQL test passes stamp preservation, retry, and reapplication. Fault trigger is scoped to its own schema. | Migration PostgreSQL, migrate, pgcheck, recovery, fresh and upgrade boot. |
| RC1-00-OBS / RC1-04 / RC1-06 | Real command executes successfully but response lacks a server-generated correlation ID; original privacy regression exits 1. | Restore closed-schema diagnostics for request/auth/command/mutation/consequence/opportunity/failure/response. Keep the bounded telemetry writer and funnel. Privacy, replay, direct revoked/banned denial, and throwing log sink pass. | Observability, commands/API, telemetry in memory and PostgreSQL, routes, recovery. |
| RC1-MOBILE-CONFIRM / RC1-05 | Main already contains the assessed repair plus command-observation exclusion. | Retain runtime and extend the regression to both passive endpoints; neither clears the client projection nor emits websocket refresh. Actual command invalidation remains enabled. | Passive projection, client, projection events, browser confirmation paths. |
| RC1-04-REPLAY | The assessment's native HTTP redteam harness was absent on main; no new exploit is asserted. | Restore 42 rejected authority/input cases, eight concurrent submissions, exactly one fresh execution, unchanged state on denial/replay, server reconstruction replay. Native run passes. | Native redteam plus complete role/route/family attack inventory. |
| RC1-05-PHONE | Assessment's native newcomer harness was absent on main. | Restore normal-control onboarding/first crime/Command Center command and receipt; expand to 320x568, 360x800, 390x844, 430x932. All four pass touch-area and overflow assertions with no JS errors. | All required screen/state journeys, physical iPhone and Android, wallet/keyboard, real cohort. |
| RC1-TOOL-PGCHECK-9F | Diff proves removal of the assessed pre-refund barrier and detector scheduling repair. No new full pgcheck run is claimed here. | Restore that barrier exactly; syntax validation passes. | Full real PostgreSQL pgcheck at integrated candidate. |
| RC1-TOOL-CAMPAIGN-MOBILE | Diff proves removal of assessed ordinary scrolling and logged one-time stale-command refresh. No campaign pass is inherited. | Restore those helpers; preserve normal hit-tested clicks and original execution-identity checks. Syntax and client checks pass. | Campaign mobile scenarios on the integrated candidate. |

Before reproductions ran in a separate checkout at main with only the restored
test files added; its runtime remained unchanged. After tests ran in the repair
worktree before commit. Exact hashes are retained in the JSON. These are
development runs, explicitly not a clean-tree final qualification campaign.

## Verification

Runtime: Node `v24.19.0`, PostgreSQL `18.4` Windows x64. Isolated loopback database
and per-test schemas/databases; no deployed database or service was used.

| Command | Result |
| --- | --- |
| `node test/rc1-postgres-migration-failure.js` | Before exit 1; after exit 0. |
| `node test/rc1-observability.js` | Before exit 1; after exit 0. |
| `node test/rc1-passive-projection.js` | Exit 0; screen and command observations. |
| `node test/rc1-command-redteam.js` | Exit 0; 42 denials, 8 concurrent requests, restart replay. |
| `node test/rc1-mobile-postgres.js` | Exit 0; all four phone widths, no findings. |
| `node test/world-telemetry.js` and `--postgres` | Both exit 0; bounded nonblocking writes, attribution, replay deduplication, moderator access. |
| `node test/player-commands.js --postgres` | Exit 0; 17 groups, including independent-process HTTP replay, rollback, post-commit read failure, replacement authority, migration reapplication. |
| `node test/migrate.js` | Exit 0; 2,956 additive statements and schema/death dispositions. |
| `node test/projection-events.js` | Exit 0. |
| `node test/player-command-api.js` | Exit 0. |
| `node test/player-command-client.js` | Exit 0. |
| `node test/routes.js` | Exit 0; mounted-surface/authentication and client contracts. |
| `node --check` changed JavaScript; `git diff --check` | Exit 0. |

Native tests use `COORDINATION_TEST_DATABASE_URL` for the disposable schema lanes
and `RC1_TEST_DATABASE_URL` for tests creating their own temporary databases.
`RC1_MOBILE_EVIDENCE` optionally chooses a new evidence directory. No secrets are
retained in this record. Raw local outputs are under
`output/source-reconciliation`; representative exact outputs and artifact hashes
are retained in the adjacent JSON.

## Scoped security method and system model

The repository security policy's exact pinned checkouts were verified:
Pashov `c577eb7799c349de0acb187ba00ca98e14e436fd`, Plamen
`795962b96e254f2e423a2635fe7f8cb8ea1e6d69`, Trail of Bits
`d3323cefbcf645678b8dc481de204b02ad3d02dc`. Applied methods were Pashov's
`solidity-auditor/references/hacking-agents/access-control-agent.md` permission
surface/guard comparison, Plamen's `agents/skills/injectable/outcome-determinism/`
sequence-dependent outcome pass, and Trail of Bits' `audit-context-building`
caller/trust-boundary tracing. Adaptation: direct JavaScript/PostgreSQL inspection
and executable regressions in this assigned agent; no upstream orchestration,
contract audit, compiler/fuzzer execution, or whole-repository review is claimed.

Entry points are authenticated command snapshot/execute and bounded observation
routes. Caller inputs supply only confirmation and a server-issued identity;
account/character, stored board, expiry/fingerprint, and domain receipts enforce
authority. Dispatch retains canonical transactions and locks. A repeated issued
identity resolves the original durable domain receipt. Observations write only
non-authoritative telemetry; diagnostics carry only generated correlation IDs,
closed phase/outcome enums, booleans and bounded integer counters. Logs never
receive domain objects, caller correlation IDs, tokens, targets or raw errors.
Generic schema additions can partially commit, but startup/stamping must stop and
retry idempotently under the boot advisory lock. No on-chain transfer, callback,
economic-rule, or public integration activation changes here.

Static triage is scoped manual diff/caller review plus JavaScript syntax and
mounted-route assertions. Confirmed regressions are the two above. No claim of
complete static analysis, complete command-family/role matrix, all legacy route
tampering coverage, XSS/CSRF coverage, or an exploit-free release follows.

## Remaining proof boundaries

The restored redteam exercises one canonical mystery command through the complete
HTTP server; the separate 17-group native suite covers additional command
boundaries. Neither proves the complete RC1-04 role/command/legacy-route cross
product. The phone check is automated Chromium viewport emulation and synthetic
newcomers, with reload after a command. It does not satisfy returning-player
journey B, actual intervening social/world changes, physical Safari/Chrome,
wallet handoffs, every screen/state, 750 ms network adversity, large-list bounds,
human comprehension, or the seven-day cohort. Full campaign, full pgcheck,
Linux termination/backup, integrated CI, matrix/resource, deployment and cohort
results must be retained separately by their owners. No historical evidence is
promoted to a new candidate pass.
