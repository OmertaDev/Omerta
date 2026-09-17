// A source-controlled continuation beside the existing Furnace Ledger storylet.
// A surviving carbon index records seized deliveries; it makes no claim about
// which papers that separate storylet burned or who owns its shop. No DB writes.
import { WORLD_KERNEL_REGISTRY } from './world-kernel-pilot.js';
import { loadAndValidateGraphPackages } from '../worldgraph-validate.js';
import { mysteryDefinitionHash } from '../mysteries.js';
import { compileCoordinationGraph } from '../coordination/graph.js';
import { compileWorldObjects } from '../world-kernel.js';
import { compileFamilyOperations } from '../coordination/operation-definitions.js';
import { compileProgressionContent } from './progression-admission.js';

export const FURNACE_IDS = Object.freeze({
  base: 'furnace-archive-assets', inspection: 'furnace-archive-inspection',
  coordination: 'omerta.coordination.furnace-archive', workshop: 'furnace-archive-workshop',
  deduction: 'furnace-archive-deduction', epilogue: 'furnace-archive-aftermath',
  key: 'item:furnace_archive_key', recipe: 'recipe:furnace_archive_key',
  entry: 'mystery:furnace_manifest', impression: 'mystery:furnace_countermark',
  choice: 'choice:furnace_archive_fate', preserve: 'mystery:furnace_preserve', expose: 'mystery:furnace_expose',
  object: 'facility:furnace_carbon_archive',
  preserveOperation: 'operation:preserve_furnace_archive', exposeOperation: 'operation:expose_furnace_archive',
  preservedEpilogue: 'mystery:furnace_preserved_aftermath', exposedEpilogue: 'mystery:furnace_exposed_aftermath',
});
const at = (value) => ({ adapter: 'location', value });
const interaction = (interactionId) => ({ adapter: 'explicit_interaction', interactionId });
const completed = (nodeId) => ({ kind: 'node_completed', nodeId });
const all = (...rules) => ({ kind: 'all', rules });
const knowledge = (requirement) => ({ adapter: 'knowledge', requirement });
const social = (relation, subject) => ({ adapter: 'social', requirement: { relation, ...(subject ? { subject } : {}) } });
const stripHash = ({ contentHash: _hash, ...source }) => source;

