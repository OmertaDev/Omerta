# Phase 3D — Dynamic World State and Cross-Season Mystery Design

**Date:** 2026-09-04
**Status:** Architecture approved; formal written specification awaiting user confirmation; implementation planning pending
**Depends on:** Phase 3A sealed graph/runtime; Phase 3B social recovery; Phase 3C typed case outputs; canonical OMERTÀ season clock and existing world authorities
**Scope:** Safe dynamic signals, state snapshots, persistent data-defined consequences, durable facts, exact-hash cross-season dependencies, recovery paths, and historical evidence preservation

## Outcome

Phase 3D lets mysteries adapt to the actual city without letting authored packages query the database or execute code. A package requests a named, versioned signal from a strict server registry. The signal adapter reads canonical state, validates eligibility and privacy, and returns a typed sealed value plus a separately safe projection.

Most puzzle-critical dynamic values are snapshotted when the instance starts. The resulting case stays solvable even when businesses change hands, wars end, characters die, rankings move, or organizational offices turn over. Carefully reviewed live gates are allowed only when their volatility is intentional and a validated recovery path exists.

Cross-season mysteries exchange bounded durable facts and typed completion outputs. They do not depend on external screenshots, Discord archives, or a floating version of last season’s package. Critical history is preserved server-side and has an in-game recovery mechanism for players who missed the original event.

## Binding invariants

1. Authored content cannot contain SQL, JavaScript, shell, template execution, query fragments, field paths, or arbitrary expressions.
2. Dynamic state is accessible only through registered, versioned, typed signal adapters.
3. Signal adapters are read-only. World mutations use separate narrowly allowlisted consequence adapters.
4. Every signal declares privacy, determinism, snapshot timing, volatility, fallback, and recovery behavior.
5. Puzzle-critical volatile state is snapshotted by default.
6. Live gates cannot create an unrecoverable critical path.
7. Clients cannot nominate signal values, season numbers, timestamps, organizations, histories, rankings, or owners.
8. Cross-season imports resolve through exact producer `bundleHash` values and typed export contracts.
9. Content version changes do not create another run, collectible, or consequence for the same logical seasonal entitlement.
10. Persistent facts and consequences are append-only or versioned; a new package does not rewrite historical truth.
11. External community archaeology may enrich optional paths, but required progression must be recoverable in-game.
12. OMR remains disabled. No signal, consequence, recovery, or season migration may mint, move, reserve, or award OMR in Phase 3.
13. NFT export and on-chain state are not mystery signals unless separately approved in a later phase; export eligibility alone is inert.
14. Signal projections, searches, caches, pagination, deltas, and issued actions are audience-bound; hidden world or peer changes cannot perturb an unauthorized viewer's bytes, cursor, counts, ordering, timing class, or stale/error behavior.
15. Original completion and historical recovery compete for one version-independent fact entitlement. They can produce at most one authoritative fact for a logical subject and contract.
16. Logical experience, owner-scope, subject-scope, fact-contract, and consequence-effect identities are durable registry data; package versions can reference them but cannot redefine them.

## Dynamic signal registry

### Registry contract

Each server-owned signal adapter registers:

- stable signal kind and integer adapter version;
- typed input schema containing only approved selectors;
- typed sealed output schema;
- typed safe projection schema;
- canonical database authority it reads;
- privacy classification;
- whether it is deterministic at a given server instant;
- allowed capture modes;
- cache and freshness rules;
- cache partition inputs: endpoint/projection kind; exact resource/instance/list ID; account and current-character IDs/generations; organization kind/ID plus membership/office authority row identity/generation/revision; role-assignment ID/generation; grant/share-set digest; `bundleHash`; adapter/policy version; normalized query/filter/sort/page/region/locale; and response type;
- empty-state fallback behavior;
- recovery requirements;
- validation metadata for static dependency analysis.

Content references a signal by kind/version and supplies only compiler-validated selectors such as a district logical ID, an authored ranking band, a declared item template, or the current instance organization. It cannot supply a table, column, account ID, arbitrary comparator, sort expression, or SQL-like predicate.

