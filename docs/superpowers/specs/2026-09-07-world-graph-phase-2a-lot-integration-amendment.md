# Phase 2A Tasks 4–5 — Lot Integration Amendment

Date: 2026-09-07. Status: approved design amendment. This contract supersedes conflicting downstream Task 4–5 wording in the Phase 2A specification and implementation plan and narrows the new HTTP action scope to Task 8's Phase 2 route family. It also establishes the optional exact Crew-authority prefix reflected in the program, cross-cutting, and affected later specifications. Approval establishes design and task decomposition; it does not begin or complete registry implementation, inventory migration, activation, or release.

The [Definition Registry Amendment](2026-09-07-world-graph-phase-2a-definition-registry-amendment.md) retains precedence over every Task 3 interface, six-table schema, intrinsic definition vocabulary, seven hash domains, admission rule, separate transaction brand, policy, and review gate. Task 4 execution requires completed Task 3.1–3.3 reviews and verification. All interfaces added here are downstream item integration contracts; they do not alter Task 3.

Read with the [Phase 2A specification](2026-09-04-world-graph-phase-2a-materials-salvage-design.md), [cross-cutting specification](2026-09-04-world-graph-phases-2-3-cross-cutting-design.md), and [existing Phase 2A implementation plan](../plans/2026-09-04-world-graph-phase-2a-implementation.md). No merge, production push, deployment, production activation, OMR authority, or NFT transition is authorized.

## Decisions and alternatives

Task 4.2 additionally consumes the adopted [lot contract amendment](2026-09-07-world-graph-phase-2a-lot-contract-amendment.md) and its [implementation addendum](../plans/2026-09-07-world-graph-phase-2a-lot-contract-addendum.md). They resolve downstream quality representation, producer authority, complete candidate admission, split custody, historical attachment constraints, and errors without weakening this amendment or completing implementation.

Use dormant lot primitives in Task 4, followed by one coherent Task 5 caller/schema/authority cutover. This gives two reviewable boundaries while preserving the current live lock order until all shared consumers can move together. Shipping converted leaf functions under old outer locks would produce mixed orders; maintaining writable old stacks alongside lots would produce two authorities. Neither is an acceptable intermediate runtime state.

Keep completed semantic `result_json` permanently in the existing guard table. An additional archive service would add retrieval and corruption states without satisfying a present retention need. Transport cache expiry never deletes the domain receipt. Oversized legacy stacks become deterministic capped chunks; the reviewed definition quantity cap stays unchanged.

Keep legacy and Phase 2 replay envelopes distinct. Existing raw domain keys, route-derived keys, mutation kinds, request hashing, result payloads, and global HTTP cache behavior retain their meanings. New account/action-scoped HTTP transport belongs to Task 8's Phase 2 route family. Task 4 proves scoped domain identity only. The scoped transport adapter belongs at `src/server.js:1051–1108`: route configuration supplies an allowlisted Phase 2 action scope; the client cannot choose it through a body/header/route string. Unconfigured historical routes preserve raw cache keys, the existing method/URL/body digest, response replay, and `(account_id,key)` semantics.

## 1. Registry admission and compatibility authority (seams 4, 6, 7)

An inventory definition must be a verified exact `ItemDefinition` with `kind` equal to `material` or `item` and all required economic fields. A `concept` is never grantable. Lots require `stackable === true`; unique creation requires `stackable === false`. Definition quality, scope, trade policy, and quantity checks are mandatory. `tradePolicyHash` is exactly `definitionHash` when present. Neither a gameplay category such as tool nor an old `item_template` node changes that rule. There is no `definition.bundleHash`.

New work obtains a separately verified `SelectedDefinition` or the exact server-issued action's selection context. It binds selected bundle, namespace, activation revision/event, and exact definitions independently. Recovery and old holdings use immutable exact lookup. No adapter discovers an arbitrary containing bundle and treats it as selection authority.

Legacy **stack** compatibility preserves the exact canonical original quality label, a nonempty string of at most 80 characters, through the trusted quality-state adapter. Labels such as `standard` and `pristine` remain distinct in lot identity, migration receipts, replay, recipe counts and conservation; do not trim, lowercase, translate, reject or collapse a previously valid label during conversion. The unique-only `standard` rule does not apply to stacks. This requires no change to Task 3's `qualityMode` enum, schema, vocabulary or hashes. Paired-label fixtures must detect equal-and-opposite per-quality drift even when owner/template/global totals still match.


