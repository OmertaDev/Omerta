# OMERTÀ: UI/UX improvements 51–100

Implemented in the shared workspace on 2026-10-24. These are repository changes,
not evidence of a production deployment. The additions use existing noir styling,
native controls and authorized game projections. Planning, notes, cosmetic stamps
and reading preferences cannot grant items, spend resources or execute a plan.

| # | Improvement | Implemented behavior |
|---|---|---|
| 51 | Job approach comparison | Side-by-side chance, conditional payout, nerve, heat and jail terms. |
| 52 | Sea lane comparison | Current boat, route, cargo and escort assumptions with risk and return. |
| 53 | Reversible tactical adjustments | Hypothetical inputs can be reset; previews send authenticated reads. |
| 54 | Loadout bench | Proposed equipment shows exact effective-stat changes. |
| 55 | Actual modifiers | Named current modifiers accompany job projections. |
| 56 | Coach reasoning | Recommendations explain budget, chance and current blockers. |
| 57 | Three-move plan | Manual scratchpad detects resource and shared-clock conflicts; no automatic execution. |
| 58 | Resource budget | Energy and nerve budgets filter affordable choices. |
| 59 | Skill build sandbox | Hypothetical allocations show prerequisites and point-budget conflicts without spending. |
| 60 | Setback explanation | A crime receipt retains pre-action factors and distinguishes a random failure from blockers. |
| 61 | Private evidence board | Pin, arrange and link found evidence in the account workspace. |
| 62 | Competing hypotheses | Editable interpretations remain private and separate from submitted case actions. |
| 63 | Evidence beside dialogue | Revealed supporting evidence sits beside the relevant conversation. |
| 64 | Graduated hints | Request one authorized hint rung at a time. |
| 65 | Accurate case filters | Authored solo/short labels and a separate Crew-operation destination. |
| 66 | Item uses | Revealed recipes, case requirements and authorized operation blockers explain uses. |
| 67 | Crafting preview | Declared consumed inputs, cash, retained-tool disclosure and output appear before confirmation. |
| 68 | Committed item visibility | Own custody records link back to the work and explain exact-depositor return conditions. |
| 69 | Recipe dependencies | Recursive revealed recipe traces retain the original preparation context. |
| 70 | Solved-case explanation | Actual completed evidence and final steps appear together after completion. |
| 71 | Role board | Current members and actual operation positions appear together. |
| 72 | Ready checks | A member deliberately sets readiness for the selected plan. |
| 73 | Contribution pledges | Nonbinding intentions never move or reserve funds or items. |
| 74 | Planning polls | Unique-account votes on explicit choices with a closing time. |
| 75 | Timed presence | Explicit check-ins expire and can be ended; no inferred online tracking. |
| 76 | Actionable help drafts | Persisted requests identify the needed action and next step. |
| 77 | Permitted evidence sharing | Only completed shared leads can be referenced; sending to chat is deliberate. |
| 78 | Availability | UTC-backed options display in each member’s local timezone. |
| 79 | Handoffs | Server-generated shared summaries target current crewmates without changing permissions. |
| 80 | Operation debrief | Terminal operation records show factual contributions, completed and unfinished shared steps. |
| 81 | Public map layers | Ownership, public events, venues and revealed investigation destinations. |
| 82 | Reactive scenery | Illustrated shopfronts and signs follow actual district holder, occupier and public state. |
| 83 | NPC remembered dealings | Recorded confirmed dealings or the current server lead produce specific memory lines. |
| 84 | Explorable headlines | Public result headlines link to the relevant existing activity. |
| 85 | Revealed story branches | Current visible choices and unresolved revealed steps avoid exposing hidden branches. |
| 86 | Physical documents | Authored receipt, ledger, notice and survey treatments include accessible transcription. |
| 87 | Scene inspection | Found documents and carried tools can be inspected on the illustrated case desk. |
| 88 | Speakers and expressions | Authored speaker identities, portrait images and expression labels accompany dialogue. |
| 89 | Optional lore | Background information uses optional disclosures. |
| 90 | Construction imagery | Monument stages derive from actual progress/target; completed works form a skyline. |
| 91 | Workspace order | Drag handles and keyboard Up/Down move the original panels and persist stable keys. |
| 92 | Focus view | Hide side columns while retaining own vital resources and an exit control. |
| 93 | Clue zoom and pan | Keyboard-operable sliders move and scale the document artwork. |
| 94 | Learning curve | Account-synced observations of own character progression include a readable values table. |
| 95 | Cosmetic challenge | Optional no-further-hints case challenge yields only a presentation stamp. |
| 96 | Discovery trails | Authored routes through permanent content have no expiry, streak or extra reward. |
| 97 | Interactive formulas | Keyboard-operable inputs evaluate the documented expression used by the projection. |
| 98 | Recovery comparison | Exact owned-consumable effects and existing recovery costs are compared without use. |
| 99 | Account workspace sync | Private authenticated namespaces, offline persistence, revision checks and explicit conflict choices. |
| 100 | Reading presets | Comfortable, compact and large-text modes persist across devices. |

## Verification

Final local result: all six suites in `npm run test:ux` and all nine suites in
`npm run test:ux:browser` passed. The additional checks listed below also passed.

`npm run test:ux` covers feedback boundaries, highlights, workspace isolation and
revision conflicts, tactical projection/action parity, investigation permissions,
item custody and Crew authorization. `npm run test:ux:browser` runs the original
four UX suites plus workspace, tactics, investigation, coordination and combined
actual-page tests. The combined proof uses the actual index, backend, game actions
and isolated browser contexts at desktop and 390px widths.

Additional relevant checks: `test/client.js`, `test/routes.js`, `test/docs.js`,
`test/migrate.js`, `test/db-rls.js`, `test/economy.js`, `test/items.js` and
`test/world-fieldwork-browser.js`. The shared consumable helper is checked against
actual use-item caps and rounding; crime and sea projections are checked against
the actual action formulas and outcomes. Browser checks also cover reduced motion,
keyboard controls, live draft continuity and absence of gameplay writes in previews.

Account synchronization tests exercise fresh-device hydration, passive startup
defaults, intentional edits during hydration, offline reload, both conflict choices
and rejection of delayed replies after an account change. Crew tests cover former
membership, membership epochs, TTL expiry and private evidence boundaries.

The database-backed tests use disposable pg-mem. Migration reapplication and RLS
catalog guards pass there; actual PostgreSQL locking, RLS enforcement and failure
recovery need a disposable PostgreSQL runtime and are not claimed by this record.
The isolated tokenomics review does not cover these later shared-workspace changes.
