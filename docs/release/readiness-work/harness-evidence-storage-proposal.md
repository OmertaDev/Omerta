# Lossless native evidence storage: measured feasibility and proposed contract

Owner: Codex/native_harness. This is a measurement and proposal, not an implemented archive format, resource gate pass or matrix capacity claim. No shared observer, runner, recorder or verifier changed.

## Observed measurement

The input is the retained `alliance-world-fc069f31-observe/history.jsonl` under `C:/Users/Jorge/.codex/rc1-readiness-private-20260921`. Its original source is `fc069f317b5e91bbf7b7787a83f9bdcfb60e2c30`. The original launcher encountered a post-seal whole-string verification failure; its embedded `PASS_SCOPED` record is not a complete-resource release qualification. This measurement does not relabel it. All original files remain unchanged.

The benchmark used a clean checkout of `f6eaefe5d92e1ee0bc603d076443e87f857ae7ba`, the current streaming verifier, Node24.19.0 and one local Windows process. Other local work was not prohibited; wall times are single observations, not controlled hardware comparisons or forecasts. Gzip level6,64KiB chunks and backpressure streamed the source into a **new restricted file**. Decompression recovered and verified every original byte without writing a second raw copy. A separate raw verification then checked the original again.

| Measured property | Result |
| --- | ---: |
| Original history bytes | 1,064,824,650 |
| Gzip bytes | 87,798,217 |
| Compressed/original fraction | 0.0824532161 |
| Original/compressed ratio | 12.1280897 |
| Gzip copy wall time | 8,660.9142ms |
| Gunzip plus complete history verification | 22,390.6278ms |
| Independent original history verification | 22,856.5255ms |
| Events / completed invocations | 15,917 / 716 |
| Largest observed JSONL line | 110,691 bytes |
| Contiguous invocation IDs / maximum outstanding | 1 through716 / 1 |

The exact recovered SHA256 is `e0232de36545710186da2e75e6cd6662c7bcd8a2a0e2da7677abb2b8906c1c20`, matching the original artifact index. Gzip SHA256 is `ea9a794f9f539f7d6dad39d372cb4192cfd07259c8a0362a67447eecfa447146`. Both verification paths return final chain hash `97730f6d767bdd2d4a34a385eb05dca52aca32b6d5a57669080f4a2c733cbf5f`. Original size, modification time and file identity matched before/after; the original hash matched in both independent raw reads. The new gzip file was independently rehashed afterward.

The command used `--max-old-space-size=128`, which limits V8 old space and is **not a total process-memory cap**. Sampled peak RSS was215,543,808 bytes during compression,207,896,576 during decompressed verification and216,514,560 during raw verification. Sampled peak heap use across those phases was80,588,056 bytes. Process cumulative peak RSS was278,856KiB, including source identity hashing. Samples were taken every25ms; the separate OS peak is cumulative rather than phase-specific. This proves this file can be processed without whole-file buffering, not that arbitrary future histories fit a fixed budget.

The original197 indexed artifacts total1,096,441,295 bytes; this history is about97% of that total. Its original `resource-observer-final.json` records13,476 boundaries,93,198 observed queries,340,697.6558ms aggregate observer wall cost,95.1049ms maximum boundary cost,1,054,484,474 serialized journal bytes and859,011 restricted-change bytes. All221 unsupported classifications remain. Compression removes none of that observation work and does not supply missing lineage. No225-run or90-day extrapolation is presented as observed performance.

## Proposed minimum transport schema

Keep the original `run.json` **byte-for-byte**, including its source, scope, status, logical artifact hashes and exclusions. A new explicit storage manifest describes transport only:

```json
{
  "format": 1,
  "kind": "rc1-native-evidence-storage",
  "originalRun": {
    "path": "run.json",
    "bytes": "exact integer byte count",
    "sha256": "original run.json byte hash"
  },
  "artifacts": [
    {
      "logicalPath": "history.jsonl",
      "logicalBytes": 1064824650,
      "logicalSha256": "e0232de36545710186da2e75e6cd6662c7bcd8a2a0e2da7677abb2b8906c1c20",
      "storedPath": "history.jsonl.gz",
      "encoding": "gzip",
      "storedBytes": 87798217,
      "storedSha256": "ea9a794f9f539f7d6dad39d372cb4192cfd07259c8a0362a67447eecfa447146"
    }
  ],
  "historyVerification": {
    "semantics": "rc1-proof-recorder-v1-sequential-invocations",
    "events": 15917,
    "invocations": 716,
    "finalHash": "97730f6d767bdd2d4a34a385eb05dca52aca32b6d5a57669080f4a2c733cbf5f"
  },
  "limits": {
    "maximumManifestBytes": "predeclared positive integer",
    "maximumHistoryLineBytes": "predeclared positive integer",
    "maximumOutstandingInvocations": "predeclared positive integer"
  }
}
```

