import assert from 'node:assert/strict';
import { loadGraphPackages } from '../src/worldgraph.js';
import {
  GraphValidationError,
  loadAndValidateGraphPackages,
  validateGraph,
} from '../src/worldgraph-validate.js';

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
  { id: 'm:a', type: 'mystery_step', conditions: [{ adapter: 'material_quantity', quantity: 1 }] },
])), 'malformed_condition', /material_quantity.*template/i);

expectCode(() => validateGraph(registry([
  { id: 'm:a', type: 'mystery_step', conditions: [{ adapter: 'graph_dependency' }] },
])), 'malformed_condition', /graph_dependency.*node/i);

expectCode(() => validateGraph(registry([
  { id: 'mat:not-item', type: 'material' },
  {
    id: 'm:a', type: 'mystery_step',
    conditions: [{ adapter: 'item_ownership', templateId: 'mat:not-item' }],
  },
])), 'invalid_condition_target', /item_template/i);

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

expectCode(() => validateGraph(loadGraphPackages([
  {
    id: 'core', version: 1, season: 'core', dependsOn: [],
    nodes: [{ id: 'item:core-tool', type: 'item_template' }],
  },
  {
    id: 'social', version: 1, season: 'season:1', dependsOn: [],
    nodes: [{
      id: 'op:role-ref', type: 'social_gate',
      metadata: {
        roles: [{
          id: 'mechanic',
          conditions: [{ adapter: 'item_ownership', templateId: 'item:core-tool' }],
        }],
      },
    }],
  },
])), 'undeclared_package_dependency', /does not declare package dependency/i);

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
    conditions: [{ adapter: 'owns_car', value: 'any' }],
  },
])).ok, true, 'a declared car asset is a valid non-graph salvage input');

expectCode(() => validateGraph(registry([{
  id: 'recipe:missing-car-selector', type: 'recipe',
  conditions: [{ adapter: 'owns_car' }],
}])), 'malformed_condition', /owns_car.*selector/i);

expectCode(() => validateGraph(registry([
  {
    id: 'mat:a', type: 'material',
    metadata: { inventoryClass: 'stack', administratorSeeded: true },
  },
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
])), 'undeclared_recipe_cycle', /recursive recipe.*repeatable/i);

const destructiveCycle = validateGraph(registry([
  {
    id: 'mat:a', type: 'material',
    metadata: { inventoryClass: 'stack', administratorSeeded: true },
  },
  { id: 'mat:b', type: 'material', metadata: { inventoryClass: 'stack' } },
  {
    id: 'recipe:b-from-a', type: 'recipe', repeatability: 'repeatable',
    consumes: [{ templateId: 'mat:a', quantity: 2 }],
    produces: [{ templateId: 'mat:b', quantity: 1 }],
  },
  {
    id: 'recipe:a-from-b', type: 'recipe', repeatability: 'repeatable',
    consumes: [{ templateId: 'mat:b', quantity: 2 }],
    produces: [{ templateId: 'mat:a', quantity: 1 }],
  },
]));
assert.equal(destructiveCycle.ok, true,
  'an explicitly repeatable destructive recipe SCC is conservation-safe');

const multiInputDestructiveCycle = validateGraph(registry([
  { id: 'mat:a', type: 'material', metadata: { administratorSeeded: true } },
  { id: 'mat:b', type: 'material', metadata: { administratorSeeded: true } },
  { id: 'mat:c', type: 'material' },
  {
    id: 'recipe:c', type: 'recipe', repeatability: 'repeatable',
    consumes: [
      { templateId: 'mat:a', quantity: 1 },
      { templateId: 'mat:b', quantity: 100 },
    ],
    produces: [{ templateId: 'mat:c', quantity: 2 }],
  },
  {
    id: 'recipe:ab', type: 'recipe', repeatability: 'repeatable',
    consumes: [{ templateId: 'mat:c', quantity: 1 }],
    produces: [
      { templateId: 'mat:a', quantity: 1 },
      { templateId: 'mat:b', quantity: 1 },
    ],
  },
]));
assert.equal(multiInputDestructiveCycle.ok, true,
  'cycle conservation includes every co-input and co-output of participating recipes');

