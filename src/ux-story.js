// Optional authored reading, derived only from the player's authorized mystery boards.
import * as G from './game.js';
import { cityHourOf } from './rules.js';
import { PHASE1_WORLD_GRAPH, mysteryDiscovery } from './routes/worldgraph.js';
import { mysteryUi } from './worldgraph-ui.js';
import { authorizedBoard, investigationPresentation } from './ux-investigation.js';
import { NEIGHBORHOOD_AFTERWORD_PACKAGE } from './content/neighborhood-afterword.js';

const RESIDENTS = {
  'Nico Bellini': { role: 'Neighborhood fixer', place: 'The Fixer', scene: 'Nico closes a pocket notebook before he speaks. The empty chair across his desk is an invitation to listen, not a promise of work.', expression: 'measured' },
  'Ada Ferri': { role: 'Workshop mechanic', place: 'The Workshop', scene: 'Ada clears a place on the workbench between a delivery book and a tray of tools. She waits for a question about what happened, rather than who to blame.', expression: 'attentive' },
  'Elena Serra': { role: 'Newsroom editor', place: 'The Newsroom', scene: 'Elena sets a clean sheet beside the correction file. A sentence can travel farther than its evidence; she wants the two to leave together.', expression: 'considering' },
  'Irene Bell': { role: 'Registry clerk', place: 'Docks registry', scene: 'Irene squares a stack of registry folders against the counter. The address on a cover is a beginning; she opens the file before she offers an answer.', expression: 'precise' },
  'Mara Voss': { role: 'Neighborhood witness', place: 'Neon Mile', scene: 'Mara pauses at the mention of the old number. She tells her account slowly enough for a listener to separate memory from assumption.', expression: 'recollecting' },
  'Enzo Ferri': { role: 'Surveyor', place: 'Foundry survey desk', scene: 'Enzo keeps a ruler along the edge of the signed plan. He follows the line to the shared wall and lets the drawing do the arguing.', expression: 'methodical' },
};
const OPENINGS = {
  'neighborhood-initiation': { title: 'Before the first correction', text: 'A name reaches the neighborhood before its owner learns every door. At Bellini’s desk, a notebook is closed and a chair is left open. There is time to hear an account before repeating it.' },
  'property-investigation': { title: 'An address on an old cover', text: 'The registry smells of paper warmed by a desk lamp. A number has been crossed out, but the old ink remains legible. Irene opens the folder to the first page.' },
  'belladonna-demo': { title: 'A mark in the metal', text: 'In the Foundry, a stamp survives the wear around it. Looking closely is the first job. Whatever the mark will mean, the file starts with what can actually be seen.' },
  'neighborhood-afterword': { title: 'The next time they ask for you', text: 'The room has quieted since the broadcast, but your decision has not stopped working. Nico has another reason to leave the chair open. Bring the keepsake you earned and hear what your choice set in motion.' },
};
const VARIANTS = {
  ...Object.fromEntries(NEIGHBORHOOD_AFTERWORD_PACKAGE.nodes.filter(node => node.type === 'mystery_step').map(node => {
    const [, speaker, text] = node.metadata.description.match(/^([^:]+): (.+)$/s);
    return [node.id, { speaker, text }];
  })),
  'mystery:neighborhood-fixer': { speaker: 'Nico Bellini', text: 'Nico rests two fingers on the closed notebook. “Ada has a delivery that never arrived. Hear her at the workshop. Then bring Elena at the newsroom an account she can put her name behind.”' },
  'choice:neighborhood-approach': { speaker: 'Nico Bellini', text: '“A room leaves things unsaid,” Nico says. “A direct question can open another door. Tell me whether you mean to listen first or ask Ada what she needs.”' },
  'mystery:neighborhood-listen': { speaker: 'Ada Ferri', text: 'Ada holds her hand away from the clock face. “Listen for the ferry horn. That hand stops with it. Everyone read the same clock. Now put its stuck hand beside the receipt.”' },
  'mystery:neighborhood-ask': { speaker: 'Ada Ferri', text: 'Ada turns the delivery book toward you. “We moved the entrance last winter. The courier followed the old address. Read the crossed-out line before you accuse anyone.”' },
  'mystery:neighborhood-newsroom': { speaker: 'Elena Serra', text: 'Elena lays an unmarked page beside the file. “Ada’s account on one side. Your evidence on the other. We can print a correction without printing a feud. Tell me what you found, then sign it.”' },
  'mystery:property-briefing': { speaker: 'Irene Bell', text: 'Irene keeps the file open beneath her palm. “An empty house is not an ownerless house. Begin with the Docks ledger, follow the occupancy trail through Neon Mile, and compare the survey at the Foundry. Bring back evidence, not an empty-window theory.”' },
  'mystery:property-witness': { speaker: 'Mara Voss', text: 'Mara takes a moment over the dates. “After the fire. Before the new number went up. That is when I remember the tenant leaving.” Her account still needs to be checked against the dated correction.' },
  'mystery:property-survey': { speaker: 'Enzo Ferri', text: 'Enzo unfolds the signed plan and keeps one finger on the parcel reference. “The alley is an easement. The wall is shared. A painted doorway cannot replace either line.”' },
  'mystery:property-verify-title': { speaker: 'Irene Bell', text: '“Read the address back to me,” Irene says. “Name the occupancy source. Acknowledge the alley easement. A verified file qualifies you for a separate primary claim; it does not reserve a building or issue its deed.”' },
};
const complete = (board, id) => board.nodes?.some(node => node.id === id && node.status === 'completed');
const choiceOf = (board, id) => board.choices?.find(choice => choice.nodeId === id)?.choiceId;
export function storyClock(now = Date.now()) {
  const hour = cityHourOf(now).hour;
  return { serverTime: new Date(now).toISOString(), hour, lighting: hour < 5 ? 'night' : hour < 8 ? 'dawn' : hour < 18 ? 'day' : hour < 21 ? 'dusk' : 'night' };
}
export function caseStory(rawBoard) {
  const board = mysteryUi(rawBoard, PHASE1_WORLD_GRAPH), graphId = board.graph.id;
  const presentation = investigationPresentation(rawBoard), byId = new Map(presentation.nodes.map(node => [node.id, node]));
  const cast = [];
  for (const node of board.nodes) {
    const speaker = byId.get(node.id)?.speaker || VARIANTS[node.id]?.speaker;
    if (!speaker || !RESIDENTS[speaker]) continue;
    const found = cast.find(person => person.name === speaker), entry = { nodeId: node.id, title: node.title, status: node.status };
    if (found) found.references.push(entry);
    else cast.push({ name: speaker, resident: true, ...RESIDENTS[speaker], references: [entry] });
  }
  const documents = board.nodes.filter(node => node.type === 'evidence' && ['discovered', 'completed'].includes(node.status)).map(node => ({
    id: node.id, title: node.title, text: node.dialogue || node.description || '', form: byId.get(node.id)?.document || 'letter', graphId,
  })).filter(document => document.text);
  const variants = board.nodes.filter(node => VARIANTS[node.id]).map(node => ({ nodeId: node.id, ...VARIANTS[node.id],
    expression: RESIDENTS[VARIANTS[node.id].speaker]?.expression,
    actionTerms: (node.uiActions || node.actions || []).map(action => ({ label: action.label, available: action.available, consequence: action.consequence || 'Review the issued step and its listed requirements before acting.' })),
  }));
  let epilogue = null, letters = [];
  if (board.status === 'completed' && graphId === 'neighborhood-initiation' && complete(board, 'mystery:neighborhood-newsroom')) {
    const branch = choiceOf(board, 'choice:neighborhood-approach');
    if (branch === 'listen' && complete(board, 'evidence:neighborhood-timing')) epilogue = { branch, title: 'A correction beside a stopped clock', text: 'You listened first and brought back the timing evidence. Elena’s correction sets the receipt beside the unreliable clock. In the finished file, an apparent late delivery is explained by the stuck hand rather than turned into an accusation.' };
    if (branch === 'ask' && complete(board, 'evidence:neighborhood-route')) epilogue = { branch, title: 'The right address for the account', text: 'You asked Ada directly and followed the delivery-book evidence. Elena’s correction records the old workshop entrance. In the finished file, a parcel sent to the wrong door becomes a correction to the record rather than a feud with the courier.' };
    if (epilogue) letters = [{ id: `elena:${board.instanceId}`, from: 'Elena Serra', subject: 'A note with the filed correction', text: branch === 'listen'
      ? 'You put the receipt beside the clock before you put a name beside the blame. I have filed the correction with that distinction intact. Keep your notebook. — Elena'
      : 'You asked Ada what changed, then checked the address in the book. The correction keeps that ordinary mistake from becoming an extraordinary accusation. Keep your notebook. — Elena' }];
  }
  if (board.status === 'completed' && graphId === 'property-investigation' && complete(board, 'mystery:property-verify-title')) {
    const branch = choiceOf(board, 'choice:property-approach'), proof = branch === 'witness' ? 'evidence:property-witness' : branch === 'records' ? 'evidence:property-records' : null;
    if (proof && complete(board, proof) && complete(board, 'evidence:property-boundary')) {
      epilogue = { branch, title: branch === 'witness' ? 'A remembered departure, checked' : 'A signed delivery, checked', text: `${branch === 'witness' ? 'Mara’s dated account' : 'The final signed delivery'} joins the corrected registry, address reference and survey in your verified file. The old and new numbers describe one parcel. The alley remains a public easement. Verification records that finding; a building claim remains a separate action.` };
      letters = [{ id: `irene:${board.instanceId}`, from: 'Irene Bell', subject: 'Your registry file is complete', text: `The ${branch === 'witness' ? 'witness account' : 'delivery record'} has been reconciled with the address and signed plan. The public alley has not become a private yard by repetition. Your verified dossier is filed. Any property claim must still be made separately. — Irene` }];
    }
  }
  if (board.status === 'completed' && graphId === 'neighborhood-afterword') {
    for (const branch of ['live', 'archive']) {
      if (![...['invitation', 'work', 'finale'].map(step => `mystery:afterword-${branch}-${step}`),
        `evidence:afterword-${branch}`, `reward:afterword-${branch}`].every(id => complete(board, id))) continue;
      const finale = NEIGHBORHOOD_AFTERWORD_PACKAGE.nodes.find(node => node.id === `mystery:afterword-${branch}-finale`);
      epilogue = { branch, title: branch === 'live' ? 'The neighborhood knows whom to call' : 'The archive remembers another name',
        text: finale.metadata.description };
      letters = [{ id: `afterword:${board.instanceId}`, from: branch === 'live' ? 'Ada Ferri' : 'Elena Serra',
        subject: branch === 'live' ? 'The next delivery found its door' : 'The corrected sleeve is filed',
        text: branch === 'live' ? 'The bakery and the porter are using the signal you tested. Restoring the transmitter made this work possible. I have left your signed agreement beside the dial. — Ada'
          : 'The porter’s mother has her name back in the archive. Keeping the reel made his account possible. The corrected sleeve is filed with your signed identification. — Elena' }];
    }
  }
  return { graphId, instanceId: board.instanceId, status: board.status,
    caseState: JSON.stringify([board.status, board.nodes.map(node => [node.id, node.status, node.available, node.blockedBy || [], node.uiActions || node.actions || []]), board.choices || []]),
    visibleState: board.nodes.map(node => `${node.id}:${node.status}`).join('|'), opening: OPENINGS[graphId] || null, cast, documents, variants, epilogue, letters };
}
export function storyCrossover(stories) {
  const neighborhood = stories.find(story => story.graphId === 'neighborhood-initiation' && story.epilogue && story.status === 'completed');
  const property = stories.find(story => story.graphId === 'property-investigation' && story.epilogue && story.status === 'completed');
  if (!neighborhood || !property) return null;
  return { id: 'a-correction-and-a-boundary', title: 'Two files on one newsroom table', residents: ['Elena Serra', 'Irene Bell'],
    prerequisites: [neighborhood.instanceId, property.instanceId],
    text: `Elena sets the delivery correction beside Irene’s registry file. “A ${neighborhood.epilogue.branch === 'listen' ? 'clock' : 'door'} can send a whole room in the wrong direction,” she says. Irene taps the survey copy. “So can a number. That is why the correction stays with the record.” The two finished files remain distinct: one corrected an account, the other verified an address and its boundary. Neither needs an invented culprit.` };
}
export function register(app, { pool, auth }) {
  const read = async (accountId, action) => (await G.readCharacter(pool, accountId, async (ch, client) => ({ projection: await action(ch, client) }))).projection;
  app.get('/v1/ux/story', { preHandler: auth }, req => read(req.user.sub, async (ch, client) => {
    const entries = await mysteryDiscovery(client, req.user.sub, ch.id), stories = [];
    for (const entry of entries.filter(entry => entry.started)) stories.push(caseStory(await authorizedBoard(client, req.user.sub, ch.id, entry.graphId)));
    const cast = [...new Map(stories.flatMap(story => story.cast).map(person => [person.name, person])).values()];
    return { clock: storyClock(), cast, cases: stories.map(story => ({ graphId: story.graphId, instanceId: story.instanceId, status: story.status, epilogue: story.epilogue, letters: story.letters })), crossover: storyCrossover(stories) };
  }));
  app.get('/v1/ux/story/:graphId', { preHandler: auth }, req => read(req.user.sub, async (ch, client) => ({ clock: storyClock(), ...caseStory(await authorizedBoard(client, req.user.sub, ch.id, req.params.graphId)) })));
}
