// Private, bounded observations of canonical authorities. Saturated counts are
// lower bounds, never evidence of scarcity. No Director counter is world truth.
import { GameError } from '../game.js';
import { DIRECTOR_PRESSURES, evaluateDirectorPressures } from './definitions.js';
import { aggregatePressureMemory, readPressureSamples } from './memory.js';

export const PRESSURE_SEMANTICS = Object.freeze({
  resourceDeficit: 'Units missing to fund the most material-intensive admitted response, divided by its exact requirement.',
  territoryControl: 'One when a real Family controls the object; zero otherwise.',
  operationFailure: 'Failed operations divided by completed plus failed operations in the bounded recent sample.',
  discoveryActivity: 'Distinct current discovery sources, capped at 32, divided by 32.',
});
const bounded = (n, max = 1000000) => Math.max(0, Math.min(max, Number(n) || 0));

export function pressuresFromFacts(facts) {
  const demand = bounded(facts.resourceDemand);
  return Object.freeze({ ...Object.fromEntries(evaluateDirectorPressures(Object.keys(DIRECTOR_PRESSURES), facts)
    .map((pressure) => [pressure.id, pressure.valuePermille / 1000])),
  resourceDeficit: demand ? Math.min(1, Math.max(0, demand - facts.resourceQuantity) / demand) : 0,
  territoryControl: facts.controllerFamilyId ? 1 : 0,
  operationFailure: facts.completedOperations + facts.failedOperations
    ? facts.failedOperations / (facts.completedOperations + facts.failedOperations) : 0,
  discoveryActivity: bounded(facts.discoveredSources, 32) / 32 });
}

