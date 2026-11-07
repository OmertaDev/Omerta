# Questing backend focused review

Reviewed 2026-11-06, completed 22:58 UTC including the format-validation follow-up. Phase: working-tree source before production activation. Base revision: `e56cf576065c5f1bbb9bb55115f5961267f7d654`; tree dirty, including substantial pre-existing work. Conclusions apply to the hashes below, not every change at that revision.

## Scope and model

Following [the review policy](../omerta-contracts/SECURITY-REVIEW-POLICY.md), this pass covered narrative activation/validation, issued actions and private projections, structured-answer verification, invitation membership/consent, shared notes, voluntary handoffs, workshop authoring/publication/solving/ratings, reading-room exercises, and their HTTP/schema contracts. Dependencies inspected: `withCharacter`/`readCharacter` transaction and identity boundaries; the content, workshop, and reading-room table definitions. UI rendering, contracts, tokenomics, deployment configuration, and the remainder of the shared dependencies were excluded.

Bearer middleware supplies account identity. Narrative bundles are operator-promoted and hash/version pinned; clients select issued actions, answers, roles, and explicit invitees, never scope IDs or economic effects. Instance row locks plus revisions serialize narrative transitions. Server-derived organization snapshots restrict invitation accounts; current membership, participant kind, consent, and distinct-organization quorum are rechecked. Role-private prompts/evidence/objectives stay scoped; completed debriefs intentionally reveal objectives. Release deletes only the caller's seat and retains completed-node provenance and append-only handoff facts. Notes are bounded, participant-only, explicitly untrusted data.

Workshop definitions use fixed templates/clues, a unique-solution check, private author drafts, owner-only publication, account-serialized author caps, and solved-only ratings. Daily reading exercises derive their identity and solution server-side. These services and narrative rewards add no currency transfers or combat power. Existing character persistence remains a shared dependency.

## Methods and findings

Adapted methods, not claims that upstream orchestration ran: Pashov senior-auditor concrete execution traces/inversion at `c577eb7799c349de0acb187ba00ca98e14e436fd`; Plamen write/read invariant comparison and executed-proof distinction at `795962b96e254f2e423a2635fe7f8cb8ea1e6d69`; Trail of Bits context/trust-boundary and web-service dependency tracing at `d3323cefbcf645678b8dc481de204b02ad3d02dc`. Local checkout pins matched the policy. Native JavaScript checks replaced Solidity-specific tooling; payment callbacks, rounding, and contract reentrancy are outside this scope.

| ID | Finding and disposition |
| --- | --- |
| QREV-01 | **Medium, resolved:** authored world-fact keys could occupy `runtime.*`, the namespace used for invitation/notes/handoff metadata. Pre-fix activation validation accepted a forged invitation key. Compiler validation now rejects reserved keys; cascade also refuses such writes. This is an operator-promoted-content boundary defect; no ordinary-player or production exploit is claimed. |
| QREV-02 | **Medium, resolved:** passive-node gates were validated but never evaluated by cascade. Pre-fix validation accepted an unevaluated terminal story gate. Activation now restricts gates to the entry and actionable nodes; cascade rejects unsupported pinned declarations. No current pack used passive gates. |
| QREV-03 | **Low, resolved:** a `completed_node` gate explanation could reveal another role's private node identifier. Explanations now omit foreign private references while retaining the safe readiness result. |
| QREV-04 | **Low, resolved:** Fastify's array/type coercion admitted scalar `submission.ids` and `invitedAccountIds`, contrary to the strict input contract. Root reproduced these reaching the DB handler before the fix. Recursive raw-type checks now reject wrong arrays, items, and map values before AJV coercion. The HTTP item/slot cap now matches the verifier's 64, and authored structured IDs are capped at the API's 160 characters. Positive-160, negative-161, 65-item, and raw-coercion regressions pass. |

Pre-fix compiler hash: `3cb025c126084ce46a7de8dd6639e194447cf4072532db161c2c4cd3c333990b`; runtime hash: `e3a1eb00018f862370515d7af4499e7a18d6d3fc98a47ec022ca797eb54cd408`. Structural acceptance was executed before remediation; regression rejection and private-reference checks passed afterward. The reserved-key impact follows the shared write/read authority trace; a deployed takeover was not simulated.

