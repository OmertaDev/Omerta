# Phase 2A Task 4.2 dormant exact transition amendment

Status: **ADOPTED 2026-09-07; NOT IMPLEMENTED**. The controller adopts this bounded amendment after a fresh independent architectural spec review. Its companion is the [transition implementation addendum](../plans/2026-09-07-world-graph-phase-2a-lot-transition-addendum.md). Design adoption does not establish implementation acceptance or production authority.

## Problem and governing sources

The adopted Task 4.2 brief requires normalized unique owner/state transitions, historical attachment validity after legal custody changes, and at least 100 seeds × 250 grant/consume/split/authorized escrow/release steps. The frozen public lot leaves contain no custody transition. `splitLot` explicitly preserves custody. The v2 authority contains definition/selection pins but no destinations or operations. Putting a destination in normalized `request.input` cannot authorize it.

Read this amendment with the [lot-integration amendment](2026-09-07-world-graph-phase-2a-lot-integration-amendment.md), [lot-contract amendment](2026-09-07-world-graph-phase-2a-lot-contract-amendment.md), [definition-registry amendment](2026-09-07-world-graph-phase-2a-definition-registry-amendment.md), and [lot-contract implementation addendum](../plans/2026-09-07-world-graph-phase-2a-lot-contract-addendum.md). Their full original acceptance remains mandatory. The newly approved `compareItemLockEntries` export and assertion-only `assertLotDefinitionPin(client, mutation, {owner, definitionHash, direction})` are existing decisions. The latter compares root owner and exact definition pins only; it cannot authorize cross-owner transitions.

Observed seams in the actual worktree:

- `src/items.js:373–423`: legacy `compositeAuthority` and `assertCompositeAuthority` authorize bounded destination/operation sets. They are legacy execution authority, deliberately excluded from v1 replay hashing.
- `src/items.js:565–606`: `withLotMutation` closes the original nine-field v2 authority, stores canonical request bytes, and calls `runMutation` with empty legacy authority sets. There is no v2 transition authority to recover from those empty sets.
- `src/items.js:788–1000`: `createItem`, `transferItem`, `consumeItem`, `escrowItem`, and `releaseEscrow` use legacy template-based signatures/events. Escrow changes current owner to operation and records the original depositor; release checks that exact depositor.
- `schema.sql:4479–4528`: `item_instances` is the authoritative unique current row. `operation_escrow` has one row per item and a current-state composite FK. This live custody FK is deliberately different from immutable historical IO FKs.
- `src/operations.js:1010–1041`: `destinationsFor` derives legacy destinations from recorded depositors and role accounts; `releaseAllEscrow` uses the recorded depositor. The operation runtime validates its own action/participant authority. Task 4 must not copy these broad sets into v2 or convert these callers early.
- `src/item-lock-trace.js`: one comparator orders all custody/lot/unique keys. Complete admission precedes item locking. New transition work must use that plan and existing root ordinal.

## Alternatives and recommendation

| Alternative | Concrete change | Assessment |
| --- | --- | --- |
| A — recommended | Add a closed optional extension to v2 authority containing exact single-use transitions; add `grantUnique` and `applyItemTransition` as dormant exact leaves. | Explicitly closes the missing authority and unique-creation contracts, leaves original lot signatures and Phase 1 callers intact, and exercises the full acceptance through trusted dormant fixtures. |
| B | Overload each legacy unique leaf with v2 exact definitions and add general v2 destination/operation arrays. | Touches five live leaves, creates dual signature/event rules, and authorizes a larger cross-product of subjects and destinations than any one issued action needs. Replay and lock-order risk exceeds A. |
| C | Keep all frozen shapes and use legacy leaves or direct SQL from the stateful fixture for escrow/release. | Does not prove the required normalized exact transition path. Direct fixture SQL is not authorized mutation evidence. Split cannot supply the missing custody authority. This would require weakening acceptance and is rejected. |

