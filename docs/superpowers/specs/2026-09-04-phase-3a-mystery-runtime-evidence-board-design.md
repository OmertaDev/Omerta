# Phase 3A — Mystery Runtime and Evidence Board Design

**Date:** 2026-09-04
**Status:** Architecture approved; formal written specification awaiting user confirmation; implementation planning pending
**Depends on:** Phase 1 authored-content runtime, Phase 1 world graph and item ledger, Phase 2 item-definition and recipe adapters
**Scope:** Runtime convergence, evidence privacy, investigation boards, structured theories, large-graph execution, and the validation baseline required by later Phase 3 work

## Outcome

Phase 3A turns the existing authored story runtime into a reusable investigation engine. Authors describe safe public metadata in immutable public packages and canonical answers, private evidence, and hidden graph truth in a separately access-controlled data-only overlay. A trusted compiler joins them into a sealed execution bundle and a separately safe public projection. Players investigate through server-issued actions and audience-bound projection cursors; authored content never executes JavaScript, SQL, templates, or arbitrary queries.

The primary product outcome is an evidence board that supports real deduction rather than a checklist of completed nodes. Evidence can be private, shared, ambiguous, contradictory, or incomplete. Players propose relationships and submit structured theories, while canonical truth remains server-only.

Phase 3A also establishes the runtime performance model required for thousands of nodes: indexed compiled graphs, frontier-based availability, bounded audience-projection deltas, iterative validation, and component-scoped diagnostics.

## Binding invariants

1. The authored JSON package is dependency truth, but never mutation authority by itself.
2. Only allowlisted condition, signal, action, and effect adapters may execute.
3. Private evidence is private by default and is filtered server-side on every response path.
4. Hidden content may conceal its body, identifier, existence, and graph cardinality when declared fully hidden.
5. Clients submit only server-issued action IDs, stable option or board IDs when requested, and the opaque audience-bound cursor or precondition token issued for that action. The internal canonical mutation revision is never projected.
6. Canonical answers, canonical graph links, verifier inputs, unrevealed evidence, raw account IDs, and internal organization IDs never enter player projections.
7. Every state-changing action is transactionally replay-safe and has a domain-level mutation authority in addition to HTTP idempotency.
8. Mystery effects cannot grant OMR in Phase 3. Activatable Phase 3 profiles hard-reject every OMR effect or allocation node.
9. `collection_log` may record a discovery badge after completion but is never mystery state, evidence authority, item ownership, or reward authority.
10. Value-bearing item requirements and consumption use the Phase 2 item ledger and its locks; mystery tables never imitate inventory.
11. Active instances pin an exact immutable `bundleHash`. Activation rollover affects new instances only.
12. Source files and builds never self-activate. An operator promotes an exact compiled artifact and hash.

## Existing runtime and convergence policy

OMERTÀ currently has two relevant execution paths:

- the exact-hash authored-content runtime under `src/content`, with activation, instances, members, nodes, facts, effects, revision checks, and safe answer handling;
- the direct Phase 1 world-graph mystery and operation modules, which prove item escrow, distinct accounts, and Belladonna integration.

Phase 3 content uses the authored-content runtime as the canonical definition and narrative plane. The direct Phase 1 mystery and operation routes remain supported as compatibility demonstrations until equivalent authored adapters have production evidence. They do not receive new Phase 3 package-only behavior.

The generic Phase 2 item ledger remains the only authority for value-bearing evidence objects, tools, crafted devices, materials, and unique items. The authored runtime stores references and use receipts, not a second inventory.

## Package and compiler contract

### Package identity and secret overlay

Each package declares a discriminated kind and the fields allowed for that kind. An activatable `experience` declares:

- `schemaVersion`;
- stable, globally qualified `namespace`;
- monotonic integer `version`;
- exactly one primary `experienceId`;
- content profile and required runtime capabilities;
- logical imports and compatible version ranges;
- entry nodes, terminals, and recovery terminals;
- public metadata;
- a public secret-contract declaration naming the required overlay schema without revealing secret IDs or graph shape;
- difficulty intent and author-declared budgets.

A `library` declares reusable typed definitions and no primary experience or entry node. A `fixture` is permitted only below server-owned non-activatable test roots and may use synthetic secrets. Activatable packages use only the closed `phase3_mystery` capability profile; Phase 2 dependencies identify artifacts from the closed `phase2_economy` profile rather than inventing a hybrid profile.

