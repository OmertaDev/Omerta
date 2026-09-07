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
- `src/content/phase2-transactions.js`: separate branded registry transactions, pg-mem compensation/whole-read gate, and PostgreSQL recovery boundaries.
- `src/content/artifact-storage.js`: bounded verification of immutable stored bytes and exact dependency closures.
- `src/content/artifacts.js`: atomic artifact/definition/membership registration and audited CAS selection.
- `src/content/activation-policy.js`: branded trusted definition-selection policy and separate historical snapshot validation.
- `src/content/definition-invariants.js`: coherent artifact, membership, selection, history, and policy integrity checks.
- `src/content/compiler.js`: retains legacy `compileContentPack` while delegating Phase 2 profiles to the corpus modules.
- `src/itemdefinitions.js`: intrinsic immutable definitions, exact bundle membership, verification-only registration replay, and safe intrinsic/selected lookups.
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
- `test/lib/phase2-definition-fixtures.js`: test-only sealed registry fixtures, controlled failure/interleaving wrappers, and complete table snapshots.
- `test/phase2-definition-schema.js`, `test/phase2-activation.js`, `test/phase2-definition-invariants.js`: Task 3 schema, policy/CAS, and coherent invariant contracts; `test/phase2-definitions.js` and `test/phase2-postgres.js --definitions` cover registration and real-backend closure.
- `src/db.js`, `test/gates.js`, `SPEC.md`, `MARKETING-POSTS.md`, `.github/workflows/ci.yml`: Task 3 schema compatibility/verification, justified gate declarations, measured census, and immediate suite registration seams.
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

### Task 3: Persist and select immutable definitions on the Phase 2 plane

**Spec:** [Phase 2A Definition Registry Amendment](../specs/2026-09-07-world-graph-phase-2a-definition-registry-amendment.md). This amendment takes precedence over conflicting Task 3 wording. All six-table schema columns, public interfaces, lifecycle, policy/CAS, and recovery contracts are defined there.

**Goal:** Atomically register sealed artifacts and immutable definitions, then select their complete definition set under trusted policy and explicit CAS while preserving legacy runtime authority.

**Execution:** Continue this existing Phase 2A plan and SDD ledger through Tasks 3.1, 3.2, and 3.3 below; do not create a second implementation plan or workspace. Task 2's approved contract and the controller's clean full-suite baseline are prerequisites. Each increment receives TDD, fresh spec and separate quality/security/PostgreSQL reviews, controller verification, and a controller-only commit. Task 4 begins only after all three increments pass.

#### Task 3 constraints

- Authored packages are data only; reject JavaScript, SQL, shell commands, arbitrary templates/expressions, network mutation inputs, prototype-polluting keys, and unknown adapters.
- Canonical output uses package-qualified logical IDs, stable ordering, exact dependency locks, and the seven non-self-referential framed SHA-256 domains defined by the cross-cutting spec.
- Definition registration is monotonic and immutable. The active bundle pointer may select a previously stored, fully validated older bundle for operational rollback; exact replays append no additional event and already-started state stays pinned.
- A committed artifact is fully registered, including zero-definition artifacts. `registerItemDefinitions(pool,{bundleHash})` verifies/replays only; it never repairs.
- Intrinsic versions have no singular bundle owner; exact old intrinsic versions may gain new memberships after newer versions exist. Only a previously unregistered lower version is forbidden.
- Versions are positive safe integers stored as BIGINT; concept economic fields are independently optional. `tradePolicyHash` aliases `definitionHash` when a policy is present.
- Initial selection policy admits only production `phase2_economy` libraries/experiences. Event policy snapshot is canonical `{environment,allowedProfiles}`; current policy checks are separate.
- PostgreSQL is authoritative. pg-mem compensation must expose equivalent atomic results without replacing required real-PostgreSQL race tests. Public pg-mem multi-query reads hold the shared gate for their entire callback. PostgreSQL never performs compensation.
- Preserve Phase 1 world-graph, crafting, mystery, operation, Belladonna, content-runtime, and Bellini compatibility behavior.
- No legacy runtime edits, live-source compilation, production activation routes/CLI/startup actions, item lots, OMR/cash mutation, wallet, NFT, or contract work.
- Every subtask uses TDD and fresh spec review followed by a different fresh quality/security/PostgreSQL review. Controller verifies, resolves all Critical/Important findings, and commits only then. Task 4 waits for 3.1, 3.2, and 3.3.
- Every subtask immediately registers its new root suites, refreshes machine-measured SPEC/MARKETING census, adds justified module-scope/SQL gate declarations where required, and passes `node test/gates.js` and `node test/docs.js` before review/commit. `test/lib` helpers are not root suites but count in SPEC's recursive census.
- Do not merge, push, deploy, activate a production bundle, activate seasonal OMR, or deploy NFT contracts.

#### File map and module seams

| File | Responsibility |
|---|---|
| `schema.sql` | Six complete tables, named checks/uniques/composite FKs/indexes from the amendment, in dependency order. |
| `src/db.js` | Correct pg-mem translate compatibility and named fail-closed Phase 2 schema verification at the existing boot seam. |
| `src/content/phase2-transactions.js` (new) | Own checked-out mutation transaction; opaque active-client brand; pg-mem global gate/undo; whole-callback reads; SQLSTATE/recovery mapping. |
| `src/content/artifact-storage.js` (new, internal) | Bounded lookup of exact stored dependencies, compiler verification, immutable artifact projection comparison; no source compiler or public transaction ownership. |
| `src/content/artifacts.js` (new) | Public atomic store and stored activation orchestration. |
| `src/itemdefinitions.js` (new) | Intrinsic/membership persistence helpers, verification-only register, intrinsic/selected safe reads; private selection helper requires branded activation context. |
| `src/content/activation-policy.js` (new) | Branded/frozen trusted policy, live assertion, canonical safe snapshot, historical snapshot validation. |
| `src/content/definition-invariants.js` (new) | Bounded complete Phase 2 checks against one coherent read context. |
| `src/invariants.js` | Optional policy injection, gate-aware snapshot collection, append Phase 2 check results, alert after snapshot. |
| `test/lib/phase2-definition-fixtures.js` (new) | Test-only sealed fixtures, trusted identities, complete six-table snapshots, controlled SQL pauses/failures, alias pools. |
| `test/phase2-definition-schema.js` (new) | Clean/additive schema and literal direct-SQL constraints. |
| `test/phase2-definitions.js` (new) | Store/definition API, immutable reuse, limits, replay, corruption, atomic failures, read isolation. |
| `test/phase2-activation.js` (new) | Policy, exact CAS/replay, pointer replacement, rollback, isolation. |
| `test/phase2-definition-invariants.js` (new) | Corruption matrix, current/historical policy distinction, complete-report and snapshot tests. |
| `test/phase2-postgres.js` (new) | Explicit disposable PostgreSQL schema, migrations, named constraints, independent-client races, MVCC/rollback/SQLSTATE/EXPLAIN evidence; `--definitions` selects this task's full lane. |
| `.github/workflows/ci.yml`, `package.json` | Add focused required local and PostgreSQL commands to existing test lanes; no production operator command. |
| `SPEC.md`, `MARKETING-POSTS.md`, `test/gates.js` | Each subtask maintains measured file/line/runnable-suite census and justified declarations for its actual module-scope collections/SQL shapes. |

These boundaries avoid circular dependencies: transaction module depends on existing `db`/`game`; artifact-storage depends on compiler/parser/canonical/transaction context; itemdefinitions depends on artifact-storage and transaction context; artifacts orchestrates itemdefinitions/artifact-storage/policy. Invariants consume these internal readers. No content module imports the legacy runtime for authority.

Exact public signatures and every column/constraint are in the amendment. Internal helpers below are not public controller operations:

```ts
withPhase2Transaction(pool, action: (client: Phase2Client) => Promise<T>): Promise<T>;
withPhase2Read(queryable, action: (queryable: Queryable) => Promise<T>): Promise<T>;
verifyPhase2DefinitionSchema(queryable, {compatibility: 'postgres' | 'pg-mem'}): Promise<void>;
assertPhase2Client(client): void;
registerPhase2Undo(client, undo: () => Promise<void>): void; // branded context only
loadVerifiedStoredArtifact(client, bundleHash): Promise<VerifiedStoredArtifact>;
verifyIncomingArtifact(client, canonicalBytes, expectedIdentity): Promise<VerifiedStoredArtifact>;
// VerifiedStoredArtifact is an internal opaque value carrying verified bundle,
// exact canonical bytes, immutable row projection, and verified dependency catalog.
registerVerifiedDefinitions(client, verifiedArtifact): Promise<void>; // new atomic store only
verifyRegisteredDefinitions(client, verifiedArtifact): Promise<number>; // exact count or corruption
replaceDefinitionSelections(client, selectionContext): Promise<void>;
// selectionContext is opaque/module-branded after policy, ownership, membership,
// CAS, and target-event validation; it includes the verified artifact and event tuple.
activationPolicySnapshot(policy): Readonly<{environment: string; allowedProfiles: readonly string[]}>;
assertDefinitionSelectionAllowed(policy, verifiedArtifact): void;
validateHistoricalPolicySnapshot(canonicalSnapshotText, verifiedArtifact): void;
collectDefinitionChecks(queryable, {activationPolicy}): Promise<InvariantCheck[]>;
// InvariantCheck conforms to the existing {name,lhs,rhs,drift,ok,...safeDetails} shape.
```

