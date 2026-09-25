# Optional gzip evidence capture: bounded result

Owner: Codex/native_harness. Implementation `6b2f3f4872e56b254917393bfffb92516687bc12`; final publication/format guard `f5524e9aea49ad26d9684543f7a1868e1be841e1`. This changes evidence storage only. No production or world-runner code changed, and no matrix cell becomes qualified.

`createProofRecorder` accepts an optional `historyStorage` object. The absent option preserves format1 identity capture and its historical verifier. The new format2 requires `encoding: gzip`, `framing: event-members-v1` and positive safe-integer `maximumDecodedBytes`, `maximumStoredBytes`, `maximumLineBytes`, `maximumOutstandingInvocations` and `maximumPendingRecords`. All limits and their hash are reserved before work. Exact artifact/schema and failure semantics are in [the storage contract](harness-evidence-storage-proposal.md#proposed-optional-live-capture).

Every canonical JSONL event becomes a complete gzip member; the original bytes, timestamps, values, order and event hashes remain intact. Acknowledgement awaits all physical write callbacks and member completion, without claiming `fsync` or power-loss durability. The verifier checks physical bytes/hash, complete gzip CRC/footer integrity, consumed compressed-byte count, decoded bytes/hash and every sequence/hash/invocation condition. Framing is the pinned writer contract; the reader does not independently count members. A finite outstanding set replaces completed-ID accumulation only in the explicitly declared sequential-ID format2 mode.

Capture errors stop admission and retain the partial gzip, acknowledged prefix and `capture-failure.json` marked `INCOMPLETE`. Authority errors remain distinct from recording errors, including preservation of the original exception when its completion cannot be captured. A healthy capture can seal an ordinary `FAIL`. Source-change failure seals `FAIL`, never the caller's requested pass. `run.json` is published by an exclusive hard link only after a fully closed staging write and verification; failed publication retains `run-unsealed.json` and incomplete diagnostics. Reserved/duplicate artifact paths are rejected.

## Actual retained-history measurement

The original `fc069f317b5e91bbf7b7787a83f9bdcfb60e2c30` alliance history remains untouched. Its embedded run status and original post-seal verification failure are unchanged. The new measurement at **6b2f3f48** is storage verification, not another native world or qualification run.

| Measured quantity | Result |
| --- | --- |
| Exact original bytes | 1,064,824,650 |
| Event-member stored bytes | 93,695,506 |
| Original/stored ratio | 11.364735572269602 |
| Compression wall time | 13,050.3966 ms |
| Full gzip + logical verification | 20,734.7182 ms |
| Complete events / invocations | 15,917 / 716 |
| Maximum line including LF | 110,692 bytes |
| Sampled peak RSS / heap used | 261,242,880 / 73,672,992 bytes |
| Cumulative OS maximum RSS | 318,816 KiB |

The measurement used Node24.19.0 with `--max-old-space-size=128`; this limits old-space, not total process memory. RSS sampling was every25ms. A native worker fixture ran concurrently, so timings describe that observed local run and are not isolated throughput benchmarks or projections. The decoded cap was2GiB, stored cap512MiB, line cap1MiB, maximum outstanding64, pending1 and wall-time guard300,000ms. All remained finite and unchanged. Compression CPU was14,250,000 user and1,782,000 system microseconds. Exact final chain was `97730f6d767bdd2d4a34a385eb05dca52aca32b6d5a57669080f4a2c733cbf5f`.

- Original/decoded SHA256: `e0232de36545710186da2e75e6cd6662c7bcd8a2a0e2da7677abb2b8906c1c20`.
- Stored gzip SHA256: `d6520cb7b3ebabf6b6e1e75519ea08136672f798d61f6112f8c5e681b0fd39a9`.
- Output: `C:/Users/Jorge/.codex/rc1-readiness-private-20260921/evidence-members-6b2f3f48-2`.

The earlier continuous-gzip copy was87,798,217 bytes. The event-member framing costs5,897,289 additional stored bytes on this exact history in exchange for complete acknowledged member prefixes. Neither measurement removes the original resource observer's340,697.6558ms of observed work, unsupported classifications, snapshot allocation limits or unfinished matrix requirements.

## Native and failure controls

Source-f552 observation and recorded replay each ran two logical hours in separately owned PostgreSQL18.4 databases. Both passed all55 aggregate invariants and executed263 guarded original worker jobs, including24 Director,24 health, two hourly and two seasonal timer callbacks. Complete initial/final canonical state, original schedule, job outcomes and RNG tape matched exactly. Both owned databases were independently confirmed absent after cleanup.

This fixture starts with zero player actors; original NPC creation remains canonical. It is not a player workload, per-commit resource proof, long-season test or matrix cell. External RWA registry settlement remains unavailable, chain/liquidity integrations disabled, and the local archive alarm retained. No callback or native state value was normalized away.

- Initial state: `c5f953477db69691011b423ff6ffb8bda8ad68de7d71c8cf6f373ef3bbbf6573`.
- Final state: `319d1777fca15633d87487df85e0d016c26f2f48959aaf6073228eb25973c205`.
- Observation manifest SHA256: `7206a3544bb5f46986158072a65903544176979a706cb67bb0a060206439f9dc`.
- Replay manifest SHA256: `79e1cbb0e8ed4883973a42bb05fa73ec4b1e3dcf3719117b414c91979966066a`.

The earlier source6b pair also passed and remains identified separately. Initial source6b launch attempts refused before initialization because two working files had mixed line endings despite clean Git status. Exact committed Git blobs were restored without changing the commit; both refusal logs remain retained. They are not native failed-run manifests.

Source-f552 controls passed: exact identity-reference bytes, UTF-8 boundary splits, short/stalled physical writes, partial-member I/O failure, real child-process interruption, complete acknowledged prefix recovery, CRC/truncation/trailing garbage and zero padding, altered logical content, all five bounds, duplicate/unknown/unfinished invocation handling, duplicate/reserved paths, unknown compressed format, source-change `FAIL`, failed publication and original authority exception identity on failed completion capture. Legacy stream and proof unit suites also passed. The source identity was independently checked before and after these retained controls.

All104 new retained files (101,832,440 bytes), four native manifests and original-reference hashes are listed in [the independent index](harness-gzip-capture-index.json). The identical restricted index is `C:/Users/Jorge/.codex/rc1-readiness-private-20260921/gzip-storage-f5524e9a-independent-index.json`, SHA256 `7b847bed68f2401e7c588156d811f9bc8a5630b71c516227bfb8362a2d090c92`. It contains metadata/hashes, not raw game rows.

## Commands and remaining limits

Run these from the pinned committed checkout with a new output directory each time:

```text
node test/rc1-native-proof-gzip.js
node test/rc1-native-proof-stream.js
node test/rc1-native-proof.js
node --max-old-space-size=128 test/rc1-native-proof-gzip-benchmark.js --input=<retained-history.jsonl> --output=<new-restricted-directory>
node test/rc1-native-proof-gzip-worker.js --output=<new-observation>
node test/rc1-native-proof-gzip-worker.js --output=<new-replay> --replay=<observation>
```

The native commands require the disposable local `COORDINATION_TEST_DATABASE_URL` and `RC1_PG_BIN`; the measured endpoint was port55441 and the binaries were `C:/Program Files/PostgreSQL/18/bin`. `RC1_GZIP_TEST_OUTPUT` optionally retains unit fixtures in a chosen new restricted location.

World-runner opt-in, continuation-history consumers and resource-enabled short world replay remain a separate integration step. The current world runner still writes identity history. Complete event serialization, full-table snapshot arrays, `artifact()` JSON serialization, checkpoint memory and caller-owned objects remain upstream capacity limits. No sampling, normalization, resource-check removal or225-run capacity estimate is introduced.
