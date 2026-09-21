# RC1 golden journeys: executed coverage

Execution date: 2026-09-20 UTC. Local real PostgreSQL 18.4, Chromium phone emulation, Windows/Node 24.19.0. The initial run reports HEAD `4d35c8e8b3a1db696f1bf5b5e8b7b0dc327cecb1` and includes the then-uncommitted passive-screen telemetry HTML repair; [source hashes](evidence/mobile-campaign/source-file-hashes.json) identify that tree. The affected rerun reports HEAD `12236868fd847299a6ae59ac9ec193bf049d6a17`, with the final harness/helper later committed at `a61a27d4`. It began before the separate `f18065af` diagnostics repair. These results are not relabeled as a single later immutable candidate run. This is automated execution evidence, not a real-player cohort or a measurement of human comprehension.

## Reproduction and evidence

The extended mobile harness was reused from repository validation commit `36156ace3f4e4600badc8394a205d0e10432d227`, reviewed, and run afresh against this candidate. No prior report or result was borrowed. Only the test harness was added; application code was unchanged by this lane.

Set `COORDINATION_TEST_DATABASE_URL` to the isolated loopback PostgreSQL cluster, set `RC1_CAMPAIGN_MOBILE_OUTPUT=docs/release/evidence/mobile-campaign`, then run `node tools/rc1-campaign-mobile.js`. Chrome must be installed, or `CHROMIUM_PATH` must name its executable. Each scenario uses a newly generated private PostgreSQL schema and separate authenticated browser contexts for different players.

The initial accounts, character cash/skills, social structures and world setup are fixtures. Travel, vehicle acquisition/salvage and disclosure sharing use existing server domain services. The recorded mystery, discovery, crafting and operation commands use actual rendered controls, exact server-issued execution identities and production HTTP execution against PostgreSQL. No item or reward is fabricated to bypass a prerequisite in the tested commands. The corpus deliberately uses multiple actors for authored Family/Crew requirements.

Primary artifacts: [initial campaign browser results](evidence/mobile-campaign/results.json), [initial execution log](evidence/mobile-campaign-run.log), [affected rerun results](evidence/mobile-campaign-recovery/results.json), [rerun log](evidence/mobile-campaign-recovery.log), and the PNG screenshots next to each result. The [final matrix](evidence/mobile-campaign/final-matrix.json) identifies the latest successful evidence for each unique cell without deleting failures or double-counting reruns. Results include reported HEAD, harness SHA256, dimensions, every clicked command, final states, consequences and invariant findings. Root-owned fresh/returning player evidence: [phone journeys](evidence/mobile/journeys.json).

## Journeys A–E

| Journey | What was executed | Boundary of the evidence |
| --- | --- | --- |
| A — New player | Root's 390×844 and 360×800 phone scripts enter the account flow, open a first canonical investigation, complete the command, show its consequence and reload successfully. Measured automated first-action times: 5.327s and 4.196s. | Scripted navigation is not proof that a novice understands the objective without help. Native wallet/provider enrollment and human first-session comprehension require their own evidence. |
| B — Returning player | The same phone scripts reconstruct the authenticated screen after reload. The populated campaign browser scenarios refresh actual consequences and current actionable/blocked opportunities after world changes. | This is reload/persistence and updated-feed coverage. A human returning after an absence, identifying threats/social activity and selecting a next action has not been observed. |
| C — Social player | Multiple authenticated actors discover requirements, join roles, make commitments, contribute materials/equipment, approve readiness and execute canonical operations through mobile controls. The additional continuous journey below begins with an ordinary outsider who has no membership, discovers and joins a Crew and Family through normal mobile controls, contributes and sees the shared consequence. | Accounts, legitimate eligibility and the existing groups are prepared fixtures. The outsider's memberships are not seeded; real leader approval and ordinary Family membership are enforced. Human comprehension and account/wallet enrollment are outside this scripted social-entry proof. |
| D — Investigation player | Shipment redistribution opens the Dispatch Register case, completes an evidence step, crafts the required cargo seal, discovers another lead and completes the next evidence step through rendered controls. The disclosure branch exercises independent sources and their incomplete-knowledge boundary. | Disclosure sharing and initial relationships use canonical fixture services; they are not all UI clicks. The assertion that one reader of two sources cannot manufacture independent corroboration remains enforced. |
| E — Family conflict | Family B intercepts the scarce shipment and establishes a market; Family A then prepares and executes a market-seizure operation through its own authenticated browser context. Other branches destroy/redistribute/supply/disclose the same canonical world objective. | Browser execution is sequential, not a simultaneous click race. Native PostgreSQL concurrent contention, visibility and authorization are independently covered by the [PostgreSQL report](RC1-POSTGRES-REPORT.md) and [security report](RC1-SECURITY-REPORT.md). |

The table distinguishes completed scripted portions from unobserved portions; it does not certify all five end-to-end human journeys.

## Mobile actions and consequences

The campaign run covers five branches at **320×568** and **390×844**. Every selected control must be visible and enabled; confirmation controls must fit the viewport. The harness checks that the clicked control executes exactly the intended server-issued identity, that the response is completed, that no pending retry remains, that the Command Center has no horizontal overflow, and that JavaScript errors remain absent. It checks canonical World Graph and operation/custody invariants after each scenario.