Keep helpers that grant authority module-private where possible; where cross-module exports are necessary, require the opaque active context and never export a context constructor that arbitrary request code can forge. Return no mutable parsed bundle from a public API. Tests inspect database state or safe public output rather than relying on mutation-capable production test hooks.

#### Task 3 prerequisite checkpoint

- [ ] Record Task 2's approved authored commit `09ccf7f705008bf8b91eb16fc70f6a0cf991eb1d` and the controller's completed clean-baseline verification, then reread its final `canonical.js`, `corpus.js`, `economy-profile.js`, `tools/content.js` build-index contract, and focused tests. Compare against the amendment's verifier call, owned definition preimages, numeric versions, emitted ordinals, exact catalog, seven domains, and production profile. A differing approved contract requires editing this amendment before coding.
- [ ] Record this approved amendment, atomic lifecycle, and 3.1 → 3.2 → 3.3 dependency chain in the existing Phase 2A SDD ledger. Retain prior Task 2 review evidence and the existing plan/workspace identity.
- [ ] Record dirty files and the start commit. Preserve Task 2 and unrelated user changes. No implementer stages the whole repository. PostgreSQL execution uses an explicit disposable database/schema or newly task-owned cluster; the existing local service is not implicitly disposable.

#### Task 3.1: six-table schema and atomic registry/definitions

**Files:** Create transaction boundary, internal artifact-storage, artifacts, itemdefinitions, fixture/schema/definition tests; modify schema, db compatibility/verification, `package.json`, `SPEC.md`, `MARKETING-POSTS.md`, and justified `test/gates.js` declarations. Activation implementation and invariant wiring wait for 3.2/3.3, though all six tables are created now so FKs are reviewed together.

**Consumes:** Approved `verifyStoredBundleBytes`, `parseAuthoredJson`, `canonicalBytes`, `hashFrame`, `HASH_DOMAINS`, `PHASE2_LIMITS`, `dbCaps`, `makeDb`, `registerPgMemCompatibility`, and `GameError` conventions.

**Produces:** `storeSealedBundle`, verification-only `registerItemDefinitions`, intrinsic `definitionByHash`, private exact membership/registration helpers, `withPhase2Transaction`, `withPhase2Read`; the full schema needed by 3.2. `activeDefinition` may be added with its actual selection behavior in 3.2; do not ship a placeholder implementation.

- [ ] **1. Write fixture builders and failing clean-schema contracts.** Test fixtures compile only in tests via discovered temporary package roots. Start with an empty production library (`omerta.phase2.registry`, version 1, `phase2_economy`, definitions/nodes/edges/exports/dependencies/imports empty); a concept-only revision containing `note` definition version 1; and a production material fixture based on `test/fixtures/phase2/compiler/valid-core`. A fixture authority copy must be compiled using explicit fixture discovery, not by editing the sealed authority field. `compileFixture` returns sealed bytes, bundle, five-field trusted identity, and safe expected definitions. Assert all six exact table names and column types, exact unique/FK column order, named checks, and portable hash check behavior. For direct SQL tests, copy a fully valid row and change one field only; run each failure in its own transaction/schema.

- [ ] **2. Run red schema tests.** Run `node test/phase2-definition-schema.js`. Expect a missing table/module assertion, not an unrelated fixture compiler error. Capture the first real failure in SDD evidence.

- [ ] **3. Implement the six tables and translate compatibility.** Use the amendment's explicit columns/names/constraints. Store scope sets as canonical JSON TEXT constrained to the sixteen sorted subsets: `[]`, `["account"]`, `["character"]`, `["organization"]`, `["project"]`, `["account","character"]`, `["account","organization"]`, `["account","project"]`, `["character","organization"]`, `["character","project"]`, `["organization","project"]`, `["account","character","organization"]`, `["account","character","project"]`, `["account","organization","project"]`, `["character","organization","project"]`, and `["account","character","organization","project"]`. Check compiler/text/numeric and hash bounds independently. Preserve `NULL` omission versus `[]`. Test full PostgreSQL translate behavior on deletion, positional replacement, duplicate source characters, and NULL propagation; SQL strictness must match PostgreSQL. Add `verifyPhase2DefinitionSchema` immediately after schema DDL and before generic column migrations in `migrateSchemaUnderLock`, with the exact `compatibility` values already used there (`'postgres'` and `'pg-mem'`). PostgreSQL verifies six table shapes and named constraint/index catalog entries, throwing `content_registry_schema_invalid` on mismatch; pg-mem validates through clean schema/direct-constraint tests, without claiming catalog parity. Apply the full schema twice. Do not change legacy tables or rely on generic column migration to add constraints.

- [ ] **4. Run green schema tests.** Run `node test/phase2-definition-schema.js`, then `node test/migrate.js`. Expect all pass; if pg-mem cannot enforce a required check/FK, fix only its compatibility layer or raise the concrete unsupported construct to the controller. Never weaken the PostgreSQL contract. Schema error mapping applies only after DDL reaches the verifier: preserve earlier native boot DDL errors and test that no startup success/stamp occurs, without an error-swallow/remapping layer.

- [ ] **5. Write failing public identity and lifecycle tests.** Assert these exact outcomes:

| Fixture/action | Required result and durable state |
|---|---|
| Store valid empty library | count 0; artifact plus revision-zero placeholder; zero definitions/memberships/events/selections; register reports replay. |
| Store one owned concept | count 1; one intrinsic and membership; no selected definition yet. |
| Store identical bytes again with another audit operator | replay true; byte-identical rows, original audit preserved. |
| Missing/extra/array/accessor identity, numeric version string, invalid hash | `bad_content_request`; zero SQL writes. |
| Valid bytes with wrong trusted ID/version | `content_artifact_conflict`; unchanged database. |
| Mutated bytes, noncanonical whitespace, mismatched trusted hash | original verifier code; unchanged database. |
| Same hash with corrupted existing bytes/projection | `content_registry_corrupt`; no repair. |
| Same namespace/package version with different valid bundle hash | `content_bundle_version_conflict`; unchanged database. |
| Store R1(definition v1), then R2(same v1, new bundle version) | two memberships, exactly one intrinsic row. |
| Store R1(v1), R3(v3), then previously unseen R2(reuses exact v1) | success, two intrinsic rows, third bundle gets old exact v1 membership. |
| Store R3(v3), then R2(new v2 intrinsic) | `item_definition_conflict`; no R2 artifact/partial registration. |
| Same logical definition/version, changed immutable semantics | `item_definition_conflict`; no partial artifact. |
| Import exact dependency definition | owned count excludes import; no membership falsely assigned to importing namespace. |
| Delete one membership, then register/store exact artifact | `content_registry_corrupt`; missing row remains missing. |
| Add extraneous membership or change ordinal/count/intrinsic projection | `content_registry_corrupt`; no repair. |
| Intrinsic read absent hash / corrupt bytes | `definition_not_found` / `content_registry_corrupt`, respectively. |

Use literal count assertions, for example:

```js
const first = await storeSealedBundle(pool, fixture.request);
assert.equal(first.definitionCount, 1);
assert.equal(first.replayed, false);
const beforeReplay = await snapshotPhase2(pool);
assert.equal((await storeSealedBundle(pool, fixture.request)).replayed, true);
assert.deepEqual(await snapshotPhase2(pool), beforeReplay);
assert.deepEqual(await registerItemDefinitions(pool, {bundleHash: first.bundleHash}), {
  bundleHash: first.bundleHash, definitionCount: 1, replayed: true,
});
```

`snapshotPhase2` reads all six tables under `withPhase2Read`, sorts rows by primary keys, normalizes timestamps/byte buffers for exact comparison, and excludes sequence counters only; counters may advance without committed rows. Tests never assert that a BIGSERIAL sequence rolls back.

- [ ] **6. Write admission, dependency, version, and optional-field red tests.** Pause pool acquisition immediately after public invocation, mutate caller bytes and identity/operator fields, then release it: stored bytes/hash/audit must equal the synchronous admission snapshot, with no mutation of the caller's copy. Exercise subarray view offsets and reject accessor-spoofed, shared, resizable, detached, and over-limit views before any await/SQL. Build stored A→B→C and a diamond root→B/C→D using valid exact compiler locks; store dependencies first. Assert root gets only its exact closure, one fetch per unique stored hash, root excluded, no unrelated registry bundle or active-pointer substitution. Delete D to get unresolved; corrupt D to get drift; wrong stored authority/hash/version is drift. Valid bundles with an import pin changed to another definition hash must preserve verifier drift rejection. Reject oversized bytes before parsing/SQL, excessive hint arrays before fan-out, and cumulative closure limits as `content_input_limit`. Test package and definition versions 2147483648 and 9007199254740991 round-trip without truncation; 0, -1, 1.5, negative zero, strings, and 9007199254740992 fail before persistence. For concepts, compile one fixture per optional field alone (family, tags including empty, rarity, stackable=false, trade tuple, owner scopes including empty, quality, maximum quantity, conservation, metadata), then combinations with unrelated fields omitted; assert safe output and SQL NULL match exact presence. Material/item missing any required field must fail the compiler. Test every closed vocabulary and 1000000/1000001 quantity boundary.

- [ ] **7. Run red API tests.** Run `node test/phase2-definitions.js`; record expected missing entry point/lifecycle assertions. Keep fixtures valid at compiler boundaries so a test cannot pass because registration was never reached.

