# RC1 player validation

Frozen baseline: `626e61b9ab2b14a9dc45566983b70cdc65692839` (main). Validation took place in the isolated `codex/rc1-release-validation` worktree on 2026-09-18. This report includes the P1 consequence-copy change in `src/world-consequences.js` and the new release harnesses. The release manifest/readiness document must pin the final patch set; these results must not be represented as tests of an unchanged baseline.

## Reproduction and environment

- Windows, Node `v24.19.0`, installed Chromium `153.0.8010.48`, repository lockfile dependencies.
- Mobile evidence is Chromium viewport/touch emulation, not physical-device or Safari/WebKit validation.
- The existing browser harnesses and fresh solo harness boot the production server on localhost against disposable `pg-mem`. The supplemental `rc1-campaign-mobile` harness uses real PostgreSQL with a private schema per scenario. No production account or database is used.
- Native PostgreSQL 18 tests use `COORDINATION_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:55439/rc1_check`, a private schema per story, and cleanup after each story. This URL is a local disposable test instance, not a deployment setting.
- New browser harness enables `CORE_PROGRESSION`, `WORLD_GRAPH_KERNEL`, `COORDINATION_ENGINE`, `COORDINATION_KNOWLEDGE`, `COORDINATION_KNOWLEDGE_SHARING`, and `COORDINATION_OPERATIONS`; Director mode is `LIVE` only inside the disposable process. It does not enable chain/economic functionality. Deployment cohort admission is a separate gate.

Run from repository root:

```powershell
$env:CHROMIUM_PATH='C:/Program Files/Google/Chrome/Application/chrome.exe'
node tools/mobile.js
node test/launch-invites-browser.js
node test/player-command-journey.js
node test/director-journey.js
node test/campaign-network-journey.js
node test/player-opportunities.js
node test/world-consequences.js
node test/rc1-journeys.js
node tools/rc1-mobile-journeys.js
$env:COORDINATION_TEST_DATABASE_URL='postgres://postgres@127.0.0.1:55439/rc1_check'
node test/world-consequences.js --postgres
node test/rc1-journeys.js --postgres
node tools/rc1-campaign-mobile.js
```

Raw logs and structured reports: [`evidence/player/`](evidence/player/). Each log is named for the executed harness. Development logs retain incorrect new-harness assumptions and synchronization failures; they are not silently discarded or classified as existing application failures. The player-command-client seam regression caused by the telemetry patch is recorded separately in `player-command-client.log` and owned by the telemetry validation lane.

## Golden story coverage

| Journey | Executed evidence | What remains unproved |
| --- | --- | --- |
| A: new solo player | **BLOCKED** at both 320/390. New guest/character, tour, Command Center, first case, recovery, local investigation, real travel, Garage acquisition, salvage and key crafting complete. | With the key and spare wire held at the Foundry, the world command remains locked for Family leadership and eligible Crew authority. No solo canonical world consequence or follow-up business occurs. |
| B: Crew | `player-command-journey` and `director-journey`: real Crew creation/join, explicit evidence sharing/revocation, preparation, item production, contribution, issued commands, consequences, private views, departure invalidation. | Real newly recruited players and complete browser journeys at 320/390. |
| C: Family | `player-command-journey`: two branches with Family membership, roles, commitments, custody, independent evidence, operation approval/execution, replay, expiry, restart, invariant checks. | Complete Family formation/preparation/resolution through mobile UI. Initial accounts have fixture stats/cash. |
| D: Missing Shipment | Existing network story covers interception, redistribution, actual failed recovery and correction. `rc1-journeys` adds successful recovery and destruction with canonical operation outcomes. | Every branch creating *subsequent* business; recovery/destruction have no linked consequence opportunity in the sampled follow-up window. |
| E: Black Market | Existing network story covers establishment, supply, exposure, seizure and route restoration; actual seals/wire and operation custody. New branch story tests that Director does not issue market establishment before diversion. | Complete browser story, multi-player market contention through mobile clients, downstream business for each terminal market state. |
| F: Informant | Existing network story covers public disclosure, two independent sources, private participant evidence, real failed operation evidence and correction. `rc1-journeys` adds secured records, disputed allegation and unresolved concern. No guilt claim appears; world/custody invariants pass. | All branches through the browser; secured/disputed/unresolved terminal outcomes do not generate new related business in the sampled window. |
| G: Dock War | `director-journey` executes protected/intercepted/alternate-route branches, restoration, Director restart, second generation and completed campaign. Network journey demonstrates shipment→market→informant on the combined content catalog. | A single browser campaign that starts from a fresh player, completes Dock War, and follows its resulting state into the network. The two existing domain tests are not that single story. |