Adopt A. Two additive leaf signatures and a bounded authority extension are the smallest recommended coherent contract. This is an explicit amendment to frozen shapes, not an interpretation that the original shapes already permit transitions.

## Exact authority extension and compatibility

Use the existing private token, guard, root state, and envelope version 2. Do not populate the legacy destination/operation sets from this extension. Do not expose the private root state.

```ts
type DirectOwner = Readonly<{ scope: 'character' | 'account'; id: string }>;
type ItemOwner = Readonly<{ scope: 'character' | 'account' | 'operation'; id: string }>;
type CustodyIdentity = Readonly<{
  state: 'direct' | 'escrowed'; scope: null | 'operation'; id: string | null;
}>;
type OriginalLotAuthority = Readonly<{
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
type LotAuthority = OriginalLotAuthority | Readonly<OriginalLotAuthority & {
  itemTransitions: readonly ItemTransition[];
}>;
type LotMutationRequest = Readonly<{ input: CanonicalJson; authority: LotAuthority }>;
type LotCandidateRoot = Readonly<{ owner: ItemOwner; authority: LotAuthority }>;
```

Both alternatives are exact-key closed. The original shape remains byte-compatible. The extended shape requires the `itemTransitions` key; its value must be an array, never undefined or null. Missing means no transition authority and remains missing in canonical request bytes. Never add `[]` before hashing or persisting. Explicit `[]` is a different exact envelope from absence and conflicts under the same key. No old guard is rewritten or inferred to contain new authority.

The extended array has 0–256 entries, subject to the existing whole-request 4096-member/65536-text-byte limits; the smaller effective bound wins. Entries are sorted using the existing canonical item comparator for the subject's lot/unique key, and each `(storageKind, subjectId)` occurs at most once. Thus one root cannot apply a second transition to the same subject or refer to an ID created inside that root. Later transitions use a new logical action and fresh complete plan. Each declared entry must be applied exactly once before root completion. Definition hashes must already appear in the root's input pins. No transition entry can grant a new definition or create an item.

`withLotMutation` retains the exact detached owner/authority in its existing private state. `assertLotCandidateRoot` compares the chosen complete authority variant exactly. The existing definition assertion remains root-owner-only. The following narrow internal `src/items.js` seam lets `src/itemlots.js` compare its callback-scoped candidate plan's detached entry with the real root and consume that entry's one use:

```ts
assertAndUseLotTransition(client, mutation, transitionIndex: number,
  transition: ItemTransition): void;
```

It checks the private transaction/token/root, index, exact canonical entry equality and unused status, then marks the index used synchronously. It returns no root state or capability. `applyItemTransition` obtains the data from the already-validated complete plan's root, never through a new private-state reader. It invokes this seam only after candidate/policy checks and before writes. Any subsequent failure poisons the root, so a used index cannot survive a failed transition in a completed guard. This is one additional explicit internal bridge amendment; it is not a second token, callback capability, guard, registry, or resolver API.

## Closed transition subjects and entries

The full `LotEconomicIdentity` is the adopted exact-key type: logicalItemId, definitionHash, owner, custody, qualityBand, qualityStateDigest, tradePolicyHash, binding, transferRestriction, seasonId, runId, sourceCapId, expiresAt, ageBasisAt, and provenanceCoalescingClass. Every null is exact. Its existing string, timestamp, quality, and policy validation applies without alteration.

