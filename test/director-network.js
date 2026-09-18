import assert from 'node:assert/strict';
import { createDockWarContent } from '../src/content/dock-war.js';
import { createDockWarDefinitions, dockWarDefinitionSources, dockWarDefinitionCatalog } from '../src/director/dock-war.js';
import { compileDirectorDefinitions, evaluateDirectorPressures, COMPETITION_CLASSES } from '../src/director/definitions.js';
import { aggregatePressureMemory } from '../src/director/memory.js';
import { situationEligible, selectDirectorCandidates } from '../src/director/selection.js';
import { createLivingWorldDirector } from '../src/director/runtime.js';
import { dockFixture } from './lib/director-support.js';
import { loadAndValidateGraphPackages } from '../src/worldgraph-validate.js';
import crypto from 'node:crypto';
import { canonicalBytes } from '../src/content/canonical.js';
import { campaignNetworkFixture } from './lib/campaign-network-support.js';
import { key } from './lib/player-command-support.js';
import { observeDirectorWorld } from '../src/director/pressures.js';
import { createCampaignNetworkDefinitions } from '../src/director/campaign-network.js';

const content = createDockWarContent(), catalog = dockWarDefinitionCatalog(content);
function networkSources() {
  const sources = dockWarDefinitionSources(content), opening = sources.situations[0];
  opening.network = { competition: ['CONTESTED', 'COOPERATIVE', 'ESCALATING', 'CASCADE'],
    domains: ['territory', 'family', 'economy'], relatedWorld: [],
    information: opening.initialSignals.map((signal) => ({ signalId: signal.id,
      layer: signal.audienceId === 'investigators' ? 'LOCAL_RUMOR' : signal.audienceId === 'canal_crew' ? 'CREW_INTELLIGENCE' : 'FAMILY_INTELLIGENCE',
      whyKnown: 'Your current group has this information.', stakes: 'The route could change hands.' })),
    implications: opening.consequenceContracts.map((c) => ({ consequenceId: c.id, kind: 'route_access' })) };
  return sources;
}
const compiled = compileDirectorDefinitions(networkSources(), catalog);
assert.equal(COMPETITION_CLASSES.length, 7);
assert(Object.isFrozen(compiled.situations[0].network.information));
for (const competition of COMPETITION_CLASSES) {
  const sources = networkSources(); sources.situations[0].network.competition = [competition];
  if (competition === 'SECRET') sources.situations[0].audiences.find((a) => a.id === 'investigators').knowledge = content.routeKnowledge;
  assert(compileDirectorDefinitions(sources, catalog).situations[0].network.competition.includes(competition));
}
{
  const source = networkSources(), opening = source.situations[0], campaign = source.campaigns[0];
  const corpus = { situations: Array.from({ length: 50 }, (_, i) => ({ ...opening, id: `situation:corpus_${i}` })),
    campaigns: Array.from({ length: 50 }, (_, i) => ({ ...campaign, id: `campaign:corpus_${i}`, entryNode: 'opening',
      nodes: [{ id: 'opening', situationId: `situation:corpus_${i}`, terminal: true }], branches: [] })) };
  assert.equal(compileDirectorDefinitions(corpus, catalog).situations.length, 50, 'Authoring framework admits a bounded fifty-Situation corpus');
}
const rejects = (change, field) => {
  const source = networkSources(); change(source.situations[0]);
  assert.throws(() => compileDirectorDefinitions(source, catalog), (error) => error.code === 'bad_director_definition'
    && error.definitionId === source.situations[0].id && error.field === field && error.message.includes(field));
};
rejects((s) => s.network.competition.push('PAY_TO_WIN'), 'network.competition');
rejects((s) => s.network.competition.push('SECRET'), 'network.competition');
rejects((s) => s.network.competition.push('EXCLUSIVE', 'PARALLEL'), 'network.competition');
rejects((s) => { s.network.information[0].layer = 'PUBLIC_SIGNAL'; }, 'network.information');
rejects((s) => { s.network.information[0].whyKnown = '${definitionHash}'; }, 'network.information');
for (const name of ['worldRevision', 'starting_world_revision', 'dependencyHashes', 'director_receipts']) {
  rejects((s) => { s.network.information[0].stakes = `Inspect ${name} now.`; }, 'network.information');
  rejects((s) => { s.initialSignals[0].description = `Inspect ${name} now.`; }, 'initialSignals');
}
rejects((s) => { s.network.implications[0].kind = 'mint_cash'; }, 'network.implications');
rejects((s) => { s.network.implications[0].signals = ['fabricated_evidence']; }, 'network.implications');
rejects((s) => { s.network.relatedWorld.push({ objectId: 'unknown', states: ['ready'] }); }, 'network.relatedWorld');
rejects((s) => { s.possibleEscalations[0].afterSeconds = s.expiryPolicy.afterSeconds; }, 'possibleEscalations');
rejects((s) => { s.pressureInputs.push('engagement'); }, 'pressureInputs');
rejects((s) => { s.eligibility.push({ fact: 'walletBalance', op: 'gte', value: 1 }); }, 'eligibility');
rejects((s) => { s.eligibility.push({ fact: 'shortageWindows', op: 'gte', value: 29 }); }, 'eligibility');
rejects((s) => { s.eligibility.push({ fact: 'historyAvailable', op: 'eq', value: 2 }); }, 'eligibility');

