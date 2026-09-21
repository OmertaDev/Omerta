# Bounded native car journal

Owner: Codex/native_harness. Base: `b0c85c11dd636b04d92f8f017ca31982b9c63999`. Observer and test changes only; no production car rules or receipts are changed.

The journal observes one isolated, completed serial boundary. The existing commit observer rejects overlapping native activity. It retains every car field and immutable receipt and never treats a count-preserving owner change as a known transfer.

Exact supported cases:

- Basic graph salvage: a newly completed version-one `salvage_car` guard binds the exact car ID and normalized basic recipe in its request digest. The result binds the prior owner account, car ID/model/trim/damage and one consumed car. Three output events and result entries must match the authored scrap, wire and salvage-parts quantities and the same account. Reserved cars, duplicated receipts, wrong inputs or outputs fail. Other recipes and guard versions remain unsupported.
- Market listing custody: a new `car_id`-bound live listing changes only that seller's exact car `listed` flag to true. Cancellation without a standing bid changes only that same flag to false, retaining ownership and all other fields. Listing identity cannot be rewritten. This classifies the car custody transition, not listing fees, bids, sale settlement or auction timing.

Partial checks remain explicitly incomplete:

- Ordinary boost and resident grants: new success/grant audit cardinality must equal new cars for the same owner. Rarity audit cardinality, roll/outcome and observed rarity multiset must agree. Default custody fields are checked. The audit omits the car ID and selected model/trim/damage and limited-run assignment, so `car-acquisition-identity-provenance` remains unsupported.
- Melt and resident retirement: each personal melt ammo receipt or resident retirement audit consumes one observed car for that owner. Retirement requires the NPC owner to become inactive. Receipts are one-use. These receipts lack car identity, and melt does not retain all skill/ladder/tithe inputs; `car-sink-identity-yield-provenance` remains unsupported even when count parity passes.
- Theft, pink-slip races, sales, collateral transfers, extraction/import, heir transfers, repairs and other modifications remain unclassified. Unexplained creation is never labeled a grant.

Native quiet-run evidence motivating the worker branch is retained at `C:/Users/Jorge/.codex/rc1-native-evidence/mystery-high-world-2h-1`, source `ced267a7fefa410d3c849e3085dd490cd8cc5102`. Its six car changes each added one exact raw car row plus same-owner `npc:car/grant` and `rarity:car` audits. Those historical observations are not relabeled as complete car identity proofs or as results on this source.

Commands:

```text
node test/rc1-car-journal.js
node test/rc1-world-resource-observer.js
node test/rc1-car-journal-postgres.js --postgres --output=<fresh restricted directory>
node test/rc1-native-world-workload.js --postgres --hours=2 --population=25 --seed=rc1-alpha --policy=quiet_world --observe-resources --output=<fresh observation directory>
node test/rc1-native-world-workload.js --postgres --hours=2 --population=25 --seed=rc1-alpha --policy=quiet_world --observe-resources --replay=<observation directory> --output=<fresh replay directory>
```

Native commands require `COORDINATION_TEST_DATABASE_URL` for exclusively owned disposable loopback databases. The focused component has explicit initial fixtures, canonical salvage/replay, listing/cancellation, melt, ordinary boost, resident birth/retirement, counterfactual mutations of retained native boundaries, and a terminal actual PostgreSQL trigger that corrupts an otherwise canonical listing commit. That corrupt state is retained and rejected, never repaired into the positive trajectory. A separate short original-worker pair retains complete state and mandatory resource-stream equality. These scoped checks do not close all 13 resources, runtime load, the 225-cell matrix or a long campaign.
