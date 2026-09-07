# Phase 3B — Crew and Social Puzzle Primitives Design

**Date:** 2026-09-04
**Status:** Architecture approved; formal written specification awaiting user confirmation; implementation planning pending
**Depends on:** Phase 3A evidence privacy and indexed mystery runtime; Phase 2 professions, items, services, facilities, and social production
**Scope:** Multi-account Crew cases, content-defined roles, asymmetric evidence, coordinated branches, meaningful contribution, participant churn, and server-enforced social solvability

## Outcome

Phase 3B makes cooperation a real server-enforced mechanic rather than a client convention. Authored Crew cases can require different people to hold different roles, receive different evidence, perform distinct kinds of work, contribute crafted items, make ordered decisions, or act within bounded coordination windows.

Small cases support four to six distinct accounts. Large Crew cases support eight to twelve. Content defines its own role model; OMERTÀ does not impose one universal investigator-driver-enforcer template.

The system rewards meaningful contribution rather than attendance. A participant must satisfy declared semantic contribution criteria to receive contribution-gated progression or rewards. Repeated low-value clicks, raw action count, elapsed time, and joining a lobby do not establish eligibility.

## Binding invariants

1. Account distinctness is enforced in storage and again under the mutation lock. Critical-path social minima also require distinct current server-derived social-independence subjects under the cross-cutting privacy/appeal policy.
2. The server derives the acting account, character, participant kind, current organization membership, profession state, and role authority.
3. No caller can consent, join, claim a seat, contribute, share evidence, or claim a reward on another account’s behalf.
4. Role-private and actor-private evidence use Phase 3A grants and projection filtering; client secrecy is irrelevant to authority.
5. Role definitions, branch rules, contribution requirements, windows, and recovery paths are immutable content data pinned by exact bundle hash.
6. Social cases cannot execute arbitrary code or query arbitrary world state.
7. Value-bearing contributions move to operation/project escrow through the Phase 2 item primitives in the same transaction as the contribution receipt.
8. An escrowed or consumed item cannot remain usable by the contributor.
9. Replaying a contribution cannot duplicate progress, items, eligibility, evidence, or rewards.
10. Inactive passengers do not receive contribution-gated eligibility by default.
11. Agent and human accounts may occupy roles unless a reviewed role explicitly requires a current participant kind or consent policy. The server derives that kind.
12. Social content emits no OMR in Phase 3.
13. Hidden role, evidence, contribution, replacement, or window activity cannot change an unauthorized viewer's projection cursor, issued actions, cache behavior, counts, timing class, or stale/error behavior.

## Social case model

### Party policies

A social case declares:

- allowed scope: Crew, Extended Family, or either;
- minimum and maximum distinct accounts;
- forming expiry;
- whether the creator is a leader or an ordinary self-seated participant;
- role-seat definitions;
- consent policy;
- start quorum;
- active membership recheck policy;
- replacement policy;
- a `distinctnessScope` of simultaneous, per-stage, or lifetime for every role-equivalence group;
- `real_independent_participants` for every critical-path minimum and any value/scarcity-bearing recognition;
- contribution eligibility policy;
- completion and claim policy.

The caller never nominates a raw organization ID. The server derives eligible organizations from current membership and returns safe scope choices.

### Content-defined roles

A role can require an allowlisted combination of:

- participant kind;
- organization rank or office;
- Path;
- existing mastery or Phase 2 profession level;
- server-owned character progression;
- ownership of an item or learned recipe;
- location;
- current state such as incarcerated, active driver, or business owner;
- explicit participant consent.

Role gates are entry and action gates, not permanent claims about the person. A package must declare which gates are checked at join, start, every action, or only for a particular contribution. The compiler rejects ambiguous check timing.

Roles may be exclusive, substitutable, or drawn from a role group. A package may define eight specialist seats without requiring all eight if it declares a valid matching rule and alternate solvable compositions.

### Role authority

Role assignment grants only the actions explicitly mapped to that role in the pinned bundle. It does not grant general Crew, market, inventory, business, or Family authority.

One account holds at most one active role seat in an instance unless a small-case package explicitly permits multiple roles and its declared minimum distinct accounts still holds. Reward and contribution logic uses distinct accounts, not seat count.

Lifetime-distinct equivalence groups retain every account that has occupied a covered seat, including closed assignment generations. Character replacement, leaving and rejoining, or moving through several role generations cannot let one account impersonate several required people. Per-stage groups clear only at an authored stage boundary; simultaneous groups consider all currently active assignments. The compiler rejects a role group whose distinctness timing is omitted or whose replacement policy can reduce the effective distinct-account requirement below the declared minimum.

