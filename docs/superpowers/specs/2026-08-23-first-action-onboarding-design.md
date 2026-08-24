# First-Action Onboarding Design

## Purpose

Move a new player from character creation to a real gameplay decision before the welcome flow spends time explaining systems they have not encountered. The first-session tour will establish the fantasy, explain the first job, and then hand the player to the existing Streets controls. Money, risk, and law lessons will continue to arrive from the existing state-driven milestone tips when those states become relevant.

## Current behavior

The authenticated console opens a four-step informational tour before exposing gameplay. Its second step already tells the player to pull a job, but the only available action advances to two more explanations. Completing or skipping the tour writes the local completion flags and opens Start Here.

The server already owns the correct first action. A fresh character's coach says **Pull your first job**, points to Streets, and advances after a successful crime. The client also has an existing Streets spotlight selector and one-time tips for bank risk, heat, investigation, indictment, jail, hospital, and wanted status.

## Goals

1. Put the player on the real Streets crime controls immediately after tour step two.
2. Keep the first crime as an explicit player choice through the normal server-authoritative route.
3. Teach money and risk from actual state rather than more mandatory pre-play prose.
4. Preserve tour replay, skip, coach, Start Here rewards, milestone tips, idempotency, and all economy behavior.
5. Add deterministic client coverage and an authenticated first-session rehearsal.

## Non-goals

- Do not execute a crime from the tour or create a second crime renderer.
- Do not change crime odds, rewards, costs, onboarding payouts, or progression gates.
- Do not add schema, routes, telemetry events, or server-side tutorial state.
- Do not redesign navigation, Start Here, the coach ladder, or the milestone-tip visual component.
- Do not mutate production or live-player state during verification.

## Considered approaches

### A. Early handoff to Streets — selected

Use two mandatory tour steps: arrival and the first job. The second step's primary action completes the tour, opens Streets, and spotlights the existing crime control. This is the smallest implementation, keeps action consent explicit, and exercises the same UI and API path every later crime uses.

### B. Embedded crime action inside the tour

Render a crime picker and submit action inside the modal. This would make the first job literally part of the tour, but it would duplicate crime availability, gates, loading state, error handling, result copy, and route wiring. It creates a second gameplay client that can drift from Streets, so it is rejected.

### C. Keep four slides and interrupt after step two

Temporarily close the tour for the crime, then resume the money and coach slides. This preserves the prose but adds resumable tutorial state and risks covering the result with another lesson. It conflicts with the existing state-driven tips, so it is rejected.

## Experience flow

### First session

1. The existing tour opens after character creation.
2. **Welcome to the City** explains the identity and the cash/respect loop.
3. **The Streets** explains nerve and the first job. Its primary button reads **PULL YOUR FIRST JOB →**.
4. Activating that button records the existing local completion flags, closes the dialog, opens Streets, and spotlights the ordinary crime control.
5. The player chooses and submits the job through the existing Streets interface.
6. The server-owned coach and Start Here state advance from the real result.
7. Later state changes trigger existing contextual lessons. A lootable pocket teaches banking; heat, jail, hospital, investigation, indictment, and wanted status teach their corresponding systems.

### Skip

Skipping a first-run tour records the same completion flags and takes the player to Streets with the same spotlight. Skip means “let me play,” not “send me to another explanatory screen.” It never performs a crime.

### Replay

Replaying the tour from the glossary or Start Here must not reset onboarding or tutorial-tip flags. The replay presents the same two steps. Skipping or closing it returns the player to the screen that was active when replay began. Activating **PULL YOUR FIRST JOB →** deliberately opens Streets in both first-run and replay modes. This gives every control one unambiguous result and prevents a veteran who merely closes the replay from being unexpectedly stranded on Start Here.

## Client design

The change remains in `public/index.html` and reuses existing primitives:

- Reduce `TOUR` to the two pre-action concepts.
- Give the Streets step an explicit action intent that `tourStep()` uses to label the primary button.
- Track whether the tour was opened for a first session or replay and remember `currentTab` for replay return.
- Replace the single `endTour()` behavior with a small close helper that always records the existing flags but accepts a destination policy: first-action handoff, first-run skip, or replay close.
- For a first-action handoff, call `setTab('streets')` and use the existing Streets spotlight after the modal closes. Extend the spotlight helper with an opt-in focus flag so this onboarding handoff focuses the real crime control; all existing callers retain their current scroll/highlight-only behavior.
- Do not call `api()`, `act()`, or a crime endpoint from tour code.

The completion flag must be written before the first post-tour refresh can evaluate milestone tips. This preserves the existing rule that tips do not stack over the tour while allowing them to appear after real play.

## Error and edge handling

- A missing spotlight target remains a clean no-op through the existing `spotlight()` behavior; Streets still opens.
- If the player has already completed a crime, replay remains educational and the handoff still opens the valid current Streets state.
- Back navigation never writes completion flags until the player finishes or skips.
- Repeated replay never clears or duplicates Start Here claims.
- The first action remains covered by the client's existing in-flight lock, idempotency key, route errors, and result rendering because the tour does not submit it.

## Accessibility

The existing modal dialog semantics, focus containment, Escape handling, and focus return remain authoritative. The new primary label describes its destination and action. The first-action handoff opts into focusing the spotlight target after Streets renders; a missing target remains a clean no-op. Replay close returns focus through the existing dialog path. Reduced-motion behavior remains controlled by `spotlight()`.

## Verification

### Deterministic client regression

Extend `test/client.js` to prove:

- the first-session tour reaches a first-action handoff by its second and final step;
- the handoff and first-run skip open Streets and call the existing Streets spotlight;
- the tour code contains no crime/API submission;
- replay does not clear onboarding/tip state and has a return-screen path;
- the existing coach, onboarding, route, field, and client-mirror contracts remain green.

### Existing subsystem checks

Run the focused client and onboarding suites, including `node test/client.js` and `node test/growth.js`. No server behavior should change.

### Authenticated rehearsal

Run a local, isolated first-session browser rehearsal with a disposable in-memory account:

1. create a character;
2. observe the tour;
3. reach Streets from step two;
4. submit the ordinary first crime through the visible control;
5. confirm the result and coach advancement;
6. confirm no extra modal obscures the result.

The rehearsal must not use production or create a live identity.

### Completion gate

After focused checks pass, run the full repository suite, knowledge drift check, documentation census, and `git diff --check`. Rebuild generated knowledge artifacts only when their source hashes actually changed.

## Rollout and reversibility

This is a client-only sequencing change behind the existing local completion flag. Reverting the tour array and destination policy restores the prior flow without data migration. Existing players only see the new sequence when they explicitly replay; new players receive the shorter path automatically.
