# Authored Content Runtime and The Sixth Chair — Design

**Date:** 2026-08-27  
**Status:** Approved  
**Scope:** The first build-order slice: turn the deterministic authored-content compiler into a safe, server-authoritative runtime and make the narrative spine of The Sixth Chair playable.

## Outcome

OMERTÀ will gain a reusable, relational authored-content runtime with these properties:

- operators register and activate immutable, compiler-verified bundles by SHA-256 identity;
- every party instance pins the exact namespace, version, and hash it started against;
- parties are account-based, organization-scoped, role-unique, and consent-aware;
- clients act only through server-issued action identifiers against an expected instance revision;
- the server evaluates gates and graph transitions from the pinned bundle;
- evidence, choices, instance facts, and effects are exact-once database records;
- status and collectible rewards are claimed by each participant under their own character lock;
- unsupported economic/crafting capabilities fail activation instead of being silently skipped;
- private answer specifications never appear in player-facing projections.

The first live content profile supports the playable mystery spine of The Sixth Chair. Its salvage, crafting, export, referral-retention, and OMR-settlement branches remain explicitly deferred until their adapters and invariants exist.

## Why the existing pack cannot be activated unchanged

The current `omerta.sixth-chair` v1 graph is a strong compiler/system-integration specimen, but it is not a complete gameplay contract:

1. It has no explicit runtime experience manifest or entry node.
2. Three puzzles declare `server_owned_canonical` without answer specifications.
3. The Witness choice declares ownership but has no options.
4. `REWARDS` edges and terminal effects both name the title and seal, creating two possible award paths.
5. Reward recipients are not specified.
6. The OMR allocation has no party split/beneficiary policy or funded runtime adapter.
7. The graph intentionally includes crafting, durable items, optional export, acquisition, and retention systems that do not yet have runtime adapters.

The v1 source and known hash remain immutable. A new v2 pack supplies the runtime contract and removes ambiguity from the playable closure.

## Alternatives considered

### A. Bespoke Sixth Chair service

Implement four hard-coded puzzle endpoints and dedicated progress columns.

**Advantages:** Smallest initial diff and fastest happy path.

**Costs:** Discards the compiler graph as runtime authority, duplicates role/evidence/reward semantics, and leaves the next authored chapter requiring another bespoke engine.

### B. One JSON snapshot per instance

Store members, progress, facts, and claims in one JSON document on the instance row.

**Advantages:** Fewer tables and compact reads.

**Costs:** Every action rewrites one hot document; database uniqueness cannot protect seats, nodes, or effects; concurrent updates are opaque; operational queries and migrations become brittle.

### C. Relational, capability-gated graph runtime — selected

Store immutable bundles, activation pointers, instances, members, node progress, facts, and effects separately. Compile a strict runtime projection from the active bundle and reject unsupported executable closures at activation.

**Advantages:** Reusable, queryable, race-safe, version-pinned, and consistent with OMERTÀ's ledger/idempotency discipline.

**Costs:** More initial schema and a deliberately narrow first capability profile.

## Runtime bundle contract

The compiler continues to accept broad future-facing content graphs. A pack intended for live execution additionally declares a `runtime` manifest:

```json
{
  "runtime": {
    "experienceId": "the-sixth-chair",
    "entryNodeId": "the-sixth-chair",
    "partyPolicyId": "crew-policy",
    "quorumId": "four-seat-quorum",
    "terminalNodeId": "case-closed",
    "nodeIds": ["...explicit playable closure..."],
    "actionNodeIds": [
      "archive-puzzle",
      "route-puzzle",
      "market-puzzle",
      "witness-puzzle"
    ]
  }
}
```

Runtime validation is stricter than compile-only validation:

- all manifest IDs exist and have the expected node types;
- `nodeIds` are unique and contain the entry, terminal, policy, quorum, action nodes, and all referenced role/evidence/fact/reward definitions in the playable closure;
- every action node is a `puzzle` or `choice`;
- each canonical puzzle references one `answer_spec` node;
- answer specifications declare a supported normalization/verifier mode and non-empty accepted values;
- choices expose stable option IDs and labels; author order is never runtime authority;
- every gate/effect in the playable closure has all required fields and references existing compatible nodes;
- edge endpoint combinations match the runtime semantics below;
- unsupported runtime nodes, gates, or effects inside `nodeIds` fail closed;
- nodes outside `nodeIds` remain authored metadata/deferred content and are never accidentally executed.