- [ ] **8. Implement minimal atomic store and intrinsic reads.** Synchronously snapshot validated own request values and owned bounded bytes before the first await; retain that private snapshot throughout verification/store/replay. Add the branded transaction/read module; implement bounded stored verification, exact projection comparison, placeholder lock, existing intrinsic replay before maximum-version comparison, and complete insertion. Persist canonical definition preimage bytes and compare recomputed existing domain hash, semantic projection, and package ownership. `registerItemDefinitions` reloads/verifies and returns only complete replay. Internal helpers never begin/commit. Store and read return only safe projections. Do not call compiler/discovery/file/network loaders outside tests.

- [ ] **9. Write controlled failure/interleaving tests before completing boundary behavior.** A test-only pool wrapper forwards normal SQL to the underlying pool, records statements, and can pause/throw before or after a chosen write occurrence. It must preserve client release and backend capabilities. Fail after placeholder, artifact, each newly inserted intrinsic, and each membership write. After rejection compare all six tables with the exact before-snapshot, including pre-existing reused versions and placeholders. Start another reader through a forwarding alias while a writer is paused: it must remain pending until compensation/commit finishes. Start a writer only after a reader's first query completes: it must remain pending through the reader's second query and callback return. Test read-inside-own-branded-context without deadlock, nested public mutation rejection, pool.query facade rejection, and gate release after ordinary failure. In a child process, inject undo failure, assert `content_registry_recovery_required`, then assert subsequent Phase 2 reads/writes fail closed; dispose that child database/process.

- [ ] **10. Implement missing compensation/read/SQLSTATE behavior, then run green.** Use scoped inverse operations recorded before writes and rollback/recovery ordering from the amendment. No blanket snapshot restore or global pg-mem backup, because it could erase unrelated work. Test mapping synthetic 40001/40P01/55P03 and confirmed rollback 57014 to `contention`, 23503/23514/23502/25P02 to registry corruption, and ambiguous COMMIT to `content_commit_unknown`; test actual PostgreSQL semantics in 3.3. Run `node test/phase2-definitions.js`, `node test/phase2-definition-schema.js`, `node test/phase2-compiler.js`, `node test/migrate.js`, and `node test/items.js`. Capture red/green evidence.

- [ ] **11. Register suites and refresh measured integration declarations.** Add literal `node test/phase2-definition-schema.js` and `node test/phase2-definitions.js` once to `pretest` now; do not defer wiring to 3.3. The fixture helper under `test/lib` is not a root suite. Recompute SPEC backend/test file and line counts using the same recursive `walkSrc`/line measurement as `test/docs.js`; recompute MARKETING's runnable-suite count from the distinct test/tools paths literally present in `pretest` plus `test`. Do not conflate helper-file census, root-suite census, and runnable-chain census. Classify each new module-scope WeakMap/WeakSet using its actual per-context/DB-backed safety property; declare new SQL interpolation only when its shape comes from a fixed reviewed allowlist, otherwise use parameterized SQL. Run `node test/gates.js` and `node test/docs.js`; fix justified integration drift without gate exemptions or threshold weakening.

- [ ] **12. Fresh reviews, controller verification, controller commit.** Implementer reports changed files, interface decisions, tests, and remaining risks without committing. Fresh spec reviewer checks exact amendment coverage; different fresh quality reviewer checks SQL constraints, authority boundaries, rollback/read semantics, dependency limits, and justified gate declarations. Fix and re-review all Critical/Important findings. Controller runs focused schema/definitions/compiler/migrate/items tests plus `node test/gates.js` and `node test/docs.js`, inspects diff, then explicitly stages only 3.1 files and commits `feat: atomically register sealed item definitions`. Record accepted interfaces for 3.2.

#### Task 3.2: trusted activation policy and exact CAS selection

**Files:** Create activation-policy and activation tests; modify artifacts/itemdefinitions, fixture helper, `package.json`, `SPEC.md`, `MARKETING-POSTS.md`, and justified `test/gates.js` declarations; adjust transaction module only for a demonstrated activation requirement. No invariant production wiring yet.

**Consumes:** 3.1 complete stored registry, branded transaction/read context, immutable verified artifact and membership helpers, six tables.

**Produces:** `createActivationPolicy`, `activateStoredBundle`, complete `activeDefinition`, policy snapshot/history helpers, and private branded selection replacement. No public selection mutation bypass.

- [ ] **1. Write policy red tests.** A valid `{environment:'test',allowedProfiles:['phase2_economy']}` selects a complete production library even when `activatable=false` and a production experience. Factory rejects unknown keys, invalid environment/control strings, unknown/duplicate profiles, and nonarrays; empty allowlist is valid deny-all. Mutating original arrays after factory creation has no effect. Mutate the activation request's target/CAS/operator fields while acquisition is paused: execution must use the synchronous admission snapshot. Plain objects, JSON clones, fabricated brands, frozen lookalikes, and authored/request environment fields cannot authorize. Fixture artifacts and deny-all policy return `content_activation_policy_denied` without any event/pointer/selection changes. Invalid policy returns `content_activation_policy_invalid`. No library selection appears on the legacy content board.

- [ ] **2. Write exact CAS table tests.** Start with stored A/B/C in one namespace and valid policy. Inspect event count, event exact fields, namespace pointer, selected definitions, and returned revision/event string after every step:

| State/action | Expected |
|---|---|
| never selected → A with (0,null) | revision 1, one event, replay false |
| A@1 → A with (1,A) | same event/revision, replay true |
| A@1 → A with (0,null) | same event/revision, replay true (ambiguous initial retry) |
| A@1 → B with (1,A) | revision 2, event prior A/its exact lock |
| B@2 → B with (1,A) | replay true |
| B@2 → B with (0,null) | conflict |
| B@2 → A with (2,B) | revision 3, deliberate rollback allowed |
| A@3 → A with old (0,null) or (1,A) | conflict (ABA) |
| A@3 → A with (2,B) | immediate-predecessor replay true |
| Target another namespace, wrong prior hash, invalid/null pair | request/conflict error; unchanged rows |
| Current revision MAX_SAFE → different target | `content_activation_conflict`; no overflow/event |

Representative assertion contract:

```js
const first = await activateStoredBundle(pool, requestA0, policy);
assert.equal(first.activationRevision, 1);
assert.equal(first.replayed, false);
const retry = await activateStoredBundle(pool, requestA0, policy);
assert.equal(retry.eventId, first.eventId);
assert.equal(retry.replayed, true);
await assert.rejects(() => activateStoredBundle(pool, staleA0AfterABA, policy),
  error => error.code === 'content_activation_conflict');
```

- [ ] **3. Write selection completeness and dependency-independence red tests.** B removes one A definition, adds one, and preserves another exact version. After selection, namespace set must equal B exactly; another namespace is unchanged. Selecting an empty valid bundle clears only this namespace's selections. Old exact hashes still resolve; intrinsic reads carry no arbitrary bundle hash. Inject absent membership, mismatched event/pointer/version, or foreign package selection to assert `definition_inactive` for corrupt selected reads and fail-closed activation. Missing active selection returns null. Remove/mutate temporary source directories after ingestion; activation still succeeds from stored bytes. Select another version of a dependency elsewhere; target uses its exact pinned stored dependency regardless. Missing/corrupt pinned dependency blocks even same-target replay.

- [ ] **4. Run red tests.** Run `node test/phase2-activation.js`; expect absent policy/activation or incorrect CAS assertions. Record evidence.

- [ ] **5. Implement policy and activation.** Factory validates/copies/freezes/brands trusted config. Store canonical snapshot of exactly `{environment,allowedProfiles}` and exact report map on every real event. Within one owned transaction, placeholder insert/lock/re-read, verify target/closure/membership, assert policy and namespace, evaluate CAS/replay, insert event, replace namespace selections, update pointer last. Verify policy on replay too. The selection helper accepts only a module-issued context associated with this active client/event; reject forged or cross-transaction context. Return event ID as string and safe revision Number. Existing audit metadata is not rewritten on replay.

- [ ] **6. Write and pass every-write activation recovery tests.** Pause/fail after placeholder, event, deletion of former selections, each inserted/updated selection, and pointer update. Exact six-table snapshots must be restored before rejection, preserving original events/operator metadata. Run reader-during-paused-writer and writer-after-reader-first-query tests through different aliases for `activeDefinition` and namespace snapshots. For a COMMIT response lost after successful commit, retry the exact CAS and assert original event replay, not a second event; for a confirmed pre-commit abort, exact retry performs the one valid transition. Current-policy denial on an otherwise replayable request must remain denial. Run `node test/phase2-activation.js`, `node test/phase2-definitions.js`, `node test/content-runtime.js`, and `node test/items.js`.

- [ ] **7. Register activation suite and maintain integration gates.** Add literal `node test/phase2-activation.js` once to `pretest` immediately. Recompute SPEC recursive module/test/line counts and MARKETING distinct runnable-chain suite count from the final tree and scripts. Add only justified declarations for any new module-scope policy/selection brands or fixed SQL interpolation shapes, using the existing gate classifications. Run `node test/gates.js` and `node test/docs.js`; preserve existing tests and unrelated census claims.

- [ ] **8. Fresh reviews, controller verification, controller commit.** Fresh spec reviewer checks the full CAS decision table and profile/legacy boundary; different quality reviewer checks first-use locks, event FKs, no standalone mutation bypass, policy brand, state restoration, safe projections, and gate declarations. Resolve all Critical/Important findings. Controller reruns activation/definitions/schema/content-runtime/items tests plus `node test/gates.js` and `node test/docs.js`, and commits only scoped files as `feat: select stored definitions with audited CAS`. Record final API for 3.3 and Task 4.

#### Task 3.3: invariants, PostgreSQL evidence, migration and compatibility closure

