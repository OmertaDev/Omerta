// Campaigns meet through domain state. There are deliberately no cross-campaign
// IDs in their implications: the next selector pass observes committed facts.
import { CAMPAIGN_NETWORK_IDS } from '../content/campaign-network.js';
import { DOCK_WAR_IDS } from '../content/dock-war.js';
import { dockWarDefinitionSources, dockWarDefinitionCatalog } from './dock-war.js';
import { compileDirectorDefinitions, DIRECTOR_RECOVERY_TRIGGERS } from './definitions.js';

export const CAMPAIGN_NETWORK_SITUATION_IDS = Object.freeze({
  shipment: 'situation:missing_shipment', market: 'situation:black_market_opening',
  marketTrade: 'situation:black_market_supply',
  informant: 'situation:informant_public_trail', failedPlan: 'situation:informant_failed_plan',
});
export const CAMPAIGN_NETWORK_CAMPAIGN_IDS = Object.freeze({
  shipment: 'campaign:the_missing_shipment', market: 'campaign:the_black_market',
  informant: 'campaign:the_informant',
  failedPlan: 'campaign:the_informant_failed_plan',
});
const eq = (fact, value) => ({ fact, op: 'eq', value });
const cooldown = () => ({ seconds: 86400, quietSeconds: 300, repetitionWindowSeconds: 604800, maximumPerWindow: 2 });
const recovery = (afterSeconds) => ({ on: [...DIRECTOR_RECOVERY_TRIGGERS], policy: 'expire', to: 'abandoned', maxAttempts: 1, afterSeconds });
const concurrency = () => ({ global: 32, perScope: 1, perPlayer: 3, perCrew: 4, perFamily: 6, perTerritory: 1 });

