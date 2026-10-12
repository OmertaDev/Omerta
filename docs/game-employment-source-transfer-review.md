# Game employment source-transfer review — 2026-10-12

Adapter implementation: `ca740d8774bf60120418733a8f876477e6a55c14`.
Frozen current runtime: `ad19f1c98263e15566105380e580bf87eebca4df`.
Complete N01 predecessor: `4bd478a866d36b4fa645c82a9855c551f7816d85`.
Phase: exact historical source transfer only; financial activation remains OFF.

## Exact boundary and scope reconciliation

The original assignment covered two server import/registration hunks. Running the
historical consumers then correctly rejected additional legitimate employment wiring
in `src/invariants.js` and `src/social/estate.js`. The coordinator explicitly extended
the scope to all three frozen files: server two, invariants three, estate two complete
Git diff hunks. No runtime file, schema, package, CI, census or KG was modified here.
The initial eight fail-closed consumer logs are retained alongside successful retests.

The new guard verifies the complete normalized SHA-256 **and Git blob** before applying
each frozen complete hunk inverse exactly once. It then verifies the complete predecessor
SHA-256 and Git blob. Only CRLF→LF normalization is permitted. There is no generic stripping,
broad regex acceptance, unknown-source fallback into historical bytes, or partial-file pin.

| Source | Frozen current SHA-256 | Complete predecessor SHA-256 |
| --- | --- | --- |
| `src/server.js` | `4c846a3c298b79326247f0c4f8d1c93b96ed0517bc46a4a8f8116c975bf65ffe` | `b14c214336686192ab44fa84a1aec991b628ec551fcec129f8f584238b4a1068` |
| `src/invariants.js` | `d258b398bea2a6df93cff40d57f9d589edf4f4eaad0e5258ec2c0c13e7598c80` | `842de0a3927272aace7a262d56159336a0576079f855ae05f7ae111521373bc2` |
| `src/social/estate.js` | `d5eeac4dbd2634c46066cc094d90fbba64431c3f4c656053af1191e02875807f` | `0cbeb5125f2cc7ba542db6ad3d357cb010dc4aff8330c628256687fba7ae45b6` |

Current blobs: server `1b1320617f4c5a15d2b4648e50dc0a0355536d96`,
invariants `fd01b04d0304280379f83e2f79d92d4c7e7dbee5`,
estate `77460c876a854ceb979f80d4033c70bb2e20f6bb`.
Predecessor blobs: server `e0786401d991101ed47d949747b8603b512ec882`,
invariants `03644c4b806b972d93d2500afd1da69c6823abbc`,
estate `e1b23d51ae0e9b77534e06e6df72a4a2f2357cea`.

The server is also completely byte-identical at runtime revisions
`e9d2aa81c4547ec792efa7a75270c8afa98151db` and
`56ccfe6e03c8a1b161e3203179cc0fa2605a6d39`; both full-text comparisons are executed.
`e9d2...` is a revision label, not a file-hash prefix. Raw filesystem CRLF hashes are
recorded separately from canonical LF source pins in the retained manifest.

Worker bytes remain entirely unchanged: N01 SHA-256
`0b854f2da5f8e118408fac5c6570b4d64de5a9c854d2b06a1f47dcb6d57aec1a`,
Git blob `c0281af8d4bc0101b805e082e5f0a3a04b7a4517`. The employment guard rejects the
worker and all other unknown file domains; it adds no worker qualification.

## Composition and ownership

New files are `tools/rc1-game-employment-source-compatibility.js` and its test.
Minimal consumer changes:

* Company operator baseline composes the exact employment envelope before its existing
  N01 guard; strict N01 assert/qualify functions and every original pin remain unchanged.
* Deed master/Economy dispatcher retains a distinct complete employment proof alongside
  the **unchanged original N01 transfer object**. Existing Backlog/Franchise invariant
  entry points accept only the new exact invariant blob before their old chain.
* Invoice baseline composes the exact employment envelope before its existing complete
  League/Feed/Succession/Strategy/Coverage/Invoice chain.
* World Recovery declaration advances from version 24 to 25 solely to declare this
  scoped transfer. Its historical source pins and qualification rules are unchanged.
* Only the direct N01 current-server test fixture and World Recovery version/metadata
  assertions needed updates. Original full-blob, negative and CRLF controls remain.

