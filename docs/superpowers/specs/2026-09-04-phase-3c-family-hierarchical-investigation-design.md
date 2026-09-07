# Phase 3C — Family and Hierarchical Investigation Design

**Date:** 2026-09-04
**Status:** Architecture approved; formal written specification awaiting user confirmation; implementation planning pending
**Depends on:** Phase 3A investigation runtime and evidence grants; Phase 3B roles, contribution receipts, and participant recovery; existing Crew, Extended Family, and organizational authority
**Scope:** Family conspiracies, child Crew-case aggregation, rank-aware information flow, organizational decisions, contribution rollups, and recovery from organizational churn

## Outcome

Phase 3C lets several Crew investigations combine into one Family conspiracy without flattening the organization into a shared checklist. Soldiers and specialists collect observations, Crews solve local cases, Capos choose what their Crews report, Underboss-level roles coordinate cross-Crew deductions, and a Boss-level role can submit a final Family theory when the package declares that hierarchy.

Information moves through explicit, audience-scoped case outputs. Completing a child case does not give every superior unrestricted access to every private clue. A Crew exports a bounded finding or receipt defined by content. Family-level nodes consume those exported findings and can reveal new deductions without exposing the underlying private evidence unless the package explicitly authorizes that disclosure.

Family content remains data-defined and exact-hash pinned. The runtime provides generic parent/child instance, organizational audience, export/import, aggregation, and hierarchical action primitives. It does not hard-code individual conspiracies.

## Binding invariants

1. A Family instance binds to the server-derived organization; callers cannot nominate raw Family or Crew identifiers.
2. Child cases bind to eligible Crews inside the same current Family authority unless a package explicitly supports an Extended Family structure already represented by OMERTÀ.
3. Parent progression consumes server-issued child outputs, never client assertions that a case was completed.
4. Child output receipts are immutable, exact-hash pinned, provenance-bearing, and replay-safe.
5. One-time outputs cannot satisfy multiple parent requirements or multiple Family runs unless their compiled reuse policy explicitly permits it.
6. Completion of a child case never automatically reveals its actor-private or role-private evidence to Family leaders.
7. Every hierarchical action rechecks the actor’s current organization, office/rank, assigned content role, and server-issued dependency/precondition vector under lock. An audience cursor is a refresh aid, not hidden-state authority.
8. A leader cannot consent, share private evidence, claim contribution, or accept a role for another account.
9. Organizational turnover has explicit recovery rules. Stale authority captured at case creation never remains valid indefinitely.
10. Contribution history is preserved through Crew movement, replacement, character death, and leadership turnover.
11. Family mystery state is not Family treasury state. No mystery route can debit or credit the treasury without a separately reviewed economic adapter.
12. The Phase 3C profile cannot directly emit OMR, cash, mechanical power, market goods, or any value-bearing item. A finite valuable object can enter a case only through a separately reviewed Phase 2 source/adapter that retains its ordinary conservation, ownership, and replay authority.
13. Cross-Family production diplomacy is not enabled in Phase 3C.
14. Information classifications propagate restrictively through outputs and aggregations; a superior office never implies automatic declassification.
15. Hidden child or peer activity cannot alter an unauthorized viewer's snapshot, opaque cursor, issued actions, counts, cache behavior, or stale/error behavior.

## Hierarchical content model

### Investigation levels

The runtime supports four composable levels:

- **Individual assignment:** one participant gathers or analyzes an observation.
- **Crew case:** several distinct accounts resolve a local investigation and may produce one or more bounded outputs.
- **Family conspiracy:** several Crew outputs converge through Family-level roles and deductions.
- **Extended Family operation:** multiple organizational divisions represented inside one server-owned organization scope coordinate staged investigation and operations.

These are content scopes, not separate custom engines. Each level uses the same pinned instance, evidence, role, contribution, action, and event primitives. Parent/child dependencies provide hierarchy.

### Organizational units

A Family package declares abstract unit slots rather than concrete Crew IDs. Examples include:

- three distinct Crew units;
- one enforcement-oriented Crew and one commerce-oriented Crew;
- any four Crews, each resolving a different branch;
- two Crew units plus a Family-owned specialist cell;
- several Extended Family divisions represented by existing organizational offices.

