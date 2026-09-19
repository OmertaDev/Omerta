# RC1 release decision

RC1 is blocked. A genuinely new solo player cannot complete the required first world-changing action: after obtaining the archive key and wire, the world command still requires Family leadership and an eligible Crew. This is a mismatch between the requested solo release journey and the existing authority policy, not a reason to bypass that policy.

This decision is being assembled while independent gates finish. Pending results are not passes. The final evidence index will identify the exact corrected source, commands, environments and gate results.

## Source and environment

Frozen main: `626e61b9ab2b14a9dc45566983b70cdc65692839`. The immutable manifest and definition hashes are in [RC1-MANIFEST.md](RC1-MANIFEST.md). Corrected source revision and its final checks are recorded in the evidence index after the correction commit.

Hosted runs use clean Ubuntu, Node 22, PostgreSQL 16 for application/recovery and PostgreSQL 18 for liquidity. Local supplemental runs use Windows, Node 24.19.0, Chromium and disposable PostgreSQL 18 schemas. No production account, signed parameter or deployed economic rail is changed.

## Release blockers and reproduction

### RC1-P0-001 — required solo progression cannot reach a world consequence

Run `node tools/rc1-mobile-journeys.js` with Chromium available. The harness creates a new account at 320px and 390px, follows actual discovery, travel, vehicle acquisition, salvage and crafting, then attempts the archive action. Read the held inventory, locked command and screenshots in `evidence/player/mobile/`. `src/world-kernel.js` requires Family boss/underboss authority and an eligible Crew for this action. A fixture with assigned Family roles cannot substitute for the requested solo journey.

Disposition: preserve authorization; do not enable the cohort. A release needs a reviewed solo-authorized progression path or an explicitly revised acceptance journey. No authority exception is introduced by this validation package.

### RC1-GATE-002 — complete mobile campaign matrix not yet proven

Existing mobile coverage and the new solo browser path do not establish every Crew, Family, shipment, market, Informant and Dock War branch at both target widths and all interruption modes. Run `node tools/rc1-campaign-mobile.js` with `COORDINATION_TEST_DATABASE_URL` set to a disposable loopback database for the supplemental multiplayer UI lane. Treat its exact recorded scenarios as coverage; do not extrapolate them to untested branches.

### RC1-GATE-003 — population evidence has explicit coverage limits

Run `node tools/rc1-sim.js` with a disposable loopback PostgreSQL URL. The report distinguishes actual command/population evidence from state-model simulation and identifies unmeasured sustained concurrent population behavior. See [RC1-SIMULATION-REPORT.md](RC1-SIMULATION-REPORT.md). The cohort remains blocked until required invariants are supported at the requested workload scope.

## Evidence under review

- Application, SQL, PostgreSQL, concurrency, chaos and economic gates: `evidence/gates/`.
- Contract and liquidity results: pinned hosted Foundry and liquidity workflow logs in `evidence/gates/`.
- Golden stories, first-session audit and mobile: [RC1-PLAYER-VALIDATION.md](RC1-PLAYER-VALIDATION.md).
- Opportunity quality: [RC1-OPPORTUNITY-QUALITY.md](RC1-OPPORTUNITY-QUALITY.md).
- Security and shutdown: [RC1-SECURITY-OPERATIONS.md](RC1-SECURITY-OPERATIONS.md), including nine Linux production-process SIGTERM barriers.
- Telemetry: authenticated presentation observations in the existing telemetry store; moderator-only `/v1/mod/release-funnel`; canonical operation/campaign/item/history counters are separate from untrusted UI observations. Focused regression evidence is under `evidence/security-operations/`.

## Migration, rollback and feature flags

No schema or signed economic parameter changes. Real PostgreSQL migration evidence is mandatory. Before a future cohort, verify the actual deployed schema stamp, backup/restore rehearsal and matching API/worker revision. Roll both services back together using `DEPLOY.md` section 8c; retain committed data and recover using existing receipt identities rather than generating replacement actions.

Director remains disabled in the default configuration. A future cohort must use `LIMITED_COHORT` with matching nonempty `DIRECTOR_ACCOUNT_IDS` and `COORDINATION_ACCOUNT_IDS`, existing foundation flags on and invite admission on. No cohort is enabled while this report is blocked. No chain signer/RPC or liquidity activation is authorized; no live configuration is inferred from repository defaults.

RC1_STATUS=BLOCKED