## Party lifecycle and participant churn

### Forming

Participants self-join and self-select an eligible open seat. The mutation locks the instance, rechecks the organization, participant identity, role gates, distinct-account constraint, and consent policy, then records the assignment.

Forming lobbies expire after a server-issued duration. Expiration abandons the lobby but does not block the organization from opening a fresh run under the package’s run policy.

### Start

Starting revalidates:

- current membership for every participant;
- living/current-character requirements;
- role uniqueness and role gates marked for start;
- minimum distinct accounts;
- minimum distinct social-independence subjects where required;
- consent;
- quorum and compatible role matching;
- required initial facility or organizational state.

Roles become active only after this recheck. Start materializes private evidence grants and initial branches atomically.

### Active membership checks

Active actions always recheck the actor’s current membership and role. Packages may additionally require all current role holders to remain members at critical convergence steps. A departed player cannot continue exercising a Crew role merely because the account was valid at start.

Previously completed contributions and evidence history remain attributed. Removing a participant does not delete history, reverse consumed resources, or reassign private evidence implicitly.

### Seat replacement

Long cases can opt into a reviewed replacement policy. Replacement is not an instant leader override.

A seat becomes replacement-eligible only after an objective condition such as:

- participant left the organization;
- character died and the role requires a living street;
- participant voluntarily vacated the seat;
- consent was withdrawn beyond a declared grace period;
- role holder has not performed a required heartbeat or case action within a bounded, server-owned timeout.

The timeout is a recovery mechanism, not an engagement faucet. It grants no currency or progress.

Replacement requires current organizational authority declared by the package, an audience-bound projection cursor, a server-issued action bound to an exact dependency/precondition vector, and a new participant’s own acceptance and consent. The old assignment closes, a new generation opens, and all role actions reference the active generation. The dependency vector includes the visible role generation, consent state, relevant membership/authority revision, bundle hash, and any value or window preconditions; it never exposes or depends on unrelated hidden activity.

Actor-private evidence stays with the original account. Role-private evidence follows the role only when `followsRole` is declared. Evidence explicitly shared to the instance remains shared. If a case becomes unsolvable because indispensable private evidence cannot follow, the validator requires a re-interview, re-observation, or other authored recovery branch.

## Asymmetric evidence and communication

Every role can receive a different subset of evidence. Cases may combine:

- photographs visible only to one role;
- financial records held by another;
- witness interviews performed at distinct locations;
- physical evidence requiring a specialist tool;
- testimony that is sincere but incomplete or mistaken;
- mutually exclusive observations that become useful only when compared.

Evidence can move through explicit share actions:

1. The server issues a share action only for shareable evidence visible to the actor.
2. The actor chooses from server-issued eligible recipients or a declared audience such as instance-shared.
3. The server rechecks ownership, share policy, recipient membership, the issued action's exact preconditions, and any cost.
4. It writes a unique evidence grant and share event.
5. It increments the internal canonical mutation revision once and advances only projection cursors for audiences whose visible state changed.

Raw text copying outside the game cannot be prevented, so gameplay security does not pretend otherwise. The mechanic’s purpose is to control server-recognized possession, future action eligibility, and durable provenance. Private evidence that merely needs human discussion can be understood socially without an in-game grant; evidence required by a later server gate must be shared through the declared mechanic.

## Branch and coordination primitives

### Parallel branches

Parallel branches are independent frontier components assigned to different roles or role groups. A convergence node declares how many and which branch receipts are required. Completing one branch cannot mutate another branch’s private state except through explicit compiled edges.

### Ordered contributions

An ordered sequence declares stage numbers or predecessor receipts. The server issues only the next currently valid contribution. A replayed earlier stage returns its recorded result and cannot advance the sequence twice.

### Mutually exclusive choices

A branch group can permit one of several investigations, such as searching a warehouse or following a suspect. Committing a branch closes its siblings for that instance. The compiler reports existential `mayReach` and universal `mustPreserveCriticalSuccess` using the cross-cutting joint-state semantics. It evaluates every reachable correlated combination of branch choice, role composition, replacement generation, window outcome, and recovery state, and identifies how critical evidence from closed branches remains recoverable.

Different organizations may choose different branches, allowing social comparison, but no season-critical path can assume that some external group happened to select every alternative.

### Bounded coordination windows

Some operations may require distinct role actions within a server-owned window. The design uses contribution receipts with timestamps, not persistent socket presence or client clocks.

A coordination node declares:

- required distinct role or account set;
- window duration within reviewed bounds;
- whether the first qualifying receipt opens the window;
- reset, retry, or recovery behavior on expiry;
- whether contributed value is held, returned, or consumed on expiry.

Expiry cannot silently destroy value. If an attempt consumes items, the package must declare the sink and a renewable recovery source; otherwise escrow is released. A failed window cannot be retried to duplicate outputs.

### Split information and shared theories

A theory may require evidence grants across several accounts while one declared role submits the final structured theory. The submitter does not automatically receive every private clue. Packages can require explicit share receipts, or they can permit a group theory based on a quorum attesting to their own evidence.

An attestation is a server-issued yes/no or bounded-choice action referencing evidence already visible to that participant. It never asks the client to send the private body or canonical answer.

## Meaningful contribution accounting

### Typed contribution categories

Contribution receipts use allowlisted categories:

- evidence discovery;
- deduction or theory component;
- crafted item or material contribution;
- profession-qualified work;
- role-specific operation;
- risk-bearing gameplay action;
- critical delivery;
- support action required by an authored stage;
- leadership or coordination decision when uniquely necessary.

Raw action count, login duration, messages sent, and repeated trivial interactions are not contribution categories.

### Requirement model

A package declares semantic eligibility predicates, for example:

- satisfy at least one of `evidence`, `specialist_work`, or `critical_delivery`;
- complete the required action for the held role;
- contribute one declared project requirement and participate in one convergence decision;
- meet a weighted threshold where weights are fixed in compiled data and capped per category.

Contribution weights are not client-supplied and cannot be increased by repeating the same logical contribution. Receipts carry a stable logical key unique within the instance and role generation.

Eligibility is evaluated from receipts at terminal materialization. The terminal can distinguish participant acknowledgment from contribution-gated status, narrative flags, or inert collectibles. Packages must explicitly declare if all participants receive a baseline keepsake while only contributors receive another non-economic recognition.

### Economic neutrality

Phase 3 social mystery completion remains value-neutral unless it consumes or returns Phase 2 items as part of the mystery. It cannot create cash, OMR, market goods, or power rewards. If later content awards a value-bearing crafted object, that requires a separately reviewed finite source and Phase 2 economy adapter; it is not enabled by Phase 3B itself. Such an adapter must derive each exact recipient or purpose-bound installed asset before contributions begin and require platform-semantic contribution receipts. A participant set is never an ownership scope. Passenger acknowledgment remains inert, non-tradeable, non-export-eligible, non-power-bearing, and unable to unlock progression or an economic prerequisite.

## Schema direction

Existing `content_instances`, `content_instance_members`, evidence grants, node state, facts, effects, and instance events remain authoritative. Phase 3B adds normalized social state instead of packing it into instance JSON.

### `content_role_assignments`

Historical role-seat assignments keyed by instance, role ID, and generation. Fields include account, character snapshot, participant kind, state, joined/accepted/closed times, closure reason, and exact `bundleHash`. A partial unique constraint permits only one active generation for a role and prevents an account from occupying prohibited concurrent seats.

### `content_role_consents`

Append-only consent changes tied to assignment generation. Current consent can be projected efficiently, while history proves that another participant did not act on the account’s behalf.

### `content_branch_receipts`

Exactly-once completion receipts for branch, stage, or coordination requirements. Each includes logical contribution key, role generation, actor, safe result, mutation ID, and revision.

### `content_contributions`

Typed semantic contributions keyed by instance, logical contribution ID, subject account, and ordinal. It records category, requirement ID, source item/event reference where applicable, safe magnitude capped by compiled rules, contribution state, and provenance.

### `content_coordination_windows`

Server-owned window state with opening receipt, open/expiry times, attempt number, status, and reset/recovery outcome. It never stores client times.

### `content_role_replacements`

Audit record connecting old and new assignment generations, objective eligibility reason, authorizing actor, accepting actor, revision, and mutation authority.

### `content_evidence_shares`

Exactly-once share receipts referencing the Phase 3A evidence occurrence and resulting grants. The evidence body is not duplicated.

All item contribution rows reference Phase 2 escrow or item mutation receipts. Social state never asserts ownership by itself.

## State machines

### Role seat

```text
open → offered/claimed → accepted → active → completed
                         │          │
                         ├──────────┴→ vacated
                         └────────────→ replaced → next generation
```

Every transition is actor-authorized. Leaders may open an eligible replacement but cannot accept for the incoming account.

### Contribution

```text
issued → reserved → applied
             │
             └→ cancelled/released
```