The public half lives in this public repository. Production private evidence bodies, canonical solution material, hidden nodes and edges, secret candidates, verifier data, and secret-bearing dependencies live only in an approved private content repository or secret artifact store. Trusted builds pair the halves by namespace, version, public `sourceHash`, and overlay contract version. Public CI uses synthetic overlays and verifies only a signed non-oracular production attestation ID/status; raw `secretOverlayHash`, private `dependencyLockHash`, and secret-bearing `irHash`/`bundleHash` values remain access-controlled with the plaintext secrets.

The compiler resolves imports to exact hashes. Safe dependencies use the reviewed public lock subset; secret-bearing dependencies use the private exact lock. An active bundle therefore never follows a floating dependency. Package-local IDs are qualified during compilation so separately authored packages cannot collide.

### Sealed artifacts

Trusted compilation emits distinct artifacts from the paired public source and private overlay:

1. **Server bundle:** complete graph, private prompts, answer specifications, canonical links, action/effect definitions, resolved imports, and runtime indexes.
2. **Public manifest:** safe discovery metadata, declared visible structure, UI vocabulary, and no secrets.
3. **Validation reports:** a safe public structural/status report plus an access-controlled exact report containing secret-bearing reachability, recovery, classification, and compatibility witnesses.
4. **Economy report:** item sources, sinks, custody transitions, mystery demand, conservation findings, and zero-OMR attestation.
5. **Social/privacy reports:** safe aggregate status publicly and exact classification flow, declassification, role composition, contribution, replacement/recovery, and noninterference fixtures only in the access-controlled store.
6. **Difficulty report:** approximations and author-declared intent, explicitly not a solvability proof.
7. **Knowledge manifest:** safe entities and relationships for repository knowledge tooling; it is not runtime authority.

Hashing uses the cross-cutting domain contract: `sourceHash`, `secretOverlayHash`, `dependencyLockHash`, and `irHash` are independently canonicalized; `bundleHash` binds those inputs without appearing inside its own lock; `publicManifestHash` covers only the safe public manifest. Server-internal/database compatibility columns called `content_hash` map explicitly to `bundleHash`. New public Phase 3 projections expose only `publicManifestHash` or a safe public version plus opaque action/cursor tokens; they never publish secret-bearing `bundleHash` as a stale-check or equality oracle.

### Safe declarative vocabulary

Phase 3A adds graph node types for:

- `evidence`;
- `deduction`;
- `board_entity`;
- `theory_schema`;
- `theory_submission`;
- `observation`;
- `interview`;
- `investigation_choice`;
- `recovery`;
- `terminal`.

Evidence kinds include person, place, event, object, transaction, statement, rumor, photograph, and document. A package can define presentation metadata and semantic tags, but it cannot define rendering code.

New allowlisted edge semantics include:

- `REVEALS`;
- `UNLOCKS`;
- `REQUIRES`;
- `REQUIRES_ANY`;
- `CONTRADICTS`;
- `SUPPORTS`;
- `REFERENCES`;
- `DERIVES`;
- `EXCLUDES`;
- `RECOVERS`;
- `CONTRIBUTES_TO`.

Canonical `SUPPORTS` and `CONTRADICTS` links are sealed truth. Player-proposed links use a runtime board ledger and never alter the compiled graph.

## Evidence privacy model

### Visibility policies

Every evidence or deduction node declares exactly one base policy:

- `public` — discoverable content is visible to every eligible viewer;
- `instance_shared` — visible to every current instance member after reveal;
- `actor_private` — visible only to the account that discovered or received it;
- `role_private` — visible to the active holder of one or more declared roles;
- `audience_private` — visible only through explicit runtime grants;
- `sealed` — never directly projected; used for canonical truth and validation.

Evidence is private unless its package explicitly selects a broader policy. Omitting the policy is a compile error.

Evidence, facts, proposed relationships, reports, theory inputs, and case outputs carry a structured audience predicate over principals plus exact scope/assignment generations. Account-, role-, Crew-, Family-, and office-scoped audiences are incomparable when their subject/scope IDs differ. Derived values intersect all input predicates and preserve those IDs/generations; an empty intersection is sealed/unprojectable. Any widening requires a closed compiler-known declassification transform with a fixed safe output schema. Such transforms cannot copy source text, expose secret IDs/counts/digests, preserve secret candidate ordering, or accept author-provided logic. Every use emits a deterministic private privacy-report entry and noninterference fixture. Human rationale can explain the transform but is never interpreted as machine authority.

