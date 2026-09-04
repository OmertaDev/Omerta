import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGraphPackages } from '../src/worldgraph.js';
import {
  GraphValidationError,
  loadAndValidateGraphPackages,
  normalizeAssetToken,
  rewardAssetDeclarations,
  validateGraph,
} from '../src/worldgraph-validate.js';
import {
  PHASE1_WORLD_GRAPH_PACKAGES,
  validatePhase1WorldGraph,
} from '../tools/worldgraph-content.js';
import { validatePhase1EconomyPolicy } from '../src/content/phase1-policy.js';

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
  { id: 'm:a', type: 'mystery_step', requires: ['evidence:a'], excludes: ['evidence:a'] },
  { id: 'evidence:a', type: 'evidence' },
])), 'contradictory_dependency', /both requires and excludes/i);

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
  { id: 'mat:assignable', type: 'material', metadata: { characterAssignable: true } },
])), 'invalid_character_assignment_flag', /item_template/i);

expectCode(() => validateGraph(registry([
  { id: 'item:assignable', type: 'item_template', metadata: { characterAssignable: 'yes' } },
])), 'invalid_character_assignment_flag', /boolean/i);

assert.equal(validateGraph(registry([
  { id: 'item:assignable', type: 'item_template', metadata: { characterAssignable: true } },
])).ok, true, 'an explicit boolean item-template flag passes static validation');

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

expectCode(() => validateGraph(registry([{
  id: 'm:location-alias', type: 'mystery_step',
  conditions: [{ adapter: 'location', value: 'docks', district: 'foundry' }],
}])), 'conflicting_condition_alias', /conflicting location aliases/i);

expectCode(() => loadAndValidateGraphPackages([{
  id: 'unsafe-alias-value', version: 1, season: 'season:1', dependsOn: [],
  nodes: [{
    id: 'm:bigint-alias', type: 'mystery_step',
    conditions: [{ adapter: 'location', value: 1n, district: 2n }],
  }],
}]), 'conflicting_condition_alias', /conflicting location aliases/i);

const circularAliasLeft = {};
circularAliasLeft.self = circularAliasLeft;
const circularAliasRight = {};
circularAliasRight.self = circularAliasRight;
expectCode(() => loadAndValidateGraphPackages([{
  id: 'circular-alias-value', version: 1, season: 'season:1', dependsOn: [],
  nodes: [{
    id: 'm:circular-alias', type: 'mystery_step',
    conditions: [{
      adapter: 'location', value: circularAliasLeft, district: circularAliasRight,
    }],
  }],
}]), 'conflicting_condition_alias', /conflicting location aliases/i);

expectCode(() => validateGraph(registry([{
  id: 'm:bad-window', type: 'mystery_step',
  conditions: [{ adapter: 'time_window', start: 'not-a-time', end: 'also-not-a-time' }],
}])), 'malformed_condition', /valid timestamps/i);

expectCode(() => validateGraph(registry([{
  id: 'm:reversed-window', type: 'mystery_step',
  conditions: [{ adapter: 'time_window', start: '2026-09-04', end: '2026-09-03' }],
}])), 'malformed_condition', /start before end/i);

expectCode(() => validateGraph(registry([{
  id: 'm:bad-visibility', type: 'mystery_step', visibility: 'telepathic',
}])), 'invalid_visibility', /unsupported visibility/i);

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

for (const materialCount of [8, 9]) {
  const materialNodes = Array.from({ length: materialCount }, (_, index) => ({
    id: `mat:dense-${materialCount}-${index}`,
    type: 'material',
    metadata: { administratorSeeded: true },
  }));
  const denseRecipe = {
    id: `recipe:dense-${materialCount}`,
    type: 'recipe',
    repeatability: 'repeatable',
    consumes: materialNodes.map(({ id }) => ({ templateId: id, quantity: 1 })),
    outputs: materialNodes.map(({ id }) => ({ templateId: id, quantity: 1 })),
  };
  if (materialCount === 8) {
    assert.equal(validateGraph(registry([...materialNodes, denseRecipe])).ok, true,
      'the documented exact SCC boundary remains supported');
  } else {
    expectCode(() => validateGraph(registry([...materialNodes, denseRecipe])),
      'recipe_cycle_too_complex', /exceeds.*8/i);
  }
}

const parallelCycleMaterials = Array.from({ length: 8 }, (_, index) => ({
  id: `mat:parallel-${index}`,
  type: 'material',
  metadata: { administratorSeeded: true },
}));
const parallelCycleRecipes = parallelCycleMaterials.flatMap((material, index) => (
  Array.from({ length: 6 }, (_, parallelIndex) => ({
    id: `recipe:parallel-${index}-${parallelIndex}`,
    type: 'recipe',
    repeatability: 'repeatable',
    consumes: [{ templateId: material.id, quantity: 1 }],
    outputs: [{
      templateId: parallelCycleMaterials[(index + 1) % parallelCycleMaterials.length].id,
      quantity: 1,
    }],
  }))
));
expectCode(() => validateGraph(registry([
  ...parallelCycleMaterials,
  ...parallelCycleRecipes,
])), 'recipe_cycle_too_complex', /cycle validation budget/i);

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

expectCode(() => validateGraph(registry([
  { id: 'mat:a', type: 'material', metadata: { administratorSeeded: true } },
  {
    id: 'recipe:catalyst-faucet', type: 'recipe', repeatability: 'repeatable',
    catalystInputs: [{ templateId: 'mat:a', quantity: 1 }],
    outputs: [{ templateId: 'mat:a', quantity: 1 }],
  },
])), 'unbounded_recipe_source', /real consumed.*finite source/i);

expectCode(() => validateGraph(registry([
  { id: 'mat:contradictory-source', type: 'material' },
  {
    id: 'recipe:contradictory-source', type: 'recipe',
    repeatability: 'once', repeatable: true,
    outputs: [{ templateId: 'mat:contradictory-source', quantity: 1 }],
  },
  {
    id: 'sink:contradictory-source', type: 'sink',
    consumes: [{ templateId: 'mat:contradictory-source', quantity: 1 }],
  },
])), 'conflicting_recipe_authority', /contradictory repeatability/i);

expectCode(() => validateGraph(registry([
  { id: 'mat:free', type: 'material' },
  {
    id: 'recipe:free', type: 'recipe', repeatability: 'repeatable',
    outputs: [{ templateId: 'mat:free', quantity: 1 }],
  },
  { id: 'sink:free', type: 'sink', consumes: [{ templateId: 'mat:free', quantity: 1 }] },
])), 'unbounded_recipe_source', /real consumed.*finite source/i);

expectCode(() => validateGraph(registry([
  { id: 'mat:implicit-free', type: 'material' },
  {
    id: 'recipe:implicit-free', type: 'recipe',
    outputs: [{ templateId: 'mat:implicit-free', quantity: 1 }],
  },
  {
    id: 'sink:implicit-free', type: 'sink',
    consumes: [{ templateId: 'mat:implicit-free', quantity: 1 }],
  },
])), 'unsourced_material', /mat:implicit-free.*no reachable source/i);

assert.equal(validateGraph(registry([
  { id: 'mat:finite', type: 'material' },
  {
    id: 'recipe:finite', type: 'recipe', repeatability: 'once',
    outputs: [{ templateId: 'mat:finite', quantity: 1 }],
  },
  { id: 'sink:finite', type: 'sink', consumes: [{ templateId: 'mat:finite', quantity: 1 }] },
])).ok, true, 'an explicitly once-only inputless recipe is a finite authored source');

