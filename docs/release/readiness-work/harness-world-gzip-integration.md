# World gzip integration: scoped native replay

Owner: Codex/native_harness. Frozen native source: `2b47e79d4ddcf31f2abb08ae3e7524c5584d91eb`, based on root `80b60b72e244c8887272ed32c290a2775f6ca6b8` plus the optional storage implementation. This source uses the **56-table** resource observer. Later observer/runtime changes require a new source-specific run. No production module or shared resource-classification rule changed here.

The world runner now accepts explicit gzip history limits, verifies identical storage choice/configuration before replay, resume or uninterrupted comparison, and preserves the absent-option format1 configuration/recorder path. The continuation audit reads verified logical history for either encoding with no raw fallback. Both its verification and consumption paths cap line bytes; all physical and decoded hashes are checked. Complete consumption is mandatory. The source-frozen native pair below proves the short world path; native gzip alliance continuation and48-hour execution were not run.

## Changes and retained failures

- `b5d97db5abeeba2a6c4b9377a52dbc7be009a750` fixes compressed-recorder artifact admission. `finish()` closes record, artifact, snapshot and checkpoint admission, drains already admitted operations, and prevents publication after an admitted artifact fails. Internal checkpoint metadata writes do not reopen admission. Failure snapshots remain allowed after history poisoning **before** finish. Artifact/snapshot JSON and database snapshot allocations are still unbounded upstream; only the history transport has the declared bounds.
- `8e7ed931d9b231470df8b4b090e55d01ae06febd` adds explicit world CLI/configuration, logical-history access, continuation-audit migration and cleanup after poisoned capture. Default legacy verification behavior is unchanged; the new accessor opts into stricter line limits. Incomplete capture also retains the full run configuration/hash.
- `2b47e79d4ddcf31f2abb08ae3e7524c5584d91eb` fixes test-only observer import order. The observer imports canonical `checkinQuoteOf` through `src/game.js`, which imports `src/db.js`. The world runner must install its source-pinned database instrumentation before that import. The cached-database refusal remains intact, and canonical check-in rules were not copied or changed.

The artifact-admission failure was reproduced at clean `ee48d4d866f79fc2332ac1430835732819bc845a`: a delayed snapshot and a post-finish artifact both wrote files absent from the sealed index. This is a **tooling fixture with no PostgreSQL**, and its embedded `PASS_SCOPED` manifest is the reproduced invalid sealing behavior, not valid native evidence. The delayed snapshot/checkpoint and publication/refusal controls now pass at source2b47. Retained reproduction: `gzip-artifact-finish-gap-ee48d4d8-1`.

The first resource-enabled world attempt at source8e7 sealed `FAIL` before actor work with `Cached uninstrumented db.js is forbidden before any database boot`. Two source-bound causal processes confirmed the exact import chain: observer-first is refused before any Pool construction; instrumentation-first reaches a deliberate Pool sentinel without a database connection. Those scripts/source hashes are retained in `world-observer-import-order-8e7ed931-1`; the actual failed world is `gzip-world-8e7ed931-observe-1`. This is separate from checkpoint bootstrap timestamp classification.

The deliberate1-byte line/decoded limit at source8e7 produced `INCOMPLETE`, retained failure artifacts and an empty partial history, and never created `run.json`. Its original error is `History line-byte bound exceeded`, not the import failure. The already created owned database was removed despite the poisoned recorder. At source2b47, changing the replay pending limit from64 to63 was rejected before output reservation or database planning. Both negative outputs remain retained.

## Frozen native result

Observation and recorded replay both passed at source2b47 using separate owned PostgreSQL18.4 databases and seed `rc1-alpha`. The quiet policy retained25 initialized actors, of whom two participated in this two-hour window: eight fresh PlayerCommands, two successful canonical crimes, eight authorized snapshots and42 observed authorized opportunities. All24 Director,24 health, two hourly and two seasonal timer callbacks ran. All55 aggregate invariants passed.

The two-hour window starts **2026-09-23T23:00Z** and ends **2026-09-24T01:00Z**, deliberately straddling one original28-day seasonal deadline. Exact snapshots show25 player characters moving from season739 to740 and25 new recap rows for season739. This is **one world boundary**, not25 separate seasonal executions. The original seasonal callback performed the transition; no duration/deadline override was introduced. It does not prove a full season of activity, two rollovers, longest-lifecycle coverage,90days or any matrix cell.

All18 actor-replay comparison fields matched, including complete initial/final canonical state, worker schedule/job outcomes, actor decisions/outcomes/policy, RNG, Knowledge/world diagnostics and the exact resource-journal count/digest. Physical history files retain real observation times and run metadata and consequently have different raw hashes; their complete logical bytes are independently verified.

