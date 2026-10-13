// Manufacturing grade is authored at birth; callers cannot choose or rewrite it.
const freeze = Object.freeze;
export const COMPANY_PRODUCTION_QUALITY_PACKAGE = freeze({
  id: 'company-production-quality', version: 1, season: 'core',
  dependsOn: freeze(['core-materials']),
  nodes: freeze([freeze({
    id: 'recipe:tempered_precision_lock_tool', type: 'recipe', version: 1,
    visibility: 'public', repeatability: 'repeatable',
    consumes: freeze([
      freeze({ templateId: 'mat:hardened_steel', quantity: 2, quality: 'standard' }),
      freeze({ templateId: 'mat:salvage_parts', quantity: 4, quality: 'standard' }),
    ]),
    produces: freeze([freeze({ templateId: 'item:precision_lock_tool', quantity: 1 })]),
    conditions: freeze([
      freeze({ adapter: 'location', value: 'foundry' }),
      freeze({ adapter: 'level', minimumLevel: 12 }),
      freeze({ adapter: 'skill', skillId: 'fence_network' }),
    ]),
    metadata: freeze({ title: 'Temper a Precision Lock Tool', cashCost: 300, manufacturingGrade: 'tempered' }),
  })]),
});