### Initial safe signal families

The first registry may support reviewed forms of:

- current business ownership class or safe public owner alias;
- current Family territory control;
- living/dead status of a content-linked character or historical NPC;
- declared bloodline relationship;
- past war outcome or canonical conflict receipt;
- prison or hospitalization state where the participant is authorized to know it;
- wealth/rank band rather than unrestricted balances;
- bounded character or account history receipts;
- item ownership or provenance eligibility without exposing private inventory;
- declared city event or season phase;
- prior content facts and case outputs;
- current organization offices through the existing authority.

Each family has narrow selectors and privacy rules. “Wealth rank,” for example, returns a reviewed band or safe ordered alias set, never private balances or an unrestricted citywide account dump.

Adapters form the viewer-authorized relation before filtering, sorting, counting, paginating, or caching. A query never retrieves a hidden superset and filters afterward. Opaque cursors are integrity-protected and bound to all cache partition inputs, the adapter version, and its stable ordering. A hidden-only authority change either leaves the viewer response byte-identical or changes only an explicitly declared public signal; it never invalidates unrelated actions through an internal global revision.

### Signal modes

Every use selects one compiler-approved mode:

- `capture_at_create` — captured when a personal instance or lobby is created;
- `capture_at_start` — captured after party and organization revalidation;
- `capture_on_reveal` — captured when the node first becomes available;
- `live_gate` — reevaluated under lock for a specific action;
- `historical` — resolved from an immutable event/fact receipt;
- `derived_snapshot` — deterministically derives a safe value from already captured signals through a built-in declarative operator.

Arbitrary expressions are prohibited. Derived snapshots use a tiny typed vocabulary such as equality, membership, stable ordering, threshold band, boolean conjunction/disjunction, and selection by authored mapping. The compiler validates the complete expression tree, depth, and types; it cannot call functions or inspect undeclared fields.

### Default snapshot policy

Any signal that affects the identity of a clue, answer candidate, required location, consumed item, branch, or terminal is snapshotted unless a runtime-capability reviewer approves a live gate.

A snapshot records:

- the sealed typed value used for canonical evaluation;
- its classification and adapter projection inputs. Any cached safe representation is stored separately under the complete audience-bound cache key and cannot become a universal row field.

Later state changes do not alter the snapshot. Authors can deliberately compare a snapshot to a later live observation, but that is modeled as two distinct signal captures with an explicit recovery route.

## Live-state gates and recovery

Live gates are appropriate for temporary access or world interaction, not for silently changing an answer.

Examples include:

- enter a currently controlled district;
- speak with an NPC who is presently available;
- act while the assigned participant is incarcerated;
- inspect an item currently held by an eligible participant;
- use a Family facility that is presently operational.

Every live gate declares:

- authoritative adapter and version;
- reevaluation points;
- maximum expected unavailable interval;
- safe blocker projection;
- one or more recovery paths;
- whether an already-issued action becomes stale;
- item/escrow behavior when availability changes.

Recovery options include waiting for a bounded server time, using an alternate location or role, restoring a facility, retrieving or substituting an approved item, replaying an archived observation, assigning a replacement participant, or entering an authored incomplete terminal.

The validator reports existential `mayReach` and universal `mustPreserveCriticalSuccess` under the cross-cutting joint-state semantics. It rejects a live gate when any reachable correlated combination of signal outcome, choice, role composition, replacement generation, and expiry policy can eliminate every successful terminal or valid recovery contract. A package cannot assume that a particular living player, business owner, office holder, or territory controller will remain present forever. An incomplete terminal does not satisfy a critical Family or season contract unless it grants the declared restart/recovery authority.

## Dynamic puzzle fairness

Dynamic content should resist static answer guides without becoming arbitrary.

Fairness requirements:

- the player receives enough in-game evidence to derive the instance-specific answer;
- the signal value is captured and evaluated consistently;
- two instances with different snapshots can have different correct theories without either being capricious;
- misleading evidence is authored and explainable, not produced by race conditions;
- errors identify safe blockers, not secret values;
- signal changes after snapshot cannot invalidate a correct answer;
- a deterministic support tool can reproduce the sealed evaluation from the bundle and recorded snapshots for moderator review.