export async function observeDirectorWorld(client, content, objectIds, at, situations = []) {
  const definitions = new Map(content.objects.map((d) => [d.id, d]));
  const characters = (await client.query(`SELECT c.id,c.account_id,c.season,gm.gang_id,cm.crew_id
    FROM characters c JOIN accounts a ON a.id=c.account_id
    LEFT JOIN gang_members gm ON gm.character_id=c.id
    LEFT JOIN crew_members cm ON cm.account_id=c.account_id
    WHERE c.alive=true AND a.status='active' ORDER BY c.id LIMIT 5001`)).rows;
  const population = characters.slice(0, 5000);
  const since = new Date(at - 7 * 86400000);
  const samples = situations.some((s) => s.network) ? await readPressureSamples(client, at) : [];
  // Bound the actual indexed row window before de-duplicating sources. A busy
  // discovery window becomes unavailable pressure rather than an unlimited scan.
  const discoveryRows = (await client.query(`SELECT source_root FROM coordination_claims
    WHERE discovered_at >= $1 AND discovered_at <= $2 ORDER BY discovered_at DESC,source_root LIMIT 257`, [since, new Date(at)])).rows;
  const discoveries = [...new Set(discoveryRows.slice(0, 256).map((entry) => entry.source_root))];
  const facts = [];
  for (const objectId of [...new Set(objectIds)].sort()) {
    const definition = definitions.get(objectId);
    if (!definition) throw new GameError('director_definition_changed', 'Director content is unavailable.');
    const row = (await client.query('SELECT * FROM world_kernel_objects WHERE id=$1', [objectId])).rows[0];
    if (!row) continue; // Missing authored objects are not fabricated by the scheduler.
    if (row.definition_hash !== definition.contentHash || !definition.states.includes(row.state))
      throw new GameError('director_definition_changed', 'Director content is unavailable.');
    const events = (await client.query(`SELECT id,action_id,next_state,revision,family_id,occurred_at FROM world_kernel_events
      WHERE object_id=$1 ORDER BY revision DESC LIMIT 33`, [objectId])).rows;
    const responseMaterials = definition.actions.flatMap((a) => a.materials);
    // This pilot has one resource pressure. Multiple resources require separate,
    // explicitly declared inputs rather than adding unlike quantities together.
    const templateId = content.directorResourceTemplateId || 'mat:wire';
    const demand = Math.max(0, ...responseMaterials.filter((m) => m.templateId === templateId).map((m) => m.quantity));
    const stock = row.controller_family_id ? (await client.query(`SELECT s.quantity FROM item_stacks s
      JOIN characters c ON c.account_id=s.owner_id AND c.alive=true
      JOIN gang_members gm ON gm.character_id=c.id
      WHERE gm.gang_id=$1 AND s.owner_scope='account' AND s.template_id=$2 AND s.quality='standard'
      ORDER BY s.owner_id LIMIT 10001`, [row.controller_family_id, templateId])).rows : [];
    const quantity = stock.length > 10000 ? 1000000 : bounded(stock.reduce((sum, s) => sum + Number(s.quantity), 0));
    const operationRows = row.controller_family_id ? (await client.query(`SELECT status,resolved_at FROM world_operations
      WHERE family_id=$1 AND coordination_mode='family' AND created_at >= $2 ORDER BY created_at DESC,id LIMIT 129`,
    [row.controller_family_id, since])).rows : [];
    const operations = operationRows.slice(0, 128);
    const resolvedRows = row.controller_family_id ? (await client.query(`SELECT status,resolved_at FROM world_operations
      WHERE family_id=$1 AND coordination_mode='family' AND resolved_at >= $2 AND resolved_at <= $3
      ORDER BY resolved_at DESC,id LIMIT 129`, [row.controller_family_id, since, new Date(at)])).rows : [];
    const actionSignals = Object.create(null);
    for (const situation of situations.filter((s) => s.objectId === objectId)) for (const implication of situation.network?.implications || []) {
      const consequence = situation.consequenceContracts.find((c) => c.id === implication.consequenceId);
      actionSignals[consequence.actionId] = [...new Set([...(actionSignals[consequence.actionId] || []), ...(implication.signals || [])])];
    }
    const recentEvents = events.filter((event) => new Date(event.occurred_at) >= since);
    const memoryEvents = recentEvents.slice(0, 32);
    const anchor = events.find((event) => new Date(event.occurred_at) < since);
    if (anchor && memoryEvents.length < 32) memoryEvents.push(anchor);
    const memory = aggregatePressureMemory({ objectId, controllerFamilyId: row.controller_family_id, at, samples,
      events: memoryEvents, operations: resolvedRows.slice(0, 128), discoveries: Math.min(32, discoveries.length), actionSignals,
      saturated: recentEvents.length > 32 || resolvedRows.length > 128 || discoveryRows.length > 256 || characters.length > 5000 });
    const entry = { ...memory, objectId, worldState: row.state, worldRevision: Number(row.revision),
      controllerFamilyId: row.controller_family_id, resourceQuantity: quantity, resourceDemand: demand,
      resourceDeficit: Math.max(0, demand - quantity), activePlayers: population.length,
      activeFamilies: new Set(population.map((p) => p.gang_id).filter(Boolean)).size,
      activeCrews: new Set(population.map((p) => p.crew_id).filter(Boolean)).size,
      completedOperations: operations.filter((o) => o.status === 'completed').length,
      failedOperations: operations.filter((o) => ['failed', 'expired', 'canceled'].includes(o.status)).length,
      familyActivity: operations.length, discoveredSources: Math.min(32, discoveries.length),
      season: Math.max(1, ...population.map((p) => Number(p.season))),
      priorWorldAction: events[0]?.action_id || '', priorOutcome: events[0]?.next_state || '',
      references: { worldRevision: Number(row.revision), worldEventIds: events.slice(0, 32).map((e) => e.id),
        materialTemplateId: templateId, populationSaturated: characters.length > 5000,
        stockSaturated: stock.length > 10000, observationWindowDays: 7 } };
    facts.push(Object.freeze({ ...entry, pressures: pressuresFromFacts(entry) }));
  }
  // Related observations are references to the same locked canonical snapshot,
  // not additional persisted world authority.
  return facts.map((fact) => {
    const dependencies = new Set(situations.filter((s) => s.objectId === fact.objectId)
      .flatMap((s) => (s.network?.relatedWorld || []).map((rule) => rule.objectId)));
    return Object.freeze({ ...fact, relatedWorld: Object.fromEntries(facts.filter((related) => dependencies.has(related.objectId))
      .map((related) => [related.objectId, { state: related.worldState, revision: related.worldRevision }])) });
  });
}