```ts
type UniqueExpected = Readonly<{
  definitionHash: string;
  owner: ItemOwner;
  state: 'active' | 'escrowed';
  custody: CustodyIdentity;
  qualityBand: string | null;
  qualityStateDigest: string | null;
  conditionSummary: null;
  exportPolicy: 'ineligible';
}>;
type UniqueSubject = Readonly<{
  storageKind: 'unique'; itemId: string; expected: UniqueExpected;
}>;
type LotSubject = Readonly<{
  storageKind: 'lot'; lotId: string;
  expected: Readonly<LotEconomicIdentity & { remainingQuantity: number }>;
}>;
type ItemTransition =
  | Readonly<{ kind: 'escrow'; subject: LotSubject | UniqueSubject; operationId: string }>
  | Readonly<{ kind: 'release'; subject: LotSubject | UniqueSubject; depositor: DirectOwner }>
  | Readonly<{ kind: 'consume_unique'; subject: UniqueSubject; depositor: DirectOwner | null }>
  | Readonly<{ kind: 'consume_escrow_lot'; subject: LotSubject; depositor: DirectOwner }>
  | Readonly<{ kind: 'transfer_unique'; subject: UniqueSubject; destination: DirectOwner }>;
```

All unions are branch-exact: for example release cannot carry `operationId`, transfer cannot carry `depositor`, and no branch accepts a reason, provenance replacement, quantity override, policy override, destination callback, or arbitrary effect object. IDs use existing canonical bounded item/owner identity validation. `UniqueExpected.qualityStateDigest` is an explicit addition to the adopted `unique_exact.expected` shape. That candidate API has not been implemented and has no stored replay receipts; its new exact shape requires this key. The original *root authority* shape remains accepted as described above. This avoids silently losing numeric unique quality while adding no `ItemDefinition` field or hash domain.

The existing `unique_exact` requirement uses the amended `UniqueExpected`. For a lot transition, an existing `lot_exact` requirement has the exact subject lot ID and full positive remaining quantity from the transition pin. The private candidate planner additionally compares the entire pinned lot expected identity. Candidate planning matches exactly one requirement to one transition; a requirement cannot be consumed once by a quantity leaf and again by a transition. No new returned plan token is needed.

## Additive leaf signatures and results

```ts
type UniqueOutput = Readonly<{
  logicalItemId: string;
  definitionHash: string;
  owner: DirectOwner;
  qualityBand: string | null;
  qualityStateDigest: string | null;
  tradePolicyHash: string;
  conditionSummary: null;
  exportPolicy: 'ineligible';
  provenanceClass: 'crafted' | 'salvaged' | 'awarded' | 'imported';
  provenanceDigest: string;
}>;
type UniqueProjection = Readonly<{
  id: string;
  logicalItemId: string;
  definitionHash: string;
  owner: ItemOwner;
  state: 'active' | 'escrowed' | 'consumed';
  custody: CustodyIdentity | null;
  qualityBand: string | null;
  qualityStateDigest: string | null;
  tradePolicyHash: string;
  conditionSummary: null;
  exportPolicy: 'ineligible';
  mutationId: string;
  outputOrdinal: number;
  createdAt: string;
  updatedAt: string;
  consumedAt: string | null;
}>;
type TransitionState = Readonly<{
  owner: ItemOwner;
  custody: CustodyIdentity | null;
  uniqueState: null | 'active' | 'escrowed' | 'consumed';
  remainingQuantity: number;
}>;
type ItemTransitionResult = Readonly<{
  kind: ItemTransition['kind'];
  storageKind: 'lot' | 'unique';
  subjectId: string;
  definitionHash: string;
  before: TransitionState;
  after: TransitionState;
  movedQuantity: number;
  removedQuantity: number;
  mutationId: string;
  eventOrdinal: number;
  inputOrdinal: number;
  outputOrdinal: number | null;
}>;
grantUnique(client, mutation, definition: ItemDefinition,
  output: UniqueOutput): Promise<UniqueProjection>;
applyItemTransition(client, mutation,
  transitionIndex: number): Promise<ItemTransitionResult>;
```

These are internal dormant repository leaves, owned by `src/itemlots.js` beside the normalized writers. They accept only an active v2 token on the exact owned client. `applyItemTransition` is a five-branch closed switch; there is no general route/effect dispatch. The integer index refers only to the already detached root array and must be in bounds and unused. No client-visible API accepts it in Task 4.2.

