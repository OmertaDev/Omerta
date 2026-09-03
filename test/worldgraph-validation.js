import assert from 'node:assert/strict';
import { loadGraphPackages } from '../src/worldgraph.js';
import { GraphValidationError, validateGraph } from '../src/worldgraph-validate.js';

function registry(nodes, overrides = {}) {
  return loadGraphPackages([{
    id: 'test-world',
    version: 1,
    season: 'season:1',
    dependsOn: [],
    nodes,
    ...overrides,
  }]);
}

function expectCode(fn, code, message) {
  assert.throws(fn, (error) => {
    assert.equal(error instanceof GraphValidationError, true);
    assert.equal(error.code, code);
    assert.match(error.message, message);
    return true;
  });
}

expectCode(() => validateGraph(loadGraphPackages([{
  id: 'dependent', version: 1, season: 'core', dependsOn: ['missing-package'], nodes: [],
}])), 'missing_package_dependency', /missing package dependency/i);

expectCode(() => validateGraph(loadGraphPackages([{
  id: 'malformed', version: 1, season: 'core', dependsOn: [42], nodes: [],
}])), 'malformed_package_dependency', /malformed package dependency/i);

expectCode(() => validateGraph(loadGraphPackages([
  { id: 'core', version: 1, season: 'core', dependsOn: [], nodes: [] },
  {
    id: 'dependent', version: 1, season: 'core',
    dependsOn: [{ id: 'core', minVersion: 2 }], nodes: [],
  },
])), 'incompatible_package_version', /incompatible version/i);

expectCode(() => validateGraph(loadGraphPackages([
  {
    id: 'core', version: 1, season: 'core', dependsOn: [],
    nodes: [{ id: 'mat:core', type: 'material' }],
  },
  {
    id: 'feature', version: 1, season: 'core', dependsOn: [],
    nodes: [{ id: 'item:feature', type: 'item_template', requires: ['mat:core'] }],
  },
])), 'undeclared_package_dependency', /does not declare package dependency/i);

expectCode(() => validateGraph(registry([
  { id: 'm:a', type: 'mystery_step', requires: ['missing'] },
])), 'missing_node_dependency', /missing dependency/i);

expectCode(() => validateGraph(registry([
  { id: 'm:a', type: 'mystery_step', requires: 'm:b' },
  { id: 'm:b', type: 'mystery_step' },
])), 'malformed_dependency', /requires.*array/i);

expectCode(() => validateGraph(registry([
  { id: 'm:a', type: 'mystery_step', requiresAny: ['m:b'] },
  { id: 'm:b', type: 'mystery_step' },
])), 'malformed_dependency', /requiresAny.*array of non-empty arrays/i);

expectCode(() => validateGraph(registry([
  { id: 'm:a', type: 'mystery_step', requires: ['m:b'] },
  { id: 'm:b', type: 'mystery_step', requires: ['m:a'] },
])), 'mystery_prerequisite_cycle', /mystery cycle/i);

expectCode(() => validateGraph(registry([
  { id: 'm:a', type: 'mystery_step', requires: ['evidence:a'] },
  { id: 'evidence:a', type: 'evidence', requires: ['m:a'] },
])), 'mystery_prerequisite_cycle', /mystery cycle/i);

expectCode(() => validateGraph(registry([
  { id: 'm:a', type: 'mystery_step', conditions: [{ adapter: 'run_javascript' }] },
])), 'unsupported_condition_adapter', /unsupported condition adapter/i);

expectCode(() => validateGraph(registry([
  {
    id: 'op:bad-adapter', type: 'social_gate',
    metadata: { roles: [{ id: 'driver', conditions: [{ adapter: 'run_javascript' }] }] },
  },
])), 'unsupported_condition_adapter', /unsupported condition adapter/i);

expectCode(() => validateGraph(registry([
  {
    id: 'op:missing-role-item', type: 'social_gate',
    metadata: {
      roles: [{ id: 'mechanic', conditions: [{ adapter: 'item_ownership', templateId: 'item:missing' }] }],
    },
  },
])), 'missing_node_dependency', /missing dependency/i);

