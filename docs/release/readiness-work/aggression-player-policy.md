# Scoped high-aggression policy

This RC1-03 component selects actual standard street jumps and ordinary nonviolent
progression/recovery. It does not qualify the aggression archetype or a matrix cell.

## Source-reviewed conflict inventory

| Existing authority | Public discovery / execution | Implementation here |
| --- | --- | --- |
| Standard jump; rob/message intents | `/v1/streets`, `/v1/me`, `/v1/rivals`; `/v1/streets/:id/jump` | Standard jump only |
| Car/boat theft, trunk robbery, sabotage | Street roster and public own state; street theft routes | Open |
| Search and lethal fire | Street roster, own `hunt`; search/fire routes | Open; death and replacement not exercised |
| NPC hired hit | Street roster and public contractor catalog; NPC-hit route | Open |
| Business extortion/robbery/takeover | Public street fronts/business boards; business routes | Open |
| Convoy ambush, port interception, rival racket raid, NPC war | Their authorized boards and canonical domain routes | Open |
| Family war/turf contests and consensual duels/boxing/racing | Authorized Family/contest boards | Open; do not equate every competition with violence |
| Generic `situation.act`, `world.execute`, `operation.*` | PlayerCommand projection | Unclassified; type alone cannot establish conflict semantics |

The reviewed implementation is `src/social/combat.js:jump`, its mounted route in
`src/server.js`, `src/game.js:withTwoCharacters` and `heal`, the public street and
own-character projections, and `src/rivals.js:rivalsBoard`. The current Agent Turn
policy explicitly disables PvP. No general combat PlayerCommand is issued.

`createAggressionPolicy({ accountId, seed })` accepts a composite of ordinary
authorized responses: `{ commands, me, streets, rivals }`. The command actor and
own character must match. It never reads target stats, account IDs, hidden shields,
database snapshots or diagnostic observers. Standard-jump public source constants
(25 energy, 5 ammo, 20 minimum health) are checked against the canonical `M3` values
by the native exercise; they are not claimed as extra `/v1/rules` response fields.

Candidates require the actor's visible health/resources and absence of visible
jail, hospital, safehouse and witness protection. Targets must appear on the street
roster, be another character in the same district, and lack visible jail/hospital
protection. Same-tag Family targets are conservatively excluded. Public projections
omit some Crew/protection facts, so this is **publicly plausible eligibility**, not
omniscient admission. Canonical HTTP revalidation decides actual eligibility;
denials stay visible and do not become completed choices. Other districts, Family
exceptions and omitted authorities remain coverage exclusions.

## Predeclared choice and identity contract

Among `n` fresh completed choices observed with both implemented classes available,
`floor(7*n/10)` choose conflict. Every full ten-choice block therefore has seven;
incomplete blocks round down. Single-class forced choices have separate counters.
Report the actual total fraction separately: it need not equal 70%. A losing jump
is still a committed meaningful conflict. Reads, invalid attempts, waits and exact
replays never increase the denominator.

Nonviolent alternatives are issued mystery/discovery, Knowledge sharing/revocation,
craft/salvage commands and an affordable heal from the actor's canonical quote.
When the quota selects this class, healing takes priority. Known rivals take
priority among jump targets; the seed ranks remaining equivalent candidates.
Generic world/operation/situation types are listed as unclassified, not silently
counted as alternatives. Consequently this is a scoped denominator, not every
eligible choice in the full game.

Use `choose(view, { logicalAt })`, persist `checkpoint()` and dispatch its exact
`request` through authenticated HTTP. Legacy requests receive a deterministic
idempotency key; PlayerCommands retain their issued execution identity. Pass
`settle({ idempotencyKey, status, replayed, response })` the canonical outcome, then
persist another checkpoint. `restore(checkpoint)` preserves pending requests and
quota counters. An unknown response stays pending. A replay with no previously
recorded fresh settlement blocks further choices for external journal/receipt
reconciliation. The policy never guesses across the database-commit/ack gap.

## Bounded verification

`node test/rc1-aggression-policy.js` checks 1,000-choice quota prefixes, forced and
unsupported choices, public gates, hidden-input negative controls, loss accounting,
recovery/retaliation priorities, exact pending identities and checkpoint corruption.

With `--postgres`, provide loopback `COORDINATION_TEST_DATABASE_URL` and a fresh
restricted `RC1_AGGRESSION_OUTPUT`. The test owns a separate database. Two declared
fixtures start with schema-default resources; one has legal trained stats (50/5/50),
the other defaults (5/5/5). Both make a real check-in before the measured baseline.
The stat fixture has no claimed natural training history. All subsequent changes
use ordinary authenticated HTTP. The test requires two committed losses, canonical
healing, a winning jump, exact HTTP replay, the untouched real 180-second hospital
deadline, and a rival-targeted retaliation after recovery. It records seeded random
draws, requests/results, full snapshots, checkpoints and all 55 ledger invariants.
Application/database clocks use real time; no same-world replay claim follows.

The initial native attempt at `b67c1698` failed before server startup because the
test omitted the mandatory moderator credential. Its failed run remains retained.
The harness now creates that local test credential alongside its JWT/market test
configuration; it does not disable or weaken deployment preflight.
The second attempt at `bd2b7a61` used the invalid mode name `OFF` for the Director.
It failed during server startup and preserved the cleanup refusal while its pool
was connected. After that test process exited, the exact database name, OID and
ownership marker were checked and the database closed with zero other sessions.
The harness uses `DIRECTOR_DISABLED` and validates that configuration before server
allocation. This scoped combat exercise never claimed Director/worker coverage.
The third attempt at `57a1bfa5` completed the gameplay path but failed the required
history validator: GET identities included absent `body`/`key` fields as JavaScript
`undefined`, producing invalid JSONL. Its immutable run file contains the earlier
provisional gameplay result; the recorded validator rejection invalidates that
entire proof. The harness now omits absent identity fields, tests their actual
canonical serialization, and parses the history before assigning a passing result.
The `6302816f` run passed the gameplay and history checks but failed owned-database
cleanup: closing Fastify did not close its PostgreSQL pool. The harness now closes
that exact owned pool explicitly before requesting the guarded database drop.
The failed run is retained; its post-process cleanup separately verifies ownership
and zero active sessions. The central evidence guard from `a0f37c74` is also applied
for subsequent runs so invalid JSON values fail before invoking an action.

Death, heirs, replacement, all other conflict authorities, full resource journals,
complete worker intervals, 90-day lifecycles, all 225 runs, whole-policy accounting
and production load remain open. Waiting for hospital protection is legal temporary
recovery, not a dead-world result.
