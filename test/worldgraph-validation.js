import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGraphPackages } from '../src/worldgraph.js';
import {
  GraphValidationError,
  loadAndValidateGraphPackages,
  validateGraph,
} from '../src/worldgraph-validate.js';
import {
  PHASE1_WORLD_GRAPH_PACKAGES,
  validatePhase1WorldGraph,
} from '../tools/worldgraph-content.js';

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
assert.match(phase1First.contentHash, /^[0-9a-f]{64}$/);

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
  'src/content/belladonna.js', 'src/content/phase1.js', 'tools/worldgraph-content.js',
];
for (const file of phase1RuntimeFiles) {
  assert.doesNotMatch(fs.readFileSync(path.join(root, file), 'utf8'), /collection_log/i,
    `${file} must not introduce collection_log as Phase 1 item authority`);
}
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
