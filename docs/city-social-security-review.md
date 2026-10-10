# City social producer review

Pre-release source base: `64ff651ce74a5f0c09ec94a6e7fc2fa6bb8b9e5a`, dirty working tree on `codex/city-world-expansion`. Scope: `src/city-social.js`, its closed catalog/HTTP contracts, four mounted private routes, two explicit public GUI asset registrations, the additive private preferences table, owner-only estate/retirement cleanup, and the API/migration qualification additions pinned below. Shared authentication, HTTP receipt and composed transaction helpers were traced but remain unchanged. GUI behavior, existing inventory/equipment and paid estate authority, other chat rooms, chain, economy, production configuration and deployment are excluded from this backend conclusion.

The pinned methods in `omerta-contracts/SECURITY-REVIEW-POLICY.md` were adapted to access-control/execution traces (pashov), protocol state and replay transitions (Plamen), and trust-boundary/specification/invariant comparison with false-positive triage (Trail of Bits). An independent agent reviewed the runtime bytes separately. No upstream orchestrator, whole-project SAST, Solidity proof or blanket audit is claimed; these cosmetic/chat paths have no financial transfer, recipient callback, signer or contract call.

## Authority and storage model

The authentication subject selects the current living character. Supplied character ID, generation and district are freshness preconditions, never owner or room authority. Actor and preference rows are locked for writes. A composed read selects one private snapshot. Real agents are labelled separately, and NPC classification takes precedence; NPCs cannot manufacture participant speech. Existing bearer revocation, account bans, read/write rate buckets and the shared chat flood map are reused. Both-direction phone blocks filter the new room. No separate server mute mechanism exists to inherit.

Preferences are private and keyed by character plus generation. Defaults are Classic, chat off and an empty decorative room. Four free outfits, three finite emotes and four furniture kinds are allowlisted. The room is six by six, contains at most twelve decorations, and rejects duplicate cells, out-of-bounds positions and unsupported rotations. These settings do not grant protection, equipment, inventory, stats or money. A stored district consent is effective only while the character is currently in that district; travelling elsewhere requires joining that district, and a new generation starts off. The existing shared lifecycle helper deletes all preference generations of its owner, preserving other owners and historical message/HTTP receipts.

Nearby messages use only the server-derived `nearby:<current district>` channel in the existing `chat_messages` table. The body is a strict bounded versioned JSON envelope preserving the real sender generation and the actual text/emote command. It contains no account ID. Text uses the existing sanitizer and is stored/returned at most 240 characters. Reads return at most fifty chronological messages and forty joined real participants, omit account IDs and exact coordinates, hide banned/blocked actors, and skip malformed envelopes. The latest real emote is presented for at most ten seconds. Participant placement is explicitly approximate. No message is emitted on the global chat bus; legacy global/family/crew channels and WebSocket subscription semantics are unchanged. Existing seven-day worker retention applies to all channels, including nearby.

Private routes and their errors use `private, no-store` with `Vary: Authorization`. Request bodies and published DTOs remain closed. Only `room` or `text`, declared by an issued action, can be edited by the UI; issued viewer identity remains a precondition. The two public GUI modules are fixed boot-time filenames with the existing MIME, `no-cache`, and unavailable-asset behavior, without user-controlled path traversal.

## Replay and failure boundaries

Both HTTP writes require a printable bounded Idempotency-Key and the existing account/method/path/body-bound reservation. The successful response is finalized through the unchanged shared HTTP helper **inside the same transaction as the preference/chat effect**, and exactly one token-bound pending row must be updated. A zero-row finalizer fails closed and rolls back the effect. The pg-mem path records an inverse for receipt completion as well as preferences/messages; native PostgreSQL owns actual atomicity. Other routes and the shared finalizer are unchanged.

An ambiguous COMMIT returns an uncertain-result 503. If the database committed, both the effect and its successful receipt remain; the later non-success callback cannot delete that finalized row. An exact-key retry returns the stored reply without repeating speech or preference changes, and a changed body returns 422. If the transaction rolled back, its reservation is released and the exact request may execute once. Completed replies are historical snapshots: authentication is rechecked before cached replay, but their old viewer/preferences/message must not be treated as a newer live projection. Integrated clients must retain identity/session guards and refresh the private board after recovery. Receipt-store retention remains the existing shared policy.

## Executed evidence and open qualification

Executed locally with Node `v24.19.0` on 2026-10-10:

- `node test/city-social-api.js`: PASS against a disposable mounted pg-mem server. Real authentication/private headers, default-off consent, ownership/freshness spoof denial, catalog/body closures, free layout validation, actual phone blocks, finite emotes, public provenance/privacy, bounded history, real two-message ordering, travel/generation isolation, revoked/banned access, owner-only all-generation estate cleanup, neutral money/stats/equipment/ledger snapshots and closed typed responses.
- The same API run verifies concurrent same-key requests and distinct-key flood suppression, receipt interruption after the effect, actual reservation deletion yielding zero-row completion and rollback, exact rollback retry, and actual COMMIT execution followed by an injected lost acknowledgement for **both** chat and preferences. It requires a retained 200 receipt, exact cached reply, one message/effect and changed-body 422. These memory results do not prove PostgreSQL locks or atomic commits.
- `node test/routes.js`: PASS; 890 mounted registrations, 839 under `/v1`, the same 48 explicit public exceptions, auth checked both ways, no duplicate or unbound route, and all 64 existing envelope routes preserved.
- `node test/migrate.js`: PASS; repeat schema application and the exact owner-death disposition includes the new private table as wiped. Syntax and focused whitespace checks: PASS.
- The shared SQL scanner reports 39 unreadable sites under its unchanged ceiling of 40, with no unreadable or interpolated SQL in the social producer. Its added statements are literal SQL with bound parameters; the existing interpolation guard is unchanged.

**Open native verification:** `node test/city-social-api.js --postgres` is wired into the required existing City native aggregate and must execute on both hosted PostgreSQL 16 and 18.4 lanes against the final integrated head. No local native endpoint/server executable is available. This branch owns an explicitly disposable loopback schema, tests actual owner locks/concurrent HTTP requests, post-insert rollback, both after-COMMIT ACK-loss/retry cases and late estate rollback, then drops only that generated schema. No native result is claimed yet.

The Phase 2 and Director oracles retain all predecessor assertions, classify exactly the new table, require its four FK/identity/generation/outfit constraints and five non-null columns, and add causal removal/weakening controls. Actual native catalog descriptor equality and all existing qualification gates remain open until those hosted lanes run. Test limits, workflow timeouts, interpolation ceilings and predecessor source inventories were not relaxed. New social authority is excluded from inherited deed/recovery qualification; source transfer qualification is a separate release check. The shared estate helper is also in the worker closure, so the final reviewed API and worker runtimes require deployment verification after the additive table is applied.

## Findings and disposition

- CS-01, P2, cross-boundary ordering: the initial client selected the first chronological message as the newest bubble. The backend remains oldest first, the client selects the newest compatible message, and a real two-sender HTTP proof retains both positions. Client review is separate from this backend conclusion.
- CS-02, P2, ambiguous acknowledgement replay: the initial chat transaction committed before its shared HTTP receipt was stored. A lost COMMIT acknowledgement could cause non-success receipt cleanup, letting a later retry duplicate a line after the flood window; preferences could also repeat an old assignment. Atomic in-transaction receipt completion fixes both boundaries. Actual COMMIT-then-lost-ACK, receipt interruption, missing reservation, exact retry, unchanged effects and body-binding tests pass in memory; the same native cases remain required. The original error mapping was 400; uncertain outcomes now return 503 with same-request recovery guidance.

The first independent pass cleared the original six runtime pins, then reopened replay review when CS-02 was identified. The final independent pass cleared the replacement social/server pins below, the authenticated reservation tuple, same-transaction completion, strict row count, compensation ordering and retained byte-exact recovery controls. It ran no duplicate tests and identified no remaining concrete concern in the correction. No unresolved concrete ownership/privacy finding is identified in this backend scope. This package is pre-release evidence, not production or native clearance, and must be attached to the release manifest by content hash after integration.

| Reviewed working-tree file | SHA256 |
| --- | --- |
| src/city-social.js | 2ac9d8cad9b0e940f9ab177c4d6228566aff31e0a3f31e42bfc581048d748434 |
| src/city-social-contract.js | b4b50de645045893f3b2fed82d90c71b44bcafafa3a32606b91a3008a1f035a4 |
| src/server.js | 2589383b275bdda57d5bb34e47afe526a222d197f9c41463a1af8d8ebd86cc1d |
| schema.sql | cb90b686e2db8c0c74cbcb970a6529c9b945584a7c4837f3ab59d0afd971677c |
| src/agentgateway.js | 64b8dff4b0899f7cb6cc7c5dbe01d840ff61415730c3d0b61f5b1414bbe9f995 |
| src/social/estate.js | f5fa5b680983cf2b773a13ffaf6517255c3370f81c7cc0d6b7cebf8fd5b4b2a2 |
| test/city-social-api.js | 13cb5b04cfd930b4de253363ee278c6d2436ce9311035ebded3402e38a2c6606 |
| test/director-migration.js | a28a458d83d9a7a8258cc10b3404219259f4c3a97a0215733be04f1b1369a61c |
| test/lib/phase2-architecture-upgrade-catalog.json | 6008213ec79cee2ba9b6a2ebfdc40d48c5f78ccfa79160c8518dd6ded20d40f6 |
| test/migrate.js | 7b8aeea00058d95309bd54f3f361afe220dc67838dfc37c43183c36804e3f8b6 |
| test/phase2-postgres.js | 68159e4536078b8adb0a3dedeb1da6a9949caada5c509edaaba03e056bea5f03 |
