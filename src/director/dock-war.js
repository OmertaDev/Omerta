// One authored campaign; later situations are admitted only after a committed
// World Kernel outcome. No Director definition grants materials or information.
import { coordinationGraphs } from '../coordination/graph.js';
import { mysteryDefinitionHash } from '../mysteries.js';
import { DOCK_WAR_IDS } from '../content/dock-war.js';
import { compileDirectorDefinitions, DIRECTOR_RECOVERY_TRIGGERS } from './definitions.js';

export const DOCK_WAR_CAMPAIGN_ID = 'campaign:the_dock_war';
export const DOCK_WAR_SITUATION_IDS = Object.freeze({ opening: 'situation:dock_shortage',
  protected: 'situation:dock_protected_aftermath', intercepted: 'situation:dock_intercepted_aftermath',
  alternate_route: 'situation:dock_alternate_route_aftermath' });
const eq = (fact, value) => ({ fact, op: 'eq', value });
const cooldown = () => ({ seconds: 86400, quietSeconds: 300, repetitionWindowSeconds: 604800, maximumPerWindow: 2 });
const recovery = () => ({ on: [...DIRECTOR_RECOVERY_TRIGGERS], policy: 'expire', to: 'abandoned', maxAttempts: 1, afterSeconds: 172800 });
const concurrency = () => ({ global: 32, perScope: 1, perPlayer: 3, perCrew: 4, perFamily: 6, perTerritory: 1 });
const consequence = (id, actionId, fromState, toState) => ({ id, adapter: 'world_action', objectId: DOCK_WAR_IDS.object,
  actionId, fromState, toState, economicEffects: 'existing_action_only' });
const operation = (id, definitionId) => ({ id, kind: 'family_operation', definitionId });
const command = (id, commandType, targetId, audienceId) => ({ id, commandType, targetId, audienceId });
const signal = (id, audienceId, title, description, knowledgeLevel, commandAdapterIds) => ({
  id, audienceId, title, description, knowledgeLevel, commandAdapterIds,
});

