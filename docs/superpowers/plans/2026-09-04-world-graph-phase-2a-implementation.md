# World Graph Phase 2A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the canonical declarative content-corpus, immutable item definitions, lot-authoritative inventory, purposeful starter material catalog, and transactional condition-aware vehicle salvage required by Phase 2A.

**Architecture:** Extend the existing authored-content plane with deterministic corpus discovery, framed hash domains, a package-qualified intermediate representation, and one complete validation entry point shared by tooling and activation. Preserve Phase 1 APIs through a lot-backed compatibility adapter, keep Bellini inventory inert and isolated, and move every new value mutation through the existing branded transaction boundary with account/action-scoped transport keys and a transaction-local domain guard.

**Tech Stack:** Node.js 20+ ESM, Fastify 5, PostgreSQL 14+, pg 8, pg-mem 3, JSON authored packages, `node:assert/strict`, repository-native script tests.

**Spec:** `docs/superpowers/specs/2026-09-04-world-graph-phase-2a-materials-salvage-design.md` (with `docs/superpowers/specs/2026-09-04-world-graph-phases-2-3-cross-cutting-design.md` and the program design as higher-order constraints)

## Global Constraints

- Authored packages are data only; reject JavaScript, SQL, shell commands, arbitrary templates/expressions, network mutation inputs, prototype-polluting keys, and unknown adapters.
- CLI, CI, build, activation, and release preflight must call the same complete corpus discovery and validation entry point.
- Canonical output uses package-qualified logical IDs, stable ordering, exact dependency locks, and the seven non-self-referential framed SHA-256 domains defined by the cross-cutting spec.
- Raw JSON is decoded by one duplicate-aware tokenizer/parser that rejects duplicate member names at every depth before object materialization; a `JSON.parse` reviver is not an acceptable substitute.
- `collection_log` remains a status/completion ledger and is never inventory authority.
- `item_lots` plus `item_instances` become the only generic item authority after a fenced, reconciled cutover; Bellini `content_inventory_lots` remain isolated and gameplay-inert.
- Every value mutation runs in one branded database transaction and stores its domain guard, normalized inputs/outputs, assets, events, and replay result atomically.
- External `Idempotency-Key` text is scoped by authenticated account and action kind; changed normalized input in the same scope conflicts, while another account or action kind is independent.
- Lots never physically coalesce; aggregate reads group only identical economic dimensions and consumption is canonical FIFO unless a server-issued action binds an exact lot.
- Vehicle salvage consumes one eligible owned car and produces all lots/events, or does neither; database uniqueness—not HTTP replay alone—prevents a second completed salvage.
- Definition registration is monotonic and immutable. The active bundle pointer may select a previously stored, fully validated older bundle for operational rollback; every activation appends a complete audit event, and already-started state stays pinned.
- OMR movement is absolutely forbidden; no cash source is introduced; normal inventory remains off-chain; no NFT transition or contract is added.
- PostgreSQL is authoritative. pg-mem compensation must expose equivalent atomic results without replacing required real-PostgreSQL race tests.
- Algorithms are iterative and bounded and must validate a synthetic graph of at least 10,000 nodes without recursion on authored depth.
- Preserve Phase 1 world-graph, crafting, mystery, operation, Belladonna, content-runtime, and Bellini compatibility behavior.
- Every task is implemented without a final task commit, reviewed first by a fresh spec-compliance reviewer and then by a different fresh code-quality/security/PostgreSQL reviewer, fixed and re-reviewed as needed, independently verified by the integration agent, and committed only when no Critical or Important finding remains.
- Do not merge, push, deploy, activate a production bundle, activate seasonal OMR, or deploy NFT contracts.

## File Structure

- `src/content/discovery.js`: deterministic public package walker and fixture-root classification.
- `src/content/json-source.js`: bounded duplicate-aware JSON tokenizer/parser and dangerous-key rejection before ordinary object materialization.
- `src/content/canonical.js`: canonical JSON bytes, typed/length-framed hashing, package qualification, and hash-domain constants.
- `src/content/economy-profile.js`: Phase 2 economy source schema, IR normalization, capability closure, OMR/executable scans, and report input extraction.
- `src/content/corpus.js`: the sole Phase 2 corpus compile/validate/build/activation entry point and exact dependency resolver.
- `src/content/activation-policy.js`: trusted server-startup environment/profile allowlist used by activation; authored packages and activation requests cannot override it.
- `src/content/compiler.js`: retains legacy `compileContentPack` while delegating Phase 2 profiles to the corpus modules.
- `src/itemdefinitions.js`: immutable definition persistence and active-definition lookup.
- `src/itemlots.js`: lot grant, FIFO/exact consumption, custody-safe projection, split lineage, normalized IO, and Phase 2 replay helpers.
- `src/itemmigration.js`: deterministic Phase 1 stack/unique backfill, verification digests, authority epoch, and cutover fence.
- `src/item-lock-trace.js`: test-only monotonic lock-class/subrow ordering trace shared by request handlers and mutation adapters.
- `src/materials.js`: safe material catalog projection and compiler-report adapter.
- `src/salvage.js`: compiled-profile lookup, server-derived deterministic yields, car eligibility, exactly-once mutation, and rollback compensation.
- `src/routes/worldgraph-phase2.js`: additive materials/salvage/lot-detail APIs with opaque server-issued actions.
- `content/packs/phase2-core-materials/pack.json`: purposeful 45–60 definition material library with declared sources, uses, sinks, policies, and quality rules.
- `content/packs/phase2-vehicle-salvage/pack.json`: model/class/condition salvage profiles importing the exact material library.
- `content/compatibility/phase1-item-definitions.json`: source-controlled immutable mapping for every Phase 1 stack and unique template.
- `tools/phase2-content.js`: corpus check/build/report command used by scripts and preflight.
- `tools/phase2-economy-sim.js`: deterministic source/sink and salvage accumulation simulation.
- `test/fixtures/phase2/`: valid and adversarial corpus roots plus the iterative 10,000-node generated fixture helper.
- `test/phase2-{discovery,compiler,definitions,lots,migration,materials,salvage,api,postgres,simulation}.js`: focused behavior contracts.
- `docs/superpowers/reports/phase2a-economy-pre-tuning.json` and `docs/superpowers/reports/phase2a-economy-final.json`: deterministic retained simulation evidence with exact commit/corpus/lock inputs.
- `schema.sql`, `src/items.js`, `src/routes/worldgraph.js`, `src/server.js`, `src/agentgateway.js`, `src/invariants.js`, `tools/preflight.js`, `package.json`, `content/README.md`, and discovery docs: integration seams only.

---

## Phase 2A Quantitative Budgets

These thresholds are fixed before authored quantity tuning. A threshold change after the first pre-tuning report requires a reviewed plan/spec amendment.