## Verification and limits

[Retained output](questing-review-evidence.txt), SHA-256 `21731e77e682cc0f740fb452c79e17c34a350704305c414a9af378ad62cd51ea`, records exit-zero runs of `content-narrative-security`, `content-narrative`, `content-casework`, `content-graph`, `content-api`, `quest-workshop`, and `quest-saga`, plus the final API/security retest after QREV-04. Coverage includes 47 exhaustive small-domain answer checks, malformed requests, stale authority, hidden information, explicit consent, cross-organization membership changes, replacement provenance, branch recovery, legacy continuity, claimed rewards, and economic neutrality. Narrative/social play responses were checked against the public JSON schemas. Node v24.19.0, Fastify 5.12.5, pg-mem 3.0.14.

Static triage: ten JavaScript syntax checks passed; bounded searches found no dynamic evaluation or child-process execution in the inspected runtime/services. Workshop SQL interpolation constructs bounded `$n` placeholders; values remain parameters. No full static analyzer or stateful fuzzer ran.

**Remaining evidence gap:** `DATABASE_URL`, `psql`, `postgres`, and `pg_ctl` were unavailable. PostgreSQL locking, rollback, persistence across process restarts, and simultaneous cross-account membership changes were not proven by pg-mem. Source-level regressions pass, with no unresolved critical/high finding identified in this bounded pass. This report is neither production concurrency clearance nor activation authorization.

## Final source pins (SHA-256)

| File | Hash |
| --- | --- |
| `src/content/runtime.js` | `a6e50a80acac7ee519c9a6a4fffc03058df8c35432b3af91bb3e4b027921ba2f` |
| `src/content/compiler.js` | `bc060d8ec54707388b23e7eacde4b9edc9a07c92893f20107b4eccfc450e1216` |
| `src/content/narrative.js` | `5259245371f6786d8a530c0d6eb03528acceb3f0105d2c2031bbd75a25781b9d` |
| `src/quest-workshop.js` | `05d967680ec9da9449a7e400faae6d45d5852b794d29ddcce9bf400a73a2f530` |
| `src/questing.js` | `11bf4829e5546042190e1da0c7134331de89a409df2c92da6d812ffbd30413f6` |
| `src/routes/content.js` | `f47fb6461d61f2806a2282612ceeab9661fad05dda02593df8ded96651481f10` |
| `src/routes/quest-workshop.js` | `63f2afc0242759cbb288e144d2126268b2fc042f1dfecb1d1ebb7eb587e0081b` |
| `src/routes/questing.js` | `27beabb502911baad8f7c3ddae6e4ded3ab9bbcb1ac1edfaa7f78dbb94974b82` |
| `src/questing-contract.js` | `62cda9002950d4965be372577426ea286738086534c693576a17391313976115` |
| `src/agentgateway.js` | `ef95da5a89419e26ecbc8180262538417b3de51aea0c93589b5c3f2155ff1444` |
| `src/quest-workshop-schema.js` | `76053b8399ad437352168ba822be0d3aecac3dcbdbd0c6a08e9fb80d614eb50e` |
| `schema.sql` (relevant tables only reviewed) | `92f3c7f50d706358d3813dcb568345d65ece93d28bbcd9349ac45cda830338b4` |
| `src/game.js` (identity/transaction boundary only reviewed) | `f2fe7f389308ebabbeb1f713fbe047725f87fcd2f5ff11d925164ad22c96cecd` |

## Current-main release port follow-up — 2026-11-07 UTC

The isolated release worktree is based on `17fdf85fdd21fd3767463df8ba47614f7d1f6432`. The preceding review and evidence remain bounded to their original revision and hashes. This follow-up records the port and its integration checks, not a blanket review of intervening main changes.

Runtime/compiler and the existing API test had unchanged base blobs and received the quest changes. Gateway changes were restricted to named Content sections plus quest imports, spreads, and tags; reversing those changes reproduced every other current-main line exactly after newline normalization. The current-main exchange `requireKnown:false` safeguard and workspace namespaces were preserved; only the `quests` workspace namespace was added.

