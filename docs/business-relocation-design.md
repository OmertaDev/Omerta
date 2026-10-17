# Business relocation: bounded integration contract

Source: 95a68272445eb8164664a172690d81b7288731de. Proposal phase only.

Supported effect: relocate one existing owner-operated open GIN Depot, preserving
its ID, original current owner, treasury, configuration, all history and authority
records. Existing opening admission charges $5,000 and creates capacity40 at the
owner's current district; it does not grant or require a commercial lease. This
proposal does not transfer rented premises, landlord title, or occupied capacity.

Canonical witnesses: src/depot.js openDepot/own/atDock/withdrawDepotStock;
src/game.js travel; src/depotbook.js bookDepot; src/routes/depot.js controlled;
src/depotacquisitionruntime.js closed reference inventory and obligation checks.
The acquisition eligibility helper is NOT reusable directly: it requires a
separate buyer/seller and would change title. No new ownership transfer is needed.

## Exact action

One server-recorded plan per current original owner, source-bound to a complete
locked Depot snapshot, exact origin/destination, quantity/cost, actual cargo map,
current canonical authority/profile snapshots and reviewed reference inventory.
Finite server clock TTL60..600, no client timestamps. One exact original-account
request key/body per create/execute/cancel; historical replay precedes fresh-life
eligibility and grants no heir operating rights. Destination must be an authored
DISTRICTS ID distinct from origin. Existing delegated-control guard applies;
there is no new production/restock/configuration or spending permission.

The same branded Items/G action performs:
1. Full closed-schema and obligation admission under actor/account/Depot locks.
2. At origin, canonical withdrawDepotStock for ALL settled stock (or no withdrawal
   for an empty business), only if all cargo plus that quantity fits real trunkCap.
3. Actual G.travel to destination, charging its actual normal fare and preserving
   normal jailed/cash/location eligibility. No clock override or invented trip.
4. A NEW private canonical return leaf consumes ONLY the exact same-transaction
   withdrawal witness: Depot ID, original owner/account, actual withdrawal journal
   ID, quantity, original cost, pre-existing cargo map, destination and plan.
   It removes only those just-withdrawn GIN units from actual cargo, restores the
   same stock/cost through bookDepot linked to that journal, and updates ONLY the
   same Depot district. This is not a generic deposit or request-key capability.
5. Final source/clock/authority/asset checks before G persistence/Items commit.

No canonical return or district-transfer leaf exists in the pinned source. Fresh
execution MUST therefore remain unavailable until root implements and reviews
this exact leaf. A metadata district change is not completion.

## Refusals and preservation

Refuse any unsettled listing/delivery/finance, reserved warehouse stock, active
premises/warehouse rights, workforce/training commitments, pending commission or
production reservation, concession/collateral, active acquisition/restructure or
other third-party obligation. Unknown schema references refuse even when empty.
Historical records stay unchanged. Enabled district-sensitive profile/policy or
other authority must refuse rather than silently rebind its permission; no
spent/cadence reset. Future explicit archival support is outside this slice.
Full target inventory must enumerate current next30 references as well as F15's
older closed reference inventory. Do not import the older registry wholesale.

Planning locks no third party and moves no cash/items; owner death may retire
its ready plan as metadata only. Execution is a single native transaction: death,
source drift, trunk failure, post-wait expiry, insufficient fare, duplicate
execution and late faults cannot leave transit inventory or new title behind.
No death counterpart expansion, escrow, new value bucket or heir authority.

## Required qualification before integration

Actual normal G scope and canonical helper invocation; private source witness
cannot be called through direct return, generic deposit or forged callback.
Fresh native fixture must prove nonzero legitimately funded stock/cost, ordinary
cargo preservation, actual travel fare, SAME ID/treasury/config/history, paired
withdraw/return journal conservation, purchase rights only at new district,
exact replay/one-winner concurrent execution, owner death/stale plan refusal,
unknown-reference and each obligation refusal, and late-fault all-public-row plus
explicit allocator comparison. Memory mutation stays closed until every touched
legacy canonical path has genuine rollback support. No native proof or release
clearance is claimed by this design. No PG lease is currently held.

