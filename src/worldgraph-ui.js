// Presentation-only action descriptors. Domain mutations always re-read eligibility and authority.
import { NEIGHBORHOOD_QUEST_VENUES, NEIGHBORHOOD_QUEST_PRESENTATION } from './content/neighborhood-initiation.js';

export const segment = value => encodeURIComponent(String(value));
export function issuedAction(id, label, path, body = {}, blockedBy = [], consequence = '') {
  return { id, label, method: 'POST', path, body, available: blockedBy.length === 0, blockedBy,
    ...(consequence ? { consequence } : {}) };
}
export function mysteryStartActions(entry) {
  const path = '/v1/worldgraph/mysteries/' + segment(entry.graphId);
  const started = entry.started;
  const actions = started ? [] : [issuedAction('start', 'Accept the quest', path + '/start')];
  if (entry.status === 'active' && entry.instanceId) actions.push(issuedAction('cancel', 'Abandon this quest',
    path + '/cancel', { instanceId: entry.instanceId }, [], 'This closes this quest. Held items return to their original owner.'));
  return { ...entry, ...(entry.graphId === NEIGHBORHOOD_QUEST_PRESENTATION.graphId
    ? NEIGHBORHOOD_QUEST_PRESENTATION : {}), actions };
}
export function mysteryUi(board, registry) {
  const graphId = board.graph.id, base = '/v1/worldgraph/mysteries/' + segment(graphId);
  const hasAffordances = Array.isArray(board.actions) && board.actions.every(action => ['discover', 'complete', 'choice'].includes(action.kind));
  const nodes = board.nodes.map(projected => {
    const definition = registry.nodes.get(projected.id);
    const interactions = (definition?.conditions || []).filter(condition =>
      (condition.adapter || condition.type || condition.kind) === 'explicit_interaction')
      .map(condition => condition.interactionId ?? condition.id ?? condition.value);
    const blockedBy = (projected.blockedBy || []).filter(blocker => blocker.adapter !== 'explicit_interaction');
    if (new Set(interactions).size > 1) blockedBy.push({ code: 'interaction_unavailable' });
    const body = interactions[0] ? { interactionId: interactions[0] } : {};
    const closed = board.status !== 'active' || ['completed', 'failed', 'excluded'].includes(projected.status);
    let actions = [];
    if (!closed && ['mystery_step', 'world_gate'].includes(projected.type)) {
      const consequence = (definition?.effects || []).some(effect => ['item_consume', 'item_escrow'].includes(effect.adapter))
        ? 'This commits the step and may consume or hold the required item.' : '';
      const eligibility = hasAffordances && !board.actions.some(action => action.nodeId === projected.id && action.kind === 'complete')
        ? [...blockedBy, { code: 'step_unavailable' }] : blockedBy;
      actions = [issuedAction('complete:' + projected.id, 'Complete this step',
        base + '/nodes/' + segment(projected.id) + '/complete', body, eligibility, consequence)];
    } else if (!closed && projected.type === 'choice') {
      actions = (projected.options || []).map(option => issuedAction('choose:' + option.id, option.title,
        base + '/choices/' + segment(projected.id), { ...body, optionId: option.id },
        hasAffordances && !board.actions.some(action => action.nodeId === projected.id && action.kind === 'choice' && action.optionId === option.id)
          ? [...blockedBy, { code: 'choice_unavailable' }] : blockedBy,
        'This choice is permanent for this quest.'));
    }
    return { ...projected, ...(NEIGHBORHOOD_QUEST_VENUES[projected.id]
      ? { venueId: NEIGHBORHOOD_QUEST_VENUES[projected.id], description: definition?.metadata?.lore || '',
        dialogue: definition?.metadata?.description || '' } : {}),
      uiActions: actions, ...(!Object.hasOwn(projected, 'actions') ? { actions } : {}) };
  });
  const objectives = nodes.filter(node => ['mystery_step', 'world_gate', 'choice'].includes(node.type)
    && node.status !== 'excluded');
  const actions = [];
  if (board.explorationAvailable) actions.push({ ...issuedAction('explore', 'Investigate the next lead', base + '/explore'),
    ...(graphId === NEIGHBORHOOD_QUEST_PRESENTATION.graphId ? { venueId: NEIGHBORHOOD_QUEST_PRESENTATION.exploreVenueId } : {}) });
  if (board.status === 'active') actions.push(issuedAction('cancel', 'Abandon this quest', base + '/cancel',
    { instanceId: board.instanceId }, [], 'This closes this quest. Held items return to their original owner.'));
  return { ...board, nodes, uiActions: actions, ...(!Object.hasOwn(board, 'actions') ? { actions } : {}),
    progress: { completed: objectives.filter(node => node.status === 'completed').length,
    total: objectives.length } };
}
export function inventoryUi(board, registry, { assignable = false } = {}) {
  return { stacks: board.stacks.map(stack => ({ ...stack,
    title: registry.nodes.get(stack.templateId)?.metadata?.title || stack.templateId })),
  items: board.items.map(item => {
    const definition = registry.nodes.get(item.templateId);
    return { id: item.id, templateId: item.templateId, state: item.state, escrowed: item.escrowed,
      createdAt: item.createdAt, updatedAt: item.updatedAt,
      title: definition?.metadata?.title || item.templateId,
      description: definition?.metadata?.description || '',
      actions: assignable && definition?.metadata?.characterAssignable === true && item.state === 'active' && !item.escrowed
        ? [issuedAction('assign:' + item.id, 'Carry with this character',
          '/v1/worldgraph/items/' + segment(item.id) + '/assign-current-character', {}, [],
          'Custody moves from your account to this character. Character-held items do not pass to an heir.')] : [] };
  }) };
}
