# RC1 gate report

Frozen main: `626e61b9ab2b14a9dc45566983b70cdc65692839`.
First repaired source: `4d35c8e8b3a1db696f1bf5b5e8b7b0dc327cecb1`.
Final clean proof candidate: `cce721029c86de7c6f0d875fef7cb8de29504dda`.
Full-CI application source: `21d0589a8b1f15cbb712e574becd507b813e4b0c`.
Earlier clean proof: `29a49c6b7673b22c2e803dd2473dc5c7fa03f46a`.
All executed checks below have terminal results. Missing coverage remains explicit.

Main independently advanced during this freeze to 468516d8d6f3729514711ad5a0b83e440c5c46f9
by merging the prior validation branch. This table applies to the exact pinned sources
above, not that newer main; `evidence/hosted/main-advanced-after-freeze.json` records it.

The per-command result JSON files in `evidence/baseline/` retain arguments, source SHA,
tracked-source diff hash, timestamps, Node/platform, exit code and adjacent raw log.
Exploratory dirty-worktree runs are not represented as clean frozen-main results.
The separate pristine worktree and hosted candidate runs provide exact-revision checks.

Failure classes: A release blocker; B nonblocking defect; C proven stale test;
D tooling defect; E environment defect. Missing required evidence blocks release
without being represented as a demonstrated gameplay exploit.

## Confirmed failures and dispositions

| ID | Classification | Reproduction and evidence | Repair / current disposition |
| --- | --- | --- | --- |
| PG-01 | A | `node test/rc1-postgres-migration-failure.js` with isolated `COORDINATION_TEST_DATABASE_URL`; `evidence/postgres/migration-failure-baseline.log` | Missing required column was stamped current and startup permitted. `src/db.js` now fails closed before stamp. Native fault/retry and PostgreSQL16 hosted retests pass. |
| RC1-OBS | A | `node test/rc1-observability.js`; `evidence/baseline/observability-before-*.log` | No command correlation chain. Added server-generated request IDs and allowlisted nonthrowing diagnostics; success/replay/invalid/revoked/banned paths pass. |
| PG-02 | D | `npm run pgcheck`, deadlock fixture section9f; `evidence/postgres/pgcheck-baseline-failed.log` | The artificial holder became the victim. Fixture now pauses the exact refund and establishes the reverse wait; assertions unchanged; 203/203 pass. |
| BACKUP-WINDOWS | E | `bash tools/backup-selftest.sh`; `evidence/postgres/backup-selftest.log` | NTFS reports0644 rather than POSIX0600. Native restore passed. Fresh Linux permissions+restore gate passes at 29a49c6b. |
| SIGTERM-WINDOWS | E | Native `npm run chaos`; `evidence/postgres/chaos.log` | Windows process termination is not POSIX drain. Fresh Linux nine-barrier run passes at 29a49c6b; Windows failures retained. |
| KNOWLEDGE-DIRTY | D | `node tools/knowledge.js check` in actively edited checkout; `evidence/baseline/knowledge-graph-*.log` | Clean frozen main passes (7,521 nodes/33,370 edges). Clean candidate regenerated and checks pass (7,548 nodes/33,486 edges). No test was weakened. |
| PHONE-HARNESS | D | First `node test/rc1-mobile-postgres.js` attempts; `evidence/baseline/mobile-postgres-*.log` | Used hidden desktop navigation, then failed to dismiss an actual result dialog. Correct visible mobile controls/modal close yield pass on both phone sizes. |
| OBS-HARNESS | D | First post-repair observability test | Fastify onResponse completes after inject resolves. Awaiting the event loop observes the real hook; the full expected stage chain remains required. |
| RC1-MOBILE-CONFIRM | A, repaired | `node test/rc1-passive-projection.js`; `evidence/security/passive-projection-initial.log` | Passive `POST /v1/screens` invalidated the World projection and canceled pending confirmation. Exact-route client/server exception; seven affected suites pass. Gameplay invalidation remains required. |
| RC1-CI-INVENTORY | C/D, repaired | `node test/gates.js`; `gates-current`, `gates-registered`, `gates-final-registration` and `gates-added-migration` logs | Newly added proof tests needed CI registration; the exact native-command inventory needed the new migration gate. Preserved every pre-existing lane, timeout and assertion. Request context moved from a module WeakMap to the request itself, satisfying the existing mutable-state guard. Final candidate passes. |
| RC1-DOC-CENSUS | C/D, repaired for candidate | `node test/docs.js`; `docs-current` and `docs-census-retest` logs | New diagnostic module/tests required updating measured SPEC counts. Untracked release reports explained the additional local markdown count. The clean candidate passes with 273 modules, 267 test files and 605 markdown files. Evidence-package documentation is measured separately. |
| CAMPAIGN-BROWSER-HARNESS | D, repaired | `node tools/rc1-campaign-mobile.js`; initial `evidence/mobile-campaign` failures | Normal clicks initially reached unstable/off-viewport controls or an expected stale-command409. Scrolling real controls clear of fixed bars and reissuing only on a classified refusal preserves real hit testing and independently checks each issued identity. All ten final cells pass; no409 occurred in the final run, so recovery after409 is not claimed as observed. |
| PHONE-ONBOARDING-HARNESS | D, repaired | [Linux failure at 21d0589a](evidence/hosted/linux-final-failed.log), photographed native slow-network failure | A fixed pause/generic close button did not handle the actual lockup tutorial's `got it`. Wait for the real action to finish, then use actual dismissal controls. Local normal/slow-network runs and the complete Linux workflow pass at cce72102. No game UI changed. |
| PHONE-NETWORK-CENSUS | D, repaired | `mobile-network-initial.log`, `mobile-network-instance-table.log` | The evidence script initially measured legacy mystery/content tables for a discovery command. Canonical dispatch uses Coordination. Final proof measures its actual instance/receipt plus seven other domain tables across a lost committed response and exact-ID replay. |