`grantUnique` rereads through unchanged `definitionByHash`, compares the entire caller intrinsic projection, requires economic kind and `stackable === false`, verifies the owner scope and output pin, and enforces the exact adopted quality representation table. Quantity is intrinsically one, checked against the definition cap. `tradePolicyHash === definitionHash`. It derives a fresh permanent server item ID and creation time. Output owner must equal the root owner and resolved owner; it cannot mint directly into operation custody or award another participant. Condition and export remain null/ineligible. Private provenance never enters `UniqueProjection`. Creation references in the projection retain their original root and output ordinal through later transitions.

Numeric quality still needs trusted producer derivation and a digest; representation validity is not formula proof. The same fixed/bounded/inherited/none table applies to this new exact unique branch, without changing legacy standard quality. New unique storage may retain logical ID in the legacy nonempty template column internally, but no exact leaf selects by that column and no compatibility public alias is synthesized.

For unique result states, remainingQuantity is 1 before a legal transition, 1 after a move, and 0 after consumption. For lots it is the actual remaining quantity; uniqueState is null. Consumed/exhausted after-state has null live custody. The historical before-state and depositor are preserved in normalized records. An escrow-consumed unique keeps its recorded operation owner and existing consumed timestamp semantics.

## Legal transitions and trusted derivation

| Entry | Required before state | After state and additional rule |
| --- | --- | --- |
| escrow | Positive whole lot or active unique, direct character/account owner equal to root owner | Operation owner and exact operation custody; record the exact previous owner as depositor. |
| release | Positive whole lot or escrowed unique with matching operation owner/custody | Direct owner equal to both the pinned depositor and locked custody depositor, even if that original character is dead. |
| consume_unique | Active direct unique owned by root, or exact escrowed unique | Consumed permanent row; direct entry has null depositor, escrow entry matches recorded depositor and exact operation authority. |
| consume_escrow_lot | Positive whole lot held by the exact operation with recorded depositor | Remaining zero; remove current custody claim; retain permanent physical lot and historical identity. |
| transfer_unique | Active direct unique owned by root; distinct direct destination | Active unique at exactly the pinned destination; exact definition must be ordinary and transferable and admit both direct scopes. |

Custody entries require root aggregate kind `operation` or `mystery` and its exact ID equal to the operation in the escrow entry or expected escrow custody. For escrow, from owner equals root owner. For release and escrow consumption, root owner remains the authenticated server-resolved actor owner; recorded operation ownership is a narrow subject authority exception authorized only by that exact entry. Root owner and resolved owner must match. The requested actor does not become the depositor merely by possessing a root token.

The trusted producer resolves the issued action's existing permitted deposit/release/consume/transfer instruction and selected immutable definitions. It discovers all affected source, destination and depositor owners plus the one exact operation before lower lock classes; locks them under the approved shared order, including any exact Crew prefix; checks actor membership/role/consent and aggregate revision/action legality; then derives the entry from the locked source and permitted instruction. It must not derive a destination from `request.input`, arbitrary operation ownership, a syntactically valid ID, or the definition's project scope alone. All extra client destination/operation/depositor/quality/effect fields fail its closed input or demonstrably cannot affect the derived envelope or result.

Item locks still follow guard and aggregate authority. Pre-item candidate reads are revalidated under the complete admitted lock set, including all pre-existing live custody rows. A change to the action predicate, source, depositor, quantity, output destination authorization or candidate membership is `contention`; restart the entire root with the same logical key after rollback, without substituting a newly eligible source.

The grant/quality producer and transition producer may be proven through one frozen test-only issued-action catalog. The fixture exposes only `runTrustedDormantItemAction(fixture, {issuedActionId})`; each fixture action records its permitted exact item, actor, aggregate, participants, input pins and expected revision server-side. It uses real owned item transactions and the same item leaves/SQL. It rejects additional request keys before mutation. Its policy and authorization rules are deterministic and closed; it is not a production policy registry or a raw SQL substitute for the leaf under test.

