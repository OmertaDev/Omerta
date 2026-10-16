# N10 merchant-funded returns — component review

Source: `c7ce892793729f7768690024edf9802dd2bc16f2`, based on `134bba2d56e4fd350eb084dd7261e2311ebbafc5`. This is an owned-component phase, not shared integration or release approval. New mutations default to `integration_required` without a trusted server lifecycle verifier. The six-file common integration proposal is OFF REPOSITORY and unqualified.

## Product and authority

An original N01 seller voluntarily reserves real pocket game cash for one named original buyer's actually purchased precision-tool UID. Refund is at most the original seller's net proceeds; the host's earned fee and original sale journals remain unchanged. The seller can cancel an unaccepted offer. Explicit buyer acceptance makes the funded right irrevocable by the seller until its original deadline; only the original buyer can waive it. A later return atomically transfers the same UID back and releases the reserved refund. No mint, grade/identity change, manufactured damage, rental disposal, new fee or external financial authority exists.

Terms are closed: offer `{consignmentId,sourceHash,refundCash,lifetimeSeconds,consent:true}`, other mutations `{returnId,sourceHash,consent:true}`. Lifetime60–86400 seconds; no edits/extensions. At most3 combined seller offered/accepted plus buyer accepted roles per original account; one live right per sale. Unaccepted target offers consume no buyer slot or buyer-death counterpart capacity. The condition floor is exactly the canonical sale's recorded remaining condition. Account-held active custody and an unbroken original sale title-transfer chain are required at acceptance and return.

Six private routes are proposed at `/v1/items/merchant-returns`: own GET board and POST offer/accept/return/cancel/expire, closed DTOs and mandatory mutation key. The tested registrar uses fixture JWT authentication; actual shared server auth, generated OpenAPI, globalHTTP receipt behavior and canonical estate composition are not qualified here.

## Source and accounting checks

The module binds immutable N01 terms, exact original3party identities, all3canonical cash journals/IDs/amounts/reasons, completed canonical sale request/guard/request hash/result and actual transferred event. F05 reads authoritative physical UID/creation/condition; no caller-supplied quality or condition. Return uses canonical `Items.transferItem` under the owning branded transaction. Actors then accounts lock in sorted order, then canonical sale, right and UID/condition. Expiry is read after the real UID wait and again after transfer. Pending requests carry no actor/right FK until existing locks are held.

An independent full-history oracle checks reserve/payout/refund journals, original party/account/amount bindings, unique return transfer guards/events, immutable private receipt/source fields, orphan rows and the held reserve equation. Three explicit new cash reasons: `merchant_return:reserve`, `merchant_return:payout`, `merchant_return:refund`. The exported escrow query and independent cash invariant must be integrated into global books before enabling production writes; there is no hidden production bucket.

Exact original-account key/body replay resolves before fresh eligibility and can only acknowledge the old result. A future heir cannot act as the original living actor. Read boards reveal only a participant's private rights.

## Required private estate integration

Root must add finite `merchantReturnCounterparts` to its existing pre-actor union and post-wait rechecks; N10 contributes at most3 counterparts per subject. Existing42 becomes45 only on this exact baseline; later composition must recompute the complete bound. No unaccepted target-buyer offers enter that union.

`recoverMerchantReturnsAtEstateStart` requires actual private estate and global rental prelock scopes. It refunds the SAME original still-living dying seller before `exactCash`, returns `{sellerCharacter,refundedCash}`, and root must merge that DELTA into the actual victim object with undo before canonical death accounting. Normal death burn/loot/heir handling then applies, not a new burn helper or heir payment.

`recoverMerchantReturnsInEstate` runs after SQL death, before heir insertion. Accepted-buyer death refunds only the locked living original seller. Root must merge returned DELTAs into matching `h.actorCh`/`opts.killerCh` objects, preserving any existing unpersisted cash. Neither leaf moves items. Original unaccepted target-buyer death does not expand prelocks: that offer becomes ineligible and the living original seller can cancel/expire/recover without any future grant. Source scopes are private transaction/client/victim capabilities, not body flags or ordinary pair authorization.

