# Core architecture closure and playable command milestone

Date: 2026-09-17. Worktree: `.worktrees/player-command-engine`; branch: `codex/player-command-engine-20260917`. Parent: `bca01026b642a2632cc9476e8a664287eac281ea`. The source commit containing this handoff and its following generated-only knowledge commit form the milestone checkpoint. No deployment, production migration, rollout activation or content expansion was performed.

## 1. Exact starting checkpoint

`bca01026` is a generated-knowledge commit over Phase 5 source `238c9b8476c5351776f3e6e22073dbb0f8c639e9`. The architecture starts at `e56cf576065c5f1bbb9bb55115f5961267f7d654`; the checkpoint range contains 16 commits. The imported engineering handoff has SHA-256 `2517f911c3c3e97c2ffa083f3904b811d493c9316e99fd38d1bb211e8f875e2d`. An independent PostgreSQL 16 run on the unchanged checkpoint reproduced **203 passed, 0 failed**.

Phases 1–4 were component-complete: persistent World Graph, Coordination, authorized Projection, and shared prerequisites/progression including both Furnace Ledger branches. Those components were preserved. The stale opening status list in `IMPLEMENTATION.md` was corrected from the actual source, later evidence and handoff. Detailed revision and failure provenance: [closure evidence](closure-evidence.md).

## 2. Phase 5 completion

Phase 5's declared bounded scope was complete at the checkpoint: visible mystery notes/actions, irreversible confirmation, exact retry after reload, character-scoped selection, permitted consequence refresh hints and indexed operation reads. It did not include a general command layer or durable cross-process hints. This milestone adds the playable orchestration and finishes release-gate integration; it does not rebuild those phases.

## 3. Baseline failures and attribution

The two reported stopping suites, `test/routes.js` and `test/gates.js`, were independently reproduced on **both e56cf576 and bca01026**. Route assertions described retired research/campaign surfaces. The gate's first failure was the existing bond price-wall classifier; subsequent source-backed baseline omissions included prototype-membership checks, narrow static metadata and dormant suite registration. These are corrected and retested. No known failure from those two baseline suites remains.

Continuing beyond their first assertions also found architecture-introduced omissions: private prerequisite display metadata, core-progression suite registration/native inventory, a static census declaration, and the mobile harness's obsolete `/v1/me` outage interception. Those are recorded as architecture integration failures, not baseline. New command integration defects found and fixed include stale private HTTP receipt responses, succession races, canonical hashing of absent parameters, selected-case query normalization, historical command-table death disposition and the disabled command route's cold-start declaration.

The additional native Phase 2 upgrade-catalog gate also failed at both e56cf576 and bca01026. Its expectation debt is mixed: the first failure predates the architecture, while later Coordination, World Kernel, operation and recipe constraints were also omitted, and this milestone adds three command-board primary/foreign-key constraints. The corrected static fixture explicitly names 119 additions and three removed/replaced constraints, with 12 causal negative probes. Nothing is excluded from comparison. The final native definitions and item-lot gates pass; the entire catalog gap is not mislabeled baseline.

Full-outage chaos testing exposed another older fixture defect: the outage and deploy-drain scenarios reused the same character name, so the second creation failed before reaching its intended row lock. The same duplicate names are present in e56cf576. The drain now uses a distinct name and explicitly requires successful character creation and a real locked row. All drain assertions remain intact; native Windows signal termination still cannot prove a graceful Linux deploy drain.

## 4. SQL interpolation gate

The unchanged ceiling is **168**. The baseline measured **183**, the architecture checkpoint **189**, and this milestone **168**; nonliteral sites remain **38**. The issue predates the architecture, which added six sites. Twenty-one interpolated statements were replaced by bound scalar parameters or fixed query branches while retaining predicates, row locks and transaction ownership. Final real PostgreSQL preparation passed **3,992 static statements**. The sentinel-bound ballot test still requires exactly 101 rows and fail-closed behavior. No security ceiling or anti-vacuity assertion was relaxed.

## 5. Command Engine

`src/player-commands.js` adapts authorized canonical projections and existing domain catalogs. `GET /v1/commands` returns a versioned board; `POST /v1/commands/execute` accepts only an issued execution identity and confirmation, with the same idempotency header. No client-selected actor, action payload, prerequisite or cost is trusted.

The [version 1 contract](PLAYER-COMMAND-CONTRACT.md) covers identity/type, subject/target, prose, six availability states, disclosed requirements/blockers, cost/commitment/knowledge/item/role/participant information, revalidation, visible risk, expiry, confirmation and result shape. Known blockers are distinct from generic undiscovered prerequisites; undiscovered entities produce no command. The durable board stores suggestions and recovery identity, not economic authority.