Additional classified native orchestration/compiler/provisioning failures remain in their scoped
reports and raw logs, including expected safe-database-name refusals. The matrix below records
the completed lifecycle, mobile campaign and Foundry runs.

## Exact-revision evidence rules

The baseline root runner started at frozen main while independent repairs were being made.
Its full `npm-test.log` is an exploratory run, not an immutable-main proof. A separate clean
detached checkout runs the original `npm test`, retained as `npm-test-pristine.log` and its
terminal result JSON. Native reports retain the actual source hashes and fixture limitations.
The final hosted candidate contains the repairs and refreshed Knowledge artifacts in a clean
commit. No historical branch report is accepted as a fresh result.

That exploratory `npm test` completed its executable suites through the guard/chain checks,
then exited1 at the documentation census because the eight new release reports changed
605 markdown files to 613. This is **C/D: stale measured documentation during evidence
assembly**, not a gameplay failure. After recording613 files/150,323 lines in SPEC,
`node test/docs.js` passes (`evidence/baseline/docs-evidence-package.log`). The pristine
and hosted runs remain the clean-revision lifecycle evidence.

The full-CI source's local `node tools/knowledge.js check`, `node test/gates.js` and
`node test/docs.js` all exited0. Its Knowledge graph has 7,555 nodes/33,524 edges;
259 test suites are run or explicitly declared. See
[candidate-local-checks.json](evidence/hosted/candidate-local-checks.json).

After the phone test repair, those same three checks pass on final candidate cce72102;
see [exact final checks and logs](evidence/hosted/cce72102-local-checks.json).
The final tree differs from 21d0589a only in the phone harness, the workflow's evidence
upload paths and regenerated Knowledge artifacts. Application, contract, schema,
package/lockfile and full-CI test-chain source bytes remain identical. Full lifecycle
results retain their 21d0589a identity; the affected phone and recovery workflow reruns
on the final SHA. This is source-scoped verification, not retroactive relabeling.

## Gate matrix and reproduction

Commands run from the repository root. PostgreSQL commands require disposable databases and
their documented environment; see the exact invocations in the linked reports. The Windows
PostgreSQL18 cluster is separate from hosted Linux PostgreSQL16. Neither pg-mem nor a model
counts as PostgreSQL evidence.

