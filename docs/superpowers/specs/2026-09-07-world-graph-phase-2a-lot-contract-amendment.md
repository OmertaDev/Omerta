# Phase 2A Task 4.2 lot contract amendment

Status: **ADOPTED 2026-09-07; NOT IMPLEMENTED**. Following independent spec
review, the controller adopts this bounded downstream ruling under the approved
Phase 2A architecture. It supplements the tracked
`docs/superpowers/specs/2026-09-07-world-graph-phase-2a-lot-integration-amendment.md`,
the tracked
`docs/superpowers/specs/2026-09-07-world-graph-phase-2a-definition-registry-amendment.md`,
and the Task 4.2 section of the tracked
`docs/superpowers/plans/2026-09-04-world-graph-phase-2a-implementation.md`.
It does not replace any of their acceptance requirements. Task 4.2 remains
dormant.

## Quality ruling

The adopted [exact transition amendment](2026-09-07-world-graph-phase-2a-lot-transition-amendment.md) explicitly extends the frozen v2 authority and candidate root with a byte-compatible old/new closed union, adds the unique candidate quality-state digest, and defines dormant unique/custody transitions. It supersedes only those listed shapes and exhaust-state clarifications; this document's original lot, quality and acceptance requirements otherwise remain binding.

Task 4.2 shall use **exact quality representation validation plus real trusted
producer derivation**.

The private item-mutation token establishes the active client, transaction,
root, owner/action pins, lifetime, poison behavior, and shared ordinal space. It
does **not** authorize a quality formula, prove numeric bounds, or prove that a
supplied digest commits to a legal numeric value.

`grantLot` shall:

1. synchronously detach and close the supplied `qualityBand` and
   `qualityStateDigest` tuple before an await;
2. reread the exact immutable definition with
   `definitionByHash(client, definitionHash)` and compare the complete intrinsic
   projection;
3. validate the tuple's exact scalar shape and the verified definition's mode
   row below; and
4. store, project, select, aggregate, split, replay, and reconcile that exact
   tuple without normalization or regeneration.

A trusted server producer shall separately derive the tuple from its exact
permitted source/action and locked quality-affecting basis before calling
`grantLot`. Task 4.2 may prove this composition through a closed dormant fixture;
it does not add or enable a live producer.

No new registry/certificate/policy table, `ItemDefinition` field, hash domain,
quality brand, public trust flag, arbitrary resolver callback, or second mutation
capability is authorized.

### Exact tuple

```ts
type LotQualityTuple = Readonly<{
  qualityBand: string | null;
  qualityStateDigest: string | null;
}>;
```

Both keys are required and extras are rejected **within the detached quality
tuple only**. `qualityBand` and `qualityStateDigest` remain ordinary members of
the already-closed full `LotOutput`/`LotSelector`; extracting this two-key tuple
does not reject, discard, or redefine any other required economic-identity field.

- A band is exactly null or the original nonempty canonical string accepted by
  the existing legacy `boundedText(value, 80)` semantics. Do not trim,
  lowercase, Unicode-normalize, translate, replace, or impose the new opaque
  identity-token grammar on it.
- A digest is exactly null or lowercase 64-hex.
- Missing/undefined/extra/accessor/proxy values, invalid scalar types, empty or
  padded labels, labels longer than 80 characters, and malformed digests are
  `bad_item_request` before any write.
- Digest syntax is representation only; it is not evidence of a checked numeric
  state.

### Mode table

| Exact definition mode | Primitive representation accepted | Trusted producer obligation |
|---|---|---|
| `none` | null/null only | No economic quality state exists. |
| `fixed` | At least one of band or digest nonnull; band-only, digest-only, and both are representable. | Derive the exact fixed result from the server-owned output policy. |
| `inherited` | Any well-shaped tuple, including null/null. | Derive it using the permitted locked source/inheritance rule; inherited absence remains absence. |
| `bounded` | At least one of band or digest nonnull; band-only, digest-only, and both are representable. | Validate the permitted source policy/bounds. If the actual economic state is numeric, supply its digest. Band-only is allowed only for a genuinely categorical result. |

