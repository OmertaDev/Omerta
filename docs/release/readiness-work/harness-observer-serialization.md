# Resource evidence serialization: bounded changes

Owner: Codex/native_harness. Base source: `6368339e82965679c1d1aae91ecea657489a6414`. This changes only two local evidence calculations; no SQL, read set, observer classification, authority, normalization or configured limit changes.

The source-pinned baseline was one two-hour quiet25 resource-enabled gzip observation at `da72d58e2f83bfa42a2ffce35a3fa444e24565a1`. It retained 1,085 boundaries and 139,788 zero-drift equations, with 39 unsupported entries. The Node CPU profile attributed 2,055.946ms to snapshot row-sort serialization and 1,525.045ms to canonical journal digest/byte-count serialization. These are sampled elapsed costs, not exact CPU or PostgreSQL execution times. Profiling overhead and concurrent local work apply. The newer base has a 57-table observer; the baseline had 56 tables, so whole-run performance comparisons are not controlled A/B results.

Baseline retention under `C:/Users/Jorge/.codex/rc1-readiness-private-20260921/world-cpu-da72d58e-1`:

| Artifact | SHA256 |
| --- | --- |
| `world.cpuprofile` | `524c61ecfe6a5a3bc522dc7609e77c3452d8df1c80a08fa6093bd682edb1f28b` |
| `report.md` | `1ddec25bc2d9b397f388fce4da9a4a33cdb72e2f55445daa4f45ee70e0737717` |
| `index.json` | `45f74ccce807556a6783d2ff6a03b662c6cc84d06e3e516b8de986208f04959e` |
| `world/run.json` | `a85d8d919a6d3068d4f3d20cffa079cf17a5a3226519ba243b0e71908f2853ad` |

The snapshot helper computes one JSON sort key per already normalized plain row. It retains the exact existing `localeCompare` ordering, stable ties, duplicate multiplicity, row identities, in-place array result and all serialized values. Keys live only within that call; no cross-snapshot or mutable-state cache exists. The world callback computes one canonical `{event,journal}` string after the existing history acknowledgement and reuses it for its existing newline-terminated digest and byte count. The separately enveloped history record and its hash remain unchanged.

`node test/rc1-observer-serialization.js` compares the actual extracted helper/callback code with the original two functions. Controls cover numeric text beyond safe integers, sub-cent decimals, Date roundtrip, equal JSON rows, distinct-byte locale ties, reversed/rotated input, unchanged object and array identity, changes between calls, malformed JSON, and every real snapshot result/field assertion through a transport fixture. The fixture does not constitute native proof. Existing corruption and capture-failure suites remain required.

Add `--retained=<private-world-directory>` to verify all indexed artifacts and the full logical hash/invocation chain, then compare both calculations over every archived resource journal and retained native before/after row set. No archived run is relabelled. The follow-up native check is a new clean-source two-hour25-actor quiet observation plus fresh recorded replay, gzip and all per-commit resource checks enabled, with the original 20-minute/512MiB workload guardrails and history bounds. Full state, all18 actor comparison fields, complete resource stream, artifact hashes and owned-database cleanup must agree. No performance projection, full-resource pass, seasonal coverage upgrade or matrix credit follows from these changes.

## Source-bound results

Implementation commit: `74b2918023d14f442138b3cf982943647b675e99`. Its original world attempt reproduced TOOL46, an ordinary-player Family classifier applied to original NPC formation, then TOOL47, a City lock-client release gap exposed by the retained observer error. Both are independently diagnosed; neither was a sorting mismatch. Exact old/new sorting of all 114 table rowsets in the first failing before/after snapshots produced identical row and state bytes. The initial 74 attempt ended at its declared 25-minute watchdog (1,500,031.5809ms) with SIGTERM and no sealed manifest; no dependent replay was launched.

