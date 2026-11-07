# Questing expansion

The [forty-feature work graph](questing-workgraph.json) records the approved scope, dependencies,
implementation paths and verification runs. This is source implementation evidence; production
deployment and exact-hash content activation are separate release steps.
The [scoped source review](questing-review.md) retains findings, fixes, retests and its source hashes.

The expansion adds ten authored cases: The Obituary Arrives Early, A Very Small Family Dinner,
The Name Between the Lines, Three Witnesses One Room, Nothing Happened at the Wedding,
When the Shop Opens Again, The File They Left Behind, The Back Room of the Archive,
The Sixth Envelope, and The Receipt Between Two Houses.

The Content Desk's interactive case files provide structured evidence, timelines, scenes,
interrogations, item use, plans, hint ladders and persistent private theories. The connected
personal cases remember decisions across quests. New personal packs explicitly opt into
account-level legacy continuity; existing character-scoped packs keep their established rules.

Crew cases support complementary private evidence, consented private objectives, shared notes
and voluntary handoffs. Rival cases require explicit account invitations, consent and current
membership in the pinned organizations. Shared notes are player interpretation, not confirmed facts.

History shows personal relationships, casework accomplishments and district aftermath. An earned
memento opens the archive investigation, which unlocks the daily reading-room service. New trail
scrolls use surveillance, route, landmark and witness deductions. Existing scrolls remain readable.
The community workshop publishes only bounded fictional mysteries with a unique evidence solution.
These new systems grant no cash, token, territory or combat power; clue caskets retain their existing
reward accounting.

```powershell
npm run test:questing
npm run test:questing:browser
npm run questing:check
node tools/questing-workgraph.js verify
node tools/questing-workgraph.js check --complete
node tools/questing-content.js build
```

`write` on `questing-content.js` regenerates source JSON after an intentional authored-source edit.
`check` verifies source snapshots and the activatable runtime profile. `build` creates immutable
versioned bundles in `content/dist`; it refuses to replace a different artifact and never activates
content. Use the existing operator activation endpoint with the built artifact's exact content hash.

Puzzle complexity, narrative depth and replay variety still need player testing. These are bounded
playable implementations, not a claim that the content has reached RuneScape's breadth or quality.