After every major operation, the harness refreshes the participant's actual board, requires authorized consequences and captures the rendered screen. The first 320px redistribution screenshot visibly reports the depot's `redistributed` state under **What changed?**, with current opportunities and waiting requirements below it. Screenshots are complete long pages; they are retained as evidence, not as a claim that a human would inspect every row. Touch devices and native keyboard/wallet behavior are not emulated completely by Chromium.

All **10 unique scenario/viewport cells pass**, totaling **514 rendered commands**. No JavaScript errors, horizontal overflow, World Graph invariant failure or operation/custody invariant failure occurred in the selected successful cells.

| Branch | 320×568 | 390×844 | Canonical terminal state |
| --- | --- | --- | --- |
| Shipment redistribution | PASS, 24 commands | PASS, 24 commands | `redistributed` |
| Shipment destruction | PASS, 17 commands | PASS, 17 commands | `destroyed` |
| Black-market supply | PASS, 59 commands | PASS, 59 commands | `market_supplied` |
| Family market seizure | PASS, 59 commands | PASS, 59 commands | `market_seized` |
| Informant public disclosure | PASS, 98 commands | PASS, 98 commands | `public_trace` |

## Initial failures and bounded retest

The initial matrix had seven passes and three failures. The 320px seizure attempt timed out clicking a button while automatic scrolling placed it behind fixed phone navigation; the 390px seizure attempt could not locate `Commit: Prerequisite`; the 390px disclosure attempt received an authoritative `409 command_unavailable` asking for refresh. A seizure-only rerun with unchanged source passed at 390px, while 320px encountered the same safe 409 refusal after 30 successful commands. [Unchanged rerun evidence](evidence/mobile-campaign-seizure-retest/results.json). These are retained **D — tooling/synchronization observations**, not proof that a refused stale command should have succeeded. The one-time missing-control observation did not reproduce; its precise asynchronous cause is not proven.

The test harness now scrolls the chosen normal button to the center before a normal click. It never forces a click, hides navigation or changes game state to satisfy a prerequisite. The shared helper permits one browser-adapter retry only for the expected stale/unavailable/expired 409 errors: use the visible **Refresh world** control, obtain a newly issued command of the same type/parameters and independently verify that exact command identity. Native engines without the hook retain their original failure behavior. The [native helper regression](evidence/mobile-helper-regression.log), `node test/player-commands.js --postgres`, passes all 17 groups including independent-process replay.

The final affected run executes seizure and disclosure at both sizes: **314 commands, all four cells pass**. It records **zero recovery-hook invocations**. Thus successful subsequent execution is proven; an in-place browser recovery from an observed stale refusal is not claimed. Reproduce this bounded run with `RC1_CAMPAIGN_MOBILE_CASE=black-market-seizure,informant-public-disclosure` and `RC1_CAMPAIGN_MOBILE_OUTPUT=docs/release/evidence/mobile-campaign-recovery` using the same command above.

No production change was made by this journey lane. Native wallet/keyboard behavior, human comprehension and real-player cohort outcomes remain outside this automated fixture proof.

## Continuous social entry and contribution — PASS

An additional evidence-local script runs against exact local source **`a61a27d40d09caa8de0319ceea1cca7a14fdc96f`** on the same real PostgreSQL cluster. It uses the fixture's ordinary outsider, verifies **zero Crew and Family membership rows**, and exercises these rendered mobile steps at both **320×568** and **390×844**:

1. The existing Crew leader opens recruiting through the Crew screen.
2. The ordinary player finds that Crew in **Find People**, then selects **ask to join**. The database still has no membership until approval.
3. The actual leader selects **let them in**. The newcomer opens the real Crew board and sees the roster, their own member entry and the Crew room.
4. The newcomer selects **kiss the ring** for the listed Family. Database assertions verify the intended group and an ordinary role, with no leadership grant.
5. That same newcomer becomes the operation runner, obtains the required knowledge/materials through the existing journey, commits and makes **three actual contributions** through rendered controls. The other actor approves and executes once the authored threshold is satisfied.
6. The canonical shipment becomes `redistributed`. The newcomer refreshes their own Command Center, receives the authorized shared consequence, and its description is asserted in the actual rendered page text.

Both sizes **PASS**, each with **four UI social mutations and 30 rendered Player Commands**. World Graph and operation/custody invariants pass; neither browser reports a JavaScript error. These are 60 commands in an additional continuous journey, reported separately from the earlier 514-command matrix.

Evidence: [exact results and social-step responses](evidence/mobile-social/results.json), [execution log](evidence/mobile-social/run.log), [reproducible evidence-local script](evidence/mobile-social/social-membership.mjs), and the discovery, joined-group and shared-consequence screenshots in that directory. Reproduce with `COORDINATION_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:55439/postgres RC1_CAMPAIGN_MOBILE_OUTPUT=docs/release/evidence/mobile-social node docs/release/evidence/mobile-social/social-membership.mjs` on a disposable loopback cluster. As elsewhere, initial eligibility is a test fixture and is not a human new-account progression claim.

The first attempt stopped after the successful application because the evidence script's generic `[data-group]` selector matched both the page body and a navigation button after reload. This was **D — tooling defect**. [Initial results, log and script](evidence/mobile-social/initial-tooling-failure/results.json) are retained. Narrowing that test selector to the existing visible `#grouprail` resolved the ambiguity; no forced clicks, hidden UI, preinserted membership or production changes were used.