assert.equal(validateGraph(registry([
  { id: 'mat:capped-source', type: 'material' },
  {
    id: 'recipe:capped-source', type: 'recipe', repeatable: true, maxCrafts: 2,
    outputs: [{ templateId: 'mat:capped-source', quantity: 1 }],
  },
  {
    id: 'sink:capped-source', type: 'sink',
    consumes: [{ templateId: 'mat:capped-source', quantity: 1 }],
  },
])).ok, true, 'an explicit finite craft cap bounds an otherwise inputless producer');

assert.equal(validateGraph(registry([
  { id: 'mat:paid-source', type: 'material' },
  {
    id: 'recipe:paid-source', type: 'recipe', repeatability: 'repeatable',
    cashCost: 25, metadata: { cost_cash: 25 },
    outputs: [{ templateId: 'mat:paid-source', quantity: 1 }],
  },
  {
    id: 'sink:paid-source', type: 'sink',
    consumes: [{ templateId: 'mat:paid-source', quantity: 1 }],
  },
])).ok, true, 'a positive canonical cash cost constrains an inputless repeatable producer');

expectCode(() => validateGraph(registry([{
  id: 'recipe:conflicting-cost', type: 'recipe', cashCost: 25,
  metadata: { cost: 30 },
}])), 'conflicting_recipe_authority', /conflicting cash-cost/i);

expectCode(() => validateGraph(registry([{
  id: 'recipe:zero-cost', type: 'recipe', cashCost: 0,
}])), 'invalid_recipe_cost', /positive finite/i);

expectCode(() => validateGraph(registry([{
  id: 'recipe:conflicting-cap', type: 'recipe', maxCrafts: 2,
  metadata: { cap: 3 },
}])), 'conflicting_recipe_authority', /conflicting craft-cap/i);

expectCode(() => validateGraph(registry([{
  id: 'recipe:negative-cap', type: 'recipe', metadata: { claimCap: -1 },
}])), 'invalid_recipe_cap', /positive integers/i);

assert.equal(validateGraph(registry([{
  id: 'recipe:matching-cap', type: 'recipe', maxCrafts: 2,
  metadata: { claimCap: 2, cap: 2 },
}])).ok, true, 'equivalent positive craft-cap aliases agree');

expectCode(() => validateGraph(registry([
  { id: 'item:missing-tool', type: 'item_template', visibility: 'hidden' },
  { id: 'mat:tool-output', type: 'material' },
  {
    id: 'recipe:tool-output', type: 'recipe',
    consumes: [{ templateId: 'item:missing-tool', quantity: 1 }],
    outputs: [{ templateId: 'mat:tool-output', quantity: 1 }],
  },
  { id: 'sink:tool-output', type: 'sink', consumes: [{ templateId: 'mat:tool-output', quantity: 1 }] },
])), 'unsourced_material', /mat:tool-output.*no reachable source/i);

expectCode(() => validateGraph(registry([
  { id: 'evidence:hidden-producer-gate', type: 'evidence', visibility: 'hidden' },
  { id: 'item:hidden-output', type: 'item_template', visibility: 'hidden' },
  {
    id: 'recipe:unreachable-public', type: 'recipe', visibility: 'public',
    requires: ['evidence:hidden-producer-gate'],
    outputs: [{ templateId: 'item:hidden-output', quantity: 1 }],
  },
])), 'unreachable_producer', /unreachable-public.*not reachable/i);

expectCode(() => validateGraph(registry([
  { id: 'evidence:unobtainable', type: 'evidence', visibility: 'hidden' },
  {
    id: 'm:public-terminal', type: 'mystery_step', visibility: 'public',
    requires: ['evidence:unobtainable'],
  },
])), 'unreachable_terminal', /public-terminal.*not reachable/i);

expectCode(() => validateGraph(registry([
  { id: 'm:required-b', type: 'mystery_step' },
  { id: 'm:requires-b', type: 'mystery_step', requires: ['m:required-b'] },
  {
    id: 'm:transitive-exclusion', type: 'mystery_step', visibility: 'public',
    requires: ['m:requires-b'], excludes: ['m:required-b'],
  },
])), 'unreachable_terminal', /transitive-exclusion.*not reachable/i);

assert.equal(validateGraph(registry([
  { id: 'm:blocked-b', type: 'mystery_step' },
  { id: 'm:blocked-via-b', type: 'mystery_step', requires: ['m:blocked-b'] },
  { id: 'm:open-alternative', type: 'mystery_step' },
  {
    id: 'm:or-compatible', type: 'mystery_step', visibility: 'public',
    requiresAny: [['m:blocked-via-b', 'm:open-alternative']],
    excludes: ['m:blocked-b'],
  },
])).ok, true, 'reachability preserves a compatible requiresAny witness');

assert.equal(validateGraph(registry([
  { id: 'evidence:obtainable', type: 'evidence', visibility: 'hidden' },
  {
    id: 'source:evidence', type: 'source', visibility: 'public',
    produces: [{ templateId: 'evidence:obtainable', quantity: 1 }],
  },
  {
    id: 'm:reachable-terminal', type: 'mystery_step', visibility: 'public',
    requires: ['evidence:obtainable'],
  },
])).ok, true, 'general reachability follows produced evidence into public terminal nodes');

expectCode(() => validateGraph(registry([
  { id: 'item:unobtainable-role-tool', type: 'item_template', visibility: 'hidden' },
  {
    id: 'op:tool-gated', type: 'social_gate', visibility: 'public',
    metadata: {
      roles: [{
        id: 'mechanic',
        conditions: [{ adapter: 'item_ownership', templateId: 'item:unobtainable-role-tool' }],
      }],
    },
  },
])), 'unreachable_terminal', /tool-gated.*not reachable/i);

const independentRolePaths = [
  { id: 'item:path-a', type: 'item_template', visibility: 'hidden' },
  { id: 'item:path-b', type: 'item_template', visibility: 'hidden' },
  {
    id: 'm:path-a', type: 'mystery_step', visibility: 'public', excludes: ['m:path-b'],
    produces: [{ templateId: 'item:path-a', quantity: 1 }],
  },
  {
    id: 'm:path-b', type: 'mystery_step', visibility: 'public', excludes: ['m:path-a'],
    produces: [{ templateId: 'item:path-b', quantity: 1 }],
  },
];
assert.equal(validateGraph(registry([
  ...independentRolePaths,
  {
    id: 'op:independent-role-paths', type: 'social_gate', visibility: 'public',
    metadata: {
      roles: [
        {
          id: 'a', distinct: true,
          conditions: [{ adapter: 'item_ownership', templateId: 'item:path-a' }],
        },
        {
          id: 'b',
          conditions: [{ adapter: 'item_ownership', templateId: 'item:path-b' }],
        },
      ],
    },
  },
])).ok, true, 'distinct account groups may satisfy mutually exclusive item paths independently');

expectCode(() => validateGraph(registry([
  ...independentRolePaths,
  {
    id: 'op:shared-incompatible-paths', type: 'social_gate', visibility: 'public',
    metadata: {
      roles: [
        {
          id: 'a', sameAccountAs: 'b',
          conditions: [{ adapter: 'item_ownership', templateId: 'item:path-a' }],
        },
        {
          id: 'b',
          conditions: [{ adapter: 'item_ownership', templateId: 'item:path-b' }],
        },
      ],
    },
  },
])), 'unreachable_terminal', /shared-incompatible-paths.*not reachable/i);

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

expectCode(() => validateGraph(registry([{
  id: 'op:too-complex', type: 'social_gate',
  metadata: {
    roles: Array.from({ length: 32 }, (_, index) => ({
      id: `role:${index}`,
      distinctFrom: index === 0
        ? Array.from({ length: 31 }, (__, offset) => `role:${offset + 1}`) : [],
    })),
  },
}])), 'social_solver_too_complex', /32 roles.*limit 8/i);

