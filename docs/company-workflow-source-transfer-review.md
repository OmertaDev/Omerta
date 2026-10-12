# Company workflow source-transfer review — 2026-10-12

Implementation: `0872636a36190938a398f5adbe7da945677dae3a`.
Frozen runtime: `14ba455061b39720c6cee238f42700c431d0229c`.
Complete N02 predecessor: `ad19f1c98263e15566105380e580bf87eebca4df`.
Phase: exact historical source transfer only; financial activation remains OFF.

The branch starts at frozen `14ba...`. Only the authorized N02 source/review dependencies
were cherry-picked: `c401841ce115a9dd6ef80b82997c7117c189de18` →
`676a527d5999851645bf9880f495403daa62ebbb` and
`896294644110badad348fb408b9da2725688a3b1` →
`8518cd22f984c82977294e0840432638fb51d443`.
No package dependency was cherry-picked. Runtime, modules, schema, package, CI,
census and KG remain unchanged from the frozen base.

## Complete frozen source envelopes

Eight actual Git diff hunks cover server import/registration, worker import and bounded
runner invocation in the existing independent clock, invariant import/provenance check,
and estate import/closure hook: two complete hunks per file. The guard validates both
the complete normalized SHA-256 and Git blob before applying each exact unique inverse,
then validates both complete predecessor hashes. Unknown bytes never become historical
bytes; only CRLF→LF normalization is permitted.

| Source | Current SHA-256 | Complete N02 predecessor SHA-256 |
| --- | --- | --- |
| `src/server.js` | `50acd3201643b7894118b09bc205c2111e7ef3412e2577da038e5d91c4144799` | `4c846a3c298b79326247f0c4f8d1c93b96ed0517bc46a4a8f8116c975bf65ffe` |
| `src/worker.js` | `90fa69c5a267c8f3077ca50aafbed54bace56ee09995ed0741a115baa51a2e79` | `0b854f2da5f8e118408fac5c6570b4d64de5a9c854d2b06a1f47dcb6d57aec1a` |
| `src/invariants.js` | `80c0505cdc977a0e03384a6c693951b77ea70f18a3100a56a9415492794962da` | `d258b398bea2a6df93cff40d57f9d589edf4f4eaad0e5258ec2c0c13e7598c80` |
| `src/social/estate.js` | `f1fd519c369a72db8c5f01ab23dab185a2d5dc4456cde17997f56683972856d8` | `d5eeac4dbd2634c46066cc094d90fbba64431c3f4c656053af1191e02875807f` |

Current Git blobs, respectively:
`6a33f252ac499d32f1bc4ef2d78613819097c3f8`,
`11afe18bb1e5db0d58f9bd0aef9a708c83c63c44`,
`693a2e0d8ac7c297848b7e004d8932cad988892b`,
`17aa4d3c03f95c9a956dd408fd7b3784494ce153`.
Predecessor blobs:
`1b1320617f4c5a15d2b4648e50dc0a0355536d96`,
`c0281af8d4bc0101b805e082e5f0a3a04b7a4517`,
`fd01b04d0304280379f83e2f79d92d4c7e7dbee5`,
`77460c876a854ceb979f80d4033c70bb2e20f6bb`.

Every current file is also compared completely with runtime revision
`129ab229990c2b9c0d3a460ed75f731081fd1f5c`. Raw filesystem CRLF hashes and canonical
LF pins are separately labeled in the retained manifest.

## Composition and qualification boundary

The new pure Workflow guard depends only on Node assert/crypto. The Employment
baseline composes Workflow first, before its existing N02/N01/history chain.
Deed master/Economy and invariant Backlog/Franchise entries retain distinct Workflow
outer metadata and exactly unchanged original Employment/N01 transfer objects.
The Intel worker dispatcher reconstructs complete N02 worker bytes before its existing
N01/Intel guards, preserving their original metadata and scope. No import cycle is added.

Only known-current fixture reads in the N02, Intel worker and duration tests need outer
normalization. Every original pin, full-blob assertion, unknown/missing/duplicate/context
negative and CRLF control remains. World Recovery declaration version 26 records the
Workflow transfer. Its **historical sourceFiles domain and qualification rules remain
unchanged**, including the fact that it does not itself check invariant/estate files;
those retain dedicated closed source guards and the new full Workflow envelope.

This transfer does not qualify workflow consent, actual source/payment provenance,
private API, worker authority, retries, concurrency or death behavior. The coordinator's
separate current-source API/worker/native proofs cover those behaviors. No historical
world-soak, native, financial, deployment or on-chain qualification is inherited.

## Methods, findings and executed checks

Direct pinned-reference adaptations: pashov/skills
`c577eb7799c349de0acb187ba00ca98e14e436fd` trust/inversion review;
PlamenTSV/plamen `795962b96e254f2e423a2635fe7f8cb8ea1e6d69` source tracing and
reproducible hypothesis separation; trailofbits/skills
`d3323cefbcf645678b8dc481de204b02ad3d02dc` context, property and false-positive
guidance. One agent ran direct Git/JavaScript checks; no upstream orchestration,
runtime financial audit or Solidity qualification is claimed.

Separate passes covered complete input/source authority, exact unique inverse order,
closed file/prototype domains, complete current provenance versus older metadata,
worker cap/cadence/order, caller/import composition and qualification boundaries.
Static triage found exact literal hashes/hunks, no generic stripping, caller code/URL
execution, runtime edits or altered timing/budget/replay/semantic rules.

| ID | Disposition | Evidence |
| --- | --- | --- |
| WF-TRANSFER-001 | Resolved test coverage assumption | Initial negative test wrongly assumed WQ covered invariant/estate files. The old domain is retained; the new envelope plus dedicated old guards reject their drift. The failed assumption is reproduced and retained, without expanding WQ qualification. |
| WF-TRANSFER-002 | Invalidated mixed-provenance hypothesis | Complete Workflow metadata is distinct; original Employment/N01/Intel objects compare exactly with predecessor-input results. Strict N02 assertions reject the new runtime directly. |
| WF-TRANSFER-003 | Invalidated unknown-source hypothesis | Missing/duplicate/reordered/context/full-file/auth/import/worker cap+cadence+order/estate/invariant and older-layer drift reject in all applicable closed guards. |

Node `v24.19.0`. New proof: eight full Git hunks, **61 complete-file comparisons**
(43 complete text, nine SHA-256, nine Git blobs), 47 mutation controls, unknown/prototype
domains, LF/CRLF, full current metadata and exact historical parity. N02 retains its
seven hunks/50 comparisons/36 controls; N01 retains four/28/24, with all older controls.

All 21 commands passed, exit 0:

```
node test/rc1-company-workflow-source-compatibility.js
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
--check` passed. The prohibited runtime/schema/package/CI diff against `14ba...` is
empty. Tests ran source/default/unit modes, not new PostgreSQL/native world execution.
Logs, failure/retest notes, complete raw/LF hashes and blob manifest are retained under
ignored `output/company-workflow-source-transfer/`.

Ready for coordinator guard integration. No remaining adapter is required for the
checked frozen caller inventory. Current workflow behavior proofs, package/pretest,
CI, census/KG, release-wide checks, deployment and activation remain coordinator-owned.