The full compiled bundle, including private answer specifications, stays server-side. Player boards return a safe projection and never serialize `answer_spec` nodes, accepted answers, effect payload internals, raw account IDs, or evidence outside the viewer's permitted scope.

## Supported graph semantics

The first runtime profile defines a small deterministic vocabulary:

- `UNLOCKS`: the target becomes available after all in-profile incoming `UNLOCKS` sources complete.
- `REVEALS`: source completion reveals and completes a passive evidence or world-fact target.
- `CONTRIBUTES_TO`: a collaboration node completes automatically after all in-profile incoming contribution sources complete.
- `REWARDS`: source completion completes a passive reward-bundle target; definitions are not independently executable.
- `REQUIRES`: a hard static/runtime gate. Policy and quorum requirements are resolved through the manifest rather than guessed from arbitrary graph roots.
- `PERFORMED_BY_ROLE`: names the role authorized to act or contribute; it does not imply ordering.

The cascade runs to a deterministic fixpoint inside the same instance transaction. Node completion is protected by `(instance_id, node_id)` uniqueness, so replay cannot reveal evidence or complete collaboration twice.

The v2 reward path has one authority:

```text
four-way-testimony
  └─ REWARDS → party-completion-reward
                  └─ UNLOCKS → case-closed
                                  └─ terminal effects → title + seal
```

The duplicate `reward_bundle → status/collectible` award edges are removed from the playable version. Terminal effects declare `recipientPolicy: all_participants` and `claimPolicy: self`.

## Data model

All tables are additive and avoid foreign-key coupling to match the repository's existing schema posture.

### `content_bundles`

Immutable registered artifacts keyed by `(namespace, version)` and unique `content_hash`. Stores the canonical compiled bundle JSON. Re-registering identical bytes is a semantic replay; a different hash at an existing namespace/version is rejected permanently.

### `content_activations`

One active version/hash pointer per namespace. Activation is monotonic by version. Updating the pointer affects only new instances.

### `content_instances`

One organization-scoped run with:

- immutable namespace/version/hash/experience pin;
- server-derived `scope_kind` and `scope_id`;
- creator account and current status;
- monotonic `revision` for stale-state detection;
- forming/started/completed/abandoned timestamps.

One exact bundle experience may run once per organization scope. Repeatable content will require an explicit future run-key policy rather than weakening this invariant.

### `content_instance_members`

Account-level party membership with a current-character/name snapshot, authoritative participant kind, role, and consent timestamps. Database constraints enforce one account and one role seat per instance.

Account identity is intentional: crews and agent/human eligibility represent people rather than disposable streets, and death must not manufacture another unique participant.

### `content_instance_nodes`

Sparse per-node progress with state, acting account/character, safe result JSON, and timestamps. It records normalized choice IDs and answer outcomes, never canonical answer text.

### `content_instance_facts`

Instance-scoped facts keyed by `(instance_id, fact_key)`, including `history.sixth_family.existed`.

### `content_instance_effects`

The exactly-once claim/effect ledger keyed by instance, terminal node, effect ordinal, and subject account. It stores pending/applied/held/failed state and safe payload. Status and collectible ownership are authoritative here; a status claim may also project the title to the living character.

## Party lifecycle

1. A caller creates an instance from an active namespace and chooses one organization scope allowed by the party policy. The server derives the caller's Crew or Family ID; clients never nominate an organization ID.
2. Creation self-seats the caller in an available role.
3. Other eligible organization members self-join and self-claim roles. No leader can assign or consent for another account.
4. Witness eligibility is derived from server state: a living, non-NPC, non-agent account. The client cannot submit participant kind.
5. Consent-required roles must submit their own affirmative consent. Consent remains revocable; `recheckConsent` blocks further actions while required consent is withdrawn.
6. The `start_instance` action locks the instance, rechecks the organization, four unique accounts, four unique roles, participant kinds, and consent, then changes `forming → active` and locks roles.
7. A forming member may leave and free their seat. A leader leaving abandons the lobby. Active parties do not reshuffle roles.
8. Each action rechecks membership, required consent, expected revision, issued action ID, node availability, and role authority under the instance lock.
9. Terminal completion materializes one pending status/collectible effect per participant. Each participant claims their own rows under their own `withCharacter` transaction.

## Transaction and concurrency rules

Every player mutation uses the existing transaction order:

```text
acting character → acting account → content instance → member/node/fact/effect rows
```

The runtime does not lock other participants' character/account rows. This is why terminal effects are self-claimed rather than pushed to four accounts by the final actor.

Database primary/unique keys remain the exact-once authority even when clients omit `Idempotency-Key` or retry an ambiguous committed response with a fresh key. HTTP idempotency remains the first replay layer for all player POST/DELETE routes.

Every instance mutation includes `expectedRevision`. A mismatch returns `409 stale_instance` with a replacement safe instance projection. A matching revision with an action that was not issued returns `unknown_action`.

Operator activation uses `modAuth`. Because mod routes are outside player idempotency hooks, activation itself is transactionally and semantically idempotent through immutable keys and exact-hash replay.

## HTTP surface

### Operator

- `POST /v1/mod/content/activate` — verify, register, runtime-validate, and activate one bundle.

### Player

- `GET /v1/content` — active experiences relevant to the caller plus their instances.
- `POST /v1/content/:namespace/instances` — create a scoped lobby and self-claim the first role.
- `GET /v1/content/instances/:instanceId` — safe instance projection and server-issued actions.
- `POST /v1/content/instances/:instanceId/join` — self-join/self-claim one role.
- `POST /v1/content/instances/:instanceId/consent` — affirm or revoke the caller's own consent.
- `POST /v1/content/instances/:instanceId/act` — start, solve, choose, or perform another server-issued action.
- `POST /v1/content/instances/:instanceId/leave` — leave a forming lobby; leader departure abandons it.
- `POST /v1/content/instances/:instanceId/claim` — apply the caller's exact-once terminal rewards.

All player routes are authenticated. The live route registry remains the source of OpenAPI truth, with strict content schemas added to `agentgateway.js`. The mod activation route remains excluded from public OpenAPI.

## Sixth Chair v2 playable content

The v2 pack preserves the noir premise and adds:

- an explicit runtime manifest;
- complete prompts and private answer specifications for Archivist, Driver, and Broker;
- stable, visible Witness choice options;
- a single reward authority and explicit all-participant/self-claim policies;
- a playable closure containing only mystery, party policy/quorum/roles, chapter, puzzles/choice, evidence, collaboration, world fact, reward bundle, terminal, status, and collectible;
- the original acquisition, salvage, crafting, export, retention, and OMR nodes outside the executable runtime profile.

The first live terminal is value-neutral: it grants only status and a gameplay-inert collectible. It moves no cash or OMR and writes no currency ledger rows.

## Error contract

Stable errors include:

- `content_hash_mismatch`
- `content_version_conflict`
- `content_version_regression`
- `unsupported_content_feature`
- `content_inactive`
- `no_content_instance`
- `stale_instance`
- `unknown_action`
- `bad_role`
- `role_taken`
- `not_member`
- `not_leader`
- `wrong_organization`
- `participant_kind`
- `consent_required`
- `quorum`
- `party_role`
- `wrong_answer`
- `already_complete`
- `nothing_to_claim`

## Verification and success criteria

The slice is complete when focused and integration tests prove:

1. Hash recomputation, immutable registration, monotonic activation, and activation rollover pinning.
2. Runtime-capability rejection for malformed/unsupported executable closures.
3. Four unique self-claimed roles, authoritative participant kinds, and Witness consent.
4. Role lock, consent revocation/reaffirmation, and stale revision recovery.
5. Private answers never appear in board/OpenAPI responses.
6. Correct role-gated solves reveal four evidence nodes exactly once.
7. Four contributions complete testimony and set an instance-only world fact.
8. Terminal completion and per-member status/collectible claims are exact once.
9. The complete run moves zero cash/OMR and adds zero transaction-ledger rows.
10. HTTP replay, database replay, route-auth, migration/disposition, static analysis, compiler, OpenAPI, and relevant lock-order checks pass.

## Deferred adapters

These remain explicit future build-order work and cannot be activated as executable content yet:

- material/item instances and durability;
- salvage source budgets;
- crafting jobs, facilities, tools, and authored mastery tracks;
- Bellini Lockbox export;
- content-triggered qualified/retained referral cash;
- content-triggered OMR reserve settlement;
- public-hook publication and autonomous outreach;
- automatic Agent Turn recommendations for authored instances.

The runtime's capability validator is the product boundary: adding one of these systems requires an adapter, invariant tests, and an expanded capability profile before any pack may execute it.