- Active material definitions with a reachable source, concrete use, and sink or bounded durable use: exactly 100%; production orphan/error count: 0.
- Classified cash adapters: exactly 100%; Phase 2A gross cash emission and net cash delta: exactly $0; OMR balance and ledger delta: exactly 0.
- In the normal 180-day scenario, aggregate renewable stock per active account over days 151–180 must grow by no more than 10% relative to days 121–150; no individual renewable family may exceed 15%.
- In the salvage-abundant sensitivity scenario, the same late-horizon aggregate growth must be no more than 25%, and every excess over the normal budget must be attributable to an explicit finite source cap.
- One source may supply at most 55% of total modeled acquisition demand and at most 70% inside one material family; a bounded one-source rare collectible is allowed only when its definition/report names that exception.
- Rare/specialty salvage outputs may occur in at most 1.5% of eligible salvages, and no simulated source may exceed its compiled epoch cap.
- Critical material-chain blocked rate is exactly 0% for every 100-, 1,000-, and 10,000-actor normal scenario.
- Transaction contention/retry rate for ordinary disjoint salvage is at most 1%; the deliberate same-car 50-attempt race is reported separately and must commit exactly one winner with 49 clean non-mutating outcomes.
- Each 10,000-node compiler fixture completes in at most 30 seconds with `--max-old-space-size=768`; each deterministic report is at most 8 MiB and two consecutive hashes are identical.
- Phase 2A has no professions, Masterwork production, facilities, markets, projects, supply-shock logistics, or repair. Those cross-cutting metrics are reported as `not_applicable_phase2a` here and receive fixed quantitative budgets in their owning Phase 2B–2E plans before their catalog tuning.

## Phase 2A Compiler Input Budgets

These versioned server-owned limits cannot be raised by authored data. The production profile permits at most 2,048 discovered packages, 128 files and 1 MiB of authored bytes per package, 64 MiB total corpus source bytes, JSON nesting depth 64, 64 KiB per decoded string, 20,000 nodes and 100,000 edges per bundle, 256 references per node, 256 vertices in an exact-analysis strongly connected component, 128 identifiers in one diagnostic witness, and 8 MiB per emitted report. The synthetic scale fixture profile changes only node/edge limits to 10,000/100,000 and remains server-assigned and non-activatable. Byte, depth, string, collection, node, edge, reference, component, and witness limits are checked before their corresponding expensive allocation or traversal.

## Design Rulings

- **Ruling: immutable definition registration is monotonic, but activation is an audited pointer and may explicitly select an older stored valid bundle for operational rollback.** The higher-order cross-cutting continuation/rollback contract controls the Phase 2A sentence about monotonic activation versions. Existing/in-flight state remains pinned, and an append-only event records every rollback activation. If this ruling is wrong, new work could run an older economy definition when the intended policy was forward-only; the complete event history and exact pins make that choice visible and reversible by another activation.

## Per-Task Review and Commit Gate

For every Task 0–9, the implementer stops with a tested working-tree diff and a TDD report but no final task commit. The integration agent then:

1. packages the complete working-tree diff from the recorded base;
2. dispatches a fresh spec-compliance reviewer;
3. sends every compliance finding back to the implementer and obtains a scoped re-review;
4. dispatches a different fresh code-quality/security/PostgreSQL reviewer;
5. sends every Critical or Important finding back to the implementer and obtains a scoped re-review;
6. inspects the final diff and runs the task's named focused/regression evidence;
7. commits exactly the task files with the message shown in that task.

Minor findings are fixed when low-risk or recorded in the SDD ledger for the whole-phase reviewer. No later task begins while an unreviewed or unresolved Critical/Important finding remains.

### Task 0: Make the Phase 1 lock-order tripwire portable across LF and CRLF

**Files:**
- Modify: `test/worldgraph-api.js:54-64`

**Interfaces:**
- Consumes: `src/routes/worldgraph.js` named function declarations.
- Produces: test-local `extractNamedFunction(source, declaration)` that returns the complete top-level function text for either LF or CRLF and returns `''` after a structural deletion.

- [ ] **Step 1: Write the failing portability test**

First make the existing LF-only matcher exercise an explicit CRLF copy as well as an LF copy. This is the regression assertion and must fail before the matcher is repaired.

```js
const lfSource = worldGraphRouteSource.replace(/\r\n/g, '\n');
const crlfSource = lfSource.replace(/\n/g, '\r\n');
for (const source of [lfSource, crlfSource]) {
  const assignment = source.match(
    /export async function assignItemToCurrentCharacter\([\s\S]*?\n}\n/,
  )?.[0] || '';
  assert.match(assignment, /withItemMutation\(/);
}
```

- [ ] **Step 2: Run the red case**

Run: `node test/worldgraph-api.js`

Expected: FAIL at `world-graph custody helpers remain statically auditable` on the Windows checkout because the old `\n}\n` matcher does not accept CRLF.

- [ ] **Step 3: Replace the LF-only matchers with the tested extractor**

Introduce the test-local extractor below, use it for both protected functions and both newline fixtures, then add the structural-deletion assertion. Do not modify `src/routes/worldgraph.js`, weaken the ordering assertions, or turn the check into a source-text existence test.

```js
const extractNamedFunction = (source, declaration) => source.match(
  new RegExp(`${declaration}\\([\\s\\S]*?\\r?\\n}\\r?\\n`),
)?.[0] || '';
for (const source of [lfSource, crlfSource]) {
  assert.match(extractNamedFunction(source,
    'export async function assignItemToCurrentCharacter'), /withItemMutation\(/);
}
assert.equal(extractNamedFunction(
  crlfSource.replace(
    'export async function assignItemToCurrentCharacter',
    'export async function removedAssignmentHelper',
  ),
  'export async function assignItemToCurrentCharacter',
), '');
```

- [ ] **Step 4: Verify green and regressions**

Run: `node test/worldgraph-api.js && node test/worldgraph-validation.js && node test/items.js && node test/crafting.js`

Then run the complete Windows-worktree baseline: `npm test`

Expected: all four focused scripts and the complete baseline exit 0; the renamed-function mutation assertion still proves the extractor can fail. Record both the observed pre-fix CRLF failure and the post-fix full-suite result in the task report before any Phase 2A feature task begins.

- [ ] **Step 5: Pass both independent review gates, reverify, and commit**

```bash
git add test/worldgraph-api.js
git commit -m "test: make worldgraph audit portable"
```

### Task 1: Discover the complete authored corpus deterministically

