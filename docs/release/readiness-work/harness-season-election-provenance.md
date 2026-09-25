# Cold initial season election provenance

Owner: Codex/native_harness. Tested clean source:
`56e28fce29b30e8a6ebcb814c0d6e7a2836152c2`, based on the tested
`6502279a388d72afb4716f659aa567bc34d6f68d` crown chain. No production file
changed. Node 24.19.0, PostgreSQL 18.4, Windows; local hardware and concurrent
local work are not production-equivalent performance evidence.

This closes one previously unsupported initial `season_records` insertion:
an actual **cold, all-zero individual standing election with no core Family
holder**. It does not infer its winner from the stored row. The original
exported `recordReckoning`, original memo, original population query, original
scorer, stable tied ordering and original SQL all execute.

The earlier crown proof at `e1caae37` left initial selection unsupported.
[Its guide](harness-season-crown-observer.md) and immutable evidence remain
unchanged. This later proof does not upgrade that earlier result.

## Observation and classification contract

`tools/rc1-season-election-provenance.js` pins the complete LF source hashes of
`season.js`, `standing.js`, `memo.js` and `rules.js`. Its test-only module hook
records complete original/transformed sources, both hashes and every exact
replacement. The standing transformation observes the original scored result
after sorting and returns that same result; the season wrapper delegates the
original body through a query observer. It does not replace a ranking algorithm,
alter query bytes, reset the memo or impose a tie breaker.

The separate uninstrumented read-only pool captures all columns and native field
types from `accounts`, `account_persistent`, `characters`, `districts` and `gangs`
before election reads and again at the actual autocommitted insertion boundary.
Both full candidate snapshots must match. In this serial, exclusively owned
database scope, the witness also retains exact query parameters, returned row
order, values/types/multiplicity, original scorer inputs and outputs, and the
actual selected board row. The existing query-order replay seam retains actual
observed order only after checking complete native membership and values.

Validation binds complete eligibility (`alive`, account status, agent/NPC flags),
the original all-zero score and stable tied order, unique living-name ownership,
the complete held-district result, exact insert parameters and the newly stored
uncrowned record. It rejects any simultaneous change in another observed
resource table. The witness must match this exact native event; historical
records remain immutable. Selection is state-only: crown delta zero and no
currency grant. The separately committed stored-intent crown remains governed
by the existing one-use crown journal.

Warm memo hits, shared-flight results, imported/uninstrumented cache state,
repeated computations, nonzero scoring, ambiguous living-name lookup, empty
population, core Family selection and compound query shapes are excluded or
fail closed. Source mismatches, changed eligibility/values/order and unrelated
resource mutations reject. The witness is test-recorder evidence, never a player
input. Each witness is limited to 8 MiB and 64 queries.

## Source-bound checks

Pure election controls pass: 24 rejected corruptions, four explicit unsupported
cases and both opposite native-order fixture projections retaining different
tied winners. These fixture checks are not native execution evidence. Existing
crown (33 rejection/eight unsupported), season conversion and shared-resource
controls also pass.

The focused native control uses three ordinary HTTP guest/character entries,
then invokes the original authority with the actor's actual season. It captures
one cold election and one separate positive player crown. Five corruptions of
the actual native witness reject; all 55 canonical invariants pass. A fourth
ordinary entrant is then created. The immediate same-process retry actually
uses the original warm memo, is explicitly unsupported as a new selection proof,
and preserves every canonical table and sequence.

A fresh Node process, using the same exclusively parent-owned database, observes
the original cold memo computation including all four entrants. The saved-record
retry changes no complete canonical state and applies no election/crown again.
This proves process-cache recomputation and stored-record retry only; it does not
claim `makeDb`, full-worker or checkpoint restart equivalence. HTTP enrollment is
declared initialization outside this focused per-commit observation window.

The focused lane has nine resource boundaries and 143 exact equations; its child
has five boundaries and 90 equations. Independent checks verified complete source
transformations, manifests, every artifact/history chain, native candidate
snapshots, the cold classifier, actual award count and exact retry state. The
parent-owned database is absent after cleanup.

The fresh original-worker pair uses quiet policy, 25 schema-default synthetic
actors, `rc1-alpha`, two logical hours and full resource observation with gzip
history. Two actors participate: two sessions, eight fresh PlayerCommands and
two successful crimes. Every scheduled original callback runs: 24 Director,
24 health, two hourly and two season callbacks.

