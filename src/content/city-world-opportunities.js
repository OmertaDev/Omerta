// Immutable cases for the existing mystery runtime. NPC authority is supplied privately by
// the server; these records never nominate an account, resident identity, clock or balance.
function frozen(value) {
  if (value && typeof value === 'object') { for (const entry of Object.values(value)) frozen(entry); Object.freeze(value); }
  return value;
}
const present = () => ({ adapter: 'npc_present' });
const favor = minimum => ({ adapter: 'npc_favor', minimum });
const interaction = value => ({ adapter: 'explicit_interaction', interactionId: value });
const award = () => ({ adapter: 'npc_favor_award', amount: 1 });
const evidence = (id, source, title, description) => ({ id, type: 'evidence', version: 1, visibility: 'discovered',
  requires: [source], metadata: { title, description } });
const status = (id, source, title) => ({ id, type: 'reward', version: 1, visibility: 'hidden', requires: [source],
  metadata: { title, description: 'This completed case is preserved in this character\'s history.', inert: true, rewardType: 'status' } });
function entry(pkg, title, description, venues, actionLabels, { districtId = null, event = false, window = null, secret = false } = {}) {
  return { package: pkg, districtId, event, window, secret, venues, actionLabels,
    presentation: { cityQuest: true, graphId: pkg.id, version: pkg.version, ...(districtId ? { districtId } : {}), title, description,
      ownerScope: 'character', startVenueId: 'fixer', exploreVenueId: 'stories', rewardTitle: 'A stronger neighborhood connection',
      deathPolicy: 'immutable_history_no_inheritance' } };
}

export const CITY_NEIGHBOR_ROUTE_PASS = 'item:city_neighbor_route_pass';
const trustId = 'city-neighbor-favors';
const trust = entry({ id: trustId, version: 1, season: 'core', dependsOn: ['core-materials'], nodes: [
  { id: 'm:city-favors:meet', type: 'mystery_step', version: 1, visibility: 'public',
    conditions: [present(), interaction(trustId + ':meet')],
    metadata: { title: 'Ask about the misplaced note', description: 'A nearby resident has lost a note identifying the right loading door. Offer to compare the surviving account.', lore: 'Meet the resident and follow the note before asking for a private favor.' } },
  { id: 'm:city-favors:return-note', type: 'mystery_step', version: 1, visibility: 'hidden', requires: ['m:city-favors:meet'],
    conditions: [present(), interaction(trustId + ':return-note')], effects: [award(), { adapter: 'evidence_grant', nodeId: 'e:city-favors:note' }],
    metadata: { title: 'Return the corrected loading note', description: 'The crossed-out door number matches the surviving loading notice. Give your neighbor the correction rather than the rumor.', lore: 'The first completed favor makes later private conversation available.' } },
  evidence('e:city-favors:note', 'm:city-favors:return-note', 'Corrected Loading Note', 'A crossed-out door number identifies the loading notice that was copied incorrectly.'),
  { id: 'choice:city-favors:confidence', type: 'choice', version: 1, visibility: 'hidden', requires: ['m:city-favors:return-note', 'e:city-favors:note'],
    conditions: [present(), favor(1), interaction(trustId + ':confidence')], options: [
      { id: 'keep-confidence', title: 'Keep the resident\'s confidence', effects: [award(), { adapter: 'evidence_grant', nodeId: 'e:city-favors:private-account' }],
        excludes: ['m:city-favors:repair-record', 'e:city-favors:public-account', 'e:city-favors:repaired-account'] },
      { id: 'publish-rumor', title: 'Press the case in public (+6 heat)', effects: [{ adapter: 'heat_raise', amount: 6 }, { adapter: 'evidence_grant', nodeId: 'e:city-favors:public-account' }],
        excludes: ['e:city-favors:private-account'] },
    ], metadata: { title: 'Choose what to do with the account', description: 'Your neighbor will share a private detail if you keep the corrected account between you. Publishing an accusation draws attention and leaves a correction to make.', lore: 'This choice persists. Publishing the account raises heat; repair the record to earn the second favor.' } },
  evidence('e:city-favors:private-account', 'choice:city-favors:confidence', 'A Private Account', 'Your neighbor kept a second copy showing who changed the door number.'),
  evidence('e:city-favors:public-account', 'choice:city-favors:confidence', 'The Public Accusation', 'Your accusation is public, but it names the wrong door and needs a signed correction.'),
  { id: 'm:city-favors:repair-record', type: 'mystery_step', version: 1, visibility: 'hidden', requires: ['e:city-favors:public-account'],
    conditions: [present(), favor(1), { adapter: 'heat', maximum: 50 }, interaction(trustId + ':repair-record')],
    effects: [award(), { adapter: 'evidence_grant', nodeId: 'e:city-favors:repaired-account' }],
    metadata: { title: 'Repair the published record', description: 'Bring the crossed-out number and your correction back to the resident. Sign the revision while attention is low enough to hear their account.', lore: 'This earns the second favor after the noisy choice. Heat above 50 keeps this conversation unavailable.' } },
  evidence('e:city-favors:repaired-account', 'm:city-favors:repair-record', 'Signed Public Correction', 'The corrected door number is now part of the public record.'),
  { id: 'm:city-favors:route-pass', type: 'mystery_step', version: 1, visibility: 'hidden', requires: ['choice:city-favors:confidence'],
    requiresAny: [['e:city-favors:private-account', 'e:city-favors:repaired-account']],
    conditions: [present(), favor(2), interaction(trustId + ':route-pass')], effects: [award(), { adapter: 'unique_item_award', templateId: CITY_NEIGHBOR_ROUTE_PASS }, { adapter: 'status_award', nodeId: 'r:city-favors:remembered' }],
    metadata: { title: 'Accept the resident\'s route pass', description: 'Your neighbor now trusts you with the marked pass to a sealed record. It belongs to this character and can be used for the quiet route and the hidden drawer.', lore: 'The third favor unlocks the private record and places the route pass in your inventory.', terminal: true } },
  { id: CITY_NEIGHBOR_ROUTE_PASS, type: 'item_template', version: 1, visibility: 'hidden', metadata: { title: 'Neighbor\'s Route Pass', description: 'A marked pass earned from a real neighborhood contact. It unlocks authored private routes; it has no cash or combat value.', inventoryClass: 'unique', inert: true, tradeable: false, exportEligible: false } },
  status('r:city-favors:remembered', 'm:city-favors:route-pass', 'A Neighbor\'s Confidence'),
] }, 'A Neighbor\'s Confidence', 'Three completed favors earn a resident\'s trust and unlock a route pass and private leads.',
{ 'm:city-favors:meet': 'fixer', 'm:city-favors:return-note': 'workshop', 'choice:city-favors:confidence': 'stories', 'm:city-favors:repair-record': 'stories', 'm:city-favors:route-pass': 'fixer' },
{ 'm:city-favors:meet': 'Hear the resident\'s request', 'm:city-favors:return-note': 'Return the corrected note', 'm:city-favors:repair-record': 'Sign the correction', 'm:city-favors:route-pass': 'Accept the route pass' });

