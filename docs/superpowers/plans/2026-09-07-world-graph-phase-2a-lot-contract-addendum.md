# Phase 2A Task 4.2 lot contract addendum implementation plan

> **For agentic workers:** ADOPTED 2026-09-07. Task 4.2 is reopened for implementation; no implementation acceptance is claimed. REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Amend the existing Task 4.2 implementation plan with exact quality representation, trusted-producer derivation, and the already-resolved candidate/split/FK/error details without changing Task 4.2's full acceptance gate.

**Architecture:** `src/itemlots.js` validates exact detached quality representation and consumes a private complete candidate plan under the existing item root. A dormant test producer derives quality from frozen server-owned fixture policy; future live producers own formula/bounds and client-forwarding rejection. Historical normalized rows reference immutable attachment/event identity, while mutable current owner/custody/state are captured in transition snapshots rather than historical FKs.

**Tech Stack:** Node.js ES modules, pg-mem, PostgreSQL, the existing item/definition transaction gates, `node:assert/strict`, and a test-local deterministic stateful generator in the repository-native assertion harness. There is no reusable standalone property-test framework; introduce no dependency and do not import executable simulation entry points merely to obtain their random generator.

**Spec:** [Task 4.2 lot contract amendment](../specs/2026-09-07-world-graph-phase-2a-lot-contract-amendment.md), read
with the tracked
`docs/superpowers/specs/2026-09-07-world-graph-phase-2a-lot-integration-amendment.md`,
the tracked
`docs/superpowers/specs/2026-09-07-world-graph-phase-2a-definition-registry-amendment.md`,
and the Task 4.2 section of the tracked
`docs/superpowers/plans/2026-09-04-world-graph-phase-2a-implementation.md`.

## Global constraints

The [exact transition addendum](2026-09-07-world-graph-phase-2a-lot-transition-addendum.md) supplies the additional mandatory dormant unique/custody slices and their adopted contract. Execute them within this same Task 4.2 deliverable, not as a separate release.

- This is an addendum, not a replacement plan. Every existing Task 4.2 test,
  implementation, regression, PostgreSQL, review, and controller-verification
  requirement remains mandatory.
- No slice below is independently releasable or sufficient to complete Task
  4.2. Slices only stage one final dormant Task 4.2 deliverable.
- Keep one item transaction/token/root/guard/ordinal allocator and the frozen
  lot signatures. Add no registry field/hash, policy registry, certificate,
  quality brand, public trust flag, returned plan token, or second counter.
- Preserve legacy labels exactly. Keep `definitionByHash(...)` as the only
  exact intrinsic reread and never invent `definition.bundleHash`.
- Task 4.2 introduces no live producer, compatibility cutover, HTTP acceptance,
  OMR/NFT behavior, or activation.
- PostgreSQL performs zero compensation SQL. A skipped PostgreSQL lane is not a
  pass.
- Do not create the scoped commit until the entire original Task 4.2 acceptance
  matrix, both independent reviews, and controller verification pass.

## Amendment file map

This addendum changes no ownership from the existing Task 4.2 plan. Its specific
touch points are:

- `src/itemlots.js`: private quality validator, complete-candidate helper,
  normalized writer/parity check, and the frozen lot leaves.
- `src/items.js`: assertion-only candidate-root bridge and the one shared item
  comparator/context/ordinal/poison seams.
- `src/item-lock-trace.js`: expose its existing unchanged comparator as
  `compareItemLockEntries` for both trace assertions and candidate acquisition;
  no second comparator or mutation authority is introduced.
- `schema.sql`: scalar/branch constraints and immediate acyclic normalized FKs.
- `src/invariants.js`: orphan/parity and exact per-quality reconciliation.
- `test/lib/phase2-item-fixtures.js`: complete snapshots and closed dormant
  producer policy/input helper.
- `test/phase2-lots.js`, `test/phase2-lots-property.js`,
  `test/phase2-lot-boundary.js`, `test/phase2-postgres.js --lots`: amendment
  tests inside the full existing Task 4.2 matrix.
- Existing wiring/census files remain owned exactly as stated in the Task 4.2
  brief.

---

### Addendum Slice A: Pin exact representation before implementation