**Files:** Create definition-invariants and invariant tests; modify invariants; create/extend `test/phase2-postgres.js`; add focused package commands and existing CI PG16 lane; update `SPEC.md`, `MARKETING-POSTS.md`, and justified `test/gates.js` declarations. Modify schema/db only for an evidenced contract defect, with targeted earlier rechecks. No production activation operator wiring.

**Consumes:** Reviewed 3.1 registry and 3.2 policy/CAS plus existing `runLedgerInvariants` report shape and repeatable-read wrapper.

**Produces:** Complete gated Phase 2 invariant report, explicit PostgreSQL migration/concurrency evidence, repeatable commands and Task 3 closure for Task 4.

- [ ] **1. Write invariant red matrix.** A clean legacy database with no positive Phase 2 pointer succeeds with missing policy. Register-only placeholders also need no live policy. Select a valid bundle with valid policy and assert all seven new check names pass. With selected state and null/invalid policy, only the policy requirement fails if other data is coherent and the entire existing report still returns. Keep historical event snapshot valid, pass deny-all current policy, and assert history passes/current drift fails. Corrupt each of these separately: artifact bytes/hash/metadata/report map; intrinsic canonical bytes/semantic column; missing/extra/misordered membership; artifact definition_count; mismatched event target/previous lock/version/IR/profile/report; noncanonical/unknown-key historical policy; missing revision/event; wrong predecessor; current pointer/event mismatch; missing/extra/foreign/current-generation selection; fixture selected. Assert the relevant named check fails without leaking raw bytes. Bypass SQL constraints only inside a disposable deliberate-corruption harness; direct SQL check-rejection tests remain separate from invariant drift tests.

- [ ] **2. Write invariant coherence tests, then run red.** Pause invariant callback after its first Phase 2 read; begin a writer through another pool alias and prove writer remains pending until all checks finish. Also start invariants during a paused writer and prove no transient violation leaks after successful commit or compensation. A nested internal read must not deadlock. Assert alert work occurs after snapshot/gate release. In a private real-backend test client, reject BEGIN REPEATABLE READ; assert the failure propagates, the client is released/rolled back, and no collection query runs through that client or a pool fallback. Run `node test/phase2-definition-invariants.js` and capture the expected missing-check/policy/signature failure.

- [ ] **3. Implement bounded complete checks and optional injection.** Add `activationPolicy=null` to the wrapper, pass it to Phase 2 collector, and wrap collection in `withPhase2Read`. Replace the existing broad BEGIN fallback with explicit backend selection using established `dbCaps`: pg-mem uses the gate directly, while PostgreSQL starts repeatable-read/read-only and propagates snapshot-start errors without collecting unsnapshotted results. Collect safe named check failures instead of throwing away the report on compiler drift after a valid snapshot starts. Verify exact historical snapshot independent of today's policy. Keep the existing caller behavior with no active Phase 2 rows. No startup/route change is necessary because Task 3 exposes no production activation path; future activation integration must explicitly inject trusted policy and is not silently authorized here.

- [ ] **4. Run green invariant and compatibility tests.** Run `node test/phase2-definition-invariants.js`, `node test/phase2-activation.js`, `node test/phase2-definitions.js`, `node test/content-runtime.js`, `node test/content-crafting.js`, `node test/content-crafting-jobs.js`, `node test/content-crafting-tools.js`, `node test/content-exchange.js`, `node test/items.js`, `node test/crafting.js`, `node test/mysteries.js`, `node test/operations.js`, `node test/belladonna.js`, and `node test/worldgraph-api.js`. These existing script names were resolved from the repository. Take before/after snapshots of legacy `content_bundles`, `content_activations`, pinned content instances, Bellini exact-hash inventory/skill/work-order/tool/exchange rows, generic Phase 1 inventory/replay, and all currency/ledger counts. Phase 2 store/select/invariant operations leave them equal. Execute legacy R2→R1 activation rejection through existing API and preserve its error, while Phase 2 permits correct-CAS rollback.

- [ ] **5. Write a fail-closed disposable PostgreSQL harness and first red run.** `node test/phase2-postgres.js --definitions` requires `TEST_DATABASE_URL`, validates explicit postgres/postgresql scheme and nonempty database, creates a UUID-owned private schema, and drops only that exact owned schema in cleanup. Do not print the DSN. Initialize real backend capabilities via `makeDb` in a child process/environment constrained to this test schema before independent pool clients are used; assert `dbCaps.skipLocked===true`. Keep pg-mem and PostgreSQL suites in separate processes because capabilities are global. No missing-DSN success/skip path. Seed legacy schema without the six new tables, apply current schema under the boot advisory-lock path twice, and compare legacy rows/catalog constraints. Record first genuine missing matrix assertion as red; unavailable access is an explicit unpassed required gate.

- [ ] **6. Implement and run PostgreSQL migration/constraint evidence.** Record exact server version in evidence. The task-owned isolated PG18.4 lane can satisfy this required real-backend gate; PG16 is the CI target, with wiring verified and runtime labeled unexecuted locally unless available. Do not require a push or claim a remote CI execution. On clean and populated upgraded schemas verify all six tables and named `pg_constraint` definitions, including exact membership FK target triple, namespace/event tuple FKs, BIGINT bounds, uppercase/nonhex hash rejection, nullable concept tuple acceptance, material tuple denial, and quantity/scope constraints. A direct invalid insert must fail with the expected SQLSTATE and named constraint. Apply upgrade twice with zero legacy hash/pointer/pin changes. Use two partial-schema regressions: a missing non-FK scalar check that allows DDL to finish must yield verifier `content_registry_schema_invalid`; a pre-existing artifact table lacking the unique target required by a newly created FK must preserve its native DDL failure (42830 for that fixture), never reach the verifier, and never report/stamp startup success. Do not add blanket DDL-error translation. Snapshot old exact definition reads across selection changes to substantiate pin persistence without pretending future lots/jobs exist.

- [ ] **7. Implement and run independent-client race evidence.** Use deferred barriers on separate PostgreSQL clients, not the pg-mem serial gate. Test all of:

| Race | Required committed outcome |
|---|---|
| First-use same artifact store | one complete artifact/definition set, second exact replay; one placeholder |
| Same package version, different bundle bytes/hash | one winner, one bundle-version conflict; no orphan intrinsic/membership |
| Different bundles reusing same intrinsic version | both may commit, one intrinsic row and both memberships |
| New definition v1 versus new v2 | v1-then-v2 may both commit; v2-then-v1 rejects new lower v1; highest committed state coherent |
| Exact old existing intrinsic membership versus newer registration | both may commit; no replay rejected solely because newer exists |
| First selection, same target/same (0,null) | one event, one success plus one exact replay |
| Same namespace/different targets/same expected pair | one event/winner plus one activation conflict |
| Different namespaces | independent correct commits, no inappropriate global PostgreSQL serialization |
| A→B→A plus stale original request | stale conflict, no extra event |

Capture disposition by stable codes and table/event counts, not timing guesses. Each concurrent branch awaits its own result and every failure leaves no partial rows.

- [ ] **8. Implement PostgreSQL rollback, timeout, MVCC, and recovery evidence.** Inject a client-side error after each store/activation write and a server error late in the transaction; all six table rows equal their pre-call snapshots after rollback. Record zero compensation SQL on the real backend. Hold a namespace lock on one client and force a short test-only lock_timeout on another; expect 55P03→contention after rollback. Exercise statement_timeout 57014, a real serialization failure 40001, and deterministic test-owned two-lock deadlock 40P01; assert connection released/reusable and no partial mutation. Unknown constraint errors must not become replay/contention. Force a lost COMMIT response after the server commits via a test client wrapper, then use a fresh connection and exact request to prove replay. Begin a repeatable-read invariant snapshot, commit a writer on another connection between queries, and prove coherent old-snapshot results; a subsequent run sees coherent new state. PostgreSQL writers must proceed without a JavaScript global read gate.

- [ ] **9. Review query indexes with realistic cardinality.** Seed task-owned synthetic registry rows consistent with valid templates at sufficient size to distinguish scan plans; `ANALYZE`. Capture `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` for bundle-hash lookup, namespace/version conflict lookup, intrinsic ID/max-version lookup, membership-by-bundle, event namespace/revision, selection-by-package, and selected-definition exact join. Assert indexes exist and predicates match their leading columns; review planner output rather than forcing index scans or asserting one fragile cost/plan node for tiny tables. No unexplained unbounded registry scan in the hot store/selection path. Full invariants may intentionally scan the registry with bounded diagnostics.

- [ ] **10. Wire reproducible local/CI gates.** Add literal `node test/phase2-definition-invariants.js` once to `pretest` when creating that suite; retain the three literal suite entries already installed by 3.1/3.2. Add the optional focused convenience command `phase2:definitions:check` chaining those four scripts for direct controller runs, and `phase2:definitions:postgres` invoking `node test/phase2-postgres.js --definitions`; wire the PostgreSQL script into the existing PG16 service lane in the same subtask so no root suite is orphaned. `test/gates.js` and the MARKETING census inspect literal paths, not transitive npm-script calls: do not replace the pretest literals with only a nested convenience invocation, or invoke both and duplicate tests. Any consolidation must prove scanner coverage and exactly-once execution. Missing PostgreSQL DSN fails. Preserve later Task 5/8/10 extensions of the PostgreSQL file through explicit `--definitions` and unknown-option rejection. Refresh measured SPEC/MARKETING census (including actual returned invariant-check count) and justified module/SQL declarations. Run both focused commands, compiler/migration/compatibility tests, `node test/gates.js`, `node test/docs.js`, and `npm run invariants` with DATABASE_URL absent for the clean pg-mem fixture. Keep local/PostgreSQL modes in separate processes.

