# Bounded resource pressure policies

Owner: Codex/native_harness. Scope: observer and test-only policy components, not a completed scarcity/abundance scenario or matrix cell.

`createResourcePressurePolicy({scenario,accountId,seed})` accepts only the actor's authenticated session/me and public rules/exchange. `choose(view,{logicalAt,phase})` returns an ordinary HTTP request or an explicitly scoped wait. Phases are checkin, replenish-ammo, list, take, cancel, hoard and progress. Save `checkpoint()` before dispatch; restoration preserves the request identity. `settle()` counts only fresh completed actions; known exact replay adds no action, conflicting replay fails, and an unknown completed replay blocks further choices. Public observations may become stale and canonical authority rechecks admission. Database snapshots never feed the actor policy.

## Frozen initialization

Each probe has three ordinary guest/character entrants. Scarcity is an **ordinary-entry proxy**: $500 cash, 25 ammo, zero bank, contraband, OMR and respect, with no granted items. This is not the lowest reachable resource vector across all thirteen resources. The level-one first check-in pays $350 through the canonical route.

Abundance starts with the same entry vector. Before measurement only, respect is set to `PACING.LEVEL_DIVISOR * (75-1)^2`; level75 progression is fixture-assisted, not earned. The actual first check-in pays $26,250, giving $26,750 cash. Three real armory purchases per actor each consume $2,000 and provide 50 rounds. No cash/ammo/OMR grants, invented receipts or SQL resource burns initialize either probe. There is no asserted finite global inventory maximum.

Source rules: character defaults in `src/db.js`; check-in quotation/payment in `src/game.js`; `buyAmmo` in `src/economy.js` ($2,000 for50); player escrow in `src/social/exchange.js`. Armory ammo has no shared stock. Contention uses actual finite player lots of25 rounds at $20 each. Both buyers observe one live lot before serial execution; the stale buyer's `gone` refusal is tested. This is stale-choice contention, not a concurrent transaction schedule.

Scarcity consumes scarce cash and ammo into escrow, rejects unaffordable purchases, returns cancelled escrow and earns replenishment cash via check-in and canonical quiet pickpocket outcomes before buying ammo. A maximum40 crime attempts and original nerve regeneration bound the recovery. Abundance repeatedly converts cash to ammo, moves ammo to one buyer through real taxed sales and banks remaining cash. Concentration includes seller-owned escrow, retains exact per-owner amounts and totals, and reports diagnostic top-share/Gini for the finite cohort. Neither unchanged aggregates nor banking are called a resource sink; sale fee/tax destinations are checked separately.

## Resource and replay scope

`reconcilePressureResources` checks each stable cohort character's cash+bank, ammo and contraband against immutable exact ledger deltas. It additionally binds every ammo listing/return/purchase to exact actor, listing, quantity, price and response identities. Purchase requires exactly one buyer and seller cash receipt with reciprocal counterparties, exact seller net, street-tax transfer and remaining cash sink. Duplicate receipts, rewritten escrow, foreign-owner transfers and unbound mutations fail. Total ammo includes live escrow. It never fabricates a grant for an unexplained difference.

The unchanged shared world observer currently lacks personal ammo/escrow transfer attribution and rejects those valid boundaries. Each rejection and its full before/after snapshot is retained as `UNSUPPORTED_ESCROW_BOUNDARY`; the shared observer did **not** pass those boundaries. The focused journal supplies only its declared equations. Other shared-observer unknown receipt/car/Family/season lineages stay explicit. Observation occurs at HTTP and original worker callback boundaries, not every commit, and makes no full thirteen-resource claim.

All original due worker callbacks run for at least15 logical minutes, with shared app/SQL clocks and pinned original source transformation. Population spawning and external liquidity are disabled; unavailable RWA health is declared. No timer/deadline is shortened. Native all55 invariants run at ordinary mutations and worker boundaries. Exact buy/cancel retries compare the complete canonical database state. Counterfactual corruptions of retained native boundaries and an actual terminal committed balanced wrong-owner ammo transfer must fail the owner journal. Terminal corruption is retained, never repaired or followed by gameplay; the owned database is then cleaned up.

Guardrails: 15-minute wall limit,60-minute logical maximum and40 crime attempts fail/incomplete instead of skipping work. Every native run requires a clean committed source, fresh restricted output and uniquely owned PostgreSQL database. Failures remain source-bound.

```powershell
$env:PATH='C:/Program Files/PostgreSQL/18/bin;'+$env:PATH
$env:COORDINATION_TEST_DATABASE_URL='postgres://postgres@127.0.0.1:55441/rc1_native_harness'
$env:RC1_PRESSURE_OUTPUT='<fresh restricted directory>'
node test/rc1-native-resource-pressure.js --postgres --scenario=resource_scarcity
# Use another fresh output for --scenario=resource_abundance.
```