**Files:**

- Test: `test/phase2-lots.js`
- Modify: `src/itemlots.js`

**Interfaces:**

- Consumes: exact `ItemDefinition` from `definitionByHash` and the frozen
  `LotOutput`/`LotSelector` quality fields.
- Produces: private
  `validateLotQuality(definition, {qualityBand, qualityStateDigest})` returning
  one detached frozen exact tuple or throwing `bad_item_request`.

- [ ] **Step 1: Write the complete red mode table.**

```js
const accepted = [
  ['none', null, null],
  ['fixed', 'standard', null],
  ['fixed', null, 'a'.repeat(64)],
  ['fixed', 'Pristine Ω', 'b'.repeat(64)],
  ['inherited', null, null],
  ['inherited', 'standard', null],
  ['inherited', null, 'c'.repeat(64)],
  ['inherited', 'pristine', 'd'.repeat(64)],
  ['bounded', 'categorical', null],
  ['bounded', null, 'e'.repeat(64)],
  ['bounded', 'fine', 'f'.repeat(64)],
];

const rejected = [
  ['none', 'standard', null],
  ['none', null, '0'.repeat(64)],
  ['fixed', null, null],
  ['bounded', null, null],
];
```

Also reject missing/extra/undefined/accessor/proxy keys, invalid scalar types,
empty/padded/81-character bands, and uppercase/short/long/nonhex digests. Accept
1- and 80-character bands, mixed case, Unicode, and distinct
`standard`/`pristine`. Assert `bad_item_request` and an unchanged full snapshot
for every rejection.

- [ ] **Step 2: Run focused tests red.**

Run: `node test/phase2-lots.js`

Expected: FAIL because the exact validator/grant integration does not exist.

- [ ] **Step 3: Implement the minimal private validator.**

The caller first validates/detaches the complete `LotOutput` or `LotSelector`,
then constructs the exact two-key quality projection. The helper below validates
only that projection; it does not reject or discard the other full identity
fields.

```js
function validateLotQuality(definition, input) {
  const tuple = detachExactDataObject(input, [
    'qualityBand', 'qualityStateDigest',
  ]);
  const qualityBand = tuple.qualityBand === null
    ? null
    : boundedText(tuple.qualityBand, 80);
  const qualityStateDigest = tuple.qualityStateDigest === null
    ? null
    : lowerHex(tuple.qualityStateDigest, 64);
  const any = qualityBand !== null || qualityStateDigest !== null;
  if (definition.qualityMode === 'none' && any) badItemRequest();
  else if ((definition.qualityMode === 'fixed' ||
            definition.qualityMode === 'bounded') && !any) badItemRequest();
  else if (!['none', 'fixed', 'inherited', 'bounded']
      .includes(definition.qualityMode)) badItemRequest();
  return Object.freeze({qualityBand, qualityStateDigest});
}
```

Use the repository's actual bounded-text/error helpers when their behavior
matches exactly. Snapshot before awaits. Do not export the helper as authority.

- [ ] **Step 4: Integrate after the exact immutable definition reread.**

Compare the complete caller definition projection with
`definitionByHash(client, definitionHash)`; require economic kind,
`stackable === true`, owner scope, exact cap, and
`tradePolicyHash === definitionHash`; then validate the mode tuple. Do not read
or synthesize `bundleHash`.

- [ ] **Step 5: Run the focused matrix green.**

Run: `node test/phase2-lots.js`

Expected: PASS. Evidence wording says “representation accepted/rejected,” not
“numeric formula/bounds verified.”

### Addendum Slice B: Prove trusted derivation and reject forwarding

**Files:**

- Modify: `test/lib/phase2-item-fixtures.js`
- Test: `test/phase2-lots.js`

**Interfaces:**

- Consumes: the existing `withLotMutation` fixture and private lot grant.
- Produces: test-only
  `runTrustedDormantLotGrant(context, {policyId, quantity})`; it is not a
  production export or registry.

- [ ] **Step 1: Write red tests for closed producer input.**

