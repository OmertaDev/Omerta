// Opt-in integration content. Reuses the existing discovery source and material
// authorities; it introduces no currency, drop faucet, or alternate inventory.
import { coordinationGraphs } from '../coordination/graph.js';
import { COORDINATION_KNOWLEDGE_PILOT } from '../coordination/pilot.js';
import { PHASE1_WORLD_GRAPH_PACKAGES } from './phase1.js';
import { loadAndValidateGraphPackages } from '../worldgraph-validate.js';
import { validateCraftingDefinitions } from '../crafting.js';
import { compileWorldObjects } from '../world-kernel.js';

const graph = coordinationGraphs(COORDINATION_KNOWLEDGE_PILOT)[0];
const source = graph.nodes.find((node) => node.id === 'docks-source');
const requirement = Object.freeze({ contentHash: graph.contentHash, ...source.claim });
export const WORLD_KERNEL_RECIPE = 'recipe:archive_turn_key';
const pkg = {
  id: 'world-kernel-foundry', version: 1, season: 'core', dependsOn: ['core-materials', 'automotive-salvage'],
  nodes: [
    { id: 'item:archive_turn_key', type: 'item_template', version: 1, visibility: 'public',
      metadata: { title: 'Archive Turn Key', inventoryClass: 'unique', inert: true, tradeable: false, exportEligible: false } },
    { id: WORLD_KERNEL_RECIPE, type: 'recipe', version: 1, visibility: 'public', repeatability: 'repeatable',
      metadata: { title: 'Cut an Archive Turn Key' },
      consumes: [{ templateId: 'mat:scrap_steel', quantity: 2 }, { templateId: 'mat:wire', quantity: 1 }],
      produces: [{ templateId: 'item:archive_turn_key', quantity: 1 }],
      conditions: [{ adapter: 'location', value: 'foundry' }, { adapter: 'knowledge', requirement }] },
  ],
};
export const WORLD_KERNEL_REGISTRY = loadAndValidateGraphPackages([...PHASE1_WORLD_GRAPH_PACKAGES, pkg]);
validateCraftingDefinitions(WORLD_KERNEL_REGISTRY);
export const WORLD_KERNEL_OBJECTS = Object.freeze(compileWorldObjects(WORLD_KERNEL_REGISTRY, [{
  id: 'facility:foundry_archive', type: 'facility', title: 'Foundry Archive', locationId: 'foundry',
  states: ['sealed', 'open'], initialState: 'sealed', publicStates: ['open'], knowledge: [requirement],
  actions: [{ id: 'open_archive', from: 'sealed', to: 'open', itemTemplateId: 'item:archive_turn_key',
    materials: [{ templateId: 'mat:wire', quantity: 1 }] }],
}]).map(({ contentHash: _hash, ...definition }) => Object.freeze(definition)));
