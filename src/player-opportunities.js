// Derive a bounded, player-authorized work list. No graph traversal or new authority.
export const COMMAND_LIMIT = 128;
export const OPPORTUNITY_LIMIT = 80;

export function playerOpportunities(projection, commands) {
  const result = commands.filter((command) => !['COMPLETED', 'EXPIRED'].includes(command.availability)).map((command) => {
    const family = command.commandType.split('.')[0];
    const kind = { operation: 'operation', mystery: 'mystery_lead', discovery: 'new_intelligence', knowledge: 'social_request',
      recipe: 'crafting', item: 'resource', world: 'territory', situation: 'world_event' }[family] || 'world_change';
    const priority = command.availability === 'AVAILABLE'
      ? command.commandType === 'operation.execute' ? 100 : family === 'discovery' ? 90 : family === 'situation' ? 88 : family === 'mystery' ? 85 : 70
      : command.availability === 'IN_PROGRESS' ? 45 : 30;
    return { opportunityId: command.commandId, kind, priority, label: command.label,
      description: command.description, subject: command.subject, availability: command.availability,
      commandIds: [command.commandId], expiresAt: command.expiresAt };
  });
  if (projection.crew?.objective && !projection.crew.objective.done) result.push({
    opportunityId: `crew:${projection.crew.objective.id}`, kind: 'crew_requirement', priority: 40,
    label: 'Your Crew has unfinished business', description: 'Review your current Crew objective.',
    subject: { type: 'crew', id: projection.crew.id }, availability: 'IN_PROGRESS', commandIds: [], expiresAt: null,
  });
  result.sort((a, b) => b.priority - a.priority || a.opportunityId.localeCompare(b.opportunityId));
  return { opportunities: result.slice(0, OPPORTUNITY_LIMIT), opportunitiesTruncated: result.length > OPPORTUNITY_LIMIT };
}
