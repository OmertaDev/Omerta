# Coordination data and API contracts

## Implemented schema

The additive tables at the end of `schema.sql` are applied using the existing boot migration mechanism. No production row is rewritten or backfilled. Existing code can run against the added schema when the pilot is disabled.

| Table | Identity and authority | Important constraints |
| --- | --- | --- |
| `coordination_definitions` | Graph ID/version, content hash, canonical definition source | ID/version primary key; full identity tuple unique; runtime recompiles and verifies stored source before use |
| `coordination_instances` | UUID, historical account/character, pinned graph tuple, state JSON, status/revision/timestamps | Foreign keys to accounts, characters, graph tuple; one run per character/graph across versions; active/completed/cancelled; nonnegative revision |
| `coordination_commands` | Account/key, random command ID, request fingerprint, committed response | Account/key primary key; command ID unique; exact replay returns receipt; different request under same key conflicts |
| `coordination_events` | UUID, closed event kind/version, instance/revision/ordinal, pinned hash, actor/correlation/payload/server time | Instance FK; unique instance/revision/ordinal; actor character may be null for post-death account cancellation |
| `coordination_claims` | Exact discovery, typed proposition, source root, original owner/character and pinned hash | Unique discovery receipt, source event and instance/node; authenticity rechecked against definition, event and discovered state |
| `coordination_claim_acl_state` | Current independent ACL revision | One row per claim; nonnegative bounded integer |
| `coordination_claim_acl_events` | Immutable grant/revoke history and private recipient principal | Unique claim/revision; closed operation/kind; command correlation |
| `coordination_claim_grants` | Rebuildable current read permissions | Unique claim/recipient kind/principal; active flag; safe descriptor; no recipient/organization FK that would acquire another actor lock |
| `coordination_claim_links` | Immutable caller assertions between readable compatible claims | Closed corroborates/contradicts relation; player assertion; distinct endpoints; author/pair/relation uniqueness |
| `coordination_knowledge_archives` | One personal reference archive per account | Unique custodian account; fixed personal-reference policy |
| `coordination_archive_events` | Immutable references to original claims | One event per archive/claim; command correlation |
| `coordination_archive_entries` | Rebuildable archive projection | References its original archive event; unique archive/claim; current claim permission checked on display |

`state_json` contains exactly `discovered` and `completed` arrays. The runtime validates referenced IDs and that completed nodes were discovered. State remains a private execution projection; events record committed changes. Definitions and audit are append-only through application APIs. SQL administrators still have database authority; this feature does not add DB-role isolation or tamper-proof external storage.

Index rationale: `(owner_account_id, created_at, id)` supports a bounded newest-first private catalog; unique character/graph prevents duplicate runs; instance/revision/ordinal supports audit reconstruction; event type supports base metric rollups. No generic JSON expression index or new global item lock is introduced.

## Executable definition profile

Required root fields: `schemaVersion: 1`, canonical `id`, positive int32 `version`, bounded `title`, nonempty `nodes`. Node fields: `id`, `kind: task | terminal`, `title`, optional `description`, `visibility: public | hidden`, required `discover`, required `requires`. Exactly one terminal is allowed. All references must exist, be acyclic and have a dependency path to the terminal.

| Predicate | Exact arguments | Authority |
| --- | --- | --- |
| `always` | None | Constant true |
| `all`, `any` | Nonempty `rules` | Boolean composition |
| `at_least` | Positive `count`, nonempty distinct `rules` | M-of-N composition; duplicate predicates refused |
| `node_completed` | `nodeId` | Current pinned instance state |
| `level_at_least` | Positive `level` | `levelOf` of locked character respect |
| `at_district` | `districtId` | Locked character location |
| `elapsed_at_least` | Nonnegative `seconds` | Server time minus persisted creation time |
| `independent_evidence` (schema 2) | Domain, proposition, exact typed value and two source roots | Authentic readable same-hash discoveries from two original accounts and receipts; contradicting eligible values or a truncated scan refuse |

Limits: 64 nodes/registry graphs, 512 aggregate predicates, depth 8, identifier length 128, title length 200, description length 2,000. No arbitrary metadata or effects are accepted. Compiler structural reachability is not a proof that all narrative, capability or timing conditions can be satisfied; later content validation must supply those proofs.