Unknown or missing modes are `bad_item_request`. This table defines storage
representation, not labels, ranges, source choice, variance, or formula logic.
Every economically meaningful numeric state, in any mode, still requires a
digest; the bounded row makes the producer's numeric obligation explicit.

### Producer boundary and client forwarding

A trusted producer is reviewed server code that resolves the exact issued action,
definition pins, source/recipe/profile, activation event/revision, owner, and
locked mutable basis; derives the output tuple; checks its own categorical or
numeric policy; then passes only that detached server result to `grantLot`.

It may not forward `qualityBand`, `qualityStateDigest`, `quality`, a caller-created
digest, or equivalent open metadata from a request. Every future live producer
must have an adversarial test proving that client-supplied quality-shaped fields
are rejected by its closed input contract or cannot affect the derived tuple,
grant argument, event, stored row, or replay result. Source or predicate drift
after candidate admission is `contention` and restarts the whole root; there is
no late source/result substitution.

The Task 4.2 dormant producer fixture must use a frozen server-owned policy and a
closed input that contains only an action/policy identifier and permitted action
arguments, never output quality. A raw internal call with a well-shaped tuple can
test storage, but cannot be cited as trusted-derivation evidence.

## Adopted downstream resolutions

These clauses close the narrow downstream details needed to execute the tracked
Task 4.2 plan. They do not broaden its scope.

### Split custody is validation-only

The `custody` argument to `splitLot` is an exact expected-parent predicate. The
admitted and locked parent must match it. Initial mismatch is
`bad_item_request`; post-admission drift is `contention`.

The child copies owner, custody, exact definition, full quality tuple, trade
policy, binding/restriction, season/run/source-cap, expiry, immutable age basis,
and source provenance exactly. It receives a new lot ID, actual split-time
creation timestamp, output ordinal, and link to the earlier parent-debit input.
Splitting does not authorize a custody/owner transition and does not rewrite the
source provenance class to `split`.

### Closed opaque identity values

- `binding` and `transferRestriction`: null or 1–128-byte canonical token
  matching `^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$`.
- `provenanceCoalescingClass`: required token under the same bound/grammar.
- Ordinary `provenanceClass`: exactly
  `crafted|salvaged|awarded|imported`; `migration_origin` remains reserved for
  the Task 5 observation path.
- `provenanceDigest`: required lowercase 64-hex and private in player
  projections.

These values are exact identity, not transition authority or executable policy.
Every complete economic dimension must match for aggregate compatibility;
physical rows never merge.

The closed lot identity shapes are:

```ts
type ItemOwner = Readonly<{
  scope: 'character' | 'account' | 'operation';
  id: string;
}>;

type CustodyIdentity = Readonly<{
  state: 'direct' | 'escrowed';
  scope: null | 'operation';
  id: string | null;
}>;

type LotEconomicIdentity = Readonly<{
  logicalItemId: string;
  definitionHash: string;
  owner: ItemOwner;
  custody: CustodyIdentity;
  qualityBand: string | null;
  qualityStateDigest: string | null;
  tradePolicyHash: string;
  binding: string | null;
  transferRestriction: string | null;
  seasonId: string | null;
  runId: string | null;
  sourceCapId: string | null;
  expiresAt: string | null;
  ageBasisAt: string | null;
  provenanceCoalescingClass: string;
}>;

type LotOutput = Readonly<LotEconomicIdentity & {
  quantity: number;
  provenanceClass: 'crafted' | 'salvaged' | 'awarded' | 'imported';
  provenanceDigest: string;
}>;

type LotSelector = Readonly<LotEconomicIdentity & {
  quantity: number;
  selection: 'compatible' | 'lot_ids';
  lotIds: null | readonly string[];
}>;
```

Every object is exact-key closed. For `selection: 'compatible'`, `lotIds` is
null. For `selection: 'lot_ids'`, it is a nonempty, sorted, duplicate-free list
of server-issued lot IDs. A null identity member is an exact value, never a
wildcard. Quantities are positive safe integers no greater than the exact
definition's `maximumLotQuantity`; timestamps are canonical UTC instants. The
server, not `LotOutput`, supplies lot ID, creation time, mutation ID, output
ordinal, and lineage source attachment.