expectCode(() => validateGraph(registry([{
  id: 'op:forced-incompatible', type: 'social_gate',
  metadata: {
    roles: [
      { id: 'a', sameAccountAs: 'b', requires: ['skill:x'] },
      { id: 'b', excludes: ['skill:x'] },
    ],
  },
}])), 'impossible_social_role', /share and not share/i);

const incompatibleRoles = validateGraph(registry([{
  id: 'op:incompatible', type: 'social_gate',
  metadata: {
    roles: [
      { id: 'a', requires: ['skill:x'] },
      { id: 'b', excludes: ['skill:x'] },
    ],
  },
}]));
assert.equal(incompatibleRoles.reports.socialOperations[0].minimumDistinctAccounts, 2,
  'cross-role requires/excludes incompatibility raises the account minimum');

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
  [{
    id: 'reward:effect-omr', type: 'reward', repeatability: 'once',
    allocationId: 'season-1-vault', claimKey: 'claim:effect-omr',
    effect: { type: 'mint', currency: 'OMR' },
  }, 'invalid_omr_reward', /mint/i],
  [{
    id: 'reward:effects-omr', type: 'reward', repeatability: 'once',
    allocationId: 'season-1-vault', claimKey: 'claim:effects-omr',
    effects: [{ type: 'direct_mint', assetType: 'OMR' }],
  }, 'invalid_omr_reward', /mint/i],
  [{
    id: 'reward:action-omr', type: 'reward', repeatability: 'once',
    allocationId: 'season-1-vault', claimKey: 'claim:action-omr',
    action: { verb: 'mint', tokenSymbol: 'OMR' },
  }, 'invalid_omr_reward', /mint/i],
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
      reward: { assetType: '$OMR', repeatable: true },
      allocationId: 'season-1-vault', claimKey: 'claim:omr',
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

expectCode(() => validateGraph(registry([{
  id: 'reward:upper-core-omr', type: 'reward', repeatability: 'once',
  metadata: { currency: 'OMR', allocationId: 'vault', claimKey: 'claim:upper-core' },
}], { season: '  CORE  ' })), 'invalid_omr_reward', /finite seasonal allocation/i);

expectCode(() => validateGraph(registry([{
  id: 'reward:allocation-conflict', type: 'reward', repeatability: 'once',
  allocationId: 'vault:a', claimKey: 'claim:a',
  metadata: { currency: 'OMR', allocationId: 'vault:b', claimKey: 'claim:a' },
}])), 'conflicting_omr_authority', /conflicting allocationId/i);

expectCode(() => validateGraph(registry([{
  id: 'reward:claim-conflict', type: 'reward', repeatability: 'once',
  allocationId: 'vault:a', claimKey: 'claim:a',
  metadata: { currency: 'OMR', allocationId: 'vault:a', claimKey: 'claim:b' },
}])), 'conflicting_omr_authority', /conflicting claimKey/i);

expectCode(() => validateGraph(registry([{
  id: 'reward:lore-authority', type: 'reward', repeatability: 'once',
  metadata: {
    currency: 'OMR',
    lore: { allocationId: 'not-authority', claimKey: 'not-authority' },
  },
}])), 'invalid_omr_reward', /finite seasonal allocation/i);

expectCode(() => validateGraph(registry([{
  id: 'reward:unrelated-cap', type: 'reward', repeatability: 'capped',
  metadata: {
    currency: 'OMR', allocationId: 'vault:a', claimKey: 'claim:a',
    damage: { cap: 10 },
  },
}])), 'invalid_omr_reward', /positive finite claim cap/i);

assert.equal(validateGraph(registry([{
  id: 'reward:innocent-provenance', type: 'reward', repeatability: 'once',
  metadata: {
    currency: 'OMR', allocationId: 'vault:a', claimKey: 'claim:a',
    adminTimestamp: '2026-09-03T00:00:00Z',
    provenance: { mintedAt: '2026-09-03T00:00:00Z' },
  },
}])).ok, true, 'non-effect provenance fields containing mint/admin text are inert');

assert.equal(validateGraph(registry([{
  id: 'reward:inert-lore', type: 'reward', repeatability: 'once',
  metadata: {
    currency: 'OMR', allocationId: 'vault:a', claimKey: 'claim:inert-lore',
    lore: { random: true, mintedAt: 'the first bell' },
  },
}])).ok, true, 'unrelated lore is not interpreted as reward authority or an effect verb');

assert.equal(validateGraph(registry([{
  id: 'reward:effect-provenance', type: 'reward', repeatability: 'once',
  metadata: {
    currency: 'OMR', allocationId: 'vault:a', claimKey: 'claim:effect-provenance',
    effects: [{ type: 'grant', description: 'commemorates mint day', mintedAt: 'archived' }],
  },
}])).ok, true, 'only declared effect verbs, not descriptive effect provenance, imply minting');

assert.equal(validateGraph(registry([{
  id: 'reward:effect-only-provenance', type: 'reward', repeatability: 'once',
  allocationId: 'vault:a', claimKey: 'claim:effect-only-provenance',
  effect: {
    type: 'grant', currency: 'OMR', description: 'commemorates mint day', mintedAt: 'archived',
  },
}])).ok, true, 'effect-level OMR classification still ignores non-verb mint provenance');

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

// The release gate validates the real shipped graph, not only small synthetic fixtures. It is a
// separate deterministic lane from the authored-content compiler because these inputs are immutable
// JavaScript graph packages, not activated authored-content JSON bundles.
const phase1First = validatePhase1WorldGraph();
const phase1Second = validatePhase1WorldGraph();
assert.deepEqual(phase1Second, phase1First, 'the Phase 1 graph report is deterministic');
assert.deepEqual(phase1First.packageIds, [
  'core-materials', 'automotive-salvage', 'belladonna-demo',
]);
assert.equal(PHASE1_WORLD_GRAPH_PACKAGES.length, 3);
assert.equal(phase1First.packages, 3);
assert.equal(phase1First.nodes, 21);
assert.equal(phase1First.recipes, 3);
assert.equal(phase1First.omrRewards, 0, 'the Phase 1 graph cannot mint OMR');
assert.deepEqual(phase1First.executableDefinitions, {
  crafting: true,
  mysteries: true,
  operations: true,
}, 'the release report proves every executable definition vocabulary was validated');
assert.deepEqual(phase1First.economyPolicy, {
  omrAuthorityPaths: 0,
  cashRewardSourcePaths: 0,
  cashCosts: [{ recipeId: 'recipe:hardened_steel', amount: 300 }],
}, 'the stricter Phase 1 policy records its sole allowed cash sink and zero currency authority');
assert.match(phase1First.contentHash, /^[0-9a-f]{64}$/);

const malformedOperation = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
malformedOperation[2].nodes
  .find(({ id }) => id === 'operation:belladonna-lockbox').metadata.closerRoleId = 'ghost';
assert.doesNotThrow(() => loadAndValidateGraphPackages(malformedOperation),
  'the reusable graph-shape validator intentionally does not own operation execution semantics');
assert.throws(() => validatePhase1WorldGraph(malformedOperation), (error) => (
  error?.code === 'bad_operation_definition'
), 'the Phase 1 release gate rejects an operation closer outside its stored role set');

for (const [condition, label] of [[
  { adapter: 'time_window', windowId: 'night_shift' }, 'time_window',
], [
  { adapter: 'owns_car', carType: 'junker' }, 'owns_car',
]]) {
  const unsupportedRootCondition = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
  unsupportedRootCondition[2].nodes
    .find(({ id }) => id === 'operation:belladonna-lockbox').conditions = [condition];
  assert.doesNotThrow(() => loadAndValidateGraphPackages(unsupportedRootCondition),
    `the generic graph validator intentionally accepts ${label}`);
  assert.throws(() => validatePhase1WorldGraph(unsupportedRootCondition), (error) => (
    error?.code === 'unsupported_operation_condition'
  ), `the Phase 1 executable gate rejects unsupported ${label} on an operation root`);
}