**Files:**
- Create: `src/content/json-source.js`
- Create: `src/content/discovery.js`
- Create: `test/phase2-discovery.js`
- Create: `test/fixtures/phase2/discovery/valid-library/pack.json`
- Create: `test/fixtures/phase2/discovery/valid-experience/pack.json`
- Create: `test/fixtures/phase2/discovery/fixtures/adversarial/pack.json`
- Modify: `tools/content.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: filesystem root supplied by trusted server/tool code, never authored data.
- Produces: `parseAuthoredJson(bytes, limits): unknown`, which tokenizes JSON, tracks member names per object before materialization, rejects dangerous/duplicate keys at every depth, and enforces server-owned byte/depth/string/container limits.
- Produces: `discoverContentPackages({ rootDir, fixtureRoots = [] }): Array<{ manifestPath, packageDir, source, authorityProfile }>`; results are sorted by normalized root-relative POSIX path. `authorityProfile` is `'production'` or `'fixture'` and is assigned by the walker.

- [ ] **Step 1: Write discovery red tests**

Use temporary copies of the fixture root and literal expected paths. Cover canonical ordering, nested-package shadowing, duplicate package IDs across directories, case-normalization collisions, malformed JSON, root and nested duplicate member names (including duplicate profile, adapter, and identity), unsupported extension, bounded file bytes, nesting depth, string bytes, object/array member counts, symlink escape where supported, authored attempts to set fixture authority, and a newly copied production package being found without a script edit.

```js
const found = discoverContentPackages({
  rootDir: fixtureRoot,
  fixtureRoots: [path.join(fixtureRoot, 'fixtures')],
});
assert.deepEqual(found.map(({ manifestPath, authorityProfile }) => ({
  manifestPath: path.relative(fixtureRoot, manifestPath).replaceAll('\\', '/'),
  authorityProfile,
})), [
  { manifestPath: 'fixtures/adversarial/pack.json', authorityProfile: 'fixture' },
  { manifestPath: 'valid-experience/pack.json', authorityProfile: 'production' },
  { manifestPath: 'valid-library/pack.json', authorityProfile: 'production' },
]);
```

- [ ] **Step 2: Verify discovery tests fail because the module is absent**

Run: `node test/phase2-discovery.js`

Expected: module-not-found for `src/content/discovery.js`.

- [ ] **Step 3: Implement the bounded deterministic walker**

Implement a small JSON tokenizer/parser in `json-source.js`; it must reject a repeated decoded member name before assigning that member and reject `__proto__`, `prototype`, and `constructor` before returning an ordinary object. Use `fs.realpathSync`, `fs.readdirSync(..., { withFileTypes: true })`, explicit server-owned limits, and canonical path sorting. Never use a `JSON.parse` reviver as the duplicate-key boundary and never follow a symbolic link outside `rootDir`.

- [ ] **Step 4: Replace the hand-maintained content check script**

Add `content:check:corpus` as `node tools/content.js check-corpus content/packs`; retain current single-pack `check`/`build` compatibility temporarily. Make `content:check` call only the corpus command so adding a package cannot require editing `package.json`.

- [ ] **Step 5: Verify discovery and legacy compiler compatibility**

Run: `node test/phase2-discovery.js && node test/content-graph.js && npm run content:check`

Expected: all exit 0 and the corpus summary count equals the number of production manifests found by the walker.

- [ ] **Step 6: Pass both independent review gates, reverify, and commit**

```bash
git add src/content/json-source.js src/content/discovery.js test/phase2-discovery.js test/fixtures/phase2/discovery tools/content.js package.json
git commit -m "feat: discover authored content corpus"
```

### Task 2: Compile canonical Phase 2 IR, locks, hashes, and reports through one validator

**Files:**
- Create: `src/content/canonical.js`
- Create: `src/content/economy-profile.js`
- Create: `src/content/corpus.js`
- Create: `test/phase2-compiler.js`
- Create: `test/phase2-scale.js`
- Create: `test/fixtures/phase2/compiler/`
- Create: `tools/content-scale.js`
- Modify: `src/content/compiler.js`
- Modify: `src/content/runtime.js`
- Modify: `tools/content.js`

**Interfaces:**
- Consumes: output of `discoverContentPackages`, server-owned compiler version, optional trusted overlay bytes, and an offline dependency catalog.
- Produces: `compileContentCorpus({ packages, compilerVersion, dependencyCatalog, overlayProvider }): { bundles, publicManifests, lock, reports, knowledgeManifest }` and `validateCompiledBundle(bundle, { authorityProfile }): bundle`.
- Hash helpers: `canonicalBytes(value): Buffer`, `frame(domainTag, fields): Buffer`, and `hashFrame(domainTag, fields): string`.
- Economy package kinds are closed to `library`, `experience`, and server-assigned `fixture`; the canonical corpus production-profile registry is closed to `phase2_economy` and `phase3_mystery`. Legacy profiles remain accepted only by legacy `compileContentPack` and cannot enter the new corpus path.

- [ ] **Step 1: Write the canonical hash and qualification red tests**

Test author/object/file ordering invariance; package-local IDs becoming `<packageId>::<localId>`; stable ordinals; duplicate qualified IDs; exact imported definition hashes; no floating dependency at runtime; and a changed definition producing a changed `definitionHash`, `irHash`, and `bundleHash` without self-reference.

```js
assert.match(bundle.hashes.definitionHashById['omerta.phase2.core::mat.ferrous-scrap'], /^[a-f0-9]{64}$/);
assert.equal(bundle.ir.nodes[0].ordinal, 0);
assert.deepEqual(bundle.lock.imports, [{
  id: 'omerta.phase2.core::mat.ferrous-scrap',
  definitionHash: coreDefinitionHash,
  dependencyBundleHash: coreBundleHash,
}]);
assert.equal(Object.hasOwn(bundle.canonicalHashInputs.bundle, 'bundleHash'), false);
```

- [ ] **Step 2: Write safety, parity, and scale red tests**

Use literal malicious raw JSON for duplicate members, JavaScript/TypeScript/function text, SQL identifiers/statements, shell commands, bytecode/WebAssembly, dynamic/module paths, URLs/runtime imports, environment references, general expressions/templates, authored regular expressions, unsafe markup, author-supplied seeds/timestamps/item/event/account/owner/idempotency IDs, unknown adapters/arguments, prototype keys, OMR aliases/effects, unresolved imports, dependency cycles, oversized bytes/depth/strings/nodes/edges/references/components/witnesses, and authored fixture promotion. Assert the duplicate-aware parser, `tools/content.js check-corpus`, `tools/content.js build-corpus`, and direct `compileContentCorpus` reject the same fixture with the same stable error code.

Generate both a 10,000-node linear/deep graph and a 10,000-node branching/component graph. `test/phase2-scale.js` launches each twice in a separate process with `node --max-old-space-size=768 tools/content-scale.js <fixture>`, enforces 30 seconds per process, and compares content/report hashes. The child emits actual elapsed milliseconds, peak heap/RSS when available, node/edge/component counts, witness bytes, and total output bytes; each report must stay at or below 8 MiB.

- [ ] **Step 3: Verify red**

Run: `node test/phase2-compiler.js`

Expected: module-not-found or missing `compileContentCorpus` failure.

- [ ] **Step 4: Implement framed canonical hashing and IR compilation**

Implement the exact domains `omerta:definition:v1`, `omerta:source:v1`, `omerta:secret-overlay:v1`, `omerta:dependency-lock:v1`, `omerta:compiled-ir:v1`, `omerta:bundle:v1`, and `omerta:public-manifest:v1`. Every frame field carries type and byte length. Build adjacency/indexes iteratively with sorted arrays and compact predecessor witnesses.

- [ ] **Step 5: Implement one complete validation entry point**

Have `tools/content.js check-corpus` and Phase 2 build call `compileContentCorpus`/`validateCompiledBundle`. Expose `verifyStoredBundleBytes(bytes, expectedHashes)` for Task 3 registry ingestion and activation; it canonicalizes the already compiled artifact, verifies every recorded hash, and calls the same complete validator without recompiling source. Preserve `compileContentPack` for legacy bundles. The public manifest excludes private digests, server payloads, paths, timestamps, and operator fields.

- [ ] **Step 6: Verify focused and compatibility suites**

Run: `node test/phase2-compiler.js && node test/phase2-scale.js && node test/phase2-discovery.js && node test/content-graph.js && node test/content-runtime.js && node test/content-api.js`

Expected: all exit 0; the 10,000-node result is deterministic over two builds.

- [ ] **Step 7: Pass both independent review gates, reverify, and commit**

```bash
git add src/content/canonical.js src/content/economy-profile.js src/content/corpus.js src/content/compiler.js src/content/runtime.js tools/content.js tools/content-scale.js test/phase2-compiler.js test/phase2-scale.js test/fixtures/phase2/compiler
git commit -m "feat: compile canonical economy corpus"
```

### Task 3: Persist immutable item definitions and exact active bundle identity

**Files:**
- Modify: `schema.sql`
- Create: `src/content/artifacts.js`
- Create: `src/content/activation-policy.js`
- Create: `src/itemdefinitions.js`
- Create: `test/phase2-definitions.js`
- Modify: `src/content/runtime.js`
- Modify: `src/invariants.js`

**Interfaces:**
- Produces: `storeSealedBundle(client, { canonicalBytes, operatorId }): Promise<StoredArtifact>`, `createActivationPolicy({ environment, allowedProfiles }): ActivationPolicy`, `activateStoredBundle(client, { namespace, bundleHash, operatorId }, activationPolicy): Promise<ActivationEvent>`, `registerItemDefinitions(client, bundle): Promise<void>`, `activateItemDefinitions(client, bundle): Promise<void>`, `definitionByHash(client, definitionHash): Promise<ItemDefinition>`, and `activeDefinition(client, logicalItemId): Promise<ItemDefinition | null>`.
- `ActivationPolicy` is constructed once from trusted server configuration, is not serializable from authored content or an HTTP request, and requires an exact environment/profile allowlist match before any activation event or pointer mutation.
- An `ItemDefinition` contains `logicalItemId`, `definitionVersion`, `definitionHash`, `packageId`, `bundleHash`, `kind`, `family`, `tags`, `rarity`, `stackable`, `tradePolicyHash`, `tradePolicy`, `ownerScopes`, `qualityMode`, `maximumLotQuantity`, `conservationClass`, and safe `metadata`.

- [ ] **Step 1: Write schema and definition red tests**

Test clean pg-mem materialization, in-place migration, uniqueness of `(logical_item_id, definition_version)` and `(logical_item_id, definition_hash)`, positive monotonic definition registration, immutable hash reuse, closed kinds/rarities/quality modes/owner scopes, stale activation, registration replay, and direct database drift rejection. Separately test sealed-artifact ingestion, same-hash/different-bytes rejection, canonical/hash mismatch, missing exact dependency artifacts, shared validator rejection with the same stable code as check/build, same-hash activation replay, R2 activation followed by deliberate R1 rollback activation for new work, and unchanged pins on already-started state. Delete or mutate the original source after ingestion and prove activation still loads the immutable stored bytes; reject any activation call that supplies mutable source or caller-selected compiled fields. With a valid stored bundle, prove a disallowed server environment/profile fails before it appends an activation event or moves the pointer, while the same bundle succeeds under an allowed trusted policy; authored or request-supplied environment/profile allowlists must be rejected or ignored and can never broaden authority.

```js
await registerItemDefinitions(client, coreBundle);
await registerItemDefinitions(client, coreBundle);
assert.equal(Number((await client.query(
  'SELECT count(*) AS n FROM item_definition_versions WHERE bundle_hash=$1',
  [coreBundle.bundleHash],
)).rows[0].n), expectedDefinitions);
await assert.rejects(() => registerItemDefinitions(client, changedBytesSameVersion),
  (error) => error.code === 'item_definition_conflict');