The existing domain fixtures seed account/character stats (including respect and cash), then use real social, acquisition, crafting and operation services. They are valuable integrity evidence, but are not new-player onboarding tests. Recovery branch selection creates/cancels ordinary operations until the existing deterministic seed yields the needed success/failure; it never rewrites the outcome, rewards, inventory or operation seed.

The supplemental campaign mobile harness uses the same seeded actors and initial world. It signs local fixture sessions and dismisses the real welcome/tip controls, then clicks actual rendered Command Center actions and confirmation dialogs against the production HTTP server and PostgreSQL. Each POST must match the execution identity issued to that rendered board. Its browser path covers discovery, mystery steps, recipe crafting, operation creation, publication, role joining, commitments, contributions, approval and execution. Travel, vehicle acquisition/salvage, initial social/world formation and the two corroborating evidence shares use existing domain helpers. They are not browser coverage. No production source is changed to enable the harness.

## Verified results

- Existing mobile harness: **PASS**, 175 screen checks at 320×568, 375×667 and 360×780; includes real first crime/reward, navigation reachability, overflow, 44px primary navigation, server-unreachable recovery, cooldown freshness, lockup cold load, stored-XSS sweep and no uncaught page errors. Its default content flags do not prove new campaign journeys.
- Invite browser: **PASS**, actual gate redemption, durable token/cookie, invalid-code retry and Crew invitation control; desktop and 390px.
- Player Command, Director, Campaign Network, Opportunity Feed and World Consequence tests listed above: **PASS**.
- Added five branch stories: **PASS** on `pg-mem` and PostgreSQL. Every execution is an issued Player Command, retry replays, one canonical event exists for the resolution, the actor sees the consequence, and kernel/custody/capital invariants pass.
- Consequence authorization regression suite: **PASS** on both databases after the wording fix. Hidden history, delayed public aftermath, revocation and bounded history behavior remain covered.
- Extended 320/390 solo golden journey: **FAIL — RELEASE BLOCKER**. This is a failed required player loop, not a failure of the already-passing command recovery/crafting steps. `rc1-mobile.log` must stay nonzero until the required story can actually finish. The new harness deliberately does not seed Family membership to conceal the result.
- Telemetry confirmation regression: **NEW REGRESSION, fixed and retested**. Observation POSTs originally emitted world projection hints, canceling the visible confirmation before the player could confirm salvage. The operations/telemetry lane excluded pure observations from gameplay refresh and isolated their rate-limit budget. The extended solo rerun passes salvage confirmation and crafting. Original failure: `telemetry-confirmation-regression.log/json`. Client unit retest: `player-command-client-retest.log`.
- Legacy screen-beacon cancellation: **KNOWN BASELINE interaction with enabled projection refresh, fixed and retested**. The delayed `/v1/screens` beacon also invalidated the gameplay view and could cancel confirmation. Its passive telemetry path now avoids the gameplay queue/refresh. Original failure: `screen-beacon-confirmation-regression.log`. The final run reaches the world authority blocker at both widths.
- Final mobile evidence contains zero uncaught page errors; all 26 observation requests at 320px and 24 at 390px returned HTTP 200. Observed phases are session, Command Center, opportunities shown/opened and preparation. No consequence phase is claimed because the world action is blocked. Reload/recovery is not evidence of an independently chosen second play session.
- Archive-key guidance regression checks: initial locked guidance stays opaque, disclosed guidance names Garage and Foundry; command API, memory command security suite and native PostgreSQL command security/concurrency suite pass.