**Explicit custody classification amendment:** for freshly created dormant exact definitions, the reviewed fixture may exercise recorded-only operation custody when the definition includes its original direct owner scope and project permission *and* the exact fixture-issued operation/mystery instruction authorizes this item and actor. Project permission alone grants nothing. No general project inventory/owner rewrite is introduced. Production producer admission and live compatibility `recorded_only` classification remain Task 5/later producer work. If the controller declines this bounded new-unique custody classification, the original stateful acceptance cannot be satisfied by pretending legacy mutation tests are exact transition tests.

Ordinary lot custody work is limited to whole positive remaining lots and initially unrestricted/unbound lots (`binding` and `transferRestriction` null). It preserves definition, both quality fields, trade policy, season/run/source-cap, expiry, age basis, all source provenance, ID, original quantity, and creation attachment. Custody escrow/release is not an ordinary trade, so transferable=false does not alone disallow returning the recorded deposit; a permitted issued custody action is still mandatory. Restricted/bound lot custody needs a later explicit policy contract and fails closed here. No arbitrary lot ownership transfer is added.

Partial custody requires a prior `splitLot` action under unchanged parent custody, then a new issued action for the existing child. Split never consumes an itemTransition entry. Splitting an escrowed lot preserves its exact depositor as well as owner/custody; parent and child retain separate custody claims and immutable source lineage. Releasing either returns only its recorded depositor. Splitting is not a route to a different operation.

## Normalized storage, invariants, and failure behavior

Keep `item_instances` as the single unique current authority; add nullable exact attachment columns for new unique rows, with an all-present exact branch versus all-null legacy branch. Legacy creation callers continue producing legacy rows and legacy events. No backfill, compatibility map, authority epoch, trigger, new live caller, or migration service belongs here. New exact uniques have one normalized creation output and exact quality/provenance attachment from creation onward.

Keep `operation_escrow` as the one live unique custody claim and preserve its current-state FK and depositor rule. Store lot live custody/depositor columns on `item_lots`; require coherent all-null direct state versus fully populated operation state. No new custody registry is needed. Candidate traces include pre-existing unique custody keys and lot keys; a lot's in-row custody is protected by its lot lock. No duplicate synthetic custody row lock is claimed for that in-row state.

Every transition emits one normalized input/event at one existing `nextItemMutationOrdinal`. Moves additionally emit one normalized output at the same ordinal, referencing the same immutable creation attachment; they create no new item/lot. Consumption emits no output and removes quantity once. Unique creation emits its one creation event/output. Split continues using its distinct debit input and later child output ordinal with the explicit earlier-input link.

Historical IO references the permanent subject/definition/creation attachment and the same transition root/event ordinal. It does not FK to mutable current owner/state/custody/remaining quantity. Movement output attachment references are explicitly different from newly created output attachments in the event branch and conservation rules; output uniqueness remains shared across both kinds. Before/after owner/state/custody/depositor snapshots are immutable and matched to the locked row when written. Root parity verifies one event/input for each applied transition and one output only where its branch requires it; the invariant collector independently detects absent reverse participation.

Per-hash conservation counts actual grants once and actual consumption once. Movement input/output legs cancel; split legs transfer existing quantity; migration observations do not create quantity. Exact per-quality accounting and physical row retention remain mandatory. Legacy unique history stays valid, including consumed instances without live custody. New state sequences must start at exactly one creation and admit only the table above. No post-consumption action is legal.

Register all inverses before writes. pg-mem recovery removes dependent normalized IO/events before restoring current lot/unique/custody state and external cash/car writes; guard removal remains last and only for the owned fresh reservation. Restore unique/current custody in FK-safe order. PostgreSQL does zero compensation SQL. Any failed leaf poisons the root, including caught errors and duplicate transition application.

