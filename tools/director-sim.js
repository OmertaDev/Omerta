// Deterministic canonical-world MODEL, not a substitute for native database,
// inventory-custody, authorization or concurrency tests. Selection and pressure
// evaluation below use the production functions without a simulated alternative.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createDockWarContent } from '../src/content/dock-war.js';
import { compileWorldObjects } from '../src/world-kernel.js';
import { compileFamilyOperations } from '../src/coordination/operation-definitions.js';
import { compileDirectorDefinitions } from '../src/director/definitions.js';
import { dockWarDefinitionSources, dockWarDefinitionCatalog } from '../src/director/dock-war.js';
import { selectDirectorCandidates, situationEligible, predicatesMatch, directorHash, DIRECTOR_LIMITS } from '../src/director/selection.js';
import { pressuresFromFacts } from '../src/director/pressures.js';
import { aggregatePressureMemory, PRESSURE_MEMORY } from '../src/director/memory.js';
import { runCampaignNetworkSimulation } from './campaign-network-sim.js';

const DAY = 86400000, HOUR = 3600000, EPOCH = Date.UTC(2026, 0, 1);
export const DIRECTOR_SIMULATION_PERIODS = Object.freeze([1, 7, 30, 180]);
export const DIRECTOR_SIMULATION_SEED = 'director-model-v1';
export const DIRECTOR_SIMULATION_SCENARIOS = Object.freeze([
  { id: 'low_population', players: 2, families: 1, crews: 1, territories: 1, responsePercent: 65, delayHours: 30, branches: ['alternate'], discoveries: 2 },
  { id: 'medium_population', players: 24, families: 4, crews: 6, territories: 4, responsePercent: 80, delayHours: 4, branches: ['protect', 'intercept', 'alternate'], discoveries: 10 },
  { id: 'high_population', players: 240, families: 24, crews: 60, territories: 12, responsePercent: 95, delayHours: 2, branches: ['protect', 'intercept', 'alternate'], discoveries: 32 },
  { id: 'family_dominated', players: 64, families: 2, crews: 16, territories: 8, responsePercent: 75, delayHours: 8, branches: ['protect', 'protect', 'intercept'], discoveries: 8, dominant: true },
  { id: 'fragmented_crew', players: 48, families: 8, crews: 24, territories: 8, responsePercent: 45, delayHours: 36, branches: ['alternate', 'intercept'], discoveries: 12, unresponsiveTerritory: 0 },
  { id: 'economic_shortage', players: 32, families: 4, crews: 8, territories: 6, responsePercent: 70, delayHours: 8, branches: ['protect', 'intercept', 'alternate'], discoveries: 6, limitedStock: true },
  { id: 'territory_war', players: 64, families: 8, crews: 16, territories: 8, responsePercent: 95, delayHours: 3, branches: ['protect', 'intercept'], discoveries: 8 },
  { id: 'quiet_world', players: 12, families: 2, crews: 3, territories: 4, responsePercent: 0, delayHours: 8, branches: ['protect'], discoveries: 0, quiet: true },
  { id: 'high_mystery_activity', players: 48, families: 6, crews: 12, territories: 6, responsePercent: 90, delayHours: 6, branches: ['alternate', 'alternate', 'protect'], discoveries: 32 },
  { id: 'new_world', players: 4, families: 2, crews: 2, territories: 2, responsePercent: 40, delayHours: 24, branches: ['protect'], discoveries: 1, limitedStock: true },
  { id: 'resource_abundance', players: 64, families: 8, crews: 16, territories: 8, responsePercent: 90, delayHours: 4, branches: ['protect'], discoveries: 12, quiet: true },
  { id: 'high_law_pressure', players: 80, families: 8, crews: 20, territories: 8, responsePercent: 75, delayHours: 6, branches: ['intercept', 'protect'], discoveries: 24 },
  { id: 'low_law_pressure', players: 16, families: 2, crews: 4, territories: 4, responsePercent: 70, delayHours: 12, branches: ['alternate'], discoveries: 4, quiet: true },
].map(Object.freeze));
const stripHash = ({ contentHash: _hash, ...source }) => source;
const sample = (identity, seed) => Number.parseInt(directorHash([seed, identity]).slice(0, 8), 16);
const sum = (values) => values.reduce((total, value) => total + value, 0);