const conflictingOperationAlias = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
conflictingOperationAlias[2].nodes
  .find(({ id }) => id === 'operation:belladonna-mechanic').conditions = [{
    adapter: 'item_ownership',
    templateId: 'item:precision_lock_tool',
    nodeId: 'item:belladonna_artifact',
  }];
assert.throws(() => validatePhase1WorldGraph(conflictingOperationAlias), (error) => (
  ['conflicting_condition_alias', 'bad_operation_definition'].includes(error?.code)
), 'conflicting operation target aliases fail closed before serving');
const ambiguousOperationAlias = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
const ambiguousOperationCondition = ambiguousOperationAlias[2].nodes
  .find(({ id }) => id === 'operation:belladonna-lockbox')
  .metadata.roles[0].conditions = [{
    adapter: 'item_ownership',
    templateId: 'item:precision_lock_tool',
    itemTemplateId: 'item:precision_lock_tool',
  }];
assert(ambiguousOperationCondition);
assert.throws(() => validatePhase1WorldGraph(ambiguousOperationAlias), (error) => (
  error?.code === 'bad_operation_definition'
), 'even equal operation aliases are ambiguous and fail closed before serving');

const crossVocabularyOperationCondition = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
crossVocabularyOperationCondition[2].nodes
  .find(({ id }) => id === 'operation:belladonna-mechanic').conditions.push({
    adapter: 'graph_dependency', nodeId: 'mystery:belladonna-lock',
  });
assert.doesNotThrow(() => loadAndValidateGraphPackages(crossVocabularyOperationCondition));
assert.throws(() => validatePhase1WorldGraph(crossVocabularyOperationCondition), (error) => (
  error?.code === 'bad_operation_definition'
), 'an operation contribution cannot depend on mystery state absent from its operation ledger');

const crossRoleEvidenceCondition = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
crossRoleEvidenceCondition[2].nodes
  .find(({ id }) => id === 'operation:belladonna-mechanic').conditions.push({
    adapter: 'evidence', evidenceId: 'evidence:belladonna-cipher-fragment',
  });
assert.doesNotThrow(() => loadAndValidateGraphPackages(crossRoleEvidenceCondition));
assert.throws(() => validatePhase1WorldGraph(crossRoleEvidenceCondition), (error) => (
  error?.code === 'bad_operation_definition'
), 'a contribution cannot use another role\'s private evidence as a condition oracle');

for (const [label, mutateDefinition] of [[
  'root explicit interaction', (pkg) => {
    pkg.nodes.find(({ id }) => id === 'operation:belladonna-lockbox').conditions = [{
      adapter: 'explicit_interaction', interactionId: 'cannot-be-supplied-at-open',
    }];
  },
], [
  'role explicit interaction', (pkg) => {
    pkg.nodes.find(({ id }) => id === 'operation:belladonna-lockbox').metadata.roles[0]
      .conditions = [{
        adapter: 'explicit_interaction', interactionId: 'cannot-be-supplied-at-assignment',
      }];
  },
], [
  'role graph state', (pkg) => {
    pkg.nodes.find(({ id }) => id === 'operation:belladonna-lockbox').metadata.roles[0]
      .conditions = [{ adapter: 'graph_dependency', nodeId: 'operation:belladonna-investigate' }];
  },
]]) {
  const packages = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
  mutateDefinition(packages[2]);
  assert.throws(() => validatePhase1WorldGraph(packages), (error) => (
    ['bad_operation_definition', 'unreachable_terminal'].includes(error?.code)
  ), `${label} is rejected where runtime supplies no coherent value/state`);
}

const malformedMystery = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
malformedMystery[2].nodes
  .find(({ id }) => id === 'mystery:belladonna-file-closed').effects = [{
    adapter: 'unique_item_award', templateId: 'mat:scrap_steel',
  }];
assert.doesNotThrow(() => loadAndValidateGraphPackages(malformedMystery),
  'the reusable graph-shape validator intentionally does not own mystery execution semantics');
assert.throws(() => validatePhase1WorldGraph(malformedMystery), (error) => (
  error?.code === 'bad_mystery_effect'
), 'the Phase 1 release gate rejects a mystery unique-item award aimed at a material stack');

// Evidence and inert-status definitions are completed directly by an effect; they do not execute
// their own conditions/effects/lifecycle declarations. Keep their schema closed, require the exact
// granting source as their sole prerequisite, and assign each target to one runtime domain.
const closedTargetCases = [[
  'evidence unique-item effect', 'evidence:belladonna-maker-mark', (node) => {
    node.effects = [{ adapter: 'unique_item_award', templateId: 'item:belladonna_artifact' }];
  },
], [
  'evidence explicit condition', 'evidence:belladonna-maker-mark', (node) => {
    node.conditions = [{ adapter: 'explicit_interaction', interactionId: 'ignored' }];
  },
], [
  'evidence cooldown', 'evidence:belladonna-maker-mark', (node) => {
    node.cooldown = 60;
  },
], [
  'reward effects', 'reward:belladonna-crew-status', (node) => {
    node.effects = [{ adapter: 'status_award', nodeId: node.id }];
  },
], [
  'reward level condition', 'reward:belladonna-crew-status', (node) => {
    node.conditions = [{ adapter: 'level', minimumLevel: 1 }];
  },
], [
  'reward repeatability', 'reward:belladonna-crew-status', (node) => {
    node.repeatability = 'capped';
  },
]];
for (const [label, targetId, mutate] of closedTargetCases) {
  const packages = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
  mutate(packages[2].nodes.find(({ id }) => id === targetId));
  assert.doesNotThrow(() => loadAndValidateGraphPackages(packages),
    `${label} remains generic graph-shape valid`);
  assert.throws(() => validatePhase1WorldGraph(packages), (error) => (
    ['unsupported_mystery_semantics', 'unsupported_operation_semantics'].includes(error?.code)
  ), `${label} is rejected by the shared executable release/runtime gate`);
}

const mysteryUnmetGrantPrerequisite = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
mysteryUnmetGrantPrerequisite[2].nodes.push({
  id: 'mystery:unrelated-grant-prerequisite', type: 'mystery_step',
  version: 1, visibility: 'public',
});
mysteryUnmetGrantPrerequisite[2].nodes
  .find(({ id }) => id === 'evidence:belladonna-maker-mark').requires = [
    'mystery:unrelated-grant-prerequisite',
  ];
assert.doesNotThrow(() => loadAndValidateGraphPackages(mysteryUnmetGrantPrerequisite));
assert.throws(() => validatePhase1WorldGraph(mysteryUnmetGrantPrerequisite), (error) => (
  error?.code === 'bad_mystery_effect'
), 'a mystery effect cannot complete a target whose declared prerequisite is unrelated or later');

const operationLaterGrantPrerequisite = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
operationLaterGrantPrerequisite[2].nodes
  .find(({ id }) => id === 'evidence:belladonna-cipher-fragment').requires = [
    'operation:belladonna-drive',
  ];
assert.doesNotThrow(() => loadAndValidateGraphPackages(operationLaterGrantPrerequisite));
assert.throws(() => validatePhase1WorldGraph(operationLaterGrantPrerequisite), (error) => (
  error?.code === 'bad_operation_effect'
), 'an operation effect cannot complete evidence gated on a later contribution');

const crossDomainMysteryGrant = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
crossDomainMysteryGrant[2].nodes
  .find(({ id }) => id === 'mystery:belladonna-lock').effects.push({
    adapter: 'status_award', nodeId: 'reward:belladonna-crew-status',
  });
