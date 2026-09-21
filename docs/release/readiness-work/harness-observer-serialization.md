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