Author and compile the production-profile compatibility source library through the existing corpus path first, then generate/pin the source-controlled compatibility map from that verified artifact's exact memberships. The map is not a compiler authority input, so there is no map/hash build cycle. The map pins:

```ts
type CompatibilityEntry = {
  templateId: string; logicalItemId: string; definitionHash: string;
  storageKind: 'stack' | 'unique';
  operationCustody: 'recorded_only' | 'forbidden';
};
type CompatibilityManifest = {
  formatVersion: 1; bundleHash: string;
  entries: readonly CompatibilityEntry[];
};
```

Qualified IDs use `packageId::localId`; old `mat:*`/`item:*` strings remain public aliases only. Build output provides immutable bytes and a **separately trusted** descriptor containing exactly `{packageId, packageVersion, authorityProfile, bundleHash, dependencyLockHash}`. The build checks each map hash against the verified artifact's exact membership. Bootstrap stores it using unchanged `storeSealedBundle`, then checks unchanged `registerItemDefinitions`. Both complete before entering an item transaction or the cutover lock. Neither runtime compilation nor direct definition inserts nor activation is required. The migration consumes only this pinned stored artifact, never an active pointer.

Census production templates and every legacy stack/unique row, including zero stacks, consumed uniques, and operation ownership. Unknown templates or a map/artifact mismatch stop publication with bounded diagnostics. They are not synthesized into definitions. Arbitrary test-only template strings require an explicit fixture corpus, trusted fixture descriptor, and injected rehearsal manifest; fixture definitions never become production selections. Bellini namespaces and its tables cannot match the compatibility map.

The live `owner_scope='operation', owner_id=<original operation>` tuple remains unchanged, including escrowed and consumed uniques and operation-owned stacks. A compatible definition's existing `project` owner permission is only a server-derived compatibility classification. It is not a new owner enum, storage rewrite, project inventory feature, or caller-supplied capability.

For live unique custody, derive classification from the locked exact operation/mystery, composite custody FK, and original depositor. Releases return only to that depositor, including a dead original character. For consumed uniques, use the conserved event chain and recorded historical operation custody; absence of a current escrow row is expected.

Legacy operation-owned stacks require a different preservation rule: Phase 1 permits an operation owner tuple without an operation FK or recorded depositor. Absence of a live operation root alone is **not corruption** and cannot exclude previously valid holdings. Validate the original source row and its existing guard/event conservation; persist a compatibility receipt proving precisely that tuple, quantity and history, classified through the compatibility definition's project permission. It does not invent a depositor, operation FK, or historical creator. If a current trusted operation context exists, existing authorized uses continue under that context. Otherwise retain the exact tuple and read visibility, and permit only an existing trusted legacy owner-scoped primitive invocation under its unchanged owner/guard rules; create no public release, project transfer or fallback beneficiary. Holdings that already lacked a user recovery route do not gain one through migration.

This receipt-preservation option is recommended over requiring a live operation root for every stack, which would reject valid legacy rows, or mapping them to an inferred depositor, which would invent authority. Actual mismatched event totals, forged guards or contradictory recorded provenance still stop publication as invariant corruption. Review must verify whether each existing trusted operation-stack consumer has an execution path and record that fact; a missing route is not permission to delete or rewrite the holding. Generic callers cannot nominate operations/projects, and ordinary transfers cannot acquire this compatibility capability.

## 2. One item transaction and shared mutation root (seams 1, 9, 10, 11)

All economic writes, including lot writes, remain inside `withItemTransaction(pool, callback)`. Registry transactions remain separate and pool-owned. The narrow internal bridge is owned by `src/items.js`; it validates its private WeakMap and matching AsyncLocalStorage on every use:

```ts
// Internal repository integration only; never a content capability or HTTP input.
assertItemTransaction(client): void;
itemMutationContext(client, opaqueMutation): Readonly<{
  key: string; mutationId: string; envelopeVersion: 1 | 2;
}>;
nextItemMutationOrdinal(client, opaqueMutation): number;
registerItemTransactionUndo(client, inverse: () => Promise<void>): void; // existing seam
poisonItemTransaction(client, error): void;
withItemRead<T>(queryable, callback: (client) => Promise<T>): Promise<T>;
```

