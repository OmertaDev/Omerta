# City encounter producer review

Pre-release source base: `425c4ba9c9c0e522d4b7c0e09c2f67ca86df0f40`, dirty working tree. Scope: public current-district pagination, private encounter producer, additive private progress table, route registration/OpenAPI, and focused tests. GUI, preexisting mystery authority, economic/gameplay adapters, contracts, signers, production configuration and deployment are excluded. The chain startup guard is unchanged.

The pinned methods in `omerta-contracts/SECURITY-REVIEW-POLICY.md` were adapted to ownership/access-control traces, callback/replay domains and state/accounting invariants, followed by specification comparison and false-positive triage. No upstream orchestrator, SAST suite, Solidity proof or blanket audit is claimed. There are no external calls, financial transfers or recipient callbacks in this producer.

The authentication subject selects the authoritative living character. Supplied IDs/generation/district are preconditions, never owner authority. `withItemTransaction` owns commit/rollback and pg-mem compensation; `withItemMutation` reserves a user-scoped, body/target-bound `world_action` replay guard before the producer's sorted character locks. Inspection confirmed the shared guard does not lock the viewer character first. Account/monetary rows are read for the public agent flag only and are not locked or mutated. Private progress is keyed by character plus generation; only this module writes it. Generic mystery completion has no producer access. Exactly three bounded objective transitions accompany a monotonic safe-integer sequence and 32 recent cards. Older replay results are retained by the existing receipt mechanism.

Public DTOs omit account identifiers, private balances/state, relationships, hidden objectives and coordinates. NPC classification takes precedence over an overlapping agent flag. Historical card provenance is a disclosed public snapshot, not current tracking or attributed human speech. Existing HTTP cached replies retain their original viewer stamp; client generation checks remain necessary before displaying that historical receipt.

Executed locally with Node `v24.19.0` on 2026-10-10:

- `node test/city-presence.js`: PASS on disposable pg-mem; all actor types/pagination, DTO privacy, identity/target/death/district/generation denial, exact replay and changed-target binding, real objective transitions, continued collection/cap, post-write receipt interruption/compensation, successor isolation and unchanged resource/ledger/contact/call snapshots.
- `node test/city-presence-api.js`: PASS; real mounted authentication, private cache including replay, byte-exact HTTP replay/422 changed target, closed body, generic mystery bypass denial plus a valid independent story action, unexposed future objective IDs, current-generation isolation and OpenAPI contract.
- `node test/routes.js`: PASS, 882 registrations/833 under `/v1`, existing public exceptions unchanged and no duplicate/unbound routes.
- Syntax checks for the new module/route and OpenAPI module, plus focused `git diff --check`: PASS.

**Open verification:** `node test/city-presence.js --postgres` must run against an explicitly disposable loopback endpoint before release. Its two-backend BEGIN barrier exercises concurrent exact-key replay and opposite-direction actor locks, traces actual lock order/no economic locks, verifies post-write rollback and resource neutrality. No local PostgreSQL endpoint or server executable is available; pg-mem does not establish native transaction/locking correctness. Required release CI remains separate. This review is not production clearance until native verification and final integrated source checks pass.

Retained correction evidence: CP-01, the first HTTP test exposed a synchronous Fastify validation hook that did not complete; the hook was made asynchronous and the full HTTP regression passed. CP-02, receipt interruption injection initially missed multiline SQL; corrected injection proves compensation after the private write. Both were test-time findings, fixed before source review. No unresolved concrete authority/privacy finding is identified in this exact scope; native execution remains explicitly open.

## Integrated player UI review

The integrated UI was reviewed independently from its authors for access control, replay, stale response ordering, private data lifetime, and input/focus boundaries. Existing financial actions, Discovery classification, chain startup assertion, and generic operation defaults are excluded from new authority. The visible view switch reuses the existing navigation/entry lifecycle; public map placement is approximate, and intel writes require an explicit issued encounter action.

Four P2 findings were retained and corrected before release:

- CP-03: a historical exact-key receipt could roll newer journal/objective state backward and invalidate a newer read. Same-generation total encounter sequence is now monotonic in the UI; rejected older receipts do not advance its read revision.
- CP-04: an earlier keyset page's changed boundary could let a downstream cached actor overwrite a winning fresh generation/action. Changing that boundary invalidates downstream pages before rebuilding the roster.
- CP-05: generic key-reuse recovery intentionally starts a fresh move. Private encounter Retry now requires explicit same-key recovery metadata; it cannot disguise that generic branch as a retry.
- CP-06: completed private encounter data could remain in Last Word/shared receipts after an account or character transition in the same browser realm. Opted responses and receipts retain their scope predicate; invalid scopes are cleared or filtered during projection and screen teardown.

The final focused real-server presence browser harness passed locally: historical replay after another client advances progress preserves a held newer read and its objective state; changed-page overlap retains the winning issuer generation; real HTTP422 key-reuse refusal provides no private new-key Retry; a real successor-character creation in the same JavaScript realm retires prior private state and controls. It also verifies read-only inspection, exact replay, queued close cancellation, dispatched-close recovery, actual touch/keyboard controls, outside-canvas scrolling, pose/camera geometry and engine fallback. Release still requires both native PostgreSQL lanes and required hosted checks on the final integrated head.

CP-07: the changed-page regression exposed that explicit Refresh only refreshed the player projection when the viewer stayed unchanged. The Map now schedules its existing read coordinator after a successful explicit refresh, guarded by the captured session, identity and navigation. Shared refresh, action and poll behavior is unchanged. Independent review cleared index blob `3a2b5cece82d4b4a1a03d22b9343c44e73989401`; the real-button regression retains its response and winning-generation assertions.

The final legacy City journey and visible-toggle regressions also passed on these GUI sources, alongside client/projection, Fieldwork and 179 global phone checks. Independent final renderer/test review found no actionable issue at scene blob `bd3e29120308d99f8474c0d96205a0b398522a3f`, CSS `a1641f6ef8c23e91a573bb1b89d9a514bb4f6992`, and presence browser test `46f9b61c9125d190b9ae0982a2d29999a25c645c`. Receipt strings and names render as text; controlled player fixtures are disposable and no production gameplay was performed.

| Working-tree file | SHA256 |
| --- | --- |
| src/city-presence.js | fca0bc8398a47a469eee8f832e9df46b286023366cb15e82752ecbd867b1544a |
| src/routes/city.js | 32d11e341078fd5b157b19e397aa16ed99b91b6842cd039cbd615d95fc065504 |
| schema.sql | 2d67703172d303ba301db764c8e4f410c3bd797db0b28bd511343b837061400b |
| src/server.js | 14a3d2e291bbe99ead54d8850850703a319ad3926d1941d34469e135f8c23820 |
| src/agentgateway.js | 107f9d1388848986e5dc8b53d3a7bc5b7bc90568591c3409f7e6ebb85c5dc714 |
| test/city-presence.js | e146044e2ce871f9b3fbd4da21d889b9df9e5da741b338fa51bc26cfc2586847 |
| test/city-presence-api.js | 0db092434d91ed51d753a83932c61ec7855e2901a737740685e6a6fc3770f41d |
