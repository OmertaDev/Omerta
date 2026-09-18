// Inert Dock War content. Every physical effect is an existing World Kernel
// action with inventory custody and provenance; the Director only observes it.
import { WORLD_KERNEL_REGISTRY } from './world-kernel-pilot.js';
import { loadAndValidateGraphPackages } from '../worldgraph-validate.js';
import { validateCraftingDefinitions } from '../crafting.js';
import { validateMysteryDefinitions, mysteryDefinitionHash } from '../mysteries.js';
import { compileCoordinationGraph, createCoordinationRegistry } from '../coordination/graph.js';
import { compileWorldObjects } from '../world-kernel.js';
import { compileFamilyOperations } from '../coordination/operation-definitions.js';

export const DOCK_WAR_IDS = Object.freeze({
  assets: 'dock-war-assets', evidence: 'dock-war-evidence', workshop: 'dock-war-workshop',
  aftermath: 'dock-war-aftermath', coordination: 'omerta.coordination.dock-war',
  object: 'territory:dock_supply_route', key: 'item:dock_route_seal', recipe: 'recipe:dock_route_seal',
  tide: 'mystery:dock_tide_ledger', chart: 'mystery:dock_alternate_route',
  protectOperation: 'operation:dock_protect_shipment', interceptOperation: 'operation:dock_intercept_shipment',
  alternateOperation: 'operation:dock_open_alternate_route',
  protectedAftermathOperation: 'operation:dock_settle_protected',
  interceptedAftermathOperation: 'operation:dock_settle_intercepted',
  alternateAftermathOperation: 'operation:dock_settle_alternate_route',
});
// A shipment strategy requires at most two wire units. Fewer than two available
// units cannot provision that response; this is an actual stock coverage fact.
export const DOCK_WAR_MATERIAL_DEMAND = 2;
const stripHash = ({ contentHash: _hash, ...source }) => source;
const freeze = (value) => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const complete = (nodeId) => ({ kind: 'node_completed', nodeId });
const all = (...rules) => ({ kind: 'all', rules });
const at = (value) => ({ adapter: 'location', value });
const interaction = (interactionId) => ({ adapter: 'explicit_interaction', interactionId });