function challenge({ id, title, description, districtId, skillId, trainedTitle, trainedDialogue, quietClue, loudClue, routePass = false }) {
  const intro = 'm:' + id + ':intro', trained = 'm:' + id + ':trained', loud = 'choice:' + id + ':loud';
  const quietEvidence = 'e:' + id + ':quiet', loudEvidence = 'e:' + id + ':loud';
  const quietEnd = 'm:' + id + ':quiet-end', loudEnd = 'm:' + id + ':loud-end';
  const quietReward = 'r:' + id + ':quiet', loudReward = 'r:' + id + ':loud';
  const conditions = localId => [present(), { adapter: 'location', value: districtId }, interaction(id + ':' + localId)];
  return entry({ id, version: 1, season: 'core', dependsOn: ['core-materials', ...(routePass ? [trustId] : [])], nodes: [
    { id: intro, type: 'mystery_step', version: 1, visibility: 'public', conditions: [...conditions('intro'), favor(1)],
      metadata: { title: 'Hear about ' + title.toLowerCase(), description, lore: 'A familiar resident will explain the two approaches. Learned skills and existing favor are checked again when you act.' } },
    { id: trained, type: 'mystery_step', version: 1, visibility: 'public', requires: [intro], excludes: [loud, loudEnd],
      conditions: [...conditions('trained'), favor(2), { adapter: 'skill', skillId }, { adapter: 'heat', maximum: 30 },
        ...(routePass ? [{ adapter: 'item_ownership', templateId: CITY_NEIGHBOR_ROUTE_PASS }] : [])],
      effects: [{ adapter: 'evidence_grant', nodeId: quietEvidence }],
      metadata: { title: trainedTitle, description: trainedDialogue, lore: 'This route uses your learned skill, a trusted resident and heat at most 30. It unlocks a different account without drawing attention.' } },
    { id: loud, type: 'choice', version: 1, visibility: 'public', requires: [intro], excludes: [trained, quietEnd],
      conditions: [...conditions('loud'), favor(1)], options: [{ id: 'make-noise', title: 'Make a public scene (+6 heat)',
        effects: [{ adapter: 'heat_raise', amount: 6 }, { adapter: 'evidence_grant', nodeId: loudEvidence }], excludes: [trained, quietEnd] }],
      metadata: { title: 'Take the noisy approach', description: 'You can press the issue without the learned skill, but the public scene raises heat and permanently closes the quiet account in this case.', lore: 'The public account becomes your lasting conclusion; the resident keeps the private detail.' } },
    evidence(quietEvidence, trained, 'The Quiet Account', quietClue),
    evidence(loudEvidence, loud, 'The Public Account', loudClue),
    { id: quietEnd, type: 'mystery_step', version: 1, visibility: 'hidden', requires: [trained, quietEvidence],
      conditions: [...conditions('quiet-end'), favor(2), { adapter: 'heat', maximum: 30 }], effects: [{ adapter: 'status_award', nodeId: quietReward }],
      metadata: { title: 'Follow the quiet lead', description: 'Your resident shares the private detail supported by the quiet account: ' + quietClue, lore: 'This later private content is available only through the successful trained branch.', terminal: true } },
    { id: loudEnd, type: 'mystery_step', version: 1, visibility: 'hidden', requires: [loud, loudEvidence],
      conditions: conditions('loud-end'), effects: [{ adapter: 'status_award', nodeId: loudReward }],
      metadata: { title: 'Settle the public account', description: 'The public account remains your conclusion: ' + loudClue, lore: 'The noisy outcome stays in this character\'s history; its heat also changes other quiet opportunities.', terminal: true } },
    status(quietReward, quietEnd, title + ': Quiet Account'), status(loudReward, loudEnd, title + ': Public Account'),
  ] }, title, description, { [intro]: 'fixer', [trained]: 'workshop', [loud]: 'stories', [quietEnd]: 'workshop', [loudEnd]: 'stories' },
  { [intro]: 'Hear the two approaches', [trained]: trainedTitle, [quietEnd]: 'Follow the private lead', [loudEnd]: 'Conclude the public account' }, { districtId });
}