Malformed/extra/undefined fields, substituted definition/policy/quality identity and invalid indexes are `bad_item_request`; initially unavailable subject/owner/state/custody/depositor is `item_unavailable`; lacking a valid root transition entry or unsupported leaf/root authority is `item_mutation_authority`. Reusing an already applied transition or needing an unplanned requirement is `contention`. Invalid quantities are `qty`, unchanged ordinary quantity shortage remains `materials`, and definition absence remains `definition_not_found`. Post-admission/CAS drift is `contention`. Integrity, commit uncertainty and recovery-required classifications are unchanged. Errors disclose no other owner's private custody or provenance.

## Exact replay

Completed matching old-shaped v2 envelopes return their original result before the callback and before any fresh actor/operation/custody/activation check. New shaped envelopes include exact transition entries in the existing canonical digest and persisted request_json. Replay uses the originally persisted issued action, owner and authority; it does not rederive a replacement depositor, participant, operation, or active definition. Matching replay returns exactly the old unique ID, lot ID, result snapshots and ordinals after the subject is consumed or moved elsewhere. The transition implementation is not called again.

Absence versus [] conflicts, as do well-formed changes to subject, expected snapshot, destination, depositor, operation, action or definition pin under the same scoped key. Noncanonical entry order rejects as bad_item_request before hashing; it is never silently sorted into authority. Other malformed/noncanonical requests likewise reject rather than becoming old authority. Fresh/incomplete roots revalidate the authorized action and complete candidate set. No missing or incomplete guard becomes success; ambiguous commit retains existing exact-key reconciliation behavior. v1 request hashing and itemAuthority exclusion are untouched.

## Migration boundary and adopted changes

`grantUnique` creates a new exact non-stackable item; it cannot accept an existing item ID or `migration_origin`. Transition leaves reject all-null legacy attachments. Task 5 alone maps and attaches pre-existing unique rows, including consumed ones, through the distinct migration observation branch; observations cannot reset creation history, add quantity, or resurrect consumed rows. A direct fixture SQL migration observation may test invariant classification but does not count as the producer or transition success evidence required here.

This amendment explicitly updates: (1) both frozen v2 authority declarations to the old/extended closed union; (2) `LotCandidateRoot` equivalence; (3) unique candidate expected digest; (4) the two additive leaf/result/output types and assertion-and-use bridge; (5) the narrow recorded-only new exact fixture custody classification; (6) movement output versus creation attachment branch semantics; and (7) the corresponding implementation addendum. Existing lot leaf signatures and split semantics do not change. Task 3 does not change. The original Task 4.2 acceptance is neither replaced nor reduced.

This amendment resolves the prior missing transition-authority contract. Only the bounded dormant implementation is authorized by the existing program approval; runtime correctness, independent implementation reviews, PostgreSQL evidence and every original acceptance gate remain outstanding.

## Explicit implementation clarifications

An exhausted lot retains its last owner, immutable creation/source attachment and
zero remaining quantity, but has no live custody or depositor claim. Its current
custody/depositor columns are null; former values remain in immutable IO history.
`LotProjection.custody` is null for this exhausted branch only. Positive lot
admission and `LotEconomicIdentity` retain the closed direct/escrowed identity.
Test both whole escrow consumption and a split exhausting its parent; the child
inherits the exact pre-debit custody/depositor while the exhausted parent clears
its current claim.

For an authorized escrowed split, the quantity-only root's `owner` and
`authority.resolvedOwner` are the exact recorded operation owner, and its
operation/mystery aggregate ID matches that custody. A trusted issued split
action must separately validate the authenticated actor's role, consent,
aggregate revision and permitted operation under locks. It must resolve the
exact parent and depositor through complete candidate admission. This is neither
a character actor spending as if it directly owned the parent nor permission to
mint arbitrary operation holdings. Split consumes no transition entry; parent
and child preserve the same depositor, and no other operation can be substituted.

Replay tests must also pass through the closed issued-action producer after
consumption, death, role changes and action-revision changes. It resolves the
original authenticated issued descriptor/receipt before fresh-state derivation;
only a fresh callback evaluates current mutable permissions. Direct literal
root-receipt replay alone does not establish this composition.