Theory inputs use normalized exact values, finite enums, bounded sets, or bounded token sequences. Ordinary author-provided regular expressions are forbidden. Any future pattern matcher requires a separately reviewed RE2-like closed adapter with explicit size/time limits and is outside Phase 3A.

### Redaction levels

The package separately declares how an unauthorized viewer perceives a node:

- `absent` — no identifier, count, placeholder, or edge is exposed;
- `placeholder` — a safe authored placeholder is visible but no private body or relationship leaks;
- `redacted` — a public summary is visible while private fields remain sealed.

Edges incident to an absent node are absent. Counts, progress denominators, action labels, error messages, deltas, and timestamps must be calculated after audience filtering so they cannot reveal a hidden branch indirectly.

### Evidence grants

An evidence grant is server-issued to an account, role seat, instance, or organizational audience. It includes the evidence ID, grant source, `bundleHash`, internal reveal revision, and optional revocation policy. Grant sources are allowlisted runtime events such as discovery, interview completion, role assignment, explicit share, or authored cascade.

Role reassignment does not silently copy actor-private evidence. Role-private evidence follows the currently active role only if its definition says `followsRole`; otherwise it remains with the original account and must be shared through an explicit action.

### Projection noninterference

The same projection function and audience evaluator must handle:

- content discovery;
- instance refresh;
- post-mutation state;
- stale-action safe replacements;
- validation and domain errors that return state;
- HTTP idempotency replays;
- live or polling updates;
- audience-projection cursor deltas;
- moderator-safe player impersonation views, if retained.

No secondary error or replay path may serialize internal rows directly. Tests compare authorized and unauthorized projections to ensure that secrets do not influence unauthorized output except through explicitly authored placeholders.

## Investigation board

### Board entities

The player board is an instance-scoped notebook layered over immutable evidence. A board entity can reference revealed evidence or be an authored public entity such as a known person or place. It stores only presentation-safe labels and references; it does not duplicate the private evidence body.

### Proposed relationships

A member may propose a relationship using an allowlisted predicate and visible board endpoints. A proposal records:

- proposer account;
- endpoint IDs;
- predicate;
- optional safe note with length and markup limits;
- audience;
- revision created;
- state: active, withdrawn, incorporated, or rejected by a later authored resolution.

The runtime does not confirm each correct relationship immediately. Packages declare whether a checkpoint evaluates a set of proposals, requests a structured theory, or merely records the group’s current interpretation. Wrong proposals are gameplay state, not application errors.

User-authored notes are inert text. They are escaped, length-limited, excluded from compiled evaluation, and never interpolated into SQL, HTML, prompts, or executable expressions.

### Structured theories

A theory schema defines typed fields such as suspect, motive, means, location, time, accomplice, sequence, and supporting evidence. Fields may require one value, an ordered list, or a bounded set of visible evidence IDs.

The server validates theory submissions against the sealed answer specification after rechecking:

- current server-issued theory action and its exact dependency preconditions;
- actor membership and role;
- field shape and allowed visible candidates;
- evidence ownership or sharing requirements;
- attempt/cooldown policy;
- irreversible-choice policy.

The stored public result identifies selected public IDs and a safe outcome code. It never stores or returns the canonical solution body. Incorrect submissions may unlock authored consequences, but punishment, item consumption, and lockout behavior must be explicit and recoverable under graph validation.

## Runtime state and schema direction

Exact migration names may be adjusted to repository conventions, but the approved logical schema is additive.

### Existing tables retained

- `content_bundles` and `content_activations` remain bundle and activation authority.
- `content_instances` remains lifecycle and internal canonical-mutation-revision authority; player-visible freshness uses audience-specific projection cursors and action preconditions.
- `content_instance_members` remains account membership authority.
- `content_instance_nodes`, `content_instance_facts`, and `content_instance_effects` remain sparse progress, fact, and exact-once effect authorities.

### Additions and extensions

#### `content_bundle_artifacts`

Stores immutable safe metadata for one `bundleHash`: schema/profile, public manifest, safe public lock subset, trusted-overlay attestation reference, compiled index version, safe validation/difficulty summaries, and `publicManifestHash`. The private exact lock, `secretOverlayHash`, secret validation witnesses, and execution data stay only in the access-controlled server bundle/artifact store.