- [ ] **11. Fresh closure reviews, controller verification, controller commit.** Fresh spec reviewer traces every amendment acceptance requirement to retained evidence. Different quality/security/PostgreSQL reviewer examines named constraints, actual real-backend race results, timeout mapping, compensation absence, full read-gate scope, historical/current policy separation, compatibility snapshots, and test/gate/census integration. Fix/re-review all Critical/Important findings. Controller reruns focused local/PostgreSQL commands, relevant compatibility suites, `node test/gates.js`, and `node test/docs.js`, inspects all changes and CI integration, then commits scoped files as `test: close immutable definition registry invariants`. Mark Task 3 complete and release Task 4 only after required PostgreSQL evidence is passed; retain an unavailable required environment honestly if it prevents closure.

#### SQLSTATE and recovery oracle for every test lane

| Condition | Stable result | Required recovery disposition |
|---|---|---|
| Bad closed public input | `bad_content_request` | No writes |
| Root not stored | `content_artifact_not_found` | No writes; caller may supply the correct registered hash |
| Missing/drifting dependency | Existing compiler unresolved/drift code | No repair or substitution |
| Root stored metadata/membership corruption | `content_registry_corrupt` | Stop this operation; no automatic repair |
| Definition ID/version conflict or unregistered lower version | `item_definition_conflict` | No partial artifact/membership |
| Namespace/version conflict | `content_bundle_version_conflict` | No partial artifact/membership |
| Incoming verified identity/hash collision | `content_artifact_conflict` | No replay of incompatible state |
| CAS/ABA/overflow | `content_activation_conflict` | Refresh observed pair; do not silently rewrite original CAS |
| 40001, 40P01, 55P03; 57014 with confirmed rollback | `contention` | Rollback/release first, bounded caller retry of same logical request |
| 23505 on named artifact/definition identity unique | Exact replay or corresponding semantic conflict | Fresh read after rollback; never query through aborted transaction |
| Other 23505; 23503, 23514, 23502, 25P02 | `content_registry_corrupt` | No broad retry/replay classification |
| Lost COMMIT/rollback outcome | `content_commit_unknown` | Discard broken client, reconcile exact request on new connection |
| pg-mem inverse failure | `content_registry_recovery_required` | Poison Phase 2 access until task-owned test process/database replaced |

For raw schema tests, assert actual SQLSTATE/constraint directly; for repository API tests, assert safe mapped errors. Return safe current revision/hash on CAS conflict only if consistent with the existing `GameError` envelope. Never expose bytes, raw SQL, DSNs, compiler private inputs, or unbounded diagnostics.

### Task 4: Add dormant lot-authoritative primitives and normalized lineage

**Contract:** [Lot Integration Amendment](../specs/2026-09-07-world-graph-phase-2a-lot-integration-amendment.md). This approved downstream contract supersedes conflicting Task 4–5 assumptions and preserves the binding Task 3 amendment. Continue this existing plan through 4.1 → 4.2 → 5.1 → 5.2 → 5.3, with no alternate implementation plan or workspace. Task 4 adds internal capabilities only; the shared legacy caller lock order and inventory authority switch together at Task 5.3.

#### Tasks 4–5 common constraints

- Complete Task 3.1–3.3 and their existing review and verification gates before Task 4 execution; this plan does not assert that they have started or passed.
- Preserve Task 3's exact public interfaces, separate brand, six-table registry, definition vocabulary, hashes and policy; do not reopen the compiler or invent definitions.
- Every value mutation runs in one branded database transaction and stores its domain guard, normalized inputs/outputs, assets, events, and replay result atomically.
- `item_lots` plus `item_instances` become the only generic item authority after a fenced, reconciled cutover; Bellini `content_inventory_lots` remain isolated and gameplay-inert.
- Lots never physically coalesce; aggregate reads group only identical economic dimensions and consumption is canonical FIFO unless a server-issued action binds an exact lot.
- OMR movement is absolutely forbidden; no cash source is introduced; normal inventory remains off-chain; no NFT transition or contract is added.
- Exact definition `maximumLotQuantity` remains bounded by 1,000,000. Legacy aggregate compatibility remains bounded by 2,147,483,647. Migration preserves every legal quantity using deterministic chunks.
- Preserve historical completed legacy replay before new mutable-authority resolution; permanent semantic results remain in the existing guard table.
- No Task 4 runtime switch may expose mixed lock orders or dual writable inventory. Task 5.3 is the coherent live convergence boundary.
- The approved lot-integration amendment selects the exact Crew prefix with targeted invite-acceptance hook convergence and binds the aligned program/cross-cutting/later-spec precedence. Broad lifecycle alternative B is not selected.
- Do not merge, push, deploy, activate a production bundle, activate seasonal OMR, or deploy NFT contracts.
- Each increment adds its suites to `pretest` or the explicit PostgreSQL lane immediately, updates measured census/gate declarations, passes fresh spec review then a different fresh quality/security/PostgreSQL review, and receives controller verification before a scoped commit. Design approval does not replace any of those implementation gates.

#### Tasks 4–5 file ownership and responsibilities

| File | Owner and responsibility |
|---|---|
| `src/items.js` | 4.1: internal item brand/token/ordinal bridge, legacy/v2 replay envelopes, whole-read gate and recovery; 5.3: legacy storage delegation. |
| `src/itemlots.js` | 4.2: exact definition admission, lot operations, normalized IO/projections; 5.3: compatibility backing. |
| `src/item-lock-trace.js` | 4.1: dormant shared canonical trace and candidate-plan checks; 5.3: all shared caller instrumentation. |
| `src/itemmigration.js` | 5.2: deterministic receipts/chunks, epoch/fence/schema validation and reports. |
| `src/itemcompatibility.js` | 5.1: verified map admission; 5.3: bounded pinned holdings selection and unchanged legacy board projection. |
| `schema.sql`, `src/db.js` | 4.1/4.2 additive schema; 5.2 staged populated-table migration, backend initialization, epoch/trigger verifier; 5.3 boot cutover integration. |
| `src/invariants.js` | 4.2: branch-aware lineage/conservation under composed read protection; 5.2/5.3: epoch opening and migration reconciliation. |
| `content/compatibility/phase1-item-definitions.json` | 5.1: exact legacy aliases mapped to verified qualified IDs/hashes. |
| `content/packs/phase2-phase1-compatibility/pack.json` | 5.1: explicit production compatibility library, built with the existing corpus command. |
| `src/crafting.js`, `src/mysteries.js`, `src/operations.js`, `src/routes/worldgraph.js` | 4.1: only crafting cash audit's pre-insert inverse; 5.3: complete candidate selection, lock convergence, preserved replay and recovery. |
| `src/crew.js`, `src/server.js` | 5.3: trusted target-Crew hooks for invite acceptance and existing Crew prefix integration; no unrelated lifecycle refactor. |
| `src/game.js` | 4.1: optional trusted before-primary-ledger-insert hook only; 5.3: inspect/preserve accrual's explicit no-late-Crew-write behavior; no new Crew update. |
| `tools/backup.sh`, `tools/backup-selftest.sh` | 5.2: required authority tables, linked restoration fixtures and corruption/omission rejection. |
| `test/lib/phase2-item-fixtures.js` | 4.1: explicit fixtures, branded callbacks, SQL boundary injection and snapshots; no runnable root-suite registration. |
| `test/phase2-lot-boundary.js`, `test/phase2-lots.js`, `test/phase2-lots-property.js` | 4.1/4.2: envelopes, gates/recovery, primitives and stateful conservation. |
| `test/phase2-compatibility.js`, `test/phase2-migration.js`, `test/phase2-inventory-convergence.js` | 5.1/5.2/5.3: verified compatibility, cutover, complete consumer regression. |
| `test/phase2-postgres.js` | Extend the Task 3 suite without replacing its modes; explicit `--lots` and `--migration` lanes. |
| `package.json`, `.github/workflows/ci.yml`, `test/gates.js`, `SPEC.md`, `MARKETING-POSTS.md` | Owned by every increment that adds suites/files/SQL declarations; preserve exactly-once runnable suite execution. |
| `src/routes/worldgraph-phase2.js`, scoped `src/server.js` hook, `test/phase2-api.js` | **Task 8**, outside Task 4–5 execution: Phase 2 action-scoped transport and public exact-lot detail. |

The names of new modules and fixture helpers above are downstream additions, not claims of already implemented exports. Task 3 files are consumed through their reviewed interfaces; these increments do not change them to accommodate a lot adapter.

#### Task 4.1: Shared root, permanent replay, and coherent item boundary

**Files:** Modify `src/items.js`, `schema.sql`, `src/invariants.js` collection wrapper, `src/crafting.js` cash inverse, `src/game.js` primary ledger identity hook, and wiring/census files; create `src/item-lock-trace.js`, `test/lib/phase2-item-fixtures.js`, `test/phase2-lot-boundary.js`; extend `test/phase2-postgres.js --lots`.

**Consumes:** Existing `withItemTransaction(pool, callback)`, `withItemMutation(client, owner, kind, key, request, callback)`, `registerItemTransactionUndo(client, inverse)`; Task 3 `withPhase2Read(queryable, callback)`; established `dbCaps`.

**Produces:** Contract Section 2's `assertItemTransaction`, `itemMutationContext`, `nextItemMutationOrdinal`, `poisonItemTransaction`, `withItemRead`, and `withLotMutation` signatures. `createItemLockTrace()` records `{className, subtype, key, id, generation}` and throws on an unapproved class/subtype, decrease or late lower member. Guard envelope discriminator, immutable v2 authority snapshot, UUID identity and permanent result schema become dormant downstream capabilities.