At runtime, eligible units self-bind or are selected through a server-issued organizational action, subject to current authority and the selected unit's own accepted participation. Unit requirements declare `distinctnessScope` (`simultaneous`, stage, or lifetime) and a unit-role equivalence group. The same Crew cannot occupy multiple slots in a distinct equivalence group or re-enter through a later assignment generation to manufacture the declared minimum. Critical-path social minima also require distinct server-owned social-independence subjects for the participating accounts under the cross-cutting policy.

Packages must provide a structurally solvable fallback when their unit-profile requirements are optional or substitutable. They may require a particular profile only if the profile is derived from existing server state and the discovery board reports a safe blocker.

## Parent and child instances

### Parent creation

A qualified current Family member creates a forming Family instance. The server derives the Family scope, verifies the package’s creation office/rank policy, and records the creator without granting permanent authority.

### Child case assignment

The parent issues server-owned assignment actions for child case templates. An eligible Crew accepts an assignment through one of its currently authorized members. Acceptance creates or binds a child instance with:

- exact child namespace, version, and hash;
- parent instance ID and requirement ID;
- server-derived Family and Crew authority;
- unit-slot identity;
- child run policy;
- expected output contract.

A child instance has an independent internal canonical mutation revision and preserves its own private evidence. Parent refreshes read only safe child status and exported outputs through an audience-bound opaque projection cursor. A hidden-only child mutation cannot stale an unrelated parent or leader action.

### Independent activation rollover

The parent dependency lock pins compatible child hashes at parent creation. A later child package activation cannot replace an assigned child silently. An unassigned optional child slot may use a newer compatible hash only if the parent’s compiled lock explicitly contains it or an operator activates a new parent version.

Already-active child runs always finish against their pinned definition.

### Child cancellation and reassignment

Before a child starts, an eligible unit may decline or release an assignment. After start, cancellation follows the child package’s abandonment and recovery rules. A parent can reassign a requirement only when the child output has not been consumed, value-bearing escrow is resolved, and an objective recovery condition is satisfied.

Reassignment does not erase the abandoned child or its contribution history. It opens a new attempt generation. One requirement generation can accept at most one successful output.

## Case outputs and information flow

### Output contracts

A child package declares typed outputs such as:

- case completion receipt;
- finding;
- structured deduction;
- identified person, place, event, object, or transaction;
- restored document reference;
- crafted-device use receipt;
- branch decision;
- sealed truth token used only by the runtime.

An output contract declares its logical ID, structured schema, source classification, output classification, audience, reuse policy, parent compatibility, contribution provenance requirements, and whether the output includes a safe public summary.

The child runtime materializes outputs only at declared nodes and only once per logical output and run key. A receipt contains stable references and a digest of its canonical safe payload. Sealed provenance digests remain server-only and are never projected as equality oracles. A receipt never contains raw private evidence bodies or canonical answer specifications.

Classifications are typed audience predicates over authenticated principals and exact scope/assignment generations. Account A and account B, Crew A and Crew B, distinct role generations, and different office holders are incomparable rather than points on a scalar lattice. Combining inputs intersects their predicates while preserving subject/scope IDs and generations; an empty intersection is sealed/unprojectable. Any widening requires a closed, versioned, compiler-known declassification transform. Allowed transforms emit a fixed safe schema such as a reviewed conclusion category or bounded progress state; they cannot copy source text, expose source IDs or counts, emit raw/equality digests, preserve candidate ordering, or accept author-provided executable logic. Every declassification produces a deterministic privacy-report entry naming source predicates, intersection, transform, output fields/predicate, and noninterference fixtures. Human rationale may explain the choice, but the compiler evaluates only the structured transform declaration.

### Audience routing

Output audiences may be:

- originating Crew only;
- one declared Family content role;
- current holder of an organizational office;
- a set of Family investigation roles;
- all active Family-instance members;
- sealed runtime only.

Organizational office and content role are distinct. A current Capo may hold a Report Steward content role, but Capo status alone does not expose every case output unless the package says so.

When an audience follows an office, access follows the current office holder and is audited. When an audience is actor-private, leadership turnover does not move it. The compiler requires unambiguous follow behavior.

### Crew report assembly

A Crew can be required to assemble a report from selected child evidence or deductions. The package defines its structured fields and required contributing roles. The report author sees only evidence that has been shared or explicitly made available for the report.