Adapters cover mystery start/discover/complete/choice, discovery investigation, knowledge sharing/revocation, crafting, salvage, graph actions and the existing Family operation lifecycle. Current account, character, membership, knowledge, resources, expiry and revisions are revalidated. Trusted expected-character checks run inside existing domain locks. Existing services and receipts remain the sole mutation/deduplication framework.

## 6. Opportunity Engine

`src/player-opportunities.js` ranks already authorized commands and Crew objectives. It derives operation, intelligence, mystery, crafting, resource, territory, sharing and Crew opportunities from bounded projections. Ready operations rank first, followed by investigation and mystery work; waiting work remains visible. Limits are 128 commands and 80 opportunities with explicit truncation. Selected operation/case actions receive command selection priority. Owner vehicle reads use a new `(character_id, model_id, id)` index; discovery reads preserve their existing 20-instance bound. There is no unrestricted graph traversal or client-side discovery of secrets.

## 7. Production UI migration

The existing World tab is the Command Center, preserving Omerta's visual language. It answers all seven operational questions with visible history/consequences, ranked attention, available moves, blocked/waiting work, Crew activity, Family operations and earned discoveries. One shared renderer serves case, discovery, recipe, item/salvage, clue sharing, territory/world object and operation contexts. The browser no longer translates projected actions into its own domain request shapes for this path.

The [migration map](command-migration-map.md) traces World Graph → Coordination → Mystery Runtime → Projection → API → frontend and names every retained boundary. The player sheet remains on `/v1/projections/player`. Specialized garage, market, social administration, full map and authored Content Desk systems retain their existing authorities and are not presented as canonical substitutes.

## 8. Persistent vertical slice

Both **preserve** and **expose** journeys pass against real PostgreSQL and production domain services: personalized lead → missing knowledge → investigation → knowledge claim → newly revealed recipe → real garage acquisition/salvage → crafting → Crew/Family knowledge sharing → irreversible branch choice → Family operation creation → four filled roles → real item/material/capital commitments → readiness → execution → persistent world event → changed story/projection → different authorized outsider view → consequences/new opportunities → durable replay.

Supporting travel, social formation and garage boost call existing production services directly; those actions are not yet wrapped by commands. Test characters and the successful garage random roll are fixture setup. Native failure/concurrency evidence does not rely on pg-mem or mocked services.

Separately, an actual production HTTP server with PostgreSQL and headless Chrome passes **10/10 browser checks**, including login, all seven sections, 1440/390/320 widths, keyboard/Escape and button cancellation, committed salvage with lost reply followed by reload/exact retry, persistent selected mystery, and account isolation. There are zero uncaught browser errors. This browser rehearsal proves those UI segments; the complete multi-participant branch journey is the native integration suite, not a claim of one end-to-end browser recording.

## 9. Security and consequence evidence

The [scoped security report](command-security.md) pins methods, source fingerprints, findings and retests. Native command tests pass **17 groups**; memory tests pass **10 groups**. They cover stale/forged/duplicate/replayed identities, double click, eight concurrent engines, suspended/dead actors, membership or knowledge loss, consumed items, expired/resolved operations, hidden prerequisites, succession at both read and dispatch boundaries, transport loss, transaction rollback, postcommit projection failure, repeated populated migration and an independent full-server process restart.

Persisted resource/item/event rows prove exact retries do not duplicate effects. HTTP retries repeat current authorization and return current projections, never cached private history. Successful mutation followed by projection failure returns an explicit committed result requiring refresh. Feedback supports visible inventory, knowledge, relationship, operation, world and mystery changes and changed opportunities; raw private domain receipts are excluded. Knowledge share/revoke hints use real grant audiences and carry only coarse invalidation.

No open high/critical finding remains in this scoped review. It is not a fresh audit of unrelated financial contracts or a proof of every possible existing-service interleaving.

## 10. Final verification ledger

The retained command-by-command ledger is `output/player-command-engine/final-verification.json`; raw first-run failures and retests remain alongside it. It distinguishes missing build artifacts, test-runner invocation mistakes and stale generated documentation from source defects. Required suite coverage is measured from the final package scripts, not inferred from a stopped `npm test` chain.