There is one root guard, one private mutation token and one ordinal allocator for a compound operation. Lot leaves validate the same token as legacy leaves; shape-compatible objects, another client's token, expired tokens, and a registry transaction fail. A failed leaf poisons the root even if its caller catches the error. The adapter does not start another transaction or reserve a guard per leaf.

**Legacy envelope v1:** existing guard keys and digest rules stay byte-compatible. `itemAuthority` stays excluded from the legacy digest. A completed result is resolved and returned before fresh living-character, participant, car-existence, activation, or custody checks. A new legacy execution still validates all current authority under the new shared lock order after Task 5. Old completed guards/events need no rewrite or fabricated UUID lineage. New legacy work after cutover can carry a UUID and normalized lineage while retaining v1 key/digest/result semantics.

Task 4.1 assigns a server-generated `mutation_id` UUID to every newly reserved v1 or v2 root so the fresh callback's `itemMutationContext` retains the declared non-null string contract. Pre-existing v1 rows may retain null IDs permanently and are neither updated nor given fabricated lineage on replay; completed replay never enters the callback. The UUID is outside every legacy key/digest/result/event-key encoding. This additive fresh identity does not activate normalized legacy event IO or the Task 5 cutover. Schema admits both old null-ID v1 rows and fresh UUID v1 rows, while v2 requires its UUID.

**Phase 2 envelope v2:** `withLotMutation` keeps the planned call shape:

```ts
withLotMutation<T>(client, {
  actorAccountId, actionKind, idempotencyKey, owner, request
}, action: (mutation) => Promise<T>): Promise<T>;
```

`actionKind` is server-allowlisted. `owner` and the following private request envelope are server-derived and synchronously copied/validated before any await:

```ts
type LotMutationRequest = {
  input: CanonicalJson;
  authority: {
    issuedActionId: string;
    aggregate: { kind: string; id: string };
    resolvedOwner: { scope: string; id: string };
    bundleHash: string; namespace: string;
    activationRevision: number; eventId: string;
    inputDefinitionHashes: readonly string[];
    outputDefinitionHashes: readonly string[];
  };
};
```

`CanonicalJson` means bounded, closed, inert canonical data, not arbitrary JavaScript objects. Authority arrays use deterministic ordering. The normalized private envelope is persisted with its digest on first execution. Retry resolution binds the original authenticated input/opaque issued action to that persisted authority; it does not rederive the original owner from a replacement character or replace an old bundle pin with today's active bundle. A completed matching envelope returns the stored result even after target consumption. A newly issued action or changed input, aggregate, owner, selection, or definition pin in the same scope conflicts. Fresh incomplete work revalidates current authority under locks; an incomplete reservation never returns fabricated success.

The storage key is the planned `sha256(Frame('omerta:item-mutation-key:v1', actorAccountId, actionKind, externalKey))`. Add an explicit envelope discriminator in the **existing** guard row and enforce v2 account/action/external-key uniqueness. Lookups must verify envelope, scope, and digest; a pre-existing legacy row at a colliding storage key is a conflict, never converted, overwritten, or treated as a v2 replay. Legacy raw keys remain globally conflicting across owners and kinds. No second guard table is introduced.

Permanent `mutation_id` UUIDs identify fresh normalized mutations. Completed semantic `result_json` and `completed_at` remain non-null together; incomplete guards have neither. The transport cache is disposable; guards are not. Commit-before-transport-result recovery returns the same semantic result, IDs, and ordinals. Task 4 does not add result archival or an archive reconstruction path.

## 3. Lot identity, selection, and lineage (seams 3, 5, 10, 14, 16)

```ts
grantLot(client, mutation, definition: ItemDefinition, output: LotOutput): Promise<LotProjection>;
consumeLotsFifo(client, mutation, selector: LotSelector): Promise<readonly LotConsumption[]>;
consumeExactLot(client, mutation, lotId: string, quantity: number): Promise<LotConsumption>;
splitLot(client, mutation, lotId: string, quantity: number, custody): Promise<LotProjection>;
lotInventoryBoard(queryable, owner, {cursor, limit, includeLots}): Promise<LotBoard>;
```