Hidden nodes first receive an opaque discovery action when their discovery predicate passes. Completing a discovered node still checks its requirements. Public nodes require both discovery and completion predicates unless already discovered. Completing the terminal closes the instance; no action performs an automatic reward. All successful mutations increment revision once, except creation which starts at revision 0. Creation with another key returns the existing character/graph run without reopening it.

## HTTP surface

| Method/path | Request | Response |
| --- | --- | --- |
| `GET /v1/coordination` | Bearer account | `enabled`, `directOnly`, selected graph summaries, newest 20 owned instance projections |
| `POST /v1/coordination/:graphId/instances` | `expectedContentHash` + required key | `{instance, replayed}` |
| `GET /v1/coordination/instances/:instanceId` | Bearer historical owner | Safe instance projection |
| `POST .../:instanceId/act` | `expectedRevision`, issued `actionId` + required key | `{instance, replayed}` |
| `POST .../:instanceId/cancel` | `expectedRevision` + required key | `{instance, replayed}` |
| `GET /v1/mod/coordination/metrics` | Existing moderator auth | Aggregate event/status counters |

Instance fields are explicit: ID, graph ID/version/hash/title, status, revision, timestamps, historical flag, visible nodes, executable actions, `canCancel`, `directOnly`. Complete actions may name a visible node; discovery actions do not reveal the hidden ID. Clients refresh GET on stale revision/content errors. The server accepts choices, not owners, rules, status, quantities, timestamps or outcome assertions.

The nine additional knowledge routes and their exact fields are listed in [Phase 01](phases/PHASE_01_KNOWLEDGE.md). Their closed shared schemas are in `src/coordination/http-contract.js`. Boards and archive pages use caller-bound encrypted cursors and return at most 50 entries. Target tokens bind purpose, caller, server-resolved principal and ten-minute expiry; restart requires a fresh token. No knowledge route accepts a raw account or organization ID. Link/archive receipts omit foreign endpoint IDs and evidence payloads; owner share/revoke receipts may return that owner's safe claim.

Nonexistent and foreign resources/actions use the same 404 public error. Stale revision, changed content and domain key reuse are 409. Disabled new work is 503. Malformed input is 400. The outer HTTP idempotency layer still returns 422 when a key belongs to a different HTTP request. After checking an identical request hash, it permits a pending reservation to reach only trusted coordination mutation handlers, which resolve the atomic domain receipt under the account lock. A private server-created Symbol in route configuration grants this narrow recovery path; request fields and headers cannot grant it. All other routes retain the existing 409 `in_progress` behavior. A lost HTTP receipt-store acknowledgement can therefore be recovered with the same coordination key/body without executing a second transition.

## Atomicity and recovery

Commands fingerprint the normalized operation kind, target and exact body under `omerta:coordination:command:v1`. The account lock serializes account-scoped receipt keys. Existing receipts are checked before flag/current-character eligibility so an already committed operation can be reconciled after a rollout change or death. A replayed projection is a historical receipt, not a new capability.

State, events and receipt commit atomically. Every successful write registers an exact inverse for pg-mem before another operation can fail. PostgreSQL uses actual rollback. A lost COMMIT acknowledgement returns uncertainty; it never triggers compensating deletion of a possibly committed transition. Retry the same logical key/body or inspect owned state.

Knowledge locks caller Crew and Family membership leaves after the actor, then relevant claims in a stable order. Projections use the same checked transaction and claim mutex as writes, followed by fresh ACL reads. No organization or foreign actor lock follows a membership lock. A catalog projects its instances in separate checked transactions rather than holding claim batches across graph boundaries. Reads preceding a revocation may finish; authority checks following its commit must deny. All knowledge responses are `no-store`.

A board/archive candidate revoked between page selection and claim locking produces retryable `contention`; the server does not advance a cursor over a silently shortened page. Target discovery while disabled is an empty successful read. Sharing remains a refused mutation until its flag/cohort permits it.

Rollback: set `COORDINATION_ENGINE=off`, or disable `COORDINATION_KNOWLEDGE`/`COORDINATION_KNOWLEDGE_SHARING` at their narrower boundary, restart API processes, and preserve all twelve coordination tables. Owner inspection, original-account cancellation, receipt replay and revocation remain available. No new worker needs stopping. No economic reconciliation is required because no economic authority exists. Do not drop the schema after players have used it: that would erase history and replay protection.
