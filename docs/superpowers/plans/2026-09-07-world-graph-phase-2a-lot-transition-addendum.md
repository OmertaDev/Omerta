# Phase 2A Task 4.2 dormant exact transition implementation addendum

> **For agentic workers:** ADOPTED 2026-09-07. Use the already selected Superpowers Task 4.2 implementation workflow, with TDD and separate fresh implementation SPEC and QUALITY reviews. No implementation acceptance, scoped commit or live activation is implied. Steps use checkbox syntax.

**Goal:** Close the missing exact unique creation and authorized custody/owner transition paths while preserving every original Task 4.2 acceptance gate.

**Architecture:** Extend the existing private v2 root with exact single-use transition entries under a closed old/new authority union. Two dormant leaves share existing candidate admission, registry rereads, normalized writer, token, guard and ordinal. Phase 1 leaves and live consumers keep their existing signatures, events and replay semantics.

**Tech Stack:** Node.js ES modules, existing PostgreSQL/pg-mem adapters, immutable definition registry, item transaction gates, node:assert/strict, and the adopted test-local deterministic stateful generator.

**Spec:** [Dormant exact transition amendment](../specs/2026-09-07-world-graph-phase-2a-lot-transition-amendment.md), read in full with its exact linked governing amendments and [original Task 4.2](2026-09-04-world-graph-phase-2a-implementation.md#task-42-exact-lots-shared-lineage-and-branch-aware-invariants) and [lot-contract addendum](2026-09-07-world-graph-phase-2a-lot-contract-addendum.md).

## Global constraints and ownership

- One transaction, private mutation token, root guard and `nextItemMutationOrdinal`; no per-leaf guard or new capability.
- Keep the five existing lot signatures and split identity/custody preservation unchanged.
- Keep original v2 request_json and digests byte-compatible; never insert itemTransitions=[] for old-shaped input. Leave all v1 key/hash/replay rules unchanged.
- No Task 3 registry/table/hashdomain/definition-field changes, quality brand, public trust flag, callback resolver, or unrestricted effect dispatch.
- No production producer, migration/backfill/map, cutover/fence, Phase 1 caller conversion, HTTP endpoint, OMR/NFT flow, activation, deployment, or service.
- `src/items.js` owns closed authority union validation, exact stored root comparison, lifecycle and completion checks. Its legacy authority sets remain unchanged.
- `src/itemlots.js` owns the two new leaves, exact unique validation, transition predicate checks, candidate requirement consumption, normalized writers/parity and lot custody state.
- `schema.sql` owns nullable exact unique attachment branches, closed lot current custody/depositor state, and normalized immutable historical attachment/IO constraints. Existing live unique custody schema keeps its semantics.
- `src/invariants.js` owns new unique versus legacy versus migration branching, movement conservation and cross-kind parity.
- `test/lib/phase2-item-fixtures.js` owns snapshots and the frozen test-only issued-action producer. `test/phase2-lots.js`, `test/phase2-lots-property.js`, `test/phase2-lot-boundary.js`, and `test/phase2-postgres.js --lots` own the prescribed evidence. Existing wiring/census files remain in original Task 4.2 scope.
- The controller integrates the canonical spec/plan amendment on adoption. No slice is independently releasable. No scoped implementation commit before the full original gate, both independent implementation reviews and controller verification.

## Slice T1: Close root authority without changing historical replay

**Files:** `src/items.js`, `test/lib/phase2-item-fixtures.js`, `test/phase2-lot-boundary.js`.

**Consumes:** existing withLotMutation signature, OriginalLotAuthority and LotAuthority closed union, itemMutationContext, root/definition assertions.

**Produces:** frozen optional exact transition entries in the existing root state; original no-transition shape accepted verbatim; exactly-once transition completion tracking; `assertAndUseLotTransition(client, mutation, transitionIndex, transition): void` comparing the plan's detached entry to the real root and consuming its one use. No exported authority state reader.

- [ ] Add a boundary test that seeds a literal completed original v2 guard with known request_json/hash/result bytes, then invokes withLotMutation using the original shape after unrelated actor/definition/custody state changes. Assert no callback and exact result and guard bytes. Keep the literal fixture independent of the new serializer.
- [ ] Add explicit-[] versus absence conflict tests; matching new envelope replay; one-at-a-time changed subject/hash/owner/destination/depositor/operation/expected quality conflict; malformed/accessor/proxy/undefined/extra branch and over-bound array rejection with full unchanged snapshots.
- [ ] Run `node test/phase2-lot-boundary.js` to establish the missing extended-shape behavior while old replay remains green.
- [ ] Implement exact-key branching before the first await: choose the old nine-field set if itemTransitions is absent; otherwise require the ten-field extended set. Do not add, drop or regenerate the member during canonical serialization. Validate comparator ordering, duplicate subjects and whole-request bounds. Retain its detached value in existing root state with a private used-index set.
- [ ] Implement assertAndUseLotTransition to check exact root/client/token, canonical entry equality, index and unused status synchronously, then record that use without returning state. Enforce all declared entries consumed exactly once before guard completion. Keep the legacy empty destination/operation sets for v2 so the new shape cannot activate old leaf authority. Any mismatch poisons the existing root.
- [ ] Rerun the boundary suite. Evidence must include the literal old-shaped replay, not just a fresh guard serialized by current code.

## Slice T2: Create new exact uniques under the existing root

**Files:** `src/itemlots.js`, `schema.sql`, `test/lib/phase2-item-fixtures.js`, `test/phase2-lots.js`.

**Consumes:** `grantUnique(client, mutation, definition, output): Promise<UniqueProjection>`, exact UniqueOutput/UniqueProjection, unchanged definitionByHash and adopted quality validation table.

**Produces:** new exact unique creation attachment/event/output plus safe unique result. Existing legacy rows remain all-null exact attachment branches and untouched by the new leaf.

- [ ] Compile explicit non-stackable fixture definitions through existing fixture corpus/store paths. Add successful null-quality and non-null numeric-digest cases through `runTrustedDormantItemAction(fixture, {issuedActionId})`. The frozen issued action resolves its exact allowed output policy and direct owner; extra output-shaped client keys fail before mutation.
- [ ] Add concept/stackable/wrong-owner/wrong-pin/wrong-full-definition/quality-mode/malformed provenance and migration_origin rejection. Assert fresh item ID, one creation output, exact cap >=1, null condition/ineligible export, private provenance omitted, and mixed lot/unique output ordinals never collide.
- [ ] Run `node test/phase2-lots.js` to establish the absent unique creation path.
- [ ] Add all-null legacy versus all-present exact nullable unique attachment branches with immutable creation identity. Implement grantUnique using the existing v2 root-owner/output-pin assertion, exact intrinsic reread and quality representation checks. Register instance/attachment/event/IO inverses before every write and allocate only through the shared root ordinal.
- [ ] Add/extend fixture snapshots to exact unique attachment columns and all normalized tables. Run the focused suite and existing `node test/items.js` to verify legacy caller/result stability.

## Slice T3: Apply one pinned exact transition through complete candidates

**Files:** `src/itemlots.js`, `src/items.js`, `schema.sql`, `test/lib/phase2-item-fixtures.js`, `test/phase2-lots.js`, `test/phase2-lot-boundary.js`.

**Consumes:** exact ItemTransition five-branch union, amended UniqueExpected with digest, existing lot_exact/unique_exact requirements and withCompleteItemCandidates callback scope.

**Produces:** `applyItemTransition(client, mutation, transitionIndex): Promise<ItemTransitionResult>` and normalized movement/consumption rows. No new source/destination resolver.

- [ ] Add table-driven legal branches: direct unique consume; unique transfer with ordinary transferable definition; unique and whole-lot escrow/release; exact escrow unique consume and whole escrow lot consume. Successful roots must go through the trusted fixture action producer, not request.input forwarding or direct SQL mutation.
- [ ] Add forbidden branches: other actor's direct owner, arbitrary operation ID, wrong aggregate, unauthorized role/action, replacement depositor, unsupported/bound lot custody, partial quantity, nontransferable unique transfer, consumed subject, source pin substitution, negative/unsafe index, repeated entry, no transition array, entry omitted by callback and unplanned requirement reuse. Assert stable codes and complete rollback.
- [ ] Run the focused root/boundary suites to establish red behavior.
- [ ] Extend unique_exact.expected with required qualityStateDigest. For lot transition requirements, compare the exact lot ID/full remaining quantity and all pinned economic fields from the transition entry. Admit all source, pre-existing unique custody and destination authority keys before the first item lock; share the approved comparator.
- [ ] Implement the five explicit branches. Read the transition from the callback-scoped complete candidate plan's root, reread exact definition through definitionByHash, verify authority/owner/action/policy constraints, use precisely one complete requirement, and call assertAndUseLotTransition before CAS writes from the admitted snapshot. The seam verifies against real private root state without revealing it. A moved lot retains its physical ID/original quantity/source/creation identity.
- [ ] Use existing operation_escrow for unique current custody and lot in-row custody/depositor columns for lots. Live unique row/custody updates preserve FK ordering. Movement writes input/event/output at the same shared ordinal; consumption writes input/event without output. The pre-write authority use can reach guard completion only with a successful transition; any failure poisons the whole root.
- [ ] Prove split is validation-only separately: split direct and escrowed parents preserving depositor; then issue a new action for whole-child escrow/release. Same-root access to a newly created child through an undeclared transition must reject.
- [ ] Inject a different candidate/quantity/quality/depositor after admission and before lock reread; assert contention, no committed changes, and same-key complete-plan recomputation. Use opposite FIFO versus canonical ordering plus a unique between lot keys.
- [ ] Run the focused suites and preserve all original lot/FIFO/quality matrix cases.

## Slice T4: Prove historical IO, recovery, and exact replay

**Files:** `schema.sql`, `src/invariants.js`, `src/itemlots.js`, `test/phase2-lots.js`, `test/phase2-postgres.js`, fixture helpers.

**Consumes:** immutable creation attachments, transition input/output branch rules, shared completion parity and existing recovery classifications.

**Produces:** schema/invariant proof of closed legal state machines, movement versus creation conservation, and whole-root rollback without replay mutation.

- [ ] Test grant -> escrow -> split -> release -> consume across separate roots. Earlier creation, split and movement references must stay valid after current owner/custody/quantity changes. Assert one creation count and exact quantity conservation; movement outputs are never counted as minting.
- [ ] Test unique creation -> escrow -> release -> transfer -> consume, replaying each completed root after final consumption. Assert byte-equivalent results/IDs/ordinals and no mutation callback. Test dead original depositor release explicitly; no replacement character receives the item.
- [ ] Add direct SQL corruption cases for missing/wrong attachment, same-root/event/ordinal mismatch, partial branch nulls, cross-kind output duplicates, bad custody/depositor shape and invalid quantity. PostgreSQL cases name the exact constraint and assert 23503, 23505 or 23514 as applicable. Direct SQL orphan fixtures must fail invariant collection; suppressed required leaf IO must prevent root completion.
- [ ] Add a migration_origin invariant observation fixture for already-consumed legacy unique history without invoking a new grant/transition. Verify it counts as observation only. This is schema/invariant coverage, never claimed migration implementation or authorized transition evidence.
- [ ] Inject before/after acknowledgement failures at current row, current custody, event, input, output and guard completion writes, including after an earlier successful mixed lot/unique leaf and external cash/car mutation. Full snapshots must match after pg-mem compensation, and same-key retry must execute exactly once.
- [ ] Assert PostgreSQL rollback executes zero compensation SQL. Preserve item_commit_unknown and item_recovery_required disposition and poisoned-gate tests. Do not rewrite completed pre-existing guards during rollback.
- [ ] Run `node test/phase2-lots.js`, `node test/phase2-lot-boundary.js`, `node test/phase2-postgres.js --lots` on actual configured backends. Record server version and every skip honestly.

## Slice T5: Integrate the unchanged full acceptance

**Files:** original Task 4.2 file set; `test/phase2-lots-property.js`, actual root suite wiring/census.

**Consumes:** all preceding transition evidence and every original adopted Task 4.2 requirement.

**Produces:** one complete dormant Task 4.2 candidate ready for the two original independent reviews and controller verification.

- [ ] Extend the deterministic state model to at least 100 seeds × 250 actions each. The generator must actually reach successful grant/consume/split/escrow/release and unique owner/state transitions, plus deliberate errors/retries; count branch coverage so a run cannot pass by generating only forbidden/no-op transitions. At each action assert per-hash/per-quality conservation, nonnegative quantities, one current custody state, retained physical lineage, guard/event/IO parity and cross-kind output uniqueness. Include bounded seed/action diagnostics.
- [ ] Wire both root suites immediately and measure actual census changes using original SPEC.md/MARKETING-POSTS.md ownership. Preserve original tests and bounds; the amendment cannot rename away a missing behavior.
- [ ] Run the exact original gate: `node test/phase2-lots.js`, `node test/phase2-lots-property.js`, `node test/phase2-lot-boundary.js`, `node test/items.js`, `node test/crafting.js`, `node test/worldgraph.js`, `node test/mysteries.js`, `node test/operations.js`, `npm run invariants`, `node test/gates.js`, `node test/docs.js`, `node test/phase2-postgres.js --lots`, and `npm test`.
- [ ] Record actual PostgreSQL version and any CI-only runtime difference; unavailable/skipped is not passed. Report no live producer, legacy cutover, HTTP or activation acceptance.
- [ ] Self-review exact names/types, the old/new closed authority union, null-digest unique fixture handling, authority derivation and all original acceptance mappings. Stop on an unadopted normative conflict rather than inventing an authority field or transition.
- [ ] Obtain both independent implementation reviews and controller verification before any original scoped Task 4.2 commit. Design adoption establishes no passing implementation evidence and does not authorize a scoped commit or live activation before their required gates.

## Design review and adoption

The draft preserves original v2 bytes by member-presence branching, retains v1 semantics, confines new unique state to exact attachments, and makes every formerly missing authority extension explicit. New unique numeric quality necessitates the declared unique candidate digest addition. Whole-lot moves and recorded-only custody avoid general lot transfer/project inventory semantics.

The controller adopted the explicit changes after fresh independent spec review. Normalized input alone remains insufficient transition authority. This is design acceptance only; no passing implementation evidence is implied.

## Additional explicit acceptance checks

- [ ] Test the exhausted projection/schema branch with last owner retained and
  live custody/depositor cleared, including whole escrow consumption and a split
  exhausting the parent. Preserve old depositor in history and child custody.
- [ ] Show the trusted exact operation-owner root and authenticated actor checks
  for escrowed splits; no character-owner substitution, general operation grant,
  or use of a transition entry as split authority.
- [ ] Replay through the closed issued-action producer after consumption, death,
  role changes and action-revision changes; prove fresh permission derivation is
  skipped by completed replay, alongside the independent literal receipt test.