Submitting a report creates a bounded output. It does not grant the parent direct access to every source clue. The report records supporting evidence IDs as sealed provenance so audits and later authored consequences can distinguish a well-supported conclusion from an unsupported guess without leaking the clue body.

### Parent consumption

A Family node consumes or observes a child output according to its reuse policy:

- `single_parent` — can satisfy one parent requirement exactly once;
- `same_parent_multi_node` — reusable inside one parent instance for declared nodes;
- `durable_fact` — a safe, account- or organization-scoped narrative fact governed by Phase 3D;
- `sealed_signal` — runtime-only truth, never player projected.

Consumption records an immutable link. A client cannot replay, relabel, or substitute a receipt from another Family, season, child hash, or requirement generation.

## Hierarchical actions and current authority

### Rank and office policies

A package can require a current organizational office or minimum rank for a particular action. It must also declare recovery behavior if that office is vacant.

Action authority is evaluated at mutation time. The person who created the case or held office at start does not retain authority after demotion, departure, death where a living street is required, or office replacement.

### Separation of duties

Content can require different accounts for steps such as:

- one Capo endorses a Crew report;
- another Crew’s specialist challenges it;
- an Underboss role reconciles conflicting reports;
- a Boss role submits the Family theory.

The compiler enforces declared account or unit distinctness. One account cannot occupy several offices or content roles to bypass a separation rule, even if the underlying organization model temporarily permits multiple labels.

### Boss visibility

The Boss does not receive universal evidence visibility. A Boss-level projection contains:

- outputs explicitly routed to the Boss or Boss content role;
- Family-shared evidence;
- safe unit progress;
- structured final-theory candidates issued by the runtime;
- no actor-private or Crew-private clue bodies by default.

This makes information transmission through the organization a gameplay mechanic while retaining a recoverable critical path.

## Family theory and decision model

A Family theory schema can combine child findings, Family evidence, organizational history, crafted-device receipts, and safe dynamic facts. It may require:

- a suspect or hidden organization;
- motive and means;
- event ordering;
- several Crew reports;
- supporting and contradicting outputs;
- a Family decision or irreversible policy choice.

The submitter selects only server-issued candidates visible to that role. The server evaluates against sealed canonical truth and records a safe outcome.

Packages may support several plausible intermediate theories. Partial outcomes can unlock targeted follow-up assignments rather than exposing the correct answer. Attempt limits and cooldowns are server-owned and must have a recovery path.

An irreversible Family choice closes declared branches only for that exact run. Validation reports existential `mayReach` and universal `mustPreserveCriticalSuccess` using the cross-cutting joint-state semantics, including every reachable correlated combination of child outcome, role/unit composition, replacement generation, dynamic outcome, expiry, and Family decision. A narrative-failure or incomplete terminal cannot satisfy a required Family/season export or consume critical once-per-season authority unless it grants the declared restart/recovery path.

## Contribution rollup

### Individual and Crew provenance

Family contribution is composed from typed Phase 3B receipts. The parent does not convert every child action into points. It recognizes semantic milestones such as:

- completed specialist role;
- evidence or deduction included in an accepted Crew report;
- crafted item or facility work used by the case;
- critical delivery or operation;
- authored leadership decision;
- successful challenge or reconciliation of reports.

### Unit-level contribution

A Crew earns a unit contribution receipt when it produces a valid declared output. Parent progress can require distinct unit receipts. One Crew cannot farm repeated versions of the same child output to satisfy several unit slots.

### Reward eligibility

Baseline narrative acknowledgment can include all active participants when explicitly authored. Contributor-specific recognition requires declared individual or unit contribution predicates.

The runtime records eligibility; every beneficiary self-claims. It never lets the final Boss action allocate rewards to arbitrary accounts. Phase 3C rewards remain gameplay-inert status, story flags, or collectibles unless a later independently reviewed economic adapter is approved.

## Schema direction

Phase 3C reuses content instances, role assignments, evidence grants, contributions, board state, and effects. Additive relational authorities are required for hierarchy.

### `content_instance_relations`

Links a parent instance to a child instance under an exact requirement ID and attempt generation. It records parent and child `bundleHash` values, server-derived Family and unit scope, relation state, and assignment/acceptance/completion times. Uniqueness prevents one successful generation from binding several children.

### `content_unit_assignments`