No puzzle may require guessing a hidden database value merely because it is dynamic.

## Persistent world consequences

### Consequence adapter boundary

Persistent consequences use a separate registry from signals. An adapter declares exactly which canonical domain operation it can perform, its typed inputs, idempotency key, lock order, reversal/recovery policy, and player-visible projection.

Content cannot name a table or field. Activatable packages list required consequence capabilities, and activation fails closed when an adapter is unsupported.

### Initial approved consequence classes

Phase 3D should begin with low-power, narrative consequences:

- namespace-scoped, account-scoped write-once story flags;
- instance or organization content facts;
- NPC availability variants within authored content;
- later-clue and branch accessibility;
- safe future-scene variants;
- historical case-output references;
- bounded narrative relationship state where an existing reviewed authority supports it.

Business ownership, Family treasury, territory, combat stats, cash, market inventory, reputation with mechanical power, and other core economic state are not generic consequence targets. A later package may affect one only after a dedicated adapter, economy/security review, rollback policy, and tests establish the exact invariant.

### Consequence materialization

Each registered logical effect declares a server-owned uniqueness period: `all_time` or `per_season`. An accepted node resolves that policy to a canonical non-null `epoch_key` (`all-time` for the former, the canonical server season key for the latter) and resolves its declared subject scope to a canonical non-null `subject_key`. Account, character, Crew, Family, city, and global scopes all use registered typed keys; city/global never use SQL `NULL` as identity.

The node then creates a pending consequence effect whose permanent uniqueness key is `(logical_experience_key, logical_effect_id, subject_scope, subject_key, epoch_key)`. Instance, node, effect ordinal, package version, season metadata outside the resolved epoch, and `bundleHash` are provenance, never uniqueness namespaces. The beneficiary or authorized actor applies it through the adapter under the canonical domain lock. The logical effect ID and uniqueness-period policy are registered independently of package versions, so concurrent v1/v2 runs, different seasons for an all-time effect, and original/recovery paths cannot apply the same consequence twice.

Consequences are append-only events. Current projections can use compact state, but history records source instance, season, `bundleHash`, actor, subject, and safe outcome.

## Durable facts and cross-season contracts

### Logical run identity

Seasonal uniqueness is based on:

- logical experience key;
- canonical server-derived season index;
- declared owner/organization scope;
- declared entitlement subject.

Bundle version and `bundleHash` are recorded provenance but do not create a new run identity. Activating v2 in the same season cannot mint a second completion, collectible, output, or consequence for a player who completed v1.

An immutable historical registry owns each `logical_experience_key` and its permitted owner scope, subject scope, run policy, and retired aliases. A later package may reference a registered key but cannot silently change those semantics. Corrections require an explicit registry supersession reviewed as a migration; old identities remain queryable for history and replay.

### Export contracts

A package may export a durable fact or case output with:

- stable contract ID and schema version;
- logical subject scope: account, character where justified, Crew, Family, or city season;
- value type from a strict sealed/public schema;
- creation rule and exact-once key;
- visibility and audience policy;
- retention horizon;
- compatibility and deprecation policy;
- recovery availability;
- whether the fact is required or optional for future content.

Before either original completion or recovery can materialize an export, it resolves an immutable absolute non-null `producer_epoch_key` from the fact contract's registered `all_time` or `per_season` producer-epoch policy and canonical server-derived producer season/run. It also resolves the logical scope to a registered non-null `subject_key`; city/global facts use a canonical city/global key rather than SQL `NULL`. It then atomically claims a permanent fact entitlement keyed by `(contract_id, logical_fact_key, logical_subject_scope, subject_key, producer_epoch_key)`. Relative import selectors such as `previous_season` or a bounded exact season offset never participate in uniqueness. Original completion and later recovery both target the same missing producer epoch and use compare-and-set under the same row lock; the entitlement records the winning creation mode and authoritative fact ID. The loser reads the winner and cannot emit a second fact, reward, completion, or recovery result.

