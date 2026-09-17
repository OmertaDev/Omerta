import assert from 'node:assert/strict';
import { createFurnaceLedger, FURNACE_IDS as ids } from '../src/content/furnace-ledger.js';
import { compileProgressionContent as compile } from '../src/content/progression-admission.js';
import { WORLD_KERNEL_REGISTRY } from '../src/content/world-kernel-pilot.js';
import { loadAndValidateGraphPackages } from '../src/worldgraph-validate.js';
import { compileWorldObjects } from '../src/world-kernel.js';
import { compileFamilyOperations } from '../src/coordination/operation-definitions.js';

const content = createFurnaceLedger();
const compileProgressionContent = (source) => compile(source, { baseRegistry: WORLD_KERNEL_REGISTRY });
const clone = () => structuredClone(content.source);
const node = (source, id) => source.packages.flatMap((pkg) => pkg.nodes).find((entry) => entry.id === id);
const rejects = (mutate, code) => {
  const source = clone(); mutate(source);
  assert.throws(() => compileProgressionContent(source), (error) => error.code === code, code);
};
function repinConsequences(source) {
  const registry = loadAndValidateGraphPackages(source.packages);
  const worlds = compileWorldObjects(registry, source.worldObjects);
  const operations = compileFamilyOperations(registry, worlds, source.familyOperations);
  for (const epilogue of source.packages.find((pkg) => pkg.id === ids.epilogue).nodes) {
    for (const condition of epilogue.conditions) {
      if (condition.adapter === 'family_operation_outcome') condition.requirement.definitionHash = operations.find((operation) => operation.id === condition.requirement.definitionId).contentHash;
      if (condition.adapter === 'world_state') condition.requirement.definitionHash = worlds.find((world) => world.id === condition.requirement.objectId).contentHash;
    }
  }
}

assert.equal(createFurnaceLedger().contentHash, content.contentHash, 'compilation is deterministic');
assert(Object.isFrozen(content.source.packages[0].nodes[0]));
assert.deepEqual(Object.keys(content.publicCatalog).sort(), ['id', 'title', 'version']);
assert.equal(content.manifest.branches.length, 2);
rejects((source) => { node(source, ids.recipe).conditions[1].requirement.contentHash = '0'.repeat(64); }, 'progression_reference');
rejects((source) => { source.coordination[0].nodes.find((entry) => entry.id === 'manifest-source').admission[0].requirement.nodeId = 'mystery:missing'; }, 'progression_reference');
rejects((source) => { source.manifest.worldObjectIds = ['facility:missing']; }, 'progression_reference');
rejects((source) => {
  node(source, ids.entry).conditions.push(structuredClone(source.worldObjects[0].knowledge).map((requirement) => ({ adapter: 'knowledge', requirement }))[0]);
}, 'progression_dependency_cycle');
rejects((source) => { source.manifest.branches[0].optionId = 'unwritten-ending'; }, 'progression_branch');
rejects((source) => { source.manifest.branches[0].operationId = source.manifest.branches[1].operationId; }, 'progression_branch');
rejects((source) => {
  delete source.worldObjects[0].actions[0].execution; repinConsequences(source);
}, 'progression_branch');
rejects((source) => {
  source.packages.push({ id: 'unused-clue', version: 1, season: 'core', dependsOn: [ids.base], nodes: [
    { id: 'mystery:orphan_private_clue', type: 'mystery_step', version: 1, visibility: 'hidden', metadata: { title: 'A Clue With No Use' } },
  ] });
  source.manifest.packageIds.push('unused-clue');
}, 'progression_dead_end');
rejects((source) => { node(source, ids.recipe).metadata.title = 'Find corroborated.carbon-index before crafting'; }, 'progression_privacy');
rejects((source) => { source.manifest.title = 'beneath-the-quench-floor'; }, 'progression_privacy');
rejects((source) => { source.manifest.fakeAuthority = true; }, 'progression_definition_invalid');
rejects((source) => { source.packages[0].nodes[0].metadata.title = 'Replaced baseline'; }, 'progression_unclaimed_definition');
rejects((source) => { source.packages.push({ id: 'unclaimed', version: 1, season: 'core', dependsOn: [], nodes: [] }); }, 'progression_unclaimed_definition');
let invoked = false;
const unsafe = clone();
Object.defineProperty(unsafe.manifest, 'title', { enumerable: true, get() { invoked = true; return 'Untrusted'; } });
assert.throws(() => compileProgressionContent(unsafe), { code: 'progression_definition_invalid' });
assert.equal(invoked, false, 'authored getters never execute');
const mutable = clone(), admitted = compileProgressionContent(mutable);
mutable.packages.find((pkg) => pkg.id === ids.workshop).nodes[0].consumes[0].quantity = 999;
assert.equal(admitted.registry.nodes.get(ids.recipe).consumes[0].quantity, 2, 'admission snapshots input');
console.log('progression-admission: exact cross-engine pins, dependency cycles, branch/collective policy, hidden deadends, privacy and canonical snapshot PASS');
