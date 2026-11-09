// A new, independently admitted case. Original introduction/district definitions remain immutable.
function frozen(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value); }
  return value;
}
const graphId = 'first-errand-case-v2';
const id = name => 'mystery:first-errand-' + name;
const receipt = 'evidence:first-errand-receipt', book = 'evidence:first-errand-book';
const note = 'item:first_errand_counterfoil', route = 'evidence:first-errand-route', correction = 'evidence:first-errand-correction';
const intro = id('meet'), slip = id('receipt'), ledger = id('book'), compare = 'choice:first-errand-explanation';
const quiet = id('side-door'), publicDesk = id('public-desk'), finish = id('report');
const interaction = name => [{ adapter: 'explicit_interaction', interactionId: graphId + ':' + name }];
export const FIRST_ERRAND_CASE_PACKAGE = frozen({ id: graphId, version: 2, season: 'core', dependsOn: [], nodes: [
  { id: intro, type: 'mystery_step', version: 2, visibility: 'public', conditions: interaction('meet'),
    metadata: { title: 'Nico has one small errand', description: 'Nico Bellini: Ada is missing a parcel. The courier swears he signed for it. Bring me something better than two people swearing. Ada kept the receipt; the ferryman keeps his own book.', lore: 'Inspect the receipt and the ferry book. Keep both records in your journal.' } },
  { id: slip, type: 'mystery_step', version: 2, visibility: 'discovered', requires: [intro], conditions: interaction('receipt'),
    effects: [{ adapter: 'evidence_grant', nodeId: receipt }],
    metadata: { title: 'Receipt pinned beside Ada’s door', description: 'Ada Ferri: Oil on the edges, but the ink is clean. Read it yourself. I have a motor in pieces and no patience left for guesses.', lore: 'Inspect the paper to copy its dated entry into your journal.' } },
  { id: ledger, type: 'mystery_step', version: 2, visibility: 'discovered', requires: [intro], conditions: interaction('book'),
    effects: [{ adapter: 'evidence_grant', nodeId: book }],
    metadata: { title: 'The ferryman’s loading book', description: 'The ferryman: My boat leaves when the rope comes in. Paper can argue about it later. Here is yesterday’s page; mind the wet corner.', lore: 'Inspect the signed loading record and compare it with Ada’s receipt.' } },
  { id: receipt, type: 'evidence', version: 2, visibility: 'discovered', requires: [slip],
    metadata: { title: 'Ada’s receipt · 14 October', description: 'Parcel 47. Departure: 15 October, 18:10. Handed over: 14 October, 17:55. Signed: L. Valli. Blue counterfoil: side-door records.' } },
  { id: book, type: 'evidence', version: 2, visibility: 'discovered', requires: [ledger],
    metadata: { title: 'Loading book · 14 October', description: 'Ferry departed 14 October, 18:10. Parcel 47 accepted at 17:55. Signed: L. Valli. Tomorrow’s departure column remains blank.' } },
  { id: compare, type: 'choice', version: 2, visibility: 'discovered', requires: [receipt, book], conditions: interaction('compare'),
    options: [
      { id: 'copied-date', title: 'The receipt copied the wrong departure date', excludes: [publicDesk], effects: [
        { adapter: 'discover', nodeId: quiet }, { adapter: 'unique_item_award', templateId: note }] },
      { id: 'missed-boat', title: 'The courier missed the boat; ask the public desk', excludes: [quiet], effects: [{ adapter: 'discover', nodeId: publicDesk }] },
    ], metadata: { title: 'Put the two records side by side', description: 'Elena Serra: Same parcel, same signature. Look at the dates before I lend your words a printing press. Which explanation will you put your name to?', lore: 'This explanation stays in your case record. Compare the acquired evidence before choosing.' } },
  { id: quiet, type: 'mystery_step', version: 2, visibility: 'discovered', requires: [compare], excludes: [publicDesk],
    conditions: [...interaction('side-door'), { adapter: 'item_ownership', templateId: note }],
    effects: [{ adapter: 'evidence_grant', nodeId: route }],
    metadata: { title: 'Show the counterfoil at the side door', description: 'Ada Ferri: You spotted the date. Take my blue counterfoil to the side door. The clerk there keeps the correction copies; he will know which shelf holds our parcel.', lore: 'The counterfoil earned from comparing the records admits this quiet follow-up. It is kept, not spent.' } },
  { id: publicDesk, type: 'mystery_step', version: 2, visibility: 'discovered', requires: [compare], excludes: [quiet],
    conditions: interaction('public-desk'), effects: [{ adapter: 'evidence_grant', nodeId: correction }],
    metadata: { title: 'Hear the clerk’s correction', description: 'The ferryman: Valli was aboard. I watched him pull the rope. The date on Ada’s paper belongs to tomorrow. The parcel is on the correction shelf; bring the complete account back to Elena.', lore: 'The public clerk supplies the correction. Your original explanation remains recorded.' } },
  { id: route, type: 'evidence', version: 2, visibility: 'discovered', requires: [quiet],
    metadata: { title: 'Correction shelf · the parcel is safe', description: 'The clerk located Parcel 47 on the correction shelf. The signed loading book matches the handover, not the mistaken departure date.' } },
  { id: correction, type: 'evidence', version: 2, visibility: 'discovered', requires: [publicDesk],
    metadata: { title: 'The public correction', description: 'Valli was aboard. The departure date on Ada’s paper belongs to the following day; Parcel 47 is on the correction shelf.' } },
  { id: finish, type: 'mystery_step', version: 2, visibility: 'discovered', requires: [compare],
    requiresAny: [[quiet, publicDesk], [route, correction]], conditions: interaction('report'), effects: [{ adapter: 'status_award', nodeId: 'reward:first-errand-remembered' }],
    metadata: { title: 'Give Elena the complete account', description: 'Elena Serra: A parcel found, a signature left intact. That is a useful morning’s work. Nico has paying work when you are ready. Read his terms first; a promise of money is not money in your hand.', lore: 'Your signed account remains in this life’s journal. The Fixer offers existing paid jobs; their risks and actual rewards remain separate.', terminal: true } },
  { id: note, type: 'item_template', version: 2, visibility: 'hidden', metadata: { title: 'Blue Correction Counterfoil',
    description: 'Ada’s signed counterfoil. It opens the side-door record in your first errand; it grants no money or combat benefit.', inventoryClass: 'unique', inert: true, tradeable: false, exportEligible: false } },
  { id: 'reward:first-errand-remembered', type: 'reward', version: 2, visibility: 'hidden', requires: [finish],
    metadata: { title: 'A Signature Worth Keeping', description: 'Nico, Ada and Elena remember your completed correction.', inert: true, rewardType: 'status' } },
] });
export const FIRST_ERRAND_CASE = frozen({ package: FIRST_ERRAND_CASE_PACKAGE,
  presentation: { cityQuest: true, graphId, version: 2, title: 'Parcel 47',
    description: 'One missing parcel. Two signed records. Meet Nico, inspect the evidence and decide what happened.',
    ownerScope: 'character', startVenueId: 'fixer', exploreVenueId: 'stories', rewardTitle: 'A Signature Worth Keeping', deathPolicy: 'immutable_history_no_inheritance' },
  venues: { [intro]: 'fixer', [slip]: 'workshop', [ledger]: 'waterfront', [compare]: 'stories', [quiet]: 'workshop', [publicDesk]: 'waterfront', [finish]: 'stories' },
  actionLabels: { [intro]: 'Hear Nico’s errand', [slip]: 'Inspect the pinned receipt', [ledger]: 'Inspect the loading book',
    [quiet]: 'Show the blue counterfoil', [publicDesk]: 'Ask the public clerk', [finish]: 'Sign the corrected account' },
});
