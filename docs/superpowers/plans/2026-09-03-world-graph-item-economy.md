# World Graph and Item Economy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 1 world-graph foundation that supports conserved item inventory, crafting and vehicle salvage, data-defined mysteries, four-player social operations, static validation, and the Belladonna Lockbox proof without creating OMR.

**Architecture:** Add small server modules with one responsibility each: graph registry/validation, inventory ledger, crafting/salvage, mystery state, and social operations. Source-controlled content packages declare nodes and recipes; runtime code uses allow-listed adapters and transactional mutation primitives. The Belladonna package proves the full path from owned car to salvage materials to a unique crafted tool to an individual mystery and four-account Crew operation.

**Tech Stack:** Node.js ES modules, PostgreSQL, pg-mem test harness, existing OMERTÀ server transaction helpers, existing cars/skills/collection/crew systems.

**Spec:** `docs/superpowers/specs/2026-09-03-world-graph-item-economy-design.md`

## Global Constraints

- Content is data-defined; ordinary content packages cannot execute arbitrary SQL or JavaScript.
- `collection_log` remains status-only and is never authoritative inventory.
- OMR cannot be minted or randomly emitted by the graph engine.
- OMR reward definitions require finite seasonal allocation, capped/idempotent claims, and no repeatable random trigger.
- All value-bearing inventory mutations are transactional.
- Distinct-account social requirements are enforced server-side.
- Unique items have one authoritative owner/state at a time.
- Phase 1 does not implement NFT minting, production OMR distribution, cross-Family diplomacy, or full profession rebalance.
- New SQL must pass both pg-mem and real PostgreSQL gates.

---

## File map

- `src/worldgraph.js`: package registration, immutable node lookup, dependency/visibility evaluation.
- `src/worldgraph-validate.js`: structural, reachability, recipe, social, source/sink, and OMR-definition validation.
- `src/items.js`: stack and unique-item mutation primitives plus provenance.
- `src/crafting.js`: recipe discovery/evaluation, craft execution, salvage execution.
- `src/mysteries.js`: mystery instance state and individual-node completion.
- `src/operations.js`: role assignment, private evidence, contributions, convergence.
- `src/content/core-materials.js`: Phase 1 materials/items.
- `src/content/automotive-salvage.js`: vehicle salvage and precision-tool recipes.
- `src/content/belladonna.js`: demonstration mystery/operation graph.
- `schema.sql`: inventory, provenance, mystery, operation, escrow, and claim-guard tables.
- `src/server.js` / existing route wiring: minimum inventory/craft/salvage/mystery/operation HTTP surfaces using normal transaction helpers.
- `test/worldgraph.js`, `test/items.js`, `test/crafting.js`, `test/mysteries.js`, `test/operations.js`, `test/belladonna.js`: focused TDD suites.
- Existing migration/backup/pgcheck/economy tests: extend only where the new tables or invariants require coverage.

---

### Task 1: World graph registry and dependency evaluator

**Files:**
- Create: `src/worldgraph.js`
- Create: `src/content/core-materials.js`
- Create: `test/worldgraph.js`

**Interfaces:**
- Produces: `registerGraphPackage(pkg)`, `loadGraphPackages(packages)`, `nodeOf(registry,id)`, `requirementsMet(node,state)`, `visibleNode(node,state)`.
- Package shape: `{ id, version, season, dependsOn: string[], nodes: object[] }`.

- [ ] **Step 1: Write failing registry tests**

```js
import assert from 'node:assert/strict';
import { loadGraphPackages, nodeOf, requirementsMet } from '../src/worldgraph.js';

const core = { id:'core-materials', version:1, season:'core', dependsOn:[], nodes:[
  { id:'mat:scrap_steel', type:'material', version:1, visibility:'public' },
  { id:'item:lock_tool', type:'item_template', version:1, visibility:'hidden', requires:['mat:scrap_steel'] },
]};
const g = loadGraphPackages([core]);
assert.equal(nodeOf(g, 'mat:scrap_steel').type, 'material');
assert.equal(requirementsMet(nodeOf(g,'item:lock_tool'), { completed:new Set(['mat:scrap_steel']) }), true);
assert.throws(() => loadGraphPackages([core, core]), /duplicate package/i);
console.log('worldgraph ok');
```

- [ ] **Step 2: Run the test and verify failure**

Run: `node test/worldgraph.js`
Expected: FAIL because `src/worldgraph.js` does not exist.

- [ ] **Step 3: Implement the minimal registry**