Define frozen fixture policies server-side, including fixed band-only, bounded
categorical band-only, and bounded numeric band+digest cases. Submit an otherwise
valid action containing `qualityBand`, `qualityStateDigest`, or `quality` and
assert the fixture's exact-key input validator returns `bad_item_request` before
any lot/event/IO/successful guard write.

- [ ] **Step 2: Implement the dormant fixture producer.**

```js
export async function runTrustedDormantLotGrant(ctx, rawInput) {
  const input = exactDataObject(rawInput, ['policyId', 'quantity']);
  const policy = fixturePolicies.get(input.policyId);
  if (!policy) badItemRequest();
  if (policy.numericStatePresent &&
      policy.output.qualityStateDigest === null) badItemRequest();
  const definition = await definitionByHash(ctx.client, policy.definitionHash);
  return grantLot(ctx.client, ctx.mutation, definition, {
    ...serverOwnedLotIdentity(ctx, definition),
    quantity: input.quantity,
    ...policy.output,
  });
}
```

Keep policy storage and identity construction in the test fixture. A malformed
numeric fixture with null digest must fail before grant. A categorical bounded
band-only fixture must pass.

- [ ] **Step 3: Prove the mutation token is not treated as quality proof.**

Keep raw/fake/cross-client/expired/registry token tests from the existing Task
4.2 boundary matrix. Add an assertion/report check that a direct internal grant
with a well-shaped tuple is classified only as storage coverage; the trusted
producer case must pass through `runTrustedDormantLotGrant` and equal its frozen
server result.

- [ ] **Step 4: Run the focused composition tests.**

Run: `node test/phase2-lots.js`

Expected: PASS; client quality does not reach the grant argument, stored row,
event, or replay.

- [ ] **Step 5: Add the future live-producer gate to Task 4.2 evidence.**

Record, without claiming execution, that every future live producer must test
closed request rejection/non-forwarding, exact locked server derivation, numeric
bounds and digest commitment when applicable, drift-to-`contention`, and
replay/no-reroll behavior. Do not invent the later route's stable error code or
formula in Task 4.2.

### Addendum Slice C: Lock the resolved candidate/split/FK/error details

**Files:**

- Modify: `src/itemlots.js`
- Modify: `src/items.js`
- Modify: `schema.sql`
- Modify: `src/invariants.js`
- Test: `test/phase2-lots.js`
- Test: `test/phase2-lot-boundary.js`
- Test: `test/phase2-postgres.js`

**Interfaces:**

- Consumes: the exact `LotCandidateRoot`, `ItemCandidateRequirement`,
  `ItemOwner`, `CustodyIdentity`, `LotOutput`, and `LotSelector` shapes declared
  in the companion contract amendment, plus Task 4.1's private root, comparator,
  context, ordinal, poison, and recovery seams.
- Produces: assertion-only `assertLotCandidateRoot`, private
  `withCompleteItemCandidates`, validation-only split custody, and immediate
  acyclic normalized attachments with root parity.

- [ ] **Step 1: Pin callback-scoped candidate behavior red.**

Test byte-exact v2 root comparison; one complete requirement multiset admitted
before the first item lock; canonical custody/lot/unique lock order distinct
from `(created_at, lot_id)` FIFO; exactly-once requirement use; `finally`
closure; and `contention` for drift, unplanned leaves, or a needed unadmitted
candidate. Prove no returned token, second guard, or counter exists.

- [ ] **Step 2: Pin split and closed identity behavior red.**

Test split custody as an exact expected predicate, immutable child identity
preservation, new creation timestamp/output ordinal, and earlier debit-input
link. Test 1/128/129-byte opaque tokens, provenance enum/digest, ordinary
`migration_origin` refusal, and one-dimension aggregation separation. Keep
quality labels on their distinct legacy-compatible grammar.

- [ ] **Step 3: Pin immutable historical attachment FKs red on both backends.**

Direct SQL must reject a present output with missing/wrong immutable attachment,
event, branch, root/hash/ordinal/original-quantity tuple, partial nullable branch,
duplicate cross-kind ordinal, or invalid split-source relation. Then perform a
legal later escrow/release/transfer/current-quantity change and prove historical
creation/transition references remain valid because they do not FK to current
owner, custody, state, or remaining quantity.

