// Short district cases interpreted by the existing mystery runtime. Every visit is an
// explicit interaction in the server's current district; the keepsakes are inert.
function frozen(value) {
  if (value && typeof value === 'object') {
    for (const entry of Object.values(value)) frozen(entry);
    Object.freeze(value);
  }
  return value;
}

const stories = [
  {
    districtId: 'docks', title: 'The Last Ferry Receipt', skillId: 'pack_mule', skillName: 'Pack Mule',
    description: 'A parcel missed the last ferry. Find the mistake before the dock hands blame one another.',
    introduction: 'Nico Bellini: The dock hands say a courier abandoned a parcel. Ada has the loading slip, and the waterfront clerk has the ferry book. Check one account carefully before Elena prints a name.',
    specialistTitle: 'Work through the loading order', specialistVenue: 'workshop',
    specialistDialogue: 'Ada Ferri: Your Pack Mule experience helps you read how the load was arranged. The parcel was packed behind a crate marked for the morning ferry. Inspect the loading slip and show me the misplaced mark.',
    specialistEvidence: 'The loading slip puts the parcel with the morning freight, not the last ferry.',
    witnessTitle: 'Compare the ferry book', witnessVenue: 'waterfront',
    witnessDialogue: 'The waterfront clerk opens the ferry book. The courier signed at the right door, but the desk copied tomorrow\'s departure time onto the receipt. Compare the signatures and the two dates.',
    witnessEvidence: 'The signed ferry book proves the receipt carried tomorrow\'s departure time.',
    conclusion: 'Elena Serra: A loading mistake or a copied date tells us where the parcel went. Your signed correction keeps an ordinary delay from becoming a feud. Take this ferry token to remember the case.',
    keepsake: 'Stamped Ferry Token', keepsakeDescription: 'A cancelled ferry token clipped to your signed correction. An inert keepsake of the Docks case.',
  },
  {
    districtId: 'neon', title: 'The Broken Marquee', skillId: 'fast_talker', skillName: 'Fast Talker',
    description: 'A club\'s dark marquee has started a rumor. Find what happened before the crowd turns on its caretaker.',
    introduction: 'Nico Bellini: A marquee went dark during a packed show. Someone says the caretaker cut the lights on purpose. Ask her about the repair, or compare the switch labels with Ada.',
    specialistTitle: 'Hear the caretaker out', specialistVenue: 'stories',
    specialistDialogue: 'The caretaker has stopped answering accusations. Your Fast Talker training gets her to explain the sequence: she switched off a sparking sign after the show began. Compare her account with the dated repair note.',
    specialistEvidence: 'The caretaker\'s repair note records a sparking sign and a safety shutoff.',
    witnessTitle: 'Inspect the switch labels', witnessVenue: 'workshop',
    witnessDialogue: 'Ada Ferri: The replacement switch panel was labelled backwards. Trace the two labels against the repair drawing. One controls the sign, the other the empty side room.',
    witnessEvidence: 'The repair drawing shows the replacement switch labels were reversed.',
    conclusion: 'Elena Serra: We can describe a repair without making the caretaker a villain. Your correction gives the crowd something firmer than a rumor. Keep this unlit marquee bulb as a reminder.',
    keepsake: 'Unlit Marquee Bulb', keepsakeDescription: 'An old display bulb with the corrected switch drawing wrapped around it. An inert keepsake of the Neon case.',
  },
  {
    districtId: 'foundry', title: 'The False Shift Bell', skillId: 'bruiser', skillName: 'Bruiser',
    description: 'Two shift crews heard different bells. Settle the record without handing either crew the blame.',
    introduction: 'Nico Bellini: The Foundry\'s morning crew says the night crew left early. The bell rope and the shift book disagree. Help Ada inspect the rope, or take the signed book to the newsroom.',
    specialistTitle: 'Inspect the bell rigging', specialistVenue: 'workshop',
    specialistDialogue: 'Ada Ferri: Your Bruiser training gives you the strength to hold the seized rigging while I inspect it. Look at the worn stop pin. It let the bell ring twice before the shift was due to end.',
    specialistEvidence: 'A worn stop pin made the shift bell ring early and twice.',
    witnessTitle: 'Compare the signed shift book', witnessVenue: 'stories',
    witnessDialogue: 'Elena Serra lays out the two crews\' signed pages. Compare the page numbers with the dates. A loose carbon sheet repeated last week\'s early finishing time on tonight\'s page.',
    witnessEvidence: 'A loose carbon sheet copied an old finishing time into the current shift book.',
    conclusion: 'Elena Serra: We have a fault to correct, not a crew to punish. Your report explains the disagreement and preserves both signatures. Ada left you the retired stop pin from the bell.',
    keepsake: 'Retired Bell Pin', keepsakeDescription: 'A worn stop pin labelled with the corrected shift report. An inert keepsake of the Foundry case.',
  },
  {
    districtId: 'brick', title: 'The Kiln Square Promise', skillId: 'fast_talker', skillName: 'Fast Talker',
    description: 'Two neighbors remember a repair promise differently. Find the original note before the argument divides the block.',
    introduction: 'Nico Bellini: A repair notice in Kiln Square promised more than the caretaker remembers. Hear why the neighbors read it differently, or inspect the workshop\'s old notice copy.',
    specialistTitle: 'Bring the neighbors to the table', specialistVenue: 'clubhouse',
    specialistDialogue: 'The neighbors talk over one another until your Fast Talker training helps you slow the conversation. Ask each to read the promise aloud. One saw the draft; the other saw the signed revision.',
    specialistEvidence: 'The neighbors read different versions of the same repair promise.',
    witnessTitle: 'Inspect the notice copy', witnessVenue: 'workshop',
    witnessDialogue: 'Ada Ferri: This notice was folded before the final line was copied. Unfold the workshop copy and compare its edge with the posted sheet. The missing line describes a second visit, not an abandoned repair.',
    witnessEvidence: 'The posted copy lost the final line describing the caretaker\'s second visit.',
    conclusion: 'Elena Serra: Put the full promise on one page, with the revision date visible. The block can settle what was agreed without inventing a betrayal. Keep the spare clay notice seal.',
    keepsake: 'Kiln Square Clay Seal', keepsakeDescription: 'A spare clay seal beside a copy of the complete repair promise. An inert keepsake of the Brick case.',
  },
  {
    districtId: 'canal', title: 'The Lockkeeper\'s Signal', skillId: 'pack_mule', skillName: 'Pack Mule',
    description: 'A boat answered the wrong signal. Reconstruct the crossing before the lockkeeper loses the district\'s trust.',
    introduction: 'Nico Bellini: A boat crossed Canal Row on a signal meant for a supply cart. The lockkeeper says the flags were moved. Check the packed flag case, or compare the crossing log.',
    specialistTitle: 'Reconstruct the flag case', specialistVenue: 'waterfront',
    specialistDialogue: 'The lockkeeper opens the packed flag case. Your Pack Mule experience helps you reconstruct which bundle was unloaded first. Match the ties to the labels: the cart flag was placed in the boat flag\'s compartment.',
    specialistEvidence: 'The flag case ties show the cart and boat bundles were stored in each other\'s compartments.',
    witnessTitle: 'Compare the crossing log', witnessVenue: 'stories',
    witnessDialogue: 'Elena Serra sets the crossing log beside the signal chart. Read the times and the small amendment in the margin. The chart changed at noon, while the boat carried the morning copy.',
    witnessEvidence: 'The boat used the morning signal chart after a noon amendment.',
    conclusion: 'Elena Serra: Your account gives the lockkeeper a correction to make and the boat hands a chart to check. We can publish both without choosing a scapegoat. Keep this retired signal ribbon.',
    keepsake: 'Retired Signal Ribbon', keepsakeDescription: 'A faded signal ribbon tied to the corrected crossing chart. An inert keepsake of the Canal case.',
  },
  {
    districtId: 'cathedral', title: 'The Missing Bell Page', skillId: 'fast_talker', skillName: 'Fast Talker',
    description: 'A missing archive page has turned a bell dedication into an accusation. Find the fuller account.',
    introduction: 'Nico Bellini: Two families claim the same bell dedication. The archive book has a missing page, and the caretaker remembers a second inscription. Hear her account or inspect the binding with Ada.',
    specialistTitle: 'Ask about the second inscription', specialistVenue: 'clubhouse',
    specialistDialogue: 'The caretaker fears that a wrong name will restart an old quarrel. Your Fast Talker training helps her describe both inscriptions in order. Compare her account with the surviving dedication card.',
    specialistEvidence: 'The caretaker\'s account and the card record two separate dedications.',
    witnessTitle: 'Inspect the archive binding', witnessVenue: 'workshop',
    witnessDialogue: 'Ada Ferri: The missing page was not torn out. Inspect the binding threads and the folded insert. The second dedication was tucked into a repair sleeve when the book was rebound.',
    witnessEvidence: 'The second dedication survives inside the archive book\'s repair sleeve.',
    conclusion: 'Elena Serra: Both names belong in the account, with their dates intact. Your report brings the second dedication back into view. The archive has given you its spare page marker.',
    keepsake: 'Archive Page Marker', keepsakeDescription: 'A plain page marker tucked into the two dated dedication cards. An inert keepsake of the Cathedral case.',
  },
];