export function campaignNetworkDefinitionSources(content) {
  const dock = dockWarDefinitionSources(content), id = CAMPAIGN_NETWORK_IDS, ids = CAMPAIGN_NETWORK_SITUATION_IDS;
  const { routeKnowledge, noticeKnowledge, corroboratedKnowledge, responses } = content.network;
  const audience = (id, kind, knowledge = null) => ({ id, kind, knowledge });
  const command = (id, commandType, targetId, audienceId) => ({ id, commandType, targetId, audienceId });
  const operation = (action, audienceId) => command(action, 'operation.create', responses.find((entry) => entry.actionId === action).operationId, audienceId);
  const signal = (id, audienceId, title, description, knowledgeLevel, commandAdapterIds) => ({ id, audienceId, title, description, knowledgeLevel, commandAdapterIds });
  const info = (signalId, layer, whyKnown, stakes) => ({ signalId, layer, whyKnown, stakes });
  const situation = ({ situationId, from, category, actions, audiences, signals, commands, mysteries = [],
    competition, domains, information, extraFacts = [], relatedWorld = [], implications = {}, weight = 110 }) => {
    const resolved = actions.map((action) => responses.find((entry) => entry.actionId === action));
    return {
      id: situationId, version: 1, category, scope: 'territory', objectId: id.object,
      eligibility: [eq('worldState', from), ...extraFacts], pressureInputs: category === 'information'
        ? ['operationFailure', 'investigation', 'law'] : ['resourceDeficit', 'territoryControl', 'smuggling'],
      requiredWorldFacts: [{ fact: 'controllerFamilyId', op: 'present', value: true }], excludedWorldFacts: [],
      audiences, initialSignals: signals,
      states: ['open', 'urgent', ...new Set(resolved.map((entry) => entry.to)), 'expired', 'abandoned'],
      initialState: 'open', terminalStates: [...new Set(resolved.map((entry) => entry.to)), 'expired', 'abandoned'],
      possibleEscalations: [{ id: 'last_call', from: 'open', to: 'urgent', afterSeconds: 21600, when: [eq('worldState', from)] }],
      possibleResolutions: resolved.map((entry) => ({ id: entry.actionId, from: ['open', 'urgent'], to: entry.to, consequenceId: entry.actionId })),
      expiryPolicy: { afterSeconds: 172800, to: 'expired' }, recoveryPolicy: recovery(172800), cooldownPolicy: cooldown(),
      consequenceContracts: resolved.map((entry) => ({ id: entry.actionId, adapter: 'world_action', objectId: id.object,
        actionId: entry.actionId, fromState: entry.from, toState: entry.to, economicEffects: 'existing_action_only' })),
      commandAdapters: commands,
      coordinationAdapters: commands.filter((entry) => entry.commandType === 'operation.create').map((entry) => ({
        id: entry.id, kind: 'family_operation', definitionId: entry.targetId,
      })),
      mysteryAdapters: mysteries, rarity: 'common', weight, concurrencyPolicy: concurrency(),
      participants: { minimumPlayers: 2, minimumFamilies: 1, minimumCrews: 1 },
      network: { competition, domains, relatedWorld, information,
        implications: resolved.map((entry) => ({ consequenceId: entry.actionId, kind: implications[entry.actionId]?.kind || 'route_access',
          ...(implications[entry.actionId]?.signals ? { signals: implications[entry.actionId].signals } : {}) })) },
    };
  };
  const shipment = situation({ situationId: ids.shipment, from: 'stranded', category: 'economic',
    actions: ['recover_shipment', 'intercept_shipment', 'destroy_shipment', 'redistribute_shipment'],
    audiences: [audience('holder', 'controller_family', routeKnowledge), audience('rival', 'rival_family', routeKnowledge), audience('crew', 'crew')],
    signals: [
      signal('missing_load', 'holder', 'The Missing Shipment',
        'Your Family\'s load is stranded behind a blocked dock route. Recover the depot, or compare the dispatch records and reopen supplies to the neighborhood. Bring a runner, a stamped cargo seal and wire.',
        'known', ['recover_shipment', 'redistribute_shipment']),
      signal('rival_load', 'rival', 'A stranded shipment can change hands',
        'The shipping register identifies a stranded depot. Intercept its route or destroy the depot before another Family moves. Supplies held for an attempt can be reclaimed if you cancel before carrying it out.',
        'known', ['intercept_shipment', 'destroy_shipment']),
      signal('dispatch_rumor', 'crew', 'A dispatch did not get through',
        'The dock register has an unfinished dispatch. Read the route instructions and compare the surviving records before deciding what happened.',
        'rumor', ['read_register', 'inspect_dispatch']),
    ], commands: [operation('recover_shipment', 'holder'), operation('redistribute_shipment', 'holder'),
      operation('intercept_shipment', 'rival'), operation('destroy_shipment', 'rival'),
      command('read_register', 'discovery.start', id.routeGraph, 'crew'), command('inspect_dispatch', 'mystery.start', id.shipmentEvidence, 'crew')],
    mysteries: [{ id: 'dispatch', graphId: id.shipmentEvidence, nodeId: id.shipmentLog }, { id: 'cargo_marks', graphId: id.shipmentEvidence, nodeId: id.cargoMarks }],
    competition: ['CONTESTED', 'COOPERATIVE', 'ESCALATING', 'CASCADE'], domains: ['economy', 'territory', 'family', 'infrastructure'],
    relatedWorld: [{ objectId: DOCK_WAR_IDS.object, states: ['shortage'] }],
    information: [info('missing_load', 'FAMILY_INTELLIGENCE', 'Your Family controls the registered depot and knows its shipping instructions.',
      'Recovery can fail and cost your supplied equipment. A successful interception changes who controls the route.'),
    info('rival_load', 'DISCOVERED_INTELLIGENCE', 'You have verified notes from the depot register.',
      'Another Family may reach the depot before you.'),
    info('dispatch_rumor', 'LOCAL_RUMOR', 'Your Crew is near the dock register.', 'The unfinished dispatch is a lead, not proof of theft.')],
    implications: { intercept_shipment: { kind: 'territory_control', signals: ['route_disruption', 'violence'] },
      destroy_shipment: { kind: 'infrastructure', signals: ['violence', 'route_disruption'] },
      recover_shipment: { kind: 'route_access', signals: ['peaceful'] }, redistribute_shipment: { kind: 'route_access', signals: ['peaceful'] } },
  });
  const market = situation({ situationId: ids.market,
    from: 'diverted', category: 'economic', actions: ['establish_market'],
    audiences: [audience('informed', 'informed', routeKnowledge)],
    signals: [signal('market_lead', 'informed', 'The Black Market',
      'The diverted depot cut off the registered supply route. A Family can open an alternate market here with its own stamped seals and wire.',
    'known', ['establish_market'])],
    commands: [operation('establish_market', 'informed')],
    competition: ['EXCLUSIVE', 'ESCALATING', 'CASCADE'], domains: ['economy', 'territory', 'infrastructure'],
    information: [info('market_lead', 'DISCOVERED_INTELLIGENCE', 'Your shipping instructions identify this depot.',
      'The first Family to open the stalls controls the market route. It must still bring its own supplies.')],
  });
  const marketTrade = situation({ situationId: ids.marketTrade, from: 'market_open', category: 'economic',
    actions: ['supply_market', 'expose_market', 'restore_supply', 'seize_market'],
    audiences: [audience('informed', 'informed', routeKnowledge), audience('aftermath', 'public')],
    signals: [signal('market_choices', 'informed', 'The canal market needs a decision',
      'Bring supplies to the market, seize its route, expose its activity, or rebuild the registered supply line. Each plan needs a stamped cargo seal, a runner and wire from your own stores.',
      'known', ['supply_market', 'expose_market', 'restore_supply', 'seize_market']),
    signal('market_visible', 'aftermath', 'A market opened beside the canal',
      'The canal depot is operating as an alternate market. Its suppliers and private plans remain unknown.', 'public', [])],
    commands: ['supply_market', 'expose_market', 'restore_supply', 'seize_market'].map((action) => operation(action, 'informed')),
    competition: ['CONTESTED', 'COOPERATIVE', 'CASCADE'], domains: ['economy', 'territory', 'law', 'family'],
    information: [info('market_choices', 'DISCOVERED_INTELLIGENCE', 'You know the depot instructions and can identify the market route.',
      'Supplied wire stays with the depot. Exposing the market makes its route public and leaves a paper trail.'),
    info('market_visible', 'PUBLIC_AFTERMATH', 'The depot has opened for trade.', 'You can see the stalls, but their suppliers and private arrangements remain unknown.')],
    implications: { expose_market: { kind: 'evidence', signals: ['investigation'] },
      seize_market: { kind: 'territory_control', signals: ['violence'] },
      restore_supply: { kind: 'route_access', signals: ['peaceful'] }, supply_market: { kind: 'material_availability', signals: ['peaceful'] } },
  });
  const informant = situation({ situationId: ids.informant, from: 'exposed', category: 'information',
    actions: ['trace_disclosure', 'secure_records', 'publish_allegation'],
    audiences: [audience('readers', 'informed', noticeKnowledge), audience('corroborated', 'informed', corroboratedKnowledge), audience('crew', 'crew', routeKnowledge)],
    signals: [signal('leak_concern', 'readers', 'The Informant',
      'Someone knew the market route. The notice you examined is one public source, not proof of betrayal. Secure the records, compare independent evidence, or publish a disputed allegation with its uncertainty preserved.',
      'known', ['secure_records', 'publish_allegation']),
    signal('public_trail', 'corroborated', 'Two independent records explain the disclosure',
      'Two readers independently examined the posted notice and printer copy. Your Crew can document how the route became public without naming anyone guilty.',
      'known', ['trace_disclosure']),
    signal('notice_lead', 'crew', 'The exposed market left a paper trail',
      'The market\'s exposure left a notice at the docks. Read it and compare the surviving records before accepting any accusation.',
      'rumor', ['read_notice', 'compare_records', 'review_your_notes'])],
    commands: [operation('secure_records', 'readers'), operation('publish_allegation', 'readers'), operation('trace_disclosure', 'corroborated'),
      command('read_notice', 'mystery.start', id.informantEvidence, 'crew'), command('compare_records', 'discovery.start', id.intelligenceGraph, 'crew'),
      command('review_your_notes', 'mystery.start', id.personalEvidence, 'crew')],
    mysteries: [{ id: 'notice', graphId: id.informantEvidence, nodeId: id.notice }, { id: 'printer_copy', graphId: id.informantEvidence, nodeId: id.copy },
      { id: 'personal_records', graphId: id.personalEvidence, nodeId: id.personalIndex }, { id: 'own_disclosure', graphId: id.personalEvidence, nodeId: id.disclosureRecord }],
    competition: ['SECRET', 'COOPERATIVE', 'ESCALATING'], domains: ['mystery', 'family', 'law'],
    information: [info('leak_concern', 'DISCOVERED_INTELLIGENCE', 'You examined the posted notice, or an investigator shared their verified notes with you.',
      'An uncorroborated allegation consumes supplies and leaves a disputed record; it establishes no player guilt.'),
    info('public_trail', 'SECRET_KNOWLEDGE', 'A different investigator corroborated your evidence.', 'The public paper trail can explain this disclosure without accusing anyone of betrayal.'),
    info('notice_lead', 'CREW_INTELLIGENCE', 'Your local Crew can inspect the visible notice.', 'Different readers may know different parts of the evidence.')],
    implications: { trace_disclosure: { kind: 'evidence', signals: ['peaceful', 'investigation'] },
      secure_records: { kind: 'infrastructure', signals: ['peaceful'] }, publish_allegation: { kind: 'evidence', signals: ['investigation'] } },
  });
  const failedPlan = situation({ situationId: ids.failedPlan, from: 'stranded', category: 'information',
    actions: ['review_failed_plan', 'preserve_uncertainty'], extraFacts: [{ fact: 'failedOperations', op: 'gte', value: 1 }],
    audiences: [audience('holder', 'controller_family', routeKnowledge)],
    signals: [signal('failed_plan', 'holder', 'The Informant: a failed plan',
      'Your Family\'s recent operations have gone badly, and this load is still stranded. Someone who joined the failed recovery must examine its report before a new plan is agreed. None of this proves betrayal.',
      'known', ['review_failure', 'review_failed_plan', 'preserve_uncertainty'])],
    commands: [command('review_failure', 'mystery.start', id.failureEvidence, 'holder'),
      operation('review_failed_plan', 'holder'), operation('preserve_uncertainty', 'holder')],
    mysteries: [{ id: 'actual_failed_plan', graphId: id.failureEvidence, nodeId: id.failure }],
    competition: ['SECRET', 'COOPERATIVE'], domains: ['mystery', 'family', 'law'], weight: 130,
    information: [info('failed_plan', 'FAMILY_INTELLIGENCE', 'You belong to the depot-controlling Family and know its route.',
      'Someone who joined the failed recovery must bring its verified report. The report establishes no one\'s guilt.')],
    implications: { review_failed_plan: { kind: 'infrastructure', signals: ['peaceful'] }, preserve_uncertainty: { kind: 'evidence', signals: ['investigation'] } },
  });
  const campaign = (campaignId, title, opening, followup = null, actionId = null) => ({
    id: campaignId, version: 1, title, entryNode: 'opening',
    nodes: [{ id: 'opening', situationId: opening.id, terminal: !followup },
      ...(followup ? [{ id: 'market', situationId: followup.id, terminal: true }] : [])],
    branches: followup ? [{ id: 'market_opened', from: 'opening', to: 'market', outcome: actionId, when: [eq('worldState', 'market_open')] }] : [],
    maxDurationSeconds: 604800, recoveryPolicy: recovery(604800), cooldownPolicy: cooldown(), maxActive: 1,
  });
  return { situations: [...dock.situations, shipment, market, marketTrade, informant, failedPlan],
    campaigns: [...dock.campaigns,
      campaign(CAMPAIGN_NETWORK_CAMPAIGN_IDS.shipment, 'The Missing Shipment', shipment),
      campaign(CAMPAIGN_NETWORK_CAMPAIGN_IDS.market, 'The Black Market', market, marketTrade, 'establish_market'),
      campaign(CAMPAIGN_NETWORK_CAMPAIGN_IDS.informant, 'The Informant', informant),
      campaign(CAMPAIGN_NETWORK_CAMPAIGN_IDS.failedPlan, 'The Informant: The Failed Plan', failedPlan),
    ] };
}

export const campaignNetworkDefinitionCatalog = dockWarDefinitionCatalog;
export function createCampaignNetworkDefinitions(content) {
  return compileDirectorDefinitions(campaignNetworkDefinitionSources(content), campaignNetworkDefinitionCatalog(content));
}