`LotOutput`/`LotSelector` carry the specification's complete economic identity: exact definition/logical ID, owner tuple, custody state/reference, quality band/state digest, exact trade-policy hash, binding/restriction, season/run/source-cap, expiry/immutable age basis, and provenance-coalescing class. A selector also has checked quantity and either exact compatible dimensions or exact server-issued lot IDs. `LotConsumption` contains lot ID, definition hash, before/removed/after quantities and input/event ordinal. `LotProjection` contains the persisted safe identity, original/remaining quantities, state, mutation/output ordinal, and timestamps; private provenance is omitted from player projections. `LotBoard` contains compatible aggregate groups and optional bounded lot rows with an opaque next cursor. Query bounds and privacy binding become public acceptance in Task 8.

Original quantity and source identity are immutable. Remaining quantities never become negative or exceed original. Each new lot is at most the exact definition's `maximumLotQuantity` (itself at most 1,000,000); checked arithmetic rejects non-integral, unsafe, zero and negative input. A split decreases the parent and creates a child while conserving total quantity and every immutable identity dimension. The child's creation time is the actual split time; the inherited age basis and source provenance remain unchanged. Physical coalescing is forbidden.

FIFO priority is `(created_at, lot_id)` among eligible lots. It is distinct from physical locking. Before the first item lock, the operation resolves its **complete** required input set and all pre-existing unique/custody rows, using locked owners and aggregate authority; it then locks canonical item keys and rechecks every selected row, quantity, and predicate. Each exact key orders by item subtype then canonical ID; the same comparator is used by SQL acquisition and trace assertions. FIFO allocation is computed from the verified candidates under those locks. Every shared writer must lock the corresponding owner/aggregate, preventing a concurrent eligible insertion from escaping selection. If a changed candidate set requires an unplanned or lower-sorted member, abort with retryable `contention` and restart the whole logical transaction using the same key. Never acquire it late or loop inside a partly executed mutation. Multi-input crafting cannot discover inputs leaf by leaf.

Use one zero-based monotonic ordinal sequence for normalized mutation transition events. An event has at most one normalized input row and at most one normalized output row; both use that event ordinal. An input describes the pre/post state and removed/moved quantity; an output identifies its created lot or unique attachment. Split uses a source-debit event and a child-output event, with the child output referencing the source input ordinal. Unique transition events bind before/after owner, custody, state, and exact definition. Creation outputs are unique by `(mutation_id, output_ordinal)` across lots and uniques. Migration observation outputs use the same identity key but a distinct observation branch, so they never count as authorized creation.

Legacy event keys and sequence histories stay intact. Event schema/invariants discriminate these branches explicitly:

| Branch | Meaning and invariant |
|---|---|
| Legacy stack event | Historical aggregate transition under the old key/kind rules; reconciles to the frozen stack snapshot at cutover. |
| Lot transition | Exact lot/hash input/output/event parity; checked conservation and valid state/custody transitions. |
| Unique transition | One original creation, then the existing legal state machine; validated Phase 2 quality only for non-compatibility definitions. |
| `migration_origin` observation | Attaches definition/provenance to the cutover snapshot, including consumed uniques; no second creation or post-consumption transition. |

Schema checks must admit these closed branches rather than merely adding nullable columns to old constraints. Legacy unique quality stays `standard`; condition summary stays null; export policy stays `ineligible`. Existing consumed timestamps, IDs, owner tuples, and custody FKs remain unchanged. Old stack history is reconciled exactly once to the epoch opening; new lot IO accounts for all later changes. Migration observations and split transfer legs never inflate creation totals. Cash reconciliation still reads the original semantic legacy result fields and must not double-count normalized IO.

## 4. Read gates, locks, and failure disposition (seams 2, 11, 12, 15)

For pg-mem, acquire the existing Task 3 `withPhase2Read(queryable, callback)` gate **before** the whole-callback item gate. All downstream item transactions, coherent inventory reads, and combined invariant collections follow this order across pools, proxies, and forwarding aliases. Matching internal contexts bypass only their own reacquisition. Registry public mutation entry inside an item transaction is forbidden. Registry code never acquires the item gate. This composes Task 3's unchanged gate; it does not borrow its transaction brand. Replace the old item one-time tail wait for multi-query consumers with `withItemRead`.

