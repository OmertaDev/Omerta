const material = (id, title) => Object.freeze({
  id,
  type: 'material',
  version: 1,
  visibility: 'public',
  metadata: Object.freeze({ title, inventoryClass: 'stack' }),
});

const uniqueItem = (id, title, extra = {}) => Object.freeze({
  id,
  type: 'item_template',
  version: 1,
  visibility: 'hidden',
  metadata: Object.freeze({ title, inventoryClass: 'unique', ...extra }),
});

export const CORE_MATERIALS_PACKAGE = Object.freeze({
  id: 'core-materials',
  version: 1,
  season: 'core',
  dependsOn: Object.freeze([]),
  nodes: Object.freeze([
    material('mat:scrap_steel', 'Scrap Steel'),
    material('mat:wire', 'Wire'),
    material('mat:salvage_parts', 'Salvage Parts'),
    material('mat:hardened_steel', 'Hardened Steel'),
    uniqueItem('item:precision_lock_tool', 'Precision Lock Tool', {
      characterAssignable: true,
    }),
    uniqueItem('item:belladonna_artifact', 'Belladonna Artifact', {
      inert: true,
      tradeable: false,
      exportEligible: false,
    }),
  ]),
});

export default CORE_MATERIALS_PACKAGE;