```js
const TYPES = new Set(['material','item_template','recipe','source','sink','evidence','mystery_step','operation_step','social_gate','world_gate','choice','reward']);
export function loadGraphPackages(packages) {
  const byPackage = new Map(), nodes = new Map();
  for (const pkg of packages) {
    if (byPackage.has(pkg.id)) throw new Error(`duplicate package ${pkg.id}`);
    byPackage.set(pkg.id, pkg);
    for (const node of pkg.nodes || []) {
      if (!TYPES.has(node.type)) throw new Error(`invalid node type ${node.type}`);
      if (nodes.has(node.id)) throw new Error(`duplicate node ${node.id}`);
      nodes.set(node.id, Object.freeze({ ...node, packageId:pkg.id }));
    }
  }
  return Object.freeze({ byPackage, nodes });
}
export const nodeOf = (g,id) => g.nodes.get(id) || null;
export function requirementsMet(node,state) {
  const done = state.completed || new Set();
  return (node.requires || []).every((id) => done.has(id)) &&
    (node.requiresAny || []).every((group) => group.some((id) => done.has(id))) &&
    !(node.excludes || []).some((id) => done.has(id));
}
export function visibleNode(node,state) {
  if (node.visibility === 'public') return true;
  return state.discovered?.has(node.id) || false;
}
export const registerGraphPackage = (pkg) => loadGraphPackages([pkg]);
```

- [ ] **Step 4: Add the first core package and rerun**

Create `src/content/core-materials.js` with `mat:scrap_steel`, `mat:wire`, `mat:salvage_parts`, `mat:hardened_steel`, `item:precision_lock_tool`, and `item:belladonna_artifact`. Run `node test/worldgraph.js`; expected PASS.

- [ ] **Step 5: Commit**

```bash
git add src/worldgraph.js src/content/core-materials.js test/worldgraph.js
git commit -m "feat: add world graph registry"
```

### Task 2: Static graph validator

**Files:**
- Create: `src/worldgraph-validate.js`
- Create: `test/worldgraph-validation.js`

**Interfaces:**
- Consumes: registry from `loadGraphPackages`.
- Produces: `validateGraph(registry)` returning `{ ok:true, warnings:[] }` or throwing with stable error codes/messages.

- [ ] **Step 1: Write failing validation cases**

```js
assert.throws(() => validateGraph(loadGraphPackages([{id:'x',version:1,dependsOn:[],nodes:[
  {id:'m:a',type:'mystery_step',requires:['missing']}
]}])), /missing dependency/i);
assert.throws(() => validateGraph(loadGraphPackages([{id:'x',version:1,dependsOn:[],nodes:[
  {id:'m:a',type:'mystery_step',requires:['m:b']}, {id:'m:b',type:'mystery_step',requires:['m:a']}
]}])), /mystery cycle/i);
assert.throws(() => validateGraph(loadGraphPackages([{id:'x',version:1,dependsOn:[],nodes:[
  {id:'r:omr',type:'reward',metadata:{currency:'OMR',repeatable:true}}
]}])), /finite seasonal allocation/i);
```

- [ ] **Step 2: Run and verify failure**

Run: `node test/worldgraph-validation.js`
Expected: FAIL because validator does not exist.

- [ ] **Step 3: Implement structural and reward validation**

Implement package dependency checks, referenced-node checks, DFS cycle detection for mystery prerequisite edges, source/sink warnings, recipe quantity checks, social-role compatibility checks, and OMR rules. OMR nodes must contain `allocationId`, `claimKey`, `repeatability:'once'|'capped'`, and must not contain `random:true` or `effect:'mint'`.

- [ ] **Step 4: Add recipe ancestor protection and social minimum-account report**

For every recipe, walk produced-template to consumed-template dependencies and reject a zero-cost recursive ancestor loop. For every social operation package, calculate `minimumDistinctAccounts` from roles marked `distinct:true` and reject impossible duplicate role IDs.

- [ ] **Step 5: Run validator tests**

Run: `node test/worldgraph-validation.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/worldgraph-validate.js test/worldgraph-validation.js
git commit -m "feat: validate authored world graphs"
```

### Task 3: Inventory schema and conservation primitives

**Files:**
- Modify: `schema.sql`
- Create: `src/items.js`
- Create: `test/items.js`

**Interfaces:**
- Produces: `grantStack(client,owner,templateId,qty,quality,reason,idempotencyKey)`, `consumeStack(...)`, `createItem(...)`, `transferItem(...)`, `consumeItem(...)`, `escrowItem(...)`, `releaseEscrow(...)`, `inventoryBoard(client,owner)`.
- Owner shape: `{ scope:'character'|'account'|'operation', id:string }`.

- [ ] **Step 1: Add failing inventory tests**

Test that granting 10 scrap then consuming 4 leaves 6; consuming 7 fails; replaying the same idempotency key does not grant twice; a unique item has exactly one owner; consumed items cannot transfer.

```js
await grantStack(c, owner, 'mat:scrap_steel', 10, 'standard', 'test', 'grant-1');
await grantStack(c, owner, 'mat:scrap_steel', 10, 'standard', 'test', 'grant-1');
assert.equal((await inventoryBoard(c,owner)).stacks.find(x=>x.templateId==='mat:scrap_steel').qty, 10);
await consumeStack(c, owner, 'mat:scrap_steel', 4, 'standard', 'test', 'consume-1');
assert.equal((await inventoryBoard(c,owner)).stacks[0].qty, 6);
```