/** Compile each fixture scope against the actual World/operation compilers.
 * Seasonal namespaces represent separate pre-existing canonical fixtures. A
 * settled route is never silently reset to manufacture another campaign.
 */
function scopeDefinitions(base, scopeId) {
  const worldId = `territory:sim_${scopeId}`;
  const worlds = compileWorldObjects(base.registry, base.objects.map((object) => ({ ...structuredClone(object), id: worldId })));
  const operationIds = new Map(base.operationDefinitions.map((operation) => [operation.id, `${operation.id}:${scopeId}`]));
  const operations = compileFamilyOperations(base.registry, worlds, base.operationDefinitions.map((definition) => {
    const source = structuredClone(stripHash(definition));
    source.id = operationIds.get(source.id); source.world.objectId = worldId;
    for (const role of source.roles) for (const requirement of role.requirements) {
      if (requirement.kind === 'prerequisite' && requirement.predicate.adapter === 'world_state') {
        requirement.predicate.requirement.objectId = worldId;
        requirement.predicate.requirement.definitionHash = worlds[0].contentHash;
      }
    }
    return source;
  }));
  const sources = structuredClone(dockWarDefinitionSources(base));
  const situationIds = new Map(sources.situations.map((situation) => [situation.id, `${situation.id}:${scopeId}`]));
  for (const situation of sources.situations) {
    situation.id = situationIds.get(situation.id); situation.objectId = worldId;
    for (const consequence of situation.consequenceContracts) consequence.objectId = worldId;
    for (const adapter of situation.coordinationAdapters) adapter.definitionId = operationIds.get(adapter.definitionId);
    for (const adapter of situation.commandAdapters) {
      if (adapter.commandType === 'operation.create') adapter.targetId = operationIds.get(adapter.targetId);
    }
  }
  for (const campaign of sources.campaigns) {
    campaign.id += `:${scopeId}`;
    for (const node of campaign.nodes) node.situationId = situationIds.get(node.situationId);
  }
  const compiled = compileDirectorDefinitions(sources, { ...dockWarDefinitionCatalog(base), worldDefinitions: worlds, operationDefinitions: operations });
  return { ...compiled, world: worlds[0], operationDefinitions: operations };
}