| Gate | Result |
| --- | --- |
| Untouched checkpoint PostgreSQL | PASS, 203/0 |
| Milestone PostgreSQL | PASS, 203/0 |
| Native architecture gates | PASS, Coordination, World Kernel, Family operations, Projection, Core Progression |
| Older native Phase 2 definition and item-lot gates | PASS, exact upgrade catalog, direct constraints, races and repeated populated migrations |
| Command memory/native/API/client | PASS, including 17 native groups and separate process replay |
| Both complete branch journeys | PASS, native PostgreSQL and memory |
| SQL preparation | PASS, 3,992 static; 168 interpolated; 38 nonliteral |
| Production browser / mobile harness | PASS, 10 / 175 checks |
| Repository suites / property budget / supplemental CI checks | Final per-command ledger records all 224 required lifecycle commands and retests; the full 100-seed / 25,000-action property budget passes |
| Static, documentation, generated knowledge | Repository gates, documentation census and changed JavaScript syntax checks pass; final ledger records generated-knowledge checks at the committed source checkpoint |
| Foundry artifact build and Market V2 suites | PASS, real local build; 15 deployment checks plus keeper and solver |
| Economy simulation / scale / invite flows | PASS, including 18 players over two days, all nine driven markets, 55 unchanged ledger checks and real invite browser controls |
| Native load and concurrency | PASS, 3,473 operations across eight players with zero 5xx/pool failures and unchanged ledger checks; exact idempotency, escrow and deadlock handling remain passing |
| Native chaos | Worker interruption, terminated database backends, full PostgreSQL outage/recovery and interrupted transfers pass with unchanged ledgers. Graceful deploy drain remains BLOCKED on Windows |
| Backup self-test | BLOCKED security permission check on this Windows/Git Bash host: 25 checks pass, one fails because reported file mode is 0644 instead of required 0600; actual dump, refusal and full fixture restore pass |

This plain-JavaScript package has no separate TypeScript or lint command. Syntax checks, repository static/security gates, client compilation and runtime tests are reported by their actual names. Foundry emitted existing lint warnings; its successful build is not a clean contract lint/audit claim.

## 11. Deployment readiness and status classification

**PASSING:** preserved architecture, SQL gate, command/opportunity implementation, production Command Center, persistent branches, security regressions and the checks listed above.

**PRE-EXISTING FAILURE:** the two reported baseline suite failures and SQL ceiling breach are evidence-backed historical failures and are fixed here. Any remaining unresolved result is listed in the final verification ledger rather than relabeled baseline.

**NEW FAILURE:** the integration defects described above were resolved and retested. First-run errors remain available for review; only final retest results count toward readiness.

The initial concurrent lifecycle run also timed out in the unchanged Agent Alpha hard-crash test. Its unchanged standalone rerun passes all fixtures with the original timeout. The first failure is retained as a recovered verification-run failure; resource contention is plausible but unproven, and it is not classified as baseline.

**BLOCKED / NOT RELEASED:** the backup owner-only POSIX permission gate and graceful SIGTERM deploy-drain gate must pass on the target Linux environment. Node's documented Windows `subprocess.kill('SIGTERM')` behavior terminates the child abruptly, so that run cannot establish graceful drain. See the [official child-process documentation](https://nodejs.org/api/child_process.html#subprocesskillsignal). Neither gate was skipped or weakened to make this Windows run green; no usable installed Linux fallback was available. No production deployment or feature activation was attempted. Representative staging data/backup/restore and compatible rollback rehearsal, production configuration review and hosted CI acceptance remain release work. CUA exposed no browser surface on this host; the real headless browser tests provide UI evidence without claiming CUA succeeded.

The code is a candidate for a controlled staging cohort after the remaining target-environment gate, not authorization to turn the features on in production. Feature flags remain off by default. No signer, token rail, existing database service or live economy was changed.

## 12. Remaining technical debt

- Durable board retention and explicit supported replay horizon; expiry currently prevents new execution but does not garbage-collect history.
- Best-effort process-local projection hints; reconnect/reload recovers from persisted state, but no durable multi-process outbox is claimed.
- Coarse whole-board freshness can require a harmless refresh after unrelated state changes.
- Broader market, transfer, territory combat, threat, social request and Family administration command adapters remain separate follow-up work.
- Authored Content Desk and canonical World Graph custody/progression still have distinct models; no general importer, replacement/rollover policy or cross-lot custody bridge was added.
- Quota/history operating policy and representative staging performance/recovery evidence remain to be specified. There is no mass content generation in this milestone.

## 13. Exact next recommended milestone

**Controlled staging playability and recovery acceptance.** First clear the backup file-permission and graceful deploy-drain gates on Linux. Deploy this exact reviewed checkpoint to an isolated staging cohort, keep the existing feature/cohort gates, run the same four-participant Furnace journeys through actual player sessions, measure command-board size/latency and retained history, and rehearse process loss, backup/restore and compatible rollback with representative data. Define and verify the command replay/retention policy before expanding the cohort. Then select the next bounded existing-domain adapter from the migration map; do not start another architecture rewrite or mass content production.
