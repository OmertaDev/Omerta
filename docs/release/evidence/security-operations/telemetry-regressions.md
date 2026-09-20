# RC1 telemetry regression record

All entries below were introduced by RC1's first observability patch, not by
the frozen `626e61b9ab2b14a9dc45566983b70cdc65692839` application. Their
classification is **NEW REGRESSION**, corrected before the release decision.
Tests were strengthened; no gameplay assertion or rate limit was disabled to
make them pass.

## TEL-01 — passive observations consume gameplay rate allowance

Severity/category: P1 severe UX / observability.

The initial real PostgreSQL run of `node test/world-telemetry.js --postgres`
failed at the valid observation assertion with `429 !== 200` (line 40 at the
time). `DATABASE_URL` correctly enabled the production account rate limiter.
The generic POST guard charged session, Command Center and opportunity beacons
against the same five-action burst as real commands. Sending those passive
events followed by preparation could therefore make a real move fail with 429.

Correction: the exact authenticated `/v1/commands/observations` route uses a
separate bounded bucket (3 observations/second, burst 32). The shared guard
still verifies current account status and token revocation. Other mutation
routes retain their existing bucket and authority.

Retest: the telemetry suite runs with rate limits enabled, floods observations
until their own 429 appears, then successfully replays a real committed Player
Command. It also validates the complete funnel through actual HTTP routes.

## TEL-02 — observation refresh cancels confirmation

Severity/category: P1 mobile failure / severe UX.

The browser journey at both 320px and 390px found that an observation POST
emitted a `projection:changed` WebSocket hint. The resulting projection clear
closed the still-active salvage confirmation before the player could confirm.
The original failure is retained by the player workstream in
`../player/telemetry-confirmation-regression.log` and its JSON companion.

Correction: `src/projection-events.js` ignores the exact pure observation route
before capturing a gameplay audience. `test/projection-events.js` executes an
observation POST with connected audience fixtures and asserts no hint. The
mobile journey is rerun independently after this change.

## TEL-03 — telemetry SQL delays a committed command response

Severity/category: P1 severe UX / observability.

The initial route awaited `recordWorldCommand`, which awaited the database
write. A blocked telemetry INSERT could delay an already committed action
until a database timeout; best-effort exception handling did not bound latency.

Correction: a bounded queue permits one active telemetry write per pool and
128 pending writes. Command and view handlers do not wait for telemetry I/O.
Write failures and dropped observations are counted explicitly. The browser
also bounds its observation queue to 32 entries.

Retest: the HTTP test holds every telemetry INSERT on an unresolved promise,
executes a real command, and receives its successful response before releasing
the promise. A 200-event queue proof checks one active write, exactly 128
accepted writes and at least 72 recorded drops.

## TEL-04 — false consequence and return-session attribution

Severity/category: P1 observability.

The initial renderer logged every historical consequence whenever the board
rendered. The aggregator could advance the funnel after an unrelated command.
It also used the total number of any previously observed sessions, allowing
the original session to count as a return after another tab had existed.
Reopening the first opportunity could count as the second when a different
opportunity had been opened earlier.

Correction: command telemetry retains hashes of authorized, current,
player-caused consequences on actually changed world objects. Replay and old
or newer foreign history do not create that attribution. The UI only records
the matching consequence when it is rendered. A second opportunity must have a
different identity from the first; a return must use a different identity from
the command's session and arrive at least 30 minutes later.

Retest: all eight stages pass; unrelated old history, reopening the first
opportunity, an early reload, a late observation from the original session,
and a newer foreign world event are separately rejected as funnel progression.
These remain untrusted UI observations for analytics, never permission facts.

## TEL-05 — client test extraction seam

Category: NEW REGRESSION in the existing client test harness.

`test/player-command-client.js` initially raised `ReferenceError: observeWorld
is not defined` because its extracted mutation/renderer functions did not
include the new optional observer dependency. The harness now supplies an
observation recorder and adds substantive assertions: only preparatory command
types log preparation, successful preparation does not invent a consequence,
and rendering history does not attribute that history to the current command.

Final command timestamps and outcomes are retained in `telemetry-results.json`.

## TEL-06 — legacy screen beacon interrupts confirmation

Classification: **KNOWN BASELINE**, newly reproduced during the mobile retest.
Severity/category: P1 mobile failure.

After the new observation route was corrected, the mobile lane intermittently
lost the same confirmation when the existing 15-second `/v1/screens` flush ran.
That pure reach beacon used the gameplay `api()` queue, which invalidated the
world immediately, and the server then emitted a second projection hint.

Correction: both passive paths are exact exceptions to client invalidation and
server gameplay hints. The legacy screen flush now uses a best-effort fetch
with a three-second timeout outside the gameplay queue and uses the independent
observation rate bucket. Ordinary command routes keep their invalidation,
idempotency and gameplay-rate behavior.

Retest: `test/world-projection-client.js` calls both passive paths and observes
zero invalidations, then calls the real execute path and observes both player
and world invalidations. `test/projection-events.js --postgres` independently
observes zero server hints for both passive paths. The browser workstream owns
the complete 320px/390px confirmation rerun.

## TEL-07 — unclassified aggregate query fan-out

Classification: **NEW REGRESSION**, corrected.

`node test/gates.js` rejected the initial `Promise.all` of ten moderator-report
queries at `src/world-telemetry.js:98`. The initial diagnostic is retained in
`gates-telemetry.log`. The report now reads those aggregates sequentially,
avoiding ten simultaneous connections and preserving the existing assertion.
The next run (`gates-telemetry-retest.log`) passed that boundary and reached the
new-test registration gate; registering release suites belongs to the release
package workstream.

`node tools/pgquery.js` on real PostgreSQL passed 4,061 static statements with
168 counted interpolations and 39 nonliteral helper sites; no ceiling was
increased. The telemetry aggregate helper is one explicitly nonliteral site;
its ten literal query shapes are exercised by the native telemetry test.
