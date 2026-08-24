# Discovery Integrity Sprint

## Goal

Make OMERTÀ's discovery surfaces tell the truth and move a player directly into the activity they were promised. The sprint is complete when optional identity/social onboarding no longer hides gameplay discovery, daily guidance opens the relevant system, the playthrough harness cannot report a level gate complete before the level is reached, and operations can measure adoption of the currently invisible player economy loops.

## Constraints

- Preserve the server-authoritative economy and existing onboarding rewards.
- Do not weaken wallet, family, social, mint, or extraction gates.
- Keep changes surgical and reuse the existing rule, coach, activity, and engagement catalogs.
- Treat `public/index.html` as an overlapping dirty file: edit only the relevant discovery/daily regions and do not commit unrelated changes.
- Use behavior-first tests for each correction, then run the complete native suite and knowledge checks.

## Track 1 — Gameplay discovery and Explore honesty

**Success criteria**

1. The onboarding API exposes a gameplay-complete signal based only on the four core actions already recognized by the coach: crime, boost, bank, and path.
2. The existing all-tasks/capstone signal remains unchanged and still includes offered wallet, family, and social tasks.
3. The client unlocks veteran/discovery content from gameplay completion while continuing to show optional unfinished onboarding tasks.
4. Explore describes its catalog as featured systems and exposes catalog scope/count; it never claims to enumerate every game system.
5. Server and client regression tests demonstrate these behaviors.

## Track 2 — Actionable daily guidance

**Success criteria**

1. Every daily kind has one server-owned guide containing an exact destination tab and concise action instruction.
2. Daily API payloads include that guide.
3. Today and the coach route an unfinished daily to its actual activity; a completed objective routes to the Streets claim surface.
4. The client renders server guidance rather than maintaining a conflicting private mapping.
5. A table-driven test covers every daily kind.

## Track 3 — Playthrough truthfulness

**Success criteria**

1. `Get to level 5` is recorded as obeyed/completed only when post-action state is level 5 or higher.
2. Other crime-driven coach rungs retain their intended completion rules.
3. A focused regression test fails under the former predicate and passes under the corrected predicate.
4. A short real playthrough no longer produces the former false completion path.

## Track 4 — Economy adoption telemetry

**Success criteria**

1. Black-market, peer-loan, and ordinary contract lifecycle actions emit stable engagement events through their existing transactional helpers.
2. The engagement catalog claims every new event and contains no phantom event.
3. Integration tests execute representative actions and prove the operator report observes adoption without changing game outcomes.

## Track 5 — Verification and knowledge reconciliation

**Success criteria**

1. Focused tests for every changed subsystem pass.
2. Static analysis and route/client contract checks pass.
3. The complete `npm test` suite passes from a fresh run.
4. The playthrough and graph/knowledge checks pass; generated documentation counts are reconciled only if the source census proves they are stale.
5. An independent reviewer finds no unresolved correctness or scope issue.

## Execution order

The tracks run sequentially because onboarding, daily guidance, and telemetry share API/client census tests. Each track follows red → green → focused review. No production or live-game mutation is part of this sprint.