## First-session findings

This is a heuristic review with automated screen evidence, not a recruited-player usability study. It uses the heuristic-evaluation skill's status visibility, player language, recognition, error recovery and severity criteria. No external documentation was displayed in the browser journey; the automation author did inspect source to choose the solo preparation route.

1. **P1 severe UX, fixed:** secured/disputed/unresolved outcomes previously read only `The Canal Supply Depot: secured.` or `The Canal Supply Depot: unproven.` This did not tell players what the evidence established. Consequence text now explains the physical or evidentiary outcome and explicitly preserves uncertainty. No authorization, state transition, content definition hash or economic parameter changed. Before/after evidence is in `rc1-branches-before-ux-fix.json` and `rc1-branches.json`.
2. **P1 preparation guidance, fixed:** after discovering the archive, the recipe card originally said only “Travel to the required district” and “Gather the required materials.” A narrowly scoped description now names Garage→junker→Foundry salvage→craft for the known archive-key recipe. It appears only once all missing conditions are disclosed; the initial LOCKED recipe remains opaque. The browser checks both states. This makes preparation legible but does not remove the later Family/Crew authority gate.
3. **Initial prioritization concern, severity 2:** the fresh board's first Personal card is locked crafting. Numerous immediately available case starters include recovery/disclosure cases before those events exist. Opening a case is permitted but does not prove its investigation can progress. The useful Split Ledger starter is visible, but the UI does not recommend its relationship to the solo archive path. Do not confuse a large count of available start commands with useful opportunities.
4. **Recoverable uncertainty, verified:** the UI preserves the original execution identity when the command commits but the response is lost, presents a saved-move recovery control, and confirms the same case after refresh. Repeated taps during an 800ms delayed response emit one command. This is an actual browser/server test, not a synthetic success response.

## Opportunity quality evidence

Internal rubric: 0 = absent, 1 = limited/unclear, 2 = demonstrated, `?` = not measured. These review scores are not served to players and never affect authorization or selection.

| Content sample | Clarity | Preparation depth | Coordination | World relevance | Consequence visibility | Branch diversity | Follow-up | Repetition |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Fresh solo board | 1 | 1 | 0 | 1 | ? | 1 | ? | 15+ starters and repeated generic reasons; pacing needs novice evidence |
| Dock War | 2 | 2 | 2 | 2 | 2 | 2 | 2 | Three branches tested; long-session repetition not measured |
| Missing Shipment | 2 | 2 | 2 | 2 | 2 | 2 | 1 | Interception propagates; recovery/destruction are terminal in sampled window |
| Black Market | 2 | 2 | 2 | 2 | 2 | 2 | 1 | Exposure propagates; terminal alternatives need separate follow-up evidence |
| Informant | 2 | 2 | 2 | 2 | 2 after copy fix | 2 | 0 for sampled terminal branches | No repeated-session player evidence |

For each new branch, the harness advances the real Director four times by 601 seconds after resolution. Results:

| Branch | New opportunity cards | Consequence-linked opportunity IDs | New Director selections |
| --- | ---: | ---: | ---: |
| Recovery | 3 | 0 | 0 |
| Destruction | 3 | 0 | 0 |
| Secured records | 0 | 0 | 0 |
| Disputed allegation | 0 | 0 | 0 |
| Unresolved concern | 0 | 0 | 0 |

The three cards after recovery/destruction are existing Dock War business, not evidence that those outcomes caused new business. No new selection/pacing/content subsystem was added to manufacture a passing result.

## Remaining hard-gate evidence