assert.doesNotThrow(() => loadAndValidateGraphPackages(crossDomainMysteryGrant));
assert.throws(() => validatePhase1WorldGraph(crossDomainMysteryGrant), (error) => (
  error?.code === 'bad_mystery_effect'
), 'a mystery cannot complete a status or evidence target owned by an operation');

const crossDomainMysteryDiscover = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
crossDomainMysteryDiscover[2].nodes
  .find(({ id }) => id === 'mystery:belladonna-lock').effects.push({
    adapter: 'discover', nodeId: 'evidence:belladonna-cipher-fragment',
  });
assert.doesNotThrow(() => loadAndValidateGraphPackages(crossDomainMysteryDiscover));
assert.throws(() => validatePhase1WorldGraph(crossDomainMysteryDiscover), (error) => (
  error?.code === 'bad_mystery_effect'
), 'a mystery cannot discover private evidence owned by an operation');

const earlyMysteryCompletion = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
earlyMysteryCompletion[2].nodes
  .find(({ id }) => id === 'mystery:belladonna-trace').effects.push({
    adapter: 'complete', nodeId: 'mystery:belladonna-file-closed',
  });
assert.doesNotThrow(() => loadAndValidateGraphPackages(earlyMysteryCompletion));
assert.throws(() => validatePhase1WorldGraph(earlyMysteryCompletion), (error) => (
  error?.code === 'bad_mystery_effect'
), 'a complete effect cannot bypass a target node\'s later prerequisites or interaction gate');

const unsupportedOperationCompletion = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
unsupportedOperationCompletion[2].nodes
  .find(({ id }) => id === 'operation:belladonna-investigate').effects.push({
    adapter: 'complete', nodeId: 'operation:belladonna-drive',
  });
assert.doesNotThrow(() => loadAndValidateGraphPackages(unsupportedOperationCompletion));
assert.throws(() => validatePhase1WorldGraph(unsupportedOperationCompletion), (error) => (
  error?.code === 'unsupported_operation_effect'
), 'operation complete effects remain fail-closed until they share the enforced source-edge path');

const choiceOnlyMysteryCycle = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
choiceOnlyMysteryCycle[2].nodes.push({
  id: 'choice:phase1-cycle-a', type: 'choice', visibility: 'public',
  requires: ['choice:phase1-cycle-b'], options: [{ id: 'a' }],
}, {
  id: 'choice:phase1-cycle-b', type: 'choice', visibility: 'public',
  requires: ['choice:phase1-cycle-a'], options: [{ id: 'b' }],
});
assert.doesNotThrow(() => loadAndValidateGraphPackages(choiceOnlyMysteryCycle),
  'the generic legacy mystery cycle walk starts only from mystery_step nodes');
assert.throws(() => validatePhase1WorldGraph(choiceOnlyMysteryCycle), (error) => (
  error?.code === 'mystery_dependency_cycle'
), 'the executable gate rejects a choice-only mystery dependency cycle');

const operationStepCycle = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
operationStepCycle[2].nodes.push({
  id: 'operation:phase1-cycle-a', type: 'operation_step', visibility: 'public',
  requires: ['operation:phase1-cycle-b'],
  metadata: { operationId: 'operation:belladonna-lockbox', roleId: 'investigator' },
}, {
  id: 'operation:phase1-cycle-b', type: 'operation_step', visibility: 'public',
  requires: ['operation:phase1-cycle-a'],
  metadata: { operationId: 'operation:belladonna-lockbox', roleId: 'investigator' },
});
assert.doesNotThrow(() => loadAndValidateGraphPackages(operationStepCycle),
  'generic graph validation does not own operation-state acyclicity');
assert.throws(() => validatePhase1WorldGraph(operationStepCycle), (error) => (
  error?.code === 'operation_dependency_cycle'
), 'the executable gate rejects operation-step dependency cycles outside convergence lists');

const phase1MysteryNode = (packages) => packages[2].nodes
  .find(({ id }) => id === 'mystery:belladonna-trace');
const phase1OperationRoot = (packages) => packages[2].nodes
  .find(({ id }) => id === 'operation:belladonna-lockbox');

for (const [label, mutate] of [[
  'mystery cooldown', (node) => { node.metadata.cooldownSeconds = 60; },
], [
  'mystery once flag', (node) => { node.repeatability = 'once'; },
], [
  'mystery failure rules', (node) => { node.failureRules = { onFailure: 'retry' }; },
], [
  'mystery expiry', (node) => { node.expiresAt = '2027-01-01T00:00:00.000Z'; },
], [
  'mystery death rules', (node) => { node.deathRules = { onDeath: 'reset' }; },
], [
  'mystery season override', (node) => { node.season = 'season:2'; },
], [
  'mystery consumes', (node) => {
    node.consumes = [{ templateId: 'mat:scrap_steel', quantity: 1 }];
  },
], [
  'mystery produces', (node) => {
    node.produces = [{ templateId: 'mat:wire', quantity: 1 }];
  },
], [
  'mystery catalysts', (node) => {
    node.catalysts = [{ templateId: 'mat:salvage_parts', quantity: 1 }];
  },
], [
  'mystery unknown authority key', (node) => { node.authorityMode = 'author-supplied'; },
]]) {
  const packages = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
  mutate(phase1MysteryNode(packages));
  assert.doesNotThrow(() => loadAndValidateGraphPackages(packages),
    `${label} remains generic-valid graph data`);
  assert.throws(() => validatePhase1WorldGraph(packages), (error) => (
    error?.code === 'unsupported_mystery_semantics'
  ), `the executable gate rejects ignored ${label} authority`);
}

const mismatchedMysteryVersion = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
phase1MysteryNode(mismatchedMysteryVersion).version = 2;
assert.doesNotThrow(() => loadAndValidateGraphPackages(mismatchedMysteryVersion));
assert.throws(() => validatePhase1WorldGraph(mismatchedMysteryVersion), (error) => (
  error?.code === 'unsupported_mystery_semantics'
), 'an explicit mystery node version must equal its immutable package version');

for (const [type, extra] of [[
  'choice', { options: [{ id: 'version-drift-choice' }] },
], [
  'world_gate', {},
]]) {
  const packages = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
  packages[2].nodes.push({
    id: `${type}:phase1-version-drift`, type, version: 2, visibility: 'public', ...extra,
  });
  assert.doesNotThrow(() => loadAndValidateGraphPackages(packages));
  assert.throws(() => validatePhase1WorldGraph(packages), (error) => (
    error?.code === 'unsupported_mystery_semantics'
  ), `an explicit ${type} version must equal its immutable package version`);
}

for (const [label, mutate] of [[
  'operation cooldown', (root) => { root.metadata.cooldownSeconds = 60; },
], [
  'operation repeatable flag', (root) => { root.repeatable = true; },
], [
  'operation failure rules', (root) => { root.failureRules = { onFailure: 'retry' }; },
], [
  'operation expiry', (root) => { root.expiresAt = '2027-01-01T00:00:00.000Z'; },
], [
  'operation death rules', (root) => { root.deathRules = { onDeath: 'continue' }; },
], [
  'operation season override', (root) => { root.season = 'season:2'; },
], [
  'operation consumes', (root) => {
    root.consumes = [{ templateId: 'mat:scrap_steel', quantity: 1 }];
  },
], [
  'operation produces', (root) => {
    root.produces = [{ templateId: 'mat:wire', quantity: 1 }];
  },
], [
  'operation catalysts', (root) => {
    root.catalysts = [{ templateId: 'mat:salvage_parts', quantity: 1 }];
  },
], [
  'operation unknown authority key', (root) => { root.authorityMode = 'author-supplied'; },
]]) {
  const packages = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
  mutate(phase1OperationRoot(packages));
  assert.doesNotThrow(() => loadAndValidateGraphPackages(packages),
    `${label} remains generic-valid graph data`);
  assert.throws(() => validatePhase1WorldGraph(packages), (error) => (
    error?.code === 'unsupported_operation_semantics'
  ), `the executable gate rejects ignored ${label} authority`);
}

