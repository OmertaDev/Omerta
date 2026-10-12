# Integrated employment API, estate and accounting proof

Reviewed test source `92183ee162dc5fb5c120c3f55b0fe5d0e3b7edc2`, against actual coordinator wiring `e9d2aa81c4547ec792efa7a75270c8afa98151db` and canonical-actor correction `56ccfe6e03c8a1b161e3203179cc0fa2605a6d39` (identical correction imported locally as `a1e56b78`). Date 2026-10-12. Phase: isolated actual integrated game-cash release proof, before deployment/activation. This agent changed only `test/gameemployment.js`, new `test/gameemployment-integration.js`, and this review. Shared server/estate/invariant/gateway/migration changes belong to the coordinator and were adopted as its supplied base, not edited locally.

The new proof requires the employment routes to be registered by actual `buildServer`; it has no manual registration seam and never invokes `voidEmploymentAtDeath` directly. It enrolls real signed human/agent JWT accounts, configures company metadata through its authenticated owner route, creates/funds/restocks a canonical depot through API, accepts an original canonical delivery, creates prepaid employment through API, and pairs explicit worker acceptance/claim through actual routes. A third original financier funds/takes the canonical delivery advance through API; canonical procurement obtains actual cargo, and the actual delivery route performs full financed delivery and repayment. Payroll then moves exactly one backed wage. SQL assertions check the sole canonical wage ledger row, immutable source settlement and no-effect HTTP replay/double-claim refusal. Fixture cash topups have corresponding known cash ledger rows; no cargo or delivery completion was fabricated.

Production `runLedgerInvariants` runs at reserved, financed wage/replay, player estate, mod estate, native rollback and NPC estate boundaries. Every global check must pass; the proof explicitly requires both integrated named `game employment escrow` and `game employment loot ledger` checks, without appending a test-only checker. Stranger JWT boards are empty. Native tests use fresh empty-public owned loopback databases, so these are full invariant conclusions for the isolated execution rather than delta-only checks.

Actual player estate uses canonical `runEstate` under original sorted killer/victim locks, with its real `killerCh` and `loot:true`. The canonical estate itself invokes payroll; the proof observes its closed/zero reserve, approved/clamped killer loot and remainder burn, and original in-memory killer credit surviving outer persistence. Actual authenticated `/v1/mod/kill` uses the no-killer estate path and burns the complete remaining reserve. Repeating that actual mod route refuses the already dead original victim. Heirs replay exact historical HTTP receipts with no new charge and cannot refund old reserve or create employment against the old closed depot. Native enclosing estate failure rolls back both original cash balances, victim death and payroll escrow/burn/loot state.

## Retained findings and remediation

EMP-HAR01 (harness migration, not a cash defect): the old core test called its manual first payroll death hook after newly wired `runEstate` had already resolved the reserve; its `first.lootedCash===25` assertion failed with `0 !== 25`. Retained original fixture failure from actual wired source. Adapted core assertions read actual estate report, payroll fields and original journal. The only successful direct helper call left is a repeated zero-value idempotence check; direct invalid recipient/rate controls remain unchanged. Maximum rate now comes from actual `bloodOathMult:2` through canonical clamp, rather than a manual first hook. Native rollback likewise uses actual integrated estate. Prior replay, mutation, expiry/race, death, rollback and legacy constraint migration controls remain executed.

EMP-INT02 (confirmed canonical actor regression): at wiring `e9d2aa81`, payroll validation rejected a legitimate original NPC killer before checking whether the victim had any jobs. A fresh native actual `runEstate` no-payroll death failed with `GameError: party` from `voidEmploymentAtDeath`, blocking an unrelated canonical death transaction. The coordinator corrected original alive/account validation at `56ccfe6e` to permit canonical NPC killers, matching existing market/loan/favor estate actor handling while retaining NPC employment enrolment rejection. Final proof executes actual NPC no-payroll estate and NPC funded-reserve loot, exact accounting and unchanged API enrolment refusal. The source correction was coordinator-owned; its failing native trace is preserved. No unresolved finding remains at the retested supplied runtime.

EMP-HAR02 (HTTP replay semantics): actual server idempotency returns original JSON plus `x-idempotent-replay:true`; it need not add the domain `replayed:true` field. The integration test now verifies the actual header and unchanged cash/sole wage ledger row. Initial assertion failure is retained in the evidence directory; it did not indicate duplicate payment or new authority.