| Required gate | Command / result | Evidence |
| --- | --- | --- |
| Frozen-main full lifecycle | `npm test` — PASS, exit 0 in clean detached checkout at 626e61b9; 2026-09-20 22:59:43 to 2026-09-21 00:00:09 UTC | `evidence/baseline/npm-test-pristine.result.json` and adjacent log |
| Repaired application full CI | `gh workflow run ci.yml --ref codex/rc1-closure-proof` at 21d0589a — PASS both jobs: full npm lifecycle, PostgreSQL, economy sim, scale, invite unit/browser and mobile | [run 35544649446](https://github.com/OmertaDev/Omerta/actions/runs/35544649446), `evidence/hosted/ci-21d0589a-run.json` and adjacent full log |
| Real PostgreSQL integration | All 19 native gate commands PASS; full earlier hosted PostgreSQL job PASS | [PostgreSQL report](RC1-POSTGRES-REPORT.md), `evidence/hosted/ci-29a49c6b-postgres.log` |
| SQL parsing | `npm run pgquery` — PASS 4,059 static statements; dynamic sites separately counted | `evidence/postgres/pgquery.log` |
| Pool/lock/ledger migration checks | `npm run pgcheck` — PASS 203/203 after fixture repair | `evidence/postgres/pgcheck.log` |
| Definition registry | `npm run phase2:definitions:postgres` and `node test/phase2-definition-invariants.js` — PASS | PostgreSQL definition log; `evidence/baseline/definitions-*.json` |
| Knowledge graph and artifacts | `node tools/knowledge.js check`, `node tools/knowledge-test.js` — PASS on clean frozen main and final candidate cce72102; final graph 7,557 nodes/33,536 edges | Pristine logs, `evidence/hosted/cce72102-local-checks.json`, `cce72102-knowledge-artifacts.json` |
| World Graph | `npm run worldgraph:check`, `npm run test:world-kernel:postgres` — PASS | Baseline World Graph and native Kernel logs |
| Invariants | `npm run invariants` — PASS 55 baseline checks; native per-transition sweeps PASS within scope | [simulation report](RC1-SIMULATION-REPORT.md) |
| Simulation regression | `npm run sim`, `npm run scale`, `node test/director-simulation.js`, `node test/rc1-simulation.js` — PASS within declared scope | Simulation baseline and regression logs |
| Native population simulation | `node tools/rc1-sim.js --postgres ...` — PASS 25/100/250/500/1000; six runs,6,866 commands,454,355 assertions | `evidence/simulation/run-summary.json` |
| Entry population/replay | `node tools/rc1-command-population.js --players N --rounds 2 ...` — PASS all five populations; 516,175 assertions | Simulation population JSON/transition journals |
| Full canonical equilibrium/resource matrix | Required 75 cells and all-resource internal-transition coverage — MISSING REQUIRED PROOF | `evidence/simulation/blockers.json`, `matrix-coverage.json` |
| Foundry | `C:/Users/Jorge/.foundry/bin/forge.exe test --root omerta-contracts -vvv` — PASS: 1,247 tests,82 suites, zero failed/skipped; full 512×500 invariant budget | `evidence/security/foundry-provisioned.log` |
| Migration fault/retry | `npm run test:db-migration:postgres` — native18 and hosted16 PASS | Native migration failure/retest and hosted recovery |
| Restart, real SIGTERM and rollback | `node tools/rc1-shutdown.js`, `npm run backup:selftest`, native rollback proof — PASS; final Linux workflow including phone/tampering tests PASS at cce72102 | [final run 35545394093](https://github.com/OmertaDev/Omerta/actions/runs/35545394093), `evidence/hosted/linux-cce72102/`, PostgreSQL report |
| Route/frontend | `node test/routes.js`, `node test/client.js`, `node test/player-command-client.js` — PASS | Baseline and passive-repair retest logs |
| Browser | `node tools/mobile.js`, `node test/launch-invites-browser.js` — PASS scoped 175 screen checks and invite flow | [first-session report](RC1-FIRST-SESSION.md) |
| Real PostgreSQL phone entry | `node test/rc1-mobile-postgres.js` — PASS 390×844 and 360×800 | `evidence/mobile/journeys.json` |
| Mobile campaign/investigation/conflict | `node tools/rc1-campaign-mobile.js` — PASS five branches × two widths,514 rendered commands | [journey report](RC1-JOURNEYS-REPORT.md) |
| Continuous social entry | `node docs/release/evidence/mobile-social/social-membership.mjs` — PASS two widths, eight UI social mutations and 60 subsequent Player Commands; no preinserted membership for the ordinary actor | `evidence/mobile-social/results.json` |
| Slow network and committed response loss | `node docs/release/evidence/mobile-network-proof.mjs` — PASS both widths;750ms network latency, real saved-move replay, unchanged canonical census,24-character input and reduced-height viewport | `evidence/mobile-network/journeys.json` |
| Authorization/Knowledge/common command tampering |18 targeted regressions and `node test/rc1-command-redteam.js` — PASS scoped 42 denials, concurrent single execution and restart replay | [security report](RC1-SECURITY-REPORT.md) |
| Correlated diagnostics privacy | `npm run test:rc1:observability` — PASS; exact candidate hosted rerun included | Baseline observability and passive retest logs |
| Production configuration / live contract boundary | No selected deployment or live configuration attestation — UNVERIFIED | Freeze manifest and release report |
| Controlled real-player cohort | No deployment or real participant sessions recorded — NOT RUN | Release report; bot/fixture metrics are excluded |

The linked JSON records are authoritative for exact arguments, timestamps and source bytes;
table ellipses denote required fixture-specific paths, not omitted assertions.