Maps abstract parent unit slots to server-derived Crew or organizational units as append-only rows keyed by `(parent_instance_id, unit_slot_id, assignment_generation)`. It stores the unit-role equivalence group, `distinctnessScope`, acceptance state, authorized accepting account, immutable unit identity/generation, and output-binding state. Closing or replacing an assignment never overwrites its history, and every child/output receipt binds the exact assignment generation that produced it. Only the active generation can act.

### `content_unit_occupancies`

Permanent anti-rotation authority keyed by parent instance, unit-role equivalence group, server-derived unit identity, and applicable stage/lifetime scope. Parent convergence evaluates the full relevant occupancy plus meaningful-output history, not only current slots. These rows prevent one Crew from crossing slots, replacement generations, leave/rejoin cycles, or child attempts to manufacture a distinct-Crew count. For critical-path account minima, the separate sealed social-independence authority is rechecked without exposing its subjects.

### `content_case_outputs`

Immutable typed outputs created by child nodes. Fields include source instance, output contract ID, run key, logical ordinal, optional universally public payload, sealed payload digest, classification/audience policy, reuse policy, contribution digest, `bundleHash`, and materialization mutation. Audience-specific payloads are derived under grants and never stored as a universally reusable safe body.

### `content_output_grants`

Audience authority for case outputs, parallel to evidence grants. It supports content roles, accounts, instance audiences, and current organizational offices without publishing raw authority IDs.

### `content_output_consumptions`

Immutable links from outputs to parent instance requirements or nodes. Unique constraints implement `single_parent` and generation rules. A stored result makes replay semantic.

### `content_hierarchy_actions`

Audit ledger for assignment, acceptance, report endorsement, challenge, reconciliation, office-routed access, reassignment, and final theory submission. It stores safe outcome codes, not private bodies.

### `content_family_decisions`

Exactly-once irreversible Family choices keyed by parent instance, decision ID, and run key. Actor authority and supporting output references are retained for provenance.

Hot aggregate status can be stored as bounded counters on the parent or in a derived projection table, but child outputs and consumption rows remain authority.

## State machines

### Parent/child requirement

```text
unassigned → offered → accepted → active → output_ready → consumed
                  │        │
                  └────────┴→ released/abandoned → replacement generation
```

### Case output

```text
materialized → granted → consumed
        │          └──→ reusable within declared policy
        └──────────────→ invalidated only by explicit pre-consumption recovery
```

Materialized outputs are never edited. A corrected conclusion is a new authored output that references or contradicts the old one.

### Family conspiracy

```text
forming → active → aggregating → theory_ready → completed
   │        │             │
   └────────┴─────────────→ abandoned/recoverable
```

## Transaction and concurrency model

Child actions use the Phase 3B lock order. Parent/child operations use:

The approved [Lot Integration Amendment](2026-09-07-world-graph-phase-2a-lot-integration-amendment.md) adds an optional exact Crew-authority prefix after immutable resolution and before the first character row. Lock the complete server-resolved Crew set in Crew-ID order; recheck invitation/membership after account locks and restart the whole logical transaction on drift or late Crew/participant discovery. The numbered suffix and its social, organizational membership/office, instance, output and item order remain unchanged. This is not a general Family/organization-first rule or new multi-Crew authority; complete traces include the prefix when applicable.

1. Resolve pinned parent and child definitions.
2. Lock affected character rows, then account rows, in canonical ID order.
3. Lock affected social-independence account-mapping rows by account ID/generation, then subject-generation rows by subject ID/generation, for every tagged account minimum.
4. Lock current organizational membership and office authorities in canonical organization-ID order.
5. Claim the domain mutation guard.
6. Lock parent and child instances as domain aggregates in canonical instance-ID order, then unit assignments and content roles.
7. Lock output and consumption rows in stable output-ID order.
8. Lock Phase 2 lots and unique items in canonical item-kind and item-ID order when the action uses them.
9. Lock shared caps or singleton world rows in canonical key order when required.
10. Recheck hashes, issued action preconditions, distinct account/independence composition, organization relationship, authority, audience, generation, and reuse policy.
11. Materialize, grant, or consume the output, record hierarchy events, advance only affected parent frontier nodes, increment internal canonical mutation revisions, advance only affected audience projection cursors, store the replay result, and commit.