const at = Date.UTC(2026, 8, 18), hour = 3600000, objectId = content.objects[0].id;
const baseFact = { objectId, worldRevision: 1, resourceQuantity: 1, resourceDemand: 2, controllerFamilyId: 'family:a' };
const samples = [6, 12, 18].map((hours) => ({ at: at - hours * hour, facts: [baseFact] }));
const events = [
  { id: 'a', revision: 1, family_id: 'family:a', action_id: 'establish', occurred_at: new Date(at - 20 * hour) },
  { id: 'b', revision: 2, family_id: 'family:b', action_id: 'intercept', occurred_at: new Date(at - 10 * hour) },
  { id: 'c', revision: 3, family_id: 'family:b', action_id: 'repair', occurred_at: new Date(at - hour) },
];
const input = { objectId, controllerFamilyId: 'family:b', at, samples, events,
  operations: [{ status: 'failed', resolved_at: new Date(at - hour) }], discoveries: 2,
  actionSignals: { intercept: ['violence'], repair: ['peaceful'] } };
const memory = aggregatePressureMemory(input);
assert.equal(memory.shortageWindows, 3); assert.equal(memory.recentTerritoryChanges, 1);
assert.equal(memory.dominanceSeconds, 36000); assert.equal(memory.violentEvents, 1);
assert.equal(memory.peacefulResolutions, 1); assert.equal(memory.repeatedFamilyFailures, 1);
assert.deepEqual(aggregatePressureMemory({ ...input, events: [...events].reverse(), samples: [...samples].reverse() }), memory);
assert.equal(aggregatePressureMemory({ ...input, samples: [...samples, samples[0]] }).shortageWindows, 3);
assert.equal(aggregatePressureMemory({ ...input, saturated: true }).historyAvailable, 0);
assert.equal(aggregatePressureMemory({ ...input, events: Array(33).fill(events[0]) }).violentEvents, 0);
assert.equal(aggregatePressureMemory({ ...input, samples: samples.map((sample) => ({ ...sample,
  facts: [{ ...baseFact, resourceQuantity: 10 }] })) }).shortageWindows, 0);
assert.equal(evaluateDirectorPressures(['law'], memory)[0].valuePermille, 125);
assert.equal(evaluateDirectorPressures(['law'], { ...memory, historyAvailable: 0 })[0].valuePermille, 0);
const facts = { ...memory, ...baseFact, worldState: 'shortage', resourceDeficit: 1, activePlayers: 4, activeFamilies: 2,
  activeCrews: 2, pressures: { resourceDeficit: 0.5, territoryControl: 1 } };
assert(situationEligible(compiled.situations[0], facts));
assert(!situationEligible(compiled.situations[0], { ...facts, recentActivity: 0 }));
assert(!situationEligible(compiled.situations[0], { ...facts, historyAvailable: 0 }), 'Unavailable history cannot increase conflict generation');
assert.equal(selectDirectorCandidates([{ definition: compiled.situations[0], facts: { ...facts, historyAvailable: 0 } }], [], [], at).selected.length, 0);
assert.equal(selectDirectorCandidates([{ definition: compiled.situations[0], facts: { ...facts, recentActivity: 0 } }], [], [], at).selected.length, 0);
const related = { ...compiled.situations[0], network: { ...compiled.situations[0].network,
  relatedWorld: [{ objectId: 'territory:canal', states: ['open'] }] } };
assert(!situationEligible(related, facts));
assert(situationEligible(related, { ...facts, relatedWorld: { 'territory:canal': { state: 'open' } } }));
console.log('PASS network compiler, audience contracts, bounded pressure memory, saturation and quiet-world selection');