Exports are immutable. Corrections create a new fact version linked through an explicit supersession edge and update a versioned current projection without editing history. A correction does not reopen the entitlement or mint another completion. Retention horizons govern hot/cold placement and safe projection availability, not deletion of identity, provenance, import authority, replay guards, or correction chains.

### Import contracts

A future package imports a stable contract and compatible schema range. Compilation resolves that dependency to exact producer hashes and writes them into the lockfile. The closed selector set is `all_time`, `previous_season`, or a server-bounded exact negative season offset. Each is a total deterministic function of the consumer's canonical epoch and registered contract policy and therefore resolves to at most one absolute `producer_epoch_key` before entitlement lookup. If that exact epoch has no fact, the declared missing/recovery behavior runs. “Latest,” “any prior,” first/last by database order, or authored tie-breaks are forbidden. The first successful resolution writes an immutable consumer binding to one fact/version under the declared correction policy; retries and later producer corrections cannot silently substitute a different historical input.

Packages cannot import “whatever latest fact exists.” Ambiguous selection is a compile error.

An import declares behavior for:

- present compatible fact;
- present deprecated fact with a reviewed declarative migration;
- missing fact with recovery available;
- missing optional fact;
- conflicting historical facts.

### Declarative fact migration

Migration supports only typed, auditable transformations such as enum aliasing, field renaming, defaulting a newly optional field, projecting a subset, or mapping a retired safe ID to a reviewed successor. There is no migration script or expression language.

Migration rules are part of the consumer bundle, validated against producer schemas, and included in the consumer hash. A transformation never invents a completion or value-bearing entitlement.

## In-game historical recovery

Critical paths need an in-game route for players or organizations that did not participate in an earlier season.

Recovery may use:

- an archive NPC or records office;
- a preserved public case summary;
- a replacement investigation with different evidence;
- a repaired historical object or crafted archival tool;
- a Family archive opened by later progress;
- an account-specific catch-up case;
- a server-preserved city event record.

A recovered fact is marked with recovery provenance and may expose less optional lore, but it satisfies the declared critical compatibility contract. Recovery never issues OMR. It also cannot issue the original season's finite rewards, competitive firsts, or unique scarce object. A separately reviewed recovery may provide a bounded non-OMR substitute only through an existing Phase 2 conservation authority and finite reserve; the mystery/recovery profile itself cannot create value.

External sources can provide optional flavor or community shortcuts only when the same required fact remains obtainable in-game.

## Historical item and world-state evidence

Phase 2 item provenance and canonical game event ledgers can serve as historical inputs through registered adapters. A mystery may ask whether an object existed in a prior season, changed hands, was repaired, or participated in a major operation.

The content runtime stores a reference and snapshot digest, not a copy of the item or event authority. If a current owner is private, projections use authored aliases or proof statements such as “the chain of custody has a gap,” not a raw account ID.

Destroying, exporting, or transferring the current object cannot erase the historical receipt. A critical mystery that requires physical possession must declare an approved substitute, restoration, loan/service path, or recovery item source.

## Schema direction

### `content_signal_snapshots`

Immutable captured signal values keyed by instance, signal-use ID, capture generation, and `bundleHash`. Stores adapter kind/version, sealed typed value, classification/projection inputs, captured server time, authority revision/digest, and mutation source. Viewer-safe projections are derived or cached only under the complete audience-bound key; the snapshot row does not hold one broadly reusable “safe” body.

### `content_live_gate_observations`

Append-only reevaluations of live gates with safe outcome, adapter version, authority digest, actor, revision, and time. Hot state records only the latest relevant observation.

### `content_fact_entitlements`

Permanent exact-once authority keyed by contract, logical fact key, logical subject scope, non-null canonical `subject_key`, and non-null absolute `producer_epoch_key`. It records original-versus-recovery winner, authoritative fact ID, creation mutation, and replay-result reference. Payload may be archived, but this identity row and its uniqueness constraint are never deleted. Portable `NOT NULL`, scope/epoch checks, and foreign keys to registered subject/contract identities back the uniqueness rule in both PostgreSQL and pg-mem; correctness never depends on nullable-unique behavior.