An action never locks all members' character rows. Multi-Crew requirements are validated from normalized assignment/output authorities. Independence merge/split writers use the same account-then-subject ordering, with lock-trace races against assignment, convergence, and completion. Concurrent child completions can proceed independently and converge through unique consumption rows without duplicating parent progress.

## Organizational churn and recovery

The design addresses:

- Boss, Underboss, or Capo turnover;
- a Crew leaving or being removed from a Family;
- Crew dissolution;
- participant character death;
- temporarily vacant offices;
- an assigned Crew becoming inactive;
- Family dissolution.

Current authority is always rechecked. Existing outputs retain historical provenance but access follows the compiled audience policy.

A package must declare one of these policies for each critical unit or office dependency:

- replace with another eligible current unit/account;
- wait until the office is filled;
- use a declared alternate role or quorum;
- recover through a new branch;
- end in an authored incomplete-but-restartable terminal that preserves the declared critical recovery/import contract and does not consume once-per-season critical authority.

Family dissolution freezes new actions and permits only reviewed escrow recovery and read-only history. It cannot transfer the case, outputs, or rewards to an unrelated organization automatically.

## Static validation

The compiler analyzes each hierarchical component and rejects:

- a parent requirement with no compatible child output;
- child output schemas that do not match the parent import;
- dependency hash ranges with no exact lock resolution;
- insufficient distinct unit slots;
- impossible combinations of roles, offices, professions, and unit profiles;
- an output audience that excludes every required parent actor;
- a classification flow or declassification transform that is undeclared, copies restricted fields, exposes IDs/counts/digests/order, or lacks a privacy-report witness;
- a critical private clue routed only through an unrecoverable departed role;
- circular parent/child case dependencies;
- one-time output reuse that could duplicate progress or rewards;
- a child branch choice that can remove every parent-critical output without recovery;
- any reachable correlated combination of choice, role/unit composition, replacement generation, dynamic outcome, expiry state, or Family decision that fails the cross-cutting joint-state `mustPreserveCriticalSuccess` property;
- Family theory fields with no reachable candidates;
- an office dependency with no vacancy behavior;
- a unit contribution policy that rewards a non-participating Crew;
- a distinct-unit convergence rule that ignores equivalence groups, prior assignment generations, permanent occupancy, meaningful output history, or required social-independence subjects;
- cross-Family production dependencies in a Phase 3C activatable profile;
- any direct OMR, treasury, cash, power, market-good, or value-bearing item effect outside a separately reviewed finite Phase 2 adapter.

The report includes minimum Crews, minimum distinct accounts, minimum offices/content roles, required professions, child-case depth, output fan-in, private information boundaries, critical churn dependencies, and expected coordination score.

## Exploit and red-team requirements

Testing attacks:

- forged child-completion IDs;
- receipt substitution from another Family, season, namespace, version, or attempt;
- consuming one output into two parents;
- binding one Crew to multiple distinct-unit slots, assignment generations, or leave/rejoin attempts;
- joining several characters from one account;
- acting with stale Boss or Capo authority;
- retaining access after office or organization departure;
- Boss projection leakage of Crew-private evidence;
- repeatedly abandoning and reassigning a child for outputs;
- racing child completion, cancellation, and reassignment;
- parent completion racing two child consumptions;
- contribution duplication across individual, Crew, and Family levels;
- leader allocation of claims to inactive passengers or alts;
- Family dissolution with live item escrow;
- cross-Family scope injection;
- hidden treasury, cash, item, or OMR effects.

## TDD and verification

Minimum failing-first suites include:

1. Two-, three-, and four-Crew parent fixtures, including impossible unit compositions.
2. Exact parent/child hash and dependency-lock behavior across activations.
3. Assignment, acceptance, start, output, consumption, decline, abandonment, and reassignment generations.
4. Crew report construction using only evidence available to its contributors.
5. Output audience tests for Crew, content role, organizational office, Family instance, and sealed runtime.
6. Boss/Underboss/Capo turnover between projection and mutation.
7. Crew departure and dissolution before and after child output materialization.
8. One-time and same-parent reusable output semantics.
9. Concurrent child completions and parent convergence.
10. Individual and unit contribution rollup with passenger exclusion.
11. Family theory submissions with plausible partial outcomes and irreversible choices.
12. Private-evidence and private-output noninterference across snapshots, deltas, stale responses, errors, and replays.
13. Byte-identical unauthorized projections, cursors, issued actions, caches, counts, and stale/error behavior after hidden-only child mutations.
14. Restrictive classification propagation and every closed declassification transform, including rejection of ID/count/digest/order equality oracles and deterministic privacy-report generation.
15. Passenger, account-rotation, multi-character, linked-account social-independence, and Crew-slot/generation/rejoin abuse fixtures, including same-Crew cross-slot and cross-generation races, with permanent occupancies and distinct meaningful contributors rechecked at convergence and terminal materialization.
16. Universal critical-success witnesses over every reachable correlated combination of child outcome, composition, replacement generation, dynamic class, expiry policy, and Family decision, including the cross-cutting dead-product fixture.
17. pg-mem integration and route tests.
18. Real PostgreSQL unique-index, lock-order, concurrency, migration, and rollback tests.
19. Hierarchical graph reachability, output compatibility, recovery, and scale fixtures.
20. Full repository regression and existing organization/content behavior.

