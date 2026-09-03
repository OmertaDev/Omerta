// Phase 1's vertical production proof. Every quantity, requirement, and output template lives in
// validated graph data; the runtime selects from this immutable package and accepts no client values.
const stack = (templateId, quantity, quality = 'standard') => Object.freeze({
  templateId, quantity, quality,
});

const condition = (adapter, fields) => Object.freeze({ adapter, ...fields });

const recipe = ({ id, title, cashCost, consumes, produces, conditions }) => Object.freeze({
  id,
  type: 'recipe',
  version: 1,
  visibility: 'public',
  repeatability: 'repeatable',
  consumes: Object.freeze(consumes),
  produces: Object.freeze(produces),
  conditions: Object.freeze(conditions),
  metadata: Object.freeze({ title, ...(cashCost ? { cashCost } : {}) }),
});

export const AUTOMOTIVE_SALVAGE_PACKAGE = Object.freeze({
  id: 'automotive-salvage',
  version: 1,
  season: 'core',
  dependsOn: Object.freeze(['core-materials']),
  nodes: Object.freeze([
    recipe({
      id: 'recipe:car_salvage_basic',
      title: 'Strip a Wreck',
      consumes: [Object.freeze({ assetType: 'car', quantity: 1 })],
      produces: [
        stack('mat:scrap_steel', 6),
        stack('mat:wire', 2),
        stack('mat:salvage_parts', 2),
      ],
      conditions: [
        condition('location', { value: 'foundry' }),
        condition('owns_car', { carType: 'junker' }),
      ],
    }),
    recipe({
      id: 'recipe:hardened_steel',
      title: 'Case-Harden Salvage Steel',
      cashCost: 300,
      consumes: [stack('mat:scrap_steel', 4)],
      produces: [stack('mat:hardened_steel', 1)],
      conditions: [
        condition('location', { value: 'foundry' }),
        condition('level', { minimumLevel: 4 }),
      ],
    }),
    recipe({
      id: 'recipe:precision_lock_tool',
      title: 'Machine a Precision Lock Tool',
      consumes: [
        stack('mat:hardened_steel', 1),
        stack('mat:salvage_parts', 2),
      ],
      produces: [Object.freeze({
        templateId: 'item:precision_lock_tool', quantity: 1,
      })],
      conditions: [
        condition('location', { value: 'foundry' }),
        condition('level', { minimumLevel: 8 }),
        condition('skill', { skillId: 'fence_network' }),
      ],
    }),
  ]),
});

export default AUTOMOTIVE_SALVAGE_PACKAGE;