expectCode(() => validateGraph(registry([
  { id: 'mat:a', type: 'material', metadata: { administratorSeeded: true } },
  { id: 'mat:b', type: 'material' },
  {
    id: 'recipe:b', type: 'recipe', repeatability: 'repeatable',
    consumes: [{ templateId: 'mat:a', quantity: 1 }],
    produces: [{ templateId: 'mat:b', quantity: 2 }],
  },
  {
    id: 'recipe:a', type: 'recipe', repeatability: 'repeatable',
    consumes: [{ templateId: 'mat:b', quantity: 3 }],
    produces: [{ templateId: 'mat:a', quantity: 2 }],
  },
])), 'inflationary_recipe_cycle', /inflationary recursive recipe/i);

assert.equal(validateGraph(registry([
  { id: 'mat:a', type: 'material', metadata: { administratorSeeded: true } },
  { id: 'mat:b', type: 'material' },
  {
    id: 'recipe:b', type: 'recipe', repeatability: 'repeatable',
    consumes: [{ templateId: 'mat:a', quantity: 10 }],
    produces: [{ templateId: 'mat:b', quantity: 20 }],
  },
  {
    id: 'recipe:a', type: 'recipe', repeatability: 'repeatable',
    consumes: [{ templateId: 'mat:b', quantity: 10 }],
    produces: [{ templateId: 'mat:a', quantity: 4 }],
  },
])).ok, true, 'stoichiometric recipe multiplicities preserve a destructive cycle');

expectCode(() => validateGraph(registry([
  {
    id: 'mat:a', type: 'material',
    metadata: { inventoryClass: 'stack', administratorSeeded: true },
  },
  { id: 'mat:b', type: 'material', metadata: { inventoryClass: 'stack' } },
  {
    id: 'recipe:b-from-a', type: 'recipe', repeatability: 'repeatable',
    consumes: [{ templateId: 'mat:a', quantity: 1 }],
    produces: [{ templateId: 'mat:b', quantity: 2 }],
  },
  {
    id: 'recipe:a-from-b', type: 'recipe', repeatability: 'repeatable',
    consumes: [{ templateId: 'mat:b', quantity: 1 }],
    produces: [{ templateId: 'mat:a', quantity: 1 }],
  },
])), 'inflationary_recipe_cycle', /inflationary recursive recipe/i);

expectCode(() => validateGraph(registry([
  { id: 'mat:a', type: 'material', metadata: { inventoryClass: 'stack' } },
  { id: 'mat:b', type: 'material', metadata: { inventoryClass: 'stack' } },
  {
    id: 'recipe:b-from-a', type: 'recipe', repeatability: 'repeatable', cashCost: 50,
    consumes: [{ templateId: 'mat:a', quantity: 1 }],
    produces: [{ templateId: 'mat:b', quantity: 1 }],
  },
  {
    id: 'recipe:a-from-b', type: 'recipe', repeatability: 'repeatable',
    consumes: [{ templateId: 'mat:b', quantity: 1 }],
    produces: [{ templateId: 'mat:a', quantity: 1 }],
  },
])), 'unsourced_material', /no reachable source/i);

expectCode(() => validateGraph(registry([
  { id: 'mat:catalyst', type: 'material' },
  { id: 'mat:output', type: 'material' },
  {
    id: 'recipe:catalyst', type: 'recipe',
    catalystInputs: [{ templateId: 'mat:catalyst', quantity: 1 }],
    produces: [{ templateId: 'mat:output', quantity: 1 }],
  },
])), 'unsourced_material', /mat:catalyst.*no reachable source/i);

expectCode(() => validateGraph(registry([
  { id: 'mat:condition', type: 'material' },
  {
    id: 'm:condition', type: 'mystery_step',
    conditions: [{ adapter: 'material_quantity', templateId: 'mat:condition', quantity: 2 }],
  },
])), 'unsourced_material', /mat:condition.*no reachable source/i);

const recursiveSourceChain = validateGraph(registry([
  { id: 'mat:raw', type: 'material' },
  { id: 'mat:middle', type: 'material' },
  { id: 'mat:final', type: 'material' },
  { id: 'source:raw', type: 'source', produces: [{ templateId: 'mat:raw', quantity: 1 }] },
  {
    id: 'recipe:middle', type: 'recipe',
    consumes: [{ templateId: 'mat:raw', quantity: 1 }],
    produces: [{ templateId: 'mat:middle', quantity: 1 }],
  },
  {
    id: 'recipe:final', type: 'recipe',
    consumes: [{ templateId: 'mat:middle', quantity: 1 }],
    produces: [{ templateId: 'mat:final', quantity: 1 }],
  },
]));
assert.equal(recursiveSourceChain.ok, true,
  'recipe outputs become reachable only after all upstream material requirements are reachable');