- [ ] Add and immediately wire `test/phase2-lot-boundary.js`. Extend the existing PostgreSQL mode dispatch without executing its definition mode twice. Update measured census and justified declarations in the same increment.
- [ ] Add explicit fixture helpers to `test/lib/phase2-item-fixtures.js`: `withItemFixture(callback)` provides `{pool, accountOwner, definition, snapshot}` from the existing disposable fixture database and verified Task 3 fixture artifact; `snapshot()` returns ordered registry/guard/legacy item/event rows available at this increment. It requires no deployment or compatibility-map type. `injectSqlFailure(pool, {table, occurrence, timing})` returns a forwarding pool plus `restore()`, with timing exactly `before` or `after`; callbacks use production entry points rather than a forged client brand. The fixture cannot infer a disposable production URL. Add lots/IO to its snapshot in 4.2 and add manifest/deployment fixtures only in 5.1/5.2 respectively.
- [ ] Write red tests for one root/token/guard across existing legacy leaves and the new boundary/context/ordinal helpers. A v2 callback can inspect its private context and allocate an ordinal without calling not-yet-produced lot functions. Raw client, fake/expired/cross-client token, nested item transaction, registry-branded client, and swallowed legacy leaf failure all reject. Start these assertions before implementing the bridge:

```js
assert.throws(() => assertItemTransaction(rawClient),
  {code: 'item_transaction_required'});
assert.throws(() => itemMutationContext(rawClient, {}),
  {code: 'item_transaction_required'});
await withItemTransaction(pool, async (client) => {
  await assert.rejects(() => withItemTransaction(pool, async () => null),
    {code: 'item_transaction_nested'});
});
```

- [ ] Write legacy guard fixtures using the existing key/digest/result encoding. Verify exact replay after character death/replacement, deleted salvage car, changing operation participants and historical cancellation; the fresh callback must not run. Different raw owner/kind remains a legacy conflict. Capture baseline `item_events` and guard count before/after replay and require equality.
- [ ] Give every newly reserved v1/v2 root a server-generated mutation UUID, with fresh `itemMutationContext` returning that same stored UUID throughout the callback. Preserve historical null-ID v1 rows byte-for-byte on replay, without callback entry or extra guard/event writes. UUIDs never enter the legacy key/digest/result/event-key encoding; v1 normalized IO remains dormant. Test old-null and new-UUID v1 schema rows plus required v2 UUID identity.
- [ ] Write v2 scope tests for identical account/action/key replay, changed request and every authority dimension conflict, independent account/action scope, occupied legacy hash-key collision rejection, immutable result retention, and commit-before-transport-cache recovery. The action's side-effect counter stays one across matching retries. Do not alter historical HTTP tests or claim new HTTP independence.
- [ ] Write controlled whole-callback read tests: pause a reader between two queries, start a writer through an alias, and prove it cannot interleave; pause a writer after a reversible write and prove a reader through another alias waits through recovery. Repeat across registry/item composed reads in both reader-first and writer-first order. A registry read callback may use item read protection; it cannot start an item transaction on the same snapshot client.
- [ ] Write failure tests at guard insertion, event insertion, external inverse registration, COMMIT acknowledgement loss, rollback failure and inverse failure. An after-write throw must not lose the inverse. PostgreSQL runs no compensation statements; pg-mem inverse failure makes all subsequent aliases reject `item_recovery_required`, including invariant reads. Uncertain PostgreSQL commit is `item_commit_unknown`, reconciled on a fresh connection.
- [ ] Run the new focused suite and its PostgreSQL mode in an explicitly disposable database to establish the expected missing-interface/red failures. Record which assertion fails, not just a nonzero exit.
- [ ] Before implementing the approved owned-client bridge, write tests using distinct forwarded clients and proxies, not only native pg-mem's same-object pool/client. Prove successful pinned definition reads inside the item transaction, registry-read-to-item nesting refusal (including the same-object case), item-to-registry-mutation refusal on both backends, exactly one PostgreSQL BEGIN, and release/discard after acquisition or BEGIN fails before the inner callback. Exercise raw SQLSTATE disposition, COMMIT acknowledgement loss, rollback failure, both gate-order directions, and exact replay through the real transaction owner.
- [ ] Implement the minimal internal bridge in `src/items.js`. Snapshot closed v2 input before awaits; preserve legacy digest code path; reserve one guard; record newly owned reservation intent before possibly successful insertion; remove leaf-local guard cleanup; share the ordinal state. Apply the approved owned-client clarification in Section 4 of the binding amendment: pg-mem checks out one client without BEGIN/writes, enters `withPhase2Read(client, callback)`, acquires the item gate, then owns one item BEGIN. PostgreSQL checks out one client, owns one item BEGIN, and establishes `withPhase2Read(client, callback)` around the entire action/recovery lifecycle; never use a pool-based read-only snapshot or a second BEGIN. Preserve separate private item write authority, reject pre-existing registry-context nesting, and leave the Task 3 APIs unchanged. Retain raw failures and determine recovery/discard inside the item owner before the read wrapper remaps errors; a private outcome carrier may do so without publishing success before cleanup. Release/discard the client even when a gate or BEGIN fails before the callback. Both pg-mem gates remain held through recovery; lost COMMIT remains `item_commit_unknown`, failed compensation remains poisoned `item_recovery_required`.
- [ ] Implement the dormant lock trace and complete candidate-set admission. Include only the approved exact optional Crew prefix, followed by the unchanged suffix. Do not enable the new trace/order for old live consumers before 5.3.
- [ ] Write a causal RED through actual `craftWorldGraphRecipe` when the primary `transactions` INSERT succeeds and its acknowledgement throws. Compare exact cash, ledger, stacks, items, events and guards; same-key retry must execute only once. Then add the narrow internal `ledger(client, record, {beforeInsert} = {})` hook: keep UUID generation inside ledger, validate a supplied hook as a function, await it before the primary INSERT, and preserve default SQL/return/recycle behavior. `debitRecipeCash` registers exact-ID undo through that hook rather than after ledger returns. Test default/no-hook behavior, hook failure with zero audit inserts, pg-mem exact restoration, and PostgreSQL native rollback with zero compensation. Do not duplicate ledger SQL, introduce caller-selected UUIDs, or alter live caller lock order.
- [ ] Verify `node test/phase2-lot-boundary.js`, `node test/items.js`, `node test/crafting.js`, `node test/worldgraph-api.js`, `node test/gates.js`, and `node test/docs.js`. Verify the explicit `--lots` PostgreSQL boundary cases. No production content is activated.
- [ ] Obtain the two independent reviews, fix all Critical/Important findings, reverify the affected evidence and have the controller create the scoped increment commit. Task 4.1 closes only the dormant boundary contract.

#### Task 4.2: Exact lots, shared lineage, and branch-aware invariants

**Files:** Create `src/itemlots.js`, `test/phase2-lots.js`, `test/phase2-lots-property.js`; modify `schema.sql`, `src/items.js`, `src/invariants.js`, fixture helper, `test/phase2-postgres.js --lots`, and immediate wiring/census files.

**Consumes:** 4.1's branded client/token/ordinal/read/recovery interfaces; unchanged Task 3 `definitionByHash(queryable, definitionHash)` and safe `ItemDefinition`; the complete item-key plan and trace.

**Produces:** Contract Section 3's exact `grantLot`, `consumeLotsFifo`, `consumeExactLot`, `splitLot`, `lotInventoryBoard`, `LotProjection`, `LotConsumption`, and `LotBoard`. Creates `item_lots`, `item_mutation_inputs`, `item_mutation_outputs`, versioned event branches, and invariant report checks for lot definition/quantity/custody/lineage and cross-kind output uniqueness.

- [ ] Immediately wire both new root suites; extend the explicit PostgreSQL lot lane and measured census before review.
- [ ] Extend the 4.1 fixture snapshot to newly created lots/IO. Add lot-specific fake/raw/cross-client/expired token and registry-brand rejection tests now that `grantLot` and the other lot leaves are produced in this increment.
- [ ] Write admission tests that accept economic material/item definitions and reject concepts, wrong stackability, mismatched policy hash, unsupported owner/custody lifecycle, invalid quality, non-integral/unsafe quantity, zero/negative quantity, and amounts above the **exact** definition cap. Verify an intrinsic definition never needs or invents `bundleHash`.
- [ ] Write one-dimension-at-a-time identity tests for definition hash, owner, custody, quality state, policy hash, binding, restriction, season/run, expiry/age basis, source cap and provenance class. Safe aggregate groups never combine a differing identity; underlying rows remain distinct even when every dimension matches.
- [ ] Write a deterministic FIFO-versus-lock test with deliberately opposite order: `z-old` created before `a-new`, plus a unique input whose canonical key lies between item subtypes. Require the lock sequence to use the approved canonical comparator while allocation consumes `z-old` first. A second recipe requirement must not discover an earlier key after the first leaf. An injected candidate change yields `contention` and zero writes, then same-key retry recomputes the full set.
- [ ] Write split and lineage checks: a parent 10 split by 3 has parent remaining 7 and child 3; immutable identity/source/age basis is unchanged; child creation timestamp is new; the source input and child output reference distinct shared ordinals linked explicitly. Lot/unique outputs cannot collide on `(mutation_id, output_ordinal)`.

