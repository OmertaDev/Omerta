// Presentation reads reuse the authorized mystery projection. No item, reward or action authority.
import * as G from './game.js';
import { mysteryUi } from './worldgraph-ui.js';
import { PHASE1_WORLD_GRAPH, mysteryDiscovery } from './routes/worldgraph.js';
import { createMysteryContext, mysteryBoard } from './mysteries.js';

const CASES = {
  'neighborhood-initiation': { mode: 'solo', length: 'short', label: 'A short introduction', nonexpiring: true,
    trail: [{ place: 'fixer', title: 'Meet the neighborhood fixer' }, { place: 'workshop', title: 'Follow the workshop account' }, { place: 'stories', title: 'Return with an account you can support' }] },
  'property-investigation': { mode: 'solo', length: 'extended', label: 'A multi-district inquiry', nonexpiring: true,
    trail: [{ place: 'stories', title: 'Begin with the registry in the Docks' }, { place: 'fixer', title: 'Follow the occupancy trail in Neon Mile' }, { place: 'workshop', title: 'Compare the survey at the Foundry' }, { place: 'stories', title: 'Return to the Docks with the file' }] },
  'belladonna-demo': { mode: 'solo', length: 'extended', label: 'An investigation that can lead to a separate Crew operation', nonexpiring: true },
};
// Hints are server-only and delivered one rung at a time for an already visible node.
const AUTHORED = {
  'mystery:neighborhood-fixer': { speaker: 'Nico Bellini', expression: 'measured', lore: 'Nico asks for a supported account before he offers trust.', hints: ['Read Nico’s introduction before choosing an approach.', 'His introduction names Ada’s workshop and Elena’s newsroom.', 'Use the available conversation action to accept Nico’s introduction, then choose your approach.'] },
  'mystery:neighborhood-listen': { speaker: 'Ada Ferri', expression: 'attentive', document: 'receipt', detail: 'Compare the receipt with the stopped minute hand.', hints: ['Compare a physical record with what people remember.', 'Ada names the clock and the receipt pinned beside it.', 'Inspect the clock and receipt using this step’s action; the shared clock is not a reliable delivery time.'] },
  'mystery:neighborhood-ask': { speaker: 'Ada Ferri', expression: 'candid', document: 'ledger', detail: 'The crossed-out address is the detail Ada asks you to inspect.', hints: ['Ask what changed before assigning blame.', 'Ada’s delivery book still uses an old entrance.', 'Inspect the crossed-out delivery address using this step’s action.'] },
  'evidence:neighborhood-timing': { document: 'receipt', detail: 'The receipt predates the ferry horn. The clock’s hand is stuck.', lore: 'A shared clock can make a whole room repeat the same mistake.' },
  'evidence:neighborhood-route': { document: 'ledger', detail: 'The delivery book points to the old workshop entrance.', lore: 'A correction can explain a missing parcel without inventing a culprit.' },
  'mystery:neighborhood-newsroom': { speaker: 'Elena Serra', expression: 'considering', hints: ['Keep the observation separate from the accusation.', 'Elena asks you to put Ada’s account beside your evidence.', 'Review the workshop evidence you actually found, then sign the correction with this step’s action.'] },
  'mystery:property-briefing': { speaker: 'Irene Bell', expression: 'precise', lore: 'An empty house, an address and a lawful boundary are different questions.' },
  'mystery:property-ledger': { document: 'ledger', detail: 'Read the numbered entry together with its dated correction slip.', hints: ['Read the correction as carefully as the main entry.', 'The old occupancy entry and current address use different house numbers.', 'Copy both references from the registry and correction slip through this inspection’s action.'] },
  'evidence:property-ledger': { document: 'ledger', detail: 'The dated correction links the former house number to the current address.' },
  'mystery:property-witness': { speaker: 'Mara Voss', expression: 'recollecting', hints: ['Test the witness’s chronology against your records.', 'Mara dates the departure against the fire and renumbering.', 'Compare the old number in her account with your dated correction before completing the interview.'] },
  'mystery:property-records': { document: 'ledger', detail: 'Distinguish the former number from the forwarding address.', hints: ['A destination can change without the parcel changing.', 'Separate the forwarding address from the old house number.', 'Compare the last signed delivery against the registry correction, then record when deliveries stopped.'] },
  'mystery:property-address': { document: 'notice', detail: 'Compare the surviving plate and the municipal renumbering notice.', hints: ['Use the physical plate as a check on the paperwork.', 'Your occupancy evidence and correction refer to one property.', 'Match the plate and municipal notice to the occupancy evidence, then use the available verification action.'] },
  'evidence:property-address': { document: 'notice', detail: 'The correction, occupancy source and plate agree on one address.' },
  'mystery:property-survey': { speaker: 'Enzo Ferri', expression: 'methodical', document: 'survey', detail: 'Read the parcel reference, shared wall and public alley easement together.', hints: ['A doorway is not the whole boundary.', 'Enzo names the alley easement and shared wall marker.', 'Copy those markers from the signed survey, matching its parcel reference to your address record.'] },
  'evidence:property-survey': { document: 'survey', detail: 'The shared wall marks the private boundary; the alley preserves public access.' },
  'mystery:property-boundary': { speaker: 'Enzo Ferri', expression: 'resolute', document: 'survey', detail: 'The maintenance sketch must be checked against the signed plan.', hints: ['Compare the authority of the two drawings.', 'The maintenance note calls a public alley part of a yard.', 'Use the signed survey to identify the public easement and explain why the private boundary stops at the wall.'] },
  'mystery:property-reconcile': { speaker: 'Irene Bell', expression: 'precise', hints: ['Trace one parcel across the records.', 'Use the ledger, occupancy source, address, survey and boundary finding together.', 'Lay out the completed records and reconcile their dates through the available action.'] },
  'mystery:property-verify-title': { speaker: 'Irene Bell', expression: 'satisfied', hints: ['Confirm the whole file, including its limitation.', 'Read back the verified address, occupancy source and public easement.', 'Explicitly confirm this step only after the prerequisite records are complete; verification does not reserve or issue a deed.'] },
};
const visible = board => new Map((board.nodes || []).map(node => [node.id, node]));
export function investigationPresentation(board, registry = PHASE1_WORLD_GRAPH) {
  board = mysteryUi(board, registry);
  const known = visible(board), graphId = board.graph.id;
  const nodes = (board.nodes || []).map(node => {
    const definition = registry.nodes.get(node.id), authored = AUTHORED[node.id] || {};
    const evidence = [...(definition?.requires || []), ...(definition?.requiresAny || []).flat()]
      .filter(id => known.get(id)?.type === 'evidence' && known.get(id)?.status === 'completed');
    return { id: node.id, speaker: authored.speaker, expression: authored.expression,
      document: authored.document, detail: authored.detail, lore: authored.lore, hintCount: authored.hints?.length || 0,
      evidence, uses: (definition?.conditions || []).filter(c => c.adapter === 'item_ownership').map(c => c.templateId),
      consumes: (definition?.effects || []).filter(e => e.adapter === 'item_consume').map(e => e.templateId),
      commits: (definition?.effects || []).filter(e => e.adapter === 'item_escrow').map(e => e.templateId),
      prerequisites: [...(definition?.requires || []), ...(definition?.requiresAny || []).flat()].filter(id => known.has(id)),
    };
  });
  const terminal = (board.nodes || []).filter(node => node.status === 'completed' && registry.nodes.get(node.id)?.metadata?.terminal);
  const evidence = (board.nodes || []).filter(node => node.type === 'evidence' && node.status === 'completed');
  return { graphId, instanceId: board.instanceId, status: board.status, visibleState: (board.nodes || []).map(node => `${node.id}:${node.status}`).join('|'), experience: CASES[graphId] || null, nodes,
    ...(board.status === 'completed' ? { explanation: { evidence: evidence.map(node => ({ id: node.id, title: node.title, text: node.dialogue || node.description })),
      conclusions: terminal.map(node => ({ id: node.id, title: node.title, text: node.dialogue || node.description || 'The recorded prerequisite evidence enabled this final step.' })) } } : {}) };
}
export function authoredHint(board, nodeId, level) {
  if (!visible(board).has(nodeId) || !Number.isInteger(level) || level < 1 || level > 3) return null;
  const hint = AUTHORED[nodeId]?.hints?.[level - 1];
  return hint ? { nodeId, level, label: ['Nudge', 'Clue reference', 'Explicit guidance'][level - 1], text: hint } : null;
}
const unavailable = () => Object.assign(new Error('That investigation detail is unavailable.'), { statusCode: 404, code: 'investigation_unavailable' });
export async function authorizedBoard(client, accountId, characterId, graphId) {
  try { return await mysteryBoard(client, createMysteryContext({ registry: PHASE1_WORLD_GRAPH, accountId }), { scope: 'character', id: characterId }, graphId); }
  catch (error) { if (/^(mystery_|bad_mystery|owner_|unknown_)/.test(error.code || '')) throw unavailable(); throw error; }
}
export function register(app, { pool, auth }) {
  const read = async (accountId, fn) => (await G.readCharacter(pool, accountId, async (ch, client) => ({ projection: await fn(ch, client) }))).projection;
  app.get('/v1/ux/investigations', { preHandler: auth }, req => read(req.user.sub, async (ch, client) => ({
    cases: (await mysteryDiscovery(client, req.user.sub, ch.id)).map(entry => ({ ...entry, experience: CASES[entry.graphId] || null })),
  })));
  app.get('/v1/ux/investigations/:graphId', { preHandler: auth }, req => read(req.user.sub, async (ch, client) =>
    investigationPresentation(await authorizedBoard(client, req.user.sub, ch.id, req.params.graphId))));
  app.get('/v1/ux/investigations/:graphId/nodes/:nodeId/hints/:level', { preHandler: auth }, req => read(req.user.sub, async (ch, client) => {
    const board = await authorizedBoard(client, req.user.sub, ch.id, req.params.graphId);
    const hint = authoredHint(board, req.params.nodeId, Number(req.params.level));
    if (!hint) throw unavailable(); return hint;
  }));
  app.get('/v1/ux/investigation-items', { preHandler: auth }, req => read(req.user.sub, async (ch, client) => {
    const owners = (await client.query('SELECT id FROM characters WHERE account_id=$1', [req.user.sub])).rows.map(row => row.id);
    const held = [], deposits = [];
    for (const owner of [{ scope: 'account', id: req.user.sub }, ...owners.map(id => ({ scope: 'character', id }))]) {
      held.push(...(await client.query("SELECT id,template_id,owner_scope,owner_id,state FROM item_instances WHERE owner_scope=$1 AND owner_id=$2 AND state<>'consumed' AND definition_hash IS NULL", [owner.scope, owner.id])).rows);
      deposits.push(...(await client.query('SELECT operation_id,item_id,depositor_scope,depositor_id FROM operation_escrow WHERE depositor_scope=$1 AND depositor_id=$2', [owner.scope, owner.id])).rows);
    }
    const items = [];
    for (const item of held) {
      const origin = (await client.query("SELECT provenance_kind FROM item_events WHERE item_id=$1 AND event_kind='created'", [item.id])).rows[0];
      items.push({ id: item.id, title: PHASE1_WORLD_GRAPH.nodes.get(item.template_id)?.metadata?.title || item.template_id,
        templateId: item.template_id, origin: origin?.provenance_kind || 'No creation record available', state: item.state });
    }
    for (const deposit of deposits) {
      const item = (await client.query('SELECT template_id FROM item_instances WHERE id=$1', [deposit.item_id])).rows[0];
      const operation = (await client.query('SELECT graph_id,operation_node_id FROM world_operations WHERE id=$1', [deposit.operation_id])).rows[0];
      const mystery = !operation && (await client.query('SELECT graph_id FROM mystery_instances WHERE id=$1', [deposit.operation_id])).rows[0];
      const origin = (await client.query("SELECT provenance_kind FROM item_events WHERE item_id=$1 AND event_kind='created'", [deposit.item_id])).rows[0];
      items.push({ id: deposit.item_id, templateId: item?.template_id, title: PHASE1_WORLD_GRAPH.nodes.get(item?.template_id)?.metadata?.title || 'Committed item',
        origin: origin?.provenance_kind || 'No creation record available',
        state: 'escrowed', operationId: deposit.operation_id, graphId: operation?.graph_id || mystery?.graph_id,
        kind: operation ? 'operation' : 'mystery', titleOfWork: operation ? PHASE1_WORLD_GRAPH.nodes.get(operation.operation_node_id)?.metadata?.title || 'Crew operation' : 'Investigation',
        returnConditions: (operation ? 'Completion, authorized cancellation, or recorded abandonment after a participant dies or changes Crew releases this item to its recorded depositor. '
          : 'Terminal case completion or authorized cancellation releases this item to its recorded depositor. ')
          + 'Character deposits return to that exact character, including a previous life; they do not become an heir’s property.' });
    }
    return { items };
  }));
}