const catalystSource = validateGraph(registry([
  { id: 'mat:catalyst', type: 'material' },
  { id: 'mat:product', type: 'material' },
  {
    id: 'source:catalyst', type: 'source',
    produces: [{ templateId: 'mat:catalyst', quantity: 1 }],
  },
  {
    id: 'recipe:catalyzed', type: 'recipe',
    catalystInputs: [{ templateId: 'mat:catalyst', quantity: 1 }],
    produces: [{ templateId: 'mat:product', quantity: 1 }],
  },
]));
assert.equal(catalystSource.warnings.some(({ code, nodeId }) => (
  code === 'orphaned_source' && nodeId === 'source:catalyst'
)), false, 'a catalyst is a real downstream use for source diagnostics');

expectCode(() => validateGraph(loadGraphPackages([
  {
    id: 'core-material', version: 1, season: 'core', dependsOn: [],
    nodes: [{ id: 'mat:shared', type: 'material' }],
  },
  {
    id: 'unrelated-provider', version: 1, season: 'core', dependsOn: ['core-material'],
    nodes: [{
      id: 'source:shared', type: 'source',
      produces: [{ templateId: 'mat:shared', quantity: 1 }],
    }],
  },
  {
    id: 'consumer', version: 1, season: 'core', dependsOn: ['core-material'],
    nodes: [{
      id: 'sink:shared', type: 'sink',
      consumes: [{ templateId: 'mat:shared', quantity: 1 }],
    }],
  },
])), 'unsourced_material', /consumer.*dependency set/i);

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
])), 'impossible_social_operation', /minimumDistinctAccounts.*maximum feasible/i);

expectCode(() => validateGraph(registry([
  {
    id: 'op:same-account', type: 'social_gate',
    metadata: {
      minimumDistinctAccounts: 3,
      roles: [
        { id: 'driver' },
        { id: 'navigator', sameAccountAs: 'driver' },
        { id: 'lookout' },
      ],
    },
  },
])), 'impossible_social_operation', /maximum feasible.*2/i);

expectCode(() => validateGraph(registry([{
  id: 'op:one-account-only', type: 'social_gate',
  metadata: {
    minimumDistinctAccounts: 2,
    roles: [{ id: 'driver' }, { id: 'navigator', sameAccountAs: 'driver' }],
  },
}])), 'impossible_social_operation', /maximum feasible.*1/i);

const socialSolver = validateGraph(registry([
  {
    id: 'op:solver', type: 'social_gate',
    metadata: {
      roles: [
        {
          id: 'investigator', distinct: true,
          conditions: [
            { adapter: 'owns_car', value: 'sedan' },
            { adapter: 'owns_car', value: 'coupe' },
          ],
        },
        { id: 'driver' },
        { id: 'lookout', sameAccountAs: 'driver' },
      ],
    },
  },
]));
assert.deepEqual(socialSolver.reports.socialOperations[0], {
  nodeId: 'op:solver',
  packageId: 'test-world',
  minimumDistinctAccounts: 2,
  maximumDistinctAccounts: 2,
  requiredRoles: ['investigator', 'driver', 'lookout'],
  rolesMayShareAccounts: true,
});

const singleRoleSocial = validateGraph(registry([{
  id: 'op:single-role', type: 'social_gate',
  metadata: { roles: [{ id: 'observer' }] },
}]));
assert.equal(singleRoleSocial.reports.socialOperations[0].minimumDistinctAccounts, 1,
  'a non-empty social operation always requires at least one account');