function playersFor(scenario) {
  return Array.from({ length: scenario.players }, (_, index) => ({
    id: `player:${index}`, index,
    familyId: `family:${scenario.dominant && index < Math.ceil(scenario.players * .8) ? 0 : index % scenario.families}`,
    crewId: `crew:${Math.floor(index / 2) % scenario.crews}`,
    leader: index < scenario.families * 2,
    // Explicit synthetic knowledge distribution, never grants from a Director.
    routeKnown: scenario.discoveries > 0 && index % 3 !== 2,
    alternateKnown: scenario.discoveries >= 12 ? index % 2 === 0 : index % 4 === 0,
  }));
}
function makeScope(base, scenario, season, index) {
  const defs = scopeDefinitions(base, `${scenario.id}_${season}_${index}`);
  const controller = scenario.dominant && index < scenario.territories - 1 ? 0 : index % scenario.families;
  const controllerId = `family:${controller}`, rivalId = `family:${(controller + 1) % scenario.families}`;
  const holdings = new Map([[controllerId, scenario.quiet ? 8 : 1]]);
  if (rivalId !== controllerId) holdings.set(rivalId, scenario.limitedStock ? 1 : 4);
  holdings.set('reserve', scenario.limitedStock ? 0 : 3);
  return { ...defs, id: defs.world.id, index, season, modelSeason: season, activeSeason: true,
    state: scenario.quiet ? 'idle' : 'shortage', revision: scenario.quiet ? 0 : 1,
    controllerFamilyId: scenario.quiet ? null : controllerId, originalController: controllerId, rivalId,
    holdings, initialWire: sum([...holdings.values()]), initialSeals: 6, seals: 6, consumedWire: 0,
    transferredWire: 0, operations: 0, failedOperations: 0, events: [], campaign: null, campaignHistory: [],
    attempts: 0, eligibleSince: null, pressureSamples: [], pressurePeaks: {}, maximumMemorySamples: 0 };
}
function observedFacts(scope, scenario, at) {
  const demand = Math.max(0, ...scope.world.actions.flatMap((action) => action.materials).map((material) => material.quantity));
  const resourceQuantity = scope.holdings.get(scope.controllerFamilyId) || 0;
  const last = scope.events.at(-1);
  const facts = { objectId: scope.id, worldState: scope.state, worldRevision: scope.revision,
    controllerFamilyId: scope.controllerFamilyId, resourceQuantity, resourceDemand: demand,
    resourceDeficit: Math.max(0, demand - resourceQuantity), activePlayers: scenario.players,
    activeFamilies: scenario.families, activeCrews: scenario.crews,
    completedOperations: scope.operations, failedOperations: scope.failedOperations,
    discoveredSources: scenario.discoveries, priorWorldAction: last?.actionId || 'establish_route',
    priorOutcome: last?.toState || scope.state, season: scope.modelSeason, familyActivity: scope.operations };
  const memory = aggregatePressureMemory({ objectId: scope.id, controllerFamilyId: scope.controllerFamilyId, at,
    samples: scope.pressureSamples, discoveries: scenario.discoveries,
    events: scope.events.slice(-PRESSURE_MEMORY.events).map((event) => ({ ...event,
      action_id: event.actionId, family_id: event.familyId })),
    operations: scope.events.slice(-PRESSURE_MEMORY.operations).map((event) => ({
      status: 'completed', resolved_at: event.occurred_at })),
    actionSignals: Object.fromEntries(scope.situations.flatMap((definition) => (definition.network?.implications || [])
      .map((entry) => [definition.consequenceContracts.find((contract) => contract.id === entry.consequenceId).actionId,
        entry.signals || []]))) });
  const entry = { ...facts, ...memory };
  const width = PRESSURE_MEMORY.bucketSeconds * 1000;
  if (scope.pressureSamples.at(-1)?.at < Math.floor(at / width) * width || !scope.pressureSamples.length) {
    scope.pressureSamples.push({ at, facts: [facts] });
    scope.pressureSamples = scope.pressureSamples.filter((sample) => sample.at >= at - PRESSURE_MEMORY.windowSeconds * 1000)
      .slice(-PRESSURE_MEMORY.buckets);
  }
  const pressures = pressuresFromFacts(entry);
  for (const [name, value] of Object.entries(pressures)) scope.pressurePeaks[name] = Math.max(scope.pressurePeaks[name] || 0, value);
  scope.maximumMemorySamples = Math.max(scope.maximumMemorySamples, scope.pressureSamples.length);
  return { ...entry, pressures };
}