| Native artifact | Observation | Replay |
| --- | --- | --- |
| Full decoded history bytes | 49,987,628 | 49,988,761 |
| Stored gzip bytes | 3,565,589 | 3,565,948 |
| Resource boundaries | 1,085 | 1,085 |
| Recorded zero-drift equations | 139,788 | 139,788 |

The independent audit consumed every logical event, checked contiguous resource before/after hashes and recomputed the exact full journal digest and a ten-boundary prefix. Both runs have53 nonzero equation checks: ammo24, cash22, car quantity6 and CB1; OMR movement remains zero. These count equations, not unique transactions. In particular, the six car quantity checks **do not resolve car identity provenance**.

All39 unsupported entries remain explicit in each run: car-acquisition identity provenance6, Family lineage2 and observed-table changes31. `qualifyingFullResourcePass` remains false. The observation's resource snapshot/reconciliation/artifact work measured14,026.5747ms total, maximum71.546ms per boundary; its serialized journal content was48,869,929 bytes and restricted changes235,864 bytes. These are observed local instrumented costs, not projected throughput or production acceptance. Raw restricted changes, complete state/checkpoints, all callbacks and every supported check remain retained.

External RWA registry settlement remains unavailable; chain/liquidity integrations remain disabled, and the local archive alarm is retained. The quiet runner uses declared synthetic initialization and domain authorities, with no production HTTP/provider or human-cohort claim. The newer root57-table observer,48-hour native continuation, all thirteen resource branches and225-cell matrix remain outside this result.

## Exact identities and retention

- Initial canonical state: `4e2854266b63d0c6b667afd82997e8ca45ad3cf41757287d2ef36c148f9b7fed`.
- Final canonical state: `a913b658b9396dc29a330b43cc9e84d07d28ea4cd12895992b66900c117f1628`.
- Exact resource journal: `8cfd074adac3baa7ed69448cb012f2655d5708777f0e661f28f2001fcaf045a3`.
- Observation manifest SHA256: `217883791cd5f5e41d59e120301e6ab7f0ff7fad6c0d8efa0ff8b8cbb1a46c08`.
- Replay manifest SHA256: `59cbf38e9e81c87cc21b5d01e839e8242330fc2a543c8c97e5a7330889c445fd`.
- Independent index SHA256: `0cbd428392a0033c7c863135a3e0ec062342d0e86b6557e6247bd87ea86055ef`.

[The complete hash index](harness-world-gzip-integration-index.json) covers232 retained files totaling17,383,231 bytes, including all failures and controls. The identical restricted index is `C:/Users/Jorge/.codex/rc1-readiness-private-20260921/gzip-world-2b47e79d-independent-index.json`. Native outputs are `gzip-world-2b47e79d-observe-1` and `gzip-world-2b47e79d-replay-1` under that private root. All four owned databases from these world attempts were independently confirmed absent. Original full-history compression measurements remain at their original source/paths; this result does not relabel them.

Source-frozen controls passed: gzip recorder/finish barrier, explicit CLI and parent-storage matching, exact identity/gzip resource prefix and full digest, UTF-8/chunk boundaries, verification and consumption line caps, truncation, incomplete consumption, poisoned-capture cleanup, observer import order, legacy streaming/proof units and existing alliance-continuation units. Their before/after source check and complete outputs are retained in `gzip-world-controls-2b47e79d-1`.

## Reproduction

Use the frozen source, a fresh restricted directory and the disposable local `COORDINATION_TEST_DATABASE_URL`. The measured endpoint was port55441 and `RC1_PG_BIN=C:/Program Files/PostgreSQL/18/bin`.

```text
node test/rc1-native-world-workload.js --postgres --output=<fresh-observation> --hours=2 --population=25 --seed=rc1-alpha --policy=quiet_world --observe-resources --max-wall-ms=1200000 --max-output-bytes=536870912 --min-free-bytes=536870912 --history-encoding=gzip --history-max-decoded-bytes=536870912 --history-max-stored-bytes=134217728 --history-max-line-bytes=8388608 --history-max-outstanding-invocations=64 --history-max-pending-records=64
```

Repeat all settings with a fresh output and `--replay=<observation>` for the recorded replay. Explicit gzip encoding and all five history limits are mandatory together; missing, duplicate, non-decimal, nonfinite or mismatched settings fail. Omit all history flags for the existing identity format. The20-minute wall,512MiB total-output/free reserve,512MiB decoded,128MiB stored and8MiB line limits were fixed before this short run. A breached bound produces failure/incomplete, never skipped evidence or a reduced resource check. Write acknowledgement does not claim power-loss durability.