For value-bearing inputs, reserve and escrow are one transaction. Application either consumes or retains escrow according to compiled rules. A failed application cannot leave progress without the item movement or item movement without the receipt.

### Coordination window

```text
pending → open → satisfied
             │
             └→ expired → reset | recovery | failed terminal
```

### Evidence share

```text
issued → shared
    └──→ stale/withdrawn action (no state change)
```

## Transaction and concurrency model

The canonical lock order is:

The approved [Lot Integration Amendment](2026-09-07-world-graph-phase-2a-lot-integration-amendment.md) adds an optional exact Crew-authority prefix after immutable resolution and before the first character row. Resolve all Crew IDs before the prefix, lock them in canonical Crew-ID order, and recheck invitation/membership after account locks. Drift or late Crew/participant discovery requires whole-transaction restart. The numbered suffix, including social account mappings before subject generations and the organization/aggregate/item classes, remains unchanged. Traces and races include the prefix without granting new role, invitation or participant authority.

1. Resolve pinned content and issued action.
2. Lock affected character rows, then account rows, in canonical ID order.
3. Lock affected social-independence account-mapping rows by account ID/generation, then subject-generation rows by subject ID/generation, for every tagged minimum.
4. Lock affected organization and organizational-authority rows in canonical ID order.
5. Claim the domain mutation guard.
6. Lock the content instance and branch/window/project aggregate in canonical type and ID order, then active role assignments and membership projections.
7. Lock Phase 2 item lots, unique items, or escrow rows in canonical item order when required.
8. Lock any shared caps or singleton world rows in canonical key order.
9. Recheck distinct accounts/independence subjects, gates, consent, revision, window, and authority.
10. Move value and record contribution/branch/share state.
11. Advance the graph frontier, materialize safe effects, increment the internal canonical mutation revision once, advance only affected audience projection cursors, store the replay result, and commit.

The final actor never locks every participant's character row. Claims remain self-claimed. Multi-account assertions read and, where necessary, lock independence, membership, and role authorities in the global stable order to avoid deadlocks. Independence merge/split writers use the same account-then-subject ordering, and lock-trace tests race them against start, convergence, and claim.

Database uniqueness is the final replay authority for role claims, logical contribution IDs, window receipts, evidence shares, and terminal eligibility. HTTP idempotency is an additional convenience, not the only protection.

## Static social solvability validation

The compiler builds a local constraint model for each social component rather than solving the entire content corpus as one global problem.

It validates:

- minimum and maximum distinct accounts;
- minimum distinct social-independence subjects for tagged critical/value-bearing components;
- role-seat cardinality;
- mutually exclusive eligibility predicates;
- participant-kind requirements;
- whether one account could improperly satisfy multiple roles;
- simultaneous, per-stage, and lifetime distinctness across assignment generations;
- minimum profession and Path composition;
- branch convergence requirements;
- evidence audience flow to required submitters;
- replacement and recovery viability;
- coordination-window retry safety;
- item/facility sources for contributions;
- contribution eligibility attainability;
- reward recipient and claim policy;
- universal critical-success preservation for every reachable correlated combination of role composition, replacement generation, mutually exclusive branch, coordination expiry, and recovery outcome.

The validator fails a package when no assignment exists under the declared abstract eligibility domains, when a required role has no recovery after churn, when a private clue is needed by a role that can never receive it, or when a passenger can qualify without a meaningful contribution contrary to the package policy.

Because live player populations cannot be proven statically, the report separates structural satisfiability from live availability. Discovery projects safe blockers and recommended composition without exposing private accounts or canonical clues.

## Abuse and exploit controls

Red-team requirements include:

- one account using multiple characters to satisfy distinct seats;
- high-confidence linked sockpuppet accounts satisfying an independence-tagged minimum, alongside unrelated same-origin household accounts that must remain eligible and private;
- simultaneous seat claims;
- leaving and rejoining to mint new role generations or rewards;
- leader-forced consent;
- acting after leaving the Crew;
- stale role actions after replacement;
- sharing evidence to an unauthorized former member;
- hidden-evidence leakage through recipient lists;
- repeated trivial actions manufacturing contribution weight;
- item contribution without escrow;
- escrow duplication on expired windows;
- racing completion against cancellation or replacement;
- replaying theory attestations;
- opening overlapping organization runs to duplicate unique entitlements;
- agent/human participant-kind spoofing;
- organization dissolution and membership churn;
- OMR or transaction-ledger movement through a social effect.

Where competitive or scarce rewards later exist, current OMERTÀ agent/admin eligibility rules remain enforced by the economic adapter. Phase 3B does not invent a reward exemption.

