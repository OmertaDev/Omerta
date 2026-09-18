import assert from 'node:assert/strict';
import { playerOpportunities, OPPORTUNITY_LIMIT } from '../src/player-opportunities.js';

const asOf = Date.parse('2026-09-18T12:00:00Z');
const command = (id, type, extra = {}) => ({ commandId: id, commandType: type, subject: { type: type.split('.')[0], id },
  label: `Move ${id}`, description: `Description ${id}`, availability: 'AVAILABLE',
  expiresAt: new Date(asOf + 1000).toISOString(), requirements: [], blockers: [], costs: [], requiredItems: [],
  requiredKnowledge: [], requiredRoles: [], requiredParticipants: [], committedResources: [], risk: [], ...extra });
const commands = [command('craft', 'recipe.craft', { costs: [{ templateId: 'mat:wire', quantity: 2 }] }),
  command('clue', 'discovery.act'), command('supply', 'situation.act'),
  command('operation', 'operation.execute'), command('locked', 'mystery.inspect', { availability: 'LOCKED',
    blockers: [{ kind: 'undiscovered', description: 'secret culprit' }], requiredRoles: [{ title: 'secret witness' }, { title: 'secret witness' }] }),
  command('crew-work', 'knowledge.share', { target: { type: 'crew', id: 'my-crew' } }),
  command('blocked', 'recipe.craft', { availability: 'BLOCKED', blockers: [{ kind: 'known', description: 'Gather wire.' }] }),
  command('closed', 'mystery.complete', { availability: 'COMPLETED' })];
const projection = { asOf, family: { id: 'family' }, crew: { id: 'my-crew', members: [{ name: 'Sal' }],
  objective: { id: 'objective', done: false, progress: 1, target: 3 } },
  situations: [{ id: 'supply', expiresAt: new Date(asOf + 600000).toISOString(), whyKnown: 'A runner brought the news.',
    stakes: 'The route may close.', hiddenWeight: 987654, hiddenTruth: 'do not enumerate', helpers: ['Your Crew'] }],
  operations: { selected: { id: 'operation', roles: [{ mine: true, filled: true }, { filled: false }],
    expiresAt: new Date(asOf + 7200000).toISOString() } } };
const result = playerOpportunities(projection, commands);
assert.equal(result.opportunities[0].opportunityId, 'supply');
assert.equal(result.opportunities[0].category, 'URGENT');
assert.equal(result.opportunities[0].timeRemainingSeconds, 600);
assert.equal(result.opportunities[0].whyKnown, 'A runner brought the news.');
assert.equal(result.opportunities[0].whyItMatters, 'The route may close.');
assert.equal(result.opportunities[1].opportunityId, 'operation', 'Existing commitment precedes routine available work');
assert.deepEqual(result, playerOpportunities(projection, [...commands].reverse()), 'Order is independent of catalog iteration');
assert.equal(result.opportunities.find((entry) => entry.opportunityId === 'craft').category, 'PERSONAL');
assert.equal(result.opportunities.find((entry) => entry.opportunityId === 'craft').expiresAt, null, 'Receipt expiry is never fictional urgency');
assert.equal(result.opportunities.find((entry) => entry.opportunityId === 'craft').requirements[0].status, 'SATISFIED');
assert.equal(result.opportunities.find((entry) => entry.opportunityId === 'blocked').requirements[0].status, 'MISSING');
assert.equal(result.opportunities.find((entry) => entry.opportunityId === 'locked').requirements[0].status, 'UNKNOWN');
assert.equal(result.opportunities.find((entry) => entry.opportunityId === 'locked').peopleNeeded, false, 'Undisclosed participant requirements do not leak through summaries');
assert.equal(result.opportunities.find((entry) => entry.opportunityId === 'crew-work').category, 'CREW');
assert.equal(result.opportunities.find((entry) => entry.opportunityId === 'clue').category, 'INTELLIGENCE');
assert(!result.opportunities.some((entry) => entry.opportunityId === 'closed'));
for (const forbidden of ['priority', 'score', 'hiddenWeight', 'hiddenTruth', '987654', 'secret culprit', 'secret witness']) {
  assert(!JSON.stringify(result).includes(forbidden), forbidden);
}
assert.deepEqual(playerOpportunities({ asOf, situations: [{ id: 'undiscovered', hiddenTruth: 'secret' }] }, []),
  playerOpportunities({ asOf, situations: [] }, []), 'No issued command means no existence, group or count disclosure');
const bounded = playerOpportunities({ asOf }, Array.from({ length: 120 }, (_, index) => command(`craft-${index}`, 'recipe.craft')));
assert.equal(bounded.opportunities.length, OPPORTUNITY_LIMIT); assert(bounded.opportunitiesTruncated);
assert.deepEqual(bounded.opportunityGroups.flatMap((group) => group.opportunityIds).sort(), bounded.opportunities.map((entry) => entry.opportunityId).sort());
const followup = command('visible-followup', 'world.execute', { subject: { type: 'world_object', id: 'known-workshop' } });
const history = [{ id: 'known-event', subject: { type: 'world_object', id: 'known-workshop' } }];
assert.deepEqual(playerOpportunities({ asOf, consequences: history }, [followup]).consequences[0].opportunityIds, ['visible-followup']);
assert.deepEqual(playerOpportunities({ asOf, consequences: history }, []).consequences[0].opportunityIds, [], 'Hidden follow-up work cannot be inferred from a public consequence');
console.log('player-opportunities: deterministic ranking, six categories, real deadlines, disclosed preparation, secret omission and bounds PASS');