// A modeled PLAYER operation first transfers already existing wire, then spends
// exactly the admitted action's declared wire and one existing crafted seal.
// This is deliberately separate from selecting or advancing Director rows.
function performModeledOperation(scope, resolution, metrics, at) {
  const consequence = scope.situations.flatMap((situation) => situation.consequenceContracts)
    .find((entry) => entry.id === resolution.consequenceId && entry.fromState === scope.state);
  assert(consequence, 'The model cannot invent an operation consequence');
  const action = scope.world.actions.find((entry) => entry.id === consequence.actionId);
  assert.equal(action.from, scope.state);
  const wire = sum(action.materials.map((entry) => entry.quantity));
  const payer = resolution.id === 'intercept' ? scope.rivalId : scope.controllerFamilyId;
  const available = sum([...scope.holdings.values()]);
  if (available < wire || scope.seals < 1 || !payer) {
    // Failure to fund readiness is not a canonical failed-operation outcome.
    metrics.failedOperationAttempts++; return false;
  }
  let missing = Math.max(0, wire - (scope.holdings.get(payer) || 0));
  for (const [owner, balance] of scope.holdings) {
    if (owner === payer || !missing) continue;
    const transfer = Math.min(balance, missing);
    scope.holdings.set(owner, balance - transfer);
    scope.holdings.set(payer, (scope.holdings.get(payer) || 0) + transfer);
    scope.transferredWire += transfer; missing -= transfer;
  }
  assert.equal(missing, 0);
  scope.holdings.set(payer, scope.holdings.get(payer) - wire);
  scope.consumedWire += wire; scope.seals--; scope.operations++;
  scope.revision++; scope.state = action.to;
  // Existing World Kernel Family actions record the executing Family controller.
  scope.controllerFamilyId = payer;
  scope.events.push({ id: `${scope.id}:${scope.revision}`, actionId: action.id, fromState: action.from,
    toState: action.to, revision: scope.revision, consumedWire: wire, consumedSeals: 1,
    familyId: payer, occurred_at: new Date(at).toISOString(),
    materialTemplateId: 'mat:wire', authority: 'modeled_player_operation' });
  metrics.operationVolume++; metrics.outcomes[resolution.id] = (metrics.outcomes[resolution.id] || 0) + 1;
  assert.equal(scope.initialWire, sum([...scope.holdings.values()]) + scope.consumedWire);
  assert.equal(scope.initialSeals, scope.seals + scope.operations);
  assert([...scope.holdings.values()].every((quantity) => quantity >= 0));
  return true;
}

function authorizedAdapter(adapter, definition, scope, player) {
  const audience = definition.audiences.find((entry) => entry.id === adapter.audienceId);
  const allowed = audience.kind === 'public' || audience.kind === 'crew' && player.crewId
    || audience.kind === 'controller_family' && player.familyId === scope.controllerFamilyId
    || audience.kind === 'rival_family' && player.familyId !== scope.controllerFamilyId
    || audience.kind === 'informed';
  if (!allowed) return false;
  if (audience.knowledge && !(audience.knowledge.proposition === 'route.alternate' ? player.alternateKnown : player.routeKnown)) return false;
  return adapter.commandType !== 'operation.create' || player.leader;
}