**Approved owned-client clarification (2026-09-07).** The backend entry paths are explicit. **pg-mem:** check out one owned client without BEGIN or writes, enter `withPhase2Read(client, callback)`, acquire the whole-callback item gate, then BEGIN the one item transaction. Keep that exact client and both gates through the action, commit or compensation, and final recovery disposition. This replaces the former pool-first checkout example: native pg-mem returns the pool itself from `connect()`, but forwarding pools may return a distinct client, so a pool-bound registry context cannot authorize the required exact-client definition lookup. The changed checkout lifetime preserves registry-gate-before-item-gate-before-writes ordering. **PostgreSQL mutation:** check out one client and BEGIN the owned item transaction; use `withPhase2Read(client, callback)` around the complete action and recovery lifecycle. This checked-out-client read context participates in the existing transaction, never opens another transaction or read-only snapshot, and rejects public registry mutation entry. Do not wrap the mutation in `withPhase2Read(pool, ...)`. Read participation and the separate private item write brand coexist on that exact client; no registry write authority, context-rebinding API, raw definition-reader bypass, or Task 3 helper change is added.

The item owner retains raw action/COMMIT errors and determines rollback, compensation, discard, and safe classification before the registry read wrapper could remap them. A private result/error carrier may retain this outcome, but no result is published before cleanup. Lost COMMIT acknowledgement remains `item_commit_unknown`; failed pg-mem compensation remains poisoned `item_recovery_required`. Release or discard the owned client even if gate acquisition or BEGIN fails before the inner callback runs. Reject a pre-existing registry context at item entry, including native pg-mem's same-object case, so a public registry read cannot start item writes. Matching internal definition reads remain permitted, and fake, expired, cross-client, and registry-write tokens remain invalid item authority. Holding a checked-out pg-mem handle while queued for the outer gate is an accepted trade-off; cleanup and reentry failures must fail closed and be tested.

**Public coherent reads:** `withPhase2Read(pool, callback)` owns the repeatable-read/read-only snapshot, then internal item read protection executes on that callback client. A registry read callback cannot recursively start an item transaction/snapshot on its same connection. Invariants compose one collection callback in the same order and send alerts afterward. No broad transaction-failure fallback to unsnapshotted pool queries is allowed. Initialize backend capability before any boot helper that chooses compensation or snapshot behavior.

Task 4.1 proves the clarification with distinct forwarding clients and proxies, successful pinned definition reads inside the item transaction, registry-read-to-item nesting refusal, item-to-registry-mutation refusal on both backends, exactly one PostgreSQL BEGIN, and cleanup after acquisition/BEGIN/COMMIT/rollback failures. Prove reader-first and writer-first ordering through both gates, zero PostgreSQL compensation, preserved raw SQLSTATE disposition, and permanent exact replay. These are required implementation tests, not claims that design approval establishes passing behavior.

The currently specified fresh economic lock classes are: immutable definition reads; character; account; optional social mapping then subject generation; optional organization; guard; action aggregate; items; budget/singleton. Complete legacy replay may use a nonlocking receipt read before fresh authority locks; it returns immediately. A fresh or contested guard is acquired in the proper class after character/account authority. Recheck the guard there to close the probe/reservation race. No replay path takes a guard row lock and then descends to character locks.

**Approved exact Crew precedence amendment.** Existing `CREW_FIRST_CHARACTER_LOCKS` (`src/crew.js:35–58`) and `lockOpenCrew`/`lockOpenActor` (`src/operations.js:750–786`) use Crew before character/account/membership. `src/game.js:782` deliberately avoids a late Crew-row write because it would introduce ABBA. The lifecycle routes at `src/server.js:2924,2928,2940,2946` use those hooks. Merely changing operation opening to character-first would conflict with this live protocol.

Two concrete alternatives are available:

