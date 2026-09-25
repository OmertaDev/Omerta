# Production fixes deployment — 2026-09-25

The user explicitly requested “Merge any fixes to prod” after stopping the soak. This is an authorized fixes deployment, **not technical launch qualification**. The 12-hour soak remains incomplete; its 15.078-minute prefix is retained. The matrix remains waived, zero passed; external owner/device/cohort validation remains BLOCKED_EXTERNAL. No external rail or feature activation is part of this release.

## Source and integration

- [x] Preserve the newer production NFT/paid-character release at `35a4295ac387a9bea1e8257e0c828a1329ca3247` (PR184).
- [x] Candidate22 source `982220305bf9738f63b0ca5561dc42938b1a2457` has passing full CI36069862467 and focused PostgreSQL/reconnect evidence. Those results retain their exact scope.
- [x] Sol prepared `codex/rc1-prod-integration-20260925` from current main `6bd1a1da`, merged Candidate22's reporting descendant `96deb84c`, and merged reviewed dormant-RWA/growth fixes through `636c82e1`. Conflicts were limited to generated knowledge, package scripts and the measured census; runtime source, schema, UI and tests merged cleanly.
- [x] Integrated application source is `e4a634c24d7bad480fe8d2b6f29a6d263694e572`. NFT, growth, RWA, gates, smoke and knowledge checks pass locally. Required merged-tree CI remains pending on the integration PR; earlier candidate CI does not substitute for it.
- [x] Exact live-predecessor compatibility passed on PostgreSQL18.4: `e4a634c2` upgrade → `35a4295a` rollback → replay → second upgrade preserved acknowledged state and receipts. Private result: `source-pair-e4a634c2-35a4295a-v2/result.json`, status `PASS_SCOPED`.

## Actual production configuration, read 2026-09-25

| Item | Observed configuration |
| --- | --- |
| Workspace | My Workspace, `tea-d9gkgfbbc2fs738o1jkg` |
| API | `srv-d9gkiscm0tmc73cc7ah0`, Starter, one instance, Oregon |
| Worker | `srv-d9gkiscm0tmc73cc7agg`, Starter, one instance, Oregon |
| Database | `dpg-d9gkii4m0tmc73cc6uf0-a`, `omerta_db`, PostgreSQL18.4, pro_4gb,15GB,HA, no pooler/replica |
| Branch/deploy mode | Both `main`, autoDeploy yes, checksPass; avoid a duplicate manual deploy after push |
| Existing live source | Both `35a4295ac387a9bea1e8257e0c828a1329ca3247` |
| Rollback deployments | API `dep-daqr94s9v7es739aqdp0`; worker `dep-daqr94s9v7es739aqe7g` |
| Build/start | `npm ci --omit=dev`; API `npm start`; worker `npm run worker` |
| Runtime | Actual original processes: Node22.23.3, Debian12,0.5CPU/512MiB each; prior soak used22.23.2 |
| Source consistency | Both original runtime manifests match:278files, SHA256 `76a02725722fb2e940ee5dea6c95c5a657f02fe76ef70f4e76bb2f2c113701d4` |
| Database target | Both original processes point to the same production database |
| Schema before deploy | app1.2.0, schema stamp `23e9ffbcca1ce2c0` |
| API protections | RATE_LIMIT on, TRUST_PROXY on, INVITE_MODE on, SOCIAL_VERIFY_MODE live, pool40 |
| Worker | INVITE_MODE on, default pool; hourly heartbeat/job tick, daily invariant work; source-controlled conditional schedules retained |
| Core/world/director switches | Raw environment keys absent, existing source defaults apply; no setting changed |
| Genesis/liquidity | GENESIS_LAUNCH_PHASE legacy, LIQUIDITY_AUTOMATION_ENABLED off on both |
| Chain | CHAIN_ID4663, confirmations5, CHAIN_RPC_URL absent on both; source explicitly leaves chain synchronization/parameter reads dormant without RPC |
| OMR/contracts/funding | OMR/Bond/Fees variables present; treasury-address variable absent. No connectivity, mint, transfer, funding or liquidity action authorized by this fixes deployment |
| Secrets | JWT_SECRET, MARKET_SEED, MOD_KEY present and equal across both processes, privately compared; values omitted. Existing integration-key presence retained privately; no environment values changed |
| RWA reviewer | Disabled on both actual environments; no reviewer authority enabled |

- [x] Exact integrated preflight module SHA256 `aace2526ead5c95f10054311d9d77a4f8589bddf26103f40a0b7f6e1b022f705` evaluated read-only on actual API environment: zero errors/warnings.
- [x] Worker startup uses `testOnlyLeaks()` rather than the API's complete preflight. Applying API-only validation to the worker records SOCIAL_VERIFY_MODE/TRUST_PROXY findings; these do not apply to that entrypoint. Original results remain retained; do not change worker settings to silence an inapplicable API check.
- [x] Worker heartbeat observed at00:41:46.657Z (3191s age at observation), within its original hourly schedule. Postdeploy fresh heartbeat and startup/tick logs still required.

## Production backup

- [x] Consistent read-only dump finished01:30:38.962UTC before deployment. `production-before-merge.dump`,3,101,991bytes,SHA256 `c8f7c16e728a15e2f0d865ef42e192fe89cc1bfb3f0075a813ff4077ddb65f31`.
- [x] Readable372-table-data TOC includes all required identity/value/item/mystery/operation families. Decompressed archive data confirms161accounts,138characters,47830transactions. No destructive restore or production database mutation was used for verification.
- [x] Backup and retained runtime/config evidence are in the owner/SYSTEM-only directory `C:/Users/Jorge/.codex/rc1-readiness-private-20260921/production-fixes-release-20260925`. Connection credentials remain private and are excluded from Git.

## Sol-owned release and minimum smoke

- [ ] Required merged-tree checks pass; Sol then performs final merge/push to main. Both services auto-deploy after checks pass.
- [ ] Confirm API and worker live at the exact resulting source; record provider deployment IDs/timestamps.
- [ ] Confirm health/DB connectivity, expected schema state, fresh worker heartbeat, scheduled startup/tick logs, and no new critical application errors.
- [ ] Run the minimum ordinary smoke journey appropriate to the existing invite/paid-character configuration. Do not purchase a character, move funds, enable chain rails, or mutate existing players for smoke.
- [ ] Confirm dormant chain/OMR/liquidity behavior is preserved. No live external-rail validation is claimed.
- [ ] On critical smoke failure, Sol rolls back both services to the exact predecessor `35a4295ac387a9bea1e8257e0c828a1329ca3247`; preserve data and do not restore over new production activity without an explicit need and review.
- [ ] Record final deployment evidence and limitations, including the stopped soak. Never relabel this as technical qualification.

The three former soak resources are deleted, their key revoked, guardian cancelled, and launch heartbeat paused. This release does not restart them.
