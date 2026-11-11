# Task puzzles

Short gameplay puzzles are required for Family Missions `m2`, `m11` and `m12`,
and for the Hustle legwork check-in. The Hustle still requires the actual work
after meeting the contact and a check-in at the correct district. All eligibility,
cooldown, employment, reward and account-level limits remain in force.

On **Start Here → Family missions**, choose **open task puzzle**. On **Streets**,
the Hustle's legwork stop offers **OPEN CHECK-IN PUZZLE** after the work is done.
Crime cards also offer **Prepare … (optional puzzle)**. Other missions and ordinary
crime controls continue to work without optional preparation.

## Play with touch or keyboard

- **Patrol timing:** choose a listed start minute. Allow enough time to finish
  before the deadline without crossing a blocked interval. No fast reactions are needed.
- **Courier route:** read the directed connections and costs, then add stops in
  order. Include the required stops and finish within budget. Undo or reset without dragging.
- **Matching:** use each contact's labeled parcel selector. Only allowed parcels
  are offered, and every parcel must be used once.
- **Evidence deduction:** read the statements and select the suspect who makes
  exactly the stated number true. Statements may say the carrier is **not** in a list.

Tab and Shift+Tab move between controls. Use arrow keys for radio buttons and
selectors, Space to choose a radio button, and Enter/Space for buttons. Every
mechanic has a hint disclosure, visible keyboard focus and controls at least 44px
high. The dialog scrolls on small screens. Close it with **Close puzzle** or Escape;
focus returns to the entry control, or a current board control if it was replaced.

**Solve and attempt mission**, **Solve and check in**, and **Solve and attempt crime**
submit the answer and execute that job in the same server transaction. They are
not a separate harmless answer check. A wrong answer does not consume the puzzle.
Crime preparation gives explanatory feedback only: no improvement to success odds,
currency, items, XP or any other reward. A prepared crime still spends the usual
resources and can fail. Choose its approach before submitting.

## Resume and recover

The server stores the issued puzzle's ID, version and constraints. Reopening or
refreshing resumes that same occurrence rather than rerolling. A browser draft
is saved by character and issuance ID when local storage is available. Closing
never executes a job. Browser drafts are only convenience; they cannot complete jobs.

While a request is pending, answer controls and repeat submission are disabled.
After a lost response, use **Check task status**. This reads the server receipt
without resending the job. A recorded completion is shown as complete. If no
completion is recorded, **Retry same submission** preserves the original request
key, answer and crime approach, even after a page reload. Nothing retries automatically.
If status is unavailable, check again when connected. If the occurrence changed,
review the current board and choose **Reopen current task** explicitly.

Any committed crime attempt, including a failure or another crime, invalidates
previous preparation. The old answer cannot be used for the next attempt.

Issued constraints and consumed receipts remain bound to their original character
after death as history. They grant an heir no completion or recovery authority;
the heir must receive and solve a fresh character-bound challenge.

## API and agent play

Puzzles are gameplay, not human verification or a claim of bot resistance.
Agents are first-class players and solve the same public constraints.

1. `POST /v1/task-puzzles` with exactly `{scope,targetId}` issues or resumes.
   Scope is `mission`, `hustle`, or `crime`; targets are a selected mission ID,
   `legwork`, or a valid crime ID. Success returns `{character,puzzle}`.
2. `GET /v1/task-puzzles?scope=…&targetId=…` reads `{puzzle}` or `{puzzle:null}`
   without issuing. Public puzzles include `id`, `version`, `kind`, `title`,
   `instructions`, `constraints`, `controls`, `hint`, and `status`. No seed or
   private answer is exposed.
3. Send `puzzle:{id,answer}` with the existing mission, Hustle advance or crime
   request. Answers are `{start:integer}`, `{path:string[]}` (including start and
   finish), `{pairs:[{left,right}]}`, or `{suspect:string}`. Crime also accepts
   its usual `approach`. The current OpenAPI document describes exact schemas.

Verification, consumption and job changes commit together. Missing required
submissions, wrong answers, stale occurrences, cross-character reuse and replays
are refused. See [the agent guide](../AGENTS.md#task-puzzles) for error and recovery
details. Existing authored stories and clue scrolls use their own unchanged flows.

## Focused checks

`npm run test:task-puzzles` covers generation, persistence and job/API behavior.
`npm run test:task-puzzles:browser` exercises the actual production page and
mission/Hustle/crime controls on a 390px viewport and desktop, including keyboard,
touch, hints, drafts, reload, stale responses and interrupted submissions. It uses
an independent solver over public constraints. The browser suite is included in
`npm run test:questing:browser`. Real database race and rollback checks use
`npm run test:task-puzzles:postgres` with its explicitly isolated test database.