- **A — selected narrow precedence amendment:** allow an optional exact Crew-authority prefix, sorted by Crew ID, before character/account and the newly specified social/gang classes. Preserve the existing lifecycle protocol. All Crew IDs must be discovered before that prefix, then exact membership is rechecked after account locks; membership drift rejects and restarts the entire logical transaction. A participant or second Crew discovered after that prefix cannot be locked late. Amend cross-cutting/program/affected later specs explicitly and update their shared trace before enabling this path. This adds one narrowly scoped precedence rule; it does not authorize arbitrary organization-first ordering or call the existing protocol compliant with the unamended spec.
- **B — broader migration:** expand Task 5 to redesign every Crew lifecycle writer and operation opener under character-first ordering, including hooks, membership changes, target/claim/accept paths, and game accrual interactions. This avoids a specification prefix but is a separate concurrency project with a larger regression/race surface and no present inventory benefit.

Option A includes **targeted `acceptInvite` convergence**, not a waiver for a not-yet-member. Add trusted exact target-Crew hooks in `src/crew.js` and apply them at `src/server.js:2919`: resolve/lock the exact invited Crew before character, then revalidate invitation and current membership after account locks. Keep existing `withCharacter` accrual, persistence and gameplay authorization, the production operation opener's `FOR NO KEY UPDATE` lock strength, and accrual's explicit prohibition on a late Crew-row write. Controller inference: a rejoining character can remain in an old operation role after leaving, so an operation holding Crew can wait on that historical character while acceptance holds character and waits on Crew. A PostgreSQL rejoin/stale-role race must confirm the schedule and its removal. Also race leave/kick/recruiting/request acceptance against operation opening and participant changes. Broad alternative B is not selected.

Task 5 must converge `src/crafting.js`, `src/routes/worldgraph.js`, `src/mysteries.js`, and `src/operations.js`, including recovery/cancel/claim paths and eligibility reads. Task 4 cannot enable its new ordering in shared live legacy leaves in isolation. Traces cover callers as well as primitives and reject decreasing class, subtype, key, ID, or generation and late lower-key discovery.

Register guard ownership before a guard insert could succeed, and every inverse before its write. A leaf failure poisons the root; remove early leaf-local guard deletion. pg-mem recovery removes newly written normalized input/output rows and events first, then reverses custody/lot/unique and external cash/car writes, then deletes only root-owned new guards. Restores of pre-existing unique/custody rows use FK-safe order. If needed, undo entries have narrowly named dependency phases; do not turn this into a generic recovery framework. A pre-existing completed guard or reused definition is never undone.

Task 4.1 includes the narrow existing crafting cash-audit gap: `debitRecipeCash` currently learns the audit-row UUID only after `ledger` INSERT returns, too late to register an inverse for an after-write acknowledgement error. Add the internal optional `ledger(client, record, {beforeInsert} = {})` seam, with `ledger` still generating and returning its own primary-row UUID. A supplied hook is validated as a function and awaited before the primary INSERT; `debitRecipeCash` uses it only to register exact-ID undo. Default callers and ledger SQL/OMR recycling remain unchanged. This hook concerns the primary audit row only, does not promise compensation of secondary recycle effects, and is never authored-content or HTTP authority. Prove the actual crafting adapter's after-INSERT failure restores cash, audit rows, inventory, events and guard exactly in pg-mem, retries once with the same key, and rolls back natively without compensation in PostgreSQL. Hook failure must insert no audit row. No Task 5 live lock-order conversion is pulled forward.

PostgreSQL executes **zero compensation SQL**. On definite error, rollback and map retryable lock/serialization errors to `contention`; integrity failures fail closed. A COMMIT transport error or unconfirmed rollback yields `item_commit_unknown`, discards the broken client, and requires exact-key reconciliation on a new connection. Never claim rollback after a lost COMMIT acknowledgement. pg-mem compensation failure yields `item_recovery_required` and poisons the item gate across aliases; every later item read/write/invariant fails closed. The disposable test database/process must be recreated; no public repair API. Hold gates through final recovery disposition, and do not release a failed partial database to readers. Diagnostics remain bounded and sanitized.

Use an immutable trusted deployment-build epoch constant, compared exactly with the published epoch; never read the current value and adopt it as expected. The registry/artifact hash and schema authority version expected by that build accompany the epoch. Downstream interfaces are:

```ts
createLotDeployment({deploymentEpoch, compatibilityBundleHash, schemaVersion: 1}): LotDeployment;
requireLotAuthority(client, deployment: LotDeployment): Promise<void>;
verifyLotAuthority(queryable, deployment: LotDeployment): Promise<AuthorityReport>;
migrateLegacyInventory(client, {deployment: LotDeployment}): Promise<MigrationReport>;
```