These actual root hooks and mixed estate/global tests remain PENDING. A plain forged scope is rejected in the component proof; no manual helper is represented as actual estate integration.

## Executed proofs and retained findings

Both memory suites PASS at final source. They exercise real canonical crafted tool→N01consignment sale→seller reserve→separate buyer acceptance→sameUID return/payout, no host reversal/mint/immutable item change, combined role caps, exact replay, foreign/current-disposal and reacquisition refusal, condition/source/budget/receipt tamper refusals, irrevocability/waiver, caught poison and late rollback. Condition corruption is explicitly a negative administrative fixture, not an invented positive wear witness.

Prior-phase source `0ce8213b696c3d9afa4ae5eda7cccf1d58c4a4f6` passed both fresh native PG18.4 component suites on owned127.0.0.1:35439/pilot_runner: core72.3s, registrar5.9s. Canonical waiter was observed BEFORE the immutable deadline and released AFTER; exact `expired` refusal, one-winner and same-key controls passed. Full snapshots cover531 tables and3 sequences. A late attempted transfer rolls every row back but consumes exactly one native `item_events_sequence_seq` allocator value; both unequal raw hashes are retained. Caught pre-transfer error, replay and post-wait expiry preserve all rows and sequences exactly. No sequence rewind or normalized equality is claimed.

Final source includes later recovery eligibility and oracle/fixture changes. Its native retest is PENDING coordinator lease; the prior native result must not be presented as final-source clearance. No localPG16 run occurred. Guard remains local35439/pilot_runner18.4 or closedCI5432/postgres/pgcheck16|18.4, fresh owned `merchant_returns_test_[12hex]`, rejecting ambient endpoints. No database process control, unknown-data deletion or external call occurred.

- **MER-REC01 (availability, fixed; native retest pending):** requiring both accounts active also on negative recovery could strand reserve when the counterpart was banned. `f1a23e9d1dfef476337c81c662db43e33744adda` permits inactive counterpart only for cancel/waive/expiry while the requesting original account remains active. Fresh positive actions remain both-active. Causal memory tests PASS.
- **MER-OBS01 (oracle hardening, fixed; native retest pending):** `7b94a47cdb79d544d39081b30b398efcb8eb3588` binds closed request shape and immutable private receipt fields; causal cached-receipt tamper detection PASS. No public-player exploit was shown.
- Initial implementation reserve-account binding was caught by the independent oracle and fixed before first core commit. Raw `reserve_witness` failure is retained.
- **Fixture liveness:** first native attempt hit the owned blocker's idle transaction timeout; second correctly hit the unchanged8s canonical lock timeout. `cf0319a1b3e06c368a9d3a2ff9ccd09240a90cc1` adds actual blocker reads and `0ce8213b…` starts the real request near the deadline while observing a true waiter before expiry. No timeout/clock/TTL bypass or broad contention acceptance was added. Both failures and successful retest remain retained.
- `c7ce8927…` reuses the established all-or-none component-schema helper so future canonical integrated tables are not bootstrapped twice. Partial schema still refuses; no constraint weakening or fallback DDL.

Methods adapted from all3 policy pins: Pashov`c577eb7…` access/replay/privilege and adversarial execution trace; Plamen`795962b…` concrete reserve/title/transfer/rollback accounting transitions; Trailofbits`d3323ce…` caller/source/specification comparison, static SQL/parameter/authority triage and causal properties. These were direct bounded passes, not upstream orchestration/full audit. Solidity fuzzing/provider deployment is inapplicable. Retained evidence is under `team-evidence/game-employment/merchant-returns-20261015` with full source/test/log hashes. Actual common integration, current native retest, catalogs/source envelopes/graph coverage and release remain root-owned. Financial and paid-compute activation stay OFF.