```js
assert.equal(parentAfter.remainingQuantity + child.remainingQuantity, 10);
assert.equal(child.originalQuantity, 3);
assert.equal(child.definitionHash, parentBefore.definitionHash);
assert.equal(child.ageBasis, parentBefore.ageBasis);
assert.equal(child.sourceInputOrdinal, splitInput.inputOrdinal);
assert.notEqual(child.outputOrdinal, splitInput.inputOrdinal);
```

- [ ] Write exact-lot insufficiency and substituted-definition rejection; no fallback to another lot. Test unique transition input/output owner-state binding. Direct schema inserts violating event branch, IO reference, quantity or cross-kind ordinal constraints must fail by named SQL constraint/SQLSTATE in PostgreSQL; repository calls expose safe game errors.
- [ ] Write rollback probes after each lot, normalized input/output and event write; compare complete snapshots including external cash/car rows and the original root guard. Existing cash late-failure tests remain exact, including the legacy INT_MAX boundary.
- [ ] Run focused tests red, then implement schema plus minimal primitives using conditional writes and the frozen complete input set. Define ordinal allocation once in the existing root; implement no second event counter in `itemlots.js`. Create event/IO rows before completing the guard. Register inverses before writes and unwind references before referenced rows.
- [ ] Implement invariant branches: legacy history stays valid; lot IO conservation excludes migration observations and split transfer legs; unique `migration_origin` is an observation even after consumption; legacy unique quality remains standard. Read the full collection under Phase 2 then item protection and preserve existing cash receipt reconciliation.
- [ ] Add the deterministic stateful generator with at least 100 seeds and 250 grant/consume/split/escrow/release steps per seed. After each action assert nonnegative balances, exact per-hash conservation, one custody state, IO/event/guard parity, output uniqueness and physical lineage retention. Generate both successful operations and deliberate failures/retries. Include the seed/action index in bounded failure output.
- [ ] Verify both root lot suites, boundary suite, Phase 1 items/crafting/worldgraph/mysteries/operations suites, `npm run invariants`, gate/doc checks and PostgreSQL lot races/constraint tests. Record the actual local PostgreSQL version and skipped CI-runtime difference truthfully.
- [ ] Pass both independent reviews and controller verification before its scoped commit. Task 4 remains dormant for shared legacy gameplay; HTTP scope, cutover and live global lock compliance remain unclaimed.

### Task 5: Preserve legacy inventory through one fenced authority cutover

**Contract:** [Lot Integration Amendment](../specs/2026-09-07-world-graph-phase-2a-lot-integration-amendment.md), especially compatibility, quality, migration, epoch and backup requirements. Consume Tasks 4.1–4.2 only after their reviews pass. Continue sequentially through 5.1 → 5.2 → 5.3; new shared live ordering and authority publication are enabled only at coherent 5.3 convergence. The common constraints and file ownership above apply to every increment.

#### Task 5.1: Build-verified compatibility map and exact ownership classification

**Files:** Create `src/itemcompatibility.js`, `content/compatibility/phase1-item-definitions.json`, `content/packs/phase2-phase1-compatibility/pack.json`, `test/phase2-compatibility.js`; extend fixture helper and wiring/census files. Use the existing corpus build command and trusted artifact-index descriptor; no changes to Task 3 admission contracts or the concurrently reviewed artifact tool are presumed.

**Consumes:** `storeSealedBundle(pool, {canonicalBytes, expectedIdentity, operatorId})`, read-only `registerItemDefinitions(pool, {bundleHash})`, `definitionByHash`, existing corpus compiled artifact/index outputs.

**Produces:** Contract Section 1 `CompatibilityManifest`/`CompatibilityEntry`; `verifyCompatibilityManifest(queryable, manifest): Promise<VerifiedCompatibilityManifest>`; `compatibilityEntry(templateId, storageKind)` using that private verified snapshot. `VerifiedCompatibilityManifest` is detached/frozen and branded from exact artifact membership. It grants no registry write, activation or arbitrary operation authority.

- [ ] Wire `test/phase2-compatibility.js` immediately. Inventory all source-controlled legacy templates and fixture-only identifiers with `rg`, then add explicit canonical definitions and aliases. Code must reject unknown row/template census entries rather than auto-create them.
- [ ] Write fixtures for verified production artifact/map, foreign/missing qualified ID, wrong definition hash, map pointing to a concept, wrong stackability, fixture-authority substitution, and an unknown legacy template. Build descriptor must be selected from the trusted index's five exact identity fields; a raw JSON map is not an ingest capability.
- [ ] Write operation-custody tests for live escrow with exact depositor, historical consumed instance without live escrow, and baseline-valid operation-owned stacks both with and without a live operation root. The latter retain exact tuple/quantity and source-row/guard/event receipt without invented depositor or new release authority; distinguish absent optional root from actual conservation/provenance corruption. Test forged caller operation/project input. A failed classification must leave the pre-publication snapshot untouched. Add paired `standard`/`pristine` stack fixtures that preserve each exact canonical label (up to 80 characters) through the trusted adapter; unique quality remains `standard` and cannot normalize stack labels.
- [ ] Write Bellini namespace/table injection rejection and explicit test-fixture registration/rehearsal acceptance. Test arbitrary Phase 1 fixture template strings only through their declared fixture map; do not weaken production lookup for convenience.
- [ ] Run red. Author the compatibility **source library first**, with legacy stack maxima uniformly 1,000,000. Compile it through the existing build path, then generate/pin the map's bundle/definition hashes from that verified immutable output and its exact memberships. The map is downstream semantic alias data, not a compiler input selecting its own trusted hashes. Reject a compatibility stack mapping with another cap. General definitions retain their own exact maxima. Register immutable bytes before any item transaction using the separate trusted descriptor. Do not activate the library. Verify pinned map membership on every boot admission.
- [ ] Verify the compatibility root suite, corpus/compiler suites and `content:check`, Task 3 definition replay tests, gate/doc checks. Confirm a failed manifest/census never starts migration or writes definitions directly.
- [ ] Pass the two independent reviews and controller verification before a scoped commit. No live-data census or production activation is required or implied by this development task.

#### Task 5.2: Deterministic migration, obsolete-writer fence, and recoverable backups

**Files:** Create `src/itemmigration.js`, `test/phase2-migration.js`; modify staged `schema.sql`, `src/db.js`, `src/invariants.js`, `test/phase2-postgres.js --migration`, `tools/backup.sh`, `tools/backup-selftest.sh`, fixtures and wiring/census files.

**Consumes:** 5.1 verified manifest; 4.x branded transaction, mutation UUID/ordinals, lot primitives and migration observation schema; Task 3 completed artifact storage and post-DDL schema verifier.

**Produces:** Contract Section 4 `createLotDeployment`, `requireLotAuthority`, `verifyLotAuthority`, `migrateLegacyInventory` signatures. `AuthorityReport` contains `{deploymentEpoch, compatibilityBundleHash, schemaVersion:1, published:boolean, verified:boolean}`. `MigrationReport` contains `{deploymentEpoch, compatibilityBundleHash, stackTotalsBefore, stackTotalsAfter, sourceReceiptDigest, orderedPartsDigest, uniqueIdentityOwnerStateDigest, migrationEventDigest, replayed}`; totals/digests use checked deterministic serialization and bounded reports. Creates `item_authority_epochs`, `item_migration_receipts`, `item_migration_parts` with exact source/part keys and FKs to normalized outputs. The migration can be rehearsed without enabling new gameplay routes.

- [ ] Wire migration suite immediately and explicit PostgreSQL migration mode once. Add linked backup authority tables and fixtures in this increment, before enabling the cutover in 5.3.
- [ ] Seed zero, one, exact-cap, cap-plus-one and INT_MAX stacks with original timestamps; active/escrowed/consumed uniques; live escrow and baseline-valid operation stacks with/without current root; old completed guards; inert Bellini rows. Add paired `standard`/`pristine` source rows, preserve label/quantity/receipt/replay exactly, and reject equal-and-opposite per-quality corruption even if global totals match. Reject compatibility definitions with a maximum other than one million; 4.2 already tests smaller general-definition caps.
- [ ] Write deterministic chunk assertions with exact expected values:

```js
// Algorithmic test oracle, not a runtime file edit.
function expectedParts(q, max) {
  const result = [];
  for (let ordinal = 0, left = q; left > 0; ordinal += 1) {
    const quantity = Math.min(max, left);
    result.push({ordinal, quantity});
    left -= quantity;
  }
  return result;
}
assert.deepEqual(expectedParts(2000001, 1000000), [
  {ordinal: 0, quantity: 1000000}, {ordinal: 1, quantity: 1000000}, {ordinal: 2, quantity: 1},
]);
const big = expectedParts(2147483647, 1000000);
assert.equal(big.length, 2148);
assert.equal(big.at(-1).quantity, 483647);
assert.equal(big.reduce((sum, row) => sum + row.quantity, 0), 2147483647);
```