## TDD and verification

Implementation slices begin with failing tests. Minimum coverage includes:

1. Four-, six-, eight-, and twelve-seat fixtures with valid and impossible compositions.
2. Account distinctness across multiple characters and concurrent join requests.
3. Join, self-consent, start, active membership recheck, voluntary leave, replacement eligibility, acceptance, and stale-generation behavior.
4. Role gate timing at join, start, action, and contribution.
5. Actor-private, role-private, follows-role, shared, and recovery evidence behavior.
6. Explicit evidence-sharing authorization and replay.
7. Ordered, parallel, mutually exclusive, quorum, and coordination-window branches.
8. Window expiry with release, consumption, reset, and recovery policies.
9. Contribution eligibility based on semantic categories, with passenger and action-count abuse fixtures.
10. Phase 2 item escrow conservation during contribution, cancellation, completion, and concurrent replay.
11. Two actors racing the final required contribution.
12. Replacement racing an old participant action.
13. Organization membership changing between projection and mutation.
14. Lifetime-distinct roles resisting character swaps, vacancy/rejoin, and multi-generation rotation, with convergence and terminal rechecks of the effective distinct contributor set.
15. Universal critical-success witnesses for every mutually exclusive choice, role composition, replacement generation, and window-expiry outcome.
16. Hidden-only actions leaving an unrelated audience's byte-level snapshot, cursor, issued actions, cache result, delta, counts, and error/stale behavior unchanged.
17. pg-mem route and domain tests.
18. Real PostgreSQL uniqueness, lock-order, deadlock, and concurrent transaction tests.
19. Private projection noninterference for every new role, replacement, share, contribution, and window response.
20. Full repository regression and existing authored-content compatibility tests.

## API and projection direction

The existing content endpoints remain the primary surface. New server-issued action kinds cover seat acceptance, voluntary vacancy, replacement initiation/acceptance, evidence share, branch contribution, coordination-window participation, and contribution claim.

The client receives:

- safe role and composition requirements;
- its own assignment generation and consent state;
- public or authorized participant handles;
- currently issued actions;
- audience-filtered branch and contribution progress;
- safe eligibility status and blockers;
- server times and next refresh time for coordination windows;
- an opaque audience-bound projection cursor and server-issued actions whose signed preconditions name only state that viewer is authorized to observe or act upon.

The client never receives raw account IDs, hidden role candidates, private evidence held by others, canonical branch truth, internal contribution weights beyond safe authored descriptions, or direct mutation descriptors that bypass issued actions.

## Compatibility

- Existing Sixth Chair and Two-Man Rule runs retain their current party semantics and hashes.
- The current `content_instance_members.role_id` can remain as a compatibility projection while new profiles use generation-aware role assignments.
- Old instances do not gain replacement behavior unless their pinned bundle and runtime profile declared it.
- Existing role-private actions continue to use the same safe action filtering; Phase 3B evidence grants strengthen privacy without rewriting old source bundles.
- Existing Crew and Family membership tables remain organization authority.
- Existing world-operation content is not auto-migrated or reinterpreted.

## Acceptance criteria

Phase 3B is complete only when:

- a package can define a structurally valid four-to-twelve-account case without custom route logic;
- distinct-account, required social-independence, role, consent, membership, profession, and contribution requirements are rechecked server-side, with sealed linkage evidence and appeal/correction recovery;
- asymmetric evidence is private across all responses and can be explicitly shared where declared;
- parallel, ordered, mutually exclusive, and bounded-window branches execute transactionally;
- authorized seat replacement recovers long cases without erasing history or leaking private evidence;
- meaningful contribution gates exclude passengers and resist trivial repetition;
- value-bearing contributions conserve through escrow, cancellation, expiry, and completion;
- static social validation rejects impossible compositions and unrecoverable dependencies;
- pg-mem, real PostgreSQL, concurrency, API, privacy, exploit, and full regression suites pass;
- no path emits OMR;
- spec-compliance and code-quality reviews have no unresolved Critical or Important finding.

## Non-goals

- Phase 3B does not implement Family aggregation or Boss/Underboss information routing.
- It does not implement production cross-Family cases.
- It does not treat chat content or out-of-game discussion as verifiable evidence.
- It does not require real-time sockets or simultaneous online presence.
- It does not reward time online, raw action count, or lobby attendance.
- It does not permit leaders to act or consent for other accounts.
- It does not add OMR, cash, random valuable drops, or repeatable reward faucets.
- It does not replace the existing Crew or Extended Family membership systems.