#### `content_instance_evidence`

One immutable evidence occurrence per instance and logical evidence ID, including reveal source, internal reveal revision, `bundleHash`, and safe lifecycle state. The body remains in the pinned bundle rather than copied into the row.

#### `content_evidence_grants`

Audience authority keyed by evidence occurrence, subject kind, subject identifier, and grant generation. It records provenance and revocation state. Unique constraints make a repeated reveal or share a semantic replay.

#### `content_board_entities`

Instance-scoped safe board references. An entity can point to a revealed evidence occurrence or an authored public entity. Uniqueness prevents duplicate materialization of the same compiled entity.

#### `content_board_links`

Player-proposed relationships with proposer, visibility audience, safe note, and lifecycle state. A mutation ID and deterministic output ordinal prevent replay duplicates.

#### `content_theory_submissions`

Append-only, bounded attempts with schema ID, actor, public selection payload, sealed evaluation code, revision, and mutation ID. Canonical answer material is never stored in the submission payload.

#### `content_instance_events`

Append-only audit events for reveal, share, link, theory, choice, recovery, and terminal transitions. Hot projections use compact current-state tables; the event ledger supports provenance, incident review, and deterministic replay analysis without turning `content_instances` into unbounded JSON history.

All new tables use exact `bundleHash` values and account IDs as server authority. Public projections map accounts and organizations to safe participant handles where appropriate.

## Runtime state machines

### Instance lifecycle

```text
forming → active → completed
   │        │
   └──────→ abandoned
            │
            └────→ recoverable → active
```

`recoverable` is used only when an authored and validator-approved recovery rule exists. It cannot erase prior events, restore consumed value without an explicit conservation-safe compensation source, or reset a one-time reward.

### Evidence lifecycle

```text
unrevealed → revealed → granted/shared
                         │
                         └→ revoked (only if declared)
```

Revocation hides future access but does not pretend the player forgot a clue. Packages should use revocation only for access-controlled records or temporary observations, not ordinary learned facts.

### Theory lifecycle

```text
issued → submitted → incorrect | partial | accepted
                    └──────────→ consequence/retry when declared
```

The server never accepts a theory that was not issued in the current safe projection.

## Transaction and lock order

The runtime follows the repository’s canonical transaction discipline:

1. Resolve the exact bundle and server-issued action without locks.
2. Lock affected character rows, then account rows, in canonical ID order.
3. Lock affected organization and organizational-authority rows in canonical ID order when the action uses them.
4. Claim the content-domain mutation guard.
5. Lock the content instance as the primary domain aggregate, then the acting membership/role and relevant evidence, board, or theory rows.
6. Lock Phase 2 item lots and unique instances in canonical item order when the action uses value.
7. Lock any shared caps or singleton world rows in canonical key order.
8. Re-evaluate visibility, gates, the issued-action dependency/precondition vector and its named aggregate revisions, and action authority; never compare an unrelated global instance revision as a viewer-visible precondition.
9. Apply state, grants, item uses, and events; advance the indexed frontier to a deterministic fixpoint.
10. Increment the internal canonical mutation revision once, update only affected audience projection generations, store the caller-safe mutation result, and commit.

Value-bearing items follow the stricter Phase 2 item lock discipline at step 6, after the primary domain aggregate and before shared caps or singleton rows. Terminal effects remain self-claimed under each beneficiary’s own character/account lock unless a later reviewed adapter provides another safe pattern.

## Indexed execution and audience-projection deltas

The compiler assigns deterministic node ordinals and emits indexes for incoming prerequisites, outgoing transitions, audience dependencies, terminal ancestry, recovery paths, and runtime adapter use.

The runtime maintains a sparse active frontier rather than scanning every node after every action. A transition reevaluates only directly affected dependents and queued cascades. The cascade has a compiled upper bound and fails closed if the supposedly acyclic executable closure exceeds it.

Clients request a state snapshot or delta after an opaque signed audience cursor. Internally the cursor binds endpoint/projection kind; exact resource/instance/list ID; `bundleHash`; projection-policy version; account and current-character IDs/generations; organization kind/ID and exact membership/office authority identity/generation/revision; role-assignment ID/generation; grant/share-set digest; normalized query/filter/sort/page/region/locale; and last viewer-visible change. It advances only for viewer-visible changes in that exact projection. A hidden-only mutation leaves an unauthorized viewer's snapshot bytes, cursor, issued actions, empty delta, cache metadata, and stale behavior unchanged. If the cursor is expired or an authorized binding changed, the server returns a safe full replacement and new opaque cursor without describing a hidden cause.

