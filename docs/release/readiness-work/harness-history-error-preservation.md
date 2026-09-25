# TOOL54: preserve the first gzip history verification error

Source `172910e91642ee73d2577a9749bf2a5b090c2cc3` repairs the gzip verifier
only. Its parent is `b5c80a4ed921e58792e78f8c4b51de5635182b74`. No runtime,
gameplay, evidence format, history bytes, verification limits, or default-v1
behavior changed.

Hosted run `35593259693` on Node22.23.2 failed the existing world-history
line-limit assertion: an `AbortError` replaced the intended `line-byte` error.
The unchanged test reproduces locally on the exact Node22.23.2 version; it passes
on Node24.19.0. Both local runtimes here are Windows x64, not a hosted Linux rerun.

A native file → gunzip → Transform → async-consumer control isolates the cause.
On Node22, throwing a sentinel from the consumer's default async iterator causes
iterator teardown to destroy the stream with `ABORT_ERR` before `pipeline`
receives the sentinel. A buffered `Readable.from()` control does **not** reproduce
the timing. The repair uses `iterator({ destroyOnReturn: false })` for that
pipeline-owned consumer. `pipeline` still destroys every stream, while returning
the exact original exception object. No catch replaces a source error.

Clean-source verification passed on Node22.23.2 and Node24.19.0, each running:

```text
node test/rc1-history-error-preservation.js
node test/rc1-world-history-storage.js
node test/rc1-native-proof-gzip.js
node test/rc1-native-proof-stream.js
node test/rc1-native-proof.js
```

The new test checks eleven distinct failures: exact consumer exception identity,
line limit, native ENOENT, streamed physical and decoded limits, semantic hash,
sequence, JSON, unfinished invocation, truncated logical line, and native gzip
truncation. Its causal control checks teardown of all three native streams. The
unchanged world-history test retains its precise line-error expectation and
incomplete-consumption rejection. Existing gzip/stream/default-v1 tests also pass.
This is tooling verification, not a PostgreSQL world, load, or matrix result.

Restricted evidence is under
`rc1-readiness-private-20260921/history-error-tool54-b5c80a4e-1/`.
The [artifact index](harness-history-error-preservation-index.json) binds all
167 retained files (131,929 bytes), including the original failure, first failing
new regression, causal controls, development retest, commands, source/runtime
identities, and both clean-source test sets. Its SHA256 is
`d929ac9706a0e630ffacea87d32d7cb2251712f70279eb2762d17be6f5285734`.

| Evidence | SHA256 |
| --- | --- |
| Original hosted failure log | `0bf45b80fa23a3a968a1452bb2c1f3c4985b28ae961871fbddd60212d8e625a2` |
| Local unchanged Node22 failure | `c19f93beea87b60aeecb5ade582ab364757fb91719a5dcfbf190303e1e240ae7` |
| Native gzip causal Node22 control | `04096500f5fc2522f357c9a0d34021158c257396420e9206acc8bb1545317e76` |
| Clean repaired Node22 report | `d850cf76585442d67ab2b62199a1ae41cf4fedf6211aca854aadee6a0705912f` |
| Clean repaired Node24 report | `977d5b4fe67b7f889f9465bc3aced4737f7ed250b790cdf056b028d505e63a69` |

Node22.23.2 was downloaded from the official versioned Node distribution and its
executable checked against that distribution's SHA256 listing:
`0d0f5e39f9f3d9587bc19f73eab3c2c9c4903fd02d6dbf9c853dd81b3d95fad4`.
The Node24.19.0 executable SHA256 is
`3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237`.
The public report/index commit follows the completed tests and does not relabel
their tested source. Package/CI integration and hosted retesting remain separate.

The later integrated source `8ba78e71705726e430605d905fa2af951728dd16`
passed [hosted CI35604353498](https://github.com/OmertaDev/Omerta/actions/runs/35604353498),
including the unchanged diagnostic harness controls on Linux. The
[retained result](hosted-8ba78e71-ci-results.json) binds final metadata and logs.
Earlier failures remain failed. This pass does not resolve the separate connected
phone-journey failure or qualify the full release.
