// Authored extensions of the existing domain catalogs. The Director cannot
// create a shipment, stock a market, manufacture evidence or name a culprit.
import { createDockWarContent, DOCK_WAR_IDS } from './dock-war.js';
import { loadAndValidateGraphPackages } from '../worldgraph-validate.js';
import { validateCraftingDefinitions } from '../crafting.js';
import { validateMysteryDefinitions, mysteryDefinitionHash } from '../mysteries.js';
import { compileCoordinationGraph, coordinationGraphs, createCoordinationRegistry } from '../coordination/graph.js';
import { compileWorldObjects } from '../world-kernel.js';
import { compileFamilyOperations } from '../coordination/operation-definitions.js';

export const CAMPAIGN_NETWORK_IDS = Object.freeze({
  object: 'infrastructure:canal_supply_depot', assets: 'campaign-network-assets', workshop: 'campaign-network-workshop',
  seal: 'item:canal_cargo_seal', recipe: 'recipe:canal_cargo_seal',
  routeGraph: 'omerta.coordination.canal-register', intelligenceGraph: 'omerta.coordination.informant-review',
  shipmentEvidence: 'missing-shipment-evidence', informantEvidence: 'informant-public-trail', failureEvidence: 'informant-failed-plan',
  personalEvidence: 'canal-shipping-records', personalIndex: 'mystery:canal_record_index', disclosureRecord: 'mystery:canal_disclosure_record',
  shipmentLog: 'mystery:shipment_dispatch_log', cargoMarks: 'mystery:shipment_cargo_marks',
  notice: 'mystery:informant_public_notice', copy: 'mystery:informant_dispatch_copy', failure: 'mystery:informant_failed_plan',
});
const stripHash = ({ contentHash: _hash, ...source }) => source;
const freeze = (value) => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const at = (value) => ({ adapter: 'location', value });
const interaction = (interactionId) => ({ adapter: 'explicit_interaction', interactionId });
const complete = (nodeId) => ({ kind: 'node_completed', nodeId });
const all = (...rules) => ({ kind: 'all', rules });
const opId = (action) => `operation:canal_${action}`;

