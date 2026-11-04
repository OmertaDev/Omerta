// A return visit shaped by the actual, character-held ending of the broadcast case.
// These nontransferable keepsakes are awarded only by its mutually exclusive finales.
function frozen(value) {
  if (value && typeof value === 'object') {
    for (const entry of Object.values(value)) frozen(entry);
    Object.freeze(value);
  }
  return value;
}

const graphId = 'neighborhood-afterword';
const node = (branch, step) => `mystery:afterword-${branch}-${step}`;
const proof = branch => branch === 'live' ? 'item:neighborhood_brass_dial' : 'item:neighborhood_first_reel';
const conditions = (branch, step) => [
  { adapter: 'location', value: 'docks' },
  { adapter: 'item_ownership', templateId: proof(branch) },
  { adapter: 'explicit_interaction', interactionId: `${graphId}:${branch}-${step}` },
];
const branches = [
  { id: 'live', invitation: 'The bakery answers your signal',
    invitationText: 'Nico Bellini: You restored the live transmitter, so the bakery now calls when the evening delivery loses its way. They asked for you by name. Ada can help you agree a clear signal before the next delivery. Bring the brass dial; this invitation follows the voices you chose to restore.',
    work: 'Agree the delivery signal with Ada',
    workText: 'Ada Ferri: The neighbors can answer the radio now because of your repair. Help me test three short knocks for the loading door and one long knock for the bakery. The porter answers both correctly. This is a working agreement, not another rumor to repeat.',
    evidence: 'The tested signal connects the bakery, the loading door and the night porter over the restored live transmitter.',
    finale: 'Put the neighbors in touch',
    finaleText: 'Elena Serra: The bakery calls the porter directly and the parcel reaches the right door. Your decision to restore live voices has changed whom Nico calls for help: he now brings you the neighborhood’s practical coordination work. The signed signal agreement stays in your file.',
    remembered: 'The Neighborhood Answers', workVenue: 'workshop',
  },
  { id: 'archive', invitation: 'The porter recognizes the old voice',
    invitationText: 'Nico Bellini: You saved the old recording instead of restoring the transmitter. The night porter recognized a voice behind mine and asked to talk to you privately. Elena can compare his account with the reel. Bring the signed case; he is trusting the person who chose to remember.',
    work: 'Compare the porter’s testimony with Elena',
    workText: 'Elena Serra: The porter recognizes his mother reading the candle addresses, but memory needs a date. Compare his dated shift card with the gap between the two songs. The timing agrees. We can preserve her part in the blackout without inventing a live broadcast that never happened.',
    evidence: 'The porter’s dated shift card identifies his mother as the second voice on the recovered blackout reel.',
    finale: 'Return the identified voice to the porter',
    finaleText: 'Nico Bellini: The porter listens to his mother’s voice with the corrected sleeve in his hands. Your decision to save the recording has changed what he is willing to share: her account now belongs beside the names in the archive. Elena keeps your signed identification with the reel’s history.',
    remembered: 'A Voice Given Its Name', workVenue: 'stories',
  },
];

export const NEIGHBORHOOD_AFTERWORD_PACKAGE = frozen({
  id: graphId, version: 1, season: 'core', dependsOn: ['neighborhood-broadcast'],
  nodes: branches.flatMap(branch => {
    const other = branch.id === 'live' ? 'archive' : 'live';
    const invitation = node(branch.id, 'invitation'), work = node(branch.id, 'work'), finale = node(branch.id, 'finale');
    const evidence = `evidence:afterword-${branch.id}`, status = `reward:afterword-${branch.id}`;
    return [
      { id: invitation, type: 'mystery_step', version: 1, visibility: 'hidden',
        excludes: [node(other, 'invitation')], conditions: conditions(branch.id, 'invitation'),
        metadata: { title: '1/3 — ' + branch.invitation, description: branch.invitationText,
          lore: 'Return to Nico in the Docks after completing The Block’s Last Broadcast. Your actual character-held keepsake determines the invitation.' } },
      { id: work, type: 'mystery_step', version: 1, visibility: 'hidden', requires: [invitation],
        conditions: conditions(branch.id, 'work'), effects: [{ adapter: 'evidence_grant', nodeId: evidence }],
        metadata: { title: '2/3 — ' + branch.work, description: branch.workText,
          lore: 'Follow the invitation you earned. This conversation records new evidence; the other broadcast outcome opens a different follow-up.' } },
      { id: evidence, type: 'evidence', version: 1, visibility: 'discovered', requires: [work],
        metadata: { title: branch.id === 'live' ? 'The Neighborhood Signal Agreement' : 'The Porter’s Dated Account', description: branch.evidence } },
      { id: finale, type: 'mystery_step', version: 1, visibility: 'hidden', requires: [work, evidence],
        conditions: conditions(branch.id, 'finale'), effects: [{ adapter: 'status_award', nodeId: status }],
        metadata: { title: '3/3 — ' + branch.finale, description: branch.finaleText,
          lore: 'Complete the return visit and preserve its conclusion in this character’s history. The case changes no currency, combat stats or item ownership.', terminal: true } },
      { id: status, type: 'reward', version: 1, visibility: 'hidden', requires: [finale],
        metadata: { title: branch.remembered, description: 'A completed return visit caused by this character’s actual broadcast decision.', inert: true, rewardType: 'status' } },
    ];
  }),
});

export const NEIGHBORHOOD_AFTERWORD_PRESENTATION = frozen({ graphId, version: 1, cityQuest: true,
  districtId: 'docks', title: 'What Your Choice Set in Motion',
  description: 'Return to Nico in the Docks after The Block’s Last Broadcast. The keepsake you actually earned opens a different three-stage invitation and new work with the neighborhood.',
  ownerScope: 'character', startVenueId: 'fixer', exploreVenueId: 'fixer',
  rewardTitle: 'A lasting account of the return visit', deathPolicy: 'immutable_history_no_inheritance' });
export const NEIGHBORHOOD_AFTERWORD_VENUES = frozen(Object.fromEntries(branches.flatMap(branch => [
  [node(branch.id, 'invitation'), 'fixer'], [node(branch.id, 'work'), branch.workVenue], [node(branch.id, 'finale'), 'stories'],
])));
export const NEIGHBORHOOD_AFTERWORD_ACTION_LABELS = frozen(Object.fromEntries(branches.flatMap(branch => [
  [node(branch.id, 'invitation'), 'Hear why Nico asked for you'],
  [node(branch.id, 'work'), branch.work], [node(branch.id, 'finale'), branch.finale],
])));
