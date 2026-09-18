// Rank only already authorized commands. These explanations never admit a mutation.
export const COMMAND_LIMIT = 128;
export const OPPORTUNITY_LIMIT = 80;
export const OPPORTUNITY_CATEGORIES = Object.freeze(['URGENT', 'FAMILY', 'CREW', 'PERSONAL', 'INTELLIGENCE', 'WORLD']);

const words = (value) => String(value ?? '').replace(/^[a-z]+:/, '').replace(/[_:.-]+/g, ' ');
const prose = (entry) => typeof entry === 'string' ? entry : entry?.description || entry?.label || entry?.title || '';
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const date = (value) => value == null ? null : Number.isFinite(new Date(value).getTime()) ? new Date(value).getTime() : null;
const term = (entry) => entry?.description || entry?.label || `${entry.quantity ?? 1} ${words(entry.templateId || entry.kind || 'required resource')}`;

export function playerOpportunities(projection, commands) {
  const asOf = date(projection.asOf) ?? 0;
  const result = commands.filter((command) => !['COMPLETED', 'EXPIRED'].includes(command.availability)).map((command) => {
    const domain = command.commandType.split('.')[0];
    const situation = domain === 'situation' ? projection.situations?.find((entry) => entry.id === command.subject.id) : null;
    const operation = domain === 'operation' && projection.operations?.selected?.id === command.subject.id
      ? projection.operations.selected : null;
    // Command receipt expiry is a refresh deadline, not a fictional emergency.
    const deadline = date(situation?.expiresAt ?? operation?.expiresAt
      ?? projection.operations?.instances?.find((entry) => entry.id === command.subject.id)?.expiresAt);
    const remaining = deadline === null ? null : Math.max(0, Math.ceil((deadline - asOf) / 1000));
    const available = command.availability === 'AVAILABLE';
    const committed = operation?.roles?.some((role) => role.mine) === true;
    const family = domain === 'operation' || [command.subject, command.target].some((ref) => ref?.type === 'family')
      || situation?.information?.some((entry) => entry.layer === 'FAMILY_INTELLIGENCE');
    const crew = [command.subject, command.target].some((ref) => ref?.type === 'crew')
      || situation?.information?.some((entry) => entry.layer === 'CREW_INTELLIGENCE');
    const intelligence = ['mystery', 'discovery', 'knowledge'].includes(domain);
    const urgent = remaining !== null && remaining > 0 && remaining <= 900 && (available || committed);
    const category = urgent ? 'URGENT' : family ? 'FAMILY' : crew ? 'CREW' : intelligence ? 'INTELLIGENCE'
      : ['recipe', 'item'].includes(domain) ? 'PERSONAL' : 'WORLD';
    const reasons = [];
    if (urgent) reasons.push('The window is closing.');
    if (committed) reasons.push('You have already committed to this work.');
    if (available) reasons.push('Your next move is ready.');
    if (family) reasons.push('This concerns your Family.');
    else if (crew) reasons.push('Your Crew can work on this together.');
    const continuity = !!operation || !!situation || (domain === 'mystery' && projection.cases?.selected?.graph?.id === command.subject.id);
    if (continuity) reasons.push('There is unfinished business here.');
    const whyKnown = situation?.whyKnown || situation?.information?.[0]?.whyKnown
      || (family ? 'This work appears in the Family business available to you.' : crew ? 'This is part of your current Crew business.'
        : intelligence ? 'This lead comes from the evidence and investigations available to you.'
          : ['recipe', 'item'].includes(domain) ? 'Your equipment and workshop records make this work visible.'
            : 'You can see this part of the city.');
    // A partial inventory page is never used to infer satisfaction.
    const requirements = command.availability === 'LOCKED'
      ? [{ description: 'Keep investigating. Further requirements are not yet known.', status: 'UNKNOWN' }]
      : [
        ...(command.blockers || []).map((entry) => ({ description: prose(entry) || 'Keep investigating.',
          status: entry.kind === 'undiscovered' ? 'UNKNOWN' : 'MISSING' })),
        ...(command.costs || []).map((entry) => ({ description: term(entry), status: available ? 'SATISFIED' : 'REQUIRED' })),
        ...(command.requiredItems || []).map((entry) => ({ description: term(entry), status: available ? 'SATISFIED' : 'REQUIRED' })),
        ...(command.requiredKnowledge || []).map((entry) => ({ description: prose(entry) || 'The necessary evidence.', status: available ? 'SATISFIED' : 'REQUIRED' })),
        ...(command.requiredRoles || []).map((entry) => ({ description: prose(entry) || 'A participant is needed.',
          status: entry.mine || entry.filled ? 'SATISFIED' : 'REQUIRED' })),
        ...(command.requiredParticipants || []).map((entry) => ({ description: prose(entry) || 'A participant is needed.',
          status: entry.filled ? 'SATISFIED' : 'REQUIRED' })),
      ].slice(0, 12);
    const helpers = (situation?.helpers || []).map(prose).filter(Boolean).slice(0, 4);
    if (operation && !helpers.length && projection.family) helpers.push('Your Family');
    const peopleNeeded = command.availability !== 'LOCKED'
      && ((command.requiredRoles?.length || 0) > 1 || (command.requiredParticipants?.length || 0) > 0);
    const kind = { operation: 'operation', mystery: 'mystery_lead', discovery: 'new_intelligence', knowledge: 'social_request',
      recipe: 'crafting', item: 'resource', world: 'territory', situation: 'world_event' }[domain] || 'world_change';
    const opportunity = { opportunityId: command.commandId, kind, category, label: command.label,
      description: command.description, subject: command.subject, availability: command.availability,
      commandIds: [command.commandId], expiresAt: deadline === null ? null : new Date(deadline).toISOString(),
      timeRemainingSeconds: remaining, whyKnown, whyItMatters: situation?.stakes || situation?.information?.[0]?.stakes || reasons[0] || 'This work is waiting for your attention.',
      reasons, requirements, peopleNeeded, helpers, risk: (command.risk || []).map(prose).filter(Boolean).slice(0, 4),
      progress: operation ? { description: committed ? 'You have a part in this operation.' : 'The Family is preparing this operation.',
        completed: operation.roles?.filter((role) => role.filled).length || 0, total: operation.roles?.length || 0 }
        : { description: command.availability === 'IN_PROGRESS' ? 'Already underway.' : available ? 'Ready for your next move.' : 'Preparation is still needed.' } };
    // Internal tuple; never return ranking values, weights or hidden facts.
    const rank = [Number(urgent), Number(!!committed), Number(available), Number(!!(family || crew)), Number(continuity),
      command.commandType === 'operation.execute' ? 5 : domain === 'discovery' ? 4 : domain === 'situation' ? 3 : intelligence ? 2 : 1,
      deadline === null ? -Number.MAX_SAFE_INTEGER : -deadline];
    return { opportunity, rank };
  });
  if (projection.crew?.objective && !projection.crew.objective.done) result.push({ rank: [0, 0, 0, 1, 1, 0, 0], opportunity: {
    opportunityId: `crew:${projection.crew.objective.id}`, kind: 'crew_requirement', category: 'CREW',
    label: 'Your Crew has unfinished business', description: 'Review your current Crew objective.',
    subject: { type: 'crew', id: projection.crew.id }, availability: 'IN_PROGRESS', commandIds: [], expiresAt: null,
    timeRemainingSeconds: null, whyKnown: 'You belong to this Crew.', whyItMatters: 'Your people are working toward a shared objective.',
    reasons: ['Your Crew can work on this together.'], requirements: [], peopleNeeded: true,
    helpers: (projection.crew.members || []).map((member) => member.name).filter(Boolean).slice(0, 4), risk: [],
    progress: { description: 'Your Crew objective', completed: projection.crew.objective.progress, total: projection.crew.objective.target },
  } });
  result.sort((a, b) => {
    for (let i = 0; i < a.rank.length; i++) if (a.rank[i] !== b.rank[i]) return b.rank[i] - a.rank[i];
    return compare(a.opportunity.opportunityId, b.opportunity.opportunityId);
  });
  const opportunities = result.slice(0, OPPORTUNITY_LIMIT).map((entry) => entry.opportunity);
  const opportunityGroups = OPPORTUNITY_CATEGORIES.map((category) => ({ category,
    opportunityIds: opportunities.filter((entry) => entry.category === category).map((entry) => entry.opportunityId) }))
    .filter((group) => group.opportunityIds.length);
  return { opportunities, opportunityGroups, opportunitiesTruncated: result.length > OPPORTUNITY_LIMIT,
    ...(Array.isArray(projection.consequences) ? { consequences: projection.consequences.map((entry) => ({ ...entry,
      // Shared visible subject establishes related work, not a claim of causation.
      opportunityIds: opportunities.filter((opportunity) => opportunity.subject?.type === entry.subject?.type
        && opportunity.subject?.id === entry.subject?.id).map((opportunity) => opportunity.opportunityId).slice(0, 4),
    })) } : {}) };
}