### `content_fact_contracts`

Immutable registry for each fact contract and schema lineage: contract ID, logical fact-key vocabulary, allowed subject scopes, explicit `all_time` or `per_season` producer-epoch semantics, allowed deterministic import-selector policy and offset bounds, canonical subject-key resolver, schema versions and compatible migrations, visibility/declassification policy, correction policy, recovery policy, and retired aliases. Content bundles reference registered versions but cannot redefine the identity or silently change what epoch or subject a contract names.

### `content_durable_facts`

Immutable cross-instance/season exports referenced by one `content_fact_entitlements` row. Stores contract/schema version, sealed payload, optional universally public base projection, source instance/hash, provenance, and explicit supersession link. Audience-specific projections derive from classification plus grants and are never reused across viewers. A versioned projection may identify the current correction, while all prior versions remain durable.

### `content_durable_fact_grants`

Audience authority for facts, using the same account/content-role/organization-office policies as evidence and case outputs.

### `content_fact_imports`

Immutable consumer bindings from an instance/import-use ID to one producer fact and exact dependency lock entry. It records migration rule ID, safe result, and whether recovery supplied the fact.

### `content_consequence_effects`

Pending/applied/held/failed consequence authority with the permanent `(logical_experience_key, logical_effect_id, subject_scope, subject_key, epoch_key)` unique key, adapter kind/version, provenance effect ordinal, safe payload, and mutation replay key. `subject_key` and `epoch_key` are non-null registered identities backed by portable checks/foreign keys. It is separate from direct world-domain authority and references the adapter's resulting event. `bundleHash`, package version, instance, node, and nullable SQL identity never participate in the consequence uniqueness constraint.

### `content_recovery_runs`

Audit state for critical missing-fact recovery, including consumer instance, import requirement, recovery `bundleHash`, subject, lifecycle, produced fact, and exact-once authority.

### `content_season_run_keys`

If current `content_instances.run_key` uniqueness is insufficient for cross-version logical identity, a normalized authority binds logical experience, season, subject scope, and completion/entitlement state independently of bundle version.

### `content_logical_experiences`

Immutable registry of logical experience keys, owner/subject scopes and canonical subject-key resolvers, run policies, registered logical effect IDs with immutable `all_time`/`per_season` uniqueness periods, and explicit aliases/supersessions. `bundleHash` values are references and provenance only. This registry prevents a version from changing identity semantics to duplicate a run, fact, collectible, or consequence.

## State machines

### Signal snapshot

```text
declared → captured → immutable
              └────→ unavailable → fallback/recovery
```

### Live gate

```text
unchecked → available
     │          └→ changed/stale → reevaluate
     └────→ blocked → wait | alternate | recovery | incomplete terminal
```

### Durable fact

```text
pending → materialized → imported
                    └→ superseded by linked correction
```

### Consequence

```text
pending → applied
    ├──→ held/retryable
    └──→ failed → reviewed recovery
```

An ambiguous consequence never releases its domain idempotency authority for a blind second attempt. The runtime reads canonical state to reconcile before continuing.

### Historical recovery

```text
eligible → active → recovered_fact
              └──→ abandoned/restart according to run policy
```

## Transaction and lock order

Signal capture that occurs during an action follows the normal content lock order and reads canonical signal authorities in a registered stable order. Snapshot insertion and node advancement commit together.

Consequence application follows:

1. Resolve exact bundle, consequence adapter, pending effect, and target authority without locks.
2. Lock affected character rows, then account rows, in canonical ID order.
3. Lock affected subject organizations and organizational authorities in canonical ID order.
4. Claim the content-domain mutation guard.
5. Lock the content instance and the registered consequence target as domain aggregates in canonical type and ID order.
6. Lock any item, shared cap, or singleton rows required by the dedicated adapter in the remaining global order.
7. Recheck run key, permanent logical effect uniqueness, eligibility, and the issued action's exact dependency/precondition vector; apply the domain mutation and its domain event.
8. Mark the content consequence applied with the resulting event reference, increment the internal canonical mutation revision, advance only affected audience cursors, store the replay result, and commit.

