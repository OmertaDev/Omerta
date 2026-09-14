# Coordination Phase 01 — Distributed knowledge

Status: implemented for scoped review, disabled by default. Phases 02–09 remain planned. This numbering is unrelated to the existing world-graph Phase 1 and sealed-content Phase 2. Product intent comes from the [shared brief](https://chatgpt.com/share/6aa68e3e-9ad8-83ea-ab47-b9c624dce707). Exact evidence and limitations are recorded in [the Phase 01 review](../PHASE_01_REVIEW.md); implementation does not activate production.

## Result and authority

Two independently earned discoveries can unlock a private graph node. A player can inspect a permitted original claim, share it with their current Crew or Family or a named account, revoke a grant, add a typed corroboration/contradiction assertion, and retain a personal archive reference. Sharing, assertions and archives never manufacture another discovery or turn a player assertion into authoritative truth.

`src/coordination/graph.js` adds schema version 2 while preserving schema version 1. A hidden task may declare one exact claim: `{domain, proposition, sourceRoot, value:{type,value}}`. Value types are boolean, safe integer or bounded text. Only executing its server-issued discovery action mints the claim. Clients cannot upload claims, definitions, source roots, owner identities or outcome values.

The fixed `independent_evidence` gate declares one domain, proposition, typed value and exactly two distinct source roots. Those roots must reference compatible claims in the same compiled graph. The runtime authenticates stored evidence against the pinned definition and original discovery event, then requires two distinct source receipts, roots and originating accounts. Multiple characters from one account, copies, grants, archive references and player assertions add no independence. This establishes account independence, not distinct human identity. Any eligible readable authoritative value contradicting the expected value for that proposition blocks the gate. A truncated evidence scan also blocks rather than authorizing from incomplete evidence.

The value-neutral pilot **The Split Ledger** uses a Docks manifest and Foundry impression. Each investigator completes a local source, then combines it with another account's permitted original source. Knowledge gates protect both discovery and completion of the hidden conclusion; revoking a source after a board was issued removes the corresponding action on refresh and prevents executing the stale descriptor.

Authored `content_instance_facts`, `content_story_flags`, world-graph mysteries, item provenance, organization membership, cash and OMR retain their existing authorities. This phase imports no adapter that writes those systems. It grants no Agent Turn or Agent Alpha execution authority and ships no dedicated graphical console.

## Storage and API

The additive tables are `coordination_claims`, `coordination_claim_acl_state`, `coordination_claim_acl_events`, `coordination_claim_grants`, `coordination_claim_links`, `coordination_knowledge_archives`, `coordination_archive_events`, and `coordination_archive_entries`. Claims, ACL events, links and archive events are append-only through the service. Current grants, ACL revision and archive entries are derived projections. The checked rebuild command reconstructs the caller's projections from their durable source events; it neither changes original provenance nor grants institutional custody.

| Endpoint | Contract |
| --- | --- |
| `GET /v1/coordination/knowledge` | Bounded caller-filtered claims, optional `limit` and opaque `cursor` |
| `GET /v1/coordination/knowledge/:claimId` | Permitted claim and links whose two endpoints are both currently readable |
| `GET /v1/coordination/knowledge/targets` | Current Crew/Family targets; optional `characterName` adds the exact named living account |
| `POST /v1/coordination/knowledge/:claimId/share` | Issued `targetId`, `expectedAclRevision`, required idempotency key; owner only |
| `POST /v1/coordination/knowledge/:claimId/revoke` | Owned issued `grantId`, `expectedAclRevision`, required key; owner only |
| `POST /v1/coordination/knowledge/links` | Readable `fromClaimId`, `toClaimId`, closed `relation`, required key |
| `POST /v1/coordination/knowledge/archive` | Readable `claimId`, required key |
| `GET /v1/coordination/knowledge/archive` | Personal references filtered through current claim permission, optional bounded page |
| `POST /v1/coordination/knowledge/rebuild` | Exact empty object and required key; rebuild only the caller's projections |

Target and cursor tokens use authenticated encryption and bind their purpose, caller and ten-minute expiry. A target contains a server-resolved principal internally; raw account, Crew and Family IDs are never accepted. Tokens belong to the service process and must be refreshed after restart. A copied token cannot be rebound to another caller or kind. Organization sharing requires the grantor still belongs to the issued organization when the share executes; later reader access depends on their current membership in that stored organization.

Safe claims expose their opaque ID, proposition, typed value, content hash, discovery time, owned flag and public source kind/root. Only the owner receives ACL revision and safe grant descriptors. Private creator/account/character IDs, discovery receipts, event IDs and raw pinned definitions stay internal. Missing and forbidden resources share the same unavailable error. API inputs and responses are closed schemas and unknown fields are refused before coercion. Every knowledge response has `Cache-Control: no-store`.

If a board/archive candidate loses permission between selection and its claim lock, the page returns retryable `contention` instead of silently skipping the candidate and truncating pagination. Refresh using the same page request. Disabled target discovery returns an empty target list; a new sharing mutation remains disabled.

## Transaction and lifecycle contract

`runtime.js` owns one `withPhase2Transaction` client for each command and each knowledge-sensitive projection. It locks the current living character, then account. Knowledge context then locks the caller's Crew membership, followed by current character's Family membership, `FOR SHARE`. Relevant claim rows serialize permission reads and ACL changes with `FOR UPDATE`. A fresh grant read after the claim lock is the authority check. Membership rows are leaves: no later `crews`, `gangs`, foreign character or foreign account lock is taken. This fits the existing Crew-before-character and Family-after-character mutation orders, including kicks that never lock the target character. Catalog entries use separate checked projections so a catalog does not hold one graph's claim locks while acquiring another graph's claims.

An authorized read whose locks precede removal or revocation may finish while the mutation waits. A read/action obtaining those locks after the mutation commits must deny the lost permission. Already delivered information cannot be recalled. Cached boards and receipts are observations, not durable access rights. Real PostgreSQL tests observe both lock orderings instead of relying on pg-mem's serialization.

The discovery event, authentic claim, ACL initialization, instance transition and command receipt commit together. Share/revoke change ACL revision separately from instance revision. Links are explicitly labeled `assertion: player`; they do not change the evidence gate's source checks. Archiving records a reference, not a copy, and its display disappears when the referenced foreign claim becomes unreadable. Existing claim owners can inspect their historical evidence after death; a replacement character cannot advance the old run or inherit the former character's Family access.

Every mutation uses the account-scoped command receipt with exact operation/body binding. Share/revoke receipts contain only the caller's owned claim; link/archive receipts contain no foreign claim payload or endpoint identifiers. Exact replay performs no new transition, event, assertion, archive insertion or grant. The trusted coordination HTTP recovery branch can reach the durable receipt after a lost outer receipt-store acknowledgement; a conflicting HTTP body remains refused.

## Bounds, flags and recovery

The compiled profile retains 64-node, 512-rule and depth-8 bounds. Knowledge pages return at most 50 entries; the resolver refuses to satisfy a gate with more than 256 candidate claims. An account can hold at most 2,048 claims and archive events; a claim has at most 64 lifetime recipient principals and 2,048 ACL events, with event capacity reserved for revoking active grants. Source/event validation and bounded scans are correctness controls, not claims of measured mass-scale capacity.

Set `COORDINATION_KNOWLEDGE=on` only beneath `COORDINATION_ENGINE=on`; set `COORDINATION_KNOWLEDGE_SHARING=on` separately for grant targets and shared reading. The existing account cohort applies. All settings are captured at server construction. Disabling knowledge stops new knowledge discovery and dependent advancement while preserving owner inspection, cancellation, durable receipts and revocation. Disabling sharing removes shared access and new sharing. Preserve every provenance, ACL, archive and command record; rollback never drops these tables or rewrites historical owners.

Acceptance evidence covers canonical schema boundaries, original-source validation, contradiction, exact-hash history, stale revisions/targets, forged tokens, private projections, rebuild, rollback/replay, membership/death/revoke races and zero economic changes. See [the test strategy](../TEST_STRATEGY.md) and [review](../PHASE_01_REVIEW.md) for actual checks and limits.

Out of scope: external documents as authoritative clues, transferable knowledge assets, social posting, institution custody/succession, voting, delegated action authority, economic rewards, human-identity proof and model-certified truth. The completed CE-01 packages remain in [the task index](../tasks/TASK_INDEX.md); their successors require separate implementation and evidence.