const mismatchedOperationVersion = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
phase1OperationRoot(mismatchedOperationVersion).version = 2;
assert.doesNotThrow(() => loadAndValidateGraphPackages(mismatchedOperationVersion));
assert.throws(() => validatePhase1WorldGraph(mismatchedOperationVersion), (error) => (
  error?.code === 'unsupported_operation_semantics'
), 'an explicit operation root version must equal its immutable package version');

const mismatchedOperationStepVersion = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
mismatchedOperationStepVersion[2].nodes
  .find(({ id }) => id === 'operation:belladonna-drive').version = 2;
assert.doesNotThrow(() => loadAndValidateGraphPackages(mismatchedOperationStepVersion));
assert.throws(() => validatePhase1WorldGraph(mismatchedOperationStepVersion), (error) => (
  error?.code === 'unsupported_operation_semantics'
), 'an explicit operation-step version must equal its immutable package version');

for (const visibility of ['hidden', 'discovered']) {
  const packages = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
  phase1OperationRoot(packages).visibility = visibility;
  assert.doesNotThrow(() => loadAndValidateGraphPackages(packages));
  assert.throws(() => validatePhase1WorldGraph(packages), (error) => (
    error?.code === 'bad_operation_definition'
  ), `${visibility} operation roots cannot be opened by guessed canonical id`);
}

const bogusOperationChoiceCycle = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
bogusOperationChoiceCycle[2].nodes.push({
  id: 'choice:bogus-operation-cycle-a', type: 'choice', visibility: 'public',
  requires: ['choice:bogus-operation-cycle-b'],
  metadata: { operationId: 'operation:not-real' }, options: [{ id: 'a' }],
}, {
  id: 'choice:bogus-operation-cycle-b', type: 'choice', visibility: 'public',
  requires: ['choice:bogus-operation-cycle-a'],
  metadata: { operationId: 'operation:not-real' }, options: [{ id: 'b' }],
});
assert.doesNotThrow(() => loadAndValidateGraphPackages(bogusOperationChoiceCycle));
assert.throws(() => validatePhase1WorldGraph(bogusOperationChoiceCycle), (error) => (
  error?.code === 'unsupported_mystery_semantics'
), 'a bogus operationId cannot remove a choice cycle from both executable validators');

const orphanOperationStepCycle = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
orphanOperationStepCycle[2].nodes.push({
  id: 'operation:orphan-cycle-a', type: 'operation_step', visibility: 'public',
  requires: ['operation:orphan-cycle-b'],
  metadata: { operationId: 'operation:not-real', roleId: 'investigator' },
}, {
  id: 'operation:orphan-cycle-b', type: 'operation_step', visibility: 'public',
  requires: ['operation:orphan-cycle-a'],
  metadata: { operationId: 'operation:not-real', roleId: 'investigator' },
});
assert.doesNotThrow(() => loadAndValidateGraphPackages(orphanOperationStepCycle));
assert.throws(() => validatePhase1WorldGraph(orphanOperationStepCycle), (error) => (
  error?.code === 'bad_operation_definition'
), 'mutually cyclic orphan operation steps cannot evade root ownership and cycle validation');

for (const [label, mutate] of [[
  'missing', (recipe) => { delete recipe.version; },
], [
  'zero', (recipe) => { recipe.version = 0; },
], [
  'string', (recipe) => { recipe.version = '1'; },
], [
  'mismatched', (recipe) => { recipe.version = 2; },
]]) {
  const packages = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
  const recipe = packages[1].nodes.find(({ id }) => id === 'recipe:hardened_steel');
  mutate(recipe);
  assert.throws(() => validatePhase1WorldGraph(packages), (error) => (
    error?.code === 'unsupported_recipe_semantics'
  ), `${label} recipe version cannot enter the boot/release executable registry`);
}

const craftingGateCases = [[
  'once recipe', (recipe) => { recipe.repeatability = 'once'; },
  'unsupported_recipe_repeatability',
], [
  'capped recipe', (recipe) => { recipe.repeatability = 'capped'; recipe.maxCrafts = 2; },
  'unsupported_recipe_repeatability',
], [
  'catalyst recipe', (recipe) => {
    recipe.catalystInputs = [{ templateId: 'mat:wire', quantity: 1, quality: 'standard' }];
  }, 'unsupported_recipe_semantics',
], [
  'unsupported crafting condition', (recipe) => {
    recipe.conditions.push({
      adapter: 'time_window',
      start: '2026-01-01T00:00:00.000Z',
      end: '2027-01-01T00:00:00.000Z',
    });
  }, 'unsupported_recipe_adapter',
], [
  'hidden callable recipe', (recipe) => { recipe.visibility = 'hidden'; },
  'unsupported_recipe_visibility',
]];
for (const [label, change, code] of craftingGateCases) {
  const packages = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
  const recipe = packages[1].nodes.find(({ id }) => id === 'recipe:hardened_steel');
  change(recipe);
  assert.doesNotThrow(() => loadAndValidateGraphPackages(packages),
    `${label} remains generic-valid graph data`);
  assert.throws(() => validatePhase1WorldGraph(packages), (error) => error?.code === code,
    `${label} is rejected by the complete executable gate before server boot`);
}

const conflictingCraftAlias = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
conflictingCraftAlias[1].nodes.find(({ id }) => id === 'recipe:hardened_steel').conditions[0] = {
  adapter: 'location', value: 'foundry', district: 'docks',
};
assert.throws(() => validatePhase1WorldGraph(conflictingCraftAlias), (error) => (
  error?.code === 'conflicting_condition_alias'
), 'conflicting crafting aliases fail closed at the shared generic/executable boundary');

const malformedExternalCar = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
malformedExternalCar[1].nodes
  .find(({ id }) => id === 'recipe:car_salvage_basic').conditions = [
    { adapter: 'location', value: 'foundry' },
  ];
assert.doesNotThrow(() => loadAndValidateGraphPackages(malformedExternalCar));
assert.throws(() => validatePhase1WorldGraph(malformedExternalCar), (error) => (
  error?.code === 'unsupported_salvage_recipe'
), 'external-car recipes must retain an executable authoritative car selector');

const mixedRecipeEntry = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
mixedRecipeEntry[1].nodes
  .find(({ id }) => id === 'recipe:hardened_steel').consumes = [{
    templateId: 'mat:scrap_steel', assetType: 'car', quantity: 1,
  }];
assert.doesNotThrow(() => loadAndValidateGraphPackages(mixedRecipeEntry),
  'the generic reference resolver currently prefers the internal half of a mixed entry');
assert.throws(() => validatePhase1WorldGraph(mixedRecipeEntry), (error) => (
  error?.code === 'unsupported_recipe_semantics'
), 'Phase 1 rejects mixed internal/external recipe authority before runtime can classify it');

for (const [field, value] of [[
  'cooldownSeconds', 60,
], [
  'discoveryRule', 'secret_only',
], [
  'qualityRule', 'dynamic',
]]) {
  const packages = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
  packages[1].nodes.find(({ id }) => id === 'recipe:hardened_steel').metadata[field] = value;
  assert.doesNotThrow(() => loadAndValidateGraphPackages(packages),
    `${field} remains generic-valid metadata`);
  assert.throws(() => validatePhase1WorldGraph(packages), (error) => (
    error?.code === 'unsupported_recipe_semantics'
  ), `Phase 1 rejects ignored ${field} recipe authority before serving`);
}

const namedMysteryWindow = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
namedMysteryWindow[2].nodes
  .find(({ id }) => id === 'mystery:belladonna-trace').conditions.push({
    adapter: 'time_window', windowId: 'unpublished_server_window',
  });