```

- [ ] **Step 2: Verify red**

Run: `node test/phase2-definitions.js`

Expected: missing table or module failure.

- [ ] **Step 3: Add immutable definition and activation schema**

Create `item_definition_versions`, `item_definition_activations`, immutable `content_bundle_artifacts`, append-only `content_activation_events`, and additive exact hash/profile columns on the existing content activation pointer. Each activation event stores namespace, current/previous bundle and dependency-lock hashes, compiler/IR version, profile, operator, database timestamp, and exact validation-report hashes. Use database constraints for the closed vocabulary and hash lengths. Existing legacy content rows remain readable and do not become Phase 2 definitions.

- [ ] **Step 4: Implement registration and activation**

Verify canonical compiled bytes before immutable artifact insertion and compare every stored byte/hash/profile/lock field after `ON CONFLICT DO NOTHING`. Activation loads only a stored server-sealed bundle by exact hash, verifies its canonical bytes/hashes and stored exact dependencies, calls the same complete validator, then checks the injected trusted `ActivationPolicy` against the server-owned environment and compiled profile before any audit or pointer write. Only after that check may it append the audit event and update the new-work pointer transactionally. Permit an explicit rollback activation to a previously stored valid bundle while preserving existing pins; reject same logical definition version with different immutable behavior and return no author-private fields.

- [ ] **Step 5: Add definition invariants and verify**

Run: `node test/phase2-definitions.js && node test/phase2-compiler.js && node test/migrate.js && node test/content-runtime.js && node test/items.js`

Expected: all exit 0 and invariant output reports zero mutable-definition or activation-drift rows.

- [ ] **Step 6: Pass both independent review gates, reverify, and commit**

```bash
git add schema.sql src/content/artifacts.js src/content/activation-policy.js src/itemdefinitions.js src/content/runtime.js src/invariants.js test/phase2-definitions.js
git commit -m "feat: persist immutable item definitions"
```

### Task 4: Add lot-authoritative mutation primitives and normalized lineage

**Files:**
- Modify: `schema.sql`
- Create: `src/itemlots.js`
- Create: `src/item-lock-trace.js`
- Create: `test/phase2-lots.js`
- Create: `test/phase2-lots-property.js`
- Modify: `src/items.js`
- Modify: `src/invariants.js`

**Interfaces:**
- Produces `withLotMutation(client, { actorAccountId, actionKind, idempotencyKey, owner, request }, action)`; `grantLot(client, mutation, definition, output)`; `consumeLotsFifo(client, mutation, selector)`; `consumeExactLot(client, mutation, lotId, quantity)`; `splitLot(client, mutation, lotId, quantity, custody)`; `lotInventoryBoard(client, owner, { cursor, limit, includeLots })`.
- The internal storage key is `sha256(Frame('omerta:item-mutation-key:v1', actorAccountId, actionKind, externalKey))`; the existing `item_mutation_guards` row remains authoritative, gains a server-generated UUID `mutation_id`, and enforces output uniqueness as `(mutation_id, output_ordinal)`.
- Produces test-only `createItemLockTrace()` at this shared layer; every Task 4 lock helper records class plus canonical subtype/key/ID/generation and rejects decreasing classes, unsorted members, or late discovery of a lower-sorted member.

- [ ] **Step 1: Write lot identity, FIFO, split, and overflow red tests**

Create two otherwise similar lots differing one dimension at a time across definition hash, quality state, binding, trade restriction, season/run, expiry/age basis, source cap, provenance class, owner, and custody. Assert aggregate reads never merge incompatible dimensions, source rows are never physically combined, FIFO consumes by `(created_at, lot_id)`, exact selection cannot substitute another lot, split preserves every immutable dimension/source lineage, and quantities reject zero, negative, non-integer, and overflow. Trace character/account/guard/aggregate/item/budget classes and add negative fixtures for decreasing classes, unsorted subtype/key/ID/generation order, and late lower-sorted discovery.

- [ ] **Step 2: Write replay and rollback red tests**

Assert same account/action/key/request returns one mutation/result/lot; changed request conflicts; same text for another account or action is independent; archived result replay is semantic; a simulated commit-before-transport-result crash reconciles to that same result; injected failure after guard/input/output/event writes leaves no fragment; and output ordinal uniqueness prevents duplication. For the same scoped key, change each server-resolved authority dimension independently—issued action, selected aggregate, resolved owner, active profile/bundle, and exact input/output definition hashes—and assert `idempotency_conflict` rather than replay.

For every successful lot mutation, assert the normalized record contains source lot, amount before, amount removed, amount after, destination or consuming sink, exact definition hash, derived output lot ordinal, and matching event ordinal. For unique transitions, assert expected/next state, prior/next owner, exact definition hash, creation/output ordinal, and matching event ordinal.

Add a deterministic property-style generator with at least 100 seeds and 250 grant/consume/split/escrow/release steps per seed. After every step, assert nonnegative quantities, opening + authorized creation + transfers in - consumption - transfers out = closing per definition hash, one custody state, event/guard/IO parity, and that recombining compatible projections never erases physical lot lineage.

- [ ] **Step 3: Verify red**

Run: `node test/phase2-lots.js && node test/phase2-lots-property.js`

Expected: missing lot schema/module failure.

- [ ] **Step 4: Add lot, guard, IO, and event schema**

Create `item_lots`, `item_mutation_inputs`, and `item_mutation_outputs`; extend the existing `item_mutation_guards` with nullable legacy-compatible `mutation_id`, `actor_account_id`, `action_kind`, and `external_idempotency_key` columns plus a unique non-null Phase 2 scope. Extend `item_events` additively with nullable `mutation_id`, `lot_id`, and `definition_hash` while preserving legacy rows. Add database checks for one state/owner/custody, original-versus-remaining quantity, output uniqueness, and one completed semantic result. Do not create a competing Phase 2 guard table.

- [ ] **Step 5: Implement the branded lot adapter**

Require an active `withItemTransaction` client. Register pg-mem undo callbacks for every external/non-lot row modified inside the boundary. Route every shared definition/guard/lot/unique lock through `item-lock-trace.js` in test mode, lock rows with canonical SQL ordering, use checked arithmetic before writes, and append normalized IO and item events before completing the guard.

- [ ] **Step 6: Extend invariants and verify**

Run: `node test/phase2-lots.js && node test/phase2-lots-property.js && node test/items.js && node test/crafting.js && npm run invariants`

Expected: all exit 0; the lot invariant reports no negative quantity, orphan definition, duplicate output, split mismatch, invalid custody, or eventless mutation.

- [ ] **Step 7: Pass both independent review gates, reverify, and commit**

```bash
git add schema.sql src/itemlots.js src/item-lock-trace.js src/items.js src/invariants.js test/phase2-lots.js test/phase2-lots-property.js
git commit -m "feat: add authoritative item lots"
```

### Task 5: Migrate Phase 1 stacks and unique items behind a one-way authority fence

**Files:**
- Modify: `schema.sql`
- Create: `content/compatibility/phase1-item-definitions.json`
- Create: `src/itemmigration.js`
- Create: `test/phase2-migration.js`
- Create: `test/phase2-postgres.js`
- Modify: `src/itemlots.js`
- Modify: `src/items.js`
- Modify: `src/db.js`
- Modify: `src/invariants.js`

**Interfaces:**
- Produces `migrateLegacyInventory(client, { deploymentEpoch }): Promise<MigrationReport>`, `verifyLotAuthority(client): Promise<AuthorityReport>`, and `requireLotAuthority(client): Promise<void>`.
- `MigrationReport` contains deterministic pre/post stack totals, unique identity/owner/state digest, migration-event digest, epoch, and replay flag.

- [ ] **Step 1: Write pg-mem migration red tests**

Seed nonzero/zero stacks, active/escrowed/consumed unique instances, and operation escrow. Assert every template is present in the source-controlled immutable compatibility manifest; one deterministic legacy lot is created per nonzero stack and none for zero; unique ID/owner/custody/state remain unchanged; and every unique row gains the exact compatibility definition hash, deterministic quality, reserved null condition summary, compact provenance digest/version, deterministic migration creation mutation/output ordinal, and deterministic `ineligible` export policy. Assert one truthful `migration_origin` event without invented crafter/source, equal aggregate totals/digests, idempotent rerun, and Bellini rows excluded.

- [ ] **Step 2: Write authority and backup/restore red tests**

After cutover, assert all legacy stack mutation entry points delegate to lots; all unique create/transfer/consume/escrow/release paths require the epoch and exact compatibility definition adapter; direct legacy stack writes and old unique owner/state writes without the epoch-bound adapter are rejected; old-process epoch mismatch fails closed; compatibility reads reproduce the old response shape; and dumping/restoring critical rows reproduces totals and identity/provenance digests.

- [ ] **Step 3: Write the real-PostgreSQL cutover race**

Use two independent clients: one acquires the cutover advisory lock plus `ACCESS EXCLUSIVE` locks on `item_stacks` and `item_instances`, while the other attempts a legacy stack or obsolete unique-authority write. Assert an already-committed write is included by final reconciliation and an overlapping/later write waits then is rejected by the newly enabled database trigger; no committed value is lost. Capture the maintenance lock trace and assert the documented special cutover class/order independently from normal item mutations. Skip only with the repository's explicit `DATABASE_URL` unavailable marker, never report it as a pass.

- [ ] **Step 4: Verify red**

Run: `node test/phase2-migration.js`

Expected: missing migration module/table failure.

- [ ] **Step 5: Implement the migration, fence, and compatibility adapter**

Stage nullable unique compatibility columns first, backfill from `content/compatibility/phase1-item-definitions.json`, validate every row and digest, then install `NOT NULL`/foreign-key/check constraints and hot-path indexes. Never rely on `src/db.js` swallowing a failed populated-table column addition. The forward-recovery path may safely resume any pre-publication stage; it never rolls back to writable dual authority.

Add `item_authority_epochs` with one current epoch and migration receipts keyed by source tuple. The cutover transaction takes a transaction-scoped advisory lock, locks `item_stacks` and `item_instances` in `ACCESS EXCLUSIVE` mode, performs final reconciliation, enables the legacy-stack rejection trigger and the epoch-bound unique-mutation trigger, publishes the lot-authority epoch, and commits all four effects atomically. `makeDb` verifies or resumes the idempotent migration before the server accepts traffic, but it never treats schema-booter serialization as the gameplay-writer fence. Instrument migration/compatibility definition, epoch, unique, and lot locks through the Task 4 trace helper. Make every stack and unique mutation entry point plus `inventoryBoard` call the lot/definition adapter only after `requireLotAuthority`; retain pre-cutover support solely for migration rehearsal.

- [ ] **Step 6: Verify pg-mem, real PostgreSQL, and Phase 1 regressions**

Run: `node test/phase2-migration.js && node test/items.js && node test/crafting.js && node test/belladonna.js && node test/worldgraph-api.js`

Run with a disposable PostgreSQL database: `node test/phase2-postgres.js --migration`

Expected: pg-mem and Phase 1 scripts exit 0; PostgreSQL reports the race disposition and zero conservation mismatch.

- [ ] **Step 7: Pass both independent review gates, reverify, and commit**

```bash
git add schema.sql content/compatibility/phase1-item-definitions.json src/itemmigration.js src/itemlots.js src/items.js src/db.js src/invariants.js test/phase2-migration.js test/phase2-postgres.js
git commit -m "feat: cut over generic inventory to lots"
```

### Task 6: Author the purposeful starter material library and graph reports

**Files:**
- Create: `content/packs/phase2-core-materials/pack.json`
- Create: `src/materials.js`
- Create: `test/phase2-materials.js`
- Create: `tools/phase2-content.js`
- Modify: `src/content/economy-profile.js`
- Modify: `src/content/corpus.js`
- Modify: `content/README.md`
- Modify: `package.json`

**Interfaces:**
- Produces `materialCatalog(bundle): SafeMaterialDefinition[]` and reports `{ sources, sinks, orphans, scarcity, conservation, reachability, cashAuthority, omrAuthority, warnings, errors }` keyed by qualified item definition ID. Every cash-moving adapter is statically classified as `transfer`, `sink`, or separately authorized `bounded_source`; an absent/unknown classification is a production error.
- The production material census is between 45 and 60 unique active logical definitions, excluding aliases, fixtures, archived revisions, and compatibility-only definitions.

- [ ] **Step 1: Write the catalog census and lifecycle red tests**

Assert the literal family coverage from the spec, the 45–60 census, unique IDs, and for every material at least one reachable acquisition source, concrete use, sink or bounded durable-use declaration, rarity/source cap, trade/transfer rule, ownership scope, quality assignment, ordinary-market flag, and unique/export policy.

- [ ] **Step 2: Write report failure red tests**

Mutate one valid fixture at a time to create an orphan, missing sink, unmatched source, zero-cost upgrading cycle, unique-as-stack output, invalid quantity, dominant uncapped source, dead quality band, OMR reference, unclassified cash path, hidden cash source, and a family with one consumer. Assert production errors block activation and warning promotion is deterministic.

- [ ] **Step 3: Verify red**

Run: `node test/phase2-materials.js`

Expected: missing package/catalog or census failure.

- [ ] **Step 4: Author and validate the library**

Define purposeful ferrous, nonferrous, mechanical, vehicle, textile, paper/printing, logistics/construction, medical/laboratory, fictional contraband, jewelry/precision, tool/catalyst, mystery, and blueprint-fragment families. Every current use/sink is a declared graph node or imported exact definition, not prose metadata.

- [ ] **Step 5: Implement bounded iterative reports and tooling**

Use integer/rational conserved-unit weights; iterative adjacency traversal; strongly connected component checks with bounded witnesses; deterministic sorting. `node tools/phase2-content.js check content/packs` prints a machine-readable corpus/report summary and exits nonzero on any production error.

- [ ] **Step 6: Verify catalog and corpus**

Run: `node test/phase2-materials.js && node test/phase2-compiler.js && node tools/phase2-content.js check content/packs && npm run content:check`

Expected: zero production errors; warning list is explicitly asserted; census is within 45–60.

- [ ] **Step 7: Pass both independent review gates, reverify, and commit**

```bash
git add content/packs/phase2-core-materials/pack.json src/materials.js src/content/economy-profile.js src/content/corpus.js tools/phase2-content.js test/phase2-materials.js content/README.md package.json
git commit -m "feat: add Phase 2 material economy"
```

### Task 7: Compile condition-aware vehicle salvage profiles

**Files:**
- Create: `content/packs/phase2-vehicle-salvage/pack.json`
- Create: `test/phase2-salvage-profiles.js`
- Modify: `src/content/economy-profile.js`
- Modify: `src/content/corpus.js`

**Interfaces:**
- Produces indexed `salvageProfilesByCarModel` and `salvageProfilesByCarClass` where every output references an exact material definition hash and contains bounded base quantity, damage thresholds/modifiers, compatible condition/tuning modifiers, rarity eligibility, and conserved-unit ceiling.

- [ ] **Step 1: Write profile compilation red tests**

Use canonical car IDs from `src/rules.js`/the existing catalog. Assert different classes/models yield different mixes, higher damage cannot increase precision value, preserved cars can retain glass/panels/bearings/engine parts, undeclared specialty parts are impossible, tuning recovery never exceeds declared invested value, all quantities are bounded integers, and every output has a reachable sink.

- [ ] **Step 2: Write invalid-profile red tests**

Reject unknown car IDs/classes, missing source cars, floating material IDs, negative/overflow ranges, rare output without cap, condition rules that increase conserved value, author-provided RNG seeds, and a profile whose outputs have no sink.

- [ ] **Step 3: Verify red**

Run: `node test/phase2-salvage-profiles.js`

Expected: missing salvage profile schema/index failure.

- [ ] **Step 4: Author profiles and compiler indexes**

Cover existing vehicle classes with model overrides only where the catalog gives a meaningful specialty identity. Keep low-value mix variation bounded. Store no real-world mechanical procedures.

- [ ] **Step 5: Verify profiles and reports**

Run: `node test/phase2-salvage-profiles.js && node test/phase2-materials.js && node tools/phase2-content.js check content/packs`

Expected: all exit 0 and the material report includes every salvage output as a source edge.

- [ ] **Step 6: Pass both independent review gates, reverify, and commit**

```bash
git add content/packs/phase2-vehicle-salvage/pack.json src/content/economy-profile.js src/content/corpus.js test/phase2-salvage-profiles.js
git commit -m "feat: define vehicle salvage profiles"
```

### Task 8: Execute exactly-once salvage and expose additive Phase 2 APIs

**Files:**
- Modify: `schema.sql`
- Create: `src/salvage.js`
- Modify: `src/item-lock-trace.js`
- Create: `src/routes/worldgraph-phase2.js`
- Create: `test/phase2-salvage.js`
- Create: `test/phase2-api.js`
- Modify: `test/phase2-postgres.js`
- Modify: `src/routes/worldgraph.js`
- Modify: `src/server.js`
- Modify: `src/agentgateway.js`
- Modify: `src/invariants.js`

**Interfaces:**
- Produces `salvageBoard(client, actor): Promise<{ actions, blockers }>` and `salvageVehicle(pool, actor, { carId, profileId, actionToken, idempotencyKey }): Promise<SalvageResult>`. Each issued action contains the safe profile/recipe hash, expected output bands with item ID/minimum/maximum/quality bands, blockers, expiry, and one opaque action identity; it never exposes a secret bundle hash.
- Adds `GET /v1/worldgraph/materials`, `GET /v1/worldgraph/salvage`, and bounded `GET /v1/worldgraph/inventory?detail=<summary|lots|unique|all>&limit=<1..100>&cursor=<opaque>`; lot detail includes exact definition/quality/custody/restriction/provenance-summary fields, and unique detail includes exact definition/quality/state/custody/compact provenance fields. Keeps `POST /v1/worldgraph/recipes/:recipeId/salvage/:carId` as the compatibility mutation.
- Consumes the Task 4 test-only `createItemLockTrace()` contract and instruments the request handler, car aggregate, RNG audit, and salvage budget/cap locks in the same trace as shared definition/guard/lot/unique helpers.

- [ ] **Step 1: Write salvage runtime red tests**

Seed owned cars across class/model/damage/tuning and ineligible listed, pledged, racing, consumed, exported/on-chain, wrong-owner, dead-character, and wrong-location states. Assert server-derived outputs/quality/seed, exact definition pins, same-key replay with the same rare result, permanent one-row `rng_audit` evidence bound to `mutation_id`, audit survival across replay/result archival/backup, a 50-attempt different-key single-car race with one winner and 49 clean non-mutating outcomes, permanent external-asset input uniqueness, car consumed on success, all-or-nothing injected failures after every write boundary, and no cash/OMR/collection-log authority.

Trace the request handler and runtime through character, account, guard, salvage aggregate, item, and shared-cap locks. Add negative fixtures for decreasing classes, unsorted IDs/subtypes, and late discovery of a lower-sorted row.

- [ ] **Step 2: Write route/OpenAPI red tests**

Assert authentication, closed bodies, required idempotency, opaque action identity, safe profile/recipe hash, exact expected output band fields, stale bundle handling, bounded cursors, no owner/private hash leakage, exact lot and exact unique detail modes, client inability to nominate outputs/quantities/quality/condition/seed/definition hash, and additive compatibility response fields.

- [ ] **Step 3: Verify red**

Run: `node test/phase2-salvage.js && node test/phase2-api.js`

Expected: missing registrar/runtime failures.

- [ ] **Step 4: Add external-asset consumption uniqueness and lock-safe runtime**

Create a normalized external-asset input row unique on completed `(asset_type, asset_id)`. Resolve immutable definitions first; enter the existing item transaction; lock character/account; claim Phase 2 guard; lock car aggregate; revalidate all car states; derive the one RNG seed from `mutation_id`; append one mutation-bound `rng_audit` row; create lots/events; consume the car; complete replay; commit. Register car and RNG-audit compensation for pg-mem. Every lock helper records the same class/subtype/key/ID/generation ordering in test mode.

- [ ] **Step 5: Mount safe projections and compatibility route**

Issue signed/opaque action tokens bound internally to actor account, car, profile, active bundle, and expiry. Treat the token as a convenience, then revalidate all authority under lock. Route-specific internal mutation keys include authenticated account and action kind.

- [ ] **Step 6: Verify runtime, API, Phase 1, and invariants**

Run: `node test/phase2-salvage.js && node test/phase2-api.js && node test/worldgraph-api.js && node test/crafting.js && node test/items.js && npm run invariants`

Run with disposable PostgreSQL: `node test/phase2-postgres.js --salvage-race`

Expected: all local scripts exit 0; PostgreSQL reports exactly one committed salvage out of 50 independent attempts, no duplicate lot/output/event/RNG audit, monotonic lock traces, documented contention disposition, and no deadlock.

- [ ] **Step 7: Pass both independent review gates, reverify, and commit**

```bash
git add schema.sql src/salvage.js src/item-lock-trace.js src/routes/worldgraph-phase2.js src/routes/worldgraph.js src/server.js src/agentgateway.js src/invariants.js test/phase2-salvage.js test/phase2-api.js test/phase2-postgres.js
git commit -m "feat: execute transactional vehicle salvage"
```

### Task 9: Build deterministic Phase 2A simulation and executable release gates

**Files:**
- Create: `tools/phase2-economy-sim.js`
- Create: `test/phase2-simulation.js`
- Modify: `tools/preflight.js`
- Modify: `package.json`

**Interfaces:**
- Produces deterministic JSON simulation fields `codeCommit`, `corpusHash`, `definitionLockHash`, `seed`, `population`, `horizonDays`, `initialInventory`, `actionPolicy`, `modeledExternalSources`, `modeledExternalSinks`, `catalogCensus`, `sourceTotals`, `sinkTotals`, `endingInventory`, `lateHorizonGrowth`, `turnover`, `rareOutputs`, `dominantSources`, `blockedCriticalChains`, `contentionRetries`, `notApplicableMetrics`, `assumptions`, and `errors`.
- Adds one `phase2a:verify` script chaining focused compiler, inventory, salvage, migration, API, simulation, invariants, corpus, and documentation tests without treating unavailable real PostgreSQL as passed.
- The CLI accepts an explicit `--code-commit` value for retained evidence and never derives or mutates production state. Tests use a fixed synthetic commit; Task 10 passes the already-reviewed Task 9 commit.

- [ ] **Step 1: Write simulation and preflight red tests**

Use hand-derived literal small-population fixtures plus fixed 100-, 1,000-, and 10,000-actor deterministic runs over 30 and 180 days with low/medium/high activity and normal, salvage-abundant, and rare-source-constrained conditions. Assert every quantitative budget in this plan, material conservation, bounded source budgets, stable results, no OMR/cash source, no production-state writes, and nonzero turnover for each active family. Assert preflight rejects any compiler/report/simulation error. Report the later-phase profession, Masterwork, facility, market, project, law-pressure, repair, and trade scenarios as `not_applicable_phase2a`, never as passes.

- [ ] **Step 2: Verify red**

Run: `node test/phase2-simulation.js`

Expected: missing simulator and preflight integration failure.

- [ ] **Step 3: Implement deterministic simulation and preflight integration**

All randomness comes from an explicit named seed; arithmetic uses checked integers; catalog/budget inputs come from the compiled bundle. Include sensitivity results around every material-flow assumption, print assumptions, and refuse success on any orphan/error or breached cap. The simulator must be pure with respect to game state and must emit byte-identical canonical JSON for identical explicit inputs.

- [ ] **Step 4: Verify the executable gates**

Run: `node test/phase2-simulation.js && npm run phase2a:verify`

Expected: all included local gates exit 0; real PostgreSQL remains a separately reported required gate in Task 10.

- [ ] **Step 5: Pass both independent review gates, reverify, and commit**

```bash
git add tools/phase2-economy-sim.js test/phase2-simulation.js tools/preflight.js package.json
git commit -m "test: add Phase 2A economy simulation"
```

### Task 10: Capture retained evidence and close PostgreSQL, recovery, documentation, and red-team gates

**Files:**
- Modify: `test/phase2-postgres.js`
- Create: `docs/superpowers/reports/phase2a-economy-pre-tuning.json`
- Create: `docs/superpowers/reports/phase2a-economy-final.json`
- Modify: `tools/backup.sh`
- Modify: `tools/backup-selftest.sh`
- Modify: `package.json`
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `docs/WIKI.md`
- Modify: `content/README.md`
- Modify: `test/docs.js`

**Interfaces:**
- Retains two canonical reports generated only by the already-reviewed Task 9 simulator. Both record the exact Task 9 code commit, corpus hash, definition lock hash, scenario inputs, fixed budgets, assumptions, and results; `reportStage` may differ but is excluded from simulated measurements.
- Extends the PostgreSQL matrix and backup self-test as required release evidence; unavailable real PostgreSQL is reported as a required unavailable gate, never a pass.

- [ ] **Step 1: Generate and freeze the pre-tuning economy report**

Resolve `git rev-parse HEAD` after the Task 9 commit and pass that exact immutable SHA as `--code-commit` to the committed simulator. Run the complete fixed scenario matrix before changing any authored quantity and retain its canonical output byte-for-byte at `docs/superpowers/reports/phase2a-economy-pre-tuning.json`. If any fixed budget fails, amend and review this plan/spec before tuning authored content; never silently move a threshold.

- [ ] **Step 2: Write PostgreSQL, backup, retained-report, and documentation red tests**

Extend the PostgreSQL matrix to assert its still-missing production-scale evidence. Assert critical-table backup includes definitions, lots, Phase 2 guards/IO/events, authority epoch, and consumed-car identity; restore recomputes matching totals/digests. Assert both retained reports name the committed simulator SHA and exact corpus/lock inputs and can be reproduced byte-for-byte. Assert public docs describe lot authority, materials/salvage APIs, no autonomous `agent/act` authority, OMR/NFT boundaries, and the operator activation stop gate.

- [ ] **Step 3: Verify red**

Run: `node test/phase2-postgres.js --all && npm run backup:selftest && node test/docs.js`

Expected: the first absent PostgreSQL, backup, or documentation obligation fails. If the disposable real-PostgreSQL URL is unavailable, record that required environmental gate in the SDD ledger and continue only with the non-PostgreSQL red assertions; do not label the matrix passed.

- [ ] **Step 4: Implement recovery and documentation obligations, then generate final evidence**

Implement the missing PostgreSQL assertions, backup/restore coverage, and public/operator documentation. Without altering the already-reviewed simulator, generate `phase2a-economy-final.json` from the approved final catalog using the same Task 9 commit and explicit scenario inputs. If no reviewed catalog tuning was authorized, the measurements must match the pre-tuning report; only the report stage may differ. Reproduction tests compare canonical bytes after supplying the declared stage.

- [ ] **Step 5: Run the full Phase 2A verification matrix**

Run: `npm run phase2a:verify`

Run with a disposable PostgreSQL database: `node test/phase2-postgres.js --all`

Run: `npm run backup:selftest && npm test && npm run mobile && npm run ui:quality && npm run knowledge:check`

Expected: every available command exits 0. The PostgreSQL evidence explicitly covers clean schema, staged in-place migration, cutover/legacy-writer race, 50-way salvage races, rollback, check/unique constraints, lock-trace monotonicity, isolation/contention retry behavior, deadlock detection, production-sized `EXPLAIN`/index review for new hot queries, and backup/restore. Browser/mobile commands are required only if a changed surface is rendered by those tools; otherwise their existing suites still run through `npm test`/the named command. Any unavailable required environment remains an explicit blocker, not a green check.

- [ ] **Step 6: Run the Phase 2A red-team checklist**

Re-run adversarial fixtures for material creation without source, cross-version merge, negative/overflow inventory, salvage replay/reroll, car survival, partial rollback, Bellini-lot injection, collection-log spoofing, unknown adapter, executable payload, unledgered cash, and every OMR alias/effect. Save the machine-readable result exactly at `.superpowers/sdd/2026-09-04-world-graph-phase-2a-implementation/red-team-phase2a.json`; that directory is created and self-ignored by the SDD workspace script and is never staged as a production artifact.

- [ ] **Step 7: Pass both independent review gates, update knowledge artifacts, reverify, and commit**

```bash
git add test/phase2-postgres.js docs/superpowers/reports/phase2a-economy-pre-tuning.json docs/superpowers/reports/phase2a-economy-final.json tools/backup.sh tools/backup-selftest.sh package.json AGENTS.md README.md docs/WIKI.md content/README.md test/docs.js knowledge
git commit -m "test: close Phase 2A verification gates"
```

## Phase 2A Completion Review

After Task 10, generate one whole-plan review package from the commit before Task 0 through `HEAD`. Dispatch the strongest available reviewer with the Phase 2A spec, cross-cutting constraints, SDD ledger rulings/deferred minors, implementation reports, and diff package. Resolve every Critical and Important finding through one implementer fix wave plus scoped re-review, then rerun `npm run phase2a:verify`, the real-PostgreSQL matrix, backup self-test, full `npm test`, and knowledge verification. Do not merge, push, deploy, or activate content after review.