Instance projections are paginated by chapter or board region for large cases. Projection, delta, search, pagination, and cache keys use the complete binding above plus response/media type. Queries construct the viewer-authorized relation before filtering, sorting, counting, paginating, or caching; they never search a hidden superset and filter afterward. Equal numeric authority generations in two organizations, instances, resources, or role assignments cannot collide.

## Validation requirements

Phase 3A expands compilation into ordered validation stages:

1. Strict schema and unknown-field rejection.
2. Package and exact-import resolution.
3. Canonical ID qualification.
4. Runtime capability closure.
5. Structural and endpoint compatibility checks.
6. Iterative strongly connected component and prerequisite analysis.
7. Existential entry-to-terminal reachability plus universal critical-success preservation across every allowed irreversible choice/outcome class.
8. Evidence audience and projection-flow analysis.
9. Classification propagation, closed-declassification, theory candidate, and sealed-answer validation.
10. Item/facility/profession dependency checks against the resolved Phase 2 manifests.
11. Reward and OMR boundary validation.
12. Difficulty/report generation.

The validator rejects:

- secret nodes referenced by public metadata, counts, labels, or errors;
- role-private evidence with no attainable audience;
- theories whose required evidence can never be visible to an authorized submitter;
- canonical answers appearing in public fields;
- a restricted value flowing to a broader audience without a closed declassification transform, or a transform that exposes source text, secret IDs/counts/digests/order, lacks a privacy-report witness, or depends on prose;
- a production secret contract without an exact access-controlled overlay, an overlay/public-source hash mismatch, or any secret material present in the public half;
- action paths that consume a critical unique item without a recovery route;
- mystery prerequisite cycles;
- any reachable correlated choice/outcome/role/generation/timer state that fails the cross-cutting joint-state `mustPreserveCriticalSuccess` property; an incomplete terminal does not count as critical success unless it produces the declared restart/recovery contract;
- unbounded attempts or cooldown arithmetic;
- an authored regular expression or unbounded matcher;
- unsupported adapters;
- all executable content forms, including JavaScript, SQL, shell, external URLs with execution semantics, or expression languages;
- any OMR effect in a Phase 3 profile.

Warnings identify high hidden-node fanout, misleading progress totals, very broad audiences, suspiciously shallow theories, and package components approaching configured validation budgets.

## TDD and verification

Implementation proceeds in failing-test slices. Minimum suites include:

1. Compiler fixtures for every evidence kind, visibility policy, redaction mode, board predicate, and theory field type.
2. Private-evidence noninterference tests across discovery, refresh, stale replacement, mutation success, mutation error, replay, delta, and pagination responses.
2a. Byte-level tests proving a hidden-only action leaves an unauthorized viewer's snapshot, opaque cursor, issued actions, empty delta, cache response, pagination, search total, and error/stale behavior unchanged.
3. Negative tests proving IDs, counts, timestamps, edge shapes, action labels, blockers, and errors do not leak absent evidence.
4. Structured-theory tests for correct, partial, incorrect, replayed, stale, unauthorized, and malformed submissions.
5. Board-link tests for visibility, withdrawal, duplicate mutation, note escaping, and invalid hidden endpoints.
6. Exact-hash rollover tests proving active instances keep their pinned bundle.
7. Item-gated mystery tests using Phase 2 inventory without duplicating inventory in content tables.
8. Recovery-path and irreversible-choice tests.
9. Synthetic graphs at 1,000, 5,000, and at least 10,000 nodes, including long chains, broad fanout, many components, and adversarial cycles.
10. Performance budgets for compile time, peak memory, instance projection, delta generation, and one-action frontier advancement.
11. pg-mem route and runtime tests.
12. Real PostgreSQL schema, migration, index, transaction, and concurrent replay tests.
13. Malicious-package fixtures containing executable-looking strings, prototype-pollution keys, oversized inputs, invalid Unicode, hidden-answer aliases, and dependency-lock substitution.
14. Full repository regression suite.
15. Public/private source pairing, secret-overlay digest, trusted-build attestation, public-repository scan, public CI artifact/cache/source-map scan, and synthetic-overlay tests.
16. Domain-separated hash fixtures proving no lock contains its own `bundleHash` and identical trusted inputs reproduce all hashes.
17. Package-kind/profile fixtures proving one primary entry for `experience`, none for `library`, synthetic-only non-activatable `fixture` roots, and rejection of invented capability profiles.
18. Restrictive classification propagation and every closed declassification transform, including rejection of prose authority and ID/count/digest/order equality oracles.
19. Audience-bound cache/search/pagination tests proving authorization precedes filter/count/sort/page and that endpoint, resource/instance/list, account/character, organization kind/ID/authority, role assignment, grant set, normalized query/filter/sort/page/region/locale, response type, bundle, and policy cannot cross-contaminate cursors or caches.
20. Cross-resource cursor replay and cache-poison fixtures using equal generation numbers across different instances, organizations, roles, queries, pages, and locales.