### Callback-scoped complete candidate plan

The exact private request shapes are:

```ts
type LotCandidateRoot = Readonly<{
  owner: ItemOwner;
  authority: Readonly<{
    issuedActionId: string;
    aggregate: Readonly<{ kind: string; id: string }>;
    resolvedOwner: ItemOwner;
    bundleHash: string;
    namespace: string;
    activationRevision: number;
    eventId: string;
    inputDefinitionHashes: readonly string[];
    outputDefinitionHashes: readonly string[];
  }>;
}>;

type ItemCandidateRequirement =
  | Readonly<{ kind: 'lot_fifo'; selector: LotSelector }>
  | Readonly<{ kind: 'lot_exact'; lotId: string; quantity: number }>
  | Readonly<{
      kind: 'unique_exact';
      itemId: string;
      expected: Readonly<{
        definitionHash: string;
        owner: ItemOwner;
        state: 'active' | 'escrowed';
        custody: CustodyIdentity;
        qualityBand: string | null;
        conditionSummary: null;
        exportPolicy: 'ineligible';
      }>;
    }>;

withCompleteItemCandidates<T>(
  client,
  mutation,
  trace,
  request: Readonly<{
    root: LotCandidateRoot;
    requirements: readonly ItemCandidateRequirement[];
  }>,
  action: () => Promise<T>,
): Promise<T>;

assertLotCandidateRoot(
  client,
  mutation,
  root: LotCandidateRoot,
): void;
```

All nested objects are exact-key closed. Authority arrays are bounded,
deterministically ordered, and duplicate-free. Requirement arrays are bounded
ordered multisets. `lot_exact` resolves identity only from that exact row and
must match an input-definition pin; it never falls back. `unique_exact` binds
the complete expected immutable/current snapshot shown above, including a
pre-existing custody identity when applicable.

`assertLotCandidateRoot` validates the existing private mutation state and
compares the root byte-for-byte after canonical closed-data normalization with
the v2 owner and authority frozen by `withLotMutation`. It returns no state and
grants no leaf or quality authority. Fake, v1, raw, cross-client, expired,
registry-transaction, or mismatched roots fail closed.

The same existing boundary may expose assertion-only
`assertLotDefinitionPin(client, mutation, {owner, definitionHash, direction})`.
Its detached argument object has exactly those keys; `direction` is exactly
`input` or `output`. It requires the active same-client v2 root, exact frozen
root owner, and membership in that root's corresponding exact definition pins.
It returns no state or capability and does not admit candidates, allocate an
ordinal, authorize quality, or permit another owner's transition. Malformed or
substituted owner/pin arguments are `bad_item_request`; invalid private contexts
retain their existing failure classification.

`withCompleteItemCandidates` freezes the full ordered requirement multiset and
its deterministic sufficient candidate/FIFO allocation before item locks, using
one shared shadow balance across exact and FIFO overlaps. Complete exact economic
identity and explicit IDs filter SQL before its 4097-row per-requirement result
bound; unused tails are discarded. The existing 4096 physical-key budget counts
custody and unique separately, and is not an owner holding cap. The helper admits
the complete selected item trace once, locks using the one shared comparator,
then repeats the entire ordered resolution with fresh shadow balances and compares
selected snapshots, native timestamp precision/order, membership, allocations and
shortfalls. An unselected-tail change that cannot alter deterministic selection
need not abort; selected-prefix/predicate/allocation drift is `contention`, while unchanged
eligible shortage is `materials`. Each leaf consumes exactly one planned
requirement and callback success requires all planned consuming requirements to
be used; unplanned or changed candidates are `contention`, with no late locks.
The plan closes in `finally` and returns no token. There is no second root, guard,
counter, or capability.

### Immediate acyclic FKs plus root parity

Use this acyclic attachment layout:

- `item_mutation_outputs` owns the cross-kind
  `(mutation_id, output_ordinal)` identity and immediately references its exact
  immutable lot or unique attachment plus same-root/same-ordinal event;