Fact materialization and import follow the global order explicitly: resolve the exact bundle, registered fact contract, absolute producer epoch, subject, and candidate fact without locks; lock affected character rows, account rows, and organization/authority rows in canonical order; claim the domain mutation guard; lock the current content instance; then lock the fact entitlement, fact version, and import-binding rows in stable contract/subject/epoch/ID order. Under those locks, recheck subject/audience authority, dependency lock, schema/correction policy, exact producer epoch, and issued action preconditions; compare-and-set the entitlement or create the immutable import binding, advance only affected audience cursors, store the deterministic replay result, and commit. Imports do not lock or mutate the historical producer instance.

## Validation

The compiler and activation validator reject:

- unknown signal or consequence adapters;
- adapter version mismatch;
- unsafe selectors or unbounded queries;
- a signal output used with the wrong type;
- critical volatile signals without snapshot or recovery;
- live gates with no bounded fallback or terminal;
- any reachable correlated signal-outcome/choice/composition/replacement/expiry state that fails the cross-cutting joint-state `mustPreserveCriticalSuccess` property;
- dynamic answers not derivable from projected in-game evidence;
- direct references to raw account, table, column, balance, or organization identifiers;
- floating cross-package or cross-season dependencies;
- incompatible durable fact schemas;
- ambiguous previous-season selection;
- circular fact imports across packages or seasons;
- migrations that invent required completions or value;
- missing-fact behavior with no critical-path recovery;
- repeated logical run or entitlement identities across versions;
- redefinition of a registered logical experience, owner scope, subject scope, fact entitlement, or effect ID by a package version;
- consequence uniqueness that includes `bundleHash`, content version, instance, or node instead of the permanent logical effect key;
- a nullable, unregistered, or policy-inconsistent `subject_key`, `epoch_key`, or `producer_epoch_key` in a fact/effect identity;
- a critical physical item dependency with no conservation-safe recovery;
- core-world consequence targets without a registered reviewed adapter;
- external-only critical dependencies;
- OMR, broad NFT, treasury, or arbitrary economic effects.

Reports identify dynamic signal count, snapshot/live ratio, volatility exposure, critical recoveries, cross-season depth, durable fact fan-in/fan-out, consequence surface, historical-item dependencies, and privacy classifications.

## Security and red-team requirements

Tests attack:

- SQL-like and prototype-pollution selectors;
- requesting unauthorized accounts or private balances through a signal;
- client-supplied seasons and timestamps;
- signal changes between projection and mutation;
- ranking and ownership leakage through empty states, counts, errors, or deltas;
- replaying snapshot capture to obtain a preferable value;
- bundle rollover changing an active snapshot;
- importing a fact from another account, organization, or season;
- substituting a newer producer hash outside the lockfile;
- using version bumps to repeat a seasonal run or consequence;
- concurrent recovery and original-fact materialization;
- duplicate consequence application after an ambiguous response;
- office/organization churn during a consequence;
- destroying or exporting a critical item after action issuance;
- external URL or embedded executable content;
- hidden OMR or economic movement through a “narrative” consequence.

## TDD and verification

Minimum failing-first tests include:

1. Registry schema and unknown-adapter rejection.
2. Capture-at-create, start, reveal, historical, derived, and live-gate modes.
3. Signal privacy for ownership, wealth/rank band, history, item, territory, and organization office families.
4. Snapshot stability after canonical world state changes.
5. Live gate staleness and every approved recovery policy.
6. Dynamic puzzles with instance-specific but fully derivable answers.
7. Durable fact export/import across `all_time`, `previous_season`, and bounded exact-offset selectors, including missing exact epochs and rejection of latest/any-prior/database-order selection.
8. Missing optional, missing recoverable, incompatible, deprecated, corrected, and conflicting facts.
9. Declarative migration allowlist and malicious migration rejection.
10. Version rollover proving one logical seasonal run and entitlement.
11. Concurrent original completion and recovery races in both orders for account and city/global subjects, proving one permanent entitlement and one authoritative fact with non-null canonical subject/producer epoch identities.
12. Persistent consequence exact-once and ambiguous-result reconciliation, including concurrent v1/v2 attempts at the same logical effect, an all-time account effect across different seasons, a city-season original/recovery race, portable constraint behavior, and rerun after archival/restore.
13. Immutable import binding, explicit correction supersession, hot-to-cold archival, backup/restore, and replay after payload archival.
14. Historical item transfer, consumption, repair, and selective export readiness.
15. Private signal and fact noninterference across projections, stale responses, errors, replays, deltas, caches, searches, counts, and pagination cursors.
16. Byte-identical unauthorized views and still-valid unrelated issued actions after hidden-only authority changes.
17. Universal critical-success witnesses across every reachable correlated dynamic outcome, role/replacement composition, choice, and expiry state, including a dead combination that passes naive per-axis checks.
18. pg-mem route/runtime coverage.
19. Real PostgreSQL migration, locking, concurrency, rollback, original/recovery race, and v1/v2 consequence-race tests.
20. Cross-season reachability and population simulation, including players who skipped prior seasons.
21. Full repository regression.

## API and projection direction

The content API exposes safe blockers, captured observations, current live-gate state, recovery actions, durable facts visible to the caller, and season relationship labels. Server times and season indices are authoritative.

It never exposes sealed signal values, raw authority revisions, private ranking/balance data, dependency-lock internals that reveal secrets, other subjects’ facts, or arbitrary signal queries.

Every safe response uses an opaque audience-bound cursor and cache key containing endpoint/projection kind; exact resource/instance/list ID; account/current-character IDs/generations; organization kind/ID and membership/office authority identity/generation/revision; role-assignment ID/generation; fact/evidence/share-grant digest; `bundleHash`; adapter/policy version; normalized query/filter/sort/page/region/locale; and response type. Issued actions bind only the exact visible and domain preconditions they require; an internal canonical revision is never projected or used to leak unrelated hidden activity. Tests replay equal-generation cursors across different resources, instances, organizations, roles, filters, pages, and locales and require safe rejection with no cache contamination.

The Content Desk distinguishes:

- historical snapshot;
- current live observation;
- changed state requiring recovery;
- original season fact;
- recovered archival fact;
- optional community-history reference.

This makes dynamic behavior understandable without exposing canonical answers.

## Compatibility

- Existing once-per-season content retains its current server-derived run keys.
- New logical run-key authority is introduced compatibly and does not reissue old entitlements.
- Existing story flags remain valid but become cross-season imports only through explicit reviewed contracts.
- Existing world and item ledgers remain authority; signal snapshots reference them.
- Old content bundles do not gain dynamic or consequence adapters automatically.
- Active instances pin their prior runtime and projection versions.

## Acceptance criteria

Phase 3D is complete only when:

- packages can use reviewed game-state signals without code or database query fragments;
- puzzle-critical dynamic values remain stable through immutable snapshots;
- every live critical dependency has a validated recovery path;
- dynamic answers are derivable from in-game evidence and reproducible for review;
- exact-hash cross-season exports/imports preserve historical facts and prevent version-based duplicate runs;
- players who missed prior critical content can recover required facts in-game without receiving expired scarce rewards;
- narrative consequences apply once through narrow domain adapters and preserve history;
- privacy tests prove signals and facts do not leak hidden world or account state;
- pg-mem, real PostgreSQL, concurrency, graph, population, API, and full regression suites pass;
- OMR, treasury, cash, and broad NFT state remain untouched;
- no unresolved Critical or Important review finding remains.

## Non-goals

- Phase 3D does not expose arbitrary database queries or a general expression language to content.
- It does not make every clue depend on live world state.
- It does not require external archives for critical progression.
- It does not rewrite historical facts when lore or content versions change.
- It does not grant generic authority over businesses, territory, treasury, combat, reputation, items, or currencies.
- It does not enable production cross-Family cases.
- It does not activate OMR rewards or NFT contracts.
- It does not guarantee that every optional seasonal scene is available to players who missed it; only critical compatibility facts require recovery.