const f = await dockFixture('network_version');
try {
  let now = Date.now();
  const v1 = createDockWarDefinitions(f.content);
  const nextSources = dockWarDefinitionSources(f.content);
  for (const source of [...nextSources.situations, ...nextSources.campaigns]) source.version = 2;
  nextSources.situations[0].initialSignals[0].title = 'The second edition of the dock notice';
  const v2 = compileDirectorDefinitions(nextSources, dockWarDefinitionCatalog(f.content));
  const options = { pool: f.pool, content: f.content, mode: 'LIVE', clock: () => now };
  const changedPackages = structuredClone([...f.content.registry.byPackage.values()]);
  const graphId = v1.situations[0].dependencyHashes.mysteries[0].id;
  changedPackages.find((p) => p.id === graphId).nodes[0].metadata.description = 'A different account of the tide.';
  const changedRegistry = loadAndValidateGraphPackages(changedPackages);
  assert.throws(() => createLivingWorldDirector({ ...options, content: { ...f.content, registry: changedRegistry }, definitions: v1 }),
    (error) => error.code === 'director_definition_changed', 'Pinned mystery dependencies cannot silently use a newer graph');
  await f.establish();
  await createLivingWorldDirector({ ...options, definitions: v1 }).tick();
  now += 3600001;
  const upgraded = createLivingWorldDirector({ ...options, definitions: v2, retainedDefinitions: [v1] });
  await upgraded.tick();
  const running = (await f.pool.query('SELECT definition_version,definition_hash,state FROM director_situations WHERE terminal=false')).rows[0];
  assert.equal(Number(running.definition_version), 1); assert.equal(running.definition_hash, v1.situations[0].contentHash);
  assert.equal(running.state, 'mobilizing');
  const pinned = (await f.pool.query('SELECT version FROM director_definitions WHERE kind=$1 AND definition_id=$2 ORDER BY version',
    ['situation', v1.situations[0].id])).rows;
  assert.deepEqual(pinned.map((r) => Number(r.version)), [1, 2]);
  now += 172800001; await upgraded.tick(); now += 300001; await upgraded.tick();
  const fresh = (await f.pool.query('SELECT definition_version FROM director_situations WHERE terminal=false')).rows[0];
  assert.equal(Number(fresh.definition_version), 2);
  const replay = await createLivingWorldDirector({ ...options, definitions: v2, retainedDefinitions: [v1] }).tick();
  assert.equal(replay.replayed, true);
  const conflict = dockWarDefinitionSources(f.content); conflict.situations[0].initialSignals[0].title = 'A forbidden replacement';
  assert.throws(() => createLivingWorldDirector({ ...options, definitions: compileDirectorDefinitions(conflict, dockWarDefinitionCatalog(f.content)),
    retainedDefinitions: [v1] }), (error) => error.code === 'director_definition_changed');
  console.log('PASS immutable running version, future version admission, historical pins, restart and replay');
} finally { await f.cleanup(); }

{
  const failed = await campaignNetworkFixture('network_resolved_window');
  try {
    await failed.networkEstablish();
    const boss = failed.actors.aBoss;
    const definition = failed.content.operationDefinitions.find((entry) => entry.id === 'operation:canal_recover_shipment');
    let operationId;
    // Pick a real deterministic failed outcome by ordinary creation/cancellation.
    // No seed, outcome, resource, receipt or canonical timestamp is rewritten.
    for (let attempt = 0; attempt < 64; attempt++) {
      const created = await failed.family.create(boss, { definitionId: definition.id }, key());
      const row = (await failed.pool.query('SELECT resolution_seed FROM world_operations WHERE id=$1', [created.operationId])).rows[0];
      const digest = crypto.createHash('sha256').update(canonicalBytes([row.resolution_seed, created.operationId, definition.contentHash])).digest('hex');
      if (parseInt(digest.slice(0, 12), 16) % 1000 >= definition.resolution.chancePermille) { operationId = created.operationId; break; }
      await failed.family.command(boss, created.operationId, 'cancel', {}, key());
    }
    assert(operationId);
    const recovery = await failed.networkPrepare('recover_shipment', { existingOperationId: operationId });
    await recovery.command('organizer', 'execute');
    const row = (await failed.pool.query('SELECT created_at,resolved_at,status FROM world_operations WHERE id=$1', [operationId])).rows[0];
    assert.equal(row.status, 'failed');
    const created = new Date(row.created_at).getTime(), resolved = new Date(row.resolved_at).getTime();
    assert(resolved > created);
    // Advance only the observer clock so its seven-day cutoff falls between
    // creation and resolution. The legitimate operation lifetime stays intact.
    const observedAt = created + 7 * 86400000 + Math.max(1, Math.floor((resolved - created) / 2));
    const since = observedAt - 7 * 86400000;
    assert(created < since && resolved >= since);
    const snapshot = async () => ({
      stacks: (await failed.pool.query('SELECT * FROM item_stacks ORDER BY owner_scope,owner_id,template_id,quality')).rows,
      items: (await failed.pool.query('SELECT * FROM item_instances ORDER BY id')).rows,
      events: (await failed.pool.query('SELECT * FROM item_events ORDER BY sequence')).rows,
      outcomes: (await failed.pool.query('SELECT id,status,resolved_at FROM world_operations ORDER BY id')).rows,
    });
    const before = await snapshot();
    const definitions = createCampaignNetworkDefinitions(failed.content);
    const facts = await observeDirectorWorld(failed.pool, { ...failed.content, objects: failed.kernel.definitions },
      [failed.ids.object], observedAt, definitions.situations);
    const fact = facts.find((entry) => entry.objectId === failed.ids.object);
    assert.equal(fact.failedOperations, 0, 'Legacy creation-window statistics correctly exclude the old operation');
    assert.equal(fact.repeatedFamilyFailures, 1, 'Pressure memory still observes the recent canonical failure by resolution time');
    assert.equal(fact.historyAvailable, 1);
    assert.deepEqual(await snapshot(), before, 'Historical observation never restores spent supplies or changes failed outcomes');
    console.log('PASS recent resolved-operation pressure survives creation-window boundary without altering canonical timestamps or resources');
  } finally { await failed.cleanup(); }
}