assert.doesNotThrow(() => loadAndValidateGraphPackages(namedMysteryWindow));
assert.throws(() => validatePhase1WorldGraph(namedMysteryWindow), (error) => (
  error?.code === 'unsupported_mystery_condition'
), 'a named mystery window with no immutable boot definition cannot be released');

const nonstandardMysteryMaterial = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
nonstandardMysteryMaterial[2].nodes
  .find(({ id }) => id === 'mystery:belladonna-lock').conditions.push({
    adapter: 'material_quantity', templateId: 'mat:scrap_steel', quantity: 1, quality: 'fine',
  });
assert.doesNotThrow(() => loadAndValidateGraphPackages(nonstandardMysteryMaterial));
assert.throws(() => validatePhase1WorldGraph(nonstandardMysteryMaterial), (error) => (
  error?.code === 'unsupported_mystery_condition'
), 'mystery material quality cannot validate as one value and execute as hardcoded standard');

const conflictingMysteryAlias = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
conflictingMysteryAlias[2].nodes
  .find(({ id }) => id === 'mystery:belladonna-lock').conditions.push({
    adapter: 'item_ownership',
    templateId: 'item:precision_lock_tool', nodeId: 'item:belladonna_artifact',
  });
assert.throws(() => validatePhase1WorldGraph(conflictingMysteryAlias), (error) => (
  ['conflicting_mystery_condition_alias', 'conflicting_condition_alias'].includes(error?.code)
), 'mystery condition target aliases cannot conflict or remain ambiguous');

const expectPhase1PolicyFailure = (packages, kind, message) => {
  assert.throws(() => validatePhase1WorldGraph(packages), (error) => {
    assert.equal(error.code, 'phase1_economy_policy');
    assert.equal(error.details.kind, kind);
    return true;
  }, message);
};
for (const [label, mutate, kind] of [[
  'package OMR reward', (pkg) => { pkg.omrReward = 999; }, 'omr',
], [
  'package mint effect', (pkg) => {
    pkg.effects = [{ adapter: 'mint', currencyCode: 'O.M.R', amount: 1 }];
  }, 'omr',
], [
  'package cooldown', (pkg) => { pkg.cooldown = 1; }, 'package_schema',
], [
  'unknown package authority key', (pkg) => { pkg.authority = true; }, 'package_schema',
]]) {
  const packages = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
  mutate(packages[2]);
  assert.doesNotThrow(() => loadAndValidateGraphPackages(packages),
    `${label} is intentionally outside the reusable node-shape validator`);
  expectPhase1PolicyFailure(packages, kind,
    `${label} is rejected by the closed whole-package Phase 1 boot/release boundary`);
}
const omrPackages = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
omrPackages.push({
  id: 'phase1-forbidden-reward', version: 1, season: 'season:1', dependsOn: [],
  nodes: [{
    id: 'reward:phase1-omr', type: 'reward', version: 1, visibility: 'hidden',
    repeatability: 'once',
    metadata: {
      currency: 'OMR', allocationId: 'phase1-test-vault', claimKey: 'phase1-test-claim',
    },
  }],
});
assert.doesNotThrow(() => validateGraph(loadAndValidateGraphPackages(omrPackages)),
  'the reusable validator intentionally accepts a finite seasonal OMR reward');
expectPhase1PolicyFailure(omrPackages, 'omr',
  'the Phase 1 release policy rejects OMR even when the reusable validator accepts it');

const genericCurrencyAliases = [
  'asset', 'assetType', 'currency', 'currencyType', 'rewardAsset', 'rewardCurrency',
  'symbol', 'token', 'tokenSymbol', 'assetId', 'currencyId', 'currencyCode',
  'rewardAssetType', 'rewardCurrencyType', 'tokenType',
];
for (const alias of genericCurrencyAliases) {
  const packages = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
  packages[2].season = 'season:1';
  Object.assign(packages[2].nodes
    .find(({ id }) => id === 'reward:belladonna-crew-status').metadata, {
    [alias]: 'OMR', allocationId: `phase1-${alias}`, claimKey: `phase1-${alias}`,
  });
  packages[2].nodes
    .find(({ id }) => id === 'reward:belladonna-crew-status').repeatability = 'once';
  assert.equal(validateGraph(loadAndValidateGraphPackages(packages)).reports.omrRewards, 1,
    `the generic validator recognizes ${alias} as OMR authority`);
  expectPhase1PolicyFailure(packages, 'omr',
    `the zero-OMR Phase 1 gate rejects the generic ${alias} vocabulary`);
}

const artifactCurrencyAlias = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
artifactCurrencyAlias[0].nodes
  .find(({ id }) => id === 'item:belladonna_artifact').metadata.currencyCode = 'OMR';
assert.throws(() => validatePhase1WorldGraph(artifactCurrencyAlias), (error) => (
  ['phase1_economy_policy', 'unsafe_operation_reward', 'unsafe_mystery_reward']
    .includes(error?.code)
), 'a gameplay-inert unique artifact cannot conceal currency authority');

const omrSpellingAliases = ['$OMR', 'Omerta', 'Omertà', 'O.M.R', 'O/M/R', 'O:M:R'];
for (const alias of omrSpellingAliases) {
  assert.equal(normalizeAssetToken(alias), 'OMR', `${alias} canonicalizes to OMR`);

  const statusPackages = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
  statusPackages[2].season = 'season:1';
  Object.assign(statusPackages[2].nodes
    .find(({ id }) => id === 'reward:belladonna-crew-status').metadata, {
    currencyCode: alias,
    allocationId: `phase1-status-${normalizeAssetToken(alias)}`,
    claimKey: `phase1-status-${normalizeAssetToken(alias)}`,
  });
  statusPackages[2].nodes
    .find(({ id }) => id === 'reward:belladonna-crew-status').repeatability = 'once';
  assert.equal(validateGraph(loadAndValidateGraphPackages(statusPackages)).reports.omrRewards, 1,
    `the generic reward census cannot report zero for status metadata alias ${alias}`);
  assert.deepEqual(
    rewardAssetDeclarations(statusPackages[2].nodes
      .find(({ id }) => id === 'reward:belladonna-crew-status'))
      .filter(({ path }) => path.endsWith('.currencyCode'))
      .map(({ asset }) => asset),
    ['OMR'],
    `the shared executable-target detector recognizes status metadata alias ${alias}`,
  );
  assert.throws(() => validatePhase1WorldGraph(statusPackages), (error) => (
    ['phase1_economy_policy', 'unsafe_operation_reward', 'unsafe_mystery_reward']
      .includes(error?.code)
  ), `the Phase 1 executable/release gate rejects status metadata alias ${alias}`);
  assert.throws(() => validatePhase1EconomyPolicy(statusPackages), (error) => (
    error?.code === 'phase1_economy_policy' && error?.details?.kind === 'omr'
  ), `the Phase 1 economy scan independently rejects status metadata alias ${alias}`);

  const templatePackages = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
  const awardedTemplate = templatePackages[0].nodes
    .find(({ id }) => id === 'item:belladonna_artifact');
  awardedTemplate.metadata.currencyCode = alias;
  assert.deepEqual(
    rewardAssetDeclarations(awardedTemplate)
      .filter(({ path }) => path.endsWith('.currencyCode'))
      .map(({ asset }) => asset),
    ['OMR'],
    `the shared executable-target detector recognizes awarded-template alias ${alias}`,
  );
  assert.throws(() => validatePhase1WorldGraph(templatePackages), (error) => (
    ['phase1_economy_policy', 'unsafe_operation_reward', 'unsafe_mystery_reward']
      .includes(error?.code)
  ), `an awarded template cannot conceal OMR authority as ${alias}`);
  assert.throws(() => validatePhase1EconomyPolicy(templatePackages), (error) => (
    error?.code === 'phase1_economy_policy' && error?.details?.kind === 'omr'
  ), `the Phase 1 economy scan independently rejects awarded-template alias ${alias}`);
}