## API and UI projection direction

The existing authenticated content surface returns safe Family conspiracy summaries and issued actions. It may expose:

- abstract unit slots and safe eligibility blockers;
- child assignment status;
- safe Crew display identity after binding;
- outputs visible to the viewer;
- Family-level board nodes and theory actions;
- contribution eligibility and provenance summaries;
- office or role currently authorized to take a next step.

It never exposes raw organization IDs, hidden child identities, Crew-private evidence, sealed outputs, canonical theory links, or unfiltered member lists.

Every projection, search, pagination cursor, delta cache, and issued action is bound internally to endpoint/projection kind; exact parent/child/resource/list ID; account and current-character IDs/generations; organization kind/ID plus membership/office authority row identity/generation/revision; role-assignment ID/generation; grant/share-set digest; `bundleHash`; policy version; normalized query/filter/sort/page/region/locale; and response type. Queries construct the viewer-authorized relation before searching, counting, sorting, paginating, or caching; the implementation never searches all hidden rows and filters afterward. Cross-instance, cross-organization, cross-role, and cross-query cursor replay/cache-poison tests use equal generation numbers to prove scope IDs prevent collision.

The Content Desk presents hierarchical breadcrumbs and aggregated status while preserving audience filtering. A leader sees where coordination is blocked, not the bodies of evidence they are not authorized to inspect.

## Compatibility

- Existing Crew and Extended Family data remain authoritative and unchanged in meaning.
- Existing personal and Crew content instances remain valid; parent relations are opt-in through new capability profiles.
- Existing story flags are not automatically promoted to Family facts.
- Old content bundles cannot emit new case outputs unless their exact profile declared them.
- Current self-claim reward behavior remains intact.
- Direct world operations are not reclassified as Family conspiracies.

## Acceptance criteria

Phase 3C is complete only when:

- a package can compose several Crew cases into a Family conspiracy without custom routes;
- child outputs are exact-hash pinned, immutable, audience-scoped, provenance-bearing, and replay-safe;
- Family leaders receive only explicitly routed information;
- current office/rank authority is rechecked for every hierarchical action;
- Crew and leadership churn have validator-approved recovery behavior;
- distinct Crew and account requirements preserve permanent assignment/occupancy history, block multi-character and linked-account social-independence bypass, and retain a privacy-preserving appeal/recovery path;
- one-time outputs cannot satisfy several parents or duplicate progress;
- contribution rollup credits meaningful individual and unit work without rewarding passengers;
- graph validation rejects circular, incompatible, private-inaccessible, or unrecoverable hierarchies;
- pg-mem, real PostgreSQL, concurrency, privacy, exploit, API, and full regression suites pass;
- all Family mystery effects remain OMR-, cash-, power-, market-good-, value-item-, and treasury-neutral except for explicitly consumed/used conserved Phase 2 objects through reviewed adapters;
- no Critical or Important spec-compliance or code-quality finding remains.

## Non-goals

- Phase 3C does not enable production cross-Family conspiracies, diplomacy, or shared escrow.
- It does not replace OMERTÀ’s organization membership, office, treasury, war, or territory systems.
- It does not give a Boss omniscient access to subordinate evidence.
- It does not push claims or rewards into other accounts from a leader’s transaction.
- It does not award cash, OMR, power, or repeatable valuable goods.
- It does not require every Family to use one fixed hierarchy or role list.
- It does not make organization size alone a substitute for investigation, production, or reasoning.