export function createCampaignNetworkContent(baseContent) {
  const dock = baseContent?.ids?.object === DOCK_WAR_IDS.object ? baseContent : createDockWarContent(baseContent);
  const id = CAMPAIGN_NETWORK_IDS, packages = [...dock.registry.byPackage.values()];
  packages.push({ id: id.assets, version: 1, season: 'core', dependsOn: ['core-materials'], nodes: [
    { id: id.seal, type: 'item_template', version: 1, visibility: 'public', metadata: {
      title: 'Canal Cargo Seal', inventoryClass: 'unique', inert: true, tradeable: false, exportEligible: false,
    } },
  ] });
  const domain = 'omerta.knowledge.canal-network';
  const routeGraph = compileCoordinationGraph({ schemaVersion: 2, id: id.routeGraph, version: 1,
    title: 'The Canal Shipping Register', nodes: [
      { id: 'briefing', kind: 'task', title: 'Read the Canal Register', visibility: 'public',
        description: 'The register names the depot and its cargo seals. Every load still needs a working route and supplies from someone\'s stores.',
        discover: { kind: 'always' }, requires: { kind: 'always' } },
      { id: 'route-source', kind: 'task', title: 'Copy the Depot Instructions', visibility: 'hidden',
        discover: all(complete('briefing'), { kind: 'at_district', districtId: 'docks' }), requires: { kind: 'always' },
        claim: { domain, proposition: 'depot.route', sourceRoot: 'docks.canal-register', value: { type: 'text', value: id.object } } },
      { id: 'recorded', kind: 'terminal', title: 'Keep the Shipping Instructions', visibility: 'hidden',
        discover: complete('route-source'), requires: complete('route-source') },
    ] });
  const claim = (graph, nodeId) => ({ contentHash: graph.contentHash, ...graph.nodes.find((node) => node.id === nodeId).claim });
  const routeKnowledge = claim(routeGraph, 'route-source');
  packages.push({ id: id.workshop, version: 1, season: 'core', dependsOn: [id.assets, 'automotive-salvage'], nodes: [
    { id: id.recipe, type: 'recipe', version: 1, visibility: 'public', repeatability: 'repeatable',
      metadata: { title: 'Stamp a Canal Cargo Seal' },
      discovery: { mode: 'secret', requirements: [{ adapter: 'knowledge', requirement: routeKnowledge }] },
      consumes: [{ templateId: 'mat:scrap_steel', quantity: 2 }, { templateId: 'mat:salvage_parts', quantity: 1 }],
      produces: [{ templateId: id.seal, quantity: 1 }],
      conditions: [at('foundry'), { adapter: 'knowledge', requirement: routeKnowledge }] },
  ] });
  let registry = loadAndValidateGraphPackages(packages);
  // These amounts are physical inputs committed through existing custody. A
  // supplied market is infrastructure, not a second spendable inventory store.
  const responses = [
    ['register_shipment', 'idle', 'stranded', 2, 'Register a Load on the Disrupted Route'],
    ['recover_shipment', 'stranded', 'recovered', 1, 'Recover the Missing Shipment'],
    ['intercept_shipment', 'stranded', 'diverted', 2, 'Intercept the Missing Shipment'],
    ['destroy_shipment', 'stranded', 'destroyed', 1, 'Destroy the Stranded Depot'],
    ['redistribute_shipment', 'stranded', 'redistributed', 1, 'Reopen the Community Supply Route'],
    ['establish_market', 'diverted', 'market_open', 1, 'Establish the Canal Black Market'],
    ['supply_market', 'market_open', 'market_supplied', 2, 'Supply the Canal Black Market'],
    ['expose_market', 'market_open', 'exposed', 1, 'Expose the Canal Black Market'],
    ['restore_supply', 'market_open', 'restored', 1, 'Restore the Registered Supply Route'],
    ['seize_market', 'market_open', 'market_seized', 2, 'Seize the Canal Market Route'],
    ['trace_disclosure', 'exposed', 'public_trace', 1, 'Document the Public Disclosure'],
    ['secure_records', 'exposed', 'secured', 1, 'Secure the Shipping Records'],
    ['publish_allegation', 'exposed', 'unproven', 1, 'Publish an Uncorroborated Allegation'],
    ['review_failed_plan', 'stranded', 'secured', 1, 'Correct the Failed Shipping Plan'],
    ['preserve_uncertainty', 'stranded', 'unproven', 1, 'Record an Unresolved Shipping Concern'],
  ].map(([actionId, from, to, wire, title]) => ({ actionId, from, to, wire, title, operationId: opId(actionId) }));
  const worldSources = [...dock.objects, { id: id.object, type: 'facility', title: 'The Canal Supply Depot', locationId: 'docks',
    states: ['idle', ...new Set(responses.map((entry) => entry.to))], initialState: 'idle',
    publicStates: ['idle', 'recovered', 'destroyed', 'redistributed', 'market_open', 'market_supplied', 'market_seized', 'restored', 'exposed'],
    knowledge: [routeKnowledge], actions: responses.map((entry) => ({ id: entry.actionId, from: entry.from, to: entry.to,
      execution: 'family_operation', itemTemplateId: id.seal, materials: [{ templateId: 'mat:wire', quantity: entry.wire }] })) }];
  const worlds = compileWorldObjects(registry, worldSources);
  const worldRequirement = (objectId, state, controller = false) => ({ adapter: 'world_state', requirement: {
    objectId, definitionHash: worlds.find((world) => world.id === objectId).contentHash, state,
    ...(controller ? { controller: 'current_family' } : {}),
  } });
  packages.push({ id: id.shipmentEvidence, version: 1, season: 'core', dependsOn: [id.assets], nodes: [
    { id: id.shipmentLog, type: 'mystery_step', version: 1, visibility: 'public',
      conditions: [at('docks'), worldRequirement(id.object, 'stranded'), interaction('compare_canal_dispatch_log')],
      metadata: { title: 'The Dispatch Register', description: 'Compare the dock dispatch records when a shipment needs attention. An incomplete entry alone is not proof of theft or interference.' } },
    { id: id.cargoMarks, type: 'mystery_step', version: 1, visibility: 'hidden', requires: [id.shipmentLog],
      conditions: [at('foundry'), { adapter: 'item_ownership', requirement: { templateId: id.seal, provenance: 'crafted' } },
        interaction('compare_canal_cargo_marks')],
      metadata: { title: 'The Cargo Seal Impressions', description: 'Your stamped seal matches the registered depot impressions. The shipping instructions show how a Crew can reopen the neighborhood supply route.', terminal: true } },
  ] });
  packages.push({ id: id.informantEvidence, version: 1, season: 'core', dependsOn: [id.assets], nodes: [
    { id: id.notice, type: 'mystery_step', version: 1, visibility: 'public',
      conditions: [at('docks'), worldRequirement(id.object, 'exposed'), interaction('read_canal_public_notice')],
      metadata: { title: 'The Dock Noticeboard', description: 'Check the dock noticeboard for shipping papers you can examine. A public posting may explain a rumor; it is not proof of betrayal.' } },
    { id: id.copy, type: 'mystery_step', version: 1, visibility: 'hidden', requires: [id.notice],
      conditions: [at('foundry'), { adapter: 'item_ownership', requirement: { templateId: id.seal, provenance: 'crafted' } },
        interaction('compare_canal_notice_copy')],
      metadata: { title: 'The Printer Copy', description: 'The seal authenticates a matching copy of the public notice. An independent reader can corroborate public disclosure; neither copy proves internal betrayal.', terminal: true } },
  ] });
  registry = loadAndValidateGraphPackages(packages);
  const mystery = (graphId, nodeId) => ({ adapter: 'mystery_state', requirement: {
    graphId, graphVersion: 1, definitionHash: mysteryDefinitionHash(registry, graphId), nodeId,
    ownerScope: 'current_character', state: 'completed',
  } });
  const disclosure = { domain, proposition: 'disclosure.source', value: { type: 'text', value: 'public-market-notice' } };
  const independent = { kind: 'independent_evidence', ...disclosure,
    sourceRoots: ['docks.posted-notice', 'foundry.printer-copy'] };
  const intelligenceGraph = compileCoordinationGraph({ schemaVersion: 2, id: id.intelligenceGraph, version: 1,
    title: 'The Informant: Compare the Records', nodes: [
      { id: 'briefing', kind: 'task', title: 'Separate Suspicion from Evidence', visibility: 'public',
        description: 'A public route, a failed plan and a deliberate leak are different explanations. Record only evidence you actually examined.',
        discover: { kind: 'always' }, requires: { kind: 'always' } },
      { id: 'notice-source', kind: 'task', title: 'Record the Posted Notice', visibility: 'hidden',
        discover: complete('briefing'), requires: { kind: 'always' }, admission: [mystery(id.informantEvidence, id.notice)],
        claim: { ...disclosure, sourceRoot: 'docks.posted-notice' } },
      { id: 'copy-source', kind: 'task', title: 'Record the Printer Copy', visibility: 'hidden',
        discover: complete('briefing'), requires: { kind: 'always' }, admission: [mystery(id.informantEvidence, id.copy)],
        claim: { ...disclosure, sourceRoot: 'foundry.printer-copy' } },
      { id: 'corroborated-source', kind: 'task', title: 'Corroborate the Public Trail', visibility: 'hidden',
        discover: all({ kind: 'any', rules: [complete('notice-source'), complete('copy-source')] }, independent),
        requires: independent, admission: [{ adapter: 'social', requirement: { relation: 'crew_member' } }],
        claim: { domain, proposition: 'disclosure.corroborated', sourceRoot: 'corroborated.public-disclosure',
          value: { type: 'text', value: 'public-trail-confirmed-no-culprit-proven' } } },
      { id: 'recorded', kind: 'terminal', title: 'Preserve the Corroboration', visibility: 'hidden',
        discover: complete('corroborated-source'), requires: complete('corroborated-source') },
    ] });
  const noticeKnowledge = claim(intelligenceGraph, 'notice-source');
  const corroboratedKnowledge = claim(intelligenceGraph, 'corroborated-source');
  const operationSource = (entry) => ({ id: entry.operationId, version: 1, title: entry.title,
    lifetimeSeconds: 86400, executorRoleId: 'organizer',
    ...(entry.actionId === 'redistribute_shipment' ? { admission: [mystery(id.shipmentEvidence, id.cargoMarks)] } : {}),
    ...(entry.actionId === 'trace_disclosure' ? { admission: [mystery(id.informantEvidence, id.notice)] } : {}),
    roles: [
      { id: 'organizer', title: 'Route Organizer', requirements: [
        { id: 'presence', kind: 'participation', quantity: 1 },
        ...(entry.from !== 'idle' ? [{ id: 'route_state', kind: 'prerequisite', quantity: 1,
          predicate: worldRequirement(id.object, entry.from, ['recover_shipment', 'redistribute_shipment', 'secure_records', 'review_failed_plan'].includes(entry.actionId)) }] : []),
        ...(['register_shipment', 'recover_shipment', 'intercept_shipment', 'destroy_shipment', 'redistribute_shipment'].includes(entry.actionId)
          ? [{ id: 'blocked_dock', kind: 'prerequisite', quantity: 1, predicate: worldRequirement(DOCK_WAR_IDS.object, 'shortage') }] : []),
        ...(entry.actionId === 'trace_disclosure' ? [{ id: 'independent_records', kind: 'information', quantity: 1, knowledge: corroboratedKnowledge }] : []),
      ] },
      { id: 'runner', title: entry.actionId === 'trace_disclosure' ? 'Independent Crew Reader' : 'Cargo Runner', requirements: [
        { id: 'cargo_seal', kind: 'item', templateId: id.seal, quantity: 1 },
        { id: 'wire', kind: 'resource', templateId: 'mat:wire', quantity: entry.wire },
        ...(['redistribute_shipment', 'trace_disclosure'].includes(entry.actionId) ? [{ id: 'same_crew', kind: 'prerequisite', quantity: 1,
          predicate: { adapter: 'social', requirement: { relation: 'same_crew', subject: 'organizer' } } }] : []),
      ] },
    ], world: { objectId: id.object, actionId: entry.actionId, itemRoleId: 'runner', itemRequirementId: 'cargo_seal' },
    resolution: { chancePermille: entry.actionId === 'recover_shipment' ? 750 : 1000, skillBonuses: [] },
  });
  const ordinaryResponses = responses.filter((entry) => !['review_failed_plan', 'preserve_uncertainty'].includes(entry.actionId));
  let operationSources = [...dock.operations, ...ordinaryResponses.map(operationSource)];
  let operations = compileFamilyOperations(registry, worlds, operationSources);
  const recover = operations.find((entry) => entry.id === opId('recover_shipment'));
  const expose = operations.find((entry) => entry.id === opId('expose_market'));
  packages.push({ id: id.personalEvidence, version: 1, season: 'core', dependsOn: [id.assets], nodes: [
    { id: id.personalIndex, type: 'mystery_step', version: 1, visibility: 'public',
      conditions: [at('docks'), interaction('review_personal_shipping_notes')],
      metadata: { title: 'Your Shipping Records', description: 'Keep your shipping notes here. If you took part in a job, compare its papers; another person\'s private report belongs in their own notebook.' } },
    { id: id.disclosureRecord, type: 'mystery_step', version: 1, visibility: 'hidden', requires: [id.personalIndex],
      conditions: [at('docks'), { adapter: 'family_operation_outcome', requirement: {
        definitionId: expose.id, definitionHash: expose.contentHash, outcome: 'completed',
      } }, interaction('compare_your_disclosure_report')],
      metadata: { title: 'Your Part in the Disclosure', description: 'You participated in disclosing this market route. Your report records that action. Whether the disclosure was authorized is not established, and participation alone does not prove betrayal.', terminal: true } },
  ] });
  packages.push({ id: id.failureEvidence, version: 1, season: 'core', dependsOn: [id.assets], nodes: [
    { id: id.failure, type: 'mystery_step', version: 1, visibility: 'public',
      conditions: [at('docks'), { adapter: 'family_operation_outcome', requirement: {
        definitionId: recover.id, definitionHash: recover.contentHash, outcome: 'failed',
      } }, interaction('review_failed_canal_plan')],
      metadata: { title: 'Review a Recovery Plan', description: 'If you took part in an unsuccessful recovery, examine its report before changing the plan. An unsuccessful plan alone does not establish betrayal.', terminal: true } },
  ] });
  registry = loadAndValidateGraphPackages(packages);
  operationSources = [...operationSources, ...responses.filter((entry) => !ordinaryResponses.includes(entry)).map((entry) => ({
    ...operationSource(entry), admission: [mystery(id.failureEvidence, id.failure)],
  }))];
  operations = compileFamilyOperations(registry, worlds, operationSources);
  validateCraftingDefinitions(registry); validateMysteryDefinitions(registry);
  const graphs = [...coordinationGraphs(dock.coordinationRegistry), routeGraph, intelligenceGraph];
  return Object.freeze({ ...dock, registry, objects: freeze(worlds.map(stripHash)), worldDefinitions: worlds,
    operations: freeze(operations.map(stripHash)), operationDefinitions: operations,
    coordinationRegistry: createCoordinationRegistry(graphs.map(stripHash)),
    recipeIds: freeze([...dock.recipeIds, id.recipe]),
    mysteryGraphIds: freeze([...dock.mysteryGraphIds, id.shipmentEvidence, id.informantEvidence, id.failureEvidence, id.personalEvidence]),
    knowledgeSources: freeze([...dock.knowledgeSources, routeKnowledge,
      ...intelligenceGraph.nodes.filter((node) => node.claim).map((node) => claim(intelligenceGraph, node.id))]),
    network: freeze({ ids: id, routeKnowledge, noticeKnowledge, corroboratedKnowledge, responses }),
    consequencePolicies: freeze([{ objectId: id.object, publicDelaySeconds: 3600 }]),
  });
}