const challenges = [
  challenge({ id: 'city-shutter-lock', title: 'The Shutter Lock', districtId: 'foundry', skillId: 'bruiser',
    description: 'A jammed workshop shutter conceals a mismatched lock plate. Brace the mechanism with Bruiser training, or draw the caretaker out with a public scene.',
    trainedTitle: 'Brace the shutter and inspect the plate', trainedDialogue: 'Your Bruiser training lets you hold the seized shutter while the resident compares the lock plate with its mounting marks.',
    quietClue: 'The mounting marks show the lock plate was fitted from inside, before the shutter jammed.', loudClue: 'The caretaker publicly confirms that a replacement lock plate was delivered.' }),
  challenge({ id: 'city-loading-route', title: 'The Quiet Loading Route', districtId: 'docks', skillId: 'pack_mule', routePass: true,
    description: 'The marked route pass points to a loading corridor. Use Pack Mule training and the real pass to carry the record through quietly, or press for the public loading book.',
    trainedTitle: 'Use the marked loading route', trainedDialogue: 'Your Pack Mule training keeps the narrow loading passage clear. Show the resident your route pass and compare the corridor record.',
    quietClue: 'The corridor record identifies the crate moved before the public loading book opened.', loudClue: 'The public loading book records a later crate movement.' }),
  challenge({ id: 'city-careful-negotiation', title: 'The Careful Negotiation', districtId: 'neon', skillId: 'fast_talker',
    description: 'A resident has stopped answering accusations about a repair. Earn the private account through Fast Talker training and low heat, or pursue the public version.',
    trainedTitle: 'Negotiate a private hearing', trainedDialogue: 'Your Fast Talker training gives the resident time to finish the account without another accusation. The dated repair note stays between you.',
    quietClue: 'The dated repair note shows the sign was switched off before the disputed message appeared.', loudClue: 'The resident publicly confirms a safety shutoff but withholds the dated private note.' }),
];