export function simulateDirectorScenario(scenario, { periods = DIRECTOR_SIMULATION_PERIODS, tickSeconds = 3600,
  seed = DIRECTOR_SIMULATION_SEED, population = scenario.players } = {}) {
  assert(DIRECTOR_SIMULATION_SCENARIOS.includes(scenario), 'Choose an admitted scenario');
  assert(Number.isSafeInteger(population) && population >= 1 && population <= 1000, 'Choose a bounded modeled population');
  scenario = { ...scenario, players: population };
  assert(typeof seed === 'string' && seed.length > 0 && seed.length <= 128, 'A bounded, declared simulation seed is required');
  assert(Array.isArray(periods) && periods.length && periods.every((day) => Number.isInteger(day) && day >= 1 && day <= 180));
  assert(Number.isInteger(tickSeconds) && tickSeconds >= DIRECTOR_LIMITS.tickSeconds && tickSeconds <= 3600 && 3600 % tickSeconds === 0);
  const base = createDockWarContent(), players = playersFor(scenario), step = tickSeconds * 1000;
  const horizon = Math.max(...periods) * DAY, snapshots = [], scopes = [], history = [], active = [], offers = new Set();
  const metrics = { generated: 0, completed: 0, ignored: 0, escalated: 0, campaignsStarted: 0, campaignsCompleted: 0,
    campaignsAbandoned: 0, recoveryUse: 0, seasonRecoveries: 0, retainedWorldReoffers: 0, eventRepetition: 0,
    maxRepetitionWithinWindow: 0, operationVolume: 0, failedOperationAttempts: 0, playerOpportunityVolume: 0,
    playerBudgetDeferrals: 0, deadEnds: 0, maxActive: 0, maxActivePerFamily: 0, maxStartsPerTick: 0,
    maxEligibleWaitHours: 0, evaluationTicks: 0, quietTicks: 0, eligibleEvaluations: 0,
    outcomes: {}, rejectionReasons: {}, familyEvents: {} };
  let currentSeason = 0;
  const finish = (row, kind, outcome, terminalState, now) => {
    row.terminal = true; row.outcome = outcome; row.state = terminalState; row.updated_at = new Date(now).toISOString();
    active.splice(active.indexOf(row), 1);
    if (kind === 'resolution') metrics.completed++;
    else { metrics.ignored++; if (kind === 'recovery') { metrics.recoveryUse++; metrics.seasonRecoveries++; } }
  };
  const finishCampaign = (scope, status, now) => {
    scope.campaign.status = status; scope.campaign.updatedAt = now;
    if (status === 'completed') metrics.campaignsCompleted++; else metrics.campaignsAbandoned++;
    scope.campaign = null;
  };
  const captureOffers = () => {
    for (const player of players) {
      let presented = 0;
      for (const row of active) {
        const scope = scopes.find((entry) => entry.id === row.object_id);
        const adapters = row.definition.commandAdapters.filter((adapter) => authorizedAdapter(adapter, row.definition, scope, player));
        if (!adapters.length) continue;
        if (presented >= Math.min(DIRECTOR_LIMITS.player, DIRECTOR_LIMITS.crew,
          row.definition.concurrencyPolicy.perPlayer, row.definition.concurrencyPolicy.perCrew)) {
          metrics.playerBudgetDeferrals++; continue;
        }
        presented++;
        for (const adapter of adapters) offers.add(`${row.id}/${player.id}/${adapter.id}`);
      }
      assert(presented <= DIRECTOR_LIMITS.player);
    }
    metrics.playerOpportunityVolume = offers.size;
  };
  const snapshot = (days) => {
    const initialWire = sum(scopes.map((scope) => scope.initialWire)), remainingWire = sum(scopes.map((scope) => sum([...scope.holdings.values()])));
    const wireConsumed = sum(scopes.map((scope) => scope.consumedWire)), initialSeals = sum(scopes.map((scope) => scope.initialSeals));
    const remainingSeals = sum(scopes.map((scope) => scope.seals));
    const consumptionEvents = scopes.flatMap((scope) => scope.events);
    const duplicateReceipts = consumptionEvents.length - new Set(consumptionEvents.map((event) => event.id)).size;
    const unexplainedWire = wireConsumed - sum(consumptionEvents.map((event) => event.consumedWire));
    const unexplainedSeals = initialSeals - remainingSeals - sum(consumptionEvents.map((event) => event.consumedSeals));
    assert.equal(initialWire, remainingWire + wireConsumed);
    assert.equal(initialSeals - remainingSeals, metrics.operationVolume);
    assert.equal(duplicateReceipts, 0);
    assert.equal(unexplainedWire, 0);
    assert.equal(unexplainedSeals, 0);
    const unfinished = scopes.filter((scope) => scope.activeSeason && !['settled', 'idle'].includes(scope.state));
    const unfundedResponseScopes = unfinished.filter((scope) => {
      const actions = scope.world.actions.filter((action) => action.from === scope.state);
      const minimum = Math.min(...actions.map((action) => sum(action.materials.map((material) => material.quantity))));
      return scope.seals === 0 || sum([...scope.holdings.values()]) < minimum;
    }).length;
    return { scenario: scenario.id, days, ...structuredClone(metrics), activeSituations: active.length,
      activeCampaigns: scopes.filter((scope) => scope.campaign).length,
      familyConcentration: metrics.generated ? Math.max(...Object.values(metrics.familyEvents)) / metrics.generated : 0,
      deadEndRate: metrics.generated ? metrics.deadEnds / metrics.generated : 0,
      unfinishedCanonicalScopes: unfinished.length, unfundedResponseScopes,
      pressureMemory: { maximumSamples: Math.max(0, ...scopes.map((scope) => scope.maximumMemorySamples)),
        peaks: Object.fromEntries(Object.keys(scopes[0]?.pressurePeaks || {}).map((name) => [name,
          Math.max(0, ...scopes.map((scope) => scope.pressurePeaks[name] || 0))])) },
      resourceEffects: { initialFixtureWire: initialWire, remainingWire, wireConsumed,
        wireTransferred: sum(scopes.map((scope) => scope.transferredWire)), initialFixtureSeals: initialSeals,
        remainingSeals, sealsConsumed: initialSeals - remainingSeals, directorMinted: 0, omrDelta: 0,
        wireBalanceError: initialWire - remainingWire - wireConsumed, duplicateReceipts,
        unexplainedWire, unexplainedSeals,
        provenanceHash: directorHash(consumptionEvents) } };
  };

  for (let elapsed = 0; elapsed < horizon; elapsed += step) {
    const now = EPOCH + elapsed, season = Math.floor(elapsed / (30 * DAY)) + 1;
    if (season !== currentSeason) {
      for (const scope of scopes.filter((entry) => entry.activeSeason)) { scope.activeSeason = false; scope.modelSeason = season; }
      for (let index = 0; index < scenario.territories; index++) scopes.push(makeScope(base, scenario, season, index));
      currentSeason = season;
    }
    metrics.evaluationTicks++;
    for (const row of [...active]) {
      const scope = scopes.find((entry) => entry.id === row.object_id), definition = row.definition;
      const facts = observedFacts(scope, scenario, now), age = now - new Date(row.created_at).getTime();
      if (scope.modelSeason !== row.season) {
        finish(row, 'recovery', 'recovery', definition.recoveryPolicy.to, now); continue;
      }
      if (!row.operationAttempted && row.response && age >= scenario.delayHours * HOUR) {
        row.operationAttempted = true;
        const resolution = definition.possibleResolutions.find((entry) => entry.id === row.desiredOutcome);
        assert(resolution && resolution.from.includes(row.state));
        if (performModeledOperation(scope, resolution, metrics, now)) {
          const committed = scope.events.at(-1);
          assert(committed.revision > row.starting_world_revision);
          finish(row, 'resolution', resolution.id, resolution.to, now); continue;
        }
      }
      if (age >= definition.expiryPolicy.afterSeconds * 1000) {
        finish(row, 'expiry', 'expiry', definition.expiryPolicy.to, now); continue;
      }
      const escalation = definition.possibleEscalations.find((entry) => entry.from === row.state
        && now - new Date(row.updated_at).getTime() >= entry.afterSeconds * 1000 && predicatesMatch(entry.when, facts));
      if (escalation) { row.state = escalation.to; row.updated_at = new Date(now).toISOString(); metrics.escalated++; }
      const recoverable = definition.expiryPolicy.afterSeconds > 0 && definition.terminalStates.includes(definition.recoveryPolicy.to);
      if (!recoverable && !definition.possibleEscalations.some((entry) => entry.from === row.state)
        && !definition.possibleResolutions.some((entry) => entry.from.includes(row.state))) metrics.deadEnds++;
    }
    const candidates = [];
    for (const scope of scopes) {
      let campaign = scope.campaign;
      const campaignDefinition = scope.campaigns[0];
      if (campaign) {
        const prior = history.find((row) => row.campaignId === campaign.id && row.nodeId === campaign.nodeId);
        if (now - campaign.createdAt >= campaignDefinition.maxDurationSeconds * 1000 || !scope.activeSeason) {
          finishCampaign(scope, 'abandoned', now); campaign = null;
        } else if (prior?.terminal) {
          const node = campaignDefinition.nodes.find((entry) => entry.id === campaign.nodeId);
          if (node.terminal && !['expiry', 'recovery'].includes(prior.outcome)) {
            finishCampaign(scope, 'completed', now); campaign = null;
          } else {
            const branch = campaignDefinition.branches.find((entry) => entry.from === campaign.nodeId
              && entry.outcome === prior.outcome && predicatesMatch(entry.when, observedFacts(scope, scenario, now)));
            if (!branch) { finishCampaign(scope, 'abandoned', now); campaign = null; }
            else campaign.nodeId = branch.to;
          }
        }
      }
      if (!scope.activeSeason || active.some((row) => row.object_id === scope.id)) continue;
      if (!campaign) {
        const lastCampaign = scope.campaignHistory.at(-1);
        if (lastCampaign && now - lastCampaign.createdAt < campaignDefinition.cooldownPolicy.seconds * 1000) continue;
        if (scope.campaignHistory.filter((entry) => now - entry.createdAt < campaignDefinition.cooldownPolicy.repetitionWindowSeconds * 1000).length
          >= campaignDefinition.cooldownPolicy.maximumPerWindow) continue;
      }
      let node = campaignDefinition.nodes.find((entry) => entry.id === (campaign?.nodeId || campaignDefinition.entryNode));
      const facts = observedFacts(scope, scenario, now);
      if (!campaign && !situationEligible(scope.situations.find((entry) => entry.id === node.situationId), facts)) {
        // Match runtime retained-outcome recovery: a new receipt can reoffer the
        // last abandoned node without pretending the shortage happened again.
        const last = scope.campaignHistory.at(-1);
        const retained = last?.status === 'abandoned' && campaignDefinition.nodes.find((entry) => entry.id === last.nodeId);
        if (retained && situationEligible(scope.situations.find((entry) => entry.id === retained.situationId), facts)) node = retained;
      }
      const definition = scope.situations.find((entry) => entry.id === node.situationId);
      candidates.push({ definition, facts, campaignId: campaign?.id,
        campaignDefinition, nodeId: node.id, scope });
    }
    const selection = selectDirectorCandidates(candidates, active, history, now);
    metrics.eligibleEvaluations += selection.eligible;
    for (const rejection of selection.rejected) metrics.rejectionReasons[rejection.reason] = (metrics.rejectionReasons[rejection.reason] || 0) + 1;
    assert(!selection.truncated, 'Fixture candidate frontier fits the production evaluation bound');
    assert(selection.selected.length <= DIRECTOR_LIMITS.startsPerTick);
    metrics.maxStartsPerTick = Math.max(metrics.maxStartsPerTick, selection.selected.length);
    for (const candidate of selection.selected) {
      const { scope, definition, campaignDefinition, nodeId } = candidate;
      if (!scope.campaign) {
        scope.campaign = { id: `campaign:${scenario.id}:${scope.id}:${scope.campaignHistory.length}`, nodeId,
          createdAt: now, status: 'active' };
        if (scope.campaignHistory.at(-1)?.status === 'abandoned') { metrics.recoveryUse++; metrics.retainedWorldReoffers++; }
        scope.campaignHistory.push(scope.campaign); metrics.campaignsStarted++;
      }
      const previous = history.filter((row) => row.object_id === scope.id && row.definition_id === definition.id);
      const repetitions = previous.filter((row) => now - new Date(row.created_at).getTime() < definition.cooldownPolicy.repetitionWindowSeconds * 1000).length + 1;
      assert(repetitions <= definition.cooldownPolicy.maximumPerWindow);
      metrics.maxRepetitionWithinWindow = Math.max(metrics.maxRepetitionWithinWindow, repetitions);
      if (previous.length) metrics.eventRepetition++;
      const attempt = scope.attempts++, response = scope.index !== scenario.unresponsiveTerritory
        && sample(`${scope.id}/${definition.id}/${attempt}`, seed) % 100 < scenario.responsePercent;
      const row = { id: `situation:${metrics.generated}`, definition, definition_id: definition.id, object_id: scope.id,
        controller_family_id: scope.controllerFamilyId, state: definition.initialState, terminal: false,
        created_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString(),
        campaignId: scope.campaign.id, nodeId, season: scope.season, starting_world_revision: scope.revision,
        response, desiredOutcome: nodeId === campaignDefinition.entryNode
          ? scenario.branches[(scope.index + attempt + scope.season) % scenario.branches.length] : 'settle', operationAttempted: false };
      active.push(row); history.push(row); metrics.generated++;
      metrics.familyEvents[scope.controllerFamilyId] = (metrics.familyEvents[scope.controllerFamilyId] || 0) + 1;
    }
    if (selection.selected.length || active.some((row) => row.updated_at === new Date(now).toISOString())) captureOffers();
    metrics.maxActive = Math.max(metrics.maxActive, active.length);
    assert(active.length <= DIRECTOR_LIMITS.active);
    const familyCounts = new Map();
    for (const row of active) familyCounts.set(row.controller_family_id, (familyCounts.get(row.controller_family_id) || 0) + 1);
    for (const count of familyCounts.values()) { assert(count <= DIRECTOR_LIMITS.family); metrics.maxActivePerFamily = Math.max(metrics.maxActivePerFamily, count); }
    for (const candidate of candidates) {
      const selected = selection.selected.includes(candidate) || selection.selected.some((entry) => entry.scope === candidate.scope);
      const eligible = selection.selected.some((entry) => entry.scope === candidate.scope) || selection.rejected.some((entry) => entry.objectId === candidate.scope.id);
      if (!eligible || selected) candidate.scope.eligibleSince = null;
      else {
        candidate.scope.eligibleSince ??= now;
        metrics.maxEligibleWaitHours = Math.max(metrics.maxEligibleWaitHours, (now - candidate.scope.eligibleSince) / HOUR);
      }
    }
    if (!active.length && !selection.eligible) metrics.quietTicks++;
    if (periods.includes((elapsed + step) / DAY)) snapshots.push(snapshot((elapsed + step) / DAY));
  }
  assert.equal(snapshots.length, new Set(periods).size);
  return snapshots;
}