/** Extend the selected core registry without substituting its admitted content. */
export function createDockWarContent(baseContent = { registry: WORLD_KERNEL_REGISTRY }) {
  const id = DOCK_WAR_IDS, packages = [...baseContent.registry.byPackage.values()];
  packages.push({ id: id.assets, version: 1, season: 'core', dependsOn: ['core-materials'], nodes: [
    { id: id.key, type: 'item_template', version: 1, visibility: 'public', metadata: {
      title: 'Dock Route Seal', inventoryClass: 'unique', inert: true, tradeable: false, exportEligible: false,
    } },
  ] });
  packages.push({ id: id.evidence, version: 1, season: 'core', dependsOn: [id.assets], nodes: [
    { id: id.tide, type: 'mystery_step', version: 1, visibility: 'public',
      conditions: [at('docks'), interaction('compare_dock_tide_ledger')],
      metadata: { title: 'The Tide Ledger', description: 'The old tide ledger describes a shallow canal crossing. A second survey must verify its clearance.' } },
    { id: id.chart, type: 'mystery_step', version: 1, visibility: 'hidden', requires: [id.tide],
      conditions: [at('foundry'), { adapter: 'item_ownership', requirement: { templateId: id.key, provenance: 'crafted' } },
        interaction('measure_dock_survey_plate')],
      metadata: { title: 'The Survey Plate', description: 'A crafted route seal fits the survey plate and exposes the clearance measurement. An independent tide record can confirm a peaceful crossing.', terminal: true } },
  ] });
  const initialRegistry = loadAndValidateGraphPackages(packages);
  const mystery = (nodeId) => ({ adapter: 'mystery_state', requirement: {
    graphId: id.evidence, graphVersion: 1, definitionHash: mysteryDefinitionHash(initialRegistry, id.evidence),
    nodeId, ownerScope: 'current_character', state: 'completed',
  } });
  const domain = 'omerta.knowledge.dock-war', value = { type: 'text', value: 'low-tide-canal-clearance' };
  const crossing = { domain, proposition: 'canal.crossing', value };
  const independent = { kind: 'independent_evidence', ...crossing, sourceRoots: ['docks.tide-ledger', 'foundry.survey-plate'] };
  const localEvidence = { kind: 'any', rules: [complete('tide-source'), complete('chart-source')] };
  const graph = compileCoordinationGraph({ schemaVersion: 2, id: id.coordination, version: 1, title: 'The Dock War', nodes: [
    { id: 'briefing', kind: 'task', title: 'Read the Dock Notice', visibility: 'public',
      description: 'The dock route can carry a scarce load. Learn who controls it and compare the surviving route records.',
      discover: { kind: 'always' }, requires: { kind: 'always' } },
    { id: 'manifest-source', kind: 'task', title: 'Inspect the Shipping Register', visibility: 'hidden',
      description: 'The register identifies the managed dock route and the seal needed to authorize a shipment strategy.',
      discover: all(complete('briefing'), { kind: 'at_district', districtId: 'docks' }), requires: { kind: 'always' },
      claim: { domain, proposition: 'shipment.route', sourceRoot: 'docks.shipping-register', value: { type: 'text', value: id.object } } },
    { id: 'tide-source', kind: 'task', title: 'Record the Tide Measurement', visibility: 'hidden',
      discover: all(complete('briefing'), { kind: 'at_district', districtId: 'docks' }), requires: { kind: 'always' },
      admission: [mystery(id.tide)], claim: { ...crossing, sourceRoot: 'docks.tide-ledger' } },
    { id: 'chart-source', kind: 'task', title: 'Record the Survey Clearance', visibility: 'hidden',
      discover: all(complete('briefing'), { kind: 'at_district', districtId: 'foundry' }), requires: { kind: 'always' },
      admission: [mystery(id.chart)], claim: { ...crossing, sourceRoot: 'foundry.survey-plate' } },
    { id: 'alternate-source', kind: 'task', title: 'Confirm the Alternate Crossing', visibility: 'hidden',
      description: 'Two original investigators agree: a Crew can carry the load through the canal with less wire and avoid a fight.',
      discover: all(localEvidence, independent), requires: all(localEvidence, independent),
      admission: [{ adapter: 'social', requirement: { relation: 'crew_member' } }],
      claim: { domain, proposition: 'route.alternate', sourceRoot: 'corroborated.dock-canal', value: { type: 'text', value: 'verified-canal-crossing' } } },
    { id: 'recorded', kind: 'terminal', title: 'Preserve the Route Evidence', visibility: 'hidden',
      discover: all(complete('manifest-source'), complete('alternate-source')),
      requires: all(complete('manifest-source'), complete('alternate-source')) },
  ] });
  const claim = (nodeId) => ({ contentHash: graph.contentHash, ...graph.nodes.find((node) => node.id === nodeId).claim });
  const route = claim('manifest-source'), alternate = claim('alternate-source');
  packages.push({ id: id.workshop, version: 1, season: 'core', dependsOn: [id.assets, 'automotive-salvage'], nodes: [
    { id: id.recipe, type: 'recipe', version: 1, visibility: 'public', repeatability: 'repeatable',
      metadata: { title: 'Stamp a Dock Route Seal' }, discovery: { mode: 'secret', requirements: [{ adapter: 'knowledge', requirement: route }] },
      consumes: [{ templateId: 'mat:scrap_steel', quantity: 2 }, { templateId: 'mat:salvage_parts', quantity: 1 }],
      produces: [{ templateId: id.key, quantity: 1 }], conditions: [at('foundry'), { adapter: 'knowledge', requirement: route }] },
  ] });
  let registry = loadAndValidateGraphPackages(packages);
  const branches = [
    { state: 'protected', actionId: 'protect_shipment', operationId: id.protectOperation, title: 'Protect the Dock Shipment', material: 2 },
    { state: 'intercepted', actionId: 'intercept_shipment', operationId: id.interceptOperation, title: 'Intercept the Dock Shipment', material: 2 },
    { state: 'alternate_route', actionId: 'open_alternate_route', operationId: id.alternateOperation, title: 'Carry the Load through the Canal', material: 1 },
  ];
  const worlds = compileWorldObjects(registry, [{ id: id.object, type: 'facility', title: 'The Dock Supply Route', locationId: 'docks',
    states: ['idle', 'shortage', ...branches.map((branch) => branch.state), 'settled'], initialState: 'idle',
    publicStates: ['idle', ...branches.map((branch) => branch.state), 'settled'], knowledge: [route],
    actions: [
      { id: 'establish_route', from: 'idle', to: 'shortage', itemTemplateId: id.key,
        materials: [{ templateId: 'mat:wire', quantity: 1 }] },
      ...branches.map((branch) => ({ id: branch.actionId, from: 'shortage', to: branch.state, execution: 'family_operation',
        itemTemplateId: id.key, materials: [{ templateId: 'mat:wire', quantity: branch.material }] })),
      ...branches.map((branch) => ({ id: `settle_${branch.state}`, from: branch.state, to: 'settled', execution: 'family_operation',
        itemTemplateId: id.key, materials: [{ templateId: 'mat:wire', quantity: 1 }] })),
    ] }]);
  const world = worlds[0];
  const worldRequirement = (state, controller = false) => ({ adapter: 'world_state', requirement: {
    objectId: id.object, definitionHash: world.contentHash, state, ...(controller ? { controller: 'current_family' } : {}),
  } });
  const operations = compileFamilyOperations(registry, worlds, [
    ...branches.map((branch) => ({ ...branch, from: 'shortage' })),
    ...branches.map((branch) => ({ ...branch, operationId: `operation:dock_settle_${branch.state}`,
      title: branch.state === 'protected' ? 'Restore the Protected Dock Route' : branch.state === 'intercepted' ? 'Stabilize the Seized Dock Route' : 'Maintain the Crew Canal Crossing',
      actionId: `settle_${branch.state}`, from: branch.state, material: 1 })),
  ].map((branch) => ({
    id: branch.operationId, version: 1, title: branch.title, lifetimeSeconds: 86400, executorRoleId: 'organizer',
    ...(branch.state === 'alternate_route' && branch.from === 'shortage' ? { admission: [mystery(id.tide)] } : {}),
    roles: [
      { id: 'organizer', title: 'Route Organizer', requirements: [
        { id: 'presence', kind: 'participation', quantity: 1 },
        { id: 'route_state', kind: 'prerequisite', quantity: 1, predicate: worldRequirement(branch.from, branch.state === 'protected') },
        ...(branch.state === 'alternate_route' && branch.from === 'shortage'
          ? [{ id: 'verified_crossing', kind: 'information', quantity: 1, knowledge: alternate }] : []),
      ] },
      { id: 'runner', title: branch.state === 'alternate_route' ? 'Crew Canal Runner' : 'Shipment Runner', requirements: [
        { id: 'route_seal', kind: 'item', templateId: id.key, quantity: 1 },
        { id: 'wire', kind: 'resource', templateId: 'mat:wire', quantity: branch.material },
        ...(branch.state === 'alternate_route' ? [{ id: 'same_crew', kind: 'prerequisite', quantity: 1,
          predicate: { adapter: 'social', requirement: { relation: 'same_crew', subject: 'organizer' } } }] : []),
      ] },
    ],
    world: { objectId: id.object, actionId: branch.actionId, itemRoleId: 'runner', itemRequirementId: 'route_seal' },
    resolution: { chancePermille: 1000, skillBonuses: [] },
  })));
  packages.push({ id: id.aftermath, version: 1, season: 'core', dependsOn: [id.assets], nodes: branches.map((branch) => {
    const operation = operations.find((entry) => entry.id === branch.operationId);
    return { id: `mystery:dock_${branch.state}_aftermath`, type: 'mystery_step', version: 1, visibility: 'hidden',
      conditions: [worldRequirement(branch.state), { adapter: 'family_operation_outcome', requirement: {
        definitionId: operation.id, definitionHash: operation.contentHash, outcome: 'completed',
      } }], metadata: { title: branch.state === 'protected' ? 'The Family Holds the Dock' : branch.state === 'intercepted' ? 'The Dock Changes Hands' : 'The Crew Opens a Quiet Passage',
        description: 'The route records who acted and which materials were spent. Its new condition creates the next local decision.', terminal: true } };
  }) });
  registry = loadAndValidateGraphPackages(packages);
  validateCraftingDefinitions(registry); validateMysteryDefinitions(registry);
  const sources = freeze({ objects: worlds.map(stripHash), operations: operations.map(stripHash),
    recipeIds: [id.recipe], mysteryGraphIds: [id.evidence, id.aftermath],
    knowledgeSources: graph.nodes.filter((node) => node.claim).map((node) => claim(node.id)),
    routeKnowledge: route, alternateKnowledge: alternate, branches,
  });
  return Object.freeze({ ...sources, ids: id, registry, worldDefinitions: worlds, operationDefinitions: operations,
    coordinationRegistry: createCoordinationRegistry([stripHash(graph)]), progression: true });
}
