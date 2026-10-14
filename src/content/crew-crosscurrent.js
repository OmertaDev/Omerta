// A new immutable mission. The original Quiet Pier package and its receipts remain unchanged.
const graphId = 'crew-crosscurrent-v1', operationId = 'operation:crosscurrent-run';
const id = value => 'operation:crosscurrent-' + value;
const step = (key, roleId, title, description, requires, extra = {}) => ({
  id: id(key), type: 'operation_step', version: 1, visibility: 'public', requires,
  conditions: [{ adapter: 'location', value: 'docks' }, { adapter: 'explicit_interaction', interactionId: 'crosscurrent:' + key }],
  metadata: { operationId, roleId, title, description }, ...extra,
});
const clue = (key, roleId, text, requires) => ({
  id: 'evidence:crosscurrent-' + key, type: 'evidence', version: 1, visibility: 'role_private', requires,
  metadata: { operationId, roleId, title: 'Your ' + key.replaceAll('-', ' ') + ' notes', privateEvidence: text },
});
const evidence = key => [{ adapter: 'evidence_grant', nodeId: 'evidence:crosscurrent-' + key }];
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
export const CREW_CROSSCURRENT_PACKAGE = freeze({
  id: graphId, version: 1, season: 'core', dependsOn: ['district-docks-story'], nodes: [
    { id: operationId, type: 'social_gate', version: 1, visibility: 'public',
      requires: ['mystery:district-docks-story-report'], conditions: [{ adapter: 'location', value: 'docks' }],
      effects: [{ adapter: 'status_award', nodeId: 'reward:crosscurrent-crew' }],
      metadata: { title: 'Crosscurrent: the Missing Launch',
        description: 'Choose a crossing, interpret its signal together, then commit an escape. Each role sees a different piece of the problem.',
        lore: 'A launch carrying the corrected ferry records missed its berth. Your three-person Crew chooses what to risk: time, visibility, or the open water.',
        minimumDistinctAccounts: 3, closerRoleId: 'planner',
        mysteryGate: { graphId: 'district-docks-story', graphVersion: 1, ownerScope: 'character', requiredStatus: 'completed' },
        roles: [
          { id: 'planner', title: 'Planner', distinct: true, description: 'Choose quay or canal and brief the others.', conditions: [{ adapter: 'location', value: 'docks' }] },
          { id: 'lookout', title: 'Lookout', distinct: true, description: 'Read the selected crossing and choose its signal.', conditions: [{ adapter: 'location', value: 'docks' }] },
          { id: 'driver', title: 'Driver', distinct: true, description: 'Combine the route and signal into an escape.', conditions: [{ adapter: 'location', value: 'docks' }] },
        ], completionRequires: [id('brief'), id('signal'), id('finish')],
      } },
    step('quay', 'planner', 'Use the crowded quay', 'Stay on dry ground. The lookout must work around the passing night watch; the driver gets cover but loses the short water exit.', [operationId], { excludes: [id('canal')] }),
    step('canal', 'planner', 'Use the narrow canal', 'Avoid the watch. The lookout must read the tide bell; the driver exchanges cover for an open-water exit.', [operationId], { excludes: [id('quay')] }),
    step('brief', 'planner', 'Send the crossing brief', 'Commit the chosen route for the lookout. The alternative crossing stays closed for this run.', [operationId], { requiresAny: [[id('quay'), id('canal')]] }),
    step('read-quay', 'lookout', 'Watch the quay patrol', 'Read the lantern rhythm before choosing what to tell the driver.', [id('brief'), id('quay')], { visibility: 'role_private', effects: evidence('quay') }),
    clue('quay', 'lookout', 'The night watch faces the river on a single bell. Wait for that bell for a covered exit; a blue lantern calls the porter away, opening the gate sooner but exposing the launch.', [id('read-quay')]),
    step('read-canal', 'lookout', 'Read the canal tide', 'Compare the tide bell with the launch rope before choosing a signal.', [id('brief'), id('canal')], { visibility: 'role_private', effects: evidence('canal') }),
    clue('canal', 'lookout', 'Two bells mark slack water. Waiting makes a quiet crossing; a blue lantern asks the lock keeper to open early, trading a stronger current for a faster exit.', [id('read-canal')]),
    step('wait', 'lookout', 'Signal: wait for the bell', 'Choose patience and a quieter crossing. The driver must use the bell timing for the selected route.', [id('brief')], { requiresAny: [[id('read-quay'), id('read-canal')]], excludes: [id('blue')] }),
    step('blue', 'lookout', 'Signal: show the blue lantern', 'Choose the early opening. The driver must manage visibility at the quay or current in the canal.', [id('brief')], { requiresAny: [[id('read-quay'), id('read-canal')]], excludes: [id('wait')] }),
    step('signal', 'lookout', 'Acknowledge the signal', 'Send the committed signal and crossing to the driver. Your private observations remain in your own role notes.', [id('brief')], { requiresAny: [[id('wait'), id('blue')]] }),
    step('read-escape', 'driver', 'Inspect the launch controls', 'Read your steering notes and combine them with the Crew’s two decisions.', [id('signal')], { visibility: 'role_private', effects: evidence('launch') }),
    clue('launch', 'driver', 'Quay + bell: stay behind the moored barges. Quay + blue: cross the open gate before the porter returns. Canal + bell: drift through slack water. Canal + blue: use the outer towline against the current. Read the shared route and signal before choosing.', [id('read-escape')]),
    ...[
      ['barge', 'quay', 'wait', 'Leave behind the barges', 'The bell turns the watch away. The barges hide the slow, covered exit.', 'towpath', 'Take the towpath on the bell', 'Reach the records sooner, but leave a visible wake beside the watch.'],
      ['gate', 'quay', 'blue', 'Take the open quay gate', 'The porter follows the blue lantern. You take the exposed early opening before they return.', 'mooring', 'Wait behind the empty mooring', 'Let the porter return before you move: a later arrival, with no launch seen in the gate.'],
      ['drift', 'canal', 'wait', 'Drift with slack water', 'The tide bell marks a quiet interval. You give up speed and let the launch drift.', 'oars', 'Row through the slack interval', 'Make the crossing sooner, with audible oarlocks under the bridge.'],
      ['towline', 'canal', 'blue', 'Use the outer towline', 'The lock opens early. You hold the outer rope against the stronger current.', 'lockwall', 'Shelter behind the lock wall', 'Wait out the strongest current. The records arrive later, but the rope and crew remain out of view.'],
    ].flatMap(([key, route, signal, title, description, alternate, alternateTitle, alternateDescription]) => [
      step(key, 'driver', title, description, [id('read-escape'), id(route), id(signal)], { excludes: [id(alternate)] }),
      step(alternate, 'driver', alternateTitle, alternateDescription, [id('read-escape'), id(route), id(signal)], { excludes: [id(key)] }),
    ]),
    step('finish', 'driver', 'Secure the ferry records', 'Record the escape chosen from the Crew’s route and signal. This closes your part without creating cash or items.', [id('signal')],
      { requiresAny: [[id('barge'), id('towpath'), id('gate'), id('mooring'), id('drift'), id('oars'), id('towline'), id('lockwall')]] }),
    { id: 'reward:crosscurrent-crew', type: 'reward', version: 1, visibility: 'hidden', requires: [operationId],
      metadata: { title: 'Crosscurrent Crew', description: 'Three roles combined a crossing, signal and escape to recover the ferry records.', operationId, inert: true, rewardType: 'status' } },
  ],
});