## Compatibility and migration

- Existing activated content bundles remain immutable and runnable through their existing profile.
- Existing `content_instances` retain their exact hashes and projection version.
- New evidence-board tables are populated only for new capability profiles; no backfill invents private evidence for old runs.
- Existing gameplay-inert Bellini inventory remains separate and cannot become Phase 2 value inventory through a Phase 3 action.
- Existing direct Belladonna/world-operation routes remain available until explicitly deprecated after equivalent authored integration tests.
- New clients receive capability/version fields and can fall back to the current linear content timeline when evidence-board capabilities are absent.
- Backup, restore, migration disposition, and clean-start checks must include every new authority table before activation is possible.

## Observability and operations

Metrics include activation validation duration, compile memory, frontier work per action, projection bytes by audience, delta fallback rate, action-precondition conflicts, denied private-evidence access, theory attempts by safe outcome, and mutation-guard replays. Metric labels and cardinality cannot include secret semantic IDs.

Ordinary operational logs use opaque instance IDs, opaque instance-local ordinals or keyed handles for private/sealed nodes, a non-secret deployment/artifact handle, safe outcome categories, and opaque account identifiers. Raw secret-bearing `bundleHash` values appear only in the access-controlled artifact registry or a separately classified registry-equivalent audit sink with identical access/retention/export controls; they never enter general application logs, support exports, client telemetry, or public reports. Public logical node IDs are logged only when their classification is public. Logs never contain secret semantic IDs, canonical answers, private evidence bodies, hidden edge identifiers, player notes, complete sealed bundles, or equality-oracle digests. A captured-log privacy fixture scans reveal, theory, stale, replay, error, and completion flows for every forbidden value.

Operators can deactivate a namespace for new instances without mutating active instances. Emergency action can freeze new mutations for a bundle hash while preserving read and recovery access; it cannot silently rewrite state or issue value.

## Acceptance criteria

Phase 3A is complete only when:

- a validated package can define evidence, deductions, board entities, proposed links, and a structured theory without custom routes;
- private evidence passes noninterference testing on every projection and replay path;
- an active instance executes from indexed frontier state rather than full-graph scans;
- a 10,000-node synthetic graph compiles and validates within an approved CI budget without recursion failure or quadratic witness copies;
- canonical truth and answers remain in the access-controlled overlay and sealed server store and are absent from the public repository and public build/CI artifacts;
- value-bearing item dependencies use the Phase 2 ledger transactionally;
- graph validation detects unreachable evidence, impossible theories, unsafe item destruction, and forbidden capabilities;
- CLI/CI validation calls the same activatable-profile validation used by runtime activation;
- pg-mem, real PostgreSQL, concurrency, API, backup, and repository regression suites pass;
- no action moves or emits OMR;
- spec-compliance, code-quality, privacy, exploit, and graph-scale reviews have no unresolved Critical or Important finding.

## Non-goals

- Phase 3A does not author the mass production corpus.
- It does not implement Crew replacement, synchronized multi-role operations, or Family hierarchy beyond compatibility hooks.
- It does not allow cross-Family production diplomacy.
- It does not award OMR or deploy an OMR vault adapter.
- It does not deploy NFT contracts or broadly tokenize evidence or items.
- It does not confirm every correct player-proposed relationship automatically.
- It does not treat automated difficulty scores as proof of intellectual difficulty.
- It does not permit external Discord history, screenshots, or web content as a critical-path dependency.