PostgreSQL cases assert the actual named constraint and SQLSTATE `23503`,
`23505`, or `23514`. A skipped server is unverified.

- [ ] **Step 4: Implement the already-resolved seams minimally.**

Implement the assertion-only root bridge and callback-scoped private plan exactly
as declared in the companion contract amendment. Use one normalized writer whose
event/input/output ordinal comes only from `nextItemMutationOrdinal`. Make
outputs point to immutable attachment identity; put transition before/after
owner/custody/state in immutable IO/event snapshots, not in FKs to future
current state.

- [ ] **Step 5: Add root completion and invariant parity.**

Before guard completion, require exact one-to-one attachment/event/IO parity.
Inject missing output and direct-SQL orphan states; the former fails the root,
the latter fails invariant collection. This explicitly documents that immediate
acyclic FKs validate present references while the root/invariants enforce reverse
completeness.

- [ ] **Step 6: Lock deterministic errors and rollback.**

Assert unchanged shortage `materials`, initial unavailability
`item_unavailable`, invalid quantity `qty`, malformed/substituted request
`bad_item_request`, exact absent definition `definition_not_found`, and
post-admission/CAS drift `contention`. Exact requests never fall back. Reuse the
existing integrity/commit/recovery classifications and full rollback snapshots;
PostgreSQL executes zero compensation.

- [ ] **Step 7: Run focused amendment checks.**

```bash
node test/phase2-lots.js
node test/phase2-lot-boundary.js
node test/phase2-postgres.js --lots
```

Expected: PASS on the actual configured backends. This finishes only the
addendum checks, not Task 4.2.

### Addendum Slice D: Execute the unchanged full Task 4.2 gate

**Files:** All files already listed in the tracked Task 4.2 plan section.

**Interfaces:**

- Consumes: Slices A–C and every original Task 4.2 requirement.
- Produces: one complete dormant Task 4.2 candidate for independent review and
  controller verification.

- [ ] **Step 1: Re-run the full existing deterministic lot matrix.**

Complete every original admission, one-dimension identity, FIFO-versus-lock,
multi-requirement, lineage, unique transition, rollback/replay, conservation,
legacy branch, coherent-read, and invariant case. The addendum may not delete,
weaken, rename away, or substitute for one of those cases.

- [ ] **Step 2: Run the unchanged stateful minimum.**

Run: `node test/phase2-lots-property.js`

Expected: PASS for at least 100 deterministic seeds and 250 grant/consume/split/
authorized escrow/release/failure/retry steps per seed, with bounded seed/action
failure output and all original invariants after every action.

- [ ] **Step 3: Run the full regression, invariant, gate/doc, and real PostgreSQL surface from the original plan.**

```bash
node test/phase2-lots.js
node test/phase2-lots-property.js
node test/phase2-lot-boundary.js
node test/items.js
node test/crafting.js
node test/worldgraph.js
node test/mysteries.js
node test/operations.js
npm run invariants
node test/gates.js
node test/docs.js
node test/phase2-postgres.js --lots
npm test
```

Expected: every command passes, both new root suites are actually wired into the
measured repository surface, and the real PostgreSQL output records its server
version. Report any CI-only runtime difference truthfully; an unavailable or
skipped PostgreSQL lane does not pass.

- [ ] **Step 4: Self-review this addendum against the adopted contract.**

Map every amended clause to a test and implementation point, scan for
placeholders, and verify exact type/function/property naming. A real normative
conflict stops execution for controller adjudication; do not add authority to
work around it.

- [ ] **Step 5: Obtain both independent reviews and controller verification before the scoped commit.**

Evidence must state the narrow claim: dormant storage, identity, preservation,
and trusted-call composition passed. It must not claim a live numeric producer,
legacy cutover, HTTP acceptance, or activation.

## Contradiction stop condition

No binding contradiction was found during drafting. The older differing quality
table was unapproved; the adopted newer mode table is therefore an amendment,
not a silent normative override.

Stop if a binding source requires primitive numeric reconstruction, band-only
fixed state, digest-bearing categorical bounded state, SQL-only bidirectional
attachment participation, or custody change through split. Do not invent a
registry field, hidden metadata, brand, default label, trigger protocol, or
broader transition authority.
