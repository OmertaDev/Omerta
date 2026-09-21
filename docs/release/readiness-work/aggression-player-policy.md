# Scoped high-aggression policy

This RC1-03 component selects standard street jumps, canonical search/fire and
ordinary nonviolent progression/recovery. It does not qualify the complete aggression archetype or a matrix cell.

## Source-reviewed conflict inventory

| Existing authority | Public discovery / execution | Implementation here |
| --- | --- | --- |
| Standard jump; rob/message intents | `/v1/streets`, `/v1/me`, `/v1/rivals`; `/v1/streets/:id/jump` | Standard jump only |
| Car/boat theft, trunk robbery, sabotage | Street roster and public own state; street theft routes | Open |
| Search and lethal fire | Street roster, own `hunt`/cooldown; search/fire routes | Implemented in policy version 2; bounded canonical death/heir exercise retained below |
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
replays never increase the denominator. A completed search is conflict preparation;
it counts as a committed conflict choice, but never as a shot or combat win. Separate
search/shot/kill/loss/cancellation counters prevent a preparation-heavy run from
being described as 70% attacks. A canonical fire cancellation remains a completed
search-disposition choice with its own counter.

Nonviolent alternatives are issued mystery/discovery, Knowledge sharing/revocation,
craft/salvage commands and an affordable heal from the actor's canonical quote.
When the quota selects this class, healing takes priority. Known rivals take
priority among conflict targets; within that priority, ready fire precedes search,
then jump. The seed ranks remaining equivalent candidates.
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

Version 2 requires the current own-character generation and retains its authorized
`hunt` and `shootCdSeconds` in the cursor. Search requires an equipped public weapon,
at least 50 owned rounds, no current hunt and no shot cooldown. Fire requires the
same visible target, a zero hunt countdown, a zero shot cooldown, 40 energy and at
least 50 rounds. It commits `min(floor(ownedAmmo),2000)` rounds. Original canonical
gates remain authoritative. Search/cooldown waits retain their public recovery
state; they are not evidence of a dead world.

The cursor advances only to a newer authorized generation on the same account.
Quotas and completion identities survive replacement. An older pending request
blocks dispatch on the heir until the original receipt/denial is reconciled. Exact
replay after a recorded fresh settlement must match its response hash and adds only
to `knownReplays`. Version 1 checkpoints remain tied to their original source;
version 2 rejects them instead of silently changing their meaning.

`test/rc1-aggression-lifecycle.js --postgres` uses a fresh restricted
`RC1_AGGRESSION_LIFECYCLE_OUTPUT` and declared initial progression/weapon fixtures:
shooter level 600, victim level 10, default numeric resources. Canonical check-in
funds 100 ordinary ammunition boxes; the victim opens actual $2,000 escrow. Twenty
15-minute policy sessions must each observe both legal implemented classes and
complete exactly 14 conflict choices. Every request is chosen from fresh authorized
views; checkpoints restore before dispatch. Original workers run at every due
logical deadline. A separate victim policy acts before death and continues its
same-account quota on the actual heir. Forced/denied/waited choices cannot pad this
block. This bounds the implemented component, not every possible aggression action.

The first version 2 native block passed at source
`24088c3242f846deb0f87b4e95f53654b54d4077`, 2026-09-21
06:54:44.189–06:55:38.646 UTC, PostgreSQL 18.4 / Node 24.19.0 / Windows.
Restricted evidence: `C:/Users/Jorge/.codex/rc1-readiness-private-20260921/aggression-lifecycle-24088c32-native`.
All 392 indexed artifacts and 1,045 hash-chained history rows validated, source
remained clean through sealing, and owned-database cleanup succeeded. Configuration
SHA-256: `69a5e426ffacc5994e25a2cf315be190d85d91003a4ef044db1e2b959339dd90`.
Run SHA-256: `30a3d89c5322ba86e33a73c37b25c03e0db6360507abb21ca304b19092e334ef`.

The shooter completed 20 genuinely mixed choices: 12 jumps, one search preparation,
one lethal shot, two mystery starts and four discovery starts. Thus 14/20 (70%) were
conflict selections, including the separately disclosed preparation; this is not a
claim of 14 attacks. There were nine combat wins (including the kill), four losses,
four retaliations, no forced choices/denials/waits and one exact fire replay that
added no denominator or state mutation. The victim policy completed one pre-death
mystery start and one post-death retaliatory jump, retaining its account counters
across the actual generation 1-to-2 cursor transition. Its incomplete two-choice
block is reported as 1/2, not 70%.

The 4.75 logical hours executed 57 Director, four hourly, four season and 57 health
timer callbacks, preserving the original search and shot cooldowns. All 55 canonical
invariants passed across 252 boundaries; 2,896 exact resource checks passed across
338 observations. The 129 unsupported classifications (check-in/ammunition purchase,
jump transfers and market/death dispositions) retain their restricted diagnostics.
Full resource taxonomy, full-game selection, natural fixture acquisition, all
death branches, same-seed world replay and RC1 matrix qualification remain OPEN.

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
The third attempt at `57a1bfa5` completed the gameplay path but failed cleanup and
then independently failed the required history validator: GET identities included
absent `body`/`key` fields as JavaScript `undefined`, producing invalid JSONL. Its
immutable run file already records **FAIL**. An initial rejection sidecar incorrectly
described the stored status as provisional PASS; a retained correction sidecar
supersedes that wording. The harness now omits absent identity fields, tests their actual
canonical serialization, and parses the history before assigning a passing result.
The `6302816f` run passed the gameplay and history checks but failed owned-database
cleanup: closing Fastify did not close its PostgreSQL pool. The harness now closes
that exact owned pool explicitly before requesting the guarded database drop.
The failed run is retained; its post-process cleanup separately verifies ownership
and zero active sessions. The central evidence guard from `a0f37c74` is also applied
for subsequent runs so invalid JSON values fail before invoking an action.