for (const alias of ['C.A.S.H', 'C/A/S/H', 'C:A:S:H']) {
  assert.equal(normalizeAssetToken(alias), 'CASH', `${alias} canonicalizes to CASH`);

  const statusPackages = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
  const statusTarget = statusPackages[2].nodes
    .find(({ id }) => id === 'reward:belladonna-crew-status');
  statusTarget.metadata.currencyCode = alias;
  assert.deepEqual(
    rewardAssetDeclarations(statusTarget)
      .filter(({ path }) => path.endsWith('.currencyCode'))
      .map(({ asset }) => asset),
    ['CASH'],
    `the shared executable-target detector recognizes status metadata alias ${alias}`,
  );
  assert.throws(() => validatePhase1WorldGraph(statusPackages), (error) => (
    ['phase1_economy_policy', 'unsafe_operation_reward', 'unsafe_mystery_reward']
      .includes(error?.code)
  ), `an awarded status cannot conceal cash authority as ${alias}`);
  assert.throws(() => validatePhase1EconomyPolicy(statusPackages), (error) => (
    error?.code === 'phase1_economy_policy' && error?.details?.kind === 'cash_authority'
  ), `the Phase 1 economy scan independently rejects status metadata alias ${alias}`);

  const templatePackages = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
  const awardedTemplate = templatePackages[0].nodes
    .find(({ id }) => id === 'item:belladonna_artifact');
  awardedTemplate.metadata.currencyCode = alias;
  assert.deepEqual(
    rewardAssetDeclarations(awardedTemplate)
      .filter(({ path }) => path.endsWith('.currencyCode'))
      .map(({ asset }) => asset),
    ['CASH'],
    `the shared executable-target detector recognizes awarded-template alias ${alias}`,
  );
  assert.throws(() => validatePhase1WorldGraph(templatePackages), (error) => (
    ['phase1_economy_policy', 'unsafe_operation_reward', 'unsafe_mystery_reward']
      .includes(error?.code)
  ), `an awarded template cannot conceal cash authority as ${alias}`);
  assert.throws(() => validatePhase1EconomyPolicy(templatePackages), (error) => (
    error?.code === 'phase1_economy_policy' && error?.details?.kind === 'cash_authority'
  ), `the Phase 1 economy scan independently rejects awarded-template alias ${alias}`);
}

const unicodeAuthorityKey = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
unicodeAuthorityKey[2].season = 'season:1';
const unicodeAuthorityTarget = unicodeAuthorityKey[2].nodes
  .find(({ id }) => id === 'reward:belladonna-crew-status');
unicodeAuthorityTarget.repeatability = 'once';
Object.assign(unicodeAuthorityTarget.metadata, {
  currencyCódé: 'O.M.R', allocationId: 'unicode-key-vault', claimKey: 'unicode-key-claim',
});
assert.deepEqual(
  rewardAssetDeclarations(unicodeAuthorityTarget)
    .filter(({ path }) => path.endsWith('.currencyCódé')).map(({ asset }) => asset),
  ['OMR'],
  'Unicode decomposition is shared by authority-key and currency-value normalization',
);
assert.equal(validateGraph(loadAndValidateGraphPackages(unicodeAuthorityKey)).reports.omrRewards, 1);
assert.throws(() => validatePhase1WorldGraph(unicodeAuthorityKey), (error) => (
  error?.code === 'phase1_economy_policy'
), 'an accented currency authority key cannot bypass the zero-OMR boot/release boundary');

const wrongHardeningCost = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
wrongHardeningCost[1].nodes.find(({ id }) => id === 'recipe:hardened_steel').metadata.cashCost = 301;
expectPhase1PolicyFailure(wrongHardeningCost, 'cash_cost_census',
  'the hardening sink must remain exactly $300');

const extraCashCost = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
const extraRecipe = structuredClone(extraCashCost[1].nodes
  .find(({ id }) => id === 'recipe:hardened_steel'));
extraRecipe.id = 'recipe:forbidden_cash_cost';
extraRecipe.metadata.title = 'Forbidden Extra Cash Cost';
extraRecipe.metadata.cashCost = 1;
extraCashCost[1].nodes.push(extraRecipe);
expectPhase1PolicyFailure(extraCashCost, 'cash_cost_census',
  'no second recipe may gain cash-cost authority');

const cashReward = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
cashReward[2].nodes.push({
  id: 'reward:forbidden-cash', type: 'reward', version: 1, visibility: 'hidden',
  repeatability: 'once', metadata: { currency: 'cash', amount: 1 },
});
expectPhase1PolicyFailure(cashReward, 'cash_authority',
  'Phase 1 cash rewards and sources remain prohibited');

const unexpectedPackage = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
unexpectedPackage.push({
  id: 'phase1-unreviewed-package', version: 1, season: 'core', dependsOn: [], nodes: [],
});
expectPhase1PolicyFailure(unexpectedPackage, 'package_census',
  'the Phase 1 release gate rejects an unreviewed package even when it has no currency definition');

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageSources = fs.readdirSync(path.join(root, 'src', 'content'))
  .filter((file) => /export const [A-Z0-9_]+_PACKAGE\b/.test(
    fs.readFileSync(path.join(root, 'src', 'content', file), 'utf8'),
  )).sort();
assert.deepEqual(packageSources, [
  'automotive-salvage.js', 'belladonna.js', 'core-materials.js',
], 'every production world-graph package module must be present in the canonical Phase 1 manifest');
const phase1RuntimeFiles = [
  'src/items.js', 'src/crafting.js', 'src/mysteries.js', 'src/operations.js',
  'src/worldgraph.js', 'src/worldgraph-validate.js', 'src/routes/worldgraph.js',
  'src/content/core-materials.js', 'src/content/automotive-salvage.js',
  'src/content/belladonna.js', 'src/content/phase1.js', 'src/content/phase1-policy.js',
  'src/content/phase1-validation.js',
  'tools/worldgraph-content.js',
];
for (const file of phase1RuntimeFiles) {
  assert.doesNotMatch(fs.readFileSync(path.join(root, file), 'utf8'), /collection_log/i,
    `${file} must not introduce collection_log as Phase 1 item authority`);
}
const worldGraphRoutes = fs.readFileSync(path.join(root, 'src', 'routes', 'worldgraph.js'), 'utf8');
assert.match(worldGraphRoutes,
  /export const PHASE1_WORLD_GRAPH = loadAndValidatePhase1WorldGraph\(\)\.registry/,
  'server boot must run the same complete Phase 1 validator before registering routes');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.match(packageJson.scripts['worldgraph:check'], /tools\/worldgraph-content\.js/);
assert.match(packageJson.scripts.preflight, /tools\/worldgraph-content\.js/,
  'deployment preflight must fail on an invalid Phase 1 graph');
assert.match(packageJson.scripts['content:check'], /tools\/content\.js check/,
  'authored content keeps its distinct compiler/check lane');
const ci = fs.readFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), 'utf8');
assert.match(ci, /npm run worldgraph:check/,
  'CI must invoke the explicit Phase 1 graph-content gate');
const pgcheck = fs.readFileSync(path.join(root, 'tools', 'pgcheck.js'), 'utf8');
for (const helper of [
  'pgcheck-mysteries.js', 'pgcheck-operations.js', 'pgcheck-belladonna.js',
]) assert.match(pgcheck, new RegExp(helper.replace('.', '\\.')),
  `native pgcheck must transitively invoke ${helper}`);

console.log('✓ world graph static validation passed');