expectCode(() => validateGraph(registry([
  {
    id: 'op:locations', type: 'social_gate',
    metadata: {
      roles: [{
        id: 'driver',
        conditions: [
          { adapter: 'location', value: 'docks' },
          { adapter: 'location', value: 'foundry' },
        ],
      }],
    },
  },
])), 'impossible_condition_set', /conflicting location/i);

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
    id: 'reward:omr', type: 'reward', repeatability: 'once',
    metadata: {
      assetType: 'OMR', allocationId: 'season-1-vault', claimKey: 'claim:omr',
      payout: { effect: { kind: 'directMint' } },
    },
  }, 'invalid_omr_reward', /mint/i],
  [{
    id: 'reward:omr', type: 'reward', currency: 'cash', repeatability: 'repeatable',
    metadata: { currency: 'OMR' },
  }, 'conflicting_reward_asset', /conflicting reward asset/i],
  [{
    id: 'reward:omr', type: 'reward', repeatability: 'once',
    metadata: {
      reward: { assetType: '$OMR' }, allocationId: 'season-1-vault',
      claimKey: 'claim:omr', repeatable: true,
    },
  }, 'invalid_omr_reward', /repeatable alias/i],
  [{
    id: 'reward:omr', type: 'reward', repeatability: 'once',
    metadata: {
      reward: { asset_type: 'omr' }, allocationId: 'season-1-vault', claimKey: 'claim:omr',
      trigger: { selection: 'random_weighted' },
    },
  }, 'invalid_omr_reward', /random/i],
  [{
    id: 'reward:omr', type: 'reward', repeatability: 'once',
    metadata: {
      reward: { asset: { type: 'currency', symbol: 'OMR' } },
      allocationId: 'season-1-vault', claimKey: 'claim:omr',
      trigger: { type: 'random' },
    },
  }, 'invalid_omr_reward', /random/i],
  [{
    id: 'reward:omr', type: 'reward', repeatability: 'once',
    metadata: {
      assetType: 'OMR', allocationId: 'season-1-vault', claimKey: 'claim:omr',
      trigger: { random: 0.5 },
    },
  }, 'invalid_omr_reward', /random/i],
  [{
    id: 'reward:omr', type: 'reward', repeatability: 'once',
    metadata: {
      assetType: 'OMR', allocationId: 'season-1-vault', claimKey: 'claim:omr',
      effects: [{ mint: { amount: 1 } }],
    },
  }, 'invalid_omr_reward', /mint/i],
]) {
  expectCode(() => validateGraph(registry([node])), code, pattern);
}

expectCode(() => validateGraph(registry([{
  id: 'reward:core-omr', type: 'reward', repeatability: 'once',
  metadata: {
    currency: 'OMR', season: 'season:forged',
    allocationId: 'season-vault', claimKey: 'claim:core-omr',
  },
}], { season: 'core' })), 'invalid_omr_reward', /finite seasonal allocation/i);

assert.equal(validateGraph(registry([{
  id: 'reward:fixed-omr', type: 'reward', repeatability: 'once',
  metadata: {
    currency: 'OMR', allocationId: 'season-1-vault', claimKey: 'claim:fixed-omr',
    payout: { type: 'fixed' },
  },
}])).ok, true, 'generic payout shape fields are not conflicting asset identities');

expectCode(() => loadAndValidateGraphPackages([
  { id: 'duplicate', version: 1, season: 'core', dependsOn: [], nodes: [] },
  { id: 'duplicate', version: 1, season: 'core', dependsOn: [], nodes: [] },
]), 'duplicate_package', /duplicate package/i);
expectCode(() => loadAndValidateGraphPackages([{
  id: 'duplicates', version: 1, season: 'core', dependsOn: [],
  nodes: [
    { id: 'mat:x', type: 'material' },
    { id: 'mat:x', type: 'material' },
  ],
}]), 'duplicate_node', /duplicate node/i);
expectCode(() => loadAndValidateGraphPackages([{
  id: 'invalid-type', version: 1, season: 'core', dependsOn: [],
  nodes: [{ id: 'unsafe:callback', type: 'javascript' }],
}]), 'invalid_node_type', /invalid node type/i);
expectCode(() => loadAndValidateGraphPackages([{
  version: 1, season: 'core', dependsOn: [], nodes: [],
}]), 'malformed_package', /stable ID/i);
const accepted = loadAndValidateGraphPackages([{
  id: 'accepted', version: 1, season: 'core', dependsOn: [], nodes: [],
}]);
assert.equal(accepted.byPackage.has('accepted'), true);

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
  maximumDistinctAccounts: 4,
  requiredRoles: ['investigator', 'driver', 'mechanic', 'enforcer'],
  rolesMayShareAccounts: false,
}]);
assert.equal(success.reports.materials.required, 1);
assert.equal(success.reports.materials.sourced, 1);
assert.equal(success.reports.recipes, 1);
assert.equal(success.reports.omrRewards, 1);

console.log('✓ world graph static validation passed');