`LotDeployment` is frozen and module-branded from trusted build configuration; unknown, unbranded, mismatched or caller-derived deployments reject. `requireLotAuthority` requires the matching active item transaction and installs a transaction-local marker on that exact PostgreSQL connection, using `set_config(..., true)` after the exact epoch check. The trigger compares marker and published immutable epoch in the same transaction on every affected unique write; original expected state, owner/CAS, and request authority checks still apply. This marker is an **obsolete-binary fence**, not protection against arbitrary malicious SQL or a database administrator. SQL capable of forging session settings is outside its claimed boundary.

Epoch observation is an immutable-generation read, not an extra normal lock class or a per-mutation singleton lock. The published epoch is not updated by ordinary work. Cutover uses its separate maintenance advisory/table-lock order. A missing marker, wrong epoch, wrong client/transaction, or unverified build fails closed. PostgreSQL local settings cannot survive the transaction; application-brand checks reject other clients even when they have copied primitives. pg-mem's explicit adapter path verifies the same generation and runtime brand; it does not claim trigger enforcement. The boot invocation passes the trusted deployment into the item-branded maintenance transaction, after backend initialization and completed registry storage. No development execution activates production content.

## 5. Deterministic migration and one-way publication (seams 5, 13, 15, 16)

This amendment replaces the original one-lot wording only for oversized source rows. Author every legacy **stack** compatibility definition with `maximumLotQuantity: 1000000`, an existing reviewed Task 3 value; reject a compatibility map with a different stack maximum. General economic definitions still use their own reviewed exact maxima. Let `q` be the exact legacy quantity and `m=1000000`. For `q > 0`, create `ceil(q/m)` parts in ordinal order, each `min(m, q - ordinal*m)`; zero creates no lot. INT_MAX remains legal input and the old compatibility aggregate ceiling of 2,147,483,647 remains enforced for future legacy grants. INT_MAX produces exactly 2,148 parts, the maximum per legacy source row. Page source rows and process bounded parts; no generic streamed-chunk framework is needed. No quantity is truncated or silently rejected for being large.

One durable source-row receipt binds epoch, framed original owner/template/quality tuple, exact original quantity, exact definition hash, original timestamps, part count, and digest of ordered part ordinals/quantities/IDs. IDs derive deterministically from this receipt and part ordinal. Every part is FK-linked to the receipt and normalized migration output. Reruns verify existing matches; they cannot repair drift by inserting an alternate set. Immutable migration provenance says only what the source proves.

Pre-publication staging of artifact admission and additive nullable schema may resume idempotently; lot mutation remains disabled. Do not commit provisional holding receipts/lots while legacy writers can change their source rows. Final cutover locks the declared maintenance fence and both old holdings tables, materializes receipts/lots/unique attachments from that locked source snapshot, verifies totals/digests/custody, applies final constraints, installs obsolete-writer rejection, publishes one epoch, and commits atomically. Page source processing inside that same transaction. A failed final cutover rolls back through the established backend path; there is no stale provisional receipt repair protocol. Already committed old writes are included; overlapping/later old writes wait and then reject. There is never a publication state with writable stacks and writable lots. No rollback to dual authority is supplied. The maintenance lock duration includes copy/verification and must be measured during rehearsal.

All direct stack counts and template-only unique selection in crafting, mysteries, and operations are replaced by pinned compatibility selectors. Internal selectors are:

```ts
compatibilityEntry(templateId, storageKind): CompatibilityEntry; // injected verified map
readCompatibilityHoldings(queryable, owner): Promise<LegacyInventoryBoard>;
selectCompatibilityInputs(client, {owner, requirements, operationContext}): Promise<CompatibilitySelection>;
lockCompatibilityInputs(client, selection): Promise<CompatibilitySelection>;
```

`requirements` are server-compiled legacy template/quality/quantity or unique requirements. `CompatibilitySelection` is a private frozen complete candidate set keyed by requirement, exact definition, economic dimensions and canonical row keys. The lock step revalidates it as described above. `operationContext` is a private server-derived custody capability, never a caller nominated ID. Compatibility consumers do not consult retired `item_stacks` for spendability.