The complete repaired execution at
`4489b023680f0be6eb9ca1999b83c6c2a5668d74` passed its scoped assertions, history/hash
validator and owned-database cleanup. Eight fresh selections produced four jumps
(one win, three losses including retaliation), three discovery starts and one heal.
The exact HTTP retry changed no full-state snapshot. Original hospital protection
expired after a declared 181-second real wait. All 55 invariants passed after each
of the eight mutations. Actual conflict share was 4/8; the actors had incomplete
mixed-choice blocks of five and two, so no exact 70% native-share claim is made.

Death, heirs, replacement, all other conflict authorities, full resource journals,
complete worker intervals, 90-day lifecycles, all 225 runs, whole-policy accounting
and production load remain open. Waiting for hospital protection is legal temporary
recovery, not a dead-world result.
# Bounded canonical death and heir extension

`test/rc1-aggression-heir.js --postgres` is a separate focused workload, requiring a fresh `RC1_HEIR_OUTPUT` directory and explicit loopback `COORDINATION_TEST_DATABASE_URL`. Standard jump cannot kill: `src/social/combat.js` clamps losing health to at least one. The lethal authority is ordinary authenticated `POST /v1/streets/:id/search`, followed by `/fire` once the own-character `hunt.placedSeconds` reaches zero. Fire calls canonical `runEstate`; the harness never sets alive, deadlines or outcome status.

Declared initial fixtures are two existing player identities with default numeric birth resources/stats, shooter level 250 and one valid owned Rusty .25, and victim level 10. Earned history for fixture respect and weapon is **not claimed**. Canonical check-ins fund 40 original $2,000/50-round ammo purchases and the victim's $2,000 four-hour market order. No synthetic cash/ammo ledger credits are inserted. The actor uses only own authenticated views and the public streets projection; hidden database observations are evidence inputs only.

The existing shared application/SQL logical clock seam advances through the original three-hour search while executing every due original local worker callback. No timer is shortened, and no literal three-hour wall-time claim is made. Population spawning is disabled; unavailable external integrations remain excluded. One early `searching` denial retains resources. A fixed 2,000-round shot must canonically kill, destroy/loot the actual order escrow, create the same-account/name generation 2 heir, account for the legacy stake and allow that heir to check in and complete an ordinary crime. Exact retry must reproduce the fire response without another death or canonical state change. Full snapshots, all 55 canonical invariants, current resource parity equations, RNG tape and worker trace are retained; unsupported resource reason/ownership classifications stay explicit.

This focused search/fire exercise does not extend `createAggressionPolicy`'s implemented selection scope or claim a 70% lethal-choice quota. Other death/ownership branches, naturally earned fixture progression, full resource lineage, full replay, 90-day/matrix and production qualification remain OPEN. Earlier source 4489 native aggression evidence and every failed attempt remain frozen at their original revisions.

The first native exercise passed at source `59884376867efae5f1e61979fb68dd05c97cf150`, 2026-09-21 06:42:24.292–06:42:56.434 UTC, PostgreSQL 18.4 / Node 24.19.0 / Windows. Restricted directory: `C:/Users/Jorge/.codex/rc1-readiness-private-20260921/aggression-heir-59884376-native`. All 148 indexed artifacts and 387 hash-chained history rows validated; the committed source stayed clean and unchanged through sealing, and owned-database cleanup succeeded. Configuration SHA-256: `1c6d0698b0bf025fc18968cdfd63e11bf5c34688c464d6472830368d40304f89`. Run SHA-256: `caeda1acdcb100d9b749919c59fa04fe3ef4e11afe264252d0ccd9514de9c203`.

Observed: original 10,800,000 ms search; 36 Director, three hourly, three season and 36 health-boundary timer callbacks; 55 canonical invariants across 131 boundaries; 1,117 exact resource checks across 137 observations. The canonical kill looted $495 pocket cash and $500 order escrow, burned the remaining $1,485 pocket cash and $1,500 escrow, and burned 25 victim rounds. The old character remained as a dead zero-resource row; its order was removed by the estate. The same-account/name generation 2 heir received canonical base cash $500 plus ledgered legacy $500, retained account prestige 5/deaths 1, and began with 25 rounds. Exact fire retry changed no canonical state. The heir checked in and successfully pickpocketed for $52 and two respect.

Resource parity passed while 52 unsupported classifications remained explicit: three check-in receipts, 40 cash ammo-purchase receipts, order/list/death/loot receipts and two market-listing changes. Their restricted before/after rows and receipts are retained. This is `PASS_SCOPED` with incomplete resource taxonomy, not a full-resource or RC1 matrix pass.
