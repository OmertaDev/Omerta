# Coordination event catalog

Phase 00 events are private durable audit records, inserted in the same transaction as state and command receipts. They are not public websocket messages or commands for other domain services.

The persisted envelope is version 1: `id`, `event_type`, `event_version`, `instance_id`, `revision`, `ordinal`, `content_hash`, `actor_account_id`, nullable `actor_character_id`, `correlation_id`, `payload_json`, `occurred_at`. The aggregate type is implicitly a coordination instance. Correlation identifies one committed command, not a client-supplied string. The historical owner remains on the instance; the event actor records the actual caller's current character, or null for an account with no living character.

| Kind | Payload | Emission rule |
| --- | --- | --- |
| `coordination.created` | `{}` | Once when the instance is inserted, revision 0/ordinal 0 |
| `coordination.node.discovered` | `{nodeId}` | Once for an executed hidden discovery, new revision/ordinal 0 |
| `coordination.node.completed` | `{nodeId}` | Once for an executed node completion, new revision/ordinal 0 |
| `coordination.completed` | `{}` | Alongside the terminal node completion, same revision/ordinal 1 |
| `coordination.cancelled` | `{}` | Once for active-to-cancelled, new revision/ordinal 0 |

Public-node completion records one completion event; it does not manufacture a separate discovery command. Invalid, stale, forbidden and disabled requests emit no domain event. Returning an existing run under a new creation key emits no new creation event. Exact retries return the stored receipt without new events. The uniqueness key is `(instance_id, revision, ordinal)`.

Never serialize these database rows directly. Hidden node IDs, account/character IDs, raw command requests and causal history may reveal private play. Operator counters expose only event types and totals. If future delivery is added, a consumer receives an explicit authorized payload with its own versioned schema and deduplication receipt. Failure, retry, retention and dead-letter behavior must be implemented with that consumer, not inferred from the existence of this table.

Audit retention is indefinite in the foundation: instances are bounded to one character/graph, and every compiled graph has finite node count. Broader persistent-world rollout must size command/audit retention before increasing graph supply or participant limits. Historical records are not editable narrative text.

## Phase 01 knowledge records

A schema-2 hidden-task discovery uses the existing `coordination.node.discovered` event as its authentic source. The new claim binds the event ID, instance/node/hash, original account/character, typed value, source root and event timestamp. The claim and initial ACL state commit with the instance/event/command; they do not issue a second gameplay event or a duplicate discovery receipt.

Knowledge has separate private append-only records: `coordination_claim_acl_events` contains grant/revoke operations, recipient kind/private principal, claim revision, author, command and time; `coordination_claim_links` records immutable player assertions; `coordination_archive_events` records personal references. Current grants and archive entries can be rebuilt from those sources. None is delivered through a public event bus or serialized as a raw row. Exact replay appends no additional records.

Revocation changes the current read projection without erasing the original claim or an assertion's history. A hidden endpoint suppresses the entire link from a player's detail projection; an unreadable archive reference suppresses its entry. Operator metrics expose aggregate counts of claims, active grants, links and archive entries, with no evidence or principal labels.