The strings describing counts/limits above are schematic placeholders, **not accepted schema values**. A real manifest must use bounded nonnegative safe integers, strict SHA256 values and an entry for every original indexed artifact, with no duplicates or omitted entries. Initially compress only the history and copy other artifacts exactly using `encoding: identity`; their stored and logical hash/count pairs must match. Source metadata is never reassigned to the archive-tool revision. Record that tool revision separately.

The new archive verifier must be selected explicitly. Legacy raw readers must continue failing on absent raw artifacts rather than silently treating an unknown archive as verified. An exact on-demand restoration operation could later materialize logical bytes into a new directory without changing either archive or originals.

## Verification and memory contract

1. Cap the small manifest before parsing it. Verify exact original `run.json` bytes/hash and its existing configuration/status/scope constraints. Require a one-to-one mapping to its original artifact index. Constrain paths to the archive directory and reject escapes, symlinks and duplicate logical/stored paths.
2. Stream each stored file and verify its exact stored count/hash. For gzip, decode through backpressure, reject truncation/CRC errors and stop before exceeding the declared original byte count. Verify the exact decoded count/hash against the original artifact entry. Preserve whitespace, UTF-8 bytes, numeric representations, event order and every retained field.
3. Verify **every** history event with the existing canonical event hash, sequence, predecessor hash, invocation/completion pairing and terminal completeness. Enforce the line-byte limit before handing an oversized line to JSON parsing. Limits produce failure/incomplete, never sampling or skipped records.
4. The existing streaming verifier retains an `invoked` Set of every invocation ID. Its memory is therefore proportional to completed invocation count as well as largest line and outstanding work. For a new explicitly declared canonical-recorder mode, require invocation IDs to be consecutive positive integers starting at1; use a high-water counter plus the bounded outstanding-ID set. Completion must remove an outstanding ID exactly once and the terminal set must be empty. This preserves duplicate/missing/unknown-completion checks without retaining all completed IDs. The actual recorder increments IDs synchronously before queueing each invocation; this retained history independently satisfied that stronger contract. Legacy verifier acceptance stays unchanged.
5. Finish/publish the new manifest only after all payload and history checks pass. Leave partial outputs clearly incomplete on failure. Never delete or overwrite the original evidence as part of the initial tool.

Required implementation controls would include truncation, modified compressed/logical bytes, altered original run/configuration, missing/duplicate artifact, path escape, split UTF-8/event boundaries, sequence/hash/invocation corruption, unfinished work and exceeded limits. They are proposed controls; this measurement did not implement an archive verifier or run that new suite.

## Remaining scaling work

A post-seal archive reduces retained copies but does not reduce peak disk use during live capture. A later optional streaming gzip history sink could use the same logical/physical contract and existing record ordering, but requires its own source-bound tests, backpressure/error handling, failure-retention checks and replay-reader integration. No resource observation may be disabled to claim this saves space.

This storage change also does not fix `canonicalDatabaseSnapshot` retaining full table arrays or `artifact()` serializing a complete object through `JSON.stringify`. Large future snapshots/individual events can still exceed producer memory/string limits before compression sees them. Original callback execution, resource scope, observer CPU, full-state comparison and all225 qualification cells remain separate requirements.

## Retention and reproduction

New restricted output: `C:/Users/Jorge/.codex/rc1-readiness-private-20260921/evidence-scaling-f6eaefe5-1`.

- `measure.mjs` SHA256: `43e362c3267b17f356fed68b092be57891257599718dfc8a121062a33b6b1e78`.
- `benchmark-result.json` SHA256: `bedfe4be8e55a014db9909af862b2f465e6d023df66695def57fc316515c9145`.
- `invocation-shape.json` SHA256: `cafb41a4a2e027fcc4f2bd6ea67f2a605089bcadc4545095751ded9a1e0b04f6`.
- `measurement-index.json` SHA256: `f4b2de4bc5137ba6db5a88869a3556aadf728e21efc85f019accbd5e76324c9d`; indexes the new scripts, output, gzip and results, without moving originals.