- [ ] **Step 2: Add schema tables**

Add `item_stacks`, `item_instances`, `item_events`, `item_mutation_guards`, and `operation_escrow`. Use non-negative quantity checks, unique owner/template/quality stack key, permanent unique item IDs, and unique idempotency keys.

- [ ] **Step 3: Implement mutation primitives with row locks**

All stack decrements use `SELECT ... FOR UPDATE`; all unique item transfers check current owner and state in the same transaction. Every successful unique-item mutation appends an `item_events` provenance row.

- [ ] **Step 4: Run inventory tests on pg-mem**

Run: `node test/items.js`
Expected: PASS.

- [ ] **Step 5: Extend real PostgreSQL schema smoke**

Add the new tables to the existing PostgreSQL schema/migration check and verify constraints parse and enforce non-negative stacks.

- [ ] **Step 6: Commit**

```bash
git add schema.sql src/items.js test/items.js test/pgcheck.js
git commit -m "feat: add conserved item inventory"
```

### Task 4: Crafting and automotive salvage runtime

**Files:**
- Create: `src/crafting.js`
- Create: `src/content/automotive-salvage.js`
- Create: `test/crafting.js`
- Modify: existing car disposal/ownership helper only where required to expose an atomic consume hook.

**Interfaces:**
- Produces: `recipeCatalog(ctx)`, `craft(client,h,recipeId,idempotencyKey)`, `salvageCar(client,h,carId,recipeId,idempotencyKey)`.
- Uses item primitives from Task 3.

- [ ] **Step 1: Write failing crafting tests**

Define deterministic demo recipes: `recipe:car_salvage_basic` consumes one owned car and grants bounded scrap/wire/parts; `recipe:hardened_steel` consumes scrap; `recipe:precision_lock_tool` consumes hardened steel + salvage parts and creates one unique tool.

- [ ] **Step 2: Verify failure**

Run: `node test/crafting.js`
Expected: FAIL because crafting runtime is absent.

- [ ] **Step 3: Implement recipe requirement adapter**

Allow only named adapters such as `location`, `skill`, `level`, `owns_car`. Resolve all recipe quantities from graph content, not route parameters.

- [ ] **Step 4: Implement craft transaction**

Lock required stacks, verify facility/progression, consume inputs, create outputs, and write one idempotency guard. A replay returns the prior logical result without producing again.

- [ ] **Step 5: Implement salvage transaction**

Lock the car ownership row, mark/remove the car through the existing authoritative disposal path, grant graph-defined materials, and make replay safe. A second different salvage request for the same car must fail because the car no longer exists for that owner.

- [ ] **Step 6: Run crafting tests**

Run: `node test/crafting.js`
Expected: PASS, including exactly-once salvage and unique-tool creation.

- [ ] **Step 7: Commit**

```bash
git add src/crafting.js src/content/automotive-salvage.js test/crafting.js src/<car-authority-file>.js
git commit -m "feat: add crafting and vehicle salvage"
```

### Task 5: Mystery instance runtime

**Files:**
- Modify: `schema.sql`
- Create: `src/mysteries.js`
- Create: `test/mysteries.js`

**Interfaces:**
- Produces: `startMystery(client,owner,graphId,version)`, `mysteryBoard(client,owner,graphId)`, `discoverNode(...)`, `completeNode(...)`, `commitChoice(...)`.

- [ ] **Step 1: Write failing state tests**

Test hidden discovery, AND/OR dependencies, irreversible choice, item requirement, item escrow/consumption, duplicate completion, and graph-version pinning.

- [ ] **Step 2: Add mystery state schema**

Add `mystery_instances`, `mystery_node_state`, and `mystery_choices` with unique `(instance_id,node_id)` state and immutable graph version per instance.

- [ ] **Step 3: Implement allow-listed condition/effect adapters**

Phase 1 adapters: graph dependency, location, level/skill, item ownership, material quantity, evidence, time window, explicit interaction. Effects: discover, complete, evidence grant, item escrow, item consume, unique item award, status award. No arbitrary callback from content.

- [ ] **Step 4: Implement idempotent completion**

Lock the mystery instance, reject invalid prerequisites, apply inventory mutation and node completion in one transaction, and return existing completion for safe retries.

- [ ] **Step 5: Run mystery tests**

Run: `node test/mysteries.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add schema.sql src/mysteries.js test/mysteries.js
git commit -m "feat: add data defined mystery runtime"
```

### Task 6: Four-account social operation runtime

**Files:**
- Modify: `schema.sql`
- Create: `src/operations.js`
- Create: `test/operations.js`

**Interfaces:**
- Produces: `openOperation(...)`, `assignRole(...)`, `operationBoard(...)`, `roleBoard(...)`, `contribute(...)`, `completeOperation(...)`.

- [ ] **Step 1: Write failing social tests**

Create four roles: investigator, driver, mechanic, enforcer. Assert four distinct account IDs are required, one account cannot occupy two distinct roles, investigator/mechanic can see different private