expectCode(() => validateGraph(registry([
  { id: 'mat:ore', type: 'material', metadata: { inventoryClass: 'stack' } },
  {
    id: 'recipe:bad-quantity', type: 'recipe',
    consumes: [{ templateId: 'mat:ore', quantity: -1 }],
  },
])), 'invalid_recipe_quantity', /positive quantity/i);

expectCode(() => validateGraph(registry([
  { id: 'item:key', type: 'item_template', metadata: { inventoryClass: 'unique' } },
  {
    id: 'recipe:duplicate-key', type: 'recipe',
    produces: [{ templateId: 'item:key', quantity: 2 }],
  },
])), 'invalid_recipe_inventory_class', /unique.*quantity 1/i);

assert.equal(validateGraph(registry([
  { id: 'mat:scrap', type: 'material', metadata: { inventoryClass: 'stack' } },
  {
    id: 'recipe:salvage-car', type: 'recipe',
    consumes: [{ assetType: 'car', quantity: 1 }],
    produces: [{ templateId: 'mat:scrap', quantity: 2 }],
    conditions: [{ adapter: 'owns_car' }],
  },
])).ok, true, 'a declared car asset is a valid non-graph salvage input');

expectCode(() => validateGraph(registry([
  { id: 'mat:a', type: 'material', metadata: { inventoryClass: 'stack' } },
  { id: 'mat:b', type: 'material', metadata: { inventoryClass: 'stack' } },
  {
    id: 'recipe:a-from-b', type: 'recipe',
    consumes: [{ templateId: 'mat:b', quantity: 1 }],
    produces: [{ templateId: 'mat:a', quantity: 1 }],
  },
  {
    id: 'recipe:b-from-a', type: 'recipe',
    consumes: [{ templateId: 'mat:a', quantity: 1 }],
    produces: [{ templateId: 'mat:b', quantity: 1 }],
  },
])), 'zero_cost_recipe_cycle', /zero-cost recursive recipe ancestor/i);

const paidCycle = validateGraph(registry([
  { id: 'mat:a', type: 'material', metadata: { inventoryClass: 'stack' } },
  { id: 'mat:b', type: 'material', metadata: { inventoryClass: 'stack' } },
  {
    id: 'recipe:a-from-b', type: 'recipe', cashCost: 25,
    consumes: [{ templateId: 'mat:b', quantity: 1 }],
    produces: [{ templateId: 'mat:a', quantity: 1 }],
  },
  {
    id: 'recipe:b-from-a', type: 'recipe',
    consumes: [{ templateId: 'mat:a', quantity: 1 }],
    produces: [{ templateId: 'mat:b', quantity: 1 }],
  },
]));
assert.equal(paidCycle.ok, true, 'an explicit positive economic cost breaks a zero-cost loop');

expectCode(() => validateGraph(registry([
  {
    id: 'op:roles', type: 'social_gate',
    metadata: {
      roles: [
        { id: 'driver', distinct: true },
        { id: 'driver', distinct: true },
      ],
    },
  },
])), 'duplicate_social_role', /duplicate social role/i);

expectCode(() => validateGraph(registry([
  {
    id: 'op:impossible', type: 'social_gate',
    metadata: {
      roles: [{ id: 'mechanic', distinct: true, sameAccountAs: 'driver' }],
    },
  },
])), 'invalid_social_role_reference', /unknown social role/i);

expectCode(() => validateGraph(registry([
  {
    id: 'op:contradictory', type: 'social_gate',
    metadata: {
      roles: [{ id: 'mechanic', requires: ['skill:mechanic'], excludes: ['skill:mechanic'] }],
    },
  },
])), 'impossible_social_role', /impossible role requirements/i);

expectCode(() => validateGraph(registry([
  {
    id: 'op:too-many', type: 'social_gate',
    metadata: {
      minimumDistinctAccounts: 3,
      roles: [{ id: 'investigator' }, { id: 'driver' }],
    },
  },
])), 'impossible_social_operation', /minimumDistinctAccounts.*roles/i);