`LegacyInventoryBoard` retains `{owner, stacks, items}`. Stack entries remain `{templateId, quality, qty, createdAt, updatedAt}`. Only the exact manifest-pinned definition and compatibility dimensions can enter this aggregate; new versions or restrictions cannot inflate legacy recipe eligibility. Migration copies the original source timestamps to its opening parts. For ongoing compatibility aggregation, `createdAt` is the minimum creation timestamp among nonzero eligible lots and `updatedAt` is the maximum update timestamp among those lots; this rule is deterministic and explicitly allowed to move when the earliest lot is exhausted. Unique response fields and ordering remain unchanged. Full identity lot detail is separate and never silently passed through legacy `safeInventory`.

Stage unique compatibility columns as nullable before backfill, then validate exact rows and apply required constraints/indexes. Do not place populated-table NOT NULL changes ahead of backfill, depend on swallowed generic migration errors, or stamp success before final verification. Compose with Task 3's post-DDL registry schema verifier without moving or weakening it. PostgreSQL and pg-mem have explicit known boot paths; PostgreSQL trigger/race evidence is not inferred from pg-mem.

## 6. Integration ownership and acceptance (all seams)

Task 4 owns the internal bridge, lot schema/primitives, normalized event/invariant branches, coherent read/recovery composition, and dormant lock tracing. Task 5 owns compatibility artifact/map admission, deterministic migration, epoch/fence, all live caller and selector conversion, and deployed backup integration. Task 8 owns scoped Phase 2 HTTP replay integration and safe lot-detail projections; no Tasks 4–5 test can claim that HTTP acceptance passed.

Task 5 updates `tools/backup.sh` and `tools/backup-selftest.sh` critical-table lists and linked restore fixtures. Include all six Task 3 registry tables, lots, normalized IO, existing guards/events/unique/custody, authority epochs, and migration receipts/parts, plus the existing legacy state families. Restore verifies hashes, totals, unique identity/state/custody/provenance, guard/result references, epoch and trigger enforcement; an omitted new critical table must fail the backup check. Bellini and estate non-interference remain explicit before/after fixtures.

Every new root test suite is wired immediately into `pretest` or its explicit PostgreSQL lane, with measured `SPEC.md`/`MARKETING-POSTS.md` census updates and gate/doc checks at each subtask. No test is counted as passed merely because PostgreSQL or restore tooling is unavailable. Each subtask needs the existing two independent reviews and controller verification before its scoped commit; design approval is not evidence that those implementation gates have passed.

| Preflight seam | Contract owner | Planned increment |
|---|---|---|
| 1 branding | Section 2 | 4.1 |
| 2 shared lock order | Section 4 | 4.1 dormant; 5.3 live convergence |
| 3 FIFO/item order | Section 3 | 4.2; 5.3 consumers |
| 4 operation custody | Section 1 | 5.1, 5.2 |
| 5 oversized stacks | Section 5 | 5.2 |
| 6 verified compatibility artifact | Section 1 | 5.1 |
| 7 intrinsic projection | Section 1 | 4.2, 5.1 |
| 8 HTTP/domain scope | Sections 2, 6 | 4.1 domain; Task 8 HTTP |
| 9 historical replay | Section 2 | 4.1, 5.3 |
| 10 result/ordinals | Sections 2, 3 | 4.1, 4.2 |
| 11 compensation/guards | Section 4 | 4.1, 4.2 |
| 12 coherent reads | Section 4 | 4.1, 5.3 |
| 13 direct consumers | Section 5 | 5.3 |
| 14 event state machines | Section 3 | 4.2, 5.2 |
| 15 epoch/boot | Sections 4, 5 | 5.2, 5.3 |
| 16 board identity | Section 5 | 5.3; Task 8 additive detail |

Implementation acceptance must validate selected Crew option A and targeted acceptance hooks, including the inferred rejoin/stale-role schedule. Review the operation-stack receipt-preservation rule against baseline-valid rows with no operation root; only actual invariant corruption stops publication. The fixed compatibility maximum bounds migration to 2,148 parts per source row while paging the source census. Permanent semantic receipts grow with successful mutations, deliberately avoiding archival failure modes in this phase.
