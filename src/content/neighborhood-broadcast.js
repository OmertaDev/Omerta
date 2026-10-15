// A finite follow-on case. Existing mystery transactions own its branch, evidence and keepsakes.
function frozen(value) {
  if (value && typeof value === 'object') {
    for (const entry of Object.values(value)) frozen(entry);
    Object.freeze(value);
  }
  return value;
}

const graphId = 'neighborhood-broadcast';
const intro = 'mystery:broadcast-static', choice = 'choice:broadcast-repair';
const live = 'mystery:broadcast-live', archive = 'mystery:broadcast-archive';
const liveEvidence = 'evidence:broadcast-live', archiveEvidence = 'evidence:broadcast-archive';
const liveEnd = 'mystery:broadcast-live-finale', archiveEnd = 'mystery:broadcast-archive-finale';
const dial = 'item:neighborhood_brass_dial', reel = 'item:neighborhood_first_reel';
const liveStatus = 'reward:broadcast-neighborhood-voice', archiveStatus = 'reward:broadcast-lost-voice';
const interaction = id => [{ adapter: 'explicit_interaction', interactionId: graphId + ':' + id }];
const evidence = (id, source, title, description) => ({ id, type: 'evidence', version: 1,
  visibility: 'discovered', requires: [source], metadata: { title, description } });
const keepsake = (id, title, description) => ({ id, type: 'item_template', version: 1, visibility: 'hidden',
  metadata: { title, description, inventoryClass: 'unique', inert: true, tradeable: false, exportEligible: false } });
const status = (id, source, title, description) => ({ id, type: 'reward', version: 1,
  visibility: 'hidden', requires: [source], metadata: { title, description, inert: true, rewardType: 'status' } });

