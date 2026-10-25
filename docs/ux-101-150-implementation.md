# OMERTÀ: UI/UX improvements 101–150

Implemented in the shared workspace on 2026-10-25. This record describes local
source and disposable test fixtures; it does not establish production deployment.
Personal expression and planning remain presentation. The existing issued controls
retain gameplay authority, confirmations, spending and ownership checks.

| # | Improvement | Implemented behavior |
|---|---|---|
| 101 | Tactile controls | Pointer and keyboard press/release states; reduced motion and Quiet feedback suppress movement. |
| 102 | Connected transitions | A bounded selected-object label/thumbnail connects case/item/NPC inspection to its destination. |
| 103 | Immediate preference preview | Room warmth, grain and accents preview live; Cancel restores, Save persists, history restores prior choices. |
| 104 | Atmospheric loading | Real GET request lifetimes drive recognizable map/card/row silhouettes; failure and account changes end the matching lifetime. |
| 105 | Venue soundscapes | Verified bed selection and volume use one existing audio engine with master mute, ambience, visibility and data-saving controls. |
| 106 | Travel panorama | Optional factual arrival view follows a successful ride and can be dismissed immediately. Existing travel is instantaneous, so no extra wait is invented. |
| 107 | Dialogue narration | Explicit speech controls read revealed authored text; navigation and hiding the page stop speech. Full text remains available. |
| 108 | Harmless desk interactions | Lamp, record and keyboard/drag coaster interactions change presentation only. |
| 109 | Drag-to-prepare crafting | Own revealed ingredients can be placed in a preparation tray; the original craft control and confirmation remain separate. |
| 110 | Quick inspection | Authorized item, case, NPC and requirement peeks retain the current task and original controls. |
| 111 | Personal office | Arrange cosmetic objects with drag/drop or numbered keyboard-accessible positions. |
| 112 | Trophy shelf | Choose up to three currently eligible real trade, season or completed-collection accomplishments. |
| 113 | Portrait wardrobe | Curated illustrated hat, coat and scarf previews sit beside the actual avatar; no equipment or token art changes. |
| 114 | Garage showroom | Illustrated owned cars and boats retain their official names and current conditions. |
| 115 | Private vehicle names | Account-owned nicknames accompany actual fleet identities without renaming or transferring the underlying asset. |
| 116 | Ancestral hall | Connected generations show the real steward, ancestor epithets, death records and honor. Unknown lifetime dates are not reconstructed. |
| 117 | Heir letters | Private writing becomes readable to a later actual character/generation after succession. |
| 118 | Personal code | Voluntary player writing can appear beside revealed story decisions without affecting outcomes. |
| 119 | Chapter names | Character-scoped titles appear on a private chapter cover and office nameplate. |
| 120 | Contact annotations | Private nicknames and notes accompany only known authorized contacts. |
| 121 | Relationship constellation | Explore authorized known cast and recorded connections; private roles and unknown identities stay hidden. |
| 122 | Case cold opens | Skippable and rereadable authored introductions accompany actual case records. |
| 123 | Choice-specific epilogues | Real completed branches select distinct authored endings. |
| 124 | Resident street scenes | Identified authored residents add place-specific personality without implying another player is active. |
| 125 | NPC correspondence | Confirmed story milestones unlock authored letters, with private read/unread preferences. |
| 126 | City lighting | Authenticated server clock projections choose the city lighting state. |
| 127 | Story crossover | Two actual completed case files unlock a new authored newsroom encounter. |
| 128 | Document comparison | Compare two found documents with synchronized zoom and independent transcriptions. |
| 129 | Passage highlights | Private annotations must match actual revealed document text before being displayed. |
| 130 | Expressive responses | Optional authored phrasing accompanies revealed dialogue; issued action terms and controls remain visible and unchanged. |
| 131 | Inventory tray | Pin actual held or committed records with current quantities and availability. |
| 132 | Inventory search | Search actual names, uses, recipe sources, materials and revealed case context. |
| 133 | Combined preparation lists | Aggregate selected recipes against the correct account inventory; external car requirements remain subject to the original selector. |
| 134 | Named builds | Store bounded hypothetical equipment/skill selections for the account. |
| 135 | Build comparison | Read fresh server projections for two saved configurations, including effective stats and prerequisite conflicts. |
| 136 | Plan templates | Save manual three-move templates and apply them to the existing planner for current resource/clock validation. |
| 137 | Action palette | Find and focus an original current-screen control; its action and confirmation remain manual. |
| 138 | Workspace history | Bounded account-scoped snapshots restore private sections, survive local reload and can reverse a restoration; no game action is reversed. |
| 139 | Form recovery | Safe visible fields survive replacement; validation focuses the original invalid field. Sensitive fields are excluded. |
| 140 | Precise bookmarks | Store actual revealed passage identity/text and restore the appropriate case/document after settled rendering. |
| 141 | Crew threads | Conversations attach to an authorized operation, shared plan or question. |
| 142 | Character emotes | A member deliberately publishes a selected in-character gesture. |
| 143 | Mentor subjects | Eligible players explicitly publish offered specialties or a newcomer help subject with a 30-day expiry. |
| 144 | Plan annotations | Authorized members reply to particular named steps in a shared conversation/plan. |
| 145 | Crew field manual | Current members edit revision-checked player advice, visibly separate from official rules. |
| 146 | Shared map pins | Current Crew members post planning annotations on allowlisted public destinations; no private locations are exposed. |
| 147 | Spoiler curtains | Authors mark shared prose; recipients deliberately reveal it. |
| 148 | Group portraits | Current participants explicitly consent to their exact current avatars; downloads require at least two valid consents. |
| 149 | Crew crest | All members can preview curated shapes, symbols and colors; only the current leader publishes with revision checks. |
| 150 | Operation playback | Authorized shared events play chronologically using actual recorded times and contribution records. |