The original failed prefix independently passes gzip integrity, all 364 event hashes/chain links and invocation accounting (zero recorded authority invocations). This verifies the retained failure prefix, not run completion. Physical prefix: 1,087,048 bytes, SHA256 `b4805e6bb96c3ad8647b2f28254d04a381f677d1d0921e58d00a6d66885cb873`; decoded prefix: 14,657,277 bytes, SHA256 `f5d03f686dfb2e16cdebc41b8c693f3b3e15096ebc840d0b5722c64c07bf9ad2`. After the watchdog, exact database OID/owner marker and zero backends were checked before and after a 939,275-byte database dump, SHA256 `1a277fd09d0163023194b2139893b5e29a82cfd6be72434b730a844151ba0e46`. DROP without FORCE then confirmed absence. This is postfailure abandoned state, not a first-failure checkpoint or restoration claim.

The fresh pair passed at `0648d1bda630b596d6eeb1bfbd76a55132e294b5`, containing 74 plus the separate City fix 86dc6ba7, native-control invocation repair e4d56fc6, and TOOL46 as the cherry-pick of 5f506844. Root integration should use the original 5f506844 once, not both it and 0648d1bd. No turf 58-table change is included. Both 57-table runs retain 25 initialized actors with two active quiet-policy participants, two sessions, eight fresh PlayerCommands and two successful crimes. Original callbacks: 24 Director, 24 health, 2 hourly, 2 season; 55 aggregate invariants passed. The fixed two-hour window crosses one original world seasonal boundary, not two rollovers or 90 days.

Independent verification checked every artifact and full logical history chain/invocation, compared all 18 actor-replay fields, compared complete initial/final tables and sequences, and compared the exact canonical bytes of all 1,085 resource entries in lockstep. Each run has 139,790 zero-drift equations and 45 explicit unknowns: car acquisition identity 6, NPC formation 2, receipt reason 2, Family lineage 2 and other table changes 33. Nonzero equation counts are ammo 24, cash 22, cars 6, cash-pocket 2, CB 1; these count equations, not unique transactions. OMR movement remains zero. Full-resource qualification remains false. Both exclusively owned databases were independently confirmed absent.

The new native observation's old/new calculation check passed 500 row-order cases and 1,087 journal cases, covering every 1,085 native journal entry. The archived baseline check passed 492 row cases and 1,087 journal cases. Existing resource corruption, gzip capture-failure, logical-history and import-order controls passed. No observer boundary, record, field, duplicate or unsupported classification was removed.

| Frozen0648 artifact or measurement | Observation | Fresh replay |
| --- | --- | --- |
| Manifest SHA256 | `452efd696551b6d42ef699dfec6e321f9e5df3ba2b5f41b9de4e04462224cbe0` | `8a4815157f00c9286e23175cb8a8fbe230ae2a99d5de37f8c6ed06f4267b2477` |
| Gzip history bytes |3,880,160|3,880,666|
| Full decoded history bytes |50,687,005|50,688,130|
| Resource journal bytes |49,569,299|49,569,299|
| Resource boundary wall cost |12,208.8572ms|12,098.5270ms|

Exact shared journal SHA256: `9bfefbf9be13b5e77573e3e04e96f27d69e5b1406d10038693be208cd49fb31e`. The observation profile is 1,537,597 bytes, SHA256 `147422be0d25d1942c3549dc571a3fc72350e4f0e510975a3e71625ceee697e0`. It measured 284.313ms attributed to the local sort block and 755.789ms to journal canonicalization over 32,330 samples. Whole observation/replay launcher wall times were 52,995.1486ms/53,696.2956ms. These are local source-specific observations; the changed observer scope, profiler overhead and concurrent machine work prevent a controlled speedup claim. No capacity extrapolation is made.

Restricted outputs: `C:/Users/Jorge/.codex/rc1-readiness-private-20260921/observer-serialization-0648d1bd-1/{observe,replay}`. The adjacent `independent-audit.json`, retained exact launch/audit scripts and CPU profile preserve configuration, source and every verification outcome. The original failed 74 directory and City controls retain their original source identities. The [retention index](harness-observer-serialization-index.json) hashes all 218 files / 24,042,106 bytes without publishing private rows; index SHA256 is `ea55700fb40846c730a1bec6f99849039bf8e9baee3d84814c7a9d8222c95459`. Native results remain pinned to 0648 even after this report-only update.