Both lanes pass with **all 18 replay fields, all complete initial/final tables
and sequences, and all 1,085 canonical resource journal strings equal**. Each
lane checks 139,795 exact equations over the 59-table resource readset. One cold
25-candidate election is now classified; the separate player crown is +1.
Four positive NPC prestige conversions grant 24 prestige; 25 player recaps have
zero prestige gain. These are explicitly separate outcomes. The callback's
bootstrap seasonal conversion at 2026-09-24T00:00:00Z does not prove an elapsed
28-day season, two rollovers or a matrix cell.

The same 14 other unsupported entries remain per lane: six car identity cases,
two NPC Family formations, two receipt reasons, two Family lineage cases and two
membership table changes. Other later integration branches may classify them;
this ancestor's evidence does not inherit those results. Both world databases
are independently confirmed absent.

Independent world verification checks every retained witness reference/hash,
original/transformed source map, complete five-table candidate pair and exact
candidate/order/record projection. It does not reconstruct a missing full
59-table boundary snapshot from that candidate-only artifact: the full resource
before/after comparison ran inside the native observer. Full initial/final
canonical states and every resource stream entry are retained and compared.

## Commands, limits and retained evidence

Pure command: `node test/rc1-season-election-provenance.js`.

Focused native command: `node test/rc1-native-season-election-controls.js --postgres`,
with `RC1_ELECTION_OUTPUT` set to a new private directory and
`COORDINATION_TEST_DATABASE_URL` set to the local control database. The control
creates its own uniquely owned database. It never uses the control database as
the world. The entry name deliberately does not end in `server.js` or `worker.js`.

World command, with a new `--output` directory for each lane:

```text
node test/rc1-native-world-workload.js --postgres --hours=2 --population=25
  --seed=rc1-alpha --policy=quiet_world --observe-resources
  --max-wall-ms=1200000 --max-output-bytes=536870912 --min-free-bytes=536870912
  --history-encoding=gzip --history-max-decoded-bytes=536870912
  --history-max-stored-bytes=134217728 --history-max-line-bytes=8388608
  --history-max-outstanding-invocations=64 --history-max-pending-records=64
  --output=<new-private-directory>
```

Replay adds `--replay=<observation-directory>`. `RC1_PG_BIN` points at the
PostgreSQL 18 binary directory. The retained launcher adds a 1,500,000 ms external
watchdog per lane; no guardrail fired or changed. Observed wall durations were
76.3 s and 74.2 s. They are local observations, not throughput projections.

Restricted directories under `rc1-readiness-private-20260921`:
`season-election-first-1` and `season-election-56e28fce-1`.
[The public-safe index](harness-season-election-index.json) hashes all 119 retained
files (20,356,353 bytes), including launch configuration, audits, full snapshots,
query/RNG tapes, restricted candidate witnesses and compressed histories.

| Artifact | SHA-256 |
| --- | --- |
| Focused manifest | `364637d08623f429b2e79d8b34fbdbd40101812ef779e259de2ee2842ef82c2a` |
| Fresh-process child manifest | `c8fd9c16d4969e1b4705ba1aaa2b529b1464010a33336091cdd5a93f679bb5c0` |
| World observation manifest | `9b2dfaa7f1436a47c03de704fd871b5698bdfba048bd4d140c83a722193c8c03` |
| World replay manifest | `b1fec59480c07ebac53cdd89fdf6597f4fb9b5cc42cc96f84cdc695e409df8ef` |
| Exact resource stream in both lanes | `544fd5c1c440d156f4c50b266ea61bb63ac9d25d35144a70af4965f69942729f` |
| Public-safe index | `57275e1d727c62b796828fede102e75c279294d65f09d1a6cef667a1af09926c` |

## Integration

Implementation is the single commit `56e28fce` atop the already integrated crown
chain. Its runner edits add only the independent optional election probe, not a
new base commit observer or positional witness argument. Merge those hook lines
into the current composed car/NPC/boat factory; do not replace the newer factory.
The callback uses the existing raw diagnostic pool, obtains the witness inside
the existing failure-retaining `try`, passes `seasonElectionProvenance` to the
shared journal and writes its restricted artifact/hash. The probe must install
before production imports and restore after capture.

The final integrated source requires its own fresh native retest. Full resource,
general ranking/cache concurrency, long seasonal duration, deployment and 225-cell
matrix qualification remain open.