## Verification

Final local result: all ten suites in `npm run test:ux` and all fifteen suites in
`npm run test:ux:browser` passed. Client contracts, mounted-route authentication,
PWA, migration, death-disposition, RLS catalog and documentation checks also passed.

The backend and pure checks run through `npm run test:ux`. The browser checks run
through `npm run test:ux:browser`, including the earlier 1–100 regression suites.

- `test/ux-feel-browser.js`: 101–110, real fieldwork controls, keyboard, speech
  lifecycle, selected-object transitions, truthful loading and reduced motion.
- `test/ux-identity.js` and `test/ux-identity-browser.js`: 111–120, real owned fleet,
  earned eligibility, private sync, actual estate/heir letter delivery and mobile.
- `test/ux-story.js` and `test/ux-story-browser.js`: 121–130, real branches and
  completions, hidden-evidence redaction, authored content, document comparison,
  fresh-device annotations, server time and account isolation.
- `test/ux-tools.js` and `test/ux-tools-browser.js`: 131–140, actual fieldwork shapes, preparation scope,
  server-fed comparison, manual controls, bookmarks and safe form recovery.
- `test/ux-workspace-browser.js`: bounded undo snapshots, restoring a restore,
  offline reload, namespace conflicts and late account replies.
- `test/ux-community.js` and `test/ux-community-browser.js`: 141–150, real current
  and foreign memberships, join epochs, consent, revision conflicts, permissions,
  TTL, no currency/role movement and no automatic chat sends.
- `test/ux-personality-browser.js`: all fourteen factories together in the actual
  page, with actual server projections, desktop/390px layouts, native dialogs,
  fresh-device preferences and unrelated-account privacy.

Additional gates include client wiring/API contracts, routes/authentication,
PWA behavior, schema reapplication, death-disposition coverage, RLS catalog guards,
and documentation census. Portrait consent retains its original character and
membership epoch; death cannot transfer consent to an heir automatically.
Story and Community caches reject delayed predecessor replies after succession.
The shared GET boundary also rejects old-character observations. Toolbar placement,
original mobile cost controls, reordered form drafts and concurrent disclosure
repaints have explicit browser regressions.

Database-backed checks use disposable pg-mem. They do not prove actual PostgreSQL
locking, RLS enforcement or failure recovery. No external players were messaged,
and no production deployment or activation is part of this implementation.
