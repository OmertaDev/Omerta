# Equipment rental integration proposal review

This is a reviewable patch, not an integrated release. Frozen base:
`94ae773af3d1d36024b953ba7a05f916940aa768`. Reviewed proposed source:
`fbb4430b8bfdd01528e20e63fd32f1a729832767` (implementation parent
`a7249ca7b052506691f1bc6b3f2f3358ed4d68e7`). The required integration design is
`134fe560a71c69f7e4a016cf11127dec25f67a19:docs/equipment-rentals-integration-design.md`.
Only the isolated proposal checkout was changed. Financial activation and external
transactions remain off; all monetary proofs concern fixture game cash.

## Scope and authority

Nine proposed runtime files: equipmentrentals, itemdurability, items, mysteries,
game, social/estate, social/combat, routes/modtools and agentgateway. The patch
also adds `test/equipmentrentals-integration.js` and updates the existing rental
leaf fixture to pass the explicit death prelock scope. No schema, server,
worker, package, CI, catalog or coordinator checkout changes are included.

Borrowing applies only to the authored Belladonna version 1 precision-tool lock
node. An original borrower must have a live paid lease, both original actors must
be alive, and their accounts must be active. The acceptance receipt binds exact
rent debit/credit and deposit debit journal IDs, immutable acceptance mutation
result, original characters/accounts, offer terms, deadline and original item
escrow event. Older receipts without these IDs remain returnable/recoverable but
cannot authorize this new borrowed-use path. Character-only canonical cash
journals legitimately have null account_id; their original account is verified
through the exact original character row instead of assuming an account journal.

The private Items token authorizes only the exact lease and Mystery operation
IDs. The same physical UID relays lease→Mystery, records one verified F05 use,
and immediately relays Mystery→lease before saving the node result. This does
not grant generic consumption, trading, ownership or other Mystery use. Birth
certificates still require the actual manufacturing witness: standard100 and
tempered150, with ten condition consumed per actual completion. Owned usable
tools retain priority; an unusable owned tool may use an available paid rental.
Ordinary owned boards omit the new optional field. A closed optional
`borrowedEquipment` read DTO reports the original landlord title and factual
condition/deadline, and rejects extra fields or invented maxima.

## Estate caller and lock inventory

| Actual caller | Transaction path | Evidence |
| --- | --- | --- |
| social/combat.fire | G.withTwoCharacters→Items-owned transaction | Actual registered fire, kill, loot, refund and replay |
| social/combat.npcHit | Same G pair wrapper | Direct source trace; its lethal branch was not separately executed |
| pen.execute | Same G pair wrapper | Direct source trace; its lethal branch was not separately executed |
| routes/modtools `/v1/mod/kill` | Items-owned transaction | Actual registered borrower death, deposit burn and heir |
| social/combat.huntWanted | Items-owned per-mark transaction | Direct source trace; hunter lethal branch was not separately executed |

Each death-capable boundary discovers at most three live rental counterpart
leases per original subject before actor locks, locks the sorted actor union,
then sorted accounts, and rechecks discovery. The private prelock scope is bound
to an opaque identity of this particular Items transaction, not merely a reused
client. A new counterpart causes contention and poisons the whole transaction;
recovery never acquires an actor lock late. The existing G callback still receives
only its original two actors. Every actual runEstate call is now branded and
requires this scope. Rental recovery runs after SQL alive=false and before heir
insertion. A surviving original borrower receives the canonical refund; a dead
borrower's held deposit burns. Only the verified refund delta is merged into the
actual G actor/killer object, preserving its previously accumulated loot. A
verified held Belladonna custody can be relayed back for release-only recovery.

## Executed proofs

At the reviewed source, five distinct fresh owned PostgreSQL18.4 databases on
127.0.0.1:35449/pilot_runner passed: rental core, actual rental API, ordinary
durability, manufactured quality, and the new registered integration test.
Every harness rejects ambient DATABASE_URL, checks its closed owned prefix,
loopback role/password profile, version and empty public tables before schema
initialization. The integration database was
`equipment_rental_integration_test_2b712a08279f`; exact regression database names
and version witnesses are retained in the durable manifest. No PG16 execution is
claimed.

The new native proof executed real paid leases, actual authored standard/tempered
crafts, registered Mystery completion and cancellation, exact replay, foreign
privacy and source/body forgery refusals. Two different concurrent completion
keys caused only one wear and one relay pair. A physical item lock wait crossed
the lease deadline and refused use. A database fault at node result save, after
wear and relay back, rolled back custody, events and condition use. Forged and
cross-transaction prelock scopes refused; a caught newly introduced counterpart
aborted the whole native transaction and restored its source row. This last
control is a deliberate fixture source mutation, not a separately executed
funding-versus-death race.

Actual mod death burned the original borrower's deposit and returned the tool
to original landlord account custody. Actual registered fire killed the landlord;
the killer's persisted cash equaled prefire cash plus canonical loot plus the
250 refund, and replay paid neither again. Ammo came from 100 actual registered
armory purchases funded by explicitly declared fixture game cash, not an invented
ammo journal. Independent canonical books passed all89 checks before and after
estate. Memory integration, rental core/API, ordinary durability and quality
passed; the unchanged worldgraph API suite also passed its ordinary owned path
and typed projections. Memory is not evidence of PostgreSQL rollback or locking.

## Review method and retained findings

Applied the policy's pinned Pashov c577eb7 access/replay/periphery adversarial
passes, Plamen 795962b state/accounting/callback traces, and Trail of Bits d3323ce
trust-boundary/specification/invariant/static triage methods as manual JavaScript
adaptations. No upstream scanner/orchestration or whole-repository audit is
claimed. Focused SQL scanner comparison and syntax/diff checks are retained.

Retained failures/retests: the first native test treated PostgreSQL's numeric
amount string as a number; the assertion now converts exactly with Number.
Existing WorldGraph closed-schema validation initially rejected borrowedEquipment;
the ordinary field is now omitted and the optional new schema is closed.
An initial ammo fixture emitted an unknown vocabulary reason; it was replaced
with actual canonical armory purchases and all vocabulary checks remain intact.
Initial wrong cancellation fixture bodies were corrected to the actual required
instanceId contract. All raw fixture logs remain retained, including deliberate
native late-fault output; no assertion, cap or lock rule was waived.

## Coordinator review and remaining qualification

Apply/review the exact base→proposal patch in the coordinator's current source,
preserving F09's extra estate import and `voidServiceSubscriptionsAtDeath` hook
between SQL death and heir. If F09 recovery requires more character counterpart
locks, compose their finite discovery before actors; this proposal does not
modify F09. The coordinator confirmed F09 touches only the already locked dead
payer/metadata and a null-character sink, so it needs no additional living
counterpart here. Preserve root recovery dependency
`859a590c3bead7a5cd223a2bacaccd5ba63d6b12` and root `40479023` real F07
repairAvailable:true projections in durability and the first-five DTO. Apply
the diff/commits rather than replacing current files with baseline copies.
Reconcile the optional gateway DTO and mandatory test wiring,
source-transfer pins, catalog and whole integrated gates/SQL qualification under
coordinator ownership. Retest current-source estate hooks and all affected
components after composition. Pen/NPC/hunter lethal execution, a real queued
funding-versus-death race, and held-Mystery recovery are source-traced boundaries
without dedicated new native positive runs here. This component proposal grants
no historical private-world soak, full-release clearance or production activation.