Import graph remains acyclic: the new pure guard depends only on Node assert/crypto,
and imports no runtime or other source-compatibility module. Caller inspection found
no need to edit Intel, worker loader, duration, lifecycle, backlog/economy measurement,
checkpoint or release semantics. Their original constraints remain in force.

This transfer qualifies only unchanged historical bytes. It does not qualify employment
owner consent, wages/reserves, work authority, private API, estate recovery or current
global reconciliation. Those behaviors have separate coordinator-owned current-source
native/API/estate evidence. No historical world-soak, native, financial, deployment or
on-chain qualification is expanded or inherited.

## Review passes, findings and executed evidence

Direct pinned-reference adaptations: pashov/skills
`c577eb7799c349de0acb187ba00ca98e14e436fd` trust/inversion passes;
PlamenTSV/plamen `795962b96e254f2e423a2635fe7f8cb8ea1e6d69` source traces and
reproducible hypothesis separation; trailofbits/skills
`d3323cefbcf645678b8dc481de204b02ad3d02dc` context mapping, properties and
false-positive checks. One agent used direct Git/JavaScript source inspection and
executed source controls; no upstream orchestration or blanket Solidity audit ran.

Separate passes covered complete input authority, closed domains, exact unique inverse
ordering, preservation of original metadata and pins, newline behavior, caller/import
composition, and financial/native scope boundaries. Static triage found fixed Git
specifications, exact literal maps/hunks, parameter-free source normalization, no runtime
mutation or caller-code execution, and no new timing/budget/replay/semantic acceptance.

| ID | Disposition | Evidence |
| --- | --- | --- |
| EMP-TRANSFER-001 | Resolved scope omission | Server-only assignment omitted actual invariant/estate wiring. Eight historical suites rejected it. Explicitly authorized three-file full-blob inverses now reconstruct complete N01 files; all consumer retests pass. |
| EMP-TRANSFER-002 | Invalidated mixed-provenance hypothesis | Current employment metadata is a separate outer proof; original N01 transfer objects compare exactly with predecessor-input results. Strict N01 assertion still rejects the new employment server directly. |
| EMP-TRANSFER-003 | Invalidated unknown-source hypothesis | Prefix/suffix, missing/duplicate/reordered/context hunks, auth/import, ledger reason, estate arguments and prior N01 hook drift reject. Unknown bytes remain unchanged for the original rejecting guard. |

Node `v24.19.0`. The new suite passes seven actual complete Git hunks, **50 whole-file
comparisons** (36 complete text, seven SHA-256, seven Git blobs), 36 mutation controls,
unknown/prototype domains, LF/CRLF, complete current metadata, unchanged worker,
and exact historical qualification parity. N01 retains its original four hunks,
28 whole-file comparisons and 24 mutation controls, plus every older suite's controls.

All 20 commands passed, exit 0:

```
node test/rc1-game-employment-source-compatibility.js
node test/rc1-company-operator-source-compatibility.js
node test/rc1-intel-source-compatibility.js
node test/rc1-invoice-source-compatibility.js
node test/rc1-loan-source-compatibility.js
node test/rc1-logistics-coverage-source-compatibility.js
node test/rc1-strategy-source-compatibility.js
node test/rc1-company-succession-source-compatibility.js
node test/rc1-market-feed-source-compatibility.js
node test/rc1-strategy-league-source-compatibility.js
node test/rc1-car-melt-provenance.js
node test/rc1-world-qualification.js
node test/rc1-world-duration-evidence.js
node test/rc1-world-backlog-review.js
node test/rc1-world-economy-metrics.js
node test/rc1-native-worker-schedule.js
node test/rc1-checkpoint-recovery-review.js
node test/rc1-world-checkpoint-series.js
node test/rc1-lifecycle-applicability.js
node test/rc1-world-lifecycle-resources.js
```

Syntax checks passed for the five touched tool modules and the new test; `git diff
--check` passed. Runtime/schema/package/CI diff against frozen `ad19...` is empty.
Tests ran default/unit source-consumer modes, not PostgreSQL/native world execution.
Initial failures, successful retests, findings, raw/normalized hashes and blob manifest
are retained under ignored `output/game-employment-source-transfer/`.

Ready for coordinator guard integration. No remaining adapter is required for the
checked frozen caller inventory. Runtime employment proofs, package/pretest, CI,
census/KG, release-wide checks, deployment and activation remain coordinator-owned.