- [ ] Assert receipt/source framing cannot collide on delimiter-containing legacy values. Rerun yields identical ordered IDs, quantities, output ordinals and source digests; zero creates no lot; all positive quantity is preserved. Page source rows; no row produces more than 2,148 parts and no generic streaming framework is introduced.
- [ ] Assert every unique retains original ID, owner/custody/state/consumed timestamp, standard quality, null condition and ineligible export policy; exact definition and migration observation are attached once. A consumed unique observation must not look like a new creation or illegal post-consumption transition. Legacy history and cash reconciliation remain unchanged.
- [ ] Write staged boot tests against a populated pre-Phase-2 schema, partially completed additive schema/artifact staging, clean schema and exact rerun. Holding receipts/lots/unique backfill are created only inside the final locked cutover transaction, not committed provisionally while legacy writers run. Verify registry DDL verification stays in its existing seam; backend capability is initialized first; unique columns are nullable during backfill; final constraints/indexes/trigger shape verify before stamping/traffic. Native DDL failures propagate and never enter broad fallback or swallowed generic-add success.
- [ ] Write branded deployment tests for exact immutable build epoch/hash/schema match, missing/unbranded/wrong deployment, wrong connection/transaction, no marker and stale marker. The marker is explicitly tested as an obsolete-process fence, not a defense against arbitrary malicious SQL. Published generation is read without a new normal singleton lock.
- [ ] Write a real PostgreSQL two-client fence race: cutover takes maintenance advisory lock then ordered `ACCESS EXCLUSIVE` locks on old holdings tables; a committed earlier legacy write appears in final totals; overlapping and later legacy stack or old unique writes wait and then fail the installed triggers. Rollback before publication leaves old authority coherent; committed publication rejects all old writes. Capture the special maintenance trace separately from normal action trace.
- [ ] Write restore checks that preserve the six definition tables, lots, IO, guard results, uniques/custody, epoch/receipts/parts and existing linked world state. Deliberately omit each new critical authority table from a test dump and require backup validation to fail. Restore recomputes holdings/identity/provenance digests and validates obsolete-writer enforcement; test rollback/replay on the restored isolated database.
- [ ] Run the focused suite red. Implement additive staging and then final locked receipt/lot/unique backfill, exact constraint verification, transaction-local marker and triggers, reconciliation and atomic publication in one maintenance transaction. Page source rows under those locks and measure rehearsal lock duration. Failed final cutover rolls back instead of leaving stale committed source receipts to repair. Do not start runtime source compilation or public registry storage from inside the maintenance transaction.
- [ ] Verify migration and compatibility suites, existing `test/migrate.js`, items/crafting/mysteries/operations/Belladonna/worldgraph API regressions, gate/doc checks, explicit PostgreSQL migration race and backup selftest on disposable databases. Missing PostgreSQL/restore tools remain unmet evidence, not passes.
- [ ] Pass both independent reviews and controller verification before the scoped commit. Cutover machinery is still not enabled against live shared callers until 5.3 is coherent.

#### Task 5.3: Coherent caller convergence and final authority publication path

**Files:** Modify `src/items.js`, `src/itemlots.js`, `src/itemcompatibility.js`, `src/db.js`, `src/crafting.js`, `src/mysteries.js`, `src/operations.js`, `src/routes/worldgraph.js`, approved Crew-hook integration only, `src/invariants.js`, existing Phase 1 tests and `test/phase2-postgres.js`; create `test/phase2-inventory-convergence.js` and immediate wiring/census entries.

**Consumes:** Reviewed 4.x primitives; 5.1 verified compatibility map; 5.2 epoch/fence/recovery; final promoted Crew precedence ruling. All existing legacy primitive argument lists and result shapes remain unchanged.

**Produces:** `readCompatibilityHoldings`, `selectCompatibilityInputs`, `lockCompatibilityInputs` from contract Section 5; lot-backed legacy `grantStack`/`consumeStack` and all unique transitions; one complete caller lock protocol and the boot path that publishes only after all consumers are switched.

- [ ] Wire the convergence suite immediately. Add a source inventory of direct `item_stacks` reads/writes and template-only `item_instances` selectors; allow only frozen migration/history diagnostics after cutover. A source assertion is supporting evidence; behavior tests must prove the actual calls use pinned lots.
- [ ] Write compatibility-board fixtures that preserve scalar fields and ordering, exact original timestamps at migration, documented min/max timestamps afterward, and the INT_MAX aggregate cap. A same-template lot at another hash, quality state, restriction or custody must not inflate the legacy board or satisfy recipes. New detail remains behind Task 8, not legacy `safeInventory`. Paired `standard`/`pristine` recipe requirements count only their exact label, and completed replay cannot normalize labels or shift quantity between them; retain the existing equal-and-opposite per-quality conservation regression.
- [ ] Write end-to-end fresh/replay tests for craft, salvage, character assignment, mystery action/recovery/cancel, operation open/join/contribute/complete/claim/cancel, and multi-destination participant reward. Assert one root guard and unchanged historical result shape; replay after death, replacement, car deletion, changed participants or activation returns the completed result without fresh side effects.
- [ ] Write complete input-selection tests for multiple stack/unique requirements in opposite FIFO/key order. All requirements are selected before the first item lock; exact custody/depositor is rechecked. A late participant/owner/candidate change produces a safe retry/conflict rather than a lower-class lock or duplicate award.
- [ ] Write PostgreSQL traces/races against all existing Crew lifecycle paths: operation opening versus leave, kick, recruiting and request acceptance; source account changing Crew before the prefix lock; multiple known Crew IDs; and newly discovered participants after the prefix. Add the controller-inferred rejoin schedule: a former member retains an old operation role, starts invite acceptance, and operation authority attempts to lock that historical character while holding Crew. Confirm the old inversion is exercisable, then assert the new prefix removes it. Include Crew/API invite validity, changed membership and missing-target failures. Do not update a source test to simply accept both old and new conflicting orders.
- [ ] Write full before/after estate/death and Bellini snapshots. Estate processing cannot inherit/merge/duplicate generic lots or compatibility unique metadata into a replacement character. Bellini lots, jobs, tools, barter escrow and skills remain separate and inert.
- [ ] Run red. Convert all named caller lock/selection paths and legacy leaves together. In `src/crew.js`, add `inviteAcceptanceLockHooks(crewId)` returning frozen trusted `beforeCharacterLock`/`afterAccountLock` hooks: lock the exact target Crew before character; after account locks, revalidate the pending invitation and current membership with the existing acceptance rules. Apply at the existing invite-accept route in `src/server.js` without changing accrual or granting invitation authority. Preserve existing Crew-first hooks, the operation opener's `FOR NO KEY UPDATE` behavior, and the no-late-Crew-write accrual rule.
- [ ] Preserve a read-only complete-replay probe before fresh locks, then recheck the guard under the approved order. Claim the guard only after owner authority locks; acquire aggregate and complete canonical item set afterward. Enforce trusted epoch on every actual legacy unique or lot write. For v2 changed-authority tests, submit a new issued action/envelope; replaying the original action resolves its saved pins rather than today's mutable character/bundle.
- [ ] Enable the coherent boot cutover only after compatible artifacts, schema, all consumers and backup integration are present. Before traffic, verify the exact trusted epoch and migration digest. An old process cannot write retired stacks or old unique fields. No writable mirrored stack table is retained.
- [ ] Replace the old worldgraph guard-before-character source tripwire with the promoted complete trace assertion and retain LF/CRLF portability. Keep legacy transport key-reuse 422 expectations unchanged. Add an explicit Task 8 acceptance note for new action-scoped HTTP requests at `src/server.js`; do not weaken the global cache.
- [ ] Verify convergence, migration, compatibility, lot/boundary/property suites; complete items/crafting/mysteries/operations/Belladonna/worldgraph API suites; invariants; PostgreSQL normal-action and cutover races; backup selftest; gate/doc checks; and the full existing repository suite once the focused checks pass. Broaden again only for new changes or unresolved evidence.
- [ ] Obtain fresh spec then different quality/security/PostgreSQL review, resolve all Critical/Important findings, obtain controller independent verification and create the scoped commit. Report Task 4–5 acceptance precisely; material catalogs, new salvage profiles, public API scope and Phase 2A completion remain with later tasks.

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

For the new Phase 2 route family, assert the same textual idempotency key is independent across authenticated accounts and server-configured action kinds, while changed normalized input/issued authority in the same scope conflicts. The original issued action resolves its persisted private envelope and permanent domain result after target consumption or transport-cache expiry; it must not re-resolve today's mutable owner/bundle into a different request. Historical routes retain their existing raw transport keys, method/URL/body hash, 422 reuse behavior and replay responses. Client body/header/route strings cannot choose an action scope. Include commit-before-transport-result recovery through the one domain guard; Task 4's domain-only tests do not satisfy this HTTP acceptance.

- [ ] **Step 3: Verify red**

Run: `node test/phase2-salvage.js && node test/phase2-api.js`

Expected: missing registrar/runtime failures.

- [ ] **Step 4: Add external-asset consumption uniqueness and lock-safe runtime**

Create a normalized external-asset input row unique on completed `(asset_type, asset_id)`. Resolve immutable definitions first; enter the existing item transaction; lock character/account; claim Phase 2 guard; lock car aggregate; revalidate all car states; derive the one RNG seed from `mutation_id`; append one mutation-bound `rng_audit` row; create lots/events; consume the car; complete replay; commit. Register car and RNG-audit compensation for pg-mem. Every lock helper records the same class/subtype/key/ID/generation ordering in test mode.

- [ ] **Step 5: Mount safe projections and compatibility route**

Issue signed/opaque action tokens bound internally to actor account, car, profile, active bundle, and expiry. Treat the token as a convenience, then revalidate all authority under lock. Route-specific internal mutation keys include authenticated account and action kind.

Integrate the approved scope at `src/server.js`'s existing idempotency hook using trusted route configuration owned by `src/routes/worldgraph-phase2.js`. Only configured Phase 2 actions receive account/action-scoped transport identity; preserve the historical cache's `(account_id,key)` storage semantics and unconfigured routes' raw keys and immutable body-hash/replay behavior. Server action metadata is not caller-selected authority. This Task 8 integration owns the scoped HTTP acceptance above and does not change the legacy compatibility route's global key behavior.

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
