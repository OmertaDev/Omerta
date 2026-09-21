# RC1 first-session and mobile evidence

Frozen main: `626e61b9ab2b14a9dc45566983b70cdc65692839`.
Initial repaired production/test source: `4d35c8e8b3a1db696f1bf5b5e8b7b0dc327cecb1`.
Final application bytes match `21d0589a8b1f15cbb712e574becd507b813e4b0c`;
the subsequent candidate `cce721029c86de7c6f0d875fef7cb8de29504dda` changes only
the phone harness, evidence retention and generated Knowledge artifacts.
This is an automated first-session inspection, not a study of novice people.

## Executed newcomer journey

Command: set `RC1_TEST_DATABASE_URL` to the isolated loopback administrator database,
then `node test/rc1-mobile-postgres.js`. The harness creates and removes its own database,
starts the real server against PostgreSQL, and uses Chromium with touch/phone viewports.
It enables the existing RC1 systems only inside that disposable process. It does not
grant the new player fixture money, leadership, items, Knowledge or command responses.

At 390×844 and 360×800 the guest button, character naming form and two-step tour led to
the real first crime control. The HTTP action succeeded; its result sheet was dismissed
through its actual close button when present. Mobile Family navigation opened the
Command Center. Both players could select **Investigate: The Missing Carbon Index**,
execute an issued command, see its receipt and changed case/opportunity projection,
reload and continue with zero page errors. The critical command target met 44×44px;
there was no horizontal page overflow. Results and screenshots:
[journeys.json](evidence/mobile/journeys.json),
[390px](evidence/mobile/command-center-390.png),
[360px](evidence/mobile/command-center-360.png).

The latest normal-network retest measured first crime responses at 4.928s and 4.126s;
the original run's 5.327s and 4.196s remain in its timestamped baseline log. These are scripted
execution timings; they do not estimate how quickly an unfamiliar human understands
the game. Fresh account and real PostgreSQL do not turn a bot into a cohort participant.

## The five first-session questions

| Screen | What is happening / why care | What can I do / expected result | What changed / next action |
| --- | --- | --- | --- |
| Landing | Enter the city with a persistent street identity. | Explicit guest entry, then a named character. | Character-creation flow opens. |
| Arrival tour | Establish the first street action. | The second step names and focuses the actual first-job control. | The game opens Streets and hands focus to the real action. |
| First action | The server resolves the job, including adverse outcomes. | Result/vignette supplies immediate feedback; dismiss an actual result sheet to navigate onward. | Current player state refreshes; the player can open another screen. |
| Command Center | “What changed?”, “What needs my attention?”, “What can I do?” organize current authorized information. | Available command controls are enabled; costs, known requirements and confirmations come from the server board. | A successful investigation produces a visible receipt, case progression and changed opportunities. |
| Return after reload | Current state is reconstructed from PostgreSQL. | Open the Command Center and choose from a newly issued board. | No lost character or duplicate first command; this proves reload, not voluntary return rate. |

The complete Command Center is long on a phone (cases, operations, equipment and
history continue below the first actionable sections). This is an observation for
cohort testing, not proof that people abandon it and not justification for redesign.
No solo override of Family/Crew authority was introduced: collective objectives still
require their canonical roles. A first meaningful action does not require such an override.

## Other executed browser evidence

`node tools/mobile.js`: 175 screen checks at 320×568, 375×667 and 360×780 passed.
This includes 44px primary navigation, overflow/fold checks, the first-job handoff,
restart-window behavior, admin panels, cooldown freshness, deep-city content,
lockup cold load and 4,435 poisoned strings across 150 API responses in the stored-XSS sweep.
`node test/launch-invites-browser.js` passed actual invite redemption, rejected-code retry,
token persistence, HttpOnly admission cookie, mobile layout and Crew invitation controls.
These default-configuration screens do not independently prove enabled RC1 campaign stories.
See [journey coverage](RC1-JOURNEYS-REPORT.md) for the separate campaign/operation proof.

## Limits and failure classification

The first new harness attempted a hidden desktop group control on mobile (**D: tooling**).
Its second attempt failed to dismiss a legitimate adverse-action modal (**D: tooling**).
Both failures are retained in `evidence/baseline/mobile-postgres-*.log`. The final harness
uses visible mobile navigation and the actual modal close control; no forced click or
DOM removal bypasses player interaction. Final source also closes the PostgreSQL pool
before dropping its disposable database.

A fresh Linux run exposed another harness assumption: the first crime can open the
legitimate **Your first stretch** onboarding dialog, whose acknowledgement is **got it**,
not the generic result-sheet close button. A fixed 2.5-second pause could also precede
the client's queued refresh. Classification **D: tooling**, not a blocked player control.
The repaired test waits for the actual operation desk to stop reporting busy and the
vignette to disappear, then uses real close/acknowledgement controls. It asserts that
no dialog remains. Initial Linux failure and the photographed lockup dialog are retained;
local retest passes both sizes. Final hosted retest is recorded in the gate report.

## Slow connection and lost-response retry

`node docs/release/evidence/mobile-network-proof.mjs` passed on real PostgreSQL at
390×844 and 360×800. The evidence-local harness uses Chromium network latency of 750ms,
160,000 bytes/s download and 64,000 bytes/s upload. It types a24-character name through
keyboard events and submits with a500px-high viewport before restoring the normal size.
This is a geometry/focus check, not emulation of a native software keyboard.

For each player the real server completes the issued investigation, after which the
browser deliberately loses that response. The actual **Retry saved move** control
returns `replayed:true` with the identical execution identity. A nine-table canonical
row census is unchanged across the retry; exactly one coordination instance and receipt
exist per player. The visible receipt and reconstructed board remain usable, with no
page errors or horizontal overflow. The first scripted action took23.748s and 22.560s
under the imposed network conditions. [Results](evidence/mobile-network/journeys.json),
[log](evidence/mobile-network.log), [390px viewport](evidence/mobile-network/command-center-390.png).

The first evidence-local census assertions incorrectly assumed the discovery command
used legacy mystery/content-instance tables. Actual dispatch uses the Coordination
service. Those **D: tooling** failures are retained in `mobile-network-initial.log`
and `mobile-network-instance-table.log`; the final assertion measures its real
coordination instance/receipt alongside the other domain tables. No application
mutation or replay assertion was weakened to obtain the pass.

Installed mobile wallet applications, external OAuth, native mobile keyboards,
all long-inventory/Family/feed combinations, every operation interruption and a
human first-15-minute session remain unverified. Chromium viewport
emulation and fixture-assisted stories must not be substituted for those claims.
