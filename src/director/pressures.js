// Private, bounded observations of canonical authorities. Saturated counts are
// lower bounds, never evidence of scarcity. No Director counter is world truth.
import { GameError } from '../game.js';

export const PRESSURE_SEMANTICS = Object.freeze({
  resourceDeficit: 'Units missing to fund the most material-intensive admitted response, divided by its exact requirement.',
  territoryControl: 'One when a real Family controls the object; zero otherwise.',
  operationFailure: 'Failed operations divided by completed plus failed operations in the bounded recent sample.',
  discoveryActivity: 'Distinct current discovery sources, capped at 32, divided by 32.',
});
const bounded = (n, max = 1000000) => Math.max(0, Math.min(max, Number(n) || 0));

export function pressuresFromFacts(facts) {
  const demand = bounded(facts.resourceDemand);
  return Object.freeze({
    resourceDeficit: demand ? Math.min(1, Math.max(0, demand - facts.resourceQuantity) / demand) : 0,
    territoryControl: facts.controllerFamilyId ? 1 : 0,
    operationFailure: facts.completedOperations + facts.failedOperations
      ? facts.failedOperations / (facts.completedOperations + facts.failedOperations) : 0,
    discoveryActivity: bounded(facts.discoveredSources, 32) / 32,
  });
}

export async function observeDirectorWorld(client, content, objectIds, at) {
  const definitions = new Map(content.objects.map((d) => [d.id, d]));
  const characters = (await client.query(`SELECT c.id,c.account_id,c.season,gm.gang_id,cm.crew_id
    FROM characters c JOIN accounts a ON a.id=c.account_id
    LEFT JOIN gang_members gm ON gm.character_id=c.id
    LEFT JOIN crew_members cm ON cm.account_id=c.account_id
    WHERE c.alive=true AND a.status='active' ORDER BY c.id LIMIT 5001`)).rows;
  const population = characters.slice(0, 5000);
  const since = new Date(at - 7 * 86400000);
  const facts = [];
  for (const objectId of [...new Set(objectIds)].sort()) {
    const definition = definitions.get(objectId);
    if (!definition) throw new GameError('director_definition_changed', 'Director content is unavailable.');
    const row = (await client.query('SELECT * FROM world_kernel_objects WHERE id=$1', [objectId])).rows[0];
    if (!row) continue; // Missing authored objects are not fabricated by the scheduler.
    if (row.definition_hash !== definition.contentHash || !definition.states.includes(row.state))
      throw new GameError('director_definition_changed', 'Director content is unavailable.');
    const events = (await client.query(`SELECT id,action_id,next_state,revision FROM world_kernel_events
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
    const operations = row.controller_family_id ? (await client.query(`SELECT status FROM world_operations
      WHERE family_id=$1 AND coordination_mode='family' AND created_at >= $2 ORDER BY created_at DESC,id LIMIT 129`,
    [row.controller_family_id, since])).rows.slice(0, 128) : [];
    const discoveries = (await client.query(`SELECT DISTINCT source_root FROM coordination_claims
      WHERE discovered_at >= $1 ORDER BY source_root LIMIT 33`, [since])).rows;
    const entry = { objectId, worldState: row.state, worldRevision: Number(row.revision),
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
  return facts;
}
