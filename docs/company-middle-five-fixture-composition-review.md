# Current F11–F15 fixture composition proposal

Scope: test fixtures only, on integration proposal `8e5d712b1988e25c50a1bd5ce78fc6aaac47b7ff`. Source repair `105aa66b925d463912845228ac7b846568bd4d0e`; trusted expiry scope refinement `a64b1266d9105f464d520a78357416838dda01bd`. No runtime, schema, package, CI, catalog, census, or release changes. Original component commits and failed pre-composition logs remain intact.

## Composition

All six runners instantiate the real `buildServer` and use its registered authenticated APIs. Removed manual route registration, the linked-training proof dispatcher, and the Proxy-on-BEGIN Crew pool. Low-level positive calls use actual exported Crew/acquisition trusted scope helpers. A fixture schema helper executes exported component DDL only when none of its declared tables exist, rejects partial presence, and avoids duplicate DDL when the actual server already owns the complete component schema.

Meaningful existing assertions remain: canonical stat/energy/cooldown/wage, bounded funding, request identity/replay, private boards, current roster/revision/policy, both-party original consent, profit budgets, exact transfer legs/title/assets/history, foreign/source/schema/false receipt refusals, recovery/estate, lock waits, rollback and concurrency. Independent global accounting now requires every check to pass; the old acquisition vocabulary-pending allowance was removed because integration registers those exact reasons.

Three intended integration transitions are explicit. The real server reports request conflicts as 422 rather than the component handler's 400; refusal remains required. Raw non-transaction Crew guard calls reject `item_transaction_required`, with an additional real transaction lacking Crew proof required to reject `locked_crew_required`. Integrated estate already burns the employer escrow: the fixture asserts the original canonical 200 burn and that a second hook burns zero. No effect assertion is skipped.

The old HTTP-unavailable acquisition assertion is superseded by actual registered capability. Direct no-capability service quote/execute still must fail closed without mutation; real HTTP must produce an eligible canonical quote and refuse a synthetic source. Every arbitrary/false receipt negative remains. Synthetic capability metadata tests are lifecycle controls only; `depotacquisitionruntime.js` separately proves genuine payments/title and nonzero physical GIN stock/treasury preservation.

## Proof and review boundaries

All six corrected memory runners passed. Memory ROLLBACK is not native atomicity evidence. Five fresh distinct approved PostgreSQL 18.4 databases passed source `105aa66b`: worker training, employment organization, partnerships, governance, and synthetic acquisition controls. The sixth actual transfer runner uses the exact dedicated endpoint/prefix and trusted expiry scope at `a64b1266`; it passed on fresh depot_acquisition_runtime_test_89745ef81887, recorded in the durable native manifest.

Retained causal failures include duplicate component DDL, pg-mem's information_schema.tables/ANY lookup mismatch (replaced by the existing supported columns catalog), raw-transaction guard error, real request-conflict status, automatic estate burn, enabled HTTP capability, and an ignored runner's incorrect sixth environment variable. No guard endpoint/version/cap, runtime authority, assertion quota, or monetary check was weakened.

Review follows the repository policy with source/caller, adversarial lifecycle, and independent accounting passes. Actual native rollback, same-key/competing consent, Crew-kick wait, source drift, sixty-second expiry after lock wait, owner rights, assets and global books are bounded fixture evidence. Hosted PostgreSQL 16, mandatory coordinator wiring, native migrations/catalogs, source-transfer guards and full release gates remain separate obligations. No historical native proof, world soak, or financial activation clearance transfers to this patch.