## Executed qualification

Node v24.19.0; local PostgreSQL 18.4 (`pilot_runner`, loopback 35449), verified read-only before owned database creation. Commands `node test/gameemployment.js` and `node test/gameemployment-integration.js` both exited 0. Native commands with explicit `GAME_EMPLOYMENT_TEST_DATABASE_URL=postgresql://pilot_runner@127.0.0.1:35449/employment_proof_core_integrated_20261012_a` and `GAME_EMPLOYMENT_INTEGRATION_TEST_DATABASE_URL=postgresql://pilot_runner@127.0.0.1:35449/employment_proof_api_integrated_20261012_a`, invoking the corresponding tests with `--postgres`, both exited 0. Syntax checks for both owned tests and `git diff --check` passed. No broad rerun was performed after these relevant checks passed.

Both native guards reject ambient `DATABASE_URL`, remote hosts, unapproved roles/ports/versions, arbitrary database names and populated public schemas. Allowed targets are explicit `employment_proof_*` loopback databases: local `pilot_runner` ports 35439/35449 on PostgreSQL 18.4, or hosted-CI `postgres` port 5432 on PostgreSQL 16/18.4. CI compatibility was added without inferring test expectations from the backend. PostgreSQL 16 was **not** run locally; hosted CI execution remains coordinator-owned and no local PG16 pass is claimed.

The agent-led review policy's pinned manual authority/caller, economic-transition, specification comparison, native persistence and causal-negative methods were reapplied to the integration boundary. The new fixture covers actual server and canonical estate wiring, not the public randomized combat fire endpoint or full NPC scheduler. This is the actual `runEstate` entry-point proof with controlled canonical stored NPC identity. No external provider, financial activation, customer message or token rail was invoked.

Observed Windows working-file SHA-256 values (source commits are immutable text authority):

| Runtime/test | SHA-256 |
| --- | --- |
| `test/gameemployment.js` | `67cf42fc12a4cb1db0b1d2972c582e8842737a3aeb72640f7a253ea78dfd637f` |
| `test/gameemployment-integration.js` | `11e96abf949032c23c17212aedf08c53fa096cd7f20f2aac3d871fd7949a7202` |
| `src/server.js` | `fe17f075fea28b35491f1b1a8d418a1aec9ee69afd95c2eda226092b7e3003ee` |
| `src/social/estate.js` | `94db46d26ef18cb94048cd904ecbec0bc5acb408760b483222bdcf006dbdb45f` |
| `src/invariants.js` | `bb3784faf760a13811384b87ab6af6329e36dea46506c70bfb323bbe1b19da3c` |
| `src/gameemployment.js` | `6bcb6a047e97b6d474aab6981053e906a702f36dbe833e6df04b42c001185622` |

Retained ignored evidence at `output/employment-integration-review/`:

| Evidence | SHA-256 |
| --- | --- |
| `memory-double-hook-harness-failure.txt` | `cc0233701aa41dbec7269dd605711a71141b01e648f402db0ea403d0bd70b6db` |
| `native-npc-failure-e9d2aa81.txt` | `8fbe34a7636d40f46544851dbf93864cd53e0490ae861e26fa9ee21dc75c07d8` |
| `memory-core-final.txt` | `a0e02b1e3af2b5882867beeb8600b25eaab246b8923126ee657e218305d97dbd` |
| `memory-integration-final.txt` | `0863b5c5d27f9a5c9158c851fbe729afe7b21240421fbf3140625fc1e17776df` |
| `native-core-final.txt` | `9d855ddd048e2d5f32a46103fcbec25d271a8c5a7be1bca7507d26ac97fd0419` |
| `native-integration-final.txt` | `5656608c374101656091e6c8ecfeefba9035258eb1a53f98e684e9764b908c0c` |
| `static-triage.txt` | `7e6c02629048fa5d9f50c7168c121635c4c46933c07bf6b11a8258a37510ae4b` |

The initial HTTP assertion and once-only relocated original harness source are also retained. These conclusions apply to the pinned actual N02 runtime/tests and isolated local PG18.4 phase, not later material changes or whole-platform deployment. Coordinator catalog/gateway/package/CI/source-guard/KG/PR/release work remains separate. No deployment or financial activation was performed here.