- the lot/unique attachment does not hold a reverse output FK;
- split output references its same-root earlier debit input; and
- closed branch checks require all applicable columns and forbid all
  inapplicable columns.

Historical creation/transition references must bind **immutable** identity:
permanent lot/item ID, exact definition identity, creation attachment identity,
root/ordinal/event branch, and applicable immutable quantity/source fields. A
historical FK must not reference mutable current owner, custody, state, or
remaining quantity. Otherwise a later legal escrow, release, transfer, or
consumption would invalidate its history. Before/after owner/custody/state belong
in the immutable normalized event/IO snapshot for that transition; they are
rechecked when written, not FK-bound to the row's future current state.

Immediate SQL constraints prove that a present attachment cannot dangle or
mismatch. They do not prove reverse total participation. Before guard completion,
the root asserts complete one-to-one attachment/event/IO parity; invariant
collection independently detects orphans. If SQL-only bidirectional total
participation is later required, that is a separate adjudication rather than a
claim this layout already provides it.

### Deterministic errors

| Condition | Stable code |
|---|---|
| Unchanged eligible FIFO/exact-lot quantity shortage | `materials` |
| Exact lot/unique unavailable to the authorized owner/custody/state at initial resolution | `item_unavailable` |
| Nonintegral, unsafe, nonpositive, or above-cap quantity | `qty` |
| Malformed closed request; impossible mode tuple; supplied logical identity/definition/policy contradicts its verified pin; initial split-custody mismatch | `bad_item_request` |
| Exact immutable definition absent | existing `definition_not_found` |
| Candidate membership, quantity, custody, source quality, or predicate changes after admission; CAS fails; an unplanned leaf is needed | `contention` |
| Stored-definition or SQL integrity failure | existing registry/item integrity classification, including `item_integrity_error` |
| Lost commit acknowledgement or failed pg-mem recovery | existing `item_commit_unknown` or `item_recovery_required` |

An exact request never substitutes another lot, definition, source, or quality
tuple. Error data must not disclose another owner's quantities, hidden hashes,
private provenance, source state, or custody.

## Legacy compatibility and dormant boundary

The Task 5 trusted adapter preserves the exact original canonical legacy stack
label. `standard` and `pristine` stay distinct; baseline-valid mixed case and
Unicode stay unchanged. A nonnumeric legacy stack receives a null digest through
its reviewed compatibility classification. Unique compatibility remains
`standard`, null condition, and `ineligible` export. Task 4.2 does not install
that adapter, manifest, migration, fence, or live cutover.

This amendment changes no existing Task 4.2 acceptance requirement. Passing the
quality-specific or staging tests below cannot complete Task 4.2. Completion
still requires the full tracked Task 4.2 plan matrix: wired root suites, complete
identity/FIFO/lineage/rollback/replay/invariant coverage, 100 seeds × 250 steps,
real PostgreSQL constraints/races, regression/gate/doc checks, both independent
reviews, and controller verification. Task 4 remains dormant after its scoped
commit; Task 5 owns live compatibility cutover and Task 8 owns HTTP acceptance.

## Normative conflict audit

No binding normative contradiction was found. The approved lot amendment
requires mandatory definition quality checks and exact legacy preservation, but
does not provide a fixed label, numeric bounds, a threshold table, a source rule,
or a mode/nullability matrix. This amendment closes that downstream representation
gap while leaving derivation with the real producer.

Ignored Task 4.2 working notes contain an older different `fixed`/`bounded`
table. Those notes are nonnormative rationale only, were explicitly unapproved,
and are not dependencies of this contract. The controller's adopted
table supersedes that working assumption; this is not a conflict between
normative sources.

Stop for explicit adjudication if a binding source is found to require primitive
numeric reconstruction from the digest, band-only fixed quality, a digest on
every categorical bounded value, SQL-only bidirectional attachment participation,
or custody change through `splitLot`. Do not invent authority, fields, defaults,
brands, registries, or trigger protocols to conceal such a conflict.
