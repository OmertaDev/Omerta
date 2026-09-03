import assert from 'node:assert/strict';
import coreMaterials from '../src/content/core-materials.js';
import {
  loadGraphPackages,
  nodeOf,
  registerGraphPackage,
  requirementsMet,
  visibleNode,
} from '../src/worldgraph.js';

const core = {
  id: 'test-core-materials',
  version: 1,
  season: 'core',
  dependsOn: [],
  nodes: [
    { id: 'mat:test_scrap', type: 'material', version: 1, visibility: 'public' },
    {
      id: 'item:test_lock_tool',
      type: 'item_template',
      version: 1,
      visibility: 'hidden',
      requires: ['mat:test_scrap'],
      requiresAny: [['evidence:test_blueprint', 'skill:test_locksmith']],
      excludes: ['choice:test_destroyed_blueprint'],
    },
  ],
};

const graph = loadGraphPackages([core]);
assert.equal(graph.byPackage.get(core.id), core);
assert.equal(nodeOf(graph, 'mat:test_scrap').type, 'material');
assert.equal(nodeOf(graph, 'missing'), null);
assert.equal(nodeOf(graph, 'item:test_lock_tool').packageId, core.id);
assert.equal(Object.isFrozen(nodeOf(graph, 'item:test_lock_tool')), true,
  'registered node definitions are immutable');

const lockTool = nodeOf(graph, 'item:test_lock_tool');
assert.equal(requirementsMet(lockTool, {
  completed: new Set(['mat:test_scrap', 'evidence:test_blueprint']),
}), true, 'all AND requirements and one option from every OR group satisfy the node');
assert.equal(requirementsMet(lockTool, {
  completed: new Set(['evidence:test_blueprint']),
}), false, 'missing an AND requirement blocks the node');
assert.equal(requirementsMet(lockTool, {
  completed: new Set(['mat:test_scrap']),
}), false, 'missing every option in an OR group blocks the node');
assert.equal(requirementsMet(lockTool, {
  completed: new Set([
    'mat:test_scrap',
    'skill:test_locksmith',
    'choice:test_destroyed_blueprint',
  ]),
}), false, 'a completed exclusion blocks the node');

assert.equal(visibleNode(nodeOf(graph, 'mat:test_scrap'), {}), true);
assert.equal(visibleNode(lockTool, {}), false);
assert.equal(visibleNode(lockTool, { discovered: new Set([lockTool.id]) }), true);

assert.throws(() => loadGraphPackages([core, core]), /duplicate package test-core-materials/i);
assert.throws(() => loadGraphPackages([
  core,
  { id: 'duplicate-node', version: 1, season: 'core', dependsOn: [], nodes: [core.nodes[0]] },
]), /duplicate node mat:test_scrap/i);
assert.throws(() => loadGraphPackages([{
  id: 'invalid-type',
  version: 1,
  season: 'core',
  dependsOn: [],
  nodes: [{ id: 'unsafe:callback', type: 'javascript' }],
}]), /invalid node type javascript/i);

const singlePackageRegistry = registerGraphPackage(core);
assert.equal(singlePackageRegistry.byPackage.size, 1);
assert.equal(nodeOf(singlePackageRegistry, 'mat:test_scrap').packageId, core.id);

assert.equal(coreMaterials.id, 'core-materials');
assert.equal(coreMaterials.version, 1);
assert.equal(coreMaterials.season, 'core');
assert.deepEqual(coreMaterials.dependsOn, []);
assert.deepEqual(coreMaterials.nodes.map((node) => node.id), [
  'mat:scrap_steel',
  'mat:wire',
  'mat:salvage_parts',
  'mat:hardened_steel',
  'item:precision_lock_tool',
  'item:belladonna_artifact',
]);
assert.equal(loadGraphPackages([coreMaterials]).nodes.size, 6,
  'the Phase 1 core material package registers as a complete package');

console.log('✓ world graph registry and dependency evaluator passed');