- `SOLO-WORLD-AUTHORITY`: **RELEASE BLOCKER, present in the frozen baseline**. Run `node tools/rc1-mobile-journeys.js`; both widths reach `solo-ready-equipment-world-gate`. `mobile/results.json` records `worldGate.inventory`, `worldGate.commands`, `crew:null`, `family:null`, and no canonical consequences. The command for `facility:foundry_archive` remains LOCKED with `family_authority` and undiscovered `crew_affiliation`; its required item and wire have been acquired and the player is at the Foundry. `src/world-kernel.js` unconditionally requires boss/underboss and a same-Family eligible Crew in both projection and mutation authority. The fresh solo story therefore cannot finish under current rules. No authorization was weakened, no membership/stats/inventory was injected, and the failed assertion is retained.
- `PLAYER-FOLLOWUP`: the required completed consequence→related new opportunity link is absent for the sampled terminal branches. Reproduce `node test/rc1-journeys.js`; inspect `consequences[].opportunityIds`, `newOpportunities`, and `downstreamSelections` in its JSON. Canonical correctness passes; the full product loop does not follow from that pass.
- `MOBILE-B-G`: complete browser journeys B–G have not been executed at both release widths. They remain unverified despite passing domain tests and the 175-screen layout sweep.
- `FIRST-SESSION-COMPREHENSION`: no unfamiliar player's first 30 minutes or answer to “what changed and what can I do next?” has been collected. Source-guided browser execution cannot substitute for that evidence.
- Mobile expired/stale opportunities, Crew/Family multi-tab execution, app background/foreground transitions, operation connection loss and confirmation cancellation/re-entry have not all been covered by the new browser harness. Existing unit/domain security assertions must not be relabeled as mobile execution evidence.

These gaps must be included in `RC1-READINESS.md`. This report does not authorize a broader player release or claim that all A–G mobile stories passed.

## Completed supplemental mobile evidence (2026-09-20)

Production source remains `f31b5290080506f6407a9b7f9a514e2ea020a9d4`. The matrix combines the six initially passing scenarios with four targeted retests of corrected harness selectors; original results are retained. The final retest records its harness hash and runtime. Earlier supplemental results did not record a harness hash, so their source provenance is less complete and is not silently upgraded.

| Width | Scenario | Result | Rendered commands |
| --- | --- | --- | ---: |
| 320 | shipment-redistribution | PASS | 24 |
| 320 | shipment-destruction | PASS | 17 |
| 320 | black-market-supply | PASS | 59 |
| 320 | black-market-seizure | PASS | 59 |
| 320 | informant-public-disclosure | PASS | 98 |
| 390 | shipment-redistribution | PASS | 24 |
| 390 | shipment-destruction | PASS | 17 |
| 390 | black-market-supply | PASS | 59 |
| 390 | black-market-seizure | PASS | 59 |
| 390 | informant-public-disclosure | PASS | 98 |

[Machine-readable matrix](evidence/player/campaign-mobile-matrix.json) links each result to its raw evidence. These are fixture-assisted browser paths, not completed fresh-player A–G journeys. Passing cases include canonical world/custody checks, visible participant consequences, confirmation fit and no horizontal overflow or uncaught browser errors. No primary action or assertion was bypassed.

Original same-label operation/discovery selector failures are **NEW REGRESSION (validation harness)**: the harness selected the first matching label rather than the intended command in its displayed context. Exact HTTP identity checks caught the wrong selection. Retests select within that context and retain the strict identity assertion. The initial 390px disclosure path also received a safe409 refusal; that individual cause was not separately isolated, so its original failure remains visible even if the corrected scenario passes.

The earlier standalone supply retest reached its320px PASS message but failed schema cleanup with PostgreSQL53200. It is **ENVIRONMENTAL / INCOMPLETE**, not a completed passing run. The final harness closes its own server pool and runs serially. The same-label controls are also a usability concern: fixture knowledge of command order does not establish that a novice can distinguish them.