function arc(story) {
  const graphId = 'district-' + story.districtId + '-story';
  const node = suffix => 'mystery:' + graphId + '-' + suffix;
  const intro = node('introduction'), choice = 'choice:' + graphId + '-approach';
  const specialist = node('specialist'), witness = node('witness'), report = node('report');
  const specialistEvidence = 'evidence:' + graphId + '-specialist';
  const witnessEvidence = 'evidence:' + graphId + '-witness';
  const item = 'item:district_' + story.districtId + '_keepsake';
  const status = 'reward:' + graphId + '-remembered';
  const conditions = (interactionId, skillId) => [
    { adapter: 'location', value: story.districtId },
    ...(skillId ? [{ adapter: 'skill', skillId }] : []),
    { adapter: 'explicit_interaction', interactionId },
  ];
  const pkg = {
    id: graphId, version: 1, season: 'core', dependsOn: [], nodes: [
      { id: intro, type: 'mystery_step', version: 1, visibility: 'public',
        conditions: conditions(graphId + ':meet'),
        metadata: { title: story.title, description: story.introduction,
          lore: 'Speak with the fixer in this district to begin the case. Walking alone completes no step.' } },
      { id: choice, type: 'choice', version: 1, visibility: 'public', requires: [intro],
        conditions: conditions(graphId + ':choose'), options: [
          { id: 'specialist', title: story.specialistTitle + ' (' + story.skillName + ')',
            excludes: [witness], effects: [{ adapter: 'discover', nodeId: specialist }] },
          { id: 'witness', title: story.witnessTitle,
            excludes: [specialist], effects: [{ adapter: 'discover', nodeId: witness }] },
        ], metadata: { title: 'Choose Your Approach',
          description: 'Nico Bellini: ' + story.skillName + ' lets you try a specialist approach. You can also ' + story.witnessTitle.toLowerCase() + ' without that skill. Which account will you investigate?',
          lore: 'This approach is permanent for this character. The specialist route requires the named learned skill; the other route requires none.' } },
      { id: specialist, type: 'mystery_step', version: 1, visibility: 'discovered', requires: [choice],
        excludes: [witness], conditions: conditions(graphId + ':specialist', story.skillId),
        effects: [{ adapter: 'evidence_grant', nodeId: specialistEvidence }],
        metadata: { title: story.specialistTitle, description: story.specialistDialogue,
          lore: 'Use your learned ' + story.skillName + ' skill and inspect the account explicitly.' } },
      { id: witness, type: 'mystery_step', version: 1, visibility: 'discovered', requires: [choice],
        excludes: [specialist], conditions: conditions(graphId + ':witness'),
        effects: [{ adapter: 'evidence_grant', nodeId: witnessEvidence }],
        metadata: { title: story.witnessTitle, description: story.witnessDialogue,
          lore: 'Inspect the account explicitly. No learned skill is required for this approach.' } },
      { id: specialistEvidence, type: 'evidence', version: 1, visibility: 'discovered', requires: [specialist],
        metadata: { title: story.specialistTitle + ': Account', description: story.specialistEvidence } },
      { id: witnessEvidence, type: 'evidence', version: 1, visibility: 'discovered', requires: [witness],
        metadata: { title: story.witnessTitle + ': Account', description: story.witnessEvidence } },
      { id: report, type: 'mystery_step', version: 1, visibility: 'discovered', requires: [intro, choice],
        requiresAny: [[specialist, witness], [specialistEvidence, witnessEvidence]],
        conditions: conditions(graphId + ':report'), effects: [
          { adapter: 'unique_item_award', templateId: item },
          { adapter: 'status_award', nodeId: status },
        ], metadata: { title: 'Publish the District Account', description: story.conclusion,
          lore: 'Give Elena the account supported by your evidence. The keepsake has no economic or combat benefit.', terminal: true } },
      { id: item, type: 'item_template', version: 1, visibility: 'hidden',
        metadata: { title: story.keepsake, description: story.keepsakeDescription,
          inventoryClass: 'unique', inert: true, tradeable: false, exportEligible: false } },
      { id: status, type: 'reward', version: 1, visibility: 'hidden', requires: [report],
        metadata: { title: story.title + ': Remembered', description: 'A completed district case, preserved in this character\'s history.',
          inert: true, rewardType: 'status' } },
    ],
  };
  return { package: pkg, skillId: story.skillId,
    presentation: { cityQuest: true, graphId, version: 1, districtId: story.districtId,
      title: story.title, description: story.description, ownerScope: 'character',
      startVenueId: 'fixer', exploreVenueId: 'stories', rewardTitle: story.keepsake,
      deathPolicy: 'immutable_history_no_inheritance' },
    venues: { [intro]: 'fixer', [choice]: 'fixer', [specialist]: story.specialistVenue,
      [witness]: story.witnessVenue, [report]: 'stories' },
    actionLabels: { [intro]: 'Hear about ' + story.title, [specialist]: story.specialistTitle,
      [witness]: story.witnessTitle, [report]: 'Publish your corrected account' },
  };
}

export const DISTRICT_STORY_ARCS = frozen(stories.map(arc));
export const DISTRICT_STORY_ARC_PACKAGES = Object.freeze(DISTRICT_STORY_ARCS.map(story => story.package));
