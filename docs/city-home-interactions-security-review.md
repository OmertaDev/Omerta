# Home interaction source scope

Date: 2026-10-13. Phase: local candidate; native and integrated release qualification pending.
Base: `f254c64a54a019665d7a516d382d56b46f2dcd82`, branch `codex/city-home-interactions`.
The source commit containing this document identifies the candidate. This is not a production attestation.

The scope is the existing Home domain, contract and router; one narrowly admitted puzzle predicate;
the database boot seam; Home/World UI; and the existing Home API, migration, catalogue and gameplay
panel fixtures. There are no new routes, tables, resources, economic rewards or chain permissions.
The original three puzzle definitions and personal historical outcomes remain unchanged.

An active canonical deed home has one furnishing surface and separate room, storage, workbench
and hosting stations. Entering or changing stations retains the existing street scene and pose.
The property link uses existing deed controls; claiming, buying, activation and protection retain
their current explicit authorities. Touch placement, rotation and undo are local drafts until Save.
Drafts are scoped to owner, generation, district, home and authority token, discarded on close,
and retained but blocked after a newer layout appears. The issued layout action includes the
locked `expectedLayoutRevision`; stale revisions return `home_layout_changed` without effects.
Existing exact-key HTTP receipts still resolve before the new handler's body validation.

`two-voices-v1` is a separate host-and-guest puzzle. Both distinct accounts must explicitly join;
the guest also needs current accepted visitor permission. Three alternating contributions use
complementary private clues, with no automatic sharing or inferred presence coordinates. Each
answer rechecks the living actors, generations, district, authority token and consent. The actor
locks include the current party in sorted order before deed/room locks; membership is checked
again afterward. A changed party refuses the action. The final contribution and both private
outcomes share the existing reserved-receipt transaction and its rollback path. Withdrawal,
ownership or identity changes cannot be bypassed by an old issued action. Existing solo puzzles
retain their prior per-participant sequencing and capacity.

The native migration compares PostgreSQL-deparsed literal old/current definitions for the exact
`city_home_activities_puzzle_id_check`, under an exclusive table lock. Only that known predicate
may be replaced. Missing, unknown, wrong-type or unvalidated constraints refuse before the schema
stamp advances; late validation failure rolls back. The current-source catalogue envelope replaces
that single named definition independently of the immutable historical source pin. All original
tables, columns, constraint keys, nullability and unrelated predicates remain fully checked.
The database/schema change is reachable by worker boot and requires functional rollout assessment;
an unchanged worker entry file alone is insufficient evidence of compatibility.

Local evidence includes the complete Home API memory suite: stale revision and exact-key replay,
explicit dual consent, private clues, wrong-turn refusal, withdrawn-party refusal, and injected late
receipt failure restoring both participant outcomes before successful same-key recovery. The full
gameplay panel browser fixture runs a real desktop host and phone guest through all contributions,
then checks touch draft/rotation/undo, zero writes before Save, stale-draft refusal, unchanged scene
and pose, and retained identity/receipt/privacy tests. The component, client, gates, docs and global
phone checks are separate local checks. Native-only concurrent revision and migration rollback,
restart, unknown/unvalidated predicate tests are implemented but have not run in this local checkout.
Only later actual PostgreSQL 16/18.4 execution can qualify them; memory results cannot substitute.

Independent focused source review found no remaining actionable issue in revision locking,
consent/party revalidation, private clue projection, transactional dual outcomes or the closed
migration/catalogue delta. Final integrated source must receive its own checks and release review.
