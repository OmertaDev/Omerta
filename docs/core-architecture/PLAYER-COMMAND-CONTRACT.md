# Player command contract, version 1

The command layer adapts existing authorized projections and domain actions. It owns neither inventory, knowledge, operation readiness nor world mutation rules.

`GET /v1/commands?operationId=...&mysteryGraphId=...` requires the authenticated account and the existing World Graph feature/cohort gate. The two selectors are optional; unknown fields are rejected. The response preserves the world projection shape and adds `commandSchemaVersion: 1`, `commands`, `opportunities`, truncation flags, authorized `discovery` investigations and at most 20 own salvage vehicles. No account or character selector is accepted.

Each command includes:

| Field | Meaning |
| --- | --- |
| `commandId`, `commandType` | Stable semantic hash and versioned adapter name |
| `subject`, `target` | Authorized entity references `{type,id}` for shared contextual rendering |
| `label`, `description` | Player-visible server wording |
| `availability` | `AVAILABLE`, `BLOCKED`, `LOCKED`, `IN_PROGRESS`, `EXPIRED`, or `COMPLETED` |
| `requirements`, `blockers` | Known public blockers, or a generic undiscovered requirement with no hidden identity/value |
| `costs`, `committedResources` | Currently disclosed costs and operation promises/deliveries |
| `requiredKnowledge`, `requiredItems`, `requiredRoles`, `requiredParticipants` | Optional disclosed requirement lists; an empty list never proves that no secret prerequisite exists |
| `authorization` | Explicit `revalidatedOnExecution: true`; metadata is not permission |
| `risk`, `confirmation` | Disclosed irreversible effects and required confirmation |
| `expiresAt` | Server-issued suggestion expiry, at the end of the current ten-minute interval |
| `executionIdentity` | Durable `{executionId}` only for available commands |
| `parameters` | Already authorized, closed domain parameters for inspection; the execute API does not accept them |
| `resultContract` | Version, current authorized projection and exact-retry semantics |

`BLOCKED` explains a known impediment. `LOCKED` says only to keep investigating. Entirely undiscovered entities have no command or opportunity. Public, revealed blocked case notes can have a nonexecutable `mystery.inspect` command. Raw private definitions never feed the command list.

`POST /v1/commands/execute` accepts exactly `{executionId, confirmed}`. `confirmed` is a boolean; `Idempotency-Key` must equal `executionId`. Unknown request fields, forged identities, actor substitutions and arbitrary domain payloads are rejected. The frontend stores only account, character, execution identity, confirmation and display label for pending retries.

## Execution and recovery

1. Resolve the immutable `player_command_boards` entry by board ID and authenticated account. Check account status, current living character, cohort and confirmation.
2. Look for the existing domain receipt for this identity. A committed receipt permits reconciliation after expiry or state change; it does not grant fresh authority or return a cached private board.
3. For unexecuted commands, enforce expiry and regenerate the authorized board. Compare its canonical state fingerprint, excluding read timestamps. Any mismatch requires a refresh. Recheck the receipt if a concurrent execution may have just committed.
4. Call the existing crafting, salvage, mystery, coordination or world service. Its own locks, prerequisites, economic accounting and receipt commit remain authoritative. Trusted expected-character arguments close the gap between read and write during succession.
5. Return `COMPLETED`, a small result identity, authorized consequence feedback and a new command projection. If the postcommit projection fails, return `COMPLETED` with `projection: null` and `feedback.refreshRequired: true`. Retry the same identity to reconcile.

Knowledge group sharing passes a stable claim, current group identity and ACL revision. The existing knowledge service creates its ephemeral recipient token inside the locked mutation, checks current group/character, and uses the existing coordination receipt. A server restart does not invalidate the stored intent; a replay of a subsequently revoked share never restores access.

The HTTP middleware keeps exact request-body binding but does not replay its cached command response. The private route registration symbol forces fresh authentication/projection even for completed HTTP receipts. Durable domain receipts are the only deduplication authority; the command layer adds no economic transaction framework or completion ledger.

## Opportunities and feedback

Derivation traverses only the already bounded player DTO and fixed admitted catalog: at most 128 commands and 80 ranked opportunities. Selected operation/case actions retain priority. Ranking favors ready operations, new intelligence and mystery leads before routine resources and waiting business. Unknown or hidden opportunities are never supplied to the client. Read selection uses existing owner/membership indexes; salvage adds `(character_id,model_id,id)`. Stored board lookup uses the primary key and account binding.

Feedback supports immediate result, current visible world changes, inventory changes, knowledge changes, relationships, operation state, mystery progression and new/removed opportunities. It uses a post-action authorized projection. Replays return current views rather than historic private deltas. The persisted world/operation/coordination events remain the history authority. Sharing/revocation hints derive audiences from stored server command descriptors and current/removed grants; sockets receive only `{channel:'projection',changed:true}`.

World, cases, investigations, workshop, inventory/salvage, clue sharing, territory references and Family operation cards use the same renderer. Existing travel, garage acquisition and social creation stay in their established production screens. See [the migration map](command-migration-map.md) for the remaining domains.

## Operational limits

Boards are durable suggestions retained for recovery, not a cross-request authorization cache. Expiry stops new execution; it is not deletion permission. A future retention job must preserve the agreed replay window. Whole-board freshness can reject otherwise harmless moves after unrelated changes. Discovery instances retain the existing 20-instance catalog bound; the command layer does not introduce a city graph scan. Refresh remains best-effort and process-local; a reconnect/reload reads current persisted state. Feature flags remain off by default.