## Component interface checkpoint

`src/businessrelocation.js` owns closed request normalization, exact original-account
key/body replay, one ready plan/account and Depot, finite server-assigned TTL,
private bounded board and completed receipt persistence. Fresh mutations call ONLY
`Depot.canonicalDepotRelocationRuntime` from the trusted canonical module, never a
caller-supplied adapter. That export is absent on this source: fresh create/execute/
cancel therefore refuse before metadata mutation. `inspect` must take Depot locks
before plan locks and perform exact current-source/obligation admission; `execute`
must perform the canonical action above. `assertScope` must require actual G action
identity, and its root wrapper must retain final post-receipt validation through G
persistence. Merely adding a kind marker does not implement these requirements.

Cancellation must allow original-owner metadata retirement despite source drift;
its `inspect` purpose is `cancel`, never a stock/cash release. A create may retire
only this account's actually expired metadata plans without extending their TTL.
Estate retirement is metadata only, in the actual private estate scope. No funds
or custody are reserved by a ready plan. The proposed two tables have no new money
bucket and delayed request FKs avoid reservation-before-actor parent locks.

Focused schema text mapping identifies 41 direct reference candidates at the base,
including commissioned_crafting_contracts, production_slot_reservations,
picking_packing_jobs and customer_vault_services absent from the older acquisition
registry. Native information_schema equality and indirect source relations still
must be checked before a closed reference inventory is authoritative. The text map
is retained as investigation evidence, not a dynamic runtime whitelist.

Executed memory boundary test: `node test/businessrelocation.js` PASS. It exercises
closed terms/unknown actions, private empty history, actual branded missing-leaf
refusal with unchanged requests/plans/transactions, and exact pending replay
refusal. Its administrative pending-request fixture is NOT positive gameplay or
funding evidence. No canonical relocation, stock transfer, rollback, estate,
concurrency or native success is claimed yet. Positive proof requires the actual
root leaf in a frozen off-repository prototype and a separately approved lease.

The public `runBusinessRelocation(pool, accountId, action, body, key, {agent})`
now enters real `G.withCharacter` itself; no caller can supply a character, h,
ledger, cargo object or arbitrary gameplay callback. Its root `withScope` must
compose the existing finite rental/consignment/barter/commission/picking/layaway/
vault/courier/return preactor union and check it again on exit, without changing
its generic subject bound. `quoteBusinessRelocation` uses the same real G wrapper
and returns only source hash and public terms, not full internal source rows.
The root runtime scope remains absent, so neither function grants a new action.

An initial composed-read assertion expected the raw pending message. Existing
Items/Phase2 read composition intentionally sanitizes that message. The retained
failed log was corrected to assert its dedicated error code, without changing
read sanitization or any gameplay assertion. The affected memory test passed.

N12 preparation update (2026-10-15): the OFF-REPO proposal uses a fixed private canonical withdrawal-journal witness rather than a bounded historical scan. Royalty source_journal_id remains NULL. The closed42-reference classification preserves terminal history and unaccepted target-only commission requests; actual consented/funded obligations and unknown references refuse. No relocation epoch or N03 source rewrite is proposed. Retained F03 profile/cadence/source rights must remain byte-equivalent through relocation. Existing authored Foundry recipe location still applies independently. Positive old-funded commission completion after ordinary return travel, exact native rollback, public estate and paid relocation remain UNEXECUTED. New native admission includes exact numeric49 employment datadir separately from exact39; no backend was contacted and a coordinator lease remains required. Gateway/closed OpenAPI integration and final current-root composition remain pending.

Latest actual-server memory smoke on frozen834-file prototype passed normal human/agent authentication, private empty board and unavailable native mutation. Initial synchronous Fastify noQuery prehandler left injection unsettled; changing the owned prehandler to async resolved it. Failure retained. This does not establish positive relocation, rollback, source expiry, accounting, estate or native behavior. The prepared native fixture has not executed.