/** All downstream hashes are computed only after their prerequisite stage. */
export function createFurnaceLedger() {
  const id = FURNACE_IDS;
  const packages = [...WORLD_KERNEL_REGISTRY.byPackage.values()];
  packages.push({ id: id.base, version: 1, season: 'core', dependsOn: ['core-materials'], nodes: [
    { id: id.key, type: 'item_template', version: 1, visibility: 'hidden',
      metadata: { title: 'Carbon Archive Key', inventoryClass: 'unique', inert: true, tradeable: false, exportEligible: false } },
  ] });
  packages.push({ id: id.inspection, version: 1, season: 'core', dependsOn: [id.base], nodes: [
    { id: id.entry, type: 'mystery_step', version: 1, visibility: 'public',
      conditions: [at('docks'), interaction('inspect_seized_steel_manifest')],
      metadata: { title: 'A Carbon Copy Survives', description: 'A waterlogged shipping index lists seized steel. Compare its dates before trusting the missing accounts.' } },
    { id: id.impression, type: 'mystery_step', version: 1, visibility: 'hidden', requires: [id.entry],
      conditions: [at('foundry'), { adapter: 'item_ownership', requirement: { templateId: id.key, provenance: 'crafted' } },
        interaction('read_reversed_countermark')],
      metadata: { title: 'The Reversed Countermark', description: 'The key fits an old stamping jig. Its reverse face dates the deliveries after the confiscation.', terminal: true } },
  ] });
  const inspectionRegistry = loadAndValidateGraphPackages(packages);
  const mysteryState = (registry, graphId, nodeId) => ({ adapter: 'mystery_state', requirement: {
    graphId, graphVersion: 1, definitionHash: mysteryDefinitionHash(registry, graphId), nodeId,
    ownerScope: 'current_character', state: 'completed',
  } });
  const domain = 'omerta.knowledge.furnace-archive';
  const sourceClaim = { domain, proposition: 'seized-steel.redirected', value: { type: 'text', value: 'deliveries-after-confiscation' } };
  const localSource = { kind: 'any', rules: [completed('manifest-source'), completed('countermark-source')] };
  const independent = { kind: 'independent_evidence', ...sourceClaim, sourceRoots: ['docks.carbon-manifest', 'foundry.reversed-countermark'] };
  const graph = compileCoordinationGraph({ schemaVersion: 2, id: id.coordination, version: 1,
    title: 'The Missing Carbon Index', nodes: [
      { id: 'briefing', kind: 'task', title: 'Compare the Surviving Records', visibility: 'public',
        description: 'A shipping index and an old stamping jig survived the shop’s disputes. Their original discoverers must compare notes.',
        discover: { kind: 'always' }, requires: { kind: 'always' } },
      { id: 'manifest-source', kind: 'task', title: 'Read the Dated Carbon Copy', visibility: 'hidden',
        description: 'The steel moved after the seizure. The punched margin supplies a cutting pattern.',
        discover: all(completed('briefing'), { kind: 'at_district', districtId: 'docks' }), requires: { kind: 'always' },
        admission: [mysteryState(inspectionRegistry, id.inspection, id.entry)],
        claim: { ...sourceClaim, sourceRoot: 'docks.carbon-manifest' } },
      { id: 'countermark-source', kind: 'task', title: 'Record the Jig Impression', visibility: 'hidden',
        description: 'The reversed countermark independently dates the same diverted loads.',
        discover: all(completed('briefing'), { kind: 'at_district', districtId: 'foundry' }), requires: { kind: 'always' },
        admission: [mysteryState(inspectionRegistry, id.inspection, id.impression)],
        claim: { ...sourceClaim, sourceRoot: 'foundry.reversed-countermark' } },
      { id: 'corroborated-index', kind: 'task', title: 'Locate the Duplicate Accounts', visibility: 'hidden',
        description: 'Independent dates expose an omitted storage entry. Keep the address between the people who verified it.',
        discover: all(localSource, independent), requires: all(localSource, independent), admission: [social('crew_member')],
        claim: { domain, proposition: 'duplicate-accounts.location', sourceRoot: 'corroborated.carbon-index',
          value: { type: 'text', value: 'beneath-the-quench-floor' } } },
      { id: 'case-recorded', kind: 'terminal', title: 'Record the Corroboration', visibility: 'hidden',
        discover: completed('corroborated-index'), requires: completed('corroborated-index') },
    ] });
  const claim = (nodeId) => ({ contentHash: graph.contentHash, ...graph.nodes.find((node) => node.id === nodeId).claim });
  const firstClaim = claim('manifest-source'), corroborated = claim('corroborated-index');
  packages.push({ id: id.workshop, version: 1, season: 'core', dependsOn: [id.base, 'automotive-salvage'], nodes: [
    { id: id.recipe, type: 'recipe', version: 1, visibility: 'public', repeatability: 'repeatable',
      metadata: { title: 'Cut a Carbon Archive Key' },
      discovery: { mode: 'secret', requirements: [knowledge(firstClaim)] },
      scarcity: { caps: [{ scope: 'account', period: 'lifetime', limit: 2 }, { scope: 'global', period: 'lifetime', limit: 64 }] },
      consumes: [{ templateId: 'mat:scrap_steel', quantity: 2 }, { templateId: 'mat:wire', quantity: 1 }],
      produces: [{ templateId: id.key, quantity: 1 }], conditions: [at('foundry'), knowledge(firstClaim)] },
  ] });
  packages.push({ id: id.deduction, version: 1, season: 'core', dependsOn: [id.base], nodes: [
    { id: id.choice, type: 'choice', version: 1, visibility: 'discovered',
      conditions: [at('foundry'), knowledge(corroborated)],
      metadata: { title: 'Who Should Hold the Duplicate?', description: 'The record is authentic. Preserve it under Family custody, or expose the diverted loads to the district. This choice cannot be changed.' },
      options: [
        { id: 'preserve', title: 'Preserve the accounts under Family custody', excludes: [id.expose], effects: [{ adapter: 'discover', nodeId: id.preserve }] },
        { id: 'expose', title: 'Expose the diverted loads to the district', excludes: [id.preserve], effects: [{ adapter: 'discover', nodeId: id.expose }] },
      ] },
    ...[['preserve', id.preserve, id.expose], ['expose', id.expose, id.preserve]].map(([branch, nodeId, other]) => ({
      id: nodeId, type: 'mystery_step', version: 1, visibility: 'hidden', requires: [id.choice], excludes: [other],
      conditions: [knowledge(corroborated), interaction(`confirm_${branch}_carbon_archive`)],
      metadata: { title: branch === 'preserve' ? 'Authorize Protected Custody' : 'Authorize Public Disclosure', terminal: true },
    })),
  ] });
  const workingRegistry = loadAndValidateGraphPackages(packages);
  const worldDefinitions = compileWorldObjects(workingRegistry, [{
    id: id.object, type: 'facility', title: 'The Carbon Archive', locationId: 'foundry',
    states: ['sealed', 'preserved', 'exposed'], initialState: 'sealed', publicStates: ['preserved', 'exposed'], knowledge: [corroborated],
    actions: ['preserve', 'expose'].map((branch) => ({ id: `${branch}_archive`, from: 'sealed',
      to: branch === 'preserve' ? 'preserved' : 'exposed', execution: 'family_operation', itemTemplateId: id.key,
      materials: [{ templateId: 'mat:wire', quantity: 1 }] })),
  }]);
  const familyDefinitions = compileFamilyOperations(workingRegistry, worldDefinitions, ['preserve', 'expose'].map((branch) => ({
    id: branch === 'preserve' ? id.preserveOperation : id.exposeOperation, version: 1,
    title: branch === 'preserve' ? 'Secure the Carbon Archive' : 'Expose the Carbon Archive', lifetimeSeconds: 86400, executorRoleId: 'organizer',
    admission: [mysteryState(workingRegistry, id.deduction, id[branch])],
    roles: [
      { id: 'organizer', title: 'Organizer', requirements: [
        { id: 'presence', kind: 'participation', quantity: 1 }, { id: 'funding', kind: 'capital', quantity: 100 },
        { id: 'deduction', kind: 'prerequisite', quantity: 1, predicate: mysteryState(workingRegistry, id.deduction, id[branch]) },
      ] },
      { id: 'locksmith', title: 'Locksmith', requirements: [{ id: 'archive_key', kind: 'item', templateId: id.key, quantity: 1 }] },
      { id: 'supplier', title: 'Supplier', requirements: [{ id: 'wire', kind: 'resource', templateId: 'mat:wire', quantity: 1 }] },
      { id: 'researcher', title: 'Independent Researcher', requirements: [
        { id: 'corroboration', kind: 'information', knowledge: corroborated, quantity: 1 },
        { id: 'another_crew', kind: 'prerequisite', quantity: 1, predicate: social('different_crew', 'organizer') },
        { id: 'same_family', kind: 'prerequisite', quantity: 1, predicate: social('same_family', 'organizer') },
      ] },
    ],
    world: { objectId: id.object, actionId: `${branch}_archive`, itemRoleId: 'locksmith', itemRequirementId: 'archive_key' },
    resolution: { chancePermille: 1000, skillBonuses: [] },
  })));
  packages.push({ id: id.epilogue, version: 1, season: 'core', dependsOn: [id.base], nodes: familyDefinitions.map((operation, index) => ({
    id: index === 0 ? id.preservedEpilogue : id.exposedEpilogue, type: 'mystery_step', version: 1, visibility: 'hidden',
    conditions: [{ adapter: 'family_operation_outcome', requirement: { definitionId: operation.id, definitionHash: operation.contentHash, outcome: 'completed' } },
      { adapter: 'world_state', requirement: { objectId: id.object, definitionHash: worldDefinitions[0].contentHash, state: index === 0 ? 'preserved' : 'exposed' } }],
    metadata: { title: index === 0 ? 'The Family Holds the Carbon Copy' : 'The District Reads the Carbon Copy',
      description: index === 0 ? 'The archive remains under the Family’s recorded custody. Your participation is part of that history.' : 'The diversion is now a public fact. Your participation in exposing it remains recorded.', terminal: true },
  })) });
  const source = { packages, coordination: [stripHash(graph)], worldObjects: worldDefinitions.map(stripHash), familyOperations: familyDefinitions.map(stripHash),
    manifest: { id: 'omerta.progression.furnace-archive', version: 1, title: 'Furnace Ledger: The Archive',
      packageIds: [id.base, id.inspection, id.workshop, id.deduction, id.epilogue], coordinationGraphIds: [id.coordination],
      worldObjectIds: [id.object], familyOperationIds: familyDefinitions.map((operation) => operation.id),
      entry: { graphId: id.inspection, nodeId: id.entry }, choice: { graphId: id.deduction, nodeId: id.choice },
      branches: ['preserve', 'expose'].map((branch, index) => ({ optionId: branch, nodeId: id[branch],
        operationId: familyDefinitions[index].id, worldState: index === 0 ? 'preserved' : 'exposed', epilogueGraphId: id.epilogue,
        epilogueNodeId: index === 0 ? id.preservedEpilogue : id.exposedEpilogue })) } };
  const admission = compileProgressionContent(source, { baseRegistry: WORLD_KERNEL_REGISTRY });
  return Object.freeze({ ...admission, admission, objects: admission.source.worldObjects, operations: admission.source.familyOperations,
    recipeIds: Object.freeze([id.recipe]), mysteryGraphIds: Object.freeze([id.inspection, id.deduction, id.epilogue]) });
}