export const NEIGHBORHOOD_BROADCAST_PACKAGE = frozen({
  id: graphId, version: 1, season: 'core', dependsOn: ['neighborhood-initiation'], nodes: [
    { id: intro, type: 'mystery_step', version: 1, visibility: 'public',
      conditions: [{ adapter: 'item_ownership', templateId: 'item:neighborhood_notebook' }, ...interaction('hear-static')],
      metadata: { title: '1/3 — A Voice in the Static',
        description: 'Nico Bellini: Elena remembers your first correction. Now the block\'s little radio station has gone silent. Ada can rescue the live transmitter or an old recording caught in the machine, but the damaged selector will only hold one repair. Take your notebook and decide which voice the neighborhood should hear.',
        lore: 'Complete A Name Worth Remembering to earn your Neighborhood Notebook, then speak with Nico. This three-stage case has two permanent endings and one keepsake per character.' } },
    { id: choice, type: 'choice', version: 1, visibility: 'public', requires: [intro],
      conditions: interaction('choose-repair'), options: [
        { id: 'live', title: 'Restore live voices (Brass Dial keepsake)', excludes: [archive, archiveEnd],
          effects: [{ adapter: 'discover', nodeId: live }] },
        { id: 'archive', title: 'Recover the lost recording (First Reel keepsake)', excludes: [live, liveEnd],
          effects: [{ adapter: 'discover', nodeId: archive }] },
      ], metadata: { title: '2/3 — Choose Tonight\'s Broadcast',
        description: 'Nico: Restore the transmitter and the neighbors can speak to one another tonight. Rescue the recording and we may finally hear who kept this place alive during the old blackout. Both matter. Which story do you want to bring back?',
        lore: 'Live voices opens Ada\'s transmitter repair and the neighborhood broadcast, awarding a Brass Dial. The recording opens Elena\'s archive investigation and a different finale, awarding the First Reel. Choosing closes the other route for this character; neither route costs money or grants a combat advantage.' } },
    { id: live, type: 'mystery_step', version: 1, visibility: 'discovered', requires: [choice], excludes: [archive],
      conditions: interaction('restore-transmitter'), effects: [{ adapter: 'evidence_grant', nodeId: liveEvidence }],
      metadata: { title: '2/3 — Bring the Needle Home',
        description: 'Ada Ferri: Hold this dial on the pencil mark while I bridge the broken contact. Hear those three knocks? That is the bakery answering our test. The next voice is the night porter, asking whether anyone has seen his runaway cat. The needle settles. You have the block back on the air.',
        lore: 'Tune the repaired transmitter with Ada. The live signal becomes evidence in your journal and opens the newsroom finale.' } },
    { id: archive, type: 'mystery_step', version: 1, visibility: 'discovered', requires: [choice], excludes: [live],
      conditions: interaction('recover-recording'), effects: [{ adapter: 'evidence_grant', nodeId: archiveEvidence }],
      metadata: { title: '2/3 — The Voice Between the Songs',
        description: 'Elena Serra: Ada freed the reel. Help me line up the torn label with the date in your notebook. Beneath the music, a young voice reads out which doors still have candles and food. It is Nico, years before anyone called him a fixer. He never put his name on the tape.',
        lore: 'Compare the recovered reel and its label with Elena. The identified recording becomes evidence in your journal and opens its own newsroom finale.' } },
    evidence(liveEvidence, live, 'Three Knocks, Then a Voice',
      'The bakery answered the test signal. Ada\'s repair has restored the neighborhood\'s live transmitter.'),
    evidence(archiveEvidence, archive, 'Nico\'s First Broadcast',
      'The reel records young Nico sharing food and candle addresses during the old blackout. Its dated label confirms the voice.'),
    { id: liveEnd, type: 'mystery_step', version: 1, visibility: 'discovered', requires: [live, liveEvidence], excludes: [archiveEnd],
      conditions: interaction('broadcast-live'), effects: [{ adapter: 'unique_item_award', templateId: dial },
        { adapter: 'status_award', nodeId: liveStatus }],
      metadata: { title: '3/3 — This Is Your Neighborhood Speaking',
        description: 'Elena opens the microphone. The bakery offers the last warm loaf; the porter\'s cat has turned up asleep in Ada\'s toolbox. Then someone asks your name. Nico grins as the room repeats it. Ada places the retired brass tuning dial beside your notebook: you brought their voices back.',
        lore: 'Put the neighborhood on the air and complete the case. Receive the Brass Tuning Dial and the lasting title A Voice of the Neighborhood. This keepsake is awarded once; the recording ending stays closed.', terminal: true } },
    { id: archiveEnd, type: 'mystery_step', version: 1, visibility: 'discovered', requires: [archive, archiveEvidence], excludes: [liveEnd],
      conditions: interaction('play-first-reel'), effects: [{ adapter: 'unique_item_award', templateId: reel },
        { adapter: 'status_award', nodeId: archiveStatus }],
      metadata: { title: '3/3 — Before He Was the Fixer',
        description: 'Elena plays the recovered tape to Nico. He starts to joke, then hears a neighbor thanking him by name. For once he lets the recording finish. “Keep it,” he says, signing the reel case. “Someone should remember what we sounded like before we learned to keep quiet.”',
        lore: 'Play Nico\'s first broadcast and complete the case. Receive the Signed First Reel and the lasting title Keeper of the First Broadcast. This keepsake is awarded once; the live ending stays closed.', terminal: true } },
    keepsake(dial, 'Brass Tuning Dial', 'Ada\'s retired brass dial, fixed to the mark where the neighborhood found its voice. A cosmetic keepsake of the live broadcast.'),
    keepsake(reel, 'Signed First Reel', 'The recovered blackout recording, in a case signed by Nico. A cosmetic keepsake of the voice you brought back.'),
    status(liveStatus, liveEnd, 'A Voice of the Neighborhood', 'You restored the live broadcast and gave the block a place to speak.'),
    status(archiveStatus, archiveEnd, 'Keeper of the First Broadcast', 'You recovered the recording of Nico helping the neighborhood through its old blackout.'),
  ],
});

export const NEIGHBORHOOD_BROADCAST_PRESENTATION = frozen({ graphId, version: 1, cityQuest: true,
  title: 'The Block\'s Last Broadcast', description: 'After your first case, bring your Neighborhood Notebook to Nico. Restore live voices or uncover his forgotten first broadcast in three stages.',
  ownerScope: 'character', startVenueId: 'fixer', exploreVenueId: 'stories',
  rewardTitle: 'A broadcast keepsake chosen by your route', deathPolicy: 'immutable_history_no_inheritance' });
export const NEIGHBORHOOD_BROADCAST_VENUES = frozen({ [intro]: 'fixer', [choice]: 'fixer',
  [live]: 'workshop', [archive]: 'stories', [liveEnd]: 'stories', [archiveEnd]: 'stories' });
export const NEIGHBORHOOD_BROADCAST_ACTION_LABELS = frozen({ [intro]: 'Hear Nico\'s request',
  [live]: 'Tune the live transmitter', [archive]: 'Recover Nico\'s recording',
  [liveEnd]: 'Open the neighborhood microphone', [archiveEnd]: 'Play the first broadcast' });
