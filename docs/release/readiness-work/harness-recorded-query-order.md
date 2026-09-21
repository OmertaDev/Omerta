# Recorded native order after the 90-day replay failure

Owner: Codex/native_harness. Test-only scope; no gameplay or production source changes.

The retained source `2ac778b3f6a66df6334e85306cd95696226355f5` completed its 90-day observation and replay, but exact replay failed. Day 29 selected a different tied seasonal champion. The final hour also assigned two market refund receipt IDs and expiration notification IDs to different orders. All raw state remains retained in `harness-quiet-90day-regression-results.json` and its complete artifact index.

The canonical standing input has no SQL ordering and its JavaScript sort compares only standing. No authored individual tiebreak was found in the focused source, documentation and tests. The market sweep similarly iterates an unordered complete due list. The harness therefore records the observed native ordering; it does not invent a tiebreak or normalize IDs, crowns, recipient ownership or balances away.

Scope version 4 retains the version 3 lossless chunk format and adds exactly two demonstrated queries to the existing NPC selection query:

- Standing: execute the exact original SQL unchanged. Record every returned eligible ranking row, column and native type, including exact numeric strings and duplicate multiplicities. Replay maps the recorded order back onto the actual native row objects only after full multiset equality.
- Market expiry: a single PostgreSQL statement retains the unchanged original projection and every complete eligible listing as raw PostgreSQL JSON text under the same predicate. Replay checks full eligible value/membership/multiplicity equality and validates every projected row before returning recorded order. Empty sets are recorded too.
- NPC selection keeps its existing same-snapshot complete eligibility check and observed LIMIT subset semantics.

Each source file, exact query site, original SQL and any transformed SQL is pinned and retained. Changed source, parameters, original bytes, tape query identity, query count, row values, membership or multiplicity fails. Old tape scope versions are refused. This is recorded nondeterminism replay, not seed-only determinism or production concurrent scheduling evidence.

`node test/rc1-native-query-order.js` supplies row/value/multiplicity and wrong-query controls. Its `--postgres --output=<fresh directory>` extension uses separate owned native databases, identical synthetic initial states with opposite physical insertion orders, and the actual `recordReckoning` and `sweepMarket` authorities. It must demonstrate differing native champions/receipt states followed by complete state equality under replay. Native altered-value, missing/extra-eligibility and wrong-query cases must reject before authority mutation. These small initialization fixtures do not qualify resource or elapsed-lifecycle behavior.

The fresh long pair starts from integrated root `09119b2921514f3c76bbd65c0613f926cf700400`, including the seasonal atomicity/retry repair, plus this test-only repair and the committed guardrails/report. Each run declares 2,160 hours, 25 quiet actors, seed `rc1-alpha`, all original configured callbacks, separate owned databases, maximum wall time 14,400,000 ms, maximum output 17,179,869,184 bytes and minimum free space 34,359,738,368 bytes. A breach is FAIL/incomplete. Resource commit observation remains explicitly disabled for this bounded replay/storage regression. The failed 2ac replay is its `--prior-failure` predecessor; the older V8/shared-database failure remains linked through the retained report. Exact full-state comparison is mandatory. No run enters the 225-cell acceptance matrix.
