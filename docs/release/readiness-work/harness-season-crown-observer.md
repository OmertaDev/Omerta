# Stored season crown observer

Native source: `e1caae3783c808015c2da84bddd2682fa1b83584`, based on the
previous conversion observer at `a3ca3a619ff0d640b9fe24361722063fb771b4ff`.
No production files or world-runner behavior changed. This source was clean and
unchanged throughout the tests below (PostgreSQL 18.4, Node 24.19.0, Windows x64).

The observer adds the complete `notifications` table to its read-only snapshot
(59 tables here). One previously saved, uncrowned `season_records` intent must
be claimed without changing its contents, its exact account must gain one crown,
and its unique living character must receive exactly one fresh canonical notice.
The notice's raw JSON, season, standing, owner, defaults and timestamp are checked;
old notices and intents cannot be changed, removed or reused. Other account/table
changes make the compound boundary explicitly unsupported. Normal notices and
monotone acknowledgement flags are metadata only, not reward or delivery proof.

Initial winner selection remains **unsupported**: this component does not derive
eligibility, ranking cache contents, or tied native ordering from a saved winner.
Empty/ambiguous owners and compound awards also remain outside the proved subset.

## Checks and native results

`node test/rc1-season-crown-journal.js` passes 33 rejection controls and eight
explicit unsupported branches. Positive controls cover saved null, zero, and
nonzero standings; exact repeated state cannot award twice. Existing conversion,
resource, car, melt-provenance and serialization controls also pass.

```text
COORDINATION_TEST_DATABASE_URL=<explicit local control PostgreSQL URL>
RC1_CROWN_OUTPUT=<new restricted output directory>
node test/rc1-native-season-crown-controls.js --postgres
```

The focused native test creates one ordinary guest/character through HTTP and
awaits the original response hooks. The original `runSeasonRollover` uses its
existing explicit season option. Two actual PostgreSQL trigger faults separately
reject the account crown update and notice insert. The same pending record then
retries successfully: one positive player crown and one notice, with all canonical
tables/sequences unchanged by the final exact retry. The notice failure also
preserves complete state. All 32 observed native boundaries are retained (two
rollbacks); six corruptions of the actual captured inputs reject. The only
unknown is initial winner selection. This focused test does not claim elapsed
seasonal duration or a complete worker schedule.

The separate existing `test/rc1-season-recovery.js --postgres` passes its five
cases, including concurrent duplicate claims and a lost native COMMIT response.
It uses `RC1_SEASON_OUTPUT` for its fresh output. Its concurrency result is separate
from this serial per-boundary observer.

An unchanged-limit two-hour `quiet_world`, population 25, seed `rc1-alpha`,
resource-enabled gzip observation/fresh replay also passes. Its roster uses the
existing synthetic schema-default player initialization, distinct from the
focused HTTP entry above. Two actors participate in two sessions, eight fresh
PlayerCommands and two successful crimes. All original due callbacks execute:
24 Director, 24 health, two hourly and two season callbacks. One non-NPC actor
receives the actual stored crown +1 at logical `2026-09-24T00:00:00.000Z`.
Four NPC conversions gain 24 prestige; 25 player conversions remain zero-gain
status records. Crossing this boundary is not an applicable multi-season proof.

Independent verification compares all 18 replay fields, complete initial/final
canonical tables and sequences, and all 1,085 resource journal entries byte for
byte. Each run retains 139,795 zero-drift equations and 15 unsupported occurrences:
six car acquisition identities, two NPC formations, two receipt reasons, two
Family lineages, two memberships and one initial season election. All four
successful-run databases are independently confirmed absent. No full-resource or
matrix qualification is asserted.

## Retained failure and evidence

RC1-TOOL-57 at `d00e5575f06004b28e3512ad2df9a30ac7052584` remains an overall
sealed **FAIL**. The old test name ended in `observer.js`, which also ends in
`server.js`, triggering the original API main guard and leaving an extra pool
during cleanup. The repair only renames the entry to `controls.js` and asserts
that it cannot match server/worker entry suffixes. No production guard changed.
The exact owned process was identified and stopped; the abandoned database was
dumped, then removed only after exact OID/ownership-marker/zero-backend checks,
without FORCE. Its dump SHA256 is
`537ad9dfab1a3ffb6eb88c90d3476b575293713d0452835ed75dd954f1b82d70`;
this is postfailure custody, not restoration of the first failure state.

Restricted evidence directories are `season-crown-d00e5575-1` and
`season-crown-e1caae37-1` beneath `rc1-readiness-private-20260921`.
Exact commands, finite guardrails, manifests, snapshots, traces, original failure,
and independent audit scripts/results are retained. The
[139-file index](harness-season-crown-index.json) covers 20,270,116 bytes;
SHA256 `9b3138ea7c5f5ee4970454af5550059d9543da91b64609a8ce7d075f18d67138`.

| Artifact | SHA256 |
| --- | --- |
| Focused native manifest | `86fe009a4846af3e7d641eff7482cf23131246c0e5a8038a30c1901a6c873e9c` |
| Seasonal recovery manifest | `ddfcb34e5237ee1866756069edd2429ca8dcb535ad805a76cfe6af9d96532cfb` |
| World observation manifest | `9d871816ace00aaefdfc3a44dea22b19d4d5f1067864605f1f86f203d1b74a1a` |
| Fresh replay manifest | `6d9bd11feaf1846fb7de704efc3cfd9bae8639285d910241395acc74c5353db8` |
| Exact shared resource stream | `333af9c1ba3ee7719d501c2e94b63c353edcbbd889dbac848bea6db25f55cda8` |
| Independent world audit | `9b1ef321510556fa84df452099fbebe04a863c5a475f80beb498772fccb37d26` |

The report commit follows sealed verification and does not change its source
identity. Later integration requires fresh source-specific gates and world replay.