The retained scripts refuse overwriting their output. From the frozen checkout, the measured command was `node --max-old-space-size=128 <restricted-directory>/measure.mjs`; the separate invocation-order check used the same flag with `inspect-invocation-shape.mjs`. Reproduction requires a reviewed copy with a fresh output directory, retaining its own script hash and verifier source identity.

## Proposed optional live capture

The design below now has an optional implementation and focused controls; new native and full-history measurement results must name their own frozen revision. Leave the absent-option identity recorder and historical verification unchanged. Add an explicit `historyStorage` option with `encoding: gzip`, `framing: event-members-v1`, and required positive safe-integer limits `maximumDecodedBytes`, `maximumStoredBytes`, `maximumLineBytes`, `maximumOutstandingInvocations` and `maximumPendingRecords`. Reserve the option and its canonical hash before native work starts.

Use one complete gzip member per exact original canonical JSONL event. Stream the line through gzip to an exclusively opened restricted file, and await the member footer and underlying file-write callbacks before resolving `record()`. Advance acknowledged sequence, chain hash and logical-byte accounting only after that acknowledgement. This is operating-system write acknowledgement, not an `fsync` or power-loss guarantee. The admitted queue and individual event are bounded; a stalled sink stalls authority admission. This framing makes acknowledged event prefixes independently complete and avoids claiming that a compressor input callback proves physical output completion. It can compress differently from the measured single-stream file; benchmark it separately before claiming a storage ratio or runtime cost.

For opted-in runs, use format2 and retain existing artifact `path`, `bytes` and `sha256` as physical-file metadata. The history entry is:

```json
{
  "path": "history.jsonl.gz",
  "bytes": "stored byte count",
  "sha256": "stored SHA256",
  "decoded": {
    "path": "history.jsonl",
    "encoding": "gzip",
    "framing": "event-members-v1",
    "bytes": "exact original JSONL byte count",
    "sha256": "exact original JSONL SHA256"
  }
}
```

The example values are schematic, not valid manifest values. Other artifact entries remain unchanged. The run also declares `historyStorage`, `historyStorageSha256`, and `historyVerification` containing `semantics: sequential-invocations-v1`, `events`, `invocations` and `finalHash`. An opted-in verifier checks the physical artifact index with a stored-byte read bound, then streams all concatenated gzip members with decoded-byte/line bounds, exact decoded hash/count, every event/chain check and sequential invocation IDs with a bounded outstanding set. Terminal invocations must all be complete. Unknown format/encoding/framing, a missing or duplicate history, CRC/truncation/trailing garbage, altered metadata, overflow and semantic corruption fail closed. Legacy identity acceptance does not change. Framing is a pinned writer/acknowledgement contract: the verifier proves complete gzip integrity and logical history, without independently counting members. zlib's consumed-byte count rejects otherwise accepted trailing zero padding.

Finish closes admission, drains admitted events, verifies retained bytes, and only then writes a completed run manifest. An ordinary authority exception can have a complete `THREW` record and a validly captured `FAIL` run. A capture or limit failure instead poisons further admission, retains the partial gzip and acknowledged-prefix diagnostics, and cannot produce a completed `run.json`. `finish()` should retain a best-effort `capture-failure.json` naming the first capture failure, attempted versus acknowledged position, outstanding invocation IDs, caller result, source and physical file hash/count when readable, then throw the original capture failure. Do not report a failed completion write as an authority exception or invent a completion. Keep `artifact()` available for caller-controlled failure snapshots. Disk exhaustion, an abrupt process exit or unencodable caller data cannot guarantee retention of unwritten bytes; these are explicitly incomplete outputs, never replay qualification. No partial evidence is deleted.

Focused controls must cover stalled sinks, queue/line/decoded/invocation bounds, split UTF-8, footer/CRC/trailing-data corruption, duplicate or unfinished invocations, authority versus capture failures, completion-write failure, truncated final members and child-process interruption. Compare complete decoded bytes against an identity reference and retain a new source-bound native replay. Large-event serialization still happens before the line-size check: the transport bounds do not solve producer `canonicalJson`, snapshot arrays or `artifact()` allocation limits.

Caller inspection at `f6eaefe5d92e1ee0bc603d076443e87f857ae7ba` found that world/worker replay uses `verifyArtifactIndex` and separate replay-tape artifacts, without reading history directly. Eight focused native consumers do read raw recorder history: aggression heir/lifecycle/policy, churn policy, retained Family cash/ammo, Family native, Law native and market native. They must stay on identity until explicitly migrated. The stream test reads its own raw fixture, and source-pair uses a separate recorder. No world runner or observer change is part of this proposal.