const secretId = 'city-sealed-record';
const secret = entry({ id: secretId, version: 1, season: 'core', dependsOn: ['core-materials', trustId], nodes: [
  { id: 'm:city-sealed-record:drawer', type: 'mystery_step', version: 1, visibility: 'hidden',
    conditions: [present(), favor(3), { adapter: 'heat', maximum: 30 }, { adapter: 'item_ownership', templateId: CITY_NEIGHBOR_ROUTE_PASS }, interaction(secretId + ':drawer')],
    effects: [{ adapter: 'item_consume', templateId: CITY_NEIGHBOR_ROUTE_PASS }, { adapter: 'evidence_grant', nodeId: 'e:city-sealed-record:reverse-stamp' }],
    metadata: { title: 'Open the marked drawer', description: 'The route pass fits the seal on the resident\'s drawer. Surrender the pass and compare the reverse stamp with the public loading note.', lore: 'An allied resident reveals this lead when you bring the pass with heat at most 30.' } },
  evidence('e:city-sealed-record:reverse-stamp', 'm:city-sealed-record:drawer', 'The Reverse Stamp', 'The reverse stamp names a record room omitted from the public account.'),
  { id: 'm:city-sealed-record:room', type: 'mystery_step', version: 1, visibility: 'hidden', requires: ['m:city-sealed-record:drawer', 'e:city-sealed-record:reverse-stamp'],
    conditions: [present(), favor(3), interaction(secretId + ':room')], effects: [{ adapter: 'status_award', nodeId: 'r:city-sealed-record:known' }],
    metadata: { title: 'Follow the reverse stamp', description: 'Your allied resident opens the record room identified by the stamp. The private ledger explains why the public copy lost an entry.', lore: 'The discovered reverse stamp leads to this room and its private account.', terminal: true } },
  status('r:city-sealed-record:known', 'm:city-sealed-record:room', 'Keeper of the Sealed Account'),
] }, 'The Sealed Record', 'An allied resident can reveal a marked drawer and an omitted record room.',
{ 'm:city-sealed-record:drawer': 'workshop', 'm:city-sealed-record:room': 'stories' },
{ 'm:city-sealed-record:drawer': 'Use the route pass', 'm:city-sealed-record:room': 'Enter the private record room' }, { secret: true });

const periodMs = 86400000, openMs = 21600000;
const eventNames = ['The Early Loading Slip', 'The Midday Switch Note', 'The Evening Repair Account', 'The Night Ferry Record'];
const events = eventNames.map((title, phase) => {
  const id = 'city-rotating-account-' + phase, intro = 'm:' + id + ':read', finish = 'm:' + id + ':confirm', clue = 'e:' + id + ':clue', reward = 'r:' + id + ':remembered';
  const window = { adapter: 'recurring_window', periodMs, openMs, offsetMs: phase * openMs };
  const conditions = actionId => [present(), window, interaction(id + ':' + actionId)];
  return entry({ id, version: 1, season: 'core', dependsOn: ['core-materials'], nodes: [
    { id: intro, type: 'mystery_step', version: 1, visibility: 'public', conditions: conditions('read'),
      effects: [{ adapter: 'evidence_grant', nodeId: clue }], metadata: { title: 'Read ' + title.toLowerCase(),
        description: 'This resident shares the account during this part of the day. Compare the record before the next account replaces it.', lore: 'Read and confirm the account before its six-hour window closes.' } },
    evidence(clue, intro, title + ': Detail', 'The dated account fixes the order of a disputed entry during this part of the day.'),
    { id: finish, type: 'mystery_step', version: 1, visibility: 'hidden', requires: [intro, clue], conditions: conditions('confirm'),
      effects: [award(), { adapter: 'status_award', nodeId: reward }], metadata: { title: 'Confirm the resident\'s account',
        description: 'Return the matching detail to this resident before the window closes. Completing it earns one favor and opens later private opportunities.',
        lore: 'This character can complete each timed case once. Its availability rotates; completed records remain history.', terminal: true } },
    status(reward, finish, title + ': Confirmed'),
  ] }, title, 'Confirm a rotating daily account to earn this resident\'s favor.',
  { [intro]: 'stories', [finish]: 'fixer' }, { [intro]: 'Inspect the current account', [finish]: 'Confirm the timed account' }, { event: true, window });
});

export const CITY_WORLD_OPPORTUNITIES = frozen([trust, ...challenges, secret, ...events]);
export const CITY_WORLD_OPPORTUNITY_PACKAGES = Object.freeze(CITY_WORLD_OPPORTUNITIES.map(record => record.package));