export function dockWarDefinitionSources(content) {
  const ids = DOCK_WAR_IDS;
  const audiences = [
    { id: 'holder', kind: 'controller_family', knowledge: content.routeKnowledge },
    { id: 'rival', kind: 'rival_family', knowledge: content.routeKnowledge },
    { id: 'investigators', kind: 'crew', knowledge: null },
    { id: 'canal_crew', kind: 'crew', knowledge: content.alternateKnowledge },
  ];
  const opening = {
    id: DOCK_WAR_SITUATION_IDS.opening, version: 1, category: 'economic', scope: 'territory', objectId: ids.object,
    eligibility: [eq('worldState', 'shortage'), { fact: 'resourceDeficit', op: 'gte', value: 1 }],
    pressureInputs: ['resourceDeficit', 'territoryControl'],
    requiredWorldFacts: [{ fact: 'controllerFamilyId', op: 'present', value: true }], excludedWorldFacts: [],
    audiences,
    initialSignals: [
      signal('dock_notice', 'investigators', 'A dock worker wants a quiet word',
        'A dock worker is asking for careful readers of the shipping register. Your Crew can investigate the record and compare the tide ledger.',
        'rumor', ['investigate', 'tide_ledger']),
      signal('protect_notice', 'holder', 'Your dock shipment needs protection',
        'Your Family controls the route, but available wire cannot cover a complete shipment response. Gather a runner, a crafted route seal and the missing supplies to protect it.',
        'known', ['protect']),
      signal('intercept_notice', 'rival', 'The rival dock route is vulnerable',
        'The shipping register confirms a contested opportunity. Your Family can gather a runner, a crafted route seal and wire to intercept the load.',
        'known', ['intercept']),
      signal('canal_notice', 'canal_crew', 'Your Crew found a quiet crossing',
        'Independent tide and survey evidence confirm a canal passage. Two members of your Crew can move the load with less wire and avoid an attack.',
        'known', ['alternate']),
    ],
    states: ['rumor', 'mobilizing', 'urgent', 'protected', 'intercepted', 'alternate_route', 'expired', 'abandoned'],
    initialState: 'rumor', terminalStates: ['protected', 'intercepted', 'alternate_route', 'expired', 'abandoned'],
    possibleEscalations: [
      { id: 'mobilize', from: 'rumor', to: 'mobilizing', afterSeconds: 3600, when: [eq('worldState', 'shortage')] },
      { id: 'last_call', from: 'mobilizing', to: 'urgent', afterSeconds: 21600, when: [eq('worldState', 'shortage')] },
    ],
    possibleResolutions: [
      { id: 'protect', from: ['rumor', 'mobilizing', 'urgent'], to: 'protected', consequenceId: 'shipment_protected' },
      { id: 'intercept', from: ['rumor', 'mobilizing', 'urgent'], to: 'intercepted', consequenceId: 'shipment_intercepted' },
      { id: 'alternate', from: ['rumor', 'mobilizing', 'urgent'], to: 'alternate_route', consequenceId: 'canal_opened' },
    ],
    expiryPolicy: { afterSeconds: 172800, to: 'expired' }, recoveryPolicy: recovery(), cooldownPolicy: cooldown(),
    consequenceContracts: [
      consequence('shipment_protected', 'protect_shipment', 'shortage', 'protected'),
      consequence('shipment_intercepted', 'intercept_shipment', 'shortage', 'intercepted'),
      consequence('canal_opened', 'open_alternate_route', 'shortage', 'alternate_route'),
    ],
    commandAdapters: [
      command('investigate', 'discovery.start', ids.coordination, 'investigators'),
      command('tide_ledger', 'mystery.start', ids.evidence, 'investigators'),
      command('protect', 'operation.create', ids.protectOperation, 'holder'),
      // Sharing remains the ordinary knowledge.share command on an owned claim
      // and a current group; a situation never substitutes either authority.
      command('intercept', 'operation.create', ids.interceptOperation, 'rival'),
      command('alternate', 'operation.create', ids.alternateOperation, 'canal_crew'),
    ],
    coordinationAdapters: [operation('protection', ids.protectOperation), operation('interception', ids.interceptOperation),
      operation('peaceful_crossing', ids.alternateOperation)],
    mysteryAdapters: [{ id: 'independent_tide_evidence', graphId: ids.evidence, nodeId: ids.tide },
      { id: 'crafted_survey_evidence', graphId: ids.evidence, nodeId: ids.chart }],
    rarity: 'common', weight: 100, concurrencyPolicy: concurrency(),
    participants: { minimumPlayers: 2, minimumFamilies: 1, minimumCrews: 1 },
  };
  const aftermaths = [
    { state: 'protected', outcome: 'protect', title: 'The Family holds the dock',
      description: 'The protection operation kept the route under Family control. Restore its working supply line with a runner, a route seal and wire.',
      publicDescription: 'The dock stayed under its controller. Workers are waiting for the route to reopen.', operationId: ids.protectedAftermathOperation },
    { state: 'intercepted', outcome: 'intercept', title: 'The dock has changed hands',
      description: 'The interception changed control of the route. The new holders must organize repairs before the captured supply line can settle.',
      publicDescription: 'A different Family now holds the dock route. The captured supply line needs repairs.', operationId: ids.interceptedAftermathOperation },
    { state: 'alternate_route', outcome: 'alternate', title: 'A Crew opened the canal crossing',
      description: 'The verified canal route avoided a direct attack and used less wire. Members of one Crew can now maintain the crossing and secure its future.',
      publicDescription: 'A Crew found another way through the docks. The canal passage now needs maintenance.', operationId: ids.alternateAftermathOperation },
  ];
  const followups = aftermaths.map((branch) => ({
    id: DOCK_WAR_SITUATION_IDS[branch.state], version: 1,
    category: branch.state === 'alternate_route' ? 'social' : 'territory', scope: 'territory', objectId: ids.object,
    eligibility: [eq('worldState', branch.state)], pressureInputs: ['territoryControl'],
    requiredWorldFacts: [{ fact: 'controllerFamilyId', op: 'present', value: true }], excludedWorldFacts: [],
    audiences: [{ id: 'holder', kind: 'controller_family', knowledge: content.routeKnowledge },
      { id: 'aftermath', kind: 'public', knowledge: null }],
    initialSignals: [signal('next_decision', 'holder', branch.title, branch.description, 'known', ['restore']),
      signal('visible_aftermath', 'aftermath', branch.title, branch.publicDescription, 'public', ['investigate_aftermath'])],
    states: ['aftermath', 'urgent', 'settled', 'expired', 'abandoned'], initialState: 'aftermath',
    terminalStates: ['settled', 'expired', 'abandoned'],
    possibleEscalations: [{ id: 'repair_deadline', from: 'aftermath', to: 'urgent', afterSeconds: 43200, when: [eq('worldState', branch.state)] }],
    possibleResolutions: [{ id: 'settle', from: ['aftermath', 'urgent'], to: 'settled', consequenceId: 'route_settled' }],
    expiryPolicy: { afterSeconds: 259200, to: 'expired' }, recoveryPolicy: { ...recovery(), afterSeconds: 259200 }, cooldownPolicy: cooldown(),
    consequenceContracts: [consequence('route_settled', `settle_${branch.state}`, branch.state, 'settled')],
    commandAdapters: [command('restore', 'operation.create', branch.operationId, 'holder'),
      command('investigate_aftermath', 'mystery.start', ids.aftermath, 'aftermath')],
    coordinationAdapters: [operation('restoration', branch.operationId)],
    mysteryAdapters: [{ id: 'consequence_record', graphId: ids.aftermath, nodeId: `mystery:dock_${branch.state}_aftermath` }],
    rarity: 'common', weight: 120, concurrencyPolicy: concurrency(),
    participants: { minimumPlayers: 2, minimumFamilies: 1, minimumCrews: 1 },
  }));
  const campaign = {
    id: DOCK_WAR_CAMPAIGN_ID, version: 1, title: 'The Dock War', entryNode: 'shortage',
    nodes: [{ id: 'shortage', situationId: opening.id, terminal: false },
      ...aftermaths.map((branch) => ({ id: branch.state, situationId: DOCK_WAR_SITUATION_IDS[branch.state], terminal: true }))],
    branches: aftermaths.map((branch) => ({ id: `after_${branch.outcome}`, from: 'shortage', to: branch.state,
      outcome: branch.outcome, when: [eq('worldState', branch.state)] })),
    maxDurationSeconds: 604800, recoveryPolicy: { ...recovery(), afterSeconds: 604800 },
    cooldownPolicy: cooldown(), maxActive: 1,
  };
  return { situations: [opening, ...followups], campaigns: [campaign] };
}

export function dockWarDefinitionCatalog(content) {
  return { worldDefinitions: content.worldDefinitions, operationDefinitions: content.operationDefinitions,
    knowledgeSources: content.knowledgeSources, coordinationProfiles: coordinationGraphs(content.coordinationRegistry),
    mysteryDefinitions: content.mysteryGraphIds.map((graphId) => ({ id: graphId,
      contentHash: mysteryDefinitionHash(content.registry, graphId), nodes: content.registry.byPackage.get(graphId).nodes })),
  };
}

export function createDockWarDefinitions(content) {
  return compileDirectorDefinitions(dockWarDefinitionSources(content), dockWarDefinitionCatalog(content));
}