for (const [node, code, pattern] of [
  [{ id: 'reward:omr', type: 'reward', metadata: { currency: 'OMR' } },
    'invalid_omr_reward', /finite seasonal allocation/i],
  [{
    id: 'reward:omr', type: 'reward', repeatability: 'repeatable',
    metadata: { currency: 'OMR', allocationId: 'season-1-vault', claimKey: 'claim:omr' },
  }, 'invalid_omr_reward', /once or capped/i],
  [{
    id: 'reward:omr', type: 'reward', repeatability: 'once', random: true,
    metadata: { currency: 'OMR', allocationId: 'season-1-vault', claimKey: 'claim:omr' },
  }, 'invalid_omr_reward', /random/i],
  [{
    id: 'reward:omr', type: 'reward', repeatability: 'once', effect: 'direct_mint',
    metadata: { currency: 'OMR', allocationId: 'season-1-vault', claimKey: 'claim:omr' },
  }, 'invalid_omr_reward', /mint/i],
  [{
    id: 'reward:omr', type: 'reward', repeatability: 'once',
    effects: [{ type: 'mint', currency: 'OMR' }],
    metadata: { currency: 'OMR', allocationId: 'season-1-vault', claimKey: 'claim:omr' },
  }, 'invalid_omr_reward', /mint/i],
  [{
    id: 'reward:omr', type: 'reward', currency: 'cash', repeatability: 'repeatable',
    metadata: { currency: 'OMR' },
  }, 'invalid_omr_reward', /finite seasonal allocation/i],
]) {
  expectCode(() => validateGraph(registry([node])), code, pattern);
}

const success = validateGraph(registry([
  { id: 'mat:seeded', type: 'material', metadata: { inventoryClass: 'stack', seasonalSeeded: true } },
  { id: 'mat:sourced', type: 'material', metadata: { inventoryClass: 'stack' } },
  { id: 'mat:sinkless', type: 'material', metadata: { inventoryClass: 'stack' } },
  {
    id: 'source:sourced', type: 'source',
    produces: [{ templateId: 'mat:sourced', quantity: 1 }],
  },
  {
    id: 'recipe:consume', type: 'recipe',
    consumes: [{ templateId: 'mat:sourced', quantity: 2 }],
    produces: [{ templateId: 'mat:seeded', quantity: 1 }],
    conditions: [{ adapter: 'location', value: 'old_foundry' }],
  },
  {
    id: 'op:four-roles', type: 'social_gate',
    metadata: {
      roles: [
        { id: 'investigator', distinct: true },
        { id: 'driver', distinct: true },
        { id: 'mechanic', distinct: true },
        { id: 'enforcer', distinct: true },
      ],
    },
  },
  {
    id: 'reward:finite-omr', type: 'reward', repeatability: 'capped',
    metadata: {
      currency: 'OMR', allocationId: 'season-1-vault', claimKey: 'claim:finite-omr', claimCap: 10,
    },
  },
]));

assert.equal(success.ok, true);
assert.equal(Array.isArray(success.warnings), true);
assert.equal(success.warnings.some((warning) => (
  warning.code === 'sinkless_material' && warning.nodeId === 'mat:sinkless'
)), true);
assert.equal(success.warnings.some((warning) => (
  warning.code === 'orphaned_source' && warning.nodeId === 'source:sourced'
)), false, 'a recipe consuming a source output gives that source a downstream use');
assert.deepEqual(success.reports.socialOperations, [{
  nodeId: 'op:four-roles',
  packageId: 'test-world',
  minimumDistinctAccounts: 4,
  requiredRoles: ['investigator', 'driver', 'mechanic', 'enforcer'],
  rolesMayShareAccounts: false,
}]);
assert.equal(success.reports.materials.required, 1);
assert.equal(success.reports.materials.sourced, 1);
assert.equal(success.reports.recipes, 1);
assert.equal(success.reports.omrRewards, 1);

console.log('✓ world graph static validation passed');
