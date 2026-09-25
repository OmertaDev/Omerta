# World runner car COMMIT witness

The resource-observed native world runner now uses the existing source-pinned car collector. With `--observe-resources` absent, no collector is created. The worker seam and query-tape wrapper order are unchanged: query-order handling stays outside the native query/COMMIT observer, which captures original executed SQL and returned rows before gameplay can mutate them.

Every committed transaction produces a bounded in-memory witness. The runner retains complete restricted witnesses for actual car DELETEs, original melt ledger insert candidates, and collector overflow/failure markers. It supplies those witnesses to the existing shared reconciliation API. Noncandidate commits keep ordinary resource evidence. The witness artifact name and canonical SHA-256 enter the resource journal, so existing replay comparison of the full resource stream also covers retained provenance. Collector/candidate/exact/unsupported counts receive an additional exact replay comparison. No request label or actor claim selects an exact lineage result.

Original uninstrumented car classification remains unknown. The narrow exact classifier still accepts only the previously proven neutral, solo human melt branch; NPC/Family/limited/multiple-car/modified-yield/compound cases stay explicitly unsupported. This change adds no game action, policy choice, setup grant, runtime patch, timer change or budget increase.

`node test/rc1-world-car-melt-witness.js` executes the exact hash-bound runner observer block with a synthetic driver. It covers disabled observation, actual native parameter forwarding, restricted retention and stream binding, deterministic replay, changed native identity rejection through digest mismatch, ordinary noncandidate behavior, full failure-witness retention, overflow, and unchanged wrapper order. These are integration controls, not gameplay proof. Existing `test/rc1-car-melt-provenance.js` and `test/rc1-car-journal.js` retain corruption checks and no-provenance unknown controls; the earlier focused native component proves real melt behavior.

The fresh world observation/replay uses the existing quiet policy, 25 declared actors and two logical hours with every original due local worker callback. Quiet scheduling exercises only its declared active subset; this is not a 25-active-actor or alliance claim. An absence of melt is a coverage limit, never replaced with a fabricated action. Full resources, 90-day matrix, deployment and production remain unqualified.

## Frozen native pair

Source `d33b4606b395208c25d7e846417028c5b7166725` (base `1404b48c30b41ca66b757eb2c2b39fc6e2750553`) passed both observation and recorded replay on local PostgreSQL 18 / Node 24.19.0. Both launchers exited 0; independent verification reread every artifact and every decoded history event. All 18 existing replay fields and the additional exact car-witness summary matched, with no canonical state exclusions. The guide-only result commit does not relabel that frozen source.

Each run retained 65 indexed artifacts, 1,290 chained events and 1,085 resource boundaries. The collector observed 295 actual committed transactions, with **zero car-deletion/melt candidates, zero exact melts and zero collector overflow markers**. This pair verifies integration and noninterference with the existing workload; real melt branch coverage remains the earlier focused native proof. No extra actor actions or grants were added to force coverage.

Each run completed two quiet actor sessions out of the 25-actor declared cohort, eight fresh PlayerCommands and two successful canonical crimes. All original due callbacks ran: 24 Director, two hourly, two season and 24 health boundaries; every cohort actor crossed one canonical rollover. Twelve explicit invariant boundaries passed 660 checks, with the initial 55-check baseline also passing. Both owned databases closed successfully. Measured native run durations were 39.604 seconds and 39.423 seconds, including instrumentation; these are not deployment latency claims.

The 45 remaining resource-unknown occurrences in each run are retained: six car acquisition identity, two NPC Family formation, two receipt reasons, two Family lineage and 33 observed table changes. They are not waived by successful replay. The unchanged limits were 1,200,000 ms wall, 512 MiB output/decoded history, 128 MiB stored history, 8 MiB line, 64 pending records/outstanding invocations, and 2 GiB minimum free space.

| Verified identity | SHA-256 |
| --- | --- |
| Full final canonical state, 369 tables / three sequences, both runs | `a913b658b9396dc29a330b43cc9e84d07d28ea4cd12895992b66900c117f1628` |
| Complete resource journal stream, both runs | `985862662d46e39d12865cdb8315e2101df347da909fbfb63154685378bc25ab` |
| Observation run manifest | `f610f310f803bbb572ccc18acae783b27f59a891d8a8ed90d71a6b11a9c007a6` |
| Replay run manifest | `523a1a7fa21577b4addfdd2b9dd5705f429fb299bfb4223938b1a59a24a13e3c` |
| Observation stored history, 4,074,672 bytes | `ed93d4d636a57918ed9165ad0b406a45fe91382a7e20faaa2a28e1f924804c61` |
| Replay stored history, 4,075,036 bytes | `22e68f6100ff1ea2f3407d589941485c37527a1afd9b1469455991357181b6f3` |
| Observation decoded history, 51,113,261 bytes | `d53c61c9391b7d144f095dfb140e0ec1a32fba74326e8b44fe07b102efcb4f21` |
| Replay decoded history, 51,114,410 bytes | `3d6b5de89392a9b02824522635fd03a4e25f9cc89018457fa51fd28680ee8ae3` |
| Independent verification report | `317d9376d1acb95d84cfec04abd19e4abeee4220a1997634cf71853338d2b8bd` |

Restricted evidence directories are `car-world-d33b4606-observe`, `car-world-d33b4606-replay`, and `car-world-d33b4606-audit` under the existing private readiness directory. No development or native failures occurred in this integration task. Prior TOOL49/50 component failures remain unchanged in their original custody.