Economic helpers and contract sources are unchanged from current main. Its tokenomics pilot (16 groups) and deed reimport checks pass unchanged in memory; the original-checkout fixes were not ported. Release API, narrative, casework, narrative-security, and connected-saga checks pass, including strict schema validation and 47 exhaustive answer checks. `node tools/sim.js` exits zero: its accounting invariants hold over the earned economy. `worldgraph:check` passes with 25 packages, 193 nodes, five recipes, zero OMR authority/cash rewards, and its existing sinkless `mat:wire` warning; content hash `bc89a2128c0f5ef931035cf55720a43a9c474ff6cf291a33c5c6c0caea0e91d9`. PostgreSQL concurrency and production activation remain outside these in-memory checks.

Final release file hashes (supporting schema/game scope remains limited as above):

| File | SHA-256 |
| --- | --- |
| `src/content/runtime.js` | `a6e50a80acac7ee519c9a6a4fffc03058df8c35432b3af91bb3e4b027921ba2f` |
| `src/content/compiler.js` | `bc060d8ec54707388b23e7eacde4b9edc9a07c92893f20107b4eccfc450e1216` |
| `src/content/narrative.js` | `5259245371f6786d8a530c0d6eb03528acceb3f0105d2c2031bbd75a25781b9d` |
| `src/quest-workshop.js` | `05d967680ec9da9449a7e400faae6d45d5852b794d29ddcce9bf400a73a2f530` |
| `src/questing.js` | `11bf4829e5546042190e1da0c7134331de89a409df2c92da6d812ffbd30413f6` |
| `src/routes/content.js` | `32d63c6e6e10eb4c03aca92d4b42aece56f122ea94d5627131b497902e76930a` |
| `src/routes/quest-workshop.js` | `63f2afc0242759cbb288e144d2126268b2fc042f1dfecb1d1ebb7eb587e0081b` |
| `src/routes/questing.js` | `27beabb502911baad8f7c3ddae6e4ded3ab9bbcb1ac1edfaa7f78dbb94974b82` |
| `src/questing-contract.js` | `62cda9002950d4965be372577426ea286738086534c693576a17391313976115` |
| `src/agentgateway.js` | `e5787e766f341c2f83aaff1cdef79188daa68c52df19990804fd53989f45bcea` |
| `src/quest-workshop-schema.js` | `76053b8399ad437352168ba822be0d3aecac3dcbdbd0c6a08e9fb80d614eb50e` |
| `schema.sql` | `90b44532991cabcb1bcc16db39575d9f73eec24501ff7e7aea4f07987f866e53` |
| `src/game.js` | `bf9fe31aebf2db2aa54db874dc1a9af3dfbf292d041c9e73310c818f41891cab` |


## Release qualification follow-up — 2026-11-07 UTC

The workshop board now uses literal locked/unlocked reads and two fixed fifty-slot parameter lists, padded with NULL for its existing fifty-entry page. The optional fixture bootstrap emits four literal DDL statements; production continues to use schema.sql. The workshop test passes. The shared SQL scanner records 172/173 unmodeled interpolations and 44/44 unmodeled nonliteral arguments, with no workshop statements in either unchecked category. Guard ceilings are unchanged.

Canonical LF SHA-256 pins for this follow-up (earlier physical-byte review pins remain historical):

- `src/quest-workshop.js`: `c54932679505b1c6b02ad5094d795e2dc6a6966239bbd38f3f03905ed74b751d`
- `src/quest-workshop-schema.js`: `9bbf299a7ac7573c8d0770c140dd7841b2996c54a983278b71dbc768e381c70c`
- `schema.sql`: `af6d9ad01566eaddf8ec6b4c4da4add77837b13e6a3510697bebf62b180b97e7`

The PostgreSQL quest fixture now uses the production migration entry point in its isolated schema. The new enterprise qualifier preserves the previous input inventory, manifests and strict sixteen-case execution guards, while binding a separate current input declaration. Source-comparison inverses qualify exact new bytes before reconstructing older comparison text. These source records do not transfer native test results, financial clearance, activation status or deployment status; fresh native and release checks remain required.