export function runDirectorSimulation({ periods = DIRECTOR_SIMULATION_PERIODS, scenarios = DIRECTOR_SIMULATION_SCENARIOS,
  tickSeconds = 3600, seed = DIRECTOR_SIMULATION_SEED } = {}) {
  const results = scenarios.flatMap((scenario) => simulateDirectorScenario(scenario, { periods, tickSeconds, seed }));
  return { schemaVersion: 2, model: 'deterministic canonical-observation model', seed, tickSeconds,
    productionFunctions: ['compileWorldObjects', 'compileFamilyOperations', 'compileDirectorDefinitions',
      'selectDirectorCandidates', 'pressuresFromFacts', 'aggregatePressureMemory'],
    assumptions: ['Each 30-day season introduces separate pre-existing scoped fixtures; canonical route states never reset.',
      'Modeled player responses use deterministic policies; those policies do not choose Director situations.',
      'Operations consume declared action materials and a pre-existing crafted seal; transfers only move existing stock.',
      'Knowledge distribution and membership are explicit synthetic observations; offer counts are modeled authorized commands.',
      'Dead-end rate measures lifecycle states lacking a terminal recovery path; unfunded response scopes are reported separately.'],
    limitations: ['Hourly model ticks are coarser than the production 300-second scheduler.',
      'Model conservation does not prove database inventory custody, economy sources/sinks, authentication, or concurrent execution.',
      'A bounded content slice eventually settles or becomes quiet; the model does not fabricate new world conflict to maintain activity.'],
    scenarios: scenarios.map((scenario) => ({ ...scenario })), results,
    campaignNetwork: runCampaignNetworkSimulation({ scenarios, seed }),
    summary: { runs: results.length, scenarioCount: scenarios.length, periods: [...periods],
      maximumActive: Math.max(0, ...results.map((row) => row.maxActive)), maximumStartsPerTick: Math.max(0, ...results.map((row) => row.maxStartsPerTick)),
      maximumRepetitionWithinWindow: Math.max(0, ...results.map((row) => row.maxRepetitionWithinWindow)),
      directorMinted: sum(results.map((row) => row.resourceEffects.directorMinted)),
      wireBalanceErrors: sum(results.map((row) => Math.abs(row.resourceEffects.wireBalanceError))),
      deadEnds: sum(results.map((row) => row.deadEnds)) } };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--output')) throw new Error('Usage: node tools/director-sim.js [--output report.json]');
  const report = runDirectorSimulation();
  if (args[0] === '--output') { await fs.writeFile(args[1], `${JSON.stringify(report, null, 2)}\n`); console.log(JSON.stringify(report.summary)); }
  else console.log(JSON.stringify(report, null, 2));
}
