# Coordination Phase 08 — Persistent world memory

Status: planned after Coordination Phases 01–03; item-linked history additionally requires the reviewed Phase 04 receipt adapter. Product intent: [shared brief](https://chatgpt.com/share/6aa68e3e-9ad8-83ea-ab47-b9c624dce707).

## Result and authority boundaries

Completed work leaves readable institutional history, curated player-visible records, and references to authoritative item provenance. Seasonal coordination state can reset while permanent evidence and ownership history remain intact.

Existing `src/estate.js`, `src/season.js`, `src/items.js`, and authored `content_story_flags` already implement different persistence rules. Coordination must explicitly reference these domains. It must not infer that an account-owned archive grants item custody, that a season reset clears permanent history, or that a dead character's knowledge automatically passes to an heir.

## Proposed records and projections

Add `src/coordination/history.js` with three bounded projections:

| Proposed record | Meaning |
| --- | --- |
| `coordination_world_records` | An immutable, typed consequence of a completed coordination resolution: source event/receipt, definition hash, historical actors, scope, and safe narrative key. No arbitrary SQL or unbounded user prose effects. |
| `coordination_archive_entries` | An institution-custodied reference to a claim or record, custody policy hash, disclosure classification, and append-only accession/removal history. Removal changes current visibility, not original provenance. |
| `coordination_season_state` | Explicit season/run key, resettable coordination state, revision, and policy hash. Permanent records are referenced by ID and never copied into new entitlements. |

Rebuild archive and history read models from immutable coordination events and domain receipts. Item-related entries store domain/item/event references and verify read permission through the item domain; they never become a substitute `item_events` ledger. A crafted item's story reference cannot change rarity, quantity, quality, tradeability, or export eligibility.

Proposed `GET /v1/coordination/history` and `GET /v1/coordination/archives/:archiveId` return bounded, paginated, caller-filtered projections. Accession, disclosure, or custodian changes are typed commands using explicit organization authority from Phase 02, expected revisions, and idempotency keys. Public history must be a deliberately authored disclosure projection, not a dump of internal events.

## Atomicity, access, and succession

If a world record is part of a resolution's declared outcome, create it in the same transaction and bind its unique source receipt. A retry, replayed consumer event, restored backup, or second season cannot create another permanent record from the same source. Later read-model indexing may be asynchronous; it is reconstructible and never grants authority.

A completed historical fact and a current authorization answer different questions. Keep original actor, owner, item source, and organization association immutable. Resolve current archive readership and custodian authority dynamically. Leader succession transfers only the institution's explicitly granted archival authority. It does not transfer private character clues, live operation seats, or underlying items.

A character's death seals personal action authority while retaining permitted account history. Organization dissolution follows its pinned archive policy: owner-only recovery, a designated institutional successor, or sealed historical retention. Do not make sensitive archives public because no living custodian remains. Rejoining a Crew does not retroactively grant access to a personal claim.

Freeze the server-derived season key when a seasonal run starts. End-of-season rollover creates a new season-state row and records the transition; it does not mutate old rows into the new season. Active runs finish or cancel according to their pinned policy. Permanent source-receipt uniqueness spans seasons where the effect is permanent; explicitly recurring effects use an approved season-scoped uniqueness key.

## Acceptance and rollout

- Complete, replay, die, replace the character, leave an organization, dissolve it, and change custodian; each step preserves provenance and the correct current ACL.
- Run season rollover concurrently with starts/resolution; prove one server-derived season assignment and no permanent duplicate.
- Verify read-model rebuild equality and that disabled or retired definitions still render historical records safely.
- Trace item provenance through authoritative receipts and reject forged, cross-owner, cross-hash, or unavailable references without leaking existence.
- Test public disclosure against private accounts, roles, clues, answers, and raw domain identifiers.

Planned `COORDINATION_HISTORY=on` first exposes owner history, then explicit institutional archives, then deliberately public records. Rollback disables new disclosures and accessions while retaining owner inspection and existing revocation/custodian recovery. Preserve season rows, source receipts, pinned definitions, and permanent events; downgrade readers through versioned safe projections rather than destructive migrations.

Out of scope: retroactive rewriting of game lore as ledger truth, automatic inheritance of items or secrets, unrestricted public event feeds, economic value for historical records, and replacing the estate or season system. Packages: CE-08-01 through CE-08-04.

