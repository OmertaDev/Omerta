// Bounded authored-network model. Production admission, pressure aggregation and
// selection are reused. Physical custody/concurrency remain separate native
// service tests; this model never claims to execute database transactions.
import assert from 'node:assert/strict';
import { createCampaignNetworkContent, CAMPAIGN_NETWORK_IDS } from '../src/content/campaign-network.js';
import { createCampaignNetworkDefinitions } from '../src/director/campaign-network.js';
import { DOCK_WAR_IDS } from '../src/content/dock-war.js';
import { aggregatePressureMemory, PRESSURE_MEMORY } from '../src/director/memory.js';
import { pressuresFromFacts } from '../src/director/pressures.js';
import { selectDirectorCandidates, situationEligible, directorHash } from '../src/director/selection.js';

const HOUR = 3600000, START = Date.UTC(2026, 0, 8);
const total = (values) => values.reduce((a, b) => a + b, 0);

export function runCampaignNetworkSimulation({ scenarios, seed }) {
  const content = createCampaignNetworkContent(), definitions = createCampaignNetworkDefinitions(content);
  const situations = definitions.situations.filter((definition) => definition.network);
  const world = content.worldDefinitions.find((entry) => entry.id === CAMPAIGN_NETWORK_IDS.object);
  const actionSignals = Object.fromEntries(situations.flatMap((definition) => definition.network.implications
    .map((entry) => [definition.consequenceContracts.find((contract) => contract.id === entry.consequenceId).actionId,
      entry.signals || []])));
  const results = scenarios.map((scenario) => {
    const quiet = scenario.quiet || scenario.id === 'family_dominated';
    const exposed = ['high_law_pressure', 'high_mystery_activity'].includes(scenario.id);
    const short = scenario.id === 'economic_shortage';
    const fixtureActions = scenario.id === 'quiet_world' ? [] : exposed
      ? ['register_shipment', 'intercept_shipment', 'establish_market', 'expose_market']
      : short ? ['register_shipment', 'intercept_shipment']
        : quiet ? ['register_shipment', 'recover_shipment'] : ['register_shipment'];
    const remainingBudget = scenario.limitedStock ? 1 : 12;
    const events = [], operations = [], samples = [], history = [], transitions = [], observed = [];
    let state = world.initialState, revision = 0, controller = 'family:0', wire = remainingBudget, seals = scenario.limitedStock ? 1 : 8;
    let consumedWire = 0, consumedSeals = 0, expired = 0, unfunded = 0, active = null, priorCampaign = null;
    const initialWire = wire + total(fixtureActions.map((id) => world.actions.find((entry) => entry.id === id).materials[0].quantity));
    const initialSeals = seals + fixtureActions.length;
    const commit = (action, at, fixture = false) => {
      assert.equal(state, action.from, 'Every modeled outcome must be admitted in the compiled World Kernel graph');
      const cost = total(action.materials.map((entry) => entry.quantity));
      if (!fixture) { assert(wire >= cost && seals > 0); wire -= cost; seals--; }
      consumedWire += cost; consumedSeals++; state = action.to; revision++;
      if (['intercept_shipment', 'seize_market'].includes(action.id)) controller = 'family:1';
      events.push({ id: `network:${scenario.id}:${revision}`, revision, family_id: controller,
        action_id: action.id, occurred_at: new Date(at).toISOString(), wire: cost, seals: 1, fixture });
      operations.push({ status: 'completed', resolved_at: new Date(at).toISOString() });
    };
    fixtureActions.forEach((id, index) => commit(world.actions.find((entry) => entry.id === id), START - (24 - index) * HOUR, true));
    const peaks = {}, classes = new Set();
    const factsAt = (at) => {
      const memory = aggregatePressureMemory({ objectId: world.id, controllerFamilyId: controller, at,
        samples, events: events.slice(-PRESSURE_MEMORY.events), operations: operations.slice(-PRESSURE_MEMORY.operations),
        discoveries: scenario.discoveries, actionSignals });
      const facts = { objectId: world.id, worldState: state, worldRevision: revision, controllerFamilyId: controller,
        resourceQuantity: wire, resourceDemand: 2, resourceDeficit: Math.max(0, 2 - wire), activePlayers: scenario.players,
        activeFamilies: scenario.families, activeCrews: scenario.crews, completedOperations: operations.length,
        failedOperations: 0, discoveredSources: scenario.discoveries, familyActivity: operations.length, season: 1,
        priorWorldAction: events.at(-1)?.action_id || '', priorOutcome: state,
        relatedWorld: { [DOCK_WAR_IDS.object]: { state: fixtureActions.length ? 'shortage' : 'idle', revision: fixtureActions.length ? 1 : 0 } },
        ...memory };
      const pressures = pressuresFromFacts(facts);
      for (const [name, value] of Object.entries(pressures)) peaks[name] = Math.max(peaks[name] || 0, value);
      if (!samples.length || at - samples.at(-1).at >= PRESSURE_MEMORY.bucketSeconds * 1000) {
        samples.push({ at, facts: [facts] });
        if (samples.length > PRESSURE_MEMORY.buckets) samples.shift();
      }
      return { ...facts, pressures };
    };
    const plan = ['intercept_shipment', 'establish_market', 'expose_market', 'secure_records'];
    if (scenario.id === 'high_mystery_activity') plan.unshift('trace_disclosure');
    const priority = (action) => {
      const index = plan.indexOf(action.id);
      return index < 0 ? plan.length + Number.parseInt(directorHash([seed, scenario.id, action.id]).slice(0, 4), 16) : index;
    };
    for (let hour = 0; hour < 7 * 24; hour++) {
      const at = START + hour * HOUR, facts = factsAt(at);
      if (active) {
        if (at >= active.created + active.definition.expiryPolicy.afterSeconds * 1000) {
          active.row.terminal = true; active.row.updated_at = new Date(at).toISOString(); expired++; active = null;
        } else if (!active.attempted && hour > active.hour) {
          active.attempted = true;
          const actions = active.definition.possibleResolutions.map((resolution) => ({ resolution,
            action: world.actions.find((action) => action.id === active.definition.consequenceContracts
              .find((contract) => contract.id === resolution.consequenceId).actionId) })).sort((a, b) => priority(a.action) - priority(b.action));
          const chosen = actions[0], cost = total(chosen.action.materials.map((entry) => entry.quantity));
          if (wire < cost || seals < 1 || scenario.players < 2 || !scenario.discoveries) unfunded++;
          else {
            const before = state; commit(chosen.action, at);
            transitions.push({ situation: active.definition.id, campaign: active.campaign.id,
              action: chosen.action.id, from: before, to: state, event: events.at(-1).id });
            active.row.terminal = true; active.row.updated_at = new Date(at).toISOString(); active = null;
          }
        }
      }
      if (active) continue;
      const current = factsAt(at);
      const candidates = situations.map((definition) => ({ definition, facts: current }));
      const selection = selectDirectorCandidates(candidates, [], history, at);
      assert(!selection.truncated); assert(selection.selected.length <= 1);
      for (const { definition } of selection.selected) {
        assert(situationEligible(definition, current));
        definition.network.competition.forEach((entry) => classes.add(entry));
        const row = { object_id: world.id, definition_id: definition.id, controller_family_id: controller,
          created_at: new Date(at).toISOString(), updated_at: new Date(at).toISOString(), terminal: false };
        const relevant = definitions.campaigns.filter((campaign) => campaign.nodes.some((node) => node.situationId === definition.id));
        const campaign = relevant.find((candidate) => candidate.id === priorCampaign) || relevant[0];
        assert(campaign); priorCampaign = campaign.id;
        history.push(row); observed.push({ id: definition.id, campaign: campaign.id, state, revision });
        active = { definition, campaign, row, created: at, hour, attempted: false };
      }
    }
    const balanceError = initialWire - wire - consumedWire;
    const sealError = initialSeals - seals - consumedSeals;
    assert.equal(balanceError, 0); assert.equal(sealError, 0);
    assert.equal(new Set(events.map((event) => event.id)).size, events.length);
    return { scenario: scenario.id, observed, transitions, finalState: state, expired, unfunded,
      competitionClasses: [...classes].sort(), pressurePeaks: peaks, maximumHistorySamples: samples.length,
      provenanceHash: directorHash(events), resources: { initialWire, remainingWire: wire, consumedWire,
        initialSeals, remainingSeals: seals, consumedSeals, balanceError, sealError },
      crossCampaignChanges: transitions.filter((entry, index) => index > 0
        && entry.campaign !== transitions[index - 1].campaign).length };
  });
  return { seed, model: 'compiled canonical-state campaign network model', results,
    productionFunctions: ['createCampaignNetworkContent', 'createCampaignNetworkDefinitions', 'situationEligible',
      'selectDirectorCandidates', 'aggregatePressureMemory', 'pressuresFromFacts'],
    limitations: ['Fixture history and player response policies are synthetic and explicit.',
      'This model accounts for declared materials but does not execute database custody, Knowledge authorization or concurrent commands.',
      'Native campaign journey, recovery and concurrency tests provide the separate authoritative execution evidence.'] };
}
