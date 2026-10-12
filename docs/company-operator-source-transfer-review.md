# Company operator source transfer review — 2026-10-12

Adapter implementation: `b137cf9d0edbe675fb4781e01ee36fa3730a9deb`.
Frozen runtime/base: `1d49ba542f98ac7aff8c171ea0d307e5e7609fa6`.
Complete runtime predecessor: `727df2f02b2d0e5031b4c5a4516144de67aba0a8`.
Phase: source-guard integration only. Financial activation remains OFF.

## Exact reviewed source boundary

The runtime differs from the complete predecessor in exactly four Git diff hunks:
server operator import and registration; worker runner import and its independent,
bounded 30-second scheduler. No runtime file was edited by this task. The new adapter
first validates the **complete** normalized SHA-256 and Git blob of each file, then
requires each complete diff hunk exactly once, applies its frozen inverse, and verifies
the complete predecessor SHA-256 and Git blob. Only CRLF→LF normalization is allowed.
Unknown bytes are never stripped by pattern or manufactured into historical source.

| File | Frozen current SHA-256 | Complete predecessor SHA-256 |
| --- | --- | --- |
| `src/server.js` | `b14c214336686192ab44fa84a1aec991b628ec551fcec129f8f584238b4a1068` | `8cc6baca8f1c019bb507afb45d1f62838749e0208d4d61bb05b23d28ebc84b55` |
| `src/worker.js` | `0b854f2da5f8e118408fac5c6570b4d64de5a9c854d2b06a1f47dcb6d57aec1a` | `fd3acb85be133917dd933cd74acd112452aacddd6de5f59f2c98c6fca414d51c` |

Current Git blobs are server `e0786401d991101ed47d949747b8603b512ec882`
and worker `c0281af8d4bc0101b805e082e5f0a3a04b7a4517`.
Predecessor blobs are server `c90f24dcea1a29e5ca257ae3ec365f8b022785f5`
and worker `f0c808dc5e48364e2286b1ce1a2670b77ba85192`.

The new outer envelope composes with the unchanged historical Home/League/Feed/
Succession/Strategy/Coverage/Invoice/Intel and older guard chains. Their original pins,
inverses, complete-blob checks, negative controls, and CRLF controls remain in place.
The World Recovery review declaration advances from version 23 to 24 solely to record
this scoped source transfer; its historical source-file pins and qualification rules
are unchanged. Tests compare current and complete-predecessor verification results
and require exact historical parity.

## Adapter inventory and callers

New files: `tools/rc1-company-operator-source-compatibility.js` and its test.
Existing adapters changed: the common Home composition plus five existing deed master/
Economy entry points in `tools/rc1-deed-source-compatibility.js`; the **worker-only**
outer transfer in `tools/rc1-intel-source-compatibility.js`; and the declared World
Recovery entry in `tools/rc1-world-qualification.js`.

Only direct known-current test fixture reads needed adaptation: Intel, Invoice,
Strategy League, car-melt provenance, World Recovery, and World duration evidence.
The duration fixture still checks its original Intel pin after exact outer
reconstruction, and retains its existing time/budget/replay/semantic controls.

Caller inspection used `rg` across tools/tests. The central worker-only Intel envelope
covers `tools/rc1-native-worker.js`, `tools/rc1-world-duration-evidence.js`, backlog review,
and economy metrics without editing their execution or measurement behavior. Their
worker maps have no server entry. Duel selection provenance hashes its actual complete
worker witness dynamically and retains its exact SQL/site checks; it needs no adapter.
The resource observer has state hashes rather than a separate frozen worker source pin.
No additional caller adapter remains necessary for this frozen runtime and checked
source-consumer inventory. Future runtime drift requires a new source review.

## Review method and findings

Applied direct pinned-reference adaptations from the repository security policy:
pashov/skills `c577eb7799c349de0acb187ba00ca98e14e436fd` trust-boundary/inversion
review; PlamenTSV/plamen `795962b96e254f2e423a2635fe7f8cb8ea1e6d69` source-trace
and reproducible hypothesis separation; trailofbits/skills
`d3323cefbcf645678b8dc481de204b02ad3d02dc` context mapping and invariant/property
guidance. Adaptation was one agent, direct JavaScript/Git source inspection and executed
assertion controls; no upstream orchestration or Solidity/financial audit is claimed.

Separate passes covered full-file input authority; exact unique inverse ordering;
closed file domains and prototype-name rejection; historical scope/provenance; newline
normalization; central imports/cycles; and direct consumer pins. Static triage found no
generic stripping, broad regex relaxation, caller code/URL evaluation, runtime edits,
financial calls, or new time/replay/budget semantics.

| ID | Disposition | Evidence |
| --- | --- | --- |
| TRANSFER-001 | Resolved integration failure | Duration fixture directly compared the outer worker with the original Intel current pin. Exact outer reconstruction now precedes the unchanged assertion; three new operator drift controls and the original duration controls pass. The pre-adapter pin failure is reproduced and retained. |
| TRANSFER-002 | Invalidated broad-leaf proposal | Some historical leaf entry points never accepted the complete latest Home/Intel envelope. Speculative additions were removed; only demonstrated supported master/consumer adapters remain. No unsupported historical leaf qualification was expanded. |
| TRANSFER-003 | Invalidated unknown-source hypothesis | Missing/duplicate/reordered hunks, context drift, full-file prefix/suffix, auth-registration drift, runner limit and scheduler cadence/order changes fail closed. Unknown inputs pass unchanged into their original rejecting historical guard. |

No unresolved in-scope critical/high finding was confirmed. The source transfer does
**not** qualify new operator authority, owner consent, account/depot replay digest,
runner lifecycle, cadence, locking, or recovery. Those require the coordinator's
separate current-source operator proofs. It adds no world-soak, native, financial,
deployment, or on-chain qualification.

## Executed checks and retained evidence

Node `v24.19.0`; all following tests passed, exit 0:

```
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
```

The new suite proves four exact Git hunks and 28 explicit complete-file comparisons:
four SHA-256 pins, four Git blob hashes, and 20 complete-text comparisons. It executes
24 mutation controls plus unknown file, LF/CRLF, complete historical parity, supported
master consumer, and central worker transfer checks. Intel keeps its original 34
negative controls and adds four outer-worker controls. Existing duration tests retain
10 schedule, eight Intel, and seven Coverage controls, plus three outer-worker controls.

`node --check` passed for all four touched source-guard tools; `git diff --check` passed.
The runtime diff against frozen `1d49...` is empty. Tests with “native” in their filename
ran their unit/default mode only; no PostgreSQL world run or financial qualification
was executed here. Logs, the retained pre-adapter failure, source/blob/hash manifest,
and retest inventory are under ignored `output/company-operator-source-transfer/`.

Ready for coordinator source-guard integration. Package/gates, census/KG, release-wide
checks, runtime operator proofs, deployment and activation remain coordinator-owned.
